using System;
using System.Diagnostics;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// Times a village step and logs it when it runs long (LagLog, LagLogMs). Costs nothing with LagLog off:
    /// <c>using (Perf.Time("what"))</c> hands back null and the using block skips it.
    /// </summary>
    internal static class Perf
    {
        private sealed class Timer : IDisposable
        {
            private readonly string _what;
            private readonly Stopwatch _watch = Stopwatch.StartNew();

            public Timer(string what) => _what = what;

            public void Dispose()
            {
                _watch.Stop();
                double ms = _watch.Elapsed.TotalMilliseconds;
                float limit = LogicConfig.LagLogMs != null ? LogicConfig.LagLogMs.Value : 4f;
                if (ms >= limit)
                {
                    VillheimPlugin.Log.LogInfo($"Lag: {_what} took {ms:0.0} ms (frame {UnityEngine.Time.frameCount}).");
                }
            }
        }

        public static bool On => LogicConfig.LagLog != null && LogicConfig.LagLog.Value;

        public static IDisposable Time(string what) => On ? new Timer(what) : null;

        /// <summary>DebugLog is on: village decisions are written to the log.</summary>
        public static bool Debugging => LogicConfig.DebugLog != null && LogicConfig.DebugLog.Value;

        /// <summary>Writes a village decision to the log when DebugLog is on.</summary>
        public static void Debug(string message)
        {
            if (Debugging)
            {
                VillheimPlugin.Log.LogInfo("Debug: " + message);
            }
        }
    }
}
