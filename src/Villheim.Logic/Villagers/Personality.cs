using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// What makes one villager different from the next, beyond the voice: small facts fixed by the villager's seed
    /// (where they came from, a favourite food, a fear, a pastime, a hope), who they get on with and who they don't,
    /// what they did yesterday, and what they remember of the last few days.
    ///
    /// Each gives the dialogue tags and fill-ins, so a few hundred lines come out many thousand ways:
    /// {homeland} {favfood} {fear} {hobby} {dream} {friend} {rival} {yesterday} {news} {farplace}. Ideas from MCA
    /// (expiring memories, traits), RimWorld (pair opinions), Dwarf Fortress (only the extremes of a personality show)
    /// and Stardew Valley (lines tied to the day); the code is our own.
    ///
    /// - Fixed facts: from the seed, the same on every machine and every load.
    /// - Friends and rivals: each pair of villagers has a fixed liking from both seeds, raised a little by every chat
    ///   they have. The best liked (above 0.3) is the friend, the least liked (below -0.4) the rival.
    /// - Yesterday: what the villager spent most of the day doing, sampled every 30 seconds and kept in the ZDO.
    /// - Memories: village events (a building finished, a newcomer, a fight, a death, a visitor...) are remembered for
    ///   two to five days and show as "mem:x" tags.
    /// </summary>
    internal static class Personality
    {
        private static readonly int KeyDiary = "villheim_diary".GetStableHashCode();
        private static readonly int KeyYesterday = "villheim_yesterday".GetStableHashCode();
        private static readonly int KeyMemories = "villheim_mem".GetStableHashCode();

        private static readonly string[] Homelands =
        {
            "Skarvik", "the salt marshes in the west", "Hvitfjord", "a farm under the mountains", "Tornesund",
            "the islands", "a fishing hamlet nobody's heard of", "Ulvdal", "the far side of the big lake", "Brennholt",
            "the birch country", "Kaldvik", "a longhouse by the sea", "Ravnberg", "the river towns", "Grimsby",
            "the heath, where nothing grows", "Ostfold", "a village that isn't there any more", "Sandnes",
        };

        private static readonly string[] Foods =
        {
            "boar jerky", "deer stew", "queen's jam", "raspberries", "grilled neck tail", "honey", "carrot soup",
            "cooked deer meat", "yellow mushrooms", "sausages", "turnip stew", "blueberries", "fish, any fish",
        };

        private static readonly string[] Fears =
        {
            "trolls", "deep water", "the dark", "greydwarfs", "thunder", "bees", "the swamp", "skeletons", "heights",
            "wolves", "being forgotten", "the sea serpent", "fire",
        };

        private static readonly string[] Hobbies =
        {
            "carving spoons", "counting stars", "skipping stones", "plaiting rope", "humming old songs",
            "collecting feathers", "sharpening things that are already sharp", "naming the boars", "watching clouds",
            "whittling little boats", "pressing flowers", "telling the same three jokes", "stacking stones",
        };

        private static readonly string[] Dreams =
        {
            "to see the mountains", "to sail past the edge of the map", "to have a house with two hearths",
            "to taste mead from the plains", "to see a dragon and live", "to meet Odin's ravens",
            "to grow old somewhere quiet", "to have my name on a runestone", "to fill a chest with silver",
            "to see the world tree", "to sleep one whole night without a greydwarf", "to build a boat of my own",
        };

        // Why a newcomer left home: the backstory a newcomer tells in his first days (WORLD_LIFE plan item 12).
        private static readonly string[] Reasons =
        {
            "the farm went to my older brother", "a fire took our longhouse", "I owed a man money and he wanted it back",
            "the fishing failed three years running", "the family I married into never liked me", "I wanted to see something new",
            "the jarl there was a hard man", "wolves took the sheep and then they took the dog", "I followed a dream I had",
            "there were too many of us and too little land", "the sickness came through our valley",
            "I lost a wager and had to leave", "I heard there was land to be had", "nobody there needed a carpenter",
            "the old ones died and the young ones scattered",
        };

        private static readonly int KeyArrivedDay = "villheim_arrivedday".GetStableHashCode();

        /// <summary>Called when a villager first comes to live in a village (not the first settlers, not the newborn).</summary>
        public static void NoteArrived(ZDO zdo, bool newcomer)
        {
            if (zdo != null && newcomer)
            {
                zdo.Set(KeyArrivedDay, Today);
            }
        }

        /// <summary>Came to the village from outside in the last three days.</summary>
        public static bool IsNewcomer(Villager villager)
        {
            int day = villager.Zdo != null ? villager.Zdo.GetInt(KeyArrivedDay, -1) : -1;
            return day >= 0 && Today - day <= 3;
        }

        public static string WhyLeft(Villager v) => Pick(Reasons, v, 67u);

        private static readonly string[] FarPlaces =
        {
            "the Ashfjord", "the north coast", "Myrhavn", "the eastern islands", "the Grey Hills", "Bjornstad",
            "the old road south", "Vindholm", "the lakes", "Stenvik",
        };

        private static readonly Dictionary<string, string> YesterdayWords = new Dictionary<string, string>
        {
            ["felling"] = "felling trees", ["splitting"] = "splitting logs", ["mining"] = "breaking rocks",
            ["building"] = "building", ["carrying"] = "hauling", ["gathering"] = "picking things up off the ground",
            ["cooking"] = "cooking", ["farming"] = "on the farm", ["hunting"] = "hunting", ["foraging"] = "picking berries",
            ["fire"] = "sitting by the fire", ["chatting"] = "talking", ["path"] = "laying the path", ["repairing"] = "mending",
            ["watch"] = "on watch", ["stroll"] = "walking about", ["idle"] = "not doing much", ["fencing"] = "on the fence",
        };

        // How long each village event stays in mind, in days.
        private static readonly Dictionary<string, float> MemoryDays = new Dictionary<string, float>
        {
            ["finished"] = 3f, ["arrival"] = 3f, ["birth"] = 5f, ["death"] = 5f, ["fight"] = 3f, ["hunt"] = 2f,
            ["pedlar"] = 2f, ["pilgrim"] = 2f, ["blessing"] = 2f, ["groundbroken"] = 2f, ["upgrade"] = 3f, ["trade"] = 1f, ["forged"] = 4f, ["outpost"] = 5f, ["haul"] = 1f, ["bossdown"] = 6f,
        };

        private sealed class State
        {
            public float NextSample;
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();

        /// <summary>Extra liking between two villagers from chatting, by the pair's seeds. Not saved.</summary>
        private static readonly Dictionary<(int, int), float> Warmth = new Dictionary<(int, int), float>();

        private static int Seed(Villager villager) => villager.Zdo != null ? villager.Zdo.GetInt(Keys.VillagerSeed) : 1;

        private static string Pick(string[] list, Villager villager, uint salt) =>
            list[(int)(((uint)Seed(villager) * 2654435761u ^ salt * 2246822519u) >> 7) % list.Length];

        public static readonly int KeyHomeland = "villheim_homeland".GetStableHashCode();
        public static readonly int KeyHobby = "villheim_hobby".GetStableHashCode();

        /// <summary>A child born in the village carries a parent's homeland (Elders.Inherit), else it comes from the seed.</summary>
        /// Norse villagers name a place from the list above; villagers of other peoples a place in their own tongue
        /// (Names.Place, from the culture's place-name parts).
        public static string Homeland(Villager v) => Own(v, KeyHomeland) ?? NativeHomeland(v);

        private static string NativeHomeland(Villager v)
        {
            string culture = Village.Cultures.OfVillager(v);
            return Village.Cultures.Get(culture).People == "norse" ? Pick(Homelands, v, 11u) : Names.Place(Seed(v), culture);
        }

        private static string Own(Villager v, int key)
        {
            string own = v?.Zdo != null ? v.Zdo.GetString(key, "") : "";
            return own.Length > 0 ? own : null;
        }
        public static string Food(Villager v) => Pick(Foods, v, 23u);
        public static string Fear(Villager v) => Pick(Fears, v, 37u);
        public static string Hobby(Villager v) => Own(v, KeyHobby) ?? Pick(Hobbies, v, 41u);
        public static string Dream(Villager v) => Pick(Dreams, v, 53u);

        public static string FarPlace(int seed) => FarPlaces[(seed & 0x7fffffff) % FarPlaces.Length];

        // ---------------------------------------------------------------- friends and rivals

        /// <summary>How much two villagers like each other, -1 to 1 plus whatever chats have added.</summary>
        public static float Liking(Villager a, Villager b)
        {
            int sa = Seed(a), sb = Seed(b);
            (int, int) pair = sa < sb ? (sa, sb) : (sb, sa);
            uint hash = unchecked((uint)pair.Item1 * 2654435761u ^ (uint)pair.Item2 * 40503u);
            hash ^= hash >> 15;
            hash *= 2246822519u;
            hash ^= hash >> 13;
            float fixedPart = (hash % 2001u) / 1000f - 1f;
            Warmth.TryGetValue(pair, out float warmth);
            return fixedPart + warmth;
        }

        /// <summary>Two villagers had a chat: they like each other a little more (up to +0.4 in all).</summary>
        public static void Chatted(Villager a, Villager b)
        {
            int sa = Seed(a), sb = Seed(b);
            (int, int) pair = sa < sb ? (sa, sb) : (sb, sa);
            Warmth.TryGetValue(pair, out float warmth);
            Warmth[pair] = Mathf.Min(0.4f, warmth + 0.02f);
        }

        private static IEnumerable<Villager> Neighbours(Villager villager) =>
            Character.GetAllCharacters().OfType<Villager>()
                .Where(o => o != villager && !o.IsDead() && o.VillageId != 0 && o.VillageId == villager.VillageId);

        public static Villager Friend(Villager villager)
        {
            Villager best = Neighbours(villager).OrderByDescending(o => Liking(villager, o)).FirstOrDefault();
            return best != null && Liking(villager, best) > 0.3f ? best : null;
        }

        public static Villager Rival(Villager villager)
        {
            Villager worst = Neighbours(villager).OrderBy(o => Liking(villager, o)).FirstOrDefault();
            return worst != null && Liking(villager, worst) < -0.4f ? worst : null;
        }

        // ---------------------------------------------------------------- yesterday

        private static int Today => EnvMan.instance != null ? EnvMan.instance.GetDay() : 0;

        /// <summary>Every 30 seconds: notes what the villager is doing, and rolls the day over.</summary>
        public static void Sample(Villager villager)
        {
            State state = States.GetOrCreateValue(villager);
            if (Time.time < state.NextSample || villager.Zdo == null || Wanderers.IsWanderer(villager))
            {
                return;
            }

            state.NextSample = Time.time + 30f + Random.Range(0f, 5f);
            string doing = Dialogue.ActivityWord(VillagerBehaviour.Activity(villager) ?? "idle");
            if (doing == null || doing == "asleep")
            {
                return;
            }

            VillagerSkills.Practice(villager, doing);
            ZDO zdo = villager.Zdo;
            string raw = zdo.GetString(KeyDiary, "");
            int colon = raw.IndexOf(':');
            int day = colon > 0 && int.TryParse(raw.Substring(0, colon), out int d) ? d : Today;
            var counts = new Dictionary<string, int>();
            if (colon > 0)
            {
                foreach (string part in raw.Substring(colon + 1).Split(','))
                {
                    int eq = part.IndexOf('=');
                    if (eq > 0 && int.TryParse(part.Substring(eq + 1), out int n))
                    {
                        counts[part.Substring(0, eq)] = n;
                    }
                }
            }

            if (day != Today)
            {
                string top = counts.Where(c => c.Key != "idle").OrderByDescending(c => c.Value).Select(c => c.Key).FirstOrDefault()
                             ?? (counts.Count > 0 ? "idle" : "");
                zdo.Set(KeyYesterday, top);
                counts.Clear();
                day = Today;
            }

            counts.TryGetValue(doing, out int count);
            counts[doing] = count + 1;
            zdo.Set(KeyDiary, day.ToString(CultureInfo.InvariantCulture) + ":" +
                              string.Join(",", counts.Select(c => c.Key + "=" + c.Value.ToString(CultureInfo.InvariantCulture))));
        }

        private static string Yesterday(Villager villager) => villager.Zdo != null ? villager.Zdo.GetString(KeyYesterday, "") : "";

        // ---------------------------------------------------------------- memories

        /// <summary>Everyone in the village remembers <paramref name="what"/> for a few days.</summary>
        public static void VillageRemembers(int villageId, string what)
        {
            if (!MemoryDays.ContainsKey(what))
            {
                return;
            }

            foreach (Villager villager in Character.GetAllCharacters().OfType<Villager>())
            {
                if (!villager.IsDead() && villager.VillageId == villageId && villager.VillageId != 0)
                {
                    Remember(villager, what);
                }
            }
        }

        public static void Remember(Villager villager, string what)
        {
            if (villager.Zdo == null || !villager.m_nview.IsOwner() || !MemoryDays.TryGetValue(what, out float days))
            {
                return;
            }

            Dictionary<string, float> memories = Memories(villager);
            memories[what] = Today + days;
            villager.Zdo.Set(KeyMemories, string.Join(",", memories.Select(m =>
                m.Key + "=" + m.Value.ToString("0.#", CultureInfo.InvariantCulture))));
        }

        /// <summary>Whether this villager still remembers a village event of this kind ("hunt", "finished"...).</summary>
        public static bool Remembers(Villager villager, string what) => Memories(villager).ContainsKey(what);

        private static Dictionary<string, float> Memories(Villager villager)
        {
            var memories = new Dictionary<string, float>();
            foreach (string part in (villager.Zdo?.GetString(KeyMemories, "") ?? "").Split(','))
            {
                int eq = part.IndexOf('=');
                if (eq > 0 && float.TryParse(part.Substring(eq + 1), NumberStyles.Float, CultureInfo.InvariantCulture, out float until) &&
                    until >= Today)
                {
                    memories[part.Substring(0, eq)] = until;
                }
            }

            return memories;
        }

        // ---------------------------------------------------------------- tags and fill-ins

        /// <summary>Tags from this villager's own facts: friend:near, rival:near, yesterday:x, mem:x, fear:x, news.</summary>
        public static IEnumerable<string> Tags(Villager villager)
        {
            Villager friend = Friend(villager);
            Villager rival = Rival(villager);
            if (friend != null)
            {
                yield return "hasfriend";
                if (Vector3.Distance(friend.transform.position, villager.transform.position) < 10f) yield return "friend:near";
            }

            if (rival != null)
            {
                yield return "hasrival";
                if (Vector3.Distance(rival.transform.position, villager.transform.position) < 10f) yield return "rival:near";
            }

            string yesterday = Yesterday(villager);
            if (yesterday.Length > 0)
            {
                yield return "yesterday:" + yesterday;
                yield return "yesterday:any";
            }

            foreach (string memory in Memories(villager).Keys)
            {
                yield return "mem:" + memory;
            }

            yield return "fear:" + Fear(villager).Split(' ').Last().Replace(",", "");
            if (IsNewcomer(villager)) yield return "newcomer";
            if (Village.WorldLife.HeardNews(villager.VillageId) != null)
            {
                yield return "news";
            }

            int day = Today;
            if (day > 0 && day % 7 == 0) yield return "restday";
            if (day > 0 && day % 10 == 0) yield return "tenthday";
        }

        public static string Fill(string line, Villager villager)
        {
            if (line.IndexOf('{') < 0)
            {
                return line;
            }

            if (line.Contains("{friend}")) line = line.Replace("{friend}", Friend(villager)?.VillagerName ?? "nobody in particular");
            if (line.Contains("{rival}")) line = line.Replace("{rival}", Rival(villager)?.VillagerName ?? "nobody");
            if (line.Contains("{yesterday}"))
            {
                YesterdayWords.TryGetValue(Yesterday(villager), out string what);
                line = line.Replace("{yesterday}", what ?? "this and that");
            }

            if (line.Contains("{news}"))
            {
                string news = Wanderers.IsWanderer(villager)
                    ? Village.WorldLife.VisitorNews(villager)
                    : Village.WorldLife.HeardNews(villager.VillageId);
                line = line.Replace("{news}", news ?? "nothing much is happening anywhere");
            }

            return line.Replace("{homeland}", Homeland(villager))
                .Replace("{favfood}", Food(villager))
                .Replace("{fear}", Fear(villager))
                .Replace("{hobby}", Hobby(villager))
                .Replace("{dream}", Dream(villager))
                .Replace("{farplace}", FarPlace(Seed(villager)))
                .Replace("{whyleft}", WhyLeft(villager))
                .Replace("{from}", villager.Zdo?.GetString(Wanderers.KeyFrom, "") is string from && from.Length > 0 ? from : "far off");
        }

        /// <summary>One line for the inspect command.</summary>
        public static string Describe(Villager villager)
        {
            YesterdayWords.TryGetValue(Yesterday(villager), out string yesterday);
            return $"from {Homeland(villager)}{(IsNewcomer(villager) ? " (new here: " + WhyLeft(villager) + ")" : "")}; loves {Food(villager)}; afraid of {Fear(villager)}; likes {Hobby(villager)}; " +
                   $"hopes {Dream(villager)}; friend {Friend(villager)?.VillagerName ?? "none"}, rival {Rival(villager)?.VillagerName ?? "none"}; " +
                   $"yesterday {yesterday ?? "unknown"}; remembers {string.Join(" ", Memories(villager).Keys)}";
        }
    }
}
