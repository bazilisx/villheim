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
        public const float HearthClearance = 6f;
        private const float GridStep = 4f;
        private const float Gap = 2f;

        private static readonly List<Piece> PieceBuffer = new List<Piece>();

        /// <summary>Distance band from the hearth for each kind of building, as shares of the village radius.</summary>
        public static void Band(Role role, out float min, out float max)
        {
            switch (role)
            {
                case Role.Hub: min = 0f; max = 0.35f; break;
                case Role.House: min = 0.1f; max = 0.65f; break;
                case Role.Workshop: min = 0.3f; max = 0.9f; break;
                default: min = 0.45f; max = 1f; break;
            }
        }

        public static bool TryFind(Vector3 hearth, float axisYaw, Role role, bool strictHub, float radius, float maxTerrainDelta,
            IReadOnlyList<Plot> plots, System.Random rng, out Vector3 position, out float yaw)
        {
            float villageRadius = VillheimConfig.VillageRadius.Value;
            Band(role, out float minShare, out float maxShare);
            float maxDistance = Mathf.Min(villageRadius, villageRadius * maxShare + radius * 0.5f);
            float minDistance = Mathf.Max(radius + HearthClearance, villageRadius * minShare);
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
            var good = new List<Vector3>();
            int wanted = role == Role.Workshop ? 6 : 1;
            foreach (Vector2 local in candidates.OrderBy(c => c.magnitude + (float)rng.NextDouble() * step))
            {
                Vector3 candidate = hearth + axis * new Vector3(local.x, 0f, local.y);
                if (IsGoodSpot(candidate, hearth, radius, maxTerrainDelta, plots, out float groundY) &&
                    ClearOfPaths(candidate, hearth, axisYaw, radius, plots))
                {
                    good.Add(new Vector3(candidate.x, groundY, candidate.z));
                    if (good.Count >= wanted)
                    {
                        break;
                    }
                }
            }

            if (good.Count == 0)
            {
                position = Vector3.zero;
                yaw = 0f;
                return false;
            }

            // Workshops go where the work is: the most trees and rocks within 25 m, nearer spots winning ties.
            position = good.OrderByDescending(p => role == Role.Workshop ? Resources(p) * 4f - Utils.DistanceXZ(p, hearth) : 0f).First();
            yaw = FaceHearth(position, hearth, axisYaw);
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
            if (Utils.DistanceXZ(plot.Position, hearth) + radius * 0.5f > VillheimConfig.VillageRadius.Value ||
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

        /// <summary>Yaw that turns a design's front (+Z) toward the hearth, snapped to the village grid.</summary>
        public static float FaceHearth(Vector3 position, Vector3 hearth, float axisYaw)
        {
            Vector3 toHearth = hearth - position;
            float angle = Mathf.Atan2(toHearth.x, toHearth.z) * Mathf.Rad2Deg;
            float relative = Mathf.DeltaAngle(axisYaw, angle);
            return axisYaw + Mathf.Round(relative / 90f) * 90f;
        }

        public static bool IsGoodSpot(Vector3 p, Vector3 hearth, float radius, float maxTerrainDelta, IReadOnlyList<Plot> plots,
            out float groundY)
        {
            groundY = 0f;

            foreach (Plot plot in plots)
            {
                if (Utils.DistanceXZ(p, plot.Position) < plot.Radius + radius + Gap)
                {
                    return false;
                }
            }

            if (!SampleGround(p, radius, out float min, out float max, out groundY))
            {
                return false;
            }

            if (min < ZoneSystem.instance.m_waterLevel + 1f || max - min > maxTerrainDelta)
            {
                return false;
            }

            Heightmap.Biome biome = WorldGenerator.instance.GetBiome(p);
            if ((biome & (Heightmap.Biome.Meadows | Heightmap.Biome.BlackForest | Heightmap.Biome.Plains)) == 0)
            {
                return false;
            }

            if (Location.IsInsideNoBuildLocation(p))
            {
                return false;
            }

            Location other = Location.GetLocation(p, false);
            if (other != null && Utils.GetPrefabName(other.gameObject) != VillageLocation.Name)
            {
                return false;
            }

            // Never build on top of anything that is already there: player bases, other villages, ruins.
            PieceBuffer.Clear();
            Piece.GetAllPiecesInRadius(p, radius + 1f, PieceBuffer);
            foreach (Piece piece in PieceBuffer)
            {
                if (piece != null && !piece.GetComponent<VillageHearth>())
                {
                    return false;
                }
            }

            return true;
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
