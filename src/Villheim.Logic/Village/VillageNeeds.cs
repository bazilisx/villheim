using System.Collections.Generic;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// What a village is short of right now, and where gatherers should take what they find. With a building going
    /// up, that is whatever the site chest still lacks for the rest of the building. Between buildings, villagers
    /// keep a modest stock of each material their biome has, and stop gathering once it is full.
    /// </summary>
    internal sealed class VillageNeeds
    {
        private const float CacheSeconds = 2f;

        public readonly Dictionary<string, int> Missing = new Dictionary<string, int>();
        public Vector3 DropOff;
        public bool ToChest;
        public bool SiteActive;
        public bool CanBuildNow;

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
            if (ConstructionSite.IsActive(hearth.Zdo))
            {
                needs.SiteActive = true;
                needs.CanBuildNow = ConstructionSite.NextShort(hearth) == null;
                Container chest = SiteChest.Find(hearth);
                if (chest != null)
                {
                    needs.ToChest = true;
                    needs.DropOff = chest.transform.position;
                }

                foreach (KeyValuePair<string, int> shortfall in ConstructionSite.Shortfall(hearth))
                {
                    // Savings in the village stock are on their way to the chest already.
                    int missing = chest != null ? shortfall.Value - state.Get(shortfall.Key) : shortfall.Value;
                    if (missing > 0)
                    {
                        needs.Missing[shortfall.Key] = missing;
                    }
                }
            }
            else if (state.Plots.Count < VillheimConfig.MaxBuildings.Value)
            {
                int target = VillheimConfig.MaxWoodPerBuilding.Value;
                foreach (string material in Materials.AllowedIn(state.Biome))
                {
                    if (!Materials.Tracked.Contains(material))
                    {
                        continue;
                    }

                    int goal = material == Materials.Wood || material == Materials.Stone ? target : target / 3;
                    int missing = goal - state.Get(material);
                    if (missing > 0)
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
