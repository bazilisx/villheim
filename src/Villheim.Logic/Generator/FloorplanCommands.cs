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
    /// 'vh floorplan set 12' lays out the first 12 plans of the lab's catalog in a grid (FP-001 to FP-012), four to a
    /// row, the first row a few meters in front of the player. Each plan stands on the ground under it, levelled and
    /// bare first. Floorplan pieces carry the plan's ID in their ZDO and never wear or fall, since a floor with no
    /// walls has nothing holding it up; 'vh tidy' removes them like any piece a command built.
    /// </summary>
    internal static class FloorplanCommands
    {
        public static readonly string[] Help =
        {
            "floorplan <shape> <width>x<depth> <room> [biome] [culture] [d1|d2|d3] [seed] [ladder]: one furnished room with no walls or roof, to judge the layout from above; shapes rect, L, round, long; rooms home, sleeping, hall, tavern, kitchen, smithy, workshop, temple, storage",
            "floorplan set [n]: lay out the first n plans of the catalog (up to 24) in a grid, each with its ID sign (FP-001 on), the same IDs as the review sheet's Floorplans tab",
            "floorplan where: the ID of the floorplan you are standing in or nearest to",
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
            "vh floorplan where: the ID of the plan you are standing in or nearest to.",
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

        /// <summary>Marks every piece of a floorplan: it never wears or falls (see HoldPatch).</summary>
        internal static readonly int KeyFloorplan = "villheim_floorplan".GetStableHashCode();

        /// <summary>The plan's ID (FP-001) on every piece of it, for 'vh floorplan where'.</summary>
        internal static readonly int KeyFloorplanId = "villheim_floorplan_id".GetStableHashCode();

        /// <summary>Space between the player and the front of the first row.</summary>
        private const float Ahead = 3f;

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
            public string id;
            public float x, z, r, x0, x1, z0, z1;
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
            public float floorY;
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

            if (t[0].Equals("where", StringComparison.OrdinalIgnoreCase))
            {
                Say(context, Where(player));
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
            var build = new BuildResult();
            yield return Build(file, r, standing, yaw, build);
            WriteRows(r.rows);
            Say(context, $"Villheim: {r.rows.Length} floorplan{(r.rows.Length == 1 ? "" : "s")} in {Time.realtimeSinceStartup - started:0.0} s, {build.Built} of {r.pieces} pieces built.");
            foreach (Row row in r.rows)
            {
                string place = build.Middles.TryGetValue(row.id, out Vector3 middle) ? Direction(standing, yaw, middle) : "not placed";
                Say(context, $"   {row.id}: {row.room} {row.shape} {row.size}, {place}. {row.biome}, {row.culture}, {row.stage}, seed {row.seed}, {row.perTenM2.ToString("0.0", CultureInfo.InvariantCulture)} pieces per 10 m2");
            }

            if (build.Problem != null)
            {
                Say(context, build.Problem);
            }

            Say(context, "   'vh floorplan where' names the plan you stand in. 'vh tidy 70 yes' takes them all away.");

            Say(context, $"   rows written to {FeedbackFile}; feedback goes in the review sheet's Floorplans tab under the same IDs.");
        }

        private sealed class BuildResult
        {
            public int Built;
            public string Problem;
            public readonly Dictionary<string, Vector3> Middles = new Dictionary<string, Vector3>();
        }

        /// <summary>
        /// Builds the plans in front of the player. Each plan's box is cleared, levelled at the ground height under
        /// it and painted bare first; then its pieces go up on that ground, every one marked as a floorplan piece
        /// with its ID, and its signs get the ID and the room, shape and size.
        /// </summary>
        private static IEnumerator Build(string file, Result r, Vector3 standing, float yaw, BuildResult result)
        {
            Blueprints.Blueprint blueprint = Blueprints.FromFile(file);
            if (blueprint == null || blueprint.Pieces.Count == 0)
            {
                result.Problem = $"   could not read {file}.";
                yield break;
            }

            Pad[] pads = (r.pads ?? new Pad[0]).Where(p => !string.IsNullOrEmpty(p.id)).ToArray();
            Quaternion turn = Quaternion.Euler(0f, yaw, 0f);
            float front = pads.Length > 0 ? pads.Min(p => p.z0) : -blueprint.Radius;
            Vector3 at = standing + turn * new Vector3(0f, 0f, Ahead - front);
            at.y = standing.y;

            // The height of each plan: the ground under its box (middle and corners), averaged.
            var heights = new Dictionary<string, float>();
            foreach (Pad pad in pads)
            {
                Vector3 middle = at + turn * new Vector3(pad.x, 0f, pad.z);
                float sum = 0f;
                int n = 0;
                foreach (Vector3 local in new[]
                         {
                             new Vector3(pad.x, 0f, pad.z), new Vector3(pad.x0, 0f, pad.z0), new Vector3(pad.x1, 0f, pad.z0),
                             new Vector3(pad.x0, 0f, pad.z1), new Vector3(pad.x1, 0f, pad.z1),
                         })
                {
                    if (ZoneSystem.instance != null && ZoneSystem.instance.GetGroundHeight(at + turn * local, out float h))
                    {
                        sum += h;
                        n++;
                    }
                }

                float ground = n > 0 ? sum / n : standing.y;
                heights[pad.id] = ground;
                middle.y = ground;
                result.Middles[pad.id] = middle;

                float halfX = (pad.x1 - pad.x0) / 2f, halfZ = (pad.z1 - pad.z0) / 2f;
                Vector3 boxMiddle = at + turn * new Vector3((pad.x0 + pad.x1) / 2f, 0f, (pad.z0 + pad.z1) / 2f);
                boxMiddle.y = ground - 0.1f;
                DesignSpawner.ClearArea(boxMiddle, Mathf.Sqrt(halfX * halfX + halfZ * halfZ));
                if (LogicConfig.GenLevelGround?.Value ?? true)
                {
                    TerrainShaper.LevelBox(boxMiddle, yaw, halfX, halfZ, 0.75f);
                    TerrainShaper.PaintBox(boxMiddle, yaw, halfX, halfZ);
                }
            }

            // Give the heightmaps a moment to rebuild before anything is placed on them.
            yield return new WaitForSeconds(0.75f);

            var rows = (r.rows ?? new Row[0]).Where(w => w != null && !string.IsNullOrEmpty(w.id)).ToDictionary(w => w.id, w => w);
            int sinceYield = 0;
            foreach (DesignSpawner.PlanEntry entry in Blueprints.MakePlan(blueprint, at, yaw))
            {
                Pad pad = PadOf(pads, entry.LocalPosition);
                Vector3 origin = at;
                if (pad != null && heights.TryGetValue(pad.id, out float ground))
                {
                    origin.y = ground - r.floorY;
                }
                else if (ZoneSystem.instance != null && ZoneSystem.instance.GetGroundHeight(at + turn * entry.LocalPosition, out float here))
                {
                    origin.y = here - r.floorY;
                }

                GameObject made = DesignSpawner.SpawnEntry(entry, origin, turn, 0, false);
                if (made == null)
                {
                    continue;
                }

                result.Built++;
                ZNetView view = made.GetComponent<ZNetView>();
                if (view == null || !view.IsValid())
                {
                    continue;
                }

                ZDO zdo = view.GetZDO();
                zdo.Set(KeyFloorplan, 1);
                if (pad != null)
                {
                    zdo.Set(KeyFloorplanId, pad.id);
                }

                if (pad != null && made.TryGetComponent(out global::Sign sign))
                {
                    view.ClaimOwnership();
                    zdo.Set(ZDOVars.s_text, SignText(pad.id, rows.TryGetValue(pad.id, out Row row) ? row : null));
                    sign.UpdateText();
                }

                if (++sinceYield >= 150)
                {
                    sinceYield = 0;
                    yield return null;
                }
            }
        }

        /// <summary>The plan whose box holds a piece, by its place in the blueprint.</summary>
        private static Pad PadOf(Pad[] pads, Vector3 local)
        {
            foreach (Pad pad in pads)
            {
                if (local.x >= pad.x0 - 0.05f && local.x <= pad.x1 + 0.05f && local.z >= pad.z0 - 0.05f && local.z <= pad.z1 + 0.05f)
                {
                    return pad;
                }
            }

            return null;
        }

        private static string SignText(string id, Row row) =>
            row == null ? id : $"{id}\n{row.room} {row.shape} {row.size}";

        /// <summary>"12 m ahead-left": where a spot is from the player, by the way the player faced.</summary>
        private static string Direction(Vector3 from, float yaw, Vector3 to)
        {
            Vector3 local = Quaternion.Inverse(Quaternion.Euler(0f, yaw, 0f)) * (to - from);
            local.y = 0f;
            float distance = local.magnitude;
            if (distance < 1.5f)
            {
                return "here";
            }

            string[] names = { "ahead", "ahead-right", "right", "behind-right", "behind", "behind-left", "left", "ahead-left" };
            float angle = Mathf.Atan2(local.x, local.z) * Mathf.Rad2Deg;
            int sector = Mathf.RoundToInt(((angle + 360f) % 360f) / 45f) % 8;
            return $"{distance:0} m {names[sector]}";
        }

        /// <summary>The plan the player stands in, or the nearest one, from the IDs on the floorplan pieces nearby.</summary>
        private static string Where(Player player)
        {
            Vector3 me = player.transform.position;
            var boxes = new Dictionary<string, (float x0, float x1, float z0, float z1, string text)>();
            foreach (ZNetView view in UnityEngine.Object.FindObjectsByType<ZNetView>(FindObjectsSortMode.None))
            {
                if (view == null || !view.IsValid())
                {
                    continue;
                }

                ZDO zdo = view.GetZDO();
                string id = zdo.GetInt(KeyFloorplan) == 1 ? zdo.GetString(KeyFloorplanId, "") : "";
                if (id.Length == 0)
                {
                    continue;
                }

                Vector3 p = view.transform.position;
                string text = view.GetComponent<global::Sign>() != null ? zdo.GetString(ZDOVars.s_text, "") : null;
                if (boxes.TryGetValue(id, out var b))
                {
                    boxes[id] = (Mathf.Min(b.x0, p.x), Mathf.Max(b.x1, p.x), Mathf.Min(b.z0, p.z), Mathf.Max(b.z1, p.z), b.text ?? text);
                }
                else
                {
                    boxes[id] = (p.x, p.x, p.z, p.z, text);
                }
            }

            if (boxes.Count == 0)
            {
                return "Villheim: no floorplan nearby. 'vh floorplan set 12' lays some out.";
            }

            string best = null;
            float bestDistance = float.MaxValue;
            foreach (var kv in boxes)
            {
                var b = kv.Value;
                float distance = new Vector2(Mathf.Max(0f, b.x0 - me.x, me.x - b.x1), Mathf.Max(0f, b.z0 - me.z, me.z - b.z1)).magnitude;
                if (distance < bestDistance)
                {
                    bestDistance = distance;
                    best = kv.Key;
                }
            }

            var found = boxes[best];
            string about = string.IsNullOrEmpty(found.text) ? "" : " (" + found.text.Replace("\n", ", ") + ")";
            var middle = new Vector3((found.x0 + found.x1) / 2f, me.y, (found.z0 + found.z1) / 2f);
            return bestDistance <= 0.5f
                ? $"Villheim: you are standing in {best}{about}."
                : $"Villheim: nearest floorplan is {best}{about}, {Direction(me, player.transform.eulerAngles.y, middle)}.";
        }

        /// <summary>
        /// Floorplan pieces never wear or fall: a floor with no walls or roof has little holding it up, and the game's
        /// support check brought the plans down piece by piece. 'vh gravity on' lets them fall again, as for the gallery.
        /// </summary>
        [HarmonyLib.HarmonyPatch(typeof(WearNTear), nameof(WearNTear.UpdateWear))]
        internal static class HoldPatch
        {
            private static bool Prefix(WearNTear __instance) =>
                Villheim.Logic.Village.Gallery.Gravity || __instance.m_nview == null || !__instance.m_nview.IsValid() ||
                __instance.m_nview.GetZDO().GetInt(KeyFloorplan) != 1;
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
