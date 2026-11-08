using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Designs;
using Villheim.Logic.Villagers;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Each village belongs to a culture: one of the peoples of the Viking-age world the heroes came from. The
    /// culture gives villagers their names, looks and clothes, names the four seasonal feasts, adds a few lines of its
    /// own and picks building sets where the design library has any for it.
    ///
    /// - Which cultures a biome's villages may have: the setting CultureMap, biome = culture:weight list. A new village
    ///   rolls one from its biome's list with its own seed and keeps it (stored on the hearth).
    /// - A village that already had villagers before cultures existed takes the first culture listed for its biome,
    ///   so its people keep a familiar look.
    /// - Each villager carries his own culture. Most share the village's; a newcomer may come from another people
    ///   (CultureForeignChance) and keeps his own name and looks. Children take a parent's.
    /// - The data (names, looks, feasts, design sets) is in Cultures/cultures.txt.
    ///
    /// Other code asks: Cultures.Of(state), Cultures.OfVillage(id), Cultures.OfVillager(villager), Cultures.Get(key).
    /// </summary>
    internal static class Cultures
    {
        public const string Fallback = "norse";

        /// <summary>The villager's own culture key on his ZDO.</summary>
        public static readonly int KeyVillager = "villheim_vculture".GetStableHashCode();

        public const string DefaultMap =
            "Meadows=norse:3,anglo-saxon:1,frankish-norman:1; BlackForest=norse-forest:2,celtic:1,slavic:1; " +
            "Swamp=celtic-crannog:1,baltic:1,fen-folk:1; Mountain=norse-highland:1,saami:1; " +
            "Plains=middle-eastern:2,byzantine:1,steppe:1; Mistlands=byzantine:1,caucasian-highland:1";

        /// <summary>The default before D-039 (Mountains cultures equally common), moved to the new one on load.</summary>
        public const string OldDefaultMap =
            "Meadows=norse:3,anglo-saxon:1,frankish-norman:1; BlackForest=norse-forest:2,celtic:1,slavic:1; " +
            "Swamp=celtic-crannog:1,baltic:1,fen-folk:1; Mountain=norse-highland:2,saami:1; " +
            "Plains=middle-eastern:2,byzantine:1,steppe:1; Mistlands=byzantine:1,caucasian-highland:1";

        internal readonly struct Wear
        {
            public readonly string Prefab;
            public readonly int MinTier;
            public readonly float Weight;

            /// <summary>0 anyone, 1 men only, 2 women only.</summary>
            public readonly int Sex;

            public Wear(string prefab, int minTier, float weight, int sex)
            {
                Prefab = prefab;
                MinTier = minTier;
                Weight = weight;
                Sex = sex;
            }
        }

        internal sealed class Culture
        {
            public string Key;
            public string Name;
            public string People;
            public string Leader = "Jarl";
            public string[] Male = new string[0];
            public string[] Female = new string[0];
            public string Surname = "none";
            public float SurnameChance = 1f;
            public string[] Seats = new string[0];
            public (string Male, string Female)[] Families = new (string, string)[0];
            public string[] PlaceStart = new string[0];
            public string[] PlaceEnd = new string[0];
            public string[] Festivals = new string[0];
            public Vector2 Skin = new Vector2(0.25f, 1f);
            public Vector2 HairShade = new Vector2(0.1f, 1f);
            public Vector2 HairRed = new Vector2(0f, 1f);
            public float Beard = 0.8f;
            public Dictionary<string, float> HairPrefer = new Dictionary<string, float>();
            public Dictionary<string, float> BeardPrefer = new Dictionary<string, float>();
            public Dictionary<string, List<Wear>> Clothes = new Dictionary<string, List<Wear>>();
            public Dictionary<Role, string[]> Designs = new Dictionary<Role, string[]>();

            public Culture Copy(string key)
            {
                var copy = (Culture)MemberwiseClone();
                copy.Key = key;
                copy.HairPrefer = new Dictionary<string, float>(HairPrefer);
                copy.BeardPrefer = new Dictionary<string, float>(BeardPrefer);
                copy.Clothes = Clothes.ToDictionary(p => p.Key, p => new List<Wear>(p.Value));
                copy.Designs = new Dictionary<Role, string[]>(Designs);
                return copy;
            }
        }

        private static Dictionary<string, Culture> _data;

        public static bool On => LogicConfig.IsOn(LogicConfig.Cultures);

        // ---------------------------------------------------------------- data

        public static IEnumerable<Culture> All => Data().Values;

        public static bool Known(string key) => key != null && Data().ContainsKey(key);

        /// <summary>The culture with this key, or the Norse one when the key is unknown.</summary>
        public static Culture Get(string key)
        {
            Dictionary<string, Culture> data = Data();
            if (key != null && data.TryGetValue(key, out Culture culture))
            {
                return culture;
            }

            return data.TryGetValue(Fallback, out Culture norse) ? norse : data.Values.FirstOrDefault() ?? new Culture { Key = Fallback, Name = "Norse", People = "norse" };
        }

        private static Dictionary<string, Culture> Data()
        {
            if (_data != null)
            {
                return _data;
            }

            _data = new Dictionary<string, Culture>();
            try
            {
                var assembly = typeof(Cultures).Assembly;
                using (Stream stream = assembly.GetManifestResourceStream("Villheim.Logic.Cultures.cultures.txt"))
                {
                    if (stream == null)
                    {
                        VillheimPlugin.Log.LogWarning("Cultures: cultures.txt is missing from the logic build; every village is Norse.");
                        return _data;
                    }

                    using (var reader = new StreamReader(stream))
                    {
                        Parse(reader.ReadToEnd());
                    }
                }
            }
            catch (Exception ex)
            {
                VillheimPlugin.Log.LogWarning($"Cultures: could not read cultures.txt: {ex.Message}");
            }

            VillheimPlugin.Log.LogInfo($"Cultures: {_data.Count} cultures ({string.Join(", ", _data.Keys)}).");
            return _data;
        }

        private static void Parse(string text)
        {
            Culture current = null;
            int number = 0;
            foreach (string raw in text.Split('\n'))
            {
                number++;
                string line = raw.Trim();
                if (line.Length == 0 || line.StartsWith("#"))
                {
                    continue;
                }

                if (line.StartsWith("[") && line.EndsWith("]"))
                {
                    string key = line.Substring(1, line.Length - 2).Trim().ToLowerInvariant();
                    current = new Culture { Key = key, Name = key, People = key };
                    _data[key] = current;
                    continue;
                }

                int equals = line.IndexOf('=');
                if (current == null || equals <= 0)
                {
                    continue;
                }

                string field = line.Substring(0, equals).Trim().ToLowerInvariant();
                string value = line.Substring(equals + 1).Trim();
                bool add = field.EndsWith("+");
                if (add)
                {
                    field = field.Substring(0, field.Length - 1);
                }

                try
                {
                    current = Field(current, field, value, add);
                }
                catch (Exception ex)
                {
                    VillheimPlugin.Log.LogWarning($"Cultures: cultures.txt line {number} ('{line}') was skipped: {ex.Message}");
                }
            }
        }

        private static string[] List(string value) =>
            value.Split(',').Select(v => v.Trim()).Where(v => v.Length > 0).ToArray();

        private static string[] Join(string[] old, string[] more, bool add) => add ? old.Concat(more).Distinct().ToArray() : more;

        private static Culture Field(Culture c, string field, string value, bool add)
        {
            switch (field)
            {
                case "base":
                    if (_data.TryGetValue(value.ToLowerInvariant(), out Culture parent))
                    {
                        Culture copy = parent.Copy(c.Key);
                        _data[c.Key] = copy;
                        return copy;
                    }

                    throw new Exception($"no culture '{value}' above this one");
                case "name": c.Name = value; break;
                case "people": c.People = value.ToLowerInvariant(); break;
                case "leader": c.Leader = value; break;
                case "male": c.Male = Join(c.Male, List(value), add); break;
                case "female": c.Female = Join(c.Female, List(value), add); break;
                case "surname": c.Surname = value.ToLowerInvariant(); break;
                case "surnamechance": c.SurnameChance = Number(value); break;
                case "seats": c.Seats = Join(c.Seats, List(value), add); break;
                case "families":
                    var families = List(value).Select(f =>
                    {
                        string[] parts = f.Split('/');
                        return (parts[0].Trim(), parts.Length > 1 ? parts[1].Trim() : parts[0].Trim());
                    }).ToArray();
                    c.Families = add ? c.Families.Concat(families).ToArray() : families;
                    break;
                case "places.start": c.PlaceStart = Join(c.PlaceStart, List(value), add); break;
                case "places.end": c.PlaceEnd = Join(c.PlaceEnd, List(value), add); break;
                case "festivals": c.Festivals = value.Split('|').Select(f => f.Trim()).ToArray(); break;
                case "skin": c.Skin = Range(value); break;
                case "hairshade": c.HairShade = Range(value); break;
                case "hairred": c.HairRed = Range(value); break;
                case "beard": c.Beard = Number(value); break;
                case "hair": c.HairPrefer = Weights(value); break;
                case "beardstyle": c.BeardPrefer = Weights(value); break;
                case "chest":
                case "legs":
                case "helmet":
                case "cape":
                    List<Wear> wear = List(value).Select(ParseWear).ToList();
                    if (add && c.Clothes.TryGetValue(field, out List<Wear> old))
                    {
                        wear = old.Concat(wear).ToList();
                    }

                    c.Clothes[field] = wear;
                    break;
                default:
                    if (field.StartsWith("designs.") && Enum.TryParse(field.Substring(8), true, out Role role))
                    {
                        c.Designs[role] = value.Split('|').Select(t => t.Trim()).Where(t => t.Length > 0).ToArray();
                        break;
                    }

                    throw new Exception($"unknown field '{field}'");
            }

            return c;
        }

        private static float Number(string value) => float.Parse(value.Trim(), NumberStyles.Float, CultureInfo.InvariantCulture);

        private static Vector2 Range(string value)
        {
            string[] parts = value.Split('-');
            float a = Number(parts[0]);
            float b = parts.Length > 1 ? Number(parts[1]) : a;
            return new Vector2(Mathf.Min(a, b), Mathf.Max(a, b));
        }

        private static Dictionary<string, float> Weights(string value)
        {
            var weights = new Dictionary<string, float>();
            foreach (string entry in List(value))
            {
                string[] parts = entry.Split(':');
                weights[Plain(parts[0])] = parts.Length > 1 ? Number(parts[1]) : 1.5f;
            }

            return weights;
        }

        /// <summary>"f:ArmorDress*@1:0.8" is women only, any ArmorDress item, from gear tier 1, weight 0.8.</summary>
        private static Wear ParseWear(string entry)
        {
            int sex = 0;
            if (entry.StartsWith("f:", StringComparison.OrdinalIgnoreCase)) { sex = 2; entry = entry.Substring(2); }
            else if (entry.StartsWith("m:", StringComparison.OrdinalIgnoreCase)) { sex = 1; entry = entry.Substring(2); }

            float weight = 1f;
            int colon = entry.LastIndexOf(':');
            if (colon > 0)
            {
                weight = Number(entry.Substring(colon + 1));
                entry = entry.Substring(0, colon);
            }

            int tier = 0;
            int at = entry.IndexOf('@');
            if (at > 0)
            {
                tier = (int)Number(entry.Substring(at + 1));
                entry = entry.Substring(0, at);
            }

            return new Wear(entry.Trim(), tier, weight, sex);
        }

        /// <summary>Lower case letters and digits only, for matching words in the game's style names.</summary>
        public static string Plain(string text) =>
            new string((text ?? "").ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());

        // ---------------------------------------------------------------- biome to culture

        private static string _mapText;
        private static Dictionary<Heightmap.Biome, List<(string Key, float Weight)>> _map;

        /// <summary>The cultures a village of this biome may have, with their weights, from CultureMap.</summary>
        public static List<(string Key, float Weight)> ForBiome(Heightmap.Biome biome)
        {
            Dictionary<Heightmap.Biome, List<(string, float)>> map = Map();
            if (map.TryGetValue(biome, out List<(string, float)> list) && list.Count > 0)
            {
                return list;
            }

            // A biome that is not in the map (Ashlands, Deep North, Ocean) builds like the Meadows.
            return map.TryGetValue(Heightmap.Biome.Meadows, out list) && list.Count > 0
                ? list
                : new List<(string, float)> { (Fallback, 1f) };
        }

        private static Dictionary<Heightmap.Biome, List<(string, float)>> Map()
        {
            string text = LogicConfig.CultureMap?.Value ?? DefaultMap;
            if (_map != null && text == _mapText)
            {
                return _map;
            }

            _mapText = text;
            _map = new Dictionary<Heightmap.Biome, List<(string, float)>>();
            foreach (string part in text.Split(';'))
            {
                int equals = part.IndexOf('=');
                if (equals <= 0 || !TryBiome(part.Substring(0, equals), out Heightmap.Biome biome))
                {
                    if (part.Trim().Length > 0)
                    {
                        VillheimPlugin.Log.LogWarning($"CultureMap: '{part.Trim()}' is not 'Biome=culture:weight,...'; skipped.");
                    }

                    continue;
                }

                var list = new List<(string, float)>();
                foreach (string entry in List(part.Substring(equals + 1)))
                {
                    string[] f = entry.Split(':');
                    string key = f[0].Trim().ToLowerInvariant();
                    float weight = f.Length > 1 && float.TryParse(f[1], NumberStyles.Float, CultureInfo.InvariantCulture, out float w) ? w : 1f;
                    if (!Known(key))
                    {
                        VillheimPlugin.Log.LogWarning($"CultureMap: no culture '{key}' in cultures.txt; skipped.");
                        continue;
                    }

                    if (weight > 0f)
                    {
                        list.Add((key, weight));
                    }
                }

                _map[biome] = list;
            }

            return _map;
        }

        public static bool TryBiome(string text, out Heightmap.Biome biome)
        {
            string plain = Plain(text);
            if (plain == "mountains") plain = "mountain";
            if (plain == "mistland") plain = "mistlands";
            foreach (Heightmap.Biome b in Enum.GetValues(typeof(Heightmap.Biome)))
            {
                if (Plain(b.ToString()) == plain)
                {
                    biome = b;
                    return true;
                }
            }

            biome = Heightmap.Biome.None;
            return false;
        }

        /// <summary>A weighted pick from the biome's list, the same for the same seed.</summary>
        public static string Roll(Heightmap.Biome biome, int seed)
        {
            List<(string Key, float Weight)> list = ForBiome(biome);
            float total = list.Sum(e => e.Weight);
            double roll = new System.Random(unchecked(seed * 486187739 + 11)).NextDouble() * total;
            foreach ((string key, float weight) in list)
            {
                roll -= weight;
                if (roll <= 0)
                {
                    return key;
                }
            }

            return list[list.Count - 1].Key;
        }

        // ---------------------------------------------------------------- whose culture

        /// <summary>
        /// The village's culture. Given once and kept on the hearth: a new village rolls from its biome's list, a
        /// village that already had people takes the first culture listed for its biome.
        /// </summary>
        public static string Of(VillageState state)
        {
            if (!On || state == null)
            {
                return Fallback;
            }

            string stored = state.Culture;
            if (Known(stored))
            {
                return stored;
            }

            string key = state.Arrivals > 0 ? ForBiome(state.Biome)[0].Key : Roll(state.Biome, state.Seed);
            if (state.Zdo != null && state.Zdo.IsOwner())
            {
                state.Culture = key;
            }

            return key;
        }

        public static string Of(ZDO hearthZdo) => hearthZdo != null ? Of(new VillageState(hearthZdo)) : Fallback;

        public static string Of(VillageHearth hearth) => hearth != null && hearth.IsValid ? Of(hearth.Zdo) : Fallback;

        /// <summary>The culture of the village with this id, loaded or not (Fallback when it cannot be found).</summary>
        public static string OfVillage(int villageId)
        {
            if (!On || villageId == 0)
            {
                return Fallback;
            }

            VillageHearth hearth = VillageHearth.Find(villageId);
            if (hearth != null && hearth.IsValid)
            {
                return Of(hearth.Zdo);
            }

            ZDO zdo = Relations.AllHearths().FirstOrDefault(z => z.GetInt(Keys.VillageId) == villageId);
            return zdo != null ? Of(zdo) : Fallback;
        }

        /// <summary>The villager's own culture: his own if he has one, else his village's (a wanderer's from where he walks).</summary>
        public static string OfVillager(Villager villager)
        {
            if (!On || villager == null)
            {
                return Fallback;
            }

            string own = villager.Zdo != null ? villager.Zdo.GetString(KeyVillager, "") : "";
            if (Known(own))
            {
                return own;
            }

            if (villager.VillageId != 0)
            {
                return OfVillage(villager.VillageId);
            }

            Heightmap.Biome biome = WorldGenerator.instance != null ? WorldGenerator.instance.GetBiome(villager.transform.position) : Heightmap.Biome.Meadows;
            return Roll(biome, villager.Zdo != null ? villager.Zdo.GetInt(Keys.VillagerSeed) : 1);
        }

        /// <summary>
        /// The culture of someone coming to live in the village. The first settlers and most newcomers share the
        /// village's; a newcomer from outside may be of another people (CultureForeignChance), most often one of a
        /// neighbouring biome's.
        /// </summary>
        public static string ForNewcomer(VillageState state, int seed, bool fromOutside)
        {
            string own = Of(state);
            if (!On || !fromOutside)
            {
                return own;
            }

            var rng = new System.Random(unchecked(seed * 7 + 977));
            float chance = LogicConfig.CultureForeignChance != null ? LogicConfig.CultureForeignChance.Value : 0.15f;
            if (rng.NextDouble() >= chance)
            {
                return own;
            }

            // Every culture any biome may have, weighted as in the map, less the village's own.
            var options = new Dictionary<string, float>();
            foreach (List<(string Key, float Weight)> list in Map().Values)
            {
                foreach ((string key, float weight) in list)
                {
                    if (key != own)
                    {
                        options.TryGetValue(key, out float w);
                        options[key] = w + weight;
                    }
                }
            }

            if (options.Count == 0)
            {
                return own;
            }

            double roll = rng.NextDouble() * options.Values.Sum();
            foreach (KeyValuePair<string, float> option in options)
            {
                roll -= option.Value;
                if (roll <= 0)
                {
                    return option.Key;
                }
            }

            return options.Keys.Last();
        }

        // ---------------------------------------------------------------- what other systems show

        /// <summary>Given name and, where the culture uses one, the surname, for the hover text.</summary>
        public static string FullName(Villager villager)
        {
            string name = villager.VillagerName;
            if (!On || LogicConfig.CultureSurnames == null || !LogicConfig.CultureSurnames.Value || villager.Zdo == null ||
                Childhood.IsChild(villager))
            {
                return name;
            }

            int seed = villager.Zdo.GetInt(Keys.VillagerSeed);
            string surname = Names.Surname(seed, OfVillager(villager));
            return surname.Length > 0 && !name.Contains(" ") ? name + " " + surname : name;
        }

        /// <summary>The title of the village's first settler: Jarl in a Norse village, Elder in a Slavic one...</summary>
        public static string LeaderTitle(int villageId) => On ? Get(OfVillage(villageId)).Leader : "Jarl";

        private static readonly string[] NorseFestivals = { "the sowing feast", "the midsummer fire", "the harvest feast", "Yule" };

        /// <summary>The name a village of this culture gives the feast of a season (0 spring .. 3 winter).</summary>
        public static string Festival(string key, int season)
        {
            season = ((season % 4) + 4) % 4;
            string[] names = On ? Get(key).Festivals : NorseFestivals;
            return names != null && names.Length == 4 && names[season].Length > 0 ? names[season] : NorseFestivals[season];
        }

        /// <summary>
        /// Dialogue tags: culture:key and people:group of the speaker, villageculture:key of his village, and
        /// "foreign" when the two differ.
        /// </summary>
        public static IEnumerable<string> Tags(Villager villager)
        {
            if (!On || villager == null)
            {
                yield break;
            }

            string mine = OfVillager(villager);
            Culture culture = Get(mine);
            yield return "culture:" + culture.Key;
            yield return "people:" + culture.People;
            if (villager.VillageId != 0)
            {
                string village = OfVillage(villager.VillageId);
                yield return "villageculture:" + village;
                if (Get(village).People != culture.People)
                {
                    yield return "foreign";
                }
            }
        }

        /// <summary>{people} (Norse, Slavic...) and {leader} (Jarl, Chief, Elder...) in lines.</summary>
        public static string Fill(string line, Villager villager)
        {
            if (line.IndexOf('{') < 0)
            {
                return line;
            }

            Culture culture = Get(OfVillager(villager));
            if (line.Contains("{people}")) line = line.Replace("{people}", culture.Name);
            if (line.Contains("{leader}")) line = line.Replace("{leader}", LeaderTitle(villager.VillageId));
            return line;
        }

        /// <summary>The design tiers a culture adds in front of its biome's for a role (empty when it has none).</summary>
        public static string[] DesignTiers(string key, Role role)
        {
            if (!On || key == null || LogicConfig.CultureDesigns == null || !LogicConfig.CultureDesigns.Value)
            {
                return new string[0];
            }

            return Get(key).Designs.TryGetValue(role, out string[] tiers) ? tiers : new string[0];
        }

        // ---------------------------------------------------------------- commands

        /// <summary>'vh cultures': the biome map, and each culture's names, feasts and looks in short.</summary>
        public static string ListCommand()
        {
            var lines = new List<string> { $"Villheim cultures ({(On ? "on" : "off: every village is Norse")}). CultureMap:" };
            foreach (KeyValuePair<Heightmap.Biome, List<(string, float)>> entry in Map())
            {
                lines.Add($"   {entry.Key}: {string.Join(", ", entry.Value.Select(e => $"{e.Item1} {e.Item2.ToString("0.#", CultureInfo.InvariantCulture)}"))}");
            }

            lines.Add("Cultures:");
            foreach (Culture c in All)
            {
                lines.Add($"   {c.Key} ({c.Name}): {c.Male.Length} men's and {c.Female.Length} women's names, surnames {c.Surname}, " +
                          $"leader {c.Leader}, skin {c.Skin.x:0.00}-{c.Skin.y:0.00}, feasts {string.Join(" / ", c.Festivals)}" +
                          $"{(c.Designs.Count > 0 ? ", own designs for " + string.Join(" ", c.Designs.Keys) : "")}");
            }

            lines.Add("Biomes not in the map build like the Meadows.");
            return string.Join("\n", lines);
        }

        /// <summary>'vh culture [set &lt;key&gt; | reroll]': the nearest village's culture, or change it.</summary>
        public static string Command(string[] args)
        {
            Player player = Player.m_localPlayer;
            VillageHearth hearth = player != null ? VillageHearth.Closest(player.transform.position, 200f) : null;
            if (hearth == null || !hearth.IsValid)
            {
                return "No village within 200 m.";
            }

            var state = new VillageState(hearth.Zdo);
            string verb = args.Length > 0 ? args[0].ToLowerInvariant() : "";
            if (verb == "set" || verb == "reroll")
            {
                if (!hearth.Zdo.IsOwner())
                {
                    return "Another player's game runs this village; change it from there.";
                }

                string key = verb == "set" && args.Length > 1 ? args[1].ToLowerInvariant() : Roll(state.Biome, unchecked(state.Seed + (int)(Time.time * 10f)));
                if (!Known(key))
                {
                    return $"No culture '{key}'. Known: {string.Join(", ", All.Select(c => c.Key))}.";
                }

                state.Culture = key;
                Chronicle.Add(hearth, $"{state.Name} now keeps the ways of the {Get(key).Name} folk.");
                return $"{state.Name} is now {Get(key).Name} ({key}). New villagers take its names and looks; 'vh relook' on one to see it now.";
            }

            string culture = Of(state);
            Culture c = Get(culture);
            var people = Character.GetAllCharacters().OfType<Villager>().Where(v => v.VillageId == state.Id && !v.IsDead()).ToList();
            string folk = people.Count == 0 ? "nobody loaded" : string.Join(", ", people.Select(v =>
            {
                string own = OfVillager(v);
                return FullName(v) + (own != culture ? $" ({own})" : "");
            }));
            int season = Calendar.SeasonIndex;
            return $"{state.Name} ({state.Biome}): {c.Name} ({culture}), leader called {c.Leader}. This season's feast: {Festival(culture, season)}.\n" +
                   $"   Biome list: {string.Join(", ", ForBiome(state.Biome).Select(e => e.Key))}. People: {folk}.\n" +
                   "   'vh culture set <key>' or 'vh culture reroll' to change it; 'vh cultures' lists them all.";
        }

        /// <summary>'vh relook [culture]': the nearest villager gets a new face, name and clothes (of that culture).</summary>
        public static string Relook(string[] args)
        {
            Player player = Player.m_localPlayer;
            Villager villager = player == null ? null : Character.GetAllCharacters().OfType<Villager>()
                .Where(v => !v.IsDead() && v.Zdo != null && v.Zdo.IsOwner())
                .OrderBy(v => Vector3.Distance(v.transform.position, player.transform.position))
                .FirstOrDefault(v => Vector3.Distance(v.transform.position, player.transform.position) < 15f);
            if (villager == null)
            {
                return "No villager of yours within 15 m.";
            }

            string key = args.Length > 0 ? args[0].ToLowerInvariant() : OfVillager(villager);
            if (!Known(key))
            {
                return $"No culture '{key}'. Known: {string.Join(", ", All.Select(c => c.Key))}.";
            }

            string old = villager.VillagerName;
            int seed = UnityEngine.Random.Range(1, int.MaxValue);
            string name = Names.Villager(seed, key);
            villager.Zdo.Set(Keys.VillagerSeed, seed);
            villager.Zdo.Set(Keys.VillagerName, name);
            villager.Zdo.Set(KeyVillager, key);
            villager.m_name = name;
            int tier = 0;
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth != null && hearth.IsValid)
            {
                var state = new VillageState(hearth.Zdo);
                tier = Smithing.Cap(hearth, VillagerLooks.GearTier(VillageBrain.TierIndex(state.Plots.Count), state.Biome));
            }

            VillagerLooks.Apply(villager, seed, tier);
            return $"{old} is now {FullName(villager)} ({Get(key).Name}). The seed changed too, so voice and small facts change with it.";
        }
    }
}
