using System.Collections.Generic;
using UnityEngine;

namespace Villheim.Logic.Villagers
{
    /// <summary>
    /// Spreads heavy one-off work over frames (T-57: a test village of many villagers, all dressed and given the ghost
    /// look in the same frame, stalled the game). A caller asks for a turn; only so many are granted per frame for
    /// each kind of work, and the rest try again on their next tick.
    /// </summary>
    internal static class FrameBudget
    {
        private static readonly Dictionary<string, (int Frame, int Used)> Used = new Dictionary<string, (int, int)>();

        public static bool Take(string kind, int perFrame)
        {
            int frame = Time.frameCount;
            if (Used.TryGetValue(kind, out (int Frame, int Used) entry) && entry.Frame == frame)
            {
                if (entry.Used >= perFrame)
                {
                    return false;
                }

                Used[kind] = (frame, entry.Used + 1);
                return true;
            }

            Used[kind] = (frame, 1);
            return true;
        }
    }
}
