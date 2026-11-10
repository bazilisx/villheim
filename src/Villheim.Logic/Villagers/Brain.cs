using System.Collections.Generic;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Runs a villager each AI tick, in this order:
    ///
    /// 1. An enemy about: Combat runs those with a part in the fight before the brain (responders, anyone fighting
    ///    back, those taking shelter). Everyone else goes on with the day below.
    /// 2. Healing when badly hurt, then bed at bedtime.
    /// 3. Work (gathering, carrying, building) when the village needs it.
    /// 4. Otherwise, by day, fixing up his home (HomeDecor); in the evening, some households at home (HomeLife).
    /// 5. Otherwise free time: the fire, a stroll, a chat, a workbench; the evening ring and the night by the fire.
    ///    Children play instead of working (ChildPlay); elders keep to work inside the village (Ages).
    ///
    /// The routine that ran him is recorded each tick (Status), for the hover text and the map.
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

            long probe = LagProbe.Now();
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
                // The call to arms comes only from the villagers who go after the threat (Combat). The end of a fight
                // is still news for everyone.
                if (!threat)
                {
                    bool fired = Dialogue.Event(villager.VillageId, "fightover", villager.transform.position);
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
                // Fighting, sheltering and fleeing are run by Combat before the brain (a prefix on the AI update). A
                // villager who gets this far has no part in the fight and goes on with his day.
                VillageMood.NoteThreat(villager.VillageId);
            }

            Roles.AfterThreat(villager);
            LagProbe.Add("villagers: brain, before the work chain (body, walker, threats, moods)", probe);

            probe = LagProbe.Now();
            Poses.BeginTick(villager);
            Status.Doer doer = Status.Doer.None;
            if (TestActs.Update(villager, ai, dt))
            {
                // 'vh act': a test action asked for by hand.
                doer = Status.Doer.Test;
            }
            else if (HuntTrips.Update(villager, ai, dt))
            {
                // Out on an overnight hunt, away, or walking back with what he got (D-078).
                doer = Status.Doer.Hunt;
            }
            else if (Healing.Update(villager, ai, dt, false))
            {
                // Healing comes first.
                doer = Status.Doer.Heal;
            }
            else if (Leaving.Update(villager, ai, dt))
            {
                // Packed up and walking out of the village for good.
                doer = Status.Doer.Leave;
            }
            else if (Escort.Update(villager, ai, dt))
            {
                // A protector following the horn, or running to help a friend of the village in a fight.
                doer = Status.Doer.Escort;
            }
            else if (Sleep.Update(villager, ai, dt))
            {
                // Bedtime.
                doer = Status.Doer.Sleep;
            }
            else if (Social.Update(villager, ai, dt))
            {
                // Walking up to greet a newcomer, or to ask a known player for something.
                doer = Status.Doer.Social;
            }
            else if (MorningHearth.Update(villager, ai, dt))
            {
                // A carer tends the hearth first thing in the morning.
                doer = Status.Doer.Hearth;
            }
            else if (Living.Holiday(villager.VillageId))
            {
                // A festival evening: no work, everyone at the hearth.
                FreeTime.Update(villager, ai, dt);
                doer = Status.Doer.FreeTime;
            }
            else if (ChildPlay.Update(villager, ai, dt))
            {
                // Children play and explore near the village; they take no jobs.
                doer = Status.Doer.Play;
            }
            else if (Childhood.IsChild(villager) && HomeLife.Update(villager, ai, dt))
            {
                // An evening at home with the family (D-073).
                doer = Status.Doer.Home;
            }
            else if (Childhood.IsChild(villager))
            {
                // Out of play hours a child has free time like everyone else, and never a job.
                FreeTime.Update(villager, ai, dt);
                doer = Status.Doer.FreeTime;
            }
            else if (Hunting.Update(villager, ai, dt))
            {
                // The village wants meat: its hunter goes out before any chore (Tyler: deer near the village and
                // nobody hunted, the protectors were always busy with something else first).
                doer = Status.Doer.Hunt;
            }
            else if (Tending.Update(villager, ai, dt))
            {
                // The healer goes to someone hurt (D-075).
                doer = Status.Doer.Tend;
            }
            else if (!Ages.OutOfVillageWork(villager) && Fishing.Update(villager, ai, dt))
            {
                // The fisher at the shore while the chests are short of fish (D-075).
                doer = Status.Doer.Fish;
            }
            else if (Chores.Update(villager, ai, dt))
            {
                doer = Status.Doer.Chores;
            }
            else if (Chores.BetweenJobs(villager))
            {
                ai.StopMoving();
                IdleLife.Tick(villager, ai);
                doer = Status.Doer.BetweenJobs;
            }
            else if (!Ages.OutOfVillageWork(villager) && Replanting.Update(villager, ai, dt))
            {
                // Replanting what was felled, out past the village.
                doer = Status.Doer.Replant;
            }
            else if (Repairs.Update(villager, ai, dt))
            {
                // The builder mends what is broken.
                doer = Status.Doer.Repair;
            }
            else if (Smithing.Update(villager, ai, dt))
            {
                // The smith makes the village's next set of gear at a station.
                doer = Status.Doer.Smith;
            }
            else if (PathLaying.Update(villager, ai, dt))
            {
                // Laying a path: background work, before free time.
                doer = Status.Doer.Path;
            }
            else if (Sorting.Update(villager, ai, dt))
            {
                // Carrying stacks from the full main chest to the storage chests (D-016).
                doer = Status.Doer.Sort;
            }
            else if (Farming.Update(villager, ai, dt))
            {
                // The farmer plants, harvests and sees to the animals.
                doer = Status.Doer.Farm;
            }
            else if (!Childhood.IsChild(villager) && Foraging.Update(villager, ai, dt))
            {
                // A carer or an elder picks berries and mushrooms when the chest is low on food (elders may forage).
                doer = Status.Doer.Forage;
            }
            else if (Healing.Update(villager, ai, dt, true))
            {
                doer = Status.Doer.Heal;
            }
            else if (Trophies.Update(villager, ai, dt))
            {
                // Picking up a trophy after a fight, or hanging one at home.
                doer = Status.Doer.Trophy;
            }
            else if (Fletching.Update(villager, ai, dt))
            {
                // Low on arrows with nothing else to do: more made at the workbench.
                doer = Status.Doer.Fletch;
            }
            else if (ElderWork.Update(villager, ai, dt))
            {
                // An elder's share of the village work: the fire, cooking, the chests, the farm and the like, slowly,
                // with rests between.
                doer = Status.Doer.Elder;
            }
            else if (HomeDecor.Update(villager, ai, dt))
            {
                // Nothing to do for the village: fixing up his home, or helping a neighbor with theirs (D-073).
                doer = Status.Doer.Decor;
            }
            else if (HomeLife.Update(villager, ai, dt))
            {
                // The day's work done: the evening at home, with the family if he has one, until bedtime (D-073).
                doer = Status.Doer.Home;
            }
            else
            {
                FreeTime.Update(villager, ai, dt);
                doer = Status.Doer.FreeTime;
            }

            // The whole chain of checks down to the one that took the turn (lag cluster B): a high number for a doer far
            // down the chain points at the checks above it.
            LagProbe.Add(ChainLabel(doer), probe);
            probe = LagProbe.Now();
            Status.Set(villager, doer);
            VillageStatus.Note(villager, doer, dt);
            HandItems.Tidy(villager, doer);
            Poses.EndTick(villager);
            LoopWatch.Update(villager);
            HomeLife.AfterTick(villager);
            Seats.AfterTick(villager);
            Sleep.AfterTick(villager);
            Dialogue.Tick(villager);
            LagProbe.Add("villagers: brain, after the work chain (status, hands, poses, talk)", probe);
            return true;
        }

        private static readonly Dictionary<Status.Doer, string> ChainLabels = new Dictionary<Status.Doer, string>();

        private static string ChainLabel(Status.Doer doer)
        {
            if (!ChainLabels.TryGetValue(doer, out string label))
            {
                ChainLabels[doer] = label = "villagers: brain work chain down to " + doer;
            }

            return label;
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
                if (Hunting.IsGame(seen) || Animals.IsVillageAnimal(seen))
                {
                    // A boar fighting the hunter, or a village animal: no threat to the village (T-58).
                    seen = null;
                }

                if (seen != null)
                {
                    state.Sightings++;
                    state.LastSeen = Time.time;
                    state.Enemy = seen;
                    // A creature the village's defender profile covers (deathsquitos near the Plains) is met at once.
                    bool close = Vector3.Distance(seen.transform.position, villager.transform.position) < 8f ||
                                 Defenders.IsTarget(villager, seen);
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
