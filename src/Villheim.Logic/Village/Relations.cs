using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using UnityEngine;
using Villheim.Prefabs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// How a village feels about its neighbours, after Millenaire's village relations (the rules, not the code).
    ///
    /// - Each village keeps its own view of every other village it knows, from -100 to 100, on its hearth's ZDO. The
    ///   first value comes from both villages' seeds, between -20 and 40, so most neighbours start on fair terms.
    /// - Once an in-game day, for each neighbour, there is a 1 in 10 chance the view moves by 10 to 19 points. Which way
    ///   depends on where it stands: below -90 it only gets worse; -90 to -50 improves 30% of the time; -50 to 0, 40%;
    ///   0 to 50, 60%; 50 to 90, 70%; above 90 it only gets better. Friends drift closer and enemies apart.
    /// - A pedlar or pilgrim from a neighbour lifts the view of it by 3.
    /// - A change of band (hostile, wary, fair, friendly, close) goes in the chronicle.
    ///
    /// Dialogue: tags neighbour:close, neighbour:friendly, neighbour:fair, neighbour:wary, neighbour:hostile for the
    /// nearest neighbour, and {neighbour} for its name. Nothing else uses relations yet; they are there for trade
    /// routes, help in attacks and raids between villages later.
    /// </summary>
    internal static class Relations
    {
        private static readonly int KeyRelations = "villheim_rel".GetStableHashCode();
        private static readonly int KeyRelationsDay = "villheim_relday".GetStableHashCode();
        private const float KnownWithin = 4000f;

        private static int Today => EnvMan.instance != null ? EnvMan.instance.GetDay() : 0;

        /// <summary>Once a day per village: the nightly drift.</summary>
        public static void Daily(VillageHearth hearth)
        {
            ZDO zdo = hearth.Zdo;
            if (zdo.GetInt(KeyRelationsDay) == Today)
            {
                return;
            }

            zdo.Set(KeyRelationsDay, Today);
            int self = hearth.VillageId;
            Dictionary<int, int> views = Read(zdo);
            var rng = new System.Random(unchecked(self * 31 + Today * 7919));
            foreach (ZDO other in Neighbours(hearth.transform.position, self))
            {
                int id = other.GetInt(Keys.VillageId);
                int before = Get(zdo, views, id, other);
                int after = before;
                if (rng.Next(10) == 0)
                {
                    int step = 10 + rng.Next(10);
                    after = Mathf.Clamp(rng.NextDouble() < ImproveChance(before) ? before + step : before - step, -100, 100);
                }

                views[id] = after;
                if (Band(after) != Band(before))
                {
                    string name = other.GetString(Keys.Name, "our neighbours");
                    Chronicle.Add(hearth, after > before
                        ? $"We are on {Band(after)} terms with {name} now."
                        : $"Things have cooled with {name}. We are {Band(after)} now.");
                }
            }

            Write(zdo, views);
        }

        private static double ImproveChance(int value) =>
            value < -90 ? 0.0 : value < -50 ? 0.3 : value < 0 ? 0.4 : value < 50 ? 0.6 : value < 90 ? 0.7 : 1.0;

        public static string Band(int value) =>
            value <= -50 ? "hostile" : value <= -15 ? "wary" : value < 30 ? "fair" : value < 70 ? "friendly" : "close";

        /// <summary>A visitor from <paramref name="fromId"/> came: the village thinks a little better of them.</summary>
        public static void Visited(VillageHearth hearth, int fromId)
        {
            if (fromId == 0 || hearth == null || !hearth.IsValid)
            {
                return;
            }

            Dictionary<int, int> views = Read(hearth.Zdo);
            ZDO other = AllHearths().FirstOrDefault(z => z.GetInt(Keys.VillageId) == fromId);
            views[fromId] = Mathf.Clamp(Get(hearth.Zdo, views, fromId, other) + 3, -100, 100);
            Write(hearth.Zdo, views);
        }

        /// <summary>The nearest neighbour's name and this village's view of it, or null.</summary>
        public static (string Name, int View)? Nearest(VillageHearth hearth)
        {
            if (hearth == null || !hearth.IsValid)
            {
                return null;
            }

            ZDO other = Neighbours(hearth.transform.position, hearth.VillageId)
                .OrderBy(z => Utils.DistanceXZ(z.GetPosition(), hearth.transform.position)).FirstOrDefault();
            if (other == null)
            {
                return null;
            }

            Dictionary<int, int> views = Read(hearth.Zdo);
            return (other.GetString(Keys.Name, "the next village"), Get(hearth.Zdo, views, other.GetInt(Keys.VillageId), other));
        }

        public static string Describe(VillageHearth hearth)
        {
            Dictionary<int, int> views = Read(hearth.Zdo);
            var parts = new List<string>();
            foreach (ZDO other in Neighbours(hearth.transform.position, hearth.VillageId))
            {
                int view = Get(hearth.Zdo, views, other.GetInt(Keys.VillageId), other);
                float distance = Utils.DistanceXZ(other.GetPosition(), hearth.transform.position);
                parts.Add($"{other.GetString(Keys.Name, "?")} ({distance:0} m) {view} {Band(view)}");
            }

            return parts.Count > 0 ? string.Join(", ", parts) : "no other village known";
        }

        private static int Get(ZDO zdo, Dictionary<int, int> views, int id, ZDO other)
        {
            if (views.TryGetValue(id, out int value))
            {
                return value;
            }

            int otherSeed = other != null ? other.GetInt(Keys.Seed) : id;
            int mine = zdo.GetInt(Keys.Seed);
            uint hash = unchecked((uint)(System.Math.Min(mine, otherSeed) * 73856093) ^ (uint)(System.Math.Max(mine, otherSeed) * 19349663));
            hash ^= hash >> 13;
            return -20 + (int)(hash % 61u);
        }

        private static List<ZDO> _hearths = new List<ZDO>();
        private static float _hearthsAt = -100f;

        /// <summary>Every lived-in hearth this machine knows of, looked up at most every 30 seconds (dialogue asks often).</summary>
        internal static IEnumerable<ZDO> AllHearths()
        {
            if (Time.time - _hearthsAt > 30f || _hearths.Any(z => z == null || !z.IsValid()))
            {
                int prefab = HearthPrefab.Name.GetStableHashCode();
                _hearths = ZDOMan.instance.m_objectsByID.Values.Where(z => z != null && z.GetPrefab() == prefab && z.GetBool(Keys.Initialized)).ToList();
                _hearthsAt = Time.time;
            }

            return _hearths;
        }

        private static IEnumerable<ZDO> Neighbours(Vector3 center, int self) =>
            AllHearths().Where(z => z.GetInt(Keys.VillageId) != self && Utils.DistanceXZ(z.GetPosition(), center) < KnownWithin);

        private static Dictionary<int, int> Read(ZDO zdo)
        {
            var views = new Dictionary<int, int>();
            foreach (string entry in zdo.GetString(KeyRelations, "").Split(';'))
            {
                int colon = entry.IndexOf(':');
                if (colon > 0 && int.TryParse(entry.Substring(0, colon), out int id) && int.TryParse(entry.Substring(colon + 1), out int value))
                {
                    views[id] = value;
                }
            }

            return views;
        }

        private static void Write(ZDO zdo, Dictionary<int, int> views)
        {
            zdo.Set(KeyRelations, string.Join(";", views.Select(v =>
                v.Key.ToString(CultureInfo.InvariantCulture) + ":" + v.Value.ToString(CultureInfo.InvariantCulture))));
        }
    }
}
