using System.Runtime.CompilerServices;
using UnityEngine;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Tools and weapons are only in hand for the work that needs them, or on the way to it (T-58: a woman tended the
    /// fire with a pickaxe on her shoulder). Twice a second, after the brain has run him, anything in his hands is put
    /// away unless what he is doing uses it: felling, mining and building (not carrying the load home), mending,
    /// smithing, laying paths, farming, hunting, making arrows, going with a player, or a fight. The night watch keeps
    /// his torch. The work takes the tool out again when it starts.
    /// </summary>
    internal static class HandItems
    {
        private sealed class State
        {
            public float Next;
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();

        /// <summary>
        /// What he may have in hand for what he is doing: <c>true</c> with <paramref name="tool"/> null means anything
        /// (a fight, a hunt, going with a player); with a tool, only that tool; <c>false</c> means nothing.
        /// </summary>
        private static bool Uses(Villager villager, Status.Doer doer, out VillagerLooks.Tool? tool)
        {
            tool = null;
            switch (doer)
            {
                case Status.Doer.Chores:
                    // The tool of the chore on the way to it and at it; nothing while carrying the load home or
                    // picking things up.
                    tool = Chores.ToolInUse(villager);
                    return tool.HasValue;
                case Status.Doer.Elder:
                    tool = ElderWork.ToolInUse(villager);
                    return tool.HasValue;
                case Status.Doer.Repair:
                case Status.Doer.Smith:
                case Status.Doer.Fletch:
                case Status.Doer.Trophy:
                    tool = VillagerLooks.Tool.Hammer;
                    return true;
                case Status.Doer.Path:
                case Status.Doer.Farm:
                    tool = VillagerLooks.Tool.Hoe;
                    return true;
                case Status.Doer.Hunt:
                case Status.Doer.Test:
                case Status.Doer.Escort:
                case Status.Doer.Fight:
                    return true;
                default:
                    return false;
            }
        }

        public static void Tidy(Villager villager, Status.Doer doer)
        {
            State state = States.GetOrCreateValue(villager);
            if (Time.time < state.Next)
            {
                return;
            }

            state.Next = Time.time + 0.5f;
            if (Uses(villager, doer, out VillagerLooks.Tool? tool))
            {
                // Another tool than the work's (the pickaxe kept from mining on the way to build) is put away; the
                // work takes its own out when it needs it.
                ItemDrop.ItemData right = villager.GetRightItem();
                if (tool.HasValue && right != null && right.m_shared.m_itemType != ItemDrop.ItemData.ItemType.Torch &&
                    !VillagerLooks.IsHolding(villager, tool.Value))
                {
                    PutAway(villager);
                }

                return;
            }

            PutAway(villager);
        }

        /// <summary>
        /// Both hands emptied, the torch of the night watch kept. Nothing is left on his back either: the game's
        /// "hide hand items" kept a hidden tool showing on the back, which is how nearly everyone came to carry a
        /// pickaxe over the shoulder everywhere (T-108).
        /// </summary>
        public static void PutAway(Villager villager)
        {
            ItemDrop.ItemData right = villager.GetRightItem();
            if (right != null && right.m_shared.m_itemType != ItemDrop.ItemData.ItemType.Torch)
            {
                villager.UnequipItem(right, false);
            }

            ItemDrop.ItemData left = villager.GetLeftItem();
            if (left != null && left.m_shared.m_itemType != ItemDrop.ItemData.ItemType.Torch)
            {
                villager.UnequipItem(left, false);
            }

            if (villager.m_hiddenRightItem != null || villager.m_hiddenLeftItem != null)
            {
                villager.m_hiddenRightItem = null;
                villager.m_hiddenLeftItem = null;
                villager.SetupVisEquipment(villager.m_visEquipment, false);
            }
        }
    }
}
