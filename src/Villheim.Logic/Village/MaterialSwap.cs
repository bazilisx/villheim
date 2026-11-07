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
        /// Hand-made pairings, for pieces the size test gets wrong or cannot match: source piece to the piece to use
        /// at each stage it is swapped down to (stage index, see Gallery.StageNames). Filled from swap-misses files.
        /// </summary>
        private static readonly Dictionary<string, Dictionary<int, string>> Pairs = new Dictionary<string, Dictionary<int, string>>();

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

        /// <summary>The stage a piece belongs to for swapping: <see cref="Never"/> when no player can build it.</summary>
        private static int StageOf(string prefab) => Gallery.IsBuildable(prefab) ? Gallery.StageOfPiece(prefab) : Never;

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
            // Only pieces from after the target stage are swapped, never anything up.
            if (StageOf(prefab) <= target)
            {
                return null;
            }

            Shape source = Measure(prefab);
            if (source == null)
            {
                return null;
            }

            if (Pairs.TryGetValue(prefab, out Dictionary<int, string> pairs) && pairs.TryGetValue(target, out string paired))
            {
                Shape chosen = Measure(paired);
                return chosen == null ? null : new Choice { Prefab = paired, Shift = source.Center - chosen.Center, Turn = Quaternion.identity };
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
                    Stage = Gallery.StageOfPiece(prefab),
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
