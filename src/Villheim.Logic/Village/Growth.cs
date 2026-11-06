using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using UnityEngine;
using Villheim.Logic.Designs;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// What the village builds next, after Millenaire's village growth.
    ///
    /// Buildings come in tiers. The start tier is the longhouse and a first home; the core tier brings more homes and a
    /// workshop; after that come farms, a second workshop and more homes. Only the lowest tier that isn't finished is
    /// open, so every start building goes up before any core one. Within the open tier each missing building is picked
    /// at random, weighted by its priority times the tier's multiplier (start 6, core 4, later 2).
    ///
    /// Once the start tier stands, upgrades are always in the pool too: a building is rebuilt as the next level of
    /// its blueprint family, or as a bigger design of the same kind. Homes count double when every bed is taken.
    ///
    /// The pick is kept on the hearth as the one pending project until it is built (or found to have no room), so the
    /// village saves up for it and gathers what it needs instead of changing its mind every few seconds.
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
            [Role.Hub] = 10f, [Role.House] = 6f, [Role.Workshop] = 4f, [Role.Farm] = 3f,
        };

        /// <summary>The pending project, choosing one when there is none.</summary>
        public static Project Pending(VillageHearth hearth, VillageState state, System.Random rng)
        {
            Project pending = Read(hearth);
            if (pending != null && (!pending.IsUpgrade || pending.UpgradeIndex < state.Plots.Count))
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

        private static Project Choose(VillageHearth hearth, VillageState state, System.Random rng)
        {
            IReadOnlyList<Plot> plots = state.Plots;
            var count = new Dictionary<Role, int> { [Role.Hub] = 0, [Role.House] = 0, [Role.Workshop] = 0, [Role.Farm] = 0 };
            foreach (Plot plot in plots)
            {
                count[RoleOf(plot)]++;
            }

            // Tiers: what each needs to be finished, and its multiplier.
            var tiers = new List<(Dictionary<Role, int> Wants, float Multiplier)>
            {
                (new Dictionary<Role, int> { [Role.Hub] = 1, [Role.House] = 1 }, 6f),
                (new Dictionary<Role, int> { [Role.House] = 3, [Role.Workshop] = 1 }, 4f),
                (new Dictionary<Role, int> { [Role.Farm] = 1, [Role.Workshop] = 2, [Role.House] = 6 }, 2f),
            };

            bool bedsFull = Villagers.Beds.Free(hearth) == 0 && VillageBrain.Capacity(state) < VillheimConfig.MaxVillagers.Value;
            var options = new List<(Project Project, float Weight)>();
            bool startDone = true;
            for (int t = 0; t < tiers.Count; t++)
            {
                foreach (KeyValuePair<Role, int> want in tiers[t].Wants)
                {
                    if (count[want.Key] < want.Value)
                    {
                        float weight = Priority[want.Key] * tiers[t].Multiplier * (want.Key == Role.House && bedsFull ? 2f : 1f);
                        options.Add((new Project { Role = want.Key }, weight));
                    }
                }

                if (options.Count > 0)
                {
                    startDone = t > 0;
                    break;
                }
            }

            if (options.Count == 0)
            {
                // Every tier stands: more homes, now and then a workshop or farm.
                options.Add((new Project { Role = Role.House }, Priority[Role.House] * (bedsFull ? 2f : 1f)));
                options.Add((new Project { Role = Role.Workshop }, 1f));
                options.Add((new Project { Role = Role.Farm }, 1f));
            }

            if (startDone)
            {
                for (int i = 0; i < plots.Count; i++)
                {
                    if (NextDesign(plots[i], state.Biome) != null)
                    {
                        options.Add((new Project { Role = RoleOf(plots[i]), UpgradeIndex = i }, UpgradeWeight / plots.Count * 2f));
                    }
                }
            }

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
        public static DesignLibrary.Design? NextDesign(Plot plot, Heightmap.Biome biome)
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
                return DesignLibrary.MissingIn(design, biome) == null ? design : (DesignLibrary.Design?)null;
            }

            DesignLibrary.Design? best = null;
            foreach (DesignLibrary.Design candidate in DesignLibrary.PoolFor(biome, role))
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
