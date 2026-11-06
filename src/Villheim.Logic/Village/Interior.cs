using System.Collections.Generic;
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

            /// <summary>Part of settling in (beds, the workbench): made before the village grows any further.</summary>
            public bool Essential;
        }

        /// <summary>A home with a radius under this is a small home with one bed.</summary>
        public const float SmallHomeRadius = 9f;

        private const float Step = 0.75f;
        private const int EnoughCandidates = 24;
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
                    yield return new Want { Prefab = "bed", Name = "bed", Count = BedsInHome(plot), Essential = true };
                    yield return new Want { Prefab = "piece_chest_wood", Name = "chest", Count = 1 };
                    yield return new Want { Prefab = "piece_chair", Name = "chair", Count = BedsInHome(plot) };
                    if (tier >= 1) yield return new Want { Prefab = "piece_table", Name = "table", Count = 1 };
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
                if (cached.Found && Fits(prefab, prefabName, spot, rotation))
                {
                    return true;
                }

                if (!cached.Found)
                {
                    return false;
                }
            }

            bool found = Search(plot, prefab, prefabName, out spot, out rotation);
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

        private static bool Search(Plot plot, GameObject prefab, string prefabName, out Vector3 spot, out Quaternion rotation)
        {
            spot = plot.Position;
            rotation = Quaternion.identity;
            float reach = Mathf.Max(3f, plot.Radius * 0.7f);
            int cells = Mathf.CeilToInt(reach / Step);
            Quaternion plotTurn = Quaternion.Euler(0f, plot.Yaw, 0f);
            var candidates = new List<(float Score, Vector3 Spot, Quaternion Rotation)>();

            for (int x = -cells; x <= cells && candidates.Count < EnoughCandidates; x++)
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
                    if (NearDoor(point))
                    {
                        continue;
                    }

                    // Cheap tests first (does it fit), the game's cover test (many rays) only for spots that fit.
                    var fits = new List<Quaternion>();
                    for (int turn = 0; turn < 4; turn++)
                    {
                        Quaternion candidate = plotTurn * Quaternion.Euler(0f, 90f * turn, 0f);
                        if (Fits(prefab, prefabName, point, candidate))
                        {
                            fits.Add(candidate);
                        }
                    }

                    if (fits.Count == 0)
                    {
                        continue;
                    }

                    Cover.GetCoverForPoint(point + Vector3.up * 1f, out float cover, out bool underRoof);
                    if (!underRoof || cover < MinCover)
                    {
                        continue;
                    }

                    // Back to the wall: keep the turn with a wall closest behind.
                    foreach (Quaternion candidate in fits)
                    {
                        float behind = WallBehind(point, candidate);
                        float score = behind + (1f - cover) * 2f + local.magnitude * 0.05f;
                        candidates.Add((score, point, candidate));
                    }

                    if (candidates.Count >= EnoughCandidates)
                    {
                        break;
                    }
                }
            }

            if (candidates.Count == 0)
            {
                return false;
            }

            candidates.Sort((a, b) => a.Score.CompareTo(b.Score));
            spot = candidates[0].Spot;
            rotation = candidates[0].Rotation;
            return true;
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

        private static bool NearDoor(Vector3 point)
        {
            foreach (Collider collider in Physics.OverlapSphere(point, DoorClearance, LayerMask.GetMask("piece", "piece_nonsolid")))
            {
                if (collider.GetComponentInParent<Door>() != null)
                {
                    return true;
                }
            }

            return false;
        }

        /// <summary>The piece's box at that spot is empty, with a little headroom and a walkable strip in front.</summary>
        private static bool Fits(GameObject prefab, string prefabName, Vector3 spot, Quaternion rotation)
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
            return !Physics.CheckBox(front, new Vector3(0.35f, 0.8f, 0.35f), rotation, SolidMask, QueryTriggerInteraction.Ignore);
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
