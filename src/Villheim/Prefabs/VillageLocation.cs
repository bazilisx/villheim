using Jotunn.Configs;
using Jotunn.Entities;
using Jotunn.Managers;
using UnityEngine;

namespace Villheim.Prefabs
{
    /// <summary>
    /// The world generator places "village sites": an otherwise empty location holding a single hearth.
    /// Everything else in the village is copied from existing designs at runtime as the village grows.
    /// </summary>
    public static class VillageLocation
    {
        public const string Name = VillheimPlugin.Prefix + "VillageSite";

        /// <summary>
        /// Runs every time a world loads, right before Jotunn adds custom locations to the ZoneSystem.
        /// The location only needs to be created once per game session.
        /// </summary>
        private static bool _registered;

        public static void Register()
        {
            if (_registered)
            {
                return;
            }

            if (HearthPrefab.Prefab == null)
            {
                // Normally created at the main menu; dedicated servers can reach this point first.
                HearthPrefab.Create();
                if (HearthPrefab.Prefab == null)
                {
                    return;
                }
            }

            Heightmap.Biome biomes = 0;
            if (VillheimConfig.SpawnInMeadows.Value) biomes |= Heightmap.Biome.Meadows;
            if (VillheimConfig.SpawnInBlackForest.Value) biomes |= Heightmap.Biome.BlackForest;
            if (biomes == 0 || VillheimConfig.VillageCount.Value <= 0)
            {
                VillheimPlugin.Log.LogInfo("Village generation is turned off in the config.");
                return;
            }

            GameObject container = ZoneManager.Instance.CreateLocationContainer(Name);
            GameObject hearth = Object.Instantiate(HearthPrefab.Prefab, container.transform);
            hearth.name = HearthPrefab.Name;
            hearth.transform.localPosition = Vector3.zero;
            hearth.transform.localRotation = Quaternion.identity;

            var config = new LocationConfig
            {
                Biome = biomes,
                BiomeArea = Heightmap.BiomeArea.Median,
                Quantity = VillheimConfig.VillageCount.Value,
                Priotized = false,
                ExteriorRadius = 12f,
                ClearArea = true,
                RandomRotation = true,
                MinAltitude = 2f,
                MaxTerrainDelta = 3f,
                MinDistance = VillheimConfig.MinDistanceFromSpawn.Value,
                MinDistanceFromSimilar = VillheimConfig.MinDistanceBetweenVillages.Value,
                Group = "Villheim",
                IconPlaced = false,
            };

            var custom = new CustomLocation(container, false, config);
            if (custom.Location != null)
            {
                // Let players build next to and inside villages, like Millenaire does.
                custom.Location.m_noBuild = false;
            }

            ZoneManager.Instance.AddCustomLocation(custom);
            _registered = true;
            VillheimPlugin.Log.LogInfo($"Registered village sites ({config.Quantity} in {biomes}).");
        }
    }
}
