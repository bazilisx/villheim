using System.Runtime.CompilerServices;
using UnityEngine;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// What a villager is doing right now, for the hover text and his dot on the map.
    ///
    /// The brain records which routine ran him on each tick (Brain, Combat, Defenders). The status reads only that
    /// routine's own description, so a job set aside earlier (a hunt cut short by a chore, a forage left for the
    /// night) can never show through. Before this, the hover asked every routine in a fixed order and took the first
    /// answer, and the map turned anything it did not know (walking out to a tree, for one) into "relaxing".
    ///
    /// The owning machine writes the short and long text to the villager's ZDO when they change (at most once a
    /// second), so other players see the same thing.
    /// </summary>
    internal static class Status
    {
        internal enum Doer
        {
            None,
            Test,
            Heal,
            Leave,
            Escort,
            Sleep,
            Social,
            Hearth,
            FreeTime,
            Chores,
            BetweenJobs,
            Replant,
            Repair,
            Smith,
            Path,
            Sort,
            Hunt,
            Farm,
            Forage,
            Play,
            Fight,
            Fletch,
            Trophy,
            Elder,
            Decor,
            Home,
        }

        private static readonly int KeyShort = "villheim_task".GetStableHashCode();
        private static readonly int KeyLong = "villheim_task_long".GetStableHashCode();

        private sealed class State
        {
            public Doer Doer;
            public float At = -100f;
            public float NextPublish;
            public string Published;
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();

        /// <summary>The routine that ran the villager this tick.</summary>
        public static void Set(Villager villager, Doer doer)
        {
            State state = States.GetOrCreateValue(villager);
            state.Doer = doer;
            state.At = Time.time;
        }

        /// <summary>The routine that ran him in the last second and a half, or None.</summary>
        public static Doer Current(Villager villager) =>
            States.TryGetValue(villager, out State state) && Time.time - state.At < 1.5f ? state.Doer : Doer.None;

        private static bool Owner(Villager villager) => villager.NView != null && villager.NView.IsValid() && villager.NView.IsOwner();

        /// <summary>What he is doing in a few words, for the hover text ("felling a tree").</summary>
        public static string Long(Villager villager)
        {
            if (!Owner(villager))
            {
                string shared = villager.Zdo?.GetString(KeyLong, "");
                return string.IsNullOrEmpty(shared) ? null : shared;
            }

            switch (Current(villager))
            {
                case Doer.Test: return TestActs.Describe(villager) ?? "testing";
                case Doer.Heal: return Healing.Describe(villager) ?? "resting to heal";
                case Doer.Leave: return "leaving the village";
                case Doer.Escort: return "escorting a friend";
                case Doer.Sleep: return Sleep.Describe(villager) ?? "going to bed";
                case Doer.Social: return "greeting someone";
                case Doer.Hearth: return "tending the hearth";
                case Doer.FreeTime: return FreeTime.Describe(villager) ?? "relaxing";
                case Doer.Chores: return Chores.Describe(villager) ?? "heading out to work";
                case Doer.BetweenJobs: return "resting between jobs";
                case Doer.Replant: return Replanting.Describe(villager) ?? "planting a tree";
                case Doer.Repair: return Repairs.Describe(villager) ?? "repairing";
                case Doer.Smith: return Smithing.Describe(villager) ?? "making gear";
                case Doer.Path: return "laying a path";
                case Doer.Sort: return Sorting.Describe(villager) ?? "sorting the village stores";
                case Doer.Hunt: return Hunting.Describe(villager) ?? "hunting";
                case Doer.Farm: return Farming.Describe(villager) ?? "working the farm";
                case Doer.Forage: return Foraging.Describe(villager) ?? "foraging";
                case Doer.Play: return ChildPlay.Describe(villager) ?? "playing";
                case Doer.Fight: return Combat.Describe(villager) ?? "fighting";
                case Doer.Fletch: return Fletching.Describe(villager) ?? "making arrows";
                case Doer.Trophy: return Trophies.Describe(villager) ?? "seeing to a trophy";
                case Doer.Elder: return ElderWork.Describe(villager) ?? "helping about the village";
                case Doer.Decor: return HomeDecor.Describe(villager) ?? "fixing up the home";
                case Doer.Home: return HomeLife.Describe(villager) ?? "at home";
            }

            // Nothing of ours ran him lately: the game's own AI has him (a fight with a player), or he is loading.
            VillagerAI ai = villager.GetComponent<VillagerAI>();
            return ai != null && ai.GetTargetCreature() != null ? "fighting" : null;
        }

        /// <summary>A word or two for the map ("chopping", "harvesting", "relaxing").</summary>
        public static string Short(Villager villager)
        {
            if (!Owner(villager))
            {
                string shared = villager.Zdo?.GetString(KeyShort, "");
                return string.IsNullOrEmpty(shared) ? "about" : shared;
            }

            string text = (Long(villager) ?? "").ToLowerInvariant();
            switch (Current(villager))
            {
                case Doer.Test: return "testing";
                case Doer.Heal:
                    return text.Contains("eat") ? "eating" : text.Contains("cook") || text.Contains("roast") || text.Contains("fire") ? "cooking" : "resting";
                case Doer.Leave: return "leaving";
                case Doer.Escort: return "escorting";
                case Doer.Sleep: return text == "asleep" ? "sleeping" : "resting";
                case Doer.Social: return "greeting";
                case Doer.Hearth: return "tending fire";
                case Doer.Chores: return ChoreWord(text);
                case Doer.BetweenJobs: return "relaxing";
                case Doer.Replant: return "planting";
                case Doer.Repair: return text.Contains("fence") ? "fencing" : "repairing";
                case Doer.Smith: return "smithing";
                case Doer.Path: return "laying paths";
                case Doer.Sort: return "sorting stores";
                case Doer.Hunt: return text.Contains("butcher") ? "butchering" : text.Contains("carrying") ? "hauling meat" : "hunting";
                case Doer.Farm:
                    return text.Contains("harvest") ? "harvesting" : text.Contains("plant") ? "planting" :
                        text.Contains("carrying") ? "hauling" : text.Contains("animal") ? "tending animals" : "farming";
                case Doer.Forage: return text.Contains("carrying") ? "hauling" : "harvesting";
                case Doer.Play: return text.Contains("help") ? "helping" : "playing";
                case Doer.Fight: return Combat.Short(villager);
                case Doer.Fletch: return "making arrows";
                case Doer.Trophy: return text.Contains("hanging") ? "hanging a trophy" : "fetching a trophy";
                case Doer.FreeTime: return FreeWord(text);
                case Doer.Decor: return text.Contains("helping") ? "helping" : "decorating";
                case Doer.Home: return "at home";
                case Doer.Elder:
                    return text.Contains("fire") ? "tending fire" : text.Contains("cook") ? "cooking" : text.Contains("farm") ? "farming" :
                        text.Contains("animal") ? "tending animals" : text.Contains("arrow") ? "making arrows" :
                        text.Contains("chest") ? "seeing to chests" : text.Contains("sweep") ? "tidying" : "helping";
            }

            return text == "fighting" ? "fighting" : "about";
        }

        private static string ChoreWord(string text)
        {
            if (text.Contains("fell") || text.Contains("splitting") || text.Contains("log")) return "chopping";
            if (text.Contains("rock") || text.Contains("mining")) return "mining";
            if (text == "building" || text.Contains("rebuilding")) return "building";
            if (text.Contains("carrying")) return "hauling";
            if (text.Contains("gathering") || text.Contains("picking"))
            {
                return text.Contains("wood") ? "picking up wood" : text.Contains("stone") ? "picking up stone" : "picking up";
            }

            return "heading to work";
        }

        private static string FreeWord(string text)
        {
            if (text.Contains("watching")) return "watching";
            if (text.Contains("watch")) return "on watch";
            if (text.Contains("chat")) return "chatting";
            if (text.Contains("stroll")) return "strolling";
            if (text.Contains("busy at") || text.Contains("making") || text.Contains("keeping busy")) return "crafting";
            if (text.Contains("at the hearth")) return "at the hearth";
            return "relaxing";
        }

        /// <summary>The owner writes the status to the ZDO when it changes, for everyone else's hover and map.</summary>
        public static void Publish(Villager villager)
        {
            if (!Owner(villager) || villager.Zdo == null)
            {
                return;
            }

            State state = States.GetOrCreateValue(villager);
            if (Time.time < state.NextPublish)
            {
                return;
            }

            state.NextPublish = Time.time + 1f;
            string longText = Long(villager) ?? "";
            string shortText = Short(villager);
            string both = shortText + "|" + longText;
            if (both == state.Published)
            {
                return;
            }

            state.Published = both;
            villager.Zdo.Set(KeyShort, shortText);
            villager.Zdo.Set(KeyLong, longText);
        }
    }
}
