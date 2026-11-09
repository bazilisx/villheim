using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Who lives in which home (Tyler, D-073). A villager's home is the building his claimed bed stands in (Beds). The
    /// villagers whose beds stand in the same home are its household: one villager lives alone, two or more are a
    /// family, each in his own bed. Worked out from the bed claims kept on each villager, so it is the same after a
    /// reload. Only homes count (House plots, and plots from before roles); a bed in the longhouse is no home of one's
    /// own.
    ///
    /// The household's head is its first member in the village's arrival order. The family's name is the head's
    /// surname, where his people use one, else "Bjorn's house".
    /// </summary>
    internal static class Households
    {
        internal sealed class Household
        {
            public Plot Plot;

            /// <summary>Grown members first in order of arrival, then children, oldest first.</summary>
            public readonly List<Villager> Members = new List<Villager>();

            public Villager Head => Members.Count > 0 ? Members[0] : null;
            public bool IsFamily => Members.Count >= 2;
        }

        private static readonly Dictionary<int, (float Time, List<Household> Homes)> Cache = new Dictionary<int, (float, List<Household>)>();

        public static void Forget(int villageId) => Cache.Remove(villageId);

        /// <summary>A plot that can be someone's home.</summary>
        public static bool IsHome(Plot plot) => plot != null && (string.IsNullOrEmpty(plot.Role) || plot.Role == nameof(Designs.Role.House));

        /// <summary>Every home of the village with somebody living in it (loaded villagers only). Every five seconds.</summary>
        public static List<Household> Of(VillageHearth hearth)
        {
            if (hearth == null || !hearth.IsValid)
            {
                return new List<Household>();
            }

            int id = hearth.VillageId;
            if (Cache.TryGetValue(id, out var cached) && Time.time - cached.Time < 5f &&
                cached.Homes.All(h => h.Members.All(m => m != null && !m.IsDead())))
            {
                return cached.Homes;
            }

            var state = new VillageState(hearth.Zdo);
            var homes = new List<Household>();
            foreach (Character character in Character.GetAllCharacters())
            {
                if (!(character is Villager villager) || villager.IsDead() || villager.VillageId != id || villager.Zdo == null ||
                    Wanderers.IsWanderer(villager))
                {
                    continue;
                }

                Vector3 bed = Beds.Claimed(villager);
                if (bed == Vector3.zero)
                {
                    continue;
                }

                Plot plot = PlotAt(state, bed);
                if (!IsHome(plot))
                {
                    continue;
                }

                Household home = homes.FirstOrDefault(h => Utils.DistanceXZ(h.Plot.Position, plot.Position) < 0.5f);
                if (home == null)
                {
                    home = new Household { Plot = plot };
                    homes.Add(home);
                }

                home.Members.Add(villager);
            }

            foreach (Household home in homes)
            {
                home.Members.Sort(Compare);
            }

            // Same order on every client.
            homes.Sort((a, b) => a.Plot.Position.sqrMagnitude.CompareTo(b.Plot.Position.sqrMagnitude));
            Cache[id] = (Time.time, homes);
            return homes;
        }

        /// <summary>The household the villager belongs to, or null when his bed is in no home (or he has none).</summary>
        public static Household Of(Villager villager)
        {
            VillageHearth hearth = villager != null ? VillageHearth.Find(villager.VillageId) : null;
            return hearth == null ? null : Of(hearth).FirstOrDefault(h => h.Members.Contains(villager));
        }

        /// <summary>The household living in this plot, or null.</summary>
        public static Household At(VillageHearth hearth, Plot plot) =>
            plot == null ? null : Of(hearth).FirstOrDefault(h => Utils.DistanceXZ(h.Plot.Position, plot.Position) < 0.5f);

        private static int Compare(Villager a, Villager b)
        {
            bool childA = Childhood.IsChild(a), childB = Childhood.IsChild(b);
            if (childA != childB)
            {
                return childA ? 1 : -1;
            }

            int byArrival = a.Zdo.GetInt(Roles.KeyArrival, -1).CompareTo(b.Zdo.GetInt(Roles.KeyArrival, -1));
            return byArrival != 0 ? byArrival : a.Zdo.GetInt(Keys.VillagerSeed).CompareTo(b.Zdo.GetInt(Keys.VillagerSeed));
        }

        private static Plot PlotAt(VillageState state, Vector3 point)
        {
            Plot best = null;
            float bestDistance = float.MaxValue;
            foreach (Plot plot in state.Plots)
            {
                float distance = Utils.DistanceXZ(plot.Position, point);
                if (distance < plot.Radius && distance < bestDistance)
                {
                    best = plot;
                    bestDistance = distance;
                }
            }

            return best;
        }

        // ---------------------------------------------------------------- names, roles and colors for the signs

        /// <summary>The surname the villager's people give him, or "" (some peoples use none, or CultureSurnames is off).</summary>
        public static string Surname(Villager villager)
        {
            if (villager?.Zdo == null || !Cultures.On || LogicConfig.CultureSurnames == null || !LogicConfig.CultureSurnames.Value ||
                villager.VillagerName.Contains(" "))
            {
                return "";
            }

            return Names.Surname(villager.Zdo.GetInt(Keys.VillagerSeed), Cultures.OfVillager(villager));
        }

        /// <summary>The family's name for the sign: the head's surname, or "Bjorn's house".</summary>
        public static string FamilyName(Household home)
        {
            Villager head = home?.Head;
            if (head == null)
            {
                return "";
            }

            string surname = Surname(head);
            return surname.Length > 0 ? surname : head.VillagerName + "'s house";
        }

        /// <summary>
        /// The villager's role in a word: child, the leader's title (Jarl), elder, his trade (cook, farmer...), and with
        /// no trade (a village under six) his background: guard for a protector, carer for a carer.
        /// </summary>
        public static string RoleWord(Villager villager)
        {
            string title = Roles.Title(villager);
            if (!string.IsNullOrEmpty(title))
            {
                return title;
            }

            return Roles.BackgroundOf(villager) == Roles.Background.Protector ? "guard" : "carer";
        }

        /// <summary>A light color that goes with the role, readable on a wooden sign.</summary>
        public static string RoleColor(Villager villager)
        {
            if (Roles.IsJarl(villager))
            {
                return "#fd6"; // gold
            }

            switch (RoleWord(villager))
            {
                case "child": return "#adf";      // light blue
                case "elder": return "#dcf";      // pale violet
                case "carpenter": return "#eca";  // light wood
                case "woodcutter": return "#cb8"; // bark brown
                case "miner": return "#ccd";      // stone gray
                case "cook": return "#fa8";       // warm orange
                case "farmer": return "#bfb";     // green
                case "guard": return "#f99";      // red
                case "carer": return "#ffc";      // pale yellow
                default: return "#ddd";
            }
        }

        private static string Capital(string text) =>
            string.IsNullOrEmpty(text) ? text : char.ToUpperInvariant(text[0]) + text.Substring(1);

        /// <summary>One villager's sign: his full name on top, his role below in its color.</summary>
        public static string PersonText(Villager villager) =>
            $"<#fff>{Cultures.FullName(villager)}<br><{RoleColor(villager)}>{Capital(RoleWord(villager))}";

        /// <summary>The front door sign: a lone villager's own sign, or the family's name over its members.</summary>
        public static string HomeText(Household home)
        {
            if (home == null || home.Members.Count == 0)
            {
                return "";
            }

            if (!home.IsFamily)
            {
                return PersonText(home.Head);
            }

            string members = string.Join("<#fff>, ", home.Members.Select(m => $"<{RoleColor(m)}>{m.VillagerName}"));
            return $"<#fff>{FamilyName(home)}<br><size=75%>{members}";
        }

        /// <summary>For 'vh homes': each home, who lives there and what its signs say.</summary>
        public static List<string> Report(VillageHearth hearth)
        {
            var lines = new List<string>();
            var state = new VillageState(hearth.Zdo);
            List<Household> homes = Of(hearth);
            foreach (Plot plot in state.Plots.Where(IsHome))
            {
                Household home = homes.FirstOrDefault(h => Utils.DistanceXZ(h.Plot.Position, plot.Position) < 0.5f);
                string who = home == null
                    ? "nobody"
                    : string.Join(", ", home.Members.Select(m => $"{m.VillagerName} ({RoleWord(m)})"));
                string kind = home == null ? "empty" : home.IsFamily ? $"family {FamilyName(home)}" : "lone villager";
                lines.Add($"{plot.Design} at {plot.Position.ToString("F0")}: {kind}: {who}. {HouseSigns.Describe(hearth, plot)}");
            }

            return lines;
        }
    }
}
