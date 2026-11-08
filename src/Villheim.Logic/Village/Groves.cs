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

        public static void Tick(VillageHearth hearth, VillageState state)
        {
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
