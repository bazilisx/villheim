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

        // ---------------------------------------------------------------- planning

        /// <summary>
        /// Points from the building's front to the hearth or the nearest laid path, a metre apart. Falls back to the
        /// straight route along the village grid when the search finds no way.
        /// </summary>
        public static List<Vector3> Plan(VillageHearth hearth, float axisYaw, Vector3 building, float buildingRadius, float buildingYaw,
            float doorAngle = 0f)
        {
            Vector3 center = hearth.transform.position;
            Vector3 front = Front(building, buildingRadius, buildingYaw, doorAngle);
            var state = new VillageState(hearth.Zdo);
            HashSet<Vector2Int> network = Network(hearth);

            // Millénaire's parent rule: a building more than 20 m out takes its path to the door of a building nearer
            // the middle (one at least a third closer than the hearth is), whose own path leads on to the hearth. So
            // roads branch out from the middle and every road leads back to it.
            Vector3 goal = center;
            float toCenter = Utils.DistanceXZ(front, center);
            if (toCenter > 20f)
            {
                Plot parent = state.Plots
                    .Where(p => Utils.DistanceXZ(p.Position, building) > 0.5f &&
                                Utils.DistanceXZ(p.Position, center) < Utils.DistanceXZ(building, center))
                    .OrderBy(p => Utils.DistanceXZ(p.Position, front)).FirstOrDefault();
                if (parent != null)
                {
                    Vector3 parentDoor = Front(parent.Position, parent.Radius, parent.Yaw, Designs.Doors.Angle(parent.Design));
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
