using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using HarmonyLib;
using UnityEngine;
using UnityEngine.Networking;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Sorting the kept designs in the game, one sort knife per phase (vanilla knives, renamed and glowing in their own
    /// colour; config SortToolA, SortToolB and SortToolB2; 'vh sort tools' gives all three).
    ///
    /// Phase A (flint knife): every design gets one type. Hotbar 1 Home, 2 Work, 3 Community, 4 Drop, 7 Clear, 8 Undo.
    /// Phase B (copper knife): work and community designs get a subtype. The hotbar follows the type of the design under
    ///   the crosshair: work 1 Farming, 2 Woodworking, 3 Mining, 4 Cooking, 5 Crafting, 6 Storage, 7 Defence;
    ///   community 1 Hearth, 2 Tavern, 3 Longhouse, 4 Decor (village decor: pieces that only make the village look
    ///   lived in, such as a water wheel, an outhouse or a garden), 7 Clear. 8 Undo in both.
    ///
    /// Phase B2 (chitin knife): Work designs sorted as Crafting get a finer trade. 1 Harbour (docks, boathouses,
    ///   shipyards, fishing), 2 Masonry (stonecutter, quarry), 3 Weaving (spinning, looms, tailoring), 4 Hunting
    ///   (hunters, fletchers, tanners), 5 Arcane (galdr table, eitr, wizard towers, herbs), 6 Workshop (general crafting
    ///   that fits none of these), 7 Clear (back to Crafting), 8 Undo.
    ///
    /// A key picks a choice (the same key again puts it down); left click on any piece or the sign of a design, up to
    /// 80 m away, gives it that choice. The design's sign and floating number change colour at once. Every choice is
    /// kept in BepInEx/Villheim/design-sort.csv and sent to the review sheet when SortSheetUrl is set (the sheet script's
    /// web app). 'vh gallery keepers type work' (or home, community, drop, unsorted) shows only those designs.
    /// </summary>
    internal static class DesignSort
    {
        internal sealed class Entry
        {
            public int Number;
            public string Name = "";
            public string Type = "";
            public string Subtype = "";
            public string Biome = "";
            public string BaseId = "";
            public string Stage = "";
            public string Changed = "";

            public Entry Copy() => (Entry)MemberwiseClone();
        }

        public static readonly string[] Types = { "Home", "Work", "Community", "Drop" };
        public static readonly string[] WorkSubtypes = { "Farming", "Woodworking", "Mining", "Cooking", "Crafting", "Storage", "Defence" };
        public static readonly string[] CommunitySubtypes = { "Hearth", "Tavern", "Longhouse", "Decor" };
        public static readonly string[] CraftingSubtypes = { "Harbour", "Masonry", "Weaving", "Hunting", "Arcane", "Workshop" };
        private static readonly string[] LabelsB2 = { "Harbour", "Masonry", "Weaving", "Hunting", "Arcane", "Workshop", "Clear", "Undo" };
        private static readonly string[] IconsB2 =
            { "FishingRod", "piece_stonecutter", "piece_spinningwheel", "Bow", "piece_magetable", "piece_artisanstation", "Hoe", "Feathers" };

        private static readonly string[] LabelsA = { "Home", "Work", "Community", "Drop", "", "", "Clear", "Undo" };
        private static readonly string[] LabelsWork = { "Farming", "Woodwork", "Mining", "Cooking", "Crafting", "Storage", "Defence", "Undo" };
        private static readonly string[] LabelsCommunity = { "Hearth", "Tavern", "Longhouse", "Decor", "", "", "Clear", "Undo" };
        private static readonly string[] IconsA = { "bed", "Hammer", "fire_pit", "BombBile", "", "", "Hoe", "Feathers" };
        private static readonly string[] IconsWork =
            { "Cultivator", "AxeBronze", "PickaxeAntler", "piece_cauldron", "piece_workbench", "piece_chest_wood", "ShieldWood", "Feathers" };
        private static readonly string[] IconsCommunity = { "hearth", "MeadHealthMinor", "piece_table", "Dandelion", "", "", "Hoe", "Feathers" };

        private const int KeyClear = 7, KeyUndo = 8;
        private const float Reach = 80f;

        private enum Phase { None, A, B, B2 }

        private static Phase _phase;
        private static int _key;
        private static string _aimed = "";
        private static float _nextAim;
        private static GameObject _glowItem;
        private static float _nextGroundGlow;
        private static float _lastAttackCall = -1f;
        private static readonly List<(string Name, Entry Before, TakenDown Gone)> History = new List<(string, Entry, TakenDown)>();

        public static bool Active => _phase != Phase.None;

        // ---------------------------------------------------------------- the data

        private static Dictionary<string, Entry> _entries;

        private static string FilePath => Path.Combine(BepInEx.Paths.BepInExRootPath, "Villheim", "design-sort.csv");

        private static Dictionary<string, Entry> Entries
        {
            get
            {
                if (_entries == null)
                {
                    _entries = new Dictionary<string, Entry>();
                    try
                    {
                        if (File.Exists(FilePath))
                        {
                            foreach (string line in File.ReadAllLines(FilePath).Skip(1))
                            {
                                List<string> f = SplitCsv(line);
                                if (f.Count < 8 || f[1].Length == 0)
                                {
                                    continue;
                                }

                                int.TryParse(f[0], out int number);
                                _entries[f[1]] = new Entry
                                {
                                    Number = number, Name = f[1], Type = f[2], Subtype = f[3], Biome = f[4], BaseId = f[5], Stage = f[6], Changed = f[7],
                                };
                            }
                        }
                    }
                    catch (System.Exception e)
                    {
                        VillheimPlugin.Log.LogWarning($"Design sort: could not read {FilePath}: {e.Message}");
                    }
                }

                return _entries;
            }
        }

        private static void Write()
        {
            var lines = new List<string> { "Number,Name,Type,Subtype,Biome,Base ID,s,Changed" };
            foreach (Entry e in Entries.Values.OrderBy(v => v.Number))
            {
                lines.Add(string.Join(",", new[] { e.Number.ToString(), e.Name, e.Type, e.Subtype, e.Biome, e.BaseId, e.Stage, e.Changed }.Select(Csv)));
            }

            Directory.CreateDirectory(Path.GetDirectoryName(FilePath));
            File.WriteAllLines(FilePath, lines);
        }

        public static Entry Get(string design) => design != null && Entries.TryGetValue(design, out Entry e) ? e : null;

        /// <summary>The design's type ("Home", "Work", "Community", "Drop"), or "" if it is not sorted yet.</summary>
        public static string TypeOf(string design) => Get(design)?.Type ?? "";

        /// <summary>For 'vh gallery ... type X': whether the design matches (X is a type, "unsorted", or a subtype).</summary>
        public static bool Matches(string design, string filter)
        {
            Entry e = Get(design);
            if (filter == "any")
            {
                return true;
            }

            if (filter == "unsorted")
            {
                return e == null || e.Type.Length == 0;
            }

            if (filter == "nosubtype")
            {
                return e != null && (e.Type == "Work" || e.Type == "Community") && e.Subtype.Length == 0;
            }

            return e != null && (e.Type.ToLowerInvariant() == filter || e.Subtype.ToLowerInvariant().StartsWith(filter));
        }

        public static string TypeWord(string word)
        {
            word = word.ToLowerInvariant();
            if (word.StartsWith("unsort")) return "unsorted";
            if (word == "any" || word == "everything") return "any";
            if (word.StartsWith("nosub")) return "nosubtype";
            foreach (string t in Types.Concat(WorkSubtypes).Concat(CommunitySubtypes).Concat(CraftingSubtypes))
            {
                if (t.ToLowerInvariant().StartsWith(word) && word.Length >= 3)
                {
                    return t.ToLowerInvariant();
                }
            }

            return null;
        }

        // ---------------------------------------------------------------- colours and the sign

        public static string Colour(string type)
        {
            switch (type)
            {
                case "Home": return "#7e7";
                case "Work": return "#c8f";
                case "Community": return "#5df";
                case "Drop": return "#f66";
                default: return "#aaa";
            }
        }

        /// <summary>The first line of a gallery sign: the design's sort (or "Unsorted") and the stage it is built as.</summary>
        public static string SignHead(string design, string builtAs)
        {
            Entry e = Get(design);
            string type = e?.Type ?? "";
            string what = type.Length == 0 ? "Unsorted" : e.Subtype.Length > 0 ? $"{type}: {e.Subtype}" : type;
            return $"<{Colour(type)}>{what}<#5cf>, built as {builtAs}";
        }

        /// <summary>The design number, coloured by its type, for the number sign's format.</summary>
        public static string NumberText(string design, int number) => $"<{Colour(TypeOf(design))}>{number}";

        private const string BuiltAs = ", built as ";

        /// <summary>Rewrites a standing design's sign head and number in the new colours.</summary>
        private static void RefreshSign(string design)
        {
            if (ZNetScene.instance == null)
            {
                return;
            }

            ZNetView front = null;
            foreach (ZNetView view in ZNetScene.instance.m_instances.Values)
            {
                ZDO zdo = view != null && view.IsValid() ? view.GetZDO() : null;
                if (zdo != null && zdo.GetString(Gallery.KeyDesign, "") == design && zdo.GetFloat(Gallery.KeyPlotHalf, 0f) > 0f)
                {
                    front = view;
                    break;
                }
            }

            if (front == null)
            {
                return;
            }

            ZDO sign = front.GetZDO();
            string text = sign.GetString(ZDOVars.s_text, "");
            int br = text.IndexOf("<br>", System.StringComparison.Ordinal);
            string head = br >= 0 ? text.Substring(0, br) : text;
            int at = head.IndexOf(BuiltAs, System.StringComparison.Ordinal);
            string builtAs = at >= 0 ? head.Substring(at + BuiltAs.Length) : "";
            if (at < 0)
            {
                // A sign put up before sorting existed: "<#5cf>Kind, Stage".
                int comma = head.LastIndexOf(", ", System.StringComparison.Ordinal);
                builtAs = comma >= 0 ? head.Substring(comma + 2) : "";
            }

            Own(front);
            sign.Set(ZDOVars.s_text, SignHead(design, builtAs) + (br >= 0 ? text.Substring(br) : ""));
            front.GetComponent<Sign>()?.UpdateText();

            // The number sign stands just behind the front one, carries the gallery mark and no design name.
            int number = sign.GetInt(Gallery.KeyNumber, 0);
            foreach (ZNetView view in ZNetScene.instance.m_instances.Values)
            {
                ZDO zdo = view != null && view.IsValid() ? view.GetZDO() : null;
                if (zdo == null || view == front || zdo.GetInt(Gallery.KeyGallery) != 1 || zdo.GetString(Gallery.KeyDesign, "").Length > 0 ||
                    view.GetComponent<Sign>() == null || Vector3.Distance(view.transform.position, front.transform.position) > 0.5f)
                {
                    continue;
                }

                string format = LogicConfig.GalleryNumberText?.Value ?? "{0}";
                string numberText;
                try
                {
                    numberText = string.Format(format, NumberText(design, number));
                }
                catch (System.FormatException)
                {
                    numberText = NumberText(design, number);
                }

                Own(view);
                zdo.Set(ZDOVars.s_text, numberText);
                view.GetComponent<Sign>()?.UpdateText();
            }
        }

        private static void Own(ZNetView view)
        {
            if (!view.IsOwner())
            {
                view.ClaimOwnership();
            }
        }

        // ---------------------------------------------------------------- sorting

        private static string Now() => System.DateTime.Now.ToString("yyyy-MM-dd HH:mm");

        /// <summary>Sets one field of a design's sort, keeps it, recolours its sign and sends it to the sheet.</summary>
        private static string Apply(string design, int number, System.Action<Entry> change, bool remember = true)
        {
            Entry e = Get(design);
            Entry before = e?.Copy();
            if (e == null)
            {
                e = new Entry { Name = design };
                Entries[design] = e;
            }

            if (number > 0)
            {
                e.Number = number;
            }

            change(e);
            e.Changed = Now();
            Write();
            RefreshSign(design);
            Push(new[] { e });

            // A design that is done for this phase leaves the field, so what is left on the page is what still needs
            // a choice. Undo puts it back.
            TakenDown gone = HideSorted && DoneForPhase(e) ? TakeDown(design) : null;
            if (remember)
            {
                History.Add((design, before, gone));
                if (History.Count > 100)
                {
                    History.RemoveAt(0);
                }
            }

            return Describe(e) + (gone != null ? " (taken off the field; 8 brings it back)" : "");
        }

        private static bool HideSorted => LogicConfig.SortHideSorted?.Value ?? true;

        /// <summary>Phase A is done with a design once it has a type, phase B once a work or community design has a subtype.</summary>
        private static bool DoneForPhase(Entry e) =>
            _phase == Phase.A ? e.Type.Length > 0 :
            _phase == Phase.B ? e.Subtype.Length > 0 :
            _phase == Phase.B2 && CraftingSubtypes.Contains(e.Subtype);

        /// <summary>
        /// For a page put up with no type filter (phase A): leave out the designs that already have a type, unless
        /// SortHideSorted is off. 'type any' shows everything.
        /// </summary>
        public static bool SkipOnPage(string design, string typeFilter) =>
            HideSorted && typeFilter == null && TypeOf(design).Length > 0;

        // ---------------------------------------------------------------- taking a design off the field

        private sealed class TakenDown
        {
            public List<EditHistory.Snapshot> Parts = new List<EditHistory.Snapshot>();
            public EditHistory.Snapshot Front;
            public List<EditHistory.Snapshot> Others = new List<EditHistory.Snapshot>();
            public Vector3 Center, Nudge;
            public float Half, Yaw, GroundOffset;
            public int Number, Placed, Touched;
        }

        /// <summary>Takes a design's pieces, stand-ins, pieces built on its plot and both its signs down, with snapshots for undo.</summary>
        private static TakenDown TakeDown(string design)
        {
            (ZDO sign, List<ZNetView> views) = SwapTool.DesignParts(design);
            if (sign == null)
            {
                return null;
            }

            ZNetView front = ZNetScene.instance.m_instances.Values.FirstOrDefault(v => v != null && v.IsValid() && v.GetZDO() == sign);
            var gone = new TakenDown
            {
                Center = sign.GetVec3(Gallery.KeyPlotCenter, Vector3.zero),
                Half = sign.GetFloat(Gallery.KeyPlotHalf, 0f),
                Yaw = sign.GetFloat(Gallery.KeyPlotYaw, 0f),
                Number = sign.GetInt(Gallery.KeyNumber, 0),
                Placed = sign.GetInt(Gallery.KeyPlaced, 0),
                GroundOffset = sign.GetFloat(Gallery.KeyGroundOffset, 0f),
                Nudge = sign.GetVec3(Gallery.KeyNudge, Vector3.zero),
                Touched = sign.GetInt(Gallery.KeyTouched, 0),
            };

            var doomed = new List<ZNetView>(views);
            if (front != null)
            {
                gone.Front = EditHistory.Take(front);
                doomed.Add(front);
                foreach (ZNetView number in NumberSigns(front))
                {
                    gone.Others.Add(EditHistory.Take(number));
                    doomed.Add(number);
                }
            }

            gone.Parts.AddRange(views.Select(EditHistory.Take));

            // Pieces of a big design beyond the loaded area exist only as ZDOs; they go too.
            try
            {
                List<ZDO> far = Gallery.UnloadedZdos(z => z.GetInt(Gallery.KeyGallery) == 1 && z.GetString(Gallery.KeyDesign, "") == design);
                gone.Parts.AddRange(far.Select(EditHistory.TakeZdo).Where(x => x != null));
                Gallery.DestroyZdos(far);
            }
            catch (System.Exception e)
            {
                VillheimPlugin.Log.LogWarning($"Design sort: pieces of {design} beyond the loaded area were left: {e.Message}");
            }
            foreach (ZNetView view in doomed)
            {
                if (view != null && view.IsValid())
                {
                    view.ClaimOwnership();
                    ZNetScene.instance.Destroy(view.gameObject);
                }
            }

            return gone;
        }

        private static IEnumerable<ZNetView> NumberSigns(ZNetView front) =>
            ZNetScene.instance.m_instances.Values.Where(view =>
            {
                ZDO zdo = view != null && view.IsValid() ? view.GetZDO() : null;
                return zdo != null && view != front && zdo.GetInt(Gallery.KeyGallery) == 1 && zdo.GetString(Gallery.KeyDesign, "").Length == 0 &&
                       view.GetComponent<Sign>() != null && Vector3.Distance(view.transform.position, front.transform.position) <= 0.5f;
            }).ToList();

        private static void PutBack(TakenDown gone)
        {
            gone.Parts.ForEach(EditHistory.Restore);
            gone.Others.ForEach(EditHistory.Restore);
            ZDO sign = gone.Front != null ? EditHistory.RestoreObject(gone.Front)?.GetComponent<ZNetView>()?.GetZDO() : null;
            if (sign == null)
            {
                return;
            }

            sign.Set(Gallery.KeyPlotCenter, gone.Center);
            sign.Set(Gallery.KeyPlotHalf, gone.Half);
            sign.Set(Gallery.KeyPlotYaw, gone.Yaw);
            sign.Set(Gallery.KeyNumber, gone.Number);
            sign.Set(Gallery.KeyPlaced, gone.Placed);
            sign.Set(Gallery.KeyGroundOffset, gone.GroundOffset);
            sign.Set(Gallery.KeyNudge, gone.Nudge);
            sign.Set(Gallery.KeyTouched, gone.Touched);
        }

        private static string Describe(Entry e) =>
            $"No. {e.Number} {e.Name}: {(e.Type.Length == 0 ? "unsorted" : e.Type)}{(e.Subtype.Length > 0 ? ", " + e.Subtype : "")}";

        private static string UndoLast()
        {
            if (History.Count == 0)
            {
                return "Sort: nothing to undo.";
            }

            (string name, Entry before, TakenDown gone) = History[History.Count - 1];
            History.RemoveAt(History.Count - 1);
            Entry restored = before ?? new Entry { Name = name, Number = Get(name)?.Number ?? 0 };
            Entries[name] = restored;
            Write();
            if (gone != null)
            {
                PutBack(gone);
            }

            RefreshSign(name);
            Push(new[] { restored });
            return "Undone: " + Describe(restored);
        }

        // ---------------------------------------------------------------- the knives

        private static string ToolA => LogicConfig.SortToolA?.Value ?? "KnifeFlint";
        private static string ToolB => LogicConfig.SortToolB?.Value ?? "KnifeCopper";
        private static string ToolB2 => LogicConfig.SortToolB2?.Value ?? "KnifeChitin";
        private static readonly Color ColourB2 = new Color(0.35f, 0.95f, 0.45f);
        private const string NameB2 = "Villheim Sort Tool B2: Crafting";
        private static readonly Color ColourA = new Color(1f, 0.72f, 0.2f);
        private static readonly Color ColourB = new Color(0.72f, 0.45f, 1f);
        private const string NameA = "Villheim Sort Tool A: Type";
        private const string NameB = "Villheim Sort Tool B: Subtype";

        private static Phase Held(Player player)
        {
            string right = player.GetRightItem()?.m_dropPrefab?.name;
            string left = player.GetLeftItem()?.m_dropPrefab?.name;
            if (right == ToolA || left == ToolA) return Phase.A;
            if (right == ToolB || left == ToolB) return Phase.B;
            if (right == ToolB2 || left == ToolB2) return Phase.B2;
            return Phase.None;
        }

        /// <summary>'vh sort tools': puts both sort knives in the inventory.</summary>
        private static string GiveTools()
        {
            Player player = Player.m_localPlayer;
            if (player == null || ObjectDB.instance == null)
            {
                return "Sort: no player.";
            }

            var given = new List<string>();
            foreach (string name in new[] { ToolA, ToolB, ToolB2 })
            {
                GameObject prefab = ObjectDB.instance.GetItemPrefab(name);
                if (prefab != null)
                {
                    player.PickupPrefab(prefab, 1, false);
                    given.Add(name);
                }
            }

            return $"Sort: {string.Join(" and ", given)} are in your inventory. The flint knife sorts by type (phase A), the copper knife by subtype (phase B). " +
                   "The chitin knife (B2) splits Crafting into finer trades. Put them on quick slots; with one in hand, a hotbar key picks a choice and left click on a design gives it that choice.";
        }

        private static readonly Dictionary<string, (string Name, string Description)> OldNames = new Dictionary<string, (string, string)>();

        /// <summary>The sort knives carry their own names everywhere (their shared item data is renamed).</summary>
        private static void Identity()
        {
            Rename(ToolA, NameA, "Villheim design review, phase A: hotbar 1 Home, 2 Work, 3 Community, 4 Drop, 7 Clear, 8 Undo; left click a design to sort it.");
            Rename(ToolB2, NameB2, "Villheim design review, phase B2: work designs sorted as Crafting get a trade: 1 Harbour, 2 Masonry, 3 Weaving, 4 Hunting, 5 Arcane, 6 Workshop, 7 Clear, 8 Undo.");
            Rename(ToolB, NameB, "Villheim design review, phase B: the hotbar shows the subtypes for the design under the crosshair (work or community); left click a design to sort it.");
        }

        private static void Rename(string prefab, string name, string description)
        {
            ItemDrop.ItemData.SharedData shared = ObjectDB.instance?.GetItemPrefab(prefab)?.GetComponent<ItemDrop>()?.m_itemData?.m_shared;
            if (shared == null || shared.m_name == name)
            {
                return;
            }

            OldNames[prefab] = (shared.m_name, shared.m_description);
            shared.m_name = name;
            shared.m_description = description;
        }

        private static Color PhaseColour(Phase phase) => phase == Phase.B ? ColourB : phase == Phase.B2 ? ColourB2 : ColourA;

        private static void Glow(Player player)
        {
            VisEquipment vis = player.m_visEquipment;
            GameObject item = _phase != Phase.None && vis != null ? (vis.m_rightItemInstance != null ? vis.m_rightItemInstance : vis.m_leftItemInstance) : null;
            if (item != _glowItem && _glowItem != null)
            {
                ShaperEffects.Clear(_glowItem);
            }

            _glowItem = item;
            if (item != null)
            {
                string effect = LogicConfig.ShaperHandEffect?.Value ?? "Lightning";
                Color colour = PhaseColour(_phase);
                if (!ShaperEffects.Shows(item, ShaperEffects.Signature(effect, colour)))
                {
                    ShaperEffects.Apply(item, effect, colour, ground: false);
                }
            }
        }

        private static void GlowOnGround()
        {
            if (Time.time < _nextGroundGlow)
            {
                return;
            }

            _nextGroundGlow = Time.time + 0.5f;
            string effect = LogicConfig.ShaperGroundEffect?.Value ?? "Beam and Glow";
            foreach (ItemDrop drop in ItemDrop.s_instances)
            {
                string name = drop != null ? Utils.GetPrefabName(drop.gameObject) : null;
                Phase phase = name == ToolA ? Phase.A : name == ToolB ? Phase.B : name == ToolB2 ? Phase.B2 : Phase.None;
                if (phase == Phase.None)
                {
                    continue;
                }

                Color colour = PhaseColour(phase);
                if (!ShaperEffects.Shows(drop.gameObject, ShaperEffects.Signature(effect, colour)))
                {
                    ShaperEffects.Apply(drop.gameObject, effect, colour, ground: true);
                }
            }
        }

        private static bool Typing() =>
            Console.IsVisible() || Menu.IsVisible() || InventoryGui.IsVisible() || Chat.instance != null && Chat.instance.HasFocus() || Minimap.IsOpen();

        [HarmonyPatch(typeof(Player), "Update")]
        internal static class UpdatePatch
        {
            private static void Postfix(Player __instance)
            {
                if (__instance != Player.m_localPlayer)
                {
                    return;
                }

                try
                {
                    Identity();
                    Phase held = Held(__instance);
                    if (held != _phase)
                    {
                        _phase = held;
                        _key = 0;
                        _aimed = "";
                        if (held == Phase.A)
                        {
                            Say("Sort A (type) on: 1 Home, 2 Work, 3 Community, 4 Drop, 7 Clear, 8 Undo. Press a key, then left click designs.");
                        }
                        else if (held == Phase.B2)
                        {
                            Say("Sort B2 (crafting trades) on: 1 Harbour, 2 Masonry, 3 Weaving, 4 Hunting, 5 Arcane, 6 Workshop, 7 Clear, 8 Undo. Press a key, then left click Crafting designs.");
                        }
                        else if (held == Phase.B)
                        {
                            Say("Sort B (subtype) on: the hotbar shows the subtypes for the design you aim at. Press a key, then left click designs.");
                        }
                    }

                    Glow(__instance);
                    GlowOnGround();
                    if (_phase != Phase.None && Time.time >= _nextAim && !Typing())
                    {
                        _nextAim = Time.time + 0.15f;
                        Aim();
                    }
                }
                catch (System.Exception e)
                {
                    VillheimPlugin.Log.LogWarning($"Design sort: {e}");
                }
            }
        }

        /// <summary>The design whose piece or sign is under the crosshair, up to 80 m away, and its number.</summary>
        private static (string Design, int Number) Aimed()
        {
            Transform eye = GameCamera.instance != null ? GameCamera.instance.transform : null;
            if (eye == null)
            {
                return ("", 0);
            }

            RaycastHit[] hits = Physics.RaycastAll(eye.position, eye.forward, Reach, Physics.DefaultRaycastLayers, QueryTriggerInteraction.Ignore);
            foreach (RaycastHit hit in hits.OrderBy(h => h.distance))
            {
                if (hit.collider.GetComponentInParent<Player>() != null)
                {
                    continue;
                }

                if (hit.collider.GetComponentInParent<Heightmap>() != null)
                {
                    break;
                }

                ZDO zdo = hit.collider.GetComponentInParent<ZNetView>()?.GetZDO();
                string design = zdo?.GetString(Gallery.KeyDesign, "") ?? "";
                if (design.Length > 0)
                {
                    return (design, NumberOf(design, zdo));
                }
            }

            return ("", 0);
        }

        private static int NumberOf(string design, ZDO hit)
        {
            int number = hit.GetInt(Gallery.KeyNumber, 0);
            if (number > 0)
            {
                return number;
            }

            ZDO sign = SwapTool.DesignParts(design).Sign;
            number = sign?.GetInt(Gallery.KeyNumber, 0) ?? 0;
            return number > 0 ? number : Get(design)?.Number ?? 0;
        }

        private static void Aim()
        {
            (string design, int number) = Aimed();
            if (design == _aimed)
            {
                return;
            }

            _aimed = design;
            if (design.Length > 0)
            {
                Entry e = Get(design) ?? new Entry { Name = design, Number = number };
                if (e.Number == 0)
                {
                    e.Number = number;
                }

                MessageHud.instance?.ShowMessage(MessageHud.MessageType.TopLeft, Describe(e));
            }
        }

        /// <summary>The hotbar set for phase B: community choices when aiming at a community design, else work.</summary>
        private static bool CommunitySet => TypeOf(_aimed) == "Community";

        private static string[] Labels => _phase == Phase.A ? LabelsA : _phase == Phase.B2 ? LabelsB2 : CommunitySet ? LabelsCommunity : LabelsWork;
        private static string[] IconNames => _phase == Phase.A ? IconsA : _phase == Phase.B2 ? IconsB2 : CommunitySet ? IconsCommunity : IconsWork;

        [HarmonyPatch(typeof(Player), nameof(Player.UseHotbarItem))]
        internal static class HotbarPatch
        {
            private static bool Prefix(Player __instance, int index)
            {
                if (_phase == Phase.None || __instance != Player.m_localPlayer)
                {
                    return true;
                }

                try
                {
                    Select(index);
                }
                catch (System.Exception e)
                {
                    VillheimPlugin.Log.LogWarning($"Design sort: {e}");
                }

                return false;
            }
        }

        private static void Select(int index)
        {
            if (index < 1 || index > 8)
            {
                return;
            }

            if (index == KeyUndo)
            {
                _key = 0;
                Say(UndoLast());
                return;
            }

            if (Labels[index - 1].Length == 0)
            {
                return;
            }

            bool same = index == _key;
            _key = same ? 0 : index;
            Say(same ? "Sort: choice put down; clicks do nothing until you pick one." : $"Sort: {Labels[index - 1]} picked. Left click designs to give them this choice.");
        }

        /// <summary>Left click gives the design under the crosshair the picked choice; the knife never attacks while sorting.</summary>
        [HarmonyPatch(typeof(Humanoid), nameof(Humanoid.StartAttack))]
        internal static class AttackPatch
        {
            private static bool Prefix(Humanoid __instance, bool secondaryAttack, ref bool __result)
            {
                if (_phase == Phase.None || __instance != Player.m_localPlayer)
                {
                    return true;
                }

                __result = true;
                bool fresh = Time.time - _lastAttackCall > 0.15f;
                _lastAttackCall = Time.time;
                if (!secondaryAttack && fresh)
                {
                    try
                    {
                        Click();
                    }
                    catch (System.Exception e)
                    {
                        VillheimPlugin.Log.LogWarning($"Design sort: {e}");
                    }
                }

                return false;
            }
        }

        private static void Click()
        {
            (string design, int number) = Aimed();
            _aimed = design;
            if (design.Length == 0)
            {
                Say("Sort: aim at a piece or the sign of a gallery design.");
                return;
            }

            if (_key == 0)
            {
                Say("Sort: pick a choice with a hotbar key first.");
                return;
            }

            string choice = Labels[_key - 1];
            if (_phase == Phase.A)
            {
                Say(_key == KeyClear
                    ? Apply(design, number, e => { e.Type = ""; e.Subtype = ""; })
                    : Apply(design, number, e =>
                    {
                        if (e.Type != choice)
                        {
                            e.Subtype = "";
                        }

                        e.Type = choice;
                    }));
                return;
            }

            if (_phase == Phase.B2)
            {
                Entry current = Get(design);
                if (current == null || current.Type != "Work" || current.Subtype != "Crafting" && !CraftingSubtypes.Contains(current.Subtype))
                {
                    Say($"Sort B2: No. {number} is not a Crafting design; the chitin knife only splits Crafting into trades.");
                    return;
                }

                string trade = _key == KeyClear ? "Crafting" : _key - 1 < CraftingSubtypes.Length ? CraftingSubtypes[_key - 1] : null;
                if (trade != null)
                {
                    Say(Apply(design, number, e => e.Subtype = trade));
                }

                return;
            }

            string type = TypeOf(design);
            if (type != "Work" && type != "Community")
            {
                Say($"Sort: No. {number} is {(type.Length == 0 ? "unsorted" : type)}. Subtypes are for work and community designs; sort its type with the flint knife first.");
                return;
            }

            string[] full = type == "Community" ? CommunitySubtypes : WorkSubtypes;
            string subtype = _key == KeyClear && type == "Community" ? "" : _key - 1 < full.Length ? full[_key - 1] : null;
            if (subtype == null)
            {
                return;
            }

            Say(Apply(design, number, e => e.Subtype = subtype));
        }

        [HarmonyPatch(typeof(HotkeyBar), nameof(HotkeyBar.UpdateIcons))]
        internal static class IconsPatch
        {
            private static void Postfix(HotkeyBar __instance)
            {
                if (_phase == Phase.None || __instance.m_elements == null ||
                    !string.Equals(__instance.gameObject.name, "HotKeyBar", System.StringComparison.OrdinalIgnoreCase))
                {
                    return;
                }

                try
                {
                    string[] labels = Labels;
                    string[] icons = IconNames;
                    for (int i = 0; i < __instance.m_elements.Count && i < labels.Length; i++)
                    {
                        HotkeyBar.ElementData element = __instance.m_elements[i];
                        Traverse data = Traverse.Create(element);
                        element.m_go.SetActive(true);
                        Sprite sprite = Icon(icons[i]);
                        Component icon = data.Field("m_icon").GetValue<Component>();
                        if (icon != null)
                        {
                            icon.gameObject.SetActive(sprite != null);
                            Traverse.Create(icon).Property("sprite").SetValue(sprite);
                            Traverse.Create(icon).Property("color").SetValue(Color.white);
                        }

                        element.m_durability?.gameObject.SetActive(false);
                        Component amount = data.Field("m_amount").GetValue<Component>();
                        if (amount != null)
                        {
                            amount.gameObject.SetActive(true);
                            Traverse.Create(amount).Property("text").SetValue(labels[i]);
                        }

                        element.m_equiped?.SetActive(i == _key - 1);
                        element.m_queued?.SetActive(false);
                    }
                }
                catch (System.Exception e)
                {
                    VillheimPlugin.Log.LogWarning($"Design sort icons: {e.Message}");
                }
            }
        }

        private static readonly Dictionary<string, Sprite> IconCache = new Dictionary<string, Sprite>();

        private static Sprite Icon(string name)
        {
            if (string.IsNullOrEmpty(name))
            {
                return null;
            }

            if (IconCache.TryGetValue(name, out Sprite cached) && cached != null)
            {
                return cached;
            }

            Sprite icon = ObjectDB.instance?.GetItemPrefab(name)?.GetComponent<ItemDrop>()?.m_itemData?.GetIcon();
            if (icon == null)
            {
                icon = ZNetScene.instance?.GetPrefab(name)?.GetComponent<Piece>()?.m_icon;
            }

            IconCache[name] = icon;
            return icon;
        }

        // ---------------------------------------------------------------- the review sheet

        private static string _lastSheetResult = "nothing sent yet";

        private static string SheetUrl => LogicConfig.SortSheetUrl?.Value?.Trim() ?? "";

        /// <summary>Sends sort rows to the review sheet's web app (the sheet script's doPost), in the background.</summary>
        /// <summary>Rows waiting to go to the sheet, by design name (the newest state of each).</summary>
        private static readonly Dictionary<string, Entry> Pending = new Dictionary<string, Entry>();
        private static bool _sending;

        /// <summary>
        /// Queues sort rows for the review sheet's web app (the sheet script's doPost). One sender sends what has
        /// gathered every two seconds in one request, so quick clicks never run into Google's limit on requests at
        /// once; rows that fail stay queued and go again on the next round.
        /// </summary>
        private static void Push(IEnumerable<Entry> entries)
        {
            if (SheetUrl.Length == 0 || VillheimPlugin.Instance == null)
            {
                return;
            }

            foreach (Entry e in entries.Where(e => e != null && e.Number > 0))
            {
                Pending[e.Name] = e.Copy();
            }

            if (Pending.Count > 0 && !_sending)
            {
                _sending = true;
                VillheimPlugin.Instance.StartCoroutine(Sender());
            }
        }

        private static IEnumerator Sender()
        {
            int failures = 0;
            try
            {
                while (Pending.Count > 0 && SheetUrl.Length > 0)
                {
                    yield return new WaitForSecondsRealtime(failures == 0 ? 2f : Mathf.Min(60f, 5f * failures));
                    List<Entry> rows = Pending.Values.Take(25).ToList();
                    rows.ForEach(r => Pending.Remove(r.Name));
                    var json = new StringBuilder("{\"rows\":[");
                    for (int i = 0; i < rows.Count; i++)
                    {
                        Entry e = rows[i];
                        json.Append(i > 0 ? "," : "").Append("{\"number\":").Append(e.Number)
                            .Append(",\"name\":").Append(Json(e.Name))
                            .Append(",\"type\":").Append(Json(e.Type))
                            .Append(",\"subtype\":").Append(Json(e.Subtype)).Append('}');
                    }

                    json.Append("]}");
                    using (var request = new UnityWebRequest(SheetUrl, "POST"))
                    {
                        request.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(json.ToString()));
                        request.downloadHandler = new DownloadHandlerBuffer();
                        request.SetRequestHeader("Content-Type", "text/plain;charset=utf-8");
                        request.timeout = 60;
                        yield return request.SendWebRequest();
                        string answer = request.downloadHandler?.text ?? "";
                        bool ok = string.IsNullOrEmpty(request.error) && answer.Contains("\"ok\":true");
                        if (ok)
                        {
                            failures = 0;
                            _lastSheetResult = $"{rows.Count} row(s) sent at {Now()}: {answer}";
                            continue;
                        }

                        // Put them back unless a newer choice for the same design is already waiting.
                        foreach (Entry e in rows.Where(e => !Pending.ContainsKey(e.Name)))
                        {
                            Pending[e.Name] = e;
                        }

                        failures++;
                        _lastSheetResult = $"sending {rows.Count} row(s) failed at {Now()} (try {failures}, {Pending.Count} waiting): " +
                                           $"{request.error} {answer.Substring(0, Mathf.Min(200, answer.Length))}";
                        VillheimPlugin.Log.LogWarning("Design sort: sheet " + _lastSheetResult);
                        if (failures == 3)
                        {
                            MessageHud.instance?.ShowMessage(MessageHud.MessageType.TopLeft,
                                "Sort: the sheet is not taking changes; they are kept in design-sort.csv and sent again (see 'vh sort').");
                        }
                    }
                }
            }
            finally
            {
                _sending = false;
            }
        }

        private static string Json(string s)
        {
            var b = new StringBuilder("\"");
            foreach (char c in s ?? "")
            {
                switch (c)
                {
                    case '"': b.Append("\\\""); break;
                    case '\\': b.Append("\\\\"); break;
                    case '\n': b.Append("\\n"); break;
                    case '\r': break;
                    default:
                        if (c < 32) b.Append($"\\u{(int)c:x4}");
                        else b.Append(c);
                        break;
                }
            }

            return b.Append('"').ToString();
        }

        // ---------------------------------------------------------------- 'vh sort'

        public static string Run(string[] args)
        {
            string first = args.Length > 0 ? args[0].ToLowerInvariant() : "";
            switch (first)
            {
                case "tools":
                case "tool":
                    return GiveTools();
                case "undo":
                    return UndoLast();
                case "reset":
                    return Reset(args.Skip(1).ToArray());
                case "push":
                    Push(Entries.Values);
                    return SheetUrl.Length == 0
                        ? "Sort: no sheet address yet. Set it with 'vh sort url <web app address>' (see the review guide)."
                        : $"Sort: sending all {Entries.Values.Count(e => e.Number > 0)} sorted designs to the sheet.";
                case "url":
                    if (args.Length < 2 || LogicConfig.SortSheetUrl == null)
                    {
                        return $"Sort: the sheet address is '{SheetUrl}'. 'vh sort url <address>' sets it, 'vh sort url off' clears it.";
                    }

                    LogicConfig.SortSheetUrl.Value = args[1].ToLowerInvariant() == "off" ? "" : args[1];
                    return SheetUrl.Length == 0 ? "Sort: no longer sending to the sheet." : "Sort: choices now go to the sheet too. 'vh sort push' sends everything sorted so far.";
                default:
                    var counts = Types.Select(t => $"{t} {Entries.Values.Count(e => e.Type == t)}");
                    int subtyped = Entries.Values.Count(e => e.Subtype.Length > 0);
                    return $"Sort: {string.Join(", ", counts)}; {subtyped} with a subtype. Kept in {FilePath}. Sheet: {(SheetUrl.Length == 0 ? "off" : _lastSheetResult + (Pending.Count > 0 ? $"; {Pending.Count} waiting" : ""))}.\n" +
                           "'vh sort tools' gives the sort knives; 'vh sort undo'; 'vh sort reset page N|all'; 'vh sort push' sends everything to the sheet; 'vh sort url <address>'; " +
                           "'vh gallery keepers type <home|work|community|drop|unsorted|nosubtype|crafting|farming...>' shows only those designs.";
            }
        }

        /// <summary>
        /// 'vh sort reset page N' (a keepers page of 50, as the sheet has them) or 'vh sort reset all': those designs go
        /// back to unsorted, here and in the sheet. Undo history is cleared.
        /// </summary>
        private static string Reset(string[] args)
        {
            string what = args.Length > 0 ? args[0].ToLowerInvariant() : "";
            IEnumerable<string> names;
            string described;
            if (what == "all")
            {
                names = Entries.Keys.ToList();
                described = "every design";
            }
            else if (what == "page" && args.Length > 1 && int.TryParse(args[1], out int page) && page >= 1)
            {
                names = Keepers.Names.Skip((page - 1) * 50).Take(50);
                described = $"keepers page {page}";
            }
            else
            {
                return "Sort: 'vh sort reset page N' (a keepers page of 50) or 'vh sort reset all'.";
            }

            var changed = new List<Entry>();
            foreach (string name in names)
            {
                Entry e = Get(name);
                if (e != null && (e.Type.Length > 0 || e.Subtype.Length > 0))
                {
                    e.Type = "";
                    e.Subtype = "";
                    e.Changed = Now();
                    changed.Add(e);
                    RefreshSign(name);
                }
            }

            History.Clear();
            Write();
            Push(changed);
            return $"Sort: {changed.Count} designs of {described} are unsorted again{(SheetUrl.Length > 0 ? " (sheet updated too)" : "")}. " +
                   "'vh gallery again' puts the page up with all of them.";
        }

        private static void Say(string text)
        {
            MessageHud.instance?.ShowMessage(MessageHud.MessageType.TopLeft, text);
            Console.instance?.Print(text);
        }

        // ---------------------------------------------------------------- csv

        private static string Csv(string s) =>
            s.IndexOfAny(new[] { ',', '"', '\n' }) >= 0 ? "\"" + s.Replace("\"", "\"\"") + "\"" : s;

        private static List<string> SplitCsv(string line)
        {
            var fields = new List<string>();
            var current = new StringBuilder();
            bool quoted = false;
            for (int i = 0; i < line.Length; i++)
            {
                char c = line[i];
                if (quoted)
                {
                    if (c == '"' && i + 1 < line.Length && line[i + 1] == '"') { current.Append('"'); i++; }
                    else if (c == '"') quoted = false;
                    else current.Append(c);
                }
                else if (c == '"') quoted = true;
                else if (c == ',') { fields.Add(current.ToString()); current.Clear(); }
                else current.Append(c);
            }

            fields.Add(current.ToString());
            return fields;
        }
    }
}
