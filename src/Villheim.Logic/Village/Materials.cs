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

        // The stage (1 camp to 4 town) the village being worked on reaches with its next building; 0 outside a scope.
        private static int _stage;

        /// <summary>The stage the village being worked on reaches with its next building (0 outside a village's scope).</summary>
        public static int BuildStage => _stage;

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
            var scope = new Scope(_extra, _held, _stage);
            _stage = hearth != null && hearth.IsValid ? VillageBrain.TierIndex(new VillageState(hearth.Zdo).Plots.Count + 1) + 1 : 0;
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
            private readonly int _previousStage;

            public Scope(HashSet<string> previous, Dictionary<string, int> previousHeld, int previousStage)
            {
                _previous = previous;
                _previousHeld = previousHeld;
                _previousStage = previousStage;
            }

            public void Dispose()
            {
                _extra = _previous;
                _held = _previousHeld;
                _stage = _previousStage;
            }
        }

        private static readonly HashSet<string> Fallback = new HashSet<string> { Wood, Stone };

        /// <summary>
        /// Wood first (D-012): in the WoodFirstBiomes (Meadows and Black Forest) a village builds in wood at its early
        /// stages. A design with more than EarlyStoneMax stone waits for StoneFromStage (3, a village), or
        /// StoneHallFromStage (2, a hamlet) for the hall. False outside a village's scope (the gallery, commands).
        /// </summary>
        public static bool StoneTooEarly(Heightmap.Biome biome, Designs.Role role, int stone)
        {
            if (_stage <= 0 || stone <= (LogicConfig.EarlyStoneMax?.Value ?? 30) || !WoodFirst(biome))
            {
                return false;
            }

            int from = role == Designs.Role.Hub ? LogicConfig.StoneHallFromStage?.Value ?? 2 : LogicConfig.StoneFromStage?.Value ?? 3;
            return _stage < from;
        }

        private static bool WoodFirst(Heightmap.Biome biome)
        {
            string list = LogicConfig.WoodFirstBiomes?.Value ?? "Meadows, BlackForest";
            foreach (string part in list.Split(','))
            {
                if (Enum.TryParse(part.Trim(), true, out Heightmap.Biome b) && b == biome)
                {
                    return true;
                }
            }

            return false;
        }

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

        /// <summary>How many of the material fit in one stack (50 for wood and stone), 50 when not known.</summary>
        public static int StackSize(string material)
        {
            int size = Prefab(material)?.GetComponent<ItemDrop>()?.m_itemData?.m_shared?.m_maxStackSize ?? 0;
            return size > 0 ? size : 50;
        }
    }
}
