using System.Reflection;
using Villheim.Logic.Village;
using Villheim.Logic.Villagers;

namespace Villheim.Logic
{
    /// <summary>
    /// Entry point of the logic assembly. The core finds this class by its interface and creates one instance per load.
    /// </summary>
    public sealed class VillheimLogic : IVillheimLogic
    {
        public string BuildInfo
        {
            get
            {
                var info = typeof(VillheimLogic).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>();
                return "Villheim.Logic " + (info?.InformationalVersion ?? "unknown build");
            }
        }

        public void OnLoad()
        {
            ConfigWatcher.Start();
            Designs.DesignReport.StartIfStale(System.TimeSpan.FromMinutes(30));
        }

        public void OnUnload()
        {
        }

        public void ConfigurePrefabs()
        {
            VillagerTuning.ApplyToAll();
        }

        public void HearthTick(VillageHearth hearth) => VillageBrain.Tick(hearth);

        public string HearthHoverText(VillageHearth hearth) =>
            $"{hearth.VillageName} hearth\n<color=#b0b0b0>{VillageBrain.Summary(hearth)}</color>";

        public string HearthHoverName(VillageHearth hearth) => $"{hearth.VillageName} hearth";

        public void HearthInteract(VillageHearth hearth, Humanoid user)
        {
            if (user == Player.m_localPlayer)
            {
                user.Message(MessageHud.MessageType.Center, VillageBrain.Summary(hearth));
            }
        }

        public void VillagerUpdate(Villager villager, float deltaTime) => VillagerBehaviour.Update(villager, deltaTime);

        public string VillagerHoverText(Villager villager) => VillagerBehaviour.HoverText(villager);

        public bool VillagerInteract(Villager villager, Humanoid user) => VillagerBehaviour.Interact(villager, user);

        public bool RunCommand(string name, string[] args, Terminal context) => LogicCommands.Run(name, args, context);

        public string[] CommandHelp() => LogicCommands.CommandHelp();
    }
}
