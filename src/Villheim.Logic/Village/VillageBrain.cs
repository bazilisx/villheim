using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Villheim.Logic.Designs;
using Villheim.Prefabs;
using Random = UnityEngine.Random;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Village rules: founding, growth and population. Runs on the client that owns the hearth (the nearest player).
    /// Missed time is caught up one building per tick when someone returns.
    /// </summary>
    internal static class VillageBrain
    {
        private const int MaxPlotAttempts = 6;

        public static void Tick(VillageHearth hearth)
        {
            if (!hearth.NView.IsOwner() || hearth.Busy || ZNet.instance == null || ZoneSystem.instance == null ||
                EnvMan.instance == null)
            {
                return;
            }

            var state = new VillageState(hearth.Zdo);
            if (!state.Initialized)
            {
                Initialize(hearth, state);
            }

            double now = ZNet.instance.GetTimeSeconds();
            if (!TryGrow(hearth, state, now))
            {
                TryPopulate(hearth, state, now);
            }
        }

        public static void Initialize(VillageHearth hearth, VillageState state)
        {
            int id = Random.Range(1, int.MaxValue);
            Vector3 position = hearth.transform.position;
            int seed = unchecked(id ^ ((int)position.x * 73856093) ^ ((int)position.z * 19349663));
            double now = ZNet.instance.GetTimeSeconds();

            state.Id = id;
            state.Seed = seed;
            state.Name = Names.Village(new System.Random(seed));
            state.Biome = WorldGenerator.instance.GetBiome(position);
            state.LastGrowth = now - GrowthInterval() * VillheimConfig.StartingBuildings.Value;
            state.LastArrival = now;
            state.Initialized = true;

            TerrainShaper.LevelPad(position, 3f, 6f);
            hearth.Register();
            VillheimPlugin.Log.LogInfo($"Founded {state.Name} ({state.Biome}) at {position}.");
        }

        public static double DayLength()
        {
            double length = EnvMan.instance ? EnvMan.instance.m_dayLengthSec : 0;
            return length > 0 ? length : 1800.0;
        }

        public static double GrowthInterval() => VillheimConfig.DaysPerBuilding.Value * DayLength();
        public static double ArrivalInterval() => VillheimConfig.DaysPerNewVillager.Value * DayLength();

        private static bool TryGrow(VillageHearth hearth, VillageState state, double now)
        {
            IReadOnlyList<Plot> plots = state.Plots;
            double interval = GrowthInterval();
            if (plots.Count >= VillheimConfig.MaxBuildings.Value || now - state.LastGrowth < interval)
            {
                return false;
            }

            List<DesignLibrary.Design> pool = DesignLibrary.PoolFor(state.Biome);
            var rng = new System.Random(state.Seed + plots.Count * 7919 + hearth.PlotAttempts * 104729);
            DesignLibrary.Design? picked = DesignLibrary.Pick(pool, rng);
            if (picked == null)
            {
                VillheimPlugin.Log.LogWarning($"{state.Name} has no valid designs to build. Check the Designs config.");
                state.LastGrowth = now;
                return false;
            }

            DesignLibrary.Design design = picked.Value;
            float radius = design.Radius;
            if (!PlotFinder.TryFind(hearth.transform.position, radius, DesignLibrary.MaxTerrainDelta(design.Location), plots,
                    rng, out Vector3 position))
            {
                hearth.PlotAttempts++;
                VillheimPlugin.Debug($"{state.Name}: no room for {design.Name} (attempt {hearth.PlotAttempts}).");
                if (hearth.PlotAttempts >= MaxPlotAttempts)
                {
                    // Nowhere to build right now. Wait for the next growth period instead of retrying constantly.
                    hearth.PlotAttempts = 0;
                    state.LastGrowth += interval;
                }

                return false;
            }

            hearth.PlotAttempts = 0;
            float yaw = rng.Next(16) * 22.5f;
            int buildSeed = rng.Next(1, int.MaxValue);
            hearth.StartCoroutine(BuildRoutine(hearth, design, position, yaw, radius, buildSeed, interval));
            return true;
        }

        private static IEnumerator BuildRoutine(VillageHearth hearth, DesignLibrary.Design design, Vector3 position, float yaw,
            float radius, int seed, double interval)
        {
            hearth.Busy = true;
            var result = new DesignSpawner.Result();
            try
            {
                yield return DesignSpawner.Build(design.Location, position, yaw, seed, hearth.VillageId, result);

                if (!hearth || !hearth.IsValid)
                {
                    yield break;
                }

                var state = new VillageState(hearth.Zdo);

                // Advance the clock by one period rather than to "now", so a village that was left alone for a
                // long time catches up one building per tick.
                state.LastGrowth += interval;

                if (result.Success)
                {
                    state.AddPlot(new Plot { Design = design.Name, Position = position, Yaw = yaw, Radius = radius });
                    VillheimPlugin.Log.LogInfo($"{state.Name} built {design.Name} at {position} " +
                                               $"({result.Spawned} objects, {result.Skipped} left out).");
                    Announce(hearth, $"{state.Name} has raised a new building.");
                }
                else
                {
                    VillheimPlugin.Log.LogWarning($"{state.Name} could not build {design.Name}: {result.Error}");
                }
            }
            finally
            {
                if (hearth)
                {
                    hearth.Busy = false;
                }
            }
        }

        private static void TryPopulate(VillageHearth hearth, VillageState state, double now)
        {
            if (VillagerPrefab.Prefab == null)
            {
                return;
            }

            int capacity = Math.Max(VillheimConfig.StartingVillagers.Value,
                state.Plots.Count * VillheimConfig.VillagersPerBuilding.Value);
            int target = Math.Min(capacity, VillheimConfig.MaxVillagers.Value);
            if (CountVillagers(state.Id) >= target)
            {
                return;
            }

            bool firstArrivals = state.Arrivals < VillheimConfig.StartingVillagers.Value;
            if (!firstArrivals && now - state.LastArrival < ArrivalInterval())
            {
                return;
            }

            SpawnVillager(hearth, state);
            state.LastArrival = now;
        }

        public static int CountVillagers(int villageId)
        {
            int count = 0;
            foreach (Character character in Character.GetAllCharacters())
            {
                if (character is Villager villager && !villager.IsDead() && villager.VillageId == villageId)
                {
                    count++;
                }
            }

            return count;
        }

        private static void SpawnVillager(VillageHearth hearth, VillageState state)
        {
            int arrival = state.Arrivals;
            var rng = new System.Random(unchecked(state.Seed * 31 + arrival * 6151));

            IReadOnlyList<Plot> plots = state.Plots;
            Vector3 center = hearth.transform.position;
            Vector3 home = plots.Count > 0 ? plots[rng.Next(plots.Count)].Position : center;

            float angle = (float)rng.NextDouble() * Mathf.PI * 2f;
            float distance = 3f + (float)rng.NextDouble() * 3f;
            Vector3 spawn = center + new Vector3(Mathf.Sin(angle), 0f, Mathf.Cos(angle)) * distance;
            if (ZoneSystem.instance.GetGroundHeight(spawn, out float y))
            {
                spawn.y = y + 0.2f;
            }

            GameObject go = UnityEngine.Object.Instantiate(VillagerPrefab.Prefab, spawn,
                Quaternion.Euler(0f, angle * Mathf.Rad2Deg, 0f));
            Villager villager = go.GetComponent<Villager>();
            int looksSeed = rng.Next(1, int.MaxValue);
            string name = Names.Villager(looksSeed);

            ZDO zdo = villager.Zdo;
            zdo.Set(Keys.VillagerVillage, state.Id);
            zdo.Set(Keys.VillagerVillageName, state.Name);
            zdo.Set(Keys.VillagerHearth, center);
            zdo.Set(Keys.VillagerHome, home);
            zdo.Set(Keys.VillagerSeed, looksSeed);
            zdo.Set(Keys.VillagerName, name);
            villager.m_name = name;
            villager.LooksApplied = false;

            state.Arrivals = arrival + 1;
            VillheimPlugin.Debug($"{state.Name}: {name} arrived.");
        }

        /// <summary>Makes the next building start on the following tick. Used by the console command.</summary>
        public static void ForceGrow(VillageHearth hearth)
        {
            if (!hearth.IsValid)
            {
                return;
            }

            if (!hearth.NView.IsOwner())
            {
                hearth.NView.ClaimOwnership();
            }

            var state = new VillageState(hearth.Zdo);
            if (!state.Initialized)
            {
                Initialize(hearth, state);
            }

            state.LastGrowth = ZNet.instance.GetTimeSeconds() - GrowthInterval();
        }

        public static string Tier(int buildings)
        {
            if (buildings <= 1) return "Camp";
            if (buildings <= 3) return "Hamlet";
            if (buildings <= 6) return "Village";
            return "Town";
        }

        public static string Summary(VillageHearth hearth)
        {
            if (!hearth.IsValid)
            {
                return "";
            }

            var state = new VillageState(hearth.Zdo);
            if (!state.Initialized)
            {
                return "A newly lit hearth. Settlers will arrive soon.";
            }

            int buildings = state.Plots.Count;
            string text = $"{state.Name} ({Tier(buildings)}): {buildings} buildings, {CountVillagers(state.Id)} villagers.";
            if (buildings >= VillheimConfig.MaxBuildings.Value)
            {
                return text + " Fully grown.";
            }

            double remaining = state.LastGrowth + GrowthInterval() - ZNet.instance.GetTimeSeconds();
            double days = Math.Max(0.0, remaining / DayLength());
            return text + $" Next building in about {days:0.0} days.";
        }

        private static void Announce(VillageHearth hearth, string message)
        {
            Player player = Player.m_localPlayer;
            if (player != null && MessageHud.instance != null &&
                Vector3.Distance(player.transform.position, hearth.transform.position) < VillheimConfig.VillageRadius.Value + 40f)
            {
                MessageHud.instance.ShowMessage(MessageHud.MessageType.TopLeft, message);
            }
        }
    }
}
