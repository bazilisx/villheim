using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Designs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// 'vh bp save &lt;number|name&gt;': saves a design as it stands in the gallery now: its pieces that are left, the
    /// stand-ins chosen for it ('vh swap') and anything built by hand on its plot; pieces taken away are simply not
    /// there. 'vh bp save page [all]' does that for every design of the page standing near the player that was
    /// changed (or all of them). Saves go to blueprints/inspiration/pass3 as p3-&lt;number&gt;-&lt;name&gt;.blueprint (number
    /// from design-list.csv), are listed in BepInEx/Villheim/pass3-saved.csv, and the gallery shows a design from its
    /// save from then on. A design not standing nearby is saved from its chosen stand-ins alone.
    ///
    /// 'vh bp swap &lt;number|name&gt; &lt;stage&gt;': saves a copy with every later building piece swapped by the rules of
    /// MaterialSwap, to blueprints/inspiration/edits. The original design is never changed.
    /// </summary>
    internal static class BlueprintEdits
    {
        public const string Usage =
            "vh bp save <number|name>: saves the design with the stand-ins you chose for it ('vh swap'). " +
            "vh bp swap <number|name> <meadows|blackforest|swamp|mountain|plains>: saves it with every later building piece swapped " +
            "for that stage. Numbers are from design-list.csv; 'vh gallery show <new name>' shows the copy.";

        public static string EditsFolder => Path.Combine(Blueprints.Folder, "inspiration", "edits");

        /// <summary>What one piece becomes: itself, or one or more other pieces.</summary>
        private delegate List<(string Prefab, Vector3 Position, Quaternion Rotation)> Change(string prefab, Vector3 position, Quaternion rotation);

        public static string Run(string[] args)
        {
            string verb = args.Length > 0 ? args[0].ToLowerInvariant() : "";
            if (verb == "forget" && args.Length >= 2)
            {
                return Forget(args[1]);
            }

            if (verb == "save" && args.Length >= 2 && args[1].ToLowerInvariant() == "page")
            {
                return SavePage(args.Length > 2 && args[2].ToLowerInvariant() == "all");
            }

            bool save = verb == "save" && args.Length >= 2;
            bool swap = verb == "swap" && args.Length >= 3 && Gallery.StageIndexOf(args[2]) >= 0;
            if (!save && !swap)
            {
                return "Villheim: " + Usage;
            }

            string name = args[1];
            if (int.TryParse(name, out int number))
            {
                name = Gallery.ReadNumbers().FirstOrDefault(k => k.Value == number).Key;
                if (name == null)
                {
                    return $"Villheim: no design numbered {number} in design-list.csv ('vh report' writes it).";
                }
            }

            DesignLibrary.Design? found = DesignLibrary.ByName(name) ?? DesignLibrary.ByName(Blueprints.Prefix + name);
            if (found == null)
            {
                return $"Villheim: no design called '{name}'.";
            }

            DesignLibrary.Design design = found.Value;
            if (save)
            {
                ZDO standing = FrontSign(design.Name);
                return standing != null
                    ? "Villheim: " + SaveStanding(design, standing, out _)
                    : $"Villheim: {design.Name} is not standing near you; put its gallery page up and stand near it to save it.";
            }

            int changed = 0;
            var result = new MaterialSwap.Result();
            int target = Gallery.StageIndexOf(args[2]);
            string suffix = "_as_" + Gallery.StageWords[target];
            string description = $"{design.Name} in {Gallery.StageNames[target]} materials (Villheim material swap)";
            Change change = (prefab, position, rotation) =>
            {
                if (MaterialSwap.Swappable(prefab) && MaterialSwap.TrySwap(prefab, target, out string other, out Vector3 shift, out Quaternion turn))
                {
                    result.Swapped++;
                    changed++;
                    return new List<(string, Vector3, Quaternion)> { (other, position + rotation * shift, rotation * turn) };
                }

                MaterialSwap.Note(prefab, target, result);
                return new List<(string, Vector3, Quaternion)> { (prefab, position, rotation) };
            };

            string stem = Stem(design.Name) + suffix;
            var lines = new List<string>
            {
                "#Name:" + stem,
                "#Creator:" + (design.Blueprint?.Creator ?? ""),
                "#Description:" + description,
                "#Category:Villheim",
                "#Pieces",
            };

            if (design.Blueprint != null)
            {
                foreach (Blueprints.Piece piece in design.Blueprint.Pieces)
                {
                    foreach ((string p, Vector3 at, Quaternion q) in change(piece.Prefab, piece.Position, piece.Rotation))
                    {
                        lines.Add(Line(p, at, q, p == piece.Prefab ? piece.Scale : Vector3.one, p == piece.Prefab ? piece.Text : null));
                    }
                }
            }
            else
            {
                ZoneSystem.ZoneLocation location = design.Location;
                AssetGuard.Load(location);
                try
                {
                    GameObject asset = location.m_prefab.Asset;
                    if (asset == null)
                    {
                        return $"Villheim: {design.Name} could not be loaded.";
                    }

                    foreach (DesignSpawner.PlanEntry entry in DesignSpawner.MakePlan(asset, Vector3.zero, 1, 0f, false))
                    {
                        foreach ((string p, Vector3 at, Quaternion q) in change(entry.Prefab, entry.LocalPosition, entry.LocalRotation))
                        {
                            lines.Add(Line(p, at, q, p == entry.Prefab ? entry.Scale : Vector3.one, null));
                        }
                    }
                }
                finally
                {
                    location.m_prefab.Release();
                }
            }

            Directory.CreateDirectory(EditsFolder);
            string file = Path.Combine(EditsFolder, stem + ".blueprint");
            File.WriteAllLines(file, lines);
            string summary = result.Summary(target);
            return $"Villheim: saved {file}: {summary}. 'vh gallery show {stem}' lays it out.";
        }

        // ---------------------------------------------------------------- saving what stands in the gallery

        /// <summary>'vh bp forget &lt;number|name|all&gt;': deletes pass 3 saves, so the gallery shows the original again.</summary>
        private static string Forget(string what)
        {
            if (!Directory.Exists(Gallery.PassThreeFolder))
            {
                return "Villheim: there are no pass 3 saves.";
            }

            List<string> files;
            if (what.ToLowerInvariant() == "all")
            {
                files = Directory.GetFiles(Gallery.PassThreeFolder, "p3-*.blueprint").ToList();
            }
            else
            {
                string name = what;
                if (int.TryParse(what, out int number))
                {
                    files = Directory.GetFiles(Gallery.PassThreeFolder, $"p3-{number:0000}-*.blueprint").ToList();
                }
                else
                {
                    string file = Gallery.PassThreeFile(name) ?? Gallery.PassThreeFile(Blueprints.Prefix + name);
                    files = file != null ? new List<string> { file } : new List<string>();
                }
            }

            foreach (string file in files)
            {
                File.Delete(file);
            }

            if (File.Exists(ManifestPath))
            {
                var stems = new HashSet<string>(files.Select(Path.GetFileNameWithoutExtension));
                File.WriteAllLines(ManifestPath, File.ReadAllLines(ManifestPath).Where((l, i) => i == 0 || !stems.Any(l.Contains)));
            }

            return files.Count == 0 ? $"Villheim: no pass 3 save for '{what}'." :
                $"Villheim: deleted {files.Count} pass 3 save(s); the gallery shows the original from the next time it puts them up.";
        }

        public static string ManifestPath => Path.Combine(BepInEx.Paths.BepInExRootPath, "Villheim", "pass3-saved.csv");

        /// <summary>The front sign of a design standing in the gallery (it holds the plot), or null.</summary>
        private static ZDO FrontSign(string design)
        {
            foreach (ZNetView view in ZNetScene.instance.m_instances.Values)
            {
                ZDO zdo = view != null && view.IsValid() ? view.GetZDO() : null;
                if (zdo != null && view.GetComponent<Sign>() != null && zdo.GetString(Gallery.KeyDesign, "") == design &&
                    zdo.GetFloat(Gallery.KeyPlotHalf, 0f) > 0f)
                {
                    return zdo;
                }
            }

            return null;
        }

        private static string SavePage(bool all)
        {
            var signs = new List<ZDO>();
            foreach (ZNetView view in ZNetScene.instance.m_instances.Values)
            {
                ZDO zdo = view != null && view.IsValid() ? view.GetZDO() : null;
                if (zdo != null && view.GetComponent<Sign>() != null && zdo.GetString(Gallery.KeyDesign, "").Length > 0 &&
                    zdo.GetFloat(Gallery.KeyPlotHalf, 0f) > 0f)
                {
                    signs.Add(zdo);
                }
            }

            if (signs.Count == 0)
            {
                return "Villheim: no gallery designs standing near you.";
            }

            int saved = 0, unchanged = 0;
            var names = new List<string>();
            foreach (ZDO sign in signs.OrderBy(z => z.GetInt(Gallery.KeyNumber)))
            {
                string name = sign.GetString(Gallery.KeyDesign, "");
                DesignLibrary.Design? found = DesignLibrary.ByName(name);
                if (found == null)
                {
                    continue;
                }

                if (!all && !Changed(name, sign))
                {
                    unchanged++;
                    continue;
                }

                SaveStanding(found.Value, sign, out string file);
                names.Add(Path.GetFileNameWithoutExtension(file));
                saved++;
            }

            return $"Villheim: saved {saved} of {signs.Count} designs standing near you to {Gallery.PassThreeFolder}" +
                   (unchanged > 0 ? $" ({unchanged} unchanged, left out; 'vh bp save page all' saves them too)" : "") +
                   $". List: {ManifestPath}." + (names.Count > 0 ? " " + string.Join(", ", names.Take(12)) + (names.Count > 12 ? ", ..." : "") : "");
        }

        /// <summary>What stands on a design's plot now, in the design's own coordinates.</summary>
        private static List<(string Prefab, Vector3 Position, Quaternion Rotation, Vector3 Scale, string Text, bool ByHand, bool StandIn)> Standing(string design, ZDO sign)
        {
            Vector3 center = sign.GetVec3(Gallery.KeyPlotCenter, Vector3.zero);
            float half = sign.GetFloat(Gallery.KeyPlotHalf, 0f);
            Quaternion frame = Quaternion.Inverse(Quaternion.Euler(0f, sign.GetFloat(Gallery.KeyPlotYaw, 0f), 0f));
            var pieces = new List<(string, Vector3, Quaternion, Vector3, string, bool, bool)>();
            foreach (ZNetView view in ZNetScene.instance.m_instances.Values)
            {
                ZDO zdo = view != null && view.IsValid() ? view.GetZDO() : null;
                if (zdo == null)
                {
                    continue;
                }

                bool gallery = zdo.GetInt(Gallery.KeyGallery) == 1;
                // The design's own pieces, signs included (a notice board's), but not the gallery's sign that names it.
                bool ours = gallery && zdo.GetString(Gallery.KeyDesign, "") == design && zdo.GetFloat(Gallery.KeyPlotHalf, 0f) <= 0f;
                Vector3 local = frame * (view.transform.position - center);
                bool byHand = !gallery && view.GetComponent<Piece>() != null && Mathf.Abs(local.x) <= half && Mathf.Abs(local.z) <= half &&
                              view.GetComponent<Character>() == null;
                if (!ours && !byHand)
                {
                    continue;
                }

                string text = view.GetComponent<Sign>() != null ? zdo.GetString(ZDOVars.s_text, "") : null;
                pieces.Add((Utils.GetPrefabName(view.gameObject), local, frame * view.transform.rotation, view.transform.localScale, text,
                    byHand, zdo.GetString(Gallery.KeySwappedFrom, "").Length > 0));
            }

            return pieces;
        }

        private static bool Changed(string design, ZDO sign)
        {
            var pieces = Standing(design, sign);
            return pieces.Any(p => p.ByHand || p.StandIn) || pieces.Count != sign.GetInt(Gallery.KeyPlaced, pieces.Count) ||
                   sign.GetVec3(Gallery.KeyNudge, Vector3.zero).sqrMagnitude > 0.0001f;
        }

        /// <summary>Saves what stands on the design's plot as p3-&lt;number&gt;-&lt;name&gt;.blueprint and lists it.</summary>
        private static string SaveStanding(DesignLibrary.Design design, ZDO sign, out string file)
        {
            var pieces = Standing(design.Name, sign);
            int number = sign.GetInt(Gallery.KeyNumber);
            if (number <= 0)
            {
                Gallery.ReadNumbers().TryGetValue(design.Name, out number);
            }

            string stem = $"p3-{number:0000}-{Stem(design.Name)}";
            int byHand = pieces.Count(p => p.ByHand);
            int standIns = pieces.Count(p => p.StandIn);
            int placed = sign.GetInt(Gallery.KeyPlaced);
            var lines = new List<string>
            {
                "#Name:" + stem,
                "#Creator:" + (design.Blueprint?.Creator ?? ""),
                $"#Description:{design.Name} as edited in the gallery {System.DateTime.Now:yyyy-MM-dd HH:mm}: {pieces.Count} pieces, " +
                $"{byHand} added by hand, {standIns} stand-in pieces (Villheim pass 3)",
                "#Category:Villheim",
                "#GroundOffset:" + (sign.GetFloat(Gallery.KeyGroundOffset, 0f) + sign.GetVec3(Gallery.KeyNudge, Vector3.zero).y)
                    .ToString("0.###", CultureInfo.InvariantCulture),
                "#Pieces",
            };
            lines.AddRange(pieces.Select(p => Line(p.Prefab, p.Position, p.Rotation, p.Scale, p.Text)));
            Directory.CreateDirectory(Gallery.PassThreeFolder);
            file = Path.Combine(Gallery.PassThreeFolder, stem + ".blueprint");
            File.WriteAllLines(file, lines);
            Manifest(number, design.Name, stem, pieces.Count, placed, byHand, standIns);
            return $"saved {file}: {pieces.Count} pieces ({byHand} added by hand, {standIns} stand-in pieces; {placed} went up at first). " +
                   "The gallery shows this save from now on.";
        }

        private static void Manifest(int number, string design, string stem, int pieces, int placed, int byHand, int standIns)
        {
            var rows = new Dictionary<string, string>();
            if (File.Exists(ManifestPath))
            {
                foreach (string line in File.ReadAllLines(ManifestPath).Skip(1))
                {
                    string[] f = line.Split(',');
                    if (f.Length > 1)
                    {
                        rows[f[1].Trim('"')] = line;
                    }
                }
            }

            rows[design] = string.Join(",", number, "\"" + design + "\"", stem, pieces, placed, byHand, standIns, System.DateTime.Now.ToString("yyyy-MM-dd HH:mm"));
            Directory.CreateDirectory(Path.GetDirectoryName(ManifestPath));
            File.WriteAllLines(ManifestPath, new[] { "Number,Design,Saved as,Pieces,Pieces at first,Added by hand,Stand-in pieces,Saved at" }
                .Concat(rows.Values.OrderBy(l => int.TryParse(l.Split(',')[0], out int n) ? n : int.MaxValue)));
        }

        private static string Line(string prefab, Vector3 position, Quaternion rotation, Vector3 scale, string text)
        {
            CultureInfo inv = CultureInfo.InvariantCulture;
            return string.Join(";", prefab, "Villheim",
                position.x.ToString("0.####", inv), position.y.ToString("0.####", inv), position.z.ToString("0.####", inv),
                rotation.x.ToString("0.######", inv), rotation.y.ToString("0.######", inv), rotation.z.ToString("0.######", inv),
                rotation.w.ToString("0.######", inv), "\"" + (text ?? "").Replace("\"", "'").Replace(";", ",") + "\"",
                scale.x.ToString("0.###", inv), scale.y.ToString("0.###", inv), scale.z.ToString("0.###", inv));
        }

        private static string Stem(string name)
        {
            string stem = name.StartsWith(Blueprints.Prefix) ? name.Substring(Blueprints.Prefix.Length) : name;
            foreach (char c in Path.GetInvalidFileNameChars())
            {
                stem = stem.Replace(c, '-');
            }

            return stem;
        }
    }
}
