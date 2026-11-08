using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Plans village paths the way Millenaire does: a grid search (A*, one metre cells, four directions) from a
    /// building's front toward the hearth, stopping as soon as it meets a path that is already laid, so the paths grow
    /// into a tree of streets. Steep steps cost more (squared slope), turns cost a little, walking on an existing
    /// path costs half, and water, other buildings and the hearth itself are off limits.
    ///
    /// Every laid point is kept on the hearth as the village's path network, so later paths can join it and new
    /// buildings keep off it.
    /// </summary>
    internal static class PathPlanner
    {
        private static readonly int KeyNetwork = "villheim_path_net".GetStableHashCode();

        private const int MaxNodes = 6000;
        private const float SlopePenalty = 2f;
        private const float TurnPenalty = 0.3f;
        private const float ReuseFactor = 0.5f;
        private const float HearthReach = 2.5f;

        private static readonly Vector2Int[] Steps = { new Vector2Int(1, 0), new Vector2Int(-1, 0), new Vector2Int(0, 1), new Vector2Int(0, -1) };

        // ---------------------------------------------------------------- the network

        public static HashSet<Vector2Int> Network(VillageHearth hearth)
        {
            var cells = new HashSet<Vector2Int>();
            foreach (string pair in hearth.Zdo.GetString(KeyNetwork, "").Split(' '))
            {
                int comma = pair.IndexOf(',');
                if (comma > 0 && int.TryParse(pair.Substring(0, comma), out int x) && int.TryParse(pair.Substring(comma + 1), out int z))
                {
                    cells.Add(new Vector2Int(x, z));
                }
            }

            return cells;
        }

        /// <summary>The laid paths and the paths planned but not laid yet: what new paths join and buildings keep off.</summary>
        public static HashSet<Vector2Int> PlannedNetwork(VillageHearth hearth)
        {
            HashSet<Vector2Int> cells = Network(hearth);
            cells.UnionWith(Villagers.PathLaying.QueuedCells(hearth));
            return cells;
        }

        /// <summary>
        /// Once a day: every building's door must lead to the network (laid or planned). A building whose door is more
        /// than 3 m from any path cell, with no path waiting for it, gets one planned now (Millénaire re-plans its paths
        /// when a building is not connected).
        /// </summary>
        public static void CheckDoors(VillageHearth hearth)
        {
            if (!VillheimConfig.BuildPaths.Value)
            {
                return;
            }

            var state = new VillageState(hearth.Zdo);
            HashSet<Vector2Int> network = PlannedNetwork(hearth);
            foreach (Plot plot in state.Plots)
            {
                if (Utils.DistanceXZ(plot.Position, hearth.transform.position) < plot.Radius * 0.6f)
                {
                    continue; // built round the hearth: its door opens onto the middle
                }

                float doorAngle = Designs.Doors.Angle(plot.Design);
                Vector3 door = Door(plot.Design, plot.Position, plot.Radius, plot.Yaw, doorAngle, hearth.transform.position);
                if (DistanceToNetwork(network, door) <= 3f || Villagers.PathLaying.IsQueued(hearth, plot.Position))
                {
                    continue;
                }

                VillheimPlugin.Log.LogInfo($"{state.Name}: the {plot.Design} has no path to the middle; planning one.");
                Villagers.PathLaying.Queue(hearth, plot.Position, plot.Radius, plot.Yaw, doorAngle, plot.Design);
                network = PlannedNetwork(hearth);
            }
        }

        public static void AddToNetwork(VillageHearth hearth, Vector3 point)
        {
            var cell = Cell(point);
            string raw = hearth.Zdo.GetString(KeyNetwork, "");
            string entry = cell.x.ToString(CultureInfo.InvariantCulture) + "," + cell.y.ToString(CultureInfo.InvariantCulture);
            if ((" " + raw + " ").Contains(" " + entry + " "))
            {
                return;
            }

            hearth.Zdo.Set(KeyNetwork, raw.Length == 0 ? entry : raw + " " + entry);
        }

        /// <summary>Distance on the ground from the point to the nearest laid path cell (a large number if none).</summary>
        public static float DistanceToNetwork(HashSet<Vector2Int> network, Vector3 point)
        {
            float best = float.MaxValue;
            foreach (Vector2Int cell in network)
            {
                float d = Vector2.Distance(new Vector2(point.x, point.z), new Vector2(cell.x, cell.y));
                if (d < best)
                {
                    best = d;
                }
            }

            return best;
        }

        public static Vector2Int Cell(Vector3 point) => new Vector2Int(Mathf.RoundToInt(point.x), Mathf.RoundToInt(point.z));

        // ---------------------------------------------------------------- taking up a road

        private static float Dist(Vector2Int cell, Vector3 point) => Vector2.Distance(new Vector2(cell.x, cell.y), new Vector2(point.x, point.z));

        private static IEnumerable<Vector2Int> Around(Vector2Int c)
        {
            for (int dx = -1; dx <= 1; dx++)
            for (int dz = -1; dz <= 1; dz++)
            {
                if (dx != 0 || dz != 0)
                {
                    yield return new Vector2Int(c.x + dx, c.y + dz);
                }
            }
        }

        /// <summary>Where a building's roads start: a metre out from each of its path markers, or its door for a design without them.</summary>
        private static List<Vector3> Starts(Plot plot, Vector3 center)
        {
            List<(Vector3 At, Vector3 Out)> exits = Exits(plot.Design, plot.Position, plot.Yaw);
            return exits.Count > 0
                ? exits.Select(e => e.At + e.Out * 1f).ToList()
                : new List<Vector3> { Door(plot.Design, plot.Position, plot.Radius, plot.Yaw, Designs.Doors.Angle(plot.Design), center) };
        }

        /// <summary>The road cells from the seeds to the nearest target, along the laid network (none if not connected).</summary>
        private static HashSet<Vector2Int> RouteTo(HashSet<Vector2Int> network, List<Vector2Int> seeds, HashSet<Vector2Int> targets)
        {
            var from = new Dictionary<Vector2Int, Vector2Int>();
            var open = new Queue<Vector2Int>();
            foreach (Vector2Int seed in seeds)
            {
                if (!from.ContainsKey(seed))
                {
                    from[seed] = seed;
                    open.Enqueue(seed);
                }
            }

            while (open.Count > 0)
            {
                Vector2Int c = open.Dequeue();
                if (targets.Contains(c))
                {
                    var route = new HashSet<Vector2Int>();
                    for (Vector2Int at = c; ; at = from[at])
                    {
                        route.Add(at);
                        if (from[at] == at)
                        {
                            break;
                        }
                    }

                    return route;
                }

                foreach (Vector2Int n in Around(c))
                {
                    if (network.Contains(n) && !from.ContainsKey(n))
                    {
                        from[n] = c;
                        open.Enqueue(n);
                    }
                }
            }

            return new HashSet<Vector2Int>();
        }

        /// <summary>
        /// A building is rebuilt: the road that served only the old building is taken up (out of the village's path network
        /// and painted back to grass), up to where it meets a road another building still uses. The rule (Tyler,
        /// 2026-11-07): roads follow the buildings standing now; a rebuilt building gets a new road from its own markers.
        /// Every other building's road to the middle is traced along the network first, and none of it is touched.
        /// Returns how many road cells were taken up.
        /// </summary>
        public static int TakeUpRoad(VillageHearth hearth, Plot old, IReadOnlyList<Plot> others)
        {
            HashSet<Vector2Int> network = Network(hearth);
            if (network.Count == 0 || old == null)
            {
                return 0;
            }

            Vector3 center = hearth.transform.position;
            var targets = new HashSet<Vector2Int>(network.Where(c => Dist(c, center) <= HearthReach + 1.5f));
            Plot hub = Hub(center, others);
            if (hub != null)
            {
                foreach ((Vector3 at, Vector3 _) in Exits(hub.Design, hub.Position, hub.Yaw))
                {
                    targets.UnionWith(network.Where(c => Dist(c, at) <= 2.5f));
                }
            }

            var needed = new HashSet<Vector2Int>(targets);
            foreach (Plot plot in others)
            {
                foreach (Vector3 start in Starts(plot, center))
                {
                    List<Vector2Int> seeds = network.Where(c => Dist(c, start) <= 3f).ToList();
                    if (seeds.Count > 0)
                    {
                        needed.UnionWith(RouteTo(network, seeds, targets));
                    }
                }
            }

            var taken = new HashSet<Vector2Int>();
            var open = new Queue<Vector2Int>();
            foreach (Vector3 start in Starts(old, center))
            {
                foreach (Vector2Int seed in network.Where(c => Dist(c, start) <= 3f && !needed.Contains(c)))
                {
                    if (taken.Add(seed))
                    {
                        open.Enqueue(seed);
                    }
                }
            }

            while (open.Count > 0)
            {
                foreach (Vector2Int n in Around(open.Dequeue()))
                {
                    if (network.Contains(n) && !needed.Contains(n) && taken.Add(n))
                    {
                        open.Enqueue(n);
                    }
                }
            }

            if (taken.Count == 0)
            {
                return 0;
            }

            network.ExceptWith(taken);
            hearth.Zdo.Set(KeyNetwork, string.Join(" ", network.Select(c =>
                c.x.ToString(CultureInfo.InvariantCulture) + "," + c.y.ToString(CultureInfo.InvariantCulture))));

            // Painted back to grass; cells right beside a road still in use keep their paint so its edge stays whole.
            foreach (Vector2Int cell in taken)
            {
                if (needed.Any(k => Mathf.Abs(k.x - cell.x) <= 1 && Mathf.Abs(k.y - cell.y) <= 1))
                {
                    continue;
                }

                var point = new Vector3(cell.x, 0f, cell.y);
                if (!ZoneSystem.instance.GetGroundHeight(point, out float y))
                {
                    continue;
                }

                point.y = y;
                TerrainOp.Settings settings = Designs.TerrainShaper.NewSettings();
                settings.m_paintCleared = true;
                settings.m_paintType = TerrainModifier.PaintType.Reset;
                settings.m_paintRadius = PathBuilder.Width;
                settings.m_paintHeightCheck = false;
                Designs.TerrainShaper.Apply(point, settings);
            }

            return taken.Count;
        }

        // ---------------------------------------------------------------- planning

        /// <summary>
        /// Points from the building's front to the hearth or the nearest laid path, a metre apart. Falls back to the
        /// straight route along the village grid when the search finds no way.
        /// </summary>
        public static List<Vector3> Plan(VillageHearth hearth, float axisYaw, Vector3 building, float buildingRadius, float buildingYaw,
            float doorAngle = 0f, string design = null)
        {
            Vector3 center = hearth.transform.position;
            var state = new VillageState(hearth.Zdo);
            // The hub's path markers are where roads join it; the road from a building goes to the nearest one.
            Plot hub = Hub(center, state.Plots);
            List<(Vector3 At, Vector3 Out)> hubExits = hub != null && Utils.DistanceXZ(hub.Position, building) > 0.5f
                ? Exits(hub.Design, hub.Position, hub.Yaw) : new List<(Vector3, Vector3)>();
            Vector3 front = Door(design, building, buildingRadius, buildingYaw, doorAngle, center);
            if (hubExits.Count > 0)
            {
                front = Door(design, building, buildingRadius, buildingYaw, doorAngle,
                    hubExits.OrderBy(e => Utils.DistanceXZ(e.At, building)).First().At);
            }

            HashSet<Vector2Int> network = PlannedNetwork(hearth); // paths planned but not laid yet count, so they merge

            // Millénaire's parent rule: a building more than 20 m out takes its path to the door of a building nearer
            // the middle (one at least a third closer than the hearth is), whose own path leads on to the hearth. So
            // roads branch out from the middle and every road leads back to it.
            Vector3 goal = hubExits.Count > 0
                ? hubExits.Select(e => e.At + e.Out * 1f).OrderBy(e => Utils.DistanceXZ(e, front)).First()
                : center;
            float toCenter = Utils.DistanceXZ(front, center);
            if (toCenter > 20f)
            {
                Plot parent = state.Plots
                    .Where(p => Utils.DistanceXZ(p.Position, building) > 0.5f &&
                                Utils.DistanceXZ(p.Position, center) < Utils.DistanceXZ(building, center))
                    .OrderBy(p => Utils.DistanceXZ(p.Position, front)).FirstOrDefault();
                if (parent != null)
                {
                    Vector3 parentDoor = Door(parent.Design, parent.Position, parent.Radius, parent.Yaw, Designs.Doors.Angle(parent.Design), front);
                    if (Utils.DistanceXZ(front, parentDoor) * 1.5f < toCenter)
                    {
                        goal = parentDoor;
                    }
                }
            }

            List<Vector3> found = Search(center, front, building, buildingRadius, state.Plots, network, float.MaxValue, goal);
            if (found == null)
            {
                VillheimPlugin.Debug($"{state.Name}: no path found by grid search to the building at {building}; using the straight route.");
                return PathBuilder.Points(center, axisYaw, building, buildingRadius);
            }

            return found;
        }

        /// <summary>
        /// Millenaire's reachability rule: a spot only counts if a walkable way (no water, no cliffs too steep to
        /// climb) leads from its front to the hearth or a laid path.
        /// </summary>
        public static bool Reachable(VillageHearth hearth, Vector3 building, float buildingRadius, float buildingYaw, float doorAngle = 0f)
        {
            Vector3 front = Front(building, buildingRadius, buildingYaw, doorAngle);
            var state = new VillageState(hearth.Zdo);
            return Search(hearth.transform.position, front, building, buildingRadius, state.Plots, Network(hearth), 1.6f) != null;
        }

        /// <summary>
        /// A design's path markers in the world (from the slotting board: "connect roads and paths here"): each one's spot
        /// and the way a road leaves it (outward from the design's middle). Empty for a design without markers.
        /// </summary>
        public static List<(Vector3 At, Vector3 Out)> Exits(string design, Vector3 building, float yaw)
        {
            var exits = new List<(Vector3, Vector3)>();
            Designs.Blueprints.Blueprint blueprint = string.IsNullOrEmpty(design) ? null : Designs.DesignLibrary.ByName(design)?.Blueprint;
            if (blueprint == null)
            {
                return exits;
            }

            Quaternion turn = Quaternion.Euler(0f, yaw, 0f);
            foreach ((string kind, Vector3 position, float markerYaw) in blueprint.Markers)
            {
                if (kind == "path")
                {
                    exits.Add((building + turn * position, turn * Quaternion.Euler(0f, markerYaw, 0f) * Vector3.forward));
                }
            }

            return exits;
        }

        /// <summary>
        /// Where a building's path starts: a metre out from its path marker nearest <paramref name="toward"/> (the way a
        /// road leaves it), or, for a design without markers, just outside the door side Doors guesses.
        /// </summary>
        public static Vector3 Door(string design, Vector3 building, float radius, float yaw, float doorAngle, Vector3 toward)
        {
            List<(Vector3 At, Vector3 Out)> exits = Exits(design, building, yaw);
            if (exits.Count == 0)
            {
                return Front(building, radius, yaw, doorAngle);
            }

            (Vector3 at, Vector3 outward) = exits.OrderBy(e => Utils.DistanceXZ(e.At + e.Out, toward)).First();
            return at + outward * 1f;
        }

        /// <summary>The village's hub (the plot built round the hearth), if any.</summary>
        private static Plot Hub(Vector3 center, IReadOnlyList<Plot> plots) =>
            plots.FirstOrDefault(p => Utils.DistanceXZ(p.Position, center) < Mathf.Max(2f, p.Radius * 0.6f));

        /// <summary>Just outside the building's door (its door side, see Doors).</summary>
        public static Vector3 Front(Vector3 building, float radius, float yaw, float doorAngle) =>
            building + Quaternion.Euler(0f, yaw + doorAngle, 0f) * Vector3.forward * (radius * 0.6f + 0.5f);

        private static List<Vector3> Search(Vector3 hearth, Vector3 start, Vector3 building, float buildingRadius,
            IReadOnlyList<Plot> plots, HashSet<Vector2Int> network, float maxStep = float.MaxValue, Vector3? target = null)
        {
            Vector2Int from = Cell(start);
            Vector2Int goal = Cell(target ?? hearth);
            var heights = new Dictionary<Vector2Int, float>();
            var cost = new Dictionary<Vector2Int, float> { [from] = 0f };
            var came = new Dictionary<Vector2Int, Vector2Int>();
            var direction = new Dictionary<Vector2Int, int> { [from] = -1 };
            var open = new Heap();
            open.Push(from, Heuristic(from, goal));
            int expanded = 0;

            while (open.Count > 0 && expanded++ < MaxNodes)
            {
                Vector2Int current = open.Pop();
                bool arrived = Vector2.Distance(current, goal) <= HearthReach || (network.Contains(current) && current != from);
                if (arrived)
                {
                    return Trace(came, current, heights);
                }

                if (!Height(current, heights, out float here))
                {
                    continue;
                }

                for (int d = 0; d < Steps.Length; d++)
                {
                    Vector2Int next = current + Steps[d];
                    if (Blocked(next, hearth, building, buildingRadius, plots) || !Height(next, heights, out float there))
                    {
                        continue;
                    }

                    float slope = there - here;
                    if (Mathf.Abs(slope) > maxStep)
                    {
                        continue;
                    }

                    float step = 1f + SlopePenalty * slope * slope + (direction[current] >= 0 && direction[current] != d ? TurnPenalty : 0f);
                    if (network.Contains(next))
                    {
                        step *= ReuseFactor;
                    }

                    float total = cost[current] + step;
                    if (cost.TryGetValue(next, out float known) && known <= total)
                    {
                        continue;
                    }

                    cost[next] = total;
                    came[next] = current;
                    direction[next] = d;
                    open.Push(next, total + Heuristic(next, goal));
                }
            }

            return null;
        }

        private static float Heuristic(Vector2Int a, Vector2Int b) => Mathf.Abs(a.x - b.x) + Mathf.Abs(a.y - b.y);

        private static bool Height(Vector2Int cell, Dictionary<Vector2Int, float> heights, out float height)
        {
            if (heights.TryGetValue(cell, out height))
            {
                return !float.IsNaN(height);
            }

            var point = new Vector3(cell.x, 0f, cell.y);
            if (!ZoneSystem.instance.GetGroundHeight(point, out height) || height < ZoneSystem.instance.m_waterLevel + 0.3f)
            {
                heights[cell] = float.NaN;
                return false;
            }

            heights[cell] = height;
            return true;
        }

        /// <summary>Inside another building, inside this building, or on the hearth.</summary>
        private static bool Blocked(Vector2Int cell, Vector3 hearth, Vector3 building, float buildingRadius, IReadOnlyList<Plot> plots)
        {
            var point = new Vector3(cell.x, 0f, cell.y);
            if (Utils.DistanceXZ(point, hearth) < 1.2f || Utils.DistanceXZ(point, building) < buildingRadius * 0.55f)
            {
                return true;
            }

            foreach (Plot plot in plots)
            {
                if (Utils.DistanceXZ(plot.Position, building) > 0.5f && Utils.DistanceXZ(point, plot.Position) < plot.Radius * 0.6f + 0.5f)
                {
                    return true;
                }
            }

            return false;
        }

        private static List<Vector3> Trace(Dictionary<Vector2Int, Vector2Int> came, Vector2Int end, Dictionary<Vector2Int, float> heights)
        {
            var cells = new List<Vector2Int> { end };
            while (came.TryGetValue(cells[cells.Count - 1], out Vector2Int previous))
            {
                cells.Add(previous);
            }

            cells.Reverse();
            return cells.Select(c => new Vector3(c.x, heights.TryGetValue(c, out float y) && !float.IsNaN(y) ? y : 0f, c.y)).ToList();
        }

        /// <summary>Points as "x,z x,z ..." with one decimal, for the path queue.</summary>
        public static string Encode(List<Vector3> points)
        {
            var sb = new StringBuilder();
            foreach (Vector3 p in points)
            {
                if (sb.Length > 0)
                {
                    sb.Append(' ');
                }

                sb.Append(p.x.ToString("0.#", CultureInfo.InvariantCulture)).Append(',').Append(p.z.ToString("0.#", CultureInfo.InvariantCulture));
            }

            return sb.ToString();
        }

        public static List<Vector3> Decode(string text)
        {
            var points = new List<Vector3>();
            foreach (string pair in text.Split(' '))
            {
                int comma = pair.IndexOf(',');
                if (comma > 0 &&
                    float.TryParse(pair.Substring(0, comma), NumberStyles.Float, CultureInfo.InvariantCulture, out float x) &&
                    float.TryParse(pair.Substring(comma + 1), NumberStyles.Float, CultureInfo.InvariantCulture, out float z))
                {
                    points.Add(new Vector3(x, 0f, z));
                }
            }

            return points;
        }

        /// <summary>A small binary heap of cells by priority.</summary>
        private sealed class Heap
        {
            private readonly List<(Vector2Int Cell, float Priority)> _items = new List<(Vector2Int, float)>();

            public int Count => _items.Count;

            public void Push(Vector2Int cell, float priority)
            {
                _items.Add((cell, priority));
                int i = _items.Count - 1;
                while (i > 0)
                {
                    int parent = (i - 1) / 2;
                    if (_items[parent].Priority <= _items[i].Priority)
                    {
                        break;
                    }

                    (_items[parent], _items[i]) = (_items[i], _items[parent]);
                    i = parent;
                }
            }

            public Vector2Int Pop()
            {
                Vector2Int top = _items[0].Cell;
                int last = _items.Count - 1;
                _items[0] = _items[last];
                _items.RemoveAt(last);
                int i = 0;
                while (true)
                {
                    int left = i * 2 + 1;
                    int right = left + 1;
                    int smallest = i;
                    if (left < _items.Count && _items[left].Priority < _items[smallest].Priority) smallest = left;
                    if (right < _items.Count && _items[right].Priority < _items[smallest].Priority) smallest = right;
                    if (smallest == i)
                    {
                        break;
                    }

                    (_items[smallest], _items[i]) = (_items[i], _items[smallest]);
                    i = smallest;
                }

                return top;
            }
        }
    }
}
