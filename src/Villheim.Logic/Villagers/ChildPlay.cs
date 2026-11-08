using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// What children do by day (T-28): they explore the edges of the village, run about near the hearth and with the
    /// other children, and sit and watch the fire. They take no work. Now and then (ChildHelpChance) one
    /// goes to "help" a grown-up at work: he stands by, copies what he sees, says so, and the grown-up answers kindly
    /// and sends him back to play. The lines are under the tags "childhelp" (the child) and "childhelped" (the
    /// grown-up); with none written yet, nothing is said.
    ///
    /// Evening and night are left to free time and bed, like everyone else.
    /// </summary>
    internal static class ChildPlay
    {
        private enum Kind
        {
            None,
            Explore,
            Run,
            Fire,
            Help,
        }

        private sealed class State
        {
            public Kind Kind;
            public Vector3 Spot;
            public float Until;
            public float NextLeg;
            public float NextGesture;
            public Villager Helped;
            public bool Said;
            public float LastRun;
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();

        public static string Describe(Villager villager)
        {
            if (!States.TryGetValue(villager, out State state) || Time.time - state.LastRun > 1f)
            {
                return null;
            }

            switch (state.Kind)
            {
                case Kind.Explore: return "exploring";
                case Kind.Run: return "playing";
                case Kind.Fire: return "sitting by the fire";
                case Kind.Help: return state.Helped != null ? $"\"helping\" {state.Helped.VillagerName}" : "\"helping\"";
                default: return null;
            }
        }

        /// <summary>True while a child is at play (by day only).</summary>
        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            if (!Childhood.IsChild(villager) || EnvMan.instance == null || EnvMan.IsNight() || EnvMan.instance.GetDayFraction() >= 0.68f)
            {
                return false;
            }

            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid)
            {
                return false;
            }

            State state = States.GetOrCreateValue(villager);
            if (Time.time - state.LastRun > 2f || Time.time > state.Until || state.Kind == Kind.None ||
                (state.Kind == Kind.Help && (state.Helped == null || state.Helped.IsDead() || !AtWork(state.Helped))))
            {
                Choose(villager, hearth, state);
            }

            state.LastRun = Time.time;
            Vector3 center = hearth.transform.position;
            switch (state.Kind)
            {
                case Kind.Explore:
                case Kind.Run:
                    if (Time.time >= state.NextLeg ||
                        Walker.For(villager).Go(villager, ai, dt, state.Spot, 1f, state.Kind == Kind.Run) != WalkResult.Walking)
                    {
                        ai.StopMoving();
                        if (Time.time >= state.NextLeg)
                        {
                            // Off to the next spot: a run near the hearth, or a look further out at the edge.
                            state.Spot = state.Kind == Kind.Run ? Near(center, 4f, 12f) : Near(center, Radius() * 0.6f, Radius() + 12f);
                            state.NextLeg = Time.time + (state.Kind == Kind.Run ? Random.Range(3f, 7f) : Random.Range(10f, 20f));
                            Walker.For(villager).Reset();
                            if (state.Kind == Kind.Explore && Random.value < 0.4f)
                            {
                                Poses.Gesture(villager, "point");
                            }
                        }
                    }

                    return true;

                case Kind.Fire:
                    if (Walker.For(villager).Go(villager, ai, dt, state.Spot, 0.8f) == WalkResult.Walking)
                    {
                        return true;
                    }

                    ai.StopMoving();
                    ai.LookAt(center + Vector3.up);
                    Poses.Hold(villager, Poses.Sit);
                    return true;

                case Kind.Help:
                    return Help(villager, ai, dt, state);
            }

            return false;
        }

        private static float Radius() => VillheimConfig.VillageRadius.Value;

        private static void Choose(Villager villager, VillageHearth hearth, State state)
        {
            Vector3 center = hearth.transform.position;
            state.Helped = null;
            state.Said = false;
            state.NextLeg = 0f;
            Walker.For(villager).Reset();
            float helpChance = Mathf.Clamp01(LogicConfig.ChildHelpChance?.Value ?? 0.1f);
            Villager worker = Random.value < helpChance ? Worker(villager) : null;
            if (worker != null)
            {
                state.Kind = Kind.Help;
                state.Helped = worker;
                state.Until = Time.time + Random.Range(30f, 60f);
                return;
            }

            float roll = Random.value;
            state.Kind = roll < 0.4f ? Kind.Explore : roll < 0.8f ? Kind.Run : Kind.Fire;
            state.Until = Time.time + Random.Range(30f, 75f);
            state.Spot = state.Kind == Kind.Fire ? Near(center, 2.4f, 3f) : center;
        }

        /// <summary>A grown-up of the village at work within 40 m, or null.</summary>
        private static Villager Worker(Villager child) =>
            Character.GetAllCharacters().OfType<Villager>()
                .Where(v => v != child && !v.IsDead() && v.VillageId == child.VillageId && !Childhood.IsChild(v) && AtWork(v) &&
                            Utils.DistanceXZ(v.transform.position, child.transform.position) < 40f)
                .OrderBy(_ => Random.value).FirstOrDefault();

        private static bool AtWork(Villager v)
        {
            Status.Doer doer = Status.Current(v);
            return doer == Status.Doer.Chores || doer == Status.Doer.Farm || doer == Status.Doer.Repair || doer == Status.Doer.Smith ||
                   doer == Status.Doer.Path;
        }

        /// <summary>Stands by the grown-up, copies him, says he is helping; the grown-up answers.</summary>
        private static bool Help(Villager villager, VillagerAI ai, float dt, State state)
        {
            Villager adult = state.Helped;
            if (Walker.For(villager).Go(villager, ai, dt, adult.transform.position, 2.2f) == WalkResult.Walking)
            {
                return true;
            }

            ai.StopMoving();
            ai.LookAt(adult.GetCenterPoint());
            if (!state.Said)
            {
                state.Said = true;
                state.NextGesture = Time.time + Random.Range(2f, 5f);
                string line = Dialogue.LineFor(villager, "self", "childhelp", new[] { "childhelp" });
                if (line != null)
                {
                    Dialogue.Say(villager, line.Replace("{helped}", adult.VillagerName), 4f);
                    Dialogue.QueueLine(adult, "self", "childhelped", new[] { "childhelped" }, 3f);
                }
            }

            if (Time.time >= state.NextGesture)
            {
                state.NextGesture = Time.time + Random.Range(4f, 8f);
                // Copying the grown-up: a swing of empty hands, or a reach.
                Poses.Trigger(villager, Random.value < 0.5f ? "interact" : "emote_point");
            }

            return true;
        }

        private static Vector3 Near(Vector3 center, float min, float max)
        {
            float angle = Random.Range(0f, Mathf.PI * 2f);
            Vector3 p = center + new Vector3(Mathf.Sin(angle), 0f, Mathf.Cos(angle)) * Random.Range(min, max);
            if (ZoneSystem.instance != null && ZoneSystem.instance.GetGroundHeight(p, out float y))
            {
                p.y = y;
            }

            return p;
        }
    }
}
