using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Designs;
using Villheim.Prefabs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Picks where the next building goes, after Millenaire's building location finder:
    ///
    /// - Each kind of building has a band of distance from the hearth, as a share of the village radius: the
    ///   longhouse in the middle, homes in a ring around it, workshops further out, farms at the edge. Nothing ever
    ///   goes past the village radius.
    /// - Spots are tried ring by ring from the inside out, so the village stays compact.
    /// - A spot is refused when it touches another building, a path (the paths from the hearth to every building), or
    ///   when its own path to the hearth would run through a building.
    /// - Workshops pick, among the first good spots, the one with the most trees and rocks close by.
    ///
    /// Picks where the next building goes. Villages are laid out on a grid aligned to the hearth: candidate spots
    /// are grid points around the hearth, closest first, and every building is turned to face the hearth in
    /// 90 degree steps, so the whole village lines up like a Millenaire village instead of scattering.
    /// The hub goes on the axis right behind the hearth.
    /// </summary>
    internal static class PlotFinder
    {
        // Buildings stay off the hearth's leveled ground (10 m) with a meter to spare (Tyler, 2026-11-09).
        public const float HearthClearance = HearthGround.LevelRadius + 1f;

        /// <summary>How far above or below the hearth a building's ground may be and still be built on the hearth's level.</summary>
        public const float LevelTolerance = 2.5f;
        private const float GridStep = 4f;
        // Room for a path between neighbours (Millénaire keeps a clear margin round every building).
        private const float Gap = 4f;

        private static readonly List<Piece> PieceBuffer = new List<Piece>();

        /// <summary>Distance band from the hearth for each kind of building, as shares of the village radius.</summary>
        public static void Band(Role role, out float min, out float max)
        {
            switch (role)
            {
                case Role.Hub: min = 0f; max = 0.6f; break; // 0.35 left a big hall no room past the hearth gap (2026-11-09)
                case Role.House: min = 0.1f; max = 0.65f; break;
                case Role.Workshop: min = 0.45f; max = 0.95f; break;
                case Role.Storage: min = 0.1f; max = 0.5f; break;
                default: min = 0.45f; max = 1f; break;
            }
        }

        /// <summary>
        /// A spot in the building's own ring first. With no room there, the ring after it, and so on out to twice the
        /// village radius: a village grows outward and never stops for want of room (Tyler, 2026-11-09, D-079).
        /// </summary>
        public static bool TryFind(Vector3 hearth, float axisYaw, Role role, bool strictHub, float radius, float maxTerrainDelta,
            IReadOnlyList<Plot> plots, System.Random rng, out Vector3 position, out float yaw, HashSet<Vector2Int> network = null,
            VillageHearth village = null, float doorAngle = 0f, float budgetMs = 0f)
        {
            Unfinished = false;
            Budget = budgetMs;
            Watch.Restart();
            int villageId = village != null ? village.VillageId : 0;
            Prepare(hearth, radius, villageId, plots.Count);
            float inner = 0f;
            foreach (float reach in new[] { 1f, 1.35f, 1.7f, 2f })
            {
                if (Unfinished)
                {
                    break;
                }

                if (TryFindIn(hearth, axisYaw, role, strictHub && reach == 1f, radius, maxTerrainDelta, plots, rng, out position, out yaw,
                        network, village, doorAngle, reach, inner, out float outer))
                {
                    if (reach > 1f)
                    {
                        VillheimPlugin.Log.LogInfo($"A {role} found room farther out, {Utils.DistanceXZ(position, hearth):0} m from the hearth.");
                    }

                    return true;
                }

                inner = outer - radius; // the next ring starts where this one ended
            }

            position = Vector3.zero;
            yaw = 0f;
            return false;
        }

        private static bool TryFindIn(Vector3 hearth, float axisYaw, Role role, bool strictHub, float radius, float maxTerrainDelta,
            IReadOnlyList<Plot> plots, System.Random rng, out Vector3 position, out float yaw, HashSet<Vector2Int> network,
            VillageHearth village, float doorAngle, float reach, float inner, out float outer)
        {
            // The village's rings step out with each stage, since by then the inner ones are mostly built (Tyler, 2026-11-09):
            // VillageRadius is the first stage's radius, and each stage after adds RadiusPerStage of it.
            float perStage = LogicConfig.RadiusPerStage?.Value ?? 0.25f;
            float villageRadius = VillheimConfig.VillageRadius.Value * (1f + perStage * VillageBrain.TierIndex(plots.Count)) * reach;
            Band(role, out float minShare, out float maxShare);
            float maxDistance = Mathf.Min(villageRadius, villageRadius * maxShare + radius * 0.5f);
            outer = maxDistance;
            float minDistance = Mathf.Max(Mathf.Max(radius + HearthClearance, villageRadius * minShare), inner);
            if (minDistance > maxDistance - GridStep)
            {
                // A big design in a small band: let it sit as close as it fits.
                minDistance = radius + HearthClearance;
            }

            // Bigger designs use a coarser grid, which keeps the search cheap.
            float step = Mathf.Max(GridStep, Mathf.Round(radius * 0.5f / GridStep) * GridStep);
            int cells = Mathf.CeilToInt(maxDistance / step);
            Quaternion axis = Quaternion.Euler(0f, axisYaw, 0f);

            var candidates = new List<Vector2>();
            for (int x = -cells; x <= cells; x++)
            {
                for (int z = -cells; z <= cells; z++)
                {
                    var local = new Vector2(x * step, z * step);
                    float distance = local.magnitude;
                    if (distance > maxDistance || distance < minDistance)
                    {
                        continue;
                    }

                    // The hub sits straight behind the hearth, on the village axis, when the ground allows it.
                    if (role == Role.Hub && strictHub && (x != 0 || z <= 0))
                    {
                        continue;
                    }

                    candidates.Add(local);
                }
            }

            // Closest first; small random jitter so villages with the same layout rules still differ.
            // Every building goes on the hearth's level: the villagers raise or lower the ground under it to match. Spots
            // whose ground is within 2.5 m of the hearth are tried first; only if there are none is a building set on its
            // own ground.
            var good = new List<Vector3>();
            int wanted = 6;
            int offLevel = 0, onPath = 0, unreachable = 0, capped = 0, cluttered = 0;
            var fails = new int[FailNames.Length];
            var things = new Dictionary<string, int>();
            int villageId = village != null ? village.VillageId : 0;
            // The way to the hearth is a grid search for each spot: a few dozen of them in one go were a lag spike (T-105).
            int searches = 0;
            const int MostSearches = 10;
            List<Vector2> ordered = candidates.OrderBy(c => c.magnitude + (float)rng.NextDouble() * step).ToList();
            // Passes: ground at the hearth's level with nothing on it, then at that level with trees or bushes the site
            // clears when it starts (thick forest); then the same at any height.
            // Each spot is judged once and remembered for a while, so the four passes and the next looks cost little.
            for (int pass = 0; pass < 4 && good.Count == 0 && !Unfinished; pass++)
            {
                bool allowClutter = pass % 2 == 1;
                foreach (Vector2 local in ordered)
                {
                    Vector3 candidate = hearth + axis * new Vector3(local.x, 0f, local.y);
                    if (!Judge(candidate, radius, maxTerrainDelta, plots, villageId, out Verdict verdict))
                    {
                        // Out of time for this frame: the search goes on at the next look, from what is remembered.
                        Unfinished = true;
                        break;
                    }

                    if (verdict.Fail != SpotFail.None)
                    {
                        if (pass == 0)
                        {
                            fails[(int)verdict.Fail]++;
                            if (verdict.What != null)
                            {
                                things[verdict.What] = things.TryGetValue(verdict.What, out int n) ? n + 1 : 1;
                            }
                        }

                        continue;
                    }

                    if (verdict.Clutter && !allowClutter)
                    {
                        if (pass == 0)
                        {
                            cluttered++;
                        }

                        continue;
                    }

                    float groundY = verdict.GroundY;

                    bool level = Mathf.Abs(groundY - hearth.y) <= LevelTolerance;
                    if (pass < 2 && !level)
                    {
                        offLevel++;
                        continue;
                    }

                    // Off the laid paths (a building never sits on a road) and reachable from its door. The old rule that
                    // kept every building off the straight hearth-to-building lines is gone: Millénaire lets buildings
                    // line the roads, and so does this.
                    float floor = level ? hearth.y : groundY;
                    if (network != null && PathPlanner.DistanceToNetwork(network, candidate) <= radius * 0.6f + 1.5f)
                    {
                        onPath++;
                        continue;
                    }

                    if (village != null && searches++ >= MostSearches)
                    {
                        capped++;
                        break;
                    }

                    if (village == null || PathPlanner.Reachable(village, new Vector3(candidate.x, floor, candidate.z), radius,
                            FaceHearth(candidate, hearth, axisYaw) - doorAngle, doorAngle))
                    {
                        good.Add(new Vector3(candidate.x, floor, candidate.z));
                        if (good.Count >= wanted)
                        {
                            break;
                        }
                    }
                    else
                    {
                        unreachable++;
                    }
                }
            }

            if (good.Count == 0)
            {
                if (Unfinished)
                {
                    position = Vector3.zero;
                    yaw = 0f;
                    return false;
                }

                // Why nothing fit, for test reports, one count per cause (2026-11-09: a hall found no room anywhere).
                var why = new List<string>();
                for (int i = 1; i < fails.Length; i++)
                {
                    if (fails[i] > 0)
                    {
                        why.Add($"{FailNames[i]} {fails[i]}");
                    }
                }

                VillheimPlugin.Log.LogInfo($"No room for a {role} of radius {radius:0.0} m: {candidates.Count} spots between {minDistance:0} and " +
                                           $"{maxDistance:0} m. Spots refused: {(why.Count > 0 ? string.Join(", ", why) : "none")}. " +
                                           $"Of the rest: needs clearing {cluttered}, off level {offLevel}, on a path {onPath}, " +
                                           $"door unreachable {unreachable}, search cap hit {capped}." +
                                           (things.Count > 0 ? " In the way: " + string.Join(", ", things.OrderByDescending(t => t.Value).Take(6).Select(t => $"{t.Key} {t.Value}")) + "." : ""));
                position = Vector3.zero;
                yaw = 0f;
                return false;
            }

            // Of the good spots, the best: near the hearth, with the door about 4 m from a road already laid (buildings
            // line the roads, as in Millénaire). Workshops also go where the work is: the most trees and rocks within 25 m.
            float RoadScore(Vector3 p)
            {
                if (network == null || network.Count == 0)
                {
                    return 0f;
                }

                Vector3 door = p + Quaternion.Euler(0f, FaceHearth(p, hearth, axisYaw), 0f) * Vector3.forward * (radius * 0.6f + 0.5f);
                return Mathf.Abs(PathPlanner.DistanceToNetwork(network, door) - 4f) * 1.5f;
            }

            Vector3 chosen = good.OrderBy(p => Utils.DistanceXZ(p, hearth) + RoadScore(p) - (role == Role.Workshop ? Resources(p) * 4f : 0f)).First();
            position = chosen;
            yaw = FaceHearth(chosen, hearth, axisYaw) - doorAngle;

            // The door faces the hearth, unless turning it to a road brings it at least 3 m nearer one.
            if (network != null && network.Count > 0)
            {
                float Door(float y) => PathPlanner.DistanceToNetwork(network,
                    chosen + Quaternion.Euler(0f, y + doorAngle, 0f) * Vector3.forward * (radius * 0.6f + 0.5f));
                float inward = Door(yaw);
                for (int turn = 1; turn < 4; turn++)
                {
                    float other = yaw + 90f * turn;
                    if (Door(other) + 3f < inward)
                    {
                        yaw = other;
                        inward = Door(other);
                    }
                }
            }

            return true;
        }

        /// <summary>
        /// Places a longhouse so its own fire pit sits on the village hearth: the hall is built around the hearth and
        /// its cooking station. Tries the four turns of the village grid. The floor goes at the hearth's height.
        /// </summary>
        public static bool AroundHearth(Vector3 hearth, float axisYaw, Vector3 fireLocal, float radius, float maxTerrainDelta,
            int villageId, out Vector3 position, out float yaw)
        {
            for (int turn = 0; turn < 4; turn++)
            {
                yaw = axisYaw + 90f * turn;
                Vector3 offset = Quaternion.Euler(0f, yaw, 0f) * new Vector3(fireLocal.x, 0f, fireLocal.z);
                position = new Vector3(hearth.x - offset.x, hearth.y - fireLocal.y, hearth.z - offset.z);
                if (!SampleGround(position, radius, out float min, out float max, out float _) ||
                    min < ZoneSystem.instance.m_waterLevel + 1f || max - min > maxTerrainDelta + 1f ||
                    Location.IsInsideNoBuildLocation(position))
                {
                    continue;
                }

                bool blocked = false;
                PieceBuffer.Clear();
                Piece.GetAllPiecesInRadius(position, radius + 1f, PieceBuffer);
                foreach (Piece piece in PieceBuffer)
                {
                    // Only the village's own pieces (the hearth, its chest and cooking station) may be there already.
                    if (piece != null && piece.GetComponent<VillageHearth>() == null &&
                        (piece.m_nview == null || !piece.m_nview.IsValid() || piece.m_nview.GetZDO().GetInt(Keys.BuiltBy) != villageId))
                    {
                        blocked = true;
                        break;
                    }
                }

                if (!blocked)
                {
                    return true;
                }
            }

            position = Vector3.zero;
            yaw = 0f;
            return false;
        }

        /// <summary>
        /// A building can be rebuilt bigger where it stands: the new size keeps its gap to the other buildings and their
        /// paths, stays inside the village, and nothing that isn't the village's own stands in the way.
        /// </summary>
        public static bool CanUpgrade(Plot plot, float radius, Vector3 hearth, float axisYaw, IReadOnlyList<Plot> plots, int villageId)
        {
            if (Utils.DistanceXZ(plot.Position, hearth) + radius * 0.5f > VillheimConfig.VillageRadius.Value * 2f ||
                Utils.DistanceXZ(plot.Position, hearth) < radius * 0.6f + HearthClearance)
            {
                return false;
            }

            foreach (Plot other in plots)
            {
                if (other == plot || Utils.DistanceXZ(other.Position, plot.Position) < 0.5f)
                {
                    continue;
                }

                if (Utils.DistanceXZ(plot.Position, other.Position) < other.Radius + radius + Gap ||
                    PathBuilder.DistanceToPath(plot.Position, hearth, axisYaw, other.Position, other.Radius) < radius * 0.6f + 1.5f)
                {
                    return false;
                }
            }

            PieceBuffer.Clear();
            Piece.GetAllPiecesInRadius(plot.Position, radius * 0.7f, PieceBuffer);
            foreach (Piece piece in PieceBuffer)
            {
                if (piece != null && piece.GetComponent<VillageHearth>() == null &&
                    (piece.m_nview == null || !piece.m_nview.IsValid() || piece.m_nview.GetZDO().GetInt(Keys.BuiltBy) != villageId))
                {
                    return false;
                }
            }

            return true;
        }

        /// <summary>
        /// The spot keeps clear of every path in the village (hearth to each building), and its own path to the
        /// hearth doesn't run through a building.
        /// </summary>
        private static bool ClearOfPaths(Vector3 spot, Vector3 hearth, float axisYaw, float radius, IReadOnlyList<Plot> plots)
        {
            foreach (Plot plot in plots)
            {
                if (PathBuilder.DistanceToPath(spot, hearth, axisYaw, plot.Position, plot.Radius) < radius * 0.6f + 1.5f)
                {
                    return false;
                }

                if (PathBuilder.DistanceToPath(plot.Position, hearth, axisYaw, spot, radius) < plot.Radius * 0.6f + 1f)
                {
                    return false;
                }
            }

            return true;
        }

        /// <summary>Trees and rocks within 25 m.</summary>
        private static int Resources(Vector3 spot)
        {
            var seen = new HashSet<GameObject>();
            foreach (Collider collider in Physics.OverlapSphere(spot, 25f))
            {
                ZNetView view = collider.GetComponentInParent<ZNetView>();
                if (view != null)
                {
                    seen.Add(view.gameObject);
                }
            }

            int count = 0;
            foreach (GameObject go in seen)
            {
                if (go != null && (go.GetComponent<TreeBase>() || go.GetComponent<MineRock5>() || go.GetComponent<MineRock>()))
                {
                    count++;
                }
            }

            return count;
        }

        /// <summary>
        /// Yaw that turns a design's +Z side toward the hearth, snapped to the village grid. Take the design's door side
        /// away from it (see Doors) to turn the door toward the hearth.
        /// </summary>
        public static float FaceHearth(Vector3 position, Vector3 hearth, float axisYaw)
        {
            Vector3 toHearth = hearth - position;
            float angle = Mathf.Atan2(toHearth.x, toHearth.z) * Mathf.Rad2Deg;
            float relative = Mathf.DeltaAngle(axisYaw, angle);
            return axisYaw + Mathf.Round(relative / 90f) * 90f;
        }

        /// <summary>Why a spot was refused. Counted per cause in the log when a search finds nothing.</summary>
        internal enum SpotFail { None, Crowded, Unloaded, Water, Steep, Cliff, Biome, Location, Pieces, Obstacle }

        private static readonly string[] FailNames =
        {
            "", "too near another building", "ground not loaded", "water", "too steep", "by a cliff", "wrong biome",
            "inside a location", "someone's pieces", "something that can't be cleared",
        };

        private struct Verdict
        {
            public SpotFail Fail;
            /// <summary>Trees, stumps, bushes, logs or rocks stand there; the site clears them when it starts.</summary>
            public bool Clutter;
            public float GroundY;
            public float Time;
            /// <summary>The piece or thing that stood in the way.</summary>
            public string What;
        }

        /// <summary>True when the last TryFind ran out of its time for the frame; the next call picks up where it stopped.</summary>
        public static bool Unfinished { get; private set; }

        private static float Budget;
        private static readonly System.Diagnostics.Stopwatch Watch = new System.Diagnostics.Stopwatch();
        private static readonly Dictionary<(int, int, int, int), Verdict> Verdicts = new Dictionary<(int, int, int, int), Verdict>();
        private static readonly Dictionary<int, int> VerdictPlots = new Dictionary<int, int>();
        private static readonly Dictionary<int, bool> TooBig = new Dictionary<int, bool>();
        private static readonly List<(Vector3 At, string Name)> Standing = new List<(Vector3, string)>();
        private static string LastWhat;
        private static readonly HashSet<int> SeenObjects = new HashSet<int>();
        private const float VerdictSeconds = 90f;

        /// <summary>
        /// Before a search: forgets old verdicts when the village has changed, and lists once the pieces that stand
        /// round the village and count as in the way (every piece but the hearth and the village's own ring fence, which
        /// comes down where a building goes).
        /// </summary>
        private static void Prepare(Vector3 hearth, float radius, int villageId, int plotCount)
        {
            if (!VerdictPlots.TryGetValue(villageId, out int known) || known != plotCount || Verdicts.Count > 20000)
            {
                Verdicts.Clear();
                TooBig.Clear();
                VerdictPlots[villageId] = plotCount;
            }

            Standing.Clear();
            PieceBuffer.Clear();
            Piece.GetAllPiecesInRadius(hearth, VillheimConfig.VillageRadius.Value * 4f + radius + 2f, PieceBuffer);
            foreach (Piece piece in PieceBuffer)
            {
                if (piece != null && !piece.GetComponent<VillageHearth>() && !OwnFence(piece.gameObject, villageId))
                {
                    Standing.Add((piece.transform.position, Utils.GetPrefabName(piece.gameObject)));
                }
            }
        }

        /// <summary>A piece of this village's ring fence (pens stay).</summary>
        public static bool OwnFence(GameObject go, int villageId)
        {
            if (villageId == 0 || go == null || !Palisade.IsFencePiece(Utils.GetPrefabName(go)))
            {
                return false;
            }

            ZNetView view = go.GetComponent<ZNetView>();
            return view != null && view.IsValid() && view.GetZDO().GetInt(Keys.BuiltBy) == villageId &&
                   view.GetZDO().GetInt(Palisade.KeyPen) == 0;
        }

        /// <summary>The remembered verdict on a spot, or a fresh one. False when the frame's time is used up.</summary>
        private static bool Judge(Vector3 p, float radius, float maxTerrainDelta, IReadOnlyList<Plot> plots, int villageId, out Verdict verdict)
        {
            var key = (villageId, Mathf.RoundToInt(p.x), Mathf.RoundToInt(p.z), Mathf.RoundToInt(radius * 10f));
            if (Verdicts.TryGetValue(key, out verdict) && Time.time - verdict.Time < VerdictSeconds)
            {
                return true;
            }

            if (Budget > 0f && Watch.Elapsed.TotalMilliseconds > Budget)
            {
                return false;
            }

            verdict = new Verdict { Time = Time.time };
            LastWhat = null;
            verdict.Fail = Check(p, radius, maxTerrainDelta, plots, villageId, out verdict.GroundY, out verdict.Clutter);
            verdict.What = LastWhat;
            Verdicts[key] = verdict;
            return true;
        }

        public static bool IsGoodSpot(Vector3 p, Vector3 hearth, float radius, float maxTerrainDelta, IReadOnlyList<Plot> plots,
            out float groundY, bool allowClutter = true)
        {
            Prepare(hearth, radius, 0, plots.Count);
            return Check(p, radius, maxTerrainDelta, plots, 0, out groundY, out bool clutter) == SpotFail.None && (allowClutter || !clutter);
        }

        /// <summary>The cheap tests first (distances, ground heights), the physics query last.</summary>
        private static SpotFail Check(Vector3 p, float radius, float maxTerrainDelta, IReadOnlyList<Plot> plots, int villageId,
            out float groundY, out bool clutter)
        {
            groundY = 0f;
            clutter = false;

            foreach (Plot plot in plots)
            {
                if (Utils.DistanceXZ(p, plot.Position) < plot.Radius + radius + Gap)
                {
                    return SpotFail.Crowded;
                }
            }

            // Never build on top of anything that is already there: player bases, other villages, ruins.
            float keep = radius + 1f;
            foreach ((Vector3 piece, string name) in Standing)
            {
                if (Utils.DistanceXZ(p, piece) < keep)
                {
                    LastWhat = name;
                    return SpotFail.Pieces;
                }
            }

            if (!SampleGround(p, radius, out float min, out float max, out groundY))
            {
                return SpotFail.Unloaded;
            }

            // 0.4 m over the sea: a shore village (hearth 0.3 m up) found no room within 43 m at 1 m (2026-11-09).
            if (min < ZoneSystem.instance.m_waterLevel + 0.4f)
            {
                return SpotFail.Water;
            }

            if (max - min > maxTerrainDelta)
            {
                return SpotFail.Steep;
            }

            if (NearCliff(p, radius, groundY))
            {
                return SpotFail.Cliff;
            }

            Heightmap.Biome biome = WorldGenerator.instance.GetBiome(p);
            if ((biome & (Heightmap.Biome.Meadows | Heightmap.Biome.BlackForest | Heightmap.Biome.Plains)) == 0)
            {
                return SpotFail.Biome;
            }

            if (Location.IsInsideNoBuildLocation(p))
            {
                return SpotFail.Location;
            }

            Location other = Location.GetLocation(p, false);
            if (other != null && Utils.GetPrefabName(other.gameObject) != VillageLocation.Name)
            {
                return SpotFail.Location;
            }

            // Nothing the villagers can't clear where the walls go (Tyler: the first house went up on the 'vh kids rig'
            // models and the builder hammered at it for good).
            string what = InTheWay(p, radius, out clutter, villageId);
            if (what != null)
            {
                LastWhat = what;
                return SpotFail.Obstacle;
            }

            return SpotFail.None;
        }

        private static readonly Collider[] Overlaps = new Collider[512];
        private static readonly HashSet<string> ZoneNotes = new HashSet<string>();

        /// <summary>The widest a rock or other natural thing may be for the villagers to clear it off a plot.</summary>
        public const float ClearableSize = 7f;

        /// <summary>
        /// A natural thing the villagers leave standing and build elsewhere: an ore vein, a tree their axes can't fell,
        /// or a rock formation more than ClearableSize across.
        /// </summary>
        public static bool TooBigToClear(GameObject go)
        {
            int id = go.GetInstanceID();
            if (TooBig.TryGetValue(id, out bool known))
            {
                return known;
            }

            bool big;
            if (PathPlanner.IsOre(go.name))
            {
                big = true;
            }
            else if (go.TryGetComponent(out TreeBase tree))
            {
                big = tree.m_minToolTier > 1;
            }
            else if (go.GetComponent<TreeLog>() != null)
            {
                big = false;
            }
            else
            {
                Bounds? bounds = PathPlanner.SolidBounds(go);
                big = bounds.HasValue && Mathf.Max(bounds.Value.size.x, bounds.Value.size.z) > ClearableSize;
            }

            TooBig[id] = big;
            return big;
        }

        public static string InTheWay(Vector3 p, float radius, bool allowClutter)
        {
            string what = InTheWay(p, radius, out bool clutter, 0);
            return what ?? (clutter && !allowClutter ? "trees, bushes or rocks" : null);
        }

        /// <summary>
        /// What stands where a building of this size would go and can't be cleared, or null. Blocking: anything placed
        /// (pieces, the test models, carts and the like), a location's walls, cliffs, ore, and trees and rocks too big
        /// to clear. Trees, stumps, logs, bushes and ordinary rocks set <paramref name="clutter"/>: the site clears them
        /// when it starts (Tyler, 2026-11-09: villagers prepare the land). People, creatures, berries, flowers, things
        /// lying on the ground and the village's own ring fence don't count.
        /// </summary>
        public static string InTheWay(Vector3 p, float radius, out bool clutter, int villageId)
        {
            clutter = false;
            float reach = Mathf.Max(2f, radius * 0.8f);
            int count = Physics.OverlapSphereNonAlloc(p + Vector3.up * 1f, reach, Overlaps, ~0, QueryTriggerInteraction.Ignore);
            SeenObjects.Clear();
            for (int i = 0; i < count; i++)
            {
                Collider collider = Overlaps[i];
                if (collider == null || collider.GetComponentInParent<Heightmap>() != null)
                {
                    continue;
                }

                ZNetView view = collider.GetComponentInParent<ZNetView>();
                GameObject go = view != null ? view.gameObject : collider.transform.root.gameObject;
                if (!SeenObjects.Add(go.GetInstanceID()))
                {
                    continue;
                }

                // The world's own zone object (water, zone colliders without a net view) is no obstacle: counting it failed
                // every spot round a village and froze the game for seconds (2026-11-09). Slopes and cliffs have their
                // own checks.
                if (view == null && go.name.StartsWith("_Zone"))
                {
                    if (ZoneNotes.Add(collider.name))
                    {
                        Perf.Debug($"Plot check: ignoring zone collider '{collider.name}' on layer {LayerMask.LayerToName(collider.gameObject.layer)}.");
                    }

                    continue;
                }

                if (go.name.StartsWith("villheim_kids_rig"))
                {
                    return "a test model";
                }

                if (go.GetComponent<Character>() != null || go.GetComponent<ItemDrop>() != null || go.GetComponent<VillageHearth>() != null ||
                    go.GetComponent<Pickable>() != null)
                {
                    continue;
                }

                if (go.GetComponent<Piece>() != null)
                {
                    if (OwnFence(go, villageId))
                    {
                        continue;
                    }

                    return Utils.GetPrefabName(go);
                }

                bool natural = go.GetComponent<TreeBase>() || go.GetComponent<TreeLog>() || go.GetComponent<Destructible>() ||
                               go.GetComponent<MineRock5>() || go.GetComponent<MineRock>();
                if (natural && view != null)
                {
                    if (TooBigToClear(go))
                    {
                        return Utils.GetPrefabName(go);
                    }

                    clutter = true;
                    continue;
                }

                // Anything else: a location's walls, a cliff, a ship, another mod's object.
                return view != null ? Utils.GetPrefabName(go) : go.name;
            }

            return null;
        }

        /// <summary>
        /// Millenaire's neighbour cliff rule: around the plot (from its edge to 6 m out), the ground may not rise or
        /// fall more than the distance from the edge plus 3 m, so nothing is built at the foot of a cliff or on a ledge.
        /// </summary>
        private static bool NearCliff(Vector3 center, float radius, float centerY)
        {
            for (int ring = 0; ring < 3; ring++)
            {
                float gap = ring * 3f;
                float distance = radius * 0.7f + 0.5f + gap;
                for (int i = 0; i < 8; i++)
                {
                    float angle = i * Mathf.PI / 4f + ring * 0.3f;
                    Vector3 sample = center + new Vector3(Mathf.Sin(angle), 0f, Mathf.Cos(angle)) * distance;
                    if (Heightmap.FindHeightmap(sample) == null)
                    {
                        continue;
                    }

                    if (Mathf.Abs(ZoneSystem.instance.GetGroundHeight(sample) - centerY) > gap + 3f)
                    {
                        return true;
                    }
                }
            }

            return false;
        }

        private static bool SampleGround(Vector3 center, float radius, out float min, out float max, out float centerY)
        {
            min = float.MaxValue;
            max = float.MinValue;
            centerY = 0f;

            // Center, then eight points at 70% of the radius. Stops early once the spot is clearly too steep.
            for (int i = 0; i < 9; i++)
            {
                Vector3 sample = center;
                if (i > 0)
                {
                    float angle = (i - 1) * Mathf.PI / 4f;
                    sample += new Vector3(Mathf.Sin(angle), 0f, Mathf.Cos(angle)) * radius * 0.7f;
                }

                // Only judge ground that is actually loaded; unloaded spots are tried again on a later visit.
                if (Heightmap.FindHeightmap(sample) == null)
                {
                    return false;
                }

                float height = ZoneSystem.instance.GetGroundHeight(sample);
                if (i == 0)
                {
                    centerY = height;
                }

                min = Mathf.Min(min, height);
                max = Mathf.Max(max, height);
                if (max - min > 8f)
                {
                    return true;
                }
            }

            return true;
        }
    }
}
