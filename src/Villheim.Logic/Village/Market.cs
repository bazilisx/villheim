using System.Collections.Generic;
using System.Linq;
using HarmonyLib;
using UnityEngine;
using Villheim.Logic.Villagers;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Trading with the village, a first step toward Millenaire's village shops. Crouch and talk to any villager and the
    /// game's own store window opens with what the village can spare from its chest: cooked food beyond a few meals,
    /// building materials beyond what the building going up still needs, and the hides and trophies the hunters bring
    /// home. What you buy comes out of the village chest and the coins go into it.
    ///
    /// The store needs a Trader component. Each villager gets an inactive one (it never runs its own update, so it
    /// needs none of the trader's animations), filled with the village's stock when the window opens. Harmony patches
    /// on the trader's bought and sold callbacks move the goods and coins.
    /// </summary>
    internal static class Market
    {
        private const string TraderObject = "VillheimMarket";

        internal static readonly Dictionary<string, (int Stack, int Price)> Prices = new Dictionary<string, (int, int)>
        {
            ["Wood"] = (10, 6), ["Stone"] = (10, 6), ["FineWood"] = (10, 15), ["RoundLog"] = (10, 15),
            ["Resin"] = (5, 5), ["LeatherScraps"] = (5, 5), ["DeerHide"] = (2, 6), ["Feathers"] = (5, 5),
            ["TrophyBoar"] = (1, 10), ["TrophyDeer"] = (1, 15), ["TrophyNeck"] = (1, 10),
        };

        /// <summary>Opens the village's store for the player. False when there is nothing to trade.</summary>
        public static bool Open(Villager villager, Player player)
        {
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            Container chest = hearth != null && hearth.IsValid ? VillageChest.Find(hearth) : null;
            if (chest == null || StoreGui.instance == null)
            {
                return false;
            }

            Trader trader = TraderOf(villager);
            trader.m_name = $"{villager.VillagerName} of {villager.VillageName}";
            trader.m_items = Stock(hearth, chest);
            if (trader.m_items.Count == 0)
            {
                Dialogue.Say(villager, "We've nothing to spare right now. Come back when the chest is fuller.");
                return true;
            }

            StoreGui.instance.Show(trader);
            return true;
        }

        private static Trader TraderOf(Villager villager)
        {
            Transform existing = villager.transform.Find(TraderObject);
            if (existing != null && existing.TryGetComponent(out Trader found))
            {
                return found;
            }

            var go = new GameObject(TraderObject);
            go.SetActive(false);
            go.transform.SetParent(villager.transform, false);
            Trader trader = go.AddComponent<Trader>();
            trader.m_randomTalk = new List<string>();
            trader.m_randomGreets = new List<string>();
            trader.m_randomGoodbye = new List<string>();
            trader.m_randomStartTrade = new List<string>();
            trader.m_randomBuy = new List<string>();
            trader.m_randomSell = new List<string>();
            return trader;
        }

        /// <summary>What the chest can spare, in the store's stacks and prices.</summary>
        internal static List<Trader.TradeItem> Stock(VillageHearth hearth, Container chest)
        {
            var items = new List<Trader.TradeItem>();
            Dictionary<string, int> building = ConstructionSite.Remaining(hearth);
            var counts = new Dictionary<string, int>();
            foreach (ItemDrop.ItemData item in chest.GetInventory().GetAllItems())
            {
                if (item.m_dropPrefab == null)
                {
                    continue;
                }

                counts.TryGetValue(item.m_dropPrefab.name, out int count);
                counts[item.m_dropPrefab.name] = count + item.m_stack;
            }

            foreach (KeyValuePair<string, int> held in counts)
            {
                GameObject prefab = ObjectDB.instance.GetItemPrefab(held.Key);
                ItemDrop drop = prefab != null ? prefab.GetComponent<ItemDrop>() : null;
                if (drop == null)
                {
                    continue;
                }

                building.TryGetValue(held.Key, out int reserved);
                int spare = held.Value - reserved;
                bool food = drop.m_itemData.m_shared.m_food > 0f && drop.m_itemData.m_shared.m_foodBurnTime > 0f;
                if (!Prices.TryGetValue(held.Key, out (int Stack, int Price) deal))
                {
                    if (!food)
                    {
                        continue;
                    }

                    spare -= 3; // a few meals stay for the village
                    deal = (1, Mathf.Max(3, Mathf.RoundToInt(drop.m_itemData.m_shared.m_food / 6f)));
                }

                if (spare >= deal.Stack)
                {
                    items.Add(new Trader.TradeItem { m_prefab = drop, m_stack = deal.Stack, m_price = deal.Price, m_requiredGlobalKey = "" });
                }
            }

            return items;
        }

        private static Container ChestOf(Trader trader)
        {
            Villager villager = trader != null ? trader.GetComponentInParent<Villager>() : null;
            VillageHearth hearth = villager != null ? VillageHearth.Find(villager.VillageId) : null;
            return hearth != null && hearth.IsValid ? VillageChest.Find(hearth) : null;
        }

        private static bool IsOurs(Trader trader) => trader != null && trader.gameObject.name == TraderObject;

        /// <summary>Bought: the goods leave the village chest and the coins go in.</summary>
        [HarmonyPatch(typeof(Trader), nameof(Trader.OnBought))]
        internal static class BoughtPatch
        {
            private static bool Prefix(Trader __instance, Trader.TradeItem item)
            {
                if (!IsOurs(__instance))
                {
                    return true;
                }

                Container chest = ChestOf(__instance);
                if (chest != null && item?.m_prefab != null)
                {
                    chest.GetInventory().RemoveItem(item.m_prefab.m_itemData.m_shared.m_name, item.m_stack);
                    GameObject coins = ObjectDB.instance.GetItemPrefab("Coins");
                    if (coins != null)
                    {
                        chest.GetInventory().AddItem(coins, item.m_price);
                    }
                }

                Villager villager = __instance.GetComponentInParent<Villager>();
                if (villager != null)
                {
                    Dialogue.Note(villager.VillageId, "trade");
                    Villagers.Social.AddReputation(VillageHearth.Find(villager.VillageId), Player.m_localPlayer, 1, "trade");
                    Dialogue.Say(villager, Random.value < 0.5f ? "Pleasure doing business." : "Spend it wisely. Or don't.");
                    __instance.m_items = Stock(VillageHearth.Find(villager.VillageId), chest);
                }

                return false;
            }
        }

        /// <summary>Sold: valuables the player sells go into the village chest; the village pays as the game prices them.</summary>
        [HarmonyPatch(typeof(Trader), nameof(Trader.OnSold))]
        internal static class SoldPatch
        {
            private static bool Prefix(Trader __instance)
            {
                return !IsOurs(__instance);
            }
        }
    }
}
