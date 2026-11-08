using System.Linq;
using System.Reflection;
using HarmonyLib;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Levels and paints the ground with PlanBuild's own terrain tools (PlanBuild.Blueprints.TerrainTools, WTFPL), the
    /// code PlanBuild uses to put a blueprint's terrain down. Called by name, so Villheim does not depend on PlanBuild;
    /// without it, the ground is left alone and Available says why.
    ///
    /// Villheim's own writer (2026-11-07) went wrong in two ways PlanBuild's does not: it added a height change once per
    /// sample instead of setting it once per ground point (several samples share a point), which raised ridges; and it
    /// wrote a point only into one 64 m ground area when the areas on both sides of an edge keep that point, which left
    /// straight-edged gaps. PlanBuild finds every area under a change, writes each point once, and saves and refreshes
    /// the ground after every change.
    /// </summary>
    internal static class PlanBuildTerrain
    {
        private static bool _looked;
        private static MethodInfo _rect;
        private static MethodInfo _level;
        private static MethodInfo _paint;
        private static object _blockOff;

        public static string Missing { get; private set; } = "";

        public static bool Available
        {
            get
            {
                if (!_looked)
                {
                    _looked = true;
                    System.Type tools = AccessTools.TypeByName("PlanBuild.Blueprints.TerrainTools");
                    System.Type block = AccessTools.TypeByName("PlanBuild.Blueprints.BlockCheck");
                    if (tools == null || block == null)
                    {
                        Missing = "PlanBuild's terrain tools were not found (is PlanBuild installed?)";
                        return false;
                    }

                    MethodInfo[] methods = tools.GetMethods(BindingFlags.Public | BindingFlags.Static);
                    _rect = methods.FirstOrDefault(m => m.Name == "GetCompilerIndicesWithRect" && m.GetParameters().Length == 5);
                    _level = methods.FirstOrDefault(m => m.Name == "LevelTerrain" && m.GetParameters().Length == 5);
                    _paint = methods.FirstOrDefault(m => m.Name == "PaintTerrain" && m.GetParameters().Length == 4 &&
                                                         m.GetParameters()[3].ParameterType == typeof(TerrainModifier.PaintType));
                    _blockOff = System.Enum.Parse(block, "Off");
                    if (_rect == null || _level == null || _paint == null)
                    {
                        Missing = "this PlanBuild version has no " + (_rect == null ? "GetCompilerIndicesWithRect" : _level == null ? "LevelTerrain" : "PaintTerrain");
                    }
                }

                return _rect != null && _level != null && _paint != null;
            }
        }

        /// <summary>
        /// Levels a rectangle (width across its turn, depth along it; yaw in degrees) to a height, and paints it if
        /// paint is Dirt, Paved, Cultivate or Reset. Returns false (doing nothing) without PlanBuild.
        /// </summary>
        public static bool Apply(Vector3 middle, float width, float depth, float yaw, float? height, string paint)
        {
            if (!Available)
            {
                return false;
            }

            object indices = _rect.Invoke(null, new object[] { middle, width, depth, yaw * Mathf.Deg2Rad, _blockOff });
            float radius = Mathf.Max(width, depth) / 2f;
            if (height.HasValue)
            {
                _level.Invoke(null, new object[] { indices, middle, radius, 0f, height.Value });
            }

            if (!string.IsNullOrEmpty(paint))
            {
                var type = (TerrainModifier.PaintType)System.Enum.Parse(typeof(TerrainModifier.PaintType), paint);
                _paint.Invoke(null, new object[] { indices, middle, radius, type });
            }

            return true;
        }
    }
}
