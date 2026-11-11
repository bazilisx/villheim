using System.Collections.Generic;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// D-080 (answered 2026-11-10): decor is never free. Each material in a decor piece's recipe beyond the building
    /// materials (hides, metals, cloth, odd stones, bones and the like) is paid from the village's chests: the material
    /// itself when it comes from the village's biome or a neighbor on the way out (Meadows reaches the Black Forest; the
    /// Black Forest reaches the Meadows and the Swamp; and so on), otherwise the nearest material of the same kind that
    /// does. A Meadows home's lox rug costs troll hide; its silver candle holder, bronze.
    ///
    /// Exceptions in this code, which differ from D-080: materials the table does not know are left out (an unknown
    /// modded item never stalls a home); beds pay nothing extra; cloth has no stand-in for the Meadows, Black Forest or
    /// Swamp, so linen and jute are left out there; and only home decor stages (HomeDecor) pay this way, while the
    /// interior a design brings pays only its wood, fine wood, core wood and stone. The answer for each piece and biome
    /// is kept.
    /// </summary>
    internal static class DecorAnalogs
    {
        private enum Kind { Hide, Metal, Cloth, Stone, Wood, Bone, Misc }

        private static readonly Heightmap.Biome[] Order =
        {
            Heightmap.Biome.Meadows, Heightmap.Biome.BlackForest, Heightmap.Biome.Swamp, Heightmap.Biome.Mountain,
            Heightmap.Biome.Plains, Heightmap.Biome.Mistlands, Heightmap.Biome.AshLands, Heightmap.Biome.DeepNorth,
        };

        /// <summary>Material: its kind, the biome it comes from, and its rank within the kind (higher is finer).</summary>
        private static readonly Dictionary<string, (Kind Kind, Heightmap.Biome Biome, int Rank)> Table =
            new Dictionary<string, (Kind, Heightmap.Biome, int)>
            {
                ["LeatherScraps"] = (Kind.Hide, Heightmap.Biome.Meadows, 0),
                ["DeerHide"] = (Kind.Hide, Heightmap.Biome.Meadows, 1),
                ["TrollHide"] = (Kind.Hide, Heightmap.Biome.BlackForest, 2),
                ["WolfPelt"] = (Kind.Hide, Heightmap.Biome.Mountain, 3),
                ["LoxPelt"] = (Kind.Hide, Heightmap.Biome.Plains, 4),
                ["ScaleHide"] = (Kind.Hide, Heightmap.Biome.Mistlands, 5),
                ["AskHide"] = (Kind.Hide, Heightmap.Biome.AshLands, 6),

                ["Flint"] = (Kind.Metal, Heightmap.Biome.Meadows, 0),
                ["Copper"] = (Kind.Metal, Heightmap.Biome.BlackForest, 1),
                ["Tin"] = (Kind.Metal, Heightmap.Biome.BlackForest, 1),
                ["Bronze"] = (Kind.Metal, Heightmap.Biome.BlackForest, 2),
                ["BronzeNails"] = (Kind.Metal, Heightmap.Biome.BlackForest, 2),
                ["Iron"] = (Kind.Metal, Heightmap.Biome.Swamp, 3),
                ["IronNails"] = (Kind.Metal, Heightmap.Biome.Swamp, 3),
                ["Chain"] = (Kind.Metal, Heightmap.Biome.Swamp, 3),
                ["Silver"] = (Kind.Metal, Heightmap.Biome.Mountain, 4),
                ["BlackMetal"] = (Kind.Metal, Heightmap.Biome.Plains, 5),
                ["Flametal"] = (Kind.Metal, Heightmap.Biome.AshLands, 7),

                ["LinenThread"] = (Kind.Cloth, Heightmap.Biome.Plains, 2),
                ["Flax"] = (Kind.Cloth, Heightmap.Biome.Plains, 2),
                ["JuteRed"] = (Kind.Cloth, Heightmap.Biome.Mistlands, 3),
                ["JuteBlue"] = (Kind.Cloth, Heightmap.Biome.Mistlands, 3),

                ["Stone"] = (Kind.Stone, Heightmap.Biome.Meadows, 0),
                ["Obsidian"] = (Kind.Stone, Heightmap.Biome.Mountain, 2),
                ["Crystal"] = (Kind.Stone, Heightmap.Biome.Mountain, 2),
                ["BlackMarble"] = (Kind.Stone, Heightmap.Biome.Mistlands, 3),
                ["Grausten"] = (Kind.Stone, Heightmap.Biome.AshLands, 4),

                ["Wood"] = (Kind.Wood, Heightmap.Biome.Meadows, 0),
                ["FineWood"] = (Kind.Wood, Heightmap.Biome.BlackForest, 1),
                ["RoundLog"] = (Kind.Wood, Heightmap.Biome.BlackForest, 2),
                ["ElderBark"] = (Kind.Wood, Heightmap.Biome.Swamp, 3),
                ["YggdrasilWood"] = (Kind.Wood, Heightmap.Biome.Mistlands, 4),
                ["Blackwood"] = (Kind.Wood, Heightmap.Biome.AshLands, 5),

                ["BoneFragments"] = (Kind.Bone, Heightmap.Biome.BlackForest, 1),
                ["WitheredBone"] = (Kind.Bone, Heightmap.Biome.Swamp, 2),
                ["CharredBone"] = (Kind.Bone, Heightmap.Biome.AshLands, 3),

                ["Resin"] = (Kind.Misc, Heightmap.Biome.Meadows, 0),
                ["Feathers"] = (Kind.Misc, Heightmap.Biome.Meadows, 0),
                ["Coal"] = (Kind.Misc, Heightmap.Biome.BlackForest, 1),
                ["GreydwarfEye"] = (Kind.Misc, Heightmap.Biome.BlackForest, 1),
                ["Thistle"] = (Kind.Misc, Heightmap.Biome.BlackForest, 1),
                ["Guck"] = (Kind.Misc, Heightmap.Biome.Swamp, 2),
                ["Ooze"] = (Kind.Misc, Heightmap.Biome.Swamp, 2),
                ["Tar"] = (Kind.Misc, Heightmap.Biome.Plains, 3),
            };

        private static readonly Dictionary<string, Dictionary<string, int>> Kept = new Dictionary<string, Dictionary<string, int>>();

        public static bool On => LogicConfig.DecorPaidWithAnalogs == null || LogicConfig.DecorPaidWithAnalogs.Value;

        /// <summary>The biomes a village in <paramref name="biome"/> draws decor from: its own and its neighbors on the way out.</summary>
        public static bool InReach(Heightmap.Biome village, Heightmap.Biome from)
        {
            int v = System.Array.IndexOf(Order, village);
            int f = System.Array.IndexOf(Order, from);
            if (v < 0)
            {
                v = 0; // Ocean and the rest count as the Meadows
            }

            return f >= 0 && Mathf.Abs(f - v) <= 1;
        }

        /// <summary>
        /// What a decor piece costs beyond wood, fine wood, core wood and stone, after the swap to local materials. Keyed
        /// by item prefab name. Empty for a piece with nothing else in its recipe, or with the setting off.
        /// </summary>
        public static Dictionary<string, int> Extra(string prefabName, Heightmap.Biome biome)
        {
            if (!On || string.IsNullOrEmpty(prefabName))
            {
                return Empty;
            }

            string key = prefabName + "|" + biome;
            if (Kept.TryGetValue(key, out Dictionary<string, int> kept))
            {
                return kept;
            }

            var extra = new Dictionary<string, int>();
            GameObject prefab = ZNetScene.instance != null ? ZNetScene.instance.GetPrefab(prefabName) : null;
            Piece piece = prefab != null ? prefab.GetComponent<Piece>() : null;
            // Beds never wait on a hide: a villager without a bed matters more than the look of it.
            if (piece?.m_resources != null && prefab.GetComponent<Bed>() == null)
            {
                foreach (Piece.Requirement requirement in piece.m_resources)
                {
                    string material = requirement?.m_resItem != null ? requirement.m_resItem.gameObject.name : null;
                    if (material == null || requirement.m_amount <= 0 || Materials.Tracked.Contains(material))
                    {
                        continue; // building materials are paid as before (HomeDecor.Cost)
                    }

                    string paid = Local(material, biome);
                    if (paid == null)
                    {
                        continue;
                    }

                    extra.TryGetValue(paid, out int had);
                    extra[paid] = had + requirement.m_amount;
                }
            }

            Kept[key] = extra;
            return extra;
        }

        /// <summary>The material itself when in reach, else the finest of its kind in reach no finer than it. Null when unknown.</summary>
        public static string Local(string material, Heightmap.Biome biome)
        {
            if (!Table.TryGetValue(material, out var info))
            {
                return null;
            }

            if (InReach(biome, info.Biome) || System.Array.IndexOf(Order, info.Biome) < System.Array.IndexOf(Order, biome))
            {
                return material; // from here, a neighbor, or an earlier biome: paid as it is
            }

            string best = null;
            int bestRank = -1;
            foreach (KeyValuePair<string, (Kind Kind, Heightmap.Biome Biome, int Rank)> other in Table)
            {
                if (other.Value.Kind != info.Kind || other.Value.Rank > info.Rank || !InReach(biome, other.Value.Biome) &&
                    System.Array.IndexOf(Order, other.Value.Biome) > System.Array.IndexOf(Order, biome))
                {
                    continue;
                }

                if (other.Value.Rank > bestRank)
                {
                    best = other.Key;
                    bestRank = other.Value.Rank;
                }
            }

            return best;
        }

        private static readonly Dictionary<string, int> Empty = new Dictionary<string, int>();
    }
}
