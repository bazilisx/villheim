using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;
using Random = UnityEngine.Random;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Villager work. Woodcutters fell trees and split logs, miners break rocks, and both carry what drops back
    /// to the village stock. Builders place the next piece of the construction site with each hammer swing.
    ///
    /// Gatherers always take the easiest work first: material already lying on the ground, then loose sticks and
    /// stones to pick up, then half-finished work (felled logs), and only then something new (a tree or a rock).
    /// They have to stand next to what they hit; the swing is the tool's animation and the damage goes straight
    /// to the target, so villagers never hurt players or buildings by accident.
    ///
    /// Runs only by day, on the client that owns the villager, and hands control back to the normal AI between jobs.
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
        }

        private enum Step
        {
            Moving,
            Arrived,
            Stuck,
        }

        private sealed class Profile
        {
            public string Activity;
            public string PartialActivity;
            public Skills.SkillType Tool;
            public Func<GameObject, bool> IsSource;
            public Func<GameObject, bool> IsPartial;
            public HashSet<string> Drops;
            public HashSet<string> Pickables;
            public bool Pickaxe;
            public int MaxSwingsPerSource;
        }

        private sealed class Work
        {
            public Phase Phase;
            public Profile Profile;
            public GameObject Target;
            public Vector3 Spot;
            public float Timer;
            public float Deadline;
            public float Cooldown = Random.Range(5f, 20f);
            public int Swings;
            public readonly Dictionary<string, int> Collected = new Dictionary<string, int>();
            public float BestDistance = float.MaxValue;
            public float StuckTimer;
            public readonly HashSet<GameObject> Skip = new HashSet<GameObject>();
        }

        private const float SearchRadius = 30f;
        private const float MaxFromHearth = 55f;
        private const float WorkReach = 2.6f;
        private const float StuckSeconds = 3f;
        private const float SwingInterval = 1.8f;
        private const float WorkRange = 8f;
        private const float RunDistance = 8f;
        private const float BuildReach = 4f;
        private const float BuildInterval = 1.4f;

        private static readonly string[] OreWords = { "copper", "tin", "iron", "silver", "obsidian", "meteor", "flametal", "crystal", "ore" };

        private static readonly Profile Woodcutter = new Profile
        {
            Activity = "felling a tree",
            PartialActivity = "splitting logs",
            Tool = Skills.SkillType.Axes,
            IsSource = go => go.GetComponent<TreeBase>() != null,
            IsPartial = go => go.GetComponent<TreeLog>() != null,
            Drops = new HashSet<string> { Materials.Wood, Materials.FineWood, Materials.CoreWood },
            Pickables = new HashSet<string> { "Pickable_Branch" },
            Pickaxe = false,
            MaxSwingsPerSource = 40,
        };

        private static readonly Profile Miner = new Profile
        {
            Activity = "breaking rocks",
            PartialActivity = "breaking rocks",
            Tool = Skills.SkillType.Pickaxes,
            IsSource = IsRock,
            IsPartial = go => false,
            Drops = new HashSet<string> { Materials.Stone },
            Pickables = new HashSet<string> { "Pickable_Stone" },
            Pickaxe = true,
            MaxSwingsPerSource = 10,
        };

        private static readonly ConditionalWeakTable<Villager, Work> States = new ConditionalWeakTable<Villager, Work>();
        private static readonly HashSet<GameObject> Claimed = new HashSet<GameObject>();
        private static readonly Dictionary<GameObject, float> Unreachable = new Dictionary<GameObject, float>();
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
            int seed = villager.Zdo.GetInt(Keys.VillagerSeed);
            if (VillagerLooks.IsBuilder(seed))
            {
                return UpdateBuilder(villager, ai, work, dt);
            }

            work.Profile = VillagerLooks.IsMiner(seed) ? Miner : Woodcutter;
            if (!HasTool(villager, work.Profile.Tool))
            {
                return false;
            }

            switch (work.Phase)
            {
                case Phase.Idle:
                    work.Cooldown -= dt;
                    if (work.Cooldown <= 0f)
                    {
                        work.Cooldown = Random.Range(15f, 35f);
                        StartJob(villager, work);
                    }

                    return work.Phase != Phase.Idle;

                case Phase.Approach:
                case Phase.Work:
                    return UpdateWork(villager, ai, work, dt);

                case Phase.Pick:
                    return UpdatePick(villager, ai, work, dt);

                case Phase.Collect:
                    return UpdateCollect(villager, ai, work, dt);
            }

            return false;
        }

        public static string Describe(Villager villager)
        {
            if (!States.TryGetValue(villager, out Work work) || work.Phase == Phase.Idle)
            {
                return null;
            }

            if (VillagerLooks.IsBuilder(villager.Zdo.GetInt(Keys.VillagerSeed)))
            {
                return "building";
            }

            Profile profile = work.Profile ?? Woodcutter;
            switch (work.Phase)
            {
                case Phase.Collect:
                case Phase.Pick:
                    return "gathering " + (profile == Miner ? "stone" : "wood");
                case Phase.Work:
                    return work.Target != null && profile.IsPartial(work.Target) ? profile.PartialActivity : profile.Activity;
                default:
                    return "heading out to work";
            }
        }

        /// <summary>Easiest work first: drops, then loose pickables, then half-finished work, then something new.</summary>
        private static void StartJob(Villager villager, Work work)
        {
            Profile profile = work.Profile;
            Vector3 position = villager.transform.position;
            Vector3 hearth = villager.Zdo.GetVec3(Keys.VillagerHearth, position);
            work.Collected.Clear();
            work.Skip.Clear();
            work.Swings = 0;
            ResetProgress(work);

            ItemDrop drop = NearestDrop(profile, position, SearchRadius, hearth, work.Skip);
            if (drop != null)
            {
                Begin(work, Phase.Collect, null, drop.transform.position, 45f);
                return;
            }

            Pickable pickable = NearestPickable(profile, position, SearchRadius, hearth);
            if (pickable != null)
            {
                Claimed.Add(pickable.gameObject);
                Begin(work, Phase.Pick, pickable.gameObject, pickable.transform.position, 30f);
                return;
            }

            GameObject partial = FindNearest(position, SearchRadius, hearth, profile.IsPartial, null);
            if (partial != null)
            {
                Claimed.Add(partial);
                Begin(work, Phase.Approach, partial, partial.transform.position, 90f);
                return;
            }

            GameObject source = FindNearest(position, SearchRadius, hearth, profile.IsSource, null);
            if (source != null)
            {
                Claimed.Add(source);
                Begin(work, Phase.Approach, source, source.transform.position, 90f);
            }
        }

        private static void Begin(Work work, Phase phase, GameObject target, Vector3 spot, float seconds)
        {
            work.Phase = phase;
            work.Target = target;
            work.Spot = spot;
            work.Deadline = Time.time + seconds;
            work.Timer = 0.6f;
            ResetProgress(work);
        }

        private static bool UpdateWork(Villager villager, VillagerAI ai, Work work, float dt)
        {
            Profile profile = work.Profile;
            if (Time.time > work.Deadline || work.Swings >= profile.MaxSwingsPerSource)
            {
                BeginCollect(work);
                return true;
            }

            if (work.Target == null)
            {
                // The tree fell or a log split. Keep working what lies around the spot, then collect.
                GameObject next = FindNearest(work.Spot, WorkRange, null, profile.IsPartial, work.Skip);
                if (next == null)
                {
                    BeginCollect(work);
                    return true;
                }

                Claimed.Add(next);
                work.Target = next;
                work.Swings = 0;
                ResetProgress(work);
            }

            Vector3 contact = ContactPoint(work.Target, villager.transform.position);
            if (!InReach(villager, contact))
            {
                work.Phase = Phase.Approach;
                Step step = Approach(villager, ai, work, dt, contact, WorkReach - 0.8f);
                if (step != Step.Stuck)
                {
                    return true;
                }

                // Cannot get next to it. Never hit from a distance: leave this one and look for other work.
                MarkUnreachable(work.Target);
                work.Skip.Add(work.Target);
                Claimed.Remove(work.Target);
                work.Target = null;
                Finish(villager, work, "could not get close enough");
                return false;
            }

            work.Phase = Phase.Work;
            ai.StopMoving();
            Face(villager, ai, contact);
            work.Timer -= dt;
            if (work.Timer <= 0f)
            {
                work.Timer = SwingInterval;
                work.Swings++;
                Hit(villager, work.Target, contact, profile.Pickaxe);
            }

            return true;
        }

        private static bool UpdatePick(Villager villager, VillagerAI ai, Work work, float dt)
        {
            if (Time.time > work.Deadline || work.Target == null)
            {
                BeginCollect(work);
                return true;
            }

            Step step = Approach(villager, ai, work, dt, work.Target.transform.position, 1.4f);
            if (step == Step.Moving)
            {
                return true;
            }

            if (step == Step.Stuck && Utils.DistanceXZ(villager.transform.position, work.Target.transform.position) > 3f)
            {
                MarkUnreachable(work.Target);
                Finish(villager, work, "could not reach a pickable");
                return false;
            }

            ai.StopMoving();
            Face(villager, ai, work.Target.transform.position);
            if (work.Target.TryGetComponent(out Pickable pickable))
            {
                pickable.Interact(villager, false, false);
            }

            Claimed.Remove(work.Target);
            BeginCollect(work);
            work.Deadline = Time.time + 15f;
            return true;
        }

        private static void BeginCollect(Work work)
        {
            if (work.Target != null)
            {
                Claimed.Remove(work.Target);
            }

            work.Phase = Phase.Collect;
            work.Target = null;
            work.Deadline = Time.time + 45f;
            ResetProgress(work);
        }

        private static bool UpdateCollect(Villager villager, VillagerAI ai, Work work, float dt)
        {
            if (Time.time > work.Deadline)
            {
                Finish(villager, work, "ran out of time collecting");
                return false;
            }

            ItemDrop drop = NearestDrop(work.Profile, work.Spot, WorkRange, null, work.Skip);
            if (drop == null)
            {
                Finish(villager, work, null);
                return false;
            }

            if (work.Target != drop.gameObject)
            {
                work.Target = drop.gameObject;
                ResetProgress(work);
            }

            float distance = Utils.DistanceXZ(villager.transform.position, drop.transform.position);
            Step step = distance < 2.5f ? Step.Arrived : Approach(villager, ai, work, dt, drop.transform.position, 1.5f);
            if (step == Step.Moving)
            {
                return true;
            }

            if (step == Step.Stuck && distance > 4f)
            {
                // Wedged somewhere unreachable (under a log, on a ledge). Leave it.
                work.Skip.Add(drop.gameObject);
                return true;
            }

            ai.StopMoving();
            Face(villager, ai, drop.transform.position);
            PickUpAround(work, villager.transform.position, 3.5f);
            return true;
        }

        private static void PickUpAround(Work work, Vector3 center, float radius)
        {
            foreach (Collider collider in Physics.OverlapSphere(center, radius))
            {
                ItemDrop item = collider.GetComponentInParent<ItemDrop>();
                if (item == null || !IsDrop(work.Profile, item))
                {
                    continue;
                }

                ZNetView view = item.GetComponent<ZNetView>();
                if (view == null || !view.IsValid())
                {
                    continue;
                }

                string material = Utils.GetPrefabName(item.gameObject);
                work.Collected.TryGetValue(material, out int amount);
                work.Collected[material] = amount + item.m_itemData.m_stack;
                view.ClaimOwnership();
                ZNetScene.instance.Destroy(item.gameObject);
            }
        }

        /// <summary>
        /// Builders walk to the next piece of the village's construction site and place one piece per hammer swing,
        /// as long as there are materials. With nothing to build (or nothing to build with) they hand back to the
        /// normal AI.
        /// </summary>
        private static bool UpdateBuilder(Villager villager, VillagerAI ai, Work work, float dt)
        {
            if (work.Cooldown > 0f)
            {
                work.Cooldown -= dt;
                return false;
            }

            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid || !ConstructionSite.IsActive(hearth.Zdo) ||
                !ConstructionSite.NextPiecePosition(hearth, out Vector3 piece))
            {
                work.Cooldown = 5f;
                return false;
            }

            if (work.Phase != Phase.Work)
            {
                work.Phase = Phase.Work;
                work.Timer = 1f;
                ResetProgress(work);
            }

            float distance = Utils.DistanceXZ(villager.transform.position, piece);
            if (distance > BuildReach)
            {
                Step step = Approach(villager, ai, work, dt, piece, BuildReach - 0.5f);
                if (step == Step.Moving)
                {
                    return true;
                }

                // Blocked by its own walls or the slope: close enough to keep working from here.
                if (step == Step.Stuck && distance > BuildReach * 2.5f)
                {
                    ResetProgress(work);
                    return true;
                }
            }

            ai.StopMoving();
            Face(villager, ai, piece);
            work.Timer -= dt;
            if (work.Timer > 0f)
            {
                return true;
            }

            work.Timer = BuildInterval;
            SwingAnimation(villager);
            if (ConstructionSite.PlaceNext(hearth, true))
            {
                ConstructionSite.NoteBuilder(villager.VillageId);
                ResetProgress(work);
                return true;
            }

            // Out of materials (or done): rest for a bit and let the gatherers catch up.
            work.Phase = Phase.Idle;
            work.Cooldown = 20f;
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
            var hit = new HitData
            {
                m_point = point,
                m_dir = (point - villager.transform.position).normalized,
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

        private static bool InReach(Villager villager, Vector3 contact)
        {
            Vector3 chest = villager.transform.position + Vector3.up * 1f;
            return Vector3.Distance(chest, contact) <= WorkReach;
        }

        private static void Finish(Villager villager, Work work, string problem)
        {
            if (work.Collected.Count > 0)
            {
                foreach (KeyValuePair<string, int> material in work.Collected)
                {
                    VillageBrain.AddMaterial(villager.VillageId, material.Key, material.Value);
                    VillheimPlugin.Debug($"{villager.VillagerName} brought {material.Value} {Materials.Label(material.Key)} " +
                                         $"to {villager.VillageName}.");
                }
            }
            else if (problem != null)
            {
                VillheimPlugin.Debug($"{villager.VillagerName} gave up: {problem}.");
            }

            if (work.Target != null)
            {
                Claimed.Remove(work.Target);
            }

            work.Phase = Phase.Idle;
            work.Target = null;
            work.Collected.Clear();
            work.Skip.Clear();
            Claimed.RemoveWhere(go => go == null);
            PruneUnreachable();
        }

        private static void Stop(Villager villager)
        {
            if (States.TryGetValue(villager, out Work work) && work.Phase != Phase.Idle)
            {
                Finish(villager, work, "stopped for the night");
            }
        }

        private static bool HasTool(Villager villager, Skills.SkillType skill)
        {
            ItemDrop.ItemData weapon = villager.GetCurrentWeapon();
            return weapon?.m_shared != null && weapon.m_shared.m_skillType == skill;
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

        /// <summary>
        /// Walks toward a point and reports whether the villager got there, is still making progress, or has
        /// stopped getting closer (blocked by the target's own collider, terrain, other villagers).
        /// </summary>
        private static Step Approach(Villager villager, VillagerAI ai, Work work, float dt, Vector3 point, float reach)
        {
            float distance = Utils.DistanceXZ(villager.transform.position, point);
            if (distance <= reach)
            {
                return Step.Arrived;
            }

            if (ai.MoveTo(dt, point, reach, distance > RunDistance))
            {
                return Step.Arrived;
            }

            if (distance < work.BestDistance - 0.3f)
            {
                work.BestDistance = distance;
                work.StuckTimer = 0f;
                return Step.Moving;
            }

            work.StuckTimer += dt;
            return work.StuckTimer > StuckSeconds ? Step.Stuck : Step.Moving;
        }

        private static void ResetProgress(Work work)
        {
            work.BestDistance = float.MaxValue;
            work.StuckTimer = 0f;
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
                if (!match(go) || !Available(go, skip))
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

        private static Pickable NearestPickable(Profile profile, Vector3 from, float radius, Vector3 hearth)
        {
            GameObject go = FindNearest(from, radius, hearth, candidate =>
                candidate.TryGetComponent(out Pickable pickable) && !pickable.GetPicked() &&
                profile.Pickables.Contains(Utils.GetPrefabName(candidate)), null);
            return go != null ? go.GetComponent<Pickable>() : null;
        }

        private static ItemDrop NearestDrop(Profile profile, Vector3 spot, float radius, Vector3? hearth, HashSet<GameObject> skip)
        {
            ItemDrop best = null;
            float bestDistance = float.MaxValue;
            foreach (Collider collider in Physics.OverlapSphere(spot, radius))
            {
                ItemDrop item = collider.GetComponentInParent<ItemDrop>();
                if (item == null || !IsDrop(profile, item) || skip.Contains(item.gameObject))
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

        private static bool IsDrop(Profile profile, ItemDrop item)
        {
            return profile != null && profile.Drops.Contains(Utils.GetPrefabName(item.gameObject));
        }
    }
}
