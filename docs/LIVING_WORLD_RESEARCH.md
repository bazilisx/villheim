# Living world research

## Preface

Survey of 2026-11-08 (overnight). Question: what makes NPC settlements in other games and mods feel alive, growing
and changing over time, and what of it fits Villheim. Millénaire is one input among many here; it is covered in
`docs/MILLENAIRE.md`, and the Minecraft and Valheim village mods already read are in `docs/RELATED_MODS.md`. The
world-life plan (visitors, hermits, outposts, trails, caravans) is in `docs/WORLD_LIFE.md`. This doc does not repeat
them; it adds sources and turns them into proposals.

How the sources were read:

- **[code]**: read from the project's source tonight (shallow git clones in `/tmp/lwr`, not committed). Numbers
  marked [code] are the project's own defaults at the time of the clone.
- **[known]**: game mechanics from earlier reading and play knowledge. Web pages could not be opened tonight
  (WebFetch was turned off for the unattended run and the Chrome tools were not used), so these were not checked
  against the page. The URLs are the pages to check before building on a number.

Licence decides use. Only MIT, Unlicense and Apache code may be copied, with its notice. Everything else (GPL, All
Rights Reserved, Creative Commons NonCommercial, custom licences, no licence, and every commercial game) is ideas only.

Villheim files named under "For Villheim" are in `src/Villheim.Logic/Village` and `src/Villheim.Logic/Villagers`.

## By source

### Minecraft mods

#### MCA Reborn (Minecraft Comes Alive) [code]
- Licence: GPL-3.0. Ideas only.
- Village components run on a per-minute roll: `marriageChancePerMinute` 0.05, `villagerProcreationChancePerMinute`
  0.05, `adventurerAtInnChancePerMinute` 0.05 per inn building. Procreation has a cooldown of 72,000 ticks (three
  Minecraft days).
- Inn: on a hit, one of ten outcomes: 1 in 10 a wandering trader, 1 in 10 a cultist, otherwise an adventurer, each
  staying 48,000 ticks (two days). A message goes to the village: "X arrived at the inn".
- Guards: `ceil(population x guardSpawnFraction)` guards; a new guard is picked only from adults with no important
  profession and no trade experience, alternating guard and archer. Guard gear level = 0, plus 1 for an armoury,
  plus 1 for a blacksmith (capped at 2).
- Taxes: every 168,000 ticks (seven days), `0.5 x population x tax rate`, paid as items from a weighted list. The
  tax rate moves the village mood: 0 tax +5, low tax +5, high tax -5, very high -10, past that a riot and nothing
  paid.
- A place counts as a village from 3 buildings; below that it is a "settlement" and gets no welcome message.
- Gifts lose value when repeated: a queue of the last 16 gifts, each repeat worth `0.5` less with an exponent of
  0.85, the queue cleared after a day.
- Bounty hunters come for a player every two days when his hearts with the village drop to -150.
- Children start with 100 hearts toward their parents; 40 hearts makes a friend.
- For Villheim: inn rolls map to `WorldLife.cs` visitors and proposal 12 (newcomers at the longhouse); gear by
  buildings maps to `Smithing.cs`; gift fatigue to `Market.cs` and the player gift path in `PlayerReactions.cs`.

#### MineColonies [code]
- Licence: GPL-3.0. Ideas only.
- Happiness 0 to 10, a weighted average of modifiers (weight in brackets): security (4), food (3), homelessness (3),
  social (2), unemployment (2), health (2), slept tonight (1.5), school (1), idle at job (1), mystical site (1).
  Research can raise the result.
- Time-based modifiers: homeless for 7 days the citizen complains (factor 0.75), 14 days he demands (0.5); the same
  7 and 14 for no job; sick for 7 days 0.5. Slept tonight: 2.0 the first night, 1.6 after two, 1.0 after three.
- Security = guards / (workers x 2/3), capped at 2. Social = share of citizens who are not jobless, homeless, sick or
  hungry. Food = (diversity / home level + quality / (home level - 2)) / 2, each capped at 5: a better house wants
  better and more varied food.
- Raids: none on a colony below raid level 75. Raid level = 5 per adult + skill sum / 100 + per built building
  (5 + level squared / 5) + 3 per finished research, times (citizens / max citizens). Raider count = 1 +
  raid level / 60 (capped). Raids come between night 10 and night 14 after the last (`minimum` 10, `average` 14),
  certain past night 16.
- Raid difficulty adapts: starts at 7 (range 1 to 14). If a raid kills more than 15% of the colony, difficulty drops
  by one per 15% lost and the next raid comes 40% of the average later; if under 5% died, difficulty goes up one.
- Tavern: up to `3 x tavern level` visitors. After one arrives the next waits `rand(3000) + (6000 / level) x
  (citizens / max citizens)` ticks, so a full colony gets fewer. Each visitor has a backstory line (picked from a
  numbered list), skills from the recruit cost tier, and a price (an item, count plus 0 to 2). Visitors come in
  through the gatehouse if there is one.
- Disease: a per-day chance scaled by `diseasemodifier` 5; cures are items the healer needs.
- For Villheim: weights and complain/demand days map to `Villagers/Moods.cs` and `Village/VillageMood.cs`; raid level
  and adaptive difficulty map to `Village/Raids.cs`; tavern visitors to `WorldLife.cs` and the longhouse.

#### Guard Villagers [code]
- Licence: assets All Rights Reserved with an explicit ban on AI-directed ports; ideas only.
- Guards attack hostiles that attack villagers within a set range; form a phalanx with shields up; avoid shooting
  through friends; open doors; patrol around workstations.
- Smiths repair guard gear below half durability; clerics heal guards; blacksmiths heal golems below 60 health.
- Ringing the village bell orders guards to follow the player (option: only with Hero of the Village).
- For Villheim: protectors in `Villagers/Roles.cs`; smith repairs of villagers' own gear in `Smithing.cs` and
  `Repairs.cs`; the hearth as a rally point (a horn at the hearth) for proposal 27.

#### Recruits and Workers (talhanation) [code]
- Licence: All Rights Reserved. Ideas only.
- Recruits are hired at a recruit block for a price, keep upkeep (food and pay), lose morale when unpaid or hungry and
  desert at low morale. Factions (teams) claim land, hold diplomacy states (ally, neutral, enemy), and patrols walk
  routes. Workers (farmers, lumberjacks, miners, merchants) work an area set by the player and deliver to a chest.
- Merchant workers run trade routes between two chests on a schedule.
- For Villheim: morale and upkeep for protectors (`Roles.cs`, `Moods.cs`); merchant routes between two village
  chests feed the caravan record plan in `WORLD_LIFE.md`.

#### CustomNPC+ [code]
- Licence: custom ("CustomNPC+ license"): use, share and adapt with terms; not one of MIT, Unlicense or Apache, so
  ideas only.
- NPCs built from data: roles (trader, follower, bank, transporter, guard), dialogues as trees with availability
  conditions (quest done, faction standing, time of day, item held), quests with lines, factions with points and
  standing bands (hostile, neutral, friendly) that change when a member is killed or helped.
- Transporter role: an NPC that moves the player between unlocked locations.
- For Villheim: dialogue availability conditions match the tags in `Villagers/Dialogue.cs`; faction points per
  village match `Relations.cs` (player standing per village is the missing half).

#### Dynamic Trees [code]
- Licence: MIT (DynamicTreesTeam, 2025). Code could be copied, though it is Java for Minecraft and Valheim trees work
  differently, so it is the ideas that carry.
- Trees grow from a seed over time, branches thicken, and full-grown trees drop seeds that plant themselves; felled
  forests regrow on their own. Leaves die back without light.
- For Villheim: `Villagers/Replanting.cs` already plants a sapling per tree felled. A grove that the woodcutter
  thins (fells the oldest, leaves the young) would follow the same idea.

#### Serene Seasons [code]
- Licence: All Rights Reserved. Ideas only.
- Four seasons of three sub-seasons each, 8 days a sub-season by default (96 days a year). Each crop has the seasons
  it grows in; out of season it does not grow. Temperature and snow follow the season; greenhouses override it.
- For Villheim: Valheim has no seasons of its own, but a village calendar (proposal 14) can name the time of year,
  and `Village/Farms.cs` can plant and harvest by it.

### Valheim mods

#### ValheimCityBuilder (RustyProductions)
- Thunderstore page only (versions 1.0.0 to 1.2.2 listed); no public source found under RustyMods on GitHub. The
  page text could not be read tonight, so its settlers, production chains, research and armies are noted from the
  title and the lead's brief only. Check the page before relying on any of it.
- For Villheim: worth reading for production chains and research as a village growth gate.

### Other games with readable source

#### Hospitality (RimWorld mod, Orion) [code]
- Licence: GPL-3.0. Ideas only.
- A visit score from the guest's mood: `lerp(mood rise x 2.75, mood at leaving x 1.35, 0.5)`, where mood rise is
  mood at leaving minus mood on arrival.
- Goodwill moves toward `lerp(-100, 100, score)`, by at most 3 (one guest) to 24 (eight guests) per visit; a change
  smaller than 5 counts for nothing.
- Revisit: liked visits come back in 3 to 12 days (sooner the better the goodwill), disliked in 12 to 30 days, plus
  one day per goodwill point below -25, plus 5 days if the guests were sent away. A good visit has a 20% chance
  (times goodwill / 100) to bring another friendly faction too.
- A gift on leaving: chance lerps from 0 at score 0.2 to 1 at score 0.9, never if a guest died or was sent away.
- A guest whose score is 0.9 or more may ask to join.
- Guests buy goods left in their area and pay for guest beds.
- For Villheim: visitor satisfaction and return timing for `WorldLife.cs` (pedlars, pilgrims, villagers from other
  villages) and `Relations.cs`.

#### Vintage Story traders [code]
- Licence: proprietary, readable for learning and modding the game. Ideas only.
- Trader type is picked from the climate where it spawns: temperature 15 or more and rain 0.4 or less gives the
  desert type, below -4 the cold type, else temperate.
- Every 7 days the trader refreshes: about half its buy and sell slots are replaced, and its money moves toward a new
  wealth roll by 7 to 28% of the gap. Missed refreshes catch up, up to 10 at once, and never while a player is
  trading.
- For Villheim: pedlar stock by biome in `WorldLife.cs`; the village store in `Market.cs` could refresh weekly the
  same way, with catch-up after the player was away.

#### Dwarf Fortress (df-structures) [code]
- df-structures is DFHack's map of the game's memory; the game itself is commercial, ideas only.
- Each creature has 50 personality facets (0 to 100), 34 cultural values and about 30 needs (socialize, drink, pray,
  stay occupied, be creative, excitement, learn, be with family, be with friends, hear eloquence, uphold tradition,
  make merry, craft object, martial training, take it easy, see animal, eat a good meal, fight, argue, wander, help
  somebody, admire art, and more). A need not met for long gives a lasting bad thought; met needs give focus.
- Emotions are typed (about 200) and tied to an event and a strength; memories are kept in short-term and long-term
  slots, and a strong memory can change a value or a facet over time.
- For Villheim: `Villagers/Personality.cs` (facets), `Villagers/Moods.cs` (needs and thoughts).

#### RimWorld storytellers, as written in Vanilla Factions Expanded: Settlers [code]
- Licence: no licence file in the repo; the framework it needs (VanillaExpandedFramework) is CC BY-NC-ND. Ideas only.
- A storyteller is a list of parts, each rolling on its own clock. The main part (Diego Dire): first event after 2
  days, mean time between events 2 days, a big threat at most 13 days after the last, threat points times a random
  0.4 to 1.5. Category weights: misc 5, small threat 3, big threat 1, visitors 1, faction arrival 1, rare 0.5.
- Friendly interaction parts are counted per year (RimWorld year = 60 days): trader caravans 5.5 a year with at least
  2 days between, visitor groups 4.5 a year, travellers more often, and allied help 15 a year, only when the danger
  is high and only for full allies.
- Quests are scripts with slots and outcomes (a wanted outlaw at a map site, a caravan raid, a protection fee demand
  with a pay or fight choice).
- For Villheim: the events director in `WORLD_LIFE.md` (next step 9) can use exactly this shape: one clock per
  category with a mean time, a minimum spacing and a cap on the gap for threats.

#### Inside Gothic (notes on Gothic's AI scripts) [code]
- Documentation repo, no licence file; Gothic is commercial. Ideas only.
- Daily routine: each NPC has a list of (start, end, activity, waypoint), for example sleep 23:00 to 03:00 in the hut,
  sit 03:00 to 05:30, small talk 10:00 to 12:00 at the camp fire. Two NPCs whose routines send them to the same
  waypoint at the same hours "meet by chance" and talk; the script never names the partner.
- Activities look for a free object at the spot (an anvil, a bench); if it is taken the NPC does something else.
- Each activity is a state with start, loop and end; when the clock moves to the next row the state ends cleanly.
- Perceptions: the NPC assesses the player, enemies, someone with a weapon drawn, a body, an item; murder, defeat and
  damage are broadcast to NPCs in range.
- News: a witnessed murder, defeat, theft, or use of someone's things makes a news entry (victim, offender, witness,
  what happened, or "we don't know who did it"). The design spreads it to the witness's guild and friends after a
  while (the spreading code was left commented out in the shipped game).
- For Villheim: routine tables for `Villagers/Brain.cs`, `Chores.cs` and `FreeTime.cs`; witnessed deeds for
  `PlayerReactions.cs` and `Personality.cs` memories; news spreading for the chats in `Social.cs`.

#### Ultima VII schedules (Exult engine) [code]
- Exult is GPL-2.0; Ultima VII is commercial. Ideas only.
- Every NPC's day is cut into eight 3-hour blocks, each with one of about 35 schedule types: sleep, eat, eat at inn,
  farm, tend shop, miner, blacksmith, bake, sew, waiter, preach, patrol, desk work, kid games, dance, loiter, wander,
  sit, talk, duel, thief, lab, graze, and a few more. A schedule type knows which objects it uses (a bed, a forge, a
  loom) and what to do with them.
- For Villheim: the trade list in `Villagers/Roles.cs`; three-hour blocks are a simple grid for proposal "Schedules
  as tables".

#### Banner Kings (Bannerlord mod) [code]
- No licence file in the repo; ideas only.
- Population grows each day by `count x 0.005` per class, times `1 - filled capacity`; below 15% filled there is a
  repopulation boost (up to x3 at 5% or less). Capacity comes from the land (farmland, pasture, woodland per acre) and
  from buildings (walls add 1,500 to 5,000).
- For Villheim: a logistic growth rule (fast when small, slow when full) for arrivals in `VillageBrain.cs`, with the
  land around the hearth (trees, rocks, meadow) as the capacity.

#### Seasons (shudnal, Valheim) [code]
- Licence: Unlicense. Code may be copied, with the notice.
- Four seasons, 10 days each by default, set per world on the server. Each season is a JSON file: weather list,
  random event frequency and biome limits, light and fog, player stats, production rates (fermenters, smelters,
  plants), trader items, night length, and snow on building pieces.
- For Villheim: if Seasons is installed, read its current season and day; if not, keep Villheim's own calendar with
  the same 10-day seasons so both line up. A soft read by reflection keeps Villheim independent. Its seasonal snow
  rules for pieces are a reference for `Village/Snow.cs`.

#### Seasonality (RustyMods, Valheim)
- No licence file; ideas only. Another seasons mod with seasonal textures, weather and effects. Listed so both season
  mods are checked for when reading the season.

### Games (mechanics from earlier reading) [known]

#### Minecraft villages
- Gossip: each villager keeps typed gossip about each player, with a weight, a cap and a decay: major negative
  (weight 5, cap 100, decays 10 a day), minor negative (1, 200, 20), minor positive (1, 200, 1), major positive
  (5, 20, no decay), trading (1, 25, 2). Villagers who meet at the bell share gossip, a little weaker each time it
  passes on. Reputation is the weighted sum and changes trade prices; low enough and iron golems turn hostile.
- Professions come from job site blocks: a villager with no job claims a free one nearby; the job levels from novice
  to master by trading experience, and new trades open at each level.
- Breeding needs more free beds than villagers and food in their inventory.
- Raids: Bad Omen makes the next village visit start a raid; waves by difficulty (3 easy, 5 normal, 7 hard, one more
  at higher omen levels); villagers ring the bell and hide; winning gives Hero of the Village (lower prices, gifts).
- Wandering trader: one try a day with a rising chance (25, 50, 75%), near the bell, leaves after two days.
- For Villheim: gossip and reputation for "Player standing per village"; job site claiming is how `Roles.cs` already
  works by building; Hero of the Village for a short honour after a raid.

#### Other Minecraft village mods
- Towns and Towers, ChoiceTheorem's Overhauled Village: more and larger village designs per biome. Their lesson is
  variety per biome and per village size, which Villheim gets from its design board.
- Village Employment: new professions tied to new job site blocks. For Villheim: a trade appears when its station
  exists (a forge makes a smith, a loom a weaver).

#### RimWorld
- Mood is a sum of thoughts, each with a value and a duration; "expectations" add a bonus that falls as the colony
  gets richer: +30 at extremely low wealth, then +24, +18, +12, +6, 0 at sky-high. Mental breaks start below 35% (minor),
  20% (major) and 5% (extreme), and a break leaves a "catharsis" thought afterwards.
- Opinions between pawns come from talk types (chitchat small plus, deep talk bigger, insults big minus) and shared
  events; lovers, rivals and friends follow from opinion.
- Raid points scale with colony wealth and the number of colonists, adapted by how the colony has fared lately.
- World map: faction settlements send trade caravans and visitors on a schedule; settlements can be raided and
  destroyed; quests pin sites on the map for a limited time.
- For Villheim: expectations for `Moods.cs`; talk types are already in `Social.cs`; the storyteller shape above.

#### Dwarf Fortress (world and sites)
- World generation runs a history of 100 or more years: sites are founded, grow into towns, are conquered, abandoned
  or taken over by monsters, and each event goes into "legends" that the player can read. Sites keep their history.
- Dwarves remember events and talk about them; a strong memory can change a value or a facet over the years.
- Migrant waves arrive with fortress wealth and fame; nobles arrive with size.
- For Villheim: a short made-up history per village at world start, ruins as former villages, and a readable
  chronicle (`Chronicle.cs`).

#### Songs of Syx, Kingdoms and Castles, Banished, Going Medieval
- Songs of Syx: each species has likes and needs; happiness is fulfilment measured against expectations, and
  expectations rise with the size of the city, so a big city needs more services to stay as happy as a small one.
- Kingdoms and Castles: happiness from housing, food variety, a church, a tavern and taxes; raiders come by sea and
  grow with the kingdom.
- Banished: citizens age through child, student, adult and elder; a couple needs an empty house to have children;
  nomads arrive at the town hall and can bring sickness; winter needs firewood and warm clothes; varied food keeps
  health up.
- Going Medieval: settlers with traits and moods, rooms with types and a grade, seasons, raids that scale with wealth.
- For Villheim: rising expectations, food variety (MineColonies does the same), life stages, winter stores.

#### Foundation and Manor Lords
- Foundation (Polymorph Games): no grid. The player paints zones and villagers choose where houses go inside them;
  paths form where villagers walk and become roads. Estates (labour, clergy, kingdom) want different things.
- Manor Lords: the player draws a burgage plot; a family builds the house on it. The back yard takes one extension
  (vegetable garden, orchard, hens, goats, an artisan's workshop). Houses go up a level when the families' needs are
  met (market access to food and fuel, a church, clothes). Approval decides whether new families come (about 50% or
  more) or leave (low approval).
- For Villheim: plot types and back yards for `PlotFinder.cs` and `Farms.cs`; desire paths (already planned).

#### Frostpunk, Black and White, The Sims
- Frostpunk: two bars, hope and discontent (0 to 100). Laws trade one for the other. Promises ("everyone has a home
  within two days") raise hope when kept and drop it when broken; at the edge, the people give an ultimatum.
- Black and White: each village shows its current desire as a flag over the town (food, wood, more people, a
  temple); fulfilling it raises belief.
- The Sims: needs decay (hunger, energy, comfort, fun, social, hygiene, bladder, room). Objects advertise how much
  they fill each need; the Sim scores each action by advertised fill times how badly the need is felt, lowered by
  distance, and picks one of the top few at random. Sims 2 adds wants and fears from the Sim's aspiration, which give
  big swings when they come true.
- For Villheim: promises for requests; a visible need over the hearth; scored free-time choices in `FreeTime.cs`.

#### Terraria, Starbound, Core Keeper, Necesse, Dragon Quest Builders 2
- Terraria: each town NPC has loved, liked, disliked and hated biomes and neighbours. Shop prices change with
  happiness: loved x0.88, liked x0.94, disliked x1.06, hated x1.12; living alone or with one neighbour within 25 tiles
  helps a little, more than three neighbours hurts. A happy enough NPC sells a pylon (fast travel).
- Starbound: a colony deed on an enclosed, lit room with a door; the tenant who moves in depends on the tags of the
  furniture in the room (a room in one race's style draws that race). Tenants pay rent now and then and ask small
  favours.
- Core Keeper: merchants move in once there is a room with a bed for them and a condition is met (often a boss).
- Necesse: settlers arrive when there is a bed in a room and the settlement is happy; happiness from food variety and
  room quality; settlers take gear from storage and fight raids; settlement levels come from the flag.
- Dragon Quest Builders 2: a room (walls two high, a door, a light) becomes a "recipe" room by its contents (bed and
  light: bedroom; cooking pot and table: kitchen). Residents give gratitude for good rooms and food; gratitude raises
  the town level, which unlocks plans. Residents build from blueprints the player lays out, with materials from a chest.
- For Villheim: room recipes for `Interior.cs`; tenants by furniture; DQB2's chest-fed builders are close to Villheim's
  own builder and chest.

#### Mount and Blade II: Bannerlord
- Villages make one main good each (grain, iron, horses, clay...) in amounts that grow with hearths, and sell to
  their town. Hearths grow slowly in peace and drop when raided; a raided village stays looted for days and then
  recovers.
- Notables (headman, landowners) hold power, give quests and recruits; relation with them decides what the player
  gets.
- Caravans buy where a good is cheap and sell where it is dear, can be raided, and their trips move prices between
  towns.
- For Villheim: a main good per village (from its biome and outpost) to trade along trails; raided and recovering
  villages; caravans by price difference.

#### Kenshi
- Squads (traders, bandits, patrols, slavers) walk between towns on their own. World states change when a faction
  leader is killed or jailed: towns are taken over, emptied, or turned into ruins by "town overrides".
- For Villheim: big events change a village's state for good (fallen, ruin, resettled), shared with the world
  growth work.

#### Crusader Kings III
- Traits set personality and stress: acting against a trait adds stress; at 100, 200 and 300 stress the character
  breaks (a random coping trait, or death at the top). Schemes are slow plans with a success chance and a secrecy
  roll.
- For Villheim: a stress break when mood stays very low; slow rivalries that end in a quarrel scene.

#### Stardew Valley
- Schedules are text keys with fallbacks: a specific date (spring_15), then day of week, then rain (and a second rain
  variant), then default; some schedules need friendship hearts. Each entry is time, place, tile, facing and an
  animation.
- Friendship: 250 points a heart; talking +20 a day; gifts loved +80, liked +45, neutral +20, disliked -20, hated -40,
  two a week, x8 on a birthday; points slip by 2 a day without a talk. Heart scenes at 2, 4, 6, 8 and 10 hearts.
- Festivals on fixed days of each 28-day season (an egg hunt, a flower dance, a beach feast, a fair, a winter feast);
  shops close and the whole town is in one place.
- For Villheim: schedule fallbacks for routines; festivals; gift values for the player's gifts.

#### Skyrim (Radiant AI and Radiant Story) and its mods
- Radiant AI in Skyrim is a set of packages per NPC (sleep, eat, work at a spot, sandbox: use any idle marker or
  furniture within a radius) with times. Oblivion's 2005 demo gave NPCs goals and let them pick the means (stealing
  or killing included); it was cut back before release because the results broke quests.
- Radiant Story: a story manager listens for events (player changes location, kills an actor, a script event) and
  starts quests whose slots (a dungeon, an NPC, an item) are filled from the world by conditions, such as "a cleared
  dungeon the player has not been to".
- Immersive Citizens: NPCs take cover or flee in fights, keep better schedules and react to weather. Inconsequential
  NPCs and Interesting NPCs add many residents with daily routines; some travel between towns. OBIS makes bandit camps
  varied by region.
- For Villheim: requests whose slots are filled from what is near (`NoticeBoard.cs`, the hermit pin list in
  `WorldLife.cs`); travellers on trails.

#### Fallout 4 and Sim Settlements 2
- Fallout 4: settlement happiness from food, water, beds, defence and shops; settlers come with a recruitment
  beacon; attacks become likelier when food and water outgrow defence; provisioners link settlements so stock is
  shared along supply lines.
- Sim Settlements 2: the player lays plots (residential, agricultural, industrial, commercial, recreational, martial,
  municipal) and assigned settlers build them; each plot picks a building plan from the installed packs at random,
  so no two settlements look alike, and upgrades through levels 1 to 3 over time when its needs and the settlement's
  resources allow. City plans give a whole layout that grows through city levels, run by a settlement leader whose
  traits change costs and speed.
- For Villheim: the closest match to Villheim's design board (`DesignBoard.cs`, `Growth.cs`, `PlotFinder.cs`). Plot
  types with random designs from the kept pool and level-ups by need is the shape of "Plot growth".

#### Medieval Dynasty
- Villagers need a house, food, water and firewood; reputation from tasks unlocks buildings and more villagers;
  years of four seasons; the player marries and has an heir; villagers are assigned to buildings and produce there.
- For Villheim: seasons and firewood; marriage as households.

#### Survival games
- Enshrouded: survivors are found in ruins and vaults (blacksmith, carpenter, hunter, alchemist, farmer) and each
  unlocks a station and its recipes once rescued and given a bed.
- Conan Exiles: thralls are captured, broken on a wheel, and placed at stations, where named thralls of higher tier
  unlock recipes and speed up crafting.
- V Rising: servants are sent on hunts to a region for a set time; success depends on their expertise against the
  region's level; they may come back hurt, or not at all; loot comes home with them.
- Palworld: each creature has work skills with a level 1 to 4 (logging, mining, handiwork, cooking, farming...);
  sanity falls with overwork and hunger; the base level caps how many work there; bases are raided.
- 7 Days to Die: traders keep hours (06:00 to 22:00), restock every three days and give tiered quests (finish enough
  at one tier to open the next).
- Project Zomboid mods (Bandits, Superb Survivors): NPC groups with programs (looter, defender, thief) and waves that
  grow over the days. Ark: tribes with a shared log and alliances.
- For Villheim: rescued specialists for trades; off-screen expeditions; work skill levels per villager; trader hours
  and restock.

### Procedural settlement writing [known]
- Emilien, Bernhardt, Peytavie, Cani and Galin, "Procedural Generation of Villages on Arbitrary Terrains" (2012): a
  village grows by placing buildings one at a time where an "interest" field is high (near the centre, near roads,
  on gentle slopes, with a view or water), each building type with its own weights; roads are laid toward each new
  building over a cost field that follows the terrain, and the road network grows from the seeds. Parcels follow the
  roads.
- Parish and Müller (2001) and later work: city roads as growing graphs with local rules (join an existing road
  within a snap distance, avoid steep slopes), then lots cut between the roads.
- Generative Design in Minecraft (GDMC, Salge and others, 2018 to now): a yearly contest for settlement generators,
  judged on adapting to the terrain, function, story and looks; a "chronicle" side contest asks the generator to
  write a book telling the settlement's history.
- For Villheim: `PlotFinder.cs` and `PathPlanner.cs` already follow the Millénaire version of this; interest weights
  per building type and roads that snap to roads are the parts worth checking against.
