using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace Villheim.Logic.Designs
{
    /// <summary>
    /// Loads a location's prefab, once. A location whose asset throws while loading (seen 2026-11-06: an
    /// InvalidCastException inside Jotunn's mock resolution for a mod location) is remembered and never loaded again:
    /// a second load of a half-failed asset can leave the game's asset loader waiting forever, which froze the game.
    /// The names are kept in BepInEx/Villheim/broken-locations.txt, so they are skipped from the start next time too.
    /// </summary>
    internal static class AssetGuard
    {
        internal sealed class BrokenException : Exception
        {
            public BrokenException(string name) : base($"the location '{name}' failed to load before and is skipped") { }
        }

        private static HashSet<string> _broken;

        private static string FilePath => Path.Combine(BepInEx.Paths.BepInExRootPath, "Villheim", "broken-locations.txt");

        private static HashSet<string> Broken
        {
            get
            {
                if (_broken == null)
                {
                    _broken = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                    try
                    {
                        if (File.Exists(FilePath))
                        {
                            _broken.UnionWith(File.ReadAllLines(FilePath).Select(l => l.Trim()).Where(l => l.Length > 0 && !l.StartsWith("#")));
                        }
                    }
                    catch (Exception e)
                    {
                        VillheimPlugin.Log.LogWarning($"Could not read {FilePath}: {e.Message}");
                    }
                }

                return _broken;
            }
        }

        public static bool IsBroken(ZoneSystem.ZoneLocation location) => location != null && Broken.Contains(location.m_prefabName);

        /// <summary>Loads the prefab (pair it with m_prefab.Release()). Throws without loading for a known broken one.</summary>
        public static void Load(ZoneSystem.ZoneLocation location)
        {
            if (IsBroken(location))
            {
                throw new BrokenException(location.m_prefabName);
            }

            try
            {
                location.m_prefab.Load();
            }
            catch (Exception e)
            {
                Broken.Add(location.m_prefabName);
                VillheimPlugin.Log.LogWarning($"The location {location.m_prefabName} failed to load ({e.GetType().Name}); it is skipped from now on.");
                try
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(FilePath));
                    File.WriteAllLines(FilePath, new[] { "# Locations whose assets failed to load; Villheim never loads them. Delete a line to try again." }
                        .Concat(Broken.OrderBy(n => n)));
                }
                catch
                {
                    // Remembered for this session even if the file can't be written.
                }

                throw new BrokenException(location.m_prefabName);
            }
        }
    }
}
