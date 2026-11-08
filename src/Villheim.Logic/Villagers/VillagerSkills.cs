using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Skills that grow with practice, so villagers grow apart over the days (WORLD_LIFE plan item 11).
    ///
    /// Nine skills, 0 to 100, kept in the villager's ZDO: woodcutting, mining, building, cooking, farming, hunting,
    /// foraging, crafting and hauling. A villager starts with a little of each from his seed, more in his trade. Every
    /// 30 seconds, whatever he is doing gives its skill a step (0.6, less the higher it already is; the young learn
    /// half again as fast, elders at 0.6); its partner skill gets a fifth of that and its opposite slips a little,
    /// after MineColonies' complementary and adverse pairs. Watching someone at work teaches a little of that work.
    ///
    /// Skill scales work: felling and mining blows and the time per building piece, from 0.8 at nothing to 1.3 at a
    /// hundred. A happy villager now and then has a good day (after RimWorld's work frenzy, much milder): a quarter
    /// faster at everything until the day ends. Every tenth point is a small lift in mood; reaching 50 and 75 goes in
    /// the chronicle. Dialogue tags: skill:x:novice/good/master, doingskill:novice/good/master for the work at hand,
    /// best:x, goodday; fill-ins {bestskill} {bestskillman} {skillword}.
    /// </summary>
    internal static class VillagerSkills
    {
        private static readonly int KeySkills = "villheim_skills".GetStableHashCode();

        public static readonly string[] Names = { "woodcutting", "mining", "building", "cooking", "farming", "hunting", "foraging", "crafting", "hauling" };

        private static readonly Dictionary<string, (string Partner, string Opposite)> Pairs = new Dictionary<string, (string, string)>
        {
            ["woodcutting"] = ("building", "cooking"), ["mining"] = ("crafting", "foraging"), ["building"] = ("crafting", "hunting"),
            ["cooking"] = ("foraging", "mining"), ["farming"] = ("foraging", "hunting"), ["hunting"] = ("cooking", "farming"),
            ["foraging"] = ("farming", "building"), ["crafting"] = ("mining", "hauling"), ["hauling"] = ("woodcutting", "crafting"),
        };

        private static readonly Dictionary<string, string> Doers = new Dictionary<string, string>
        {
            ["woodcutting"] = "woodcutter", ["mining"] = "miner", ["building"] = "builder", ["cooking"] = "cook",
            ["farming"] = "farmer", ["hunting"] = "hunter", ["foraging"] = "forager", ["crafting"] = "craftsman", ["hauling"] = "carrier",
        };

        /// <summary>Activity words (Dialogue.ActivityWord) to the skill they train.</summary>
        private static readonly Dictionary<string, string> ByActivity = new Dictionary<string, string>
        {
            ["felling"] = "woodcutting", ["splitting"] = "woodcutting", ["mining"] = "mining", ["building"] = "building",
            ["repairing"] = "building", ["fencing"] = "building", ["path"] = "building", ["cooking"] = "cooking",
            ["roasting"] = "cooking", ["hearth"] = "cooking", ["farming"] = "farming", ["hunting"] = "hunting",
            ["foraging"] = "foraging", ["gathering"] = "foraging", ["station"] = "crafting", ["making"] = "crafting",
            ["carrying"] = "hauling", ["fetching"] = "hauling",
        };

        private sealed class State
        {
            public int RolledDay = -1;
            public bool GoodDay;
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();

        public static string SkillFor(string activityWord) => activityWord != null && ByActivity.TryGetValue(activityWord, out string s) ? s : null;

        private static int Seed(Villager villager) => villager.Zdo != null ? villager.Zdo.GetInt(Keys.VillagerSeed) : 1;

        public static Dictionary<string, float> Read(Villager villager)
        {
            var skills = new Dictionary<string, float>();
            string raw = villager.Zdo?.GetString(KeySkills, "") ?? "";
            foreach (string part in raw.Split(','))
            {
                int eq = part.IndexOf('=');
                if (eq > 0 && float.TryParse(part.Substring(eq + 1), NumberStyles.Float, CultureInfo.InvariantCulture, out float v) &&
                    Pairs.ContainsKey(part.Substring(0, eq)))
                {
                    skills[part.Substring(0, eq)] = v;
                }
            }

            if (skills.Count < Names.Length)
            {
                // A new villager, or a record missing a skill (written by an older build): every skill is always there,
                // so lookups by name never fail.
                var start = new Dictionary<string, float>();
                Start(villager, start);
                foreach (KeyValuePair<string, float> s in start)
                {
                    if (!skills.ContainsKey(s.Key))
                    {
                        skills[s.Key] = s.Value;
                    }
                }
            }

            return skills;
        }

        /// <summary>Starting skills: up to 15 in each from the seed, 20 more in the trade, a little more for protectors at hunting.</summary>
        private static void Start(Villager villager, Dictionary<string, float> skills)
        {
            uint hash = (uint)Seed(villager) * 2654435761u;
            foreach (string name in Names)
            {
                hash ^= hash >> 13;
                hash *= 2246822519u;
                skills[name] = (hash % 1500u) / 100f;
            }

            switch (Roles.TradeOf(villager))
            {
                case Roles.Trade.Carpenter: skills["building"] += 20f; skills["crafting"] += 10f; break;
                case Roles.Trade.Woodcutter: skills["woodcutting"] += 20f; break;
                case Roles.Trade.Miner: skills["mining"] += 20f; break;
                case Roles.Trade.Cook: skills["cooking"] += 20f; break;
                case Roles.Trade.Farmer: skills["farming"] += 20f; break;
            }

            if (Roles.BackgroundOf(villager) == Roles.Background.Protector) skills["hunting"] += 8f;
            if (Childhood.IsChild(villager))
            {
                foreach (string name in Names)
                {
                    skills[name] *= 0.3f;
                }
            }
        }

        private static void Save(Villager villager, Dictionary<string, float> skills)
        {
            if (villager.Zdo == null || villager.m_nview == null || !villager.m_nview.IsOwner())
            {
                return;
            }

            villager.Zdo.Set(KeySkills, string.Join(",", skills.Select(s => s.Key + "=" + s.Value.ToString("0.##", CultureInfo.InvariantCulture))));
        }

        public static float Level(Villager villager, string skill) => skill != null && Read(villager).TryGetValue(skill, out float v) ? v : 0f;

        /// <summary>How fast this villager works at this skill: 0.8 to 1.3, a quarter more on a good day.</summary>
        public static float WorkFactor(Villager villager, string skill)
        {
            if (villager == null || Wanderers.IsWanderer(villager))
            {
                return 1f;
            }

            float factor = 0.8f + Mathf.Clamp(Level(villager, skill), 0f, 100f) * 0.005f;
            return GoodDay(villager) ? factor * 1.25f : factor;
        }

        /// <summary>Once a day a happy villager may wake up to a good day: (mood - 60) percent, at most 40.</summary>
        public static bool GoodDay(Villager villager)
        {
            State state = States.GetOrCreateValue(villager);
            int day = EnvMan.instance != null ? EnvMan.instance.GetDay() : 0;
            if (state.RolledDay != day)
            {
                state.RolledDay = day;
                float mood = Moods.Get(villager);
                state.GoodDay = Random.value < Mathf.Clamp01((mood - 60f) / 100f);
                if (state.GoodDay)
                {
                    VillheimPlugin.Debug($"{villager.VillagerName} is having a good day.");
                }
            }

            return state.GoodDay;
        }

        /// <summary>Every 30 seconds (from Personality.Sample): what he is doing trains its skill.</summary>
        public static void Practice(Villager villager, string activityWord)
        {
            if (villager.Zdo == null || villager.m_nview == null || !villager.m_nview.IsOwner() || Wanderers.IsWanderer(villager))
            {
                return;
            }

            string skill = SkillFor(activityWord);
            float rate = Childhood.IsChild(villager) ? 1.8f : Dialogue.VoiceOf(villager) == "young" ? 1.5f :
                Dialogue.VoiceOf(villager) == "elder" ? 0.6f : 1f;
            if (skill == null && activityWord == "watching")
            {
                // Learning by watching: a tenth of a step in whatever is watched (FreeTime knows what it is).
                skill = SkillFor(FreeTime.WatchedWork(villager));
                rate *= 0.15f;
            }

            if (skill == null)
            {
                return;
            }

            Dictionary<string, float> skills = Read(villager);
            float before = skills[skill];
            float step = 0.6f * rate * Mathf.Max(0.1f, 1f - before / 120f);
            skills[skill] = Mathf.Min(100f, before + step);
            (string partner, string opposite) = Pairs[skill];
            skills[partner] = Mathf.Min(100f, skills[partner] + step * 0.2f);
            skills[opposite] = Mathf.Max(0f, skills[opposite] - step * 0.08f);
            Save(villager, skills);

            if (Mathf.FloorToInt(before / 10f) != Mathf.FloorToInt(skills[skill] / 10f))
            {
                Moods.Think(villager, "skillup");
                Dialogue.QueueLine(villager, "self", "skillup", new[] { "skillup", "skillup:" + skill }, Random.Range(2f, 6f));
                int reached = Mathf.FloorToInt(skills[skill] / 10f) * 10;
                if (reached == 50 || reached == 75)
                {
                    Chronicle.Add(villager.VillageId, reached == 50
                        ? $"{villager.VillagerName} has become a good {Doers[skill]}."
                        : $"{villager.VillagerName} is now the best {Doers[skill]} for miles.");
                }
            }
        }

        public static string Best(Villager villager) => Read(villager).OrderByDescending(s => s.Value).First().Key;

        public static IEnumerable<string> Tags(Villager villager, string activityWord)
        {
            Dictionary<string, float> skills = Read(villager);
            foreach (KeyValuePair<string, float> s in skills)
            {
                if (s.Value < 15f) yield return "skill:" + s.Key + ":novice";
                else if (s.Value >= 75f) yield return "skill:" + s.Key + ":master";
                else if (s.Value >= 40f) yield return "skill:" + s.Key + ":good";
            }

            yield return "best:" + Best(villager);
            string doing = SkillFor(activityWord);
            if (doing != null)
            {
                float level = skills[doing];
                yield return level < 15f ? "doingskill:novice" : level >= 75f ? "doingskill:master" : level >= 40f ? "doingskill:good" : "doingskill:fair";
            }

            if (GoodDay(villager)) yield return "goodday";
        }

        private static string Word(float level) =>
            level < 15f ? "still learning" : level < 40f ? "fair" : level < 60f ? "good" : level < 75f ? "very good" : "as good as anyone alive";

        public static string Fill(string line, Villager villager, string activityWord)
        {
            if (line.IndexOf('{') < 0)
            {
                return line;
            }

            string best = Best(villager);
            string doing = SkillFor(activityWord) ?? best;
            return line.Replace("{bestskill}", best).Replace("{bestskillman}", Doers[best])
                .Replace("{skillword}", Word(Level(villager, doing))).Replace("{skilldoing}", doing);
        }

        public static string Describe(Villager villager) =>
            string.Join(", ", Read(villager).OrderByDescending(s => s.Value).Select(s => $"{s.Key} {s.Value:0}")) +
            (GoodDay(villager) ? "; having a good day" : "");
    }
}
