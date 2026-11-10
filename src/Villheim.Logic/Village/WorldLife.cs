using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using HarmonyLib;
using UnityEngine;
using Villheim.Logic.Villagers;
using Villheim.Prefabs;
using Random = UnityEngine.Random;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// The world between the villages: pedlars and pilgrims who visit them, hermits at camps by old ruins, and news
    /// that travels from one village to the next with the visitors. Ideas from Millenaire's foreign merchants and lone
    /// buildings, Minecraft's wandering trader, Mount and Blade's caravans and RimWorld's visitors; the code is our own.
    ///
    /// - Every ten seconds, on the client that owns a village's hearth and has a player within 120 m of it, a visitor
    ///   may come: a pedlar by day (08:00 to 15:00), a pilgrim at dusk (17:00 to 20:00). VisitorChancePerDay sets how
    ///   likely one comes in a day the player spends there, at most one per DaysBetweenVisitors. A visitor comes from
    ///   the direction of the nearest other village (and is "from" it), or from somewhere far off when there is none.
    /// - News: when something happens in a village (a building finished, a newcomer, a birth, a death, an attack
    ///   driven off, a good hunt), it goes on the village's news list. A visitor brings the latest news of the village
    ///   he comes from, and villagers pass it on ("{news}" in the dialogue, tag "news").
    /// - Hermits: by some ruins and abandoned houses in the Meadows, Black Forest and Mountains (HermitPlaces,
    ///   HermitBiomes, HermitChance percent of them, picked by position so every machine agrees), at least 400 m from
    ///   any village site, a hermit keeps a camp fire. The camp is made the first time a player comes within 160 m. A
    ///   hermit who dies is replaced after three days while the camp fire stands.
    ///
    /// Everything runs only with WorldLife on, apart from the 'vh pedlar', 'vh pilgrim' and 'vh hermit' test commands.
    /// Hermit camps are made on the host (single player or a listen server) only.
    /// </summary>
    internal static class WorldLife
    {
        private static readonly int KeyLastVisitor = "villheim_last_visitor".GetStableHashCode();
        private static readonly int KeyNews = "villheim_news".GetStableHashCode();
        private static readonly int KeyHeard = "villheim_heard".GetStableHashCode();
        public static readonly int KeyCamp = "villheim_hermitcamp".GetStableHashCode();
        private static readonly int KeyCampNext = "villheim_hermitnext".GetStableHashCode();

        private const float TickSeconds = 10f;
        private const float VisitRange = 120f;
        private const float CampRange = 160f;
        private const int KeepNews = 6;
        private const int KeepHeard = 8;

        private static float _nextTick;

        private static bool On => LogicConfig.WorldLife != null && LogicConfig.WorldLife.Value;

        private static double Now => ZNet.instance != null ? ZNet.instance.GetTimeSeconds() : Time.time;

        private static int Day => EnvMan.instance != null ? EnvMan.instance.GetDay() : 0;

        private static float Hour => EnvMan.instance != null ? EnvMan.instance.GetDayFraction() * 24f : 12f;

        [HarmonyPatch(typeof(Player), nameof(Player.Update))]
        internal static class TickPatch
        {
            private static void Postfix(Player __instance)
            {
                if (__instance != Player.m_localPlayer || Time.time < _nextTick)
                {
                    return;
                }

                _nextTick = Time.time + TickSeconds;
                if (!On || ZNet.instance == null || ZoneSystem.instance == null || EnvMan.instance == null)
                {
                    return;
                }

                try
                {
                    Tick(__instance);
                }
                catch (System.Exception e)
                {
                    VillheimPlugin.Log.LogWarning($"World life: {e}");
                }
            }
        }

        private static void Tick(Player player)
        {
            foreach (VillageHearth hearth in VillageHearth.All.ToList())
            {
                if (hearth != null && hearth.IsValid && hearth.NView.IsOwner() &&
                    Utils.DistanceXZ(hearth.transform.position, player.transform.position) < VisitRange)
                {
                    MaybeVisit(hearth);
                }
            }

            Trails.Paint(player.transform.position);
            Caravans.Embody(player.transform.position);
            if (ZNet.instance.IsServer())
            {
                MaybeMakeCamps(player.transform.position);
                Outposts.EnsureCamps(player.transform.position);
                Daughters.EnsureHearths(player.transform.position);
                Trails.Signposts(player.transform.position);
            }
        }

        // ---------------------------------------------------------------- visitors

        private static void MaybeVisit(VillageHearth hearth)
        {
            var state = new VillageState(hearth.Zdo);
            if (!state.Initialized || state.Plots.Count == 0)
            {
                return;
            }

            double day = VillageBrain.DayLength();
            double last = hearth.Zdo.GetLong(KeyLastVisitor) / 10.0;
            float between = LogicConfig.DaysBetweenVisitors != null ? LogicConfig.DaysBetweenVisitors.Value : 1f;
            if (last > 0.0 && Now - last < between * day)
            {
                return;
            }

            string kind = Hour >= 8f && Hour < 15f ? Wanderers.Pedlar : Hour >= 17f && Hour < 20f ? Wanderers.Pilgrim : null;
            if (kind == null || EnvMan.IsWet() || VisitorThere(state.Id) || VisitorJudging.Waiting(hearth))
            {
                return;
            }

            // The day's chance, spread over the checks in the hours a visitor can come (about seven of them).
            float perDay = LogicConfig.VisitorChancePerDay != null ? LogicConfig.VisitorChancePerDay.Value : 0.5f;
            // Prosperity, a festival and how the last visitor found the place (Living).
            perDay = Mathf.Clamp01(perDay * Living.VisitorFactor(hearth));
            double checks = 7.0 / 24.0 * day / TickSeconds;
            double perCheck = 1.0 - System.Math.Pow(1.0 - Mathf.Clamp01(perDay), 1.0 / System.Math.Max(1.0, checks));
            if (Random.value > perCheck)
            {
                return;
            }

            SendVisitor(hearth, kind);
        }

        private static bool VisitorThere(int villageId) =>
            Character.GetAllCharacters().OfType<Villager>().Any(v => !v.IsDead() &&
                                                                     (Wanderers.KindOf(v) == Wanderers.Pedlar || Wanderers.KindOf(v) == Wanderers.Pilgrim) &&
                                                                     v.Zdo.GetInt(Wanderers.KeyVisit) == villageId);

        /// <summary>Sends a pedlar or pilgrim walking in to <paramref name="hearth"/>. Null when no spot was found.</summary>
        public static Villager SendVisitor(VillageHearth hearth, string kind)
        {
            var state = new VillageState(hearth.Zdo);
            Vector3 center = hearth.transform.position;
            ZDO other = NearestOtherVillage(center, state.Id);
            Vector3 toward = other != null ? (other.GetPosition() - center).Horizontal().normalized : Random.insideUnitSphere.Horizontal().normalized;
            if (toward.sqrMagnitude < 0.01f)
            {
                toward = Vector3.forward;
            }

            // Within sight of the player's loaded area, or he would stand frozen out there until someone came by.
            Player player = Player.m_localPlayer;
            if (!FindOpenGround(center, toward, 75f, 95f, out Vector3 spawn,
                    p => player == null || Utils.DistanceXZ(p, player.transform.position) < 110f))
            {
                VillheimPlugin.Log.LogInfo($"No dry ground for a {kind} to walk in from at {state.Name}.");
                return null;
            }

            string from = other != null ? other.GetString(Keys.Name, "") : Personality.FarPlace(Random.Range(0, int.MaxValue));
            Vector3 meet = center + (spawn - center).Horizontal().normalized * 5f;
            Villager visitor = Wanderers.Spawn(kind, spawn, meet, from, state.Id);
            if (visitor == null)
            {
                return null;
            }

            // They go on the way they were heading: out the far side, turned a little.
            visitor.Zdo.Set(Wanderers.KeyAway, Quaternion.Euler(0f, Random.Range(-60f, 60f), 0f) * -toward);
            visitor.Zdo.Set(KeyFromVillage, other != null ? other.GetInt(Keys.VillageId) : 0);
            hearth.Zdo.Set(KeyLastVisitor, (long)(Now * 10.0));
            return visitor;
        }

        internal static readonly int KeyFromVillage = "villheim_wfromid".GetStableHashCode();

        /// <summary>A visitor has reached the hearth: greetings, news, and for a pedlar a trade with the chest.</summary>
        public static void Arrived(Villager visitor, string kind, VillageHearth hearth)
        {
            var state = new VillageState(hearth.Zdo);
            string from = visitor.Zdo.GetString(Wanderers.KeyFrom, "");
            int news = CarryNews(visitor.Zdo.GetInt(KeyFromVillage), hearth);
            Relations.Visited(hearth, visitor.Zdo.GetInt(KeyFromVillage));
            VisitorJudging.Arrived(visitor, hearth);
            Villagers.Social.Gather(state.Id, visitor, null, kind == Wanderers.Pedlar ? 2 : 1, "event:" + kind, "wave", 40f);
            Dialogue.Note(state.Id, kind);
            string goods = kind == Wanderers.Pedlar ? TradeWithChest(hearth, state) : null;
            if (kind == Wanderers.Pedlar)
            {
                SellGear(visitor, hearth);
            }

            if (kind == Wanderers.Pedlar)
            {
                Moods.VillageThink(state.Id, "trade");
            }

            string who = kind == Wanderers.Pedlar ? "A pedlar" : "A pilgrim";
            string text = $"{who}, {visitor.VillagerName}, came from {(from.Length > 0 ? from : "far off")}" +
                          (goods != null ? $" and traded us {goods}" : "") + (news > 0 ? ", with news from the road" : "") + ".";
            Chronicle.Add(hearth, text);
            Dialogue.Say(visitor, Dialogue.LineFor(visitor, "greet", "wanderer") ?? "Hello, the hearth!", 6f);
        }

        /// <summary>A pilgrim leaving at dawn: a quiet blessing that lifts the village's mood for a while.</summary>
        public static void Blessing(Villager pilgrim, VillageHearth hearth)
        {
            Poses.Gesture(pilgrim, "bow");
            Moods.VillageThink(hearth.VillageId, "blessing");
            Chronicle.Add(hearth, $"{pilgrim.VillagerName} the pilgrim slept by the hearth and blessed it before going on.");
            Dialogue.Note(hearth.VillageId, "blessing");
        }

        /// <summary>
        /// The pedlar brings what the village is shortest of, up to 15, paid for with the chest's coins first and then
        /// with what it can spare (the village store's own list and prices). Returns "10 core wood" or null.
        /// </summary>
        private static string TradeWithChest(VillageHearth hearth, VillageState state)
        {
            Container chest = VillageChest.Find(hearth);
            VillageNeeds needs = VillageNeeds.For(state.Id);
            if (chest == null || needs == null || needs.Missing.Count == 0)
            {
                return null;
            }

            foreach (KeyValuePair<string, int> need in needs.Missing.OrderByDescending(n => n.Value))
            {
                GameObject prefab = ObjectDB.instance.GetItemPrefab(need.Key);
                if (prefab == null || !Market.Prices.TryGetValue(need.Key, out (int Stack, int Price) deal))
                {
                    continue;
                }

                float unit = deal.Price / (float)deal.Stack;
                int wanted = Mathf.Clamp(need.Value, 1, 15);
                int paid = Pay(hearth, chest, Mathf.CeilToInt(wanted * unit), need.Key);
                // Whatever he is paid, he leaves a couple as a sweetener for next time.
                int brought = Mathf.Max(2, Mathf.Min(wanted, Mathf.FloorToInt(paid / unit)));
                chest.GetInventory().AddItem(prefab, brought);
                VillheimPlugin.Log.LogInfo($"{state.Name}: a pedlar brought {brought} {need.Key} for {paid} coins' worth.");
                return $"{brought} {Materials.Label(need.Key)}";
            }

            return null;
        }

        /// <summary>
        /// A village that has outgrown its gear but has no station to make the next set buys it from the pedlar, if the
        /// chest has the coins (40 a tier).
        /// </summary>
        private static void SellGear(Villager pedlar, VillageHearth hearth)
        {
            Container chest = VillageChest.Find(hearth);
            int price = Smithing.PedlarPrice(hearth, out int tier);
            GameObject coins = ObjectDB.instance.GetItemPrefab("Coins");
            if (price <= 0 || chest == null || coins == null)
            {
                return;
            }

            string coinName = coins.GetComponent<ItemDrop>().m_itemData.m_shared.m_name;
            if (chest.GetInventory().CountItems(coinName) < price)
            {
                return;
            }

            chest.GetInventory().RemoveItem(coinName, price);
            Smithing.Raise(hearth, tier, $"We bought {Smithing.TierName(tier)} gear from {pedlar.VillagerName} the pedlar for {price} coins.");
        }

        /// <summary>Takes up to <paramref name="cost"/> worth from the chest: coins, then spare goods. Returns the worth taken.</summary>
        private static int Pay(VillageHearth hearth, Container chest, int cost, string notThis)
        {
            Inventory inventory = chest.GetInventory();
            int paid = 0;
            GameObject coinsPrefab = ObjectDB.instance.GetItemPrefab("Coins");
            if (coinsPrefab != null)
            {
                string coinName = coinsPrefab.GetComponent<ItemDrop>().m_itemData.m_shared.m_name;
                int coins = Mathf.Min(inventory.CountItems(coinName), cost);
                if (coins > 0)
                {
                    inventory.RemoveItem(coinName, coins);
                    paid += coins;
                }
            }

            if (paid >= cost)
            {
                return paid;
            }

            HashSet<string> smith = Smithing.Reserved(hearth);
            foreach (Trader.TradeItem spare in Market.Stock(hearth, chest))
            {
                if (paid >= cost || spare.m_prefab == null || spare.m_prefab.gameObject.name == notThis ||
                    smith.Contains(spare.m_prefab.gameObject.name))
                {
                    continue;
                }

                inventory.RemoveItem(spare.m_prefab.m_itemData.m_shared.m_name, spare.m_stack);
                paid += spare.m_price;
            }

            return paid;
        }

        // ---------------------------------------------------------------- news

        /// <summary>Something happened in a village that people elsewhere would talk about.</summary>
        public static void NoteNews(int villageId, string what)
        {
            VillageHearth hearth = VillageHearth.Find(villageId);
            if (hearth == null || !hearth.IsValid || !hearth.NView.IsOwner())
            {
                return;
            }

            if (what == "death")
            {
                // The events director holds back bad luck for a few days after a death.
                hearth.Zdo.Set(VillageEvents.KeyLastLoss, Day);
            }

            string v = new VillageState(hearth.Zdo).Name;
            string text;
            switch (what)
            {
                case "finished": text = $"{v} has put up another building"; break;
                case "arrival": text = $"someone new has settled in {v}"; break;
                case "birth": text = $"there's a new baby in {v}"; break;
                case "death": text = $"{v} buried one of their own"; break;
                case "fightover": text = $"{v} fought off an attack"; break;
                case "hunt": text = $"the hunters of {v} came home with plenty"; break;
                case "upgrade": text = $"{v} is rebuilding bigger"; break;
                case "outpost": text = $"{v} has sent people out to make a camp in the wilds"; break;
                case "feast": text = $"{v} had a good harvest and a feast"; break;
                case "skald": text = $"a skald sang at {v}"; break;
                case "fair": text = $"people from {v} came to market"; break;
                case "takenin": text = $"{v} took in a lost traveler"; break;
                case "sickness": text = $"there's fever in {v}"; break;
                case "beasts": text = $"beasts have been prowling round {v} at night"; break;
                case "quarrel": text = $"two in {v} aren't speaking"; break;
                case "dispute": text = $"{v} has fallen out with its neighbors"; break;
                case "caravan": text = $"a caravan from {v} is on the road"; break;
                case "daughter": text = $"people from {v} have gone off to found a village of their own"; break;
                case "founded": text = $"a new village has been founded near {v}"; break;
                default: return;
            }

            List<string> news = Lines(hearth.Zdo, KeyNews);
            if (news.Any(n => n.EndsWith("|" + text) && n.StartsWith(Day + "|")))
            {
                return;
            }

            news.Add($"{Day}|{text}");
            Save(hearth.Zdo, KeyNews, news, KeepNews);
        }

        /// <summary>Copies the latest news of village <paramref name="fromId"/> into what <paramref name="hearth"/> has heard.</summary>
        private static int CarryNews(int fromId, VillageHearth hearth)
        {
            ZDO from = fromId != 0 ? HearthZdos().FirstOrDefault(z => z.GetInt(Keys.VillageId) == fromId) : null;
            if (from == null)
            {
                return 0;
            }

            List<string> heard = Lines(hearth.Zdo, KeyHeard);
            int added = 0;
            foreach (string item in Lines(from, KeyNews).AsEnumerable().Reverse().Take(2))
            {
                if (!heard.Contains(item))
                {
                    heard.Add(item);
                    added++;
                }
            }

            Save(hearth.Zdo, KeyHeard, heard, KeepHeard);
            return added;
        }

        /// <summary>A piece of news heard in this village in the last five days, or null.</summary>
        public static string HeardNews(int villageId)
        {
            VillageHearth hearth = VillageHearth.Find(villageId);
            if (hearth == null || !hearth.IsValid)
            {
                return null;
            }

            List<string> fresh = Lines(hearth.Zdo, KeyHeard)
                .Where(l => int.TryParse(l.Split('|')[0], out int day) && Day - day <= 5).ToList();
            return fresh.Count > 0 ? fresh[Random.Range(0, fresh.Count)].Split(new[] { '|' }, 2)[1] : null;
        }

        /// <summary>A visitor's own news: the latest from the village he comes from.</summary>
        public static string VisitorNews(Villager visitor)
        {
            int fromId = visitor.Zdo.GetInt(KeyFromVillage);
            ZDO from = fromId != 0 ? HearthZdos().FirstOrDefault(z => z.GetInt(Keys.VillageId) == fromId) : null;
            List<string> news = from != null ? Lines(from, KeyNews) : new List<string>();
            return news.Count > 0 ? news[Random.Range(0, news.Count)].Split(new[] { '|' }, 2)[1] : null;
        }

        private static List<string> Lines(ZDO zdo, int key) =>
            zdo.GetString(key, "").Split('\n').Where(l => l.Contains("|")).ToList();

        private static void Save(ZDO zdo, int key, List<string> lines, int keep)
        {
            if (lines.Count > keep)
            {
                lines.RemoveRange(0, lines.Count - keep);
            }

            zdo.Set(key, string.Join("\n", lines));
        }

        /// <summary>Every lived-in village hearth this machine knows of, loaded or not.</summary>
        private static IEnumerable<ZDO> HearthZdos() => Relations.AllHearths();

        private static ZDO NearestOtherVillage(Vector3 center, int villageId)
        {
            return HearthZdos().Where(z => z.GetInt(Keys.VillageId) != villageId)
                .OrderBy(z => Utils.DistanceXZ(z.GetPosition(), center)).FirstOrDefault();
        }

        // ---------------------------------------------------------------- wares

        // Prefab, stack, price. A pedlar's goods are a little ahead of the village's biome; the hermit's are odd bits.
        private static readonly (string Item, int Stack, int Price)[] MeadowsWares =
        {
            ("RoundLog", 5, 20), ("FineWood", 10, 20), ("Resin", 10, 8), ("Coal", 10, 12), ("TrollHide", 2, 40),
            ("GreydwarfEye", 5, 10), ("Thistle", 5, 12), ("MeadHealthMinor", 1, 25), ("QueensJam", 2, 20), ("BoneFragments", 10, 8),
        };

        private static readonly (string Item, int Stack, int Price)[] ForestWares =
        {
            ("RoundLog", 10, 30), ("Coal", 10, 12), ("Guck", 3, 25), ("Ooze", 5, 20), ("Chain", 1, 60),
            ("WolfPelt", 2, 40), ("MeadHealthMinor", 1, 25), ("MeadStaminaMinor", 1, 25), ("Turnip", 5, 20), ("Entrails", 5, 12),
        };

        private static readonly (string Item, int Stack, int Price)[] HermitWares =
        {
            ("Honey", 3, 15), ("Raspberry", 10, 8), ("Blueberries", 10, 8), ("MushroomYellow", 5, 15), ("Feathers", 10, 10),
            ("Thistle", 5, 12), ("Dandelion", 5, 8), ("Resin", 10, 8), ("AmberPearl", 1, 20), ("MeadHealthMinor", 1, 30),
        };

        public static List<Trader.TradeItem> WaresFor(Villager wanderer)
        {
            var items = new List<Trader.TradeItem>();
            string kind = Wanderers.KindOf(wanderer);
            (string, int, int)[] table = kind == Wanderers.Hermit ? HermitWares
                : WorldGenerator.instance != null && WorldGenerator.instance.GetBiome(wanderer.transform.position) != Heightmap.Biome.Meadows
                    ? ForestWares : MeadowsWares;
            // Each wanderer carries a different handful, fixed by his seed.
            var rng = new System.Random(wanderer.Zdo.GetInt(Keys.VillagerSeed));
            foreach ((string item, int stack, int price) in table.OrderBy(_ => rng.Next()).Take(6))
            {
                GameObject prefab = ObjectDB.instance.GetItemPrefab(item);
                ItemDrop drop = prefab != null ? prefab.GetComponent<ItemDrop>() : null;
                if (drop != null)
                {
                    items.Add(new Trader.TradeItem { m_prefab = drop, m_stack = stack, m_price = price, m_requiredGlobalKey = "" });
                }
            }

            return items;
        }

        // ---------------------------------------------------------------- hermit camps

        private static readonly HashSet<Vector3> CheckedLocations = new HashSet<Vector3>();

        private static void MaybeMakeCamps(Vector3 around)
        {
            if (!(LogicConfig.HermitChance?.Value > 0))
            {
                return;
            }

            string[] places = Split(LogicConfig.HermitPlaces?.Value);
            string[] biomes = Split(LogicConfig.HermitBiomes?.Value);
            // Only the values: the dictionary's key type has changed between game versions.
            foreach (ZoneSystem.LocationInstance instance in ZoneSystem.instance.m_locationInstances.Values)
            {
                string name = instance.m_location?.m_prefabName ?? "";
                if (Utils.DistanceXZ(instance.m_position, around) > CampRange || !places.Any(p => name.StartsWith(p)))
                {
                    continue;
                }

                if (Score(instance.m_position) % 100 >= LogicConfig.HermitChance.Value)
                {
                    continue;
                }

                Heightmap.Biome biome = WorldGenerator.instance.GetBiome(instance.m_position);
                if (!biomes.Any(b => string.Equals(b, biome.ToString(), System.StringComparison.OrdinalIgnoreCase)) ||
                    NearVillageSite(instance.m_position, 400f))
                {
                    continue;
                }

                EnsureCamp(instance.m_position, name, !CheckedLocations.Contains(instance.m_position));
                CheckedLocations.Add(instance.m_position);
            }
        }

        private static string[] Split(string list) =>
            (list ?? "").Split(',').Select(s => s.Trim()).Where(s => s.Length > 0).ToArray();

        private static int Score(Vector3 position)
        {
            unchecked
            {
                int hash = (int)position.x * 73856093 ^ (int)position.z * 83492791 ^ 0x5bd1e995;
                hash ^= hash >> 13;
                hash *= 0x5bd1e995;
                return (hash ^ (hash >> 15)) & 0x7fffffff;
            }
        }

        private static bool NearVillageSite(Vector3 point, float distance) =>
            ZoneSystem.instance.m_locationInstances.Values.Any(l => l.m_location?.m_prefabName == VillageLocation.Name &&
                                                                     Utils.DistanceXZ(l.m_position, point) < distance) ||
            HearthZdos().Any(z => Utils.DistanceXZ(z.GetPosition(), point) < distance);

        /// <summary>The camp by a location, made if it is missing; its hermit, made if missing and due.</summary>
        private static void EnsureCamp(Vector3 location, string locationName, bool log)
        {
            Fireplace fire = CampNear(location, 45f, true);
            if (fire == null)
            {
                Vector3 outward = Quaternion.Euler(0f, Score(location) % 360, 0f) * Vector3.forward;
                if (!FindOpenGround(location, outward, 18f, 28f, out Vector3 spot))
                {
                    if (log)
                    {
                        VillheimPlugin.Log.LogInfo($"No flat dry ground for a hermit's camp by {locationName} at {location}.");
                    }

                    return;
                }

                fire = MakeCamp(spot);
                if (fire == null)
                {
                    return;
                }

                VillheimPlugin.Log.LogInfo($"A hermit's camp by {locationName} at {spot}.");
            }

            ZDO camp = fire.m_nview.GetZDO();
            Vector3 at = fire.transform.position;
            // Looked for among the saved objects, so a hermit who has wandered out of the loaded area still counts.
            int villagerPrefab = VillagerPrefab.Name.GetStableHashCode();
            bool hermitHere = ZDOMan.instance.m_objectsByID.Values.Any(z => z != null && z.GetPrefab() == villagerPrefab &&
                                                                           z.GetString(Wanderers.KeyKind, "") == Wanderers.Hermit &&
                                                                           Utils.DistanceXZ(z.GetVec3(Wanderers.KeyTarget, Vector3.zero), at) < 4f);
            if (hermitHere)
            {
                if (camp.GetLong(KeyCampNext) != 0L && fire.m_nview.IsOwner())
                {
                    camp.Set(KeyCampNext, 0L);
                }

                return;
            }

            if (!fire.m_nview.IsOwner())
            {
                return;
            }

            long next = camp.GetLong(KeyCampNext);
            if (next == 0L && camp.GetBool("villheim_hermitmade".GetStableHashCode()))
            {
                // The hermit is gone: a new one comes in three days.
                camp.Set(KeyCampNext, (long)((Now + 3.0 * VillageBrain.DayLength()) * 10.0));
                return;
            }

            if (next != 0L && Now < next / 10.0)
            {
                return;
            }

            SpawnHermit(fire);
        }

        private static Villager SpawnHermit(Fireplace fire)
        {
            Vector3 at = fire.transform.position;
            Vector3 spawn = at + Quaternion.Euler(0f, Random.Range(0f, 360f), 0f) * Vector3.forward * 2.5f;
            Villager hermit = Wanderers.Spawn(Wanderers.Hermit, spawn, at, "", 0);
            ZDO camp = fire.m_nview.GetZDO();
            camp.Set("villheim_hermitmade".GetStableHashCode(), true);
            camp.Set(KeyCampNext, 0L);
            return hermit;
        }

        public static Fireplace MakeCamp(Vector3 spot)
        {
            GameObject prefab = ZNetScene.instance.GetPrefab("fire_pit");
            if (prefab == null)
            {
                return null;
            }

            GameObject made = Object.Instantiate(prefab, spot, Quaternion.Euler(0f, Random.Range(0f, 360f), 0f));
            Fireplace fire = made.GetComponent<Fireplace>();
            ZNetView view = made.GetComponent<ZNetView>();
            if (fire == null || view == null || !view.IsValid())
            {
                return null;
            }

            view.GetZDO().Set(KeyCamp, true);
            Feed(fire);
            return fire;
        }

        public static void Feed(Fireplace fire)
        {
            if (fire != null && fire.m_nview != null && fire.m_nview.IsValid() && fire.m_nview.IsOwner())
            {
                fire.m_nview.GetZDO().Set(ZDOVars.s_fuel, fire.m_maxFuel);
            }
        }

        private static Fireplace CampNear(Vector3 point, float radius, bool hermitsOnly = false)
        {
            var pieces = new List<Piece>();
            PieceIndex.InRadius(point, radius, pieces);
            foreach (Piece piece in pieces)
            {
                if (piece != null && piece.m_nview != null && piece.m_nview.IsValid() && piece.m_nview.GetZDO().GetBool(KeyCamp) &&
                    (!hermitsOnly || piece.m_nview.GetZDO().GetInt(Outposts.KeyOutpostVillage) == 0) &&
                    piece.TryGetComponent(out Fireplace fire))
                {
                    return fire;
                }
            }

            return null;
        }

        /// <summary>The hermit's own camp fire, if it still stands.</summary>
        public static Fireplace CampOf(Vector3 camp, float radius = 4f) => CampNear(camp, radius);

        /// <summary>
        /// A spot <paramref name="min"/> to <paramref name="max"/> m from <paramref name="center"/>, as near the direction
        /// <paramref name="toward"/> as can be found, on dry ground that is fairly flat.
        /// </summary>
        private static bool FindOpenGround(Vector3 center, Vector3 toward, float min, float max, out Vector3 spot,
            System.Func<Vector3, bool> allowed = null)
        {
            float water = ZoneSystem.instance.m_waterLevel;
            for (int i = 0; i < 16; i++)
            {
                float turn = (i + 1) / 2 * 22.5f * (i % 2 == 0 ? 1f : -1f);
                Vector3 direction = Quaternion.Euler(0f, turn, 0f) * toward;
                float distance = Mathf.Lerp(min, max, (i % 4) / 3f);
                Vector3 point = center + direction.normalized * distance;
                if (allowed != null && !allowed(point))
                {
                    continue;
                }

                if (!ZoneSystem.instance.GetGroundHeight(point, out float y) || y < water + 1f)
                {
                    continue;
                }

                float slope = 0f;
                foreach (Vector3 step in new[] { Vector3.forward, Vector3.right, Vector3.back, Vector3.left })
                {
                    if (ZoneSystem.instance.GetGroundHeight(point + step * 2f, out float side))
                    {
                        slope = Mathf.Max(slope, Mathf.Abs(side - y));
                    }
                }

                if (slope < 1.2f)
                {
                    spot = new Vector3(point.x, y, point.z);
                    return true;
                }
            }

            spot = Vector3.zero;
            return false;
        }

        // ---------------------------------------------------------------- what hermits know

        // Location name start, how a hermit calls it, pin label.
        private static readonly (string Prefix, string Said, string Pin)[] Places =
        {
            ("Vendor_BlackForest", "a trader's camp, a big man with a big pack", "Trader (hermit)"),
            ("Hildir_camp", "a woman's camp with tents and too many hats", "Hildir (hermit)"),
            ("BogWitch_Camp", "a hut in the swamp where an old woman brews things", "Bog witch (hermit)"),
            ("Eikthyrnir", "the stag's altar, where the antlered one waits", "Stag altar (hermit)"),
            ("GDKing", "the elder's stones, deep in the forest", "Elder (hermit)"),
            ("Bonemass", "the swamp king's altar", "Swamp altar (hermit)"),
            ("Crypt", "a burial chamber with a heavy door", "Burial chamber (hermit)"),
            ("SunkenCrypt", "a sunken crypt full of bad water", "Sunken crypt (hermit)"),
            ("TrollCave", "a troll cave, and I mean a troll", "Troll cave (hermit)"),
            ("MountainCave", "a frost cave in the mountain", "Frost cave (hermit)"),
            ("Runestone_Greydwarfs", "a runestone the greydwarfs gather round", "Runestone (hermit)"),
        };

        /// <summary>
        /// The hermit tells the player of the nearest place in his list the player has no pin for yet (once per player
        /// per hermit) and marks it on the map. False when there is nothing (left) to tell.
        /// </summary>
        public static bool TellOfPlace(Villager hermit, Player player, out string said)
        {
            said = null;
            ZDO zdo = hermit.Zdo;
            string id = player.GetPlayerID().ToString(CultureInfo.InvariantCulture);
            List<string> told = zdo.GetString(Wanderers.KeyTold, "").Split(',').ToList();
            if (told.Contains(id) || Minimap.instance == null)
            {
                return false;
            }

            Vector3 from = hermit.transform.position;
            (Vector3 Position, string Said, string Pin)? best = null;
            float bestDistance = 3000f;
            foreach (ZoneSystem.LocationInstance instance in ZoneSystem.instance.m_locationInstances.Values)
            {
                string name = instance.m_location?.m_prefabName ?? "";
                int index = System.Array.FindIndex(Places, p => name.StartsWith(p.Prefix));
                float distance = Utils.DistanceXZ(instance.m_position, from);
                if (index < 0 || distance > bestDistance || distance < 60f || PinNear(instance.m_position))
                {
                    continue;
                }

                best = (instance.m_position, Places[index].Said, Places[index].Pin);
                bestDistance = distance;
            }

            if (best == null)
            {
                return false;
            }

            told.Add(id);
            zdo.Set(Wanderers.KeyTold, string.Join(",", told.Where(t => t.Length > 0)));
            MapPins.AddPin(Minimap.instance, best.Value.Position, Minimap.PinType.Icon3, best.Value.Pin, true);
            string where = $"{Far(bestDistance)} to the {Compass(best.Value.Position - from)}";
            string[] ways =
            {
                $"There's {best.Value.Said}, {where}. I've marked it on your map. Don't tell anyone I told you.",
                $"You look like you go places. Try {where}: {best.Value.Said}. It's on your map now.",
                $"I walked past {best.Value.Said} once. {char.ToUpperInvariant(where[0]) + where.Substring(1)}. Your map knows the way now.",
                $"Go {where} and you'll find {best.Value.Said}. I put a mark on your map. Bring me nothing back, I have enough.",
            };
            said = ways[Random.Range(0, ways.Length)];
            return true;
        }

        private static bool PinNear(Vector3 point) =>
            Minimap.instance.m_pins.Any(p => Utils.DistanceXZ(p.m_pos, point) < 40f);

        public static string Compass(Vector3 direction)
        {
            float angle = Mathf.Atan2(direction.x, direction.z) * Mathf.Rad2Deg;
            string[] names = { "north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west" };
            return names[(Mathf.RoundToInt(angle / 45f) % 8 + 8) % 8];
        }

        private static string Far(float metres) =>
            metres < 300f ? "not far" : metres < 800f ? "a short walk" : metres < 1500f ? "a good walk" : "most of a day's walk";

        // ---------------------------------------------------------------- commands

        public static string Command(string kind)
        {
            Player player = Player.m_localPlayer;
            if (player == null)
            {
                return "No player.";
            }

            if (kind == Wanderers.Hermit)
            {
                Vector3 ahead = player.transform.position + player.transform.forward * 6f;
                Fireplace fire = CampNear(ahead, 30f, true) ?? MakeCamp(ahead);
                if (fire == null)
                {
                    return "Could not make a camp fire here.";
                }

                SpawnHermit(fire);
                return "A hermit's camp in front of you.";
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

            Villager visitor = SendVisitor(hearth, kind);
            return visitor != null ? $"A {kind} is walking in to {hearth.VillageName}." : "No dry ground for a visitor to walk in from.";
        }

        public static string Report()
        {
            Player player = Player.m_localPlayer;
            var lines = new List<string> { $"World life is {(On ? "on" : "off")} (WorldLife in the config)." };
            foreach (Villager v in Character.GetAllCharacters().OfType<Villager>().Where(Wanderers.IsWanderer))
            {
                float distance = player != null ? Vector3.Distance(v.transform.position, player.transform.position) : 0f;
                lines.Add($"{Wanderers.KindOf(v)} {v.VillagerName}, {distance:0} m away: {Wanderers.Describe(v)}");
            }

            VillageHearth hearth = player != null ? VillageHearth.Closest(player.transform.position, 300f) : null;
            if (hearth != null)
            {
                lines.Add($"{hearth.VillageName} news: {string.Join("; ", Lines(hearth.Zdo, KeyNews))}");
                lines.Add($"{hearth.VillageName} has heard: {string.Join("; ", Lines(hearth.Zdo, KeyHeard))}");
            }

            return string.Join("\n", lines);
        }
    }
}
