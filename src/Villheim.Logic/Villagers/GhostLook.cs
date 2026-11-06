using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Villagers as echoes: Valheim is the afterlife, so its villages are memories of the living world. Villagers keep
    /// the player model, skins and gear, but are a little see-through, faintly tinted toward teal, and give off a faint
    /// glow after dark. All subtle, and all optional (GhostAlpha, GhostTint, GhostGlow in the config).
    ///
    /// Who: villagers (with whatever is in their hands, which hangs off the villager) and the village's own animals
    /// (marked as built by the village). Buildings, dropped items and everything in chests keep the game's normal look:
    /// a dropped item or a building is never under a villager or animal, so it is never touched.
    ///
    /// Rules this keeps:
    /// - Only the villager's or animal's own renderers are touched, through their own copies of the materials (Renderer.materials
    ///   makes a copy per renderer). Shared materials, and so players, are never changed.
    /// - No particles, lights or extra objects: only a few material values, refreshed every few seconds per villager,
    ///   so the cost doesn't grow meaningfully with the village.
    /// - See-through needs a transparent shader. One is borrowed from the game's own ghostly creatures (a Deep North
    ///   ghost villager if found, else the crypt ghost, else any transparent creature material), never made new. With
    ///   none found, or GhostAlpha at 1, villagers stay solid and only the tint and glow apply.
    /// - Copied materials are destroyed when their villager is gone.
    /// </summary>
    internal static class GhostLook
    {
        private const float RefreshSeconds = 3f;

        private static Color Teal => LogicConfig.GhostColor != null ? LogicConfig.GhostColor.Value : new Color(0.55f, 0.85f, 1f);
        private static Color GlowColor => LogicConfig.GhostGlowColor != null ? LogicConfig.GhostGlowColor.Value : new Color(0.25f, 0.6f, 0.75f);
        private static readonly string[] TintProperties = { "_Color", "_SkinColor", "_HairColor", "_TintColor", "_BaseColor" };
        private static readonly string[] PreferredSources = { "ghost", "spirit", "wraith", "echo", "phantom", "wisp" };

        private sealed class Slot
        {
            public Material Material;
            public Shader OriginalShader;
            public int OriginalQueue;
            public readonly Dictionary<string, Color> Base = new Dictionary<string, Color>();
            public readonly Dictionary<string, Color> Written = new Dictionary<string, Color>();
            public bool Swapped;
        }

        private sealed class State
        {
            public float Next;
            public float NextScan;
            public float FirstSeen;
            public bool Revealed;
            public readonly Dictionary<Renderer, List<Slot>> Renderers = new Dictionary<Renderer, List<Slot>>();
        }

        private static readonly ConditionalWeakTable<Character, State> States = new ConditionalWeakTable<Character, State>();
        private static readonly List<(System.WeakReference<Character> Owner, List<Material> Materials)> Owned =
            new List<(System.WeakReference<Character>, List<Material>)>();

        private static Shader _ghostShader;
        private static bool _searched;
        private static bool _logged;
        private static float _nextSweep;

        private static float _nextAnimalScan;

        /// <summary>
        /// The village's animals, about every three seconds: every tame animal marked as a village's own. Run from the
        /// villagers' update, so it runs on every client while a village is loaded.
        /// </summary>
        public static void UpdateAnimals()
        {
            if (Time.time < _nextAnimalScan)
            {
                return;
            }

            _nextAnimalScan = Time.time + RefreshSeconds;
            foreach (Character character in Character.GetAllCharacters())
            {
                if (character == null || character is Villager || character.IsPlayer() || character.IsDead() ||
                    character.m_nview == null || !character.m_nview.IsValid() || character.m_nview.GetZDO().GetInt(Keys.BuiltBy) == 0)
                {
                    continue;
                }

                Update(character);
            }
        }

        public static void Update(Character villager)
        {
            State state = States.GetOrCreateValue(villager);
            bool on = LogicConfig.GhostLook != null && LogicConfig.GhostLook.Value;

            // A villager who has just appeared stays out of sight until his clothes and tools are on and every part of
            // him has the look, so he never shows half solid for a moment.
            if (!state.Revealed)
            {
                if (state.FirstSeen <= 0f)
                {
                    state.FirstSeen = Time.time;
                }

                bool dressed = !(villager is Villager v) || (v.LooksApplied && v.m_chestItem != null && v.GetRightItem() != null);
                bool ready = on && (dressed || Time.time - state.FirstSeen > 4f) && Time.time - state.FirstSeen > 0.5f;
                if (!on)
                {
                    SetHidden(villager, false);
                    state.Revealed = true;
                }
                else if (!ready)
                {
                    SetHidden(villager, true);
                    return;
                }
                else
                {
                    state.Next = 0f;
                    state.NextScan = 0f;
                }
            }

            // New parts (a tool taken out, a new shirt) get the look within half a second; values refresh every 3 s.
            bool scan = Time.time >= state.NextScan;
            bool refresh = Time.time >= state.Next;
            if (!scan && !refresh)
            {
                return;
            }

            state.NextScan = Time.time + 0.5f;
            if (refresh)
            {
                state.Next = Time.time + RefreshSeconds + Random.Range(0f, 0.5f);
                SweepOrphans();
            }

            if (!on && state.Renderers.Count == 0)
            {
                return;
            }

            // Day and night values, blended through dusk and dawn: by day more teal and more solid (in sunlight the
            // see-through look washed out to white), at night the softer, glowing look.
            float dark = Darkness();
            float tint = on ? Mathf.Clamp01(Mathf.Lerp(LogicConfig.GhostTintDay.Value, LogicConfig.GhostTint.Value, dark)) : 0f;
            float alpha = on ? Mathf.Clamp(Mathf.Lerp(LogicConfig.GhostAlphaDay.Value, LogicConfig.GhostAlpha.Value, dark), 0.1f, 1f) : 1f;
            float glow = on ? Mathf.Clamp01(Mathf.Lerp(LogicConfig.GhostGlowDay.Value, LogicConfig.GhostGlow.Value, dark)) : 0f;
            Shader ghost = alpha < 0.99f ? GhostShader() : null;
            foreach (Renderer renderer in villager.GetComponentsInChildren<Renderer>(true))
            {
                if (renderer == null || renderer is ParticleSystemRenderer || renderer is LineRenderer || renderer is TrailRenderer)
                {
                    continue;
                }

                bool known = state.Renderers.TryGetValue(renderer, out List<Slot> slots);
                if (!known)
                {
                    if (!on)
                    {
                        continue;
                    }

                    slots = Take(villager, renderer);
                    state.Renderers[renderer] = slots;
                }
                else if (!refresh)
                {
                    continue;
                }

                foreach (Slot slot in slots)
                {
                    Apply(slot, tint, alpha, glow, ghost);
                }
            }

            if (!state.Revealed)
            {
                state.Revealed = true;
                SetHidden(villager, false);
            }

            // Renderers that went away (gear changed) are forgotten; their copies go with the sweep.
            foreach (Renderer gone in state.Renderers.Keys.Where(r => r == null).ToList())
            {
                state.Renderers.Remove(gone);
            }
        }

        private static void SetHidden(Character character, bool hidden)
        {
            foreach (Renderer renderer in character.GetComponentsInChildren<Renderer>(true))
            {
                if (renderer != null && !(renderer is ParticleSystemRenderer))
                {
                    renderer.forceRenderingOff = hidden;
                }
            }
        }

        /// <summary>The renderer's own copies of its materials, made once, with the values they started with.</summary>
        private static List<Slot> Take(Character villager, Renderer renderer)
        {
            Material[] copies = renderer.materials; // a copy per renderer: shared materials stay untouched
            var slots = new List<Slot>();
            foreach (Material material in copies)
            {
                if (material == null)
                {
                    continue;
                }

                var slot = new Slot { Material = material, OriginalShader = material.shader, OriginalQueue = material.renderQueue };
                foreach (string property in TintProperties)
                {
                    if (material.HasProperty(property))
                    {
                        slot.Base[property] = material.GetColor(property);
                    }
                }

                slots.Add(slot);
            }

            Owned.Add((new System.WeakReference<Character>(villager), copies.Where(m => m != null).ToList()));
            if (!_logged)
            {
                _logged = true;
                LogShaders(renderer);
            }

            return slots;
        }

        private static void Apply(Slot slot, float tint, float alpha, float glow, Shader ghost)
        {
            Material m = slot.Material;
            if (m == null)
            {
                return;
            }

            // See-through: switch this copy to the borrowed transparent shader, or back.
            bool wantSwap = ghost != null && alpha < 0.99f;
            if (wantSwap && !slot.Swapped)
            {
                m.shader = ghost;
                m.renderQueue = 3000;
                slot.Swapped = true;
            }
            else if (!wantSwap && slot.Swapped)
            {
                m.shader = slot.OriginalShader;
                m.renderQueue = slot.OriginalQueue;
                slot.Swapped = false;
            }

            foreach (string property in slot.Base.Keys.ToList())
            {
                if (!m.HasProperty(property))
                {
                    continue;
                }

                // The game may have changed the colour since (a new skin or hair colour): take that as the new base.
                Color current = m.GetColor(property);
                if (!slot.Written.TryGetValue(property, out Color written) || !Close(current, written))
                {
                    slot.Base[property] = current;
                }

                Color baseColor = slot.Base[property];
                Color tinted = Color.Lerp(baseColor, baseColor * Teal, tint);
                tinted.a = property == "_Color" || property == "_BaseColor" || property == "_TintColor" ? baseColor.a * alpha : baseColor.a;
                m.SetColor(property, tinted);
                slot.Written[property] = tinted;
            }

            if (m.HasProperty("_EmissionColor"))
            {
                if (glow > 0.001f)
                {
                    m.EnableKeyword("_EMISSION");
                    m.SetColor("_EmissionColor", GlowColor * glow);
                }
                else
                {
                    m.SetColor("_EmissionColor", Color.black);
                }
            }
        }

        private static bool Close(Color a, Color b) =>
            Mathf.Abs(a.r - b.r) < 0.002f && Mathf.Abs(a.g - b.g) < 0.002f && Mathf.Abs(a.b - b.b) < 0.002f && Mathf.Abs(a.a - b.a) < 0.002f;

        /// <summary>0 by day, rising to 1 in the dark hours.</summary>
        private static float Darkness()
        {
            if (EnvMan.instance == null)
            {
                return 0f;
            }

            float hour = EnvMan.instance.GetDayFraction() * 24f;
            if (hour >= 20f || hour < 4f) return 1f;
            if (hour >= 18f) return (hour - 18f) / 2f;
            if (hour < 6f) return 1f - (hour - 4f) / 2f;
            return 0f;
        }

        /// <summary>
        /// A transparent shader from the game's own creatures: preferring ghostly ones by name, then any creature whose
        /// material renders in the transparent queue. Looked up once.
        /// </summary>
        private static Shader GhostShader()
        {
            if (_searched)
            {
                return _ghostShader;
            }

            _searched = true;
            if (ZNetScene.instance == null)
            {
                _searched = false;
                return null;
            }

            Shader fallback = null;
            string fallbackFrom = null;
            foreach (GameObject prefab in ZNetScene.instance.m_prefabs)
            {
                if (prefab == null || prefab.GetComponent<Character>() == null)
                {
                    continue;
                }

                string name = prefab.name.ToLowerInvariant();
                bool ghostly = PreferredSources.Any(w => name.Contains(w));
                foreach (Renderer renderer in prefab.GetComponentsInChildren<Renderer>(true))
                {
                    foreach (Material material in renderer.sharedMaterials)
                    {
                        if (material == null || material.shader == null || material.renderQueue < 2900)
                        {
                            continue;
                        }

                        if (ghostly && renderer is SkinnedMeshRenderer)
                        {
                            _ghostShader = material.shader;
                            VillheimPlugin.Log.LogInfo($"Ghost look: borrowing the see-through shader '{material.shader.name}' from {prefab.name}.");
                            return _ghostShader;
                        }

                        if (fallback == null && renderer is SkinnedMeshRenderer)
                        {
                            fallback = material.shader;
                            fallbackFrom = prefab.name;
                        }
                    }
                }
            }

            _ghostShader = fallback;
            VillheimPlugin.Log.LogInfo(fallback != null
                ? $"Ghost look: no ghostly creature found; borrowing '{fallback.name}' from {fallbackFrom}."
                : "Ghost look: no see-through shader found in the game; villagers stay solid (tint and glow still apply).");
            return _ghostShader;
        }

        /// <summary>Once: what the villager's shader offers, to tune the look from the log.</summary>
        private static void LogShaders(Renderer renderer)
        {
            foreach (Material material in renderer.sharedMaterials)
            {
                if (material?.shader == null)
                {
                    continue;
                }

                Shader shader = material.shader;
                var names = new List<string>();
                for (int i = 0; i < shader.GetPropertyCount(); i++)
                {
                    names.Add(shader.GetPropertyName(i));
                }

                VillheimPlugin.Log.LogInfo($"Ghost look: villager shader '{shader.name}' has {string.Join(", ", names)}.");
            }
        }

        /// <summary>Destroys the copied materials of villagers that are gone (unloaded or dead), every half minute.</summary>
        private static void SweepOrphans()
        {
            if (Time.time < _nextSweep)
            {
                return;
            }

            _nextSweep = Time.time + 30f;
            for (int i = Owned.Count - 1; i >= 0; i--)
            {
                if (!Owned[i].Owner.TryGetTarget(out Character owner) || owner == null)
                {
                    foreach (Material material in Owned[i].Materials)
                    {
                        if (material != null)
                        {
                            Object.Destroy(material);
                        }
                    }

                    Owned.RemoveAt(i);
                }
            }
        }
    }
}
