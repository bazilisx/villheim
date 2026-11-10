using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Designs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Anything the village breaks down gives back all its materials, as it does for a player (Tyler, D-088, 2026-11-10):
    /// a piece every material it was built with, a tree its wood and its log's, a rock its stone, a bush or stump what it
    /// drops, a plant its crop. Nothing is dropped on the ground for a player to pick up: it goes straight into the
    /// village chest, and what does not fit into the village's stock.
    ///
    /// Used wherever the village takes something down: ruins and clutter on a plot, its own fence, an old building on an
    /// upgrade, chests and signs it no longer needs, the ground cleared round a new building or path.
    /// </summary>
    internal static class Refund
    {
        /// <summary>What breaking this down gives: item prefab name and count.</summary>
        public static Dictionary<string, int> Of(GameObject go)
        {
            var gives = new Dictionary<string, int>();
            if (go == null)
            {
                return gives;
            }

            void Add(string item, int amount)
            {
                if (!string.IsNullOrEmpty(item) && amount > 0)
                {
                    gives[item] = (gives.TryGetValue(item, out int had) ? had : 0) + amount;
                }
            }

            void Roll(DropTable table, int times = 1)
            {
                if (table == null)
                {
                    return;
                }

                for (int i = 0; i < Mathf.Clamp(times, 1, 12); i++)
                {
                    foreach (GameObject drop in table.GetDropList())
                    {
                        Add(drop != null ? drop.name : null, 1);
                    }
                }
            }

            Piece piece = go.GetComponent<Piece>();
            if (piece != null)
            {
                // Every material the piece takes, whatever it is (wood, stone, nails, hides, resin...).
                if (piece.m_resources != null)
                {
                    foreach (Piece.Requirement requirement in piece.m_resources)
                    {
                        if (requirement?.m_resItem != null)
                        {
                            Add(requirement.m_resItem.gameObject.name, requirement.m_amount);
                        }
                    }
                }

                // A chest's contents go to the village too.
                Container container = go.GetComponent<Container>();
                if (container != null && container.GetInventory() != null)
                {
                    foreach (ItemDrop.ItemData item in container.GetInventory().GetAllItems())
                    {
                        Add(item.m_dropPrefab != null ? item.m_dropPrefab.name : null, item.m_stack);
                    }
                }
            }
            else if (go.TryGetComponent(out TreeBase tree))
            {
                Roll(tree.m_dropWhenDestroyed);
                TreeLog log = tree.m_logPrefab != null ? tree.m_logPrefab.GetComponent<TreeLog>() : null;
                for (int depth = 0; log != null && depth < 3; depth++)
                {
                    Roll(log.m_dropWhenDestroyed);
                    TreeLog sub = log.m_subLogPrefab != null ? log.m_subLogPrefab.GetComponent<TreeLog>() : null;
                    if (sub != null)
                    {
                        Roll(sub.m_dropWhenDestroyed, Mathf.Max(1, log.m_subLogPoints.Length) - 1);
                    }

                    log = sub;
                }
            }
            else if (go.TryGetComponent(out TreeLog loose))
            {
                Roll(loose.m_dropWhenDestroyed);
            }
            else if (go.TryGetComponent(out MineRock5 big))
            {
                Roll(big.m_dropItems, big.m_hitAreas != null ? big.m_hitAreas.Count : 1);
            }
            else if (go.TryGetComponent(out MineRock rock))
            {
                Roll(rock.m_dropItems);
            }
            else if (go.TryGetComponent(out Pickable plant))
            {
                if (!plant.GetPicked())
                {
                    Add(plant.m_itemPrefab != null ? plant.m_itemPrefab.name : null, plant.m_amount);
                }
            }
            else if (go.GetComponent<Destructible>() != null)
            {
                Roll(go.GetComponent<DropOnDestroyed>()?.m_dropWhenDestroyed);
            }

            return gives;
        }

        /// <summary>Puts the materials in the village chest; what does not fit goes to the village's stock.</summary>
        public static void ToVillage(VillageHearth hearth, Dictionary<string, int> gives)
        {
            if (hearth == null || !hearth.IsValid || gives.Count == 0)
            {
                return;
            }

            var state = new VillageState(hearth.Zdo);
            Container chest = VillageChest.Find(hearth);
            foreach (KeyValuePair<string, int> give in gives)
            {
                int left = give.Value - (chest != null ? VillageChest.Add(chest, give.Key, give.Value) : 0);
                if (left > 0)
                {
                    state.Add(give.Key, left);
                }
            }
        }

        /// <summary>Breaks it down for the village: its materials in, its break effect shown, the object gone.</summary>
        public static Dictionary<string, int> TakeDown(VillageHearth hearth, GameObject go, bool effect = true)
        {
            Dictionary<string, int> gives = Of(go);
            ToVillage(hearth, gives);
            if (effect)
            {
                EffectList list = go.GetComponent<WearNTear>()?.m_destroyedEffect ?? go.GetComponent<TreeBase>()?.m_destroyedEffect ??
                                  go.GetComponent<TreeLog>()?.m_destroyedEffect ?? go.GetComponent<MineRock5>()?.m_destroyedEffect ??
                                  go.GetComponent<MineRock>()?.m_destroyedEffect ?? go.GetComponent<Destructible>()?.m_destroyedEffect;
                list?.Create(go.transform.position, go.transform.rotation);
            }

            ZNetView view = go.GetComponent<ZNetView>();
            if (view != null && view.IsValid())
            {
                view.ClaimOwnership();
                ZNetScene.instance.Destroy(go);
            }

            return gives;
        }

        public static string Describe(Dictionary<string, int> gives) =>
            gives.Count > 0 ? string.Join(", ", gives.Select(g => $"{g.Value} {g.Key}")) : "nothing";
    }
}
