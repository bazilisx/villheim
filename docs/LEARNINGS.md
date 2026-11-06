# What I learned from Millénaire, VikingColonies and Innangard

I read through the source of two village mods to see how they solve the same problems Villheim has. VikingColonies
(by DaAlmyte) publishes its source. Innangard (by Yololo) ships as a compiled plugin, so I read a decompiled copy.
Villheim takes ideas from both and keeps its own code. Nothing here is copied, and Villheim does not depend on
either mod.

These are the ideas I'm taking, in my own words, and what each one means for Villheim.

## Walking

**Both mods use the game's own pathfinding for walking.** Settlers call `BaseAI.MoveTo` and let the navmesh handle
the route. They add their own logic on top for the cases where the navmesh gives up.

**A goal only counts as new when it moves.** VikingColonies keeps a settler's current goal and only treats a new one
as different when it is more than a metre away. That stops a settler from re-planning every frame because the target
point wobbled a few centimetres. Innangard does the same thing when it approaches an object: it works out the spot
to walk to once per target and only redoes it if the target itself moves.

**Arriving uses two distances.** A settler arrives at the stop distance and only counts as "not there" again once it
is half a metre past that. Without the gap, a settler standing right at the edge flips between walking and stopping
every frame. That is the twitching we saw.

**Stuck settlers try to get loose before giving up.** VikingColonies watches whether a settler has moved half a
metre. After 3 seconds without moving he jumps and throws away his path. After 5 seconds he steps sideways for half
a second, checking first that the step doesn't go off a ledge or into water. He tries this twice before giving up on
the target.

**Decisions happen on a slower clock than movement.** Innangard only lets a settler change his mind every 0.3
seconds and turns him at a fixed rate. Walking still updates every frame. Scanning the world for a new target every
frame makes settlers jittery and costs a lot.

## Chopping and mining

**Stand next to the thing, then hit it.** Both mods work out a spot to stand first:

- A standing tree: a spot on the trunk's edge plus a short step back. The side matters, because a tree falls away
  from the axe. VikingColonies picks the side so the trunk falls clear of buildings.
- A log on the ground: beside the log at the point closest to the settler, on the uphill side so it doesn't roll
  onto him.
- A stump or rock: the near side.

The settler walks to that spot, stops, faces the target, and swings. If he can't reach the spot after a while, the
target is set aside for a few minutes and he picks something else.

**Set-asides expire.** Unreachable trees, rocks and drops go on a list with a time limit. Innangard makes the time
longer for targets that keep failing.

## Building

**Builders stand outside the building.** VikingColonies works out the building's outline and puts a ring of standing
spots a metre outside it, about a metre and a half apart. The builder walks to the ring spot closest to the next
piece.

**Lowest pieces first, nearby pieces first.** Innangard builds the lowest piece that has support, and among pieces at
the same height it prefers ones the builder can already reach from where he is standing. That keeps him from running
back and forth across the site.

**Each piece takes a few swings.** Innangard gives each piece a few seconds of hammering before it appears, sped up
by skill. That reads much better than a piece popping in on every swing.

**Nothing goes where someone is standing.** Both mods check whether a player or settler stands where a piece will go
before placing it.

## Roads and paths

**Roads come from a grid search.** Innangard lays a grid over the area between two places, gives each cell a cost
(steeper ground and swamp cost more, water and mountains are off limits, existing road is cheap), and runs A* over
it. Then it simplifies the result into a few straight runs. Because existing road is cheap, new roads join old ones
and the network grows into something that looks planned.

For Villheim this replaces the L-shaped paths. A new building's path searches toward the hearth over a small grid,
avoids other buildings' footprints, prefers ground that already has a path, and joins the network wherever that is
cheapest.

## Newcomers and housing

**People arrive for free beds.** VikingColonies checks once a day, in daylight. If there are free beds and food in
the town hall chest, newcomers walk in from the edge of the colony. Villheim will count the real beds in its buildings,
only let people arrive by day, and have them walk in from the village edge.

## Free time

**Settlers have an evening.** VikingColonies settlers sit on benches, sit by the fire, stroll, and chat with each
other, choosing something new every 30 to 90 seconds. Villheim already sends villagers to the hearth at night. Sitting
on the village's own benches and by its fires is a later step.

## Second, closer read of VikingColonies (1.6.0)

A section-by-section read of the movement, jobs, free time and building code, after Villheim villagers still
wandered, stuttered and swung at trees from far away. Notes in my own words; nothing copied.

**Their villager never runs the monster brain.** The AI class sits on the game's base AI, which issues no movement of
its own. Ours sat on the monster AI, whose idle wandering ran whenever our code let go for a moment. Villheim now
keeps control every tick outside a fight and hands over only when an enemy is sensed (checked twice a second).

**The body is the player's.** Speeds, turn rates and acceleration come from the player prefab, so the jog animation
matches the real speed. They always jog on errands and only sprint when fleeing. Turning while walking
(`m_moveMinAngle` 90 with smooth movement) avoids stopping at every path corner.

**Walking rules.** Stop distance at least 0.8 m, stay arrived until 0.5 m past it, a path that ends early only counts
within 2 m, a fresh path only after a hop, sidestep or door. Nothing counts as stuck within 3 m of the goal.
Villagers and players pass through each other (collision pairs ignored, set again every couple of seconds, because
Unity forgets them). Animation-driven movement is dropped for villagers outside a real attack, so gestures and work
swings never slide them.

**Doors.** Used when the path dead-ends or a closed door is right ahead. Stand about a metre out, face the door, use
it, step straight through to 1.5 m beyond without a path (the navmesh still sees a wall for a while), close it 2 m
later once the doorway is clear.

**Reach is a hard gate on every swing, against the real surface.** Their workers measure to the actual shape (a ray
for a tree trunk's radius, a line with a radius for a log, a small box per rock section) and only swing within the
tool's range. Unity's closest point does not work on concave mesh colliders, and a big rock's bounding box can sit
metres from its face, which is how our villagers chopped from 15 m. Villheim now casts a ray at the collider itself.
They also face the target before swinging, land the blow partway through the animation, use the tool's real tier,
and pass the struck collider so big rocks take the hit.

**Jobs decide from facts on a slow clock.** Each tick a job picks one action from a fixed priority list and logs a
line when the action changes, which makes "does nothing" easy to explain. Villheim logs why a villager has no work
and shows it in the hover text.

**Free time is asked for, not left running.** Whatever wants a pose (sitting, dancing) asks every tick; when nothing
asks, the villager stands up. Activities are picked by weight from what is at hand every 30 to 90 seconds: seats,
fires, chats (pairs meet 1.6 m apart and take turns), strolls. The evening is a ring around the main fire where
every other one sits and the rest toast and laugh. Held poses are animator bools (`emote_sit`, `emote_dance`,
`emote_rest`, `emote_kneel`), gestures are triggers (`emote_wave`, `emote_cheer` and so on), and `emote_stop` ends a
held one.

**Mood does not drive their idle behaviour.** Their mood (0 to 100 from home, food, comfort, deaths and so on) sets
work speed and arrivals. Villheim uses its own village mood to weight free-time choices and gestures instead.

**Building.** Lowest supported piece first, restarting the search after every placement; a support check before
placing; the builder always outside the outline with a hard distance limit; never placing a piece where someone
stands; doorways kept clear.

## Plan

First round (this round):

1. A shared walker for villagers: steady goals, two-distance arrival, jump and sidestep when stuck.
2. Stand spots for trees, logs and rocks, worked out once per target. Trees are felled away from the village.
3. Builders stand on a ring outside the building and hammer each piece for a couple of seconds.
4. Grid-searched paths that join the existing network.
5. Newcomers need a free bed, come by day, and walk in from the edge.

Later:

- Free time at benches and fires in the evening.
- Builders carrying materials from a village chest.
- Ghost previews of the next building.
- Roads between villages.

## Millénaire 9.0.3 (study of 2026-11-06)

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

## Other mods and licences (research of 2026-11-06)

- Code that may be copied: PlanBuild (WTFPL; its `.blueprint` format is what `Designs/Blueprints.cs` reads),
  Hirdmandr (WTFPL), VikingSettlements (MIT, keep the notice), Valheim.SpawnThat (Unlicense). Under the independence
  rule only PlanBuild's format logic is used; the others are ideas only.
- Ideas only (GPL, AGPL or no licence): MineColonies (builder requests, building levels 1 to 5), MCA Reborn (dialogue
  as questions and answers with constraints and a fatigue on repeats), Millénaire, Wyrdrasil, BlueprintCruncher.
- VikingSettlements: a supply chest feeding a construction site, NPC state in the ZDO, hunger stopping work, morale
  scaling output, raids through the game's RandEventSystem.
- Hirdmandr: jobs tied to worksite chests near related pieces, a thought and mood system that changes work speed.
- No openly licensed library of Meadows or Black Forest blueprints was found. Nexus and Thunderstore pages can't be
  read from the cloud container.

## Licences and sources checked on 2026-11-06 (second research pass)

- More World Locations: GitHub `jneb802/MoreWorldLocations_All`, All Rights Reserved; builders credited per location.
  Villheim only copies its locations at runtime from an install, never bundles them.
- OverDrive BiomeBlueprints (Thunderstore, author lg_9d): 353 PlanBuild blueprints, no licence file; the author's own
  78 generated designs (hut, cottage, house, longhouse, manor, great hall, villa, stilt and stone sets per biome) and
  275 community builds shipped with their builders' consent to that pack only. Read from an install, never copied.
- RoleplayNPCs (MIT, DLL and design docs only): dialogue pools by trait, bond and mood, least-used-first picks,
  approach timeouts, greetings after an absence, gossip with a ten minute suppression.
- MineColonies (GPL, ideas only): happiness with lasting modifiers (housing, food, safety, idle days) that decay
  nightly; citizens bring requests to the player; raids at nightfall with a warning; colonists run home in a raid.
- Valheim pieces for a Meadows village: `stake_wall` (wood), `wood_fence`, `wood_gate`, `wood_door`, `bed`,
  `piece_chest_wood`, `piece_workbench`, `piece_cookingstation`, `fire_pit`, `piece_groundtorch_wood`. Sharpened
  stakes need core wood; the stone hearth needs a stonecutter; tables, benches and chairs need fine wood.
- Nexus pages answer 403 from the cloud container even with the hosts allowed.

## Millénaire roads, placement and facing (study 2026-11-06)

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
