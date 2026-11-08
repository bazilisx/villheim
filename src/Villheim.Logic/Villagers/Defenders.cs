using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using HarmonyLib;
using UnityEngine;
using Villheim.Logic.Village;
using Object = UnityEngine.Object;
using Random = UnityEngine.Random;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Biome defenders. Villages in or near a hard biome learn to fight its worst creatures, so one swarm does not
    /// wipe them out: Plains villages shoot deathsquitos out of the sky, Mistlands villages stand up to seekers, ticks
    /// and gjall. Each biome has a profile (settings in "5d - Biome defenders"): the biomes that always count, how close
    /// that biome's ground must be to count as near, the creatures it covers, a damage multiplier, and aim spread and
    /// reaction time for arrows. Fights with any other creature are left exactly as they were.
    ///
    /// How the game fights, and what is changed (studied from MonsterAI, BaseAI, Humanoid and Attack):
    /// - MonsterAI.UpdateTarget calls BaseAI.FindEnemy every 2 seconds near a player (6 far): the closest enemy it can
    ///   sense, of any kind. Here a covered creature is picked first, every half second, wherever it is in range, and
    ///   Brain starts the fight at the first sighting of one (other enemies need two sightings or to be close).
    /// - MonsterAI.SelectBestAttack asks Humanoid.EquipBestWeapon once a second for a weapon whose ai range and
    ///   interval fit, and DoAttack starts it when IsLookingAt the target within the weapon's ai angle. Player bows
    ///   draw: a monster never draws (m_attackDrawTime stays 0), so a player bow fired by the AI flies at its slowest and
    ///   widest, and Attack aims a monster's arrow at the target's centre as it is now, which misses anything that
    ///   moves as fast as a deathsquito.
    /// - So this class runs the bow itself. While a covered flying creature is in range it runs the villager (a prefix on
    ///   VillagerAI.UpdateAI, which also works while the game's AI has him alerted): stand, face the shot, and after
    ///   the reaction time loose an arrow every DefenderShotSeconds. The arrow is made as Attack.FireProjectileBurst
    ///   makes one at full draw: the ammo's projectile, HitData from the bow and arrow damage, IProjectile.Setup with
    ///   the bow's full speed. It is aimed where the target will be when the arrow arrives (its speed from the last
    ///   half second, allowing for the arrow's drop), then turned by up to the profile's spread.
    /// - Damage: a prefix on Character.Damage multiplies any blow or arrow a villager lands on a covered creature.
    /// - The bow goes back in his pack once the flyers are gone (he carries it, with arrows, D-050), and a protector
    ///   takes up his weapon and shield again.
    /// </summary>
    internal static class Defenders
    {
        internal sealed class Profile
        {
            public string Name;
            public Heightmap.Biome Biome;
            public Func<bool> On;
            public Func<string> Biomes;
            public Func<float> Reach;
            public Func<string> Targets;
            public Func<float> Damage;
            public Func<float> Spread;
            public Func<float> Reaction;

            private string _targetsText;
            private HashSet<string> _targets = new HashSet<string>();

            public HashSet<string> TargetSet()
            {
                string text = Targets() ?? "";
                if (text != _targetsText)
                {
                    _targetsText = text;
                    _targets = new HashSet<string>(text.Split(',').Select(t => t.Trim()).Where(t => t.Length > 0),
                        StringComparer.OrdinalIgnoreCase);
                }

                return _targets;
            }
        }

        private static readonly Profile[] Profiles =
        {
            new Profile
            {
                Name = "Plains", Biome = Heightmap.Biome.Plains,
                On = () => LogicConfig.IsOn(LogicConfig.PlainsDefenders),
                Biomes = () => LogicConfig.PlainsDefenderBiomes?.Value ?? "Plains",
                Reach = () => LogicConfig.PlainsDefenderReach?.Value ?? 400f,
                Targets = () => LogicConfig.PlainsDefenderTargets?.Value ?? "Deathsquito",
                Damage = () => LogicConfig.PlainsDefenderDamage?.Value ?? 2f,
                Spread = () => LogicConfig.PlainsDefenderSpread?.Value ?? 1.5f,
                Reaction = () => LogicConfig.PlainsDefenderReaction?.Value ?? 0.4f,
            },
            new Profile
            {
                Name = "Mistlands", Biome = Heightmap.Biome.Mistlands,
                On = () => LogicConfig.IsOn(LogicConfig.MistlandsDefenders),
                Biomes = () => LogicConfig.MistlandsDefenderBiomes?.Value ?? "Mistlands",
                Reach = () => LogicConfig.MistlandsDefenderReach?.Value ?? 300f,
                Targets = () => LogicConfig.MistlandsDefenderTargets?.Value ?? "Seeker,SeekerBrute,SeekerBrood,Tick,Gjall",
                Damage = () => LogicConfig.MistlandsDefenderDamage?.Value ?? 3f,
                Spread = () => LogicConfig.MistlandsDefenderSpread?.Value ?? 2f,
                Reaction = () => LogicConfig.MistlandsDefenderReaction?.Value ?? 0.4f,
            },
        };

        // Bow and arrows by the village's gear tier (0 rags .. 4 bronze).
        private static readonly string[] Bows = { "Bow", "Bow", "Bow", "BowFineWood", "BowFineWood" };
        private static readonly string[] Arrows = { "ArrowWood", "ArrowFlint", "ArrowFlint", "ArrowBronze", "ArrowBronze" };

        private sealed class State
        {
            public Character Target;
            public float SeenAt;
            public float NextScan;
            public float NextShot;
            public float NextSteer;
            public Vector3 LastPos;
            public float LastPosAt;
            public Vector3 Velocity;
            public bool Engaged;
            public float LastShotAt = -100f;
        }

        private sealed class Tally
        {
            public int Shots;
            public int Downed;
            public float Last;
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();
        private static readonly Dictionary<int, (Profile Profile, float At)> VillageProfiles = new Dictionary<int, (Profile, float)>();
        private static readonly Dictionary<int, Tally> Tallies = new Dictionary<int, Tally>();
        private static readonly Dictionary<int, float> LastShout = new Dictionary<int, float>();

        private static bool On => LogicConfig.IsOn(LogicConfig.BiomeDefenders);

        // ---------------------------------------------------------------- which profile

        /// <summary>The profile a village fights by (null for none), worked out at most once a minute.</summary>
        public static Profile For(int villageId)
        {
            if (!On || villageId == 0)
            {
                return null;
            }

            if (VillageProfiles.TryGetValue(villageId, out (Profile Profile, float At) cached) && Time.time - cached.At < 60f)
            {
                return cached.Profile != null && cached.Profile.On() ? cached.Profile : null;
            }

            Profile found = null;
            VillageHearth hearth = VillageHearth.Find(villageId);
            if (hearth != null && hearth.IsValid)
            {
                var state = new VillageState(hearth.Zdo);
                Vector3 center = hearth.transform.position;
                found = Profiles.FirstOrDefault(p => p.On() && InList(p.Biomes(), state.Biome)) ??
                        Profiles.FirstOrDefault(p => p.On() && Near(center, p.Biome, p.Reach()));
            }

            VillageProfiles[villageId] = (found, Time.time);
            return found;
        }

        private static bool InList(string list, Heightmap.Biome biome) =>
            (list ?? "").Split(',').Any(b => Cultures.TryBiome(b, out Heightmap.Biome named) && named == biome);

        /// <summary>True when ground of this biome lies within reach of the point (sampled on three rings).</summary>
        private static bool Near(Vector3 center, Heightmap.Biome biome, float reach)
        {
            if (reach <= 0f || WorldGenerator.instance == null)
            {
                return false;
            }

            foreach (float fraction in new[] { 0.33f, 0.66f, 1f })
            {
                for (int i = 0; i < 16; i++)
                {
                    float angle = i * Mathf.PI / 8f;
                    Vector3 point = center + new Vector3(Mathf.Sin(angle), 0f, Mathf.Cos(angle)) * reach * fraction;
                    if (WorldGenerator.instance.GetBiome(point) == biome)
                    {
                        return true;
                    }
                }
            }

            return false;
        }

        private static string PrefabName(Character c) => c != null ? Utils.GetPrefabName(c.gameObject) : "";

        /// <summary>A creature this villager's village profile covers.</summary>
        public static bool IsTarget(Villager villager, Character creature)
        {
            Profile profile = villager != null ? For(villager.VillageId) : null;
            return profile != null && creature != null && profile.TargetSet().Contains(PrefabName(creature));
        }

        private static bool Flies(Character c) => c.IsFlying() || c.m_flying;

        // ---------------------------------------------------------------- the takeover

        /// <summary>
        /// Every AI tick of a villager on the owning machine. Returns true while he is shooting at a covered flying
        /// creature (the game's AI and the villager's own routine are skipped for that tick).
        /// </summary>
        public static bool Update(VillagerAI ai, float dt)
        {
            if (!On || ai == null || ai.m_nview == null || !ai.m_nview.IsValid() || !ai.m_nview.IsOwner() ||
                !(ai.m_character is Villager villager) || villager.IsDead() || villager.Zdo == null ||
                Wanderers.IsWanderer(villager) || Childhood.IsChild(villager))
            {
                return false;
            }

            Profile profile = For(villager.VillageId);
            State state = States.GetOrCreateValue(villager);
            if (profile == null)
            {
                return Release(villager, state);
            }

            if (Time.time >= state.NextScan)
            {
                state.NextScan = Time.time + 0.25f;
                Character seen = FindTarget(villager, profile, state.Target, flying: true);
                if (seen != state.Target)
                {
                    state.Target = seen;
                    state.SeenAt = Time.time;
                    state.LastPosAt = 0f;
                    state.Velocity = Vector3.zero;
                }
            }

            if (state.Target != null && (!state.Target || state.Target.IsDead()))
            {
                if (Time.time - state.LastShotAt < 3f)
                {
                    TallyFor(villager.VillageId).Downed++;
                }

                state.Target = null;
            }

            bool mayShoot = Roles.BackgroundOf(villager) == Roles.Background.Protector || LogicConfig.IsOn(LogicConfig.DefenderCarers);
            if (state.Target == null || !mayShoot)
            {
                Steer(villager, ai, profile, state);
                return Release(villager, state);
            }

            if (!state.Engaged && !Engage(villager, state))
            {
                return false;
            }

            Track(state);
            ai.StopMoving();
            villager.SetWalk(false);

            ItemDrop.ItemData bow = HeldBow(villager);
            if (bow == null)
            {
                bow = EquipBow(villager);
                if (bow == null)
                {
                    return Release(villager, state);
                }
            }

            ItemDrop.ItemData ammo = Ammo(villager);
            Vector3 spawn = villager.transform.position + Vector3.up * 1.5f + villager.transform.forward * 0.6f;
            float speed = bow.m_shared.m_attack.m_projectileVel > 1f ? bow.m_shared.m_attack.m_projectileVel : 50f;
            GameObject projectile = ProjectilePrefab(bow, ammo);
            float gravity = projectile != null && projectile.GetComponent<Projectile>() is Projectile p ? p.m_gravity : 0f;
            Vector3 aim = AimPoint(state, spawn, speed, gravity);
            ai.LookAt(aim);

            Vector3 flat = (aim - villager.transform.position).Horizontal();
            bool facing = flat.sqrMagnitude < 0.01f || Vector3.Angle(villager.transform.forward.Horizontal(), flat) < 30f;
            if (facing && Time.time >= state.NextShot && Time.time - state.SeenAt >= profile.Reaction() && projectile != null)
            {
                state.NextShot = Time.time + Mathf.Max(0.3f, LogicConfig.DefenderShotSeconds?.Value ?? 1.2f) * Random.Range(0.9f, 1.15f);
                state.LastShotAt = Time.time;
                Fire(villager, bow, ammo, projectile, spawn, aim, speed, profile.Spread());
            }

            Status.Set(villager, Status.Doer.Fight);
            Combat.NoteShooting(villager, state.Target);
            return true;
        }

        /// <summary>
        /// One arrow at <paramref name="target"/> if the villager faces it (a hunter, or a responder at range): the bow of
        /// his village's tier comes out if it isn't in hand. <paramref name="velocity"/> is the target's speed, for the
        /// lead. True when an arrow was loosed.
        /// </summary>
        public static bool ShootAt(Villager villager, VillagerAI ai, Character target, Vector3 velocity, float spread)
        {
            ItemDrop.ItemData bow = HeldBow(villager) ?? EquipBow(villager);
            if (bow == null || target == null)
            {
                return false;
            }

            ItemDrop.ItemData ammo = Ammo(villager);
            Vector3 spawn = villager.transform.position + Vector3.up * 1.5f + villager.transform.forward * 0.6f;
            float speed = bow.m_shared.m_attack.m_projectileVel > 1f ? bow.m_shared.m_attack.m_projectileVel : 50f;
            GameObject projectile = ProjectilePrefab(bow, ammo);
            float gravity = projectile != null && projectile.GetComponent<Projectile>() is Projectile p ? p.m_gravity : 0f;
            float lead = Mathf.Clamp01(LogicConfig.DefenderLead?.Value ?? 1f);
            Vector3 point = target.GetCenterPoint();
            float time = 0f;
            for (int i = 0; i < 3; i++)
            {
                time = Vector3.Distance(spawn, point) / speed;
                point = target.GetCenterPoint() + velocity * (time * lead);
            }

            Vector3 aim = point + Vector3.up * (0.5f * gravity * time * time);
            ai.LookAt(aim);
            Vector3 flat = (aim - villager.transform.position).Horizontal();
            if (flat.sqrMagnitude > 0.01f)
            {
                villager.SetLookDir(flat.normalized);
            }

            bool facing = flat.sqrMagnitude < 0.01f || Vector3.Angle(villager.transform.forward.Horizontal(), flat) < 30f;
            if (!facing || projectile == null)
            {
                return false;
            }

            Fire(villager, bow, ammo, projectile, spawn, aim, speed, spread);
            return true;
        }

        /// <summary>
        /// The bow goes out of his hands. He keeps carrying it, with his arrows, alongside his weapon (D-050): the
        /// game's own AI no longer fights for villagers (Combat), so it never picks the bow for a fight by itself.
        /// </summary>
        public static void PutBowAway(Villager villager)
        {
            ItemDrop.ItemData held = HeldBow(villager);
            if (held != null)
            {
                villager.UnequipItem(held, false);
            }
        }

        /// <summary>A bow and arrows of his village's tier in his pack, for anyone who fights or hunts (D-050).</summary>
        public static void CarryBow(Villager villager)
        {
            int tier = Mathf.Clamp(Roles.GearTier(villager), 0, Bows.Length - 1);
            Carry(villager, Bows[tier], 1);
            Carry(villager, Arrows[tier], 20);
        }

        private static void Carry(Villager villager, string prefabName, int amount)
        {
            GameObject prefab = ObjectDB.instance ? ObjectDB.instance.GetItemPrefab(prefabName) : null;
            string shared = prefab != null ? prefab.GetComponent<ItemDrop>()?.m_itemData?.m_shared?.m_name : null;
            Inventory inventory = villager.GetInventory();
            if (shared == null || inventory == null || inventory.HaveItem(shared))
            {
                return;
            }

            villager.PickupPrefab(prefab, amount, false);
        }

        /// <summary>Whether the villager's village has a bow to give him (any tier: a plain bow at worst).</summary>
        public static bool HasBow(Villager villager) => ObjectDB.instance != null && ObjectDB.instance.GetItemPrefab("Bow") != null;

        /// <summary>
        /// Outside the bow fight: when the villager is already fighting and a covered creature is in range, it
        /// becomes his target ahead of whatever the game's AI picked (the closest enemy of any kind).
        /// </summary>
        private static void Steer(Villager villager, VillagerAI ai, Profile profile, State state)
        {
            if (Time.time < state.NextSteer || (!ai.IsAlerted() && ai.GetTargetCreature() == null))
            {
                return;
            }

            state.NextSteer = Time.time + 0.5f;
            Character current = ai.GetTargetCreature();
            if (current != null && profile.TargetSet().Contains(PrefabName(current)))
            {
                return;
            }

            Character covered = FindTarget(villager, profile, null, flying: false);
            if (covered != null)
            {
                ai.SetTarget(covered);
            }
        }

        private static Character FindTarget(Villager villager, Profile profile, Character current, bool flying)
        {
            float range = LogicConfig.DefenderRange?.Value ?? 35f;
            HashSet<string> kinds = profile.TargetSet();
            Vector3 eye = villager.GetEyePoint();
            Character best = null;
            float bestDistance = float.MaxValue;
            foreach (Character c in Character.GetAllCharacters())
            {
                if (c == null || c.IsDead() || c == villager || (flying && !Flies(c)) || !kinds.Contains(PrefabName(c)) ||
                    !BaseAI.IsEnemy(villager, c))
                {
                    continue;
                }

                float distance = Vector3.Distance(c.transform.position, villager.transform.position);
                // The one he is already on keeps him unless another is much closer.
                float score = c == current ? distance * 0.6f : distance;
                if (distance > range || score >= bestDistance || !InSight(eye, c))
                {
                    continue;
                }

                best = c;
                bestDistance = score;
            }

            return best;
        }

        private static int _sightMask;

        private static bool InSight(Vector3 eye, Character target)
        {
            if (_sightMask == 0)
            {
                _sightMask = LayerMask.GetMask("Default", "static_solid", "Default_small", "piece", "terrain", "vehicle");
            }

            return !Physics.Linecast(eye, target.GetCenterPoint(), _sightMask);
        }

        private static bool Engage(Villager villager, State state)
        {
            if (EquipBow(villager) == null)
            {
                return false;
            }

            state.Engaged = true;
            state.NextShot = Time.time;
            Sleep.Wake(villager);
            Seats.StandUp(villager);
            Poses.Release(villager);
            Shout(villager);
            return true;
        }

        /// <summary>The bow comes out of the inventory, and a protector takes his weapon and shield back.</summary>
        private static bool Release(Villager villager, State state)
        {
            if (!state.Engaged)
            {
                return false;
            }

            state.Engaged = false;
            state.Target = null;
            PutBowAway(villager);

            if (Roles.BackgroundOf(villager) == Roles.Background.Protector)
            {
                Roles.Rearm(villager);
            }

            return false;
        }

        private static ItemDrop.ItemData HeldBow(Villager villager)
        {
            ItemDrop.ItemData left = villager.GetLeftItem();
            if (left != null && left.m_shared.m_itemType == ItemDrop.ItemData.ItemType.Bow)
            {
                return left;
            }

            ItemDrop.ItemData right = villager.GetRightItem();
            return right != null && right.m_shared.m_itemType == ItemDrop.ItemData.ItemType.Bow ? right : null;
        }

        private static ItemDrop.ItemData EquipBow(Villager villager)
        {
            string name = Bows[Mathf.Clamp(Roles.GearTier(villager), 0, Bows.Length - 1)];
            GameObject prefab = ObjectDB.instance ? ObjectDB.instance.GetItemPrefab(name) ?? ObjectDB.instance.GetItemPrefab("Bow") : null;
            if (prefab == null)
            {
                return null;
            }

            string shared = prefab.GetComponent<ItemDrop>()?.m_itemData?.m_shared?.m_name;
            ItemDrop.ItemData bow = shared != null ? villager.GetInventory().GetItem(shared) : null;
            bow = bow ?? villager.PickupPrefab(prefab, 0, false);
            if (bow == null)
            {
                return null;
            }

            Carry(villager, Arrows[Mathf.Clamp(Roles.GearTier(villager), 0, Arrows.Length - 1)], 20);
            villager.EquipItem(bow, false);
            return bow;
        }

        /// <summary>The tier's arrow, read from its prefab (arrows are not carried or used up).</summary>
        private static ItemDrop.ItemData Ammo(Villager villager)
        {
            string name = Arrows[Mathf.Clamp(Roles.GearTier(villager), 0, Arrows.Length - 1)];
            GameObject prefab = ObjectDB.instance ? ObjectDB.instance.GetItemPrefab(name) ?? ObjectDB.instance.GetItemPrefab("ArrowWood") : null;
            return prefab != null ? prefab.GetComponent<ItemDrop>()?.m_itemData : null;
        }

        private static GameObject ProjectilePrefab(ItemDrop.ItemData bow, ItemDrop.ItemData ammo)
        {
            GameObject fromAmmo = ammo?.m_shared?.m_attack?.m_attackProjectile;
            return fromAmmo != null ? fromAmmo : bow?.m_shared?.m_attack?.m_attackProjectile;
        }

        /// <summary>The target's speed, from where it was a moment ago (works whoever owns it).</summary>
        private static void Track(State state)
        {
            Vector3 now = state.Target.GetCenterPoint();
            if (state.LastPosAt > 0f && Time.time - state.LastPosAt > 0.05f)
            {
                Vector3 measured = (now - state.LastPos) / (Time.time - state.LastPosAt);
                state.Velocity = Vector3.Lerp(state.Velocity, measured, 0.5f);
            }

            if (state.LastPosAt <= 0f || Time.time - state.LastPosAt > 0.05f)
            {
                state.LastPos = now;
                state.LastPosAt = Time.time;
            }
        }

        /// <summary>Where to send the arrow: where the target will be when it gets there, raised for the drop.</summary>
        private static Vector3 AimPoint(State state, Vector3 from, float speed, float gravity)
        {
            float lead = Mathf.Clamp01(LogicConfig.DefenderLead?.Value ?? 1f);
            Vector3 target = state.Target.GetCenterPoint();
            Vector3 point = target;
            float time = 0f;
            for (int i = 0; i < 3; i++)
            {
                time = Vector3.Distance(from, point) / speed;
                point = target + state.Velocity * (time * lead);
            }

            return point + Vector3.up * (0.5f * gravity * time * time);
        }

        private static void Fire(Villager villager, ItemDrop.ItemData bow, ItemDrop.ItemData ammo,
            GameObject projectilePrefab, Vector3 spawn, Vector3 aim, float speed, float spread)
        {
            Vector3 dir = (aim - spawn).normalized;
            spread = Mathf.Max(0f, spread);
            Vector3 side = Vector3.Cross(dir, Vector3.up);
            if (side.sqrMagnitude < 0.001f)
            {
                side = Vector3.right;
            }

            dir = Quaternion.AngleAxis(Random.Range(-spread, spread), Vector3.up) *
                  (Quaternion.AngleAxis(Random.Range(-spread, spread), side.normalized) * dir);

            var hit = new HitData();
            hit.m_damage.Add(bow.GetDamage());
            if (ammo != null)
            {
                hit.m_damage.Add(ammo.GetDamage());
                hit.m_pushForce += ammo.m_shared.m_attackForce;
            }

            hit.m_pushForce += bow.m_shared.m_attackForce;
            hit.m_toolTier = (short)bow.m_shared.m_toolTier;
            hit.m_skill = Skills.SkillType.Bows;
            hit.m_ranged = true;
            hit.m_blockable = true;
            hit.m_dodgeable = true;
            hit.SetAttacker(villager);

            GameObject go = Object.Instantiate(projectilePrefab, spawn, Quaternion.LookRotation(dir));
            IProjectile projectile = go.GetComponent<IProjectile>();
            if (projectile == null)
            {
                Object.Destroy(go);
                return;
            }

            projectile.Setup(villager, dir * speed, 10f, hit, bow, ammo);
            TallyFor(villager.VillageId).Shots++;
            TallyFor(villager.VillageId).Last = Time.time;

            string animation = bow.m_shared.m_attack.m_attackAnimation;
            if (LogicConfig.IsOn(LogicConfig.DefenderBowAnimation) && !string.IsNullOrEmpty(animation) && villager.m_zanim != null)
            {
                villager.m_zanim.SetTrigger(animation);
            }
        }

        private static void Shout(Villager villager)
        {
            if (LastShout.TryGetValue(villager.VillageId, out float last) && Time.time - last < 20f)
            {
                return;
            }

            LastShout[villager.VillageId] = Time.time;
            string line = Dialogue.LineFor(villager, "self", "defender", new[] { "defender" });
            if (line != null)
            {
                Dialogue.Say(villager, line, 3f);
            }
        }

        private static Tally TallyFor(int villageId)
        {
            if (!Tallies.TryGetValue(villageId, out Tally tally))
            {
                tally = new Tally();
                Tallies[villageId] = tally;
            }

            return tally;
        }

        // ---------------------------------------------------------------- damage

        /// <summary>The damage multiplier a villager's blow on this creature gets (1 for anything not covered).</summary>
        public static float Multiplier(Villager villager, Character target)
        {
            Profile profile = villager != null ? For(villager.VillageId) : null;
            return profile != null && target != null && profile.TargetSet().Contains(PrefabName(target))
                ? Mathf.Max(0f, profile.Damage())
                : 1f;
        }

        /// <summary>
        /// A villager's arrow brings down a small creature (ArrowSmallHealth or less: deathsquitos, ticks, deer) in one
        /// or two hits, and never takes more than 1/ArrowHitsBig of a bigger one's health (T-26: seekers, lox and trolls
        /// need several arrows).
        /// </summary>
        private static void CapArrow(Character target, HitData hit)
        {
            if (!hit.m_ranged || target == null)
            {
                return;
            }

            float max = target.GetMaxHealth();
            float small = LogicConfig.ArrowSmallHealth?.Value ?? 60f;
            int hits = Mathf.Max(1, LogicConfig.ArrowHitsBig?.Value ?? 4);
            float total = hit.GetTotalDamage();
            if (max <= small || total <= 0f)
            {
                return;
            }

            float cap = max / hits;
            if (total > cap)
            {
                hit.m_damage.Modify(cap / total);
            }
        }

        [HarmonyPatch(typeof(Character), nameof(Character.Damage))]
        internal static class DamagePatch
        {
            private static void Prefix(Character __instance, HitData hit)
            {
                try
                {
                    if (hit == null || !hit.HaveAttacker() || !(hit.GetAttacker() is Villager villager))
                    {
                        return;
                    }

                    float multiplier = On ? Multiplier(villager, __instance) : 1f;
                    if (!Mathf.Approximately(multiplier, 1f))
                    {
                        hit.m_damage.Modify(multiplier);
                    }

                    CapArrow(__instance, hit);
                }
                catch (Exception ex)
                {
                    VillheimPlugin.Debug($"Defenders damage: {ex.Message}");
                }
            }
        }

        [HarmonyPatch(typeof(VillagerAI), nameof(VillagerAI.UpdateAI))]
        internal static class TakeOverPatch
        {
            private static bool Prefix(VillagerAI __instance, float dt, ref bool __result)
            {
                try
                {
                    if (Update(__instance, dt) || Combat.Update(__instance, dt))
                    {
                        __result = true;
                        return false;
                    }
                }
                catch (Exception ex)
                {
                    VillheimPlugin.Debug($"Defenders: {ex.Message}");
                }

                return true;
            }
        }

        // ---------------------------------------------------------------- command

        /// <summary>'vh defenders': the nearest village's profile, who would shoot, and arrows loosed so far.</summary>
        public static string Command()
        {
            Player player = Player.m_localPlayer;
            VillageHearth hearth = player != null ? VillageHearth.Closest(player.transform.position, 200f) : null;
            if (hearth == null || !hearth.IsValid)
            {
                return "No village within 200 m.";
            }

            var state = new VillageState(hearth.Zdo);
            VillageProfiles.Remove(state.Id);
            Profile profile = For(state.Id);
            if (profile == null)
            {
                return $"{state.Name} ({state.Biome}) fights as before: no defender profile fits it" +
                       $"{(On ? "" : " (BiomeDefenders is off)")}.";
            }

            List<Villager> people = Character.GetAllCharacters().OfType<Villager>().Where(v => v.VillageId == state.Id && !v.IsDead() && !Childhood.IsChild(v)).ToList();
            bool carers = LogicConfig.IsOn(LogicConfig.DefenderCarers);
            int archers = people.Count(v => carers || Roles.BackgroundOf(v) == Roles.Background.Protector);
            Tallies.TryGetValue(state.Id, out Tally tally);
            return $"{state.Name} ({state.Biome}) uses the {profile.Name} profile: {string.Join(", ", profile.TargetSet())}; " +
                   $"damage x{profile.Damage():0.0}, spread {profile.Spread():0.0} degrees, reaction {profile.Reaction():0.00} s, " +
                   $"range {LogicConfig.DefenderRange?.Value ?? 35f:0} m.\n" +
                   $"   {archers} of {people.Count} loaded villagers would shoot at flyers; bow tier {Bows[Mathf.Clamp(people.Count > 0 ? Roles.GearTier(people[0]) : 0, 0, 4)]}.\n" +
                   $"   Arrows loosed this session: {tally?.Shots ?? 0}, flyers downed soon after a shot: {tally?.Downed ?? 0}.";
        }
    }
}
