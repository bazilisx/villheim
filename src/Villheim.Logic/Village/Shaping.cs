using System.Collections.Generic;
using System.Linq;
using HarmonyLib;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Shaping: editing gallery designs with the Shaper Tool (a vanilla item, the wooden knife by default: config
    /// ShapingTool; 'vh tool' gives one). With it in hand, hotbar keys 1 to 8 pick a tool (its slot shows as selected;
    /// the same key again puts it down) and left click uses it, with the hammer's building swing:
    ///
    /// 1 Move: the player stands still; W A S D move the design under the crosshair away, left, back, right as the
    ///   player looks, E up and Q down; 10 cm a press, 50 cm with Shift. The whole design is highlighted. Click locks
    ///   onto one structure (a hut beside a hall) so only that moves and is highlighted; click it again to let go.
    /// 2 Turn: the player stands still; the mouse wheel turns the design under the crosshair about its plot's middle
    ///   (yaw; Shift tilts about the plot's X axis, Alt about its Z axis). Click locks onto one object, so only that
    ///   turns, about its own pivot and axes (Ctrl: every object of its name in the design). A ring shows the axis.
    /// 3 Swap: click a design piece to pick it (stand-ins go up at its sign), click a stand-in or a built piece to use it.
    /// 4 Delete: click removes what is aimed at, creatures and traders included (never a player).
    /// 5 Delete all: click an object and every object of its name in that design is highlighted; click again within 6
    ///   seconds to delete them all (outside a design: everything of that name within 20 m).
    /// 6 Save: click a design to ask; click again within 6 seconds to save it as it stands (as 'vh bp save').
    /// 7 Reset: click a design to ask; click again within 6 seconds to put it up again as the gallery shows it.
    /// 8 Undo: each press takes back the newest change. Click does nothing.
    /// While the tool is in hand, look is on: the aimed object is highlighted (LookColor) and its name shows in the middle
    /// of the screen. Every highlight of the tool uses that one colour.
    ///
    /// Putting the tool away ends Shaping. Nothing needs a restart: the tool is an existing item.
    /// </summary>
    internal static class Shaping
    {
        private const float DeleteReach = 6f;

        private const int ToolMove = 1, ToolTurn = 2, ToolSwap = 3, ToolDelete = 4, ToolDeleteAll = 5, ToolSave = 6, ToolReset = 7, ToolUndo = 8;

        private static bool _active;
        private static int _tool;
        private static ZNetView _locked;
        private static bool Moving => _tool == ToolMove;
        private static bool Frozen => _tool == ToolMove || _tool == ToolTurn;
        private static string _saveArmed;
        private static float _saveUntil;
        private static string _resetArmed;
        private static float _resetUntil;
        private static bool _lookBefore;
        private static string _massArmed;
        private static float _massUntil;
        private static readonly List<ZNetView> Marked = new List<ZNetView>();
        private static readonly int Emission = Shader.PropertyToID("_EmissionColor");
        private const float MassRadius = 20f;

        private static readonly string[] Labels = { "Move", "Turn", "Swap", "Delete", "Del all", "Save", "Reset", "Undo" };
        private static readonly string[] IconSources =
            { "ArrowWood", "ShieldWood", "Hammer", "BombOoze", "BombBile", "piece_chest_wood", "Hoe", "Feathers" };

        private static Sprite[] _icons;

        public static bool Active => _active;

        /// <summary>The object is highlighted by the tool (look leaves it as it is).</summary>
        public static bool IsShown(GameObject go) => go != null && (Shown.Contains(go) || Marked.Exists(v => v != null && v.gameObject == go));

        /// <summary>'vh tool': puts a shaping rod in the inventory.</summary>
        public static string GiveTool()
        {
            Player player = Player.m_localPlayer;
            string name = LogicConfig.ShapingTool?.Value ?? "KnifeWood";
            GameObject prefab = ObjectDB.instance?.GetItemPrefab(name);
            if (player == null || prefab == null)
            {
                return $"Villheim: no item called {name} (config ShapingTool).";
            }

            player.PickupPrefab(prefab, 1, false);
            return $"Villheim: the shaping tool ({name}) is in your inventory. Put it on a quick slot; with it in hand, hotbar 1 to 8 edit gallery designs " +
                   "(1 Move, 2 Turn, 3 Swap, 4 Delete, 5 Delete all, 6 Save, 7 Reset, 8 Undo): press a key to pick the tool, left click to use it.";
        }

        private static bool Holding(Player player)
        {
            string name = LogicConfig.ShapingTool?.Value ?? "KnifeWood";
            ItemDrop.ItemData right = player.GetRightItem();
            ItemDrop.ItemData left = player.GetLeftItem();
            return right?.m_dropPrefab != null && right.m_dropPrefab.name == name || left?.m_dropPrefab != null && left.m_dropPrefab.name == name;
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
                    bool holding = Holding(__instance);
                    if (holding != _active)
                    {
                        _active = holding;
                        if (holding)
                        {
                            SwapTool.Activate();
                            _lookBefore = LookAt.On;
                            LookAt.SetOn(true);
                            _tool = ToolSwap;
                            Say("Shaping on: 1 Move, 2 Turn, 3 Swap, 4 Delete, 5 Delete all, 6 Save, 7 Reset, 8 Undo. Press a key to pick the tool, left click to use it. Swap is picked.");
                        }
                        else
                        {
                            PutDown();
                            _tool = 0;
                            ShowSelection(null, null);
                            Gizmo.Hide();
                            SwapTool.Release();
                            LookAt.SetOn(_lookBefore);
                            Say("Shaping off.");
                        }
                    }

                    Glow(__instance);
                    Identity();
                    GlowOnGround();
                    if (_massArmed != null && Time.time > _massUntil)
                    {
                        Disarm();
                    }

                    if (_locked != null && (!_locked.IsValid() || _tool != ToolTurn))
                    {
                        _locked = null;
                    }

                    if (_active && Moving && !Typing())
                    {
                        MoveKeys(__instance);
                    }

                    _wheelTaken = false;
                    if (_active && _tool == ToolTurn && !Typing())
                    {
                        Wheel(__instance);
                    }
                    else
                    {
                        Gizmo.Hide();
                    }

                    if (_active)
                    {
                        Selection(__instance);
                    }
                }
                catch (System.Exception e)
                {
                    VillheimPlugin.Log.LogWarning($"Shaping: {e}");
                }
            }
        }

        private static GameObject _glowItem;

        private static string HandEffect => LogicConfig.ShaperHandEffect?.Value ?? "Lightning";
        private static string GroundEffect => LogicConfig.ShaperGroundEffect?.Value ?? "Beam and Glow";
        private static Color EffectColor => LogicConfig.ShaperColor?.Value ?? new Color(0.102f, 0.851f, 0.749f);

        /// <summary>
        /// The tool in hand shows ShaperHandEffect while shaping (on the tool only, no light on the player); a change in
        /// F1 shows at once. Put away, the effect goes.
        /// </summary>
        private static void Glow(Player player)
        {
            VisEquipment vis = player.m_visEquipment;
            GameObject item = _active && vis != null ? (vis.m_rightItemInstance != null ? vis.m_rightItemInstance : vis.m_leftItemInstance) : null;
            if (item != _glowItem && _glowItem != null)
            {
                ShaperEffects.Clear(_glowItem);
            }

            _glowItem = item;
            if (item != null)
            {
                string signature = ShaperEffects.Signature(HandEffect, EffectColor);
                if (!ShaperEffects.Shows(item, signature))
                {
                    ShaperEffects.Apply(item, HandEffect, EffectColor, ground: false);
                }
            }
        }

        // ---------------------------------------------------------------- the tool's name and glow everywhere

        public const string ToolName = "Villheim Dev Shaper Tool";
        private const string ToolDescription =
            "Villheim's design review tool. In hand, hotbar 1 to 8 pick a tool and left click uses it: 1 Move (W A S D, Q and E), " +
            "2 Turn (mouse wheel), 3 Swap, 4 Delete, 5 Delete all, 6 Save, 7 Reset, 8 Undo. See docs/DESIGN_REVIEW_GUIDE.md.";

        private static string _named;
        private static string _oldName;
        private static string _oldDescription;
        private static float _nextGroundGlow;
        private static Color IconTint => Color.Lerp(Color.white, EffectColor, 0.6f);

        private static ItemDrop.ItemData.SharedData SharedOf(string prefab) =>
            ObjectDB.instance?.GetItemPrefab(prefab)?.GetComponent<ItemDrop>()?.m_itemData?.m_shared;

        /// <summary>
        /// The item that is the shaping tool is called "Villheim Dev Shaper Tool" everywhere (on the ground, in the
        /// inventory, on the hotbar): its shared item data is renamed, so every wooden knife is the Shaper Tool. If the
        /// config names another item, the old one gets its own name back.
        /// </summary>
        private static void Identity()
        {
            string want = LogicConfig.ShapingTool?.Value ?? "KnifeWood";
            if (_named == want || ObjectDB.instance == null)
            {
                return;
            }

            if (_named != null)
            {
                ItemDrop.ItemData.SharedData old = SharedOf(_named);
                if (old != null && _oldName != null)
                {
                    old.m_name = _oldName;
                    old.m_description = _oldDescription;
                }
            }

            ItemDrop.ItemData.SharedData shared = SharedOf(want);
            if (shared == null)
            {
                return;
            }

            if (shared.m_name != ToolName)
            {
                _oldName = shared.m_name;
                _oldDescription = shared.m_description;
            }

            shared.m_name = ToolName;
            shared.m_description = ToolDescription;
            _named = want;
        }

        /// <summary>A Shaper Tool lying on the ground shows ShaperGroundEffect (checked twice a second, so F1 changes show quickly).</summary>
        private static void GlowOnGround()
        {
            if (Time.time < _nextGroundGlow)
            {
                return;
            }

            _nextGroundGlow = Time.time + 0.5f;
            string want = LogicConfig.ShapingTool?.Value ?? "KnifeWood";
            string signature = ShaperEffects.Signature(GroundEffect, EffectColor);
            foreach (ItemDrop drop in ItemDrop.s_instances)
            {
                if (drop != null && Utils.GetPrefabName(drop.gameObject) == want && !ShaperEffects.Shows(drop.gameObject, signature))
                {
                    ShaperEffects.Apply(drop.gameObject, GroundEffect, EffectColor, ground: true);
                }
            }
        }

        /// <summary>Tints every icon of the Shaper Tool teal, in an inventory or chest grid or on a hotbar.</summary>
        private static void TintIcons(System.Collections.IEnumerable elements)
        {
            Sprite tool = SharedOf(LogicConfig.ShapingTool?.Value ?? "KnifeWood")?.m_icons?.FirstOrDefault();
            if (tool == null || elements == null)
            {
                return;
            }

            foreach (object element in elements)
            {
                Component icon = element != null ? Traverse.Create(element).Field("m_icon").GetValue<Component>() : null;
                if (icon != null && Traverse.Create(icon).Property("sprite").GetValue<Sprite>() == tool)
                {
                    Traverse.Create(icon).Property("color").SetValue(IconTint);
                }
            }
        }

        [HarmonyPatch(typeof(InventoryGrid), nameof(InventoryGrid.UpdateGui))]
        internal static class GridTintPatch
        {
            private static void Postfix(InventoryGrid __instance)
            {
                try
                {
                    TintIcons(Traverse.Create(__instance).Field("m_elements").GetValue<System.Collections.IEnumerable>());
                }
                catch (System.Exception e)
                {
                    VillheimPlugin.Log.LogWarning($"Shaper Tool tint: {e.Message}");
                }
            }
        }

        [HarmonyPatch(typeof(HotkeyBar), nameof(HotkeyBar.UpdateIcons))]
        internal static class BarTintPatch
        {
            private static void Postfix(HotkeyBar __instance)
            {
                try
                {
                    TintIcons(__instance.m_elements);
                }
                catch (System.Exception e)
                {
                    VillheimPlugin.Log.LogWarning($"Shaper Tool tint: {e.Message}");
                }
            }
        }

        /// <summary>Hotbar keys do Shaping's work while the rod is in hand.</summary>
        [HarmonyPatch(typeof(Player), nameof(Player.UseHotbarItem))]
        internal static class HotbarPatch
        {
            private static bool Prefix(Player __instance, int index)
            {
                if (!_active || __instance != Player.m_localPlayer)
                {
                    return true;
                }

                try
                {
                    Select(__instance, index);
                }
                catch (System.Exception e)
                {
                    VillheimPlugin.Log.LogWarning($"Shaping: {e}");
                }

                return false;
            }
        }

        private static float _lastAttackCall = -1f;

        /// <summary>
        /// Left click uses the picked tool once; the knife never attacks while Shaping. The game asks to start an attack
        /// every physics step for half a second after a click, and every step while the button is held, so only a call
        /// after a pause counts as a click (one click did two actions before: two swings, two deletes). Answering
        /// "started" ends the game's half second of asking.
        /// </summary>
        [HarmonyPatch(typeof(Humanoid), nameof(Humanoid.StartAttack))]
        internal static class AttackPatch
        {
            private static bool Prefix(Humanoid __instance, bool secondaryAttack, ref bool __result)
            {
                if (!_active || __instance != Player.m_localPlayer)
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
                        Click((Player)__instance);
                    }
                    catch (System.Exception e)
                    {
                        VillheimPlugin.Log.LogWarning($"Shaping: {e}");
                    }
                }

                return false;
            }
        }

        /// <summary>While moving or turning a design the player stands still (flying too): W A S D, Q and E move the design instead.</summary>
        [HarmonyPatch(typeof(Player), nameof(Player.SetControls))]
        internal static class StandStillPatch
        {
            private static void Prefix(Player __instance, ref Vector3 movedir, ref bool jump, ref bool crouch, ref bool run, ref bool autoRun, ref bool dodge)
            {
                if (_active && Frozen && __instance == Player.m_localPlayer)
                {
                    movedir = Vector3.zero;
                    jump = crouch = run = autoRun = dodge = false;
                }
            }
        }

        /// <summary>E is "up" while moving a design, not "use".</summary>
        [HarmonyPatch(typeof(Player), nameof(Player.Interact))]
        internal static class InteractPatch
        {
            private static bool Prefix(Player __instance) => !(_active && Moving && __instance == Player.m_localPlayer);
        }

        /// <summary>The hotbar shows Shaping's eight tools while the rod is in hand.</summary>
        [HarmonyPatch(typeof(HotkeyBar), nameof(HotkeyBar.UpdateIcons))]
        internal static class IconsPatch
        {
            private static readonly HashSet<string> SeenBars = new HashSet<string>();

            private static void Postfix(HotkeyBar __instance)
            {
                if (!_active || __instance.m_elements == null)
                {
                    return;
                }

                // Only the game's own hotbar; other mods' quick slot bars keep their items.
                if (SeenBars.Add(__instance.gameObject.name))
                {
                    VillheimPlugin.Log.LogInfo($"Shaping: hotkey bar '{__instance.gameObject.name}' with {__instance.m_elements.Count} slots.");
                }

                if (!string.Equals(__instance.gameObject.name, "HotKeyBar", System.StringComparison.OrdinalIgnoreCase))
                {
                    return;
                }

                try
                {
                    LoadIcons();
                    for (int i = 0; i < __instance.m_elements.Count && i < Labels.Length; i++)
                    {
                        // The icon (an Image) and the label (a TextMeshPro text) are set by reflection, so the logic DLL
                        // needs no reference to Unity's UI or TextMeshPro assemblies.
                        HotkeyBar.ElementData element = __instance.m_elements[i];
                        Traverse data = Traverse.Create(element);
                        element.m_go.SetActive(true);
                        Component icon = data.Field("m_icon").GetValue<Component>();
                        if (icon != null)
                        {
                            icon.gameObject.SetActive(_icons[i] != null);
                            Traverse.Create(icon).Property("sprite").SetValue(_icons[i]);
                            Traverse.Create(icon).Property("color").SetValue(Color.white);
                        }

                        element.m_durability?.gameObject.SetActive(false);
                        Component amount = data.Field("m_amount").GetValue<Component>();
                        if (amount != null)
                        {
                            amount.gameObject.SetActive(true);
                            Traverse.Create(amount).Property("text").SetValue(Label(i));
                        }

                        element.m_equiped?.SetActive(On(i));
                        element.m_queued?.SetActive(false);
                    }
                }
                catch (System.Exception e)
                {
                    VillheimPlugin.Log.LogWarning($"Shaping icons: {e.Message}");
                }
            }
        }

        private static string Label(int i)
        {
            switch (i)
            {
                case 0: return SwapTool.PartLocked ? "Move part" : "Move";
                case 1: return _locked != null ? "Turn one" : "Turn";
                case 4: return _massArmed != null ? "Del all?" : "Del all";
                case 5: return _saveArmed != null && Time.time < _saveUntil ? "Save?" : "Save";
                case 6: return _resetArmed != null && Time.time < _resetUntil ? "Reset?" : "Reset";
                default: return Labels[i];
            }
        }

        private static bool On(int i) => i == _tool - 1;

        private static void LoadIcons()
        {
            if (_icons != null && _icons[0] != null)
            {
                return;
            }

            _icons = new Sprite[IconSources.Length];
            for (int i = 0; i < IconSources.Length; i++)
            {
                if (IconSources[i].Length == 0)
                {
                    continue;
                }

                GameObject item = ObjectDB.instance?.GetItemPrefab(IconSources[i]);
                Sprite icon = item?.GetComponent<ItemDrop>()?.m_itemData?.GetIcon();
                if (icon == null)
                {
                    icon = ZNetScene.instance?.GetPrefab(IconSources[i])?.GetComponent<Piece>()?.m_icon;
                }

                _icons[i] = icon;
            }
        }

        private static readonly string[] Picked =
        {
            "Move: you stand still. W A S D move the highlighted design, E up, Q down, Shift for 50 cm. Click a structure to move only that, click it again to let go. 1 again to walk.",
            "Turn: you stand still. The mouse wheel turns the highlighted design; Shift tilts, Alt rolls. Click an object to turn only that (Ctrl: all of its name), click it again to let go. 2 again to walk.",
            "Swap: click a design piece to pick it, then click a stand-in (or a piece you built) to use it.",
            "Delete: click what you want removed. 8 puts it back.",
            "Delete all: click an object to mark every one of its name in the design, then click again within 6 seconds.",
            "Save: click a design, then click again within 6 seconds to save it.",
            "Reset: click a design, then click again within 6 seconds to put it up again as the gallery shows it.",
            "",
        };

        /// <summary>A hotbar key picks its tool; the same key again puts it down. 8 undoes on every press.</summary>
        private static void Select(Player player, int index)
        {
            if (index < 1 || index > 8)
            {
                return;
            }

            if (index == ToolUndo)
            {
                PutDown();
                _tool = ToolUndo;
                Say(SwapTool.UndoCurrent());
                _selectionKey = null;
                return;
            }

            bool same = index == _tool;
            PutDown();
            _tool = same ? 0 : index;
            if (_tool == ToolMove)
            {
                _moveDesign = SwapTool.DesignAimed(player);
                if (!string.IsNullOrEmpty(_moveDesign))
                {
                    Say($"Move: {_moveDesign} (it stays picked, wherever you aim, until you press 1 again).");
                }
            }
            Say(same ? "Tool put down: clicks do nothing until you pick one (1 to 8)." : Picked[index - 1]);
        }

        /// <summary>Lets go of what the current tool holds: Move's part, Turn's lock, unanswered questions.</summary>
        private static void PutDown()
        {
            if (SwapTool.PartLocked)
            {
                SwapTool.TogglePart(null);
            }

            _locked = null;
            _saveArmed = null;
            _resetArmed = null;
            _moveDesign = null;
            _heldKey = KeyCode.None;
            Disarm();
        }

        /// <summary>What Move works on until it is put down (the design or board plot aimed at when Move was picked, or at the first key).</summary>
        private static string _moveDesign;
        private static KeyCode _heldKey = KeyCode.None;
        private static float _nextRepeat;

        /// <summary>Left click: the picked tool's action, with the hammer's building swing.</summary>
        private static void Click(Player player)
        {
            switch (_tool)
            {
                case ToolMove:
                    Swing(player);
                    PartToggle(player);
                    break;
                case ToolTurn:
                    Swing(player);
                    LockToggle(player);
                    break;
                case ToolSwap:
                    Swing(player);
                    SwapTool.PickOrUse(player);
                    break;
                case ToolDelete:
                    Swing(player);
                    Delete(player);
                    break;
                case ToolDeleteAll:
                    Swing(player);
                    DeleteAll(player);
                    break;
                case ToolSave:
                    Swing(player);
                    Save(player);
                    break;
                case ToolReset:
                    Swing(player);
                    Reset(player);
                    break;
            }
        }

        private static float _nextSwing;

        /// <summary>The arm swing the hammer makes when it places a piece (Player.UpdatePlacement).</summary>
        private static void Swing(Player player)
        {
            if (Time.time < _nextSwing || player.m_zanim == null)
            {
                return;
            }

            _nextSwing = Time.time + 0.4f;
            string animation = ObjectDB.instance?.GetItemPrefab("Hammer")?.GetComponent<ItemDrop>()?.m_itemData?.m_shared?.m_attack?.m_attackAnimation;
            player.FaceLookDirection();
            player.m_zanim.SetTrigger(string.IsNullOrEmpty(animation) ? "swing_hammer" : animation);
        }

        /// <summary>Move: click locks onto the structure aimed at; click it again (or nothing) to let go, another to switch.</summary>
        private static void PartToggle(Player player)
        {
            GameObject aimed = LookAt.Target(player);
            ShowSelection(null, "part");
            if (SwapTool.PartLocked)
            {
                bool same = aimed != null && SwapTool.IsLit(aimed);
                string off = SwapTool.TogglePart(player);
                if (same || aimed == null)
                {
                    _selectionKey = null;
                    Say(off);
                    return;
                }
            }

            string said = SwapTool.TogglePart(player);
            if (!SwapTool.PartLocked)
            {
                _selectionKey = null;
            }

            Say(said);
        }

        // ---------------------------------------------------------------- one highlight colour for everything

        private static readonly HashSet<GameObject> Shown = new HashSet<GameObject>();
        private static string _selectionKey;
        private static float _nextSelection;

        /// <summary>
        /// What the picked tool works on is highlighted in LookColor: Move and Turn the whole design under the crosshair
        /// (or the last one picked), or what a click locked onto; Save and Reset the design they ask about.
        /// </summary>
        private static void Selection(Player player)
        {
            if (Time.time < _nextSelection)
            {
                return;
            }

            _nextSelection = Time.time + 0.2f;
            if (SwapTool.PartLocked)
            {
                return;
            }

            if (_tool == ToolTurn && _locked != null)
            {
                ShowSelection(new List<ZNetView> { _locked }, "lock:" + _locked.GetInstanceID());
                return;
            }

            string design = null;
            if (_tool == ToolMove && !string.IsNullOrEmpty(_moveDesign))
            {
                design = _moveDesign;
            }
            else if (_tool == ToolMove || _tool == ToolTurn)
            {
                design = SwapTool.DesignAimed(player);
            }
            else if (_tool == ToolSave && _saveArmed != null && Time.time < _saveUntil)
            {
                design = _saveArmed;
            }
            else if (_tool == ToolReset && _resetArmed != null && Time.time < _resetUntil)
            {
                design = _resetArmed;
            }

            if (string.IsNullOrEmpty(design))
            {
                ShowSelection(null, null);
                return;
            }

            if (_selectionKey != "design:" + design)
            {
                ShowSelection(SwapTool.DesignParts(design).Views, "design:" + design);
            }
        }

        /// <summary>
        /// Highlights these objects instead of the ones before (null: none). Same key, or nothing shown and nothing
        /// asked: nothing changes. (Clearing an empty highlight five times a second also cleared look's hover colour
        /// each time, so the object aimed at flashed.)
        /// </summary>
        private static void ShowSelection(List<ZNetView> views, string key)
        {
            if (key == _selectionKey && (key != null || Shown.Count == 0))
            {
                return;
            }

            foreach (GameObject go in Shown)
            {
                if (go != null)
                {
                    MaterialMan.instance?.ResetValue(go, Emission);
                }
            }

            Shown.Clear();
            _selectionKey = key;
            LookAt.Refresh();
            if (views == null)
            {
                return;
            }

            foreach (ZNetView view in views)
            {
                if (view != null && view.IsValid())
                {
                    Shown.Add(view.gameObject);
                    MaterialMan.instance?.SetValue(view.gameObject, Emission, LookAt.Highlight);
                }
            }
        }

        // ---------------------------------------------------------------- Turn: the mouse wheel

        private static bool _wheelTaken;
        private static string _wheelDesign;
        private static ZDO _wheelSign;
        private static List<ZNetView> _wheelParts = new List<ZNetView>();
        private static float _wheelUntil;
        private static float _cameraDistance;
        private static float TurnStep => LogicConfig.ShaperTurnStep?.Value ?? 22.5f;

        private static void LockToggle(Player player)
        {
            GameObject aimed = LookAt.Target(player);
            if (_locked != null && (aimed == null || aimed == _locked.gameObject))
            {
                Say($"Turn: let go of {Utils.GetPrefabName(_locked.gameObject)}; the wheel turns the whole design again.");
                _locked = null;
                return;
            }

            ZNetView view = aimed != null ? aimed.GetComponent<ZNetView>() : null;
            if (view == null || !view.IsValid() || aimed.GetComponent<Player>() != null)
            {
                Say("Turn: aim at an object within reach first.");
                return;
            }

            _locked = view;
            _nextSelection = 0f;
            Say($"Turn: only {Utils.GetPrefabName(view.gameObject)} turns now, wherever you look. Click it again to let go.");
        }

        /// <summary>
        /// One wheel notch turns by ShaperTurnStep. Nothing locked: the whole design under the crosshair (or the last
        /// one picked) about the middle of its plot, about the up axis, or with Shift the plot's X axis, with Alt its Z
        /// axis. Locked onto an object: only that, about its own pivot and axes (Ctrl: every object of its name in the
        /// design). A ring shows the axis. The camera does not zoom while the wheel turns something.
        /// </summary>
        private static void Wheel(Player player)
        {
            bool shift = Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.RightShift);
            bool alt = Input.GetKey(KeyCode.LeftAlt) || Input.GetKey(KeyCode.RightAlt);
            bool all = Input.GetKey(KeyCode.LeftControl) || Input.GetKey(KeyCode.RightControl);
            string axisName = shift ? "X" : alt ? "Z" : "Y";
            Color axisColor = shift ? new Color(1f, 0.25f, 0.25f) : alt ? new Color(0.3f, 0.5f, 1f) : new Color(0.3f, 1f, 0.3f);

            List<ZNetView> views;
            Vector3 pivot;
            Quaternion frame;
            float radius;
            string what;
            string design;
            bool whole = _locked == null;
            if (whole)
            {
                design = SwapTool.DesignAimed(player);
                if (design != _wheelDesign || Time.time > _wheelUntil)
                {
                    // Looked up a few times a second, not every frame: it walks every object in the world.
                    (_wheelSign, _wheelParts) = SwapTool.DesignParts(design);
                    _wheelDesign = design;
                    _wheelUntil = Time.time + 0.5f;
                }

                ZDO sign = _wheelSign;
                List<ZNetView> parts = _wheelParts.Where(v => v != null && v.IsValid()).ToList();
                if (sign == null || parts.Count == 0)
                {
                    Gizmo.Hide();
                    return;
                }

                views = parts;
                Vector3 center = sign.GetVec3(Gallery.KeyPlotCenter, Vector3.zero);
                float floor = parts.Min(v => v.transform.position.y);
                pivot = new Vector3(center.x, floor, center.z);
                frame = Quaternion.Euler(0f, sign.GetFloat(Gallery.KeyPlotYaw, 0f), 0f);
                radius = Mathf.Clamp(sign.GetFloat(Gallery.KeyPlotHalf, 5f) * 0.8f, 1f, 40f);
                what = design;
            }
            else
            {
                design = SwapTool.DesignOf(_locked.gameObject);
                string prefab = Utils.GetPrefabName(_locked.gameObject);
                views = all && design.Length > 0
                    ? ZNetScene.instance.m_instances.Values.Where(v => v != null && v.IsValid() && Utils.GetPrefabName(v.gameObject) == prefab &&
                                                                        SwapTool.DesignOf(v.gameObject) == design).ToList()
                    : new List<ZNetView> { _locked };
                pivot = _locked.transform.position;
                frame = _locked.transform.rotation;
                radius = Mathf.Clamp(Extent(_locked.gameObject), 0.4f, 10f);
                what = views.Count > 1 ? $"all {views.Count} {prefab}" : prefab;
            }

            Vector3 axis = shift ? frame * Vector3.right : alt ? frame * Vector3.forward : Vector3.up;
            Gizmo.Show(pivot, axis, radius, axisColor);
            _wheelTaken = true;
            float scroll = ZInput.GetMouseScrollWheel();
            if (Mathf.Abs(scroll) < 0.001f)
            {
                return;
            }

            float angle = Mathf.Sign(scroll) * TurnStep;
            var before = views.Select(v => (View: v, Position: v.transform.position, Rotation: v.transform.rotation,
                Center: v.GetZDO().GetVec3(Gallery.KeySwappedCenter, Vector3.zero), Original: v.GetZDO().GetQuaternion(Gallery.KeySwappedRotation, Quaternion.identity))).ToList();
            foreach (ZNetView view in views)
            {
                if (whole)
                {
                    Quaternion delta = Quaternion.AngleAxis(angle, axis);
                    Place(view, pivot + delta * (view.transform.position - pivot), delta * view.transform.rotation);
                    ZDO zdo = view.GetZDO();
                    if (zdo.GetString(Gallery.KeySwappedFrom, "").Length > 0)
                    {
                        zdo.Set(Gallery.KeySwappedCenter, pivot + delta * (zdo.GetVec3(Gallery.KeySwappedCenter, view.transform.position) - pivot));
                        zdo.Set(Gallery.KeySwappedRotation, delta * zdo.GetQuaternion(Gallery.KeySwappedRotation, view.transform.rotation));
                    }
                }
                else
                {
                    Quaternion rotation = view.transform.rotation;
                    rotation = shift ? rotation * Quaternion.AngleAxis(angle, Vector3.right)
                        : alt ? rotation * Quaternion.AngleAxis(angle, Vector3.forward)
                        : Quaternion.AngleAxis(angle, Vector3.up) * rotation;
                    Place(view, view.transform.position, rotation);
                }
            }

            string key = whole ? "turn:" + design : all ? $"turn:{design}/{Utils.GetPrefabName(_locked.gameObject)}" : "turn:" + _locked.GetInstanceID();
            EditHistory.Push($"turning {what}", () => before.ForEach(b =>
            {
                Place(b.View, b.Position, b.Rotation);
                if (b.View != null && b.View.IsValid() && b.View.GetZDO().GetString(Gallery.KeySwappedFrom, "").Length > 0)
                {
                    b.View.GetZDO().Set(Gallery.KeySwappedCenter, b.Center);
                    b.View.GetZDO().Set(Gallery.KeySwappedRotation, b.Original);
                }
            }), key);
            SwapTool.MarkTouched(design);
            Vector3 euler = (whole ? Quaternion.identity : _locked.transform.rotation).eulerAngles;
            MessageHud.instance?.ShowMessage(MessageHud.MessageType.Center,
                whole ? $"{what}\n{axisName} {angle:+0.#;-0.#}" : $"{what}\n{axisName} {angle:+0.#;-0.#} : {euler.x:0} {euler.y:0} {euler.z:0}");
        }

        private static float Extent(GameObject go)
        {
            Renderer[] renderers = go.GetComponentsInChildren<Renderer>();
            if (renderers.Length == 0)
            {
                return 1f;
            }

            Bounds bounds = renderers[0].bounds;
            foreach (Renderer renderer in renderers)
            {
                bounds.Encapsulate(renderer.bounds);
            }

            return bounds.extents.magnitude;
        }

        private static void Place(ZNetView view, Vector3 position, Quaternion rotation)
        {
            if (view == null || !view.IsValid())
            {
                return;
            }

            view.ClaimOwnership();
            view.transform.SetPositionAndRotation(position, rotation);
            view.GetZDO().SetPosition(position);
            view.GetZDO().SetRotation(rotation);
        }

        /// <summary>The camera keeps its distance while the wheel turns something.</summary>
        [HarmonyPatch(typeof(GameCamera), "UpdateCamera")]
        internal static class ZoomPatch
        {
            private static void Prefix(GameCamera __instance) => _cameraDistance = __instance.m_distance;

            private static void Postfix(GameCamera __instance)
            {
                if (_active && _wheelTaken)
                {
                    __instance.m_distance = _cameraDistance;
                }
            }
        }

        /// <summary>A ring round the axis the mouse wheel turns about: green up (Y), red X (Shift), blue Z (Alt).</summary>
        private static class Gizmo
        {
            private const int Points = 64;
            private static GameObject _ring;
            private static LineRenderer _line;

            public static void Show(Vector3 pivot, Vector3 axis, float radius, Color color)
            {
                if (_ring == null)
                {
                    _ring = new GameObject("VillheimShaperGizmo");
                    _line = _ring.AddComponent<LineRenderer>();
                    _line.loop = true;
                    _line.useWorldSpace = true;
                    _line.positionCount = Points;
                    _line.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                    _line.receiveShadows = false;
                    Shader shader = Shader.Find("Sprites/Default");
                    if (shader != null)
                    {
                        _line.material = new Material(shader);
                    }
                }

                _ring.SetActive(true);
                _line.startColor = _line.endColor = color;
                _line.widthMultiplier = Mathf.Clamp(radius * 0.02f, 0.02f, 0.15f);
                Vector3 normal = axis.normalized;
                Vector3 a = Vector3.Cross(normal, Mathf.Abs(Vector3.Dot(normal, Vector3.up)) > 0.9f ? Vector3.forward : Vector3.up).normalized;
                Vector3 b = Vector3.Cross(normal, a);
                for (int i = 0; i < Points; i++)
                {
                    float t = i * Mathf.PI * 2f / Points;
                    _line.SetPosition(i, pivot + (a * Mathf.Cos(t) + b * Mathf.Sin(t)) * radius);
                }
            }

            public static void Hide()
            {
                if (_ring != null)
                {
                    _ring.SetActive(false);
                }
            }
        }

        // ---------------------------------------------------------------- Reset

        /// <summary>Puts the design aimed at up again as the gallery shows it, on the second click within 6 seconds.</summary>
        private static void Reset(Player player)
        {
            string design = SwapTool.DesignAimed(player);
            if (string.IsNullOrEmpty(design))
            {
                Say("Reset: aim at a gallery design first.");
                return;
            }

            if (_resetArmed == design && Time.time < _resetUntil)
            {
                _resetArmed = null;
                ShowSelection(null, null);
                Say(design.StartsWith("board:") ? DesignBoard.ResetPlot(design) : Gallery.ResetDesign(design));
                return;
            }

            _resetArmed = design;
            _resetUntil = Time.time + 6f;
            _nextSelection = 0f;
            string question = $"Reset {design} to how the gallery puts it up?\nClick again within 6 seconds.";
            MessageHud.instance?.ShowMessage(MessageHud.MessageType.Center, question);
            Say(question.Replace("\n", " ") + " Swaps, moves, turns and pieces you added or removed since its last save are undone.");
        }

        private static readonly KeyCode[] MoveKeyCodes = { KeyCode.W, KeyCode.S, KeyCode.D, KeyCode.A, KeyCode.E, KeyCode.Q };

        /// <summary>
        /// W A S D, E and Q move the picked design (or the locked part): one step on the press, then on and on while the
        /// key is held (after a short pause), 10 cm a step, 50 cm with Shift. A held key's steps undo as one.
        /// </summary>
        private static void MoveKeys(Player player)
        {
            KeyCode key = KeyCode.None;
            foreach (KeyCode code in MoveKeyCodes)
            {
                if (Input.GetKeyDown(code))
                {
                    key = code;
                    _heldKey = code;
                    _nextRepeat = Time.time + 0.3f;
                    SwapTool.NewMoveRun();
                    break;
                }
            }

            if (key == KeyCode.None)
            {
                if (_heldKey == KeyCode.None || !Input.GetKey(_heldKey))
                {
                    _heldKey = KeyCode.None;
                    return;
                }

                if (Time.time < _nextRepeat)
                {
                    return;
                }

                key = _heldKey;
                _nextRepeat = Time.time + 0.05f;
            }

            Vector3 forward = GameCamera.instance != null ? GameCamera.instance.transform.forward : player.transform.forward;
            forward.y = 0f;
            forward = forward.sqrMagnitude > 0.01f ? forward.normalized : Vector3.forward;
            Vector3 right = Vector3.Cross(Vector3.up, forward);
            Vector3 move = key == KeyCode.W ? forward : key == KeyCode.S ? -forward : key == KeyCode.D ? right : key == KeyCode.A ? -right :
                key == KeyCode.E ? Vector3.up : Vector3.down;
            if (string.IsNullOrEmpty(_moveDesign))
            {
                _moveDesign = SwapTool.DesignAimed(player);
            }

            float step = Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.RightShift) ? 0.5f : 0.1f;
            SwapTool.MoveBy(player, move * step, _moveDesign);
        }

        /// <summary>The object under the crosshair within 6 m, creatures and traders included, never a player; null for none.</summary>
        private static ZNetView Aimed(Player player, out string why)
        {
            why = "nothing within reach under the crosshair";
            Transform eye = GameCamera.instance != null ? GameCamera.instance.transform : null;
            if (eye == null)
            {
                return null;
            }

            RaycastHit[] hits = Physics.RaycastAll(eye.position, eye.forward, 40f, ~0, QueryTriggerInteraction.Ignore);
            System.Array.Sort(hits, (a, b) => a.distance.CompareTo(b.distance));
            foreach (RaycastHit hit in hits)
            {
                if (hit.collider == null || hit.collider.GetComponentInParent<Player>() != null)
                {
                    continue;
                }

                if (Vector3.Distance(player.transform.position + Vector3.up, hit.point) > DeleteReach)
                {
                    return null;
                }

                ZNetView view = hit.collider.GetComponentInParent<ZNetView>();
                if (view == null || !view.IsValid())
                {
                    why = "that is the ground or part of the world";
                    return null;
                }

                return view;
            }

            return null;
        }

        /// <summary>Removes what the crosshair is on within 6 m: a piece, a creature, a trader; never a player.</summary>
        private static void Delete(Player player)
        {
            ZNetView view = Aimed(player, out string why);
            if (view == null)
            {
                Say("Delete: " + why + ".");
                return;
            }

            string name = Utils.GetPrefabName(view.gameObject);
            EditHistory.Snapshot snapshot = EditHistory.Take(view);
            view.ClaimOwnership();
            ZNetScene.instance.Destroy(view.gameObject);
            EditHistory.Push($"deleting {name}", () => EditHistory.Restore(snapshot));
            Say($"Deleted {name}. 8 (Undo) puts it back.");
        }

        /// <summary>
        /// First press: every object with the aimed object's name in its design (or within 20 m, outside a design) glows
        /// orange and a question shows. A second click within 6 seconds, aimed anywhere: all are deleted.
        /// </summary>
        private static void DeleteAll(Player player)
        {
            if (_massArmed != null && Time.time <= _massUntil)
            {
                int deleted = 0;
                var snapshots = new List<EditHistory.Snapshot>();
                foreach (ZNetView view in Marked)
                {
                    if (view != null && view.IsValid())
                    {
                        snapshots.Add(EditHistory.Take(view));
                        view.ClaimOwnership();
                        ZNetScene.instance.Destroy(view.gameObject);
                        deleted++;
                    }
                }

                string name = _massArmed;
                Marked.Clear();
                _massArmed = null;
                EditHistory.Push($"deleting {deleted} {name}", () => snapshots.ForEach(EditHistory.Restore));
                Say($"Deleted {deleted} {name}. 8 (Undo) puts them back.");
                return;
            }

            Disarm();
            ZNetView aimed = Aimed(player, out string why);
            if (aimed == null)
            {
                Say("Delete all: " + why + ".");
                return;
            }

            string prefab = Utils.GetPrefabName(aimed.gameObject);
            string design = SwapTool.DesignOf(aimed.gameObject);
            Vector3 around = aimed.transform.position;
            foreach (ZNetView view in ZNetScene.instance.m_instances.Values)
            {
                if (view == null || !view.IsValid() || view.GetComponent<Player>() != null || Utils.GetPrefabName(view.gameObject) != prefab)
                {
                    continue;
                }

                bool inScope = design.Length > 0
                    ? SwapTool.DesignOf(view.gameObject) == design
                    : Vector3.Distance(view.transform.position, around) <= MassRadius;
                if (inScope)
                {
                    Marked.Add(view);
                    MaterialMan.instance?.SetValue(view.gameObject, Emission, LookAt.Highlight);
                }
            }

            _massArmed = prefab;
            _massUntil = Time.time + 6f;
            string where = design.Length > 0 ? $"in {design}" : $"within {MassRadius:0} m";
            string question = $"Delete all {Marked.Count} {prefab} {where}?\nClick again within 6 seconds.";
            MessageHud.instance?.ShowMessage(MessageHud.MessageType.Center, question);
            Say(question.Replace("\n", " "));
        }

        /// <summary>Lets a Delete all question lapse: the orange goes and nothing is deleted.</summary>
        private static void Disarm()
        {
            foreach (ZNetView view in Marked)
            {
                if (view != null && view.gameObject != null)
                {
                    MaterialMan.instance?.ResetValue(view.gameObject, Emission);
                }
            }

            Marked.Clear();
            _massArmed = null;
        }

        /// <summary>Saves the design aimed at (or the last picked) on the second click within 6 seconds.</summary>
        private static void Save(Player player)
        {
            string design = SwapTool.DesignAimed(player);
            if (string.IsNullOrEmpty(design))
            {
                Say("Save: aim at a gallery design first.");
                return;
            }

            if (_saveArmed == design && Time.time < _saveUntil)
            {
                _saveArmed = null;
                ShowSelection(null, null);
                bool all = Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.RightShift);
                Say(!design.StartsWith("board:") ? BlueprintEdits.Run(new[] { "save", design }) : all ? DesignBoard.SaveAll() : DesignBoard.Save(design));
                return;
            }

            _saveArmed = design;
            _saveUntil = Time.time + 6f;
            _nextSelection = 0f;
            MessageHud.instance?.ShowMessage(MessageHud.MessageType.Center, $"Save {design}?\nClick again within 6 seconds.");
            Say(design.StartsWith("board:")
                ? $"Save {design.Substring(6).Replace(':', '_')}? Click again within 6 seconds; hold Shift on that click to save every plot of the board."
                : $"Save {design}? Click again within 6 seconds to save it as it stands.");
        }

        private static void Say(string text)
        {
            MessageHud.instance?.ShowMessage(MessageHud.MessageType.TopLeft, text);
            Console.instance?.Print(text);
        }
    }
}
