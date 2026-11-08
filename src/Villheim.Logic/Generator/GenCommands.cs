using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using BepInEx;
using UnityEngine;
using Villheim.Logic.Designs;

namespace Villheim.Logic.Generator
{
    /// <summary>
    /// 'vh gen', 'vh ask', 'vh asks' and 'vh place': buildings made from a short request with the blueprint lab's own
    /// generator (LabEngine), built in front of the player the way 'vh preview' builds a blueprint. Files go under
    /// PlanBuild's inspiration folder, which villages never build from.
    /// </summary>
    internal static class GenCommands
    {
        public static readonly string[] Help =
        {
            "gen <biome> <type> <stage> [culture] [\"request\"] [seed]: make a new building with the blueprint lab and build it in front of you, e.g. gen md home s1d3 \"two storeys with a porch\"; saved to PlanBuild/blueprints/inspiration/generated/ingame ('gen help' lists the codes)",
            "ask <biome> <type> <stage> [culture] \"request\": write the request to BepInEx/config/Villheim/requests/requests.jsonl for Claude to make with more care; 'asks' lists them, 'place <id>' builds the result",
            "asks: list the requests made with 'ask' and their status",
            "place <id|name> [here]: build a finished request (R-0001) or an in-game generated design in front of you; 'here' builds a request where you stood when you asked",
        };

        private static readonly string[] GenHelp =
        {
            "vh gen <biome> <type> <stage> [culture] [\"request in plain words\"] [seed]",
            "  biome: md Meadows, bf Black Forest, sw Swamp, mt Mountains, pl Plains, ml Mistlands, al Ashlands, dn Deep North (built with the Mountain kit for now)",
            "  type: home (house), longhouse (hall), tavern, smithy, sawmill, workshop, barn, farm, storage, tower, dock, stall, temple, well, camp. The lab has no hub or hearth design yet.",
            "  stage: size s1 to s3 and decor d1 to d3, e.g. s1d3 (small and richly furnished); s2 alone means d2",
            "  culture: optional; without it the biome's cultures are picked by weight",
            "  request words: plan (L-shaped, T-shaped, cross, courtyard, round, long, square), roof (gable, hip, flat, shed roof, steep, low roof),",
            "    walls (plank, half-timber, log, stone, stone base), storeys (one, two or three storeys), porch (with a porch, no porch), size (small, large), decor (bare, cosy, rich)",
            "  seed: optional; the best of several seeds from it is kept (checks first, then the keep score). Without it a new seed each time.",
            "Examples:",
            "  vh gen md home s1d3 \"two storeys with a porch\"",
            "  vh gen bf longhouse s3d2 norse-forest \"steep roof\" 7",
            "  vh gen pl home s2d2 middle-eastern \"courtyard, flat roof\"",
            "  vh gen sw storage s1d1",
            "Saved to BepInEx/config/PlanBuild/blueprints/inspiration/generated/ingame/<name>.blueprint. 'vh place <name>' or 'vh preview <name>' builds it again.",
            "vh ask (same words) saves the request for Claude instead; 'vh asks' lists them; 'vh place R-0001 [here]' builds a finished one.",
        };

        private static readonly string[] BiomeCodes = { "md", "bf", "sw", "mt", "pl", "ml", "al", "dn" };
        private static readonly Regex StagePattern = new Regex(@"^s[123](d[123])?$", RegexOptions.IgnoreCase);
        private static readonly Regex RequestId = new Regex(@"^R-\d{4,}$", RegexOptions.IgnoreCase);

        private static string Generated => Path.Combine(Paths.ConfigPath, "PlanBuild", "blueprints", "inspiration", "generated");
        public static string IngameFolder => Path.Combine(Generated, "ingame");
        public static string ResultFolder => Path.Combine(Generated, "requests");
        public static string RequestsFile => Path.Combine(Paths.ConfigPath, "Villheim", "requests", "requests.jsonl");

        private static bool _busy;

        // ---------------------------------------------------------------- arguments

        private sealed class Parsed
        {
            public string Biome, Type, Stage, Culture, Words = "";
            public int Seed;
        }

        /// <summary>
        /// "md home s1d3 [culture] ["words"] [seed]". The console splits on spaces and keeps the quotes, so the words
        /// are put back together here. Without quotes everything after the stage is words, but for a last number
        /// (the seed); a culture key among the words is still read as the culture by the lab.
        /// </summary>
        private static bool Parse(string[] args, out Parsed parsed, out string error)
        {
            parsed = null;
            error = null;
            string[] tokens = (args ?? new string[0]).Where(a => !string.IsNullOrWhiteSpace(a)).ToArray();
            if (tokens.Length < 3)
            {
                error = "Usage: vh gen <biome> <type> <stage> [culture] [\"request\"] [seed]. 'vh gen help' lists the codes.";
                return false;
            }

            var p = new Parsed { Biome = tokens[0].ToLowerInvariant(), Type = tokens[1].ToLowerInvariant(), Stage = tokens[2].ToLowerInvariant() };
            if (!BiomeCodes.Contains(p.Biome))
            {
                error = $"Unknown biome '{tokens[0]}'. Codes: {string.Join(", ", BiomeCodes)}.";
                return false;
            }

            if (!StagePattern.IsMatch(p.Stage))
            {
                error = $"Unknown stage '{tokens[2]}'. Use s1 to s3 with d1 to d3, e.g. s1d3.";
                return false;
            }

            string rest = string.Join(" ", tokens.Skip(3));
            int open = rest.IndexOf('"');
            int close = rest.LastIndexOf('"');
            string before = rest, after = "";
            if (open >= 0)
            {
                before = rest.Substring(0, open).Trim();
                if (close > open)
                {
                    p.Words = rest.Substring(open + 1, close - open - 1).Trim();
                    after = rest.Substring(close + 1).Trim();
                }
                else
                {
                    p.Words = rest.Substring(open + 1).Trim();
                }

                if (before.Length > 0)
                {
                    string[] words = before.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                    p.Culture = words[0].ToLowerInvariant();
                    if (words.Length > 1)
                    {
                        p.Words = (string.Join(" ", words.Skip(1)) + " " + p.Words).Trim();
                    }
                }
            }
            else
            {
                after = rest;
            }

            // A last whole number is the seed.
            string[] tail = after.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
            if (tail.Length > 0 && int.TryParse(tail[tail.Length - 1], out int seed) && seed > 0)
            {
                p.Seed = seed;
                tail = tail.Take(tail.Length - 1).ToArray();
            }

            if (open < 0)
            {
                p.Words = string.Join(" ", tail);
            }
            else if (tail.Length > 0)
            {
                p.Words = (p.Words + " " + string.Join(" ", tail)).Trim();
            }

            parsed = p;
            return true;
        }

        // ---------------------------------------------------------------- vh gen

        public static void Gen(string[] args, Terminal context)
        {
            if (args != null && args.Length > 0 && (args[0] == "help" || args[0] == "?"))
            {
                Say(context, string.Join("\n", GenHelp));
                return;
            }

            if (!Parse(args, out Parsed p, out string error))
            {
                Say(context, error);
                return;
            }

            Player player = Player.m_localPlayer;
            if (player == null)
            {
                Say(context, "Villheim: you need to be in a world to use this.");
                return;
            }

            if (_busy)
            {
                Say(context, "Villheim: still making the last design. Wait a moment.");
                return;
            }

            if (p.Seed == 0)
            {
                p.Seed = UnityEngine.Random.Range(1, 100000);
            }

            int tries = Mathf.Clamp(LogicConfig.GenCandidates?.Value ?? 8, 1, 32);
            Vector3 standing = player.transform.position;
            float yaw = player.transform.eulerAngles.y;
            Say(context, $"Villheim: making {p.Type} ({p.Biome} {p.Stage}{(p.Culture != null ? " " + p.Culture : "")}{(p.Words.Length > 0 ? ", \"" + p.Words + "\"" : "")}), best of {tries} from seed {p.Seed}...");

            // Jint first, on this thread; then the work on a worker thread so the game keeps running.
            LabEngine.Prepare(Path.GetDirectoryName(typeof(VillheimPlugin).Assembly.Location));
            var job = new Job();
            _busy = true;
            var thread = new Thread(() =>
            {
                try
                {
                    job.Result = LabEngine.Make(p.Type, p.Biome, p.Culture, p.Stage, p.Words, p.Seed, tries);
                }
                catch (Exception e)
                {
                    job.Failure = e;
                }

                job.Done = true;
            }) { IsBackground = true, Name = "Villheim generator" };
            thread.Start();
            VillheimPlugin.Instance.StartCoroutine(Finish(job, standing, yaw, context));
        }

        private sealed class Job
        {
            public volatile bool Done;
            public LabResult Result;
            public Exception Failure;
        }

        private static IEnumerator Finish(Job job, Vector3 standing, float yaw, Terminal context)
        {
            float started = Time.realtimeSinceStartup;
            while (!job.Done)
            {
                yield return null;
            }

            _busy = false;
            if (job.Failure != null)
            {
                Exception root = job.Failure.GetBaseException();
                VillheimPlugin.Log.LogError($"vh gen failed: {job.Failure}");
                Say(context, $"Villheim: the generator failed: {root.GetType().Name}: {root.Message}");
                if (root is FileNotFoundException || root is TypeLoadException || root is FileLoadException)
                {
                    Say(context, "Jint.dll, Acornima.dll and System.Runtime.CompilerServices.Unsafe.dll must be in the Villheim plugin folder.");
                }

                yield break;
            }

            LabResult r = job.Result;
            if (r.Error != null)
            {
                Say(context, "Villheim: " + r.Error);
                yield break;
            }

            Directory.CreateDirectory(IngameFolder);
            string file = Path.Combine(IngameFolder, SafeName(r.Name) + ".blueprint");
            File.WriteAllText(file, r.Blueprint, new UTF8Encoding(false));
            Blueprints.Forget();

            int built = Build(file, standing, yaw, out string problem);
            Say(context, $"Villheim: {r.Name} in {Time.realtimeSinceStartup - started:0.0} s");
            Say(context, Summary(r));
            Say(context, problem ?? $"   built {built} of {r.Pieces} pieces in front of you. 'vh place {SafeName(r.Name)}' builds it again.");
        }

        private static string Summary(LabResult r)
        {
            var lines = new List<string>
            {
                $"   {r.Description}",
                $"   plan {r.Plan}, roof {r.Roof}, walls {r.Walls}, culture {r.Culture}, {r.Pieces} pieces, checks {r.Passed}/{r.Checks}, keep score {r.Score * 100:0}%",
            };
            lines.AddRange(r.Failed.Select(f => "   failed " + f));
            lines.AddRange(r.Notes.Select(n => "   note: " + n));
            return string.Join("\n", lines);
        }

        private static string SafeName(string name) => Regex.Replace(name ?? "design", @"[^A-Za-z0-9_.-]+", "_");

        /// <summary>Builds a blueprint file in front of a spot, as 'vh preview' does: the ground levelled, every piece at once.</summary>
        private static int Build(string file, Vector3 standing, float yaw, out string problem)
        {
            problem = null;
            Blueprints.Blueprint blueprint = Blueprints.FromFile(file);
            if (blueprint == null || blueprint.Pieces.Count == 0)
            {
                problem = $"   could not read {file}.";
                return 0;
            }

            Quaternion turn = Quaternion.Euler(0f, yaw, 0f);
            Vector3 at = standing + turn * Vector3.forward * (blueprint.Radius + 3f);
            if (ZoneSystem.instance != null && ZoneSystem.instance.GetGroundHeight(at, out float ground))
            {
                at.y = ground;
            }

            if (LogicConfig.GenLevelGround?.Value ?? true)
            {
                TerrainShaper.LevelPad(at, blueprint.Radius * 0.7f, blueprint.Radius * 0.7f + 3f);
            }

            int count = 0;
            foreach (DesignSpawner.PlanEntry entry in Blueprints.MakePlan(blueprint, at, yaw))
            {
                if (DesignSpawner.SpawnEntry(entry, at, turn, 0, false) != null)
                {
                    count++;
                }
            }

            return count;
        }

        // ---------------------------------------------------------------- vh ask, vh asks

        /// <summary>One line of requests.jsonl. lab/process_requests.js adds the result fields.</summary>
        [Serializable]
        private sealed class AskRecord
        {
            public string id;
            public string time;
            public string world;
            public float[] pos;
            public float yaw;
            public string biome;
            public string type;
            public string stage;
            public string culture;
            public string request;
            public int seed;
            public string status;
            public string result;
            public string note;
        }

        public static string Ask(string[] args)
        {
            if (!Parse(args, out Parsed p, out string error))
            {
                return error.Replace("vh gen", "vh ask");
            }

            Player player = Player.m_localPlayer;
            if (player == null)
            {
                return "Villheim: you need to be in a world to use this.";
            }

            List<AskRecord> all = ReadAsks();
            int next = all.Select(a => int.TryParse((a.id ?? "").Replace("R-", ""), out int n) ? n : 0).DefaultIfEmpty(0).Max() + 1;
            Vector3 at = player.transform.position;
            var record = new AskRecord
            {
                id = $"R-{next:0000}",
                time = DateTime.Now.ToString("yyyy-MM-ddTHH:mm:sszzz"),
                world = ZNet.instance != null ? ZNet.instance.GetWorldName() : "",
                pos = new[] { Round(at.x), Round(at.y), Round(at.z) },
                yaw = Round(player.transform.eulerAngles.y),
                biome = p.Biome, type = p.Type, stage = p.Stage, culture = p.Culture ?? "", request = p.Words, seed = p.Seed,
                status = "open", result = "", note = "",
            };

            Directory.CreateDirectory(Path.GetDirectoryName(RequestsFile));
            File.AppendAllText(RequestsFile, JsonUtility.ToJson(record) + "\n", new UTF8Encoding(false));
            return $"Villheim: request {record.id} saved ({p.Biome} {p.Type} {p.Stage}{(p.Culture != null ? " " + p.Culture : "")}, \"{p.Words}\"). " +
                   $"When it is done, 'vh place {record.id}' builds it in front of you ('here' builds it where you stand now).";
        }

        public static string Asks()
        {
            List<AskRecord> all = ReadAsks();
            if (all.Count == 0)
            {
                return $"Villheim: no requests yet. 'vh ask' adds one to {RequestsFile}.";
            }

            var lines = new List<string> { $"Villheim: {all.Count} requests ({all.Count(a => a.status == "done")} done) in {RequestsFile}" };
            foreach (AskRecord a in all)
            {
                bool ready = a.status == "done" && File.Exists(ResultFile(a.id));
                lines.Add($"   {a.id} {a.status}{(ready ? "" : a.status == "done" ? " (file missing)" : "")}: {a.biome} {a.type} {a.stage}" +
                          $"{(string.IsNullOrEmpty(a.culture) ? "" : " " + a.culture)} \"{a.request}\"" +
                          $"{(string.IsNullOrEmpty(a.result) ? "" : " -> " + a.result)}{(string.IsNullOrEmpty(a.note) ? "" : " (" + a.note + ")")}");
            }

            return string.Join("\n", lines);
        }

        private static List<AskRecord> ReadAsks()
        {
            var all = new List<AskRecord>();
            if (!File.Exists(RequestsFile))
            {
                return all;
            }

            foreach (string line in File.ReadAllLines(RequestsFile))
            {
                if (line.Trim().Length == 0)
                {
                    continue;
                }

                try
                {
                    AskRecord record = JsonUtility.FromJson<AskRecord>(line);
                    if (record != null && !string.IsNullOrEmpty(record.id))
                    {
                        all.Add(record);
                    }
                }
                catch (Exception e)
                {
                    VillheimPlugin.Log.LogWarning($"requests.jsonl: skipped a line it could not read ({e.Message}).");
                }
            }

            return all;
        }

        private static string ResultFile(string id) => Path.Combine(ResultFolder, id.ToUpperInvariant() + ".blueprint");

        private static float Round(float value) => Mathf.Round(value * 100f) / 100f;

        // ---------------------------------------------------------------- vh place

        public static string Place(string[] args)
        {
            string[] tokens = (args ?? new string[0]).Where(a => !string.IsNullOrWhiteSpace(a)).ToArray();
            if (tokens.Length == 0)
            {
                return "Usage: vh place <R-0001|design name> [here]";
            }

            Player player = Player.m_localPlayer;
            if (player == null)
            {
                return "Villheim: you need to be in a world to use this.";
            }

            bool here = tokens.Skip(1).Any(t => t.Equals("here", StringComparison.OrdinalIgnoreCase));
            Vector3 standing = player.transform.position;
            float yaw = player.transform.eulerAngles.y;
            string file;
            if (RequestId.IsMatch(tokens[0]))
            {
                string id = tokens[0].ToUpperInvariant();
                AskRecord record = ReadAsks().FirstOrDefault(a => string.Equals(a.id, id, StringComparison.OrdinalIgnoreCase));
                file = ResultFile(id);
                if (!File.Exists(file))
                {
                    return record == null
                        ? $"Villheim: no request {id}. 'vh asks' lists them."
                        : $"Villheim: {id} is {record.status}; its result is not in {ResultFolder} yet.";
                }

                if (here)
                {
                    if (record?.pos == null || record.pos.Length < 3)
                    {
                        return $"Villheim: {id} has no saved position.";
                    }

                    standing = new Vector3(record.pos[0], record.pos[1], record.pos[2]);
                    yaw = record.yaw;
                }
            }
            else
            {
                string stem = SafeName(tokens[0].StartsWith(Blueprints.Prefix) ? tokens[0].Substring(Blueprints.Prefix.Length) : tokens[0]);
                file = Path.Combine(IngameFolder, stem + ".blueprint");
                if (!File.Exists(file))
                {
                    return $"Villheim: no design {stem} in {IngameFolder}. 'vh preview <name>' finds blueprints anywhere.";
                }

                if (here)
                {
                    return "Villheim: 'here' works with requests (R-0001); a design is built in front of you.";
                }
            }

            int built = Build(file, standing, yaw, out string problem);
            return problem != null ? "Villheim:" + problem : $"Villheim: built {Path.GetFileNameWithoutExtension(file)} ({built} pieces){(here ? " where you asked for it" : "")}.";
        }

        private static void Say(Terminal context, string text)
        {
            foreach (string line in (text ?? "").Split('\n'))
            {
                context?.AddString(line);
            }

            if (context == null)
            {
                VillheimPlugin.Log.LogInfo(text);
            }
        }
    }
}
