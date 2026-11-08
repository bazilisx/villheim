using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;
using Random = UnityEngine.Random;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Gestures with no line, each tied to something that really happens (Tyler, 2026-11-08: emotes are fine without
    /// dialogue as long as they fit what the villager is doing, planning or reacting to). Nothing here is random
    /// idling: every call comes from an event, and each one is rare and has a cooldown per villager.
    ///
    ///   point    toward a work target 15 m or more away, as he sets off for it (Chores.Started)
    ///   thumbsup a building finished (Dialogue.Note "finished"), or an amenity he made (Chores.UpdateMake)
    ///   wave     at a player arriving in the village or leaving it (PlayerTick)
    ///   shrug    the chest can't pay for the piece he came to make, and he leaves it (Chores.UpdateMake)
    ///   nonono   a player asks to trade and the village has nothing to spare (Market)
    ///   cheer    the first time he sees the feast on a feast night (FreeTime.ActEvening)
    /// </summary>
    internal static class TaskGestures
    {
        private sealed class Last
        {
            public float At = -1000f;
        }

        private static readonly ConditionalWeakTable<Villager, Last> Lasts = new ConditionalWeakTable<Villager, Last>();

        private static bool Do(Villager villager, string gesture, float chance, float cooldown = 90f)
        {
            if (villager == null || villager.IsDead() || Sleep.IsAsleep(villager) || Poses.IsPosed(villager) || Random.value > chance)
            {
                return false;
            }

            Last last = Lasts.GetOrCreateValue(villager);
            if (Time.time - last.At < cooldown)
            {
                return false;
            }

            last.At = Time.time;
            Poses.Gesture(villager, gesture);
            return true;
        }

        /// <summary>He turns to where he is going and points, before setting off for a job some way off.</summary>
        public static void SettingOff(Villager villager, Vector3 target)
        {
            Vector3 way = (target - villager.transform.position).Horizontal();
            if (way.magnitude < 15f || Random.value > 0.15f)
            {
                return;
            }

            Last last = Lasts.GetOrCreateValue(villager);
            if (Time.time - last.At < 120f || Poses.IsPosed(villager))
            {
                return;
            }

            villager.transform.rotation = Quaternion.LookRotation(way.normalized);
            Do(villager, "point", 1f, 120f);
        }

        /// <summary>A building is finished: one villager near the player gives it a thumbs up.</summary>
        public static void Finished(int villageId)
        {
            Player player = Player.m_localPlayer;
            if (player == null)
            {
                return;
            }

            Villager near = Character.GetAllCharacters().OfType<Villager>()
                .Where(v => !v.IsDead() && v.VillageId == villageId && !Sleep.IsAsleep(v) &&
                            Vector3.Distance(v.transform.position, player.transform.position) < 30f)
                .OrderBy(v => Vector3.Distance(v.transform.position, player.transform.position)).FirstOrDefault();
            Do(near, "thumbsup", 0.6f);
        }

        /// <summary>He has made an amenity (the last piece of it).</summary>
        public static void Made(Villager villager) => Do(villager, "thumbsup", 0.4f);

        /// <summary>The chest could not pay for the piece he came to make, so he leaves it for now.</summary>
        public static void GaveUp(Villager villager) => Do(villager, "shrug", 0.35f, 180f);

        /// <summary>A player asked for something the village can't do.</summary>
        public static void Refused(Villager villager) => Do(villager, "nonono", 0.7f, 20f);

        /// <summary>He sees the feast for the first time tonight.</summary>
        public static void Feast(Villager villager) => Do(villager, "cheer", 0.5f);

        // ---------------------------------------------------------------- the player arriving and leaving

        private static int _village;
        private static float _since = -1000f;
        private static float _outSince = -1000f;
        private static int _frame = -1;

        /// <summary>
        /// Once a frame (from Dialogue.Tick): when the local player comes into a village after a minute away, or leaves
        /// it after half a minute in it, the nearest villager within 25 m who is not at work may wave to him.
        /// </summary>
        public static void PlayerTick()
        {
            if (_frame == Time.frameCount)
            {
                return;
            }

            _frame = Time.frameCount;
            Player player = Player.m_localPlayer;
            if (player == null || player.IsDead())
            {
                return;
            }

            float radius = VillheimConfig.VillageRadius != null ? VillheimConfig.VillageRadius.Value : 60f;
            VillageHearth hearth = VillageHearth.Closest(player.transform.position, radius);
            int inside = hearth != null && hearth.IsValid ? hearth.VillageId : 0;
            if (inside == _village)
            {
                return;
            }

            int left = _village;
            float stayed = Time.time - _since;
            float away = Time.time - _outSince;
            _village = inside;
            if (inside != 0)
            {
                _since = Time.time;
                if (away >= 60f)
                {
                    WaveFrom(inside, player);
                }
            }
            else
            {
                _outSince = Time.time;
                if (left != 0 && stayed >= 30f)
                {
                    WaveFrom(left, player);
                }
            }
        }

        private static void WaveFrom(int villageId, Player player)
        {
            Villager near = Character.GetAllCharacters().OfType<Villager>()
                .Where(v => !v.IsDead() && v.VillageId == villageId && !Sleep.IsAsleep(v) && Chores.Describe(v) == null &&
                            Vector3.Distance(v.transform.position, player.transform.position) < 25f)
                .OrderBy(v => Vector3.Distance(v.transform.position, player.transform.position)).FirstOrDefault();
            if (near != null && Do(near, "wave", 0.6f, 60f))
            {
                Social.LookAt(near, player, 3f);
            }
        }
    }
}
