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
   the stairs and ladders with 0.8 m round them, the work place in front of each station, a ring round the fire.
3. Fire first in homes, halls and taverns (under the ridge vent), then paths from each door to the fire, the stairs and
   the other doors, through the middle of the room. Nothing but rugs goes on a path.
4. Furnish by the room's role, in clusters: beds with a chest at the foot and a rug beside; a table with its seats and a
   rug under it; the fire with its cooking station or cauldron and seats facing it; chests in a row with a sign over the
   middle; stations with their extensions beside them; the throne at the far end with a rug and a torch either side;
   the altar at the far wall with benches in two rows and an aisle.
5. Wall pieces go in the middle of a wall face, or the middle of the plain stretch between openings, 0.35 m clear of any
   door or window; torches in pairs either side of a face's middle.
6. Woodpiles, stone and coal heaps go outside, against a back or side wall, 3 m from doors, never in an enclosed space.
7. Every floor is furnished: upper floors of homes sleep, inns get guest rooms, workshops and storehouses store, guard
   towers get a bed, chest, armor stand and lights per storey and a chest, bench and torch on a roofed lookout.

Each building gets one kit (bed, chest, table, seats, rug, lights, banner, carving), drawn by seed from what its biome
can make and weighted by how often each shows in that kind of room. Cultures lean: Saami and steppe homes have no
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

## Commands

```
python3 lab/learn_interior.py <corpus dir> data/interior.json --top 0.5 --list chosen.csv   # about 10 minutes
node lab/interior_lite.js                          # data/interior.json to data/interior-lite.json
node lab/check_interiors.js lib out.json 3         # the checks; give an older lib dir to compare
```

## Open

- Large hand-made builds furnished with `decorateExisting` still show a few blocked doors and bare small rooms.
- The renderer draws pieces with the sizes in `pieces.js`, so beds and rugs look smaller in the pictures than they are.
- The decorator costs about three times the old one in the game's engine (a large house at best of 8: 4.4 s, was 1.2 s).
  Decorating only the winning seed would remove most of that.
