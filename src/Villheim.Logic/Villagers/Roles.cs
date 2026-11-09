using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Who does what in the village.
    ///
    /// Background role: every villager is a protector or a carer, by order of arrival (protector, carer, protector...),
    /// never by looks or gender. It is internal and never shown (signs, hover, chat). It does not limit work. It shows
    /// when there is nothing to do (protectors keep watch at the edge of the village, carers stay by the hearth, cook and
    /// make things) and in a fight: protectors take up a weapon and shield and defend, carers keep working, or get out of
    /// the way while a protector fights (Combat).
    ///
    /// Trade (D-075): with two or three villagers there are no trades and everyone does a bit of everything, going where
    /// the village's need is greatest. From four villagers the first two get carpenter (builds, cuts wood) and smith
    /// (mines, makes gear); the rest stay generalists. From six every villager gets a trade, in order of arrival, from
    /// the full list: carpenter, smith, cook, farmer, guard, hunter, healer, fisher (no fisher without a shore in reach),
    /// then more of the same as the village grows. Elders take only the light trades (cook, healer), and they take them
    /// first; otherwise an elder is a generalist who does only light work. Leader, elder and child are no trades: the
    /// leader gets a trade like anyone. Trades are worked out from the roster each time, never stored, so old saves load
    /// as they are.
    /// </summary>
    internal static class Roles
    {
        internal enum Background
        {
            Protector,
            Carer,
        }

        internal enum Trade
        {
            None,
            Carpenter,
            Smith,
            Cook,
            Farmer,
            Guard,
            Hunter,
            Fisher,
            Healer,
        }

        /// <summary>From this many grown villagers every one gets a trade.</summary>
        public const int TradesFrom = 6;

        /// <summary>From this many grown villagers there is a carpenter and a smith.</summary>
        public const int FirstTradesFrom = 4;

        public static readonly int KeyArrival = "villheim_arrival".GetStableHashCode();

        private static readonly Trade[] FirstTrades = { Trade.Carpenter, Trade.Smith };

        private static readonly Trade[] TradeOrder =
        {
            Trade.Carpenter, Trade.Smith, Trade.Cook, Trade.Farmer, Trade.Guard, Trade.Hunter, Trade.Healer, Trade.Fisher,
            Trade.Carpenter, Trade.Guard, Trade.Farmer, Trade.Smith, Trade.Hunter, Trade.Cook, Trade.Fisher, Trade.Guard,
            Trade.Healer, Trade.Carpenter, Trade.Farmer,
        };

        private static bool IsLight(Trade trade) => trade == Trade.Cook || trade == Trade.Healer;

        // A weapon for each gear tier (0 rags .. 4 bronze), made of what that tier's smith works with (D-050: these for
        // now, each culture's own weapons later). Everyone who fights also carries a bow and arrows (Defenders.CarryBow).
        private static readonly string[] Weapons = { "Club", "Club", "SpearFlint", "SpearFlint", "SwordBronze" };
        private static readonly string[] Shields = { "ShieldWood", "ShieldWood", "ShieldBronzeBuckler", "ShieldBronzeBuckler", "ShieldBronzeBuckler" };

        private sealed class Roster
        {
            public float Time;
            public List<Villager> Villagers;
            public Dictionary<Villager, Trade> Trades;
        }

        private sealed class Armed
        {
            public float LastThreat;
            public bool Holding;
        }

        private static readonly Dictionary<int, Roster> Rosters = new Dictionary<int, Roster>();
        private static readonly ConditionalWeakTable<Villager, Armed> ArmedStates = new ConditionalWeakTable<Villager, Armed>();

        /// <summary>The village's loaded villagers in order of arrival. Rebuilt every five seconds.</summary>
        private static List<Villager> Of(int villageId)
        {
            if (Rosters.TryGetValue(villageId, out Roster cached) && UnityEngine.Time.time - cached.Time < 5f &&
                cached.Villagers.All(v => v != null && !v.IsDead()))
            {
                return cached.Villagers;
            }

            var list = new List<Villager>();
            foreach (Character character in Character.GetAllCharacters())
            {
                if (character is Villager villager && !villager.IsDead() && villager.VillageId == villageId && villager.Zdo != null &&
                    !Childhood.IsChild(villager))
                {
                    list.Add(villager);
                }
            }

            // Arrival order; villagers from before arrivals were recorded come first, by seed.
            list.Sort((a, b) =>
            {
                int byArrival = a.Zdo.GetInt(KeyArrival, -1).CompareTo(b.Zdo.GetInt(KeyArrival, -1));
                return byArrival != 0 ? byArrival : a.Zdo.GetInt(Keys.VillagerSeed).CompareTo(b.Zdo.GetInt(Keys.VillagerSeed));
            });

            var roster = new Roster { Time = UnityEngine.Time.time, Villagers = list };
            Rosters[villageId] = roster;
            roster.Trades = Assign(villageId, list);
            return list;
        }

        /// <summary>The villager's place in the village's arrival order (0 for the first).</summary>
        public static int IndexOf(Villager villager) => Index(villager);

        private static int Index(Villager villager)
        {
            int index = Of(villager.VillageId).IndexOf(villager);
            return index < 0 ? 1 : index;
        }

        public static Background BackgroundOf(Villager villager) =>
            !Childhood.IsChild(villager) && Index(villager) % 2 == 0 ? Background.Protector : Background.Carer;

        public static Trade TradeOf(Villager villager)
        {
            if (villager == null || Childhood.IsChild(villager) || villager.Zdo == null)
            {
                return Trade.None;
            }

            Of(villager.VillageId);
            return Rosters.TryGetValue(villager.VillageId, out Roster roster) && roster.Trades != null &&
                   roster.Trades.TryGetValue(villager, out Trade trade)
                ? trade
                : Trade.None;
        }

        /// <summary>Who has which trade, for the roster just built (see the class notes).</summary>
        private static Dictionary<Villager, Trade> Assign(int villageId, List<Villager> roster)
        {
            var trades = new Dictionary<Villager, Trade>();
            int count = roster.Count;
            if (count < FirstTradesFrom)
            {
                return trades;
            }

            var open = new List<Trade>();
            if (count < TradesFrom)
            {
                open.AddRange(FirstTrades);
            }
            else
            {
                VillageHearth hearth = VillageHearth.Find(villageId);
                bool shore = hearth != null && hearth.IsValid && Fishing.ShoreOf(hearth) != null;
                for (int i = 0; open.Count < count && i < count * 3; i++)
                {
                    Trade trade = TradeOrder[i % TradeOrder.Length];
                    if (trade != Trade.Fisher || shore)
                    {
                        open.Add(trade);
                    }
                }
            }

            // Elders first, and only to a light trade; then the others in order of arrival.
            foreach (Villager villager in roster.Where(Elders.IsElder))
            {
                int light = open.FindIndex(IsLight);
                if (light >= 0)
                {
                    trades[villager] = open[light];
                    open.RemoveAt(light);
                }
            }

            foreach (Villager villager in roster)
            {
                if (open.Count == 0)
                {
                    break;
                }

                if (!Elders.IsElder(villager))
                {
                    trades[villager] = open[0];
                    open.RemoveAt(0);
                }
            }

            return trades;
        }

        /// <summary>Fights for the village: a guard, or a protector (internal).</summary>
        public static bool IsFighter(Villager villager) =>
            TradeOf(villager) == Trade.Guard || BackgroundOf(villager) == Background.Protector;

        /// <summary>The trade in a word for signs and hover ("carpenter"), or null for none.</summary>
        public static string Word(Trade trade) => trade == Trade.None ? null : trade.ToString().ToLowerInvariant();

        /// <summary>The village's Jarl, like Millenaire's town hall chief: the first settler still living.</summary>
        public static bool IsJarl(Villager villager)
        {
            List<Villager> roster = Of(villager.VillageId);
            return roster.Count >= 2 && roster[0] == villager;
        }

        /// <summary>"Jarl", "carpenter" and so on for the hover text.</summary>
        public static string Title(Villager villager)
        {
            if (Childhood.IsChild(villager))
            {
                return "child";
            }

            if (IsJarl(villager))
            {
                // Jarl in a Norse village; each culture has its own word (Cultures/cultures.txt "leader").
                return Cultures.LeaderTitle(villager.VillageId);
            }

            Trade trade = TradeOf(villager);
            if (trade == Trade.None && Elders.IsElder(villager))
            {
                return "elder";
            }

            return Word(trade);
        }

        /// <summary>
        /// Tonight's watch, as Millenaire's guards keep watch: with three or more villagers, one guard (or with no guard,
        /// one protector) each night, in turn by day, stays up and patrols the edge of the village with a torch instead
        /// of sleeping.
        /// </summary>
        public static bool IsNightWatch(Villager villager)
        {
            List<Villager> roster = Of(villager.VillageId);
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            bool fortified = hearth != null && hearth.IsValid && new VillageState(hearth.Zdo).Type == "fortified";
            if (roster.Count < (fortified ? 2 : 3) || EnvMan.instance == null)
            {
                return false;
            }

            // Two or more guards take it in turn. A lone guard keeps every other night, the protectors who are not
            // elders the nights between. With no guard, those protectors, then any protector.
            List<Villager> guards = roster.Where(v => TradeOf(v) == Trade.Guard).ToList();
            List<Villager> others = roster.Where(v => TradeOf(v) != Trade.Guard && BackgroundOf(v) == Background.Protector && !Elders.IsElder(v)).ToList();
            List<Villager> protectors = guards.Count >= 2 ? guards : guards.Count == 1 ? others.SelectMany(o => new[] { guards[0], o }).ToList() : others;
            if (protectors.Count == 0)
            {
                protectors = guards;
            }

            if (protectors.Count == 0)
            {
                protectors = roster.Where(v => BackgroundOf(v) == Background.Protector).ToList();
            }

            if (protectors.Count == 0)
            {
                return false;
            }

            // The night belongs to the day it started on.
            int day = EnvMan.instance.GetDay() - (EnvMan.instance.GetDayFraction() < 0.5f ? 1 : 0);
            return protectors[((day % protectors.Count) + protectors.Count) % protectors.Count] == villager;
        }

        /// <summary>The watchman's torch.</summary>
        public static void HoldTorch(Villager villager)
        {
            ItemDrop.ItemData right = villager.GetRightItem();
            if (right != null && right.m_dropPrefab != null && right.m_dropPrefab.name == "Torch")
            {
                return;
            }

            EquipNamed(villager, "Torch");
        }

        public static bool HasTrade(int villageId, Trade trade) => Of(villageId).Any(v => TradeOf(v) == trade);

        public static bool HasProtector(int villageId) =>
            Of(villageId).Any(v => BackgroundOf(v) == Background.Protector);

        /// <summary>
        /// Takes up the village's weapon of his tier for a fight (Villagers/Combat.cs), and the shield too for a
        /// protector. The shield goes away again some seconds after the fight (AfterThreat).
        /// </summary>
        public static void ArmForFight(Villager villager, bool shield)
        {
            Armed armed = ArmedStates.GetOrCreateValue(villager);
            armed.LastThreat = UnityEngine.Time.time;
            int tier = Gear(villager);
            EquipNamed(villager, Weapons[tier]);
            if (shield)
            {
                EquipNamed(villager, Shields[tier]);
            }

            // A bow and arrows go with every weapon, at every tier (D-050).
            Defenders.CarryBow(villager);
            if (!armed.Holding)
            {
                armed.Holding = true;
                VillheimPlugin.Debug($"{villager.VillagerName} takes up arms.");
            }
        }

        /// <summary>The middle of the villager's home, or of the longhouse, or null when the village has neither.</summary>
        public static Vector3? ShelterSpot(Villager villager)
        {
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid)
            {
                return null;
            }

            var state = new VillageState(hearth.Zdo);
            Vector3 home = villager.Zdo.GetVec3(Keys.VillagerHome, hearth.transform.position);
            Plot own = state.Plots.FirstOrDefault(p => Utils.DistanceXZ(p.Position, home) < 1f && p.Role != "Farm");
            Plot hub = state.Plots.FirstOrDefault(p => p.Role == "Hub");
            Plot shelter = own ?? hub;
            return shelter?.Position;
        }

        /// <summary>A hunter takes the weapon of his village's tier (no shield, it would only slow him down).</summary>
        public static void ArmForHunt(Villager villager)
        {
            EquipNamed(villager, Weapons[Gear(villager)]);
            Defenders.CarryBow(villager);
            if (ArmedStates.TryGetValue(villager, out Armed armed))
            {
                armed.LastThreat = UnityEngine.Time.time;
            }
        }

        /// <summary>
        /// Takes up the village's weapon and shield again, for a protector who put his bow away while the fight goes
        /// on (Villagers/Defenders.cs).
        /// </summary>
        public static void Rearm(Villager villager)
        {
            int tier = Gear(villager);
            EquipNamed(villager, Weapons[tier]);
            EquipNamed(villager, Shields[tier]);
            Armed armed = ArmedStates.GetOrCreateValue(villager);
            armed.Holding = true;
            armed.LastThreat = UnityEngine.Time.time;
        }

        /// <summary>
        /// A weapon for a fight or a hunt: clubs, spears, swords, knives, polearms and bows. Axes and pickaxes are the
        /// villagers' work tools and never count (T-108).
        /// </summary>
        public static bool IsWeapon(ItemDrop.ItemData item)
        {
            if (item?.m_shared == null)
            {
                return false;
            }

            switch (item.m_shared.m_skillType)
            {
                case Skills.SkillType.Clubs:
                case Skills.SkillType.Spears:
                case Skills.SkillType.Swords:
                case Skills.SkillType.Knives:
                case Skills.SkillType.Polearms:
                case Skills.SkillType.Bows:
                    return item.m_shared.m_itemType != ItemDrop.ItemData.ItemType.Tool &&
                           item.m_shared.m_itemType != ItemDrop.ItemData.ItemType.Torch;
                default:
                    return false;
            }
        }

        /// <summary>The village's gear tier for this villager (0 rags .. 4 bronze), capped by what the smith has made.</summary>
        public static int GearTier(Villager villager) => Gear(villager);

        /// <summary>Some time after a fight, protectors put the shield away (work puts the tool back in hand).</summary>
        public static void AfterThreat(Villager villager)
        {
            if (!ArmedStates.TryGetValue(villager, out Armed armed) || !armed.Holding || UnityEngine.Time.time - armed.LastThreat < 8f)
            {
                return;
            }

            armed.Holding = false;
            ItemDrop.ItemData left = villager.GetLeftItem();
            if (left != null && left.m_shared.m_itemType == ItemDrop.ItemData.ItemType.Shield)
            {
                villager.UnequipItem(left, false);
            }
        }

        private static int Gear(Villager villager)
        {
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid)
            {
                return 0;
            }

            var state = new VillageState(hearth.Zdo);
            return Mathf.Clamp(Smithing.Cap(hearth, VillagerLooks.GearTier(VillageBrain.TierIndex(state.Plots.Count), state.Biome)), 0, Weapons.Length - 1);
        }

        /// <summary>Takes the item out (from his pack, or a new one) and holds it, for work like fishing.</summary>
        public static void Hold(Villager villager, string prefabName) => EquipNamed(villager, prefabName);

        private static void EquipNamed(Villager villager, string prefabName)
        {
            GameObject prefab = ObjectDB.instance ? ObjectDB.instance.GetItemPrefab(prefabName) : null;
            if (prefab == null)
            {
                return;
            }

            string name = prefab.GetComponent<ItemDrop>()?.m_itemData?.m_shared?.m_name;
            ItemDrop.ItemData item = name != null ? villager.GetInventory().GetItem(name) : null;
            item = item ?? villager.PickupPrefab(prefab, 0, false);
            if (item != null)
            {
                villager.EquipItem(item, false);
            }
        }
    }
}
