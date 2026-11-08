using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Foraging, the Meadows stand-in for Millenaire's farms (Meadows villages have no seeds to plant): by day, when the
    /// village chest holds little food, one carer at a time picks berries and mushrooms near the village (anything a
    /// bush or patch gives that can be eaten) and brings them to the chest.
    /// </summary>
    internal static class Foraging
    {
        private const float SearchFromHearth = 45f;
        private const int EnoughFood = 6;
        private const int PerTrip = 8;

        private sealed class State
        {
            public bool Active;
            public Pickable Target;
            public float Deadline;
            public float NextLook;
            public float PickedAt;
            public bool Delivering;
            public readonly Dictionary<string, int> Carrying = new Dictionary<string, int>();
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();
        private static readonly Dictionary<int, Villager> Foragers = new Dictionary<int, Villager>();

        public static string Describe(Villager villager) =>
            States.TryGetValue(villager, out State s) && s.Active ? (s.Delivering ? "carrying berries to the chest" : "foraging") : null;

        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            State state = States.GetOrCreateValue(villager);
            if (!state.Active && !Begin(villager, state))
            {
                return false;
            }

            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid || EnvMan.IsNight())
            {
                End(villager, state);
                return false;
            }

            if (state.Delivering)
            {
                Container chest = VillageChest.Find(hearth);
                if (chest == null)
                {
                    End(villager, state);
                    return false;
                }

                if (Walker.For(villager).Go(villager, ai, dt, chest.transform.position, 1.6f, true) == WalkResult.Walking && Time.time < state.Deadline)
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

                VillheimPlugin.Debug($"{villager.VillagerName} brought back {state.Carrying.Values.Sum()} berries and mushrooms.");
                End(villager, state);
                return false;
            }

            if (state.Target == null || state.Target.GetPicked() || Time.time > state.Deadline)
            {
                state.Target = state.Carrying.Values.Sum() < PerTrip ? Nearest(hearth.transform.position, villager.transform.position) : null;
                state.Deadline = Time.time + 25f;
                Walker.For(villager).Reset();
                if (state.Target == null)
                {
                    state.Delivering = state.Carrying.Count > 0;
                    state.Deadline = Time.time + 90f;
                    if (!state.Delivering)
                    {
                        End(villager, state);
                        return false;
                    }

                    return true;
                }
            }

            Vector3 at = state.Target.transform.position;
            if (Walker.For(villager).Go(villager, ai, dt, at, 1.3f) == WalkResult.Walking)
            {
                return true;
            }

            ai.StopMoving();
            ai.LookAt(at);
            if (state.PickedAt <= 0f)
            {
                Poses.Trigger(villager, "interact");
                state.Target.Interact(villager, false, false);
                state.PickedAt = Time.time;
                return true;
            }

            if (Time.time - state.PickedAt < 0.6f)
            {
                return true;
            }

            // Gather what the bush dropped.
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

            state.PickedAt = 0f;
            state.Target = null;
            return true;
        }

        private static bool Begin(Villager villager, State state)
        {
            if (EnvMan.IsNight() || Time.time < state.NextLook || Roles.BackgroundOf(villager) != Roles.Background.Carer ||
                Village.Calendar.FieldsRest)
            {
                return false;
            }

            state.NextLook = Time.time + Random.Range(25f, 45f);
            if (Foragers.TryGetValue(villager.VillageId, out Villager other) && other != null && other != villager && !other.IsDead() &&
                Describe(other) != null)
            {
                return false;
            }

            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            Container chest = hearth != null && hearth.IsValid ? VillageChest.Find(hearth) : null;
            int enough = (new VillageState(hearth.Zdo).Type == "farming" ? EnoughFood * 2 : EnoughFood) * Village.Calendar.FoodFactor();
            if (chest == null || chest.GetInventory().GetAllItems().Where(i => i.m_shared.m_food > 0f).Sum(i => i.m_stack) >= enough ||
                Nearest(hearth.transform.position, villager.transform.position) == null)
            {
                return false;
            }

            Foragers[villager.VillageId] = villager;
            state.Active = true;
            state.Delivering = false;
            state.Carrying.Clear();
            VillheimPlugin.Debug($"{villager.VillagerName} goes foraging.");
            return true;
        }

        private static void End(Villager villager, State state)
        {
            state.Active = false;
            state.Delivering = false;
            state.Target = null;
            state.Carrying.Clear();
            if (Foragers.TryGetValue(villager.VillageId, out Villager forager) && forager == villager)
            {
                Foragers.Remove(villager.VillageId);
            }
        }

        private static Pickable Nearest(Vector3 hearth, Vector3 from)
        {
            Pickable best = null;
            float bestDistance = float.MaxValue;
            foreach (Collider collider in Physics.OverlapSphere(hearth, SearchFromHearth))
            {
                Pickable pickable = collider.GetComponentInParent<Pickable>();
                if (pickable == null || pickable.GetPicked() || pickable.m_itemPrefab == null)
                {
                    continue;
                }

                ItemDrop drop = pickable.m_itemPrefab.GetComponent<ItemDrop>();
                if (drop == null || drop.m_itemData.m_shared.m_food <= 0f)
                {
                    continue;
                }

                float distance = Vector3.Distance(pickable.transform.position, from);
                if (distance < bestDistance)
                {
                    best = pickable;
                    bestDistance = distance;
                }
            }

            return best;
        }
    }
}
