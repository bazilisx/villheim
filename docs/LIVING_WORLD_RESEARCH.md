# Living world research

## Preface

Survey of 2026-11-08 (overnight). Question: what makes NPC settlements in other games and mods feel alive, growing
and changing over time, and what of it fits Villheim. Millénaire is one input among many here; it is covered in
`docs/MILLENAIRE.md`, and the Minecraft and Valheim village mods already read are in `docs/RELATED_MODS.md`. The
world-life plan (visitors, hermits, outposts, trails, caravans) is in `docs/WORLD_LIFE.md`. This doc adds the sources
those three leave out and turns the findings into proposals.

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
- Mood runs from -15 to 15 in seven bands (depressed, sad, unhappy, passive, fine, happy, overjoyed); player acts can
  push it down to -100. Bands change behaviour and places: depressed and sad villagers cry now and then and go to the
  inn, unhappy ones to the music store, overjoyed ones laugh.
- Seventeen personalities (friendly, flirty, playful, gloomy, sensitive with double heart loss, greedy who finds less on
  chores, crabby, extroverted, introverted, relaxed, anxious, peaceful, upbeat, and so on). Traits (left-handed,
  athletic, tough, colour-blind...) each roll at 25% split by weight, and a child takes each parent trait at 50% times
  the trait's own inherit value.
- For Villheim: inn rolls map to `WorldLife.cs` visitors and proposal 25 (wanderers at the longhouse); gear by
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
  `Repairs.cs`; the hearth as a rally point (proposal 35, a horn at the hearth).

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
- For Villheim: Valheim has no seasons of its own, but a village calendar (proposal 3) can name the time of year,
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
- For Villheim: the trade list in `Villagers/Roles.cs`; three-hour blocks are a simple grid for proposal 14 ("Daily routines
  as tables").

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
  types with random designs from the kept pool and level-ups by need is the shape of proposal 6.

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

## Patterns across sources

Each pattern with the rule that works best of the ones read, and where Villheim stands.

| Pattern | Seen in | Best concrete rule | Villheim now |
|---|---|---|---|
| Needs and moods | MineColonies, RimWorld, The Sims, DF | Weighted average of lasting factors plus fading thoughts. MineColonies weights: security 4, food 3, housing 3, social 2, work 2, health 2, sleep 1.5. | `Moods.cs` has needs and fading thoughts; no weights per factor. |
| Complaints that escalate | MineColonies, Frostpunk | A missing need is quiet for a while, then complained about (7 days), then demanded (14 days), each step a bigger hit. | One step only. |
| Expectations | RimWorld, Songs of Syx | A mood bonus that shrinks as the settlement grows (+30 to 0 in six steps), so a bigger place needs more amenities to stay as happy. | None. |
| Memory and news | Gothic, Minecraft gossip, DF, Villheim | A news entry has who, to whom, what, and a witness; typed weights and decay per type; it passes on at chats a little weaker. | Village news and personal memories built; no witness or per-player reputation. |
| Reputation per player | Minecraft, MCA, CustomNPC+, Millénaire | Weighted sum of gossip gives prices (about +-20%), favours, and at the bottom, hunters sent after the player. | `Social.cs` keeps a player reputation that only rises (friend at 5, hero at 15), with no losses, decay or price effect; `Relations.cs` is village to village. |
| Schedules | Gothic, Ultima VII, Stardew, Skyrim | A table of (start, end, activity, place) per villager, with variants by rest day and rain, and shared places so meetings happen by chance. | Fixed bed and wake times, free time by mood; no tables. |
| Choosing what to do | The Sims, Skyrim sandbox | Objects advertise what they give; score = gain x need, less for distance; pick at random among the top three. | Fixed order in `FreeTime.cs`. |
| Storyteller and budget | RimWorld, Living Factions, MineColonies | One clock per event category: a mean time between, a minimum spacing, a cap on the gap for threats, points that scale with wealth. | Raids roll 20% at dusk (paused). |
| Adaptive threats | MineColonies, RimWorld | No raids below a size threshold; raids every 10 to 14 nights; heavy losses lower the next raid and push it back by 40%, an easy win raises it. | Fixed size by tier. |
| Settlement prosperity | Bannerlord, MineColonies raid level, Fallout 4 | One number from people, buildings (more for higher levels) and stock, used by raids, visitors, traders and growth. | Tier from buildings and people. |
| Logistic growth | Banner Kings, Banished, Manor Lords | Growth per day proportional to size times (1 - fullness), with a boost when nearly empty; arrivals stop or reverse when approval is low. | Arrivals for an empty bed only. |
| Organic plot growth | Sim Settlements 2, Manor Lords, Foundation, Emilien 2012 | Typed plots; the household picks the design from a pool at random; the plot levels up when its needs are met; back yards take one extension. | Design board stages (s#, d#) planned; plots by role. |
| Room recipes | DQB2, Starbound, Terraria, Necesse | A building's use comes from what is inside it (bed and light: bedroom; pot and table: kitchen); tenants and happiness follow. | `Interior.cs` furnishes by building kind. |
| Visitors and their verdict | Hospitality, MineColonies tavern, MCA inn | Visitor mood on arrival and leaving makes a score; relation moves toward it with a cap that grows with group size; next visit in 3 to 30 days by score. | Visitors come on a fixed chance; relation +3 each. |
| Caravans and trade | Bannerlord, Recruits, Fallout 4, Living Factions | Records that move on the world clock; goods go from cheap to dear; caravans can be raided; supply lines share stock. | Planned (`WORLD_LIFE.md` step 3). |
| Trader stock | Vintage Story, 7 Days to Die | Restock every 3 to 7 days, half the slots at a time, money drifts toward a new roll; catch up the missed refreshes on return (cap 10). | Market sells chest surplus, no refresh rule. |
| Seasons and calendar | Stardew, Serene Seasons, Seasons (Valheim), Medieval Dynasty, Banished | Named seasons of fixed length (10 days in Seasons, 28 in Stardew) with work, food and festivals tied to them; winter needs stores. | Rest day and tenth day tags only. |
| Festivals and gatherings | Stardew, Millénaire, Black and White | Fixed days where work stops and everyone is in one place, with a feast and its own lines. | Evening ring at the hearth; gatherings planned. |
| Life stages | Banished, MCA, Medieval Dynasty, DF | Child, adult, elder; couples need a free home for a child; elders work less and tell stories; traits pass to children. | Children grow up in four days; no elders. |
| Rivalries and breaks | CK3, RimWorld, DF | Stress adds up from things against the grain; past a threshold a break (sulk, quarrel, leave), then relief. | Friend and rival pairs; no breaks. |
| Ruins and decline | DF, Kenshi, Bannerlord | Sites can fall: emptied by war or hunger, taken over, left as ruins with their history, later resettled. Raided villages recover over days. | A dead village stays dead; no ruins. |
| Rescued specialists | Enshrouded, Conan Exiles, Core Keeper | A person found in the world unlocks a trade or station once given a home. | Newcomers walk in for beds. |
| Off-screen work | V Rising, Kenshi, Living Factions | A party leaves for a set time with a success chance from gear against the place, and comes back with loot or losses. | Outposts send 10 wood a day. |
| Skills | MineColonies, Palworld, DF | Work raises a skill; the home or station caps it; speed and yield grow with it. | Planned (`WORLD_LIFE.md` step 11). |
| Visible wants | Black and White, Frostpunk, Fallout 4 | The settlement's current want is shown in the world (a flag, a sign), and promises with a deadline. | Notice board signs; daily material request in `Social.cs`. |
| Written history | DF legends, GDMC chronicle, Millénaire | A readable record of the village's story, with names and dates. | `Chronicle.cs` at the hearth. |

## Beyond Millénaire: proposals for Villheim

Ranked by value for the effort, highest first. Effort: S an evening, M a session or two, L several sessions. Value 1
to 5. Status: **new**; **planned** (already in `docs/WORLD_LIFE.md` "Next" or `docs/ROADMAP.md`); **partly built**
(something close exists). All numbers are starting values to tune in game, and new settings go in `LogicConfig.cs`.

Two other agents work tonight on villager minds and dialogue and on world growth (caravans, outposts, events,
daughter villages). Proposals that touch their ground are marked "(minds)" or "(world)" so the work can be matched up.

### 1. Village prosperity (S, 5) new
- Player sees: the notice board's level sign shows a prosperity number that rises as the village grows and falls
  after a raid or a death; bigger numbers bring more visitors and bigger raids.
- Rules: prosperity = 5 per adult + per finished building (5 + stage squared / 5) + chest stock value / 50, times
  (0.5 + village mood / 100). Recomputed once a game hour, kept on the hearth. A raid that kills a villager or breaks a
  building takes 15% off at once, recovering at 2% a day (Bannerlord's looted state).
- Extends: `VillageState.cs` (stored), `NoticeBoard.cs` (shown), and read by `Raids.cs`, `WorldLife.cs` (visitor
  chance), `Market.cs` (stock size).
- From: MineColonies raid level, Bannerlord prosperity.

### 2. Expectations that rise with the village (S, 5) new (minds)
- Player sees: a new hamlet is content with little; a grown village grumbles unless it has a longhouse, benches,
  varied food and a fence.
- Rules: a standing mood bonus by village stage: stage 1 +18, stage 2 +12, stage 3 +6, stage 4 and up 0. Amenities then
  have to make up the gap. Food variety (distinct cooked foods eaten in the last 3 days) counts more as the stage rises:
  wanted variety = stage.
- Extends: `Villagers/Moods.cs` (a baseline term), `VillageMood.cs`.
- From: RimWorld expectations, Songs of Syx, MineColonies food factor.

### 3. Village calendar and festivals (M, 5) new
- Player sees: villagers name the season and the day; four times a year the village stops work at 16:00 and holds a
  feast at the hearth with music poses, a chronicle entry and visitors from the neighbour villages.
- Rules: seasons of 10 days (matching the Seasons mod default), a year of 40 days. If shudnal's Seasons is installed,
  read its season and day instead (soft read by reflection). Festivals on day 5 of each season: sowing feast, midsummer
  fire, harvest feast, Yule. Festival day: no harvesting after 16:00, everyone at the hearth from 18:00 to 22:00,
  thought `festival` +10 for one game day, pedlar and pilgrim chance x3, one neighbour visitor per village with
  relation above 20. Tags `season:<name>`, `festival:<name>`.
- Extends: `Villagers/Personality.cs` (day tags), `FreeTime.cs` (evening ring), `WorldLife.cs`, `Chronicle.cs`.
- From: Stardew festivals, Serene Seasons, Seasons (Unlicense), Millénaire gatherings. Gatherings are planned in
  `WORLD_LIFE.md` (step 2); this gives them dates.

### 4. Witnessed deeds and gossip (M, 5) partly built (minds)
- Player sees: a villager who saw the player chop a village tree, take from the chest or hit a villager mentions it
  later, and the story reaches his friends; one who saw the player kill a raider tells it at the fire.
- Rules: a deed entry is (player, deed type, witness, day). Only villagers within 25 m with a line of sight record it.
  Types and weights after Minecraft gossip: harmed a villager (-5, decays 10 a day), took from the chest without
  putting in (-1, decays 20 a day), helped build or filled the chest (+1, decays 1 a day), defended the village (+5, no
  decay), traded (+1, cap 25, decays 2 a day). At each chat a witness passes his newest entry to the listener at 80%
  strength; second-hand entries never pass on again.
- Extends: `PlayerReactions.cs` (seeing), `Personality.cs` memories, `Social.cs` (chats and the player record),
  `WorldLife.cs` news.
- From: Gothic news, Minecraft gossip, DF memories.

### 5. Player standing that can fall (M, 5) partly built
- Player sees: prices at the village go up or down, villagers greet or turn away, and a much disliked player finds
  the gate shut and protectors on guard.
- Rules: standing per player per village = sum of gossip weights from proposal 4 known in the village (each entry
  counted once). Prices: x0.85 at hero, x1.0 at known, x1.2 below -10. Below -30 the village asks a fine at the notice
  board to make peace (coins or materials); below -60 protectors draw weapons when the player comes inside the fence.
  The existing stranger, known, friend (5) and hero (15) bands stay.
- Extends: `Villagers/Social.cs` (reputation), `Market.cs` (prices), `Palisade.cs` gates.
- From: Minecraft reputation, MCA hearts and bounty hunters, CustomNPC+ factions.

### 6. Plot growth with random designs (L, 5) planned in part
- Player sees: two villages of the same biome grow different streets; a house plot starts as a small hut and becomes
  a bigger house of its own kind over the days.
- Rules: the village reserves plots by type (home, work by subtype, community) when it lays roads. When a plot is
  built, its design is drawn at random from the kept designs of that type, subtype and biome, weighted against designs
  already in the village (a design used once has half the weight, twice a quarter). A plot goes up one s# stage when
  the village stage allows and the household's needs are met (bed, food variety, mood above 50 for 2 days), and up one
  d# step every 3 to 5 days in between.
- Extends: `PlotFinder.cs`, `Growth.cs`, `DesignBoard.cs` naming (`<baseID>_s<n>d<n>`), the roadmap items on
  stages and decorating between upgrades.
- From: Sim Settlements 2, Manor Lords, Emilien 2012.

### 7. Needs that complain, then demand (S, 4) new (minds)
- Player sees: a villager without a bed sleeps by the fire for a few nights, then grumbles about it, then comes to the
  player to ask, then packs up and leaves.
- Rules: per missing need (bed, food, safety), count days. 3 days: complain lines (tag `complain:<need>`), mood factor
  x0.75 on that need. 6 days: a request on the notice board and to the nearest known player, factor x0.5. 10 days: the
  villager leaves by day with a farewell line, walking toward the friendliest neighbour village.
- Extends: `Villagers/Moods.cs`, `Social.cs` (requests), `Dialogue.cs` tags.
- From: MineColonies complain and demand days (7 and 14, shortened here for Valheim's shorter days).

### 8. Visitors who judge their stay (S, 4) new (world)
- Player sees: a pilgrim who had a bad night (rain, no seat, a raid) leaves sour and his village thinks less of this
  one; a well treated pedlar comes back sooner and sometimes brings a friend.
- Rules: record the visitor's mood on arrival and on leaving; score = lerp(rise x 2.75, mood at leaving x 1.35, 0.5),
  mood on a 0 to 1 scale. Relation of the home village moves toward lerp(-100, 100, score) by at most 3 (one visitor)
  to 24 (eight). Changes under 5 count for nothing. Next visit in 3 to 12 days if the target is above 0, 12 to 30
  if below. A gift from the visitor to the chest when score is 0.2 to 0.9 (chance rises with score).
- Extends: `Village/WorldLife.cs`, `Relations.cs` (replaces the flat +3 per visitor).
- From: Hospitality.

### 9. The village's want shown over the hearth (S, 4) partly built
- Player sees: a banner or a pile by the hearth shows what the village wants now (a log, a stone, a hide, a fish),
  readable from 30 m without opening anything.
- Rules: the top need from `VillageNeeds.cs` places one matching vanilla prop or item stand display next to the chest;
  it changes at most once a game hour. A promise form: when the player fills it within a day, thought `promise_kept`
  +6 for everyone; when the day passes, nothing is lost (no punishment for ignoring it).
- Extends: `NoticeBoard.cs`, `VillageNeeds.cs`, `Social.cs` requests.
- From: Black and White desire flags, Frostpunk promises.

### 10. Boss trophies open the next stage (S, 4) planned in part
- Player sees: after the player hangs the Eikthyr trophy at the longhouse, the village starts on stage 2 designs and
  bronze is talked about; each boss moves every village a step.
- Rules: a village's stage cap = 1 + number of boss keys the world has (the game's global keys `defeated_eikthyr` and
  so on), or + trophies hung on item stands in its longhouse, whichever the config picks. Growth past the cap waits.
  Gear tiers in `Smithing.cs` follow the same cap. A trophy hung by a player: chronicle line, festival thought +10.
- Extends: `Growth.cs`, `Smithing.cs`, `Chronicle.cs`; the boss progression idea in `docs/RELATED_MODS.md` (idea 5).
- From: VikingColonies and Friendlies Reloaded (boss tiers), MineColonies research gates, Valheim's own global keys.

### 11. Raids that adapt (S, 4) new
- Player sees: a young village is left alone; a grown one is raided every week or two; a raid that went badly is
  followed by a quieter spell.
- Rules: no raid while prosperity (proposal 1) is under 75. Raids between night 10 and night 14 after the last (in
  Valheim days), certain by night 16. Raid size = 1 + prosperity / 60. Difficulty 1 to 14, starting at 7: if a raid
  killed more than 15% of the villagers, difficulty falls by one per 15% and the next raid comes 40% later; under 5%
  lost, difficulty rises one.
- Extends: `Village/Raids.cs` (currently 20% at dusk, paused).
- From: MineColonies raid manager.

### 12. An events director with clocks per category (M, 4) planned (world)
- Player sees: a steady run of small happenings (a feast, a lost child, a quarrel, a skald) with the odd big one, never
  two big ones in a row.
- Rules: one clock per category, each with a mean time and a minimum gap, after RimWorld: small good (mean 2 days), small
  bad (3 days), visitors (4 days, gap 2), big threat (raids, proposal 11), rare (a wandering seer, 15 days). Weights
  scale with prosperity. Each event is a short script with slots filled from the village (a villager, a place).
- Extends: the planned director (`WORLD_LIFE.md` step 9).
- From: RimWorld storytellers (Diego Dire defs), Living Factions daily rolls.

### 13. Caravans that carry goods where they are dear (M, 5) planned (world)
- Player sees: a pedlar with a pack boar on the trail between two villages, carrying the stone one has spare to the
  one that lacks it; raided caravans leave a lost pack on the trail.
- Rules: as planned (records moving at 2,400 m a day, real within 130 m of a player). Route choice: the village with
  the biggest surplus sends to the neighbour with the biggest shortage of the same material when the difference is
  20 or more items. A caravan carries up to 40 items. Each arrival changes the price of that material in both villages
  by 10% (cheaper where it arrives).
- Extends: `WORLD_LIFE.md` step 3, `Market.cs`, `VillageNeeds.cs`.
- From: Bannerlord caravans, Recruits merchant routes, Fallout 4 supply lines.

### 14. Daily routines as tables (M, 4) partly built (minds)
- Player sees: the same villager is at the same bench every morning and meets the same friend at the fire every
  evening; on rest days and in rain the day looks different.
- Rules: each villager gets a routine of eight 3-hour blocks (Ultima VII) built from his trade, voice and pastime:
  sleep, eat, work, chores, free, social. Blocks name a place (his home, his workshop, the hearth, the longhouse, a
  friend's door). Variants by key, Stardew style: festival day, rest day (every 7th), rain, then default. Friends get
  the same social place at the same hour so they meet. Work and emergencies still override the table.
- Extends: `Villagers/Brain.cs`, `Chores.cs`, `FreeTime.cs`, `Sleep.cs`.
- From: Gothic routines, Ultima VII schedules, Stardew schedule keys.

### 15. Free time chosen by what places offer (M, 4) new (minds)
- Player sees: tired villagers find a bench, cold ones the fire, lonely ones a crowd; a new bench or table gets used.
- Rules: seats, fires, tables, stations and the hearth each advertise what they give (rest, warmth, company, a sense of
  purpose) as 0 to 10. Score = gain x how low that need is, divided by (1 + distance / 20 m). Pick at random among the
  best three. Advertised values live in one table in `LogicConfig.cs`.
- Extends: `Villagers/FreeTime.cs`, `Seats.cs`.
- From: The Sims, Skyrim sandbox packages.

### 16. Leaving, migrating and empty houses (M, 4) new (world)
- Player sees: an unhappy village loses a family, who walk to a happier neighbour and move in there; the empty house
  stands, weathers and is taken over by the next newcomer, or falls apart.
- Rules: village mood under 25 for 3 days running: the least content household leaves by day (proposal 7 handles the
  one-villager case). Target: the neighbour with relation above 0 and the most free beds; arrival there counts as a
  newcomer with a homeland line. An empty house loses no health while someone repairs it; after 10 days empty, repairs
  stop and it wears. Growth by arrivals follows a logistic rule: chance per day = 0.3 x (1 - beds taken / beds).
- Extends: `VillageBrain.cs`, `Repairs.cs`, `WorldLife.cs`.
- From: Banished, Manor Lords approval, Banner Kings growth, DF migrants.

### 17. Fallen villages and ruins (L, 5) new (world)
- Player sees: a village wiped out by raids stays as a ruin with its chest broken and its chronicle readable at the
  cold hearth; later a hermit camps there, and in time a neighbour sends settlers to start again.
- Rules: a village with no villagers for 2 days becomes a ruin: hearth out, no repairs, wear on. After 10 days a hermit
  may take the hearth (existing hermit rules). After 20 days the friendliest neighbour of stage 3 or more may resettle
  it with two villagers, keeping the name with "New" or a new name, and the old chronicle continued.
- Extends: `VillageState.cs`, `Chronicle.cs`, `WorldLife.cs` hermits, the world agent's daughter villages.
- From: DF sites, Kenshi world states and town overrides.

### 18. Elders and a life story (M, 4) new (minds)
- Player sees: the founders grow old, slow down, sit by the fire telling the village's story, and in time die and are
  mourned; their children carry their homeland and look.
- Rules: an adult turns elder after 40 game days in the village (a year of proposal 3). Elders do no felling or mining,
  keep lighter chores, and get story lines drawn from the chronicle (tag `elder`, fill-in `{chronicle}`). From 60
  days, a 2% chance each morning of a peaceful death in bed, with mourning (existing). Children take one parent's
  homeland and the other's pastime (MCA trait inheritance).
- Extends: `Villagers/Childhood.cs`, `Personality.cs`, `Dialogue.cs`, `Chronicle.cs`.
- From: Banished life stages, MCA, Medieval Dynasty.

### 19. Wants and fears (M, 4) partly built (minds)
- Player sees: a villager says he wants to see the longhouse finished or eat cooked meat, and is plainly pleased when
  it happens; one who fears the dark is shaken by a night raid.
- Rules: each villager holds up to 3 wants, rolled each morning from his personality and the village state (a building
  done, a food, a chat with his friend, a visit from a known player, a festival). A want met: thought +6 for a day. The
  fixed fear from `Personality.cs` gives a thought -8 when it happens (raid at night, a death, deep water).
- Extends: `Villagers/Personality.cs`, `Moods.cs`.
- From: The Sims 2 wants and fears, DF needs.

### 20. Rooms by what is in them (M, 4) new
- Player sees: a house with a bed and a light is a home; one with a forge and an anvil a smithy; villagers move into
  the room that fits them, and the village's notice board lists its rooms.
- Rules: a finished building's role is checked from its pieces: bed (home), fire or cooking station plus table
  (kitchen), forge (smithy), workbench (workshop), chests 3 or more (store). A room counts only under a roof (the game's
  cover test). Recipes fill gaps: `Interior.cs` adds the missing piece to reach the recipe of the building's role.
- Extends: `Village/Interior.cs`, `Amenities.cs`, `Roles.cs`.
- From: Dragon Quest Builders 2, Starbound tenants, Terraria housing.

### 21. Seasons and winter stores (M, 4) new
- Player sees: in autumn the village stacks wood and dries meat; in winter villagers stay nearer the fire and farms
  rest; a village that ran short in winter is glum.
- Rules: with proposal 3's calendar. Autumn: wanted wood stock +50%, food stock target doubled. Winter: farms do not
  grow (`Farms.cs`), foraging stops, free time favours fires, rain counts as cold. Each winter day with no firewood in
  the chest: thought `cold_home` -6. If the Seasons mod runs, read its season; its own effects stay its own.
- Extends: `Farms.cs`, `Foraging.cs`, `VillageNeeds.cs`, `Moods.cs`.
- From: Banished firewood, Serene Seasons, Seasons, Medieval Dynasty.

### 22. Rescued specialists (M, 4) new (world)
- Player sees: a smith held at a greydwarf camp or lost in a crypt; freed and walked home, he joins the nearest
  village and it gains a forge trade it could not have before.
- Rules: one specialist per 2 villages, placed at a vanilla location within 400 m of a village (camp, crypt, tower),
  as an unarmed wanderer with a captive pose. Freed (enemies within 20 m dead and the player talks to him), he
  follows the player and joins the village he reaches, taking a trade that needs his skill: smith (bronze sets),
  weaver, hunter. Without him the village can still grow, slower.
- Extends: `Wanderers.cs`, `WorldLife.cs`, `Roles.cs`, `Smithing.cs`.
- From: Enshrouded survivors, Conan thralls, Core Keeper merchants.

### 23. Expeditions out of sight (M, 4) new (world)
- Player sees: two protectors leave at dawn for the Black Forest and come back two days later with core wood and
  trophies, or one comes back alone.
- Rules: a village of stage 3 with gear tier 2 sends two protectors to the nearest biome it lacks. They walk off, and
  while no player is within 150 m they are a record. Trip length 1 to 2 days. Success = 0.5 + 0.15 x (gear tier -
  biome level), clamped 0.1 to 0.95. Success brings 20 to 40 of the biome's material; failure brings half, and a 30%
  chance one villager dies (chronicle, mourning).
- Extends: `Outposts.cs`, `Hunting.cs`, `Smithing.cs`, the caravan records plan.
- From: V Rising hunts, Kenshi squads, Living Factions bands.

### 24. Requests filled from the world (M, 4) planned
- Player sees: the notice board asks for help with a real place: "Wolves at the old tower north of here", pinned on the
  map, with a reward from the chest.
- Rules: request templates with slots: kill (a camp or nest within 500 m), fetch (a material the village lacks, from
  its biome), escort (a villager to the outpost or a neighbour), find (a lost villager placed 150 to 300 m out).
  Deadline 2 days. Kept: standing +3, thought +6 for the village. Broken: standing -1, nothing more.
- Extends: `NoticeBoard.cs`, `Social.cs` requests, the hermit pin list in `WorldLife.cs`, `WORLD_LIFE.md` step 8.
- From: Skyrim Radiant Story, Frostpunk promises, Millénaire quests.

### 25. Wanderers at the longhouse who can be asked to stay (S, 4) planned
- Player sees: strangers sit in the longhouse with a short life story; one says he would stay for a hide and a bed.
- Rules: up to 3 x longhouse stage visitors at once. After one comes, the next waits rand(0.1 day) + (0.25 day /
  stage) x (villagers / beds). Each has a backstory line and a price (a material from the chest, the price plus 0 to 2
  items). He stays 2 days, then moves on.
- Extends: `WORLD_LIFE.md` step 12, `WorldLife.cs`, `Interior.cs` (longhouse seats).
- From: MineColonies tavern, MCA inn.

### 26. Back yards (M, 4) new
- Player sees: houses grow a small garden, a drying rack, a woodpile or a boar pen behind them, different from house to
  house.
- Rules: each home plot gets one extension at its d2 step, drawn from what its biome allows: berry patch (Meadows),
  mushroom bed, woodpile, drying rack, small pen with one tamed boar. Extensions use vanilla pieces only and count as
  part of the plot for overlaps. A household with an extension gets +2 to its food or warmth need.
- Extends: `Farms.cs`, `PlotFinder.cs`, `Amenities.cs`.
- From: Manor Lords burgage extensions.

### 27. Skills that grow (M, 4) planned (minds)
- As planned in `WORLD_LIFE.md` step 11. Detail from MineColonies: skill sum feeds prosperity (proposal 1) at 1 per
  100 points; from Palworld: start each villager with a work level 1 to 4 per job from his seed, so trades go to the
  best fit and speed is x(0.75 + 0.25 x level).

### 28. Desire paths (M, 3) planned
- As planned in `WORLD_LIFE.md` step 6 (AntTrails, MIT). Foundation shows the payoff: the path network is drawn by where
  people walk.

### 29. Bad days and recovery (S, 3) new (minds)
- Player sees: a villager at the end of his rope sulks at the edge of the village for an hour and won't work, then is
  calmer for a day.
- Rules: mood under 15 for 6 game hours: a break (sulk 1 hour at a spot 20 to 30 m from the hearth, or a shouting match
  with his rival if within 30 m). After it: thought `catharsis` +8 for one day. At most one break per villager per 3
  days.
- Extends: `Villagers/Moods.cs`, `FreeTime.cs`, `Social.cs`.
- From: RimWorld mental breaks, CK3 stress.

### 30. Weekly restock with catch-up (S, 3) new
- Player sees: the village store has new things each week, and coming back after a long trip the store has moved on.
- Rules: every 7 days, half the store slots are rolled again from the chest surplus and the biome list; coins drift
  toward a new roll by 7 to 28%. Missed weeks catch up when the village loads, at most 10.
- Extends: `Village/Market.cs`.
- From: Vintage Story traders, 7 Days to Die.

### 31. A chronicle book (S, 3) partly built
- Player sees: a book at the notice board that can be read, with the village's story: founding, each building, births,
  deaths, raids, festivals, visitors, in dated lines.
- Rules: built from `Chronicle.cs` entries; the readable text uses the game's sign or text window; the oldest entries
  are kept in a summary line per year so the book stays short.
- Extends: `Chronicle.cs`, `NoticeBoard.cs`.
- From: GDMC chronicle challenge, DF legends.

### 32. A short history at world start (S, 3) new (world)
- Player sees: villagers mention an old feud with the next village, the year the hall burned, where the founders came
  from.
- Rules: at founding, roll 1 to 3 past events from a small list (founded by people from X, a fire, a hard winter, a
  feud or alliance with the nearest village, a hero's grave). Feud sets the starting relation to -30, alliance to +30.
  Events go into the chronicle as "before the founding".
- Extends: `Chronicle.cs`, `Relations.cs`, `Personality.cs`.
- From: DF world history.

### 33. Who lives next to whom (S, 3) new (minds)
- Player sees: friends live side by side; rivals end up apart; a villager placed next to his rival complains.
- Rules: when a home is assigned, prefer a free bed within 30 m of the friend and over 40 m from the rival. Daily
  thought: friend within 30 m +2, rival within 20 m -3. A trade villager's prices move x0.94 when content with his
  neighbours, x1.06 when not.
- Extends: `Sleep.cs` (bed claim), `Moods.cs`, `Market.cs`.
- From: Terraria NPC happiness.

### 34. Friend of the village after a raid (S, 3) new
- Player sees: after the player helps beat a raid, villagers cheer him and the store is cheaper for two days; the
  chronicle names him.
- Rules: a player within 40 m who dealt damage during a raid that ended with no villager dead gets "Friend of <village>"
  for 2 game days: prices x0.7, gesture on meeting, chronicle line.
- Extends: `Raids.cs`, `Market.cs`, `PlayerReactions.cs`, `Chronicle.cs`.
- From: Minecraft Hero of the Village.

### 35. A horn at the hearth (S, 3) new
- Player sees: blowing the horn by the hearth calls the protectors to follow him for a while.
- Rules: using the hearth while crouched with a standing of friend or more: protectors within 80 m follow the player
  for 5 game minutes, then walk home. Once per game hour.
- Extends: `Roles.cs`, `PlayerReactions.cs`.
- From: Guard Villagers' bell.

### 36. Market day (S, 3) new (world)
- Player sees: one day a week the hub fills: a pedlar for sure, a neighbour villager or two with goods, better prices.
- Rules: every 7th day (the rest day), 10:00 to 15:00: a pedlar comes (no roll), up to 2 visitors from villages with
  relation above 0, store prices x0.9, villagers spend free time at the hub.
- Extends: `WorldLife.cs`, `Market.cs`, `FreeTime.cs`.
- From: Stardew, medieval market days, Millénaire markets.

### 37. Villagers come to help a player in trouble (S, 3) new
- Player sees: a player fighting near a friendly village gets help from its protectors.
- Rules: a player with standing friend or more fighting within 60 m of the fence: up to 2 protectors run out to help,
  then go back once no enemy is within 20 m of them. Not at night unless the village is under raid.
- Extends: `Roles.cs`, `Brain.cs` threat checks.
- From: Bannerlord, Fallout 4 minutemen.

### 38. Households and marriage (M, 3) new (minds)
- Player sees: two friends move into a two-bed house together; children follow.
- Rules: two single adults who are friends (pair liking above a threshold) and both have a bed: chance 5% each game hour
  to move into a free two-bed home together (MCA rolls 0.05 a minute in Minecraft's shorter days). Childhood then
  works as now from their home.
- Extends: `Social.cs`, `Childhood.cs`, `Sleep.cs`.
- From: MCA, Medieval Dynasty.

### 39. Villagers who visit friends in other villages (M, 3) new (world)
- Player sees: on a rest day a villager walks the trail to see a friend in the next village and comes back with news.
- Rules: villagers with a friend in a neighbour village (a pair liking with a past visitor) may go on a rest day, when
  relation is above 20 and the trail exists. Off-screen as a record when no player is near, like caravans.
- Extends: `Trails.cs`, `WorldLife.cs`, `Personality.cs`.
- From: Inconsequential NPCs, Gothic routines.

### 40. Work skill levels from birth (S, 3) new (minds)
- Player sees: one villager is a quick feller and slow builder, another the reverse; the village gives each the work
  he is good at.
- Rules: each villager gets a level 1 to 4 per work (felling, mining, building, cooking, farming, hunting) from his
  seed, with a sum of 10. Trades go to the best fit. Work speed x(0.75 + 0.25 x level). Shown by `vh villager`.
- Extends: `Roles.cs`, `VillagerTuning.cs`. A first step toward proposal 27.
- From: Palworld work suitability.

### 41. Bandit camps that grow (M, 3) new (world)
- Player sees: a camp of outlaws near an unfriendly region grows if left alone and starts to raid the nearest village.
- Rules: at a vanilla camp location 300 to 800 m from a village, a camp record grows by one fighter every 3 days to 6;
  at 4 it sends a raid (proposal 11's rules) to the nearest village. Clearing it is a request (proposal 24).
- Extends: `Raids.cs`, `WorldLife.cs`, `NoticeBoard.cs`.
- From: Kenshi squads, Project Zomboid Bandits, OBIS, Millénaire bandit lairs.

### 42. A gift basket for a hero (S, 2) new
- Player sees: a village that counts the player a hero leaves him a small basket of food each week in a chest by the
  notice board.
- Rules: at hero standing, every 7 days: 0.5 x villagers items of cooked food or spare material, taken from surplus
  only. Village thought +3 ("we could give something back").
- Extends: `Market.cs`, `VillageChest.cs`.
- From: MCA taxes, turned around to a gift.

### 43. Protectors who need feeding (S, 2) new
- Player sees: unfed protectors grumble and stay home at night.
- Rules: each protector eats one meal from the chest a day; 2 days without, he skips the night watch and the horn
  (proposal 35) until fed.
- Extends: `Roles.cs`, `Healing.cs`.
- From: Recruits upkeep and morale.

## A note on Valheim's own raids [known]

Valheim's `RandEventSystem` checks for an event every 46 minutes with a 20% chance, and raid events marked "near base
only" need the player close to a base, which the game measures from building pieces with a base value (workbenches,
beds, fires and the like). Villages are built from those same pieces, so a player standing in a grown village may
already count as being at a base for vanilla raids. Check `RandEventSystem` and `EffectArea` in the decompiled game
before tuning proposal 11, so Villheim's raids and the game's own do not stack.

## Worth a deeper look

1. Sim Settlements 2 wiki (plots, plans, city plans): the closest match to how Villheim's design board could drive
   growth. https://wiki.simsettlements2.com/gameplay/plots-and-plans
2. Seasons by shudnal (Unlicense, Valheim): a season clock and per-season JSON that Villheim can read or copy from.
   https://github.com/shudnal/Seasons
3. MineColonies `RaidManager`, `CitizenHappinessHandler`, `TavernBuildingModule` (GPL, ideas): tuned numbers for
   raids, happiness and visitors. https://github.com/ldtteam/minecolonies
4. Hospitality `LordToil_VisitPoint.cs` (GPL, ideas): visit score, goodwill and return timing.
   https://github.com/OrionFive/Hospitality
5. Inside Gothic (routines, perceptions, news). https://ataulien.github.io/Inside-Gothic/DailyRoutine
6. Stardew Valley schedule and event data docs. https://stardewvalleywiki.com/Modding:Schedule_data
7. Emilien and others, villages on arbitrary terrains (2012). https://perso.liris.cnrs.fr/egalin/Articles/2012-villages.pdf
8. ValheimCityBuilder (RustyProductions): unread tonight; settlers, production chains and research in Valheim.
   https://thunderstore.io/c/valheim/p/RustyProductions/ValheimCityBuilder/
9. Kenshi world states and town overrides. https://kenshi.wiki/w/World_States
10. RimWorld storyteller and raid points pages. https://rimworldwiki.com/wiki/AI_Storytellers

## Sources

### Read from source tonight (shallow clones in `/tmp/lwr`, not committed)

| Project | Licence | URL |
|---|---|---|
| MCA Reborn | GPL-3.0 | https://github.com/Luke100000/minecraft-comes-alive |
| MineColonies | GPL-3.0 | https://github.com/ldtteam/minecolonies |
| Guard Villagers | All Rights Reserved (assets, with a ban on AI-directed ports) | https://github.com/seymourimadeit/guardvillagers |
| Recruits | All Rights Reserved | https://github.com/talhanation/recruits |
| Workers | All Rights Reserved | https://github.com/talhanation/workers |
| CustomNPC+ | custom licence | https://github.com/KAMKEEL/CustomNPC-Plus |
| Dynamic Trees | MIT | https://github.com/DynamicTreesTeam/DynamicTrees |
| Serene Seasons | All Rights Reserved | https://github.com/Glitchfiend/SereneSeasons |
| Hospitality (RimWorld) | GPL-3.0 | https://github.com/OrionFive/Hospitality |
| Vanilla Factions Expanded: Settlers | no licence file | https://github.com/Vanilla-Expanded/VanillaFactionsExpanded-Settlers |
| Vanilla Expanded Framework | CC BY-NC-ND 4.0 | https://github.com/Vanilla-Expanded/VanillaExpandedFramework |
| Vintage Story survival mod | proprietary, readable for modding | https://github.com/anegostudios/vssurvivalmod |
| Vintage Story essentials mod | proprietary, readable for modding | https://github.com/anegostudios/vsessentialsmod |
| df-structures (DFHack) | no licence file found | https://github.com/DFHack/df-structures |
| Inside Gothic | no licence file | https://github.com/ataulien/Inside-Gothic |
| Exult (Ultima VII engine) | GPL-2.0 | https://github.com/exult/exult |
| Banner Kings (Bannerlord) | no licence file | https://github.com/R-Vaccari/bannerlord-banner-kings |
| Seasons (Valheim, shudnal) | Unlicense | https://github.com/shudnal/Seasons |
| Seasonality (Valheim, RustyMods) | no licence file | https://github.com/RustyMods/Seasonality |

### Pages found by search, not opened tonight

Mods and Valheim:
- MCA Reborn: https://www.curseforge.com/minecraft/mc-mods/minecraft-comes-alive-reborn
- MineColonies happiness: https://minecolonies.com/wiki/systems/happinessandsaturation
- ValheimCityBuilder: https://thunderstore.io/c/valheim/p/RustyProductions/ValheimCityBuilder/
- Living Factions: https://thunderstore.io/c/valheim/p/under2ker/LivingFactions/
- VikingSettlements: https://thunderstore.io/c/valheim/p/morosmods/VikingSettlements/v/1.10.0/
- Vikings Village: https://thunderstore.io/c/valheim/p/Northarun/Vikings_Village/
- Traders and Markets: https://thunderstore.io/c/valheim/p/BlackViking/Traders_and_Markets/required
- Aurora Land Economy: https://thunderstore.io/c/valheim/p/Arcadia/Aurora_Land_Economy
- Balrond Elven Factions Reborn: https://thunderstore.io/c/valheim/p/Balrond/balrond_ElvenFactionsReborn/v/0.1.3/
- Merchant NPCs: https://thunderstore.io/c/valheim/p/Ruijven/MerchantNPCs
- Nexus Valheim NPC mod list: https://www.nexusmods.com/valheim/mods/2131

Games:
- Minecraft gossip types: https://maven.fabricmc.net/docs/yarn-1.21.11+build.4/net/minecraft/village/VillagerGossipType.html
- Minecraft raids: https://minecraft.fandom.com/wiki/Raid
- RimWorld storytellers: https://rimworldwiki.com/wiki/AI_Storytellers
- RimWorld raid points: https://rimworldwiki.com/wiki/Raid_points
- RimWorld wealth: https://rimworldwiki.com/wiki/Wealth
- Sim Settlements 2 plots: https://wiki.simsettlements2.com/gameplay/plots-and-plans
- Sim Settlements 2 leveled city plans: https://wiki.simsettlements2.com/CreateAddons/Leveled-City-Plans
- Fallout 4 happiness: https://fallout.wiki/wiki/Happiness_(Fallout_4)
- Terraria NPC happiness: https://terraria.wiki.gg/wiki/Guide:NPC_Happiness
- Starbound colony deed: https://starbounder.org/Colony_Deed and tenants https://starbounder.org/Tenant
- Necesse settlement: https://necessewiki.com/Settlement
- Dragon Quest Builders 2 rooms: https://dragon-quest.org/wiki/List_of_room_recipes_in_Dragon_Quest_Builders_2
- Manor Lords burgage plots: https://wiki.hoodedhorse.com/Manor_Lords/Burgage_Plot
- Foundation desire paths: https://www.pcgamesn.com/foundation/roads-desire-paths-city-builders
- Frostpunk hope and discontent: https://www.pcgamer.com/frostpunk-developers-on-hope-misery-and-the-ultimately-terrifying-book-of-laws
- Stardew schedules: https://stardewvalleywiki.com/Modding:Schedule_data and events https://stardewvalleywiki.com/Modding:Event_data
- Skyrim Radiant Story: https://ck.uesp.net/wiki/Radiant_Story
- Radiant AI: https://en.wikipedia.org/wiki/Radiant_AI
- Immersive Citizens: https://www.nexusmods.com/skyrimspecialedition/mods/173
- Inconsequential NPCs: https://www.nexusmods.com/skyrim/mods/31241
- Ultima VII schedules: https://lycaeum.ultimacodex.com/npc-schedules/
- Inside Gothic routines: https://ataulien.github.io/Inside-Gothic/DailyRoutine
- The Sims AI: https://users.cs.northwestern.edu/~forbus/c95-gd/lectures/The_Sims_Under_the_Hood_files/outline.htm
- Crusader Kings III stress: https://admin-forum.paradoxplaza.com/forum/developer-diary/ck3-dev-diary-31-a-stressful-situation.1399764/page-2
- Bannerlord passage of time: https://www.taleworlds.com/en/Games/Bannerlord/Blog/14
- Kenshi world states: https://kenshi.wiki/w/World_States
- Medieval Dynasty reputation: https://www.gamepressure.com/medieval-dynasty/reputation-and-approval/z2dfa7
- Enshrouded survivors: https://enshrouded.wiki.gg/wiki/Survivors
- V Rising servant hunts: https://gamerguides.com/v-rising/guide/dominance/servants/how-to-send-servants-out-for-hunts
- Palworld sanity: https://palworld.wiki.gg/wiki/Sanity
- 7 Days to Die traders: https://wiki.7d2d.net/game/traders/
- Banished: https://wikiwand.com/en/articles/Banished_(video_game)

Procedural settlements:
- Emilien and others 2012: https://perso.liris.cnrs.fr/egalin/Articles/2012-villages.pdf (also https://hal.archives-ouvertes.fr/hal-00694525)
- GDMC 2018: https://arxiv.org/pdf/1803.09853 and the first-year report https://arxiv.org/pdf/2103.14950

### Sources not reachable

Every web page above was found by search but not opened: WebFetch was turned off for the unattended run (it asks for
approval per site) and reading pages through the Chrome tools was not done, since that would have gone around the
same approval. So the [known] numbers are unchecked. The pages that matter most to check:

- https://wiki.simsettlements2.com/gameplay/plots-and-plans
- https://thunderstore.io/c/valheim/p/RustyProductions/ValheimCityBuilder/ (no public source found;
  github.com/RustyMods/ValheimCityBuilder does not exist)
- https://thunderstore.io/c/valheim/p/under2ker/LivingFactions/
- https://rimworldwiki.com/wiki/AI_Storytellers and https://rimworldwiki.com/wiki/Raid_points
- https://terraria.wiki.gg/wiki/Guide:NPC_Happiness
- https://wiki.hoodedhorse.com/Manor_Lords/Burgage_Plot
- https://kenshi.wiki/w/World_States
- https://stardewvalleywiki.com/Modding:Schedule_data
- https://minecolonies.com/wiki/systems/happinessandsaturation
- https://perso.liris.cnrs.fr/egalin/Articles/2012-villages.pdf
