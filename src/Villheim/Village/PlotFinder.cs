using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Prefabs;

namespace Villheim.Village
{
    /// <summary>
    /// Picks where the next building goes: rings around the hearth, closest first, on dry, fairly flat ground
    /// that does not overlap other buildings, player builds or other locations.
    /// </summary>
    internal static class PlotFinder
    {
        public const float HearthClearance = 7f;
        private const float Gap = 2f;

        private static readonly List<Piece> PieceBuffer = new List<Piece>();

        public static bool TryFind(Vector3 hearth, float radius, float maxTerrainDelta, IReadOnlyList<Plot> plots,
            System.Random rng, out Vector3 position)
        {
            float villageRadius = VillheimConfig.VillageRadius.Value;
            float step = Mathf.Max(3f, radius * 0.5f);

            for (float ring = HearthClearance + radius; ring <= villageRadius + radius * 0.5f; ring += step)
            {
                int directions = Mathf.Clamp(Mathf.RoundToInt(2f * Mathf.PI * ring / Mathf.Max(radius, 4f)), 6, 32);
                float offset = (float)rng.NextDouble() * 360f;

                foreach (int i in Enumerable.Range(0, directions).OrderBy(_ => rng.Next()))
                {
                    float angle = (offset + i * 360f / directions) * Mathf.Deg2Rad;
                    Vector3 candidate = hearth + new Vector3(Mathf.Sin(angle), 0f, Mathf.Cos(angle)) * ring;
                    if (IsGoodSpot(candidate, hearth, radius, maxTerrainDelta, plots, out float groundY))
                    {
                        position = new Vector3(candidate.x, groundY, candidate.z);
                        return true;
                    }
                }
            }

            position = Vector3.zero;
            return false;
        }

        public static bool IsGoodSpot(Vector3 p, Vector3 hearth, float radius, float maxTerrainDelta, IReadOnlyList<Plot> plots,
            out float groundY)
        {
            groundY = 0f;

            if (Utils.DistanceXZ(p, hearth) < radius + HearthClearance)
            {
                return false;
            }

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

            // Never build on top of anything that is already there: player bases, other villages' buildings, ruins.
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
