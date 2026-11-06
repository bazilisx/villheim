using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Villagers replant what they fell, one sapling for each tree, so the woods around a village grow back and
    /// there is always something to harvest later (Tyler, 2026-11-06).
    ///
    /// - Each felled standing tree adds its sapling to the village's list (kept on the hearth, so it survives a
    ///   restart): beech for beech, oak for oak, birch for birch, pine and fir for their own. Anything else gets the
    ///   biome's usual tree.
    /// - By day, whoever has no work takes the next one out past the village (8 to 25 m beyond the village radius),
    ///   on open ground where that kind of tree grows, and plants it. One planter per village at a time.
    /// - A sapling that can't be planted (no open ground found, or not reached in a minute) stays on the list.
    /// </summary>
    internal static class Replanting
    {
        private static readonly int KeyOwed = "villheim_replant".GetStableHashCode();
        private const int MaxOwed = 60;
        private const float BeyondMin = 8f;
        private const float BeyondMax = 25f;
        private const float Clearance = 3f;

        private enum Phase
        {
            None,
            Walk,
            Plant,
        }

        private sealed class State
        {
            public Phase Phase;
            public string Sapling;
            public Vector3 Spot;
            public float Deadline;
            public float PlantAt;
            public float NextLook;
        }

        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();
        private static readonly Dictionary<int, Villager> Planters = new Dictionary<int, Villager>();
        private static int _blockMask;

        private static int BlockMask => _blockMask != 0
            ? _blockMask
            : _blockMask = LayerMask.GetMask("Default", "static_solid", "Default_small", "piece", "piece_nonsolid", "vehicle");

        public static bool IsPlanting(Villager villager) => States.TryGetValue(villager, out State state) && state.Phase != Phase.None;

        public static string Describe(Villager villager) => IsPlanting(villager) ? "planting a tree" : null;

        /// <summary>A standing tree of this kind was felled: a sapling is owed.</summary>
        public static void Owe(int villageId, string treePrefab)
        {
            VillageHearth hearth = VillageHearth.Find(villageId);
            if (hearth == null || !hearth.IsValid)
            {
                return;
            }

            var state = new VillageState(hearth.Zdo);
            string sapling = SaplingFor(treePrefab, state.Biome);
            List<string> owed = Owed(hearth);
            if (sapling == null || owed.Count >= MaxOwed)
            {
                return;
            }

            owed.Add(sapling);
            Save(hearth, owed);
            VillheimPlugin.Debug($"{state.Name} owes a {sapling} for the {treePrefab} felled ({owed.Count} to plant).");
        }

        public static int OwedCount(VillageHearth hearth) => Owed(hearth).Count;

        /// <summary>True while this villager is out planting.</summary>
        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            State state = States.GetOrCreateValue(villager);
            if (state.Phase == Phase.None && !Begin(villager, state))
            {
                return false;
            }

            if (state.Phase == Phase.Walk)
            {
                WalkResult step = Walker.For(villager).Go(villager, ai, dt, state.Spot, 1.2f, true);
                if (step == WalkResult.Walking && Time.time < state.Deadline)
                {
                    return true;
                }

                if (step != WalkResult.Arrived)
                {
                    VillheimPlugin.Debug($"{villager.VillagerName} could not reach the planting spot.");
                    End(villager, state);
                    return false;
                }

                ai.StopMoving();
                state.Phase = Phase.Plant;
                state.PlantAt = Time.time + 1.5f;
                Poses.Trigger(villager, "interact");
                return true;
            }

            ai.StopMoving();
            ai.LookAt(state.Spot);
            if (Time.time < state.PlantAt)
            {
                return true;
            }

            Plant(villager, state);
            End(villager, state);
            return false;
        }

        private static bool Begin(Villager villager, State state)
        {
            if (EnvMan.IsNight() || Time.time < state.NextLook)
            {
                return false;
            }

            state.NextLook = Time.time + Random.Range(15f, 30f);
            if (Planters.TryGetValue(villager.VillageId, out Villager other) && other != null && other != villager && !other.IsDead() &&
                IsPlanting(other))
            {
                return false;
            }

            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid)
            {
                return false;
            }

            List<string> owed = Owed(hearth);
            if (owed.Count == 0)
            {
                return false;
            }

            string sapling = owed[0];
            if (!FindSpot(hearth, sapling, villager.transform.position, out Vector3 spot))
            {
                VillheimPlugin.Debug($"{hearth.VillageName}: no open ground found to plant a {sapling}.");
                state.NextLook = Time.time + 120f;
                return false;
            }

            Planters[villager.VillageId] = villager;
            state.Sapling = sapling;
            state.Spot = spot;
            state.Phase = Phase.Walk;
            state.Deadline = Time.time + 60f;
            Walker.For(villager).Reset();
            VillheimPlugin.Debug($"{villager.VillagerName} goes to plant a {sapling}.");
            return true;
        }

        private static void Plant(Villager villager, State state)
        {
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            GameObject prefab = ZNetScene.instance ? ZNetScene.instance.GetPrefab(state.Sapling) : null;
            if (hearth == null || !hearth.IsValid || prefab == null || !Open(state.Spot))
            {
                return;
            }

            Vector3 at = state.Spot;
            if (ZoneSystem.instance.GetGroundHeight(at, out float y))
            {
                at.y = y;
            }

            GameObject planted = Object.Instantiate(prefab, at, Quaternion.Euler(0f, Random.Range(0f, 360f), 0f));
            planted.GetComponent<Piece>()?.m_placeEffect?.Create(at, Quaternion.identity, planted.transform);
            List<string> owed = Owed(hearth);
            owed.Remove(state.Sapling);
            Save(hearth, owed);
            VillheimPlugin.Debug($"{villager.VillagerName} planted a {state.Sapling} ({owed.Count} still to plant).");
        }

        private static void End(Villager villager, State state)
        {
            state.Phase = Phase.None;
            if (Planters.TryGetValue(villager.VillageId, out Villager planter) && planter == villager)
            {
                Planters.Remove(villager.VillageId);
            }
        }

        /// <summary>Open ground out past the village where this sapling grows, nearest the villager first.</summary>
        private static bool FindSpot(VillageHearth hearth, string sapling, Vector3 near, out Vector3 spot)
        {
            spot = Vector3.zero;
            GameObject prefab = ZNetScene.instance ? ZNetScene.instance.GetPrefab(sapling) : null;
            Plant plant = prefab != null ? prefab.GetComponent<Plant>() : null;
            Vector3 center = hearth.transform.position;
            float radius = VillheimConfig.VillageRadius.Value;
            var candidates = new List<Vector3>();
            Plant[] plants = Object.FindObjectsOfType<Plant>();
            for (int i = 0; i < 24; i++)
            {
                float angle = Random.Range(0f, Mathf.PI * 2f);
                float distance = radius + Random.Range(BeyondMin, BeyondMax);
                Vector3 p = center + new Vector3(Mathf.Sin(angle), 0f, Mathf.Cos(angle)) * distance;
                if (!ZoneSystem.instance.IsZoneLoaded(p) || !ZoneSystem.instance.GetGroundHeight(p, out float y) ||
                    y < ZoneSystem.instance.m_waterLevel + 0.5f)
                {
                    continue;
                }

                p.y = y;
                if (plant != null && (plant.m_biome & WorldGenerator.instance.GetBiome(p)) == 0)
                {
                    continue;
                }

                if (!Open(p, plants) || NearOtherVillage(p, hearth.VillageId))
                {
                    continue;
                }

                candidates.Add(p);
            }

            if (candidates.Count == 0)
            {
                return false;
            }

            spot = candidates.OrderBy(c => Utils.DistanceXZ(c, near)).First();
            return true;
        }

        /// <summary>Nothing standing within a few metres: no tree, rock, building or other sapling.</summary>
        private static bool Open(Vector3 p) => Open(p, Object.FindObjectsOfType<Plant>());

        private static bool Open(Vector3 p, Plant[] plants)
        {
            foreach (Collider collider in Physics.OverlapSphere(p + Vector3.up * 0.5f, Clearance, BlockMask))
            {
                if (collider != null && !collider.isTrigger)
                {
                    return false;
                }
            }

            foreach (Plant other in plants)
            {
                if (other != null && Utils.DistanceXZ(other.transform.position, p) < Clearance)
                {
                    return false;
                }
            }

            return true;
        }

        private static bool NearOtherVillage(Vector3 p, int villageId)
        {
            foreach (VillageHearth other in VillageHearth.All)
            {
                if (other != null && other.IsValid && other.VillageId != villageId &&
                    Utils.DistanceXZ(other.transform.position, p) < VillheimConfig.VillageRadius.Value + 5f)
                {
                    return true;
                }
            }

            return false;
        }

        /// <summary>The sapling that grows the same tree, or the biome's usual one.</summary>
        private static string SaplingFor(string tree, Heightmap.Biome biome)
        {
            string name = tree ?? "";
            if (name.StartsWith("Beech")) return "Beech_Sapling";
            if (name.StartsWith("Birch")) return "Birch_Sapling";
            if (name.StartsWith("Oak")) return "Oak_Sapling";
            if (name.StartsWith("Pine")) return "PineTree_Sapling";
            if (name.StartsWith("FirTree") || name.StartsWith("Fir")) return "FirTree_Sapling";
            return biome == Heightmap.Biome.BlackForest ? "FirTree_Sapling" : "Beech_Sapling";
        }

        private static List<string> Owed(VillageHearth hearth)
        {
            string raw = hearth.Zdo.GetString(KeyOwed, "");
            return raw.Length == 0 ? new List<string>() : raw.Split(',').Where(s => s.Length > 0).ToList();
        }

        private static void Save(VillageHearth hearth, List<string> owed)
        {
            hearth.Zdo.Set(KeyOwed, string.Join(",", owed));
        }
    }
}
