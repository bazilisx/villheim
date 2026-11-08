using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Villagers;
using Random = UnityEngine.Random;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// What a village knows of the land around it, and how far its people go.
    ///
    /// - Reach: each village has a radius it has explored. Its target grows with the village's stage
    ///   (KnowledgeReach: camp, hamlet, village, town) and its gear tier (KnowledgeReachPerGear); the explored radius
    ///   creeps toward the target by KnowledgeReachGrowth meters a day. Villagers only go where they have the gear for
    ///   the biome (KnowledgeGear), and never across long water. The reach only teaches the general lay of the land:
    ///   the kinds in KnowledgeReachKinds (where animals and creatures come out, where the biomes change). Outpost
    ///   camps, daughter villages and trails widen that.
    /// - Places: only notable kinds are recorded at all (KnowledgeKinds: boss altars, dungeons, traders, runestones,
    ///   valuable ore, Fuling villages, tar pits and the like; no dolmens, old houses or berry bushes). A place is only
    ///   found when a villager (a hunter, a forager, a camper, a carrier) walks within KnowledgeNear meters of it, a
    ///   half again as far for big sites such as boss altars and towers. Each is kept on the hearth with its witness
    ///   and day, at most KnowledgeKeep.
    /// - Who knows: the witness knows it firsthand. Others hear it in chats, passed on by someone who knows, with the
    ///   teller kept in the listener's ZDO. After KnowledgeCommonDays everyone has heard ("they say").
    ///
    /// The survey runs on the hearth's owner in small slices from the hearth tick (every 5 s): a few location checks,
    /// a few land samples, one slice of the object sweep. Results are cached in memory and on the hearth.
    /// </summary>
    internal static class Knowledge
    {
        private static readonly int KeyLog = "villheim_known".GetStableHashCode();
        private static readonly int KeyReach = "villheim_reachnow".GetStableHashCode();
        private static readonly int KeyReachDay = "villheim_reachday".GetStableHashCode();
        private static readonly int KeyHeard = "villheim_rumheard".GetStableHashCode();

        private const int KeepHeard = 16;

        public static bool On => LogicConfig.IsOn(LogicConfig.VillageKnowledge);

        private static int Today => EnvMan.instance != null ? EnvMan.instance.GetDay() : 0;

        // ---------------------------------------------------------------- discoveries

        internal sealed class Discovery
        {
            public int Id;
            public string Kind;
            public string Key;
            public Vector3 Position;
            public int Day;
            public string Witness = "";
            /// <summary>How it was found: went (a villager walked there), reach, camp, trail, daughter, spotted.</summary>
            public string How = "";
            public string Terrain = "flat";
            public string Lean = "";
            /// <summary>For creature grounds: day, night or any.</summary>
            public string When = "";

            public bool Firsthand => How == "went" || How == "reach" || How == "spotted";
        }

        private static readonly Dictionary<int, (string Raw, List<Discovery> List)> Parsed = new Dictionary<int, (string, List<Discovery>)>();

        /// <summary>The village's discoveries, newest last. Parsed once per change of the hearth's string.</summary>
        public static List<Discovery> Log(VillageHearth hearth)
        {
            if (hearth == null || !hearth.IsValid)
            {
                return new List<Discovery>();
            }

            string raw = hearth.Zdo.GetString(KeyLog, "");
            if (Parsed.TryGetValue(hearth.VillageId, out var cached) && cached.Raw == raw)
            {
                return cached.List;
            }

            var list = new List<Discovery>();
            foreach (string line in raw.Split('\n'))
            {
                string[] f = line.Split('|');
                if (f.Length < 11 || !int.TryParse(f[0], NumberStyles.Integer, CultureInfo.InvariantCulture, out int id))
                {
                    continue;
                }

                var d = new Discovery
                {
                    Id = id, Kind = f[1], Key = f[2], Position = new Vector3(F(f[3]), F(f[4]), F(f[5])), Day = (int)F(f[6]),
                    Witness = f[7], How = f[8], Terrain = f[9], Lean = f[10], When = f.Length > 11 ? f[11] : "",
                };

                // Older saves hold mundane finds and places learned without anyone going there: they are dropped
                // here and leave the hearth with the next save.
                if (Kept(d))
                {
                    list.Add(d);
                }
            }

            Parsed[hearth.VillageId] = (raw, list);
            return list;
        }

        /// <summary>Whether a stored discovery still counts under the current rules.</summary>
        private static bool Kept(Discovery d) => Notable(d.Kind, d.Key) && (ByReach(d.Kind) || d.How == "went");

        // ---------------------------------------------------------------- what is worth knowing

        public const string DefaultKinds =
            "boss, dungeon, trader, runestone, ore:copper, ore:tin, ore:silver, ore:obsidian, ore:flametal, fuling, dvergr, " +
            "nest, landmark:tarpit, landmark:tower, landmark:giant, landmark:henge, landmark:drakenest, landmark:stones, " +
            "forage:beehive, game, foe, biome";

        /// <summary>The default before nests counted (Tyler, 2026-11-08): a config still on it moves to DefaultKinds.</summary>
        public const string OldDefaultKinds =
            "boss, dungeon, trader, runestone, ore:copper, ore:tin, ore:silver, ore:obsidian, ore:flametal, fuling, dvergr, " +
            "landmark:tarpit, landmark:tower, landmark:giant, landmark:henge, landmark:drakenest, landmark:stones, " +
            "forage:beehive, game, foe, biome";

        public const string DefaultReachKinds = "game, foe, biome";

        private static (string Raw, HashSet<string> Set) _kinds, _reachKinds;

        private static HashSet<string> SetOf(string raw, ref (string Raw, HashSet<string> Set) cache)
        {
            raw = raw ?? "";
            if (cache.Set == null || cache.Raw != raw)
            {
                cache = (raw, new HashSet<string>(raw.Split(',').Select(t => t.Trim().ToLowerInvariant()).Where(t => t.Length > 0)));
            }

            return cache.Set;
        }

        /// <summary>A kind ("boss") or kind:key ("ore:copper") on the KnowledgeKinds list: worth recording at all.</summary>
        public static bool Notable(string kind, string key)
        {
            HashSet<string> set = SetOf(LogicConfig.KnowledgeKinds?.Value ?? DefaultKinds, ref _kinds);
            return set.Contains(kind) || set.Contains(kind + ":" + key);
        }

        /// <summary>Kinds the village learns from its reach, without anyone walking up to them.</summary>
        public static bool ByReach(string kind) => SetOf(LogicConfig.KnowledgeReachKinds?.Value ?? DefaultReachKinds, ref _reachKinds).Contains(kind);

        /// <summary>Places that are seen from further off: altars, villages, towers, the giant's bones.</summary>
        private static bool BigSite(string kind, string key) =>
            kind == "boss" || kind == "fuling" || kind == "dvergr" || kind == "trader" ||
            kind == "landmark" && (key == "tower" || key == "giant" || key == "henge" || key == "stones");

        /// <summary>Kinds that are places on the map, as against creature grounds and biome edges.</summary>
        public static bool IsPlace(string kind) => kind != "game" && kind != "foe" && kind != "biome";

        private static float F(string s) => float.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out float v) ? v : 0f;

        private static string S(float v) => v.ToString("0.#", CultureInfo.InvariantCulture);

        private static void Save(VillageHearth hearth, List<Discovery> list)
        {
            int keep = LogicConfig.KnowledgeKeep != null ? Mathf.Max(10, LogicConfig.KnowledgeKeep.Value) : 60;
            if (list.Count > keep)
            {
                // The least worth keeping goes first: mundane and old before bosses and dungeons.
                foreach (Discovery drop in list.OrderBy(d => Importance(d.Kind)).ThenBy(d => d.Day).Take(list.Count - keep).ToList())
                {
                    list.Remove(drop);
                }
            }

            hearth.Zdo.Set(KeyLog, string.Join("\n", list.Select(d => string.Join("|",
                d.Id.ToString(CultureInfo.InvariantCulture), d.Kind, d.Key, S(d.Position.x), S(d.Position.y), S(d.Position.z),
                d.Day.ToString(CultureInfo.InvariantCulture), Clean(d.Witness), d.How, d.Terrain, d.Lean, d.When))));
        }

        private static string Clean(string text) => (text ?? "").Replace("|", "").Replace("\n", "").Replace(":", "").Replace(",", "");

        public static float Importance(string kind)
        {
            switch (kind)
            {
                case "boss": return 5f;
                case "trader": return 4f;
                case "dungeon": return 3.5f;
                case "ore": return 3f;
                case "nest": return 2.5f;
                case "fuling":
                case "dvergr": return 2.5f;
                case "runestone": return 2.5f;
                case "game": return 2f;
                case "biome": return 2f;
                case "foe": return 1.5f;
                case "landmark": return 1.5f;
                case "forage": return 1.2f;
                default: return 1f;
            }
        }

        private static int IdOf(string kind, string key, Vector3 at)
        {
            // Rounded to 40 m: the same thing found twice is one discovery. Creature grounds and biome edges are one per key.
            bool one = kind == "game" || kind == "foe" || kind == "biome";
            string text = one ? $"{kind}:{key}" : $"{kind}:{key}:{Mathf.RoundToInt(at.x / 40f)}:{Mathf.RoundToInt(at.z / 40f)}";
            return text.GetStableHashCode() & 0x7fffffff;
        }

        private static Discovery Add(VillageHearth hearth, WorldSurvey.Feature feature, string witness, string how)
        {
            List<Discovery> list = Log(hearth).ToList();
            int id = IdOf(feature.Kind, feature.Key, feature.Position);
            if (Gone.TryGetValue(id, out float goneAt) && Time.time - goneAt < 900f)
            {
                // Destroyed a moment ago: the object survey may not have caught up yet.
                return null;
            }

            Discovery known = list.FirstOrDefault(d => d.Id == id);
            if (known != null)
            {
                // A villager who walks to a place the village only knew from the edge of its reach makes it firsthand.
                if (how == "went" && known.How != "went" && witness.Length > 0)
                {
                    known.How = how;
                    known.Witness = witness;
                    Save(hearth, list);
                }

                return null;
            }

            Vector3 home = hearth.transform.position;
            var d = new Discovery
            {
                Id = id, Kind = feature.Kind, Key = feature.Key, Position = feature.Position, Day = Today, Witness = witness ?? "",
                How = how, When = feature.When ?? "",
            };
            d.Terrain = WorldSurvey.Terrain(home, feature.Position, out string lean);
            d.Lean = lean;
            list.Add(d);
            Save(hearth, list);
            VillheimPlugin.Debug($"{hearth.VillageName} knows of {d.Kind} {d.Key} at {d.Position} ({how}, {d.Witness}).");
            Chronicled(hearth, d);
            return d;
        }

        /// <summary>Bosses, dungeons and traders found go in the chronicle.</summary>
        private static void Chronicled(VillageHearth hearth, Discovery d)
        {
            if (d.Kind != "boss" && d.Kind != "dungeon" && d.Kind != "trader")
            {
                return;
            }

            string who = d.Witness.Length > 0 ? d.Witness : "Someone";
            Chronicle.Add(hearth, $"{who} came back with word of {Rumors.Thing(d)}, {Rumors.Where(hearth, d)}.");
        }

        // ---------------------------------------------------------------- reach

        private static float[] Floats(string list, float[] fallback)
        {
            float[] values = (list ?? "").Split(',').Select(s => F(s.Trim())).Where(v => v > 0f).ToArray();
            return values.Length > 0 ? values : fallback;
        }

        /// <summary>The radius the village is working toward knowing: its stage's reach and its gear.</summary>
        public static float TargetReach(VillageHearth hearth, VillageState state)
        {
            float[] byStage = Floats(LogicConfig.KnowledgeReach?.Value, new[] { 200f, 400f, 650f, 900f });
            int stage = Mathf.Clamp(Living.Stage(state), 1, 4);
            float reach = byStage[Mathf.Min(stage, byStage.Length) - 1];
            float perGear = LogicConfig.KnowledgeReachPerGear != null ? LogicConfig.KnowledgeReachPerGear.Value : 60f;
            return reach + perGear * Smithing.Armoury(hearth);
        }

        /// <summary>The radius the village has explored by now.</summary>
        public static float Reach(VillageHearth hearth) => hearth != null && hearth.IsValid ? hearth.Zdo.GetFloat(KeyReach, 0f) : 0f;

        private static float GrowReach(VillageHearth hearth, VillageState state)
        {
            float target = TargetReach(hearth, state);
            float now = hearth.Zdo.GetFloat(KeyReach, 0f);
            int day = Today;
            int last = hearth.Zdo.GetInt(KeyReachDay, -1);
            if (now <= 0f)
            {
                now = Mathf.Min(target, 150f);
                hearth.Zdo.Set(KeyReach, now);
                hearth.Zdo.Set(KeyReachDay, day);
                return now;
            }

            if (last != day && now < target)
            {
                float growth = LogicConfig.KnowledgeReachGrowth != null ? LogicConfig.KnowledgeReachGrowth.Value : 150f;
                now = Mathf.Min(target, now + growth * Mathf.Clamp(day - last, 1, 5));
                hearth.Zdo.Set(KeyReach, now);
            }

            if (last != day)
            {
                hearth.Zdo.Set(KeyReachDay, day);
            }

            return now;
        }

        /// <summary>The gear tier villagers need before they go into <paramref name="biome"/>.</summary>
        public static int GearFor(Heightmap.Biome biome)
        {
            foreach (string part in (LogicConfig.KnowledgeGear?.Value ?? DefaultGear).Split(';'))
            {
                int colon = part.IndexOf(':');
                if (colon > 0 && System.Enum.TryParse(part.Substring(0, colon).Trim(), true, out Heightmap.Biome b) && b == biome &&
                    int.TryParse(part.Substring(colon + 1).Trim(), out int tier))
                {
                    return tier;
                }
            }

            return biome == Heightmap.Biome.Meadows ? 0 : 5;
        }

        public const string DefaultGear =
            "Meadows: 0; BlackForest: 2; Ocean: 1; Swamp: 4; Mountain: 4; Plains: 4; Mistlands: 5; AshLands: 5; DeepNorth: 5";

        /// <summary>The village has the gear for <paramref name="biome"/> (its own biome always counts).</summary>
        public static bool Equipped(VillageHearth hearth, VillageState state, Heightmap.Biome biome)
        {
            if (!LogicConfig.IsOn(LogicConfig.KnowledgeGearGate) || biome == state.Biome)
            {
                return true;
            }

            return Smithing.Armoury(hearth) >= GearFor(biome);
        }

        // ---------------------------------------------------------------- the survey of one village

        private sealed class Survey
        {
            public int Day = -1;
            public float Radius;
            public readonly List<WorldSurvey.Feature> Candidates = new List<WorldSurvey.Feature>();
            public readonly List<(Vector3 At, Heightmap.Biome Biome, float Height, float Forest)> Samples =
                new List<(Vector3, Heightmap.Biome, float, float)>();
            public int SampleNext;
            public bool SamplesDone;
            public bool LandAdded;
            public bool SpawnsAdded;
            public int CheckNext;
            public float NextWitness;
            public readonly Dictionary<string, (Vector3 At, float Time)> Trips = new Dictionary<string, (Vector3, float)>();
        }

        private static readonly Dictionary<int, Survey> Surveys = new Dictionary<int, Survey>();

        private const int Directions = 16;
        private const float RingStep = 80f;

        private static float MaxRadius(VillageHearth hearth, VillageState state) => TargetReach(hearth, state) + 200f;

        /// <summary>From the hearth tick (every 5 s on the hearth's owner): one slice of the survey.</summary>
        public static void Tick(VillageHearth hearth, VillageState state)
        {
            if (!On || hearth == null || !hearth.IsValid || !hearth.NView.IsOwner() || WorldGenerator.instance == null ||
                ZoneSystem.instance == null || !state.Initialized)
            {
                return;
            }

            float reach = GrowReach(hearth, state);
            WorldSurvey.ObjectTick();
            Survey survey = SurveyOf(hearth, state);
            SampleLand(hearth, survey);
            CheckCandidates(hearth, state, survey, reach, 12);
            if (Time.time >= survey.NextWitness)
            {
                survey.NextWitness = Time.time + 5f;
                Witnesses(hearth, state, survey);
                CheckGone(hearth);
            }

            MapTables.Ensure(hearth, state);
        }

        private static Survey SurveyOf(VillageHearth hearth, VillageState state)
        {
            int id = hearth.VillageId;
            float radius = MaxRadius(hearth, state);
            if (Surveys.TryGetValue(id, out Survey survey) && survey.Day == Today && survey.Radius >= radius - 1f)
            {
                return survey;
            }

            // Once a game day, or when the reach has grown: the list of candidates is made again.
            bool keepLand = survey != null && survey.Radius >= radius - 1f && survey.SamplesDone;
            Survey fresh = new Survey { Day = Today, Radius = radius };
            if (keepLand)
            {
                fresh.Samples.AddRange(survey.Samples);
                fresh.SamplesDone = true;
                foreach (var trip in survey.Trips)
                {
                    fresh.Trips[trip.Key] = trip.Value;
                }
            }

            Vector3 home = hearth.transform.position;
            fresh.Candidates.AddRange(WorldSurvey.LocationsNear(home, radius).Where(f => Notable(f.Kind, f.Key)));
            fresh.Candidates.AddRange(WorldSurvey.ObjectsNear(home, radius, 3).Where(f => Notable(f.Kind, f.Key)).Select(f => f.Copy()));
            foreach (Vector3 extra in ExtraCenters(hearth))
            {
                fresh.Candidates.AddRange(WorldSurvey.LocationsNear(extra, ExtraRadius)
                    .Where(f => Notable(f.Kind, f.Key) && Utils.DistanceXZ(f.Position, home) > radius));
                fresh.Candidates.AddRange(WorldSurvey.ObjectsNear(extra, ExtraRadius, 2)
                    .Where(f => Notable(f.Kind, f.Key) && Utils.DistanceXZ(f.Position, home) > radius).Select(f => f.Copy()));
            }

            Surveys[id] = fresh;
            return fresh;
        }

        private const float ExtraRadius = 250f;
        private const float TrailCorridor = 120f;

        /// <summary>Outpost camps and daughter villages: places the village's people live away from home.</summary>
        private static IEnumerable<Vector3> ExtraCenters(VillageHearth hearth)
        {
            foreach (Vector3 camp in Outposts.Positions(hearth))
            {
                yield return camp;
            }

            int id = hearth.VillageId;
            foreach (ZDO daughter in Relations.AllHearths().Where(z => z.GetInt(Daughters.KeyParent) == id))
            {
                yield return daughter.GetPosition();
            }
        }

        /// <summary>The land in rings round the hearth, a slice at a time: biomes, heights and forest.</summary>
        private static void SampleLand(VillageHearth hearth, Survey survey)
        {
            if (survey.SamplesDone)
            {
                if (!survey.LandAdded)
                {
                    survey.LandAdded = true;
                    AddEdges(hearth, survey);
                }

                // The spawn lists may not be there in the first seconds after loading: tried again until they are.
                if (!survey.SpawnsAdded && WorldSurvey.Spawns().Count > 0)
                {
                    survey.SpawnsAdded = true;
                    AddGrounds(hearth, survey);
                }

                return;
            }

            Vector3 home = hearth.transform.position;
            int rings = Mathf.CeilToInt(survey.Radius / RingStep);
            int total = rings * Directions;
            for (int i = 0; i < 48 && survey.SampleNext < total; i++, survey.SampleNext++)
            {
                int ring = survey.SampleNext / Directions + 1;
                int dir = survey.SampleNext % Directions;
                // Every other ring turned half a step, so the samples spread evenly.
                float angle = (dir + (ring % 2) * 0.5f) * 360f / Directions;
                Vector3 at = home + Quaternion.Euler(0f, angle, 0f) * Vector3.forward * (ring * RingStep);
                at.y = WorldSurvey.Height(at);
                survey.Samples.Add((at, WorldSurvey.Biome(at), at.y, WorldSurvey.Forest(at)));
            }

            if (survey.SampleNext >= total)
            {
                survey.SamplesDone = true;
            }
        }

        /// <summary>Biome edges: the nearest sample of each other biome.</summary>
        private static void AddEdges(VillageHearth hearth, Survey survey)
        {
            Vector3 home = hearth.transform.position;
            Heightmap.Biome own = WorldSurvey.Biome(home);
            var edges = new Dictionary<Heightmap.Biome, Vector3>();
            foreach (var s in survey.Samples.OrderBy(s => Utils.DistanceXZ(s.At, home)))
            {
                if (s.Biome != own && s.Biome != Heightmap.Biome.None && !edges.ContainsKey(s.Biome))
                {
                    edges[s.Biome] = s.At;
                }
            }

            foreach (KeyValuePair<Heightmap.Biome, Vector3> edge in edges.Where(e => Notable("biome", e.Key.ToString().ToLowerInvariant())))
            {
                survey.Candidates.Add(new WorldSurvey.Feature { Kind = "biome", Key = edge.Key.ToString().ToLowerInvariant(), Position = edge.Value });
            }
        }

        /// <summary>The nearest sampled ground each creature can come out on.</summary>
        private static void AddGrounds(VillageHearth hearth, Survey survey)
        {
            Vector3 home = hearth.transform.position;
            var nearestFirst = survey.Samples.OrderBy(s => Utils.DistanceXZ(s.At, home)).ToList();
            foreach (WorldSurvey.Spawn spawn in WorldSurvey.Spawns())
            {
                foreach (var s in nearestFirst)
                {
                    if (WorldSurvey.CanSpawnAt(spawn, s.Biome, s.Height, s.Forest) && Notable(spawn.Game ? "game" : "foe", spawn.Key))
                    {
                        string when = spawn.Day && spawn.Night ? "any" : spawn.Night ? "night" : "day";
                        survey.Candidates.Add(new WorldSurvey.Feature
                        {
                            Kind = spawn.Game ? "game" : "foe", Key = spawn.Key, Position = s.At, When = when,
                        });
                        break;
                    }
                }
            }
        }

        /// <summary>Checks a few candidates against the reach, the camps and the trails.</summary>
        private static void CheckCandidates(VillageHearth hearth, VillageState state, Survey survey, float reach, int count)
        {
            if (survey.Candidates.Count == 0)
            {
                return;
            }

            Vector3 home = hearth.transform.position;
            var known = new HashSet<int>(Log(hearth).Select(d => d.Id));
            int tier = Smithing.Armoury(hearth);
            for (int i = 0; i < count && i < survey.Candidates.Count; i++)
            {
                survey.CheckNext = (survey.CheckNext + 1) % survey.Candidates.Count;
                WorldSurvey.Feature f = survey.Candidates[survey.CheckNext];
                if (f.Id == 0)
                {
                    f.Id = IdOf(f.Kind, f.Key, f.Position);
                }

                if (known.Contains(f.Id))
                {
                    continue;
                }

                string how = Covered(hearth, state, f, home, reach, tier);
                if (how != null)
                {
                    Add(hearth, f, how == "reach" || how == "spotted" ? WitnessFor(hearth, survey, f) : "", how);
                    known.Add(f.Id);
                }
            }
        }

        /// <summary>
        /// How the village comes to know <paramref name="f"/> without anyone walking right up to it, or null. Only for
        /// the reach kinds (creature grounds, biome edges): places need a villager to go there (Witnesses).
        /// </summary>
        private static string Covered(VillageHearth hearth, VillageState state, WorldSurvey.Feature f, Vector3 home, float reach, int tier)
        {
            if (!ByReach(f.Kind))
            {
                return null;
            }

            float distance = Utils.DistanceXZ(f.Position, home);
            if (distance <= reach)
            {
                // The walk out is worked out once per gear tier: it samples the land along the way.
                if (f.AccessTier != tier || f.Access == null)
                {
                    f.AccessTier = tier;
                    f.Access = Ventured(hearth, state, home, f.Position) ? "reach"
                        : Visible(f.Kind) && SpottedFromEdge(hearth, state, home, f.Position) ? "spotted" : "no";
                }

                if (f.Access != "no")
                {
                    return f.Access;
                }
            }

            foreach (Vector3 camp in Outposts.Positions(hearth))
            {
                if (Utils.DistanceXZ(camp, f.Position) <= ExtraRadius && Equipped(hearth, state, WorldSurvey.Biome(f.Position)))
                {
                    return "camp";
                }
            }

            int id = hearth.VillageId;
            foreach (ZDO daughter in Relations.AllHearths().Where(z => z.GetInt(Daughters.KeyParent) == id))
            {
                if (Utils.DistanceXZ(daughter.GetPosition(), f.Position) <= ExtraRadius)
                {
                    return "daughter";
                }
            }

            foreach (List<Vector3> trail in TrailsOf(hearth))
            {
                if (trail.Any(p => Utils.DistanceXZ(p, f.Position) <= TrailCorridor) && Equipped(hearth, state, WorldSurvey.Biome(f.Position)))
                {
                    return "trail";
                }
            }

            return null;
        }

        private static readonly Dictionary<int, (float At, List<List<Vector3>> Trails)> TrailCache = new Dictionary<int, (float, List<List<Vector3>>)>();

        private static List<List<Vector3>> TrailsOf(VillageHearth hearth)
        {
            if (TrailCache.TryGetValue(hearth.VillageId, out var cached) && Time.time - cached.At < 60f)
            {
                return cached.Trails;
            }

            var trails = new List<List<Vector3>>();
            for (int i = 0; i < 2; i++)
            {
                List<Vector3> t = Trails.ToOutpost(hearth.Zdo, i);
                if (t != null) trails.Add(t);
            }

            foreach (ZDO other in Relations.AllHearths().Where(z => z != hearth.Zdo))
            {
                List<Vector3> t = Trails.Between(hearth.Zdo, other);
                if (t != null) trails.Add(t);
            }

            TrailCache[hearth.VillageId] = (Time.time, trails);
            return trails;
        }

        private static bool Visible(string kind) =>
            kind == "boss" || kind == "landmark" || kind == "fuling" || kind == "dvergr" || kind == "ruin" || kind == "biome" ||
            kind == "trader" || kind == "game" || kind == "foe";

        /// <summary>The villagers could walk there: they have the gear for the biome and no long water is in the way.</summary>
        public static bool Ventured(VillageHearth hearth, VillageState state, Vector3 home, Vector3 at)
        {
            if (!Equipped(hearth, state, WorldSurvey.Biome(at)))
            {
                return false;
            }

            return WorldSurvey.WaterOnTheWay(home, at) < 120f;
        }

        /// <summary>
        /// Something big past the gear line or across water, within KnowledgeSight of the last ground the villagers
        /// would walk to on the straight line out.
        /// </summary>
        private static bool SpottedFromEdge(VillageHearth hearth, VillageState state, Vector3 home, Vector3 at)
        {
            float sight = LogicConfig.KnowledgeSight != null ? LogicConfig.KnowledgeSight.Value : 100f;
            float distance = Utils.DistanceXZ(home, at);
            if (sight <= 0f || distance <= 1f)
            {
                return false;
            }

            float water = WorldSurvey.WaterLevel;
            int n = Mathf.Clamp(Mathf.RoundToInt(distance / 50f), 2, 40);
            float lastSafe = 0f;
            for (int i = 1; i < n; i++)
            {
                Vector3 p = Vector3.Lerp(home, at, i / (float)n);
                if (WorldSurvey.Height(p) < water - 1f || !Equipped(hearth, state, WorldSurvey.Biome(p)))
                {
                    break;
                }

                lastSafe = distance * i / n;
            }

            // Across the water a little further: from the shore you see a long way.
            float across = WorldSurvey.WaterOnTheWay(home, at) > 120f ? 2f : 1f;
            return distance - lastSafe <= sight * across;
        }

        // ---------------------------------------------------------------- witnesses

        /// <summary>
        /// The villager whose work took him nearest to the place lately, or one whose trade fits it (a protector for
        /// creatures and nests, a miner for ore, a woodcutter for the land), the same one for the same place.
        /// </summary>
        private static string WitnessFor(VillageHearth hearth, Survey survey, WorldSurvey.Feature f)
        {
            string best = null;
            float bestDistance = float.MaxValue;
            foreach (KeyValuePair<string, (Vector3 At, float Time)> trip in survey.Trips)
            {
                float d = Utils.DistanceXZ(trip.Value.At, f.Position);
                if (Time.time - trip.Value.Time < 3600f && d < bestDistance)
                {
                    best = trip.Key;
                    bestDistance = d;
                }
            }

            if (best != null)
            {
                return best;
            }

            List<Villager> people = Character.GetAllCharacters().OfType<Villager>()
                .Where(v => !v.IsDead() && v.VillageId == hearth.VillageId && !Childhood.IsChild(v))
                .OrderBy(v => v.VillagerName).ToList();
            if (people.Count == 0)
            {
                return "";
            }

            List<Villager> fit = people.Where(v => Fits(v, f.Kind)).ToList();
            List<Villager> from = fit.Count > 0 ? fit : people;
            int pick = (IdOf(f.Kind, f.Key, f.Position) & 0xffff) % from.Count;
            return from[pick].VillagerName;
        }

        private static bool Fits(Villager v, string kind)
        {
            Roles.Trade trade = Roles.TradeOf(v);
            bool protector = Roles.BackgroundOf(v) == Roles.Background.Protector;
            switch (kind)
            {
                case "game":
                case "foe":
                case "nest":
                case "dungeon":
                case "boss": return protector;
                case "ore": return trade == Roles.Trade.Miner;
                case "forage": return trade == Roles.Trade.Cook || trade == Roles.Trade.Farmer || !protector;
                case "biome":
                case "landmark":
                case "ruin": return trade == Roles.Trade.Woodcutter || protector;
                default: return true;
            }
        }

        /// <summary>Villagers out past the village edge: their trips are noted, and what they walk near is found.</summary>
        private static void Witnesses(VillageHearth hearth, VillageState state, Survey survey)
        {
            float within = LogicConfig.KnowledgeNear != null ? LogicConfig.KnowledgeNear.Value : 35f;
            float radius = VillheimConfig.VillageRadius != null ? VillheimConfig.VillageRadius.Value : 60f;
            Vector3 home = hearth.transform.position;
            int id = hearth.VillageId;
            foreach (Villager v in Character.GetAllCharacters().OfType<Villager>())
            {
                if (v.IsDead() || v.Zdo == null || Childhood.IsChild(v) || Sleep.IsAsleep(v))
                {
                    continue;
                }

                bool ours = v.VillageId == id ||
                            (Wanderers.KindOf(v) == Wanderers.Camper && v.Zdo.GetInt(Wanderers.KeyVisit) == id);
                Vector3 at = v.transform.position;
                if (!ours || Utils.DistanceXZ(at, home) < radius * 1.1f)
                {
                    continue;
                }

                string name = v.VillagerName;
                if (!survey.Trips.TryGetValue(name, out var trip) || Utils.DistanceXZ(trip.At, home) <= Utils.DistanceXZ(at, home) ||
                    Time.time - trip.Time > 600f)
                {
                    survey.Trips[name] = (at, Time.time);
                }

                // Objects (nests, ore, hives) right where he walks, besides the nearest few of each on the candidate list.
                foreach (WorldSurvey.Feature f in WorldSurvey.ObjectsAround(at, within))
                {
                    if (Notable(f.Kind, f.Key) && Add(hearth, f, name, "went") is Discovery found)
                    {
                        Found(v, found);
                    }
                }

                foreach (WorldSurvey.Feature f in survey.Candidates)
                {
                    // Big sites are seen from a little further off than a rock or a hive.
                    float reachOfEye = BigSite(f.Kind, f.Key) ? within * 1.5f : within;
                    if (Utils.DistanceXZ(f.Position, at) <= reachOfEye)
                    {
                        Discovery d = Add(hearth, f, name, "went");
                        if (d != null)
                        {
                            Found(v, d);
                        }
                    }
                }
            }
        }

        // ---------------------------------------------------------------- gone

        /// <summary>Discoveries of objects that were destroyed (a nest broken, a deposit mined out): id to when.</summary>
        private static readonly Dictionary<int, float> Gone = new Dictionary<int, float>();

        /// <summary>Discoveries whose object was missing at the last look: id to when, so one miss is not enough.</summary>
        private static readonly Dictionary<int, float> Missing = new Dictionary<int, float>();

        /// <summary>
        /// Object discoveries (nests, ore, hives) in a loaded zone with a player near: if the object is not there on two
        /// looks 20 s apart, it was destroyed and the village forgets it.
        /// </summary>
        private static void CheckGone(VillageHearth hearth)
        {
            Player player = Player.m_localPlayer;
            if (player == null)
            {
                return;
            }

            List<Discovery> list = null;
            foreach (Discovery d in Log(hearth))
            {
                string prefab = WorldSurvey.ObjectPrefab(d.Kind, d.Key);
                if (prefab == null || Utils.DistanceXZ(d.Position, player.transform.position) > 80f ||
                    !ZoneSystem.instance.IsZoneLoaded(d.Position))
                {
                    continue;
                }

                if (ObjectThere(d.Position, prefab))
                {
                    Missing.Remove(d.Id);
                    continue;
                }

                if (!Missing.TryGetValue(d.Id, out float since))
                {
                    Missing[d.Id] = Time.time;
                    continue;
                }

                if (Time.time - since >= 20f)
                {
                    Missing.Remove(d.Id);
                    Gone[d.Id] = Time.time;
                    (list = list ?? Log(hearth).ToList()).RemoveAll(x => x.Id == d.Id);
                    VillheimPlugin.Debug($"{hearth.VillageName} forgets {d.Kind} {d.Key} at {d.Position}: it is gone.");
                }
            }

            if (list != null)
            {
                Save(hearth, list);
            }
        }

        private static readonly Collider[] Hits = new Collider[64];

        private static bool ObjectThere(Vector3 at, string prefab)
        {
            int n = Physics.OverlapSphereNonAlloc(at + Vector3.up, 5f, Hits);
            for (int i = 0; i < n; i++)
            {
                ZNetView view = Hits[i] != null ? Hits[i].GetComponentInParent<ZNetView>() : null;
                if (view != null && view.gameObject.name.StartsWith(prefab, System.StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }

            return false;
        }

        /// <summary>A villager has just found something himself: he says so if a player is near.</summary>
        private static void Found(Villager v, Discovery d)
        {
            Rumors.Focus(v, d.Id);
            if (Player.m_localPlayer != null && Vector3.Distance(Player.m_localPlayer.transform.position, v.transform.position) < 30f)
            {
                Dialogue.QueueLine(v, "self", "rumor:new", new[] { "rumor:new" }, Random.Range(1f, 3f));
            }
        }

        // ---------------------------------------------------------------- who knows

        /// <summary>The discoveries this villager has heard of from others: id to teller.</summary>
        public static Dictionary<int, string> Heard(Villager villager)
        {
            var heard = new Dictionary<int, string>();
            foreach (string part in (villager.Zdo?.GetString(KeyHeard, "") ?? "").Split(','))
            {
                int colon = part.IndexOf(':');
                if (colon > 0 && int.TryParse(part.Substring(0, colon), NumberStyles.Integer, CultureInfo.InvariantCulture, out int id))
                {
                    heard[id] = part.Substring(colon + 1);
                }
            }

            return heard;
        }

        private static void SaveHeard(Villager villager, Dictionary<int, string> heard, int newest)
        {
            if (villager.Zdo == null || villager.m_nview == null || !villager.m_nview.IsOwner())
            {
                return;
            }

            List<KeyValuePair<int, string>> list = heard.Where(h => h.Key != newest).ToList();
            if (heard.TryGetValue(newest, out string teller))
            {
                list.Add(new KeyValuePair<int, string>(newest, teller));
            }

            if (list.Count > KeepHeard)
            {
                list.RemoveRange(0, list.Count - KeepHeard);
            }

            villager.Zdo.Set(KeyHeard, string.Join(",", list.Select(h => $"{h.Key.ToString(CultureInfo.InvariantCulture)}:{Clean(h.Value)}")));
        }

        /// <summary>saw, heard or common for a villager who knows of <paramref name="d"/>; null if he does not.</summary>
        public static string Form(Villager villager, Discovery d, Dictionary<int, string> heard, out string teller)
        {
            teller = null;
            if (d.Witness.Length > 0 && d.Witness == villager.VillagerName && d.Firsthand)
            {
                return "saw";
            }

            if (heard != null && heard.TryGetValue(d.Id, out teller))
            {
                return "heard";
            }

            int common = LogicConfig.KnowledgeCommonDays != null ? LogicConfig.KnowledgeCommonDays.Value : 2;
            return Today - d.Day >= common || d.Witness.Length == 0 && d.How != "went" ? "common" : null;
        }

        /// <summary>
        /// In a chat in the village, the speaker passes on one thing he knows that the listener does not, the newest
        /// first. Returns "rumor" for the chat's opening tag, or null.
        /// </summary>
        public static string Gossip(Villager speaker, Villager listener)
        {
            if (!On || speaker == null || listener == null || speaker.VillageId != listener.VillageId)
            {
                return null;
            }

            VillageHearth hearth = VillageHearth.Find(speaker.VillageId);
            float radius = VillheimConfig.VillageRadius != null ? VillheimConfig.VillageRadius.Value : 60f;
            if (hearth == null || !hearth.IsValid || Utils.DistanceXZ(speaker.transform.position, hearth.transform.position) > radius * 1.2f)
            {
                return null;
            }

            Dictionary<int, string> mine = Heard(speaker), theirs = Heard(listener);
            foreach (Discovery d in Log(hearth).AsEnumerable().Reverse())
            {
                if (Form(speaker, d, mine, out _) is string form && form != "common" &&
                    Form(listener, d, theirs, out _) == null)
                {
                    theirs[d.Id] = speaker.VillagerName;
                    SaveHeard(listener, theirs, d.Id);
                    Rumors.Focus(speaker, d.Id);
                    return "rumor";
                }
            }

            return null;
        }

        // ---------------------------------------------------------------- work reach

        private static readonly Dictionary<int, (float At, float Factor, int Armoury, Heightmap.Biome Biome)> WorkCache =
            new Dictionary<int, (float, float, int, Heightmap.Biome)>();

        private static (float Factor, int Armoury, Heightmap.Biome Biome) WorkInfo(int villageId)
        {
            if (WorkCache.TryGetValue(villageId, out var c) && Time.time - c.At < 10f)
            {
                return (c.Factor, c.Armoury, c.Biome);
            }

            VillageHearth hearth = VillageHearth.Find(villageId);
            if (hearth == null || !hearth.IsValid)
            {
                return (1f, 0, Heightmap.Biome.Meadows);
            }

            var state = new VillageState(hearth.Zdo);
            float[] factors = Floats(LogicConfig.HarvestReachByStage?.Value, new[] { 1f, 1.15f, 1.35f, 1.6f });
            int stage = Mathf.Clamp(Living.Stage(state), 1, 4);
            float factor = factors[Mathf.Min(stage, factors.Length) - 1];
            var info = (Time.time, factor, Smithing.Armoury(hearth), state.Biome);
            WorkCache[villageId] = info;
            return (info.Item2, info.Item3, info.Item4);
        }

        /// <summary>
        /// How far from the hearth a villager of this village works (fells, mines, hunts, forages): the job's own radius
        /// grown by the village's stage (HarvestReachByStage), at most HarvestReachMax.
        /// </summary>
        public static float WorkRadius(int villageId, float baseRadius)
        {
            if (!On || !LogicConfig.IsOn(LogicConfig.HarvestReach) || villageId == 0)
            {
                return baseRadius;
            }

            float max = LogicConfig.HarvestReachMax != null ? LogicConfig.HarvestReachMax.Value : 90f;
            return Mathf.Max(baseRadius, Mathf.Min(baseRadius * WorkInfo(villageId).Factor, max));
        }

        /// <summary>
        /// Whether a villager may go to work at <paramref name="at"/>: anything within <paramref name="inner"/> m of the
        /// hearth, and past that only ground in a biome the village has the gear for.
        /// </summary>
        public static bool MayWork(int villageId, Vector3 hearth, Vector3 at, float inner)
        {
            // Fuling camps, tar pits and the like are kept clear of, whatever the gear (KeepApart, T-24).
            if (KeepApart.Avoids(villageId, hearth, at))
            {
                return false;
            }

            if (!On || !LogicConfig.IsOn(LogicConfig.KnowledgeGearGate) || villageId == 0 || Utils.DistanceXZ(hearth, at) <= inner)
            {
                return true;
            }

            (float _, int armoury, Heightmap.Biome own) = WorkInfo(villageId);
            Heightmap.Biome biome = WorldSurvey.Biome(at);
            return biome == own || armoury >= GearFor(biome);
        }

        // ---------------------------------------------------------------- requests

        // Material (prefab) to what to look for: a discovery kind and key, or a biome.
        private static readonly Dictionary<string, (string Kind, string Key)> MaterialSources = new Dictionary<string, (string, string)>
        {
            ["CopperOre"] = ("ore", "copper"), ["Copper"] = ("ore", "copper"), ["TinOre"] = ("ore", "tin"), ["Tin"] = ("ore", "tin"),
            ["Bronze"] = ("ore", "copper"), ["IronScrap"] = ("dungeon", "sunkencrypt"), ["Iron"] = ("dungeon", "sunkencrypt"),
            ["SilverOre"] = ("ore", "silver"), ["Silver"] = ("ore", "silver"), ["Obsidian"] = ("ore", "obsidian"),
            ["RoundLog"] = ("biome", "blackforest"), ["Resin"] = ("biome", "blackforest"), ["ElderBark"] = ("biome", "swamp"),
            ["FineWood"] = ("biome", "meadows"), ["Flint"] = ("biome", "ocean"), ["Guck"] = ("biome", "swamp"),
            ["DeerHide"] = ("game", "deer"), ["LeatherScraps"] = ("runestone", "boars"), ["RawMeat"] = ("runestone", "boars"),
            ["DeerMeat"] = ("game", "deer"), ["NeckTail"] = ("game", "neck"), ["TrollHide"] = ("foe", "troll"),
            ["BoneFragments"] = ("foe", "skeleton"), ["WolfPelt"] = ("foe", "wolf"), ["Raspberry"] = ("forage", "raspberries"),
            ["Blueberries"] = ("forage", "blueberries"), ["Honey"] = ("forage", "beehive"), ["GreydwarfEye"] = ("runestone", "greydwarfs"),
            ["Coal"] = ("foe", "surtling"),
        };

        /// <summary>Where the village believes a material can be had: the nearest discovery that gives it, or null.</summary>
        public static Discovery SourceOf(VillageHearth hearth, string material)
        {
            if (!On || hearth == null || material == null || !MaterialSources.TryGetValue(material, out var source))
            {
                return null;
            }

            Vector3 home = hearth.transform.position;
            Discovery best = Log(hearth).Where(d => d.Kind == source.Kind && d.Key == source.Key)
                .OrderBy(d => Utils.DistanceXZ(d.Position, home)).FirstOrDefault();
            if (best == null && Fallbacks.TryGetValue(source, out var fallback))
            {
                best = Log(hearth).Where(d => d.Kind == fallback.Kind && d.Key == fallback.Key)
                    .OrderBy(d => Utils.DistanceXZ(d.Position, home)).FirstOrDefault();
            }

            return best;
        }

        // A runestone with creatures round it is a sure place; failing that, where the creature is known to come out.
        private static readonly Dictionary<(string, string), (string Kind, string Key)> Fallbacks = new Dictionary<(string, string), (string, string)>
        {
            [("runestone", "boars")] = ("game", "boar"),
            [("runestone", "greydwarfs")] = ("foe", "greydwarf"),
        };

        /// <summary>Whether this material is one the village would look for out in the land.</summary>
        public static bool Sought(string material) => material != null && MaterialSources.ContainsKey(material);

        /// <summary>Meat: the nearest ground for deer or boar (or any game) the village knows.</summary>
        public static Discovery MeatGround(VillageHearth hearth)
        {
            if (!On || hearth == null)
            {
                return null;
            }

            // The boar runestone first: there are always boar round it.
            Vector3 home = hearth.transform.position;
            return Log(hearth).Where(d => d.Kind == "game" || d.Kind == "runestone" && d.Key == "boars")
                .OrderBy(d => d.Kind == "runestone" ? 0 : d.Key == "deer" || d.Key == "boar" ? 1 : 2)
                .ThenBy(d => Utils.DistanceXZ(d.Position, home)).FirstOrDefault();
        }

        // ---------------------------------------------------------------- commands

        /// <summary>'vh know [list|reach|survey|rumors|names|table|forget]' at the nearest village within 300 m.</summary>
        public static string Command(string[] args)
        {
            Player player = Player.m_localPlayer;
            VillageHearth hearth = player != null ? VillageHearth.Closest(player.transform.position, 300f) : null;
            if (hearth == null)
            {
                return "No village within 300 m.";
            }

            string what = args != null && args.Length > 0 ? args[0].ToLowerInvariant() : "list";
            var state = new VillageState(hearth.Zdo);
            switch (what)
            {
                case "reach": return ReachReport(hearth, state);
                case "survey":
                {
                    bool full = args.Length > 1 && args[1] == "full";
                    return SurveyNow(hearth, state, full) + (full ? "" : " 'vh know survey full' sets the reach to its target first.");
                }
                case "rumors":
                case "rumours":
                case "lines": return Rumors.Samples(hearth, args.Length > 1 && int.TryParse(args[1], out int n) ? n : 8);
                case "names": return $"Locations within {MaxRadius(hearth, state):0} m of {hearth.VillageName}:\n" +
                                     WorldSurvey.Names(hearth.transform.position, MaxRadius(hearth, state));
                case "table": return MapTables.Command(hearth, state);
                case "forget":
                    if (!hearth.NView.IsOwner()) hearth.NView.ClaimOwnership();
                    hearth.Zdo.Set(KeyLog, "");
                    hearth.Zdo.Set(KeyReach, 0f);
                    Surveys.Remove(hearth.VillageId);
                    return $"{hearth.VillageName} has forgotten everything it knew of the land.";
                default: return List(hearth, state);
            }
        }

        /// <summary>
        /// Runs the village's survey to the end now (a short hitch). With <paramref name="full"/>, the explored radius
        /// is set to the village's reach first. Returns what was found.
        /// </summary>
        public static string SurveyNow(VillageHearth hearth, VillageState state, bool full)
        {
            if (!hearth.NView.IsOwner()) hearth.NView.ClaimOwnership();
            Surveys.Remove(hearth.VillageId);
            WorldSurvey.SweepNow();
            float target = TargetReach(hearth, state);
            if (full)
            {
                hearth.Zdo.Set(KeyReach, target);
                hearth.Zdo.Set(KeyReachDay, Today);
            }

            Survey survey = SurveyOf(hearth, state);
            for (int i = 0; i < 200 && !survey.SamplesDone; i++) SampleLand(hearth, survey);
            SampleLand(hearth, survey);
            int before = Log(hearth).Count;
            CheckCandidates(hearth, state, survey, Reach(hearth), survey.Candidates.Count);
            return $"{hearth.VillageName}: surveyed {survey.Candidates.Count} candidates within {survey.Radius:0} m " +
                   $"({WorldSurvey.ObjectCount} objects known in the world so far; the object sweep runs again in the background). " +
                   $"{Log(hearth).Count - before} new discoveries. Reach {Reach(hearth):0} of {target:0} m.";
        }

        private static string ReachReport(VillageHearth hearth, VillageState state)
        {
            var lines = new List<string>
            {
                $"{hearth.VillageName}: explored {Reach(hearth):0} m of {TargetReach(hearth, state):0} m (stage {Living.Stage(state)}, gear tier " +
                $"{Smithing.Armoury(hearth)} {Smithing.TierName(Smithing.Armoury(hearth))}). Work radius x{WorkInfo(hearth.VillageId).Factor:0.##} " +
                $"(felling {WorkRadius(hearth.VillageId, 55f):0} m, hunting {WorkRadius(hearth.VillageId, 45f):0} m).",
            };
            foreach (Heightmap.Biome b in new[]
                     {
                         Heightmap.Biome.Meadows, Heightmap.Biome.BlackForest, Heightmap.Biome.Ocean, Heightmap.Biome.Swamp,
                         Heightmap.Biome.Mountain, Heightmap.Biome.Plains, Heightmap.Biome.Mistlands,
                     })
            {
                lines.Add($"   {b}: needs tier {GearFor(b)}, {(Equipped(hearth, state, b) ? "they go there" : "they stay out")}");
            }

            List<Vector3> camps = Outposts.Positions(hearth);
            lines.Add($"   Camps widening it: {camps.Count}; trails: {TrailsOf(hearth).Count}; daughters: " +
                      $"{Relations.AllHearths().Count(z => z.GetInt(Daughters.KeyParent) == hearth.VillageId)}.");
            if (Surveys.TryGetValue(hearth.VillageId, out Survey s))
            {
                lines.Add($"   Survey: {s.Candidates.Count} candidates within {s.Radius:0} m, land {(s.SamplesDone ? "sampled" : $"{s.SampleNext} samples so far")}, " +
                          $"{s.Trips.Count} villagers seen out on trips.");
            }

            return string.Join("\n", lines);
        }

        private static string List(VillageHearth hearth, VillageState state)
        {
            List<Discovery> log = Log(hearth);
            Vector3 home = hearth.transform.position;
            var lines = new List<string>
            {
                $"{hearth.VillageName} knows {log.Count} things (reach {Reach(hearth):0} m, day {Today}; places found within " +
                $"{(LogicConfig.KnowledgeNear != null ? LogicConfig.KnowledgeNear.Value : 35f):0} m of a villager):",
            };
            foreach (Discovery d in log.OrderBy(d => Utils.DistanceXZ(d.Position, home)))
            {
                float distance = Utils.DistanceXZ(d.Position, home);
                lines.Add($"   {d.Kind} {d.Key}{(d.When.Length > 0 ? " (" + d.When + ")" : "")}: {distance:0} m {WorldSurvey.Compass(d.Position - home)}, " +
                          $"{d.Terrain}{(d.Lean.Length > 0 ? "/" + d.Lean : "")}, day {d.Day}, {d.How}" +
                          $"{(IsPlace(d.Kind) ? (MapTables.Shows(hearth, d) ? ", on the map" : ", left off the map") : "")}" +
                          $"{(d.Witness.Length > 0 ? " by " + d.Witness : "")} at ({d.Position.x:0}, {d.Position.z:0})");
            }

            lines.Add("'vh know reach', 'vh know survey [full]', 'vh know rumors [n]', 'vh know names', 'vh know table', 'vh know forget'.");
            return string.Join("\n", lines);
        }
    }
}
