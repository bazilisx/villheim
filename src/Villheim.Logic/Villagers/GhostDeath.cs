using System;
using System.Collections.Generic;
using System.Linq;
using HarmonyLib;
using UnityEngine;
using Villheim.Prefabs;
using Object = UnityEngine.Object;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Villagers are echoes, so they die as the game's ghosts do (D-051): no body falls, nothing turns solid, no blood.
    /// Their death and hit effects are taken from the game's own Ghost (then the Wraith) with any ragdoll left out,
    /// so a dying villager plays the ghost's vanishing effect. The player's death effect, with its ragdoll, was used
    /// before. GhostDeath turns it off.
    ///
    /// The game removes the body at once, so the vanishing lingers on a copy (T-49): his body as it stands in that
    /// moment, baked from its skinned meshes with his ghostly materials, rises slowly and fades to nothing over
    /// GhostDeathSeconds, then is removed. The copy has no colliders and is never saved.
    /// </summary>
    internal static class GhostDeath
    {
        private static readonly string[] Sources = { "Ghost", "Wraith" };

        private static EffectList _death;
        private static EffectList _hit;
        private static bool _searched;

        private static bool On => LogicConfig.IsOn(LogicConfig.GhostDeath);

        private static void Find()
        {
            if (_searched || ZNetScene.instance == null)
            {
                return;
            }

            _searched = true;
            foreach (string name in Sources)
            {
                Character ghost = ZNetScene.instance.GetPrefab(name)?.GetComponent<Character>();
                if (ghost == null)
                {
                    continue;
                }

                EffectList death = WithoutRagdoll(ghost.m_deathEffects);
                if (death.m_effectPrefabs.Length == 0)
                {
                    continue;
                }

                _death = death;
                _hit = WithoutRagdoll(ghost.m_hitEffects);
                VillheimPlugin.Debug($"Villagers die as the {name} does: {string.Join(", ", _death.m_effectPrefabs.Select(e => e.m_prefab.name))}.");
                return;
            }

            VillheimPlugin.Log.LogWarning("Villheim: no ghost death effect found; villagers keep the player's death effect.");
        }

        private static EffectList WithoutRagdoll(EffectList source)
        {
            var kept = new List<EffectList.EffectData>();
            foreach (EffectList.EffectData data in source?.m_effectPrefabs ?? new EffectList.EffectData[0])
            {
                if (data?.m_prefab != null && data.m_prefab.GetComponent<Ragdoll>() == null)
                {
                    kept.Add(data);
                }
            }

            return new EffectList { m_effectPrefabs = kept.ToArray() };
        }

        // ---------------------------------------------------------------- the lingering fade

        private sealed class Fade
        {
            public GameObject Root;
            public float Start;
            public float Seconds;
            public readonly List<(Material Material, Color Tint)> Materials = new List<(Material, Color)>();
        }

        private static readonly List<Fade> Fades = new List<Fade>();
        private static readonly Color GhostBlue = new Color(0.55f, 0.85f, 1f, 0.85f);

        // Odin's vanishing smoke, played where the villager stood: the ghost's own effect alone was small and quick.
        private static readonly string[] VanishEffects = { "vfx_odin_despawn" };

        /// <summary>A still, ghostly copy of the dying villager that rises and fades away.</summary>
        private static void Linger(Villager villager)
        {
            float seconds = LogicConfig.GhostDeathSeconds?.Value ?? 3.5f;
            if (!On || seconds <= 0.05f)
            {
                return;
            }

            var fade = new Fade { Root = new GameObject("villheim_ghost_fade"), Start = Time.time, Seconds = seconds };
            fade.Root.transform.SetPositionAndRotation(villager.transform.position, villager.transform.rotation);
            Shader seeThrough = GhostLook.SeeThroughShader();
            foreach (Renderer renderer in villager.GetComponentsInChildren<Renderer>())
            {
                if (renderer == null || !renderer.enabled || !renderer.gameObject.activeInHierarchy)
                {
                    continue;
                }

                Mesh mesh = null;
                bool baked = false;
                if (renderer is SkinnedMeshRenderer skinned)
                {
                    mesh = new Mesh();
                    skinned.BakeMesh(mesh, true);
                    baked = true;
                }
                else if (renderer is MeshRenderer && renderer.GetComponent<MeshFilter>() is MeshFilter filter && filter.sharedMesh != null)
                {
                    mesh = filter.sharedMesh;
                }

                if (mesh == null)
                {
                    continue;
                }

                var part = new GameObject("part");
                part.transform.SetPositionAndRotation(renderer.transform.position, renderer.transform.rotation);
                part.transform.localScale = baked ? Vector3.one : renderer.transform.lossyScale;
                part.transform.SetParent(fade.Root.transform, true);
                part.AddComponent<MeshFilter>().sharedMesh = mesh;
                MeshRenderer copy = part.AddComponent<MeshRenderer>();
                Material[] materials = renderer.sharedMaterials.Where(m => m != null).Select(m => new Material(m)).ToArray();
                foreach (Material m in materials)
                {
                    // His own ghostly tint when his material already had one, else a pale ghost blue. The tint was read
                    // after the shader was swapped, from a material that never had it set: black and clear, so the
                    // copy could not be seen at all (Tyler: the ghostly effect was not visible).
                    Color tint = m.HasProperty("_TintColor") ? m.GetColor("_TintColor") : GhostBlue;
                    if (tint.a < 0.3f || tint.r + tint.g + tint.b < 0.3f)
                    {
                        tint = GhostBlue;
                    }

                    if (seeThrough != null && m.shader != seeThrough)
                    {
                        m.shader = seeThrough;
                        m.renderQueue = 3000;
                    }

                    if (m.HasProperty("_TintColor"))
                    {
                        m.SetColor("_TintColor", tint);
                    }

                    fade.Materials.Add((m, tint));
                }

                copy.sharedMaterials = materials;
                copy.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            }

            Fades.Add(fade);
            var played = new List<string>();
            foreach (string name in VanishEffects)
            {
                GameObject effect = ZNetScene.instance != null ? ZNetScene.instance.GetPrefab(name) : null;
                if (effect != null)
                {
                    Object.Instantiate(effect, villager.transform.position, Quaternion.identity);
                    played.Add(name);
                }
            }

            Material first = fade.Materials.Count > 0 ? fade.Materials[0].Material : null;
            string report = $"{villager.VillagerName} fades as a ghost: {fade.Root.transform.childCount} parts over {seconds:0.0} s, " +
                            $"shader {(first != null ? first.shader.name : "none")} (see-through {(seeThrough != null ? seeThrough.name : "not found")}), " +
                            $"tint {(fade.Materials.Count > 0 ? fade.Materials[0].Tint.ToString() : "none")}, " +
                            $"death effects [{string.Join(", ", villager.m_deathEffects?.m_effectPrefabs?.Where(e => e?.m_prefab != null).Select(e => e.m_prefab.name) ?? new string[0])}], " +
                            $"vanish [{string.Join(", ", played)}].";
            if (LogicConfig.IsOn(LogicConfig.DebugLog) || fade.Root.transform.childCount == 0)
            {
                VillheimPlugin.Log.LogInfo(report);
            }
        }

        /// <summary>Every frame: the fading copies rise and fade, and go when they are done.</summary>
        private static void LateTick()
        {
            for (int i = Fades.Count - 1; i >= 0; i--)
            {
                Fade fade = Fades[i];
                float t = (Time.time - fade.Start) / fade.Seconds;
                if (fade.Root == null || t >= 1f)
                {
                    Remove(fade);
                    Fades.RemoveAt(i);
                    continue;
                }

                // Rises slowly the whole time; stays clear to see for the first third, then fades.
                fade.Root.transform.position += Vector3.up * (0.4f * Time.deltaTime);
                float left = 1f - Mathf.SmoothStep(0f, 1f, Mathf.InverseLerp(0.3f, 1f, t));
                foreach ((Material m, Color tint) in fade.Materials)
                {
                    if (m != null && m.HasProperty("_TintColor"))
                    {
                        m.SetColor("_TintColor", new Color(tint.r * left, tint.g * left, tint.b * left, tint.a * left));
                    }
                }
            }
        }

        private static void Remove(Fade fade)
        {
            if (fade.Root != null)
            {
                foreach (MeshFilter filter in fade.Root.GetComponentsInChildren<MeshFilter>())
                {
                    // Only the baked meshes were made here; the meshes of tools and clothes belong to the game.
                    if (filter.sharedMesh != null && filter.sharedMesh.name.Length == 0)
                    {
                        Object.Destroy(filter.sharedMesh);
                    }
                }

                Object.Destroy(fade.Root);
            }

            foreach ((Material m, Color _) in fade.Materials)
            {
                if (m != null)
                {
                    Object.Destroy(m);
                }
            }
        }

        /// <summary>Logic unload: any copy still fading goes at once.</summary>
        public static void Unload()
        {
            foreach (Fade fade in Fades)
            {
                Remove(fade);
            }

            Fades.Clear();
        }

        /// <summary>On the machine that owns him, as he dies: who killed him (Grudges), and the lingering fade.</summary>
        [HarmonyPatch(typeof(Character), nameof(Character.OnDeath))]
        internal static class DeathPatch
        {
            private static void Prefix(Character __instance)
            {
                try
                {
                    if (!(__instance is Villager villager) || villager.NView == null || !villager.NView.IsValid())
                    {
                        return;
                    }

                    // Each on its own: a failure in the grudge record had also cost the ghostly fade (Tyler: no ghost
                    // effect and no grudge when he killed a villager).
                    try
                    {
                        Beds.Keep(villager);
                    }
                    catch (Exception ex)
                    {
                        VillheimPlugin.Log.LogWarning($"Villheim: keeping the bed on death failed: {ex.Message}");
                    }

                    try
                    {
                        Grudges.Died(villager);
                    }
                    catch (Exception ex)
                    {
                        VillheimPlugin.Log.LogWarning($"Villheim: grudge on death failed: {ex}");
                    }

                    try
                    {
                        Apply(villager);
                        Linger(villager);
                    }
                    catch (Exception ex)
                    {
                        VillheimPlugin.Log.LogWarning($"Villheim: ghost death failed: {ex}");
                    }
                }
                catch (Exception ex)
                {
                    VillheimPlugin.Debug($"Ghost death: {ex.Message}");
                }
            }
        }

        [HarmonyPatch(typeof(MonoUpdaters), nameof(MonoUpdaters.LateUpdate))]
        internal static class FadePatch
        {
            private static void Postfix()
            {
                if (Fades.Count > 0)
                {
                    try
                    {
                        LateTick();
                    }
                    catch (Exception ex)
                    {
                        VillheimPlugin.Debug($"Ghost fade: {ex.Message}");
                        Unload();
                    }
                }
            }
        }

        /// <summary>Gives the villager (and the villager prefab) the ghost's death and hit effects.</summary>
        public static void Apply(Villager villager)
        {
            if (!On || villager == null)
            {
                return;
            }

            Find();
            if (_death == null || villager.m_deathEffects == _death)
            {
                return;
            }

            villager.m_deathEffects = _death;
            villager.m_hitEffects = _hit;
            villager.m_critHitEffects = _hit;
            villager.m_backstabHitEffects = _hit;

            Villager prefab = VillagerPrefab.Prefab != null ? VillagerPrefab.Prefab.GetComponent<Villager>() : null;
            if (prefab != null && prefab != villager && prefab.m_deathEffects != _death)
            {
                Apply(prefab);
            }
        }
    }
}
