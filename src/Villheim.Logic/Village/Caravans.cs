using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Villagers;
using Villheim.Prefabs;
using Random = UnityEngine.Random;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Goods and people on the road between places, kept as records that move on the world clock. After Living
    /// Factions' bands (records that become people near a player), Bannerlord's villagers walking their goods to town
    /// and Sim Settlements 2's caravans that join two settlements' stores. The rules, not the code.
    ///
    /// - A caravan is a line on the source hearth's ZDO: who sends it, where to, what it carries, when it left and its
    ///   pace (CaravanMetresPerDay, 2,400 m a day as in Living Factions). Where it is follows from the time alone, so
    ///   nothing has to run while nobody is near; it goes along the planned trail when there is one, else straight.
    /// - Trade caravans: once a day (CaravanChancePerDay) a village with more than it needs of something sends up to
    ///   20 of one or two things to the village within CaravanReach that lacks them most: what its biome does not
    ///   give first (core wood to a Meadows village, fine wood to a Black Forest one), then what its stock is low on.
    ///   Never to a village it is wary of or hostile to. The goods leave the chest at once.
    /// - Hauls: an outpost's load carried home along its trail (Outposts.cs).
    /// - Settlers: people going off to found a daughter village (Daughters.cs).
    /// - The destination's hearth owner takes the load into its stock once the caravan is due, and keeps the id so
    ///   it is taken once; the source forgets the record when the destination has it (or after twenty days).
    /// - Near a player (100 m) the caravan is a real person walking the road (wanderer kind "carrier"), a little ahead
    ///   of where the record says, gone again once no player is within 110 m. A trade carrier who reaches the
    ///   destination's hearth stays as a visiting pedlar (trade, news, relations, as WorldLife's pedlars).
    ///
    /// Runs with WorldLife and Caravans on.
    /// </summary>
    internal static class Caravans
    {
        private static readonly int KeyOut = "villheim_caravans".GetStableHashCode();
        private static readonly int KeyGot = "villheim_caravans_got".GetStableHashCode();
        private static readonly int KeyRolled = "villheim_caravan_day".GetStableHashCode();
        public static readonly int KeyCaravanId = "villheim_caravanid".GetStableHashCode();

        public const string Trade = "trade";
        public const string Haul = "haul";
        public const string Settlers = "settlers";

        private const float EmbodyRange = 100f;
        private const float GoneRange = 110f;
        private const float SeenFrom = 70f;
        private static readonly Dictionary<int, float> NextReceive = new Dictionary<int, float>();

        internal sealed class Caravan
        {
            public long Id;
            public string Kind;
            public int From;
            public int To;
            public Vector3 Start;
            public Vector3 End;
            public double Departed;
            public float Speed;
            public Dictionary<string, int> Cargo = new Dictionary<string, int>();
            public string Path = "s";
            public int Seed;
            public string Extra = "";

            public string CargoText() => string.Join(", ", Cargo.Where(c => c.Value > 0).Select(c => $"{c.Value} {Materials.Label(c.Key)}"));
        }

        private static bool On => LogicConfig.WorldLife != null && LogicConfig.WorldLife.Value &&
                                  (LogicConfig.Caravans == null || LogicConfig.Caravans.Value);

        private static double Now => ZNet.instance != null ? ZNet.instance.GetTimeSeconds() : Time.time;

        private static int Today => EnvMan.instance != null ? EnvMan.instance.GetDay() : 0;

        private static float Hour => EnvMan.instance != null ? EnvMan.instance.GetDayFraction() * 24f : 12f;

        /// <summary>Metres a second for a caravan, from CaravanMetresPerDay.</summary>
        public static float Pace => (LogicConfig.CaravanMetresPerDay != null ? LogicConfig.CaravanMetresPerDay.Value : 2400f) /
                                    (float)System.Math.Max(60.0, VillageBrain.DayLength());

        // ---------------------------------------------------------------- records

        private static string F(float f) => f.ToString("0.#", CultureInfo.InvariantCulture);

        private static string Write(Caravan c) =>
            string.Join("|", c.Id.ToString(CultureInfo.InvariantCulture), c.Kind, c.From.ToString(CultureInfo.InvariantCulture),
                c.To.ToString(CultureInfo.InvariantCulture), F(c.Start.x), F(c.Start.z), F(c.End.x), F(c.End.z),
                c.Departed.ToString("0.#", CultureInfo.InvariantCulture), c.Speed.ToString("0.###", CultureInfo.InvariantCulture),
                string.Join(",", c.Cargo.Select(k => k.Key + ":" + k.Value.ToString(CultureInfo.InvariantCulture))), c.Path,
                c.Seed.ToString(CultureInfo.InvariantCulture), c.Extra.Replace("|", "/").Replace("\n", " "));

        private static Caravan Parse(string line)
        {
            string[] p = line.Split('|');
            if (p.Length < 14)
            {
                return null;
            }

            try
            {
                float Fl(string s) => float.Parse(s, CultureInfo.InvariantCulture);
                var c = new Caravan
                {
                    Id = long.Parse(p[0], CultureInfo.InvariantCulture),
                    Kind = p[1],
                    From = int.Parse(p[2], CultureInfo.InvariantCulture),
                    To = int.Parse(p[3], CultureInfo.InvariantCulture),
                    Start = new Vector3(Fl(p[4]), 0f, Fl(p[5])),
                    End = new Vector3(Fl(p[6]), 0f, Fl(p[7])),
                    Departed = double.Parse(p[8], CultureInfo.InvariantCulture),
                    Speed = Fl(p[9]),
                    Path = p[11],
                    Seed = int.Parse(p[12], CultureInfo.InvariantCulture),
                    Extra = p[13],
                };
                foreach (string entry in p[10].Split(','))
                {
                    int colon = entry.IndexOf(':');
                    if (colon > 0 && int.TryParse(entry.Substring(colon + 1), out int amount))
                    {
                        c.Cargo[entry.Substring(0, colon)] = amount;
                    }
                }

                return c;
            }
            catch (System.FormatException)
            {
                return null;
            }
        }

        private static List<Caravan> Outgoing(ZDO hearth) =>
            hearth.GetString(KeyOut, "").Split('\n').Select(Parse).Where(c => c != null).ToList();

        private static void Save(ZDO hearth, List<Caravan> caravans)
        {
            hearth.Set(KeyOut, string.Join("\n", caravans.Select(Write)));
            _allAt = -100f;
        }

        private static HashSet<long> Got(ZDO hearth) =>
            new HashSet<long>(hearth.GetString(KeyGot, "").Split(',')
                .Select(s => long.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out long id) ? id : 0L).Where(id => id != 0L));

        private static ZDO HearthZdo(int villageId) =>
            Relations.AllHearths().FirstOrDefault(z => z.GetInt(Keys.VillageId) == villageId);

        private static List<(ZDO, Caravan)> _all = new List<(ZDO, Caravan)>();
        private static float _allAt = -100f;

        /// <summary>
        /// Every caravan any known hearth has on the road, with the hearth that sent it. Read again at most every two
        /// seconds (carriers ask on every AI tick), or at once after this machine changed one.
        /// </summary>
        internal static IEnumerable<(ZDO Source, Caravan Caravan)> All()
        {
            if (Time.time - _allAt > 2f)
            {
                _all = Relations.AllHearths().SelectMany(h => Outgoing(h).Select(c => (h, c))).ToList();
                _allAt = Time.time;
            }

            return _all;
        }

        // ---------------------------------------------------------------- the road

        private static readonly Dictionary<long, List<Vector3>> PathCache = new Dictionary<long, List<Vector3>>();

        /// <summary>The road a caravan takes: its trail when it has one, else a straight line.</summary>
        internal static List<Vector3> Road(Caravan c)
        {
            if (PathCache.TryGetValue(c.Id, out List<Vector3> cached))
            {
                return cached;
            }

            List<Vector3> points = null;
            ZDO from = HearthZdo(c.From);
            ZDO to = HearthZdo(c.To);
            if (c.Path == "n" && from != null && to != null)
            {
                points = Trails.Between(from, to);
            }
            else if (c.Path.StartsWith("o"))
            {
                // An outpost haul: the village's trail to its camp, walked from the camp end.
                ZDO home = to ?? from;
                int index = c.Path.Length > 1 && int.TryParse(c.Path.Substring(1), out int i) ? i : 0;
                points = home != null ? Trails.ToOutpost(home, index) : null;
                if (points != null)
                {
                    points.Reverse();
                }
            }

            if (points == null || points.Count < 2)
            {
                points = new List<Vector3> { c.Start, c.End };
            }
            else
            {
                points[0] = c.Start;
                points[points.Count - 1] = c.End;
            }

            if (PathCache.Count > 200)
            {
                PathCache.Clear();
            }

            PathCache[c.Id] = points;
            return points;
        }

        internal static float Length(List<Vector3> points)
        {
            float total = 0f;
            for (int i = 1; i < points.Count; i++)
            {
                total += Utils.DistanceXZ(points[i - 1], points[i]);
            }

            return total;
        }

        internal static Vector3 PointAt(List<Vector3> points, float distance)
        {
            for (int i = 1; i < points.Count; i++)
            {
                float step = Utils.DistanceXZ(points[i - 1], points[i]);
                if (distance <= step)
                {
                    return Vector3.Lerp(points[i - 1], points[i], step > 0.01f ? distance / step : 0f);
                }

                distance -= step;
            }

            return points[points.Count - 1];
        }

        /// <summary>Metres along its road the caravan has come by now.</summary>
        private static float Travelled(Caravan c) => (float)System.Math.Max(0.0, (Now - c.Departed) * c.Speed);

        public static bool Due(Caravan c) => Travelled(c) >= Length(Road(c));

        public static Vector3 Where(Caravan c) => PointAt(Road(c), Travelled(c));

        // ---------------------------------------------------------------- the village's side (hearth owner)

        /// <summary>Hearth tick: take in what has arrived, forget what was taken, and maybe send something.</summary>
        public static void Tick(VillageHearth hearth, VillageState state)
        {
            if (NextReceive.TryGetValue(state.Id, out float next) && Time.time < next)
            {
                return;
            }

            NextReceive[state.Id] = Time.time + 10f;
            Receive(hearth, state);
            Prune(hearth);
            if (On)
            {
                MaybeSend(hearth, state);
            }
        }

        /// <summary>Starts a caravan from the hearth's village. Returns its record.</summary>
        internal static Caravan Send(VillageHearth source, string kind, int toId, Vector3 start, Vector3 end,
            Dictionary<string, int> cargo, string path, string extra = "")
        {
            var c = new Caravan
            {
                Id = ((long)Random.Range(1, int.MaxValue) << 16) ^ (long)(Now * 10.0),
                Kind = kind,
                From = source.VillageId,
                To = toId,
                Start = start,
                End = end,
                Departed = Now,
                Speed = Pace,
                Cargo = cargo ?? new Dictionary<string, int>(),
                Path = path,
                Seed = Random.Range(1, int.MaxValue),
                Extra = extra ?? "",
            };
            List<Caravan> outgoing = Outgoing(source.Zdo);
            outgoing.Add(c);
            Save(source.Zdo, outgoing);
            VillheimPlugin.Log.LogInfo($"{source.VillageName}: a {kind} caravan to village {toId} ({c.CargoText()}), " +
                                       $"{Length(Road(c)):0} m, due in {Length(Road(c)) / c.Speed / 60f:0} min.");
            return c;
        }

        private static void Receive(VillageHearth hearth, VillageState state)
        {
            HashSet<long> got = null;
            foreach ((ZDO source, Caravan c) in All().ToList())
            {
                // Settlers are seen in by the village that sent them; everything else by the one it goes to.
                bool mine = c.Kind == Settlers ? c.From == state.Id : c.To == state.Id;
                if (!mine || !Due(c))
                {
                    continue;
                }

                got = got ?? Got(hearth.Zdo);
                if (got.Contains(c.Id))
                {
                    continue;
                }

                got.Add(c.Id);
                hearth.Zdo.Set(KeyGot, string.Join(",", got.Skip(System.Math.Max(0, got.Count - 40))
                    .Select(id => id.ToString(CultureInfo.InvariantCulture))));
                Deliver(hearth, state, source, c);
            }
        }

        private static void Deliver(VillageHearth hearth, VillageState state, ZDO source, Caravan c)
        {
            foreach (KeyValuePair<string, int> load in c.Cargo)
            {
                // People (settlers) are counted in the cargo too; only items go into the stock, and a settlers' load
                // goes to their new village (Daughters).
                if (c.Kind != Settlers && Materials.Prefab(load.Key) != null)
                {
                    state.Add(load.Key, load.Value);
                }
            }

            string from = source.GetString(Keys.Name, "down the road");
            switch (c.Kind)
            {
                case Trade:
                    Relations.Visited(hearth, c.From);
                    Chronicle.Add(hearth, $"{Names.Villager(c.Seed)} came with a load from {from}: {c.CargoText()}.");
                    Dialogue.Note(state.Id, "cargo");
                    break;
                case Haul:
                    Outposts.Hauled(hearth, state, c);
                    break;
                case Settlers:
                    Daughters.Arrived(hearth, state, c);
                    break;
            }
        }

        private static void Prune(VillageHearth hearth)
        {
            List<Caravan> outgoing = Outgoing(hearth.Zdo);
            if (outgoing.Count == 0)
            {
                return;
            }

            double day = VillageBrain.DayLength();
            int before = outgoing.Count;
            outgoing.RemoveAll(c =>
            {
                ZDO to = c.Kind == Settlers ? hearth.Zdo : HearthZdo(c.To);
                bool taken = to != null && Got(to).Contains(c.Id);
                return taken || Now - c.Departed > 20.0 * day;
            });

            if (outgoing.Count != before)
            {
                Save(hearth.Zdo, outgoing);
            }
        }

        private static void MaybeSend(VillageHearth hearth, VillageState state)
        {
            if (Hour < 8f || Hour > 14f || hearth.Zdo.GetInt(KeyRolled, -1) == Today || state.Plots.Count < 2)
            {
                return;
            }

            hearth.Zdo.Set(KeyRolled, Today);
            float chance = LogicConfig.CaravanChancePerDay != null ? LogicConfig.CaravanChancePerDay.Value : 0.3f;
            if (Random.value > chance || Outgoing(hearth.Zdo).Count(c => c.Kind == Trade) >= 2)
            {
                return;
            }

            SendTrade(hearth, state, out _);
        }

        /// <summary>Sends the best load the village can spare to the village that lacks it most. False with a reason.</summary>
        internal static bool SendTrade(VillageHearth hearth, VillageState state, out string why)
        {
            Container chest = VillageChest.Find(hearth);
            if (chest == null || !VillageChest.Usable(chest))
            {
                why = "no village chest to take goods from";
                return false;
            }

            Dictionary<string, int> spare = Spare(hearth, chest);
            if (spare.Count == 0)
            {
                why = "nothing to spare in the chest";
                return false;
            }

            float reach = LogicConfig.CaravanReach != null ? LogicConfig.CaravanReach.Value : 2500f;
            Vector3 home = hearth.transform.position;
            (ZDO To, Dictionary<string, int> Load, float Score) best = (null, null, 0f);
            foreach (ZDO other in Relations.AllHearths())
            {
                int id = other.GetInt(Keys.VillageId);
                float distance = Utils.DistanceXZ(other.GetPosition(), home);
                if (id == state.Id || distance > reach || Relations.View(hearth.Zdo, id) <= -15)
                {
                    continue;
                }

                var theirs = new VillageState(other);
                HashSet<string> grows;
                using (Materials.From(null))
                {
                    // Their own biome's materials: the scope the brain opened adds this village's outposts.
                    grows = Materials.AllowedIn(theirs.Biome);
                }

                var load = new Dictionary<string, int>();
                float score = 0f;
                foreach (KeyValuePair<string, int> item in spare.OrderByDescending(s => Lacks(grows, theirs, s.Key)))
                {
                    float lack = Lacks(grows, theirs, item.Key);
                    if (lack <= 0f || load.Count >= 2)
                    {
                        continue;
                    }

                    load[item.Key] = Mathf.Min(20, item.Value);
                    score += lack;
                }

                score *= 1000f / Mathf.Max(200f, distance);
                if (load.Count > 0 && score > best.Score)
                {
                    best = (other, load, score);
                }
            }

            if (best.To == null)
            {
                why = "no village in reach lacks what we can spare";
                return false;
            }

            if (!VillageChest.Take(chest, best.Load))
            {
                why = "the chest could not give the load";
                return false;
            }

            int toId = best.To.GetInt(Keys.VillageId);
            bool trail = Trails.Between(hearth.Zdo, best.To) != null;
            Caravan c = Send(hearth, Trade, toId, home, best.To.GetPosition(), best.Load, trail ? "n" : "s");
            Relations.Adjust(hearth, null, 2, toId);
            string toName = best.To.GetString(Keys.Name, "the next village");
            Chronicle.Add(hearth, $"{Names.Villager(c.Seed)} set out for {toName} with {c.CargoText()} we could spare.");
            Dialogue.Note(state.Id, "caravan");
            why = null;
            return true;
        }

        /// <summary>How much a village lacks <paramref name="item"/>: 3 when its biome does not give it, 1 when its stock is low.</summary>
        private static float Lacks(HashSet<string> grows, VillageState theirs, string item)
        {
            if (Materials.Tracked.Contains(item) && !grows.Contains(item))
            {
                return 3f;
            }

            int have = theirs.Get(item);
            return have < 20 ? (Materials.Tracked.Contains(item) ? 1f : 0.5f) : 0f;
        }

        /// <summary>What the chest holds beyond the building going up and a store kept back (30 wood or stone, 10 else).</summary>
        private static Dictionary<string, int> Spare(VillageHearth hearth, Container chest)
        {
            var spare = new Dictionary<string, int>();
            Dictionary<string, int> building = ConstructionSite.Remaining(hearth);
            HashSet<string> smith = Smithing.Reserved(hearth);
            Inventory inventory = chest.GetInventory();
            foreach (string item in Materials.Tracked.Concat(Market.Prices.Keys).Distinct())
            {
                string name = Materials.SharedName(item);
                if (name == null || smith.Contains(item))
                {
                    continue;
                }

                building.TryGetValue(item, out int reserved);
                int keep = item == Materials.Wood || item == Materials.Stone ? 30 : 10;
                int extra = inventory.CountItems(name) - reserved - keep;
                if (extra >= 5)
                {
                    spare[item] = extra;
                }
            }

            return spare;
        }

        // ---------------------------------------------------------------- people on the road (local player)

        /// <summary>World tick: caravans near the player become people walking the road.</summary>
        public static void Embody(Vector3 player)
        {
            if (!On || ZNetScene.instance == null)
            {
                return;
            }

            HashSet<long> walking = null;
            foreach ((ZDO source, Caravan c) in All())
            {
                if (Due(c))
                {
                    continue;
                }

                Vector3 at = Where(c);
                if (Utils.DistanceXZ(at, player) > EmbodyRange || !ZNetScene.instance.IsAreaReady(at))
                {
                    continue;
                }

                walking = walking ?? new HashSet<long>(Character.GetAllCharacters().OfType<Villager>()
                    .Where(v => !v.IsDead() && v.Zdo != null).Select(v => v.Zdo.GetLong(KeyCaravanId)).Where(id => id != 0L));
                if (walking.Contains(c.Id))
                {
                    continue;
                }

                int people = c.Kind == Settlers ? Mathf.Clamp(c.Cargo.TryGetValue("people", out int n) ? n : 2, 1, 4) : 1;
                for (int i = 0; i < people; i++)
                {
                    Vector3 spot = at + Quaternion.Euler(0f, 90f * i, 0f) * Vector3.forward * (i == 0 ? 0f : 1.6f);
                    Villager walker = Wanderers.Spawn(Wanderers.Carrier, spot, c.End, source.GetString(Keys.Name, ""), c.To);
                    if (walker == null)
                    {
                        break;
                    }

                    int seed = c.Seed + i * 7919;
                    string name = Names.Villager(seed);
                    if (walker.Zdo == null)
                    {
                        break;
                    }

                    walker.Zdo.Set(KeyCaravanId, c.Id);
                    walker.Zdo.Set(Keys.VillagerSeed, seed);
                    walker.Zdo.Set(Keys.VillagerName, name);
                    walker.m_name = name;
                }

                walking.Add(c.Id);
            }
        }

        private static float NearestPlayer(Vector3 point)
        {
            float best = float.MaxValue;
            foreach (Player p in Player.GetAllPlayers())
            {
                best = Mathf.Min(best, Utils.DistanceXZ(p.transform.position, point));
            }

            return best;
        }

        private static Caravan Find(long id, out ZDO source)
        {
            foreach ((ZDO s, Caravan c) in All())
            {
                if (c.Id == id)
                {
                    source = s;
                    return c;
                }
            }

            source = null;
            return null;
        }

        /// <summary>One AI tick for a carrier: walk just ahead of where the caravan's record is.</summary>
        public static void WalkTick(Villager villager, VillagerAI ai, float dt)
        {
            ZDO zdo = villager.Zdo;
            if (zdo == null)
            {
                return;
            }

            Caravan c = Find(zdo.GetLong(KeyCaravanId), out ZDO source);
            float nearest = NearestPlayer(villager.transform.position);
            if (c == null || Due(c))
            {
                Ending(villager, ai, dt, c, source, nearest);
                return;
            }

            if (nearest > GoneRange)
            {
                // Out of sight: the record carries on without him.
                Remove(villager);
                return;
            }

            List<Vector3> road = Road(c);
            Vector3 ahead = PointAt(road, Travelled(c) + 15f);
            if (Walker.For(villager).Go(villager, ai, dt, ahead, 2.5f) != WalkResult.Walking)
            {
                // Ahead of the record: wait for it, looking down the road.
                ai.StopMoving();
                Vector3 on = (PointAt(road, Travelled(c) + 40f) - villager.transform.position).Horizontal();
                if (on.sqrMagnitude > 0.01f)
                {
                    villager.SetLookDir(on.normalized);
                }
            }
        }

        /// <summary>The caravan is due (or gone): a trader walks into the hearth and stays a while; anyone else goes.</summary>
        private static void Ending(Villager villager, VillagerAI ai, float dt, Caravan c, ZDO source, float nearest)
        {
            VillageHearth to = c != null && c.Kind != Settlers ? VillageHearth.Find(c.To) : null;
            if (to == null || Utils.DistanceXZ(villager.transform.position, to.transform.position) > 120f)
            {
                if (nearest > SeenFrom)
                {
                    Remove(villager);
                }
                else if (c != null)
                {
                    Walker.For(villager).Go(villager, ai, dt, c.End, 3f);
                }

                return;
            }

            Vector3 meet = to.transform.position + (villager.transform.position - to.transform.position).Horizontal().normalized * 5f;
            if (Walker.For(villager).Go(villager, ai, dt, meet, 3f) == WalkResult.Walking)
            {
                return;
            }

            Walker.For(villager).Reset();
            ZDO zdo = villager.Zdo;
            Vector3 away = (to.transform.position - (source != null ? source.GetPosition() : villager.transform.position)).Horizontal();
            if (c.Kind == Trade)
            {
                // He stays as a visiting pedlar: trade with the chest and the player, news, a seat by the fire.
                zdo.Set(Wanderers.KeyKind, Wanderers.Pedlar);
                zdo.Set(Wanderers.KeyPhase, "stay");
                zdo.Set(Wanderers.KeyUntil, (long)((Now + 0.33 * VillageBrain.DayLength()) * 10.0));
                zdo.Set(Wanderers.KeyTarget, villager.transform.position);
                zdo.Set(Wanderers.KeyVisit, c.To);
                zdo.Set(Wanderers.KeyAway, away.sqrMagnitude > 0.01f ? away.normalized : Vector3.forward);
                zdo.Set(WorldLife.KeyFromVillage, c.From);
                zdo.Set(KeyCaravanId, 0L);
                WorldLife.Arrived(villager, Wanderers.Pedlar, to);
                return;
            }

            // A hauler or a settler has put the load down: back the way he came, gone once out of sight.
            zdo.Set(Wanderers.KeyPhase, "leave");
            zdo.Set(KeyCaravanId, 0L);
            Dialogue.Say(villager, c.Kind == Haul ? "That's the load in. Back to the camp." : "So this is the place.");
            Remove(villager, onlyUnseen: true);
        }

        private static void Remove(Villager villager, bool onlyUnseen = false)
        {
            if (onlyUnseen && NearestPlayer(villager.transform.position) < SeenFrom)
            {
                // Wanderers.RemoveWhenDone takes him once nobody is near (phase leave), or after three days.
                return;
            }

            if (villager.m_nview != null && villager.m_nview.IsValid())
            {
                villager.m_nview.ClaimOwnership();
                ZNetScene.instance.Destroy(villager.gameObject);
            }
        }

        // ---------------------------------------------------------------- reports and commands

        public static string Describe(VillageHearth hearth)
        {
            List<Caravan> outgoing = Outgoing(hearth.Zdo);
            var parts = outgoing.Select(c => $"{c.Kind} to {Name(c.To)} ({c.CargoText()}) {(Due(c) ? "arrived" : $"{Travelled(c):0} of {Length(Road(c)):0} m")}").ToList();
            int coming = All().Count(x => x.Caravan.To == hearth.VillageId && x.Caravan.From != hearth.VillageId && !Due(x.Caravan));
            return $"caravans out: {(parts.Count > 0 ? string.Join("; ", parts) : "none")}; on the way here: {coming}";
        }

        private static string Name(int villageId) => HearthZdo(villageId)?.GetString(Keys.Name, "?") ?? "?";

        /// <summary>'vh caravan': the nearest village sends a trade caravan now. 'vh caravans' lists every caravan known.</summary>
        public static string Command(string[] args)
        {
            Player player = Player.m_localPlayer;
            if (args != null && args.Length > 0 && args[0] == "list")
            {
                var lines = All().Select(x =>
                {
                    float distance = player != null ? Utils.DistanceXZ(Where(x.Caravan), player.transform.position) : 0f;
                    return $"{x.Caravan.Kind} {Name(x.Caravan.From)} to {Name(x.Caravan.To)}: {x.Caravan.CargoText()}, " +
                           $"{(Due(x.Caravan) ? "arrived" : $"{Travelled(x.Caravan):0} of {Length(Road(x.Caravan)):0} m, {distance:0} m from you")}";
                }).ToList();
                return lines.Count > 0 ? string.Join("\n", lines) : "No caravans on the road.";
            }

            VillageHearth hearth = player != null ? VillageHearth.Closest(player.transform.position, 200f) : null;
            if (hearth == null)
            {
                return "No village within 200 m.";
            }

            if (!hearth.NView.IsOwner())
            {
                hearth.NView.ClaimOwnership();
            }

            var state = new VillageState(hearth.Zdo);
            return SendTrade(hearth, state, out string why)
                ? Describe(hearth) + (On ? "" : " (WorldLife or Caravans is off: nobody walks it and nothing arrives until they are on)")
                : $"{state.Name} sends nothing: {why}.";
        }
    }
}
