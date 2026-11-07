using System.Collections.Generic;
using System.Linq;
using HarmonyLib;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Shaping: editing gallery designs from the hotbar. With the shaping tool in hand (a vanilla item, the wooden knife by
    /// default: config ShapingTool; 'vh tool' gives one; it glows teal while shaping), hotbar keys 1 to 8 stop using
    /// items and do the editing, each with its own icon and label:
    ///
    /// 1 Swap (also left click): pick the piece aimed at, or use the stand-in aimed at (see SwapTool).
    /// 2 Turn: a quarter turn for the current choice.  3 Undo: the original back.
    /// 4 Move: the player stands still; W A S D move the design (or the picked part) away, left, back, right as the
    ///   player looks, E up and Q down; 10 cm a press, 50 cm with Shift. 4 again ends it.
    /// 5 Part: picks the structure aimed at (green; a hut beside a hall) so Move moves only that; 5 again lets go.
    /// 6 Delete: removes what is aimed at, creatures and traders included (never a player).
    /// 7 Save: saves the design aimed at as it stands (as 'vh bp save'); press twice to confirm.
    /// 8 Delete all: every object with the aimed object's name in that design glows orange; press again within 6
    ///   seconds to delete them all (outside a design: everything of that name within 20 m).
    /// While the rod is in hand, look is on: the aimed object glows orange and its name shows in the middle of the screen.
    ///
    /// Putting the rod away ends Shaping. Nothing needs a restart: the rod is an existing item.
    /// </summary>
    internal static class Shaping
    {
        private const float DeleteReach = 6f;

        private static bool _active;
        private static bool _moving;
        private static string _saveArmed;
        private static float _saveUntil;
        private static bool _lookBefore;
        private static string _massArmed;
        private static float _massUntil;
        private static readonly List<ZNetView> Marked = new List<ZNetView>();
        private static readonly int Emission = Shader.PropertyToID("_EmissionColor");
        private const float MassRadius = 20f;

        private static readonly string[] Labels = { "Swap", "Turn", "Undo", "Move", "Part", "Delete", "Save", "Del all" };
        private static readonly string[] IconSources =
            { "Hammer", "ShieldWood", "Feathers", "ArrowWood", "BoneFragments", "BombOoze", "piece_chest_wood", "BombBile" };

        private static Sprite[] _icons;

        public static bool Active => _active;

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
                   "(1 Swap, 2 Turn, 3 Undo, 4 Move, 5 Part, 6 Delete, 7 Save, 8 Delete all; left click is Swap) and what you aim at glows orange.";
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
                            Say("Shaping on: 1 Swap, 2 Turn, 3 Undo, 4 Move, 5 Part, 6 Delete, 7 Save, 8 Delete all. Left click is Swap.");
                        }
                        else
                        {
                            _moving = false;
                            _saveArmed = null;
                            Disarm();
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

                    if (_active && _moving && !Typing())
                    {
                        MoveKeys(__instance);
                    }
                }
                catch (System.Exception e)
                {
                    VillheimPlugin.Log.LogWarning($"Shaping: {e}");
                }
            }
        }

        private static GameObject _glowItem;
        private static GameObject _glowLight;
        private static readonly Color Teal = new Color(0.1f, 0.85f, 0.75f);

        /// <summary>The tool in hand glows teal while shaping (a soft light and a lit blade), so it reads as the shaping tool.</summary>
        private static void Glow(Player player)
        {
            VisEquipment vis = player.m_visEquipment;
            GameObject item = _active && vis != null ? (vis.m_rightItemInstance != null ? vis.m_rightItemInstance : vis.m_leftItemInstance) : null;
            if (item == _glowItem)
            {
                return;
            }

            if (_glowItem != null)
            {
                MaterialMan.instance?.ResetValue(_glowItem, Emission);
            }

            if (_glowLight != null)
            {
                Object.Destroy(_glowLight);
            }

            _glowItem = item;
            _glowLight = null;
            if (item == null)
            {
                return;
            }

            MaterialMan.instance?.SetValue(item, Emission, Teal * 0.8f);
            _glowLight = new GameObject("VillheimShapingGlow");
            _glowLight.transform.SetParent(item.transform, false);
            Light light = _glowLight.AddComponent<Light>();
            light.type = LightType.Point;
            light.color = Teal;
            light.range = 1.5f;
            light.intensity = 1.2f;
            light.shadows = LightShadows.None;
        }

        // ---------------------------------------------------------------- the tool's name and glow everywhere

        public const string ToolName = "Villheim Dev Shaper Tool";
        private const string ToolDescription =
            "Villheim's design review tool. In hand, hotbar 1 to 8 edit gallery designs: 1 Swap (or left click), 2 Turn, " +
            "3 Undo, 4 Move (W A S D, Q and E), 5 Part, 6 Delete, 7 Save, 8 Delete all. See docs/DESIGN_REVIEW_GUIDE.md.";

        private static string _named;
        private static string _oldName;
        private static string _oldDescription;
        private static float _nextGroundGlow;
        private static readonly Color IconTint = new Color(0.45f, 1f, 0.9f);

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

        /// <summary>A Shaper Tool lying on the ground glows teal too (checked once a second).</summary>
        private static void GlowOnGround()
        {
            if (Time.time < _nextGroundGlow)
            {
                return;
            }

            _nextGroundGlow = Time.time + 1f;
            string want = LogicConfig.ShapingTool?.Value ?? "KnifeWood";
            foreach (ItemDrop drop in ItemDrop.s_instances)
            {
                if (drop == null || Utils.GetPrefabName(drop.gameObject) != want || drop.transform.Find("VillheimShapingGlow") != null)
                {
                    continue;
                }

                MaterialMan.instance?.SetValue(drop.gameObject, Emission, Teal * 0.8f);
                var glow = new GameObject("VillheimShapingGlow");
                glow.transform.SetParent(drop.transform, false);
                Light light = glow.AddComponent<Light>();
                light.type = LightType.Point;
                light.color = Teal;
                light.range = 1.5f;
                light.intensity = 1.2f;
                light.shadows = LightShadows.None;
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
                    Use(__instance, index);
                }
                catch (System.Exception e)
                {
                    VillheimPlugin.Log.LogWarning($"Shaping: {e}");
                }

                return false;
            }
        }

        /// <summary>Left click is Swap; the rod never casts while Shaping.</summary>
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
                        SwapTool.PickOrUse((Player)__instance);
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
                if (_active && _moving && __instance == Player.m_localPlayer)
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
            private static bool Prefix(Player __instance) => !(_active && _moving && __instance == Player.m_localPlayer);
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
                case 3: return _moving ? "Move ON" : "Move";
                case 4: return SwapTool.PartLocked ? "Part ON" : "Part";
                case 6: return _saveArmed != null && Time.time < _saveUntil ? "Save?" : "Save";
                case 7: return _massArmed != null ? "Del all?" : "Del all";
                default: return Labels[i];
            }
        }

        private static bool On(int i) =>
            i == 3 && _moving || i == 4 && SwapTool.PartLocked || i == 6 && _saveArmed != null && Time.time < _saveUntil || i == 7 && _massArmed != null;

        private static void LoadIcons()
        {
            if (_icons != null && _icons[0] != null)
            {
                return;
            }

            _icons = new Sprite[IconSources.Length];
            for (int i = 0; i < IconSources.Length; i++)
            {
                GameObject item = ObjectDB.instance?.GetItemPrefab(IconSources[i]);
                Sprite icon = item?.GetComponent<ItemDrop>()?.m_itemData?.GetIcon();
                if (icon == null)
                {
                    icon = ZNetScene.instance?.GetPrefab(IconSources[i])?.GetComponent<Piece>()?.m_icon;
                }

                _icons[i] = icon;
            }
        }

        private static void Use(Player player, int index)
        {
            switch (index)
            {
                case 1:
                    SwapTool.PickOrUse(player);
                    break;
                case 2:
                    Say(SwapTool.TurnCurrent());
                    break;
                case 3:
                    Say(SwapTool.UndoCurrent());
                    break;
                case 4:
                    _moving = !_moving;
                    Say(_moving
                        ? "Move on: you stand still; W A S D move the design (or the picked part) as you look, E up, Q down, Shift for 50 cm. 4 again to walk."
                        : "Move off.");
                    break;
                case 5:
                    Say(SwapTool.TogglePart(player));
                    break;
                case 6:
                    Delete(player);
                    break;
                case 7:
                    Save(player);
                    break;
                case 8:
                    DeleteAll(player);
                    break;
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
            view.ClaimOwnership();
            ZNetScene.instance.Destroy(view.gameObject);
            Say($"Deleted {name}.");
        }

        /// <summary>
        /// First press: every object with the aimed object's name in its design (or within 20 m, outside a design) glows
        /// orange and a question shows. Second press within 6 seconds, aimed at any of them or anywhere: all are deleted.
        /// </summary>
        private static void DeleteAll(Player player)
        {
            if (_massArmed != null && Time.time <= _massUntil)
            {
                int deleted = 0;
                foreach (ZNetView view in Marked)
                {
                    if (view != null && view.IsValid())
                    {
                        view.ClaimOwnership();
                        ZNetScene.instance.Destroy(view.gameObject);
                        deleted++;
                    }
                }

                string name = _massArmed;
                Marked.Clear();
                _massArmed = null;
                Say($"Deleted {deleted} {name}.");
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
                    MaterialMan.instance?.SetValue(view.gameObject, Emission, new Color(0.9f, 0.45f, 0.05f));
                }
            }

            _massArmed = prefab;
            _massUntil = Time.time + 6f;
            string where = design.Length > 0 ? $"in {design}" : $"within {MassRadius:0} m";
            string question = $"Delete all {Marked.Count} {prefab} {where}?\nPress 8 again within 6 seconds.";
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

        /// <summary>Saves the design aimed at (or the last picked) on the second press within 6 seconds.</summary>
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
            Say($"Save {design}? Press 7 again within 6 seconds to save it as it stands.");
        }

        private static void Say(string text)
        {
            MessageHud.instance?.ShowMessage(MessageHud.MessageType.TopLeft, text);
            Console.instance?.Print(text);
        }
    }
}
