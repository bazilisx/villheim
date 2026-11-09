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
    /// At home each member does one thing at a time and picks again every one or two minutes (Tyler, 2026-11-09):
    /// sits on one of the home's chairs or benches, sits on a bed (his own first; one person per bed), stands and talks
    /// with another member, or does something at the home's cooking station, chests, shelves or work tables (reaching in
    /// now and then). Sitting on the floor only in a camp's first homes (s1d1, or a village of one building) or in a
    /// home with no seat and no bed; otherwise a villager with nothing free stands and looks about the room.
    ///
    /// From about 16:00, once the day's work is done (work comes first in the Brain), until bedtime, when Sleep sends
    /// everyone but the night watch to his own bed. Doors are closed behind them on the way in and out (Walker). A
    /// villager who can't get into his home goes to the hearth for the night.
    /// </summary>
    internal static class HomeLife
    {
        public static bool On => LogicConfig.IsOn(LogicConfig.HomeEvenings);

        private const float EveningStart = 0.68f;

        private enum Act
        {
            Stand,
            Seat,
            Bed,
            Talk,
            Task,
            Floor,
        }

        private sealed class State
        {
            public int Day = -1;
            public bool Home;
            public bool Failed;
            public Vector3 PlotAt;
            public Act Act;
            public Vector3 Spot;
            public Vector3 Look;
            public Chair Chair;
            public Bed Bed;
            public Villager Partner;
            public Component Furniture;
            public bool Arrived;
            public float GiveUpAt;
            public float NextPick;
            public float NextGlance;
            public float NextReach;
            public bool Family;
            public int BedFrame = -1;
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();

        // Who sits on which bed, and who works at which piece of furniture, this evening (one each).
        private static readonly Dictionary<Bed, Villager> BedSitters = new Dictionary<Bed, Villager>();
        private static readonly Dictionary<Component, Villager> AtFurniture = new Dictionary<Component, Villager>();

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
                return "going home";
            }

            switch (state.Act)
            {
                case Act.Talk: return state.Partner != null ? "talking with " + state.Partner.VillagerName : "at home";
                case Act.Task: return "busy at home";
                default: return "at home";
            }
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

        /// <summary>
        /// Called after every brain tick: a villager who sat on a bed this evening and was not held there this tick
        /// gets up (unless he is asleep in it now, which Sleep holds).
        /// </summary>
        public static void AfterTick(Villager villager)
        {
            if (!States.TryGetValue(villager, out State state) || state.BedFrame < 0 || state.BedFrame == Time.frameCount)
            {
                return;
            }

            state.BedFrame = -1;
            if (!Sleep.IsAsleep(villager))
            {
                Body.Unpin(villager);
            }

            Let(villager, state);
        }

        /// <summary>Gives up the bed and furniture he had.</summary>
        private static void Let(Villager villager, State state)
        {
            Seats.Unclaim(state.Chair, villager);

            if (state.Bed != null && BedSitters.TryGetValue(state.Bed, out Villager sitter) && sitter == villager)
            {
                BedSitters.Remove(state.Bed);
            }

            if (state.Furniture != null && AtFurniture.TryGetValue(state.Furniture, out Villager worker) && worker == villager)
            {
                AtFurniture.Remove(state.Furniture);
            }
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
                Let(villager, state);
                state.Day = day;
                state.Failed = false;
                state.Arrived = false;
                state.Chair = null;
                state.Bed = null;
                state.Partner = null;
                state.Furniture = null;
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

            if (Time.time >= state.NextPick || !StillGood(villager, state))
            {
                Pick(villager, household, state);
            }

            if (!state.Arrived)
            {
                Vector3 goal = Goal(state);
                WalkResult step = Walker.For(villager).Go(villager, ai, dt, goal, state.Act == Act.Seat ? 0.8f : 0.6f);
                if (step == WalkResult.Walking && Time.time < state.GiveUpAt &&
                    !(state.Act == Act.Bed && Utils.DistanceXZ(villager.transform.position, goal) < 2f))
                {
                    return true;
                }

                if (Utils.DistanceXZ(villager.transform.position, goal) > 4f)
                {
                    // Can't get in tonight: the hearth like everyone else.
                    VillheimPlugin.Debug($"{villager.VillagerName} can't get into his home; off to the hearth.");
                    state.Failed = true;
                    Let(villager, state);
                    return false;
                }

                state.Arrived = true;
                state.NextGlance = Time.time + Random.Range(4f, 10f);
                state.NextReach = Time.time + Random.Range(1f, 3f);
            }

            ai.StopMoving();
            if (villager.GetRightItem() != null)
            {
                HandItems.PutAway(villager);
            }

            switch (state.Act)
            {
                case Act.Seat:
                    if (!Seats.SitOn(villager, state.Chair))
                    {
                        state.NextPick = 0f; // the seat is gone or taken: pick again
                    }

                    break;
                case Act.Bed:
                    // On the bed's own resting point, held there like a seat, sitting.
                    Transform point = BedPoint(state.Bed);
                    Body.PinTo(villager, point, state.Bed.gameObject);
                    state.BedFrame = Time.frameCount;
                    Poses.Hold(villager, Poses.Sit);
                    break;
                case Act.Talk:
                    ai.LookAt(state.Partner.GetEyePoint());
                    if (Time.time >= state.NextReach)
                    {
                        state.NextReach = Time.time + Random.Range(8f, 16f);
                        Moods.Think(villager, "chat");
                    }

                    break;
                case Act.Task:
                    ai.LookAt(state.Look);
                    if (Time.time >= state.NextReach)
                    {
                        // Reaching in at the shelf, the pot or the chest now and then.
                        state.NextReach = Time.time + Random.Range(4f, 8f);
                        Poses.Trigger(villager, "interact");
                    }

                    break;
                case Act.Floor:
                    Poses.Hold(villager, Poses.Sit);
                    break;
            }

            // Looks at one of the family, or round the room, now and then (not while talking: he looks at the other).
            if (state.Act != Act.Talk && state.Act != Act.Task && Time.time >= state.NextGlance)
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

        private static Transform BedPoint(Bed bed) => bed.m_spawnPoint != null ? bed.m_spawnPoint : bed.transform;

        private static Vector3 Goal(State state)
        {
            switch (state.Act)
            {
                case Act.Seat when state.Chair != null: return Seats.Point(state.Chair).position;
                case Act.Bed when state.Bed != null: return BedPoint(state.Bed).position;
                default: return state.Spot;
            }
        }

        /// <summary>What he is at still makes sense: the seat, bed or furniture is there, the other one is still about.</summary>
        private static bool StillGood(Villager villager, State state)
        {
            switch (state.Act)
            {
                case Act.Seat: return state.Chair != null && !Seats.TakenByOther(state.Chair, villager);
                case Act.Bed:
                    return state.Bed != null && (!BedSitters.TryGetValue(state.Bed, out Villager sitter) || sitter == villager) &&
                           !SomeoneAsleepIn(state.Bed, villager);
                case Act.Talk:
                    return state.Partner != null && !state.Partner.IsDead() && !Sleep.IsAsleep(state.Partner) &&
                           Status.Current(state.Partner) == Status.Doer.Home &&
                           Vector3.Distance(state.Partner.transform.position, state.Spot) < 3f;
                case Act.Task: return state.Furniture != null;
                default: return true;
            }
        }

        private static bool SomeoneAsleepIn(Bed bed, Villager villager) =>
            Character.GetAllCharacters().OfType<Villager>().Any(v => v != villager && v.VillageId == villager.VillageId && Sleep.IsAsleep(v) &&
                                                                     Vector3.Distance(Beds.Claimed(v), bed.transform.position) < 0.6f);

        /// <summary>
        /// Picks what he does next at home: a free seat, a bed, talk with another member, something at the furniture,
        /// and only in the earliest homes or a home with nowhere to sit, the floor. Weighted, so a family spreads over the
        /// room; a seat or bed already his is kept more often than not.
        /// </summary>
        private static void Pick(Villager villager, Households.Household home, State state)
        {
            state.NextPick = Time.time + Random.Range(60f, 120f);
            Plot plot = home.Plot;
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid)
            {
                return;
            }

            Vector3 before = state.Arrived ? Goal(state) : Vector3.zero;
            Act was = state.Act;
            if (state.Act == Act.Seat && state.Chair != null && StillGood(villager, state) && state.Arrived && Random.value < 0.5f)
            {
                return; // comfortable where he is
            }

            Let(villager, state);
            Chair chair = HomeSeat(villager, hearth, plot);
            Bed bed = HomeBed(villager, hearth, plot);
            Villager partner = home.Members.Where(m => m != villager && m != null && !m.IsDead() && !Sleep.IsAsleep(m) &&
                                                       Status.Current(m) == Status.Doer.Home &&
                                                       Utils.DistanceXZ(m.transform.position, plot.Position) < plot.Radius)
                .OrderBy(_ => Random.value).FirstOrDefault();
            Component furniture = HomeFurniture(villager, hearth, plot);
            bool anySeat = chair != null || bed != null || HasAnySeat(hearth, plot);
            bool early = (plot.Design ?? "").Contains("_s1d1") || VillageBrain.TierIndex(new VillageState(hearth.Zdo).Plots.Count) == 0;

            var options = new List<(Act Act, float Weight)>
            {
                (Act.Seat, chair != null ? 3f : 0f),
                (Act.Bed, bed != null ? 2f : 0f),
                (Act.Talk, partner != null ? 2f : 0f),
                (Act.Task, furniture != null ? 1.5f : 0f),
                (Act.Floor, !anySeat ? 2f : early ? 1f : 0f),
            };

            float total = options.Sum(o => o.Weight);
            Act act = Act.Stand;
            if (total > 0f)
            {
                float roll = Random.value * total;
                foreach ((Act Act, float Weight) option in options)
                {
                    roll -= option.Weight;
                    if (option.Weight > 0f && roll <= 0f)
                    {
                        act = option.Act;
                        break;
                    }
                }
            }

            state.Act = act;
            state.Chair = null;
            state.Bed = null;
            state.Partner = null;
            state.Furniture = null;
            int index = Mathf.Max(0, home.Members.IndexOf(villager));
            switch (act)
            {
                case Act.Seat:
                    Seats.Claim(chair, villager);
                    state.Chair = chair;
                    break;
                case Act.Bed:
                    BedSitters[bed] = villager;
                    state.Bed = bed;
                    break;
                case Act.Talk:
                    // A step from the other one, on this side of him, facing him.
                    Vector3 away = (villager.transform.position - partner.transform.position).Horizontal();
                    away = away.sqrMagnitude < 0.01f ? Quaternion.Euler(0f, index * 137.5f, 0f) * Vector3.forward : away.normalized;
                    state.Partner = partner;
                    state.Spot = Floor(partner.transform.position + away * 1.3f, plot);
                    break;
                case Act.Task:
                    AtFurniture[furniture] = villager;
                    state.Furniture = furniture;
                    Vector3 at = furniture.transform.position;
                    Vector3 toMiddle = (plot.Position - at).Horizontal();
                    toMiddle = toMiddle.sqrMagnitude < 0.01f ? furniture.transform.forward : toMiddle.normalized;
                    state.Spot = Floor(at + toMiddle * 1.1f, plot);
                    state.Look = at + Vector3.up * 0.8f;
                    break;
                default:
                    // Standing (or with nowhere to sit at all, sitting) in his own spot round the middle of the room.
                    state.Spot = Floor(plot.Position + Quaternion.Euler(0f, index * 137.5f, 0f) * Vector3.forward * (1.2f + 0.5f * (index % 3)), plot);
                    break;
            }

            Vector3 after = Goal(state);
            if (!state.Arrived || act != was || Vector3.Distance(before, after) > 0.5f)
            {
                state.Arrived = false;
                state.GiveUpAt = Time.time + 60f;
                Walker.For(villager).Reset();
                if (was == Act.Bed && state.BedFrame >= 0 && !Sleep.IsAsleep(villager))
                {
                    state.BedFrame = -1;
                    Body.Unpin(villager);
                }
            }
        }

        /// <summary>The floor (or ground) under a point near the home.</summary>
        private static Vector3 Floor(Vector3 spot, Plot plot)
        {
            spot.y = plot.Position.y;
            Vector3 down = spot + Vector3.up * 1.2f;
            if (Physics.Raycast(down, Vector3.down, out RaycastHit hit, 2.5f, LayerMask.GetMask("piece", "terrain", "Default"),
                    QueryTriggerInteraction.Ignore))
            {
                spot.y = hit.point.y;
            }

            return spot;
        }

        /// <summary>A piece of the village's in this home: built by it, or come with its design (no player made it).</summary>
        private static bool Ours(VillageHearth hearth, Component piece)
        {
            ZNetView view = piece.GetComponentInParent<ZNetView>();
            if (view == null || !view.IsValid())
            {
                return false;
            }

            int builtBy = view.GetZDO().GetInt(Keys.BuiltBy);
            Piece made = piece.GetComponentInParent<Piece>();
            return builtBy == hearth.VillageId || (builtBy == 0 && (made == null || made.GetCreator() == 0L));
        }

        private static IEnumerable<T> InHome<T>(VillageHearth hearth, Plot plot) where T : Component
        {
            var seen = new HashSet<T>();
            foreach (Collider collider in Physics.OverlapSphere(plot.Position, plot.Radius * 0.8f, LayerMask.GetMask("piece", "piece_nonsolid")))
            {
                T found = collider.GetComponentInParent<T>();
                if (found != null && seen.Add(found) && Mathf.Abs(found.transform.position.y - plot.Position.y) <= 3f && Ours(hearth, found))
                {
                    yield return found;
                }
            }
        }

        /// <summary>A chair or bench of the home that nobody else has, nearest the middle.</summary>
        private static Chair HomeSeat(Villager villager, VillageHearth hearth, Plot plot) =>
            InHome<Chair>(hearth, plot)
                .Where(c => c.m_attachPoint != null && !Seats.TakenByOther(c, villager))
                .OrderBy(c => Utils.DistanceXZ(c.transform.position, plot.Position))
                .FirstOrDefault();

        private static bool HasAnySeat(VillageHearth hearth, Plot plot) =>
            InHome<Chair>(hearth, plot).Any(c => c.m_attachPoint != null) || InHome<Bed>(hearth, plot).Any();

        /// <summary>His own bed if it is in this home, else a bed of the home nobody has claimed; one person per bed.</summary>
        private static Bed HomeBed(Villager villager, VillageHearth hearth, Plot plot)
        {
            Vector3 own = Beds.Claimed(villager);
            List<Bed> beds = InHome<Bed>(hearth, plot)
                .Where(b => (!BedSitters.TryGetValue(b, out Villager sitter) || sitter == null || sitter == villager || sitter.IsDead()) &&
                            !SomeoneAsleepIn(b, villager))
                .ToList();
            Bed mine = beds.FirstOrDefault(b => Vector3.Distance(b.transform.position, own) < 0.6f);
            return mine ?? beds.FirstOrDefault(b => !Beds.IsClaimed(hearth, b));
        }

        /// <summary>The home's cooking station, chest, shelf or work table that nobody else is at.</summary>
        private static Component HomeFurniture(Villager villager, VillageHearth hearth, Plot plot)
        {
            var found = new List<Component>();
            found.AddRange(InHome<CookingStation>(hearth, plot));
            found.AddRange(InHome<Fermenter>(hearth, plot));
            found.AddRange(InHome<CraftingStation>(hearth, plot));
            found.AddRange(InHome<Container>(hearth, plot));
            found.AddRange(InHome<Piece>(hearth, plot).Where(p =>
            {
                string name = Utils.GetPrefabName(p.gameObject).ToLowerInvariant();
                return name.Contains("shelf") || name.Contains("table") || name.Contains("rack");
            }));
            return found
                .Where(f => !AtFurniture.TryGetValue(f, out Villager worker) || worker == null || worker == villager || worker.IsDead())
                .OrderBy(_ => Random.value)
                .FirstOrDefault();
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
