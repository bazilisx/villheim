using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using HarmonyLib;
using UnityEngine;
using Villheim.Logic.Designs;
using Villheim.Logic.Village;
using Villheim.Prefabs;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// What age changes about a villager's day (T-29).
    ///
    /// - Elders move slower (ElderSpeed of a grown villager's walk and run) and keep to chores inside the village:
    ///   cooking, sorting, the farm, the hearth, mending if they are the builder. They leave hunting, foraging and
    ///   planting out past the edge to the young.
    /// - Elders stoop a little (T-118): after the animator has posed them each frame, the spine and the neck are
    ///   bent forward by ElderSpineBend and ElderNeckBend degrees, the same bone method the children's shape uses.
    /// - Children take no jobs at all and play instead (ChildPlay); the same check keeps them out of work outside.
    /// - 'vh villager add child|elder [n]' adds villagers of that age to the nearest village, for testing.
    /// </summary>
    internal static class Ages
    {
        private sealed class State
        {
            public float Next;
            public float Factor = -1f;
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();

        /// <summary>True for a villager who does no work out past the village (elders and children).</summary>
        public static bool OutOfVillageWork(Villager villager) => Childhood.IsChild(villager) || Elders.IsElder(villager);

        /// <summary>Every few seconds: an elder's pace.</summary>
        public static void Update(Villager villager)
        {
            State state = States.GetOrCreateValue(villager);
            if (Time.time < state.Next)
            {
                return;
            }

            state.Next = Time.time + 5f + UnityEngine.Random.Range(0f, 1f);
            if (Elders.IsElder(villager) && !Stooped.Contains(villager))
            {
                Stooped.Add(villager);
            }

            float factor = Elders.IsElder(villager) ? Mathf.Clamp(LogicConfig.ElderSpeed?.Value ?? 0.75f, 0.3f, 1.5f) : 1f;
            if (Mathf.Approximately(factor, state.Factor))
            {
                return;
            }

            Villager template = VillagerPrefab.Prefab != null ? VillagerPrefab.Prefab.GetComponent<Villager>() : null;
            if (template == null)
            {
                return;
            }

            state.Factor = factor;
            villager.m_walkSpeed = template.m_walkSpeed * factor;
            villager.m_speed = template.m_speed * factor;
            villager.m_runSpeed = template.m_runSpeed * factor;
        }
    
        // ---------------------------------------------------------------- the stoop

        private static readonly List<Villager> Stooped = new List<Villager>();
        private static readonly ConditionalWeakTable<Villager, Bones> BoneCache = new ConditionalWeakTable<Villager, Bones>();

        private sealed class Bones
        {
            public Transform Spine;
            public Transform Neck;

            // The pose the animator last gave each bone, and what the stoop made of it. A frame in which the animator
            // did not pose the bone again (it runs with the physics steps, fewer than the frames at a low timescale)
            // still holds the bent pose: bending that again had stacked the bend frame on frame until the animator
            // reset it, a rapid nodding (Tyler: the elder headbanged, even at 0.5 timescale).
            public Quaternion SpineBase, SpineSet, NeckBase, NeckSet;
            public bool Started;

            /// <summary>How far into the stoop he is (0 to 1): eased in and out, so sitting down or a changed slider is smooth.</summary>
            public float Amount;
        }

        private static Bones BonesOf(Villager villager)
        {
            if (BoneCache.TryGetValue(villager, out Bones bones))
            {
                return bones;
            }

            GameObject visual = villager.m_visual != null ? villager.m_visual : villager.gameObject;
            Transform[] all = visual.GetComponentsInChildren<Transform>(true);
            bones = new Bones
            {
                Spine = all.FirstOrDefault(t => t.name == "Spine1") ?? all.FirstOrDefault(t => t.name == "Spine"),
                Neck = all.FirstOrDefault(t => t.name == "Neck"),
            };
            BoneCache.Add(villager, bones);
            return bones;
        }

        /// <summary>
        /// The bone's pose this frame from the animator: its own rotation when the animator set it again, else the pose
        /// it gave last time. Then bent forward by <paramref name="degrees"/> round the villager's right, as a fixed
        /// offset from that pose, never from last frame's bent one.
        /// </summary>
        private static void Bend(Transform bone, ref Quaternion basePose, ref Quaternion set, bool started, float degrees, Vector3 axis)
        {
            Quaternion now = bone.localRotation;
            if (!started || Quaternion.Angle(now, set) > 0.01f)
            {
                basePose = now; // posed again by the animator
            }

            Quaternion parent = bone.parent != null ? bone.parent.rotation : Quaternion.identity;
            Quaternion world = Quaternion.AngleAxis(degrees, axis) * (parent * basePose);
            bone.rotation = world;
            set = bone.localRotation;
        }

        private static void LateTick()
        {
            float spine = LogicConfig.ElderSpineBend?.Value ?? 12f;
            float neck = LogicConfig.ElderNeckBend?.Value ?? 10f;
            for (int i = Stooped.Count - 1; i >= 0; i--)
            {
                Villager villager = Stooped[i];
                if (villager == null || villager.IsDead() || !Elders.IsElder(villager))
                {
                    Stooped.RemoveAt(i);
                    continue;
                }

                // Lying in bed or seated, the pose itself is left alone (eased out).
                Bones bones = BonesOf(villager);
                bool upright = !Sleep.IsAsleep(villager) && !Poses.IsPosed(villager);
                bones.Amount = Mathf.MoveTowards(bones.Amount, upright ? 1f : 0f, Time.deltaTime * 2f);
                if (bones.Amount <= 0f)
                {
                    bones.Started = false;
                    continue;
                }

                Vector3 axis = villager.transform.right;
                if (bones.Spine != null)
                {
                    Bend(bones.Spine, ref bones.SpineBase, ref bones.SpineSet, bones.Started, spine * bones.Amount, axis);
                }

                if (bones.Neck != null)
                {
                    Bend(bones.Neck, ref bones.NeckBase, ref bones.NeckSet, bones.Started, neck * bones.Amount, axis);
                }

                bones.Started = true;
            }
        }

        [HarmonyPatch(typeof(MonoUpdaters), nameof(MonoUpdaters.LateUpdate))]
        internal static class StoopPatch
        {
            private static void Postfix()
            {
                if (Stooped.Count == 0)
                {
                    return;
                }

                try
                {
                    LateTick();
                }
                catch (Exception ex)
                {
                    VillheimPlugin.Debug($"Elder stoop: {ex.Message}");
                    Stooped.Clear();
                }
            }
        }

        // ---------------------------------------------------------------- 'vh villager add'

        /// <summary>'vh villager add child|elder [n]': n new villagers of that age in the nearest village (up to 10).</summary>
        public static string AddCommand(string[] args)
        {
            string kind = args.Length > 1 ? args[1].ToLowerInvariant() : "";
            int count = args.Length > 2 && int.TryParse(args[2], out int n) ? Mathf.Clamp(n, 1, 10) : 1;
            if (kind != "child" && kind != "elder")
            {
                return "Villheim: vh villager add child|elder [n]";
            }

            Player player = Player.m_localPlayer;
            VillageHearth hearth = player != null ? VillageHearth.Closest(player.transform.position, 200f) : null;
            if (hearth == null || !hearth.IsValid)
            {
                return "Villheim: no village within 200 m.";
            }

            var state = new VillageState(hearth.Zdo);
            Plot home = state.Plots.FirstOrDefault(p => Growth.RoleOf(p) == Role.House) ??
                        state.Plots.FirstOrDefault(p => p.Role != "Farm") ?? new Plot { Position = hearth.transform.position, Radius = 6f };
            int elderDays = LogicConfig.ElderDays != null ? LogicConfig.ElderDays.Value : 40;
            var names = new List<string>();
            for (int i = 0; i < count; i++)
            {
                // A child is born in a home; an elder is a newcomer who has been here ElderDays already.
                Villager villager = VillageBrain.SpawnVillager(hearth, state, kind == "child" ? home : null, true);
                if (villager == null)
                {
                    continue;
                }

                if (kind == "elder")
                {
                    Elders.SetDaysHere(villager, elderDays);
                }

                names.Add(villager.VillagerName);
            }

            return names.Count == 0
                ? "Villheim: nobody could be added."
                : $"Villheim: {string.Join(", ", names)} {(names.Count == 1 ? "is" : "are")} now {(kind == "child" ? "a child" : "an elder")}" +
                  $"{(names.Count == 1 ? "" : "s")} of {state.Name}.";
        }
}
}
