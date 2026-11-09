using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
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
    /// 'vh floorplan': one room furnished by the blueprint lab's decorator, laid out in front of the player with its floor,
    /// a low curb where the walls stand, a rail where the windows are, the door and the furniture, and no walls or roof,
    /// so the layout can be judged from above. Each plan has an ID (FP-001) on a sign at its front corner and a row in
    /// BepInEx/config/Villheim/floorplans/floorplans.csv, the same columns as the review sheet's Floorplans tab.
    /// 'vh floorplan set 12' lays out the first 12 plans of the lab's catalog in a grid (FP-001 to FP-012).
    /// </summary>
    internal static class FloorplanCommands
    {
        public static readonly string[] Help =
        {
            "floorplan <shape> <width>x<depth> <room> [biome] [culture] [d1|d2|d3] [seed] [ladder]: one furnished room with no walls or roof, to judge the layout from above; shapes rect, L, round, long; rooms home, sleeping, hall, tavern, kitchen, smithy, workshop, temple, storage",
            "floorplan set [n]: lay out the first n plans of the catalog (up to 24) in a grid, each with its ID sign (FP-001 on), the same IDs as the review sheet's Floorplans tab",
        };

        private static readonly string[] Usage =
        {
            "vh floorplan <shape> <width>x<depth> <room> [biome] [culture] [d1|d2|d3] [seed] [ladder]",
            "  shape: rect, L, round (octagon), long (a hall with two rows of posts)",
            "  size in meters, e.g. 10x8 (4 to 40 each way)",
            "  room: home, sleeping, hall, tavern, kitchen, smithy, workshop, temple, storage",
            "  biome: md bf sw mt pl ml al dn (default md); culture: a culture key ('vh cultures'), default by biome",
            "  decor: d1 bare, d2 lived in (default), d3 rich; seed: a number; ladder: put a ladder in the back corner",
            "vh floorplan set [n]: the first n plans of the catalog (default 12, at most 24) in a grid, IDs FP-001 on.",
            "Each plan gets an ID on a sign at its front left corner and a row in BepInEx/config/Villheim/floorplans/floorplans.csv.",
            "Examples:",
            "  vh floorplan rect 10x8 home md norse d2",
            "  vh floorplan long 24x10 hall sw fen-folk d3 7",
            "  vh floorplan set 12",
        };

        private static readonly string[] Shapes = { "rect", "l", "round", "octagon", "long", "longhall", "hall" };
        private static readonly string[] Rooms = { "home", "sleeping", "hall", "tavern", "kitchen", "smithy", "workshop", "temple", "storage" };
        private static readonly string[] BiomeCodes = { "md", "bf", "sw", "mt", "pl", "ml", "al", "dn" };
        private static readonly Regex SizePattern = new Regex(@"^(\d{1,2})x(\d{1,2})$", RegexOptions.IgnoreCase);
        private static readonly Regex DecorPattern = new Regex(@"^(s[123])?(d[123])$", RegexOptions.IgnoreCase);
        private static readonly Regex IdPattern = new Regex(@"^FP-(\d+)", RegexOptions.IgnoreCase);

        private static string Folder => Path.Combine(Paths.ConfigPath, "PlanBuild", "blueprints", "inspiration", "generated", "floorplans");
        private static string FeedbackFolder => Path.Combine(Paths.ConfigPath, "Villheim", "floorplans");
        public static string FeedbackFile => Path.Combine(FeedbackFolder, "floorplans.csv");

        private const string Header = "ID,Time,Command,Shape,Size,Room,Biome,Culture,Stage,Seed,Area m2,Pieces per 10 m2,Piece list,Density (too sparse / right / too dense),Layout notes,Keep/Change";

        private static bool _busy;

        // Filled by JsonUtility from the lab's answer.
#pragma warning disable CS0649
        [Serializable]
        private sealed class Sign
        {
            public float lx, ly, lz;
            public string text, id;
        }

        [Serializable]
        private sealed class Pad
        {
            public float x, z, r;
        }

        [Serializable]
        private sealed class Row
        {
            public string id, command, shape, size, room, biome, culture, stage, summary;
            public int seed, area;
            public float perTenM2;
        }

        [Serializable]
        private sealed class Result
        {
            public string error, name, blueprint;
            public int pieces;
            public Sign[] signs;
            public Pad[] pads;
            public Row[] rows;
        }
#pragma warning restore CS0649

        public static void Run(string[] args, Terminal context)
        {
            string[] t = (args ?? new string[0]).Where(a => !string.IsNullOrWhiteSpace(a)).Select(a => a.Trim().Trim('"')).ToArray();
            if (t.Length == 0 || t[0] == "help" || t[0] == "?")
            {
                Say(context, string.Join("\n", Usage));
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
                Say(context, "Villheim: still making the last floorplan. Wait a moment.");
                return;
            }

            string function;
            object[] call;
            string label;
            if (t[0].Equals("set", StringComparison.OrdinalIgnoreCase))
            {
                int n = 12;
                if (t.Length > 1 && !int.TryParse(t[1], out n))
                {
                    Say(context, "Usage: vh floorplan set [n]");
                    return;
                }

                n = Mathf.Clamp(n, 1, 24);
                function = "vhFloorplanSet";
                call = new object[] { n };
                label = $"floorplans FP-001 to FP-{n:000}";
            }
            else
            {
                if (!Parse(t, out object[] parsed, out string error))
                {
                    Say(context, error);
                    return;
                }

                function = "vhFloorplan";
                call = parsed;
                label = $"{parsed[8]} ({parsed[3]}, {parsed[0]} {parsed[1]}x{parsed[2]})";
            }

            Vector3 standing = player.transform.position;
            float yaw = player.transform.eulerAngles.y;
            Say(context, $"Villheim: making {label}...");
            LabEngine.Prepare(Path.GetDirectoryName(typeof(VillheimPlugin).Assembly.Location));
            _busy = true;
            var job = new Job();
            var thread = new Thread(() =>
            {
                try
                {
                    job.Json = LabEngine.Call(function, call);
                }
                catch (Exception e)
                {
                    job.Failure = e;
                }

                job.Done = true;
            }) { IsBackground = true, Name = "Villheim floorplan" };
            thread.Start();
            VillheimPlugin.Instance.StartCoroutine(Finish(job, standing, yaw, context));
        }

        private sealed class Job
        {
            public volatile bool Done;
            public string Json;
            public Exception Failure;
        }

        private static bool Parse(string[] t, out object[] call, out string error)
        {
            call = null;
            error = null;
            if (t.Length < 3)
            {
                error = "Usage: vh floorplan <shape> <width>x<depth> <room> [biome] [culture] [d1|d2|d3] [seed] [ladder]. 'vh floorplan help' for more.";
                return false;
            }

            string shape = t[0].ToLowerInvariant();
            if (!Shapes.Contains(shape))
            {
                error = $"Villheim: unknown shape '{t[0]}'. Shapes: rect, L, round, long.";
                return false;
            }

            shape = shape == "l" ? "L" : shape == "round" ? "octagon" : shape == "longhall" || shape == "hall" ? "long" : shape;
            Match size = SizePattern.Match(t[1]);
            if (!size.Success)
            {
                error = $"Villheim: '{t[1]}' is not a size; write width x depth in meters, e.g. 10x8.";
                return false;
            }

            int w = Mathf.Clamp(int.Parse(size.Groups[1].Value), 4, 40), d = Mathf.Clamp(int.Parse(size.Groups[2].Value), 4, 40);
            string room = t[2].ToLowerInvariant();
            if (!Rooms.Contains(room))
            {
                error = $"Villheim: unknown room '{t[2]}'. Rooms: {string.Join(", ", Rooms)}.";
                return false;
            }

            string biome = "md", culture = "", decor = "d2";
            int seed = 0;
            bool ladder = false;
            foreach (string raw in t.Skip(3))
            {
                string a = raw.ToLowerInvariant();
                Match dm = DecorPattern.Match(a);
                if (BiomeCodes.Contains(a)) biome = a;
                else if (dm.Success) decor = dm.Groups[2].Value;
                else if (a == "ladder") ladder = true;
                else if (int.TryParse(a, out int s)) seed = s;
                else culture = a;
            }

            if (seed == 0)
            {
                seed = UnityEngine.Random.Range(1, 100000);
            }

            string id = $"FP-{NextId():000}";
            call = new object[] { shape, w, d, room, biome, culture, decor, seed, id, ladder };
            return true;
        }

        /// <summary>Single plans number from FP-101 on, so they never meet the catalog's FP-001 to FP-024.</summary>
        private static int NextId()
        {
            int max = 100;
            if (File.Exists(FeedbackFile))
            {
                foreach (string line in File.ReadAllLines(FeedbackFile))
                {
                    Match m = IdPattern.Match(line);
                    if (m.Success && int.TryParse(m.Groups[1].Value, out int n))
                    {
                        max = Math.Max(max, n);
                    }
                }
            }

            return max + 1;
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
                VillheimPlugin.Log.LogError($"vh floorplan failed: {job.Failure}");
                Say(context, $"Villheim: the floorplan failed: {root.GetType().Name}: {root.Message}");
                yield break;
            }

            Result r = JsonUtility.FromJson<Result>(job.Json ?? "{}");
            if (r == null || !string.IsNullOrEmpty(r.error) || string.IsNullOrEmpty(r.blueprint))
            {
                Say(context, "Villheim: the floorplan failed: " + (r?.error ?? "no result"));
                yield break;
            }

            Directory.CreateDirectory(Folder);
            string file = Path.Combine(Folder, r.name + ".blueprint");
            File.WriteAllText(file, r.blueprint, new UTF8Encoding(false));
            int built = Build(file, r, standing, yaw, out string problem);
            WriteRows(r.rows);
            Say(context, $"Villheim: {r.rows.Length} floorplan{(r.rows.Length == 1 ? "" : "s")} in {Time.realtimeSinceStartup - started:0.0} s, {built} of {r.pieces} pieces built.");
            foreach (Row row in r.rows)
            {
                Say(context, $"   {row.id}: {row.room} {row.size} {row.shape}, {row.biome}, {row.culture}, {row.stage}, seed {row.seed}: {row.perTenM2.ToString("0.0", CultureInfo.InvariantCulture)} pieces per 10 m2");
            }

            if (problem != null)
            {
                Say(context, problem);
            }

            Say(context, $"   rows written to {FeedbackFile}; feedback goes in the review sheet's Floorplans tab under the same IDs.");
        }

        /// <summary>Builds the plans in front of the player, the ground levelled under each, and writes each ID on its sign.</summary>
        private static int Build(string file, Result r, Vector3 standing, float yaw, out string problem)
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
                foreach (Pad pad in r.pads ?? new Pad[0])
                {
                    TerrainShaper.LevelPad(at + turn * new Vector3(pad.x, 0f, pad.z), pad.r, pad.r + 3f);
                }
            }

            int count = 0;
            foreach (DesignSpawner.PlanEntry entry in Blueprints.MakePlan(blueprint, at, yaw))
            {
                GameObject made = DesignSpawner.SpawnEntry(entry, at, turn, 0, false);
                if (made == null)
                {
                    continue;
                }

                count++;
                if (entry.Prefab != "sign" || r.signs == null)
                {
                    continue;
                }

                foreach (Sign s in r.signs)
                {
                    if (Mathf.Abs(entry.LocalPosition.x - s.lx) < 0.15f && Mathf.Abs(entry.LocalPosition.z - s.lz) < 0.15f && made.TryGetComponent(out global::Sign sign))
                    {
                        ZNetView view = sign.GetComponent<ZNetView>();
                        if (view != null && view.IsValid())
                        {
                            view.ClaimOwnership();
                            view.GetZDO().Set(ZDOVars.s_text, s.text);
                            sign.UpdateText();
                        }
                    }
                }
            }

            return count;
        }

        /// <summary>One row per plan; a catalog plan already in the file is written once only.</summary>
        private static void WriteRows(Row[] rows)
        {
            Directory.CreateDirectory(FeedbackFolder);
            var have = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (File.Exists(FeedbackFile))
            {
                foreach (string line in File.ReadAllLines(FeedbackFile))
                {
                    Match m = IdPattern.Match(line);
                    if (m.Success)
                    {
                        have.Add(m.Value);
                    }
                }
            }
            else
            {
                File.WriteAllText(FeedbackFile, Header + "\n", new UTF8Encoding(false));
            }

            var sb = new StringBuilder();
            string time = DateTime.Now.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture);
            foreach (Row row in rows ?? new Row[0])
            {
                if (have.Contains(row.id))
                {
                    continue;
                }

                sb.AppendLine(string.Join(",", new[]
                {
                    row.id, time, row.command, row.shape, row.size, row.room, row.biome, row.culture, row.stage,
                    row.seed.ToString(CultureInfo.InvariantCulture), row.area.ToString(CultureInfo.InvariantCulture),
                    row.perTenM2.ToString("0.00", CultureInfo.InvariantCulture), row.summary, "", "", "",
                }.Select(Csv)));
            }

            File.AppendAllText(FeedbackFile, sb.ToString(), new UTF8Encoding(false));
        }

        private static string Csv(string value)
        {
            value = value ?? "";
            return value.IndexOfAny(new[] { ',', '"', '\n' }) >= 0 ? "\"" + value.Replace("\"", "\"\"") + "\"" : value;
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
