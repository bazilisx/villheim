using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Protectors at a player's side: the horn at the hearth (proposal 35, after Guard Villagers' bell) and help in a
    /// fight near the village (proposal 37, after Bannerlord and Fallout 4's minutemen).
    ///
    /// - The horn: use the hearth while crouching. If the village counts the player a friend (standing 5 or more),
    ///   every grown protector within 80 m of the hearth arms himself and follows him for HornSeconds (240 s), then
    ///   goes back to his day. Once a game hour per village.
    /// - Help: every hearth tick, a friend of the village fighting within the village's radius plus 60 m (a creature
    ///   within 25 m has him as its target, or a hostile one is within 8 m) gets up to two protectors running to him.
    ///   They stay while there is an enemy within 20 m of the player and go home 8 s after the last one. Not at night
    ///   unless the village is being raided.
    /// - Once an enemy is in sight the brain's own fight takes over, as for any threat; this only brings them close.
    /// </summary>
    internal static class Escort
    {
        private sealed class Job
        {
            public Player Target;
            public float Until;
            public bool Help;
            public float LastEnemy;
        }

        private static readonly ConditionalWeakTable<Villager, Job> Jobs = new ConditionalWeakTable<Villager, Job>();
        private static readonly List<Villager> Escorts = new List<Villager>();
        private static readonly Dictionary<int, float> LastHorn = new Dictionary<int, float>();

        private static bool HornOn => Living.On(LogicConfig.Horn);

        private static bool HelpOn => Living.On(LogicConfig.HelpPlayers);

        public static bool IsEscorting(Villager villager) => Jobs.TryGetValue(villager, out _);

        private static IEnumerable<Villager> Protectors(int villageId) =>
            Character.GetAllCharacters().OfType<Villager>().Where(v => !v.IsDead() && v.VillageId == villageId && !Childhood.IsChild(v) &&
                                                                       Roles.IsFighter(v) &&
                                                                       !Leaving.IsLeaving(v) && !Wanderers.IsWanderer(v));

        private static void Send(Villager villager, Player player, float seconds, bool help)
        {
            Jobs.Remove(villager);
            Jobs.Add(villager, new Job { Target = player, Until = Time.time + seconds, Help = help, LastEnemy = Time.time });
            Escorts.RemoveAll(v => v == null || v == villager);
            Escorts.Add(villager);
            Sleep.Wake(villager);
            Seats.StandUp(villager);
            Walker.For(villager).Reset();
            Roles.ArmForHunt(villager);
            string tag = help ? "help" : "horn";
            Dialogue.Say(villager, Dialogue.LineFor(villager, "self", tag, new[] { tag }), 5f);
        }

        /// <summary>The player blew the horn at the hearth. False when nothing happened (the chronicle opens instead).</summary>
        public static bool Horn(VillageHearth hearth, Player player, bool force = false)
        {
            if (!force && !HornOn)
            {
                return false;
            }

            Social.Known known = Social.Find(hearth, player);
            if (!force && (known == null || known.Reputation < Social.FriendAt))
            {
                player.Message(MessageHud.MessageType.Center, $"{hearth.VillageName} does not answer the horn of a stranger.");
                return true;
            }

            float hour = (float)(VillageBrain.DayLength() / 24.0);
            if (!force && LastHorn.TryGetValue(hearth.VillageId, out float last) && Time.time - last < hour)
            {
                player.Message(MessageHud.MessageType.Center, "The horn was blown not long ago.");
                return true;
            }

            LastHorn[hearth.VillageId] = Time.time;
            float seconds = LogicConfig.HornSeconds != null ? LogicConfig.HornSeconds.Value : 240f;
            int count = 0;
            foreach (Villager protector in Protectors(hearth.VillageId)
                         .Where(v => Vector3.Distance(v.transform.position, hearth.transform.position) < 80f).ToList())
            {
                Send(protector, player, seconds, false);
                count++;
            }

            Dialogue.Note(hearth.VillageId, "horn");
            player.Message(MessageHud.MessageType.Center, count > 0
                ? $"You blow the horn. {PlayerMemory.Number(count)} of {hearth.VillageName}'s people come to your side."
                : "You blow the horn. Nobody comes.");
            return true;
        }

        /// <summary>From the hearth's tick: protectors run to a friend of the village in a fight nearby.</summary>
        public static void HelpTick(VillageHearth hearth)
        {
            Player player = Player.m_localPlayer;
            if (!HelpOn || player == null || player.IsDead())
            {
                return;
            }

            float reach = VillheimConfig.VillageRadius.Value + 60f;
            if (Utils.DistanceXZ(player.transform.position, hearth.transform.position) > reach ||
                (EnvMan.IsNight() && !Raids.UnderRaid(hearth.VillageId)))
            {
                return;
            }

            Social.Known known = Social.Find(hearth, player);
            if (known == null || known.Reputation < Social.FriendAt || EnemyOn(player) == null)
            {
                return;
            }

            Escorts.RemoveAll(v => v == null || v.IsDead() || !Jobs.TryGetValue(v, out _));
            int helping = Escorts.Count(v => v.VillageId == hearth.VillageId && Jobs.TryGetValue(v, out Job job) && job.Help);
            if (helping >= 2)
            {
                return;
            }

            List<Villager> runners = Protectors(hearth.VillageId)
                .Where(v => !IsEscorting(v) && !Sleep.IsAsleep(v) && !Healing.IsHealing(v) &&
                            v.GetHealth() > v.GetMaxHealth() * 0.5f &&
                            Vector3.Distance(v.transform.position, player.transform.position) < reach + 40f)
                .OrderBy(v => Vector3.Distance(v.transform.position, player.transform.position))
                .Take(2 - helping).ToList();
            foreach (Villager runner in runners)
            {
                Send(runner, player, 90f, true);
            }

            if (runners.Count > 0)
            {
                Dialogue.Note(hearth.VillageId, "helpplayer");
            }
        }

        /// <summary>A creature fighting this player: one that has him as its target within 25 m, or a hostile one within 8 m.</summary>
        private static Character EnemyOn(Player player)
        {
            foreach (Character character in Character.GetAllCharacters())
            {
                if (character == null || character == player || character.IsDead() || character is Villager || character.IsTamed())
                {
                    continue;
                }

                float distance = Vector3.Distance(character.transform.position, player.transform.position);
                if (distance > 25f)
                {
                    continue;
                }

                MonsterAI monster = character.GetComponent<MonsterAI>();
                if ((monster != null && monster.GetTargetCreature() == player) || (distance < 8f && BaseAI.IsEnemy(player, character)))
                {
                    return character;
                }
            }

            return null;
        }

        /// <summary>From the brain: walk (or run) to the player. True while on the job.</summary>
        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            if (!Jobs.TryGetValue(villager, out Job job))
            {
                return false;
            }

            if (job.Target == null || job.Target.IsDead() || Time.time > job.Until)
            {
                Jobs.Remove(villager);
                return false;
            }

            if (job.Help)
            {
                Character enemy = EnemyOn(job.Target);
                if (enemy != null)
                {
                    job.LastEnemy = Time.time;
                }
                else if (Time.time - job.LastEnemy > 8f)
                {
                    Jobs.Remove(villager);
                    return false;
                }
            }

            float distance = Vector3.Distance(villager.transform.position, job.Target.transform.position);
            if (Walker.For(villager).Go(villager, ai, dt, job.Target.transform.position, job.Help ? 2.5f : 3.5f, distance > 8f) != WalkResult.Walking)
            {
                ai.StopMoving();
                ai.LookAt(job.Target.GetEyePoint());
            }

            return true;
        }

        public static string Describe(int villageId)
        {
            List<Villager> list = Escorts.Where(v => v != null && !v.IsDead() && v.VillageId == villageId && Jobs.TryGetValue(v, out _)).ToList();
            return list.Count == 0
                ? "no protectors out with a player"
                : string.Join(", ", list.Select(v => Jobs.TryGetValue(v, out Job j) ? $"{v.VillagerName} ({(j.Help ? "helping" : "horn")}, {j.Until - Time.time:0} s)" : v.VillagerName));
        }
    }
}
