using System.Collections.Generic;
using System.Runtime.CompilerServices;
using UnityEngine;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Held poses (sitting on the ground, kneeling, resting, dancing) and one-off gestures (wave, cheer, laugh...),
    /// using the player animator's own emote parameters, which villagers share.
    ///
    /// Held poses end by themselves: whatever wants a pose has to ask for it every tick. The brain calls
    /// <see cref="EndTick"/> after each update, and a pose nobody asked for that tick is released, so a villager never
    /// keeps sitting after he has been given work or the night has ended.
    /// </summary>
    internal static class Poses
    {
        public const string Sit = "emote_sit";
        public const string Kneel = "emote_kneel";
        public const string Rest = "emote_rest";
        public const string Dance = "emote_dance";

        private const string Stop = "emote_stop";

        private sealed class State
        {
            public string Held;
            public bool Asked;
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();
        private static readonly Dictionary<string, bool> HasParameter = new Dictionary<string, bool>();

        public static bool IsPosed(Villager villager) => States.TryGetValue(villager, out State state) && state.Held != null;

        public static void BeginTick(Villager villager)
        {
            States.GetOrCreateValue(villager).Asked = false;
        }

        /// <summary>Keeps (or starts) a held pose this tick.</summary>
        public static void Hold(Villager villager, string pose)
        {
            State state = States.GetOrCreateValue(villager);
            state.Asked = true;
            if (state.Held == pose || villager.m_zanim == null || !Exists(villager, pose))
            {
                return;
            }

            ReleaseHeld(villager, state);
            // A stop left pending from the last pose would end the new one at once.
            villager.m_animator?.ResetTrigger(Stop);
            villager.m_zanim.SetBool(pose, true);
            state.Held = pose;
        }

        /// <summary>Releases a pose nobody asked for this tick.</summary>
        public static void EndTick(Villager villager)
        {
            State state = States.GetOrCreateValue(villager);
            if (!state.Asked && state.Held != null)
            {
                ReleaseHeld(villager, state);
            }
        }

        public static void Release(Villager villager)
        {
            if (States.TryGetValue(villager, out State state))
            {
                ReleaseHeld(villager, state);
            }
        }

        /// <summary>A one-off gesture such as "wave" or "cheer". Not while holding a pose.</summary>
        public static void Gesture(Villager villager, string name)
        {
            string trigger = "emote_" + name;
            if (IsPosed(villager) || villager.m_zanim == null || !Exists(villager, trigger))
            {
                return;
            }

            villager.m_zanim.SetTrigger(trigger);
        }

        private static void ReleaseHeld(Villager villager, State state)
        {
            if (state.Held == null)
            {
                return;
            }

            villager.m_zanim?.SetBool(state.Held, false);
            villager.m_zanim?.SetTrigger(Stop);
            state.Held = null;
        }

        /// <summary>Whether the villager's animator has this parameter. Checked once per name.</summary>
        private static bool Exists(Villager villager, string parameter)
        {
            if (HasParameter.TryGetValue(parameter, out bool known))
            {
                return known;
            }

            Animator animator = villager.m_animator;
            if (animator == null || animator.runtimeAnimatorController == null)
            {
                return true;
            }

            bool found = false;
            foreach (AnimatorControllerParameter candidate in animator.parameters)
            {
                if (candidate.name == parameter)
                {
                    found = true;
                    break;
                }
            }

            HasParameter[parameter] = found;
            if (!found)
            {
                VillheimPlugin.Debug($"The villager animator has no '{parameter}'; that pose or gesture is skipped.");
            }

            return found;
        }
    }
}
