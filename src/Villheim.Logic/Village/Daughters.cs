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
    /// A full village sends a few of its people off to found a village of their own, after Living Factions' people
    /// moving house, Millenaire's new villages and Kenshi's resettled towns. The rules, not the code.
    ///
    /// - Once a day (DaughterChancePerDay), a village that is full (MaxVillagers villagers or MaxBuildings buildings),
    ///   has fewer than DaughtersPerVillage daughters and sent none in the last ten days, looks for a site 600 to
    ///   1,200 m away in its own biome (or one it has the gear for, as with outposts): dry ground 3 m over the water,
    ///   flat within 2 m over 10 m, 500 m from any other village or village site and 120 m from any game location.
    /// - Two of its grown villagers (not the builder) leave as a party of settlers, a caravan (Caravans.cs) with up to
    ///   40 wood and 20 stone the chest can spare. Near a player they walk the road as themselves; out of sight they
    ///   are a record on the world clock.
    /// - When the party is due, the site is settled on paper. The hearth is lit the first time a player comes within
    ///   150 m of it (host), as a settled-by-hand village, so the spacing rules do not apply. The new village starts
    ///   with the goods, knows where it came from, and both villages start on close terms (80).
    ///
    /// Runs with WorldLife and Daughters on. 'vh daughter' sends a party now, 'vh daughter here' lights the nearest
    /// settled site at once.
    /// </summary>
    internal static class Daughters
    {
        private static readonly int KeyDaughters = "villheim_daughters".GetStableHashCode();
        private static readonly int KeyRolled = "villheim_daughter_day".GetStableHashCode();
        public static readonly int KeyParent = "villheim_parent".GetStableHashCode();
        private static readonly int KeyGoods = "villheim_parentgoods".GetStableHashCode();
        private static readonly int KeyWelcomed = "villheim_parentwelcomed".GetStableHashCode();

        private sealed class Site
        {
            public Vector3 Position;
            public long Caravan;
            public int Departed;
            public bool Arrived;
            public string Goods = "";
        }

        private static bool On => LogicConfig.WorldLife != null && LogicConfig.WorldLife.Value &&
                                  (LogicConfig.Daughters == null || LogicConfig.Daughters.Value);

        private static int Today => EnvMan.instance != null ? EnvMan.instance.GetDay() : 0;

        private static float Hour => EnvMan.instance != null ? EnvMan.instance.GetDayFraction() * 24f : 12f;

        private static List<Site> Read(ZDO zdo)
        {
            var sites = new List<Site>();
            foreach (string line in zdo.GetString(KeyDaughters, "").Split('\n'))
            {
                string[] p = line.Split('|');
                if (p.Length < 6)
                {
                    continue;
                }

                try
                {
                    sites.Add(new Site
                    {
                        Position = new Vector3(float.Parse(p[0], CultureInfo.InvariantCulture), 0f, float.Parse(p[1], CultureInfo.InvariantCulture)),
                        Caravan = long.Parse(p[2], CultureInfo.InvariantCulture),
                        Departed = int.Parse(p[3], CultureInfo.InvariantCulture),
                        Arrived = p[4] == "1",
                        Goods = p[5],
                    });
                }
                catch (System.FormatException)
                {
                }
            }

            return sites;
        }

        private static void Write(ZDO zdo, List<Site> sites) =>
            zdo.Set(KeyDaughters, string.Join("\n", sites.Select(s => string.Join("|",
                s.Position.x.ToString("0.#", CultureInfo.InvariantCulture), s.Position.z.ToString("0.#", CultureInfo.InvariantCulture),
                s.Caravan.ToString(CultureInfo.InvariantCulture), s.Departed.ToString(CultureInfo.InvariantCulture), s.Arrived ? "1" : "0", s.Goods))));

        // ---------------------------------------------------------------- the parent village (hearth owner)

        public static void Tick(VillageHearth hearth, VillageState state)
        {
            Welcome(hearth, state);
            if (!On || Hour < 8f || Hour > 12f || hearth.Zdo.GetInt(KeyRolled, -1) == Today)
            {
                return;
            }

            hearth.Zdo.Set(KeyRolled, Today);
            List<Site> sites = Read(hearth.Zdo);
            bool full = VillageBrain.CountVillagers(state.Id) >= VillheimConfig.MaxVillagers.Value ||
                        state.Plots.Count >= VillheimConfig.MaxBuildings.Value;
            int most = LogicConfig.DaughtersPerVillage != null ? LogicConfig.DaughtersPerVillage.Value : 2;
            float chance = LogicConfig.DaughterChancePerDay != null ? LogicConfig.DaughterChancePerDay.Value : 0.25f;
            if (!full || sites.Count >= most || sites.Any(s => Today - s.Departed < 10) || Random.value > chance)
            {
                return;
            }

            Send(hearth, state, out _);
        }

        /// <summary>Sends a party of settlers to the best site in reach. False with a reason.</summary>
        internal static bool Send(VillageHearth hearth, VillageState state, out string why)
        {
            if (!FindSite(hearth, state, out Vector3 site, out Heightmap.Biome biome))
            {
                why = "no site for a new village 600 to 1,200 m away";
                return false;
            }

            List<Villager> going = Character.GetAllCharacters().OfType<Villager>()
                .Where(v => !v.IsDead() && v.VillageId == state.Id && !Wanderers.IsWanderer(v) && !Childhood.IsChild(v) &&
                            v.m_nview != null && v.m_nview.IsOwner() && !VillagerLooks.IsBuilder(v.Zdo.GetInt(Keys.VillagerSeed)))
                .OrderBy(_ => Random.value).Take(Mathf.Max(1, VillheimConfig.StartingVillagers.Value)).ToList();
            if (going.Count == 0)
            {
                why = "nobody here who could go";
                return false;
            }

            // What the chest can spare for their first building.
            var goods = new Dictionary<string, int>();
            Container chest = VillageChest.Find(hearth);
            if (chest != null && VillageChest.Usable(chest))
            {
                foreach ((string item, int amount) in new[] { (Materials.Wood, 40), (Materials.Stone, 20) })
                {
                    int have = VillageChest.Have(hearth, state, item);
                    int give = Mathf.Min(amount, Mathf.Max(0, have - 30));
                    if (give > 0 && VillageChest.Take(chest, new Dictionary<string, int> { [item] = give }))
                    {
                        goods[item] = give;
                    }
                }
            }

            var cargo = new Dictionary<string, int>(goods) { ["people"] = going.Count };
            Caravans.Caravan party = Caravans.Send(hearth, Caravans.Settlers, 0, hearth.transform.position, site, cargo, "s",
                string.Join(", ", going.Select(v => v.VillagerName)));

            // The people themselves walk off down the road, as the party; they are gone once out of sight.
            foreach (Villager villager in going)
            {
                ZDO zdo = villager.Zdo;
                zdo.Set(Wanderers.KeyKind, Wanderers.Carrier);
                zdo.Set(Wanderers.KeyPhase, "arrive");
                zdo.Set(Wanderers.KeyTarget, site);
                zdo.Set(Wanderers.KeyFrom, state.Name);
                zdo.Set(Wanderers.KeyBorn, (long)(ZNet.instance.GetTimeSeconds() * 10.0));
                zdo.Set(Wanderers.KeyVisit, 0);
                zdo.Set(Keys.VillagerVillage, 0);
                zdo.Set(Caravans.KeyCaravanId, party.Id);
            }

            List<Site> sites = Read(hearth.Zdo);
            sites.Add(new Site
            {
                Position = site, Caravan = party.Id, Departed = Today,
                Goods = string.Join(",", goods.Select(g => g.Key + ":" + g.Value.ToString(CultureInfo.InvariantCulture))),
            });
            Write(hearth.Zdo, sites);

            float distance = Utils.DistanceXZ(site, hearth.transform.position);
            string names = string.Join(" and ", going.Select(v => v.VillagerName));
            Chronicle.Add(hearth, $"{names} set off to found a village of their own in the {Outposts.BiomeName(biome)}, " +
                                  $"{distance:0} m to the {WorldLife.Compass(site - hearth.transform.position)}.");
            Dialogue.Note(state.Id, "daughter");
            if (Minimap.instance != null && Player.m_localPlayer != null &&
                Utils.DistanceXZ(Player.m_localPlayer.transform.position, hearth.transform.position) < 150f)
            {
                MapPins.AddPin(Minimap.instance, site, Minimap.PinType.Icon3, $"New village ({state.Name})", true);
            }

            why = null;
            return true;
        }

        /// <summary>The settlers' caravan is due at the site (Caravans, on the parent's hearth owner).</summary>
        internal static void Arrived(VillageHearth hearth, VillageState state, Caravans.Caravan party)
        {
            List<Site> sites = Read(hearth.Zdo);
            Site site = sites.FirstOrDefault(s => s.Caravan == party.Id);
            if (site == null || site.Arrived)
            {
                return;
            }

            site.Arrived = true;
            Write(hearth.Zdo, sites);
            VillheimPlugin.Log.LogInfo($"{state.Name}: the settlers reached their site at {site.Position}.");
        }

        /// <summary>A daughter's hearth is lit: the parent thinks well of it from the start, once.</summary>
        private static void Welcome(VillageHearth hearth, VillageState state)
        {
            foreach (ZDO daughter in Relations.AllHearths())
            {
                if (daughter.GetInt(KeyParent) != state.Id || hearth.Zdo.GetBool(unchecked(KeyWelcomed + daughter.GetInt(Keys.VillageId))))
                {
                    continue;
                }

                int id = daughter.GetInt(Keys.VillageId);
                hearth.Zdo.Set(unchecked(KeyWelcomed + id), true);
                Relations.Set(hearth.Zdo, id, 80);
                Chronicle.Add(hearth, $"Our people have lit their own hearth. The village is called {daughter.GetString(Keys.Name, "something new")}.");
            }
        }

        private static bool FindSite(VillageHearth hearth, VillageState state, out Vector3 site, out Heightmap.Biome biome)
        {
            WorldGenerator world = WorldGenerator.instance;
            float water = ZoneSystem.instance.m_waterLevel;
            Vector3 from = hearth.transform.position;
            int hearthPrefab = HearthPrefab.Name.GetStableHashCode();
            List<Vector3> villages = ZDOMan.instance.m_objectsByID.Values.Where(z => z != null && z.GetPrefab() == hearthPrefab)
                .Select(z => z.GetPosition()).ToList();
            villages.AddRange(Relations.AllHearths().SelectMany(z => Read(z).Select(s => s.Position)));
            var rng = new System.Random(unchecked(state.Seed * 31 + Today));
            int turn = rng.Next(360);
            for (float distance = 600f; distance <= 1200f; distance += 50f)
            {
                for (int i = 0; i < 24; i++)
                {
                    Vector3 point = from + Quaternion.Euler(0f, turn + i * 15f, 0f) * Vector3.forward * distance;
                    biome = world.GetBiome(point);
                    if ((biome != state.Biome && biome != Heightmap.Biome.Meadows && biome != Heightmap.Biome.BlackForest) ||
                        !Outposts.Equipped(hearth, biome, out _, out _))
                    {
                        continue;
                    }

                    float height = world.GetHeight(point.x, point.z);
                    if (height < water + 3f)
                    {
                        continue;
                    }

                    bool flat = true;
                    for (int j = 0; j < 8 && flat; j++)
                    {
                        Vector3 look = point + Quaternion.Euler(0f, j * 45f, 0f) * Vector3.forward * 10f;
                        flat = Mathf.Abs(world.GetHeight(look.x, look.z) - height) < 2f && world.GetBiome(look) == biome;
                    }

                    if (!flat || villages.Any(v => Utils.DistanceXZ(v, point) < 500f) ||
                        ZoneSystem.instance.m_locationInstances.Values.Any(l => Utils.DistanceXZ(l.m_position, point) <
                                                                                (l.m_location?.m_prefabName == VillageLocation.Name ? 500f : 120f)))
                    {
                        continue;
                    }

                    site = new Vector3(point.x, height, point.z);
                    return true;
                }
            }

            site = Vector3.zero;
            biome = Heightmap.Biome.None;
            return false;
        }

        // ---------------------------------------------------------------- lighting the new hearth (host)

        /// <summary>World tick (host): a settled site within 150 m of the player gets its hearth.</summary>
        public static void EnsureHearths(Vector3 around)
        {
            if (!On || HearthPrefab.Prefab == null)
            {
                return;
            }

            foreach (ZDO parent in Relations.AllHearths().ToList())
            {
                foreach (Site site in Read(parent))
                {
                    if (site.Arrived && Utils.DistanceXZ(site.Position, around) < 150f && ZNetScene.instance.IsAreaReady(site.Position))
                    {
                        Light(parent, site);
                    }
                }
            }
        }

        private static void Light(ZDO parent, Site site)
        {
            int hearthPrefab = HearthPrefab.Name.GetStableHashCode();
            if (ZDOMan.instance.m_objectsByID.Values.Any(z => z != null && z.GetPrefab() == hearthPrefab && Utils.DistanceXZ(z.GetPosition(), site.Position) < 80f))
            {
                return;
            }

            Vector3 spot = site.Position;
            if (ZoneSystem.instance.GetGroundHeight(spot, out float y))
            {
                spot.y = y;
            }

            spot = HearthGround.FlatSpotNear(spot);
            Vector3 facing = (parent.GetPosition() - spot).Horizontal();
            GameObject made = Object.Instantiate(HearthPrefab.Prefab, spot,
                facing.sqrMagnitude > 0.01f ? Quaternion.LookRotation(facing) : Quaternion.identity);
            ZDO zdo = made.GetComponent<ZNetView>()?.GetZDO();
            if (zdo == null)
            {
                return;
            }

            zdo.Set(VillageBrain.KeyManual, 1);
            zdo.Set(KeyParent, parent.GetInt(Keys.VillageId));
            zdo.Set(KeyGoods, site.Goods);
            VillheimPlugin.Log.LogInfo($"A daughter village of {parent.GetString(Keys.Name, "?")} lit its hearth at {spot}.");
        }

        /// <summary>VillageBrain.Initialize: a daughter village takes its goods and knows where it came from.</summary>
        public static void Initialized(VillageHearth hearth, VillageState state)
        {
            int parentId = hearth.Zdo.GetInt(KeyParent);
            if (parentId == 0)
            {
                return;
            }

            foreach (string entry in hearth.Zdo.GetString(KeyGoods, "").Split(','))
            {
                int colon = entry.IndexOf(':');
                if (colon > 0 && int.TryParse(entry.Substring(colon + 1), out int amount))
                {
                    state.Add(entry.Substring(0, colon), amount);
                }
            }

            hearth.Zdo.Set(KeyGoods, "");
            Relations.Set(hearth.Zdo, parentId, 80);
            ZDO parent = Relations.AllHearths().FirstOrDefault(z => z.GetInt(Keys.VillageId) == parentId);
            string from = parent != null ? parent.GetString(Keys.Name, "the old village") : "the old village";
            Chronicle.Add(hearth, $"We came from {from} to make a home of our own.");
            Dialogue.Note(state.Id, "founded");
        }

        // ---------------------------------------------------------------- reports and commands

        public static string Describe(VillageHearth hearth)
        {
            List<Site> sites = Read(hearth.Zdo);
            if (sites.Count == 0)
            {
                return "no daughter villages";
            }

            return "daughters: " + string.Join("; ", sites.Select(s =>
            {
                ZDO lit = Relations.AllHearths().FirstOrDefault(z => z.GetInt(KeyParent) == hearth.VillageId && Utils.DistanceXZ(z.GetPosition(), s.Position) < 80f);
                string where = $"{Utils.DistanceXZ(s.Position, hearth.transform.position):0} m {WorldLife.Compass(s.Position - hearth.transform.position)}";
                return lit != null ? $"{lit.GetString(Keys.Name, "?")} ({where})" : $"{(s.Arrived ? "settled, hearth not lit yet" : "settlers on the road")} ({where})";
            }));
        }

        /// <summary>'vh daughter': the nearest village sends settlers now. 'vh daughter here': the nearest settled site is lit now.</summary>
        public static string Command(string[] args)
        {
            Player player = Player.m_localPlayer;
            if (player == null)
            {
                return "No player.";
            }

            if (args != null && args.Length > 0 && args[0] == "here")
            {
                foreach (ZDO parent in Relations.AllHearths().ToList())
                {
                    foreach (Site site in Read(parent).OrderBy(s => Utils.DistanceXZ(s.Position, player.transform.position)))
                    {
                        if (Utils.DistanceXZ(site.Position, player.transform.position) < 200f && ZNetScene.instance.IsAreaReady(site.Position))
                        {
                            Light(parent, site);
                            return $"The hearth of {parent.GetString(Keys.Name, "?")}'s daughter village is lit.";
                        }
                    }
                }

                return "No daughter village site within 200 m. Walk to one (its pin) first.";
            }

            VillageHearth hearth = VillageHearth.Closest(player.transform.position, 200f);
            if (hearth == null)
            {
                return "No village within 200 m.";
            }

            if (!hearth.NView.IsOwner())
            {
                hearth.NView.ClaimOwnership();
            }

            var state = new VillageState(hearth.Zdo);
            return Send(hearth, state, out string why)
                ? Describe(hearth) + (On ? "" : " (WorldLife or Daughters is off: the hearth is not lit until they are on, or 'vh daughter here' at the site)")
                : $"{state.Name} sends nobody: {why}.";
        }
    }
}
