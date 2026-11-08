using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Raised walkways on stilts (Tyler, 2026-11-08, D-038). In a village of a BoardwalkCultures culture (the fen-folk
    /// and the Celtic crannog builders), where a path crosses wet ground (no higher than BoardwalkWetHeight over the
    /// water), the villager laying it puts down a boardwalk instead of dirt: a vanilla wood_floor_1x1 on each metre of
    /// the path (the path grid is a metre, so the boards tile), held up by vanilla wood poles that reach into the
    /// ground, so every board stands on its own posts. The deck sits half a metre over the water, or 0.3 m over the
    /// ground where that is higher. Paid from the village chest; when the chest cannot pay, that metre is dirt.
    /// Village pieces take no rain or water damage (WaterProof), so the posts can stand in the water.
    /// </summary>
    internal static class Boardwalks
    {
        private const string Deck = "wood_floor_1x1";
        private const string LongPole = "wood_pole2";
        private const string ShortPole = "wood_pole";
        private const float OverWater = 0.5f;
        private const float OverGround = 0.3f;
        private const float MaxPosts = 4f;

        /// <summary>This village lays boardwalks, and the ground at the point is wet.</summary>
        public static bool Wants(VillageHearth hearth, Vector3 point)
        {
            if (hearth == null || !hearth.IsValid || ZoneSystem.instance == null)
            {
                return false;
            }

            string culture = Cultures.Of(hearth);
            string list = LogicConfig.BoardwalkCultures?.Value ?? "fen-folk, celtic-crannog";
            if (!list.Split(',').Any(c => c.Trim() == culture))
            {
                return false;
            }

            float wet = LogicConfig.BoardwalkWetHeight?.Value ?? 0.8f;
            return ZoneSystem.instance.GetGroundHeight(point, out float y) && y < ZoneSystem.instance.m_waterLevel + wet;
        }

        /// <summary>Lays the boardwalk for the path metre at this point. False when it could not (no wood, too deep).</summary>
        public static bool Lay(VillageHearth hearth, Vector3 point)
        {
            Vector2Int cell = PathPlanner.Cell(point);
            Vector3 at = new Vector3(cell.x, 0f, cell.y);
            if (!ZoneSystem.instance.GetGroundHeight(at, out float ground))
            {
                return false;
            }

            GameObject deck = ZNetScene.instance.GetPrefab(Deck);
            GameObject longPole = ZNetScene.instance.GetPrefab(LongPole);
            GameObject shortPole = ZNetScene.instance.GetPrefab(ShortPole);
            if (deck == null || longPole == null || shortPole == null)
            {
                return false;
            }

            float water = ZoneSystem.instance.m_waterLevel;
            float top = Mathf.Max(water + OverWater, ground + OverGround);
            Bounds deckBox = Designs.BuildOrder.Measure(deck, Deck, Vector3.zero, Quaternion.identity, Vector3.one) ??
                             new Bounds(new Vector3(0f, -0.1f, 0f), new Vector3(1f, 0.2f, 1f));
            float deckY = top - deckBox.max.y;
            float deckBottom = deckY + deckBox.min.y;
            if (deckBottom - ground > MaxPosts)
            {
                return false;
            }

            if (Stands(hearth.VillageId, Deck, new Vector3(at.x, deckY + deckBox.center.y, at.z)))
            {
                return true;
            }

            // Posts from the deck down into the ground: the long pole while there is room for it, then the short one.
            var pieces = new List<(GameObject Prefab, string Name, Vector3 Position)>();
            float bottomOf = deckBottom + 0.02f;
            while (bottomOf > ground - 0.1f)
            {
                bool tall = bottomOf - ground > 1.5f;
                GameObject pole = tall ? longPole : shortPole;
                string name = tall ? LongPole : ShortPole;
                Bounds box = Designs.BuildOrder.Measure(pole, name, Vector3.zero, Quaternion.identity, Vector3.one) ??
                             new Bounds(Vector3.zero, new Vector3(0.2f, tall ? 2f : 1f, 0.2f));
                float y = bottomOf - box.max.y;
                pieces.Insert(0, (pole, name, new Vector3(at.x - box.center.x, y, at.z - box.center.z)));
                bottomOf = y + box.min.y;
            }

            pieces.Add((deck, Deck, new Vector3(at.x - deckBox.center.x, deckY, at.z - deckBox.center.z)));

            var cost = new Dictionary<string, int>();
            var state = new VillageState(hearth.Zdo);
            foreach (var piece in pieces)
            {
                if (!Amenities.Buildable(piece.Prefab, state.Biome, out Dictionary<string, int> part, true))
                {
                    return false;
                }

                foreach (KeyValuePair<string, int> p in part)
                {
                    cost.TryGetValue(p.Key, out int n);
                    cost[p.Key] = n + p.Value;
                }
            }

            Container chest = VillageChest.Find(hearth);
            if (chest == null || !VillageChest.Take(chest, cost))
            {
                return false;
            }

            foreach (var piece in pieces)
            {
                GameObject made = Object.Instantiate(piece.Prefab, piece.Position, Quaternion.identity);
                ZNetView view = made.GetComponent<ZNetView>();
                view?.GetZDO()?.Set(Keys.BuiltBy, hearth.VillageId);
                if (made.TryGetComponent(out Piece placed))
                {
                    placed.m_placeEffect?.Create(piece.Position, Quaternion.identity, made.transform);
                }
            }

            return true;
        }

        private static bool Stands(int villageId, string prefab, Vector3 at)
        {
            foreach (Collider collider in Physics.OverlapSphere(at, 0.3f, LayerMask.GetMask("piece", "piece_nonsolid")))
            {
                ZNetView view = collider.GetComponentInParent<ZNetView>();
                if (view != null && view.IsValid() && Utils.GetPrefabName(view.gameObject) == prefab &&
                    view.GetZDO().GetInt(Keys.BuiltBy) == villageId)
                {
                    return true;
                }
            }

            return false;
        }
    }
}
