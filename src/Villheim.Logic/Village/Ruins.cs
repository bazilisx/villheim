using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Designs;
using Villheim.Prefabs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// The game's own small structures in a village's way: lean-tos, ruined huts and houses, old fences. Villagers may
    /// take them down and keep the materials (Tyler, 2026-11-09). What counts:
    ///
    /// - The piece was placed by the game: no player made it (no creator) and no village built it.
    /// - It can be broken (it has wear), and it stands inside a location that is small (RuinMaxRadius), has no
    ///   interior or dungeon, allows building, and is not on the ProtectedPlaces list (the start stones, boss altars,
    ///   traders, rune stones and the like).
    ///
    /// Pieces with no creator outside any location stay: test designs set down with commands look like that, and a
    /// village must never take those apart.
    /// </summary>
    internal static class Ruins
    {
        private static readonly Dictionary<Vector2Int, bool> Cells = new Dictionary<Vector2Int, bool>();
        private static readonly Dictionary<int, bool> Places = new Dictionary<int, bool>();
        private static string[] _protected;
        private static string _protectedRaw;

        public static bool On => LogicConfig.ClearRuins == null || LogicConfig.ClearRuins.Value;

        public static void Forget()
        {
            Cells.Clear();
            Places.Clear();
        }

        /// <summary>A piece of an old ruin the villagers may take down.</summary>
        public static bool Clearable(Piece piece)
        {
            if (!On || piece == null || piece.IsPlacedByPlayer() || piece.GetComponent<WearNTear>() == null)
            {
                return false;
            }

            ZNetView view = piece.m_nview;
            if (view == null || !view.IsValid() || view.GetZDO().GetInt(Keys.BuiltBy) != 0)
            {
                return false;
            }

            Vector3 p = piece.transform.position;
            var cell = new Vector2Int(Mathf.FloorToInt(p.x / 4f), Mathf.FloorToInt(p.z / 4f));
            if (!Cells.TryGetValue(cell, out bool clearable))
            {
                clearable = Clearable(Location.GetLocation(p, false));
                Cells[cell] = clearable;
            }

            return clearable;
        }

        /// <summary>A location whose pieces the villagers may take down.</summary>
        public static bool Clearable(Location location)
        {
            if (!On || location == null)
            {
                return false;
            }

            int id = location.GetInstanceID();
            if (Places.TryGetValue(id, out bool known))
            {
                return known;
            }

            string name = Utils.GetPrefabName(location.gameObject);
            bool clearable = name != VillageLocation.Name && !location.m_noBuild && !location.m_hasInterior &&
                             location.GetMaxRadius() <= (LogicConfig.RuinMaxRadius?.Value ?? 30f) &&
                             !Protected().Any(word => name.IndexOf(word, System.StringComparison.OrdinalIgnoreCase) >= 0);
            Places[id] = clearable;
            return clearable;
        }

        private static string[] Protected()
        {
            string raw = LogicConfig.ProtectedPlaces?.Value ?? "";
            if (_protected == null || raw != _protectedRaw)
            {
                _protectedRaw = raw;
                _protected = raw.Split(',').Select(w => w.Trim()).Where(w => w.Length > 0).ToArray();
            }

            return _protected;
        }

        /// <summary>
        /// Clears a plot before ground is broken: trees, stumps, logs, bushes and rocks go (as before), the village's own
        /// ring fence comes down, and old ruins on the plot are taken down with half their materials put in the chest.
        /// </summary>
        public static void ClearPlot(VillageHearth hearth, Foot foot)
        {
            Foot area = foot.Grown(2f);
            float y = ZoneSystem.instance.GetGroundHeight(area.CenterAt(0f));
            var seen = new HashSet<ZNetView>();
            foreach (Collider collider in Physics.OverlapBox(area.CenterAt(y + 4f), new Vector3(area.HalfX, 8f, area.HalfZ), area.Rotation))
            {
                ZNetView view = collider.GetComponentInParent<ZNetView>();
                if (view == null || !view.IsValid() || !seen.Add(view))
                {
                    continue;
                }

                GameObject go = view.gameObject;
                if (go.GetComponent<Piece>() || go.GetComponent<Character>() || go.GetComponent<ItemDrop>() ||
                    go.GetComponent<VillageHearth>() || view.GetZDO().GetInt(Keys.BuiltBy) != 0)
                {
                    continue;
                }

                bool clutter = go.GetComponent<TreeBase>() || go.GetComponent<TreeLog>() || go.GetComponent<Destructible>() ||
                               go.GetComponent<MineRock>() || go.GetComponent<MineRock5>() || go.GetComponent<Pickable>();
                if (!clutter || !area.Holds(go.transform.position) || (!go.GetComponent<Pickable>() && PlotFinder.TooBigToClear(go)))
                {
                    continue;
                }

                view.ClaimOwnership();
                ZNetScene.instance.Destroy(go);
            }

            var pieces = new List<Piece>();
            Piece.GetAllPiecesInRadius(area.CenterAt(y), area.Reach + 1f, pieces);
            Container chest = VillageChest.Find(hearth);
            int ruins = 0, fence = 0;
            var gained = new Dictionary<string, int>();
            foreach (Piece piece in pieces)
            {
                if (piece == null || !area.Holds(piece.transform.position))
                {
                    continue;
                }

                bool own = PlotFinder.OwnFence(piece.gameObject, hearth.VillageId);
                if (!own && !Clearable(piece))
                {
                    continue;
                }

                foreach (KeyValuePair<string, int> c in DesignSpawner.RecipeCost(piece.gameObject))
                {
                    if (chest != null && c.Value / 2 > 0)
                    {
                        VillageChest.Add(chest, c.Key, c.Value / 2);
                        gained[c.Key] = (gained.TryGetValue(c.Key, out int had) ? had : 0) + c.Value / 2;
                    }
                }

                piece.m_nview.ClaimOwnership();
                ZNetScene.instance.Destroy(piece.gameObject);
                if (own) fence++; else ruins++;
            }

            if (fence > 0)
            {
                Palisade.Forget(hearth.VillageId);
            }

            if (ruins + fence > 0)
            {
                string got = gained.Count > 0 ? " (" + string.Join(", ", gained.Select(g => $"{g.Value} {Materials.Label(g.Key)}")) + " to the chest)" : "";
                VillheimPlugin.Log.LogInfo($"Cleared the plot: {ruins} pieces of old ruins and {fence} fence pieces taken down{got}.");
            }
        }
    }
}
