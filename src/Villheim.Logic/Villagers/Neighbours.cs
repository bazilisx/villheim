using System.Collections.Generic;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Who lives next to whom (proposal 33, after Terraria's NPC happiness).
    ///
    /// - Claiming a bed, a villager counts a bed within 30 m of his friend's as 15 m nearer and one within 40 m of his
    ///   rival's as 25 m farther, so friends end up side by side and rivals apart when there is a choice.
    /// - Each morning: his home within 30 m of his friend's, "goodneighbour" (+2 for a day); within 20 m of his rival's,
    ///   "badneighbour" (-3). Kept in his ZDO for the dialogue (nextdoor:friend, nextdoor:rival).
    /// - The village store opened through him: x0.94 when he is glad of his neighbours, x1.06 when sour.
    /// </summary>
    internal static class Neighbours
    {
        private static readonly int KeyNextDoor = "villheim_nextdoor".GetStableHashCode();

        private static bool On => Living.On(LogicConfig.Neighbours);

        public static float BedPenalty(Villager villager, Vector3 bed)
        {
            if (!On)
            {
                return 0f;
            }

            float penalty = 0f;
            Vector3 friend = Beds.Claimed(Personality.Friend(villager));
            if (friend != Vector3.zero && Utils.DistanceXZ(friend, bed) < 30f)
            {
                penalty -= 15f;
            }

            Vector3 rival = Beds.Claimed(Personality.Rival(villager));
            if (rival != Vector3.zero && Utils.DistanceXZ(rival, bed) < 40f)
            {
                penalty += 25f;
            }

            return penalty;
        }

        private static Vector3 Home(Villager villager) =>
            villager?.Zdo != null ? villager.Zdo.GetVec3(Keys.VillagerHome, Vector3.zero) : Vector3.zero;

        /// <summary>Once a day, in the morning.</summary>
        public static void Daily(Villager villager)
        {
            if (!On || Childhood.IsChild(villager))
            {
                return;
            }

            Vector3 home = Home(villager);
            if (home == Vector3.zero)
            {
                return;
            }

            int nextDoor = 0;
            Vector3 friend = Home(Personality.Friend(villager));
            Vector3 rival = Home(Personality.Rival(villager));
            if (rival != Vector3.zero && Utils.DistanceXZ(rival, home) < 20f)
            {
                nextDoor = -1;
                Moods.Think(villager, "badneighbour");
            }
            else if (friend != Vector3.zero && Utils.DistanceXZ(friend, home) < 30f)
            {
                nextDoor = 1;
                Moods.Think(villager, "goodneighbour");
            }

            villager.Zdo.Set(KeyNextDoor, nextDoor);
        }

        public static float PriceFactor(Villager trader)
        {
            if (!On || trader?.Zdo == null)
            {
                return 1f;
            }

            int nextDoor = trader.Zdo.GetInt(KeyNextDoor);
            return nextDoor > 0 ? 0.94f : nextDoor < 0 ? 1.06f : 1f;
        }

        public static IEnumerable<string> Tags(Villager villager)
        {
            if (!On || villager?.Zdo == null)
            {
                yield break;
            }

            int nextDoor = villager.Zdo.GetInt(KeyNextDoor);
            if (nextDoor > 0)
            {
                yield return "nextdoor:friend";
            }
            else if (nextDoor < 0)
            {
                yield return "nextdoor:rival";
            }
        }
    }
}
