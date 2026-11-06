using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Designs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// How the village feels, from 0 to 100, worked out once a minute. It changes what villagers do in their free
    /// time: a cheerful village chats, cheers, toasts and dances at the evening fire; a glum one sits alone, shrugs and
    /// sighs. It never stops anyone from working.
    ///
    /// Six tenths of it is the average of its villagers' own moods (see Villagers.Moods), four tenths the village's
    /// state: a bed for everyone, how big it has grown, a building going up, having what it needs, rain, and monsters
    /// seen in the last few minutes. It moves at most 5 points a minute, so a village takes a while to cheer up or sour.
    /// </summary>
    internal static class VillageMood
    {
        private const float RecomputeSeconds = 60f;
        private const float ThreatMemorySeconds = 180f;

        private sealed class Entry
        {
            public float Value = 50f;
            public float Next;
        }

        private static readonly Dictionary<int, Entry> Entries = new Dictionary<int, Entry>();
        private static readonly Dictionary<int, float> LastThreat = new Dictionary<int, float>();

        public static void NoteThreat(int villageId)
        {
            LastThreat[villageId] = Time.time;
        }

        /// <summary>Seconds since the village last saw an enemy (a very large number if never).</summary>
        public static float SecondsSinceThreat(int villageId) =>
            LastThreat.TryGetValue(villageId, out float time) ? Time.time - time : float.MaxValue;

        public static float Get(int villageId)
        {
            if (!Entries.TryGetValue(villageId, out Entry entry))
            {
                entry = new Entry();
                Entries[villageId] = entry;
            }

            if (Time.time >= entry.Next)
            {
                entry.Next = Time.time + RecomputeSeconds;
                entry.Value = Compute(villageId, entry.Value);
            }

            return entry.Value;
        }

        public static string Label(float mood)
        {
            if (mood >= 70f) return "cheerful";
            if (mood >= 50f) return "content";
            if (mood >= 30f) return "uneasy";
            return "glum";
        }

        private static float Compute(int villageId, float previous)
        {
            VillageHearth hearth = VillageHearth.Find(villageId);
            if (hearth == null || !hearth.IsValid)
            {
                return previous;
            }

            var state = new VillageState(hearth.Zdo);
            float mood = 50f;

            int villagers = Character.GetAllCharacters().Count(c => c is Villager v && !v.IsDead() && v.VillageId == villageId);
            int beds = Villagers.Beds.Of(hearth).Count;
            mood += beds >= villagers ? 10f : -10f;
            mood += Mathf.Min(20f, state.Plots.Count * 4f);

            if (ConstructionSite.IsActive(hearth.Zdo))
            {
                mood += 5f;
            }

            VillageNeeds needs = VillageNeeds.For(villageId);
            if (needs != null && needs.Missing.Count == 0)
            {
                mood += 5f;
            }

            if (EnvMan.IsWet())
            {
                mood -= 10f;
            }

            if (LastThreat.TryGetValue(villageId, out float seen) && Time.time - seen < ThreatMemorySeconds)
            {
                mood -= 20f;
            }

            // Its people's own moods weigh most.
            var people = Character.GetAllCharacters().OfType<Villager>().Where(v => !v.IsDead() && v.VillageId == villageId).ToList();
            if (people.Count > 0)
            {
                mood = mood * 0.4f + people.Average(v => Villagers.Moods.Get(v)) * 0.6f;
            }

            // Moods drift rather than jump.
            return Mathf.Clamp(previous + Mathf.Clamp(mood - previous, -5f, 5f), 0f, 100f);
        }
    }
}
