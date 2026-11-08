using System.Runtime.CompilerServices;
using UnityEngine;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Slow healing for every villager (T-54: one stood by the fire hurt and never got better when the chest had no
    /// food). Out of a fight he gets VillagerRegen percent of his health back each minute, RestRegenFactor times as
    /// fast while asleep, seated, or resting within a few meters of the hearth. Food still heals faster (Healing).
    /// </summary>
    internal static class Recovery
    {
        private const float Step = 5f;

        private sealed class State
        {
            public float Next;
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();

        public static void Tick(Villager villager)
        {
            State state = States.GetOrCreateValue(villager);
            if (Time.time < state.Next)
            {
                return;
            }

            state.Next = Time.time + Step;
            float max = villager.GetMaxHealth();
            if (villager.IsDead() || villager.GetHealth() >= max || Status.Current(villager) == Status.Doer.Fight)
            {
                return;
            }

            float perMinute = Mathf.Max(0f, LogicConfig.VillagerRegen?.Value ?? 2f) / 100f * max;
            Vector3 hearth = villager.Zdo != null ? villager.Zdo.GetVec3(Keys.VillagerHearth, villager.transform.position) : villager.transform.position;
            bool resting = Sleep.IsAsleep(villager) || Poses.IsPosed(villager) ||
                           (Utils.DistanceXZ(villager.transform.position, hearth) < 6f &&
                            (Status.Current(villager) == Status.Doer.FreeTime || Status.Current(villager) == Status.Doer.BetweenJobs));
            float amount = perMinute * Step / 60f * (resting ? Mathf.Max(1f, LogicConfig.RestRegenFactor?.Value ?? 3f) : 1f);
            if (amount > 0f)
            {
                villager.Heal(amount, false);
            }
        }
    }
}
