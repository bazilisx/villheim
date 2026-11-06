using System.IO;
using BepInEx;
using BepInEx.Logging;
using HarmonyLib;
using Jotunn.Managers;
using Jotunn.Utils;
using Villheim.Prefabs;

namespace Villheim
{
    /// <summary>
    /// Villheim: NPC villages that grow over time, assembled only from designs that already exist in the game.
    ///
    /// This assembly is the stable core. Village behaviour lives in Villheim.Logic.dll, which
    /// <see cref="LogicHost"/> reloads while the game runs.
    /// </summary>
    [BepInPlugin(ModGuid, ModName, ModVersion)]
    [BepInDependency(Jotunn.Main.ModGuid)]
    [NetworkCompatibility(CompatibilityLevel.EveryoneMustHaveMod, VersionStrictness.Minor)]
    public class VillheimPlugin : BaseUnityPlugin
    {
        public const string ModGuid = "bazilisx.villheim";
        public const string ModName = "Villheim";
        public const string ModVersion = "0.1.0";

        /// <summary>Prefix for every prefab and location this mod registers.</summary>
        public const string Prefix = "Villheim_";

        public static VillheimPlugin Instance { get; private set; }
        public static ManualLogSource Log { get; private set; }
        public static bool PrefabsReady { get; private set; }

        private readonly Harmony _harmony = new Harmony(ModGuid);

        private void Awake()
        {
            Instance = this;
            Log = Logger;

            VillheimConfig.Bind(Config);

            PrefabManager.OnVanillaPrefabsAvailable += OnVanillaPrefabsAvailable;
            ZoneManager.OnVanillaLocationsAvailable += VillageLocation.Register;
            Commands.Register();

            _harmony.PatchAll(typeof(VillheimPlugin).Assembly);
            LogicHost.Init(Path.GetDirectoryName(Info.Location));
            Log.LogInfo($"{ModName} {ModVersion} loaded.");
        }

        private void Update()
        {
            LogicHost.Poll();
        }

        private void OnDestroy()
        {
            _harmony.UnpatchSelf();
        }

        private static void OnVanillaPrefabsAvailable()
        {
            // Jotunn keeps registered prefabs for the whole game session, so this only needs to run once.
            PrefabManager.OnVanillaPrefabsAvailable -= OnVanillaPrefabsAvailable;

            HearthPrefab.Create();
            VillagerPrefab.Create();
            PrefabsReady = true;
            LogicHost.Call(logic => logic.ConfigurePrefabs());
        }

        public static void Debug(string message)
        {
            if (VillheimConfig.VerboseLogging.Value)
            {
                Log.LogInfo(message);
            }
        }
    }
}
