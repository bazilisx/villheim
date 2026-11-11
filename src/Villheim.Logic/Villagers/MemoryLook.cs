using System;
using System.Collections.Generic;
using System.Linq;
using HarmonyLib;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// The memory look (D-160), a second look next to the ghost look, picked with LookMode. Villagers read as people
    /// remembered: see-through in their own colors with a teal tint, a soft teal glow around them, and a soft glow
    /// at and under their feet. Every value is a dial in "3e - Look: memory" and shows at once.
    ///
    /// Parts, all made from what the game ships (nothing is compiled or loaded from outside):
    /// - Body: the ghost look's own swap to the game's "Custom/Fallen Warrior" shader (it draws the player body with
    ///   skin, chest and legs textures and adds its color over what is behind). GhostLook does the swap; here the
    ///   body's colors are scaled by MemoryAlpha, and a darkening pass drawn first dims what is behind by the same
    ///   amount, so the sum comes close to a plain see-through blend in the villager's own colors.
    /// - Darkening pass: a copy of a game material on "Particles/Standard Surface2" in its alpha blend mode, black,
    ///   with alpha MemoryAlpha, drawn just before the body (render queue 2999).
    /// - Glow around them: copies of a game material on "Unlit/WeaponGlow" (the game's glow shells on weapons and
    ///   armor, which push the mesh out along its normals by _VertPush), drawn in MemoryGlowLayers shells, each a
    ///   little further out and fainter, with its noise and scrolling set to nothing so it is an even soft glow.
    /// - Feet: a copy of a game material with the game's soft round "glow" texture (or the next best soft round
    ///   texture, see Search), tinted teal, on a flat card under each foot and a wider, fainter one under the
    ///   villager, plus a faint teal point light.
    ///
    /// The extra passes are shared materials added to the end of a renderer's material list (one set for every
    /// villager), so they cost no copies per villager. A renderer with more than one sub-mesh gets none of them (an
    /// added material only draws the last sub-mesh).
    /// </summary>
    internal static class MemoryLook
    {
        public static bool Active => LogicConfig.LookMode != null &&
                                     string.Equals(LogicConfig.LookMode.Value, "Memory", StringComparison.OrdinalIgnoreCase);

        private const int DarkenQueue = 2999;
        private const int GlowQueue = 3001;
        private const int MaxLayers = 4;

        private static readonly HashSet<Material> Own = new HashSet<Material>();
        private static Material _darken;
        private static readonly Material[] Glow = new Material[MaxLayers];
        private static Material _footBlob;
        private static Material _pool;
        private static Material _darkenSource, _glowSource, _blobSource;
        private static Mesh _quad;
        private static bool _searched;
        private static float _nextValues;
        private static bool _dirty = true;
        private static int _layers;

        private static readonly List<WeakReference<Renderer>> Decorated = new List<WeakReference<Renderer>>();
        private static readonly Dictionary<Character, Feet> FeetRigs = new Dictionary<Character, Feet>();
        private static readonly List<Material> Desired = new List<Material>(8);

        /// <summary>The materials this look made (GhostDeath leaves them out of its fading copy).</summary>
        public static bool IsOwn(Material material) => material != null && Own.Contains(material);

        /// <summary>A dial changed: the shared materials take the new values on the next frame.</summary>
        public static void MarkDirty() => _dirty = true;

        /// <summary>Body values for the darkness now (0 day, 1 night), from the Day and night dials.</summary>
        public static void BodyValues(float dark, out float tint, out float alpha)
        {
            tint = Mathf.Clamp01(Mathf.Lerp(LogicConfig.MemoryTintDay.Value, LogicConfig.MemoryTint.Value, dark));
            alpha = Mathf.Clamp(Mathf.Lerp(LogicConfig.MemoryAlphaDay.Value, LogicConfig.MemoryAlpha.Value, dark), 0.02f, 1f);
        }

        /// <summary>The body's _TintColor on the Fallen Warrior shader: its own colors, tinted, scaled by alpha.</summary>
        public static Color BodyTint(float tint, float alpha)
        {
            Color color = Color.Lerp(Color.white, LogicConfig.MemoryTintColor.Value, tint) * LogicConfig.MemoryBrightness.Value * alpha;
            return new Color(color.r, color.g, color.b, alpha);
        }

        // ---------------------------------------------------------------- the passes added to each renderer

        /// <summary>
        /// Adds the darkening pass and the glow shells to a renderer (want), or takes them off. Called by GhostLook
        /// for each of a villager's renderers when it refreshes.
        /// </summary>
        public static void Decorate(Renderer renderer, bool want)
        {
            if (renderer == null)
            {
                return;
            }

            Material[] current = renderer.sharedMaterials;
            bool has = current.Any(IsOwn);
            if (want)
            {
                Prepare();
                int subMeshes = SubMeshes(renderer);
                if (subMeshes == 1)
                {
                    Desired.Clear();
                    Desired.AddRange(current.Where(m => !IsOwn(m)));
                    if (_darken != null)
                    {
                        Desired.Add(_darken);
                    }

                    for (int i = 0; i < _layers; i++)
                    {
                        if (Glow[i] != null)
                        {
                            Desired.Add(Glow[i]);
                        }
                    }

                    if (!Desired.SequenceEqual(current))
                    {
                        renderer.sharedMaterials = Desired.ToArray();
                        if (!has)
                        {
                            Decorated.Add(new WeakReference<Renderer>(renderer));
                        }
                    }

                    return;
                }
            }

            if (has)
            {
                renderer.sharedMaterials = current.Where(m => !IsOwn(m)).ToArray();
            }
        }

        private static int SubMeshes(Renderer renderer)
        {
            if (renderer is SkinnedMeshRenderer skinned)
            {
                return skinned.sharedMesh != null ? skinned.sharedMesh.subMeshCount : 0;
            }

            MeshFilter filter = renderer.GetComponent<MeshFilter>();
            return filter != null && filter.sharedMesh != null ? filter.sharedMesh.subMeshCount : 0;
        }

        // ---------------------------------------------------------------- the feet

        private sealed class Feet
        {
            public Character Owner;
            public GameObject Holder;
            public Transform Pool;
            public Transform LeftBlob;
            public Transform RightBlob;
            public Transform LeftFoot;
            public Transform RightFoot;
            public Light Light;
        }

        /// <summary>
        /// The feet glow for one villager or animal: made, refreshed or taken away. Called by GhostLook after the
        /// renderers, about once a second and at once when a dial changes.
        /// </summary>
        public static void Track(Character character, bool want)
        {
            if (character == null)
            {
                return;
            }

            bool feetOn = want && LogicConfig.MemoryFeetGlow != null && LogicConfig.MemoryFeetGlow.Value;
            FeetRigs.TryGetValue(character, out Feet feet);
            if (!feetOn)
            {
                if (feet != null)
                {
                    Remove(character, feet);
                }

                return;
            }

            Prepare();
            if (feet == null || feet.Holder == null)
            {
                feet = Make(character);
                FeetRigs[character] = feet;
            }

            float size = LogicConfig.MemoryFeetSize.Value;
            if (feet.Pool != null)
            {
                feet.Pool.localScale = Vector3.one * size * 2.2f;
            }

            if (feet.Light != null)
            {
                float light = LogicConfig.MemoryFeetLight.Value;
                feet.Light.enabled = light > 0.001f;
                feet.Light.color = LogicConfig.MemoryFeetColor.Value;
                feet.Light.intensity = light;
                feet.Light.range = Mathf.Max(0.5f, size * 5f);
            }
        }

        private static Feet Make(Character character)
        {
            var feet = new Feet { Owner = character, Holder = new GameObject("villheim_memory_feet") };
            feet.Holder.transform.SetParent(character.transform, false);
            if (_quad != null && _blobSource != null)
            {
                feet.Pool = Card("pool", feet.Holder.transform, _pool);
                feet.Pool.localPosition = new Vector3(0f, 0.04f, 0f);
                Transform[] all = character.GetComponentsInChildren<Transform>(true);
                feet.LeftFoot = all.FirstOrDefault(t => t.name == "LeftFoot");
                feet.RightFoot = all.FirstOrDefault(t => t.name == "RightFoot");
                if (feet.LeftFoot != null && feet.RightFoot != null)
                {
                    feet.LeftBlob = Card("left", feet.Holder.transform, _footBlob);
                    feet.RightBlob = Card("right", feet.Holder.transform, _footBlob);
                }
            }

            var lightObject = new GameObject("light");
            lightObject.transform.SetParent(feet.Holder.transform, false);
            lightObject.transform.localPosition = new Vector3(0f, 0.25f, 0f);
            feet.Light = lightObject.AddComponent<Light>();
            feet.Light.type = LightType.Point;
            feet.Light.shadows = LightShadows.None;
            return feet;
        }

        /// <summary>A flat card on the ground (the game's own quad mesh, face up) with the given material.</summary>
        private static Transform Card(string name, Transform parent, Material material)
        {
            var card = new GameObject(name);
            card.transform.SetParent(parent, false);
            card.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            card.AddComponent<MeshFilter>().sharedMesh = _quad;
            MeshRenderer renderer = card.AddComponent<MeshRenderer>();
            renderer.sharedMaterial = material;
            renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            renderer.receiveShadows = false;
            return card.transform;
        }

        private static void Remove(Character character, Feet feet)
        {
            if (feet.Holder != null)
            {
                Object.Destroy(feet.Holder);
            }

            FeetRigs.Remove(character);
        }

        /// <summary>Every frame: each foot's glow stays on the ground under the foot, a little smaller as it lifts.</summary>
        private static void FollowFeet()
        {
            if (FeetRigs.Count == 0)
            {
                return;
            }

            List<Character> gone = null;
            float size = LogicConfig.MemoryFeetSize.Value;
            foreach (KeyValuePair<Character, Feet> pair in FeetRigs)
            {
                Feet feet = pair.Value;
                if (pair.Key == null || feet.Holder == null || pair.Key.IsDead())
                {
                    (gone ?? (gone = new List<Character>())).Add(pair.Key);
                    continue;
                }

                float ground = pair.Key.transform.position.y;
                Place(feet.LeftBlob, feet.LeftFoot, ground, size);
                Place(feet.RightBlob, feet.RightFoot, ground, size);
            }

            if (gone != null)
            {
                foreach (Character character in gone)
                {
                    if (FeetRigs.TryGetValue(character, out Feet feet))
                    {
                        Remove(character, feet);
                    }

                    FeetRigs.Remove(character);
                }
            }
        }

        private static void Place(Transform blob, Transform foot, float ground, float size)
        {
            if (blob == null || foot == null)
            {
                return;
            }

            Vector3 at = foot.position;
            float lift = Mathf.Clamp01((at.y - ground) / 0.35f);
            blob.position = new Vector3(at.x, ground + 0.05f, at.z);
            blob.localScale = Vector3.one * size * Mathf.Lerp(1f, 0.55f, lift);
        }

        // ---------------------------------------------------------------- shared materials

        /// <summary>Finds the game materials to copy (once) and makes the shared materials.</summary>
        private static void Prepare()
        {
            if (!_searched)
            {
                Search();
            }

            if (_dirty || Time.time >= _nextValues)
            {
                SetValues();
            }
        }

        private static void Search()
        {
            if (ZNetScene.instance == null)
            {
                return;
            }

            _searched = true;
            Material[] all = Resources.FindObjectsOfTypeAll<Material>();
            _darkenSource = Pick(all, "Particles/Standard Surface2", m => m.IsKeywordEnabled("_ALPHABLEND_ON"), "feather_white");
            _glowSource = Pick(all, "Unlit/WeaponGlow", null, "Berzerkr_LightningGlow_Static_Mat");
            // The feet: the game's soft round "glow" texture on an unlit see-through particle material (the glows on
            // the Draugr Fang and other weapons), else the same texture on the distant fog's lit particle material,
            // else the soft dust blob of a ship's shadow.
            Func<Material, bool> glowTexture = m => m.HasProperty("_MainTex") && m.GetTexture("_MainTex") is Texture t && t != null && t.name == "glow";
            _blobSource = Pick(all, "Particles/Standard Unlit2", m => m.IsKeywordEnabled("_ALPHABLEND_ON") && glowTexture(m), "DraugrFangGlow")
                          ?? Pick(all, "Custom/LitParticles", glowTexture, "distant_fog")
                          ?? Pick(all, "Custom/ShadowBlob", null, "ship_shadow");
            _quad = FindQuad();

            if (_darkenSource != null)
            {
                _darken = Copy(_darkenSource, "villheim_memory_darken");
                _darken.SetFloat("_SrcBlend", (float)UnityEngine.Rendering.BlendMode.SrcAlpha);
                _darken.SetFloat("_DstBlend", (float)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
                _darken.SetFloat("_ZWrite", 1f);
                _darken.SetFloat("_Cull", (float)UnityEngine.Rendering.CullMode.Back);
                _darken.SetTexture("_MainTex", Texture2D.whiteTexture);
                _darken.SetColor("_EmissionColor", Color.black);
                _darken.renderQueue = DarkenQueue;
            }

            if (_glowSource != null)
            {
                for (int i = 0; i < MaxLayers; i++)
                {
                    Material glow = Copy(_glowSource, "villheim_memory_glow" + i);
                    // An even glow: no noise texture, no curl, no scrolling.
                    glow.SetTexture("_MainTex", Texture2D.whiteTexture);
                    if (glow.HasProperty("_CurlTex"))
                    {
                        glow.SetTexture("_CurlTex", Texture2D.whiteTexture);
                    }

                    glow.SetFloat("_CurlStrength", 0f);
                    glow.SetFloat("_ScrollSpeed", 0f);
                    glow.SetFloat("_ScrollSpeedX", 0f);
                    glow.SetFloat("_DomainWarp", 0f);
                    glow.renderQueue = GlowQueue + i;
                    Glow[i] = glow;
                }
            }

            if (_blobSource != null)
            {
                _footBlob = Ground(Copy(_blobSource, "villheim_memory_foot"));
                _pool = Ground(Copy(_blobSource, "villheim_memory_pool"));
            }

            VillheimPlugin.Log.LogInfo("Memory look: " + Sources());
        }

        /// <summary>
        /// A glow card a few centimeters over the ground: its soft fading into what is behind it and near the
        /// camera is cut down, so it does not fade away against the ground it lies on, and nothing faces the camera.
        /// </summary>
        private static Material Ground(Material material)
        {
            void Set(string property, float value)
            {
                if (material.HasProperty(property))
                {
                    material.SetFloat(property, value);
                }
            }

            if (material.HasProperty("_SoftParticleFadeParams"))
            {
                material.SetVector("_SoftParticleFadeParams", new Vector4(0f, 50f, 0f, 0f));
            }

            if (material.HasProperty("_CameraFadeParams"))
            {
                material.SetVector("_CameraFadeParams", new Vector4(0f, float.PositiveInfinity, 0f, 0f));
            }

            Set("_ZFadeDistance", 0.02f);
            Set("_CameraFadeDistanceMin", 0f);
            Set("_CameraFadeDistanceMax", 0.1f);
            Set("_Billboard", 0f);
            Set("_Cull", (float)UnityEngine.Rendering.CullMode.Off);
            if (material.HasProperty("_EmissionColor"))
            {
                material.SetColor("_EmissionColor", Color.black);
            }

            material.renderQueue = 3000;
            return material;
        }

        private static Material Copy(Material source, string name)
        {
            var copy = new Material(source) { name = name };
            copy.SetShaderPassEnabled("ShadowCaster", false);
            Own.Add(copy);
            return copy;
        }

        /// <summary>
        /// A loaded game material on the named shader (one the graphics card can draw), the preferred one by name if
        /// it is there. Copying a material the game uses keeps a shader variant the game is known to have.
        /// </summary>
        private static Material Pick(Material[] all, string shader, Func<Material, bool> fits, string preferred)
        {
            Material found = null;
            foreach (Material material in all)
            {
                if (material == null || material.shader == null || material.shader.name != shader || !material.shader.isSupported ||
                    Own.Contains(material) || (fits != null && !fits(material)))
                {
                    continue;
                }

                if (preferred != null && material.name == preferred)
                {
                    return material;
                }

                if (found == null)
                {
                    found = material;
                }
            }

            return found;
        }

        private static Mesh FindQuad()
        {
            try
            {
                Mesh builtIn = Resources.GetBuiltinResource<Mesh>("Quad.fbx");
                if (builtIn != null)
                {
                    return builtIn;
                }
            }
            catch (Exception)
            {
                // Not there in this build: the primitive below has the same mesh.
            }

            GameObject primitive = GameObject.CreatePrimitive(PrimitiveType.Quad);
            Mesh mesh = primitive.GetComponent<MeshFilter>().sharedMesh;
            Object.Destroy(primitive);
            return mesh;
        }

        /// <summary>Puts the dials and the time of day on the shared materials.</summary>
        private static void SetValues()
        {
            _dirty = false;
            _nextValues = Time.time + 2f;
            if (LogicConfig.MemoryAlpha == null)
            {
                return;
            }

            float dark = GhostLook.Darkness();
            BodyValues(dark, out _, out float alpha);
            if (_darken != null)
            {
                _darken.SetColor("_Color", new Color(0f, 0f, 0f, alpha));
            }

            float strength = Mathf.Clamp01(Mathf.Lerp(LogicConfig.MemoryGlowDay.Value, LogicConfig.MemoryGlow.Value, dark));
            int layers = Mathf.Clamp(LogicConfig.MemoryGlowLayers.Value, 0, MaxLayers);
            _layers = strength > 0.001f && LogicConfig.MemoryGlowSpread.Value > 0.0001f ? layers : 0;
            float spread = LogicConfig.MemoryGlowSpread.Value;
            float softness = LogicConfig.MemoryGlowSoftness.Value;
            Color glowColor = LogicConfig.MemoryGlowColor.Value;
            for (int i = 0; i < MaxLayers; i++)
            {
                if (Glow[i] == null || i >= layers)
                {
                    continue;
                }

                // Shell i reaches (i + 1) / n of the spread; the outer ones are fainter, faster with more softness.
                float t = layers <= 1 ? 0f : (float)i / layers;
                float weight = Mathf.Pow(1f - t, 0.5f + 2.5f * softness);
                Glow[i].SetFloat("_VertPush", spread * (i + 1) / Mathf.Max(1, layers));
                Glow[i].SetColor("_Color", new Color(glowColor.r, glowColor.g, glowColor.b, Mathf.Clamp01(strength * weight * 1.5f / Mathf.Sqrt(layers))));
                Glow[i].SetVector("_EdgeFading", LogicConfig.MemoryGlowEdge.Value);
            }

            Color feet = LogicConfig.MemoryFeetColor.Value;
            float feetStrength = LogicConfig.MemoryFeetStrength.Value;
            FeetValues(_footBlob, feet, feetStrength);
            FeetValues(_pool, feet, feetStrength * 0.45f);
        }

        private static void FeetValues(Material material, Color color, float strength)
        {
            if (material == null)
            {
                return;
            }

            material.SetColor("_Color", new Color(color.r, color.g, color.b, strength));
            // The lit particle material glows by its emission after dark.
            if (material.HasProperty("_EmissionColor") && material.shader.name == "Custom/LitParticles")
            {
                material.SetColor("_EmissionColor", color * strength);
            }
        }

        /// <summary>For 'vh memory shaders': which game materials each part copies, and the dial values now.</summary>
        public static string Sources()
        {
            string Name(Material m) => m == null ? "none found" : $"'{m.name}' ({m.shader.name})";
            return $"body pass: GhostLook's '{(GhostLook.SeeThroughShader() != null ? GhostLook.SeeThroughShader().name : "none found")}'; " +
                   $"darkening pass from {Name(_darkenSource)}; glow shells from {Name(_glowSource)}; feet glow from {Name(_blobSource)}; " +
                   $"card mesh {(_quad != null ? _quad.name : "none")}.";
        }

        public static string Report()
        {
            if (!_searched)
            {
                Search();
            }

            float dark = GhostLook.Darkness();
            BodyValues(dark, out float tint, out float alpha);
            return $"Villheim: memory look {(Active ? "on" : "off (LookMode is " + LogicConfig.LookMode?.Value + ")")}, " +
                   $"GhostLook {(LogicConfig.GhostLook != null && LogicConfig.GhostLook.Value ? "on" : "off")}.\n" + Sources() +
                   $"\nnow (darkness {dark:0.##}): alpha {alpha:0.##}, tint {tint:0.##}, glow shells {_layers}; " +
                   $"{Decorated.Count(w => w.TryGetTarget(out Renderer r) && r != null)} renderers carry the passes, {FeetRigs.Count} feet glows.";
        }

        // ---------------------------------------------------------------- the preview model

        private static GameObject _preview;
        private static Character _previewCharacter;

        /// <summary>'vh memory [woman|clear|shaders]': a still model in front of you with the look, to tune the dials against.</summary>
        public static string Command(string[] args)
        {
            string first = args != null && args.Length > 0 ? args[0].ToLowerInvariant() : "";
            if (first == "shaders" || first == "info")
            {
                return Report();
            }

            ClearPreview();
            if (first == "clear")
            {
                return "Villheim: memory look model taken away.";
            }

            Player player = Player.m_localPlayer;
            if (player == null)
            {
                return "Villheim: no player.";
            }

            Vector3 forward = player.transform.forward;
            forward.y = 0f;
            forward = forward.sqrMagnitude > 0.001f ? forward.normalized : Vector3.forward;
            Vector3 at = player.transform.position + forward * 3f;
            if (ZoneSystem.instance != null && ZoneSystem.instance.GetGroundHeight(at, out float y))
            {
                at.y = y;
            }

            bool female = first == "woman" || first == "female";
            HairReview.RigColors(out Vector3 skin, out Vector3 hairColor);
            _preview = ChildBody.Model(at, Quaternion.LookRotation(-forward), female, female ? "Hair12" : "Hair3", female ? "none" : "Beard5",
                skin, hairColor);
            if (_preview == null)
            {
                return "Villheim: no villager prefab to make the model from.";
            }

            _preview.name = "villheim_kids_rig_memory";
            _previewCharacter = _preview.GetComponent<Character>();
            string note = Active ? "" : $"\nLookMode is {LogicConfig.LookMode?.Value}: set it to Memory to see this look.";
            if (LogicConfig.GhostLook != null && !LogicConfig.GhostLook.Value)
            {
                note += "\nGhostLook ('3c - Villager looks') is off: turn it on to see any look.";
            }

            return $"Villheim: a still {(female ? "woman" : "man")} stands 3 m in front of you with the memory look. The dials in F1, " +
                   "'3e - Look: memory', change it as you drag them. 'vh memory woman' for a woman, 'vh memory clear' takes it away, " +
                   "'vh memory shaders' shows what the look is made from." + note;
        }

        private static void ClearPreview()
        {
            if (_preview != null)
            {
                Object.Destroy(_preview);
            }

            _preview = null;
            _previewCharacter = null;
        }

        [HarmonyPatch(typeof(MonoUpdaters), nameof(MonoUpdaters.LateUpdate))]
        internal static class LatePatch
        {
            private static bool _warned;

            private static void Postfix()
            {
                try
                {
                    if (_previewCharacter != null)
                    {
                        GhostLook.Update(_previewCharacter);
                    }

                    if (_dirty && (Decorated.Count > 0 || FeetRigs.Count > 0))
                    {
                        Prepare();
                    }

                    FollowFeet();
                }
                catch (Exception ex)
                {
                    if (!_warned)
                    {
                        _warned = true;
                        VillheimPlugin.Log.LogWarning($"Memory look: {ex}");
                    }
                }
            }
        }

        /// <summary>Logic unload: the passes come off every renderer and the feet glows and model go (they belong to this build).</summary>
        public static void Unload()
        {
            ClearPreview();
            foreach (WeakReference<Renderer> weak in Decorated)
            {
                if (weak.TryGetTarget(out Renderer renderer) && renderer != null)
                {
                    renderer.sharedMaterials = renderer.sharedMaterials.Where(m => !IsOwn(m)).ToArray();
                }
            }

            Decorated.Clear();
            foreach (Feet feet in FeetRigs.Values.ToList())
            {
                if (feet.Holder != null)
                {
                    Object.Destroy(feet.Holder);
                }
            }

            FeetRigs.Clear();
            foreach (Material material in Own)
            {
                if (material != null)
                {
                    Object.Destroy(material);
                }
            }

            Own.Clear();
        }
    }
}
