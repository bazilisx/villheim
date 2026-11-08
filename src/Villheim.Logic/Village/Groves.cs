using System.Linq;
using UnityEngine;
using Villheim.Logic.Villagers;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// A grown village keeps woods to cut later, after Banished's foresters and orchards (which take years before the
    /// first harvest) and Living Factions' woodcutters who replant. The rules, not the code.
    ///
    /// - Once a day, a village of four or more buildings counts the standing trees within 60 m of its edge. With
    ///   fewer than GroveTrees, it owes three more saplings of its biome's usual tree (beech in the Meadows, pine or
    ///   fir in the Black Forest) on top of the one owed for each tree felled.
    /// - The saplings are planted by the villagers who already replant (Replanting.cs), out past the village edge,
    ///   and grow into trees the woodcutters fell years later in game time.
    ///
    /// Runs with WorldLife and Groves on.
    /// </summary>
    internal static class Groves
    {
        private static readonly int KeyDay = "villheim_grove_day".GetStableHashCode();

        private static bool On => LogicConfig.WorldLife != null && LogicConfig.WorldLife.Value &&
                                  (LogicConfig.Groves == null || LogicConfig.Groves.Value);

        private static int Today => EnvMan.instance != null ? EnvMan.instance.GetDay() : 0;

        private static readonly int KeyCopseDay = "villheim_copse_day".GetStableHashCode();

        public static void Tick(VillageHearth hearth, VillageState state)
        {
            Copse(hearth, state);
            if (!On || state.Plots.Count < 4 || hearth.Zdo.GetInt(KeyDay, -1) == Today)
            {
                return;
            }

            hearth.Zdo.Set(KeyDay, Today);
            int trees = Trees(hearth);
            int wanted = LogicConfig.GroveTrees != null ? LogicConfig.GroveTrees.Value : 25;
            if (trees >= wanted || Replanting.OwedCount(hearth) > 10)
            {
                return;
            }

            for (int i = 0; i < 3; i++)
            {
                Replanting.Owe(state.Id, "");
            }

            VillheimPlugin.Debug($"{state.Name}: {trees} trees round the village, wants {wanted}; three saplings to plant.");
            if (Random.value < 0.3f)
            {
                Chronicle.Add(hearth, "The woods round the village are thin. We are planting saplings for the years to come.");
            }
        }

        /// <summary>
        /// Copses for villages in biomes with few trees (T-24): once a day, from the first building, a village in one of
        /// CopseBiomes with fewer than CopseTrees standing trees round it adds CopseSaplingsPerDay saplings of a wood
        /// tree that grows in its biome (birch and oak in the Plains) to the planting list. They go in a copse just past
        /// the village edge (Replanting). Needs no WorldLife. A biome where none of those trees grows gets none.
        /// </summary>
        private static void Copse(VillageHearth hearth, VillageState state)
        {
            if (!LogicConfig.IsOn(LogicConfig.Copses) || state.Plots.Count < 1 || hearth.Zdo.GetInt(KeyCopseDay, -1) == Today ||
                !(LogicConfig.CopseBiomes?.Value ?? "").Split(',').Any(b => Cultures.TryBiome(b.Trim(), out Heightmap.Biome named) && named == state.Biome))
            {
                return;
            }

            hearth.Zdo.Set(KeyCopseDay, Today);
            int trees = Trees(hearth);
            int wanted = LogicConfig.CopseTrees?.Value ?? 20;
            if (trees >= wanted || Replanting.OwedCount(hearth) > 12)
            {
                return;
            }

            int count = Mathf.Max(0, LogicConfig.CopseSaplingsPerDay?.Value ?? 4);
            int planted = 0;
            for (int i = 0; i < count; i++)
            {
                string sapling = Replanting.SaplingForBiome(state.Biome);
                if (sapling == null)
                {
                    break;
                }

                Replanting.OweCopse(state.Id, sapling);
                planted++;
            }

            VillheimPlugin.Debug(planted > 0
                ? $"{state.Name}: {trees} trees round the village, wants {wanted}; {planted} saplings for the copse."
                : $"{state.Name}: no wood tree grows in the {state.Biome}, so no copse.");
            if (planted > 0 && Random.value < 0.3f)
            {
                Chronicle.Add(hearth, "Wood is scarce out here. We are planting a copse past the edge of the village.");
            }
        }

        /// <summary>Standing trees within 60 m of the village's edge (all layers: it runs once a day).</summary>
        public static int Trees(VillageHearth hearth)
        {
            float reach = VillheimConfig.VillageRadius.Value + 60f;
            Vector3 center = hearth.transform.position;
            return Physics.OverlapSphere(center, reach)
                .Select(c => c.GetComponentInParent<TreeBase>()).Where(t => t != null).Distinct().Count();
        }
    }
}
