using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using UnityEngine;

namespace Villheim.Logic.Designs
{
    /// <summary>
    /// Writes a report of every Meadows and Black Forest location that could serve as a design: how many of its
    /// objects Villheim would copy, how many of those are building pieces, and how much of it is static mesh that a
    /// copy would leave out. Saved to BepInEx/Villheim/design-report.txt.
    /// </summary>
    internal static class DesignReport
    {
        private const float MaxRadius = 40f;
        private static bool _running;

        public static string ReportPath => Path.Combine(BepInEx.Paths.BepInExRootPath, "Villheim", "design-report.txt");

        /// <summary>Starts the report once a world is loaded. Skips it if a recent report already exists.</summary>
        public static void StartIfStale(TimeSpan maxAge)
        {
            if (File.Exists(ReportPath) && DateTime.UtcNow - File.GetLastWriteTimeUtc(ReportPath) < maxAge)
            {
                return;
            }

            Start(null);
        }

        public static void Start(Terminal context)
        {
            if (_running || VillheimPlugin.Instance == null)
            {
                return;
            }

            VillheimPlugin.Instance.StartCoroutine(Run(context));
        }

        private static IEnumerator Run(Terminal context)
        {
            _running = true;
            try
            {
                while (ZoneSystem.instance == null || ZNetScene.instance == null || Player.m_localPlayer == null)
                {
                    yield return new WaitForSeconds(2f);
                }

                const Heightmap.Biome biomes = Heightmap.Biome.Meadows | Heightmap.Biome.BlackForest;
                List<ZoneSystem.ZoneLocation> locations = ZoneSystem.instance.m_locations
                    .Where(l => l != null && l.m_prefab.IsValid && (l.m_biome & biomes) != 0 && l.m_exteriorRadius <= MaxRadius)
                    .GroupBy(l => l.m_prefabName)
                    .Select(g => g.First())
                    .OrderBy(l => l.m_prefabName)
                    .ToList();

                var sb = new StringBuilder();
                sb.AppendLine($"Villheim design report, {DateTime.Now}, {locations.Count} locations");
                sb.AppendLine("name | biome | radius | kept | pieces | skipped | static meshes | kept objects | skipped because");

                foreach (ZoneSystem.ZoneLocation location in locations)
                {
                    try
                    {
                        sb.AppendLine(Describe(location));
                    }
                    catch (Exception ex)
                    {
                        sb.AppendLine($"{location.m_prefabName} | error: {ex.Message}");
                    }

                    // One location per frame keeps the game responsive while asset bundles load.
                    yield return null;
                }

                Directory.CreateDirectory(Path.GetDirectoryName(ReportPath));
                File.WriteAllText(ReportPath, sb.ToString());
                VillheimPlugin.Log.LogInfo($"Design report written to {ReportPath}");
                context?.AddString($"Villheim: design report written to {ReportPath}");
            }
            finally
            {
                _running = false;
            }
        }

        private static string Describe(ZoneSystem.ZoneLocation location)
        {
            location.m_prefab.Load();
            try
            {
                GameObject asset = location.m_prefab.Asset;
                if (asset == null)
                {
                    return $"{location.m_prefabName} | could not load";
                }

                var kept = new Dictionary<string, int>();
                var skipped = new Dictionary<string, int>();
                int keptCount = 0;
                int pieces = 0;
                int skippedCount = 0;

                foreach (ZNetView view in Utils.GetEnabledComponentsInChildren<ZNetView>(asset))
                {
                    string name = Utils.GetPrefabName(view.gameObject);
                    GameObject prefab = ZNetScene.instance.GetPrefab(name);
                    string reason = prefab == null ? "no prefab" : DesignSpawner.ExclusionReason(prefab, name);
                    if (reason == null)
                    {
                        keptCount++;
                        Count(kept, name);
                        if (prefab.GetComponent<Piece>() || prefab.GetComponent<WearNTear>())
                        {
                            pieces++;
                        }
                    }
                    else
                    {
                        skippedCount++;
                        Count(skipped, reason.StartsWith("name contains") ? reason : reason);
                    }
                }

                int staticMeshes = 0;
                foreach (MeshRenderer renderer in asset.GetComponentsInChildren<MeshRenderer>(true))
                {
                    if (renderer.GetComponentInParent<ZNetView>(true) == null)
                    {
                        staticMeshes++;
                    }
                }

                return $"{location.m_prefabName} | {location.m_biome} | {location.m_exteriorRadius:0} | {keptCount} | {pieces} | " +
                       $"{skippedCount} | {staticMeshes} | {Top(kept, 8)} | {Top(skipped, 4)}";
            }
            finally
            {
                location.m_prefab.Release();
            }
        }

        private static void Count(Dictionary<string, int> counts, string key)
        {
            counts.TryGetValue(key, out int value);
            counts[key] = value + 1;
        }

        private static string Top(Dictionary<string, int> counts, int max)
        {
            return string.Join(", ", counts.OrderByDescending(p => p.Value).Take(max).Select(p => $"{p.Key} x{p.Value}"));
        }
    }
}
