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
            public float SetAt;
            public int QuickClears;
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();
        private static readonly Dictionary<string, bool> HasParameter = new Dictionary<string, bool>();
        private static readonly Dictionary<string, bool> IsTriggerParameter = new Dictionary<string, bool>();

        public static bool IsPosed(Villager villager) => States.TryGetValue(villager, out State state) && state.Held != null;

        private static readonly string[] All = { Sit, Kneel, Rest, Dance };

        public static void BeginTick(Villager villager)
        {
            State state = States.GetOrCreateValue(villager);
            state.Asked = false;

            // A pose left on by an earlier logic build or another owner: the animator says so, our state doesn't.
            Animator animator = villager.m_animator;
            if (animator == null || villager.m_zanim == null)
            {
                return;
            }

            // A trigger is cleared by the animator the moment its animation starts, so it can't be read back: only
            // bools are checked here. (Reading a trigger as "off" restarted the pose about three times a second, the
            // stutter seen in a trace on 2026-11-06.)
            if (state.Held != null && !IsTrigger(villager, state.Held) && !animator.GetBool(state.Held))
            {
                // A bool the animator itself clears as the pose starts behaves like a trigger: after it happens twice,
                // it is treated as one instead of being set again and again.
                if (Time.time - state.SetAt < 1f && ++state.QuickClears >= 2)
                {
                    IsTriggerParameter[state.Held] = true;
                    VillheimPlugin.Log.LogInfo($"Villager animator: '{state.Held}' clears itself; treated as a trigger.");
                }
                else
                {
                    state.Held = null;
                }
            }

            foreach (string pose in All)
            {
                if (pose != state.Held && Exists(villager, pose) && !IsTrigger(villager, pose) && animator.GetBool(pose))
                {
                    villager.m_zanim.SetBool(pose, false);
                    villager.m_zanim.SetTrigger(Stop);
                }
            }
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
            if (IsTrigger(villager, pose))
            {
                villager.m_zanim.SetTrigger(pose); // once: the animation then holds until emote_stop
            }
            else
            {
                villager.m_zanim.SetBool(pose, true);
            }

            state.Held = pose;
            state.SetAt = Time.time;
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

            // Never in a fight, while running from one, or on a hunt: a wave mid-fight looked random (T-111).
            Status.Doer doer = Status.Current(villager);
            if (doer == Status.Doer.Fight || doer == Status.Doer.Hunt)
            {
                return;
            }

            villager.m_zanim.SetTrigger(trigger);
        }

        /// <summary>A one-off animator trigger such as "interact" (reaching out) or "eat", if the animator has it.</summary>
        public static void Trigger(Villager villager, string trigger)
        {
            if (villager.m_zanim == null || !Exists(villager, trigger))
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

            if (!IsTrigger(villager, state.Held))
            {
                villager.m_zanim?.SetBool(state.Held, false);
            }

            villager.m_zanim?.SetTrigger(Stop);
            state.Held = null;
        }

        /// <summary>The animator parameter is a trigger (set once, cleared by the animator) rather than a bool.</summary>
        private static bool IsTrigger(Villager villager, string parameter)
        {
            if (IsTriggerParameter.TryGetValue(parameter, out bool known))
            {
                return known;
            }

            Animator animator = villager.m_animator;
            if (animator == null || animator.runtimeAnimatorController == null)
            {
                return false;
            }

            bool trigger = false;
            foreach (AnimatorControllerParameter candidate in animator.parameters)
            {
                if (candidate.name == parameter)
                {
                    trigger = candidate.type == AnimatorControllerParameterType.Trigger;
                    VillheimPlugin.Debug($"Villager animator: '{parameter}' is a {candidate.type}.");
                    break;
                }
            }

            IsTriggerParameter[parameter] = trigger;
            return trigger;
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
