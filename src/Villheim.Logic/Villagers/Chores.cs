using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;
using Random = UnityEngine.Random;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Villager work, by day.
    ///
    /// One villager in each village is its builder (a villager with the builder trade if there is one). Whenever the
    /// site chest holds what the next piece needs, the builder builds. Everyone else, and the builder while the chest
    /// is short, gathers what the village still needs, easiest first:
    ///
    /// 1. material already lying on the ground,
    /// 2. loose sticks and stones to pick up,
    /// 3. half-finished work (felled logs, cracked rocks),
    /// 4. and only then something new (a standing tree or a whole rock).
    ///
    /// What they gather goes into the site chest, or into the village stock between buildings. When nothing is
    /// needed, nobody harvests.
    ///
    /// Villagers walk to a spot next to what they work on before they swing. A tree is cut from the village side, so
    /// it falls away from the houses. The damage goes straight to the target, so villagers never hurt players or
    /// buildings by accident.
    /// </summary>
    internal static class Chores
    {
        private enum Phase
        {
            Idle,
            Approach,
            Work,
            Pick,
            Collect,
            Deliver,
            Build,
        }

        private sealed class Profile
        {
            public string Activity;
            public string PartialActivity;
            public Skills.SkillType Tool;
            public Func<GameObject, bool> IsSource;
            public Func<GameObject, bool> IsPartial;
            public bool Pickaxe;
            public int MaxSwingsPerSource;
        }

        private sealed class Work
        {
            public Phase Phase;
            public Profile Profile;
            public bool CanHarvest;
            public readonly HashSet<string> Wanted = new HashSet<string>();
            public GameObject Target;
            public Vector3 TargetSeenAt;
            public Vector3 Stand;
            public Vector3 Contact;
            public Vector3 Spot;
            public float Timer;
            public float Deadline;
            public float Cooldown = Random.Range(3f, 10f);
            public float NextCheck;
            public int Swings;
            public readonly Dictionary<string, int> Carrying = new Dictionary<string, int>();
            public readonly HashSet<GameObject> Skip = new HashSet<GameObject>();
        }

        private const float SearchRadius = 30f;
        private const float MaxFromHearth = 55f;
        private const float WorkReach = 2.6f;
        private const float WorkReachAtSpot = 3.3f;
        private const float StandOff = 1.1f;
        private const float SwingInterval = 1.8f;
        private const float WorkRange = 8f;
        private const float BuildRange = 8f;
        private const float HammerInterval = 1.2f;
        private const float DeliverReach = 1.8f;

        private static readonly string[] OreWords = { "copper", "tin", "iron", "silver", "obsidian", "meteor", "flametal", "crystal", "ore" };

        private static readonly Profile Woodcutter = new Profile
        {
            Activity = "felling a tree",
            PartialActivity = "splitting logs",
            Tool = Skills.SkillType.Axes,
            IsSource = go => go.GetComponent<TreeBase>() != null,
            IsPartial = go => go.GetComponent<TreeLog>() != null || IsStump(go),
            Pickaxe = false,
            MaxSwingsPerSource = 40,
        };

        private static readonly Profile Miner = new Profile
        {
            Activity = "breaking rocks",
            PartialActivity = "breaking up a cracked rock",
            Tool = Skills.SkillType.Pickaxes,
            IsSource = IsRock,
            IsPartial = IsCrackedRock,
            Pickaxe = true,
            MaxSwingsPerSource = 12,
        };

        private static readonly ConditionalWeakTable<Villager, Work> States = new ConditionalWeakTable<Villager, Work>();
        private static readonly HashSet<GameObject> Claimed = new HashSet<GameObject>();
        private static readonly Dictionary<GameObject, float> Unreachable = new Dictionary<GameObject, float>();
        private static readonly Dictionary<int, (float Time, ZDOID Builder)> Builders = new Dictionary<int, (float, ZDOID)>();
        private static readonly List<Collider> ColliderBuffer = new List<Collider>();

        /// <summary>Returns true while a chore is driving the villager this update.</summary>
        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            if (!VillheimConfig.VillagersChopTrees.Value || EnvMan.IsNight() || villager.IsDead())
            {
                Stop(villager);
                return false;
            }

            Work work = States.GetOrCreateValue(villager);
            VillageNeeds needs = VillageNeeds.For(villager.VillageId);
            if (needs == null)
            {
                return false;
            }

            bool builder = IsVillageBuilder(villager);
            if (builder && needs.SiteActive && needs.CanBuildNow && work.Phase != Phase.Build)
            {
                // The chest has what the next piece needs: the builder drops what he is doing (keeping what he
                // carries for the chest) and builds.
                if (work.Carrying.Count > 0 && work.Phase != Phase.Deliver)
                {
                    BeginDeliver(villager, work);
                }
                else if (work.Phase != Phase.Deliver)
                {
                    ReleaseTarget(work);
                    work.Phase = Phase.Build;
                    work.Timer = 0f;
                    Walker.For(villager).Reset();
                }
            }

            switch (work.Phase)
            {
                case Phase.Idle:
                    work.Cooldown -= dt;
                    if (work.Cooldown > 0f)
                    {
                        return false;
                    }

                    work.Cooldown = Random.Range(4f, 10f);
                    StartJob(villager, work, needs, builder);
                    return work.Phase != Phase.Idle;

                case Phase.Approach:
                case Phase.Work:
                    return UpdateWork(villager, ai, work, dt);

                case Phase.Pick:
                    return UpdatePick(villager, ai, work, dt);

                case Phase.Collect:
                    return UpdateCollect(villager, ai, work, dt);

                case Phase.Deliver:
                    return UpdateDeliver(villager, ai, work, dt);

                case Phase.Build:
                    return UpdateBuild(villager, ai, work, dt);
            }

            return false;
        }

        public static string Describe(Villager villager)
        {
            if (!States.TryGetValue(villager, out Work work) || work.Phase == Phase.Idle)
            {
                return null;
            }

            Profile profile = work.Profile ?? Woodcutter;
            switch (work.Phase)
            {
                case Phase.Build:
                    return "building";
                case Phase.Deliver:
                    return "carrying materials to the site";
                case Phase.Collect:
                case Phase.Pick:
                    return "gathering " + string.Join(" and ", Labels(work.Wanted));
                case Phase.Work:
                    return work.Target != null && profile.IsPartial(work.Target) ? profile.PartialActivity : profile.Activity;
                default:
                    return "heading out to work";
            }
        }

        private static IEnumerable<string> Labels(IEnumerable<string> materials)
        {
            foreach (string material in materials)
            {
                yield return Materials.Label(material);
            }
        }

        /// <summary>
        /// The village's builder: a loaded villager with the builder trade, otherwise the first villager. Worked out
        /// the same way on every client.
        /// </summary>
        public static bool IsVillageBuilder(Villager villager)
        {
            int id = villager.VillageId;
            if (Builders.TryGetValue(id, out var cached) && Time.time - cached.Time < 3f)
            {
                return cached.Builder == villager.GetZDOID();
            }

            Villager best = null;
            bool bestIsBuilder = false;
            int bestSeed = int.MaxValue;
            foreach (Character character in Character.GetAllCharacters())
            {
                if (!(character is Villager other) || other.IsDead() || other.VillageId != id || other.Zdo == null)
                {
                    continue;
                }

                int seed = other.Zdo.GetInt(Keys.VillagerSeed);
                bool isBuilder = VillagerLooks.IsBuilder(seed);
                if (best == null || (isBuilder && !bestIsBuilder) || (isBuilder == bestIsBuilder && seed < bestSeed))
                {
                    best = other;
                    bestIsBuilder = isBuilder;
                    bestSeed = seed;
                }
            }

            ZDOID builderId = best != null ? best.GetZDOID() : ZDOID.None;
            Builders[id] = (Time.time, builderId);
            return builderId == villager.GetZDOID();
        }

        /// <summary>Easiest work first: drops, then loose pickables, then half-finished work, then something new.</summary>
        private static void StartJob(Villager villager, Work work, VillageNeeds needs, bool builder)
        {
            if (needs.Missing.Count == 0)
            {
                return;
            }

            int seed = villager.Zdo.GetInt(Keys.VillagerSeed);
            bool needsWood = false;
            foreach (string material in needs.Missing.Keys)
            {
                needsWood |= Materials.WoodTypes.Contains(material);
            }

            bool needsStone = needs.Wants(Materials.Stone);

            // Miners go for stone and woodcutters for wood when the village needs it; otherwise they help with the
            // other material, picking up what they can without the right tool.
            Profile profile;
            if (VillagerLooks.IsMiner(seed))
            {
                profile = needsStone ? Miner : Woodcutter;
            }
            else
            {
                profile = needsWood ? Woodcutter : Miner;
            }

            work.Profile = profile;
            work.CanHarvest = builder || HasTool(villager, profile.Tool);
            work.Wanted.Clear();
            foreach (string material in needs.Missing.Keys)
            {
                bool woodMaterial = Materials.WoodTypes.Contains(material);
                if (woodMaterial == (profile == Woodcutter))
                {
                    work.Wanted.Add(material);
                }
            }

            if (work.Wanted.Count == 0)
            {
                return;
            }

            Vector3 position = villager.transform.position;
            Vector3 hearth = villager.Zdo.GetVec3(Keys.VillagerHearth, position);
            work.Skip.Clear();
            work.Swings = 0;
            work.Spot = position;

            ItemDrop drop = NearestDrop(work.Wanted, position, SearchRadius, hearth, work.Skip);
            if (drop != null)
            {
                Begin(villager, work, Phase.Collect, null, drop.transform.position, 45f);
                return;
            }

            Pickable pickable = NearestPickable(work.Wanted, position, SearchRadius, hearth);
            if (pickable != null)
            {
                Claimed.Add(pickable.gameObject);
                Begin(villager, work, Phase.Pick, pickable.gameObject, pickable.transform.position, 30f);
                return;
            }

            if (!work.CanHarvest)
            {
                return;
            }

            HashSet<string> wanted = work.Wanted;
            GameObject partial = FindNearest(position, SearchRadius, hearth,
                go => profile.IsPartial(go) && Yields.GivesAny(go, wanted), null);
            GameObject target = partial != null
                ? partial
                : FindNearest(position, SearchRadius, hearth, go => profile.IsSource(go) && Yields.GivesAny(go, wanted), null);
            if (target != null)
            {
                Claimed.Add(target);
                Begin(villager, work, Phase.Approach, target, target.transform.position, 90f);
            }
        }

        private static void Begin(Villager villager, Work work, Phase phase, GameObject target, Vector3 spot, float seconds)
        {
            work.Phase = phase;
            work.Target = target;
            work.Spot = spot;
            work.Deadline = Time.time + seconds;
            work.Timer = 0.6f;
            work.TargetSeenAt = new Vector3(float.MaxValue, 0f, 0f);
            Walker.For(villager).Reset();
        }

        private static bool UpdateWork(Villager villager, VillagerAI ai, Work work, float dt)
        {
            Profile profile = work.Profile;
            if (Time.time > work.Deadline || work.Swings >= profile.MaxSwingsPerSource)
            {
                BeginCollect(villager, work);
                return true;
            }

            if (work.Target == null)
            {
                // The tree fell or a log split. Keep working what lies around the spot, then collect.
                HashSet<string> wanted = work.Wanted;
                GameObject next = FindNearest(work.Spot, WorkRange, null,
                    go => profile.IsPartial(go) && Yields.GivesAny(go, wanted), work.Skip);
                if (next == null)
                {
                    BeginCollect(villager, work);
                    return true;
                }

                Claimed.Add(next);
                work.Target = next;
                work.Swings = 0;
                work.TargetSeenAt = new Vector3(float.MaxValue, 0f, 0f);
                Walker.For(villager).Reset();
            }

            // Work out where to stand once per target, again only if it moves (logs roll).
            if (Vector3.Distance(work.Target.transform.position, work.TargetSeenAt) > 0.5f)
            {
                work.TargetSeenAt = work.Target.transform.position;
                Vector3 hearth = villager.Zdo.GetVec3(Keys.VillagerHearth, villager.transform.position);
                work.Stand = StandSpot(work.Target, villager.transform.position, hearth, out work.Contact);
            }

            Walker walker = Walker.For(villager);
            bool close = InReach(villager, work.Contact, walker.IsArrived);
            if (!close)
            {
                work.Phase = Phase.Approach;
                WalkResult step = walker.Go(villager, ai, dt, work.Stand, 0.6f);
                if (step != WalkResult.Stuck && !(step == WalkResult.Arrived && !InReach(villager, work.Contact, true)))
                {
                    return true;
                }

                // Cannot get next to it. Never hit from a distance: set it aside and look for other work.
                VillheimPlugin.Debug($"{villager.VillagerName} could not get next to {Utils.GetPrefabName(work.Target)}.");
                MarkUnreachable(work.Target);
                work.Skip.Add(work.Target);
                ReleaseTarget(work);
                BeginCollect(villager, work);
                return true;
            }

            work.Phase = Phase.Work;
            ai.StopMoving();
            Face(villager, ai, work.Contact);
            work.Timer -= dt;
            if (work.Timer <= 0f)
            {
                work.Timer = SwingInterval;
                work.Swings++;
                work.Contact = ContactPoint(work.Target, villager.transform.position);
                Hit(villager, work.Target, work.Contact, profile.Pickaxe);
            }

            return true;
        }

        private static bool UpdatePick(Villager villager, VillagerAI ai, Work work, float dt)
        {
            if (Time.time > work.Deadline || work.Target == null)
            {
                BeginCollect(villager, work);
                return true;
            }

            WalkResult step = Walker.For(villager).Go(villager, ai, dt, work.Target.transform.position, 1.2f);
            if (step == WalkResult.Walking)
            {
                return true;
            }

            if (step == WalkResult.Stuck && Utils.DistanceXZ(villager.transform.position, work.Target.transform.position) > 2.5f)
            {
                MarkUnreachable(work.Target);
                ReleaseTarget(work);
                BeginCollect(villager, work);
                return true;
            }

            ai.StopMoving();
            Face(villager, ai, work.Target.transform.position);
            if (work.Target.TryGetComponent(out Pickable pickable))
            {
                pickable.Interact(villager, false, false);
            }

            ReleaseTarget(work);
            BeginCollect(villager, work);
            work.Deadline = Time.time + 15f;
            return true;
        }

        private static void BeginCollect(Villager villager, Work work)
        {
            ReleaseTarget(work);
            work.Phase = Phase.Collect;
            work.Deadline = Time.time + 45f;
            work.NextCheck = 0f;
            Walker.For(villager).Reset();
        }

        private static bool UpdateCollect(Villager villager, VillagerAI ai, Work work, float dt)
        {
            if (Time.time > work.Deadline)
            {
                BeginDeliver(villager, work);
                return true;
            }

            // Pick a drop to walk to a couple of times a second, not every frame.
            if (Time.time >= work.NextCheck || work.Target == null)
            {
                work.NextCheck = Time.time + 0.5f;
                ItemDrop drop = NearestDrop(Materials.Tracked, work.Spot, WorkRange, null, work.Skip);
                if (drop == null)
                {
                    BeginDeliver(villager, work);
                    return true;
                }

                if (work.Target != drop.gameObject)
                {
                    work.Target = drop.gameObject;
                    Walker.For(villager).Reset();
                }
            }

            if (work.Target == null)
            {
                return true;
            }

            Vector3 at = work.Target.transform.position;
            float distance = Utils.DistanceXZ(villager.transform.position, at);
            WalkResult step = distance < 2f ? WalkResult.Arrived : Walker.For(villager).Go(villager, ai, dt, at, 1.4f);
            if (step == WalkResult.Walking)
            {
                return true;
            }

            if (step == WalkResult.Stuck && distance > 3.5f)
            {
                // Wedged somewhere unreachable (under a log, on a ledge). Leave it.
                work.Skip.Add(work.Target);
                work.Target = null;
                return true;
            }

            ai.StopMoving();
            Face(villager, ai, at);
            PickUpAround(work, villager.transform.position, 3f);
            work.Target = null;
            work.NextCheck = 0f;
            return true;
        }

        private static void PickUpAround(Work work, Vector3 center, float radius)
        {
            foreach (Collider collider in Physics.OverlapSphere(center, radius))
            {
                ItemDrop item = collider.GetComponentInParent<ItemDrop>();
                if (item == null || !Materials.Tracked.Contains(Utils.GetPrefabName(item.gameObject)))
                {
                    continue;
                }

                ZNetView view = item.GetComponent<ZNetView>();
                if (view == null || !view.IsValid())
                {
                    continue;
                }

                string material = Utils.GetPrefabName(item.gameObject);
                work.Carrying.TryGetValue(material, out int amount);
                work.Carrying[material] = amount + item.m_itemData.m_stack;
                view.ClaimOwnership();
                ZNetScene.instance.Destroy(item.gameObject);
            }
        }

        private static void BeginDeliver(Villager villager, Work work)
        {
            ReleaseTarget(work);
            if (work.Carrying.Count == 0)
            {
                Finish(work);
                return;
            }

            work.Phase = Phase.Deliver;
            work.Deadline = Time.time + 90f;
            Walker.For(villager).Reset();
        }

        /// <summary>Carries what was gathered to the site chest, or to the hearth between buildings.</summary>
        private static bool UpdateDeliver(Villager villager, VillagerAI ai, Work work, float dt)
        {
            VillageNeeds needs = VillageNeeds.For(villager.VillageId);
            if (needs == null)
            {
                Finish(work);
                return false;
            }

            Vector3 target = needs.DropOff;
            float distance = Utils.DistanceXZ(villager.transform.position, target);
            WalkResult step = Time.time > work.Deadline ? WalkResult.Stuck : Walker.For(villager).Go(villager, ai, dt, target, DeliverReach);
            if (step == WalkResult.Walking)
            {
                return true;
            }

            // Stuck far from the chest: the materials still count, as if handed along.
            ai.StopMoving();
            if (distance < 4f)
            {
                Face(villager, ai, target);
            }

            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            Container chest = hearth != null && needs.ToChest ? SiteChest.Find(hearth) : null;
            foreach (KeyValuePair<string, int> carried in work.Carrying)
            {
                int left = carried.Value;
                if (chest != null && distance < 4f)
                {
                    left -= SiteChest.Add(chest, carried.Key, left);
                }

                if (left > 0)
                {
                    VillageBrain.AddMaterial(villager.VillageId, carried.Key, left);
                }

                VillheimPlugin.Debug($"{villager.VillagerName} brought {carried.Value} {Materials.Label(carried.Key)} " +
                                     $"to {(chest != null && distance < 4f ? "the site chest" : villager.VillageName)}.");
            }

            work.Carrying.Clear();
            VillageNeeds.Forget(villager.VillageId);
            Finish(work);
            return false;
        }

        /// <summary>
        /// The builder works from a ring just outside the building, hammering at each piece for a moment before it
        /// goes up. When the chest runs short he goes back to gathering.
        /// </summary>
        private static bool UpdateBuild(Villager villager, VillagerAI ai, Work work, float dt)
        {
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid || !ConstructionSite.IsActive(hearth.Zdo) ||
                !ConstructionSite.NextPiecePosition(hearth, out Vector3 piece))
            {
                Finish(work);
                return false;
            }

            Vector3 stand = ConstructionSite.StandSpot(hearth, piece);
            float toPiece = Utils.DistanceXZ(villager.transform.position, piece);
            WalkResult step = Walker.For(villager).Go(villager, ai, dt, stand, 1f);
            if (step == WalkResult.Walking && toPiece > BuildRange * 0.75f)
            {
                return true;
            }

            ai.StopMoving();
            Face(villager, ai, piece);
            work.Timer += dt;
            if (work.Timer % HammerInterval < dt)
            {
                SwingAnimation(villager);
            }

            float perPiece = LogicConfig.SecondsPerPiece != null ? LogicConfig.SecondsPerPiece.Value : 2.5f;
            if (work.Timer < perPiece)
            {
                return true;
            }

            work.Timer = 0f;
            if (ConstructionSite.PlaceNext(hearth, true))
            {
                ConstructionSite.NoteBuilder(villager.VillageId);
                VillageNeeds.Forget(villager.VillageId);
                return true;
            }

            // Out of materials (or done). Back to gathering until the chest fills up again.
            VillageNeeds.Forget(villager.VillageId);
            Finish(work);
            work.Cooldown = 1f;
            return false;
        }

        private static void SwingAnimation(Villager villager)
        {
            ItemDrop.ItemData weapon = villager.GetCurrentWeapon();
            if (weapon?.m_shared?.m_attack != null && villager.m_zanim != null)
            {
                string animation = weapon.m_shared.m_attack.m_attackAnimation;
                if (!string.IsNullOrEmpty(animation))
                {
                    villager.m_zanim.SetTrigger(weapon.m_shared.m_attack.m_attackChainLevels > 1 ? animation + "0" : animation);
                }
            }
        }

        private static void Hit(Villager villager, GameObject target, Vector3 point, bool pickaxe)
        {
            SwingAnimation(villager);
            IDestructible destructible = target.GetComponentInParent<IDestructible>() ?? target.GetComponentInChildren<IDestructible>();
            if (destructible == null)
            {
                return;
            }

            ItemDrop.ItemData weapon = villager.GetCurrentWeapon();
            Vector3 direction = point - villager.transform.position;
            direction.y = 0f;
            var hit = new HitData
            {
                m_point = point,
                m_dir = direction.sqrMagnitude > 0.01f ? direction.normalized : villager.transform.forward,
                m_toolTier = 4,
                m_attacker = villager.GetZDOID(),
            };

            if (pickaxe)
            {
                hit.m_damage.m_pickaxe = Mathf.Max(weapon?.m_shared?.m_damages.m_pickaxe ?? 0f, 20f);
            }
            else
            {
                hit.m_damage.m_chop = Mathf.Max(weapon?.m_shared?.m_damages.m_chop ?? 0f, 15f);
            }

            destructible.Damage(hit);
        }

        /// <summary>
        /// Where to stand to work on something. A standing tree is cut from the side facing the village, so it falls
        /// away from the houses. Logs, stumps and rocks are worked from the side the villager comes from, a step back
        /// from their surface.
        /// </summary>
        private static Vector3 StandSpot(GameObject target, Vector3 from, Vector3 hearth, out Vector3 contact)
        {
            Vector3 center = target.transform.position;
            Vector3 stand;
            if (target.GetComponent<TreeBase>() != null)
            {
                float radius = TrunkRadius(target);
                Vector3 toVillage = hearth - center;
                toVillage.y = 0f;
                if (toVillage.sqrMagnitude < 0.01f)
                {
                    toVillage = from - center;
                    toVillage.y = 0f;
                }

                stand = center + toVillage.normalized * (radius + StandOff);
                if (!Walkable(stand, center.y))
                {
                    Vector3 toMe = from - center;
                    toMe.y = 0f;
                    stand = center + toMe.normalized * (radius + StandOff);
                }

                contact = center + Vector3.up * 1f;
            }
            else
            {
                contact = ContactPoint(target, from);
                Vector3 away = from - contact;
                away.y = 0f;
                if (away.sqrMagnitude < 0.01f)
                {
                    away = from - center;
                    away.y = 0f;
                }

                stand = contact + away.normalized * StandOff;
            }

            if (ZoneSystem.instance.GetGroundHeight(stand, out float y))
            {
                stand.y = y;
            }

            return stand;
        }

        private static bool Walkable(Vector3 spot, float referenceHeight)
        {
            return ZoneSystem.instance.GetGroundHeight(spot, out float y) &&
                   y > ZoneSystem.instance.m_waterLevel - 0.3f && Mathf.Abs(y - referenceHeight) < 1.5f;
        }

        /// <summary>Half the narrowest width of the tree's lowest solid collider.</summary>
        private static float TrunkRadius(GameObject tree)
        {
            float radius = 0.4f;
            float lowest = float.MaxValue;
            ColliderBuffer.Clear();
            tree.GetComponentsInChildren(false, ColliderBuffer);
            foreach (Collider collider in ColliderBuffer)
            {
                if (collider == null || collider.isTrigger || !collider.enabled)
                {
                    continue;
                }

                Bounds bounds = collider.bounds;
                if (bounds.min.y < lowest)
                {
                    lowest = bounds.min.y;
                    radius = Mathf.Min(bounds.extents.x, bounds.extents.z);
                }
            }

            return Mathf.Clamp(radius, 0.2f, 1.2f);
        }

        private static bool InReach(Villager villager, Vector3 contact, bool atSpot)
        {
            Vector3 chest = villager.transform.position + Vector3.up * 1f;
            return Vector3.Distance(chest, contact) <= (atSpot ? WorkReachAtSpot : WorkReach);
        }

        private static void ReleaseTarget(Work work)
        {
            if (work.Target != null)
            {
                Claimed.Remove(work.Target);
            }

            work.Target = null;
        }

        private static void Finish(Work work)
        {
            ReleaseTarget(work);
            work.Phase = Phase.Idle;
            work.Skip.Clear();
            Claimed.RemoveWhere(go => go == null);
            PruneUnreachable();
        }

        private static void Stop(Villager villager)
        {
            if (!States.TryGetValue(villager, out Work work) || work.Phase == Phase.Idle)
            {
                return;
            }

            // Whatever he carries still reaches the village.
            foreach (KeyValuePair<string, int> carried in work.Carrying)
            {
                VillageBrain.AddMaterial(villager.VillageId, carried.Key, carried.Value);
            }

            work.Carrying.Clear();
            Finish(work);
        }

        private static bool HasTool(Villager villager, Skills.SkillType skill)
        {
            ItemDrop.ItemData weapon = villager.GetCurrentWeapon();
            return weapon?.m_shared != null && weapon.m_shared.m_skillType == skill;
        }

        private static bool IsStump(GameObject go)
        {
            return go.GetComponent<Destructible>() != null && go.name.IndexOf("stub", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private static bool IsRock(GameObject go)
        {
            if (go.GetComponent<MineRock5>() == null && go.GetComponent<MineRock>() == null && go.GetComponent<Destructible>() == null)
            {
                return false;
            }

            string name = go.name.ToLowerInvariant();
            if (!name.Contains("rock") || go.GetComponent<Piece>() != null)
            {
                return false;
            }

            foreach (string ore in OreWords)
            {
                if (name.Contains(ore))
                {
                    return false;
                }
            }

            return true;
        }

        /// <summary>A big rock someone has already started on (a MineRock5 with damaged parts).</summary>
        private static bool IsCrackedRock(GameObject go)
        {
            if (!IsRock(go) || !go.TryGetComponent(out MineRock5 rock) || rock.m_hitAreas == null)
            {
                return false;
            }

            foreach (MineRock5.HitArea area in rock.m_hitAreas)
            {
                if (area != null && area.m_health < rock.m_health)
                {
                    return true;
                }
            }

            return false;
        }

        /// <summary>The point on the target's solid colliders closest to the villager. Logs are long, so their center is useless.</summary>
        private static Vector3 ContactPoint(GameObject target, Vector3 from)
        {
            Vector3 best = target.transform.position;
            float bestDistance = float.MaxValue;
            ColliderBuffer.Clear();
            target.GetComponentsInChildren(false, ColliderBuffer);
            Vector3 chest = from + Vector3.up;
            foreach (Collider collider in ColliderBuffer)
            {
                if (collider == null || collider.isTrigger || !collider.enabled)
                {
                    continue;
                }

                Vector3 point = collider.ClosestPoint(chest);
                float distance = (point - chest).sqrMagnitude;
                if (distance < bestDistance)
                {
                    best = point;
                    bestDistance = distance;
                }
            }

            return best;
        }

        /// <summary>Turns the villager to face a point right away, so swings land where they look.</summary>
        private static void Face(Villager villager, VillagerAI ai, Vector3 point)
        {
            Vector3 direction = point - villager.transform.position;
            direction.y = 0f;
            if (direction.sqrMagnitude < 0.01f)
            {
                return;
            }

            direction.Normalize();
            ai.LookAt(point);
            villager.SetLookDir(direction);
            villager.transform.rotation = Quaternion.LookRotation(direction);
        }

        private static void MarkUnreachable(GameObject target)
        {
            if (target != null)
            {
                Unreachable[target] = Time.time + 300f;
            }
        }

        private static void PruneUnreachable()
        {
            if (Unreachable.Count < 50)
            {
                return;
            }

            var stale = new List<GameObject>();
            foreach (KeyValuePair<GameObject, float> entry in Unreachable)
            {
                if (entry.Key == null || entry.Value < Time.time)
                {
                    stale.Add(entry.Key);
                }
            }

            foreach (GameObject key in stale)
            {
                Unreachable.Remove(key);
            }
        }

        private static bool Available(GameObject go, HashSet<GameObject> skip)
        {
            return !Claimed.Contains(go) && (skip == null || !skip.Contains(go)) &&
                   !(Unreachable.TryGetValue(go, out float until) && until > Time.time);
        }

        private static GameObject FindNearest(Vector3 from, float radius, Vector3? hearth, Func<GameObject, bool> match,
            HashSet<GameObject> skip)
        {
            GameObject best = null;
            float bestDistance = float.MaxValue;
            var seen = new HashSet<GameObject>();
            foreach (Collider collider in Physics.OverlapSphere(from, radius))
            {
                ZNetView view = collider.GetComponentInParent<ZNetView>();
                if (view == null || !seen.Add(view.gameObject))
                {
                    continue;
                }

                GameObject go = view.gameObject;
                if (!Available(go, skip) || !match(go))
                {
                    continue;
                }

                if (hearth.HasValue && Utils.DistanceXZ(go.transform.position, hearth.Value) > MaxFromHearth)
                {
                    continue;
                }

                float distance = Utils.DistanceXZ(go.transform.position, from);
                if (distance < bestDistance)
                {
                    best = go;
                    bestDistance = distance;
                }
            }

            return best;
        }

        private static Pickable NearestPickable(HashSet<string> wanted, Vector3 from, float radius, Vector3 hearth)
        {
            GameObject go = FindNearest(from, radius, hearth, candidate =>
                candidate.TryGetComponent(out Pickable pickable) && !pickable.GetPicked() && pickable.m_itemPrefab != null &&
                wanted.Contains(pickable.m_itemPrefab.name), null);
            return go != null ? go.GetComponent<Pickable>() : null;
        }

        private static ItemDrop NearestDrop(ICollection<string> wanted, Vector3 spot, float radius, Vector3? hearth,
            HashSet<GameObject> skip)
        {
            ItemDrop best = null;
            float bestDistance = float.MaxValue;
            foreach (Collider collider in Physics.OverlapSphere(spot, radius))
            {
                ItemDrop item = collider.GetComponentInParent<ItemDrop>();
                if (item == null || !wanted.Contains(Utils.GetPrefabName(item.gameObject)) || skip.Contains(item.gameObject))
                {
                    continue;
                }

                if (hearth.HasValue && Utils.DistanceXZ(item.transform.position, hearth.Value) > MaxFromHearth)
                {
                    continue;
                }

                float distance = Utils.DistanceXZ(item.transform.position, spot);
                if (distance < bestDistance)
                {
                    best = item;
                    bestDistance = distance;
                }
            }

            return best;
        }
    }
}
