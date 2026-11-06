using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Designs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// A building going up piece by piece. The site is stored on the hearth (design, spot, seed and how many
    /// pieces are done), and the full piece list is rebuilt from the design whenever it is needed, so a site
    /// survives logouts and logic reloads.
    ///
    /// Pieces go up in stages, ground first: walls, roof, doors and windows, then furnishing. Each structural
    /// piece costs wood when it is placed, so a village starts building as soon as it can and pauses when the
    /// wood runs out. Builders place pieces as they swing their hammers; without a builder nearby the site
    /// still creeps along slowly.
    /// </summary>
    internal static class ConstructionSite
    {
        private static readonly int KeySite = "villheim_site".GetStableHashCode();
        private static readonly int KeySiteIndex = "villheim_site_index".GetStableHashCode();
        private static readonly int KeySiteOwed = "villheim_site_owed".GetStableHashCode();

        private const float BuilderRecentSeconds = 12f;

        internal sealed class Site
        {
            public string Design;
            public Vector3 Position;
            public float Yaw;
            public float Radius;
            public Role Role;
            public int Seed;
        }

        private sealed class CachedPlan
        {
            public string Key;
            public List<DesignSpawner.PlanEntry> Entries;
            public Dictionary<string, float> Factors;
        }

        private static readonly Dictionary<int, CachedPlan> Plans = new Dictionary<int, CachedPlan>();
        private static readonly Dictionary<int, float> LastBuilderSwing = new Dictionary<int, float>();

        public static Site Get(ZDO zdo)
        {
            string raw = zdo.GetString(KeySite, "");
            if (string.IsNullOrEmpty(raw))
            {
                return null;
            }

            string[] parts = raw.Split('|');
            if (parts.Length < 8)
            {
                return null;
            }

            return new Site
            {
                Design = parts[0],
                Position = new Vector3(P(parts[1]), P(parts[2]), P(parts[3])),
                Yaw = P(parts[4]),
                Radius = P(parts[5]),
                Role = System.Enum.TryParse(parts[6], out Role role) ? role : Role.House,
                Seed = int.TryParse(parts[7], out int seed) ? seed : 1,
            };
        }

        public static bool IsActive(ZDO zdo) => !string.IsNullOrEmpty(zdo.GetString(KeySite, ""));

        public static void Begin(ZDO zdo, Site site)
        {
            string raw = string.Join("|", site.Design, F(site.Position.x), F(site.Position.y), F(site.Position.z),
                F(site.Yaw), F(site.Radius), site.Role.ToString(), site.Seed.ToString(CultureInfo.InvariantCulture));
            zdo.Set(KeySite, raw);
            zdo.Set(KeySiteIndex, 0);
            zdo.Set(KeySiteOwed, "");
        }

        private static void End(ZDO zdo)
        {
            zdo.Set(KeySite, "");
            zdo.Set(KeySiteIndex, 0);
            zdo.Set(KeySiteOwed, "");
        }

        /// <summary>"walls 12/40" style progress for summaries, or null when nothing is being built.</summary>
        public static string Progress(VillageHearth hearth)
        {
            Site site = Get(hearth.Zdo);
            CachedPlan plan = site != null ? GetPlan(hearth, site) : null;
            if (plan == null || plan.Entries.Count == 0)
            {
                return null;
            }

            int index = Mathf.Clamp(hearth.Zdo.GetInt(KeySiteIndex), 0, plan.Entries.Count - 1);
            string stage = DesignSpawner.StageNames[plan.Entries[index].Stage];
            int percent = Mathf.RoundToInt(100f * hearth.Zdo.GetInt(KeySiteIndex) / plan.Entries.Count);
            return $"building a {VillageBrain.RoleName(site.Role)}: {stage}, {percent}% done";
        }

        /// <summary>Where builders should stand: the next piece to place.</summary>
        public static bool NextPiecePosition(VillageHearth hearth, out Vector3 position)
        {
            position = Vector3.zero;
            Site site = Get(hearth.Zdo);
            CachedPlan plan = site != null ? GetPlan(hearth, site) : null;
            if (plan == null)
            {
                return false;
            }

            int index = hearth.Zdo.GetInt(KeySiteIndex);
            if (index >= plan.Entries.Count)
            {
                position = site.Position;
                return true;
            }

            position = site.Position + Quaternion.Euler(0f, site.Yaw, 0f) * plan.Entries[index].LocalPosition;
            return true;
        }

        public static void NoteBuilder(int villageId)
        {
            LastBuilderSwing[villageId] = Time.time;
        }

        public static bool BuilderActive(int villageId)
        {
            return LastBuilderSwing.TryGetValue(villageId, out float time) && Time.time - time < BuilderRecentSeconds;
        }

        /// <summary>
        /// Places the next piece if there is wood for it. Returns false when the site is waiting for wood or done.
        /// Completes the site after the last piece.
        /// </summary>
        public static bool PlaceNext(VillageHearth hearth, bool effects)
        {
            if (hearth == null || !hearth.IsValid)
            {
                return false;
            }

            ZDO zdo = hearth.Zdo;
            Site site = Get(zdo);
            CachedPlan plan = site != null ? GetPlan(hearth, site) : null;
            if (plan == null)
            {
                if (site != null)
                {
                    VillheimPlugin.Log.LogWarning($"Construction of {site.Design} could not be planned and was dropped.");
                    End(zdo);
                }

                return false;
            }

            var state = new VillageState(zdo);
            int index = zdo.GetInt(KeySiteIndex);
            if (index >= plan.Entries.Count)
            {
                Complete(hearth, state, site);
                return false;
            }

            DesignSpawner.PlanEntry entry = plan.Entries[index];
            if (!Pay(zdo, state, plan, entry))
            {
                return false;
            }

            if (!hearth.NView.IsOwner())
            {
                hearth.NView.ClaimOwnership();
            }

            Quaternion rotation = Quaternion.Euler(0f, site.Yaw, 0f);
            DesignSpawner.SpawnEntry(entry, site.Position, rotation, state.Id, effects);
            zdo.Set(KeySiteIndex, index + 1);
            state.Waiting = "";

            if (index + 1 >= plan.Entries.Count)
            {
                Complete(hearth, state, site);
            }

            return true;
        }

        private static void Complete(VillageHearth hearth, VillageState state, Site site)
        {
            End(hearth.Zdo);
            Plans.Remove(state.Id);
            SnapToGround.SnappAll();

            state.AddPlot(new Plot
            {
                Design = site.Design, Position = site.Position, Yaw = site.Yaw, Radius = site.Radius, Role = site.Role.ToString(),
            });

            if (VillheimConfig.BuildPaths.Value)
            {
                PathBuilder.Build(hearth.transform.position, state.Axis, site.Position, site.Radius);
            }

            VillheimPlugin.Log.LogInfo($"{state.Name} finished a {VillageBrain.RoleName(site.Role)} ({site.Design}).");
            VillageBrain.Announce(hearth, $"{state.Name} has finished a new {VillageBrain.RoleName(site.Role)}.");
        }

        private static CachedPlan GetPlan(VillageHearth hearth, Site site)
        {
            int id = hearth.VillageId;
            string key = $"{site.Design}|{site.Seed}|{site.Position}";
            if (Plans.TryGetValue(id, out CachedPlan cached) && cached.Key == key)
            {
                return cached;
            }

            ZoneSystem.ZoneLocation location = DesignLibrary.Find(site.Design);
            if (location == null)
            {
                return null;
            }

            location.m_prefab.Load();
            try
            {
                GameObject asset = location.m_prefab.Asset;
                if (asset == null)
                {
                    return null;
                }

                List<DesignSpawner.PlanEntry> entries = DesignSpawner.MakePlan(asset, site.Position, site.Seed);
                var factors = new Dictionary<string, float>();
                foreach (KeyValuePair<string, int> total in DesignLibrary.RawTotals(location))
                {
                    factors[total.Key] = DesignLibrary.CostFactor(total.Value);
                }

                var plan = new CachedPlan { Key = key, Entries = entries, Factors = factors };
                Plans[id] = plan;
                return plan;
            }
            finally
            {
                location.m_prefab.Release();
            }
        }

        /// <summary>
        /// Takes the materials for one piece from the stock. Amounts are scaled (see DesignLibrary.CostFactor) and the
        /// fractions carried over between pieces, so the whole building costs what its summary says.
        /// Returns false, with nothing taken, when the stock is short.
        /// </summary>
        private static bool Pay(ZDO zdo, VillageState state, CachedPlan plan, DesignSpawner.PlanEntry entry)
        {
            if (entry.Cost.Count == 0 || !VillheimConfig.RequireWood.Value)
            {
                return true;
            }

            Dictionary<string, float> owed = ReadOwed(zdo);
            var take = new Dictionary<string, int>();
            foreach (KeyValuePair<string, int> cost in entry.Cost)
            {
                plan.Factors.TryGetValue(cost.Key, out float factor);
                owed.TryGetValue(cost.Key, out float carried);
                float due = carried + cost.Value * factor;
                int whole = Mathf.FloorToInt(due);
                if (whole > state.Get(cost.Key))
                {
                    state.Waiting = $"{Materials.Label(cost.Key)} to keep building ({state.Get(cost.Key)} in stock)";
                    return false;
                }

                take[cost.Key] = whole;
                owed[cost.Key] = due - whole;
            }

            foreach (KeyValuePair<string, int> amount in take)
            {
                if (amount.Value > 0)
                {
                    state.Add(amount.Key, -amount.Value);
                }
            }

            WriteOwed(zdo, owed);
            return true;
        }

        private static Dictionary<string, float> ReadOwed(ZDO zdo)
        {
            var owed = new Dictionary<string, float>();
            foreach (string entry in zdo.GetString(KeySiteOwed, "").Split(';'))
            {
                int colon = entry.IndexOf(':');
                if (colon > 0)
                {
                    owed[entry.Substring(0, colon)] = P(entry.Substring(colon + 1));
                }
            }

            return owed;
        }

        private static void WriteOwed(ZDO zdo, Dictionary<string, float> owed)
        {
            zdo.Set(KeySiteOwed, string.Join(";", owed.Select(e => e.Key + ":" + F(e.Value))));
        }

        private static string F(float value) => value.ToString("0.###", CultureInfo.InvariantCulture);

        private static float P(string value) =>
            float.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out float result) ? result : 0f;
    }
}
