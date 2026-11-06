using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Per-villager behaviour, called by the core Villager component on the client that owns the villager.
    /// </summary>
    internal static class VillagerBehaviour
    {
        private const float ScheduleInterval = 15f;
        private const float NightRadius = 6f;

        private sealed class AppliedTier
        {
            public int Value = -1;
        }

        private static readonly ConditionalWeakTable<Villager, AppliedTier> Applied =
            new ConditionalWeakTable<Villager, AppliedTier>();

        public static void Update(Villager villager, float deltaTime)
        {
            AppliedTier applied = Applied.GetOrCreateValue(villager);
            if (!villager.LooksApplied)
            {
                villager.LooksApplied = true;
                applied.Value = -1;
            }

            villager.ScheduleTimer -= deltaTime;
            bool scheduleDue = villager.ScheduleTimer <= 0f;
            if (scheduleDue || applied.Value < 0)
            {
                // Gear follows the village: re-dress whenever the village reaches a new tier.
                int tier = DesiredGearTier(villager);
                if (tier != applied.Value)
                {
                    applied.Value = tier;
                    VillagerLooks.Apply(villager, villager.Zdo.GetInt(Keys.VillagerSeed), tier);
                }
            }

            if (scheduleDue)
            {
                villager.ScheduleTimer = ScheduleInterval + Random.Range(0f, 5f);
                UpdateSchedule(villager);
            }
        }

        private static int DesiredGearTier(Villager villager)
        {
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid)
            {
                return VillagerLooks.GearTier(0, Heightmap.Biome.Meadows);
            }

            var state = new VillageState(hearth.Zdo);
            return VillagerLooks.GearTier(VillageBrain.TierIndex(state.Plots.Count), state.Biome);
        }

        /// <summary>By day villagers wander around their home building; at night they stay near the hearth.</summary>
        private static void UpdateSchedule(Villager villager)
        {
            if (!(villager.m_baseAI is MonsterAI ai) || ai.IsAlerted())
            {
                return;
            }

            ZDO zdo = villager.Zdo;
            Vector3 hearth = zdo.GetVec3(Keys.VillagerHearth, villager.transform.position);
            Vector3 home = zdo.GetVec3(Keys.VillagerHome, hearth);

            bool night = VillheimConfig.VillagersGatherAtNight.Value && EnvMan.IsNight();
            Vector3 target = night ? hearth + Random.insideUnitSphere.Horizontal() * NightRadius : home;
            ai.SetPatrolPoint(target);
        }

        public static string HoverText(Villager villager)
        {
            string village = villager.VillageName;
            string text = villager.VillagerName;
            if (!string.IsNullOrEmpty(village))
            {
                text += $"\n<color=#b0b0b0>of {village}</color>";
            }

            string job = Chores.Describe(villager);
            if (job != null)
            {
                text += $"\n<color=#b0b0b0>{job}</color>";
            }

            text += "\n[<color=yellow><b>$KEY_Use</b></color>] Talk";
            return Localization.instance.Localize(text);
        }

        public static bool Interact(Villager villager, Humanoid user)
        {
            if (!(user is Player player) || player != Player.m_localPlayer)
            {
                return false;
            }

            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            string line = VillagerTalk.InteractLine(hearth);
            Chat.instance?.SetNpcText(villager.gameObject, Vector3.up * 2.2f, 20f, 6f, "", line, false);
            if (hearth != null)
            {
                player.Message(MessageHud.MessageType.TopLeft, Village.VillageBrain.Summary(hearth));
            }

            return true;
        }
    }
}
