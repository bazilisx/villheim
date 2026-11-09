using System.Globalization;
using System.Linq;
using System.Text;
using UnityEngine;
using Villheim.Logic.Villagers;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Test commands for the living village (config section "6 - Living village"). They work on the nearest village
    /// or villager and whatever the switches say, so each part can be tried by hand.
    /// </summary>
    internal static class LivingCommands
    {
        public static readonly string[] Help =
        {
            "living: the living village at a glance (prosperity, season, expectations, your standing, want, stages, visitors)",
            "prosperity [now|hit]: the nearest village's prosperity; 'now' works it out again, 'hit' takes 15% off",
            "season [next|<days>]: the calendar; 'next' moves it on a season, a number moves it that many days (this session)",
            "festival: today is a festival at every village; the feast starts at 16:00",
            "standing [<points>]: your standing with the nearest village, or change it by that many points",
            "complain [bed|food|safety] [days]: the nearest villager's days without; set one by hand",
            "leave [why]: the nearest villager packs up and leaves now (needs nothing switched on)",
            "migrants: villagers on their way to the nearest village from others",
            "judge: the nearest pedlar or pilgrim's score for his stay so far",
            "want: put up the nearest village's want pile now",
            "stages: what the nearest village may grow to, and which bosses count",
            "elder [days|off|die]: make the nearest villager an elder now, or set his days in the village, make him young again (off), or let an elder die",
            "horn: blow the nearest village's horn (no standing or wait needed)",
            "rescue: protectors run to you now if anything is fighting you",
        };

        private static Villager NearestVillager(Player player, bool wanderers = false) =>
            Character.GetAllCharacters().OfType<Villager>().Where(v => !v.IsDead() && Wanderers.IsWanderer(v) == wanderers)
                .OrderBy(v => Vector3.Distance(v.transform.position, player.transform.position)).FirstOrDefault();

        private static VillageHearth NearestHearth(Player player) =>
            VillageHearth.All.Where(h => h != null && h.IsValid && h.VillageId != 0)
                .OrderBy(h => Vector3.Distance(h.transform.position, player.transform.position)).FirstOrDefault();

        public static string Run(string name, string[] args)
        {
            Player player = Player.m_localPlayer;
            if (player == null)
            {
                return "Villheim: no player.";
            }

            string arg = args.Length > 0 ? args[0].ToLowerInvariant() : "";
            switch (name)
            {
                case "villheim_living": return Living(player);
                case "villheim_prosperity": return Prosperity(player, arg);
                case "villheim_season": return Season(arg);
                case "villheim_festival":
                    Calendar.ForcedFestival = Village.Living.Today;
                    return "Villheim: today is a festival. " + Calendar.Describe();
                case "villheim_standing": return Standing(player, arg);
                case "villheim_complain": return Complain(player, args);
                case "villheim_leave": return Leave(player, arg);
                case "villheim_migrants":
                {
                    VillageHearth hearth = NearestHearth(player);
                    return hearth == null ? "Villheim: no village nearby." : $"Villheim: on their way to {hearth.VillageName}: {Or(Leaving.Migrants(hearth), "nobody")}.";
                }
                case "villheim_judge": return Judge(player);
                case "villheim_want":
                {
                    VillageHearth hearth = NearestHearth(player);
                    if (hearth == null)
                    {
                        return "Villheim: no village nearby.";
                    }

                    WantPile.Tick(hearth, new VillageState(hearth.Zdo), true);
                    return $"Villheim: {hearth.VillageName} {WantPile.Describe(hearth)}.";
                }
                case "villheim_stages":
                {
                    VillageHearth hearth = NearestHearth(player);
                    return hearth == null ? "Villheim: no village nearby." : $"Villheim: {hearth.VillageName}, {BossStages.Describe(hearth)}.";
                }
                case "villheim_elder": return Elder(player, arg);
                case "villheim_horn":
                {
                    VillageHearth hearth = NearestHearth(player);
                    return hearth == null ? "Villheim: no village nearby." : Escort.Horn(hearth, player, true) ? "Villheim: horn blown." : "Villheim: nothing happened.";
                }
                case "villheim_rescue":
                {
                    VillageHearth hearth = NearestHearth(player);
                    if (hearth == null)
                    {
                        return "Villheim: no village nearby.";
                    }

                    Escort.HelpTick(hearth);
                    return $"Villheim: {Escort.Describe(hearth.VillageId)} (needs standing 5 or more, a fight on you, HelpPlayers on).";
                }
                default: return null;
            }
        }

        private static string Or(string text, string empty) => string.IsNullOrEmpty(text) ? empty : text;

        private static string Living(Player player)
        {
            VillageHearth hearth = NearestHearth(player);
            if (hearth == null)
            {
                return "Villheim: no village nearby. " + Calendar.Describe();
            }

            var sb = new StringBuilder();
            sb.Append($"Villheim: {hearth.VillageName}\n");
            sb.Append($"   {Village.Prosperity.Describe(hearth)}\n");
            sb.Append($"   calendar: {Calendar.Describe()}\n");
            sb.Append($"   {Expectations.Describe(hearth.VillageId)}\n");
            sb.Append($"   you: {Villagers.Standing.Describe(hearth, player)}\n");
            sb.Append($"   want: {WantPile.Describe(hearth)}\n");
            sb.Append($"   {BossStages.Describe(hearth)}\n");
            sb.Append($"   visitors: {VisitorJudging.Describe(hearth)}\n");
            sb.Append($"   migrants on the way: {Or(Leaving.Migrants(hearth), "none")}\n");
            sb.Append($"   protectors: {Escort.Describe(hearth.VillageId)}\n");
            sb.Append("   commands: " + string.Join("; ", Help.Select(h => h.Substring(0, h.IndexOf(':')))));
            return sb.ToString();
        }

        private static string Prosperity(Player player, string arg)
        {
            VillageHearth hearth = NearestHearth(player);
            if (hearth == null)
            {
                return "Villheim: no village nearby.";
            }

            if (arg == "hit")
            {
                Village.Prosperity.Hurt(hearth.VillageId, "by hand");
            }
            else if (arg == "now")
            {
                Village.Prosperity.Refresh(hearth);
            }

            return $"Villheim: {hearth.VillageName}, {Village.Prosperity.Describe(hearth)}.";
        }

        private static string Season(string arg)
        {
            if (arg == "next")
            {
                Calendar.Offset += Calendar.DaysPerSeason;
            }
            else if (int.TryParse(arg, NumberStyles.Integer, CultureInfo.InvariantCulture, out int days))
            {
                Calendar.Offset += days;
            }

            return "Villheim: " + Calendar.Describe() + (Calendar.FollowsMod ? "" : $" (offset {Calendar.Offset} days)");
        }

        private static string Standing(Player player, string arg)
        {
            VillageHearth hearth = NearestHearth(player);
            if (hearth == null)
            {
                return "Villheim: no village nearby.";
            }

            if (int.TryParse(arg, NumberStyles.Integer, CultureInfo.InvariantCulture, out int points))
            {
                Villagers.Social.AddReputation(hearth, player, points, points < 0 ? "hurtus" : "gift");
            }

            return $"Villheim: {hearth.VillageName}, your {Villagers.Standing.Describe(hearth, player)}.";
        }

        private static string Complain(Player player, string[] args)
        {
            Villager villager = NearestVillager(player);
            if (villager == null)
            {
                return "Villheim: no villager nearby.";
            }

            if (args.Length >= 2 && int.TryParse(args[1], out int days))
            {
                Complaints.SetDays(villager, args[0].ToLowerInvariant(), days);
            }

            return $"Villheim: {villager.VillagerName}, {Complaints.Describe(villager)}; tags {string.Join(" ", Complaints.Tags(villager))}.";
        }

        private static string Leave(Player player, string arg)
        {
            Villager villager = NearestVillager(player);
            if (villager == null)
            {
                return "Villheim: no villager nearby.";
            }

            return Leaving.Start(villager, arg.Length > 0 ? arg : "mood", true)
                ? $"Villheim: {villager.VillagerName} is leaving {villager.VillageName}."
                : $"Villheim: {villager.VillagerName} can't leave (a child, a visitor, or already going).";
        }

        private static string Judge(Player player)
        {
            Villager visitor = NearestVillager(player, true);
            if (visitor == null || visitor.Zdo == null)
            {
                return "Villheim: no visitor nearby.";
            }

            VillageHearth hearth = VillageHearth.Find(visitor.Zdo.GetInt(Wanderers.KeyVisit));
            return hearth == null
                ? $"Villheim: {visitor.VillagerName} is visiting no village."
                : $"Villheim: {visitor.VillagerName} would score the stay at {hearth.VillageName} {VisitorJudging.Score(visitor, hearth):0.00} now.";
        }

        private static string Elder(Player player, string arg)
        {
            Villager villager = NearestVillager(player);
            VillageHearth hearth = villager != null ? VillageHearth.Find(villager.VillageId) : null;
            if (villager == null || hearth == null)
            {
                return "Villheim: no villager nearby.";
            }

            if (arg == "die")
            {
                if (!Elders.IsElder(villager))
                {
                    return $"Villheim: {villager.VillagerName} is no elder yet ('vh elder 60' first).";
                }

                string name = villager.VillagerName;
                Elders.Die(villager, hearth);
                return $"Villheim: {name} died of old age.";
            }

            // 'vh elder' alone makes the nearest villager an elder now (T-118: it used to only report); 'off' makes him
            // young again; a number sets the days he has lived here.
            int elderDays = LogicConfig.ElderDays != null ? LogicConfig.ElderDays.Value : 40;
            if (string.IsNullOrEmpty(arg))
            {
                Elders.SetDaysHere(villager, Mathf.Max(elderDays, Elders.DaysHere(villager)));
            }
            else if (arg == "off")
            {
                Elders.SetDaysHere(villager, 0);
            }
            else if (int.TryParse(arg, NumberStyles.Integer, CultureInfo.InvariantCulture, out int days))
            {
                Elders.SetDaysHere(villager, days);
            }

            return $"Villheim: {villager.VillagerName} has been in {hearth.VillageName} {Elders.DaysHere(villager)} days" +
                   $"{(Elders.IsElder(villager) ? ", an elder" : "")}.";
        }
    }
}
