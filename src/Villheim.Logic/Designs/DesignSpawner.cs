using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Object = UnityEngine.Object;
using Random = UnityEngine.Random;

namespace Villheim.Logic.Designs
{
    /// <summary>
    /// Copies an existing location design into the world at a new spot.
    ///
    /// Only the networked objects of the design are copied (building pieces, beds, chests, fires and so on),
    /// using the same prefabs the game already has. Decorative ruin dressing that is not networked, creatures and
    /// spawners are left out, which turns abandoned houses into lived-in ones. The design's own terrain leveling is
    /// replayed as permanent terrain edits so the ground matches the original.
    ///
    /// The spawning approach follows OrianaVenture's Location Reset mod (MIT).
    /// </summary>
    internal static class DesignSpawner
    {
        internal sealed class Result
        {
            public bool Success;
            public int Spawned;
            public int Skipped;
            public string Error;
        }

        public static IEnumerator Build(ZoneSystem.ZoneLocation location, Vector3 origin, float yaw, int seed, int villageId,
            Result result)
        {
            Designs.AssetGuard.Load(location);
            try
            {
                GameObject asset = location.m_prefab.Asset;
                if (asset == null)
                {
                    result.Error = $"Could not load the design '{location.m_prefabName}'.";
                    yield break;
                }

                Quaternion rotation = Quaternion.Euler(0f, yaw, 0f);
                float radius = DesignLibrary.Radius(location);

                ClearArea(origin, radius);
                ShapeTerrain(asset, origin, rotation, radius);

                // Give the heightmaps a moment to rebuild before objects are placed and snapped to the ground.
                yield return new WaitForSeconds(0.75f);

                SpawnObjects(asset, origin, rotation, seed, villageId, result);
                result.Success = result.Spawned > 0;
                if (!result.Success && result.Error == null)
                {
                    result.Error = $"The design '{location.m_prefabName}' had nothing to build.";
                }
            }
            finally
            {
                location.m_prefab.Release();
            }
        }

        /// <summary>
        /// Lists what copying a design would and would not include. Used by the dump command.
        /// </summary>
        public static IEnumerable<string> Describe(GameObject asset)
        {
            Transform root = asset.transform;
            foreach (ZNetView view in Utils.GetEnabledComponentsInChildren<ZNetView>(asset))
            {
                string name = Utils.GetPrefabName(view.gameObject);
                GameObject prefab = ZNetScene.instance ? ZNetScene.instance.GetPrefab(name) : null;
                string reason = prefab == null ? "no prefab" : ExclusionReason(prefab, name);
                string components = string.Join(",", view.GetComponents<Component>()
                    .Where(c => c != null && !(c is Transform))
                    .Select(c => c.GetType().Name));
                Vector3 local = root.InverseTransformPoint(view.transform.position);
                yield return $"{(reason == null ? "KEEP" : "SKIP")}  {name}  at {local}  [{components}]" +
                             (reason == null ? "" : $"  ({reason})");
            }

            yield return $"TerrainModifiers: {Utils.GetEnabledComponentsInChildren<TerrainModifier>(asset).Length}, " +
                         $"RandomSpawns: {Utils.GetEnabledComponentsInChildren<RandomSpawn>(asset).Length}";
        }

        /// <summary>One object of a design, in the order it should be built.</summary>
        internal sealed class PlanEntry
        {
            public string Prefab;
            public Vector3 LocalPosition;
            public Quaternion LocalRotation;
            public Vector3 Scale;
            public int Stage;
            public bool Structural;

            /// <summary>Walls, floors, beams, roofs, doors and windows: the pieces that hold each other up.</summary>
            public bool Shell;

            /// <summary>The space the piece takes up, in the design's coordinates.</summary>
            public Bounds? Bounds;

            /// <summary>Tracked materials from the piece's vanilla recipe (Wood, Stone and so on).</summary>
            public Dictionary<string, int> Cost = new Dictionary<string, int>();

            /// <summary>For a material swap stand-in: the piece it stands in for, and that piece's own rotation.</summary>
            public string SwappedFrom;
            public Quaternion OriginalRotation = Quaternion.identity;
        }

        // Stage names for progress. The shell (structure, roofs, doors and windows) goes up in support order, see
        // BuildOrder; everything inside comes after it.
        public const int StageStructure = 0;
        public const int StageRoof = 1;
        public const int StageOpenings = 2;
        public const int StageInterior = 3;

        public static readonly string[] StageNames = { "walls", "roof", "doors and windows", "furnishing" };

        /// <summary>
        /// Lists the objects a copy of the design contains, in build order. The design's random parts are rolled
        /// with the seed, so the same seed always gives the same plan.
        ///
        /// With <paramref name="supportOrder"/> the shell goes up so every piece is held when placed (see BuildOrder),
        /// then the interior. Without it, the older order: stage first (structure, roof, openings, interior), then
        /// height. Sites started before the support order keep the old one, so their piece count stays right.
        /// </summary>
        public static List<PlanEntry> MakePlan(GameObject asset, Vector3 origin, int seed, float yaw = 0f, bool supportOrder = true)
        {
            var plan = new List<PlanEntry>();
            Transform root = asset.transform;
            ZNetView[] views = Utils.GetEnabledComponentsInChildren<ZNetView>(asset);
            SpawnPrefab[] spawnPrefabs = Utils.GetEnabledComponentsInChildren<SpawnPrefab>(asset);
            RandomSpawn[] randomSpawns = Utils.GetEnabledComponentsInChildren<RandomSpawn>(asset);

            Random.State previousRandom = Random.state;
            try
            {
                foreach (RandomSpawn randomSpawn in randomSpawns)
                {
                    randomSpawn.Prepare();
                }

                Random.InitState(seed);
                foreach (RandomSpawn randomSpawn in randomSpawns)
                {
                    if (VillheimConfig.UseVanillaRandomness.Value)
                    {
                        randomSpawn.Randomize(origin);
                    }
                    else
                    {
                        randomSpawn.SetSpawned(true);
                    }
                }

                foreach (ZNetView view in views)
                {
                    if (view.gameObject.activeSelf)
                    {
                        AddEntry(plan, view.gameObject, Utils.GetPrefabName(view.gameObject), root);
                    }
                }

                foreach (SpawnPrefab spawnPrefab in spawnPrefabs)
                {
                    if (spawnPrefab.gameObject.activeSelf && spawnPrefab.m_prefab != null)
                    {
                        AddEntry(plan, spawnPrefab.gameObject, Utils.GetPrefabName(spawnPrefab.m_prefab), root);
                    }
                }
            }
            finally
            {
                // The design asset is shared with the world generator, so put it back exactly as it was.
                foreach (RandomSpawn randomSpawn in randomSpawns)
                {
                    randomSpawn.Reset();
                }

                foreach (ZNetView view in views)
                {
                    view.gameObject.SetActive(true);
                }

                Random.state = previousRandom;
            }

            if (!supportOrder)
            {
                // Ground up within each stage. The sort is stable, so equal heights keep the design's own order.
                return plan.OrderBy(e => StageOf(e.Prefab, e.Structural)).ThenBy(e => Mathf.Round(e.LocalPosition.y * 4f)).ToList();
            }

            return Order(plan, origin, yaw);
        }

        /// <summary>Shell in support order (see BuildOrder), then everything inside, ground up.</summary>
        public static List<PlanEntry> Order(List<PlanEntry> plan, Vector3 origin, float yaw)
        {
            Quaternion rotation = Quaternion.Euler(0f, yaw, 0f);
            float? GroundAt(Vector3 local)
            {
                Vector3 world = origin + rotation * local;
                return ZoneSystem.instance != null && ZoneSystem.instance.GetGroundHeight(world, out float height)
                    ? height - origin.y
                    : (float?)null;
            }

            List<PlanEntry> ordered = BuildOrder.Order(plan.Where(e => e.Shell).ToList(), GroundAt);
            ordered.AddRange(plan.Where(e => !e.Shell).OrderBy(e => Mathf.Round(e.LocalPosition.y * 4f)));
            return ordered;
        }

        private static void AddEntry(List<PlanEntry> plan, GameObject original, string prefabName, Transform root)
        {
            Vector3 position = root.InverseTransformPoint(original.transform.position);
            Quaternion rotation = Quaternion.Inverse(root.rotation) * original.transform.rotation;
            PlanEntry entry = Entry(prefabName, position, rotation, original.transform.lossyScale);
            if (entry != null)
            {
                plan.Add(entry);
            }
        }

        /// <summary>A plan entry for one piece in design coordinates, or null when that prefab is left out.</summary>
        public static PlanEntry Entry(string prefabName, Vector3 position, Quaternion rotation, Vector3 scale)
        {
            GameObject prefab = ZNetScene.instance.GetPrefab(prefabName);
            if (prefab == null || ExclusionReason(prefab, prefabName) != null)
            {
                return null;
            }

            bool structural = prefab.GetComponent<WearNTear>() != null && prefab.GetComponent<Piece>() != null;
            bool shell = structural && IsShell(prefab.GetComponent<Piece>(), prefabName);
            return new PlanEntry
            {
                Cost = RecipeCost(prefab),
                Prefab = prefabName,
                LocalPosition = position,
                LocalRotation = rotation,
                Scale = scale,
                Stage = shell ? StageOf(prefabName, true) : StageInterior,
                Structural = structural,
                Shell = shell,
                Bounds = shell ? BuildOrder.Measure(prefab, prefabName, position, rotation, scale) : null,
            };
        }

        /// <summary>Building pieces from the hammer's building tabs, plus anything named like a door or window.</summary>
        private static bool IsShell(Piece piece, string prefabName)
        {
            return IsOpening(prefabName) || piece.m_category == Piece.PieceCategory.BuildingWorkbench ||
                   piece.m_category == Piece.PieceCategory.BuildingStonecutter;
        }

        private static bool IsOpening(string prefabName)
        {
            string lower = prefabName.ToLowerInvariant();
            return lower.Contains("door") || lower.Contains("gate") || lower.Contains("window") || lower.Contains("hatch");
        }

        /// <summary>The tracked materials a piece costs in vanilla, from its build recipe.</summary>
        /// <summary>Every resource in the piece's recipe, tracked or not (wood, black marble, iron nails...).</summary>
        public static IEnumerable<string> AllResources(GameObject prefab)
        {
            Piece piece = prefab.GetComponent<Piece>();
            if (piece?.m_resources == null)
            {
                yield break;
            }

            foreach (Piece.Requirement requirement in piece.m_resources)
            {
                if (requirement?.m_resItem != null && requirement.m_amount > 0)
                {
                    yield return requirement.m_resItem.gameObject.name;
                }
            }
        }

        public static Dictionary<string, int> RecipeCost(GameObject prefab)
        {
            var cost = new Dictionary<string, int>();
            Piece piece = prefab.GetComponent<Piece>();
            if (piece?.m_resources == null)
            {
                return cost;
            }

            foreach (Piece.Requirement requirement in piece.m_resources)
            {
                if (requirement?.m_resItem == null || requirement.m_amount <= 0)
                {
                    continue;
                }

                string material = requirement.m_resItem.gameObject.name;
                if (Village.Materials.Tracked.Contains(material))
                {
                    cost.TryGetValue(material, out int amount);
                    cost[material] = amount + requirement.m_amount;
                }
            }

            return cost;
        }

        /// <summary>The stage a piece belongs to. Also the sort key of the older build order, so keep it as it is.</summary>
        private static int StageOf(string name, bool structural)
        {
            if (IsOpening(name))
            {
                return StageOpenings;
            }

            string lower = name.ToLowerInvariant();

            if (!structural)
            {
                return StageInterior;
            }

            return lower.Contains("roof") ? StageRoof : StageStructure;
        }

        /// <summary>Places one planned object as a real networked object, tagged with the village that built it.</summary>
        public static GameObject SpawnEntry(PlanEntry entry, Vector3 origin, Quaternion rotation, int villageId, bool effects)
        {
            GameObject prefab = ZNetScene.instance.GetPrefab(entry.Prefab);
            if (prefab == null)
            {
                return null;
            }

            Vector3 position = origin + rotation * entry.LocalPosition;
            Quaternion worldRotation = rotation * entry.LocalRotation;

            // Some designs scale their pieces. The scale has to be on the prefab while it wakes up so the
            // network view records it, so set it briefly and restore it afterwards.
            Vector3 prefabScale = prefab.transform.localScale;
            bool scaled = (entry.Scale - prefabScale).sqrMagnitude > 0.0001f;
            bool previousDamage = WearNTear.m_randomInitialDamage;
            if (scaled)
            {
                prefab.transform.localScale = entry.Scale;
            }

            GameObject instance;
            try
            {
                // Villages are lived in: never apply the random wear that ruins get.
                WearNTear.m_randomInitialDamage = false;
                instance = Object.Instantiate(prefab, position, worldRotation);
            }
            finally
            {
                WearNTear.m_randomInitialDamage = previousDamage;
                if (scaled)
                {
                    prefab.transform.localScale = prefabScale;
                }
            }

            ZNetView view = instance.GetComponent<ZNetView>();
            if (view != null && view.GetZDO() != null && villageId != 0)
            {
                view.GetZDO().Set(Keys.BuiltBy, villageId);
            }

            if (effects && instance.TryGetComponent(out Piece piece))
            {
                piece.m_placeEffect?.Create(position, worldRotation, instance.transform);
            }

            return instance;
        }

        private static void SpawnObjects(GameObject asset, Vector3 origin, Quaternion rotation, int seed, int villageId,
            Result result)
        {
            foreach (PlanEntry entry in MakePlan(asset, origin, seed, rotation.eulerAngles.y))
            {
                if (SpawnEntry(entry, origin, rotation, villageId, false) != null)
                {
                    result.Spawned++;
                }
                else
                {
                    result.Skipped++;
                }
            }

            SnapToGround.SnappAll();
        }

        /// <summary>Clears the plot and shapes the ground for a design, without building anything yet.</summary>
        public static bool PrepareSite(ZoneSystem.ZoneLocation location, Vector3 origin, float yaw)
        {
            Designs.AssetGuard.Load(location);
            try
            {
                GameObject asset = location.m_prefab.Asset;
                if (asset == null)
                {
                    return false;
                }

                float radius = DesignLibrary.Radius(location);
                ClearArea(origin, radius);
                ShapeTerrain(asset, origin, Quaternion.Euler(0f, yaw, 0f), radius);
                return true;
            }
            finally
            {
                location.m_prefab.Release();
            }
        }

        /// <summary>
        /// Returns why an object from a design is left out, or null if it is copied.
        /// </summary>
        public static string ExclusionReason(GameObject prefab, string prefabName)
        {
            if (prefab.GetComponent<Character>()) return "creature";
            if (prefab.GetComponent<CreatureSpawner>() || prefab.GetComponent<SpawnArea>()) return "creature spawner";
            if (prefab.GetComponent<OfferingBowl>()) return "boss altar";
            if (prefab.GetComponent<DungeonGenerator>() || prefab.GetComponent<Teleport>()) return "dungeon";
            if (prefab.GetComponent<LocationProxy>()) return "location proxy";
            if (prefab.GetComponent<VillageHearth>()) return "village hearth";
            if (prefab.GetComponentInChildren<Beehive>(true) ||
                prefabName.IndexOf("hive", StringComparison.OrdinalIgnoreCase) >= 0) return "bee hive";

            if (!VillheimConfig.KeepLootContainers.Value && prefab.GetComponent<Container>() && !prefab.GetComponent<Piece>())
            {
                return "loot container";
            }

            foreach (string word in ExcludedWords())
            {
                if (prefabName.IndexOf(word, StringComparison.Ordinal) >= 0)
                {
                    return $"name contains '{word}'";
                }
            }

            return null;
        }

        private static string _excludedRaw;
        private static string[] _excludedWords = Array.Empty<string>();

        private static string[] ExcludedWords()
        {
            string raw = VillheimConfig.ExcludedObjects.Value ?? "";
            if (raw != _excludedRaw)
            {
                _excludedRaw = raw;
                _excludedWords = raw.Split(',').Select(w => w.Trim()).Where(w => w.Length > 0).ToArray();
            }

            return _excludedWords;
        }

        /// <summary>
        /// Removes trees, logs, rocks and bushes from the plot so the building does not grow through them.
        /// Pieces, creatures and dropped items are never touched.
        /// </summary>
        public static void ClearArea(Vector3 center, float radius)
        {
            var seen = new HashSet<ZNetView>();
            foreach (Collider collider in Physics.OverlapSphere(center, radius))
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
                if (!clutter || Utils.DistanceXZ(go.transform.position, center) > radius)
                {
                    continue;
                }

                view.ClaimOwnership();
                ZNetScene.instance.Destroy(go);
            }
        }

        /// <summary>
        /// Replays the design's terrain modifiers as permanent terrain operations, or levels a simple pad if the
        /// design has none (or the option is off).
        /// </summary>
        private static void ShapeTerrain(GameObject asset, Vector3 origin, Quaternion rotation, float radius)
        {
            Transform root = asset.transform;
            TerrainModifier[] modifiers = VillheimConfig.CopyTerrainShaping.Value
                ? Utils.GetEnabledComponentsInChildren<TerrainModifier>(asset)
                : Array.Empty<TerrainModifier>();

            if (modifiers.Length == 0)
            {
                TerrainShaper.LevelPad(origin, radius * 0.6f, radius * 0.85f);
                return;
            }

            foreach (TerrainModifier modifier in modifiers.OrderBy(m => m.m_sortOrder))
            {
                Vector3 position = origin + rotation * root.InverseTransformPoint(modifier.transform.position);
                TerrainShaper.ApplyModifier(position, modifier);
            }
        }
    }
}
