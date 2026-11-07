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
    /// 1 Swap: click a design piece to pick it (stand-ins go up at its sign), click a stand-in or a built piece to use it.
    /// 2 Turn: the mouse wheel turns the object under the crosshair (yaw; Shift tilts on its own X axis, Alt on its Z
    ///   axis; Ctrl turns every object of that name in the design). Click locks onto an object so it can be turned
    ///   while looking elsewhere; click it again to let go.
    /// 3 Undo: each press takes back the newest change. Click does nothing.
    /// 4 Move: the player stands still; W A S D move the design under the crosshair away, left, back, right as the
    ///   player looks, E up and Q down; 10 cm a press, 50 cm with Shift. Click locks onto one structure (green; a hut
    ///   beside a hall) so only that moves; click it again to let go.
    /// 5 Free for now.
    /// 6 Delete: click removes what is aimed at, creatures and traders included (never a player).
    /// 7 Save: click a design to ask; click again within 6 seconds to save it as it stands (as 'vh bp save').
    /// 8 Delete all: click an object and every object of its name in that design glows orange; click again within 6
    ///   seconds to delete them all (outside a design: everything of that name within 20 m).
    /// While the tool is in hand, look is on: the aimed object glows orange and its name shows in the middle of the screen.
    ///
    /// Putting the tool away ends Shaping. Nothing needs a restart: the tool is an existing item.
    /// </summary>
    internal static class Shaping
    {
        private const float DeleteReach = 6f;

        private static bool _active;
        private static int _tool;
        private static ZNetView _locked;
        private static bool Moving => _tool == 4;
        private static string _saveArmed;
        private static float _saveUntil;
        private static bool _lookBefore;
        private static string _massArmed;
        private static float _massUntil;
        private static readonly List<ZNetView> Marked = new List<ZNetView>();
        private static readonly int Emission = Shader.PropertyToID("_EmissionColor");
        private const float MassRadius = 20f;

        private static readonly string[] Labels = { "Swap", "Turn", "Undo", "Move", "", "Delete", "Save", "Del all" };
        private static readonly string[] IconSources =
            { "Hammer", "ShieldWood", "Feathers", "ArrowWood", "", "BombOoze", "piece_chest_wood", "BombBile" };

        private static Sprite[] _icons;

        public static bool Active => _active;

        /// <summary>The object Turn is locked onto (look leaves it in its own colour).</summary>
        public static bool IsLocked(GameObject go) => _locked != null && go != null && _locked.gameObject == go;

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
                   "(1 Swap, 2 Turn, 3 Undo, 4 Move, 6 Delete, 7 Save, 8 Delete all): press a key to pick the tool, left click to use it. What you aim at glows orange.";
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
                            _tool = 1;
                            Say("Shaping on: 1 Swap, 2 Turn, 3 Undo, 4 Move, 6 Delete, 7 Save, 8 Delete all. Press a key to pick the tool, left click to use it. Swap is picked.");
                        }
                        else
                        {
                            PutDown();
                            _tool = 0;
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

                    if (_locked != null && (!_locked.IsValid() || _tool != 2))
                    {
                        Unlock();
                    }

                    if (_active && Moving && !Typing())
                    {
                        MoveKeys(__instance);
                    }

                    _wheelTaken = false;
                    if (_active && _tool == 2 && !Typing())
                    {
                        Wheel(__instance);
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
        private static Color EffectColor => LogicConfig.ShaperColor?.Value ?? new Color(0.1f, 0.85f, 0.75f);

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
            "Villheim's design review tool. In hand, hotbar 1 to 8 pick a tool and left click uses it: 1 Swap, 2 Turn (mouse " +
            "wheel), 3 Undo, 4 Move (W A S D, Q and E), 6 Delete, 7 Save, 8 Delete all. See docs/DESIGN_REVIEW_GUIDE.md.";

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

        /// <summary>Left click uses the picked tool; the knife never attacks while Shaping.</summary>
        [HarmonyPatch(typeof(Humanoid), nameof(Humanoid.StartAttack))]
        internal static class AttackPatch
        {
            private static bool Prefix(Humanoid __instance, bool secondaryAttack, ref bool __result)
            {
                if (!_active || __instance != Player.m_localPlayer)
                {
                    return true;
                }

                __result = false;
                if (!secondaryAttack)
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

        /// <summary>While moving a design the player stands still: W A S D, Q and E move the design instead.</summary>
        [HarmonyPatch(typeof(Player), nameof(Player.SetControls))]
        internal static class StandStillPatch
        {
            private static void Prefix(Player __instance, ref Vector3 movedir, ref bool jump, ref bool crouch, ref bool run, ref bool autoRun, ref bool dodge)
            {
                if (_active && Moving && __instance == Player.m_localPlayer)
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
                case 1: return _locked != null ? "Turn lock" : "Turn";
                case 3: return SwapTool.PartLocked ? "Move part" : "Move";
                case 6: return _saveArmed != null && Time.time < _saveUntil ? "Save?" : "Save";
                case 7: return _massArmed != null ? "Del all?" : "Del all";
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
            "Swap: click a design piece to pick it, then click a stand-in (or a piece you built) to use it.",
            "Turn: the mouse wheel turns what you aim at. Shift tilts it, Alt rolls it, Ctrl turns every one of that name in the design. Click to lock onto it, click it again to let go.",
            "",
            "Move: you stand still. W A S D move the design you aim at, E up, Q down, Shift for 50 cm. Click a structure to move only that (green), click it again to let go. 4 again to walk.",
            "5 is free for now.",
            "Delete: click what you want removed. 3 puts it back.",
            "Save: click a design, then click again within 6 seconds to save it.",
            "Delete all: click an object to mark every one of its name in the design, then click again within 6 seconds.",
        };

        /// <summary>A hotbar key picks its tool; the same key again puts it down. 3 undoes on every press.</summary>
        private static void Select(Player player, int index)
        {
            if (index < 1 || index > 8)
            {
                return;
            }

            if (index == 5)
            {
                Say(Picked[4]);
                return;
            }

            if (index == 3)
            {
                PutDown();
                _tool = 3;
                Say(SwapTool.UndoCurrent());
                return;
            }

            bool same = index == _tool;
            PutDown();
            _tool = same ? 0 : index;
            Say(same ? "Tool put down: clicks do nothing until you pick one (1 to 8)." : Picked[index - 1]);
        }

        /// <summary>Lets go of what the current tool holds: Move's part, Turn's lock, unanswered questions.</summary>
        private static void PutDown()
        {
            if (_tool == 4 && SwapTool.PartLocked)
            {
                SwapTool.TogglePart(null);
            }

            Unlock();
            _saveArmed = null;
            Disarm();
        }

        /// <summary>Left click: the picked tool's action, with the hammer's building swing.</summary>
        private static void Click(Player player)
        {
            switch (_tool)
            {
                case 1:
                    Swing(player);
                    SwapTool.PickOrUse(player);
                    break;
                case 2:
                    Swing(player);
                    LockToggle(player);
                    break;
                case 4:
                    Swing(player);
                    PartToggle(player);
                    break;
                case 6:
                    Swing(player);
                    Delete(player);
                    break;
                case 7:
                    Swing(player);
                    Save(player);
                    break;
                case 8:
                    Swing(player);
                    DeleteAll(player);
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

        /// <summary>Move: click locks onto the structure aimed at; click it again (or another) to let go (or switch).</summary>
        private static void PartToggle(Player player)
        {
            if (SwapTool.PartLocked)
            {
                GameObject aimed = LookAt.Target(player);
                bool same = aimed != null && SwapTool.IsLit(aimed);
                string off = SwapTool.TogglePart(player);
                if (same || aimed == null)
                {
                    Say(off);
                    return;
                }
            }

            Say(SwapTool.TogglePart(player));
        }

        // ---------------------------------------------------------------- Turn: the mouse wheel

        private static bool _wheelTaken;
        private static float _cameraDistance;
        private static float TurnStep => LogicConfig.ShaperTurnStep?.Value ?? 22.5f;

        private static void LockToggle(Player player)
        {
            GameObject aimed = LookAt.Target(player);
            if (_locked != null && (aimed == null || aimed == _locked.gameObject))
            {
                Say($"Turn: let go of {Utils.GetPrefabName(_locked.gameObject)}.");
                Unlock();
                return;
            }

            ZNetView view = aimed != null ? aimed.GetComponent<ZNetView>() : null;
            if (view == null || !view.IsValid() || aimed.GetComponent<Player>() != null)
            {
                Say("Turn: aim at an object within reach first.");
                return;
            }

            Unlock();
            _locked = view;
            LookAt.Refresh();
            MaterialMan.instance?.SetValue(view.gameObject, Emission, EffectColor * 0.6f);
            Say($"Turn: locked onto {Utils.GetPrefabName(view.gameObject)}. The mouse wheel turns it wherever you look; click it again to let go.");
        }

        private static void Unlock()
        {
            if (_locked != null && _locked.gameObject != null)
            {
                MaterialMan.instance?.ResetValue(_locked.gameObject, Emission);
            }

            _locked = null;
        }

        /// <summary>
        /// One wheel notch turns the locked object (or the one aimed at) by ShaperTurnStep: about the up axis, or with
        /// Shift about its own X axis, with Alt about its own Z axis. With Ctrl, every object of that name in its design
        /// turns, each about its own pivot. The camera does not zoom while the wheel turns something.
        /// </summary>
        private static void Wheel(Player player)
        {
            ZNetView target = _locked;
            if (target == null)
            {
                GameObject aimed = LookAt.Target(player);
                target = aimed != null && aimed.GetComponent<Player>() == null ? aimed.GetComponent<ZNetView>() : null;
            }

            if (target == null || !target.IsValid())
            {
                return;
            }

            _wheelTaken = true;
            float scroll = ZInput.GetMouseScrollWheel();
            if (Mathf.Abs(scroll) < 0.001f)
            {
                return;
            }

            float angle = Mathf.Sign(scroll) * TurnStep;
            bool shift = Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.RightShift);
            bool alt = Input.GetKey(KeyCode.LeftAlt) || Input.GetKey(KeyCode.RightAlt);
            bool all = Input.GetKey(KeyCode.LeftControl) || Input.GetKey(KeyCode.RightControl);
            string axis = shift ? "X" : alt ? "Z" : "Y";

            string prefab = Utils.GetPrefabName(target.gameObject);
            string design = target.GetZDO().GetString(Gallery.KeyDesign, "");
            List<ZNetView> views = all && design.Length > 0
                ? ZNetScene.instance.m_instances.Values.Where(v => v != null && v.IsValid() && Utils.GetPrefabName(v.gameObject) == prefab &&
                                                                    v.GetZDO().GetString(Gallery.KeyDesign, "") == design).ToList()
                : new List<ZNetView> { target };

            var before = views.Select(v => (View: v, Rotation: v.transform.rotation)).ToList();
            foreach (ZNetView view in views)
            {
                Quaternion rotation = view.transform.rotation;
                rotation = shift ? rotation * Quaternion.AngleAxis(angle, Vector3.right)
                    : alt ? rotation * Quaternion.AngleAxis(angle, Vector3.forward)
                    : Quaternion.AngleAxis(angle, Vector3.up) * rotation;
                SetRotation(view, rotation);
            }

            string key = $"turn:{(all ? design + "/" + prefab : target.GetInstanceID().ToString())}";
            EditHistory.Push(views.Count > 1 ? $"turning {views.Count} {prefab}" : $"turning {prefab}",
                () => before.ForEach(b => SetRotation(b.View, b.Rotation)), key);
            SwapTool.MarkTouched(design);
            Vector3 euler = target.transform.rotation.eulerAngles;
            MessageHud.instance?.ShowMessage(MessageHud.MessageType.Center,
                $"{prefab}{(views.Count > 1 ? $" (all {views.Count})" : "")}\n{axis} {angle:+0.#;-0.#} : {euler.x:0} {euler.y:0} {euler.z:0}");
        }

        private static void SetRotation(ZNetView view, Quaternion rotation)
        {
            if (view == null || !view.IsValid())
            {
                return;
            }

            view.ClaimOwnership();
            view.transform.rotation = rotation;
            view.GetZDO().SetRotation(rotation);
        }

        /// <summary>The camera keeps its distance while the wheel turns an object.</summary>
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

        private static void MoveKeys(Player player)
        {
            Vector3 forward = GameCamera.instance != null ? GameCamera.instance.transform.forward : player.transform.forward;
            forward.y = 0f;
            forward = forward.sqrMagnitude > 0.01f ? forward.normalized : Vector3.forward;
            Vector3 right = Vector3.Cross(Vector3.up, forward);
            Vector3 move = Vector3.zero;
            if (Input.GetKeyDown(KeyCode.W)) move = forward;
            else if (Input.GetKeyDown(KeyCode.S)) move = -forward;
            else if (Input.GetKeyDown(KeyCode.D)) move = right;
            else if (Input.GetKeyDown(KeyCode.A)) move = -right;
            else if (Input.GetKeyDown(KeyCode.E)) move = Vector3.up;
            else if (Input.GetKeyDown(KeyCode.Q)) move = Vector3.down;
            if (move == Vector3.zero)
            {
                return;
            }

            float step = Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.RightShift) ? 0.5f : 0.1f;
            SwapTool.MoveBy(player, move * step);
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
            Say($"Deleted {name}. 3 (Undo) puts it back.");
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
                Say($"Deleted {deleted} {name}. 3 (Undo) puts them back.");
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
            string design = aimed.GetZDO().GetString(Gallery.KeyDesign, "");
            Vector3 around = aimed.transform.position;
            foreach (ZNetView view in ZNetScene.instance.m_instances.Values)
            {
                if (view == null || !view.IsValid() || view.GetComponent<Player>() != null || Utils.GetPrefabName(view.gameObject) != prefab)
                {
                    continue;
                }

                bool inScope = design.Length > 0
                    ? view.GetZDO().GetString(Gallery.KeyDesign, "") == design
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
                Say(BlueprintEdits.Run(new[] { "save", design }));
                return;
            }

            _saveArmed = design;
            _saveUntil = Time.time + 6f;
            Say($"Save {design}? Click again within 6 seconds to save it as it stands.");
        }

        private static void Say(string text)
        {
            MessageHud.instance?.ShowMessage(MessageHud.MessageType.TopLeft, text);
            Console.instance?.Print(text);
        }
    }
}
