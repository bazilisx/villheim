using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Making arrows (Tyler, 2026-11-08). Everyone who fights or hunts gets a quiver of 20 with his first bow, and every
    /// arrow loosed is used up. When he has fewer than 10 left and nothing else to do (the brain gets this far only
    /// with no work, bed or chore waiting), he goes to the village's workbench (the hearth while there is none), works
    /// at it for a few seconds and comes away with a full quiver of his village's tier. It costs the village nothing.
    /// Out of arrows in a fight, he fights with his weapon (Combat, Defenders).
    /// </summary>
    internal static class Fletching
    {
        private const int RestockBelow = 10;
        private const float WorkSeconds = 6f;

        private sealed class State
        {
            public bool Active;
            public Vector3 Spot;
            public Vector3 Look;
            public bool AtBench;
            public float WorkUntil;
            public float NextSwing;
            public float GiveUpAt;
            public float NextTry;
            public float LastRun;
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();

        public static string Describe(Villager villager) =>
            States.TryGetValue(villager, out State state) && state.Active && Time.time - state.LastRun < 1f
                ? (state.AtBench ? "making arrows at the workbench" : "making arrows by the fire")
                : null;

        /// <summary>True while he is off to make arrows, or making them.</summary>
        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            State state = States.GetOrCreateValue(villager);
            if (!state.Active)
            {
                if (Time.time < state.NextTry || !Defenders.HasQuiver(villager) || Childhood.IsChild(villager) ||
                    Defenders.ArrowCount(villager) >= RestockBelow || !Begin(villager, state))
                {
                    return false;
                }
            }

            state.LastRun = Time.time;
            if (state.WorkUntil <= 0f)
            {
                WalkResult step = Walker.For(villager).Go(villager, ai, dt, state.Spot, 0.8f);
                if (step == WalkResult.Walking && Time.time < state.GiveUpAt)
                {
                    return true;
                }

                if (step != WalkResult.Arrived && Utils.DistanceXZ(villager.transform.position, state.Spot) > 3f)
                {
                    VillheimPlugin.Debug($"{villager.VillagerName} could not get to the workbench to make arrows.");
                    End(state, 120f);
                    return false;
                }

                state.WorkUntil = Time.time + WorkSeconds;
                state.NextSwing = Time.time;
            }

            ai.StopMoving();
            ai.LookAt(state.Look);
            VillagerLooks.Hold(villager, VillagerLooks.Tool.Hammer);
            if (Time.time >= state.NextSwing)
            {
                state.NextSwing = Time.time + Random.Range(2f, 3f);
                Chores.ToolAnimation(villager, VillagerLooks.Tool.Hammer);
            }

            if (Time.time < state.WorkUntil)
            {
                return true;
            }

            Defenders.RefillArrows(villager);
            VillheimPlugin.Debug($"{villager.VillagerName} made arrows ({Defenders.ArrowCount(villager)} now).");
            End(state, 30f);
            return false;
        }

        private static bool Begin(Villager villager, State state)
        {
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid)
            {
                state.NextTry = Time.time + 30f;
                return false;
            }

            Vector3 center = hearth.transform.position;
            CraftingStation bench = Object.FindObjectsOfType<CraftingStation>()
                .Where(c => c != null && Utils.GetPrefabName(c.gameObject).Contains("workbench") &&
                            Utils.DistanceXZ(c.transform.position, center) < VillheimConfig.VillageRadius.Value)
                .OrderBy(c => Utils.DistanceXZ(c.transform.position, villager.transform.position)).FirstOrDefault();
            Vector3 at = bench != null ? bench.transform.position : center;
            Vector3 side = (villager.transform.position - at).Horizontal();
            side = side.sqrMagnitude > 0.01f ? side.normalized : Vector3.forward;
            state.Spot = at + side * (bench != null ? 1.4f : 2.5f);
            if (ZoneSystem.instance != null && ZoneSystem.instance.GetGroundHeight(state.Spot, out float y))
            {
                state.Spot.y = y;
            }

            state.Look = at + Vector3.up * 0.8f;
            state.AtBench = bench != null;
            state.Active = true;
            state.WorkUntil = 0f;
            state.GiveUpAt = Time.time + 40f;
            Walker.For(villager).Reset();
            return true;
        }

        private static void End(State state, float wait)
        {
            state.Active = false;
            state.WorkUntil = 0f;
            state.NextTry = Time.time + wait;
        }
    }
}
