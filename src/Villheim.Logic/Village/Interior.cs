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
        private const int EnoughCandidates = 4;
        private const int MaxCoverTests = 8;
        private const float MinCover = 0.7f;
        private const float DoorClearance = 1.8f;

        // Forced: a bed's fallback spot (the design's own, the middle of the floor), kept even though it doesn't fit.
        private static readonly Dictionary<string, (float Time, bool Found, Vector3 Spot, Quaternion Rotation, bool Forced)> SpotCache =
            new Dictionary<string, (float, bool, Vector3, Quaternion, bool)>();

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
            // Generated designs (the test pool and approved lab designs) bring their own furniture, and their missing pieces
            // are put back where the design has them. Adding more here dropped benches onto tables, put chests in the
            // middle of the storehouse and a rebuilt bed outside (2026-11-09 test).
            if (FurnishedByDesign(plot))
            {
                yield break;
            }

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
        public static bool FurnishedByDesign(Plot plot)
        {
            string file = (DesignLibrary.ByName(plot.Design)?.Blueprint?.File ?? "").Replace('\\', '/').ToLowerInvariant();
            return file.Contains("/testpool-") || file.Contains("/approved-generated/");
        }

        public static int BedsInHome(Plot plot) => plot.Radius < SmallHomeRadius ? 1 : 2;

        /// <summary>How many pieces of this kind (any bed, for beds) stand inside the building.</summary>
        public static int CountInside(Plot plot, string prefab)
        {
            // Kept 2 s per building and piece, and read from the village's piece list (lag cluster B): the old sphere of
            // colliders walked every collider of the house for each want, each time the next job was looked for.
            string key = $"{Mathf.RoundToInt(plot.Position.x)}:{Mathf.RoundToInt(plot.Position.z)}:{plot.Design}:{prefab}";
            if (CountCache.TryGetValue(key, out var kept) && Time.time - kept.At < 2f)
            {
                return kept.Count;
            }

            int count = 0;
            CountPieces.Clear();
            PieceIndex.InRadius(plot.Position, plot.Radius * 0.75f + 1f, CountPieces);
            foreach (Piece piece in CountPieces)
            {
                if (piece == null)
                {
                    continue;
                }

                bool match = prefab == "bed" ? piece.GetComponent<Bed>() != null : Utils.GetPrefabName(piece.gameObject) == prefab;
                if (match)
                {
                    count++;
                }
            }

            CountCache[key] = (Time.time, count);
            return count;
        }

        private static readonly Dictionary<string, (float At, int Count)> CountCache = new Dictionary<string, (float, int)>();
        private static readonly List<Piece> CountPieces = new List<Piece>();

        /// <summary>Forget the kept counts after a piece is made, so the next want sees it at once.</summary>
        public static void ForgetCounts() => CountCache.Clear();

        /// <summary>
        /// A covered spot on the building's ground floor where the piece fits, or false. Results are kept for a minute
        /// per building and piece, so a building with no room isn't searched again every few seconds.
        ///
        /// A bed always gets a spot (Tyler: the first house got a chair and a chest and no bed): the ideal search, then
        /// one that lets go of the room in front and asks less cover, then one closer to the doors, then the design's
        /// own bed, then the best spot that fits under any roof, then the middle of the floor. Each step that fails is
        /// written to the log with DebugLog on.
        ///
        /// Searches are spread out: at most one building is searched each frame (they cost a few hundred rays each,
        /// and several in one frame were the lag when a chest went up next to the notice board). One asked for after
        /// that is put off: false, with <see cref="Deferred"/> set.
        /// </summary>
        public static bool FindSpot(Plot plot, GameObject prefab, string prefabName, out Vector3 spot, out Quaternion rotation)
        {
            Deferred = false;
            string key = $"{plot.Position}|{prefabName}";
            if (SpotCache.TryGetValue(key, out var cached) && Time.time - cached.Time < 60f)
            {
                spot = cached.Spot;
                rotation = cached.Rotation;
                if (cached.Found && (cached.Forced || Fits(prefab, prefabName, spot, rotation, false)))
                {
                    return true;
                }

                if (!cached.Found)
                {
                    return false;
                }
            }

            if (_searchFrame == Time.frameCount)
            {
                Deferred = true;
                spot = plot.Position;
                rotation = Quaternion.identity;
                return false;
            }

            _searchFrame = Time.frameCount;
            bool bed = IsBed(prefab, prefabName);
            bool forced = false;
            // A bed's searches, from the ideal to the loosest, one a frame (each is a few hundred rays).
            Strictness tier = bed && BedTier.TryGetValue(key, out var started) && Time.time - started.Time < 30f ? started.Tier : Strictness.Ideal;
            bool found = Search(plot, prefab, prefabName, out spot, out rotation, tier);
            if (!found && bed && tier < Strictness.Loose)
            {
                Perf.Debug($"No {tier} spot for a bed in the {plot.Design} at {plot.Position}: {_lastReasons}. Trying looser.");
                BedTier[key] = (Time.time, tier + 1);
                Deferred = true;
                return false;
            }

            BedTier.Remove(key);
            if (!found && bed)
            {
                if (DesignBed(plot, out spot, out rotation))
                {
                    Perf.Debug($"No bed spot fits in the {plot.Design} ({_lastReasons}); using the design's own bed place at {spot}.");
                    found = forced = true;
                }

                if (!found)
                {
                    found = Search(plot, prefab, prefabName, out spot, out rotation, Strictness.AnyRoof);
                    forced = found;
                    if (found)
                    {
                        Perf.Debug($"The bed in the {plot.Design} goes at {spot}, a spot that fits with little cover.");
                    }
                }

                if (!found && Floor(plot, plot.Position, out float middle))
                {
                    spot = new Vector3(plot.Position.x, middle, plot.Position.z);
                    rotation = Quaternion.Euler(0f, plot.Yaw, 0f);
                    found = forced = true;
                    Perf.Debug($"Nothing fits a bed in the {plot.Design} ({_lastReasons}); it goes in the middle of the floor.");
                }
            }

            if (SpotCache.Count > 64)
            {
                SpotCache.Clear();
            }

            SpotCache[key] = (Time.time, found, spot, rotation, forced);
            if (!found)
            {
                Perf.Debug($"No covered room for a {prefabName} in the {plot.Design} at {plot.Position}: {_lastReasons}.");
            }

            return found;
        }

        /// <summary>The last FindSpot was put off to a later frame (another building was searched this frame).</summary>
        public static bool Deferred { get; private set; }

        private static int _searchFrame = -1;
        private static readonly Dictionary<string, (float Time, Strictness Tier)> BedTier = new Dictionary<string, (float, Strictness)>();
        private static string _lastReasons = "";

        private static bool IsBed(GameObject prefab, string prefabName) =>
            prefab.GetComponent<Bed>() != null || prefabName.IndexOf("bed", System.StringComparison.OrdinalIgnoreCase) >= 0;

        private enum Strictness
        {
            Ideal,
            Relaxed,
            Loose,
            AnyRoof,
        }

        private static readonly Dictionary<string, (bool Found, Vector3 Spot, Quaternion Rotation)> DesignBeds =
            new Dictionary<string, (bool, Vector3, Quaternion)>();

        /// <summary>Where the design itself has a bed (a blueprint's or a location's own), free of any bed now.</summary>
        private static bool DesignBed(Plot plot, out Vector3 spot, out Quaternion rotation)
        {
            string key = $"{plot.Design}|{plot.Position}|{plot.Yaw}";
            if (!DesignBeds.TryGetValue(key, out var found))
            {
                found = (false, plot.Position, Quaternion.identity);
                Quaternion turn = Quaternion.Euler(0f, plot.Yaw, 0f);
                try
                {
                    foreach ((Vector3 local, Quaternion localRotation) in BedsInDesign(plot.Design))
                    {
                        Vector3 world = plot.Position + turn * local;
                        if (!BedNear(world))
                        {
                            found = (true, world, turn * localRotation);
                            break;
                        }
                    }
                }
                catch (System.Exception e)
                {
                    Perf.Debug($"The {plot.Design}'s own beds could not be read: {e.Message}");
                }

                if (DesignBeds.Count > 32)
                {
                    DesignBeds.Clear();
                }

                DesignBeds[key] = found;
            }

            spot = found.Spot;
            rotation = found.Rotation;
            return found.Found && !BedNear(spot);
        }

        private static IEnumerable<(Vector3, Quaternion)> BedsInDesign(string design)
        {
            var beds = new List<(Vector3, Quaternion)>();
            bool IsBedPrefab(string name)
            {
                GameObject prefab = ZNetScene.instance ? ZNetScene.instance.GetPrefab(name) : null;
                return prefab != null && prefab.GetComponent<Bed>() != null;
            }

            Blueprints.Blueprint blueprint = Blueprints.Find(design);
            if (blueprint != null)
            {
                foreach (Blueprints.Piece piece in blueprint.Pieces)
                {
                    if (IsBedPrefab(piece.Prefab))
                    {
                        beds.Add((piece.Position, piece.Rotation));
                    }
                }

                return beds;
            }

            ZoneSystem.ZoneLocation location = DesignLibrary.Find(design);
            if (location == null)
            {
                return beds;
            }

            AssetGuard.Load(location);
            try
            {
                GameObject asset = location.m_prefab.Asset;
                if (asset != null)
                {
                    foreach (ZNetView view in asset.GetComponentsInChildren<ZNetView>(true))
                    {
                        if (view.gameObject != asset && IsBedPrefab(Utils.GetPrefabName(view.gameObject)))
                        {
                            beds.Add((asset.transform.InverseTransformPoint(view.transform.position),
                                Quaternion.Inverse(asset.transform.rotation) * view.transform.rotation));
                        }
                    }
                }
            }
            finally
            {
                location.m_prefab.Release();
            }

            return beds;
        }

        private static bool BedNear(Vector3 spot)
        {
            foreach (Collider collider in Physics.OverlapSphere(spot, 0.8f, LayerMask.GetMask("piece", "piece_nonsolid")))
            {
                if (collider.GetComponentInParent<Bed>() != null)
                {
                    return true;
                }
            }

            return false;
        }

        private static bool Search(Plot plot, GameObject prefab, string prefabName, out Vector3 spot, out Quaternion rotation, Strictness strictness)
        {
            using (Perf.On ? Perf.Time($"Interior.Search {prefabName} in {plot.Design} ({strictness})") : null)
            {
                return SearchOnce(plot, prefab, prefabName, out spot, out rotation, strictness);
            }
        }

        /// <summary>
        /// The cheap tests (floor, doors, does it fit, a roof straight overhead) run on every cell; the game's cover test
        /// (a few hundred rays) only on the best few that pass them. It had run on every cell that fit, which made the
        /// search for a chest or a chair in a cluttered home a lag spike once the notice board was done and the village
        /// went on to furnishing (Tyler: lag when the board finished).
        /// </summary>
        private static bool SearchOnce(Plot plot, GameObject prefab, string prefabName, out Vector3 spot, out Quaternion rotation, Strictness strictness)
        {
            spot = plot.Position;
            rotation = Quaternion.identity;
            bool relaxed = strictness != Strictness.Ideal;
            float reach = Mathf.Max(3f, plot.Radius * 0.7f);
            List<(Vector3 A, Vector3 B)> doorways = Doorways(plot);
            List<Vector3> doors = DoorsNear(plot);
            Bounds? measured = BuildOrder.Measure(prefab, prefabName, Vector3.zero, Quaternion.identity, prefab.transform.localScale);
            Bounds footprint = measured ?? new Bounds(new Vector3(0f, 0.5f, 0f), new Vector3(1.5f, 1f, 2f));
            // The way through a door is kept clear by the piece's own outline, turned as it would stand: a bed along a
            // side wall is fine. The old test took the piece's longest half-length as a radius round its middle, which
            // left no room for a 2 m bed anywhere in a small home while a chair and a chest still fitted.
            float corridor = strictness >= Strictness.Loose ? DoorHalfWidth : DoorHalfWidth + 0.2f;
            float doorGap = strictness >= Strictness.Loose ? 0.4f : 0.9f;
            float minCover = strictness == Strictness.Ideal ? MinCover : strictness == Strictness.AnyRoof ? 0f : MinCover * 0.6f;
            float step = strictness >= Strictness.Loose ? 0.5f : Step;
            int noFloor = 0, byDoor = 0, noRoof = 0, noFit = 0, lowCover = 0;
            int cells = Mathf.CeilToInt(reach / step);
            Quaternion plotTurn = Quaternion.Euler(0f, plot.Yaw, 0f);
            var fitting = new List<(float Score, Vector3 Spot, Quaternion Rotation)>();
            int roofMask = LayerMask.GetMask("piece");

            for (int x = -cells; x <= cells; x++)
            {
                for (int z = -cells; z <= cells; z++)
                {
                    Vector3 local = new Vector3(x * step, 0f, z * step);
                    if (local.magnitude > reach)
                    {
                        continue;
                    }

                    Vector3 point = plot.Position + plotTurn * local;
                    if (!Floor(plot, point, out float floorY))
                    {
                        noFloor++;
                        continue;
                    }

                    point.y = floorY;
                    if (!Physics.Raycast(point + Vector3.up * 1f, Vector3.up, 10f, roofMask, QueryTriggerInteraction.Ignore))
                    {
                        noRoof++;
                        continue;
                    }

                    for (int turn = 0; turn < 4; turn++)
                    {
                        Quaternion candidate = plotTurn * Quaternion.Euler(0f, 90f * turn, 0f);
                        if (NearDoor(doors, point, candidate, footprint, doorGap) || InDoorway(doorways, point, candidate, footprint, corridor))
                        {
                            byDoor++;
                            continue;
                        }

                        if (Fits(prefab, prefabName, point, candidate, !relaxed))
                        {
                            // Back to the wall: a wall close behind scores best.
                            fitting.Add((WallBehind(point, candidate) + local.magnitude * 0.05f, point, candidate));
                        }
                        else
                        {
                            noFit++;
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

                if (cover < minCover && !(strictness == Strictness.AnyRoof && cover >= -0.5f))
                {
                    lowCover++;
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

            _lastReasons = $"{fitting.Count} fitting of {noFloor + noRoof + byDoor + noFit + fitting.Count} tried " +
                           $"(no floor {noFloor}, no roof {noRoof}, in a doorway {byDoor}, no room {noFit}, too little cover {lowCover})";
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

        /// <summary>The piece's outline, turned as it would stand, comes within <paramref name="gap"/> of a door.</summary>
        private static bool NearDoor(List<Vector3> doors, Vector3 point, Quaternion rotation, Bounds footprint, float gap)
        {
            foreach (Vector3 door in doors)
            {
                if (Mathf.Abs(door.y - point.y) < 2.5f && OutlineDistance(point, rotation, footprint, door, door) < gap)
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

        /// <summary>The piece's outline, turned as it would stand, comes within <paramref name="corridor"/> of a way through a door.</summary>
        private static bool InDoorway(List<(Vector3 A, Vector3 B)> ways, Vector3 point, Quaternion rotation, Bounds footprint, float corridor)
        {
            foreach ((Vector3 a, Vector3 b) in ways)
            {
                if (OutlineDistance(point, rotation, footprint, a, b) < corridor)
                {
                    return true;
                }
            }

            return false;
        }

        /// <summary>
        /// Distance, seen from above, between the line a-b and the piece's outline (its measured box, at the spot, turned
        /// by the rotation): 0 when the line crosses it.
        /// </summary>
        private static float OutlineDistance(Vector3 spot, Quaternion rotation, Bounds footprint, Vector3 a, Vector3 b)
        {
            Quaternion back = Quaternion.Inverse(rotation);
            Vector3 la = back * (a - spot);
            Vector3 lb = back * (b - spot);
            var p = new Vector2(la.x, la.z);
            var q = new Vector2(lb.x, lb.z);
            var min = new Vector2(footprint.min.x, footprint.min.z);
            var max = new Vector2(footprint.max.x, footprint.max.z);
            if (SegmentCrosses(p, q, min, max))
            {
                return 0f;
            }

            float best = Mathf.Min(ToRect(p, min, max), ToRect(q, min, max));
            best = Mathf.Min(best, ToSegment(new Vector2(min.x, min.y), p, q));
            best = Mathf.Min(best, ToSegment(new Vector2(min.x, max.y), p, q));
            best = Mathf.Min(best, ToSegment(new Vector2(max.x, min.y), p, q));
            best = Mathf.Min(best, ToSegment(new Vector2(max.x, max.y), p, q));
            return best;
        }

        private static float ToRect(Vector2 p, Vector2 min, Vector2 max)
        {
            float dx = Mathf.Max(min.x - p.x, 0f, p.x - max.x);
            float dy = Mathf.Max(min.y - p.y, 0f, p.y - max.y);
            return Mathf.Sqrt(dx * dx + dy * dy);
        }

        private static float ToSegment(Vector2 c, Vector2 p, Vector2 q)
        {
            Vector2 pq = q - p;
            float t = pq.sqrMagnitude > 1e-6f ? Mathf.Clamp01(Vector2.Dot(c - p, pq) / pq.sqrMagnitude) : 0f;
            return Vector2.Distance(c, p + pq * t);
        }

        /// <summary>The segment p-q passes through the box (clipped against each side in turn).</summary>
        private static bool SegmentCrosses(Vector2 p, Vector2 q, Vector2 min, Vector2 max)
        {
            float t0 = 0f, t1 = 1f;
            Vector2 d = q - p;
            float[] pp = { -d.x, d.x, -d.y, d.y };
            float[] qq = { p.x - min.x, max.x - p.x, p.y - min.y, max.y - p.y };
            for (int i = 0; i < 4; i++)
            {
                if (Mathf.Abs(pp[i]) < 1e-6f)
                {
                    if (qq[i] < 0f)
                    {
                        return false;
                    }

                    continue;
                }

                float r = qq[i] / pp[i];
                if (pp[i] < 0f)
                {
                    t0 = Mathf.Max(t0, r);
                }
                else
                {
                    t1 = Mathf.Min(t1, r);
                }

                if (t0 > t1)
                {
                    return false;
                }
            }

            return true;
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
