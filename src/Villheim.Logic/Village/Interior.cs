using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Designs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// What goes inside a finished building, and where. Like Millenaire's building plans, each kind of building has
    /// its own furnishings and residents:
    ///
    /// - a small home one bed, a larger home two (the only essentials: a village grows no further until every home
    ///   has its beds),
    /// - the longhouse (hub) a table and benches,
    /// - a workshop its workbench, a storehouse its chests.
    ///
    /// Beds and workbenches always go under a roof, on the ground floor, at a spot the game itself counts as covered
    /// (the same test a workbench uses before it lets you craft), clear of doors, and with their back to a wall where
    /// there is one. Beds that came with the design count too.
    /// </summary>
    internal static class Interior
    {
        internal struct Want
        {
            public string Prefab;
            public string Name;
            public int Count;

            /// <summary>Part of settling in (a home's beds and furnishing): made before the village grows any further.</summary>
            public bool Essential;
        }

        /// <summary>A home with a radius under this is a small home with one bed.</summary>
        public const float SmallHomeRadius = 9f;

        private const float Step = 0.75f;
        private const int EnoughCandidates = 6;
        private const int MaxCoverTests = 16;
        private const float MinCover = 0.7f;
        private const float DoorClearance = 1.8f;

        private static readonly Dictionary<string, (float Time, bool Found, Vector3 Spot, Quaternion Rotation)> SpotCache =
            new Dictionary<string, (float, bool, Vector3, Quaternion)>();

        private static int _solidMask;

        private static int SolidMask => _solidMask != 0
            ? _solidMask
            : _solidMask = LayerMask.GetMask("Default", "static_solid", "Default_small", "piece", "piece_nonsolid", "terrain", "vehicle");

        /// <summary>
        /// Furnishings this building should have, in the order they are made, like a player settling in: beds first
        /// (essential), then a chest, seats and a table for comfort, a little more as the village grows
        /// (<paramref name="tier"/>: 0 camp, 1 hamlet, 2 village, 3 town).
        /// </summary>
        public static IEnumerable<Want> WantsFor(Plot plot, int tier)
        {
            switch (plot.Role)
            {
                case nameof(Role.Hub):
                    yield return new Want { Prefab = "piece_table", Name = "table", Count = 1 };
                    yield return new Want { Prefab = "piece_bench01", Name = "bench", Count = tier >= 1 ? 2 : 1 };
                    if (tier >= 1) yield return new Want { Prefab = "piece_chest_wood", Name = "chest", Count = 1 };
                    break;
                case nameof(Role.Workshop):
                    yield return new Want { Prefab = "piece_workbench", Name = "workbench", Count = 1 };
                    yield return new Want { Prefab = "piece_chest_wood", Name = "chest", Count = 1 };
                    break;
                case nameof(Role.Storage):
                    yield return new Want { Prefab = "piece_chest_wood", Name = "chest", Count = tier >= 2 ? 3 : 2 };
                    break;
                case nameof(Role.Farm):
                    break;
                default:
                    // A home is furnished before the village starts its next building (Tyler: the second house went up
                    // with nothing in the first): its beds first, then its chest, chairs and table.
                    yield return new Want { Prefab = "bed", Name = "bed", Count = BedsInHome(plot), Essential = true };
                    yield return new Want { Prefab = "piece_chest_wood", Name = "chest", Count = 1, Essential = true };
                    yield return new Want { Prefab = "piece_chair", Name = "chair", Count = BedsInHome(plot), Essential = true };
                    if (tier >= 1) yield return new Want { Prefab = "piece_table", Name = "table", Count = 1, Essential = true };
                    break;
            }
        }

        /// <summary>One bed for a small home, two for a larger one.</summary>
        public static int BedsInHome(Plot plot) => plot.Radius < SmallHomeRadius ? 1 : 2;

        /// <summary>How many pieces of this kind (any bed, for beds) stand inside the building.</summary>
        public static int CountInside(Plot plot, string prefab)
        {
            int count = 0;
            var seen = new HashSet<GameObject>();
            foreach (Collider collider in Physics.OverlapSphere(plot.Position, plot.Radius * 0.75f, LayerMask.GetMask("piece", "piece_nonsolid")))
            {
                ZNetView view = collider.GetComponentInParent<ZNetView>();
                if (view == null || !seen.Add(view.gameObject))
                {
                    continue;
                }

                bool match = prefab == "bed" ? view.GetComponent<Bed>() != null : Utils.GetPrefabName(view.gameObject) == prefab;
                if (match)
                {
                    count++;
                }
            }

            return count;
        }

        /// <summary>
        /// A covered spot on the building's ground floor where the piece fits, or false. Results are kept for a minute
        /// per building and piece, so a building with no room isn't searched again every few seconds.
        /// </summary>
        public static bool FindSpot(Plot plot, GameObject prefab, string prefabName, out Vector3 spot, out Quaternion rotation)
        {
            string key = $"{plot.Position}|{prefabName}";
            if (SpotCache.TryGetValue(key, out var cached) && Time.time - cached.Time < 60f)
            {
                spot = cached.Spot;
                rotation = cached.Rotation;
                if (cached.Found && Fits(prefab, prefabName, spot, rotation, false))
                {
                    return true;
                }

                if (!cached.Found)
                {
                    return false;
                }
            }

            bool found = Search(plot, prefab, prefabName, out spot, out rotation, false);
            if (!found && prefabName.IndexOf("bed", System.StringComparison.OrdinalIgnoreCase) >= 0)
            {
                // A bed comes first in a home (T-105): with no ideal spot, any covered spot that fits will do.
                found = Search(plot, prefab, prefabName, out spot, out rotation, true);
            }

            if (SpotCache.Count > 64)
            {
                SpotCache.Clear();
            }

            SpotCache[key] = (Time.time, found, spot, rotation);
            if (!found)
            {
                VillheimPlugin.Debug($"No covered room for a {prefabName} in the {plot.Design} at {plot.Position}.");
            }

            return found;
        }

        private static bool Search(Plot plot, GameObject prefab, string prefabName, out Vector3 spot, out Quaternion rotation, bool relaxed)
        {
            using (Perf.On ? Perf.Time($"Interior.Search {prefabName} in {plot.Design}") : null)
            {
                return SearchOnce(plot, prefab, prefabName, out spot, out rotation, relaxed);
            }
        }

        /// <summary>
        /// The cheap tests (floor, doors, does it fit, a roof straight overhead) run on every cell; the game's cover test
        /// (a few hundred rays) only on the best few that pass them. It had run on every cell that fit, which made the
        /// search for a chest or a chair in a cluttered home a lag spike once the notice board was done and the village
        /// went on to furnishing (Tyler: lag when the board finished).
        /// </summary>
        private static bool SearchOnce(Plot plot, GameObject prefab, string prefabName, out Vector3 spot, out Quaternion rotation, bool relaxed)
        {
            spot = plot.Position;
            rotation = Quaternion.identity;
            float reach = Mathf.Max(3f, plot.Radius * 0.7f);
            List<(Vector3 A, Vector3 B)> doorways = Doorways(plot);
            List<Vector3> doors = DoorsNear(plot);
            Bounds? measured = BuildOrder.Measure(prefab, prefabName, Vector3.zero, Quaternion.identity, prefab.transform.localScale);
            float itemReach = measured.HasValue ? Mathf.Max(measured.Value.extents.x, measured.Value.extents.z) : 1f;
            int cells = Mathf.CeilToInt(reach / Step);
            Quaternion plotTurn = Quaternion.Euler(0f, plot.Yaw, 0f);
            var fitting = new List<(float Score, Vector3 Spot, Quaternion Rotation)>();
            int roofMask = LayerMask.GetMask("piece");

            for (int x = -cells; x <= cells; x++)
            {
                for (int z = -cells; z <= cells; z++)
                {
                    Vector3 local = new Vector3(x * Step, 0f, z * Step);
                    if (local.magnitude > reach)
                    {
                        continue;
                    }

                    Vector3 point = plot.Position + plotTurn * local;
                    if (!Floor(plot, point, out float floorY))
                    {
                        continue;
                    }

                    point.y = floorY;
                    if (NearDoor(doors, point) || InDoorway(doorways, point, itemReach) ||
                        !Physics.Raycast(point + Vector3.up * 1f, Vector3.up, 10f, roofMask, QueryTriggerInteraction.Ignore))
                    {
                        continue;
                    }

                    for (int turn = 0; turn < 4; turn++)
                    {
                        Quaternion candidate = plotTurn * Quaternion.Euler(0f, 90f * turn, 0f);
                        if (Fits(prefab, prefabName, point, candidate, !relaxed))
                        {
                            // Back to the wall: a wall close behind scores best.
                            fitting.Add((WallBehind(point, candidate) + local.magnitude * 0.05f, point, candidate));
                        }
                    }
                }
            }

            fitting.Sort((a, b) => a.Score.CompareTo(b.Score));
            var covered = new Dictionary<Vector3, float>();
            (float Score, Vector3 Spot, Quaternion Rotation)? best = null;
            int tested = 0;
            int passed = 0;
            foreach ((float score, Vector3 point, Quaternion candidate) in fitting)
            {
                if (!covered.TryGetValue(point, out float cover))
                {
                    if (tested >= MaxCoverTests)
                    {
                        break;
                    }

                    tested++;
                    Cover.GetCoverForPoint(point + Vector3.up * 1f, out cover, out bool underRoof);
                    covered[point] = cover = underRoof ? cover : -1f;
                }

                if (cover < (relaxed ? MinCover * 0.6f : MinCover))
                {
                    continue;
                }

                passed++;
                float total = score + (1f - cover) * 2f;
                if (!best.HasValue || total < best.Value.Score)
                {
                    best = (total, point, candidate);
                }

                if (passed >= EnoughCandidates)
                {
                    break;
                }
            }

            if (!best.HasValue)
            {
                return false;
            }

            spot = best.Value.Spot;
            rotation = best.Value.Rotation;
            return true;
        }

        /// <summary>The doors in and round the building, looked for once per search.</summary>
        private static List<Vector3> DoorsNear(Plot plot)
        {
            var doors = new List<Vector3>();
            foreach (Collider collider in Physics.OverlapSphere(plot.Position, plot.Radius + DoorClearance, LayerMask.GetMask("piece", "piece_nonsolid")))
            {
                Door door = collider.GetComponentInParent<Door>();
                if (door != null && !doors.Contains(door.transform.position))
                {
                    doors.Add(door.transform.position);
                }
            }

            return doors;
        }

        /// <summary>The ground floor under the point: a piece or the ground, near the building's own floor height.</summary>
        private static bool Floor(Plot plot, Vector3 point, out float y)
        {
            y = 0f;
            Vector3 from = new Vector3(point.x, plot.Position.y + 2f, point.z);
            if (!Physics.Raycast(from, Vector3.down, out RaycastHit hit, 4f, SolidMask, QueryTriggerInteraction.Ignore))
            {
                return false;
            }

            y = hit.point.y;
            return y > plot.Position.y - 1f && y < plot.Position.y + 1.5f;
        }

        private static bool NearDoor(List<Vector3> doors, Vector3 point)
        {
            foreach (Vector3 door in doors)
            {
                if (Vector3.Distance(door, point) < DoorClearance + 0.5f)
                {
                    return true;
                }
            }

            return false;
        }

        // The blueprint lab's door rule (lib/checks.js): a doorway needs its opening clear for a metre in front and behind,
        // 0.45 m to each side of its middle. Here the way in reaches 2.5 m into the room, so a chest or chair never sits
        // in it (T-105: a chest and a chair blocked a home's door).
        private const float DoorCorridor = 1f;
        private const float DoorHalfWidth = 0.45f;
        private const float DoorInside = 2.5f;

        /// <summary>
        /// The ways in: from each door piece, and from the design's door side (its path markers, or Doors.Angle), as a
        /// line from a metre outside to DoorInside metres in.
        /// </summary>
        private static List<(Vector3 A, Vector3 B)> Doorways(Plot plot)
        {
            var ways = new List<(Vector3, Vector3)>();
            Vector3 center = plot.Position;
            foreach ((Vector3 at, Vector3 out_) in PathPlanner.Exits(plot.Design, plot.Position, plot.Yaw))
            {
                ways.Add((at + out_ * DoorCorridor, at - out_ * (DoorInside + 1f)));
            }

            if (ways.Count == 0)
            {
                Vector3 front = PathPlanner.Front(plot.Position, plot.Radius, plot.Yaw, Designs.Doors.Angle(plot.Design));
                Vector3 inward = (center - front).Horizontal();
                inward = inward.sqrMagnitude > 0.01f ? inward.normalized : Vector3.forward;
                ways.Add((front - inward * DoorCorridor, front + inward * (0.5f + DoorInside)));
            }

            foreach (Collider collider in Physics.OverlapSphere(center, plot.Radius * 0.8f, LayerMask.GetMask("piece", "piece_nonsolid")))
            {
                Door door = collider.GetComponentInParent<Door>();
                if (door == null)
                {
                    continue;
                }

                Vector3 normal = door.transform.forward.Horizontal().normalized;
                Vector3 p = door.transform.position;
                if (!ways.Any(w => Vector3.Distance(w.Item1, p - normal * DoorCorridor) < 0.5f))
                {
                    // Both ways through: which side is in depends on the door.
                    ways.Add((p - normal * (DoorCorridor + DoorInside - 1f), p + normal * (DoorCorridor + DoorInside - 1f)));
                }
            }

            return ways;
        }

        private static bool InDoorway(List<(Vector3 A, Vector3 B)> ways, Vector3 point, float itemReach)
        {
            foreach ((Vector3 a, Vector3 b) in ways)
            {
                Vector3 ab = (b - a).Horizontal();
                float t = ab.sqrMagnitude > 0.001f ? Mathf.Clamp01(Vector3.Dot((point - a).Horizontal(), ab) / ab.sqrMagnitude) : 0f;
                if (Utils.DistanceXZ(point, a + ab * t) < DoorHalfWidth + itemReach + 0.2f)
                {
                    return true;
                }
            }

            return false;
        }

        /// <summary>The piece's box at that spot is empty, with a little headroom and a walkable strip in front.</summary>
        private static bool Fits(GameObject prefab, string prefabName, Vector3 spot, Quaternion rotation, bool roomInFront = true)
        {
            Bounds? measured = BuildOrder.Measure(prefab, prefabName, Vector3.zero, Quaternion.identity, prefab.transform.localScale);
            Bounds local = measured ?? new Bounds(new Vector3(0f, 0.5f, 0f), new Vector3(1.5f, 1f, 2f));
            Vector3 half = local.extents + new Vector3(0.05f, 0f, 0.05f);
            half.y = Mathf.Max(0.3f, half.y - 0.1f);
            Vector3 center = spot + rotation * new Vector3(local.center.x, local.extents.y + 0.1f, local.center.z);
            if (Physics.CheckBox(center, half, rotation, SolidMask, QueryTriggerInteraction.Ignore))
            {
                return false;
            }

            // Room to stand in front of it.
            Vector3 front = spot + rotation * new Vector3(local.center.x, 1f, local.max.z + 0.5f);
            return !roomInFront || !Physics.CheckBox(front, new Vector3(0.35f, 0.8f, 0.35f), rotation, SolidMask, QueryTriggerInteraction.Ignore);
        }

        /// <summary>How far behind the spot the nearest wall is (5 when there is none within reach).</summary>
        private static float WallBehind(Vector3 spot, Quaternion rotation)
        {
            Vector3 origin = spot + Vector3.up * 0.8f;
            Vector3 back = rotation * Vector3.back;
            return Physics.Raycast(origin, back, out RaycastHit hit, 5f, LayerMask.GetMask("piece"), QueryTriggerInteraction.Ignore)
                ? hit.distance
                : 5f;
        }
    }
}
