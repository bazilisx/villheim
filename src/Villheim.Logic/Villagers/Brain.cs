using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Runs a villager each AI tick, in this order:
    ///
    /// 1. An enemy about: the game's own AI takes over, raises the alarm and fights (a sleeper wakes up).
    /// 2. Healing when badly hurt, then bed at bedtime.
    /// 3. Work (gathering, carrying, building) when the village needs it.
    /// 4. Otherwise free time: the fire, a stroll, a chat, a workbench; the evening ring and the night by the fire.
    ///
    /// Outside a fight the game's own wandering never runs, so it can't pull villagers away from what they are doing.
    /// Poses are asked for every tick and dropped when nothing asks (see <see cref="Poses"/>).
    /// </summary>
    internal static class Brain
    {
        private const float ThreatCheckSeconds = 0.5f;

        private sealed class State
        {
            public float NextThreatCheck;
            public bool Threat;
            public Character Enemy;
            public bool WasThreat;
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();

        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            if (villager.IsDead())
            {
                return false;
            }

            Body.Update(villager);
            Walker.For(villager).Tick(villager);

            bool threat = ThreatNear(villager, ai, out Character enemy);
            Moods.Update(villager, threat);
            State brain = States.GetOrCreateValue(villager);
            if (threat != brain.WasThreat)
            {
                brain.WasThreat = threat;
                bool fired = Dialogue.Event(villager.VillageId, threat ? "attack" : "fightover", villager.transform.position);
                if (!threat)
                {
                    Moods.FightOver(villager);
                    VillageHearth home = VillageHearth.Find(villager.VillageId);
                    Player player = Player.m_localPlayer;
                    bool helped = fired && home != null && player != null &&
                                  Vector3.Distance(player.transform.position, villager.transform.position) < 25f;
                    if (helped)
                    {
                        Social.FoughtAlongside(home, player);
                    }

                    if (fired)
                    {
                        Chronicle.Add(villager.VillageId, helped ? $"Enemies came to the village. {player.GetPlayerName()} fought beside us."
                            : "Enemies came to the village and were driven off.");
                    }
                }
            }

            if (threat)
            {
                Sleep.Wake(villager);
                Seats.StandUp(villager);
                Poses.Release(villager);
                VillageMood.NoteThreat(villager.VillageId);

                // Protectors arm and fight (the game's AI); carers get away while a protector is there.
                return Roles.OnThreat(villager, ai, enemy, dt);
            }

            Roles.AfterThreat(villager);

            Poses.BeginTick(villager);
            if (Healing.Update(villager, ai, dt, false))
            {
                // Healing comes first.
            }
            else if (Sleep.Update(villager, ai, dt))
            {
                // Bedtime.
            }
            else if (Social.Update(villager, ai, dt))
            {
                // Walking up to greet a newcomer, or to ask a known player for something.
            }
            else if (MorningHearth.Update(villager, ai, dt))
            {
                // A carer tends the hearth first thing in the morning.
            }
            else if (!Chores.Update(villager, ai, dt))
            {
                if (Chores.BetweenJobs(villager))
                {
                    ai.StopMoving();
                }
                else if (Repairs.Update(villager, ai, dt))
                {
                    // The builder mends what is broken.
                }
                else if (PathLaying.Update(villager, ai, dt))
                {
                    // Laying a path: background work, before free time.
                }
                else if (Hunting.Update(villager, ai, dt))
                {
                    // A protector hunts when the chest is low on food.
                }
                else if (!Healing.Update(villager, ai, dt, true))
                {
                    FreeTime.Update(villager, ai, dt);
                }
            }

            Poses.EndTick(villager);
            Seats.AfterTick(villager);
            Sleep.AfterTick(villager);
            Dialogue.Tick(villager);
            return true;
        }

        /// <summary>True while the game AI can sense an enemy. Checked twice a second.</summary>
        private static bool ThreatNear(Villager villager, VillagerAI ai, out Character enemy)
        {
            State state = States.GetOrCreateValue(villager);
            if (Time.time >= state.NextThreatCheck)
            {
                state.NextThreatCheck = Time.time + ThreatCheckSeconds + Random.Range(0f, 0.2f);
                state.Enemy = ai.FindEnemy();
                state.Threat = state.Enemy != null;
            }

            enemy = state.Enemy;
            return state.Threat;
        }
    }
}
