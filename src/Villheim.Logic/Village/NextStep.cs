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

            if (ConstructionSite.IsActive(hearth.Zdo))
            {
                step.What = ConstructionSite.Progress(hearth) ?? "the building going up";
                foreach (KeyValuePair<string, int> need in ConstructionSite.StartNeed(hearth))
                {
                    step.Needs[need.Key] = need.Value;
                }

                return step;
            }

            Amenities.Job job = Amenities.Upcoming(hearth);
            if (job != null && job.Essential)
            {
                Fill(step, job);
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
            foreach (KeyValuePair<string, int> cost in Amenities.StartCost(job))
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

        /// <summary>"Next: a home. Needs 20 wood and 6 stone; has 12 wood and 0 stone."</summary>
        public static string Text(VillageHearth hearth, VillageState state)
        {
            Step step = For(hearth, state);
            string text = $"Next: {step.What}.";
            List<KeyValuePair<string, int>> needs = step.Needs.Where(n => n.Value > 0).OrderByDescending(n => n.Value).ToList();
            if (needs.Count == 0)
            {
                return text;
            }

            if (Short(hearth, state, step).Count == 0)
            {
                return text + " The chest holds what it needs.";
            }

            string Join(IEnumerable<string> parts)
            {
                List<string> list = parts.ToList();
                return list.Count <= 1 ? string.Concat(list) : string.Join(", ", list.Take(list.Count - 1)) + " and " + list.Last();
            }

            return text + $" Needs {Join(needs.Select(n => $"{n.Value} {Materials.Label(n.Key)}"))}; " +
                   $"has {Join(needs.Select(n => $"{VillageChest.Have(hearth, state, n.Key)} {Materials.Label(n.Key)}"))}.";
        }
    }
}
