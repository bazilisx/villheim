using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Designs;
using Villheim.Logic.Village;
using Villheim.Prefabs;

namespace Villheim.Logic
{
    /// <summary>
    /// Console command implementations. The core registers the command names and forwards them here.
    /// </summary>
    internal static class LogicCommands
    {
        private static readonly string[] Help =
        {
            "found: light a new village hearth in front of you",
            "grow: make the nearest village start its next building now (adds the wood it needs)",
            "wood [amount] [material]: add materials to the nearest village (Wood, Stone, FineWood, RoundLog)",
            "preview <location>: build one design in front of you, outside any village",
            "clear: remove the nearest village (buildings, villagers and hearth)",
            "info: show loaded villages",
            "designs [meadows|blackforest]: list the designs villages can build",
            "locations [filter]: list location names you can use as designs",
            "dump <location>: write what a design contains to the BepInEx log",
            "report: write a report of every location that could be a design (BepInEx/Villheim/design-report.txt)",
        };

        public static string[] CommandHelp() => Help;

        public static bool Run(string name, string[] args, Terminal context)
        {
            switch (name)
            {
                case "villheim_found": Found(context); return true;
                case "villheim_grow": Grow(context); return true;
                case "villheim_wood": AddWood(args, context); return true;
                case "villheim_preview": Preview(args, context); return true;
                case "villheim_clear": Clear(context); return true;
                case "villheim_info": Info(context); return true;
                case "villheim_designs": Designs(args, context); return true;
                case "villheim_locations": Locations(args, context); return true;
                case "villheim_dump": Dump(args, context); return true;
                case "villheim_report": DesignReport.Start(context); return true;
                default: return false;
            }
        }

        private static void Say(Terminal context, string text)
        {
            context?.AddString(text);
        }

        private static bool TryGetPlayer(Terminal context, out Player player)
        {
            player = Player.m_localPlayer;
            if (player == null)
            {
                Say(context, "Villheim: you need to be in a world to use this.");
                return false;
            }

            return true;
        }

        private static Vector3 GroundInFront(Player player, float distance)
        {
            Vector3 position = player.transform.position + player.transform.forward * distance;
            if (ZoneSystem.instance.GetGroundHeight(position, out float y))
            {
                position.y = y;
            }

            return position;
        }

        private static void Found(Terminal context)
        {
            if (!TryGetPlayer(context, out Player player) || HearthPrefab.Prefab == null)
            {
                return;
            }

            Object.Instantiate(HearthPrefab.Prefab, GroundInFront(player, 4f),
                Quaternion.Euler(0f, player.transform.eulerAngles.y, 0f));
            Say(context, "Villheim: a hearth is lit. The first settlers arrive within a few seconds.");
        }

        private static void Grow(Terminal context)
        {
            if (!TryGetPlayer(context, out Player player))
            {
                return;
            }

            VillageHearth hearth = VillageHearth.Closest(player.transform.position, 150f);
            if (hearth == null)
            {
                Say(context, "Villheim: no village hearth within 150 m.");
                return;
            }

            VillageBrain.ForceGrow(hearth, true);
            Say(context, $"Villheim: {hearth.VillageName} will start building within a few seconds.");
        }

        private static void AddWood(string[] args, Terminal context)
        {
            if (!TryGetPlayer(context, out Player player))
            {
                return;
            }

            VillageHearth hearth = VillageHearth.Closest(player.transform.position, 150f);
            if (hearth == null || !hearth.IsValid)
            {
                Say(context, "Villheim: no village hearth within 150 m.");
                return;
            }

            int amount = args.Length > 0 && int.TryParse(args[0], out int parsed) ? parsed : 100;
            string material = args.Length > 1 ? args[1] : null;
            hearth.NView.ClaimOwnership();
            var state = new VillageState(hearth.Zdo);
            foreach (string tracked in Materials.Tracked)
            {
                if (material == null || string.Equals(tracked, material, System.StringComparison.OrdinalIgnoreCase))
                {
                    state.Add(tracked, amount);
                }
            }

            Say(context, $"Villheim: {state.Name} now has {state.StockText()}.");
        }

        private static void Clear(Terminal context)
        {
            if (!TryGetPlayer(context, out Player player))
            {
                return;
            }

            VillageHearth hearth = VillageHearth.Closest(player.transform.position, 150f);
            if (hearth == null)
            {
                Say(context, "Villheim: no village hearth within 150 m.");
                return;
            }

            int id = hearth.VillageId;
            string name = hearth.VillageName;
            int removed = 0;

            if (id != 0)
            {
                foreach (ZNetView view in Object.FindObjectsByType<ZNetView>(FindObjectsSortMode.None))
                {
                    if (view == null || !view.IsValid())
                    {
                        continue;
                    }

                    ZDO zdo = view.GetZDO();
                    bool builtHere = zdo.GetInt(Keys.BuiltBy) == id;
                    bool livesHere = view.TryGetComponent(out Villager villager) && villager.VillageId == id;
                    if (builtHere || livesHere)
                    {
                        view.ClaimOwnership();
                        ZNetScene.instance.Destroy(view.gameObject);
                        removed++;
                    }
                }
            }

            hearth.NView.ClaimOwnership();
            ZNetScene.instance.Destroy(hearth.gameObject);
            Say(context, $"Villheim: removed {name} ({removed} objects and villagers, plus the hearth). " +
                         "Leveled ground stays as it is.");
        }

        private static void Info(Terminal context)
        {
            List<VillageHearth> hearths = VillageHearth.All.ToList();
            if (hearths.Count == 0)
            {
                Say(context, "Villheim: no villages are loaded. Get closer to one.");
                return;
            }

            foreach (VillageHearth hearth in hearths)
            {
                Say(context, $"{VillageBrain.Summary(hearth)}  at {hearth.transform.position}");
                if (hearth.IsValid)
                {
                    foreach (Plot plot in new VillageState(hearth.Zdo).Plots)
                    {
                        Say(context, $"   {plot.Design} at {plot.Position}");
                    }
                }
            }
        }

        private static void Designs(string[] args, Terminal context)
        {
            if (ZoneSystem.instance == null)
            {
                Say(context, "Villheim: load a world first.");
                return;
            }

            Heightmap.Biome biome = args.Length > 0 && args[0].ToLowerInvariant().Contains("forest")
                ? Heightmap.Biome.BlackForest
                : Heightmap.Biome.Meadows;

            List<DesignLibrary.Design> pool = DesignLibrary.AllFor(biome);
            Say(context, $"Villheim: {pool.Count} designs for {biome} villages:");
            foreach (DesignLibrary.Design design in pool)
            {
                Say(context, $"   {design.Name}  radius {design.Radius:0}  weight {design.Weight:0.##}");
            }
        }

        private static void Locations(string[] args, Terminal context)
        {
            if (ZoneSystem.instance == null)
            {
                Say(context, "Villheim: load a world first.");
                return;
            }

            string filter = args.Length > 0 ? args[0] : "";
            IEnumerable<ZoneSystem.ZoneLocation> locations = ZoneSystem.instance.m_locations
                .Where(l => l != null && l.m_prefab.IsValid &&
                            l.m_prefabName.IndexOf(filter, System.StringComparison.OrdinalIgnoreCase) >= 0)
                .GroupBy(l => l.m_prefabName)
                .Select(g => g.First())
                .OrderBy(l => l.m_prefabName);

            int count = 0;
            foreach (ZoneSystem.ZoneLocation location in locations)
            {
                Say(context, $"   {location.m_prefabName}  ({location.m_biome}, radius {location.m_exteriorRadius:0})");
                count++;
            }

            Say(context, $"Villheim: {count} locations.");
        }

        private static void Preview(string[] args, Terminal context)
        {
            if (args.Length == 0 || !TryGetPlayer(context, out Player player))
            {
                Say(context, "Usage: villheim_preview <location name>");
                return;
            }

            ZoneSystem.ZoneLocation location = DesignLibrary.Find(args[0]);
            if (location == null)
            {
                Say(context, $"Villheim: unknown location '{args[0]}'.");
                return;
            }

            float radius = DesignLibrary.Radius(location);
            Vector3 position = GroundInFront(player, radius + 3f);
            VillheimPlugin.Instance.StartCoroutine(PreviewRoutine(location, position, player.transform.eulerAngles.y, context));
        }

        private static IEnumerator PreviewRoutine(ZoneSystem.ZoneLocation location, Vector3 position, float yaw, Terminal context)
        {
            var result = new DesignSpawner.Result();
            yield return DesignSpawner.Build(location, position, yaw, Random.Range(1, int.MaxValue), 0, result);
            Say(context, result.Success
                ? $"Villheim: built {location.m_prefabName} ({result.Spawned} objects, {result.Skipped} left out)."
                : $"Villheim: {result.Error}");
        }

        private static void Dump(string[] args, Terminal context)
        {
            if (args.Length == 0)
            {
                Say(context, "Usage: villheim_dump <location name>");
                return;
            }

            ZoneSystem.ZoneLocation location = DesignLibrary.Find(args[0]);
            if (location == null)
            {
                Say(context, $"Villheim: unknown location '{args[0]}'.");
                return;
            }

            location.m_prefab.Load();
            try
            {
                GameObject asset = location.m_prefab.Asset;
                if (asset == null)
                {
                    Say(context, "Villheim: the location prefab could not be loaded.");
                    return;
                }

                List<string> lines = DesignSpawner.Describe(asset).ToList();
                VillheimPlugin.Log.LogInfo($"Design dump for {location.m_prefabName} " +
                                           $"(radius {location.m_exteriorRadius}):\n" + string.Join("\n", lines));
                int kept = lines.Count(l => l.StartsWith("KEEP"));
                int skipped = lines.Count(l => l.StartsWith("SKIP"));
                Say(context, $"Villheim: {location.m_prefabName} has {kept} objects to copy and {skipped} left out. " +
                             "Full list written to BepInEx/LogOutput.log.");
            }
            finally
            {
                location.m_prefab.Release();
            }
        }
    }
}
