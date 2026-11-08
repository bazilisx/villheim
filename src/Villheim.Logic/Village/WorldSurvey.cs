using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Reads the real world for village knowledge. Nothing here is made up: every feature comes from the game's own data.
    ///
    /// - Locations: ZoneSystem.m_locationInstances, which hold every location of the world from its generation,
    ///   explored or not (boss altars, dungeons, traders, runestones, tar pits, towers, ruins, fuling villages, dvergr
    ///   outposts). The prefab name says what it is; names not in the table are skipped ('vh know names' lists them).
    /// - Objects: in zones that have been generated, saved objects (ZDOs) by prefab: ore deposits, greydwarf nests,
    ///   bone piles, berry bushes, wild beehives. Read one prefab at a time with the game's own iterative search, a
    ///   slice per call, so the whole world is never walked in one frame.
    /// - Creatures: the spawn lists of the zone controller (SpawnSystem), per biome, by day or by night, with their
    ///   height above the sea.
    /// - Land: WorldGenerator heights and biomes, sampled sparsely, for the words between here and there.
    /// </summary>
    internal static class WorldSurvey
    {
        internal sealed class Feature
        {
            public string Kind;
            public string Key;
            public Vector3 Position;
            public string When = "";
            /// <summary>Cached by the village survey: the discovery id, and how it can be reached at a gear tier.</summary>
            public int Id;
            public string Access;
            public int AccessTier = -1;

            public Feature Copy() => new Feature { Kind = Kind, Key = Key, Position = Position, When = When };
        }

        public static float WaterLevel => ZoneSystem.instance != null ? ZoneSystem.instance.m_waterLevel : 30f;

        public static Heightmap.Biome Biome(Vector3 at) =>
            WorldGenerator.instance != null ? WorldGenerator.instance.GetBiome(at) : Heightmap.Biome.Meadows;

        public static float Height(Vector3 at) =>
            WorldGenerator.instance != null ? WorldGenerator.instance.GetHeight(at.x, at.z) : WaterLevel + 10f;

        // ---------------------------------------------------------------- locations

        // Prefab name start (case ignored), kind, key. Longer and odder names first: the first match wins.
        private static readonly (string Prefix, string Kind, string Key)[] LocationKinds =
        {
            ("Eikthyrnir", "boss", "eikthyr"), ("GDKing", "boss", "elder"), ("Bonemass", "boss", "bonemass"),
            ("Dragonqueen", "boss", "moder"), ("GoblinKing", "boss", "yagluth"),
            ("Mistlands_DvergrBossEntrance", "boss", "queen"), ("FaderLocation", "boss", "fader"),
            ("Vendor_BlackForest", "trader", "haldor"), ("Hildir_camp", "trader", "hildir"), ("BogWitch_Camp", "trader", "bogwitch"),
            ("SunkenCrypt", "dungeon", "sunkencrypt"), ("Crypt", "dungeon", "burial"), ("TrollCave", "dungeon", "trollcave"),
            ("MountainCave", "dungeon", "frostcave"), ("Mistlands_DvergrTownEntrance", "dungeon", "infestedmine"),
            ("Runestone", "runestone", "runestone"), ("StartTemple", "landmark", "stones"), ("TarPit", "landmark", "tarpit"),
            ("StoneTowerRuins", "landmark", "tower"), ("StoneTower", "landmark", "tower"), ("Mistlands_Giant", "landmark", "giant"),
            ("StoneHenge", "landmark", "henge"), ("Dolmen", "landmark", "dolmen"), ("ShipWreck", "landmark", "wreck"),
            ("MountainWell", "landmark", "well"), ("SwampWell", "landmark", "well"), ("Waymarker", "landmark", "cairn"),
            ("DrakeNest", "landmark", "drakenest"), ("Greydwarf_camp", "landmark", "greydwarfcamp"),
            ("GoblinCamp", "fuling", "fulingvillage"),
            ("Mistlands_GuardTower", "dvergr", "dvergr"), ("Mistlands_Harbour", "dvergr", "dvergr"), ("Mistlands_Camp", "dvergr", "dvergr"),
            ("Mistlands_Excavation", "dvergr", "dvergr"), ("Mistlands_Lighthouse", "dvergr", "dvergr"),
            ("SwampRuin", "ruin", "swampruin"), ("SwampHut", "ruin", "swamphut"), ("AbandonedLogCabin", "ruin", "cabin"),
            ("WoodHouse", "ruin", "house"), ("WoodFarm", "ruin", "farm"), ("WoodVillage", "ruin", "village"),
            ("StoneHouse", "ruin", "stonehouse"), ("Ruin", "ruin", "stoneruin"),
        };

        public static bool Classify(string prefab, out string kind, out string key)
        {
            kind = key = null;
            if (string.IsNullOrEmpty(prefab))
            {
                return false;
            }

            foreach ((string prefix, string k, string y) in LocationKinds)
            {
                if (prefab.StartsWith(prefix, System.StringComparison.OrdinalIgnoreCase))
                {
                    kind = k;
                    key = y;
                    return true;
                }
            }

            return false;
        }

        /// <summary>Every known location within <paramref name="radius"/> of <paramref name="center"/>.</summary>
        public static List<Feature> LocationsNear(Vector3 center, float radius)
        {
            var list = new List<Feature>();
            if (ZoneSystem.instance == null)
            {
                return list;
            }

            // Only the values: the dictionary's key type has changed between game versions.
            foreach (ZoneSystem.LocationInstance instance in ZoneSystem.instance.m_locationInstances.Values)
            {
                if (Utils.DistanceXZ(instance.m_position, center) > radius)
                {
                    continue;
                }

                string name = instance.m_location?.m_prefabName ?? "";
                if (name == Villheim.Prefabs.VillageLocation.Name || !Classify(name, out string kind, out string key))
                {
                    continue;
                }

                list.Add(new Feature { Kind = kind, Key = key, Position = instance.m_position });
            }

            return list;
        }

        /// <summary>Location prefab names within reach, how many of each and what they are read as, for 'vh know names'.</summary>
        public static string Names(Vector3 center, float radius)
        {
            if (ZoneSystem.instance == null)
            {
                return "No zone system.";
            }

            var counts = new Dictionary<string, int>();
            foreach (ZoneSystem.LocationInstance instance in ZoneSystem.instance.m_locationInstances.Values)
            {
                if (Utils.DistanceXZ(instance.m_position, center) <= radius)
                {
                    string name = instance.m_location?.m_prefabName ?? "?";
                    counts[name] = counts.TryGetValue(name, out int n) ? n + 1 : 1;
                }
            }

            return string.Join("\n", counts.OrderBy(c => c.Key).Select(c =>
                $"   {c.Key} x{c.Value}: {(Classify(c.Key, out string kind, out string key) ? kind + " " + key : "not used")}"));
        }

        // ---------------------------------------------------------------- objects in generated zones

        // Prefab, kind, key.
        private static readonly (string Prefab, string Kind, string Key)[] ObjectKinds =
        {
            ("rock4_copper", "ore", "copper"), ("MineRock_Tin", "ore", "tin"), ("silvervein", "ore", "silver"),
            ("rock3_silver", "ore", "silver"), ("MineRock_Obsidian", "ore", "obsidian"), ("mudpile", "ore", "iron"),
            ("mudpile2", "ore", "iron"), ("MineRock_Meteorite", "ore", "flametal"),
            ("Spawner_GreydwarfNest", "nest", "greydwarfnest"), ("Spawner_DraugrPile", "nest", "draugrpile"),
            ("BonePileSpawner", "nest", "bonepile"),
            ("RaspberryBush", "forage", "raspberries"), ("BlueberryBush", "forage", "blueberries"),
            ("CloudberryBush", "forage", "cloudberries"), ("Beehive", "forage", "beehive"),
        };

        private static readonly List<Feature> Objects = new List<Feature>();
        private static readonly List<Feature> Gathering = new List<Feature>();
        private static readonly List<ZDO> Found = new List<ZDO>();
        private static int _prefab;
        private static int _index;
        private static int _calls;
        private static float _nextSweep;
        private static bool _broken;

        public static int ObjectCount => Objects.Count;

        public static bool Sweeping => _prefab > 0 || Gathering.Count > 0;

        /// <summary>
        /// One slice of the object sweep: one call to the game's iterative search for the current prefab. A full sweep
        /// goes through every prefab in the list, then waits five minutes before the next. Cheap per call.
        /// </summary>
        public static void ObjectTick()
        {
            if (_broken || ZDOMan.instance == null || Time.time < _nextSweep)
            {
                return;
            }

            try
            {
                string prefab = ObjectKinds[_prefab].Prefab;
                bool done = ZDOMan.instance.GetAllZDOsWithPrefabIterative(prefab, Found, ref _index) || ++_calls > 4000;
                if (!done)
                {
                    return;
                }

                int creator = ZDOVars.s_creator;
                foreach (ZDO zdo in Found)
                {
                    // Beehives a player built are his, not the wild ones.
                    if (zdo != null && (ObjectKinds[_prefab].Key != "beehive" || zdo.GetLong(creator) == 0L))
                    {
                        Gathering.Add(new Feature { Kind = ObjectKinds[_prefab].Kind, Key = ObjectKinds[_prefab].Key, Position = zdo.GetPosition() });
                    }
                }

                Found.Clear();
                _index = 0;
                _calls = 0;
                _prefab++;
                if (_prefab >= ObjectKinds.Length)
                {
                    _prefab = 0;
                    Objects.Clear();
                    Objects.AddRange(Gathering);
                    Gathering.Clear();
                    _nextSweep = Time.time + 300f;
                }
            }
            catch (System.Exception e)
            {
                // A game version without this search: knowledge then rests on locations, land and spawns alone.
                _broken = true;
                VillheimPlugin.Log.LogWarning($"Village knowledge: the object survey is off ({e.Message}).");
            }
        }

        /// <summary>Starts a new object sweep now.</summary>
        public static void SweepNow()
        {
            _nextSweep = 0f;
            _broken = false;
        }

        /// <summary>
        /// The objects of each key within <paramref name="radius"/>, the nearest <paramref name="perKey"/> of each, and
        /// only one within 120 m of another of the same key (a cluster counts once).
        /// </summary>
        public static List<Feature> ObjectsNear(Vector3 center, float radius, int perKey)
        {
            var list = new List<Feature>();
            foreach (IGrouping<string, Feature> group in Objects.Where(o => Utils.DistanceXZ(o.Position, center) <= radius).GroupBy(o => o.Key))
            {
                var kept = new List<Feature>();
                foreach (Feature f in group.OrderBy(o => Utils.DistanceXZ(o.Position, center)))
                {
                    if (kept.Count >= perKey)
                    {
                        break;
                    }

                    if (kept.All(k => Utils.DistanceXZ(k.Position, f.Position) > 120f))
                    {
                        kept.Add(f);
                    }
                }

                list.AddRange(kept);
            }

            return list;
        }

        // ---------------------------------------------------------------- creatures

        internal sealed class Spawn
        {
            public string Key;
            public bool Game;
            public Heightmap.Biome Biomes;
            public float MinAltitude;
            public float MaxAltitude;
            public bool Day;
            public bool Night;
            public bool InForest = true;
            public bool OutsideForest = true;
            public bool AtSea;
        }

        // Creature prefab to key. Game animals are hunted; the rest are foes.
        private static readonly Dictionary<string, string> CreatureKeys = new Dictionary<string, string>(System.StringComparer.OrdinalIgnoreCase)
        {
            ["Boar"] = "boar", ["Deer"] = "deer", ["Neck"] = "neck", ["Hare"] = "hare", ["Lox"] = "lox",
            ["Greyling"] = "greyling", ["Greydwarf"] = "greydwarf", ["Greydwarf_Elite"] = "brute", ["Greydwarf_Shaman"] = "shaman",
            ["Troll"] = "troll", ["Skeleton"] = "skeleton", ["Skeleton_Poison"] = "skeleton", ["Ghost"] = "ghost",
            ["Wolf"] = "wolf", ["Hatchling"] = "drake", ["Fenring"] = "fenring", ["Goblin"] = "fuling", ["GoblinBrute"] = "fuling",
            ["GoblinShaman"] = "fuling", ["Deathsquito"] = "deathsquito", ["Blob"] = "blob", ["BlobElite"] = "blob",
            ["Draugr"] = "draugr", ["Draugr_Elite"] = "draugr", ["Draugr_Ranged"] = "draugr", ["Leech"] = "leech",
            ["Wraith"] = "wraith", ["Surtling"] = "surtling", ["Abomination"] = "abomination", ["StoneGolem"] = "golem",
            ["Seeker"] = "seeker", ["SeekerBrute"] = "seeker", ["Tick"] = "tick", ["Bat"] = "bat", ["Ulv"] = "ulv",
            ["Bjorn"] = "bear", ["Unbjorn"] = "bear", ["Serpent"] = "serpent",
        };

        private static readonly HashSet<string> GameKeys = new HashSet<string> { "boar", "deer", "neck", "hare", "lox" };

        private static List<Spawn> _spawns;
        private static float _spawnsAt = -1000f;

        /// <summary>What can spawn in the world, merged by creature: biomes, height, day or night.</summary>
        public static List<Spawn> Spawns()
        {
            if (_spawns != null && _spawns.Count > 0 && Time.time - _spawnsAt < 600f)
            {
                return _spawns;
            }

            _spawnsAt = Time.time;
            var byKey = new Dictionary<string, Spawn>();
            foreach (SpawnSystem.SpawnData data in SpawnData())
            {
                if (data == null || !data.m_enabled || data.m_prefab == null || data.m_huntPlayer ||
                    (data.m_requiredEnvironments != null && data.m_requiredEnvironments.Count > 0) ||
                    !string.IsNullOrEmpty(data.m_requiredGlobalKey) && !ZoneSystem.instance.GetGlobalKey(data.m_requiredGlobalKey) ||
                    !CreatureKeys.TryGetValue(data.m_prefab.name, out string key))
                {
                    continue;
                }

                bool sea = data.m_minOceanDepth > 0f;
                if (!byKey.TryGetValue(key, out Spawn spawn))
                {
                    spawn = new Spawn
                    {
                        Key = key, Game = GameKeys.Contains(key), MinAltitude = data.m_minAltitude, MaxAltitude = data.m_maxAltitude,
                        InForest = data.m_inForest, OutsideForest = data.m_outsideForest, AtSea = sea,
                    };
                    byKey[key] = spawn;
                }
                else
                {
                    spawn.MinAltitude = Mathf.Min(spawn.MinAltitude, data.m_minAltitude);
                    spawn.MaxAltitude = Mathf.Max(spawn.MaxAltitude, data.m_maxAltitude);
                    spawn.InForest |= data.m_inForest;
                    spawn.OutsideForest |= data.m_outsideForest;
                    spawn.AtSea &= sea;
                }

                spawn.Biomes |= data.m_biome;
                spawn.Day |= data.m_spawnAtDay;
                spawn.Night |= data.m_spawnAtNight;
            }

            _spawns = byKey.Values.ToList();
            return _spawns;
        }

        private static IEnumerable<SpawnSystem.SpawnData> SpawnData()
        {
            SpawnSystem system = ZoneSystem.instance != null && ZoneSystem.instance.m_zoneCtrlPrefab != null
                ? ZoneSystem.instance.m_zoneCtrlPrefab.GetComponent<SpawnSystem>()
                : null;
            if ((system == null || system.m_spawnLists == null || system.m_spawnLists.Count == 0) && SpawnSystem.m_instances != null)
            {
                // A loaded zone's controller has the same lists.
                system = SpawnSystem.m_instances.FirstOrDefault(s => s != null && s.m_spawnLists != null && s.m_spawnLists.Count > 0) ?? system;
            }

            if (system?.m_spawnLists == null)
            {
                yield break;
            }

            foreach (SpawnSystemList list in system.m_spawnLists)
            {
                if (list?.m_spawners == null)
                {
                    continue;
                }

                foreach (SpawnSystem.SpawnData data in list.m_spawners)
                {
                    yield return data;
                }
            }
        }

        /// <summary>Whether <paramref name="spawn"/> can come out at a sampled spot.</summary>
        public static bool CanSpawnAt(Spawn spawn, Heightmap.Biome biome, float height, float forest)
        {
            if ((spawn.Biomes & biome) == 0)
            {
                return false;
            }

            float altitude = height - WaterLevel;
            if (spawn.AtSea)
            {
                return altitude < -4f;
            }

            if (altitude < spawn.MinAltitude || altitude > spawn.MaxAltitude || altitude < 0.5f)
            {
                return false;
            }

            // The game counts a spot as forest when its forest factor is under 1.15.
            bool inForest = forest < 1.15f;
            return inForest ? spawn.InForest : spawn.OutsideForest;
        }

        public static float Forest(Vector3 at)
        {
            try
            {
                return WorldGenerator.GetForestFactor(at);
            }
            catch
            {
                return 1f;
            }
        }

        // ---------------------------------------------------------------- the land between

        /// <summary>
        /// The ground between <paramref name="from"/> and <paramref name="to"/>, sampled every 40 m or so (6 to 24
        /// samples), as one code: sea, river, mountain, ridge, swamp, forest, hill, high, down, shore or flat. The lean
        /// is "sea" when the target is on the coast and home is not, "inland" the other way round, else empty.
        /// </summary>
        public static string Terrain(Vector3 from, Vector3 to, out string lean)
        {
            lean = "";
            float distance = Utils.DistanceXZ(from, to);
            float water = WaterLevel;
            float hA = Height(from), hB = Height(to);
            Heightmap.Biome bA = Biome(from), bB = Biome(to);
            bool coastA = Coastal(from), coastB = Coastal(to);
            if (coastB && !coastA) lean = "sea";
            else if (coastA && !coastB && distance > 250f) lean = "inland";

            int n = Mathf.Clamp(Mathf.RoundToInt(distance / 40f), 6, 24);
            float step = distance / n;
            float peak = float.MinValue;
            int run = 0, longestRun = 0, nearShore = 0;
            bool swamp = false, forest = false, mountain = false;
            for (int i = 1; i < n; i++)
            {
                Vector3 p = Vector3.Lerp(from, to, i / (float)n);
                float h = Height(p);
                Heightmap.Biome b = Biome(p);
                peak = Mathf.Max(peak, h);
                run = h < water - 0.5f ? run + 1 : 0;
                longestRun = Mathf.Max(longestRun, run);
                if (h > water - 1f && h < water + 6f) nearShore++;
                if (b == Heightmap.Biome.Swamp && bA != Heightmap.Biome.Swamp && bB != Heightmap.Biome.Swamp) swamp = true;
                if (b == Heightmap.Biome.BlackForest && bA != Heightmap.Biome.BlackForest && bB != Heightmap.Biome.BlackForest) forest = true;
                if (b == Heightmap.Biome.Mountain && bB != Heightmap.Biome.Mountain) mountain = true;
            }

            float over = peak - Mathf.Max(hA, hB);
            float rise = hB - hA;
            float waterRun = longestRun * step;
            if (waterRun >= 150f) return "sea";
            if (mountain && over > 60f) return "mountain";
            if (waterRun > 0f) return "river";
            if (over > 20f) return "ridge";
            if (swamp) return "swamp";
            if (forest) return "forest";
            if (rise > 60f && bB == Heightmap.Biome.Mountain) return "high";
            if (rise > 25f) return "hill";
            if (rise < -25f) return "down";
            if (hB < water + 6f && hB > water - 1f && nearShore >= (n - 1) / 2) return "shore";
            return "flat";
        }

        /// <summary>Sea within 80 m of the spot (three of eight samples under water).</summary>
        public static bool Coastal(Vector3 at)
        {
            float water = WaterLevel;
            int wet = 0;
            for (int i = 0; i < 8; i++)
            {
                Vector3 p = at + Quaternion.Euler(0f, i * 45f, 0f) * Vector3.forward * 80f;
                if (Height(p) < water - 2f)
                {
                    wet++;
                }
            }

            return wet >= 3;
        }

        /// <summary>The longest stretch of water (metres) on the straight line, sampled every 40 m.</summary>
        public static float WaterOnTheWay(Vector3 from, Vector3 to)
        {
            float distance = Utils.DistanceXZ(from, to);
            int n = Mathf.Clamp(Mathf.RoundToInt(distance / 40f), 2, 40);
            float step = distance / n;
            float water = WaterLevel;
            int run = 0, longest = 0;
            for (int i = 1; i < n; i++)
            {
                run = Height(Vector3.Lerp(from, to, i / (float)n)) < water - 1f ? run + 1 : 0;
                longest = Mathf.Max(longest, run);
            }

            return longest * step;
        }

        public static string Compass(Vector3 direction) => WorldLife.Compass(direction);

        /// <summary>A plain distance: close by, a short walk, a good walk, half a morning's walk, half a day's walk, a long day's walk.</summary>
        public static string Distance(float metres) =>
            metres < 150f ? "close by" : metres < 350f ? "a short walk" : metres < 700f ? "a good walk" :
            metres < 1100f ? "half a morning's walk" : metres < 1600f ? "half a day's walk" : "a long day's walk";

        public static string TerrainWords(string code, Heightmap.Biome target)
        {
            switch (code)
            {
                case "sea": return "across the water";
                case "mountain": return "round the mountain";
                case "river": return "across the river";
                case "ridge": return "over the ridge";
                case "swamp": return "past the swamp";
                case "forest": return "through the forest";
                case "high": return "up the mountain";
                case "hill": return target == Heightmap.Biome.Mountain ? "up the mountain" : "up the hill";
                case "down": return "down the slope";
                case "shore": return "along the shore";
                default: return "";
            }
        }

        public static string BiomeWords(Heightmap.Biome biome)
        {
            switch (biome)
            {
                case Heightmap.Biome.Meadows: return "open meadow";
                case Heightmap.Biome.BlackForest: return "the dark forest";
                case Heightmap.Biome.Swamp: return "the swamp";
                case Heightmap.Biome.Mountain: return "the mountains";
                case Heightmap.Biome.Plains: return "the plains";
                case Heightmap.Biome.Ocean: return "the sea";
                case Heightmap.Biome.Mistlands: return "the mist";
                case Heightmap.Biome.AshLands: return "the burning lands";
                case Heightmap.Biome.DeepNorth: return "the frozen north";
                default: return "strange country";
            }
        }
    }
}
