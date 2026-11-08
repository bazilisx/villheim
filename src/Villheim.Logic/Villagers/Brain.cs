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
        private const float ThreatEndsAfter = 5f;

        private sealed class State
        {
            public float NextThreatCheck;
            public bool Threat;
            public Character Enemy;
            public bool WasThreat;
            public int Sightings;
            public float LastSeen = -100f;
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
            if (Wanderers.IsWanderer(villager))
            {
                // Pedlars, pilgrims and hermits belong to no village and run their own small routine.
                return Wanderers.Update(villager, ai, dt);
            }

            bool threat = ThreatNear(villager, ai, out Character enemy);
            Moods.Update(villager, threat);
            Living.VillagerTick(villager);
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
                // A fight: the game's AI moves at its own pace (protectors run to the enemy).
                villager.SetWalk(false);
                Sleep.Wake(villager);
                Seats.StandUp(villager);
                Poses.Release(villager);
                VillageMood.NoteThreat(villager.VillageId);

                // Protectors arm and fight (the game's AI); carers get away while a protector is there.
                return Roles.OnThreat(villager, ai, enemy, dt);
            }

            Roles.AfterThreat(villager);

            Poses.BeginTick(villager);
            if (TestActs.Update(villager, ai, dt))
            {
                // 'vh act': a test action asked for by hand.
            }
            else if (Healing.Update(villager, ai, dt, false))
            {
                // Healing comes first.
            }
            else if (Leaving.Update(villager, ai, dt))
            {
                // Packed up and walking out of the village for good.
            }
            else if (Escort.Update(villager, ai, dt))
            {
                // A protector following the horn, or running to help a friend of the village in a fight.
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
            else if (Living.Holiday(villager.VillageId))
            {
                // A festival evening: no work, everyone at the hearth.
                FreeTime.Update(villager, ai, dt);
            }
            else if (!Chores.Update(villager, ai, dt))
            {
                if (Chores.BetweenJobs(villager))
                {
                    ai.StopMoving();
                    IdleLife.Tick(villager, ai);
                }
                else if (Replanting.Update(villager, ai, dt))
                {
                    // Replanting what was felled, out past the village.
                }
                else if (Repairs.Update(villager, ai, dt))
                {
                    // The builder mends what is broken.
                }
                else if (Smithing.Update(villager, ai, dt))
                {
                    // The smith makes the village's next set of gear at a station.
                }
                else if (PathLaying.Update(villager, ai, dt))
                {
                    // Laying a path: background work, before free time.
                }
                else if (Hunting.Update(villager, ai, dt))
                {
                    // A protector hunts when the chest is low on food.
                }
                else if (Farming.Update(villager, ai, dt))
                {
                    // The farmer plants, harvests and sees to the animals.
                }
                else if (Foraging.Update(villager, ai, dt))
                {
                    // A carer picks berries and mushrooms when the chest is low on food.
                }
                else if (!Healing.Update(villager, ai, dt, true))
                {
                    FreeTime.Update(villager, ai, dt);
                }
            }

            Poses.EndTick(villager);
            LoopWatch.Update(villager);
            Seats.AfterTick(villager);
            Sleep.AfterTick(villager);
            Dialogue.Tick(villager);
            return true;
        }

        /// <summary>
        /// True while there is an enemy about, checked twice a second. Steadied both ways, so a creature at the edge of
        /// sight (in and out behind trees) doesn't flip a villager between fighting and working every half second: a
        /// fight starts once an enemy has been seen on two checks running (at once when it is close), and ends only
        /// after none has been seen for five seconds.
        /// </summary>
        internal static bool ThreatNear(Villager villager, VillagerAI ai, out Character enemy)
        {
            State state = States.GetOrCreateValue(villager);
            if (Time.time >= state.NextThreatCheck)
            {
                state.NextThreatCheck = Time.time + ThreatCheckSeconds + Random.Range(0f, 0.2f);
                Character seen = ai.FindEnemy();
                if (seen != null)
                {
                    state.Sightings++;
                    state.LastSeen = Time.time;
                    state.Enemy = seen;
                    bool close = Vector3.Distance(seen.transform.position, villager.transform.position) < 8f;
                    if (close || state.Sightings >= 2)
                    {
                        state.Threat = true;
                    }
                }
                else
                {
                    state.Sightings = 0;
                    if (Time.time - state.LastSeen > ThreatEndsAfter)
                    {
                        state.Threat = false;
                        state.Enemy = null;
                    }
                }
            }

            if (!ReferenceEquals(state.Enemy, null) && (!state.Enemy || state.Enemy.IsDead()))
            {
                state.Enemy = null;
                state.Threat = false;
            }

            enemy = state.Enemy;
            return state.Threat;
        }
    }
}
