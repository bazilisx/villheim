using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Dirt trails out of the village: to its outpost, and to its nearest neighbour village within 2,500 m. After Living
    /// Factions' runtime roads (the rules, not the code):
    ///
    /// - A trail is planned once from the world generator's heights, so nothing needs to be loaded: A* on an 8 m grid
    ///   (16 m for trails longer than 900 m) inside an ellipse round the two ends (1.3 times the straight distance plus
    ///   40 m), never through water, with a step costing its length times (1 + 12 x grade squared) and very steep steps
    ///   (grade over 0.6) costing much more. The grid points are kept on the hearth's ZDO.
    /// - It is painted as dirt only where a player is: every ten seconds, up to 40 spots within 50 m of the player on
    ///   loaded ground, 1.6 m wide, skipping the village itself (it has its own paths) and the camp.
    /// - A trail between two villages is planned by the one with the lower id, so it is laid once.
    ///
    /// Runs with WorldLife on (and Trails, on by default).
    /// </summary>
    internal static class Trails
    {
        private static readonly int KeyOutpostTrail = "villheim_trail_outpost".GetStableHashCode();
        private static readonly int KeyOutpostTrail2 = "villheim_trail_outpost1".GetStableHashCode();
        private static int OutpostKey(int index) => index == 0 ? KeyOutpostTrail : KeyOutpostTrail2;
        private static readonly int KeyNeighbourTrail = "villheim_trail_neighbour".GetStableHashCode();
        private static readonly int KeyPlannedDay = "villheim_trail_day".GetStableHashCode();
        private const float NeighbourReach = 2500f;
        private const float PaintNear = 50f;
        private const int PaintPerTick = 40;
        private const float Spacing = 1.5f;

        private static readonly HashSet<long> Painted = new HashSet<long>();
        private static readonly Dictionary<int, (string Raw, List<Vector3> Points)> Parsed = new Dictionary<int, (string, List<Vector3>)>();

        private static bool On => LogicConfig.WorldLife != null && LogicConfig.WorldLife.Value &&
                                  (LogicConfig.Trails == null || LogicConfig.Trails.Value);

        // ---------------------------------------------------------------- planning (hearth owner, once a day at most)

        public static void Tick(VillageHearth hearth, VillageState state)
        {
            int day = EnvMan.instance != null ? EnvMan.instance.GetDay() : 0;
            if (!On || hearth.Zdo.GetInt(KeyPlannedDay, -1) == day)
            {
                return;
            }

            hearth.Zdo.Set(KeyPlannedDay, day);
            Vector3 home = hearth.transform.position;
            List<Vector3> camps = Outposts.Positions(hearth);
            for (int i = 0; i < camps.Count && i < 2; i++)
            {
                if (hearth.Zdo.GetString(OutpostKey(i), "").Length == 0)
                {
                    Save(hearth.Zdo, OutpostKey(i), Plan(home, camps[i]));
                }
            }

            if (hearth.Zdo.GetString(KeyNeighbourTrail, "").Length == 0)
            {
                ZDO other = Relations.AllHearths()
                    .Where(z => z.GetInt(Keys.VillageId) != state.Id && Utils.DistanceXZ(z.GetPosition(), home) < NeighbourReach)
                    .OrderBy(z => Utils.DistanceXZ(z.GetPosition(), home)).FirstOrDefault();
                if (other != null && state.Id < other.GetInt(Keys.VillageId))
                {
                    Save(hearth.Zdo, KeyNeighbourTrail, Plan(home, other.GetPosition()));
                }
            }
        }

        /// <summary>The trail's grid points from <paramref name="from"/> to <paramref name="to"/>, or an empty list.</summary>
        public static List<Vector3> Plan(Vector3 from, Vector3 to)
        {
            WorldGenerator world = WorldGenerator.instance;
            float water = ZoneSystem.instance.m_waterLevel;
            float straight = Utils.DistanceXZ(from, to);
            float cell = straight > 900f ? 16f : 8f;
            float reach = straight * 1.3f + 40f;
            Vector2Int start = Cell(from, cell), goal = Cell(to, cell);
            float H(Vector2Int c) => world.GetHeight(c.x * cell, c.y * cell);
            bool Inside(Vector2Int c)
            {
                var p = new Vector3(c.x * cell, 0f, c.y * cell);
                return Utils.DistanceXZ(p, from) + Utils.DistanceXZ(p, to) <= reach;
            }

            var open = new SortedSet<(float F, int Order, Vector2Int Cell)>(Comparer<(float, int, Vector2Int)>.Create((a, b) =>
                a.Item1 != b.Item1 ? a.Item1.CompareTo(b.Item1) : a.Item2.CompareTo(b.Item2)));
            var cost = new Dictionary<Vector2Int, float> { [start] = 0f };
            var came = new Dictionary<Vector2Int, Vector2Int>();
            int order = 0;
            open.Add((0f, order++, start));
            Vector2Int[] steps =
            {
                new Vector2Int(1, 0), new Vector2Int(-1, 0), new Vector2Int(0, 1), new Vector2Int(0, -1),
                new Vector2Int(1, 1), new Vector2Int(1, -1), new Vector2Int(-1, 1), new Vector2Int(-1, -1),
            };

            int expanded = 0;
            bool found = false;
            while (open.Count > 0 && expanded < 30000)
            {
                (float _, int _, Vector2Int current) = open.Min;
                open.Remove(open.Min);
                if (current == goal)
                {
                    found = true;
                    break;
                }

                expanded++;
                float here = H(current);
                foreach (Vector2Int step in steps)
                {
                    Vector2Int next = current + step;
                    if (!Inside(next) && next != goal)
                    {
                        continue;
                    }

                    float height = H(next);
                    if (height < water + 0.5f && next != goal)
                    {
                        continue;
                    }

                    float length = cell * (step.x != 0 && step.y != 0 ? 1.4142f : 1f);
                    float grade = Mathf.Abs(height - here) / length;
                    float price = length * (1f + 12f * grade * grade) + (grade > 0.6f ? 200f : 0f);
                    float total = cost[current] + price;
                    if (cost.TryGetValue(next, out float known) && known <= total)
                    {
                        continue;
                    }

                    cost[next] = total;
                    came[next] = current;
                    float guess = Vector2Int.Distance(next, goal) * cell;
                    open.Add((total + guess, order++, next));
                }
            }

            var points = new List<Vector3>();
            if (!found)
            {
                VillheimPlugin.Log.LogInfo($"No trail found from {from} to {to} ({expanded} cells tried).");
                return points;
            }

            for (Vector2Int c = goal; ; c = came[c])
            {
                points.Add(new Vector3(c.x * cell, H(c), c.y * cell));
                if (c == start || !came.ContainsKey(c))
                {
                    break;
                }
            }

            points.Reverse();
            VillheimPlugin.Log.LogInfo($"Trail planned from {from} to {to}: {points.Count} points, {expanded} cells tried.");
            return points;
        }

        private static Vector2Int Cell(Vector3 point, float cell) =>
            new Vector2Int(Mathf.RoundToInt(point.x / cell), Mathf.RoundToInt(point.z / cell));

        private static void Save(ZDO zdo, int key, List<Vector3> points)
        {
            var sb = new StringBuilder();
            foreach (Vector3 p in points)
            {
                if (sb.Length > 0) sb.Append(';');
                sb.Append(Mathf.RoundToInt(p.x).ToString(CultureInfo.InvariantCulture)).Append(',')
                    .Append(Mathf.RoundToInt(p.z).ToString(CultureInfo.InvariantCulture));
            }

            // "-" marks a trail that could not be found, so it is not planned again every day.
            zdo.Set(key, sb.Length > 0 ? sb.ToString() : "-");
        }

        private static List<Vector3> Load(ZDO zdo, int key)
        {
            string raw = zdo.GetString(key, "");
            int cacheKey = unchecked((int)zdo.m_uid.ID * 31 + key);
            if (Parsed.TryGetValue(cacheKey, out var cached) && cached.Raw == raw)
            {
                return cached.Points;
            }

            var points = new List<Vector3>();
            foreach (string entry in raw.Split(';'))
            {
                string[] xz = entry.Split(',');
                if (xz.Length == 2 && int.TryParse(xz[0], out int x) && int.TryParse(xz[1], out int z))
                {
                    points.Add(new Vector3(x, 0f, z));
                }
            }

            Parsed[cacheKey] = (raw, points);
            return points;
        }

        // ---------------------------------------------------------------- painting (local player)

        public static void Paint(Vector3 player)
        {
            if (!On)
            {
                return;
            }

            int budget = PaintPerTick;
            float villageRadius = VillheimConfig.VillageRadius.Value + 5f;
            List<ZDO> hearths = Relations.AllHearths().ToList();
            foreach (ZDO hearth in hearths)
            {
                foreach (int key in new[] { KeyOutpostTrail, KeyOutpostTrail2, KeyNeighbourTrail })
                {
                    List<Vector3> points = Load(hearth, key);
                    for (int i = 1; i < points.Count && budget > 0; i++)
                    {
                        Vector3 a = points[i - 1], b = points[i];
                        if (Utils.DistanceXZ(a, player) > PaintNear + 20f && Utils.DistanceXZ(b, player) > PaintNear + 20f)
                        {
                            continue;
                        }

                        float length = Utils.DistanceXZ(a, b);
                        for (float t = 0f; t < length && budget > 0; t += Spacing)
                        {
                            Vector3 spot = Vector3.Lerp(a, b, t / Mathf.Max(0.01f, length));
                            long id = ((long)Mathf.RoundToInt(spot.x) << 32) ^ (uint)Mathf.RoundToInt(spot.z);
                            if (Painted.Contains(id) || Utils.DistanceXZ(spot, player) > PaintNear ||
                                hearths.Any(h => Utils.DistanceXZ(h.GetPosition(), spot) < villageRadius) ||
                                !ZNetScene.instance.IsAreaReady(spot))
                            {
                                continue;
                            }

                            Painted.Add(id);
                            PathBuilder.PaintAt(spot, 1.6f);
                            budget--;
                        }
                    }
                }
            }
        }

        /// <summary>The trail from hearth <paramref name="a"/> to hearth <paramref name="b"/>, if one was planned between them.</summary>
        public static List<Vector3> Between(ZDO a, ZDO b)
        {
            foreach ((ZDO owner, ZDO other) in new[] { (a, b), (b, a) })
            {
                List<Vector3> points = Load(owner, KeyNeighbourTrail);
                if (points.Count > 1 && Utils.DistanceXZ(points[points.Count - 1], other.GetPosition()) < 40f)
                {
                    var list = new List<Vector3>(points);
                    if (owner == b)
                    {
                        list.Reverse();
                    }

                    return list;
                }
            }

            return null;
        }

        /// <summary>The trail from the hearth to its outpost, or null.</summary>
        public static List<Vector3> ToOutpost(ZDO hearth, int index = 0)
        {
            List<Vector3> points = Load(hearth, OutpostKey(index));
            return points.Count > 1 ? new List<Vector3>(points) : null;
        }

        /// <summary>The camps are gone: their trails are planned again for whatever camps come next.</summary>
        public static void ForgetOutposts(ZDO hearth)
        {
            hearth.Set(KeyOutpostTrail, "");
            hearth.Set(KeyOutpostTrail2, "");
        }

        public static string Describe(VillageHearth hearth)
        {
            int outpost = Load(hearth.Zdo, KeyOutpostTrail).Count + Load(hearth.Zdo, KeyOutpostTrail2).Count;
            int neighbour = Load(hearth.Zdo, KeyNeighbourTrail).Count;
            return $"trails to the outposts {(outpost > 0 ? outpost + " points" : "none")}, to the neighbour {(neighbour > 0 ? neighbour + " points" : "none")}";
        }

        /// <summary>'vh trails': plan the nearest village's trails again now.</summary>
        public static string Command()
        {
            Player player = Player.m_localPlayer;
            VillageHearth hearth = player != null ? VillageHearth.Closest(player.transform.position, 200f) : null;
            if (hearth == null)
            {
                return "No village within 200 m.";
            }

            ForgetOutposts(hearth.Zdo);
            hearth.Zdo.Set(KeyNeighbourTrail, "");
            hearth.Zdo.Set(KeyPlannedDay, -1);
            bool was = LogicConfig.WorldLife.Value;
            Tick(hearth, new VillageState(hearth.Zdo));
            return Describe(hearth) + (was ? "" : " (WorldLife is off: nothing is planned or painted until it is on)");
        }
    }
}
