namespace Villheim
{
    /// <summary>
    /// ZDO keys. These are saved in worlds, so never rename one once a version has shipped.
    /// </summary>
    public static class Keys
    {
        // On the hearth.
        public static readonly int Initialized = "villheim_init".GetStableHashCode();
        public static readonly int VillageId = "villheim_id".GetStableHashCode();
        public static readonly int Seed = "villheim_seed".GetStableHashCode();
        public static readonly int Name = "villheim_name".GetStableHashCode();
        public static readonly int Biome = "villheim_biome".GetStableHashCode();
        public static readonly int LastGrowth = "villheim_last_growth".GetStableHashCode();
        public static readonly int LastArrival = "villheim_last_arrival".GetStableHashCode();
        public static readonly int Arrivals = "villheim_arrivals".GetStableHashCode();
        public static readonly int Plots = "villheim_plots".GetStableHashCode();

        // On villagers.
        public static readonly int VillagerVillage = "villheim_village".GetStableHashCode();
        public static readonly int VillagerVillageName = "villheim_village_name".GetStableHashCode();
        public static readonly int VillagerName = "villheim_name".GetStableHashCode();
        public static readonly int VillagerSeed = "villheim_seed".GetStableHashCode();
        public static readonly int VillagerHome = "villheim_home".GetStableHashCode();
        public static readonly int VillagerHearth = "villheim_hearth".GetStableHashCode();

        // On every object a village builds: the id of the village that built it.
        public static readonly int BuiltBy = "villheim_v".GetStableHashCode();
    }
}
