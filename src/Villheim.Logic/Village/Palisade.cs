using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Designs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// A fence around the village that keeps enemies out and grows with it, after Millenaire's village walls.
    ///
    /// Once the village has two buildings, its builder puts up a ring of vanilla pieces around all of them: a light
    /// wood fence for a hamlet, a stake wall (plain wood, so a Meadows village can have one) once it is a village. The ring
    /// sits a few metres outside the furthest building; where a path crosses it there is a gate (or a gap), and it
    /// skips water, buildings and steep ground. When buildings go up beyond the ring, the old ring comes down (half the
    /// materials back) and a wider one goes up. The fence is paid from the village chest, after the building going up
    /// has what it needs.
    /// </summary>
    internal static class Palisade
    {
        private static readonly int KeyRadius = "villheim_fence_radius".GetStableHashCode();

        // The first that exists and the village's biome can pay for is used. Names checked against real blueprints:
        // wood_fence and stake_wall are wood only; sharpened stakes need core wood, so they are not used here.
        private static readonly string[] LightPieces = { "wood_fence", "stake_wall" };
        private static readonly string[] WallPieces = { "stake_wall" };
        private static readonly string[] GatePieces = { "wood_gate" };

        private const float MinRadius = 16f;
        private const float Margin = 3f;
        private const float GateGap = 2.2f;

        internal sealed class Segment
        {
            public string Prefab;
            public Vector3 Position;
            public Quaternion Rotation;
            public Dictionary<string, int> Cost;
            public Piece Remove;
        }

        private static readonly Dictionary<int, (float Time, Segment Next)> Cache = new Dictionary<int, (float, Segment)>();

        public static bool IsFencePiece(string prefab) =>
            LightPieces.Contains(prefab) || WallPieces.Contains(prefab) || GatePieces.Contains(prefab);

        /// <summary>The ring's radius for the village as it stands now, on a 4 m step.</summary>
        public static float WantedRadius(VillageHearth hearth, VillageState state)
        {
            float reach = MinRadius;
            foreach (Plot plot in state.Plots)
            {
                reach = Mathf.Max(reach, Utils.DistanceXZ(plot.Position, hearth.transform.position) + plot.Radius * 0.75f + Margin);
            }

            return Mathf.Min(Mathf.Ceil(reach / 4f) * 4f, VillheimConfig.VillageRadius.Value + 6f);
        }

        /// <summary>The next fence job: take down a piece of an outgrown ring, or put up the next missing segment.</summary>
        public static Segment Next(VillageHearth hearth)
        {
            if (Cache.TryGetValue(hearth.VillageId, out var cached) && Time.time - cached.Time < 8f &&
                (cached.Next == null || cached.Next.Remove != null || !Present(cached.Next.Prefab, cached.Next.Position)))
            {
                return cached.Next;
            }

            Segment next = Find(hearth);
            Cache[hearth.VillageId] = (Time.time, next);
            return next;
        }

        public static void Forget(int villageId) => Cache.Remove(villageId);

        private static Segment Find(VillageHearth hearth)
        {
            var state = new VillageState(hearth.Zdo);
            if (state.Plots.Count < (state.Type == "fortified" ? 1 : 2) || VillageChest.IsLost(hearth))
            {
                return null;
            }

            float wanted = WantedRadius(hearth, state);
            float current = hearth.Zdo.GetFloat(KeyRadius, 0f);
            if (wanted > current + 3f || current <= 0f)
            {
                hearth.Zdo.Set(KeyRadius, wanted);
                current = wanted;
                VillheimPlugin.Debug($"{state.Name}: the fence ring is now {wanted:0} m from the hearth.");
            }

            Vector3 center = hearth.transform.position;

            // An outgrown ring comes down first, piece by piece.
            var pieces = new List<Piece>();
            Piece.GetAllPiecesInRadius(center, current - 2.5f, pieces);
            foreach (Piece piece in pieces)
            {
                if (piece != null && piece.m_nview != null && piece.m_nview.IsValid() &&
                    piece.m_nview.GetZDO().GetInt(Keys.BuiltBy) == hearth.VillageId &&
                    IsFencePiece(Utils.GetPrefabName(piece.gameObject)) &&
                    Utils.DistanceXZ(piece.transform.position, center) > MinRadius - 4f)
                {
                    return new Segment { Remove = piece, Position = piece.transform.position };
                }
            }

            int tier = VillageBrain.TierIndex(state.Plots.Count) + (state.Type == "fortified" ? 1 : 0);
            string prefabName = Pick(tier >= 2 ? WallPieces.Concat(LightPieces) : LightPieces, state.Biome, out GameObject prefab,
                out Dictionary<string, int> cost);
            if (prefabName == null)
            {
                return null;
            }

            string gateName = Pick(GatePieces, state.Biome, out GameObject gate, out Dictionary<string, int> gateCost);
            float width = Mathf.Max(1f, Width(prefab, prefabName));
            int count = Mathf.CeilToInt(2f * Mathf.PI * current / width);
            HashSet<Vector2Int> network = PathPlanner.Network(hearth);
            Container chest = VillageChest.Find(hearth);
            Dictionary<string, int> building = ConstructionSite.Remaining(hearth);

            for (int i = 0; i < count; i++)
            {
                float angle = state.Axis * Mathf.Deg2Rad + i * 2f * Mathf.PI / count;
                Vector3 outward = new Vector3(Mathf.Sin(angle), 0f, Mathf.Cos(angle));
                Vector3 spot = center + outward * current;
                if (!ZoneSystem.instance.IsZoneLoaded(spot) || !ZoneSystem.instance.GetGroundHeight(spot, out float y) ||
                    y < ZoneSystem.instance.m_waterLevel + 0.3f || Steep(spot, outward, width) || InBuilding(state, spot))
                {
                    continue;
                }

                spot.y = y;
                Quaternion rotation = Quaternion.LookRotation(outward);
                bool onPath = PathPlanner.DistanceToNetwork(network, spot) < GateGap;
                string useName = prefabName;
                Dictionary<string, int> useCost = cost;
                if (onPath)
                {
                    if (gateName == null)
                    {
                        continue; // leave a gap for the path
                    }

                    useName = gateName;
                    useCost = gateCost;
                }

                if (Present(useName, spot) || (onPath && PresentAny(GatePieces, spot)))
                {
                    continue;
                }

                if (!Amenities.Affordable(hearth, state, useCost, building))
                {
                    return null; // wait for the chest
                }

                return new Segment { Prefab = useName, Position = spot, Rotation = rotation, Cost = useCost };
            }

            return null;
        }

        /// <summary>Puts the segment up (paid from the chest) or takes the outgrown piece down (half back).</summary>
        public static void Build(VillageHearth hearth, Segment segment)
        {
            Forget(hearth.VillageId);
            var state = new VillageState(hearth.Zdo);
            Container chest = VillageChest.Find(hearth);
            if (segment.Remove != null)
            {
                foreach (KeyValuePair<string, int> c in DesignSpawner.RecipeCost(segment.Remove.gameObject))
                {
                    if (chest != null && c.Value / 2 > 0)
                    {
                        VillageChest.Add(chest, c.Key, c.Value / 2);
                    }
                }

                segment.Remove.m_nview.ClaimOwnership();
                ZNetScene.instance.Destroy(segment.Remove.gameObject);
                return;
            }

            if (chest == null || !VillageChest.Take(chest, segment.Cost))
            {
                return;
            }

            GameObject prefab = ZNetScene.instance.GetPrefab(segment.Prefab);
            if (prefab == null)
            {
                return;
            }

            TerrainShaper.LevelPad(segment.Position, 1f, 2f);
            GameObject made = Object.Instantiate(prefab, segment.Position, segment.Rotation);
            ZNetView view = made.GetComponent<ZNetView>();
            view?.GetZDO()?.Set(Keys.BuiltBy, hearth.VillageId);
            made.GetComponent<Piece>()?.m_placeEffect?.Create(segment.Position, segment.Rotation, made.transform);
        }

        private static string Pick(IEnumerable<string> names, Heightmap.Biome biome, out GameObject prefab, out Dictionary<string, int> cost)
        {
            foreach (string name in names)
            {
                prefab = ZNetScene.instance ? ZNetScene.instance.GetPrefab(name) : null;
                if (prefab != null && Amenities.Buildable(prefab, biome, out cost))
                {
                    return name;
                }
            }

            prefab = null;
            cost = null;
            return null;
        }

        private static float Width(GameObject prefab, string name)
        {
            Bounds? bounds = BuildOrder.Measure(prefab, name, Vector3.zero, Quaternion.identity, prefab.transform.localScale);
            return bounds.HasValue ? bounds.Value.size.x : 2f;
        }

        private static bool Steep(Vector3 spot, Vector3 outward, float width)
        {
            Vector3 side = Vector3.Cross(Vector3.up, outward) * (width * 0.5f);
            return ZoneSystem.instance.GetGroundHeight(spot + side, out float a) && ZoneSystem.instance.GetGroundHeight(spot - side, out float b) &&
                   Mathf.Abs(a - b) > 1.5f;
        }

        private static bool InBuilding(VillageState state, Vector3 spot)
        {
            return state.Plots.Any(p => Utils.DistanceXZ(p.Position, spot) < p.Radius * 0.6f + 1f);
        }

        private static readonly List<Piece> Nearby = new List<Piece>();

        private static bool Present(string prefab, Vector3 spot) => PresentAny(new[] { prefab }, spot);

        private static bool PresentAny(IEnumerable<string> prefabs, Vector3 spot)
        {
            Nearby.Clear();
            Piece.GetAllPiecesInRadius(spot, 0.8f, Nearby);
            return Nearby.Any(p => p != null && prefabs.Contains(Utils.GetPrefabName(p.gameObject)));
        }
    }
}
