using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Designs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Shows a design as a village of an earlier stage could build it: every building piece (wall, floor, roof, beam,
    /// pole, fence, door, window...) unlocked after the target stage is swapped for one the target stage has, that stage
    /// or any before it. Pieces from the target stage or earlier stay as they are: nothing is ever swapped up. Pieces no
    /// player can build (goblin and dvergr fences in locations) count as later than every stage, so they always go.
    ///
    /// The stand-in, in order of preference: a hand-made pairing (<see cref="Pairs"/>); the same kind in the name and
    /// the same size as the game measures it (its colliders), either way round; the same kind, nearest size; a related
    /// kind (fence, stakes and palisade; beam, pole and pillar; door and gate), same size, then nearest size. "near" on
    /// the sign counts the nearest-size ones. Within a choice the newest stage allowed wins. The new piece goes where
    /// the old one's middle was, so pieces whose pivots differ still line up. Anything with no stand-in stays and is
    /// listed in swap-misses-&lt;stage&gt;.txt. Decoration and furniture are never swapped.
    /// </summary>
    internal static class MaterialSwap
    {
        private static readonly string[] Kinds =
        {
            "roof", "wall", "floor", "beam", "pole", "stair", "arch", "window", "door", "gate", "pillar", "column",
            "fence", "stake", "rail", "ladder", "palisade", "shutter",
        };

        /// <summary>Kinds that can stand in for each other when the target stage has nothing of the same kind.</summary>
        private static readonly Dictionary<string, string> Family = new Dictionary<string, string>
        {
            ["fence"] = "barrier", ["stake"] = "barrier", ["palisade"] = "barrier", ["rail"] = "barrier",
            ["wall"] = "wall", ["shutter"] = "wall",
            ["beam"] = "support", ["pole"] = "support", ["pillar"] = "support", ["column"] = "support",
            ["door"] = "door", ["gate"] = "door",
            ["roof"] = "roof", ["floor"] = "floor", ["stair"] = "stair", ["arch"] = "arch", ["window"] = "window", ["ladder"] = "ladder",
        };

        /// <summary>
        /// Hidden pieces whose name says one kind but which stand in the world as another (Tyler, from PotteryBarn's list
        /// of location pieces): the goblin wood walls are fences.
        /// </summary>
        private static readonly Dictionary<string, string> KindOverride = new Dictionary<string, string>
        {
            ["goblin_woodwall_1m"] = "fence",
            ["goblin_woodwall_2m"] = "fence",
            ["goblin_woodwall_2m_ribs"] = "fence",
        };

        /// <summary>A stage after every real one: pieces no player can build.</summary>
        private const int Never = 99;

        private static readonly HashSet<string> Modifiers = new HashSet<string>
        {
            "top", "ocorner", "icorner", "corner", "upsidedown", "half", "quarter", "small", "medium", "large", "triangle",
            "tip", "end", "inverted", "narrow", "curved", "cross",
        };

        /// <summary>
        /// Hand-made pairings: source piece to the piece to use from a stage on (stage index, see Gallery.StageNames),
        /// and a quarter turn if it needs one. Made in game with 'vh swap' and kept in BepInEx/Villheim/swap-pairs.txt
        /// (original|stage|replacement|turn); a pairing for a stage also holds for the stages after it.
        /// </summary>
        private static readonly Dictionary<string, Dictionary<int, (string Prefab, float Turn)>> Pairs =
            new Dictionary<string, Dictionary<int, (string, float)>>();

        private static System.DateTime _pairsRead;

        public static string PairsPath => Path.Combine(BepInEx.Paths.BepInExRootPath, "Villheim", "swap-pairs.txt");

        private static void LoadPairs()
        {
            try
            {
                System.DateTime written = File.Exists(PairsPath) ? File.GetLastWriteTimeUtc(PairsPath) : System.DateTime.MinValue;
                if (written == _pairsRead)
                {
                    return;
                }

                _pairsRead = written;
                Pairs.Clear();
                Cache.Clear();
                if (!File.Exists(PairsPath))
                {
                    return;
                }

                foreach (string line in File.ReadAllLines(PairsPath))
                {
                    string[] f = line.Split('|');
                    if (line.StartsWith("#") || f.Length < 3 || !int.TryParse(f[1], out int stage))
                    {
                        continue;
                    }

                    float turn = f.Length > 3 && float.TryParse(f[3], NumberStyles.Float, CultureInfo.InvariantCulture, out float t) ? t : 0f;
                    if (!Pairs.TryGetValue(f[0], out var byStage))
                    {
                        byStage = new Dictionary<int, (string, float)>();
                        Pairs[f[0]] = byStage;
                    }

                    byStage[stage] = (f[2], turn);
                }
            }
            catch (System.Exception e)
            {
                VillheimPlugin.Log.LogWarning($"Material swap: could not read {PairsPath}: {e.Message}");
            }
        }

        /// <summary>Saves a hand pairing (and forgets earlier choices for that piece).</summary>
        public static void SetPair(string original, int stage, string replacement, float turn)
        {
            LoadPairs();
            if (!Pairs.TryGetValue(original, out var byStage))
            {
                byStage = new Dictionary<int, (string, float)>();
                Pairs[original] = byStage;
            }

            byStage[stage] = (replacement, turn);
            var lines = new List<string> { "# Hand pairings made with 'vh swap': original|stage|replacement|quarter turn in degrees. Stages: 0 Meadows, 1 Black Forest, 2 Swamp, 3 Mountain, 4 Plains." };
            lines.AddRange(Pairs.OrderBy(k => k.Key).SelectMany(k => k.Value.OrderBy(v => v.Key)
                .Select(v => $"{k.Key}|{v.Key}|{v.Value.Prefab}|{v.Value.Turn.ToString("0", CultureInfo.InvariantCulture)}")));
            Directory.CreateDirectory(Path.GetDirectoryName(PairsPath));
            File.WriteAllLines(PairsPath, lines);
            _pairsRead = File.GetLastWriteTimeUtc(PairsPath);
            foreach (string key in Cache.Keys.Where(k => k.StartsWith(original + "|")).ToList())
            {
                Cache.Remove(key);
            }
        }

        /// <summary>The hand pairing that holds for this stage: the one made for it, or for the nearest stage before it.</summary>
        private static (string Prefab, float Turn)? PairFor(string prefab, int target)
        {
            LoadPairs();
            if (!Pairs.TryGetValue(prefab, out var byStage))
            {
                return null;
            }

            int best = byStage.Keys.Where(k => k <= target).DefaultIfEmpty(-1).Max();
            return best >= 0 ? byStage[best] : ((string, float)?)null;
        }

        /// <summary>The middle of a piece in its own coordinates (its colliders), or zero.</summary>
        public static Vector3 LocalCenter(string prefab) => Measure(prefab)?.Center ?? Vector3.zero;

        /// <summary>The size of a piece (its colliders), or one metre each way.</summary>
        public static Vector3 SizeOf(string prefab) => Measure(prefab)?.Size ?? Vector3.one;

        /// <summary>
        /// Likely stand-ins for a piece from one stage (exactly that stage; or that stage and before when
        /// <paramref name="orEarlier"/>): same kind first, then related kinds, then anything, nearest size first.
        /// </summary>
        public static List<string> Candidates(string prefab, int target, int count, bool orEarlier = true)
        {
            Shape source = Measure(prefab);
            if (source == null)
            {
                return new List<string>();
            }

            return Pool().Where(c => c.Prefab != prefab && (orEarlier ? c.Stage <= target : c.Stage == target))
                .OrderBy(c => c.KindKey.Length > 0 && c.KindKey == source.KindKey ? 0 : c.Families.Overlaps(source.Families) ? 1 : 2)
                .ThenBy(c => Mathf.Min(Distance(source.Size, c.Size), Distance(source.Size, Turned(c.Size))))
                .Select(c => c.Prefab).Distinct().Take(count).ToList();
        }

        private sealed class Shape
        {
            public string Prefab;
            public int Stage;
            public Vector3 Size;
            public Vector3 Center;
            public string KindKey;
            public HashSet<string> Families;
            public HashSet<string> Mods;
        }

        private sealed class Choice
        {
            public string Prefab;
            public Vector3 Shift;
            public Quaternion Turn;
            public bool Near;
        }

        private static List<Shape> _pool;
        private static readonly Dictionary<string, Shape> ShapeOf = new Dictionary<string, Shape>();
        private static readonly Dictionary<string, Choice> Cache = new Dictionary<string, Choice>();

        /// <summary>Pieces left as they were on the last gallery page, by target stage: prefab and how many.</summary>
        private static readonly Dictionary<int, Dictionary<string, int>> Misses = new Dictionary<int, Dictionary<string, int>>();

        /// <summary>How a design changed: pieces swapped exactly, swapped for the nearest size, and later pieces kept.</summary>
        internal sealed class Result
        {
            public int Swapped;
            public int Near;
            public int Kept;
            public readonly Dictionary<string, int> Unmatched = new Dictionary<string, int>();

            public string Summary(int target) =>
                $"{Swapped} swapped" + (Near > 0 ? $" ({Near} nearest size)" : "") + (Kept > 0
                    ? $", {Kept} later pieces kept (no {Gallery.StageNames[target]} match: " +
                      string.Join(", ", Unmatched.OrderByDescending(k => k.Value).Take(3).Select(k => k.Key)) + ")"
                    : "");
        }

        /// <summary>Forgets the misses of the last page (a new page is starting).</summary>
        public static void ClearMisses() => Misses.Clear();

        /// <summary>
        /// The piece to put instead of <paramref name="prefab"/> for the target stage, and how to place it: new position
        /// = old position + old rotation * shift; new rotation = old rotation * turn. False when it stays as it is.
        /// </summary>
        public static bool TrySwap(string prefab, int target, out string swap, out Vector3 shift, out Quaternion turn) =>
            TrySwap(prefab, target, out swap, out shift, out turn, out _);

        public static bool TrySwap(string prefab, int target, out string swap, out Vector3 shift, out Quaternion turn, out bool near)
        {
            swap = null;
            shift = Vector3.zero;
            turn = Quaternion.identity;
            near = false;
            string key = prefab + "|" + target;
            if (!Cache.TryGetValue(key, out Choice found))
            {
                found = Find(prefab, target);
                Cache[key] = found;
            }

            if (found == null)
            {
                return false;
            }

            swap = found.Prefab;
            shift = found.Shift;
            turn = found.Turn;
            near = found.Near;
            return true;
        }

        /// <summary>A gallery plan in the target stage's materials.</summary>
        public static List<DesignSpawner.PlanEntry> Apply(List<DesignSpawner.PlanEntry> plan, int target, Result result)
        {
            var output = new List<DesignSpawner.PlanEntry>(plan.Count);
            foreach (DesignSpawner.PlanEntry entry in plan)
            {
                if (Swappable(entry.Prefab) && TrySwap(entry.Prefab, target, out string swap, out Vector3 shift, out Quaternion turn, out bool near))
                {
                    DesignSpawner.PlanEntry swapped = DesignSpawner.Entry(swap, entry.LocalPosition + entry.LocalRotation * shift,
                        entry.LocalRotation * turn, entry.Scale);
                    if (swapped != null)
                    {
                        swapped.SwappedFrom = entry.Prefab;
                        swapped.OriginalRotation = entry.LocalRotation;
                        swapped.OriginalCenter = entry.LocalPosition + entry.LocalRotation * LocalCenter(entry.Prefab);
                        output.Add(swapped);
                        result.Swapped++;
                        if (near)
                        {
                            result.Near++;
                        }

                        continue;
                    }
                }

                Note(entry.Prefab, target, result);
                output.Add(entry);
            }

            return output;
        }

        /// <summary>
        /// A piece the swap looks at: a building piece a player can build, or a piece no player can build that is
        /// part of a structure (it wears and breaks) and has a building kind in its name (goblin and dvergr fences).
        /// </summary>
        public static bool Swappable(string prefab)
        {
            if (Gallery.IsBuildingPiece(prefab))
            {
                return true;
            }

            // Hidden location pieces (dvergrprops_wood_wall, goblin_fence...): no recipe and often no Piece at all, but
            // part of a structure (they wear and break) and named for a building kind.
            GameObject go = ZNetScene.instance.GetPrefab(prefab);
            if (go == null || Gallery.IsBuildable(prefab) ||
                go.GetComponent<WearNTear>() == null && go.GetComponent<Destructible>() == null ||
                go.GetComponent<Character>() != null || go.GetComponent<Fireplace>() != null || go.GetComponent<Container>() != null ||
                go.GetComponentInChildren<Light>(true) != null)
            {
                return false;
            }

            Shape shape = Measure(prefab);
            return shape != null && shape.KindKey.Length > 0;
        }

        /// <summary>
        /// The stage a piece belongs to for swapping: <see cref="Never"/> when no player can build it. A piece made with
        /// stone counts as Swamp at the earliest (D-012: Meadows and Black Forest build in wood), so a design shown as a
        /// Meadows or Black Forest one has its stone swapped for wood.
        /// </summary>
        private static int StageOf(string prefab)
        {
            if (!Gallery.IsBuildable(prefab))
            {
                return Never;
            }

            int stage = Gallery.StageOfPiece(prefab);
            return UsesStone(prefab) ? Mathf.Max(stage, StoneStage) : stage;
        }

        /// <summary>The first stage stone pieces belong to (Gallery.StageNames: 2 is the Swamp).</summary>
        private const int StoneStage = 2;

        private static readonly Dictionary<string, bool> StoneCache = new Dictionary<string, bool>();

        private static bool UsesStone(string prefab)
        {
            if (StoneCache.TryGetValue(prefab, out bool stone))
            {
                return stone;
            }

            GameObject go = ZNetScene.instance != null ? ZNetScene.instance.GetPrefab(prefab) : null;
            stone = go != null && DesignSpawner.RecipeCost(go).TryGetValue(Materials.Stone, out int n) && n > 0;
            if (go != null)
            {
                StoneCache[prefab] = stone;
            }

            return stone;
        }

        private static readonly System.Text.RegularExpressions.Regex SizeInName =
            new System.Text.RegularExpressions.Regex(@"(^|_)\d+x\d+(x\d+)?($|_)");

        /// <summary>Families that may stand in for each other on the stand-in row (a fence for a wall, a pole for a beam).</summary>
        private static readonly Dictionary<string, string[]> Relatives = new Dictionary<string, string[]>
        {
            ["wall"] = new[] { "wall", "barrier" }, ["barrier"] = new[] { "barrier", "wall" }, ["support"] = new[] { "support" },
            ["door"] = new[] { "door" }, ["roof"] = new[] { "roof" }, ["floor"] = new[] { "floor" }, ["stair"] = new[] { "stair", "ladder" },
            ["arch"] = new[] { "arch" }, ["window"] = new[] { "window", "wall" }, ["ladder"] = new[] { "ladder", "stair" },
        };

        /// <summary>Name parts that make a different shape: a piece with one of these the original lacks is never offered.</summary>
        private static readonly HashSet<string> ShapeMods = new HashSet<string>
        {
            "top", "ocorner", "icorner", "corner", "upsidedown", "triangle", "tip", "end", "inverted", "curved", "cross", "half", "quarter",
        };

        private static HashSet<string> RelatedFamilies(Shape shape) =>
            new HashSet<string>(shape.Families.SelectMany(f => Relatives.TryGetValue(f, out string[] r) ? r : new[] { f }));

        /// <summary>Name parts for pieces you see through or that are not solid: offered only for a piece that has one too.</summary>
        private static readonly string[] OpenWords = { "grate", "bars", "cage", "iron_wall", "window", "shutter", "railing", "lattice" };

        /// <summary>
        /// A different shape from the original: a corner, top, half and so on it lacks, a slope angle in its name (26, 45)
        /// it lacks, or bars and grates for a solid piece.
        /// </summary>
        private static bool OtherShape(Shape source, Shape candidate)
        {
            if (candidate.Mods.Any(m => (ShapeMods.Contains(m) || IsAngle(m)) && !source.Mods.Contains(m)))
            {
                return true;
            }

            string from = source.Prefab.ToLowerInvariant(), to = candidate.Prefab.ToLowerInvariant();
            return OpenWords.Any(w => to.Contains(w) && !from.Contains(w));
        }

        private static bool IsAngle(string token) => int.TryParse(token, out int n) && n >= 10 && n <= 90;

        /// <summary>
        /// Every kind in the candidate's name may stand in for the original (a sloped "wall roof" is a roof too, so it is
        /// no stand-in for a wall), and at least one does.
        /// </summary>
        private static bool Fits(HashSet<string> related, Shape candidate) =>
            candidate.Families.Count > 0 && candidate.Families.All(related.Contains);

        /// <summary>The material a piece is made of, from its name's first part (wood, darkwood, stone, goblin, dvergr...).</summary>
        private static string Material(string prefab)
        {
            string lower = prefab.ToLowerInvariant();
            if (lower.StartsWith("piece_"))
            {
                lower = lower.Substring(6);
            }

            int cut = lower.IndexOf('_');
            string first = cut > 0 ? lower.Substring(0, cut) : lower;
            return first.Contains("wood") && first != "darkwood" && first != "ashwood" && first != "yggdrasil" ? "wood" : first;
        }

        /// <summary>The source's thinnest side (0 x, 1 y, 2 z): its thickness, left out when sizes are compared.</summary>
        private static int Thin(Vector3 size) => size.x <= size.y && size.x <= size.z ? 0 : size.y <= size.z ? 1 : 2;

        /// <summary>How far a size is from the source's, as a share, over the sides that are not the source's thickness.</summary>
        private static float Misfit(Vector3 source, Vector3 size)
        {
            int thin = Thin(source);
            float error = 0f;
            for (int i = 0; i < 3; i++)
            {
                if (i != thin)
                {
                    error += Mathf.Abs(source[i] - size[i]) / Mathf.Max(0.05f, Mathf.Max(source[i], size[i]));
                }
            }

            return error;
        }

        /// <summary>
        /// Single stand-ins for the swap row, from one stage: pieces of the same kind or a related one (walls and
        /// fences, beams, poles and pillars, doors and gates) whose size matches, either way round, leaving out the
        /// thickness; never a corner, top, half or other shape the original is not. Exact sizes first, then the same
        /// kind, then name parts in common; nothing more than a quarter off in size.
        /// </summary>
        public static List<string> StandIns(string prefab, int stage, int count)
        {
            Shape source = Measure(prefab);
            if (source == null || source.KindKey.Length == 0)
            {
                return Candidates(prefab, stage, count, orEarlier: false);
            }

            HashSet<string> related = RelatedFamilies(source);
            int thin = Thin(source.Size);
            float maxThick = Mathf.Max(1.2f, source.Size[thin] * 4f);
            return Pool()
                .Where(c => c.Prefab != prefab && c.Stage == stage && Fits(related, c) && !OtherShape(source, c))
                .Select(c =>
                {
                    // The better way round, and only if the stand-in is not far thicker than the original.
                    float straight = Misfit(source.Size, c.Size), turned = Misfit(source.Size, Turned(c.Size));
                    Vector3 size = turned < straight ? Turned(c.Size) : c.Size;
                    return (Shape: c, Misfit: size[thin] <= maxThick ? Mathf.Min(straight, turned) : float.MaxValue);
                })
                .Where(x => x.Misfit <= 0.25f)
                .OrderBy(x => x.Misfit <= 0.06f ? 0 : 1)
                .ThenBy(x => x.Shape.KindKey == source.KindKey ? 0 : x.Shape.Families.Overlaps(source.Families) ? 1 : 2)
                .ThenBy(x => Material(x.Shape.Prefab) == Material(prefab) ? 0 : 1)
                .ThenByDescending(x => Mods(source, x.Shape))
                .ThenBy(x => x.Misfit)
                .Select(x => x.Shape.Prefab).Distinct().Take(count).ToList();
        }

        /// <summary>Turns a combination piece may take: as it is, a quarter turn about up; supports also lie down.</summary>
        private static IEnumerable<Quaternion> Orientations(bool support)
        {
            yield return Quaternion.identity;
            yield return Quaternion.Euler(0f, 90f, 0f);
            if (support)
            {
                yield return Quaternion.Euler(0f, 0f, 90f);
                yield return Quaternion.Euler(90f, 0f, 0f);
                yield return Quaternion.Euler(0f, 90f, 0f) * Quaternion.Euler(0f, 0f, 90f);
            }
        }

        private static Vector3 Abs(Vector3 v) => new Vector3(Mathf.Abs(v.x), Mathf.Abs(v.y), Mathf.Abs(v.z));

        /// <summary>
        /// Combinations of one smaller piece that make up the piece's size, from one stage, found from the pieces'
        /// measured sizes (not only names with "2x2"): two stone_wall_2x1 stacked for a 2x2 wall, two 2 m beams end to end
        /// for a 4 m beam, two 2 m poles laid down for it, four 1x1. The same kind or a related one, 2 to 8 pieces, each
        /// side within a few centimetres (the thickness may differ), no other shapes. Each is a group stand-in
        /// ("group[prefab@x,y,z,qx,qy,qz,qw;...]", relative to the piece's middle and turn), best fit first.
        /// </summary>
        public static List<string> Combos(string prefab, int stage, int count)
        {
            var found = new List<(string Text, int Pieces, float Error, bool SameKind)>();
            Shape source = Measure(prefab);
            if (source == null || source.KindKey.Length == 0)
            {
                return new List<string>();
            }

            // Roofs, stairs, doors, windows and arches do not add up from smaller pieces (stacked roofs make no roof).
            bool support = source.Families.Contains("support");
            if (!source.Families.Overlaps(new[] { "wall", "barrier", "floor", "support" }))
            {
                return new List<string>();
            }

            HashSet<string> related = RelatedFamilies(source);
            int thin = Thin(source.Size);
            int longest = source.Size.x >= source.Size.y && source.Size.x >= source.Size.z ? 0 : source.Size.y >= source.Size.z ? 1 : 2;
            float maxThick = Mathf.Max(0.6f, source.Size[thin] * 3f);
            CultureInfo inv = CultureInfo.InvariantCulture;
            string Num(float v) => v.ToString("0.####", inv);
            foreach (Shape c in Pool().Where(c => c.Stage == stage && c.Prefab != prefab && Fits(related, c) && !OtherShape(source, c)))
            {
                foreach (Quaternion turn in Orientations(support && c.Families.Contains("support")))
                {
                    Vector3 size = Abs(turn * c.Size);
                    // The pieces lie the way the original does: a wall's thickness on the wall's thickness (else thin walls
                    // stood side by side make a thick block), a beam's length along the beam's length.
                    int ownThin = Thin(size);
                    int ownLong = size.x >= size.y && size.x >= size.z ? 0 : size.y >= size.z ? 1 : 2;
                    if (support ? ownLong != longest : ownThin != thin || size[thin] > maxThick)
                    {
                        continue;
                    }

                    var n = new int[3];
                    bool fits = true;
                    float error = 0f;
                    for (int i = 0; i < 3; i++)
                    {
                        if (i == thin)
                        {
                            n[i] = 1;
                            continue;
                        }

                        n[i] = Mathf.Max(1, Mathf.RoundToInt(source.Size[i] / Mathf.Max(0.01f, size[i])));
                        float off = Mathf.Abs(n[i] * size[i] - source.Size[i]);
                        fits &= off <= 0.2f + 0.08f * source.Size[i];
                        error += off;
                    }

                    int total = n[0] * n[1] * n[2];
                    if (!fits || total < 2 || total > 8)
                    {
                        continue;
                    }

                    var parts = new List<string>();
                    for (int i = 0; i < n[0]; i++)
                    for (int j = 0; j < n[1]; j++)
                    for (int k = 0; k < n[2]; k++)
                    {
                        var tile = new Vector3((i - (n[0] - 1) / 2f) * size.x, (j - (n[1] - 1) / 2f) * size.y, (k - (n[2] - 1) / 2f) * size.z);
                        Vector3 pivot = tile - turn * c.Center;
                        parts.Add($"{c.Prefab}@{Num(pivot.x)},{Num(pivot.y)},{Num(pivot.z)},{Num(turn.x)},{Num(turn.y)},{Num(turn.z)},{Num(turn.w)}");
                    }

                    found.Add(("group[" + string.Join(";", parts) + "]", total, error, c.KindKey == source.KindKey));
                    break;
                }
            }

            return found.OrderBy(f => f.SameKind ? 0 : 1).ThenBy(f => f.Error).ThenBy(f => f.Pieces)
                .Select(f => f.Text).Distinct().Take(count).ToList();
        }

        /// <summary>For 'vh look': what the piece is to the swap, and what it becomes in each stage up to Plains.</summary>
        public static string Describe(string prefab)
        {
            Shape shape = Measure(prefab);
            CultureInfo inv = CultureInfo.InvariantCulture;
            string size = shape == null ? "size unknown" :
                $"{shape.Size.x.ToString("0.0", inv)} x {shape.Size.y.ToString("0.0", inv)} x {shape.Size.z.ToString("0.0", inv)} m";
            int stage = StageOf(prefab);
            string text = $"{prefab}: {(shape != null && shape.KindKey.Length > 0 ? shape.KindKey : "no building kind")}, {size}, " +
                          (stage == Never ? "no player can build it" : Gallery.StageNames[stage]) +
                          (Swappable(prefab) ? "" : ", not swapped (decoration or not a building piece)");
            if (Swappable(prefab) && stage > 0)
            {
                var swaps = new List<string>();
                for (int target = 0; target < Mathf.Min(stage, 5); target++)
                {
                    swaps.Add(TrySwap(prefab, target, out string swap, out _, out _, out bool near)
                        ? $"{Gallery.StageWords[target]}: {swap}{(near ? " (near)" : "")}"
                        : $"{Gallery.StageWords[target]}: none");
                }

                text += ". As " + string.Join("; ", swaps);
            }

            return text;
        }

        /// <summary>Counts a piece that stays although it is from a later stage than the target.</summary>
        public static void Note(string prefab, int target, Result result)
        {
            bool swappable = Swappable(prefab);
            if (swappable)
            {
                if (StageOf(prefab) <= target)
                {
                    return;
                }

                result.Kept++;
                result.Unmatched.TryGetValue(prefab, out int n);
                result.Unmatched[prefab] = n + 1;
            }
            else
            {
                // Decoration and the like are not swapped, but later ones are listed, in case one is a building piece
                // under an unusual name.
                GameObject go = ZNetScene.instance.GetPrefab(prefab);
                if (go == null || go.GetComponent<Piece>() == null || StageOf(prefab) <= target)
                {
                    return;
                }
            }

            if (!Misses.TryGetValue(target, out Dictionary<string, int> misses))
            {
                misses = new Dictionary<string, int>();
                Misses[target] = misses;
            }

            misses.TryGetValue(prefab, out int m);
            misses[prefab] = m + 1;
        }

        /// <summary>
        /// BepInEx/Villheim/swap-misses-&lt;stage&gt;.txt: every later-stage piece the last page left as it was, with its
        /// kind and size and the nearest pieces the target stage has, to make hand pairings from. Returns the paths.
        /// </summary>
        public static List<string> WriteMisses()
        {
            var paths = new List<string>();
            CultureInfo inv = CultureInfo.InvariantCulture;
            string Size(Vector3 v) => $"{v.x.ToString("0.00", inv)} x {v.y.ToString("0.00", inv)} x {v.z.ToString("0.00", inv)}";
            foreach (KeyValuePair<int, Dictionary<string, int>> stage in Misses)
            {
                var lines = new List<string>
                {
                    $"# Pieces left as they were when shown as {Gallery.StageNames[stage.Key]}: piece, count, kind, size (m), stage.",
                    "# Below each, the nearest pieces that stage has (same kind first). Send this file back to pair them by hand.",
                };

                foreach (KeyValuePair<string, int> miss in stage.Value.OrderByDescending(k => k.Value))
                {
                    Shape source = Measure(miss.Key);
                    Piece piece = ZNetScene.instance.GetPrefab(miss.Key)?.GetComponent<Piece>();
                    string kind = source == null ? "?" : source.KindKey.Length > 0 ? source.KindKey : "(no kind word)";
                    int stageOf = StageOf(miss.Key);
                    lines.Add($"{miss.Key} | {miss.Value} | {kind} | {(source != null ? Size(source.Size) : "?")} | " +
                              $"{(stageOf == Never ? "no player can build it" : Gallery.StageNames[stageOf])} | {(piece != null ? piece.m_category.ToString() : "?")}" +
                              (Swappable(miss.Key) ? "" : " | decoration, not swapped"));
                    if (source == null)
                    {
                        continue;
                    }

                    IEnumerable<Shape> nearest = Pool().Where(c => c.Stage <= stage.Key)
                        .OrderBy(c => c.KindKey == source.KindKey ? 0 : 1)
                        .ThenBy(c => Distance(source.Size, c.Size))
                        .Take(4);
                    foreach (Shape c in nearest)
                    {
                        lines.Add($"    {c.Prefab} | {c.KindKey} | {Size(c.Size)} | {Gallery.StageNames[c.Stage]}");
                    }
                }

                string path = Path.Combine(BepInEx.Paths.BepInExRootPath, "Villheim", $"swap-misses-{Gallery.StageWords[stage.Key]}.txt");
                Directory.CreateDirectory(Path.GetDirectoryName(path));
                File.WriteAllLines(path, lines);
                paths.Add(path);
            }

            return paths;
        }

        private static Choice Find(string prefab, int target)
        {
            Shape source = Measure(prefab);
            if (source == null)
            {
                return null;
            }

            // A hand pairing wins over everything, even for a piece the rules would leave alone.
            var pair = PairFor(prefab, target);
            if (pair.HasValue)
            {
                Shape chosen = Measure(pair.Value.Prefab);
                Quaternion quarter = Quaternion.Euler(0f, pair.Value.Turn, 0f);
                return chosen == null ? null : new Choice { Prefab = pair.Value.Prefab, Shift = source.Center - quarter * chosen.Center, Turn = quarter };
            }

            // Only pieces from after the target stage are swapped, never anything up.
            if (StageOf(prefab) <= target)
            {
                return null;
            }

            if (source.KindKey.Length == 0)
            {
                return null;
            }

            List<Shape> allowed = Pool().Where(c => c.Prefab != prefab && c.Stage <= target).ToList();
            List<Shape> sameKind = allowed.Where(c => c.KindKey == source.KindKey).ToList();
            List<Shape> related = allowed.Where(c => c.KindKey != source.KindKey && c.Families.Overlaps(source.Families)).ToList();
            return Closest(source, sameKind, exact: true) ?? Closest(source, sameKind, exact: false) ??
                   Closest(source, related, exact: true) ?? Closest(source, related, exact: false);
        }

        /// <summary>
        /// The best stand-in among the candidates: with <paramref name="exact"/>, one of the same size (either way round),
        /// newest stage first; without, the nearest in size.
        /// </summary>
        private static Choice Closest(Shape source, List<Shape> candidates, bool exact)
        {
            Shape best = null;
            bool bestTurned = false;
            float bestScore = float.MinValue;
            foreach (Shape candidate in candidates)
            {
                float straight = Distance(source.Size, candidate.Size);
                float turned = Distance(source.Size, Turned(candidate.Size));
                bool isTurned = turned < straight;
                float score;
                if (exact)
                {
                    bool same = isTurned ? Same(source.Size, Turned(candidate.Size), 0.15f, 0.08f) : Same(source.Size, candidate.Size, 0.15f, 0.08f);
                    if (!same)
                    {
                        continue;
                    }

                    score = candidate.Stage * 100 + (isTurned ? 0 : 10) + Mods(source, candidate) - candidate.Prefab.Length * 0.01f;
                }
                else
                {
                    score = -Mathf.Min(straight, turned) + Mods(source, candidate) * 0.05f + candidate.Stage * 0.01f;
                }

                if (score > bestScore)
                {
                    best = candidate;
                    bestTurned = isTurned;
                    bestScore = score;
                }
            }

            if (best == null)
            {
                return null;
            }

            Quaternion turn = bestTurned ? Quaternion.Euler(0f, 90f, 0f) : Quaternion.identity;
            return new Choice { Prefab = best.Prefab, Shift = source.Center - turn * best.Center, Turn = turn, Near = !exact };
        }

        private static Vector3 Turned(Vector3 size) => new Vector3(size.z, size.y, size.x);

        private static int Mods(Shape source, Shape candidate) =>
            candidate.Mods.Count(source.Mods.Contains) * 3 - candidate.Mods.Count(m => !source.Mods.Contains(m)) * 2;

        private static float Distance(Vector3 a, Vector3 b) => Mathf.Abs(a.x - b.x) + Mathf.Abs(a.y - b.y) + Mathf.Abs(a.z - b.z);

        private static bool Same(Vector3 a, Vector3 b, float absolute, float relative)
        {
            for (int i = 0; i < 3; i++)
            {
                if (Mathf.Abs(a[i] - b[i]) > absolute + relative * Mathf.Max(a[i], b[i]))
                {
                    return false;
                }
            }

            return true;
        }

        /// <summary>Every building piece a player can build with materials of a known stage.</summary>
        private static List<Shape> Pool()
        {
            if (_pool != null)
            {
                return _pool;
            }

            _pool = new List<Shape>();
            foreach (GameObject prefab in ZNetScene.instance.m_prefabs)
            {
                if (prefab == null || prefab.GetComponent<Piece>() == null || !Gallery.IsSwappable(prefab.name))
                {
                    continue;
                }

                Shape shape = Measure(prefab.name);
                if (shape != null && shape.KindKey.Length > 0)
                {
                    _pool.Add(shape);
                }
            }

            VillheimPlugin.Log.LogInfo($"Material swap: {_pool.Count} building pieces to choose from.");
            return _pool;
        }

        private static Shape Measure(string prefab)
        {
            if (ShapeOf.TryGetValue(prefab, out Shape shape))
            {
                return shape;
            }

            shape = null;
            GameObject go = ZNetScene.instance.GetPrefab(prefab);
            Bounds? bounds = go != null ? BuildOrder.Measure(go, prefab, Vector3.zero, Quaternion.identity, go.transform.localScale) : null;
            if (bounds.HasValue)
            {
                string lower = prefab.ToLowerInvariant();
                string named = KindOverride.TryGetValue(prefab, out string kind) ? kind : lower;
                // "45d" (goblin roofs) means 45 degrees, like "45" in the vanilla names.
                string[] tokens = lower.Split('_').Select(t => System.Text.RegularExpressions.Regex.IsMatch(t, @"^\d+d$") ? t.TrimEnd('d') : t).ToArray();
                shape = new Shape
                {
                    Prefab = prefab,
                    Stage = UsesStone(prefab) ? Mathf.Max(Gallery.StageOfPiece(prefab), StoneStage) : Gallery.StageOfPiece(prefab),
                    Size = bounds.Value.size,
                    Center = bounds.Value.center,
                    KindKey = string.Join("+", Kinds.Where(k => named.Contains(k))),
                    Families = new HashSet<string>(Kinds.Where(k => named.Contains(k)).Select(k => Family[k])),
                    Mods = new HashSet<string>(tokens.Where(t => Modifiers.Contains(t) || t.Any(char.IsDigit))),
                };
            }

            ShapeOf[prefab] = shape;
            return shape;
        }
    }
}
