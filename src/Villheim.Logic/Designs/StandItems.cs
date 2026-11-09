using HarmonyLib;
using UnityEngine;

namespace Villheim.Logic.Designs
{
    /// <summary>
    /// Items on stands that come with a design. PlanBuild saves what an item stand holds in the piece line's tenth field
    /// (Blueprints.Piece.Text): "Tankard:0:1" is the item prefab, its variant and its quality (newer saves add a fourth
    /// number). When a design's item stand goes up, the item goes on it, the way Trophies.Hang does, and the stand is
    /// locked: nobody can take the item off, swap it or take the stand down with the hammer. The lock is kept in the
    /// stand's ZDO so it holds after a reload.
    ///
    /// Armor stands save several slots in another format; they are left as they are for now.
    /// </summary>
    internal static class StandItems
    {
        internal static readonly int KeyLocked = "villheim_stand_locked".GetStableHashCode();

        /// <summary>Puts the saved item on a freshly placed item stand. Returns true when an item went on.</summary>
        internal static bool Apply(GameObject instance, string text)
        {
            if (instance == null || string.IsNullOrEmpty(text))
            {
                return false;
            }

            ItemStand stand = instance.GetComponentInChildren<ItemStand>();
            ZNetView view = instance.GetComponent<ZNetView>();
            if (stand == null || view == null || !view.IsValid())
            {
                return false;
            }

            string[] f = text.Split(':');
            string name = f[0].Trim();
            GameObject itemPrefab = name.Length > 0 && ObjectDB.instance != null ? ObjectDB.instance.GetItemPrefab(name) : null;
            ItemDrop drop = itemPrefab != null ? itemPrefab.GetComponent<ItemDrop>() : null;
            if (drop == null)
            {
                VillheimPlugin.Debug($"Stand item '{name}' is no item prefab; the stand stays empty.");
                return false;
            }

            int variant = f.Length > 1 && int.TryParse(f[1], out int v) ? v : 0;
            int quality = f.Length > 2 && int.TryParse(f[2], out int q) ? Mathf.Max(1, q) : 1;
            if (!stand.CanAttach(drop.m_itemData))
            {
                VillheimPlugin.Debug($"Stand item '{name}' does not fit a {instance.name}; the stand stays empty.");
                return false;
            }

            ZDO zdo = view.GetZDO();
            zdo.Set(ZDOVars.s_item, name);
            zdo.Set(ZDOVars.s_variant, variant);
            zdo.Set(ZDOVars.s_quality, quality);
            zdo.Set(KeyLocked, 1);
            stand.m_canBeRemoved = false;
            stand.UpdateVisual();
            return true;
        }

        private static bool Locked(ZNetView view)
        {
            return view != null && view.IsValid() && view.GetZDO().GetInt(KeyLocked) == 1;
        }

        /// <summary>A locked stand keeps its item: interacting does nothing.</summary>
        [HarmonyPatch(typeof(ItemStand), nameof(ItemStand.Interact))]
        internal static class InteractPatch
        {
            private static bool Prefix(ItemStand __instance, ref bool __result)
            {
                if (!Locked(__instance.m_nview))
                {
                    return true;
                }

                __result = false;
                return false;
            }
        }

        /// <summary>A locked stand takes no other item.</summary>
        [HarmonyPatch(typeof(ItemStand), nameof(ItemStand.UseItem))]
        internal static class UseItemPatch
        {
            private static bool Prefix(ItemStand __instance, ref bool __result)
            {
                if (!Locked(__instance.m_nview))
                {
                    return true;
                }

                __result = false;
                return false;
            }
        }

        /// <summary>A locked stand cannot be taken down with the hammer.</summary>
        [HarmonyPatch(typeof(Piece), nameof(Piece.CanBeRemoved))]
        internal static class RemovePatch
        {
            private static void Postfix(Piece __instance, ref bool __result)
            {
                if (__result && __instance.m_nview != null && Locked(__instance.m_nview) && __instance.GetComponentInChildren<ItemStand>() != null)
                {
                    __result = false;
                }
            }
        }

        /// <summary>After a reload the stand's own flag is set again from its ZDO.</summary>
        [HarmonyPatch(typeof(ItemStand), nameof(ItemStand.Awake))]
        internal static class AwakePatch
        {
            private static void Postfix(ItemStand __instance)
            {
                if (Locked(__instance.m_nview))
                {
                    __instance.m_canBeRemoved = false;
                }
            }
        }
    }
}
