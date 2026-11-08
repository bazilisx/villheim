using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using HarmonyLib;
using UnityEngine;
using Villheim.Logic.Designs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// The slotting board ('vh slot meadows hearth'): one row of plots in front of the player, one per village stage
    /// (5 by default), each bordered by green-tinted horizontal wood beams, for one base ID (hub1) in one biome. The
    /// designs sorted as that subtype are written as blueprints into PlanBuild's folder under the category
    /// "Villheim board", so the Blueprint Rune's tab shows exactly those, with pictures. Tyler places them into the
    /// plots with PlanBuild (or builds by hand), moves and removes freely, and saves a plot with the Shaper Tool (Save):
    /// everything inside the green border is written as &lt;baseID&gt;_s&lt;stage&gt;d&lt;decor&gt;; saving d3 brings up a d2 copy behind it, d2 a d1 copy. The design it came from is
    /// found by comparing pieces, and the save is recorded in board-saves.csv and in the sheet (Slots tab, and the
    /// design's Biome, Base ID and s in Pass 2). Shaper Reset on a plot puts it back as last saved (or empty).
    /// </summary>
    internal static class DesignBoard
    {
        internal const string KeyBeam = "villheim_board_beam";
        internal const string KeyBiome = "villheim_board_biome";
        internal const string KeySubtype = "villheim_board_subtype";
        internal const string KeySource = "villheim_board_source";
        private const string Prefix = "board:";
        private const string Category = "Villheim board";
        private const float Gap = 6f;
        private const float Aisle = 14f;
        private const float MaxRow = 340f;
        private static readonly Color BeamColour = new Color(0.08f, 0.28f, 0.1f);
        private static readonly int Tint = Shader.PropertyToID("_Color");
        internal const string KeyLabel = "villheim_board_label";

        internal sealed class Plot
        {
            public string Name;
            public Vector3 Center;
            public float Half;
            public float Yaw;
        }

        private sealed class Kind
        {
            public string Label;
            public string Root;
            public System.Func<DesignSort.Entry, bool> Matches;
        }

        private static Kind Sub(string subtype, string root) =>
            new Kind { Label = subtype, Root = root, Matches = e => e.Subtype == subtype };

        /// <summary>Command words for each building kind, its short root and which sorted designs are its candidates.</summary>
        private static readonly Dictionary<string, Kind> Kinds = new Dictionary<string, Kind>
        {
            ["house"] = new Kind { Label = "Home", Root = "house", Matches = e => e.Type == "Home" },
            ["home"] = new Kind { Label = "Home", Root = "house", Matches = e => e.Type == "Home" },
            ["hearth"] = Sub("Hearth", "hub"), ["hub"] = Sub("Hearth", "hub"),
            ["tavern"] = Sub("Tavern", "inn"), ["inn"] = Sub("Tavern", "inn"),
            ["longhouse"] = Sub("Longhouse", "hall"), ["hall"] = Sub("Longhouse", "hall"),
            ["decor"] = Sub("Decor", "deco"), ["deco"] = Sub("Decor", "deco"),
            ["farming"] = Sub("Farming", "farm"), ["farm"] = Sub("Farming", "farm"),
            ["woodworking"] = Sub("Woodworking", "wood"), ["wood"] = Sub("Woodworking", "wood"),
            ["mining"] = Sub("Mining", "forge"), ["forge"] = Sub("Mining", "forge"), ["smith"] = Sub("Mining", "forge"),
            ["cooking"] = Sub("Cooking", "cook"), ["cook"] = Sub("Cooking", "cook"),
            ["storage"] = Sub("Storage", "store"), ["store"] = Sub("Storage", "store"),
            ["defence"] = Sub("Defence", "guard"), ["defense"] = Sub("Defence", "guard"), ["guard"] = Sub("Defence", "guard"),
            ["workshop"] = Sub("Workshop", "craft"), ["craft"] = Sub("Workshop", "craft"),
            ["harbour"] = Sub("Harbour", "dock"), ["harbor"] = Sub("Harbour", "dock"), ["dock"] = Sub("Harbour", "dock"),
            ["hunting"] = Sub("Hunting", "hunt"), ["hunt"] = Sub("Hunting", "hunt"),
            ["arcane"] = Sub("Arcane", "rune"), ["rune"] = Sub("Arcane", "rune"),
            ["masonry"] = Sub("Masonry", "mason"), ["mason"] = Sub("Masonry", "mason"),
            ["weaving"] = Sub("Weaving", "weave"), ["weave"] = Sub("Weaving", "weave"),
        };

        private static readonly Dictionary<string, string> Biomes = new Dictionary<string, string>
        {
            ["meadows"] = "Meadows", ["blackforest"] = "Black Forest", ["bf"] = "Black Forest", ["forest"] = "Black Forest",
            ["swamp"] = "Swamp", ["mountains"] = "Mountains", ["mountain"] = "Mountains", ["plains"] = "Plains",
            ["mistlands"] = "Mistlands", ["ashlands"] = "Ashlands", ["deepnorth"] = "Deep North", ["north"] = "Deep North",
        };

        private static string CandidateFolder => Path.Combine(BepInEx.Paths.ConfigPath, "PlanBuild", "blueprints", "villheim-board");
        internal static string SaveFolder => Path.Combine(Blueprints.Folder, "inspiration", "board");
        private static string RecordPath => Path.Combine(BepInEx.Paths.BepInExRootPath, "Villheim", "board-saves.csv");

        // ---------------------------------------------------------------- plots in the world

        private static readonly List<Plot> Plots = new List<Plot>();
        private static float _nextScan;

        /// <summary>Whether a position is inside a board plot (its pieces never wear or fall while they are worked on).</summary>
        public static bool Inside(Vector3 position) => PlotAt(position) != null;

        /// <summary>The board plot holding a position, or null.</summary>
        public static string PlotAt(Vector3 position)
        {
            foreach (Plot plot in Plots)
            {
                Vector3 local = Quaternion.Inverse(Quaternion.Euler(0f, plot.Yaw, 0f)) * (position - plot.Center);
                if (Mathf.Abs(local.x) <= plot.Half + 0.5f && Mathf.Abs(local.z) <= plot.Half + 0.5f)
                {
                    return plot.Name;
                }
            }

            return null;
        }

        private static IEnumerable<ZNetView> Loaded() =>
            ZNetScene.instance == null ? Enumerable.Empty<ZNetView>() : ZNetScene.instance.m_instances.Values.Where(v => v != null && v.IsValid());

        /// <summary>Plots from the signs standing near (after a restart the board is still in the world), and beams tinted green.</summary>
        private static void Scan()
        {
            Plots.Clear();
            foreach (ZNetView view in Loaded())
            {
                ZDO zdo = view.GetZDO();
                string name = zdo.GetString(Gallery.KeyDesign, "");
                if (name.StartsWith(Prefix) && zdo.GetFloat(Gallery.KeyPlotHalf, 0f) > 0f)
                {
                    Plots.Add(new Plot
                    {
                        Name = name,
                        Center = zdo.GetVec3(Gallery.KeyPlotCenter, Vector3.zero),
                        Half = zdo.GetFloat(Gallery.KeyPlotHalf, 0f),
                        Yaw = zdo.GetFloat(Gallery.KeyPlotYaw, 0f),
                    });
                }
                else if (zdo.GetInt(KeyBeam) == 1 && !Tinted.Contains(view.GetInstanceID()))
                {
                    Tinted.Add(view.GetInstanceID());
                    MaterialMan.instance?.SetValue(view.gameObject, Tint, BeamColour);
                }
            }
        }

        private static readonly HashSet<int> Tinted = new HashSet<int>();

        [HarmonyPatch(typeof(Player), "Update")]
        internal static class UpdatePatch
        {
            private static void Postfix(Player __instance)
            {
                if (__instance != Player.m_localPlayer || Time.time < _nextScan)
                {
                    return;
                }

                _nextScan = Time.time + 2f;
                try
                {
                    Scan();
                }
                catch (System.Exception e)
                {
                    VillheimPlugin.Log.LogWarning($"Board: {e.Message}");
                }
            }
        }

        // ---------------------------------------------------------------- 'vh slot'

        private static bool _busy;

        public static string Run(string[] args)
        {
            Player player = Player.m_localPlayer;
            if (player == null)
            {
                return "Board: you need to be in a world.";
            }

            if (_busy)
            {
                return "Board: still putting the last board up; give it a moment.";
            }

            List<string> words = args.Select(a => a.ToLowerInvariant()).ToList();
            bool force = words.Remove("force");
            string first = words.Count > 0 ? words[0] : "";
            if (first == "clear")
            {
                string unsaved = Unsaved();
                if (unsaved != null && !force)
                {
                    return $"Board: {unsaved} Save them, or 'vh slot clear force' to drop the changes.";
                }

                return $"Board: taken down ({TakeDown()} objects).";
            }

            if (first == "here")
            {
                Vector3 facing = player.transform.forward;
                facing.y = 0f;
                SaveAnchor(player.transform.position, facing.normalized);
                Vector3 p = player.transform.position;
                return $"Board: boards now go up in front of {p.x:0}, {p.z:0} (height {p.y:0}), facing the way you face, every time. " +
                       "'vh slot here' again moves it; 'vh slot here off' goes back to in front of you.";
            }

            if (first == "anchor" && words.Count >= 3 &&
                float.TryParse(words[1], NumberStyles.Float, CultureInfo.InvariantCulture, out float ax) &&
                float.TryParse(words[2], NumberStyles.Float, CultureInfo.InvariantCulture, out float az))
            {
                Vector3 facing = player.transform.forward;
                facing.y = 0f;
                float ay = ZoneSystem.instance != null ? ZoneSystem.instance.GetGroundHeight(new Vector3(ax, 0f, az)) : player.transform.position.y;
                SaveAnchor(new Vector3(ax, ay, az), facing.normalized);
                return $"Board: boards now go up in front of {ax:0}, {az:0}, facing the way you face now.";
            }

            if (first == "forget" && args.Length > 1)
            {
                return Forget(args[1]);
            }

            if (first == "save" && words.Count > 1 && words[1] == "all")
            {
                return SaveAll();
            }

            if (first == "save" && words.Count > 1)
            {
                string plot = Plots.Select(p => p.Name).FirstOrDefault(n => n.Contains(":s" + words[1].TrimStart('s') + ":"));
                return plot != null ? Save(plot) : $"Board: no plot for stage {words[1]} is standing near.";
            }

            if (first.Length == 0 || !Biomes.ContainsKey(first) || words.Count < 2 || !Kinds.ContainsKey(words[1]))
            {
                return Usage();
            }

            string biome = Biomes[first];
            Kind kind = Kinds[words[1]];
            int number = 0;
            int stages = 5;
            bool review = words.Remove("review");
            float size = 0f;
            for (int i = 2; i < words.Count; i++)
            {
                if (words[i] == "stages" && i + 1 < words.Count && int.TryParse(words[i + 1], out int s))
                {
                    stages = Mathf.Clamp(s, 1, 10);
                    i++;
                }
                else if (words[i] == "size" && i + 1 < words.Count && float.TryParse(words[i + 1], NumberStyles.Float, CultureInfo.InvariantCulture, out float m))
                {
                    size = Mathf.Clamp(m, 10f, 120f);
                    i++;
                }
                else if (int.TryParse(words[i].TrimStart(kind.Root.ToCharArray()), out int n) && n > 0)
                {
                    number = n;
                }
            }

            Dictionary<string, string[]> saved = Records();
            if (number == 0)
            {
                number = NextNumber(kind.Root);
            }
            else
            {
                string other = saved.Values.Where(r => r[1] == kind.Root + number).Select(r => r[4]).FirstOrDefault(b => b != biome);
                if (other != null)
                {
                    return $"Board: {kind.Root}{number} belongs to {other}. Each base ID is one building in one biome; leave the number off for a new one.";
                }
            }

            string unsavedNow = Unsaved();
            if (unsavedNow != null && !force)
            {
                return $"Board: {unsavedNow} Save them first, or add 'force' to drop the changes.";
            }

            Vector3 forward = player.transform.forward;
            forward.y = 0f;
            forward.Normalize();
            _busy = true;
            VillheimPlugin.Instance.StartCoroutine(Build(player.transform.position, forward, biome, kind, kind.Root + number, stages, size, review));
            return $"Board: putting up {kind.Root}{number} ({biome} {kind.Label}, {stages} stages) and the {kind.Label} designs for PlanBuild's \"{Category}\" tab.";
        }

        private static string AnchorPath => Path.Combine(BepInEx.Paths.BepInExRootPath, "Villheim", "slot-anchor.txt");

        private static void SaveAnchor(Vector3 at, Vector3 forward)
        {
            CultureInfo inv = CultureInfo.InvariantCulture;
            Directory.CreateDirectory(Path.GetDirectoryName(AnchorPath));
            File.WriteAllText(AnchorPath, string.Join(" ", new[] { at.x, at.y, at.z, forward.x, forward.z }.Select(v => v.ToString("R", inv))));
        }

        /// <summary>The spot boards go up in front of ('vh slot here'), if one is set.</summary>
        internal static bool LoadAnchor(out Vector3 at, out Vector3 forward)
        {
            at = Vector3.zero;
            forward = Vector3.forward;
            try
            {
                if (!File.Exists(AnchorPath))
                {
                    return false;
                }

                float[] v = File.ReadAllText(AnchorPath).Split(' ').Select(t => float.Parse(t, CultureInfo.InvariantCulture)).ToArray();
                at = new Vector3(v[0], v[1], v[2]);
                forward = new Vector3(v[3], 0f, v[4]).normalized;
                return forward.sqrMagnitude > 0.5f;
            }
            catch (System.Exception)
            {
                return false;
            }
        }

        private static string Usage() =>
            "Board: 'vh slot <biome> <kind> [number] [stages N]', e.g. 'vh slot meadows hearth' (a new hub) or 'vh slot meadows hearth 1' " +
            "(hub1 again: each stage at the decor stage it is at; add 'review' to see every save).\nBiomes: meadows, blackforest, swamp, mountains, plains, mistlands, ashlands, deepnorth.\n" +
            "'vh slot here' (stand where the board should start, facing along it) makes every board go up there; 'vh slot anchor <x> <z>' does the same from coordinates.\n" +
            "Kinds: house, hearth, tavern, longhouse, decor, farm, wood, forge, cook, store, guard, craft, dock, hunt, rune, mason, weave.\n" +
            "'vh slot save <stage>' or 'vh slot save all' (or the Shaper Tool's Save on a plot; Shift on the second click saves all), 'vh slot forget hub1_s1d3' deletes a save, 'vh slot clear'. Saves go to blueprints/inspiration/board.";

        /// <summary>Plots whose pieces changed since their last save, as a sentence, or null.</summary>
        private static string Unsaved()
        {
            Scan();
            var changed = new List<string>();
            foreach (Plot plot in Plots)
            {
                (ZDO sign, List<ZNetView> views) = SwapTool.DesignParts(plot.Name);
                if (sign != null && views.Count > 0 && views.Count != sign.GetInt(Gallery.KeyPlaced, 0))
                {
                    changed.Add(StageName(plot.Name));
                }
            }

            return changed.Count == 0 ? null : $"{changed.Count} plots have unsaved changes ({string.Join(", ", changed)}).";
        }

        /// <summary>A plot name, board:hub1:s2:d3, as base ID, stage and decor stage (plots of older builds have no d: d3).</summary>
        private static (string Base, int S, int D) Parse(string plot)
        {
            string[] parts = plot.Substring(Prefix.Length).Split(':');
            int.TryParse(parts.Length > 1 ? parts[1].TrimStart('s') : "1", out int stage);
            int decor = 3;
            if (parts.Length > 2)
            {
                int.TryParse(parts[2].TrimStart('d'), out decor);
            }

            return (parts[0], stage, decor);
        }

        private static string StageName(string plot)
        {
            (string baseId, int stage, int decor) = Parse(plot);
            return $"{baseId}_s{stage}d{decor}";
        }

        private static string PlotName(string baseId, int stage, int decor) => $"{Prefix}{baseId}:s{stage}:d{decor}";

        private static string SavedFile(string baseId, int stage, int decor) => Path.Combine(SaveFolder, $"{baseId}_s{stage}d{decor}.blueprint");

        private static int NextNumber(string root)
        {
            int highest = 0;
            if (Directory.Exists(SaveFolder))
            {
                foreach (string file in Directory.GetFiles(SaveFolder, root + "*_s*.blueprint"))
                {
                    string stem = Path.GetFileNameWithoutExtension(file);
                    int cut = stem.IndexOf("_s", System.StringComparison.Ordinal);
                    if (cut > root.Length && int.TryParse(stem.Substring(root.Length, cut - root.Length), out int n))
                    {
                        highest = Mathf.Max(highest, n);
                    }
                }
            }

            return highest + 1;
        }

        /// <summary>Takes the board down: beams, signs and everything inside its plots. Returns how many objects went.</summary>
        internal static int TakeDown()
        {
            Scan();
            int gone = 0;
            var doomed = new List<ZNetView>();
            foreach (Plot plot in Plots)
            {
                doomed.AddRange(SwapTool.DesignParts(plot.Name).Views);
            }

            doomed.AddRange(Loaded().Where(v =>
            {
                ZDO z = v.GetZDO();
                return z.GetInt(KeyBeam) == 1 || z.GetString(KeyLabel, "").Length > 0 || z.GetString(Gallery.KeyDesign, "").StartsWith(Prefix);
            }));
            foreach (ZNetView view in doomed.Distinct())
            {
                if (view != null && view.IsValid())
                {
                    view.ClaimOwnership();
                    ZNetScene.instance.Destroy(view.gameObject);
                    gone++;
                }
            }

            try
            {
                List<ZDO> far = Gallery.UnloadedZdos(z => z.GetInt(KeyBeam) == 1 || z.GetString(KeyLabel, "").Length > 0 || z.GetString(Gallery.KeyDesign, "").StartsWith(Prefix));
                Gallery.DestroyZdos(far);
                gone += far.Count;
            }
            catch (System.Exception e)
            {
                VillheimPlugin.Log.LogWarning($"Board: parts beyond the loaded area were left: {e.Message}");
            }

            Plots.Clear();
            Tinted.Clear();
            return gone;
        }

        // ---------------------------------------------------------------- candidates

        private sealed class Candidate
        {
            public string Design;
            public int Number;
            public string File;
            public float Half;
            public Dictionary<string, int> Counts = new Dictionary<string, int>();
        }

        private static readonly List<Candidate> Candidates = new List<Candidate>();
        private static string _candidatesFor;

        /// <summary>A design's pieces in its own coordinates: its pass 3 save if it has one, else as its creator built it.</summary>
        private static List<Blueprints.Piece> PiecesOf(string design)
        {
            string saved = Gallery.PassThreeFile(design);
            Blueprints.Blueprint blueprint = saved != null ? Blueprints.FromFile(saved) : null;
            DesignLibrary.Design? found = DesignLibrary.ByName(design) ?? DesignLibrary.ByName(Blueprints.Prefix + design);
            if ((blueprint == null || blueprint.Pieces.Count == 0) && found?.Blueprint != null)
            {
                blueprint = found.Value.Blueprint;
            }

            if (blueprint != null && blueprint.Pieces.Count > 0)
            {
                return blueprint.Pieces.ToList();
            }

            if (found == null)
            {
                return new List<Blueprints.Piece>();
            }

            ZoneSystem.ZoneLocation location = found.Value.Location;
            AssetGuard.Load(location);
            try
            {
                GameObject asset = location.m_prefab.Asset;
                if (asset == null)
                {
                    return new List<Blueprints.Piece>();
                }

                return DesignSpawner.MakePlan(asset, Vector3.zero, design.GetStableHashCode(), 0f, false)
                    .Select(e => new Blueprints.Piece { Prefab = e.Prefab, Position = e.LocalPosition, Rotation = e.LocalRotation, Scale = e.Scale })
                    .ToList();
            }
            finally
            {
                location.m_prefab.Release();
            }
        }

        private static string FileStem(string name)
        {
            string stem = name.StartsWith(Blueprints.Prefix) ? name.Substring(Blueprints.Prefix.Length) : name;
            foreach (char c in Path.GetInvalidFileNameChars())
            {
                stem = stem.Replace(c, '-');
            }

            return stem;
        }

        /// <summary>Writes every candidate as a blueprint in PlanBuild's folder, centred, standing on y = 0.</summary>
        private static IEnumerator WriteCandidates(Kind kind, string biome)
        {
            Candidates.Clear();
            Directory.CreateDirectory(CandidateFolder);
            Dictionary<string, int> numbers = Gallery.ReadNumbers();
            foreach (string design in Keepers.Names)
            {
                DesignSort.Entry entry = DesignSort.Get(design);
                if (entry == null || entry.Type == "Drop" || !kind.Matches(entry))
                {
                    continue;
                }

                List<Blueprints.Piece> pieces = null;
                try
                {
                    pieces = PiecesOf(design);
                }
                catch (System.Exception e)
                {
                    VillheimPlugin.Log.LogWarning($"Board: could not read {design}: {e.Message}");
                }

                if (pieces == null || pieces.Count == 0)
                {
                    continue;
                }

                float minX = pieces.Min(p => p.Position.x), maxX = pieces.Max(p => p.Position.x);
                float minZ = pieces.Min(p => p.Position.z), maxZ = pieces.Max(p => p.Position.z);
                // y = 0 is where the ground goes: the middle of the lowest shell pieces' bottoms, as the gallery and the
                // villages set a design down. PlanBuild puts y = 0 on the ground it is aimed at, so nothing floats (with the
                // lowest piece at 0, designs made to sink posts into the ground stood a metre up).
                float floor;
                try
                {
                    floor = ConstructionSite.FloorOf(pieces.Select(p => DesignSpawner.Entry(p.Prefab, p.Position, p.Rotation, p.Scale)).Where(e => e != null).ToList());
                }
                catch (System.Exception)
                {
                    floor = pieces.Min(p => p.Position.y);
                }

                var middle = new Vector3((minX + maxX) / 2f, floor, (minZ + maxZ) / 2f);
                int number = entry.Number > 0 ? entry.Number : numbers.TryGetValue(design, out int n) ? n : 0;
                var candidate = new Candidate
                {
                    Design = design,
                    Number = number,
                    Half = Mathf.Max(maxX - minX, maxZ - minZ) / 2f + 2f,
                    File = Path.Combine(CandidateFolder, $"vhb-{number:0000}-{FileStem(design)}.blueprint"),
                };
                var lines = new List<string>
                {
                    $"#Name:No. {number} {FileStem(design)}",
                    "#Creator:Villheim board",
                    $"#Description:{entry.Type}{(entry.Subtype.Length > 0 ? ", " + entry.Subtype : "")}; {pieces.Count} pieces; candidate for {biome} {kind.Label}",
                    "#Category:" + Category,
                    "#Pieces",
                };
                foreach (Blueprints.Piece piece in pieces)
                {
                    lines.Add(Line(piece.Prefab, piece.Position - middle, piece.Rotation, piece.Scale));
                    candidate.Counts[piece.Prefab] = candidate.Counts.TryGetValue(piece.Prefab, out int c) ? c + 1 : 1;
                }

                // A file that has not changed keeps its picture, so PlanBuild only makes pictures for new designs.
                string text = string.Join("\n", lines);
                if (!File.Exists(candidate.File) || File.ReadAllText(candidate.File).Replace("\r", "").TrimEnd() != text)
                {
                    File.WriteAllText(candidate.File, text + "\n");
                    string picture = Path.ChangeExtension(candidate.File, ".png");
                    if (File.Exists(picture))
                    {
                        File.Delete(picture);
                    }
                }

                Candidates.Add(candidate);
                yield return null;
            }

            // Designs of other kinds stay on disk with their pictures for the next board of that kind; PlanBuild only
            // shows this board's (see LoadIntoPlanBuild).

            _candidatesFor = kind.Label;
        }

        /// <summary>After a restart: the candidates' piece counts from the files left in PlanBuild's folder.</summary>
        private static void ReadCandidates()
        {
            if (Candidates.Count > 0 || !Directory.Exists(CandidateFolder))
            {
                return;
            }

            foreach (string file in Directory.GetFiles(CandidateFolder, "vhb-*.blueprint"))
            {
                string stem = Path.GetFileNameWithoutExtension(file);
                var candidate = new Candidate { File = file, Design = stem.Length > 9 ? stem.Substring(9) : stem };
                int.TryParse(stem.Substring(4, Mathf.Min(4, stem.Length - 4)), out candidate.Number);
                bool pieces = false;
                foreach (string line in File.ReadAllLines(file))
                {
                    if (line.StartsWith("#Pieces"))
                    {
                        pieces = true;
                    }
                    else if (pieces && line.Length > 0)
                    {
                        string prefab = line.Split(';')[0];
                        candidate.Counts[prefab] = candidate.Counts.TryGetValue(prefab, out int c) ? c + 1 : 1;
                    }
                }

                Candidates.Add(candidate);
            }
        }

        private static string Line(string prefab, Vector3 position, Quaternion rotation, Vector3 scale)
        {
            CultureInfo inv = CultureInfo.InvariantCulture;
            if (scale == Vector3.zero)
            {
                scale = Vector3.one;
            }

            return string.Join(";", prefab, "Villheim",
                position.x.ToString("0.####", inv), position.y.ToString("0.####", inv), position.z.ToString("0.####", inv),
                rotation.x.ToString("0.######", inv), rotation.y.ToString("0.######", inv), rotation.z.ToString("0.######", inv),
                rotation.w.ToString("0.######", inv), "\"\"",
                scale.x.ToString("0.###", inv), scale.y.ToString("0.###", inv), scale.z.ToString("0.###", inv));
        }

        // ---------------------------------------------------------------- PlanBuild

        /// <summary>
        /// Swaps the "Villheim board" blueprints PlanBuild knows for the new candidates and makes their pictures, through
        /// PlanBuild's own methods (found by name; Villheim does not depend on PlanBuild, so without it the board still
        /// goes up and the candidate files are simply there).
        /// </summary>
        private static IEnumerator LoadIntoPlanBuild(System.Action<string> done)
        {
            System.Type manager = AccessTools.TypeByName("PlanBuild.Blueprints.BlueprintManager");
            System.Type blueprintType = AccessTools.TypeByName("PlanBuild.Blueprints.Blueprint");
            System.Type gui = AccessTools.TypeByName("PlanBuild.Blueprints.BlueprintGUI");
            System.Type location = AccessTools.TypeByName("PlanBuild.Blueprints.BlueprintLocation");
            var dictionary = manager != null ? AccessTools.Field(manager, "LocalBlueprints")?.GetValue(null) as IDictionary : null;
            if (dictionary == null || blueprintType == null)
            {
                done("PlanBuild was not found, so there is no picture tab; the candidates are in " + CandidateFolder + ".");
                yield break;
            }

            var fromFile = AccessTools.Method(blueprintType, "FromFile", new[] { typeof(string) });
            var createPiece = AccessTools.Method(blueprintType, "CreatePiece");
            var createThumbnail = AccessTools.Method(blueprintType, "CreateThumbnail");
            // Forget the last board's blueprints (category "Villheim board"). Their files were already replaced, so the file
            // names are blanked first: PlanBuild's removal also deletes files, and would take the new ones.
            var destroy = AccessTools.Method(blueprintType, "DestroyBlueprint");
            void Drop(object key)
            {
                object old = dictionary[key];
                Traverse.Create(old).Field("FileLocation").SetValue("");
                Traverse.Create(old).Field("ThumbnailLocation").SetValue("");
                try
                {
                    destroy?.Invoke(old, null);
                }
                catch (System.Exception e)
                {
                    VillheimPlugin.Log.LogWarning($"Board: PlanBuild could not drop {key}: {e.InnerException?.Message ?? e.Message}");
                }

                dictionary.Remove(key);
            }

            foreach (object key in dictionary.Keys.Cast<object>().ToList())
            {
                if (Traverse.Create(dictionary[key]).Field("Category").GetValue<string>() == Category)
                {
                    Drop(key);
                }
            }

            int loaded = 0, pictures = 0;
            foreach (Candidate candidate in Candidates)
            {
                object blueprint = null;
                try
                {
                    blueprint = fromFile.Invoke(null, new object[] { candidate.File });
                    string id = Traverse.Create(blueprint).Field("ID").GetValue<string>();
                    if (dictionary.Contains(id))
                    {
                        Drop(id);
                    }

                    dictionary.Add(id, blueprint);
                    createPiece?.Invoke(blueprint, null);
                    // Known already, so the game does not announce each one as a new piece.
                    Piece piece = Traverse.Create(blueprint).Field("Prefab").GetValue<GameObject>()?.GetComponent<Piece>();
                    if (piece != null && Player.m_localPlayer != null)
                    {
                        Player.m_localPlayer.m_knownRecipes.Add(piece.m_name);
                    }

                    loaded++;
                }
                catch (System.Exception e)
                {
                    VillheimPlugin.Log.LogWarning($"Board: PlanBuild could not load {candidate.File}: {e.InnerException?.Message ?? e.Message}");
                }

                yield return null;
                if (blueprint == null || createThumbnail == null || File.Exists(Path.ChangeExtension(candidate.File, ".png")))
                {
                    continue;
                }

                try
                {
                    object[] parameters = createThumbnail.GetParameters().Select(p => p.HasDefaultValue ? p.DefaultValue : null).ToArray();
                    if (createThumbnail.Invoke(blueprint, parameters) is bool made && made)
                    {
                        pictures++;
                    }
                }
                catch (System.Exception e)
                {
                    VillheimPlugin.Log.LogWarning($"Board: no picture for {candidate.File}: {e.InnerException?.Message ?? e.Message}");
                }

                yield return null;
            }

            try
            {
                AccessTools.Method(manager, "RegisterKnownBlueprints")?.Invoke(null, null);
                if (gui != null && location != null)
                {
                    AccessTools.Method(gui, "RefreshBlueprints")?.Invoke(null, new[] { System.Enum.ToObject(location, 0) });
                }
            }
            catch (System.Exception e)
            {
                VillheimPlugin.Log.LogWarning($"Board: PlanBuild refresh: {e.InnerException?.Message ?? e.Message}");
            }

            done($"PlanBuild's \"{Category}\" tab has {loaded} designs ({pictures} pictures made).");
        }

        // ---------------------------------------------------------------- putting the board up

        private static IEnumerator Build(Vector3 playerPosition, Vector3 forward, string biome, Kind kind, string baseId, int stages, float size, bool review)
        {
            try
            {
                TakeDown();
                yield return WriteCandidates(kind, biome);
                if (Candidates.Count == 0)
                {
                    Say($"Board: no designs are sorted as {kind.Label}.");
                    yield break;
                }

                // Plots fit four in five of the candidates (the few biggest would make every plot huge); 'size N' sets the
                // width in metres. Designs bigger than the plot are named in the console.
                List<float> halves = Candidates.Select(c => c.Half).OrderBy(h => h).ToList();
                float half = size > 0f ? size / 2f : Mathf.Clamp(halves[Mathf.Min(halves.Count - 1, Mathf.FloorToInt(halves.Count * 0.8f))], 8f, 30f);
                List<Candidate> bigger = Candidates.Where(c => c.Half > half).OrderByDescending(c => c.Half).ToList();
                // In front of the spot set with 'vh slot here' (the same place every time), else in front of the player.
                Vector3 start = playerPosition + forward * 8f;
                if (LoadAnchor(out Vector3 anchor, out Vector3 anchorForward))
                {
                    start = anchor + anchorForward * 8f;
                    forward = anchorForward;
                }

                Vector3 right = Vector3.Cross(Vector3.up, forward);
                int perRow = Mathf.Max(1, Mathf.FloorToInt((MaxRow + Gap) / (half * 2f + Gap)));
                float yaw = Quaternion.LookRotation(-forward).eulerAngles.y;
                // Three rows per band of stages: d3 in front, d2 behind it, d1 at the back. Each stage shows only the decor
                // stage it is at: d3 until saved, then d2 (a copy of d3 to take decor away from), then d1. 'review' shows
                // every saved one.
                Vector3 Center(int stage, int decor)
                {
                    int band = (stage - 1) / perRow, column = (stage - 1) % perRow;
                    int inRow = Mathf.Min(perRow, stages - band * perRow);
                    int row = band * 3 + (3 - decor);
                    float width = inRow * half * 2f + (inRow - 1) * Gap;
                    Vector3 c = start + forward * (half + row * (half * 2f + Aisle)) + right * (-width / 2f + half + column * (half * 2f + Gap));
                    c.y = Ground(c, start.y);
                    return c;
                }

                for (int stage = 1; stage <= stages; stage++)
                {
                    bool[] saved = { false, File.Exists(SavedFile(baseId, stage, 1)), File.Exists(SavedFile(baseId, stage, 2)), File.Exists(SavedFile(baseId, stage, 3)) };
                    // Every stage always has its three plots, so the board shows where everything goes. A saved plot is
                    // shown empty ("saved") unless 'review'; the decor stage being worked on holds the copy to strip.
                    for (int decor = 3; decor >= 1; decor--)
                    {
                        string name = PlotName(baseId, stage, decor);
                        string above = decor < 3 ? SavedFile(baseId, stage, decor + 1) : null;
                        if (saved[decor])
                        {
                            MakePlot(name, Center(stage, decor), half, yaw, biome, kind.Label, review ? SavedFile(baseId, stage, decor) : null, "saved");
                        }
                        else if (decor == 3)
                        {
                            MakePlot(name, Center(stage, decor), half, yaw, biome, kind.Label, null, null);
                        }
                        else if (saved[decor + 1])
                        {
                            MakePlot(name, Center(stage, decor), half, yaw, biome, kind.Label, above, $"copy of {baseId}_s{stage}d{decor + 1}");
                        }
                        else
                        {
                            MakePlot(name, Center(stage, decor), half, yaw, biome, kind.Label, null, $"waits for d{decor + 1}");
                        }
                    }

                    yield return null;
                }

                string planBuild = null;
                yield return LoadIntoPlanBuild(text => planBuild = text);
                Say($"Board: {baseId} for {biome} {kind.Label}: {stages} plots of {half * 2f:0} m. {planBuild} " +
                    "Place designs with the Blueprint Rune, then save each plot with the Shaper Tool (Save).");
                if (bigger.Count > 0)
                {
                    Say($"Board: bigger than a plot ({bigger.Count}): " + string.Join(", ", bigger.Take(8).Select(c => $"No. {c.Number} ({c.Half * 2f:0} m)")) +
                        $". For those, 'vh slot ... size {Mathf.CeilToInt(bigger[0].Half * 2f)}' makes the plots big enough.");
                }
            }
            finally
            {
                _busy = false;
            }
        }

        /// <summary>Green-tinted horizontal wood beams round the plot, just outside it (never saved with the plot).</summary>
        internal const string KeyPlot = "villheim_board_plot";

        private static void Border(string plot, Vector3 center, float half, Vector3 forward, Vector3 right)
        {
            GameObject prefab = ZNetScene.instance.GetPrefab("wood_beam");
            if (prefab == null)
            {
                return;
            }

            float edge = half + 0.6f;
            foreach ((Vector3 along, Vector3 across) in new[] { (right, forward), (right, -forward), (forward, right), (forward, -right) })
            {
                int count = Mathf.CeilToInt(edge * 2f / 2f);
                for (int i = 0; i < count; i++)
                {
                    float t = -edge + (i + 0.5f) * (edge * 2f / count);
                    Vector3 at = center + across * edge + along * t;
                    // A beam's length runs along its own X axis.
                    at.y = Ground(at, center.y) - 0.05f;
                    GameObject beam = Object.Instantiate(prefab, at, Quaternion.LookRotation(Vector3.Cross(along, Vector3.up)));
                    ZDO zdo = beam.GetComponent<ZNetView>()?.GetZDO();
                    if (zdo != null)
                    {
                        zdo.Set(Gallery.KeyGallery, 1);
                        zdo.Set(KeyBeam, 1);
                        zdo.Set(KeyPlot, plot);
                    }

                    MaterialMan.instance?.SetValue(beam, Tint, BeamColour);
                }
            }
        }

        /// <summary>The ground's height at a point (the terrain where it is loaded), else the fallback.</summary>
        private static float Ground(Vector3 at, float fallback)
        {
            float height = ZoneSystem.instance != null ? ZoneSystem.instance.GetGroundHeight(at) : 0f;
            return height != 0f && Mathf.Abs(height - fallback) < 30f ? height : fallback;
        }

        /// <summary>
        /// One plot: beams, sign and label, and the pieces of a saved file in it when given (a decor copy, or a save
        /// shown again). State: null for empty, else what the sign says about its pieces.
        /// </summary>
        private static void MakePlot(string name, Vector3 center, float half, float yaw, string biome, string kind, string file, string state)
        {
            Vector3 forward = -(Quaternion.Euler(0f, yaw, 0f) * Vector3.forward);
            Vector3 right = Vector3.Cross(Vector3.up, forward);
            int placed = file != null && File.Exists(file) ? PutSaved(file, center, yaw) : 0;
            Border(name, center, half, forward, right);
            PlotSign(name, center, half, yaw, forward, biome, kind, placed, state);
            Plots.RemoveAll(p => p.Name == name);
            Plots.Add(new Plot { Name = name, Center = center, Half = half, Yaw = yaw });
        }

        private static void PlotSign(string name, Vector3 center, float half, float yaw, Vector3 forward, string biome, string kind, int placed, string state)
        {
            Vector3 at = center - forward * (half + 2f);
            GameObject sign = Gallery.OneSign(at, forward, 0f, SignText(name, biome, kind, state));
            ZDO zdo = sign?.GetComponent<ZNetView>()?.GetZDO();
            if (zdo == null)
            {
                return;
            }

            zdo.Set(Gallery.KeyDesign, name);
            zdo.Set(Gallery.KeyPlotCenter, center);
            zdo.Set(Gallery.KeyPlotHalf, half);
            zdo.Set(Gallery.KeyPlotYaw, yaw);
            zdo.Set(Gallery.KeyPlaced, placed);
            zdo.Set(KeyBiome, biome);
            zdo.Set(KeySubtype, kind);

            // A second sign just behind, carrying big text high above both, readable from across the board.
            GameObject label = Gallery.OneSign(at + forward * 0.08f, forward, 0f, LabelText(name, state));
            ZDO labelZdo = label?.GetComponent<ZNetView>()?.GetZDO();
            labelZdo?.Set(KeyLabel, name);
        }

        private static string LabelText(string name, string state)
        {
            // Short lines: a sign cuts off text wider than its board (one long name showed only "_S2D").
            (string baseId, int stage, int decor) = Parse(name);
            string word = state == null ? "empty" : state.StartsWith("copy") ? "strip" : state.StartsWith("waits") ? "waits" : state;
            return $"<#7f7><voffset=60><size=7>{baseId}<br>s{stage} d{decor}<br><size=5>" + (state == null ? "<#ccc>" : "<#fff>") + word;
        }

        private static string SignText(string name, string biome, string kind, string state)
        {
            (_, _, int decor) = Parse(name);
            string what = state == null
                ? "<#bbb>empty: place a design here"
                : state.StartsWith("copy")
                    ? $"<#fc6>{state}: take decor away, then save"
                    : state.StartsWith("waits")
                        ? $"<#999>{state}"
                        : $"<#8f8>{state}";
            string decorWord = decor == 3 ? "rich" : decor == 2 ? "furnished" : "sparse";
            return $"<#5f5>{StageName(name)} ({decorWord})<br><#fff>{biome} {kind}<br>{what}";
        }

        /// <summary>Puts a saved plot back: plain pieces, as if built, round the plot's middle. Returns how many.</summary>
        private static int PutSaved(string file, Vector3 center, float yaw)
        {
            Blueprints.Blueprint saved = Blueprints.FromFile(file);
            if (saved == null)
            {
                return 0;
            }

            Quaternion turn = Quaternion.Euler(0f, yaw, 0f);
            int made = 0;
            foreach (Blueprints.Piece piece in saved.Pieces)
            {
                GameObject prefab = ZNetScene.instance.GetPrefab(piece.Prefab);
                if (prefab == null)
                {
                    continue;
                }

                GameObject go = Object.Instantiate(prefab, center + turn * piece.Position, turn * piece.Rotation);
                if (piece.Scale != Vector3.one && piece.Scale != Vector3.zero)
                {
                    go.transform.localScale = piece.Scale;
                }

                made++;
            }

            List<string> terrain = TerrainLines(file);
            if (terrain.Count > 0 && VillheimPlugin.Instance != null)
            {
                VillheimPlugin.Instance.StartCoroutine(ApplyTerrain(terrain, center, yaw));
            }

            return made;
        }

        // ---------------------------------------------------------------- the ground of a plot

        /// <summary>
        /// The ground that is part of the design, as PlanBuild terrain lines ("square;x;y;z;0.5;0;0;Paint", plot
        /// coordinates, y above the plot's middle): every painted square metre (a circle of dirt, paths, paving, tilled
        /// soil), with its height so it comes back level, and every square raised or dug more than 30 cm from the plot's
        /// usual floor (the middle height of all its squares). Plain grass at floor height is never kept, so a save is
        /// as big as what was made in the plot, not the plot.
        /// </summary>
        private static List<string> SampleTerrain(Vector3 center, float yaw, float half)
        {
            var squares = new List<(int X, int Z, float Rise, string Paint)>();
            Quaternion turn = Quaternion.Euler(0f, yaw, 0f);
            int reach = Mathf.FloorToInt(half);
            for (int x = -reach; x <= reach; x++)
            for (int z = -reach; z <= reach; z++)
            {
                Vector3 world = center + turn * new Vector3(x, 0f, z);
                if (ZoneSystem.instance != null && ZoneSystem.instance.GetGroundHeight(world, out float ground))
                {
                    squares.Add((x, z, ground - center.y, PaintAt(world)));
                }
            }

            var lines = new List<string>();
            if (squares.Count == 0)
            {
                return lines;
            }

            List<float> rises = squares.Select(q => q.Rise).OrderBy(r => r).ToList();
            float floor = rises[rises.Count / 2];
            CultureInfo inv = CultureInfo.InvariantCulture;
            foreach ((int x, int z, float rise, string paint) in squares)
            {
                if (paint.Length > 0 || Mathf.Abs(rise - floor) > 0.3f)
                {
                    lines.Add(string.Join(";", "square", x.ToString(inv), rise.ToString("0.###", inv), z.ToString(inv), "0.5", "0", "0", paint));
                }
            }

            return lines;
        }

        private static string _lastGround = "";
        private static int _paintChecks;

        /// <summary>The paint on the ground at a spot: Paved, Cultivate, Dirt, or "" for none.</summary>
        private static string PaintAt(Vector3 world)
        {
            try
            {
                Heightmap map = Heightmap.FindHeightmap(world);
                if (map == null || map.m_paintMask == null)
                {
                    return "";
                }

                map.WorldToVertexMask(world, out int x, out int y);
                Color mask = map.m_paintMask.GetPixel(x, y);
                string paint = mask.b > 0.5f ? "Paved" : mask.g > 0.5f ? "Cultivate" : mask.r > 0.5f ? "Dirt" : "";
                if (_paintChecks++ < 3)
                {
                    VillheimPlugin.Log.LogInfo($"Board: paint at {world} (mask {x},{y} of {map.m_paintMask.width}): {mask} -> '{paint}'");
                }

                return paint;
            }
            catch (System.Exception e)
            {
                if (_paintChecks++ < 3)
                {
                    VillheimPlugin.Log.LogWarning($"Board: could not read the ground's paint: {e.GetType().Name}: {e.Message}");
                }

                return "";
            }
        }

        /// <summary>The terrain lines of a saved file (its "#Terrain" section).</summary>
        private static List<string> TerrainLines(string file)
        {
            var lines = new List<string>();
            bool inside = false;
            foreach (string line in File.ReadAllLines(file))
            {
                if (line.StartsWith("#"))
                {
                    inside = line.StartsWith("#Terrain", System.StringComparison.OrdinalIgnoreCase);
                    continue;
                }

                if (inside && line.Length > 0)
                {
                    lines.Add(line);
                }
            }

            return lines;
        }

        /// <summary>
        /// Puts a save's ground back round a plot's middle: each square metre levelled to its height and painted, the way
        /// the hoe does (a terrain operation on the ground under it). A few squares a frame.
        /// </summary>
        private static IEnumerator ApplyTerrain(List<string> lines, Vector3 center, float yaw)
        {
            Quaternion turn = Quaternion.Euler(0f, yaw, 0f);
            CultureInfo inv = CultureInfo.InvariantCulture;
            var holder = new GameObject("VillheimTerrainOp");
            holder.SetActive(false);
            TerrainOp op = holder.AddComponent<TerrainOp>();
            int done = 0;
            try
            {
                foreach (string line in lines)
                {
                    string[] f = line.Split(';');
                    if (f.Length < 8 || !float.TryParse(f[1], NumberStyles.Float, inv, out float x) ||
                        !float.TryParse(f[2], NumberStyles.Float, inv, out float y) || !float.TryParse(f[3], NumberStyles.Float, inv, out float z))
                    {
                        continue;
                    }

                    Vector3 world = center + turn * new Vector3(x, y, z);
                    try
                    {
                        TerrainComp ground = TerrainComp.FindTerrainCompiler(world);
                        if (ground == null)
                        {
                            continue;
                        }

                        op.transform.position = world;
                        op.m_settings = new TerrainOp.Settings
                        {
                            // 0.75 m: the ground's grid (about 1 m) does not line up with the plot's squares, so a
                            // 0.5 m reach could fall between its points and change nothing.
                            m_level = true,
                            m_levelRadius = 0.75f,
                            m_square = true,
                            m_paintCleared = f[7].Length > 0,
                            m_paintRadius = 0.75f,
                            m_paintType = f[7] == "Paved" ? TerrainModifier.PaintType.Paved
                                : f[7] == "Cultivate" ? TerrainModifier.PaintType.Cultivate
                                : TerrainModifier.PaintType.Dirt,
                        };
                        ground.ApplyOperation(op);
                    }
                    catch (System.Exception e)
                    {
                        VillheimPlugin.Log.LogWarning($"Board: could not put the ground back at {world}: {e.Message}");
                        yield break;
                    }

                    if (++done % 40 == 0)
                    {
                        yield return null;
                    }
                }
            }
            finally
            {
                Object.Destroy(holder);
                int painted = lines.Count(l => !l.EndsWith(";"));
                Say($"Board: ground put back in the copy: {done} squares ({painted} painted).");
            }
        }

        // ---------------------------------------------------------------- saving and resetting a plot

        /// <summary>Shaper Tool Save on a plot: everything inside the green border, as &lt;baseID&gt;_s&lt;stage&gt;d3.</summary>
        public static string Save(string plotName)
        {
            (ZDO sign, List<ZNetView> views) = SwapTool.DesignParts(plotName);
            if (sign == null)
            {
                return "Board: that plot's sign is not loaded; stand nearer.";
            }

            if (views.Count == 0)
            {
                return $"Board: {StageName(plotName)} is empty; place a design in it first.";
            }

            Vector3 center = sign.GetVec3(Gallery.KeyPlotCenter, Vector3.zero);
            Quaternion frame = Quaternion.Inverse(Quaternion.Euler(0f, sign.GetFloat(Gallery.KeyPlotYaw, 0f), 0f));
            var counts = new Dictionary<string, int>();
            var lines = new List<string>();
            foreach (ZNetView view in views)
            {
                string prefab = Utils.GetPrefabName(view.gameObject);
                // PlanBuild's planned pieces carry the real piece's name with "_planned" after it.
                if (prefab.EndsWith("_planned"))
                {
                    prefab = prefab.Substring(0, prefab.Length - "_planned".Length);
                }

                lines.Add(Line(prefab, frame * (view.transform.position - center), frame * view.transform.rotation, view.transform.localScale));
                counts[prefab] = counts.TryGetValue(prefab, out int c) ? c + 1 : 1;
            }

            (string baseId, int stageNumber, int decor) = Parse(plotName);
            string stem = StageName(plotName);
            Candidate source = null;
            float match = 0f;
            string[] fromD3 = null;
            if (decor == 3)
            {
                ReadCandidates();
                (source, match) = BestMatch(counts);
            }
            else
            {
                Records().TryGetValue($"{baseId}_s{stageNumber}d3", out fromD3);
            }
            string biome = sign.GetString(KeyBiome, "");
            string kind = sign.GetString(KeySubtype, "");
            var header = new List<string>
            {
                "#Name:" + stem,
                "#Creator:Villheim board",
                $"#Description:{biome} {kind}, stage {stageNumber}, decor {decor}" +
                (source != null ? $"; from No. {source.Number} {source.Design} ({match:P0} alike)" : "") +
                (fromD3 != null && fromD3[6].Length > 0 ? $"; from No. {fromD3[6]} {fromD3[7]} by way of d3" : "") + $"; saved {System.DateTime.Now:yyyy-MM-dd HH:mm}",
                "#Category:Villheim saved",
            };

            // The ground inside the plot (paths, paving, tilled soil, raised or lowered spots), as PlanBuild's terrain
            // section: PlanBuild puts it back when it places the blueprint, and so does the board for its copies.
            List<string> terrain = SampleTerrain(center, sign.GetFloat(Gallery.KeyPlotYaw, 0f), sign.GetFloat(Gallery.KeyPlotHalf, 10f));
            int paintedSquares = terrain.Count(l => !l.EndsWith(";"));
            _lastGround = $"{terrain.Count} ground squares kept ({paintedSquares} painted)";
            if (terrain.Count > 0)
            {
                header.Add("#Terrain");
                header.AddRange(terrain);
            }

            header.Add("#Pieces");
            Directory.CreateDirectory(SaveFolder);
            string file = Path.Combine(SaveFolder, stem + ".blueprint");
            // What the save replaces, for Undo.
            string oldText = File.Exists(file) ? File.ReadAllText(file) : null;
            Records().TryGetValue(stem, out string[] oldRecord);
            List<EditHistory.Snapshot> snapshots = views.Select(EditHistory.Take).ToList();
            int oldPlaced = sign.GetInt(Gallery.KeyPlaced, 0);
            DesignSort.Entry sourceEntry = source != null ? DesignSort.Get(source.Design) : null;
            (string Biome, string Base, string Stage) oldSlot = sourceEntry != null ? (sourceEntry.Biome, sourceEntry.BaseId, sourceEntry.Stage) : ("", "", "");
            File.WriteAllLines(file, header.Concat(lines));

            string s = stageNumber.ToString();
            string[] record =
            {
                stem, baseId, s, decor.ToString(), biome, kind,
                source?.Number.ToString() ?? fromD3?[6] ?? "", source?.Design ?? fromD3?[7] ?? "",
                source != null ? match.ToString("0.00", CultureInfo.InvariantCulture) : fromD3 != null ? "from d3" : "",
                views.Count.ToString(), System.DateTime.Now.ToString("yyyy-MM-dd HH:mm"),
            };
            Record(record);
            sign.Set(Gallery.KeyPlaced, views.Count);
            sign.Set(KeySource, source?.Design ?? "");
            if (source != null)
            {
                DesignSort.SetSlot(source.Design, biome, baseId, s);
            }

            DesignSort.PushSlot(record);
            Vector3 plotCenter = sign.GetVec3(Gallery.KeyPlotCenter, Vector3.zero);
            float half = sign.GetFloat(Gallery.KeyPlotHalf, 10f);
            float yaw = sign.GetFloat(Gallery.KeyPlotYaw, 0f);
            // The pieces go; the plot stays, marked saved.
            foreach (ZNetView view in views.Where(v => v != null && v.IsValid()))
            {
                view.ClaimOwnership();
                ZNetScene.instance.Destroy(view.gameObject);
            }

            SetPlotState(plotName, 0, "saved");

            // The next decor stage appears behind, as a copy of this save to take decor away from.
            string next = "";
            string nextPlot = null;
            if (decor > 1)
            {
                string nextName = PlotName(baseId, stageNumber, decor - 1);
                Plot behindPlot = Plots.FirstOrDefault(p => p.Name == nextName);
                if (behindPlot == null)
                {
                    Vector3 forward = -(Quaternion.Euler(0f, yaw, 0f) * Vector3.forward);
                    Vector3 behind = plotCenter + forward * (half * 2f + Aisle);
                    behind.y = Ground(behind, plotCenter.y);
                    MakePlot(nextName, behind, half, yaw, biome, kind, file, $"copy of {stem}");
                }
                else
                {
                    // Whatever stood there (an older copy) makes way for the new one.
                    foreach (ZNetView view in SwapTool.DesignParts(nextName).Views.Where(v => v != null && v.IsValid()))
                    {
                        view.ClaimOwnership();
                        ZNetScene.instance.Destroy(view.gameObject);
                    }

                    int copied = PutSaved(file, behindPlot.Center, behindPlot.Yaw);
                    SetPlotState(nextName, copied, $"copy of {stem}");
                }

                nextPlot = nextName;
                next = $" {StageName(nextName)} behind it now holds a copy: take decor away and save.";
            }
            else
            {
                next = $" {baseId}_s{stageNumber} is done (d3, d2, d1).";
            }

            // Undo (8) walks the save back: the plot as it was, the copy behind it gone, the file and the sheet as before.
            string state = decor < 3 ? $"copy of {baseId}_s{stageNumber}d{decor + 1}" : null;
            EditHistory.Push($"saving {stem}", () =>
            {
                if (nextPlot != null)
                {
                    foreach (ZNetView view in SwapTool.DesignParts(nextPlot).Views.Where(v => v != null && v.IsValid()))
                    {
                        view.ClaimOwnership();
                        ZNetScene.instance.Destroy(view.gameObject);
                    }

                    SetPlotState(nextPlot, 0, $"waits for d{decor}");
                }

                if (oldText != null)
                {
                    File.WriteAllText(file, oldText);
                }
                else if (File.Exists(file))
                {
                    File.Delete(file);
                }

                if (oldRecord != null)
                {
                    Record(oldRecord);
                    DesignSort.PushSlot(oldRecord);
                }
                else
                {
                    Unrecord(stem);
                    DesignSort.PushSlot(new[] { stem });
                }

                if (source != null)
                {
                    DesignSort.SetSlot(source.Design, oldSlot.Biome, oldSlot.Base, oldSlot.Stage);
                }

                snapshots.ForEach(EditHistory.Restore);
                SetPlotState(plotName, oldPlaced, snapshots.Count > 0 ? state ?? "as before the save" : null);
            });

            return $"Board: saved {stem} ({views.Count} pieces; {_lastGround})" +
                   (source != null ? $", from No. {source.Number} {source.Design} ({match:P0} alike)." : decor == 3 ? "; no candidate matched it." : ".") + next +
                   " Undo (8) walks the save back.";
        }

        /// <summary>Every plot of the board with something in it is saved (and put away).</summary>
        public static string SaveAll()
        {
            Scan();
            var said = new List<string>();
            foreach (Plot plot in Plots.ToList())
            {
                if (SwapTool.DesignParts(plot.Name).Views.Count > 0)
                {
                    said.Add(Save(plot.Name));
                }
            }

            return said.Count == 0 ? "Board: no plot has anything in it to save." : string.Join("\n", said);
        }

        /// <summary>A saved plot leaves the field: its pieces, beams, sign and label, so what is left is what still needs work.</summary>
        private static void Hide(string plotName, List<ZNetView> pieces)
        {
            var doomed = new List<ZNetView>(pieces);
            doomed.AddRange(Loaded().Where(v =>
            {
                ZDO z = v.GetZDO();
                return z.GetString(KeyPlot, "") == plotName || z.GetString(KeyLabel, "") == plotName || z.GetString(Gallery.KeyDesign, "") == plotName;
            }));
            foreach (ZNetView view in doomed.Distinct())
            {
                if (view != null && view.IsValid())
                {
                    view.ClaimOwnership();
                    ZNetScene.instance.Destroy(view.gameObject);
                }
            }

            Plots.RemoveAll(p => p.Name == plotName);
        }

        /// <summary>Sets a plot's sign and label to a state (and how many pieces count as saved).</summary>
        private static void SetPlotState(string plotName, int placed, string state)
        {
            foreach (ZNetView view in Loaded())
            {
                ZDO zdo = view.GetZDO();
                bool front = zdo.GetString(Gallery.KeyDesign, "") == plotName;
                bool label = zdo.GetString(KeyLabel, "") == plotName;
                if (!front && !label)
                {
                    continue;
                }

                if (!view.IsOwner())
                {
                    view.ClaimOwnership();
                }

                if (front)
                {
                    zdo.Set(Gallery.KeyPlaced, placed);
                    zdo.Set(ZDOVars.s_text, SignText(plotName, zdo.GetString(KeyBiome, ""), zdo.GetString(KeySubtype, ""), state));
                }
                else
                {
                    zdo.Set(ZDOVars.s_text, LabelText(plotName, state));
                }

                view.GetComponent<Sign>()?.UpdateText();
            }
        }

        /// <summary>
        /// 'vh slot forget hub1_s1d3': deletes that save, its record and its Slots row, and clears the design's biome, base
        /// ID and stage if they came from it. For saves made before Undo could take a save back.
        /// </summary>
        private static string Forget(string stem)
        {
            stem = stem.Trim();
            string file = Path.Combine(SaveFolder, stem + ".blueprint");
            if (!File.Exists(file))
            {
                return $"Board: no save called {stem} (they are in {SaveFolder}).";
            }

            File.Delete(file);
            Records().TryGetValue(stem, out string[] record);
            Unrecord(stem);
            DesignSort.PushSlot(new[] { stem });
            if (record != null && record.Length > 7 && record[7].Length > 0)
            {
                DesignSort.Entry entry = DesignSort.Get(record[7]);
                if (entry != null && entry.BaseId == record[1] && entry.Stage == record[2])
                {
                    DesignSort.SetSlot(record[7], "", "", "");
                }
            }

            return $"Board: {stem} forgotten. Put the board up again ('vh slot <biome> <kind> <number>') to see that stage as it is now.";
        }

        private static void Unrecord(string stem)
        {
            Dictionary<string, string[]> rows = Records();
            if (rows.Remove(stem))
            {
                File.WriteAllLines(RecordPath, new[] { string.Join(",", RecordHeader) }
                    .Concat(rows.Values.OrderBy(r => r[0]).Select(r => string.Join(",", r.Select(v => v.Contains(",") ? "\"" + v.Replace(",", " ") + "\"" : v)))));
            }
        }

        /// <summary>The candidate whose piece counts are most like the plot's (cosine of the two count lists).</summary>
        private static (Candidate, float) BestMatch(Dictionary<string, int> counts)
        {
            Candidate best = null;
            float bestScore = 0f;
            double norm = System.Math.Sqrt(counts.Values.Sum(v => (double)v * v));
            foreach (Candidate candidate in Candidates)
            {
                double dot = counts.Sum(kv => candidate.Counts.TryGetValue(kv.Key, out int c) ? (double)kv.Value * c : 0d);
                double other = System.Math.Sqrt(candidate.Counts.Values.Sum(v => (double)v * v));
                float score = norm > 0 && other > 0 ? (float)(dot / (norm * other)) : 0f;
                if (score > bestScore)
                {
                    best = candidate;
                    bestScore = score;
                }
            }

            return bestScore >= 0.3f ? (best, bestScore) : (null, 0f);
        }

        /// <summary>Shaper Tool Reset on a plot: takes everything in it down and puts its last save back (or leaves it empty). Undo restores it.</summary>
        public static string ResetPlot(string plotName)
        {
            (ZDO sign, List<ZNetView> views) = SwapTool.DesignParts(plotName);
            if (sign == null)
            {
                return "Board: that plot's sign is not loaded; stand nearer.";
            }

            List<EditHistory.Snapshot> snapshots = views.Select(EditHistory.Take).ToList();
            foreach (ZNetView view in views)
            {
                view.ClaimOwnership();
                ZNetScene.instance.Destroy(view.gameObject);
            }

            (string resetBase, int resetStage, int resetDecor) = Parse(plotName);
            string file = SavedFile(resetBase, resetStage, resetDecor);
            if (!File.Exists(file) && resetDecor < 3)
            {
                file = SavedFile(resetBase, resetStage, resetDecor + 1);
            }
            int made = File.Exists(file)
                ? PutSaved(file, sign.GetVec3(Gallery.KeyPlotCenter, Vector3.zero), sign.GetFloat(Gallery.KeyPlotYaw, 0f))
                : 0;
            List<ZNetView> fresh = SwapTool.DesignParts(plotName).Views;
            EditHistory.Push($"resetting {StageName(plotName)}", () =>
            {
                foreach (ZNetView view in fresh.Where(v => v != null && v.IsValid()))
                {
                    view.ClaimOwnership();
                    ZNetScene.instance.Destroy(view.gameObject);
                }

                snapshots.ForEach(EditHistory.Restore);
            });
            return $"Board: {StageName(plotName)} cleared ({views.Count} pieces)" +
                   (made > 0 ? $" and put back as last saved ({made} pieces)." : "; it is empty now.") + " 8 (Undo) brings back what was there.";
        }

        // ---------------------------------------------------------------- the record of saves

        private static readonly string[] RecordHeader =
            { "File", "Base ID", "s", "d", "Biome", "Subtype", "No.", "Name", "Match", "Pieces", "Saved at" };

        /// <summary>board-saves.csv by file stem.</summary>
        private static Dictionary<string, string[]> Records()
        {
            var rows = new Dictionary<string, string[]>();
            try
            {
                if (File.Exists(RecordPath))
                {
                    foreach (string line in File.ReadAllLines(RecordPath).Skip(1))
                    {
                        string[] f = line.Split(',').Select(v => v.Trim('"')).ToArray();
                        if (f.Length >= RecordHeader.Length)
                        {
                            rows[f[0]] = f;
                        }
                    }
                }
            }
            catch (System.Exception e)
            {
                VillheimPlugin.Log.LogWarning($"Board: could not read {RecordPath}: {e.Message}");
            }

            return rows;
        }

        private static void Record(string[] record)
        {
            Dictionary<string, string[]> rows = Records();
            rows[record[0]] = record;
            Directory.CreateDirectory(Path.GetDirectoryName(RecordPath));
            File.WriteAllLines(RecordPath, new[] { string.Join(",", RecordHeader) }
                .Concat(rows.Values.OrderBy(r => r[0]).Select(r => string.Join(",", r.Select(v => v.Contains(",") ? "\"" + v.Replace(",", " ") + "\"" : v)))));
        }

        private static void Say(string text)
        {
            MessageHud.instance?.ShowMessage(MessageHud.MessageType.TopLeft, text.Length > 160 ? text.Substring(0, 160) + "..." : text);
            foreach (string line in text.Split('\n'))
            {
                Console.instance?.Print(line);
            }
        }
    }
}
