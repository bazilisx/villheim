using System.Collections.Generic;
using System.Linq;
using System.Text;
using UnityEngine;
using Villheim.Logic.Villagers;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// D-077 (2026-11-09), first stage: a village's whole roster is rolled when it is founded, so who comes, in which
    /// family and at what age is known from the start and the same after any reload.
    ///
    /// - The first two to arrive are grown villagers who live alone, each in a home of their own (never elders).
    /// - Households after them: a single adult, a couple, a couple with one or two children, an elder couple or a lone
    ///   elder. Families are at most four (two adults, two children); a couple may be of any gender; elders only live
    ///   with elders. One of the first two may be joined later by a partner (and children).
    /// - Each newcomer is the next on the roster: his age, man or woman, and household. A child is born in his
    ///   family's home once a parent lives there. Members of a household take beds in the same home; a new household
    ///   takes beds in a home nobody else has a bed in, where there is one.
    /// - Children do not count toward MaxVillagers; they do count in the population shown.
    /// - A villager's bed stays his: the bed of one who died is kept for him (Beds.Kept).
    ///
    /// - A new home is chosen with as many beds as the next household without one will be, children to come included,
    ///   where the village's designs have one that big (NextHomelessSize, BedsIn).
    /// Only villages founded with this build have a roster; older ones go on as before. Setting VillageRoster.
    /// </summary>
    internal static class Roster
    {
        private static readonly int KeyRoster = "villheim_roster".GetStableHashCode();
        public static readonly int KeyHousehold = "villheim_household".GetStableHashCode();

        public static bool On => LogicConfig.VillageRoster == null || LogicConfig.VillageRoster.Value;

        internal sealed class Entry
        {
            public int Household;
            public char Age; // A adult, C child, E elder
            public bool Female;
        }

        /// <summary>At founding: rolls the roster and keeps it on the hearth.</summary>
        public static void Create(VillageHearth hearth, VillageState state)
        {
            if (!On || hearth.Zdo.GetString(KeyRoster, "").Length > 0)
            {
                return;
            }

            var rng = new System.Random(unchecked(state.Seed * 7349 + 17));
            int grownCap = Mathf.Max(2, VillheimConfig.MaxVillagers.Value);
            var entries = new List<Entry>();
            var later = new List<Entry>();
            int household = 0;
            bool Coin(double p) => rng.NextDouble() < p;

            // The first two: grown, alone, each in his own home.
            for (int i = 0; i < 2; i++)
            {
                entries.Add(new Entry { Household = household, Age = 'A', Female = Coin(0.5) });
                // Now and then one of them is joined later by a partner, and maybe children.
                if (Coin(0.4))
                {
                    later.Add(new Entry { Household = household, Age = 'A', Female = Coin(0.5) });
                    int kids = Coin(0.5) ? rng.Next(1, 3) : 0;
                    for (int k = 0; k < kids; k++)
                    {
                        later.Add(new Entry { Household = household, Age = 'C', Female = Coin(0.5) });
                    }
                }

                household++;
            }

            int grown = 2 + later.Count(e => e.Age == 'A');
            var families = new List<List<Entry>>();
            while (grown < grownCap)
            {
                double roll = rng.NextDouble();
                var family = new List<Entry>();
                if (roll < 0.2)
                {
                    family.Add(new Entry { Household = household, Age = 'A', Female = Coin(0.5) });
                }
                else if (roll < 0.75)
                {
                    family.Add(new Entry { Household = household, Age = 'A', Female = Coin(0.5) });
                    family.Add(new Entry { Household = household, Age = 'A', Female = Coin(0.5) });
                    int kids = roll < 0.4 ? 0 : roll < 0.6 ? 1 : 2;
                    for (int k = 0; k < kids; k++)
                    {
                        family.Add(new Entry { Household = household, Age = 'C', Female = Coin(0.5) });
                    }
                }
                else if (roll < 0.9)
                {
                    family.Add(new Entry { Household = household, Age = 'E', Female = Coin(0.5) });
                    family.Add(new Entry { Household = household, Age = 'E', Female = Coin(0.5) });
                }
                else
                {
                    family.Add(new Entry { Household = household, Age = 'E', Female = Coin(0.5) });
                }

                grown += family.Count(e => e.Age != 'C');
                families.Add(family);
                household++;
            }

            // Arrival order: the late partners of the first two come in among the other households; within a family
            // the grown come first and the children after them.
            var groups = families.Select(f => f).ToList();
            if (later.Count > 0)
            {
                foreach (IGrouping<int, Entry> g in later.GroupBy(e => e.Household))
                {
                    groups.Insert(Mathf.Min(groups.Count, rng.Next(1, Mathf.Max(2, groups.Count))), g.ToList());
                }
            }

            foreach (List<Entry> group in groups)
            {
                entries.AddRange(group.Where(e => e.Age != 'C'));
                entries.AddRange(group.Where(e => e.Age == 'C'));
            }

            hearth.Zdo.Set(KeyRoster, Write(entries));
            VillheimPlugin.Log.LogInfo($"{state.Name}: roster of {entries.Count} ({entries.Count(e => e.Age != 'C')} grown, " +
                                       $"{entries.Count(e => e.Age == 'C')} children) in {household} households: {Describe(entries)}.");
        }

        /// <summary>Who arrives as the village's arrival number <paramref name="arrival"/>, or null with no roster or past its end.</summary>
        public static Entry Next(VillageHearth hearth, int arrival)
        {
            List<Entry> entries = Read(hearth);
            return entries != null && arrival >= 0 && arrival < entries.Count ? entries[arrival] : null;
        }

        public static bool Has(VillageHearth hearth) => On && hearth.Zdo.GetString(KeyRoster, "").Length > 0;

        public static int HouseholdOf(Villager villager) => villager?.Zdo != null ? villager.Zdo.GetInt(KeyHousehold, -1) : -1;

        /// <summary>A loaded member of the household with a claimed bed: where the family lives.</summary>
        public static Vector3 FamilyBed(Villager villager)
        {
            int household = HouseholdOf(villager);
            if (household < 0)
            {
                return Vector3.zero;
            }

            foreach (Character character in Character.GetAllCharacters())
            {
                if (character is Villager other && other != villager && !other.IsDead() && other.VillageId == villager.VillageId &&
                    HouseholdOf(other) == household && Beds.Claimed(other) != Vector3.zero)
                {
                    return Beds.Claimed(other);
                }
            }

            return Vector3.zero;
        }

        /// <summary>
        /// D-077 second stage: how many people the first household without a home will be, counting those still to
        /// come (its children too), so the next home is built with that many beds. 0 when every household has a home.
        /// </summary>
        public static int NextHomelessSize(VillageHearth hearth)
        {
            List<Entry> entries = Read(hearth);
            if (entries == null)
            {
                return 0;
            }

            var housed = new HashSet<int>();
            foreach (Character character in Character.GetAllCharacters())
            {
                if (character is Villager v && !v.IsDead() && v.VillageId == hearth.VillageId && HouseholdOf(v) >= 0)
                {
                    Plot home = Beds.Claimed(v) != Vector3.zero ? Beds.PlotAt(hearth, Beds.Claimed(v)) : null;
                    if (home != null && Households.IsHome(home))
                    {
                        housed.Add(HouseholdOf(v));
                    }
                }
            }

            foreach (int household in entries.Select(e => e.Household).Distinct())
            {
                if (!housed.Contains(household))
                {
                    return entries.Count(e => e.Household == household);
                }
            }

            return 0;
        }

        private static readonly Dictionary<string, int> BedCounts = new Dictionary<string, int>();

        /// <summary>Beds in a design (blueprints; a copied location counts as one).</summary>
        public static int BedsIn(Designs.DesignLibrary.Design design)
        {
            if (BedCounts.TryGetValue(design.Name, out int known))
            {
                return known;
            }

            int beds = design.Blueprint != null
                ? design.Blueprint.Pieces.Count(p => p.Prefab == "bed" || p.Prefab.StartsWith("piece_bed"))
                : 1;
            BedCounts[design.Name] = beds;
            return beds;
        }

        /// <summary>The seed nearest <paramref name="seed"/> that gives a man or a woman (VillagerLooks.IsFemale's rule).</summary>
        public static int SeedFor(int seed, bool female)
        {
            for (int i = 0; i < 64; i++)
            {
                int s = Mathf.Max(1, seed + i);
                if ((new System.Random(s).Next(2) == 1) == female)
                {
                    return s;
                }
            }

            return seed;
        }

        private static readonly Dictionary<string, List<Entry>> Parsed = new Dictionary<string, List<Entry>>();

        private static List<Entry> Read(VillageHearth hearth)
        {
            string raw = hearth.Zdo.GetString(KeyRoster, "");
            if (raw.Length == 0)
            {
                return null;
            }

            if (Parsed.TryGetValue(raw, out List<Entry> known))
            {
                return known;
            }

            var entries = new List<Entry>();
            foreach (string part in raw.Split(';'))
            {
                string[] f = part.Split(':');
                if (f.Length == 3 && int.TryParse(f[0], out int h) && f[1].Length == 1 && f[2].Length == 1)
                {
                    entries.Add(new Entry { Household = h, Age = f[1][0], Female = f[2][0] == 'F' });
                }
            }

            Parsed[raw] = entries;
            return entries;
        }

        private static string Write(List<Entry> entries) =>
            string.Join(";", entries.Select(e => $"{e.Household}:{e.Age}:{(e.Female ? 'F' : 'M')}"));

        private static string Describe(List<Entry> entries)
        {
            var text = new StringBuilder();
            foreach (IGrouping<int, Entry> g in entries.GroupBy(e => e.Household).OrderBy(g => g.Key))
            {
                if (text.Length > 0)
                {
                    text.Append(", ");
                }

                text.Append(string.Concat(g.Select(e => e.Age == 'C' ? (e.Female ? "g" : "b") : e.Age == 'E' ? (e.Female ? "W" : "O") : (e.Female ? "F" : "M"))));
            }

            return text.ToString();
        }

        public static string Report(VillageHearth hearth)
        {
            List<Entry> entries = Read(hearth);
            if (entries == null)
            {
                return "No roster (founded before rosters, or VillageRoster off).";
            }

            int arrived = new VillageState(hearth.Zdo).Arrivals;
            return $"Roster ({arrived} of {entries.Count} arrived; M man, F woman, O old man, W old woman, b boy, g girl; one group per household): " +
                   Describe(entries);
        }
    }
}
