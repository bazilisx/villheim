using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;
using Random = UnityEngine.Random;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Villagers make their own gear. The village's gear tier still follows its size (VillagerLooks.GearTier), but
    /// clothes and weapons only go up a tier once the village has made that tier's gear (its "armoury" level):
    ///
    /// - Each tier has a set of real items (leather, then flint spear and leather helmet, then troll leather, then
    ///   bronze). Their costs are the game's own recipes, and they need the recipe's station at its level.
    /// - When the village has outgrown its armoury, the chest holds everything the next set costs, and the village has
    ///   the station, the smith (the carpenter, or the builder before there are trades) walks to the station by day,
    ///   works at it for about twenty seconds with the station's own craft effects, and the set is made: the materials
    ///   leave the chest, the armoury goes up a tier and everyone dresses for it.
    /// - A village without the station (bronze needs a forge, which villages don't build yet) can buy the set from a
    ///   visiting pedlar instead, if the chest has the coins (WorldLife).
    ///
    /// A village from before this (no armoury level saved) starts at the tier it already has, so nobody is undressed.
    /// SmithMakesGear off goes back to gear by size alone.
    /// </summary>
    internal static class Smithing
    {
        private static readonly int KeyArmoury = "villheim_armoury".GetStableHashCode();

        // Index = gear tier. Tier 0 is the clothes everyone starts in and costs nothing.
        private static readonly string[][] Sets =
        {
            new string[0],
            new[] { "ArmorLeatherChest", "ArmorLeatherLegs" },
            new[] { "SpearFlint", "HelmetLeather" },
            new[] { "ArmorTrollLeatherChest", "ArmorTrollLeatherLegs" },
            new[] { "ArmorBronzeChest", "SpearBronze", "ShieldBronzeBuckler" },
        };

        private static readonly string[] TierNames = { "rags", "leather", "flint and leather", "troll leather", "bronze" };

        private sealed class Job
        {
            public CraftingStation Station;
            public float WorkUntil;
            public float NextBlow;
            public bool Started;
        }

        private static readonly ConditionalWeakTable<Villager, Job> Jobs = new ConditionalWeakTable<Villager, Job>();
        private static readonly Dictionary<int, Villager> Smiths = new Dictionary<int, Villager>();

        private static bool On => LogicConfig.SmithMakesGear == null || LogicConfig.SmithMakesGear.Value;

        /// <summary>The tier the village's gear can reach: its size's tier, held back to what it has made.</summary>
        public static int Cap(VillageHearth hearth, int sizeTier)
        {
            if (!On || hearth == null || !hearth.IsValid)
            {
                return sizeTier;
            }

            ZDO zdo = hearth.Zdo;
            if (!zdo.GetBool("villheim_armoury_set".GetStableHashCode()))
            {
                // First look at this village: it keeps the tier it already has.
                if (zdo.IsOwner())
                {
                    zdo.Set(KeyArmoury, sizeTier);
                    zdo.Set("villheim_armoury_set".GetStableHashCode(), true);
                }

                return sizeTier;
            }

            return Mathf.Min(sizeTier, zdo.GetInt(KeyArmoury));
        }

        private static int SizeTier(VillageHearth hearth)
        {
            var state = new VillageState(hearth.Zdo);
            return VillagerLooks.GearTier(VillageBrain.TierIndex(state.Plots.Count), state.Biome);
        }

        /// <summary>The gear tier the village has made and wears (its armoury, held to its size).</summary>
        public static int Armoury(VillageHearth hearth) => hearth == null || !hearth.IsValid ? 0 : Cap(hearth, SizeTier(hearth));

        /// <summary>The next tier the village wants to make, or -1 when its armoury is up to its size.</summary>
        public static int Behind(VillageHearth hearth)
        {
            if (!On || hearth == null || !hearth.IsValid)
            {
                return -1;
            }

            int size = SizeTier(hearth);
            int armoury = Cap(hearth, size);
            return armoury < size && armoury + 1 < Sets.Length ? armoury + 1 : -1;
        }

        /// <summary>What a tier's set costs, from the game's recipes, and the station (name and level) it needs.</summary>
        private static Dictionary<string, int> Cost(int tier, out string station, out int level)
        {
            station = null;
            level = 1;
            var cost = new Dictionary<string, int>();
            foreach (string item in Sets[tier])
            {
                GameObject prefab = ObjectDB.instance != null ? ObjectDB.instance.GetItemPrefab(item) : null;
                ItemDrop drop = prefab != null ? prefab.GetComponent<ItemDrop>() : null;
                Recipe recipe = drop != null ? ObjectDB.instance.GetRecipe(drop.m_itemData) : null;
                if (recipe == null)
                {
                    continue;
                }

                if (recipe.m_craftingStation != null)
                {
                    // The set needs the most demanding station of its items (the forge over the workbench).
                    if (station == null || recipe.m_craftingStation.m_name.Contains("forge"))
                    {
                        station = recipe.m_craftingStation.m_name;
                    }

                    level = Mathf.Max(level, recipe.m_minStationLevel);
                }

                foreach (Piece.Requirement requirement in recipe.m_resources)
                {
                    if (requirement?.m_resItem == null)
                    {
                        continue;
                    }

                    string name = requirement.m_resItem.gameObject.name;
                    cost.TryGetValue(name, out int amount);
                    cost[name] = amount + requirement.m_amount;
                }
            }

            return cost;
        }

        private static CraftingStation StationFor(VillageHearth hearth, string station, int level)
        {
            var pieces = new List<Piece>();
            Piece.GetAllPiecesInRadius(hearth.transform.position, VillheimConfig.VillageRadius.Value + 10f, pieces);
            return pieces.Select(p => p != null ? p.GetComponent<CraftingStation>() : null)
                .FirstOrDefault(s => s != null && s.m_name == station && s.GetLevel() >= level);
        }

        private static bool ChestHas(Container chest, Dictionary<string, int> cost)
        {
            Inventory inventory = chest.GetInventory();
            foreach (KeyValuePair<string, int> need in cost)
            {
                GameObject prefab = ObjectDB.instance.GetItemPrefab(need.Key);
                string name = prefab != null ? prefab.GetComponent<ItemDrop>()?.m_itemData.m_shared.m_name : null;
                if (name == null || inventory.CountItems(name) < need.Value)
                {
                    return false;
                }
            }

            return true;
        }

        private static void Take(Container chest, Dictionary<string, int> cost)
        {
            Inventory inventory = chest.GetInventory();
            foreach (KeyValuePair<string, int> need in cost)
            {
                GameObject prefab = ObjectDB.instance.GetItemPrefab(need.Key);
                string name = prefab != null ? prefab.GetComponent<ItemDrop>()?.m_itemData.m_shared.m_name : null;
                if (name != null)
                {
                    inventory.RemoveItem(name, need.Value);
                }
            }
        }

        /// <summary>The armoury goes up a tier; everyone dresses for it at the next schedule check.</summary>
        public static void Raise(VillageHearth hearth, int tier, string how)
        {
            hearth.Zdo.Set(KeyArmoury, tier);
            Chronicle.Add(hearth, $"{how} The village has {TierNames[Mathf.Clamp(tier, 0, TierNames.Length - 1)]} gear now.");
            Dialogue.Note(hearth.VillageId, "forged");
            Moods.VillageThink(hearth.VillageId, "upgrade");
            VillheimPlugin.Log.LogInfo($"{hearth.VillageName}: armoury tier {tier} ({how}).");
        }

        /// <summary>For a pedlar: what the next set would cost in coins when the village has no station to make it.</summary>
        public static int PedlarPrice(VillageHearth hearth, out int tier)
        {
            tier = Behind(hearth);
            if (tier < 0)
            {
                return 0;
            }

            Cost(tier, out string station, out int level);
            return station == null || StationFor(hearth, station, level) == null ? 40 * tier : 0;
        }

        /// <summary>Item names the next set needs, so nobody trades them away first.</summary>
        public static HashSet<string> Reserved(VillageHearth hearth)
        {
            int tier = Behind(hearth);
            return tier < 0 ? new HashSet<string>() : new HashSet<string>(Cost(tier, out _, out _).Keys);
        }

        /// <summary>What the chest still lacks for the next set (item prefab name, how many), or nothing.</summary>
        public static Dictionary<string, int> Shortfall(VillageHearth hearth)
        {
            var missing = new Dictionary<string, int>();
            int tier = Behind(hearth);
            Container chest = tier >= 0 ? VillageChest.Find(hearth) : null;
            if (chest == null)
            {
                return missing;
            }

            foreach (KeyValuePair<string, int> need in Cost(tier, out _, out _))
            {
                string name = Materials.SharedName(need.Key);
                int have = name != null ? chest.GetInventory().CountItems(name) : 0;
                if (have < need.Value)
                {
                    missing[need.Key] = need.Value - have;
                }
            }

            return missing;
        }

        public static string TierName(int tier) => TierNames[Mathf.Clamp(tier, 0, TierNames.Length - 1)];

        // ---------------------------------------------------------------- the smith at work

        private static bool IsSmith(Villager villager)
        {
            int id = villager.VillageId;
            if (Smiths.TryGetValue(id, out Villager smith) && smith != null && !smith.IsDead() && smith != villager)
            {
                return false;
            }

            Roles.Trade trade = Roles.TradeOf(villager);
            return trade == Roles.Trade.Carpenter ||
                   (trade == Roles.Trade.None && VillagerLooks.IsBuilder(villager.Zdo.GetInt(Keys.VillagerSeed)) && !Childhood.IsChild(villager));
        }

        /// <summary>One brain tick. True while the smith is at work.</summary>
        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            Job job = Jobs.GetOrCreateValue(villager);
            if (!job.Started)
            {
                if (!On || Random.value > 0.02f || !IsSmith(villager))
                {
                    return false;
                }

                float hour = EnvMan.instance != null ? EnvMan.instance.GetDayFraction() * 24f : 12f;
                VillageHearth hearth = VillageHearth.Find(villager.VillageId);
                int tier = Behind(hearth);
                if (hour < 8f || hour > 18f || tier < 0)
                {
                    return false;
                }

                Dictionary<string, int> cost = Cost(tier, out string stationName, out int level);
                Container chest = VillageChest.Find(hearth);
                CraftingStation station = stationName != null ? StationFor(hearth, stationName, level) : null;
                if (station == null || chest == null || cost.Count == 0 || !ChestHas(chest, cost))
                {
                    return false;
                }

                job.Started = true;
                job.Station = station;
                job.WorkUntil = 0f;
                Smiths[villager.VillageId] = villager;
                VillheimPlugin.Debug($"{villager.VillagerName} goes to make {TierName(tier)} gear at the {station.m_name}.");
            }

            if (job.Station == null)
            {
                Stop(villager, job);
                return false;
            }

            Vector3 at = job.Station.transform.position;
            Vector3 spot = at + (villager.transform.position - at).Horizontal().normalized * 1.4f;
            if (job.WorkUntil <= 0f)
            {
                WalkResult walk = Walker.For(villager).Go(villager, ai, dt, spot, 0.4f);
                if (walk == WalkResult.Stuck)
                {
                    Stop(villager, job);
                    return false;
                }

                if (walk == WalkResult.Walking)
                {
                    return true;
                }

                job.WorkUntil = Time.time + 20f;
            }

            ai.StopMoving();
            ai.LookAt(at + Vector3.up * 0.8f);
            if (Time.time >= job.NextBlow)
            {
                job.NextBlow = Time.time + 2.2f;
                Poses.Trigger(villager, "interact");
            }

            if (Time.time < job.WorkUntil)
            {
                return true;
            }

            Finish(villager, job);
            return false;
        }

        private static void Finish(Villager villager, Job job)
        {
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            int tier = Behind(hearth);
            Container chest = hearth != null ? VillageChest.Find(hearth) : null;
            if (tier >= 0 && chest != null)
            {
                Dictionary<string, int> cost = Cost(tier, out _, out _);
                if (ChestHas(chest, cost))
                {
                    Take(chest, cost);
                    job.Station.m_craftItemDoneEffects.Create(job.Station.transform.position, Quaternion.identity);
                    Raise(hearth, tier, $"{villager.VillagerName} made the village's {TierName(tier)} gear at the {Localization.instance.Localize(job.Station.m_name)}.");
                    Dialogue.Say(villager, Dialogue.LineFor(villager, "self", "event:forged") ?? "There. Everyone gets a fitting.");
                }
            }

            Stop(villager, job);
        }

        private static void Stop(Villager villager, Job job)
        {
            job.Started = false;
            job.Station = null;
            job.WorkUntil = 0f;
            if (Smiths.TryGetValue(villager.VillageId, out Villager smith) && smith == villager)
            {
                Smiths.Remove(villager.VillageId);
            }
        }

        public static string Describe(Villager villager) =>
            Jobs.TryGetValue(villager, out Job job) && job.Started && job.Station != null
                ? (job.WorkUntil > 0f ? "making gear at the " : "going to make gear at the ") + Localization.instance.Localize(job.Station.m_name)
                : null;

        public static string Report(VillageHearth hearth)
        {
            int size = SizeTier(hearth);
            int armoury = Cap(hearth, size);
            int next = Behind(hearth);
            if (next < 0)
            {
                return $"gear {TierName(armoury)} (up to the village's size)";
            }

            Dictionary<string, int> cost = Cost(next, out string station, out int level);
            bool has = station != null && StationFor(hearth, station, level) != null;
            return $"gear {TierName(armoury)}, wants {TierName(next)}: {string.Join(", ", cost.Select(c => c.Value + " " + c.Key))} at " +
                   $"{(station != null ? Localization.instance.Localize(station) + " level " + level : "no station")} ({(has ? "has it" : "missing")})";
        }
    }
}
