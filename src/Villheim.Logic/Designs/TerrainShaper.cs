using System.Collections.Generic;
using System.Linq;
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

        public static void Apply(Vector3 position, TerrainOp.Settings settings, bool keepHearthPads = true)
        {
            // A small level, raise or smooth near a village hearth would put lumps in its flat ground (Tyler: the hearth
            // ground went lumpy after founding, from the notice board's floor pieces leveling the ground under them). The
            // paint still goes on; the height change is left out.
            if (keepHearthPads && (settings.m_level || settings.m_raise || settings.m_smooth) &&
                InHearthPad(position, Mathf.Max(settings.m_levelRadius, settings.m_smoothRadius), out float padHeight) &&
                !(settings.m_level && !settings.m_raise && !settings.m_smooth && Mathf.Abs(position.y + settings.m_levelOffset - padHeight) < 0.03f))
            {
                Village.Perf.Debug($"Terrain: a height change at {position} near a hearth was left out (the hearth ground stays flat).");
                settings = VillagerPrefab.ShallowCopy(settings);
                settings.m_level = false;
                settings.m_raise = false;
                settings.m_smooth = false;
                if (!settings.m_paintCleared)
                {
                    return;
                }
            }

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
        public static void LevelPad(Vector3 center, float levelRadius, float smoothRadius, float maxChange = 16f, bool keepHearthPads = true)
        {
            float edge = Mathf.Max(smoothRadius, levelRadius + 1f);
            List<(Vector3 Center, float Height)> pads = keepHearthPads ? HearthPads(center, edge) : null;
            int disagree = 0;
            int looked = 0;
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

                        if (pads != null && InPad(pads, point, center.y))
                        {
                            continue; // a hearth's flat ground at another height: left as it is
                        }

                        int i = y * width + x;
                        float current = baseHeight + compiler.m_levelDelta[i] + compiler.m_smoothDelta[i];
                        if (Village.Perf.Debugging && heightmap.m_heights != null && i < heightmap.m_heights.Count)
                        {
                            looked++;
                            if (Mathf.Abs(heightmap.m_heights[i] + origin.y - current) > 0.05f)
                            {
                                disagree++;
                            }
                        }

                        float weight = distance <= levelRadius ? 1f : Mathf.SmoothStep(1f, 0f, (distance - levelRadius) / (edge - levelRadius));
                        float wanted = Mathf.Lerp(current, center.y, weight);
                        compiler.m_levelDelta[i] = Mathf.Clamp(wanted - baseHeight, -maxChange, maxChange);
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

            if (disagree > 0)
            {
                Village.Perf.Debug($"Terrain: leveling at {center}: {disagree} of {looked} ground points stood away from their stored " +
                                   "base height and offsets (the ground there had changed since it was last built).");
            }
        }

        /// <summary>
        /// A flat box at the height of <paramref name="center"/>, turned by <paramref name="yaw"/>, blending back to
        /// the ground over <paramref name="blend"/> meters around it. The same direct height writes as LevelPad.
        /// </summary>
        public static void LevelBox(Vector3 center, float yaw, float halfX, float halfZ, float blend, float maxChange = 16f)
        {
            blend = Mathf.Max(0.25f, blend);
            Quaternion back = Quaternion.Inverse(Quaternion.Euler(0f, yaw, 0f));
            float reach = Mathf.Sqrt(halfX * halfX + halfZ * halfZ) + blend;
            List<(Vector3 Center, float Height)> pads = HearthPads(center, reach);
            Heightmaps.Clear();
            Heightmap.FindHeightmap(center, reach + 1f, Heightmaps);
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
                        Vector3 local = back * new Vector3(point.x - center.x, 0f, point.z - center.z);
                        float outside = new Vector2(Mathf.Max(0f, Mathf.Abs(local.x) - halfX), Mathf.Max(0f, Mathf.Abs(local.z) - halfZ)).magnitude;
                        if (outside > blend || !heightmap.GetWorldBaseHeight(point, out float baseHeight) || InPad(pads, point, center.y))
                        {
                            continue;
                        }

                        int i = y * width + x;
                        float current = baseHeight + compiler.m_levelDelta[i] + compiler.m_smoothDelta[i];
                        float weight = outside <= 0f ? 1f : Mathf.SmoothStep(1f, 0f, outside / blend);
                        float wanted = Mathf.Lerp(current, center.y, weight);
                        compiler.m_levelDelta[i] = Mathf.Clamp(wanted - baseHeight, -maxChange, maxChange);
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

        // ---------------------------------------------------------------- the hearths' flat ground

        /// <summary>How far round a hearth its ground is kept flat: the fire, the chest, the notice board, the store.</summary>
        public static float HearthPadRadius => Village.HearthGround.LevelRadius - 1f;

        /// <summary>The point is on a loaded village hearth's flat ground (with <paramref name="margin"/> more round it).</summary>
        public static bool InHearthPad(Vector3 point, float margin, out float height)
        {
            foreach (VillageHearth hearth in VillageHearth.All)
            {
                if (hearth != null && hearth.IsValid && Utils.DistanceXZ(point, hearth.transform.position) < HearthPadRadius + margin)
                {
                    height = hearth.transform.position.y;
                    return true;
                }
            }

            height = 0f;
            return false;
        }

        private static List<(Vector3 Center, float Height)> HearthPads(Vector3 center, float reach)
        {
            List<(Vector3, float)> pads = null;
            foreach (VillageHearth hearth in VillageHearth.All)
            {
                if (hearth != null && hearth.IsValid && Utils.DistanceXZ(center, hearth.transform.position) < reach + HearthPadRadius)
                {
                    (pads ?? (pads = new List<(Vector3, float)>())).Add((hearth.transform.position, hearth.transform.position.y));
                }
            }

            return pads;
        }

        /// <summary>On a hearth pad whose height is not the one being set (setting it to its own height is harmless).</summary>
        private static bool InPad(List<(Vector3 Center, float Height)> pads, Vector3 point, float height)
        {
            if (pads == null)
            {
                return false;
            }

            foreach ((Vector3 c, float h) in pads)
            {
                if (Mathf.Abs(h - height) > 0.03f && Utils.DistanceXZ(point, c) < HearthPadRadius)
                {
                    return true;
                }
            }

            return false;
        }

        /// <summary>
        /// How far the ground strays from <paramref name="level"/> within <paramref name="radius"/> of the point,
        /// sampled every meter: the largest difference, up or down.
        /// </summary>
        public static float MaxDeviation(Vector3 center, float radius, float level)
        {
            float worst = 0f;
            for (float x = -radius; x <= radius; x += 1f)
            {
                for (float z = -radius; z <= radius; z += 1f)
                {
                    if (x * x + z * z > radius * radius)
                    {
                        continue;
                    }

                    if (ZoneSystem.instance.GetGroundHeight(center + new Vector3(x, 0f, z), out float h))
                    {
                        worst = Mathf.Max(worst, Mathf.Abs(h - level));
                    }
                }
            }

            return worst;
        }

        // ---------------------------------------------------------------- batching

        private static int _batch;
        private static bool _flushing;
        private static readonly Dictionary<Heightmap, bool> PendingPokes = new Dictionary<Heightmap, bool>();

        /// <summary>
        /// While the returned handle is open, terrain edits don't rebuild the ground's mesh and collider each time: each
        /// heightmap touched is rebuilt once when the handle is disposed. Many small edits in a row (a path laid all at
        /// once, a test village's pieces) had rebuilt the same heightmap dozens of times a frame. Use it only round work
        /// that finishes in the same frame.
        /// </summary>
        public static System.IDisposable Batch()
        {
            _batch++;
            return new BatchHandle();
        }

        private sealed class BatchHandle : System.IDisposable
        {
            private bool _done;

            public void Dispose()
            {
                if (_done)
                {
                    return;
                }

                _done = true;
                _batch = Mathf.Max(0, _batch - 1);
                if (_batch == 0)
                {
                    Flush();
                }
            }
        }

        private static void Flush()
        {
            List<KeyValuePair<Heightmap, bool>> pending = PendingPokes.ToList();
            PendingPokes.Clear();
            _flushing = true;
            try
            {
                foreach (KeyValuePair<Heightmap, bool> poke in pending)
                {
                    if (poke.Key != null)
                    {
                        poke.Key.Poke(0, poke.Value);
                    }
                }
            }
            finally
            {
                _flushing = false;
            }
        }

        [HarmonyLib.HarmonyPatch(typeof(Heightmap), nameof(Heightmap.Poke))]
        internal static class PokePatch
        {
            private static bool Prefix(Heightmap __instance, bool paintOnly)
            {
                if (_batch <= 0 || _flushing || __instance == null)
                {
                    return true;
                }

                PendingPokes[__instance] = PendingPokes.TryGetValue(__instance, out bool before) ? before && paintOnly : paintOnly;
                return false;
            }
        }

        /// <summary>Paints bare dirt over a box turned by <paramref name="yaw"/>, without changing the height.</summary>
        public static void PaintBox(Vector3 center, float yaw, float halfX, float halfZ)
        {
            Quaternion turn = Quaternion.Euler(0f, yaw, 0f);
            TerrainOp.Settings settings = NewSettings();
            settings.m_paintCleared = true;
            settings.m_paintType = TerrainModifier.PaintType.Dirt;
            settings.m_paintRadius = 1.5f;
            settings.m_paintHeightCheck = false;
            for (float x = -halfX + 1f; x <= halfX - 0.5f; x += 2f)
            {
                for (float z = -halfZ + 1f; z <= halfZ - 0.5f; z += 2f)
                {
                    Apply(center + turn * new Vector3(x, 0f, z), settings);
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
