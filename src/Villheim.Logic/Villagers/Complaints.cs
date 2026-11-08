using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Needs that complain, then demand, then leave (proposal 7, after MineColonies' complain and demand days,
    /// shortened for Valheim's shorter days).
    ///
    /// Each morning every grown villager counts the days in a row he has been without a bed, without food (none in
    /// effect and none in the chest) and without safety (a fight in the village in the last day). A need met sets its
    /// count back to 0.
    ///
    /// - ComplainAfterDays (3): complain lines (complain, complain:bed/food/safety); the need weighs a third more on
    ///   his mood.
    /// - DemandAfterDays (6): he walks up to a known player within 60 m and asks for it (demand:x), and the need weighs
    ///   twice as much.
    /// - LeaveAfterDays (10): only with WorldLife and VillagersLeave on, he leaves (see Leaving). Off by default: villagers
    ///   never move away (D-003), so a need gone long ends in asking, never in leaving.
    ///
    /// Counts live in the villager's ZDO ("bed:3;food:0;safety:0").
    /// </summary>
    internal static class Complaints
    {
        private static readonly int KeyLack = "villheim_lack".GetStableHashCode();
        private static readonly string[] Needs = { "bed", "food", "safety" };
        private static readonly Dictionary<string, float> Weight = new Dictionary<string, float> { ["bed"] = 8f, ["food"] = 6f, ["safety"] = 5f };

        private static bool On => Living.On(LogicConfig.Complaints);

        private static int ComplainAt => LogicConfig.ComplainAfterDays != null ? LogicConfig.ComplainAfterDays.Value : 3;

        private static int DemandAt => LogicConfig.DemandAfterDays != null ? LogicConfig.DemandAfterDays.Value : 6;

        private static int LeaveAt => LogicConfig.LeaveAfterDays != null ? LogicConfig.LeaveAfterDays.Value : 10;

        private static Dictionary<string, int> Read(Villager villager)
        {
            var counts = new Dictionary<string, int>();
            foreach (string entry in (villager.Zdo?.GetString(KeyLack, "") ?? "").Split(';'))
            {
                int colon = entry.IndexOf(':');
                if (colon > 0 && int.TryParse(entry.Substring(colon + 1), NumberStyles.Integer, CultureInfo.InvariantCulture, out int days))
                {
                    counts[entry.Substring(0, colon)] = days;
                }
            }

            return counts;
        }

        private static void Write(Villager villager, Dictionary<string, int> counts)
        {
            villager.Zdo.Set(KeyLack, string.Join(";", counts.Where(c => c.Value > 0)
                .Select(c => c.Key + ":" + c.Value.ToString(CultureInfo.InvariantCulture))));
        }

        public static int Days(Villager villager, string need) => Read(villager).TryGetValue(need, out int days) ? days : 0;

        /// <summary>For 'vh complain': sets a count by hand.</summary>
        public static void SetDays(Villager villager, string need, int days)
        {
            Dictionary<string, int> counts = Read(villager);
            counts[need] = Mathf.Max(0, days);
            Write(villager, counts);
        }

        /// <summary>Once a day, in the morning.</summary>
        public static void Daily(Villager villager, VillageHearth hearth)
        {
            if (!On || Childhood.IsChild(villager) || Wanderers.IsWanderer(villager) || Leaving.IsLeaving(villager))
            {
                return;
            }

            Dictionary<string, int> counts = Read(villager);
            bool noBed = Beds.For(villager) == null;
            bool noFood = Healing.FoodCount(villager) == 0 && Healing.ChestFood(hearth) == null;
            bool unsafeDay = VillageMood.SecondsSinceThreat(villager.VillageId) < VillageBrain.DayLength();
            foreach (string need in Needs)
            {
                bool lacking = need == "bed" ? noBed : need == "food" ? noFood : unsafeDay;
                counts.TryGetValue(need, out int days);
                counts[need] = lacking ? days + 1 : 0;
            }

            Write(villager, counts);
            foreach (string need in Needs)
            {
                int days = counts[need];
                if (days == ComplainAt)
                {
                    Dialogue.Note(villager.VillageId, "complain");
                }

                if (days == DemandAt)
                {
                    Demand(villager, hearth, need);
                }

                if (days >= LeaveAt && Leaving.On && Leaving.Start(villager, need))
                {
                    return;
                }
            }
        }

        private static void Demand(Villager villager, VillageHearth hearth, string need)
        {
            Chronicle.Add(hearth, $"{villager.VillagerName} has gone without {What(need)} for {PlayerMemory.Number(DemandAt)} days and is asking for help.");
            Player player = Player.m_localPlayer;
            if (player == null || player.IsDead() || Social.Find(hearth, player) == null ||
                Vector3.Distance(player.transform.position, villager.transform.position) > 60f)
            {
                return;
            }

            Social.SendOne(villager, player, null, "demand:" + need, "comehere", 30f, 2.4f, false, 3f);
        }

        private static string What(string need) => need == "bed" ? "a bed" : need == "food" ? "food" : "a safe night";

        /// <summary>The extra weight of needs gone too long: a third more at ComplainAfterDays, twice at DemandAfterDays.</summary>
        public static float MoodTerm(Villager villager)
        {
            if (!On || villager.Zdo == null)
            {
                return 0f;
            }

            float term = 0f;
            foreach (KeyValuePair<string, int> count in Read(villager))
            {
                if (!Weight.TryGetValue(count.Key, out float weight))
                {
                    continue;
                }

                if (count.Value >= DemandAt)
                {
                    term -= weight;
                }
                else if (count.Value >= ComplainAt)
                {
                    term -= weight / 3f;
                }
            }

            return term;
        }

        public static IEnumerable<string> Tags(Villager villager)
        {
            if (!On)
            {
                yield break;
            }

            bool any = false;
            foreach (KeyValuePair<string, int> count in Read(villager))
            {
                if (count.Value >= ComplainAt)
                {
                    any = true;
                    yield return "complain:" + count.Key;
                }

                if (count.Value >= DemandAt)
                {
                    yield return "demand:" + count.Key;
                }
            }

            if (any)
            {
                yield return "complain";
            }
        }

        public static string Fill(string line, Villager villager)
        {
            if (!line.Contains("{lackdays}"))
            {
                return line;
            }

            int days = Read(villager).Values.DefaultIfEmpty(0).Max();
            return line.Replace("{lackdays}", PlayerMemory.Number(days));
        }

        public static string Describe(Villager villager)
        {
            Dictionary<string, int> counts = Read(villager);
            return counts.Count == 0 ? "no needs going short" : "days without: " + string.Join(", ", counts.Select(c => $"{c.Key} {c.Value}"));
        }
    }
}
