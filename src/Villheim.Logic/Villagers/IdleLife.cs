using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Small things a standing villager does so the village never looks frozen: every five to fourteen seconds he
    /// glances at something for a moment (whoever is talking near him, the player, an animal, the sky when it rains or
    /// thunders, the fire, a random spot), and now and then a small gesture that fits the moment: reaching to the fire
    /// when cold, a stretch in the morning, a shrug in the rain.
    ///
    /// Only for villagers standing about (strolling, waiting between jobs, standing at the evening fire); a sitting
    /// villager turning his whole body to look looked wrong, so sitters keep still.
    /// </summary>
    internal static class IdleLife
    {
        private sealed class State
        {
            public float Next;
            public float Until;
            public Vector3 Point;
            public Character At;
            public int StretchedDay = -1;
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();

        /// <summary>Called each tick while the villager stands about; turns his look for a moment now and then.</summary>
        public static void Tick(Villager villager, VillagerAI ai)
        {
            if (!LogicConfig.IsOn(LogicConfig.IdleGlances)) return;

            State state = States.GetOrCreateValue(villager);
            if (Time.time < state.Until)
            {
                if (state.At != null && !state.At.IsDead())
                {
                    ai.LookAt(state.At.GetEyePoint());
                }
                else
                {
                    ai.LookAt(state.Point);
                }

                return;
            }

            if (Time.time < state.Next)
            {
                return;
            }

            state.Next = Time.time + Random.Range(5f, 14f);
            state.Until = Time.time + Random.Range(1.5f, 3.5f);
            state.At = null;
            Vector3 eye = villager.transform.position + Vector3.up * 1.6f;
            float roll = Random.value;
            bool wet = EnvMan.IsWet();
            string env = EnvMan.instance?.GetCurrentEnvironment()?.m_name?.ToLowerInvariant() ?? "";

            if ((wet || env.Contains("thunder")) && roll < 0.35f)
            {
                // Up at the sky.
                state.Point = eye + villager.transform.forward * 4f + Vector3.up * 6f;
                return;
            }

            if (roll < 0.4f)
            {
                Villager other = Character.GetAllCharacters().OfType<Villager>()
                    .Where(v => v != villager && !v.IsDead() && Vector3.Distance(v.transform.position, villager.transform.position) < 9f)
                    .OrderBy(_ => Random.value).FirstOrDefault();
                if (other != null)
                {
                    state.At = other;
                    return;
                }
            }

            Player player = Player.m_localPlayer;
            if (roll < 0.55f && player != null && Vector3.Distance(player.transform.position, villager.transform.position) < 12f)
            {
                state.At = player;
                return;
            }

            if (roll < 0.7f)
            {
                Character beast = Character.GetAllCharacters()
                    .Where(c => c != null && !c.IsDead() && !(c is Villager) && !(c is Player) &&
                                Vector3.Distance(c.transform.position, villager.transform.position) < 25f)
                    .OrderBy(_ => Random.value).FirstOrDefault();
                if (beast != null)
                {
                    state.At = beast;
                    return;
                }
            }

            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (roll < 0.82f && hearth != null && Vector3.Distance(hearth.transform.position, villager.transform.position) < 12f)
            {
                state.Point = hearth.transform.position + Vector3.up * 0.5f;
                if ((EnvMan.IsCold() || EnvMan.IsNight()) && Random.value < 0.5f)
                {
                    // Hands out to the fire.
                    Poses.Trigger(villager, "interact");
                }

                return;
            }

            float hour = EnvMan.instance != null ? EnvMan.instance.GetDayFraction() * 24f : 12f;
            int day = EnvMan.instance != null ? EnvMan.instance.GetDay() : 0;
            if (hour >= 5f && hour < 9f && state.StretchedDay != day && Random.value < 0.5f)
            {
                state.StretchedDay = day;
                Poses.Gesture(villager, "flex");
            }

            // Somewhere round about.
            state.Point = eye + Quaternion.Euler(0f, Random.Range(-120f, 120f), 0f) * villager.transform.forward * 8f +
                          Vector3.up * Random.Range(-1.5f, 1f);
        }
    }
}
