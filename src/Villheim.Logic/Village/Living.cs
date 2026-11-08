using System.Collections.Generic;
using System.Runtime.CompilerServices;
using BepInEx.Configuration;
using UnityEngine;
using Villheim.Logic.Villagers;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// The living village (config section "6 - Living village"): one place that calls the systems built on
    /// 2026-11-08 (day, round 2) from the hearth's tick, the villager's brain tick and the dialogue, so the files they
    /// touch only gain one line each. The systems are Prosperity, Calendar, Expectations, Standing, Complaints,
    /// Leaving, VisitorJudging, WantPile, BossStages, Elders, Neighbours and Escort (the horn and help in a fight).
    /// </summary>
    internal static class Living
    {
        private static readonly int KeyVillagerDay = "villheim_living_day".GetStableHashCode();

        public static bool On(ConfigEntry<bool> entry) => entry == null || entry.Value;

        /// <summary>WorldLife is on: systems that take villagers away or hold growth back need it too.</summary>
        public static bool World => LogicConfig.WorldLife != null && LogicConfig.WorldLife.Value;

        public static int Today => EnvMan.instance != null ? EnvMan.instance.GetDay() : 0;

        public static float Hour => EnvMan.instance != null ? EnvMan.instance.GetDayFraction() * 24f : 12f;

        public static double Now => ZNet.instance != null ? ZNet.instance.GetTimeSeconds() : Time.time;

        /// <summary>The village's stage, 1 (camp) to 4 (town).</summary>
        public static int Stage(VillageState state) => VillageBrain.TierIndex(state.Plots.Count) + 1;

        private static void Safely(string what, System.Action action)
        {
            try
            {
                action();
            }
            catch (System.Exception e)
            {
                VillheimPlugin.Log.LogWarning($"Living village ({what}): {e}");
            }
        }

        // ---------------------------------------------------------------- ticks

        /// <summary>From VillageBrain's tick on the hearth's owner, every few seconds.</summary>
        public static void HearthTick(VillageHearth hearth, VillageState state)
        {
            Safely("prosperity", () => Prosperity.Tick(hearth, state));
            Safely("calendar", () => Calendar.Tick(hearth, state));
            Safely("standing", () => Standing.Daily(hearth));
            Safely("want pile", () => WantPile.Tick(hearth, state));
            Safely("boss stages", () => BossStages.Tick(hearth, state));
            Safely("leaving", () => Leaving.Exodus(hearth, state));
            Safely("help", () => Escort.HelpTick(hearth));
        }

        private sealed class Throttle
        {
            public float Next;
        }

        private static readonly ConditionalWeakTable<Villager, Throttle> Throttles = new ConditionalWeakTable<Villager, Throttle>();

        /// <summary>From the brain on the villager's owner. The daily checks run once a day after 06:00.</summary>
        public static void VillagerTick(Villager villager)
        {
            Throttle throttle = Throttles.GetOrCreateValue(villager);
            if (Time.time < throttle.Next || villager.Zdo == null)
            {
                return;
            }

            throttle.Next = Time.time + Random.Range(15f, 25f);
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid || Hour < 6f || villager.Zdo.GetInt(KeyVillagerDay, -1) == Today)
            {
                return;
            }

            villager.Zdo.Set(KeyVillagerDay, Today);
            bool died = false;
            Safely("elders", () => died = Elders.Daily(villager, hearth));
            if (died)
            {
                return;
            }

            Safely("neighbours", () => Neighbours.Daily(villager));
            Safely("complaints", () => Complaints.Daily(villager, hearth));
        }

        /// <summary>From Dialogue.Note: something happened in the village.</summary>
        public static void Noted(int villageId, string what)
        {
            if (what == "death")
            {
                Prosperity.Hurt(villageId, "a death");
            }
        }

        // ---------------------------------------------------------------- effects read elsewhere

        /// <summary>Extra mood for a villager: what his village's stage leads him to expect, needs gone too long, winter.</summary>
        public static float MoodTerm(Villager villager)
        {
            float term = 0f;
            term += Expectations.Term(villager);
            term += Complaints.MoodTerm(villager);
            term += Calendar.MoodTerm(villager);
            return term;
        }

        /// <summary>How much likelier a visitor is today: prosperity, a festival, how the last visitor found it.</summary>
        public static float VisitorFactor(VillageHearth hearth) =>
            Prosperity.VisitorFactor(hearth) * Calendar.VisitorFactor() * VisitorJudging.ChanceFactor(hearth);

        /// <summary>Store prices for this player from this villager: standing, and the trader's view of his neighbours.</summary>
        public static float PriceFactor(VillageHearth hearth, Villager trader, Player player) =>
            Standing.PriceFactor(hearth, player) * Neighbours.PriceFactor(trader);

        /// <summary>A festival evening: no work after 16:00.</summary>
        public static bool Holiday(int villageId) => Calendar.HolidayNow;

        // ---------------------------------------------------------------- dialogue

        public static IEnumerable<string> Tags(Villager villager, VillageHearth hearth)
        {
            var tags = new List<string>();
            Safely("tags", () =>
            {
                tags.AddRange(Prosperity.Tags(hearth));
                tags.AddRange(Calendar.Tags());
                tags.AddRange(Expectations.Tags(villager));
                tags.AddRange(Standing.Tags(hearth));
                tags.AddRange(Complaints.Tags(villager));
                tags.AddRange(Elders.Tags(villager, hearth));
                tags.AddRange(Neighbours.Tags(villager));
                tags.AddRange(BossStages.Tags(hearth));
                tags.AddRange(Leaving.Tags(villager));
                tags.AddRange(Cultures.Tags(villager));
            });
            return tags;
        }

        public static IEnumerable<string> WandererTags(Villager villager)
        {
            var tags = new List<string>();
            Safely("wanderer tags", () => tags.AddRange(Calendar.Tags()));
            Safely("wanderer culture", () => tags.AddRange(Cultures.Tags(villager)));
            return tags;
        }

        public static string Fill(string line, Villager villager)
        {
            if (line.IndexOf('{') < 0)
            {
                return line;
            }

            line = Calendar.Fill(line, Cultures.OfVillager(villager));
            line = Cultures.Fill(line, villager);
            line = Elders.Fill(line, villager);
            line = Standing.Fill(line, villager);
            line = Complaints.Fill(line, villager);
            line = BossStages.Fill(line, villager);
            line = Leaving.Fill(line, villager);
            return line;
        }
    }
}
