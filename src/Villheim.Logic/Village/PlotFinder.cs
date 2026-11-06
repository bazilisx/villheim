using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Designs;
using Villheim.Prefabs;

namespace Villheim.Logic.Village
{
    /// <summary>
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

        public static bool TryFind(Vector3 hearth, float axisYaw, Role role, float radius, float maxTerrainDelta,
            IReadOnlyList<Plot> plots, System.Random rng, out Vector3 position, out float yaw)
        {
            float maxDistance = VillheimConfig.VillageRadius.Value + radius * 0.5f;
            int cells = Mathf.CeilToInt(maxDistance / GridStep);
            Quaternion axis = Quaternion.Euler(0f, axisYaw, 0f);

            var candidates = new List<Vector2>();
            for (int x = -cells; x <= cells; x++)
            {
                for (int z = -cells; z <= cells; z++)
                {
                    var local = new Vector2(x * GridStep, z * GridStep);
                    float distance = local.magnitude;
                    if (distance > maxDistance || distance < radius + HearthClearance)
                    {
                        continue;
                    }

                    // The hub sits straight behind the hearth, on the village axis.
                    if (role == Role.Hub && (x != 0 || z <= 0))
                    {
                        continue;
                    }

                    candidates.Add(local);
                }
            }

            // Closest first; small random jitter so villages with the same layout rules still differ.
            foreach (Vector2 local in candidates.OrderBy(c => c.magnitude + (float)rng.NextDouble() * GridStep))
            {
                Vector3 candidate = hearth + axis * new Vector3(local.x, 0f, local.y);
                if (IsGoodSpot(candidate, hearth, radius, maxTerrainDelta, plots, out float groundY))
                {
                    position = new Vector3(candidate.x, groundY, candidate.z);
                    yaw = FaceHearth(position, hearth, axisYaw);
                    return true;
                }
            }

            position = Vector3.zero;
            yaw = 0f;
            return false;
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

            var samples = new List<Vector3> { center };
            foreach (float fraction in new[] { 0.4f, 0.8f })
            {
                for (int i = 0; i < 8; i++)
                {
                    float angle = i * Mathf.PI / 4f;
                    samples.Add(center + new Vector3(Mathf.Sin(angle), 0f, Mathf.Cos(angle)) * radius * fraction);
                }
            }

            for (int i = 0; i < samples.Count; i++)
            {
                // Only judge ground that is actually loaded; unloaded spots are tried again on a later visit.
                if (Heightmap.FindHeightmap(samples[i]) == null)
                {
                    return false;
                }

                float height = ZoneSystem.instance.GetGroundHeight(samples[i]);
                if (i == 0)
                {
                    centerY = height;
                }

                min = Mathf.Min(min, height);
                max = Mathf.Max(max, height);
            }

            return true;
        }
    }
}
