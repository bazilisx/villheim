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
            "grow: make the nearest village start its next building now (adds the wood it needs)",
            "settle (or newvillage): light a new village hearth in front of you",
            "ghost: apply the look settings now and show the shader in use",
            "flatten [size]: clear everything from an area in front of you (360 by 260 m, enough for any gallery page) and level it at your feet's height, as far as the game allows; touch it up by hand, then 'gallery' lays out on it",
            "gallery [keepers] [stage] [all|house|hall|prof|storage|farm] [as <stage>] [page N]: ten designs a page on the flattened area, numbered as in design-list.csv; 'keepers' shows only the designs kept in the review, kind by kind; 'as meadows' shows them in Meadows materials; then 'gallery next' (or prev, again); 'gallery show <name...>'; 'gallery clear'",
            "act <villager|near> <action> [seconds]: make one villager do one thing, to test it ('vh act near' lists the actions)",
            "board [now]: show the notice board's blueprint, place and what it waits for ('now' puts it up at once, free)",
            "beds: list the beds round the nearest village, whether they count and who sleeps in each",
            "buildingground: level the ground under the nearest village building to its foundation",
            "hearthground: clear and level the ground round the nearest village's hearth again",
            "previews: write a preview command for every design to BepInEx/Villheim/preview-commands.txt",
            "wood [amount] [material]: add materials to the nearest village (Wood, Stone, FineWood, RoundLog)",
            "empty: take every material out of the nearest village's stock and village chest",
            "version: show which Villheim.Logic build is running",
            "preview <location>: build one design in front of you, outside any village",
            "clear: remove the nearest village (buildings, villagers and hearth)",
            "info: show loaded villages",
            "designs [meadows|blackforest]: list the designs villages can build",
            "locations [filter]: list location names you can use as designs",
            "dump <location>: write what a design contains to the BepInEx log",
            "report [rescan]: write every design (curated, all blueprints, every location with a structure) with its stage, kind, gallery page and notes to BepInEx/Villheim/design-list.csv; 'report locations' writes the older per-location report (design-report.txt)",
            "trace [seconds]: record the nearest villager's movement 50 times a second to BepInEx/Villheim/trace-*.csv (for jitter)",
            "villager: show the nearest villager's voice, mood, thoughts, role, trade, bed and activity",
            "village: show the nearest village's type, Jarl, mood, project, fence, known players and request",
            "raid: send a raid to the nearest village (comes at once if it is night)",
            "blueprints: list the blueprints villages can build (BepInEx/config/Villheim/blueprints, PlanBuild's folder)",
            "savebp <role-family-level> [radius]: save the building pieces around you as a blueprint, e.g. savebp house-cabin-1 8",
            "look [off]: name whatever the crosshair points at within 4 m, with its kind, size, stage and what the material swap makes of it; new names go to BepInEx/Villheim/looked-at.txt",
            "swap [turn|undo|done|off]: change a gallery design piece by piece: aim at a piece and press numpad 5; stand-ins by biome (and combinations such as two 2x1 for a 2x2) go up at its sign; aim at one (or a piece you built) and press it again; kept only once the design is saved with 'bp save'; numpad + and - move the design under the crosshair up and down, numpad 8 2 4 6 around, 10 cm (50 cm with Shift); hold Ctrl to move only the structure under the crosshair (shown green); saved with it",
            "bp forget <number|name|all>: delete pass 3 saves, so the gallery shows the original design again",
            "tool: put a shaping rod in your inventory: with it in hand, hotbar 1 to 8 edit gallery designs (1 Swap, 2 Turn, 3 Undo, 4 Move, 5 Part, 6 Delete, 7 Save, 8 Look; left click Swap)",
            "drops [on|off]: whether things broken on the review ground (the flat gallery area and the slotting board) drop their materials (off by default)",
            "gravity [on|off]: let gallery and board pieces fall when nothing holds them up (off by default, so designs never collapse while you work)",
            "slot <biome> <kind> [number] [stages N] | slot save <stage> | slot clear: the slotting board, one plot per village stage for one base ID; the kind's designs go to PlanBuild's Villheim board tab",
            "sort [tools|undo|push|url <address>]: sort the kept designs in the game with the sort knives (A: type, B: subtype); choices go to BepInEx/Villheim/design-sort.csv and the review sheet",
            "note <text>: write a note with what you are aiming at and the nearest gallery sign to BepInEx/Villheim/notes.txt",
            "bp save <number|name> | bp save page [all]: save a design as it stands in the gallery now (pieces left, stand-ins, anything built on its plot) as blueprints/inspiration/pass3/p3-<number>-<name>; 'page' saves every changed design standing near you; the gallery shows the saves from then on",
            "bp swap <number|name> <stage>: save a copy of a design with its walls, floors, roofs and beams in that stage's materials (to blueprints/inspiration/edits)",
        };

        public static string[] CommandHelp() => Help;

        public static bool Run(string name, string[] args, Terminal context)
        {
            switch (name)
            {
                case "villheim_found":
                case "villheim_settle":
                case "villheim_newvillage": Found(context); return true;
                case "villheim_previews": WritePreviews(context); return true;
                case "villheim_ghost":
                    Villagers.GhostLook.ApplyNow();
                    Say(context, "Villheim: look settings applied.\n" + Villagers.GhostLook.Report());
                    return true;
                case "villheim_trace":
                    if (TryGetPlayer(context, out Player tracer))
                    {
                        float seconds = args.Length > 0 && float.TryParse(args[0], System.Globalization.NumberStyles.Float,
                            System.Globalization.CultureInfo.InvariantCulture, out float s) ? s : 20f;
                        Say(context, Villagers.MotionTrace.Start(tracer, seconds));
                    }

                    return true;
                case "villheim_flatten":
                    if (TryGetPlayer(context, out Player flattener))
                    {
                        Say(context, Gallery.Flatten(flattener, args));
                    }

                    return true;
                case "villheim_gallery":
                    if (TryGetPlayer(context, out Player gallery))
                    {
                        Say(context, Gallery.Start(gallery, args));
                    }

                    return true;
                case "villheim_act":
                    if (TryGetPlayer(context, out Player actor))
                    {
                        float actSeconds = args.Length > 2 && float.TryParse(args[2], System.Globalization.NumberStyles.Float,
                            System.Globalization.CultureInfo.InvariantCulture, out float sec) ? sec : 60f;
                        Say(context, Villagers.TestActs.Start(actor, args.Length > 0 ? args[0] : "near", args.Length > 1 ? args[1] : "", actSeconds));
                    }

                    return true;
                case "villheim_board":
                case "villheim_beds":
                    if (TryGetPlayer(context, out Player boardNear) && VillageHearth.Closest(boardNear.transform.position, 150f) is VillageHearth bv)
                    {
                        if (name == "villheim_board")
                        {
                            Say(context, "Villheim: " + NoticeBoard.Report(bv, args.Length > 0 && args[0] == "now"));
                        }
                        else
                        {
                            List<string> beds = Villagers.Beds.Report(bv);
                            Say(context, $"Villheim: {beds.Count} beds round {bv.VillageName}:");
                            foreach (string line in beds)
                            {
                                Say(context, "   " + line);
                            }
                        }
                    }
                    else
                    {
                        Say(context, "Villheim: no village hearth within 150 m.");
                    }

                    return true;
                case "villheim_buildingground":
                    if (TryGetPlayer(context, out Player builderNear) &&
                        VillageHearth.Closest(builderNear.transform.position, 150f) is VillageHearth bh)
                    {
                        Plot nearestPlot = new VillageState(bh.Zdo).Plots
                            .OrderBy(p => Utils.DistanceXZ(p.Position, builderNear.transform.position)).FirstOrDefault();
                        Say(context, nearestPlot == null ? "Villheim: that village has no buildings yet."
                            : "Villheim: " + ConstructionSite.RelevelBuilding(bh, nearestPlot) + ".");
                    }
                    else
                    {
                        Say(context, "Villheim: no village hearth within 150 m.");
                    }

                    return true;
                case "villheim_hearthground":
                    if (TryGetPlayer(context, out Player near) && VillageHearth.Closest(near.transform.position, 150f) is VillageHearth h)
                    {
                        HearthGround.Prepare(h);
                        Say(context, $"Villheim: cleared and levelled the ground round {h.VillageName}'s hearth.");
                    }
                    else
                    {
                        Say(context, "Villheim: no village hearth within 150 m.");
                    }

                    return true;
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
                case "villheim_report":
                    if (args.Length > 0 && args[0].ToLowerInvariant().StartsWith("loc"))
                    {
                        DesignReport.Start(context);
                    }
                    else
                    {
                        Say(context, Gallery.Report(context, args.Any(a => a.ToLowerInvariant() == "rescan")));
                    }

                    return true;
                case "villheim_blueprints": ListBlueprints(context); return true;
                case "villheim_villager": InspectVillager(context); return true;
                case "villheim_village": InspectVillage(context); return true;
                case "villheim_raid": ForceRaid(context); return true;
                case "villheim_savebp": SaveBlueprint(args, context); return true;
                case "villheim_bp": Say(context, BlueprintEdits.Run(args)); return true;
                case "villheim_look": Say(context, Village.LookAt.Toggle(args)); return true;
                case "villheim_swap": Say(context, SwapTool.Run(args)); return true;
                case "villheim_note": Say(context, SwapTool.Note(args)); return true;
                case "villheim_tool": Say(context, Shaping.GiveTool()); return true;
                case "villheim_sort": Say(context, DesignSort.Run(args)); return true;
                case "villheim_slot": Say(context, DesignBoard.Run(args)); return true;
                case "villheim_gravity": Say(context, Gallery.ToggleGravity(args)); return true;
                case "villheim_drops": Say(context, NoDrops.Toggle(args)); return true;
                case "villheim_snow": Say(context, Village.Snow.Run(args)); return true;
                case "villheim_weather": Say(context, Village.LocalWeather.Run(args)); return true;
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
                         $"{(Villagers.Childhood.IsChild(villager) ? ", child" : "")}{(Villagers.Roles.IsJarl(villager) ?  ", Jarl" : "")}");
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
            Villager chief = Character.GetAllCharacters().OfType<Villager>().FirstOrDefault(v => v.VillageId == state.Id && Villagers.Roles.IsJarl(v));
            Say(context, $"Villheim: {state.Name}, a {state.Type} village ({state.Biome}), mood {VillageMood.Get(state.Id):0}, " +
                         $"Jarl {(chief != null ? chief.VillagerName : "none")}");
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

        /// <summary>
        /// Writes a 'vh_preview' line for every design a village can use (the culture's lists, More World Locations,
        /// vanilla houses, every blueprint), grouped by biome and role, to BepInEx/Villheim/preview-commands.txt.
        /// </summary>
        private static void WritePreviews(Terminal context)
        {
            var lines = new List<string> { "# Villheim: preview commands. Stand in an open spot and paste one into the console (F5).", "" };
            foreach (Heightmap.Biome biome in new[] { Heightmap.Biome.Meadows, Heightmap.Biome.BlackForest })
            {
                foreach (Role role in new[] { Role.Hub, Role.House, Role.Workshop, Role.Farm, Role.Storage })
                {
                    lines.Add($"# {biome}, {VillageBrain.RoleName(role)}");
                    foreach (DesignLibrary.Design design in DesignLibrary.PoolFor(biome, role))
                    {
                        lines.Add($"vh_preview {design.Name}");
                    }

                    lines.Add("");
                }
            }

            lines.Add("# Every blueprint found (role, family, level)");
            foreach (Blueprints.Blueprint blueprint in Blueprints.All().Values.OrderBy(b => b.Biome).ThenBy(b => b.Role).ThenBy(b => b.Family).ThenBy(b => b.Level))
            {
                lines.Add($"vh_preview {blueprint.Name}    # {blueprint.Biome ?? "any biome"}, {blueprint.Role} '{blueprint.Family}' level {blueprint.Level}, {blueprint.Pieces.Count} pieces");
            }

            lines.Add("");
            lines.Add("# Every More World Locations and vanilla location in the Meadows and Black Forest");
            if (ZoneSystem.instance != null)
            {
                foreach (ZoneSystem.ZoneLocation location in ZoneSystem.instance.m_locations
                             .Where(l => l != null && l.m_prefab.IsValid && (l.m_biome & (Heightmap.Biome.Meadows | Heightmap.Biome.BlackForest)) != 0)
                             .OrderBy(l => l.m_prefabName))
                {
                    lines.Add($"vh_preview {location.m_prefabName}    # {location.m_biome}, radius {DesignLibrary.Radius(location):0}");
                }
            }

            string folder = System.IO.Path.Combine(BepInEx.Paths.BepInExRootPath, "Villheim");
            System.IO.Directory.CreateDirectory(folder);
            string file = System.IO.Path.Combine(folder, "preview-commands.txt");
            System.IO.File.WriteAllLines(file, lines);
            Say(context, $"Villheim: wrote {lines.Count(l => l.StartsWith("vh_"))} preview commands to {file}.");
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

        /// <summary>Prints to the console, one console line per line of text (a long text in one line draws over itself).</summary>
        private static void Say(Terminal context, string text)
        {
            foreach (string line in (text ?? "").Split('\n'))
            {
                context?.AddString(line);
            }
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

            // The nearest flat spot within 40 m, not wherever the player stands.
            Vector3 spot = HearthGround.FlatSpotNear(GroundInFront(player, 4f));
            GameObject made = Object.Instantiate(HearthPrefab.Prefab, spot, Quaternion.Euler(0f, player.transform.eulerAngles.y, 0f));

            // Settled by hand: the world generator's spacing and rarity rules don't apply to it.
            made.GetComponent<ZNetView>()?.GetZDO()?.Set(VillageBrain.KeyManual, 1);
            Say(context, $"Villheim: a hearth is lit {Vector3.Distance(spot, player.transform.position):0} m away, on the flattest ground nearby. " +
                         "The first settlers arrive within a few seconds.");
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

            Blueprints.Blueprint blueprint = Blueprints.Find(args[0].StartsWith(Blueprints.Prefix) ? args[0] : Blueprints.Prefix + args[0]);
            if (blueprint != null)
            {
                // A blueprint goes up at once, ground first, so it can be looked at.
                Vector3 at = GroundInFront(player, blueprint.Radius + 3f);
                float turn = player.transform.eulerAngles.y;
                TerrainShaper.LevelPad(at, blueprint.Radius * 0.7f, blueprint.Radius * 0.7f + 3f);
                int count = 0;
                foreach (DesignSpawner.PlanEntry entry in Blueprints.MakePlan(blueprint, at, turn))
                {
                    if (DesignSpawner.SpawnEntry(entry, at, Quaternion.Euler(0f, turn, 0f), 0, false) != null)
                    {
                        count++;
                    }
                }

                Say(context, $"Villheim: built {blueprint.Name} ({blueprint.Role} '{blueprint.Family}' level {blueprint.Level}, {count} pieces).");
                return;
            }

            ZoneSystem.ZoneLocation location = DesignLibrary.Find(args[0]);
            if (location == null)
            {
                Say(context, $"Villheim: no location or blueprint called '{args[0]}'. 'vh_previews' writes the full list.");
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

            Villheim.Logic.Designs.AssetGuard.Load(location);
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
