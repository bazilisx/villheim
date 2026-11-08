using System.Collections.Generic;
using System.Linq;
using System.Globalization;
using UnityEngine;

using Villheim.Logic.Village;

namespace Villheim.Logic.Designs
{
    /// <summary>
    /// The designs a village may copy, by role (see <see cref="Culture"/>) plus the config lists.
    /// A design is any location registered with the game's ZoneSystem: vanilla ones, or ones added by other mods.
    /// </summary>
    internal static class DesignLibrary
    {
        /// <summary>A copied location or a blueprint (see <see cref="Blueprints"/>).</summary>
        internal readonly struct Design
        {
            public readonly ZoneSystem.ZoneLocation Location;
            public readonly Blueprints.Blueprint Blueprint;
            public readonly float Weight;

            public Design(ZoneSystem.ZoneLocation location, float weight)
            {
                Location = location;
                Blueprint = null;
                Weight = weight;
            }

            public Design(Blueprints.Blueprint blueprint, float weight)
            {
                Location = null;
                Blueprint = blueprint;
                Weight = weight;
            }

            public string Name => Blueprint != null ? Blueprint.Name : Location.m_prefabName;
            public float Radius => Blueprint != null ? Blueprint.Radius : DesignLibrary.Radius(Location);
            public float MaxTerrainDelta => Blueprint != null ? 3f : DesignLibrary.MaxTerrainDelta(Location);
            public Dictionary<string, int> RawTotals => Blueprint != null ? Blueprints.RawTotals(Blueprint) : DesignLibrary.RawTotals(Location);
        }

        private static readonly string[] NotAFire = { "torch", "sconce", "candle", "lantern", "lamp", "brazier", "smelter", "kiln", "forge", "oven" };

        private static readonly Dictionary<string, Vector3?> Fires = new Dictionary<string, Vector3?>();

        /// <summary>
        /// Where the design's own fire pit or hearth sits (design coordinates), the one nearest its middle, or null.
        /// A longhouse with one can be built around the village hearth.
        /// </summary>
        public static Vector3? FireOf(Design design)
        {
            if (Fires.TryGetValue(design.Name, out Vector3? cached))
            {
                return cached;
            }

            Vector3? best = null;
            void Consider(string prefabName, Vector3 local)
            {
                GameObject prefab = ZNetScene.instance ? ZNetScene.instance.GetPrefab(prefabName) : null;
                string lower = prefabName.ToLowerInvariant();
                if (prefab == null || prefab.GetComponent<Fireplace>() == null || NotAFire.Any(w => lower.Contains(w)))
                {
                    return;
                }

                if (best == null || new Vector2(local.x, local.z).sqrMagnitude < new Vector2(best.Value.x, best.Value.z).sqrMagnitude)
                {
                    best = local;
                }
            }

            if (design.Blueprint != null)
            {
                foreach (Blueprints.Piece piece in design.Blueprint.Pieces)
                {
                    Consider(piece.Prefab, piece.Position);
                }
            }
            else
            {
                try
                {
                    Designs.AssetGuard.Load(design.Location);
                }
                catch (AssetGuard.BrokenException)
                {
                    return null;
                }

                try
                {
                    GameObject asset = design.Location.m_prefab.Asset;
                    if (asset != null)
                    {
                        foreach (ZNetView view in Utils.GetEnabledComponentsInChildren<ZNetView>(asset))
                        {
                            Consider(Utils.GetPrefabName(view.gameObject), asset.transform.InverseTransformPoint(view.transform.position));
                        }
                    }
                }
                finally
                {
                    design.Location.m_prefab.Release();
                }
            }

            // Only a fire inside the building counts (not a campfire out in the yard).
            if (best != null && new Vector2(best.Value.x, best.Value.z).magnitude > design.Radius * 0.5f)
            {
                best = null;
            }

            Fires[design.Name] = best;
            return best;
        }

        // Everything a piece may be made of in each biome, beyond the four tracked building materials (which follow the
        // BiomeMaterials setting). A design with any piece made of something else (black marble, iron, obsidian...) is
        // left out: a Meadows village built a marble wall.
        private static readonly HashSet<string> MeadowsResources = new HashSet<string>
        {
            "Wood", "Stone", "Flint", "Resin", "LeatherScraps", "DeerHide", "Feathers", "BoneFragments", "Coal",
            "Dandelion", "Mushroom", "Raspberry", "Honey", "TrophyDeer", "TrophyBoar", "TrophyNeck",
        };

        private static readonly HashSet<string> ForestResources = new HashSet<string>
        {
            "FineWood", "RoundLog", "Copper", "Tin", "Bronze", "BronzeNails", "TrollHide", "GreydwarfEye", "SurtlingCore",
            "Thistle", "Blueberries", "AncientSeed", "CopperOre", "TinOre", "TrophyGreydwarf", "TrophyFrostTroll",
        };

        private static readonly Dictionary<string, HashSet<string>> ResourceCache = new Dictionary<string, HashSet<string>>();

        /// <summary>The first resource in the design that its biome doesn't have at all, or null.</summary>
        public static string Foreign(Design design, Heightmap.Biome biome)
        {
            HashSet<string> used = Resources(design);
            foreach (string resource in used)
            {
                if (Village.Materials.Tracked.Contains(resource))
                {
                    continue; // handled by the BiomeMaterials setting
                }

                bool ok = MeadowsResources.Contains(resource) ||
                          (biome == Heightmap.Biome.BlackForest && ForestResources.Contains(resource));
                if (!ok)
                {
                    return resource;
                }
            }

            return null;
        }

        private static HashSet<string> Resources(Design design)
        {
            if (ResourceCache.TryGetValue(design.Name, out HashSet<string> cached))
            {
                return cached;
            }

            var used = new HashSet<string>();
            void Add(string prefabName)
            {
                GameObject prefab = ZNetScene.instance ? ZNetScene.instance.GetPrefab(prefabName) : null;
                if (prefab != null && DesignSpawner.ExclusionReason(prefab, prefabName) == null)
                {
                    used.UnionWith(DesignSpawner.AllResources(prefab));
                }
            }

            if (design.Blueprint != null)
            {
                foreach (Blueprints.Piece piece in design.Blueprint.Pieces)
                {
                    Add(piece.Prefab);
                }
            }
            else
            {
                try
                {
                    Designs.AssetGuard.Load(design.Location);
                }
                catch (AssetGuard.BrokenException)
                {
                    return used; // can't look inside; MissingIn reports it as broken
                }

                try
                {
                    GameObject asset = design.Location.m_prefab.Asset;
                    if (asset != null)
                    {
                        foreach (ZNetView view in Utils.GetEnabledComponentsInChildren<ZNetView>(asset))
                        {
                            Add(Utils.GetPrefabName(view.gameObject));
                        }
                    }
                }
                finally
                {
                    design.Location.m_prefab.Release();
                }
            }

            ResourceCache[design.Name] = used;
            return used;
        }

        /// <summary>A design by name: a location, or a blueprint when the name starts with "bp:".</summary>
        public static Design? ByName(string name)
        {
            Blueprints.Blueprint blueprint = Blueprints.Find(name);
            if (blueprint != null)
            {
                return new Design(blueprint, 1f);
            }

            ZoneSystem.ZoneLocation location = Find(name);
            return location != null ? new Design(location, 1f) : (Design?)null;
        }

        /// <summary>
        /// Level 1 blueprints for this role and biome. A blueprint with no biome goes anywhere its materials allow.
        /// Blueprints weigh twice as much as copied locations: someone picked them for a village.
        /// </summary>
        private static void AddBlueprints(List<Design> pool, Heightmap.Biome biome, Role role, string culture = null)
        {
            // A blueprint tagged with a culture (villheim: culture=slavic) goes only to villages of that culture, and
            // weighs twice as much there. Untagged blueprints go to every culture of the biome.
            bool cultures = culture != null && Cultures.On && LogicConfig.CultureDesigns != null && LogicConfig.CultureDesigns.Value;
            string biomeName = biome == Heightmap.Biome.BlackForest ? "blackforest" : "meadows";
            foreach (Blueprints.Blueprint blueprint in Blueprints.All().Values)
            {
                if (blueprint.Inspiration || blueprint.Role != role || blueprint.Level != 1 ||
                    (blueprint.Biome != null && blueprint.Biome.Replace(" ", "") != biomeName) ||
                    blueprint.Radius > VillheimConfig.MaxDesignRadius.Value || pool.Exists(d => d.Name == blueprint.Name) ||
                    (cultures && blueprint.Culture != null && blueprint.Culture != culture))
                {
                    continue;
                }

                pool.Add(new Design(blueprint, blueprint.Weight * (cultures && blueprint.Culture == culture ? 2f : 1f)));
            }
        }

        private static readonly HashSet<string> WarnedMissing = new HashSet<string>();

        /// <summary>
        /// Designs for one role of a village in this biome. Uses the culture's first design tier that has anything
        /// available, then adds the config lists (which count as homes) and AnyBiomeDesigns.
        /// </summary>
        public static List<Design> PoolFor(Heightmap.Biome biome, Role role, string culture = null)
        {
            var pool = new List<Design>();
            AddBlueprints(pool, biome, role, culture);
            KeepBuildable(pool, biome);
            foreach (string tier in Culture.TiersFor(biome, culture, role))
            {
                int before = pool.Count;
                AddDesigns(pool, tier, warnIfMissing: false);
                KeepBuildable(pool, biome);
                if (pool.Count > before)
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
                KeepBuildable(pool, biome);
            }

            if (pool.Count == 0 && role != Role.House)
            {
                return PoolFor(biome, Role.House, culture);
            }

            KeepWoodEarly(pool, biome, role);
            return pool;
        }

        /// <summary>Stone in this design (from its pieces' recipes).</summary>
        public static int StoneIn(Design design) => design.RawTotals.TryGetValue(Village.Materials.Stone, out int n) ? n : 0;

        /// <summary>
        /// Wood first in the early stages (D-012, see Materials.StoneTooEarly): stone-heavy designs leave the pool
        /// while the village is young. When that would leave nothing, the designs with the least stone stay.
        /// </summary>
        private static void KeepWoodEarly(List<Design> pool, Heightmap.Biome biome, Role role)
        {
            if (pool.Count == 0 || !pool.Any(d => Village.Materials.StoneTooEarly(biome, role, StoneIn(d))))
            {
                return;
            }

            List<Design> wood = pool.Where(d => !Village.Materials.StoneTooEarly(biome, role, StoneIn(d))).ToList();
            if (wood.Count == 0)
            {
                int least = pool.Min(StoneIn);
                wood = pool.Where(d => StoneIn(d) == least).ToList();
            }

            pool.Clear();
            pool.AddRange(wood);
        }

        /// <summary>
        /// Every design that could stand in for this role when the preferred ones do not fit the ground: all of the
        /// culture's tiers for the role, then the homes. Used smallest first.
        /// </summary>
        public static List<Design> FallbackPool(Heightmap.Biome biome, Role role, string culture = null)
        {
            var pool = new List<Design>();
            foreach (string tier in Culture.TiersFor(biome, culture, role))
            {
                AddDesigns(pool, tier, warnIfMissing: false);
            }

            if (role != Role.House)
            {
                foreach (Design design in PoolFor(biome, Role.House, culture))
                {
                    if (!pool.Exists(d => d.Name == design.Name))
                    {
                        pool.Add(design);
                    }
                }
            }

            KeepBuildable(pool, biome);
            pool.Sort((a, b) => a.Radius.CompareTo(b.Radius));
            return pool;
        }

        /// <summary>
        /// A design can only be built in a biome that has every material it needs (see Materials.AllowedIn).
        /// </summary>
        public static bool BuildableIn(ZoneSystem.ZoneLocation location, Heightmap.Biome biome)
        {
            return MissingIn(location, biome) == null;
        }

        /// <summary>The first material this design needs that the biome does not have, or null.</summary>
        public static string MissingIn(ZoneSystem.ZoneLocation location, Heightmap.Biome biome) =>
            MissingIn(new Design(location, 1f), biome);

        public static string MissingIn(Design design, Heightmap.Biome biome)
        {
            if (design.Location != null && AssetGuard.IsBroken(design.Location))
            {
                return "a broken asset";
            }

            if (!VillheimConfig.RequireWood.Value)
            {
                return null;
            }

            string foreign = Foreign(design, biome);
            if (foreign != null)
            {
                return foreign;
            }

            HashSet<string> allowed = Village.Materials.AllowedIn(biome);
            foreach (KeyValuePair<string, int> total in design.RawTotals)
            {
                // A material the land does not give still counts when the village's chests hold all the design needs
                // of it (D-007: whatever is brought in counts).
                if (total.Value > 0 && !allowed.Contains(total.Key) && Village.Materials.Held(total.Key) < total.Value)
                {
                    return total.Key;
                }
            }

            return null;
        }

        private static readonly HashSet<string> WarnedUnbuildable = new HashSet<string>();

        private static void KeepBuildable(List<Design> pool, Heightmap.Biome biome)
        {
            pool.RemoveAll(design =>
            {
                string missing = MissingIn(design, biome);
                if (missing != null && WarnedUnbuildable.Add(design.Name + "|" + biome))
                {
                    VillheimPlugin.Debug($"{design.Name} needs {Village.Materials.Label(missing)}, which {biome} does not have. Skipping it there.");
                }

                return missing != null;
            });
        }

        /// <summary>Every design any role could use, for the designs command.</summary>
        public static List<Design> AllFor(Heightmap.Biome biome)
        {
            var all = new List<Design>();
            foreach (Role role in new[] { Role.Hub, Role.House, Role.Workshop, Role.Farm, Role.Storage })
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

        private static readonly Dictionary<string, Dictionary<string, int>> Totals =
            new Dictionary<string, Dictionary<string, int>>();

        /// <summary>
        /// What a copy of this design costs per material: the vanilla recipe of every piece, times WoodPerPiece,
        /// with each material capped at MaxWoodPerBuilding so big designs stay reachable.
        /// </summary>
        public static Dictionary<string, int> MaterialCost(ZoneSystem.ZoneLocation location) =>
            MaterialCost(new Design(location, 1f));

        public static Dictionary<string, int> MaterialCost(Design design)
        {
            var result = new Dictionary<string, int>();
            foreach (KeyValuePair<string, int> entry in design.RawTotals)
            {
                result[entry.Key] = Mathf.RoundToInt(entry.Value * CostFactor(entry.Value));
            }

            return result;
        }

        /// <summary>Multiplier applied to one material's vanilla amounts for a design with this raw total.</summary>
        public static float CostFactor(int rawTotal)
        {
            if (!VillheimConfig.RequireWood.Value || rawTotal <= 0)
            {
                return 0f;
            }

            float multiplier = VillheimConfig.WoodPerPiece.Value;
            float cap = VillheimConfig.MaxWoodPerBuilding.Value;
            return Mathf.Min(multiplier, cap / rawTotal);
        }

        public static Dictionary<string, int> RawTotals(ZoneSystem.ZoneLocation location)
        {
            if (Totals.TryGetValue(location.m_prefabName, out Dictionary<string, int> cached))
            {
                return cached;
            }

            var totals = new Dictionary<string, int>();
            Designs.AssetGuard.Load(location);
            try
            {
                GameObject asset = location.m_prefab.Asset;
                if (asset != null && ZNetScene.instance != null)
                {
                    foreach (ZNetView view in Utils.GetEnabledComponentsInChildren<ZNetView>(asset))
                    {
                        string name = Utils.GetPrefabName(view.gameObject);
                        GameObject prefab = ZNetScene.instance.GetPrefab(name);
                        if (prefab == null || DesignSpawner.ExclusionReason(prefab, name) != null)
                        {
                            continue;
                        }

                        foreach (KeyValuePair<string, int> cost in DesignSpawner.RecipeCost(prefab))
                        {
                            totals.TryGetValue(cost.Key, out int amount);
                            totals[cost.Key] = amount + cost.Value;
                        }
                    }
                }
            }
            finally
            {
                location.m_prefab.Release();
            }

            Totals[location.m_prefabName] = totals;
            return totals;
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
