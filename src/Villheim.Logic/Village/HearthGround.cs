using UnityEngine;
using Villheim.Logic.Designs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// The ground around a village's hearth, and where a hearth goes.
    ///
    /// When a village is founded, the hearth area is made ready for the hearth, the chest, the cooking station, the
    /// sign and the notice board, and for the longhouse that may grow around them: trees, stumps, logs, rocks, bushes
    /// and loose sticks and stones within 12 m are cleared, the ground is levelled at the hearth's height out to 7 m
    /// (smoothed out to 11 m), and grass and swaying plants are cleared from the ground out to 12 m, so it reads as a
    /// bare meadow floor.
    ///
    /// A hearth lit by hand goes on the nearest flat spot within 40 m, not wherever the player happens to stand.
    /// </summary>
    internal static class HearthGround
    {
        public const float ClearRadius = 12f;
        public const float LevelRadius = 7f;

        public static void Prepare(Vector3 hearth)
        {
            DesignSpawner.ClearArea(hearth, ClearRadius);
            TerrainShaper.LevelPad(hearth, LevelRadius, LevelRadius + 4f);
            ClearVegetation(hearth, ClearRadius);
        }

        /// <summary>Takes grass and swaying plants off the ground (the game's own "clear vegetation" paint).</summary>
        public static void ClearVegetation(Vector3 center, float radius)
        {
            TerrainOp.Settings settings = TerrainShaper.NewSettings();
            settings.m_paintCleared = true;
            settings.m_paintType = TerrainModifier.PaintType.ClearVegetation;
            settings.m_paintRadius = radius;
            settings.m_paintHeightCheck = false;
            TerrainShaper.Apply(center, settings);
        }

        /// <summary>
        /// The nearest spot within 40 m of <paramref name="near"/> where the ground across a hearth area is nearly
        /// flat, on dry land and clear of buildings. Falls back to the flattest spot found.
        /// </summary>
        public static Vector3 FlatSpotNear(Vector3 near)
        {
            Vector3 best = near;
            float bestScore = float.MaxValue;
            for (float ring = 0f; ring <= 40f; ring += 4f)
            {
                int steps = ring < 1f ? 1 : Mathf.Max(8, Mathf.RoundToInt(ring * 1.5f));
                for (int i = 0; i < steps; i++)
                {
                    float angle = i * Mathf.PI * 2f / steps;
                    Vector3 spot = near + new Vector3(Mathf.Sin(angle), 0f, Mathf.Cos(angle)) * ring;
                    if (!Flatness(spot, out float spread, out float y))
                    {
                        continue;
                    }

                    // Flatness first, then nearness: a spot within half a metre of level wins at the shortest walk.
                    float score = (spread < 0.6f ? 0f : spread * 10f) + ring * 0.05f;
                    if (score < bestScore)
                    {
                        bestScore = score;
                        best = new Vector3(spot.x, y, spot.z);
                    }
                }

                if (bestScore < 1f)
                {
                    break;
                }
            }

            return best;
        }

        private static bool Flatness(Vector3 center, out float spread, out float centerY)
        {
            spread = float.MaxValue;
            centerY = 0f;
            if (!ZoneSystem.instance.GetGroundHeight(center, out centerY) || centerY < ZoneSystem.instance.m_waterLevel + 1f)
            {
                return false;
            }

            var pieces = new System.Collections.Generic.List<Piece>();
            Piece.GetAllPiecesInRadius(center, ClearRadius, pieces);
            if (pieces.Count > 0)
            {
                return false;
            }

            float min = centerY;
            float max = centerY;
            for (int i = 0; i < 12; i++)
            {
                float angle = i * Mathf.PI / 6f;
                foreach (float r in new[] { 3.5f, LevelRadius })
                {
                    Vector3 sample = center + new Vector3(Mathf.Sin(angle), 0f, Mathf.Cos(angle)) * r;
                    if (!ZoneSystem.instance.GetGroundHeight(sample, out float h) || h < ZoneSystem.instance.m_waterLevel + 0.5f)
                    {
                        return false;
                    }

                    min = Mathf.Min(min, h);
                    max = Mathf.Max(max, h);
                }
            }

            spread = max - min;
            return true;
        }
    }
}
