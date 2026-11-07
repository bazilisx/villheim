using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Designs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// 'vh bp save &lt;number|name&gt;': saves a copy of a design with the stand-ins chosen for it in the gallery
    /// ('vh swap'). 'vh bp swap &lt;number|name&gt; &lt;stage&gt;': saves a copy with every later building piece swapped by
    /// the rules of MaterialSwap. The original is never changed. Copies go to the inspiration/edits folder of
    /// Villheim's blueprints, so the gallery and PlanBuild show them and villages do not build them.
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
            int changed = 0;
            string suffix;
            string description;
            Change change;
            var result = new MaterialSwap.Result();
            if (save)
            {
                Dictionary<string, (string Prefab, float Turn)> choices = SwapTool.ChoicesFor(design.Name);
                if (choices.Count == 0)
                {
                    return $"Villheim: no stand-ins chosen for {design.Name} yet ('vh swap' in the gallery).";
                }

                suffix = "_edited";
                description = $"{design.Name} with {choices.Count} stand-ins chosen in the gallery (Villheim)";
                change = (prefab, position, rotation) =>
                {
                    var chosen = SwapTool.Chosen(design.Name, prefab, position, rotation);
                    if (chosen == null)
                    {
                        return new List<(string, Vector3, Quaternion)> { (prefab, position, rotation) };
                    }

                    changed++;
                    return chosen;
                };
            }
            else
            {
                int target = Gallery.StageIndexOf(args[2]);
                suffix = "_as_" + Gallery.StageWords[target];
                description = $"{design.Name} in {Gallery.StageNames[target]} materials (Villheim material swap)";
                change = (prefab, position, rotation) =>
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
            }

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
            string summary = save ? $"{changed} pieces changed" : result.Summary(Gallery.StageIndexOf(args[2]));
            return $"Villheim: saved {file}: {summary}. 'vh gallery show {stem}' lays it out.";
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
