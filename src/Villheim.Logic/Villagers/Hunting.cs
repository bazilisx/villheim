using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Hunting, so there is meat for the cooking station. Like Millenaire's hunters, it is background work for the
    /// village's protectors: by day, when the village chest holds little food, one protector at a time takes a spear or
    /// club, goes after a boar, deer or neck near the village, brings it down, picks up what it drops (meat, hides,
    /// trophies) and carries it to the village chest.
    /// </summary>
    internal static class Hunting
    {
        private const float SearchFromHearth = 45f;
        private const float StrikeReach = 2.3f;
        private const float StrikeInterval = 1.6f;
        private const int EnoughFood = 4;

        private static readonly string[] Game = { "Boar", "Deer", "Neck", "Hare" };

        private enum Phase
        {
            None,
            Chase,
            Collect,
            Deliver,
        }

        private sealed class State
        {
            public Phase Phase;
            public Character Prey;
            public Vector3 KillSpot;
            public float Deadline;
            public float NextStrike;
            public float NextLook;
            public readonly Dictionary<string, int> Carrying = new Dictionary<string, int>();
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();
        private static readonly Dictionary<int, Villager> Hunters = new Dictionary<int, Villager>();

        public static bool IsHunting(Villager villager) => States.TryGetValue(villager, out State state) && state.Phase != Phase.None;

        public static string Describe(Villager villager)
        {
            if (!States.TryGetValue(villager, out State state))
            {
                return null;
            }

            switch (state.Phase)
            {
                case Phase.Chase: return "hunting";
                case Phase.Collect: return "butchering the kill";
                case Phase.Deliver: return "carrying meat to the chest";
                default: return null;
            }
        }

        /// <summary>True while this villager is out hunting.</summary>
        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            State state = States.GetOrCreateValue(villager);
            if (state.Phase == Phase.None && !Begin(villager, state))
            {
                return false;
            }

            switch (state.Phase)
            {
                case Phase.Chase: return Chase(villager, ai, dt, state);
                case Phase.Collect: return Collect(villager, ai, dt, state);
                case Phase.Deliver: return Deliver(villager, ai, dt, state);
            }

            return false;
        }

        private static bool Begin(Villager villager, State state)
        {
            if (EnvMan.IsNight() || Time.time < state.NextLook || Roles.BackgroundOf(villager) != Roles.Background.Protector)
            {
                return false;
            }

            state.NextLook = Time.time + Random.Range(20f, 40f);
            if (Hunters.TryGetValue(villager.VillageId, out Villager hunter) && hunter != null && hunter != villager && !hunter.IsDead() &&
                IsHunting(hunter))
            {
                return false;
            }

            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid || FoodInChest(hearth) >= EnoughFood)
            {
                return false;
            }

            Character prey = FindPrey(hearth.transform.position, villager.transform.position);
            if (prey == null)
            {
                return false;
            }

            Hunters[villager.VillageId] = villager;
            state.Prey = prey;
            state.Phase = Phase.Chase;
            state.Deadline = Time.time + 60f;
            Roles.ArmForHunt(villager);
            Walker.For(villager).Reset();
            VillheimPlugin.Debug($"{villager.VillagerName} goes hunting ({prey.m_name}).");
            return true;
        }

        private static bool Chase(Villager villager, VillagerAI ai, float dt, State state)
        {
            Character prey = state.Prey;
            if (prey == null || prey.IsDead())
            {
                state.Phase = Phase.Collect;
                state.Deadline = Time.time + 20f;
                state.NextStrike = Time.time + 1f;
                Walker.For(villager).Reset();
                return true;
            }

            state.KillSpot = prey.transform.position;
            if (Time.time > state.Deadline)
            {
                VillheimPlugin.Debug($"{villager.VillagerName} lost the {prey.m_name}.");
                End(villager, state);
                return false;
            }

            float distance = Vector3.Distance(villager.transform.position, prey.transform.position);
            if (distance > StrikeReach)
            {
                Walker.For(villager).Go(villager, ai, dt, prey.transform.position, StrikeReach * 0.7f, true);
                return true;
            }

            ai.StopMoving();
            ai.LookAt(prey.GetCenterPoint());
            Vector3 toPrey = prey.transform.position - villager.transform.position;
            toPrey.y = 0f;
            if (toPrey.sqrMagnitude > 0.01f)
            {
                villager.SetLookDir(toPrey.normalized);
            }

            if (Time.time < state.NextStrike)
            {
                return true;
            }

            state.NextStrike = Time.time + StrikeInterval;
            Chores.ToolAnimation(villager, null);
            ItemDrop.ItemData weapon = villager.GetCurrentWeapon();
            var hit = new HitData
            {
                m_point = prey.GetCenterPoint(),
                m_dir = toPrey.sqrMagnitude > 0.01f ? toPrey.normalized : villager.transform.forward,
                m_attacker = villager.GetZDOID(),
                m_toolTier = (short)(weapon?.m_shared?.m_toolTier ?? 0),
            };
            hit.m_damage.m_pierce = Mathf.Max(weapon?.m_shared?.m_damages.m_pierce ?? 0f, 12f);
            hit.m_damage.m_blunt = weapon?.m_shared?.m_damages.m_blunt ?? 0f;
            prey.Damage(hit);
            return true;
        }

        /// <summary>Picks up what the kill dropped.</summary>
        private static bool Collect(Villager villager, VillagerAI ai, float dt, State state)
        {
            if (Walker.For(villager).Go(villager, ai, dt, state.KillSpot, 1.2f) == WalkResult.Walking && Time.time < state.Deadline)
            {
                return true;
            }

            ai.StopMoving();
            if (Time.time < state.NextStrike)
            {
                return true; // the drops land a moment after the kill
            }

            Poses.Trigger(villager, "interact");
            foreach (Collider collider in Physics.OverlapSphere(villager.transform.position, 4f))
            {
                ItemDrop item = collider.GetComponentInParent<ItemDrop>();
                if (item == null || item.m_nview == null || !item.m_nview.IsValid() || !IsGameDrop(item))
                {
                    continue;
                }

                string name = Utils.GetPrefabName(item.gameObject);
                state.Carrying.TryGetValue(name, out int count);
                state.Carrying[name] = count + item.m_itemData.m_stack;
                item.m_nview.ClaimOwnership();
                ZNetScene.instance.Destroy(item.gameObject);
            }

            state.Phase = Phase.Deliver;
            state.Deadline = Time.time + 90f;
            Walker.For(villager).Reset();
            return true;
        }

        private static bool Deliver(Villager villager, VillagerAI ai, float dt, State state)
        {
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            Container chest = hearth != null && hearth.IsValid ? VillageChest.Find(hearth) : null;
            if (chest == null || state.Carrying.Count == 0)
            {
                End(villager, state);
                return false;
            }

            if (Walker.For(villager).Go(villager, ai, dt, chest.transform.position, 1.6f, true) == WalkResult.Walking && Time.time < state.Deadline)
            {
                return true;
            }

            ai.StopMoving();
            Poses.Trigger(villager, "interact");
            foreach (KeyValuePair<string, int> carried in state.Carrying)
            {
                GameObject prefab = ObjectDB.instance.GetItemPrefab(carried.Key);
                if (prefab != null)
                {
                    chest.GetInventory().AddItem(prefab, carried.Value);
                }
            }

            VillheimPlugin.Debug($"{villager.VillagerName} brought back {string.Join(", ", state.Carrying.Select(c => $"{c.Value} {c.Key}"))}.");
            Dialogue.Note(villager.VillageId, "hunt");
            End(villager, state);
            return false;
        }

        private static void End(Villager villager, State state)
        {
            state.Phase = Phase.None;
            state.Prey = null;
            state.Carrying.Clear();
            if (Hunters.TryGetValue(villager.VillageId, out Villager hunter) && hunter == villager)
            {
                Hunters.Remove(villager.VillageId);
            }
        }

        private static Character FindPrey(Vector3 hearth, Vector3 from)
        {
            Character best = null;
            float bestDistance = 35f;
            foreach (Character character in Character.GetAllCharacters())
            {
                if (character == null || character.IsDead() || character.IsPlayer() || character is Villager || character.IsTamed())
                {
                    continue;
                }

                string name = Utils.GetPrefabName(character.gameObject);
                if (!Game.Contains(name) || Utils.DistanceXZ(character.transform.position, hearth) > SearchFromHearth)
                {
                    continue;
                }

                float distance = Utils.DistanceXZ(character.transform.position, from);
                if (distance < bestDistance)
                {
                    best = character;
                    bestDistance = distance;
                }
            }

            return best;
        }

        /// <summary>Meat, hides, trophies and the like: anything a hunted animal drops that isn't a building material.</summary>
        private static bool IsGameDrop(ItemDrop item)
        {
            ItemDrop.ItemData.SharedData shared = item.m_itemData?.m_shared;
            if (shared == null)
            {
                return false;
            }

            return shared.m_food > 0f || shared.m_itemType == ItemDrop.ItemData.ItemType.Trophy ||
                   shared.m_itemType == ItemDrop.ItemData.ItemType.Material && !Materials.Tracked.Contains(Utils.GetPrefabName(item.gameObject)) ||
                   CookableName(Utils.GetPrefabName(item.gameObject));
        }

        private static bool CookableName(string name) => name.StartsWith("Raw") || name.EndsWith("Meat") || name == "NeckTail";

        /// <summary>Raw and cooked food in the village chest, counted together.</summary>
        private static int FoodInChest(VillageHearth hearth)
        {
            Container chest = VillageChest.Find(hearth);
            if (chest == null)
            {
                return EnoughFood;
            }

            int count = 0;
            foreach (ItemDrop.ItemData item in chest.GetInventory().GetAllItems())
            {
                string name = item.m_dropPrefab != null ? item.m_dropPrefab.name : "";
                if (item.m_shared.m_food > 0f || CookableName(name))
                {
                    count += item.m_stack;
                }
            }

            return count;
        }
    }
}
