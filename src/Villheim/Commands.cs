using System.Collections;
using System.Collections.Generic;
using System.Linq;
using Jotunn.Entities;
using Jotunn.Managers;
using UnityEngine;
using Villheim.Designs;
using Villheim.Prefabs;
using Villheim.Village;

namespace Villheim
{
    /// <summary>
    /// Console commands for testing and tuning. Commands that change the world need 'devcommands'.
    /// </summary>
    internal static class Commands
    {
        public static void Register()
        {
            CommandManager.Instance.AddConsoleCommand(new FoundCommand());
            CommandManager.Instance.AddConsoleCommand(new GrowCommand());
            CommandManager.Instance.AddConsoleCommand(new InfoCommand());
            CommandManager.Instance.AddConsoleCommand(new DesignsCommand());
            CommandManager.Instance.AddConsoleCommand(new LocationsCommand());
            CommandManager.Instance.AddConsoleCommand(new PreviewCommand());
            CommandManager.Instance.AddConsoleCommand(new DumpCommand());
        }

        private static bool TryGetPlayer(Terminal context, out Player player)
        {
            player = Player.m_localPlayer;
            if (player == null)
            {
                context?.AddString("Villheim: you need to be in a world to use this.");
                return false;
            }

            return true;
        }

        private class FoundCommand : ConsoleCommand
        {
            public override string Name => "villheim_found";
            public override string Help => "Light a new village hearth in front of you.";
            public override bool IsCheat => true;

            public override void Run(string[] args, Terminal context)
            {
                if (!TryGetPlayer(context, out Player player) || HearthPrefab.Prefab == null)
                {
                    return;
                }

                Vector3 position = player.transform.position + player.transform.forward * 4f;
                if (ZoneSystem.instance.GetGroundHeight(position, out float y))
                {
                    position.y = y;
                }

                Object.Instantiate(HearthPrefab.Prefab, position, Quaternion.Euler(0f, player.transform.eulerAngles.y, 0f));
                context?.AddString("Villheim: a hearth is lit. The first settlers arrive within a few seconds.");
            }
        }

        private class GrowCommand : ConsoleCommand
        {
            public override string Name => "villheim_grow";
            public override string Help => "Make the nearest village start its next building now.";
            public override bool IsCheat => true;

            public override void Run(string[] args, Terminal context)
            {
                if (!TryGetPlayer(context, out Player player))
                {
                    return;
                }

                VillageHearth hearth = VillageHearth.Closest(player.transform.position, 150f);
                if (hearth == null)
                {
                    context?.AddString("Villheim: no village hearth within 150 m.");
                    return;
                }

                hearth.ForceGrow();
                context?.AddString($"Villheim: {hearth.VillageName} will start building within a few seconds.");
            }
        }

        private class InfoCommand : ConsoleCommand
        {
            public override string Name => "villheim_info";
            public override string Help => "Show the state of loaded villages.";

            public override void Run(string[] args, Terminal context)
            {
                List<VillageHearth> hearths = VillageHearth.All.Where(h => h).ToList();
                if (hearths.Count == 0)
                {
                    context?.AddString("Villheim: no villages are loaded. Get closer to one.");
                    return;
                }

                foreach (VillageHearth hearth in hearths)
                {
                    context?.AddString($"{hearth.Summary()}  at {hearth.transform.position}");
                    foreach (Plot plot in hearth.State?.Plots ?? new List<Plot>())
                    {
                        context?.AddString($"   {plot.Design} at {plot.Position}");
                    }
                }
            }
        }

        private class DesignsCommand : ConsoleCommand
        {
            public override string Name => "villheim_designs";
            public override string Help => "List the designs villages can build: villheim_designs [meadows|blackforest]";

            public override void Run(string[] args, Terminal context)
            {
                if (ZoneSystem.instance == null)
                {
                    context?.AddString("Villheim: load a world first.");
                    return;
                }

                Heightmap.Biome biome = args.Length > 0 && args[0].ToLowerInvariant().Contains("forest")
                    ? Heightmap.Biome.BlackForest
                    : Heightmap.Biome.Meadows;

                List<DesignLibrary.Design> pool = DesignLibrary.PoolFor(biome);
                context?.AddString($"Villheim: {pool.Count} designs for {biome} villages:");
                foreach (DesignLibrary.Design design in pool)
                {
                    context?.AddString($"   {design.Name}  radius {design.Radius:0}  weight {design.Weight:0.##}");
                }
            }
        }

        private class LocationsCommand : ConsoleCommand
        {
            public override string Name => "villheim_locations";
            public override string Help => "List location names you can use as designs: villheim_locations [filter]";

            public override void Run(string[] args, Terminal context)
            {
                if (ZoneSystem.instance == null)
                {
                    context?.AddString("Villheim: load a world first.");
                    return;
                }

                string filter = args.Length > 0 ? args[0] : "";
                IEnumerable<ZoneSystem.ZoneLocation> locations = ZoneSystem.instance.m_locations
                    .Where(l => l != null && l.m_prefab.IsValid && l.m_prefabName.IndexOf(filter, System.StringComparison.OrdinalIgnoreCase) >= 0)
                    .GroupBy(l => l.m_prefabName)
                    .Select(g => g.First())
                    .OrderBy(l => l.m_prefabName);

                int count = 0;
                foreach (ZoneSystem.ZoneLocation location in locations)
                {
                    context?.AddString($"   {location.m_prefabName}  ({location.m_biome}, radius {location.m_exteriorRadius:0})");
                    count++;
                }

                context?.AddString($"Villheim: {count} locations.");
            }
        }

        private class PreviewCommand : ConsoleCommand
        {
            public override string Name => "villheim_preview";
            public override string Help => "Build one design in front of you, outside any village: villheim_preview <location>";
            public override bool IsCheat => true;

            public override void Run(string[] args, Terminal context)
            {
                if (args.Length == 0 || !TryGetPlayer(context, out Player player))
                {
                    context?.AddString("Usage: villheim_preview <location name>");
                    return;
                }

                ZoneSystem.ZoneLocation location = DesignLibrary.Find(args[0]);
                if (location == null)
                {
                    context?.AddString($"Villheim: unknown location '{args[0]}'.");
                    return;
                }

                float radius = DesignLibrary.Radius(location);
                Vector3 position = player.transform.position + player.transform.forward * (radius + 3f);
                if (ZoneSystem.instance.GetGroundHeight(position, out float y))
                {
                    position.y = y;
                }

                VillheimPlugin.Instance.StartCoroutine(Preview(location, position, player.transform.eulerAngles.y, context));
            }

            private static IEnumerator Preview(ZoneSystem.ZoneLocation location, Vector3 position, float yaw, Terminal context)
            {
                var result = new DesignSpawner.Result();
                yield return DesignSpawner.Build(location, position, yaw, Random.Range(1, int.MaxValue), 0, result);
                context?.AddString(result.Success
                    ? $"Villheim: built {location.m_prefabName} ({result.Spawned} objects, {result.Skipped} left out)."
                    : $"Villheim: {result.Error}");
            }
        }

        private class DumpCommand : ConsoleCommand
        {
            public override string Name => "villheim_dump";
            public override string Help => "Write what a design contains, and what Villheim keeps, to the BepInEx log: villheim_dump <location>";

            public override void Run(string[] args, Terminal context)
            {
                if (args.Length == 0)
                {
                    context?.AddString("Usage: villheim_dump <location name>");
                    return;
                }

                ZoneSystem.ZoneLocation location = DesignLibrary.Find(args[0]);
                if (location == null)
                {
                    context?.AddString($"Villheim: unknown location '{args[0]}'.");
                    return;
                }

                location.m_prefab.Load();
                try
                {
                    GameObject asset = location.m_prefab.Asset;
                    if (asset == null)
                    {
                        context?.AddString("Villheim: the location prefab could not be loaded.");
                        return;
                    }

                    List<string> lines = DesignSpawner.Describe(asset).ToList();
                    VillheimPlugin.Log.LogInfo($"Design dump for {location.m_prefabName} " +
                                               $"(radius {location.m_exteriorRadius}):\n" + string.Join("\n", lines));
                    int kept = lines.Count(l => l.StartsWith("KEEP"));
                    int skipped = lines.Count(l => l.StartsWith("SKIP"));
                    context?.AddString($"Villheim: {location.m_prefabName} has {kept} objects to copy and {skipped} left out. " +
                                       "Full list written to BepInEx/LogOutput.log.");
                }
                finally
                {
                    location.m_prefab.Release();
                }
            }
        }
    }
}
