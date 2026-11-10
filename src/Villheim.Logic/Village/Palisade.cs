using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Designs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// A fence around the village that grows with it, after Millenaire's village walls, and the animal pens of its farms.
    ///
    /// - The ring (Tyler, 2026-11-08): from two buildings a hamlet puts up HamletFence (the small wood fence) on the
    ///   ground, with a gap where each path crosses. Once it is a village, the stake wall sunk FenceWallSink (half) into
    ///   the ground replaces it, piece by piece: each fence piece is taken down and a stake wall put up in its place.
    /// - Gates in the stake wall: where a path crosses, a pair of wood gates side by side, hung from opposite sides, on
    ///   the ground (not sunk). The ring pieces next to them are left out.
    /// - The ring sits a few metres outside the furthest building and skips water, buildings and steep ground. When
    ///   buildings go up beyond it, the old ring comes down (half the materials back) and a wider one goes up.
    /// - Pens come before the ring (Farms.PenSegments): a farm's animals only come once their pen is closed.
    /// - Every piece is a builder's job (Villagers.Repairs), paid from the village chest after the building going up
    ///   has what it needs. Nothing appears by itself.
    /// </summary>
    internal static class Palisade
    {
        private static readonly int KeyRadius = "villheim_fence_radius".GetStableHashCode();

        /// <summary>On pen pieces (Farms), so the ring never takes them down.</summary>
        public static readonly int KeyPen = "villheim_pen".GetStableHashCode();

        private const string WallPiece = "stake_wall";
        private const string GatePiece = "wood_gate";
        private static readonly string[] AllFencePieces = { "wood_fence", "stake_wall", "wood_gate" };

        private const float MinRadius = 16f;
        private const float Margin = 3f;
        private const float GateGap = 2.2f;

        internal sealed class Segment
        {
            public string Prefab;
            public Vector3 Position;
            public Quaternion Rotation;
            public Dictionary<string, int> Cost;
            public Piece Remove;

            /// <summary>Part of a farm's pen (marked, so the ring leaves it alone).</summary>
            public bool Pen;
        }

        private static readonly Dictionary<int, (float Time, Segment Next)> Cache = new Dictionary<int, (float, Segment)>();

        public static bool IsFencePiece(string prefab) => AllFencePieces.Contains(prefab);

        /// <summary>The ring's radius for the village as it stands now, on a 4 m step.</summary>
        public static float WantedRadius(VillageHearth hearth, VillageState state)
        {
            float reach = MinRadius;
            foreach (Plot plot in state.Plots)
            {
                reach = Mathf.Max(reach, Utils.DistanceXZ(plot.Position, hearth.transform.position) + plot.Radius * 0.75f + Margin);
            }

            // Buildings may stand out to twice the village radius (D-079), and the ring goes round them all.
            return Mathf.Min(Mathf.Ceil(reach / 4f) * 4f, VillheimConfig.VillageRadius.Value * 2f + 6f);
        }

        /// <summary>The next fence job: a pen piece, a piece of an outgrown or too low ring to take down, or the next ring piece.</summary>
        public static Segment Next(VillageHearth hearth)
        {
            if (Cache.TryGetValue(hearth.VillageId, out var cached) && Time.time - cached.Time < 8f &&
                (cached.Next == null || cached.Next.Remove != null || !Present(cached.Next.Prefab, cached.Next.Position)))
            {
                return cached.Next;
            }

            Segment next = Farms.NextPenSegment(hearth) ?? Find(hearth);
            Cache[hearth.VillageId] = (Time.time, next);
            return next;
        }

        public static void Forget(int villageId) => Cache.Remove(villageId);

        /// <summary>
        /// Takes down the village's ring fence where a building is about to go up (half the materials back, as for an
        /// outgrown ring). The ring is laid again round the bigger village afterwards.
        /// </summary>
        public static void ClearFor(VillageHearth hearth, Vector3 position, float radius)
        {
            var pieces = new List<Piece>();
            PieceIndex.InRadius(position, radius + 1f, pieces);
            Container chest = VillageChest.Find(hearth);
            int removed = 0;
            foreach (Piece piece in pieces)
            {
                if (piece == null || !PlotFinder.OwnFence(piece.gameObject, hearth.VillageId))
                {
                    continue;
                }

                foreach (KeyValuePair<string, int> c in DesignSpawner.RecipeCost(piece.gameObject))
                {
                    if (chest != null && c.Value / 2 > 0)
                    {
                        VillageChest.Add(chest, c.Key, c.Value / 2);
                    }
                }

                piece.m_nview.ClaimOwnership();
                ZNetScene.instance.Destroy(piece.gameObject);
                removed++;
            }

            if (removed > 0)
            {
                Forget(hearth.VillageId);
                VillheimPlugin.Debug($"Took down {removed} fence pieces to make room for a building.");
            }
        }

        /// <summary>How far down a piece goes so the given share of it is in the ground, from its measured height.</summary>
        public static float SinkOffset(GameObject prefab, string name, float share)
        {
            Bounds? bounds = BuildOrder.Measure(prefab, name, Vector3.zero, Quaternion.identity, prefab.transform.localScale);
            if (!bounds.HasValue)
            {
                return 0f;
            }

            // The piece's bottom on the ground, then down by the share of its height.
            return -bounds.Value.min.y - bounds.Value.size.y * Mathf.Clamp(share, 0f, 0.9f);
        }

        private static Segment Find(VillageHearth hearth)
        {
            var state = new VillageState(hearth.Zdo);
            if (state.Plots.Count < (state.Type == "fortified" ? 1 : 2) || VillageChest.IsLost(hearth))
            {
                return null;
            }

            float wanted = WantedRadius(hearth, state);
            float current = hearth.Zdo.GetFloat(KeyRadius, 0f);
            if (wanted > current + 3f || current <= 0f)
            {
                hearth.Zdo.Set(KeyRadius, wanted);
                current = wanted;
                VillheimPlugin.Debug($"{state.Name}: the fence ring is now {wanted:0} m from the hearth.");
            }

            Vector3 center = hearth.transform.position;

            // The village's ring pieces, listed once: asking the game for the pieces round every ring spot walked every
            // piece in the world each time (146 ms a call on a finished ring, 2026-11-09).
            Ring.Clear();
            var pieces = new List<Piece>();
            PieceIndex.InRadius(center, current + 4f, pieces);
            foreach (Piece piece in pieces)
            {
                if (piece != null && piece.m_nview != null && piece.m_nview.IsValid() &&
                    piece.m_nview.GetZDO().GetInt(Keys.BuiltBy) == hearth.VillageId && piece.m_nview.GetZDO().GetInt(KeyPen) == 0 &&
                    IsFencePiece(Utils.GetPrefabName(piece.gameObject)))
                {
                    Ring.Add((piece, Utils.GetPrefabName(piece.gameObject)));
                }
            }

            // An outgrown ring comes down first, piece by piece. Pens stay.
            foreach ((Piece piece, string _) in Ring)
            {
                float out_ = Utils.DistanceXZ(piece.transform.position, center);
                if (out_ < current - 2.5f && out_ > MinRadius - 4f)
                {
                    return new Segment { Remove = piece, Position = piece.transform.position };
                }
            }

            int tier = VillageBrain.TierIndex(state.Plots.Count) + (state.Type == "fortified" ? 1 : 0);
            bool wall = tier >= 2;
            string hamlet = (LogicConfig.HamletFence?.Value ?? "wood_fence").Trim();
            string prefabName = wall ? WallPiece : hamlet;
            if (prefabName.Length == 0)
            {
                return null; // no ring yet
            }

            GameObject prefab = ZNetScene.instance ? ZNetScene.instance.GetPrefab(prefabName) : null;
            if (prefab == null || !Amenities.Buildable(prefab, state.Biome, out Dictionary<string, int> cost))
            {
                return null;
            }

            float share = wall ? (LogicConfig.FenceWallSink?.Value ?? 0.5f) : (LogicConfig.HamletFenceSink?.Value ?? 0f);
            float sink = SinkOffset(prefab, prefabName, share);
            GameObject gate = ZNetScene.instance.GetPrefab(GatePiece);
            Dictionary<string, int> gateCost = null;
            bool gates = wall && gate != null && Amenities.Buildable(gate, state.Biome, out gateCost);
            float width = Mathf.Max(1f, Width(prefab, prefabName));
            float gateWidth = gates ? Mathf.Max(1f, Width(gate, GatePiece)) : 0f;
            int count = Mathf.CeilToInt(2f * Mathf.PI * current / width);
            HashSet<Vector2Int> network = PathPlanner.Network(hearth);
            Dictionary<string, int> building = ConstructionSite.Remaining(hearth);

            // Where paths cross: the ring index nearest each path, and the pieces either side of it left for the gates.
            var near = new float[count];
            for (int i = 0; i < count; i++)
            {
                Vector3 at = center + Outward(state, i, count) * current;
                near[i] = PathPlanner.NearNetwork(network, at, GateGap + 1f) ? PathPlanner.DistanceToNetwork(network, at) : float.MaxValue;
            }

            for (int i = 0; i < count; i++)
            {
                Vector3 outward = Outward(state, i, count);
                Vector3 spot = center + outward * current;
                if (!ZoneSystem.instance.IsZoneLoaded(spot) || !ZoneSystem.instance.GetGroundHeight(spot, out float y) ||
                    y < ZoneSystem.instance.m_waterLevel + 0.3f || Steep(spot, outward, width) || InBuilding(state, spot))
                {
                    continue;
                }

                spot.y = y;
                Quaternion rotation = Quaternion.LookRotation(outward);
                if (near[i] < GateGap)
                {
                    bool middle = near[i] <= near[(i + count - 1) % count] && near[i] < near[(i + 1) % count];
                    if (!gates || !middle)
                    {
                        continue; // a gap, or beside the gates
                    }

                    // A pair of gates, hung from opposite sides, centred on the crossing.
                    Vector3 tangent = Vector3.Cross(Vector3.up, outward);
                    foreach (int side in new[] { 1, -1 })
                    {
                        Quaternion turn = side > 0 ? rotation : rotation * Quaternion.Euler(0f, 180f, 0f);
                        Vector3 at = Centered(gate, GatePiece, spot + tangent * (side * gateWidth * 0.5f), turn);
                        if (!Ring.Any(r => r.Name == GatePiece && Utils.DistanceXZ(r.Piece.transform.position, at) < 0.8f))
                        {
                            return Affordable(hearth, state, gateCost, building)
                                ? new Segment { Prefab = GatePiece, Position = at, Rotation = turn, Cost = gateCost }
                                : null;
                        }
                    }

                    continue;
                }

                Vector3 place = spot + Vector3.up * sink;
                Piece standing = RingPieceAt(spot);
                if (standing != null)
                {
                    // The low fence, or the wrong kind, comes down to go up again at the new height.
                    string standingName = Utils.GetPrefabName(standing.gameObject);
                    if (standingName == prefabName && Mathf.Abs(standing.transform.position.y - place.y) < 0.3f)
                    {
                        continue;
                    }

                    if (standingName != GatePiece)
                    {
                        return new Segment { Remove = standing, Position = standing.transform.position };
                    }

                    continue;
                }

                if (!Affordable(hearth, state, cost, building))
                {
                    return null; // wait for the chest
                }

                return new Segment { Prefab = prefabName, Position = place, Rotation = rotation, Cost = cost };
            }

            return null;
        }

        private static bool Affordable(VillageHearth hearth, VillageState state, Dictionary<string, int> cost, Dictionary<string, int> building) =>
            cost != null && Amenities.Affordable(hearth, state, cost, building);

        private static Vector3 Outward(VillageState state, int i, int count)
        {
            float angle = state.Axis * Mathf.Deg2Rad + i * 2f * Mathf.PI / count;
            return new Vector3(Mathf.Sin(angle), 0f, Mathf.Cos(angle));
        }

        /// <summary>Where a piece goes so the middle of its measured box lands on the spot (gates hang from one side).</summary>
        public static Vector3 Centered(GameObject prefab, string name, Vector3 spot, Quaternion rotation)
        {
            Bounds? bounds = BuildOrder.Measure(prefab, name, Vector3.zero, Quaternion.identity, prefab.transform.localScale);
            if (!bounds.HasValue)
            {
                return spot;
            }

            Vector3 middle = rotation * new Vector3(bounds.Value.center.x, 0f, bounds.Value.center.z);
            Vector3 at = spot - middle;
            if (ZoneSystem.instance.GetGroundHeight(at, out float y))
            {
                at.y = y - bounds.Value.min.y;
            }

            return at;
        }

        private static readonly List<(Piece Piece, string Name)> Ring = new List<(Piece, string)>();

        /// <summary>A piece of the ring listed by Find standing on the spot (within 0.8 m across, any height).</summary>
        private static Piece RingPieceAt(Vector3 spot)
        {
            foreach ((Piece piece, string _) in Ring)
            {
                if (piece != null && Utils.DistanceXZ(piece.transform.position, spot) < 0.8f)
                {
                    return piece;
                }
            }

            return null;
        }

        /// <summary>A fence piece of this village standing on the spot (within 0.8 m across, any height).</summary>
        private static Piece PieceAt(Vector3 spot, IEnumerable<string> prefabs, int villageId)
        {
            Nearby.Clear();
            PieceIndex.InRadius(spot, 3f, Nearby);
            return Nearby.FirstOrDefault(p => p != null && Utils.DistanceXZ(p.transform.position, spot) < 0.8f &&
                                              prefabs.Contains(Utils.GetPrefabName(p.gameObject)) && p.m_nview != null &&
                                              p.m_nview.IsValid() && p.m_nview.GetZDO().GetInt(Keys.BuiltBy) == villageId &&
                                              p.m_nview.GetZDO().GetInt(KeyPen) == 0);
        }

        /// <summary>Puts the segment up (paid from the chest) or takes the outgrown piece down (half back).</summary>
        public static void Build(VillageHearth hearth, Segment segment)
        {
            Forget(hearth.VillageId);
            var state = new VillageState(hearth.Zdo);
            Container chest = VillageChest.Find(hearth);
            if (segment.Remove != null)
            {
                foreach (KeyValuePair<string, int> c in DesignSpawner.RecipeCost(segment.Remove.gameObject))
                {
                    if (chest != null && c.Value / 2 > 0)
                    {
                        VillageChest.Add(chest, c.Key, c.Value / 2);
                    }
                }

                segment.Remove.m_nview.ClaimOwnership();
                ZNetScene.instance.Destroy(segment.Remove.gameObject);
                return;
            }

            if (chest == null || !VillageChest.Take(chest, segment.Cost))
            {
                return;
            }

            GameObject prefab = ZNetScene.instance.GetPrefab(segment.Prefab);
            if (prefab == null)
            {
                return;
            }

            GameObject made = Object.Instantiate(prefab, segment.Position, segment.Rotation);
            ZNetView view = made.GetComponent<ZNetView>();
            view?.GetZDO()?.Set(Keys.BuiltBy, hearth.VillageId);
            if (segment.Pen)
            {
                view?.GetZDO()?.Set(KeyPen, 1);
            }
            made.GetComponent<Piece>()?.m_placeEffect?.Create(segment.Position, segment.Rotation, made.transform);
        }

        private static string Pick(IEnumerable<string> names, Heightmap.Biome biome, out GameObject prefab, out Dictionary<string, int> cost)
        {
            foreach (string name in names)
            {
                prefab = ZNetScene.instance ? ZNetScene.instance.GetPrefab(name) : null;
                if (prefab != null && Amenities.Buildable(prefab, biome, out cost))
                {
                    return name;
                }
            }

            prefab = null;
            cost = null;
            return null;
        }

        private static float Width(GameObject prefab, string name)
        {
            Bounds? bounds = BuildOrder.Measure(prefab, name, Vector3.zero, Quaternion.identity, prefab.transform.localScale);
            return bounds.HasValue ? bounds.Value.size.x : 2f;
        }

        private static bool Steep(Vector3 spot, Vector3 outward, float width)
        {
            Vector3 side = Vector3.Cross(Vector3.up, outward) * (width * 0.5f);
            return ZoneSystem.instance.GetGroundHeight(spot + side, out float a) && ZoneSystem.instance.GetGroundHeight(spot - side, out float b) &&
                   Mathf.Abs(a - b) > 1.5f;
        }

        private static bool InBuilding(VillageState state, Vector3 spot)
        {
            return state.Plots.Any(p => Utils.DistanceXZ(p.Position, spot) < p.Radius * 0.6f + 1f);
        }

        private static readonly List<Piece> Nearby = new List<Piece>();

        private static bool Present(string prefab, Vector3 spot) => PresentAny(new[] { prefab }, spot);

        private static bool PresentAny(IEnumerable<string> prefabs, Vector3 spot)
        {
            Nearby.Clear();
            PieceIndex.InRadius(spot, 0.8f, Nearby);
            return Nearby.Any(p => p != null && prefabs.Contains(Utils.GetPrefabName(p.gameObject)));
        }
    }
}
