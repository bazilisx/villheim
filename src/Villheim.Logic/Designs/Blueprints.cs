using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using BepInEx;
using UnityEngine;

namespace Villheim.Logic.Designs
{
    /// <summary>
    /// Building designs from blueprint files: PlanBuild's <c>.blueprint</c> and the game's own <c>.vbuild</c> format.
    /// Villheim ships no blueprints. It reads the ones in <c>BepInEx/config/Villheim/blueprints</c> (and PlanBuild's
    /// own blueprint folder, if PlanBuild is installed), so any blueprint you download or save yourself can become
    /// a village building.
    ///
    /// What a blueprint is for comes from its file name, <c>role-family-level</c> (for example
    /// <c>house-cabin-1.blueprint</c>, <c>house-cabin-2.blueprint</c>, <c>hub-hall-1.blueprint</c>), or from a
    /// "villheim:" line in its description: <c>villheim: role=house family=cabin level=2 biome=meadows</c>. Roles are
    /// hub, house, workshop and farm. Levels work like Millenaire's building levels: a village builds level 1 first
    /// and later upgrades the building to the next level of the same family. Without any of this a blueprint is a
    /// level 1 house of its own family.
    ///
    /// PlanBuild's format (from its WTFPL source): header lines starting with # (#Name:, #Creator:, #Description:,
    /// #Category:, then #SnapPoints, #Terrain, #Pieces sections); each piece line is
    /// <c>prefab;category;px;py;pz;qx;qy;qz;qw;extra;sx;sy;sz</c>, positions from the build's lowest corner and a
    /// quaternion rotation. A .vbuild line is <c>prefab qx qy qz qw px py pz</c>.
    /// </summary>
    internal static class Blueprints
    {
        internal sealed class Piece
        {
            public string Prefab;
            public Vector3 Position;
            public Quaternion Rotation;
            public Vector3 Scale = Vector3.one;
        }

        internal sealed class Blueprint
        {
            public string Name;
            public string File;
            public Role Role = Role.House;
            public string Family;
            public int Level = 1;
            public string Biome;
            public float Radius;
            public string Creator;
            public string Category;
            public readonly List<Piece> Pieces = new List<Piece>();

            /// <summary>Picked more often: designs made as sets (hut, cottage, house...) fit a growing village best.</summary>
            public float Weight = 2f;
        }

        public const string Prefix = "bp:";

        private static Dictionary<string, Blueprint> _loaded;
        private static float _loadedAt;

        public static string Folder => Path.Combine(Paths.ConfigPath, "Villheim", "blueprints");

        /// <summary>Every blueprint found, by design name ("bp:" + file name). Reread every two minutes.</summary>
        public static Dictionary<string, Blueprint> All()
        {
            if (_loaded != null && Time.realtimeSinceStartup - _loadedAt < 120f)
            {
                return _loaded;
            }

            _loadedAt = Time.realtimeSinceStartup;
            var found = new Dictionary<string, Blueprint>(StringComparer.OrdinalIgnoreCase);
            foreach (string folder in new[] { Folder, Path.Combine(Paths.ConfigPath, "PlanBuild", "blueprints"), Paths.PluginPath })
            {
                if (!Directory.Exists(folder))
                {
                    continue;
                }

                foreach (string file in Directory.GetFiles(folder, "*.*", SearchOption.AllDirectories))
                {
                    string extension = Path.GetExtension(file).ToLowerInvariant();
                    if (extension != ".blueprint" && extension != ".vbuild" || IsExcluded(file))
                    {
                        continue;
                    }

                    try
                    {
                        Blueprint blueprint = Load(file);
                        if (blueprint != null && Usable(blueprint) && !found.ContainsKey(blueprint.Name))
                        {
                            found[blueprint.Name] = blueprint;
                        }
                    }
                    catch (Exception e)
                    {
                        VillheimPlugin.Log.LogWarning($"Could not read the blueprint {file}: {e.Message}");
                    }
                }
            }

            if (_loaded == null || _loaded.Count != found.Count)
            {
                VillheimPlugin.Log.LogInfo($"Blueprints: {found.Count} found in {Folder} and PlanBuild's folder.");
            }

            _loaded = found;
            return found;
        }

        /// <summary>
        /// Never used anywhere (Tyler, 2026-11-06): the generated house designs from the BiomeBlueprints pack, all alike,
        /// named only by biome, style and size ("hs_swamp_stone_manor", "hs_mountain_stilt_cottage", "hs_meadows_hut").
        /// Builds in the pack made by people, with their own names, are kept, "hs_" or not.
        /// </summary>
        private static readonly System.Text.RegularExpressions.Regex Generated = new System.Text.RegularExpressions.Regex(
            @"^hs_((meadows|blackforest|black_forest|swamp|mountain|mountains|plains|mistlands|ashlands|deepnorth|deep_north|ocean)_)?" +
            @"((stilt|stone|wood|wooden|log|timber)_)?(hut|cottage|house|manor|villa|longhouse|long_house|great_hall|hall|cabin)(_?\d+)?$",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        private static bool IsExcluded(string file) => Generated.IsMatch(Path.GetFileNameWithoutExtension(file));

        private static readonly string[] NotForVillages = { "ruin", "hive", "pergola", "portal", "igloo", "chess", "mansion", "castle" };

        /// <summary>Buildings only: furniture and decoration sets and tiny builds are left out.</summary>
        private static bool Usable(Blueprint blueprint)
        {
            string category = (blueprint.Category ?? "").ToLowerInvariant();
            if (blueprint.Pieces.Count < 25 || category.Contains("furniture") || category.Contains("decor"))
            {
                return false;
            }

            // Community builds from a pack: no ruins, hives, follies or huge showpieces in a village.
            if (blueprint.Weight < 1f)
            {
                string name = blueprint.Name.ToLowerInvariant();
                if (blueprint.Pieces.Count > 450 || NotForVillages.Any(w => name.Contains(w)))
                {
                    return false;
                }
            }

            return true;
        }

        private static readonly Dictionary<string, (float Time, Blueprint Blueprint)> Named =
            new Dictionary<string, (float, Blueprint)>(StringComparer.OrdinalIgnoreCase);

        /// <summary>
        /// One blueprint by its file name (without extension), from the same folders, whatever its size or category:
        /// for village fixtures like the notice board ('villagenotice'). Looked up again once a minute.
        /// </summary>
        public static Blueprint ByFileName(string stem)
        {
            if (Named.TryGetValue(stem, out var cached) && Time.realtimeSinceStartup - cached.Time < 60f)
            {
                return cached.Blueprint;
            }

            Blueprint found = null;
            foreach (string folder in new[] { Folder, Path.Combine(Paths.ConfigPath, "PlanBuild", "blueprints"), Paths.PluginPath })
            {
                if (found != null || !Directory.Exists(folder))
                {
                    continue;
                }

                foreach (string file in Directory.GetFiles(folder, "*.*", SearchOption.AllDirectories))
                {
                    string extension = Path.GetExtension(file).ToLowerInvariant();
                    if ((extension == ".blueprint" || extension == ".vbuild") &&
                        string.Equals(Path.GetFileNameWithoutExtension(file), stem, StringComparison.OrdinalIgnoreCase))
                    {
                        try
                        {
                            found = Load(file);
                        }
                        catch (Exception e)
                        {
                            VillheimPlugin.Log.LogWarning($"Could not read the blueprint {file}: {e.Message}");
                        }

                        break;
                    }
                }
            }

            Named[stem] = (Time.realtimeSinceStartup, found);
            return found;
        }

        public static bool IsBlueprint(string designName) =>
            designName != null && designName.StartsWith(Prefix, StringComparison.OrdinalIgnoreCase);

        public static Blueprint Find(string designName)
        {
            return IsBlueprint(designName) && All().TryGetValue(designName, out Blueprint blueprint) ? blueprint : null;
        }

        /// <summary>The next level of the same family, or null.</summary>
        public static Blueprint NextLevel(Blueprint blueprint)
        {
            return All().Values.Where(b => b.Family == blueprint.Family && b.Role == blueprint.Role && b.Level > blueprint.Level &&
                                           b.Biome == blueprint.Biome)
                .OrderBy(b => b.Level).FirstOrDefault();
        }

        // ---------------------------------------------------------------- reading

        private static Blueprint Load(string file)
        {
            string stem = Path.GetFileNameWithoutExtension(file);
            var blueprint = new Blueprint { Name = Prefix + stem, File = file, Family = stem.ToLowerInvariant() };
            ReadName(blueprint, stem);

            bool vbuild = file.EndsWith(".vbuild", StringComparison.OrdinalIgnoreCase);
            string section = vbuild ? "#pieces" : "";
            foreach (string raw in File.ReadAllLines(file))
            {
                string line = raw.Trim();
                if (line.Length == 0)
                {
                    continue;
                }

                if (line.StartsWith("#"))
                {
                    string lower = line.ToLowerInvariant();
                    if (lower.StartsWith("#description:") || lower.StartsWith("#category:"))
                    {
                        ReadTags(blueprint, line.Substring(line.IndexOf(':') + 1));
                    }

                    if (lower.StartsWith("#creator:"))
                    {
                        blueprint.Creator = line.Substring(9).Trim();
                    }

                    if (lower.StartsWith("#category:"))
                    {
                        blueprint.Category = line.Substring(10).Trim();
                        if (blueprint.Biome == null)
                        {
                            string category = blueprint.Category.Replace(" ", "").ToLowerInvariant();
                            if (category == "meadows" || category == "blackforest")
                            {
                                blueprint.Biome = category;
                            }
                        }
                    }
                    else if (!lower.Contains(":"))
                    {
                        section = lower;
                    }

                    continue;
                }

                if (section != "#pieces")
                {
                    continue;
                }

                Piece piece = vbuild ? ParseVBuild(line) : ParseBlueprint(line);
                if (piece != null)
                {
                    blueprint.Pieces.Add(piece);
                }
            }

            Center(blueprint);
            return blueprint;
        }

        // Building sets named in levels, smallest first: a village builds the first and upgrades along the list.
        private static readonly (string Family, Role Role, string[] Levels)[] Sets =
        {
            ("stilt", Role.House, new[] { "stilt_hut", "stilt_cottage", "stilt_house" }),
            ("stone", Role.House, new[] { "stone_cottage", "stone_house", "stone_manor" }),
            ("home", Role.House, new[] { "hut", "cottage", "house", "manor", "villa" }),
            ("hall", Role.Hub, new[] { "longhouse", "great_hall" }),
        };

        /// <summary>
        /// Names like "hs_meadows_cottage" (the BiomeBlueprints pack): biome from the prefix, and the building sets
        /// above as levels. Other builds go by words in their name: hall, fort or tavern for a longhouse, shack, smithy,
        /// forge or workshop for a workshop, barn, farm or breeder for a farm, anything else a home.
        /// </summary>
        private static bool ReadPackName(Blueprint blueprint, string stem)
        {
            string lower = stem.ToLowerInvariant();
            if (!lower.StartsWith("hs_"))
            {
                return false;
            }

            string rest = lower.Substring(3);
            foreach (string biome in new[] { "meadows", "blackforest", "swamp", "mountain", "plains", "mistlands", "ashlands", "deepnorth", "ocean" })
            {
                if (rest.StartsWith(biome + "_"))
                {
                    blueprint.Biome = biome;
                    rest = rest.Substring(biome.Length + 1);
                }
            }

            foreach ((string family, Role role, string[] levels) in Sets)
            {
                int index = System.Array.IndexOf(levels, rest);
                if (index >= 0)
                {
                    blueprint.Role = role;
                    blueprint.Family = family + "-" + (blueprint.Biome ?? "any");
                    blueprint.Level = index + 1;
                    blueprint.Weight = 4f;
                    return true;
                }
            }

            blueprint.Weight = 0.5f;
            blueprint.Family = rest;
            blueprint.Level = 1;
            if (rest.Contains("hall") || rest.Contains("fort") || rest.Contains("tavern")) blueprint.Role = Role.Hub;
            else if (rest.Contains("shack") || rest.Contains("smith") || rest.Contains("forge") || rest.Contains("workshop") ||
                     rest.Contains("repair")) blueprint.Role = Role.Workshop;
            else if (rest.Contains("barn") || rest.Contains("farm") || rest.Contains("breeder")) blueprint.Role = Role.Farm;
            else if (rest.Contains("shed") || rest.Contains("storage") || rest.Contains("store")) blueprint.Role = Role.Storage;
            else blueprint.Role = Role.House;
            return true;
        }

        /// <summary>role-family-level from the file name, when it is written that way.</summary>
        private static void ReadName(Blueprint blueprint, string stem)
        {
            if (ReadPackName(blueprint, stem))
            {
                return;
            }

            string[] parts = stem.ToLowerInvariant().Split('-', '_');
            if (parts.Length >= 2 && TryRole(parts[0], out Role role))
            {
                blueprint.Role = role;
                int last = parts.Length - 1;
                if (parts.Length >= 3 && int.TryParse(parts[last], out int level))
                {
                    blueprint.Level = Mathf.Max(1, level);
                    blueprint.Family = string.Join("-", parts.Skip(1).Take(last - 1));
                }
                else
                {
                    blueprint.Family = string.Join("-", parts.Skip(1));
                }
            }
        }

        /// <summary>"villheim: role=house family=cabin level=2 biome=meadows" in the description or category.</summary>
        private static void ReadTags(Blueprint blueprint, string text)
        {
            int at = text.IndexOf("villheim:", StringComparison.OrdinalIgnoreCase);
            if (at < 0)
            {
                return;
            }

            foreach (string pair in text.Substring(at + 9).Split(new[] { ' ', ',', ';' }, StringSplitOptions.RemoveEmptyEntries))
            {
                int equals = pair.IndexOf('=');
                if (equals <= 0)
                {
                    continue;
                }

                string key = pair.Substring(0, equals).Trim().ToLowerInvariant();
                string value = pair.Substring(equals + 1).Trim().ToLowerInvariant();
                switch (key)
                {
                    case "role":
                        if (TryRole(value, out Role role)) blueprint.Role = role;
                        break;
                    case "family":
                        blueprint.Family = value;
                        break;
                    case "level":
                        if (int.TryParse(value, out int level)) blueprint.Level = Mathf.Max(1, level);
                        break;
                    case "biome":
                        blueprint.Biome = value;
                        break;
                }
            }
        }

        private static bool TryRole(string text, out Role role)
        {
            switch (text)
            {
                case "hub": case "hall": case "longhouse": role = Role.Hub; return true;
                case "house": case "home": case "hut": case "cabin": role = Role.House; return true;
                case "workshop": case "forge": case "smithy": role = Role.Workshop; return true;
                case "farm": case "barn": role = Role.Farm; return true;
                case "storage": case "store": case "storehouse": case "shed": role = Role.Storage; return true;
                default: role = Role.House; return false;
            }
        }

        private static Piece ParseBlueprint(string line)
        {
            string[] f = line.Split(';');
            if (f.Length < 9)
            {
                return null;
            }

            var piece = new Piece
            {
                Prefab = f[0].Trim(),
                Position = new Vector3(F(f[2]), F(f[3]), F(f[4])),
                Rotation = new Quaternion(F(f[5]), F(f[6]), F(f[7]), F(f[8])),
            };

            if (f.Length >= 13)
            {
                var scale = new Vector3(F(f[10]), F(f[11]), F(f[12]));
                if (scale.x > 0f && scale.y > 0f && scale.z > 0f)
                {
                    piece.Scale = scale;
                }
            }

            return piece;
        }

        private static Piece ParseVBuild(string line)
        {
            string[] f = line.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
            if (f.Length < 8)
            {
                return null;
            }

            return new Piece
            {
                Prefab = f[0].Trim(),
                Rotation = new Quaternion(F(f[1]), F(f[2]), F(f[3]), F(f[4])),
                Position = new Vector3(F(f[5]), F(f[6]), F(f[7])),
            };
        }

        /// <summary>Moves the pieces so the middle of the build is at x = z = 0 and its lowest piece at y = 0.</summary>
        private static void Center(Blueprint blueprint)
        {
            if (blueprint.Pieces.Count == 0)
            {
                return;
            }

            float minX = blueprint.Pieces.Min(p => p.Position.x);
            float maxX = blueprint.Pieces.Max(p => p.Position.x);
            float minZ = blueprint.Pieces.Min(p => p.Position.z);
            float maxZ = blueprint.Pieces.Max(p => p.Position.z);
            float minY = blueprint.Pieces.Min(p => p.Position.y);
            var offset = new Vector3((minX + maxX) * 0.5f, minY, (minZ + maxZ) * 0.5f);
            float radius = 0f;
            foreach (Piece piece in blueprint.Pieces)
            {
                piece.Position -= offset;
                piece.Rotation = Normalize(piece.Rotation);
                radius = Mathf.Max(radius, new Vector2(piece.Position.x, piece.Position.z).magnitude);
            }

            blueprint.Radius = Mathf.Max(4f, radius + 2f);
        }

        private static Quaternion Normalize(Quaternion q)
        {
            float length = Mathf.Sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
            return length > 0.0001f ? new Quaternion(q.x / length, q.y / length, q.z / length, q.w / length) : Quaternion.identity;
        }

        private static float F(string text) =>
            float.TryParse(text.Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out float value) ? value : 0f;

        // ---------------------------------------------------------------- plans and costs

        /// <summary>The blueprint's pieces as a build plan, in the same order rules as a copied location.</summary>
        public static List<DesignSpawner.PlanEntry> MakePlan(Blueprint blueprint, Vector3 origin, float yaw)
        {
            var plan = new List<DesignSpawner.PlanEntry>();
            foreach (Piece piece in blueprint.Pieces)
            {
                DesignSpawner.PlanEntry entry = DesignSpawner.Entry(piece.Prefab, piece.Position, piece.Rotation, piece.Scale);
                if (entry != null)
                {
                    plan.Add(entry);
                }
            }

            return DesignSpawner.Order(plan, origin, yaw);
        }

        private static readonly Dictionary<string, Dictionary<string, int>> Totals = new Dictionary<string, Dictionary<string, int>>();

        /// <summary>Tracked materials from every piece's vanilla recipe, before scaling.</summary>
        public static Dictionary<string, int> RawTotals(Blueprint blueprint)
        {
            if (Totals.TryGetValue(blueprint.Name, out Dictionary<string, int> cached))
            {
                return cached;
            }

            var totals = new Dictionary<string, int>();
            if (ZNetScene.instance != null)
            {
                foreach (Piece piece in blueprint.Pieces)
                {
                    GameObject prefab = ZNetScene.instance.GetPrefab(piece.Prefab);
                    if (prefab == null || DesignSpawner.ExclusionReason(prefab, piece.Prefab) != null)
                    {
                        continue;
                    }

                    foreach (KeyValuePair<string, int> cost in DesignSpawner.RecipeCost(prefab))
                    {
                        totals.TryGetValue(cost.Key, out int amount);
                        totals[cost.Key] = amount + cost.Value;
                    }
                }
            }

            Totals[blueprint.Name] = totals;
            return totals;
        }
    }
}
