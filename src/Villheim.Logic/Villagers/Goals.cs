using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// What a villager wants for the next few days, after The Sims' wants: one at a time, picked from his life as it
    /// is (no bed, a rival, a friend he is fond of, a skill he is poor at, a quiet spell after hard work...), held two
    /// to six days, then met, or given up and replaced by another.
    ///
    /// Wants: a bed of his own; a bigger house; to learn a skill he is poor at; to be the best at what he does best;
    /// to court a friend he likes a lot (five good chats with them and they are sweethearts, which both remember);
    /// to make peace with a rival (three chats); a feast; news from far off (a pedlar or pilgrim comes); to bring
    /// down something big (a hunt); a quiet day (a rest day or a good mood); to see the player again. Wants that wait
    /// on an event (a house, news, a hunt) are only met by one that happens after the want began.
    ///
    /// Met: a mood thought (+8, half a game day), a line, and for sweethearts a chronicle entry. Given up: a small
    /// low (-3). Dialogue tags goal:x, goal:any, goalmet:x and gaveup:x (the day after), courting, hassweetheart,
    /// sweetheart:near; fill-ins {goal} {sweetheart} {goalskill}. Kept in the villager's ZDO.
    /// </summary>
    internal static class Goals
    {
        private static readonly int KeyGoal = "villheim_goal".GetStableHashCode();
        private static readonly int KeyLastGoal = "villheim_lastgoal".GetStableHashCode();
        private static readonly int KeySweetheart = "villheim_sweetheart".GetStableHashCode();

        private static int Today => EnvMan.instance != null ? EnvMan.instance.GetDay() : 0;

        private sealed class Goal
        {
            public string Kind;
            public int Start;
            public int Until;
            public float Progress;
            public string Extra;
        }

        private sealed class State
        {
            public float NextCheck;
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();

        private static readonly Dictionary<string, string> Phrases = new Dictionary<string, string>
        {
            ["bed"] = "a bed of my own", ["house"] = "a bigger house", ["learn"] = "to learn {goalskill}",
            ["master"] = "to be the best at {goalskill}", ["court"] = "{sweetheart}", ["peace"] = "to make peace with {rival}",
            ["feast"] = "a proper feast", ["news"] = "news from somewhere else", ["hunt"] = "to bring down something big",
            ["rest"] = "a quiet day", ["player"] = "to see {player} again",
        };

        private static int Seed(Villager v) => v.Zdo != null ? v.Zdo.GetInt(Keys.VillagerSeed) : 1;

        private static Goal Read(Villager villager)
        {
            string[] f = (villager.Zdo?.GetString(KeyGoal, "") ?? "").Split('|');
            if (f.Length < 5)
            {
                return null;
            }

            return new Goal
            {
                Kind = f[0], Start = I(f[1]), Until = I(f[2]),
                Progress = float.TryParse(f[3], NumberStyles.Float, CultureInfo.InvariantCulture, out float p) ? p : 0f, Extra = f[4],
            };
        }

        private static void Write(Villager villager, Goal goal)
        {
            if (villager.Zdo == null || villager.m_nview == null || !villager.m_nview.IsOwner())
            {
                return;
            }

            villager.Zdo.Set(KeyGoal, goal == null ? "" : string.Join("|", goal.Kind, goal.Start.ToString(CultureInfo.InvariantCulture),
                goal.Until.ToString(CultureInfo.InvariantCulture), goal.Progress.ToString("0.##", CultureInfo.InvariantCulture), goal.Extra ?? ""));
        }

        /// <summary>"kind|day|met" of the last want that ended, for the goalmet and gaveup tags.</summary>
        private static (string Kind, int Day, bool Met) Last(Villager villager)
        {
            string[] f = (villager.Zdo?.GetString(KeyLastGoal, "") ?? "").Split('|');
            return f.Length < 3 ? (null, -99, false) : (f[0], I(f[1]), f[2] == "1");
        }

        private static int I(string s) => int.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out int n) ? n : 0;

        // ---------------------------------------------------------------- sweethearts

        public static Villager Sweetheart(Villager villager)
        {
            int seed = villager.Zdo?.GetInt(KeySweetheart, 0) ?? 0;
            if (seed == 0)
            {
                return null;
            }

            return Character.GetAllCharacters().OfType<Villager>()
                .FirstOrDefault(o => o != villager && !o.IsDead() && o.VillageId == villager.VillageId && Seed(o) == seed);
        }

        /// <summary>Whether <paramref name="a"/> is courting <paramref name="b"/> just now.</summary>
        public static bool IsCourting(Villager a, Villager b)
        {
            Goal goal = Read(a);
            return goal != null && goal.Kind == "court" && goal.Extra == Seed(b).ToString(CultureInfo.InvariantCulture);
        }

        private static bool HasSweetheart(Villager villager) => (villager.Zdo?.GetInt(KeySweetheart, 0) ?? 0) != 0;

        // ---------------------------------------------------------------- the day-to-day

        /// <summary>Every 30 seconds or so: pick a want if there is none, check whether it is met or has run out.</summary>
        public static void Update(Villager villager)
        {
            State state = States.GetOrCreateValue(villager);
            if (Time.time < state.NextCheck || villager.Zdo == null || villager.m_nview == null || !villager.m_nview.IsOwner() ||
                Wanderers.IsWanderer(villager) || villager.VillageId == 0)
            {
                return;
            }

            state.NextCheck = Time.time + 30f + Random.Range(0f, 10f);
            Goal goal = Read(villager);
            if (goal == null)
            {
                int lastDay = Last(villager).Day;
                if (Today - lastDay >= 1 || lastDay < 0)
                {
                    Write(villager, Pick(villager));
                }

                return;
            }

            if (Met(villager, goal))
            {
                End(villager, goal, true);
            }
            else if (Today > goal.Until)
            {
                End(villager, goal, false);
            }
        }

        private static Goal Pick(Villager villager)
        {
            var options = new List<(string Kind, float Weight, string Extra)>();
            string voice = Dialogue.VoiceOf(villager);
            bool child = Childhood.IsChild(villager);
            if (Beds.For(villager) == null) options.Add(("bed", 4f, ""));
            else if (!child) options.Add(("house", voice == "cheerful" || voice == "young" ? 0.8f : 1.2f, ""));

            Dictionary<string, float> skills = VillagerSkills.Read(villager);
            string weakest = new[] { "woodcutting", "mining", "building", "cooking", "crafting", "farming" }
                .OrderBy(s => skills.TryGetValue(s, out float v) ? v : 0f).First();
            options.Add(("learn", voice == "young" || child ? 2.5f : 1f, weakest + ":" + (skills.TryGetValue(weakest, out float w) ? w : 0f).ToString("0.#", CultureInfo.InvariantCulture)));
            string best = VillagerSkills.Best(villager);
            options.Add(("master", voice == "gruff" || voice == "steady" ? 1.5f : 0.8f,
                best + ":" + (Mathf.FloorToInt(skills[best] / 10f) * 10 + 10).ToString(CultureInfo.InvariantCulture)));

            Villager friend = Personality.Friend(villager);
            if (!child && friend != null && !Childhood.IsChild(friend) && !HasSweetheart(villager) && !HasSweetheart(friend) &&
                Personality.Liking(villager, friend) > 0.5f)
            {
                options.Add(("court", voice == "cheerful" || voice == "young" ? 2.5f : 1.5f, Seed(friend).ToString(CultureInfo.InvariantCulture)));
            }

            Villager rival = Personality.Rival(villager);
            if (rival != null) options.Add(("peace", voice == "devout" || voice == "elder" ? 2f : voice == "gruff" ? 0.3f : 0.8f, Seed(rival).ToString(CultureInfo.InvariantCulture)));
            options.Add(("feast", voice == "cheerful" ? 2f : 0.8f, ""));
            options.Add(("news", voice == "wry" || voice == "young" ? 1.5f : 0.7f, ""));
            if (Roles.BackgroundOf(villager) == Roles.Background.Protector && !child) options.Add(("hunt", 1.5f, ""));
            if (Moods.Get(villager) < 45f) options.Add(("rest", voice == "worrier" ? 2.5f : 1.5f, ""));
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth != null && hearth.IsValid && Player.m_localPlayer != null)
            {
                Social.Known known = Social.Find(hearth, Player.m_localPlayer);
                if (known != null && known.Reputation >= Social.FriendAt) options.Add(("player", voice == "cheerful" ? 1.5f : 0.6f, ""));
            }

            // Don't want the same thing twice running.
            string last = Last(villager).Kind;
            options.RemoveAll(o => o.Kind == last && options.Count > 1);
            float roll = Random.value * options.Sum(o => o.Weight);
            (string Kind, float Weight, string Extra) picked = options[options.Count - 1];
            foreach (var o in options)
            {
                roll -= o.Weight;
                if (roll <= 0f)
                {
                    picked = o;
                    break;
                }
            }

            VillheimPlugin.Debug($"{villager.VillagerName} now wants {picked.Kind}.");
            return new Goal { Kind = picked.Kind, Start = Today, Until = Today + Random.Range(2, 7), Extra = picked.Extra };
        }

        private static bool Met(Villager villager, Goal goal)
        {
            switch (goal.Kind)
            {
                case "bed": return Beds.For(villager) != null;
                case "house": return goal.Progress > 0f;
                case "learn":
                {
                    string[] f = (goal.Extra ?? "").Split(':');
                    float start = f.Length > 1 && float.TryParse(f[1], NumberStyles.Float, CultureInfo.InvariantCulture, out float s) ? s : 0f;
                    return f.Length > 0 && VillagerSkills.Level(villager, f[0]) >= start + 6f;
                }

                case "master":
                {
                    string[] f = (goal.Extra ?? "").Split(':');
                    return f.Length > 1 && VillagerSkills.Level(villager, f[0]) >= I(f[1]);
                }

                case "court": return goal.Progress >= 5f;
                case "peace": return goal.Progress >= 3f;
                case "feast": return Gatherings.FeastToday(villager.VillageId);
                case "news": return goal.Progress > 0f;
                case "hunt": return goal.Progress > 0f;
                case "rest": return Moods.Get(villager) >= 62f || (Today > goal.Start && Today % 7 == 0);
                case "player": return goal.Progress > 0f;
                default: return false;
            }
        }

        private static void End(Villager villager, Goal goal, bool met)
        {
            villager.Zdo.Set(KeyLastGoal, $"{goal.Kind}|{Today.ToString(CultureInfo.InvariantCulture)}|{(met ? 1 : 0)}");
            Write(villager, null);
            if (met)
            {
                Moods.Think(villager, "goalmet");
                Dialogue.QueueLine(villager, "self", "goalmet:" + goal.Kind, new[] { "goalmet:" + goal.Kind, "goalmet" }, Random.Range(1f, 4f));
                if (goal.Kind == "court")
                {
                    Villager other = Character.GetAllCharacters().OfType<Villager>().FirstOrDefault(o => Seed(o).ToString(CultureInfo.InvariantCulture) == goal.Extra);
                    if (other != null)
                    {
                        villager.Zdo.Set(KeySweetheart, Seed(other));
                        other.Zdo?.Set(KeySweetheart, Seed(villager));
                        Moods.Think(other, "courting");
                        Chronicle.Add(villager.VillageId, $"{villager.VillagerName} and {other.VillagerName} are walking out together.");
                    }
                }
            }
            else
            {
                Moods.Think(villager, "goalgaveup");
            }

            VillheimPlugin.Debug($"{villager.VillagerName} {(met ? "got" : "gave up on")} {goal.Kind}.");
        }

        public static readonly string[] Kinds = { "bed", "house", "learn", "master", "court", "peace", "feast", "news", "hunt", "rest", "player" };

        /// <summary>Sets a want by hand ('vh goal'), with what it needs filled in from the villager's life.</summary>
        public static bool Force(Villager villager, string kind)
        {
            if (!Kinds.Contains(kind))
            {
                return false;
            }

            string extra = "";
            if (kind == "learn" || kind == "master")
            {
                string skill = kind == "learn"
                    ? VillagerSkills.Read(villager).OrderBy(s => s.Value).First().Key
                    : VillagerSkills.Best(villager);
                float level = VillagerSkills.Level(villager, skill);
                extra = skill + ":" + (kind == "learn" ? level.ToString("0.#", CultureInfo.InvariantCulture)
                    : (Mathf.FloorToInt(level / 10f) * 10 + 10).ToString(CultureInfo.InvariantCulture));
            }
            else if (kind == "court")
            {
                Villager friend = Personality.Friend(villager) ?? Personality.Rival(villager);
                extra = friend != null ? Seed(friend).ToString(CultureInfo.InvariantCulture) : "";
            }
            else if (kind == "peace")
            {
                Villager rival = Personality.Rival(villager);
                extra = rival != null ? Seed(rival).ToString(CultureInfo.InvariantCulture) : "";
            }

            Write(villager, new Goal { Kind = kind, Start = Today, Until = Today + 3, Extra = extra });
            return true;
        }

        // ---------------------------------------------------------------- what moves a want along

        /// <summary>Two villagers chatted: courting and making peace move along.</summary>
        public static void Chatted(Villager a, Villager b)
        {
            Nudge(a, b);
            Nudge(b, a);
        }

        private static void Nudge(Villager villager, Villager with)
        {
            Goal goal = Read(villager);
            if (goal == null || (goal.Kind != "court" && goal.Kind != "peace") || goal.Extra != Seed(with).ToString(CultureInfo.InvariantCulture))
            {
                return;
            }

            goal.Progress += 1f;
            Write(villager, goal);
            if (goal.Kind == "court")
            {
                Moods.Think(villager, "courting");
            }
        }

        /// <summary>A village event happened while the want was open (a building finished, a hunt, a visitor...).</summary>
        public static void VillageEvent(int villageId, string what)
        {
            foreach (Villager villager in Character.GetAllCharacters().OfType<Villager>())
            {
                if (villager.IsDead() || villager.VillageId != villageId || villager.VillageId == 0)
                {
                    continue;
                }

                Goal goal = Read(villager);
                if (goal != null && ((goal.Kind == "house" && (what == "finished" || what == "upgrade")) || (goal.Kind == "hunt" && what == "hunt") ||
                                     (goal.Kind == "news" && (what == "pedlar" || what == "pilgrim"))))
                {
                    goal.Progress += 1f;
                    Write(villager, goal);
                }
            }
        }

        /// <summary>The player came to the village: anyone who wanted to see him again has.</summary>
        public static void PlayerCame(int villageId)
        {
            foreach (Villager villager in Character.GetAllCharacters().OfType<Villager>())
            {
                if (!villager.IsDead() && villager.VillageId == villageId && Read(villager) is Goal goal && goal.Kind == "player" && goal.Start < Today)
                {
                    goal.Progress = 1f;
                    Write(villager, goal);
                }
            }
        }

        // ---------------------------------------------------------------- dialogue

        public static IEnumerable<string> Tags(Villager villager)
        {
            Goal goal = Read(villager);
            if (goal != null)
            {
                yield return "goal:any";
                yield return "goal:" + goal.Kind;
                if (goal.Kind == "court") yield return "courting";
                if (Today - goal.Start >= 2) yield return "goal:old";
            }

            (string kind, int day, bool met) = Last(villager);
            if (kind != null && Today - day <= 1)
            {
                yield return (met ? "goalmet:" : "gaveup:") + kind;
            }

            if (HasSweetheart(villager))
            {
                yield return "hassweetheart";
                Villager sweetheart = Sweetheart(villager);
                if (sweetheart != null && Vector3.Distance(sweetheart.transform.position, villager.transform.position) < 10f)
                {
                    yield return "sweetheart:near";
                }
            }
        }

        public static string Fill(string line, Villager villager)
        {
            if (line.IndexOf('{') < 0)
            {
                return line;
            }

            Goal goal = Read(villager);
            if (line.Contains("{goal}"))
            {
                line = line.Replace("{goal}", goal != null && Phrases.TryGetValue(goal.Kind, out string phrase) ? phrase : "nothing much");
            }

            if (line.Contains("{goalskill}"))
            {
                line = line.Replace("{goalskill}", goal?.Extra?.Split(':')[0] is string s && s.Length > 0 ? s : VillagerSkills.Best(villager));
            }

            if (line.Contains("{sweetheart}"))
            {
                string name = Sweetheart(villager)?.VillagerName;
                if (name == null && goal != null && goal.Kind == "court")
                {
                    name = Character.GetAllCharacters().OfType<Villager>()
                        .FirstOrDefault(o => Seed(o).ToString(CultureInfo.InvariantCulture) == goal.Extra)?.VillagerName;
                }

                line = line.Replace("{sweetheart}", name ?? "someone");
            }

            return line;
        }

        public static string Describe(Villager villager)
        {
            Goal goal = Read(villager);
            (string kind, int day, bool met) = Last(villager);
            string now = goal == null ? "wants nothing just now" : $"wants {goal.Kind} ({goal.Extra}, progress {goal.Progress:0}, until day {goal.Until})";
            return now + (kind != null ? $"; last: {kind} {(met ? "met" : "given up")} on day {day}" : "") +
                   (Sweetheart(villager) != null ? $"; sweetheart {Sweetheart(villager).VillagerName}" : "");
        }
    }
}
