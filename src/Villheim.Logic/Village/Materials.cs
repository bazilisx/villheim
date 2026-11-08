using System;
using System.Collections.Generic;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// The building materials villages gather and spend. Other ingredients in a piece's vanilla recipe
    /// (resin, leather, metal) are not tracked, so they cost nothing for now.
    ///
    /// A village builds with what its biome and its outposts give (Tyler, 2026-11-08). Meadows has no pine, so a
    /// Meadows village only builds with core wood once it has a logging camp in the Black Forest sending it home. The
    /// biome table can be changed in the config; while the village brain runs for one village, From(hearth) adds what
    /// that village's outposts send (see Outposts.Gives).
    ///
    /// Anything brought into the village counts too (D-007): From(hearth) also notes what the village's chests hold
    /// (the main chest, the storage chests and the saved-up stock), whoever put it there. A design that needs a
    /// material the biome and the outposts do not give can be built once the chests hold all of it the design needs
    /// (see Held and DesignLibrary.MissingIn). Gathering still follows AllowedIn, so nobody goes looking for it.
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
                _union = null;
            }

            HashSet<string> own = Allowed.TryGetValue(biome, out HashSet<string> set) ? set : Fallback;
            if (_extra == null || _extra.Count == 0 || own.IsSupersetOf(_extra))
            {
                return own;
            }

            string key = biome + "|" + string.Join(",", _extra);
            if (_union == null || _unionKey != key)
            {
                _union = new HashSet<string>(own);
                _union.UnionWith(_extra);
                _unionKey = key;
            }

            return _union;
        }

        // What the outposts of the village being worked on send home, added to its biome's materials.
        private static HashSet<string> _extra;

        // What the chests of the village being worked on hold, by material (D-007).
        private static Dictionary<string, int> _held;

        /// <summary>How much of a material the village being worked on holds in its chests and stock (0 outside a scope).</summary>
        public static int Held(string material) => _held != null && _held.TryGetValue(material, out int n) ? n : 0;
        private static HashSet<string> _union;
        private static string _unionKey;

        /// <summary>
        /// For the length of a using block, AllowedIn also gives what this village's outposts send home. Scopes nest;
        /// the village brain opens one per hearth tick.
        /// </summary>
        public static Scope From(VillageHearth hearth)
        {
            var scope = new Scope(_extra, _held);
            HashSet<string> gives = hearth != null ? Outposts.Gives(hearth) : null;
            _extra = gives != null && gives.Count > 0 ? gives : null;
            _held = hearth != null && hearth.IsValid && LogicConfig.IsOn(LogicConfig.BroughtMaterials)
                ? VillageChest.Holdings(hearth)
                : null;
            return scope;
        }

        internal readonly struct Scope : IDisposable
        {
            private readonly HashSet<string> _previous;
            private readonly Dictionary<string, int> _previousHeld;

            public Scope(HashSet<string> previous, Dictionary<string, int> previousHeld)
            {
                _previous = previous;
                _previousHeld = previousHeld;
            }

            public void Dispose()
            {
                _extra = _previous;
                _held = _previousHeld;
            }
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
