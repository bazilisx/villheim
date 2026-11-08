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
        public static ConfigEntry<float> VillagerToolStrength;
        public static ConfigEntry<bool> VillagerTrading;
        public static ConfigEntry<bool> WaitBetweenBuildings;
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
        public static ConfigEntry<string> GalleryNumberText;
        public static ConfigEntry<KeyboardShortcut> GallerySwapKey;
        public static ConfigEntry<string> GallerySwapBiomes;
        public static ConfigEntry<string> ShapingTool;
        public static ConfigEntry<string> SortToolA;
        public static ConfigEntry<string> SortToolB;
        public static ConfigEntry<string> SortToolB2;
        public static ConfigEntry<string> SortSheetUrl;
        public static ConfigEntry<bool> SortHideSorted;
        public static ConfigEntry<string> SlotPathMarker;
        public static ConfigEntry<string> SlotDoorMarker;
        public static ConfigEntry<string> ShaperHandEffect;
        public static ConfigEntry<string> ShaperGroundEffect;
        public static ConfigEntry<UnityEngine.Color> ShaperColor;
        public static ConfigEntry<UnityEngine.Color> LookColor;
        public static ConfigEntry<float> ShaperEffectScale;
        public static ConfigEntry<float> ShaperEffectStrength;
        public static ConfigEntry<bool> ShaperEffectBursts;
        public static ConfigEntry<float> ShaperEffectBurstScale;
        public static ConfigEntry<float> ShaperTurnStep;
        public static ConfigEntry<bool> ShaperEffectTint;
        public static ConfigEntry<bool> WorldLife;
        public static ConfigEntry<bool> SmithMakesGear;
        public static ConfigEntry<bool> Outposts;
        public static ConfigEntry<bool> Trails;
        public static ConfigEntry<bool> TrailSigns;
        public static ConfigEntry<string> OutpostGear;
        public static ConfigEntry<bool> VillageEvents;
        public static ConfigEntry<bool> Caravans;
        public static ConfigEntry<bool> Daughters;
        public static ConfigEntry<int> DaughtersPerVillage;
        public static ConfigEntry<float> DaughterChancePerDay;
        public static ConfigEntry<float> CaravanChancePerDay;
        public static ConfigEntry<float> CaravanMetresPerDay;
        public static ConfigEntry<float> CaravanReach;
        public static ConfigEntry<float> EventChancePerDay;
        public static ConfigEntry<bool> OutpostMaterials;
        public static ConfigEntry<int> OutpostsPerVillage;
        public static ConfigEntry<int> OutpostCarryAt;
        public static ConfigEntry<float> VisitorChancePerDay;
        public static ConfigEntry<float> DaysBetweenVisitors;
        public static ConfigEntry<int> HermitChance;
        public static ConfigEntry<string> HermitPlaces;
        public static ConfigEntry<string> HermitBiomes;

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
            WaitBetweenBuildings = Admin(config, work, "WaitBetweenBuildings", false,
                "Off: like a player, a village starts its next building as soon as it has settled in (beds, workbench, " +
                "cooking station, sign and notice board) and has the materials. On: it also waits DaysPerBuilding " +
                "between buildings, the old pace.");
            VillagerTrading = Admin(config, work, "VillagerTrading", false,
                "Off for now. When on, Shift + Use on a villager opens the village's store (what its chest can spare).");
            SmithMakesGear = Admin(config, work, "SmithMakesGear", true,
                "Villagers make their own gear: clothes and weapons only go up a tier once the smith has made that tier's " +
                "set at the right station from what is in the chest (or the village has bought it from a pedlar). Off: " +
                "gear follows the village's size alone, as before.");
            VillagerToolStrength = Admin(config, work, "VillagerToolStrength", 0.45f,
                "How hard villagers' axe and pickaxe blows land against the tool's full damage. A player's blows are scaled " +
                "by his skill; 0.45 makes a villager about as quick as a player with modest skill.");
            FoodHealing = Admin(config, work, "FoodHealing", 1f,
                "Villagers heal like players: each food in effect heals its own regen value every 10 seconds for the " +
                "food's duration. This multiplies that healing.");
            // Raids are paused (Tyler, 2026-11-06): a new key, off by default, so a config file written while they
            // were on doesn't keep them on.
            VillageRaids = Admin(config, work, "RaidsEnabled", false,
                "Off for now. When on, villages with three or more villagers are now and then raided by greydwarfs at " +
                "night, warned of at dusk, only while a player is in the village.");
            const string life = "5 - World life";
            WorldLife = Admin(config, life, "WorldLife", false,
                "Off for now, while designs are reviewed. When on, pedlars and pilgrims visit villages (bringing news from " +
                "other villages, and a pedlar trading with the village chest), and hermits keep camps by some ruins and " +
                "abandoned houses. 'vh pedlar', 'vh pilgrim' and 'vh hermit' work either way, for testing.");
            Outposts = Admin(config, life, "Outposts", true,
                "With WorldLife on, a village of four buildings and four villagers founds camps where the land gives what " +
                "home lacks: a logging camp in the other wood biome (Black Forest core wood for a Meadows village, Meadows " +
                "fine wood for a Black Forest one), and a flint camp on the shore while its smith needs flint. Campers " +
                "carry the loads home.");
            OutpostGear = Admin(config, life, "OutpostGear", Village.Outposts.DefaultGear,
                "Gear tier a village must have made before its people go out to a camp in that biome (0 rags, 1 leather, " +
                "2 flint and leather, 3 troll leather, 4 bronze). Biome: tier, separated by semicolons.");
            OutpostMaterials = Admin(config, life, "OutpostMaterials", true,
                "What an outpost sends home counts toward what the village can build: a Meadows village with a logging " +
                "camp in the Black Forest builds designs that need core wood.");
            VillageEvents = Admin(config, life, "VillageEvents", true,
                "With WorldLife on, once a day something may happen in a village: a feast, a visiting skald, a market day, " +
                "a lost traveller taken in, a fever, beasts at night, a quarrel, a falling-out with the neighbours.");
            EventChancePerDay = Admin(config, life, "EventChancePerDay", 0.35f,
                "Chance that something happens in a village on a given day (0 to 1).");
            Caravans = Admin(config, life, "Caravans", true,
                "With WorldLife on, villages send what they can spare to villages that lack it, along their trails. The " +
                "caravan moves on the world clock and is a real person walking the road when you are near it.");
            CaravanChancePerDay = Admin(config, life, "CaravanChancePerDay", 0.3f,
                "Chance that a village sends a trade caravan on a given day (0 to 1), when it has something to spare.");
            CaravanMetresPerDay = Admin(config, life, "CaravanMetresPerDay", 2400f,
                "How far a caravan, a haul or a party of settlers goes in an in-game day.");
            CaravanReach = Admin(config, life, "CaravanReach", 2500f,
                "Villages farther apart than this (metres) do not send each other caravans.");
            OutpostsPerVillage = Admin(config, life, "OutpostsPerVillage", 2,
                "Most camps a village keeps: a logging camp in the other wood biome, and a flint camp on the shore while " +
                "its smith needs flint.");
            OutpostCarryAt = Admin(config, life, "OutpostCarryAt", 12,
                "A camp sends its load home (a camper walks it along the trail) once it has gathered this much.");
            Daughters = Admin(config, life, "Daughters", true,
                "With WorldLife on, a full village (MaxVillagers or MaxBuildings) now and then sends two of its people to " +
                "found a village of their own 600 to 1,200 m away. Its hearth is lit when you first come near the site.");
            DaughtersPerVillage = Admin(config, life, "DaughtersPerVillage", 2,
                "Most daughter villages one village founds.");
            DaughterChancePerDay = Admin(config, life, "DaughterChancePerDay", 0.25f,
                "Chance a full village sends settlers on a given day (0 to 1), at most one party every ten days.");
            Trails = Admin(config, life, "Trails", true,
                "With WorldLife on, villages plan a dirt trail to their outpost and to their nearest neighbour within " +
                "2,500 m, painted on the ground near you as you walk it.");
            TrailSigns = Admin(config, life, "TrailSigns", true,
                "With Trails on, wooden signposts where a trail leaves a village (where it goes and how far) and halfway " +
                "along trails longer than 600 m.");
            VisitorChancePerDay = Admin(config, life, "VisitorChancePerDay", 0.5f,
                "Chance that a pedlar or pilgrim comes to a village on a day you spend there (0 to 1).");
            DaysBetweenVisitors = Admin(config, life, "DaysBetweenVisitors", 1f,
                "At least this many in-game days between two visitors to the same village.");
            HermitChance = Admin(config, life, "HermitChance", 30,
                "Percent of the places in HermitPlaces that have a hermit's camp by them (picked by position, the same on " +
                "every machine). 0 for no hermits.");
            HermitPlaces = Admin(config, life, "HermitPlaces", "WoodHouse,AbandonedLogCabin,StoneHouse,Ruin,ShipSetting",
                "Location names (the start of the name is enough) that hermits camp beside.");
            HermitBiomes = Admin(config, life, "HermitBiomes", "Meadows,BlackForest,Mountain",
                "Biomes where hermits camp.");

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
                "How solid villagers are at night, 1 for fully solid. Below 1 uses a see-through shader borrowed from the game's ghosts; " +
                "lower is fainter, down to barely visible near 0. The step from 0.99 to 1 is a jump to fully solid.");
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
            GalleryNumberText = Admin(config, "4 - Design review", "GalleryNumberText", "<#fff><voffset=100><size=12>{0}",
                "Text of the big number floating over each gallery sign ({0} is the design's number in design-list.csv). " +
                "Raise voffset to lift it, size to make it bigger; takes effect on the next gallery page.");
            GallerySwapKey = Admin(config, "4 - Design review", "GallerySwapKey", new KeyboardShortcut(UnityEngine.KeyCode.Keypad5),
                "With 'vh swap' on: press while aiming at a piece of a gallery design to pick it, then at a stand-in to use it. " +
                "Numpad 5 by default, in the middle of the numpad keys that move designs.");

            // Middle mouse was the first default, but with the hammer in hand it removes the piece aimed at (2026-11-07).
            if (GallerySwapKey.Value.MainKey == UnityEngine.KeyCode.Mouse2)
            {
                GallerySwapKey.Value = new KeyboardShortcut(UnityEngine.KeyCode.Keypad5);
            }

            ShapingTool = Admin(config, "4 - Design review", "ShapingTool", "KnifeWood",
                "The item that is the shaping tool: with it in hand, hotbar 1 to 8 edit gallery designs ('vh tool' gives one). " +
                "Any item's prefab name works; the wooden knife by default (it glows teal while shaping).");

            ShaperHandEffect = config.Bind("4 - Design review", "ShaperHandEffect", "Lightning", new ConfigDescription(
                "How the Villheim Dev Shaper Tool looks in hand while shaping. Changes show at once.",
                new AcceptableValueList<string>(Village.ShaperEffects.HandChoices), new ConfigurationManagerAttributes { IsAdminOnly = true }));
            ShaperGroundEffect = config.Bind("4 - Design review", "ShaperGroundEffect", "Beam and Glow", new ConfigDescription(
                "How the Villheim Dev Shaper Tool looks lying on the ground. Changes show at once.",
                new AcceptableValueList<string>(Village.ShaperEffects.GroundChoices), new ConfigurationManagerAttributes { IsAdminOnly = true }));
            ShaperColor = Admin(config, "4 - Design review", "ShaperColor", new UnityEngine.Color(0.102f, 0.851f, 0.749f),
                "Colour of the Shaper Tool's Glow and Beam, and the tint of its icon.");

            ShaperEffectScale = config.Bind("4 - Design review", "ShaperEffectScale", 0.205f, new ConfigDescription(
                "Size of the Fire, Frost, Spirit and Lightning effects on the Shaper Tool, against the weapon they come from. Changes show at once.",
                new AcceptableValueRange<float>(0.05f, 1.5f), new ConfigurationManagerAttributes { IsAdminOnly = true }));
            ShaperEffectStrength = config.Bind("4 - Design review", "ShaperEffectStrength", 0.561f, new ConfigDescription(
                "How busy and bright those effects are: fewer, fainter particles below 1. Changes show at once.",
                new AcceptableValueRange<float>(0.05f, 1f), new ConfigurationManagerAttributes { IsAdminOnly = true }));
            ShaperEffectBursts = Admin(config, "4 - Design review", "ShaperEffectBursts", true,
                "Keep the effects' periodic bursts (the big lightning blasts). Off: only the steady small sparks.");
            ShaperEffectBurstScale = config.Bind("4 - Design review", "ShaperEffectBurstScale", 0.592f, new ConfigDescription(
                "With ShaperEffectBursts on: size, speed and reach of the bursts (the zaps), on top of ShaperEffectScale. 1 leaves them as the weapon has them. Changes show at once.",
                new AcceptableValueRange<float>(0.02f, 1.5f), new ConfigurationManagerAttributes { IsAdminOnly = true }));
            ShaperTurnStep = config.Bind("4 - Design review", "ShaperTurnStep", 22.5f, new ConfigDescription(
                "Degrees per mouse wheel notch when turning an object with the Shaper Tool (Turn, key 2).",
                new AcceptableValueRange<float>(1f, 90f), new ConfigurationManagerAttributes { IsAdminOnly = true }));
            ShaperEffectTint = Admin(config, "4 - Design review", "ShaperEffectTint", true,
                "Recolour the effects to ShaperColor (teal lightning). Off: their own colours.");
            LookColor = Admin(config, "4 - Design review", "LookColor", new UnityEngine.Color(0.129f, 0.447f, 0.396f, 0.118f),
                "Glow of the object you aim at while shaping (and of Delete all's marks). Darker is subtler; changes show on the next object you aim at.");

            // The fishing rod was the first default (2026-11-07); Tyler chose the wooden knife.
            if (ShapingTool.Value == "FishingRod")
            {
                ShapingTool.Value = "KnifeWood";
            }
            GallerySwapBiomes = Admin(config, "4 - Design review", "GallerySwapBiomes", "meadows,blackforest,swamp",
                "Which biomes 'vh swap' offers stand-ins from, one group each in front of the design's sign " +
                "(meadows, blackforest, swamp, mountain, plains, mistlands, ashlands).");
            SortToolA = Admin(config, "4 - Design review", "SortToolA", "KnifeFlint",
                "The item that is sort tool A (phase A, type: home, work, community, drop). 'vh sort tools' gives one.");
            SortToolB = Admin(config, "4 - Design review", "SortToolB", "KnifeCopper",
                "The item that is sort tool B (phase B, subtype of work and community designs). 'vh sort tools' gives one.");
            SortToolB2 = Admin(config, "4 - Design review", "SortToolB2", "KnifeChitin",
                "The item that is sort tool B2 (phase B2: work designs sorted as Crafting get a trade). 'vh sort tools' gives one.");
            SortSheetUrl = Admin(config, "4 - Design review", "SortSheetUrl", "",
                "Web app address of the review sheet's script (Deploy, Web app). Every sort choice is sent there as it is made. Empty: kept in design-sort.csv only.");
            SlotPathMarker = Admin(config, "4 - Design review", "SlotPathMarker", "piece_bpsnappoint",
                "An object that marks \"connect roads and paths here\" on the slotting board (saved as a marker, not a piece; the road leaves it away from the design's middle). Default: PlanBuild's snap point marker. 'vh slot marker' sets it from what you aim at.");
            SlotDoorMarker = Admin(config, "4 - Design review", "SlotDoorMarker", "piece_bpcenterpoint",
                "A second object that also marks \"connect roads and paths here\". Default: PlanBuild's center point marker.");
            SortHideSorted = Admin(config, "4 - Design review", "SortHideSorted", true,
                "A design leaves the field once it is sorted for the knife's phase (undo brings it back), and keepers pages leave out designs that already have a type. Off: everything stays.");
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
