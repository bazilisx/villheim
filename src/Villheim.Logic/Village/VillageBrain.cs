using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Designs;
using Villheim.Prefabs;
using Random = UnityEngine.Random;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Village rules: founding, growth, wood and population. Runs on the client that owns the hearth (the nearest
    /// player). Growth needs both time (DaysPerBuilding) and wood in the village stock; villagers bring wood by
    /// felling trees, and earn a passive share while nobody is around.
    /// </summary>
    internal static class VillageBrain
    {
        private const int MaxPlotAttempts = 6;
        private const double UnloadedGapSeconds = 120.0;

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
            AddPassiveWood(state, now);

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
            state.Axis = Mathf.Round(hearth.transform.eulerAngles.y / 15f) * 15f;
            state.LastGrowth = now - GrowthInterval() * VillheimConfig.StartingBuildings.Value;
            state.LastArrival = now;
            state.LastSeen = now;
            state.Wood = StartingWood();
            state.Initialized = true;

            TerrainShaper.LevelPad(position, 3f, 6f);
            hearth.Register();
            VillheimPlugin.Log.LogInfo($"Founded {state.Name} ({state.Biome}) at {position}.");
        }

        /// <summary>Enough wood for the starting buildings, so a new village is not empty while its first trees fall.</summary>
        private static int StartingWood()
        {
            return VillheimConfig.StartingBuildings.Value * VillheimConfig.MaxWoodPerBuilding.Value;
        }

        public static double DayLength()
        {
            double length = EnvMan.instance ? EnvMan.instance.m_dayLengthSec : 0;
            return length > 0 ? length : 1800.0;
        }

        public static double GrowthInterval() => VillheimConfig.DaysPerBuilding.Value * DayLength();
        public static double ArrivalInterval() => VillheimConfig.DaysPerNewVillager.Value * DayLength();

        /// <summary>Gear and look tier from the village size: 0 camp, 1 hamlet, 2 village, 3 town.</summary>
        public static int TierIndex(int buildings)
        {
            if (buildings <= 1) return 0;
            if (buildings <= 3) return 1;
            if (buildings <= 6) return 2;
            return 3;
        }

        public static string Tier(int buildings) => new[] { "Camp", "Hamlet", "Village", "Town" }[TierIndex(buildings)];

        private static void AddPassiveWood(VillageState state, double now)
        {
            double last = state.LastSeen;
            state.LastSeen = now;
            if (last <= 0 || now - last < UnloadedGapSeconds)
            {
                return;
            }

            int villagers = Math.Min(state.Arrivals, Capacity(state));
            double days = (now - last) / DayLength();
            int earned = (int)(villagers * VillheimConfig.PassiveWoodPerVillagerPerDay.Value * days);
            if (earned > 0)
            {
                state.Wood += earned;
                VillheimPlugin.Debug($"{state.Name} gathered {earned} wood while unloaded ({days:0.00} days).");
            }
        }

        public static void AddWood(int villageId, int amount)
        {
            VillageHearth hearth = VillageHearth.Find(villageId);
            if (hearth == null || !hearth.IsValid || amount <= 0)
            {
                return;
            }

            var state = new VillageState(hearth.Zdo);
            state.Wood += amount;
        }

        private static bool TryGrow(VillageHearth hearth, VillageState state, double now)
        {
            IReadOnlyList<Plot> plots = state.Plots;
            double interval = GrowthInterval();
            if (plots.Count >= VillheimConfig.MaxBuildings.Value)
            {
                state.Waiting = "";
                return false;
            }

            if (now - state.LastGrowth < interval)
            {
                return false;
            }

            Role role = Culture.RoleFor(plots.Count);
            List<DesignLibrary.Design> pool = DesignLibrary.PoolFor(state.Biome, role);
            var rng = new System.Random(state.Seed + plots.Count * 7919 + hearth.PlotAttempts * 104729);
            DesignLibrary.Design? picked = DesignLibrary.Pick(pool, rng);
            if (picked == null)
            {
                VillheimPlugin.Log.LogWarning($"{state.Name} has no valid designs to build. Check the Designs config.");
                state.LastGrowth = now;
                return false;
            }

            DesignLibrary.Design design = picked.Value;
            int cost = VillheimConfig.RequireWood.Value ? DesignLibrary.WoodCost(design.Location) : 0;
            if (state.Wood < cost)
            {
                state.Waiting = $"wood for a new {RoleName(role)} ({state.Wood}/{cost})";
                return false;
            }

            float radius = design.Radius;
            if (!PlotFinder.TryFind(hearth.transform.position, state.Axis, role, radius,
                    DesignLibrary.MaxTerrainDelta(design.Location), plots, rng, out Vector3 position, out float yaw))
            {
                hearth.PlotAttempts++;
                VillheimPlugin.Debug($"{state.Name}: no room for {design.Name} (attempt {hearth.PlotAttempts}).");
                if (hearth.PlotAttempts >= MaxPlotAttempts)
                {
                    // Nowhere to build right now. Wait for the next growth period instead of retrying constantly.
                    hearth.PlotAttempts = 0;
                    state.LastGrowth += interval;
                    state.Waiting = "room to build";
                }

                return false;
            }

            hearth.PlotAttempts = 0;
            state.Waiting = "";
            int buildSeed = rng.Next(1, int.MaxValue);
            hearth.StartCoroutine(BuildRoutine(hearth, design, role, position, yaw, radius, buildSeed, interval, cost));
            return true;
        }

        public static string RoleName(Role role)
        {
            switch (role)
            {
                case Role.Hub: return "longhouse";
                case Role.House: return "home";
                case Role.Workshop: return "workshop";
                case Role.Farm: return "farm";
                default: return "building";
            }
        }

        private static IEnumerator BuildRoutine(VillageHearth hearth, DesignLibrary.Design design, Role role, Vector3 position,
            float yaw, float radius, int seed, double interval, int cost)
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
                    state.Wood -= cost;
                    state.AddPlot(new Plot
                    {
                        Design = design.Name, Position = position, Yaw = yaw, Radius = radius, Role = role.ToString(),
                    });

                    if (VillheimConfig.BuildPaths.Value)
                    {
                        PathBuilder.Build(hearth.transform.position, state.Axis, position, radius);
                    }

                    VillheimPlugin.Log.LogInfo($"{state.Name} built a {RoleName(role)} ({design.Name}) at {position} " +
                                               $"for {cost} wood ({result.Spawned} objects, {result.Skipped} left out).");
                    Announce(hearth, $"{state.Name} has raised a new {RoleName(role)}.");
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

        /// <summary>How many villagers the village can house: the starting settlers plus room in each home.</summary>
        public static int Capacity(VillageState state)
        {
            int homes = state.Plots.Count(p => string.IsNullOrEmpty(p.Role) || p.Role == nameof(Role.House));
            int capacity = VillheimConfig.StartingVillagers.Value + homes * VillheimConfig.VillagersPerBuilding.Value;
            return Math.Min(capacity, VillheimConfig.MaxVillagers.Value);
        }

        private static void TryPopulate(VillageHearth hearth, VillageState state, double now)
        {
            if (VillagerPrefab.Prefab == null || CountVillagers(state.Id) >= Capacity(state))
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

            // New villagers move into a home when there is one, otherwise they stay by the hearth.
            List<Plot> homes = state.Plots
                .Where(p => string.IsNullOrEmpty(p.Role) || p.Role == nameof(Role.House) || p.Role == nameof(Role.Hub))
                .ToList();
            Vector3 center = hearth.transform.position;
            Vector3 home = homes.Count > 0 ? homes[arrival % homes.Count].Position : center;

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
        public static void ForceGrow(VillageHearth hearth, bool freeWood)
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
            if (freeWood)
            {
                state.Wood += VillheimConfig.MaxWoodPerBuilding.Value;
            }
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
            string text = $"{state.Name} ({Tier(buildings)}): {buildings} buildings, " +
                          $"{CountVillagers(state.Id)}/{Capacity(state)} villagers, {state.Wood} wood.";
            if (buildings >= VillheimConfig.MaxBuildings.Value)
            {
                return text + " Fully grown.";
            }

            if (!string.IsNullOrEmpty(state.Waiting))
            {
                return text + $" Waiting for {state.Waiting}.";
            }

            double remaining = state.LastGrowth + GrowthInterval() - ZNet.instance.GetTimeSeconds();
            double days = Math.Max(0.0, remaining / DayLength());
            return text + $" Next {RoleName(Culture.RoleFor(buildings))} in about {days:0.0} days.";
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
