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
    /// it (the same pieces, the bottom of its walls on the ground), with a sign in front: the kind of building and the
    /// village level it is meant for on top in bright blue, the design's name below in white.
    ///
    /// The gallery starts in front of the player and runs in rows of six away from him. First the whole area (with a
    /// 12 m margin) is made one flat, bare plain: everything standing on it is removed at any height (trees, stumps,
    /// logs, rocks, bushes, ruins, anything not a creature or built by a player), the ground is levelled at the middle height of the area
    /// (up to 40 m of change, past the game's own 8 m limit, see TerrainShaper.DeepPatch) and the grass taken off, in overlapping pads 24 m apart. A plot's design goes up once
    /// all the ground round it is done. Parts in zones that aren't loaded yet are done as the player walks up to them
    /// (checked every two seconds for 40 minutes).
    /// </summary>
    internal static class Gallery
    {
        private sealed class Cell
        {
            public DesignLibrary.Design Design;
            public Role Role;
            public Vector3 Center;
            public float Half;
            public bool Done;
        }

        private static readonly Role[] Order = { Role.House, Role.Hub, Role.Workshop, Role.Storage, Role.Farm };
        private static readonly int KeyGallery = "villheim_gallery".GetStableHashCode();
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
            "vh gallery <meadows|blackforest> [all|house|hall|prof|storage|farm] [level]: e.g. 'vh gallery meadows house 1'; 'vh gallery clear' removes a gallery";

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
            foreach (string arg in args.Skip(1))
            {
                string a = arg.ToLowerInvariant();
                if (int.TryParse(a, out int n))
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
            VillheimPlugin.Instance.StartCoroutine(Run(player.transform.position, forward, biome, group, level));
            return $"Villheim: gathering every {biome} design ({group}{(level > 0 ? ", level " + level : "")}): the curated lists, " +
                   "all blueprints (yours, PlanBuild's, OverDrive's) and every location in the game that is a buildable building.";
        }

        private static IEnumerator Run(Vector3 playerPosition, Vector3 forward, Heightmap.Biome biome, string group, int level)
        {
            _running = true;
            var cells = new List<Cell>();
            var seen = new HashSet<string>();
            void Add(DesignLibrary.Design design, Role role)
            {
                if (seen.Add(design.Name))
                {
                    cells.Add(new Cell { Design = design, Role = role, Half = Mathf.Clamp(design.Radius + 4f, 8f, 36f) });
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
            int checkedCount = 0;
            foreach (ZoneSystem.ZoneLocation location in locations)
            {
                checkedCount++;
                if (!seen.Contains(location.m_prefabName))
                {
                    bool add = false;
                    Safe(location.m_prefabName, () => add = DesignLibrary.BuildableIn(location, biome) && IsBuilding(location));
                    if (add)
                    {
                        Add(new DesignLibrary.Design(location, 1f), RoleFromName(location.m_prefabName));
                    }
                }

                if (checkedCount % 10 == 0)
                {
                    MessageHud.instance?.ShowMessage(MessageHud.MessageType.TopLeft,
                        $"Gallery: looked at {checkedCount}/{locations.Count} locations, {cells.Count} designs so far");
                }

                yield return null;
            }

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

            string summary = "";
            Safe("the layout", () => summary = Plan(cells, playerPosition, forward, biome));
            Console.instance?.Print(summary);
            MessageHud.instance?.ShowMessage(MessageHud.MessageType.Center, $"Gallery: {cells.Count} designs; clearing the ground");
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
        /// Lays the designs out in clusters, one per level and kind (all level 1 homes together, then level 1 halls
        /// and so on), each cluster starting a new row behind a label sign, and starts on the ground.
        /// </summary>
        private static string Plan(List<Cell> cells, Vector3 playerPosition, Vector3 forward, Heightmap.Biome biome)
        {
            cells = cells.OrderBy(c => Level(c)).ThenBy(c => System.Array.IndexOf(Order, c.Role)).ThenBy(c => c.Design.Radius).ThenBy(c => c.Design.Name).ToList();
            Vector3 right = Vector3.Cross(Vector3.up, forward);
            Vector3 start = playerPosition + forward * 6f;
            float height = start.y;
            if (ZoneSystem.instance.GetGroundHeight(start, out float ground))
            {
                height = Mathf.Max(ground, ZoneSystem.instance.m_waterLevel + 1.5f);
            }

            float depth = 0f;
            float widest = 0f;
            var labels = new List<(Vector3 At, string Text)>();
            foreach (IGrouping<string, Cell> cluster in cells.GroupBy(c => $"{Level(c)}|{c.Role}"))
            {
                List<Cell> members = cluster.ToList();
                labels.Add((start + forward * (depth + 2f), $"<#5cf>Level {Level(members[0])}<br><#fff>{Plural(members[0].Role)}"));
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
                        cell.Center = start + forward * (depth + rowDepth) + right * (x + cell.Half);
                        x += cell.Half * 2f;
                    }

                    depth += rowDepth * 2f;
                }

                depth += 8f; // a gap between clusters
            }

            // One plain over the whole gallery: pads 24 m apart, levelled at the middle height of the area.
            var pads = new List<Pad>();
            var heights = new List<float>();
            for (float z = -Margin; z <= depth + Margin; z += PadSpacing)
            {
                for (float x = -widest / 2f - Margin; x <= widest / 2f + Margin; x += PadSpacing)
                {
                    Vector3 p = start + forward * z + right * x;
                    pads.Add(new Pad { Center = p });
                    if (ZoneSystem.instance.GetGroundHeight(p, out float h))
                    {
                        heights.Add(h);
                    }
                }
            }

            heights.Sort();
            height = Mathf.Max(heights.Count > 0 ? heights[heights.Count / 2] : height, ZoneSystem.instance.m_waterLevel + 1.5f);
            foreach (Pad pad in pads)
            {
                pad.Center.y = height;
            }

            foreach (Cell cell in cells)
            {
                cell.Center.y = height;
            }

            for (int i = 0; i < labels.Count; i++)
            {
                labels[i] = (new Vector3(labels[i].At.x, height, labels[i].At.z), labels[i].Text);
            }

            VillheimPlugin.Instance.StartCoroutine(Build(cells, pads, forward, labels));
            return $"Villheim: clearing and levelling {widest + Margin * 2f:0} by {depth + Margin * 2f:0} m ahead of you at {height:0.0} m, " +
                   $"then laying out {cells.Count} {biome} designs in {labels.Count} clusters. Walk along it to load the far end.";
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
                    Safe("levelling ground", () => TerrainShaper.LevelPad(current.Center, PadRadius, PadRadius + 8f, 40f));
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
