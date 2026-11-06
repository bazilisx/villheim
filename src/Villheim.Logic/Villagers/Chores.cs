using System.Collections.Generic;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Woodcutting. A woodcutter picks a nearby tree, walks to it and swings at it until it falls, then splits the
    /// logs, picks up the wood and adds it to the village stock. The swings are the axe animation; the damage is
    /// dealt to the tree directly so villagers never hit players or buildings by accident.
    /// Runs only by day, on the client that owns the villager, and hands control back to the normal AI between jobs.
    /// </summary>
    internal static class Chores
    {
        private enum Phase
        {
            Idle,
            ToTree,
            Chop,
            Collect,
        }

        private sealed class Work
        {
            public Phase Phase;
            public GameObject Target;
            public Vector3 Spot;
            public float Timer;
            public float Deadline;
            public float Cooldown = Random.Range(5f, 20f);
            public int Collected;
            public float BestDistance = float.MaxValue;
            public float StuckTimer;
            public readonly HashSet<GameObject> Skip = new HashSet<GameObject>();
        }

        private enum Step
        {
            Moving,
            Arrived,
            Stuck,
        }

        private const float SearchRadius = 30f;
        private const float MaxFromHearth = 55f;
        private const float ReachDistance = 1.6f;
        private const float ChopReach = 2.6f;
        private const float StuckSeconds = 3f;
        private const float SwingInterval = 1.8f;
        private const float WorkRange = 8f;
        private const float RunDistance = 8f;
        private const float BuildReach = 4f;
        private const float BuildInterval = 1.4f;

        private static readonly ConditionalWeakTable<Villager, Work> States = new ConditionalWeakTable<Villager, Work>();
        private static readonly HashSet<GameObject> Claimed = new HashSet<GameObject>();
        private static readonly Dictionary<GameObject, float> Unreachable = new Dictionary<GameObject, float>();
        private static readonly List<Collider> ColliderBuffer = new List<Collider>();
        private static readonly HashSet<string> WoodItems = new HashSet<string> { "Wood", "FineWood", "RoundLog" };

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

            if (!HasAxe(villager))
            {
                return false;
            }

            switch (work.Phase)
            {
                case Phase.Idle:
                    work.Cooldown -= dt;
                    if (work.Cooldown <= 0f)
                    {
                        work.Cooldown = Random.Range(20f, 45f);
                        StartJob(villager, work);
                    }

                    return work.Phase != Phase.Idle;

                case Phase.ToTree:
                    return UpdateWalk(villager, ai, work, dt);

                case Phase.Chop:
                    return UpdateChop(villager, ai, work, dt);

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

            switch (work.Phase)
            {
                case Phase.Collect: return "gathering wood";
                case Phase.Chop: return work.Target != null && work.Target.GetComponent<TreeLog>() ? "splitting logs" : "felling a tree";
                default: return "heading to a tree";
            }
        }

        /// <summary>
        /// Picks the next job, in order: wood already lying on the ground, then felled logs waiting to be split,
        /// and only then a standing tree.
        /// </summary>
        private static void StartJob(Villager villager, Work work)
        {
            Vector3 position = villager.transform.position;
            Vector3 hearth = villager.Zdo.GetVec3(Keys.VillagerHearth, position);
            work.Collected = 0;
            work.Skip.Clear();
            ResetProgress(work);

            ItemDrop drop = NearestWood(position, SearchRadius, hearth, work.Skip);
            if (drop != null)
            {
                work.Spot = drop.transform.position;
                work.Phase = Phase.Collect;
                work.Target = null;
                work.Deadline = Time.time + 45f;
                return;
            }

            GameObject log = FindNearest<TreeLog>(position, SearchRadius, hearth);
            if (log != null)
            {
                Claimed.Add(log);
                work.Target = log;
                work.Spot = log.transform.position;
                work.Phase = Phase.Chop;
                work.Timer = 0.6f;
                work.Deadline = Time.time + 120f;
                return;
            }

            GameObject tree = FindNearest<TreeBase>(position, SearchRadius, hearth);
            if (tree == null)
            {
                return;
            }

            Claimed.Add(tree);
            work.Target = tree;
            work.Spot = tree.transform.position;
            work.Phase = Phase.ToTree;
            work.Deadline = Time.time + 60f;
        }

        /// <summary>
        /// Builders walk to the next piece of the village's construction site and place one piece per hammer swing,
        /// as long as there is wood. With nothing to build (or no wood) they hand back to the normal AI.
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

            if (work.Phase != Phase.Chop)
            {
                work.Phase = Phase.Chop;
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

            // Out of wood (or done): rest for a bit and let the woodcutters catch up.
            work.Phase = Phase.Idle;
            work.Cooldown = 20f;
            return false;
        }

        private static bool UpdateWalk(Villager villager, VillagerAI ai, Work work, float dt)
        {
            if (Time.time > work.Deadline)
            {
                MarkUnreachable(work.Target);
                Finish(villager, work, "could not reach the tree");
                return false;
            }

            if (work.Target == null)
            {
                // Someone else felled it; go pick up what is left.
                BeginCollect(work);
                return true;
            }

            Vector3 contact = ContactPoint(work.Target, villager.transform.position);
            Step step = Approach(villager, ai, work, dt, contact, ReachDistance);
            float distance = Utils.DistanceXZ(villager.transform.position, contact);
            if (step == Step.Arrived || (step == Step.Stuck && distance < ChopReach + 1.5f))
            {
                ai.StopMoving();
                work.Phase = Phase.Chop;
                work.Timer = 0.6f;
                work.Deadline = Time.time + 120f;
                ResetProgress(work);
            }
            else if (step == Step.Stuck)
            {
                MarkUnreachable(work.Target);
                Finish(villager, work, "could not reach the tree");
                return false;
            }

            return true;
        }

        private static bool UpdateChop(Villager villager, VillagerAI ai, Work work, float dt)
        {
            if (Time.time > work.Deadline)
            {
                BeginCollect(work);
                return true;
            }

            if (work.Target == null)
            {
                // The tree fell or a log split. Keep chopping the logs lying around the spot, then collect.
                GameObject log = FindNearest<TreeLog>(work.Spot, WorkRange, null, work.Skip);
                if (log == null)
                {
                    BeginCollect(work);
                    return true;
                }

                Claimed.Add(log);
                work.Target = log;
                ResetProgress(work);
            }

            Vector3 contact = ContactPoint(work.Target, villager.transform.position);
            float distance = Utils.DistanceXZ(villager.transform.position, contact);
            if (distance > ChopReach)
            {
                Step step = Approach(villager, ai, work, dt, contact, ReachDistance);
                if (step == Step.Stuck)
                {
                    if (distance > ChopReach + 2f)
                    {
                        // Cannot get to this one; leave it and move on to the next log.
                        work.Skip.Add(work.Target);
                        Claimed.Remove(work.Target);
                        work.Target = null;
                        return true;
                    }
                }
                else
                {
                    return true;
                }
            }

            ai.StopMoving();
            Face(villager, ai, contact);
            work.Timer -= dt;
            if (work.Timer <= 0f)
            {
                work.Timer = SwingInterval;
                Swing(villager, work.Target, contact);
            }

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

            ItemDrop drop = NearestWood(work.Spot, work.Skip);
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
            Step step = distance < 3f ? Step.Arrived : Approach(villager, ai, work, dt, drop.transform.position, 1.5f);
            if (step == Step.Moving)
            {
                return true;
            }

            if (step == Step.Stuck && distance > 6f)
            {
                // Wedged somewhere unreachable (under a log, on a slope). Leave it.
                work.Skip.Add(drop.gameObject);
                return true;
            }

            ai.StopMoving();
            Face(villager, ai, drop.transform.position);
            PickUpAround(villager.transform.position, 4.5f, work);
            PickUpAround(drop.transform.position, 2f, work);
            return true;
        }

        private static void PickUpAround(Vector3 center, float radius, Work work)
        {
            foreach (Collider collider in Physics.OverlapSphere(center, radius))
            {
                ItemDrop item = collider.GetComponentInParent<ItemDrop>();
                if (item == null || !IsWood(item))
                {
                    continue;
                }

                ZNetView view = item.GetComponent<ZNetView>();
                if (view == null || !view.IsValid())
                {
                    continue;
                }

                work.Collected += item.m_itemData.m_stack;
                view.ClaimOwnership();
                ZNetScene.instance.Destroy(item.gameObject);
            }
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

        /// <summary>The point on the target's colliders closest to the villager. Logs are long, so their center is useless.</summary>
        private static Vector3 ContactPoint(GameObject target, Vector3 from)
        {
            Vector3 best = target.transform.position;
            float bestDistance = float.MaxValue;
            ColliderBuffer.Clear();
            target.GetComponentsInChildren(false, ColliderBuffer);
            foreach (Collider collider in ColliderBuffer)
            {
                if (collider == null || collider.isTrigger || !collider.enabled)
                {
                    continue;
                }

                Vector3 point = collider.ClosestPoint(from);
                float distance = (point - from).sqrMagnitude;
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

        private static void Swing(Villager villager, GameObject target, Vector3 point)
        {
            SwingAnimation(villager);
            ItemDrop.ItemData weapon = villager.GetCurrentWeapon();

            IDestructible destructible = target.GetComponent<IDestructible>();
            if (destructible == null)
            {
                return;
            }

            float chop = weapon?.m_shared?.m_damages.m_chop ?? 10f;
            var hit = new HitData
            {
                m_point = point + Vector3.up,
                m_dir = (point - villager.transform.position).normalized,
                m_toolTier = 4,
                m_attacker = villager.GetZDOID(),
            };
            hit.m_damage.m_chop = Mathf.Max(chop, 15f);
            destructible.Damage(hit);
        }

        private static void Finish(Villager villager, Work work, string problem)
        {
            if (work.Collected > 0)
            {
                VillageBrain.AddWood(villager.VillageId, work.Collected);
                VillheimPlugin.Debug($"{villager.VillagerName} brought {work.Collected} wood to {villager.VillageName}.");
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
            work.Collected = 0;
            Claimed.RemoveWhere(go => go == null);
            work.Skip.Clear();
            if (Unreachable.Count > 50)
            {
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
        }

        private static void Stop(Villager villager)
        {
            if (States.TryGetValue(villager, out Work work) && work.Phase != Phase.Idle)
            {
                Finish(villager, work, "stopped for the night");
            }
        }

        private static bool HasAxe(Villager villager)
        {
            ItemDrop.ItemData weapon = villager.GetCurrentWeapon();
            return weapon?.m_shared != null && weapon.m_shared.m_skillType == Skills.SkillType.Axes;
        }

        private static GameObject FindNearest<T>(Vector3 from, float radius, Vector3? hearth, HashSet<GameObject> skip = null)
            where T : Component
        {
            GameObject best = null;
            float bestDistance = float.MaxValue;
            foreach (Collider collider in Physics.OverlapSphere(from, radius))
            {
                T component = collider.GetComponentInParent<T>();
                if (component == null)
                {
                    continue;
                }

                GameObject go = component.gameObject;
                if (Claimed.Contains(go) || (skip != null && skip.Contains(go)) ||
                    (Unreachable.TryGetValue(go, out float until) && until > Time.time))
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

        private static ItemDrop NearestWood(Vector3 spot, HashSet<GameObject> skip)
        {
            return NearestWood(spot, WorkRange, null, skip);
        }

        private static ItemDrop NearestWood(Vector3 spot, float radius, Vector3? hearth, HashSet<GameObject> skip)
        {
            ItemDrop best = null;
            float bestDistance = float.MaxValue;
            foreach (Collider collider in Physics.OverlapSphere(spot, radius))
            {
                ItemDrop item = collider.GetComponentInParent<ItemDrop>();
                if (item == null || !IsWood(item) || skip.Contains(item.gameObject))
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

        private static bool IsWood(ItemDrop item)
        {
            return WoodItems.Contains(Utils.GetPrefabName(item.gameObject));
        }
    }
}
