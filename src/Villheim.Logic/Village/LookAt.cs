using System.Collections.Generic;
using System.IO;
using HarmonyLib;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// 'vh look' (always on while the shaping rod is in hand): the object under the crosshair within 4 m glows orange and
    /// its name (and what it stands in for) shows in the middle of the screen. The full description (kind, size, stage,
    /// what the material swap makes of it) goes to the console, and each new name to BepInEx/Villheim/looked-at.txt.
    /// 'vh look' again turns it off.
    /// </summary>
    internal static class LookAt
    {
        private const float Reach = 4f;

        private static bool _on;
        private static float _next;
        private static string _last;
        private static GameObject _lastObject;
        private static GameObject _painted;
        private static readonly int Emission = Shader.PropertyToID("_EmissionColor");
        private static readonly HashSet<string> Seen = new HashSet<string>();

        public static string FilePath => Path.Combine(BepInEx.Paths.BepInExRootPath, "Villheim", "looked-at.txt");

        public static bool On => _on;

        /// <summary>The orange of the looked-at object (and of Delete all's marks): config LookColor, a deep beacon orange.</summary>
        public static Color Highlight => LogicConfig.LookColor?.Value ?? new Color(0.45f, 0.16f, 0.02f);

        /// <summary>Turns look on or off without a message (Shaping turns it on while the rod is in hand).</summary>
        public static void SetOn(bool on)
        {
            _on = on;
            _last = null;
            _lastObject = null;
            if (!on)
            {
                Unpaint();
            }
        }

        public static string Toggle(string[] args)
        {
            SetOn(args.Length > 0 ? args[0].ToLowerInvariant() != "off" : !_on);
            return _on
                ? $"Villheim: look is on. Point at something within {Reach:0} m to see its name; each new one is saved to {FilePath}. 'vh look' again turns it off."
                : "Villheim: look is off.";
        }

        [HarmonyPatch(typeof(Player), "Update")]
        internal static class UpdatePatch
        {
            private static void Postfix(Player __instance)
            {
                if (!_on || __instance != Player.m_localPlayer || Time.time < _next || GameCamera.instance == null)
                {
                    return;
                }

                _next = Time.time + 0.25f;
                try
                {
                    Check(__instance);
                }
                catch (System.Exception e)
                {
                    VillheimPlugin.Log.LogWarning($"Look: {e.Message}");
                }
            }
        }

        /// <summary>The object under the crosshair within reach of the player (its network object), or null.</summary>
        public static GameObject Target(Player player)
        {
            if (GameCamera.instance == null || player == null)
            {
                return null;
            }

            Transform eye = GameCamera.instance.transform;
            RaycastHit[] hits = Physics.RaycastAll(eye.position, eye.forward, 30f, ~0, QueryTriggerInteraction.Ignore);
            System.Array.Sort(hits, (a, b) => a.distance.CompareTo(b.distance));
            foreach (RaycastHit hit in hits)
            {
                if (hit.collider == null || hit.collider.GetComponentInParent<Character>() != null)
                {
                    continue;
                }

                if (Vector3.Distance(player.transform.position + Vector3.up, hit.point) > Reach)
                {
                    return null;
                }

                ZNetView view = hit.collider.GetComponentInParent<ZNetView>();
                return view != null ? view.gameObject : null;
            }

            return null;
        }

        private static void Check(Player player)
        {
            GameObject target = Target(player);
            if (target == null)
            {
                Unpaint();
                _lastObject = null;
                return;
            }

            if (target == _lastObject)
            {
                return;
            }

            _lastObject = target;
            Unpaint();
            if (!SwapTool.IsLit(target) && !Shaping.IsShown(target))
            {
                MaterialMan.instance?.SetValue(target, Emission, Highlight);
                _painted = target;
            }

            string prefab = Utils.GetPrefabName(target);
            string from = target.GetComponent<ZNetView>()?.GetZDO()?.GetString(Gallery.KeySwappedFrom, "") ?? "";
            MessageHud.instance?.ShowMessage(MessageHud.MessageType.Center, prefab + (from.Length > 0 ? $"\n(stands in for {from})" : ""));
            if (prefab == _last)
            {
                return;
            }

            _last = prefab;
            string text = MaterialSwap.Describe(prefab) + (from.Length > 0 ? $" (stands in for {from})" : "");
            Console.instance?.Print("Look: " + text);
            if (Seen.Add(prefab))
            {
                Directory.CreateDirectory(Path.GetDirectoryName(FilePath));
                File.AppendAllText(FilePath, text + System.Environment.NewLine);
            }
        }

        /// <summary>Takes the orange off and looks again (Shaping locked onto the object, which shows its own colour).</summary>
        public static void Refresh()
        {
            Unpaint();
            _lastObject = null;
        }

        private static void Unpaint()
        {
            if (_painted != null)
            {
                MaterialMan.instance?.ResetValue(_painted, Emission);
            }

            _painted = null;
        }
    }
}
