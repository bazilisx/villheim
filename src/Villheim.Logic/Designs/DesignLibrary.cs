using System.Collections.Generic;
using System.Globalization;
using UnityEngine;

namespace Villheim.Logic.Designs
{
    /// <summary>
    /// The designs a village may copy, by role (see <see cref="Culture"/>) plus the config lists.
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

        /// <summary>
        /// Designs for one role of a village in this biome. Uses the culture's first design tier that has anything
        /// available, then adds the config lists (which count as homes) and AnyBiomeDesigns.
        /// </summary>
        public static List<Design> PoolFor(Heightmap.Biome biome, Role role)
        {
            var pool = new List<Design>();
            foreach (string tier in Culture.For(biome).Tiers(role))
            {
                AddDesigns(pool, tier, warnIfMissing: false);
                if (pool.Count > 0)
                {
                    break;
                }
            }

            if (role == Role.House || pool.Count == 0)
            {
                string configList = biome == Heightmap.Biome.BlackForest
                    ? VillheimConfig.BlackForestDesigns.Value
                    : VillheimConfig.MeadowsDesigns.Value;
                AddDesigns(pool, configList);
                AddDesigns(pool, VillheimConfig.AnyBiomeDesigns.Value);
            }

            if (pool.Count == 0 && role != Role.House)
            {
                return PoolFor(biome, Role.House);
            }

            return pool;
        }

        /// <summary>
        /// Every design that could stand in for this role when the preferred ones do not fit the ground: all of the
        /// culture's tiers for the role, then the homes. Used smallest first.
        /// </summary>
        public static List<Design> FallbackPool(Heightmap.Biome biome, Role role)
        {
            var pool = new List<Design>();
            foreach (string tier in Culture.For(biome).Tiers(role))
            {
                AddDesigns(pool, tier, warnIfMissing: false);
            }

            if (role != Role.House)
            {
                foreach (Design design in PoolFor(biome, Role.House))
                {
                    if (!pool.Exists(d => d.Name == design.Name))
                    {
                        pool.Add(design);
                    }
                }
            }

            pool.Sort((a, b) => a.Radius.CompareTo(b.Radius));
            return pool;
        }

        /// <summary>Every design any role could use, for the designs command.</summary>
        public static List<Design> AllFor(Heightmap.Biome biome)
        {
            var all = new List<Design>();
            foreach (Role role in new[] { Role.Hub, Role.House, Role.Workshop, Role.Farm })
            {
                foreach (Design design in PoolFor(biome, role))
                {
                    if (!all.Exists(d => d.Name == design.Name))
                    {
                        all.Add(design);
                    }
                }
            }

            return all;
        }

        private static readonly Dictionary<string, int> PieceCounts = new Dictionary<string, int>();

        /// <summary>Wood a copy of this design costs: its building pieces times WoodPerPiece, capped.</summary>
        public static int WoodCost(ZoneSystem.ZoneLocation location)
        {
            if (!PieceCounts.TryGetValue(location.m_prefabName, out int pieces))
            {
                pieces = CountPieces(location);
                PieceCounts[location.m_prefabName] = pieces;
            }

            int cost = Mathf.CeilToInt(pieces * VillheimConfig.WoodPerPiece.Value);
            return Mathf.Clamp(cost, 0, VillheimConfig.MaxWoodPerBuilding.Value);
        }

        private static int CountPieces(ZoneSystem.ZoneLocation location)
        {
            location.m_prefab.Load();
            try
            {
                GameObject asset = location.m_prefab.Asset;
                if (asset == null || ZNetScene.instance == null)
                {
                    return 0;
                }

                int count = 0;
                foreach (ZNetView view in Utils.GetEnabledComponentsInChildren<ZNetView>(asset))
                {
                    string name = Utils.GetPrefabName(view.gameObject);
                    GameObject prefab = ZNetScene.instance.GetPrefab(name);
                    if (prefab != null && prefab.GetComponent<Piece>() && DesignSpawner.ExclusionReason(prefab, name) == null)
                    {
                        count++;
                    }
                }

                return count;
            }
            finally
            {
                location.m_prefab.Release();
            }
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
            return Mathf.Clamp(location.m_maxTerrainDelta, 2f, 5f);
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

        private static void AddDesigns(List<Design> pool, string list, bool warnIfMissing = true)
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
                if (location != null && pool.Exists(d => d.Name == location.m_prefabName))
                {
                    continue;
                }

                if (location == null)
                {
                    if (warnIfMissing && WarnedMissing.Add(entry))
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
