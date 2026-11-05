using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Villheim.Designs;
using Villheim.Prefabs;
using Villheim.Villagers;
using Random = UnityEngine.Random;

namespace Villheim.Village
{
    /// <summary>
    /// The brain of a village, living on the hearth. Whoever owns the hearth's ZDO (the nearest player)
    /// runs growth and population. Missed time is caught up one building per tick when someone returns.
    /// </summary>
    public class VillageHearth : MonoBehaviour
    {
        private const float TickInterval = 5f;
        private const int MaxPlotAttempts = 6;

        private static readonly Dictionary<int, VillageHearth> Loaded = new Dictionary<int, VillageHearth>();

        private ZNetView _nview;
        private VillageState _state;
        private int _registeredId;
        private bool _busy;
        private int _plotAttempts;

        public static IEnumerable<VillageHearth> All => Loaded.Values;

        public int BuildingCount => _state?.Plots.Count ?? 0;
        public string VillageName => _state?.Name ?? "Village";
        internal VillageState State => _state;

        public static VillageHearth Find(int villageId)
        {
            return villageId != 0 && Loaded.TryGetValue(villageId, out VillageHearth hearth) && hearth ? hearth : null;
        }

        public static VillageHearth Closest(Vector3 point, float maxDistance)
        {
            VillageHearth best = null;
            float bestDistance = maxDistance;
            foreach (VillageHearth hearth in Loaded.Values)
            {
                if (!hearth)
                {
                    continue;
                }

                float distance = Vector3.Distance(point, hearth.transform.position);
                if (distance < bestDistance)
                {
                    best = hearth;
                    bestDistance = distance;
                }
            }

            return best;
        }

        private void Awake()
        {
            _nview = GetComponent<ZNetView>();
            if (_nview == null)
            {
                enabled = false;
                return;
            }

            InvokeRepeating(nameof(Tick), Random.Range(3f, 6f), TickInterval);
        }

        private void OnDestroy()
        {
            if (_registeredId != 0 && Loaded.TryGetValue(_registeredId, out VillageHearth hearth) && hearth == this)
            {
                Loaded.Remove(_registeredId);
            }
        }

        private void Tick()
        {
            if (_nview == null || !_nview.IsValid())
            {
                return;
            }

            // The state is created lazily so it never depends on component wake-up order.
            if (_state == null)
            {
                _state = new VillageState(_nview.GetZDO());
            }

            RegisterLoaded();

            if (!_nview.IsOwner() || _busy || ZNet.instance == null || ZoneSystem.instance == null || EnvMan.instance == null)
            {
                return;
            }

            try
            {
                if (!_state.Initialized)
                {
                    Initialize();
                }

                double now = ZNet.instance.GetTimeSeconds();
                if (!TryGrow(now))
                {
                    TryPopulate(now);
                }
            }
            catch (Exception ex)
            {
                VillheimPlugin.Log.LogError($"Village tick failed at {transform.position}: {ex}");
            }
        }

        private void RegisterLoaded()
        {
            int id = _state.Id;
            if (id != 0 && id != _registeredId)
            {
                _registeredId = id;
                Loaded[id] = this;
            }
        }

        private void Initialize()
        {
            int id = Random.Range(1, int.MaxValue);
            Vector3 position = transform.position;
            int seed = unchecked(id ^ ((int)position.x * 73856093) ^ ((int)position.z * 19349663));
            double now = ZNet.instance.GetTimeSeconds();

            _state.Id = id;
            _state.Seed = seed;
            _state.Name = Names.Village(new System.Random(seed));
            _state.Biome = WorldGenerator.instance.GetBiome(position);
            _state.LastGrowth = now - GrowthInterval() * VillheimConfig.StartingBuildings.Value;
            _state.LastArrival = now;
            _state.Initialized = true;

            TerrainShaper.LevelPad(position, 3f, 6f);
            RegisterLoaded();
            VillheimPlugin.Log.LogInfo($"Founded {_state.Name} ({_state.Biome}) at {position}.");
        }

        private static double DayLength()
        {
            double length = EnvMan.instance ? EnvMan.instance.m_dayLengthSec : 0;
            return length > 0 ? length : 1800.0;
        }

        private static double GrowthInterval() => VillheimConfig.DaysPerBuilding.Value * DayLength();
        private static double ArrivalInterval() => VillheimConfig.DaysPerNewVillager.Value * DayLength();

        private bool TryGrow(double now)
        {
            IReadOnlyList<Plot> plots = _state.Plots;
            double interval = GrowthInterval();
            if (plots.Count >= VillheimConfig.MaxBuildings.Value || now - _state.LastGrowth < interval)
            {
                return false;
            }

            List<DesignLibrary.Design> pool = DesignLibrary.PoolFor(_state.Biome);
            var rng = new System.Random(_state.Seed + plots.Count * 7919 + _plotAttempts * 104729);
            DesignLibrary.Design? picked = DesignLibrary.Pick(pool, rng);
            if (picked == null)
            {
                VillheimPlugin.Log.LogWarning($"{_state.Name} has no valid designs to build. Check the Designs config.");
                _state.LastGrowth = now;
                return false;
            }

            DesignLibrary.Design design = picked.Value;
            float radius = design.Radius;
            if (!PlotFinder.TryFind(transform.position, radius, DesignLibrary.MaxTerrainDelta(design.Location), plots, rng,
                    out Vector3 position))
            {
                _plotAttempts++;
                VillheimPlugin.Debug($"{_state.Name}: no room for {design.Name} (attempt {_plotAttempts}).");
                if (_plotAttempts >= MaxPlotAttempts)
                {
                    // Nowhere to build right now. Wait for the next growth period instead of retrying constantly.
                    _plotAttempts = 0;
                    _state.LastGrowth += interval;
                }

                return false;
            }

            _plotAttempts = 0;
            float yaw = rng.Next(16) * 22.5f;
            int buildSeed = rng.Next(1, int.MaxValue);
            StartCoroutine(BuildRoutine(design, position, yaw, radius, buildSeed, interval));
            return true;
        }

        private IEnumerator BuildRoutine(DesignLibrary.Design design, Vector3 position, float yaw, float radius, int seed,
            double interval)
        {
            _busy = true;
            var result = new DesignSpawner.Result();
            try
            {
                yield return DesignSpawner.Build(design.Location, position, yaw, seed, _state.Id, result);

                if (_nview == null || !_nview.IsValid())
                {
                    yield break;
                }

                // Advance the clock by one period rather than to "now", so a village that was left alone for a
                // long time catches up one building per tick.
                _state.LastGrowth += interval;

                if (result.Success)
                {
                    _state.AddPlot(new Plot { Design = design.Name, Position = position, Yaw = yaw, Radius = radius });
                    VillheimPlugin.Log.LogInfo($"{_state.Name} built {design.Name} at {position} " +
                                               $"({result.Spawned} objects, {result.Skipped} left out).");
                    Announce($"{_state.Name} has raised a new building.");
                }
                else
                {
                    VillheimPlugin.Log.LogWarning($"{_state.Name} could not build {design.Name}: {result.Error}");
                }
            }
            finally
            {
                _busy = false;
            }
        }

        private void TryPopulate(double now)
        {
            if (VillagerPrefab.Prefab == null)
            {
                return;
            }

            int capacity = Math.Max(VillheimConfig.StartingVillagers.Value,
                _state.Plots.Count * VillheimConfig.VillagersPerBuilding.Value);
            int target = Math.Min(capacity, VillheimConfig.MaxVillagers.Value);
            int count = CountVillagers();
            if (count >= target)
            {
                return;
            }

            bool firstArrivals = _state.Arrivals < VillheimConfig.StartingVillagers.Value;
            if (!firstArrivals && now - _state.LastArrival < ArrivalInterval())
            {
                return;
            }

            SpawnVillager();
            _state.LastArrival = now;
        }

        public int CountVillagers()
        {
            int id = _state?.Id ?? 0;
            int count = 0;
            foreach (Character character in Character.GetAllCharacters())
            {
                if (character is Villager villager && !villager.IsDead() && villager.VillageId == id)
                {
                    count++;
                }
            }

            return count;
        }

        private void SpawnVillager()
        {
            int arrival = _state.Arrivals;
            var rng = new System.Random(_state.Seed * 31 + arrival * 6151);

            IReadOnlyList<Plot> plots = _state.Plots;
            Vector3 hearth = transform.position;
            Vector3 home = plots.Count > 0 ? plots[rng.Next(plots.Count)].Position : hearth;

            float angle = (float)rng.NextDouble() * Mathf.PI * 2f;
            float distance = 3f + (float)rng.NextDouble() * 3f;
            Vector3 spawn = hearth + new Vector3(Mathf.Sin(angle), 0f, Mathf.Cos(angle)) * distance;
            if (ZoneSystem.instance.GetGroundHeight(spawn, out float y))
            {
                spawn.y = y + 0.2f;
            }

            GameObject go = Instantiate(VillagerPrefab.Prefab, spawn, Quaternion.Euler(0f, angle * Mathf.Rad2Deg, 0f));
            Villager villager = go.GetComponent<Villager>();
            int looksSeed = rng.Next(1, int.MaxValue);
            villager.Setup(_state.Id, _state.Name, hearth, home, looksSeed, Names.Villager(looksSeed));

            _state.Arrivals = arrival + 1;
            VillheimPlugin.Debug($"{_state.Name}: {villager.VillagerName} arrived.");
        }

        /// <summary>Makes the next building start on the following tick. Used by the console command.</summary>
        public void ForceGrow()
        {
            if (_state == null)
            {
                return;
            }

            if (!_nview.IsOwner())
            {
                _nview.ClaimOwnership();
            }

            if (!_state.Initialized)
            {
                Initialize();
            }

            _state.LastGrowth = ZNet.instance.GetTimeSeconds() - GrowthInterval();
        }

        public string Tier()
        {
            int count = BuildingCount;
            if (count <= 1) return "Camp";
            if (count <= 3) return "Hamlet";
            if (count <= 6) return "Village";
            return "Town";
        }

        public string Summary()
        {
            if (_state == null || !_state.Initialized)
            {
                return "A newly lit hearth. Settlers will arrive soon.";
            }

            string text = $"{_state.Name} ({Tier()}): {BuildingCount} buildings, {CountVillagers()} villagers.";
            if (BuildingCount >= VillheimConfig.MaxBuildings.Value)
            {
                return text + " Fully grown.";
            }

            double remaining = _state.LastGrowth + GrowthInterval() - ZNet.instance.GetTimeSeconds();
            double days = Math.Max(0.0, remaining / DayLength());
            return text + $" Next building in about {days:0.0} days.";
        }

        private void Announce(string message)
        {
            Player player = Player.m_localPlayer;
            if (player != null && MessageHud.instance != null &&
                Vector3.Distance(player.transform.position, transform.position) < VillheimConfig.VillageRadius.Value + 40f)
            {
                MessageHud.instance.ShowMessage(MessageHud.MessageType.TopLeft, message);
            }
        }
    }
}
