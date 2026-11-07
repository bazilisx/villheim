using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using HarmonyLib;
using UnityEngine;
using Villheim.Logic.Designs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// 'vh swap': change a gallery design piece by piece, by hand.
    ///
    /// Gallery pages go up as the designs were built. With swap on, aim at a piece of a design and press the swap key
    /// (numpad 5 by default): in front of that design's sign go up the likeliest stand-ins for that kind of piece,
    /// in groups by biome (GallerySwapBiomes: Meadows, Black Forest, Swamp), each group behind a label sign. Aim at one
    /// (or at any piece built by hand) and press the key again: every piece of that kind in that one design changes to
    /// it, nothing anywhere else. Pick another stand-in to compare; the last one stays. Nothing is kept until the design
    /// is saved ('vh bp save &lt;number&gt;' or 'vh bp save page'): putting a page up again without saving shows the
    /// originals (Tyler, 2026-11-07). A piece built by hand brings the hand-built pieces touching it along: two fences
    /// side by side become one stand-in for a wall twice their width, centred where the wall stood (see Capture). The
    /// stand-ins also offer combinations where the names give sizes: two stone_wall_2x1 stacked for a 2x2 wall (see
    /// MaterialSwap.Combos). It is
    /// up again. 'vh swap turn' gives the current choice a quarter turn, 'vh swap undo' puts the original back,
    /// 'vh swap done' takes the stand-ins away, 'vh swap off' ends it. 'vh bp save &lt;number&gt;' writes the design with
    /// its choices as a new blueprint.
    ///
    /// 'vh note &lt;text&gt;' writes a note to BepInEx/Villheim/notes.txt with what the crosshair is on and the nearest
    /// gallery sign.
    /// </summary>
    internal static class SwapTool
    {
        private static readonly int KeyPalette = "villheim_swap_palette".GetStableHashCode();

        /// <summary>On each piece of a combination in the stand-in row: the whole combination, so a click on any of them takes all.</summary>
        private const string KeyCombo = "villheim_swap_combo";
        private const int CombosPerBiome = 2;
        private const int PerBiome = 4;

        private static bool _on;
        private static string _design;

        /// <summary>A structure picked with Shaping's Part key stays picked (and green) until Part is pressed again.</summary>
        private static bool _partLocked;

        // ---------------------------------------------------------------- for Shaping (the rod's hotbar)

        public static bool PartLocked => _partLocked;

        /// <summary>The object is in the green structure (look leaves it green).</summary>
        public static bool IsLit(GameObject go) => Lit.Exists(v => v != null && v.gameObject == go);

        /// <summary>
        /// The Shaper Tool in hand. It no longer turns on 'vh swap' mode: that mode's numpad keys (nudging, numpad 5) stay
        /// free for other mods (ComfyGizmo's numpad + and -) while shaping and after; the knife has its own keys.
        /// </summary>
        public static void Activate()
        {
        }

        /// <summary>The connected structure an object belongs to (it and everything of its design touching it).</summary>
        public static List<ZNetView> StructureOf(GameObject start) => start != null ? Structure(start) : new List<ZNetView>();

        public static void PickOrUse(Player player) => Press(player);

        public static string TurnCurrent() => Turn();

        public static string UndoCurrent() => Undo();

        /// <summary>Moves the locked structure if there is one, else the design under the crosshair (or the last picked).</summary>
        public static void MoveBy(Player player, Vector3 move, string design = null)
        {
            if (_partLocked && Lit.Count > 0)
            {
                NudgePart(move);
            }
            else
            {
                Nudge(player, move, string.IsNullOrEmpty(design) ? null : design);
            }
        }

        /// <summary>A held move key: its steps add up to one undo step (a new press starts a new one).</summary>
        private sealed class MoveRun
        {
            public Vector3 Total;
        }

        private static int _moveRun;
        private static MoveRun _run;
        private static float _nextMoveSay;

        public static void NewMoveRun() => _moveRun++;

        /// <summary>Adds a step to the current run, or starts one with its own undo (back(total) takes the whole run back).</summary>
        private static void RecordMove(string what, Vector3 move, System.Action<Vector3> back)
        {
            string key = $"move:{what}:{_moveRun}";
            if (_run != null && EditHistory.LastKey == key)
            {
                _run.Total += move;
                return;
            }

            var run = new MoveRun { Total = move };
            _run = run;
            EditHistory.Push($"moving {what}", () => back(run.Total), key);
        }

        private static void SayMove(string text)
        {
            if (Time.time >= _nextMoveSay)
            {
                _nextMoveSay = Time.time + 0.5f;
                Say(text);
            }
        }

        /// <summary>Locks onto the structure under the crosshair (green), or lets it go.</summary>
        public static string TogglePart(Player player)
        {
            if (_partLocked)
            {
                _partLocked = false;
                ClearLight();
                return "Part off: Move moves the whole design again.";
            }

            _litFor = null;
            _nextLight = 0f;
            Highlight(player, true);
            if (Lit.Count == 0)
            {
                return "Part: aim at a piece of a gallery design first.";
            }

            _partLocked = true;
            return $"Part on: {Lit.Count} pieces picked (green). Move moves only these until Part is pressed again.";
        }

        /// <summary>
        /// Whether a world object standing on a plot (not one of the gallery's own) is part of what is there: building
        /// pieces, furniture, props, trees, bushes, pickables, ships. Not creatures, players, loose items, gravestones or the
        /// game's terrain records. (Pieces only, before 2026-11-07: tables, trees and location props were left behind.)
        /// </summary>
        public static bool PartOfPlot(ZNetView view) =>
            view.GetComponent<Character>() == null && view.GetComponent<ItemDrop>() == null && view.GetComponent<TerrainComp>() == null &&
            view.GetComponent<TerrainModifier>() == null && view.GetComponent<TombStone>() == null && view.GetComponent<Projectile>() == null;

        /// <summary>
        /// The design an object belongs to: its design name, or for a piece with none (placed on the slotting board with
        /// PlanBuild or the hammer) the board plot it stands in. "" for neither.
        /// </summary>
        public static string DesignOf(GameObject go)
        {
            if (go == null)
            {
                return "";
            }

            string design = go.GetComponent<ZNetView>()?.GetZDO()?.GetString(Gallery.KeyDesign, "") ?? "";
            return design.Length > 0 ? design : DesignBoard.PlotAt(go.transform.position) ?? "";
        }

        /// <summary>The design under the crosshair, or the last one picked.</summary>
        public static string DesignAimed(Player player)
        {
            GameObject target = LookAt.Target(player);
            string design = target?.GetComponent<ZNetView>()?.GetZDO()?.GetString(Gallery.KeyDesign, "") ?? "";
            if (design.Length == 0)
            {
                // Pieces placed on the slotting board (PlanBuild, the hammer) carry no design name: the plot they stand in.
                design = DesignBoard.PlotAt(target != null ? target.transform.position : player.transform.position) ?? "";
            }

            return design.Length > 0 ? design : _design;
        }

        /// <summary>Ends picking and part locks (Shaping put away).</summary>
        public static void Release()
        {
            _partLocked = false;
            ClearLight();
        }
        private static string _original;
        private static float _turn;
        private static string _current;
        private static readonly List<ZNetView> Palette = new List<ZNetView>();

        // design -> original -> (replacement, turn)
        private static readonly Dictionary<string, Dictionary<string, (string Prefab, float Turn)>> Choices =
            new Dictionary<string, Dictionary<string, (string, float)>>();

        public static string ChoicesPath => Path.Combine(BepInEx.Paths.BepInExRootPath, "Villheim", "design-swaps.txt");
        public static string NotesPath => Path.Combine(BepInEx.Paths.BepInExRootPath, "Villheim", "notes.txt");

        public static string Run(string[] args)
        {
            switch (args.Length > 0 ? args[0].ToLowerInvariant() : "")
            {
                case "off":
                    _on = false;
                    Done();
                    return "Villheim: swap is off.";
                case "done":
                case "cancel":
                    Done();
                    return "Villheim: stand-ins taken away.";
                case "turn":
                    return Turn();
                case "undo":
                    return Undo();
            }

            _on = true;
            string key = LogicConfig.GallerySwapKey?.Value.ToString() ?? "Keypad5";
            return $"Villheim: swap is on. Aim at a piece of a gallery design and press {key}: stand-ins go up in front of its sign, by biome. " +
                   $"Aim at one (or a piece you built) and press {key} again to use it in that design. Numpad + and - move the design you aim at up and down, " +
                   "numpad 8 2 4 6 move it around (Shift: bigger steps; hold Ctrl to move only the structure you aim at, shown green). " +
                   "Nothing is kept until 'vh bp save'. 'vh swap turn', 'vh swap undo', 'vh swap done', 'vh swap off'.";
        }

        [HarmonyPatch(typeof(Player), "Update")]
        internal static class UpdatePatch
        {
            private static void Postfix(Player __instance)
            {
                if (!_on || __instance != Player.m_localPlayer || LogicConfig.GallerySwapKey == null)
                {
                    return;
                }

                try
                {
                    if (Console.IsVisible() || Menu.IsVisible() || InventoryGui.IsVisible() || Chat.instance != null && Chat.instance.HasFocus())
                    {
                        return;
                    }

                    bool part = Input.GetKey(KeyCode.LeftControl) || Input.GetKey(KeyCode.RightControl);
                    if (!_partLocked && !Shaping.Active)
                    {
                        Highlight(__instance, part);
                    }

                    if (Shaping.Active)
                    {
                        return; // the knife has its own keys
                    }

                    if (LogicConfig.GallerySwapKey.Value.IsDown())
                    {
                        Press(__instance);
                    }
                    else
                    {
                        NudgeKeys(__instance, part);
                    }
                }
                catch (System.Exception e)
                {
                    VillheimPlugin.Log.LogWarning($"Swap: {e}");
                }
            }
        }

        private static void Press(Player player)
        {
            GameObject target = LookAt.Target(player);
            if (target == null)
            {
                Say("Swap: nothing within reach under the crosshair.");
                return;
            }

            string prefab = Utils.GetPrefabName(target);
            ZDO zdo = target.GetComponent<ZNetView>()?.GetZDO();
            string design = zdo?.GetString(Gallery.KeyDesign, "") ?? "";
            bool palette = zdo != null && zdo.GetInt(KeyPalette) == 1;

            // A piece of a design: pick it (or the original it stands in for).
            if (design.Length > 0 && !palette && target.GetComponent<Sign>() == null)
            {
                string from = zdo.GetString(Gallery.KeySwappedFrom, "");
                _design = design;
                _original = from.Length > 0 ? from : prefab;
                _current = from.Length > 0 ? prefab : null;
                _turn = Choice(design, _original)?.Turn ?? 0f;
                string shown = SpawnPalette(design, _original);
                Say($"Swap: {_original} in {design}{(from.Length > 0 ? $" (now {prefab})" : "")}. Stand-ins at its sign: {shown}. " +
                    "Aim at one, or a piece you built, and press the key again.");
                return;
            }

            // Anything else (a stand-in, or a piece built by hand): use it for the picked piece.
            if (_original == null)
            {
                Say("Swap: first pick a piece of a gallery design.");
                return;
            }

            string previous = _current;
            float previousTurn = _turn;
            string undoDesign = _design;
            string undoOriginal = _original;
            string combo = palette ? zdo.GetString(KeyCombo, "") : "";
            bool capped = false;
            int members = 1;
            string replacement = combo.Length > 0 ? combo : Capture(target, out members, out capped);
            if (combo.Length > 0)
            {
                members = Members(combo).Count;
            }

            int replaced = Replace(_design, _original, replacement, _turn);
            _current = replacement;
            SetChoice(_design, _original, replacement, _turn);
            EditHistory.Push($"swapping {undoOriginal} in {undoDesign}", () => Restore(undoDesign, undoOriginal, previous, previousTurn));
            string what = members > 1 ? $"a group of {members} pieces ({Describe(replacement)})" : prefab;
            Say($"Swap: {_original} is now {what} in {_design} ({replaced} replaced). " +
                (capped ? $"Only the first {MaxGroup} touching pieces were taken; build the group away from other pieces. " : "") +
                "Pick another to compare, 'vh swap turn' to turn it, 'vh swap undo' to put the original back.");
        }

        // ---------------------------------------------------------------- nudging a whole design

        /// <summary>
        /// Numpad + / - move the design under the crosshair (or the last one picked) up or down; numpad 8, 2, 4, 6 move it
        /// away, towards, left and right, as the player looks (Page Up/Down and the arrow keys do the same). 10 cm a
        /// press, 50 cm with Shift. Its stand-ins and anything built by hand on its plot move with it; the height change
        /// is saved with the design ('vh bp save'). With Ctrl held, only the structure under the crosshair moves: the
        /// piece and every piece of the design touching it, and those touching them (a hut beside the hall), shown green.
        /// </summary>
        private static void NudgeKeys(Player player, bool part)
        {
            Vector3 forward = GameCamera.instance != null ? GameCamera.instance.transform.forward : player.transform.forward;
            forward.y = 0f;
            forward = forward.sqrMagnitude > 0.01f ? forward.normalized : Vector3.forward;
            Vector3 right = Vector3.Cross(Vector3.up, forward);
            Vector3 move = Vector3.zero;
            if (Input.GetKeyDown(KeyCode.KeypadPlus) || Input.GetKeyDown(KeyCode.PageUp)) move = Vector3.up;
            else if (Input.GetKeyDown(KeyCode.KeypadMinus) || Input.GetKeyDown(KeyCode.PageDown)) move = Vector3.down;
            else if (Input.GetKeyDown(KeyCode.Keypad8) || Input.GetKeyDown(KeyCode.UpArrow)) move = forward;
            else if (Input.GetKeyDown(KeyCode.Keypad2) || Input.GetKeyDown(KeyCode.DownArrow)) move = -forward;
            else if (Input.GetKeyDown(KeyCode.Keypad6) || Input.GetKeyDown(KeyCode.RightArrow)) move = right;
            else if (Input.GetKeyDown(KeyCode.Keypad4) || Input.GetKeyDown(KeyCode.LeftArrow)) move = -right;
            if (move == Vector3.zero)
            {
                return;
            }

            float step = Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.RightShift) ? 0.5f : 0.1f;
            if (part)
            {
                NudgePart(move * step);
            }
            else
            {
                Nudge(player, move * step);
            }
        }

        // ---------------------------------------------------------------- one structure of a design (Ctrl)

        private static readonly int Emission = Shader.PropertyToID("_EmissionColor");
        private static readonly List<ZNetView> Lit = new List<ZNetView>();
        private static GameObject _litFor;
        private static float _nextLight;

        /// <summary>While Ctrl is held: the structure under the crosshair, tinted green; let go and the tint goes.</summary>
        private static void Highlight(Player player, bool part)
        {
            if (!part)
            {
                if (Lit.Count > 0)
                {
                    ClearLight();
                }

                return;
            }

            if (Time.time < _nextLight)
            {
                return;
            }

            _nextLight = Time.time + 0.2f;
            GameObject target = LookAt.Target(player);
            ZDO zdo = target?.GetComponent<ZNetView>()?.GetZDO();
            string design = DesignOf(target);
            if (target == null || target == _litFor || zdo == null || design.Length == 0 || zdo.GetFloat(Gallery.KeyPlotHalf, 0f) > 0f)
            {
                return;
            }

            ClearLight();
            _litFor = target;
            Lit.AddRange(Structure(target));
            foreach (ZNetView view in Lit)
            {
                MaterialMan.instance?.SetValue(view.gameObject, Emission, LookAt.Highlight);
            }

            Say($"Swap: {Lit.Count} pieces of {design} selected; the numpad moves only these while Ctrl is held.");
        }

        private static void ClearLight()
        {
            foreach (ZNetView view in Lit)
            {
                if (view != null && view.gameObject != null)
                {
                    MaterialMan.instance?.ResetValue(view.gameObject, Emission);
                }
            }

            Lit.Clear();
            _litFor = null;
        }

        /// <summary>
        /// The piece and every piece of its design touching it, and those touching them: one building of a design that
        /// holds several (a hut beside a hall). Hand-built pieces on the plot count as the design's.
        /// </summary>
        private static List<ZNetView> Structure(GameObject start)
        {
            ZNetView first = start.GetComponent<ZNetView>();
            string design = DesignOf(start);
            ZDO sign = null;
            var pieces = new List<(ZNetView View, Bounds Bounds)>();
            foreach (ZNetView view in ZNetScene.instance.m_instances.Values)
            {
                ZDO zdo = view != null && view.IsValid() ? view.GetZDO() : null;
                if (zdo != null && zdo.GetString(Gallery.KeyDesign, "") == design && zdo.GetFloat(Gallery.KeyPlotHalf, 0f) > 0f)
                {
                    sign = zdo;
                }
            }

            Vector3 center = sign?.GetVec3(Gallery.KeyPlotCenter, Vector3.zero) ?? start.transform.position;
            float half = sign?.GetFloat(Gallery.KeyPlotHalf, 0f) ?? 0f;
            Quaternion frame = Quaternion.Inverse(Quaternion.Euler(0f, sign?.GetFloat(Gallery.KeyPlotYaw, 0f) ?? 0f, 0f));
            foreach (ZNetView view in ZNetScene.instance.m_instances.Values)
            {
                ZDO zdo = view != null && view.IsValid() ? view.GetZDO() : null;
                if (zdo == null || zdo.GetInt(KeyPalette) == 1)
                {
                    continue;
                }

                bool gallery = zdo.GetInt(Gallery.KeyGallery) == 1;
                bool ours = gallery && zdo.GetString(Gallery.KeyDesign, "") == design && zdo.GetFloat(Gallery.KeyPlotHalf, 0f) <= 0f;
                Vector3 local = frame * (view.transform.position - center);
                bool byHand = !gallery && PartOfPlot(view) && Mathf.Abs(local.x) <= half && Mathf.Abs(local.z) <= half;
                Bounds? bounds = (ours || byHand) ? WorldBounds(view.gameObject) : null;
                if (bounds.HasValue)
                {
                    pieces.Add((view, bounds.Value));
                }
            }

            // Pieces by 2 m grid square, so each piece only checks its neighbours.
            var grid = new Dictionary<(int, int, int), List<int>>();
            (int, int, int) Cell(Vector3 p) => (Mathf.FloorToInt(p.x / 2f), Mathf.FloorToInt(p.y / 2f), Mathf.FloorToInt(p.z / 2f));
            for (int i = 0; i < pieces.Count; i++)
            {
                Bounds b = pieces[i].Bounds;
                var lo = Cell(b.min - Vector3.one * 0.1f);
                var hi = Cell(b.max + Vector3.one * 0.1f);
                for (int x = lo.Item1; x <= hi.Item1; x++)
                for (int y = lo.Item2; y <= hi.Item2; y++)
                for (int z = lo.Item3; z <= hi.Item3; z++)
                {
                    if (!grid.TryGetValue((x, y, z), out List<int> list))
                    {
                        list = new List<int>();
                        grid[(x, y, z)] = list;
                    }

                    list.Add(i);
                }
            }

            int startIndex = pieces.FindIndex(p => p.View == first);
            if (startIndex < 0)
            {
                return new List<ZNetView> { first };
            }

            var taken = new HashSet<int> { startIndex };
            var queue = new Queue<int>();
            queue.Enqueue(startIndex);
            while (queue.Count > 0)
            {
                int i = queue.Dequeue();
                Bounds reach = pieces[i].Bounds;
                reach.Expand(0.1f);
                var lo = Cell(reach.min);
                var hi = Cell(reach.max);
                for (int x = lo.Item1; x <= hi.Item1; x++)
                for (int y = lo.Item2; y <= hi.Item2; y++)
                for (int z = lo.Item3; z <= hi.Item3; z++)
                {
                    if (!grid.TryGetValue((x, y, z), out List<int> list))
                    {
                        continue;
                    }

                    foreach (int j in list)
                    {
                        if (!taken.Contains(j) && reach.Intersects(pieces[j].Bounds))
                        {
                            taken.Add(j);
                            queue.Enqueue(j);
                        }
                    }
                }
            }

            return taken.Select(i => pieces[i].View).ToList();
        }

        private static void NudgePart(Vector3 move)
        {
            if (Lit.Count == 0)
            {
                Say("Swap: hold Ctrl and aim at a structure of a design first (it turns green).");
                return;
            }

            var moved = Lit.Where(v => v != null && v.IsValid()).ToList();
            MoveViews(moved, move);
            RecordMove($"{moved.Count} pieces", move, total => MoveViews(moved, -total));
            MarkTouched(DesignOf(Lit.FirstOrDefault(v => v != null && v.IsValid())?.gameObject));
            SayMove($"Moved {Lit.Count} pieces. Save keeps it.");
        }

        /// <summary>
        /// A design's front sign and everything that is the design now: its gallery pieces (stand-ins swapped in
        /// included) and pieces built by hand on its plot. Signs and the stand-in palette are left out. Null sign: the
        /// design is not standing near.
        /// </summary>
        public static (ZDO Sign, List<ZNetView> Views) DesignParts(string design)
        {
            var views = new List<ZNetView>();
            if (string.IsNullOrEmpty(design) || ZNetScene.instance == null)
            {
                return (null, views);
            }

            ZDO sign = null;
            foreach (ZNetView view in ZNetScene.instance.m_instances.Values)
            {
                ZDO zdo = view != null && view.IsValid() ? view.GetZDO() : null;
                if (zdo != null && zdo.GetString(Gallery.KeyDesign, "") == design && zdo.GetFloat(Gallery.KeyPlotHalf, 0f) > 0f)
                {
                    sign = zdo;
                    break;
                }
            }

            if (sign == null)
            {
                return (null, views);
            }

            Vector3 center = sign.GetVec3(Gallery.KeyPlotCenter, Vector3.zero);
            float half = sign.GetFloat(Gallery.KeyPlotHalf, 0f);
            Quaternion frame = Quaternion.Inverse(Quaternion.Euler(0f, sign.GetFloat(Gallery.KeyPlotYaw, 0f), 0f));
            foreach (ZNetView view in ZNetScene.instance.m_instances.Values)
            {
                ZDO zdo = view != null && view.IsValid() ? view.GetZDO() : null;
                if (zdo == null || zdo.GetInt(KeyPalette) == 1)
                {
                    continue;
                }

                bool gallery = zdo.GetInt(Gallery.KeyGallery) == 1;
                bool ours = gallery && zdo.GetString(Gallery.KeyDesign, "") == design && zdo.GetFloat(Gallery.KeyPlotHalf, 0f) <= 0f;
                Vector3 local = frame * (view.transform.position - center);
                bool byHand = !gallery && PartOfPlot(view) && Mathf.Abs(local.x) <= half && Mathf.Abs(local.z) <= half;
                if (ours || byHand)
                {
                    views.Add(view);
                }
            }

            return (sign, views);
        }

        /// <summary>Forgets the swap choices made for a design (it was reset to its original).</summary>
        public static void ForgetChoices(string design)
        {
            Choices.Remove(design);
            if (_design == design)
            {
                _original = null;
                _current = null;
            }
        }

        /// <summary>Marks a design as changed by hand, so 'vh bp save page' saves it.</summary>
        public static void MarkTouched(string design)
        {
            if (string.IsNullOrEmpty(design))
            {
                return;
            }

            foreach (ZNetView view in ZNetScene.instance.m_instances.Values)
            {
                ZDO zdo = view != null && view.IsValid() ? view.GetZDO() : null;
                if (zdo != null && zdo.GetString(Gallery.KeyDesign, "") == design && zdo.GetFloat(Gallery.KeyPlotHalf, 0f) > 0f)
                {
                    zdo.Set(Gallery.KeyTouched, 1);
                }
            }
        }

        /// <summary>Moves the given objects (and the middles their stand-ins remember).</summary>
        private static void MoveViews(List<ZNetView> views, Vector3 move)
        {
            foreach (ZNetView view in views)
            {
                if (view == null || !view.IsValid())
                {
                    continue;
                }

                ZDO zdo = view.GetZDO();
                view.transform.position += move;
                zdo.SetPosition(view.transform.position);
                if (zdo.GetString(Gallery.KeySwappedFrom, "").Length > 0)
                {
                    zdo.Set(Gallery.KeySwappedCenter, zdo.GetVec3(Gallery.KeySwappedCenter, view.transform.position) + move);
                }
            }
        }

        private static void Nudge(Player player, Vector3 move, string forced = null, bool record = true)
        {
            GameObject target = player != null ? LookAt.Target(player) : null;
            string design = forced ?? DesignOf(target);
            if (design.Length == 0)
            {
                design = _design;
            }

            (ZDO sign, List<ZNetView> views) = DesignParts(design);
            if (sign == null)
            {
                Say("Swap: aim at a gallery design to move it (or pick one first).");
                return;
            }

            Quaternion frame = Quaternion.Inverse(Quaternion.Euler(0f, sign.GetFloat(Gallery.KeyPlotYaw, 0f), 0f));
            MoveViews(views, move);
            int moved = views.Count;

            if (record)
            {
                string movedDesign = design;
                RecordMove(design, move, total => Nudge(null, -total, movedDesign, false));
            }

            Vector3 nudge = sign.GetVec3(Gallery.KeyNudge, Vector3.zero) + frame * move;
            sign.Set(Gallery.KeyNudge, nudge);
            float height = sign.GetFloat(Gallery.KeyGroundOffset, 0f) + nudge.y;
            if (record)
            {
                SayMove($"Moved {design} ({moved} pieces); height {height:+0.00;-0.00;0.00} m from where it was set down. Save keeps it.");
            }
        }

        private static string Turn()
        {
            if (_original == null || _current == null)
            {
                return "Villheim: pick a piece and a stand-in first.";
            }

            float before = _turn;
            string turnDesign = _design;
            string turnOriginal = _original;
            string turned = _current;
            EditHistory.Push($"turning {turned}", () => Restore(turnDesign, turnOriginal, turned, before));
            _turn = (_turn + 90f) % 360f;
            int replaced = Replace(_design, _original, _current, _turn);
            SetChoice(_design, _original, _current, _turn);
            return $"Villheim: {Describe(_current)} in {_design} turned to {_turn:0} degrees ({replaced} replaced).";
        }

        /// <summary>Puts a design's piece back to an earlier choice (null: the original), for undo.</summary>
        private static void Restore(string design, string original, string replacement, float turn)
        {
            Replace(design, original, replacement ?? original, replacement == null ? 0f : turn);
            if (replacement == null)
            {
                RemoveChoice(design, original);
            }
            else
            {
                SetChoice(design, original, replacement, turn);
            }

            if (design == _design && original == _original)
            {
                _current = replacement;
                _turn = replacement == null ? 0f : turn;
            }
        }

        private static string Undo() => EditHistory.Undo();

        /// <summary>
        /// Replaces every piece of one kind in one design (the original itself, or the stand-in pieces for it) with
        /// <paramref name="replacement"/> (a piece or a group, see Members), middle on middle, turned as the original was
        /// plus <paramref name="turn"/>. Putting the original back is a replacement by itself. Returns how many originals.
        /// </summary>
        private static int Replace(string design, string original, string replacement, float turn)
        {
            bool back = replacement == original;
            var instances = new Dictionary<string, (Vector3 Center, Quaternion Rotation)>();
            var doomed = new List<ZNetView>();
            foreach (ZNetView view in ZNetScene.instance.m_instances.Values.ToList())
            {
                ZDO zdo = view != null && view.IsValid() ? view.GetZDO() : null;
                if (zdo == null || zdo.GetInt(Gallery.KeyGallery) != 1 || zdo.GetInt(KeyPalette) == 1 || zdo.GetString(Gallery.KeyDesign, "") != design)
                {
                    continue;
                }

                string shown = Utils.GetPrefabName(view.gameObject);
                string from = zdo.GetString(Gallery.KeySwappedFrom, "");
                if (from != original && !(from.Length == 0 && shown == original))
                {
                    continue;
                }

                // One original may stand as several pieces (a group): they share its middle, so count it once.
                Transform t = view.transform;
                Vector3 ownMiddle = t.position + t.rotation * MaterialSwap.LocalCenter(shown);
                Vector3 center = from.Length > 0 ? zdo.GetVec3(Gallery.KeySwappedCenter, ownMiddle) : ownMiddle;
                Quaternion rotation = from.Length > 0 ? zdo.GetQuaternion(Gallery.KeySwappedRotation, t.rotation) : t.rotation;
                string key = $"{Mathf.Round(center.x * 10f)},{Mathf.Round(center.y * 10f)},{Mathf.Round(center.z * 10f)}";
                if (!instances.ContainsKey(key))
                {
                    instances[key] = (center, rotation);
                }

                doomed.Add(view);
            }

            foreach ((Vector3 center, Quaternion rotation) in instances.Values)
            {
                if (back)
                {
                    GameObject prefab = ZNetScene.instance.GetPrefab(original);
                    if (prefab != null)
                    {
                        GameObject made = Object.Instantiate(prefab, center - rotation * MaterialSwap.LocalCenter(original), rotation);
                        ZDO madeZdo = made.GetComponent<ZNetView>()?.GetZDO();
                        madeZdo?.Set(Gallery.KeyGallery, 1);
                        madeZdo?.Set(Gallery.KeyDesign, design);
                    }

                    continue;
                }

                foreach ((string name, Vector3 position, Quaternion pieceRotation) in Expand(center, rotation, replacement, turn))
                {
                    GameObject prefab = ZNetScene.instance.GetPrefab(name);
                    if (prefab == null)
                    {
                        continue;
                    }

                    GameObject made = Object.Instantiate(prefab, position, pieceRotation);
                    ZDO madeZdo = made.GetComponent<ZNetView>()?.GetZDO();
                    if (madeZdo != null)
                    {
                        madeZdo.Set(Gallery.KeyGallery, 1);
                        madeZdo.Set(Gallery.KeyDesign, design);
                        madeZdo.Set(Gallery.KeySwappedFrom, original);
                        madeZdo.Set(Gallery.KeySwappedRotation, rotation);
                        madeZdo.Set(Gallery.KeySwappedCenter, center);
                    }
                }
            }

            foreach (ZNetView view in doomed)
            {
                view.ClaimOwnership();
                ZNetScene.instance.Destroy(view.gameObject);
            }

            return instances.Count;
        }

        // ---------------------------------------------------------------- stand-ins: one piece or a group

        private const int MaxGroup = 20;

        /// <summary>
        /// The stand-in a press on <paramref name="target"/> means. A stand-in from the row, or anything of the gallery:
        /// that one piece. A piece built by hand: it and every hand-built piece touching it, and those touching them, up
        /// to <see cref="MaxGroup"/>, as a group (two fences side by side for a wall twice as wide). The group is kept
        /// relative to its middle and to the clicked piece's turn: "group[prefab@x,y,z,qx,qy,qz,qw;...]".
        /// </summary>
        private static string Capture(GameObject target, out int members, out bool capped)
        {
            members = 1;
            capped = false;
            string name = Utils.GetPrefabName(target);
            Piece clicked = target.GetComponent<Piece>();
            ZDO zdo = target.GetComponent<ZNetView>()?.GetZDO();
            if (clicked == null || zdo == null || zdo.GetInt(Gallery.KeyGallery) == 1)
            {
                return name;
            }

            var nearby = new List<Piece>();
            Piece.GetAllPiecesInRadius(target.transform.position, 12f, nearby);
            var bounds = new Dictionary<Piece, Bounds>();
            foreach (Piece piece in nearby)
            {
                ZDO pieceZdo = piece != null ? piece.GetComponent<ZNetView>()?.GetZDO() : null;
                if (pieceZdo != null && pieceZdo.GetInt(Gallery.KeyGallery) != 1 && piece.GetComponent<VillageHearth>() == null)
                {
                    Bounds? b = WorldBounds(piece.gameObject);
                    if (b.HasValue)
                    {
                        bounds[piece] = b.Value;
                    }
                }
            }

            if (!bounds.ContainsKey(clicked))
            {
                return name;
            }

            var group = new List<Piece> { clicked };
            for (int i = 0; i < group.Count && group.Count < MaxGroup; i++)
            {
                Bounds reach = bounds[group[i]];
                reach.Expand(0.15f);
                foreach (KeyValuePair<Piece, Bounds> other in bounds)
                {
                    if (!group.Contains(other.Key) && reach.Intersects(other.Value))
                    {
                        group.Add(other.Key);
                        if (group.Count >= MaxGroup)
                        {
                            capped = true;
                            break;
                        }
                    }
                }
            }

            members = group.Count;
            if (group.Count == 1)
            {
                return name;
            }

            Bounds all = bounds[group[0]];
            foreach (Piece piece in group)
            {
                all.Encapsulate(bounds[piece]);
            }

            Quaternion frame = Quaternion.Inverse(clicked.transform.rotation);
            CultureInfo inv = CultureInfo.InvariantCulture;
            string Num(float v) => v.ToString("0.####", inv);
            return "group[" + string.Join(";", group.Select(p =>
            {
                Vector3 at = frame * (p.transform.position - all.center);
                Quaternion turn = frame * p.transform.rotation;
                return $"{Utils.GetPrefabName(p.gameObject)}@{Num(at.x)},{Num(at.y)},{Num(at.z)},{Num(turn.x)},{Num(turn.y)},{Num(turn.z)},{Num(turn.w)}";
            })) + "]";
        }

        private static Bounds? WorldBounds(GameObject go)
        {
            Bounds? total = null;
            foreach (Collider collider in go.GetComponentsInChildren<Collider>())
            {
                if (collider == null || collider.isTrigger || !collider.enabled)
                {
                    continue;
                }

                if (total.HasValue)
                {
                    Bounds b = total.Value;
                    b.Encapsulate(collider.bounds);
                    total = b;
                }
                else
                {
                    total = collider.bounds;
                }
            }

            return total;
        }

        /// <summary>The pieces of a stand-in, each relative to the middle of the piece it replaces and to its turn.</summary>
        private static List<(string Prefab, Vector3 Position, Quaternion Rotation)> Members(string replacement)
        {
            var members = new List<(string, Vector3, Quaternion)>();
            if (!replacement.StartsWith("group[") || !replacement.EndsWith("]"))
            {
                members.Add((replacement, -MaterialSwap.LocalCenter(replacement), Quaternion.identity));
                return members;
            }

            CultureInfo inv = CultureInfo.InvariantCulture;
            foreach (string part in replacement.Substring(6, replacement.Length - 7).Split(';'))
            {
                int at = part.IndexOf('@');
                string[] f = at > 0 ? part.Substring(at + 1).Split(',') : new string[0];
                if (f.Length < 7)
                {
                    continue;
                }

                float[] v = f.Select(x => float.Parse(x, NumberStyles.Float, inv)).ToArray();
                members.Add((part.Substring(0, at), new Vector3(v[0], v[1], v[2]), new Quaternion(v[3], v[4], v[5], v[6])));
            }

            return members;
        }

        /// <summary>A stand-in in words: the piece, or the pieces of a group and how many of each.</summary>
        private static string Describe(string replacement) =>
            !replacement.StartsWith("group[") ? replacement :
            string.Join(", ", Members(replacement).GroupBy(m => m.Prefab).Select(g => g.Count() > 1 ? $"{g.Count()} {g.Key}" : g.Key));

        /// <summary>
        /// Where the pieces of a stand-in go for one original: around the original's middle, turned as the original
        /// plus <paramref name="turn"/> degrees.
        /// </summary>
        public static List<(string Prefab, Vector3 Position, Quaternion Rotation)> Expand(Vector3 center, Quaternion originalRotation, string replacement, float turn)
        {
            Quaternion frame = originalRotation * Quaternion.Euler(0f, turn, 0f);
            return Members(replacement).Select(m => (m.Prefab, center + frame * m.Position, frame * m.Rotation)).ToList();
        }

        /// <summary>
        /// The stand-ins for one piece, in a line 3 m in front of the design's sign: one group per biome, each behind a
        /// small label sign. Returns what was put up, for the message.
        /// </summary>
        private static string SpawnPalette(string design, string original)
        {
            ClearPalette();
            Sign sign = DesignSign(design);
            if (sign == null)
            {
                return "none (the design's sign was not found)";
            }

            // Away from the design, through its sign: towards the aisle the player walks along.
            Vector3 middle = Vector3.zero;
            int count = 0;
            foreach (ZNetView view in ZNetScene.instance.m_instances.Values)
            {
                if (view != null && view.IsValid() && view.GetZDO().GetString(Gallery.KeyDesign, "") == design && view.GetComponent<Sign>() == null)
                {
                    middle += view.transform.position;
                    count++;
                }
            }

            Vector3 toViewer = count > 0 ? sign.transform.position - middle / count : sign.transform.forward;
            toViewer.y = 0f;
            toViewer = toViewer.sqrMagnitude > 0.01f ? toViewer.normalized : Vector3.forward;
            Vector3 right = Vector3.Cross(Vector3.up, -toViewer);
            var groups = new List<(int Stage, List<string> Pieces, List<string> Combos)>();
            foreach (string word in (LogicConfig.GallerySwapBiomes?.Value ?? "meadows,blackforest,swamp").Split(','))
            {
                int stage = Gallery.StageIndexOf(word.Trim());
                if (stage >= 0)
                {
                    groups.Add((stage, MaterialSwap.Candidates(original, stage, PerBiome, orEarlier: false), MaterialSwap.Combos(original, stage, CombosPerBiome)));
                }
            }

            float Span(string name) => Mathf.Max(MaterialSwap.SizeOf(name).x, MaterialSwap.SizeOf(name).z) + 0.8f;
            Vector3 originalSize = MaterialSwap.SizeOf(original);
            float comboSpan = Mathf.Max(originalSize.x, originalSize.z) + 0.8f;
            const float LabelWidth = 1.6f;
            const float GroupGap = 2f;
            float width = groups.Sum(g => LabelWidth + g.Pieces.Sum(Span) + g.Combos.Count * comboSpan) + GroupGap * (groups.Count - 1);
            float x = -width / 2f;
            Vector3 line = sign.transform.position + toViewer * 3f;
            Quaternion facing = Quaternion.LookRotation(-toViewer);
            var shown = new List<string>();
            foreach ((int stage, List<string> pieces, List<string> combos) in groups)
            {
                GameObject label = Gallery.OneSign(Ground(line + right * (x + LabelWidth / 2f)), -toViewer, 0f,
                    $"<#5cf>{Gallery.StageNames[stage]}<br><#bbb>{(pieces.Count == 0 && combos.Count == 0 ? "nothing" : "")}");
                Mark(label);
                x += LabelWidth;
                foreach (string name in pieces)
                {
                    GameObject prefab = ZNetScene.instance.GetPrefab(name);
                    float span = Span(name);
                    Vector3 spot = Ground(line + right * (x + span / 2f));
                    x += span;
                    if (prefab == null)
                    {
                        continue;
                    }

                    Vector3 lift = spot + Vector3.up * (MaterialSwap.SizeOf(name).y / 2f);
                    Mark(Object.Instantiate(prefab, lift - facing * MaterialSwap.LocalCenter(name), facing));
                }

                foreach (string combo in combos)
                {
                    Vector3 spot = Ground(line + right * (x + comboSpan / 2f));
                    x += comboSpan;
                    foreach ((string name, Vector3 position, Quaternion rotation) in Expand(spot + Vector3.up * (originalSize.y / 2f), facing, combo, 0f))
                    {
                        GameObject prefab = ZNetScene.instance.GetPrefab(name);
                        if (prefab != null)
                        {
                            GameObject made = Object.Instantiate(prefab, position, rotation);
                            Mark(made);
                            made.GetComponent<ZNetView>()?.GetZDO()?.Set(KeyCombo, combo);
                        }
                    }
                }

                var offered = pieces.Concat(combos.Select(c => Describe(c) + " (combined)")).ToList();
                shown.Add($"{Gallery.StageNames[stage]}: {(offered.Count > 0 ? string.Join(", ", offered) : "nothing")}");
                x += GroupGap;
            }

            return string.Join("; ", shown);
        }

        private static Vector3 Ground(Vector3 spot)
        {
            if (ZoneSystem.instance.GetGroundHeight(spot, out float ground))
            {
                spot.y = ground;
            }

            return spot;
        }

        private static void Mark(GameObject go)
        {
            ZNetView view = go != null ? go.GetComponent<ZNetView>() : null;
            if (view != null && view.IsValid())
            {
                view.GetZDO().Set(Gallery.KeyGallery, 1);
                view.GetZDO().Set(KeyPalette, 1);
                Palette.Add(view);
            }
        }

        /// <summary>The front sign of a gallery design.</summary>
        private static Sign DesignSign(string design)
        {
            foreach (ZNetView view in ZNetScene.instance.m_instances.Values)
            {
                if (view != null && view.IsValid() && view.GetZDO().GetString(Gallery.KeyDesign, "") == design)
                {
                    Sign sign = view.GetComponent<Sign>();
                    if (sign != null)
                    {
                        return sign;
                    }
                }
            }

            return null;
        }

        private static void ClearPalette()
        {
            foreach (ZNetView view in Palette)
            {
                if (view != null && view.IsValid())
                {
                    view.ClaimOwnership();
                    ZNetScene.instance.Destroy(view.gameObject);
                }
            }

            Palette.Clear();
        }

        private static void Done()
        {
            _original = null;
            _design = null;
            _current = null;
            ClearPalette();
        }

        // ---------------------------------------------------------------- the saved choices

        private static bool _retired;

        /// <summary>
        /// The choices of this session only, for 'vh swap turn' and a second pick of the same piece: they are not kept
        /// on disk (a design keeps its swaps only by being saved). A design-swaps.txt from the builds that kept every
        /// choice is moved aside to design-swaps-unused.txt once.
        /// </summary>
        private static void LoadChoices()
        {
            if (_retired)
            {
                return;
            }

            _retired = true;
            try
            {
                if (File.Exists(ChoicesPath))
                {
                    string aside = Path.Combine(Path.GetDirectoryName(ChoicesPath), "design-swaps-unused.txt");
                    if (File.Exists(aside))
                    {
                        File.Delete(aside);
                    }

                    File.Move(ChoicesPath, aside);
                    VillheimPlugin.Log.LogInfo($"Swap: choices are no longer kept unless a design is saved; moved {ChoicesPath} to {aside}.");
                }
            }
            catch (System.Exception e)
            {
                VillheimPlugin.Log.LogWarning($"Swap: could not move {ChoicesPath} aside: {e.Message}");
            }
        }

        private static (string Prefab, float Turn)? Choice(string design, string original)
        {
            LoadChoices();
            return Choices.TryGetValue(design, out var byOriginal) && byOriginal.TryGetValue(original, out var choice) ? choice : ((string, float)?)null;
        }

        private static void SetChoice(string design, string original, string replacement, float turn)
        {
            LoadChoices();
            if (!Choices.TryGetValue(design, out var byOriginal))
            {
                byOriginal = new Dictionary<string, (string, float)>();
                Choices[design] = byOriginal;
            }

            byOriginal[original] = (replacement, turn);
            SaveChoices();
        }

        private static void RemoveChoice(string design, string original)
        {
            LoadChoices();
            if (Choices.TryGetValue(design, out var byOriginal) && byOriginal.Remove(original))
            {
                SaveChoices();
            }
        }

        private static void SaveChoices()
        {
        }

        // ---------------------------------------------------------------- notes

        private static void Say(string text)
        {
            MessageHud.instance?.ShowMessage(MessageHud.MessageType.TopLeft, text);
            Console.instance?.Print(text);
        }

        /// <summary>'vh note &lt;text&gt;': the note, where the player is, what the crosshair is on and the nearest gallery sign.</summary>
        public static string Note(string[] args)
        {
            Player player = Player.m_localPlayer;
            if (player == null || args.Length == 0)
            {
                return "Villheim: vh note <what you want to say>";
            }

            GameObject target = LookAt.Target(player);
            ZDO zdo = target?.GetComponent<ZNetView>()?.GetZDO();
            string aimed = target != null ? Utils.GetPrefabName(target) : "nothing";
            string from = zdo?.GetString(Gallery.KeySwappedFrom, "") ?? "";
            string design = zdo?.GetString(Gallery.KeyDesign, "") ?? "";
            string line = $"{System.DateTime.Now:yyyy-MM-dd HH:mm} | {string.Join(" ", args)} | aiming at {aimed}" +
                          (from.Length > 0 ? $" (stands in for {from})" : "") + (design.Length > 0 ? $" in {design}" : "") +
                          $" | nearest sign: {NearestSign(player.transform.position)} | at {player.transform.position:F0}";
            Directory.CreateDirectory(Path.GetDirectoryName(NotesPath));
            File.AppendAllText(NotesPath, line + System.Environment.NewLine);
            return $"Villheim: noted ({NotesPath}).";
        }

        private static string NearestSign(Vector3 position)
        {
            Sign best = null;
            float bestDistance = 40f;
            foreach (ZNetView view in ZNetScene.instance.m_instances.Values)
            {
                if (view == null || !view.IsValid() || view.GetZDO().GetInt(Gallery.KeyGallery) != 1 || view.GetZDO().GetInt(KeyPalette) == 1)
                {
                    continue;
                }

                Sign sign = view.GetComponent<Sign>();
                float distance = Vector3.Distance(view.transform.position, position);
                if (sign != null && distance < bestDistance && sign.GetText().Contains("<br>"))
                {
                    best = sign;
                    bestDistance = distance;
                }
            }

            return best == null ? "none within 40 m" : Regex.Replace(best.GetText().Replace("<br>", " / "), "<[^>]+>", "").Trim();
        }
    }
}
