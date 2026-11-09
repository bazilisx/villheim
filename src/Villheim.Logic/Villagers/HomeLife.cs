using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Evenings at home (Tyler, D-073, step 5). Each evening every household either spends it at home together or goes
    /// to the hearth with the rest of the village, rolled once a day per home: a family stays home HomeEveningShare of
    /// evenings, a lone villager half as often, and rain makes home likelier. In a family at home now and then one grown
    /// member goes to the hearth all the same. Feast nights and festivals bring everyone to the hearth.
    ///
    /// At home they sit on the home's own chairs and benches, or on the floor round its middle, each in his own spot,
    /// and look at each other now and then. From about 16:00, once the day's work is done (work comes first in the
    /// Brain), until bedtime, when Sleep sends everyone but the night watch to his own bed. Doors are closed behind them
    /// on the way in and out (Walker). A villager who can't get into his home goes to the hearth for the night.
    /// </summary>
    internal static class HomeLife
    {
        public static bool On => LogicConfig.IsOn(LogicConfig.HomeEvenings);

        private const float EveningStart = 0.68f;

        private sealed class State
        {
            public int Day = -1;
            public bool Home;
            public bool Failed;
            public Vector3 PlotAt;
            public Vector3 Spot;
            public Chair Chair;
            public bool Arrived;
            public float GiveUpAt;
            public float NextPick;
            public float NextGlance;
            public bool Family;
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();

        private static bool Evening()
        {
            if (EnvMan.instance == null)
            {
                return false;
            }

            float day = EnvMan.instance.GetDayFraction();
            return day >= EveningStart;
        }

        public static string Describe(Villager villager)
        {
            if (!States.TryGetValue(villager, out State state) || !state.Home)
            {
                return null;
            }

            if (!state.Arrived)
            {
                return "going home for the evening";
            }

            return state.Family ? "spending the evening at home with the family" : "spending the evening at home";
        }

        /// <summary>Whether the household spends tonight at home, and whether this member goes to the hearth anyway.</summary>
        private static bool TonightAtHome(Villager villager, Households.Household home, int day)
        {
            int plotKey = $"{Mathf.RoundToInt(home.Plot.Position.x)}:{Mathf.RoundToInt(home.Plot.Position.z)}".GetStableHashCode();
            var rng = new System.Random(unchecked(villager.VillageId * 31 + plotKey * 17 + day * 7919));
            float share = LogicConfig.HomeEveningShare != null ? Mathf.Clamp01(LogicConfig.HomeEveningShare.Value) : 0.6f;
            if (!home.IsFamily)
            {
                share *= 0.5f;
            }

            if (EnvMan.IsWet())
            {
                share = Mathf.Min(1f, share + 0.25f);
            }

            if (rng.NextDouble() >= share)
            {
                return false;
            }

            if (!home.IsFamily || Childhood.IsChild(villager))
            {
                return true;
            }

            // Now and then a grown member of a family at home goes to the hearth to see the others.
            var own = new System.Random(unchecked(villager.Zdo.GetInt(Keys.VillagerSeed) * 13 + day * 104729));
            return own.NextDouble() >= 0.2;
        }

        /// <summary>True while going home or at home for the evening.</summary>
        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            State state = States.GetOrCreateValue(villager);
            if (!On || villager.Zdo == null || !Evening() || Wanderers.IsWanderer(villager) || Roles.IsNightWatch(villager) ||
                Gatherings.FeastTonight(villager.VillageId) || Living.Holiday(villager.VillageId))
            {
                state.Home = false;
                return false;
            }

            int day = EnvMan.instance.GetDay();
            if (state.Day != day)
            {
                Households.Household home = Households.Of(villager);
                state.Day = day;
                state.Failed = false;
                state.Arrived = false;
                state.Chair = null;
                state.Home = home != null && TonightAtHome(villager, home, day);
                state.Family = home != null && home.IsFamily;
                state.PlotAt = home != null ? home.Plot.Position : Vector3.zero;
                state.NextPick = 0f;
                if (state.Home)
                {
                    VillheimPlugin.Debug($"{villager.VillagerName} spends the evening at home{(home.IsFamily ? " with the family" : "")}.");
                }
            }

            if (!state.Home || state.Failed)
            {
                return false;
            }

            Households.Household household = Households.Of(villager);
            if (household == null || Utils.DistanceXZ(household.Plot.Position, state.PlotAt) > 0.5f)
            {
                state.Home = false;
                return false;
            }

            if (Time.time >= state.NextPick)
            {
                Pick(villager, household, state);
            }

            if (!state.Arrived)
            {
                Vector3 goal = state.Chair != null ? Seats.Point(state.Chair).position : state.Spot;
                WalkResult step = Walker.For(villager).Go(villager, ai, dt, goal, state.Chair != null ? 0.8f : 0.6f);
                if (step == WalkResult.Walking && Time.time < state.GiveUpAt)
                {
                    return true;
                }

                if (Utils.DistanceXZ(villager.transform.position, goal) > 4f)
                {
                    // Can't get in tonight: the hearth like everyone else.
                    VillheimPlugin.Debug($"{villager.VillagerName} can't get into his home; off to the hearth.");
                    state.Failed = true;
                    return false;
                }

                state.Arrived = true;
                state.NextGlance = Time.time + Random.Range(4f, 10f);
            }

            ai.StopMoving();
            if (villager.GetRightItem() != null)
            {
                HandItems.PutAway(villager);
            }

            if (state.Chair != null)
            {
                if (!Seats.SitOn(villager, state.Chair))
                {
                    state.NextPick = 0f; // the seat is gone or taken: pick again
                }
            }
            else
            {
                Poses.Hold(villager, Poses.Sit);
            }

            // Looks at one of the family, or round the room, now and then.
            if (Time.time >= state.NextGlance)
            {
                state.NextGlance = Time.time + Random.Range(6f, 15f);
                Villager other = household.Members
                    .Where(m => m != villager && m != null && !m.IsDead() && Vector3.Distance(m.transform.position, villager.transform.position) < 8f)
                    .OrderBy(_ => Random.value).FirstOrDefault();
                if (other != null)
                {
                    ai.LookAt(other.GetEyePoint());
                }
                else
                {
                    IdleLife.Tick(villager, ai);
                }
            }

            return true;
        }

        /// <summary>A free chair or bench of the home, or a spot on the floor round its middle, his own by his place in the household.</summary>
        private static void Pick(Villager villager, Households.Household home, State state)
        {
            state.NextPick = Time.time + Random.Range(60f, 120f);
            Plot plot = home.Plot;
            Chair chair = state.Chair != null && !Seats.TakenByOther(state.Chair, villager) ? state.Chair : HomeSeat(villager, plot);
            Vector3 before = state.Chair != null ? Seats.Point(state.Chair).position : state.Spot;
            if (chair != null)
            {
                Seats.Claim(chair, villager);
                state.Chair = chair;
            }
            else
            {
                int index = Mathf.Max(0, home.Members.IndexOf(villager));
                Vector3 spot = plot.Position + Quaternion.Euler(0f, index * 137.5f, 0f) * Vector3.forward * (1.2f + 0.5f * (index % 3));
                spot.y = plot.Position.y;
                Vector3 down = spot + Vector3.up * 1.2f;
                if (Physics.Raycast(down, Vector3.down, out RaycastHit hit, 2.5f, LayerMask.GetMask("piece", "terrain", "Default"),
                        QueryTriggerInteraction.Ignore))
                {
                    spot.y = hit.point.y;
                }

                state.Chair = null;
                state.Spot = spot;
            }

            Vector3 after = state.Chair != null ? Seats.Point(state.Chair).position : state.Spot;
            if (!state.Arrived || Vector3.Distance(before, after) > 0.5f)
            {
                state.Arrived = false;
                state.GiveUpAt = Time.time + 60f;
                Walker.For(villager).Reset();
            }
        }

        /// <summary>A chair or bench the village built inside the home that nobody else has.</summary>
        private static Chair HomeSeat(Villager villager, Plot plot)
        {
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid)
            {
                return null;
            }

            var seen = new HashSet<Chair>();
            Chair best = null;
            float bestDistance = float.MaxValue;
            foreach (Collider collider in Physics.OverlapSphere(plot.Position, plot.Radius * 0.8f, LayerMask.GetMask("piece", "piece_nonsolid")))
            {
                Chair chair = collider.GetComponentInParent<Chair>();
                if (chair == null || !seen.Add(chair) || chair.m_attachPoint == null || Seats.TakenByOther(chair, villager) ||
                    Mathf.Abs(chair.transform.position.y - plot.Position.y) > 3f)
                {
                    continue;
                }

                ZNetView view = chair.GetComponentInParent<ZNetView>();
                if (view == null || !view.IsValid() || view.GetZDO().GetInt(Keys.BuiltBy) != hearth.VillageId)
                {
                    continue;
                }

                float distance = Utils.DistanceXZ(chair.transform.position, plot.Position);
                if (distance < bestDistance)
                {
                    best = chair;
                    bestDistance = distance;
                }
            }

            return best;
        }

        /// <summary>For 'vh homes': who spends tonight at home.</summary>
        public static string Tonight(Villager villager)
        {
            Households.Household home = Households.Of(villager);
            if (!On || home == null || EnvMan.instance == null)
            {
                return "";
            }

            return TonightAtHome(villager, home, EnvMan.instance.GetDay()) ? "home" : "hearth";
        }
    }
}
