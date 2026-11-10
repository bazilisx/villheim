using System.Collections.Generic;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// One shared list of every loaded piece, sorted into 16 m cells, for the village's "which pieces are near here"
    /// questions (lag cluster B, 2026-11-10).
    ///
    /// The game's Piece.GetAllPiecesInRadius walks every loaded piece in the world and asks Unity for each one's layer
    /// and position, whatever the radius. Called once per spot, per ring position or per home it was the main cause of
    /// the village's stutters (FINDINGS 2). Here that walk happens at most once a frame, and only when something asked:
    /// the list is built again when a piece was made or removed since (counted by two small patches on the game's
    /// Piece.Awake and Piece.OnDestroy) or after MaxAge seconds (for ships and carts, the only pieces that move), and
    /// every question after that reads the cells. A piece destroyed since the list was built is skipped by Unity's null
    /// check.
    ///
    /// The PieceIndex setting turns it off: every caller then asks the game directly, as before.
    /// </summary>
    internal static class PieceIndex
    {
        private const float Cell = 16f;
        private const float MaxAge = 5f;

        private struct Entry
        {
            public Piece Piece;
            public Vector3 Position;
        }

        private static readonly Dictionary<long, List<Entry>> Cells = new Dictionary<long, List<Entry>>();
        private static readonly Stack<List<Entry>> Spare = new Stack<List<Entry>>();
        private static int _builtFrame = -1;
        private static int _builtVersion = -1;
        private static int _version;
        private static float _builtAt = -100f;

        /// <summary>How often the list was rebuilt and asked, since the last read (for the lag summary).</summary>
        public static int Rebuilds, Queries;

        public static bool On => LogicConfig.PieceIndex == null || LogicConfig.PieceIndex.Value;

        /// <summary>Every loaded piece within <paramref name="radius"/> of <paramref name="p"/>, the same answer as
        /// Piece.GetAllPiecesInRadius. <paramref name="pieces"/> is added to, not cleared, as the game's call does.</summary>
        public static void InRadius(Vector3 p, float radius, List<Piece> pieces)
        {
            if (!On)
            {
                Piece.GetAllPiecesInRadius(p, radius, pieces);
                return;
            }

            Fresh();
            Queries++;
            float r2 = radius * radius;
            int x0 = Mathf.FloorToInt((p.x - radius) / Cell), x1 = Mathf.FloorToInt((p.x + radius) / Cell);
            int z0 = Mathf.FloorToInt((p.z - radius) / Cell), z1 = Mathf.FloorToInt((p.z + radius) / Cell);
            for (int x = x0; x <= x1; x++)
            {
                for (int z = z0; z <= z1; z++)
                {
                    if (!Cells.TryGetValue(Key(x, z), out List<Entry> list))
                    {
                        continue;
                    }

                    foreach (Entry entry in list)
                    {
                        // The game measures in 3D (Vector3.Distance); so does this.
                        if ((entry.Position - p).sqrMagnitude < r2 && entry.Piece != null)
                        {
                            pieces.Add(entry.Piece);
                        }
                    }
                }
            }
        }

        /// <summary>Forget the list, so the next question builds it again (after a whole design is placed at once).</summary>
        public static void Invalidate() => _builtFrame = -1;

        private static void Fresh()
        {
            int frame = Time.frameCount;
            if (_builtFrame >= 0 && _version == _builtVersion &&
                (frame == _builtFrame || Time.realtimeSinceStartup - _builtAt < MaxAge))
            {
                return;
            }

            Build(frame);
        }

        private static void Build(int frame)
        {
            foreach (List<Entry> list in Cells.Values)
            {
                list.Clear();
                Spare.Push(list);
            }

            Cells.Clear();
            int ghost = Piece.s_ghostLayer;
            foreach (Piece piece in Piece.s_allPieces)
            {
                if (piece == null)
                {
                    continue;
                }

                GameObject go = piece.gameObject;
                if (go.layer == ghost)
                {
                    continue; // the player's placement ghost, left out by the game's own call too
                }

                Vector3 position = piece.transform.position;
                long key = Key(Mathf.FloorToInt(position.x / Cell), Mathf.FloorToInt(position.z / Cell));
                if (!Cells.TryGetValue(key, out List<Entry> list))
                {
                    list = Spare.Count > 0 ? Spare.Pop() : new List<Entry>(32);
                    Cells[key] = list;
                }

                list.Add(new Entry { Piece = piece, Position = position });
            }

            _builtFrame = frame;
            _builtVersion = _version;
            _builtAt = Time.realtimeSinceStartup;
            Rebuilds++;
        }

        private static long Key(int x, int z) => ((long)x << 32) ^ (uint)z;

        /// <summary>A piece came into the world (placed, or loaded with its zone): the list is out of date.</summary>
        [HarmonyLib.HarmonyPatch(typeof(Piece), "Awake")]
        internal static class AwakePatch
        {
            private static void Postfix() => _version++;
        }

        /// <summary>A piece left the world (removed, or unloaded with its zone): the list is out of date.</summary>
        [HarmonyLib.HarmonyPatch(typeof(Piece), "OnDestroy")]
        internal static class DestroyPatch
        {
            private static void Postfix() => _version++;
        }
    }
}
