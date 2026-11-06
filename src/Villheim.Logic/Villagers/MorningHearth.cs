using System.Collections.Generic;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Like Millenaire's morning hearth lighting: once each morning (5 to 9) one carer, the first up, goes to the
    /// village hearth, tends it (reaching out to it, as a player adds wood) and stays a moment before the day's work.
    /// </summary>
    internal static class MorningHearth
    {
        private static readonly Dictionary<int, int> TendedOnDay = new Dictionary<int, int>();
        private static readonly Dictionary<int, (Villager Who, float Until)> Tending = new Dictionary<int, (Villager, float)>();

        public static bool IsTending(Villager villager) =>
            Tending.TryGetValue(villager.VillageId, out var t) && t.Who == villager && Time.time < t.Until;

        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            if (EnvMan.instance == null)
            {
                return false;
            }

            float hour = EnvMan.instance.GetDayFraction() * 24f;
            int day = EnvMan.instance.GetDay();
            int id = villager.VillageId;
            if (hour < 5f || hour > 9f || Sleep.Bedtime(villager))
            {
                return false;
            }

            if (Tending.TryGetValue(id, out var current))
            {
                if (current.Who != villager)
                {
                    return false;
                }

                return Tend(villager, ai, dt, current.Until);
            }

            if (TendedOnDay.TryGetValue(id, out int tended) && tended == day || Roles.BackgroundOf(villager) != Roles.Background.Carer)
            {
                return false;
            }

            TendedOnDay[id] = day;
            Tending[id] = (villager, Time.time + 45f);
            Walker.For(villager).Reset();
            VillheimPlugin.Debug($"{villager.VillagerName} goes to tend the hearth.");
            return true;
        }

        private static bool Tend(Villager villager, VillagerAI ai, float dt, float until)
        {
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid || Time.time > until)
            {
                Tending.Remove(villager.VillageId);
                return false;
            }

            Vector3 fire = hearth.transform.position;
            Vector3 side = villager.transform.position - fire;
            side.y = 0f;
            Vector3 spot = fire + (side.sqrMagnitude > 0.01f ? side.normalized : Vector3.forward) * 1.7f;
            if (Walker.For(villager).Go(villager, ai, dt, spot, 0.6f) == WalkResult.Walking)
            {
                return true;
            }

            ai.StopMoving();
            ai.LookAt(fire + Vector3.up * 0.3f);
            if (until - Time.time > 8f)
            {
                // Arrived: tend it, say something, then a few seconds by the fire.
                Poses.Trigger(villager, "interact");
                Dialogue.Say(villager, Dialogue.LineFor(villager, "self"));
                Tending[villager.VillageId] = (villager, Time.time + 6f);
                return true;
            }

            return true;
        }
    }
}
