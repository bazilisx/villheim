using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using UnityEngine;
using Villheim.Logic.Villagers;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// 'vh snapshot [radius] [note]' (2026-11-10): writes everything loaded round the nearest village (or the player) to
    /// BepInEx/Villheim/snapshots, so a session can study a village's ground without the game:
    ///
    /// - snapshot-*.json: every networked object within the radius (pieces with who made them and their health, trees,
    ///   logs, stumps, rocks, pickables, creatures, villagers with what they are doing, dropped items), the game's
    ///   locations, the village's plots, site, hold-up and chest, and the ground on a 2 m grid (height, biome, water,
    ///   steepness).
    /// - snapshot-*.txt: the same seen from above, one character per 2 m, with a key, for a quick read.
    ///
    /// Only what the game has loaded is there: zones away from the player are empty (the file counts them).
    /// </summary>
    internal static class Snapshot
    {
        public const string Help =
            "snapshot [radius] [note]: write everything loaded round the nearest village (default 150 m) and its ground to " +
            "BepInEx/Villheim/snapshots (json plus a top-down text map)";

        private const float Cell = 2f;

        private static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

        public static string Command(Player player, string[] args)
        {
            float radius = args.Length > 0 && float.TryParse(args[0], NumberStyles.Float, Inv, out float r) ? Mathf.Clamp(r, 20f, 400f) : 150f;
            string note = args.Length > 1 ? string.Join(" ", args.Skip(1)) : "";
            VillageHearth hearth = VillageHearth.Closest(player.transform.position, 200f);
            Vector3 center = hearth != null && hearth.IsValid ? hearth.transform.position : player.transform.position;
            try
            {
                var watch = System.Diagnostics.Stopwatch.StartNew();
                string stem = Write(center, radius, hearth != null && hearth.IsValid ? hearth : null, player, note, out int objects);
                return $"Villheim: snapshot of {objects} objects within {radius:0} m written in {watch.ElapsedMilliseconds} ms to {stem}.json and .txt";
            }
            catch (Exception ex)
            {
                VillheimPlugin.Log.LogWarning($"Snapshot failed: {ex}");
                return "Villheim: snapshot failed: " + ex.Message;
            }
        }

        private enum Kind
        {
            Hearth, Villager, Player, Creature, Piece, Tree, Log, Stump, Rock, Ore, Pickable, Item, Destructible, Other
        }

        private sealed class Thing
        {
            public Kind Kind;
            public string Prefab;
            public Vector3 Position;
            public float Yaw;
            public GameObject Go;
            public ZDO Zdo;
        }

        private static string Write(Vector3 center, float radius, VillageHearth hearth, Player player, string note, out int count)
        {
            string folder = Path.Combine(BepInEx.Paths.BepInExRootPath, "Villheim", "snapshots");
            Directory.CreateDirectory(folder);
            var state = hearth != null ? new VillageState(hearth.Zdo) : null;
            string name = state != null ? Safe(state.Name) : "here";
            string stem = Path.Combine(folder, $"snapshot-{name}-{DateTime.Now.ToString("yyyyMMdd-HHmmss", Inv)}");

            List<Thing> things = Collect(center, radius);
            count = things.Count;
            var json = new StringBuilder(1 << 20);
            json.Append("{\n");
            Field(json, "made", DateTime.Now.ToString("s", Inv)); json.Append(",\n");
            Field(json, "build", VillheimLogic.Build); json.Append(",\n");
            Field(json, "note", note); json.Append(",\n");
            json.Append($"\"day\":{(EnvMan.instance != null ? EnvMan.instance.GetDay() : 0)},\"dayFraction\":{F(EnvMan.instance != null ? EnvMan.instance.GetDayFraction() : 0f)},\n");
            json.Append($"\"center\":{V(center)},\"radius\":{F(radius)},\"cell\":{F(Cell)},\"waterLevel\":{F(ZoneSystem.instance != null ? ZoneSystem.instance.m_waterLevel : 30f)},\n");
            json.Append($"\"player\":{V(player.transform.position)},\n");
            AppendVillage(json, hearth, state);
            json.Append(",\n");
            AppendLocations(json, center, radius);
            json.Append(",\n");
            int unloaded = AppendGround(json, center, radius, out float[,] heights, out char[,] ground);
            json.Append($",\n\"unloadedCells\":{unloaded},\n");
            json.Append("\"objects\":[\n");
            for (int i = 0; i < things.Count; i++)
            {
                AppendThing(json, things[i]);
                json.Append(i < things.Count - 1 ? ",\n" : "\n");
            }

            json.Append("]\n}\n");
            File.WriteAllText(stem + ".json", json.ToString());
            File.WriteAllText(stem + ".txt", Map(center, radius, things, ground, state, hearth, note));
            return stem;
        }

        private static List<Thing> Collect(Vector3 center, float radius)
        {
            var list = new List<Thing>();
            if (ZNetScene.instance == null)
            {
                return list;
            }

            foreach (KeyValuePair<ZDO, ZNetView> pair in ZNetScene.instance.m_instances)
            {
                ZNetView view = pair.Value;
                if (view == null || !view.IsValid())
                {
                    continue;
                }

                GameObject go = view.gameObject;
                Vector3 p = go.transform.position;
                if (Utils.DistanceXZ(p, center) > radius)
                {
                    continue;
                }

                list.Add(new Thing
                {
                    Kind = KindOf(go), Prefab = Utils.GetPrefabName(go), Position = p, Yaw = go.transform.eulerAngles.y, Go = go,
                    Zdo = pair.Key,
                });
            }

            return list.OrderBy(t => t.Kind).ThenBy(t => t.Prefab, StringComparer.Ordinal).ToList();
        }

        private static Kind KindOf(GameObject go)
        {
            if (go.GetComponent<VillageHearth>()) return Kind.Hearth;
            if (go.GetComponent<Villager>()) return Kind.Villager;
            if (go.GetComponent<Player>()) return Kind.Player;
            if (go.GetComponent<Character>()) return Kind.Creature;
            if (go.GetComponent<Piece>()) return Kind.Piece;
            if (go.GetComponent<TreeBase>()) return Kind.Tree;
            if (go.GetComponent<TreeLog>()) return Kind.Log;
            if (go.GetComponent<ItemDrop>()) return Kind.Item;
            if (go.GetComponent<Pickable>()) return Kind.Pickable;
            if (go.GetComponent<MineRock>() || go.GetComponent<MineRock5>())
            {
                return PathPlanner.IsOre(Utils.GetPrefabName(go)) ? Kind.Ore : Kind.Rock;
            }

            Destructible destructible = go.GetComponent<Destructible>();
            if (destructible != null)
            {
                string name = go.name.ToLowerInvariant();
                return name.Contains("stub") || name.Contains("stump") ? Kind.Stump :
                    name.Contains("rock") || name.Contains("stone") ? Kind.Rock : Kind.Destructible;
            }

            return Kind.Other;
        }

        private static void AppendThing(StringBuilder json, Thing t)
        {
            json.Append($"{{\"k\":\"{t.Kind}\",\"p\":\"{Esc(t.Prefab)}\",\"x\":{F(t.Position.x)},\"y\":{F(t.Position.y)},\"z\":{F(t.Position.z)},\"yaw\":{F(t.Yaw)}");
            int builtBy = t.Zdo.GetInt(Keys.BuiltBy);
            if (builtBy != 0)
            {
                json.Append($",\"village\":{builtBy}");
            }

            switch (t.Kind)
            {
                case Kind.Piece:
                    Piece piece = t.Go.GetComponent<Piece>();
                    long creator = piece != null ? piece.GetCreator() : 0L;
                    if (creator != 0L)
                    {
                        json.Append($",\"creator\":{creator}");
                    }

                    WearNTear wear = t.Go.GetComponent<WearNTear>();
                    if (wear != null)
                    {
                        json.Append($",\"health\":{F(PieceHealth.Fraction(wear))}");
                    }

                    Location location = Location.GetLocation(t.Position, false);
                    if (location != null && builtBy == 0 && creator == 0L)
                    {
                        json.Append($",\"location\":\"{Esc(Utils.GetPrefabName(location.gameObject))}\"");
                    }

                    if (Ruins.Clearable(piece))
                    {
                        json.Append(",\"ruin\":true");
                    }

                    if (t.Go.GetComponent<Container>() is Container chest && chest.GetInventory() != null)
                    {
                        json.Append($",\"items\":{chest.GetInventory().NrOfItems()}");
                    }

                    break;
                case Kind.Villager:
                    Villager villager = t.Go.GetComponent<Villager>();
                    json.Append($",\"name\":\"{Esc(villager.VillagerName)}\",\"doer\":\"{Status.Current(villager)}\"" +
                                $",\"activity\":\"{Esc(VillagerBehaviour.Activity(villager) ?? "")}\"" +
                                $",\"holding\":\"{Esc(villager.GetRightItem()?.m_shared?.m_name ?? "")}\"" +
                                $",\"health\":{F(villager.GetHealthPercentage())}" +
                                $",\"home\":{V(villager.Zdo.GetVec3(Keys.VillagerHome, Vector3.zero))}");
                    break;
                case Kind.Creature:
                    Character creature = t.Go.GetComponent<Character>();
                    BaseAI ai = creature.GetBaseAI();
                    json.Append($",\"faction\":\"{creature.m_faction}\",\"tamed\":{(creature.IsTamed() ? "true" : "false")}" +
                                $",\"villageAnimal\":{(Animals.IsVillageAnimal(creature) ? "true" : "false")}" +
                                $",\"alerted\":{(ai != null && ai.IsAlerted() ? "true" : "false")}" +
                                $",\"health\":{F(creature.GetHealthPercentage())}");
                    break;
                case Kind.Rock:
                case Kind.Ore:
                case Kind.Tree:
                    Bounds bounds = Bounds(t.Go);
                    json.Append($",\"size\":{F(Mathf.Max(bounds.size.x, bounds.size.z))},\"height\":{F(bounds.size.y)}" +
                                $",\"tooBig\":{(PlotFinder.TooBigToClear(t.Go) ? "true" : "false")}");
                    break;
            }

            json.Append('}');
        }

        private static Bounds Bounds(GameObject go)
        {
            Collider[] colliders = go.GetComponentsInChildren<Collider>();
            if (colliders.Length == 0)
            {
                return new Bounds(go.transform.position, Vector3.one);
            }

            Bounds b = colliders[0].bounds;
            foreach (Collider c in colliders)
            {
                b.Encapsulate(c.bounds);
            }

            return b;
        }

        private static void AppendVillage(StringBuilder json, VillageHearth hearth, VillageState state)
        {
            if (hearth == null || state == null)
            {
                json.Append("\"village\":null");
                return;
            }

            json.Append("\"village\":{");
            Field(json, "name", state.Name); json.Append(',');
            json.Append($"\"id\":{state.Id},\"hearth\":{V(hearth.transform.position)},\"biome\":\"{state.Biome}\",");
            json.Append($"\"tier\":\"{VillageBrain.Tier(state.Plots.Count)}\",");
            json.Append($"\"villageRadius\":{F(VillheimConfig.VillageRadius.Value)},");
            Field(json, "holdUp", PlotFinder.HoldUp(state.Id)); json.Append(',');
            string next;
            try
            {
                next = NextStep.Text(hearth, state);
            }
            catch (Exception)
            {
                next = "";
            }

            Field(json, "next", next); json.Append(',');
            Field(json, "status", SafeStatus(hearth)); json.Append(',');
            ConstructionSite.Site site = ConstructionSite.IsActive(hearth.Zdo) ? ConstructionSite.Get(hearth.Zdo) : null;
            if (site != null)
            {
                json.Append($"\"site\":{{\"design\":\"{Esc(site.Design)}\",\"role\":\"{site.Role}\",\"at\":{V(site.Position)},\"yaw\":{F(site.Yaw)}," +
                            $"\"radius\":{F(site.Radius)},\"upgrade\":{(site.Upgrade ? "true" : "false")},\"index\":{ConstructionSite.Index(hearth)}," +
                            $"\"total\":{ConstructionSite.Total(hearth)}}},");
            }
            else
            {
                json.Append("\"site\":null,");
            }

            json.Append("\"stock\":{");
            json.Append(string.Join(",", Materials.Tracked.Select(m => $"\"{m}\":{VillageChest.Have(hearth, state, m)}")));
            json.Append("},\"plots\":[");
            json.Append(string.Join(",", state.Plots.Select(p =>
            {
                Foot foot = Footprints.Of(p.Design, p.Position, p.Yaw, p.Radius, false);
                return $"{{\"design\":\"{Esc(p.Design)}\",\"role\":\"{Esc(p.Role ?? "")}\",\"at\":{V(p.Position)},\"yaw\":{F(p.Yaw)},\"radius\":{F(p.Radius)}" +
                       $",\"foot\":{{\"x\":{F(foot.Center.x)},\"z\":{F(foot.Center.y)},\"halfX\":{F(foot.HalfX)},\"halfZ\":{F(foot.HalfZ)},\"yaw\":{F(foot.Yaw)}}}}}";
            })));
            json.Append("]}");
        }

        private static string SafeStatus(VillageHearth hearth)
        {
            try
            {
                return VillageStatus.Now(hearth);
            }
            catch (Exception)
            {
                return "";
            }
        }

        private static void AppendLocations(StringBuilder json, Vector3 center, float radius)
        {
            json.Append("\"locations\":[");
            var parts = new List<string>();
            foreach (Location location in Location.s_allLocations)
            {
                if (location == null || Utils.DistanceXZ(location.transform.position, center) > radius + location.m_exteriorRadius)
                {
                    continue;
                }

                parts.Add($"{{\"name\":\"{Esc(Utils.GetPrefabName(location.gameObject))}\",\"at\":{V(location.transform.position)}," +
                          $"\"radius\":{F(location.m_exteriorRadius)},\"noBuild\":{(location.m_noBuild ? "true" : "false")}," +
                          $"\"interior\":{(location.m_hasInterior ? "true" : "false")}}}");
            }

            json.Append(string.Join(",", parts));
            json.Append(']');
        }

        /// <summary>The ground on a grid: rows of heights, then rows of one-letter codes (biome, water, steep).</summary>
        private static int AppendGround(StringBuilder json, Vector3 center, float radius, out float[,] heights, out char[,] codes)
        {
            int n = Mathf.CeilToInt(radius * 2f / Cell) + 1;
            heights = new float[n, n];
            codes = new char[n, n];
            float water = ZoneSystem.instance != null ? ZoneSystem.instance.m_waterLevel : 30f;
            int unloaded = 0;
            for (int row = 0; row < n; row++)
            {
                for (int col = 0; col < n; col++)
                {
                    Vector3 p = Point(center, radius, row, col);
                    if (!ZoneSystem.instance.IsZoneLoaded(p) || !ZoneSystem.instance.GetGroundHeight(p, out float h))
                    {
                        heights[row, col] = float.NaN;
                        codes[row, col] = ' ';
                        unloaded++;
                        continue;
                    }

                    heights[row, col] = h;
                    codes[row, col] = h < water - 0.3f ? '~' : BiomeCode(WorldGenerator.instance != null ? WorldGenerator.instance.GetBiome(p) : Heightmap.Biome.Meadows);
                }
            }

            // Steep: more than 1.5 m of rise across one cell.
            for (int row = 1; row < n - 1; row++)
            {
                for (int col = 1; col < n - 1; col++)
                {
                    float h = heights[row, col];
                    if (float.IsNaN(h) || codes[row, col] == '~')
                    {
                        continue;
                    }

                    float most = 0f;
                    foreach ((int dr, int dc) in new[] { (1, 0), (-1, 0), (0, 1), (0, -1) })
                    {
                        float other = heights[row + dr, col + dc];
                        if (!float.IsNaN(other))
                        {
                            most = Mathf.Max(most, Mathf.Abs(other - h));
                        }
                    }

                    if (most > 1.5f)
                    {
                        codes[row, col] = '^';
                    }
                }
            }

            json.Append($"\"ground\":{{\"size\":{n},\"rowsNorthFirst\":true,\"heights\":[\n");
            for (int row = 0; row < n; row++)
            {
                json.Append('[');
                for (int col = 0; col < n; col++)
                {
                    float h = heights[row, col];
                    json.Append(float.IsNaN(h) ? "null" : h.ToString("0.0", Inv));
                    if (col < n - 1)
                    {
                        json.Append(',');
                    }
                }

                json.Append(row < n - 1 ? "],\n" : "]\n");
            }

            json.Append("],\"codes\":[\n");
            for (int row = 0; row < n; row++)
            {
                var line = new StringBuilder(n);
                for (int col = 0; col < n; col++)
                {
                    line.Append(codes[row, col]);
                }

                json.Append('"').Append(line).Append(row < n - 1 ? "\",\n" : "\"\n");
            }

            json.Append("]}");
            return unloaded;
        }

        /// <summary>Row 0 is the north edge (largest z), column 0 the west edge.</summary>
        private static Vector3 Point(Vector3 center, float radius, int row, int col) =>
            new Vector3(center.x - radius + col * Cell, center.y, center.z + radius - row * Cell);

        private static bool ToCell(Vector3 center, float radius, Vector3 p, int n, out int row, out int col)
        {
            col = Mathf.RoundToInt((p.x - (center.x - radius)) / Cell);
            row = Mathf.RoundToInt(((center.z + radius) - p.z) / Cell);
            return row >= 0 && col >= 0 && row < n && col < n;
        }

        private static char BiomeCode(Heightmap.Biome biome)
        {
            switch (biome)
            {
                case Heightmap.Biome.Meadows: return '.';
                case Heightmap.Biome.BlackForest: return ',';
                case Heightmap.Biome.Swamp: return '"';
                case Heightmap.Biome.Mountain: return '\'';
                case Heightmap.Biome.Plains: return '_';
                case Heightmap.Biome.Mistlands: return ':';
                case Heightmap.Biome.Ocean: return '~';
                default: return '-';
            }
        }

        /// <summary>The top-down text map: ground first, then things, people last so they stay visible.</summary>
        private static string Map(Vector3 center, float radius, List<Thing> things, char[,] ground, VillageState state, VillageHearth hearth, string note)
        {
            int n = ground.GetLength(0);
            var grid = (char[,])ground.Clone();
            int Rank(Kind k)
            {
                switch (k)
                {
                    case Kind.Villager: case Kind.Player: case Kind.Hearth: return 4;
                    case Kind.Creature: return 3;
                    case Kind.Piece: return 2;
                    default: return 1;
                }
            }

            // Plot outlines under the pieces.
            if (state != null)
            {
                foreach (Plot plot in state.Plots)
                {
                    Foot foot = Footprints.Of(plot.Design, plot.Position, plot.Yaw, plot.Radius, false);
                    Quaternion turn = Quaternion.Euler(0f, foot.Yaw, 0f);
                    for (float a = -foot.HalfX; a <= foot.HalfX; a += Cell * 0.5f)
                    {
                        foreach (float b in new[] { -foot.HalfZ, foot.HalfZ })
                        {
                            Mark(grid, center, radius, n, foot.CenterAt(0f) + turn * new Vector3(a, 0f, b), '+');
                        }
                    }

                    for (float b = -foot.HalfZ; b <= foot.HalfZ; b += Cell * 0.5f)
                    {
                        foreach (float a in new[] { -foot.HalfX, foot.HalfX })
                        {
                            Mark(grid, center, radius, n, foot.CenterAt(0f) + turn * new Vector3(a, 0f, b), '+');
                        }
                    }
                }
            }

            foreach (Thing t in things.OrderBy(t => Rank(t.Kind)))
            {
                char c = Symbol(t);
                if (c != '\0')
                {
                    Mark(grid, center, radius, n, t.Position, c);
                }
            }

            var text = new StringBuilder();
            text.AppendLine($"Villheim snapshot {DateTime.Now.ToString("s", Inv)} {VillheimLogic.Build}");
            text.AppendLine($"Center {V(center)}, radius {radius:0} m, one character = {Cell:0} m, north up. {note}");
            if (state != null)
            {
                text.AppendLine($"{state.Name}: {VillageStatus.Now(hearth)}");
            }

            text.AppendLine("Key: H hearth, @ villager, P player, c creature (a village animal), m wild creature, # village piece, " +
                            "% ruin or location piece (clearable), X other placed piece (player or unknown), + plot outline, " +
                            "T tree, t stump or log, o rock, O rock too big to clear, $ ore, * pickable, i item, ~ water, ^ steep, " +
                            ". meadows , black forest \" swamp ' mountain _ plains : mistlands, blank not loaded.");
            text.AppendLine(new string('-', n));
            for (int row = 0; row < n; row++)
            {
                for (int col = 0; col < n; col++)
                {
                    text.Append(grid[row, col]);
                }

                text.AppendLine();
            }

            text.AppendLine(new string('-', n));
            text.AppendLine("Counts: " + string.Join(", ", things.GroupBy(t => t.Kind).Select(g => $"{g.Key} {g.Count()}")));
            text.AppendLine("Most common pieces not built by a village: " + string.Join(", ", things
                .Where(t => t.Kind == Kind.Piece && t.Zdo.GetInt(Keys.BuiltBy) == 0)
                .GroupBy(t => t.Prefab).OrderByDescending(g => g.Count()).Take(15).Select(g => $"{g.Key} {g.Count()}")));
            return text.ToString();
        }

        private static char Symbol(Thing t)
        {
            switch (t.Kind)
            {
                case Kind.Hearth: return 'H';
                case Kind.Villager: return '@';
                case Kind.Player: return 'P';
                case Kind.Creature: return Animals.IsVillageAnimal(t.Go.GetComponent<Character>()) ? 'c' : 'm';
                case Kind.Piece:
                    if (t.Zdo.GetInt(Keys.BuiltBy) != 0) return '#';
                    Piece piece = t.Go.GetComponent<Piece>();
                    return piece != null && Ruins.Clearable(piece) ? '%' : 'X';
                case Kind.Tree: return 'T';
                case Kind.Log:
                case Kind.Stump: return 't';
                case Kind.Rock: return PlotFinder.TooBigToClear(t.Go) ? 'O' : 'o';
                case Kind.Ore: return '$';
                case Kind.Pickable: return '*';
                case Kind.Item: return 'i';
                default: return '\0';
            }
        }

        private static void Mark(char[,] grid, Vector3 center, float radius, int n, Vector3 p, char c)
        {
            if (ToCell(center, radius, p, n, out int row, out int col))
            {
                grid[row, col] = c;
            }
        }

        private static void Field(StringBuilder json, string key, string value) => json.Append($"\"{key}\":\"{Esc(value ?? "")}\"");

        private static string V(Vector3 v) => $"[{F(v.x)},{F(v.y)},{F(v.z)}]";

        private static string F(float f) => float.IsNaN(f) || float.IsInfinity(f) ? "null" : f.ToString("0.##", Inv);

        private static string Esc(string s)
        {
            var b = new StringBuilder(s.Length + 8);
            foreach (char c in s)
            {
                switch (c)
                {
                    case '"': b.Append("\\\""); break;
                    case '\\': b.Append("\\\\"); break;
                    case '\n': b.Append("\\n"); break;
                    case '\r': break;
                    case '\t': b.Append("\\t"); break;
                    default:
                        if (c < ' ') b.Append($"\\u{(int)c:x4}");
                        else b.Append(c);
                        break;
                }
            }

            return b.ToString();
        }

        private static string Safe(string name) => new string((name ?? "village").Where(char.IsLetterOrDigit).ToArray());
    }
}
