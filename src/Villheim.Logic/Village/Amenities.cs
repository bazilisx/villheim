using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// What villagers make for the village besides its buildings, in the order a player settling in would:
    ///
    /// 1. Essentials: the cooking station over the hearth and the beds in every home. The village builds nothing new
    ///    until these stand (see VillageBrain), and gathers what they cost (see VillageNeeds).
    ///    The notice board (Tyler's 'villagenotice' blueprint, over the village chest) comes right after the cooking
    ///    station, and is mended first whenever a piece of it is destroyed (see NoticeBoard).
    /// 2. The hub area, once the longhouse stands: benches round the fire, a wood stack and a stone pile.
    /// 2b. Storage chests by the main chest as the village grows, each with its label (StorageChests, D-016).
    /// 3. Furnishings: the workshop's workbench, the storehouse's chests, chests, chairs and tables in the homes and
    ///    the longhouse.
    ///
    /// Rules:
    /// - Pieces outside go on a ring 5.5 m round the hearth (7 m when that is taken), on the diagonals of the village
    ///   axis, clear of the chest, the buildings and the paths; the stacks go on an outer ring at 8.5 m.
    /// - Only pieces whose vanilla recipe is made of materials the village tracks and its biome has. A small amount
    ///   of something the village doesn't gather (the sign's coal) is let off.
    /// - Paid from what the village chest can spare: never from what the building going up still needs.
    /// - A made piece that gets destroyed is made again.
    /// </summary>
    internal static class Amenities
    {
        internal sealed class Job
        {
            public string Prefab;
            public string Name;
            public Vector3 Spot;
            public Quaternion Rotation;
            public Dictionary<string, int> Cost;

            /// <summary>Goes inside a building (a bed, a workbench) rather than out by the hearth.</summary>
            public bool Inside;

            /// <summary>Part of settling in: made before the village grows.</summary>
            public bool Essential;

            /// <summary>A storage chest or its label (D-016): what the chest holds. Null for anything else.</summary>
            public string Kind;

            /// <summary>
            /// For something made of several pieces (the notice board): what all its missing pieces cost. Cost is the
            /// next piece only, paid when it goes up. Null for a single piece.
            /// </summary>
            public Dictionary<string, int> Total;

            /// <summary>Pieces still to go up (1 for a single piece).</summary>
            public int Pieces = 1;

            /// <summary>Something of several pieces with some of them already standing: finished before anything new.</summary>
            public bool Started;
        }

        private sealed class Entry
        {
            public string Prefab;
            public string Name;
            public int Slot;
            public float Radius = Ring;
            public int MinBuildings;
            public bool Essential;

            /// <summary>Part of the central hub area: only once the longhouse stands.</summary>
            public bool NeedsHub;
        }

        private const float Ring = 5.5f;
        private const float RingFar = 7f;

        private const float OuterRing = 8.5f;

        // Outside the buildings, in the order they are made.
        private static readonly Entry[] Entries =
        {
            // Slot -1 is the hearth itself: the cooking station goes over the village fire.
            new Entry { Prefab = "piece_cookingstation", Name = "cooking station", Slot = -1, MinBuildings = 0, Essential = true },
            new Entry { Prefab = "piece_bench01", Name = "bench", Slot = 2, MinBuildings = 1 },
            new Entry { Prefab = "piece_bench01", Name = "bench", Slot = 1, MinBuildings = 2 },
            new Entry { Prefab = "wood_stack", Name = "wood stack", Slot = 2, Radius = OuterRing, MinBuildings = 2 },
            new Entry { Prefab = "stone_pile", Name = "stone pile", Slot = 3, Radius = OuterRing, MinBuildings = 3 },
        };

        private static readonly Dictionary<int, (float Time, Job Job)> Cache = new Dictionary<int, (float, Job)>();

        /// <summary>
        /// The next thing the village should make, or null: the first thing still missing, once the chest can spare
        /// what it costs. Made in order: the village waits for this one rather than skip ahead to something cheaper.
        /// </summary>
        public static Job Due(VillageHearth hearth) => Due(hearth, false);

        /// <summary>
        /// As Due. Something of several pieces (the notice board) is only started once the chest holds half (BuildStartShare)
        /// of what the rest of it costs in its main material, so the builder doesn't walk over for each piece's wood
        /// (Tyler, T-11, D-048). <paramref name="continuing"/>: the builder is already at it, and goes
        /// on while the next piece is paid for.
        /// </summary>
        public static Job Due(VillageHearth hearth, bool continuing)
        {
            Job next = Upcoming(hearth);
            if (next == null)
            {
                return null;
            }

            var state = new VillageState(hearth.Zdo);
            Dictionary<string, int> reserved = Reserved(hearth, next);
            if (!Affordable(hearth, state, next.Cost, reserved))
            {
                return null;
            }

            return continuing || next.Total == null || Affordable(hearth, state, StartCost(next), reserved) ? next : null;
        }

        /// <summary>
        /// What must be in the chest before a job of several pieces is started (see Due): BuildStartShare (half by
        /// default, D-048) of what the rest of it costs in its main material, and the next piece.
        /// </summary>
        public static Dictionary<string, int> StartCost(Job job)
        {
            if (job.Total == null || job.Total.Count == 0)
            {
                return job.Cost;
            }

            float share = LogicConfig.BuildStartShare != null ? Mathf.Clamp01(LogicConfig.BuildStartShare.Value) : 0.5f;
            var start = new Dictionary<string, int>(job.Cost);
            KeyValuePair<string, int> main = job.Total.OrderByDescending(t => t.Value).First();
            start.TryGetValue(main.Key, out int already);
            start[main.Key] = Mathf.Max(already, Mathf.CeilToInt(main.Value * share));
            return start;
        }

        /// <summary>
        /// What the job may not touch: the building going up keeps its materials, except from essentials (beds, the
        /// notice board, the cooking station), which are cheap and come first. A long build had kept the notice board
        /// waiting on wood the site had set aside.
        /// </summary>
        private static Dictionary<string, int> Reserved(VillageHearth hearth, Job job) =>
            job.Essential ? new Dictionary<string, int>() : ConstructionSite.Remaining(hearth);

        /// <summary>The first thing still missing, affordable or not (what gatherers work toward). Every 10 seconds.</summary>
        public static Job Upcoming(VillageHearth hearth)
        {
            if (hearth == null || !hearth.IsValid || VillageChest.IsLost(hearth))
            {
                return null;
            }

            int id = hearth.VillageId;
            if (Cache.TryGetValue(id, out var cached) && Time.time - cached.Time < 10f)
            {
                return cached.Job;
            }

            Job job = Find(hearth);
            Cache[id] = (Time.time, job);
            return job;
        }

        private static readonly Dictionary<string, float> PendingSince = new Dictionary<string, float>();

        /// <summary>
        /// The village has settled in: nothing essential is missing. One essential that has been pending for a whole
        /// in-game day (no way to reach its spot, say) stops holding the village back, so it can't stall for good.
        /// </summary>
        public static bool Settled(VillageHearth hearth, out string missing)
        {
            missing = null;
            Job next = Upcoming(hearth);
            if (next == null || !next.Essential)
            {
                return true;
            }

            string key = $"{hearth.VillageId}:{next.Prefab}:{Mathf.RoundToInt(next.Spot.x)}:{Mathf.RoundToInt(next.Spot.z)}";
            if (!PendingSince.TryGetValue(key, out float since))
            {
                PendingSince[key] = since = Time.time;
            }

            // Something half made (the notice board) is finished first, however long it takes (T-37).
            if (Time.time - since > (float)VillageBrain.DayLength() && !next.Started)
            {
                if (since > 0f)
                {
                    VillheimPlugin.Log.LogInfo($"{hearth.VillageName}: the {next.Name} has waited a day; building goes on without it.");
                    PendingSince[key] = -1f;
                }

                return true;
            }

            missing = next.Name;
            return false;
        }

        public static void Forget(int villageId) => Cache.Remove(villageId);

        private static Job Find(VillageHearth hearth)
        {
            var state = new VillageState(hearth.Zdo);
            int tier = VillageBrain.TierIndex(state.Plots.Count);

            // Needs first, like a player settling in (T-54): the cooking station over the fire, the beds in the homes (T-39:
            // a board stuck ahead of them had kept every bed from being made), the notice board, a storage chest when the
            // main one is full (T-42), then the rest. The map table comes last: its recipe has fine wood, which not every
            // biome gives. A job that keeps falling down (IsStuck) is passed over for a day, so it can't hold up the rest.
            var steps = new System.Func<Job>[]
            {
                () => Outside(hearth, state, true, onlyHearth: true),
                () => Inside(state, tier, true),
                () => NoticeBoard.Job(hearth),
                () => StorageChests.Urgent(hearth) ? StorageChests.Job(hearth, state) : null,
                () => StorageChests.Job(hearth, state),
                () => Outside(hearth, state, false, onlyHearth: false),
                () => Inside(state, tier, false),
                () => Demisters.Job(hearth, state),
                () => MapTables.Job(hearth, state),
            };

            for (int i = 0; i < steps.Length; i++)
            {
                Job job = steps[i]();
                if (job == null || IsStuck(hearth, job))
                {
                    continue;
                }

                if (i == 3)
                {
                    job.Essential = true; // the full chest can't wait for the building going up
                }

                return job;
            }

            return null;
        }

        // ---------------------------------------------------------------- pieces that keep falling

        private static readonly Dictionary<string, (int Count, double Since)> Remakes = new Dictionary<string, (int, double)>();

        private static string RemakeKey(VillageHearth hearth, Job job) =>
            $"{hearth.VillageId}:{job.Prefab}:{Mathf.RoundToInt(job.Spot.x * 2f)}:{Mathf.RoundToInt(job.Spot.y * 2f)}:{Mathf.RoundToInt(job.Spot.z * 2f)}";

        /// <summary>A piece was made: counted, so one that falls and is made again and again is noticed (T-43).</summary>
        private static void NoteMade(VillageHearth hearth, Job job)
        {
            string key = RemakeKey(hearth, job);
            double now = ZNet.instance != null ? ZNet.instance.GetTimeSeconds() : Time.time;
            Remakes[key] = Remakes.TryGetValue(key, out var seen) && now - seen.Since < VillageBrain.DayLength()
                ? (seen.Count + 1, seen.Since)
                : (1, now);
            if (Remakes[key].Count == 3)
            {
                VillheimPlugin.Log.LogWarning($"{hearth.VillageName}: the {job.Name} at {job.Spot} fell and was made again three times " +
                                              "today; it is left alone until tomorrow.");
            }
        }

        /// <summary>Made three times in a game day and gone again: left alone until the day is out.</summary>
        public static bool IsStuck(VillageHearth hearth, Job job)
        {
            if (!Remakes.TryGetValue(RemakeKey(hearth, job), out var seen))
            {
                return false;
            }

            double now = ZNet.instance != null ? ZNet.instance.GetTimeSeconds() : Time.time;
            return seen.Count >= 3 && now - seen.Since < VillageBrain.DayLength();
        }

        /// <summary>
        /// Decor copied from locations (DecorProps, Props): the first on the outer ring once three buildings stand, the
        /// next once five do, and so on.
        /// </summary>
        private static IEnumerable<Entry> Decor()
        {
            int i = 0;
            foreach (string spec in Props.DecorSpecs())
            {
                string prefab = Props.Get(spec, false);
                if (prefab != null)
                {
                    yield return new Entry { Prefab = prefab, Name = "tent", Slot = i % 2 == 0 ? 0 : 1, Radius = OuterRing + 3f * (i / 2), MinBuildings = 3 + 2 * i };
                    i++;
                }
            }
        }

        private static Job Outside(VillageHearth hearth, VillageState state, bool essential, bool onlyHearth)
        {
            foreach (Entry entry in essential ? Entries : Entries.Concat(Decor()))
            {
                if (entry.Essential != essential || (entry.Slot < 0) != onlyHearth || state.Plots.Count < entry.MinBuildings ||
                    (entry.NeedsHub && !state.Plots.Any(p => p.Role == nameof(Designs.Role.Hub))))
                {
                    continue;
                }

                GameObject prefab = ZNetScene.instance ? ZNetScene.instance.GetPrefab(entry.Prefab) : null;
                if (prefab == null || !Buildable(prefab, state.Biome, out Dictionary<string, int> cost, true))
                {
                    continue;
                }

                Vector3 spot = hearth.transform.position;
                if (entry.Slot < 0 ? Made(hearth.VillageId, entry.Prefab, spot) : !SlotSpot(hearth, state, entry, out spot))
                {
                    continue; // made already, or no room for it
                }

                Vector3 toHearth = hearth.transform.position - spot;
                toHearth.y = 0f;
                Quaternion along = Quaternion.Euler(0f, state.Axis, 0f);
                return new Job
                {
                    Prefab = entry.Prefab,
                    Name = entry.Name,
                    Spot = spot,
                    Rotation = toHearth.sqrMagnitude > 0.01f ? Quaternion.LookRotation(toHearth) : along,
                    Cost = cost,
                    Essential = entry.Essential,
                };
            }

            return null;
        }

        /// <summary>The next piece a finished building is missing, at a covered spot inside it.</summary>
        private static Job Inside(VillageState state, int tier, bool essential)
        {
            foreach (Plot plot in state.Plots)
            {
                foreach (Interior.Want want in Interior.WantsFor(plot, tier))
                {
                    if (want.Essential != essential || Interior.CountInside(plot, want.Prefab) >= want.Count)
                    {
                        continue;
                    }

                    GameObject prefab = ZNetScene.instance ? ZNetScene.instance.GetPrefab(want.Prefab) : null;
                    if (prefab == null || !Buildable(prefab, state.Biome, out Dictionary<string, int> cost, true) ||
                        !Interior.FindSpot(plot, prefab, want.Prefab, out Vector3 spot, out Quaternion rotation))
                    {
                        continue;
                    }

                    return new Job
                    {
                        Prefab = want.Prefab, Name = want.Name, Spot = spot, Rotation = rotation, Cost = cost, Inside = true,
                        Essential = want.Essential,
                    };
                }
            }

            return null;
        }

        /// <summary>Pays for the job and puts the piece down. False when the materials or the spot are gone.</summary>
        public static bool Make(VillageHearth hearth, Job job)
        {
            bool made = MakeOnce(hearth, job);
            if (made)
            {
                NoteMade(hearth, job);
            }

            return made;
        }

        private static bool MakeOnce(VillageHearth hearth, Job job)
        {
            var state = new VillageState(hearth.Zdo);
            Forget(hearth.VillageId);
            if (job.Prefab == NoticeBoard.BlueprintName)
            {
                // One piece of the board, ground up (no instant buildings).
                Job now = NoticeBoard.Job(hearth);
                if (now == null || Utils.DistanceXZ(now.Spot, job.Spot) > 0.3f || Mathf.Abs(now.Spot.y - job.Spot.y) > 0.3f ||
                    !Affordable(hearth, state, now.Cost, Reserved(hearth, now)) || !Pay(hearth, state, now.Cost))
                {
                    return false;
                }

                bool built = NoticeBoard.BuildNext(hearth);
                if (built && now.Pieces <= 1)
                {
                    VillheimPlugin.Log.LogInfo($"{state.Name} finished its notice board.");
                    Chronicle.Add(hearth, "The notice board by the chest was finished.");
                }

                return built;
            }

            if (job.Kind != null)
            {
                // A storage chest or its label: the spot was checked when the job was worked out.
                return Affordable(hearth, state, job.Cost, Reserved(hearth, job)) && Pay(hearth, state, job.Cost) &&
                       StorageChests.Make(hearth, state, job);
            }

            if (Made(hearth.VillageId, job.Prefab, job.Spot) || !Affordable(hearth, state, job.Cost, Reserved(hearth, job)))
            {
                return false;
            }

            GameObject prefab = ZNetScene.instance ? ZNetScene.instance.GetPrefab(job.Prefab) : null;
            if (prefab == null || !Pay(hearth, state, job.Cost))
            {
                return false;
            }

            GameObject made = Object.Instantiate(prefab, job.Spot, job.Rotation);
            ZNetView view = made.GetComponent<ZNetView>();
            if (view != null && view.GetZDO() != null)
            {
                view.GetZDO().Set(Keys.BuiltBy, hearth.VillageId);
                if (made.TryGetComponent(out Sign sign))
                {
                    // Millenaire puts the village's name on a sign post, and its projects on panels.
                    if (job.Name == "notice board")
                    {
                        view.GetZDO().Set(NoticeBoard.Key, 1);
                        NoticeBoard.Update(hearth, true);
                    }
                    else
                    {
                        sign.SetText(state.Name);
                    }
                }

                if (made.TryGetComponent(out Fireplace fire))
                {
                    // A new fire is laid with a full load of wood.
                    view.GetZDO().Set(ZDOVars.s_fuel, fire.m_maxFuel);
                }

                if (job.Name == MapTables.JobName)
                {
                    MapTables.Made(hearth, view, job.Spot);
                }
            }

            if (made.TryGetComponent(out Piece piece))
            {
                piece.m_placeEffect?.Create(job.Spot, job.Rotation, made.transform);
            }

            VillheimPlugin.Log.LogInfo($"{state.Name} made a {job.Name} {(job.Inside ? "inside a building" : "by the hearth")}.");
            Villagers.Beds.Forget(hearth.VillageId);
            return true;
        }

        /// <summary>
        /// Every ingredient is a material the village tracks and its biome has. With <paramref name="letOffSmall"/>, an
        /// ingredient the village doesn't gather is let off when only one or two are needed (the coal for a sign).
        /// </summary>
        public static bool Buildable(GameObject prefab, Heightmap.Biome biome, out Dictionary<string, int> cost, bool letOffSmall = false)
        {
            cost = new Dictionary<string, int>();
            Piece piece = prefab.GetComponent<Piece>();
            if (piece?.m_resources == null)
            {
                return false;
            }

            var allowed = new HashSet<string>(Materials.AllowedIn(biome));
            foreach (Piece.Requirement requirement in piece.m_resources)
            {
                if (requirement?.m_resItem == null || requirement.m_amount <= 0)
                {
                    continue;
                }

                string material = requirement.m_resItem.gameObject.name;
                if (letOffSmall && !Materials.Tracked.Contains(material) && requirement.m_amount <= 2)
                {
                    continue;
                }

                if (!Materials.Tracked.Contains(material) || !allowed.Contains(material))
                {
                    return false;
                }

                cost.TryGetValue(material, out int amount);
                cost[material] = amount + requirement.m_amount;
            }

            return true;
        }

        /// <summary>The village can spare it: what it has, less what the building going up still needs.</summary>
        public static bool Affordable(VillageHearth hearth, VillageState state, Dictionary<string, int> cost,
            Dictionary<string, int> building)
        {
            foreach (KeyValuePair<string, int> need in cost)
            {
                building.TryGetValue(need.Key, out int reserved);
                if (VillageChest.Have(hearth, state, need.Key) - reserved < need.Value)
                {
                    return false;
                }
            }

            return true;
        }

        /// <summary>Takes the cost from the village chest, topping up from the saved-up stock.</summary>
        private static bool Pay(VillageHearth hearth, VillageState state, Dictionary<string, int> cost)
        {
            Container chest = VillageChest.Find(hearth);
            var fromChest = new Dictionary<string, int>();
            var fromStock = new Dictionary<string, int>();
            foreach (KeyValuePair<string, int> need in cost)
            {
                int inChest = chest != null && VillageChest.Usable(chest) ? VillageChest.Count(chest, need.Key) : 0;
                int take = Mathf.Min(inChest, need.Value);
                fromChest[need.Key] = take;
                fromStock[need.Key] = need.Value - take;
                if (state.Get(need.Key) < fromStock[need.Key])
                {
                    return false;
                }
            }

            if (chest != null && !VillageChest.Take(chest, fromChest))
            {
                return false;
            }

            foreach (KeyValuePair<string, int> need in fromStock)
            {
                if (need.Value > 0)
                {
                    state.Add(need.Key, -need.Value);
                }
            }

            return true;
        }

        /// <summary>A piece of that kind, made by this village, stands at the spot.</summary>
        private static bool Made(int villageId, string prefabName, Vector3 spot)
        {
            foreach (Collider collider in Physics.OverlapSphere(spot, 1.2f))
            {
                ZNetView view = collider.GetComponentInParent<ZNetView>();
                if (view != null && view.IsValid() && Utils.GetPrefabName(view.gameObject) == prefabName &&
                    view.GetZDO().GetInt(Keys.BuiltBy) == villageId)
                {
                    return true;
                }
            }

            return false;
        }

        /// <summary>
        /// The free spot for the entry on the ring around the hearth (the diagonals of the village axis), or a little
        /// further out if that is taken; on the outer ring, only there. False when it is made already at one of them (it
        /// is found there first) or none is free: nothing goes into anything else (T-43, chests into a bench).
        /// </summary>
        private static bool SlotSpot(VillageHearth hearth, VillageState state, Entry entry, out Vector3 spot)
        {
            Vector3 center = hearth.transform.position;
            Quaternion turn = Quaternion.Euler(0f, state.Axis + 45f + 90f * entry.Slot, 0f);
            float[] radii = entry.Radius > Ring ? new[] { entry.Radius } : new[] { Ring, RingFar };
            foreach (float radius in radii)
            {
                Vector3 at = center + turn * Vector3.forward * radius;
                if (ZoneSystem.instance.GetGroundHeight(at, out float ground) && Made(hearth.VillageId, entry.Prefab, new Vector3(at.x, ground, at.z)))
                {
                    spot = at;
                    return false;
                }
            }

            foreach (float radius in radii)
            {
                spot = center + turn * Vector3.forward * radius;
                Vector3 toHearth = (center - spot).Horizontal();
                Quaternion facing = toHearth.sqrMagnitude > 0.01f ? Quaternion.LookRotation(toHearth) : Quaternion.identity;
                if (Usable(hearth, state, spot, out float y) && Fits(entry.Prefab, new Vector3(spot.x, y, spot.z), facing))
                {
                    spot.y = y;
                    return true;
                }
            }

            spot = center;
            return false;
        }

        /// <summary>
        /// Nothing stands where the piece would (its measured box and a hand's width round it): no piece of the village
        /// or anyone else's, no tree or rock. The ground, people and things lying about don't count.
        /// </summary>
        public static bool Fits(string prefabName, Vector3 spot, Quaternion rotation)
        {
            GameObject prefab = ZNetScene.instance ? ZNetScene.instance.GetPrefab(prefabName) : null;
            Bounds? bounds = prefab != null
                ? Designs.BuildOrder.Measure(prefab, prefabName, Vector3.zero, Quaternion.identity, prefab.transform.localScale)
                : null;
            if (!bounds.HasValue)
            {
                return true;
            }

            Bounds box = bounds.Value;
            Vector3 middle = spot + rotation * box.center + Vector3.up * 0.05f;
            Vector3 half = box.extents + new Vector3(0.15f, -0.05f, 0.15f);
            foreach (Collider collider in Physics.OverlapBox(middle, half, rotation, ~0, QueryTriggerInteraction.Ignore))
            {
                if (collider.GetComponentInParent<Heightmap>() != null || collider.GetComponentInParent<Character>() != null ||
                    collider.GetComponentInParent<ItemDrop>() != null)
                {
                    continue;
                }

                if (collider.GetComponentInParent<ZNetView>() != null)
                {
                    return false;
                }
            }

            return true;
        }

        internal static bool Usable(VillageHearth hearth, VillageState state, Vector3 spot, out float y, bool ownBlock = true)
        {
            if (!ZoneSystem.instance.IsZoneLoaded(spot) || !ZoneSystem.instance.GetGroundHeight(spot, out y) ||
                y < ZoneSystem.instance.m_waterLevel + 0.3f)
            {
                y = 0f;
                return false;
            }

            // Flat enough: the ground a metre around stays within half a metre.
            for (int i = 0; i < 4; i++)
            {
                Vector3 probe = spot + Quaternion.Euler(0f, i * 90f, 0f) * Vector3.forward;
                if (ZoneSystem.instance.GetGroundHeight(probe, out float h) && Mathf.Abs(h - y) > 0.5f)
                {
                    return false;
                }
            }

            foreach (Plot plot in state.Plots)
            {
                if (Utils.DistanceXZ(spot, plot.Position) < plot.Radius * 0.6f + 1f)
                {
                    return false;
                }
            }

            if (ConstructionSite.IsActive(hearth.Zdo) && ConstructionSite.InsideFootprint(hearth, spot))
            {
                return false;
            }

            // No piece in the way, the village's own included (a made piece is found by Made() before this is asked).
            foreach (Collider collider in Physics.OverlapSphere(spot, 1f))
            {
                Piece piece = collider.GetComponentInParent<Piece>();
                if (piece != null && piece.GetComponent<VillageHearth>() == null &&
                    (ownBlock || piece.m_nview == null || !piece.m_nview.IsValid() || piece.m_nview.GetZDO().GetInt(Keys.BuiltBy) != hearth.VillageId))
                {
                    return false;
                }
            }

            return true;
        }
    }
}
