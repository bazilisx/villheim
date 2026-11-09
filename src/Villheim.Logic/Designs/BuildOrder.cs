using System.Collections.Generic;
using UnityEngine;

namespace Villheim.Logic.Designs
{
    /// <summary>
    /// Puts a building's shell (walls, floors, beams, roofs, doors and windows) in an order where every piece has
    /// something under it when it goes up. A piece is ready when it stands on the ground, sits on top of a placed
    /// piece, or stands beside a placed piece for at least half a metre of its height. The lowest ready piece goes
    /// next. So the ground row of walls goes up first, then what rests on it, and a door goes in before the wall
    /// above it.
    ///
    /// Sizes come from the colliders of each prefab, placed the way the design places them.
    /// </summary>
    internal static class BuildOrder
    {
        private const float GroundSlack = 0.35f;
        private const float RestBelow = 0.35f;
        private const float RestAbove = 0.6f;
        private const float MinOverlap = 0.04f;
        private const float MinRestLength = 0.25f;
        private const float MinSideHeight = 0.5f;
        private const float SideGap = 0.1f;
        private const float TouchGap = 0.1f;

        private static readonly Dictionary<string, Bounds?> PrefabBounds = new Dictionary<string, Bounds?>();
        private static readonly List<Collider> Colliders = new List<Collider>();

        /// <summary>The space a placed prefab takes up, in the design's own coordinates, or null if it has no solid collider.</summary>
        public static Bounds? Measure(GameObject prefab, string prefabName, Vector3 position, Quaternion rotation, Vector3 scale)
        {
            if (!PrefabBounds.TryGetValue(prefabName, out Bounds? local))
            {
                local = LocalBounds(prefab);
                PrefabBounds[prefabName] = local;
            }

            if (!local.HasValue)
            {
                return null;
            }

            Vector3 prefabScale = prefab.transform.localScale;
            Vector3 relative = new Vector3(
                prefabScale.x != 0f ? scale.x / prefabScale.x : 1f,
                prefabScale.y != 0f ? scale.y / prefabScale.y : 1f,
                prefabScale.z != 0f ? scale.z / prefabScale.z : 1f);
            return Transform(local.Value, Matrix4x4.TRS(position, rotation, relative));
        }

        /// <summary>
        /// Orders the shell pieces so each one is held up when placed. <paramref name="groundAt"/> gives the ground
        /// height (in design coordinates) under a point, or null when unknown.
        /// </summary>
        public static List<DesignSpawner.PlanEntry> Order(List<DesignSpawner.PlanEntry> shell, System.Func<Vector3, float?> groundAt)
        {
            int count = shell.Count;
            var result = new List<DesignSpawner.PlanEntry>(count);
            if (count == 0)
            {
                return result;
            }

            var bounds = new Bounds[count];
            float baseY = float.MaxValue;
            for (int i = 0; i < count; i++)
            {
                bounds[i] = shell[i].Bounds ?? new Bounds(shell[i].LocalPosition, Vector3.one * 0.5f);
                baseY = Mathf.Min(baseY, bounds[i].min.y);
            }

            // Who holds up whom, worked out once.
            var holds = new List<int>[count];
            var touches = new List<int>[count];
            var grounded = new bool[count];
            for (int i = 0; i < count; i++)
            {
                holds[i] = new List<int>();
                touches[i] = new List<int>();
                float bottom = bounds[i].min.y;
                float? ground = groundAt?.Invoke(new Vector3(bounds[i].center.x, bottom, bounds[i].center.z));
                grounded[i] = bottom <= baseY + GroundSlack || (ground.HasValue && bottom <= ground.Value + GroundSlack);
            }

            for (int i = 0; i < count; i++)
            {
                for (int j = 0; j < count; j++)
                {
                    if (i == j)
                    {
                        continue;
                    }

                    // Does j hold up i?
                    if (RestsOn(bounds[i], bounds[j]) || Beside(bounds[i], bounds[j]))
                    {
                        holds[j].Add(i);
                    }
                    else if (Touching(bounds[i], bounds[j]) && bounds[j].min.y < bounds[i].min.y - 0.05f)
                    {
                        touches[j].Add(i);
                    }
                }
            }

            var placed = new bool[count];
            var supported = new bool[count];
            var leaning = new bool[count];
            for (int i = 0; i < count; i++)
            {
                supported[i] = grounded[i];
            }

            for (int step = 0; step < count; step++)
            {
                int next = Lowest(bounds, placed, supported);
                if (next < 0)
                {
                    // Nothing is fully held: take a piece that at least leans on a placed one, then anything.
                    next = Lowest(bounds, placed, leaning);
                }

                if (next < 0)
                {
                    next = Lowest(bounds, placed, null);
                }

                placed[next] = true;
                result.Add(shell[next]);
                foreach (int above in holds[next])
                {
                    supported[above] = true;
                }

                foreach (int beside in touches[next])
                {
                    leaning[beside] = true;
                }
            }

            return result;
        }

        /// <summary>
        /// <paramref name="below"/> holds up <paramref name="piece"/> (it rests on it, or stands beside it for a good
        /// part of its height): the rule the build order uses, for placing a piece out of turn.
        /// </summary>
        public static bool Holds(Bounds piece, Bounds below) => RestsOn(piece, below) || Beside(piece, below);

        /// <summary>The piece stands on the ground floor (its bottom within GroundSlack of the given floor height).</summary>
        public static bool OnFloor(Bounds piece, float floor) => piece.min.y <= floor + GroundSlack;

        /// <summary>The unplaced piece with the lowest bottom among those allowed (design order breaks ties).</summary>
        private static int Lowest(Bounds[] bounds, bool[] placed, bool[] allowed)
        {
            int best = -1;
            float bestY = float.MaxValue;
            for (int i = 0; i < bounds.Length; i++)
            {
                if (placed[i] || (allowed != null && !allowed[i]))
                {
                    continue;
                }

                float y = Mathf.Round(bounds[i].min.y * 4f);
                if (y < bestY)
                {
                    best = i;
                    bestY = y;
                }
            }

            return best;
        }

        /// <summary>The bottom of <paramref name="piece"/> sits on the top of <paramref name="below"/>, with real overlap seen from above.</summary>
        private static bool RestsOn(Bounds piece, Bounds below)
        {
            if (below.min.y >= piece.min.y || below.max.y < piece.min.y - RestBelow || below.max.y > piece.min.y + RestAbove)
            {
                return false;
            }

            float x = Overlap(piece.min.x, piece.max.x, below.min.x, below.max.x);
            float z = Overlap(piece.min.z, piece.max.z, below.min.z, below.max.z);
            return x > MinOverlap && z > MinOverlap && Mathf.Max(x, z) > MinRestLength;
        }

        /// <summary>The two stand side by side for a good part of their height, and <paramref name="other"/> starts no higher.</summary>
        private static bool Beside(Bounds piece, Bounds other)
        {
            if (other.min.y > piece.min.y + 0.1f)
            {
                return false;
            }

            float height = Overlap(piece.min.y, piece.max.y, other.min.y, other.max.y);
            float x = Overlap(piece.min.x, piece.max.x, other.min.x, other.max.x);
            float z = Overlap(piece.min.z, piece.max.z, other.min.z, other.max.z);
            return height >= MinSideHeight && x > -SideGap && z > -SideGap;
        }

        private static bool Touching(Bounds a, Bounds b)
        {
            return Overlap(a.min.x, a.max.x, b.min.x, b.max.x) > -TouchGap &&
                   Overlap(a.min.y, a.max.y, b.min.y, b.max.y) > -TouchGap &&
                   Overlap(a.min.z, a.max.z, b.min.z, b.max.z) > -TouchGap;
        }

        private static float Overlap(float minA, float maxA, float minB, float maxB)
        {
            return Mathf.Min(maxA, maxB) - Mathf.Max(minA, minB);
        }

        /// <summary>The prefab's solid colliders as one box in the prefab's own coordinates.</summary>
        private static Bounds? LocalBounds(GameObject prefab)
        {
            Colliders.Clear();
            prefab.GetComponentsInChildren(true, Colliders);
            Matrix4x4 toPrefab = prefab.transform.worldToLocalMatrix;
            Bounds? total = null;
            foreach (Collider collider in Colliders)
            {
                if (collider == null || collider.isTrigger || !collider.gameObject.activeSelf)
                {
                    continue;
                }

                Bounds? box = ColliderBox(collider);
                if (!box.HasValue)
                {
                    continue;
                }

                Bounds inPrefab = Transform(box.Value, toPrefab * collider.transform.localToWorldMatrix);
                if (total.HasValue)
                {
                    Bounds grown = total.Value;
                    grown.Encapsulate(inPrefab);
                    total = grown;
                }
                else
                {
                    total = inPrefab;
                }
            }

            return total;
        }

        /// <summary>A collider's box in its own transform's coordinates.</summary>
        private static Bounds? ColliderBox(Collider collider)
        {
            switch (collider)
            {
                case BoxCollider box:
                    return new Bounds(box.center, box.size);
                case MeshCollider mesh when mesh.sharedMesh != null:
                    return mesh.sharedMesh.bounds;
                case SphereCollider sphere:
                    return new Bounds(sphere.center, Vector3.one * sphere.radius * 2f);
                case CapsuleCollider capsule:
                {
                    Vector3 size = Vector3.one * capsule.radius * 2f;
                    size[Mathf.Clamp(capsule.direction, 0, 2)] = Mathf.Max(capsule.height, capsule.radius * 2f);
                    return new Bounds(capsule.center, size);
                }
                default:
                    return null;
            }
        }

        private static Bounds Transform(Bounds bounds, Matrix4x4 matrix)
        {
            Vector3 min = bounds.min;
            Vector3 max = bounds.max;
            var result = new Bounds(matrix.MultiplyPoint3x4(min), Vector3.zero);
            for (int corner = 1; corner < 8; corner++)
            {
                result.Encapsulate(matrix.MultiplyPoint3x4(new Vector3(
                    (corner & 1) != 0 ? max.x : min.x,
                    (corner & 2) != 0 ? max.y : min.y,
                    (corner & 4) != 0 ? max.z : min.z)));
            }

            return result;
        }
    }
}
