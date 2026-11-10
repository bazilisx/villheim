using System.Collections.Generic;
using UnityEngine;
using Villheim.Logic.Designs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// The ground a building really covers: a rectangle turned with the building, measured from its pieces. Plots
    /// were spaced as circles round each design's farthest corner plus 2 m, which kept a 23 x 12 m hall 26 m from any
    /// home and left most of a village's ground unused (Tyler, 2026-11-09).
    /// </summary>
    internal struct Foot
    {
        /// <summary>World position of the rectangle's middle (x, z).</summary>
        public Vector2 Center;
        public float Yaw;
        /// <summary>Half the width (design x) and half the depth (design z).</summary>
        public float HalfX, HalfZ;

        public float Reach => Mathf.Sqrt(HalfX * HalfX + HalfZ * HalfZ);

        public Vector3 CenterAt(float y) => new Vector3(Center.x, y, Center.y);

        public Quaternion Rotation => Quaternion.Euler(0f, Yaw, 0f);

        /// <summary>The point in the rectangle's own frame (x along its width, y along its depth).</summary>
        public Vector2 ToLocal(Vector3 world)
        {
            Vector3 d = Quaternion.Euler(0f, -Yaw, 0f) * new Vector3(world.x - Center.x, 0f, world.z - Center.y);
            return new Vector2(d.x, d.z);
        }

        public Vector3 ToWorld(float localX, float localZ, float y = 0f)
        {
            Vector3 d = Rotation * new Vector3(localX, 0f, localZ);
            return new Vector3(Center.x + d.x, y, Center.y + d.z);
        }

        /// <summary>The point lies on the rectangle or within <paramref name="margin"/> of it.</summary>
        public bool Holds(Vector3 world, float margin = 0f) => DistanceTo(world) <= margin;

        /// <summary>How far the point is from the rectangle's edge; 0 inside it.</summary>
        public float DistanceTo(Vector3 world)
        {
            Vector2 local = ToLocal(world);
            float dx = Mathf.Max(0f, Mathf.Abs(local.x) - HalfX);
            float dz = Mathf.Max(0f, Mathf.Abs(local.y) - HalfZ);
            return Mathf.Sqrt(dx * dx + dz * dz);
        }

        public Foot Grown(float by) => new Foot { Center = Center, Yaw = Yaw, HalfX = HalfX + by, HalfZ = HalfZ + by };
    }

    internal static class Footprints
    {
        // A piece's position is its middle or its corner: a wall, an eave or a yard fence reaches about this far past it.
        private const float PieceReach = 1f;

        private static readonly Dictionary<string, Rect> Cache = new Dictionary<string, Rect>();

        public static void Forget() => Cache.Clear();

        /// <summary>
        /// The design's footprint set down at a plot. With <paramref name="grown"/>, the ground its later stages will
        /// cover too (s2 and s3 of the same line), so a home leaves room for what it grows into.
        /// </summary>
        public static Foot Of(string design, Vector3 position, float yaw, float radius, bool grown)
        {
            Rect rect = Local(design, radius, grown);
            Vector3 middle = Quaternion.Euler(0f, yaw, 0f) * new Vector3(rect.center.x, 0f, rect.center.y);
            return new Foot
            {
                Center = new Vector2(position.x + middle.x, position.z + middle.z), Yaw = yaw,
                HalfX = rect.width * 0.5f, HalfZ = rect.height * 0.5f,
            };
        }

        /// <summary>The footprint in the design's own coordinates (x, z), pieces' reach included.</summary>
        public static Rect Local(string design, float radius, bool grown)
        {
            string key = (grown ? "g:" : "s:") + design;
            if (design != null && Cache.TryGetValue(key, out Rect known))
            {
                return known;
            }

            Rect rect;
            Blueprints.Blueprint blueprint = design != null ? Blueprints.Find(design) : null;
            if (blueprint == null || blueprint.Pieces.Count == 0)
            {
                // A copied location: no piece list at hand, so a square inside its circle.
                float half = Mathf.Max(2f, radius * 0.75f);
                rect = new Rect(-half, -half, half * 2f, half * 2f);
            }
            else
            {
                rect = Measure(blueprint);
                if (grown)
                {
                    Blueprints.Blueprint next = blueprint;
                    for (int i = 0; i < 6; i++)
                    {
                        next = Blueprints.NextLevel(next);
                        if (next == null || next.Pieces.Count == 0)
                        {
                            break;
                        }

                        Rect more = Measure(next);
                        rect = Rect.MinMaxRect(Mathf.Min(rect.xMin, more.xMin), Mathf.Min(rect.yMin, more.yMin),
                            Mathf.Max(rect.xMax, more.xMax), Mathf.Max(rect.yMax, more.yMax));
                    }
                }
            }

            if (design != null)
            {
                Cache[key] = rect;
            }

            return rect;
        }

        private static Rect Measure(Blueprints.Blueprint blueprint)
        {
            float minX = float.MaxValue, maxX = float.MinValue, minZ = float.MaxValue, maxZ = float.MinValue;
            foreach (Blueprints.Piece piece in blueprint.Pieces)
            {
                minX = Mathf.Min(minX, piece.Position.x);
                maxX = Mathf.Max(maxX, piece.Position.x);
                minZ = Mathf.Min(minZ, piece.Position.z);
                maxZ = Mathf.Max(maxZ, piece.Position.z);
            }

            return Rect.MinMaxRect(minX - PieceReach, minZ - PieceReach, maxX + PieceReach, maxZ + PieceReach);
        }

        /// <summary>The two rectangles overlap, or come nearer than <paramref name="gap"/> (separating axis test).</summary>
        public static bool TooNear(Foot a, Foot b, float gap)
        {
            a = a.Grown(gap);
            if (Vector2.Distance(a.Center, b.Center) > a.Reach + b.Reach)
            {
                return false;
            }

            return !Separated(a, b) && !Separated(b, a);
        }

        /// <summary>One of a's two axes separates the rectangles.</summary>
        private static bool Separated(Foot a, Foot b)
        {
            Vector2 min = new Vector2(float.MaxValue, float.MaxValue), max = new Vector2(float.MinValue, float.MinValue);
            for (int i = 0; i < 4; i++)
            {
                Vector2 corner = a.ToLocal(b.ToWorld(i < 2 ? b.HalfX : -b.HalfX, i % 2 == 0 ? b.HalfZ : -b.HalfZ));
                min = Vector2.Min(min, corner);
                max = Vector2.Max(max, corner);
            }

            return min.x > a.HalfX || max.x < -a.HalfX || min.y > a.HalfZ || max.y < -a.HalfZ;
        }

        /// <summary>Points to test the ground at: the middle, the corners, the edge middles and the quarter points.</summary>
        public static IEnumerable<Vector3> Samples(Foot foot)
        {
            yield return foot.ToWorld(0f, 0f);
            for (int x = -2; x <= 2; x++)
            {
                for (int z = -2; z <= 2; z++)
                {
                    if ((x == 0 && z == 0) || (Mathf.Abs(x) != 2 && Mathf.Abs(z) != 2 && (x == 0 || z == 0)))
                    {
                        continue;
                    }

                    yield return foot.ToWorld(foot.HalfX * x * 0.5f, foot.HalfZ * z * 0.5f);
                }
            }
        }
    }
}
