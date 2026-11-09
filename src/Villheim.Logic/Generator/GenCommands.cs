using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
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
    /// generator (LabEngine), built in front of the player the way 'vh preview' builds a blueprint. Files go under an
    /// inspiration folder in PlanBuild's own save folder (villages never build from inspiration folders), with short
    /// names (gen-12-norse-home) and the category Villheim, so PlanBuild lists them on a tab of their own.
    /// </summary>
    internal static class GenCommands
    {
        public static readonly string[] Help =
        {
            "gen <biome> <type> <stage> [culture] [\"request\"] [seed]: make a new building with the blueprint lab and build it in front of you, e.g. gen md home s1d3 \"two stories with a porch\"; saved with a short name (gen-12-norse-home) where PlanBuild finds it, on its Villheim tab ('gen help' lists the codes)",
            "gen list: the last 10 designs made with 'gen', by their short names; 'preview last' or 'place last' builds the newest again",
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
            "    walls (plank, half-timber, log, stone, stone base), stories (one, two or three stories), porch (with a porch, no porch), size (small, large), decor (bare, cozy, rich)",
            "  seed: optional; the best of several seeds from it is kept (checks first, then the keep score). Without it a new seed each time.",
            "Examples:",
            "  vh gen md home s1d3 \"two stories with a porch\"",
            "  vh gen bf longhouse s3d2 norse-forest \"steep roof\" 7",
            "  vh gen pl home s2d2 middle-eastern \"courtyard, flat roof\"",
            "  vh gen sw storage s1d1",
            "Saved as gen-<number>-<culture>-<type>.blueprint in PlanBuild's save folder (inspiration/generated/ingame), category Villheim; PlanBuild lists it on its Villheim tab.",
            "'vh gen list' shows the last 10. 'vh place <short name>', 'vh preview <short name>' or 'vh place last' builds one again.",
            "vh ask (same words) saves the request for Claude instead; 'vh asks' lists them; 'vh place R-0001 [here]' builds a finished one.",
        };

        private static readonly string[] BiomeCodes = { "md", "bf", "sw", "mt", "pl", "ml", "al", "dn" };
        private static readonly Regex StagePattern = new Regex(@"^s[123](d[123])?$", RegexOptions.IgnoreCase);
        private static readonly Regex RequestId = new Regex(@"^R-\d{4,}$", RegexOptions.IgnoreCase);

        // Requests made by Claude ('vh ask') still go where lab/process_requests.js writes them.
        private static string Generated => Path.Combine(Paths.ConfigPath, "PlanBuild", "blueprints", "inspiration", "generated");
        public static string ResultFolder => Path.Combine(Generated, "requests");

        /// <summary>Where 'vh gen' saved before 2026-11-09 (the profile's config folder, which PlanBuild may not search).</summary>
        private static string OldIngameFolder => Path.Combine(Generated, "ingame");

        /// <summary>
        /// 'vh gen' designs: an inspiration folder in PlanBuild's save folder. PlanBuild reads its folders from
        /// marcopogo.PlanBuild.cfg, relative to the Valheim install (valheim.exe), which with r2modman is not the
        /// profile. It loads blueprints only from its search folder, so when the save folder lies outside it the search
        /// folder is used.
        /// </summary>
        public static string IngameFolder
        {
            get
            {
                string search = PlanBuildFolder("Search directory", ".");
                string save = PlanBuildFolder("Save directory", "BepInEx/config/PlanBuild/blueprints");
                string root = Inside(save, search) ? save : search;
                return Path.Combine(root, "inspiration", "generated", "ingame");
            }
        }

        /// <summary>A folder setting from PlanBuild's settings file, made absolute against the Valheim install.</summary>
        private static string PlanBuildFolder(string key, string fallback)
        {
            string value = fallback;
            try
            {
                string config = Path.Combine(Paths.ConfigPath, "marcopogo.PlanBuild.cfg");
                if (File.Exists(config))
                {
                    string section = "";
                    foreach (string raw in File.ReadAllLines(config))
                    {
                        string line = raw.Trim();
                        if (line.StartsWith("["))
                        {
                            section = line;
                            continue;
                        }

                        int equals = line.IndexOf('=');
                        if (section.Equals("[Directories]", StringComparison.OrdinalIgnoreCase) && equals > 0 && !line.StartsWith("#") &&
                            line.Substring(0, equals).Trim().Equals(key, StringComparison.OrdinalIgnoreCase) && line.Substring(equals + 1).Trim().Length > 0)
                        {
                            value = line.Substring(equals + 1).Trim();
                        }
                    }
                }
            }
            catch (Exception e)
            {
                VillheimPlugin.Log.LogWarning($"Could not read PlanBuild's settings: {e.Message}");
            }

            return Path.GetFullPath(Path.IsPathRooted(value) ? value : Path.Combine(Paths.GameRootPath, value));
        }

        private static bool Inside(string folder, string parent)
        {
            string f = Path.GetFullPath(folder).TrimEnd('\\', '/') + Path.DirectorySeparatorChar;
            string p = Path.GetFullPath(parent).TrimEnd('\\', '/') + Path.DirectorySeparatorChar;
            return f.StartsWith(p, StringComparison.OrdinalIgnoreCase);
        }
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

            if (args != null && args.Length > 0 && args[0].Equals("list", StringComparison.OrdinalIgnoreCase))
            {
                Say(context, List());
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
            VillheimPlugin.Instance.StartCoroutine(Finish(job, p.Words, standing, yaw, context));
        }

        private sealed class Job
        {
            public volatile bool Done;
            public LabResult Result;
            public Exception Failure;
        }

        private static IEnumerator Finish(Job job, string words, Vector3 standing, float yaw, Terminal context)
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

            string folder = IngameFolder;
            Directory.CreateDirectory(folder);
            string shortName = NextShortName(folder, r.Culture, r.Type);
            string file = Path.Combine(folder, shortName + ".blueprint");
            File.WriteAllText(file, ForPlanBuild(r, shortName, words), new UTF8Encoding(false));
            Blueprints.Forget();
            bool listed = TellPlanBuild(file);

            int built = Build(file, standing, yaw, out string problem);
            Say(context, $"Villheim: {shortName} ({r.Name}) in {Time.realtimeSinceStartup - started:0.0} s");
            Say(context, Summary(r));
            Say(context, problem ?? $"   built {built} of {r.Pieces} pieces in front of you. 'vh place {shortName}' or 'vh place last' builds it again.");
            Say(context, listed
                ? "   PlanBuild lists it on its Villheim tab."
                : $"   saved to {file}; PlanBuild lists it on its Villheim tab after a restart.");
        }

        // ---------------------------------------------------------------- short names, PlanBuild

        private static readonly Regex ShortPattern = new Regex(@"^gen-(\d+)-", RegexOptions.IgnoreCase);

        /// <summary>gen-12-norse-home: a running number, then the culture and the type.</summary>
        private static string NextShortName(string folder, string culture, string type)
        {
            int next = Saved(folder).Select(f => f.Number).DefaultIfEmpty(0).Max() + 1;
            return SafeName($"gen-{next}-{culture}-{type}").ToLowerInvariant();
        }

        /// <summary>The 'vh gen' designs in a folder with their numbers, newest first.</summary>
        private static List<(int Number, string File)> Saved(string folder)
        {
            var list = new List<(int, string)>();
            if (!Directory.Exists(folder))
            {
                return list;
            }

            foreach (string file in Directory.GetFiles(folder, "gen-*.blueprint"))
            {
                Match m = ShortPattern.Match(Path.GetFileNameWithoutExtension(file));
                if (m.Success && int.TryParse(m.Groups[1].Value, out int n))
                {
                    list.Add((n, file));
                }
            }

            return list.OrderByDescending(x => x.Item1).ToList();
        }

        /// <summary>
        /// The lab's file with PlanBuild's fields set: the short name as its name, category Villheim (its own tab in
        /// PlanBuild's menu), the request in the description, and the lab's long design name kept in '#Design:'.
        /// </summary>
        private static string ForPlanBuild(LabResult r, string shortName, string words)
        {
            string request = $"{r.Description}. Request: {r.Biome} {r.Type} {r.Stage}{r.Decor} {r.Culture}" +
                             $"{(string.IsNullOrEmpty(words) ? "" : " \"" + words + "\"")}, seed {r.Seed}. Design {r.Name}.";
            var lines = new List<string>();
            bool designWritten = false;
            foreach (string raw in (r.Blueprint ?? "").Split('\n'))
            {
                string line = raw.TrimEnd('\r');
                if (line.StartsWith("#Name:")) line = "#Name:" + shortName;
                else if (line.StartsWith("#Description:")) line = "#Description:" + Json(request);
                else if (line.StartsWith("#Category:")) line = "#Category:Villheim";
                else if (!designWritten && (line == "#Pieces" || line == "#SnapPoints"))
                {
                    lines.Add("#Design:" + r.Name);
                    designWritten = true;
                }

                lines.Add(line);
            }

            return string.Join("\n", lines).TrimEnd('\n') + "\n";
        }

        private static string Json(string text)
        {
            var sb = new StringBuilder("\"");
            foreach (char c in text ?? "")
            {
                if (c == '"' || c == '\\') sb.Append('\\').Append(c);
                else if (c < ' ') sb.Append(' ');
                else sb.Append(c);
            }

            return sb.Append('"').ToString();
        }

        /// <summary>
        /// Adds a new file to PlanBuild's list while the game runs, the way PlanBuild adds one it saved itself
        /// (PlanBuild has no public call for it, so through reflection). False when PlanBuild is missing or has changed:
        /// then it lists the file after a restart.
        /// </summary>
        private static bool TellPlanBuild(string file)
        {
            try
            {
                if (!BepInEx.Bootstrap.Chainloader.PluginInfos.TryGetValue("marcopogo.PlanBuild", out BepInEx.PluginInfo info) || info.Instance == null)
                {
                    return false;
                }

                Assembly assembly = info.Instance.GetType().Assembly;
                const BindingFlags any = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static | BindingFlags.Instance;
                Type blueprintType = assembly.GetType("PlanBuild.Blueprints.Blueprint");
                Type manager = assembly.GetType("PlanBuild.Blueprints.BlueprintManager");
                Type gui = assembly.GetType("PlanBuild.Blueprints.BlueprintGUI");
                Type location = assembly.GetType("PlanBuild.Blueprints.BlueprintLocation");
                if (blueprintType == null || manager == null)
                {
                    return false;
                }

                object blueprint = blueprintType.GetMethod("FromFile", any, null, new[] { typeof(string) }, null)?.Invoke(null, new object[] { file });
                string id = blueprintType.GetField("ID", any)?.GetValue(blueprint) as string;
                if (!(manager.GetField("LocalBlueprints", any)?.GetValue(null) is System.Collections.IDictionary known) || id == null)
                {
                    return false;
                }

                if (known.Contains(id))
                {
                    blueprintType.GetMethod("DestroyBlueprint", any)?.Invoke(known[id], null);
                    known.Remove(id);
                }

                if (!(blueprintType.GetMethod("CreatePiece", any)?.Invoke(blueprint, null) is bool made) || !made)
                {
                    return false;
                }

                known.Add(id, blueprint);
                manager.GetMethod("RegisterKnownBlueprints", any)?.Invoke(null, null);
                if (gui != null && location != null)
                {
                    gui.GetMethod("RefreshBlueprints", any)?.Invoke(null, new[] { Enum.Parse(location, "Local") });
                }

                return true;
            }
            catch (Exception e)
            {
                VillheimPlugin.Log.LogWarning($"Could not add {Path.GetFileName(file)} to PlanBuild's list: {e.GetBaseException().Message}");
                return false;
            }
        }

        /// <summary>'vh gen list': the last 10 designs, newest first.</summary>
        private static string List()
        {
            List<(int Number, string File)> saved = Saved(IngameFolder);
            if (saved.Count == 0)
            {
                return $"Villheim: no designs made with 'vh gen' yet (they go to {IngameFolder}).";
            }

            var lines = new List<string> { $"Villheim: the last {Math.Min(10, saved.Count)} of {saved.Count} designs in {IngameFolder}:" };
            foreach ((int _, string file) in saved.Take(10))
            {
                string design = "";
                try
                {
                    design = File.ReadLines(file).FirstOrDefault(l => l.StartsWith("#Design:"))?.Substring(8) ?? "";
                }
                catch (IOException)
                {
                }

                lines.Add($"   {Path.GetFileNameWithoutExtension(file)}  {File.GetLastWriteTime(file):MM-dd HH:mm}  {design}");
            }

            lines.Add("   'vh place <name>' or 'vh preview <name>' builds one; 'last' is the newest.");
            return string.Join("\n", lines);
        }

        /// <summary>
        /// The file of a 'vh gen' design: 'last', a short name, or a long design name from before short names; null when
        /// there is none.
        /// </summary>
        public static string FindDesign(string name)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                return null;
            }

            if (name.Equals("last", StringComparison.OrdinalIgnoreCase))
            {
                return Saved(IngameFolder).Select(x => x.File).FirstOrDefault();
            }

            string stem = SafeName(name.StartsWith(Blueprints.Prefix) ? name.Substring(Blueprints.Prefix.Length) : name);
            foreach (string folder in new[] { IngameFolder, OldIngameFolder })
            {
                string file = Path.Combine(folder, stem + ".blueprint");
                if (File.Exists(file))
                {
                    return file;
                }
            }

            // "gen-12" alone
            Match number = Regex.Match(stem, @"^gen-(\d+)$", RegexOptions.IgnoreCase);
            return number.Success ? Saved(IngameFolder).Where(x => x.Number.ToString() == number.Groups[1].Value).Select(x => x.File).FirstOrDefault() : null;
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

            return DesignSpawner.SpawnAll(Blueprints.Entries(blueprint), at, turn);
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
                return "Usage: vh place <R-0001|short name|last> [here]";
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
                file = FindDesign(tokens[0]);
                if (file == null)
                {
                    return $"Villheim: no design {tokens[0]} in {IngameFolder}. 'vh gen list' shows the last 10; 'vh preview <name>' finds blueprints anywhere.";
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
