using System.Collections.Generic;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// What villagers make for the village besides its buildings, in the order a player settling in would:
    ///
    /// 1. Essentials (settling in): the cooking station over the hearth, beds in every home, a workbench under a roof,
    ///    then the village sign and the notice board by the hearth. The village builds nothing new until these stand
    ///    (see VillageBrain), and gathers what they cost (see VillageNeeds).
    /// 2. Comfort, once the essentials stand: chests, chairs and tables in the homes, benches round the fire, a wood
    ///    stack and a stone pile by the hearth.
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
        }

        private sealed class Entry
        {
            public string Prefab;
            public string Name;
            public int Slot;
            public float Radius = Ring;
            public int MinBuildings;
            public bool Essential;
        }

        private const float Ring = 5.5f;
        private const float RingFar = 7f;

        private const float OuterRing = 8.5f;

        // Outside the buildings, in the order they are made.
        private static readonly Entry[] Entries =
        {
            // Slot -1 is the hearth itself: the cooking station goes over the village fire.
            new Entry { Prefab = "piece_cookingstation", Name = "cooking station", Slot = -1, MinBuildings = 0, Essential = true },
            new Entry { Prefab = "sign", Name = "village sign", Slot = 0, MinBuildings = 1, Essential = true },
            new Entry { Prefab = "sign", Name = "notice board", Slot = 3, MinBuildings = 1, Essential = true },
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
        public static Job Due(VillageHearth hearth)
        {
            Job next = Upcoming(hearth);
            if (next == null)
            {
                return null;
            }

            var state = new VillageState(hearth.Zdo);
            return Affordable(hearth, state, next.Cost, ConstructionSite.Remaining(hearth)) ? next : null;
        }

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

            if (Time.time - since > (float)VillageBrain.DayLength())
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

            // Essentials first: the cooking station, then beds and workbenches, then the sign and the notice board.
            return Outside(hearth, state, true, onlyHearth: true) ?? Inside(state, tier, true) ?? Outside(hearth, state, true, onlyHearth: false) ??
                   Inside(state, tier, false) ?? Outside(hearth, state, false, onlyHearth: false);
        }

        private static Job Outside(VillageHearth hearth, VillageState state, bool essential, bool onlyHearth)
        {
            foreach (Entry entry in Entries)
            {
                if (entry.Essential != essential || (entry.Slot < 0) != onlyHearth || state.Plots.Count < entry.MinBuildings)
                {
                    continue;
                }

                GameObject prefab = ZNetScene.instance ? ZNetScene.instance.GetPrefab(entry.Prefab) : null;
                if (prefab == null || !Buildable(prefab, state.Biome, out Dictionary<string, int> cost, true))
                {
                    continue;
                }

                Vector3 spot = hearth.transform.position;
                if (entry.Slot >= 0 && !SlotSpot(hearth, state, entry.Slot, entry.Radius, out spot))
                {
                    continue;
                }

                if (Made(hearth.VillageId, entry.Prefab, spot))
                {
                    continue;
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
            var state = new VillageState(hearth.Zdo);
            Forget(hearth.VillageId);
            if (Made(hearth.VillageId, job.Prefab, job.Spot) || !Affordable(hearth, state, job.Cost, ConstructionSite.Remaining(hearth)))
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
        /// The slot's spot on the ring around the hearth (the diagonals of the village axis), or a little further
        /// out if that is taken; on the outer ring, only there. False when none is usable.
        /// </summary>
        private static bool SlotSpot(VillageHearth hearth, VillageState state, int slot, float ring, out Vector3 spot)
        {
            Vector3 center = hearth.transform.position;
            Quaternion turn = Quaternion.Euler(0f, state.Axis + 45f + 90f * slot, 0f);
            foreach (float radius in ring > Ring ? new[] { ring } : new[] { Ring, RingFar })
            {
                spot = center + turn * Vector3.forward * radius;
                if (Usable(hearth, state, spot, out float y))
                {
                    spot.y = y;
                    return true;
                }
            }

            spot = center;
            return false;
        }

        private static bool Usable(VillageHearth hearth, VillageState state, Vector3 spot, out float y)
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

            // No one else's piece in the way (our own made pieces are what Made() looks for).
            foreach (Collider collider in Physics.OverlapSphere(spot, 1f))
            {
                Piece piece = collider.GetComponentInParent<Piece>();
                if (piece != null && piece.GetComponent<VillageHearth>() == null &&
                    (piece.m_nview == null || !piece.m_nview.IsValid() || piece.m_nview.GetZDO().GetInt(Keys.BuiltBy) != hearth.VillageId))
                {
                    return false;
                }
            }

            return true;
        }
    }
}
