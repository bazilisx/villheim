# ValheimCityBuilder study

Study of ValheimCityBuilder 1.8.2 by RustyProductions (and World Edit 1.9.2, which it runs on), read on 2026-11-08
for ideas Villheim can build its own way. Tyler named it one of the closest mods to what he wants. The feature table
is `docs/features/citybuilder.csv` (one row per mechanic, with status and effort).

Code may be reused: Rusty and the contributors told Tyler on 2026-11-08 that the mod is CC0 (see the licence
section). The designs it ships stay out.

## What the mod is

- Thunderstore: https://old.thunderstore.io/c/valheim/p/RustyProductions/ValheimCityBuilder/ (1.8.2, created
  2026-10-25, updated 2026-11-08). Nexus: https://www.nexusmods.com/valheim/mods/4613 (the page refused the reader).
- Categories on Thunderstore include "AI Generated". Manifest `website_url` is the author's YouTube channel
  (https://www.youtube.com/@RustyHS). Code by Rusty, with large parts credited to 1Day2Die and Ybivec228 from the
  mod's Discord.
- Press F7 and the game switches to a top-down city view with a build menu, resource bar and info panels. The player
  places buildings; settlers move in and work them. F6 opens World Edit, a map editor with terrain brushes, roads,
  rivers, lakes, forests and blueprint houses.
- The package `ValheimCityBuilder.dll` is a 4 KB shim. All code (city builder and editor, namespace `ValheimAnno`, about
  100,000 lines decompiled) is inside `WorldEdit.dll` from the World Edit package. The package also ships 175
  `anno_*.blueprint` files (creator line "ValheimAnno") and a feature list (`ValheimAnno.features.json`, 249 entries).
- Downloads worked from the cloud. Study copies: `/tmp/citybuilder/dl` (zips), `/tmp/citybuilder/vcb` and
  `/tmp/citybuilder/we` (unpacked), `/tmp/citybuilder/src/we` (decompiled with `ilspycmd -p`, needs
  `DOTNET_ROLL_FORWARD=Major`), `/tmp/citybuilder/features.txt` (the feature list as text). Nothing of it is in the repo.

## Licence

- No licence file in either package, none in the manifests, none on the Thunderstore page, none in the assembly. The
  README says "The mod is free and stays free", which is about price.
- No public source repository found (web searches; GitHub `RustyMods` is a different author). 1Day2Die's
  `CityBuilder-BetaTester-Mod` (https://github.com/1day2die/CityBuilder-BetaTester-Mod) calls the mod "the
  ValheimCityBuilder fork" and refers to a local checkout, with no public URL and no licence file.
- Dropday.ai (https://dropday.ai/c/valheim-city-builder) labels the project "Open source" with no licence and a link
  to Thunderstore's own UI repository; the page itself warns its text may be generated or wrong. Not evidence.
- 2026-11-08: Tyler asked Rusty and the contributors (1Day2Die, Ybivec228). They told him ValheimCityBuilder is
  released under CC0 (public domain dedication). Code from it and from World Edit may be reused and changed in
  Villheim. CC0 asks for no credit; Villheim credits them in the README anyway.
- Still to do: a copy of their CC0 statement (a link to the message, or a LICENSE file in a later package) goes in
  `docs/licences/` so the record does not depend on memory.
- Before that note, the finding was: no licence anywhere, so all rights reserved, ideas only.
- Designs: the Tavern, Expedition Hall, Smelter, Armorer, Silver Mine and Silversmith use OverDrive BiomeBlueprints
  houses, and the blueprint gallery downloads that pack. BiomeBlueprints is blacklisted for Villheim (2026-11-08).
  The `anno_*` blueprints have no stated licence either. CC0 covers the authors' own work; it cannot cover designs
  from other creators, so Villheim uses none of these until Tyler confirms who made the `anno_*` builds.

## Author's posts

Reddit cannot be read from this environment (reddit.com answers 403 and the web reader reports the site as blocked),
so the posts were found second hand only. Tyler can open them directly.

- r/ClaudeAI post, https://reddit.com/r/ClaudeAI/comments/1xg1mov, by u/Any-Explanation3814 (205 points), found
  through a summary at https://usecases.sh/use-case/build-a-city-builder-mod-for-valheim-that-tests-itself-in-game.
  The summary site says the poster is Rusty; this was not checked.
- What the summary says the post covers:
  - Built in one long chat with Claude. The poster did the design and testing; Claude wrote most of the C# as a
    BepInEx plugin with Harmony patches into the game's systems.
  - A command file that Claude could write to steered the running game: build a town, take screenshots, judge the
    result, fix problems. This loop is how the mod "tests itself".
  - Two tester bugs (bosses chasing players into town, scouts stuck) fixed in one pass.
  - An in-game benchmark with 10 to 150 houses. Merging finished houses into one mesh for drawing took a test town
    from 36 to 56 fps.
  - The r/valheim thread was mostly arguments about AI.
- Nothing found about a licence, open source, sharing the code or reuse by others. The only line close to it is
  Dropday's "the dev says Claude wrote most of the C#", which says nothing about rights.
- Not reached: the Reddit posts themselves, other posts by the same account, the YouTube descriptions (rate limited),
  the Nexus page and its permissions tab, the Discord. If the Nexus permissions tab or a post grants reuse, quote it
  here before anything changes; until then the rule above stands.

## How it is put together (short)

- One static class per system, ticked from a central update: `Colony` (needs, taxes, production), `Ledger` (every
  building as a record, also when unloaded), `Roster` (workers per building), `Regrowth`, `Events`, `Expeditions`
  (raids and armies as moving records), `Sites` (clans, traders, lairs, boss camps), `Villages` (clan village plans),
  `Tech` (research), `Ages`, `Heroes`.
- Town state lives in its own save file per world (`AnnoWorld`, three rotating backups); buildings and pieces carry
  ZDO keys (`anno_grp` group, `anno_bld` type, `anno_res` residents, plot centre and size).
- Off-screen work is counted: a work building whose worker is not loaded still adds goods at a rate from its
  "richness" (trees, rocks or game counted around it). Workers who are loaded do the work for real.

## 1. Settlers and villager behaviour

### How it works

- **Houses and residents.** Three home tiers: Viking Hut (2 residents, 15 wood), Karl House (4, 40 wood and 30 coins,
  after Eikthyr), Jarl Hall (6, 120 wood, 60 stone, 150 coins, after the Elder). Residents are a number on the house
  (`anno_res`), not one NPC each. Worker NPCs are spawned for work buildings from the free residents of the right
  tier, and up to 15 residents stroll as decoration.
- **Needs by tier, once a minute.** Tier 1 wants one food from a list (berries, mushrooms, honey, cooked meat or
  venison, carrot, cooked fish). Tier 2 wants meat, fish or honey, and mead. Tier 3 wants meat, mead, coal and bread.
  Amount per round is one unit per two residents of that tier (Root Cellar research: 15% less food). If the warehouse
  holds all of a tier's needs they are taken, and each connected house of that tier gains residents up to capacity
  (twice as fast during a festival). If anything is missing, each house of that tier loses one resident, down to one.
- **Moving out** is that loss of one resident a minute while a need is unmet. A ruined house drops to zero.
- **Taxes** per resident per minute: 1, 3 and 8 coins by tier, times research bonuses, minus soldier upkeep and hero
  wages. Houses must be connected by road to a warehouse to grow or pay.
- **Upgrades.** A full house with its tier's needs met can be upgraded in place to the next tier: the old building is
  taken down and the next tier's design is built on the same spot (an upgrade preview shows the room it needs).
  Work buildings have levels too: an annex blueprint is placed beside the building and its rate goes up.
- **Working in buildings.** Gatherers (lumberjack, quarry, forager, hunter) run a small state machine: idle, walk to
  target, work, collect drops, carry to the nearest warehouse when the load reaches the carry limit (20, more with
  research). Search order: drops first, felled logs next, then fresh work; an unreachable target is set aside for
  90 s. Station workers (smokehouse, mill, bakery) walk back and forth between their building and the warehouse while
  a timer makes the goods. Farmers plant the vanilla carrot or barley sapling on a field grid behind the farm,
  harvest what is ripe and carry it in.
- **Hunting trips.** When no game is in reach for 12 s, a hunter walks to a point at the edge of his range, stalks
  about for a while and comes back with a rolled catch (deer meat and hide, or boar meat and scraps). Hunting cabins
  need open land: the share of free ground 15 to 49 m around the cabin scales how often game comes and how long trips
  take.
- **Strolling.** A resident walks a road path to a random building within 150 m, keeping 0.55 m to the right of the
  road's middle so two walkers pass each other, rests a few seconds, picks the next.
- **Clearing.** The player marks trees, rocks, stumps and bushes; free residents and idle workers clear them at half
  a worker's speed.
- **Heroes (tavern).** Three candidates a day per tavern from a seed (tavern, day, slot): warrior, berserker, hunter or
  völva, level 1 to 3, gear of the current age. Hire cost 50 + 40 per level + 40 per age; a wage each tax round
  (2 + level + age); three unpaid rounds and the hero leaves. Heroes guard the town, take orders, or follow the
  player (E), through portals (patch on `Player.TeleportTo` moves followers within 30 m to the target), into
  dungeons and onto ships. Experience from kills, 150 x level^1.6 per level, up to 10: +8% health and +6% damage a
  level. Items given with a hotbar key are worn. A fallen hero is back at the tavern after 10 minutes, or at once
  for 15 + 10 x level coins.
- **Raids with warning.** A raid is a record that walks from a real place (a clan at war or a hostile tribe) toward
  the town at 2.8 m/s (9 m/s by sea), with a banner, compass direction and arrival time. Five or more raiders split
  60/40 into two waves 45 s apart. Raiders only become real near the town. A raid that wins burns down one of the
  six buildings nearest to it.
- **Thief.** A thief appears 60 m out in a random direction, sneaks to the warehouse, takes max(10, coins/6) coins
  and runs for a point 110 m out. Soldiers or archers who catch him get the coins back plus 20. Night Watch research
  stops him at the gate.
- **Fire.** A random building burns for 75 s. Paying coins puts it out (free with the Village Well research); rain
  puts it out too; otherwise it becomes a ruin.
- **Ruins.** The building's anchor gets a ruin flag, its settlers go, and about 80% of walls and 40% of poles and beams
  fall (picked by a stable hash of each piece, so the same pieces fall on every machine); floors and stairs stay.
  Rebuilding costs half the building's cost and puts back exactly the missing pieces from the saved plan.
- **Events.** One every 8 to 14 minutes once there are six buildings, never the same twice in a row: fire, harvest
  festival (spend mead or food: double taxes and faster growth for a while), travelling merchant (4 minutes, two
  goods to buy, one to sell, at worth x0.8 and x1.4), thief, blood moon (the "Clear" environment cloned with red fog
  and light; a horde of about 5 x age from the nearest lair walks in from 230 m), treasure (a chest 110 to 260 m out,
  60 to 140 coins plus amber or rubies when the player walks there).

### What Villheim has today

- Real villagers, one NPC each, with beds, sleep, food, cooking, moods, roles and trades (`Villagers/*`). Newcomers
  only for a free bed. Complaints and leaving after days without a bed, food or safety (`Complaints.cs`,
  `Leaving.cs`), expectations and food variety by stage (`Expectations.cs`), prosperity (`Prosperity.cs`).
- Upgrades: buildings rebuilt as the next level of their family or a bigger design (`Growth.cs`), not tied to needs.
- Hunting, foraging, farms, replanting, repairs, raids (built, off), pedlars, calendar festivals, feasts, eight
  village events, horn and help in a fight (`Escort.cs`). No fire, thief, treasure, blood moon, ruins state or heroes.

### What to take and how Villheim would do it

1. **Home tiers with needs** (partly there, M). Each home keeps a tier from its design (hut, house, hall by stage or
   bed count). Its household wants what its tier asks for, from the village chest: any food; then meat or honey and
   mead; then meat, mead, firewood or coal, and bread or another baked dish when the biome allows. Met for
   `HomeNeedsDays` mornings in a row: the home may be upgraded. Unmet: the existing complaint and leaving chain runs,
   counted per household. Files: `Villagers/Expectations.cs` (tier wants), `Villagers/Complaints.cs` (new need kinds
   "mead", "warmth"), `Village/Growth.cs` (upgrade gate), `Village/VillageNeeds.cs` (gatherers and hunters fetch
   what homes want), `Villagers/Healing.cs` (eating takes the food). Settings: `HomeNeeds` (on), `HomeNeedTiers`
   (text table), `HomeNeedsDays` (3), `UpgradeNeedsMet` (on).
2. **Full home before an upgrade** (new, S). Growth picks a home for upgrade only when all its beds are taken and its
   needs were met. `Village/Growth.cs`.
3. **Fire and ruins** (new, M). A village event "fire" on a building with wooden walls: real fire effects on a few of
   its pieces (the game's `fire_pit` flame child), villagers within 40 m run to it and work at it with the repair
   swing, 75 to 120 s. Rain or enough villagers working puts it out; otherwise a share of walls and poles is destroyed
   with `WearNTear.Destroy`, picked by a stable hash of each piece's ZDO id, floors kept. The builder's existing repair
   order (`Villagers/Repairs.cs`) then rebuilds it from the chest. Chronicle and news lines. Files:
   `Village/VillageEvents.cs`, `Villagers/Repairs.cs`, `Dialogue/growth.txt`. Settings: `EventFire` (on),
   `FireSeconds` (90), `RuinWallShare` (0.8), `RuinPoleShare` (0.4). Risk: fire near the player's own base pieces;
   keep it to pieces marked as the village's.
4. **Thief** (new, S). A stranger (wanderer kind `thief`) walks in by night from 60 m, takes coins or one stack from
   the chest and runs for 110 m out. Protectors on watch give chase; a player who kills or catches him gets it back.
   `Village/WorldLife.cs`, `Villagers/Wanderers.cs`, `Village/VillageChest.cs`. Settings `EventThief`,
   `ThiefShare` (0.15).
5. **Treasure rumour** (new, S). A villager or pedlar tells of a cache; a map pin 110 to 260 m out; a vanilla
   `TreasureChest_meadows` placed when a player gets near, filled from a biome loot list. Ties into hermits' pins.
   `Village/WorldLife.cs`, `Village/MapPins.cs`. Setting `EventTreasure`.
6. **Raids from real places** (partly there, M). Today raiders appear near the village at night. Take: the raid party
   is a caravan record (`Caravans.cs` has the machinery) from a real camp location (greydwarf nest, goblin camp,
   draugr village) within 1,300 m; it walks on the world clock and becomes real 100 m from a player. Warning at dusk
   names the direction ("from the north-east"), a second wave of 40% follows 45 s later when the party is five or
   more. A lost raid burns one of the six buildings nearest the attack (item 3). Files: `Village/Raids.cs`,
   `Village/Caravans.cs`, `Village/Prosperity.cs`. Settings `RaidFromCamps`, `RaidSecondWave` (0.4).
7. **Blood moon** (new, S to M). A rare night: a cloned environment with red fog through `EnvMan` (logic can append
   an `EnvSetup` at runtime and force it), and a raid of item 6 twice the size. Setting `EventBloodMoon`.
8. **Hunting grounds** (new, S). The hunter's success and how far he walks scale with open land around the village
   edge: count built-over ground 15 to 50 m out. A village hemmed in by buildings sends hunters further.
   `Villagers/Hunting.cs`.
9. **Walking on the right of the path** (new, S). Strollers and walkers on a laid path keep 0.5 m to its right, so two
   villagers pass each other. `Villagers/Walker.cs`, `Villagers/FreeTime.cs`.
10. **Heroes for hire** (partly there, M to L). Fits proposal 25 (wanderers at the longhouse). Up to three strangers a
   day sit in the longhouse, drawn from a seed of village and day: warrior, berserker, hunter or seeress. Hired with
   coins or goods from the player, a wage from the player each few days, leaves after three unpaid rounds. Follows the
   player through portals (a logic Harmony patch on `Player.TeleportTo` moving followers within 30 m), levels from
   kills, wears gear handed over. A fallen hero returns to the longhouse after a day. Files: `Villagers/Escort.cs`
   (following), `Villagers/Wanderers.cs` (kind `hero`), `Village/WorldLife.cs`, `Villagers/VillagerSkills.cs`
   (levels). Settings `Heroes`, `HeroesPerDay` (3), `HeroWage`, `HeroMaxFollowers` (3). Risk: followers through
   portals and into dungeons need care in multiplayer (owner of the ZDO moves it).

### Effort and risks

Home tiers and the upgrade gate are an evening or two on top of complaints and expectations. Fire and ruins need the
repair code to handle half-destroyed buildings well. Heroes are the largest piece and overlap with the horn.

## 2. Buildings and production chains

### How it works

- 31 building types, each with a cost, an age, an "anchor" piece that identifies it (a bed for homes, a chest for the
  warehouse, a workbench extension for the lumberjack, a flint pile for the forager), a worker job, inputs, outputs
  and a cycle time. Examples: Apiary 1 honey per 45 s; Smokehouse raw meat to cooked meat, venison to cooked venison,
  20 s; Charcoal Kiln 4 wood to 1 coal, 30 s; Meadery 2 honey and 2 berries to 1 minor healing mead, 45 s; Mill 2
  barley to 1 flour; Bakery 2 flour to 1 bread; Smelter scrap iron or silver ore plus 2 coal to a bar; Weaponsmith 4
  wood and 2 flint to a spear and shield (keeps at most 8); Silver Mine 2 wood (pit props) to silver ore.
- Production runs on a timer while the building has a worker, a road to a warehouse, the inputs, and the output is
  below its cap. The status text names what is missing. Rates scale with building level and research.
- Gathering yield per minute when the worker is not loaded follows "richness": trees, rocks or game counted in the
  work radius (35 m). Wood 5 + 0.12 x trees a minute; stone 2.5 + 0.35 x rocks.
- **Regrowth around work buildings**, every 2 s per building, each kind on its own interval (shorter with more
  richness): lumberjacks keep 10 to 30 trees in their radius by planting saplings, on a stump first (the stump is
  removed) and in open spots 6 m from the hut otherwise, of the biome's kinds (beech, oak, birch in the Meadows, pine
  and fir in the Black Forest, fir in the mountains, birch in the Plains). A forager nearby halves the interval and the
  sapling's grow time. Quarries spawn new rocks (3 to 12). Hunting cabins spawn deer and boar (2 to 8). Foragers
  shorten nearby bushes' respawn time and plant the bush the area is shortest of. Ore Quarry: one ore vein of the
  kinds that were there every 8 minutes, up to the starting count (at most 4).
- **Houses that build themselves.** Cost is paid up front. The site clears its footprint, then pieces appear one at a
  time ordered by height (the anchor piece last), 0.12 s per piece, 8 to 75 s in all, with the piece's place effect on
  every third. The building's footprint (centre, yaw, half width and depth) is written on the anchor's ZDO. A saved
  plan of every piece lets the "Repair" button put back exactly what is missing, at a cost by the share missing.
- **Ages restyle buildings.** On a new age a building can be renovated: piece by piece, wood poles become log poles,
  wood walls become stacks of log walls (age 1), lower walls become stone and beams iron-banded (age 2), windows
  crystal (age 3), roofs dark wood (age 4), black marble (age 5), grausten and ash wood (age 6).
- **Roads to the warehouse.** Every half second two buildings are checked by a flood fill over road cells (paved,
  cleared or cultivated ground, 1.5 m cells) from the building to a warehouse. Not connected: no growth, no taxes, no
  production.
- **Wet ground.** In the swamp a building stands on a stone plinth and costs 20% more.

### What Villheim has today

- Building piece by piece with a real builder at the piece, ground first, support order, doors and windows first,
  paid per piece from the chest (`Village/ConstructionSite.cs`, `Designs/BuildOrder.cs`). Villheim is far ahead here;
  the mod's self-building is a timed spawn with no worker.
- Repairs of destroyed pieces from the design (`Villagers/Repairs.cs`), material swaps down a stage
  (`Village/MaterialSwap.cs`), cooking at the real station, a smith at the real station (`Smithing.cs`), farms of
  bushes, foraging, hunting, replanting one sapling per tree outside the village (`Replanting.cs`), groves
  (`Groves.cs`), paths with a daily door check (`PathPlanner.cs`).

### What to take and how Villheim would do it

1. **Production at real stations** (new, L). Villagers run the game's own stations from the chest, as the smith
   already does: a charcoal kiln (vanilla `charcoal_kiln`, wood in, coal out), a fermenter for mead (needs a cauldron
   brew first), beehives for honey, the smelter once copper and tin come in, later the windmill and oven where the
   biome has barley. The worker walks to the station with the inputs, adds them through the station's own add
   method, waits, takes the output to the chest. Station pieces come with the work designs. Files: new
   `Villagers/Production.cs` (after `Smithing.cs`), `Village/VillageNeeds.cs` (inputs to gather), `Villagers/Roles.cs`
   (who works it). Settings: `Production` (on), `KeepCoal` (10), `KeepMead` (6), `KeepHoney` (10). Crafted bee hives are
   fine (Tyler, 2026-11-08); only wild hives, which poison people nearby, stay out of designs.
2. **Output caps** (new, S). Every product has a keep amount; a station worker stops at it and does other work.
   Fits "nobody harvests when the village needs nothing". `LogicConfig.cs` table.
3. **Missing-input status** (new, S). The hearth hover and `vh village` name what each station lacks ("Kiln: needs
   wood"). `Village/VillageState.cs`.
4. **Replant on stumps and keep a stand of trees** (partly there, S). Replanting today puts saplings 8 to 25 m beyond
   the village. Add: prefer the stump of a felled tree outside the village radius (remove the stump, plant there),
   and keep a target count of trees around a logging outpost. A forager nearby halves grow time. Files:
   `Villagers/Replanting.cs`, `Village/Groves.cs`, `Village/Outposts.cs`. Settings `ReplantOnStumps` (on),
   `WoodsTarget` (20).
5. **Bushes that come back faster near a forager** (new, S). Pickables within the forager's range get a shorter
   respawn; the bush kind in shortest supply is planted. `Villagers/Foraging.cs`, `Village/Farms.cs`.
6. **Ore that grows back** (new, S, needs a decision). An outpost by copper or tin regrows one vein every 8 game
   minutes up to the starting count. This invents resources; Tyler should decide.
7. **Renovation when the village advances** (new, M). The reverse of `MaterialSwap.cs`: when the stage cap rises (a
   boss falls), the builder swaps pieces of standing buildings up to the new stage's material, one piece at a time,
   paid from the chest. Files: `Village/MaterialSwap.cs` (an "up" direction), `Villagers/Repairs.cs` (the builder's
   queue), `Village/BossStages.cs`. Setting `RenovateOnStage` (off until tested).
8. **Exact repair by saved plan** (already there). Repairs works from the design. Nothing to take.
9. **Connected to the network** (already there in part). The daily door check plans a path for any building not on
   the network. The mod's rule that an unconnected building does not work could become a mood or work penalty.
10. **Swamp plinth** (new, S). Swamp designs get a stone foundation course under them. Only if Swamp villages come.

## 3. Terrain, water and roads

### How it works

- **The 8 m limit.** Valheim clamps terrain change to plus or minus 8 m around the generated height. The mod replaces
  the 8 and -8 constants inside `TerrainComp.ApplyToHeightmap`, `LevelTerrain` and `RaiseTerrain` with a setting
  (`TerrainMaxHeightChange`, 100 m) through a Harmony transpiler. Everyone needs the mod; without it a client shows at
  most 8 m.
- **Writing heights directly.** One routine takes a list of 1 m grid points and a target function (point, current
  height to wanted height or "leave"). For each point it finds every heightmap touching it, gets or creates its
  `TerrainComp`, works out the base height (height minus level delta minus smooth delta, cached a second), and sets
  the level delta to wanted minus base, clamped to the limit, with smooth delta 0 and the modified flag set. Then it
  bumps the operation count, saves each `TerrainComp`, pokes the heightmap and resets grass in the area. Villheim's
  `TerrainShaper.LevelPad` does the same core step.
- **Plot edges.** Levelling a rectangle uses a smoothstep from the target height at the edge to the current height
  at the band's end; points inside other buildings' plots (kept on their anchor ZDOs) are left alone.
- **Village zones.** Drag out 8 to 64 m on a side; it costs 1 wood per 25 m2. Checks: explored, loaded, under 30%
  water, under 15% of points more than the limit from the median height. Target height is the median (at least 1 m
  over water). The edge band is 1.8 x the largest height difference just outside, 4 to 14 m. Trees in it are felled
  (3 wood each to the warehouse). The work is a list of points, inner area first from the middle out, then the band
  from the inside out, written at 180 points a second, pausing when out of loaded range. No villager animation.
- **Level Ground.** A marked area with a chosen height becomes a list of spots. A free settler within 150 m claims
  the nearest spot (claims time out after 90 s), walks there, swings for 3 s (scaled by a work-speed setting), and the
  spot is levelled: 1 m around it to the target, a 2.5 m smoothstep band beyond. Spots within 2.5 m of any building
  piece are skipped so nothing loses its footing; dirt and paved roads are levelled with the ground. A preview shows
  each spot coloured by fill or dig. "Fix ground" levels under a finished building to its floor.
- **Paths that follow slopes** (editor tool, but the method is general). The path is resampled every 1 m. Ground
  along it is averaged across the width plus 5 m each side and smoothed. Two envelopes are built forward and back: the
  highest profile at or under the ground that never climbs more than 0.33 m per metre (cut), and the lowest at or over
  the ground with the same limit (fill). Where the ground strays more than 0.25 m from both, the span is cut or filled,
  whichever moves less; a fill deeper than 2.2 m (or over water) becomes a bridge, a cut deeper than 5.6 m becomes a
  tunnel. Spans are merged and the profile is drawn straight across them, then written with a smoothstep shoulder.
  Bridges are wood (stone for paved roads), placed as pieces; tunnels are a stone tube with a portal and lamps.
- **Rivers with real water.** Points every 2 m along a drawn curve. The line is turned so it runs from high to low.
  Water height at each point = running minimum of (lowest ground across the bed - 0.35 m), averaged over five points,
  then forced never to rise downstream, never below sea level - 2 m. The bed is carved parabolic (depth at the middle,
  0 at the banks) and the banks blend out with a smoothstep; plants in the bed are cleared. Steep drops give
  waterfalls. The water is stored per 64 m zone as a text field on that zone's `TerrainComp` ZDO, so it travels with
  the terrain to every client. When a zone loads, a mesh strip (five vertices across, the game's own water material
  taken from any loaded `WaterVolume`) is built at the water heights, and one `WaterVolume` trigger box per segment
  makes it swimmable water.
- **Lakes.** A polygon and a level, stored the same way; the surface mesh is ear-clipped and covered with 6 m
  `WaterVolume` boxes (at most 900).
- **Sea taken away** (editor): a mask per zone and a patch on `WaterVolume.GetWaterSurface`, so dug ground below sea
  level stays dry. Editor only.
- **Terrain that loaded without its changes.** The game can create a fresh `TerrainComp` for a zone before the saved
  one has loaded, and the zone then shows the original ground with hard edges. The mod patches
  `Heightmap.GetAndCreateTerrainCompiler` and `ZNetScene.CreateObjectsSorted` so the saved one is created first, and
  reloads a broken one when the land is there.

### What Villheim has today

- `Designs/TerrainShaper.cs` writes level deltas directly (`LevelPad`, max change 16 m) and paints paths with
  terrain operations. Sites are levelled at once when they break ground (`ConstructionSite.cs`), the hearth area by
  `HearthGround.cs`. Paths: A* with squared slope cost (`PathPlanner.cs`), laid by a walking villager
  (`Villagers/PathLaying.cs`), trails between villages (`Trails.cs`). No water, no ramps or bridges.

### What to take and how Villheim would do it

1. **Check the 8 m clamp** (finding, S). `LevelPad` allows 16 m, but if `ApplyToHeightmap` clamps at 8 m the extra is
   lost when the heightmap is rebuilt. Read `TerrainComp.ApplyToHeightmap` in the decompiled game. If it clamps, a
   transpiler on the three methods (a patch class in `src/Villheim.Logic`, loaded per class) with a `TerrainMaxChange`
   setting. Every player needs Villheim anyway.
2. **Ground levelled spot by spot by villagers** (partly there, M). Break-ground levelling becomes a job: the site's
   pad is a list of 1 m spots, inner first, then the band; the builder (or any free villager) walks to the next spot,
   swings the pickaxe or hoe for 2 to 3 s and the spot is written. Spots within 2.5 m of a standing piece are skipped.
   The building starts when the pad is done. Files: new `Village/GroundWork.cs`, `Village/ConstructionSite.cs`,
   `Villagers/Chores.cs`. Settings `GroundWorkBySpots` (on), `GroundSpotSeconds` (2.5), `GroundBand` (4 to 14 by
   slope).
3. **Village zone before the first buildings** (new, M). A new village picks the median height of its core
   (hearth plus the first ring of plots) and levels it as a zone over the first days, felled trees to the chest. Same
   job list as item 2. `Village/HearthGround.cs`, `Village/PlotFinder.cs`.
4. **Paths that hold a walkable grade** (new, M). After A*, run the cut and fill envelope pass on the path's height
   profile (0.33 m per metre), write the cut and fill along the path with smoothstep shoulders, and put a short plank
   bridge (vanilla `wood_floor` and `wood_pole` pieces from the chest) where a fill is deeper than 2.2 m or crosses a
   stream. Tunnels are out of scope for villages. Files: `Village/PathPlanner.cs` (profile), `Village/PathBuilder.cs`
   (writes), `Villagers/PathLaying.cs` (the villager does each stretch), `Village/Trails.cs` (between villages).
   Settings `PathMaxGrade` (0.33), `PathBridgeDepth` (2.2).
5. **Streams and ponds** (new, L). A village by a stream, a mill race, a fish pond. Logic can build the water: a mesh
   with the game's water material plus `WaterVolume` trigger boxes, data kept on the zone's `TerrainComp` ZDO or the
   hearth ZDO, rebuilt when the zone loads. A stream line would come from world generator heights (downhill from a
   spring to a lake or the sea) and follow the river method above in Villheim's own code. Files: new
   `Village/Streams.cs`. Setting `Streams` (off until tested). Risks: water objects made at runtime are not saved by
   the game; every client must rebuild them; swimming and fish behaviour need testing.
6. **Protect the terrain on load** (finding, S to M). Villheim changes terrain in many zones. If zones ever show
   their original ground, the duplicate `TerrainComp` race above is a likely cause. Worth a log check first.
7. **Plot protection while levelling** (new, S). Levelling never writes inside another building's footprint (kept
   on the hearth's plot list). `Designs/TerrainShaper.cs`.

## 4. Research, ages, diplomacy, scouts, ships, armies, multiplayer

### How it works

- **Research.** Skald's Fire makes knowledge: 1 a minute plus 0.5 per home within 30 m (more from seers in Jarl
  halls, festivals, treasure). 51 topics in seven rows (one per age) and three branches: Economy (faster work, bigger
  loads, cheaper trade), Community (faster growth, taxes, festivals, a well against fires, a night watch against
  thieves), War (troops, towers, raid warning 60 s earlier). Costs 20 to 1,000 knowledge.
- **Ages** come from bosses: each boss lives in a guarded camp (a palisade ring with gates and fires, styled per
  boss); the boss is shielded until its guards are dead. Summoning at altars is turned off. Each age unlocks
  buildings and a new material look.
- **The world outside.** Fog over the map; scouts walk it open, find clans, traders, the Dvergr, hostile tribes,
  dungeons, boss altars and ore. Clans are records with a personality (peaceful, warlike, builder), stock, what they
  make and want, population, tier and a relation that drifts toward a target by personality and agreements
  (+0.6 a tick at most). Below -35 or -55 a clan declares war and raids every 6 to 11 minutes; after 15 minutes of
  war it may offer peace. Trade goes by caravan or ship; gifts, agreements, alliances, tribute.
- **Clan villages build themselves.** Each clan gets a plan from its seed in one of four styles: star (roads out from
  a round plaza with the hall in the middle, an optional ring road), grid town, street village (one long bent main
  street with two to four side lanes), crossroads. Plots line both sides of each road, sized to fit (8 to 12.5 m deep,
  some double plots for special buildings), ordered by distance from the middle with main roads first. The plan holds
  a wanted role and level per plot (hall, house, workshop for a good it makes, special building); the clan's "think"
  step raises wants over time; the world catches up by building plots when a player is near. Some plots get a fence
  round the back and sides (front open to the road, a shared side skipped) and props in the yard (wood stacks, stone
  pile, barrel, log bench, a beehive if the clan makes honey). Main streets are paved at tier 3. Thriving clans found
  daughter villages (up to 10 clans).
- **Lairs** regrow in new uncovered land, further out each age, up to 12.
- **Ships** sail trade routes on a found sea path, explore coasts island by island, carry armies.
- **Expeditions** into dungeon types (burial chambers, troll caves, sunken crypts, frost caves, infested mines): a
  party is away a few minutes and returns with that dungeon's loot list, stronger parties lose fewer.
- **Armies, campaigns, conquest, vassals, player wars, town ranks** (Guest, Citizen, Builder, Co-owner): RTS and PvP
  systems around the player's own town.

### What Villheim has today

Boss stages gate growth (`BossStages.cs`), relations drift (`Relations.cs`), caravans as records (`Caravans.cs`),
daughter villages (`Daughters.cs`), outposts, news, pedlars, hermits pinning places. No research, ships, armies,
fog or scouts.

### What to take

1. **Street layouts for villages** (new, L). Villheim places buildings by Millénaire rules on a grid with A* paths.
   The clan plan styles give a village a recognisable shape: a street village along a bent main road, a star around
   the hearth plaza. A culture or village type picks the style; `PlotFinder.cs` takes plots from the plan in order.
   Files: new `Village/StreetPlan.cs`, `Village/PlotFinder.cs`, `Village/PathPlanner.cs`, `Village/Culture.cs`.
2. **Yards with fences and props** (new, M). Proposal 26 (back yards) gets concrete rules: fence the back and sides,
   leave the front to the path, skip a side the neighbour already fenced, one to three props behind the house by what
   the village makes. Vanilla pieces only, from the chest. `Village/Amenities.cs`, `Village/Farms.cs`.
3. **Villages that grow on paper** (partly there, M to L). Far villages keep a plan of wanted buildings that grows on
   the world clock; the real village catches up when a player comes. Villheim's caravans already work this way.
   `Village/VillageBrain.cs`, `Village/Growth.cs`.
4. **Skald stories as a village resource** (new, S). The skald event and the elders' stories could count toward
   something (a mood lift for homes within 30 m of the longhouse fire in the evening). Research as a menu does not
   fit Villheim.
5. **Personality of a village** (partly there, S). Peaceful, warlike or builder villages: relation drift target,
   fence chance, how fast it grows. Villheim has village types (woodland, fortified, farming); the drift target by
   type is new. `Village/Relations.cs`.
6. **Expeditions to dungeons** (new, M). Proposal 23 with the mod's dungeon list and loot tables by type: a party of
   protectors with gear tier enough walks to a known crypt or cave and comes back days later with its loot.
7. **Scouts who mark places** (new, M). A villager sent out who pins crypts, caves and boss altars on the map for a
   friend of the village. Close to the hermits' pins.
8. Ships, fog, armies, PvP, ranks: noted in the CSV, not proposed.

## 5. Blueprints

- PlanBuild `.blueprint` and BuildShare `.vbuild` files are read from a folder. A blueprint becomes a building type
  by its anchor piece: the first bed in a home design, a chest in a warehouse, the building's work piece otherwise;
  if the design lacks it, one is added at a fixed place (in the middle, or outside a side wall for work buildings).
  Each type has a fixed plot size; a bigger design is squeezed to it with a warning. Items and wards in community
  blueprints are dropped.
- `variants.txt` lists which blueprints each building uses, by English building name
  (`Viking Hut: my_hut, my_longhouse`); `variants_template.txt` is written with every building and its current list.
  A file with the same name as a built-in one replaces it.
- Preview pictures are made in game from the real pieces once and cached.
- Villheim already reads both formats (`Designs/Blueprints.cs`) and names files `role-family-level` and
  `<baseID>_s#d#`. Worth taking: a plain mapping file Tyler can edit (kind or base ID to a list of design files,
  with a template written out), and the anchor rule as a check that every home design has a bed and every work
  design its station. `Designs/DesignLibrary.cs`, `Village/Keepers.cs`.

## Do not take

- The top-down city view, its camera, build menu, resource bar, minimap, tilt-shift look, small trees and always-day
  settings.
- World Edit as a tool: brushes, landforms, biome painting, taking the sea away, line and fence tools, the editor UI.
  (The terrain methods above are taken as ideas for villagers' own work.)
- Buildings that appear on their own or instantly. Villheim keeps a builder at every piece.
- Settlers as numbers on a house. Every Villheim villager stays a real person.
- Taxes as coins per minute, and research as a menu.
- Its shipped `anno_*` blueprints, the BiomeBlueprints designs and the in-game gallery that downloads them
  (blacklisted), and valheimians builds through its gallery.
- Flat or "gentle" world generation and "make new land hilly"; they change the whole world.
- Boss camps that replace altar summoning; RTS squads, campaigns, vassals and wars between players.

## Ranked: the ten worth most to Villheim

1. Home tiers with needs, moving out and upgrades only when full and content (M).
2. Production at the game's real stations, fed from the chest, with keep amounts (L).
3. Ground levelled spot by spot by villagers; a village zone for the core; check the 8 m clamp (M).
4. Paths that hold a walkable grade, with cut, fill and small bridges (M).
5. Fire, ruins and rebuilding by the builder (M).
6. Raids that walk in from real camps, with warning, direction and a second wave (M).
7. Woods and bushes that come back around the village and outposts; replanting on stumps (S).
8. Streams and ponds with real water (L).
9. Street layouts with plots, yards, fences and props (L).
10. Heroes for hire at the longhouse who follow the player and level up (M to L).
