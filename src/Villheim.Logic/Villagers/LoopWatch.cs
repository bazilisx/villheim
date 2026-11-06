using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Watches for villagers stuck in a loop: if what a villager is doing changes more than eight times in a minute,
    /// the log says so (once a minute) with the activities he keeps flipping between, so a loop can be found from the
    /// log without watching for it.
    /// </summary>
    internal static class LoopWatch
    {
        private sealed class State
        {
            public string Last;
            public readonly Queue<(float Time, string What)> Changes = new Queue<(float, string)>();
            public float NextReport;
            public float NextCheck;
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();

        public static void Update(Villager villager)
        {
            State state = States.GetOrCreateValue(villager);
            if (Time.time < state.NextCheck)
            {
                return;
            }

            state.NextCheck = Time.time + 0.5f;
            string now = VillagerBehaviour.Activity(villager) ?? "nothing";
            if (now == state.Last)
            {
                return;
            }

            state.Last = now;
            state.Changes.Enqueue((Time.time, now));
            while (state.Changes.Count > 0 && Time.time - state.Changes.Peek().Time > 60f)
            {
                state.Changes.Dequeue();
            }

            if (state.Changes.Count > 8 && Time.time >= state.NextReport)
            {
                state.NextReport = Time.time + 60f;
                string flips = string.Join(" / ", state.Changes.Select(c => c.What).Distinct().Take(6));
                VillheimPlugin.Log.LogInfo($"Loop watch: {villager.VillagerName} changed what he was doing {state.Changes.Count} times " +
                                           $"in a minute: {flips}. At {villager.transform.position}.");
            }
        }
    }
}
