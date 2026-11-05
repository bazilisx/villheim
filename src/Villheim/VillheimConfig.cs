using BepInEx.Configuration;

namespace Villheim
{
    /// <summary>
    /// All user settings. Entries marked admin-only are synced from the server to clients by Jotunn.
    /// </summary>
    internal static class VillheimConfig
    {
        // World generation
        public static ConfigEntry<int> VillageCount;
        public static ConfigEntry<bool> SpawnInMeadows;
        public static ConfigEntry<bool> SpawnInBlackForest;
        public static ConfigEntry<float> MinDistanceBetweenVillages;
        public static ConfigEntry<float> MinDistanceFromSpawn;

        // Growth
        public static ConfigEntry<int> StartingBuildings;
        public static ConfigEntry<int> MaxBuildings;
        public static ConfigEntry<float> DaysPerBuilding;
        public static ConfigEntry<float> VillageRadius;

        // Designs
        public static ConfigEntry<string> MeadowsDesigns;
        public static ConfigEntry<string> BlackForestDesigns;
        public static ConfigEntry<string> AnyBiomeDesigns;
        public static ConfigEntry<float> MaxDesignRadius;
        public static ConfigEntry<string> ExcludedObjects;
        public static ConfigEntry<bool> KeepLootContainers;
        public static ConfigEntry<bool> UseVanillaRandomness;
        public static ConfigEntry<bool> CopyTerrainShaping;

        // Villagers
        public static ConfigEntry<int> StartingVillagers;
        public static ConfigEntry<int> VillagersPerBuilding;
        public static ConfigEntry<int> MaxVillagers;
        public static ConfigEntry<float> DaysPerNewVillager;
        public static ConfigEntry<float> VillagerHealth;
        public static ConfigEntry<bool> VillagersGatherAtNight;
        public static ConfigEntry<bool> VillagerChatter;

        // Debug
        public static ConfigEntry<bool> VerboseLogging;

        public static void Bind(ConfigFile config)
        {
            const string world = "1 - World generation";
            VillageCount = Admin(config, world, "VillageCount", 30,
                "How many village sites the world generator tries to place. Only affects newly generated areas " +
                "(new worlds, or unexplored areas after running the 'genloc' console command).",
                new AcceptableValueRange<int>(0, 300));
            SpawnInMeadows = Admin(config, world, "SpawnInMeadows", true, "Villages can appear in the Meadows.");
            SpawnInBlackForest = Admin(config, world, "SpawnInBlackForest", true, "Villages can appear in the Black Forest.");
            MinDistanceBetweenVillages = Admin(config, world, "MinDistanceBetweenVillages", 600f,
                "Minimum distance in meters between two village sites.", new AcceptableValueRange<float>(100f, 5000f));
            MinDistanceFromSpawn = Admin(config, world, "MinDistanceFromSpawn", 300f,
                "Villages will not generate closer than this to the world center (the sacrificial stones).",
                new AcceptableValueRange<float>(0f, 5000f));

            const string growth = "2 - Growth";
            StartingBuildings = Admin(config, growth, "StartingBuildings", 1,
                "Buildings a village has when you first find it.", new AcceptableValueRange<int>(0, 20));
            MaxBuildings = Admin(config, growth, "MaxBuildings", 6,
                "The most buildings a village will grow to.", new AcceptableValueRange<int>(1, 40));
            DaysPerBuilding = Admin(config, growth, "DaysPerBuilding", 2f,
                "In-game days between new buildings. A Valheim day is 30 real minutes by default. " +
                "Villages only grow while someone is nearby, but they catch up on missed time when you return.",
                new AcceptableValueRange<float>(0.05f, 100f));
            VillageRadius = Admin(config, growth, "VillageRadius", 60f,
                "How far from the hearth a village may place buildings, in meters.",
                new AcceptableValueRange<float>(20f, 150f));

            const string designs = "3 - Designs";
            MeadowsDesigns = Admin(config, designs, "MeadowsDesigns",
                "WoodHouse1,WoodHouse2,WoodHouse3,WoodHouse4,WoodHouse5,WoodHouse6,WoodHouse7,WoodHouse8," +
                "WoodHouse9,WoodHouse10,WoodHouse11,WoodHouse12,WoodHouse13,WoodFarm1:0.25",
                "Existing locations that Meadows villages copy buildings from, as a comma separated list of location " +
                "names. Add ':weight' to make a design rarer or more common (default weight is 1). " +
                "Locations from other installed mods work too: use 'villheim_locations' in the console to list names.");
            BlackForestDesigns = Admin(config, designs, "BlackForestDesigns",
                "AbandonedLogCabin02,AbandonedLogCabin03,AbandonedLogCabin04,WoodHouse3,WoodHouse7,WoodHouse11",
                "Existing locations that Black Forest villages copy buildings from. Same format as MeadowsDesigns.");
            AnyBiomeDesigns = Admin(config, designs, "AnyBiomeDesigns", "",
                "Extra designs added to every village's pool, for example locations from More World Locations.");
            MaxDesignRadius = Admin(config, designs, "MaxDesignRadius", 34f,
                "Designs whose footprint radius is larger than this are skipped.", new AcceptableValueRange<float>(4f, 80f));
            ExcludedObjects = Admin(config, designs, "ExcludedObjects",
                "Spawner,TreasureChest,BonePile,Vines,vines,Skeleton,Draugr,Ghost",
                "Objects inside a design whose prefab name contains any of these words are left out. " +
                "Creatures, creature spawners and dungeon entrances are always left out.");
            KeepLootContainers = Admin(config, designs, "KeepLootContainers", false,
                "Keep the loot chests that some designs contain.");
            UseVanillaRandomness = Admin(config, designs, "UseVanillaRandomness", true,
                "Many vanilla locations randomly include or leave out some of their parts. When on, each copy " +
                "rolls those parts the same way the world generator would. When off, every optional part is built.");
            CopyTerrainShaping = Admin(config, designs, "CopyTerrainShaping", true,
                "Copy each design's own ground leveling. When off, a simple flat circle is leveled instead.");

            const string villagers = "4 - Villagers";
            StartingVillagers = Admin(config, villagers, "StartingVillagers", 2,
                "Villagers that arrive right away when a village is first found.", new AcceptableValueRange<int>(0, 20));
            VillagersPerBuilding = Admin(config, villagers, "VillagersPerBuilding", 2,
                "Population a village can support per building.", new AcceptableValueRange<int>(0, 10));
            MaxVillagers = Admin(config, villagers, "MaxVillagers", 12,
                "Hard cap on villagers per village.", new AcceptableValueRange<int>(0, 50));
            DaysPerNewVillager = Admin(config, villagers, "DaysPerNewVillager", 0.5f,
                "In-game days between new arrivals while a village has room. Also how fast losses are replaced.",
                new AcceptableValueRange<float>(0.02f, 50f));
            VillagerHealth = Admin(config, villagers, "VillagerHealth", 120f,
                "Villager health.", new AcceptableValueRange<float>(10f, 2000f));
            VillagersGatherAtNight = Admin(config, villagers, "VillagersGatherAtNight", true,
                "At night villagers stay close to the village hearth.");
            VillagerChatter = config.Bind(villagers, "VillagerChatter", true,
                "Villagers greet you and talk now and then (client side).");

            VerboseLogging = config.Bind("5 - Debug", "VerboseLogging", false,
                "Write detailed growth and placement information to the BepInEx log.");
        }

        private static ConfigEntry<T> Admin<T>(ConfigFile config, string section, string key, T value, string description,
            AcceptableValueBase range = null)
        {
            var attributes = new ConfigurationManagerAttributes { IsAdminOnly = true };
            return config.Bind(section, key, value, new ConfigDescription(description, range, attributes));
        }
    }
}
