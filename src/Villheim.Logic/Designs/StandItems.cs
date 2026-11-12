using System.Collections.Generic;
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
    /// An armor stand's text lists its gear as "Prefab:variant", comma separated (ApplyArmor).
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

            ArmorStand armor = instance.GetComponentInChildren<ArmorStand>();
            if (armor != null)
            {
                return ApplyArmor(armor, instance.GetComponent<ZNetView>(), text);
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
            // A prefab's own item data has no drop prefab, and CanAttach needs one (it threw here in the 2026-11-09 test).
            ItemDrop.ItemData data = drop.m_itemData.Clone();
            data.m_dropPrefab = itemPrefab;
            bool fits;
            try
            {
                fits = stand.CanAttach(data);
            }
            catch (System.Exception e)
            {
                VillheimPlugin.Debug($"Stand item '{name}' could not be checked on a {instance.name} ({e.GetType().Name}).");
                fits = false;
            }

            if (!fits)
            {
                VillheimPlugin.Debug($"Stand item '{name}' does not fit a {instance.name}; the stand stays empty.");
                return false;
            }

            ZDO zdo = view.GetZDO();
            SetItem(zdo, name, variant, quality);
            zdo.Set(KeyLocked, 1);
            stand.m_canBeRemoved = false;
            stand.UpdateVisual();
            return true;
        }

        /// <summary>
        /// Dresses an armor stand from a design. The text lists items as "Prefab:variant", comma separated, for example
        /// "HelmetBronze:0,ArmorBronzeChest:0,ArmorBronzeLegs:0,CapeDeerHide:0,ShieldBronzeBuckler:0". Each item goes
        /// into the first free slot that takes its type, as the game's ArmorStand.CanAttach decides. The game keeps a
        /// slot's item in the ZDO as "&lt;slot&gt;_item" (hash of the prefab name) and "&lt;slot&gt;_variant"
        /// (ArmorStand.InitKeys). The stand is locked like an item stand: its gear cannot be taken or dropped.
        /// </summary>
        private static bool ApplyArmor(ArmorStand armor, ZNetView view, string text)
        {
            if (view == null || !view.IsValid() || ObjectDB.instance == null)
            {
                return false;
            }

            ZDO zdo = view.GetZDO();
            var used = new bool[armor.m_slots.Count];
            int placed = 0;
            foreach (string token in text.Split(','))
            {
                string[] f = token.Trim().Split(':');
                string name = f[0].Trim();
                GameObject prefab = name.Length > 0 ? ObjectDB.instance.GetItemPrefab(name) : null;
                ItemDrop drop = prefab != null ? prefab.GetComponent<ItemDrop>() : null;
                if (drop == null)
                {
                    VillheimPlugin.Debug($"Armor stand item '{name}' is no item prefab; left off.");
                    continue;
                }

                ItemDrop.ItemData.SharedData shared = drop.m_itemData.m_shared;
                ItemDrop.ItemData.ItemType type = shared.m_attachOverride != 0 ? shared.m_attachOverride : shared.m_itemType;
                int slot = -1;
                for (int i = 0; i < armor.m_slots.Count && slot < 0; i++)
                {
                    List<ItemDrop.ItemData.ItemType> types = armor.m_slots[i].m_supportedTypes;
                    if (!used[i] && (types.Count == 0 || types.Contains(type)))
                    {
                        slot = i;
                    }
                }

                if (slot < 0)
                {
                    VillheimPlugin.Debug($"Armor stand item '{name}' has no free slot that takes it; left off.");
                    continue;
                }

                used[slot] = true;
                int variant = f.Length > 1 && int.TryParse(f[1], out int v) ? v : 0;
                zdo.Set((slot + "_item").GetStableHashCode(), name.GetStableHashCode());
                zdo.Set((slot + "_variant").GetStableHashCode(), variant);
                placed++;
            }

            if (placed > 0)
            {
                zdo.Set(KeyLocked, 1);
            }

            return placed > 0;
        }

        /// <summary>
        /// Writes a stand's item the way the game reads it. ItemStand.UpdateVisual reads ZDOVars.s_item with GetInt: the
        /// stable hash of the item prefab's name (ItemStand.UpdateAttach writes m_dropPrefab.name.GetStableHashCode()).
        /// The item written as its name in text read back as 0, so every stand showed empty (showcase test,
        /// 2026-11-11).
        /// </summary>
        internal static void SetItem(ZDO zdo, string prefabName, int variant, int quality)
        {
            zdo.Set(ZDOVars.s_item, prefabName.GetStableHashCode());
            zdo.Set(ZDOVars.s_variant, variant);
            zdo.Set(ZDOVars.s_quality, Mathf.Max(1, quality));
        }

        /// <summary>The item prefab name on a stand, or "" when it is empty. Reads the game's hash; a name in text
        /// written by older builds is still read.</summary>
        internal static string ItemName(ZDO zdo)
        {
            if (zdo == null)
            {
                return "";
            }

            int hash = zdo.GetInt(ZDOVars.s_item);
            if (hash != 0 && ObjectDB.instance != null)
            {
                GameObject prefab = ObjectDB.instance.GetItemPrefab(hash);
                if (prefab != null)
                {
                    return prefab.name;
                }
            }

            return zdo.GetString(ZDOVars.s_item, "");
        }

        /// <summary>A loose item placed as part of a design: it keeps its place, is never picked up and never despawns.</summary>
        internal static void LockLoose(GameObject instance)
        {
            ItemDrop drop = instance.GetComponent<ItemDrop>();
            ZNetView view = instance.GetComponent<ZNetView>();
            if (drop == null || view == null || !view.IsValid())
            {
                return;
            }

            view.GetZDO().Set(KeyLocked, 1);
            Hold(drop);
        }

        private static void Hold(ItemDrop drop)
        {
            drop.m_autoDestroy = false;
            drop.m_autoPickup = false;
            Rigidbody body = drop.GetComponent<Rigidbody>();
            if (body != null)
            {
                body.isKinematic = true;
            }
        }

        /// <summary>A locked loose item cannot be picked up by hand.</summary>
        [HarmonyPatch(typeof(ItemDrop), nameof(ItemDrop.Interact))]
        internal static class LooseInteractPatch
        {
            private static bool Prefix(ItemDrop __instance, ref bool __result)
            {
                if (!Locked(__instance.m_nview))
                {
                    return true;
                }

                __result = false;
                return false;
            }
        }

        /// <summary>... nor by walking past it.</summary>
        [HarmonyPatch(typeof(ItemDrop), nameof(ItemDrop.CanPickup))]
        internal static class LoosePickupPatch
        {
            private static void Postfix(ItemDrop __instance, ref bool __result)
            {
                if (__result && Locked(__instance.m_nview))
                {
                    __result = false;
                }
            }
        }

        /// <summary>The hover shows only the item's name, with no pick-up prompt.</summary>
        [HarmonyPatch(typeof(ItemDrop), nameof(ItemDrop.GetHoverText))]
        internal static class LooseHoverPatch
        {
            private static void Postfix(ItemDrop __instance, ref string __result)
            {
                if (Locked(__instance.m_nview))
                {
                    __result = Localization.instance.Localize(__instance.m_itemData.m_shared.m_name);
                }
            }
        }

        /// <summary>After a reload a locked loose item is held in place again.</summary>
        [HarmonyPatch(typeof(ItemDrop), "Awake")]
        internal static class LooseAwakePatch
        {
            private static void Postfix(ItemDrop __instance)
            {
                if (Locked(__instance.m_nview))
                {
                    Hold(__instance);
                }
            }
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
                if (__result && __instance.m_nview != null && Locked(__instance.m_nview) &&
                    (__instance.GetComponentInChildren<ItemStand>() != null || __instance.GetComponentInChildren<ArmorStand>() != null))
                {
                    __result = false;
                }
            }
        }

        /// <summary>A locked armor stand keeps its gear: no item is taken off or hung on.</summary>
        [HarmonyPatch(typeof(ArmorStand), "UseItem")]
        internal static class ArmorUsePatch
        {
            private static bool Prefix(ArmorStand __instance, ref bool __result)
            {
                if (!Locked(__instance.m_nview))
                {
                    return true;
                }

                __result = true;
                return false;
            }
        }

        /// <summary>A locked armor stand never drops its gear, even when it breaks; the gear goes with the stand.</summary>
        [HarmonyPatch(typeof(ArmorStand), "DropItem")]
        internal static class ArmorDropPatch
        {
            private static bool Prefix(ArmorStand __instance)
            {
                return !Locked(__instance.m_nview);
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
