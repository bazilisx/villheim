using System.Collections.Generic;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// The chest that stands next to a building site, like the builder's chest in Millénaire. Villagers carry what
    /// they gather to it, builders take each piece's materials from it, and players can drop materials in to speed
    /// things up. When the building is finished the leftover materials go back into the village stock and the
    /// chest is taken away (unless someone left other things in it, in which case it stays).
    ///
    /// While the chest is not loaded (nobody nearby) the site pays from the village stock instead.
    /// </summary>
    internal static class SiteChest
    {
        private const string ChestPrefab = "piece_chest_wood";
        private const float MissingBeforeRespawn = 10f;

        private static readonly int KeyChestPosition = "villheim_chest_pos".GetStableHashCode();
        private static readonly int KeyChestVillage = "villheim_chest".GetStableHashCode();

        private static readonly Dictionary<int, Container> Cache = new Dictionary<int, Container>();
        private static readonly Dictionary<int, float> MissingSince = new Dictionary<int, float>();

        public static Container Find(VillageHearth hearth)
        {
            if (hearth == null || !hearth.IsValid)
            {
                return null;
            }

            int id = hearth.VillageId;
            if (Cache.TryGetValue(id, out Container cached) && cached && cached.m_nview && cached.m_nview.IsValid())
            {
                return cached;
            }

            Cache.Remove(id);
            Vector3 position = hearth.Zdo.GetVec3(KeyChestPosition, Vector3.zero);
            if (position == Vector3.zero)
            {
                return null;
            }

            foreach (Collider collider in Physics.OverlapSphere(position, 2f))
            {
                Container container = collider.GetComponentInParent<Container>();
                if (container && container.m_nview && container.m_nview.IsValid() &&
                    container.m_nview.GetZDO().GetInt(KeyChestVillage) == id)
                {
                    Cache[id] = container;
                    return container;
                }
            }

            return null;
        }

        /// <summary>Finds the site's chest, or puts one down next to the building if it is missing.</summary>
        public static Container Ensure(VillageHearth hearth, Vector3 spot)
        {
            Container chest = Find(hearth);
            if (chest != null || LogicConfig.SiteChest == null || !LogicConfig.SiteChest.Value)
            {
                MissingSince.Remove(hearth.VillageId);
                return chest;
            }

            Vector3 recorded = hearth.Zdo.GetVec3(KeyChestPosition, Vector3.zero);
            if (recorded != Vector3.zero)
            {
                // A recorded chest that has not shown up yet may just be loading in. Give it a moment so we never
                // put down a second one.
                if (!ZoneSystem.instance.IsZoneLoaded(recorded))
                {
                    return null;
                }

                if (!MissingSince.TryGetValue(hearth.VillageId, out float since))
                {
                    MissingSince[hearth.VillageId] = Time.time;
                    return null;
                }

                if (Time.time - since < MissingBeforeRespawn)
                {
                    return null;
                }
            }

            if (!ZoneSystem.instance.IsZoneLoaded(spot) || !ZoneSystem.instance.GetGroundHeight(spot, out float y))
            {
                return null;
            }

            GameObject prefab = ZNetScene.instance ? ZNetScene.instance.GetPrefab(ChestPrefab) : null;
            if (prefab == null)
            {
                return null;
            }

            spot.y = y;
            Vector3 toHearth = hearth.transform.position - spot;
            toHearth.y = 0f;
            Quaternion rotation = toHearth.sqrMagnitude > 0.01f ? Quaternion.LookRotation(toHearth) : Quaternion.identity;
            GameObject go = Object.Instantiate(prefab, spot, rotation);
            chest = go.GetComponent<Container>();
            if (chest == null || chest.m_nview == null || !chest.m_nview.IsValid())
            {
                return null;
            }

            chest.m_nview.GetZDO().Set(KeyChestVillage, hearth.VillageId);
            chest.m_nview.GetZDO().Set(Keys.BuiltBy, hearth.VillageId);
            hearth.Zdo.Set(KeyChestPosition, spot);
            Cache[hearth.VillageId] = chest;
            MissingSince.Remove(hearth.VillageId);
            VillheimPlugin.Debug($"{hearth.VillageName} put a chest down by its building site at {spot}.");
            return chest;
        }

        public static Vector3 Position(VillageHearth hearth)
        {
            Container chest = Find(hearth);
            return chest != null ? chest.transform.position : hearth.Zdo.GetVec3(KeyChestPosition, Vector3.zero);
        }

        /// <summary>The chest can be changed right now (it exists and nobody has it open).</summary>
        public static bool Usable(Container chest)
        {
            return chest && chest.m_nview && chest.m_nview.IsValid() && !chest.IsInUse() && chest.GetInventory() != null;
        }

        public static int Count(Container chest, string material)
        {
            string name = Materials.SharedName(material);
            return chest && name != null && chest.GetInventory() != null ? chest.GetInventory().CountItems(name) : 0;
        }

        /// <summary>Puts materials in. Returns how many fitted.</summary>
        public static int Add(Container chest, string material, int amount)
        {
            GameObject prefab = Materials.Prefab(material);
            if (!Usable(chest) || prefab == null || amount <= 0)
            {
                return 0;
            }

            Claim(chest);
            Inventory inventory = chest.GetInventory();
            int stackSize = Mathf.Max(1, prefab.GetComponent<ItemDrop>().m_itemData.m_shared.m_maxStackSize);
            int added = 0;
            while (amount > 0)
            {
                int stack = Mathf.Min(amount, stackSize);
                if (!inventory.CanAddItem(prefab, stack) || !inventory.AddItem(prefab, stack))
                {
                    break;
                }

                added += stack;
                amount -= stack;
            }

            return added;
        }

        /// <summary>Takes all of the given amounts, or nothing if the chest is short of any of them.</summary>
        public static bool Take(Container chest, Dictionary<string, int> amounts)
        {
            if (!Usable(chest))
            {
                return false;
            }

            foreach (KeyValuePair<string, int> amount in amounts)
            {
                if (amount.Value > 0 && Count(chest, amount.Key) < amount.Value)
                {
                    return false;
                }
            }

            Claim(chest);
            foreach (KeyValuePair<string, int> amount in amounts)
            {
                if (amount.Value > 0)
                {
                    chest.GetInventory().RemoveItem(Materials.SharedName(amount.Key), amount.Value);
                }
            }

            return true;
        }

        /// <summary>
        /// The building is done: leftover materials go back to the village stock, and the chest is removed if
        /// nothing else is in it.
        /// </summary>
        public static void Settle(VillageHearth hearth, VillageState state)
        {
            Container chest = Find(hearth);
            hearth.Zdo.Set(KeyChestPosition, Vector3.zero);
            Cache.Remove(hearth.VillageId);
            if (chest == null || !chest.m_nview.IsValid())
            {
                return;
            }

            Claim(chest);
            foreach (string material in Materials.Tracked)
            {
                int count = Count(chest, material);
                if (count > 0)
                {
                    chest.GetInventory().RemoveItem(Materials.SharedName(material), count);
                    state.Add(material, count);
                }
            }

            if (chest.GetInventory().NrOfItems() == 0 && !chest.IsInUse())
            {
                ZNetScene.instance.Destroy(chest.gameObject);
            }
            else
            {
                chest.m_nview.GetZDO().Set(KeyChestVillage, 0);
            }
        }

        private static void Claim(Container chest)
        {
            if (!chest.m_nview.IsOwner())
            {
                chest.m_nview.ClaimOwnership();
            }
        }
    }
}
