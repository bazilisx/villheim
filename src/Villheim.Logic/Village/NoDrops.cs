using System.Reflection;
using HarmonyLib;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Nothing broken on the review ground drops anything: building pieces taken down with the hammer, deleted with the
    /// Shaper Tool or broken by 'vh gravity', and props, rocks or trees destroyed there. The review ground is the flat
    /// gallery area (from where 'vh flatten' last started, 400 m round its middle), 400 m round the board's spot ('vh slot
    /// here') and every slotting board plot.
    /// 'vh drops on' brings drops back; 'vh drops off' (the default) takes them away again.
    /// </summary>
    internal static class NoDrops
    {
        private static bool _dropsOn;

        public static string Toggle(string[] args)
        {
            string word = args.Length > 0 ? args[0].ToLowerInvariant() : "";
            _dropsOn = word == "on" || word != "off" && !_dropsOn;
            return _dropsOn
                ? "Villheim: things broken on the review ground drop their materials again. 'vh drops off' stops it."
                : "Villheim: nothing broken on the review ground (the flat gallery area and the slotting board) drops anything.";
        }

        /// <summary>Whether something at this spot is on the review ground and should drop nothing.</summary>
        public static bool Here(Vector3 position)
        {
            if (_dropsOn)
            {
                return false;
            }

            if (DesignBoard.Inside(position))
            {
                return true;
            }

            if (DesignBoard.LoadAnchor(out Vector3 anchor, out _) && Utils.DistanceXZ(position, anchor) < 400f)
            {
                return true;
            }

            if (!Gallery.LoadFlatArea(out Vector3 start, out Vector3 forward))
            {
                return false;
            }

            return Utils.DistanceXZ(position, start + forward * 130f) < 400f;
        }

        [HarmonyPatch]
        internal static class PiecePatch
        {
            private static MethodBase TargetMethod() => AccessTools.Method(typeof(Piece), nameof(Piece.DropResources));

            private static bool Prefix(Piece __instance) => __instance == null || !Here(__instance.transform.position);
        }

        [HarmonyPatch(typeof(DropOnDestroyed), "OnDestroyed")]
        internal static class DestroyedPatch
        {
            private static bool Prefix(DropOnDestroyed __instance) => __instance == null || !Here(__instance.transform.position);
        }
    }
}
