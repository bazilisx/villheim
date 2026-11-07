using System.Collections.Generic;
using System.IO;
using HarmonyLib;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// 'vh look': names the object under the crosshair within 4 m (about 13 feet): its prefab name, its building kind
    /// and size, the stage it belongs to and what the material swap turns it into for each earlier stage. Shown at
    /// the top left when the crosshair moves to something new, and each new name is added to
    /// BepInEx/Villheim/looked-at.txt, to find hidden pieces (dvergrprops_wood_wall and the like) that need pairing.
    /// 'vh look' again turns it off.
    /// </summary>
    internal static class LookAt
    {
        private const float Reach = 4f;

        private static bool _on;
        private static float _next;
        private static string _last;
        private static readonly HashSet<string> Seen = new HashSet<string>();

        public static string FilePath => Path.Combine(BepInEx.Paths.BepInExRootPath, "Villheim", "looked-at.txt");

        public static bool On => _on;

        public static string Toggle(string[] args)
        {
            _on = args.Length > 0 ? args[0].ToLowerInvariant() != "off" : !_on;
            _last = null;
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
                return;
            }

            string prefab = Utils.GetPrefabName(target);
            if (prefab == _last)
            {
                return;
            }

            _last = prefab;
            string from = target.GetComponent<ZNetView>()?.GetZDO()?.GetString(Gallery.KeySwappedFrom, "") ?? "";
            string text = MaterialSwap.Describe(prefab) + (from.Length > 0 ? $" (stands in for {from})" : "");
            MessageHud.instance?.ShowMessage(MessageHud.MessageType.TopLeft, "Look: " + text);
            Console.instance?.Print("Look: " + text);
            if (Seen.Add(prefab))
            {
                Directory.CreateDirectory(Path.GetDirectoryName(FilePath));
                File.AppendAllText(FilePath, text + System.Environment.NewLine);
            }
        }
    }
}
