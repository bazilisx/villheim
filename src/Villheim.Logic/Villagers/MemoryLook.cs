using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using HarmonyLib;
using UnityEngine;
using Object = UnityEngine.Object;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// The memory look (D-160), a second look next to the ghost look, picked with LookMode. Villagers read as people
    /// remembered: milky like frosted glass, their own colors showing through tinted teal, a soft glow at the edge of
    /// their outline, and a soft glow at and under their feet. Every value is a dial in "3e - Look: memory".
    ///
    /// Parts, all from what the game ships (nothing is compiled or loaded from outside):
    /// - Colors: GhostLook's swap to the game's "Custom/Fallen Warrior" shader, which draws the player body with its
    ///   skin, chest and legs textures and adds its colors over what is behind (screen blend). Here its _TintColor is
    ///   the tint color times MemoryBrightness times MemoryAlpha.
    /// - Milk: drawn just before the colors (render queue 2999), an unlit copy of the game's weapon glow material
    ///   ("Unlit/WeaponGlow", alpha blend) in MemoryMilkColor with alpha MemoryMilk, pushed out by nothing. It covers
    ///   what is behind the villager, like frosted glass, and the colors are added over it.
    /// - Glow at the outline: MemoryGlowLayers more copies of that material, each pushed out along the mesh normals
    ///   by its share of MemoryGlowSpread (_VertPush, given per renderer in meters over the renderer's scale) and
    ///   fainter further out. Noise and scrolling are off, so it is an even soft glow.
    /// - Feet: a flat card under each foot and a wider, fainter one under the villager with a soft round texture made
    ///   here (white, alpha fading from the middle), on a copy of a game particle material, and a faint point light.
    ///
    /// The milk and glow passes are extra renderers (children named villheim_memory_pass) that share the villager
    /// part's mesh and bones, one per pass, with the pass material on every sub-mesh. GhostLook and GhostDeath leave
    /// them alone (IsPass).
    /// </summary>
    internal static class MemoryLook
    {
        public static bool Active => LogicConfig.LookMode != null &&
                                     string.Equals(LogicConfig.LookMode.Value, "Memory", StringComparison.OrdinalIgnoreCase);

        private const string PassName = "villheim_memory_pass";
        private const int MilkQueue = 2999;
        private const int GlowQueue = 3001;
        private const int MaxLayers = 4;

        private static readonly HashSet<Material> Own = new HashSet<Material>();
        private static readonly HashSet<Renderer> PassRenderers = new HashSet<Renderer>();
        private static Material _milk;
        private static readonly Material[] Glow = new Material[MaxLayers];
        private static readonly float[] GlowPush = new float[MaxLayers];
        private static Material _footBlob;
        private static Material _pool;
        private static Material _glowSource, _blobSource;
        private static Mesh _card;
        private static Texture2D _radial;
        private static bool _searched;
        private static float _nextValues;
        private static bool _dirty = true;
        private static int _layers;
        private static bool _milkOn;
        private static MaterialPropertyBlock _block;
        private static readonly int VertPush = Shader.PropertyToID("_VertPush");

        private sealed class Passes
        {
            public readonly List<Renderer> Children = new List<Renderer>();
        }

        private static readonly Dictionary<Renderer, Passes> Decorated = new Dictionary<Renderer, Passes>();
        private static readonly Dictionary<Character, Feet> FeetRigs = new Dictionary<Character, Feet>();

        /// <summary>The materials this look made (GhostDeath leaves them out of its fading copy).</summary>
        public static bool IsOwn(Material material) => material != null && Own.Contains(material);

        /// <summary>A renderer this look made (a pass or a feet card): GhostLook and GhostDeath leave it alone.</summary>
        public static bool IsPass(Renderer renderer) => renderer != null && PassRenderers.Contains(renderer);

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

        // ---------------------------------------------------------------- the passes on each renderer

        /// <summary>
        /// Gives a villager part its milk and glow passes (want), or takes them away. Called by GhostLook for each of
        /// a villager's renderers when it refreshes.
        /// </summary>
        public static void Decorate(Renderer renderer, bool want)
        {
            if (renderer == null || IsPass(renderer))
            {
                return;
            }

            Decorated.TryGetValue(renderer, out Passes passes);
            Mesh mesh = MeshOf(renderer);
            if (!want || mesh == null)
            {
                if (passes != null)
                {
                    Strip(renderer, passes);
                }

                return;
            }

            Prepare();
            var wanted = new List<(Material Material, float Push)>(MaxLayers + 1);
            if (_milkOn && _milk != null)
            {
                wanted.Add((_milk, 0f));
            }

            for (int i = 0; i < _layers; i++)
            {
                if (Glow[i] != null)
                {
                    wanted.Add((Glow[i], GlowPush[i]));
                }
            }

            if (passes == null)
            {
                passes = new Passes();
                Decorated[renderer] = passes;
            }

            while (passes.Children.Count > wanted.Count)
            {
                Renderer last = passes.Children[passes.Children.Count - 1];
                passes.Children.RemoveAt(passes.Children.Count - 1);
                Drop(last);
            }

            while (passes.Children.Count < wanted.Count)
            {
                Renderer child = MakePass(renderer);
                if (child == null)
                {
                    return;
                }

                passes.Children.Add(child);
            }

            float scale = Scale(renderer);
            int subMeshes = Mathf.Max(1, mesh.subMeshCount);
            for (int i = 0; i < wanted.Count; i++)
            {
                Renderer child = passes.Children[i];
                if (child == null)
                {
                    continue;
                }

                Sync(renderer, child);
                Material[] current = child.sharedMaterials;
                if (current.Length != subMeshes || current.Any(m => m != wanted[i].Material))
                {
                    child.sharedMaterials = Enumerable.Repeat(wanted[i].Material, subMeshes).ToArray();
                }

                if (_block == null)
                {
                    _block = new MaterialPropertyBlock();
                }

                child.GetPropertyBlock(_block);
                _block.SetFloat(VertPush, wanted[i].Push / scale);
                child.SetPropertyBlock(_block);
            }
        }

        private static Mesh MeshOf(Renderer renderer)
        {
            if (renderer is SkinnedMeshRenderer skinned)
            {
                return skinned.sharedMesh;
            }

            MeshFilter filter = renderer.GetComponent<MeshFilter>();
            return filter != null ? filter.sharedMesh : null;
        }

        /// <summary>
        /// Meters per unit of the space the shader pushes the mesh in: the root bone's scale for a skinned part, the
        /// part's own scale for a plain mesh.
        /// </summary>
        private static float Scale(Renderer renderer)
        {
            Transform space = renderer is SkinnedMeshRenderer skinned && skinned.rootBone != null ? skinned.rootBone : renderer.transform;
            Vector3 lossy = space.lossyScale;
            float scale = (Mathf.Abs(lossy.x) + Mathf.Abs(lossy.y) + Mathf.Abs(lossy.z)) / 3f;
            return scale > 1e-5f ? scale : 1f;
        }

        private static Renderer MakePass(Renderer source)
        {
            var go = new GameObject(PassName);
            go.transform.SetParent(source.transform, false);
            Renderer made;
            if (source is SkinnedMeshRenderer skinned)
            {
                var copy = go.AddComponent<SkinnedMeshRenderer>();
                copy.updateWhenOffscreen = skinned.updateWhenOffscreen;
                made = copy;
            }
            else
            {
                go.AddComponent<MeshFilter>();
                made = go.AddComponent<MeshRenderer>();
            }

            made.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            made.receiveShadows = false;
            PassRenderers.Add(made);
            Sync(source, made);
            return made;
        }

        /// <summary>The pass follows its part: the same mesh (the body changes mesh with the model) and bones.</summary>
        private static void Sync(Renderer source, Renderer pass)
        {
            if (source is SkinnedMeshRenderer skinned && pass is SkinnedMeshRenderer copy)
            {
                if (copy.sharedMesh != skinned.sharedMesh)
                {
                    copy.sharedMesh = skinned.sharedMesh;
                }

                if (copy.rootBone != skinned.rootBone)
                {
                    copy.rootBone = skinned.rootBone;
                }

                Transform[] bones = skinned.bones;
                if (!copy.bones.SequenceEqual(bones))
                {
                    copy.bones = bones;
                }

                copy.localBounds = skinned.localBounds;
            }
            else if (pass.GetComponent<MeshFilter>() is MeshFilter filter && source.GetComponent<MeshFilter>() is MeshFilter from &&
                     filter.sharedMesh != from.sharedMesh)
            {
                filter.sharedMesh = from.sharedMesh;
            }

            pass.enabled = source.enabled;
            pass.forceRenderingOff = source.forceRenderingOff;
        }

        private static void Drop(Renderer pass)
        {
            if (pass != null)
            {
                PassRenderers.Remove(pass);
                Object.Destroy(pass.gameObject);
            }
        }

        private static void Strip(Renderer renderer, Passes passes)
        {
            foreach (Renderer child in passes.Children)
            {
                Drop(child);
            }

            passes.Children.Clear();
            Decorated.Remove(renderer);
        }

        // ---------------------------------------------------------------- the feet

        private sealed class Feet
        {
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
            var feet = new Feet { Holder = new GameObject("villheim_memory_feet") };
            feet.Holder.transform.SetParent(character.transform, false);
            if (_card != null && _footBlob != null)
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

        /// <summary>A flat card lying face up, with white vertex colors (the particle shaders multiply by them).</summary>
        private static Transform Card(string name, Transform parent, Material material)
        {
            var card = new GameObject(name);
            card.transform.SetParent(parent, false);
            card.AddComponent<MeshFilter>().sharedMesh = _card;
            MeshRenderer renderer = card.AddComponent<MeshRenderer>();
            renderer.sharedMaterial = material;
            renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            renderer.receiveShadows = false;
            PassRenderers.Add(renderer);
            return card.transform;
        }

        private static void Remove(Character character, Feet feet)
        {
            if (feet.Holder != null)
            {
                foreach (Renderer renderer in feet.Holder.GetComponentsInChildren<Renderer>(true))
                {
                    PassRenderers.Remove(renderer);
                }

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

        /// <summary>Finds the game materials to copy (once), makes the shared materials and keeps their values current.</summary>
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
            _glowSource = Pick(all, "Unlit/WeaponGlow", null, "Berzerkr_LightningGlow_Static_Mat");
            // The feet: the distant fog's lit particle material (it has an emission color, so it glows after dark), else
            // an unlit see-through particle material (the glows on the Draugr Fang and other weapons; the game log has
            // warnings about that shader's data). Either way its texture is replaced by the soft round one below.
            _blobSource = Pick(all, "Custom/LitParticles", null, "distant_fog")
                          ?? Pick(all, "Particles/Standard Unlit2", m => m.IsKeywordEnabled("_ALPHABLEND_ON"), "DraugrFangGlow");
            _card = MakeCard();
            _radial = MakeRadial();

            if (_glowSource != null)
            {
                _milk = GlowCopy("villheim_memory_milk", MilkQueue);
                for (int i = 0; i < MaxLayers; i++)
                {
                    Glow[i] = GlowCopy("villheim_memory_glow" + i, GlowQueue + i);
                }
            }

            if (_blobSource != null)
            {
                _footBlob = Ground(Copy(_blobSource, "villheim_memory_foot"));
                _pool = Ground(Copy(_blobSource, "villheim_memory_pool"));
            }

            VillheimPlugin.Log.LogInfo("Memory look: " + Sources());
        }

        /// <summary>A copy of the game's weapon glow material made even: plain white, no noise, no curl, no scrolling.</summary>
        private static Material GlowCopy(string name, int queue)
        {
            Material glow = Copy(_glowSource, name);
            glow.SetTexture("_MainTex", Texture2D.whiteTexture);
            // _CurlTex is a 3D texture: left as it is, with its strength at 0.
            glow.SetFloat("_CurlStrength", 0f);
            glow.SetFloat("_ScrollSpeed", 0f);
            glow.SetFloat("_ScrollSpeedX", 0f);
            glow.SetFloat("_DomainWarp", 0f);
            glow.SetFloat("_VertPush", 0f);
            glow.renderQueue = queue;
            return glow;
        }

        private static Material Copy(Material source, string name)
        {
            var copy = new Material(source) { name = name };
            copy.SetShaderPassEnabled("ShadowCaster", false);
            Own.Add(copy);
            return copy;
        }

        /// <summary>
        /// A glow card a few centimeters over the ground: the soft round texture, its fading into what is behind it and
        /// near the camera cut down (so it does not fade away against the ground), and nothing facing the camera.
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

            material.SetTexture("_MainTex", _radial);
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
            Set("_CameraYFadeDistance", 0f);
            Set("_SkyMask", 0f);
            Set("_Cull", (float)UnityEngine.Rendering.CullMode.Off);
            if (material.HasProperty("_EmissionColor"))
            {
                material.SetColor("_EmissionColor", Color.black);
            }

            material.renderQueue = 3000;
            return material;
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

        /// <summary>A 1 m card lying face up, centered, with white vertex colors.</summary>
        private static Mesh MakeCard()
        {
            var mesh = new Mesh { name = "villheim_memory_card" };
            mesh.vertices = new[] { new Vector3(-0.5f, 0f, -0.5f), new Vector3(-0.5f, 0f, 0.5f), new Vector3(0.5f, 0f, 0.5f), new Vector3(0.5f, 0f, -0.5f) };
            mesh.uv = new[] { new Vector2(0f, 0f), new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(1f, 0f) };
            mesh.colors = new[] { Color.white, Color.white, Color.white, Color.white };
            mesh.normals = new[] { Vector3.up, Vector3.up, Vector3.up, Vector3.up };
            mesh.triangles = new[] { 0, 1, 2, 0, 2, 3 };
            mesh.RecalculateBounds();
            return mesh;
        }

        /// <summary>A soft round spot: white, alpha 1 in the middle fading smoothly to 0 at the edge.</summary>
        private static Texture2D MakeRadial()
        {
            const int size = 64;
            var texture = new Texture2D(size, size, TextureFormat.RGBA32, false) { name = "villheim_memory_radial", wrapMode = TextureWrapMode.Clamp };
            var pixels = new Color32[size * size];
            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    float dx = (x + 0.5f) / size * 2f - 1f;
                    float dy = (y + 0.5f) / size * 2f - 1f;
                    float r = Mathf.Clamp01(Mathf.Sqrt(dx * dx + dy * dy));
                    float a = 1f - Mathf.SmoothStep(0f, 1f, r);
                    pixels[y * size + x] = new Color32(255, 255, 255, (byte)Mathf.RoundToInt(a * a * 255f));
                }
            }

            texture.SetPixels32(pixels);
            texture.Apply(false, true);
            return texture;
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
            float milk = Mathf.Clamp01(Mathf.Lerp(LogicConfig.MemoryMilkDay.Value, LogicConfig.MemoryMilk.Value, dark));
            _milkOn = milk > 0.001f;
            if (_milk != null)
            {
                Color milkColor = LogicConfig.MemoryMilkColor.Value;
                _milk.SetColor("_Color", new Color(milkColor.r, milkColor.g, milkColor.b, milk));
                _milk.SetVector("_EdgeFading", LogicConfig.MemoryGlowEdge.Value);
            }

            float strength = Mathf.Clamp01(Mathf.Lerp(LogicConfig.MemoryGlowDay.Value, LogicConfig.MemoryGlow.Value, dark));
            int layers = Mathf.Clamp(LogicConfig.MemoryGlowLayers.Value, 0, MaxLayers);
            float spread = LogicConfig.MemoryGlowSpread.Value;
            _layers = strength > 0.001f && spread > 0.0001f ? layers : 0;
            float softness = LogicConfig.MemoryGlowSoftness.Value;
            Color glowColor = LogicConfig.MemoryGlowColor.Value;
            for (int i = 0; i < MaxLayers; i++)
            {
                GlowPush[i] = layers > 0 ? spread * (i + 1) / layers : 0f;
                if (Glow[i] == null || i >= layers)
                {
                    continue;
                }

                // Shell i reaches (i + 1) / n of the spread. Softness 0: every shell as strong; 1: the outer ones much fainter.
                float t = layers <= 1 ? 0f : (float)i / (layers - 1);
                float weight = Mathf.Lerp(1f, Mathf.Pow(1f - 0.85f * t, 3f), softness);
                Glow[i].SetColor("_Color", new Color(glowColor.r, glowColor.g, glowColor.b, Mathf.Clamp01(strength * weight)));
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
            if (material.HasProperty("_EmissionColor") && material.shader.name == "Custom/LitParticles")
            {
                material.SetColor("_EmissionColor", color * strength);
            }
        }

        /// <summary>For 'vh memory shaders': which game materials each part copies.</summary>
        public static string Sources()
        {
            string Name(Material m) => m == null ? "none found" : $"'{m.name}' ({m.shader.name})";
            Shader ghost = GhostLook.SeeThroughShader();
            return $"colors: GhostLook's '{(ghost != null ? ghost.name : "none found")}'; milk and glow from {Name(_glowSource)}; " +
                   $"feet from {Name(_blobSource)} with a soft round texture made here.";
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
                   $"\nnow (darkness {dark:0.##}): alpha {alpha:0.##}, tint {tint:0.##}, milk {(_milkOn ? "on" : "off")}, glow shells {_layers}; " +
                   $"{Decorated.Count} villager parts carry passes, {FeetRigs.Count} feet glows.";
        }

        // ---------------------------------------------------------------- the probe

        private static readonly string[] ProbeProperties =
        {
            "_TintColor", "_Color", "_SkinColor", "_Cutoff", "_VertPush", "_EdgeFading", "_SrcBlend", "_DstBlend", "_ZWrite",
        };

        /// <summary>
        /// 'vh memory probe': every renderer of the 'vh memory' model and the villagers within 30 m, into the log: its
        /// shader, render queue, keywords and the values this look sets, and how many passes it got.
        /// </summary>
        private static string Probe()
        {
            Prepare();
            var characters = new List<Character>();
            if (_previewCharacter != null)
            {
                characters.Add(_previewCharacter);
            }

            Player player = Player.m_localPlayer;
            if (player != null)
            {
                characters.AddRange(Character.GetAllCharacters()
                    .Where(c => c != null && !c.IsPlayer() && (c is Villager || Animals.IsVillageAnimal(c)) &&
                                Vector3.Distance(c.transform.position, player.transform.position) < 30f)
                    .OrderBy(c => Vector3.Distance(c.transform.position, player.transform.position))
                    .Take(4));
            }

            var log = new StringBuilder("Memory look probe:\n" + Report() + "\n");
            int parts = 0, passes = 0;
            var block = new MaterialPropertyBlock();
            foreach (Character character in characters)
            {
                log.Append($"== {character.name} at {character.transform.position}\n");
                foreach (Renderer renderer in character.GetComponentsInChildren<Renderer>(true))
                {
                    if (renderer == null || renderer is ParticleSystemRenderer)
                    {
                        continue;
                    }

                    bool pass = IsPass(renderer);
                    Mesh mesh = MeshOf(renderer);
                    if (!pass)
                    {
                        parts++;
                    }
                    else
                    {
                        passes++;
                    }

                    int count = !pass && Decorated.TryGetValue(renderer, out Passes p) ? p.Children.Count : 0;
                    renderer.GetPropertyBlock(block);
                    log.Append($"  {(pass ? "  pass" : "part")} '{renderer.name}' {renderer.GetType().Name} sub-meshes {(mesh != null ? mesh.subMeshCount : 0)} " +
                               $"vertex colors {(mesh != null && mesh.isReadable ? (mesh.colors32.Length > 0 ? "yes" : "no") : "?")} enabled {renderer.enabled} " +
                               $"off {renderer.forceRenderingOff} scale {Scale(renderer):0.####}" +
                               (pass ? $" block _VertPush {(block.isEmpty ? "none" : block.GetFloat(VertPush).ToString("0.#####"))}" : $" passes {count}") + "\n");
                    foreach (Material material in renderer.sharedMaterials)
                    {
                        if (material == null)
                        {
                            log.Append("      (no material)\n");
                            continue;
                        }

                        var values = new List<string>();
                        foreach (string property in ProbeProperties)
                        {
                            if (!material.HasProperty(property))
                            {
                                continue;
                            }

                            string value;
                            try
                            {
                                value = property == "_TintColor" || property == "_Color" || property == "_SkinColor"
                                    ? material.GetColor(property).ToString()
                                    : property == "_EdgeFading" ? material.GetVector(property).ToString() : material.GetFloat(property).ToString("0.####");
                            }
                            catch (Exception)
                            {
                                value = "?";
                            }

                            values.Add(property + " " + value);
                        }

                        log.Append($"      '{material.name}' shader '{material.shader?.name}' queue {material.renderQueue} keywords [" +
                                   string.Join(" ", material.shaderKeywords) + "] " + string.Join(", ", values) + "\n");
                    }
                }
            }

            VillheimPlugin.Log.LogInfo(log.ToString());
            return $"Villheim: memory look probe written to the log ({characters.Count} models, {parts} parts, {passes} passes and feet cards).\n" + Report();
        }

        // ---------------------------------------------------------------- the preview model

        private static GameObject _preview;
        private static Character _previewCharacter;

        /// <summary>'vh memory [woman|clear|shaders|probe]': a still model in front of you with the look, to tune the dials against.</summary>
        public static string Command(string[] args)
        {
            string first = args != null && args.Length > 0 ? args[0].ToLowerInvariant() : "";
            if (first == "shaders" || first == "info")
            {
                return Report();
            }

            if (first == "probe")
            {
                return Probe();
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
                   "'vh memory shaders' shows what the look is made from, 'vh memory probe' writes what is on each part to the log." + note;
        }

        private static void ClearPreview()
        {
            if (_preview != null)
            {
                foreach (Renderer renderer in _preview.GetComponentsInChildren<Renderer>(true))
                {
                    PassRenderers.Remove(renderer);
                    Decorated.Remove(renderer);
                }

                if (FeetRigs.TryGetValue(_previewCharacter, out Feet feet))
                {
                    Remove(_previewCharacter, feet);
                }

                Object.Destroy(_preview);
            }

            _preview = null;
            _previewCharacter = null;
        }

        [HarmonyPatch(typeof(MonoUpdaters), nameof(MonoUpdaters.LateUpdate))]
        internal static class LatePatch
        {
            private static bool _warned;
            private static float _nextPrune;

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
                    if (Time.time >= _nextPrune)
                    {
                        _nextPrune = Time.time + 10f;
                        Prune();
                    }
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

        /// <summary>Forgets parts that are gone (their passes went with them, as children).</summary>
        private static void Prune()
        {
            foreach (Renderer gone in Decorated.Keys.Where(r => r == null).ToList())
            {
                Decorated.Remove(gone);
            }

            PassRenderers.RemoveWhere(r => r == null);
        }

        /// <summary>Logic unload: the passes, feet glows and model go (they belong to this build).</summary>
        public static void Unload()
        {
            ClearPreview();
            foreach (Passes passes in Decorated.Values)
            {
                foreach (Renderer child in passes.Children)
                {
                    if (child != null)
                    {
                        Object.Destroy(child.gameObject);
                    }
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
            PassRenderers.Clear();
            foreach (Material material in Own)
            {
                if (material != null)
                {
                    Object.Destroy(material);
                }
            }

            Own.Clear();
            if (_card != null)
            {
                Object.Destroy(_card);
            }

            if (_radial != null)
            {
                Object.Destroy(_radial);
            }
        }
    }
}
