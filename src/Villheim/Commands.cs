using System.Linq;
using Jotunn.Entities;
using Jotunn.Managers;

namespace Villheim
{
    /// <summary>
    /// Console commands. The core registers the names; the logic assembly implements them, so commands can change
    /// with a hot reload. Commands added in a later logic build are reachable through 'vh &lt;command&gt;'.
    /// </summary>
    internal static class Commands
    {
        public static void Register()
        {
            Add("villheim_found", "Light a new village hearth in front of you.", true);
            Add("villheim_grow", "Make the nearest village start its next building now.", true);
            Add("villheim_preview", "Build one design in front of you: villheim_preview <location>", true);
            Add("villheim_clear", "Remove the nearest village: its buildings, villagers and hearth.", true);
            Add("villheim_info", "Show the state of loaded villages.", false);
            Add("villheim_designs", "List the designs villages can build: villheim_designs [meadows|blackforest]", false);
            Add("villheim_locations", "List location names you can use as designs: villheim_locations [filter]", false);
            Add("villheim_dump", "Write what a design contains to the BepInEx log: villheim_dump <location>", false);

            CommandManager.Instance.AddConsoleCommand(new DispatchCommand());
            CommandManager.Instance.AddConsoleCommand(new ReloadCommand());
        }

        private static void Add(string name, string help, bool cheat)
        {
            CommandManager.Instance.AddConsoleCommand(new LogicCommand(name, help, cheat));
        }

        private static void Run(string name, string[] args, Terminal context)
        {
            if (LogicHost.Current == null)
            {
                context?.AddString("Villheim: the logic DLL is not loaded. Check the BepInEx log.");
                return;
            }

            bool handled = LogicHost.Get(logic => logic.RunCommand(name, args, context), true);
            if (!handled)
            {
                context?.AddString($"Villheim: the loaded logic build does not know '{name}'. Try 'vh help'.");
            }
        }

        private sealed class LogicCommand : ConsoleCommand
        {
            private readonly string _name;
            private readonly string _help;
            private readonly bool _cheat;

            public LogicCommand(string name, string help, bool cheat)
            {
                _name = name;
                _help = help;
                _cheat = cheat;
            }

            public override string Name => _name;
            public override string Help => _help;
            public override bool IsCheat => _cheat;

            public override void Run(string[] args, Terminal context)
            {
                Commands.Run(_name, args, context);
            }
        }

        /// <summary>'vh &lt;command&gt; [args]': runs any command the current logic build knows.</summary>
        private sealed class DispatchCommand : ConsoleCommand
        {
            public override string Name => "vh";
            public override string Help => "Villheim developer commands: vh help";
            public override bool IsCheat => true;

            public override void Run(string[] args, Terminal context)
            {
                if (args.Length == 0 || args[0] == "help")
                {
                    context?.AddString("Villheim commands (use as 'vh <command>' or 'villheim_<command>'):");
                    foreach (string line in LogicHost.Get(logic => logic.CommandHelp(), new string[0]))
                    {
                        context?.AddString("   " + line);
                    }

                    context?.AddString("   reload: reload Villheim.Logic.dll now");
                    return;
                }

                if (args[0] == "reload")
                {
                    LogicHost.Load();
                    return;
                }

                string name = args[0].StartsWith("villheim_") ? args[0] : "villheim_" + args[0];
                Commands.Run(name, args.Skip(1).ToArray(), context);
            }
        }

        private sealed class ReloadCommand : ConsoleCommand
        {
            public override string Name => "villheim_reload";
            public override string Help => "Reload Villheim.Logic.dll now (it also reloads by itself when the file changes).";

            public override void Run(string[] args, Terminal context)
            {
                context?.AddString(LogicHost.Load() ? "Villheim: logic reloaded." : "Villheim: reload failed, see the BepInEx log.");
            }
        }
    }
}
