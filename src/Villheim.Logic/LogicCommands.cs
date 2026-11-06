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
            "empty: take every material out of the nearest village's stock and village chest",
            "version: show which Villheim.Logic build is running",
            "preview <location>: build one design in front of you, outside any village",
            "clear: remove the nearest village (buildings, villagers and hearth)",
            "info: show loaded villages",
            "designs [meadows|blackforest]: list the designs villages can build",
            "locations [filter]: list location names you can use as designs",
            "dump <location>: write what a design contains to the BepInEx log",
            "report: write a report of every location that could be a design (BepInEx/Villheim/design-report.txt)",
            "villager: show the nearest villager's voice, mood, thoughts, role, trade, bed and activity",
            "village: show the nearest village's type, chieftain, mood, project, fence, known players and request",
            "raid: send a raid to the nearest village (comes at once if it is night)",
            "blueprints: list the blueprints villages can build (BepInEx/config/Villheim/blueprints, PlanBuild's folder)",
            "savebp <role-family-level> [radius]: save the building pieces around you as a blueprint, e.g. savebp house-cabin-1 8",
        };

        public static string[] CommandHelp() => Help;

        public static bool Run(string name, string[] args, Terminal context)
        {
            switch (name)
            {
                case "villheim_found": Found(context); return true;
                case "villheim_grow": Grow(context); return true;
                case "villheim_wood": AddWood(args, context); return true;
                case "villheim_empty": Empty(context); return true;
                case "villheim_version": Say(context, VillheimLogic.Build); return true;
                case "villheim_preview": Preview(args, context); return true;
                case "villheim_clear": Clear(context); return true;
                case "villheim_info": Info(context); return true;
                case "villheim_designs": Designs(args, context); return true;
                case "villheim_locations": Locations(args, context); return true;
                case "villheim_dump": Dump(args, context); return true;
                case "villheim_report": DesignReport.Start(context); return true;
                case "villheim_blueprints": ListBlueprints(context); return true;
                case "villheim_villager": InspectVillager(context); return true;
                case "villheim_village": InspectVillage(context); return true;
                case "villheim_raid": ForceRaid(context); return true;
                case "villheim_savebp": SaveBlueprint(args, context); return true;
                default: return false;
            }
        }

        private static VillageHearth NearestHearth(Player player)
        {
            return VillageHearth.All.Where(h => h != null && h.IsValid)
                .OrderBy(h => Vector3.Distance(h.transform.position, player.transform.position)).FirstOrDefault();
        }

        private static void InspectVillager(Terminal context)
        {
            if (!TryGetPlayer(context, out Player player))
            {
                return;
            }

            Villager villager = Character.GetAllCharacters().OfType<Villager>().Where(v => !v.IsDead())
                .OrderBy(v => Vector3.Distance(v.transform.position, player.transform.position)).FirstOrDefault();
            if (villager == null)
            {
                Say(context, "Villheim: no villager nearby.");
                return;
            }

            float mood = Villagers.Moods.Get(villager);
            Say(context, $"Villheim: {villager.VillagerName} of {villager.VillageName}, voice {Villagers.Dialogue.VoiceOf(villager)}" +
                         $"{(Villagers.Childhood.IsChild(villager) ? ", child" : "")}{(Villagers.Roles.IsChieftain(villager) ? ", chieftain" : "")}");
            Say(context, $"   mood {mood:0} ({Villagers.Moods.Label(mood)}); thoughts: {Villagers.Moods.Describe(villager)}");
            Say(context, $"   {Villagers.Roles.BackgroundOf(villager)}, trade {Villagers.Roles.TradeOf(villager)}, " +
                         $"night watch {(Villagers.Roles.IsNightWatch(villager) ? "tonight" : "no")}, " +
                         $"bed {(Villagers.Beds.For(villager) != null ? "yes" : "none")}, foods {Villagers.Healing.FoodCount(villager)}");
            Say(context, $"   doing: {Villagers.VillagerBehaviour.HoverText(villager).Replace("\n", " | ")}");
        }

        private static void InspectVillage(Terminal context)
        {
            if (!TryGetPlayer(context, out Player player))
            {
                return;
            }

            VillageHearth hearth = NearestHearth(player);
            if (hearth == null)
            {
                Say(context, "Villheim: no village loaded.");
                return;
            }

            var state = new VillageState(hearth.Zdo);
            Villager chief = Character.GetAllCharacters().OfType<Villager>().FirstOrDefault(v => v.VillageId == state.Id && Villagers.Roles.IsChieftain(v));
            Say(context, $"Villheim: {state.Name}, a {state.Type} village ({state.Biome}), mood {VillageMood.Get(state.Id):0}, " +
                         $"chieftain {(chief != null ? chief.VillagerName : "none")}");
            Say(context, $"   {state.Plots.Count} buildings, {VillageBrain.CountVillagers(state.Id)} villagers, " +
                         $"{Villagers.Beds.Of(hearth).Count} beds ({Villagers.Beds.Spare(hearth)} spare), fence ring {Palisade.WantedRadius(hearth, state):0} m");
            Say(context, $"   project: {Growth.PendingLabel(hearth, state)}; request today: {Villagers.Social.RequestText(hearth) ?? "none"}");
            foreach (Villagers.Social.Known known in Villagers.Social.KnownPlayers(hearth))
            {
                Say(context, $"   knows {known.Name}: reputation {known.Reputation}, first seen day {known.FirstDay}, last day {known.LastDay}");
            }
        }

        private static void ForceRaid(Terminal context)
        {
            if (!TryGetPlayer(context, out Player player))
            {
                return;
            }

            VillageHearth hearth = NearestHearth(player);
            if (hearth == null)
            {
                Say(context, "Villheim: no village loaded.");
                return;
            }

            Raids.Force(hearth);
            Say(context, $"Villheim: raiders are on their way to {hearth.VillageName}. They come once it is dark.");
        }

        private static void ListBlueprints(Terminal context)
        {
            Dictionary<string, Blueprints.Blueprint> all = Blueprints.All();
            Say(context, $"Villheim: {all.Count} blueprints (folder: {Blueprints.Folder}).");
            foreach (Blueprints.Blueprint blueprint in all.Values.OrderBy(b => b.Role).ThenBy(b => b.Family).ThenBy(b => b.Level))
            {
                string missing = DesignLibrary.MissingIn(new DesignLibrary.Design(blueprint, 1f), Heightmap.Biome.Meadows);
                Say(context, $"   {blueprint.Name}: {blueprint.Role} '{blueprint.Family}' level {blueprint.Level}, " +
                             $"{blueprint.Pieces.Count} pieces, radius {blueprint.Radius:0}" +
                             (blueprint.Biome != null ? $", {blueprint.Biome}" : "") +
                             (missing != null ? $", needs {Materials.Label(missing)} (not in the Meadows)" : ""));
            }
        }

        /// <summary>Writes every building piece within the radius as a PlanBuild-style blueprint in Villheim's folder.</summary>
        private static void SaveBlueprint(string[] args, Terminal context)
        {
            if (!TryGetPlayer(context, out Player player))
            {
                return;
            }

            if (args.Length < 1)
            {
                Say(context, "Villheim: savebp <role-family-level> [radius], for example savebp house-cabin-1 8");
                return;
            }

            float radius = args.Length > 1 && float.TryParse(args[1], System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture, out float r) ? r : 8f;
            var pieces = new List<Piece>();
            Piece.GetAllPiecesInRadius(player.transform.position, radius, pieces);
            pieces.RemoveAll(p => p == null || p.GetComponent<VillageHearth>() != null || p.GetComponent<Character>() != null);
            if (pieces.Count == 0)
            {
                Say(context, "Villheim: no building pieces within that radius.");
                return;
            }

            Vector3 origin = player.transform.position;
            Quaternion turn = Quaternion.Inverse(Quaternion.Euler(0f, Mathf.Round(player.transform.eulerAngles.y / 90f) * 90f, 0f));
            var lines = new List<string>
            {
                "#Name:" + args[0], "#Creator:" + player.GetPlayerName(), "#Description:villheim: saved in game", "#Category:Villheim", "#Pieces",
            };

            var inv = System.Globalization.CultureInfo.InvariantCulture;
            foreach (Piece piece in pieces)
            {
                Vector3 p = turn * (piece.transform.position - origin);
                Quaternion q = turn * piece.transform.rotation;
                Vector3 s = piece.transform.localScale;
                lines.Add(string.Join(";", Utils.GetPrefabName(piece.gameObject), "Villheim",
                    p.x.ToString("0.###", inv), p.y.ToString("0.###", inv), p.z.ToString("0.###", inv),
                    q.x.ToString("0.#####", inv), q.y.ToString("0.#####", inv), q.z.ToString("0.#####", inv), q.w.ToString("0.#####", inv),
                    "", s.x.ToString("0.###", inv), s.y.ToString("0.###", inv), s.z.ToString("0.###", inv)));
            }

            System.IO.Directory.CreateDirectory(Blueprints.Folder);
            string file = System.IO.Path.Combine(Blueprints.Folder, args[0] + ".blueprint");
            System.IO.File.WriteAllLines(file, lines);
            Say(context, $"Villheim: saved {pieces.Count} pieces to {file}. The front of the building is the way you face.");
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

        /// <summary>Takes all materials out of the nearest village: its stock and its village chest.</summary>
        private static void Empty(Terminal context)
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

            hearth.NView.ClaimOwnership();
            var state = new VillageState(hearth.Zdo);
            Container chest = VillageChest.Find(hearth);
            foreach (string material in Materials.Tracked)
            {
                state.Add(material, -state.Get(material));
                int inChest = chest != null ? VillageChest.Count(chest, material) : 0;
                if (inChest > 0)
                {
                    VillageChest.Take(chest, new Dictionary<string, int> { { material, inChest } });
                }
            }

            VillageNeeds.Forget(state.Id);
            Say(context, $"Villheim: {state.Name} has nothing saved up now{(chest != null ? " and its chest is empty" : "")}.");
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
