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
        }

        private const float SearchRadius = 30f;
        private const float MaxFromHearth = 55f;
        private const float ReachDistance = 1.7f;
        private const float SwingInterval = 2f;
        private const float WorkRange = 10f;

        private static readonly ConditionalWeakTable<Villager, Work> States = new ConditionalWeakTable<Villager, Work>();
        private static readonly HashSet<GameObject> Claimed = new HashSet<GameObject>();
        private static readonly HashSet<string> WoodItems = new HashSet<string> { "Wood", "FineWood", "RoundLog" };

        /// <summary>Returns true while a chore is driving the villager this update.</summary>
        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            if (!VillheimConfig.VillagersChopTrees.Value || EnvMan.IsNight() || villager.IsDead())
            {
                Stop(villager);
                return false;
            }

            if (!VillagerLooks.IsWoodcutter(villager.Zdo.GetInt(Keys.VillagerSeed)) || !HasAxe(villager))
            {
                return false;
            }

            Work work = States.GetOrCreateValue(villager);
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
            return States.TryGetValue(villager, out Work work) && work.Phase != Phase.Idle ? "felling trees" : null;
        }

        private static void StartJob(Villager villager, Work work)
        {
            Vector3 hearth = villager.Zdo.GetVec3(Keys.VillagerHearth, villager.transform.position);
            GameObject tree = FindNearest<TreeBase>(villager.transform.position, SearchRadius, hearth);
            if (tree == null)
            {
                return;
            }

            Claimed.Add(tree);
            work.Target = tree;
            work.Spot = tree.transform.position;
            work.Phase = Phase.ToTree;
            work.Deadline = Time.time + 45f;
            work.Collected = 0;
        }

        private static bool UpdateWalk(Villager villager, VillagerAI ai, Work work, float dt)
        {
            if (Time.time > work.Deadline)
            {
                Finish(villager, work, "could not reach the tree");
                return false;
            }

            if (work.Target == null)
            {
                // Someone else felled it; go pick up what is left.
                BeginCollect(work);
                return true;
            }

            if (ai.MoveTo(dt, work.Target.transform.position, ReachDistance, false))
            {
                ai.StopMoving();
                work.Phase = Phase.Chop;
                work.Timer = 0.5f;
                work.Deadline = Time.time + 120f;
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
                // The tree fell or a log split. Keep chopping whatever logs lie around the spot, then collect.
                GameObject log = FindNearest<TreeLog>(work.Spot, WorkRange, null);
                if (log == null)
                {
                    BeginCollect(work);
                    return true;
                }

                Claimed.Add(log);
                work.Target = log;
            }

            Vector3 target = work.Target.transform.position;
            if (Utils.DistanceXZ(villager.transform.position, target) > ReachDistance + 1.5f)
            {
                ai.MoveTo(dt, target, ReachDistance, false);
                return true;
            }

            ai.StopMoving();
            ai.LookAt(target);
            work.Timer -= dt;
            if (work.Timer <= 0f)
            {
                work.Timer = SwingInterval;
                Swing(villager, work.Target, target);
            }

            return true;
        }

        private static void BeginCollect(Work work)
        {
            work.Phase = Phase.Collect;
            work.Target = null;
            work.Deadline = Time.time + 40f;
        }

        private static bool UpdateCollect(Villager villager, VillagerAI ai, Work work, float dt)
        {
            if (Time.time > work.Deadline)
            {
                Finish(villager, work, "ran out of time collecting");
                return false;
            }

            ItemDrop drop = NearestWood(work.Spot);
            if (drop == null)
            {
                Finish(villager, work, null);
                return false;
            }

            if (!ai.MoveTo(dt, drop.transform.position, 1.2f, false))
            {
                return true;
            }

            // Pick up everything within reach.
            foreach (Collider collider in Physics.OverlapSphere(villager.transform.position, 2.5f))
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

            return true;
        }

        private static void Swing(Villager villager, GameObject target, Vector3 point)
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

        private static GameObject FindNearest<T>(Vector3 from, float radius, Vector3? hearth) where T : Component
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
                if (Claimed.Contains(go))
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

        private static ItemDrop NearestWood(Vector3 spot)
        {
            ItemDrop best = null;
            float bestDistance = float.MaxValue;
            foreach (Collider collider in Physics.OverlapSphere(spot, WorkRange))
            {
                ItemDrop item = collider.GetComponentInParent<ItemDrop>();
                if (item == null || !IsWood(item))
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
