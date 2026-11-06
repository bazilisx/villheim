using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// What a villager does with no work to do: walk to a spot near home (by night, near the hearth), stand there a
    /// while, then pick another. Spots are outside buildings and the building site, out of the fire, and away from
    /// players. A villager who has a player right next to him steps away. The game's own idle wandering is not used,
    /// because it walked villagers into houses and the fire.
    ///
    /// The game AI still takes over whenever an enemy is around (see <see cref="ThreatNear"/>).
    /// </summary>
    internal static class Loiter
    {
        private sealed class State
        {
            public bool HasSpot;
            public Vector3 Spot;
            public float StandUntil;
            public bool Night;
            public float LastRun;
            public float NextThreatCheck;
            public bool Threat;
        }

        private const float HearthClearance = 4f;
        private const float PlayerClearance = 2.5f;
        private const float PersonalSpace = 1f;
        private const float LookAtPlayerWithin = 5f;
        private const float ThreatCheckSeconds = 1f;
        private const int Tries = 8;

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();

        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            if (villager.IsDead())
            {
                return false;
            }

            State state = States.GetOrCreateValue(villager);
            bool night = VillheimConfig.VillagersGatherAtNight.Value && EnvMan.IsNight();
            if (state.Night != night || Time.time - state.LastRun > 1f)
            {
                // Night fell, or he just finished a chore somewhere else: pick a fresh spot.
                state.Night = night;
                state.HasSpot = false;
            }

            state.LastRun = Time.time;

            Walker walker = Walker.For(villager);
            if (!state.HasSpot)
            {
                state.Spot = PickSpot(villager, night);
                state.HasSpot = true;
                state.StandUntil = 0f;
                walker.Reset();
            }

            if (state.StandUntil <= 0f)
            {
                if (walker.Go(villager, ai, dt, state.Spot, 0.8f) == WalkResult.Walking)
                {
                    return true;
                }

                state.StandUntil = Time.time + Random.Range(8f, 20f);
            }

            ai.StopMoving();
            Player player = ClosestPlayer(villager.transform.position, out float distance);
            if (player != null && distance < PersonalSpace)
            {
                // Too close: find another spot, which is always away from players.
                state.HasSpot = false;
                return true;
            }

            if (player != null && distance < LookAtPlayerWithin)
            {
                ai.LookAt(player.GetEyePoint());
            }
            else if (night)
            {
                ai.LookAt(villager.Zdo.GetVec3(Keys.VillagerHearth, villager.transform.position) + Vector3.up);
            }

            if (Time.time > state.StandUntil)
            {
                state.HasSpot = false;
            }

            return true;
        }

        /// <summary>
        /// True while an enemy is about. The logic then leaves the villager to the game AI, which notices it, raises
        /// the alarm and fights. Checked once a second.
        /// </summary>
        public static bool ThreatNear(Villager villager, VillagerAI ai)
        {
            State state = States.GetOrCreateValue(villager);
            if (Time.time >= state.NextThreatCheck)
            {
                state.NextThreatCheck = Time.time + ThreatCheckSeconds;
                state.Threat = ai.FindEnemy() != null;
            }

            return state.Threat;
        }

        /// <summary>A spot to stand: around the hearth at night or for the homeless, otherwise just outside home.</summary>
        private static Vector3 PickSpot(Villager villager, bool night)
        {
            Vector3 position = villager.transform.position;
            Vector3 hearth = villager.Zdo.GetVec3(Keys.VillagerHearth, position);
            Vector3 home = villager.Zdo.GetVec3(Keys.VillagerHome, hearth);
            VillageHearth village = VillageHearth.Find(villager.VillageId);
            VillageState state = village != null && village.IsValid ? new VillageState(village.Zdo) : null;

            Vector3 center = hearth;
            float inner = 3.5f;
            float outer = night ? 6.5f : 8f;
            if (!night && Utils.DistanceXZ(home, hearth) > 1.5f)
            {
                float radius = HomeRadius(state, home);
                center = home;
                inner = radius + 1.5f;
                outer = radius + 4f;
            }

            Vector3 best = position;
            for (int i = 0; i < Tries; i++)
            {
                float angle = Random.Range(0f, Mathf.PI * 2f);
                float distance = Random.Range(inner, outer);
                Vector3 spot = center + new Vector3(Mathf.Sin(angle), 0f, Mathf.Cos(angle)) * distance;
                if (!ZoneSystem.instance.GetGroundHeight(spot, out float y) || y < ZoneSystem.instance.m_waterLevel + 0.2f)
                {
                    continue;
                }

                spot.y = y;
                best = spot;
                if (Clear(spot, hearth, state, village))
                {
                    return spot;
                }
            }

            return best;
        }

        private static bool Clear(Vector3 spot, Vector3 hearth, VillageState state, VillageHearth village)
        {
            if (Utils.DistanceXZ(spot, hearth) < HearthClearance)
            {
                return false;
            }

            ClosestPlayer(spot, out float toPlayer);
            if (toPlayer < PlayerClearance)
            {
                return false;
            }

            if (village != null && ConstructionSite.IsActive(village.Zdo) && ConstructionSite.InsideFootprint(village, spot))
            {
                return false;
            }

            if (state != null)
            {
                foreach (Plot plot in state.Plots)
                {
                    if (Utils.DistanceXZ(spot, plot.Position) < plot.Radius * 0.6f + 0.5f)
                    {
                        return false;
                    }
                }
            }

            return true;
        }

        private static float HomeRadius(VillageState state, Vector3 home)
        {
            if (state != null)
            {
                foreach (Plot plot in state.Plots)
                {
                    if (Utils.DistanceXZ(plot.Position, home) < 1f)
                    {
                        return plot.Radius * 0.6f;
                    }
                }
            }

            return 5f;
        }

        private static Player ClosestPlayer(Vector3 point, out float distance)
        {
            Player closest = null;
            distance = float.MaxValue;
            foreach (Player player in Player.GetAllPlayers())
            {
                float d = Utils.DistanceXZ(point, player.transform.position);
                if (d < distance)
                {
                    closest = player;
                    distance = d;
                }
            }

            return closest;
        }
    }
}
