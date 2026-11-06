using System.Collections.Generic;
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
    /// - A villager on a seat or in a bed is held there every physics step (see <see cref="PinTo"/>).
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

        private sealed class Pin
        {
            public Transform Point;
            public Collider[] Ignored;
        }

        private static readonly Dictionary<Villager, Pin> Pins = new Dictionary<Villager, Pin>();

        /// <summary>
        /// Holds a villager on a seat or in a bed every physics step, as the NPCS mod and the game's own attach do,
        /// and stops the seat's colliders from pushing him. Held only at each brain tick, the physics pushed a seated
        /// villager up out of the bench 4 cm a step and the next tick pulled him down again: a trace on 2026-11-06
        /// showed that sawtooth, seen as shaking while sitting.
        /// </summary>
        public static void PinTo(Villager villager, Transform point, GameObject furniture)
        {
            if (Pins.TryGetValue(villager, out Pin pin) && pin.Point == point)
            {
                return;
            }

            Unpin(villager);
            Collider[] ignored = furniture != null ? furniture.GetComponentsInChildren<Collider>() : new Collider[0];
            if (villager.m_collider != null)
            {
                foreach (Collider collider in ignored)
                {
                    if (collider != null)
                    {
                        Physics.IgnoreCollision(villager.m_collider, collider, true);
                    }
                }
            }

            Pins[villager] = new Pin { Point = point, Ignored = ignored };
            Hold(villager, point);
        }

        public static void Unpin(Villager villager)
        {
            if (!Pins.TryGetValue(villager, out Pin pin))
            {
                return;
            }

            Pins.Remove(villager);
            if (villager != null && villager.m_body != null)
            {
                villager.m_body.useGravity = true;
            }

            if (villager != null && villager.m_collider != null)
            {
                foreach (Collider collider in pin.Ignored)
                {
                    if (collider != null)
                    {
                        Physics.IgnoreCollision(villager.m_collider, collider, false);
                    }
                }
            }
        }

        private static void Hold(Villager villager, Transform point)
        {
            Rigidbody body = villager.m_body;
            if (body != null)
            {
                body.useGravity = false;
                body.velocity = Vector3.zero;
                body.angularVelocity = Vector3.zero;
                body.position = point.position;
                body.rotation = point.rotation;
            }

            villager.transform.position = point.position;
            villager.transform.rotation = point.rotation;
        }

        [HarmonyPatch(typeof(Humanoid), nameof(Humanoid.CustomFixedUpdate))]
        internal static class PinPatch
        {
            private static void Postfix(Humanoid __instance)
            {
                if (Pins.Count == 0 || !(__instance is Villager villager) || !Pins.TryGetValue(villager, out Pin pin))
                {
                    return;
                }

                if (pin.Point == null || villager.IsDead())
                {
                    Unpin(villager);
                    return;
                }

                Hold(villager, pin.Point);
            }
        }

        public static bool IsPinned(Villager villager) => Pins.ContainsKey(villager);

        /// <summary>
        /// A pinned villager counts as attached, as a player on a chair or in a bed does: the game then stops its
        /// walking and falling physics for him and moves his collider to the layer that hardly touches the world.
        /// Pinning alone left the walking physics working against the pin every step (still a shake on benches).
        /// </summary>
        [HarmonyPatch(typeof(Humanoid), nameof(Humanoid.IsAttached))]
        internal static class AttachedPatch
        {
            private static void Postfix(Humanoid __instance, ref bool __result)
            {
                if (!__result && Pins.Count > 0 && __instance is Villager villager && Pins.ContainsKey(villager))
                {
                    __result = true;
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
