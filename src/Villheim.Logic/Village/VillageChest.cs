using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// The village chest: one wood chest beside the hearth that holds the village's building materials. Villagers
    /// carry what they gather to it, players can drop materials in, and the builder pays each piece from it once it
    /// holds enough. It stays for good; materials saved up while nobody was around move into it when it loads.
    ///
    /// The first chest comes with the village. If it is destroyed (or taken down), getting it back comes first:
    /// building stops, everyone gathers wood for a new one, and the builder puts it back in the same place as soon
    /// as the village has what a wood chest costs. What spilled out is picked up again like any other drop.
    ///
    /// While the chest is not loaded (nobody nearby) the village pays from its saved-up stock instead.
    ///
    /// The storage chests (D-016, see StorageChests) count as part of it: Count on the main chest includes what they
    /// hold, and Take pays from the main chest first and then from them, so the builder takes from any of them.
    /// </summary>
    internal static class VillageChest
    {
        private const string ChestPrefab = "piece_chest_wood";
        private const float MissingBeforeLost = 10f;
        private const float FromHearth = 3.5f;

        private static readonly int KeyChestPosition = "villheim_chest_pos".GetStableHashCode();
        private static readonly int KeyChestVillage = "villheim_chest".GetStableHashCode();
        private static readonly int KeyChestLost = "villheim_chest_lost".GetStableHashCode();

        private static readonly Dictionary<int, Container> Cache = new Dictionary<int, Container>();
        private static readonly Dictionary<int, float> MissingSince = new Dictionary<int, float>();

        /// <summary>
        /// A village being set up at once by 'vh village spawn' (TestVillage): while this is its id, its chests count
        /// as holding plenty of everything and pay for anything without losing it. Set only within one frame.
        /// </summary>
        public static int FreeVillage;

        private const int Plenty = 1000000;

        private static bool Free(int village) => FreeVillage != 0 && village == FreeVillage;

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

            // A tall search: the ground may have been levelled under the chest since its place was recorded.
            foreach (Collider collider in Physics.OverlapCapsule(position + Vector3.down * 8f, position + Vector3.up * 8f, 2f))
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

        /// <summary>Records where the chest now stands, after it was moved (the hearth ground was levelled).</summary>
        public static void Moved(VillageHearth hearth, Container chest)
        {
            if (hearth != null && hearth.IsValid && chest != null)
            {
                hearth.Zdo.Set(KeyChestPosition, chest.transform.position);
                Cache[hearth.VillageId] = chest;
            }
        }

        /// <summary>The chest was destroyed and has not been rebuilt yet.</summary>
        public static bool IsLost(VillageHearth hearth)
        {
            return hearth != null && hearth.IsValid && hearth.Zdo.GetInt(KeyChestLost) == 1;
        }

        /// <summary>Where the chest stands: its recorded place, or 3.5 m to the side of the hearth across the village axis.</summary>
        public static Vector3 Spot(VillageHearth hearth)
        {
            Vector3 recorded = hearth.Zdo.GetVec3(KeyChestPosition, Vector3.zero);
            if (recorded != Vector3.zero)
            {
                return recorded;
            }

            var state = new VillageState(hearth.Zdo);
            Vector3 side = Quaternion.Euler(0f, state.Axis + 90f, 0f) * Vector3.forward;
            Vector3 spot = hearth.transform.position + side * FromHearth;
            if (ZoneSystem.instance.GetGroundHeight(spot, out float y))
            {
                spot.y = y;
            }

            return spot;
        }

        /// <summary>
        /// Finds the chest. Puts the first one down for free when the village has never had one, and notices when it
        /// has gone missing (destroyed or taken down), which makes rebuilding it the village's first job.
        /// </summary>
        public static Container Ensure(VillageHearth hearth)
        {
            Container chest = Find(hearth);
            if (chest != null || LogicConfig.SiteChest == null || !LogicConfig.SiteChest.Value)
            {
                MissingSince.Remove(hearth.VillageId);
                return chest;
            }

            if (IsLost(hearth))
            {
                return null;
            }

            Vector3 recorded = hearth.Zdo.GetVec3(KeyChestPosition, Vector3.zero);
            if (recorded == Vector3.zero)
            {
                return Place(hearth, Spot(hearth), "put its chest down by the hearth");
            }

            // A recorded chest that has not shown up yet may just be loading in. Give it a moment.
            if (!ZoneSystem.instance.IsZoneLoaded(recorded))
            {
                return null;
            }

            if (!MissingSince.TryGetValue(hearth.VillageId, out float since))
            {
                MissingSince[hearth.VillageId] = Time.time;
                return null;
            }

            if (Time.time - since >= MissingBeforeLost)
            {
                MissingSince.Remove(hearth.VillageId);
                hearth.Zdo.Set(KeyChestLost, 1);
                VillheimPlugin.Log.LogInfo($"{hearth.VillageName} lost its village chest; rebuilding it comes first.");
                VillageBrain.Announce(hearth, $"{hearth.VillageName} has lost its chest. The villagers will build a new one.");
            }

            return null;
        }

        /// <summary>What a new wood chest costs, from its vanilla recipe.</summary>
        public static Dictionary<string, int> RebuildCost()
        {
            GameObject prefab = ZNetScene.instance ? ZNetScene.instance.GetPrefab(ChestPrefab) : null;
            Dictionary<string, int> cost = prefab != null ? Designs.DesignSpawner.RecipeCost(prefab) : null;
            return cost != null && cost.Count > 0 ? cost : new Dictionary<string, int> { { Materials.Wood, 10 } };
        }

        /// <summary>The village has saved up enough for a new chest.</summary>
        public static bool CanRebuild(VillageState state)
        {
            foreach (KeyValuePair<string, int> cost in RebuildCost())
            {
                if (state.Get(cost.Key) < cost.Value)
                {
                    return false;
                }
            }

            return true;
        }

        /// <summary>The builder puts a new chest where the old one stood, paid from the saved-up stock.</summary>
        public static bool Rebuild(VillageHearth hearth)
        {
            var state = new VillageState(hearth.Zdo);
            if (!IsLost(hearth) || !CanRebuild(state))
            {
                return false;
            }

            Container chest = Place(hearth, Spot(hearth), "built a new chest by the hearth");
            if (chest == null)
            {
                return false;
            }

            foreach (KeyValuePair<string, int> cost in RebuildCost())
            {
                state.Add(cost.Key, -cost.Value);
            }

            hearth.Zdo.Set(KeyChestLost, 0);
            return true;
        }

        private static Container Place(VillageHearth hearth, Vector3 spot, string what)
        {
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
            Container chest = go.GetComponent<Container>();
            if (chest == null || chest.m_nview == null || !chest.m_nview.IsValid())
            {
                return null;
            }

            chest.m_nview.GetZDO().Set(KeyChestVillage, hearth.VillageId);
            chest.m_nview.GetZDO().Set(Keys.BuiltBy, hearth.VillageId);
            hearth.Zdo.Set(KeyChestPosition, spot);
            Cache[hearth.VillageId] = chest;
            MissingSince.Remove(hearth.VillageId);
            VillheimPlugin.Log.LogInfo($"{hearth.VillageName} {what} at {spot}.");
            return chest;
        }

        /// <summary>What the village has of a material: in its chest plus saved up and not moved in yet.</summary>
        public static int Have(VillageHearth hearth, VillageState state, string material)
        {
            Container chest = Find(hearth);
            return state.Get(material) + (chest != null ? Count(chest, material) : 0);
        }

        /// <summary>
        /// What the village holds of each building material, wherever it is kept: the main chest, the storage chests
        /// and the saved-up stock (D-007).
        /// </summary>
        public static Dictionary<string, int> Holdings(VillageHearth hearth)
        {
            var held = new Dictionary<string, int>();
            var state = new VillageState(hearth.Zdo);
            foreach (string material in Materials.Tracked)
            {
                held[material] = HaveAnywhere(hearth, state, material);
            }

            return held;
        }

        /// <summary>What the village has of a material in all its chests (Have counts the storage chests too) plus saved up.</summary>
        public static int HaveAnywhere(VillageHearth hearth, VillageState state, string material) => Have(hearth, state, material);

        /// <summary>The village a main chest belongs to, or 0 for any other chest.</summary>
        public static int VillageOf(Container chest) =>
            chest && chest.m_nview && chest.m_nview.IsValid() ? chest.m_nview.GetZDO().GetInt(KeyChestVillage) : 0;

        /// <summary>Moves everything the village has saved up into the chest, as far as it fits.</summary>
        public static void MoveStockIn(VillageHearth hearth, VillageState state)
        {
            Container chest = Find(hearth);
            if (chest == null || !Usable(chest))
            {
                return;
            }

            // Building materials, and anything else that came in to the stock (a feast's berries, a caravan's load, an
            // outpost's ore).
            foreach (string material in Materials.Tracked.Concat(state.Stock.Keys.Where(k => !Materials.Tracked.Contains(k))).ToList())
            {
                int saved = state.Get(material);
                if (saved <= 0 || Materials.Prefab(material) == null)
                {
                    continue;
                }

                int added = Add(chest, material, saved);
                if (added > 0)
                {
                    state.Add(material, -added);
                }
            }
        }

        public static Vector3 Position(VillageHearth hearth)
        {
            Container chest = Find(hearth);
            return chest != null ? chest.transform.position : hearth.Zdo.GetVec3(KeyChestPosition, Vector3.zero);
        }

        /// <summary>
        /// The chest can be changed right now. An open chest can be changed when this machine owns it, which is the
        /// case when the local player opened it: the open chest window shows the same inventory, so the counts
        /// change in front of them. A chest someone on another machine has open waits until they close it.
        /// </summary>
        public static bool Usable(Container chest)
        {
            if (!chest || !chest.m_nview || !chest.m_nview.IsValid() || chest.GetInventory() == null)
            {
                return false;
            }

            return !chest.IsInUse() || chest.m_nview.IsOwner();
        }

        /// <summary>What a chest holds of a material. For a village's main chest, its storage chests count too (D-016).</summary>
        public static int Count(Container chest, string material)
        {
            int village = VillageOf(chest);
            if (Free(village))
            {
                return Plenty;
            }

            int count = CountIn(chest, material);
            if (village != 0)
            {
                foreach (Container storage in StorageChests.Of(village))
                {
                    count += CountIn(storage, material);
                }
            }

            return count;
        }

        /// <summary>What this one chest holds of a material.</summary>
        public static int CountIn(Container chest, string material)
        {
            string name = Materials.SharedName(material);
            return chest && name != null && chest.GetInventory() != null ? chest.GetInventory().CountItems(name) : 0;
        }

        /// <summary>Materials put in by the village itself (villagers, refunds), by chest, since last read.</summary>
        public static readonly Dictionary<int, int> AddedByVillage = new Dictionary<int, int>();

        /// <summary>Building materials in the chest, all kinds together.</summary>
        public static int TotalMaterials(Container chest)
        {
            int total = 0;
            foreach (string material in Materials.Tracked)
            {
                total += CountIn(chest, material);
            }

            return total;
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

            // Counted, so a gift from a player can be told apart from villagers' own deliveries (see Villagers.Social).
            AddedByVillage.TryGetValue(chest.GetInstanceID(), out int before);
            AddedByVillage[chest.GetInstanceID()] = before + added;
            return added;
        }

        /// <summary>
        /// Takes all of the given amounts, or nothing if the chest is short of any of them. From a main chest, what it
        /// lacks comes out of the village's storage chests (D-016).
        /// </summary>
        public static bool Take(Container chest, Dictionary<string, int> amounts)
        {
            if (!Usable(chest))
            {
                return false;
            }

            int village = VillageOf(chest);
            if (Free(village))
            {
                return true;
            }

            List<Container> sources = new List<Container> { chest };
            if (village != 0)
            {
                sources.AddRange(StorageChests.Of(village).Where(Usable));
            }

            foreach (KeyValuePair<string, int> amount in amounts)
            {
                if (amount.Value > 0 && sources.Sum(c => CountIn(c, amount.Key)) < amount.Value)
                {
                    return false;
                }
            }

            foreach (KeyValuePair<string, int> amount in amounts)
            {
                int left = amount.Value;
                string name = Materials.SharedName(amount.Key);
                foreach (Container source in sources)
                {
                    int take = Mathf.Min(left, CountIn(source, amount.Key));
                    if (take <= 0)
                    {
                        continue;
                    }

                    Claim(source);
                    source.GetInventory().RemoveItem(name, take);
                    left -= take;
                    if (left <= 0)
                    {
                        break;
                    }
                }

                if (amount.Value > 0)
                {
                    VillheimPlugin.Debug($"Took {amount.Value} {Materials.Label(amount.Key)} from the village chests, " +
                                         $"{Count(chest, amount.Key)} left{(chest.IsInUse() ? " (chest open)" : "")}.");
                }
            }

            return true;
        }

        internal static void Claim(Container chest)
        {
            if (!chest.m_nview.IsOwner() && !chest.IsInUse())
            {
                chest.m_nview.ClaimOwnership();
            }
        }
    }
}
