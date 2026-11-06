using UnityEngine;
using Villheim.Logic.Designs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Lays a dirt path from the hearth to a building, the same paint the hoe's path tool uses. Paths follow the
    /// village grid (out along one axis, then the other) so they meet up into streets.
    /// </summary>
    internal static class PathBuilder
    {
        private const float Step = 1f;
        private const float Width = 1.3f;
        private const float HearthGap = 2.5f;

        public static void Build(Vector3 hearth, float axisYaw, Vector3 building, float buildingRadius)
        {
            Quaternion axis = Quaternion.Euler(0f, axisYaw, 0f);
            Vector3 local = Quaternion.Inverse(axis) * (building - hearth);

            // Walk along the axis that points at the building first, then turn toward it.
            Vector3 corner = Mathf.Abs(local.z) >= Mathf.Abs(local.x)
                ? hearth + axis * new Vector3(0f, 0f, local.z)
                : hearth + axis * new Vector3(local.x, 0f, 0f);

            float stopAt = buildingRadius * 0.6f;
            Paint(hearth, corner, hearth, building, stopAt);
            Paint(corner, building, hearth, building, stopAt);
        }

        private static void Paint(Vector3 from, Vector3 to, Vector3 hearth, Vector3 building, float stopAt)
        {
            Vector3 flatFrom = new Vector3(from.x, 0f, from.z);
            Vector3 flatTo = new Vector3(to.x, 0f, to.z);
            float length = Vector3.Distance(flatFrom, flatTo);
            int steps = Mathf.CeilToInt(length / Step);

            for (int i = 0; i <= steps; i++)
            {
                Vector3 point = Vector3.Lerp(flatFrom, flatTo, steps == 0 ? 0f : (float)i / steps);
                if (Utils.DistanceXZ(point, building) < stopAt || Utils.DistanceXZ(point, hearth) < HearthGap)
                {
                    continue;
                }

                if (!ZoneSystem.instance.GetGroundHeight(point, out float y))
                {
                    continue;
                }

                point.y = y;
                TerrainOp.Settings settings = TerrainShaper.NewSettings();
                settings.m_paintCleared = true;
                settings.m_paintType = TerrainModifier.PaintType.Dirt;
                settings.m_paintRadius = Width;
                settings.m_paintHeightCheck = false;
                TerrainShaper.Apply(point, settings);
            }
        }
    }
}
