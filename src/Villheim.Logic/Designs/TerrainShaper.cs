using UnityEngine;

namespace Villheim.Logic.Designs
{
    /// <summary>
    /// Permanent terrain edits, made the same way the hoe makes them: a TerrainOp that applies itself to the
    /// nearby terrain compilers (saved in the world) and then removes itself.
    /// </summary>
    internal static class TerrainShaper
    {
        public static void Apply(Vector3 position, TerrainOp.Settings settings)
        {
            var go = new GameObject(VillheimPlugin.Prefix + "TerrainOp");
            go.SetActive(false);
            go.transform.position = position;

            TerrainOp op = go.AddComponent<TerrainOp>();
            op.m_settings = settings;
            op.m_onPlacedEffect = new EffectList();
            op.m_spawnOnPlaced = null;

            // Awake runs on activation: the operation is applied and the object destroys itself.
            go.SetActive(true);
        }

        /// <summary>Flattens a round pad at the height of <paramref name="center"/> and smooths its edge.</summary>
        public static void LevelPad(Vector3 center, float levelRadius, float smoothRadius)
        {
            Apply(center, new TerrainOp.Settings
            {
                m_level = true,
                m_levelRadius = levelRadius,
                m_levelOffset = 0f,
                m_square = false,
                m_smooth = true,
                m_smoothRadius = Mathf.Max(smoothRadius, levelRadius + 1f),
                m_smoothPower = 3f,
                m_paintCleared = false,
            });
        }
    }
}
