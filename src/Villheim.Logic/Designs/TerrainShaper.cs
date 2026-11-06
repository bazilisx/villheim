using System.Collections.Generic;
using UnityEngine;
using Villheim.Prefabs;

namespace Villheim.Logic.Designs
{
    /// <summary>
    /// Permanent terrain edits, saved in the world like hoe edits.
    ///
    /// Since Valheim 1.0 a TerrainOp is sent over the network as its prefab hash, so a TerrainOp made at runtime
    /// cannot be used. Instead this takes ownership of each affected terrain compiler and runs the operation on it
    /// directly, which is what the owner does when it receives a hoe edit.
    /// </summary>
    internal static class TerrainShaper
    {
        private const string TemplatePrefab = "mud_road_v2";
        private static readonly List<Heightmap> Heightmaps = new List<Heightmap>();

        /// <summary>
        /// Settings with every operation turned off. Starts from the vanilla level-ground op so that any
        /// newer fields (paint curves and so on) have the game's own values.
        /// </summary>
        public static TerrainOp.Settings NewSettings()
        {
            GameObject prefab = ZNetScene.instance ? ZNetScene.instance.GetPrefab(TemplatePrefab) : null;
            TerrainOp template = prefab ? prefab.GetComponent<TerrainOp>() : null;
            TerrainOp.Settings settings = template != null
                ? VillagerPrefab.ShallowCopy(template.m_settings)
                : new TerrainOp.Settings();

            settings.m_level = false;
            settings.m_levelOffset = 0f;
            settings.m_raise = false;
            settings.m_smooth = false;
            settings.m_paintCleared = false;
            settings.m_square = false;
            settings.m_rotation = false;
            return settings;
        }

        public static void Apply(Vector3 position, TerrainOp.Settings settings)
        {
            Heightmaps.Clear();
            Heightmap.FindHeightmap(position, settings.GetRadius() + 1f, Heightmaps);
            foreach (Heightmap heightmap in Heightmaps)
            {
                TerrainComp compiler = heightmap.GetAndCreateTerrainCompiler();
                if (compiler == null || compiler.m_nview == null || !compiler.m_nview.IsValid())
                {
                    continue;
                }

                if (!compiler.IsOwner())
                {
                    compiler.m_nview.ClaimOwnership();
                }

                compiler.DoOperation(position, Vector3.zero, settings);
            }
        }

        /// <summary>Flattens a round pad at the height of <paramref name="center"/> and smooths its edge.</summary>
        public static void LevelPad(Vector3 center, float levelRadius, float smoothRadius)
        {
            TerrainOp.Settings settings = NewSettings();
            settings.m_level = true;
            settings.m_levelRadius = levelRadius;
            settings.m_smooth = true;
            settings.m_smoothRadius = Mathf.Max(smoothRadius, levelRadius + 1f);
            settings.m_smoothPower = 3f;
            Apply(center, settings);
        }

        /// <summary>Same operation as a location's terrain modifier, as a permanent edit.</summary>
        public static void ApplyModifier(Vector3 position, TerrainModifier modifier)
        {
            TerrainOp.Settings settings = NewSettings();
            settings.m_levelOffset = modifier.m_levelOffset;
            settings.m_level = modifier.m_level;
            settings.m_levelRadius = modifier.m_levelRadius;
            settings.m_square = modifier.m_square;
            settings.m_smooth = modifier.m_smooth;
            settings.m_smoothRadius = modifier.m_smoothRadius;
            settings.m_smoothPower = modifier.m_smoothPower;
            settings.m_paintCleared = modifier.m_paintCleared;
            settings.m_paintHeightCheck = modifier.m_paintHeightCheck;
            settings.m_paintType = modifier.m_paintType;
            settings.m_paintRadius = modifier.m_paintRadius;
            if (modifier.m_paintStrength > 0f)
            {
                settings.m_paintStrength = modifier.m_paintStrength;
            }

            Apply(position, settings);
        }
    }
}
