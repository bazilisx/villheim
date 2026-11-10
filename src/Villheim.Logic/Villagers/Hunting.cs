using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Hunting, so there is meat for the cooking station. Like Millenaire's hunters, it is background work for the
    /// village's protectors (elders leave it to the young): by day, when the village chest holds little food, one
    /// protector at a time goes after a boar, deer, neck or hare near the village, brings it down, waits by the kill
    /// for what it drops (meat, hides, trophies) and carries it to the village chest.
    ///
    /// Deer always run, so they are only hunted with a bow (T-18). Other game is shot from up to HuntBowRange, or
    /// fought with the weapon when it is within HuntMeleeRange. A hunter gives up after HuntChaseSeconds, or when the
    /// animal gets HuntChaseDistance past the village's working reach, and leaves that animal alone for a few minutes.
    /// </summary>
    internal static class Hunting
    {
        // The village radius plus a band past it: game seldom comes inside a village once it stands (Tyler, 2026-11-09).
        private static float SearchFromHearth => VillheimConfig.VillageRadius.Value + Mathf.Max(0f, LogicConfig.HuntSearchRadius?.Value ?? 40f);
        private const float StrikeReach = 2.3f;
        private const float StrikeInterval = 1.4f;
        private const float ShotInterval = 1.6f;
        private const float DropWait = 12f;
        private const int EnoughFood = 4;

        private static readonly string[] Game = { "Boar", "Deer", "Neck", "Hare" };

        /// <summary>
        /// Game animals: hunted, never a threat. A boar the hunter hits turns on him, and that is part of the hunt, so it
        /// raises no alarm or call to arms (T-58). The village's own animals are never game.
        /// </summary>
        public static bool IsGame(Character character) =>
            character != null && !(character is Villager) && System.Array.IndexOf(Game, Utils.GetPrefabName(character.gameObject)) >= 0;

        /// <summary>A hunting line (hunt:start, hunt:kill, hunt:lost), if one is written.</summary>
        private static void Say(Villager villager, string tag)
        {
            string line = Dialogue.LineFor(villager, "self", tag, new[] { tag });
            if (line != null)
            {
                Dialogue.Say(villager, line, 4f);
            }
        }

        private enum Phase
        {
            None,
            Chase,
            Collect,
            Deliver,
        }

        private sealed class State
        {
            public Phase Phase;
            public Character Prey;
            public Vector3 KillSpot;
            public float Deadline;
            public float NextStrike;
            public float NextLook;
            public float LastRun;
            public float DropsSeenAt = -1f;
            public Vector3 LastPreyPos;
            public float LastPreyPosAt;
            public Vector3 Velocity;
            public bool Bow;
            public readonly Dictionary<string, int> Carrying = new Dictionary<string, int>();
        }

        // Animals a hunter gave up on, left alone for a while so he does not go straight back after them.
        private static readonly Dictionary<ZDOID, float> LetGo = new Dictionary<ZDOID, float>();

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();
        private static readonly Dictionary<int, Villager> Hunters = new Dictionary<int, Villager>();

        public static bool IsHunting(Villager villager) => States.TryGetValue(villager, out State state) && state.Phase != Phase.None;

        // ---------------------------------------------------------------- who hunts, and when

        private static readonly Dictionary<int, (float Time, Villager Hunter)> HunterOf = new Dictionary<int, (float, Villager)>();
        private static readonly Dictionary<int, float> MeatWantedUntil = new Dictionary<int, float>();

        /// <summary>
        /// The one villager who hunts for the village (Tyler: nobody hunted in a village of mostly elders): the hunter by
        /// trade (D-075), else a protector who is not an elder, else any grown villager who is not an elder (the
        /// builder, cooks, farmers and healers last), else an elder, who hunts at a walk with the bow. The healthiest of
        /// them, so a hurt village sends its fittest.
        /// </summary>
        public static bool IsVillageHunter(Villager villager)
        {
            if (villager == null || Childhood.IsChild(villager) || Wanderers.IsWanderer(villager))
            {
                return false;
            }

            int id = villager.VillageId;
            if (!HunterOf.TryGetValue(id, out (float Time, Villager Hunter) cached) || Time.time - cached.Time > 3f ||
                cached.Hunter == null || cached.Hunter.IsDead())
            {
                if (cached.Hunter != null && !cached.Hunter.IsDead() && IsHunting(cached.Hunter))
                {
                    // Out on a hunt: he stays the hunter until he is back.
                    HunterOf[id] = (Time.time, cached.Hunter);
                    return cached.Hunter == villager;
                }

                Villager best = null;
                int bestRank = int.MaxValue;
                float bestHealth = -1f;
                foreach (Character character in Character.GetAllCharacters())
                {
                    if (!(character is Villager v) || v.IsDead() || v.VillageId != id || v.Zdo == null || Childhood.IsChild(v) ||
                        Wanderers.IsWanderer(v))
                    {
                        continue;
                    }

                    bool elder = Elders.IsElder(v);
                    Roles.Trade trade = Roles.TradeOf(v);
                    int rank = trade == Roles.Trade.Hunter ? -1
                        : !elder && (trade == Roles.Trade.Cook || trade == Roles.Trade.Farmer || trade == Roles.Trade.Healer) ? 2
                        : !elder && Roles.BackgroundOf(v) == Roles.Background.Protector ? 0
                        : !elder && !Chores.IsVillageBuilder(v) ? 1
                        : !elder ? 2
                        : 3;
                    float health = v.GetHealth() / Mathf.Max(1f, v.GetMaxHealth());
                    if (health < 0.5f)
                    {
                        // The badly hurt heal first; anyone fit goes before them, whatever his part.
                        rank += 4;
                    }

                    if (rank < bestRank || (rank == bestRank && health > bestHealth + 0.05f))
                    {
                        best = v;
                        bestRank = rank;
                        bestHealth = health;
                    }
                }

                cached = (Time.time, best);
                HunterOf[id] = cached;
            }

            return cached.Hunter == villager;
        }

        /// <summary>The village wants meat for a while whatever its chests hold (the hurt with nothing to eat, 'vh test hunt').</summary>
        public static void WantMeat(int villageId, float seconds)
        {
            float until = Time.time + seconds;
            if (!MeatWantedUntil.TryGetValue(villageId, out float now) || now < until)
            {
                MeatWantedUntil[villageId] = until;
            }
        }

        /// <summary>The village wants meat: asked for, or its chests hold less than HuntMeatTarget.</summary>
        public static bool WantsMeat(VillageHearth hearth)
        {
            if (MeatWantedUntil.TryGetValue(hearth.VillageId, out float until) && Time.time < until)
            {
                return true;
            }

            int target = Mathf.Max(0, LogicConfig.HuntMeatTarget?.Value ?? EnoughFood) * Village.Calendar.FoodFactor();
            return MeatInChests(hearth) < target;
        }

        private static void Log(string message)
        {
            if (LogicConfig.IsOn(LogicConfig.DebugLog))
            {
                VillheimPlugin.Log.LogInfo("[hunt] " + message);
            }
        }

        public static string Describe(Villager villager)
        {
            if (!States.TryGetValue(villager, out State state) || Time.time - state.LastRun > 1f)
            {
                return null;
            }

            switch (state.Phase)
            {
                case Phase.Chase: return state.Prey != null ? $"hunting a {state.Prey.GetHoverName()}{(state.Bow ? " with a bow" : "")}" : "hunting";
                case Phase.Collect: return "butchering the kill";
                case Phase.Deliver: return "carrying meat to the chest";
                default: return null;
            }
        }

        /// <summary>True while this villager is out hunting.</summary>
        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            State state = States.GetOrCreateValue(villager);
            if (state.Phase != Phase.None && Time.time - state.LastRun > 5f)
            {
                // Something else ran him for a while (a fight, a chore): the hunt is off.
                End(villager, state);
            }

            state.LastRun = Time.time;
            if (state.Phase == Phase.None && !Begin(villager, state))
            {
                return false;
            }

            switch (state.Phase)
            {
                case Phase.Chase: return Chase(villager, ai, dt, state);
                case Phase.Collect: return Collect(villager, ai, dt, state);
                case Phase.Deliver: return Deliver(villager, ai, dt, state);
            }

            return false;
        }

        private static bool Begin(Villager villager, State state)
        {
            if (EnvMan.IsNight() || Time.time < state.NextLook || !IsVillageHunter(villager))
            {
                return false;
            }

            state.NextLook = Time.time + Random.Range(5f, 10f);
            if (Hunters.TryGetValue(villager.VillageId, out Villager hunter) && hunter != null && hunter != villager && !hunter.IsDead() &&
                IsHunting(hunter))
            {
                return false;
            }

            // A hunter by trade keeps the chests fuller than anyone else would (twice the target).
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            bool byTrade = Roles.TradeOf(villager) == Roles.Trade.Hunter;
            if (hearth == null || !hearth.IsValid ||
                !(WantsMeat(hearth) || (byTrade && MeatInChests(hearth) < 2 * Mathf.Max(0, LogicConfig.HuntMeatTarget?.Value ?? EnoughFood) * Village.Calendar.FoodFactor())))
            {
                return false;
            }

            Character prey = FindPrey(villager.VillageId, hearth.transform.position, villager.transform.position);
            if (prey == null)
            {
                Log($"{villager.VillagerName} would hunt for {hearth.VillageName} but sees no game within " +
                    $"{Village.Knowledge.WorkRadius(villager.VillageId, SearchFromHearth):0} m of the hearth.");
                return false;
            }

            Log($"{villager.VillagerName} goes after a {prey.m_name} {Utils.DistanceXZ(prey.transform.position, hearth.transform.position):0} m from the hearth " +
                $"(meat in the chests: {MeatInChests(hearth)}).");

            Hunters[villager.VillageId] = villager;
            // The last hunt's "meat in the chest" talk is over once someone sets out again (T-108).
            Dialogue.Forget(villager.VillageId, "hunt");
            if (Random.value < 0.5f)
            {
                Say(villager, "hunt:start");
            }

            state.Prey = prey;
            // The weapon in hand from the start (never the pickaxe from his last job), the bow and arrows in his pack.
            Roles.ArmForHunt(villager);
            state.Phase = Phase.Chase;
            state.Deadline = Time.time + Mathf.Max(10f, LogicConfig.HuntChaseSeconds?.Value ?? 45f);
            state.LastPreyPosAt = 0f;
            state.Velocity = Vector3.zero;
            state.Bow = false;
            Walker.For(villager).Reset();
            VillheimPlugin.Debug($"{villager.VillagerName} goes hunting ({prey.m_name}).");
            return true;
        }

        private static bool IsDeer(Character prey) => Utils.GetPrefabName(prey.gameObject).StartsWith("Deer");

        private static bool Chase(Villager villager, VillagerAI ai, float dt, State state)
        {
            Character prey = state.Prey;
            if (prey == null || prey.IsDead())
            {
                // The kill line waits for the meat on the ground (Collect), so nobody talks of meat too soon (T-108).
                state.Phase = Phase.Collect;
                state.Deadline = Time.time + 20f;
                state.DropsSeenAt = -1f;
                Walker.For(villager).Reset();
                return true;
            }

            state.KillSpot = prey.transform.position;
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            float reach = Village.Knowledge.WorkRadius(villager.VillageId, SearchFromHearth) + (LogicConfig.HuntChaseDistance?.Value ?? 30f);
            bool tooFar = hearth != null && Utils.DistanceXZ(prey.transform.position, hearth.transform.position) > reach;
            if (Time.time > state.Deadline || tooFar)
            {
                VillheimPlugin.Debug($"{villager.VillagerName} gives up on the {prey.m_name} ({(tooFar ? "too far out" : "too long")}).");
                LetGo[prey.GetZDOID()] = Time.time + 180f;
                Say(villager, "hunt:lost");
                End(villager, state);
                return false;
            }

            TrackPrey(state, prey);
            float distance = Vector3.Distance(villager.transform.position, prey.transform.position);
            float meleeRange = Mathf.Max(StrikeReach, LogicConfig.HuntMeleeRange?.Value ?? 4f);
            float bowRange = Mathf.Max(8f, LogicConfig.HuntBowRange?.Value ?? 25f);
            bool arrows = Defenders.CarriedArrow(villager) != null;
            if (IsDeer(prey) && !arrows)
            {
                // Deer are only hunted with the bow; with no arrows he lets it go until he has made more.
                LetGo[prey.GetZDOID()] = Time.time + 180f;
                End(villager, state);
                return false;
            }

            state.Bow = arrows && (IsDeer(prey) || distance > meleeRange);
            if (state.Bow)
            {
                bool seen = InSight(villager, prey);
                if (distance > bowRange || !seen)
                {
                    // Into bow range, walking the last part so he doesn't start them running.
                    Walker.For(villager).Go(villager, ai, dt, prey.transform.position, bowRange * 0.6f, distance > bowRange * 1.5f);
                    return true;
                }

                ai.StopMoving();
                if (Time.time >= state.NextStrike && Defenders.ShootAt(villager, ai, prey, state.Velocity, 1.5f))
                {
                    state.NextStrike = Time.time + ShotInterval * Random.Range(0.9f, 1.15f);
                    string animation = (villager.GetLeftItem() ?? villager.GetRightItem())?.m_shared?.m_attack?.m_attackAnimation;
                    if (LogicConfig.IsOn(LogicConfig.DefenderBowAnimation) && !string.IsNullOrEmpty(animation) && villager.m_zanim != null)
                    {
                        villager.m_zanim.SetTrigger(animation);
                    }
                }

                return true;
            }

            // Up close to a boar or a neck: the weapon.
            if (HoldsBow(villager))
            {
                Defenders.PutBowAway(villager);
            }

            if (!Roles.IsWeapon(villager.GetRightItem()))
            {
                Roles.ArmForHunt(villager);
            }

            if (distance > StrikeReach)
            {
                Walker.For(villager).Go(villager, ai, dt, prey.transform.position, StrikeReach * 0.7f, true);
                return true;
            }

            ai.StopMoving();
            ai.LookAt(prey.GetCenterPoint());
            Vector3 toPrey = prey.transform.position - villager.transform.position;
            toPrey.y = 0f;
            if (toPrey.sqrMagnitude > 0.01f)
            {
                villager.SetLookDir(toPrey.normalized);
            }

            if (Time.time < state.NextStrike)
            {
                return true;
            }

            state.NextStrike = Time.time + StrikeInterval;
            Chores.ToolAnimation(villager, null);
            ItemDrop.ItemData weapon = villager.GetCurrentWeapon();
            var hit = new HitData
            {
                m_point = prey.GetCenterPoint(),
                m_dir = toPrey.sqrMagnitude > 0.01f ? toPrey.normalized : villager.transform.forward,
                m_attacker = villager.GetZDOID(),
                m_toolTier = (short)(weapon?.m_shared?.m_toolTier ?? 0),
            };
            hit.m_damage.m_pierce = Mathf.Max(weapon?.m_shared?.m_damages.m_pierce ?? 0f, 12f);
            hit.m_damage.m_blunt = weapon?.m_shared?.m_damages.m_blunt ?? 0f;
            prey.Damage(hit);
            return true;
        }

        private static bool HoldsBow(Villager villager)
        {
            ItemDrop.ItemData left = villager.GetLeftItem();
            return left != null && left.m_shared.m_itemType == ItemDrop.ItemData.ItemType.Bow;
        }

        private static int _sightMask;

        private static bool InSight(Villager villager, Character prey)
        {
            if (_sightMask == 0)
            {
                _sightMask = LayerMask.GetMask("Default", "static_solid", "Default_small", "piece", "terrain", "vehicle");
            }

            return !Physics.Linecast(villager.GetEyePoint(), prey.GetCenterPoint(), _sightMask);
        }

        private static void TrackPrey(State state, Character prey)
        {
            Vector3 now = prey.GetCenterPoint();
            if (state.LastPreyPosAt > 0f && Time.time - state.LastPreyPosAt > 0.05f)
            {
                state.Velocity = Vector3.Lerp(state.Velocity, (now - state.LastPreyPos) / (Time.time - state.LastPreyPosAt), 0.5f);
            }

            if (state.LastPreyPosAt <= 0f || Time.time - state.LastPreyPosAt > 0.05f)
            {
                state.LastPreyPos = now;
                state.LastPreyPosAt = Time.time;
            }
        }

        /// <summary>
        /// Waits by the kill for what it drops (many animals drop their meat only as the body fades, a few seconds
        /// on), then picks it up. Gives up after DropWait seconds at the spot.
        /// </summary>
        private static bool Collect(Villager villager, VillagerAI ai, float dt, State state)
        {
            if (HoldsBow(villager))
            {
                Defenders.PutBowAway(villager);
            }

            if (Walker.For(villager).Go(villager, ai, dt, state.KillSpot, 1.2f) == WalkResult.Walking && Time.time < state.Deadline)
            {
                return true;
            }

            ai.StopMoving();
            if (state.DropsSeenAt < 0f)
            {
                // At the spot: the wait starts now.
                state.DropsSeenAt = 0f;
                state.Deadline = Time.time + DropWait;
            }

            List<ItemDrop> drops = DropsAround(state.KillSpot);
            if (drops.Count > 0 && state.DropsSeenAt <= 0f)
            {
                // The first drops are down; give the rest a second to land.
                state.DropsSeenAt = Time.time;
            }

            bool ready = state.DropsSeenAt > 0f && Time.time - state.DropsSeenAt > 1f;
            if (!ready && Time.time < state.Deadline)
            {
                return true;
            }

            Poses.Trigger(villager, "interact");
            foreach (ItemDrop item in drops)
            {
                string name = Utils.GetPrefabName(item.gameObject);
                if (Trophies.Keep(villager, item))
                {
                    // His own trophy, to hang in his home (Trophies).
                    continue;
                }

                state.Carrying.TryGetValue(name, out int count);
                state.Carrying[name] = count + item.m_itemData.m_stack;
                item.m_nview.ClaimOwnership();
                ZNetScene.instance.Destroy(item.gameObject);
            }

            if (state.Carrying.Keys.Any(CookableName))
            {
                Say(villager, "hunt:kill");
            }

            state.Phase = Phase.Deliver;
            state.Deadline = Time.time + 90f;
            Walker.For(villager).Reset();
            return true;
        }

        private static List<ItemDrop> DropsAround(Vector3 spot)
        {
            var found = new List<ItemDrop>();
            foreach (Collider collider in Physics.OverlapSphere(spot, 4f))
            {
                ItemDrop item = collider.GetComponentInParent<ItemDrop>();
                if (item != null && item.m_nview != null && item.m_nview.IsValid() && IsGameDrop(item) && !found.Contains(item))
                {
                    found.Add(item);
                }
            }

            return found;
        }

        private static bool Deliver(Villager villager, VillagerAI ai, float dt, State state)
        {
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            Container chest = hearth != null && hearth.IsValid ? VillageChest.Find(hearth) : null;
            if (chest == null || state.Carrying.Count == 0)
            {
                End(villager, state);
                return false;
            }

            if (Walker.For(villager).Go(villager, ai, dt, chest.transform.position, 1.6f, true) == WalkResult.Walking && Time.time < state.Deadline)
            {
                return true;
            }

            ai.StopMoving();
            Poses.Trigger(villager, "interact");
            foreach (KeyValuePair<string, int> carried in state.Carrying)
            {
                GameObject prefab = ObjectDB.instance.GetItemPrefab(carried.Key);
                if (prefab != null)
                {
                    chest.GetInventory().AddItem(prefab, carried.Value);
                }
            }

            VillheimPlugin.Debug($"{villager.VillagerName} brought back {string.Join(", ", state.Carrying.Select(c => $"{c.Value} {c.Key}"))}.");
            Dialogue.Note(villager.VillageId, "hunt");
            End(villager, state);
            return false;
        }

        private static void End(Villager villager, State state)
        {
            if (HoldsBow(villager))
            {
                Defenders.PutBowAway(villager);
            }

            state.Phase = Phase.None;
            state.Prey = null;
            state.Carrying.Clear();
            if (Hunters.TryGetValue(villager.VillageId, out Villager hunter) && hunter == villager)
            {
                Hunters.Remove(villager.VillageId);
            }
        }

        private static Character FindPrey(int villageId, Vector3 hearth, Vector3 from)
        {
            Character best = null;
            // A grown village hunts further out, where it has the gear for the land (Knowledge).
            // Anything within the search round the hearth, nearest to the hunter first. The nearest had also had to be
            // within 35 m of the hunter himself, so deer 40 m out went unseen from the far side of the village.
            float search = Village.Knowledge.WorkRadius(villageId, SearchFromHearth);
            float bestDistance = float.MaxValue;
            foreach (Character character in Character.GetAllCharacters())
            {
                if (character == null || character.IsDead() || character.IsPlayer() || character is Villager || character.IsTamed() ||
                    Animals.IsVillageAnimal(character))
                {
                    continue;
                }

                string name = Utils.GetPrefabName(character.gameObject);
                if (!Game.Contains(name) || (LetGo.TryGetValue(character.GetZDOID(), out float until) && Time.time < until) || Utils.DistanceXZ(character.transform.position, hearth) > search ||
                    !Village.Knowledge.MayWork(villageId, hearth, character.transform.position, SearchFromHearth))
                {
                    continue;
                }

                float distance = Utils.DistanceXZ(character.transform.position, from);
                if (distance < bestDistance)
                {
                    best = character;
                    bestDistance = distance;
                }
            }

            return best;
        }

        /// <summary>Meat, hides, trophies and the like: anything a hunted animal drops that isn't a building material.</summary>
        private static bool IsGameDrop(ItemDrop item)
        {
            ItemDrop.ItemData.SharedData shared = item.m_itemData?.m_shared;
            if (shared == null)
            {
                return false;
            }

            return shared.m_food > 0f || shared.m_itemType == ItemDrop.ItemData.ItemType.Trophy ||
                   shared.m_itemType == ItemDrop.ItemData.ItemType.Material && !Materials.Tracked.Contains(Utils.GetPrefabName(item.gameObject)) ||
                   CookableName(Utils.GetPrefabName(item.gameObject));
        }

        private static bool CookableName(string name) => name.StartsWith("Raw") || name.EndsWith("Meat") || name == "NeckTail";

        /// <summary>Raw and cooked meat and fish in the village chest and its storage chests.</summary>
        private static int MeatInChests(VillageHearth hearth)
        {
            int count = 0;
            foreach (Container chest in Healing.Chests(hearth))
            {
                foreach (ItemDrop.ItemData item in chest.GetInventory().GetAllItems())
                {
                    string name = item.m_dropPrefab != null ? item.m_dropPrefab.name : "";
                    if (CookableName(name) || (item.m_shared.m_food > 0f && (name.Contains("Meat") || name.Contains("Fish") || name.StartsWith("NeckTail"))))
                    {
                        count += item.m_stack;
                    }
                }
            }

            return count;
        }
    }
}
