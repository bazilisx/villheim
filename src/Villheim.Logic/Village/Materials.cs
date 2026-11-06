using System.Collections.Generic;

namespace Villheim.Logic.Village
{
    /// <summary>
    /// The building materials villages gather and spend. Other ingredients in a piece's vanilla recipe
    /// (resin, leather, metal) are not tracked, so they cost nothing for now.
    /// </summary>
    internal static class Materials
    {
        public const string Wood = "Wood";
        public const string FineWood = "FineWood";
        public const string CoreWood = "RoundLog";
        public const string Stone = "Stone";

        public static readonly HashSet<string> Tracked = new HashSet<string> { Wood, FineWood, CoreWood, Stone };
        public static readonly HashSet<string> WoodTypes = new HashSet<string> { Wood, FineWood, CoreWood };

        public static string Label(string material)
        {
            switch (material)
            {
                case Wood: return "wood";
                case FineWood: return "fine wood";
                case CoreWood: return "core wood";
                case Stone: return "stone";
                default: return material.ToLowerInvariant();
            }
        }
    }
}
