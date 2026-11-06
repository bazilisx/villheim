using BepInEx.Configuration;
using Villheim.Logic.Village;

namespace Villheim.Logic
{
    /// <summary>
    /// Settings added by the logic assembly. They live in the same config file as the core's settings, so they can be
    /// added or changed without restarting the game.
    /// </summary>
    internal static class LogicConfig
    {
        public static ConfigEntry<string> BiomeMaterials;
        public static ConfigEntry<bool> SiteChest;
        public static ConfigEntry<float> SecondsPerPiece;
        public static ConfigEntry<int> StartingStock;
        public static ConfigEntry<float> FoodHealing;
        public static ConfigEntry<bool> VillageRaids;
        public static ConfigEntry<float> RaidChance;

        public static void Bind()
        {
            ConfigFile config = VillheimPlugin.Instance?.Config;
            if (config == null)
            {
                return;
            }

            const string work = "3b - Work and resources";
            BiomeMaterials = Admin(config, work, "BiomeMaterials", Materials.DefaultBiomeMaterials,
                "Which building materials can be found in each biome. A village only builds designs that can be made " +
                "from its own biome's materials, so a Meadows village never needs core wood.");
            SiteChest = Admin(config, work, "SiteChest", true,
                "Give each village a chest by its hearth. Villagers bring materials to it and the builder takes from it. " +
                "Anything you drop in helps the village build. If it is destroyed, the villagers build a new one first.");
            SecondsPerPiece = Admin(config, work, "SecondsPerPiece", 2.5f,
                "How long a builder hammers at each piece before it goes up.");
            StartingStock = Admin(config, work, "StartingStock", 0,
                "Wood a new village starts with (and half as much stone). At 0 the villagers gather everything " +
                "for their first building themselves.");
            FoodHealing = Admin(config, work, "FoodHealing", 1f,
                "Villagers heal like players: each food in effect heals its own regen value every 10 seconds for the " +
                "food's duration. This multiplies that healing.");
            VillageRaids = Admin(config, work, "VillageRaids", true,
                "Villages with three or more villagers are now and then raided by greydwarfs at night, warned of at dusk. " +
                "Only while a player is in the village.");
            RaidChance = Admin(config, work, "RaidChance", 0.2f,
                "Chance each dusk of a raid (plus 3% per village tier), never two nights running.");
        }

        private static ConfigEntry<T> Admin<T>(ConfigFile config, string section, string key, T value, string description)
        {
            var attributes = new ConfigurationManagerAttributes { IsAdminOnly = true };
            return config.Bind(section, key, value, new ConfigDescription(description, null, attributes));
        }
    }
}
