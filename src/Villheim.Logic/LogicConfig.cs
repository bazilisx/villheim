using BepInEx.Configuration;
using Villheim.Logic.Village;

namespace Villheim.Logic
{
    /// <summary>
    /// Settings added by the logic assembly. They live in the same config file as the core's settings, so they can be
    /// added or changed without restarting the game.
    /// </summary>
    internal static class LogicConfig
    {
        public static ConfigEntry<string> BiomeMaterials;
        public static ConfigEntry<bool> SiteChest;
        public static ConfigEntry<float> SecondsPerPiece;
        public static ConfigEntry<int> StartingStock;
        public static ConfigEntry<float> FoodHealing;
        public static ConfigEntry<bool> VillageRaids;
        public static ConfigEntry<int> VillageChance;
        public static ConfigEntry<float> VillageSpacing;
        public static ConfigEntry<float> GhostAlphaDay;
        public static ConfigEntry<float> GhostTintDay;
        public static ConfigEntry<float> GhostGlowDay;
        public static ConfigEntry<UnityEngine.Color> GhostColor;
        public static ConfigEntry<UnityEngine.Color> GhostGlowColor;
        public static ConfigEntry<bool> GhostLook;
        public static ConfigEntry<bool> GhostApplyNow;
        public static ConfigEntry<string> HearthGroundPaint;
        public static ConfigEntry<float> GhostAlpha;
        public static ConfigEntry<float> GhostTint;
        public static ConfigEntry<float> GhostGlow;
        public static ConfigEntry<float> RaidChance;

        public static void Bind()
        {
            ConfigFile config = VillheimPlugin.Instance?.Config;
            if (config == null)
            {
                return;
            }

            const string work = "3b - Work and resources";
            BiomeMaterials = Admin(config, work, "BiomeMaterials", Materials.DefaultBiomeMaterials,
                "Which building materials can be found in each biome. A village only builds designs that can be made " +
                "from its own biome's materials, so a Meadows village never needs core wood.");
            SiteChest = Admin(config, work, "SiteChest", true,
                "Give each village a chest by its hearth. Villagers bring materials to it and the builder takes from it. " +
                "Anything you drop in helps the village build. If it is destroyed, the villagers build a new one first.");
            SecondsPerPiece = Admin(config, work, "SecondsPerPiece", 2.5f,
                "How long a builder hammers at each piece before it goes up.");
            StartingStock = Admin(config, work, "StartingStock", 0,
                "Wood a new village starts with (and half as much stone). At 0 the villagers gather everything " +
                "for their first building themselves.");
            FoodHealing = Admin(config, work, "FoodHealing", 1f,
                "Villagers heal like players: each food in effect heals its own regen value every 10 seconds for the " +
                "food's duration. This multiplies that healing.");
            // Raids are paused (Tyler, 2026-11-06): a new key, off by default, so a config file written while they
            // were on doesn't keep them on.
            VillageRaids = Admin(config, work, "RaidsEnabled", false,
                "Off for now. When on, villages with three or more villagers are now and then raided by greydwarfs at " +
                "night, warned of at dusk, only while a player is in the village.");
            const string sites = "1b - Village sites";
            VillageChance = Admin(config, sites, "VillageChance", 50,
                "Percent of generated village sites that become villages, so villages stay a rare find. Sites lit with " +
                "the settle command always do.");
            VillageSpacing = Admin(config, sites, "VillageSpacing", 1500f,
                "No two generated villages closer than this (metres). Villages also keep 400 m from traders and ports.");

            const string looks = "3c - Villager looks";
            GhostLook = Admin(config, looks, "GhostLook", true,
                "Villagers look like echoes of the living world: a little see-through, faintly teal, with a faint glow after " +
                "dark. Only villagers are changed, never players. Off restores the normal look.");
            GhostAlpha = Admin(config, looks, "GhostAlpha", 0.8f,
                "How solid villagers are at night, 1 for fully solid. Below 1 uses a see-through shader borrowed from the game's ghosts.");
            GhostTint = Admin(config, looks, "GhostTint", 0.15f, "How strongly villagers are tinted toward teal at night, 0 for none.");
            GhostGlow = Admin(config, looks, "GhostGlow", 0.25f, "How much villagers glow in the dark hours, 0 for none.");
            GhostAlphaDay = Admin(config, looks, "GhostAlphaDay", 0.93f,
                "How solid villagers are by day (GhostAlpha is the night value; dusk and dawn blend the two).");
            GhostTintDay = Admin(config, looks, "GhostTintDay", 0.5f, "How teal villagers are by day (GhostTint is the night value).");
            GhostColor = Admin(config, looks, "GhostColor", new UnityEngine.Color(0.55f, 0.85f, 1f),
                "The colour villagers are tinted toward (the tint settings say how strongly). Teal by default.");
            GhostGlowColor = Admin(config, looks, "GhostGlowColor", new UnityEngine.Color(0.25f, 0.6f, 0.75f),
                "The colour of the glow (the glow settings say how strongly).");
            GhostApplyNow = Admin(config, looks, "GhostApplyNow", false,
                "Switch on to put the look settings on every villager and animal at once; it switches itself off again. " +
                "(Every change to a look setting is also applied at once on its own.)");
            HearthGroundPaint = Admin(config, sites, "HearthGroundPaint", "Both",
                "How the ground around a new hearth is cleared: ClearVegetation (grass taken off, ground keeps its colour), " +
                "Dirt (bare earth, like a path), or Both (bare earth 5 m round the fire, grass cleared out to 12 m).");
            GhostGlowDay = Admin(config, looks, "GhostGlowDay", 0.08f,
                "A faint teal glow by day, so villagers read teal rather than white in sunlight (GhostGlow is the night value).");
            RaidChance = Admin(config, work, "RaidChance", 0.2f,
                "Chance each dusk of a raid (plus 3% per village tier), never two nights running.");
            WatchLooks();
        }

        /// <summary>Every look setting puts itself on the ghosts the moment it changes.</summary>
        private static void WatchLooks()
        {
            foreach (ConfigEntryBase entry in new ConfigEntryBase[]
                     {
                         GhostLook, GhostAlpha, GhostTint, GhostGlow, GhostAlphaDay, GhostTintDay, GhostGlowDay, GhostColor, GhostGlowColor,
                     })
            {
                if (entry is ConfigEntry<float> f) f.SettingChanged += (_, __) => Villagers.GhostLook.ApplyNow();
                else if (entry is ConfigEntry<bool> b) b.SettingChanged += (_, __) => Villagers.GhostLook.ApplyNow();
                else if (entry is ConfigEntry<UnityEngine.Color> c) c.SettingChanged += (_, __) => Villagers.GhostLook.ApplyNow();
            }

            GhostApplyNow.SettingChanged += (_, __) =>
            {
                if (GhostApplyNow.Value)
                {
                    Villagers.GhostLook.ApplyNow();
                    GhostApplyNow.Value = false;
                }
            };
        }

        private static ConfigEntry<T> Admin<T>(ConfigFile config, string section, string key, T value, string description)
        {
            var attributes = new ConfigurationManagerAttributes { IsAdminOnly = true };
            return config.Bind(section, key, value, new ConfigDescription(description, null, attributes));
        }
    }
}
