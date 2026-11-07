using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// The look of the Villheim Dev Shaper Tool, chosen in F1 (4 - Design review): ShaperHandEffect while it is in hand
    /// and shaping, ShaperGroundEffect while it lies on the ground, ShaperColor for Glow and Beam. Changes show at once.
    ///
    /// Glow: the tool's own material lights up. Beam (ground only): a tall see-through column of the colour with a soft
    /// light at its foot, like magic loot. Fire, Frost, Spirit, Lightning: the particle effects of vanilla items (torch
    /// or Dyrnwyn, Frostner, Mistwalker, Himminafl), copied onto the tool without their lights or sounds, so only the
    /// tool shows the effect, never the player.
    /// </summary>
    internal static class ShaperEffects
    {
        public static readonly string[] HandChoices = { "None", "Glow", "Fire", "Frost", "Spirit", "Lightning" };
        public static readonly string[] GroundChoices = { "None", "Glow", "Beam", "Beam and Glow", "Fire", "Frost", "Spirit", "Lightning" };

        private const string FxName = "VillheimShaperFx";
        private static readonly int Emission = Shader.PropertyToID("_EmissionColor");

        // Vanilla items whose effects are borrowed, first one found wins.
        private static readonly Dictionary<string, string[]> Sources = new Dictionary<string, string[]>
        {
            ["Fire"] = new[] { "SwordDyrnwyn", "Torch" },
            ["Frost"] = new[] { "MaceSilver", "AtgeirSilver" },
            ["Spirit"] = new[] { "SwordMistwalker", "StaffShield" },
            ["Lightning"] = new[] { "AtgeirHimminAfl", "StaffLightning" },
        };

        private static readonly HashSet<string> Warned = new HashSet<string>();

        /// <summary>The effect and colour as one word, to tell whether an object shows the current choice.</summary>
        public static string Signature(string effect, Color color) =>
            $"{FxName}:{effect}:{ColorUtility.ToHtmlStringRGB(color)}:{Scale:0.00}:{Strength:0.00}:{Bursts}:{BurstScale:0.00}:{Tint}";

        private static float Scale => LogicConfig.ShaperEffectScale?.Value ?? 0.205f;
        private static float Strength => LogicConfig.ShaperEffectStrength?.Value ?? 0.561f;
        private static bool Bursts => LogicConfig.ShaperEffectBursts?.Value ?? true;
        private static float BurstScale => LogicConfig.ShaperEffectBurstScale?.Value ?? 0.592f;
        private static bool Tint => LogicConfig.ShaperEffectTint?.Value ?? true;

        /// <summary>Whether the object already shows this effect (its effect child carries the signature as its name).</summary>
        public static bool Shows(GameObject target, string signature)
        {
            Transform fx = Child(target);
            return fx != null && fx.name == signature;
        }

        /// <summary>Takes any earlier effect off the object and puts the chosen one on.</summary>
        public static void Apply(GameObject target, string effect, Color color, bool ground)
        {
            if (target == null)
            {
                return;
            }

            Clear(target);
            var holder = new GameObject(Signature(effect, color));
            holder.transform.SetParent(target.transform, false);
            switch (effect)
            {
                case "Glow":
                    Glow(target, color);
                    break;
                case "Beam":
                    Beam(holder, target, color);
                    break;
                case "Beam and Glow":
                    Beam(holder, target, color);
                    Glow(target, color);
                    break;
                case "Fire":
                case "Frost":
                case "Spirit":
                case "Lightning":
                    Borrow(holder, target, effect, color);
                    if (ground)
                    {
                        Glow(target, color);
                    }

                    break;
            }
        }

        /// <summary>Takes the effect off (the tool put away, or the effect set to None).</summary>
        public static void Clear(GameObject target)
        {
            if (target == null)
            {
                return;
            }

            Transform fx = Child(target);
            while (fx != null)
            {
                fx.SetParent(null);
                Object.Destroy(fx.gameObject);
                fx = Child(target);
            }

            MaterialMan.instance?.ResetValue(target, Emission);
        }

        private static Transform Child(GameObject target)
        {
            foreach (Transform child in target.transform)
            {
                if (child.name.StartsWith(FxName))
                {
                    return child;
                }
            }

            return null;
        }

        private static void Glow(GameObject target, Color color)
        {
            // Bright enough to see by day: the emission is several times the colour.
            MaterialMan.instance?.SetValue(target, Emission, color * 3f);
        }

        private static void Beam(GameObject holder, GameObject target, Color color)
        {
            Bounds? bounds = Bounds(target);
            Vector3 foot = bounds.HasValue ? bounds.Value.center : target.transform.position;
            GameObject beam = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            Object.Destroy(beam.GetComponent<Collider>());
            beam.name = "beam";
            beam.transform.SetParent(holder.transform, false);
            beam.transform.position = foot + Vector3.up * 2f;
            beam.transform.rotation = Quaternion.identity;
            beam.transform.localScale = new Vector3(0.12f, 2f, 0.12f);
            Shader shader = Shader.Find("Sprites/Default");
            if (shader != null)
            {
                var material = new Material(shader) { color = new Color(color.r, color.g, color.b, 0.45f) };
                beam.GetComponent<Renderer>().material = material;
            }

            Light light = holder.AddComponent<Light>();
            light.type = LightType.Point;
            light.color = color;
            light.range = 3f;
            light.intensity = 1.5f;
            light.shadows = LightShadows.None;
        }

        private static void Borrow(GameObject holder, GameObject target, string effect, Color color)
        {
            GameObject source = Sources[effect].Select(n => ObjectDB.instance?.GetItemPrefab(n)).FirstOrDefault(p => p != null);
            if (source == null)
            {
                if (Warned.Add(effect))
                {
                    VillheimPlugin.Log.LogWarning($"Shaper Tool: none of {string.Join(", ", Sources[effect])} found for the {effect} effect.");
                }

                return;
            }

            // The topmost particle systems below the item's root, copied with their children, minus lights and sounds.
            // Never the root itself: that is the item, and a copy of it is a real sword the player picks up (2026-11-07).
            List<ParticleSystem> systems = source.GetComponentsInChildren<ParticleSystem>(true)
                .Where(p => p.transform != source.transform)
                .Where(p => !Ancestors(p.transform, source.transform).Any(t => t.GetComponent<ParticleSystem>() != null))
                .ToList();
            if (systems.Count == 0 && Warned.Add(effect + " particles"))
            {
                VillheimPlugin.Log.LogWarning($"Shaper Tool: {source.name} has no particle effects to borrow for {effect}.");
            }

            Bounds? bounds = Bounds(target);
            foreach (ParticleSystem system in systems)
            {
                GameObject copy = Object.Instantiate(system.gameObject, holder.transform, false);
                Strip(copy);
                copy.transform.localPosition = Vector3.zero;
                if (bounds.HasValue)
                {
                    copy.transform.position = bounds.Value.center;
                }

                copy.transform.localScale = Vector3.one * Scale;
                copy.SetActive(true);
                ParticleSystem[] all = copy.GetComponentsInChildren<ParticleSystem>(true);
                var fired = new HashSet<ParticleSystem>();
                foreach (ParticleSystem particles in all)
                {
                    ParticleSystem.SubEmittersModule subs = particles.subEmitters;
                    for (int i = 0; i < subs.subEmittersCount; i++)
                    {
                        ParticleSystem fire = subs.GetSubEmitterSystem(i);
                        if (fire != null)
                        {
                            fired.Add(fire);
                        }
                    }
                }

                foreach (ParticleSystem particles in all)
                {
                    Tune(particles, color, source.name, fired.Contains(particles));
                    particles.Play();
                }
            }
        }

        private static readonly HashSet<string> Described = new HashSet<string>();

        /// <summary>
        /// Fits a borrowed effect to a small tool: sizes follow the copy's scale (ShaperEffectScale), fewer and fainter
        /// particles (ShaperEffectStrength), periodic bursts and the blasts they set off left out unless
        /// ShaperEffectBursts, and recoloured to ShaperColor if ShaperEffectTint. Each part is described once in the log,
        /// to pick out any that still look too big.
        /// </summary>
        private static void Tune(ParticleSystem particles, Color color, string source, bool subEmitter)
        {
            ParticleSystem.MainModule main = particles.main;
            ParticleSystem.EmissionModule emission = particles.emission;
            bool burstPart = subEmitter || emission.burstCount > 0;
            string key = source + "/" + particles.name;
            if (Described.Add(key))
            {
                VillheimPlugin.Log.LogInfo($"Shaper Tool effect part {key}: rate {emission.rateOverTimeMultiplier:0.#}/s, bursts {emission.burstCount}, " +
                                           $"size {main.startSizeMultiplier:0.##}, life {main.startLifetimeMultiplier:0.##} s, max {main.maxParticles}, " +
                                           $"sub-emitters {particles.subEmitters.subEmittersCount}, space {main.simulationSpace}" +
                                           (burstPart ? ", burst part (ShaperEffectBurstScale)." : "."));
            }

            main.scalingMode = ParticleSystemScalingMode.Hierarchy;
            if (!Bursts)
            {
                emission.SetBursts(new ParticleSystem.Burst[0]);
                ParticleSystem.SubEmittersModule sub = particles.subEmitters;
                sub.enabled = false;
                if (emission.rateOverTimeMultiplier <= 0f && emission.rateOverDistanceMultiplier <= 0f)
                {
                    emission.enabled = false;
                }
            }
            else if (burstPart)
            {
                ShrinkBurst(particles, BurstScale);
            }

            emission.rateOverTimeMultiplier *= Strength;
            main.maxParticles = Mathf.Max(1, Mathf.RoundToInt(main.maxParticles * Strength));
            if (Tint)
            {
                main.startColor = new ParticleSystem.MinMaxGradient(new Color(color.r, color.g, color.b, Mathf.Clamp01(0.4f + Strength)));
            }
        }

        /// <summary>
        /// Makes a burst part smaller and shorter-reaching: particle size, speed and the forces on it. The copy's scale
        /// alone missed the zaps (Tyler, 2026-11-07), most likely because their particles fly in world space at the
        /// weapon's speed.
        /// </summary>
        private static void ShrinkBurst(ParticleSystem particles, float f)
        {
            ParticleSystem.MainModule main = particles.main;
            if (main.startSize3D)
            {
                main.startSizeXMultiplier *= f;
                main.startSizeYMultiplier *= f;
                main.startSizeZMultiplier *= f;
            }
            else
            {
                main.startSizeMultiplier *= f;
            }

            main.startSpeedMultiplier *= f;
            main.gravityModifierMultiplier *= f;

            ParticleSystem.VelocityOverLifetimeModule velocity = particles.velocityOverLifetime;
            if (velocity.enabled)
            {
                velocity.speedModifierMultiplier *= f;
            }

            ParticleSystem.LimitVelocityOverLifetimeModule limit = particles.limitVelocityOverLifetime;
            if (limit.enabled)
            {
                limit.limitMultiplier *= f;
            }

            ParticleSystem.ForceOverLifetimeModule force = particles.forceOverLifetime;
            if (force.enabled)
            {
                force.xMultiplier *= f;
                force.yMultiplier *= f;
                force.zMultiplier *= f;
            }

            ParticleSystem.NoiseModule noise = particles.noise;
            if (noise.enabled)
            {
                noise.strengthMultiplier *= f;
            }

            ParticleSystem.ShapeModule shape = particles.shape;
            if (shape.enabled)
            {
                shape.radius *= f;
            }

            ParticleSystem.TrailModule trails = particles.trails;
            if (trails.enabled)
            {
                trails.widthOverTrailMultiplier *= f;
            }
        }

        /// <summary>The transforms between a child and the root (the child and the root left out).</summary>
        private static IEnumerable<Transform> Ancestors(Transform child, Transform root)
        {
            for (Transform t = child.parent; t != null && t != root; t = t.parent)
            {
                yield return t;
            }
        }

        /// <summary>
        /// Leaves only looks on a copied effect: no network object, item, physics, collider, light or sound, so it can
        /// never be picked up, saved, pushed or light the player.
        /// </summary>
        private static void Strip(GameObject copy)
        {
            foreach (Component part in copy.GetComponentsInChildren<Component>(true))
            {
                if (part is ZNetView || part is ItemDrop || part is ZSyncTransform || part is Rigidbody || part is Collider ||
                    part is Light || part is AudioSource)
                {
                    Object.DestroyImmediate(part);
                }
            }
        }

        private static Bounds? Bounds(GameObject target)
        {
            Bounds? total = null;
            foreach (Renderer renderer in target.GetComponentsInChildren<Renderer>())
            {
                if (renderer == null || renderer.GetComponentInParent<ParticleSystem>() != null ||
                    renderer.GetComponentsInParent<Transform>(true).Any(t => t.name.StartsWith(FxName)))
                {
                    continue;
                }

                if (total.HasValue)
                {
                    Bounds b = total.Value;
                    b.Encapsulate(renderer.bounds);
                    total = b;
                }
                else
                {
                    total = renderer.bounds;
                }
            }

            return total;
        }
    }
}
