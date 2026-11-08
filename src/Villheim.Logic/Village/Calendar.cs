using System.Collections.Generic;
using System.Reflection;
using UnityEngine;
using Villheim.Logic.Villagers;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// The village calendar, festivals and winter stores (proposals 3 and 21 in docs/LIVING_WORLD_RESEARCH.md).
    ///
    /// - Four seasons of DaysPerSeason days (10, as the Seasons mod has by default), a year of 40 days, counted from
    ///   day 1 of the world. With shudnal's Seasons installed (Unlicense) and ReadSeasonsMod on, its season and day
    ///   are read by reflection instead, so both agree. Nothing of its code is used, only its public state.
    /// - Festivals on FestivalDay of each season: the sowing feast, the midsummer fire, the harvest feast, Yule. That
    ///   day work stops at 16:00, the evening is a feast at the hearth (Gatherings), everyone takes the "festival"
    ///   thought (+10 for a day), visitors are three times as likely, and with WorldLife on a pilgrim comes from a
    ///   neighbour the village is on good terms with (above 20). A chronicle line marks it.
    /// - Winter stores (WinterStores): in autumn the village keeps half again as much wood and twice the food; in winter
    ///   farmers and foragers rest, free time goes to the fire, rain in the open hurts more, and each winter morning
    ///   with less than 5 wood in the chest gives everyone "coldhome" (-6).
    /// - Dialogue: season:spring/summer/autumn/winter, seasonday:early/mid/late, festival:sowing/midsummer/harvest/yule
    ///   and festivalday on the day, festivalsoon two days before, holiday on the evening; fill-ins {season},
    ///   {festival}, {nextfestival}, {daystofestival}.
    /// </summary>
    internal static class Calendar
    {
        public static readonly string[] Seasons = { "spring", "summer", "autumn", "winter" };
        private static readonly string[] FestivalTags = { "sowing", "midsummer", "harvest", "yule" };
        private static readonly string[] FestivalNames = { "the sowing feast", "the midsummer fire", "the harvest feast", "Yule" };

        private static readonly int KeyDay = "villheim_cal_day".GetStableHashCode();
        private static readonly int KeyFeastDay = "villheim_cal_feast".GetStableHashCode();

        /// <summary>Days added to the world's day by 'vh season next' (this session only).</summary>
        public static int Offset;

        /// <summary>A day made a festival by 'vh festival'.</summary>
        public static int ForcedFestival = -1;

        public static bool On => Living.On(LogicConfig.Calendar);

        private static bool FestivalsOn => On && Living.On(LogicConfig.Festivals);

        private static bool StoresOn => On && Living.On(LogicConfig.WinterStores);

        public static int DaysPerSeason => Mathf.Max(1, LogicConfig.DaysPerSeason != null ? LogicConfig.DaysPerSeason.Value : 10);

        private static int FestivalDayOfSeason => Mathf.Clamp(LogicConfig.FestivalDay != null ? LogicConfig.FestivalDay.Value : 5, 1, DaysPerSeason);

        // ---------------------------------------------------------------- the date

        /// <summary>Season index (0 spring to 3 winter) and day of the season (1 up).</summary>
        public static void Now(out int season, out int day, out int length)
        {
            if (ModSeason(out season, out day, out length))
            {
                return;
            }

            length = DaysPerSeason;
            int index = Mathf.Max(0, Living.Today + Offset - 1);
            season = index / length % 4;
            day = index % length + 1;
        }

        public static int SeasonIndex
        {
            get
            {
                Now(out int season, out _, out _);
                return season;
            }
        }

        public static string Season => Seasons[SeasonIndex];

        public static bool IsWinter => On && SeasonIndex == 3;

        public static bool IsAutumn => On && SeasonIndex == 2;

        public static bool FestivalToday
        {
            get
            {
                if (!FestivalsOn)
                {
                    return false;
                }

                Now(out _, out int day, out int length);
                return ForcedFestival == Living.Today || day == Mathf.Min(FestivalDayOfSeason, length);
            }
        }

        /// <summary>A festival evening: work stops from 16:00.</summary>
        public static bool HolidayNow => FestivalToday && Living.Hour >= 16f;

        private static int DaysToFestival()
        {
            Now(out _, out int day, out int length);
            int festival = Mathf.Min(FestivalDayOfSeason, length);
            return day <= festival ? festival - day : length - day + festival;
        }

        private static string NextFestival(string culture = Cultures.Fallback)
        {
            Now(out int season, out int day, out int length);
            return Cultures.Festival(culture, day <= Mathf.Min(FestivalDayOfSeason, length) ? season : (season + 1) % 4);
        }

        // ---------------------------------------------------------------- shudnal's Seasons, read softly

        private static bool _modLooked;
        private static object _modState;
        private static MethodInfo _modSeason;
        private static MethodInfo _modDay;
        private static MethodInfo _modDays;
        private static bool _modFailed;

        private static bool ModSeason(out int season, out int day, out int length)
        {
            season = 0;
            day = 1;
            length = DaysPerSeason;
            if (_modFailed || LogicConfig.ReadSeasonsMod == null || !LogicConfig.ReadSeasonsMod.Value)
            {
                return false;
            }

            try
            {
                if (!_modLooked || _modState == null)
                {
                    _modLooked = true;
                    if (!BepInEx.Bootstrap.Chainloader.PluginInfos.TryGetValue("shudnal.Seasons", out BepInEx.PluginInfo info) || info.Instance == null)
                    {
                        _modFailed = true;
                        return false;
                    }

                    System.Type type = info.Instance.GetType();
                    FieldInfo field = type.GetField("seasonState", BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic);
                    _modState = field?.GetValue(null);
                    if (_modState == null)
                    {
                        return false;
                    }

                    System.Type stateType = _modState.GetType();
                    _modSeason = stateType.GetMethod("GetCurrentSeason", System.Type.EmptyTypes);
                    _modDay = stateType.GetMethod("GetCurrentDay", System.Type.EmptyTypes);
                    _modDays = stateType.GetMethod("GetDaysInSeason", System.Type.EmptyTypes);
                    if (_modSeason == null || _modDay == null)
                    {
                        _modFailed = true;
                        return false;
                    }

                    VillheimPlugin.Log.LogInfo("Villheim: the calendar follows the Seasons mod.");
                }

                // Its seasons are Spring 0, Summer 1, Fall 2, Winter 3, as ours.
                season = Mathf.Clamp(System.Convert.ToInt32(_modSeason.Invoke(_modState, null)), 0, 3);
                day = Mathf.Max(1, System.Convert.ToInt32(_modDay.Invoke(_modState, null)));
                length = _modDays != null ? Mathf.Max(1, System.Convert.ToInt32(_modDays.Invoke(_modState, null))) : DaysPerSeason;
                return true;
            }
            catch (System.Exception e)
            {
                _modFailed = true;
                VillheimPlugin.Log.LogWarning($"Villheim: could not read the Seasons mod, using our own calendar ({e.Message}).");
                return false;
            }
        }

        public static bool FollowsMod => !_modFailed && _modState != null;

        // ---------------------------------------------------------------- the hearth's day

        public static void Tick(VillageHearth hearth, VillageState state)
        {
            if (!On || EnvMan.instance == null)
            {
                return;
            }

            ZDO zdo = hearth.Zdo;
            int today = Living.Today;
            if (zdo.GetInt(KeyDay, -1) != today && Living.Hour >= 6f)
            {
                zdo.Set(KeyDay, today);
                Morning(hearth, state);
            }

            if (HolidayNow && zdo.GetInt(KeyFeastDay, -1) != today)
            {
                zdo.Set(KeyFeastDay, today);
                FestivalEvening(hearth, state);
            }
        }

        private static void Morning(VillageHearth hearth, VillageState state)
        {
            Now(out int season, out int day, out _);
            if (day == 1)
            {
                Chronicle.Add(hearth, $"{Capital(Seasons[season])} came to {state.Name}.");
                Dialogue.Note(state.Id, "newseason");
            }

            if (FestivalToday)
            {
                Dialogue.Note(state.Id, "festivalmorning");
            }

            if (IsWinter && StoresOn && state.Plots.Count > 0)
            {
                Container chest = VillageChest.Find(hearth);
                if (chest != null && VillageChest.Count(chest, Materials.Wood) < 5)
                {
                    Moods.VillageThink(state.Id, "coldhome");
                    Dialogue.Note(state.Id, "coldhome");
                }
            }
        }

        private static void FestivalEvening(VillageHearth hearth, VillageState state)
        {
            Now(out int season, out _, out _);
            Gatherings.Feast(state.Id);
            Moods.VillageThink(state.Id, "festival");
            Dialogue.Note(state.Id, "festival");
            Chronicle.Add(hearth, $"{state.Name} held {Cultures.Festival(Cultures.Of(state), season)} at the hearth.");
            if (Living.World)
            {
                foreach (ZDO other in Relations.AllHearths())
                {
                    int id = other.GetInt(Keys.VillageId);
                    if (id != state.Id && Utils.DistanceXZ(other.GetPosition(), hearth.transform.position) < 4000f &&
                        Relations.View(hearth.Zdo, id) > 20)
                    {
                        WorldLife.SendVisitor(hearth, Wanderers.Pilgrim);
                        break;
                    }
                }
            }
        }

        // ---------------------------------------------------------------- effects

        /// <summary>Visitors are three times as likely on a festival day.</summary>
        public static float VisitorFactor() => FestivalToday ? 3f : 1f;

        /// <summary>Wood the village keeps between buildings: half again as much in autumn.</summary>
        public static float WoodFactor() => StoresOn && IsAutumn ? 1.5f : 1f;

        /// <summary>Food the village keeps: twice as much in autumn.</summary>
        public static int FoodFactor() => StoresOn && IsAutumn ? 2 : 1;

        /// <summary>Farmers and foragers rest in winter.</summary>
        public static bool FieldsRest => StoresOn && IsWinter;

        /// <summary>Free time by the fire: twice as likely in winter.</summary>
        public static float FireFactor() => StoresOn && IsWinter ? 2f : 1f;

        /// <summary>Rain in the open in winter is cold: -3 more.</summary>
        public static float MoodTerm(Villager villager)
        {
            if (!StoresOn || !IsWinter || !EnvMan.IsWet() || Cover.IsUnderRoof(villager.transform.position + Vector3.up))
            {
                return 0f;
            }

            return -3f;
        }

        // ---------------------------------------------------------------- dialogue

        public static IEnumerable<string> Tags()
        {
            if (!On)
            {
                yield break;
            }

            Now(out int season, out int day, out int length);
            yield return "season:" + Seasons[season];
            yield return "seasonday:" + (day * 3 <= length ? "early" : day * 3 <= length * 2 ? "mid" : "late");
            if (FestivalToday)
            {
                yield return "festivalday";
                yield return "festival:" + FestivalTags[season];
                if (HolidayNow)
                {
                    yield return "holiday";
                }
            }
            else if (FestivalsOn && DaysToFestival() <= 2)
            {
                yield return "festivalsoon";
            }
        }

        public static string Fill(string line, string culture = Cultures.Fallback)
        {
            if (!line.Contains("{season") && !line.Contains("festival}") && !line.Contains("{daystofestival}"))
            {
                return line;
            }

            // Each culture names the four feasts its own way (Cultures.Festival): Yule in a Norse village, Koliada in a
            // Slavic one.
            Now(out int season, out _, out _);
            int days = DaysToFestival();
            return line.Replace("{season}", Seasons[season])
                .Replace("{festival}", FestivalToday ? Cultures.Festival(culture, season) : NextFestival(culture))
                .Replace("{nextfestival}", NextFestival(culture))
                .Replace("{daystofestival}", days == 0 ? "today" : days == 1 ? "tomorrow" : $"in {PlayerMemory.Number(days)} days");
        }

        public static string Describe()
        {
            Now(out int season, out int day, out int length);
            return $"{Seasons[season]}, day {day} of {length}{(FollowsMod ? " (from the Seasons mod)" : "")}; " +
                   $"{(FestivalToday ? FestivalNames[season] + " today" : NextFestival() + " in " + DaysToFestival() + " days")}" +
                   $"{(HolidayNow ? ", holiday now" : "")}; wood x{WoodFactor():0.0}, food x{FoodFactor()}, " +
                   $"fields {(FieldsRest ? "resting" : "worked")}";
        }

        private static string Capital(string text) => char.ToUpperInvariant(text[0]) + text.Substring(1);
    }
}
