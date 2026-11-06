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
        /// <summary>
        /// A perfectly flat round pad at the height of <paramref name="center"/>, blending back to the ground around
        /// it out to <paramref name="smoothRadius"/>. The game's own level operation left pads lumpy, so this writes the
        /// terrain's stored height offsets directly, the way terrain editing mods do: every terrain point inside the
        /// pad is set to exactly the pad's height, and points in the ring beyond move part of the way there, less the
        /// further out they are. Saved with the world like any terrain edit.
        /// </summary>
        public static void LevelPad(Vector3 center, float levelRadius, float smoothRadius)
        {
            float edge = Mathf.Max(smoothRadius, levelRadius + 1f);
            Heightmaps.Clear();
            Heightmap.FindHeightmap(center, edge + 1f, Heightmaps);
            foreach (Heightmap heightmap in Heightmaps)
            {
                TerrainComp compiler = heightmap.GetAndCreateTerrainCompiler();
                if (compiler == null || compiler.m_nview == null || !compiler.m_nview.IsValid() || compiler.m_levelDelta == null)
                {
                    continue;
                }

                if (!compiler.IsOwner())
                {
                    compiler.m_nview.ClaimOwnership();
                }

                int width = compiler.m_width + 1;
                float scale = heightmap.m_scale;
                Vector3 origin = heightmap.transform.position;
                bool changed = false;
                for (int y = 0; y < width; y++)
                {
                    for (int x = 0; x < width; x++)
                    {
                        var point = new Vector3(origin.x + (x - compiler.m_width / 2f) * scale, 0f, origin.z + (y - compiler.m_width / 2f) * scale);
                        float distance = Utils.DistanceXZ(point, center);
                        if (distance > edge || !heightmap.GetWorldBaseHeight(point, out float baseHeight))
                        {
                            continue;
                        }

                        int i = y * width + x;
                        float current = baseHeight + compiler.m_levelDelta[i] + compiler.m_smoothDelta[i];
                        float weight = distance <= levelRadius ? 1f : Mathf.SmoothStep(1f, 0f, (distance - levelRadius) / (edge - levelRadius));
                        float wanted = Mathf.Lerp(current, center.y, weight);
                        compiler.m_levelDelta[i] = Mathf.Clamp(wanted - baseHeight, -16f, 16f);
                        compiler.m_smoothDelta[i] = 0f;
                        compiler.m_modifiedHeight[i] = true;
                        changed = true;
                    }
                }

                if (changed)
                {
                    compiler.m_operations++;
                    compiler.Save();
                    heightmap.Poke(0, false);
                }
            }
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
