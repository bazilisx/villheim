using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Villheim.Logic.Designs
{
    /// <summary>
    /// Which side of a design its front door is on, so the door, and not just the design's +Z side, faces the hearth
    /// and the path starts there (Millénaire turns each plan so its door faces the village centre). Found once per
    /// design from its ground-floor door pieces: the side their middle lies toward, as a turn of 0, 90, 180 or 270
    /// degrees from +Z. A design with no door counts as facing +Z.
    /// </summary>
    internal static class Doors
    {
        private static readonly Dictionary<string, float> Cache = new Dictionary<string, float>();

        public static float Angle(string designName)
        {
            if (string.IsNullOrEmpty(designName))
            {
                return 0f;
            }

            if (Cache.TryGetValue(designName, out float known))
            {
                return known;
            }

            DesignLibrary.Design? design = DesignLibrary.ByName(designName);
            float angle = design.HasValue ? SafeCompute(design.Value) : 0f;
            Cache[designName] = angle;
            return angle;
        }

        public static float Angle(DesignLibrary.Design design)
        {
            if (Cache.TryGetValue(design.Name, out float known))
            {
                return known;
            }

            float angle = SafeCompute(design);
            Cache[design.Name] = angle;
            return angle;
        }

        private static float SafeCompute(DesignLibrary.Design design)
        {
            try
            {
                return Compute(design);
            }
            catch (System.Exception e)
            {
                VillheimPlugin.Log.LogWarning($"Doors: could not look at {design.Name}: {e.Message}");
                return 0f;
            }
        }

        private static float Compute(DesignLibrary.Design design)
        {
            List<DesignSpawner.PlanEntry> plan = null;
            if (design.Blueprint != null)
            {
                plan = Blueprints.MakePlan(design.Blueprint, Vector3.zero, 0f);
            }
            else if (design.Location != null)
            {
                Designs.AssetGuard.Load(design.Location);
                try
                {
                    GameObject asset = design.Location.m_prefab.Asset;
                    if (asset != null)
                    {
                        plan = DesignSpawner.MakePlan(asset, Vector3.zero, 1, 0f, false);
                    }
                }
                finally
                {
                    design.Location.m_prefab.Release();
                }
            }

            if (plan == null)
            {
                return 0f;
            }

            float lowest = plan.Where(e => e.Bounds.HasValue).Select(e => e.Bounds.Value.min.y).DefaultIfEmpty(0f).Min();
            List<Vector3> doors = plan
                .Where(e => e.LocalPosition.y < lowest + 2.5f && ZNetScene.instance.GetPrefab(e.Prefab)?.GetComponent<Door>() != null)
                .Select(e => e.LocalPosition).ToList();
            if (doors.Count == 0)
            {
                return 0f;
            }

            var middle = new Vector3(doors.Average(d => d.x), 0f, doors.Average(d => d.z));
            if (middle.magnitude < 0.5f)
            {
                return 0f;
            }

            float angle = Mathf.Atan2(middle.x, middle.z) * Mathf.Rad2Deg;
            float snapped = Mathf.Repeat(Mathf.Round(angle / 90f) * 90f, 360f);
            VillheimPlugin.Debug($"Doors: {design.Name} has its door on the {snapped:0} degree side ({doors.Count} door pieces).");
            return snapped;
        }
    }
}
