using System.Collections.Generic;
using System.Globalization;
using UnityEngine;

namespace Villheim.Logic.Designs
{
    /// <summary>
    /// The pool of existing designs a village may copy, read from the config.
    /// A design is any location registered with the game's ZoneSystem: vanilla ones, or ones added by other mods.
    /// </summary>
    internal static class DesignLibrary
    {
        internal readonly struct Design
        {
            public readonly ZoneSystem.ZoneLocation Location;
            public readonly float Weight;

            public Design(ZoneSystem.ZoneLocation location, float weight)
            {
                Location = location;
                Weight = weight;
            }

            public string Name => Location.m_prefabName;
            public float Radius => DesignLibrary.Radius(Location);
        }

        private static readonly HashSet<string> WarnedMissing = new HashSet<string>();

        public static List<Design> PoolFor(Heightmap.Biome biome)
        {
            string biomeList = biome == Heightmap.Biome.BlackForest
                ? VillheimConfig.BlackForestDesigns.Value
                : VillheimConfig.MeadowsDesigns.Value;

            var pool = new List<Design>();
            AddDesigns(pool, biomeList);
            AddDesigns(pool, VillheimConfig.AnyBiomeDesigns.Value);
            return pool;
        }

        public static Design? Pick(List<Design> pool, System.Random rng)
        {
            if (pool.Count == 0)
            {
                return null;
            }

            float total = 0f;
            foreach (Design design in pool)
            {
                total += design.Weight;
            }

            double roll = rng.NextDouble() * total;
            foreach (Design design in pool)
            {
                roll -= design.Weight;
                if (roll <= 0)
                {
                    return design;
                }
            }

            return pool[pool.Count - 1];
        }

        public static float Radius(ZoneSystem.ZoneLocation location)
        {
            return Mathf.Max(4f, location.m_exteriorRadius);
        }

        public static float MaxTerrainDelta(ZoneSystem.ZoneLocation location)
        {
            return Mathf.Clamp(location.m_maxTerrainDelta, 1.5f, 4f);
        }

        public static ZoneSystem.ZoneLocation Find(string name)
        {
            if (ZoneSystem.instance == null || string.IsNullOrEmpty(name))
            {
                return null;
            }

            ZoneSystem.ZoneLocation location = ZoneSystem.instance.GetLocation(name);
            if (location != null && location.m_prefab.IsValid)
            {
                return location;
            }

            // Fall back to a case-insensitive search so config typos in capitalization still work.
            foreach (ZoneSystem.ZoneLocation candidate in ZoneSystem.instance.m_locations)
            {
                if (candidate != null && candidate.m_prefab.IsValid &&
                    string.Equals(candidate.m_prefabName, name, System.StringComparison.OrdinalIgnoreCase))
                {
                    return candidate;
                }
            }

            return null;
        }

        private static void AddDesigns(List<Design> pool, string list)
        {
            if (string.IsNullOrWhiteSpace(list))
            {
                return;
            }

            foreach (string raw in list.Split(','))
            {
                string entry = raw.Trim();
                if (entry.Length == 0)
                {
                    continue;
                }

                float weight = 1f;
                int colon = entry.IndexOf(':');
                if (colon > 0)
                {
                    float.TryParse(entry.Substring(colon + 1), NumberStyles.Float, CultureInfo.InvariantCulture, out weight);
                    entry = entry.Substring(0, colon).Trim();
                }

                if (weight <= 0f)
                {
                    continue;
                }

                ZoneSystem.ZoneLocation location = Find(entry);
                if (location == null)
                {
                    if (WarnedMissing.Add(entry))
                    {
                        VillheimPlugin.Log.LogWarning($"Design '{entry}' is not a known location and will be skipped. " +
                                                      "Use 'villheim_locations' in the console to list valid names.");
                    }

                    continue;
                }

                if (Radius(location) > VillheimConfig.MaxDesignRadius.Value)
                {
                    VillheimPlugin.Debug($"Design '{entry}' is larger than MaxDesignRadius and was skipped.");
                    continue;
                }

                pool.Add(new Design(location, weight));
            }
        }
    }
}
