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
            // The hearth's own pad: not held back by the guard that keeps other edits off a hearth's flat ground.
            Step("leveling the ground", () => TerrainShaper.LevelPad(at, LevelRadius, LevelRadius + 4f, 16f, false));
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

            // Checked once the ground's collider is rebuilt: one more leveling if it is not flat (Tyler: lumpy hearth
            // ground after founding).
            CheckFlat(hearth, "after founding", true);

            Container chest = VillageChest.Find(hearth);
            if (chest != null && Mathf.Abs(chest.transform.position.y - level) > 0.05f &&
                Utils.DistanceXZ(chest.transform.position, hearth.transform.position) < LevelRadius)
            {
                Move(chest.gameObject, level);
                VillageChest.Moved(hearth, chest);
            }
        }

        /// <summary>
        /// How flat the hearth's ground is: the largest step up or down from the hearth's height within the flat area,
        /// written to the log with DebugLog on. With <paramref name="fix"/>, ground that strays more than 8 cm is
        /// leveled once more.
        /// </summary>
        public static float CheckFlat(VillageHearth hearth, string when, bool fix)
        {
            if (hearth == null || !hearth.IsValid)
            {
                return 0f;
            }

            Vector3 center = hearth.transform.position;
            float radius = TerrainShaper.HearthPadRadius - 0.5f;
            float worst = TerrainShaper.MaxDeviation(center, radius, center.y);
            Perf.Debug($"{hearth.VillageName}: hearth ground {when}: the ground within {radius:0} m strays at most {worst:0.00} m from the hearth's height.");
            if (fix && worst > 0.08f)
            {
                TerrainShaper.LevelPad(center, LevelRadius, LevelRadius + 4f, 16f, false);
                Perf.Debug($"{hearth.VillageName}: hearth ground leveled again.");
            }

            return worst;
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

        /// <summary>
        /// The spot within 80 m of <paramref name="near"/> where the ground over a whole village (a circle of
        /// <paramref name="radius"/>) is most even, on dry land and clear of buildings, so the village can be levelled
        /// without steps (T-28). Even ground first, then nearness. Falls back to FlatSpotNear when nothing is dry.
        /// </summary>
        public static Vector3 FlatVillageSpot(Vector3 near, float radius)
        {
            Vector3 best = near;
            float bestScore = float.MaxValue;
            var pieces = new System.Collections.Generic.List<Piece>();
            var heights = new System.Collections.Generic.List<float>();
            int rejectedCovered = 0, rejectedCut = 0;
            for (float ring = 0f; ring <= 80f; ring += 10f)
            {
                int steps = ring < 1f ? 1 : Mathf.Max(8, Mathf.RoundToInt(ring * 0.6f));
                for (int i = 0; i < steps; i++)
                {
                    float angle = i * Mathf.PI * 2f / steps;
                    Vector3 spot = near + new Vector3(Mathf.Sin(angle), 0f, Mathf.Cos(angle)) * ring;
                    if (!ZoneSystem.instance.IsZoneLoaded(spot))
                    {
                        continue;
                    }

                    pieces.Clear();
                    Piece.GetAllPiecesInRadius(spot, radius, pieces);
                    if (pieces.Count > 0)
                    {
                        continue;
                    }

                    heights.Clear();
                    bool dry = true;
                    int covered = 0;
                    for (int r = 0; r <= 3 && dry; r++)
                    {
                        float at = radius * r / 3f;
                        int count = r == 0 ? 1 : 12;
                        for (int k = 0; k < count; k++)
                        {
                            float a = k * Mathf.PI * 2f / count;
                            Vector3 sample = spot + new Vector3(Mathf.Sin(a), 0f, Mathf.Cos(a)) * at;
                            if (!ZoneSystem.instance.GetGroundHeight(sample, out float h) || h < ZoneSystem.instance.m_waterLevel + 0.8f)
                            {
                                dry = false;
                                break;
                            }

                            // Bare ground only: no rock, cliff or anything else standing over the terrain there.
                            if (r <= 2 && Covered(sample, h))
                            {
                                covered++;
                            }

                            heights.Add(h);
                        }
                    }

                    if (!dry || heights.Count == 0)
                    {
                        continue;
                    }

                    if (covered > 1)
                    {
                        rejectedCovered++;
                        continue;
                    }

                    heights.Sort();
                    ZoneSystem.instance.GetGroundHeight(spot, out float centerY);
                    // The spread of the middle nine tenths: one boulder or ditch doesn't spoil a site.
                    float spread = heights[heights.Count * 19 / 20] - heights[heights.Count / 20];
                    float score = spread + ring * 0.03f + LowGroundPenalty(spot, centerY);
                    if (score >= bestScore)
                    {
                        continue;
                    }

                    // Walkable to the land round it, not a rock top or a ledge cut off by cliffs (Tyler: Mistlands
                    // villages went up high where the villagers could not move anywhere).
                    if (!Connected(spot, centerY, radius))
                    {
                        rejectedCut++;
                        continue;
                    }

                    bestScore = score;
                    best = new Vector3(spot.x, centerY, spot.z);
                }
            }

            Perf.Debug($"Village spot near {near}: {(bestScore < float.MaxValue ? $"chose {best} (score {bestScore:0.00})" : "none found")}; " +
                       $"{rejectedCovered} spots passed over for rock or objects on the ground, {rejectedCut} for being cut off by slopes.");
            return bestScore < float.MaxValue ? best : FlatSpotNear(near);
        }

        private static int _solidMask;

        private static int SolidMask => _solidMask != 0
            ? _solidMask
            : _solidMask = LayerMask.GetMask("Default", "static_solid", "Default_small", "piece", "terrain");

        /// <summary>
        /// Something solid that is not the ground stands over the terrain at this point (a rock, a cliff, a tree's
        /// base): the first thing a ray down from above meets is not the terrain, and stands more than 0.4 m above it.
        /// </summary>
        public static bool Covered(Vector3 point, float ground)
        {
            Vector3 from = new Vector3(point.x, ground + 60f, point.z);
            if (!Physics.Raycast(from, Vector3.down, out RaycastHit hit, 80f, SolidMask, QueryTriggerInteraction.Ignore))
            {
                return false;
            }

            if (hit.collider.GetComponentInParent<Heightmap>() != null || hit.point.y <= ground + 0.4f)
            {
                return false;
            }

            // Trees, stumps, logs and bushes are cleared when the village is founded; rocks and cliffs count.
            GameObject go = hit.collider.GetComponentInParent<ZNetView>()?.gameObject;
            return go == null || !(go.GetComponent<TreeBase>() || go.GetComponent<TreeLog>() || go.GetComponent<Pickable>() ||
                                   (go.GetComponent<Destructible>() && !go.GetComponent<MineRock>() && !go.GetComponent<MineRock5>() &&
                                    !PathPlanner.BigObstacle(go)));
        }

        /// <summary>
        /// The ground leads away from the village on gentle slopes: going out from its edge 24 m in 2 m steps, no step
        /// climbs or drops more than WalkStep and none runs into rock, in at least three of eight directions.
        /// </summary>
        public static bool Connected(Vector3 spot, float centerY, float radius)
        {
            float walkStep = LogicConfig.SiteWalkStep != null ? Mathf.Max(0.3f, LogicConfig.SiteWalkStep.Value) : 1.1f;
            int open = 0;
            for (int d = 0; d < 8; d++)
            {
                float angle = d * Mathf.PI / 4f;
                var dir = new Vector3(Mathf.Sin(angle), 0f, Mathf.Cos(angle));
                float last = centerY;
                bool ok = true;
                for (float r = 2f; r <= radius + 24f; r += 2f)
                {
                    Vector3 p = spot + dir * r;
                    if (!ZoneSystem.instance.GetGroundHeight(p, out float h) || h < ZoneSystem.instance.m_waterLevel - 0.5f)
                    {
                        ok = false;
                        break;
                    }

                    // Inside the village the ground is leveled later; only the way out has to be walkable as it is.
                    if (r > radius && (Mathf.Abs(h - last) > walkStep || Covered(p, h)))
                    {
                        ok = false;
                        break;
                    }

                    last = h;
                }

                if (ok && ++open >= 3)
                {
                    return true;
                }
            }

            return false;
        }

        /// <summary>
        /// In the Mistlands, a site above the low ground round it scores worse (Tyler: villages there went up on the
        /// tall rocks). The penalty grows with the height over the lowest dry ground within 50 m.
        /// </summary>
        private static float LowGroundPenalty(Vector3 spot, float y)
        {
            if (WorldGenerator.instance == null || WorldGenerator.instance.GetBiome(spot) != Heightmap.Biome.Mistlands)
            {
                return 0f;
            }

            float low = y;
            for (int ring = 1; ring <= 2; ring++)
            {
                for (int k = 0; k < 12; k++)
                {
                    float a = k * Mathf.PI / 6f;
                    Vector3 p = spot + new Vector3(Mathf.Sin(a), 0f, Mathf.Cos(a)) * (25f * ring);
                    if (ZoneSystem.instance.GetGroundHeight(p, out float h) && h > ZoneSystem.instance.m_waterLevel + 0.8f)
                    {
                        low = Mathf.Min(low, h);
                    }
                }
            }

            float weight = LogicConfig.MistlandsLowGround != null ? LogicConfig.MistlandsLowGround.Value : 0.3f;
            return Mathf.Max(0f, y - low) * weight;
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
            if (pieces.Count > 0 || Covered(center, centerY))
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
