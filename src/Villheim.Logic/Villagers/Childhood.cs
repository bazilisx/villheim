using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Children, after Millenaire, where villages grow through families as well as newcomers. When a two-bed home has
    /// both beds claimed, the chest has food and a bed stands free, the village's next arrival may be a child born in
    /// that home instead of a stranger walking in. A child starts at about 0.6 of a grown villager's size, shaped as a
    /// child (ChildBody), and grows up over four days. Until then he doesn't work, takes no trade, role or watch, plays (ChildPlay), runs to the hearth
    /// in a fight, and talks like the young.
    /// </summary>
    internal static class Childhood
    {
        public static readonly int KeyBorn = "villheim_born".GetStableHashCode();
        public const int GrowDays = 4;

        private sealed class State
        {
            public float NextScale;
            public bool WasChild;
            public bool? NoBeard;
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();

        private static int Today => EnvMan.instance != null ? EnvMan.instance.GetDay() : 0;

        public static bool IsChild(Villager villager)
        {
            if (villager?.Zdo == null)
            {
                return false;
            }

            int born = villager.Zdo.GetInt(KeyBorn, -1);
            return born >= 0 && Today - born < GrowDays;
        }

        /// <summary>
        /// Every ten seconds: a child's body is shaped for his age (ChildBody, every frame), and the day he grows up
        /// the chronicle says so and he is dressed again, now with the beard his looks give him. A change to
        /// ChildNoBeard dresses every child again.
        /// </summary>
        public static void Update(Villager villager)
        {
            State state = States.GetOrCreateValue(villager);
            if (Time.time < state.NextScale || villager.Zdo == null)
            {
                return;
            }

            state.NextScale = Time.time + 10f;
            int born = villager.Zdo.GetInt(KeyBorn, -1);
            if (born < 0)
            {
                return;
            }

            bool child = IsChild(villager);
            bool noBeard = LogicConfig.ChildNoBeard == null || LogicConfig.ChildNoBeard.Value;
            if (child)
            {
                ChildBody.Track(villager);
                if (state.NoBeard.HasValue && state.NoBeard.Value != noBeard)
                {
                    villager.LooksApplied = false;
                }
            }
            else if (state.WasChild)
            {
                Chronicle.Add(villager.VillageId, $"{villager.VillagerName} is grown up now.");
                villager.LooksApplied = false;
            }

            state.NoBeard = noBeard;
            state.WasChild = child;
        }

        /// <summary>A home where a couple sleeps: at least two beds, all claimed. Null if there is none.</summary>
        public static Plot FamilyHome(VillageHearth hearth, VillageState state)
        {
            var beds = Beds.Of(hearth);
            foreach (Plot plot in state.Plots.Where(p => p.Role == "House" || string.IsNullOrEmpty(p.Role)))
            {
                var inHome = beds.Where(b => Utils.DistanceXZ(b.transform.position, plot.Position) < plot.Radius * 0.75f).ToList();
                if (inHome.Count >= 2 && inHome.All(b => Beds.IsClaimed(hearth, b)))
                {
                    return plot;
                }
            }

            return null;
        }
    }
}
