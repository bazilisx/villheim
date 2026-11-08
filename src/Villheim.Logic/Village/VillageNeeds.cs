using System.Collections.Generic;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// What a village is short of right now, and where gatherers should take what they find.
    ///
    /// - The village chest is gone: what a new chest costs, before anything else. Gatherers bring it to the hearth.
    /// - A building is going up: whatever the village chest still lacks for the rest of the building.
    /// - Between buildings: what the next thing to make costs (beds, the workbench, the sign, then comfort pieces), and a
    ///   stock of each material the biome has for the next building, counting the chest, and nothing more.
    ///
    /// Gatherers take what they find to the village chest whenever it stands, otherwise to the hearth.
    /// </summary>
    internal sealed class VillageNeeds
    {
        private const float CacheSeconds = 2f;

        public readonly Dictionary<string, int> Missing = new Dictionary<string, int>();
        public Vector3 DropOff;
        public bool ToChest;
        public bool SiteActive;
        public bool CanBuildNow;
        public bool ChestLost;
        public bool CanRebuildChest;

        private float _time;

        private static readonly Dictionary<int, VillageNeeds> Cache = new Dictionary<int, VillageNeeds>();

        public bool Wants(string material) => Missing.ContainsKey(material);

        public static VillageNeeds For(int villageId)
        {
            if (Cache.TryGetValue(villageId, out VillageNeeds cached) && Time.time - cached._time < CacheSeconds)
            {
                return cached;
            }

            VillageHearth hearth = VillageHearth.Find(villageId);
            if (hearth == null || !hearth.IsValid)
            {
                return null;
            }

            var needs = new VillageNeeds { _time = Time.time, DropOff = hearth.transform.position };
            var state = new VillageState(hearth.Zdo);
            Container chest = VillageChest.Find(hearth);
            if (chest != null)
            {
                needs.ToChest = true;
                needs.DropOff = chest.transform.position;
            }

            if (VillageChest.IsLost(hearth))
            {
                needs.ChestLost = true;
                needs.CanRebuildChest = VillageChest.CanRebuild(state);
                foreach (KeyValuePair<string, int> cost in VillageChest.RebuildCost())
                {
                    int missing = cost.Value - state.Get(cost.Key);
                    if (missing > 0)
                    {
                        needs.Missing[cost.Key] = missing;
                    }
                }
            }
            else if (ConstructionSite.IsActive(hearth.Zdo))
            {
                needs.SiteActive = true;
                // The builder sets out once the chest holds enough for the next part of the building (BuildStartShare, D-048),
                // not each time one piece's worth comes in. Once at work he goes on while the chest lasts.
                needs.CanBuildNow = ConstructionSite.NextShort(hearth) == null && ConstructionSite.ReadyToStart(hearth, out _);
                foreach (KeyValuePair<string, int> shortfall in ConstructionSite.Shortfall(hearth))
                {
                    // Savings in the village stock are on their way into the chest already.
                    int missing = chest != null ? shortfall.Value - state.Get(shortfall.Key) : shortfall.Value;
                    if (missing > 0)
                    {
                        needs.Missing[shortfall.Key] = missing;
                    }
                }
            }
            else
            {
                // Settling in and comfort: what the next thing to make (a bed, the workbench, the sign, a bench) costs
                // beyond what the chest already has. The chest is filled for it before anyone sits down.
                Amenities.Job next = Amenities.Upcoming(hearth);
                if (next?.Cost != null)
                {
                    foreach (KeyValuePair<string, int> cost in next.Total ?? next.Cost)
                    {
                        int missing = cost.Value - VillageChest.Have(hearth, state, cost.Key);
                        if (missing > 0)
                        {
                            needs.Missing[cost.Key] = missing;
                        }
                    }
                }
            }

            if (!needs.ChestLost && !needs.SiteActive && state.Plots.Count < VillheimConfig.MaxBuildings.Value)
            {
                int target = VillheimConfig.MaxWoodPerBuilding.Value;
                foreach (string material in Materials.AllowedIn(state.Biome))
                {
                    if (!Materials.Tracked.Contains(material))
                    {
                        continue;
                    }

                    int goal = material == Materials.Wood || material == Materials.Stone ? target : target / 3;
                    if (material == Materials.Wood)
                    {
                        // Autumn: wood put by for the winter (Calendar).
                        goal = Mathf.RoundToInt(goal * Calendar.WoodFactor());
                    }

                    int missing = goal - VillageChest.Have(hearth, state, material);
                    needs.Missing.TryGetValue(material, out int already);
                    if (missing > already)
                    {
                        needs.Missing[material] = missing;
                    }
                }
            }

            Cache[villageId] = needs;
            return needs;
        }

        public static void Forget(int villageId) => Cache.Remove(villageId);
    }
}
