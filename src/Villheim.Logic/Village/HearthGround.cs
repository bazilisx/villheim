using UnityEngine;
using Villheim.Logic.Designs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// The ground around a village's hearth, and where a hearth goes.
    ///
    /// When a village is founded, the hearth area is made ready for the hearth, the chest, the cooking station, the
    /// sign and the notice board, and for the longhouse that may grow around them: trees, stumps, logs, rocks, bushes
    /// and loose sticks and stones within 12 m are cleared, the ground is levelled at the hearth's height out to 7 m
    /// (smoothed out to 11 m), and grass and swaying plants are cleared from the ground out to 12 m, so it reads as a
    /// bare meadow floor.
    ///
    /// A hearth lit by hand goes on the nearest flat spot within 40 m, not wherever the player happens to stand.
    /// </summary>
    internal static class HearthGround
    {
        public const float ClearRadius = 13f;
        public const float LevelRadius = 10f;
        private const float DirtRadius = 9f;

        /// <summary>
        /// Readies the ground round a hearth: clears it, levels it at the height most of the ground there already has
        /// (so it doesn't become a bowl or a mound), moves the hearth and its chest to that level, and takes the grass
        /// off (bare earth near the fire, cleared grass beyond, per HearthGroundPaint).
        /// </summary>
        public static void Prepare(VillageHearth hearth)
        {
            Vector3 center = hearth.transform.position;
            float level = TypicalHeight(center, LevelRadius, center.y);
            Vector3 at = new Vector3(center.x, level, center.z);

            // Found before the ground moves: the chest is looked up by where it was recorded.
            Container chest = VillageChest.Find(hearth);

            // Each step on its own, so one that fails can't skip the others; a failure goes to the log.
            Step("clearing trees, rocks and bushes", () => ClearAround(center, ClearRadius));
            Step("levelling the ground", () => TerrainShaper.LevelPad(at, LevelRadius, LevelRadius + 4f));
            Step("setting the hearth on the new ground", () => SetOnGround(hearth, chest, level));

            string paint = (LogicConfig.HearthGroundPaint?.Value ?? "Both").Trim().ToLowerInvariant();
            if (paint != "dirt")
            {
                Step("clearing the grass", () => ClearVegetation(at, ClearRadius));
            }

            if (paint == "dirt" || paint == "both")
            {
                Step("baring the earth by the fire", () => Paint(at, paint == "dirt" ? ClearRadius : DirtRadius, TerrainModifier.PaintType.Dirt));
            }

            // Once more after the game has rebuilt the ground's collider, in case anything was set down early.
            hearth.StartCoroutine(SettleLater(hearth, level));
            VillheimPlugin.Log.LogInfo($"Hearth ground prepared at {at} ({paint}).");
        }

        /// <summary>The village's small pieces by the fire, which sit on the ground there.</summary>
        private static readonly System.Collections.Generic.HashSet<string> GroundPieces =
            new System.Collections.Generic.HashSet<string> { "piece_chest_wood", "sign", "piece_bench01", "wood_stack", "stone_pile", "piece_chair" };

        /// <summary>
        /// Puts the hearth, the chest and the village's small pieces by the fire on the levelled ground. The cooking
        /// station over the fire moves with the hearth. The chest's new place is recorded, so it is still found (a chest
        /// not found where it was recorded counts as lost and gets built again).
        /// </summary>
        private static void SetOnGround(VillageHearth hearth, Container chest, float level)
        {
            float rise = level - hearth.transform.position.y;
            Vector3 center = hearth.transform.position;
            Move(hearth.gameObject, level);
            if (chest != null && Utils.DistanceXZ(chest.transform.position, center) < LevelRadius)
            {
                Move(chest.gameObject, level);
                VillageChest.Moved(hearth, chest);
            }

            int id = hearth.VillageId;
            var moves = new System.Collections.Generic.List<(GameObject Go, float Y)>();
            foreach (ZNetView view in ZNetScene.instance.m_instances.Values)
            {
                if (view == null || !view.IsValid() || view.GetZDO().GetInt(Keys.BuiltBy) != id ||
                    Utils.DistanceXZ(view.transform.position, center) > LevelRadius - 0.5f || (chest != null && view.gameObject == chest.gameObject))
                {
                    continue;
                }

                string name = Utils.GetPrefabName(view.gameObject);
                if (name == "piece_cookingstation" && Utils.DistanceXZ(view.transform.position, center) < 1.5f)
                {
                    moves.Add((view.gameObject, view.transform.position.y + rise));
                }
                else if (GroundPieces.Contains(name))
                {
                    moves.Add((view.gameObject, level));
                }
            }

            foreach ((GameObject go, float y) in moves)
            {
                Move(go, y);
            }
        }

        private static System.Collections.IEnumerator SettleLater(VillageHearth hearth, float level)
        {
            yield return new WaitForSeconds(1.5f);
            if (hearth == null || !hearth.IsValid)
            {
                yield break;
            }

            Container chest = VillageChest.Find(hearth);
            if (chest != null && Mathf.Abs(chest.transform.position.y - level) > 0.05f &&
                Utils.DistanceXZ(chest.transform.position, hearth.transform.position) < LevelRadius)
            {
                Move(chest.gameObject, level);
                VillageChest.Moved(hearth, chest);
            }
        }

        /// <summary>The middle height of the ground in the circle: half the ground is above it, half below.</summary>
        private static float TypicalHeight(Vector3 center, float radius, float fallback)
        {
            var heights = new System.Collections.Generic.List<float>();
            for (int ring = 0; ring <= 3; ring++)
            {
                float r = radius * ring / 3f;
                int count = ring == 0 ? 1 : 12;
                for (int i = 0; i < count; i++)
                {
                    float angle = i * Mathf.PI * 2f / count;
                    Vector3 sample = center + new Vector3(Mathf.Sin(angle), 0f, Mathf.Cos(angle)) * r;
                    if (ZoneSystem.instance.GetGroundHeight(sample, out float h))
                    {
                        heights.Add(h);
                    }
                }
            }

            if (heights.Count == 0)
            {
                return fallback;
            }

            heights.Sort();
            return heights[heights.Count / 2];
        }

        private static void Move(GameObject go, float y)
        {
            ZNetView view = go.GetComponent<ZNetView>();
            if (view == null || !view.IsValid())
            {
                return;
            }

            view.ClaimOwnership();
            Vector3 p = go.transform.position;
            p.y = y;
            go.transform.position = p;
            view.GetZDO().SetPosition(p);
        }

        /// <summary>
        /// Clears trees, stumps, logs, rocks, bushes and loose sticks and stones, going by the game's list of loaded
        /// objects (not colliders, which missed small stones). Pieces, creatures, dropped items and the village's own
        /// things are never touched.
        /// </summary>
        public static void ClearAround(Vector3 center, float radius)
        {
            var doomed = new System.Collections.Generic.List<ZNetView>();
            foreach (ZNetView view in ZNetScene.instance.m_instances.Values)
            {
                if (view == null || !view.IsValid() || Utils.DistanceXZ(view.transform.position, center) > radius)
                {
                    continue;
                }

                GameObject go = view.gameObject;
                if (go.GetComponent<Piece>() || go.GetComponent<Character>() || go.GetComponent<ItemDrop>() ||
                    go.GetComponent<VillageHearth>() || view.GetZDO().GetInt(Keys.BuiltBy) != 0)
                {
                    continue;
                }

                if (go.GetComponent<TreeBase>() || go.GetComponent<TreeLog>() || go.GetComponent<Destructible>() ||
                    go.GetComponent<MineRock>() || go.GetComponent<MineRock5>() || go.GetComponent<Pickable>())
                {
                    doomed.Add(view);
                }
            }

            foreach (ZNetView view in doomed)
            {
                view.ClaimOwnership();
                ZNetScene.instance.Destroy(view.gameObject);
            }
        }

        private static void Step(string what, System.Action action)
        {
            try
            {
                action();
            }
            catch (System.Exception e)
            {
                VillheimPlugin.Log.LogWarning($"Hearth ground: {what} failed: {e.Message}");
            }
        }

        public static void Paint(Vector3 center, float radius, TerrainModifier.PaintType type)
        {
            TerrainOp.Settings settings = TerrainShaper.NewSettings();
            settings.m_paintCleared = true;
            settings.m_paintType = type;
            settings.m_paintRadius = radius;
            settings.m_paintHeightCheck = false;
            TerrainShaper.Apply(center, settings);
        }

        /// <summary>Takes grass and swaying plants off the ground (the game's own "clear vegetation" paint).</summary>
        public static void ClearVegetation(Vector3 center, float radius)
        {
            TerrainOp.Settings settings = TerrainShaper.NewSettings();
            settings.m_paintCleared = true;
            settings.m_paintType = TerrainModifier.PaintType.ClearVegetation;
            settings.m_paintRadius = radius;
            settings.m_paintHeightCheck = false;
            TerrainShaper.Apply(center, settings);
        }

        /// <summary>
        /// The nearest spot within 40 m of <paramref name="near"/> where the ground across a hearth area is nearly
        /// flat, on dry land and clear of buildings. Falls back to the flattest spot found.
        /// </summary>
        public static Vector3 FlatSpotNear(Vector3 near)
        {
            Vector3 best = near;
            float bestScore = float.MaxValue;
            for (float ring = 0f; ring <= 40f; ring += 4f)
            {
                int steps = ring < 1f ? 1 : Mathf.Max(8, Mathf.RoundToInt(ring * 1.5f));
                for (int i = 0; i < steps; i++)
                {
                    float angle = i * Mathf.PI * 2f / steps;
                    Vector3 spot = near + new Vector3(Mathf.Sin(angle), 0f, Mathf.Cos(angle)) * ring;
                    if (!Flatness(spot, out float spread, out float y))
                    {
                        continue;
                    }

                    // Flatness first, then nearness: a spot within half a metre of level wins at the shortest walk.
                    float score = (spread < 0.6f ? 0f : spread * 10f) + ring * 0.05f;
                    if (score < bestScore)
                    {
                        bestScore = score;
                        best = new Vector3(spot.x, y, spot.z);
                    }
                }

                if (bestScore < 1f)
                {
                    break;
                }
            }

            return best;
        }

        private static bool Flatness(Vector3 center, out float spread, out float centerY)
        {
            spread = float.MaxValue;
            centerY = 0f;
            if (!ZoneSystem.instance.GetGroundHeight(center, out centerY) || centerY < ZoneSystem.instance.m_waterLevel + 1f)
            {
                return false;
            }

            var pieces = new System.Collections.Generic.List<Piece>();
            Piece.GetAllPiecesInRadius(center, ClearRadius, pieces);
            if (pieces.Count > 0)
            {
                return false;
            }

            float min = centerY;
            float max = centerY;
            for (int i = 0; i < 12; i++)
            {
                float angle = i * Mathf.PI / 6f;
                foreach (float r in new[] { 3.5f, LevelRadius })
                {
                    Vector3 sample = center + new Vector3(Mathf.Sin(angle), 0f, Mathf.Cos(angle)) * r;
                    if (!ZoneSystem.instance.GetGroundHeight(sample, out float h) || h < ZoneSystem.instance.m_waterLevel + 0.5f)
                    {
                        return false;
                    }

                    min = Mathf.Min(min, h);
                    max = Mathf.Max(max, h);
                }
            }

            spread = max - min;
            return true;
        }
    }
}
