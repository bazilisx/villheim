using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Keeping the stores sorted (D-016). When the main chest is StorageSortAt full (a share of its slots), one grown
    /// villager at a time walks to it, takes a stack that has a storage chest of its kind with room (food, ore and
    /// "other" before building materials, then the biggest pile), and carries it to that chest. The stack only moves
    /// when he gets there, so nothing is lost if he is called away. A full main chest with nowhere to sort to asks
    /// for one more storage chest (StorageChests.NeedMore). Daytime background work, before free time.
    /// </summary>
    internal static class Sorting
    {
        private enum Step
        {
            None,
            ToMain,
            ToStorage,
        }

        private sealed class State
        {
            public Step Step;
            public string Item;
            public Container Target;
            public float Timer;
            public float Deadline;
            public float NextLook;
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();
        private static readonly Dictionary<int, Villager> Sorters = new Dictionary<int, Villager>();

        public static string Describe(Villager villager) =>
            States.TryGetValue(villager, out State state) && state.Step != Step.None ? "sorting the village stores" : null;

        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            State state = States.GetOrCreateValue(villager);
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (!StorageChests.On || hearth == null || !hearth.IsValid || EnvMan.IsNight())
            {
                Stop(villager, state);
                return false;
            }

            Container main = VillageChest.Find(hearth);
            if (main == null)
            {
                Stop(villager, state);
                return false;
            }

            if (state.Step == Step.None && !Begin(villager, state, hearth, main))
            {
                return false;
            }

            if (Time.time > state.Deadline || !state.Target)
            {
                Stop(villager, state);
                return false;
            }

            if (state.Step == Step.ToMain)
            {
                if (Walker.For(villager).Go(villager, ai, dt, main.transform.position, 1.8f) == WalkResult.Walking)
                {
                    return true;
                }

                ai.StopMoving();
                ai.LookAt(main.transform.position + Vector3.up * 0.5f);
                state.Timer += dt;
                if (state.Timer < dt * 1.5f)
                {
                    Poses.Trigger(villager, "interact");
                }

                if (state.Timer >= 1.5f)
                {
                    state.Step = Step.ToStorage;
                    state.Timer = 0f;
                    Walker.For(villager).Reset();
                }

                return true;
            }

            if (Walker.For(villager).Go(villager, ai, dt, state.Target.transform.position, 1.8f) == WalkResult.Walking)
            {
                return true;
            }

            ai.StopMoving();
            ai.LookAt(state.Target.transform.position + Vector3.up * 0.5f);
            state.Timer += dt;
            if (state.Timer < dt * 1.5f)
            {
                Poses.Trigger(villager, "interact");
                Move(main, state.Target, state.Item);
            }

            if (state.Timer >= 1.2f)
            {
                Stop(villager, state);
            }

            return true;
        }

        private static bool Begin(Villager villager, State state, VillageHearth hearth, Container main)
        {
            if (Time.time < state.NextLook)
            {
                return false;
            }

            state.NextLook = Time.time + Random.Range(10f, 20f);
            if (Childhood.IsChild(villager) || Wanderers.IsWanderer(villager) ||
                (Sorters.TryGetValue(villager.VillageId, out Villager other) && other != null && other != villager && !other.IsDead() &&
                 Describe(other) != null))
            {
                return false;
            }

            Inventory inventory = main.GetInventory();
            float limit = LogicConfig.StorageSortAt != null ? LogicConfig.StorageSortAt.Value : 0.75f;
            if (inventory == null || inventory.SlotsUsedPercentage() < limit * 100f)
            {
                return false;
            }

            List<Container> storage = StorageChests.Of(villager.VillageId).Where(VillageChest.Usable).ToList();
            ItemDrop.ItemData pick = null;
            Container target = null;
            foreach (ItemDrop.ItemData item in inventory.GetAllItems()
                         .OrderBy(i => Materials.Tracked.Contains(i.m_dropPrefab != null ? i.m_dropPrefab.name : "") ? 1 : 0)
                         .ThenByDescending(i => i.m_stack))
            {
                string kind = StorageChests.KindOfItem(item);
                Container into = storage.FirstOrDefault(c => StorageChests.KindOf(c) == kind && c.GetInventory().CanAddItem(item));
                if (into != null && item.m_dropPrefab != null)
                {
                    pick = item;
                    target = into;
                    break;
                }
            }

            if (pick == null)
            {
                if (inventory.GetEmptySlots() == 0)
                {
                    StorageChests.NeedMore(hearth);
                }

                return false;
            }

            state.Step = Step.ToMain;
            state.Item = pick.m_dropPrefab.name;
            state.Target = target;
            state.Timer = 0f;
            state.Deadline = Time.time + 90f;
            Sorters[villager.VillageId] = villager;
            Walker.For(villager).Reset();
            return true;
        }

        /// <summary>Moves one stack of the item from the main chest into the storage chest, if both still allow it.</summary>
        private static void Move(Container main, Container target, string prefab)
        {
            if (!VillageChest.Usable(main) || !VillageChest.Usable(target))
            {
                return;
            }

            ItemDrop.ItemData item = main.GetInventory().GetAllItems()
                .Where(i => i.m_dropPrefab != null && i.m_dropPrefab.name == prefab)
                .OrderByDescending(i => i.m_stack).FirstOrDefault();
            if (item == null || !target.GetInventory().CanAddItem(item))
            {
                return;
            }

            VillageChest.Claim(main);
            VillageChest.Claim(target);
            main.GetInventory().RemoveItem(item);
            if (!target.GetInventory().AddItem(item))
            {
                // Should not happen after CanAddItem; put it back rather than lose it.
                main.GetInventory().AddItem(item);
                return;
            }

            VillheimPlugin.Debug($"Sorted {item.m_stack} {prefab} into the {StorageChests.KindOf(target)} chest.");
        }

        private static void Stop(Villager villager, State state)
        {
            state.Step = Step.None;
            state.Item = null;
            state.Target = null;
            state.Timer = 0f;
            if (Sorters.TryGetValue(villager.VillageId, out Villager sorter) && sorter == villager)
            {
                Sorters.Remove(villager.VillageId);
            }
        }
    }
}
