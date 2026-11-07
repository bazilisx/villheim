using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Designs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Shows a design in another stage's materials: each building piece (wall, floor, roof, beam, pole, door, window)
    /// is swapped for the piece of the same shape from the target stage, so an ashwood house can be seen in Meadows
    /// wood, or a Meadows house with Plains tar roofs.
    ///
    /// Same shape means the same kind in the name (wall, roof, floor...) and the same size as the game measures it
    /// (its colliders), within a few centimetres, either way round. The new piece goes where the old one's middle was,
    /// so pieces whose pivots differ still line up. Down a stage, the newest piece the target stage has is used; up a
    /// stage, a piece is only swapped when a newer one of the same shape exists by then. Anything with no match stays
    /// as it was. Decoration and furniture are never swapped.
    /// </summary>
    internal static class MaterialSwap
    {
        private static readonly string[] Kinds = { "roof", "wall", "floor", "beam", "pole", "stair", "arch", "window", "door", "gate", "pillar", "column" };

        private static readonly HashSet<string> Modifiers = new HashSet<string>
        {
            "top", "ocorner", "icorner", "corner", "upsidedown", "half", "quarter", "small", "medium", "large", "triangle",
            "tip", "end", "inverted", "narrow", "curved", "cross",
        };

        private sealed class Shape
        {
            public string Prefab;
            public int Stage;
            public Vector3 Size;
            public Vector3 Center;
            public string KindKey;
            public HashSet<string> Mods;
        }

        private static List<Shape> _pool;
        private static readonly Dictionary<string, Shape> ShapeOf = new Dictionary<string, Shape>();
        private static readonly Dictionary<string, (string Prefab, Vector3 Shift, Quaternion Turn)?> Cache =
            new Dictionary<string, (string, Vector3, Quaternion)?>();

        /// <summary>How a design changed: pieces swapped, and later-stage pieces left as they were for lack of a match.</summary>
        internal sealed class Result
        {
            public int Swapped;
            public int Kept;
            public readonly Dictionary<string, int> Unmatched = new Dictionary<string, int>();

            public string Summary(int target) =>
                $"{Swapped} swapped" + (Kept > 0
                    ? $", {Kept} later pieces kept (no {Gallery.StageNames[target]} match: " +
                      string.Join(", ", Unmatched.OrderByDescending(k => k.Value).Take(3).Select(k => k.Key)) + ")"
                    : "");
        }

        /// <summary>
        /// The piece to put instead of <paramref name="prefab"/> for the target stage, and how to place it: new position
        /// = old position + old rotation * shift; new rotation = old rotation * turn. False when it stays as it is.
        /// </summary>
        public static bool TrySwap(string prefab, int target, out string swap, out Vector3 shift, out Quaternion turn)
        {
            swap = null;
            shift = Vector3.zero;
            turn = Quaternion.identity;
            string key = prefab + "|" + target;
            if (!Cache.TryGetValue(key, out var found))
            {
                found = Find(prefab, target);
                Cache[key] = found;
            }

            if (!found.HasValue)
            {
                return false;
            }

            swap = found.Value.Prefab;
            shift = found.Value.Shift;
            turn = found.Value.Turn;
            return true;
        }

        /// <summary>A gallery plan in the target stage's materials.</summary>
        public static List<DesignSpawner.PlanEntry> Apply(List<DesignSpawner.PlanEntry> plan, int target, Result result)
        {
            var output = new List<DesignSpawner.PlanEntry>(plan.Count);
            foreach (DesignSpawner.PlanEntry entry in plan)
            {
                if (entry.Shell && TrySwap(entry.Prefab, target, out string swap, out Vector3 shift, out Quaternion turn))
                {
                    DesignSpawner.PlanEntry swapped = DesignSpawner.Entry(swap, entry.LocalPosition + entry.LocalRotation * shift,
                        entry.LocalRotation * turn, entry.Scale);
                    if (swapped != null)
                    {
                        output.Add(swapped);
                        result.Swapped++;
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
            if (stage > target)
            {
                result.Kept++;
                result.Unmatched.TryGetValue(prefab, out int n);
                result.Unmatched[prefab] = n + 1;
            }
        }

        private static (string, Vector3, Quaternion)? Find(string prefab, int target)
        {
            Shape source = Measure(prefab);
            if (source == null || source.KindKey.Length == 0)
            {
                return null;
            }

            int own = Gallery.StageOfPiece(prefab);
            Shape best = null;
            bool bestTurned = false;
            int bestScore = int.MinValue;
            foreach (Shape candidate in Pool())
            {
                if (candidate.Prefab == prefab || candidate.KindKey != source.KindKey || candidate.Stage > target)
                {
                    continue;
                }

                // Down: any stage up to the target. Up: only something newer than the piece itself.
                if (own <= target && candidate.Stage <= own)
                {
                    continue;
                }

                bool straight = Same(source.Size, candidate.Size);
                bool turned = !straight && Same(source.Size, new Vector3(candidate.Size.z, candidate.Size.y, candidate.Size.x));
                if (!straight && !turned)
                {
                    continue;
                }

                int score = candidate.Stage * 100 + (straight ? 10 : 0) +
                            candidate.Mods.Count(source.Mods.Contains) * 3 - candidate.Mods.Count(m => !source.Mods.Contains(m)) * 2;
                if (score > bestScore || score == bestScore && best != null && candidate.Prefab.Length < best.Prefab.Length)
                {
                    best = candidate;
                    bestTurned = turned;
                    bestScore = score;
                }
            }

            if (best == null)
            {
                return null;
            }

            Quaternion turn = bestTurned ? Quaternion.Euler(0f, 90f, 0f) : Quaternion.identity;
            return (best.Prefab, source.Center - turn * best.Center, turn);
        }

        private static bool Same(Vector3 a, Vector3 b)
        {
            for (int i = 0; i < 3; i++)
            {
                if (Mathf.Abs(a[i] - b[i]) > 0.15f + 0.08f * Mathf.Max(a[i], b[i]))
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
