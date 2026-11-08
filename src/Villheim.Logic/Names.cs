using System.Linq;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic
{
    /// <summary>
    /// Village and villager names, from the culture's lists in Cultures/cultures.txt (Village/Cultures.cs). Every
    /// name comes from a seed, so the same seed always gives the same name.
    /// </summary>
    internal static class Names
    {
        public static string Village(System.Random rng) => Village(rng, Cultures.Fallback);

        /// <summary>A place name from the culture's parts: "Sabz" + "abad", "Dun" + "more".</summary>
        public static string Village(System.Random rng, string culture)
        {
            Cultures.Culture c = Cultures.Get(culture);
            string[] starts = c.PlaceStart.Length > 0 ? c.PlaceStart : Cultures.Get(Cultures.Fallback).PlaceStart;
            string[] ends = c.PlaceEnd.Length > 0 ? c.PlaceEnd : Cultures.Get(Cultures.Fallback).PlaceEnd;
            if (starts.Length == 0 || ends.Length == 0)
            {
                return "Villheim";
            }

            string start = starts[rng.Next(starts.Length)];
            string end = ends[rng.Next(ends.Length)];

            // "Ab" + "abad" reads as "Ababad"; one shared letter is dropped when a part ends as the next begins.
            if (start.Length > 1 && end.Length > 1 && char.ToLowerInvariant(start[start.Length - 1]) == end[0] &&
                "aeiou".IndexOf(end[0]) >= 0)
            {
                end = end.Substring(1);
            }

            return start + end;
        }

        /// <summary>A home place for a villager of this culture (where a newcomer says he is from).</summary>
        public static string Place(int seed, string culture) => Village(new System.Random(unchecked(seed * 613 + 29)), culture);

        /// <summary>The model the looks seed will choose (same first roll as VillagerLooks).</summary>
        public static bool IsFemale(int looksSeed) => new System.Random(looksSeed).Next(2) == 1;

        /// <summary>A Norse name, for code that has no village at hand.</summary>
        public static string Villager(int looksSeed) => Villager(looksSeed, Cultures.Fallback);

        /// <summary>A given name of the culture, matching the model the looks seed will choose.</summary>
        public static string Villager(int looksSeed, string culture)
        {
            bool female = IsFemale(looksSeed);
            Cultures.Culture c = Cultures.Get(culture);
            string[] pool = female ? c.Female : c.Male;
            if (pool.Length == 0)
            {
                pool = female ? Cultures.Get(Cultures.Fallback).Female : Cultures.Get(Cultures.Fallback).Male;
            }

            if (pool.Length == 0)
            {
                return female ? "Astrid" : "Bjorn";
            }

            var rng = new System.Random(looksSeed * 31 + 7);
            return pool[rng.Next(pool.Length)];
        }

        /// <summary>
        /// The surname a villager of this culture carries, or "" (some peoples use none, and in others not everyone
        /// does): Haraldsson or Haraldsdottir, mac Cormac or ingen Cormac, ibn Hasan or bint Hasan, Yaroslavich or
        /// Yaroslavna, de Falaise, or a family name such as Doukas and Doukaina.
        /// </summary>
        public static string Surname(int looksSeed, string culture)
        {
            Cultures.Culture c = Cultures.Get(culture);
            var rng = new System.Random(unchecked(looksSeed * 131 + 17));
            if (c.Surname == "none" || rng.NextDouble() >= c.SurnameChance)
            {
                return "";
            }

            bool female = IsFemale(looksSeed);
            string father = c.Male.Length > 0 ? c.Male[rng.Next(c.Male.Length)] : "";
            switch (c.Surname)
            {
                case "norse":
                    return father.Length == 0 ? "" : NorseStem(father) + (female ? "dottir" : "son");
                case "mac":
                    return father.Length == 0 ? "" : (female ? "ingen " : "mac ") + father;
                case "ibn":
                    return father.Length == 0 ? "" : (female ? "bint " : "ibn ") + father;
                case "slavic":
                    return father.Length == 0 ? "" : SlavicPatronymic(father, female);
                case "de":
                    return c.Seats.Length == 0 ? "" : "de " + c.Seats[rng.Next(c.Seats.Length)];
                case "list":
                    if (c.Families.Length == 0)
                    {
                        return "";
                    }

                    (string male, string fem) = c.Families[rng.Next(c.Families.Length)];
                    return female ? fem : male;
                default:
                    return "";
            }
        }

        /// <summary>Snorri to Snorra-, Leif to Leifs-, as in Snorrason and Leifsson.</summary>
        private static string NorseStem(string father)
        {
            char last = char.ToLowerInvariant(father[father.Length - 1]);
            return "aeiouy".IndexOf(last) >= 0 ? father.Substring(0, father.Length - 1) + "a" : father + "s";
        }

        /// <summary>Yaroslav to Yaroslavich and Yaroslavna; Gleb to Glebovich and Glebovna; Dobrynya to Dobrynich.</summary>
        private static string SlavicPatronymic(string father, bool female)
        {
            char last = char.ToLowerInvariant(father[father.Length - 1]);
            if (last == 'a')
            {
                // Putyata to Putyatich and Putyatichna, as Nikita gives Nikitich.
                string stem = father.Substring(0, father.Length - 1);
                if (stem.EndsWith("y")) stem = stem.Substring(0, stem.Length - 1);
                return stem + (female ? "ichna" : "ich");
            }

            if ("eiouy".IndexOf(last) >= 0)
            {
                father = father.Substring(0, father.Length - 1);
            }

            bool slav = father.EndsWith("slav") || father.EndsWith("mysl");
            return father + (slav ? (female ? "na" : "ich") : (female ? "ovna" : "ovich"));
        }

        public static Vector3 Horizontal(this Vector3 v)
        {
            return new Vector3(v.x, 0f, v.z);
        }
    }
}
