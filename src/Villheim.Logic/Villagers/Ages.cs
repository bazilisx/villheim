using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Prefabs;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// What age changes about a villager's day (T-29).
    ///
    /// - Elders move slower (ElderSpeed of a grown villager's walk and run) and keep to chores inside the village:
    ///   cooking, sorting, the farm, the hearth, mending if they are the builder. They leave hunting, foraging and
    ///   planting out past the edge to the young.
    /// - Children take no jobs at all and play instead (ChildPlay); the same check keeps them out of work outside.
    /// </summary>
    internal static class Ages
    {
        private sealed class State
        {
            public float Next;
            public float Factor = -1f;
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();

        /// <summary>True for a villager who does no work out past the village (elders and children).</summary>
        public static bool OutOfVillageWork(Villager villager) => Childhood.IsChild(villager) || Elders.IsElder(villager);

        /// <summary>Every few seconds: an elder's pace.</summary>
        public static void Update(Villager villager)
        {
            State state = States.GetOrCreateValue(villager);
            if (Time.time < state.Next)
            {
                return;
            }

            state.Next = Time.time + 5f + Random.Range(0f, 1f);
            float factor = Elders.IsElder(villager) ? Mathf.Clamp(LogicConfig.ElderSpeed?.Value ?? 0.75f, 0.3f, 1.5f) : 1f;
            if (Mathf.Approximately(factor, state.Factor))
            {
                return;
            }

            Villager template = VillagerPrefab.Prefab != null ? VillagerPrefab.Prefab.GetComponent<Villager>() : null;
            if (template == null)
            {
                return;
            }

            state.Factor = factor;
            villager.m_walkSpeed = template.m_walkSpeed * factor;
            villager.m_speed = template.m_speed * factor;
            villager.m_runSpeed = template.m_runSpeed * factor;
        }
    }
}
