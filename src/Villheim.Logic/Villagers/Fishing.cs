using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using UnityEngine;
using Villheim.Logic.Village;
using Random = UnityEngine.Random;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Fishing, the fisher's trade (D-075), first version. By day, while the village chests hold fewer than
    /// FishTarget fish, the fisher walks to the village's shore spot (open ground at the water's edge within the
    /// village's working reach), takes out a fishing rod (the vanilla item) and stands at the water facing out. Every
    /// half minute or so a fish may bite. With four fish, or after about four minutes, he carries the catch to the
    /// village chest: the fish of that water by biome (FishAt, D-078).
    ///
    /// Not yet: the cast and reel animations (the rod is only held), a float in the water, fishing from a dock or a
    /// boat, and bait. A village with no shore in reach has no fisher (Roles).
    /// </summary>
    internal static class Fishing
    {
        private const float SearchFromHearth = 45f;
        private const int FishTarget = 10;
        private const int PerTrip = 4;
        private const float TripSeconds = 240f;
        private const string Rod = "FishingRod";
        private const string Fish = "Fish1";

        /// <summary>
        /// The vanilla fish of the water at a shore spot (D-078): perch in the Meadows, pike in the Black Forest,
        /// trollfish in the Swamp, grouper on the Plains, anglerfish in the Mistlands, northern salmon in the Deep
        /// North, magmafish in the Ashlands; at the sea (deep water off the spot) tuna, or coral cod off the warmer
        /// shores. The Mountains have no fishing water of their own: pike.
        /// </summary>
        private static string FishAt(Vector3 spot)
        {
            Heightmap.Biome biome = WorldGenerator.instance != null ? WorldGenerator.instance.GetBiome(spot) : Heightmap.Biome.Meadows;
            float water = ZoneSystem.instance != null ? ZoneSystem.instance.m_waterLevel : 30f;
            bool sea = biome == Heightmap.Biome.Ocean;
            if (!sea && ZoneSystem.instance != null)
            {
                // Deep water a little way out: the sea, not a pond.
                int deep = 0;
                for (int i = 0; i < 8; i++)
                {
                    Vector3 probe = spot + Quaternion.Euler(0f, i * 45f, 0f) * Vector3.forward * 12f;
                    if (ZoneSystem.instance.GetGroundHeight(probe, out float h) && h < water - 6f)
                    {
                        deep++;
                    }
                }

                sea = deep >= 2;
            }

            if (sea)
            {
                return biome == Heightmap.Biome.Plains || biome == Heightmap.Biome.Mistlands ? "Fish8" : "Fish3";
            }

            switch (biome)
            {
                case Heightmap.Biome.BlackForest: return "Fish2";
                case Heightmap.Biome.Swamp: return "Fish5";
                case Heightmap.Biome.Mountain: return "Fish2";
                case Heightmap.Biome.Plains: return "Fish7";
                case Heightmap.Biome.Mistlands: return "Fish9";
                case Heightmap.Biome.DeepNorth: return "Fish10";
                case Heightmap.Biome.AshLands: return "Fish11";
                default: return Fish;
            }
        }

        private sealed class Shore
        {
            public float Time;
            public Vector3? Spot;
            public Vector3 Water;
        }

        private sealed class State
        {
            public bool Active;
            public bool Delivering;
            public bool Arrived;
            public int Caught;
            public float Until;
            public float GiveUpAt;
            public float NextBite;
            public float NextLook;
            public float LastRun;
        }

        private static readonly Dictionary<int, Shore> Shores = new Dictionary<int, Shore>();
        private static readonly ConditionalWeakTable<Villager, State> States = new ConditionalWeakTable<Villager, State>();

        private static void Log(string message)
        {
            if (LogicConfig.IsOn(LogicConfig.DebugLog))
            {
                VillheimPlugin.Log.LogInfo("[fishing] " + message);
            }
        }

        public static string Describe(Villager villager)
        {
            if (!States.TryGetValue(villager, out State state) || !state.Active || Time.time - state.LastRun > 1f)
            {
                return null;
            }

            return state.Delivering ? "carrying fish to the chest" : state.Arrived ? "fishing" : "going fishing";
        }

        /// <summary>
        /// The village's spot at the water's edge: dry ground no more than 2 m above the water with water at least
        /// half a meter deep 3 m further out. Looked for every ten minutes; null when there is none in reach.
        /// </summary>
        public static Vector3? ShoreOf(VillageHearth hearth)
        {
            int id = hearth.VillageId;
            if (Shores.TryGetValue(id, out Shore cached) && Time.time - cached.Time < 600f)
            {
                return cached.Spot;
            }

            var shore = new Shore { Time = Time.time };
            Shores[id] = shore;
            if (ZoneSystem.instance == null)
            {
                return null;
            }

            float water = ZoneSystem.instance.m_waterLevel;
            Vector3 center = hearth.transform.position;
            float reach = Knowledge.WorkRadius(id, SearchFromHearth);
            float best = float.MaxValue;
            for (float distance = 8f; distance <= reach; distance += 3f)
            {
                for (int step = 0; step < 36; step++)
                {
                    Vector3 outward = Quaternion.Euler(0f, step * 10f, 0f) * Vector3.forward;
                    Vector3 at = center + outward * distance;
                    if (!ZoneSystem.instance.GetGroundHeight(at, out float ground) || ground < water + 0.2f || ground > water + 2f)
                    {
                        continue;
                    }

                    // The water side may be any way round, not only away from the hearth.
                    for (int side = 0; side < 8; side++)
                    {
                        Vector3 way = Quaternion.Euler(0f, side * 45f, 0f) * Vector3.forward;
                        if (!ZoneSystem.instance.GetGroundHeight(at + way * 3f, out float deep) || deep > water - 0.5f)
                        {
                            continue;
                        }

                        if (distance < best)
                        {
                            best = distance;
                            at.y = ground;
                            shore.Spot = at;
                            shore.Water = at + way * 6f;
                            shore.Water.y = water;
                        }

                        break;
                    }
                }

                if (shore.Spot.HasValue)
                {
                    break;
                }
            }

            Log(shore.Spot.HasValue
                ? $"{hearth.VillageName} fishes at {shore.Spot.Value.ToString("F0")}, {best:0} m from the hearth."
                : $"{hearth.VillageName} has no shore within {reach:0} m.");
            return shore.Spot;
        }

        private static int FishIn(VillageHearth hearth) =>
            Healing.Chests(hearth).Sum(c => c.GetInventory().GetAllItems()
                .Where(i => i.m_dropPrefab != null && i.m_dropPrefab.name.StartsWith("Fish") && !i.m_dropPrefab.name.StartsWith("Fishing"))
                .Sum(i => i.m_stack));

        /// <summary>True while the fisher is out fishing or carrying the catch home.</summary>
        public static bool Update(Villager villager, VillagerAI ai, float dt)
        {
            State state = States.GetOrCreateValue(villager);
            if (!state.Active && Roles.TradeOf(villager) != Roles.Trade.Fisher)
            {
                return false;
            }

            if (state.Active && Time.time - state.LastRun > 5f)
            {
                // Something else ran him for a while: the trip is off, the catch so far kept for the next one.
                state.Active = false;
            }

            state.LastRun = Time.time;
            VillageHearth hearth = VillageHearth.Find(villager.VillageId);
            if (hearth == null || !hearth.IsValid)
            {
                state.Active = false;
                return false;
            }

            if (!state.Active && !Begin(villager, hearth, state))
            {
                return false;
            }

            if (EnvMan.IsNight() && !state.Delivering)
            {
                state.Delivering = state.Caught > 0;
                state.Active = state.Delivering;
                if (!state.Active)
                {
                    return false;
                }
            }

            return state.Delivering ? Deliver(villager, ai, dt, hearth, state) : AtWater(villager, ai, dt, hearth, state);
        }

        private static bool Begin(Villager villager, VillageHearth hearth, State state)
        {
            if (Roles.TradeOf(villager) != Roles.Trade.Fisher || EnvMan.IsNight() || Time.time < state.NextLook ||
                Elders.IsElder(villager))
            {
                return false;
            }

            state.NextLook = Time.time + Random.Range(20f, 40f);
            if (FishIn(hearth) >= FishTarget * Village.Calendar.FoodFactor() || !ShoreOf(hearth).HasValue)
            {
                return false;
            }

            state.Active = true;
            state.Delivering = false;
            state.Arrived = false;
            state.Until = Time.time + TripSeconds;
            state.GiveUpAt = Time.time + 90f;
            Walker.For(villager).Reset();
            Log($"{villager.VillagerName} goes fishing ({FishIn(hearth)} fish in the chests).");
            return true;
        }

        private static bool AtWater(Villager villager, VillagerAI ai, float dt, VillageHearth hearth, State state)
        {
            Vector3? spot = ShoreOf(hearth);
            if (!spot.HasValue)
            {
                state.Active = false;
                return false;
            }

            if (!state.Arrived)
            {
                WalkResult step = Walker.For(villager).Go(villager, ai, dt, spot.Value, 1f);
                if (step == WalkResult.Walking && Time.time < state.GiveUpAt)
                {
                    return true;
                }

                if (Utils.DistanceXZ(villager.transform.position, spot.Value) > 4f)
                {
                    Log($"{villager.VillagerName} can't get to the shore ({step}).");
                    state.Active = false;
                    state.NextLook = Time.time + 300f;
                    return false;
                }

                state.Arrived = true;
                state.NextBite = Time.time + Random.Range(20f, 40f);
            }

            ai.StopMoving();
            Roles.Hold(villager, Rod);
            Shores.TryGetValue(hearth.VillageId, out Shore shore);
            if (shore != null)
            {
                ai.LookAt(shore.Water);
            }

            if (Time.time >= state.NextBite)
            {
                state.NextBite = Time.time + Random.Range(20f, 40f);
                if (Random.value < 0.45f)
                {
                    state.Caught++;
                    Poses.Trigger(villager, "interact");
                }
            }

            if (state.Caught >= PerTrip || Time.time > state.Until)
            {
                state.Delivering = state.Caught > 0;
                state.Active = state.Delivering;
                state.GiveUpAt = Time.time + 90f;
                Walker.For(villager).Reset();
                HandItems.PutAway(villager);
                return state.Active;
            }

            return true;
        }

        private static bool Deliver(Villager villager, VillagerAI ai, float dt, VillageHearth hearth, State state)
        {
            Container chest = VillageChest.Find(hearth);
            if (chest == null)
            {
                state.Active = false;
                return false;
            }

            if (Walker.For(villager).Go(villager, ai, dt, chest.transform.position, 1.6f) == WalkResult.Walking && Time.time < state.GiveUpAt)
            {
                return true;
            }

            Poses.Trigger(villager, "interact");
            // The fish of the water he fished (D-078): by the biome at the shore, sea fish at the sea.
            string kind = Shores.TryGetValue(hearth.VillageId, out Shore fished) && fished.Spot.HasValue
                ? FishAt(fished.Spot.Value)
                : Fish;
            GameObject prefab = ObjectDB.instance != null ? ObjectDB.instance.GetItemPrefab(kind) ?? ObjectDB.instance.GetItemPrefab(Fish) : null;
            if (prefab != null && state.Caught > 0)
            {
                chest.GetInventory().AddItem(prefab, state.Caught);
            }

            Log($"{villager.VillagerName} brought back {state.Caught} {kind}.");
            state.Caught = 0;
            state.Active = false;
            state.Delivering = false;
            return false;
        }
    }
}
