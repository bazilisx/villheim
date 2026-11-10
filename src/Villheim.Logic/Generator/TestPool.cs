using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using UnityEngine;
using Villheim.Logic.Designs;

namespace Villheim.Logic.Generator
{
    /// <summary>
    /// A small pool of generated designs for testing how villagers build, live in, grow and decorate their buildings
    /// (Tyler, 2026-11-09). 'vh testpool make' runs the blueprint lab in the game for a fixed set of building lines
    /// (three homes, a hall, a woodworker, a smithy, a farm, a barn, a storehouse) at every stage and decor level, s1d1
    /// to s3d3, and writes them to BepInEx/config/Villheim/blueprints/testpool-&lt;culture&gt;/ as &lt;line&gt;_s#d#.blueprint,
    /// tagged with their role, biome and culture. With the TestPool setting on, villages of that culture build only
    /// these for the roles they cover: a plot starts at s1d1, residents put up d2 and d3 (HomeDecor), and the plot
    /// grows into the next stage's d1 (Blueprints.NextLevel).
    ///
    /// Each line keeps one seed for all nine designs, so a line's stages share as much as the generator allows.
    /// </summary>
    internal static class TestPool
    {
        public static readonly string[] Help =
        {
            "testpool [make|list] [culture] [biome] [lines]: 'make' writes the test pool (three homes, hall, woodworker, smithy, farm, barn, storehouse, each s1d1 to s3d3) for a culture, default norse in the Meadows; turn on TestPool in the settings and villages of that culture build only these; 'list' shows what is there; [lines] picks 'homes' or names such as home-a,hall,smithy",
        };

        private sealed class Line
        {
            public string Name, Type, Role;
            public int Seed;
        }

        private static readonly Line[] Lines =
        {
            new Line { Name = "home-a", Type = "home", Role = "house", Seed = 101 },
            new Line { Name = "home-b", Type = "home", Role = "house", Seed = 202 },
            new Line { Name = "home-c", Type = "home", Role = "house", Seed = 303 },
            new Line { Name = "hall", Type = "longhouse", Role = "hub", Seed = 11 },
            new Line { Name = "woodworker", Type = "sawmill", Role = "workshop", Seed = 21 },
            new Line { Name = "smithy", Type = "smithy", Role = "workshop", Seed = 22 },
            new Line { Name = "farm", Type = "farm", Role = "farm", Seed = 31 },
            new Line { Name = "barn", Type = "barn", Role = "farm", Seed = 32 },
            new Line { Name = "storehouse", Type = "storage", Role = "storage", Seed = 41 },
        };

        private static volatile bool _busy;
        private static int _done, _total;

        public static string FolderFor(string culture) => Path.Combine(Blueprints.Folder, "testpool-" + culture.ToLowerInvariant());

        /// <summary>The pool's s1d1 designs for a role, for villages of its culture (or every culture when untagged).</summary>
        public static List<DesignLibrary.Design> PoolFor(Heightmap.Biome biome, Role role, string culture)
        {
            var pool = new List<DesignLibrary.Design>();
            foreach (Blueprints.Blueprint blueprint in Blueprints.All().Values)
            {
                string file = (blueprint.File ?? "").Replace('\\', '/').ToLowerInvariant();
                string biomeName = biome == Heightmap.Biome.BlackForest ? "blackforest" : biome.ToString().ToLowerInvariant();
                // Any culture and biome: with TestPool on, only pool designs go up (Tyler, 2026-11-09).
                if (!file.Contains("/testpool-") || blueprint.Role != role || Blueprints.LaterStage(blueprint))
                {
                    continue;
                }

                pool.Add(new DesignLibrary.Design(blueprint, 1f));
            }

            return pool;
        }

        public static string Run(string[] args, Terminal context)
        {
            string verb = args != null && args.Length > 0 ? args[0].ToLowerInvariant() : "list";
            string culture = args != null && args.Length > 1 ? args[1].ToLowerInvariant() : "norse";
            string biome = args != null && args.Length > 2 ? args[2] : "md";
            if (_busy && (verb == "list" || verb == "make"))
            {
                return $"Villheim: still making the test pool: {_done} of {_total} designs done. Finished designs are already in the folder.";
            }

            if (verb == "list")
            {
                string listFolder = FolderFor(culture);
                if (!Directory.Exists(listFolder))
                {
                    return $"Villheim: no test pool for {culture} yet. 'vh testpool make {culture}' writes it.";
                }

                string[] files = Directory.GetFiles(listFolder, "*.blueprint").Select(Path.GetFileNameWithoutExtension).OrderBy(n => n).ToArray();
                return $"Villheim: {files.Length} designs in {listFolder} (TestPool is {(LogicConfig.TestPool.Value ? "on" : "off")}): {string.Join(", ", files)}";
            }

            if (verb != "make")
            {
                return "Villheim: vh testpool make|list [culture] [biome]";
            }

            // an optional fourth word picks lines: 'homes', or names joined by commas (home-a,hall,smithy)
            string pick = args != null && args.Length > 3 ? args[3].ToLowerInvariant() : "all";
            Line[] lines = Lines.Where(l => pick == "all" || (pick == "homes" ? l.Type == "home" : pick.Split(',').Contains(l.Name))).ToArray();
            if (lines.Length == 0)
            {
                return $"Villheim: no test pool line called '{pick}'. Lines: {string.Join(", ", Lines.Select(l => l.Name))}, or 'homes'.";
            }

            _busy = true;
            _done = 0;
            _total = lines.Length * 9;
            LabEngine.Prepare(Path.GetDirectoryName(typeof(VillheimPlugin).Assembly.Location));
            string folder = FolderFor(culture);
            Directory.CreateDirectory(folder);
            var results = new List<(Line Line, string Stage, LabResult Result, Exception Failure)>();
            var thread = new Thread(() =>
            {
                foreach (Line line in lines)
                {
                    for (int s = 1; s <= 3; s++)
                    {
                        for (int d = 1; d <= 3; d++)
                        {
                            string stage = $"s{s}d{d}";
                            try
                            {
                                LabResult r = LabEngine.Make(line.Type, biome, culture, stage, "", line.Seed, 1);
                                // each design is written as soon as it is made, so a stop part way keeps what is done
                                if (r != null && r.Error == null && !string.IsNullOrEmpty(r.Blueprint))
                                {
                                    string name = $"{culture}-{line.Name}_{stage}";
                                    File.WriteAllText(Path.Combine(folder, name + ".blueprint"), WithTags(r, name, line.Role, culture), new UTF8Encoding(false));
                                }

                                lock (results) results.Add((line, stage, r, null));
                            }
                            catch (Exception e)
                            {
                                lock (results) results.Add((line, stage, null, e));
                            }

                            Interlocked.Increment(ref _done);
                        }
                    }
                }
            }) { IsBackground = true, Name = "Villheim test pool" };
            thread.Start();
            VillheimPlugin.Instance.StartCoroutine(Write(thread, results, culture, biome, context));
            return $"Villheim: making the {culture} test pool ({lines.Length} lines, s1d1 to s3d3, {lines.Length * 9} designs) in the background. Each design takes some seconds; the log shows progress every minute and 'vh testpool' shows it any time.";
        }

        private static IEnumerator Write(Thread thread, List<(Line Line, string Stage, LabResult Result, Exception Failure)> results,
            string culture, string biome, Terminal context)
        {
            float started = Time.realtimeSinceStartup, nextNote = started + 60f;
            while (thread.IsAlive)
            {
                if (Time.realtimeSinceStartup > nextNote)
                {
                    nextNote += 60f;
                    VillheimPlugin.Log.LogInfo($"Test pool: {_done} of {_total} designs made ({Time.realtimeSinceStartup - started:0} s).");
                }

                yield return null;
            }

            _busy = false;
            string folder = FolderFor(culture);
            int written = 0;
            var failed = new List<string>();
            foreach ((Line line, string stage, LabResult r, Exception failure) in results)
            {
                string name = $"{culture}-{line.Name}_{stage}";
                if (failure != null || r == null || r.Error != null || string.IsNullOrEmpty(r.Blueprint))
                {
                    failed.Add($"{name} ({failure?.GetBaseException().Message ?? r?.Error ?? "no result"})");
                    continue;
                }

                written++;
            }

            Blueprints.Forget();
            Say(context, $"Villheim: wrote {written} test pool designs to {folder} in {Time.realtimeSinceStartup - started:0} s.");
            if (failed.Count > 0)
            {
                Say(context, $"   {failed.Count} failed: {string.Join("; ", failed.Take(6))}");
            }

            Say(context, LogicConfig.TestPool.Value
                ? "   TestPool is on: new buildings of this culture come from the pool."
                : "   Turn on TestPool in the settings (section 5d) so villages build from the pool.");
        }

        /// <summary>The lab's file with its name, a Villheim category and the tags the village reads.</summary>
        private static string WithTags(LabResult r, string name, string role, string culture)
        {
            string biomeTag = (r.Biome ?? "").Replace(" ", "").ToLowerInvariant();
            string description = $"villheim: role={role} biome={biomeTag} culture={culture} ; Test pool {r.Type} {r.Stage}{r.Decor} seed {r.Seed} design {r.Name}";
            var lines = new List<string>();
            foreach (string raw in (r.Blueprint ?? "").Split('\n'))
            {
                string line = raw.TrimEnd('\r');
                if (line.StartsWith("#Name:")) line = "#Name:" + name;
                else if (line.StartsWith("#Description:")) line = "#Description:\"" + description.Replace("\"", "'") + "\"";
                else if (line.StartsWith("#Category:")) line = "#Category:Villheim";
                lines.Add(line);
            }

            return string.Join("\n", lines).TrimEnd('\n') + "\n";
        }

        private static void Say(Terminal context, string text)
        {
            if (context != null)
            {
                context.AddString(text);
            }

            VillheimPlugin.Log.LogInfo(text);
        }
    }
}
