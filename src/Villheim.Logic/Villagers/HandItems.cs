using System.Runtime.CompilerServices;
using UnityEngine;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Tools and weapons are only in hand for the work that needs them, or on the way to it (T-58: a woman tended the
    /// fire with a pickaxe on her shoulder). Once a second, after the brain has run him, anything in his hands is put
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

        private static bool Uses(Villager villager, Status.Doer doer)
        {
            switch (doer)
            {
                case Status.Doer.Chores:
                    // Walking the load back to camp needs nothing in hand.
                    string doing = Chores.Describe(villager) ?? "";
                    return !doing.Contains("carrying");
                case Status.Doer.Repair:
                case Status.Doer.Smith:
                case Status.Doer.Path:
                case Status.Doer.Farm:
                case Status.Doer.Hunt:
                case Status.Doer.Fletch:
                case Status.Doer.Trophy:
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

            state.Next = Time.time + 1f;
            if (Uses(villager, doer))
            {
                return;
            }

            ItemDrop.ItemData right = villager.GetRightItem();
            if (right != null && right.m_shared.m_itemType != ItemDrop.ItemData.ItemType.Torch)
            {
                villager.UnequipItem(right, false);
            }

            ItemDrop.ItemData left = villager.GetLeftItem();
            if (left != null && (left.m_shared.m_itemType == ItemDrop.ItemData.ItemType.Shield ||
                                 left.m_shared.m_itemType == ItemDrop.ItemData.ItemType.Bow))
            {
                villager.UnequipItem(left, false);
            }
        }
    }
}
