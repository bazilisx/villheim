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
    /// (middle mouse by default): in front of that design's sign go up the likeliest stand-ins for that kind of piece,
    /// in groups by biome (GallerySwapBiomes: Meadows, Black Forest, Swamp), each group behind a label sign. Aim at one
    /// (or at any piece built by hand) and press the key again: every piece of that kind in that one design changes to
    /// it, nothing anywhere else. Pick another stand-in to compare; the last one stays. The choice is kept per design
    /// in BepInEx/Villheim/design-swaps.txt (design|original|replacement|turn) and comes back whenever the design is put
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
        private const int PerBiome = 4;

        private static bool _on;
        private static string _design;
        private static string _original;
        private static float _turn;
        private static string _current;
        private static readonly List<ZNetView> Palette = new List<ZNetView>();

        // design -> original -> (replacement, turn)
        private static readonly Dictionary<string, Dictionary<string, (string Prefab, float Turn)>> Choices =
            new Dictionary<string, Dictionary<string, (string, float)>>();

        private static System.DateTime _choicesRead;

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
            string key = LogicConfig.GallerySwapKey?.Value.ToString() ?? "Mouse2";
            return $"Villheim: swap is on. Aim at a piece of a gallery design and press {key}: stand-ins go up in front of its sign, by biome. " +
                   $"Aim at one (or a piece you built) and press {key} again to use it in that design. 'vh swap turn', 'vh swap undo', 'vh swap done', 'vh swap off'.";
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
                    if (!LogicConfig.GallerySwapKey.Value.IsDown() || Console.IsVisible() || Menu.IsVisible() || InventoryGui.IsVisible() ||
                        Chat.instance != null && Chat.instance.HasFocus())
                    {
                        return;
                    }

                    Press(__instance);
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

            int replaced = Replace(_design, _original, prefab, _turn);
            _current = prefab;
            SetChoice(_design, _original, prefab, _turn);
            Say($"Swap: {_original} is now {prefab} in {_design} ({replaced} pieces). Pick another to compare, 'vh swap turn' to turn it, " +
                "'vh swap undo' to put the original back.");
        }

        private static string Turn()
        {
            if (_original == null || _current == null)
            {
                return "Villheim: pick a piece and a stand-in first.";
            }

            _turn = (_turn + 90f) % 360f;
            int replaced = Replace(_design, _original, _current, _turn);
            SetChoice(_design, _original, _current, _turn);
            return $"Villheim: {_current} in {_design} turned to {_turn:0} degrees ({replaced} pieces).";
        }

        private static string Undo()
        {
            if (_original == null)
            {
                return "Villheim: pick a piece first.";
            }

            int replaced = Replace(_design, _original, _original, 0f);
            RemoveChoice(_design, _original);
            _current = null;
            _turn = 0f;
            return $"Villheim: {_original} is back in {_design} ({replaced} pieces).";
        }

        /// <summary>
        /// Replaces every piece of one kind in one design (the original itself or a stand-in for it) with
        /// <paramref name="replacement"/>, middle on middle, turned as the original was plus <paramref name="turn"/>.
        /// </summary>
        private static int Replace(string design, string original, string replacement, float turn)
        {
            GameObject prefab = ZNetScene.instance.GetPrefab(replacement);
            if (prefab == null)
            {
                return 0;
            }

            Vector3 newCenter = MaterialSwap.LocalCenter(replacement);
            bool back = replacement == original;
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

                Transform t = view.transform;
                Vector3 middle = t.position + t.rotation * MaterialSwap.LocalCenter(shown);
                Quaternion originalRotation = from.Length > 0 ? zdo.GetQuaternion(Gallery.KeySwappedRotation, t.rotation) : t.rotation;
                Quaternion rotation = back ? originalRotation : originalRotation * Quaternion.Euler(0f, turn, 0f);
                GameObject made = Object.Instantiate(prefab, middle - rotation * newCenter, rotation);
                ZDO madeZdo = made.GetComponent<ZNetView>()?.GetZDO();
                if (madeZdo != null)
                {
                    madeZdo.Set(Gallery.KeyGallery, 1);
                    madeZdo.Set(Gallery.KeyDesign, design);
                    if (!back)
                    {
                        madeZdo.Set(Gallery.KeySwappedFrom, original);
                        madeZdo.Set(Gallery.KeySwappedRotation, originalRotation);
                    }
                }

                doomed.Add(view);
            }

            foreach (ZNetView view in doomed)
            {
                view.ClaimOwnership();
                ZNetScene.instance.Destroy(view.gameObject);
            }

            return doomed.Count;
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
            var groups = new List<(int Stage, List<string> Pieces)>();
            foreach (string word in (LogicConfig.GallerySwapBiomes?.Value ?? "meadows,blackforest,swamp").Split(','))
            {
                int stage = Gallery.StageIndexOf(word.Trim());
                if (stage >= 0)
                {
                    groups.Add((stage, MaterialSwap.Candidates(original, stage, PerBiome, orEarlier: false)));
                }
            }

            float Span(string name) => Mathf.Max(MaterialSwap.SizeOf(name).x, MaterialSwap.SizeOf(name).z) + 0.8f;
            const float LabelWidth = 1.6f;
            const float GroupGap = 2f;
            float width = groups.Sum(g => LabelWidth + g.Pieces.Sum(Span)) + GroupGap * (groups.Count - 1);
            float x = -width / 2f;
            Vector3 line = sign.transform.position + toViewer * 3f;
            Quaternion facing = Quaternion.LookRotation(-toViewer);
            var shown = new List<string>();
            foreach ((int stage, List<string> pieces) in groups)
            {
                GameObject label = Gallery.OneSign(Ground(line + right * (x + LabelWidth / 2f)), -toViewer, 0f,
                    $"<#5cf>{Gallery.StageNames[stage]}<br><#bbb>{(pieces.Count == 0 ? "nothing" : "")}");
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

                shown.Add($"{Gallery.StageNames[stage]}: {(pieces.Count > 0 ? string.Join(", ", pieces) : "nothing")}");
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

        private static void LoadChoices()
        {
            try
            {
                System.DateTime written = File.Exists(ChoicesPath) ? File.GetLastWriteTimeUtc(ChoicesPath) : System.DateTime.MinValue;
                if (written == _choicesRead)
                {
                    return;
                }

                _choicesRead = written;
                Choices.Clear();
                if (!File.Exists(ChoicesPath))
                {
                    return;
                }

                foreach (string line in File.ReadAllLines(ChoicesPath))
                {
                    string[] f = line.Split('|');
                    if (line.StartsWith("#") || f.Length < 3)
                    {
                        continue;
                    }

                    float turn = f.Length > 3 && float.TryParse(f[3], NumberStyles.Float, CultureInfo.InvariantCulture, out float t) ? t : 0f;
                    if (!Choices.TryGetValue(f[0], out var byOriginal))
                    {
                        byOriginal = new Dictionary<string, (string, float)>();
                        Choices[f[0]] = byOriginal;
                    }

                    byOriginal[f[1]] = (f[2], turn);
                }
            }
            catch (System.Exception e)
            {
                VillheimPlugin.Log.LogWarning($"Swap: could not read {ChoicesPath}: {e.Message}");
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
            var lines = new List<string> { "# Stand-ins chosen by hand with 'vh swap': design|original piece|replacement|quarter turn in degrees." };
            lines.AddRange(Choices.OrderBy(d => d.Key).SelectMany(d => d.Value.OrderBy(o => o.Key)
                .Select(o => $"{d.Key}|{o.Key}|{o.Value.Prefab}|{o.Value.Turn.ToString("0", CultureInfo.InvariantCulture)}")));
            Directory.CreateDirectory(Path.GetDirectoryName(ChoicesPath));
            File.WriteAllLines(ChoicesPath, lines);
            _choicesRead = File.GetLastWriteTimeUtc(ChoicesPath);
        }

        /// <summary>A design's plan with its chosen stand-ins in (the gallery puts designs up with them).</summary>
        public static List<DesignSpawner.PlanEntry> ApplyChoices(List<DesignSpawner.PlanEntry> plan, string design)
        {
            LoadChoices();
            if (!Choices.TryGetValue(design, out var byOriginal) || byOriginal.Count == 0)
            {
                return plan;
            }

            var output = new List<DesignSpawner.PlanEntry>(plan.Count);
            foreach (DesignSpawner.PlanEntry entry in plan)
            {
                if (byOriginal.TryGetValue(entry.Prefab, out var choice) &&
                    Place(entry.Prefab, entry.LocalPosition, entry.LocalRotation, choice.Prefab, choice.Turn, out Vector3 position, out Quaternion rotation))
                {
                    DesignSpawner.PlanEntry swapped = DesignSpawner.Entry(choice.Prefab, position, rotation, entry.Scale);
                    if (swapped != null)
                    {
                        swapped.SwappedFrom = entry.Prefab;
                        swapped.OriginalRotation = entry.LocalRotation;
                        output.Add(swapped);
                        continue;
                    }
                }

                output.Add(entry);
            }

            return output;
        }

        /// <summary>Where a stand-in goes for a piece: middle on middle, turned as the piece plus the chosen turn.</summary>
        public static bool Place(string original, Vector3 position, Quaternion rotation, string replacement, float turn,
            out Vector3 newPosition, out Quaternion newRotation)
        {
            newRotation = rotation * Quaternion.Euler(0f, turn, 0f);
            newPosition = position + rotation * MaterialSwap.LocalCenter(original) - newRotation * MaterialSwap.LocalCenter(replacement);
            return ZNetScene.instance.GetPrefab(replacement) != null;
        }

        /// <summary>The chosen stand-ins of a design: original to (replacement, turn).</summary>
        public static Dictionary<string, (string Prefab, float Turn)> ChoicesFor(string design)
        {
            LoadChoices();
            return Choices.TryGetValue(design, out var byOriginal) ? byOriginal : new Dictionary<string, (string, float)>();
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
