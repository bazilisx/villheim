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
        public static ConfigEntry<float> BuildStartShare;
        public static ConfigEntry<int> BuildHelpers;
        public static ConfigEntry<string> YggdrasilYield;
        public static ConfigEntry<float> ClearingRadius;
        public static ConfigEntry<bool> IdlePickup;
        public static ConfigEntry<string> HamletFence;
        public static ConfigEntry<float> HamletFenceSink;
        public static ConfigEntry<float> FenceWallSink;
        public static ConfigEntry<bool> AnimalPens;
        public static ConfigEntry<float> VillageLevelSnap;
        public static ConfigEntry<string> MapTablePrefab;
        public static ConfigEntry<string> MapTableProp;
        public static ConfigEntry<string> DecorProps;
        public static ConfigEntry<float> TestVillageFrameMs;
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
        public static ConfigEntry<bool> WaterProofPieces;
        public static ConfigEntry<string> BoardwalkCultures;
        public static ConfigEntry<float> BoardwalkWetHeight;
        public static ConfigEntry<bool> StorageChests;
        public static ConfigEntry<string> StorageChestSteps;
        public static ConfigEntry<int> StorageChestPeople;
        public static ConfigEntry<int> StorageChestMax;
        public static ConfigEntry<float> StorageSortAt;
        public static ConfigEntry<string> WoodFirstBiomes;
        public static ConfigEntry<int> StoneFromStage;
        public static ConfigEntry<int> StoneHallFromStage;
        public static ConfigEntry<int> EarlyStoneMax;
        public static ConfigEntry<bool> Daughters;
        public static ConfigEntry<bool> Contracts;
        public static ConfigEntry<bool> Groves;
        public static ConfigEntry<int> GroveTrees;
        public static ConfigEntry<float> ContractChancePerDay;
        public static ConfigEntry<int> DaughtersPerVillage;
        public static ConfigEntry<float> DaughterChancePerDay;
        public static ConfigEntry<float> CaravanChancePerDay;
        public static ConfigEntry<float> CaravanMetersPerDay;
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
        public static ConfigEntry<bool> Neighbors;
        public static ConfigEntry<bool> Horn;
        public static ConfigEntry<float> HornSeconds;
        public static ConfigEntry<bool> HelpPlayers;
        public static ConfigEntry<bool> VillageKnowledge;
        public static ConfigEntry<string> KnowledgeReach;
        public static ConfigEntry<float> KnowledgeReachPerGear;
        public static ConfigEntry<float> KnowledgeReachGrowth;
        public static ConfigEntry<bool> KnowledgeGearGate;
        public static ConfigEntry<string> KnowledgeGear;
        public static ConfigEntry<float> KnowledgeNear;
        public static ConfigEntry<string> KnowledgeKinds;
        public static ConfigEntry<string> KnowledgeReachKinds;
        public static ConfigEntry<float> KnowledgeSight;
        public static ConfigEntry<float> KnowledgeSightRange;
        public static ConfigEntry<int> KnowledgeKeep;
        public static ConfigEntry<int> KnowledgeCommonDays;
        public static ConfigEntry<float> RumorChance;
        public static ConfigEntry<bool> KnowledgeRequests;
        public static ConfigEntry<bool> HarvestReach;
        public static ConfigEntry<string> HarvestReachByStage;
        public static ConfigEntry<float> HarvestReachMax;
        public static ConfigEntry<bool> MapTable;
        public static ConfigEntry<int> MapTableFromStage;
        public static ConfigEntry<float> MapTableShare;

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
        // Fights (Villagers/Combat.cs), keeping apart (Village/KeepApart.cs) and mist (Village/Demisting.cs).
        public static ConfigEntry<int> FightResponders;
        public static ConfigEntry<float> FightBackRange;
        public static ConfigEntry<float> FightFleeRange;
        public static ConfigEntry<float> FightLeash;
        public static ConfigEntry<float> MeleeStrength;
        public static ConfigEntry<float> ArrowSmallHealth;
        public static ConfigEntry<int> ArrowHitsBig;
        public static ConfigEntry<bool> KeepApart;
        public static ConfigEntry<string> KeepApartCreatures;
        public static ConfigEntry<float> KeepApartMargin;
        public static ConfigEntry<string> KeepApartAvoid;
        public static ConfigEntry<bool> MistlandsDemist;
        public static ConfigEntry<float> MistlandsDemistRadius;
        public static ConfigEntry<float> MistlandsVillagerDemist;
        public static ConfigEntry<float> FightBowFrom;
        public static ConfigEntry<float> FightRetreatHealth;
        public static ConfigEntry<bool> FightTargetOrder;
        public static ConfigEntry<int> PlayerHitsToFight;
        public static ConfigEntry<float> PlayerHitWindow;
        public static ConfigEntry<bool> PlayerGrudges;
        public static ConfigEntry<int> TrophiesPerHome;
        public static ConfigEntry<bool> PlayerKillBan;
        public static ConfigEntry<float> PlayerWarnSeconds;
        public static ConfigEntry<float> PlayerWarnRadius;
        public static ConfigEntry<int> PlayerBanDays;
        public static ConfigEntry<int> PlayerBanDaysPerPerson;
        public static ConfigEntry<float> VillagerRegen;
        public static ConfigEntry<float> RestRegenFactor;
        public static ConfigEntry<float> GhostDeathSeconds;
        public static ConfigEntry<string> ChildRigHairBoy;
        public static ConfigEntry<string> ChildRigHairGirl;
        public static ConfigEntry<bool> ChildRigGhost;
        public static ConfigEntry<string> ChildHairAllow;
        public static ConfigEntry<string> ChildHairBlock;
        public static ConfigEntry<string> ChildHairCultures;
        public static ConfigEntry<bool> GhostDeath;
        public static ConfigEntry<int> YggaGrowDays;
        public static ConfigEntry<string> MistlandsDemisterPrefab;
        public static ConfigEntry<int> MistlandsDemisters;
        public static ConfigEntry<string> MistlandsDemisterCost;
        // Hunting (Villagers/Hunting.cs) and copses (Village/Groves.cs).
        public static ConfigEntry<float> HuntBowRange;
        public static ConfigEntry<float> HuntMeleeRange;
        public static ConfigEntry<float> HuntChaseSeconds;
        public static ConfigEntry<float> HuntChaseDistance;
        public static ConfigEntry<bool> Copses;
        public static ConfigEntry<string> CopseBiomes;
        public static ConfigEntry<int> CopseTrees;
        public static ConfigEntry<int> CopseSaplingsPerDay;
        // Ages (Villagers/Ages.cs, Villagers/ChildPlay.cs).
        public static ConfigEntry<float> ElderSpeed;
        public static ConfigEntry<float> ChildHelpChance;
        public static ConfigEntry<bool> ChildProportions;
        public static ConfigEntry<bool> ChildNoBeard;
        // Child body proportions, [0] boys and [1] girls: Height, Head, Neck, Torso, Arms, Legs, Shoulders, Hips.
        public static readonly ConfigEntry<float>[][] ChildShape = { new ConfigEntry<float>[8], new ConfigEntry<float>[8] };
        public static readonly string[] ChildShapeParts = { "Height", "Head", "Neck", "Torso", "Arms", "Legs", "Shoulders", "Hips" };

        // In-game generator (Generator/GenCommands.cs).
        public static ConfigEntry<int> GenCandidates;
        public static ConfigEntry<bool> GenLevelGround;
        // Section "9 - Test villages" ('vh village spawn', see Village/TestVillage).
        public static ConfigEntry<string> TestVillageBuildings;
        public static ConfigEntry<string> TestVillageVillagers;
        public static ConfigEntry<int> TestVillagePiecesPerFrame;

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
            WoodFirstBiomes = Admin(config, work, "WoodFirstBiomes", "Meadows, BlackForest",
                "Biomes whose villages build in wood at their early stages and in stone only later (comma separated).");
            StoneFromStage = Admin(config, work, "StoneFromStage", 3,
                "In WoodFirstBiomes: the stage a village must reach with its next building before it builds a design " +
                "with more than EarlyStoneMax stone (1 camp, 2 hamlet, 3 village, 4 town).");
            StoneHallFromStage = Admin(config, work, "StoneHallFromStage", 2,
                "The same for the hall (the longhouse by the hearth): it may be built or rebuilt in stone from this stage.");
            EarlyStoneMax = Admin(config, work, "EarlyStoneMax", 30,
                "Stone a design may use and still count as a wooden building (a hearth, a fire pit, a few steps).");
            StorageChests = Admin(config, work, "StorageChests", true,
                "Extra wood chests by the main chest as the village grows, each with a sign for what it holds (wood, " +
                "fine wood, core wood, stone, ore and metal, food, other). Villagers sort the main chest into them when it " +
                "fills, and the builder takes from any of them.");
            StorageChestSteps = Admin(config, work, "StorageChestSteps", "1:1, 2:2, 3:4",
                "Storage chests by buildings standing, buildings:chests separated by commas. The default gives one with the " +
                "first building, two with the second and four with the third.");
            StorageChestPeople = Admin(config, work, "StorageChestPeople", 3,
                "One more storage chest for every this many villagers past six. 0: none for people.");
            StorageChestMax = Admin(config, work, "StorageChestMax", 8,
                "Most storage chests a village keeps, counting the ones it adds when the main chest is full with " +
                "nowhere to sort to (at most one a day).");
            StorageSortAt = Admin(config, work, "StorageSortAt", 0.75f,
                "How full the main chest (share of its slots) gets before a villager carries stacks to the storage chests.");
            WaterProofPieces = Admin(config, work, "WaterProofPieces", true,
                "Pieces a village built take no rain or water damage. Pieces players build keep the game's own wear.");
            BoardwalkCultures = Admin(config, work, "BoardwalkCultures", "fen-folk, celtic-crannog",
                "Cultures whose villages lay raised wooden walkways on poles instead of dirt paths over wet ground.");
            BoardwalkWetHeight = Admin(config, work, "BoardwalkWetHeight", 0.8f,
                "Ground no higher than this many meters over the water counts as wet for boardwalks.");
            SecondsPerPiece = Admin(config, work, "SecondsPerPiece", 2.5f,
                "How long a builder hammers at each piece before it goes up.");
            BuildStartShare = Admin(config, work, "BuildStartShare", 0.5f,
                "When the builder starts or goes back to the next part of a building (ground and walls, roof, doors and " +
                "windows, inside): once the chest holds this share of what that part costs in its main material (0.5: " +
                "half, D-048). He then puts up pieces, each one supported, while the materials last, so a building may " +
                "stand half done while he fetches more. 0: as soon as the next piece is paid for.");
            BuildHelpers = Admin(config, work, "BuildHelpers", 3,
                "While the chest holds what the next part of a building needs, up to this many villagers with nothing in " +
                "hand help the builder put it up, instead of going out for more (T-54). 0: the builder alone.");
            YggdrasilYield = Admin(config, work, "YggdrasilYield", "Wood:2, FineWood:1",
                "In the Mistlands villagers fell the young Yggdrasil trees and break the Mistlands rock nearby, whatever " +
                "their tools. Each piece of Yggdrasil wood they bring in counts as this much ordinary wood (T-55).");
            ClearingRadius = Admin(config, work, "ClearingRadius", 20f,
                "Villagers keep the ground this many meters around the hearth clear: they fell trees, take out stumps, " +
                "break rocks and pick up sticks and stones there, and the materials go to the chest. 0: only the paths " +
                "waiting to be laid are cleared.");
            IdlePickup = Admin(config, work, "IdlePickup", true,
                "Villagers with nothing else to do pick up useful things lying in the village (wood, stone, resin, " +
                "leather, feathers, meat and the like) and put them in the chest.");
            HamletFence = Admin(config, work, "HamletFence", "wood_fence",
                "The fence a hamlet puts up round itself, with gaps where the paths cross. Once it is a village it is " +
                "replaced by the stake wall. Empty: no fence until then.");
            HamletFenceSink = Admin(config, work, "HamletFenceSink", 0f,
                "How much of the hamlet's fence goes into the ground (0: none, it stands on the ground).");
            FenceWallSink = Admin(config, work, "FenceWallSink", 0.5f,
                "How much of the village's stake wall goes into the ground (0.5: half). Gates are pairs of wood gates.");
            DecorProps = Admin(config, work, "LocationDecor", "",
                "Models from locations a village puts up as decor on the outer ring by the hearth (D-047), as location:child " +
                "separated by commas; the child by the start of its name, or by its path (a/b/c) as 'vh props' prints it. " +
                "Empty by default: Hildir_camp's 'tent' child was a bundle of things on the ground (T-59). 'vh props " +
                "Hildir_camp cloth' lists the children that flutter, to find the tent.");
            VillageLevelSnap = Admin(config, work, "VillageLevelSnap", 2f,
                "A new building whose ground lies within this many meters of the hearth's is set at the hearth's level, so " +
                "the middle of the village is one even floor instead of steps (T-28). Further off, it sits at the middle " +
                "height of the ground under it. 0: always the ground under it.");
            AnimalPens = Admin(config, work, "AnimalPens", true,
                "Farm animals are kept in a pen of wood fence with a gate, built by the farm before the first animal comes.");
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
            HuntBowRange = Admin(config, work, "HuntBowRange", 25f,
                "Hunters shoot from up to this far (meters). Deer are only ever hunted with a bow, since they always run.");
            HuntMeleeRange = Admin(config, work, "HuntMeleeRange", 4f,
                "A boar or other slow game this close is fought with the hunter's weapon instead of the bow.");
            HuntChaseSeconds = Admin(config, work, "HuntChaseSeconds", 45f,
                "A hunter gives up on an animal he has not brought down after this many seconds and goes back to other work.");
            HuntChaseDistance = Admin(config, work, "HuntChaseDistance", 30f,
                "A hunter also gives up when the animal gets this many meters past the village's working reach.");
            Copses = Admin(config, work, "Copses", true,
                "Villages in biomes with few trees (CopseBiomes) plant saplings in a copse or two just outside the village, " +
                "of trees that grow in their biome, so there is wood to fell later. Works without WorldLife.");
            YggaGrowDays = Admin(config, work, "YggaGrowDays", 2,
                "Mistlands copses are Yggdrasil shoots (no other tree grows there). A small shoot planted by a village grows " +
                "into a full one after this many days. Villagers get plain wood from the shoots their village planted; " +
                "players get the game's own drops.");
            CopseBiomes = Admin(config, work, "CopseBiomes", "Plains, Mistlands, Mountain",
                "Biomes whose villages plant copses (comma separated).");
            CopseTrees = Admin(config, work, "CopseTrees", 20,
                "Standing trees within 60 m of the village's edge a copse village wants; below this it plants more.");
            CopseSaplingsPerDay = Admin(config, work, "CopseSaplingsPerDay", 4,
                "Saplings a copse village adds to its planting list each day while it has fewer than CopseTrees.");
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
                "a lost traveler taken in, a fever, beasts at night, a quarrel, a falling-out with the neighbors.");
            EventChancePerDay = Admin(config, life, "EventChancePerDay", 0.35f,
                "Chance that something happens in a village on a given day (0 to 1).");
            Caravans = Admin(config, life, "Caravans", true,
                "With WorldLife on, traders travel the trails between villages, and outpost loads are carried home. A " +
                "caravan moves on the world clock and is a real person walking the road when you are near it; Shift + Use " +
                "on a trader opens his pack (his own wares, for coins).");
            // Caravans no longer move goods between villages (Tyler, 2026-11-08, D-008).
            CaravanDeliveries = Admin(config, life, "CaravanDeliveries", false,
                "Off: a trader on the trail carries his own pack and nothing from a village chest. On (old behavior): " +
                "villages send what they can spare to villages that lack it.");
            CaravanChancePerDay = Admin(config, life, "CaravanChancePerDay", 0.3f,
                "Chance that a village sends a trader down the trail on a given day (0 to 1).");
            CaravanMetersPerDay = Admin(config, life, "CaravanMetersPerDay", 2400f,
                "How far a caravan or a haul goes in an in-game day.");
            CaravanReach = Admin(config, life, "CaravanReach", 2500f,
                "Villages farther apart than this (meters) do not send each other caravans.");
            OutpostsPerVillage = Admin(config, life, "OutpostsPerVillage", 2,
                "Most camps a village keeps: a logging camp in the other wood biome, and a flint camp on the shore while " +
                "its smith needs flint.");
            OutpostCarryAt = Admin(config, life, "OutpostCarryAt", 12,
                "A camp sends its load home (a camper walks it along the trail) once it has gathered this much.");
            // One village per site, plus resource outposts (Tyler, 2026-11-08, D-010): a new key, off by default, so a
            // config file written while "Daughters" was on doesn't keep it on. The code stays.
            Daughters = Admin(config, life, "DaughterVillages", false,
                "Off: a village never founds another; each site is one village plus its resource outposts. On (old " +
                "behavior, needs WorldLife): a full village now and then sends two of its people to found a village of " +
                "their own 600 to 1,200 m away.");
            DaughtersPerVillage = Admin(config, life, "DaughtersPerVillage", 2,
                "With DaughterVillages on: most daughter villages one village founds.");
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
                "With WorldLife on, villages plan a dirt trail to their outpost and to their nearest neighbor within " +
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
            BindGenerator(config);
            BindTestVillages(config);

            const string sites = "1b - Village sites";
            VillageChance = Admin(config, sites, "VillageChance", 50,
                "Percent of generated village sites that become villages, so villages stay a rare find. Sites lit with " +
                "the settle command always do.");
            VillageSpacing = Admin(config, sites, "VillageSpacing", 1500f,
                "No two generated villages closer than this (meters). Villages also keep 400 m from traders and ports.");

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
                "The color villagers are tinted toward (the tint settings say how strongly). Teal by default.");
            GhostGlowColor = Admin(config, looks, "GhostGlowColor", new UnityEngine.Color(0.25f, 0.6f, 0.75f),
                "The color of the glow (the glow settings say how strongly).");
            ChildProportions = Admin(config, looks, "ChildProportions", true,
                "Children are shaped as children (the ChildBoy and ChildGirl settings): a bigger head for their size, a " +
                "shorter neck, legs and arms, narrower shoulders and hips. Off: a child is a grown villager scaled down " +
                "to ChildBoyHeight or ChildGirlHeight. 'vh kids rig' puts up models to tune these against.");
            ChildNoBeard = Admin(config, looks, "ChildNoBeard", true, "Boys have no beard until they grow up.");
            BindChildShape(config, looks);
            GhostDeathSeconds = Admin(config, looks, "GhostDeathSeconds", 2.5f,
                "Seconds a dying villager takes to fade out as he rises, after the ghost's vanishing effect.");
            ChildRigHairBoy = Admin(config, looks, "ChildRigHairBoy", "",
                "Hair on the boy model of 'vh kids rig' (a hair prefab such as Hair3; empty: the rig's default). " +
                "'vh kids hair next' cycles through the game's styles.");
            ChildRigHairGirl = Admin(config, looks, "ChildRigHairGirl", "", "The same for the girl model.");
            ChildRigGhost = Admin(config, looks, "ChildRigGhost", false,
                "Give the 'vh kids rig' models the villagers' ghost look, to see children as they will be.");
            ChildHairAllow = Admin(config, looks, "ChildHairAllow", "",
                "Hair styles children may have (comma separated, e.g. Hair3, Hair12). Empty: any style grown villagers of " +
                "their sex may have, less ChildHairBlock.");
            ChildHairBlock = Admin(config, looks, "ChildHairBlock", "", "Hair styles children never have (comma separated).");
            ChildHairCultures = Admin(config, looks, "ChildHairCultures", "",
                "Children's hair styles by culture, with weights: culture=Hair3:2,Hair5:1; next culture. A child of a culture " +
                "listed here picks from its list only (still less ChildHairBlock). Culture keys as in 'vh cultures'.");
            GhostDeath = Admin(config, looks, "GhostDeath", true,
                "A villager who dies fades away the way the game's ghosts do: no body falls, no blood, and he stays an " +
                "echo to the end. Hits on villagers show the ghosts' hit effect too. Takes effect on the next logic load.");
            GhostApplyNow = Admin(config, looks, "GhostApplyNow", false,
                "Switch on to put the look settings on every villager and animal at once; it switches itself off again. " +
                "(Every change to a look setting is also applied at once on its own.)");
            HearthGroundPaint = Admin(config, sites, "HearthGroundPaint", "Both",
                "How the ground around a new hearth is cleared: ClearVegetation (grass taken off, ground keeps its color), " +
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
                "Color of the Shaper Tool's Glow and Beam, and the tint of its icon.");

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
                "Recolor the effects to ShaperColor (teal lightning). Off: their own colors.");
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
        /// The on/off settings for the village systems, for 'vh switches' and the help text. World systems also need
        /// WorldLife on. 'vh switches' groups them by config section.
        /// </summary>
        public static (string Name, ConfigEntry<bool> Entry)[] Switches => new[]
        {
            ("WorldLife", WorldLife), ("Outposts", Outposts), ("Trails", Trails), ("TrailSigns", TrailSigns),
            ("VillageEvents", VillageEvents), ("EventFever", EventFever), ("Caravans", Caravans), ("DaughterVillages", Daughters),
            ("Contracts", Contracts), ("Groves", Groves), ("PlayerMemory", PlayerMemory), ("VillagerSkills", VillagerSkills),
            ("VillagerWants", VillagerWants), ("Gatherings", Gatherings), ("Noticing", Noticing), ("IdleGlances", IdleGlances),
            ("SurroundingsTags", SurroundingsTags), ("TopicFatigue", TopicFatigue), ("ChatScenes", ChatScenes),
            ("Prosperity", Prosperity), ("Expectations", Expectations), ("Calendar", Calendar), ("Festivals", Festivals),
            ("WinterStores", WinterStores), ("PlayerStanding", PlayerStanding), ("Hostility", Hostility), ("Complaints", Complaints), ("VillagersLeave", Leaving),
            ("VisitorJudging", VisitorJudging), ("WantPile", WantPile), ("BossStageCap", BossStages), ("Elders", Elders),
            ("EldersDieOfAge", ElderDeaths), ("Neighbors", Neighbors), ("Horn", Horn), ("HelpPlayers", HelpPlayers),
            ("VillageKnowledge", VillageKnowledge), ("KnowledgeGearGate", KnowledgeGearGate), ("KnowledgeRequests", KnowledgeRequests),
            ("HarvestReach", HarvestReach), ("MapTable", MapTable),
            ("Cultures", Cultures), ("CultureSurnames", CultureSurnames), ("CultureDesigns", CultureDesigns),
            ("BiomeDefenders", BiomeDefenders), ("PlainsDefenders", PlainsDefenders), ("MistlandsDefenders", MistlandsDefenders),
            ("DefenderCarers", DefenderCarers), ("DefenderBowAnimation", DefenderBowAnimation),
            ("RaidsEnabled", VillageRaids), ("KeepApart", KeepApart), ("MistlandsDemist", MistlandsDemist), ("Copses", Copses),
            ("ChildProportions", ChildProportions),
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
                "Off: villagers never leave their village. On (old behavior, needs WorldLife): one who lacked a need " +
                "too long, or the least content when the whole village is glum for days, walks to the friendliest " +
                "neighbor and settles there when it has a free bed.");
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
                "behavior, needs WorldLife): each boss felled (or its trophy hung on an item stand in the village) lets " +
                "villages grow one stage further.");
            BossStageStart = Admin(config, living, "BossStageStart", 2,
                "With BossStageCap on: stage a village can reach with no boss felled: 1 camp, 2 hamlet, 3 village, 4 town.");
            BossStageSource = Admin(config, living, "BossStageSource", "Either",
                "With BossStageCap on: what counts as a boss felled: Keys (the world's boss keys), Trophies (hung in the village) or Either.");
            Elders = Admin(config, living, "Elders", true,
                "Villagers who have lived in a village long enough are elders: they leave felling and mining to others " +
                "and tell the village's old stories.");
            ElderDays = Admin(config, living, "ElderDays", 40, "Days in the village before a villager is an elder.");
            PlayerHitsToFight = Admin(config, living, "PlayerHitsToFight", 3,
                "Hits on a village's people by one player within PlayerHitWindow before its protectors fight him. Before " +
                "that a hit protector only complains, and carers, elders and children run to the hearth.");
            PlayerHitWindow = Admin(config, living, "PlayerHitWindow", 30f, "Seconds over which PlayerHitsToFight are counted.");
            PlayerGrudges = Admin(config, living, "PlayerGrudges", true,
                "A village remembers a player who harms its people on purpose: its protectors tell him to leave and fight " +
                "him if he stays, for PlayerBanDays (more for each person harmed), and for good if he killed one of them. " +
                "Off: a fight ends when he leaves and nothing is kept. 'vh grudges' shows and clears them.");
            PlayerKillBan = Admin(config, living, "PlayerKillBan", true,
                "With PlayerGrudges on: a player who killed one of a village's people is never welcome there again.");
            PlayerWarnSeconds = Admin(config, living, "PlayerWarnSeconds", 15f,
                "Seconds a protector gives an unwelcome player to leave before he fights him.");
            PlayerWarnRadius = Admin(config, living, "PlayerWarnRadius", 20f,
                "Protectors within this many meters of an unwelcome player warn him, and fight him if he is still this " +
                "close when the warning runs out.");
            PlayerBanDays = Admin(config, living, "PlayerBanDays", 2,
                "Days a player who harmed one of a village's people on purpose is unwelcome there.");
            PlayerBanDaysPerPerson = Admin(config, living, "PlayerBanDaysPerPerson", 2,
                "Days added to the ban for each more person he harmed.");
            TrophiesPerHome = Admin(config, living, "TrophiesPerHome", 2,
                "Trophies a villager may hang on wall item stands in his home (he keeps the trophies he took himself, and " +
                "the stand is paid from the village's chests). 0: none are hung.");
            VillagerRegen = Admin(config, living, "VillagerRegen", 2f,
                "Percent of his health a hurt villager gets back each minute, food or no food, while he is not fighting.");
            RestRegenFactor = Admin(config, living, "RestRegenFactor", 3f,
                "How many times faster that is while he sits or rests by the hearth, or lies in bed.");
            ElderSpeed = Admin(config, living, "ElderSpeed", 0.75f,
                "How fast elders walk and run against a grown villager (1 for the same speed). Elders keep to chores in the " +
                "village: cooking, sorting, the farm and the hearth.");
            ChildHelpChance = Admin(config, living, "ChildHelpChance", 0.1f,
                "Chance that a child at play goes to \"help\" a villager at work for a minute (0 to 1). Children play and explore " +
                "near the village and take no jobs.");
            // Elders do not die of age (Tyler, 2026-11-08, D-003). New key, off.
            ElderDeaths = Admin(config, living, "EldersDieOfAge", false,
                "Off: elders live on. On (old behavior, needs WorldLife): very old elders may die in their sleep and are " +
                "mourned.");
            ElderDeathDays = Admin(config, living, "ElderDeathDays", 60, "With EldersDieOfAge on: days in the village before an elder may die of age.");
            ElderDeathChance = Admin(config, living, "ElderDeathChance", 0.02f, "Chance each morning, from ElderDeathDays on.");
            Neighbors = Admin(config, living, "Neighbors", true,
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
                "Villages learn the real land around them (boss altars, dungeons, traders, runestones, valuable ore, where " +
                "animals come out, where the biomes change) and villagers talk about it truthfully: what they saw themselves, " +
                "what they were told and by whom. Off: the village makes no discoveries and has no map table.");
            KnowledgeReach = Admin(config, know, "KnowledgeReach", "200, 400, 650, 900",
                "How far (meters from the hearth) a village knows the lay of the land at each stage: camp, hamlet, village, town. " +
                "This covers only the kinds in KnowledgeReachKinds; places need a villager to go there.");
            KnowledgeReachPerGear = Admin(config, know, "KnowledgeReachPerGear", 60f,
                "Meters of reach added for each gear tier the village has made (0 rags to 4 bronze).");
            KnowledgeReachGrowth = Admin(config, know, "KnowledgeReachGrowth", 150f,
                "Meters a day the explored radius grows toward the reach.");
            KnowledgeGearGate = Admin(config, know, "KnowledgeGearGate", true,
                "Villagers only go into a biome (to explore, fell, mine, hunt or forage) once the village has made the gear " +
                "KnowledgeGear asks for there. Big things past that line can still be seen from the edge of it.");
            KnowledgeGear = Admin(config, know, "KnowledgeGear", Village.Knowledge.DefaultGear,
                "Gear tier needed before villagers go into each biome (0 rags, 1 leather, 2 flint and leather, 3 troll " +
                "leather, 4 bronze; 5 never). Biome: tier, separated by semicolons. A village's own biome is always open.");
            KnowledgeNear = Admin(config, know, "KnowledgeNear", 35f,
                "A villager out working who comes this close (meters) to a place has found it and can talk about it. Big sites " +
                "(boss altars, Fuling villages, towers, traders) count from half again as far. Nothing is found from further off.");
            KnowledgeKinds = Admin(config, know, "KnowledgeKinds", Village.Knowledge.DefaultKinds,
                "What a village records at all: kinds (boss, dungeon, trader, runestone, ore, fuling, dvergr, landmark, ruin, " +
                "nest, forage, game, foe, biome) or kind:key (ore:copper, landmark:tarpit). nest is the Greydwarf nest (the " +
                "purple spawner) and the skeleton and Draugr bone piles; a destroyed one is forgotten. Anything else, such " +
                "as dolmens, old houses, berry bushes and common rocks, is never recorded.");
            // Greydwarf nests and bone piles count (Tyler, 2026-11-08): a file still on the old default moves.
            if (KnowledgeKinds.Value == Village.Knowledge.OldDefaultKinds)
            {
                KnowledgeKinds.Value = Village.Knowledge.DefaultKinds;
            }

            KnowledgeReachKinds = Admin(config, know, "KnowledgeReachKinds", Village.Knowledge.DefaultReachKinds,
                "Kinds a village learns from its reach, from the survey alone, without anyone seeing them: game, foe or biome. " +
                "Empty by default (T-50): creatures and biomes are only known from where a villager stood (KnowledgeSightRange).");
            // Nothing from the survey alone any more (T-50): a file still on the old default moves.
            if (KnowledgeReachKinds.Value == Village.Knowledge.OldDefaultReachKinds)
            {
                KnowledgeReachKinds.Value = Village.Knowledge.DefaultReachKinds;
            }

            KnowledgeSightRange = Admin(config, know, "KnowledgeSightRange", 40f,
                "How far (meters) a villager sees a wild creature from where he stands, with nothing solid in the way. That is " +
                "how the village learns where animals and creatures are; a biome is learned by standing in it.");
            KnowledgeSight = Admin(config, know, "KnowledgeSight", 100f,
                "Only for kinds listed in KnowledgeReachKinds: how far past the last ground the villagers walk an animal " +
                "ground or biome edge can be made out (twice that across water).");
            KnowledgeKeep = Admin(config, know, "KnowledgeKeep", 60,
                "Discoveries kept on each village's hearth. Past that, the most ordinary and oldest go first.");
            KnowledgeCommonDays = Admin(config, know, "KnowledgeCommonDays", 2,
                "Days after which everyone in the village has heard of a discovery. Before that only the one who saw it, " +
                "and those he told in a chat, can talk about it.");
            RumorChance = Admin(config, know, "RumorChance", 0.4f,
                "Chance that a villager who knows something of the land has it on his mind when he picks a line (0 to 1).");
            KnowledgeRequests = Admin(config, know, "KnowledgeRequests", true,
                "Requests, contracts and talk about what the village needs say where the village believes it can be found, " +
                "or that nobody knows.");
            HarvestReach = Admin(config, know, "HarvestReach", true,
                "Villagers fell, mine, hunt and forage further from the hearth as the village grows (HarvestReachByStage).");
            HarvestReachByStage = Admin(config, know, "HarvestReachByStage", "1, 1.15, 1.35, 1.6",
                "How much further than the usual radius (45 to 55 m) villagers work at each stage: camp, hamlet, village, town.");
            HarvestReachMax = Admin(config, know, "HarvestReachMax", 90f, "The furthest villagers go from the hearth to work (meters).");
            MapTable = Admin(config, know, "MapTable", true,
                "A village puts the game's cartography table by its hearth. Reading it copies some of the village's places to " +
                "your map as pins (see MapTableShare). Animal grounds and biome edges are never pinned.");
            MapTableFromStage = Admin(config, know, "MapTableFromStage", 2, "Stage from which a village has a map table: 1 camp, 2 hamlet.");
            MapTablePrefab = Admin(config, know, "MapTablePrefab", "piece_cartographytable",
                "The piece used for the village's map table. Vanilla has only the cartography table; Hildir's small map " +
                "table is part of her camp and is not a piece (mods add one as hildir_maptable_coe).");
            MapTableProp = Admin(config, know, "MapTableProp", "Hildir_camp:map",
                "The village's map table copied from a location's own model (D-047), as location:child, the child found by " +
                "the start of its name. Hildir's small map on a stool by default. 'vh props Hildir_camp' lists the names. " +
                "Empty, or not found: MapTablePrefab is used.");
            MapTableShare = Admin(config, know, "MapTableShare", 0.5f,
                "Share of the village's places that its map table shows (0 to 1), picked at random once per place and kept, " +
                "so the same places show each time. Boss altars always show.");
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
            // Mountains cultures equally common (Tyler, 2026-11-08, D-039): a file still on the old default moves.
            if (CultureMap.Value == Village.Cultures.OldDefaultMap)
            {
                CultureMap.Value = Village.Cultures.DefaultMap;
            }

            // The Mistlands tower culture was renamed Lamari (D-046); a saved map keeps working.
            if (CultureMap.Value.Contains("caucasian-highland"))
            {
                CultureMap.Value = CultureMap.Value.Replace("caucasian-highland", "lamari");
            }
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
                "How far away (meters) a villager starts shooting at a listed flying creature.");
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
                "A village also uses it when Plains ground lies within this many meters of its hearth. 0: biome only.");
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
                "A village also uses it when Mistlands ground lies within this many meters of its hearth. 0: biome only.");
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

            FightResponders = Admin(config, defenders, "FightResponders", 3,
                "Most villagers who go after a threat: the protectors nearest to it (or anyone following the horn). Only " +
                "they call to arms. Everyone else keeps working, or moves toward the hearth when the fight comes close.");
            FightBackRange = Admin(config, defenders, "FightBackRange", 3f,
                "Any grown villager with a creature this close, or one that just hurt him, fights back with his weapon " +
                "instead of running. Children run to the hearth.");
            FightFleeRange = Admin(config, defenders, "FightFleeRange", 18f,
                "Villagers who are not fighting go toward the hearth or their home when a threat is this close while a " +
                "protector fights it.");
            FightLeash = Admin(config, defenders, "FightLeash", 30f,
                "Responders chase a threat no further than this many meters past the village's edge, then come home.");
            MeleeStrength = Admin(config, defenders, "MeleeStrength", 0.8f,
                "How hard villagers' weapon blows land against the weapon's full damage (the defender damage multiplier " +
                "comes on top for the creatures a profile covers).");
            ArrowSmallHealth = Admin(config, defenders, "ArrowSmallHealth", 60f,
                "Creatures with at most this much health count as small: one or two arrows bring them down " +
                "(deathsquitos, ticks, deer).");
            ArrowHitsBig = Admin(config, defenders, "ArrowHitsBig", 4,
                "Bigger creatures (seekers, lox, trolls) take at least this many villager arrows: one arrow never takes " +
                "more than this share of their health.");
            KeepApart = Admin(config, defenders, "KeepApart", true,
                "Villagers and the creatures in KeepApartCreatures leave each other alone: those creatures only turn on a " +
                "villager who comes very close, and turn back before they wander into a village. Villagers keep away from " +
                "the camps in KeepApartAvoid when they fell, mine, hunt or forage.");
            KeepApartCreatures = Admin(config, defenders, "KeepApartCreatures",
                "Lox:0, Goblin:8, GoblinArcher:8, GoblinBrute:8, GoblinShaman:8, Seeker:8, SeekerBrute:8, SeekerBrood:5, Tick:4, Gjall:0",
                "Creature prefab name: meters within which it still turns on a villager (0: never). Comma separated.");
            KeepApartMargin = Admin(config, defenders, "KeepApartMargin", 25f,
                "Those creatures turn back this many meters before the village's edge.");
            KeepApartAvoid = Admin(config, defenders, "KeepApartAvoid", "GoblinCamp:70, TarPit:45",
                "Locations villagers do not work near: the start of the location's name: meters to keep away. Comma separated.");
            MistlandsDemist = Admin(config, defenders, "MistlandsDemist", true,
                "A village in the Mistlands keeps the mist off itself, and its people push the mist back around them as " +
                "the Mistwalker does.");
            MistlandsDemistRadius = Admin(config, defenders, "MistlandsDemistRadius", 0f,
                "Meters of clear air around a Mistlands village's hearth. 0: the village's radius plus 10.");
            FightBowFrom = Admin(config, defenders, "FightBowFrom", 8f,
                "Responders shoot at anything further than this (meters) that they can see, and close in with the weapon " +
                "when it is nearer. Everyone who fights carries a bow and arrows of the village's tier.");
            FightRetreatHealth = Admin(config, defenders, "FightRetreatHealth", 0.25f,
                "A villager in a fight with less than this share of his health left goes back to the hearth to heal.");
            FightTargetOrder = Admin(config, defenders, "FightTargetOrder", true,
                "Creatures that go for villagers pick a protector before anyone else near it, and a child last.");
            MistlandsVillagerDemist = Admin(config, defenders, "MistlandsVillagerDemist", 6f,
                "Meters of clear air around each villager of a Mistlands village. 0: none.");
            MistlandsDemisterPrefab = Admin(config, defenders, "MistlandsDemisterPrefab", "dverger_demister_large",
                "The big Dvergr demister a Mistlands village puts up round its edge, so it looks as if they keep the mist " +
                "off. 'vh demist' lists the game's prefabs that carry a demister.");
            MistlandsDemisters = Admin(config, defenders, "MistlandsDemisters", 3,
                "How many big demisters a Mistlands village puts up, spread evenly round its edge. 0: none.");
            MistlandsDemisterCost = Admin(config, defenders, "MistlandsDemisterCost", "Wood:10, Stone:10",
                "What the builder takes from the chest for each big demister (it is not a piece players can build, so it " +
                "has no recipe of its own): material:amount, comma separated.");
        }

        /// <summary>Section "4b - Generator": 'vh gen' and 'vh place'.</summary>
        private static void BindGenerator(ConfigFile config)
        {
            const string gen = "4b - Generator";
            GenCandidates = Admin(config, gen, "GenCandidates", 8,
                "How many seeds 'vh gen' tries for one request. It keeps the one that passes the most checks, then scores " +
                "highest against the keep and drop review (1 to 32; more takes longer).");
            GenLevelGround = Admin(config, gen, "GenLevelGround", true,
                "Level the ground under a design that 'vh gen' or 'vh place' builds, as 'vh preview' does.");
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

        /// <summary>
        /// The child body settings (T-28, D-049), one set for boys and one for girls, as sliders in the config manager.
        /// Each is against a grown villager of the same sex and applies the moment it changes. Height scales the whole
        /// child; the rest reshape the body at that size (Head 1.35 is a head 35% bigger than the scaled-down body
        /// would have). All of them ease to 1 as the child grows up.
        /// </summary>
        private static void BindChildShape(ConfigFile config, string section)
        {
            // Starting values from the proportions of a child of about seven: about 1/6 of his height is head (1/7.5
            // for a grown man), the legs are a smaller share of the height, and shoulders and hips are narrow.
            float[][] defaults =
            {
                new[] { 0.62f, 1.35f, 0.8f, 1f, 0.92f, 0.88f, 0.85f, 0.9f },
                new[] { 0.6f, 1.35f, 0.8f, 1f, 0.92f, 0.88f, 0.85f, 0.92f },
            };
            string[] what =
            {
                "Overall size against a grown villager, for a newborn child (he grows to full size over four days).",
                "Head size against the scaled-down body.",
                "Neck length.",
                "Torso (the spine and everything on it is scaled by this, then put back for the neck, head and arms).",
                "Arm length.",
                "Leg length (the body is lowered to keep the feet on the ground).",
                "Shoulder width.",
                "Hip width.",
            };
            for (int sex = 0; sex < 2; sex++)
            {
                for (int i = 0; i < ChildShapeParts.Length; i++)
                {
                    string key = (sex == 0 ? "ChildBoy" : "ChildGirl") + ChildShapeParts[i];
                    ChildShape[sex][i] = config.Bind(section, key, defaults[sex][i], new ConfigDescription(
                        (sex == 0 ? "Boys: " : "Girls: ") + what[i],
                        new AcceptableValueRange<float>(i == 0 ? 0.3f : 0.4f, i == 0 ? 1f : 2f),
                        new ConfigurationManagerAttributes { IsAdminOnly = true }));
                }
            }
        }

        /// <summary>Section "9 - Test villages": what 'vh village spawn' makes when no numbers are given.</summary>
        private static void BindTestVillages(ConfigFile config)
        {
            const string test = "9 - Test villages";
            TestVillageBuildings = Admin(config, test, "TestVillageBuildings", "1, 3, 6, 10",
                "Buildings a test village gets at each stage when no number is given: camp, hamlet, village, town.");
            TestVillageVillagers = Admin(config, test, "TestVillageVillagers", "2, 4, 7, 12",
                "Villagers a test village gets at each stage when no number is given: camp, hamlet, village, town.");
            TestVillagePiecesPerFrame = Admin(config, test, "TestVillagePiecesPerFrame", 60,
                "Building pieces a test village puts up each frame. Lower it if the game stalls while one is set up.");
            TestVillageFrameMs = Admin(config, test, "TestVillageFrameMs", 6f,
                "Milliseconds a test village may spend each frame putting up pieces, fences and plants before it waits " +
                "for the next frame. Lower: smoother frame rate, slower setup.");
        }

        private static ConfigEntry<T> Admin<T>(ConfigFile config, string section, string key, T value, string description)
        {
            var attributes = new ConfigurationManagerAttributes { IsAdminOnly = true };
            return config.Bind(section, key, value, new ConfigDescription(description, null, attributes));
        }
    }
}
