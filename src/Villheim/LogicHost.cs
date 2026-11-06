using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using UnityEngine;

namespace Villheim
{
    /// <summary>
    /// Loads Villheim.Logic.dll from memory and swaps it for a new build whenever the file changes,
    /// so village behaviour can be changed without restarting Valheim.
    ///
    /// Loading from a byte array keeps the file unlocked, so it can be overwritten while the game runs.
    /// Each load creates a separate assembly; the old one stays in memory until the game closes, which is
    /// fine for development.
    /// </summary>
    internal static class LogicHost
    {
        public const string FileName = "Villheim.Logic.dll";
        private const float PollInterval = 1.5f;
        private const double SettleSeconds = 1.0;

        private static string _path;
        private static DateTime _loadedStamp;
        private static DateTime _pendingStamp;
        private static DateTime _pendingSeenAt;
        private static float _nextPoll;
        private static int _generation;
        private static readonly HashSet<string> LoggedErrors = new HashSet<string>();

        public static IVillheimLogic Current { get; private set; }

        public static void Init(string pluginDirectory)
        {
            _path = Path.Combine(pluginDirectory, FileName);
            Load();
        }

        /// <summary>Called every frame by the plugin. Checks the file now and then and reloads when it has settled.</summary>
        public static void Poll()
        {
            if (_path == null || !VillheimConfig.HotReload.Value || Time.unscaledTime < _nextPoll)
            {
                return;
            }

            _nextPoll = Time.unscaledTime + PollInterval;
            if (!File.Exists(_path))
            {
                return;
            }

            DateTime stamp = File.GetLastWriteTimeUtc(_path);
            if (stamp == _loadedStamp)
            {
                return;
            }

            // Wait until the file stops changing, so a half-copied DLL is never loaded.
            if (stamp != _pendingStamp)
            {
                _pendingStamp = stamp;
                _pendingSeenAt = DateTime.UtcNow;
                return;
            }

            if ((DateTime.UtcNow - _pendingSeenAt).TotalSeconds >= SettleSeconds)
            {
                Load();
            }
        }

        public static bool Load()
        {
            if (!File.Exists(_path))
            {
                VillheimPlugin.Log.LogError($"{FileName} is missing from {Path.GetDirectoryName(_path)}. Villages will not run.");
                return false;
            }

            DateTime stamp = File.GetLastWriteTimeUtc(_path);
            IVillheimLogic next;
            try
            {
                byte[] bytes = File.ReadAllBytes(_path);
                string pdbPath = Path.ChangeExtension(_path, ".pdb");
                Assembly assembly = null;
                if (File.Exists(pdbPath))
                {
                    try
                    {
                        assembly = Assembly.Load(bytes, File.ReadAllBytes(pdbPath));
                    }
                    catch (Exception)
                    {
                        assembly = null;
                    }
                }

                assembly = assembly ?? Assembly.Load(bytes);
                Type type = GetLoadableTypes(assembly)
                    .FirstOrDefault(t => typeof(IVillheimLogic).IsAssignableFrom(t) && !t.IsAbstract && !t.IsInterface);
                if (type == null)
                {
                    VillheimPlugin.Log.LogError($"{FileName} does not contain an IVillheimLogic implementation.");
                    _loadedStamp = stamp;
                    return false;
                }

                next = (IVillheimLogic)Activator.CreateInstance(type);
            }
            catch (Exception ex)
            {
                VillheimPlugin.Log.LogError($"Could not load {FileName}: {ex}");
                _loadedStamp = stamp;
                return false;
            }

            IVillheimLogic previous = Current;
            if (previous != null)
            {
                try
                {
                    previous.OnUnload();
                }
                catch (Exception ex)
                {
                    VillheimPlugin.Log.LogWarning($"Previous logic build failed to unload cleanly: {ex.Message}");
                }
            }

            Current = next;
            _loadedStamp = stamp;
            _generation++;
            LoggedErrors.Clear();

            Call(logic => logic.OnLoad());
            if (VillheimPlugin.PrefabsReady)
            {
                Call(logic => logic.ConfigurePrefabs());
            }

            string message = $"Loaded logic #{_generation}: {next.BuildInfo}";
            VillheimPlugin.Log.LogInfo(message);
            if (previous != null)
            {
                Player.m_localPlayer?.Message(MessageHud.MessageType.TopLeft, $"Villheim: {message}");
            }

            return true;
        }

        public static void Call(Action<IVillheimLogic> action)
        {
            IVillheimLogic logic = Current;
            if (logic == null)
            {
                return;
            }

            try
            {
                action(logic);
            }
            catch (Exception ex)
            {
                LogOnce(ex);
            }
        }

        public static T Get<T>(Func<IVillheimLogic, T> func, T fallback)
        {
            IVillheimLogic logic = Current;
            if (logic == null)
            {
                return fallback;
            }

            try
            {
                return func(logic);
            }
            catch (Exception ex)
            {
                LogOnce(ex);
                return fallback;
            }
        }

        /// <summary>Logs each distinct error once per logic build, so a bug in a per-frame call does not flood the log.</summary>
        private static void LogOnce(Exception ex)
        {
            string key = ex.GetType().Name + ex.Message + ex.StackTrace?.Split('\n').FirstOrDefault();
            if (LoggedErrors.Add(key))
            {
                VillheimPlugin.Log.LogError($"Logic error (logged once per build): {ex}");
            }
        }

        private static IEnumerable<Type> GetLoadableTypes(Assembly assembly)
        {
            try
            {
                return assembly.GetTypes();
            }
            catch (ReflectionTypeLoadException ex)
            {
                return ex.Types.Where(t => t != null);
            }
        }
    }
}
