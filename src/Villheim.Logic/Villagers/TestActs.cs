using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// 'vh act &lt;villager|near&gt; &lt;action&gt; [seconds]': makes one villager do one thing on demand, to test movement,
    /// poses and animations with 'vh trace' running. The action comes before everything but a fight, for 60 seconds
    /// by default, or until 'vh act &lt;villager&gt; stop'.
    /// </summary>
    internal static class TestActs
    {
        public static readonly string[] Actions =
        {
            "come", "patrol", "sit", "ground", "rest", "kneel", "dance", "bed", "fire", "cook", "hammer", "chop",
            "wave", "cheer", "point", "thumbsup", "laugh", "stop",
        };

        public const string Help =
            "come (walk to you), patrol (walk back and forth 10 m), sit (nearest bench or chair), ground (sit on the ground), " +
            "rest, kneel, dance, bed (lie in the nearest village bed), fire (see to the hearth fire), cook (at the cooking station), " +
            "hammer, chop (tool swings on the spot), wave, cheer, point, thumbsup, laugh (gestures), stop";

        private sealed class Act
        {
            public string What;
            public float Until;
            public Vector3 Spot;
            public Vector3 Other;
            public Vector3 Look;
            public bool Arrived;
            public float Next;
            public Chair Seat;
            public Bed Bed;
            public Player Player;
        }

        private static readonly ConditionalWeakTable<Villager, Act> Acts = new ConditionalWeakTable<Villager, Act>();

        public static string Describe(Villager villager) =>
            Acts.TryGetValue(villager, out Act act) && act.What != null ? "testing: " + act.What : null;

        public static string Start(Player player, string who, string what, float seconds)
        {
            what = (what ?? "").ToLowerInvariant();
            if (!Actions.Contains(what))
            {
                return $"Villheim: actions are {Help}.";
            }

            Villager villager = Character.GetAllCharacters().OfType<Villager>()
                .Where(v => !v.IsDead() && (who == "near" || who == "nearest" ||
                                            string.Equals(v.VillagerName, who, System.StringComparison.OrdinalIgnoreCase)))
                .OrderBy(v => Vector3.Distance(v.transform.position, player.transform.position)).FirstOrDefault();
            if (villager == null)
            {
                return $"Villheim: no villager called '{who}' is loaded ('near' takes the nearest).";
            }

            Act act = Acts.GetOrCreateValue(villager);
            End(villager, act);
            if (what == "stop")
            {
                return $"Villheim: {villager.VillagerName} goes back to village life.";
            }

            act.What = what;
            act.Until = Time.time + Mathf.Clamp(seconds, 5f, 600f);
            act.Player = player;
            act.Spot = villager.transform.position;
            act.Look = villager.transform.position + villager.transform.forward * 3f;
            act.Arrived = false;
            act.Next = 0f;
            Walker.For(villager).Reset();

            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            switch (what)
            {
                case "patrol":
                    act.Other = villager.transform.position + villager.transform.forward * 10f;
                    break;
                case "sit":
                    act.Seat = Seats.Free(villager);
                    if (act.Seat == null)
                    {
                        act.What = null;
                        return $"Villheim: no free bench or chair of {villager.VillagerName}'s village nearby.";
                    }

                    Seats.Claim(act.Seat, villager);
                    act.Spot = Seats.Point(act.Seat).position;
                    break;
                case "bed":
                    act.Bed = hearth != null ? Beds.Of(hearth).OrderBy(b => Vector3.Distance(b.transform.position, villager.transform.position)).FirstOrDefault() : null;
                    if (act.Bed == null)
                    {
                        act.What = null;
                        return $"Villheim: {villager.VillagerName}'s village has no beds (see 'vh beds').";
                    }

                    act.Spot = (act.Bed.m_spawnPoint != null ? act.Bed.m_spawnPoint : act.Bed.transform).position;
                    break;
                case "fire":
                    if (hearth == null)
                    {
                        act.What = null;
                        return "Villheim: no hearth.";
                    }

                    Vector3 side = villager.transform.position - hearth.transform.position;
                    side.y = 0f;
                    act.Spot = hearth.transform.position + (side.sqrMagnitude > 0.01f ? side.normalized : Vector3.forward) * 1.7f;
                    act.Look = hearth.transform.position + Vector3.up * 0.3f;
                    break;
                case "cook":
                    CookingStation station = hearth != null ? Healing.Station(hearth) : null;
                    if (station == null)
                    {
                        act.What = null;
                        return "Villheim: no cooking station at the hearth.";
                    }

                    act.Spot = station.transform.position + station.transform.forward * 1.3f;
                    act.Look = station.transform.position + Vector3.up * 0.5f;
                    break;
            }

            return $"Villheim: {villager.VillagerName}: {what} for {act.Until - Time.time:0} s ('vh act {villager.VillagerName} stop' ends it).";
        }

        /// <summary>True while a test action runs (the brain does nothing else).</summary>
        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            if (!Acts.TryGetValue(villager, out Act act) || act.What == null)
            {
                return false;
            }

            if (Time.time > act.Until)
            {
                End(villager, act);
                return false;
            }

            switch (act.What)
            {
                case "come":
                    if (act.Player != null && Walker.For(villager).Go(villager, ai, dt, act.Player.transform.position, 2f) != WalkResult.Walking)
                    {
                        ai.StopMoving();
                        ai.LookAt(act.Player.GetEyePoint());
                    }

                    return true;

                case "patrol":
                    if (Walker.For(villager).Go(villager, ai, dt, act.Arrived ? act.Spot : act.Other, 0.8f) != WalkResult.Walking)
                    {
                        act.Arrived = !act.Arrived;
                        Walker.For(villager).Reset();
                    }

                    return true;

                case "sit":
                    if (!act.Arrived)
                    {
                        if (Walker.For(villager).Go(villager, ai, dt, act.Spot, 0.6f) == WalkResult.Walking)
                        {
                            return true;
                        }

                        act.Arrived = true;
                    }

                    ai.StopMoving();
                    Seats.SitOn(villager, act.Seat);
                    return true;

                case "bed":
                    if (!act.Arrived)
                    {
                        if (Walker.For(villager).Go(villager, ai, dt, act.Spot, 1f) == WalkResult.Walking)
                        {
                            return true;
                        }

                        act.Arrived = true;
                    }

                    ai.StopMoving();
                    Body.PinTo(villager, act.Bed.m_spawnPoint != null ? act.Bed.m_spawnPoint : act.Bed.transform, act.Bed.gameObject);
                    Poses.Hold(villager, "attach_bed");
                    return true;

                case "ground":
                case "rest":
                case "kneel":
                case "dance":
                    ai.StopMoving();
                    Poses.Hold(villager, "emote_" + (act.What == "ground" ? "sit" : act.What));
                    return true;

                case "fire":
                case "cook":
                    if (!act.Arrived)
                    {
                        if (Walker.For(villager).Go(villager, ai, dt, act.Spot, 0.6f) == WalkResult.Walking)
                        {
                            return true;
                        }

                        act.Arrived = true;
                    }

                    ai.StopMoving();
                    ai.LookAt(act.Look);
                    if (Time.time >= act.Next)
                    {
                        act.Next = Time.time + 5f;
                        Poses.Trigger(villager, "interact");
                    }

                    return true;

                case "hammer":
                case "chop":
                    ai.StopMoving();
                    VillagerLooks.Hold(villager, act.What == "hammer" ? VillagerLooks.Tool.Hammer : VillagerLooks.Tool.Axe);
                    if (Time.time >= act.Next)
                    {
                        act.Next = Time.time + 1.6f;
                        Chores.ToolAnimation(villager, null);
                    }

                    return true;

                default:
                    // Gestures: once at the start, then stand.
                    ai.StopMoving();
                    if (act.Next <= 0f)
                    {
                        act.Next = Time.time;
                        Poses.Gesture(villager, act.What);
                    }

                    return true;
            }
        }

        private static void End(Villager villager, Act act)
        {
            if (act.What == "sit")
            {
                Seats.StandUp(villager);
            }

            if (act.What == "bed")
            {
                Body.Unpin(villager);
                Poses.Release(villager);
                if (villager.m_body != null)
                {
                    villager.m_body.useGravity = true;
                }

                if (act.Bed != null)
                {
                    villager.transform.position = act.Bed.transform.position + act.Bed.transform.right * 1.2f + Vector3.up * 0.1f;
                }
            }

            act.What = null;
            act.Seat = null;
            act.Bed = null;
        }
    }
}
