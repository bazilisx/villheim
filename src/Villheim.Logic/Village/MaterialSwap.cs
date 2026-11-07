using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Designs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Shows a design in another stage's materials: each building piece (wall, floor, roof, beam, pole, fence, door,
    /// window...) is swapped for a piece of the same kind from the target stage, so an ashwood house can be seen in
    /// Meadows wood, or a Meadows house with Plains tar roofs.
    ///
    /// First choice: same kind in the name (wall, roof, floor...) and the same size as the game measures it (its
    /// colliders), within a few centimetres, either way round. Second choice, when the target stage has no piece that
    /// size: the nearest in size of the same kind ("near" on the sign). A hand-made pairing in <see cref="Pairs"/> beats
    /// both. The new piece goes where the old one's middle was, so pieces whose pivots differ still line up. Down a
    /// stage, the newest piece the target stage has is used; up a stage, a piece is only swapped when a newer one of the
    /// same kind exists by then. Anything with no match stays as it was and is listed in swap-misses-&lt;stage&gt;.txt.
    /// Decoration and furniture are never swapped.
    /// </summary>
    internal static class MaterialSwap
    {
        private static readonly string[] Kinds =
        {
            "roof", "wall", "floor", "beam", "pole", "stair", "arch", "window", "door", "gate", "pillar", "column",
            "fence", "stake", "rail", "ladder", "palisade", "shutter",
        };

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
                if (entry.Shell && TrySwap(entry.Prefab, target, out string swap, out Vector3 shift, out Quaternion turn, out bool near))
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

        /// <summary>Counts a piece that stays although it is from a later stage than the target.</summary>
        public static void Note(string prefab, int target, Result result)
        {
            int stage = Gallery.StageOfPiece(prefab);
            if (stage <= target)
            {
                return;
            }

            result.Kept++;
            result.Unmatched.TryGetValue(prefab, out int n);
            result.Unmatched[prefab] = n + 1;
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
                    lines.Add($"{miss.Key} | {miss.Value} | {kind} | {(source != null ? Size(source.Size) : "?")} | " +
                              $"{Gallery.StageNames[Gallery.StageOfPiece(miss.Key)]} | {(piece != null ? piece.m_category.ToString() : "?")}");
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

            if (Pairs.TryGetValue(prefab, out Dictionary<int, string> pairs) && pairs.TryGetValue(target, out string paired))
            {
                Shape chosen = Measure(paired);
                return chosen == null ? null : new Choice { Prefab = paired, Shift = source.Center - chosen.Center, Turn = Quaternion.identity };
            }

            if (source.KindKey.Length == 0)
            {
                return null;
            }

            int own = Gallery.StageOfPiece(prefab);
            List<Shape> candidates = Pool().Where(c => c.Prefab != prefab && c.KindKey == source.KindKey && c.Stage <= target &&
                                                       (own > target || c.Stage > own)).ToList();

            // Same size, either way round.
            Shape best = null;
            bool bestTurned = false;
            int bestScore = int.MinValue;
            foreach (Shape candidate in candidates)
            {
                bool straight = Same(source.Size, candidate.Size, 0.15f, 0.08f);
                bool turned = !straight && Same(source.Size, Turned(candidate.Size), 0.15f, 0.08f);
                if (!straight && !turned)
                {
                    continue;
                }

                int score = candidate.Stage * 100 + (straight ? 10 : 0) + Mods(source, candidate);
                if (score > bestScore || score == bestScore && best != null && candidate.Prefab.Length < best.Prefab.Length)
                {
                    best = candidate;
                    bestTurned = turned;
                    bestScore = score;
                }
            }

            bool near = false;
            if (best == null && own > target)
            {
                // Nearest size of the same kind, down a stage only: the piece must go, and this is the closest stand-in.
                float bestDistance = float.MaxValue;
                foreach (Shape candidate in candidates)
                {
                    float straight = Distance(source.Size, candidate.Size);
                    float turned = Distance(source.Size, Turned(candidate.Size));
                    float distance = Mathf.Min(straight, turned) - Mods(source, candidate) * 0.05f;
                    if (distance < bestDistance)
                    {
                        best = candidate;
                        bestTurned = turned < straight;
                        bestDistance = distance;
                    }
                }

                near = best != null;
            }

            if (best == null)
            {
                return null;
            }

            Quaternion turn = bestTurned ? Quaternion.Euler(0f, 90f, 0f) : Quaternion.identity;
            return new Choice { Prefab = best.Prefab, Shift = source.Center - turn * best.Center, Turn = turn, Near = near };
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
                string[] tokens = lower.Split('_');
                shape = new Shape
                {
                    Prefab = prefab,
                    Stage = Gallery.StageOfPiece(prefab),
                    Size = bounds.Value.size,
                    Center = bounds.Value.center,
                    KindKey = string.Join("+", Kinds.Where(k => lower.Contains(k))),
                    Mods = new HashSet<string>(tokens.Where(t => Modifiers.Contains(t) || t.Any(char.IsDigit))),
                };
            }

            ShapeOf[prefab] = shape;
            return shape;
        }
    }
}
