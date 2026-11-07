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
    /// everything inside the green border is written as &lt;baseID&gt;_s&lt;stage&gt;d3. The design it came from is
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

            if (first == "save" && words.Count > 1 && words[1] == "all")
            {
                return SaveAll();
            }

            if (first == "save" && words.Count > 1)
            {
                string plot = Plots.Select(p => p.Name).FirstOrDefault(n => n.EndsWith(":s" + words[1].TrimStart('s')));
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
            VillheimPlugin.Instance.StartCoroutine(Build(player.transform.position, forward, biome, kind, kind.Root + number, stages, size));
            return $"Board: putting up {kind.Root}{number} ({biome} {kind.Label}, {stages} stages) and the {kind.Label} designs for PlanBuild's \"{Category}\" tab.";
        }

        private static string Usage() =>
            "Board: 'vh slot <biome> <kind> [number] [stages N]', e.g. 'vh slot meadows hearth' (a new hub) or 'vh slot meadows hearth 1' " +
            "(hub1 again, with its saved stages).\nBiomes: meadows, blackforest, swamp, mountains, plains, mistlands, ashlands, deepnorth.\n" +
            "Kinds: house, hearth, tavern, longhouse, decor, farm, wood, forge, cook, store, guard, craft, dock, hunt, rune, mason, weave.\n" +
            "'vh slot save <stage>' or 'vh slot save all' (or the Shaper Tool's Save on a plot; Shift on the second click saves all), 'vh slot clear'. Saves go to blueprints/inspiration/board.";

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

        private static string StageName(string plot) => plot.Substring(Prefix.Length).Replace(":", "_");

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

        private static IEnumerator Build(Vector3 playerPosition, Vector3 forward, string biome, Kind kind, string baseId, int stages, float size)
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
                Vector3 start = playerPosition + forward * 8f;
                if (Gallery.LoadFlatArea(out Vector3 flatStart, out Vector3 flatForward) && Utils.DistanceXZ(flatStart, playerPosition) < 600f)
                {
                    start = flatStart + flatForward * 4f;
                    forward = flatForward;
                }

                Vector3 right = Vector3.Cross(Vector3.up, forward);
                int perRow = Mathf.Max(1, Mathf.FloorToInt((MaxRow + Gap) / (half * 2f + Gap)));
                float yaw = Quaternion.LookRotation(-forward).eulerAngles.y;
                Dictionary<string, string[]> records = Records();
                for (int stage = 1; stage <= stages; stage++)
                {
                    int row = (stage - 1) / perRow, column = (stage - 1) % perRow;
                    int inRow = Mathf.Min(perRow, stages - row * perRow);
                    float width = inRow * half * 2f + (inRow - 1) * Gap;
                    Vector3 center = start + forward * (half + row * (half * 2f + Aisle)) + right * (-width / 2f + half + column * (half * 2f + Gap));
                    center.y = Ground(center, start.y);
                    string name = $"{Prefix}{baseId}:s{stage}";
                    string file = Path.Combine(SaveFolder, $"{baseId}_s{stage}d3.blueprint");
                    int placed = File.Exists(file) ? PutSaved(file, center, yaw) : 0;
                    records.TryGetValue(Path.GetFileNameWithoutExtension(file), out string[] record);
                    Border(name, center, half, forward, right);
                    PlotSign(name, center, half, yaw, forward, biome, kind.Label, placed, record);
                    Plots.Add(new Plot { Name = name, Center = center, Half = half, Yaw = yaw });
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

        private static void PlotSign(string name, Vector3 center, float half, float yaw, Vector3 forward, string biome, string kind, int placed, string[] record)
        {
            Vector3 at = center - forward * (half + 2f);
            GameObject sign = Gallery.OneSign(at, forward, 0f, SignText(name, biome, kind, placed, record));
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
            GameObject label = Gallery.OneSign(at + forward * 0.08f, forward, 0f, LabelText(name, placed, record));
            ZDO labelZdo = label?.GetComponent<ZNetView>()?.GetZDO();
            labelZdo?.Set(KeyLabel, name);
        }

        private static string LabelText(string name, int placed, string[] record) =>
            $"<#7f7><voffset=60><size=10>{StageName(name)}<br><size=6>" +
            (placed == 0 ? "<#ccc>empty" : "<#fff>saved" + (record != null && record.Length > 7 && record[6].Length > 0 ? $": No. {record[6]}" : ""));

        private static string SignText(string name, string biome, string kind, int placed, string[] record)
        {
            string stage = StageName(name);
            string state = placed == 0
                ? "<#bbb>empty: place a design here"
                : $"<#8f8>saved as {stage}d3" + (record != null && record.Length > 7 && record[6].Length > 0 ? $", from No. {record[6]} {record[7]}" : "");
            return $"<#5f5>{stage}<br><#fff>{biome} {kind}<br>{state}";
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

            return made;
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

            ReadCandidates();
            (Candidate source, float match) = BestMatch(counts);
            string stage = StageName(plotName);
            string stem = stage + "d3";
            string biome = sign.GetString(KeyBiome, "");
            string kind = sign.GetString(KeySubtype, "");
            var header = new List<string>
            {
                "#Name:" + stem,
                "#Creator:Villheim board",
                $"#Description:{biome} {kind}, stage {stage.Substring(stage.LastIndexOf('s') + 1)}, decor 3" +
                (source != null ? $"; from No. {source.Number} {source.Design} ({match:P0} alike)" : "") + $"; saved {System.DateTime.Now:yyyy-MM-dd HH:mm}",
                "#Category:Villheim saved",
                "#Pieces",
            };
            Directory.CreateDirectory(SaveFolder);
            string file = Path.Combine(SaveFolder, stem + ".blueprint");
            File.WriteAllLines(file, header.Concat(lines));

            string baseId = stage.Substring(0, stage.IndexOf("_s", System.StringComparison.Ordinal));
            string s = stage.Substring(stage.IndexOf("_s", System.StringComparison.Ordinal) + 2);
            string[] record =
            {
                stem, baseId, s, "3", biome, kind, source?.Number.ToString() ?? "",
                source?.Design ?? "", source != null ? match.ToString("0.00", CultureInfo.InvariantCulture) : "", views.Count.ToString(),
                System.DateTime.Now.ToString("yyyy-MM-dd HH:mm"),
            };
            Record(record);
            sign.Set(Gallery.KeyPlaced, views.Count);
            sign.Set(KeySource, source?.Design ?? "");
            Retext(sign, plotName, views.Count, record);
            if (source != null)
            {
                DesignSort.SetSlot(source.Design, biome, baseId, s);
            }

            DesignSort.PushSlot(record);
            Hide(plotName, views);
            return $"Board: saved {stem} ({views.Count} pieces)" +
                   (source != null ? $", from No. {source.Number} {source.Design} ({match:P0} alike)" : "; no candidate matched it") +
                   ". The plot is put away; 'vh slot <biome> <kind> <number>' brings the board back with its saves.";
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

        private static void Retext(ZDO sign, string plotName, int placed, string[] record)
        {
            sign.Set(ZDOVars.s_text, SignText(plotName, sign.GetString(KeyBiome, ""), sign.GetString(KeySubtype, ""), placed, record));
            foreach (ZNetView view in Loaded())
            {
                ZDO zdo = view.GetZDO();
                if (zdo == sign)
                {
                    view.GetComponent<Sign>()?.UpdateText();
                }
                else if (zdo.GetString(KeyLabel, "") == plotName)
                {
                    if (!view.IsOwner())
                    {
                        view.ClaimOwnership();
                    }

                    zdo.Set(ZDOVars.s_text, LabelText(plotName, placed, record));
                    view.GetComponent<Sign>()?.UpdateText();
                }
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

            string file = Path.Combine(SaveFolder, StageName(plotName) + "d3.blueprint");
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
