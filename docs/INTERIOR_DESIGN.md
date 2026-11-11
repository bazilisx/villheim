# Interior design

How the blueprint lab furnishes rooms, and what it learned from other builders to do it. Code:
`tools/blueprint-lab/lib/decorate.js` (the decorator and its checks), `lab/learn_interior.py` (the learner),
`lab/interior_lite.js` (the part the decorator carries), `lab/check_interiors.js` (checks over a sample).
Data: `data/interior.json` (everything learned) and `data/interior-lite.json` (what the decorator reads).

Written 2026-11-08 after Tyler's notes T-05, T-06 and T-10: beds through each other, woodpiles indoors, item stands
over windows, wall pieces off the middle of the wall, floor torches sunk and inside beds, the same furniture in every
house, a table next to the door.

## Where the rules come from

- Corpus: the valheimians downloads (`vh/` in the corpus folder, with `vh/index-all.json` for downloads, votes and
  views) and every design Tyler marked Yes in the review.
- Popularity of a valheimians build: 0.5 x downloads + 0.3 x votes + 0.2 x downloads per view, each as a percentile
  among the 1,386 builds that have numbers. The top half was read, in every category (houses, taverns, smithies,
  castles, interior builds and the rest).
- 1,207 candidate files. A build counts when it has an interior: furniture standing on a floor inside a room with walls
  round most of it and a roof or floor over most of it. 497 builds qualified (372 valheimians, 125 Tyler Yes) with 2,686
  rooms.
- Rooms are found per floor height: floor cells on a half-meter grid, cut by walls and doors, kept when 60 % of their
  edge is wall and 70 % is covered. Each room gets a kind from what is in it: sleeping, home (beds and a fire or
  table), hall (fire or throne), tavern (8 seats or 3 tables), kitchen, smithy, workshop, storage, living, other.

## What builders do

Distances are from the piece's pivot. "p10" is the tenth percentile: nine builds in ten keep at least that much.

| Rule | Measured |
|---|---|
| A clear way in | Free depth inside a door, p10: hall 4.0 m, kitchen 3.5, living 3.0, tavern 2.6, sleeping 2.4, smithy 2.2, home 1.6 |
| Tables away from doors | Table to door p10 2.7 m; bed 3.7 m; long bench 2.9 m; workbench 2.7 m; forge 3.0 m |
| Beds | Head (local -z) to a wall, pivot 1.75 m from it; side by side 1.25 m apart (tight) to 2.25 m; a chest at the foot, 1.75 m out, same facing; rugs beside a dragon bed 2 m out |
| Tables and seats | Benches 1.0 m either side of a table's middle line, facing it; chairs 1.25 to 1.5 m round a round table; tables in a row 2.5 m apart end to end |
| Fire | Cooking station and cauldron sit on the fire pit, 0.25 m above it; rugs 2.5 m out; seats (sitting logs) 2 m and more out |
| Stations | Workbench back to the wall (rel 0, pivot 0.7 m out); chopping block 2 m to one side; forge with anvil 1.5 m to one side, cooler and bellows 1.25 m to the other |
| Storage | Half of all wooden chests stand against a wall, and 58 % of those in a corner, facing the room; barrels in rows 0.75 m apart |
| Wall pieces | Item stand 2.4 m up (p25 1.7), 0.24 m off the wall line; sign 2.2 m; wall torch 2.3 m and turned 270 from the wall's normal; banner hangs from 0.33 m under the ceiling; hanging brazier 1.6 m under the ceiling |
| Floor torches | The pivot is 0.75 m above the floor (the torch stands on its foot below the pivot); nearest furniture p10 1.4 m; in corners 42 % |
| Rugs | Under 22 % of tables, 18 % of beds, 38 % of round tables |
| How full | Furniture per 10 m2 (p25, p50, p75): home 1.5, 2.3, 3.1; sleeping 1.1, 1.9, 3.3; hall 0.9, 1.8, 3.3; tavern 1.3, 2.2, 3.4; smithy 1.3, 2.3, 4.2; storage 4.0, 7.6, 10.0 |
| Floors | Furniture stands 0.1 m above a wooden floor's pivot, 0.5 m above a stone floor 2x2 or a black marble floor, 0.25 m above grausten |

Builders hang item stands over openings 13 % of the time and center them on a wall 23 % of the time (they often hang
rows). The decorator follows Tyler instead: never over a window or door, centered on the wall face.

## Piece sizes measured

From ray distances to walls and spacing between two of the same piece. These are in `decorate.js` (F table).

| Piece | Width x depth (m) | Note |
|---|---|---|
| bed | 1.2 x 2.8 | pivot in the middle, head at local -z |
| piece_bed02 (dragon bed) | 2.0 x 3.3 | |
| piece_chest_wood | 1.3 x 0.75 | |
| piece_chest_barrel | 0.7 x 0.7 | |
| piece_table | 2.0 x 0.9 | top 0.75 m up |
| piece_table_round | 1.7 across | |
| piece_table_oak | 4.2 x 1.6 | |
| piece_bench01 | 2.0 x 0.7 | faces local +z |
| piece_logbench01 | 1.4 x 0.6 | faces local -z |
| hearth | 3.2 x 2.0 | |
| fermenter | 1.4 x 1.4 | |
| ArmorStand | 0.9 x 0.6 | |

## Biome of each piece

Since 2026-11-10 (D-065, Tyler: decor freely across any biome) this biome is flavor only: every piece goes in every
biome, and pieces two biomes or more ahead of the village weigh less (`decorate.js` `flavorD`).
`decorate.js` gives each piece the first biome whose village can make it. Where the recipe was not certain, the
game's own notes in `design-list.csv` set an upper bound: a design at a stage with no note for a material cannot hold a
piece that needs it. Examples: banners 01, 02, 03 by the Black Forest; hanging brazier, reinforced chest, iron torch,
raven throne, armor stand by the Swamp; wolf rug and red jute carpet by the Mountain; lox rug, straw rug, black metal
chest by the Plains; hare rug and Dvergr lanterns in the Mistlands. Meadows villages get wooden beds, wooden chests,
tables, stools, benches, deer rugs, wooden floor torches, item stands, workbench and chopping block, cooking station.

## How the decorator works

1. Read each floor from the pieces: free floor cells, rooms, wall faces (runs of collinear wall pieces, each quarter
   meter marked wall, window, door or open), doors, stairs and ladders, the ceiling over each cell. Floor edges with no
   wall become edges things may stand against (open sheds, tents). Nothing here assumes a height or a wall thickness.
2. Keep clear: a box in front of every door (the learned depth for the room kind, at most 3 m and 40 % of the room),
   the stairs and ladders with 0.8 m round them, the work place in front of each station, a ring round the fire, the
   chimney's footprint and the boxes the generator marks to keep clear. Nothing but rugs ever goes in a door's box.
3. Fire first in homes, halls and taverns (under the smoke hole), then beds in homes (a house always has one: if no
   bed fits head to a wall, one goes side on or free-standing, and a house with no bed after all its floors gets one on
   the largest floor), then paths from each door to the fire, the stairs and the other doors, through the middle of the
   room. Nothing but rugs goes on a path.
4. Furnish by the room's role, in clusters: beds with a chest at the foot and a rug beside; a table with its seats and a
   rug under it; the fire with its cooking station or cauldron and seats facing it; chests in a row with a sign over the
   middle; stations with their extensions beside them; the throne at the far end with a rug and a torch either side;
   the altar at the far wall with benches in two rows and an aisle.
5. Wall pieces go in the middle of a wall face, or the middle of the plain stretch between openings, 0.35 m clear of any
   door or window; torches in pairs either side of a face's middle.
6. Woodpiles, stone and coal heaps go outside, against a back or side wall, 3 m from doors, never in an enclosed space.
7. Every floor is furnished: upper floors of homes sleep, inns get guest rooms, workshops and storehouses store, guard
   towers get a bed, chest, armor stand and lights per story and a chest, bench and torch on a roofed lookout.
8. Fill (d2 and d3): once the needs are met, the room is topped up toward the corpus rate for its kind (d2 the median,
   d3 the 75th percentile, times Tyler's floorplan factor) with the extras builders add: item stands in a row on one
   wall, shelves of horizontal item stands, barrels and Dvergr crates in a corner, a round table with two chairs, rugs,
   armor stands, banners in a pair, carvings, things on tables (horizontal stands, candles, coin stacks), tools on the
   work wall, a cartography table. The choice is seeded and weighted per room; each extra repeats at most once or twice,
   rugs stay at one per 15 m2, and the fill stops when half the floor is taken. The same rules hold: no clipping, wall
   pieces in the middle of a wall, never over a window or door, paths and door boxes clear.

Each building gets one kit (bed, chest, table, seats, rug, lights, banner, carving), drawn by seed from every piece of
each kind and weighted by how often each shows in that kind of room and by flavor (above); since 2026-11-10 each room
draws its own rug, seats, table, lights, banner and carving again (`decorate.js` `varyKit`: the building's choice the
likeliest, what the house already shows less likely), and the kinds hold more pieces (rugs of moose, seal, bear and
bog witch deer, Dvergr tables and stools, black marble and blackwood benches, banners 06 to 11, the blue torch). Cultures lean: Saami and steppe homes have no
tables; Middle Eastern and steppe sit on benches and lay more rugs; castle and Byzantine buildings hang more banners.

## Checks

`audit()` in `decorate.js`, run by `node lab/check_interiors.js [lib dir] [out.json] [seeds]` over every type in six
biomes at s1d1, s2d2 and s3d3. 702 designs (3 seeds), counts of designs with the problem:

| Check | Before | After |
|---|---|---|
| Furniture through furniture | 466 | 0 |
| Something in a doorway | 34 | 0 |
| Wall piece over a window or door | 48 | 0 |
| Floating (no floor, table or fire under it) | 243 | 2 |
| On a stair or ladder or its foot | 128 | 0 |
| Floor torch sunk into the floor | 321 | 0 |
| Woodpile indoors | 56 | 0 |
| Floor of 8 m2 or more with fewer than two pieces (d2, d3) | 131 | 0 |
| Piece from a later biome | 81 | 0 |

The two left floating are props the generator puts in a farm field. `lib/checks.js` still fails `support` in Mistlands
designs: the black marble floor is 1 m thick with its pivot in the middle (in the corpus the commonest wall bottom over
one is 0.5 m above its pivot, 370 cases), but `pieces.js` gives it 0.25 m, so furniture on its real top reads as
floating. Furniture per design:
d1 2.7, d2 12.7, d3 21.5 (was 3.0, 9.6, 18.4). Two seeds of the same request share 54 % of their furniture list (was 85 %).

2026-11-09, with room templates and the new extras, on main of that day: every count the same as main or lower (main
had a blocked door in 2 designs and things floating in 3; here 0 and 1). The one left floating is a dish whose table
the generator took out after the furnishing (longhouse, Black Forest, s2, seed 175; the step that removes it is not
traced yet). Furniture per design
d1 2.8, d2 17.1, d3 30.2.
Two seeds of the same request share 48 % of their furniture list. Placing now also keeps furniture out of the door
box on both sides of every door, as the audit measures it.

## How full rooms are

Pieces per 10 m2 (rugs not counted), median over the sample, before and after the fill, against the corpus.

| Room | d2 before | d2 now | d3 before | d3 now | Corpus p25 / p50 / p75 |
|---|---|---|---|---|---|
| home | 1.47 | 2.32 | 2.04 | 3.08 | 1.48 / 2.27 / 3.08 |
| sleeping | 1.95 | 1.90 | 1.51 | 2.82 | 1.09 / 1.85 / 3.27 |
| hall | 1.06 | 1.75 | 1.95 | 3.00 | 0.86 / 1.76 / 3.33 |
| tavern | 1.59 | 2.28 | 1.79 | 3.45 | 1.31 / 2.22 / 3.43 |
| smithy | 1.96 | 2.29 | 2.25 | 2.50 | 1.33 / 2.34 / 4.15 |
| workshop | 1.33 | 2.11 | 1.56 | 2.47 | 1.13 / 2.16 / 5.71 |
| temple | 1.68 | 1.81 | 1.82 | 2.00 | 0.86 / 1.76 / 3.33 (halls) |
| guest room | 0.73 | 1.40 | 0.76 | 1.53 | 1.09 / 1.85 / 3.27 (sleeping) |
| storage | 2.92 | 3.16 | 1.69 | 2.46 | 4.0 / 7.6 / 10.0 (small store rooms) |

d1 stays at the needs (bed, chest, fire, a station). `node lab/interior_density.js [seeds]` makes this table.

## Room templates (D-058)

Tyler, T-403: interiors looked repetitive and not laid out the way a person would. A room template is the whole
furniture arrangement of one real room in a well-liked build, which the decorator fits to its own rooms.

- Miner: `lab/mine_room_templates.js` reads every room of the builds in `chosen.csv` with the decorator's own reader
  and writes `data/room-templates.json`. Each template is in the frame of the room's main way in (u across, v into
  the room): each piece is tied to a wall (against the left wall, 1 m off the far wall), to the middle, to a share of
  the room, or to the piece it belongs with (seats round a table, a pot on the fire, a chest at the foot of a bed).
- Rooms are kept when clean: doors clear, every piece on the floor, a sensible number of pieces for the size, vanilla
  pieces only (pieces the decorator does not know stand in as the nearest vanilla piece of the same use; statues,
  trophies, portals and piles are left out). Near copies are dropped, and at most four rooms of one kind per build.
- 2026-11-09 the miner was loosened where the reader was at fault: an open way in (an arch, a doorway with no door)
  slides along its stretch to the clear place nearest its middle; seats round a fire or a table, torches and pieces
  square to their own wall in a round room are never askew; one or two clipping pieces drop out instead of the whole
  room; scaled roofs count as ceiling. A room whose walls stand at an odd angle to the rest of its build (a wing
  turned 30 degrees) is skipped, since its anchors would be wrong; walls at 45 degrees (eight-sided rooms) are fine.
  464 templates (was 213): storage 113, sleeping 100, smithy 48, home 42, workshop 31, hall 30, living 27,
  tavern 10, kitchen 9, temple 2, other 52. Of 2,810 furnished rooms the rest were skipped: too few pieces 644, no
  way in 486 (mostly nooks under 15 m2 open on one side), open to the sky 381, askew 156, too sparse 154, thin 92,
  door blocked 77, turned walls 32, and smaller counts.
- IDs (RT-0001) stay with their room from one run to the next (a key of the source build and the room's place), so
  scores in the sheet keep their room. Main's reader changes of 2026-11-09 (stairs, walls on their pivot) move 85 of
  them, 10 in the first batch; the template file was kept from before those changes until batch 1 is scored.
- Decorator: a room picks a template of its kind (homes may take a sleeping or living room, halls a tavern), near its
  size and shape, turned and mirrored so its door is on the room's door wall. The fit score adds log(weight) from
  Tyler's scores and a seeded draw, so close fits are a weighted lottery. Pieces against a wall stay against that
  wall, pieces a set gap off a wall keep the gap, centered pieces stay centered. Each piece becomes the nearest piece
  of the same use that the biome and culture can make (the kit's choice first). The usual tests decide each piece;
  one that fails moves a little or is left out. A template that loses too much is undone and the next one is tried;
  a room no template fits is furnished by the rules above. Template rooms are then topped up toward the corpus rate.
- Use in the check sample (`lab/interior_density.js` requests, 2 seeds): homes 22 of 39 rooms from a template, halls
  30 of 36, taverns 22 of 36, workshops 40 of 72, storage 17 of 51, smithies 13 of 36, sleeping rooms 4 of 21; 80
  different templates. Temples and guard towers have no template yet.

### The touches people add

Extras the fill draws from (`EXTRAS` in `decorate.js`), with Tyler's notes from the Floorplans tab applied:

- A bench across the foot of a bed where no chest stands; a bench against a wall 2 to 3 m from the door.
- A reading corner: a chair in a corner turned to the room, a light beside it, a rug in front.
- Storage along one wall with a sign over the middle; item stands in rows; banners in pairs (as before).
- A rug under a table or before a fire that has none.
- A floor torch at the wall nearest the darkest part of the room, when that is more than 3.5 m from every light.
- A ring of seats on every side of the fire, in halls of 60 m2 and more only. Tyler, FP-002 and FP-010: no bench
  beside the fire in homes and taverns.
- Tyler, FP-003: a table and a bed keep a meter apart; benches sit 1 m from the table's middle line (learned 1.0 m).
- Tyler's density marks (FP-001 to FP-012) through `lab/floorplan_feedback.js`: halls 0.89, taverns and kitchens
  1.12 times the corpus rate.

## Scoring rooms

The **Rooms** tab of the review sheet holds rooms from community builds to score. Each row is one template's source
room, as built.

- Columns: the ID, the plan from above (way in at the bottom, 1 m grid, furniture at true size and colored by use;
  pieces the template leaves out are dashed; letters on the walls are wall pieces), the source build with its maker
  and its picture on valheimians, the kind, size, pieces, popularity, the batch, and the current guess.
- Tyler's columns: **Score 1 to 5** (1 poor, 3 fine, 5 copy it), **Tags** (pick one or type several with commas:
  natural flow, cozy, cluttered, sparse, odd placement, good lighting, good storage, good seating, bed nook, copy
  this), **Notes**. A blank score is fine; tags and notes count on their own.
- Batch 1 is 68 rooms over every kind and size, best-liked builds first, about 20 minutes. The pictures are
  `docs/rooms/RT-0001.png`, made by `lab/render_rooms.js` with the renderer's true-size top-down plan (`RENDER=lab`,
  cut at 1.8 m, 50 px to the meter) and labels laid over (they show once the branch is on main). Without
  `RENDER=lab` the script draws a flat plan of its own.
- `vh floorplan template RT-0014 [biome]` lays one template out in the game as it is, nothing added (biome default
  dn, where every piece can be made), to walk through.

After scoring: download the tab (File, Download, CSV) and run `node lab/room_feedback.js rooms.csv`, or a session
reads the tab with the Sheets tools and writes the same CSV. It writes `data/room-scores.json`:

- Weights: a score of 1 or 2 drops the template, 3 keeps it (1), 4 weights it up (1.5), 5 more (2); "copy this" adds
  a quarter.
- A model for the rooms not scored: a ridge regression on room features (pieces per 10 m2, clear depth inside the way
  in, share of pieces against a wall, groups of furniture and their size, mirror symmetry, lights per 10 m2 and the
  mean distance to the nearest light, rugs and rugs under tables, the width of the clear way from the door to the
  middle, free floor, kinds of piece, wall pieces per meter of wall). Its guess sets the weight of every room not
  scored, never below 0.15, so the model alone never drops a room. With 40 bootstrap refits it says how sure it is.
- The next batch: the unscored rooms the model is least sure of, spread over the kinds (40 by default). Add them to
  the tab with `node lab/render_rooms.js` (pictures) and `node lab/rooms_sheet.js` (rows).
- A summary of what rooms scored 4 or 5 do against rooms scored 1 or 2, which goes in the next section.
- Then `node lib/build_engine.js` carries the weights into the game.

Until there are scores, every weight is a seed: 3, plus up to half a point for the source build's popularity, and a
few tenths for each clean-room check (a clear way in as deep as nine builders in ten leave for that kind of room, a
density in the middle half of the corpus, a clear way through at least 0.9 m wide, a light in the room).

## What high-scored rooms do

No scores yet. This section is filled from the summary `lab/room_feedback.js` prints once batch 1 is scored.

## Floorplans

`lib/floorplan.js` furnishes one room in a full temporary shell (floor, 3 m walls with a door and windows, a ceiling),
then keeps the floor, a low curb where the walls stand, a rail at the windows, the door, any ladder, full wall stubs only
behind wall pieces, and a post with a sign carrying the plan's ID. Shapes: rect, L, round (octagon), long (a hall with
two rows of posts). Rooms: home, sleeping, hall, tavern, kitchen, smithy, workshop, temple, storage.

- In the game: `vh floorplan <shape> <width>x<depth> <room> [biome] [culture] [d1|d2|d3] [seed] [ladder]` builds one
  plan in front of the player (IDs FP-101 on); `vh floorplan set [n]` lays out the first n of the 24 catalog plans in a
  grid of four to a row (IDs FP-001 to FP-024). Each plan's row goes to `BepInEx/config/Villheim/floorplans/floorplans.csv`.
- Placement: the first row starts 3 m in front of the player, each row centered on the player's line, plan 1 at the
  front left. Each plan takes its own box (its pieces plus 0.5 m) with 2 m to the next. The box is cleared, levelled
  at the average ground height under it and painted dirt before anything goes up, and the plan stands on that ground.
- Each plan's post has two signs back to back with its ID on the first line and room, shape and size on the second.
  The console lists every plan with its direction and distance from where you stood; `vh floorplan where` names the
  plan you stand in or the nearest one.
- Floorplan pieces carry `villheim_floorplan` and the plan ID (`villheim_floorplan_id`) in their ZDO and never wear
  or fall, since a floor with no walls has little holding it up. `vh gravity on` lets them fall. `vh tidy 70 yes`
  removes a set of 12 (24 plans need about 100 m).
- The review sheet's Floorplans tab holds the 24 catalog plans with the same IDs and columns for Tyler: Density (too
  sparse / right / too dense), Layout notes, Keep/Change. A single plan's row can be copied from the CSV into the tab.
- Feedback back into the rules: download the tab as CSV, then `node lab/floorplan_feedback.js floorplans.csv` and
  `node lab/interior_lite.js`. Density marks become a fill factor per room (too sparse 1.25, right 1, too dense 0.8,
  multiplied onto the last round, kept between 0.5 and 2) in `data/interior-tuning.json`, which the fill reads. Rows
  marked Change and every layout note are listed for the next round of rule changes; they are worked into
  `decorate.js` by hand and the same plan IDs are laid out again to compare.
- The node and game bundles give the same plan byte for byte, so the sheet's rows match what is built in the game.

## Creative sets (D-065, D-098)

Measured 2026-11-10: the 1,561 corpus builds use 220 decor prefabs in 12,762 placements, but the 459 mined assemblies
of the interior library held 109 of them. The miner grouped pieces by slot (any chest, any bench) and kept what
repeats, so the long tail of clever objects never became sets. Tyler asked for the objects builders make by clipping
or combining pieces for a purpose: furniture, decor, clutter, lived-in variance, wall, floor and window objects (D-098:
clip only where it is meant for something).

Sources this round. The full corpus was not reachable: it sits in Tyler's Downloads folder, which is not connected
to the session, and valheimians.com is blocked from the cloud. The sets were written from what the repo holds of the
corpus, and each set names it in its `basis` field:
- the decor table in `data/kitbash-interior.json` (for each of the 220 prefabs: builds, well-liked builds, how its
  pieces rest, on the floor, on another piece, on a table, against a wall, hung, and the median and 90th percentile
  clip and sink depths);
- the pairs in `data/interior.json` (what stands where next to what, in 2,686 rooms of 497 builds; a sign 0.25 m over
  a chest in 33 rooms, a flat stand on a chair seat in 28, the dragon carving 1 m over the wolf in 19);
- the 21 builds on Tyler's board (`PlanBuild/blueprints/villheim-board`), read by `lab/mine_creative.js`: 57
  combined objects in 17 builds, 44 distinct. Sets taken from them name the build in `src`.

`lab/mine_creative.js` is the miner for the next round, when the corpus can be read again. It keeps each piece's
own prefab and joins decor and small building pieces inside a room when their colliders touch or clip; a group counts
when something in it stands on another member, two members clip 3 cm or more, or a building piece carries or frames
the rest. Rugs join only rugs. Each object is put in its anchor's frame with its rests, clips and sink, matched across
builds by the same prefabs within 0.35 m, and keeps its source builds.

`lab/creative_sets.js` writes the sets in their anchor's frame and settles them the way the fitter places them (on
the floor, on what they rest on, hung pieces with their back on the wall's face), measures every clip with the game's
colliders (piece into piece, into the wall, into the anchor) and writes them into `data/kitbash-interior.json` as
assemblies `KC-001` on, with `creative: true`. 92 sets; the library now holds 193 distinct prefabs (was 109), 193 of
the 220 the corpus uses. Each set carries:
- `family` and `role`: furniture 21, decor 19, lived-in 18, wall 17, floor 7, clutter 5, window 5;
- `traits`: the household traits it suits, from 0 to 1 (tidy, messy, comfort, austere, wealth, modest, busy, and the
  hobbies crafts, collect, plants, games, maps, food), never a trade. `lib/persona.js` `kitWeight` weighs each from
  0.3 (the household has none of it) to 1.7 (all of it);
- `rooms` and `decor`: the decor stages it may go in. d1 only for beds and storage a room needs (a chest with its
  label, a wardrobe, the pelt on the bedfoot chest, a crate for a nightstand). A d3-only set is always marked for the
  third stage;
- `biome` (the hardest piece by `lib/pieces.js` needs, minor decor anywhere) and `from` (the earliest biome that makes
  its core pieces). A village below `from` never gets the set; in a village that makes the core but not every piece,
  the others are left out, so the last pass never swaps a barrel of a stack for a chest of another size;
- `foot` and `h`: footprint and height in metres, so a room's ceiling can be checked; `src` and `basis` for credit.

Each piece keeps its own prefab (`k` is the prefab), so the fitter places the source piece when the village is in
reach of it. Beams, half and quarter walls and ledges take the village's own wood (`k` is their slot), so a shelf
matches the house; posts keep their own prefab, since a village post may be a 4 m log.

The families, with examples:

| Family | Sets | What they are | Examples (source) |
|---|---|---|---|
| Storage | 12 | Chests and barrels on each other, labelled, crates askew, old barrels and jars | barrels two high (No. 549 house-ute-cozy-house); labelled chest, a sign over it (No. 647 workshop-round-workshop; sign over a chest in 33 rooms); strongbox under a chest; grausten chests stacked; wardrobe with clothes on a chair |
| Built | 10 | Furniture made of building pieces | chest between two posts with a pelt on it (No. 549); quarter wall plinth with a stand (No. 207 house-octagon-starter-base); beam shelves of jars and herbs; a half wall as a bench back; ledges of candles; an iron-bound rail on posts |
| Stations | 12 | Crafting stations and their upgrades as a household's hobby corner | spinning corner, a torch by the wheel (No. 647); gem cutter on a half-wall bench; vise and cutter; apron on the wall over a stool; mortar and herbs; reading table and scrolls; galdr table corner |
| Display | 12 | Things on show | marble heads on plinths and by a bench; wolf carving over a chest; dragon carving over a bench; raven over a high chair; bone throne and bear pelt; armor stand by a rack; shield between banners |
| Food | 16 | Food and drink set out | brewing corner (No. 207); fermenter with its barrels; pantry shelf; a laid table; supper left out; feasts on round, long and plain tables; potion shelf; the harvest brought in; spice rack and rolling pins over the prep table |
| Light | 9 | Lights on things | lantern on a crate; lamp on a stool by the bed; lava lantern on the table; hooded lantern on a ledge; a candle on a short post; lanterns on tall posts; candles on the bedfoot chest |
| Bed | 6 | What ends up by a bed | folded pelt on the bedfoot chest; clothes on a chair; armor by the bed; crate as nightstand; wardrobe at the bed head |
| Rugs | 4 | Rugs layered and pelts laid on things | rugs layered by the fire; pelts round the fire pit; a pelt on a bench |
| Window | 4 | Under the sill | pots and ferns; a window seat with a pelt; a writing place; crates |
| Wall | 4 | Wall objects | notice board; spice rack; Dvergr lantern over a chest; a jarl seat between torches |
| Floor | 3 | Things in use on the floor | dice on a crate between two stools; mending by a stool; a tub with a stool and a lamp |

Rules the sets follow, from the checks and the pool audit:
- Clips are measured, never guessed. Floor pieces against a wall may go into it as deep as builders set that prefab
  into walls (the decor table's median, 3 to 8 cm, under the audit's 15 cm); hung pieces get no allowance (the audit
  allows 1.5 cm).
- A chest or barrel stays up only on another chest, barrel or crate (`generate.js` finish), and furniture on furniture
  is only storage on storage (the audit's `stacked`): a gem cutter stands on a half wall, never on a table; barrels on
  sleeper beams were left out.
- Nothing taller than 1 m under a window; nothing hung over a window or door.
- Piles stay out of interiors (the audit's `indoorPile`): the skull pile set was left out.

Changes outside the library, each a few lines: `lib/shapes.js` `lidAt` (chests and barrels have colliders open at the
top, so a candle set on a barrel sat inside it; what is set on one now stands on its lid, in the fitter and in the
decorator's `kbRests`); `lib/kitbash.js` `lite()` carries the new fields, `fit` leaves out a creative set's pieces the
village does not make, `placeable` refuses furniture more than 12 cm into other furniture the way the pool audit's
`furnClip` measures it (a mined table set's chair pushed into the decorator's table failed the pool gate), and a
d3-only set's pieces are marked for the third stage; `lib/persona.js` `kitWeight` reads `traits`. A beam hung on a wall
as a shelf keeps its own prefab: the dark wood beam pivots on its underside, and a village's dark beam on a wall read as
loose structure to the support and headroom checks.

Checks with the sets in (2026-11-10, rebased on 87bca47): `lab/check_set.js 2` 224 of 225, 90 of 90, 147 of 147 (as
before); `lab/test_structure.js` holds; the test pool audit passes; the game engine and node give the same 5 designs
byte for byte. `lab/check_interiors.js` against main of the same day: floating 39 designs, 150 problems (was 40, 154),
overlap 2 (was 3), door 1 (1), bare floors 7 (7); one new `stairs` (a decorator bench on a tower's stair foot that a
dining set used to move away, seed 708), and every `lib/checks.js` check at 0.

How often they go in (`node lab/creative_fit.js 2`, 216 designs: nine types, six biomes, s2d2 and s3d3, two seeds):
41 sets placed 108 times, against 37 mined sets placed 65 times; 73 prefabs reach a design through the library (51 by
the creative sets). Every set fits somewhere when tried alone (`node lab/creative_fit.js --probe`) except a few that
need a hall or a corner the sample rarely has (the stonecutter, the tub, the oven, the marble head on a plinth, pots
under a window); bed sets wait for a bed whose anchor the home's own bedside kit has not taken.

Left out, and why:
Of the 220 prefabs, 27 are not in any set:
- Seasonal pieces, Dvergr treasure chests and the asksvin skeleton (8 prefabs): the fitter leaves them out
  (`SKIP_N`).
- 13 prefabs with no collider or model in the lab's data (the drawer, the smoker, bar stacks, the old stone chest,
  the cargo chest, some foods): the fitter cannot test them. `piece_drawer` is the one worth measuring (224 times on a
  wall in the corpus).
- The ceiling brazier and the Mountain brazier: an open fire indoors goes under a smoke hole, which the generator
  places itself. `cloth_hanging_long` hangs 8 m. The 2 m ashwood beam pivots a metre above its solid, so a hung copy
  in the village's wood would land wrong.
- The skull pile (a pile, kept out of interiors by the audit) and the dark wood beam (its one set put a chest on two
  beams as sleepers, and a chest off the floor stays only on another chest).
- Roof pieces as awnings and fences as rails inside: a roof piece indoors reads as ceiling to the headroom check.

Food and drink in a set become flat item stands holding what the household keeps (T-626), and a feast is the
village's own; so the many mead and feast prefabs in the sets differ in the data and by what goes round them.

## Commands

```
python3 lab/learn_interior.py <corpus dir> data/interior.json --top 0.5 --list chosen.csv   # about 10 minutes
node lab/interior_lite.js                          # data/interior.json to data/interior-lite.json
node lab/check_interiors.js lib out.json 3         # the checks; give an older lib dir to compare
node lab/interior_density.js 3                     # pieces per 10 m2 by room against the corpus
node lab/floorplan_feedback.js floorplans.csv      # the sheet's Floorplans tab into data/interior-tuning.json
GEO=/tmp/room-geo.json node lab/mine_room_templates.js <corpus dir> chosen.csv   # room templates, and the rooms as built
node lab/mine_creative.js <compact.json | folder of .blueprint> [out.json]       # combined and clipped objects by contact
node lab/creative_sets.js [mined.json]             # the creative sets into data/kitbash-interior.json
node lab/creative_fit.js 2 [out.json]              # how often each set goes in; --probe [KC-001 ...] tries each alone
node lab/render_creative.js <out dir> [KC-001 ...] # each set drawn in its room
node lab/render_rooms.js /tmp/room-geo.json docs/rooms [RT-0001 ...]           # plan pictures for the Rooms tab
node lab/room_feedback.js rooms.csv                # the Rooms tab into data/room-scores.json (--first 70 with no scores)
node lab/rooms_sheet.js <corpus dir> rows.json [batch]                          # the Rooms tab's rows for the next batch
```

## Open

- Batch 1's pictures were drawn with the renderer of feat/renderer at 4636763 (RENDER_LIB pointed at its lib).
  Once that branch is on main, `RENDER=lab node lab/render_rooms.js` redraws them; the file names stay the same.
- Halls and taverns at d3 fill to 2.3 to 2.4 pieces per 10 m2 against 3.0 to 3.5 before the templates: the fill stops
  when its extras run out in big rooms.
- One tavern template (RT-0035) fits most generated taverns: 18 of the 36 tavern rooms in the sample. More tavern
  rooms in the corpus, or a score from Tyler, would spread them.
- Sizes of the oven and the prep table are estimates, not measured.

- Large hand-made builds furnished with `decorateExisting` still show a few blocked doors and bare small rooms.
- The renderer draws pieces with the sizes in `pieces.js`, so beds and rugs look smaller in the pictures than they are.
- Round huts with 12 to 19 m2 of floor (Saami goahti, small Celtic round houses, crannogs) have no room for a 2.8 m bed
  beside a fire under the smoke hole; they need the minimum house size the generator sets.
- With the fill a large building takes 6 to 7 s at best of 8 in the game's engine (the generator decorates its four
  best bare seeds).
- Plants and food on tables have no vanilla buildable piece; empty horizontal item stands stand in for dishes.
