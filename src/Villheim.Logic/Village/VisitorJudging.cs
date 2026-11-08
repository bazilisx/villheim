using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Villagers;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Visitors who judge their stay (proposal 8, after the Hospitality mod for RimWorld; the rules, our own code).
    ///
    /// - A pedlar's or pilgrim's feeling (0 to 1) is taken on arrival and every 20 s while he stays: 0.5, moved by the
    ///   village's mood, rain on him in the open (-0.2), a fight in the last minute (-0.3), being hurt (-0.2), a feast
    ///   or a festival (+0.15, +0.1).
    /// - Leaving: feeling at the end = half the stay's average, half now. Score = the mean of (rise x 2.75) and
    ///   (feeling x 1.35), clamped 0 to 1.
    /// - His home village's view of this one moves toward lerp(-100, 100, score) by at most 3, when it is 5 or more
    ///   away. (The host still thinks 3 better of his home for the visit, in Relations.Visited.)
    /// - Under 0.5, no visitor comes for up to three more days (the worse, the longer). The next visitor is half to
    ///   1.5 times as likely by the last score.
    /// - Between 0.2 and 0.9 he may leave a gift in the chest (chance = score): coins from a pedlar, food from a pilgrim.
    /// - His goodbye uses stay:good, stay:fair or stay:bad; the chronicle notes a very good or a bad stay.
    /// </summary>
    internal static class VisitorJudging
    {
        private static readonly int KeyIn = "villheim_vj_in".GetStableHashCode();
        private static readonly int KeySum = "villheim_vj_sum".GetStableHashCode();
        private static readonly int KeyCount = "villheim_vj_n".GetStableHashCode();
        private static readonly int KeyWaitUntil = "villheim_visit_wait".GetStableHashCode();
        private static readonly int KeyLastScore = "villheim_visit_score".GetStableHashCode();

        private sealed class Clock
        {
            public float Next;
            public float LastHealth = -1f;
            public bool Hurt;
        }

        private static readonly ConditionalWeakTable<Villager, Clock> Clocks = new ConditionalWeakTable<Villager, Clock>();

        private static bool On => Living.On(LogicConfig.VisitorJudging);

        private static float Feel(Villager visitor, VillageHearth hearth, Clock clock)
        {
            int id = hearth.VillageId;
            float feel = 0.5f + (VillageMood.Get(id) - 50f) / 200f;
            if (EnvMan.IsWet() && !Cover.IsUnderRoof(visitor.transform.position + Vector3.up))
            {
                feel -= 0.2f;
            }

            if (VillageMood.SecondsSinceThreat(id) < 60f)
            {
                feel -= 0.3f;
            }

            if (clock != null && clock.Hurt)
            {
                feel -= 0.2f;
            }

            if (Gatherings.FeastTonight(id))
            {
                feel += 0.15f;
            }

            if (Calendar.FestivalToday)
            {
                feel += 0.1f;
            }

            return Mathf.Clamp01(feel);
        }

        public static void Arrived(Villager visitor, VillageHearth hearth)
        {
            if (!On || visitor?.Zdo == null)
            {
                return;
            }

            visitor.Zdo.Set(KeyIn, Feel(visitor, hearth, null));
            visitor.Zdo.Set(KeySum, 0f);
            visitor.Zdo.Set(KeyCount, 0);
        }

        /// <summary>While he stays, every 20 seconds.</summary>
        public static void Sample(Villager visitor, VillageHearth hearth)
        {
            if (!On || visitor?.Zdo == null)
            {
                return;
            }

            Clock clock = Clocks.GetOrCreateValue(visitor);
            float health = visitor.GetHealth();
            if (clock.LastHealth >= 0f && health < clock.LastHealth - 1f)
            {
                clock.Hurt = true;
            }

            clock.LastHealth = health;
            if (Time.time < clock.Next)
            {
                return;
            }

            clock.Next = Time.time + 20f;
            visitor.Zdo.Set(KeySum, visitor.Zdo.GetFloat(KeySum) + Feel(visitor, hearth, clock));
            visitor.Zdo.Set(KeyCount, visitor.Zdo.GetInt(KeyCount) + 1);
            clock.Hurt = false;
        }

        /// <summary>He is leaving: the score, its effects, and the tags for his goodbye.</summary>
        public static string[] Leaving(Villager visitor, VillageHearth hearth)
        {
            if (!On || visitor?.Zdo == null || hearth == null || !hearth.IsValid)
            {
                return null;
            }

            float score = Score(visitor, hearth);
            Apply(visitor, hearth, score);
            return new[] { score >= 0.6f ? "stay:good" : score < 0.35f ? "stay:bad" : "stay:fair" };
        }

        public static float Score(Villager visitor, VillageHearth hearth)
        {
            ZDO zdo = visitor.Zdo;
            float now = Feel(visitor, hearth, Clocks.GetOrCreateValue(visitor));
            int count = zdo.GetInt(KeyCount);
            float stay = count > 0 ? zdo.GetFloat(KeySum) / count : now;
            float leave = 0.5f * stay + 0.5f * now;
            float rise = leave - zdo.GetFloat(KeyIn, 0.5f);
            return Mathf.Clamp01(Mathf.Lerp(rise * 2.75f, leave * 1.35f, 0.5f));
        }

        private static void Apply(Villager visitor, VillageHearth hearth, float score)
        {
            ZDO host = hearth.Zdo;
            host.Set(KeyLastScore, score);
            double day = VillageBrain.DayLength();
            if (score < 0.5f)
            {
                host.Set(KeyWaitUntil, (long)((Living.Now + (0.5f - score) * 6f * day) * 10.0));
            }

            int fromId = visitor.Zdo.GetInt(WorldLife.KeyFromVillage);
            ZDO home = fromId != 0 ? Relations.AllHearths().FirstOrDefault(z => z.GetInt(Keys.VillageId) == fromId) : null;
            if (home != null && (ZNet.instance.IsServer() || home.IsOwner()))
            {
                int current = Relations.View(home, hearth.VillageId);
                int target = Mathf.RoundToInt(Mathf.Lerp(-100f, 100f, score));
                if (Mathf.Abs(target - current) >= 5)
                {
                    Relations.Set(home, hearth.VillageId, current + Mathf.Clamp(target - current, -3, 3));
                }
            }

            string who = Wanderers.KindOf(visitor) == Wanderers.Pedlar ? "pedlar" : "pilgrim";
            if (score >= 0.2f && score <= 0.9f && Random.value < score)
            {
                Gift(visitor, hearth, who);
            }

            if (score >= 0.75f)
            {
                Chronicle.Add(hearth, $"{visitor.VillagerName} the {who} went away pleased with {hearth.VillageName}.");
            }
            else if (score < 0.35f)
            {
                Chronicle.Add(hearth, $"{visitor.VillagerName} the {who} left in a sour mood.");
            }

            Dialogue.Note(hearth.VillageId, score >= 0.6f ? "visitorpleased" : score < 0.35f ? "visitorsour" : "visitorleft");
            VillheimPlugin.Debug($"{hearth.VillageName}: {visitor.VillagerName} judged the stay {score:0.00}.");
        }

        private static void Gift(Villager visitor, VillageHearth hearth, string who)
        {
            Container chest = VillageChest.Find(hearth);
            if (chest == null)
            {
                return;
            }

            string item = who == "pedlar" ? "Coins" : Random.value < 0.5f ? "Honey" : "Raspberry";
            int amount = who == "pedlar" ? Random.Range(3, 9) : Random.Range(2, 5);
            if (VillageChest.Add(chest, item, amount) > 0)
            {
                Chronicle.Add(hearth, $"{visitor.VillagerName} left {amount} {Materials.Label(item)} in the chest as thanks.");
            }
        }

        /// <summary>No visitor for a while after a bad stay.</summary>
        public static bool Waiting(VillageHearth hearth) =>
            On && hearth != null && hearth.IsValid && Living.Now < hearth.Zdo.GetLong(KeyWaitUntil) / 10.0;

        /// <summary>The next visitor is 0.5 to 1.5 times as likely by how the last one found the place.</summary>
        public static float ChanceFactor(VillageHearth hearth) =>
            On && hearth != null && hearth.IsValid ? 0.5f + hearth.Zdo.GetFloat(KeyLastScore, 0.5f) : 1f;

        public static string Describe(VillageHearth hearth)
        {
            double wait = (hearth.Zdo.GetLong(KeyWaitUntil) / 10.0 - Living.Now) / VillageBrain.DayLength();
            return $"last visitor's score {hearth.Zdo.GetFloat(KeyLastScore, 0.5f):0.00}, visitors x{ChanceFactor(hearth):0.00}" +
                   (wait > 0 ? $", none for {wait:0.0} more days" : "");
        }
    }
}
