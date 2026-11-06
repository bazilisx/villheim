using System.Runtime.CompilerServices;
using HarmonyLib;
using UnityEngine;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// The villager's body: who it bumps into and how it moves.
    ///
    /// - Villagers pass through players and each other. Unity forgets an ignored pair when a collider is switched off
    ///   and on, so the pairs are set again every two seconds. Without this a villager shoves a player out of the way
    ///   and villagers jam in doorways.
    /// - Gestures and the fake swings used for work never slide the body: animation-driven movement is dropped for
    ///   villagers outside a real attack (see <see cref="RootMotionPatch"/>).
    /// </summary>
    internal static class Body
    {
        private const float RefreshSeconds = 2f;
        private const float Range = 20f;

        private sealed class State
        {
            public float NextRefresh;
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();

        public static void Update(Villager villager)
        {
            State state = States.GetOrCreateValue(villager);
            if (Time.time < state.NextRefresh)
            {
                return;
            }

            state.NextRefresh = Time.time + RefreshSeconds + Random.Range(0f, 0.5f);
            Collider mine = villager.m_collider;
            if (mine == null)
            {
                return;
            }

            Vector3 position = villager.transform.position;
            foreach (Character other in Character.GetAllCharacters())
            {
                if (other == null || other == villager || !(other is Player || other is Villager) || other.m_collider == null)
                {
                    continue;
                }

                if (Utils.DistanceXZ(position, other.transform.position) < Range)
                {
                    Physics.IgnoreCollision(mine, other.m_collider, true);
                }
            }
        }

        /// <summary>Drops animation-driven movement for villagers unless they are in a real attack (a fight).</summary>
        [HarmonyPatch(typeof(Character), nameof(Character.AddRootMotion))]
        internal static class RootMotionPatch
        {
            private static bool Prefix(Character __instance)
            {
                return !(__instance is Villager villager) || villager.m_currentAttack != null;
            }
        }
    }
}
