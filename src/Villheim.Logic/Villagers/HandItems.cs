using System.Runtime.CompilerServices;
using HarmonyLib;
using UnityEngine;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Tools and weapons are only in hand for the work that needs them, or on the way to it (T-58: a woman tended the
    /// fire with a pickaxe on her shoulder). After the brain has run him, anything in his hands is put away unless what
    /// he is doing uses it: felling, mining and building (not carrying the load home or picking things up), mending,
    /// smithing, laying paths, farming, making arrows, hanging a trophy. A hunt, a fight, going with a player or a test
    /// may have a weapon or bow in hand, never a work tool. The night watch keeps his torch. The work takes the tool out
    /// again when it starts.
    ///
    /// The check runs every brain tick (it had run twice a second, and work that took the tool out again each tick won),
    /// and also from the villager's own update when the brain has not run for a moment (the game's AI ran him), so a tool
    /// never stays in hand while nothing is using it. With DebugLog on, every time a tool goes into a villager's hand is
    /// logged with what he was doing and the code that did it.
    /// </summary>
    internal static class HandItems
    {
        private sealed class State
        {
            public float LastTidy = -100f;
            public Status.Doer Doer;
            /// <summary>Since when what he holds has not been what his work uses (0 while it is).</summary>
            public float WrongSince;
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();

        /// <summary>Seconds a tool may stay in hand after the work stopped using it.</summary>
        private const float PutAwayAfter = 2.5f;

        private enum Allowed
        {
            Nothing,
            Tool,
            Weapons,
            Anything,
        }

        /// <summary>What he may have in hand for what he is doing, and the tool when it is one.</summary>
        private static Allowed Uses(Villager villager, Status.Doer doer, out VillagerLooks.Tool? tool)
        {
            tool = null;
            switch (doer)
            {
                case Status.Doer.Chores:
                    // The tool of the chore on the way to it and at it; nothing while carrying the load home or
                    // picking things up.
                    tool = Chores.ToolInUse(villager);
                    break;
                case Status.Doer.Elder:
                    tool = ElderWork.ToolInUse(villager);
                    break;
                case Status.Doer.Trophy:
                    tool = Trophies.Hammering(villager) ? VillagerLooks.Tool.Hammer : (VillagerLooks.Tool?)null;
                    break;
                case Status.Doer.Repair:
                case Status.Doer.Decor: // was left out: the hammer came out and went away again at every tick (2026-11-09)
                case Status.Doer.Smith:
                case Status.Doer.Fletch:
                    tool = VillagerLooks.Tool.Hammer;
                    break;
                case Status.Doer.Path:
                case Status.Doer.Farm:
                    tool = VillagerLooks.Tool.Hoe;
                    break;
                case Status.Doer.Fish:
                    // The fishing rod (Fishing takes it out and puts it away).
                    return Allowed.Anything;
                case Status.Doer.BetweenJobs:
                    // The moment between one step of a job and the next: the tool stays in hand. It went away and came
                    // out again at each step (pickaxe, 2026-11-09). A longer wait ends in free time, which puts it away.
                    return Allowed.Anything;
                case Status.Doer.Hunt:
                case Status.Doer.Test:
                case Status.Doer.Escort:
                case Status.Doer.Fight:
                    return Allowed.Weapons;
            }

            return tool.HasValue ? Allowed.Tool : Allowed.Nothing;
        }

        /// <summary>A work tool: axe or pickaxe from the village's tool set, hammer, hoe, cultivator.</summary>
        public static bool IsWorkTool(ItemDrop.ItemData item)
        {
            if (item?.m_shared == null || item.m_shared.m_itemType == ItemDrop.ItemData.ItemType.Torch)
            {
                return false;
            }

            if (item.m_shared.m_itemType == ItemDrop.ItemData.ItemType.Tool || item.m_shared.m_skillType == Skills.SkillType.Pickaxes)
            {
                return true;
            }

            string name = item.m_dropPrefab != null ? item.m_dropPrefab.name : "";
            return item.m_shared.m_skillType == Skills.SkillType.Axes && name.StartsWith("Axe");
        }

        /// <summary>After the brain's tick: puts away what the work in hand does not use.</summary>
        public static void Tidy(Villager villager, Status.Doer doer)
        {
            State state = States.GetOrCreateValue(villager);
            state.LastTidy = Time.time;
            state.Doer = doer;
            ItemDrop.ItemData right = villager.GetRightItem();
            ItemDrop.ItemData left = villager.GetLeftItem();
            if (right == null && left == null && villager.m_hiddenRightItem == null && villager.m_hiddenLeftItem == null)
            {
                return;
            }

            Allowed allowed = Uses(villager, doer, out VillagerLooks.Tool? tool);
            bool wrong = allowed == Allowed.Nothing ||
                         (allowed == Allowed.Tool && ((right != null && right.m_shared.m_itemType != ItemDrop.ItemData.ItemType.Torch && !VillagerLooks.IsHolding(villager, tool.Value)) ||
                                                      (left != null && left.m_shared.m_itemType != ItemDrop.ItemData.ItemType.Torch))) ||
                         (allowed == Allowed.Weapons && (IsWorkTool(right) || IsWorkTool(left)));
            if (!wrong)
            {
                state.WrongSince = 0f;
                return;
            }

            // A tool is put away only once it has been the wrong thing to hold for a moment, so a short change of
            // task (a greeting, a step aside, the gap between two jobs) does not make it flick in and out. Bed and
            // fights don't wait.
            if (state.WrongSince <= 0f)
            {
                state.WrongSince = Time.time;
            }

            if (doer != Status.Doer.Sleep && allowed != Allowed.Weapons && Time.time - state.WrongSince < PutAwayAfter)
            {
                return;
            }

            state.WrongSince = 0f;
            switch (allowed)
            {
                case Allowed.Tool:
                    // Another tool than the work's (the pickaxe kept from mining on the way to build) is put away; the
                    // work takes its own out when it needs it.
                    if ((right != null && right.m_shared.m_itemType != ItemDrop.ItemData.ItemType.Torch && !VillagerLooks.IsHolding(villager, tool.Value)) ||
                        (left != null && left.m_shared.m_itemType != ItemDrop.ItemData.ItemType.Torch))
                    {
                        PutAway(villager, "not the tool for " + doer);
                    }

                    return;
                case Allowed.Weapons:
                    if (IsWorkTool(right) || IsWorkTool(left))
                    {
                        PutAway(villager, "a work tool during " + doer);
                    }

                    return;
                case Allowed.Anything:
                    return;
                default:
                    PutAway(villager, "nothing in hand for " + doer);
                    return;
            }
        }

        /// <summary>
        /// From the villager's own update, every frame: when the brain has not tidied his hands for a second (the game's
        /// AI or the fight ran him), a work tool is put away unless he is in a fight.
        /// </summary>
        public static void Watch(Villager villager)
        {
            State state = States.GetOrCreateValue(villager);
            if (Time.time - state.LastTidy < 1f || Status.Current(villager) == Status.Doer.Fight)
            {
                return;
            }

            state.LastTidy = Time.time;
            if (IsWorkTool(villager.GetRightItem()) || IsWorkTool(villager.GetLeftItem()) || villager.m_hiddenRightItem != null)
            {
                PutAway(villager, "brain idle");
            }
        }

        public static void PutAway(Villager villager) => PutAway(villager, null);

        /// <summary>
        /// Both hands emptied, the torch of the night watch kept. Nothing is left on his back either: the game's
        /// "hide hand items" kept a hidden tool showing on the back, which is how nearly everyone came to carry a
        /// pickaxe over the shoulder everywhere (T-108).
        /// </summary>
        private static void PutAway(Villager villager, string why)
        {
            ItemDrop.ItemData right = villager.GetRightItem();
            ItemDrop.ItemData left = villager.GetLeftItem();
            bool any = false;
            if (right != null && right.m_shared.m_itemType != ItemDrop.ItemData.ItemType.Torch)
            {
                villager.UnequipItem(right, false);
                any = true;
            }

            if (left != null && left.m_shared.m_itemType != ItemDrop.ItemData.ItemType.Torch)
            {
                villager.UnequipItem(left, false);
                any = true;
            }

            if (villager.m_hiddenRightItem != null || villager.m_hiddenLeftItem != null)
            {
                villager.m_hiddenRightItem = null;
                villager.m_hiddenLeftItem = null;
                villager.SetupVisEquipment(villager.m_visEquipment, false);
                any = true;
            }

            if (any && why != null && LogicConfig.IsOn(LogicConfig.DebugLog))
            {
                VillheimPlugin.Log.LogInfo($"[hands] {villager.VillagerName} put away {right?.m_shared?.m_name ?? left?.m_shared?.m_name ?? "a hidden item"}: {why}.");
            }
        }

        /// <summary>DebugLog: who takes what in hand, doing what, and the code that asked for it.</summary>
        [HarmonyPatch(typeof(Humanoid), nameof(Humanoid.EquipItem))]
        internal static class EquipLogPatch
        {
            private static void Postfix(Humanoid __instance, ItemDrop.ItemData item, bool __result)
            {
                if (!__result || !(__instance is Villager villager) || item?.m_shared == null || !LogicConfig.IsOn(LogicConfig.DebugLog) ||
                    item.m_shared.m_itemType == ItemDrop.ItemData.ItemType.Chest || item.m_shared.m_itemType == ItemDrop.ItemData.ItemType.Legs ||
                    item.m_shared.m_itemType == ItemDrop.ItemData.ItemType.Helmet || item.m_shared.m_itemType == ItemDrop.ItemData.ItemType.Shoulder)
                {
                    return;
                }

                var trace = new System.Diagnostics.StackTrace(2, false);
                var callers = new System.Collections.Generic.List<string>();
                for (int i = 0; i < trace.FrameCount && callers.Count < 3; i++)
                {
                    System.Reflection.MethodBase method = trace.GetFrame(i)?.GetMethod();
                    if (method?.DeclaringType != null && method.DeclaringType.Namespace?.StartsWith("Villheim") == true)
                    {
                        callers.Add(method.DeclaringType.Name + "." + method.Name);
                    }
                }

                VillheimPlugin.Log.LogInfo($"[hands] {villager.VillagerName} takes {item.m_shared.m_name} in hand while {Status.Current(villager)} " +
                                           $"({Chores.Describe(villager) ?? "no chore"}), from {string.Join(" < ", callers)}.");
            }
        }
    }
}
