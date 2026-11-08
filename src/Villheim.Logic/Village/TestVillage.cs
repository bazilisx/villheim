using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Designs;
using Villheim.Logic.Villagers;
using Villheim.Prefabs;
using Object = UnityEngine.Object;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Test villages: 'vh village spawn' sets up a whole village at a chosen stage in front of the player, so it can be
    /// walked round and tried at once. It goes through the same steps the village takes over days, only all at once:
    ///
    /// - The hearth is lit and the village founded as with 'vh settle' (the hearth ground cleared and levelled), then
    ///   given the culture, biome and seed asked for.
    /// - Buildings are chosen in Growth's order (homes for the first settlers, the longhouse, the workshop and the
    ///   storehouse, then homes, farms, more workshops and a few rebuilds by weight) from the culture's design sets, with
    ///   the biome's materials and the early stone rule, placed by PlotFinder, and put up piece by piece through the
    ///   normal construction site, a few dozen pieces a frame. The village chests pay for it all without losing anything
    ///   (VillageChest.FreeVillage), within the frame only.
    /// - After each building its path is laid (boardwalks where the culture builds them) and everything the village would
    ///   make for itself is made (Amenities: the cooking station, the notice board, beds, storage chests with labels,
    ///   benches, stacks and furnishings). At the end come the fence ring, the farms' plants and animals, the map table,
    ///   the villagers (Jarl first, trades by arrival, a few elders and children when there are enough), the gear tier
    ///   for the stage, a survey of the land to the stage's reach and a modest stock in the chest.
    /// - The hearth is marked as a test village, so 'vh village clear' removes only what Villheim made for it.
    ///
    /// The village then goes on living as any other: the growth clock starts from now.
    /// </summary>
    internal static class TestVillage
    {
        public static readonly int KeyTest = "villheim_testvillage".GetStableHashCode();

        private static readonly string[] StageNames = { "camp", "hamlet", "village", "town" };
        private static readonly int[] StageMin = { 0, 2, 4, 7 };
        private static readonly int[] StageMax = { 1, 3, 6, MostBuildings };
        private const int MostBuildings = 30;
        private const int MostVillagers = 40;
        private const float HearthAhead = 12f;

        private static readonly Dictionary<string, Heightmap.Biome> BiomeCodes = new Dictionary<string, Heightmap.Biome>
        {
            ["md"] = Heightmap.Biome.Meadows, ["bf"] = Heightmap.Biome.BlackForest, ["sw"] = Heightmap.Biome.Swamp,
            ["mt"] = Heightmap.Biome.Mountain, ["pl"] = Heightmap.Biome.Plains, ["ml"] = Heightmap.Biome.Mistlands,
            ["al"] = Heightmap.Biome.AshLands, ["dn"] = Heightmap.Biome.DeepNorth,
        };

        private static bool _running;

        public static readonly string[] Help =
        {
            "village spawn [stage] [villagers] [buildings] [culture] [biome] [flat] [noanimals] [nopaths] [empty] [seed <n>]: " +
            "set up a whole village in front of you at once ('vh village spawn help' for the codes; alias 'vh testvillage')",
            "village stage <stage>: jump the nearest village to that stage at once (builds what the stage adds, villagers up to its count)",
            "village clear [yes]: remove the nearest test village and everything Villheim made for it",
        };

        private static readonly string[] Usage =
        {
            "Villheim test villages:",
            "   vh village spawn [stage] [villagers] [buildings] [culture] [biome] [options]",
            "      stage: camp, hamlet, village, town, or 1 to 4 (first word). Default: village.",
            "      villagers, buildings: plain numbers, in that order. Defaults by stage from TestVillageVillagers and",
            "      TestVillageBuildings (config '9 - Test villages'). Buildings set the stage: camp 0-1, hamlet 2-3, village 4-6, town 7+.",
            "      culture: a key from 'vh cultures' (default: the biome's weighted pick).",
            "      biome: md bf sw mt pl ml al dn. Picks the culture and the design set only; the village stands where you are.",
            "      options: flat (clear and level a wide area first), noanimals, nopaths (paths left for the villagers to lay),",
            "      empty (no stock in the chest), seed <n> (the same choices again on the same ground).",
            "   vh village stage <stage> [villagers] [buildings] [noanimals] [nopaths] [seed <n>]: on the nearest village.",
            "   vh village clear: says what would go; 'vh village clear yes' removes it. 'vh tidy villages' clears any village in range.",
            "   Examples: vh village spawn town 14 12 celtic | vh village spawn hamlet bf flat | vh testvillage 2 5 seed 42",
        };

        private sealed class Options
        {
            public int Stage = -1;
            public int Villagers = -1;
            public int Buildings = -1;
            public string Culture;
            public Heightmap.Biome Biome = Heightmap.Biome.None;
            public bool Flat;
            public bool NoAnimals;
            public bool NoPaths;
            public bool Empty;
            public int? Seed;
            public readonly List<string> Unknown = new List<string>();
            public readonly List<string> Notes = new List<string>();
        }

        private sealed class Run
        {
            public Terminal Context;
            public Options Options;
            public VillageHearth Hearth;
            public System.Random Rng;
            public int Stage;
            public int TargetBuildings;
            public int TargetVillagers;
            public int UpgradesLeft;
            public bool LastOk;
            public int Paths;
            public int Fence;
            public int Plants;
            public int Animals;
            public float Started;
            public readonly Dictionary<Role, int> NoRoom = new Dictionary<Role, int>();
            public readonly Dictionary<string, int> Made = new Dictionary<string, int>();
            public readonly List<string> Rebuilt = new List<string>();
            public readonly List<string> Skipped = new List<string>();
            public readonly List<Villager> NewVillagers = new List<Villager>();
        }

        /// <summary>The words after 'vh village' that belong here.</summary>
        public static bool Handles(string word)
        {
            string w = (word ?? "").ToLowerInvariant();
            return w == "spawn" || w == "clear" || w == "stage" || w == "help";
        }

        /// <summary>'vh village spawn|stage|clear|help ...' and 'vh testvillage ...'.</summary>
        public static string Command(string[] args, Terminal context)
        {
            string verb = args.Length > 0 ? args[0].ToLowerInvariant() : "help";
            string[] rest = args.Skip(1).ToArray();
            if (verb == "help" || (rest.Length > 0 && rest[0].ToLowerInvariant() == "help"))
            {
                return string.Join("\n", Usage);
            }

            switch (verb)
            {
                case "spawn": return Spawn(rest, context);
                case "stage": return Stage(rest, context);
                case "clear": return Clear(rest);
                default: return string.Join("\n", Usage);
            }
        }

        // ---------------------------------------------------------------- the words

        private static bool StageOf(string word, out int stage)
        {
            stage = Array.IndexOf(StageNames, word);
            if (stage >= 0)
            {
                return true;
            }

            if (int.TryParse(word, NumberStyles.Integer, CultureInfo.InvariantCulture, out int n) && n >= 1 && n <= 4)
            {
                stage = n - 1;
                return true;
            }

            stage = -1;
            return false;
        }

        private static Options Parse(string[] words)
        {
            var options = new Options();
            for (int i = 0; i < words.Length; i++)
            {
                string w = words[i].ToLowerInvariant();
                if (i == 0 && StageOf(w, out int first))
                {
                    options.Stage = first;
                }
                else if (w == "seed" && i + 1 < words.Length &&
                         int.TryParse(words[i + 1], NumberStyles.Integer, CultureInfo.InvariantCulture, out int seed))
                {
                    options.Seed = seed;
                    i++;
                }
                else if (w == "flat") options.Flat = true;
                else if (w == "noanimals") options.NoAnimals = true;
                else if (w == "nopaths") options.NoPaths = true;
                else if (w == "empty") options.Empty = true;
                else if (int.TryParse(w, NumberStyles.Integer, CultureInfo.InvariantCulture, out int n))
                {
                    if (options.Villagers < 0) options.Villagers = n;
                    else if (options.Buildings < 0) options.Buildings = n;
                    else options.Unknown.Add(w);
                }
                else if (options.Stage < 0 && Array.IndexOf(StageNames, w) >= 0)
                {
                    options.Stage = Array.IndexOf(StageNames, w);
                }
                else if (BiomeCodes.TryGetValue(w, out Heightmap.Biome code))
                {
                    options.Biome = code;
                }
                else if (Cultures.Known(w))
                {
                    options.Culture = w;
                }
                else if (Cultures.TryBiome(w, out Heightmap.Biome named) && named != Heightmap.Biome.None)
                {
                    options.Biome = named;
                }
                else
                {
                    options.Unknown.Add(w);
                }
            }

            return options;
        }

        private static int ByStage(BepInEx.Configuration.ConfigEntry<string> entry, int stage, int[] fallback)
        {
            int[] values = (entry?.Value ?? "").Split(',')
                .Select(s => int.TryParse(s.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out int v) ? v : -1)
                .Where(v => v >= 0).ToArray();
            if (values.Length == 0)
            {
                values = fallback;
            }

            return values[Mathf.Min(stage, values.Length - 1)];
        }

        /// <summary>Fills in the stage, buildings and villagers from each other and the config, within the stage's range.</summary>
        private static void Resolve(Options options)
        {
            if (options.Stage < 0)
            {
                options.Stage = options.Buildings >= 0 ? VillageBrain.TierIndex(Mathf.Min(options.Buildings, MostBuildings)) : 2;
            }

            int stage = options.Stage;
            if (options.Buildings < 0)
            {
                options.Buildings = ByStage(LogicConfig.TestVillageBuildings, stage, new[] { 1, 3, 6, 10 });
            }

            int buildings = Mathf.Clamp(options.Buildings, StageMin[stage], StageMax[stage]);
            if (buildings != options.Buildings)
            {
                options.Notes.Add($"{options.Buildings} buildings is outside a {StageNames[stage]} ({StageMin[stage]} to {StageMax[stage]}); using {buildings}");
                options.Buildings = buildings;
            }

            if (options.Buildings > VillheimConfig.MaxBuildings.Value)
            {
                options.Notes.Add($"more buildings than MaxBuildings ({VillheimConfig.MaxBuildings.Value}): the village will not grow further");
            }

            if (options.Villagers < 0)
            {
                options.Villagers = ByStage(LogicConfig.TestVillageVillagers, stage, new[] { 2, 4, 7, 12 });
            }

            int villagers = Mathf.Clamp(options.Villagers, 1, MostVillagers);
            if (villagers != options.Villagers)
            {
                options.Notes.Add($"villagers kept to {villagers}");
                options.Villagers = villagers;
            }

            if (options.Villagers > VillheimConfig.MaxVillagers.Value)
            {
                options.Notes.Add($"more villagers than MaxVillagers ({VillheimConfig.MaxVillagers.Value}): nobody new will come");
            }
        }

        private static int Upgrades(int stage, int buildings) => stage < 2 ? 0 : stage == 2 ? 1 : 2 + (buildings - 7) / 3;

        // ---------------------------------------------------------------- spawn

        private static string Spawn(string[] words, Terminal context)
        {
            Player player = Player.m_localPlayer;
            if (player == null || ZNet.instance == null || ZoneSystem.instance == null)
            {
                return "Villheim: you need to be in a world to use this.";
            }

            if (_running)
            {
                return "Villheim: a test village is still being set up. Wait for it to finish.";
            }

            if (HearthPrefab.Prefab == null || VillagerPrefab.Prefab == null)
            {
                return "Villheim: the hearth or villager prefab is not loaded.";
            }

            Options options = Parse(words);
            if (options.Unknown.Count > 0)
            {
                return $"Villheim: did not understand '{string.Join(" ", options.Unknown)}'.\n" + string.Join("\n", Usage);
            }

            Resolve(options);
            var run = new Run
            {
                Context = context, Options = options, Stage = options.Stage, TargetBuildings = options.Buildings,
                TargetVillagers = options.Villagers, UpgradesLeft = Upgrades(options.Stage, options.Buildings), Started = Time.time,
            };

            VillheimPlugin.Instance.StartCoroutine(SpawnRoutine(run, player));
            return $"Villheim: setting up a {StageNames[run.Stage]} with {run.TargetBuildings} buildings and {run.TargetVillagers} villagers " +
                   $"in front of you{(options.Notes.Count > 0 ? " (" + string.Join("; ", options.Notes) + ")" : "")}. Progress follows.";
        }

        private static IEnumerator SpawnRoutine(Run run, Player player)
        {
            _running = true;
            try
            {
                Vector3 spot = Ahead(player, HearthAhead);
                if (run.Options.Flat)
                {
                    Say(run, "clearing and levelling the ground first");
                    Flatten(spot);
                    yield return new WaitForSeconds(1.5f);
                }
                else
                {
                    // The flattest ground for the whole village within reach, not only for the hearth (T-28).
                    spot = HearthGround.FlatVillageSpot(spot, VillheimConfig.VillageRadius.Value * 0.6f);
                }

                GameObject made = Object.Instantiate(HearthPrefab.Prefab, spot, Quaternion.Euler(0f, player.transform.eulerAngles.y, 0f));
                VillageHearth hearth = made.GetComponent<VillageHearth>();
                if (hearth == null || !hearth.IsValid)
                {
                    Say(run, "the hearth could not be lit here.");
                    yield break;
                }

                run.Hearth = hearth;
                hearth.Busy = true;
                hearth.Zdo.Set(VillageBrain.KeyManual, 1);
                hearth.Zdo.Set(KeyTest, 1);
                var state = new VillageState(hearth.Zdo);
                VillageBrain.Initialize(hearth, state);
                Identity(run, state);
                Chronicle.Add(hearth, $"{state.Name} was set up for testing as a {StageNames[run.Stage]}.");
                Say(run, $"founded {state.Name} ({Cultures.Get(Cultures.Of(state)).Name}, {state.Biome}, {state.Type}, seed {state.Seed}) " +
                         $"{Utils.DistanceXZ(spot, player.transform.position):0} m away");

                // The hearth ground settles, then the chest goes down by the fire.
                yield return new WaitForSeconds(1f);
                VillageChest.Ensure(hearth);
                yield return new WaitForSeconds(0.3f);

                yield return Grow(run);
                yield return Finish(run);
            }
            finally
            {
                _running = false;
                if (run.Hearth != null)
                {
                    run.Hearth.Busy = false;
                }
            }
        }

        /// <summary>The seed, biome, culture and name asked for, over what founding rolled.</summary>
        private static void Identity(Run run, VillageState state)
        {
            Options options = run.Options;
            if (options.Seed.HasValue)
            {
                state.Seed = options.Seed.Value;
            }

            if (options.Biome != Heightmap.Biome.None)
            {
                state.Biome = options.Biome;
            }

            string culture = options.Culture ?? Cultures.Roll(state.Biome, state.Seed);
            state.Culture = culture;
            state.Name = Names.Village(new System.Random(state.Seed), culture);
            run.Rng = new System.Random(state.Seed);
        }

        private static Vector3 Ahead(Player player, float distance)
        {
            Vector3 forward = player.transform.forward;
            forward.y = 0f;
            Vector3 position = player.transform.position + forward.normalized * distance;
            if (ZoneSystem.instance.GetGroundHeight(position, out float y))
            {
                position.y = y;
            }

            return position;
        }

        /// <summary>'flat': trees and rocks off, and the ground level, over most of the village's radius.</summary>
        private static void Flatten(Vector3 center)
        {
            float radius = VillheimConfig.VillageRadius.Value * 0.8f;
            var heights = new List<float>();
            for (float x = -radius; x <= radius; x += 6f)
            {
                for (float z = -radius; z <= radius; z += 6f)
                {
                    if (x * x + z * z <= radius * radius && ZoneSystem.instance.GetGroundHeight(center + new Vector3(x, 0f, z), out float h))
                    {
                        heights.Add(h);
                    }
                }
            }

            heights.Sort();
            float level = heights.Count > 0 ? heights[heights.Count / 2] : center.y;
            level = Mathf.Max(level, ZoneSystem.instance.m_waterLevel + 1f);
            HearthGround.ClearAround(center, radius + 4f);
            TerrainShaper.LevelPad(new Vector3(center.x, level, center.z), radius, radius + 10f);
            HearthGround.ClearVegetation(new Vector3(center.x, level, center.z), radius);
        }

        // ---------------------------------------------------------------- stage

        private static string Stage(string[] words, Terminal context)
        {
            Player player = Player.m_localPlayer;
            if (player == null)
            {
                return "Villheim: you need to be in a world to use this.";
            }

            if (_running)
            {
                return "Villheim: a test village is still being set up. Wait for it to finish.";
            }

            VillageHearth hearth = VillageHearth.Closest(player.transform.position, 150f);
            if (hearth == null || !hearth.IsValid || !new VillageState(hearth.Zdo).Initialized)
            {
                return "Villheim: no village hearth within 150 m.";
            }

            Options options = Parse(words);
            if (options.Stage < 0 || options.Unknown.Count > 0 || options.Culture != null || options.Biome != Heightmap.Biome.None)
            {
                return "Villheim: vh village stage <camp|hamlet|village|town|1-4> [villagers] [buildings] [noanimals] [nopaths] [seed <n>]";
            }

            var state = new VillageState(hearth.Zdo);
            Resolve(options);
            int have = state.Plots.Count;
            int people = VillageBrain.CountVillagers(state.Id);
            if (have >= options.Buildings && people >= options.Villagers && !ConstructionSite.IsActive(hearth.Zdo))
            {
                return $"Villheim: {state.Name} already has {have} buildings and {people} villagers ({VillageBrain.Tier(have)}). Nothing to add.";
            }

            var run = new Run
            {
                Context = context, Options = options, Hearth = hearth, Stage = options.Stage, TargetBuildings = Mathf.Max(have, options.Buildings),
                TargetVillagers = options.Villagers, Started = Time.time,
                UpgradesLeft = Mathf.Max(0, Upgrades(options.Stage, options.Buildings) - Upgrades(VillageBrain.TierIndex(have), have)),
                Rng = new System.Random(options.Seed ?? unchecked(state.Seed + have * 7919 + (int)Time.time)),
            };

            VillheimPlugin.Instance.StartCoroutine(StageRoutine(run));
            return $"Villheim: taking {state.Name} from {have} buildings and {people} villagers to a {StageNames[run.Stage]} with " +
                   $"{run.TargetBuildings} buildings and {run.TargetVillagers} villagers" +
                   $"{(options.Notes.Count > 0 ? " (" + string.Join("; ", options.Notes) + ")" : "")}. Progress follows.";
        }

        private static IEnumerator StageRoutine(Run run)
        {
            _running = true;
            VillageHearth hearth = run.Hearth;
            try
            {
                if (!hearth.NView.IsOwner())
                {
                    hearth.NView.ClaimOwnership();
                }

                hearth.Busy = true;
                if (ConstructionSite.IsActive(hearth.Zdo))
                {
                    Say(run, "finishing the building already going up");
                    yield return PlaceAll(run);
                    yield return LayPaths(run);
                    yield return Furnish(run);
                }

                Chronicle.Add(hearth, $"{hearth.VillageName} was grown to a {StageNames[run.Stage]} for testing.");
                yield return Grow(run);
                yield return Finish(run);
            }
            finally
            {
                _running = false;
                if (hearth != null)
                {
                    hearth.Busy = false;
                }
            }
        }

        // ---------------------------------------------------------------- buildings

        private static int NoRoom(Run run, Role role) => run.NoRoom.TryGetValue(role, out int n) ? n : 0;

        private static IEnumerator Grow(Run run)
        {
            VillageHearth hearth = run.Hearth;
            int steps = 0;
            while (hearth != null && hearth.IsValid && new VillageState(hearth.Zdo).Plots.Count < run.TargetBuildings &&
                   steps++ < run.TargetBuildings * 3 + 10)
            {
                Growth.Project project = Choose(run);
                if (project == null)
                {
                    break;
                }

                if (project.IsUpgrade)
                {
                    yield return Upgrade(run, project.UpgradeIndex);
                }
                else
                {
                    yield return Build(run, project.Role);
                }

                if (!run.LastOk)
                {
                    continue;
                }

                yield return LayPaths(run);
                yield return Furnish(run);
                var state = new VillageState(hearth.Zdo);
                Say(run, $"{state.Plots.Count} of {run.TargetBuildings} buildings stand ({Time.time - run.Started:0} s)");
            }

            if (hearth != null && hearth.IsValid)
            {
                int missing = run.TargetBuildings - new VillageState(hearth.Zdo).Plots.Count;
                if (missing > 0)
                {
                    run.Skipped.Add($"{missing} building{(missing == 1 ? "" : "s")}: no room found for more");
                }
            }
        }

        /// <summary>
        /// The next building, in Growth's order: homes until the first settlers have beds, the longhouse, the workshop
        /// and the storehouse, then by Growth's weights (homes while beds are short, a farm, more workshops once there are
        /// trades, and rebuilding one bigger while this stage still has some to do). A kind with no room twice is left out.
        /// </summary>
        private static Growth.Project Choose(Run run)
        {
            VillageHearth hearth = run.Hearth;
            var state = new VillageState(hearth.Zdo);
            IReadOnlyList<Plot> plots = state.Plots;
            Beds.Forget(state.Id);
            int beds = Beds.Of(hearth).Count;
            int Count(Role role) => plots.Count(p => Growth.RoleOf(p) == role);
            bool Open(Role role) => NoRoom(run, role) < 2;

            int first = Mathf.Min(run.TargetVillagers, VillheimConfig.StartingVillagers.Value);
            if ((Count(Role.House) == 0 || beds < first) && Open(Role.House))
            {
                return new Growth.Project { Role = Role.House };
            }

            if (Count(Role.Hub) == 0 && Open(Role.Hub))
            {
                return new Growth.Project { Role = Role.Hub };
            }

            var options = new List<(Growth.Project Project, float Weight)>();
            if (Count(Role.Workshop) == 0 && Open(Role.Workshop)) options.Add((new Growth.Project { Role = Role.Workshop }, 1f));
            if (Count(Role.Storage) == 0 && Open(Role.Storage)) options.Add((new Growth.Project { Role = Role.Storage }, 1f));
            if (options.Count == 0)
            {
                float TypeFactor(Role role) =>
                    state.Type == "woodland" && role == Role.Workshop ? 2f :
                    state.Type == "farming" && role == Role.Farm ? 2.5f :
                    state.Type == "fortified" && role == Role.House ? 1.2f : 1f;

                if (Open(Role.House))
                {
                    options.Add((new Growth.Project { Role = Role.House }, 6f * (beds < run.TargetVillagers ? 2f : 1f) * TypeFactor(Role.House)));
                }

                if (Open(Role.Farm))
                {
                    options.Add((new Growth.Project { Role = Role.Farm }, (Count(Role.Farm) == 0 ? 2f : 0.5f) * TypeFactor(Role.Farm)));
                }

                if (run.TargetVillagers >= Roles.TradesFrom && Count(Role.Workshop) < 3 && Open(Role.Workshop))
                {
                    options.Add((new Growth.Project { Role = Role.Workshop }, 1.5f * TypeFactor(Role.Workshop)));
                }

                if (run.UpgradesLeft > 0)
                {
                    using (Materials.From(hearth))
                    {
                        for (int i = 0; i < plots.Count; i++)
                        {
                            DesignLibrary.Design? next = Growth.NextDesign(plots[i], state.Biome, Cultures.Of(state));
                            if (next != null && PlotFinder.CanUpgrade(plots[i], next.Value.Radius, hearth.transform.position, state.Axis, plots, state.Id))
                            {
                                options.Add((new Growth.Project { Role = Growth.RoleOf(plots[i]), UpgradeIndex = i }, 8f / plots.Count * 2f));
                            }
                        }
                    }
                }
            }

            if (options.Count == 0)
            {
                return null;
            }

            float roll = (float)run.Rng.NextDouble() * options.Sum(o => o.Weight);
            foreach ((Growth.Project project, float weight) in options)
            {
                roll -= weight;
                if (roll <= 0f)
                {
                    return project;
                }
            }

            return options[options.Count - 1].Project;
        }

        /// <summary>Picks a design and a plot for the role as TryGrow does, then puts the building up at once.</summary>
        private static IEnumerator Build(Run run, Role role)
        {
            VillageHearth hearth = run.Hearth;
            var state = new VillageState(hearth.Zdo);
            IReadOnlyList<Plot> plots = state.Plots;
            run.LastOk = false;
            DesignLibrary.Design chosen = default;
            Vector3 position = Vector3.zero;
            float yaw = 0f;
            bool found = false;
            bool noDesign = false;
            int tried = 0;

            using (Materials.From(hearth))
            {
                string culture = Cultures.Of(state);
                List<DesignLibrary.Design> pool = DesignLibrary.PoolFor(state.Biome, role, culture);
                DesignLibrary.Design? picked = role == Role.Storage && pool.Count > 0
                    ? pool.OrderBy(d => d.Radius).First()
                    : DesignLibrary.Pick(pool, run.Rng);
                if (picked == null)
                {
                    noDesign = true;
                }
                else
                {
                    var candidates = new List<DesignLibrary.Design> { picked.Value };
                    List<DesignLibrary.Design> fallbacks = DesignLibrary.FallbackPool(state.Biome, role, culture);
                    fallbacks.Reverse();
                    foreach (DesignLibrary.Design fallback in fallbacks)
                    {
                        if (candidates.Count >= 4)
                        {
                            break;
                        }

                        if (!candidates.Exists(d => d.Name == fallback.Name) && fallback.Radius < picked.Value.Radius)
                        {
                            candidates.Add(fallback);
                        }
                    }

                    bool strictHub = NoRoom(run, role) == 0;
                    foreach (DesignLibrary.Design design in candidates)
                    {
                        tried++;
                        Vector3? fire = role == Role.Hub && !plots.Any(p => p.Role == nameof(Role.Hub)) ? DesignLibrary.FireOf(design) : null;
                        if ((fire.HasValue && PlotFinder.AroundHearth(hearth.transform.position, state.Axis, fire.Value, design.Radius,
                                design.MaxTerrainDelta, state.Id, out position, out yaw)) ||
                            PlotFinder.TryFind(hearth.transform.position, state.Axis, role, strictHub, design.Radius, design.MaxTerrainDelta,
                                plots, run.Rng, out position, out yaw, PathPlanner.PlannedNetwork(hearth), hearth, Doors.Angle(design)))
                        {
                            chosen = design;
                            found = true;
                            break;
                        }
                    }
                }
            }

            string kind = VillageBrain.RoleName(role);
            if (noDesign)
            {
                run.NoRoom[role] = 2;
                run.Skipped.Add($"a {kind}: no design for this biome and culture");
                yield break;
            }

            if (!found)
            {
                run.NoRoom[role] = NoRoom(run, role) + 1;
                if (NoRoom(run, role) == 2)
                {
                    run.Skipped.Add($"a {kind}: no room for it ({tried} designs tried, twice)");
                }

                yield break;
            }

            Say(run, $"building a {kind}: {chosen.Name}");
            DesignSpawner.ClearArea(position, chosen.Radius);
            yield return new WaitForSeconds(0.3f);
            if (hearth == null || !hearth.IsValid)
            {
                yield break;
            }

            int before = new VillageState(hearth.Zdo).Plots.Count;
            ConstructionSite.Begin(hearth.Zdo, new ConstructionSite.Site
            {
                Design = chosen.Name, Position = position, Yaw = yaw, Radius = chosen.Radius, Role = role,
                Seed = run.Rng.Next(1, int.MaxValue),
            });
            ConstructionSite.SettleHeight(hearth);
            float floor = ConstructionSite.FloorHeight(hearth);
            ConstructionSite.PrepareGround(hearth, position);

            // The heightmaps rebuild before the first piece goes up: pieces put up over ground that had not caught up
            // stood in the air and broke (T-30).
            yield return GroundSettled(position, floor);
            yield return PlaceAll(run);
            run.LastOk = hearth != null && hearth.IsValid && new VillageState(hearth.Zdo).Plots.Count > before;
            if (run.LastOk)
            {
                // The ground made to meet the foundation as it stands, so nothing is left in the air.
                Plot built = new VillageState(hearth.Zdo).Plots.LastOrDefault();
                if (built != null)
                {
                    Freely(hearth, () => ConstructionSite.RelevelBuilding(hearth, built));
                }
            }
            if (!run.LastOk)
            {
                run.Skipped.Add($"the {chosen.Name}: it could not be put up");
            }
        }

        /// <summary>Rebuilds a building bigger where it stands, as TryUpgrade does, at once.</summary>
        private static IEnumerator Upgrade(Run run, int index)
        {
            VillageHearth hearth = run.Hearth;
            var state = new VillageState(hearth.Zdo);
            run.LastOk = false;
            run.UpgradesLeft--;
            if (index < 0 || index >= state.Plots.Count)
            {
                yield break;
            }

            Plot plot = state.Plots[index];
            DesignLibrary.Design? next;
            using (Materials.From(hearth))
            {
                next = Growth.NextDesign(plot, state.Biome, Cultures.Of(state));
            }

            if (next == null)
            {
                yield break;
            }

            Role role = Growth.RoleOf(plot);
            Say(run, $"rebuilding the {VillageBrain.RoleName(role)} bigger: {plot.Design} as {next.Value.Name}");
            float yaw = PlotFinder.FaceHearth(plot.Position, hearth.transform.position, state.Axis) - Doors.Angle(next.Value);
            ConstructionSite.Begin(hearth.Zdo, new ConstructionSite.Site
            {
                Design = next.Value.Name, Position = plot.Position, Yaw = yaw, Radius = next.Value.Radius, Role = role,
                Seed = new System.Random(state.Seed + plot.Design.GetStableHashCode()).Next(1, int.MaxValue), Upgrade = true,
            });
            yield return PlaceAll(run);
            run.LastOk = hearth != null && hearth.IsValid && new VillageState(hearth.Zdo).Plots.Any(p => p.Design == next.Value.Name);
            if (run.LastOk)
            {
                run.Rebuilt.Add($"{plot.Design} as {next.Value.Name}");
            }
        }

        /// <summary>Waits (up to three seconds) until the ground at the spot reads the levelled height.</summary>
        private static IEnumerator GroundSettled(Vector3 spot, float floor)
        {
            float until = Time.time + 3f;
            yield return null;
            while (Time.time < until && (!ZoneSystem.instance.GetGroundHeight(spot, out float y) || Mathf.Abs(y - floor) > 0.2f))
            {
                yield return null;
            }

            yield return null;
        }

        /// <summary>Time this frame may still spend on setup work (TestVillageFrameMs).</summary>
        private static bool FrameLeft(System.Diagnostics.Stopwatch watch) =>
            watch.Elapsed.TotalMilliseconds < Mathf.Clamp(LogicConfig.TestVillageFrameMs?.Value ?? 6f, 1f, 100f);

        /// <summary>
        /// Puts up every piece of the construction site through ConstructionSite.PlaceNext (so it is built and finished
        /// as builders would), a few dozen pieces a frame. Taking down an old building comes first on a rebuild; the ground
        /// gets a moment to settle after it.
        /// </summary>
        private static IEnumerator PlaceAll(Run run)
        {
            VillageHearth hearth = run.Hearth;
            int perFrame = Mathf.Clamp(LogicConfig.TestVillagePiecesPerFrame?.Value ?? 60, 5, 1000);
            int guard = 20000;
            while (hearth != null && hearth.IsValid && ConstructionSite.IsActive(hearth.Zdo) && guard > 0)
            {
                bool settle = false;
                bool stuck = false;
                var watch = System.Diagnostics.Stopwatch.StartNew();
                Freely(hearth, () =>
                {
                    for (int i = 0; i < perFrame && guard > 0 && (i == 0 || FrameLeft(watch)); i++, guard--)
                    {
                        bool tearing = ConstructionSite.TearingDown(hearth);
                        if (!ConstructionSite.PlaceNext(hearth, false))
                        {
                            stuck = ConstructionSite.IsActive(hearth.Zdo);
                            break;
                        }

                        if (tearing && !ConstructionSite.TearingDown(hearth))
                        {
                            settle = true;
                            break;
                        }

                        if (!ConstructionSite.IsActive(hearth.Zdo))
                        {
                            break;
                        }
                    }
                });

                if (stuck)
                {
                    run.Skipped.Add($"the building going up stopped: {new VillageState(hearth.Zdo).Waiting}");
                    yield break;
                }

                if (settle)
                {
                    yield return new WaitForSeconds(0.6f);
                }
                else
                {
                    yield return null;
                }
            }
        }

        // ---------------------------------------------------------------- what the village makes for itself

        /// <summary>Lays the queued paths a few metres a frame: each metre is a terrain edit, and all at once froze the game (T-29).</summary>
        private static IEnumerator LayPaths(Run run)
        {
            if (run.Options.NoPaths || !VillheimConfig.BuildPaths.Value || run.Hearth == null || !run.Hearth.IsValid)
            {
                yield break;
            }

            for (int guard = 0; guard < 5000 && run.Hearth != null && run.Hearth.IsValid; guard++)
            {
                int laid = 0;
                Freely(run.Hearth, () => laid = PathLaying.LayAllNow(run.Hearth, 6));
                run.Paths += laid;
                if (laid == 0)
                {
                    yield break;
                }

                yield return null;
            }
        }

        /// <summary>Everything Amenities would have the village make, one a frame, until nothing is missing.</summary>
        private static IEnumerator Furnish(Run run)
        {
            VillageHearth hearth = run.Hearth;
            string last = null;
            int repeats = 0;
            for (int i = 0; i < 400 && hearth != null && hearth.IsValid; i++)
            {
                Physics.SyncTransforms();
                Amenities.Forget(hearth.VillageId);
                Amenities.Job job = null;
                Freely(hearth, () => job = Amenities.Due(hearth));
                if (job == null)
                {
                    yield break;
                }

                string key = $"{job.Name}|{Mathf.RoundToInt(job.Spot.x)}|{Mathf.RoundToInt(job.Spot.z)}|{job.Kind}";
                repeats = key == last ? repeats + 1 : 0;
                last = key;
                if (repeats >= 2)
                {
                    run.Skipped.Add($"the {job.Name}{(job.Kind != null ? " for " + job.Kind : "")} and anything after it: it would not go down");
                    yield break;
                }

                bool made = false;
                Freely(hearth, () => made = Amenities.Make(hearth, job));
                if (made && repeats == 0)
                {
                    run.Made.TryGetValue(job.Name, out int n);
                    run.Made[job.Name] = n + 1;
                }

                yield return null;
            }
        }

        /// <summary>The fence ring for the stage (Palisade), a few segments a frame.</summary>
        private static IEnumerator Fence(Run run)
        {
            VillageHearth hearth = run.Hearth;
            var watch = System.Diagnostics.Stopwatch.StartNew();
            for (int i = 0; i < 600 && hearth != null && hearth.IsValid; i++)
            {
                Palisade.Forget(hearth.VillageId);
                Palisade.Segment segment = null;
                Freely(hearth, () => segment = Palisade.Next(hearth));
                if (segment == null)
                {
                    yield break;
                }

                Freely(hearth, () => Palisade.Build(hearth, segment));
                if (segment.Remove == null)
                {
                    run.Fence++;
                }

                if (!FrameLeft(watch))
                {
                    yield return null;
                    watch.Restart();
                }
            }
        }

        /// <summary>Every farm's rows planted, and its animals for the stage (one grown boar, then young ones).</summary>
        private static IEnumerator Farm(Run run)
        {
            VillageHearth hearth = run.Hearth;
            for (int i = 0; i < 200 && hearth != null && hearth.IsValid; i++)
            {
                Physics.SyncTransforms();
                if (!Farms.NextPlanting(hearth, out Vector3 spot, out string prefab))
                {
                    break;
                }

                Farms.Plant(hearth, spot, prefab);
                run.Plants++;
                if (i % 3 == 2)
                {
                    yield return null;
                }
            }

            if (run.Options.NoAnimals || hearth == null || !hearth.IsValid)
            {
                yield break;
            }

            var state = new VillageState(hearth.Zdo);
            int tier = VillageBrain.TierIndex(state.Plots.Count);
            foreach (Plot farm in Farms.FarmPlots(state).ToList())
            {
                int have = Farms.Herd(hearth, farm).Count;
                for (int n = have; n < Farms.WantedAnimals(tier); n++)
                {
                    // The newest one is still young; the rest have grown.
                    string kind = n > 0 && n == Farms.WantedAnimals(tier) - 1 ? "Boar_piggy" : "Boar";
                    if (Farms.AddAnimal(hearth, farm, kind))
                    {
                        run.Animals++;
                    }
                }

                yield return null;
            }
        }

        // ---------------------------------------------------------------- the rest, and the people

        private static IEnumerator Finish(Run run)
        {
            VillageHearth hearth = run.Hearth;
            if (hearth == null || !hearth.IsValid)
            {
                yield break;
            }

            // Slopes between the building pads eased, so the levels don't meet in steps (T-57). Before the fence and
            // the paths, which go on the ground as it ends up.
            int eased = 0;
            Freely(hearth, () => eased = GroundBlend.Between(hearth));
            if (eased > 0)
            {
                Say(run, $"eased the slopes between the buildings ({eased} ground points)");
                yield return new WaitForSeconds(0.5f);
            }

            Say(run, "fence, farms and map table");
            yield return Fence(run);
            yield return Farm(run);
            var state = new VillageState(hearth.Zdo);

            // Gear for the stage, counted as made by the smith, before anyone dresses.
            int gear = VillagerLooks.GearTier(VillageBrain.TierIndex(state.Plots.Count), state.Biome);
            if (Smithing.Armoury(hearth) < gear)
            {
                Smithing.Raise(hearth, gear, "Set up for testing.");
            }

            Say(run, "villagers");
            yield return People(run);

            // Storage chests that come with more people, and anything else still missing.
            yield return Furnish(run);
            yield return LayPaths(run);

            string survey = Knowledge.On ? Knowledge.SurveyNow(hearth, state, true) : "village knowledge is off";
            Stock(run);
            Settle(run);
            Prosperity.Refresh(hearth);
            Chronicle.Add(hearth, $"Set up for testing: {state.Plots.Count} buildings and {VillageBrain.CountVillagers(state.Id)} villagers.");

            // Roles are worked out from a roster kept a few seconds; wait for it before telling who does what.
            yield return new WaitForSeconds(5.5f);
            if (hearth != null && hearth.IsValid)
            {
                Report(run, survey);
            }
        }

        /// <summary>
        /// Villagers up to the count, in arrival order (the first is the Jarl, trades by arrival from six on). With five
        /// or more grown-ups, about one in six is an elder; with six or more people, about one in six is a child born in a
        /// home. Each claims a bed as he comes.
        /// </summary>
        private static IEnumerator People(Run run)
        {
            VillageHearth hearth = run.Hearth;
            var state = new VillageState(hearth.Zdo);
            int existing = VillageBrain.CountVillagers(state.Id);
            int toAdd = Mathf.Max(0, run.TargetVillagers - existing);
            List<Plot> homes = state.Plots.Where(p => Growth.RoleOf(p) == Role.House).ToList();
            int children = existing == 0 && run.TargetVillagers >= 6 && homes.Count > 0 ? Mathf.Max(1, run.TargetVillagers / 6) : 0;
            int adults = toAdd - children;
            int elders = existing == 0 && adults >= 5 ? Mathf.Max(1, adults / 6) : 0;
            int elderDays = LogicConfig.ElderDays != null ? LogicConfig.ElderDays.Value : 40;

            for (int i = 0; i < adults; i++)
            {
                Villager villager = VillageBrain.SpawnVillager(hearth, state, null, true);
                if (villager != null)
                {
                    run.NewVillagers.Add(villager);
                    if (i >= 1 && i <= elders)
                    {
                        Elders.SetDaysHere(villager, elderDays);
                    }
                }

                if (i % 3 == 2)
                {
                    yield return null;
                }
            }

            for (int i = 0; i < children; i++)
            {
                Villager child = VillageBrain.SpawnVillager(hearth, state, homes[i % homes.Count], true);
                if (child != null)
                {
                    run.NewVillagers.Add(child);
                }

                yield return null;
            }
        }

        /// <summary>A modest stock in the chest for the stage (none with 'empty'); what the build left over is taken out first.</summary>
        private static void Stock(Run run)
        {
            VillageHearth hearth = run.Hearth;
            var state = new VillageState(hearth.Zdo);
            Container chest = VillageChest.Find(hearth);
            foreach (string material in Materials.Tracked)
            {
                state.Set(material, 0);
                int inChest = chest != null ? VillageChest.Count(chest, material) : 0;
                if (inChest > 0)
                {
                    VillageChest.Take(chest, new Dictionary<string, int> { { material, inChest } });
                }
            }

            if (run.Options.Empty)
            {
                return;
            }

            int stage = Living.Stage(state);
            HashSet<string> allowed = Materials.AllowedIn(state.Biome);
            var stock = new Dictionary<string, int>
            {
                [Materials.Wood] = 40 + 30 * stage,
                [Materials.Stone] = 20 + 20 * stage,
                [Materials.FineWood] = stage >= 2 ? 10 * stage : 0,
                [Materials.CoreWood] = stage >= 2 ? 10 * stage : 0,
                [state.Biome == Heightmap.Biome.BlackForest ? "Blueberries" : "Raspberry"] = 10 + 5 * stage,
            };

            foreach (KeyValuePair<string, int> entry in stock)
            {
                if (entry.Value <= 0 || (Materials.Tracked.Contains(entry.Key) && !allowed.Contains(entry.Key)))
                {
                    continue;
                }

                int added = chest != null ? VillageChest.Add(chest, entry.Key, entry.Value) : 0;
                if (added < entry.Value)
                {
                    state.Add(entry.Key, entry.Value - added);
                }
            }
        }

        /// <summary>The clocks start from now, so the village carries on growing and taking in people as usual.</summary>
        private static void Settle(Run run)
        {
            VillageHearth hearth = run.Hearth;
            var state = new VillageState(hearth.Zdo);
            double now = ZNet.instance.GetTimeSeconds();
            state.LastGrowth = now;
            state.LastArrival = now;
            state.LastSeen = now;
            state.Waiting = "";
            Growth.Clear(hearth);
            hearth.PlotAttempts = 0;
            Amenities.Forget(state.Id);
            Palisade.Forget(state.Id);
            Beds.Forget(state.Id);
            VillageNeeds.Forget(state.Id);
        }

        private static void Report(Run run, string survey)
        {
            VillageHearth hearth = run.Hearth;
            var state = new VillageState(hearth.Zdo);
            List<Villager> people = Character.GetAllCharacters().OfType<Villager>()
                .Where(v => !v.IsDead() && v.VillageId == state.Id && !Wanderers.IsWanderer(v)).ToList();
            var roles = new Dictionary<string, int>();
            foreach (Villager villager in people)
            {
                string title = Roles.Title(villager) ?? Roles.BackgroundOf(villager).ToString().ToLowerInvariant();
                if (Elders.IsElder(villager))
                {
                    title += " (elder)";
                }

                roles.TryGetValue(title, out int n);
                roles[title] = n + 1;
            }

            Beds.Forget(state.Id);
            int beds = Beds.Of(hearth).Count;
            var lines = new List<string>
            {
                $"Villheim: {state.Name} is set up in {Time.time - run.Started:0} s: a {VillageBrain.Tier(state.Plots.Count).ToLowerInvariant()} " +
                $"of the {Cultures.Get(Cultures.Of(state)).Name} ({Cultures.Of(state)}), {state.Biome}, {state.Type}, seed {state.Seed}.",
                $"   {people.Count} villagers: {string.Join(", ", roles.OrderBy(r => r.Key).Select(r => $"{r.Value} {r.Key}"))}; " +
                $"{beds} beds{(people.Count > beds ? $" ({people.Count - beds} sleep without one)" : "")}; gear {Smithing.TierName(Smithing.Armoury(hearth))}.",
                $"   {state.Plots.Count} buildings: " + string.Join(", ", state.Plots.GroupBy(p => Growth.RoleOf(p))
                    .Select(g => $"{VillageBrain.RoleName(g.Key)} x{g.Count()} ({string.Join(", ", g.Select(p => p.Design))})")),
            };

            if (run.Rebuilt.Count > 0)
            {
                lines.Add($"   rebuilt bigger: {string.Join("; ", run.Rebuilt)}");
            }

            lines.Add($"   made: {(run.Made.Count > 0 ? string.Join(", ", run.Made.Select(m => $"{m.Value} {m.Key}")) : "nothing")}; " +
                      $"fence {run.Fence} pieces; paths {(run.Options.NoPaths ? "left for the villagers" : run.Paths + " m")}; " +
                      $"farms {run.Plants} plants, {run.Animals} animals{(run.Options.NoAnimals ? " (noanimals)" : "")}; " +
                      $"map table {(MapTables.Find(hearth) != null ? "yes" : "no")}.");
            lines.Add($"   chest: {(run.Options.Empty ? "empty" : "a modest stock")}; {Calendar.Describe()}");
            lines.Add($"   knowledge: {survey}");
            if (run.Skipped.Count > 0)
            {
                lines.Add($"   skipped: {string.Join("; ", run.Skipped)}");
            }

            if (run.Options.Notes.Count > 0)
            {
                lines.Add($"   notes: {string.Join("; ", run.Options.Notes)}");
            }

            lines.Add(hearth.Zdo.GetInt(KeyTest) == 1
                ? "   'vh village clear yes' removes it again; 'vh village' and 'vh beds' show more."
                : "   'vh village' and 'vh beds' show more.");
            foreach (string line in lines)
            {
                run.Context?.AddString(line);
            }

            VillheimPlugin.Log.LogInfo(string.Join("\n", lines));
            if (MessageHud.instance != null)
            {
                MessageHud.instance.ShowMessage(MessageHud.MessageType.TopLeft, $"{state.Name} is ready.");
            }
        }

        // ---------------------------------------------------------------- helpers

        /// <summary>
        /// Runs <paramref name="action"/> with the village's chests paying for anything without losing it, or, with no
        /// chest, with plenty in its stock that is put back as it was after. Within this frame only.
        /// </summary>
        private static void Freely(VillageHearth hearth, Action action)
        {
            var state = new VillageState(hearth.Zdo);
            Dictionary<string, int> saved = null;
            if (VillageChest.Find(hearth) == null)
            {
                saved = state.Stock;
                foreach (string material in Materials.Tracked)
                {
                    state.Set(material, 1000000);
                }
            }

            VillageChest.FreeVillage = hearth.VillageId;
            try
            {
                action();
            }
            finally
            {
                VillageChest.FreeVillage = 0;
                if (saved != null)
                {
                    foreach (string material in Materials.Tracked)
                    {
                        state.Set(material, saved.TryGetValue(material, out int n) ? n : 0);
                    }
                }
            }
        }

        private static void Say(Run run, string text)
        {
            string name = run.Hearth != null && run.Hearth.IsValid ? run.Hearth.VillageName : "test village";
            run.Context?.AddString($"Villheim: {name}: {text}");
            VillheimPlugin.Log.LogInfo($"Test village {name}: {text}");
        }

        // ---------------------------------------------------------------- clear

        private static string Clear(string[] words)
        {
            Player player = Player.m_localPlayer;
            if (player == null || ZNetScene.instance == null)
            {
                return "Villheim: you need to be in a world to use this.";
            }

            if (_running)
            {
                return "Villheim: a test village is still being set up. Wait for it to finish.";
            }

            VillageHearth hearth = VillageHearth.All
                .Where(h => h != null && h.IsValid && h.Zdo.GetInt(KeyTest) == 1 &&
                            Vector3.Distance(h.transform.position, player.transform.position) < 150f)
                .OrderBy(h => Vector3.Distance(h.transform.position, player.transform.position)).FirstOrDefault();
            if (hearth == null)
            {
                return "Villheim: no test village within 150 m. Only villages made with 'vh village spawn' are cleared here; " +
                       "'vh clear' or 'vh tidy villages' removes any village.";
            }

            int id = hearth.VillageId;
            string name = hearth.VillageName;
            var doomed = new List<ZNetView>();
            int villagers = 0;
            foreach (ZNetView view in ZNetScene.instance.m_instances.Values.ToList())
            {
                if (view == null || !view.IsValid() || view.gameObject == hearth.gameObject)
                {
                    continue;
                }

                bool lives = view.TryGetComponent(out Villager villager) && villager.VillageId == id;
                if (lives || view.GetZDO().GetInt(Keys.BuiltBy) == id)
                {
                    doomed.Add(view);
                    villagers += lives ? 1 : 0;
                }
            }

            // The map table is marked with its own key (MapTables), not BuiltBy.
            MapTable table = MapTables.Find(hearth);
            if (table != null && table.m_nview != null && table.m_nview.IsValid() && !doomed.Contains(table.m_nview))
            {
                doomed.Add(table.m_nview);
            }

            if (!words.Any(w => w.ToLowerInvariant() == "yes"))
            {
                return $"Villheim: this removes {name} {Vector3.Distance(hearth.transform.position, player.transform.position):0} m away: " +
                       $"{villagers} villagers and {doomed.Count - villagers} other objects (buildings, chests and what is in them, signs, " +
                       "fence, plants, animals), its hearth and its map pin. Levelled ground stays. Type 'vh village clear yes' to go ahead.";
            }

            foreach (ZNetView view in doomed)
            {
                if (view != null && view.IsValid())
                {
                    view.ClaimOwnership();
                    ZNetScene.instance.Destroy(view.gameObject);
                }
            }

            int pins = 0;
            if (Minimap.instance != null)
            {
                foreach (Minimap.PinData pin in Minimap.instance.m_pins.Where(p => MapPins.IsOurs(p) &&
                             Utils.DistanceXZ(p.m_pos, hearth.transform.position) < 20f).ToList())
                {
                    Minimap.instance.RemovePin(pin);
                    pins++;
                }
            }

            hearth.NView.ClaimOwnership();
            ZNetScene.instance.Destroy(hearth.gameObject);
            return $"Villheim: removed {name}: {villagers} villagers, {doomed.Count - villagers} other objects, {pins} map pin{(pins == 1 ? "" : "s")} " +
                   "and the hearth. Levelled ground stays as it is.";
        }
    }
}
