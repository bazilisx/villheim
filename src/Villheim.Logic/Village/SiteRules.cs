using System.Linq;
using UnityEngine;
using Villheim.Prefabs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Which generated village sites become villages, so villages stay a rare, pleasant find. Like the game spaces its
    /// traders (and More World Locations its traders and ports), with every rule checked against the world's own list
    /// of placed locations, the same way on every machine:
    ///
    /// - Only a share of the sites are lived in (VillageChance, 50% by default), picked by the site's position.
    /// - No two villages within VillageSpacing (1500 m by default): of two lived-in sites too close together, only
    ///   one (decided by position) becomes a village.
    /// - No village within 400 m of a trader, merchant, port or harbour, the game's or a mod's.
    ///
    /// Villages lit by hand with the settle command skip these rules.
    /// </summary>
    internal static class SiteRules
    {
        private const float FromTraders = 400f;
        private static readonly string[] TraderWords = { "vendor", "trader", "merchant", "hildir", "bogwitch", "harbor", "harbour", "market", "dock" };

        public static bool Allowed(Vector3 site, out string why)
        {
            why = null;
            if (ZoneSystem.instance == null)
            {
                return true;
            }

            int chance = LogicConfig.VillageChance != null ? LogicConfig.VillageChance.Value : 50;
            if (Score(site) % 100 >= chance)
            {
                why = "left empty to keep villages rare";
                return false;
            }

            float spacing = LogicConfig.VillageSpacing != null ? LogicConfig.VillageSpacing.Value : 1500f;
            foreach (ZoneSystem.LocationInstance instance in ZoneSystem.instance.m_locationInstances.Values)
            {
                if (instance.m_location == null)
                {
                    continue;
                }

                string name = instance.m_location.m_prefabName ?? "";
                float distance = Utils.DistanceXZ(instance.m_position, site);
                if (name == VillageLocation.Name)
                {
                    if (distance < 1f || distance > spacing)
                    {
                        continue;
                    }

                    // Another lived-in site too close: the one with the lower score keeps it.
                    if (Score(instance.m_position) % 100 < chance && Score(instance.m_position) < Score(site))
                    {
                        why = $"another village site is {distance:0} m away";
                        return false;
                    }

                    continue;
                }

                string lower = name.ToLowerInvariant();
                bool trader = TraderWords.Any(w => lower.Contains(w)) ||
                              (lower.Contains("port") && !lower.Contains("portal") && !lower.Contains("support"));
                if (trader && distance < FromTraders)
                {
                    why = $"{name} is {distance:0} m away";
                    return false;
                }
            }

            return true;
        }

        /// <summary>A number fixed by the site's position, the same on every machine.</summary>
        private static int Score(Vector3 position)
        {
            unchecked
            {
                int x = Mathf.RoundToInt(position.x);
                int z = Mathf.RoundToInt(position.z);
                int hash = x * 73856093 ^ z * 19349663;
                hash ^= hash >> 13;
                hash *= 1274126177;
                return (hash & 0x7fffffff);
            }
        }
    }
}
