using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// The farmer's day (a carer's, while the village has no farmer): plant the farm's rows one at a time with the hoe,
    /// harvest what is ripe into the village chest when it is low on food, and now and then go and see to the animals.
    /// One farm worker per village at a time. No feeding and no breeding: the herd grows by the village's schedule.
    /// </summary>
    internal static class Farming
    {
        private const int EnoughFood = 12;

        private enum Job
        {
            None,
            Plant,
            Harvest,
            Deliver,
            Tend,
        }

        private sealed class State
        {
            public Job Job;
            public Vector3 Spot;
            public string Prefab;
            public Pickable Target;
            public Character Animal;
            public float Timer;
            public float Deadline;
            public float NextLook;
            public readonly Dictionary<string, int> Carrying = new Dictionary<string, int>();
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();
        private static readonly Dictionary<int, Villager> Workers = new Dictionary<int, Villager>();

        public static string Describe(Villager villager)
        {
            if (!States.TryGetValue(villager, out State state))
            {
                return null;
            }

            switch (state.Job)
            {
                case Job.Plant: return "planting the farm";
                case Job.Harvest: return "harvesting the farm";
                case Job.Deliver: return "carrying the harvest to the chest";
                case Job.Tend: return "seeing to the animals";
                default: return null;
            }
        }

        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            State state = States.GetOrCreateValue(villager);
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid || EnvMan.IsNight())
            {
                Stop(villager, state);
                return false;
            }

            if (state.Job == Job.None && !Begin(villager, state, hearth))
            {
                return false;
            }

            if (Time.time > state.Deadline)
            {
                Stop(villager, state);
                return false;
            }

            switch (state.Job)
            {
                case Job.Plant: return Plant(villager, ai, dt, state, hearth);
                case Job.Harvest: return Harvest(villager, ai, dt, state, hearth);
                case Job.Deliver: return Deliver(villager, ai, dt, state, hearth);
                case Job.Tend: return Tend(villager, ai, dt, state);
            }

            return false;
        }

        private static bool Begin(Villager villager, State state, VillageHearth hearth)
        {
            if (Time.time < state.NextLook)
            {
                return false;
            }

            state.NextLook = Time.time + Random.Range(8f, 15f);
            bool farmer = Roles.TradeOf(villager) == Roles.Trade.Farmer;
            bool stands = !Roles.HasTrade(villager.VillageId, Roles.Trade.Farmer) && Roles.BackgroundOf(villager) == Roles.Background.Carer;
            if ((!farmer && !stands) || (Workers.TryGetValue(villager.VillageId, out Villager other) && other != null && other != villager &&
                                         !other.IsDead() && Describe(other) != null))
            {
                return false;
            }

            var village = new VillageState(hearth.Zdo);
            if (!Farms.FarmPlots(village).Any())
            {
                return false;
            }

            if (Farms.NextPlanting(hearth, out Vector3 spot, out string prefab))
            {
                Start(villager, state, Job.Plant, 40f);
                state.Spot = spot;
                state.Prefab = prefab;
                return true;
            }

            Container chest = VillageChest.Find(hearth);
            int food = chest != null ? chest.GetInventory().GetAllItems().Where(i => i.m_shared.m_food > 0f).Sum(i => i.m_stack) : EnoughFood;
            if (food < EnoughFood && Farms.Ripe(hearth).Count > 0)
            {
                Start(villager, state, Job.Harvest, 90f);
                return true;
            }

            if (farmer && Random.value < 0.4f)
            {
                Character animal = Farms.FarmPlots(village).SelectMany(f => Farms.Herd(hearth, f)).OrderBy(_ => Random.value).FirstOrDefault();
                if (animal != null)
                {
                    Start(villager, state, Job.Tend, 30f);
                    state.Animal = animal;
                    return true;
                }
            }

            return false;
        }

        private static void Start(Villager villager, State state, Job job, float seconds)
        {
            Workers[villager.VillageId] = villager;
            state.Job = job;
            state.Deadline = Time.time + seconds;
            state.Timer = 0f;
            state.Target = null;
            Walker.For(villager).Reset();
        }

        private static bool Plant(Villager villager, VillagerAI ai, float dt, State state, VillageHearth hearth)
        {
            if (Walker.For(villager).Go(villager, ai, dt, state.Spot, 1.2f) == WalkResult.Walking)
            {
                return true;
            }

            ai.StopMoving();
            ai.LookAt(state.Spot);
            VillagerLooks.Hold(villager, VillagerLooks.Tool.Hoe);
            state.Timer += dt;
            if (state.Timer % 1.2f < dt)
            {
                Chores.ToolAnimation(villager, VillagerLooks.Tool.Hoe);
            }

            if (state.Timer < 2.5f)
            {
                return true;
            }

            Farms.Plant(hearth, state.Spot, state.Prefab);
            Stop(villager, state);
            return false;
        }

        private static bool Harvest(Villager villager, VillagerAI ai, float dt, State state, VillageHearth hearth)
        {
            if (state.Target == null || state.Target.GetPicked())
            {
                state.Target = state.Carrying.Values.Sum() < 10
                    ? Farms.Ripe(hearth).OrderBy(p => Vector3.Distance(p.transform.position, villager.transform.position)).FirstOrDefault()
                    : null;
                state.Timer = 0f;
                Walker.For(villager).Reset();
                if (state.Target == null)
                {
                    state.Job = state.Carrying.Count > 0 ? Job.Deliver : Job.None;
                    state.Deadline = Time.time + 60f;
                    return state.Job != Job.None;
                }
            }

            Vector3 at = state.Target.transform.position;
            if (Walker.For(villager).Go(villager, ai, dt, at, 1.2f) == WalkResult.Walking)
            {
                return true;
            }

            ai.StopMoving();
            ai.LookAt(at);
            if (state.Timer <= 0f)
            {
                Poses.Trigger(villager, "interact");
                state.Target.Interact(villager, false, false);
                state.Timer = 0.01f;
                return true;
            }

            state.Timer += dt;
            if (state.Timer < 0.6f)
            {
                return true;
            }

            foreach (Collider collider in Physics.OverlapSphere(at, 2.5f))
            {
                ItemDrop item = collider.GetComponentInParent<ItemDrop>();
                if (item == null || item.m_nview == null || !item.m_nview.IsValid() || item.m_itemData.m_shared.m_food <= 0f)
                {
                    continue;
                }

                string name = Utils.GetPrefabName(item.gameObject);
                state.Carrying.TryGetValue(name, out int count);
                state.Carrying[name] = count + item.m_itemData.m_stack;
                item.m_nview.ClaimOwnership();
                ZNetScene.instance.Destroy(item.gameObject);
            }

            state.Target = null;
            return true;
        }

        private static bool Deliver(Villager villager, VillagerAI ai, float dt, State state, VillageHearth hearth)
        {
            Container chest = VillageChest.Find(hearth);
            if (chest == null)
            {
                Stop(villager, state);
                return false;
            }

            if (Walker.For(villager).Go(villager, ai, dt, chest.transform.position, 1.6f) == WalkResult.Walking)
            {
                return true;
            }

            Poses.Trigger(villager, "interact");
            foreach (KeyValuePair<string, int> carried in state.Carrying)
            {
                GameObject prefab = ObjectDB.instance.GetItemPrefab(carried.Key);
                if (prefab != null)
                {
                    chest.GetInventory().AddItem(prefab, carried.Value);
                }
            }

            VillheimPlugin.Debug($"{villager.VillagerName} brought in the harvest ({state.Carrying.Values.Sum()}).");
            Stop(villager, state);
            return false;
        }

        private static bool Tend(Villager villager, VillagerAI ai, float dt, State state)
        {
            if (state.Animal == null || state.Animal.IsDead())
            {
                Stop(villager, state);
                return false;
            }

            if (Walker.For(villager).Go(villager, ai, dt, state.Animal.transform.position, 1.6f) == WalkResult.Walking)
            {
                return true;
            }

            ai.StopMoving();
            ai.LookAt(state.Animal.GetCenterPoint());
            state.Timer += dt;
            if (state.Timer < dt * 1.5f)
            {
                Poses.Trigger(villager, "interact");
            }

            if (state.Timer < 4f)
            {
                return true;
            }

            Stop(villager, state);
            return false;
        }

        private static void Stop(Villager villager, State state)
        {
            state.Job = Job.None;
            state.Target = null;
            state.Animal = null;
            state.Carrying.Clear();
            if (Workers.TryGetValue(villager.VillageId, out Villager worker) && worker == villager)
            {
                Workers.Remove(villager.VillageId);
            }
        }
    }
}
