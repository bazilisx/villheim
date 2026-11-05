using UnityEngine;

namespace Villheim
{
    internal static class Names
    {
        private static readonly string[] VillageStarts =
        {
            "Ask", "Birk", "Eik", "Fjall", "Grim", "Hag", "Hval", "Ulf", "Rav", "Stein", "Sol", "Ting", "Varg",
            "Bjorn", "Frey", "Gull", "Hrafn", "Kald", "Lyng", "Mjo", "Nord", "Odd", "Sig", "Tor", "Elg", "Ran",
            "Hjort", "Lind", "Ros", "Skog"
        };

        private static readonly string[] VillageEnds =
        {
            "heim", "vik", "by", "stad", "dal", "nes", "fjord", "holt", "berg", "tun", "vang", "land", "voll", "seter"
        };

        private static readonly string[] MaleNames =
        {
            "Arne", "Bjarke", "Eirik", "Gunnar", "Halvard", "Ivar", "Leif", "Njal", "Orm", "Ragnar", "Sigurd",
            "Sven", "Torstein", "Ulf", "Vidar", "Asgeir", "Brand", "Egil", "Hakon", "Ketil", "Rolf", "Snorri"
        };

        private static readonly string[] FemaleNames =
        {
            "Astrid", "Bodil", "Dagny", "Freydis", "Gudrun", "Hild", "Ingrid", "Jorunn", "Ragna", "Sigrid",
            "Solveig", "Thora", "Unn", "Vigdis", "Aslaug", "Gunnhild", "Helga", "Ylva", "Runa", "Signe"
        };

        public static string Village(System.Random rng)
        {
            string start = VillageStarts[rng.Next(VillageStarts.Length)];
            string end = VillageEnds[rng.Next(VillageEnds.Length)];
            return start + end;
        }

        /// <summary>Picks a name matching the model the looks seed will choose (same first roll).</summary>
        public static string Villager(int looksSeed)
        {
            var looks = new System.Random(looksSeed);
            bool female = looks.Next(2) == 1;
            var rng = new System.Random(looksSeed * 31 + 7);
            string[] pool = female ? FemaleNames : MaleNames;
            return pool[rng.Next(pool.Length)];
        }

        public static Vector3 Horizontal(this Vector3 v)
        {
            return new Vector3(v.x, 0f, v.z);
        }
    }
}
