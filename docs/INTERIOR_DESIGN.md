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
- `biome` (the hardest piece by `lib/pieces.js` needs, minor decor anywhere) and `from`. Decor, furniture, stations
  and lights go in any biome (Tyler, 2026-11-10), so `from` counts only the building pieces that keep their own
  prefab (a 2 m ashwood post, a black marble bench's posts): a village below `from` never gets the set, and a building
  piece the village does not make is left out of it;
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
- 13 prefabs with no collider or model in the lab's data. Measured on Tyler's PC on 2026-11-10 (`lab/extract_models.py`,
  `lab/build_models.js`): the bar stacks of iron and flametal, the old stone chest, the Ashlands Dvergr crate, cooked
  wolf meat, lox pie, oven pancakes and salad, now in `data/piece-models.json` and `data/piece-solids.json`.
  `piece_drawer`, `piece_chest_cargo` and `MS_PressurePlate_BlackMarble` are mod pieces (not in the game's piece
  list), so the builds that use them are not vanilla; `cauldron_ext7_smoker` and `MeadStaminaLingering` gave no
  usable mesh.
- The ceiling brazier and the Mountain brazier: an open fire indoors goes under a smoke hole, which the generator
  places itself. `cloth_hanging_long` hangs 8 m. The 2 m ashwood beam pivots a metre above its solid, so a hung copy
  in the village's wood would land wrong.
- The skull pile (a pile, kept out of interiors by the audit) and the dark wood beam (its one set put a chest on two
  beams as sleepers, and a chest off the floor stays only on another chest).
- Roof pieces as awnings and fences as rails inside: a roof piece indoors reads as ceiling to the headroom check.

Food and drink in a set become flat item stands holding what the household keeps (T-626), and a feast is the
village's own; so the many mead and feast prefabs in the sets differ in the data and by what goes round them.

## Hearths and lights in the corpus (2026-11-10)

Mined on Tyler's PC from `Downloads\Villheim-blueprints` (1,663 builds after copies and builds with more than 5 % modded
pieces were left out; never the BiomeBlueprints pack) with a script that turns each build to its walls' axis and
casts rays from each fire and light. Kinds come from the folder and title (starter homes and houses, longhouses and
halls, taverns, castles, workshops). 3,434 fires, 1,647 of them indoors (walls on 12 of 16 sides and a roof).

Where the fire stands, by the room it serves (rays from 2.5 m in front of it):

| | Fires | Middle | Against a wall | Corner | Alcove | Half in the wall |
|---|---|---|---|---|---|---|
| Homes, main fire (one per build) | 291 | 16 % | 15 % | 11 % | 34 % | 24 % |
| Homes under 120 m2 | 51 | 8 % | | | | 92 % in the four wall kinds |
| Halls and taverns, rooms over 80 m2 | 148 | 32 % | 16 % | 3 % | 16 % | 29 % |
| All indoor fires | 1,647 | 15 % | 11 % | 8 % | 22 % | 44 % |

How the smoke gets out (what is over the fire):

| | Gap within 1.5 m | Gap 2 to 4 m | Shaft (walls round an open column) | Roof hole | Stone stack past the roof | Closed |
|---|---|---|---|---|---|---|
| Home wall fires (443) | 48 % | 20 % | 13 % | 9 % | 3 % | 5 %, 2 % open to the sky |
| Home middle fires (86) | 49 % | 13 % | 2 % | 20 % | 0 % | 15 % |
| Castles (400) | 17 % | 12 % | 17 % | 7 % | 22 % | 6 %, 21 % open to the sky |

What surrounds a home's wall fire (443): four or more stone pieces within 1.5 m 55 %, a beam over or beside it 77 %
(the wall top counts), stone overhead 5 %, wood overhead 10 %, a pot or spit 67 %, stone floor under it 36 %, a
woodpile within 3.5 m 7 %, raised 5 %, the hearth piece 54 % (the rest fire pits); a median of one seat within 4 m.
Builders mostly let the smoke out through a gap right by the fire (a missing roof piece, the gap between roof and
wall, an open gable) and less often through a built shaft or a stone stack.

Lights indoors (18,380): wall lights 51 % (sconces 60 %, Dvergr wall lanterns 40 %), floor lights 33 % (standing
torches of every kind, braziers, Dvergr pole lanterns), candles and small lanterns 12 %, hanging lights 4 % (hanging
braziers 88 %). Builds that use each kind, and lights per 10 m2 of covered floor (median and upper quartile):

| | Builds | Any light | Wall | Hanging | Floor | Candles | Per 10 m2 |
|---|---|---|---|---|---|---|---|
| Homes | 415 | 67 % | 50 % | 14 % | 39 % | 16 % | 0.10 to 0.22 |
| Halls | 84 | 77 % | 67 % | 26 % | 43 % | 17 % | 0.10 to 0.22 |
| Taverns | 48 | 94 % | 83 % | 29 % | 46 % | 35 % | 0.20 to 0.33 |
| Temples | 32 | 88 % | 63 % | 31 % | 59 % | 25 % | 0.18 to 0.38 |

Small homes have few lights: 70 % of homes under 60 m2 and 64 % of 60 to 120 m2 have none; 120 to 250 m2 have two at
the median, bigger ones eight. Where lights stand: 14 % of sconces and 20 % of Dvergr wall lanterns within 1.5 m of a
door; candles on a table 17 %, within 1.5 m of a table 29 %, by a bed 15 %; any kind within 3 m of a fire 2 to 4 %.
Sconces hang with their foot 1.4 to 3.8 m over the floor (median 2.3). On one floor the nearest other wall light is
1.7 to 5.9 m away (median 3.9), with a spread of 0.28 of that; builders space them by eye, often in pairs.

Builds the rules rest on, among others: "A teeny house for a friendly family of 4 Vikings" and "Cute cozy house" by
PUP (alcove hearths under stone), "The Safehouse" by LordCainhurst (an open shaft), "Custom Grausten Fireplace
(Smokeless)" by Bri Games, "Hermits Mountain Hut" by Fluffy-n-Dana, "Beginner Cabin" by Abzul, "Tiny home challenge,
Part 1" by SorchaAzura, "Artistic medieval house No. 2" by Alexlucker (a chimney stack), "Simple Start Base" by
Deguinho, "New Year, New Home" by kinesthesia and "Modern Starter House" by MADZO (fire pits against the wall).
The generator's rules from these are in docs/BLUEPRINT_LAB.md, "Hearths and light".

### Full corpus round (2026-11-10)

`lab/mine_creative.js` ran over the whole corpus on Tyler's PC (the files read in place, nothing written there; the
OverDrive BiomeBlueprints pack left out): 1,536 vanilla builds of 20 to 15,000 pieces, 353 of them well-liked (the top
quarter by downloads, joined from the corpus index), 15,175 combined objects, 9,187 distinct; 2,740 are in two or
more builds or in a liked build. `lab/select_creative.js` passed 1,308 of them (2 to 10 pieces, no seasonal pieces,
treasure, piles, fires, beds or tables, within 4.6 m and 2.75 m high) and kept 295 (one per set of prefabs and anchor,
liked builds first, and the best two for every prefab); 125 of those were picked by hand to try
(`data/creative-mined.json`). `lab/creative_sets.js` writes them after the hand-written sets: 56 sets, `KC-093`
to `KC-148`, `mined: true`, each with the exact prefabs, the clips and sinks measured from the source, family, role,
household traits, rooms, decor stages, biome, footprint, height, the number of builds and liked builds it was combined
in, and its source builds (liked ones first) in `src`. The library now holds 201 distinct prefabs (193 after the first
round, 109 before).

| Family | Sets | Examples (source builds) |
|---|---|---|
| Built | 22 | a chest framed by beams and posts, a storage bay (16 builds, 6 liked: Kjúklingur and Houses, homes and tinies by MutantArtCat; Leech Landing and The Greydwarf Wharf by HiccupTheHermit); a chest behind a half wall (9 builds); a log bench with a quarter-wall back (Leech Landing); black metal chests between log posts (Fluffybunny's Home, Fluffy-n-Dana); two chairs under a beam shelf (Fantasy Mage House, Apudma) |
| Stations | 12 | a workbench boxed in half walls (The Greydwarf Wharf; Simple Corewood Lighthouse); the artisan press (The Refinery, Fluffy-n-Dana); smithing tools round a workbench (Storage/Workshop, Jacob_Lad); a spinning wheel by a half wall (Kjúklingur) |
| Food | 11 | the fermenter under beams (3 builds: Houses, homes and tinies; My First Home, Fluffy-n-Dana); feasts with cups, candles and a lantern (Daluffo Home, Deardly; Mistvale Keep, Jaikanatar); drinks round a chair (Workmans Pub, Bri Games); the oven built into stone (Skyrim Nordic Home, Luxfen); mead ketill and cauldron (Octagon Starter Base, aSoftPea) |
| Light | 4 | a torch set into a post (9 builds, 4 liked: Quirky Log Cabin, HiccupTheHermit); a lantern on a chair (8 builds: Ultimate Outpost, Volfas; INCREDIBLE Tavern, Olivanderr); candles, pots and a torch on ashwood posts (Japanese Style Base, Dremka) |
| Storage | 3 | a chest with its signs (Cozy tree house, PUP; The Refinery); Dvergr crates stacked; a long crate on beams |
| Display | 2 | a throne and an armor stand (Chickensthorpe Longhouse, Kingchickenx); a black marble bench between armor and posts (Big Spiral House) |
| Window | 2 | pots by a post (My country house, PUP; Ashen Spire, Mint); signs and a pot on quarter walls (INCREDIBLE Tavern) |

How they were checked: each set tried alone in 3 to 24 designs (`lab/creative_fit.js --probe`); 49 of the 125 went into
no room (chest pairs clipping deeper than the 12 cm furniture limit, signs hung on chest fronts, objects that only fit
the room they came from). Each of the other 76 was drawn in a room (`lab/render_creative.js`, three views) and looked
at; 16 were left out: a chair whose cups did not fit, so only the chair went in (4); beams lying on the floor by a
torch or chair with nothing to make them a bench (4); an armor stand or marble head leaning on a floor beam (2); pots
strewn over floor beams; Dvergr shelves turned off the wall (2); three bone thrones in a row; two that never showed in
a picture. 4 more failed the test pool audit (`lab/make_testpool.js`): the galdr table sets (the table and its
upgrades clip into each other, the ledger stood on a chair) and item stands hung on a half wall 0.5 m up. The picks
left out are listed in `lab/creative_sets.js` `DROP`. The per-object counts are in
`data/creative-corpus/kept.csv` (the 2,740 objects in two or more builds or a liked build) and
`data/creative-corpus/prefabs.csv` (each of the 281 prefabs: objects, builds, liked builds).

Found on the way: `lib/pieces.js` has no recipe biome for the galdr table and its upgrades, the black forge and its
upgrades, the lava lantern, the bone throne, the mead ketill or the feasts, and reads them all as Meadows. With decor in
any biome this only shows in the `biome` field.

## Commands

```
python3 lab/learn_interior.py <corpus dir> data/interior.json --top 0.5 --list chosen.csv   # about 10 minutes
node lab/interior_lite.js                          # data/interior.json to data/interior-lite.json
node lab/check_interiors.js lib out.json 3         # the checks; give an older lib dir to compare
node lab/interior_density.js 3                     # pieces per 10 m2 by room against the corpus
node lab/floorplan_feedback.js floorplans.csv      # the sheet's Floorplans tab into data/interior-tuning.json
GEO=/tmp/room-geo.json node lab/mine_room_templates.js <corpus dir> chosen.csv   # room templates, and the rooms as built
node lab/mine_creative.js <compact.json | folder of .blueprint> [out.json]       # combined and clipped objects by contact (a folder is read one build at a time; index.json beside it gives titles, makers, downloads)
node lab/select_creative.js mined-full.json > sel.b64   # the objects worth trying as sets, from a full-corpus run
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

## Items on stands

The stand pass (`tools/blueprint-lab/lib/stands.js` `dressTops`) puts things on flat item stands (`itemstandh`) and wall
item stands (`itemstand`) at the share of each place that the corpus shows (`lab/mine_stands.js --counts`, the counts in
`data/stands-corpus.json`; the measure and its band in `lab/test_stands.js`). Corpus counts of 2026-11-11, stands
holding something inside a building:

- Flat stands (10,940): floor 2,078 (in 140 builds; half of them in 15 builds; 1,893 within 0.5 m of a wall), shelf
  1,856, table 1,611, ledge 1,122, mantel 1,015, on another stand 745, counter 360 (low stone, grausten, black marble
  and quarter walls; 151 of 200 groups a single stand), sill 187, rafter 191, chest 99 (read at the lid; 89 on chests,
  8 on barrels, 2 by a bed), no table under 1 m2.
- Wall stands (4,787): plain wall 757, beams and posts 648, over a workbench 578, by the hearth 558, on beams over
  2.3 m 533, over a chest 333, a table 327, a bed 208, by a door 175, a bench 141.
- Stands on stands: 745 in 71 builds (21 % of the house-like builds with stands), 376 heaps (274 of two), the upper
  stand 4 to 16 cm off the lower (quartiles) at about its height; heaps stand on the floor (168), tables (39), beams,
  walls and posts; most hold one kind (food under food 209 of the pairs, drink 94, herbs 65).

What the pass makes from that: settings, rows and single things on tables, benches, chests and low wall tops
(counters), shelves and mantels, things on sills, hung things on the wall by what stands under it, and heaps (two or
more stands set into one another, on what a set put down or on the floor against a wall) for the households that heap
things. Wall stands over a table or a bed wait while those already hold more than the corpus's share of the house's
wall stands.

Builds whose arrangements were read (title, maker): The Lost Hall of Aegir (doublea1ron); Simple Corewood Lighthouse,
The Greydwarf Wharf, Quirky Log Cabin, Fogbreaker Fortress (HiccupTheHermit); INCREDIBLE Tavern (Olivanderr); Big Spiral
House v2.5 (Haakonzen); The Hall of the Gods (halfnate); Badger Forge & Smelting Pit, Wizard Tower, The Serpent's Tail,
The Burning Tree Hideout (Fluffy-n-Dana); Fantasy Mage House (Apudma); Guest House, Mistlands Era, Tiny Home Challenge
2 (Viking_Anarchist); Stone Chateau (wolvendrake); Daluffo Home (Deardly); The Iron Villa (Boomboy); medieval tavern
(thepower3412); Circular Temple for Trader (Mamlaka).

## Lived-in rooms: outside references (D-025)

Study notes for how rooms look lived in, gathered 2026-11-11. D-025 (Tyler): "Yes, required." Study only: nothing
here is shipped, no image or design is copied, and quotes stay short. D-136 (Tyler): targets come only from what is
observed and learned, so each note says what the source shows and where it differs from the corpus counts.

Access, first pass: valheimians.com pages were read in a cloud browser (read only, no sign-in); WebFetch was blocked
for its build pages (the permission prompt went unanswered).

Access, second pass (2026-11-11, session 2): Baldur's Gate 3 renders were read on bg3.wiki in the cloud browser
(ArtStation pages sit behind a bot check and were not read); write-ups and ESO pages through WebFetch; valheimians.com
and UESP in Tyler's Chrome (Claude in Chrome, at Tyler's request through the lead), read only, one tab, no sign-in.
Image lists came from each build page; the photos were viewed as image files.

### Valheim builds on valheimians.com

Three builds, picked as the newest village build with captioned interior photos and the two most downloaded norse
and norse-forest builds in the corpus.

- **Valheimberg - Ubbe's butchery** (The_Compulsive_Builder),
  https://www.valheimians.com/build/valheimberg-ubbe-s-butchery/. A family of four (by the photo captions: parents, a
  daughter and a son) lives above a shop. Shop: counter, a waiting area for customers, a
  workers' area behind the counter with the stair up. House, in the roof space: kitchen and dining in one room, two
  bedrooms. Seen in the photos:
  - Kitchen: a cauldron on a counter against the wall; drying herbs hung from a rack under the rafters; a small table
    with four chairs, each set at a different angle; food and drink on the table.
  - Parents: a two-person bed with its head against the gable wall under a window; fur rugs laid over the bed as
    covers and a wolf rug under and round it; a different nightstand on each side (a drawer on one, a stool on the
    other), a candle on each, small things on the drawer.
  - Children: one bed on a loft reached by a ladder, one bed below with a chest at its foot, a desk with a lantern
    and small things on it, a small rug; a red cloth hanging divides their corner from the dining room.
  - The description says the meat stores look cold because Frostner and wisp torches are hidden in them for the cold
    effect: a builder using a piece for its effect alone.
- **NPC House 3** (AstridSinjesdottir), https://www.valheimians.com/build/npc-house-3/. The most downloaded norse-sorted
  build in the corpus (916 downloads on the page). Made for an RP server's NPC village, "can be used as very small
  inn"; built with the OdinArchitect mod. The interior photos show bare rooms, stairs and one candle by a window.
- **Cozy Blacksmith Cabin** (Olivanderr), https://www.valheimians.com/build/cozy-blacksmith-cabin/. 3,500+ pieces;
  mods listed include Clutter, BetterCreative and Moregates, so some pieces are not vanilla. Seen in the photos:
  - Ground floor: firewood stacked floor to ceiling in a wall bay beside the fireplace; herbs hung from the ceiling;
    a wall shelf of jars and books beside a window; a lone stool in front of the fire; a ring of candles as a ceiling
    light; one carpet covering the floor wall to wall; a crate by the door.
  - Upper floor under the roof: a round table with a lantern and bowls on it, one chair and a bench built from
    building pieces; an armor stand with a full set of gear in an alcove; weapons on wall stands; jars and sacks on the
    floor along the wall; a pair of wall torches on either side of a window and a hanging lantern; fur rugs laid on the
    carpet.

What the three show together: households are told by who sleeps where (couple, children) and by things kept by use
(food by the cooking, gear by the armor stand, fuel by the fire). Dressing is dense in a few spots and the floor between
them is clear. These are three builds; the corpus counts (`docs/CULTURE_STYLES.md` "Corpus by culture" and the table
below) are the measure.

### Valheim builds on valheimians.com, second pass

Fourteen builds opened, picked from the best-liked builds of each culture group in `summary.json` (`best`) plus the
most downloaded tavern, a shop with a home, and one Valheimberg village build, so that sizes run from a 6 x 8 m tiny
home to a home for ten. All but the Sawmill are in the corpus. Thirteen have interior photos (Upper Class Medieval Townhouse, Apudma,
shows only the outside); Skyrim Nordic Home for Light Start (Luxfen, the maker says it is unfinished) and Lin's Kuzuri
(one bath photo) show little furniture. Builds, makers and URLs (all `https://www.valheimians.com/build/<slug>/`):

| Build (maker) | Slug | Size, culture group | Seen in the interior photos |
|---|---|---|---|
| The Raspberry Cabin (HiccupTheHermit) | the-raspberry-cabin | small cabin, norse-forest | chests stacked two and three high along the walls; several small deer rugs laid at angles; standing torches in corners; bed under the eave; workbench by the window |
| Tiny home challenge, part 2 (SorchaAzura) | tiny-home-challenge-part-2-before-the-elder | 6 x 8 m, norse-forest | every wall used: bed along one wall with a row of item stands above it, cauldron hung over the fire in an outside alcove, plates of food on a bench table, a barrel by the bed; firewood stacked in an outside lean-to with a chopping block |
| Skyrim Nordic Home for Light Start (Luxfen) | skyrim-nordic-home-for-light-start | large, norse | bare rooms, one large rug, a portal; unfinished |
| My First Home (Fluffy-n-Dana), for 4 | my-first-home-starter-base-with-above-ground-basement | round hall, norse | one open hall; hearth in a timber frame in the middle with a cauldron hung over it; beds along the outer wall under the windows, each with a hide rug beside it at an angle; armor stand and a high chair by the hearth; chests by the beds with signs; a storage floor below with barrels along the wall |
| Mountain Lodge for 4 (Fluffy-n-Dana) | mountain-lodge-fob-for-4-vikings | two storeys, norse-highland | ground floor: a wall of chests stacked in a grid with barrels beside, cauldron in a stone fireplace, firewood piled on the mantel, hide rug before the fire, table with a bowl; roof storey: two beds on hide rugs at the gable end under a hung banner and a hanging lantern; two high chairs with a small table between at the other gable |
| Plains triple round house (BuilderG) | plains-triple-round-house | three round huts, celtic | one use per hut: a workshop hut (work tables, chests, chairs by the work), a kitchen hut (round table with food on a rug by the oven, cauldron over the fire, barrel), a sleeping hut with a curtained bed; a wall of weapons on stands; round shields along an arch |
| Starter Swamp Home (LooneyBandit) | starter-swamp-home | one room on stilts, fen-folk | chests stacked along one side wall; bed at the gable end with a small table and two candles under a hung banner; fire by the door |
| Lin's Kuzuri (Lin) | lin-s-japanese-themed-base-called-kuzuri | large, east-asian | sunken stone bath with bowls on its rim |
| Forest Lodge (rabbitramen) | forest-lodge | lodge, tavern folder | sunken fire pit with stepped benches round it; barrels stacked upright by a stone pillar; chests stacked; dining table with carved chairs; shields hung on posts; a gallery above |
| INCREDIBLE Tavern (Olivanderr) | incredible-tavern-valheim-build | tavern | bar with bottles and banners behind; round tables each with a candle in the middle and mugs round it; a long feast table covered in plates with a high chair at its head; bookcase; hide rug on the floor; roof storey: beds in a row along the eaves, each on a long fur runner, chests at their feet, red curtains at the windows, wall candles |
| Ashland's Materials Home for up to 10 (Fluffy-n-Dana) | ashland-s-materials-home-for-up-to-10-fully-decorated | large, ashlands | long dining table on layered carpets; beds in a ring round a central round platform, each with a barrel or small table beside; storage floor below: chests set in a wall grid, barrels on racks three high, a bench with lanterns in the middle on a runner rug |
| Bakery with small store and living area (MutantArtCat) | bakery-with-small-store-and-living-area | shop and home, tavern folder | shop below: bread laid out on a display shelf, plates on the counter; two ovens side by side with a work table, cauldron on a tripod over a fire; chests in a row on a shelf along the sloped wall; home above: round table with chairs set at angles, hide rugs |
| Valheimberg Sawmill (The_Compulsive_Builder) | halheimberg-sawmill-wip | village workplace | captions name each zone (main saw, secondary saw, materials yard, showroom, rest corner for workers); showroom: wall panels shown on plinths along the walls, each with a sign naming it; a desk in the middle with papers; hide rugs overlapping on the floor |

Counts over the eleven with furnished interiors (the three thin ones left out): chests stacked or set in a wall grid 5;
rugs laid at angles or overlapping 6; food or plates on a table 4; weapons or shields on walls 4; beds in a roof storey
or under the eave 5 of the 7 that show beds; a rug beside or under a bed 4 of 7; a light at the bed head 2 of 7; beds
along the outer wall round a central hearth or feature 2 (My First Home, Ashlands home); a storage floor below the
living floor 2; uses split by building 1 (triple round house); shop below and home above 1 (bakery; 2 with Ubbe's
butchery); signs on storage or goods 2; seats round a fire 2 (Forest Lodge pit, the Sawmill rest corner). These are
counts of photos; the corpus measures for the same things are in "Observation against the corpus" below.

### Historical households (zones by who lives there)

- **Svan house** (Stefan Applis, "Svaneti: traditional customs and habits, the Svan house and the role of the man",
  https://stefan-applis-geographien.com/2020/08/02/svaneti-traditional-customs-habits-the-svan-house-and-the-role-of-the-man/):
  one ground-floor room shared by people and animals; a hearth in the middle that always burns and a second one for
  baking; the door near a corner; animal stalls along the door wall and the next; the family on the fourth side, split
  into two sides with their own storage (household things on one, wine vessels, weapons and tools on the other); the
  head's seat and a long bench on one side; the couple's bed behind a door off the room. The writer calls the order
  "almost never violated."
- **Yurt** (University of Washington, Silk Road Seattle, "Dwellings",
  https://depts.washington.edu/silkroad/culture/dwellings/dwellings.html): fire in the middle; the place of honor
  opposite the door for elders and guests; gear on one side of the door, kitchen on the other; things hung on pegs round
  the wall; bedding piled in one quarter by day, the size of the pile showing wealth.
- **Northern Slavic houses** (medievalheritage.eu, "Early medieval dwelling houses of the northern Slavic region",
  https://medievalheritage.eu/en/2020/12/25/early-medieval-dwelling-houses-of-the-northern-slavic-region/): one room;
  the stove in a corner; bedding in opposite corners; stools and wall pegs and no tables; work racks under the porch.
- **Anglo-Saxon homes** (Assassin's Creed Valhalla entry, https://assassinscreedwiki.accesstheanimus.com/wiki/Learnings:_Anglo-Saxon_Homes):
  ordinary homes are one room for cooking, eating, sleeping and company; richer families sleep in a separate building.

Common to all four: the room is laid out round the fire and the door, each side of the room belongs to someone or to a
use, and storage stands with the things of whoever owns that side.

### Games and design talks

- **Skyrim** (Joel Burgess, GDC 2013, summarized in Game Developer, "Skyrim's modular approach to level design",
  https://gamedeveloper.com/design/skyrim-s-modular-approach-to-level-design): players notice repeated small details
  sooner than repeated architecture; Oblivion's copied, fully furnished rooms read as cookie cutter, and the team moved
  to finer pieces from Fallout 3 on; rare unique pieces give a space its identity; numbered variants fill one role.
- **The Witcher 3** (80.lv, "World building of Witcher 3", https://80.lv/articles/world-building-of-witcher-3/; Game
  Banshee, "The Witcher 3: Wild Hunt Environment Design Interview", https://gamebanshee.com/kwaax): meshes are placed
  off any grid so places look built by people; villages are sited by how the people there feed themselves; city
  districts differ by wealth (poor back alleys, cleaner streets near the center); decals and planks add grime.
- **Environmental storytelling** (Harvey Smith and Matthias Worch, GDC 2010 "What happened here?", summarized by
  Nieman Storyboard, https://niemanstoryboard.org/2011/01/14/harvey-smith-on-environmental-storytelling-and-embedding-narrative/):
  players infer what happened from props and their arrangement; the residue of an activity tells it; each clue means
  something alone and adds to a whole; players may miss clues.
- **World of Warcraft housing** (Blizzard, "Azeroth Beautiful: a look at housing interior design",
  https://news.blizzard.com/en-us/article/24186690/azeroth-beautiful-a-look-at-housing-interior-design): small items set
  on a larger piece are parented to it and move with it (books on a shelf); rugs align to floors and pictures to walls;
  partition pieces make rooms inside a shell; decor rides up onto objects it meets; a grid that shrinks on small
  surfaces such as tables; free placement with clipping as an advanced mode.
- **Enshrouded** (TechRaptor, "Enshrouded building and comfort guide",
  https://techraptor.net/gaming/guides/enshrouded-building-and-comfort-guide): comfort counts the best item in each
  furniture category, and resting needs a roof, a fire and one point of comfort. The same rule shape as Valheim's
  comfort: variety of kinds counts, repeats do not.

### Baldur's Gate 3

No Larian talk or write-up on interior set dressing was found. Searched: GDC and other talks, the ArtStation Art Blast,
80.lv, artist portfolio pages, PC Gamer, GamesRadar, Push Square. What the written sources give:

- Jeroen Toma, "Insight into game-ready asset workflow for Baldur's Gate 3" (80.lv,
  https://80.lv/articles/insight-into-game-ready-asset-workflow-for-baldur-s-gate-3): dust and rust placed where they
  would form; most objects treated as aged and worn; modular curtains made to fit many wall sizes.
- Anna Guxens in the city dev diary (PC Gamer, https://www.pcgamer.com/baldurs-gate-3-dev-diary-city-reveal-pcgs-2023):
  the city was built "as a painting almost", a sketch first, then layers.
- Farhang Namdar (GamesRadar, https://www.gamesradar.com/baldurs-gate-3-is-our-game-of-the-year-and-that-wouldnt-be-possible-without-the-developers-expert-worldbuilding-the-biggest-challenge-is-to-keep-the-player-interested):
  variety keeps the player engaged; Act 2 people were drawn as reflections of what they did before.
- Adam Smith (GamesRadar, https://www.gamesradar.com/baldurs-gate-3-was-inspired-by-hitman-and-arkanes-immersive-sims-they-said-a-level-is-a-block-of-swiss-cheese):
  levels give many routes through.
- Gert-Jan van de Put on Moonrise Towers (ArtStation, https://gjvandeput.artstation.com/projects/bldLqG, read through
  WebFetch): the rooms were fitted into the tower with the level designers with the flow of movement in mind; set
  dressing came after, by others.

Close looks: nine Larian renders credited to the environment and lighting artists, from bg3.wiki's "Larian location
images" category (https://bg3.wiki/wiki/Category:Larian_location_images), and the wiki's room-by-room text for the
Last Light Inn, the Hollow at the Emerald Grove and Armbrust's Home (no render of those interiors is in the category).

- **Elfsong Tavern** (Tim Coddens renders 02, 03, 05, 11; https://bg3.wiki/wiki/Elfsong_Tavern). Taproom: a bar with
  stools, a rug under the stool line, a bottle lying under a stool, lanterns in pairs on the bar posts. Side alcoves
  behind curtains, each with a table under a cloth, a candelabra on it, a round rug under the table and a bench along
  the wall; a runner rug down the central aisle. By the fireplace: small tables and stools, a menu board, a mounted head
  above the fire. Upper lounge: sofas and armchairs ring the room along the walls, in pairs with a small round table
  between; the middle is open floor with hides overlapping each other and a round rug overlapping a cowhide, floor
  cushions on the hides; a pair of wall sconces at each bay and one chandelier in the middle.
- **Wyrm's Rock** (Martijn Petersen renders 2, 6): a runner rug leads from the door to a long table that stands on its
  own rug; a chandelier over the table; candle stands in pairs; an animal head on the wall; a desk and bookcase on a
  raised platform. In the court, benches round a pillar and candle stands at its corners.
- **Bonecloak shop** (Jef Simons render): counter with jugs; potted plants along a table at the foot of the stair; a
  sign board on a rug before the counter; bookshelves behind.
- **Basement lodge** (Brodie Keall render): a fire basket with a stool and a bench by it; crates and barrels in the wall
  arches; papers scattered on the floor by a chair; coils of rope by the barrels.
- **Lower City lounge** (Stimona Milanova render, lowercity-5): rugs laid edge to edge over the whole floor; cushions in
  clusters; candles in groups of two or three on the floor; a bed in a curtained alcove with a candle stand on each
  side; a fruit bowl on a side table.
- **Last Light Inn** (https://bg3.wiki/wiki/Last_Light_Inn, text): the main hall has the hearth in the middle, the bar at
  the far end, traders' stalls along the sides, an alchemist's table and a game table; a common lodging room has
  several beds with cupboards between them, packs on the beds and bookcases; the leader has a room of her own upstairs
  with a desk, her diary and wardrobes; storage and cells are in the basement.
- **The Hollow, Emerald Grove** (https://bg3.wiki/wiki/The_Hollow, text): each group holds its own spot: traders'
  stands, a cook near the healer's stall, a smith, an adventurers' table with their shared chest, oxen at a stall with
  a haystack, the leader in a side chamber.
- **Armbrust's Home** (https://bg3.wiki/wiki/Armbrust%27s_Home, text): a tailor's family of three; workroom and kitchen
  below, bedrooms and a living room above; ledgers and notes in the workroom tell of debts; a bathtub upstairs with a
  dye on the shelf over it; a note under a loose plank.

What BG3 shows across these: the place a person sits or works carries their things (a menu board by the bar, papers by
the guard's chair, a diary on the leader's desk). Rooms are zoned by who uses them, with the shared room in the middle
and private rooms off it or upstairs. Seats line the walls in pairs with a small table between them and the middle is
left open. Runner rugs mark the walk from a door to a table. Lights come in pairs (bar posts, wall bays, both sides of
a bed). Rugs overlap and are not square to the room. Small mess sits on the floor (a bottle, papers, rope).

### The Elder Scrolls Online housing

- ESO forum thread "Need more personal furnishings to make house look lived in"
  (https://forums.elderscrollsonline.com/en/discussion/comment/7271523/): players name the small personal things that
  make a home: books on shelves, wine glasses, combs on a vanity, jewelry boxes on a dresser, robes hung in the
  bedroom and bath; and ask for clothing over a chair or the end of a bed, a cloak rack by the entrance, armor and
  weapon racks, a laundry basket, potted plants, half-empty bottles.
- ESO forum thread "Decorating hints, tips, ideas", page 12
  (https://forums.elderscrollsonline.com/en/discussion/365467/decorating-hints-tips-ideas/p12): one item used as another
  in 2 posts (a fan turned on its face as a plinth); one item set into the floor pattern in 1 post.
- ESO-Hub and ArzyeLBuilds housing guides (https://eso-hub.com/en/guides/housing-guide-tips-tricks/housing-editor-and-decoration-basics,
  https://arzyelbuilds.com/eso-housing/): editor controls only; nothing on dressing rooms.

ESO adds the list of personal things by room (vanity things in the bedroom, cloaks by the door). Valheim has few such
pieces; the vanilla stand items (item stands holding gear, food, trophies) are the nearest.

### Skyrim homes and inns (UESP)

- **Breezehome** (https://en.uesp.net/wiki/Skyrim:Breezehome): when bought it is dusty, with cobwebs, crates, two
  unusable chairs and an unlit fire pit. Each upgrade furnishes one room with a small set: bedroom 2 chairs, a dresser,
  3 end tables, a table, a shield plaque with two greatswords over the bed, 2 wall decorations, 2 rugs; kitchen 2
  chairs, a cooking pot, a set of shelves, a table, 3 wall decorations, 1 rug, herbs and fish hung up; dining a better
  table, a barrel, a chair, a cupboard, 2 wall shelves, 1 rug; living room a bookcase, 2 chairs, a cupboard, 3 wall
  shelves, 2 tables, a weapon plaque, a weapon rack, 1 rug. The housecarl's room: a bed, a dresser, an end table, a
  sack.
- **Proudspire Manor** (https://en.uesp.net/wiki/Skyrim:Proudspire_Manor): the same pattern at a larger size: a
  bedroom set (2 wardrobes, a weapon rack, an end table, a bed, a chest, a safe), a dining set (4 chairs, a cupboard, a
  shelf), an alchemy corner (shelving, a small round table, an ingredient rack, 2 rugs), an enchanting corner (plaques,
  mannequins, a soul gem stand).
- **The Bannered Mare** (https://en.uesp.net/wiki/Skyrim:The_Bannered_Mare): ground floor common room, a small bedroom
  (the keeper's) and the kitchen; upper floor three rented bedrooms.

Skyrim's room sets are small and fixed: about one rug per room (two in the bedroom), one or two chairs, one table, two
to four things on the walls, one storage piece. The bought-but-bare state (dust, crates, broken chairs, cold fire) is
its own look.

### Observation against the corpus (D-136)

What the outside sources show, set against what the 1,093 furnished buildings do. A source can suggest what to measure;
the share in the corpus is the number a generator aims for. Corpus shares are from `summary.json`: `relx` per culture
group and `relxAll` (second pass, method in the file's `note`), `rel` and `kinds` (first pass). "pieces" is the share
of that kind of piece; "builds" is the share of furnished buildings with one or more.

| Observation | Seen in | Corpus measure | Corpus share |
|---|---|---|---|
| Chests stacked on chests, or set in a wall grid | 5 of 11 valheimians builds | `relx.chestsStacked` | 58 % of chests, 48 % of builds (norse 60 / 59, norse-forest 63 / 64, ashlands 73 / 34) |
| A light at the bed head (candle, lantern, torch within 2 m) | 2 of 7 valheimians builds showing beds; BG3 lounge alcove; Ubbe's butchery | `relx.bedsLit` | 14 % of beds, 15 % of builds (medieval-timber 31 / 48, fen-folk 43 / 33, norse 11 / 14) |
| Beds under the roof slope or in the roof storey | 5 of 7 | `relx.bedsUnderSlope`; `rel.bedsAboveMainFloor` | under a roof piece 14 % of beds (norse 21, norse-highland 15); above the main floor 50 to 85 % of builds with beds |
| A rug beside or under a bed | 4 of 7 | `rel.bedsOnRug` | about 30 % of beds (45 fantasy, 64 east-asian) |
| A rug laid over a bed as a cover | Ubbe's butchery; perhaps the tavern beds | `relx.bedsRugOver` | 1 % of beds (east-asian 18 %) |
| Seats along the walls | BG3 Elfsong lounge, Wyrm's Rock court; valheimians benches | `relx.seatsByWall` | 42 % of seats, 62 % of builds |
| Chairs, tables and rugs turned off the room axes | 6 of 11 (rugs); Ubbe's chairs; BG3 rugs and stools | `relx.seatsOffAxis`, `tablesOffAxis`, `rugsOffAxis` | seats 42 %, tables 29 %, rugs 31 % of pieces turned more than 10 degrees |
| Two or more lights beside a window | Cozy Blacksmith Cabin; BG3 wall bays | `relx.windowsLitPair` | 3 % of windows, 11 % of builds |
| Rugs layered on rugs | 6 of 11; BG3 Elfsong lounge, Lower City lounge | `rel.rugsLayered` | 18 to 27 % of rugs |
| Seats round a fire | Forest Lodge, Sawmill rest corner; BG3 basement lodge, Elfsong fireplace | `rel.seatsByFire` | 3 to 9 % of seats |
| Food or plates on tables | 4 of 11; BG3 Wyrm's Rock and Elfsong | `onTable` | tables dressed 23 to 59 %; the top dressing is the horizontal item stand |
| Beds round the outer wall facing a central hearth or feature | 2 of 11; Last Light Inn hall has the hearth in the middle | none | measure needed: bed headboard toward the nearest wall with a fire in the middle third of the room |
| A runner rug from a door to a table | BG3 Wyrm's Rock, Elfsong aisle | none | measure needed: long rug (or rugs in a line) between a door and a table, needs the room finder |
| One rug per room, a small fixed set per room | Skyrim upgrade sets | none | measure needed: rugs, seats and tables per room, needs `lab/learn_interior.py`'s room finder |
| Signs on storage or goods | 2 of 11 | none | measure needed: sign within 1 m of a chest or an item stand |
| Storage floor below, living floor above | 2 of 11; Last Light Inn basement | none | measure needed: share of chests and barrels by storey |
| Shop below, home above | bakery, Ubbe's butchery; Armbrust's Home (workroom below) | none | measure needed: crafting and trade pieces by storey against beds by storey |
| Small mess on the floor (a bottle, papers, rope) | BG3 Elfsong and basement lodge | none | measure needed: loose small pieces on a floor away from any surface |

Commands for `relx` (device, `$HOME/vhresearch`, scripts kept out of the repo): `mine_extra.js` is `mine_culture.js`
with the extra relations added after `rugsLayered` and a short output line; `node mine_extra.js
$HOME/mnt/Downloads/Villheim-blueprints featx.jsonl 170` (38 s for 2,153 builds), then `node agg_extra.js` (writes
`out/extra.json`, merged into `summary.json` as `relx` and `relxAll`).

### How a generator could apply this under the drivers

Options only; nothing here is built, and each needs a measure in the corpus before it becomes a target (D-136).

- Who lives there (family and household traits): dress each bed from its sleeper (D-077 assigns beds ahead). A couple's
  bed against an end wall with a different small piece on each side; children's beds in a loft or stacked, with a
  chest at the foot. Corpus check: beds above the main floor 39 to 91 %, chest within 2.6 m of a bed 17 to 38 %.
- Zones round the fire and the door (culture): give each side of a room an owner or a use and put that side's storage
  with it (Svan, yurt, Slavic). Cultures differ in where the fire sits (middle, corner) and what faces the door (place
  of honor, stalls, bench).
- Clutter by use: fuel by the fire, gear by the armor stand, food by the cooking. Corpus: wood stacks in 19 % of
  furnished buildings (median 4 when present), cauldron extensions 42 %, armor stands 38 %.
- Layering on surfaces: place small things only on a parent surface (WoW parenting); rugs on rugs and on beds. Corpus:
  horizontal item stands are the main table and sill dressing; layered rugs 7 to 28 %.
- Few hot spots, clear floor: dense dressing at a table, a shelf or a bed head, open floor between. Corpus: most
  tables bare (dressed 23 to 59 %), and builds that use horizontal stands use many (median 18).
- Imperfect placement: small turns and offsets on chairs and loose things (Witcher grid-free placement; Ubbe's
  chairs). Corpus: 42 % of seats, 29 % of tables and 31 % of rugs are turned more than 10 degrees off the wall axes
  (`relx`).
- Light: a light by some beds, a hanging light over a table. Corpus: 0.2 to 0.6 lights per 10 m2; a light within 2 m
  of 14 % of beds (31 % medieval-timber, 43 % fen-folk); two lights at a window for 3 % of windows. Paired lights at
  every bed or window are rarer in the corpus than in BG3.
- Avoid visible repeats: vary nightstand kinds, item mixes and rug kinds between homes (Skyrim); one rare piece per
  home.
- Variety for comfort: one of each kind before a second of any (Enshrouded and Valheim comfort).
- Wear and mess: wealth by village or family trait (Witcher districts). The corpus has no wear measure; vanilla has few
  wear pieces, so mess is shown by quantity and placement.
- Storage that looks used: chests stacked two or three high along a wall, or in a grid, for about half of chests
  (`relx.chestsStacked` 58 % of chests); barrels in rows or upright stacks; a storage floor below in large homes.
- Seats: about four in ten seats stand along a wall (`relx.seatsByWall`), and a quarter at a table (`rel`); BG3 and the
  valheimians lodges pair wall seats with a small table between and leave the middle of the room open.
- Who sits or works here: the things of a person go at their seat or work place (papers at a desk, a menu by the bar,
  a diary on the leader's desk, tools by the bench). Private room off or above the shared room (Last Light Inn,
  Bannered Mare, Armbrust's Home).
- Room sets by use (Skyrim): each room gets a small set by its use (sleeping, cooking, eating, living), about one rug,
  one or two chairs, one table, a few things on the walls, one storage piece. A per-room count in the corpus is needed
  before this sets any number.

### Tricks builders use on purpose (D-127)

Counts from the 1,093 furnished buildings in the corpus (40+ building pieces, 5+ pieces of furniture inside, outside
the statue, bridge, arena, mini-game, portal-hub, farming and artistic folders); photos from the builds viewed in both
passes above.

| Trick | How often | Source |
|---|---|---|
| Horizontal item stands as table and sill dressing (items lie on the surface) | in 43 % of furnished buildings, median 18 where used; first on tables in most culture groups | corpus |
| Upright item stands on walls | 48 %, median 12 | corpus |
| Resource stacks as decor (wood, fine wood, core wood) | 19 %, median 4 | corpus |
| Ore, stone, coal and bone piles | 12 %, median 4 | corpus |
| Treasure stacks and treasure chests | 19 %, median 3 | corpus |
| Banners | 54 %, median 6 | corpus |
| Cauldron extensions (spice rack, butcher table, pots, rolling pins) | 42 %, median 4 | corpus |
| Barrels | 22 %, median 6 | corpus |
| Rugs layered on rugs | 7 to 28 % of rugs, by group | corpus (`rel.rugsLayered`) |
| A table set on a table (Dvergr table as a counter or shelf) | 418 pieces in norse-forest, rare elsewhere | corpus (`onTable`) |
| Black marble heads under or in windows | 3,032 pieces in castle, also Ashlands | corpus (`onSill`) |
| Firewood stacked floor to ceiling in a wall bay | 1 of 3 builds viewed | Cozy Blacksmith Cabin |
| Rugs laid over a bed as covers | 1 of 3 | Ubbe's butchery |
| A cloth hanging as a room divider | 1 of 3 | Ubbe's butchery |
| Herbs hung from rafters | 2 of 3 (piece not identified; may be a mod piece in the cabin) | both furnished builds |
| A bench or couch built from building pieces | 1 of 3 | Cozy Blacksmith Cabin |
| A piece hidden for its effect (Frostner and wisp torches for a cold look) | 1 of 3 | Ubbe's butchery (description) |
| Chests stacked on chests along a wall or in a grid | 58 % of chests, 48 % of furnished buildings; 5 of 11 builds viewed in the second pass | corpus (`relx.chestsStacked`), photos |
| Barrels stacked upright or on racks | 3 of 11 (Forest Lodge, Ashlands home, My First Home) | photos; no corpus measure |
| A sunken fire pit with stepped benches round it | 1 of 11 (Forest Lodge) | photos |
| Signs labeling storage or goods | 2 of 11 (My First Home, Sawmill showroom) | photos |

Counts here cover whole builds; where the piece sits (in a wall, clipped, on a surface) is measured only for the
table, sill and rug relations. Clip depths are in "Creative sets" above.

## Room intent: outside study (2026-11-12)

Track C of the showcase review (`docs/handoffs/2026-11-12-showcase-review/README.md`, cause 2: rooms without
intent). Tyler asked for this study in his showcase notes (`TYLER_NOTES.md`): the WoW housing tour as an exemplar
("among my favorites for how interior design and clutter can make it feel alive, lived in, homey, cosy"), designers of
BG3, ESO, Skyrim and others, and real-world room design "like in a real house, those sorts of feng shui skills". He
added (through the lead, 2026-11-12): "figure out how different rooms, layouts, decor and intentional clutter and
environmental storytelling play a role. Recall these are among our most important interior design drivers."

Notes per source, with links, are in `docs/handoffs/2026-11-12-showcase-review/outside/`: `wow-housing-tour.md`
(room by room) and `sources.md` (everything else read this round). Screenshots stay in the private repo
(`villheim-corpus/research/2026-11-12-outside/`). This section turns them into rules. D-136: a rule from outside
sources is a candidate until the corpus confirms it; marks below say which.

- **[corpus]** measured in the corpus (number given).
- **[confirm]** not yet measured; track B (`docs/ROOM_STUDY.md`, `data/rooms-corpus/`) or a later pass measures it,
  and the corpus number replaces the outside one where they differ.
- **[Tyler]** Tyler's own rule or words; applies as given.

### Corpus checks made for this section

Two quick passes over `compact.json` (2,128 builds) to test outside rules before writing them down. Scripts and
output: `villheim-corpus/research/2026-11-12-outside/scripts/` (`seats.py`, `groups.py`).

| Question | Result |
|---|---|
| Seats within 2.2 m of a table: how many kinds per table? | 1,987 tables with seats: one kind 1,816 (91 %), two kinds 162, three or four 9 |
| Which seats go with which table? | `piece_table`: chair02 33 %, chair03 31 %, bench01 17 %, chair 12 %, logbench01 3 %. `piece_table_round`: chair03 84 %. `piece_table_oak`: chair03 73 %, bench01 11 %, throne01 7 %. `piece_blackmarble_table`: chair03 58 %, blackmarble_bench 23 %. `dvergrprops_table`: dvergr stool 70 %. Runed tables: runed chairs 72 to 93 % |
| Black marble seats at tables of another material | 5 of 1,847 tables (0.3 %) |
| Log benches | in 152 of 2,128 builds (7 %), median 2 per build (p75 3); 20 % within 3.5 m of a fire, 9 % within 2.2 m of a table |
| Light kinds in builds with 5 or more lights (947 builds) | 1 kind 190, 2 kinds 217, 3 kinds 191, 4 kinds 109, 5 kinds 88, 6 or more 152; the commonest kind is 50 / 67 / 91 % of a build's lights (p25 / p50 / p75) |
| Horizontal item stands in groups (within 0.6 m, same height) | singles 74 %, pairs 10 %, threes 4 %, fours 3 %, fives 2 %, larger 8 %. Groups of two or more: odd 1,191, even 1,656 |

What these mean for the rules below: one seat kind per table is what builders do; the dark wood chair (`piece_chair03`)
is the common seat at oak, round and black marble tables; black marble benches belong at black marble tables only;
log benches are a rare piece, more often by a fire than at a table; one light kind leads in a building with one to
three others beside it. The rule of odds from home styling (groups of three and five) does not show in how builders
group horizontal stands: single stands and pairs lead. Odd groups stay a styling option for a few hot spots, never a
target count.

### What the WoW house teaches

Full notes: `outside/wow-housing-tour.md`. The tour house has 36 viewpoints on two floors: a bar and kitchen block, a
two-storey library, a lounge and study wing, an upper gallery hall with a lounge and kitchen room, a round guest
bedroom and a cave den. Fourteen points it shows throughout:

1. Every furniture group stands on its own rug (11 of 12 groups seen); the rug marks the zone.
2. The walking line from door to door or stair is bare floor; small clutter sits at its edge, never on it.
3. One wood for furniture, a darker wood for structure, and iron fittings on both, in every room.
4. Two fabric colors per room, repeated in rugs, curtains, cushions and hangings.
5. A focal point at the end of the view from each door; fireplaces framed symmetrically by structure and dressed
   unevenly by small things.
6. Small things in groups of three with a gap before the next group (a styling choice; see the corpus check above).
7. Walls dressed in bays between posts, one theme per bay, in two layers (something high, something low).
8. A ceiling layer in every used room: string lights, chandeliers, lanterns on posts, food hung from beams, nets.
9. Food and drink at every stage: raw in sacks and crates, cooking with steam, served on plates, stored in kegs.
10. Mid-use signs: an open book, a pushed-back chair, plans on a desk with a ruler on them, cups set out.
11. A light every few steps along the walking lines; a hung light over each table.
12. One or two odd personal pieces per room among the serious ones.
13. Places left empty on purpose: the aisle, behind the counter, the stair foot, the middle of the hall.
14. Storage behind the room it serves (a pantry behind the kitchen, kegs at the bar end); no chest stacks in living
    rooms. The corpus stacks 58 % of its chests (`relx.chestsStacked`, above), so stacks belong in storage rooms and
    store walls, and the living rooms of a home follow the tour.

### What the other sources add

- **Skyrim inns and homes** (pictures of the Bannered Mare and Breezehome, `outside/sources.md`): the social room is
  built round one fire in the middle, with benches beside it and seats in small groups along the walls; the serving
  counter stands to one side of the fire with food hung from the beam behind it; service rooms have their own door
  outside, with the chopping block by that door; food stores tuck under the stair; a sleeper's room is told by three
  or four things (the housecarl's bed with a fur, a shield over it, a chest, a training dummy).
- **Viking longhouse and hall seating** (Hurstwic): benches along both long walls between the posts and the wall,
  facing each other across a long fire; the high seat in the middle of the upper bench, the guest of honor in the
  middle of the lower bench across the fire; rank falls toward the door; storage under the benches; tables put up
  for meals; a closed bed for the heads of the house; a pantry off the main room; a draft room at the entry.
- **Medieval great hall** (World History Encyclopedia): the high table on a dais at the far end from the entry; a
  screen at the entry end with service passages behind it to the kitchen and pantry; long tables and benches round
  the sides; weapons and hangings on the walls; candle stands and wall lights.
- **Feng shui** (Cliff Tan, NPR): a clear entry; the command position (a solid wall behind the bed or the chief seat,
  facing the door, not in line with it); warm low light from several sources; furniture sized to the room.
- **Set dressing and storytelling** (Don Carson; 80.lv articles in `outside/sources.md`): props are placed by use,
  never by grid; every object has a reason to be where it is; one story per scene or it reads as a museum; a strong
  first read on entry, then secondary and tertiary detail; calm places where the eye rests; one clear clue at the
  focal point; vary how crowded each area is; one unique piece in a row of repeats; wear and mess where the use is.

### Space and walking lines

- **[Tyler]** Passages people walk through are at least two `wood_floor` pieces wide (4 m); one piece wide only for a
  closet or hidden passage. Nothing crowds a doorway or the space just inside it (D-148, D-152).
- **[corpus]** Clear depth inside a door, p10 by room kind: hall 4.0 m, kitchen 3.5, living 3.0, tavern 2.6, sleeping
  2.4, smithy 2.2, home 1.6 ("What builders do", above).
- Real-world clearances scale the in-room lines (Houzz, `outside/sources.md`): walkway 0.8 to 0.9 m, 0.6 m between
  pieces of furniture, 0.9 m behind a seated diner, 0.5 m at the sides of a double bed, a seating group inside an arc
  of about 2.4 m. A third-person camera and a Valheim character need more than a real person; until track B gives the
  corpus numbers, the lab uses: a walking line in a room at least one `wood_floor` (2 m) wide where it is not a
  passage between rooms; a seat with its pull-back space (about 1 m behind a bench or chair at a table, matching the
  corpus bench gap of 1.0 m from the table's middle line) kept off the walking line. **[confirm]**
- Walking lines run door to door, door to stair, door to the focal point and door to each zone. Each zone is entered
  from a line, never through another zone (feng shui flow; WoW plan).
- The space at a stair foot and top stays clear for one `wood_floor` (WoW library and I room; existing decorator rule:
  stairs and ladders with 0.8 m round them).

### Focal point and command position

- Every room has one focal point: the piece seen first from the main door, at the far end or the far wall of the view.
  By room kind: hearth (home, hall, lounge), bed (bedroom), bar counter and its back wall (bar), long table or high
  seat (hall), forge or workbench (smithy, workshop), altar (temple), desk or map table (study). In a tavern the
  central fire leads and the bar is the second focus (Skyrim, longhouse).
- The focal point gets the best dressing (Carson: save the best detail for the destination) and the strongest light.
- The chief seat (high seat, throne, the head of a long table, the desk chair) has a solid wall behind it and faces
  the door across the room; it never has its back to the door (feng shui command position; longhouse high seat;
  great hall dais).
- The bed head goes to a solid wall, not under a window; the bed is not in line with the door and is not beside it;
  from the bed the door is in view (feng shui; corpus: bed head to a wall, pivot 1.75 m out). **[confirm]** the share of
  corpus beds in line with a door.
- Symmetry frames the focal point (cupboards either side of the fire, a pair of plants either side of the far door,
  banners in a pair); everything else in the room is uneven.

### Zones and groupings

- A room holds one to four zones, each with its own purpose and its own set: the focal zone, then up to three
  supporting zones (eating, sleeping, working, storing, sitting). Rooms under about 25 m2 hold one or two. **[confirm]**
  zones per room by size.
- A zone is a set of pieces that belong together, placed together, on its own rug where the culture lays rugs (WoW:
  11 of 12 groups; corpus: rugs under 22 % of tables, 18 % of beds, 38 % of round tables, so a rug per zone is the
  WoW look, and the corpus share is the target). **[corpus]** for rug shares, **[confirm]** for rug per zone.
- Seating groups face a shared center (the fire, a table, the high seat) within an arc of about 2.4 m; seats along
  walls come in pairs with a small table between (BG3, WoW, real-world arc).
- One seat kind per table. **[corpus]** 91 % of tables with seats. Mixed seats at one table (a log bench, a stool and
  a chair) read as hodgepodge (Tyler, longhouse 05).
- Tables in a room: one main table per eating zone; a second table only for a second purpose (a side table with
  drink, a desk, a work table), never two eating tables side by side in a home (Tyler, longhouse 05). **[confirm]**
  tables per room by kind.

### Light

- Layers: a general light over the room (chandelier, hanging brazier, the fire), task light where people work or eat
  (a candle on the table, a lantern by the desk, a torch by the workbench), accent light on the focal point and wall
  bays (wall torches in a pair, standing lanterns by the fire) (Redfin; WoW).
- A light every few steps along each walking line, and a light at the far end of the view (WoW; Carson). Dark
  stretches are allowed at the room's edges and corners where nothing is used (Carson: leave areas in shadow).
- Warm light only in living rooms: fire, candles, torches, lanterns. Blue, green or purple light is an accent once per
  room at most, for a reason (a mage table, a Mistlands lantern), never the main light (Tyler on the rune table).
- **[corpus]** One light kind leads a building (median 67 % of its lights) with up to three others beside it. **[Tyler]**
  "the exact same type of torches in every build ... countless candles": the leading kind changes from building to
  building, by culture and biome.
- **[corpus]** 0.2 to 0.6 lights per 10 m2; a light within 2 m of 14 % of beds.

### Palette

- **Woods.** Pick one furniture wood family per zone and at most two per room, plus the structure wood (beams, posts,
  walls). In view at once: three wood tones at most, as base (floor and structure), contrast (main furniture) and
  accent (one or two pieces) (Apartment Therapy rule of threes; WoW: one furniture wood, one darker structure wood).
  Families by mesh texture (`work/cache/<prefab>.json`, `mat`): base wood (`piece_table`, `piece_bench01`,
  `piece_chair02`, `piece_workbench`), oak (`piece_table_oak`, `piece_table_round`, and the Deep North
  `mountainkit_table`, which uses a worn copy of the oak texture), dark wood (`piece_chair03`, darkwood beams), log and
  bark (`piece_logbench01`, `fire_pit`), Dvergr (`dvergrprops_*`, wood with copper and metal bands), runed
  (`piece_chair_runed`, `piece_table_runed`, `piece_table_runed_small`, `piece_bench_runed`), black marble
  (`piece_blackmarble_table`, `piece_blackmarble_bench`), Ashlands (`ashwood_bed`, `piece_blackwood_bench01`). How
  each looks (color, finish) is track A's catalog; the families here are from the texture names only.
- **Pairings the corpus makes** **[corpus]**: dark wood chairs with oak, round and black marble tables; base chairs
  (chair02) and dark chairs with the plain table; Dvergr stools with Dvergr tables; runed chairs with runed tables;
  black marble benches with black marble tables only. The Deep North oak table shares its texture family with the oak
  and round tables, so Deep North pieces can join oak rooms of any biome (Tyler: Deep North furniture "could certainly
  pair well with any sort of meadows house onward"). **[confirm]** once the catalog has colors.
- **Stone and metal.** One stone in a room besides the hearth (stone floor, black marble or grausten, never stone and
  grausten mixed; Tyler 015, 016). Metals: one or two per room (iron bands on chests and barrels, copper on Dvergr
  pieces, gold on treasure), the same metal on pieces of one use (Jordan Samson). **[confirm]** stone and metal mixes.
- **Fabric and color.** Two fabric colors per room, repeated in rugs, banners, drapes and curtains (WoW). Hides (deer,
  wolf, bear, lox, Bjorn) count as neutral. Shares as a guide (60-30-10, Bob Vila): about 60 % the structure wood and
  floor, 30 % the furniture wood and rugs, 10 % accent (banners, glow, gold, one bright fabric). A house keeps one
  household color across rooms (WoW: teal and gold in the bar, blue in the upper rooms); a guest room may carry another
  culture's set if every piece in it shares that set's trim (WoW guest room).
- **Glow.** One glow color per room besides warm fire. Purple, blue and green glow (mage table, eitr pieces, Dvergr
  lanterns, colored torches) only in a room whose purpose calls for it (study, temple, Mistlands buildings).

### Intentional clutter

Clutter reads as purposeful when each object answers three questions: what is it for, who used it, and why is it
here (80.lv believable environments; Carson cause and effect). The rules:

1. **Near where it is used.** Food at the cooking and the table; drink at the bar, the kegs and the fire seats; tools
   at the station they serve and on the wall above it; weapons and armor by the armor stand, the bed of the one who
   uses them, or the door; fuel by the fire or outside by the door (see vignette 4 for the indoor question); goods by
   the counter; books, maps and papers at the desk. A small thing more than about 2 m from its use is out of place.
   **[confirm]** distance from stand items to their use piece in the corpus (the stand pass already places by surface,
   `lib/stands.js`).
2. **On a parent.** Small things sit on a surface (table, counter, shelf, sill, chest lid, mantel, beam) or hang on a
   wall over the piece they belong to; few lie loose on the floor, and those at a wall or a seat (WoW parenting; corpus:
   floor stands 2,078, 1,893 of them within 0.5 m of a wall).
3. **In hot spots.** Two to four dressed spots per room: the focal point, then one to three supporting zones; the floor
   and walls between stay plain (WoW; 80.lv: vary how crowded each area is, and leave places where the eye rests).
   Within a hot spot, density falls off from its busiest end (the WoW library table: busy near end, sparse far end).
   **[confirm]** hot spots per room in the corpus.
4. **Layers per room.** Large (the set pieces), medium (barrels, stands, chests, armor stands), small (items on stands),
   wall (item stands, banners, shields, trophies, torches), ceiling (chandeliers, hanging braziers, banners from beams,
   items hung on beams), floor (rugs, a few loose things at walls). A used room has something in each of wall, floor
   and either medium or ceiling (WoW). A layer with nothing is allowed for a reason (a cave den has no ceiling layer).
5. **Varied heights in a group.** A group mixes a tall, a middle and a low piece (a basket, a plant, a small chest at a
   corner; a lantern, a book and a cup on a dresser) (WoW; rule of odds). Counts follow the corpus: single stands and
   pairs lead (74 % and 10 % of horizontal stand groups), with larger groups at a few hot spots.
6. **Varied kinds, capped repeats.** Inside a room, any one small kind (the same candle, the same pot) repeats only as
   a set (a row of mugs on a bar, candles along a table); a decor kind seen in every room of a building is a sign of
   repetition (Tyler: same torches, candles, drapes, log benches, stacked chests). Per building: the lead light kind
   at about two thirds of the lights, others for the rest (corpus above); log benches at most two or three in the few
   buildings that have them (corpus median 2, p75 3, in 7 % of builds); stacked chests in storage rooms and store
   walls, not in every corner (Tyler).
7. **How much is too much.** The walking lines stay bare; no clutter in a door box; furniture and medium pieces take at
   most half the floor (existing fill rule); dressed spots stay under about a third of the room's wall length
   **[confirm]**; density per room kind stays inside the corpus p25 to p75 band ("How full rooms are", above). Signs of
   too much: groups touching groups, the same object in three places in view, a small thing with no parent and no
   use, clutter on a stair or in front of a door.
8. **Imperfect placement.** Loose things and chairs turned a little, never on a grid; sets kept square (beds to walls,
   tables to the room or turned on purpose). **[corpus]** 42 % of seats, 29 % of tables and 31 % of rugs are turned
   more than 10 degrees (`relx`).

### Environmental storytelling

A room tells who lives there and what they were just doing (Smith and Worch; Carson; the 80.lv articles). Rules:

1. **One story per room, one per building.** Pick the household's traits first (family size and ages from the roster,
   D-077; wealth; habits such as brewing, reading, hunting trophies, music, gardening; culture), then dress every room
   from them. Traits are household traits, never professions (drivers in the 2026-11-10 helper rules). A prop that belongs to
   no trait of the household is left out (80.lv: props share one story, or the room is a museum).
2. **Who lives here, by owner zones.** Each sleeping place carries its sleeper's things: a fighter's bed with a shield
   over it and a chest at its foot (Breezehome housecarl); a couple's bed with a different small piece on each side
   (Ubbe's butchery); children's beds smaller, in a loft or corner. In the main room each side or seat belongs to
   someone (longhouse high seat; Svan house sides): the head's chair by the fire with a footstool or a drink beside it,
   the work corner of the one who mends or spins.
3. **What they were just doing (mid-task scenes).** Each home has one or two scenes caught mid-use, at hot spots:
   a meal half eaten, a chair pushed back from the table, a drink by the fire seat, a pot on the fire, work laid out on
   the bench, a book or map open on the desk (WoW: open book, plans with a ruler, steam over the pot, cups set out).
   Every mid-task scene has its cause in reach: the plates by the cooking, the tools by the station.
4. **Residue of time.** Wear and use where the use is: rugs worn at the door (Valheim has no wear decals; use more
   rugs layered at the entry and the fire), high corners left bare and dark where nothing is used (WoW shows cobwebs
   there), fuel used down by the fire. The building's stage shows it: an s1
   home has the needs and a few personal pieces; an s3 home has years of things (more stands, trophies, banners).
5. **One clear clue at the focal point.** The best-read piece of the story sits at the focal point: a trophy over the
   hearth, the household's banner behind the high seat, the family's best item on a stand above the table (80.lv
   narrative). Clues elsewhere add to it and each means something alone (Smith and Worch).
6. **Contrast and one unique piece.** One piece per room breaks the pattern (a single odd personal piece, a rare
   trophy; WoW's flamingo, Carson's unique pillar), so repeated sets never read as copies.
7. **Familiar first.** A room must read as its kind on entry (a bed reads bedroom, a counter and kegs read bar) before
   any detail (80.lv strong first read; Carson familiar reference points).

### Room intent template

Each room the decorator furnishes gets an intent record before any piece is placed:

| Field | What it holds |
|---|---|
| Purpose | One line: what the room is for and for whom (household, guests, workers) |
| Focal point | The piece seen first from the main door, and where it stands |
| Zones | One to four, each with its purpose, its place (wall, corner, center, bay) and its set |
| Walking lines | Door to door, door to stair, door to focal point, door to each zone; widths from "Space and walking lines" |
| Core set | The pieces the room needs to read as its kind |
| Supporting pieces | Pieces that add to the purpose (side tables, storage for that room's use, a second seat group) |
| Clutter layers | Which layers get dressing, the hot spots, the mid-task scene if any |
| Light | General, task and accent sources and the lead light kind |
| Palette | Structure wood, furniture wood family, stone and metal, two fabric colors, glow if any |
| Story | The household traits it shows, the owner of each zone, the clue at the focal point |
| Never here | Pieces that do not belong in this kind of room |

### Room kinds

Pieces in each line are vanilla names from `lib/pieces.js` and the mesh cache; looks are checked against track A's
catalog when it lands. Counts are from outside sources unless marked.

**Home main room** (cooking, eating, sitting; the house's social room)
- Purpose: the family's daily room. Focal point: the hearth (`hearth`, `fire_pit`, wall hearths with chimneys; Tyler:
  home fires along walls, in alcoves, or in wall hearths).
- Zones: hearth with one or two seats facing it (chair or bench 2 m and more out; existing rule: no bench beside the
  fire in homes, FP-002, FP-010); one table with one seat kind (2 to 6 seats); a cooking spot at or beside the fire
  (`piece_cookingstation`, `piece_cauldron` with extensions); a store wall or corner for food (barrels, a chest).
- Walking lines: door to hearth zone edge, door to stair, door to the bedroom doors; the line passes beside the table,
  never through the seat ring.
- Clutter: food on the table and by the cooking (`itemstandh`), cooking tools on the wall over the cauldron, a trophy
  or the household's banner over the hearth, rugs at the hearth and under the table where the culture lays rugs.
- Never: a forge, a mage table, a black marble bench at a wooden table, outdoor fence (`wood_fence`), rooftop
  animals (`darkwood_raven`, `darkwood_wolf`) (Tyler), stacked chests in the corners, a fire pit just inside the door
  (Tyler 09).

**Bedroom**
- Purpose: sleep, and the sleeper's things. Focal point: the bed, head to a solid wall, not in line with the door.
- Zones: the bed with a nightstand on one or both sides (a small table, a barrel or a chest; different pieces either
  side for a couple) and a chest at the foot or along the side; a dressing or gear corner (armor stand, wall stands for
  weapons and a shield); in a larger room a sitting spot (one chair and a light).
- Walking lines: door to the open side of each bed, at least 0.5 m real or one floor piece in game; door to the chest.
- Light: a candle or lantern near the bed head (corpus: 14 % of beds) and one general light.
- Clutter: the sleeper's items on stands over the bed or the chest (corpus: 208 wall stands over beds); a rug beside
  the bed (corpus: about 30 % of beds).
- Never: cooking stations, forges, workbenches, a mage or rune table (Tyler 06), tables with benches for meals,
  beds at odd angles to each other (Tyler 10).

**Kitchen corner** (a zone in a home, or its own room in a tavern or hall)
- Focal point: the cooking fire with the cauldron or cooking station on it.
- Zones: the fire; a prep surface (`piece_preptable`, a table, `cauldron_ext3_butchertable`); food storage beside it
  (barrels, sacks as stand items, a food chest); an oven where the stage allows (`piece_oven`).
- Clutter: food at every stage (raw by the prep table, cooking on the fire, served at the table), tools hung over the
  prep surface, herbs and meat on stands near the fire (WoW, Skyrim).
- A kitchen in its own room gets a door to the yard where the plan allows, with fuel and the chopping block outside it
  (Skyrim, longhouse pantry).

**Tavern** (social building; the common room)
- Focal point: a central fire (Tyler: middle fires for social rooms; `hearth` preferred to `fire_pit` in taverns,
  Tyler 06). The bar is the second focus, against one wall, in view of the fire.
- Zones: the fire ring (benches facing the fire, sized to the hall; existing rule: a ring only in halls of 60 m2 and
  more); tables in small groups along the walls, each with one seat kind (corpus 91 %); the bar (below); a stair to
  guest rooms; a kitchen behind the bar or off the room.
- Walking lines: door to the fire ring, door to the bar, bar to the kitchen, door to the stair. The space behind the
  bar is clear (Tyler 06: chests blocked it).
- Clutter: mugs and food on the tables at one or two tables (a feast at one, drinks at another, bare elsewhere),
  banners on the walls in bays, trophies over the fire or the bar.
- Never: stacked chests in the room (storage goes behind the bar or in a store room), beds in the common room.

**Bar** (a zone in a tavern or a hall)
- Core set: a counter (tables in a row or half walls with a top; corpus counters are low stone, grausten, black marble
  and quarter walls), stools or chairs of one kind in front, kegs at one end (`barrell` in a row, a `fermenter`), shelves
  or a wall of stands behind with drink and food.
- Space: a clear strip behind the counter for the server, entered from one end (WoW; Tyler 06).
- Clutter: mugs on the counter in groups with gaps, a candle at one end, food hung or on stands on the back wall,
  the bar's banner or sign over the back shelf (WoW, Skyrim).

**Hall and hub** (longhouse, great hall, village hub)
- Focal point: the high seat or throne (`piece_throne01`, `piece_throne02`) at the far end, or the middle of one long
  side facing the fire (longhouse); a long fire or hearths down the middle.
- Zones: benches along the long walls facing the fire (longhouse) or long tables down the sides (great hall); the
  high seat with a table before it; an entry end with a screen or a draft room and the service doors; wall bays with
  weapons, shields and banners.
- Walking lines: the central aisle stays clear from door to high seat (WoW gallery hall, longhouse corridor); hall
  passages at least 3 floor pieces wide (Tyler: "Wider hallways can be 3 or more").
- Clutter: dressing in bays between posts, one theme per bay, the same kind repeated per bay with variation (WoW
  gallery); a chandelier or hanging brazier per bay down the center line; a feast at the high table only.
- Tie beams in halls large enough (D-128).

**Workshop and smithy**
- Focal point: the main station (forge with its extensions; workbench with its extensions), back to a wall.
- Zones: the station with its extensions to its sides (existing rules: forge with anvil 1.5 m to one side, cooler and
  bellows 1.25 m to the other; workbench chopping block 2 m to one side); material storage (ore and bars on stands,
  wood stacks, chests with signs); a finished-goods wall (weapons on stands, armor stand); a rest spot (one stool or
  bench with a drink, the Sawmill "rest corner").
- Walking lines: door to the front of each station, kept clear for the work place.
- Never: a second copy of the same extension in front of the station or in the middle of the floor (Tyler 13, forge
  ext2 and ext4), a spinning wheel by the door (Tyler 15), beds.

**Storehouse**
- Purpose: storage for the village (D-113: separate from the longhouse). Focal point: the main store wall facing the
  door, chests in a row or a grid with a sign over each group (corpus: half of chests against a wall, 58 % stacked).
- Zones: store walls by material (D-016, signs); barrels in rows; a counter or table for counting goods; a cart or
  crates near the door.
- Walking lines: door down the middle, a lane in front of each store wall wide enough to open the chests.
- Here, stacked chests and repeated crates are right: density follows the corpus (storage 4.0 / 7.6 / 10.0 pieces per
  10 m2).

**Temple**
- Focal point: the altar at the far wall facing the door (existing rule: benches in two rows and an aisle).
- Zones: the altar with candles and offerings on stands; seating rows; a side shrine or two along the walls.
- Light: candles in groups at the altar, braziers in pairs along the aisle; one glow color allowed if it fits the god.
- Never: beds, cooking, storage stacks.

**Study** (a library or map room in a large home, hall or tower)
- Focal point: the desk or map table (`piece_cartographytable`, a table with a chair) under a light, or a long reading
  table under a chandelier (WoW library).
- Zones: the desk with one chair turned a little as if pushed back; a reading seat in a corner with a light and a rug;
  walls of stands as shelves (horizontal stands on beams or ledges as shelves).
- Clutter: maps and papers at the desk (vanilla has few paper items; the cartography table carries the read), a lantern,
  a drink; a mage table (`piece_magetable` and extensions) only here or in a temple, with its glow as the room's one
  accent (Tyler 06).

### Vignettes

Small scenes with a story, each tied to a hot spot. A vignette is placed whole or not at all; one or two per home, two
to four in a tavern or hall. Valheim pieces in parentheses.

1. **Supper left mid-meal.** A table with one seat kind, one seat pushed back and turned 10 to 30 degrees, plates
   and food on horizontal stands at the places, a drink, a candle (table, chairs or benches, `itemstandh` with cooked
   meat, bread, mead, `Candle_resin`).
2. **Pot on the fire.** The cooking station or cauldron on the fire with food on it, raw food on a stand on the prep
   surface beside it, a tool hung over it (`piece_cookingstation`, `piece_cauldron`, `cauldron_ext*`, `itemstandh`,
   `itemstand`).
3. **The head's chair by the fire.** One chair or the high seat facing the fire from 2 m or more, a small table or
   barrel beside it with a drink and a light, a hide rug before it (`piece_chair02` or `piece_throne01`,
   `piece_chest_barrel` as a side table, `itemstandh` with mead, `rug_wolf`).
4. **Fuel by the hearth.** Firewood beside the fire in a wall bay (Cozy Blacksmith Cabin; corpus: wood stacks in 19 %
   of furnished buildings, median 4). The decorator moves woodpiles outdoors since T-05; whether a small stack beside a
   hearth is allowed indoors needs Tyler's answer (proposed row below).
5. **Mending corner.** An armor stand with part of a set on it, a chair beside it, tools and the missing piece on wall
   stands above (`ArmorStand`, `piece_chair`, `itemstand`).
6. **Reading or map nook.** A chair in a corner turned to the room, a light beside it, a rug in front, a small table
   with a book or map item (existing extra "reading corner"; WoW G2 alcove; `piece_cartographytable` in a study).
7. **Brewing corner.** A fermenter with barrels in a row beside it and mead on a stand on the barrel tops (`fermenter`,
   `barrell`, `itemstandh`).
8. **Bar end.** Kegs at the end of the counter, a mug at the tap end, a candle, the bar's banner on the wall behind
   (WoW A2).
9. **Trophy bay.** One wall bay between posts with trophies on stands, a banner, and a torch pair either side; the
   best trophy over the hearth or the high seat (WoW gallery; corpus wall stands by the hearth 558).
10. **Bedside.** A bed with a nightstand piece and a candle at the head, a chest at the foot, the sleeper's weapon or
    shield on a stand over the bed, a rug beside (Breezehome; corpus bed relations).
11. **Couple's bed.** One large bed with a different small piece on each side, a candle on one, a chest at the foot
    (Ubbe's butchery).
12. **Work laid out.** A workbench with its extensions, a half-made item on a horizontal stand on the bench top,
    tools on the wall above, the chopping block 2 m aside, offcuts (wood on a stand) (corpus: wall stands over
    workbenches 578).
13. **Smith at the anvil.** The forge with one anvil beside it, a bar or a blade on a stand by the anvil, a cooler
    and bellows on the other side, ore on a stand at the store side (forge extensions placed by
    the existing rules).
14. **Guest bench by the door.** A bench along the wall beside (never in) the door box, a cloak or shield on a wall
    stand over it (ESO: cloak rack by the entrance).
15. **Offering at the altar.** Candles in a group at the altar, offerings (food, a trophy, a coin stack) on stands
    in front.
16. **Late drink by the fire.** Two chairs angled toward the fire with a small table between, two mugs and a
    candle on it (BG3 pairs, WoW lounge).
17. **Window seat.** A bench under a window with a plant on the sill and a rug before it (WoW couch under the
    window; corpus sill stands 187).
18. **Store corner at a turn.** At a corner on a walking line, three floor pieces of different heights (a barrel, a
    crate, a chest), never on the line (WoW F1 landing).

### What the corpus still has to confirm

Each **[confirm]** above, gathered for track B and the next pass (D-136: corpus numbers win where they differ):

- In-room walking line width and the pull-back space behind seats.
- Share of beds in line with a door, and beds under windows.
- Zones per room by room size, and hot spots (dressed spots) per room.
- Rugs per zone, and runner rugs along walking lines.
- Tables per room by room kind; eating tables side by side.
- Stone kinds and metal kinds mixed per room; furniture wood families per room (with the catalog's colors).
- Distance from each stand item to the piece it belongs to (food to cooking or table, tools to stations).
- Share of wall length dressed per room.
- Light kinds per room (the building measure is above).
