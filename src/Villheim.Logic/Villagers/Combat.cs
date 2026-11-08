using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Fights with creatures (T-26, T-29). Runs on every AI tick of a villager on the owning machine, after the biome
    /// defenders' bows (a prefix on VillagerAI.UpdateAI), and takes him over only while he has a part in a fight:
    ///
    /// - Responders: for each threat to the village (an enemy seen by any villager within the village's radius plus
    ///   FightLeash), the nearest protector goes after it, up to FightResponders in all; carers only when the village
    ///   has no protector, elders only when there is nobody else. Villagers following the horn always go. Only
    ///   responders call to arms, the first two of a fight, once a minute at most.
    /// - Fighting back: any grown villager with a creature within FightBackRange, or one that has just hurt him,
    ///   fights it with his weapon (a tick on his back included). Nobody runs from a fight he is already in.
    /// - Shelter: while a responder is fighting, the others go to their home or the longhouse when a threat comes
    ///   within FightFleeRange. Otherwise they keep working. Children run to the hearth from any threat near them.
    ///
    /// Blows are dealt the way the villagers' axes are (Chores, Hunting): the weapon's animation plays and its damage
    /// lands on the target a moment later if it is still in reach, scaled by MeleeStrength. The game's own monster
    /// AI does not fight for villagers any more (it swung slowly and turned away when hurt). Responders shoot with
    /// the bow everyone who fights carries at anything further off than FightBowFrom (D-050), and anyone under
    /// FightRetreatHealth goes back to the hearth to heal.
    ///
    /// Players (D-051): a few hits from one player may be an accident, so protectors only complain and the others run
    /// home; from PlayerHitsToFight hits within PlayerHitWindow the protectors fight him (see PlayerHit). Creatures
    /// pick protectors before the others and children last (TargetOrderPatch).
    /// </summary>
    internal static class Combat
    {
        private enum Part
        {
            None,
            Fighter,
            Shelter,
            Flee,
        }

        private sealed class State
        {
            public Part Part;
            public Character Enemy;
            public bool Ranged;
            public bool SelfDefense;
            public float NextScan;
            public Character Nearest;
            public float NearestDistance = float.MaxValue;
            public float LastHealth = -1f;
            public float HurtAt = -100f;
            public float NextStrike;
            public float HitAt = -1f;
            public float NextShot;
            public Vector3 LastEnemyPos;
            public float LastEnemyPosAt;
            public Vector3 Velocity;
            public float PartSince;
            public float ShootingAt = -100f;
            public float FleeUntil = -100f;
            public Character FleeFrom;
            public float NextLine;
            public bool Retreating;
        }

        // Hits on a village's people by each player (D-051), and the player its protectors are fighting, if any.
        private static readonly Dictionary<(int, long), List<float>> PlayerHits = new Dictionary<(int, long), List<float>>();
        private static readonly Dictionary<int, (Player Player, float Until)> Hostile = new Dictionary<int, (Player, float)>();

        private sealed class Fight
        {
            public readonly Dictionary<Character, float> Seen = new Dictionary<Character, float>();
            public readonly Dictionary<Villager, Character> Responders = new Dictionary<Villager, Character>();
            public float NextPlan;
            public float LastEngaged = -100f;
            public float LastThreat = -100f;
            public float LastShout = -100f;
            public int Shouts;
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();
        private static readonly Dictionary<int, Fight> Fights = new Dictionary<int, Fight>();

        private const float SenseRange = 22f;
        private const float CloseSense = 6f;
        private const float HurtMemory = 3f;
        private const float HitDelay = 0.35f;

        private static float BackRange => Mathf.Max(1f, LogicConfig.FightBackRange?.Value ?? 3f);
        private static float FleeRange => Mathf.Max(0f, LogicConfig.FightFleeRange?.Value ?? 18f);
        private static float Leash => Mathf.Max(0f, LogicConfig.FightLeash?.Value ?? 30f);
        private static int MaxResponders => Mathf.Max(1, LogicConfig.FightResponders?.Value ?? 3);

        private static Fight FightOf(int villageId)
        {
            if (!Fights.TryGetValue(villageId, out Fight fight))
            {
                fight = new Fight();
                Fights[villageId] = fight;
            }

            return fight;
        }

        // ---------------------------------------------------------------- status

        public static string Describe(Villager villager)
        {
            if (!States.TryGetValue(villager, out State state))
            {
                return null;
            }

            string enemy = state.Enemy != null ? state.Enemy.GetHoverName() : "an enemy";
            if (Time.time - state.ShootingAt < 1.5f)
            {
                return "shooting at " + enemy;
            }

            switch (state.Part)
            {
                case Part.Fighter: return (state.Ranged ? "shooting at " : "fighting ") + enemy;
                case Part.Shelter: return "taking shelter";
                case Part.Flee: return state.Retreating ? "going back to heal" : "running to safety";
                default: return null;
            }
        }

        public static string Short(Villager villager)
        {
            if (!States.TryGetValue(villager, out State state))
            {
                return "fighting";
            }

            if (Time.time - state.ShootingAt < 1.5f)
            {
                return "shooting";
            }

            switch (state.Part)
            {
                case Part.Shelter: return "sheltering";
                case Part.Flee: return "fleeing";
                default: return state.Ranged ? "shooting" : "fighting";
            }
        }

        /// <summary>From the biome defenders: this villager is shooting at a flyer (for the status and the shelter rule).</summary>
        public static void NoteShooting(Villager villager, Character target)
        {
            State state = States.GetOrCreateValue(villager);
            state.Enemy = target;
            state.ShootingAt = Time.time;
            Fight fight = FightOf(villager.VillageId);
            fight.LastEngaged = Time.time;
            fight.LastThreat = Time.time;
            if (target != null)
            {
                fight.Seen[target] = Time.time;
            }
        }

        /// <summary>True while the villager is one the village sent after a threat.</summary>
        public static bool IsResponder(Villager villager) =>
            Fights.TryGetValue(villager.VillageId, out Fight fight) && fight.Responders.ContainsKey(villager);

        // ---------------------------------------------------------------- the takeover

        /// <summary>Every AI tick on the owning machine. True while the fight runs the villager this tick.</summary>
        public static bool Update(VillagerAI ai, float dt)
        {
            if (ai == null || ai.m_nview == null || !ai.m_nview.IsValid() || !ai.m_nview.IsOwner() ||
                !(ai.m_character is Villager villager) || villager.IsDead() || villager.Zdo == null || Wanderers.IsWanderer(villager))
            {
                return false;
            }

            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid)
            {
                return false;
            }

            State state = States.GetOrCreateValue(villager);
            Fight fight = FightOf(villager.VillageId);
            Scan(villager, state, fight);
            Plan(villager.VillageId, hearth, fight);

            Part part = Decide(villager, hearth, state, fight, out Character enemy);
            if (part != state.Part || enemy != state.Enemy)
            {
                if (state.Part == Part.Fighter && state.Ranged && part != Part.Fighter)
                {
                    // Done shooting: the bow goes back, so he works with his tools again.
                    Defenders.PutBowAway(villager);
                    state.Ranged = false;
                }

                if (part != Part.None && state.Part == Part.None)
                {
                    Begin(villager);
                }

                state.PartSince = Time.time;
                state.HitAt = -1f;
                Walker.For(villager).Reset();
            }

            state.Part = part;
            state.Enemy = enemy;
            if (part == Part.None)
            {
                Calm(ai);
                return false;
            }

            Body.Update(villager);
            Walker.For(villager).Tick(villager);
            villager.SetWalk(false);
            Status.Set(villager, Status.Doer.Fight);
            fight.LastThreat = Time.time;
            switch (part)
            {
                case Part.Fighter:
                    return FightIt(villager, ai, dt, hearth, state, fight);
                case Part.Shelter:
                    return Shelter(villager, ai, dt, hearth, state);
                default:
                    return Run(villager, ai, dt, hearth, state);
            }
        }

        /// <summary>Wakes him, gets him up from a seat or out of a pose: the fight comes first.</summary>
        private static void Begin(Villager villager)
        {
            Sleep.Wake(villager);
            Seats.StandUp(villager);
            Poses.Release(villager);
        }

        /// <summary>
        /// With no part in a fight, the game's own alert (from a glimpse or a hit) is dropped so the village's routine
        /// keeps him.
        /// </summary>
        private static void Calm(VillagerAI ai)
        {
            // Fights with players are run here too (D-051), so the game's own alert and grudge are always dropped.
            if (ai.IsAlerted())
            {
                ai.SetAlerted(false);
                ai.m_targetCreature = null;
            }

            if (ai.IsAggravated())
            {
                ai.SetAggravated(false, BaseAI.AggravatedReason.Damage);
            }
        }

        // ---------------------------------------------------------------- seeing

        /// <summary>Four times a second: the nearest enemy he can sense, and whether he was just hurt.</summary>
        private static void Scan(Villager villager, State state, Fight fight)
        {
            float health = villager.GetHealth();
            if (state.LastHealth >= 0f && health < state.LastHealth - 0.01f)
            {
                state.HurtAt = Time.time;
            }

            state.LastHealth = health;
            if (Time.time < state.NextScan)
            {
                if (state.Nearest != null && (!state.Nearest || state.Nearest.IsDead()))
                {
                    state.Nearest = null;
                    state.NearestDistance = float.MaxValue;
                }

                return;
            }

            state.NextScan = Time.time + 0.25f + Random.Range(0f, 0.1f);
            state.Nearest = null;
            state.NearestDistance = float.MaxValue;
            Vector3 position = villager.transform.position;
            Vector3 eye = villager.GetEyePoint();
            foreach (Character c in Character.GetAllCharacters())
            {
                if (c == null || c == villager || c.IsDead() || c is Villager || c is Player || !BaseAI.IsEnemy(villager, c))
                {
                    continue;
                }

                float distance = Vector3.Distance(c.transform.position, position);
                if (distance > SenseRange || distance >= state.NearestDistance || (distance > CloseSense && !InSight(eye, c)))
                {
                    continue;
                }

                state.Nearest = c;
                state.NearestDistance = distance;
            }

            if (state.Nearest != null)
            {
                fight.Seen[state.Nearest] = Time.time;
            }
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

        // ---------------------------------------------------------------- who goes

        /// <summary>Twice a second per village: the threats near it and who goes after each.</summary>
        private static void Plan(int villageId, VillageHearth hearth, Fight fight)
        {
            if (Time.time < fight.NextPlan)
            {
                return;
            }

            fight.NextPlan = Time.time + 0.5f;
            Vector3 center = hearth.transform.position;
            float reach = VillheimConfig.VillageRadius.Value + Leash;
            foreach (Character gone in fight.Seen.Keys.Where(c => c == null || c.IsDead() || Time.time - fight.Seen[c] > 4f).ToList())
            {
                fight.Seen.Remove(gone);
            }

            List<Character> threats = fight.Seen.Keys
                .Where(c => Utils.DistanceXZ(c.transform.position, center) <= reach)
                .OrderBy(c => Utils.DistanceXZ(c.transform.position, center)).ToList();

            // Those already on a threat that is still there stay on it.
            foreach (Villager v in fight.Responders.Keys.ToList())
            {
                Character on = fight.Responders[v];
                if (v == null || v.IsDead() || on == null || !threats.Contains(on) || v.GetHealth() < v.GetMaxHealth() * 0.2f)
                {
                    fight.Responders.Remove(v);
                }
            }

            if (threats.Count == 0)
            {
                fight.Responders.Clear();
                if (Time.time - fight.LastThreat > 10f)
                {
                    fight.Shouts = 0;
                }

                return;
            }

            List<Villager> people = Character.GetAllCharacters().OfType<Villager>()
                .Where(v => !v.IsDead() && v.VillageId == villageId && v.Zdo != null && !Childhood.IsChild(v) &&
                            !Wanderers.IsWanderer(v) && !Leaving.IsLeaving(v) && v.GetHealth() > v.GetMaxHealth() * 0.3f)
                .ToList();

            // Anyone following the horn goes after the nearest threat.
            foreach (Villager escort in people.Where(Escort.IsEscorting))
            {
                if (!fight.Responders.ContainsKey(escort))
                {
                    fight.Responders[escort] = threats.OrderBy(t => Vector3.Distance(t.transform.position, escort.transform.position)).First();
                }
            }

            List<Villager> pool = people.Where(v => Roles.BackgroundOf(v) == Roles.Background.Protector && !Elders.IsElder(v)).ToList();
            if (pool.Count == 0)
            {
                pool = people.Where(v => !Elders.IsElder(v)).ToList();
            }

            if (pool.Count == 0)
            {
                pool = people;
            }

            // One each for the threats nearest the hearth first, then more on the same threats, up to the limit.
            int limit = MaxResponders;
            bool added = true;
            while (fight.Responders.Count < limit && added)
            {
                added = false;
                foreach (Character threat in threats)
                {
                    if (fight.Responders.Count >= limit)
                    {
                        break;
                    }

                    int onIt = fight.Responders.Values.Count(t => t == threat);
                    int fewest = threats.Min(t => fight.Responders.Values.Count(r => r == t));
                    if (onIt > fewest)
                    {
                        continue;
                    }

                    Villager nearest = pool.Where(v => !fight.Responders.ContainsKey(v))
                        .OrderBy(v => Vector3.Distance(v.transform.position, threat.transform.position)).FirstOrDefault();
                    if (nearest == null)
                    {
                        break;
                    }

                    fight.Responders[nearest] = threat;
                    added = true;
                }
            }
        }

        /// <summary>His part in the fight this tick, and the creature it is about.</summary>
        private static Part Decide(Villager villager, VillageHearth hearth, State state, Fight fight, out Character enemy)
        {
            enemy = null;
            Character near = state.Nearest;
            bool hurt = Time.time - state.HurtAt < HurtMemory;
            bool protector = Protects(villager);

            // Badly hurt in a fight: back to the hearth to heal (the brain's healing takes over once he is clear).
            float retreat = Mathf.Clamp01(LogicConfig.FightRetreatHealth?.Value ?? 0.25f);
            bool inFight = state.Part != Part.None || near != null || IsHostile(villager.VillageId, out _);
            if (inFight && villager.GetHealth() < villager.GetMaxHealth() * retreat)
            {
                enemy = state.Enemy ?? near ?? state.FleeFrom;
                state.Retreating = true;
                return Part.Flee;
            }

            state.Retreating = false;

            // A player who keeps hitting the village's people (D-051): protectors fight him, everyone else runs home.
            if (IsHostile(villager.VillageId, out Player foe) &&
                Vector3.Distance(foe.transform.position, villager.transform.position) < 40f)
            {
                enemy = foe;
                state.SelfDefense = false;
                return protector ? Part.Fighter : Part.Flee;
            }

            // Hit by a player, not yet on purpose as far as the village can tell: carers, elders and children run home.
            if (!protector && Time.time < state.FleeUntil && state.FleeFrom != null && !state.FleeFrom.IsDead())
            {
                enemy = state.FleeFrom;
                return Part.Flee;
            }

            if (Childhood.IsChild(villager))
            {
                if (near != null && state.NearestDistance < Mathf.Max(FleeRange, 8f))
                {
                    enemy = near;
                    return Part.Flee;
                }

                return Part.None;
            }

            // Fighting back: a creature on top of him, or one close by that has just hurt him.
            if (near != null && (state.NearestDistance <= BackRange || (hurt && state.NearestDistance <= BackRange + 3f)))
            {
                enemy = near;
                state.SelfDefense = true;
                return Part.Fighter;
            }

            state.SelfDefense = false;
            if (fight.Responders.TryGetValue(villager, out Character target) && target != null && !target.IsDead())
            {
                enemy = target;
                return Part.Fighter;
            }

            // Out of the way while a protector deals with it.
            bool engaged = Time.time - fight.LastEngaged < 3f;
            if (engaged && FleeRange > 0f)
            {
                Character closest = fight.Seen.Keys.Where(c => c != null && !c.IsDead())
                    .OrderBy(c => Vector3.Distance(c.transform.position, villager.transform.position)).FirstOrDefault();
                if (closest != null && Vector3.Distance(closest.transform.position, villager.transform.position) < FleeRange)
                {
                    enemy = closest;
                    return Part.Shelter;
                }
            }

            return Part.None;
        }

        // ---------------------------------------------------------------- fighting

        private static bool FightIt(Villager villager, VillagerAI ai, float dt, VillageHearth hearth, State state, Fight fight)
        {
            Character enemy = state.Enemy;
            if (enemy == null || enemy.IsDead())
            {
                state.Part = Part.None;
                return false;
            }

            Track(state, enemy);
            Vector3 center = hearth.transform.position;
            float distance = Utils.DistanceXZ(villager.transform.position, enemy.transform.position);
            bool escort = Escort.IsEscorting(villager);
            if (!state.SelfDefense && !escort &&
                Utils.DistanceXZ(enemy.transform.position, center) > VillheimConfig.VillageRadius.Value + Leash)
            {
                // Gone past the leash: he lets it go and comes home.
                fight.Responders.Remove(villager);
                state.Part = Part.None;
                return false;
            }

            fight.LastEngaged = Time.time;
            CallToArms(villager, fight, distance);

            // Flyers are shot at, and anything else he can see further off than FightBowFrom (D-050); up close, the weapon.
            bool flies = enemy.IsFlying() || enemy.m_flying;
            float bowFrom = Mathf.Max(BackRange, LogicConfig.FightBowFrom?.Value ?? 8f);
            state.Ranged = !state.SelfDefense && distance > BackRange &&
                           (flies || (distance > bowFrom && InSight(villager.GetEyePoint(), enemy)));
            if (state.Ranged)
            {
                if (distance > 30f)
                {
                    // Out of bow range: closer first.
                    Walker.For(villager).Go(villager, ai, dt, enemy.transform.position, 25f, true);
                    return true;
                }

                ai.StopMoving();
                if (Time.time >= state.NextShot)
                {
                    float spread = Defenders.For(villager.VillageId) != null ? 2f : 3f;
                    if (Defenders.ShootAt(villager, ai, enemy, state.Velocity, spread))
                    {
                        state.NextShot = Time.time + Mathf.Max(0.3f, LogicConfig.DefenderShotSeconds?.Value ?? 1.2f) * Random.Range(0.9f, 1.15f);
                        state.ShootingAt = Time.time;
                        string animation = (villager.GetLeftItem() ?? villager.GetRightItem())?.m_shared?.m_attack?.m_attackAnimation;
                        if (LogicConfig.IsOn(LogicConfig.DefenderBowAnimation) && !string.IsNullOrEmpty(animation) && villager.m_zanim != null)
                        {
                            villager.m_zanim.SetTrigger(animation);
                        }
                    }
                }

                return true;
            }

            ItemDrop.ItemData weapon = Arm(villager);
            LandPendingHit(villager, state, weapon);
            float reach = Reach(weapon) + enemy.GetRadius();
            float rise = Mathf.Abs(enemy.transform.position.y - villager.transform.position.y);
            if (distance > reach || rise > 2.5f)
            {
                WalkResult step = Walker.For(villager).Go(villager, ai, dt, enemy.transform.position, reach * 0.7f, true);
                if (step != WalkResult.Walking)
                {
                    // The path ends short (the creature stands on something, or moves): straight at it.
                    Vector3 to = (enemy.transform.position - villager.transform.position).Horizontal();
                    if (to.sqrMagnitude > 0.01f)
                    {
                        ai.MoveTowards(to.normalized, true);
                    }
                }

                return true;
            }

            ai.StopMoving();
            ai.LookAt(enemy.GetCenterPoint());
            Vector3 toEnemy = (enemy.transform.position - villager.transform.position).Horizontal();
            if (toEnemy.sqrMagnitude > 0.01f)
            {
                villager.SetLookDir(toEnemy.normalized);
            }

            if (Time.time >= state.NextStrike && state.HitAt < 0f)
            {
                state.NextStrike = Time.time + Interval(weapon) * Random.Range(0.9f, 1.1f);
                state.HitAt = Time.time + HitDelay;
                Swing(villager, weapon);
            }

            return true;
        }

        /// <summary>The blow started a moment ago lands, if the enemy is still in reach.</summary>
        private static void LandPendingHit(Villager villager, State state, ItemDrop.ItemData weapon)
        {
            if (state.HitAt < 0f || Time.time < state.HitAt)
            {
                return;
            }

            state.HitAt = -1f;
            Character enemy = state.Enemy;
            if (enemy == null || enemy.IsDead() ||
                Utils.DistanceXZ(villager.transform.position, enemy.transform.position) > Reach(weapon) + enemy.GetRadius() + 1f)
            {
                return;
            }

            Vector3 dir = (enemy.transform.position - villager.transform.position).Horizontal();
            var hit = new HitData
            {
                m_point = enemy.GetCenterPoint(),
                m_dir = dir.sqrMagnitude > 0.01f ? dir.normalized : villager.transform.forward,
                m_toolTier = (short)(weapon?.m_shared?.m_toolTier ?? 0),
                m_pushForce = weapon?.m_shared?.m_attackForce ?? 10f,
                m_backstabBonus = 1f,
                m_staggerMultiplier = 1f,
                m_blockable = true,
                m_dodgeable = true,
                m_skill = weapon?.m_shared?.m_skillType ?? Skills.SkillType.Unarmed,
            };

            if (weapon != null)
            {
                hit.m_damage.Add(weapon.GetDamage());
            }

            if (hit.m_damage.GetTotalDamage() < 1f)
            {
                hit.m_damage.m_blunt = 6f;
            }

            hit.m_damage.Modify(Mathf.Max(0.05f, LogicConfig.MeleeStrength?.Value ?? 0.8f));
            hit.SetAttacker(villager);
            enemy.Damage(hit);
        }

        /// <summary>The weapon in hand if it is one (an axe or club counts), else the village's weapon of his tier.</summary>
        private static ItemDrop.ItemData Arm(Villager villager)
        {
            ItemDrop.ItemData right = villager.GetRightItem();
            if (right != null && right.m_shared.m_itemType != ItemDrop.ItemData.ItemType.Torch &&
                right.m_shared.m_itemType != ItemDrop.ItemData.ItemType.Bow && right.GetDamage().GetTotalDamage() > 1f)
            {
                return right;
            }

            Defenders.PutBowAway(villager);
            Roles.ArmForFight(villager, Roles.BackgroundOf(villager) == Roles.Background.Protector);
            return villager.GetRightItem();
        }

        private static float Reach(ItemDrop.ItemData weapon)
        {
            float range = weapon?.m_shared?.m_attack?.m_attackRange ?? 0f;
            return Mathf.Clamp(range > 0f ? range : 2f, 1.6f, 3f);
        }

        /// <summary>Seconds between blows, by kind of weapon.</summary>
        private static float Interval(ItemDrop.ItemData weapon)
        {
            switch (weapon?.m_shared?.m_skillType ?? Skills.SkillType.Unarmed)
            {
                case Skills.SkillType.Knives: return 0.9f;
                case Skills.SkillType.Swords: return 1.1f;
                case Skills.SkillType.Spears: return 1.2f;
                case Skills.SkillType.Axes: return 1.4f;
                case Skills.SkillType.Clubs: return 1.4f;
                case Skills.SkillType.Polearms: return 1.6f;
                case Skills.SkillType.Unarmed: return 0.9f;
                default: return 1.3f;
            }
        }

        private static void Swing(Villager villager, ItemDrop.ItemData weapon)
        {
            string animation = weapon?.m_shared?.m_attack?.m_attackAnimation;
            if (!string.IsNullOrEmpty(animation) && villager.m_zanim != null)
            {
                villager.m_zanim.SetTrigger(weapon.m_shared.m_attack.m_attackChainLevels > 1 ? animation + "0" : animation);
            }
        }

        /// <summary>The target's speed, from where it was a moment ago, for arrows.</summary>
        private static void Track(State state, Character enemy)
        {
            Vector3 now = enemy.GetCenterPoint();
            if (state.LastEnemyPosAt > 0f && Time.time - state.LastEnemyPosAt > 0.05f)
            {
                Vector3 measured = (now - state.LastEnemyPos) / (Time.time - state.LastEnemyPosAt);
                state.Velocity = Vector3.Lerp(state.Velocity, measured, 0.5f);
            }

            if (state.LastEnemyPosAt <= 0f || Time.time - state.LastEnemyPosAt > 0.05f)
            {
                state.LastEnemyPos = now;
                state.LastEnemyPosAt = Time.time;
            }
        }

        /// <summary>
        /// The call to arms (lines tagged event:attack): only from a responder close to the threat, the first two of a
        /// fight, at most once every 20 seconds and a minute between fights.
        /// </summary>
        private static void CallToArms(Villager villager, Fight fight, float distance)
        {
            if (!fight.Responders.ContainsKey(villager) || distance > 25f || fight.Shouts >= 2 ||
                Time.time - fight.LastShout < (fight.Shouts == 0 ? 60f : 20f))
            {
                return;
            }

            fight.LastShout = Time.time;
            fight.Shouts++;
            string line = Dialogue.LineFor(villager, "self", "event:attack", new[] { "event:attack" });
            if (line != null)
            {
                Dialogue.Say(villager, line, 4f);
            }
        }

        // ---------------------------------------------------------------- out of the way

        private static bool Shelter(Villager villager, VillagerAI ai, float dt, VillageHearth hearth, State state)
        {
            Character enemy = state.Enemy;
            Vector3 spot = Roles.ShelterSpot(villager) ?? hearth.transform.position;
            if (enemy != null && Vector3.Distance(enemy.transform.position, spot) < 6f)
            {
                ai.Flee(dt, enemy.transform.position);
                return true;
            }

            if (Walker.For(villager).Go(villager, ai, dt, spot, 1.2f, true) != WalkResult.Walking)
            {
                ai.StopMoving();
                if (enemy != null)
                {
                    ai.LookAt(enemy.GetCenterPoint());
                }
            }

            return true;
        }

        /// <summary>A grown protector, not an elder: the ones who stand and fight.</summary>
        private static bool Protects(Villager villager) =>
            !Childhood.IsChild(villager) && !Elders.IsElder(villager) && Roles.BackgroundOf(villager) == Roles.Background.Protector;

        private static bool IsHostile(int villageId, out Player player)
        {
            player = null;
            if (!Hostile.TryGetValue(villageId, out (Player Player, float Until) entry))
            {
                return false;
            }

            VillageHearth hearth = VillageHearth.Find(villageId);
            bool gone = entry.Player == null || entry.Player.IsDead() || Time.time > entry.Until ||
                        (hearth != null && Utils.DistanceXZ(entry.Player.transform.position, hearth.transform.position) >
                            VillheimConfig.VillageRadius.Value + Leash);
            if (gone)
            {
                Hostile.Remove(villageId);
                return false;
            }

            player = entry.Player;
            return true;
        }

        /// <summary>
        /// A player hit one of the village's people (D-051). Up to PlayerHitsToFight hits within PlayerHitWindow it may
        /// be an accident: a protector says it hurt, the others run to the hearth and say so. From then on it is on
        /// purpose: the protectors near him fight him until PlayerFightSeconds after his last hit or until he leaves.
        /// Lines: playerhit:protector, playerhit:carer (carers and elders), playerhit:child, playerfight (protectors
        /// as they turn on him), playerfight:flee (everyone else while it lasts).
        /// </summary>
        public static void PlayerHit(Villager villager, Player player)
        {
            if (villager == null || player == null || villager.VillageId == 0)
            {
                return;
            }

            var key = (villager.VillageId, player.GetPlayerID());
            if (!PlayerHits.TryGetValue(key, out List<float> hits))
            {
                hits = new List<float>();
                PlayerHits[key] = hits;
            }

            float window = Mathf.Max(1f, LogicConfig.PlayerHitWindow?.Value ?? 30f);
            hits.RemoveAll(t => Time.time - t > window);
            hits.Add(Time.time);
            bool was = IsHostile(villager.VillageId, out _);
            if (hits.Count >= Mathf.Max(1, LogicConfig.PlayerHitsToFight?.Value ?? 3))
            {
                Hostile[villager.VillageId] = (player, Time.time + Mathf.Max(5f, LogicConfig.PlayerFightSeconds?.Value ?? 60f));
            }

            bool hostile = IsHostile(villager.VillageId, out _);
            bool protector = Protects(villager);
            State state = States.GetOrCreateValue(villager);
            if (!protector)
            {
                state.FleeUntil = Time.time + 12f;
                state.FleeFrom = player;
            }

            if (hostile && !was)
            {
                VillheimPlugin.Debug($"{villager.VillageName}: {player.GetPlayerName()} keeps hitting our people; the protectors fight back.");
                foreach (Villager guard in Character.GetAllCharacters().OfType<Villager>()
                             .Where(v => !v.IsDead() && v.VillageId == villager.VillageId && Protects(v) &&
                                         Vector3.Distance(v.transform.position, player.transform.position) < 40f)
                             .OrderBy(v => Vector3.Distance(v.transform.position, player.transform.position)).Take(2))
                {
                    Line(guard, "playerfight", true);
                }
            }

            if (hostile)
            {
                if (!protector)
                {
                    Line(villager, "playerfight:flee");
                }

                return;
            }

            Line(villager, protector ? "playerhit:protector" : Childhood.IsChild(villager) ? "playerhit:child" : "playerhit:carer");
        }

        /// <summary>A line under this tag, if one is written, at most every few seconds per villager.</summary>
        private static void Line(Villager villager, string tag, bool force = false)
        {
            State state = States.GetOrCreateValue(villager);
            if (!force && Time.time < state.NextLine)
            {
                return;
            }

            state.NextLine = Time.time + 3f;
            string line = Dialogue.LineFor(villager, "self", tag, new[] { tag });
            if (line != null)
            {
                Dialogue.Say(villager, line, 3f);
            }
        }

        /// <summary>On the machine that owns the villager: a hit from a player is counted.</summary>
        [HarmonyLib.HarmonyPatch(typeof(Character), nameof(Character.RPC_Damage))]
        internal static class PlayerHitPatch
        {
            private static void Prefix(Character __instance, HitData hit)
            {
                try
                {
                    if (__instance is Villager villager && villager.NView != null && villager.NView.IsOwner() && !villager.IsDead() &&
                        hit != null && hit.GetAttacker() is Player player && !Wanderers.IsWanderer(villager))
                    {
                        PlayerHit(villager, player);
                    }
                }
                catch (System.Exception ex)
                {
                    VillheimPlugin.Debug($"Combat player hit: {ex.Message}");
                }
            }
        }

        /// <summary>
        /// Creatures going for villagers pick a protector first among those about as close, and a child last
        /// (D-051): a postfix on BaseAI.FindEnemy that looks again when the game picked a villager.
        /// </summary>
        [HarmonyLib.HarmonyPatch(typeof(BaseAI), nameof(BaseAI.FindEnemy))]
        internal static class TargetOrderPatch
        {
            private static int Rank(Villager v) => Childhood.IsChild(v) ? 2 : Protects(v) ? 0 : 1;

            private static void Postfix(BaseAI __instance, ref Character __result)
            {
                try
                {
                    if (!(__result is Villager first) || __instance is VillagerAI || !LogicConfig.IsOn(LogicConfig.FightTargetOrder) ||
                        __instance.m_character == null)
                    {
                        return;
                    }

                    Vector3 me = __instance.transform.position;
                    float reach = Vector3.Distance(first.transform.position, me) + 8f;
                    Character best = first;
                    int bestRank = Rank(first);
                    float bestDistance = float.MaxValue;
                    foreach (Character c in Character.GetAllCharacters())
                    {
                        if (!(c is Villager v) || v == first || v.IsDead())
                        {
                            continue;
                        }

                        float distance = Vector3.Distance(v.transform.position, me);
                        int rank = Rank(v);
                        if (distance > reach || rank > bestRank || (rank == bestRank && distance >= bestDistance) ||
                            !BaseAI.IsEnemy(__instance.m_character, v) || !__instance.CanSenseTarget(v))
                        {
                            continue;
                        }

                        best = v;
                        bestRank = rank;
                        bestDistance = distance;
                    }

                    __result = best;
                }
                catch (System.Exception ex)
                {
                    VillheimPlugin.Debug($"Combat target order: {ex.Message}");
                }
            }
        }

        /// <summary>
        /// Running home: a child from a creature, carers and elders from a player who hits them, anyone badly hurt.
        /// To the hearth, or straight away from the threat when it stands between.
        /// </summary>
        private static bool Run(Villager villager, VillagerAI ai, float dt, VillageHearth hearth, State state)
        {
            Character enemy = state.Enemy;
            Vector3 hearthAt = hearth.transform.position;
            Villager guard = Fights.TryGetValue(villager.VillageId, out Fight fight)
                ? fight.Responders.Keys.Where(v => v != null && !v.IsDead())
                    .OrderBy(v => Vector3.Distance(v.transform.position, villager.transform.position)).FirstOrDefault()
                : null;
            Vector3 safe = enemy != null && Vector3.Distance(enemy.transform.position, hearthAt) < 8f && guard != null
                ? guard.transform.position
                : hearthAt;
            if (enemy != null && Vector3.Distance(enemy.transform.position, safe) < 5f)
            {
                ai.Flee(dt, enemy.transform.position);
                return true;
            }

            if (Walker.For(villager).Go(villager, ai, dt, safe, 2.5f, true) != WalkResult.Walking)
            {
                ai.StopMoving();
            }

            return true;
        }
    }
}
