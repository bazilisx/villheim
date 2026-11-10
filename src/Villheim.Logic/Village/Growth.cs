using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Designs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// What the village builds next, in the order a player settling in would (Tyler's order, 2026-11-06):
    ///
    /// 1. Homes, each with its beds, until every villager has a bed.
    /// 2. The longhouse, the village's central hall by the hearth.
    /// 3. While the village waits to grow: a workshop (a basic workbench house, rebuilt bigger as trades appear) and a
    ///    storehouse (an open shelter for the extra chests).
    /// 4. Then growth: more homes (newcomers only come when there is a free bed), farms, more workshops once there
    ///    are trades, and upgrades (a building rebuilt as the next level of its blueprint family, or a bigger design
    ///    of the same kind).
    ///
    /// The pick is kept on the hearth as the one pending project until it is built (or found to have no room), so the
    /// village saves up for it and gathers what it needs instead of changing its mind every few seconds. A pending
    /// project gives way when a home or the longhouse becomes due.
    /// </summary>
    internal static class Growth
    {
        internal sealed class Project
        {
            public Role Role;
            public int UpgradeIndex = -1;

            public bool IsUpgrade => UpgradeIndex >= 0;
        }

        private static readonly int KeyPending = "villheim_pending".GetStableHashCode();

        private const float UpgradeWeight = 8f;

        private static readonly Dictionary<Role, float> Priority = new Dictionary<Role, float>
        {
            [Role.Hub] = 10f, [Role.House] = 6f, [Role.Workshop] = 4f, [Role.Farm] = 3f, [Role.Storage] = 3f,
        };

        /// <summary>The pending project, choosing one when there is none.</summary>
        public static Project Pending(VillageHearth hearth, VillageState state, System.Random rng)
        {
            Project pending = Read(hearth);
            Role? urgent = Urgent(hearth, state);
            bool stale = pending != null && urgent.HasValue && (pending.IsUpgrade || pending.Role != urgent.Value);
            if (pending != null && !stale && (!pending.IsUpgrade || pending.UpgradeIndex < state.Plots.Count))
            {
                return pending;
            }

            Project chosen = Choose(hearth, state, rng);
            if (chosen != null)
            {
                Write(hearth, chosen);
                VillheimPlugin.Debug($"{state.Name} plans its next project: {Label(state, chosen)}.");
            }

            return chosen;
        }

        public static void Clear(VillageHearth hearth) => hearth.Zdo.Set(KeyPending, "");

        // Projects that found no room: left out of the choice until the time given, so one building that fits nowhere
        // never stops the rest of the village (2026-11-09: a hall with no room held up every home). Kept on the hearth
        // ("Hub=123456;House=123999"), so it holds through a reload of the logic or the world.
        private static readonly int KeyAside = "villheim_aside".GetStableHashCode();

        private static Dictionary<Role, double> ReadAside(VillageHearth hearth)
        {
            var roles = new Dictionary<Role, double>();
            foreach (string part in hearth.Zdo.GetString(KeyAside, "").Split(';'))
            {
                string[] pair = part.Split('=');
                if (pair.Length == 2 && System.Enum.TryParse(pair[0], out Role role) &&
                    double.TryParse(pair[1], NumberStyles.Float, CultureInfo.InvariantCulture, out double until))
                {
                    roles[role] = until;
                }
            }

            return roles;
        }

        private static void WriteAside(VillageHearth hearth, Dictionary<Role, double> roles)
        {
            hearth.Zdo.Set(KeyAside, string.Join(";", roles.Select(r => r.Key + "=" + r.Value.ToString("0", CultureInfo.InvariantCulture))));
        }

        public static void SetAside(VillageHearth hearth, Role role, double until)
        {
            Dictionary<Role, double> roles = ReadAside(hearth);
            roles[role] = until;
            WriteAside(hearth, roles);
            VillheimPlugin.Log.LogInfo($"No room for a {VillageBrain.RoleName(role)} right now. The village goes on with other work and looks again later.");
        }

        /// <summary>Every project is looked at again at once ('vh grow', or after the player has cleared some ground).</summary>
        public static void ClearAside(VillageHearth hearth) => hearth.Zdo.Set(KeyAside, "");

        private static bool IsAside(VillageHearth hearth, Role role)
        {
            string raw = hearth.Zdo.GetString(KeyAside, "");
            if (raw.Length == 0)
            {
                return false;
            }

            Dictionary<Role, double> roles = ReadAside(hearth);
            if (!roles.TryGetValue(role, out double until))
            {
                return false;
            }

            if (ZNet.instance != null && ZNet.instance.GetTimeSeconds() < until)
            {
                return true;
            }

            roles.Remove(role);
            WriteAside(hearth, roles);
            return false;
        }

        /// <summary>"a home", "to rebuild the longhouse bigger" and so on, for the hearth's summary.</summary>
        public static string Label(VillageState state, Project project)
        {
            if (project == null)
            {
                return "nothing";
            }

            if (project.IsUpgrade && project.UpgradeIndex < state.Plots.Count)
            {
                Plot plot = state.Plots[project.UpgradeIndex];
                return $"a bigger {VillageBrain.RoleName(RoleOf(plot))}";
            }

            return "a " + VillageBrain.RoleName(project.Role);
        }

        public static string PendingLabel(VillageHearth hearth, VillageState state) => Label(state, Read(hearth));

        /// <summary>A home while some villager has no bed (or there is no home yet), else the longhouse if there is none.</summary>
        private static Role? Urgent(VillageHearth hearth, VillageState state)
        {
            int homes = state.Plots.Count(p => RoleOf(p) == Role.House);
            int beds = Villagers.Beds.Of(hearth).Count;
            if ((homes == 0 || beds < VillageBrain.CountVillagers(state.Id)) && !IsAside(hearth, Role.House))
            {
                return Role.House;
            }

            return state.Plots.Any(p => RoleOf(p) == Role.Hub) || IsAside(hearth, Role.Hub) ? (Role?)null : Role.Hub;
        }

        private static Project Choose(VillageHearth hearth, VillageState state, System.Random rng)
        {
            Role? urgent = Urgent(hearth, state);
            if (urgent.HasValue)
            {
                return new Project { Role = urgent.Value };
            }

            IReadOnlyList<Plot> plots = state.Plots;
            var count = new Dictionary<Role, int>();
            foreach (Role role in System.Enum.GetValues(typeof(Role)))
            {
                count[role] = 0;
            }

            foreach (Plot plot in plots)
            {
                count[RoleOf(plot)]++;
            }

            // While waiting to grow: the workbench house and the storehouse.
            var options = new List<(Project Project, float Weight)>();
            if (count[Role.Workshop] == 0 && !IsAside(hearth, Role.Workshop)) options.Add((new Project { Role = Role.Workshop }, 1f));
            if (count[Role.Storage] == 0 && !IsAside(hearth, Role.Storage)) options.Add((new Project { Role = Role.Storage }, 1f));
            if (options.Count == 0)
            {
                bool bedsFull = Villagers.Beds.Free(hearth) == 0 && VillageBrain.Capacity(state) < VillheimConfig.MaxVillagers.Value;
                bool trades = VillageBrain.CountVillagers(state.Id) >= Villagers.Roles.TradesFrom;

                // The village's character favours some buildings (Millenaire's village types).
                float TypeFactor(Role role) =>
                    state.Type == "woodland" && role == Role.Workshop ? 2f :
                    state.Type == "farming" && role == Role.Farm ? 2.5f :
                    state.Type == "fortified" && role == Role.House ? 1.2f : 1f;

                options.Add((new Project { Role = Role.House }, Priority[Role.House] * (bedsFull ? 2f : 1f) * TypeFactor(Role.House)));
                options.Add((new Project { Role = Role.Farm }, (count[Role.Farm] == 0 ? 2f : 0.5f) * TypeFactor(Role.Farm)));
                if (trades && count[Role.Workshop] < 3)
                {
                    options.Add((new Project { Role = Role.Workshop }, 1.5f * TypeFactor(Role.Workshop)));
                }

                for (int i = 0; i < plots.Count; i++)
                {
                    DesignLibrary.Design? next = NextDesign(plots[i], state.Biome, Cultures.Of(state));
                    if (next != null && PlotFinder.CanUpgrade(plots[i], next.Value.Radius, hearth.transform.position, state.Axis,
                            plots, state.Id, next.Value.Name))
                    {
                        options.Add((new Project { Role = RoleOf(plots[i]), UpgradeIndex = i }, UpgradeWeight / plots.Count * 2f));
                    }
                }
            }

            options.RemoveAll(o => !o.Project.IsUpgrade && IsAside(hearth, o.Project.Role));
            float roll = (float)rng.NextDouble() * options.Sum(o => o.Weight);
            foreach ((Project project, float weight) in options)
            {
                roll -= weight;
                if (roll <= 0f)
                {
                    return project;
                }
            }

            return options.Count > 0 ? options[options.Count - 1].Project : null;
        }

        public static Role RoleOf(Plot plot) =>
            System.Enum.TryParse(plot.Role, out Role role) ? role : Role.House;

        /// <summary>
        /// The design a building would be rebuilt as: the next level of its blueprint family, or for a copied
        /// location the smallest design of the same kind that is clearly bigger (up to 1.7 times its size). Farms stay.
        /// </summary>
        public static DesignLibrary.Design? NextDesign(Plot plot, Heightmap.Biome biome, string culture = null)
        {
            Role role = RoleOf(plot);
            if (role == Role.Farm)
            {
                return null;
            }

            Blueprints.Blueprint blueprint = Blueprints.Find(plot.Design);
            if (blueprint != null)
            {
                Blueprints.Blueprint next = Blueprints.NextLevel(blueprint);
                if (next == null)
                {
                    return null;
                }

                var design = new DesignLibrary.Design(next, 1f);
                // A stone level waits for the stage that allows stone (D-012).
                return DesignLibrary.MissingIn(design, biome) == null &&
                       !Materials.StoneTooEarly(biome, role, DesignLibrary.StoneIn(design))
                    ? design
                    : (DesignLibrary.Design?)null;
            }

            DesignLibrary.Design? best = null;
            foreach (DesignLibrary.Design candidate in DesignLibrary.PoolFor(biome, role, culture))
            {
                if (candidate.Name == plot.Design || candidate.Radius < plot.Radius * 1.2f || candidate.Radius > plot.Radius * 1.7f)
                {
                    continue;
                }

                if (best == null || candidate.Radius < best.Value.Radius)
                {
                    best = candidate;
                }
            }

            return best;
        }

        private static Project Read(VillageHearth hearth)
        {
            string raw = hearth.Zdo.GetString(KeyPending, "");
            string[] parts = raw.Split('|');
            if (parts.Length < 2 || !System.Enum.TryParse(parts[0], out Role role))
            {
                return null;
            }

            return new Project
            {
                Role = role,
                UpgradeIndex = int.TryParse(parts[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out int index) ? index : -1,
            };
        }

        private static void Write(VillageHearth hearth, Project project)
        {
            hearth.Zdo.Set(KeyPending, project.Role + "|" + project.UpgradeIndex.ToString(CultureInfo.InvariantCulture));
        }
    }
}
