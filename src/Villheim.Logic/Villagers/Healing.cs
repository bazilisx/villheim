using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// A hurt villager (under half health) stops working and heals before anything else: he goes to the hearth,
    /// sits and cooks for a few seconds, then eats. Once healed he won't start again for five minutes. Raw meat from the village chest heals more; without it he
    /// roasts what he has and heals less. He keeps at it until he is nearly whole again.
    /// </summary>
    internal static class Healing
    {
        private const float StartBelow = 0.5f;
        private const float StopAbove = 0.95f;
        private const float CookSeconds = 8f;
        private const float RestBetween = 300f;

        private static readonly string[] Foods = { "RawMeat", "DeerMeat", "NeckTail", "FishRaw" };

        private sealed class State
        {
            public bool Active;
            public bool Cooking;
            public float CookStart;
            public float NextAllowed;
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();

        public static bool IsHealing(Villager villager) => States.TryGetValue(villager, out State state) && state.Active;

        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            State state = States.GetOrCreateValue(villager);
            float health = villager.GetHealth() / Mathf.Max(1f, villager.GetMaxHealth());
            if (state.Active && health >= StopAbove)
            {
                // Done. Not again for five minutes, so a scratch right after doesn't send him back to the fire.
                state.Active = false;
                state.NextAllowed = Time.time + RestBetween;
                return false;
            }

            if (!state.Active)
            {
                if (health >= StartBelow || Time.time < state.NextAllowed)
                {
                    return false;
                }

                state.Active = true;
                state.Cooking = false;
                Walker.For(villager).Reset();
                VillheimPlugin.Debug($"{villager.VillagerName} is hurt and goes to cook something at the hearth.");
            }

            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid)
            {
                return false;
            }

            Vector3 fire = hearth.transform.position;
            if (!state.Cooking)
            {
                Vector3 side = villager.transform.position - fire;
                side.y = 0f;
                Vector3 spot = fire + (side.sqrMagnitude > 0.01f ? side.normalized : Vector3.forward) * 2.2f;
                if (Walker.For(villager).Go(villager, ai, dt, spot, 0.8f) == WalkResult.Walking)
                {
                    return true;
                }

                state.Cooking = true;
                state.CookStart = Time.time;
            }

            ai.StopMoving();
            ai.LookAt(fire + Vector3.up * 0.5f);
            Poses.Hold(villager, Poses.Sit);
            if (Time.time - state.CookStart < CookSeconds)
            {
                return true;
            }

            bool meat = TakeFood(hearth);
            villager.Heal(villager.GetMaxHealth() * (meat ? 0.6f : 0.3f), true);
            state.CookStart = Time.time;
            return true;
        }

        /// <summary>Takes one piece of raw meat or fish from the village chest, if there is any.</summary>
        private static bool TakeFood(VillageHearth hearth)
        {
            Container chest = VillageChest.Find(hearth);
            if (chest == null || !VillageChest.Usable(chest) || ObjectDB.instance == null)
            {
                return false;
            }

            foreach (string food in Foods)
            {
                string name = ObjectDB.instance.GetItemPrefab(food)?.GetComponent<ItemDrop>()?.m_itemData?.m_shared?.m_name;
                if (name != null && chest.GetInventory().CountItems(name) > 0)
                {
                    chest.GetInventory().RemoveItem(name, 1);
                    return true;
                }
            }

            return false;
        }
    }
}
