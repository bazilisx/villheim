using System;
using HarmonyLib;
using UnityEngine;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// The village's own animals (T-57): those Farms spawned, marked with the village id. They are tame for good and
    /// never hungry, and they and the villagers are never enemies: no villager hunts or fights them, and they never
    /// turn on a villager. Every few seconds a village animal that has lost its tame state (or holds a grudge from a
    /// stray blow) is put right. Animals tamed by players are left as the game has them (D-015).
    /// </summary>
    internal static class Animals
    {
        private static float _next;

        /// <summary>An animal a village spawned (or that grew from one of its piglets).</summary>
        public static bool IsVillageAnimal(Character character)
        {
            if (character == null || character is Villager || character.IsPlayer())
            {
                return false;
            }

            ZNetView view = character.m_nview;
            return view != null && view.IsValid() && view.GetZDO().GetInt(Keys.BuiltBy) != 0;
        }

        /// <summary>Every five seconds, from any villager's update: village animals kept tame and calm.</summary>
        public static void Tick()
        {
            if (Time.time < _next)
            {
                return;
            }

            _next = Time.time + 5f;
            foreach (Character character in Character.GetAllCharacters())
            {
                if (!IsVillageAnimal(character) || character.IsDead() || !character.m_nview.IsOwner())
                {
                    continue;
                }

                if (!character.IsTamed())
                {
                    character.SetTamed(true);
                    VillheimPlugin.Debug($"A village {character.m_name} had lost its tame state; tamed again.");
                }

                BaseAI ai = character.GetBaseAI();
                if (ai != null && ai.IsAggravated())
                {
                    ai.SetAggravated(false, BaseAI.AggravatedReason.Damage);
                }

                if (ai is MonsterAI monster && monster.GetTargetCreature() is Villager)
                {
                    monster.m_targetCreature = null;
                }
            }
        }

        /// <summary>Village animals are never hungry.</summary>
        [HarmonyPatch(typeof(Tameable), nameof(Tameable.IsHungry))]
        internal static class NeverHungryPatch
        {
            private static void Postfix(Tameable __instance, ref bool __result)
            {
                try
                {
                    if (__result && IsVillageAnimal(__instance.GetComponent<Character>()))
                    {
                        __result = false;
                    }
                }
                catch (Exception)
                {
                    // Left as the game has it.
                }
            }
        }
    }
}
