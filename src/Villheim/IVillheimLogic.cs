namespace Villheim
{
    /// <summary>
    /// The contract between the core plugin and the hot-reloadable logic assembly.
    /// The core owns everything Unity and the network need to exist (prefabs, components, patches, commands);
    /// the logic decides what those things do.
    ///
    /// Changing this interface means changing the core, which needs a game restart.
    /// </summary>
    public interface IVillheimLogic
    {
        /// <summary>A short description of this build, shown in the log when it loads.</summary>
        string BuildInfo { get; }

        /// <summary>Called right after this logic instance becomes active.</summary>
        void OnLoad();

        /// <summary>Called right before this logic instance is replaced by a newer build.</summary>
        void OnUnload();

        /// <summary>Apply tuning (AI, stats, dialogue) to the prefabs and to any live instances.</summary>
        void ConfigurePrefabs();

        void HearthTick(VillageHearth hearth);
        string HearthHoverText(VillageHearth hearth);
        string HearthHoverName(VillageHearth hearth);
        void HearthInteract(VillageHearth hearth, Humanoid user);

        void VillagerUpdate(Villager villager, float deltaTime);
        string VillagerHoverText(Villager villager);
        bool VillagerInteract(Villager villager, Humanoid user);

        /// <summary>Runs a console command. Returns false if this build does not know the command.</summary>
        bool RunCommand(string name, string[] args, Terminal context);

        /// <summary>Command names and one-line help, for the 'vh' command.</summary>
        string[] CommandHelp();
    }
}
