using System.Reflection;
using HarmonyLib;
using Villheim.Logic.Village;
using Villheim.Logic.Villagers;

namespace Villheim.Logic
{
    /// <summary>
    /// Entry point of the logic assembly. The core finds this class by its interface and creates one instance per load.
    /// </summary>
    public sealed class VillheimLogic : IVillheimLogic
    {
        public string BuildInfo => Build;

        /// <summary>"Villheim.Logic 0.1.0+commit-abc1234-20261106-051200": version, git commit and build time.</summary>
        public static string Build
        {
            get
            {
                var info = typeof(VillheimLogic).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>();
                return "Villheim.Logic " + (info?.InformationalVersion ?? "unknown build");
            }
        }

        // Patches owned by this logic build. They come off when the build is unloaded, so a reload never stacks them.
        private Harmony _harmony;

        public void OnLoad()
        {
            _harmony = new Harmony("bazilisx.villheim.logic");
            _harmony.PatchAll(typeof(VillheimLogic).Assembly);
            LogicConfig.Bind();
            ConfigWatcher.Start();
            Village.Gallery.StartAutoList();
        }

        public void OnUnload()
        {
            _harmony?.UnpatchSelf();
            _harmony = null;
        }

        public void ConfigurePrefabs()
        {
            VillagerTuning.ApplyToAll();
        }

        public void HearthTick(VillageHearth hearth) => VillageBrain.Tick(hearth);

        public string HearthHoverText(VillageHearth hearth) =>
            $"{hearth.VillageName} hearth\n<color=#b0b0b0>{VillageBrain.Summary(hearth)}</color>" +
            $"\n<color=#b0b0b0>The village feels {Village.VillageMood.Label(Village.VillageMood.Get(hearth.VillageId))}.</color>" +
            $"\n<size=12><color=#808080>{Build}</color></size>";

        public string HearthHoverName(VillageHearth hearth) => $"{hearth.VillageName} hearth";

        public void HearthInteract(VillageHearth hearth, Humanoid user)
        {
            if (user == Player.m_localPlayer)
            {
                Village.Chronicle.Show(hearth);
            }
        }

        public void VillagerUpdate(Villager villager, float deltaTime) => VillagerBehaviour.Update(villager, deltaTime);

        public bool VillagerUpdateAI(VillagerAI ai, float deltaTime)
        {
            return ai.TryGetComponent(out Villager villager) && villager.IsValidVillager &&
                   Brain.Update(villager, ai, deltaTime);
        }

        public string VillagerHoverText(Villager villager) => VillagerBehaviour.HoverText(villager);

        public bool VillagerInteract(Villager villager, Humanoid user) => VillagerBehaviour.Interact(villager, user);

        public bool RunCommand(string name, string[] args, Terminal context) => LogicCommands.Run(name, args, context);

        public string[] CommandHelp() => LogicCommands.CommandHelp();
    }
}
