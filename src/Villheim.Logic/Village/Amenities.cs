using System.Collections.Generic;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Small things villagers make around the hearth in their free time, from vanilla pieces: a fire pit with a
    /// cooking station over it, a workbench, benches. Whoever has no building or gathering to do makes them, one at a
    /// time per village, as the village grows.
    ///
    /// Rules:
    /// - Each piece has a slot on a ring 5.5 m around the hearth, on the diagonals of the village axis, clear of the
    ///   chest, the hub and the paths. A slot that is blocked (a building, a steep spot, water) is skipped.
    /// - Only pieces whose whole vanilla recipe is made of materials the village tracks and its biome has.
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
        }

        private sealed class Entry
        {
            public string Prefab;
            public string Name;
            public int Slot;
            public int MinBuildings;
            public string On;
        }

        private const float Ring = 5.5f;
        private const float RingFar = 7f;

        // In the order they are made. "On" puts a piece on top of another one in the same slot.
        private static readonly Entry[] Entries =
        {
            new Entry { Prefab = "fire_pit", Name = "fire pit", Slot = 0, MinBuildings = 0 },
            new Entry { Prefab = "piece_cookingstation", Name = "cooking station", Slot = 0, MinBuildings = 0, On = "fire_pit" },
            new Entry { Prefab = "piece_workbench", Name = "workbench", Slot = 1, MinBuildings = 1 },
            new Entry { Prefab = "piece_bench01", Name = "bench", Slot = 2, MinBuildings = 1 },
            new Entry { Prefab = "piece_bench01", Name = "bench", Slot = 3, MinBuildings = 2 },
        };

        private static readonly Dictionary<int, (float Time, Job Job)> Cache = new Dictionary<int, (float, Job)>();

        /// <summary>The next thing the village should make, or null. Worked out at most every 10 seconds.</summary>
        public static Job Due(VillageHearth hearth)
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

        public static void Forget(int villageId) => Cache.Remove(villageId);

        private static Job Find(VillageHearth hearth)
        {
            var state = new VillageState(hearth.Zdo);
            Dictionary<string, int> building = ConstructionSite.Remaining(hearth);
            foreach (Entry entry in Entries)
            {
                if (state.Plots.Count < entry.MinBuildings)
                {
                    continue;
                }

                GameObject prefab = ZNetScene.instance ? ZNetScene.instance.GetPrefab(entry.Prefab) : null;
                if (prefab == null || !Buildable(prefab, state.Biome, out Dictionary<string, int> cost))
                {
                    continue;
                }

                if (!SlotSpot(hearth, state, entry.Slot, out Vector3 spot))
                {
                    continue;
                }

                if (Made(hearth.VillageId, entry.Prefab, spot))
                {
                    continue;
                }

                if (entry.On != null && !Made(hearth.VillageId, entry.On, spot))
                {
                    continue;
                }

                if (!Affordable(hearth, state, cost, building))
                {
                    // Made in order: wait for this one rather than skip ahead to something cheaper.
                    return null;
                }

                Vector3 toHearth = hearth.transform.position - spot;
                toHearth.y = 0f;
                return new Job
                {
                    Prefab = entry.Prefab,
                    Name = entry.Name,
                    Spot = spot,
                    Rotation = toHearth.sqrMagnitude > 0.01f ? Quaternion.LookRotation(toHearth) : Quaternion.identity,
                    Cost = cost,
                };
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

            VillheimPlugin.Log.LogInfo($"{state.Name} made a {job.Name} by the hearth.");
            return true;
        }

        /// <summary>Every ingredient is a material the village tracks and its biome has.</summary>
        private static bool Buildable(GameObject prefab, Heightmap.Biome biome, out Dictionary<string, int> cost)
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
        private static bool Affordable(VillageHearth hearth, VillageState state, Dictionary<string, int> cost,
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
        /// out if that is taken. False when neither is usable.
        /// </summary>
        private static bool SlotSpot(VillageHearth hearth, VillageState state, int slot, out Vector3 spot)
        {
            Vector3 center = hearth.transform.position;
            Quaternion turn = Quaternion.Euler(0f, state.Axis + 45f + 90f * slot, 0f);
            foreach (float radius in new[] { Ring, RingFar })
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
