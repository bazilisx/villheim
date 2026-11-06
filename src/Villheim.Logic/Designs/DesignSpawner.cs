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
            location.m_prefab.Load();
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

        private static void SpawnObjects(GameObject asset, Vector3 origin, Quaternion rotation, int seed, int villageId,
            Result result)
        {
            Transform root = asset.transform;
            ZNetView[] views = Utils.GetEnabledComponentsInChildren<ZNetView>(asset);
            SpawnPrefab[] spawnPrefabs = Utils.GetEnabledComponentsInChildren<SpawnPrefab>(asset);
            RandomSpawn[] randomSpawns = Utils.GetEnabledComponentsInChildren<RandomSpawn>(asset);

            Random.State previousRandom = Random.state;
            bool previousDamage = WearNTear.m_randomInitialDamage;
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

                // Villages are lived in: never apply the random wear that ruins get.
                WearNTear.m_randomInitialDamage = false;

                foreach (ZNetView view in views)
                {
                    if (view.gameObject.activeSelf)
                    {
                        Spawn(view.gameObject, Utils.GetPrefabName(view.gameObject), root, origin, rotation, villageId, result);
                    }
                }

                foreach (SpawnPrefab spawnPrefab in spawnPrefabs)
                {
                    if (spawnPrefab.gameObject.activeSelf && spawnPrefab.m_prefab != null)
                    {
                        Spawn(spawnPrefab.gameObject, Utils.GetPrefabName(spawnPrefab.m_prefab), root, origin, rotation,
                            villageId, result);
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

                WearNTear.m_randomInitialDamage = previousDamage;
                Random.state = previousRandom;
            }

            SnapToGround.SnappAll();
        }

        private static void Spawn(GameObject original, string prefabName, Transform root, Vector3 origin, Quaternion rotation,
            int villageId, Result result)
        {
            GameObject prefab = ZNetScene.instance.GetPrefab(prefabName);
            if (prefab == null || ExclusionReason(prefab, prefabName) != null)
            {
                result.Skipped++;
                return;
            }

            Vector3 localPosition = root.InverseTransformPoint(original.transform.position);
            Quaternion localRotation = Quaternion.Inverse(root.rotation) * original.transform.rotation;
            Vector3 position = origin + rotation * localPosition;
            Quaternion worldRotation = rotation * localRotation;

            // Some designs scale their pieces. The scale has to be on the prefab while it wakes up so the
            // network view records it, so set it briefly and restore it afterwards.
            Vector3 scale = original.transform.lossyScale;
            Vector3 prefabScale = prefab.transform.localScale;
            bool scaled = (scale - prefabScale).sqrMagnitude > 0.0001f;
            if (scaled)
            {
                prefab.transform.localScale = scale;
            }

            GameObject instance;
            try
            {
                instance = Object.Instantiate(prefab, position, worldRotation);
            }
            finally
            {
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

            result.Spawned++;
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
