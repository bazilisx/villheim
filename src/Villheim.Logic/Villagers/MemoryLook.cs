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
    /// their outline, and a soft glow under each foot. Every value is a dial in "3e - Look: memory".
    ///
    /// Parts, all from what the game ships (nothing is compiled or loaded from outside):
    /// - Colors: GhostLook's swap to the game's "Custom/Fallen Warrior" shader, which draws the player body with its
    ///   skin, chest and legs textures and adds its colors over what is behind. Its _TintColor is the tint color times
    ///   MemoryBrightness times MemoryAlpha.
    /// - Milk (render queue 2999) and the glow shells (3001 and up): copies of the game material picked by
    ///   MemoryPassMaterial (PassKeys), on extra renderers (villheim_memory_pass) under each villager part, with the
    ///   pass material on every sub-mesh. The milk shares the part's mesh and bones. The shells are pushed out along
    ///   the normals: by the material's _VertPush (only the game's weapon glow has it) or, with MemoryShellMode Baked,
    ///   from a copy of the part's pose in meters made every second frame (SkinnedMeshRenderer.BakeMesh with the
    ///   part's scale, drawn with that scale undone) for villagers within 30 m.
    /// - Feet: a soft glow card under the sole of each foot, a child of the foot bone so it moves with the foot, with
    ///   white vertex colors and a soft round texture made here, on a copy of a game particle material; and a faint
    ///   point light at the feet.
    /// MemoryDebugSolo shows one part alone in magenta, and 'vh memory' writes a probe of the model to the log.
    /// </summary>
    internal static class MemoryLook
    {
        public static bool Active => LogicConfig.LookMode != null &&
                                     string.Equals(LogicConfig.LookMode.Value, "Memory", StringComparison.OrdinalIgnoreCase);

        /// <summary>The game materials the milk and glow can be drawn with (MemoryPassMaterial).</summary>
        public static readonly string[] PassKeys = { "FallenWarrior", "WeaponGlow", "LitParticles", "SurfaceParticles", "LuxParticles" };

        private static readonly (string Key, string Shader, string Preferred, string Keyword)[] Candidates =
        {
            ("FallenWarrior", "Custom/Fallen Warrior", "FallenWarrior", null),
            ("WeaponGlow", "Unlit/WeaponGlow", "Berzerkr_LightningGlow_Static_Mat", null),
            ("LitParticles", "Custom/LitParticles", "distant_fog", null),
            ("SurfaceParticles", "Particles/Standard Surface2", "feather_white", "_ALPHABLEND_ON"),
            ("LuxParticles", "Lux Lit Particles/ Bumped", null, null),
        };

        private const string PassName = "villheim_memory_pass";
        private const int MilkQueue = 2999;
        private const int GlowQueue = 3001;
        private const int MaxLayers = 4;
        private const float BakeRange = 30f;
        private const int MaxBakedParts = 48;
        private static readonly Color Magenta = new Color(1f, 0f, 1f, 1f);

        private static readonly HashSet<Material> Own = new HashSet<Material>();
        private static readonly HashSet<Renderer> PassRenderers = new HashSet<Renderer>();
        private static Material _milk;
        private static readonly Material[] Glow = new Material[MaxLayers];
        private static readonly float[] GlowPush = new float[MaxLayers];
        private static Material _foot;
        private static Material _passSource, _footSource;
        private static string _passKey;
        private static Mesh _card;
        private static Texture2D _radial;
        private static bool _searched;
        private static float _nextValues;
        private static bool _dirty = true;
        private static int _layers;
        private static bool _milkOn;
        private static bool _baked;
        private static MaterialPropertyBlock _block;
        private static readonly int VertPush = Shader.PropertyToID("_VertPush");
        private static float _probeAt = -1f;
        private static int _probeTries;

        private static string Solo => LogicConfig.MemoryDebugSolo?.Value ?? "Off";

        private sealed class Passes
        {
            public Renderer Milk;
            public readonly List<Renderer> Shells = new List<Renderer>();
            public bool Baked;
            public Mesh Pose;
            public readonly List<Mesh> ShellMeshes = new List<Mesh>();
            public int Parity;
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

        /// <summary>
        /// The body's _TintColor on the Fallen Warrior shader: its own colors, tinted, scaled by alpha. Black (nothing
        /// added) while MemoryDebugSolo shows one part alone.
        /// </summary>
        public static Color BodyTint(float tint, float alpha)
        {
            if (Solo != "Off")
            {
                return new Color(0f, 0f, 0f, alpha);
            }

            Color color = Color.Lerp(Color.white, LogicConfig.MemoryTintColor.Value, tint) * LogicConfig.MemoryBrightness.Value * alpha;
            return new Color(color.r, color.g, color.b, alpha);
        }

        // ---------------------------------------------------------------- the passes on each part

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
            if (passes == null)
            {
                passes = new Passes { Parity = Decorated.Count & 1 };
                Decorated[renderer] = passes;
            }

            int subMeshes = Mathf.Max(1, mesh.subMeshCount);

            // The milk: the part's own mesh and bones.
            if (_milkOn && _milk != null)
            {
                if (passes.Milk == null)
                {
                    passes.Milk = MakePass(renderer, false);
                }

                Sync(renderer, passes.Milk);
                SetMaterials(passes.Milk, _milk, subMeshes);
                SetPush(passes.Milk, 0f);
            }
            else if (passes.Milk != null)
            {
                Drop(passes.Milk);
                passes.Milk = null;
            }

            // The shells: pushed by the shader, or baked (plain mesh renderers fed in LateUpdate).
            bool baked = _baked && renderer is SkinnedMeshRenderer;
            if (passes.Baked != baked)
            {
                ClearShells(passes);
                passes.Baked = baked;
            }

            int wanted = 0;
            for (int i = 0; i < _layers; i++)
            {
                if (Glow[i] != null)
                {
                    wanted++;
                }
            }

            while (passes.Shells.Count > wanted)
            {
                Drop(passes.Shells[passes.Shells.Count - 1]);
                passes.Shells.RemoveAt(passes.Shells.Count - 1);
            }

            while (passes.Shells.Count < wanted)
            {
                passes.Shells.Add(MakePass(renderer, baked));
            }

            float scale = Scale(renderer);
            for (int i = 0; i < passes.Shells.Count; i++)
            {
                Renderer shell = passes.Shells[i];
                if (shell == null)
                {
                    continue;
                }

                if (!baked)
                {
                    Sync(renderer, shell);
                    SetPush(shell, GlowPush[i] / scale);
                }
                else
                {
                    shell.enabled = renderer.enabled;
                    shell.forceRenderingOff = renderer.forceRenderingOff;
                }

                SetMaterials(shell, Glow[i], subMeshes);
            }
        }

        private static void SetMaterials(Renderer pass, Material material, int subMeshes)
        {
            Material[] current = pass.sharedMaterials;
            if (current.Length != subMeshes || current.Any(m => m != material))
            {
                pass.sharedMaterials = Enumerable.Repeat(material, subMeshes).ToArray();
            }
        }

        private static void SetPush(Renderer pass, float push)
        {
            if (_block == null)
            {
                _block = new MaterialPropertyBlock();
            }

            pass.GetPropertyBlock(_block);
            _block.SetFloat(VertPush, push);
            pass.SetPropertyBlock(_block);
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
            return ScaleOf(space);
        }

        private static float ScaleOf(Transform space)
        {
            Vector3 lossy = space.lossyScale;
            float scale = (Mathf.Abs(lossy.x) + Mathf.Abs(lossy.y) + Mathf.Abs(lossy.z)) / 3f;
            return scale > 1e-5f ? scale : 1f;
        }

        /// <summary>A pass renderer under the part: a skinned copy sharing its bones, or (baked) a plain mesh renderer.</summary>
        private static Renderer MakePass(Renderer source, bool baked)
        {
            var go = new GameObject(PassName);
            go.transform.SetParent(source.transform, false);
            Renderer made;
            if (source is SkinnedMeshRenderer skinned && !baked)
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
            if (!baked)
            {
                Sync(source, made);
            }

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

        private static void ClearShells(Passes passes)
        {
            foreach (Renderer shell in passes.Shells)
            {
                Drop(shell);
            }

            passes.Shells.Clear();
            foreach (Mesh mesh in passes.ShellMeshes)
            {
                Object.Destroy(mesh);
            }

            passes.ShellMeshes.Clear();
            if (passes.Pose != null)
            {
                Object.Destroy(passes.Pose);
                passes.Pose = null;
            }
        }

        private static void Strip(Renderer renderer, Passes passes)
        {
            Drop(passes.Milk);
            passes.Milk = null;
            ClearShells(passes);
            Decorated.Remove(renderer);
        }

        // ---------------------------------------------------------------- baked shells

        private static readonly List<Vector3> Vertices = new List<Vector3>(8192);
        private static readonly List<Vector3> Normals = new List<Vector3>(8192);
        private static readonly List<Vector3> Pushed = new List<Vector3>(8192);
        private static readonly List<int> Triangles = new List<int>(16384);

        /// <summary>
        /// Every frame, half the baked parts: the part's pose is copied (BakeMesh, in the part's own space) and each
        /// shell gets it pushed out along the normals by its share of the spread. Only parts within 30 m of the camera
        /// and at most MaxBakedParts of them a frame.
        /// </summary>
        private static void BakeShells()
        {
            if (!_baked || Decorated.Count == 0)
            {
                return;
            }

            Camera camera = Utils.GetMainCamera();
            if (camera == null)
            {
                return;
            }

            Vector3 eye = camera.transform.position;
            int parity = Time.frameCount & 1;
            int done = 0;
            foreach (KeyValuePair<Renderer, Passes> pair in Decorated)
            {
                Passes passes = pair.Value;
                if (!passes.Baked || passes.Shells.Count == 0 || passes.Parity != parity || !(pair.Key is SkinnedMeshRenderer skinned) ||
                    skinned == null || skinned.sharedMesh == null)
                {
                    continue;
                }

                bool near = (skinned.transform.position - eye).sqrMagnitude < BakeRange * BakeRange;
                foreach (Renderer shell in passes.Shells)
                {
                    if (shell != null)
                    {
                        shell.enabled = near && skinned.enabled;
                        shell.forceRenderingOff = skinned.forceRenderingOff;
                    }
                }

                if (!near || done >= MaxBakedParts)
                {
                    continue;
                }

                done++;
                Bake(skinned, passes);
            }
        }

        private static bool _bakeLogged;

        private static float Inverse(float value) => Mathf.Abs(value) > 1e-6f ? 1f / value : 1f;

        private static void Bake(SkinnedMeshRenderer skinned, Passes passes)
        {
            if (passes.Pose == null)
            {
                passes.Pose = new Mesh { name = "villheim_memory_pose" };
                passes.Pose.MarkDynamic();
            }

            // Baked with the part's scale, so the copy is in meters around the part; each shell undoes the part's
            // scale it would inherit, so it sits exactly on the body (the parts are scaled about 95 times).
            skinned.BakeMesh(passes.Pose, true);
            passes.Pose.GetVertices(Vertices);
            passes.Pose.GetNormals(Normals);
            if (Normals.Count != Vertices.Count)
            {
                return;
            }

            Vector3 lossy = skinned.transform.lossyScale;
            Vector3 undo = new Vector3(Inverse(lossy.x), Inverse(lossy.y), Inverse(lossy.z));
            if (!_bakeLogged)
            {
                _bakeLogged = true;
                VillheimPlugin.Log.LogInfo($"Memory look: first baked glow shell on '{skinned.name}' ({Vertices.Count} vertices, part scale {lossy}).");
            }

            for (int i = 0; i < passes.Shells.Count; i++)
            {
                Renderer shell = passes.Shells[i];
                if (shell == null)
                {
                    continue;
                }

                Transform place = shell.transform;
                place.localPosition = Vector3.zero;
                place.localRotation = Quaternion.identity;
                place.localScale = undo;

                while (passes.ShellMeshes.Count <= i)
                {
                    var created = new Mesh { name = "villheim_memory_shell" };
                    created.MarkDynamic();
                    passes.ShellMeshes.Add(created);
                }

                Mesh mesh = passes.ShellMeshes[i];
                float push = GlowPush[i];
                Pushed.Clear();
                for (int v = 0; v < Vertices.Count; v++)
                {
                    Pushed.Add(Vertices[v] + Normals[v].normalized * push);
                }

                bool topology = mesh.vertexCount != Vertices.Count || mesh.subMeshCount != passes.Pose.subMeshCount;
                if (topology)
                {
                    mesh.Clear();
                }

                mesh.SetVertices(Pushed);
                if (topology)
                {
                    mesh.SetNormals(Normals);
                    mesh.subMeshCount = passes.Pose.subMeshCount;
                    for (int s = 0; s < passes.Pose.subMeshCount; s++)
                    {
                        passes.Pose.GetTriangles(Triangles, s);
                        mesh.SetTriangles(Triangles, s);
                    }
                }

                mesh.RecalculateBounds();
                MeshFilter filter = shell.GetComponent<MeshFilter>();
                if (filter != null && filter.sharedMesh != mesh)
                {
                    filter.sharedMesh = mesh;
                }
            }
        }

        // ---------------------------------------------------------------- the feet

        private sealed class Feet
        {
            public GameObject Holder;
            public readonly List<Transform> Cards = new List<Transform>();
            public Light Light;
        }

        // The foot bone names the game itself looks for (FootStep, CharacterAnimEvent).
        private static readonly string[] LeftFeet = { "LeftFoot", "LeftFootFront", "LeftFootBack", "l_foot", "Foot.l", "foot.l" };
        private static readonly string[] RightFeet = { "RightFoot", "RightFootFront", "RightFootBack", "r_foot", "Foot.r", "foot.r" };

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

            bool feetOn = want && LogicConfig.MemoryFeetGlow != null && LogicConfig.MemoryFeetGlow.Value && Solo != "Milk" && Solo != "Glow";
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
                if (feet != null)
                {
                    Remove(character, feet);
                }

                feet = Make(character);
                FeetRigs[character] = feet;
            }

            float size = LogicConfig.MemoryFeetSize.Value;
            foreach (Transform card in feet.Cards)
            {
                if (card != null && card.parent != null)
                {
                    card.localScale = Vector3.one * size / ScaleOf(card.parent);
                }
            }

            if (feet.Light != null)
            {
                float light = Solo == "Feet" ? 0f : LogicConfig.MemoryFeetLight.Value;
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
            if (_card != null && _foot != null)
            {
                Transform[] all = character.GetComponentsInChildren<Transform>(true);
                foreach (string[] names in new[] { LeftFeet, RightFeet })
                {
                    Transform foot = names.Select(n => all.FirstOrDefault(t => t.name == n)).FirstOrDefault(t => t != null);
                    if (foot != null)
                    {
                        feet.Cards.Add(SoleCard(character, foot));
                    }
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

        /// <summary>
        /// A glow card under the sole of one foot, a child of the foot bone. Placed between the ankle and the toe
        /// (the foot's first child), at the sole: the ankle's height over the character's feet when that is a
        /// standing height, else 8 cm below the ankle. Lies flat as the foot stands now and tilts with the foot after.
        /// </summary>
        private static Transform SoleCard(Character character, Transform foot)
        {
            Vector3 ankle = foot.position;
            Transform toe = foot.childCount > 0 ? foot.GetChild(0) : null;
            Vector3 middle = toe != null ? (ankle + toe.position) * 0.5f : ankle;
            float height = ankle.y - character.transform.position.y;
            float drop = height > 0.02f && height < 0.2f ? height : 0.08f;
            Vector3 sole = new Vector3(middle.x, ankle.y - drop + 0.01f, middle.z);
            Vector3 facing = Vector3.ProjectOnPlane(character.transform.forward, Vector3.up);

            var card = new GameObject("villheim_memory_sole");
            card.transform.SetParent(foot, false);
            card.transform.position = sole;
            card.transform.rotation = Quaternion.LookRotation(facing.sqrMagnitude > 1e-4f ? facing.normalized : Vector3.forward, Vector3.up);
            card.AddComponent<MeshFilter>().sharedMesh = _card;
            MeshRenderer renderer = card.AddComponent<MeshRenderer>();
            renderer.sharedMaterial = _foot;
            renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            renderer.receiveShadows = false;
            PassRenderers.Add(renderer);
            return card.transform;
        }

        private static void Remove(Character character, Feet feet)
        {
            foreach (Transform card in feet.Cards)
            {
                if (card != null)
                {
                    PassRenderers.Remove(card.GetComponent<Renderer>());
                    Object.Destroy(card.gameObject);
                }
            }

            if (feet.Holder != null)
            {
                Object.Destroy(feet.Holder);
            }

            FeetRigs.Remove(character);
        }

        private static void PruneFeet()
        {
            foreach (Character gone in FeetRigs.Keys.Where(c => c == null || c.IsDead()).ToList())
            {
                Remove(gone, FeetRigs[gone]);
            }
        }

        // ---------------------------------------------------------------- shared materials

        /// <summary>Finds the game materials to copy, makes the shared materials and keeps their values current.</summary>
        private static void Prepare()
        {
            string key = LogicConfig.MemoryPassMaterial?.Value ?? PassKeys[0];
            if (!_searched || key != _passKey)
            {
                Search(key);
            }

            if (_dirty || Time.time >= _nextValues)
            {
                SetValues();
            }
        }

        private static void Search(string key)
        {
            if (ZNetScene.instance == null)
            {
                return;
            }

            Material[] all = Resources.FindObjectsOfTypeAll<Material>();
            if (!_searched)
            {
                _searched = true;
                _card = MakeCard();
                _radial = MakeRadial();
                _footSource = Pick(all, "Custom/LitParticles", null, "distant_fog")
                              ?? Pick(all, "Particles/Standard Unlit2", m => m.IsKeywordEnabled("_ALPHABLEND_ON"), "DraugrFangGlow");
                if (_footSource != null)
                {
                    _foot = Ground(Copy(_footSource, "villheim_memory_foot"));
                }
            }

            // The pass materials, from the candidate picked now (made again when MemoryPassMaterial changes).
            foreach (Material old in new[] { _milk }.Concat(Glow))
            {
                if (old != null)
                {
                    Own.Remove(old);
                    Object.Destroy(old);
                }
            }

            _milk = null;
            Array.Clear(Glow, 0, Glow.Length);
            _passKey = key;
            var candidate = Candidates.FirstOrDefault(c => c.Key == key);
            if (candidate.Key == null)
            {
                candidate = Candidates[0];
            }

            string keyword = candidate.Keyword;
            _passSource = Pick(all, candidate.Shader, keyword == null ? null : (Func<Material, bool>)(m => m.IsKeywordEnabled(keyword)), candidate.Preferred);
            if (_passSource != null)
            {
                _milk = PassCopy("villheim_memory_milk", MilkQueue);
                for (int i = 0; i < MaxLayers; i++)
                {
                    Glow[i] = PassCopy("villheim_memory_glow" + i, GlowQueue + i);
                }
            }

            _dirty = true;
            VillheimPlugin.Log.LogInfo($"Memory look: pass material {key}: " + Sources());
        }

        /// <summary>A copy of the pass material made even: plain white textures, no noise, no curl, no scrolling, no fading.</summary>
        private static Material PassCopy(string name, int queue)
        {
            Material copy = Copy(_passSource, name);
            foreach (string texture in new[] { "_MainTex", "_ChestTex", "_LegsTex", "_EmissionMap", "_AlbedoMap" })
            {
                if (copy.HasProperty(texture))
                {
                    copy.SetTexture(texture, Texture2D.whiteTexture);
                }
            }

            void Set(string property, float value)
            {
                if (copy.HasProperty(property))
                {
                    copy.SetFloat(property, value);
                }
            }

            // _CurlTex is a 3D texture: left as it is, with its strength at 0.
            Set("_CurlStrength", 0f);
            Set("_ScrollSpeed", 0f);
            Set("_ScrollSpeedX", 0f);
            Set("_DomainWarp", 0f);
            Set("_VertPush", 0f);
            Set("_Billboard", 0f);
            Set("_ZFadeDistance", 0.001f);
            Set("_CameraFadeDistanceMin", 0f);
            Set("_CameraFadeDistanceMax", 0.01f);
            Set("_CameraYFadeDistance", 0f);
            Set("_SkyMask", 0f);
            Set("_Cull", (float)UnityEngine.Rendering.CullMode.Back);
            if (copy.HasProperty("_SoftParticleFadeParams"))
            {
                copy.SetVector("_SoftParticleFadeParams", new Vector4(0f, 1000f, 0f, 0f));
            }

            if (copy.HasProperty("_CameraFadeParams"))
            {
                copy.SetVector("_CameraFadeParams", new Vector4(0f, float.PositiveInfinity, 0f, 0f));
            }

            if (copy.HasProperty("_SkinColor"))
            {
                copy.SetColor("_SkinColor", Color.white);
            }

            copy.renderQueue = queue;
            return copy;
        }

        /// <summary>A color and strength on a pass material, in whatever way its shader takes them.</summary>
        private static void Paint(Material material, Color color, float strength)
        {
            if (material == null)
            {
                return;
            }

            if (material.shader.name == "Custom/Fallen Warrior")
            {
                // It adds its color over what is behind: the strength is how much it adds.
                material.SetColor("_TintColor", new Color(color.r * strength, color.g * strength, color.b * strength, strength));
                return;
            }

            if (material.HasProperty("_Color"))
            {
                material.SetColor("_Color", new Color(color.r, color.g, color.b, strength));
            }

            if (material.HasProperty("_TintColor"))
            {
                material.SetColor("_TintColor", new Color(color.r, color.g, color.b, strength));
            }

            if (material.HasProperty("_EmissionColor") && material.shader.name == "Custom/LitParticles")
            {
                material.SetColor("_EmissionColor", color * strength);
            }
        }

        private static Material Copy(Material source, string name)
        {
            var copy = new Material(source) { name = name };
            copy.SetShaderPassEnabled("ShadowCaster", false);
            Own.Add(copy);
            return copy;
        }

        /// <summary>
        /// The foot card's material: the soft round texture, its fading into what is behind it and near the camera
        /// cut down, and nothing facing the camera.
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

            string solo = Solo;
            float dark = GhostLook.Darkness();
            float milk = Mathf.Clamp01(Mathf.Lerp(LogicConfig.MemoryMilkDay.Value, LogicConfig.MemoryMilk.Value, dark));
            _milkOn = solo == "Milk" || (solo == "Off" && milk > 0.001f);
            Paint(_milk, solo == "Milk" ? Magenta : LogicConfig.MemoryMilkColor.Value, solo == "Milk" ? 1f : milk);
            if (_milk != null && _milk.HasProperty("_EdgeFading"))
            {
                _milk.SetVector("_EdgeFading", LogicConfig.MemoryGlowEdge.Value);
            }

            float strength = Mathf.Clamp01(Mathf.Lerp(LogicConfig.MemoryGlowDay.Value, LogicConfig.MemoryGlow.Value, dark));
            int layers = Mathf.Clamp(LogicConfig.MemoryGlowLayers.Value, 0, MaxLayers);
            float spread = LogicConfig.MemoryGlowSpread.Value;
            if (solo == "Glow")
            {
                strength = 1f;
                layers = Mathf.Max(1, layers);
                spread = Mathf.Max(0.01f, spread);
            }

            _layers = (solo == "Off" || solo == "Glow") && strength > 0.001f && spread > 0.0001f ? layers : 0;
            string mode = LogicConfig.MemoryShellMode?.Value ?? "Auto";
            bool push = _passSource != null && _passSource.HasProperty("_VertPush");
            _baked = mode == "Baked" || (mode == "Auto" && !push);
            float softness = LogicConfig.MemoryGlowSoftness.Value;
            Color glowColor = solo == "Glow" ? Magenta : LogicConfig.MemoryGlowColor.Value;
            for (int i = 0; i < MaxLayers; i++)
            {
                GlowPush[i] = layers > 0 ? spread * (i + 1) / layers : 0f;
                if (Glow[i] == null || i >= layers)
                {
                    continue;
                }

                // Shell i reaches (i + 1) / n of the spread. Softness 0: every shell as strong; 1: the outer ones much fainter.
                float t = layers <= 1 ? 0f : (float)i / (layers - 1);
                float weight = solo == "Glow" ? 1f : Mathf.Lerp(1f, Mathf.Pow(1f - 0.85f * t, 3f), softness);
                Paint(Glow[i], glowColor, Mathf.Clamp01(strength * weight));
                if (Glow[i].HasProperty("_EdgeFading"))
                {
                    Glow[i].SetVector("_EdgeFading", LogicConfig.MemoryGlowEdge.Value);
                }
            }

            if (_foot != null)
            {
                Color feet = solo == "Feet" ? Magenta : LogicConfig.MemoryFeetColor.Value;
                float feetStrength = solo == "Feet" ? 1f : LogicConfig.MemoryFeetStrength.Value;
                _foot.SetColor("_Color", new Color(feet.r, feet.g, feet.b, feetStrength));
                if (_foot.HasProperty("_EmissionColor") && _foot.shader.name == "Custom/LitParticles")
                {
                    _foot.SetColor("_EmissionColor", feet * feetStrength);
                }
            }
        }

        /// <summary>For 'vh memory shaders': which game materials each part copies.</summary>
        public static string Sources()
        {
            string Name(Material m) => m == null ? "none found" : $"'{m.name}' ({m.shader.name})";
            Shader ghost = GhostLook.SeeThroughShader();
            return $"colors: GhostLook's '{(ghost != null ? ghost.name : "none found")}'; milk and glow ({_passKey}) from {Name(_passSource)}" +
                   $"{(_passSource != null ? (_passSource.HasProperty("_VertPush") ? ", pushes vertices" : ", no vertex push") : "")}; " +
                   $"feet from {Name(_footSource)} with a soft round texture made here.";
        }

        public static string Report()
        {
            Prepare();
            float dark = GhostLook.Darkness();
            BodyValues(dark, out float tint, out float alpha);
            return $"Villheim: memory look {(Active ? "on" : "off (LookMode is " + LogicConfig.LookMode?.Value + ")")}, " +
                   $"GhostLook {(LogicConfig.GhostLook != null && LogicConfig.GhostLook.Value ? "on" : "off")}, solo {Solo}.\n" + Sources() +
                   $"\nnow (darkness {dark:0.##}): alpha {alpha:0.##}, tint {tint:0.##}, milk {(_milkOn ? "on" : "off")}, glow shells {_layers} " +
                   $"({(_baked ? "baked" : "pushed by the shader")}); {Decorated.Count} villager parts carry passes, {FeetRigs.Count} feet glows.";
        }

        // ---------------------------------------------------------------- the probe

        private static readonly string[] ProbeProperties =
        {
            "_TintColor", "_Color", "_SkinColor", "_Cutoff", "_VertPush", "_EdgeFading", "_SrcBlend", "_DstBlend", "_ZWrite",
        };

        /// <summary>
        /// Every renderer of the 'vh memory' model and the villagers within 30 m, into the log: its shader, render
        /// queue, keywords and the values this look sets, and its passes.
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
                    .Take(3));
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
                    Mesh mesh = renderer is SkinnedMeshRenderer || renderer.GetComponent<MeshFilter>() != null ? MeshOf(renderer) : null;
                    if (pass)
                    {
                        passes++;
                    }
                    else
                    {
                        parts++;
                    }

                    string got = "";
                    if (!pass && Decorated.TryGetValue(renderer, out Passes p))
                    {
                        got = $" milk {(p.Milk != null ? "yes" : "no")}, shells {p.Shells.Count} {(p.Baked ? "baked" : "pushed")}";
                    }

                    renderer.GetPropertyBlock(block);
                    log.Append($"  {(pass ? "  pass" : "part")} '{renderer.name}' {renderer.GetType().Name} sub-meshes {(mesh != null ? mesh.subMeshCount : 0)} " +
                               $"vertices {(mesh != null ? mesh.vertexCount : 0)} vertex colors {(mesh != null && mesh.isReadable ? (mesh.colors32.Length > 0 ? "yes" : "no") : "?")} " +
                               $"enabled {renderer.enabled} visible {renderer.isVisible} off {renderer.forceRenderingOff} root scale {Scale(renderer):0.####} own scale {renderer.transform.lossyScale}" +
                               (pass ? $" block _VertPush {(block.isEmpty ? "none" : block.GetFloat(VertPush).ToString("0.#####"))}" : got) + "\n");
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

                        log.Append($"      '{material.name}' shader '{material.shader?.name}' supported {material.shader?.isSupported} queue {material.renderQueue} " +
                                   "keywords [" + string.Join(" ", material.shaderKeywords) + "] " + string.Join(", ", values) + "\n");
                    }
                }
            }

            VillheimPlugin.Log.LogInfo(log.ToString());
            return $"Villheim: memory look probe written to the log ({characters.Count} models, {parts} parts, {passes} passes and feet cards).";
        }

        // ---------------------------------------------------------------- the preview model and the command

        private static GameObject _preview;
        private static Character _previewCharacter;

        /// <summary>'vh memory [woman|clear|shaders|probe|pass next]': a still model with the look, to tune the dials against.</summary>
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

            if (first == "pass")
            {
                if (LogicConfig.MemoryPassMaterial == null)
                {
                    return "Villheim: settings not loaded.";
                }

                int at = Array.IndexOf(PassKeys, LogicConfig.MemoryPassMaterial.Value);
                LogicConfig.MemoryPassMaterial.Value = PassKeys[(at + 1) % PassKeys.Length];
                Prepare();
                _probeAt = Time.time + 1.5f;
                _probeTries = 4;
                return $"Villheim: milk and glow now drawn with {LogicConfig.MemoryPassMaterial.Value}.\n" + Sources() +
                       "\nA probe goes to the log in a moment.";
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
            Vector3 spot = player.transform.position + forward * 3f;
            if (ZoneSystem.instance != null && ZoneSystem.instance.GetGroundHeight(spot, out float y))
            {
                spot.y = y;
            }

            bool female = first == "woman" || first == "female";
            HairReview.RigColors(out Vector3 skin, out Vector3 hairColor);
            _preview = ChildBody.Model(spot, Quaternion.LookRotation(-forward), female, female ? "Hair12" : "Hair3", female ? "none" : "Beard5",
                skin, hairColor);
            if (_preview == null)
            {
                return "Villheim: no villager prefab to make the model from.";
            }

            _preview.name = "villheim_kids_rig_memory";
            _previewCharacter = _preview.GetComponent<Character>();
            _probeAt = Time.time + 2.5f;
            _probeTries = 4;
            string note = Active ? "" : $"\nLookMode is {LogicConfig.LookMode?.Value}: set it to Memory to see this look.";
            if (LogicConfig.GhostLook != null && !LogicConfig.GhostLook.Value)
            {
                note += "\nGhostLook ('3c - Villager looks') is off: turn it on to see any look.";
            }

            return $"Villheim: a still {(female ? "woman" : "man")} stands 3 m in front of you with the memory look; a probe of it goes to the log " +
                   "in a moment. F1, '3e - Look: memory', changes it as you drag. 'vh memory woman' for a woman, 'vh memory clear' takes it " +
                   "away, 'vh memory pass next' tries the next game material for the milk and glow, 'vh memory probe' writes the probe again." + note;
        }

        private static void ClearPreview()
        {
            if (_preview != null)
            {
                foreach (Renderer renderer in _preview.GetComponentsInChildren<Renderer>(true))
                {
                    if (Decorated.TryGetValue(renderer, out Passes passes))
                    {
                        Strip(renderer, passes);
                    }

                    PassRenderers.Remove(renderer);
                }

                if (_previewCharacter != null && FeetRigs.TryGetValue(_previewCharacter, out Feet feet))
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

                    BakeShells();
                    if (_probeAt > 0f && Time.time >= _probeAt)
                    {
                        // The model gets the look a few seconds after it is put up: wait for its passes (up to 10 s).
                        bool ready = _previewCharacter == null || !Active ||
                                     _previewCharacter.GetComponentsInChildren<Renderer>(true).Any(r => Decorated.ContainsKey(r));
                        if (!ready && _probeTries-- > 0)
                        {
                            _probeAt = Time.time + 2f;
                        }
                        else
                        {
                            _probeAt = -1f;
                            Probe();
                        }
                    }

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

        /// <summary>Forgets parts that are gone (their passes went with them, as children) and their baked meshes.</summary>
        private static void Prune()
        {
            foreach (KeyValuePair<Renderer, Passes> gone in Decorated.Where(p => p.Key == null).ToList())
            {
                ClearShells(gone.Value);
                Decorated.Remove(gone.Key);
            }

            PassRenderers.RemoveWhere(r => r == null);
            PruneFeet();
        }

        /// <summary>Logic unload: the passes, feet glows and model go (they belong to this build).</summary>
        public static void Unload()
        {
            ClearPreview();
            foreach (KeyValuePair<Renderer, Passes> pair in Decorated.ToList())
            {
                Drop(pair.Value.Milk);
                ClearShells(pair.Value);
            }

            Decorated.Clear();
            foreach (KeyValuePair<Character, Feet> pair in FeetRigs.ToList())
            {
                Remove(pair.Key, pair.Value);
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
