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
        private const float StartShare = 0.15f;
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
            double unloadedSeconds = AddPassiveWood(hearth, state, now);

            VillageChest.Ensure(hearth);
            VillageChest.MoveStockIn(hearth, state);
            if (VillageChest.IsLost(hearth))
            {
                // Nothing gets built until the chest is back.
                state.Waiting = "a new village chest";
                TryPopulate(hearth, state, now);
                return;
            }

            if (state.Waiting == "a new village chest")
            {
                state.Waiting = "";
            }

            if (ConstructionSite.IsActive(hearth.Zdo))
            {
                AdvanceSite(hearth, unloadedSeconds);
            }
            else
            {
                TryGrow(hearth, state, now);
            }

            TryPopulate(hearth, state, now);
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
            state.Add(Materials.Stone, StartingWood() / 2);
            state.Initialized = true;

            TerrainShaper.LevelPad(position, 3f, 6f);
            hearth.Register();
            VillheimPlugin.Log.LogInfo($"Founded {state.Name} ({state.Biome}) at {position}.");
        }

        /// <summary>What a new village has saved up. Nothing by default: villagers gather for their first building.</summary>
        private static int StartingWood()
        {
            return LogicConfig.StartingStock != null ? Mathf.Max(0, LogicConfig.StartingStock.Value) : 0;
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

        /// <summary>Adds the wood gathered while the village sat unloaded. Returns how long that was, in seconds.</summary>
        private static double AddPassiveWood(VillageHearth hearth, VillageState state, double now)
        {
            double last = state.LastSeen;
            state.LastSeen = now;
            if (last <= 0 || now - last < UnloadedGapSeconds)
            {
                return 0;
            }

            int villagers = Math.Min(state.Arrivals, Capacity(state));
            double days = (now - last) / DayLength();
            int earned = (int)(villagers * VillheimConfig.PassiveWoodPerVillagerPerDay.Value * days);
            if (earned > 0)
            {
                // Split by what the building site still needs, or roughly between woodcutters and miners.
                Dictionary<string, int> remaining = ConstructionSite.Remaining(hearth);
                int total = remaining.Values.Sum();
                if (total > 0)
                {
                    foreach (KeyValuePair<string, int> need in remaining)
                    {
                        state.Add(need.Key, (int)((long)earned * need.Value / total));
                    }
                }
                else
                {
                    state.Add(Materials.Wood, earned * 2 / 3);
                    state.Add(Materials.Stone, earned / 3);
                }

                VillheimPlugin.Debug($"{state.Name} gathered {earned} materials while unloaded ({days:0.00} days).");
            }

            return now - last;
        }

        private const float SecondsPerPieceUnattended = 5f;
        private const int MaxCatchUpPiecesPerTick = 150;

        /// <summary>
        /// Pieces only go up while the builder stands next to them. The one exception is time spent unloaded, with
        /// nobody around to see: that is made up in one go when the village loads again (materials permitting).
        /// </summary>
        private static void AdvanceSite(VillageHearth hearth, double unloadedSeconds)
        {
            int pieces = unloadedSeconds > 0
                ? Mathf.Min(MaxCatchUpPiecesPerTick, Mathf.CeilToInt((float)(unloadedSeconds / SecondsPerPieceUnattended)))
                : 0;

            for (int i = 0; i < pieces; i++)
            {
                if (!ConstructionSite.PlaceNext(hearth, unloadedSeconds <= 0))
                {
                    break;
                }
            }
        }

        public static void AddMaterial(int villageId, string material, int amount)
        {
            VillageHearth hearth = VillageHearth.Find(villageId);
            if (hearth == null || !hearth.IsValid || amount <= 0)
            {
                return;
            }

            var state = new VillageState(hearth.Zdo);
            state.Add(material, amount);
        }

        private static bool TryGrow(VillageHearth hearth, VillageState state, double now)
        {
            IReadOnlyList<Plot> plots = state.Plots;
            double interval = GrowthInterval();
            if (now - state.LastGrowth < interval)
            {
                return false;
            }

            // Millenaire's growth: one pending project at a time, chosen by tier and priority (see Growth).
            var rng = new System.Random(state.Seed + plots.Count * 7919 + hearth.PlotAttempts * 104729 + (int)(now / 60.0));
            Growth.Project project = Growth.Pending(hearth, state, rng);
            if (project == null)
            {
                state.Waiting = "";
                return false;
            }

            if (project.IsUpgrade)
            {
                return TryUpgrade(hearth, state, project, interval);
            }

            if (plots.Count >= VillheimConfig.MaxBuildings.Value)
            {
                Growth.Clear(hearth);
                state.Waiting = "";
                return false;
            }

            Role role = project.Role;
            List<DesignLibrary.Design> pool = DesignLibrary.PoolFor(state.Biome, role);
            DesignLibrary.Design? picked = DesignLibrary.Pick(pool, rng);
            if (picked == null)
            {
                VillheimPlugin.Log.LogWarning($"{state.Name} has no valid designs to build. Check the Designs config.");
                Growth.Clear(hearth);
                state.LastGrowth = now;
                return false;
            }

            // Try the picked design first, then smaller stand-ins for the same role, so rough ground slows a village
            // down instead of stopping it.
            var candidates = new List<DesignLibrary.Design> { picked.Value };
            List<DesignLibrary.Design> fallbacks = DesignLibrary.FallbackPool(state.Biome, role);
            fallbacks.Reverse(); // largest stand-in that is still smaller than the pick comes first
            foreach (DesignLibrary.Design fallback in fallbacks)
            {
                if (candidates.Count >= 4)
                {
                    break;
                }

                if (!candidates.Exists(d => d.Name == fallback.Name) && fallback.Radius < picked.Value.Radius)
                {
                    candidates.Add(fallback);
                }
            }

            bool strictHub = hearth.PlotAttempts < 2;
            foreach (DesignLibrary.Design design in candidates)
            {
                // Breaking ground needs a share of the materials; the rest is paid piece by piece as it goes up.
                string missing = MissingToStart(hearth, state, design);
                if (missing != null)
                {
                    state.Waiting = $"{missing} to start a {RoleName(role)}";
                    return false;
                }

                float radius = design.Radius;
                Vector3 position;
                float yaw;
                Vector3? fire = role == Role.Hub && !plots.Any(p => p.Role == nameof(Role.Hub)) ? DesignLibrary.FireOf(design) : null;
                if (fire.HasValue && PlotFinder.AroundHearth(hearth.transform.position, state.Axis, fire.Value, radius,
                        design.MaxTerrainDelta, state.Id, out position, out yaw))
                {
                    VillheimPlugin.Log.LogInfo($"{state.Name} builds its {design.Name} around the hearth.");
                }
                else if (!PlotFinder.TryFind(hearth.transform.position, state.Axis, role, strictHub, radius,
                             design.MaxTerrainDelta, plots, rng, out position, out yaw, PathPlanner.Network(hearth), hearth))
                {
                    VillheimPlugin.Debug($"{state.Name}: no room for {design.Name}.");
                    continue;
                }

                hearth.PlotAttempts = 0;
                state.Waiting = "";
                Growth.Clear(hearth);
                int buildSeed = rng.Next(1, int.MaxValue);
                hearth.StartCoroutine(BreakGround(hearth, design, role, position, yaw, radius, buildSeed, interval));
                return true;
            }

            hearth.PlotAttempts++;
            VillheimPlugin.Debug($"{state.Name}: nowhere to put a {RoleName(role)} (attempt {hearth.PlotAttempts}).");
            if (hearth.PlotAttempts >= MaxPlotAttempts)
            {
                // Nowhere to build this right now. Choose another project after a while instead of retrying every
                // few seconds (Millenaire waits too).
                hearth.PlotAttempts = 0;
                Growth.Clear(hearth);
                state.LastGrowth = now - interval * 0.75;
                state.Waiting = "room to build";
            }

            return false;
        }

        /// <summary>Rebuilds a building bigger where it stands: the old one comes down piece by piece first.</summary>
        private static bool TryUpgrade(VillageHearth hearth, VillageState state, Growth.Project project, double interval)
        {
            Plot plot = state.Plots[project.UpgradeIndex];
            DesignLibrary.Design? next = Growth.NextDesign(plot, state.Biome);
            if (next == null || !PlotFinder.CanUpgrade(plot, next.Value.Radius, hearth.transform.position, state.Axis, state.Plots, state.Id))
            {
                VillheimPlugin.Debug($"{state.Name}: no room to make the {plot.Design} bigger.");
                Growth.Clear(hearth);
                return false;
            }

            string missing = MissingToStart(hearth, state, next.Value);
            if (missing != null)
            {
                state.Waiting = $"{missing} to rebuild the {RoleName(Growth.RoleOf(plot))} bigger";
                return false;
            }

            Growth.Clear(hearth);
            state.Waiting = "";
            state.LastGrowth += interval;
            Role role = Growth.RoleOf(plot);
            float yaw = PlotFinder.FaceHearth(plot.Position, hearth.transform.position, state.Axis);
            ConstructionSite.Begin(hearth.Zdo, new ConstructionSite.Site
            {
                Design = next.Value.Name, Position = plot.Position, Yaw = yaw, Radius = next.Value.Radius, Role = role,
                Seed = new System.Random(state.Seed + plot.Design.GetStableHashCode()).Next(1, int.MaxValue), Upgrade = true,
            });

            VillheimPlugin.Log.LogInfo($"{state.Name} will rebuild the {plot.Design} as {next.Value.Name}.");
            Announce(hearth, $"{state.Name} is rebuilding its {RoleName(role)} bigger.");
            Villagers.Dialogue.Note(state.Id, "groundbroken");
            return true;
        }

        /// <summary>Null when the stock covers the share needed to break ground, otherwise what is short.</summary>
        private static string MissingToStart(VillageHearth hearth, VillageState state, DesignLibrary.Design design)
        {
            foreach (KeyValuePair<string, int> cost in DesignLibrary.MaterialCost(design))
            {
                int needed = Mathf.CeilToInt(cost.Value * StartShare);
                int have = VillageChest.Have(hearth, state, cost.Key);
                if (have < needed)
                {
                    return $"{Materials.Label(cost.Key)} ({have}/{needed})";
                }
            }

            return null;
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

        /// <summary>Clears and levels the plot, then opens a construction site for builders to work on.</summary>
        private static IEnumerator BreakGround(VillageHearth hearth, DesignLibrary.Design design, Role role, Vector3 position,
            float yaw, float radius, int seed, double interval)
        {
            hearth.Busy = true;
            try
            {
                if (design.Blueprint != null)
                {
                    DesignSpawner.ClearArea(position, radius);
                }
                else if (!DesignSpawner.PrepareSite(design.Location, position, yaw))
                {
                    VillheimPlugin.Log.LogWarning($"Could not load the design {design.Name}.");
                    yield break;
                }

                // Give the heightmaps a moment to rebuild before pieces start going up.
                yield return new WaitForSeconds(0.75f);
                if (!hearth || !hearth.IsValid)
                {
                    yield break;
                }

                var state = new VillageState(hearth.Zdo);

                // Advance the clock by one period rather than to "now", so a village that was left alone for a
                // long time catches up.
                state.LastGrowth += interval;
                ConstructionSite.Begin(hearth.Zdo, new ConstructionSite.Site
                {
                    Design = design.Name, Position = position, Yaw = yaw, Radius = radius, Role = role, Seed = seed,
                });

                // Ground first: the whole outline is flattened to the floor height before the first piece goes up.
                float footprint = ConstructionSite.Footprint(hearth);
                TerrainShaper.LevelPad(position, footprint + 0.5f, footprint + 3f);

                VillheimPlugin.Log.LogInfo($"{state.Name} broke ground for a {RoleName(role)} ({design.Name}) at {position}.");
                Villagers.Dialogue.Note(state.Id, "groundbroken");
                Announce(hearth, $"{state.Name} has started building a {RoleName(role)}.");
            }
            finally
            {
                if (hearth)
                {
                    hearth.Busy = false;
                }
            }
        }

        /// <summary>
        /// How many villagers the village can house: one per bed (Millenaire's residents per building), and never
        /// fewer than the first settlers, who sleep by the fire until the longhouse has their beds.
        /// </summary>
        public static int Capacity(VillageState state)
        {
            VillageHearth hearth = VillageHearth.Find(state.Id);
            int beds = hearth != null && hearth.IsValid ? Villagers.Beds.Of(hearth).Count : 0;
            int capacity = Math.Max(VillheimConfig.StartingVillagers.Value, beds);
            return Math.Min(capacity, VillheimConfig.MaxVillagers.Value);
        }

        private static void TryPopulate(VillageHearth hearth, VillageState state, double now)
        {
            if (VillagerPrefab.Prefab == null || CountVillagers(state.Id) >= Capacity(state))
            {
                return;
            }

            bool firstArrivals = state.Arrivals < VillheimConfig.StartingVillagers.Value;
            if (!firstArrivals && (now - state.LastArrival < ArrivalInterval() || EnvMan.IsNight() ||
                                   Villagers.Beds.Free(hearth) == 0))
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
            // The first settlers are found at the hearth; later ones walk in from the edge of the village.
            float distance = arrival < VillheimConfig.StartingVillagers.Value
                ? 3f + (float)rng.NextDouble() * 3f
                : Mathf.Min(VillheimConfig.VillageRadius.Value, 40f);
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
            zdo.Set(Villagers.Roles.KeyArrival, arrival);
            villager.m_name = name;
            villager.LooksApplied = false;

            state.Arrivals = arrival + 1;
            VillheimPlugin.Debug($"{state.Name}: {name} arrived.");
            if (arrival >= VillheimConfig.StartingVillagers.Value)
            {
                Villagers.Dialogue.Note(state.Id, "arrival");
            }
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

            if (freeWood)
            {
                foreach (string material in Materials.Tracked)
                {
                    state.Add(material, VillheimConfig.MaxWoodPerBuilding.Value);
                }
            }

            if (ConstructionSite.IsActive(hearth.Zdo))
            {
                // Testing shortcut: finish the building in progress.
                int guard = 5000;
                while (guard-- > 0)
                {
                    Container chest = VillageChest.Find(hearth);
                    foreach (string material in Materials.Tracked)
                    {
                        if (chest == null || VillageChest.Add(chest, material, 10) == 0)
                        {
                            state.Add(material, 10);
                        }
                    }

                    if (!ConstructionSite.PlaceNext(hearth, false))
                    {
                        break;
                    }
                }

                return;
            }

            state.LastGrowth = ZNet.instance.GetTimeSeconds() - GrowthInterval();
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
                          $"{CountVillagers(state.Id)}/{Capacity(state)} villagers, {state.StockText()}.";

            string progress = ConstructionSite.Progress(hearth);
            if (progress != null)
            {
                text += $" Now {progress}.";
                Dictionary<string, int> shortfall = ConstructionSite.Shortfall(hearth);
                if (shortfall.Count > 0)
                {
                    text += " The site chest still needs " +
                            string.Join(", ", shortfall.Select(n => $"{n.Value} {Materials.Label(n.Key)}")) + ".";
                }
            }

            if (!string.IsNullOrEmpty(state.Waiting))
            {
                return text + $" Waiting for {state.Waiting}.";
            }

            if (progress != null)
            {
                return text;
            }

            double remaining = state.LastGrowth + GrowthInterval() - ZNet.instance.GetTimeSeconds();
            double days = Math.Max(0.0, remaining / DayLength());
            string next = Growth.PendingLabel(hearth, state);
            return text + (next == "nothing" ? $" Next building in about {days:0.0} days." : $" Next: {next}, in about {days:0.0} days.");
        }

        public static void Announce(VillageHearth hearth, string message)
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
