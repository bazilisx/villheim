# Related mods

Mods for Minecraft and Valheim that deal with villages, villagers, colonies and settlements that grow. Grouped by how close they are to what Villheim is going for: villages that live and grow on their own, Millénaire style. Each entry has a short note on what it does and what Villheim can learn from it.

Last reviewed November 2026. Versions and features change, so check the linked page before relying on any detail.

## At a glance

| Mod | Game | Villages grow on their own | NPC jobs | Buildings upgrade | Biome or culture styles | Trading | Raids or war |
|---|---|---|---|---|---|---|---|
| Millénaire | Minecraft | Yes | Yes | Yes | Yes (cultures) | Yes | Yes |
| Recruits: Village Expansion | Minecraft | Yes | Yes | | | | Yes |
| Evolving Villages | Minecraft | Yes | | | | | Yes |
| Village Architect | Minecraft | Yes | Architects | Repairs | Yes (biome villages) | | |
| VikingSettlements | Valheim | Wild villages are static; your own settlement grows | Yes | Tiers | Meadows, Black Forest, Plains | Yes | Yes |
| Valheim Alive Wars | Valheim | Unclear | | | | | Yes |
| MineColonies | Minecraft | You direct it | Yes | Yes | Yes (styles) | | Yes |
| Sim-U-Kraft | Minecraft | You direct it | Yes | | | | |
| VikingColonies | Valheim | You direct it | Yes | Hut levels 1 to 5 | | | |
| Vikings for Hire | Valheim | Your settlement | Yes | | | Yes | |

## 1. Villages that grow on their own

These are the closest to Villheim.

### Millénaire (Minecraft)
- Links: [CurseForge](https://www.curseforge.com/minecraft/mc-mods/millenaire), [Wiki](https://millenaire.wiki.gg/)
- NPC villages loosely based on 11th century cultures (Norman, Indian, Japanese, Mayan, Byzantine, Inuit, Seljuk). Villages build and upgrade their own buildings, villagers have families, and you help a village grow by trading with it. With enough reputation a village will build you a house. Villages can trade with each other or go to war.
- Borrow: cultures with their own building sets, buildings that upgrade in place, reputation unlocking things, a village building a house for the player, inter-village relations.

### MillOptimize (Minecraft, Millénaire addon)
- Links: [Modrinth](https://modrinth.com/mod/milloptimize)
- Reduces Millénaire's NPC AI load and adds village persistence for big settlements.
- Borrow: a reminder that large villages need throttled AI and catch-up logic. Villheim already only simulates loaded villages and catches up on return.

### Recruits: Village Expansion (Minecraft)
- Links: [CurseForge](https://www.curseforge.com/minecraft/mc-mods/villager-recruits-village-expansion), [Modrinth](https://modrinth.com/project/mkSW0fEr)
- Addon for Recruits and Workers that makes villages fully autonomous: they build new structures, expand territory, manage soldiers and assign jobs. Lets addon authors swap in their own building designs.
- Borrow: villages claiming territory over time, soldiers as a role, letting other mods supply building designs.

### Evolving Villages (Minecraft)
- Links: [CurseForge](https://www.curseforge.com/minecraft/mc-mods/evolving-villages)
- Villagers build and grow into civilizations, with dialogue, politics, takeovers and a mage system.
- Borrow: politics between villages, a village changing hands.

### Village Architect (Minecraft)
- Links: [CurseForge](https://www.curseforge.com/minecraft/mc-mods/village-architect)
- Adds an Architect profession. Architects work out what their village needs and build vanilla village buildings for their biome, and repair damage.
- Borrow: this is close to Villheim's "existing designs only" rule. A need-driven build order (homes when crowded, workshops when there are workers) and villagers repairing their own buildings.

### VikingSettlements (Valheim)
- Links: [Thunderstore](https://thunderstore.io/c/valheim/p/morosmods/VikingSettlements/)
- Inhabited settlements in world generation: Meadows villages (longhouse, cabins, farm, maypole, watchtower, trader), fortified Black Forest outposts and Plains steadings. Settlers defend their home and turn hostile if attacked. You can build your own settlement with a banner, assign ten jobs, and grow it from Hamlet to Village to Town. Includes raids by bandits and rival clans, recruitable war parties and veteran settlers.
- Borrow: biome-specific settlement types, jobs that feed each other (hunters bring meat, cooks feed the settlement), settlement tiers unlocking bigger buildings, hooking into Valheim's own raid events.

### Valheim Alive Wars (Valheim)
- Links: [Nexus](https://www.nexusmods.com/valheim/mods/3417)
- Generates NPC settlements that go to war with each other, with settings for spawn rate, max settlements, NPC counts, war range and building height. Keeps a per-world settlement record.
- Borrow: settlements interacting with each other at a distance.

## 2. Colonies you found and run

The player places a town hall or banner and NPCs build and work for them. Less autonomous than Millénaire, but full of job and building systems worth copying.

### MineColonies (Minecraft)
- Links: [CurseForge](https://www.curseforge.com/minecraft/mc-mods/minecolonies)
- The big colony builder: town hall, builder's hut, citizen huts, dozens of worker jobs, guards, raids by barbarians, buildings that level up, many building styles, and a planning tool for placing buildings and roads.
- Borrow: production chains (forester cuts trees, the builder uses the planks), hut levels raising capacity, a warehouse with couriers, building styles as swappable sets.

### Mind of the Colony (Minecraft, MineColonies addon)
- Links: [itch.io](https://goodbird-git.itch.io/mindofthecolony)
- Gives MineColonies citizens moods, worries and dialogue that react to what happens in the colony.
- Borrow: villager lines that react to village events (a new building, a death, a raid).

### Sim-U-Kraft Reloaded and New: Sim-U-Kraft (Minecraft)
- Links: [Sim-U-Kraft Reloaded](https://www.curseforge.com/minecraft/mc-mods/sim-u-kraft-reloaded), [New: Sim-U-Kraft](https://www.curseforge.com/minecraft/mc-mods/new-sim-u-kraft)
- SimCity and The Sims in Minecraft: hire folks to build houses, roads and hundreds of buildings, with builders, bakers, farmers, lumberjacks and more.
- Borrow: roads as their own build step, lots of small single-purpose buildings.

### Village Masters (Minecraft)
- Links: [Modpack Index](https://www.modpackindex.com/mod/204890/village-masters)
- Found a town hall in an existing village and its villagers become your people. They build block by block from materials in your storehouses, cut wood, farm, carry goods, eat, grow in number and defend the town.
- Borrow: builders fetching materials from storage and placing a building piece by piece, visibly.

### Once Upon a Town (Minecraft)
- Links: [Modpack Index](https://www.modpackindex.com/mod/158456/once-upon-a-town)
- Reworks plains villages into projects you grow and specialize. Citizens need food, and advanced buildings need a minimum number of residents.
- Borrow: population thresholds for unlocking buildings (a market needs five villagers).

### Smart Villagers (Minecraft)
- Links: [Modpack Index](https://www.modpackindex.com/mod/171837/smart-villagers)
- Villagers farm, gather wood, garden, mine, build and repair village houses using shared storage.
- Borrow: shared village storage that every job reads from and writes to.

### VikingColonies (Valheim)
- Links: [Thunderstore](https://thunderstore.io/c/valheim/p/DaAlmyte/VikingColonies/), [Source](https://github.com/DaAlmyte/VikingColonies-source) (MIT)
- MineColonies for Valheim. A Chieftain's Camp founds the colony and four settlers arrive. Longhouses provide beds, and a newcomer arrives each day there is a free bed and food. Hut levels 1 to 5 follow the boss eras, raised by hanging boss trophies. Settlers have moods, traits and trades, eat daily, shelter at night, and leave a cairn when they die. The camp itself grows from a fire pit to a bonfire with a chieftain's seat.
- Borrow: boss progression gating village growth, the central camp growing in stages, a free bed plus food as the rule for newcomers, settlers walking in from the edge of the village. MIT source is a good reference for Valheim NPC code.

### Vikings for Hire (Valheim)
- Links: [Thunderstore](https://thunderstore.io/c/valheim/p/Worobeyko/VikingsForHire/)
- Wandering Vikings with names, traits, loyalty and grudges that you hire as companions or settle as workers (lumberjack, miner, farmer, cook, brewer, guard and more). Workers use real tools and tool tiers, fell trees away from your buildings, sort their haul into chests and sleep in their own beds. Has its own settlement navigation that maps floors, stairs and doorways.
- Borrow: woodcutters avoiding buildings, tool tiers deciding what a villager can harvest, beds as homes, a custom navigation layer for walking through buildings.

### Hired Hands (Valheim)
- Links: [Thunderstore](https://thunderstore.io/c/valheim/p/Spronglehump/HiredHands/)
- Post contracts on a hiring board to hire Vikings who chop, mine, farm, cook, tend animals, look after the base and guard it. Paid in coins and fed daily; upgrade the board with boss trophies for better hires.
- Borrow: upkeep in food, boss trophies as upgrade keys.

### Hearthfolk (Valheim)
- Links: [Nexus](https://www.nexusmods.com/valheim/mods/3535)
- Persistent residents with jobs, equipment, routines, needs and personalities. They use doors, gather, farm, defend and sort storage.
- Borrow: daily routines and needs.

### Fuling Workforce (Valheim)
- Links: [Thunderstore](https://thunderstore.io/c/valheim/p/Crasssam/FulingWorkforce/)
- Recruit Fulings and assign them to jobs such as guard, farmer, kiln and smelter operator, animal keeper, repairer, fire keeper, chest sorter and lumberjack, each tied to a post.
- Borrow: Fulings as a culture for a Plains village; job posts as a simple way to anchor work.

### ValheimVillages (Valheim)
- Links: [Thunderstore](https://thunderstore.io/c/valheim/p/idontunderstand/ValheimVillages/)
- Villagers map out an enclosed village, find stations and chests inside the walls, and fill work orders using the materials they find. Rebakes the navmesh after building changes.
- Borrow: detecting a village's real footprint from its walls, rebaking navigation after a building goes up.

## 3. Villagers as people

Mods that make NPCs feel alive, without village growth.

### MCA Reborn (Minecraft)
- Links: [CurseForge](https://www.curseforge.com/minecraft/mc-mods/minecraft-comes-alive-reborn), [Source](https://github.com/Luke100000/minecraft-comes-alive) (GPL 3.0)
- Replaces villagers with player-like people: relationships, marriage, families, genetics, aging, guards and village management.
- Borrow: families and children as a population source, villagers with relationships.

### Guard Villagers (Minecraft)
- Links: [CurseForge](https://www.curseforge.com/minecraft/mc-mods/guard-villagers)
- Armed guards spawn in villages. Clerics heal guards and villagers, and smiths repair guard gear a few times a day.
- Borrow: a guard role that scales with the village, villagers supporting each other.

### Villager Workers 2 and Recruits (Minecraft)
- Links: [Villager Workers 2](https://www.curseforge.com/minecraft/mc-mods/workers)
- Hireable workers (miner, lumberjack, farmer, fisherman, merchant, herders) with inventories that deposit into chests. Better tools make them work faster. Recruits adds armies, factions and diplomacy.
- Borrow: tool quality affecting work speed.

### Villager Workforce (Minecraft)
- Links: [CurseForge](https://www.curseforge.com/minecraft/mc-mods/villager-workforce)
- Five jobs (lumberjack, miner, farmer, guard, smelter) tied to a workstation block, depositing into chests.
- Borrow: one workstation per job as the anchor for a villager's day.

### Norse Personality Construction System (Valheim)
- Links: [Source](https://github.com/OrianaVenture/VentureValheim) (MIT)
- Configurable NPCs built from the player model with random looks, dialogue and quests. Villheim's villager setup follows how this mod builds NPCs.
- Borrow: already used. Quests and dialogue trees are the next pieces worth looking at.

### RRR Core / RRR NPCs and Friendlies Reloaded (Valheim)
- Links: [RRR NPCs](https://thunderstore.io/c/valheim/p/neurodr0me/RRRNpcs/v/0.2.4), [Friendlies Reloaded](https://thunderstore.io/c/valheim/p/Horem/Friendlies_Reloaded)
- RRR adds configurable human NPCs (now deprecated). Friendlies Reloaded adds tiers of friendly NPCs per biome that unlock as bosses fall.
- Borrow: NPC tiers following boss progression.

### PopVillages (Valheim)
- Links: [Thunderstore](https://thunderstore.io/c/valheim/p/Fantu/PopVillages)
- Populates the vanilla abandoned villages with commoners and the occasional guard, scaled by what buildings are there.
- Borrow: the same idea Villheim uses, bringing vanilla ruins back to life.

### VillageNPCs (Valheim)
- Links: [Thunderstore](https://thunderstore.io/c/valheim/p/blacks7ar/VillageNPCs/v/1.0.8)
- Craftable Orbs of Life summon random-looking NPCs who roam, give hints and greet you.

### Kukus Villagers (Valheim)
- Links: [Nexus](https://www.nexusmods.com/valheim/mods/2131)
- Villager beds spawn villagers and defense posts give them places to guard, with a commander item to give orders.
- Borrow: beds as spawn points.

### VillageLife (Valheim)
- Links: [Thunderstore](https://thunderstore.io/c/valheim/p/Villeim/VillageLife)
- Build a Village Hall and create merchants, quest givers, guards and villagers, with day and night schedules, config-driven shops, quests and dialogue.
- Borrow: JSON files for shops, quests and dialogue so content can be edited without code.

### Balrond Idle Actors (Valheim)
- Links: [Thunderstore](https://thunderstore.io/c/valheim/p/Balrond/balrond_IdleActors/v/1.1.0/)
- Placeable, stationary NPCs: talkers with ambient dialogue and traders with configurable shops, in human and Dvergr variants.

### Marketplace and Server NPCs (Valheim)
- Links: [Thunderstore](https://thunderstore.io/c/valheim/p/KGvalheim/Marketplace_And_Server_NPCs_Revamped/v/9.1.9/), [Trav's alternative](https://thunderstore.io/c/valheim/p/Travio/Travs_Valheim_Server_NPCs_and_Marketplace/)
- Server NPCs for trading, banking, quests, teleport hubs, dialogue trees and territories.
- Borrow: a village trader and quest giver once a village is big enough.

### Valadriel's Mad NPCs (Valheim)
- Links: [Thunderstore](https://valheim.thunderstore.io/package/ValadrielTheMad/ValadrielsMadNPCs/)
- 80 tamable, breedable NPCs, including friendly Vikings and commoners in Draugr villages.

## 4. Sources of building designs

Villheim only builds existing designs, so mods that add locations are a direct source of new buildings.

### More World Locations AIO (Valheim)
- Links: [Thunderstore](https://thunderstore.io/c/valheim/p/warpalicious/More_World_Locations_AIO/)
- Lots of handmade locations across biomes. Villheim already uses its intact houses, taverns, barns, sawmill, forges and towers automatically when it is installed.

### Expand World Data and Expand Locations (Valheim)
- Links: [Expand World Data](https://thunderstore.io/c/valheim/p/JereKuusela/Expand_World_Data/v/1.68.0/), [Expand Locations](https://thunderstore.io/c/valheim/p/Ashenius/Expand_locations)
- Expand World Data lets you add and change locations, including locations made from blueprints. Expand Locations is a pack of extra randomized locations built on it.
- Borrow: blueprint-based locations mean players could share village buildings as files. Any location these add can be used as a Villheim design by name.

### ChoiceTheorem's Overhauled Village (Minecraft)
- Links: [CurseForge](https://www.curseforge.com/minecraft/mc-mods/choicetheorems-overhauled-village)
- New and reworked villages for every biome, with variants that adapt to other biome mods.
- Borrow: one village layout per biome, with variants.

## Ideas worth taking, in rough priority

1. A need-driven build order: homes when crowded, workshops when there are workers for them, a farm when food runs low (Village Architect, Once Upon a Town).
2. Villagers placing a building piece by piece instead of all at once (Village Masters, MineColonies).
3. Buildings that upgrade in place by swapping to a better design of the same role (Millénaire, VikingColonies hut levels).
4. The village center growing in stages, from a fire pit to a longhouse with a chieftain's seat (VikingColonies).
5. Boss progression unlocking tiers of buildings and gear (VikingColonies, Friendlies Reloaded, Hired Hands).
6. Jobs that feed each other through shared village storage (VikingSettlements, MineColonies, Smart Villagers).
7. Woodcutters avoiding buildings and using tool tiers (Vikings for Hire).
8. Village reputation, trade, and a village building the player a house (Millénaire).
9. Cultures per biome: Fuling camps in the Plains, Dvergr outposts in the Mistlands (Millénaire cultures, Fuling Workforce).
10. Raids through Valheim's own event system (VikingSettlements).

## 5. Survey of 2026-11-08: the world between villages

Sources read for traders, hermits, outposts, roads, dialogue and gear. What Villheim does with them is in
`docs/WORLD_LIFE.md`. Licence decides use: MIT and Unlicense may be copied with the notice, everything else is ideas
only.

| Mod or source | Game | Licence | What is worth having |
|---|---|---|---|
| Living Factions (under2ker) | Valheim | none (ideas only) | Closest to Villheim: factions found camps that grow from hamlet to city, build from vanilla pieces, send bands, lay roads, hold outposts. Bands are records that become NPCs within 130 m of a player. Outposts (two per faction, resource camp or road post). Roads by A* in a corridor, painted near the player. Daily fortune rolls. Gear by settlement tier. |
| ProceduralRoads (jneb802) | Valheim | MIT | Roads between locations at world generation: A* over 16 directions on an 8 m grid with slope, water and river costs, written into `TerrainComp` as zones spawn, vegetation cleared on the road. |
| AntTrails (egaroib) | Valheim | MIT | Footsteps wear dirt paths that fade if unused; very busy paths can turn to stone. |
| Offline Companions Reborn | Valheim | MIT | Tagged barks (`[home,night,!rain]`), a priority queue (order, problem, event, ambient) with repeat timers; NPC repairs at a real station. |
| CustomRaids (ASharpPen) | Valheim | Unlicense | Adding `RandomEvent`s to `RandEventSystem`, conditions and centring on a point. |
| TraderQuests (RustyMods) | Valheim | none | A travelling trader made by subclassing `Trader`; bounties and treasure that spawn only when the player reaches the pinned spot. |
| Norsemen (RustyMods) | Valheim | none | Typed talk pools with a shared cooldown so a crowd never talks at once; weighted gear sets gated by boss keys. |
| TravelingHaldor (OdinPlus) | Valheim | README only | Config set for a roaming trader: interval, chance, duration, spawn distance, biome, required boss key, item list, despawn when trapped. |
| ServerGuide (yesu0725) | Valheim | "free to use", no licence file | Conversation nodes with requirements, rewards and a resume point; about 45 trigger types. |
| Vikings Village (Northarun) | Valheim | README only | Village stone as a ward, markers for homes and work spots, daily contracts, reputation tiers, a 9-chapter saga. |
| HaldorBounties, WanderingCompanions (ProfMags) | Valheim | README only | Bounty board with daily contracts; warbands idle round a fire until a player comes near; beaten wanderers join you. |
| VanillaNPC, ImmersiveTrader, TravelingMerchant (BranchOfYore) | Valheim | README only or All Rights Reserved | A beggar and a drunkard who sells a trader's location; cargo runs between traders for reputation; a merchant who takes a free seat at a bonfire. |
| Millénaire 9.0.3 data | Minecraft | All Rights Reserved | Hamlets owned by a parent village; lone buildings (hermits, bandit lairs) with a distance from spawn; merchants who move between villages by what they lack; village relations with a drift that leans where it stands; quests with villager roles and reputation. |
| MCA Reborn | Minecraft | GPL | Dialogue key fallback chains and numbered variants; weighted outcomes with per-player fatigue; expiring memories; mood bands that change where villagers go; traits that children inherit. |
| MineColonies | Minecraft | GPL | Tavern visitors who can be recruited; skills with complementary and adverse pairs, capped by the home's level; two-citizen quests with timed mood rewards; chat priority (blocking needs before small talk). |
| Minecraft wandering trader | Minecraft | game | A daily attempt with a rising chance (25, 50, 75%), anchored to the village bell, despawns after two days. |
| RimWorld, Dwarf Fortress, Stardew Valley, Skyrim, Bannerlord, Kenshi, Enshrouded, Medieval Dynasty | other games | games | Pair opinions from talk types; only extreme personality facets show; lines keyed by day, weather and spot; schedules and two-NPC scenes; caravans that carry goods for profit and can be raided; rescued specialists unlock crafting; output from skill and needs. |

Clones from the survey were kept in `/tmp/study` for the session and are not committed.

## 6. Survey of 2026-11-08 night: villager minds

What makes NPCs seem to think: what they notice, what they remember, how they talk to each other and how they
change over days. Read on the night of 2026-11-08 from the games' wikis and, for MCA Reborn, its data files (GPL,
read for ideas in `/tmp/study-minds`, not copied). Games are ideas only; so is every mod without an MIT or Unlicense
licence. What was built from it is in `docs/WORLD_LIFE.md` ("Built (2026-11-08 night, villager minds)").

| Source | Licence | Mechanics worth taking (with the numbers) | Villheim file |
|---|---|---|---|
| Minecraft villagers (gossip) | game | Each villager keeps memories of each player by type. Gain, decay every 20 minutes, sharing cost, cap, weight: trading 4 / 2 / 20 / 25 / x1; minor positive 25 / 1 / 5 / 25 / x1; minor negative (hit) 25 / 20 / 20 / 200 / x-1; major negative (killed a villager nearby, every witness in 16 blocks) 25 / 10 / 10 / 100 / x-5; major positive (cured) 20 / 0 / never shared / x5. Gossip passes on when two villagers meet, weakened by the sharing cost. Late in the day everyone gathers at the bell and mingles; babies play tag. | `Villagers/PlayerMemory.cs` (deeds, witnesses, word passing in chats) |
| Stardew Valley | game | 250 points a heart, ten hearts. Talking +20 once a day, gifts love +80, like +45, neutral +20, dislike -20, hate -40, two a week, x8 on a birthday; -2 a day unvisited. Lines keyed by weekday, heart level, season, weather and place, with fallbacks. A villager near a bin you rummage in speaks up (-25). Heart events at set levels. | `Villagers/Dialogue.cs` (place tags, fatigue), `PlayerMemory.cs` (visits, gifts) |
| RimWorld (social) | game | Opinion -100 to 100: rival below -20, friend above 20. Random interactions by weight: chitchat 1 (+0.66), deep talk 0.075 (+15 for 20 days, x0.1 to x3 by compatibility), slight 0.02 (-5), insult 0.007 (-15), kind words 0.01 (only kind pawns, +15). Slights and insults grow x6 at opinion -100 and x0 at +100. An insult starts a fight 4% of the time, a slight 0.5% (x2.5 tipsy, x4 drunk); after a fight it is cathartic (+38) or angering (-22) at even odds. | `Villagers/FreeTime.cs` and the chat sections (pair tags, rival scenes) |
| RimWorld (inspirations) | game | Only above 50% mood: mean days between inspirations = 410 - 400 x mood (210 days at 50%, 10 at 100%). One at a time, eight days or one use: work frenzy x1.8 work speed, inspired creativity (+2 quality). Weighted 1 / 2.5 / 5 by passion. | `Villagers/Skills.cs` ("a good day": a happy villager works faster for a while) |
| Dwarf Fortress (facets) | game | 50 facets 0 to 100; only values outside 40 to 60 show (78% of values fall inside); 91+ and 9- are 0.4% each. Facets change which thoughts an event gives (a cheerless dwarf feels nothing at work he likes). Big differences in some facets breed grudges. Memories can shift facets over years. | `Villagers/Personality.cs` (traits shown only at the extremes; already done for voice and facts) |
| MCA Reborn | GPL | Per player memory: hearts, interaction fatigue, last seen day. Chat outcomes rolled from base chances shifted by personality (gloomy x4 on one branch, odd x5 on another) and hearts thresholds (rumours only at 20+ hearts, refused at -5). Mood -15 to 15 in normal life. Dialogue keys fall back from specific to plain. | `Dialogue.cs` (per-player topic fatigue), `PlayerMemory.cs` |
| MineColonies | GPL | Citizen skills in complementary and adverse pairs: practice raises the trade's two skills, the adverse one slips; the home's level caps them. Happiness from housing, food, safety, idle days. Requests a citizen walks up with, blocking ones before chit-chat. | `Villagers/Skills.cs` |
| Skyrim (Radiant AI, barks) | game | AI packages by hour (sandbox, eat, sleep, work) pick furniture and idle markers near the spot. Hello and idle lines are conditioned on the player's gear, health, race, guild, crimes and the weather ("You look like you could use some rest."). Two NPCs run short scripted scenes when near. | `Dialogue.cs` (player state tags), `Villagers/Noticing.cs` |
| Skyrim mods: Immersive Citizens, Inconsequential NPCs, Relationship Dialogue Overhaul | mods, no licence for code | Townsfolk shelter in rain, flee fights, use more furniture, keep routines; extra townsfolk with their own schedules; greetings picked by relationship rank so a stranger never gets a friend's line, and lines that stop repeating. | `Dialogue.cs` (player standing tags), `IdleLife.cs` |
| Gothic I and II | game | Every NPC has a day of routines with start and end hours and a waypoint (sleep, smith, sit on a bench, stand and drink). Perceptions: the player drawing a weapon nearby ("Put that away!"), entering a home, stealing, fighting; bystanders gather to watch a fight. Pairs of idle NPCs swap small talk. | `Noticing.cs` (weapon out), `Gatherings.cs` |
| The Sims 2 and 4 | game | Four wants and three fears a Sim at any time, rolled from life state and aspiration, renewed after sleep; a met want gives points, a fear that happens takes them. Moodlets with durations stack into an emotion; objects advertise which need they meet. | `Villagers/Goals.cs` (wants that last days), `Moods.cs` thoughts |
| Medieval Dynasty | game | Villagers have a skill per job that rises while they work it; happiness from housing and food; marriage and heirs. | `Skills.cs` |
| Kenshi | game | Dialogue packages fire on triggers (sees the player, is hit, an ally is down, the player talks) with conditions on traits, health, faction and relations; other squad members interject in the same exchange; lines have chances and repeat limits. | `Dialogue.cs` scenes ("@" answers and "+" chime-ins) |
| Bannerlord | game | Traits (Mercy, Valor, Honor, Generosity, Calculating) from -2 to +2; relation -100 to 100; companions approve or object to the player's choices by their traits. | `PlayerMemory.cs` (what the player did, judged by voice) |
| ValheimCityBuilder (RustyProductions) | Thunderstore, no licence seen | City builder view over Valheim: houses that build themselves piece by piece, needs by class (Karls want meat or honey and mead), upgrades by needs met, settlers who stroll. | none for minds; noted for the design side |
| Offline Companions Reborn | MIT | Tagged barks with a priority queue (order, problem, event, ambient) and repeat timers. | `Dialogue.cs` (already uses tags; nothing copied) |

### Ranked build list (what was worth building first)

1. Per-player memory of deeds (gifts, building, kills near the village, deaths, visits, requests, fights) with
   witnesses and word passing from villager to villager in chats, after Minecraft's gossip. Dialogue reads it.
2. Topic fatigue per player (MCA) and lines bound to places (Stardew): at the forge, the workbench, the fire, the
   chest, the shore, indoors, the edge of the village.
3. What villagers notice (Skyrim, Gothic): weather turning, dawn and dusk, the player's gear, health, weapon out,
   boss trophies, animals and enemies in sight, bosses felled anywhere in the world.
4. Conversations of two and three with replies chosen by the one who answers (Kenshi interjections, Skyrim scenes),
   with pair conditions (friends, rivals, same trade, sweethearts).
5. Skills that grow with practice and scale work speed (MineColonies, Medieval Dynasty), with "a good day" from
   high mood (RimWorld work frenzy, much milder).
6. Wants that last days and change (The Sims): a bigger house, learning a trade, courting, making peace with a rival.
7. Gatherings (Minecraft's bell, Millénaire's speeches, RimWorld's parties): the village turns out for a finished
   building, a newcomer or a pedlar; a feast in the evening after a good hunt; the Jarl's evening words.
8. Small idle actions so nobody stands frozen: glancing at whoever talks, at animals, at the sky in rain, warming
   hands at the fire.

Not reachable: the MineColonies wiki pages on skills and happiness (moved, 404) and the MCA Reborn GitHub wiki
(redirected); the numbers above for those two come from the 2026-11-08 survey and MCA's data files.
