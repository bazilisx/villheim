using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Designs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Design review in a fresh world, in two steps:
    ///
    /// 1. 'vh flatten [size]' clears everything from a square in front of the player and levels it at his feet's height,
    ///    as far as the game's 8 m either way allows, and takes the grass off. The player touches it up by hand (PlanBuild's
    ///    terrain tool).
    /// 2. 'vh gallery &lt;biome&gt; [group] [page N]' lays ten designs a page out in front of the player, grouped by kind,
    ///    each on the middle height of the ground under it and set on its foundation after it is put down (measured
    ///    from its colliders), with a sign: kind, design name, creator. Only designs a player at that stage could build
    ///    (see Viable). 'vh gallery list' writes them all to a CSV for the review sheet, 'vh gallery show' lays out
    ///    named ones, 'vh gallery clear' removes a gallery. Gallery pieces never wear or fall (see NoWearPatch).
    /// </summary>
    internal static class Gallery
    {
        private sealed class Cell
        {
            public bool Terrace;
            public int Pieces;
            public DesignLibrary.Design Design;
            public Role Role;
            public Vector3 Center;
            public float Half;
            public bool Done;
        }

        private static readonly Role[] Order = { Role.House, Role.Hub, Role.Workshop, Role.Storage, Role.Farm };
        internal static readonly int KeyGallery = "villheim_gallery".GetStableHashCode();
        // Any calm land will do for a gallery (mobs can be set passive): not the Mistlands, Ashlands, Deep North or sea.
        private const Heightmap.Biome GalleryLand = Heightmap.Biome.Meadows | Heightmap.Biome.BlackForest | Heightmap.Biome.Plains |
                                                    Heightmap.Biome.Swamp | Heightmap.Biome.Mountain;

        private const float MaxRelief = 12f; // highest less lowest ground in the area: within the game's 8 m either way of the middle

        /// <summary>
        /// Gallery pieces never wear or fall: the game's support check would bring down a design whose pieces don't all
        /// hold each other up the moment it is put down in one go (seen 2026-11-06). Only pieces marked as the gallery's.
        /// </summary>
        [HarmonyLib.HarmonyPatch(typeof(WearNTear), nameof(WearNTear.UpdateWear))]
        internal static class NoWearPatch
        {
            private static bool Prefix(WearNTear __instance) =>
                __instance.m_nview == null || !__instance.m_nview.IsValid() || __instance.m_nview.GetZDO().GetInt(KeyGallery) != 1;
        }
        private const float PadSpacing = 24f;
        private const float PadRadius = 20f;
        private const float Margin = 12f;

        private sealed class Pad
        {
            public Vector3 Center;
            public bool Done;
        }

        /// <summary>The groups the gallery can show, by the word used in the command.</summary>
        private static readonly Dictionary<string, Role[]> Groups = new Dictionary<string, Role[]>
        {
            ["all"] = Order,
            ["house"] = new[] { Role.House },
            ["hall"] = new[] { Role.Hub },
            ["prof"] = new[] { Role.Workshop },
            ["storage"] = new[] { Role.Storage },
            ["farm"] = new[] { Role.Farm },
        };

        private const int PageSize = 10;

        public const string Usage =
            "vh gallery <meadows|blackforest> [all|house|hall|prof|storage|farm] [page N] [rescan]: ten designs a page, e.g. " +
            "'vh gallery meadows house page 2'. 'vh gallery list meadows' writes every design to BepInEx/Villheim/gallery-list-Meadows.csv. " +
            "'vh gallery show <name> [name...]' lays out those designs. 'vh gallery clear' removes a gallery.";

        private static bool _running;

        /// <summary>Materials a player has in each biome's stage of the game (the gallery's strict test).</summary>
        private static readonly Dictionary<Heightmap.Biome, HashSet<string>> StageMaterials = new Dictionary<Heightmap.Biome, HashSet<string>>
        {
            [Heightmap.Biome.Meadows] = new HashSet<string>
            {
                "Wood", "Stone", "FineWood", "Resin", "LeatherScraps", "DeerHide", "Flint", "BoneFragments", "Feathers", "Coal",
            },
            [Heightmap.Biome.BlackForest] = new HashSet<string>
            {
                "Wood", "Stone", "FineWood", "Resin", "LeatherScraps", "DeerHide", "Flint", "BoneFragments", "Feathers", "Coal",
                "RoundLog", "Copper", "Tin", "Bronze", "BronzeNails", "SurtlingCore", "GreydwarfEye", "TrollHide", "Thistle",
            },
        };

        /// <summary>Crafting stations a player has in each stage (the stonecutter needs iron, so stone walls are later).</summary>
        private static readonly Dictionary<Heightmap.Biome, HashSet<string>> StageStations = new Dictionary<Heightmap.Biome, HashSet<string>>
        {
            [Heightmap.Biome.Meadows] = new HashSet<string> { "piece_workbench" },
            [Heightmap.Biome.BlackForest] = new HashSet<string> { "piece_workbench", "forge" },
        };

        private enum Action
        {
            Page,
            List,
            Show,
        }

        /// <summary>'vh gallery ...' (see Usage).</summary>
        public static string Start(Player player, string[] args)
        {
            if (_running)
            {
                return "Villheim: a gallery is already being gathered; give it a moment.";
            }

            string first = args.Length > 0 ? args[0].ToLowerInvariant() : "";
            if (first == "clear")
            {
                var gone = new List<ZNetView>();
                foreach (ZNetView view in ZNetScene.instance.m_instances.Values)
                {
                    if (view != null && view.IsValid() && view.GetZDO().GetInt(KeyGallery) == 1 &&
                        Utils.DistanceXZ(view.transform.position, player.transform.position) < 600f)
                    {
                        gone.Add(view);
                    }
                }

                foreach (ZNetView view in gone)
                {
                    view.ClaimOwnership();
                    ZNetScene.instance.Destroy(view.gameObject);
                }

                return $"Villheim: removed {gone.Count} gallery pieces and signs within 600 m (the ground stays as it is).";
            }

            Action action = first == "list" ? Action.List : first == "show" ? Action.Show : Action.Page;
            string[] rest = action == Action.Page ? args : args.Skip(1).ToArray();
            Vector3 forward = player.transform.forward;
            forward.y = 0f;
            forward.Normalize();

            if (action == Action.Show)
            {
                if (rest.Length == 0)
                {
                    return "Villheim: " + Usage;
                }

                VillheimPlugin.Instance.StartCoroutine(ShowNamed(player.transform.position, forward, rest));
                return $"Villheim: laying out {rest.Length} named designs.";
            }

            string biomeName = rest.Length > 0 ? rest[0].ToLowerInvariant() : "meadows";
            Heightmap.Biome biome = biomeName.StartsWith("black") || biomeName.StartsWith("forest") ? Heightmap.Biome.BlackForest : Heightmap.Biome.Meadows;
            string group = "all";
            int page = 1;
            bool rescan = false;
            for (int a = 1; a < rest.Length; a++)
            {
                string word = rest[a].ToLowerInvariant();
                if (word == "rescan") rescan = true;
                else if (word == "page" && a + 1 < rest.Length && int.TryParse(rest[a + 1], out int n)) { page = Mathf.Max(1, n); a++; }
                else if (int.TryParse(word, out int m)) page = Mathf.Max(1, m);
                else if (word.StartsWith("prof") || word.StartsWith("work") || word.StartsWith("smith")) group = "prof";
                else if (word.StartsWith("hall") || word.StartsWith("hub") || word.StartsWith("long")) group = "hall";
                else if (word.StartsWith("hous") || word.StartsWith("home")) group = "house";
                else if (word.StartsWith("stor") || word.StartsWith("shed")) group = "storage";
                else if (word.StartsWith("farm") || word.StartsWith("barn")) group = "farm";
                else if (word != "all") return "Villheim: " + Usage;
            }

            VillheimPlugin.Instance.StartCoroutine(Run(player.transform.position, forward, biome, group, page, rescan, action));
            return action == Action.List
                ? $"Villheim: gathering every {biome} design to list them."
                : $"Villheim: gathering {biome} designs ({group}, page {page}).";
        }

        /// <summary>Every design a player at that stage could build, from the curated lists, the blueprints and the locations.</summary>
        private static IEnumerator Gather(Heightmap.Biome biome, bool rescan, List<Cell> cells)
        {
            var seen = new HashSet<string>();
            void Add(DesignLibrary.Design design, Role role, int pieces)
            {
                if (seen.Add(design.Name))
                {
                    cells.Add(new Cell { Design = design, Role = role, Pieces = pieces, Half = Mathf.Clamp(design.Radius + 2f, 6f, 36f) });
                }
            }

            // Curated designs and every blueprint (Villheim's folder, PlanBuild's, the plugins folder).
            var candidates = new List<(DesignLibrary.Design Design, Role Role)>();
            Safe("the curated lists", () =>
            {
                foreach (Role role in Order)
                {
                    foreach (DesignLibrary.Design design in DesignLibrary.PoolFor(biome, role).Concat(DesignLibrary.FallbackPool(biome, role)))
                    {
                        candidates.Add((design, role));
                    }
                }
            });

            Safe("the blueprints", () =>
            {
                foreach (Blueprints.Blueprint blueprint in Blueprints.All().Values)
                {
                    if (blueprint.Biome == null || Matches(blueprint.Biome, biome))
                    {
                        candidates.Add((new DesignLibrary.Design(blueprint, 1f), blueprint.Role));
                    }
                }
            });

            foreach ((DesignLibrary.Design design, Role role) in candidates)
            {
                if (seen.Contains(design.Name))
                {
                    continue;
                }

                int pieces = 0;
                string why = null;
                Safe(design.Name, () => why = Viable(design, biome, out pieces));
                if (why == null)
                {
                    Add(design, role, pieces);
                }
                else
                {
                    VillheimPlugin.Debug($"Gallery: {design.Name} left out: {why}.");
                }
            }

            // Every location in the game, one per frame; what each turned out to be is kept on disk.
            var locations = new List<ZoneSystem.ZoneLocation>();
            Safe("the location list", () => locations.AddRange(ZoneSystem.instance.m_locations
                .Where(l => l != null && l.m_prefab.IsValid && l.m_exteriorRadius <= 40f && !Unsuitable(l.m_prefabName) && !AssetGuard.IsBroken(l))
                .GroupBy(l => l.m_prefabName).Select(g => g.First())));
            Dictionary<string, int> known = rescan ? new Dictionary<string, int>() : ReadCache(biome);
            int checkedCount = 0, opened = 0;
            foreach (ZoneSystem.ZoneLocation location in locations)
            {
                checkedCount++;
                if (seen.Contains(location.m_prefabName))
                {
                    continue;
                }

                if (!known.TryGetValue(location.m_prefabName, out int pieces))
                {
                    pieces = 0;
                    var design = new DesignLibrary.Design(location, 1f);
                    string why = "error";
                    int counted = 0;
                    Safe(location.m_prefabName, () => why = Viable(design, biome, out counted));
                    pieces = why == null ? counted : 0;
                    known[location.m_prefabName] = pieces;
                    if (++opened % 10 == 0)
                    {
                        MessageHud.instance?.ShowMessage(MessageHud.MessageType.TopLeft,
                            $"Gallery: looked at {checkedCount}/{locations.Count} locations, {cells.Count} designs so far");
                    }

                    yield return null;
                }

                if (pieces > 0)
                {
                    Add(new DesignLibrary.Design(location, 1f), RoleFromName(location.m_prefabName), pieces);
                }
            }

            Safe("the location cache", () => WriteCache(biome, known));
            cells.Sort((a, b) =>
            {
                int byRole = System.Array.IndexOf(Order, a.Role).CompareTo(System.Array.IndexOf(Order, b.Role));
                if (byRole != 0) return byRole;
                int bySize = a.Design.Radius.CompareTo(b.Design.Radius);
                return bySize != 0 ? bySize : string.CompareOrdinal(a.Design.Name, b.Design.Name);
            });
        }

        /// <summary>
        /// Null when a player at the biome's stage could build the design: at least 15 building pieces, every piece one
        /// a player can build (no location-only pieces such as goblin walls or totems), every material from that stage
        /// and every crafting station available then. Otherwise why not.
        /// </summary>
        private static string Viable(DesignLibrary.Design design, Heightmap.Biome biome, out int pieces)
        {
            pieces = 0;
            List<DesignSpawner.PlanEntry> plan;
            if (design.Blueprint != null)
            {
                plan = Blueprints.MakePlan(design.Blueprint, Vector3.zero, 0f);
            }
            else
            {
                AssetGuard.Load(design.Location);
                try
                {
                    GameObject asset = design.Location.m_prefab.Asset;
                    plan = asset != null ? DesignSpawner.MakePlan(asset, Vector3.zero, 1, 0f, false) : new List<DesignSpawner.PlanEntry>();
                }
                finally
                {
                    design.Location.m_prefab.Release();
                }
            }

            HashSet<string> materials = StageMaterials[biome];
            HashSet<string> stations = StageStations[biome];
            foreach (DesignSpawner.PlanEntry entry in plan)
            {
                Piece piece = ZNetScene.instance.GetPrefab(entry.Prefab)?.GetComponent<Piece>();
                if (piece == null)
                {
                    continue;
                }

                if (piece.m_resources == null || piece.m_resources.Length == 0)
                {
                    return $"{entry.Prefab} is not a piece a player can build";
                }

                string station = piece.m_craftingStation != null ? piece.m_craftingStation.gameObject.name : null;
                if (station != null && !stations.Contains(station))
                {
                    return $"{entry.Prefab} needs the {station}";
                }

                foreach (Piece.Requirement requirement in piece.m_resources)
                {
                    string material = requirement?.m_resItem != null ? requirement.m_resItem.gameObject.name : null;
                    if (material != null && requirement.m_amount > 0 && !materials.Contains(material))
                    {
                        return $"{entry.Prefab} needs {material}";
                    }
                }

                if (entry.Shell)
                {
                    pieces++;
                }
            }

            return pieces >= 15 ? null : $"only {pieces} building pieces";
        }

        private static IEnumerator Run(Vector3 playerPosition, Vector3 forward, Heightmap.Biome biome, string group, int page, bool rescan, Action action)
        {
            _running = true;
            var cells = new List<Cell>();
            try
            {
                yield return Gather(biome, rescan, cells);
            }
            finally
            {
                _running = false;
            }

            if (action == Action.List)
            {
                string path = "";
                Safe("the list", () => path = WriteList(biome, cells));
                Console.instance?.Print($"Villheim: {cells.Count} {biome} designs written to {path}.");
                yield break;
            }

            Role[] roles = Groups[group];
            List<Cell> chosen = cells.Where(c => roles.Contains(c.Role)).ToList();
            int pages = Mathf.Max(1, (chosen.Count + PageSize - 1) / PageSize);
            chosen = chosen.Skip((page - 1) * PageSize).Take(PageSize).ToList();
            if (chosen.Count == 0)
            {
                Console.instance?.Print($"Villheim: page {page} is empty; '{group}' has {pages} pages.");
                yield break;
            }

            Console.instance?.Print($"Villheim: '{group}' page {page} of {pages}" + (page < pages ? $"; 'vh gallery {biome.ToString().ToLowerInvariant()} {group} page {page + 1}' for the next." : "."));
            yield return Place(chosen, playerPosition, forward);
        }

        /// <summary>'vh gallery show': the named designs, wherever they come from, without the stage test.</summary>
        private static IEnumerator ShowNamed(Vector3 playerPosition, Vector3 forward, string[] names)
        {
            var cells = new List<Cell>();
            foreach (string name in names)
            {
                DesignLibrary.Design? design = DesignLibrary.ByName(name) ?? DesignLibrary.ByName(Blueprints.Prefix + name);
                if (design == null)
                {
                    Console.instance?.Print($"Villheim: no design called '{name}'.");
                    continue;
                }

                Role role = design.Value.Blueprint != null ? design.Value.Blueprint.Role : RoleFromName(name);
                cells.Add(new Cell { Design = design.Value, Role = role, Half = Mathf.Clamp(design.Value.Radius + 2f, 6f, 36f) });
            }

            if (cells.Count > 0)
            {
                yield return Place(cells, playerPosition, forward);
            }
        }

        private static string WriteList(Heightmap.Biome biome, List<Cell> cells)
        {
            string path = System.IO.Path.Combine(BepInEx.Paths.BepInExRootPath, "Villheim", $"gallery-list-{biome}.csv");
            var lines = new List<string> { "Number,Page,Kind,Name,Source,Creator,Pieces,Radius" };
            var pageOf = new Dictionary<Role, int>();
            int number = 0;
            foreach (Cell cell in cells)
            {
                pageOf.TryGetValue(cell.Role, out int inGroup);
                pageOf[cell.Role] = inGroup + 1;
                number++;
                lines.Add(string.Join(",", number, inGroup / PageSize + 1, Kind(cell.Role), Csv(cell.Design.Name), Csv(Source(cell.Design)),
                    Csv(Creator(cell.Design)), cell.Pieces, cell.Design.Radius.ToString("0", System.Globalization.CultureInfo.InvariantCulture)));
            }

            System.IO.Directory.CreateDirectory(System.IO.Path.GetDirectoryName(path));
            System.IO.File.WriteAllLines(path, lines);
            return path;
        }

        private static string Csv(string text) => "\"" + (text ?? "").Replace("\"", "'") + "\"";

        private static string Kind(Role role)
        {
            foreach (KeyValuePair<string, Role[]> group in Groups)
            {
                if (group.Key != "all" && group.Value.Contains(role))
                {
                    return group.Key;
                }
            }

            return "house";
        }

        private static string Source(DesignLibrary.Design design)
        {
            if (design.Blueprint != null)
            {
                return "blueprint " + System.IO.Path.GetFileName(design.Blueprint.File);
            }

            return design.Name.StartsWith("MWL_") ? "location (More World Locations)" : "location";
        }

        private static string Creator(DesignLibrary.Design design)
        {
            if (design.Blueprint != null)
            {
                return string.IsNullOrEmpty(design.Blueprint.Creator) ? "unknown" : design.Blueprint.Creator;
            }

            return design.Name.StartsWith("MWL_") ? "warpalicious" : "Iron Gate (vanilla) or a mod";
        }

        /// <summary>
        /// Lays the cells out in front of the player and puts them up on the ground as it is there: no clearing, no
        /// levelling (that is 'vh flatten', touched up by hand). Each design goes on the middle height of the ground
        /// under it, measured when its zone is loaded.
        /// </summary>
        private static IEnumerator Place(List<Cell> cells, Vector3 playerPosition, Vector3 forward)
        {
            var labels = new List<(Vector3 At, string Text)>();
            float depth = 0f, widest = 0f;
            Safe("the layout", () => Layout(cells, forward, labels, out depth, out widest));
            // On the area last flattened, when it is near; else in front of the player.
            Vector3 start = playerPosition + forward * 8f;
            if (LoadFlat(out Vector3 flatStart, out Vector3 flatForward) && Utils.DistanceXZ(flatStart, playerPosition) < 600f)
            {
                start = flatStart + flatForward * 4f;
                if (Vector3.Angle(flatForward, forward) > 1f)
                {
                    labels.Clear();
                    cells.ForEach(c => c.Center = Vector3.zero);
                    forward = flatForward;
                    Safe("the layout", () => Layout(cells, forward, labels, out depth, out widest));
                }
            }

            foreach (Cell cell in cells)
            {
                cell.Center = new Vector3(start.x + cell.Center.x, float.NaN, start.z + cell.Center.z);
            }

            for (int i = 0; i < labels.Count; i++)
            {
                labels[i] = (new Vector3(start.x + labels[i].At.x, float.NaN, start.z + labels[i].At.z), labels[i].Text);
            }

            VillheimPlugin.Instance.StartCoroutine(Build(cells, new List<Pad>(), forward, labels));
            Console.instance?.Print($"Villheim: laying out {cells.Count} designs in front of you ({widest:0} by {depth:0} m). " +
                                    "Run 'vh flatten' there first to clear and level the ground.");
            yield break;
        }

        private const float FlatWidth = 360f;
        private const float FlatDepth = 260f;

        private static string FlatPath => System.IO.Path.Combine(BepInEx.Paths.BepInExRootPath, "Villheim", "gallery-flat-area.txt");

        /// <summary>Where 'vh flatten' last started (near edge, middle) and which way it ran, kept on disk.</summary>
        private static void SaveFlat(Vector3 start, Vector3 forward)
        {
            Safe("the flat area", () =>
            {
                System.IO.Directory.CreateDirectory(System.IO.Path.GetDirectoryName(FlatPath));
                var c = System.Globalization.CultureInfo.InvariantCulture;
                System.IO.File.WriteAllText(FlatPath, string.Join(" ", new[] { start.x, start.y, start.z, forward.x, forward.z }.Select(v => v.ToString("R", c))));
            });
        }

        private static bool LoadFlat(out Vector3 start, out Vector3 forward)
        {
            start = forward = Vector3.zero;
            try
            {
                if (!System.IO.File.Exists(FlatPath))
                {
                    return false;
                }

                var c = System.Globalization.CultureInfo.InvariantCulture;
                float[] v = System.IO.File.ReadAllText(FlatPath).Split(' ').Select(t => float.Parse(t, c)).ToArray();
                start = new Vector3(v[0], v[1], v[2]);
                forward = new Vector3(v[3], 0f, v[4]).normalized;
                return forward.sqrMagnitude > 0.5f;
            }
            catch
            {
                return false;
            }
        }

        /// <summary>The middle height of the loaded ground across a square.</summary>
        private static float MeasuredGround(Vector3 center, float half)
        {
            var heights = new List<float>();
            for (float x = -half; x <= half; x += half / 2f)
            {
                for (float z = -half; z <= half; z += half / 2f)
                {
                    if (ZoneSystem.instance.GetGroundHeight(new Vector3(center.x + x, 0f, center.z + z), out float h))
                    {
                        heights.Add(h);
                    }
                }
            }

            heights.Sort();
            return heights.Count > 0 ? heights[heights.Count / 2] : center.y;
        }

        /// <summary>
        /// 'vh flatten [size]': clears and levels a square in front of the player (200 m by default) at the height of
        /// the ground under his feet, as far as the game's 8 m allows, and takes the grass off. Parts in zones that
        /// aren't loaded are done as he walks to them. Touch it up with a terrain tool, then 'vh gallery'.
        /// </summary>
        public static string Flatten(Player player, string[] args)
        {
            // Big enough for any gallery page (ten designs, six to a row) unless a size is given.
            float width = args.Length > 0 && float.TryParse(args[0], out float given) ? Mathf.Clamp(given, 30f, 600f) : FlatWidth;
            float length = args.Length > 0 ? width : FlatDepth;
            Vector3 forward = player.transform.forward;
            forward.y = 0f;
            forward.Normalize();
            Vector3 right = Vector3.Cross(Vector3.up, forward);
            float height = player.transform.position.y;
            if (ZoneSystem.instance.GetGroundHeight(player.transform.position, out float ground))
            {
                height = ground;
            }

            Vector3 start = player.transform.position + forward * 4f;
            SaveFlat(new Vector3(start.x, height, start.z), forward);
            var pads = new List<Pad>();
            for (float z = 0f; z <= length; z += PadSpacing)
            {
                for (float x = -width / 2f; x <= width / 2f; x += PadSpacing)
                {
                    Vector3 p = start + forward * z + right * x;
                    pads.Add(new Pad { Center = new Vector3(p.x, height, p.z) });
                }
            }

            VillheimPlugin.Instance.StartCoroutine(Build(new List<Cell>(), pads, forward, new List<(Vector3 At, string Text)>()));
            return $"Villheim: clearing and levelling {width:0} m wide by {length:0} m deep in front of you at {height:0.0} m ({pads.Count} pads). " +
                   "Walk along it so the far parts load; the top-left counts the pads done. 'vh gallery' lays out on this area from anywhere near it.";
        }

        /// <summary>The middle height of the generated ground across a square.</summary>
        private static float GroundOf(Vector3 center, float half)
        {
            var heights = new List<float>();
            for (float x = -half; x <= half; x += 4f)
            {
                for (float z = -half; z <= half; z += 4f)
                {
                    heights.Add(WorldGenerator.instance.GetHeight(center.x + x, center.z + z));
                }
            }

            heights.Sort();
            return heights[heights.Count / 2];
        }

        private sealed class SiteResult
        {
            public bool Found;
            public Vector3 Start;
            public float Height;
            public float Relief = float.MaxValue;
        }

        /// <summary>
        /// The nearest spot (outward from the player, 80 m steps, up to 3 km) where the whole area, with the gallery's own
        /// turn, is land of the biome and its ground varies by no more than 12 m. Read from the world generator, so no
        /// zone has to be loaded. A few spots a frame.
        /// </summary>
        private static IEnumerator FindSite(Vector3 from, Vector3 forward, Vector3 right, float width, float depth, Heightmap.Biome biome, SiteResult result)
        {
            WorldGenerator world = WorldGenerator.instance;
            float water = ZoneSystem.instance.m_waterLevel;
            int tried = 0;
            var heights = new List<float>();
            for (float ring = 0f; ring <= 2000f; ring += 80f)
            {
                int steps = ring < 1f ? 1 : Mathf.CeilToInt(2f * Mathf.PI * ring / 80f);
                for (int k = 0; k < steps; k++)
                {
                    float angle = k * Mathf.PI * 2f / steps;
                    Vector3 start = from + forward * (6f + Margin) + new Vector3(Mathf.Sin(angle), 0f, Mathf.Cos(angle)) * ring;
                    heights.Clear();
                    float low = float.MaxValue, high = float.MinValue;
                    bool ok = true;
                    for (float z = -Margin; z <= depth - Margin && ok; z += 16f)
                    {
                        for (float x = -width / 2f; x <= width / 2f; x += 16f)
                        {
                            Vector3 p = start + forward * z + right * x;
                            float h = world.GetHeight(p.x, p.z);
                            if (h < water + 1.5f || (world.GetBiome(p.x, p.z) & GalleryLand) == 0)
                            {
                                ok = false;
                                break;
                            }

                            low = Mathf.Min(low, h);
                            high = Mathf.Max(high, h);
                            heights.Add(h);
                            if (high - low >= result.Relief)
                            {
                                ok = false; // no flatter than the best so far
                                break;
                            }
                        }
                    }

                    if (ok && heights.Count > 0)
                    {
                        // The flattest so far; good enough to stop looking once it fits within the game's terrain limit.
                        heights.Sort();
                        result.Found = true;
                        result.Start = start;
                        result.Relief = high - low;
                        result.Height = heights[heights.Count / 2];
                        if (result.Relief <= MaxRelief)
                        {
                            yield break;
                        }
                    }

                    if (++tried % 25 == 0)
                    {
                        MessageHud.instance?.ShowMessage(MessageHud.MessageType.TopLeft,
                            $"Gallery: looking for flat land, {ring:0} m out (flattest so far: {(result.Found ? result.Relief.ToString("0") + " m" : "none")})");
                        yield return null;
                    }
                }
            }
        }

        private static string CachePath(Heightmap.Biome biome) =>
            System.IO.Path.Combine(BepInEx.Paths.BepInExRootPath, "Villheim", $"gallery-locations-{biome}-v2.txt");

        /// <summary>Location name and its building pieces when a player at that stage could build it (0 when not).</summary>
        private static Dictionary<string, int> ReadCache(Heightmap.Biome biome)
        {
            var known = new Dictionary<string, int>();
            try
            {
                if (System.IO.File.Exists(CachePath(biome)))
                {
                    foreach (string line in System.IO.File.ReadAllLines(CachePath(biome)))
                    {
                        int bar = line.LastIndexOf('|');
                        if (bar > 0 && !line.StartsWith("#") && int.TryParse(line.Substring(bar + 1), out int pieces))
                        {
                            known[line.Substring(0, bar)] = pieces;
                        }
                    }
                }
            }
            catch (System.Exception e)
            {
                VillheimPlugin.Log.LogWarning($"Gallery: could not read the location cache: {e.Message}");
            }

            return known;
        }

        private static void WriteCache(Heightmap.Biome biome, Dictionary<string, int> known)
        {
            System.IO.Directory.CreateDirectory(System.IO.Path.GetDirectoryName(CachePath(biome)));
            System.IO.File.WriteAllLines(CachePath(biome),
                new[] { $"# Locations looked at by vh gallery for {biome}: name|building pieces when a player at that stage could build it, else 0. 'rescan' looks again." }
                    .Concat(known.OrderBy(k => k.Key).Select(k => $"{k.Key}|{k.Value}")));
        }

        private static void Safe(string what, System.Action action)
        {
            try
            {
                action();
            }
            catch (System.Exception e)
            {
                VillheimPlugin.Log.LogWarning($"Gallery: skipped {what}: {e.GetType().Name}: {e.Message}");
            }
        }

        /// <summary>Locations that are never village buildings: dungeons, altars, traders, ships and the like.</summary>
        private static bool Unsuitable(string name)
        {
            string n = name.ToLowerInvariant();
            string[] words =
            {
                "dungeon", "crypt", "cave", "portal", "boss", "altar", "runestone", "vendor", "haldor", "hildir", "bogwitch",
                "starttemple", "eikthyr", "gdking", "bonemass", "dragonqueen", "goblinking", "seeker", "fader", "ship",
                "wreck", "grave", "tomb", "infested", "mine", "tarpit", "leviathan", "vegvisir", "spawner",
            };
            return words.Any(w => n.Contains(w));
        }

        /// <summary>A location with at least 15 building pieces that Villheim would copy.</summary>
        private static bool IsBuilding(ZoneSystem.ZoneLocation location)
        {
            Designs.AssetGuard.Load(location);
            try
            {
                GameObject asset = location.m_prefab.Asset;
                return asset != null && DesignSpawner.MakePlan(asset, Vector3.zero, 1, 0f, false).Count(e => e.Shell) >= 15;
            }
            catch
            {
                return false;
            }
            finally
            {
                location.m_prefab.Release();
            }
        }

        private static bool Matches(string blueprintBiome, Heightmap.Biome biome)
        {
            string b = blueprintBiome.ToLowerInvariant();
            return biome == Heightmap.Biome.BlackForest ? b.Contains("black") || b.Contains("forest") : b.Contains("meadow");
        }

        /// <summary>A kind from the name: hall, workshop, storehouse or farm words, else a home.</summary>
        private static Role RoleFromName(string name)
        {
            string n = name.ToLowerInvariant();
            if (n.Contains("tavern") || n.Contains("hall") || n.Contains("longhouse") || n.Contains("great")) return Role.Hub;
            if (n.Contains("forge") || n.Contains("smith") || n.Contains("sawmill") || n.Contains("mill") || n.Contains("workshop") ||
                n.Contains("tannery") || n.Contains("camp") || n.Contains("tower") || n.Contains("lumber")) return Role.Workshop;
            if (n.Contains("storage") || n.Contains("shed") || n.Contains("store") || n.Contains("warehouse")) return Role.Storage;
            if (n.Contains("farm") || n.Contains("barn") || n.Contains("stable") || n.Contains("field") || n.Contains("breeder")) return Role.Farm;
            return Role.House;
        }

        /// <summary>
        /// Lays the designs out in clusters, one per level and kind (all level 1 homes together, then level 1 halls and so
        /// on), each cluster starting a new row behind a label sign. Positions are relative to the area's near middle;
        /// the caller moves them onto the site.
        /// </summary>
        private static void Layout(List<Cell> cells, Vector3 forward, List<(Vector3 At, string Text)> labels, out float depth, out float widest)
        {

            Vector3 right = Vector3.Cross(Vector3.up, forward);
            depth = 0f;
            widest = 0f;
            foreach (IGrouping<Role, Cell> cluster in cells.GroupBy(c => c.Role))
            {
                List<Cell> members = cluster.ToList();
                labels.Add((forward * (depth + 2f), $"<#5cf>{Plural(members[0].Role)}"));
                depth += 6f;
                for (int row = 0; row * 6 < members.Count; row++)
                {
                    List<Cell> line = members.Skip(row * 6).Take(6).ToList();
                    float rowDepth = line.Max(c => c.Half);
                    float width = line.Sum(c => c.Half * 2f);
                    widest = Mathf.Max(widest, width);
                    float x = -width / 2f;
                    foreach (Cell cell in line)
                    {
                        cell.Center = forward * (depth + rowDepth) + right * (x + cell.Half);
                        x += cell.Half * 2f;
                    }

                    depth += rowDepth * 2f;
                }

                depth += 8f;
            }
        }

        private static string Plural(Role role)
        {
            switch (role)
            {
                case Role.House: return "Homes";
                case Role.Hub: return "Halls";
                case Role.Workshop: return "Workshops";
                case Role.Storage: return "Storehouses";
                default: return "Farms";
            }
        }

        private static IEnumerator Build(List<Cell> cells, List<Pad> pads, Vector3 forward, List<(Vector3 At, string Text)> labels)
        {
            float until = Time.time + 40f * 60f;
            int built = 0;
            while ((built < cells.Count || pads.Any(p => !p.Done) || labels.Count > 0) && Time.time < until)
            {
                // Ground first: every pad whose zone is loaded is cleared, levelled and bared.
                bool shaped = false;
                foreach (Pad pad in pads.Where(p => !p.Done))
                {
                    if (!Loaded(pad.Center, PadRadius + 6f))
                    {
                        continue;
                    }

                    pad.Done = true;
                    shaped = true;
                    Pad current = pad;
                    Safe("clearing ground", () => ClearAll(current.Center, PadRadius + 2f));
                    Safe("levelling ground", () => TerrainShaper.LevelPad(current.Center, PadRadius, PadRadius + 8f));
                    Safe("clearing grass", () => HearthGround.ClearVegetation(current.Center, PadRadius + 2f));
                    yield return null;
                }

                if (shaped)
                {
                    yield return new WaitForSeconds(1f); // let the ground's collider catch up
                }

                // Cluster labels, each once its spot is loaded and its ground done.
                foreach ((Vector3 at, string text) in labels.ToList())
                {
                    if (!Loaded(at, 4f) || pads.Any(p => !p.Done && Utils.DistanceXZ(p.Center, at) < PadRadius + 6f))
                    {
                        continue;
                    }

                    labels.Remove((at, text));
                    Vector3 spot = at;
                    if (float.IsNaN(spot.y))
                    {
                        spot.y = ZoneSystem.instance.GetGroundHeight(new Vector3(spot.x, 0f, spot.z), out float h) ? h : 0f;
                    }

                    Safe("a label", () => PutSign(spot, forward, text));
                }

                // Then each plot whose ground is all done.
                foreach (Cell cell in cells.Where(c => !c.Done))
                {
                    float reach = cell.Half * 1.42f + PadRadius;
                    if (pads.Any(p => !p.Done && Utils.DistanceXZ(p.Center, cell.Center) < reach))
                    {
                        continue;
                    }

                    if (float.IsNaN(cell.Center.y))
                    {
                        if (!Loaded(cell.Center, cell.Half * 1.42f))
                        {
                            continue;
                        }

                        cell.Center.y = MeasuredGround(cell.Center, cell.Half);
                    }

                    cell.Done = true;
                    int pieces = 0;
                    Cell building = cell;
                    if (cell.Terrace)
                    {
                        Safe("a terrace", () =>
                        {
                            HearthGround.ClearAround(building.Center, building.Half * 1.42f + 2f);
                            TerrainShaper.LevelPad(building.Center, building.Half * 1.42f, building.Half * 1.42f + 6f);
                            HearthGround.ClearVegetation(building.Center, building.Half * 1.42f + 2f);
                        });
                        yield return new WaitForSeconds(1f);
                    }

                    Safe(cell.Design.Name, () => pieces = Put(building, forward));
                    Safe("a sign", () => Sign(building, forward));
                    built++;
                    VillheimPlugin.Log.LogInfo($"Gallery: {cell.Design.Name} ({Label(cell)}, level {Level(cell)}): {pieces} pieces.");
                    yield return null;
                }

                MessageHud.instance?.ShowMessage(MessageHud.MessageType.TopLeft,
                    $"Gallery: ground {pads.Count(p => p.Done)}/{pads.Count}, designs {built}/{cells.Count}");
                yield return new WaitForSeconds(2f);
            }

            VillheimPlugin.Log.LogInfo($"Gallery: {built} of {cells.Count} designs built.");
        }

        /// <summary>
        /// Takes away everything standing in the circle, at any height: trees, logs, stumps, rocks, bushes, ruins and
        /// loose objects. Creatures, graves, village hearths, location markers and the gallery's own pieces stay.
        /// </summary>
        private static void ClearAll(Vector3 center, float radius)
        {
            var doomed = new List<ZNetView>();
            foreach (ZNetView view in ZNetScene.instance.m_instances.Values)
            {
                if (view == null || !view.IsValid() || Utils.DistanceXZ(view.transform.position, center) > radius)
                {
                    continue;
                }

                GameObject go = view.gameObject;
                if (go.GetComponent<Character>() || go.GetComponent<TombStone>() || go.GetComponent<VillageHearth>() ||
                    go.GetComponent<LocationProxy>() || view.GetZDO().GetInt(KeyGallery) == 1 ||
                    (go.GetComponent<Piece>() is Piece piece && piece.GetCreator() != 0L))
                {
                    continue;
                }

                doomed.Add(view);
            }

            foreach (ZNetView view in doomed)
            {
                view.ClaimOwnership();
                ZNetScene.instance.Destroy(view.gameObject);
            }
        }

        private static bool Loaded(Vector3 center, float reach)
        {
            for (int i = 0; i < 4; i++)
            {
                Vector3 corner = center + Quaternion.Euler(0f, 45f + 90f * i, 0f) * Vector3.forward * reach;
                if (!ZoneSystem.instance.IsZoneLoaded(corner))
                {
                    return false;
                }
            }

            return true;
        }

        /// <summary>The design's pieces, its foundation on the ground (see ConstructionSite.FloorOf), facing the sign.</summary>
        private static int Put(Cell cell, Vector3 forward)
        {
            float yaw = Quaternion.LookRotation(-forward).eulerAngles.y;
            List<DesignSpawner.PlanEntry> plan;
            if (cell.Design.Blueprint != null)
            {
                plan = Blueprints.MakePlan(cell.Design.Blueprint, cell.Center, yaw);
                return Spawn(plan, cell, yaw);
            }

            ZoneSystem.ZoneLocation location = cell.Design.Location;
            Designs.AssetGuard.Load(location);
            try
            {
                GameObject asset = location.m_prefab.Asset;
                if (asset == null)
                {
                    return 0;
                }

                plan = DesignSpawner.MakePlan(asset, cell.Center, cell.Design.Name.GetStableHashCode(), yaw);
                return Spawn(plan, cell, yaw);
            }
            finally
            {
                location.m_prefab.Release();
            }
        }

        private static int Spawn(List<DesignSpawner.PlanEntry> plan, Cell cell, float yaw)
        {
            float planned = ConstructionSite.FloorOf(plan);
            Vector3 origin = cell.Center - Vector3.up * planned;
            Quaternion turn = Quaternion.Euler(0f, yaw, 0f);
            var made = new List<GameObject>();
            foreach (DesignSpawner.PlanEntry entry in plan)
            {
                GameObject piece = DesignSpawner.SpawnEntry(entry, origin, turn, 0, false);
                if (piece != null)
                {
                    piece.GetComponent<ZNetView>()?.GetZDO()?.Set(KeyGallery, 1);
                    made.Add(piece);
                }
            }

            // Measured, not trusted: the foundation as the pieces actually stand (their colliders), and the whole design
            // moved up or down so that foundation sits on the ground. Logged, to see where the plan's own measure is off.
            Physics.SyncTransforms();
            var bottoms = new List<float>();
            foreach (GameObject piece in made)
            {
                if (piece.GetComponent<Piece>() == null || !piece.GetComponent<WearNTear>())
                {
                    continue;
                }

                float bottom = float.MaxValue;
                foreach (Collider collider in piece.GetComponentsInChildren<Collider>())
                {
                    if (collider != null && !collider.isTrigger && collider.enabled)
                    {
                        bottom = Mathf.Min(bottom, collider.bounds.min.y);
                    }
                }

                if (bottom < float.MaxValue)
                {
                    bottoms.Add(bottom);
                }
            }

            if (bottoms.Count > 0)
            {
                float actual = ConstructionSite.FoundationHeight(bottoms);
                float shift = cell.Center.y - actual;
                VillheimPlugin.Log.LogInfo($"Gallery: {cell.Design.Name}: planned floor {planned:+0.00;-0.00}, measured foundation " +
                                           $"{actual - origin.y:+0.00;-0.00} above the origin, lowest piece {bottoms.Min() - origin.y:+0.00;-0.00}; moved {shift:+0.00;-0.00} m.");
                if (Mathf.Abs(shift) > 0.05f)
                {
                    foreach (GameObject piece in made)
                    {
                        piece.transform.position += Vector3.up * shift;
                        piece.GetComponent<ZNetView>()?.GetZDO()?.SetPosition(piece.transform.position);
                    }
                }
            }

            return made.Count;
        }

        /// <summary>A sign at the front of the plot: the kind and level in blue, the design's name in white.</summary>
        private static void Sign(Cell cell, Vector3 forward)
        {
            PutSign(cell.Center - forward * (cell.Half - 1f), forward, $"<#5cf>{Label(cell)}<br><#fff>{cell.Design.Name}<br><#bbb>by {Creator(cell.Design)}");
        }

        /// <summary>A sign standing on the ground (two back to back, so it reads from either side).</summary>
        private static void PutSign(Vector3 at, Vector3 forward, string text)
        {
            GameObject prefab = ZNetScene.instance.GetPrefab("sign");
            if (prefab == null)
            {
                return;
            }

            foreach (float turn in new[] { 0f, 180f })
            {
                Quaternion rotation = Quaternion.LookRotation(-forward) * Quaternion.Euler(0f, turn, 0f);
                GameObject sign = Object.Instantiate(prefab, at + rotation * Vector3.forward * 0.03f, rotation);
                StandOnGround(sign, at.y);
                ZNetView view = sign.GetComponent<ZNetView>();
                if (view != null && view.IsValid())
                {
                    view.GetZDO().Set(KeyGallery, 1);
                    view.GetZDO().Set(ZDOVars.s_text, text);
                    sign.GetComponent<Sign>()?.UpdateText();
                }
            }
        }

        private static void StandOnGround(GameObject go, float ground)
        {
            Bounds? bounds = null;
            foreach (Renderer renderer in go.GetComponentsInChildren<Renderer>())
            {
                if (bounds.HasValue)
                {
                    Bounds b = bounds.Value;
                    b.Encapsulate(renderer.bounds);
                    bounds = b;
                }
                else
                {
                    bounds = renderer.bounds;
                }
            }

            if (bounds.HasValue)
            {
                go.transform.position += Vector3.up * (ground - bounds.Value.min.y);
                go.GetComponent<ZNetView>()?.GetZDO()?.SetPosition(go.transform.position);
            }
        }

        /// <summary>The village level a design is meant for: homes from the start, the longhouse, workshop and storehouse next, farms after.</summary>
        private static int Level(Cell cell)
        {
            if (cell.Design.Blueprint != null)
            {
                return cell.Design.Blueprint.Level;
            }

            switch (cell.Role)
            {
                case Role.House: return cell.Design.Radius >= 16f ? 3 : cell.Design.Radius >= 11f ? 2 : 1;
                case Role.Farm: return 3;
                default: return 2;
            }
        }

        /// <summary>What kind of building it reads as, from its name, else its role.</summary>
        private static string Label(Cell cell)
        {
            string name = cell.Design.Name.ToLowerInvariant();
            if (name.Contains("sawmill")) return "Sawmill";
            if (name.Contains("forge") || name.Contains("smith")) return "Smithy";
            if (name.Contains("tavern") || name.Contains("hall")) return "Longhouse";
            if (name.Contains("barn")) return "Barn";
            if (name.Contains("farm")) return "Farm";
            if (name.Contains("camp")) return "Camp";
            if (name.Contains("tower")) return "Tower";
            if (name.Contains("maypole")) return "Maypole hut";
            string role = VillageBrain.RoleName(cell.Role);
            return char.ToUpperInvariant(role[0]) + role.Substring(1);
        }
    }
}
