using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Designs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Design review in a fresh world, in two steps:
    ///
    /// 1. 'vh flatten [size]' clears everything from a square in front of the player and levels it at his feet's height,
    ///    as far as the game's 8 m either way allows, and takes the grass off. The player touches it up by hand (PlanBuild's
    ///    terrain tool).
    /// 2. 'vh gallery [stage] [group] [page N]' lays ten designs a page out in front of the player, grouped by kind,
    ///    each on the middle height of the ground under it and set on its foundation after it is put down (measured
    ///    from its colliders), with a sign: kind, stage, design name, number, creator. Every design is shown; each has
    ///    one stage from what most of its building pieces are made of (see Classify). 'vh report' writes them all to
    ///    BepInEx/Villheim/design-list.csv for the review sheet, with the same numbers and pages; 'vh gallery show'
    ///    lays out named ones, 'vh gallery clear' removes a gallery. Gallery pieces never wear or fall (see NoWearPatch).
    /// </summary>
    internal static class Gallery
    {
        private sealed class Cell
        {
            public bool Terrace;
            public int Number;
            public int Stage;
            public int Pieces;
            public int Building;
            public string Notes = "";
            public DesignLibrary.Design Design;

            /// <summary>Pieces put up for it on the page, and whether they came from a pass 3 save.</summary>
            public int Placed;
            public bool Edited;

            /// <summary>How far the design is moved up (down below zero) after it is set on its foundation (a saved nudge).</summary>
            public float GroundOffset;

            /// <summary>The middle of the design's pieces, in its own coordinates (locations are not built round their middle).</summary>
            public Vector3 Offset;

            /// <summary>The stage whose materials the design is shown in ('vh gallery ... as meadows'), or -1 for as built.</summary>
            public int AsStage = -1;

            /// <summary>What the material swap did, for the sign.</summary>
            public string SwapNote;

            /// <summary>Laid out in one flow, in list order, rows as wide as the flat area (keepers pages).</summary>
            public bool Flow;

            /// <summary>Size has run (the plot's half width is measured).</summary>
            public bool Sized;
            public Role Role;
            public Vector3 Center;
            public float Half;
            public bool Done;
        }

        private static readonly Role[] Order = { Role.House, Role.Hub, Role.Workshop, Role.Storage, Role.Farm };
        internal static readonly int KeyGallery = "villheim_gallery".GetStableHashCode();
        internal const string KeySwappedFrom = "villheim_swapped_from";

        /// <summary>The design a gallery piece or sign belongs to, so 'vh swap' changes one design at a time.</summary>
        internal const string KeyDesign = "villheim_design";

        // On a design's front sign: its plot (middle on the ground, half its width, which way the design was turned), its
        // number and how many pieces went up, so 'vh bp save' can save what stands there now.
        internal const string KeyPlotCenter = "villheim_plot_center";
        internal const string KeyPlotHalf = "villheim_plot_half";
        internal const string KeyPlotYaw = "villheim_plot_yaw";
        internal const string KeyNumber = "villheim_number";
        internal const string KeyPlaced = "villheim_placed";
        internal const string KeyGroundOffset = "villheim_ground_offset";

        /// <summary>On a design's front sign: how far 'vh swap' has nudged it since it went up, in the design's own coordinates.</summary>
        internal const string KeyNudge = "villheim_nudge";

        /// <summary>On a design's front sign: part of it was moved by hand (Ctrl and the numpad), so a page save takes it.</summary>
        internal const string KeyTouched = "villheim_touched";

        /// <summary>Where 'vh bp save' keeps designs edited in the gallery: p3-&lt;number&gt;-&lt;name&gt;.blueprint.</summary>
        internal static string PassThreeFolder => System.IO.Path.Combine(Blueprints.Folder, "inspiration", "pass3");

        /// <summary>The pass 3 save of a design, if there is one.</summary>
        internal static string PassThreeFile(string design)
        {
            string stem = design.StartsWith(Blueprints.Prefix) ? design.Substring(Blueprints.Prefix.Length) : design;
            if (!System.IO.Directory.Exists(PassThreeFolder))
            {
                return null;
            }

            return System.IO.Directory.GetFiles(PassThreeFolder, "p3-*.blueprint")
                .FirstOrDefault(f => System.IO.Path.GetFileNameWithoutExtension(f).EndsWith("-" + stem, System.StringComparison.Ordinal));
        }

        /// <summary>Room between rows of a keepers page, for the stand-ins 'vh swap' lays out in front of a sign.</summary>
        private const float Aisle = 14f;
        internal const string KeySwappedRotation = "villheim_swapped_rotation";

        /// <summary>For a stand-in: the middle of the piece it stands in for (one original may have several stand-in pieces).</summary>
        internal const string KeySwappedCenter = "villheim_swapped_center";

        /// <summary>The stage the last gallery page was shown as ('as meadows'), or -1: what 'vh swap' pairs for.</summary>
        internal static int LastAsStage = -1;
        // Any calm land will do for a gallery (mobs can be set passive): not the Mistlands, Ashlands, Deep North or sea.
        private const Heightmap.Biome GalleryLand = Heightmap.Biome.Meadows | Heightmap.Biome.BlackForest | Heightmap.Biome.Plains |
                                                    Heightmap.Biome.Swamp | Heightmap.Biome.Mountain;

        private const float MaxRelief = 12f; // highest less lowest ground in the area: within the game's 8 m either way of the middle

        /// <summary>
        /// Gallery pieces never wear or fall: the game's support check would bring down a design whose pieces don't all
        /// hold each other up the moment it is put down in one go (seen 2026-11-06). Only pieces marked as the gallery's.
        /// </summary>
        [HarmonyLib.HarmonyPatch(typeof(WearNTear), nameof(WearNTear.UpdateWear))]
        internal static class NoWearPatch
        {
            private static bool Prefix(WearNTear __instance) =>
                (__instance.m_nview == null || !__instance.m_nview.IsValid() || __instance.m_nview.GetZDO().GetInt(KeyGallery) != 1) &&
                !DesignBoard.Inside(__instance.transform.position);
        }
        private const float PadSpacing = 24f;
        private const float PadRadius = 20f;
        private const float Margin = 12f;

        private sealed class Pad
        {
            public Vector3 Center;
            public bool Done;
        }

        /// <summary>The groups the gallery can show, by the word used in the command.</summary>
        private static readonly Dictionary<string, Role[]> Groups = new Dictionary<string, Role[]>
        {
            ["all"] = Order,
            ["house"] = new[] { Role.House },
            ["hall"] = new[] { Role.Hub },
            ["prof"] = new[] { Role.Workshop },
            ["storage"] = new[] { Role.Storage },
            ["farm"] = new[] { Role.Farm },
        };

        private const int PageSize = 10;

        public const string Usage =
            "vh gallery [page N]: ten designs a page, in the order of BepInEx/Villheim/design-list.csv ('vh report' writes it). " +
            "'vh gallery keepers [as <stage>] [size N] [page N]' shows only the designs kept in the review, 50 a page by " +
            "piece count, optionally in another stage's materials (e.g. 'vh gallery keepers as meadows page 3'). " +
            "'vh gallery <meadows|blackforest|swamp|mountain|plains|mistlands|ashlands> [all|house|hall|prof|storage|farm] [page N]' " +
            "shows one stage or kind, e.g. 'vh gallery meadows house page 2'. " +
            "'vh gallery next' / 'prev' / 'again' clears the page shown and shows the next, the one before, or the same again. " +
            "'vh gallery show <name> [name...]' lays out those designs. 'vh gallery clear' removes a gallery.";

        private static bool _running;

        /// <summary>Raised by 'vh gallery clear' and by each new page: a gallery still being put up stops.</summary>
        private static int _generation;

        /// <summary>Space between designs on a page, beyond their own size.</summary>
        private const float Gap = 6f;

        /// <summary>The stages of the game in order. Each design belongs to one (see Classify).</summary>
        internal static readonly string[] StageNames = { "Meadows", "Black Forest", "Swamp", "Mountain", "Plains", "Mistlands", "Ashlands", "Deep North" };

        /// <summary>Words for the stages in commands and in the saved last page.</summary>
        internal static readonly string[] StageWords = { "meadows", "blackforest", "swamp", "mountain", "plains", "mistlands", "ashlands", "deepnorth" };

        /// <summary>
        /// The first stage a player has each material in. Fine wood and core wood need the bronze axe, coal the
        /// charcoal kiln (surtling cores), so they count as Black Forest. Crafted items not listed here (lanterns, meads,
        /// sharpening stones) take the stage of their own recipe (see ItemStage). Anything else does not set a stage and
        /// shows in the notes.
        /// </summary>
        private static readonly Dictionary<string, int> MaterialStage = ByStage(
            "Wood Stone Resin Flint LeatherScraps DeerHide BoneFragments Feathers Raspberry Dandelion Mushroom HardAntler " +
            "TrophyDeer TrophyBoar TrophyNeck TrophyEikthyr TrophyBjorn Honey QueenBee StoneRock",
            "FineWood RoundLog Coal Copper Tin Bronze BronzeNails SurtlingCore GreydwarfEye TrollHide Thistle Blueberries " +
            "AncientSeed CarrotSeeds Carrot TrophyGreydwarf TrophyGreydwarfBrute TrophyGreydwarfShaman TrophyFrostTroll " +
            "TrophySkeleton TrophyTheElder CryptKey PineCone Coins MushroomYellow Thunderstone",
            "ElderBark Iron IronNails IronScrap Chain Guck Ooze Bloodbag WitheredBone Entrails Root Turnip TurnipSeeds " +
            "TrophyDraugr TrophyDraugrElite TrophyLeech TrophyBlob TrophyBonemass TrophyAbomination TrophyWraith Wishbone",
            "Silver SilverOre Obsidian WolfPelt WolfFang WolfClaw FreezeGland Crystal JuteRed DragonTear DragonEgg Onion " +
            "OnionSeeds SerpentScale TrophySerpent TrophyWolf TrophyDragonQueen TrophyHatchling TrophyFenring TrophySGolem TrophyCultist FirCone",
            "BlackMetal BlackMetalScrap Tar Barley BarleyFlour Flax LinenThread Needle LoxPelt GoblinTotem Cloudberry " +
            "TrophyGoblin TrophyGoblinBrute TrophyGoblinShaman TrophyLox TrophyDeathsquito TrophyGoblinKing TrophyGrowth YagluthDrop",
            "YggdrasilWood BlackMarble Eitr Sap Carapace Mandible BlackCore ScaleHide Bilebag RoyalJelly JuteBlue Softtissue " +
            "DvergrNeedle Wisp MechanicalSpring DvergrKeyFragment TrophySeeker TrophySeekerBrute TrophyGjall TrophyTick " +
            "TrophyDvergr TrophySeekerQueen TrophyHare QueenDrop CopperScrap MushroomMagecap MushroomJotunPuffs",
            "Grausten Blackwood FlametalNew Flametal FlametalOre FlametalOreNew CharredBone AskHide CeramicPlate MoltenCore " +
            "ProustitePowder CelestialFeather Vineberry MorgenSinew BellFragment TrophyCharredMelee TrophyFallenValkyrie TrophyFader " +
            "SulfurStone CharcoalResin GemstoneRed GemstoneBlue GemstoneGreen Charredskull TrophyAsksvin AsksvinCarrionSkull " +
            "VineGreenSeeds VineberrySeeds FaderDrop Fiddleheadfern",
            "Frostwood");

        /// <summary>The first stage a player has each crafting station in (the stonecutter needs iron).</summary>
        private static readonly Dictionary<string, int> StationStage = new Dictionary<string, int>
        {
            ["piece_workbench"] = 0,
            ["forge"] = 1,
            ["piece_stonecutter"] = 2,
            ["piece_artisanstation"] = 3,
            ["blackforge"] = 5,
            ["piece_magetable"] = 5,
            ["piece_cauldron"] = 1,
        };

        private static readonly Dictionary<string, string> StationLabels = new Dictionary<string, string>
        {
            ["piece_workbench"] = "the workbench",
            ["forge"] = "the forge",
            ["piece_stonecutter"] = "the stonecutter",
            ["piece_artisanstation"] = "the artisan table",
            ["blackforge"] = "the black forge",
            ["piece_magetable"] = "the galdr table",
            ["piece_cauldron"] = "the cauldron",
        };

        private static readonly Dictionary<string, int?> CraftedStage = new Dictionary<string, int?>();
        private static Dictionary<string, Recipe> _recipes;

        /// <summary>
        /// The stage of an item: from the table above, else from its recipe (its station and ingredients, followed a few
        /// steps down), else null when the game has no way to say (trader goods, other mods' drops).
        /// </summary>
        private static int? ItemStage(string item, int depth = 0)
        {
            if (MaterialStage.TryGetValue(item, out int known))
            {
                return known;
            }

            if (CraftedStage.TryGetValue(item, out int? cached))
            {
                return cached;
            }

            if (depth > 4 || ObjectDB.instance == null)
            {
                return null;
            }

            if (_recipes == null)
            {
                _recipes = new Dictionary<string, Recipe>();
                foreach (Recipe recipe in ObjectDB.instance.m_recipes)
                {
                    if (recipe != null && recipe.m_item != null && recipe.m_resources != null && recipe.m_resources.Length > 0 &&
                        !_recipes.ContainsKey(recipe.m_item.gameObject.name))
                    {
                        _recipes[recipe.m_item.gameObject.name] = recipe;
                    }
                }
            }

            int? stage = null;
            if (_recipes.TryGetValue(item, out Recipe found))
            {
                string station = found.m_craftingStation != null ? found.m_craftingStation.gameObject.name : null;
                stage = station != null && StationStage.TryGetValue(station, out int byStation) ? byStation : 0;
                foreach (Piece.Requirement requirement in found.m_resources)
                {
                    string ingredient = requirement?.m_resItem != null ? requirement.m_resItem.gameObject.name : null;
                    int? inner = ingredient != null && ingredient != item ? ItemStage(ingredient, depth + 1) : null;
                    if (inner.HasValue && inner.Value > stage.Value)
                    {
                        stage = inner.Value;
                    }
                }
            }

            CraftedStage[item] = stage;
            return stage;
        }

        /// <summary>
        /// Building pieces from a later stage a design may have and still count as its main stage: a quarter. Accent
        /// beams of ashwood or iron in a wood house leave it where its walls and roof put it; a whole tar roof does not.
        /// At one in ten, decorative ashwood beams (15 % of a thatch cottage) put it in the Ashlands (2026-11-07).
        /// </summary>
        private const float MinorShare = 0.25f;

        /// <summary>Locations need this many building pieces to count as a structure (a lone post or fence is not one).</summary>
        private const int MinLocationBuilding = 5;

        private static Dictionary<string, int> ByStage(params string[] perStage)
        {
            var stages = new Dictionary<string, int>();
            for (int stage = 0; stage < perStage.Length; stage++)
            {
                foreach (string material in perStage[stage].Split(new[] { ' ' }, System.StringSplitOptions.RemoveEmptyEntries))
                {
                    stages[material] = stage;
                }
            }

            return stages;
        }

        /// <summary>A stage from a command word, or -1 when the word is not one.</summary>
        private static int StageIndex(string word)
        {
            string w = (word ?? "").ToLowerInvariant();
            if (w.StartsWith("meadow")) return 0;
            if (w.StartsWith("black") || w.StartsWith("forest")) return 1;
            if (w.StartsWith("swamp")) return 2;
            if (w.StartsWith("mountain")) return 3;
            if (w.StartsWith("plain")) return 4;
            if (w.StartsWith("mist")) return 5;
            if (w.StartsWith("ash")) return 6;
            if (w.StartsWith("deep") || w.StartsWith("north")) return 7;
            return -1;
        }

        private enum Action
        {
            Page,
            List,
            Show,
        }

        public static string ListPath => System.IO.Path.Combine(BepInEx.Paths.BepInExRootPath, "Villheim", "design-list.csv");

        /// <summary>
        /// 'vh report': every design there is (curated, every blueprint, every location with a structure in it), each
        /// with its stage, kind, gallery page and notes, written to BepInEx/Villheim/design-list.csv for the review sheet.
        /// Nothing is put up. Locations are opened once and remembered (see CachePath).
        /// </summary>
        public static string Report(Terminal context, bool rescan)
        {
            if (_running || VillheimPlugin.Instance == null)
            {
                return "Villheim: the design list is already being gathered; give it a moment.";
            }

            VillheimPlugin.Instance.StartCoroutine(ReportRun(context, rescan));
            return "Villheim: gathering every design for the list" + (rescan ? " (opening every location again)." : ".");
        }

        private static IEnumerator ReportRun(Terminal context, bool rescan)
        {
            _running = true;
            var cells = new List<Cell>();
            try
            {
                yield return Catalogue(rescan, cells);
            }
            finally
            {
                _running = false;
            }

            string path = "";
            Safe("the list", () => path = WriteList(cells));
            string summary = $"{cells.Count} designs, {(cells.Count + PageSize - 1) / PageSize} gallery pages. By stage: " +
                             string.Join(", ", Enumerable.Range(0, StageNames.Length).Where(s => cells.Any(c => c.Stage == s))
                                 .Select(s => $"{StageNames[s]} {cells.Count(c => c.Stage == s)}")) +
                             ". By kind: " + string.Join(", ", Order.Select(r => $"{Kind(r)} {cells.Count(c => c.Role == r)}"));
            VillheimPlugin.Log.LogInfo($"Design list written to {path}: {summary}.");
            string done = $"Villheim: design list written to {path}. {summary}.";
            if (context != null)
            {
                context.AddString(done);
            }
            else
            {
                Console.instance?.Print(done);
            }

            MessageHud.instance?.ShowMessage(MessageHud.MessageType.TopLeft, $"Villheim: design list written ({cells.Count} designs)");
        }
        private static float _nextProgress;

        /// <summary>
        /// Progress in the middle of the screen, at most once a second. The top-left messages queue up and each stays a
        /// few seconds, so hundreds of them kept counting through the blueprints for half an hour after the lists were
        /// written (2026-11-07).
        /// </summary>
        private static void Progress(string text)
        {
            if (Time.unscaledTime < _nextProgress)
            {
                return;
            }

            _nextProgress = Time.unscaledTime + 1f;
            MessageHud.instance?.ShowMessage(MessageHud.MessageType.Center, text);
        }

        /// <summary>'vh gallery ...' (see Usage).</summary>
        public static string Start(Player player, string[] args)
        {
            if (_running)
            {
                return "Villheim: a gallery is already being gathered; give it a moment.";
            }

            string first = args.Length > 0 ? args[0].ToLowerInvariant() : "";
            if (first == "clear")
            {
                var gone = new List<ZNetView>();
                foreach (ZNetView view in ZNetScene.instance.m_instances.Values)
                {
                    if (view != null && view.IsValid() && view.GetZDO().GetInt(KeyGallery) == 1 &&
                        Utils.DistanceXZ(view.transform.position, player.transform.position) < 600f)
                    {
                        gone.Add(view);
                    }
                }

                _generation++;
                foreach (ZNetView view in gone)
                {
                    view.ClaimOwnership();
                    ZNetScene.instance.Destroy(view.gameObject);
                }

                // Pieces of big designs beyond the loaded area exist only as ZDOs; they go too.
                var far = new List<ZDO>();
                try
                {
                    far = UnloadedZdos(z => z.GetInt(KeyGallery) == 1 && Utils.DistanceXZ(z.GetPosition(), player.transform.position) < 600f);
                    DestroyZdos(far);
                }
                catch (System.Exception e)
                {
                    VillheimPlugin.Log.LogWarning($"Gallery clear: pieces beyond the loaded area were left: {e.Message}");
                }

                ClearOverflow();
                return $"Villheim: removed {gone.Count + far.Count} gallery pieces and signs within 600 m (the ground stays as it is).";
            }

            if (first == "next" || first == "prev" || first == "again")
            {
                if (!LoadLast(out string[] lastArgs, out int lastPage))
                {
                    return "Villheim: no gallery page shown yet; start with 'vh gallery page 1'.";
                }

                List<string> overflow = LoadOverflow(out int overflowPage);
                Start(player, new[] { "clear" });
                if (first == "next" && overflow.Count > 0 && overflowPage == lastPage)
                {
                    // The designs of this page that did not fit on the flat area come before the next page.
                    _onlyNext = new HashSet<string>(overflow);
                    return Start(player, lastArgs.Concat(new[] { "page", lastPage.ToString() }).ToArray()) +
                           $" The rest of page {lastPage}: {overflow.Count} designs that did not fit.";
                }

                // A to-do list (unsorted, nosubtype, crafting) shrinks as designs are sorted, so its page 2 would skip a
                // page's worth: next shows its first page again, which holds whatever is still left.
                int type = System.Array.IndexOf(lastArgs, "type");
                bool todo = type >= 0 && type + 1 < lastArgs.Length && (lastArgs[type + 1] == "unsorted" || lastArgs[type + 1] == "nosubtype" || lastArgs[type + 1] == "crafting");
                int wanted = todo ? 1 : first == "next" ? lastPage + 1 : first == "prev" ? Mathf.Max(1, lastPage - 1) : lastPage;
                return Start(player, lastArgs.Concat(new[] { "page", wanted.ToString() }).ToArray());
            }

            Action action = first == "list" ? Action.List : first == "show" ? Action.Show : Action.Page;
            string[] rest = action == Action.Page ? args : args.Skip(1).ToArray();
            Vector3 forward = player.transform.forward;
            forward.y = 0f;
            forward.Normalize();

            if (action == Action.Show)
            {
                if (rest.Length == 0)
                {
                    return "Villheim: " + Usage;
                }

                VillheimPlugin.Instance.StartCoroutine(ShowNamed(player.transform.position, forward, rest));
                return $"Villheim: laying out {rest.Length} named designs.";
            }

            bool rescan = rest.Any(w => w.ToLowerInvariant() == "rescan");
            if (action == Action.List)
            {
                return Report(null, rescan);
            }

            int stage = -1;
            string group = "all";
            int page = 1;
            bool keepers = false;
            int asStage = -1;
            int size = 0;
            string typeFilter = null;
            for (int a = 0; a < rest.Length; a++)
            {
                string word = rest[a].ToLowerInvariant();
                if (word == "rescan" || word == "all") continue;
                if (word.StartsWith("keep")) keepers = true;
                else if (word == "type" && a + 1 < rest.Length && DesignSort.TypeWord(rest[a + 1]) != null) { typeFilter = DesignSort.TypeWord(rest[a + 1]); a++; }
                else if (word == "as" && a + 1 < rest.Length && StageIndex(rest[a + 1]) >= 0) { asStage = StageIndex(rest[a + 1]); a++; }
                else if (word == "size" && a + 1 < rest.Length && int.TryParse(rest[a + 1], out int z)) { size = Mathf.Clamp(z, 1, 150); a++; }
                else if (word == "page" && a + 1 < rest.Length && int.TryParse(rest[a + 1], out int n)) { page = Mathf.Max(1, n); a++; }
                else if (int.TryParse(word, out int m)) page = Mathf.Max(1, m);
                else if (StageIndex(word) >= 0) stage = StageIndex(word);
                else if (word.StartsWith("prof") || word.StartsWith("work") || word.StartsWith("smith")) group = "prof";
                else if (word.StartsWith("hall") || word.StartsWith("hub") || word.StartsWith("long")) group = "hall";
                else if (word.StartsWith("hous") || word.StartsWith("home")) group = "house";
                else if (word.StartsWith("stor") || word.StartsWith("shed")) group = "storage";
                else if (word.StartsWith("farm") || word.StartsWith("barn")) group = "farm";
                else return "Villheim: " + Usage;
            }

            var saved = new List<string> { stage < 0 ? "all" : StageWords[stage], group };
            if (keepers) saved.Add("keepers");
            if (asStage >= 0) saved.AddRange(new[] { "as", StageWords[asStage] });
            if (size > 0) saved.AddRange(new[] { "size", size.ToString() });
            if (typeFilter != null) saved.AddRange(new[] { "type", typeFilter });
            SaveLast(saved, page);
            _typeFilter = typeFilter;
            _only = _onlyNext;
            _onlyNext = null;
            VillheimPlugin.Instance.StartCoroutine(Run(player.transform.position, forward, stage, group, page, rescan, keepers, asStage, size));
            string what = Describe(stage, group, keepers, asStage) + (typeFilter != null ? $", type {typeFilter}" : "");
            return $"Villheim: gathering designs ({what}, page {page}).";
        }

        /// <summary>
        /// Every design there is, each sorted into one stage: the curated lists, every blueprint (all folders, inspiration
        /// included) and every location with at least <see cref="MinLocationBuilding"/> building pieces. Sorted by stage,
        /// kind, size and name, and numbered; ten to a gallery page.
        /// </summary>
        private static IEnumerator Catalogue(bool rescan, List<Cell> cells)
        {
            var seen = new HashSet<string>();
            void Add(DesignLibrary.Design design, Role role, Sorting sorting)
            {
                if (sorting != null && seen.Add(design.Name))
                {
                    cells.Add(new Cell
                    {
                        Design = design, Role = role, Stage = sorting.Stage, Pieces = sorting.Pieces, Building = sorting.Building,
                        Notes = sorting.Notes, Half = Mathf.Clamp(design.Radius + 2f, 6f, 36f),
                    });
                }
            }

            var candidates = new List<(DesignLibrary.Design Design, Role Role)>();
            Safe("the curated lists", () =>
            {
                foreach (Heightmap.Biome biome in new[] { Heightmap.Biome.Meadows, Heightmap.Biome.BlackForest, Heightmap.Biome.Swamp, Heightmap.Biome.Mountain })
                {
                    foreach (Role role in Order)
                    {
                        foreach (DesignLibrary.Design design in DesignLibrary.PoolFor(biome, role).Concat(DesignLibrary.FallbackPool(biome, role)))
                        {
                            candidates.Add((design, role));
                        }
                    }
                }
            });

            Safe("the blueprints", () =>
            {
                foreach (Blueprints.Blueprint blueprint in Blueprints.All().Values)
                {
                    // Copies made in the gallery (pass 3 saves, material swaps) belong to their design, not the list.
                    string file = (blueprint.File ?? "").Replace('\\', '/').ToLowerInvariant();
                    if (!file.Contains("/inspiration/pass3/") && !file.Contains("/inspiration/edits/") && !file.Contains("/inspiration/board/"))
                    {
                        candidates.Add((new DesignLibrary.Design(blueprint, 1f), blueprint.Role));
                    }
                }
            });

            int looked = 0;
            foreach ((DesignLibrary.Design design, Role role) in candidates)
            {
                if (seen.Contains(design.Name))
                {
                    continue;
                }

                if (++looked % 10 == 0)
                {
                    Progress($"Design list: looked at {looked}/{candidates.Count} blueprints and listed designs");
                    yield return null;
                }

                Sorting sorting = null;
                Safe(design.Name, () => sorting = design.Blueprint != null
                    ? Classify(design.Blueprint.Pieces.Select(p => p.Prefab))
                    : ClassifyLocation(design.Location));
                Add(design, role, sorting);
            }

            // Every location in the game, one per frame the first time; what each turned out to be is kept on disk.
            var locations = new List<ZoneSystem.ZoneLocation>();
            Safe("the location list", () => locations.AddRange(ZoneSystem.instance.m_locations
                .Where(l => l != null && l.m_prefab.IsValid && l.m_exteriorRadius <= 40f && !Unsuitable(l.m_prefabName) && !AssetGuard.IsBroken(l))
                .GroupBy(l => l.m_prefabName).Select(g => g.First())));
            Dictionary<string, Sorting> known = rescan ? new Dictionary<string, Sorting>() : ReadCache();
            int checkedCount = 0, opened = 0;
            foreach (ZoneSystem.ZoneLocation location in locations)
            {
                checkedCount++;
                if (seen.Contains(location.m_prefabName))
                {
                    continue;
                }

                if (!known.TryGetValue(location.m_prefabName, out Sorting sorting))
                {
                    Safe(location.m_prefabName, () => sorting = ClassifyLocation(location));
                    known[location.m_prefabName] = sorting ?? new Sorting();
                    if (++opened % 10 == 0)
                    {
                        Progress($"Design list: opened {checkedCount}/{locations.Count} locations, {cells.Count} designs so far");
                    }

                    yield return null;
                }

                if (sorting != null && sorting.Building >= MinLocationBuilding)
                {
                    Add(new DesignLibrary.Design(location, 1f), RoleFromName(location.m_prefabName), sorting);
                }
            }

            Safe("the location cache", () => WriteCache(known));
            cells.Sort((a, b) =>
            {
                int byStage = a.Stage.CompareTo(b.Stage);
                if (byStage != 0) return byStage;
                int byRole = System.Array.IndexOf(Order, a.Role).CompareTo(System.Array.IndexOf(Order, b.Role));
                if (byRole != 0) return byRole;
                int bySize = a.Design.Radius.CompareTo(b.Design.Radius);
                return bySize != 0 ? bySize : string.CompareOrdinal(a.Design.Name, b.Design.Name);
            });

            // Numbers never change once given: the review sheet and the gallery pages go by them. Designs already in
            // design-list.csv keep their number; new ones come after, in the order above.
            Dictionary<string, int> numbers = ReadNumbers();
            int next = numbers.Count > 0 ? numbers.Values.Max() : 0;
            foreach (Cell cell in cells)
            {
                cell.Number = numbers.TryGetValue(cell.Design.Name, out int number) ? number : ++next;
            }

            cells.Sort((a, b) => a.Number.CompareTo(b.Number));
        }

        /// <summary>Design name and number from the last design-list.csv, if there is one.</summary>
        internal static Dictionary<string, int> ReadNumbers()
        {
            var numbers = new Dictionary<string, int>();
            try
            {
                if (System.IO.File.Exists(ListPath))
                {
                    foreach (string line in System.IO.File.ReadAllLines(ListPath).Skip(1))
                    {
                        // Number,Page,"Stage",Kind,"Name",...: the name is the third quoted field.
                        string[] quoted = line.Split('"');
                        int comma = line.IndexOf(',');
                        if (quoted.Length > 3 && comma > 0 && int.TryParse(line.Substring(0, comma), out int number))
                        {
                            numbers[quoted[3]] = number;
                        }
                    }
                }
            }
            catch (System.Exception e)
            {
                VillheimPlugin.Log.LogWarning($"Gallery: could not read the old design numbers: {e.Message}");
            }

            return numbers;
        }

        /// <summary>What one prefab is, worked out once: whether a player can build it, whether it is a building piece, its stage.</summary>
        private sealed class PieceInfo
        {
            public bool Known;
            public bool IsPiece;
            public bool Buildable;
            public bool Building;
            public int Stage;
            public string Why;
            public string OtherMaterial;
        }

        private static readonly Dictionary<string, PieceInfo> Infos = new Dictionary<string, PieceInfo>();

        private static PieceInfo Info(string prefab)
        {
            if (Infos.TryGetValue(prefab, out PieceInfo info))
            {
                return info;
            }

            info = new PieceInfo();
            GameObject go = ZNetScene.instance.GetPrefab(prefab);
            Piece piece = go != null ? go.GetComponent<Piece>() : null;
            info.Known = go != null;
            info.IsPiece = piece != null;
            if (piece != null && piece.m_resources != null && piece.m_resources.Length > 0)
            {
                info.Buildable = true;
                string lower = prefab.ToLowerInvariant();
                info.Building = piece.m_category == Piece.PieceCategory.BuildingWorkbench || piece.m_category == Piece.PieceCategory.BuildingStonecutter ||
                                lower.Contains("door") || lower.Contains("gate") || lower.Contains("window");
                string station = piece.m_craftingStation != null ? piece.m_craftingStation.gameObject.name : null;
                if (station != null && StationStage.TryGetValue(station, out int byStation))
                {
                    info.Stage = byStation;
                    info.Why = StationLabels.TryGetValue(station, out string label) ? label : station;
                }

                foreach (Piece.Requirement requirement in piece.m_resources)
                {
                    if (requirement?.m_resItem == null || requirement.m_amount <= 0)
                    {
                        continue;
                    }

                    string material = requirement.m_resItem.gameObject.name;
                    int? byMaterial = ItemStage(material);
                    if (!byMaterial.HasValue)
                    {
                        info.OtherMaterial = material;
                    }
                    else if (info.Why == null || byMaterial.Value > info.Stage)
                    {
                        info.Stage = byMaterial.Value;
                        info.Why = material;
                    }
                }
            }

            Infos[prefab] = info;
            return info;
        }

        /// <summary>A design's stage, counts and notes.</summary>
        private sealed class Sorting
        {
            public int Stage;
            public int Pieces;
            public int Building;
            public string Notes = "";
        }

        /// <summary>
        /// The design's stage is the first one whose materials and stations cover all but a quarter of its building
        /// pieces (walls, floors, beams, roofs, doors, windows). Decoration, furniture and crafting stations never set
        /// it; a design with no building pieces at all goes by all its pieces. Everything from a later stage is named in
        /// the notes, with pieces a player cannot build and pieces from mods that are not installed.
        /// </summary>
        private static Sorting Classify(IEnumerable<string> prefabs)
        {
            var pieces = new List<PieceInfo>();
            var unbuildable = new Dictionary<string, int>();
            var missing = new Dictionary<string, int>();
            var others = new HashSet<string>();
            foreach (string prefab in prefabs)
            {
                if (prefab.StartsWith("piece_bp", System.StringComparison.OrdinalIgnoreCase))
                {
                    continue; // PlanBuild's own markers (centre point, snap points), never part of the building
                }

                PieceInfo info = Info(prefab);
                if (!info.Known)
                {
                    Count(missing, prefab);
                }
                else if (!info.IsPiece)
                {
                    continue;
                }
                else if (!info.Buildable)
                {
                    Count(unbuildable, prefab);
                }
                else
                {
                    pieces.Add(info);
                    if (info.OtherMaterial != null)
                    {
                        others.Add(info.OtherMaterial);
                    }
                }
            }

            List<PieceInfo> pool = pieces.Where(p => p.Building).ToList();
            if (pool.Count == 0)
            {
                pool = pieces;
            }

            int stage = 0;
            int allowed = Mathf.FloorToInt(pool.Count * MinorShare);
            while (stage < StageNames.Length - 1 && pool.Count(p => p.Stage > stage) > allowed)
            {
                stage++;
            }

            var notes = new List<string>();
            notes.AddRange(pieces.Where(p => p.Stage > stage).GroupBy(p => p.Why).OrderByDescending(g => g.Count())
                .Select(g => $"{g.Count()} {(g.Count() == 1 ? "needs" : "need")} {g.Key} ({StageNames[g.First().Stage]})"));
            if (unbuildable.Count > 0)
            {
                notes.Add($"{unbuildable.Values.Sum()} a player can't build ({Top(unbuildable)})");
            }

            if (missing.Count > 0)
            {
                notes.Add($"{missing.Values.Sum()} from mods not installed ({Top(missing)})");
            }

            if (others.Count > 0)
            {
                notes.Add("materials with no known stage: " + string.Join(", ", others.Take(4)));
            }

            return new Sorting
            {
                Stage = stage,
                Pieces = pieces.Count + unbuildable.Values.Sum() + missing.Values.Sum(),
                Building = pieces.Count(p => p.Building),
                Notes = string.Join("; ", notes),
            };
        }

        private static Sorting ClassifyLocation(ZoneSystem.ZoneLocation location)
        {
            AssetGuard.Load(location);
            try
            {
                GameObject asset = location.m_prefab.Asset;
                return asset != null ? Classify(DesignSpawner.MakePlan(asset, Vector3.zero, 1, 0f, false).Select(e => e.Prefab)) : null;
            }
            finally
            {
                location.m_prefab.Release();
            }
        }

        private static void Count(Dictionary<string, int> counts, string key)
        {
            counts.TryGetValue(key, out int n);
            counts[key] = n + 1;
        }

        private static string Top(Dictionary<string, int> counts) =>
            string.Join(", ", counts.OrderByDescending(k => k.Value).Take(3).Select(k => k.Key)) + (counts.Count > 3 ? ", ..." : "");

        private static string Describe(int stage, string group, bool keepers, int asStage) =>
            (keepers ? "keepers" : stage < 0 && group == "all" ? "all designs" : "") +
            (stage >= 0 || group != "all" ? (keepers ? ", " : "") + $"{(stage < 0 ? "all stages" : StageNames[stage])}, {group}" : "") +
            (asStage >= 0 ? $", shown as {StageNames[asStage]}" : "");

        private static IEnumerator Run(Vector3 playerPosition, Vector3 forward, int stage, string group, int page, bool rescan, bool keepers, int asStage, int size)
        {
            _running = true;
            var cells = new List<Cell>();
            try
            {
                yield return Catalogue(rescan, cells);
            }
            finally
            {
                _running = false;
            }

            // The list for the review sheet is written every time, so it always matches what the pages show.
            string listPath = "";
            Safe("the list", () => listPath = WriteList(cells));
            Role[] roles = Groups[group];
            var kept = new Dictionary<string, int>();
            for (int k = 0; k < Keepers.Names.Length; k++)
            {
                kept[Keepers.Names[k]] = k;
            }

            string typeFilter = _typeFilter;
            HashSet<string> only = _only;
            List<Cell> matching = cells.Where(c => roles.Contains(c.Role) && (stage < 0 || c.Stage == stage) && (!keepers || kept.ContainsKey(c.Design.Name)) &&
                                                   (typeFilter == null || DesignSort.Matches(c.Design.Name, typeFilter))).ToList();

            // Keepers in their own order (by piece count, near-copies together), 50 to a page, laid out in one flow
            // so like sits next to like; the Pass 2 tab of the review sheet has the same pages.
            if (keepers)
            {
                matching = matching.OrderBy(c => kept[c.Design.Name]).ToList();
                matching.ForEach(c => c.Flow = true);
            }

            List<List<Cell>> paged = Chunks(matching, size > 0 ? size : keepers ? KeeperPageSize : PageSize);
            int pages = Mathf.Max(1, paged.Count);
            string what = Describe(stage, group, keepers, asStage) + (typeFilter != null ? $", type {typeFilter}" : "");
            Console.instance?.Print($"Villheim: {cells.Count} designs in all; {what}: {matching.Count} ({pages} pages). Full list: {listPath}");
            List<Cell> chosen = page <= paged.Count ? paged[page - 1] : new List<Cell>();
            int onPage = chosen.Count;
            if (keepers)
            {
                // Designs already sorted (phase A) are left off, so the page shows only what still needs a choice.
                chosen = chosen.Where(c => !DesignSort.SkipOnPage(c.Design.Name, typeFilter)).ToList();
                if (chosen.Count < onPage)
                {
                    Console.instance?.Print($"Villheim: page {page}: {onPage - chosen.Count} of {onPage} already sorted and left off ('type any' shows them).");
                }
            }

            if (only != null)
            {
                chosen = chosen.Where(c => only.Contains(c.Design.Name)).ToList();
            }

            // Only as many designs as fit on the flat area go up; the rest wait for 'vh gallery next', so nothing lands
            // in the woods beyond it. Page numbers stay as the sheet has them.
            var waiting = new List<string>();
            if (keepers && chosen.Count > 0)
            {
                foreach (Cell cell in chosen)
                {
                    Cell sized = cell;
                    Safe("the size of " + cell.Design.Name, () => Size(sized));
                    sized.Sized = true;
                }

                int fit = FitFlat(chosen);
                waiting = chosen.Skip(fit).Select(c => c.Design.Name).ToList();
                chosen = chosen.Take(fit).ToList();
                if (waiting.Count > 0)
                {
                    Console.instance?.Print($"Villheim: page {page}: {chosen.Count} designs fit on the flat area; the other {waiting.Count} come up with 'vh gallery next'.");
                }
            }

            SaveOverflow(page, waiting);
            chosen.ForEach(c => c.AsStage = asStage);
            MaterialSwap.ClearMisses();
            LastAsStage = asStage;
            if (chosen.Count == 0)
            {
                Console.instance?.Print(onPage > 0
                    ? $"Villheim: every design of page {page} is sorted; 'vh gallery next' for page {page + 1} of {pages}."
                    : $"Villheim: page {page} is empty; {what} has {pages} pages.");
                yield break;
            }

            Console.instance?.Print($"Villheim: {what}, page {page} of {pages} (designs {chosen.First().Number} to {chosen.Last().Number})." +
                                    (page < pages ? " 'vh gallery next' clears this page and shows the next." : " That was the last page."));
            MessageHud.instance?.ShowMessage(MessageHud.MessageType.Center, $"Gallery: {what}, page {page} of {pages}");
            yield return Place(chosen, playerPosition, forward);
        }

        private const int KeeperPageSize = 50;

        /// <summary>'type X' of the page being put up: only designs sorted as X (DesignSort.Matches), or null for all.</summary>
        private static string _typeFilter;

        /// <summary>The page shows only these designs (the rest of a page that did not fit), or null for all of it.</summary>
        private static HashSet<string> _only;
        private static HashSet<string> _onlyNext;

        /// <summary>How many of the cells, in order, fit on the flat area in the keepers flow layout (at least one).</summary>
        private static int FitFlat(List<Cell> cells)
        {
            const float MaxRow = FlatWidth - 20f;
            const float MaxDepth = FlatDepth - 10f;
            float depth = 0f;
            int i = 0;
            while (i < cells.Count)
            {
                int first = i;
                float used = cells[i++].Half * 2f;
                while (i < cells.Count && used + Gap + cells[i].Half * 2f <= MaxRow)
                {
                    used += Gap + cells[i++].Half * 2f;
                }

                float rowDepth = cells.Skip(first).Take(i - first).Max(c => c.Half);
                if (first > 0 && depth + rowDepth * 2f > MaxDepth)
                {
                    return first;
                }

                depth += rowDepth * 2f + Aisle;
            }

            return cells.Count;
        }

        private static string OverflowPath => System.IO.Path.Combine(BepInEx.Paths.BepInExRootPath, "Villheim", "gallery-overflow.txt");

        private static void SaveOverflow(int page, List<string> names)
        {
            try
            {
                if (names.Count == 0)
                {
                    ClearOverflow();
                    return;
                }

                System.IO.Directory.CreateDirectory(System.IO.Path.GetDirectoryName(OverflowPath));
                System.IO.File.WriteAllLines(OverflowPath, new[] { page.ToString() }.Concat(names));
            }
            catch (System.Exception e)
            {
                VillheimPlugin.Log.LogWarning($"Gallery: could not keep the rest of the page: {e.Message}");
            }
        }

        private static void ClearOverflow()
        {
            try
            {
                if (System.IO.File.Exists(OverflowPath))
                {
                    System.IO.File.Delete(OverflowPath);
                }
            }
            catch (System.Exception)
            {
                // Nothing to keep.
            }
        }

        private static List<string> LoadOverflow(out int page)
        {
            page = 0;
            try
            {
                if (System.IO.File.Exists(OverflowPath))
                {
                    string[] lines = System.IO.File.ReadAllLines(OverflowPath);
                    if (lines.Length > 1 && int.TryParse(lines[0], out page))
                    {
                        return lines.Skip(1).Where(l => l.Length > 0).ToList();
                    }
                }
            }
            catch (System.Exception)
            {
                // Treated as nothing waiting.
            }

            return new List<string>();
        }

        /// <summary>Gallery ZDOs the game has not loaded (no instance), matching the test.</summary>
        internal static List<ZDO> UnloadedZdos(System.Func<ZDO, bool> test)
        {
            var found = new List<ZDO>();
            if (ZDOMan.instance == null || ZNetScene.instance == null)
            {
                return found;
            }

            foreach (ZDO zdo in ZDOMan.instance.m_objectsByID.Values)
            {
                if (zdo != null && zdo.IsValid() && test(zdo) && ZNetScene.instance.FindInstance(zdo) == null)
                {
                    found.Add(zdo);
                }
            }

            return found;
        }

        internal static void DestroyZdos(IEnumerable<ZDO> zdos)
        {
            foreach (ZDO zdo in zdos)
            {
                zdo.SetOwner(ZDOMan.GetSessionID());
                ZDOMan.instance.DestroyZDO(zdo);
            }
        }

        private static List<List<Cell>> Chunks(List<Cell> cells, int size)
        {
            var chunks = new List<List<Cell>>();
            for (int i = 0; i < cells.Count; i += size)
            {
                chunks.Add(cells.Skip(i).Take(size).ToList());
            }

            return chunks;
        }

        /// <summary>'vh gallery show': the named designs, wherever they come from, without the stage test.</summary>
        private static IEnumerator ShowNamed(Vector3 playerPosition, Vector3 forward, string[] names)
        {
            var cells = new List<Cell>();
            foreach (string name in names)
            {
                DesignLibrary.Design? design = DesignLibrary.ByName(name) ?? DesignLibrary.ByName(Blueprints.Prefix + name);
                if (design == null)
                {
                    Console.instance?.Print($"Villheim: no design called '{name}'.");
                    continue;
                }

                Role role = design.Value.Blueprint != null ? design.Value.Blueprint.Role : RoleFromName(name);
                cells.Add(new Cell { Design = design.Value, Role = role, Half = Mathf.Clamp(design.Value.Radius + 2f, 6f, 36f) });
            }

            if (cells.Count > 0)
            {
                yield return Place(cells, playerPosition, forward);
            }
        }

        private static string WriteList(List<Cell> cells)
        {
            string path = ListPath;
            var lines = new List<string> { "Number,Page,Stage,Kind,Name,Source,Creator,Pieces,Building pieces,Radius,Notes" };
            foreach (Cell cell in cells)
            {
                lines.Add(string.Join(",", cell.Number, (cell.Number - 1) / PageSize + 1, Csv(StageNames[cell.Stage]), Kind(cell.Role),
                    Csv(cell.Design.Name), Csv(Source(cell.Design)), Csv(Creator(cell.Design)), cell.Pieces, cell.Building,
                    cell.Design.Radius.ToString("0", System.Globalization.CultureInfo.InvariantCulture), Csv(cell.Notes)));
            }

            System.IO.Directory.CreateDirectory(System.IO.Path.GetDirectoryName(path));
            System.IO.File.WriteAllLines(path, lines);
            return path;
        }

        private static string LastPath => System.IO.Path.Combine(BepInEx.Paths.BepInExRootPath, "Villheim", "gallery-last-page.txt");

        /// <summary>The words of the last page shown and its number, kept on disk: "meadows house keepers as plains 3".</summary>
        private static void SaveLast(List<string> words, int page) =>
            Safe("the last page", () => System.IO.File.WriteAllText(LastPath, string.Join(" ", words) + " " + page));

        private static bool LoadLast(out string[] words, out int page)
        {
            words = new string[0];
            page = 1;
            try
            {
                string[] parts = System.IO.File.ReadAllText(LastPath).Trim().Split(' ');
                words = parts.Take(parts.Length - 1).ToArray();
                return parts.Length >= 1 && int.TryParse(parts[parts.Length - 1], out page);
            }
            catch
            {
                return false;
            }
        }

        private static string Csv(string text) => "\"" + (text ?? "").Replace("\"", "'") + "\"";

        private static string Kind(Role role)
        {
            foreach (KeyValuePair<string, Role[]> group in Groups)
            {
                if (group.Key != "all" && group.Value.Contains(role))
                {
                    return group.Key;
                }
            }

            return "house";
        }

        private static string Source(DesignLibrary.Design design)
        {
            if (design.Blueprint != null)
            {
                return "blueprint " + System.IO.Path.GetFileName(design.Blueprint.File);
            }

            return design.Name.StartsWith("MWL_") ? "location (More World Locations)" : "location";
        }

        private static string Creator(DesignLibrary.Design design)
        {
            if (design.Blueprint != null)
            {
                return string.IsNullOrEmpty(design.Blueprint.Creator) ? "unknown" : design.Blueprint.Creator;
            }

            return design.Name.StartsWith("MWL_") ? "warpalicious" : "Iron Gate (vanilla) or a mod";
        }

        /// <summary>
        /// Lays the cells out in front of the player and puts them up on the ground as it is there: no clearing, no
        /// levelling (that is 'vh flatten', touched up by hand). Each design goes on the middle height of the ground
        /// under it, measured when its zone is loaded.
        /// </summary>
        private static IEnumerator Place(List<Cell> cells, Vector3 playerPosition, Vector3 forward)
        {
            var labels = new List<(Vector3 At, string Text)>();
            float depth = 0f, widest = 0f;
            foreach (Cell cell in cells)
            {
                Cell sized = cell;
                if (!sized.Sized)
                {
                    Safe("the size of " + cell.Design.Name, () => Size(sized));
                }
            }

            Safe("the layout", () => Layout(cells, forward, labels, out depth, out widest));
            // On the area last flattened, when it is near; else in front of the player.
            Vector3 start = playerPosition + forward * 8f;
            if (LoadFlat(out Vector3 flatStart, out Vector3 flatForward) && Utils.DistanceXZ(flatStart, playerPosition) < 600f)
            {
                start = flatStart + flatForward * 4f;
                if (Vector3.Angle(flatForward, forward) > 1f)
                {
                    labels.Clear();
                    cells.ForEach(c => c.Center = Vector3.zero);
                    forward = flatForward;
                    Safe("the layout", () => Layout(cells, forward, labels, out depth, out widest));
                }
            }

            foreach (Cell cell in cells)
            {
                cell.Center = new Vector3(start.x + cell.Center.x, float.NaN, start.z + cell.Center.z);
            }

            for (int i = 0; i < labels.Count; i++)
            {
                labels[i] = (new Vector3(start.x + labels[i].At.x, float.NaN, start.z + labels[i].At.z), labels[i].Text);
            }

            _generation++;
            VillheimPlugin.Instance.StartCoroutine(Build(cells, new List<Pad>(), forward, labels, _generation));
            Console.instance?.Print($"Villheim: laying out {cells.Count} designs in front of you ({widest:0} by {depth:0} m). " +
                                    "Run 'vh flatten' there first to clear and level the ground.");
            yield break;
        }

        /// <summary>
        /// How much ground the design really takes: blueprints know their own size; a location's game radius is where
        /// it may spawn, not what it covers (DevGarden's fences ran into its neighbours), so its pieces are measured.
        /// </summary>
        private static void Size(Cell cell)
        {
            string saved = PassThreeFile(cell.Design.Name);
            Blueprints.Blueprint edited = saved != null ? Blueprints.FromFile(saved) : null;
            if (edited != null && edited.Pieces.Count > 0)
            {
                cell.Half = Mathf.Clamp(edited.Radius + 1f, 5f, 90f);
                return;
            }

            if (cell.Design.Blueprint != null)
            {
                cell.Half = Mathf.Clamp(cell.Design.Radius + 1f, 5f, 90f);
                return;
            }

            ZoneSystem.ZoneLocation location = cell.Design.Location;
            AssetGuard.Load(location);
            try
            {
                GameObject asset = location.m_prefab.Asset;
                List<DesignSpawner.PlanEntry> plan = asset != null ? DesignSpawner.MakePlan(asset, Vector3.zero, 1, 0f, false) : null;
                if (plan == null || plan.Count == 0)
                {
                    return;
                }

                float minX = plan.Min(e => e.LocalPosition.x), maxX = plan.Max(e => e.LocalPosition.x);
                float minZ = plan.Min(e => e.LocalPosition.z), maxZ = plan.Max(e => e.LocalPosition.z);
                cell.Offset = new Vector3((minX + maxX) / 2f, 0f, (minZ + maxZ) / 2f);
                float radius = plan.Max(e => new Vector2(e.LocalPosition.x - cell.Offset.x, e.LocalPosition.z - cell.Offset.z).magnitude);
                cell.Half = Mathf.Clamp(radius + 3f, 5f, 90f);
            }
            finally
            {
                location.m_prefab.Release();
            }
        }

        private const float FlatWidth = 360f;
        private const float FlatDepth = 260f;

        private static string FlatPath => System.IO.Path.Combine(BepInEx.Paths.BepInExRootPath, "Villheim", "gallery-flat-area.txt");

        /// <summary>Where 'vh flatten' last started (near edge, middle) and which way it ran, kept on disk.</summary>
        private static void SaveFlat(Vector3 start, Vector3 forward)
        {
            Safe("the flat area", () =>
            {
                System.IO.Directory.CreateDirectory(System.IO.Path.GetDirectoryName(FlatPath));
                var c = System.Globalization.CultureInfo.InvariantCulture;
                System.IO.File.WriteAllText(FlatPath, string.Join(" ", new[] { start.x, start.y, start.z, forward.x, forward.z }.Select(v => v.ToString("R", c))));
            });
        }

        /// <summary>The area 'vh flatten' last made (near edge middle and direction), for the slotting board.</summary>
        internal static bool LoadFlatArea(out Vector3 start, out Vector3 forward) => LoadFlat(out start, out forward);

        private static bool LoadFlat(out Vector3 start, out Vector3 forward)
        {
            start = forward = Vector3.zero;
            try
            {
                if (!System.IO.File.Exists(FlatPath))
                {
                    return false;
                }

                var c = System.Globalization.CultureInfo.InvariantCulture;
                float[] v = System.IO.File.ReadAllText(FlatPath).Split(' ').Select(t => float.Parse(t, c)).ToArray();
                start = new Vector3(v[0], v[1], v[2]);
                forward = new Vector3(v[3], 0f, v[4]).normalized;
                return forward.sqrMagnitude > 0.5f;
            }
            catch
            {
                return false;
            }
        }

        /// <summary>The middle height of the loaded ground across a square.</summary>
        private static float MeasuredGround(Vector3 center, float half)
        {
            var heights = new List<float>();
            for (float x = -half; x <= half; x += half / 2f)
            {
                for (float z = -half; z <= half; z += half / 2f)
                {
                    if (ZoneSystem.instance.GetGroundHeight(new Vector3(center.x + x, 0f, center.z + z), out float h))
                    {
                        heights.Add(h);
                    }
                }
            }

            heights.Sort();
            return heights.Count > 0 ? heights[heights.Count / 2] : center.y;
        }

        /// <summary>
        /// 'vh flatten [size]': clears and levels a square in front of the player (200 m by default) at the height of
        /// the ground under his feet, as far as the game's 8 m allows, and takes the grass off. Parts in zones that
        /// aren't loaded are done as he walks to them. Touch it up with a terrain tool, then 'vh gallery'.
        /// </summary>
        public static string Flatten(Player player, string[] args)
        {
            // Big enough for any gallery page (ten designs, six to a row) unless a size is given.
            float width = args.Length > 0 && float.TryParse(args[0], out float given) ? Mathf.Clamp(given, 30f, 600f) : FlatWidth;
            float length = args.Length > 0 ? width : FlatDepth;
            Vector3 forward = player.transform.forward;
            forward.y = 0f;
            forward.Normalize();
            Vector3 right = Vector3.Cross(Vector3.up, forward);
            float height = player.transform.position.y;
            if (ZoneSystem.instance.GetGroundHeight(player.transform.position, out float ground))
            {
                height = ground;
            }

            Vector3 start = player.transform.position + forward * 4f;
            SaveFlat(new Vector3(start.x, height, start.z), forward);
            var pads = new List<Pad>();
            for (float z = 0f; z <= length; z += PadSpacing)
            {
                for (float x = -width / 2f; x <= width / 2f; x += PadSpacing)
                {
                    Vector3 p = start + forward * z + right * x;
                    pads.Add(new Pad { Center = new Vector3(p.x, height, p.z) });
                }
            }

            VillheimPlugin.Instance.StartCoroutine(Build(new List<Cell>(), pads, forward, new List<(Vector3 At, string Text)>(), _generation));
            return $"Villheim: clearing and levelling {width:0} m wide by {length:0} m deep in front of you at {height:0.0} m ({pads.Count} pads). " +
                   "Walk along it so the far parts load; the middle of the screen counts the pads done. 'vh gallery' lays out on this area from anywhere near it.";
        }

        /// <summary>The middle height of the generated ground across a square.</summary>
        private static float GroundOf(Vector3 center, float half)
        {
            var heights = new List<float>();
            for (float x = -half; x <= half; x += 4f)
            {
                for (float z = -half; z <= half; z += 4f)
                {
                    heights.Add(WorldGenerator.instance.GetHeight(center.x + x, center.z + z));
                }
            }

            heights.Sort();
            return heights[heights.Count / 2];
        }

        private sealed class SiteResult
        {
            public bool Found;
            public Vector3 Start;
            public float Height;
            public float Relief = float.MaxValue;
        }

        /// <summary>
        /// The nearest spot (outward from the player, 80 m steps, up to 3 km) where the whole area, with the gallery's own
        /// turn, is land of the biome and its ground varies by no more than 12 m. Read from the world generator, so no
        /// zone has to be loaded. A few spots a frame.
        /// </summary>
        private static IEnumerator FindSite(Vector3 from, Vector3 forward, Vector3 right, float width, float depth, Heightmap.Biome biome, SiteResult result)
        {
            WorldGenerator world = WorldGenerator.instance;
            float water = ZoneSystem.instance.m_waterLevel;
            int tried = 0;
            var heights = new List<float>();
            for (float ring = 0f; ring <= 2000f; ring += 80f)
            {
                int steps = ring < 1f ? 1 : Mathf.CeilToInt(2f * Mathf.PI * ring / 80f);
                for (int k = 0; k < steps; k++)
                {
                    float angle = k * Mathf.PI * 2f / steps;
                    Vector3 start = from + forward * (6f + Margin) + new Vector3(Mathf.Sin(angle), 0f, Mathf.Cos(angle)) * ring;
                    heights.Clear();
                    float low = float.MaxValue, high = float.MinValue;
                    bool ok = true;
                    for (float z = -Margin; z <= depth - Margin && ok; z += 16f)
                    {
                        for (float x = -width / 2f; x <= width / 2f; x += 16f)
                        {
                            Vector3 p = start + forward * z + right * x;
                            float h = world.GetHeight(p.x, p.z);
                            if (h < water + 1.5f || (world.GetBiome(p.x, p.z) & GalleryLand) == 0)
                            {
                                ok = false;
                                break;
                            }

                            low = Mathf.Min(low, h);
                            high = Mathf.Max(high, h);
                            heights.Add(h);
                            if (high - low >= result.Relief)
                            {
                                ok = false; // no flatter than the best so far
                                break;
                            }
                        }
                    }

                    if (ok && heights.Count > 0)
                    {
                        // The flattest so far; good enough to stop looking once it fits within the game's terrain limit.
                        heights.Sort();
                        result.Found = true;
                        result.Start = start;
                        result.Relief = high - low;
                        result.Height = heights[heights.Count / 2];
                        if (result.Relief <= MaxRelief)
                        {
                            yield break;
                        }
                    }

                    if (++tried % 25 == 0)
                    {
                        Progress($"Gallery: looking for flat land, {ring:0} m out (flattest so far: {(result.Found ? result.Relief.ToString("0") + " m" : "none")})");
                        yield return null;
                    }
                }
            }
        }

        private static string CachePath =>
            System.IO.Path.Combine(BepInEx.Paths.BepInExRootPath, "Villheim", "design-list-locations-v4.txt");

        /// <summary>Each location opened before: name|stage|pieces|building pieces|notes. 'rescan' opens them all again.</summary>
        private static Dictionary<string, Sorting> ReadCache()
        {
            var known = new Dictionary<string, Sorting>();
            try
            {
                if (System.IO.File.Exists(CachePath))
                {
                    foreach (string line in System.IO.File.ReadAllLines(CachePath))
                    {
                        string[] parts = line.Split('|');
                        if (!line.StartsWith("#") && parts.Length >= 5 && int.TryParse(parts[1], out int stage) &&
                            int.TryParse(parts[2], out int pieces) && int.TryParse(parts[3], out int building))
                        {
                            known[parts[0]] = new Sorting { Stage = Mathf.Clamp(stage, 0, StageNames.Length - 1), Pieces = pieces, Building = building, Notes = parts[4] };
                        }
                    }
                }
            }
            catch (System.Exception e)
            {
                VillheimPlugin.Log.LogWarning($"Gallery: could not read the location cache: {e.Message}");
            }

            return known;
        }

        private static void WriteCache(Dictionary<string, Sorting> known)
        {
            System.IO.Directory.CreateDirectory(System.IO.Path.GetDirectoryName(CachePath));
            System.IO.File.WriteAllLines(CachePath,
                new[] { "# Locations opened by vh report and vh gallery: name|stage|pieces|building pieces|notes. 'vh report rescan' opens them again." }
                    .Concat(known.OrderBy(k => k.Key).Select(k =>
                        $"{k.Key}|{k.Value.Stage}|{k.Value.Pieces}|{k.Value.Building}|{(k.Value.Notes ?? "").Replace('|', '/')}")));
        }

        private static void Safe(string what, System.Action action)
        {
            try
            {
                action();
            }
            catch (System.Exception e)
            {
                VillheimPlugin.Log.LogWarning($"Gallery: skipped {what}: {e.GetType().Name}: {e.Message}");
            }
        }

        /// <summary>Locations that are never village buildings: dungeons, altars, traders, ships and the like.</summary>
        private static bool Unsuitable(string name)
        {
            string n = name.ToLowerInvariant();
            string[] words =
            {
                "dungeon", "crypt", "cave", "portal", "boss", "altar", "runestone", "vendor", "haldor", "hildir", "bogwitch",
                "starttemple", "eikthyr", "gdking", "bonemass", "dragonqueen", "goblinking", "seeker", "fader", "ship",
                "wreck", "grave", "tomb", "infested", "mine", "tarpit", "leviathan", "vegvisir", "spawner",
            };
            return words.Any(w => n.Contains(w));
        }

        /// <summary>A kind from the name: hall, workshop, storehouse or farm words, else a home.</summary>
        private static Role RoleFromName(string name)
        {
            string n = name.ToLowerInvariant();
            if (n.Contains("tavern") || n.Contains("hall") || n.Contains("longhouse") || n.Contains("great")) return Role.Hub;
            if (n.Contains("forge") || n.Contains("smith") || n.Contains("sawmill") || n.Contains("mill") || n.Contains("workshop") ||
                n.Contains("tannery") || n.Contains("camp") || n.Contains("tower") || n.Contains("lumber")) return Role.Workshop;
            if (n.Contains("storage") || n.Contains("shed") || n.Contains("store") || n.Contains("warehouse")) return Role.Storage;
            if (n.Contains("farm") || n.Contains("barn") || n.Contains("stable") || n.Contains("field") || n.Contains("breeder")) return Role.Farm;
            return Role.House;
        }

        /// <summary>
        /// Lays the designs out in clusters, one per level and kind (all level 1 homes together, then level 1 halls and so
        /// on), each cluster starting a new row behind a label sign. Positions are relative to the area's near middle;
        /// the caller moves them onto the site.
        /// </summary>
        private static void Layout(List<Cell> cells, Vector3 forward, List<(Vector3 At, string Text)> labels, out float depth, out float widest)
        {

            Vector3 right = Vector3.Cross(Vector3.up, forward);
            depth = 0f;
            widest = 0f;
            if (cells.Any(c => c.Flow))
            {
                // In list order (similar sizes next to each other), each row as full as the flattened area allows.
                const float MaxRow = FlatWidth - 20f;
                int i = 0;
                while (i < cells.Count)
                {
                    var line = new List<Cell> { cells[i++] };
                    float used = line[0].Half * 2f;
                    while (i < cells.Count && used + Gap + cells[i].Half * 2f <= MaxRow)
                    {
                        used += Gap + cells[i].Half * 2f;
                        line.Add(cells[i++]);
                    }

                    float rowDepth = line.Max(c => c.Half);
                    widest = Mathf.Max(widest, used);
                    float x = -used / 2f;
                    foreach (Cell cell in line)
                    {
                        cell.Center = forward * (depth + rowDepth) + right * (x + cell.Half);
                        x += cell.Half * 2f + Gap;
                    }

                    depth += rowDepth * 2f + Aisle;
                }

                return;
            }

            foreach (IGrouping<Role, Cell> cluster in cells.GroupBy(c => c.Role))
            {
                List<Cell> members = cluster.ToList();
                labels.Add((forward * (depth + 2f), $"<#5cf>{Plural(members[0].Role)}"));
                depth += 6f;
                for (int row = 0; row * 6 < members.Count; row++)
                {
                    List<Cell> line = members.Skip(row * 6).Take(6).ToList();
                    float rowDepth = line.Max(c => c.Half);
                    float width = line.Sum(c => c.Half * 2f) + Gap * (line.Count - 1);
                    widest = Mathf.Max(widest, width);
                    float x = -width / 2f;
                    foreach (Cell cell in line)
                    {
                        cell.Center = forward * (depth + rowDepth) + right * (x + cell.Half);
                        x += cell.Half * 2f + Gap;
                    }

                    depth += rowDepth * 2f + Gap;
                }

                depth += 8f;
            }
        }

        private static string Plural(Role role)
        {
            switch (role)
            {
                case Role.House: return "Homes";
                case Role.Hub: return "Halls";
                case Role.Workshop: return "Workshops";
                case Role.Storage: return "Storehouses";
                default: return "Farms";
            }
        }

        private static IEnumerator Build(List<Cell> cells, List<Pad> pads, Vector3 forward, List<(Vector3 At, string Text)> labels, int generation)
        {
            float until = Time.time + 40f * 60f;
            int built = 0;
            while ((built < cells.Count || pads.Any(p => !p.Done) || labels.Count > 0) && Time.time < until)
            {
                if (generation != _generation)
                {
                    yield break; // cleared, or a new page started
                }

                // Ground first: every pad whose zone is loaded is cleared, levelled and bared.
                bool shaped = false;
                foreach (Pad pad in pads.Where(p => !p.Done))
                {
                    if (!Loaded(pad.Center, PadRadius + 6f))
                    {
                        continue;
                    }

                    pad.Done = true;
                    shaped = true;
                    Pad current = pad;
                    Safe("clearing ground", () => ClearAll(current.Center, PadRadius + 2f));
                    Safe("levelling ground", () => TerrainShaper.LevelPad(current.Center, PadRadius, PadRadius + 8f));
                    Safe("clearing grass", () => HearthGround.ClearVegetation(current.Center, PadRadius + 2f));
                    yield return null;
                }

                if (shaped)
                {
                    Progress($"Flatten: {pads.Count(p => p.Done)} of {pads.Count} pads levelled");
                    yield return new WaitForSeconds(1f); // let the ground's collider catch up
                }

                // Cluster labels, each once its spot is loaded and its ground done.
                // By index: a label's height is NaN until it is put down, and NaN never equals itself, so removing
                // it by value failed and the same sign went up again every two seconds for 40 minutes (2026-11-07).
                for (int i = labels.Count - 1; i >= 0; i--)
                {
                    (Vector3 at, string text) = labels[i];
                    if (!Loaded(at, 4f) || pads.Any(p => !p.Done && Utils.DistanceXZ(p.Center, at) < PadRadius + 6f))
                    {
                        continue;
                    }

                    labels.RemoveAt(i);
                    Vector3 spot = at;
                    if (float.IsNaN(spot.y))
                    {
                        spot.y = ZoneSystem.instance.GetGroundHeight(new Vector3(spot.x, 0f, spot.z), out float h) ? h : 0f;
                    }

                    Safe("a label", () => PutSign(spot, forward, text));
                }

                // Then each plot whose ground is all done.
                foreach (Cell cell in cells.Where(c => !c.Done))
                {
                    float reach = cell.Half * 1.42f + PadRadius;
                    if (pads.Any(p => !p.Done && Utils.DistanceXZ(p.Center, cell.Center) < reach))
                    {
                        continue;
                    }

                    if (float.IsNaN(cell.Center.y))
                    {
                        if (!Loaded(cell.Center, cell.Half * 1.42f))
                        {
                            continue;
                        }

                        cell.Center.y = MeasuredGround(cell.Center, cell.Half);
                    }

                    cell.Done = true;
                    int pieces = 0;
                    Cell building = cell;
                    if (cell.Terrace)
                    {
                        Safe("a terrace", () =>
                        {
                            HearthGround.ClearAround(building.Center, building.Half * 1.42f + 2f);
                            TerrainShaper.LevelPad(building.Center, building.Half * 1.42f, building.Half * 1.42f + 6f);
                            HearthGround.ClearVegetation(building.Center, building.Half * 1.42f + 2f);
                        });
                        yield return new WaitForSeconds(1f);
                    }

                    Safe(cell.Design.Name, () => pieces = Put(building, forward));
                    building.Placed = pieces;
                    Safe("a sign", () => Sign(building, forward));
                    built++;
                    VillheimPlugin.Log.LogInfo($"Gallery: {cell.Design.Name} ({Label(cell)}, level {Level(cell)}): {pieces} pieces.");
                    Progress($"Gallery: {built} of {cells.Count} designs up");
                    yield return null;
                }

                yield return new WaitForSeconds(2f);
            }

            VillheimPlugin.Log.LogInfo($"Gallery: {built} of {cells.Count} designs built.");
            if (generation == _generation && built > 0)
            {
                MessageHud.instance?.ShowMessage(MessageHud.MessageType.Center, $"Gallery: page ready ({built} designs)");
                if (cells.Any(c => c.AsStage >= 0))
                {
                    List<string> misses = null;
                    Safe("the swap misses", () => misses = MaterialSwap.WriteMisses());
                    if (misses != null && misses.Count > 0)
                    {
                        Console.instance?.Print("Villheim: pieces that could not be swapped are listed in " + string.Join(", ", misses));
                    }
                }
            }
        }

        /// <summary>
        /// Takes away everything standing in the circle, at any height: trees, logs, stumps, rocks, bushes, ruins and
        /// loose objects. Creatures, graves, village hearths, location markers and the gallery's own pieces stay.
        /// </summary>
        private static void ClearAll(Vector3 center, float radius)
        {
            var doomed = new List<ZNetView>();
            foreach (ZNetView view in ZNetScene.instance.m_instances.Values)
            {
                if (view == null || !view.IsValid() || Utils.DistanceXZ(view.transform.position, center) > radius)
                {
                    continue;
                }

                GameObject go = view.gameObject;
                // Terrain objects stay: a terrain tool's edits (PlanBuild's flattening) can be held by them, and taking them
                // away put the ground back to its old hills (2026-11-06).
                if (go.GetComponentInChildren<TerrainModifier>() || go.GetComponentInChildren<TerrainOp>() || go.GetComponent<TerrainComp>() ||
                    go.GetComponent<Character>() || go.GetComponent<TombStone>() || go.GetComponent<VillageHearth>() ||
                    go.GetComponent<LocationProxy>() || view.GetZDO().GetInt(KeyGallery) == 1 ||
                    (go.GetComponent<Piece>() is Piece piece && piece.GetCreator() != 0L))
                {
                    continue;
                }

                doomed.Add(view);
            }

            foreach (ZNetView view in doomed)
            {
                view.ClaimOwnership();
                ZNetScene.instance.Destroy(view.gameObject);
            }
        }

        private static bool Loaded(Vector3 center, float reach)
        {
            for (int i = 0; i < 4; i++)
            {
                Vector3 corner = center + Quaternion.Euler(0f, 45f + 90f * i, 0f) * Vector3.forward * reach;
                if (!ZoneSystem.instance.IsZoneLoaded(corner))
                {
                    return false;
                }
            }

            return true;
        }

        /// <summary>The design's pieces, its foundation on the ground (see ConstructionSite.FloorOf), facing the sign.</summary>
        private static int Put(Cell cell, Vector3 forward)
        {
            float yaw = Quaternion.LookRotation(-forward).eulerAngles.y;
            List<DesignSpawner.PlanEntry> plan;
            // A design saved after editing in the gallery ('vh bp save') goes up as saved: what was kept, swapped and added.
            string saved = PassThreeFile(cell.Design.Name);
            Blueprints.Blueprint edited = saved != null ? Blueprints.FromFile(saved) : null;
            if (edited != null && edited.Pieces.Count > 0)
            {
                cell.Edited = true;
                cell.GroundOffset = edited.GroundOffset;
                plan = Swapped(Blueprints.Entries(edited), cell);
                return Spawn(plan, cell, yaw);
            }

            if (cell.Design.Blueprint != null)
            {
                plan = Swapped(Blueprints.Entries(cell.Design.Blueprint), cell);
                return Spawn(plan, cell, yaw);
            }

            ZoneSystem.ZoneLocation location = cell.Design.Location;
            Designs.AssetGuard.Load(location);
            try
            {
                GameObject asset = location.m_prefab.Asset;
                if (asset == null)
                {
                    return 0;
                }

                plan = Swapped(DesignSpawner.MakePlan(asset, cell.Center, cell.Design.Name.GetStableHashCode(), yaw, false), cell);
                return Spawn(plan, cell, yaw);
            }
            finally
            {
                location.m_prefab.Release();
            }
        }

        /// <summary>
        /// Shaper Tool Reset: takes down a design standing in the gallery (its pieces, stand-ins swapped in and anything
        /// built on its plot) and puts it up again on the same plot as the gallery would: from its pass 3 save if it has
        /// one, else as its creator built it. Its nudge and swap choices are forgotten. Undo puts the edited one back.
        /// </summary>
        internal static string ResetDesign(string name)
        {
            (ZDO sign, List<ZNetView> views) = SwapTool.DesignParts(name);
            if (sign == null)
            {
                return $"Reset: the sign of {name} is not loaded; stand nearer.";
            }

            DesignLibrary.Design? design = DesignLibrary.ByName(name) ?? DesignLibrary.ByName(Blueprints.Prefix + name);
            if (design == null)
            {
                return $"Reset: no design called {name}.";
            }

            Vector3 center = sign.GetVec3(KeyPlotCenter, Vector3.zero);
            float half = sign.GetFloat(KeyPlotHalf, 0f);
            float yaw = sign.GetFloat(KeyPlotYaw, 0f);
            Vector3 nudgeBefore = sign.GetVec3(KeyNudge, Vector3.zero);
            float offsetBefore = sign.GetFloat(KeyGroundOffset, 0f);
            int touchedBefore = sign.GetInt(KeyTouched);
            int placedBefore = sign.GetInt(KeyPlaced);

            List<EditHistory.Snapshot> snapshots = views.Select(EditHistory.Take).ToList();
            foreach (ZNetView view in views)
            {
                view.ClaimOwnership();
                ZNetScene.instance.Destroy(view.gameObject);
            }

            var cell = new Cell { Design = design.Value, Center = center, Number = sign.GetInt(KeyNumber) };
            Size(cell);
            cell.Half = half;
            Vector3 forward = -(Quaternion.Euler(0f, yaw, 0f) * Vector3.forward);
            int made = Put(cell, forward);
            sign.Set(KeyNudge, Vector3.zero);
            sign.Set(KeyGroundOffset, cell.GroundOffset);
            sign.Set(KeyTouched, 0);
            sign.Set(KeyPlaced, made);
            SwapTool.ForgetChoices(name);

            List<ZNetView> fresh = SwapTool.DesignParts(name).Views;
            EditHistory.Push($"resetting {name}", () =>
            {
                foreach (ZNetView view in fresh)
                {
                    if (view != null && view.IsValid())
                    {
                        view.ClaimOwnership();
                        ZNetScene.instance.Destroy(view.gameObject);
                    }
                }

                snapshots.ForEach(EditHistory.Restore);
                sign.Set(KeyNudge, nudgeBefore);
                sign.Set(KeyGroundOffset, offsetBefore);
                sign.Set(KeyTouched, touchedBefore);
                sign.Set(KeyPlaced, placedBefore);
            });
            return $"Reset {name}: {views.Count} pieces taken down, {made} put up " +
                   (cell.Edited ? "from its pass 3 save ('vh bp forget' first for the creator's original)." : "as its creator built it.") +
                   " 8 (Undo) puts your edits back.";
        }

        /// <summary>The plan in the materials the page asked for ('as meadows'), or as it is.</summary>
        private static List<DesignSpawner.PlanEntry> Swapped(List<DesignSpawner.PlanEntry> plan, Cell cell)
        {
            if (cell.AsStage < 0)
            {
                return plan;
            }

            var result = new MaterialSwap.Result();
            List<DesignSpawner.PlanEntry> swapped = MaterialSwap.Apply(plan, cell.AsStage, result);
            cell.SwapNote = $"as {StageNames[cell.AsStage]}: {result.Swapped} swapped" + (result.Near > 0 ? $" ({result.Near} near)" : "") +
                            (result.Kept > 0 ? $", {result.Kept} kept" : "");
            VillheimPlugin.Log.LogInfo($"Gallery: {cell.Design.Name} as {StageNames[cell.AsStage]}: {result.Summary(cell.AsStage)}.");
            return swapped;
        }

        /// <summary>The stage of one piece (0 for anything unknown).</summary>
        internal static int StageOfPiece(string prefab)
        {
            PieceInfo info = Info(prefab);
            return info.Buildable ? info.Stage : 0;
        }

        /// <summary>A building piece (wall, floor, roof, beam, door, window) a player can build.</summary>
        internal static bool IsBuildingPiece(string prefab)
        {
            PieceInfo info = Info(prefab);
            return info.Known && info.Buildable && info.Building;
        }

        internal static int StageIndexOf(string word) => StageIndex(word);

        /// <summary>A piece a player can build (it has a recipe).</summary>
        internal static bool IsBuildable(string prefab) => Info(prefab).Buildable;

        /// <summary>A building piece a player can build, with materials of known stages: a candidate for material swaps.</summary>
        internal static bool IsSwappable(string prefab)
        {
            PieceInfo info = Info(prefab);
            return info.Known && info.Buildable && info.Building && info.OtherMaterial == null;
        }

        private static int Spawn(List<DesignSpawner.PlanEntry> plan, Cell cell, float yaw)
        {
            float planned = ConstructionSite.FloorOf(plan);
            Quaternion turn = Quaternion.Euler(0f, yaw, 0f);
            Vector3 origin = cell.Center - turn * cell.Offset - Vector3.up * planned;
            var made = new List<GameObject>();
            var standIns = new List<(ZDO Zdo, Vector3 Center)>();
            foreach (DesignSpawner.PlanEntry entry in plan)
            {
                GameObject piece = DesignSpawner.SpawnEntry(entry, origin, turn, 0, false);
                if (piece != null)
                {
                    ZDO zdo = piece.GetComponent<ZNetView>()?.GetZDO();
                    zdo?.Set(KeyGallery, 1);
                    zdo?.Set(KeyDesign, cell.Design.Name);
                    if (zdo != null && entry.SwappedFrom != null)
                    {
                        // 'vh swap' needs to know what a stand-in stands in for, and how the original was turned.
                        zdo.Set(KeySwappedFrom, entry.SwappedFrom);
                        zdo.Set(KeySwappedRotation, turn * entry.OriginalRotation);
                        standIns.Add((zdo, origin + turn * entry.OriginalCenter));
                    }

                    made.Add(piece);
                }
            }

            // Measured, not trusted: the foundation as the pieces actually stand (their colliders), and the whole design
            // moved up or down so that foundation sits on the ground. Logged, to see where the plan's own measure is off.
            Physics.SyncTransforms();
            var bottoms = new List<float>();
            foreach (GameObject piece in made)
            {
                if (piece.GetComponent<Piece>() == null || !piece.GetComponent<WearNTear>())
                {
                    continue;
                }

                float bottom = float.MaxValue;
                foreach (Collider collider in piece.GetComponentsInChildren<Collider>())
                {
                    if (collider != null && !collider.isTrigger && collider.enabled)
                    {
                        bottom = Mathf.Min(bottom, collider.bounds.min.y);
                    }
                }

                if (bottom < float.MaxValue)
                {
                    bottoms.Add(bottom);
                }
            }

            if (bottoms.Count > 0)
            {
                float actual = ConstructionSite.FoundationHeight(bottoms);
                float shift = cell.Center.y - actual + cell.GroundOffset;
                VillheimPlugin.Log.LogInfo($"Gallery: {cell.Design.Name}: planned floor {planned:+0.00;-0.00}, measured foundation " +
                                           $"{actual - origin.y:+0.00;-0.00} above the origin, lowest piece {bottoms.Min() - origin.y:+0.00;-0.00}; moved {shift:+0.00;-0.00} m.");
                if (Mathf.Abs(shift) > 0.05f)
                {
                    foreach (GameObject piece in made)
                    {
                        piece.transform.position += Vector3.up * shift;
                        piece.GetComponent<ZNetView>()?.GetZDO()?.SetPosition(piece.transform.position);
                    }

                    for (int i = 0; i < standIns.Count; i++)
                    {
                        standIns[i] = (standIns[i].Zdo, standIns[i].Center + Vector3.up * shift);
                    }
                }
            }

            foreach ((ZDO zdo, Vector3 center) in standIns)
            {
                zdo.Set(KeySwappedCenter, center);
            }

            return made.Count;
        }

        /// <summary>A sign at the front of the plot: the kind and level in blue, the design's name in white.</summary>
        private static void Sign(Cell cell, Vector3 forward)
        {
            Vector3 at = cell.Center - forward * (cell.Half - 1f);
            // The first line is the design's sort from the sort knives (Unsorted until then), never a guessed kind.
            string text = $"{DesignSort.SignHead(cell.Design.Name, StageNames[cell.Stage])}<br><#fff>{cell.Design.Name}<br><#bbb>{(cell.Number > 0 ? $"No. {cell.Number}, " : "")}by {Creator(cell.Design)}" +
                          (cell.SwapNote != null ? $"<br><#fc6>{cell.SwapNote}" : "") +
                          (cell.Edited ? "<br><#8f8>edited (pass 3 save)" : "");
            if (cell.Number <= 0)
            {
                PutSign(at, forward, text);
                return;
            }

            // The front sign carries the text; a second one just behind it, its board hidden, carries the number big
            // above both (LogicConfig.GalleryNumberText, so its size can be tuned while the game runs).
            ZDO front = OneSign(at, forward, 0f, text)?.GetComponent<ZNetView>()?.GetZDO();
            if (front != null)
            {
                front.Set(KeyDesign, cell.Design.Name);
                front.Set(KeyPlotCenter, cell.Center);
                front.Set(KeyPlotHalf, cell.Half);
                front.Set(KeyPlotYaw, Quaternion.LookRotation(-forward).eulerAngles.y);
                front.Set(KeyNumber, cell.Number);
                front.Set(KeyPlaced, cell.Placed);
                front.Set(KeyGroundOffset, cell.GroundOffset);
            }
            string number;
            try
            {
                number = string.Format(LogicConfig.GalleryNumberText?.Value ?? "{0}", DesignSort.NumberText(cell.Design.Name, cell.Number));
            }
            catch (System.FormatException)
            {
                number = DesignSort.NumberText(cell.Design.Name, cell.Number);
            }

            OneSign(at + forward * 0.08f, forward, 0f, number);
        }

        /// <summary>A sign standing on the ground (two back to back, so it reads from either side).</summary>
        private static void PutSign(Vector3 at, Vector3 forward, string text)
        {
            GameObject prefab = ZNetScene.instance.GetPrefab("sign");
            if (prefab == null)
            {
                return;
            }

            foreach (float turn in new[] { 0f, 180f })
            {
                OneSign(at, forward, turn, text);
            }
        }

        internal static GameObject OneSign(Vector3 at, Vector3 forward, float turn, string text)
        {
            GameObject prefab = ZNetScene.instance.GetPrefab("sign");
            if (prefab == null)
            {
                return null;
            }

            Quaternion rotation = Quaternion.LookRotation(-forward) * Quaternion.Euler(0f, turn, 0f);
            GameObject sign = Object.Instantiate(prefab, at + rotation * Vector3.forward * 0.03f, rotation);
            StandOnGround(sign, at.y);
            ZNetView view = sign.GetComponent<ZNetView>();
            if (view != null && view.IsValid())
            {
                view.GetZDO().Set(KeyGallery, 1);
                view.GetZDO().Set(ZDOVars.s_text, text);
                sign.GetComponent<Sign>()?.UpdateText();
            }

            return sign;
        }

        private static void StandOnGround(GameObject go, float ground)
        {
            Bounds? bounds = null;
            foreach (Renderer renderer in go.GetComponentsInChildren<Renderer>())
            {
                if (bounds.HasValue)
                {
                    Bounds b = bounds.Value;
                    b.Encapsulate(renderer.bounds);
                    bounds = b;
                }
                else
                {
                    bounds = renderer.bounds;
                }
            }

            if (bounds.HasValue)
            {
                go.transform.position += Vector3.up * (ground - bounds.Value.min.y);
                go.GetComponent<ZNetView>()?.GetZDO()?.SetPosition(go.transform.position);
            }
        }

        /// <summary>The village level a design is meant for: homes from the start, the longhouse, workshop and storehouse next, farms after.</summary>
        private static int Level(Cell cell)
        {
            if (cell.Design.Blueprint != null)
            {
                return cell.Design.Blueprint.Level;
            }

            switch (cell.Role)
            {
                case Role.House: return cell.Design.Radius >= 16f ? 3 : cell.Design.Radius >= 11f ? 2 : 1;
                case Role.Farm: return 3;
                default: return 2;
            }
        }

        /// <summary>What kind of building it reads as, from its name, else its role.</summary>
        private static string Label(Cell cell)
        {
            string name = cell.Design.Name.ToLowerInvariant();
            if (name.Contains("sawmill")) return "Sawmill";
            if (name.Contains("forge") || name.Contains("smith")) return "Smithy";
            if (name.Contains("tavern") || name.Contains("hall")) return "Longhouse";
            if (name.Contains("barn")) return "Barn";
            if (name.Contains("farm")) return "Farm";
            if (name.Contains("camp")) return "Camp";
            if (name.Contains("tower")) return "Tower";
            if (name.Contains("maypole")) return "Maypole hut";
            string role = VillageBrain.RoleName(cell.Role);
            return char.ToUpperInvariant(role[0]) + role.Substring(1);
        }
    }
}
