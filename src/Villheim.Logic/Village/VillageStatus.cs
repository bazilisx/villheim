using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text;
using UnityEngine;
using Villheim.Logic.Villagers;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// One "Village status" line per village every StatusLineSeconds (2026-11-10). The log otherwise only has events: a
    /// villager standing still or walking in circles for ten minutes writes nothing, and a stalled building has to be
    /// pieced together from scattered lines. This line gives the state at a glance, so a session can read a long test
    /// from the log alone:
    ///
    /// - buildings, the site and its progress (pieces since the last line, minutes since the last piece),
    /// - the next step and any hold-up,
    /// - the chest's building materials and how they moved since the last line,
    /// - each villager: what he is doing, for how long, where (metres from the hearth), what he holds, and how this
    ///   window's time split between the brain's parts ("Chores 70 %, BetweenJobs 20 %").
    ///
    /// Flags at the front of the line for a quick grep: STALLED (no piece in StallMinutes with a site open), IDLE (most
    /// villagers in free time while materials are short).
    /// </summary>
    internal static class VillageStatus
    {
        private const float StallMinutes = 10f;

        private sealed class Track
        {
            public Status.Doer Doer;
            public float Since;
            public readonly Dictionary<Status.Doer, float> Seconds = new Dictionary<Status.Doer, float>();
        }

        private sealed class VillageTrack
        {
            public float Next;
            public int SiteIndex = -1;
            public float SiteMovedAt;
            public int SiteIndexAtLast = -1;
            public Dictionary<string, int> Stock;
        }

        private static readonly ConditionalWeakTable<Villager, Track> Tracks = new ConditionalWeakTable<Villager, Track>();
        private static readonly Dictionary<int, VillageTrack> Villages = new Dictionary<int, VillageTrack>();

        private static float Every => LogicConfig.StatusLineSeconds != null ? LogicConfig.StatusLineSeconds.Value : 60f;

        /// <summary>From the brain, each tick: which part of the brain had the turn, and for how long.</summary>
        public static void Note(Villager villager, Status.Doer doer, float dt)
        {
            if (Every <= 0f)
            {
                return;
            }

            Track track = Tracks.GetOrCreateValue(villager);
            if (track.Doer != doer)
            {
                track.Doer = doer;
                track.Since = Time.time;
            }

            track.Seconds.TryGetValue(doer, out float seconds);
            track.Seconds[doer] = seconds + Mathf.Max(0f, dt);
        }

        /// <summary>From the hearth's tick on its owner.</summary>
        public static void Tick(VillageHearth hearth, VillageState state)
        {
            float every = Every;
            if (every <= 0f)
            {
                return;
            }

            if (!Villages.TryGetValue(state.Id, out VillageTrack village))
            {
                Villages[state.Id] = village = new VillageTrack { Next = Time.time + Mathf.Min(every, 20f), SiteMovedAt = Time.time };
            }

            int siteIndex = ConstructionSite.IsActive(hearth.Zdo) ? ConstructionSite.Index(hearth) : -1;
            if (siteIndex != village.SiteIndex)
            {
                village.SiteIndex = siteIndex;
                village.SiteMovedAt = Time.time;
            }

            if (Time.time < village.Next)
            {
                return;
            }

            village.Next = Time.time + every;
            try
            {
                VillheimPlugin.Log.LogInfo(Line(hearth, state, village));
            }
            catch (System.Exception ex)
            {
                VillheimPlugin.Debug($"Village status for {state.Name} failed: {ex.Message}");
            }
        }

        /// <summary>The line for 'vh status' and the log.</summary>
        public static string Now(VillageHearth hearth)
        {
            var state = new VillageState(hearth.Zdo);
            if (!Villages.TryGetValue(state.Id, out VillageTrack village))
            {
                Villages[state.Id] = village = new VillageTrack { SiteMovedAt = Time.time };
            }

            return Line(hearth, state, village, keepWindow: true);
        }

        private static string Line(VillageHearth hearth, VillageState state, VillageTrack village, bool keepWindow = false)
        {
            var flags = new List<string>();
            var text = new StringBuilder();
            Vector3 center = hearth.transform.position;
            List<Villager> people = Character.GetAllCharacters().OfType<Villager>()
                .Where(v => v != null && !v.IsDead() && v.VillageId == state.Id).ToList();

            // The site.
            string site = "no site";
            bool siteOpen = ConstructionSite.IsActive(hearth.Zdo);
            if (siteOpen)
            {
                ConstructionSite.Site s = ConstructionSite.Get(hearth.Zdo);
                int index = ConstructionSite.Index(hearth);
                int total = ConstructionSite.Total(hearth);
                int since = village.SiteIndexAtLast >= 0 && index >= village.SiteIndexAtLast ? index - village.SiteIndexAtLast : 0;
                float idle = (Time.time - village.SiteMovedAt) / 60f;
                site = $"site {s?.Design ?? "?"} {index}/{(total > 0 ? total.ToString() : "?")} (+{since} this window, last piece {idle:0.0} min ago)";
                if (idle >= StallMinutes)
                {
                    flags.Add("STALLED");
                }

                village.SiteIndexAtLast = index;
            }
            else
            {
                village.SiteIndexAtLast = -1;
            }

            // The chest.
            var stock = new Dictionary<string, int>();
            foreach (string material in Materials.Tracked)
            {
                stock[material] = VillageChest.Have(hearth, state, material);
            }

            string chest = string.Join(", ", stock.Select(p =>
            {
                int before = village.Stock != null && village.Stock.TryGetValue(p.Key, out int b) ? b : p.Value;
                int change = p.Value - before;
                return $"{Materials.Label(p.Key)} {p.Value}{(change != 0 ? $" ({change:+0;-0})" : "")}";
            }));
            if (!keepWindow)
            {
                village.Stock = stock;
            }

            // What is next, and what holds it up.
            string next;
            try
            {
                next = NextStep.Text(hearth, state);
            }
            catch (System.Exception)
            {
                next = "?";
            }

            // The villagers.
            int free = 0;
            var lines = new List<string>();
            foreach (Villager villager in people.OrderBy(v => v.VillagerName))
            {
                Tracks.TryGetValue(villager, out Track track);
                Status.Doer doer = Status.Current(villager);
                if (doer == Status.Doer.FreeTime || doer == Status.Doer.BetweenJobs || doer == Status.Doer.None)
                {
                    free++;
                }

                float on = track != null ? Time.time - track.Since : 0f;
                Vector3 offset = villager.transform.position - center;
                string holding = villager.GetRightItem()?.m_dropPrefab?.name ?? villager.GetRightItem()?.m_shared?.m_name ?? "-";
                string split = "";
                if (track != null && track.Seconds.Count > 0)
                {
                    float sum = track.Seconds.Values.Sum();
                    split = " [" + string.Join(" ", track.Seconds.OrderByDescending(p => p.Value).Take(3)
                        .Select(p => $"{p.Key} {Mathf.RoundToInt(100f * p.Value / Mathf.Max(0.01f, sum))}%")) + "]";
                    if (!keepWindow)
                    {
                        track.Seconds.Clear();
                    }
                }

                string activity = VillagerBehaviour.Activity(villager) ?? "-";
                lines.Add($"{villager.VillagerName}: {doer} '{activity}' {Minutes(on)} at ({offset.x:0},{offset.z:0}) " +
                          $"holding {holding}{split}");
            }

            bool short_ = NextStep.Lacking(hearth, state, NextStep.For(hearth, state), 1).Count > 0;
            if (people.Count > 0 && short_ && free * 2 > people.Count)
            {
                flags.Add("IDLE");
            }

            text.Append($"Village status {state.Name}{(flags.Count > 0 ? " " + string.Join(" ", flags) : "")}: ");
            text.Append($"{VillageBrain.Tier(state.Plots.Count)}, {state.Plots.Count} buildings, {people.Count} villagers. ");
            text.Append($"{site}. {next} Chest: {chest}. ");
            text.Append(string.Join("; ", lines));
            return text.ToString();
        }

        private static string Minutes(float seconds) =>
            seconds >= 60f ? $"{Mathf.FloorToInt(seconds / 60f)}m{Mathf.FloorToInt(seconds % 60f):00}s" : $"{seconds:0}s";
    }
}
