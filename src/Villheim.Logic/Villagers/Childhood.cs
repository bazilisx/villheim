using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Children, after Millenaire, where villages grow through families as well as newcomers. When a two-bed home has
    /// both beds claimed, the chest has food and a bed stands free, the village's next arrival may be a child born in
    /// that home instead of a stranger walking in. A child starts at two thirds of a grown villager's size and grows
    /// up over four days. Until then he doesn't work, takes no trade, role or watch, hides in a fight, and talks like
    /// the young.
    /// </summary>
    internal static class Childhood
    {
        public static readonly int KeyBorn = "villheim_born".GetStableHashCode();
        public const int GrowDays = 4;
        private const float StartScale = 0.65f;

        private sealed class State
        {
            public float NextScale;
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

        /// <summary>Keeps the child's size in step with his age (checked every ten seconds).</summary>
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

            float age = Mathf.Clamp01((Today - born + (EnvMan.instance != null ? EnvMan.instance.GetDayFraction() : 0f)) / GrowDays);
            float scale = Mathf.Lerp(StartScale, 1f, age);
            if (Mathf.Abs(villager.transform.localScale.x - scale) > 0.01f)
            {
                villager.transform.localScale = Vector3.one * scale;
                if (age >= 1f)
                {
                    Chronicle.Add(villager.VillageId, $"{villager.VillagerName} is grown up now.");
                }
            }
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
