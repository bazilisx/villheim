using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Villagers;
using Villheim.Prefabs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// A grown village sends a few people out to a camp where the land gives what its own biome lacks, after
    /// Millenaire's hamlets and Living Factions' outposts (the rules, not the code).
    ///
    /// - A village with at least four buildings and four villagers, with WorldLife and Outposts on, founds up to two
    ///   outposts (OutpostsPerVillage), one of each kind, and tries again once a day:
    ///   - a logging camp in the nearest other wood biome: a Meadows village in the Black Forest (core wood), a Black
    ///     Forest village in the Meadows (fine wood), 150 to 700 m out, 25 m inside that biome, on dry ground;
    ///   - a flint camp on the nearest shore of its own biome (or the Meadows), when the gear the smith wants next
    ///     needs flint (the flint spear), 100 to 700 m out. Flint is how a Meadows village gets to the gear it needs
    ///     for the Black Forest, as a player does.
    ///   Sites are planned from the world generator, so no zone needs to be loaded.
    /// - Nobody goes out before they can look after themselves (Tyler, 2026-11-08): the village must have made the gear
    ///   tier OutpostGear asks for that biome (Black Forest: flint and leather, tier 2) before the camp is founded.
    ///   Until then the village waits, and says so in its chronicle every five days.
    /// - What the camps send counts toward what the village can build (OutpostMaterials, on by default): a Meadows
    ///   village with a logging camp in the Black Forest builds designs that need core wood (Materials.From).
    /// - Each day a camp gathers (10 wood or 5 flint, catching up at most three days) into its own stock. When the
    ///   stock reaches OutpostCarryAt (12, as in Living Factions), a camper carries it home along the camp's trail as
    ///   a haul caravan (Caravans.cs), on the world clock, a real person walking when a player is near. The load goes
    ///   into the village stock, then the chest, when it arrives. With Caravans off the load goes straight home.
    /// - The camp itself (a fire pit and two campers who potter about it and sit by the fire at night) is made the
    ///   first time a player comes within 150 m of the site, on the host.
    ///
    /// Not yet: huts and a workshop at the camp (small Work designs from the board), mining and fishing camps.
    /// </summary>
    internal static class Outposts
    {
        private static readonly int KeyOutpost = "villheim_outpost".GetStableHashCode();
        public static readonly int KeyOutpostVillage = "villheim_outpostvillage".GetStableHashCode();
        private static readonly int KeyTried = "villheim_outposttried".GetStableHashCode();
        private static readonly int KeyGearNoted = "villheim_outpostgearnoted".GetStableHashCode();
        private const int Campers = 2;

        public const string Logging = "logging camp";
        public const string FlintCamp = "flint camp";

        public const string DefaultGear = "Meadows: 0; BlackForest: 2; Swamp: 4; Mountain: 4; Plains: 4; Ocean: 1";

        private sealed class Outpost
        {
            public Vector3 Position;
            public string Kind;
            public string Material;
            public int Founded;
            public int LastHaul;
            public int Stock;
            public Heightmap.Biome Biome;
        }

        private static int Today => EnvMan.instance != null ? EnvMan.instance.GetDay() : 0;

        private static bool On => LogicConfig.WorldLife != null && LogicConfig.WorldLife.Value &&
                                  (LogicConfig.Outposts == null || LogicConfig.Outposts.Value);

        private static bool CaravansOn => LogicConfig.WorldLife != null && LogicConfig.WorldLife.Value &&
                                          (LogicConfig.Caravans == null || LogicConfig.Caravans.Value);

        private static int PerDay(Outpost outpost) => outpost.Material == "Flint" ? 5 : 10;

        // ---------------------------------------------------------------- saved on the hearth, one line per camp

        private static List<Outpost> ReadAll(ZDO zdo)
        {
            var list = new List<Outpost>();
            foreach (string line in zdo.GetString(KeyOutpost, "").Split('\n'))
            {
                string[] parts = line.Split('|');
                if (parts.Length < 7)
                {
                    continue;
                }

                try
                {
                    float P(string s) => float.Parse(s, CultureInfo.InvariantCulture);
                    var outpost = new Outpost
                    {
                        Position = new Vector3(P(parts[0]), P(parts[1]), P(parts[2])),
                        Kind = parts[3],
                        Material = parts[4],
                        Founded = int.Parse(parts[5], CultureInfo.InvariantCulture),
                        LastHaul = int.Parse(parts[6], CultureInfo.InvariantCulture),
                        Stock = parts.Length > 7 ? int.Parse(parts[7], CultureInfo.InvariantCulture) : 0,
                    };
                    outpost.Biome = parts.Length > 8 && System.Enum.TryParse(parts[8], out Heightmap.Biome biome)
                        ? biome
                        : WorldGenerator.instance != null ? WorldGenerator.instance.GetBiome(outpost.Position) : Heightmap.Biome.BlackForest;
                    list.Add(outpost);
                }
                catch (System.FormatException)
                {
                }
            }

            return list;
        }

        private static void WriteAll(ZDO zdo, List<Outpost> outposts)
        {
            string F(float f) => f.ToString("0.##", CultureInfo.InvariantCulture);
            string I(int i) => i.ToString(CultureInfo.InvariantCulture);
            zdo.Set(KeyOutpost, string.Join("\n", outposts.Select(o => string.Join("|", F(o.Position.x), F(o.Position.y), F(o.Position.z),
                o.Kind, o.Material, I(o.Founded), I(o.LastHaul), I(o.Stock), o.Biome.ToString()))));
        }

        // ---------------------------------------------------------------- gear

        /// <summary>The gear tier a village must have made before its people go to a camp in <paramref name="biome"/>.</summary>
        public static int GearFor(Heightmap.Biome biome)
        {
            foreach (string part in (LogicConfig.OutpostGear?.Value ?? DefaultGear).Split(';'))
            {
                int colon = part.IndexOf(':');
                if (colon > 0 && System.Enum.TryParse(part.Substring(0, colon).Trim(), true, out Heightmap.Biome b) && b == biome &&
                    int.TryParse(part.Substring(colon + 1).Trim(), out int tier))
                {
                    return tier;
                }
            }

            return biome == Heightmap.Biome.Meadows ? 0 : 4;
        }

        /// <summary>The village wears at least the gear GearFor asks for in <paramref name="biome"/>.</summary>
        public static bool Equipped(VillageHearth hearth, Heightmap.Biome biome, out int need, out int have)
        {
            need = GearFor(biome);
            have = Smithing.Armoury(hearth);
            return have >= need;
        }

        public static string BiomeName(Heightmap.Biome biome)
        {
            switch (biome)
            {
                case Heightmap.Biome.BlackForest: return "Black Forest";
                case Heightmap.Biome.Meadows: return "meadows";
                case Heightmap.Biome.Mountain: return "mountains";
                case Heightmap.Biome.Swamp: return "swamp";
                case Heightmap.Biome.Plains: return "plains";
                case Heightmap.Biome.Ocean: return "coast";
                default: return biome.ToString();
            }
        }

        /// <summary>
        /// The materials this village's outposts send home, which count as its own for building (OutpostMaterials).
        /// Empty with WorldLife or the setting off.
        /// </summary>
        public static HashSet<string> Gives(VillageHearth hearth)
        {
            var gives = new HashSet<string>();
            if (!On || !(LogicConfig.OutpostMaterials?.Value ?? true) || hearth == null || !hearth.IsValid)
            {
                return gives;
            }

            foreach (Outpost outpost in ReadAll(hearth.Zdo))
            {
                if (Materials.Tracked.Contains(outpost.Material))
                {
                    gives.Add(outpost.Material);
                }
            }

            return gives;
        }

        // ---------------------------------------------------------------- the village's side

        /// <summary>Hearth tick: found an outpost when the village is ready; gather at the camps and send the loads home.</summary>
        public static void Tick(VillageHearth hearth, VillageState state)
        {
            List<Outpost> outposts = ReadAll(hearth.Zdo);
            int most = LogicConfig.OutpostsPerVillage != null ? LogicConfig.OutpostsPerVillage.Value : 2;
            if (On && outposts.Count < most && state.Plots.Count >= 4 && VillageBrain.CountVillagers(state.Id) >= 4 &&
                hearth.Zdo.GetInt(KeyTried) != Today)
            {
                hearth.Zdo.Set(KeyTried, Today);
                if (Found(hearth, state, outposts))
                {
                    outposts = ReadAll(hearth.Zdo);
                }
            }

            bool changed = false;
            int carryAt = LogicConfig.OutpostCarryAt != null ? LogicConfig.OutpostCarryAt.Value : 12;
            for (int i = 0; i < outposts.Count; i++)
            {
                Outpost outpost = outposts[i];
                int days = Mathf.Min(3, Today - outpost.LastHaul);
                if (days > 0)
                {
                    outpost.LastHaul = Today;
                    outpost.Stock += PerDay(outpost) * days;
                    changed = true;
                }

                if (outpost.Stock >= carryAt)
                {
                    SendHome(hearth, state, i, outpost);
                    changed = true;
                }
            }

            if (changed)
            {
                WriteAll(hearth.Zdo, outposts);
            }
        }

        private static void SendHome(VillageHearth hearth, VillageState state, int index, Outpost outpost)
        {
            int load = outpost.Stock;
            outpost.Stock = 0;
            if (!CaravansOn)
            {
                state.Add(outpost.Material, load);
                Dialogue.Note(state.Id, "haul");
                return;
            }

            bool trail = Trails.ToOutpost(hearth.Zdo, index) != null;
            Caravans.Send(hearth, Caravans.Haul, state.Id, outpost.Position, hearth.transform.position,
                new Dictionary<string, int> { [outpost.Material] = load }, trail ? "o" + index : "s", outpost.Kind);
        }

        /// <summary>A haul from a camp has reached the village (Caravans): the load is already in the stock.</summary>
        internal static void Hauled(VillageHearth hearth, VillageState state, Caravans.Caravan haul)
        {
            Dialogue.Note(state.Id, "haul");
            // Now and then, so the chronicle does not fill with it.
            if (Random.value < 0.25f)
            {
                Chronicle.Add(hearth, $"{Names.Villager(haul.Seed, Cultures.Of(hearth))} carried {haul.CargoText()} home from the {(haul.Extra.Length > 0 ? haul.Extra : "camp")}.");
            }
        }

        /// <summary>Founds the first camp the village wants and can reach. True when one was founded.</summary>
        private static bool Found(VillageHearth hearth, VillageState state, List<Outpost> outposts)
        {
            foreach ((string kind, Heightmap.Biome biome, string material) in Wanted(hearth, state, outposts))
            {
                if (!Equipped(hearth, biome, out int need, out int have))
                {
                    // Said once every five days, so the chronicle does not fill with it.
                    if (hearth.Zdo.GetInt(KeyGearNoted, -100) <= Today - 5)
                    {
                        hearth.Zdo.Set(KeyGearNoted, Today);
                        Chronicle.Add(hearth, $"We would send two of us to the {BiomeName(biome)} for {Materials.Label(material)}, but not before " +
                                              $"we have {Smithing.TierName(need)} gear. We have {Smithing.TierName(have)}.");
                        Dialogue.Note(state.Id, "outpostwait");
                    }

                    continue;
                }

                if (Place(hearth, state, outposts, kind, biome, material) == null)
                {
                    VillheimPlugin.Log.LogInfo($"{state.Name}: no site for a {kind} in the {BiomeName(biome)} within 700 m.");
                    continue;
                }

                return true;
            }

            return false;
        }

        /// <summary>Finds a site and founds the camp there. Null when there is no site.</summary>
        private static Outpost Place(VillageHearth hearth, VillageState state, List<Outpost> outposts, string kind, Heightmap.Biome biome, string material)
        {
            Vector3 home = hearth.transform.position;
            bool found = kind == FlintCamp ? FindShore(home, biome, out Vector3 site) : FindSite(home, biome, out site);
            if (!found || outposts.Any(o => Utils.DistanceXZ(o.Position, site) < 80f))
            {
                return null;
            }

            var outpost = new Outpost { Position = site, Kind = kind, Material = material, Founded = Today, LastHaul = Today, Biome = biome };
            outposts.Add(outpost);
            WriteAll(hearth.Zdo, outposts);
            string where = WorldLife.Compass(site - home);
            float distance = Utils.DistanceXZ(site, home);
            Chronicle.Add(hearth, $"Two of us set out to make a {kind} in the {BiomeName(biome)}, {distance:0} m to the {where}, " +
                                  $"for {Materials.Label(material)}.");
            Dialogue.Note(state.Id, "outpost");
            if (Minimap.instance != null && Player.m_localPlayer != null &&
                Utils.DistanceXZ(Player.m_localPlayer.transform.position, home) < 150f)
            {
                MapPins.AddPin(Minimap.instance, site, Minimap.PinType.Icon2, $"{state.Name} {kind}", true);
            }

            VillheimPlugin.Log.LogInfo($"{state.Name} founded a {kind} at {site} ({distance:0} m {where}).");
            return outpost;
        }

        /// <summary>The camps the village would like, most wanted first, leaving out kinds it already has.</summary>
        private static List<(string Kind, Heightmap.Biome Biome, string Material)> Wanted(VillageHearth hearth, VillageState state,
            List<Outpost> outposts, bool all = false)
        {
            var wanted = new List<(string, Heightmap.Biome, string)>();
            if (all || Smithing.Reserved(hearth).Contains("Flint"))
            {
                wanted.Add((FlintCamp, state.Biome == Heightmap.Biome.BlackForest ? Heightmap.Biome.BlackForest : Heightmap.Biome.Meadows, "Flint"));
            }

            if (state.Biome == Heightmap.Biome.Meadows)
            {
                wanted.Add((Logging, Heightmap.Biome.BlackForest, Materials.CoreWood));
            }
            else if (state.Biome == Heightmap.Biome.BlackForest)
            {
                wanted.Add((Logging, Heightmap.Biome.Meadows, Materials.FineWood));
            }

            return wanted.Where(w => outposts.All(o => o.Kind != w.Item1)).ToList();
        }

        /// <summary>The nearest point 150 to 700 m out that lies 25 m inside <paramref name="biome"/>, on dry ground.</summary>
        private static bool FindSite(Vector3 from, Heightmap.Biome biome, out Vector3 site)
        {
            WorldGenerator world = WorldGenerator.instance;
            float water = ZoneSystem.instance.m_waterLevel;
            for (float distance = 150f; distance <= 700f; distance += 25f)
            {
                for (int i = 0; i < 32; i++)
                {
                    Vector3 direction = Quaternion.Euler(0f, i * 11.25f, 0f) * Vector3.forward;
                    Vector3 point = from + direction * distance;
                    if (world.GetBiome(point) != biome || world.GetBiome(point + direction * 25f) != biome ||
                        world.GetBiome(point + Quaternion.Euler(0f, 90f, 0f) * direction * 25f) != biome ||
                        world.GetBiome(point - Quaternion.Euler(0f, 90f, 0f) * direction * 25f) != biome)
                    {
                        continue;
                    }

                    float height = world.GetHeight(point.x, point.z);
                    if (height < water + 2f || Mathf.Abs(world.GetHeight(point.x + 4f, point.z) - height) > 2f ||
                        Mathf.Abs(world.GetHeight(point.x, point.z + 4f) - height) > 2f)
                    {
                        continue;
                    }

                    site = new Vector3(point.x, height, point.z);
                    return true;
                }
            }

            site = Vector3.zero;
            return false;
        }

        /// <summary>
        /// The nearest shore 100 to 700 m out in <paramref name="biome"/>: fairly flat ground 1 to 3 m above the water,
        /// with water within 15 m of it, where flint lies on the beach.
        /// </summary>
        private static bool FindShore(Vector3 from, Heightmap.Biome biome, out Vector3 site)
        {
            WorldGenerator world = WorldGenerator.instance;
            float water = ZoneSystem.instance.m_waterLevel;
            for (float distance = 100f; distance <= 700f; distance += 20f)
            {
                for (int i = 0; i < 36; i++)
                {
                    Vector3 point = from + Quaternion.Euler(0f, i * 10f, 0f) * Vector3.forward * distance;
                    float height = world.GetHeight(point.x, point.z);
                    if (height < water + 1f || height > water + 3f || world.GetBiome(point) != biome ||
                        Mathf.Abs(world.GetHeight(point.x + 3f, point.z) - height) > 1.5f ||
                        Mathf.Abs(world.GetHeight(point.x, point.z + 3f) - height) > 1.5f)
                    {
                        continue;
                    }

                    bool wet = false;
                    for (int j = 0; j < 8 && !wet; j++)
                    {
                        Vector3 look = point + Quaternion.Euler(0f, j * 45f, 0f) * Vector3.forward * 15f;
                        wet = world.GetHeight(look.x, look.z) < water - 0.5f;
                    }

                    if (wet)
                    {
                        site = new Vector3(point.x, height, point.z);
                        return true;
                    }
                }
            }

            site = Vector3.zero;
            return false;
        }

        // ---------------------------------------------------------------- the camps themselves

        /// <summary>World tick (host): camps within 150 m of the player are made if missing, and their campers.</summary>
        public static void EnsureCamps(Vector3 around)
        {
            if (!On)
            {
                return;
            }

            foreach (ZDO hearth in Relations.AllHearths())
            {
                foreach (Outpost outpost in ReadAll(hearth))
                {
                    if (Utils.DistanceXZ(outpost.Position, around) <= 150f && ZNetScene.instance.IsAreaReady(outpost.Position))
                    {
                        EnsureCamp(hearth, outpost);
                    }
                }
            }
        }

        private static void EnsureCamp(ZDO hearth, Outpost outpost)
        {
            int villageId = hearth.GetInt(Keys.VillageId);
            Fireplace fire = WorldLife.CampOf(outpost.Position, 12f);
            if (fire == null)
            {
                Vector3 spot = outpost.Position;
                if (ZoneSystem.instance.GetGroundHeight(spot, out float y))
                {
                    spot.y = y;
                }

                fire = WorldLife.MakeCamp(spot);
                if (fire == null)
                {
                    return;
                }

                fire.m_nview.GetZDO().Set(KeyOutpostVillage, villageId);
                VillheimPlugin.Log.LogInfo($"{hearth.GetString(Keys.Name, "?")}'s {outpost.Kind} made at {spot}.");
            }

            int prefab = VillagerPrefab.Name.GetStableHashCode();
            Vector3 at = fire.transform.position;
            int here = ZDOMan.instance.m_objectsByID.Values.Count(z => z != null && z.GetPrefab() == prefab &&
                                                                      z.GetString(Wanderers.KeyKind, "") == Wanderers.Camper &&
                                                                      Utils.DistanceXZ(z.GetVec3(Wanderers.KeyTarget, Vector3.zero), at) < 4f);
            for (int i = here; i < Campers; i++)
            {
                Vector3 spawn = at + Quaternion.Euler(0f, 120f * i + 30f, 0f) * Vector3.forward * 2.5f;
                Villager camper = Wanderers.Spawn(Wanderers.Camper, spawn, at, hearth.GetString(Keys.Name, ""), villageId);
                camper?.Zdo.Set(Wanderers.KeyCampKind, outpost.Kind);
            }
        }

        /// <summary>Where the village's camps are, in the order they were founded.</summary>
        public static List<Vector3> Positions(VillageHearth hearth) => ReadAll(hearth.Zdo).Select(o => o.Position).ToList();

        public static string Describe(VillageHearth hearth)
        {
            List<Outpost> outposts = ReadAll(hearth.Zdo);
            var state = new VillageState(hearth.Zdo);
            var parts = outposts.Select(o =>
            {
                float distance = Utils.DistanceXZ(o.Position, hearth.transform.position);
                return $"{o.Kind} {distance:0} m {WorldLife.Compass(o.Position - hearth.transform.position)} for {Materials.Label(o.Material)}, " +
                       $"since day {o.Founded}, {o.Stock} waiting at the camp";
            }).ToList();
            foreach ((string kind, Heightmap.Biome biome, string _) in Wanted(hearth, state, outposts))
            {
                bool ready = Equipped(hearth, biome, out int need, out int have);
                parts.Add($"wants a {kind} in the {BiomeName(biome)} (needs {Smithing.TierName(need)} gear, has {Smithing.TierName(have)}" +
                          (ready ? ", ready" : "") + ")");
            }

            return parts.Count > 0 ? string.Join("; ", parts) : "no outpost";
        }

        /// <summary>
        /// 'vh outpost [logging|flint]': found the nearest village's next outpost now, whatever its size and gear.
        /// 'vh outpost forget' drops its outposts; 'vh outpost haul' sends every camp's stock home now.
        /// </summary>
        public static string Command(string[] args)
        {
            Player player = Player.m_localPlayer;
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
            string what = args != null && args.Length > 0 ? args[0].ToLowerInvariant() : "";
            List<Outpost> outposts = ReadAll(hearth.Zdo);
            if (what == "forget")
            {
                hearth.Zdo.Set(KeyOutpost, "");
                Trails.ForgetOutposts(hearth.Zdo);
                return $"{state.Name} has no outposts now.";
            }

            if (what == "haul")
            {
                for (int i = 0; i < outposts.Count; i++)
                {
                    outposts[i].Stock = Mathf.Max(outposts[i].Stock, 12);
                    SendHome(hearth, state, i, outposts[i]);
                }

                WriteAll(hearth.Zdo, outposts);
                return Describe(hearth);
            }

            foreach ((string kind, Heightmap.Biome biome, string material) in Wanted(hearth, state, outposts, all: true))
            {
                if (what.Length > 0 && !kind.StartsWith(what))
                {
                    continue;
                }

                return Place(hearth, state, outposts, kind, biome, material) != null
                    ? Describe(hearth) + (On ? "" : " (WorldLife is off: nothing is gathered or made until it is on)")
                    : $"No site for a {kind} in the {BiomeName(biome)} within 700 m.";
            }

            return Describe(hearth) + ". Kinds: logging, flint; or forget, haul.";
        }
    }
}
