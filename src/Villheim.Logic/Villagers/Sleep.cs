using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// The village's beds. Every bed the village built (or copied with a design) counts. Each villager claims one bed
    /// and keeps it; the bed is stored on the villager by its position, so the claim survives logouts. A villager's
    /// home is the building his bed stands in. The village only takes in a newcomer when a bed is free.
    /// </summary>
    internal static class Beds
    {
        private static readonly int KeyBed = "villheim_bed".GetStableHashCode();
        private static readonly Dictionary<int, (float Time, List<Bed> Beds)> Cache = new Dictionary<int, (float, List<Bed>)>();

        public static void Forget(int villageId) => Cache.Remove(villageId);

        /// <summary>Every bed of the village that is loaded now. Looked up at most every ten seconds.</summary>
        public static List<Bed> Of(VillageHearth hearth)
        {
            int id = hearth.VillageId;
            if (Cache.TryGetValue(id, out var cached) && Time.time - cached.Time < 10f && cached.Beds.All(b => b != null))
            {
                return cached.Beds;
            }

            var beds = new List<Bed>();
            var seen = new HashSet<Bed>();
            float radius = VillheimConfig.VillageRadius.Value + 15f;
            foreach (Collider collider in Physics.OverlapSphere(hearth.transform.position, radius, LayerMask.GetMask("piece", "piece_nonsolid")))
            {
                Bed bed = collider.GetComponentInParent<Bed>();
                if (bed == null || !seen.Add(bed) || bed.m_nview == null || !bed.m_nview.IsValid())
                {
                    continue;
                }

                if (bed.m_nview.GetZDO().GetInt(Keys.BuiltBy) == id)
                {
                    beds.Add(bed);
                }
            }

            // Same order on every client.
            beds.Sort((a, b) => a.transform.position.sqrMagnitude.CompareTo(b.transform.position.sqrMagnitude));
            Cache[id] = (Time.time, beds);
            return beds;
        }

        /// <summary>The villager's bed: the one he claimed, or a free one he claims now. Null when every bed is taken.</summary>
        public static Bed For(Villager villager)
        {
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid)
            {
                return null;
            }

            List<Bed> beds = Of(hearth);
            Vector3 claimed = villager.Zdo.GetVec3(KeyBed, Vector3.zero);
            if (claimed != Vector3.zero)
            {
                foreach (Bed bed in beds)
                {
                    if (Vector3.Distance(bed.transform.position, claimed) < 0.6f)
                    {
                        return bed;
                    }
                }
            }

            // Claimed beds of everyone else in the village who is loaded.
            var taken = new List<Vector3>();
            foreach (Character character in Character.GetAllCharacters())
            {
                if (character is Villager other && other != villager && !other.IsDead() && other.VillageId == villager.VillageId &&
                    other.Zdo != null)
                {
                    Vector3 theirs = other.Zdo.GetVec3(KeyBed, Vector3.zero);
                    if (theirs != Vector3.zero)
                    {
                        taken.Add(theirs);
                    }
                }
            }

            Vector3 home = villager.Zdo.GetVec3(Keys.VillagerHome, hearth.transform.position);
            Bed best = null;
            float bestDistance = float.MaxValue;
            foreach (Bed bed in beds)
            {
                if (taken.Any(t => Vector3.Distance(t, bed.transform.position) < 0.6f))
                {
                    continue;
                }

                float distance = Utils.DistanceXZ(bed.transform.position, home);
                if (distance < bestDistance)
                {
                    best = bed;
                    bestDistance = distance;
                }
            }

            if (best != null)
            {
                villager.Zdo.Set(KeyBed, best.transform.position);
                Plot plot = PlotAt(hearth, best.transform.position);
                villager.Zdo.Set(Keys.VillagerHome, plot != null ? plot.Position : best.transform.position);
                VillheimPlugin.Debug($"{villager.VillagerName} claims a bed{(plot != null ? " in the " + plot.Design : "")}.");
            }

            return best;
        }

        /// <summary>
        /// Beds left over once every villager has one: the village's beds less its villagers, as in Millenaire, where a
        /// building's residents are its beds. A newcomer only arrives when this is above zero.
        /// </summary>
        public static int Spare(VillageHearth hearth)
        {
            return Mathf.Max(0, Of(hearth).Count - Village.VillageBrain.CountVillagers(hearth.VillageId));
        }

        /// <summary>Beds nobody in the village has claimed yet (counting loaded villagers only).</summary>
        public static int Free(VillageHearth hearth)
        {
            List<Bed> beds = Of(hearth);
            int claimed = 0;
            foreach (Character character in Character.GetAllCharacters())
            {
                if (character is Villager villager && !villager.IsDead() && villager.VillageId == hearth.VillageId && villager.Zdo != null)
                {
                    Vector3 theirs = villager.Zdo.GetVec3(KeyBed, Vector3.zero);
                    if (theirs != Vector3.zero && beds.Any(b => Vector3.Distance(b.transform.position, theirs) < 0.6f))
                    {
                        claimed++;
                    }
                }
            }

            return Mathf.Max(0, beds.Count - claimed);
        }

        private static Plot PlotAt(VillageHearth hearth, Vector3 point)
        {
            var state = new VillageState(hearth.Zdo);
            Plot best = null;
            float bestDistance = float.MaxValue;
            foreach (Plot plot in state.Plots)
            {
                float distance = Utils.DistanceXZ(plot.Position, point);
                if (distance < plot.Radius && distance < bestDistance)
                {
                    best = plot;
                    bestDistance = distance;
                }
            }

            return best;
        }
    }

    /// <summary>
    /// Sleeping. Each villager has his own bedtime between 10 and 11 at night and gets up between 5 and 6 in the
    /// morning (fixed per villager, from his seed). At bedtime he walks to the bed he claimed and lies down in it; a
    /// villager with no bed stays at the fire. An enemy wakes him (the brain hands over to the fight first).
    /// </summary>
    internal static class Sleep
    {
        private const string BedPose = "attach_bed";

        private sealed class State
        {
            public bool Asleep;
            public bool Rough;
            public int HeldFrame;
            public float GiveUpAt;
            public Bed Bed;
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();

        /// <summary>Called after every brain tick: a sleeper the brain didn't keep in bed this tick (healing came first) gets up.</summary>
        public static void AfterTick(Villager villager)
        {
            if (States.TryGetValue(villager, out State state) && state.Asleep && state.HeldFrame != Time.frameCount)
            {
                Wake(villager);
            }
        }

        public static bool IsAsleep(Villager villager) => States.TryGetValue(villager, out State state) && state.Asleep;

        /// <summary>Hours (0 to 24) when this villager goes to bed and gets up.</summary>
        public static void Hours(Villager villager, out float bedtime, out float wake)
        {
            int seed = villager.Zdo != null ? villager.Zdo.GetInt(Keys.VillagerSeed) : 1;
            var rng = new System.Random(unchecked(seed * 977 + 13));
            bedtime = 22f + (float)rng.NextDouble();
            wake = 5f + (float)rng.NextDouble();
        }

        public static bool Bedtime(Villager villager)
        {
            if (EnvMan.instance == null)
            {
                return false;
            }

            float hour = EnvMan.instance.GetDayFraction() * 24f;
            Hours(villager, out float bedtime, out float wake);
            return hour >= bedtime || hour < wake;
        }

        /// <summary>True while going to bed or asleep.</summary>
        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            State state = States.GetOrCreateValue(villager);
            if (!Bedtime(villager))
            {
                if (state.Asleep)
                {
                    Wake(villager);
                    Moods.Think(villager, "sleptwell");
                    VillheimPlugin.Debug($"{villager.VillagerName} gets up.");
                }
                else if (state.Rough)
                {
                    Moods.Think(villager, "sleptrough");
                }

                state.Rough = false;

                state.GiveUpAt = 0f;
                return false;
            }

            if (state.Bed == null)
            {
                state.Bed = Beds.For(villager);
                if (state.Bed == null)
                {
                    return SleepUnderRoof(villager, ai, dt, state);
                }

                state.GiveUpAt = Time.time + 90f;
                Walker.For(villager).Reset();
            }

            Transform point = state.Bed.m_spawnPoint != null ? state.Bed.m_spawnPoint : state.Bed.transform;
            if (!state.Asleep)
            {
                WalkResult step = Walker.For(villager).Go(villager, ai, dt, point.position, 1f);
                float distance = Utils.DistanceXZ(villager.transform.position, point.position);
                if (step == WalkResult.Walking && Time.time < state.GiveUpAt)
                {
                    return true;
                }

                if (distance > 4f)
                {
                    // Can't reach the bed tonight: back to the fire.
                    VillheimPlugin.Debug($"{villager.VillagerName} can't get to his bed.");
                    state.Bed = null;
                    state.GiveUpAt = float.MaxValue;
                    return false;
                }

                state.Asleep = true;
                VillheimPlugin.Debug($"{villager.VillagerName} goes to sleep.");
            }

            // Lie in the bed: held at the bed's own resting point, as the game does for a player.
            ai.StopMoving();
            if (villager.GetRightItem() != null)
            {
                villager.HideHandItems(false, false);
            }

            Rigidbody body = villager.m_body;
            if (body != null)
            {
                // Held in place each tick, like the game's own attach: no gravity, no drift.
                body.useGravity = false;
                body.velocity = Vector3.zero;
            }

            villager.transform.position = point.position;
            villager.transform.rotation = point.rotation;
            state.HeldFrame = Time.frameCount;
            Poses.Hold(villager, BedPose);
            return true;
        }

        /// <summary>
        /// No bed: like Millenaire's fallback, he lies down under a roof (his home or the longhouse) rather than out in
        /// the open. With no building at all he stays at the fire (free time's night by the hearth).
        /// </summary>
        private static bool SleepUnderRoof(Villager villager, VillagerAI ai, float dt, State state)
        {
            state.Rough = true;
            Vector3? shelter = Roles.ShelterSpot(villager);
            if (!shelter.HasValue || state.GiveUpAt == float.MaxValue)
            {
                return false;
            }

            if (state.GiveUpAt <= 0f)
            {
                state.GiveUpAt = Time.time + 90f;
                Walker.For(villager).Reset();
            }

            WalkResult step = Walker.For(villager).Go(villager, ai, dt, shelter.Value, 1.5f);
            if (step == WalkResult.Walking && Time.time < state.GiveUpAt)
            {
                return true;
            }

            if (Utils.DistanceXZ(villager.transform.position, shelter.Value) > 5f)
            {
                state.GiveUpAt = float.MaxValue;
                return false;
            }

            ai.StopMoving();
            Poses.Hold(villager, Poses.Rest);
            return true;
        }

        /// <summary>Gets out of bed (morning, or an enemy close by).</summary>
        public static void Wake(Villager villager)
        {
            if (!States.TryGetValue(villager, out State state) || !state.Asleep)
            {
                return;
            }

            state.Asleep = false;
            Poses.Release(villager);
            if (villager.m_body != null)
            {
                villager.m_body.useGravity = true;
            }

            if (state.Bed != null)
            {
                // Step out beside the bed.
                Vector3 side = state.Bed.transform.position + state.Bed.transform.right * 1.2f;
                if (ZoneSystem.instance.GetGroundHeight(side, out float y))
                {
                    side.y = Mathf.Max(y, state.Bed.transform.position.y);
                }

                villager.transform.position = side + Vector3.up * 0.1f;
            }

            state.Bed = null;
        }
    }
}
