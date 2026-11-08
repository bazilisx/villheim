using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// How each villager feels, from 0 to 100, and why.
    ///
    /// Built from three ideas: MineColonies' happiness (lasting modifiers for housing, food, safety, with a memory of
    /// recent days), Hirdmandr's thoughts (Dwarf Fortress style: each event leaves a thought that fades after a while)
    /// and Millenaire's village life (the village's state colours everyone's day).
    ///
    /// - Baseline from the villager's voice: cheerful folk start higher, gruff and worried ones lower.
    /// - Needs, checked all the time: no food in effect, no bed, badly hurt, out in the rain.
    /// - Thoughts, left by events, each with a value and a time it lasts (a night in his own bed, a good meal, getting
    ///   hurt, a fight nearby, a building finished, a newcomer, a good chat, fresh meat, a trade). A newer thought of the
    ///   same kind replaces the older one, so the same event can't pile up.
    /// - The voice scales how hard things land: worriers feel bad things more, cheerful folk feel good things more,
    ///   elders are steady, the young swing both ways.
    /// - A tenth of the village's mood pulls on everyone.
    ///
    /// Mood moves toward that target slowly, at most 3 points every 20 seconds, so it shifts over minutes, not jumps.
    /// It changes free time, building speed and, above all, what villagers say.
    /// </summary>
    internal static class Moods
    {
        private const float UpdateSeconds = 20f;
        private const float MaxStep = 3f;

        private sealed class Thought
        {
            public string Kind;
            public float Value;
            public float Until;
        }

        private sealed class State
        {
            public float Mood = -1f;
            public float NextUpdate;
            public float LastHealth = -1f;
            public float NextFightThought;
            public readonly List<Thought> Thoughts = new List<Thought>();
        }

        // Kind, value, seconds it lasts (a game hour is about 75 seconds).
        private static readonly Dictionary<string, (float Value, float Seconds)> Kinds = new Dictionary<string, (float, float)>
        {
            ["sleptwell"] = (8f, 900f),
            ["sleptrough"] = (-6f, 900f),
            ["atewell"] = (6f, 600f),
            ["atescraps"] = (-4f, 400f),
            ["hurt"] = (-8f, 300f),
            ["fight"] = (-12f, 400f),
            ["won"] = (6f, 400f),
            ["finished"] = (8f, 1200f),
            ["arrival"] = (4f, 900f),
            ["chat"] = (3f, 300f),
            ["hunt"] = (4f, 600f),
            ["trade"] = (3f, 600f),
            ["upgrade"] = (5f, 900f),
            ["mourning"] = (-15f, 1800f),
            ["birth"] = (10f, 1800f),
            ["watch"] = (-3f, 600f),
            ["raidwon"] = (10f, 1200f),
            ["blessing"] = (6f, 1800f),
        };

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();

        public static float Get(Villager villager)
        {
            State state = States.GetOrCreateValue(villager);
            if (state.Mood < 0f)
            {
                state.Mood = Mathf.Clamp(Baseline(villager) + 5f, 0f, 100f);
            }

            return state.Mood;
        }

        public static string Label(float mood)
        {
            if (mood >= 70f) return "happy";
            if (mood >= 45f) return "content";
            if (mood >= 25f) return "stressed";
            return "miserable";
        }

        /// <summary>Tags for dialogue: feel:happy/content/stressed/miserable and thought:kind for each live thought.</summary>
        public static IEnumerable<string> Tags(Villager villager)
        {
            yield return "feel:" + Label(Get(villager));
            if (States.TryGetValue(villager, out State state))
            {
                foreach (Thought thought in state.Thoughts)
                {
                    if (thought.Until > Time.time)
                    {
                        yield return "thought:" + thought.Kind;
                    }
                }
            }
        }

        /// <summary>"atewell +6 (4 min left), hurt -8 (1 min left)" for the inspect command.</summary>
        public static string Describe(Villager villager)
        {
            if (!States.TryGetValue(villager, out State state) || state.Thoughts.Count == 0)
            {
                return "no thoughts";
            }

            return string.Join(", ", state.Thoughts.Where(t => t.Until > Time.time)
                .Select(t => $"{t.Kind} {t.Value:+0;-0} ({(t.Until - Time.time) / 60f:0} min)"));
        }

        /// <summary>Something happened to this villager.</summary>
        public static void Think(Villager villager, string kind)
        {
            if (!Kinds.TryGetValue(kind, out var entry))
            {
                return;
            }

            State state = States.GetOrCreateValue(villager);
            state.Thoughts.RemoveAll(t => t.Kind == kind || t.Until < Time.time);
            state.Thoughts.Add(new Thought { Kind = kind, Value = Scale(villager, entry.Value), Until = Time.time + entry.Seconds });
        }

        /// <summary>Something happened to the whole village (a building finished, a newcomer, fresh meat...).</summary>
        public static void VillageThink(int villageId, string kind)
        {
            foreach (Character character in Character.GetAllCharacters())
            {
                if (character is Villager villager && !villager.IsDead() && villager.VillageId == villageId)
                {
                    Think(villager, kind);
                }
            }
        }

        /// <summary>Called every brain tick; does real work every 20 seconds.</summary>
        public static void Update(Villager villager, bool threat)
        {
            State state = States.GetOrCreateValue(villager);
            float health = villager.GetHealth();
            if (state.LastHealth >= 0f && health < state.LastHealth - villager.GetMaxHealth() * 0.1f)
            {
                Think(villager, "hurt");
            }

            state.LastHealth = health;
            if (threat && Time.time >= state.NextFightThought)
            {
                state.NextFightThought = Time.time + 120f;
                Think(villager, "fight");
            }

            if (Time.time < state.NextUpdate)
            {
                return;
            }

            state.NextUpdate = Time.time + UpdateSeconds + Random.Range(0f, 3f);
            state.Thoughts.RemoveAll(t => t.Until < Time.time);
            float target = Target(villager, state);
            float current = Get(villager);
            state.Mood = Mathf.Clamp(current + Mathf.Clamp(target - current, -MaxStep, MaxStep), 0f, 100f);
        }

        private static float Target(Villager villager, State state)
        {
            float mood = Baseline(villager);
            float fraction = villager.GetHealth() / Mathf.Max(1f, villager.GetMaxHealth());
            if (fraction < 0.5f) mood += Scale(villager, -10f);
            if (Healing.FoodCount(villager) == 0) mood += Scale(villager, -6f);
            else mood += Scale(villager, 3f);
            if (Beds.For(villager) == null) mood += Scale(villager, -8f);
            if (EnvMan.IsWet() && !Cover.IsUnderRoof(villager.transform.position + Vector3.up)) mood += Scale(villager, -4f);

            mood += state.Thoughts.Sum(t => t.Value);
            mood += (VillageMood.Get(villager.VillageId) - 50f) * 0.1f;
            return Mathf.Clamp(mood, 0f, 100f);
        }

        /// <summary>Where a villager's mood rests with nothing going on, by voice.</summary>
        private static float Baseline(Villager villager)
        {
            switch (Dialogue.VoiceOf(villager))
            {
                case "cheerful": return 62f;
                case "gruff": return 44f;
                case "worrier": return 45f;
                case "young": return 56f;
                case "elder": return 52f;
                case "devout": return 53f;
                case "wry": return 50f;
                default: return 52f;
            }
        }

        /// <summary>How hard a good or bad thing lands for this voice (and role, for fights).</summary>
        private static float Scale(Villager villager, float value)
        {
            string voice = Dialogue.VoiceOf(villager);
            bool good = value > 0f;
            float factor = 1f;
            switch (voice)
            {
                case "cheerful": factor = good ? 1.3f : 0.8f; break;
                case "gruff": factor = good ? 0.7f : 1f; break;
                case "worrier": factor = good ? 0.9f : 1.4f; break;
                case "elder": factor = 0.7f; break;
                case "young": factor = 1.3f; break;
                case "steady": factor = 0.8f; break;
                case "wry": factor = 0.9f; break;
                case "devout": factor = good ? 1.1f : 0.9f; break;
            }

            return value * factor;
        }

        /// <summary>The fight thought: protectors take it better than carers.</summary>
        public static void FightOver(Villager villager)
        {
            Think(villager, Roles.BackgroundOf(villager) == Roles.Background.Protector ? "won" : "chat");
        }
    }
}
