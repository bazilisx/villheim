using System.Collections.Generic;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Undo for gallery editing (Shaping key 3, 'vh swap undo'): the last 50 changes, newest first: deletes (single or
    /// Delete all), moves (whole design or part, one step per press), swaps and turns. Each change leaves how to put it
    /// back; undo runs the newest. Steps with the same key in a row count as one (turning with the mouse wheel: one
    /// undo puts the object back as it was before the first notch).
    /// </summary>
    internal static class EditHistory
    {
        private const int Keep = 50;
        private static readonly List<(string What, System.Action Back)> Steps = new List<(string, System.Action)>();
        private static string _lastKey;

        public static void Push(string what, System.Action back, string key = null)
        {
            if (key != null && key == _lastKey && Steps.Count > 0)
            {
                return;
            }

            _lastKey = key;
            Steps.Add((what, back));
            if (Steps.Count > Keep)
            {
                Steps.RemoveAt(0);
            }
        }

        public static string Undo()
        {
            if (Steps.Count == 0)
            {
                return "Undo: nothing to undo.";
            }

            (string what, System.Action back) = Steps[Steps.Count - 1];
            Steps.RemoveAt(Steps.Count - 1);
            _lastKey = null;
            try
            {
                back();
                return $"Undone: {what}." + (Steps.Count > 0 ? $" ({Steps.Count} more to undo)" : "");
            }
            catch (System.Exception e)
            {
                VillheimPlugin.Log.LogWarning($"Undo of {what}: {e}");
                return $"Undo of {what} failed: {e.Message}";
            }
        }

        // ---------------------------------------------------------------- deleted objects

        /// <summary>What a deleted object was, enough to put it back: prefab, place, scale and the gallery's marks on it.</summary>
        internal sealed class Snapshot
        {
            public string Prefab;
            public Vector3 Position;
            public Quaternion Rotation;
            public Vector3 Scale;
            public int Gallery;
            public string Design;
            public string SwappedFrom;
            public Quaternion SwappedRotation;
            public Vector3 SwappedCenter;
            public string Text;
        }

        public static Snapshot Take(ZNetView view)
        {
            ZDO zdo = view.GetZDO();
            return new Snapshot
            {
                Prefab = Utils.GetPrefabName(view.gameObject),
                Position = view.transform.position,
                Rotation = view.transform.rotation,
                Scale = view.transform.localScale,
                Gallery = zdo.GetInt(Village.Gallery.KeyGallery),
                Design = zdo.GetString(Village.Gallery.KeyDesign, ""),
                SwappedFrom = zdo.GetString(Village.Gallery.KeySwappedFrom, ""),
                SwappedRotation = zdo.GetQuaternion(Village.Gallery.KeySwappedRotation, view.transform.rotation),
                SwappedCenter = zdo.GetVec3(Village.Gallery.KeySwappedCenter, view.transform.position),
                Text = view.GetComponent<Sign>() != null ? zdo.GetString(ZDOVars.s_text, "") : null,
            };
        }

        /// <summary>A snapshot of a piece the game has not loaded (only its ZDO exists), or null if its prefab is unknown.</summary>
        public static Snapshot TakeZdo(ZDO zdo)
        {
            GameObject prefab = ZNetScene.instance.GetPrefab(zdo.GetPrefab());
            if (prefab == null)
            {
                return null;
            }

            return new Snapshot
            {
                Prefab = prefab.name,
                Position = zdo.GetPosition(),
                Rotation = zdo.GetRotation(),
                Scale = prefab.transform.localScale,
                Gallery = zdo.GetInt(Village.Gallery.KeyGallery),
                Design = zdo.GetString(Village.Gallery.KeyDesign, ""),
                SwappedFrom = zdo.GetString(Village.Gallery.KeySwappedFrom, ""),
                SwappedRotation = zdo.GetQuaternion(Village.Gallery.KeySwappedRotation, zdo.GetRotation()),
                SwappedCenter = zdo.GetVec3(Village.Gallery.KeySwappedCenter, zdo.GetPosition()),
                Text = null,
            };
        }

        public static void Restore(Snapshot snapshot) => RestoreObject(snapshot);

        /// <summary>Puts the snapshot back and returns what was made (null if its prefab is unknown).</summary>
        public static GameObject RestoreObject(Snapshot snapshot)
        {
            GameObject prefab = ZNetScene.instance.GetPrefab(snapshot.Prefab);
            if (prefab == null)
            {
                return null;
            }

            GameObject made = Object.Instantiate(prefab, snapshot.Position, snapshot.Rotation);
            if ((snapshot.Scale - prefab.transform.localScale).sqrMagnitude > 0.0001f)
            {
                made.transform.localScale = snapshot.Scale;
            }

            ZDO zdo = made.GetComponent<ZNetView>()?.GetZDO();
            if (zdo == null)
            {
                return made;
            }

            if (snapshot.Gallery == 1)
            {
                zdo.Set(Village.Gallery.KeyGallery, 1);
            }

            if (snapshot.Design.Length > 0)
            {
                zdo.Set(Village.Gallery.KeyDesign, snapshot.Design);
            }

            if (snapshot.SwappedFrom.Length > 0)
            {
                zdo.Set(Village.Gallery.KeySwappedFrom, snapshot.SwappedFrom);
                zdo.Set(Village.Gallery.KeySwappedRotation, snapshot.SwappedRotation);
                zdo.Set(Village.Gallery.KeySwappedCenter, snapshot.SwappedCenter);
            }

            if (snapshot.Text != null)
            {
                zdo.Set(ZDOVars.s_text, snapshot.Text);
                made.GetComponent<Sign>()?.UpdateText();
            }

            return made;
        }
    }
}
