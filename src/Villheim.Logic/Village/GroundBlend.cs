using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Eases the ground between building pads at different heights (T-57: a test village on a slope looked stepped,
    /// with short cliffs between its levels). Every terrain point between two pads (each a building's levelled pad, and
    /// the hearth's) is moved toward a straight slope from the one pad's height to the other's, by how far it is from
    /// each. The pads themselves and a metre round them are never touched, so nothing built moves or floats; points
    /// more than BlendReach from a second pad stay as they are. Written the same way as TerrainShaper.LevelPad, into the
    /// terrain's stored height offsets, and saved with the world.
    /// </summary>
    internal static class GroundBlend
    {
        /// <summary>How far the slope between two pads reaches (GroundBlendReach). It had been 14 m: steep slopes (T-57 retest).</summary>
        private static float BlendReach => LogicConfig.GroundBlendReach != null ? Mathf.Clamp(LogicConfig.GroundBlendReach.Value, 6f, 60f) : 24f;
        private const float Margin = 1f;

        private static readonly List<Heightmap> Heightmaps = new List<Heightmap>();

        private struct Pad
        {
            public Vector3 Center;
            public float Radius;
            public float Height;
        }

        /// <summary>Blends the ground between the village's pads. Returns how many terrain points moved.</summary>
        public static int Between(VillageHearth hearth)
        {
            var state = new VillageState(hearth.Zdo);
            var pads = new List<Pad>
            {
                new Pad { Center = hearth.transform.position, Radius = HearthGround.LevelRadius, Height = hearth.transform.position.y },
            };

            foreach (Plot plot in state.Plots)
            {
                if (ZoneSystem.instance.GetGroundHeight(plot.Position, out float y))
                {
                    pads.Add(new Pad { Center = plot.Position, Radius = plot.Radius * 0.6f + 1.5f, Height = y });
                }
            }

            if (pads.Count < 2)
            {
                return 0;
            }

            Vector3 middle = hearth.transform.position;
            float blendReach = BlendReach;
            float minGap = LogicConfig.GroundBlendMinGap != null ? Mathf.Max(0.05f, LogicConfig.GroundBlendMinGap.Value) : 0.3f;
            float reach = pads.Max(p => Utils.DistanceXZ(p.Center, middle) + p.Radius) + blendReach;
            int moved = 0;
            Heightmaps.Clear();
            Heightmap.FindHeightmap(middle, reach, Heightmaps);
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
                for (int z = 0; z < width; z++)
                {
                    for (int x = 0; x < width; x++)
                    {
                        var point = new Vector3(origin.x + (x - compiler.m_width / 2f) * scale, 0f, origin.z + (z - compiler.m_width / 2f) * scale);
                        if (Utils.DistanceXZ(point, middle) > reach)
                        {
                            continue;
                        }

                        // The two nearest pads by distance from their edges.
                        Pad a = default, b = default;
                        float da = float.MaxValue, db = float.MaxValue;
                        bool onPad = false;
                        foreach (Pad pad in pads)
                        {
                            float d = Utils.DistanceXZ(point, pad.Center) - pad.Radius;
                            if (d < Margin)
                            {
                                onPad = true;
                                break;
                            }

                            if (d < da)
                            {
                                b = a;
                                db = da;
                                a = pad;
                                da = d;
                            }
                            else if (d < db)
                            {
                                b = pad;
                                db = d;
                            }
                        }

                        if (onPad || db > blendReach || Mathf.Abs(a.Height - b.Height) < minGap ||
                            !heightmap.GetWorldBaseHeight(point, out float baseHeight))
                        {
                            continue;
                        }

                        int i = z * width + x;
                        float current = baseHeight + compiler.m_levelDelta[i] + compiler.m_smoothDelta[i];
                        float target = (a.Height * db + b.Height * da) / (da + db);
                        // Full weight over most of the reach, fading out smoothly over its last third, so the eased
                        // ground meets the land beyond without a new edge.
                        float weight = Mathf.SmoothStep(0f, 1f, Mathf.Clamp01((blendReach - db) / (blendReach * 0.35f))) *
                                       Mathf.Clamp01((da - Margin) / 2f + 0.5f);
                        float wanted = Mathf.Lerp(current, target, weight);
                        if (Mathf.Abs(wanted - current) < 0.02f)
                        {
                            continue;
                        }

                        compiler.m_levelDelta[i] = Mathf.Clamp(wanted - baseHeight, -16f, 16f);
                        compiler.m_smoothDelta[i] = 0f;
                        compiler.m_modifiedHeight[i] = true;
                        changed = true;
                        moved++;
                    }
                }

                if (changed)
                {
                    compiler.m_operations++;
                    compiler.Save();
                    heightmap.Poke(0, false);
                }
            }

            return moved;
        }
    }
}
