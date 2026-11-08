using System.Collections.Generic;

namespace Villheim.Logic.Designs
{
    internal enum Role
    {
        Hub,
        House,
        Workshop,
        Farm,

        /// <summary>A storehouse: an open shelter for the village's extra chests.</summary>
        Storage,
    }

    /// <summary>
    /// What a village of a given biome builds, by role. Each role lists design tiers: the first tier with any
    /// design available in this game is used, so vanilla fallbacks only kick in when the better designs (from
    /// More World Locations) are not installed.
    ///
    /// The build order follows Millenaire's idea of a village plan: a central building first, then homes, then
    /// workshops and farms as the village grows.
    /// </summary>
    internal sealed class Culture
    {
        private static readonly Role[] Plan =
        {
            Role.Hub, Role.House, Role.House, Role.Workshop, Role.House, Role.Farm,
            Role.House, Role.Workshop, Role.House, Role.Farm, Role.House, Role.House,
        };

        private const string VanillaHouses =
            "WoodHouse1,WoodHouse2,WoodHouse3,WoodHouse5,WoodHouse6,WoodHouse7,WoodHouse9,WoodHouse10,WoodHouse11,WoodHouse13";

        public static readonly Culture Meadows = new Culture("Meadows", new Dictionary<Role, string[]>
        {
            [Role.Hub] = new[] { "MWL_MeadowsTavern1", "WoodHouse2" },
            [Role.House] = new[] { VanillaHouses + ",MWL_MeadowsHouse2,MWL_SmallMeadowHouse1,MWL_OakHut1,MWL_SmallHouse1" },
            [Role.Workshop] = new[] { "MWL_MeadowsSawmill1,MWL_ForestForge2:0.5" },
            [Role.Farm] = new[] { "MWL_MeadowsFarm1,MWL_MeadowsBarn1,WoodHouse8:0.5,MWL_MaypoleHut1:0.3", "WoodHouse8" },
        });

        public static readonly Culture BlackForest = new Culture("Black Forest", new Dictionary<Role, string[]>
        {
            [Role.Hub] = new[] { "MWL_Tavern1", "WoodHouse11" },
            [Role.House] = new[] { "MWL_ForestHouse2,MWL_ForestGreatHouse2:0.6,WoodHouse3:0.5,WoodHouse7:0.5,WoodHouse11:0.5" },
            [Role.Workshop] = new[] { "MWL_ForestForge1,MWL_ForestForge2,MWL_BlackForestBlacksmith1,MWL_WoodTower1:0.5" },
            [Role.Farm] = new[] { "MWL_ForestCamp1,MWL_WoodTower2:0.5", "WoodHouse8" },
        });

        public readonly string Name;
        private readonly Dictionary<Role, string[]> _tiers;

        private Culture(string name, Dictionary<Role, string[]> tiers)
        {
            Name = name;
            _tiers = tiers;
        }

        public static Culture For(Heightmap.Biome biome) => biome == Heightmap.Biome.BlackForest ? BlackForest : Meadows;

        /// <summary>
        /// The design tiers for a role in a village of this biome and culture: the culture's own sets first (from
        /// Cultures/cultures.txt, "designs.house = ..."), then the biome's. A culture with no designs of its own, or
        /// whose designs are missing or need materials the biome lacks, builds from the biome's set.
        /// </summary>
        public static IEnumerable<string> TiersFor(Heightmap.Biome biome, string culture, Role role)
        {
            foreach (string tier in Village.Cultures.DesignTiers(culture, role))
            {
                yield return tier;
            }

            foreach (string tier in For(biome).Tiers(role))
            {
                yield return tier;
            }
        }

        /// <summary>The role of the building with this index in the village (0 is the first building).</summary>
        public static Role RoleFor(int index)
        {
            if (index < Plan.Length)
            {
                return Plan[index];
            }

            // Past the plan, mostly homes with a workshop or farm now and then.
            int cycle = (index - Plan.Length) % 4;
            return cycle == 3 ? (index % 8 == 3 ? Role.Workshop : Role.Farm) : Role.House;
        }

        public IEnumerable<string> Tiers(Role role)
        {
            return _tiers.TryGetValue(role, out string[] tiers) ? tiers : new string[0];
        }
    }
}
