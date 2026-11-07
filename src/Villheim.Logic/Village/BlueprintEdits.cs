using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Designs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// 'vh bp swap &lt;number|name&gt; &lt;stage&gt;': saves a copy of a design with its building pieces swapped for the
    /// target stage's (see MaterialSwap). The original is never changed. Copies go to the inspiration/edits folder of
    /// Villheim's blueprints, so the gallery and PlanBuild show them and villages do not build them.
    /// </summary>
    internal static class BlueprintEdits
    {
        public const string Usage =
            "vh bp swap <number|name> <meadows|blackforest|swamp|mountain|plains|mistlands|ashlands>: saves a copy of the " +
            "design in that stage's materials (number from design-list.csv); 'vh gallery show <new name>' shows it.";

        public static string EditsFolder => Path.Combine(Blueprints.Folder, "inspiration", "edits");

        public static string Run(string[] args)
        {
            if (args.Length < 3 || args[0].ToLowerInvariant() != "swap" || Gallery.StageIndexOf(args[2]) < 0)
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
            int target = Gallery.StageIndexOf(args[2]);
            var result = new MaterialSwap.Result();
            var lines = new List<string>
            {
                "#Name:" + Stem(design.Name) + "_as_" + Gallery.StageWords[target],
                "#Creator:" + (design.Blueprint?.Creator ?? "") ,
                $"#Description:{design.Name} in {Gallery.StageNames[target]} materials (Villheim material swap)",
                "#Category:Villheim",
                "#Pieces",
            };

            if (design.Blueprint != null)
            {
                foreach (Blueprints.Piece piece in design.Blueprint.Pieces)
                {
                    lines.Add(Line(piece.Prefab, piece.Position, piece.Rotation, piece.Scale, piece.Text, target, result));
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
                        lines.Add(Line(entry.Prefab, entry.LocalPosition, entry.LocalRotation, entry.Scale, null, target, result));
                    }
                }
                finally
                {
                    location.m_prefab.Release();
                }
            }

            Directory.CreateDirectory(EditsFolder);
            string stem = Stem(design.Name) + "_as_" + Gallery.StageWords[target];
            string file = Path.Combine(EditsFolder, stem + ".blueprint");
            File.WriteAllLines(file, lines);
            return $"Villheim: saved {file}: {result.Summary(target)}. 'vh gallery show {stem}' lays it out.";
        }

        private static string Line(string prefab, Vector3 position, Quaternion rotation, Vector3 scale, string text, int target, MaterialSwap.Result result)
        {
            if (MaterialSwap.Swappable(prefab) && MaterialSwap.TrySwap(prefab, target, out string swap, out Vector3 shift, out Quaternion turn))
            {
                position += rotation * shift;
                rotation *= turn;
                prefab = swap;
                result.Swapped++;
            }
            else
            {
                MaterialSwap.Note(prefab, target, result);
            }

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
