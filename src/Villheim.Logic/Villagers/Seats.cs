using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Sitting on the village's chairs and benches in free time. A villager walks to a free seat made by the village,
    /// sits on its own resting point with the game's sitting animation (held there like the game holds a player), and
    /// gets up when the activity ends or anything else needs him. One villager per seat.
    /// </summary>
    internal static class Seats
    {
        private static readonly Dictionary<Chair, Villager> Taken = new Dictionary<Chair, Villager>();
        private static readonly Dictionary<Villager, Chair> SittingOn = new Dictionary<Villager, Chair>();
        private static readonly Dictionary<Villager, int> SatFrame = new Dictionary<Villager, int>();

        /// <summary>Called after every brain tick: a villager who wasn't held on his seat this tick gets up.</summary>
        public static void AfterTick(Villager villager)
        {
            if (SittingOn.ContainsKey(villager) && (!SatFrame.TryGetValue(villager, out int frame) || frame != Time.frameCount))
            {
                StandUp(villager);
            }
        }

        /// <summary>The nearest free seat of the village within reach, or null.</summary>
        public static Chair Free(Villager villager)
        {
            foreach (Chair gone in Taken.Keys.Where(k => k == null || Taken[k] == null || Taken[k].IsDead()).ToList())
            {
                Taken.Remove(gone);
            }

            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid)
            {
                return null;
            }

            Chair best = null;
            float bestDistance = 40f;
            foreach (Collider collider in Physics.OverlapSphere(villager.transform.position, 40f, LayerMask.GetMask("piece", "piece_nonsolid")))
            {
                Chair chair = collider.GetComponentInParent<Chair>();
                if (chair == null || (Taken.TryGetValue(chair, out Villager holder) && holder != villager) || chair.m_attachPoint == null)
                {
                    continue;
                }

                ZNetView view = chair.GetComponentInParent<ZNetView>();
                if (view == null || !view.IsValid() || view.GetZDO().GetInt(Keys.BuiltBy) != hearth.VillageId)
                {
                    continue;
                }

                float distance = Vector3.Distance(chair.transform.position, villager.transform.position);
                if (distance < bestDistance)
                {
                    best = chair;
                    bestDistance = distance;
                }
            }

            return best;
        }

        public static void Claim(Chair chair, Villager villager) => Taken[chair] = villager;

        /// <summary>Someone other than this villager has the seat.</summary>
        public static bool TakenByOther(Chair chair, Villager villager) =>
            Taken.TryGetValue(chair, out Villager holder) && holder != null && holder != villager && !holder.IsDead();

        public static Transform Point(Chair chair) => chair.m_attachPoint != null ? chair.m_attachPoint : chair.transform;

        /// <summary>Holds the villager on the seat this tick. False when the seat is gone.</summary>
        public static bool SitOn(Villager villager, Chair chair)
        {
            if (chair == null)
            {
                StandUp(villager);
                return false;
            }

            Transform point = Point(chair);
            if (Vector3.Distance(villager.transform.position, point.position) > 2.5f && !SittingOn.ContainsKey(villager))
            {
                return false;
            }

            SittingOn[villager] = chair;
            SatFrame[villager] = Time.frameCount;
            Taken[chair] = villager;
            Body.PinTo(villager, point, chair.gameObject);
            Poses.Hold(villager, string.IsNullOrEmpty(chair.m_attachAnimation) ? "attach_chair" : chair.m_attachAnimation);
            return true;
        }

        public static void StandUp(Villager villager)
        {
            if (!SittingOn.TryGetValue(villager, out Chair chair))
            {
                return;
            }

            SittingOn.Remove(villager);
            Body.Unpin(villager);
            if (chair != null && Taken.TryGetValue(chair, out Villager holder) && holder == villager)
            {
                Taken.Remove(chair);
            }

            if (villager.m_body != null)
            {
                villager.m_body.useGravity = true;
            }

            Poses.Release(villager);
            if (chair != null)
            {
                villager.transform.position = Point(chair).position + Point(chair).forward * 0.8f + Vector3.up * 0.1f;
            }
        }
    }
}
