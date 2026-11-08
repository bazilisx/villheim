using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Villagers;
using Random = UnityEngine.Random;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Work for players: the village asks for what none of its own people can get, after MineColonies' requests that
    /// wait for the player when no citizen can fill them, and Millenaire's quests with a time limit. The rules, not
    /// the code.
    ///
    /// - Once a day (ContractChancePerDay), with no contract up, the village posts one for the first of: what the
    ///   smith still lacks for the next gear (flint, hides), or a building material its pending work needs that its
    ///   biome does not give. A plain shortage of wood or stone gets no contract: villagers gather those.
    /// - The notice says how many and what it pays: about one and a half times the village store's price, in coins
    ///   from the chest, or in what the village can spare when it has too few coins. It shows on the notice board's
    ///   "Needed" sign and in the chronicle, and stands for three days.
    /// - It is met when the chest holds the asked amount more than it did when it went up. A player within 15 m of the
    ///   chest then is paid (into their inventory, or at their feet); met by a caravan or a haul, nobody is paid.
    ///
    /// Runs with WorldLife and Contracts on.
    /// </summary>
    internal static class Contracts
    {
        private static readonly int KeyContract = "villheim_contract".GetStableHashCode();
        private static readonly int KeyRolled = "villheim_contract_day".GetStableHashCode();

        private sealed class Contract
        {
            public string Item;
            public int Amount;
            public int Baseline;
            public string RewardItem;
            public int Reward;
            public int Posted;
        }

        private static bool On => LogicConfig.WorldLife != null && LogicConfig.WorldLife.Value &&
                                  (LogicConfig.Contracts == null || LogicConfig.Contracts.Value);

        private static int Today => EnvMan.instance != null ? EnvMan.instance.GetDay() : 0;

        private static Contract Read(ZDO zdo)
        {
            string[] p = zdo.GetString(KeyContract, "").Split('|');
            if (p.Length < 6)
            {
                return null;
            }

            int I(string s) => int.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out int v) ? v : 0;
            return new Contract { Item = p[0], Amount = I(p[1]), Baseline = I(p[2]), RewardItem = p[3], Reward = I(p[4]), Posted = I(p[5]) };
        }

        private static void Write(ZDO zdo, Contract c) =>
            zdo.Set(KeyContract, c == null ? "" : string.Join("|", c.Item, c.Amount.ToString(CultureInfo.InvariantCulture),
                c.Baseline.ToString(CultureInfo.InvariantCulture), c.RewardItem, c.Reward.ToString(CultureInfo.InvariantCulture),
                c.Posted.ToString(CultureInfo.InvariantCulture)));

        private static int Count(Container chest, string item)
        {
            string name = Materials.SharedName(item);
            return name != null ? chest.GetInventory().CountItems(name) : 0;
        }

        /// <summary>Hearth tick: check the contract that is up, or maybe post one.</summary>
        public static void Tick(VillageHearth hearth, VillageState state)
        {
            Container chest = VillageChest.Find(hearth);
            if (chest == null || !VillageChest.Usable(chest))
            {
                return;
            }

            Contract up = Read(hearth.Zdo);
            if (up != null)
            {
                Check(hearth, chest, up);
                return;
            }

            if (!On || hearth.Zdo.GetInt(KeyRolled, -1) == Today || state.Plots.Count < 2)
            {
                return;
            }

            hearth.Zdo.Set(KeyRolled, Today);
            float chance = LogicConfig.ContractChancePerDay != null ? LogicConfig.ContractChancePerDay.Value : 0.5f;
            if (Random.value <= chance)
            {
                Post(hearth, state, chest, out _);
            }
        }

        /// <summary>Puts up a contract for the first thing the village cannot get itself. False with a reason.</summary>
        internal static bool Post(VillageHearth hearth, VillageState state, Container chest, out string why)
        {
            (string Item, int Amount)? wanted = null;
            foreach (KeyValuePair<string, int> need in Smithing.Shortfall(hearth).OrderByDescending(n => n.Value))
            {
                wanted = (need.Key, need.Value);
                break;
            }

            if (wanted == null)
            {
                VillageNeeds needs = VillageNeeds.For(state.Id);
                HashSet<string> grows = Materials.AllowedIn(state.Biome);
                foreach (KeyValuePair<string, int> need in needs != null ? needs.Missing.OrderByDescending(n => n.Value) : Enumerable.Empty<KeyValuePair<string, int>>())
                {
                    if (!grows.Contains(need.Key))
                    {
                        wanted = (need.Key, Mathf.Clamp(need.Value, 5, 30));
                        break;
                    }
                }
            }

            if (wanted == null)
            {
                why = "the village can get everything it needs itself";
                return false;
            }

            (string item, int amount) = wanted.Value;
            float unit = Market.Prices.TryGetValue(item, out (int Stack, int Price) deal) ? deal.Price / (float)deal.Stack : 2f;
            int price = Mathf.Max(5, Mathf.RoundToInt(unit * amount * 1.5f));
            var contract = new Contract { Item = item, Amount = amount, Baseline = Count(chest, item), Posted = Today };
            int coins = Count(chest, "Coins");
            if (coins >= price)
            {
                contract.RewardItem = "Coins";
                contract.Reward = price;
            }
            else
            {
                // Too few coins: something the village can spare, as near the price as it has.
                Trader.TradeItem spare = Market.Stock(hearth, chest).Where(t => t.m_prefab != null && t.m_prefab.gameObject.name != item)
                    .OrderByDescending(t => t.m_price).FirstOrDefault();
                if (spare == null)
                {
                    why = "the village has nothing to pay with";
                    return false;
                }

                contract.RewardItem = spare.m_prefab.gameObject.name;
                contract.Reward = Mathf.Max(spare.m_stack, Mathf.Min(Count(chest, contract.RewardItem) / 2, Mathf.RoundToInt(price / (float)spare.m_price * spare.m_stack)));
            }

            Write(hearth.Zdo, contract);
            Chronicle.Add(hearth, $"We put up a notice: {amount} {Label(item)} wanted, {contract.Reward} {Label(contract.RewardItem)} paid. It stands three days.");
            Dialogue.Note(state.Id, "contract");
            NoticeBoard.Update(hearth, true);
            why = null;
            return true;
        }

        private static void Check(VillageHearth hearth, Container chest, Contract c)
        {
            int now = Count(chest, c.Item);
            if (now >= c.Baseline + c.Amount)
            {
                Write(hearth.Zdo, null);
                Player near = Player.GetAllPlayers().Where(p => Utils.DistanceXZ(p.transform.position, chest.transform.position) < 15f)
                    .OrderBy(p => Utils.DistanceXZ(p.transform.position, chest.transform.position)).FirstOrDefault();
                if (near != null && near == Player.m_localPlayer && Pay(chest, near, c))
                {
                    Chronicle.Add(hearth, $"{near.GetPlayerName()} brought the {c.Amount} {Label(c.Item)} we asked for, and was paid {c.Reward} {Label(c.RewardItem)}.");
                    near.Message(MessageHud.MessageType.Center, $"{hearth.VillageName} pays you {c.Reward} {Label(c.RewardItem)}.");
                    Moods.VillageThink(hearth.VillageId, "trade");
                }
                else
                {
                    Chronicle.Add(hearth, $"We have the {Label(c.Item)} we asked for now. The notice is down.");
                }

                NoticeBoard.Update(hearth, true);
                return;
            }

            if (Today - c.Posted >= 3)
            {
                Write(hearth.Zdo, null);
                Chronicle.Add(hearth, $"Nobody brought the {Label(c.Item)} we asked for. The notice came down.");
                NoticeBoard.Update(hearth, true);
            }
        }

        private static bool Pay(Container chest, Player player, Contract c)
        {
            GameObject prefab = Materials.Prefab(c.RewardItem);
            string name = Materials.SharedName(c.RewardItem);
            if (prefab == null || name == null)
            {
                return false;
            }

            int paid = Mathf.Min(c.Reward, chest.GetInventory().CountItems(name));
            if (paid <= 0)
            {
                return false;
            }

            chest.GetInventory().RemoveItem(name, paid);
            if (!player.GetInventory().AddItem(prefab, paid))
            {
                ItemDrop.DropItem(prefab.GetComponent<ItemDrop>().m_itemData, paid, player.transform.position + player.transform.forward + Vector3.up,
                    Quaternion.identity);
            }

            return true;
        }

        private static string Label(string item)
        {
            if (Materials.Tracked.Contains(item))
            {
                return Materials.Label(item);
            }

            string name = Materials.SharedName(item);
            return name != null && Localization.instance != null ? Localization.instance.Localize(name).ToLowerInvariant() : item.ToLowerInvariant();
        }

        /// <summary>The contract for the notice board's "Needed" sign, or null.</summary>
        public static string BoardText(VillageHearth hearth)
        {
            Contract c = hearth != null && hearth.IsValid ? Read(hearth.Zdo) : null;
            return c != null ? $"{c.Amount} {Label(c.Item)}, pays {c.Reward} {Label(c.RewardItem)}" : null;
        }

        public static string Describe(VillageHearth hearth)
        {
            Contract c = Read(hearth.Zdo);
            return c != null ? $"contract: {BoardText(hearth)}, posted day {c.Posted}, chest had {c.Baseline}" : "no contract";
        }

        /// <summary>'vh contract': the nearest village posts a contract now. 'vh contract clear' takes it down.</summary>
        public static string Command(string[] args)
        {
            Player player = Player.m_localPlayer;
            VillageHearth hearth = player != null ? VillageHearth.Closest(player.transform.position, 200f) : null;
            if (hearth == null)
            {
                return "No village within 200 m.";
            }

            if (!hearth.NView.IsOwner())
            {
                hearth.NView.ClaimOwnership();
            }

            if (args != null && args.Length > 0 && args[0] == "clear")
            {
                Write(hearth.Zdo, null);
                NoticeBoard.Update(hearth, true);
                return "Contract taken down.";
            }

            Container chest = VillageChest.Find(hearth);
            if (chest == null || !VillageChest.Usable(chest))
            {
                return "No village chest.";
            }

            if (Read(hearth.Zdo) != null)
            {
                return Describe(hearth);
            }

            return Post(hearth, new VillageState(hearth.Zdo), chest, out string why) ? Describe(hearth) : $"No contract: {why}.";
        }
    }
}
