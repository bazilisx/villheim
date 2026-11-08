using System.Collections.Generic;
using System.Globalization;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// The big Dvergr demisters round a Mistlands village (Tyler, T-26): "a few around nearby so it still seems like
    /// the demisters are doing the work". The clear air itself comes from Demisting; these are what the eye sees.
    ///
    /// - MistlandsDemisters of them (3 by default), MistlandsDemisterPrefab (the game's dverger_demister_large),
    ///   spread evenly round the village edge, a few metres inside the fence ring, turned off the village axis so they
    ///   stand between the roads.
    /// - Each is an amenity job (Amenities): the builder goes over, hammers, and it goes up, paid from the chest with
    ///   MistlandsDemisterCost (the prefab has no recipe of its own). One that is destroyed is made again.
    /// - Where each one goes is worked out once and kept on the hearth, so a growing ring doesn't move them. A spot on
    ///   water, a building, a path or steep ground moves a little round the ring.
    /// - Only in Mistlands villages.
    /// </summary>
    internal static class Demisters
    {
        public const string JobName = "demister";

        private static string Prefab => string.IsNullOrWhiteSpace(LogicConfig.MistlandsDemisterPrefab?.Value)
            ? "dverger_demister_large"
            : LogicConfig.MistlandsDemisterPrefab.Value.Trim();

        private static int Key(int index) => ("villheim_demister_" + index).GetStableHashCode();

        public static Amenities.Job Job(VillageHearth hearth, VillageState state)
        {
            int count = LogicConfig.MistlandsDemisters != null ? LogicConfig.MistlandsDemisters.Value : 3;
            if (state.Biome != Heightmap.Biome.Mistlands || count <= 0 || ZNetScene.instance == null)
            {
                return null;
            }

            GameObject prefab = ZNetScene.instance.GetPrefab(Prefab);
            if (prefab == null)
            {
                return null;
            }

            for (int i = 0; i < count; i++)
            {
                if (!Spot(hearth, state, i, count, out Vector3 spot) || Standing(hearth.VillageId, spot))
                {
                    continue;
                }

                Vector3 toHearth = (hearth.transform.position - spot).Horizontal();
                return new Amenities.Job
                {
                    Prefab = Prefab, Name = JobName, Spot = spot, Cost = Cost(),
                    Rotation = toHearth.sqrMagnitude > 0.01f ? Quaternion.LookRotation(toHearth.normalized) : Quaternion.identity,
                };
            }

            return null;
        }

        private static Dictionary<string, int> Cost()
        {
            var cost = new Dictionary<string, int>();
            foreach (string part in (LogicConfig.MistlandsDemisterCost?.Value ?? "Wood:10, Stone:10").Split(','))
            {
                string[] pair = part.Split(':');
                if (pair.Length == 2 && int.TryParse(pair[1].Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out int amount) &&
                    amount > 0 && Materials.Tracked.Contains(pair[0].Trim()))
                {
                    cost[pair[0].Trim()] = amount;
                }
            }

            return cost;
        }

        /// <summary>Where the demister goes: kept once found, else worked out on the ring.</summary>
        private static bool Spot(VillageHearth hearth, VillageState state, int index, int count, out Vector3 spot)
        {
            spot = hearth.Zdo.GetVec3(Key(index), Vector3.zero);
            if (spot != Vector3.zero)
            {
                return true;
            }

            Vector3 center = hearth.transform.position;
            float radius = Mathf.Max(14f, Palisade.WantedRadius(hearth, state) - 4f);
            HashSet<Vector2Int> network = PathPlanner.PlannedNetwork(hearth);
            float baseAngle = state.Axis + 45f + index * 360f / count;
            for (int step = 0; step < 9; step++)
            {
                float angle = baseAngle + (step + 1) / 2 * 8f * (step % 2 == 0 ? 1f : -1f);
                Vector3 p = center + Quaternion.Euler(0f, angle, 0f) * Vector3.forward * radius;
                if (!ZoneSystem.instance.IsZoneLoaded(p))
                {
                    return false;
                }

                if (!Amenities.Usable(hearth, state, p, out float y) || PathPlanner.DistanceToNetwork(network, p) < 2.5f)
                {
                    continue;
                }

                spot = new Vector3(p.x, y, p.z);
                hearth.Zdo.Set(Key(index), spot);
                return true;
            }

            return false;
        }

        private static bool Standing(int villageId, Vector3 spot)
        {
            foreach (Collider collider in Physics.OverlapSphere(spot + Vector3.up, 2.5f))
            {
                ZNetView view = collider.GetComponentInParent<ZNetView>();
                if (view != null && view.IsValid() && Utils.GetPrefabName(view.gameObject) == Prefab &&
                    view.GetZDO().GetInt(Keys.BuiltBy) == villageId)
                {
                    return true;
                }
            }

            return false;
        }
    }
}
