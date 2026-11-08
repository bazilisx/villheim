using System.Collections.Generic;
using UnityEngine;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// What a tree, log, stump or rock drops when it breaks, read from the game's own drop tables. A tree also counts
    /// what its logs drop, so a villager who needs core wood goes for a pine and one who needs fine wood goes for a
    /// birch or an oak.
    /// </summary>
    internal static class Yields
    {
        private static readonly Dictionary<string, HashSet<string>> Cache = new Dictionary<string, HashSet<string>>();

        public static bool GivesAny(GameObject go, ICollection<string> wanted)
        {
            if (go == null || wanted == null || wanted.Count == 0)
            {
                return false;
            }

            foreach (string drop in Of(go))
            {
                if (wanted.Contains(drop))
                {
                    return true;
                }
            }

            return false;
        }

        private static readonly HashSet<string> PlainWood = new HashSet<string> { "Wood" };

        public static HashSet<string> Of(GameObject go)
        {
            // A Yggdrasil shoot a village planted gives its people plain wood (D-052).
            if (Village.VillageWood.IsVillageWood(go))
            {
                return PlainWood;
            }

            string name = Utils.GetPrefabName(go);
            if (Cache.TryGetValue(name, out HashSet<string> drops))
            {
                return drops;
            }

            drops = new HashSet<string>();
            GameObject prefab = ZNetScene.instance ? ZNetScene.instance.GetPrefab(name) : null;
            Collect(prefab != null ? prefab : go, drops, 0);
            Cache[name] = drops;
            return drops;
        }

        private static void Collect(GameObject go, HashSet<string> drops, int depth)
        {
            if (go == null || depth > 4)
            {
                return;
            }

            if (go.TryGetComponent(out TreeBase tree))
            {
                Add(tree.m_dropWhenDestroyed, drops);
                Collect(tree.m_logPrefab, drops, depth + 1);
            }

            if (go.TryGetComponent(out TreeLog log))
            {
                Add(log.m_dropWhenDestroyed, drops);
                Collect(log.m_subLogPrefab, drops, depth + 1);
            }

            if (go.TryGetComponent(out MineRock5 rock5))
            {
                Add(rock5.m_dropItems, drops);
            }

            if (go.TryGetComponent(out MineRock rock))
            {
                Add(rock.m_dropItems, drops);
            }

            if (go.TryGetComponent(out Pickable pickable) && pickable.m_itemPrefab != null)
            {
                drops.Add(pickable.m_itemPrefab.name);
            }

            if (go.TryGetComponent(out DropOnDestroyed dropOnDestroyed))
            {
                Add(dropOnDestroyed.m_dropWhenDestroyed, drops);
            }

            if (go.TryGetComponent(out Destructible destructible) && destructible.m_spawnWhenDestroyed != null)
            {
                Collect(destructible.m_spawnWhenDestroyed, drops, depth + 1);
            }
        }

        private static void Add(DropTable table, HashSet<string> drops)
        {
            if (table?.m_drops == null)
            {
                return;
            }

            foreach (DropTable.DropData drop in table.m_drops)
            {
                if (drop.m_item != null)
                {
                    drops.Add(drop.m_item.name);
                }
            }
        }
    }
}
