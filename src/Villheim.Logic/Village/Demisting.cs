using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Clear air in Mistlands villages (T-26). The game keeps mist out of a sphere around every Demister (a
    /// ParticleSystemForceField with the Demister component, as on the wisplight and the Mistwalker): no mist is
    /// made inside one, and mist drifting in is pushed out.
    ///
    /// - The village: one such field at the hearth, MistlandsDemistRadius across (the village's radius plus 10 by
    ///   default). It is made on every machine from the hearth's tick, since mist is drawn by each machine for itself.
    /// - Its people: a small one on each villager of a Mistlands village (MistlandsVillagerDemist), so they push the
    ///   mist back as they walk, as the Mistwalker does. Made by the machine that runs the villager.
    /// - The fields copy the game's own demister field (the first prefab found with one), so the mist moves as it does
    ///   round a wisplight. Nothing is drawn: the field has no mesh, light or sound.
    ///
    /// The big Dvergr demisters at the village edge, so it looks as if they do the work, are left to the building
    /// system: they must go up like any other piece. 'vh demist' lists the game's prefabs that carry a demister.
    /// </summary>
    internal static class Demisting
    {
        private const string FieldName = "villheim_demist";

        private static bool On => LogicConfig.IsOn(LogicConfig.MistlandsDemist);

        private static ParticleSystemForceField _template;
        private static float _templateDelay;
        private static bool _searched;

        private static readonly string[] Preferred = { "Demister", "SwordMistwalker" };

        /// <summary>The game's own demister field, found once among the item and object prefabs.</summary>
        private static ParticleSystemForceField Template()
        {
            if (_searched)
            {
                return _template;
            }

            if (ObjectDB.instance == null || ZNetScene.instance == null)
            {
                return null;
            }

            _searched = true;
            IEnumerable<GameObject> prefabs = Preferred.Select(n => ObjectDB.instance.GetItemPrefab(n)).Where(p => p != null)
                .Concat(ZNetScene.instance.m_prefabs.Where(p => p != null));
            foreach (GameObject prefab in prefabs)
            {
                Demister demister = prefab.GetComponentInChildren<Demister>(true);
                ParticleSystemForceField field = demister != null ? demister.GetComponent<ParticleSystemForceField>() : null;
                if (field != null)
                {
                    _template = field;
                    _templateDelay = demister.m_disableForcefieldDelay;
                    VillheimPlugin.Debug($"Demisting: the field is copied from {prefab.name} ({field.endRange:0.0} m).");
                    break;
                }
            }

            return _template;
        }

        /// <summary>The prefab names that carry a Demister, for 'vh demist' and the building system.</summary>
        public static List<string> DemisterPrefabs() =>
            ZNetScene.instance == null
                ? new List<string>()
                : ZNetScene.instance.m_prefabs.Where(p => p != null && p.GetComponentInChildren<Demister>(true) != null)
                    .Select(p => p.name).OrderBy(n => n).ToList();

        /// <summary>Puts a demister field of this radius on the parent, or updates or takes away the one there.</summary>
        private static void Ensure(Transform parent, float radius)
        {
            Transform existing = parent.Find(FieldName);
            if (radius <= 0f)
            {
                if (existing != null)
                {
                    Object.Destroy(existing.gameObject);
                }

                return;
            }

            if (existing != null)
            {
                ParticleSystemForceField have = existing.GetComponent<ParticleSystemForceField>();
                if (have != null && Mathf.Abs(have.endRange - radius) > 0.1f)
                {
                    have.endRange = radius;
                }

                return;
            }

            var go = new GameObject(FieldName);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = Vector3.up;
            ParticleSystemForceField field = go.AddComponent<ParticleSystemForceField>();
            ParticleSystemForceField template = Template();
            if (template != null)
            {
                field.shape = template.shape;
                field.startRange = template.startRange;
                field.length = template.length;
                field.gravity = template.gravity;
                field.gravityFocus = template.gravityFocus;
                field.rotationSpeed = template.rotationSpeed;
                field.rotationAttraction = template.rotationAttraction;
                field.rotationRandomness = template.rotationRandomness;
                field.directionX = template.directionX;
                field.directionY = template.directionY;
                field.directionZ = template.directionZ;
                field.drag = template.drag;
                field.multiplyDragByParticleSize = template.multiplyDragByParticleSize;
                field.multiplyDragByParticleVelocity = template.multiplyDragByParticleVelocity;
            }
            else
            {
                field.shape = ParticleSystemForceFieldShape.Sphere;
                field.gravity = -1f;
            }

            field.endRange = radius;
            // The Demister picks up the field in its Awake, so it comes second.
            Demister demister = go.AddComponent<Demister>();
            demister.m_disableForcefieldDelay = template != null ? _templateDelay : 0f;
        }

        // ---------------------------------------------------------------- the village

        /// <summary>Every hearth tick, on every machine: the village's clear air.</summary>
        public static void Hearth(VillageHearth hearth)
        {
            if (hearth == null || !hearth.IsValid)
            {
                return;
            }

            var state = new VillageState(hearth.Zdo);
            float radius = 0f;
            if (On && state.Initialized && state.Biome == Heightmap.Biome.Mistlands)
            {
                radius = LogicConfig.MistlandsDemistRadius?.Value ?? 0f;
                if (radius <= 0f)
                {
                    radius = VillheimConfig.VillageRadius.Value + 10f;
                }
            }

            Ensure(hearth.transform, radius);
        }

        // ---------------------------------------------------------------- the villagers

        private sealed class Check
        {
            public float Next;
        }

        private static readonly ConditionalWeakTable<Villager, Check> Checks = new ConditionalWeakTable<Villager, Check>();

        /// <summary>Every few seconds per villager: the Mistwalker's clear air round a Mistlands villager.</summary>
        public static void UpdateVillager(Villager villager)
        {
            Check check = Checks.GetOrCreateValue(villager);
            if (Time.time < check.Next)
            {
                return;
            }

            check.Next = Time.time + 5f + Random.Range(0f, 1f);
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            bool mist = On && hearth != null && hearth.IsValid && new VillageState(hearth.Zdo).Biome == Heightmap.Biome.Mistlands;
            Ensure(villager.transform, mist ? Mathf.Max(0f, LogicConfig.MistlandsVillagerDemist?.Value ?? 6f) : 0f);
        }

        /// <summary>'vh demist': the nearest village's clear air and the prefabs that carry a demister.</summary>
        public static string Command()
        {
            Player player = Player.m_localPlayer;
            VillageHearth hearth = player != null ? VillageHearth.Closest(player.transform.position, 300f) : null;
            ParticleSystemForceField template = Template();
            string head = $"MistlandsDemist {(On ? "on" : "off")}; field copied from " +
                          $"{(template != null ? template.transform.root.name + $" ({template.endRange:0.0} m)" : "nothing (a plain field)")}.";
            string village = hearth == null || !hearth.IsValid
                ? "No village within 300 m."
                : hearth.transform.Find(FieldName) is Transform field
                    ? $"{hearth.VillageName}: clear air {field.GetComponent<ParticleSystemForceField>()?.endRange ?? 0f:0} m round the hearth."
                    : $"{hearth.VillageName} ({new VillageState(hearth.Zdo).Biome}) has no clear air (only Mistlands villages do).";
            return head + "\n   " + village + "\n   Prefabs with a demister: " + string.Join(", ", DemisterPrefabs());
        }
    }
}
