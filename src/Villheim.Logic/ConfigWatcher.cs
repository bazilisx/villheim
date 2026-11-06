using System;
using System.Collections;
using System.IO;
using UnityEngine;

namespace Villheim.Logic
{
    /// <summary>
    /// Reloads the Villheim config when the file changes on disk, so settings can be edited while the game runs.
    /// </summary>
    internal static class ConfigWatcher
    {
        private static Coroutine _routine;
        private static int _generation;

        public static void Start()
        {
            VillheimPlugin plugin = VillheimPlugin.Instance;
            if (plugin == null)
            {
                return;
            }

            // Each logic build starts its own watcher; the generation check makes older ones stop.
            _generation++;
            _routine = plugin.StartCoroutine(Watch(_generation));
        }

        private static IEnumerator Watch(int generation)
        {
            string path = VillheimPlugin.Instance.Config.ConfigFilePath;
            DateTime last = File.Exists(path) ? File.GetLastWriteTimeUtc(path) : DateTime.MinValue;

            while (generation == _generation)
            {
                yield return new WaitForSecondsRealtime(2f);
                if (!File.Exists(path))
                {
                    continue;
                }

                DateTime stamp = File.GetLastWriteTimeUtc(path);
                if (stamp == last)
                {
                    continue;
                }

                last = stamp;
                try
                {
                    VillheimPlugin.Instance.Config.Reload();
                    VillheimPlugin.Log.LogInfo("Config reloaded from disk.");
                }
                catch (Exception ex)
                {
                    VillheimPlugin.Log.LogWarning($"Could not reload the config: {ex.Message}");
                }
            }
        }
    }
}
