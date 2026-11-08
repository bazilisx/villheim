using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// The village turning out together (WORLD_LIFE plan item 2). Built on the approaches in <see cref="Social"/>.
    ///
    /// - A finished building, a newcomer, a pedlar: up to eight idle villagers within 70 m walk over and stand round
    ///   it; one speaker (the Jarl, else an elder, else whoever is closest) says a few words, the rest cheer, and a
    ///   moment later one or two of them say something of their own. At most one turnout every two minutes.
    /// - A feast: a hunt brought home, a birth, a finished building or a boss felled anywhere in the world makes the
    ///   evening a feast. At the hearth that evening fewer sit, more toast and dance, and everyone gets the feast
    ///   thought (+6). Tags "feastday" all that day and "feast" in the evening.
    /// - Evening words (Millenaire's speeches): once a day between 18:00 and 19:30, with a player by the hearth, the
    ///   Jarl (or an elder) stands by the fire and talks about the day; one or two answer.
    /// </summary>
    internal static class Gatherings
    {
        private static readonly Dictionary<int, int> FeastDays = new Dictionary<int, int>();
        private static readonly Dictionary<int, int> SpeechDays = new Dictionary<int, int>();
        private static readonly Dictionary<int, float> NextTurnout = new Dictionary<int, float>();

        private static int Today => EnvMan.instance != null ? EnvMan.instance.GetDay() : 0;

        private static float Hour => EnvMan.instance != null ? EnvMan.instance.GetDayFraction() * 24f : 12f;

        public static bool FeastToday(int villageId) => FeastDays.TryGetValue(villageId, out int day) && day == Today;

        public static bool FeastTonight(int villageId) => FeastToday(villageId) && (Hour >= 16.5f || Hour < 2f);

        /// <summary>A festival: tonight is a feast (Calendar).</summary>
        public static void Feast(int villageId) => FeastDays[villageId] = Today;

        /// <summary>From Dialogue.Note: some events make the evening a feast, some get a turnout.</summary>
        public static void Noted(int villageId, string what)
        {
            if (what == "hunt" || what == "birth" || what == "finished" || what == "bossdown" || what == "upgrade")
            {
                if (!FeastToday(villageId))
                {
                    FeastDays[villageId] = Today;
                    VillheimPlugin.Debug($"Village {villageId}: a feast tonight ({what}).");
                }
            }

            if (what == "pedlar" || what == "pilgrim")
            {
                VillageHearth hearth = VillageHearth.Find(villageId);
                Villager visitor = hearth != null && hearth.IsValid
                    ? Character.GetAllCharacters().OfType<Villager>().Where(v => Wanderers.IsWanderer(v) && !v.IsDead())
                        .OrderBy(v => Vector3.Distance(v.transform.position, hearth.transform.position)).FirstOrDefault()
                    : null;
                if (visitor != null && Vector3.Distance(visitor.transform.position, hearth.transform.position) < 140f)
                {
                    Turnout(villageId, visitor, null, what, what == "pedlar" ? 4 : 2, 60f);
                }
            }
        }

        /// <summary>A building is done: the village comes to look at it.</summary>
        public static void Finished(int villageId, Vector3 front) => Turnout(villageId, null, front, "finished", 8, 70f);

        /// <summary>A newcomer has come to live here: the village comes to say hello.</summary>
        public static void Arrival(int villageId, Villager newcomer) => Turnout(villageId, newcomer, null, "arrival", 5, 60f);

        private static bool Free(Villager v, int villageId) =>
            !v.IsDead() && v.VillageId == villageId && v.VillageId != 0 && !Sleep.IsAsleep(v) && !Social.IsSent(v) &&
            !Healing.IsHealing(v) && Chores.Describe(v) == null && !Wanderers.IsWanderer(v);

        private static void Turnout(int villageId, Character who, Vector3? point, string kind, int count, float within)
        {
            if (NextTurnout.TryGetValue(villageId, out float next) && Time.time < next)
            {
                return;
            }

            Vector3 at = who != null ? who.transform.position : point ?? Vector3.zero;
            List<Villager> free = Character.GetAllCharacters().OfType<Villager>()
                .Where(v => v != who && Free(v, villageId) && Utils.DistanceXZ(v.transform.position, at) < within)
                .OrderBy(v => Utils.DistanceXZ(v.transform.position, at)).ToList();
            if (free.Count == 0)
            {
                return;
            }

            NextTurnout[villageId] = Time.time + 120f;
            Villager speaker = free.FirstOrDefault(Roles.IsJarl) ?? free.FirstOrDefault(v => Dialogue.VoiceOf(v) == "elder") ?? free[0];
            free.Remove(speaker);
            Social.SendOne(speaker, who, point, "event:speech:" + kind, kind == "finished" ? "cheer" : "wave", 40f, who != null ? 2.4f : 3f, false, 20f);
            Moods.Think(speaker, "gathering");

            List<Villager> crowd = free.Take(count - 1).ToList();
            for (int i = 0; i < crowd.Count; i++)
            {
                float angle = (i + 1) * 47f;
                Vector3? spot = point.HasValue ? point.Value + Quaternion.Euler(0f, angle, 0f) * Vector3.forward * (3.5f + (i % 3) * 0.8f) : (Vector3?)null;
                Social.SendOne(crowd[i], who, spot, "event:gathering:" + kind, i % 2 == 0 ? "cheer" : "thumbsup", 40f,
                    who != null ? 2.6f + (i % 4) * 0.6f : 0.8f, true, 18f, point.HasValue ? point.Value + Vector3.up * 1.5f : (Vector3?)null);
                Moods.Think(crowd[i], "gathering");
            }

            float delay = Random.Range(12f, 16f);
            foreach (Villager talker in crowd.OrderBy(_ => Random.value).Take(crowd.Count >= 3 ? 2 : crowd.Count))
            {
                Dialogue.QueueLine(talker, "self", "event:crowd:" + kind, new[] { "event:crowd:" + kind }, delay);
                delay += Random.Range(4f, 7f);
            }

            VillheimPlugin.Debug($"Village {villageId} turns out for {kind}: {speaker.VillagerName} speaks, {crowd.Count} come.");
        }

        /// <summary>From the hearth's tick: the evening words.</summary>
        public static void VillageTick(VillageHearth hearth)
        {
            int id = hearth.VillageId;
            Player player = Player.m_localPlayer;
            if (player == null || Hour < 18f || Hour > 19.5f || (SpeechDays.TryGetValue(id, out int day) && day == Today) ||
                Vector3.Distance(player.transform.position, hearth.transform.position) > 45f)
            {
                return;
            }

            SpeakNow(hearth);
        }

        /// <summary>The evening words now (also 'vh speech'). False with fewer than two villagers by the hearth.</summary>
        public static bool SpeakNow(VillageHearth hearth)
        {
            int id = hearth.VillageId;
            List<Villager> near = Character.GetAllCharacters().OfType<Villager>()
                .Where(v => !v.IsDead() && v.VillageId == id && !Sleep.IsAsleep(v) && !Social.IsSent(v) && !Wanderers.IsWanderer(v) &&
                            Vector3.Distance(v.transform.position, hearth.transform.position) < 20f).ToList();
            if (near.Count < 2)
            {
                return false;
            }

            SpeechDays[id] = Today;
            Villager speaker = near.FirstOrDefault(Roles.IsJarl) ?? near.FirstOrDefault(v => Dialogue.VoiceOf(v) == "elder") ??
                               near.OrderBy(_ => Random.value).First();
            string kind = FeastToday(id) ? "event:speech:feast" : "event:speech:evening";
            Social.SendOne(speaker, null, hearth.transform.position, kind, "point", 30f, 3f, false, 10f);
            float delay = Random.Range(7f, 10f);
            foreach (Villager listener in near.Where(v => v != speaker).OrderBy(_ => Random.value).Take(Random.value < 0.4f ? 2 : 1))
            {
                Dialogue.QueueLine(listener, "self", "event:speechreply", new[] { "event:speechreply", FeastToday(id) ? "feast" : "nofeast" }, delay);
                delay += Random.Range(4f, 6f);
            }

            foreach (Villager listener in near)
            {
                Moods.Think(listener, FeastToday(id) ? "feast" : "speech");
            }

            return true;
        }

        public static IEnumerable<string> Tags(int villageId)
        {
            if (FeastToday(villageId)) yield return "feastday";
            if (FeastTonight(villageId)) yield return "feast";
        }

        public static string Describe(int villageId) =>
            (FeastToday(villageId) ? "feast today" : "no feast today") +
            (SpeechDays.TryGetValue(villageId, out int day) && day == Today ? ", evening words said" : "");
    }
}
