using System.Collections.Generic;
using System.Linq;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// What the village is working toward next, and what that needs from the chest, in one place for the hearth's hover
    /// text and the notice board (Tyler, T-11: "it's not clear what they need to move forward"). In order:
    ///
    /// 1. A new village chest, when it is gone.
    /// 2. The building going up: its next part, and what the builder waits for before he goes to work on it
    ///    (ConstructionSite.StartNeed).
    /// 3. Settling in: the next essential piece (the cooking station, the notice board, beds), and what it costs.
    /// 4. The next building: what breaking ground needs (noted by VillageBrain when it waits for it).
    /// 5. Otherwise the pending project, or the next thing to make by the hearth.
    /// </summary>
    internal static class NextStep
    {
        internal sealed class Step
        {
            public string What;
            public readonly Dictionary<string, int> Needs = new Dictionary<string, int>();
        }

        private static readonly Dictionary<int, Step> StartNeeds = new Dictionary<int, Step>();

        /// <summary>From VillageBrain: the next building waits for these materials before it can break ground.</summary>
        public static void NoteStart(int villageId, string what, Dictionary<string, int> needs)
        {
            var step = new Step { What = what };
            foreach (KeyValuePair<string, int> need in needs)
            {
                step.Needs[need.Key] = need.Value;
            }

            StartNeeds[villageId] = step;
        }

        public static void ClearStart(int villageId) => StartNeeds.Remove(villageId);

        /// <summary>What the next building waits for of this material before it can break ground (0 when nothing is noted).</summary>
        public static int StartNeedOf(int villageId, string material) =>
            StartNeeds.TryGetValue(villageId, out Step step) && step.Needs.TryGetValue(material, out int need) ? need : 0;

        public static Step For(VillageHearth hearth, VillageState state)
        {
            var step = new Step();
            if (VillageChest.IsLost(hearth))
            {
                step.What = "a new village chest";
                foreach (KeyValuePair<string, int> cost in VillageChest.RebuildCost())
                {
                    step.Needs[cost.Key] = cost.Value;
                }

                return step;
            }

            // Needs first (beds, the cooking station, the notice board, a chest when the main one is full): the builder
            // makes these before he goes on with the building.
            Amenities.Job job = Amenities.Upcoming(hearth);
            if (job != null && job.Essential)
            {
                Fill(step, job);
                return step;
            }

            if (ConstructionSite.IsActive(hearth.Zdo))
            {
                step.What = ConstructionSite.Progress(hearth) ?? "the building going up";
                foreach (KeyValuePair<string, int> need in ConstructionSite.Remaining(hearth))
                {
                    step.Needs[need.Key] = need.Value;
                }

                return step;
            }

            if (StartNeeds.TryGetValue(state.Id, out Step start) && state.Waiting.Contains(" to start a"))
            {
                return start;
            }

            string pending = Growth.PendingLabel(hearth, state);
            if (pending != "nothing")
            {
                step.What = pending;
                return step;
            }

            if (job != null)
            {
                Fill(step, job);
                return step;
            }

            step.What = "nothing for now";
            return step;
        }

        private static void Fill(Step step, Amenities.Job job)
        {
            step.What = $"a {job.Name}" + (job.Pieces > 1 ? $" ({job.Pieces} pieces to go)" : "");
            foreach (KeyValuePair<string, int> cost in job.Total ?? job.Cost)
            {
                step.Needs[cost.Key] = cost.Value;
            }
        }

        /// <summary>What is still short for the next step: need minus what the village holds, per material.</summary>
        public static Dictionary<string, int> Short(VillageHearth hearth, VillageState state, Step step)
        {
            var shortfall = new Dictionary<string, int>();
            foreach (KeyValuePair<string, int> need in step.Needs)
            {
                int have = VillageChest.Have(hearth, state, need.Key);
                if (have < need.Value)
                {
                    shortfall[need.Key] = need.Value - have;
                }
            }

            return shortfall;
        }

        /// <summary>
        /// The materials the next step lacks, as have/need, the biggest shortfall first, at most three: "wood 12/40,
        /// stone 3/10" (after Millénaire's project panel, T-38). Empty when the village holds all it needs.
        /// </summary>
        public static List<string> Lacking(VillageHearth hearth, VillageState state, Step step, int most = 3)
        {
            return step.Needs
                .Select(n => (Material: n.Key, Need: n.Value, Have: VillageChest.Have(hearth, state, n.Key)))
                .Where(n => n.Have < n.Need)
                .OrderByDescending(n => n.Need - n.Have)
                .Take(most)
                .Select(n => $"{Materials.Label(n.Material)} {n.Have}/{n.Need}")
                .ToList();
        }

        /// <summary>"Next: a home. Wood 12/40, stone 3/10." or "Building a home: roof, 60% done." when nothing is lacking.</summary>
        public static string Text(VillageHearth hearth, VillageState state)
        {
            Step step = For(hearth, state);
            string what = step.What.StartsWith("building ") || step.What.StartsWith("taking down")
                ? char.ToUpperInvariant(step.What[0]) + step.What.Substring(1)
                : "Next: " + step.What;
            List<string> lacking = Lacking(hearth, state, step);
            if (lacking.Count == 0)
            {
                return what + ".";
            }

            string list = string.Join(", ", lacking);
            return $"{what}. {char.ToUpperInvariant(list[0])}{list.Substring(1)}.";
        }
    }
}
