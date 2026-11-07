using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using HarmonyLib;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// 'vh swap': choose stand-ins by hand in the gallery.
    ///
    /// With it on, aim at a gallery piece and press the swap key (middle mouse by default): that picks the piece, or
    /// the original it stands in for, and lays out the likeliest stand-ins in a row in front of the player. Then aim
    /// at the piece to use instead (one of that row, or anything built by hand) and press the key again: every copy
    /// of the original within GallerySwapRadius of the first piece is replaced, and the pairing is saved to
    /// swap-pairs.txt, so later gallery pages (and 'vh bp swap') use it for that stage and the ones after it.
    /// 'vh swap turn' gives the last pairing a quarter turn and puts it up again; 'vh swap cancel' drops a pick.
    ///
    /// 'vh note &lt;text&gt;' writes a note to BepInEx/Villheim/notes.txt with what the crosshair is on and the nearest
    /// gallery sign, for Tyler's comments while reviewing.
    /// </summary>
    internal static class SwapTool
    {
        private static readonly int KeyPalette = "villheim_swap_palette".GetStableHashCode();

        private static bool _on;
        private static string _original;
        private static Vector3 _pickedAt;
        private static int _stage;
        private static string _lastOriginal;
        private static string _lastReplacement;
        private static float _lastTurn;
        private static Vector3 _lastAt;
        private static readonly List<ZNetView> Palette = new List<ZNetView>();

        public static string NotesPath => Path.Combine(BepInEx.Paths.BepInExRootPath, "Villheim", "notes.txt");

        public static string Run(string[] args)
        {
            string first = args.Length > 0 ? args[0].ToLowerInvariant() : "";
            switch (first)
            {
                case "off":
                    _on = false;
                    Cancel();
                    return "Villheim: swap is off.";
                case "cancel":
                    Cancel();
                    return "Villheim: pick dropped.";
                case "turn":
                    return Turn();
                case "as":
                    if (args.Length > 1 && Gallery.StageIndexOf(args[1]) >= 0)
                    {
                        _stage = Gallery.StageIndexOf(args[1]);
                        return $"Villheim: swap pairings are now for {Gallery.StageNames[_stage]} (and the stages after it).";
                    }

                    return "Villheim: vh swap as <meadows|blackforest|swamp|mountain|plains>";
            }

            _on = true;
            _stage = Gallery.LastAsStage >= 0 ? Gallery.LastAsStage : 0;
            string key = LogicConfig.GallerySwapKey?.Value.ToString() ?? "Mouse2";
            return $"Villheim: swap is on, pairing for {Gallery.StageNames[_stage]}. Aim at a gallery piece and press {key} to pick it; " +
                   $"then aim at the piece to use instead and press {key} again. 'vh swap turn' turns the last one, 'vh swap off' ends it.";
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
            if (_original == null)
            {
                if (zdo == null || zdo.GetInt(Gallery.KeyGallery) != 1 || zdo.GetInt(KeyPalette) == 1)
                {
                    Say($"Swap: {prefab} is not part of a gallery design; pick a piece of one.");
                    return;
                }

                string from = zdo.GetString(Gallery.KeySwappedFrom, "");
                _original = from.Length > 0 ? from : prefab;
                _pickedAt = target.transform.position;
                List<string> candidates = MaterialSwap.Candidates(_original, _stage, 8);
                SpawnPalette(player, candidates);
                Say($"Swap: picked {_original}{(from.Length > 0 ? $" (shown as {prefab})" : "")}. Stand-ins in front of you, left to right: " +
                    string.Join(", ", candidates) + ". Aim at the one to use (or any piece you build) and press the key again.");
                return;
            }

            string replacement = prefab;
            string original = _original;
            int replaced = Replace(original, replacement, 0f, _pickedAt);
            MaterialSwap.SetPair(original, _stage, replacement, 0f);
            _lastOriginal = original;
            _lastReplacement = replacement;
            _lastTurn = 0f;
            _lastAt = _pickedAt;
            Cancel();
            Say($"Swap: {original} is now {replacement} from {Gallery.StageNames[_stage]} on ({replaced} replaced here; later pages use it too). " +
                "'vh swap turn' if it faces the wrong way.");
        }

        private static string Turn()
        {
            if (_lastOriginal == null)
            {
                return "Villheim: no swap to turn yet.";
            }

            _lastTurn = (_lastTurn + 90f) % 360f;
            int replaced = Replace(_lastOriginal, _lastReplacement, _lastTurn, _lastAt);
            MaterialSwap.SetPair(_lastOriginal, _stage, _lastReplacement, _lastTurn);
            return $"Villheim: {_lastReplacement} turned to {_lastTurn:0} degrees ({replaced} replaced).";
        }

        /// <summary>
        /// Replaces every gallery copy of <paramref name="original"/> within the radius (the original itself or a
        /// stand-in for it) with <paramref name="replacement"/>, middle on middle, turned as the original was plus
        /// <paramref name="turn"/> degrees.
        /// </summary>
        private static int Replace(string original, string replacement, float turn, Vector3 around)
        {
            GameObject prefab = ZNetScene.instance.GetPrefab(replacement);
            if (prefab == null)
            {
                return 0;
            }

            float radius = LogicConfig.GallerySwapRadius?.Value ?? 40f;
            Vector3 newCenter = MaterialSwap.LocalCenter(replacement);
            var doomed = new List<ZNetView>();
            foreach (ZNetView view in ZNetScene.instance.m_instances.Values.ToList())
            {
                ZDO zdo = view != null && view.IsValid() ? view.GetZDO() : null;
                if (zdo == null || zdo.GetInt(Gallery.KeyGallery) != 1 || zdo.GetInt(KeyPalette) == 1 ||
                    Utils.DistanceXZ(view.transform.position, around) > radius)
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
                Quaternion rotation = originalRotation * Quaternion.Euler(0f, turn, 0f);
                GameObject made = Object.Instantiate(prefab, middle - rotation * newCenter, rotation);
                ZDO madeZdo = made.GetComponent<ZNetView>()?.GetZDO();
                if (madeZdo != null)
                {
                    madeZdo.Set(Gallery.KeyGallery, 1);
                    madeZdo.Set(Gallery.KeySwappedFrom, original);
                    madeZdo.Set(Gallery.KeySwappedRotation, originalRotation);
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

        /// <summary>The candidates in a row 4 m in front of the player, facing them, each on the ground.</summary>
        private static void SpawnPalette(Player player, List<string> candidates)
        {
            ClearPalette();
            Vector3 forward = player.transform.forward;
            forward.y = 0f;
            forward.Normalize();
            Vector3 right = Vector3.Cross(Vector3.up, forward);
            float width = candidates.Sum(c => Mathf.Max(MaterialSwap.SizeOf(c).x, MaterialSwap.SizeOf(c).z) + 1f);
            float x = -width / 2f;
            Quaternion rotation = Quaternion.LookRotation(-forward);
            foreach (string name in candidates)
            {
                GameObject prefab = ZNetScene.instance.GetPrefab(name);
                Vector3 size = MaterialSwap.SizeOf(name);
                float span = Mathf.Max(size.x, size.z) + 1f;
                Vector3 spot = player.transform.position + forward * 4f + right * (x + span / 2f);
                x += span;
                if (prefab == null)
                {
                    continue;
                }

                if (ZoneSystem.instance.GetGroundHeight(spot, out float ground))
                {
                    spot.y = ground;
                }

                Vector3 middle = spot + Vector3.up * (size.y / 2f);
                GameObject made = Object.Instantiate(prefab, middle - rotation * MaterialSwap.LocalCenter(name), rotation);
                ZNetView view = made.GetComponent<ZNetView>();
                if (view != null && view.IsValid())
                {
                    view.GetZDO().Set(Gallery.KeyGallery, 1);
                    view.GetZDO().Set(KeyPalette, 1);
                    Palette.Add(view);
                }
            }
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

        private static void Cancel()
        {
            _original = null;
            ClearPalette();
        }

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
            string aimed = target != null ? Utils.GetPrefabName(target) : "nothing";
            string from = target?.GetComponent<ZNetView>()?.GetZDO()?.GetString(Gallery.KeySwappedFrom, "") ?? "";
            string sign = NearestSign(player.transform.position);
            string line = $"{System.DateTime.Now:yyyy-MM-dd HH:mm} | {string.Join(" ", args)} | aiming at {aimed}" +
                          (from.Length > 0 ? $" (stands in for {from})" : "") + $" | nearest sign: {sign} | at {player.transform.position:F0}";
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
                if (view == null || !view.IsValid() || view.GetZDO().GetInt(Gallery.KeyGallery) != 1)
                {
                    continue;
                }

                Sign sign = view.GetComponent<Sign>();
                float distance = Vector3.Distance(view.transform.position, position);
                string text = sign != null ? sign.GetText() : "";
                if (sign != null && distance < bestDistance && text.Contains("<br>"))
                {
                    best = sign;
                    bestDistance = distance;
                }
            }

            return best == null ? "none within 40 m" : Regex.Replace(best.GetText().Replace("<br>", " / "), "<[^>]+>", "").Trim();
        }
    }
}
