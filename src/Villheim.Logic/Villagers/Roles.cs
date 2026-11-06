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
    /// never by looks or gender. It does not limit work. It shows when there is nothing to do (protectors keep watch at
    /// the edge of the village, carers stay by the hearth, cook and make things) and in a fight: protectors take up a
    /// weapon and shield and defend, carers get away from the enemy while there is a protector to fight it.
    ///
    /// Trade: a small village (under six villagers) has no trades; everyone does a bit of everything, going where the
    /// village's need is greatest. From six villagers on, like Millenaire's villager types, each villager gets a trade
    /// in order of arrival (carpenter, woodcutter, miner, cook, then more of the same as the village grows) and spends
    /// most of his time on it, helping elsewhere only when his own work has nothing to do.
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
            Woodcutter,
            Miner,
            Cook,
        }

        public const int TradesFrom = 6;
        public static readonly int KeyArrival = "villheim_arrival".GetStableHashCode();

        private static readonly Trade[] TradeOrder =
        {
            Trade.Carpenter, Trade.Woodcutter, Trade.Miner, Trade.Cook, Trade.Woodcutter, Trade.Miner,
            Trade.Carpenter, Trade.Woodcutter, Trade.Miner, Trade.Cook, Trade.Woodcutter, Trade.Miner,
        };

        private static readonly string[] Weapons = { "Club", "Club", "SpearFlint", "SpearBronze", "SpearBronze" };
        private static readonly string[] Shields = { "ShieldWood", "ShieldWood", "ShieldBronzeBuckler", "ShieldBronzeBuckler", "ShieldBronzeBuckler" };

        private sealed class Roster
        {
            public float Time;
            public List<Villager> Villagers;
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
                if (character is Villager villager && !villager.IsDead() && villager.VillageId == villageId && villager.Zdo != null)
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

            Rosters[villageId] = new Roster { Time = UnityEngine.Time.time, Villagers = list };
            return list;
        }

        private static int Index(Villager villager)
        {
            int index = Of(villager.VillageId).IndexOf(villager);
            return index < 0 ? 0 : index;
        }

        public static Background BackgroundOf(Villager villager) => Index(villager) % 2 == 0 ? Background.Protector : Background.Carer;

        public static Trade TradeOf(Villager villager)
        {
            List<Villager> roster = Of(villager.VillageId);
            if (roster.Count < TradesFrom)
            {
                return Trade.None;
            }

            int index = Index(villager);
            return TradeOrder[index % TradeOrder.Length];
        }

        /// <summary>The village's chieftain, like Millenaire's town hall chief: the first settler still living.</summary>
        public static bool IsChieftain(Villager villager)
        {
            List<Villager> roster = Of(villager.VillageId);
            return roster.Count >= 2 && roster[0] == villager;
        }

        /// <summary>"chieftain", "carpenter" and so on for the hover text.</summary>
        public static string Title(Villager villager)
        {
            if (IsChieftain(villager))
            {
                return "chieftain";
            }

            Trade trade = TradeOf(villager);
            return trade != Trade.None ? trade.ToString().ToLowerInvariant() : null;
        }

        /// <summary>
        /// Tonight's watch, as Millenaire's guards keep watch: with three or more villagers, one protector each night (in
        /// turn, by day) stays up and patrols the edge of the village with a torch instead of sleeping.
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

            List<Villager> protectors = roster.Where(v => BackgroundOf(v) == Background.Protector).ToList();
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
        /// A fight is on. Protectors take a weapon and shield and let the game's own AI fight. Carers get away from the
        /// enemy while there is a protector to fight it (returns true while fleeing).
        /// </summary>
        public static bool OnThreat(Villager villager, VillagerAI ai, Character enemy, float dt)
        {
            Armed armed = ArmedStates.GetOrCreateValue(villager);
            armed.LastThreat = UnityEngine.Time.time;
            if (BackgroundOf(villager) == Background.Carer && HasProtector(villager.VillageId) && enemy != null &&
                villager.GetHealth() > 0f)
            {
                // Like Millenaire's shelter point: indoors, in his home or the longhouse; with no building yet, away.
                Vector3? shelter = ShelterSpot(villager);
                if (shelter.HasValue && Vector3.Distance(enemy.transform.position, shelter.Value) > 6f)
                {
                    if (Walker.For(villager).Go(villager, ai, dt, shelter.Value, 1f) != WalkResult.Walking)
                    {
                        ai.StopMoving();
                    }

                    return true;
                }

                ai.Flee(dt, enemy.transform.position);
                return true;
            }

            if (!armed.Holding)
            {
                armed.Holding = true;
                int tier = Gear(villager);
                EquipNamed(villager, Weapons[tier]);
                EquipNamed(villager, Shields[tier]);
                VillheimPlugin.Debug($"{villager.VillagerName} takes up arms.");
            }

            return false;
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
            if (ArmedStates.TryGetValue(villager, out Armed armed))
            {
                armed.LastThreat = UnityEngine.Time.time;
            }
        }

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
            return Mathf.Clamp(VillagerLooks.GearTier(VillageBrain.TierIndex(state.Plots.Count), state.Biome), 0, Weapons.Length - 1);
        }

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
