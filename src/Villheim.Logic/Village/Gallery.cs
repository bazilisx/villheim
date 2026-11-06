using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Designs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// 'vh gallery [meadows|blackforest]': lays out every design a village of that biome could build, side by side on
    /// one flat, cleared plain, to review them in a fresh world. Each stands flush on its pad as a village would build
    /// it (the same pieces, its foundation on the ground), with a sign in front: the kind of building and the
    /// village level it is meant for on top in bright blue, the design's name below in white.
    ///
    /// First it looks, outward from the player up to 2 km, for calm land (any biome but the Mistlands, Ashlands, Deep
    /// North or sea) big enough for the whole layout whose
    /// ground varies by no more than 12 m (read from the world generator; failing that, the flattest found), and moves
    /// the player there. A design whose own ground is more than 6 m off the plain gets a flat terrace of its own: the game lets
    /// terrain move only 8 m either way, so the plain has to start out nearly flat (an earlier try lifted that limit and
    /// broke the ground's look and collisions). There the whole area, with a 12 m margin, is made one flat, bare plain:
    /// everything standing on it is removed at any height (not creatures or anything a player built), the ground is
    /// levelled at the area's middle height and the grass taken off, in overlapping pads 24 m apart. A design goes up
    /// once all the ground round it is done. Gallery pieces never wear or fall (see NoWearPatch).
    /// </summary>
    internal static class Gallery
    {
        private sealed class Cell
        {
            public bool Terrace;
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

        public const string Usage =
            "vh gallery <meadows|blackforest> [all|house|hall|prof|storage|farm] [level] [rescan]: e.g. 'vh gallery meadows house 1'; 'vh gallery clear' removes a gallery";

        private static bool _running;

        /// <summary>'vh gallery &lt;biome&gt; [group] [level]'. Gathers the designs over a few seconds, then lays them out.</summary>
        public static string Start(Player player, string[] args)
        {
            if (_running)
            {
                return "Villheim: a gallery is already being gathered; give it a moment.";
            }

            if (args.Length > 0 && args[0].ToLowerInvariant() == "clear")
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

            string biomeName = args.Length > 0 ? args[0].ToLowerInvariant() : "meadows";
            Heightmap.Biome biome = biomeName.StartsWith("black") || biomeName.StartsWith("forest") ? Heightmap.Biome.BlackForest : Heightmap.Biome.Meadows;
            string group = "all";
            int level = 0;
            bool rescan = false;
            foreach (string arg in args.Skip(1))
            {
                string a = arg.ToLowerInvariant();
                if (a == "rescan")
                {
                    rescan = true;
                }
                else if (int.TryParse(a, out int n))
                {
                    level = n;
                }
                else if (a.StartsWith("prof") || a.StartsWith("work") || a.StartsWith("smith"))
                {
                    group = "prof";
                }
                else if (a.StartsWith("hall") || a.StartsWith("hub") || a.StartsWith("long"))
                {
                    group = "hall";
                }
                else if (a.StartsWith("hous") || a.StartsWith("home"))
                {
                    group = "house";
                }
                else if (a.StartsWith("stor") || a.StartsWith("shed"))
                {
                    group = "storage";
                }
                else if (a.StartsWith("farm") || a.StartsWith("barn"))
                {
                    group = "farm";
                }
                else if (a != "all")
                {
                    return "Villheim: " + Usage;
                }
            }

            Vector3 forward = player.transform.forward;
            forward.y = 0f;
            forward.Normalize();
            VillheimPlugin.Instance.StartCoroutine(Run(player.transform.position, forward, biome, group, level, rescan));
            return $"Villheim: gathering every {biome} design ({group}{(level > 0 ? ", level " + level : "")}): the curated lists, " +
                   "all blueprints (yours, PlanBuild's, OverDrive's) and every location in the game that is a buildable building.";
        }

        private static IEnumerator Run(Vector3 playerPosition, Vector3 forward, Heightmap.Biome biome, string group, int level, bool rescan)
        {
            _running = true;
            var cells = new List<Cell>();
            var seen = new HashSet<string>();
            void Add(DesignLibrary.Design design, Role role)
            {
                if (seen.Add(design.Name))
                {
                    cells.Add(new Cell { Design = design, Role = role, Half = Mathf.Clamp(design.Radius + 2f, 6f, 36f) });
                }
            }

            // 1 and 2: the curated lists and every blueprint. Each step catches its own errors, so one bad design
            // can't stop the gallery (a silent stop left it gathering forever, 2026-11-06).
            Safe("the curated lists", () =>
            {
                foreach (Role role in Order)
                {
                    foreach (DesignLibrary.Design design in DesignLibrary.PoolFor(biome, role).Concat(DesignLibrary.FallbackPool(biome, role)))
                    {
                        Add(design, role);
                    }
                }
            });

            Safe("the blueprints", () =>
            {
                foreach (Blueprints.Blueprint blueprint in Blueprints.All().Values)
                {
                    var design = new DesignLibrary.Design(blueprint, 1f);
                    if ((blueprint.Biome == null || Matches(blueprint.Biome, biome)) && DesignLibrary.MissingIn(design, biome) == null)
                    {
                        Add(design, blueprint.Role);
                    }
                }
            });

            // 3: every location in the game that is a building the biome can be built of, one per frame.
            var locations = new List<ZoneSystem.ZoneLocation>();
            Safe("the location list", () => locations.AddRange(ZoneSystem.instance.m_locations
                .Where(l => l != null && l.m_prefab.IsValid && l.m_exteriorRadius <= 40f && !Unsuitable(l.m_prefabName))
                .GroupBy(l => l.m_prefabName).Select(g => g.First())));
            // What each location turned out to be is kept on disk, so only new locations are opened again.
            Dictionary<string, bool> known = rescan ? new Dictionary<string, bool>() : ReadCache(biome);
            int checkedCount = 0, opened = 0;
            foreach (ZoneSystem.ZoneLocation location in locations)
            {
                checkedCount++;
                if (seen.Contains(location.m_prefabName))
                {
                    continue;
                }

                if (!known.TryGetValue(location.m_prefabName, out bool add))
                {
                    Safe(location.m_prefabName, () => add = DesignLibrary.BuildableIn(location, biome) && IsBuilding(location));
                    known[location.m_prefabName] = add;
                    opened++;
                    if (opened % 10 == 0)
                    {
                        MessageHud.instance?.ShowMessage(MessageHud.MessageType.TopLeft,
                            $"Gallery: looked at {checkedCount}/{locations.Count} locations, {cells.Count} designs so far");
                    }

                    yield return null;
                }

                if (add)
                {
                    Add(new DesignLibrary.Design(location, 1f), RoleFromName(location.m_prefabName));
                }
            }

            Safe("the location cache", () => WriteCache(biome, known));

            _running = false;
            Role[] roles = Groups[group];
            int all = cells.Count;
            cells = cells.Where(c => roles.Contains(c.Role) && (level == 0 || Level(c) == level)).ToList();
            VillheimPlugin.Log.LogInfo($"Gallery: {all} {biome} designs found, {cells.Count} in '{group}'{(level > 0 ? " level " + level : "")}.");
            if (cells.Count == 0)
            {
                Console.instance?.Print($"Villheim: none of the {all} {biome} designs found are in that group and level.");
                MessageHud.instance?.ShowMessage(MessageHud.MessageType.Center, "Gallery: nothing in that group and level");
                yield break;
            }

            // Lay the designs out, then look for naturally flat land of the biome big enough for them, near the player,
            // and go there: the game lets terrain move only 8 m either way, so the plain has to start out nearly flat.
            var labels = new List<(Vector3 At, string Text)>();
            float depth = 0f, widest = 0f;
            Safe("the layout", () => Layout(cells, forward, labels, out depth, out widest));
            Vector3 right = Vector3.Cross(Vector3.up, forward);
            var site = new SiteResult();
            yield return FindSite(playerPosition, forward, right, widest + Margin * 2f, depth + Margin * 2f, biome, site);
            if (!site.Found)
            {
                Console.instance?.Print("Villheim: found no land big enough within 2 km (Meadows, Black Forest, Plains, Swamp or " +
                                        "Mountain, all above water). Try again from elsewhere, or show fewer designs (a group and a level).");
                yield break;
            }

            // The area's corner nearest the player is at site.Start; everything moves there.
            Vector3 start = site.Start;
            // Each design on the plain, unless its own ground is too far above or below it for the game's 8 m: then it
            // gets a flat terrace of its own at the middle height of its ground.
            int terraces = 0;
            foreach (Cell cell in cells)
            {
                var center = new Vector3(start.x + cell.Center.x, 0f, start.z + cell.Center.z);
                float own = GroundOf(center, cell.Half);
                bool onPlain = Mathf.Abs(own - site.Height) <= 6f;
                cell.Center = new Vector3(center.x, onPlain ? site.Height : own, center.z);
                cell.Terrace = !onPlain;
                terraces += onPlain ? 0 : 1;
            }

            for (int i = 0; i < labels.Count; i++)
            {
                labels[i] = (new Vector3(start.x + labels[i].At.x, site.Height, start.z + labels[i].At.z), labels[i].Text);
            }

            var pads = new List<Pad>();
            for (float z = -Margin; z <= depth + Margin; z += PadSpacing)
            {
                for (float x = -widest / 2f - Margin; x <= widest / 2f + Margin; x += PadSpacing)
                {
                    Vector3 p = start + forward * z + right * x;
                    pads.Add(new Pad { Center = new Vector3(p.x, site.Height, p.z) });
                }
            }

            Player player = Player.m_localPlayer;
            if (player != null && Utils.DistanceXZ(player.transform.position, start) > 30f)
            {
                Vector3 stand = start - forward * (Margin + 4f);
                stand.y = WorldGenerator.instance.GetHeight(stand.x, stand.z) + 1f;
                player.TeleportTo(stand, Quaternion.LookRotation(forward), true);
            }

            VillheimPlugin.Instance.StartCoroutine(Build(cells, pads, forward, labels));
            Console.instance?.Print($"Villheim: found flat land ({WorldGenerator.instance.GetBiome(start)}) {Utils.DistanceXZ(playerPosition, start):0} m away " +
                                    $"({site.Relief:0.0} m between highest and lowest ground); clearing {widest + Margin * 2f:0} by " +
                                    $"{depth + Margin * 2f:0} m there at {site.Height:0.0} m and laying out {cells.Count} designs in {labels.Count} clusters" +
                                    (terraces > 0 ? $" ({terraces} on terraces of their own, where the ground is too high or low for the plain)." : "."));
            MessageHud.instance?.ShowMessage(MessageHud.MessageType.Center, $"Gallery: {cells.Count} designs; clearing the ground");
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
            System.IO.Path.Combine(BepInEx.Paths.BepInExRootPath, "Villheim", $"gallery-locations-{biome}.txt");

        /// <summary>Location name and whether it is a buildable building in the biome, from the last runs.</summary>
        private static Dictionary<string, bool> ReadCache(Heightmap.Biome biome)
        {
            var known = new Dictionary<string, bool>();
            try
            {
                if (System.IO.File.Exists(CachePath(biome)))
                {
                    foreach (string line in System.IO.File.ReadAllLines(CachePath(biome)))
                    {
                        int bar = line.LastIndexOf('|');
                        if (bar > 0 && !line.StartsWith("#"))
                        {
                            known[line.Substring(0, bar)] = line.Substring(bar + 1) == "1";
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

        private static void WriteCache(Heightmap.Biome biome, Dictionary<string, bool> known)
        {
            System.IO.Directory.CreateDirectory(System.IO.Path.GetDirectoryName(CachePath(biome)));
            System.IO.File.WriteAllLines(CachePath(biome),
                new[] { $"# Locations looked at by vh gallery for {biome}: name|1 when it is a building the biome can build. 'vh gallery {biome.ToString().ToLowerInvariant()} rescan' looks again." }
                    .Concat(known.OrderBy(k => k.Key).Select(k => $"{k.Key}|{(k.Value ? 1 : 0)}")));
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
            cells.Sort((a, b) =>
            {
                int byLevel = Level(a).CompareTo(Level(b));
                if (byLevel != 0) return byLevel;
                int byRole = System.Array.IndexOf(Order, a.Role).CompareTo(System.Array.IndexOf(Order, b.Role));
                return byRole != 0 ? byRole : a.Design.Radius.CompareTo(b.Design.Radius);
            });

            Vector3 right = Vector3.Cross(Vector3.up, forward);
            depth = 0f;
            widest = 0f;
            foreach (IGrouping<string, Cell> cluster in cells.GroupBy(c => $"{Level(c)}|{c.Role}"))
            {
                List<Cell> members = cluster.ToList();
                labels.Add((forward * (depth + 2f), $"<#5cf>Level {Level(members[0])}<br><#fff>{Plural(members[0].Role)}"));
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
            bool labelled = false;
            float until = Time.time + 40f * 60f;
            int built = 0;
            while (built < cells.Count && Time.time < until)
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

                if (!labelled && pads.All(p => p.Done || labels.All(l => Utils.DistanceXZ(p.Center, l.At) > PadRadius + 6f)))
                {
                    labelled = true;
                    foreach ((Vector3 at, string text) in labels)
                    {
                        Safe("a label", () => PutSign(at, forward, text));
                    }
                }

                // Then each plot whose ground is all done.
                foreach (Cell cell in cells.Where(c => !c.Done))
                {
                    float reach = cell.Half * 1.42f + PadRadius;
                    if (pads.Any(p => !p.Done && Utils.DistanceXZ(p.Center, cell.Center) < reach))
                    {
                        continue;
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
            Vector3 origin = cell.Center - Vector3.up * ConstructionSite.FloorOf(plan);
            Quaternion turn = Quaternion.Euler(0f, yaw, 0f);
            int count = 0;
            foreach (DesignSpawner.PlanEntry entry in plan)
            {
                GameObject made = DesignSpawner.SpawnEntry(entry, origin, turn, 0, false);
                if (made != null)
                {
                    made.GetComponent<ZNetView>()?.GetZDO()?.Set(KeyGallery, 1);
                    count++;
                }
            }

            return count;
        }

        /// <summary>A sign at the front of the plot: the kind and level in blue, the design's name in white.</summary>
        private static void Sign(Cell cell, Vector3 forward)
        {
            PutSign(cell.Center - forward * (cell.Half - 1f), forward, $"<#5cf>{Label(cell)}, {Level(cell)}<br><#fff>{cell.Design.Name}");
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
