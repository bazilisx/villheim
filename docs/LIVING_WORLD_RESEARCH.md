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
