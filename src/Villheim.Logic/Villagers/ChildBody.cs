using System;
using System.Collections.Generic;
using System.Linq;
using BepInEx.Configuration;
using HarmonyLib;
using UnityEngine;
using Villheim.Prefabs;
using Object = UnityEngine.Object;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// A child's body (T-28, D-049). The game has one grown body per sex and no child model, and new models are out
    /// (D-013), so a child is the grown body reshaped by its bones, the way BoneMod resizes a player: the whole body is
    /// scaled down (Height), and against that the head is scaled up, the neck, arms and legs made shorter and the
    /// shoulders and hips narrower. The values are the ChildBoy and ChildGirl settings in "3c - Villager looks"; each
    /// eases to 1 as the child grows up.
    ///
    /// The bones are set every frame after the animator has posed them (a postfix on MonoUpdaters.LateUpdate), so a
    /// change in the config manager shows at once. Bones are found by name (Hips, Spine, Neck, Head, LeftShoulder,
    /// LeftArm, LeftUpLeg, LeftFoot and their right-hand twins), or through the animator's humanoid map.
    ///
    /// Scales are passed down the skeleton, so each bone is set against its parents: the neck's scale is Neck/Torso,
    /// the head's Head/Neck, the arms' Arms/Torso. Shorter legs would leave the feet in the air, so the body is lowered
    /// by what the legs lost.
    ///
    /// 'vh kids rig' stands a grown man, a boy, a girl and a grown woman in a row in front of the player, still and in
    /// the model's rest pose, to tune the settings against; 'vh kids rig clear' takes them away. They are not
    /// villagers: no AI, nothing saved.
    /// </summary>
    internal static class ChildBody
    {
        private sealed class Body
        {
            public GameObject Root;
            public Villager Villager;
            public bool Female;
            public float FixedAge = -1f;
            public Transform Visual;
            public Vector3 VisualBase;
            public float LegLength;
            public Transform Spine, Neck, Head, LeftArm, RightArm, LeftUpLeg, RightUpLeg, LeftShoulder, RightShoulder;
            public Vector3 LeftShoulderBase, RightShoulderBase, LeftUpLegBase, RightUpLegBase;
            public bool Ready;
        }

        private static readonly List<Body> Bodies = new List<Body>();
        private static readonly List<GameObject> Rig = new List<GameObject>();

        private static bool Shaped => LogicConfig.ChildProportions == null || LogicConfig.ChildProportions.Value;

        /// <summary>One setting for this sex, 1 when not bound.</summary>
        private static float Part(bool female, int index)
        {
            ConfigEntry<float> entry = LogicConfig.ChildShape[female ? 1 : 0][index];
            return entry != null ? entry.Value : 1f;
        }

        private static bool IsFemale(Villager villager) => villager.m_visEquipment != null && villager.m_visEquipment.GetModelIndex() == 1;

        /// <summary>From Childhood: keeps a child's body shaped for his age (and lets go once he is grown).</summary>
        public static void Track(Villager villager)
        {
            if (villager == null || Bodies.Any(b => b.Villager == villager))
            {
                return;
            }

            Bodies.Add(new Body { Root = villager.gameObject, Villager = villager, Female = IsFemale(villager) });
        }

        /// <summary>A child's age from 0 (born) to 1 (grown).</summary>
        private static float Age(Body body)
        {
            if (body.FixedAge >= 0f)
            {
                return body.FixedAge;
            }

            ZDO zdo = body.Villager != null ? body.Villager.Zdo : null;
            int born = zdo != null ? zdo.GetInt(Childhood.KeyBorn, -1) : -1;
            if (born < 0 || EnvMan.instance == null)
            {
                return 1f;
            }

            return Mathf.Clamp01((EnvMan.instance.GetDay() - born + EnvMan.instance.GetDayFraction()) / Childhood.GrowDays);
        }

        // ---------------------------------------------------------------- every frame

        private static void LateTick()
        {
            for (int i = Bodies.Count - 1; i >= 0; i--)
            {
                Body body = Bodies[i];
                if (body.Root == null || (body.Villager != null && body.Villager.IsDead()))
                {
                    Bodies.RemoveAt(i);
                    continue;
                }

                if (body.Villager != null)
                {
                    body.Female = IsFemale(body.Villager);
                }

                float age = Age(body);
                Apply(body, age);
                if (age >= 1f)
                {
                    // Grown: everything is back at 1, so he is let go.
                    Bodies.RemoveAt(i);
                }
            }
        }

        private static void Apply(Body body, float age)
        {
            if (!body.Ready && !Setup(body))
            {
                return;
            }

            float F(int index, bool shaped = true) => Mathf.Lerp(shaped ? Mathf.Max(0.05f, Part(body.Female, index)) : 1f, 1f, age);
            bool shape = Shaped;
            float height = F(0);
            float head = F(1, shape), neck = F(2, shape), torso = F(3, shape), arms = F(4, shape), legs = F(5, shape);
            float shoulders = F(6, shape), hips = F(7, shape);

            SetScale(body.Root.transform, height);
            SetScale(body.Spine, torso);
            SetScale(body.Neck, neck / torso);
            SetScale(body.Head, head / neck);
            SetScale(body.LeftArm, arms / torso);
            SetScale(body.RightArm, arms / torso);
            SetScale(body.LeftUpLeg, legs);
            SetScale(body.RightUpLeg, legs);
            if (body.LeftShoulder != null) body.LeftShoulder.localPosition = body.LeftShoulderBase * shoulders;
            if (body.RightShoulder != null) body.RightShoulder.localPosition = body.RightShoulderBase * shoulders;
            if (body.LeftUpLeg != null) body.LeftUpLeg.localPosition = body.LeftUpLegBase * hips;
            if (body.RightUpLeg != null) body.RightUpLeg.localPosition = body.RightUpLegBase * hips;
            if (body.Visual != null)
            {
                body.Visual.localPosition = body.VisualBase - Vector3.up * ((1f - legs) * body.LegLength);
            }
        }

        private static void SetScale(Transform bone, float scale)
        {
            if (bone != null && Mathf.Abs(bone.localScale.x - scale) > 0.001f)
            {
                bone.localScale = Vector3.one * scale;
            }
        }

        /// <summary>Finds the bones once and notes their rest offsets and the leg length.</summary>
        private static bool Setup(Body body)
        {
            Character character = body.Root.GetComponent<Character>();
            GameObject visual = character != null && character.m_visual != null ? character.m_visual : body.Root;
            Transform[] all = visual.GetComponentsInChildren<Transform>(true);
            Animator animator = visual.GetComponentInChildren<Animator>();

            Transform Bone(string name, HumanBodyBones human)
            {
                Transform found = all.FirstOrDefault(t => t.name == name);
                if (found == null && animator != null && animator.isHuman)
                {
                    found = animator.GetBoneTransform(human);
                }

                return found;
            }

            body.Spine = Bone("Spine", HumanBodyBones.Spine);
            body.Neck = Bone("Neck", HumanBodyBones.Neck);
            body.Head = Bone("Head", HumanBodyBones.Head);
            body.LeftArm = Bone("LeftArm", HumanBodyBones.LeftUpperArm);
            body.RightArm = Bone("RightArm", HumanBodyBones.RightUpperArm);
            body.LeftUpLeg = Bone("LeftUpLeg", HumanBodyBones.LeftUpperLeg);
            body.RightUpLeg = Bone("RightUpLeg", HumanBodyBones.RightUpperLeg);
            body.LeftShoulder = Bone("LeftShoulder", HumanBodyBones.LeftShoulder);
            body.RightShoulder = Bone("RightShoulder", HumanBodyBones.RightShoulder);
            Transform foot = Bone("LeftFoot", HumanBodyBones.LeftFoot);
            if (body.Head == null || body.Spine == null)
            {
                return false;
            }

            body.LeftShoulderBase = body.LeftShoulder != null ? body.LeftShoulder.localPosition : Vector3.zero;
            body.RightShoulderBase = body.RightShoulder != null ? body.RightShoulder.localPosition : Vector3.zero;
            body.LeftUpLegBase = body.LeftUpLeg != null ? body.LeftUpLeg.localPosition : Vector3.zero;
            body.RightUpLegBase = body.RightUpLeg != null ? body.RightUpLeg.localPosition : Vector3.zero;
            body.Visual = visual != body.Root ? visual.transform : null;
            body.VisualBase = body.Visual != null ? body.Visual.localPosition : Vector3.zero;
            float scale = Mathf.Max(0.01f, body.Root.transform.lossyScale.y);
            body.LegLength = body.LeftUpLeg != null && foot != null ? Vector3.Distance(body.LeftUpLeg.position, foot.position) / scale : 0f;
            body.Ready = true;
            VillheimPlugin.Debug($"Child body: bones found on {body.Root.name} (leg {body.LegLength:0.00} m, neck {(body.Neck != null)}, " +
                                 $"arms {(body.LeftArm != null)}, shoulders {(body.LeftShoulder != null)}).");
            return true;
        }

        [HarmonyPatch(typeof(MonoUpdaters), nameof(MonoUpdaters.LateUpdate))]
        internal static class LatePatch
        {
            private static void Postfix()
            {
                try
                {
                    if (Bodies.Count > 0)
                    {
                        LateTick();
                    }
                }
                catch (Exception ex)
                {
                    VillheimPlugin.Debug($"Child body: {ex.Message}");
                }
            }
        }

        // ---------------------------------------------------------------- the tuning rig

        /// <summary>'vh kids rig [clear]': four still models to tune the child settings against.</summary>
        public static string Command(string[] args)
        {
            ClearRig();
            if (args.Length > 0 && args[0].Equals("clear", StringComparison.OrdinalIgnoreCase))
            {
                return "Villheim: tuning models taken away.";
            }

            Player player = Player.m_localPlayer;
            if (player == null || VillagerPrefab.Prefab == null)
            {
                return "Villheim: no player or no villager prefab.";
            }

            Vector3 forward = player.transform.forward.Horizontal().normalized;
            Vector3 right = Vector3.Cross(Vector3.up, forward);
            Vector3 center = player.transform.position + forward * 4f;
            Quaternion facing = Quaternion.LookRotation(-forward);
            (bool Female, bool Child, float Offset)[] row = { (false, false, -2.25f), (false, true, -0.75f), (true, true, 0.75f), (true, false, 2.25f) };
            foreach ((bool female, bool child, float offset) in row)
            {
                Vector3 at = center + right * offset;
                if (ZoneSystem.instance != null && ZoneSystem.instance.GetGroundHeight(at, out float y))
                {
                    at.y = y;
                }

                GameObject model = Model(at, facing, female, child);
                if (model != null)
                {
                    Rig.Add(model);
                    if (child)
                    {
                        Bodies.Add(new Body { Root = model, Female = female, FixedAge = 0f });
                    }
                }
            }

            return $"Villheim: {Rig.Count} tuning models in front of you: grown man, boy, girl, grown woman. Change the ChildBoy and " +
                   "ChildGirl settings in '3c - Villager looks' (F1) and the children change at once. 'vh kids rig clear' takes them away.";
        }

        /// <summary>A still copy of the villager body, dressed plainly, with no network object, AI or physics.</summary>
        private static GameObject Model(Vector3 at, Quaternion facing, bool female, bool child)
        {
            GameObject model;
            ZNetView.m_forceDisableInit = true;
            try
            {
                model = Object.Instantiate(VillagerPrefab.Prefab, at, facing);
            }
            finally
            {
                ZNetView.m_forceDisableInit = false;
            }

            model.name = "villheim_kids_rig";
            foreach (MonoBehaviour component in model.GetComponents<MonoBehaviour>())
            {
                if (component is Character || component is BaseAI || component is NpcTalk || component is ZSyncTransform || component is ZSyncAnimation)
                {
                    component.enabled = false;
                }
            }

            Rigidbody body = model.GetComponent<Rigidbody>();
            if (body != null)
            {
                body.isKinematic = true;
                body.useGravity = false;
            }

            foreach (Collider collider in model.GetComponentsInChildren<Collider>(true))
            {
                collider.enabled = false;
            }

            // The rest pose: the animator is stopped before it ever poses the body.
            foreach (Animator animator in model.GetComponentsInChildren<Animator>(true))
            {
                animator.enabled = false;
            }

            VisEquipment vis = model.GetComponent<VisEquipment>();
            if (vis != null)
            {
                vis.SetModel(female ? 1 : 0);
                vis.SetSkinColor(new Vector3(0.9f, 0.8f, 0.7f));
                vis.SetHairColor(new Vector3(0.5f, 0.35f, 0.2f));
                vis.SetHairItem((female ? "Hair12" : "Hair3").GetStableHashCode());
                bool beard = !female && !(child && (LogicConfig.ChildNoBeard == null || LogicConfig.ChildNoBeard.Value));
                vis.SetBeardItem(beard ? "Beard5".GetStableHashCode() : 0);
                vis.SetChestItem("ArmorRagsChest".GetStableHashCode());
                vis.SetLegItem("ArmorRagsLegs".GetStableHashCode());
            }

            return model;
        }

        private static void ClearRig()
        {
            foreach (GameObject model in Rig)
            {
                if (model != null)
                {
                    Object.Destroy(model);
                }
            }

            Rig.Clear();
            Bodies.RemoveAll(b => b.Villager == null);
        }

        /// <summary>Logic unload: the tuning models go (they belong to this build).</summary>
        public static void Unload() => ClearRig();
    }
}
