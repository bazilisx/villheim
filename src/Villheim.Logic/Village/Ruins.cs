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
        /// ring fence comes down, and old ruins on the plot are taken down with all their materials put in the chest (D-088).
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
            PieceIndex.InRadius(area.CenterAt(y), area.Reach + 1f, pieces);
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
                    // All of it, as a player gets (D-088).
                    if (chest != null && c.Value > 0)
                    {
                        VillageChest.Add(chest, c.Key, c.Value);
                        gained[c.Key] = (gained.TryGetValue(c.Key, out int had) ? had : 0) + c.Value;
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

        // ---------------------------------------------------------------- clearing a plot by hand (D-087)

        private static readonly List<Piece> PlotPieces = new List<Piece>();

        /// <summary>
        /// The next thing to take off a plot: a ruin or fence piece (the highest first), else a tree, log, stump, bush,
        /// rock that is not too big, or plant (nearest the middle first). Null when the plot is clear.
        /// </summary>
        public static GameObject NextOnPlot(VillageHearth hearth, Foot area)
        {
            float y = ZoneSystem.instance.GetGroundHeight(area.CenterAt(0f));
            PlotPieces.Clear();
            PieceIndex.InRadius(area.CenterAt(y), area.Reach + 1f, PlotPieces);
            Piece highest = null;
            foreach (Piece piece in PlotPieces)
            {
                if (piece == null || piece.m_nview == null || !piece.m_nview.IsValid() || !area.Holds(piece.transform.position))
                {
                    continue;
                }

                if (!PlotFinder.OwnFence(piece.gameObject, hearth.VillageId) && !Clearable(piece))
                {
                    continue;
                }

                if (highest == null || piece.transform.position.y > highest.transform.position.y)
                {
                    highest = piece;
                }
            }

            if (highest != null)
            {
                return highest.gameObject;
            }

            GameObject nearest = null;
            float best = float.MaxValue;
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

                float d = Utils.DistanceXZ(go.transform.position, area.CenterAt(y));
                if (d < best)
                {
                    best = d;
                    nearest = go;
                }
            }

            return nearest;
        }

        /// <summary>
        /// Takes one thing off a plot after the villager's work on it: what it gives (a piece's whole recipe, a tree's
        /// wood with its log's, a rock's stone, a plant's crop) goes to the chest, or to the village's stock when the
        /// chest is full.
        /// </summary>
        public static void TakeAway(VillageHearth hearth, VillageState state, GameObject target)
        {
            var gives = new Dictionary<string, int>();
            void Add(string item, int amount)
            {
                if (!string.IsNullOrEmpty(item) && amount > 0)
                {
                    gives[item] = (gives.TryGetValue(item, out int had) ? had : 0) + amount;
                }
            }

            void Roll(DropTable table, int times = 1)
            {
                if (table == null)
                {
                    return;
                }

                for (int i = 0; i < Mathf.Clamp(times, 1, 12); i++)
                {
                    foreach (GameObject drop in table.GetDropList())
                    {
                        Add(drop != null ? drop.name : null, 1);
                    }
                }
            }

            EffectList effect = null;
            Piece piece = target.GetComponent<Piece>();
            if (piece != null)
            {
                foreach (KeyValuePair<string, int> c in DesignSpawner.RecipeCost(target))
                {
                    Add(c.Key, c.Value);
                }

                effect = target.GetComponent<WearNTear>()?.m_destroyedEffect;
                if (PlotFinder.OwnFence(target, hearth.VillageId))
                {
                    Palisade.Forget(hearth.VillageId);
                }
            }
            else if (target.TryGetComponent(out TreeBase tree))
            {
                Roll(tree.m_dropWhenDestroyed);
                TreeLog log = tree.m_logPrefab != null ? tree.m_logPrefab.GetComponent<TreeLog>() : null;
                for (int depth = 0; log != null && depth < 3; depth++)
                {
                    Roll(log.m_dropWhenDestroyed);
                    TreeLog sub = log.m_subLogPrefab != null ? log.m_subLogPrefab.GetComponent<TreeLog>() : null;
                    if (sub != null)
                    {
                        Roll(sub.m_dropWhenDestroyed, Mathf.Max(1, log.m_subLogPoints.Length) - 1);
                    }

                    log = sub;
                }

                effect = tree.m_destroyedEffect;
            }
            else if (target.TryGetComponent(out TreeLog loose))
            {
                Roll(loose.m_dropWhenDestroyed);
                effect = loose.m_destroyedEffect;
            }
            else if (target.TryGetComponent(out MineRock5 big))
            {
                Roll(big.m_dropItems, big.m_hitAreas != null ? big.m_hitAreas.Count : 1);
                effect = big.m_destroyedEffect;
            }
            else if (target.TryGetComponent(out MineRock rock))
            {
                Roll(rock.m_dropItems);
                effect = rock.m_destroyedEffect;
            }
            else if (target.TryGetComponent(out Pickable plant))
            {
                Add(plant.m_itemPrefab != null ? plant.m_itemPrefab.name : null, plant.m_amount);
            }
            else if (target.TryGetComponent(out Destructible thing))
            {
                Roll(target.GetComponent<DropOnDestroyed>()?.m_dropWhenDestroyed);
                effect = thing.m_destroyedEffect;
            }

            Container chest = VillageChest.Find(hearth);
            foreach (KeyValuePair<string, int> give in gives)
            {
                int left = give.Value - (chest != null ? VillageChest.Add(chest, give.Key, give.Value) : 0);
                if (left > 0 && Materials.Tracked.Contains(give.Key))
                {
                    state.Add(give.Key, left);
                }
            }

            string what = Utils.GetPrefabName(target);
            effect?.Create(target.transform.position, target.transform.rotation);
            ZNetView view = target.GetComponent<ZNetView>();
            if (view != null && view.IsValid())
            {
                view.ClaimOwnership();
                ZNetScene.instance.Destroy(target);
            }

            Perf.Debug($"{hearth.VillageName}: took {what} off the plot" +
                       (gives.Count > 0 ? " (" + string.Join(", ", gives.Select(g => $"{g.Value} {g.Key}")) + ")" : "") + ".");
        }
    }
}
