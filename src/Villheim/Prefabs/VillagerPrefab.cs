using System;
using System.Collections.Generic;
using System.Reflection;
using Jotunn.Entities;
using Jotunn.Managers;
using UnityEngine;
using Villheim.Villagers;
using Object = UnityEngine.Object;

namespace Villheim.Prefabs
{
    /// <summary>
    /// Villagers reuse the vanilla player model and its hair, beards and armor.
    /// The player prefab is cloned, its player-only components are swapped for an NPC humanoid
    /// and a monster AI, and it is registered as a new networked prefab.
    ///
    /// Approach inspired by OrianaVenture's Norse Personality Construction System (MIT).
    /// </summary>
    internal static class VillagerPrefab
    {
        public const string Name = VillheimPlugin.Prefix + "Villager";
        public const string RagdollName = VillheimPlugin.Prefix + "Villager_ragdoll";
        public const string Group = "Villheim";

        // Components on the player prefab that only make sense for a real player.
        private static readonly HashSet<string> PlayerOnlyComponents = new HashSet<string>
        {
            "PlayerController", "Talker", "Skills", "Tameable", "Procreation", "CharacterDrop"
        };

        public static GameObject Prefab { get; private set; }

        public static void Create()
        {
            if (Prefab != null)
            {
                return;
            }

            GameObject original = PrefabManager.Instance.GetPrefab("Player");
            Player originalPlayer = original ? original.GetComponent<Player>() : null;
            if (originalPlayer == null)
            {
                VillheimPlugin.Log.LogError("Could not find the Player prefab, villagers are disabled.");
                return;
            }

            GameObject prefab = PrefabManager.Instance.CreateClonedPrefab(Name, original);

            foreach (Component component in prefab.GetComponents<Component>())
            {
                if (component != null && PlayerOnlyComponents.Contains(component.GetType().Name))
                {
                    Object.DestroyImmediate(component);
                }
            }

            Object.DestroyImmediate(prefab.GetComponent<Player>());
            Villager villager = prefab.AddComponent<Villager>();
            CopyCharacterFields(originalPlayer, villager, original.transform, prefab.transform);
            ConfigureVillager(villager);

            VillagerAI ai = prefab.AddComponent<VillagerAI>();
            VillagerAI.Configure(ai);

            if (VillheimConfig.VillagerChatter.Value)
            {
                VillagerTalk.Configure(prefab.AddComponent<NpcTalk>());
            }

            if (prefab.TryGetComponent(out ZNetView nview))
            {
                nview.m_persistent = true;
                nview.m_type = ZDO.ObjectType.Default;
            }

            if (prefab.TryGetComponent(out ZSyncTransform sync))
            {
                sync.m_syncPosition = true;
                sync.m_syncRotation = true;
                sync.m_syncBodyVelocity = false;
                sync.m_characterParentSync = false;
            }

            PrefabManager.Instance.AddPrefab(new CustomPrefab(prefab, false));
            Prefab = prefab;
        }

        private static void ConfigureVillager(Villager villager)
        {
            villager.m_name = "Villager";
            villager.m_faction = Character.Faction.Dverger; // neutral to players unless provoked, fights monsters
            villager.m_group = Group;
            villager.m_tamed = false;
            villager.m_health = VillheimConfig.VillagerHealth.Value;
            villager.m_walkSpeed = 1.6f;
            villager.m_speed = 2f;
            villager.m_runSpeed = 5f;
            villager.m_defaultItems = Array.Empty<GameObject>();
            villager.m_randomWeapon = Array.Empty<GameObject>();
            villager.m_randomArmor = Array.Empty<GameObject>();
            villager.m_randomShield = Array.Empty<GameObject>();
            villager.m_randomSets = Array.Empty<Humanoid.ItemSet>();

            if (villager.m_unarmedWeapon == null)
            {
                GameObject fists = PrefabManager.Instance.GetPrefab("PlayerUnarmed");
                if (fists)
                {
                    villager.m_unarmedWeapon = fists.GetComponent<ItemDrop>();
                }
            }

            villager.m_deathEffects = CloneDeathEffects(villager.m_deathEffects);
        }

        /// <summary>
        /// The player's death effect spawns a ragdoll that never goes away. Give villagers their own copy with a timeout.
        /// A fresh EffectList is built so the player's own effects are left untouched.
        /// </summary>
        private static EffectList CloneDeathEffects(EffectList source)
        {
            var result = new EffectList();
            if (source?.m_effectPrefabs == null)
            {
                result.m_effectPrefabs = Array.Empty<EffectList.EffectData>();
                return result;
            }

            var effects = new List<EffectList.EffectData>();
            foreach (EffectList.EffectData data in source.m_effectPrefabs)
            {
                EffectList.EffectData copy = ShallowCopy(data);
                if (copy.m_prefab && copy.m_prefab.GetComponent<Ragdoll>())
                {
                    copy.m_prefab = CreateRagdoll(copy.m_prefab);
                }

                if (copy.m_prefab)
                {
                    effects.Add(copy);
                }
            }

            result.m_effectPrefabs = effects.ToArray();
            return result;
        }

        private static GameObject CreateRagdoll(GameObject playerRagdoll)
        {
            GameObject existing = PrefabManager.Instance.GetPrefab(RagdollName);
            if (existing)
            {
                return existing;
            }

            GameObject ragdoll = PrefabManager.Instance.CreateClonedPrefab(RagdollName, playerRagdoll);
            if (ragdoll.TryGetComponent(out Ragdoll component))
            {
                component.m_ttl = 30f;
                component.m_dropItems = false;
            }

            PrefabManager.Instance.AddPrefab(new CustomPrefab(ragdoll, false));
            return ragdoll;
        }

        /// <summary>
        /// Copy every Character and Humanoid field from the player component onto the villager component.
        /// References that point inside the original prefab (for example the eye transform) are re-pointed
        /// to the matching object inside the clone.
        /// </summary>
        private static void CopyCharacterFields(Player source, Villager target, Transform sourceRoot, Transform targetRoot)
        {
            foreach (Type type in new[] { typeof(Humanoid), typeof(Character) })
            {
                FieldInfo[] fields = type.GetFields(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic |
                                                    BindingFlags.DeclaredOnly);
                foreach (FieldInfo field in fields)
                {
                    if (field.IsLiteral || field.IsInitOnly)
                    {
                        continue;
                    }

                    try
                    {
                        object value = field.GetValue(source);
                        field.SetValue(target, RemapReference(value, sourceRoot, targetRoot));
                    }
                    catch (Exception ex)
                    {
                        VillheimPlugin.Debug($"Skipped field {type.Name}.{field.Name}: {ex.Message}");
                    }
                }
            }
        }

        private static object RemapReference(object value, Transform sourceRoot, Transform targetRoot)
        {
            Transform sourceTransform = null;
            Type componentType = null;

            if (value is GameObject go && go)
            {
                sourceTransform = go.transform;
            }
            else if (value is Component component && component)
            {
                sourceTransform = component.transform;
                componentType = component.GetType();
            }

            if (sourceTransform == null || !sourceTransform.IsChildOf(sourceRoot))
            {
                return value;
            }

            Transform mapped = FindByPath(targetRoot, GetPath(sourceTransform, sourceRoot));
            if (mapped == null)
            {
                return null;
            }

            if (componentType == null)
            {
                return mapped.gameObject;
            }

            return componentType == typeof(Transform) ? mapped : mapped.GetComponent(componentType);
        }

        private static List<int> GetPath(Transform child, Transform root)
        {
            var path = new List<int>();
            for (Transform t = child; t != null && t != root; t = t.parent)
            {
                path.Insert(0, t.GetSiblingIndex());
            }

            return path;
        }

        private static Transform FindByPath(Transform root, List<int> path)
        {
            Transform current = root;
            foreach (int index in path)
            {
                if (index >= current.childCount)
                {
                    return null;
                }

                current = current.GetChild(index);
            }

            return current;
        }

        internal static T ShallowCopy<T>(T source) where T : class, new()
        {
            var copy = new T();
            foreach (FieldInfo field in typeof(T).GetFields(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic))
            {
                if (!field.IsInitOnly && !field.IsLiteral)
                {
                    field.SetValue(copy, field.GetValue(source));
                }
            }

            return copy;
        }
    }
}
