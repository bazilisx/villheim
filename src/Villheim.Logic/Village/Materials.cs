using System;
using System.Collections.Generic;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// The building materials villages gather and spend. Other ingredients in a piece's vanilla recipe
    /// (resin, leather, metal) are not tracked, so they cost nothing for now.
    ///
    /// A village only builds with what grows or lies around in its own biome. Meadows has no pine, so a Meadows
    /// village never builds anything that needs core wood. The table can be changed in the config.
    /// </summary>
    internal static class Materials
    {
        public const string Wood = "Wood";
        public const string FineWood = "FineWood";
        public const string CoreWood = "RoundLog";
        public const string Stone = "Stone";

        public static readonly HashSet<string> Tracked = new HashSet<string> { Wood, FineWood, CoreWood, Stone };
        public static readonly HashSet<string> WoodTypes = new HashSet<string> { Wood, FineWood, CoreWood };

        public const string DefaultBiomeMaterials =
            "Meadows: Wood, FineWood, Stone; BlackForest: Wood, RoundLog, Stone; Swamp: Wood, Stone; " +
            "Mountain: Wood, Stone; Plains: Wood, FineWood, Stone; Mistlands: Wood, Stone";

        private static string _parsedFrom;
        private static readonly Dictionary<Heightmap.Biome, HashSet<string>> Allowed =
            new Dictionary<Heightmap.Biome, HashSet<string>>();

        public static string Label(string material)
        {
            switch (material)
            {
                case Wood: return "wood";
                case FineWood: return "fine wood";
                case CoreWood: return "core wood";
                case Stone: return "stone";
                default: return material.ToLowerInvariant();
            }
        }

        /// <summary>The materials that can be found in a biome. Biomes not in the table get wood and stone.</summary>
        public static HashSet<string> AllowedIn(Heightmap.Biome biome)
        {
            string raw = LogicConfig.BiomeMaterials?.Value ?? DefaultBiomeMaterials;
            if (raw != _parsedFrom)
            {
                Parse(raw);
            }

            return Allowed.TryGetValue(biome, out HashSet<string> set) ? set : Fallback;
        }

        private static readonly HashSet<string> Fallback = new HashSet<string> { Wood, Stone };

        private static void Parse(string raw)
        {
            _parsedFrom = raw;
            Allowed.Clear();
            foreach (string part in raw.Split(';'))
            {
                int colon = part.IndexOf(':');
                if (colon <= 0 || !Enum.TryParse(part.Substring(0, colon).Trim(), true, out Heightmap.Biome biome))
                {
                    continue;
                }

                var set = new HashSet<string>();
                foreach (string material in part.Substring(colon + 1).Split(','))
                {
                    string name = material.Trim();
                    foreach (string tracked in Tracked)
                    {
                        if (string.Equals(tracked, name, StringComparison.OrdinalIgnoreCase))
                        {
                            name = tracked;
                        }
                    }

                    if (name.Length > 0)
                    {
                        set.Add(name);
                    }
                }

                Allowed[biome] = set;
            }
        }

        private static readonly Dictionary<string, string> SharedNames = new Dictionary<string, string>();

        /// <summary>The item's display token ("$item_wood"), which is what inventories count by.</summary>
        public static string SharedName(string material)
        {
            if (SharedNames.TryGetValue(material, out string name))
            {
                return name;
            }

            GameObject prefab = ObjectDB.instance ? ObjectDB.instance.GetItemPrefab(material) : null;
            name = prefab != null ? prefab.GetComponent<ItemDrop>()?.m_itemData?.m_shared?.m_name : null;
            if (name != null)
            {
                SharedNames[material] = name;
            }

            return name;
        }

        public static GameObject Prefab(string material)
        {
            return ObjectDB.instance ? ObjectDB.instance.GetItemPrefab(material) : null;
        }
    }
}
