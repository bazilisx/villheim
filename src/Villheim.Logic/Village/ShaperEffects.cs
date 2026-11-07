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
        public static string Signature(string effect, Color color) => $"{FxName}:{effect}:{ColorUtility.ToHtmlStringRGB(color)}";

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
                    Borrow(holder, target, effect);
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

        private static void Borrow(GameObject holder, GameObject target, string effect)
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

            // The topmost particle systems of the item, copied whole (with their children), minus lights and sounds.
            List<ParticleSystem> systems = source.GetComponentsInChildren<ParticleSystem>(true)
                .Where(p => p.transform.parent == null || p.transform.parent.GetComponentInParent<ParticleSystem>(true) == null)
                .ToList();
            if (systems.Count == 0 && Warned.Add(effect + " particles"))
            {
                VillheimPlugin.Log.LogWarning($"Shaper Tool: {source.name} has no particle effects to borrow for {effect}.");
            }

            Bounds? bounds = Bounds(target);
            foreach (ParticleSystem system in systems)
            {
                GameObject copy = Object.Instantiate(system.gameObject, holder.transform, false);
                copy.transform.localPosition = Vector3.zero;
                if (bounds.HasValue)
                {
                    copy.transform.position = bounds.Value.center;
                }

                copy.SetActive(true);
                foreach (Light light in copy.GetComponentsInChildren<Light>(true))
                {
                    Object.Destroy(light);
                }

                foreach (AudioSource audio in copy.GetComponentsInChildren<AudioSource>(true))
                {
                    Object.Destroy(audio);
                }

                foreach (ParticleSystem particles in copy.GetComponentsInChildren<ParticleSystem>(true))
                {
                    particles.Play();
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
