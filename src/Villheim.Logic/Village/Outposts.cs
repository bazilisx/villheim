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
    /// Millenaire's hamlets and Living Factions' outposts (the rules, not the code). First version:
    ///
    /// - A village with at least four buildings and four villagers, with WorldLife on, founds one outpost: a Meadows
    ///   village a logging camp in the nearest Black Forest (core wood), a Black Forest village one in the nearest
    ///   Meadows (fine wood). The site is the nearest point 150 to 700 m out (planned from the world generator, so no
    ///   zone needs to be loaded) that lies 25 m inside that biome, on dry ground.
    /// - The camp itself (a fire pit and two campers who potter about it and sit by the fire at night) is made the
    ///   first time a player comes within 150 m of the site, on the host.
    /// - Every in-game day the camp sends home 10 of its wood (catching up at most three days after the village sat
    ///   unloaded) into the village stock, which goes into the village chest.
    ///
    /// - Nobody goes out before they can look after themselves (Tyler, 2026-11-08): the village must have made the gear
    ///   tier OutpostGear asks for that biome (Black Forest: flint and leather, tier 2) before the camp is founded,
    ///   the way a player should not walk into the Black Forest in rags. Until then the village waits, and says so in
    ///   its chronicle every few days.
    /// - What the camp sends counts toward what the village can build (OutpostMaterials, on by default): a Meadows
    ///   village with a logging camp in the Black Forest builds designs that need core wood (Materials.From).
    /// </summary>
    internal static class Outposts
    {
        private static readonly int KeyOutpost = "villheim_outpost".GetStableHashCode();
        public static readonly int KeyOutpostVillage = "villheim_outpostvillage".GetStableHashCode();
        private const int Campers = 2;
        private const int HaulPerDay = 10;

        private sealed class Outpost
        {
            public Vector3 Position;
            public string Kind;
            public string Material;
            public int Founded;
            public int LastHaul;
        }

        private static int Today => EnvMan.instance != null ? EnvMan.instance.GetDay() : 0;

        private static bool On => LogicConfig.WorldLife != null && LogicConfig.WorldLife.Value &&
                                  (LogicConfig.Outposts == null || LogicConfig.Outposts.Value);

        // ---------------------------------------------------------------- saved on the hearth

        private static Outpost Read(ZDO zdo)
        {
            string[] parts = zdo.GetString(KeyOutpost, "").Split('|');
            if (parts.Length < 7)
            {
                return null;
            }

            float P(string s) => float.Parse(s, CultureInfo.InvariantCulture);
            return new Outpost
            {
                Position = new Vector3(P(parts[0]), P(parts[1]), P(parts[2])),
                Kind = parts[3],
                Material = parts[4],
                Founded = int.Parse(parts[5], CultureInfo.InvariantCulture),
                LastHaul = int.Parse(parts[6], CultureInfo.InvariantCulture),
            };
        }

        private static void Write(ZDO zdo, Outpost outpost)
        {
            string F(float f) => f.ToString("0.##", CultureInfo.InvariantCulture);
            zdo.Set(KeyOutpost, string.Join("|", F(outpost.Position.x), F(outpost.Position.y), F(outpost.Position.z), outpost.Kind,
                outpost.Material, outpost.Founded.ToString(CultureInfo.InvariantCulture), outpost.LastHaul.ToString(CultureInfo.InvariantCulture)));
        }

        // ---------------------------------------------------------------- the village's side

        /// <summary>Hearth tick: found an outpost when the village is ready; take in the day's haul.</summary>
        public static void Tick(VillageHearth hearth, VillageState state)
        {
            Outpost outpost = Read(hearth.Zdo);
            if (outpost == null)
            {
                if (On && state.Plots.Count >= 4 && VillageBrain.CountVillagers(state.Id) >= 4 && hearth.Zdo.GetInt(KeyTried) != Today)
                {
                    hearth.Zdo.Set(KeyTried, Today);
                    Found(hearth, state);
                }

                return;
            }

            int days = Mathf.Min(3, Today - outpost.LastHaul);
            if (days <= 0)
            {
                return;
            }

            outpost.LastHaul = Today;
            Write(hearth.Zdo, outpost);
            state.Add(outpost.Material, HaulPerDay * days);
            Dialogue.Note(state.Id, "haul");
            if ((Today - outpost.Founded) % 5 == 1)
            {
                Chronicle.Add(hearth, $"The {outpost.Kind} sent home {HaulPerDay * days} {Materials.Label(outpost.Material)}.");
            }
        }

        private static readonly int KeyTried = "villheim_outposttried".GetStableHashCode();
        private static readonly int KeyGearNoted = "villheim_outpostgearnoted".GetStableHashCode();

        public const string DefaultGear = "Meadows: 0; BlackForest: 2; Swamp: 4; Mountain: 4; Plains: 4; Ocean: 1";

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

            Outpost outpost = Read(hearth.Zdo);
            if (outpost != null && Materials.Tracked.Contains(outpost.Material))
            {
                gives.Add(outpost.Material);
            }

            return gives;
        }

        private static void Found(VillageHearth hearth, VillageState state)
        {
            Heightmap.Biome want;
            string material;
            if (state.Biome == Heightmap.Biome.Meadows)
            {
                want = Heightmap.Biome.BlackForest;
                material = Materials.CoreWood;
            }
            else if (state.Biome == Heightmap.Biome.BlackForest)
            {
                want = Heightmap.Biome.Meadows;
                material = Materials.FineWood;
            }
            else
            {
                return;
            }

            if (!Equipped(hearth, want, out int need, out int have))
            {
                // Said once every five days, so the chronicle does not fill with it.
                if (hearth.Zdo.GetInt(KeyGearNoted, -100) <= Today - 5)
                {
                    hearth.Zdo.Set(KeyGearNoted, Today);
                    Chronicle.Add(hearth, $"We would send two of us to the {BiomeName(want)} for {Materials.Label(material)}, but not before " +
                                          $"we have {Smithing.TierName(need)} gear. We have {Smithing.TierName(have)}.");
                    Dialogue.Note(state.Id, "outpostwait");
                }

                return;
            }

            if (!FindSite(hearth.transform.position, want, out Vector3 site))
            {
                VillheimPlugin.Log.LogInfo($"{state.Name}: no {want} within 700 m for an outpost.");
                return;
            }

            var outpost = new Outpost { Position = site, Kind = "logging camp", Material = material, Founded = Today, LastHaul = Today };
            Write(hearth.Zdo, outpost);
            string where = WorldLife.Compass(site - hearth.transform.position);
            float distance = Utils.DistanceXZ(site, hearth.transform.position);
            Chronicle.Add(hearth, $"Two of us set out to make a logging camp in the {BiomeName(want)}, " +
                                  $"{distance:0} m to the {where}, for {Materials.Label(material)}.");
            Dialogue.Note(state.Id, "outpost");
            if (Minimap.instance != null && Player.m_localPlayer != null &&
                Utils.DistanceXZ(Player.m_localPlayer.transform.position, hearth.transform.position) < 150f)
            {
                MapPins.AddPin(Minimap.instance, site, Minimap.PinType.Icon2, $"{state.Name} logging camp", true);
            }

            VillheimPlugin.Log.LogInfo($"{state.Name} founded a logging camp at {site} ({distance:0} m {where}).");
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

        // ---------------------------------------------------------------- the camp itself

        /// <summary>World tick (host): camps within 150 m of the player are made if missing, and their campers.</summary>
        public static void EnsureCamps(Vector3 around)
        {
            if (!On)
            {
                return;
            }

            foreach (ZDO hearth in Relations.AllHearths())
            {
                Outpost outpost = Read(hearth);
                if (outpost == null || Utils.DistanceXZ(outpost.Position, around) > 150f || !ZNetScene.instance.IsAreaReady(outpost.Position))
                {
                    continue;
                }

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
                        continue;
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
        }

        public static Vector3? Position(VillageHearth hearth) => Read(hearth.Zdo)?.Position;

        public static string Describe(VillageHearth hearth)
        {
            Outpost outpost = Read(hearth.Zdo);
            if (outpost == null)
            {
                var state = new VillageState(hearth.Zdo);
                Heightmap.Biome want = state.Biome == Heightmap.Biome.BlackForest ? Heightmap.Biome.Meadows : Heightmap.Biome.BlackForest;
                bool ready = Equipped(hearth, want, out int need, out int have);
                return $"no outpost ({BiomeName(want)} camp needs {Smithing.TierName(need)} gear, has {Smithing.TierName(have)}" +
                       (ready ? ", ready" : "") + ")";
            }

            float distance = Utils.DistanceXZ(outpost.Position, hearth.transform.position);
            return $"{outpost.Kind} {distance:0} m {WorldLife.Compass(outpost.Position - hearth.transform.position)} for " +
                   $"{Materials.Label(outpost.Material)}, since day {outpost.Founded}, last haul day {outpost.LastHaul}";
        }

        /// <summary>'vh outpost': found the nearest village's outpost now (forgetting any it had).</summary>
        public static string Command()
        {
            Player player = Player.m_localPlayer;
            VillageHearth hearth = player != null ? VillageHearth.Closest(player.transform.position, 200f) : null;
            if (hearth == null)
            {
                return "No village within 200 m.";
            }

            hearth.Zdo.Set(KeyOutpost, "");
            Found(hearth, new VillageState(hearth.Zdo));
            return Describe(hearth);
        }
    }
}
