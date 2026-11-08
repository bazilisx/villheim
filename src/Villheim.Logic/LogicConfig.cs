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
        public static ConfigEntry<bool> CaravanDeliveries;
        public static ConfigEntry<bool> BroughtMaterials;
        public static ConfigEntry<bool> Daughters;
        public static ConfigEntry<bool> Contracts;
        public static ConfigEntry<bool> Groves;
        public static ConfigEntry<int> GroveTrees;
        public static ConfigEntry<float> ContractChancePerDay;
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
        public static ConfigEntry<bool> PlayerMemory;
        public static ConfigEntry<bool> VillagerSkills;
        public static ConfigEntry<bool> VillagerWants;
        public static ConfigEntry<bool> Gatherings;
        public static ConfigEntry<bool> Noticing;
        public static ConfigEntry<bool> IdleGlances;
        public static ConfigEntry<bool> SurroundingsTags;
        public static ConfigEntry<bool> TopicFatigue;
        public static ConfigEntry<bool> ChatScenes;
        public static ConfigEntry<int> FeastPieces;
        public static ConfigEntry<bool> EventFever;

        /// <summary>True when the setting is on, or not bound yet (every system defaults to on).</summary>
        public static bool IsOn(ConfigEntry<bool> entry) => entry == null || entry.Value;
        public static ConfigEntry<bool> Prosperity;
        public static ConfigEntry<int> ProsperityRaidsFrom;
        public static ConfigEntry<bool> Expectations;
        public static ConfigEntry<string> ExpectationBonus;
        public static ConfigEntry<bool> Calendar;
        public static ConfigEntry<int> DaysPerSeason;
        public static ConfigEntry<int> FestivalDay;
        public static ConfigEntry<bool> ReadSeasonsMod;
        public static ConfigEntry<bool> Festivals;
        public static ConfigEntry<bool> WinterStores;
        public static ConfigEntry<bool> PlayerStanding;
        public static ConfigEntry<bool> Hostility;
        public static ConfigEntry<int> EmptyVillageReturnDays;
        public static ConfigEntry<int> FineBelow;
        public static ConfigEntry<int> GuardBelow;
        public static ConfigEntry<int> ForgivePerDay;
        public static ConfigEntry<bool> Complaints;
        public static ConfigEntry<int> ComplainAfterDays;
        public static ConfigEntry<int> DemandAfterDays;
        public static ConfigEntry<int> LeaveAfterDays;
        public static ConfigEntry<bool> Leaving;
        public static ConfigEntry<int> ExodusMood;
        public static ConfigEntry<int> ExodusDays;
        public static ConfigEntry<bool> VisitorJudging;
        public static ConfigEntry<bool> WantPile;
        public static ConfigEntry<bool> BossStages;
        public static ConfigEntry<int> BossStageStart;
        public static ConfigEntry<string> BossStageSource;
        public static ConfigEntry<bool> Elders;
        public static ConfigEntry<int> ElderDays;
        public static ConfigEntry<bool> ElderDeaths;
        public static ConfigEntry<int> ElderDeathDays;
        public static ConfigEntry<float> ElderDeathChance;
        public static ConfigEntry<bool> Neighbours;
        public static ConfigEntry<bool> Horn;
        public static ConfigEntry<float> HornSeconds;
        public static ConfigEntry<bool> HelpPlayers;
        public static ConfigEntry<bool> VillageKnowledge;
        public static ConfigEntry<string> KnowledgeReach;
        public static ConfigEntry<float> KnowledgeReachPerGear;
        public static ConfigEntry<float> KnowledgeReachGrowth;
        public static ConfigEntry<bool> KnowledgeGearGate;
        public static ConfigEntry<string> KnowledgeGear;
        public static ConfigEntry<float> KnowledgeWitness;
        public static ConfigEntry<float> KnowledgeSight;
        public static ConfigEntry<int> KnowledgeKeep;
        public static ConfigEntry<int> KnowledgeCommonDays;
        public static ConfigEntry<float> RumourChance;
        public static ConfigEntry<bool> KnowledgeRequests;
        public static ConfigEntry<bool> HarvestReach;
        public static ConfigEntry<string> HarvestReachByStage;
        public static ConfigEntry<float> HarvestReachMax;
        public static ConfigEntry<bool> MapTable;
        public static ConfigEntry<int> MapTableFromStage;

        // Cultures (Village/Cultures.cs) and biome defenders (Villagers/Defenders.cs).
        public static ConfigEntry<bool> Cultures;
        public static ConfigEntry<string> CultureMap;
        public static ConfigEntry<float> CultureForeignChance;
        public static ConfigEntry<float> LooksOutlierChance;
        public static ConfigEntry<bool> CultureSurnames;
        public static ConfigEntry<bool> CultureDesigns;
        public static ConfigEntry<bool> BiomeDefenders;
        public static ConfigEntry<bool> DefenderCarers;
        public static ConfigEntry<float> DefenderRange;
        public static ConfigEntry<float> DefenderShotSeconds;
        public static ConfigEntry<float> DefenderLead;
        public static ConfigEntry<bool> DefenderBowAnimation;
        public static ConfigEntry<bool> PlainsDefenders;
        public static ConfigEntry<string> PlainsDefenderBiomes;
        public static ConfigEntry<float> PlainsDefenderReach;
        public static ConfigEntry<string> PlainsDefenderTargets;
        public static ConfigEntry<float> PlainsDefenderDamage;
        public static ConfigEntry<float> PlainsDefenderSpread;
        public static ConfigEntry<float> PlainsDefenderReaction;
        public static ConfigEntry<bool> MistlandsDefenders;
        public static ConfigEntry<string> MistlandsDefenderBiomes;
        public static ConfigEntry<float> MistlandsDefenderReach;
        public static ConfigEntry<string> MistlandsDefenderTargets;
        public static ConfigEntry<float> MistlandsDefenderDamage;
        public static ConfigEntry<float> MistlandsDefenderSpread;
        public static ConfigEntry<float> MistlandsDefenderReaction;

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
            BroughtMaterials = Admin(config, work, "BroughtMaterials", true,
                "Anything brought into the village counts toward what it can build, whoever brought it: a design that " +
                "needs a material the biome does not give (core wood in the Meadows) can go up once the village's chests " +
                "hold all of it the design needs. Villagers still only gather what their own land gives.");
            OutpostMaterials = Admin(config, life, "OutpostMaterials", true,
                "What an outpost sends home counts toward what the village can build: a Meadows village with a logging " +
                "camp in the Black Forest builds designs that need core wood.");
            VillageEvents = Admin(config, life, "VillageEvents", true,
                "With WorldLife on, once a day something may happen in a village: a feast, a visiting skald, a market day, " +
                "a lost traveller taken in, a fever, beasts at night, a quarrel, a falling-out with the neighbours.");
            EventChancePerDay = Admin(config, life, "EventChancePerDay", 0.35f,
                "Chance that something happens in a village on a given day (0 to 1).");
            Caravans = Admin(config, life, "Caravans", true,
                "With WorldLife on, traders travel the trails between villages, and outpost loads are carried home. A " +
                "caravan moves on the world clock and is a real person walking the road when you are near it; Shift + Use " +
                "on a trader opens his pack (his own wares, for coins).");
            // Caravans no longer move goods between villages (Tyler, 2026-11-08, D-008).
            CaravanDeliveries = Admin(config, life, "CaravanDeliveries", false,
                "Off: a trader on the trail carries his own pack and nothing from a village chest. On (old behaviour): " +
                "villages send what they can spare to villages that lack it.");
            CaravanChancePerDay = Admin(config, life, "CaravanChancePerDay", 0.3f,
                "Chance that a village sends a trader down the trail on a given day (0 to 1).");
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
            Contracts = Admin(config, life, "Contracts", true,
                "With WorldLife on, a village puts up a notice for what its own people cannot get (flint or hides for the " +
                "smith, a material its biome lacks), paid in coins or spare goods when you bring it to the chest.");
            ContractChancePerDay = Admin(config, life, "ContractChancePerDay", 0.5f,
                "Chance a village with nothing posted puts up a contract on a given day (0 to 1).");
            Groves = Admin(config, life, "Groves", true,
                "With WorldLife on, a village of four or more buildings with few trees left round it plants extra saplings " +
                "(three a day) for later harvests.");
            GroveTrees = Admin(config, life, "GroveTrees", 25,
                "Standing trees within 60 m of a village's edge it wants to keep; below this it plants more.");
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

            EventFever = Admin(config, life, "EventFever", true,
                "With VillageEvents on, a fever is one of the bad events: one villager loses a third of their health and " +
                "rests it off. Off: no fevers.");

            const string minds = "5b - Villager minds";
            PlayerMemory = Admin(config, minds, "PlayerMemory", true,
                "Each village remembers what you do there (visits, gifts, building, kills, deaths, hurting its people) and " +
                "villagers who saw it tell the others. Off: nothing new is remembered and villagers do not mention it.");
            VillagerSkills = Admin(config, minds, "VillagerSkills", true,
                "Villagers get better at what they do (woodcutting, mining, building and six more), which makes them work " +
                "faster. Off: no practice, and everyone works at the plain speed.");
            VillagerWants = Admin(config, minds, "VillagerWants", true,
                "Each villager wants something for a few days (a bed, a feast, to court a friend, to make peace...) and " +
                "is glad when it comes. Off: no new wants and no sweethearts.");
            Gatherings = Admin(config, minds, "Gatherings", true,
                "The village turns out for a big finished building, a newcomer or a pedlar, feasts on good days and hears the " +
                "evening words at the hearth. Off: a few villagers come to look, as before.");
            Noticing = Admin(config, minds, "Noticing", true,
                "Villagers remark on the weather turning, dawn and dusk, a boss felled, animals and enemies in sight, and " +
                "your drawn weapon or sneaking. Off: they don't.");
            IdleGlances = Admin(config, minds, "IdleGlances", true,
                "Villagers standing about glance at whoever talks, at you, at animals, the sky and the fire, and make " +
                "small gestures. Off: they stand still.");
            SurroundingsTags = Admin(config, minds, "SurroundingsTags", true,
                "Lines can fit where a villager stands, the sky, bosses down, creatures in sight and what you wear and " +
                "carry. Off: those lines are not picked.");
            TopicFatigue = Admin(config, minds, "TopicFatigue", true,
                "A topic you have heard a lot of lately is picked less often. Off: every line keeps its weight.");
            FeastPieces = Admin(config, minds, "FeastPieces", 150,
                "A finished building makes the evening a feast when it is a hall, a new home, or has at least this many " +
                "pieces. Smaller ones (sheds, pens, rebuilt homes under this size) get a short look from a few villagers.");
            ChatScenes = Admin(config, minds, "ChatScenes", true,
                "Chats between villagers fit the pair (friend, rival, sweetheart, trade), pass on what they know of you, " +
                "and get answers in each one's own voice and a third villager chiming in. Off: plain chats, as before.");
            BindLiving(config);
            BindKnowledge(config);
            BindCultures(config);

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

        /// <summary>
        /// The on/off settings for the systems added on 2026-11-07 and 2026-11-08, for 'vh switches' and the help
        /// text. World systems also need WorldLife on.
        /// </summary>
        public static (string Name, ConfigEntry<bool> Entry)[] Switches => new[]
        {
            ("WorldLife", WorldLife), ("Outposts", Outposts), ("Trails", Trails), ("TrailSigns", TrailSigns),
            ("VillageEvents", VillageEvents), ("EventFever", EventFever), ("Caravans", Caravans), ("Daughters", Daughters),
            ("Contracts", Contracts), ("Groves", Groves), ("PlayerMemory", PlayerMemory), ("VillagerSkills", VillagerSkills),
            ("VillagerWants", VillagerWants), ("Gatherings", Gatherings), ("Noticing", Noticing), ("IdleGlances", IdleGlances),
            ("SurroundingsTags", SurroundingsTags), ("TopicFatigue", TopicFatigue), ("ChatScenes", ChatScenes),
            ("Prosperity", Prosperity), ("Expectations", Expectations), ("Calendar", Calendar), ("Festivals", Festivals),
            ("WinterStores", WinterStores), ("PlayerStanding", PlayerStanding), ("Hostility", Hostility), ("Complaints", Complaints), ("VillagersLeave", Leaving),
            ("VisitorJudging", VisitorJudging), ("WantPile", WantPile), ("BossStageCap", BossStages), ("Elders", Elders),
            ("EldersDieOfAge", ElderDeaths), ("Neighbours", Neighbours), ("Horn", Horn), ("HelpPlayers", HelpPlayers),
            ("VillageKnowledge", VillageKnowledge), ("KnowledgeGearGate", KnowledgeGearGate), ("KnowledgeRequests", KnowledgeRequests),
            ("HarvestReach", HarvestReach), ("MapTable", MapTable),
            ("Cultures", Cultures), ("CultureSurnames", CultureSurnames), ("CultureDesigns", CultureDesigns),
            ("BiomeDefenders", BiomeDefenders), ("PlainsDefenders", PlainsDefenders), ("MistlandsDefenders", MistlandsDefenders),
            ("DefenderCarers", DefenderCarers), ("DefenderBowAnimation", DefenderBowAnimation),
        };

        // The config entries outlive a logic build (the config file hands back the same entry on every Bind), so the
        // handlers this build adds are taken off again when it unloads. Otherwise every reload adds another set.
        private static readonly System.Collections.Generic.List<System.Action> Unhook = new System.Collections.Generic.List<System.Action>();

        private static void Hook<T>(ConfigEntry<T> entry, System.EventHandler handler)
        {
            entry.SettingChanged += handler;
            Unhook.Add(() => entry.SettingChanged -= handler);
        }

        /// <summary>Takes this build's handlers off the config entries (logic unload).</summary>
        public static void Unbind()
        {
            foreach (System.Action unhook in Unhook)
            {
                unhook();
            }

            Unhook.Clear();
        }

        /// <summary>Section "6 - Living village": prosperity, the calendar, standing, needs, leaving and the rest.</summary>
        private static void BindLiving(ConfigFile config)
        {
            const string living = "6 - Living village";
            Prosperity = Admin(config, living, "Prosperity", true,
                "Each village keeps a prosperity number from its people, buildings, stock and mood, shown on the notice " +
                "board. It falls after a death or a lost raid and comes back slowly. More prosperity brings more visitors " +
                "and newcomers, and bigger raids.");
            ProsperityRaidsFrom = Admin(config, living, "ProsperityRaidsFrom", 75,
                "With Prosperity and RaidsEnabled on, no raids on a village below this prosperity.");
            Expectations = Admin(config, living, "Expectations", true,
                "A young village is content with little; a grown one expects a longhouse, varied food, seats and a fence. " +
                "A standing mood bonus that shrinks as the village grows.");
            ExpectationBonus = Admin(config, living, "ExpectationBonus", "18,12,6,0",
                "Mood bonus for a camp, a hamlet, a village and a town, separated by commas.");
            Calendar = Admin(config, living, "Calendar", true,
                "Villages keep a calendar of four seasons. Villagers name the season, and the seasons change work (see " +
                "WinterStores). Read from shudnal's Seasons mod when it is installed and ReadSeasonsMod is on.");
            DaysPerSeason = Admin(config, living, "DaysPerSeason", 10,
                "In-game days in a season of Villheim's own calendar (Seasons mod default: 10).");
            FestivalDay = Admin(config, living, "FestivalDay", 5,
                "Day of each season that is a festival: the sowing feast, the midsummer fire, the harvest feast, Yule.");
            ReadSeasonsMod = Admin(config, living, "ReadSeasonsMod", true,
                "Take the season and the day from the Seasons mod when it is installed.");
            Festivals = Admin(config, living, "Festivals", true,
                "On festival days work stops at 16:00, the evening is a feast at the hearth, everyone is glad of it for a " +
                "day, and with WorldLife on visitors come more often.");
            WinterStores = Admin(config, living, "WinterStores", true,
                "Autumn: villages keep half again as much wood and twice the food. Winter: no farming or foraging, more " +
                "time by the fire, and a village with no wood in its chest is cold and glum.");
            PlayerStanding = Admin(config, living, "PlayerStanding", true,
                "A player's standing with a village moves store prices (cheaper for friends, dearer for the disliked), " +
                "brings a fine to pay when it falls low, and guards on watch when it falls very low.");
            Hostility = Admin(config, living, "Hostility", false,
                "Villages are echoes of the old world and a place of rest. Off (default): a village never fines, turns away or " +
                "guards against a player, however low his standing. On: fines below FineBelow and armed guards below GuardBelow.");
            EmptyVillageReturnDays = Admin(config, living, "EmptyVillageReturnDays", 3,
                "A village whose people all died or left is settled again by newcomers after this many game days. 0: never.");
            FineBelow = Admin(config, living, "FineBelow", -30,
                "Below this standing the village asks a fine in coins before it trades again. Crouch and talk to a " +
                "villager to pay it.");
            GuardBelow = Admin(config, living, "GuardBelow", -60,
                "Below this standing protectors arm themselves and watch you when you walk in.");
            ForgivePerDay = Admin(config, living, "ForgivePerDay", 1,
                "Points a bad standing comes back toward zero each day.");
            Complaints = Admin(config, living, "Complaints", true,
                "A villager without a bed, food or safety for days complains, then asks a player for it. He stays in the " +
                "village whatever happens (Leaving is off by default).");
            ComplainAfterDays = Admin(config, living, "ComplainAfterDays", 3, "Days without a need before complaining.");
            DemandAfterDays = Admin(config, living, "DemandAfterDays", 6, "Days without a need before asking a player for it.");
            LeaveAfterDays = Admin(config, living, "LeaveAfterDays", 10, "With VillagersLeave on: days without a need before leaving.");
            // Villagers never move away (Tyler, 2026-11-08, D-003): a new key, off by default, so a config file
            // written while "Leaving" was on doesn't keep it on. The code stays.
            Leaving = Admin(config, living, "VillagersLeave", false,
                "Off: villagers never leave their village. On (old behaviour, needs WorldLife): one who lacked a need " +
                "too long, or the least content when the whole village is glum for days, walks to the friendliest " +
                "neighbour and settles there when it has a free bed.");
            ExodusMood = Admin(config, living, "ExodusMood", 25, "With VillagersLeave on: village mood below which people start to think of leaving.");
            ExodusDays = Admin(config, living, "ExodusDays", 3, "With VillagersLeave on: days in a row below ExodusMood before someone leaves.");
            VisitorJudging = Admin(config, living, "VisitorJudging", true,
                "Pedlars and pilgrims judge their stay (weather, a fight, the village's mood, a feast). A good stay " +
                "warms their home village to this one and may leave a gift; a bad one cools it and keeps visitors away " +
                "longer.");
            WantPile = Admin(config, living, "WantPile", true,
                "A pile or item stand beside the village chest shows what the village wants most, readable from afar. " +
                "Filling it within a day cheers the village.");
            // Growth follows materials, people and needs, never bosses felled (Tyler, 2026-11-08, D-004). New key, off.
            BossStages = Admin(config, living, "BossStageCap", false,
                "Off: growth follows materials, people and needs, and bosses felled never hold a village back. On (old " +
                "behaviour, needs WorldLife): each boss felled (or its trophy hung on an item stand in the village) lets " +
                "villages grow one stage further.");
            BossStageStart = Admin(config, living, "BossStageStart", 2,
                "With BossStageCap on: stage a village can reach with no boss felled: 1 camp, 2 hamlet, 3 village, 4 town.");
            BossStageSource = Admin(config, living, "BossStageSource", "Either",
                "With BossStageCap on: what counts as a boss felled: Keys (the world's boss keys), Trophies (hung in the village) or Either.");
            Elders = Admin(config, living, "Elders", true,
                "Villagers who have lived in a village long enough are elders: they leave felling and mining to others " +
                "and tell the village's old stories.");
            ElderDays = Admin(config, living, "ElderDays", 40, "Days in the village before a villager is an elder.");
            // Elders do not die of age (Tyler, 2026-11-08, D-003). New key, off.
            ElderDeaths = Admin(config, living, "EldersDieOfAge", false,
                "Off: elders live on. On (old behaviour, needs WorldLife): very old elders may die in their sleep and are " +
                "mourned.");
            ElderDeathDays = Admin(config, living, "ElderDeathDays", 60, "With EldersDieOfAge on: days in the village before an elder may die of age.");
            ElderDeathChance = Admin(config, living, "ElderDeathChance", 0.02f, "Chance each morning, from ElderDeathDays on.");
            Neighbours = Admin(config, living, "Neighbours", true,
                "Villagers pick beds near their friend and away from their rival, and are glad or sour about who lives " +
                "next door. A trader's prices follow his mood about it.");
            Horn = Admin(config, living, "Horn", true,
                "Use the hearth while crouching to blow the horn: if the village counts you a friend, its protectors " +
                "follow you for a while. Once a game hour.");
            HornSeconds = Admin(config, living, "HornSeconds", 240f, "How long protectors follow the horn (seconds).");
            HelpPlayers = Admin(config, living, "HelpPlayers", true,
                "Up to two protectors run out to help a friend of the village who is fighting within 60 m of it (not at " +
                "night unless the village is raided).");
        }

        /// <summary>Section "5c - Village knowledge": what villages know of the land, how far they go, the map table.</summary>
        private static void BindKnowledge(ConfigFile config)
        {
            const string know = "5c - Village knowledge";
            VillageKnowledge = Admin(config, know, "VillageKnowledge", true,
                "Villages learn the real land around them (boss altars, dungeons, traders, ore, nests, berries, where animals " +
                "come out, where the biomes change) as far as their reach goes, and villagers talk about it truthfully: what " +
                "they saw themselves, what they were told and by whom. Off: the village makes no discoveries and has no map table.");
            KnowledgeReach = Admin(config, know, "KnowledgeReach", "200, 400, 650, 900",
                "How far (metres from the hearth) a village comes to know the land at each stage: camp, hamlet, village, town.");
            KnowledgeReachPerGear = Admin(config, know, "KnowledgeReachPerGear", 60f,
                "Metres of reach added for each gear tier the village has made (0 rags to 4 bronze).");
            KnowledgeReachGrowth = Admin(config, know, "KnowledgeReachGrowth", 150f,
                "Metres a day the explored radius grows toward the reach, so places come to light over days.");
            KnowledgeGearGate = Admin(config, know, "KnowledgeGearGate", true,
                "Villagers only go into a biome (to explore, fell, mine, hunt or forage) once the village has made the gear " +
                "KnowledgeGear asks for there. Big things past that line can still be seen from the edge of it.");
            KnowledgeGear = Admin(config, know, "KnowledgeGear", Village.Knowledge.DefaultGear,
                "Gear tier needed before villagers go into each biome (0 rags, 1 leather, 2 flint and leather, 3 troll " +
                "leather, 4 bronze; 5 never). Biome: tier, separated by semicolons. A village's own biome is always open.");
            KnowledgeWitness = Admin(config, know, "KnowledgeWitness", 60f,
                "A villager out working who comes this close to something (twice as far for big things like towers and " +
                "altars) has seen it himself and can say so.");
            KnowledgeSight = Admin(config, know, "KnowledgeSight", 150f,
                "How far past the last ground the villagers walk to a big thing can be spotted (twice that across water).");
            KnowledgeKeep = Admin(config, know, "KnowledgeKeep", 60,
                "Discoveries kept on each village's hearth. Past that, the most ordinary and oldest go first.");
            KnowledgeCommonDays = Admin(config, know, "KnowledgeCommonDays", 2,
                "Days after which everyone in the village has heard of a discovery. Before that only the one who saw it, " +
                "and those he told in a chat, can talk about it.");
            RumourChance = Admin(config, know, "RumourChance", 0.5f,
                "Chance that a villager who knows something of the land has it on his mind when he picks a line (0 to 1).");
            KnowledgeRequests = Admin(config, know, "KnowledgeRequests", true,
                "Requests, contracts and talk about what the village needs say where the village believes it can be found, " +
                "or that nobody knows.");
            HarvestReach = Admin(config, know, "HarvestReach", true,
                "Villagers fell, mine, hunt and forage further from the hearth as the village grows (HarvestReachByStage).");
            HarvestReachByStage = Admin(config, know, "HarvestReachByStage", "1, 1.15, 1.35, 1.6",
                "How much further than the usual radius (45 to 55 m) villagers work at each stage: camp, hamlet, village, town.");
            HarvestReachMax = Admin(config, know, "HarvestReachMax", 90f, "The furthest villagers go from the hearth to work (metres).");
            MapTable = Admin(config, know, "MapTable", true,
                "A village puts the game's cartography table by its hearth. Reading it copies the village's discoveries to " +
                "your map as pins.");
            MapTableFromStage = Admin(config, know, "MapTableFromStage", 2, "Stage from which a village has a map table: 1 camp, 2 hamlet.");
        }

        /// <summary>Sections "5d - Cultures" and "5e - Biome defenders".</summary>
        private static void BindCultures(ConfigFile config)
        {
            const string cultures = "5d - Cultures";
            Cultures = Admin(config, cultures, "Cultures", true,
                "Each village belongs to a culture of the old world (Norse, Anglo-Saxon, Gaelic, Slavic, Persian and Arab, " +
                "Byzantine and others): it gives names, looks, clothes, the names of the four feasts, a few lines and, where " +
                "the design library has them, building sets. Off: every village is Norse, as before. 'vh cultures' lists them.");
            CultureMap = Admin(config, cultures, "CultureMap", Village.Cultures.DefaultMap,
                "Which cultures a village of each biome may have, with weights: Biome=culture:weight,culture:weight; next " +
                "biome. A new village rolls one with its own seed and keeps it. Biomes left out build like the Meadows. " +
                "Culture keys are the [names] in Cultures/cultures.txt (see 'vh cultures').");
            CultureForeignChance = Admin(config, cultures, "CultureForeignChance", 0.15f,
                "Chance that a newcomer from outside is of another people than the village. He keeps his own names and " +
                "looks and says he comes from a place in his own tongue.");
            LooksOutlierChance = Admin(config, cultures, "LooksOutlierChance", 0.1f,
                "Chance that a villager's skin tone comes from the whole range the game gives instead of the culture's.");
            CultureSurnames = Admin(config, cultures, "CultureSurnames", true,
                "Show the surname a villager's culture gives him (Haraldsson, ibn Hasan, de Falaise) after his name when " +
                "you look at him. His name in lines stays the given name.");
            CultureDesigns = Admin(config, cultures, "CultureDesigns", true,
                "Use a culture's own design sets (cultures.txt) and blueprints tagged 'villheim: culture=key' before the " +
                "biome's set. Off: only the biome decides what a village builds.");

            const string defenders = "5e - Biome defenders";
            BiomeDefenders = Admin(config, defenders, "BiomeDefenders", true,
                "Villagers of villages in or near a hard biome are good at fighting its worst creatures: they pick those " +
                "first, react at once, hit them harder, and shoot the flying ones out of the sky with bows. Fights with " +
                "every other creature stay as they were. One profile each for the Plains and the Mistlands below.");
            DefenderCarers = Admin(config, defenders, "DefenderCarers", true,
                "Carers shoot too when a listed flying creature comes (running from a deathsquito does not work). Off: " +
                "only protectors shoot.");
            DefenderRange = Admin(config, defenders, "DefenderRange", 35f,
                "How far away (metres) a villager starts shooting at a listed flying creature.");
            DefenderShotSeconds = Admin(config, defenders, "DefenderShotSeconds", 1.2f,
                "Seconds between one villager's arrows.");
            DefenderLead = Admin(config, defenders, "DefenderLead", 1f,
                "How much villagers aim ahead of a moving target, 0 (straight at it) to 1 (where it will be when the " +
                "arrow gets there).");
            DefenderBowAnimation = Admin(config, defenders, "DefenderBowAnimation", true,
                "Play the bow's firing animation with each arrow. Turn off if villagers get stuck in a pose.");

            PlainsDefenders = Admin(config, defenders, "PlainsDefenders", true,
                "Plains profile: deathsquitos first, shot down at range.");
            PlainsDefenderBiomes = Admin(config, defenders, "PlainsDefenderBiomes", "Plains",
                "Villages in these biomes always use the Plains profile (comma separated).");
            PlainsDefenderReach = Admin(config, defenders, "PlainsDefenderReach", 400f,
                "A village also uses it when Plains ground lies within this many metres of its hearth. 0: biome only.");
            PlainsDefenderTargets = Admin(config, defenders, "PlainsDefenderTargets", "Deathsquito",
                "Creature prefab names the profile covers. Flying ones are shot with bows; the rest are fought as usual " +
                "with the damage bonus.");
            PlainsDefenderDamage = Admin(config, defenders, "PlainsDefenderDamage", 2f,
                "Damage multiplier for villagers' blows and arrows against those creatures.");
            PlainsDefenderSpread = Admin(config, defenders, "PlainsDefenderSpread", 1.5f,
                "Aim spread in degrees for arrows at those creatures (lower is more accurate; a player's full draw is " +
                "about 1 to 2).");
            PlainsDefenderReaction = Admin(config, defenders, "PlainsDefenderReaction", 0.4f,
                "Seconds from first seeing such a creature to the first arrow.");

            MistlandsDefenders = Admin(config, defenders, "MistlandsDefenders", true,
                "Mistlands profile: seekers, seeker soldiers, broods, ticks and gjall.");
            MistlandsDefenderBiomes = Admin(config, defenders, "MistlandsDefenderBiomes", "Mistlands",
                "Villages in these biomes always use the Mistlands profile (comma separated).");
            MistlandsDefenderReach = Admin(config, defenders, "MistlandsDefenderReach", 300f,
                "A village also uses it when Mistlands ground lies within this many metres of its hearth. 0: biome only.");
            MistlandsDefenderTargets = Admin(config, defenders, "MistlandsDefenderTargets", "Seeker,SeekerBrute,SeekerBrood,Tick,Gjall",
                "Creature prefab names the profile covers. Gjall fly and are shot with bows; the rest are fought as usual " +
                "with the damage bonus.");
            MistlandsDefenderDamage = Admin(config, defenders, "MistlandsDefenderDamage", 3f,
                "Damage multiplier for villagers' blows and arrows against those creatures (village gear stays at bronze " +
                "at most, far below what the Mistlands ask of a player).");
            MistlandsDefenderSpread = Admin(config, defenders, "MistlandsDefenderSpread", 2f,
                "Aim spread in degrees for arrows at those creatures.");
            MistlandsDefenderReaction = Admin(config, defenders, "MistlandsDefenderReaction", 0.4f,
                "Seconds from first seeing such a creature to the first arrow.");
        }

        /// <summary>Every look setting puts itself on the ghosts the moment it changes.</summary>
        private static void WatchLooks()
        {
            Unbind();
            System.EventHandler apply = (_, __) => Villagers.GhostLook.ApplyNow();
            foreach (ConfigEntryBase entry in new ConfigEntryBase[]
                     {
                         GhostLook, GhostAlpha, GhostTint, GhostGlow, GhostAlphaDay, GhostTintDay, GhostGlowDay, GhostColor, GhostGlowColor,
                     })
            {
                if (entry is ConfigEntry<float> f) Hook(f, apply);
                else if (entry is ConfigEntry<bool> b) Hook(b, apply);
                else if (entry is ConfigEntry<UnityEngine.Color> c) Hook(c, apply);
            }

            Hook(GhostApplyNow, (_, __) =>
            {
                if (GhostApplyNow.Value)
                {
                    Villagers.GhostLook.ApplyNow();
                    GhostApplyNow.Value = false;
                }
            });
        }

        private static ConfigEntry<T> Admin<T>(ConfigFile config, string section, string key, T value, string description)
        {
            var attributes = new ConfigurationManagerAttributes { IsAdminOnly = true };
            return config.Bind(section, key, value, new ConfigDescription(description, null, attributes));
        }
    }
}
