# Millénaire reference

What Villheim takes from Millénaire 9.0.3 (the NeoForge port, `Inspiration/millenaire-9.0.3.jar` in `Inspiration.zip`):
how it organises buildings, levels, growth, placement, paths and villagers. Ideas and numbers only. Millénaire is All
Rights Reserved and none of its code or data is copied into Villheim. Read this before decompiling the jar again; the
steps to re-create the decompiled source are in `docs/DEVELOPMENT.md`.

The data files are plain JSON inside the jar: `millenaire/cultures/<culture>/` (byzantines, indian, inuits, japanese,
mayan, norman, seljuk), each with `buildings/`, `villages/`, `villagers/`, `goal/`, `shops/`, `namelists/` and
`quests/`. `unzip` the jar into a scratch folder to read them; no decompiler is needed for these.

## Buildings, variants and levels (read 2026-11-07)

- **Schematic files** (read 2026-11-08): each level's `.nbt` is a vanilla structure file holding only what that level
  changes; air removes a block. Level L is levels 0 to L laid in order. A translation into Valheim pieces for study is
  in `docs/MC_TRANSLATION.md`.

- **One plan file per building.** `buildings/<category>/<id>.json`, for example `norman/buildings/houses/carpenterhouse.json`.
  Categories across all cultures: houses 179, lone 119, townhalls 76, walls 59, player 53, marvel 36, special 15,
  nodes 13, uninhabited 7, fields 7, extra 4, military 1.
- **Schematics are named `<id>_<variant>_<level>`**: `carpenterhouse_a_0` to `carpenterhouse_a_4`. The variant letter
  is another look of the same building (the Norman farm has `a` and `b`, each with levels 0 to 4). The level is the
  building's own upgrade step.
- **Each level is a whole schematic built over the one before.** Every level has its own footprint (width, height,
  depth), a priority, and optional tags, `path_level` and crops. Level 0 is the first build.
- **How many levels:** of 621 variants, 291 have one level, most others 2 to 6, a few town halls up to 14. The Norman
  manor (town hall) has 11 (0 to 10); a carpenter's house 5; a cattle farm 8.
- **Levels mix structure and decor.** Some steps grow the building (footprint height goes 8, 9, 10), others only add a
  garden (manor level 8 adds flower beds and the "garden" tag). Villheim splits these into s# (structure) and d#
  (decor).
- **Work buildings are homes too.** `carpenterhouse`, `lumbermanhut`, `farm` sit in the `houses` category and list
  their residents (`male: carpenter`, `female: wife`). The worker lives where he works.
- **Plan fields worth knowing:** `max_count` (how many of it a village may have), `min_distance` (share of the village
  radius, farms 0.5), `male` and `female` (resident types), `tags` (what the building provides: leisure, inn, market,
  oven, loom...), `priority` and `priority_move_in` per level, `building_orientation`, `ground_level`, `area_to_clear`,
  `shop`, `starting_goods`, `icon`.
- **Sub-buildings:** a plan can be part of another (`is_sub_building`, `parent_building` with id, variant and level),
  such as the manor's guest room `manor_a_inn`. `starting_sub_buildings` puts them up with the parent;
  `required_parent_tags` waits for a parent level to add a tag.
- **Town hall:** `is_town_hall: true`, its own category (`townhalls`), a shop, the village leader as resident, and
  the most levels. It is a building like the others; its levels add tags that unlock sub-buildings.

## Villages and growth tiers

- **A village type** (`villages/<name>.json`): a culture, biome tags, a weight for random choice, and a layout list of
  plans, each with a role: `centre` (the town hall), `start` (built at founding), `core`, `secondary`. Across all
  cultures: core 577, start 320, secondary 272, centre 126. The Norman "Village agricole" starts with a farm, grove,
  lumberman's hut, well and orchard; core adds bakery, carpenter, cattle farm, church, tavern, market and more;
  secondary adds glassblower, forge, guard house, inn, pig farm, presbytery.
- **Each building upgrades on its own.** New buildings open tier by tier (only the lowest unfinished tier is
  eligible). Upgrades of standing buildings are always in the pool, picked by weighted priority (later levels have
  lower priority, so a village tends to widen before it deepens).
- **For Villheim** (Tyler, 2026-11-07): the hearth is the town hall. Hearth levels and enough villagers and buildings
  move the village up a stage, which unlocks the next structure stage (s#) of its buildings. Between stages, villagers
  raise the decor stage (d#) of their own buildings over time.

## Study of 2026-11-06

Read from the decompiled jar in `Inspiration.zip` (the NeoForge port, "Millénaire 9") and its culture data files.
Ideas and numbers only; Millénaire is All Rights Reserved and none of its code is copied. How to re-create the
decompiled source is in `docs/DEVELOPMENT.md`.

### Village growth

- A village is a centre (the town hall) plus buildings in tiers: `start`, `core`, `secondary`, `extra`. Start
  buildings exist from founding; the rest are built later.
- Once a second, if no other building is going up (one site at a time by default), the village picks the next
  project at random, weighted by the plan's priority times a tier multiplier: start 6, core 4, secondary 2, extra 1.
  Only the lowest unfinished tier is eligible. Upgrades (a building's next level) are always in the pool.
- If the pick can't be paid for, it becomes the one "pending project". Its bill drives what villagers gather (need =
  bill + target stock - chest - what the builder carries). Meanwhile an affordable fallback can still be built.
- "Nothing to build" is cached for about 30 s; a plan that finds no site waits about 80 s.

### Placement

- Fixed village radius (90 blocks by default); every plan has a min and max distance as a share of it (farms 0.5 and
  up, quarry 0.6 and up, presbytery at most 0.8). The radius never grows.
- Ring scan from the inside out, four sides from a random start, first valid spot wins.
- A spot fails when it touches an occupied cell (buildings and paths), has more than about 10 bad cells (steep, wet,
  forbidden), has a neighbour cliff higher than gap + 3, is less than 70% reachable from the town hall, or breaks
  `far_from` / `close_to` tag rules (for example away from patrol points by 20).
- Buildings face the centre along the dominant axis.
- Villheim (2026-11-06): distance bands per role, ring order, path clearance and workshops near resources are in
  `PlotFinder`. Reachability, the cliff rule and tag rules are not done yet.

### Construction

- Each build is a precomputed flat list of steps: clear and fill the terrain first, then the structure, then pieces
  that hang on others (doors, torches, beds), sorted by layer and then in a snake over 8 x 8 tiles.
- One builder per site. He takes the whole bill from the chest in one trip, walks to the site and places blocks within
  about 5 blocks of where he stands (after 100 ticks stuck he places from where he is). Progress is saved so another
  builder can carry on. Three failures and the site stops blocking new projects.
- Villheim: the builder stands a step out from the edge of each piece and the site is levelled first. Materials are
  still paid per piece from the chest.

### Paths

- Laid after buildings, routed as a tree toward the town hall with waypoints, plus a few side links. 4-neighbour A*
  with a slope penalty (2.0 per squared slope), turn penalty 0.3, a bonus for reusing path cells, node budget 5000.
- Laying paths is background work (priority 50, clearing old paths 40), one villager at a time, one cell per action.
- Villheim: paths are walked and laid by one villager at a time (`PathLaying`), still on the L-shaped grid route.
  The A* router is still to do.

### Villager types and roles

- A villager type is a goal list plus tags (`helpInAttacks`, `raider`, ...). Buildings list their residents (male and
  female types); a building level can add residents. New residents come from children growing up or from arrivals.
- In the Norman culture the women build and haul; the men work their building's trade (lumberman, miner, smith...).
- Villheim keeps roles apart from gender: protector and carer by arrival order, trades from six villagers on.

### Goals and the daily routine

- Each villager has an ordered goal list. Each tick the scheduler picks the highest priority goal that can start;
  work always beats leisure. Goals have day and night flags, cooldowns and throttles; idle back-off goes 1, 2, 4 up to
  20; watchdogs end a goal with no progress.
- Priorities worth reusing: idle 0, socialise 5, chat 10, paths 40 to 50, rest at night 50 + sleep debt / 30, gather
  125 to 500, build 1500, fetch a tool 1600, light the hearth 2000, fight 5000 to 9999.
- Sleep: night only, in a bed claimed in the villager's own building, with fallbacks so a missing bed never blocks
  anything. A resident lights the hearth in the morning.
- Adults don't get hungry in Millénaire; food is a household matter (children's growth). Villheim goes further at
  Tyler's request: villagers eat real food and heal by its numbers.

### Gathering and storage

- Gathering happens in purpose-made plots (groves, quarry points, fields), never on wild trees. Stock limits stop
  work when the chest is full; a carry penalty sends a gatherer home before overloading; ground items within 20
  blocks are picked up first.
- The town hall chest is the village bank. A villager without the tool he needs fetches one from the chest first.

### Defence

- Raids are village against village. Defenders (`helpInAttacks`) go to the defence point and the rest hide at the
  shelter point, both at priority 9999. Nobody flees. Villheim: protectors arm and fight, carers keep away from the
  enemy while a protector is there.

### Dialogue

- Two plain text formats. Sentences: `role.goalKey=text`, falling back from role to gender to a generic line, said
  when a player is close, with a cooldown. Chats: blocks of lines between two villagers with a key, weight and
  conditions (weather, which buildings exist, which villager types live there, who speaks).
- Villheim: `Dialogue` topics with conditions on the moment. A data file of lines is a later step.

### Next ideas from Millénaire for Villheim

- Weighted growth with tiers and one pending project instead of the fixed plan in `Culture`.
- Building levels: upgrade a building (extra room, better furniture) as a new step list over the old one.
- Reachability and the cliff rule in placement.
- A* paths that join into a tree toward the hearth.
- A morning resident who lights and tends the hearth; a resting place under a roof for villagers with no bed.
- A data file of dialogue lines and two-villager chats.

## Roads, placement and facing (study 2026-11-06)

A second pass over the decompiled 9.0.3 code, on village layout only. Ideas and numbers only. Two corrections to the
notes above: in 9.0.3 path cells do not block placement, and Villheim already routes paths with A* (`PathPlanner`).

### Where a building goes

`VillageGrowthManager.placeNewBuildingForConstruction` runs each time a new building is launched:

1. `VillageTerrainMap.compute` scans a square of 2 x radius + 1 around the centre. Per column it keeps ground height,
   water, danger, forbidden blocks and headroom. A cell is buildable when its ground is within 10 blocks of the
   centre's height.
2. `markExistingBuildingsOccupied` marks the core footprint of every building as occupied, plus the reserved site of
   the pending project. Paths are never marked.
3. `TerrainReachability.compute` flood-fills walkable cells from the town hall (steps of one block, two blocks of
   headroom, no water).
4. `PlacementConstraints.resolve` turns the plan's `min_distance` and `max_distance` (shares of the radius, default 0
   and 1) into blocks, at least 5. The default radius is 90 and it never changes.
5. `BuildingLocationFinder.findLocation` walks square rings from the min to the max distance, each ring as four sides
   from a random first side. `tryPosition` takes the first spot that passes: `far_from`/`close_to` tag rules;
   `testFootprint` (footprint plus clear margin, 5 blocks a side by default, may not touch an occupied cell; up to 10
   bad cells, 5% above 200 cells, 10% above 2000); at least 70% of the core reachable from the town hall; and
   `findNeighbourCliff` (no occupied cell within 8 blocks whose height differs by more than gap + 3).

The new building's margin may not touch another core, so buildings stand at least 5 blocks apart. The paths run in
that gap. Profession sites sit further out only through their bands: Norman farm 0.5 and up, quarry 0.6 and up,
watchtower 0.5 and up, presbytery at most 0.8. Everything else uses 0 to 1 and lands close in, because the scan goes
from the inside out. Wells and fountains carry the `pathnode` tag.

### Facing

`directionToVillageCenter` compares |dx| and |dz| from the candidate's rough centre to the village centre and picks
the larger axis. Each plan variant declares `building_orientation` (0 to 3), the side its front is on. The rotation
is (target - building_orientation) mod 4, so the front, with the door and the `pathStartPos` marker, faces the centre
in one of four grid directions. A plan or slot can set `fixed_orientation` instead (the abbey). An upgrade keeps the
origin and rotation, and every level of a plan has the same footprint.

### How roads are routed and built

`VillagePathManager.recalculatePaths` plans the whole network again. It runs at founding, when a building finishes
level 0, when a level has `rebuild_path` or a new `path_level` (`BuildGoal`), and at night when `verifyInvariantAll`
finds a building that is not connected (back-off 1, 2, 4 up to 64 nights, then every 64th).

1. Anchors: each finished building's `pathStartPos` marker, else its selling or sleeping position, else the edge cell
   nearest the town hall. The town hall's own anchor is the root.
2. `PathRouter.computeRoutes` gives each building one parent. It starts with the town hall. A `pathnode` wins when it
   is 1.3 times closer. If the target is still over 20 blocks away, the nearest building that is itself closer to the
   town hall and 1.5 times closer than the target becomes the parent. The previous parent is kept while it is no more
   than 1.3 times further, so roads don't move between recalcs. This parent rule is what makes roads branch outward.
3. `propagateTierUplift`: a route's level is the highest `path_level` of anything downstream. Levels pick the
   culture's materials (Norman: dirt, gravel, slabs). Building levels raise `path_level` from 0 to 2, so the trunks
   near the centre are paved first as the village grows.
4. `computeLateralRoutes`: two buildings within 35 blocks whose way through the tree is over 2.5 times the straight
   line get a side link, at most one per building, level 0, width 1.
5. Routes are sorted by level, then longest first. `PathGridAStar.search` traces each: four directions, cost
   1 + 2.0 x dh², turn 0.3, max step 3, 5000 nodes; cells on a path from this or the last recalc cost half. On failure
   it retries with slope weight 0.5 and step 6, then with a looser walkability test.
6. `PathBlockPlacer.buildPath` widens the trace to `path_width` (default 2). It skips cells inside other buildings,
   unless the path crosses one end to end, and cells of `nopaths` buildings (fields).

At founding all paths are placed at once. Later, one route is traced per tick, villagers lay one block per action
(`BuildPathGoal`), and `ClearOldPathGoal` removes blocks that left the network. A new building may land on an old
path; the next recalc goes around it.

### Proposal for Villheim

Gaps today: `PlotFinder.ClearOfPaths` keeps clear of the old L-shaped route (`PathBuilder.DistanceToPath`) and
`TryFind` refuses spots near laid paths, which pushes buildings away from roads. `PathPlanner.Plan` aims at the hearth
and only joins cells already painted, so two paths queued together never share a road. Every design is assumed to
have its front on +Z.

1. **Real fronts.** At design load, find the door pieces, record which side of the footprint they are on as a yaw
   offset on the design, and add it in `PlotFinder.FaceHearth`. `PathPlanner` starts the route at that door. Designs
   with no door keep +Z.
2. **Parent rule in `PathPlanner.Plan`.** Pick the target as `PathRouter` does: the hearth; a well or other path node
   when 1.3 times closer; if still over 20 m, the door of the nearest finished plot that is closer to the hearth and
   1.5 times closer than the target. The search still stops at any network cell. Store the parent on the `Plot` so
   later plans keep it.
3. **Queued routes count as network.** Add the cells of routes in `PathLaying`'s queue to the set used for the half
   cost and the stop test, so routes queued together merge.
4. **Buildings line roads.** In `PlotFinder.TryFind`, keep refusing spots whose footprint covers a network or queued
   cell, drop `ClearOfPaths`, and collect the first 6 good spots for every role. Score each as distance from the
   hearth + 2 x |door-to-network distance - 4 m|. New doors end up about 4 m off a road, with a short spur.
5. **Face the road when it is closer.** For each good spot try the four grid turns. Keep the turn that faces the
   hearth unless another turn puts the door at least 3 m closer to the network.
6. **Professions further out.** Keep the bands and set farms to 0.5 to 1 and quarry or mine workshops to 0.6 to 1, as
   Millénaire does. The parent rule hangs them off the nearest building on the way in, so each gets its own spur back
   to a trunk.
7. **Trunks.** Count how many plots route through each network cell. Paint cells used by 3 or more again at 2 m
   (`PathBuilder.PaintAt` with a larger radius). This stands in for path levels.
8. **Repair and upgrades.** After an upgrade, plan the plot's route again from its new door. Once a day
   (`VillageBrain`), check that each plot's door reaches the hearth over network cells and queue a route for any that
   doesn't.
9. **Spacing.** Raise `PlotFinder.Gap` from 2 m to 4 m so a path fits between neighbours, like Millénaire's 5-block
   margin.
