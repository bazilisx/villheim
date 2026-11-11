using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using HarmonyLib;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// The village's beds. Every bed the village built (or copied with a design) counts. This code lets each villager
    /// take a free bed and keep it; the bed is stored on the villager by its position, so it survives logouts. A
    /// villager's home is the building his bed stands in. The village only takes in a newcomer when a bed is free.
    /// D-077 sets beds and houses by arrival order instead, with beds never changing hands and a dead villager's bed
    /// kept; that is not built.
    /// </summary>
    internal static class Beds
    {
        private static readonly int KeyBed = "villheim_bed".GetStableHashCode();
        private static readonly Dictionary<int, (float Time, List<Bed> Beds)> Cache = new Dictionary<int, (float, List<Bed>)>();
        private static readonly Dictionary<int, float> NextTick = new Dictionary<int, float>();

        // A village bed gets an owner in the game's own bed fields (as a player's claimed bed has), so its hover shows
        // the villager's name. The owner id is made up: these top bits mark it as a village one, the low bits are the
        // villager's seed, or the village id with bit 32 set for a bed nobody has yet.
        private const long OwnerMark = 0x5648000000000000L;
        private const long OwnerMarkMask = unchecked((long)0xFFFF000000000000UL);
        private const long SpareBit = 0x100000000L;

        public static void Forget(int villageId) => Cache.Remove(villageId);

        private static long OwnerId(Villager villager) => OwnerMark | (uint)villager.Zdo.GetInt(Keys.VillagerSeed);

        private static long SpareId(int villageId) => OwnerMark | SpareBit | (uint)villageId;

        /// <summary>A bed of a village: marked by the village (its owner fields) or built by one.</summary>
        public static bool IsVillageBed(Bed bed)
        {
            ZDO zdo = bed != null && bed.m_nview != null && bed.m_nview.IsValid() ? bed.m_nview.GetZDO() : null;
            if (zdo == null)
            {
                return false;
            }

            return (zdo.GetLong(ZDOVars.s_owner, 0L) & OwnerMarkMask) == OwnerMark || zdo.GetInt(Keys.BuiltBy) != 0;
        }

        /// <summary>The villager's name on a village bed, or "" when nobody has it.</summary>
        public static string SleeperName(Bed bed)
        {
            ZDO zdo = bed?.m_nview != null && bed.m_nview.IsValid() ? bed.m_nview.GetZDO() : null;
            if (zdo == null || (zdo.GetLong(ZDOVars.s_owner, 0L) & OwnerMarkMask) != OwnerMark)
            {
                return "";
            }

            return zdo.GetString(ZDOVars.s_ownerName, "");
        }

        /// <summary>
        /// From the hearth's tick, every five seconds: two villagers with the same bed (an old save, or two claims in
        /// the same moment) keep it for the one who came first; everyone without a bed takes a free one; and each
        /// village bed shows whose it is in the game's own owner fields ("Bjorn's bed"), which also keeps players
        /// from claiming it (the game lets nobody claim a bed that has an owner).
        /// </summary>
        public static void Tick(VillageHearth hearth)
        {
            if (hearth == null || !hearth.IsValid || !LogicConfig.IsOn(LogicConfig.VillageBeds))
            {
                return;
            }

            int id = hearth.VillageId;
            if (NextTick.TryGetValue(id, out float next) && Time.time < next)
            {
                return;
            }

            NextTick[id] = Time.time + 5f;
            List<Bed> beds = Of(hearth);
            List<Villager> people = Character.GetAllCharacters().OfType<Villager>()
                .Where(v => !v.IsDead() && v.VillageId == id && v.Zdo != null && !Wanderers.IsWanderer(v))
                .OrderBy(v => v.Zdo.GetInt(Roles.KeyArrival, -1)).ThenBy(v => v.Zdo.GetInt(Keys.VillagerSeed))
                .ToList();

            var sleepers = new Dictionary<Bed, Villager>();
            foreach (Villager villager in people)
            {
                Vector3 claimed = Claimed(villager);
                if (claimed == Vector3.zero)
                {
                    continue;
                }

                Bed bed = beds.FirstOrDefault(b => Vector3.Distance(b.transform.position, claimed) < 0.6f);
                if (bed == null)
                {
                    continue;
                }

                if (sleepers.TryGetValue(bed, out Villager first))
                {
                    if (villager.NView != null && villager.NView.IsOwner())
                    {
                        villager.Zdo.Set(KeyBed, Vector3.zero);
                        VillheimPlugin.Log.LogInfo($"Beds: {villager.VillagerName} and {first.VillagerName} had the same bed; {first.VillagerName} keeps it.");
                    }

                    continue;
                }

                sleepers[bed] = villager;
            }

            foreach (Villager villager in people)
            {
                if (sleepers.ContainsValue(villager) || villager.NView == null || !villager.NView.IsOwner())
                {
                    continue;
                }

                Bed bed = For(villager);
                if (bed != null && !sleepers.ContainsKey(bed))
                {
                    sleepers[bed] = villager;
                }
            }

            foreach (Bed bed in beds)
            {
                sleepers.TryGetValue(bed, out Villager sleeper);
                long owner = sleeper != null ? OwnerId(sleeper) : SpareId(id);
                string name = sleeper != null ? sleeper.VillagerName : "";
                ZDO zdo = bed.m_nview.GetZDO();
                if (zdo.GetLong(ZDOVars.s_owner, 0L) != owner || zdo.GetString(ZDOVars.s_ownerName, "") != name)
                {
                    // Through the game's own call, so the bed's owner machine writes it.
                    bed.SetOwner(owner, name);
                }
            }
        }

        /// <summary>Where this villager's claimed bed stands, or zero when he has none.</summary>
        public static Vector3 Claimed(Villager villager) => villager?.Zdo != null ? villager.Zdo.GetVec3(KeyBed, Vector3.zero) : Vector3.zero;

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

                // The village's own beds, and any bed inside one of its buildings that no player made (beds that came
                // with a design were sometimes missed, and the villagers slept on the floor beside them).
                int builtBy = bed.m_nview.GetZDO().GetInt(Keys.BuiltBy);
                Piece piece = bed.GetComponent<Piece>();
                bool playerMade = piece != null && piece.GetCreator() != 0L;
                if (builtBy == id || (builtBy == 0 && !playerMade && InsidePlot(hearth, bed.transform.position)))
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
            Villager partner = Goals.Sweetheart(villager);
            Vector3 partnerBed = partner != null ? Claimed(partner) : Vector3.zero;
            Plot partnerHome = partnerBed != Vector3.zero ? PlotAt(hearth, partnerBed) : null;
            Bed best = null;
            float bestDistance = float.MaxValue;
            foreach (Bed bed in beds)
            {
                if (taken.Any(t => Vector3.Distance(t, bed.transform.position) < 0.6f))
                {
                    continue;
                }

                // Near his friend and away from his rival where he can (Neighbors), and in the same home as his
                // sweetheart. (D-073: each family member gets their own bed. D-077, not built, sets beds by arrival order.)
                float distance = Utils.DistanceXZ(bed.transform.position, home) + Neighbors.BedPenalty(villager, bed.transform.position);
                Plot bedHome = partnerHome != null ? PlotAt(hearth, bed.transform.position) : null;
                if (bedHome != null && Utils.DistanceXZ(bedHome.Position, partnerHome.Position) < 0.5f)
                {
                    distance -= 40f;
                }
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
                VillheimPlugin.Log.LogInfo($"Beds: {villager.VillagerName} claims a bed{(plot != null ? " in the " + plot.Design : "")}.");
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

        /// <summary>A villager of this village has claimed the bed.</summary>
        public static bool IsClaimed(VillageHearth hearth, Bed bed)
        {
            foreach (Character character in Character.GetAllCharacters())
            {
                if (character is Villager villager && !villager.IsDead() && villager.VillageId == hearth.VillageId && villager.Zdo != null &&
                    Vector3.Distance(villager.Zdo.GetVec3(KeyBed, Vector3.zero), bed.transform.position) < 0.6f)
                {
                    return true;
                }
            }

            return false;
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

        private static bool InsidePlot(VillageHearth hearth, Vector3 point) => PlotAt(hearth, point) != null;

        /// <summary>Why this villager has no bed, for the hover text and 'vh beds'.</summary>
        public static string NoBedReason(Villager villager)
        {
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid)
            {
                return "no village";
            }

            int count = Of(hearth).Count;
            return count == 0 ? "the village has no beds" : $"all {count} beds taken";
        }

        /// <summary>For 'vh beds': every bed near the village, whose it is and who sleeps in it.</summary>
        public static List<string> Report(VillageHearth hearth)
        {
            var lines = new List<string>();
            var counted = new HashSet<Bed>(Of(hearth));
            foreach (Collider collider in Physics.OverlapSphere(hearth.transform.position, VillheimConfig.VillageRadius.Value + 15f,
                         LayerMask.GetMask("piece", "piece_nonsolid")))
            {
                Bed bed = collider.GetComponentInParent<Bed>();
                if (bed == null || bed.m_nview == null || !bed.m_nview.IsValid() || lines.Any(l => l.Contains(bed.transform.position.ToString("F1"))))
                {
                    continue;
                }

                string sleeper = Character.GetAllCharacters().OfType<Villager>()
                    .FirstOrDefault(v => v.Zdo != null && Vector3.Distance(v.Zdo.GetVec3(KeyBed, Vector3.zero), bed.transform.position) < 0.6f)?.VillagerName ?? "nobody";
                Plot plot = PlotAt(hearth, bed.transform.position);
                lines.Add($"{Utils.GetPrefabName(bed.gameObject)} at {bed.transform.position.ToString("F1")}: " +
                          $"{(counted.Contains(bed) ? "village bed" : "not counted")} (built by {bed.m_nview.GetZDO().GetInt(Keys.BuiltBy)}, " +
                          $"creator {bed.GetComponent<Piece>()?.GetCreator() ?? 0}), in {plot?.Design ?? "no building"}, sleeper {sleeper}, " +
                          $"shows \"{(IsVillageBed(bed) ? SleeperName(bed) : bed.GetOwnerName())}\"");
            }

            return lines;
        }

        /// <summary>A village bed's hover: whose bed it is, with no claim or sleep prompt.</summary>
        [HarmonyPatch(typeof(Bed), nameof(Bed.GetHoverText))]
        internal static class HoverPatch
        {
            private static void Postfix(Bed __instance, ref string __result)
            {
                if (!LogicConfig.IsOn(LogicConfig.VillageBeds) || !IsVillageBed(__instance))
                {
                    return;
                }

                string name = SleeperName(__instance);
                __result = Localization.instance.Localize(name.Length > 0 ? name + "'s $piece_bed" : "Spare $piece_bed");
            }
        }

        /// <summary>Players can neither claim nor sleep in a village bed.</summary>
        [HarmonyPatch(typeof(Bed), nameof(Bed.Interact))]
        internal static class InteractPatch
        {
            private static bool Prefix(Bed __instance, Humanoid human, bool repeat, ref bool __result)
            {
                if (!LogicConfig.IsOn(LogicConfig.VillageBeds) || !IsVillageBed(__instance))
                {
                    return true;
                }

                __result = false;
                if (!repeat && human != null && human == Player.m_localPlayer)
                {
                    string name = SleeperName(__instance);
                    human.Message(MessageHud.MessageType.Center, name.Length > 0 ? $"This is {name}'s bed." : "This bed is kept for the villagers.");
                }

                return false;
            }
        }

        /// <summary>The village building that stands at the point (the nearest plot whose circle holds it), or null.</summary>
        internal static Plot PlotAt(VillageHearth hearth, Vector3 point)
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
            public bool Watched;
            public int HeldFrame;
            public float GiveUpAt;
            public Bed Bed;
            public int Failures;
            public bool LoggedNoBed;
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

        /// <summary>"asleep" in a bed, "resting (no bed)" with none, else null. 'vh beds' gives the reason.</summary>
        public static string Describe(Villager villager) =>
            !States.TryGetValue(villager, out State state) ? null : state.Asleep ? "asleep" : state.Rough && Bedtime(villager) ? "resting (no bed)" : null;

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
            if (Bedtime(villager) && Roles.IsNightWatch(villager))
            {
                // On watch tonight: no bed (free time sends him patrolling). Tired in the morning.
                if (state.Asleep)
                {
                    Wake(villager);
                }

                state.Rough = false;
                state.Watched = true;
                return false;
            }

            if (!Bedtime(villager) && state.Watched)
            {
                state.Watched = false;
                Moods.Think(villager, "watch");
                Village.Chronicle.Add(villager.VillageId, $"{villager.VillagerName} kept watch through the night.");
            }

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
                state.Failures = 0;
                state.LoggedNoBed = false;
                state.GiveUpAt = 0f;
                return false;
            }

            if (state.Bed == null)
            {
                state.Bed = Beds.For(villager);
                if (state.Bed == null)
                {
                    if (!state.LoggedNoBed)
                    {
                        state.LoggedNoBed = true;
                        VillheimPlugin.Log.LogInfo($"Bedtime: {villager.VillagerName} has no bed ({Beds.NoBedReason(villager)}).");
                    }

                    return SleepUnderRoof(villager, ai, dt, state);
                }

                state.GiveUpAt = Time.time + 90f;
                Walker.For(villager).Reset();
                VillheimPlugin.Debug($"Bedtime: {villager.VillagerName} walks to {VillagerLooks.His(villager)} bed, {Utils.DistanceXZ(villager.transform.position, state.Bed.transform.position):0} m away.");
            }

            Transform point = state.Bed.m_spawnPoint != null ? state.Bed.m_spawnPoint : state.Bed.transform;
            if (!state.Asleep)
            {
                // Off a chair first: getting up from a seat later in the tick would pull him out of bed again.
                Seats.StandUp(villager);
                float distance = Utils.DistanceXZ(villager.transform.position, point.position);
                if (EnvMan.instance.IsTimeSkipping())
                {
                    // A player is sleeping the night away: the villager had all those hours to get to bed.
                    VillheimPlugin.Debug($"Bedtime: {villager.VillagerName} is put in {VillagerLooks.His(villager)} bed while the night is skipped.");
                    PutInBed(villager, point);
                }
                else if (distance > 2.5f)
                {
                    // Close enough to lie down: the bed itself is in the way of the last step, and pushing into it
                    // only made him hop and sidestep about.
                    WalkResult step = Walker.For(villager).Go(villager, ai, dt, point.position, 1f);
                    if (step == WalkResult.Walking && Time.time < state.GiveUpAt)
                    {
                        return true;
                    }

                    distance = Utils.DistanceXZ(villager.transform.position, point.position);
                    if (distance > 4f)
                    {
                        state.Failures++;
                        Plot plot = Beds.PlotAt(VillageHearth.Find(villager.VillageId), point.position);
                        VillheimPlugin.Log.LogInfo($"Bedtime: {villager.VillagerName} can't get to {VillagerLooks.His(villager)} bed in the {plot?.Design ?? "open"} " +
                                                   $"({step}, {distance:0.0} m short, try {state.Failures}).");
                        // D-076: stuck on the way, he is put in his bed at bedtime even with a player near, after a
                        // third try (Ivo stood 33 m short of his bed night after night, 2026-11-09).
                        if (state.Failures < 2 || (state.Failures < 3 && PlayerNear(villager.transform.position, point.position)))
                        {
                            // Back to the fire for a moment, then he tries again.
                            state.Bed = null;
                            state.GiveUpAt = float.MaxValue;
                            return false;
                        }

                        // Tried twice with nobody about to see, or three times: he got there in the end.
                        PutInBed(villager, point);
                    }
                }

                state.Asleep = true;
                VillheimPlugin.Debug($"{villager.VillagerName} goes to sleep.");
            }

            // Lie in the bed: held at the bed's own resting point, as the game does for a player.
            ai.StopMoving();
            if (villager.GetRightItem() != null)
            {
                HandItems.PutAway(villager);
            }

            // Held in place every physics step, like the game's own attach (see Body.PinTo).
            Body.PinTo(villager, point, state.Bed != null ? state.Bed.gameObject : null);
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

            // Each villager his own spot under the roof. Villagers pass through each other (so they never jam in a
            // doorway), so sent to the same point they stood exactly inside one another (seen 2026-11-06).
            int index = Roles.IndexOf(villager);
            Vector3 spot = shelter.Value + Quaternion.Euler(0f, index * 137.5f, 0f) * Vector3.forward * (1f + 0.5f * (index % 3));
            WalkResult step = Walker.For(villager).Go(villager, ai, dt, spot, 0.6f);
            if (step == WalkResult.Walking && Time.time < state.GiveUpAt)
            {
                return true;
            }

            if (Utils.DistanceXZ(villager.transform.position, spot) > 5f)
            {
                state.GiveUpAt = float.MaxValue;
                return false;
            }

            ai.StopMoving();
            Poses.Hold(villager, Poses.Rest);
            return true;
        }

        /// <summary>Straight to the bed's resting point, for when the walk can't be seen (a skipped night, nobody near).</summary>
        private static void PutInBed(Villager villager, Transform point)
        {
            Walker.For(villager).Reset();
            villager.transform.position = point.position;
            if (villager.m_body != null)
            {
                villager.m_body.position = point.position;
                villager.m_body.velocity = Vector3.zero;
            }
        }

        private static bool PlayerNear(Vector3 a, Vector3 b)
        {
            foreach (Player player in Player.GetAllPlayers())
            {
                if (player != null && (Vector3.Distance(player.transform.position, a) < 30f || Vector3.Distance(player.transform.position, b) < 30f))
                {
                    return true;
                }
            }

            return false;
        }

        /// <summary>Gets out of bed (morning, or an enemy close by).</summary>
        public static void Wake(Villager villager)
        {
            if (!States.TryGetValue(villager, out State state) || !state.Asleep)
            {
                return;
            }

            state.Asleep = false;
            Body.Unpin(villager);
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
