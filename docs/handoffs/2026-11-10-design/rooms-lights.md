# Rooms track: lights, rugs and cooking corners (design helper C, 2026-11-11)

Branch `design/wip-rooms-lights` from main 8e1860f. Brief: the ideas track's gaps 8 (too many lights) and 9 (no
kitchen stations), `docs/handoffs/2026-11-10-design/ideas.md`. The lead added a rug budget during the round (a Norse
longhouse at s3d3 showed about a dozen rugs on its ground floor). Lessons and rates come from the corpus files named
below (D-136).

## Commits

- e75bccb: light budget per room, cooking corners, lights and stations in `lab/essentials.js`.
- 04bbc98: rug budget per room; wall, floor and hanging lights pooled; main rooms lit as often as corpus buildings.
- The commit with this file.

## What the code does now

`lib/decorate.js`:
- `lightBudget(room)`: one budget of lights per room, by class (wall: sconces and Dvergr wall lanterns; floor:
  standing torches, braziers and lanterns; small: candles, lava and hooded lanterns; hang: ceiling braziers).
  `LIGHT_ROOM` holds, per room kind, the corpus lights per room by class, the share of rooms with none and the median
  room area (data/interior.json rooms: share times mean count, summed per class). A room has no light as often as the
  kind's corpus rooms have none; the building's main room as often as corpus buildings of its kind have none
  (`LIGHT_MAIN_NONE`, from lab/hearths/corpus-hearths-lights.json lightsPer10m2 use: homes 33 %, halls 23 %, taverns
  6 %, work 21 %). A lit room gets the corpus count of a lit room of its kind, scaled by the square root of its area
  against the kind's median (0.35 to 2), the household's liking for lights, the culture's taste, a village factor
  (`c.village` where a caller passes one, else culture and biome) and a draw of 0.7 to 1.3; 70 % of it stands at d2
  (`LIGHT_D2`). Each light draws its class by the kind's corpus mix (candles more for a comfortable household; hanging
  braziers only in rooms of 30 m2 with 3.9 m of height). From a stream of its own.
- `lightFull(room, name)` gates `Room.put`, `putMount`, `placeOnTable` and the hanging brazier: candles keep to their
  own count; wall, floor and hanging lights may take one another's places up to their sum.
- `rugBudget(room)` and `rugFull`: rugs per room from data/culture-corpus/summary.json per culture group (rugs per 10 m2
  from the median and upper quartile rugs over the median and upper quartile floor area; share of buildings with rugs),
  blended with all groups by n / (n + 40). One draw per household places it in that spread (none, 0.7 of the median,
  the median, the upper quartile, twice it). The room kind moves it by data/interior.json rugs per 10 m2 against home
  rooms (`RUG_KIND`). A room lived in of 20 m2 or more has one rug at least when the household keeps rugs. `Room.put`
  refuses a rug past the budget.
- `keepLightBudget` puts every furnished room's cells, height range and budgets on `b.lightRooms`; `lightRoomOf` finds
  the room of a point.
- `lightFlavor`: the wall and floor light picks take the corpus shares without the biome flavor (Dvergr lanterns are
  40 % of corpus wall lights; the flavor held them near none outside the Mistlands). The other slots keep `flavorD`.
- `cookCorner(room, role, c)`: a cooking corner in a home's main room (20 m2 or more, ground floor) before its table,
  and in a tavern room after its fire and paths. Odds: home 0.32, tavern 0.57, from data/interior.json (kitchens: butcher
  table 54 %, oven 32 %, prep table 26 %, mortar 22 % of 78 kitchen rooms; tavern rooms 27, 18, 14, 16 %; home rooms
  about 7, 5, 5, 4 %; 78 kitchen rooms in 497 designs). Each station draws by those shares over the share with any.
  Placed against a wall, in a corner as often as the item's corner share, at fire and door distances drawn from the
  item's quartiles, the next station within about 3 m of the first; a horizontal item stand over the first at 33 %
  (kitchens' itemstandh share). The household's food hobby, busyness and size raise the odds. The butcher table and the
  mortar are cauldron upgrades: the game places them within 5 m of a cauldron and `lib/generate.js settle` takes out
  any farther off, so a spit on the fire pit gives way to the cauldron when one of them is drawn, and they are dropped
  where no cauldron can stand. `kitchenExtras` no longer adds a second butcher table.
- `FURNITURE` gains `cauldron_ext5_mortarandpestle` (size from data/piece-models.json bounds).

`lib/kitbash.js`:
- `trimLights(b)` in `apply`, after the stand pass and before `liveIn`: per room and class, lights best first (by a
  door 1.8 m, a bed, a table, seat or station, the decorator's own spots, less within 3 m of a fire, less within 3.9 m
  of a kept light of the class), kept while the class has room at d3 and at d2 for those standing at d2; a second pass
  pools wall, floor and hanging lights. A kept light past the d2 budget goes up at d3 (pieces of a set keep their set's
  stage); a d3 light goes up at d2 where d2 has room. The rest come out; a set's ledge left with nothing on it goes too.
- `trimRugs(b)`: the same for rugs, a rug on a rug (within 1.2 m and 0.3 m) kept by a draw under 1.5 times the
  culture's rugs-layered share.
- `wallLightsFull`: the library's wall torch pass skips a room that has its wall lights.

`lab/essentials.js`: lights per 10 m2 of covered floor by class (lights over covered floor only), share with none,
floors with candles, wall torches, Dvergr lanterns, lava lanterns; rugs per design and per 10 m2; cooking stations per
type.

## Measures, before (8e1860f) and after

`lab/essentials.js` (216 designs; corpus in brackets):

| | Before | After | Corpus |
|---|---|---|---|
| Home lights per 10 m2, quartiles | 0.77 / 1.16 / 1.35 | 0 / 0.09 / 0.31 | 0 / 0.10 / 0.22 |
| Home designs with no light | 0 % | 44 % | 33 % |
| Longhouse lights per 10 m2 | 0.68 / 0.94 / 1.31 | 0.06 / 0.15 / 0.29 | halls 0.03 / 0.10 / 0.22 |
| Tavern lights per 10 m2 | 0.91 / 1.05 / 1.25 | 0.07 / 0.14 / 0.27 | 0.11 / 0.20 / 0.33 |
| Smithy, workshop, storage (median) | 0.83, 0.84, 1.46 | 0.26, 0.17, 0.16 | work 0.13 |
| Floors with a candle | 59 % | 9 % | rooms 0 to 7 % |
| Floors with a wall torch (door lights included) | 92 % | 67 % | rooms 7 to 40 % |
| Floors with a Dvergr wall lantern | 1 % | 0 % | rooms 4 to 30 % |
| Rugs per home, quartiles | 1 / 3 / 4 | 0 / 0 / 1 | norse median 4 per building of 400 m2 |
| Rugs per 10 m2, home / longhouse / tavern (median) | 0.30 / 0.44 / 0.38 | 0 / 0.12 / 0.04 | 0.10 to 0.19 by group |
| Rugs layered | 14.4 % | 0 % (138 rugs) | 21 to 23 % |
| Tables dressed | 38.1 % | 29.2 % | 41 % |
| Homes with a butcher table, oven, prep table, mortar | 19, 0, 0, 0 % | 22, 3, 6, 6 % (any 33 %) | |
| Taverns with them | 3, 0, 3, 3 % | 28, 11, 14, 19 % (any 50 %) | |

Ideas-study commands on a cut pool (`/tmp/lights/scripts/pool.js`: the six room types, every village culture in its
biomes, s2d2 and s3d3, 238 designs; `lab/learn_interior.py --top 1`; `/tmp/lights/scripts/rooms_cmp.py`). Rooms by
kind, lights per 10 m2 of the median room (share times count over the median area), before / after (corpus): home 1.35
/ 0.29 (0.27), sleeping 1.68 / 0.20 (0.45), tavern 1.13 / 0.23 (0.28), smithy 1.32 / 0.37 (0.39), storage 1.55 / 0.29
(0.66 in rooms of 7.5 m2), workshop 1.11 / 0.18 (0.50). Rooms with a wall torch: home 96 / 60 % (36), tavern 96 / 79 %
(40); candles: home 55 / 10 % (0), sleeping 77 / 17 % (5), tavern 74 / 0 % (7). Tavern rooms with a butcher table 0 / 14
% (27), prep table 0 / 14 % (14), mortar 0 / 18 % (16), oven 0 / 0 % (18). The learner's kitchen rooms in the pool are
home rooms without beds (fire pit and spit); stations there 0 / 0 %.

## Checks

- `lab/test_structure.js`: all rules hold on 36 designs.
- Norse Meadows pool (`make_testpool.js /tmp/lights-pool-norse`): pass, 81 designs, richness 13.2, 0.393, 2.18,
  nestBroken 0. Middle-eastern Plains pool: pass, 81 designs, richness 11.1, 0.504, 1.58.
- `check_interiors.js lib out 1` (234 designs), before / after: bareFloors 1 / 6 (tower upper floors and one Mistlands
  home upper floor of 17 to 30 m2 holding one piece: their light came out), floating 6 / 5, overlap 2 / 1, stairs 1 / 1,
  every checks.js column 0. Furniture per design d2 27.3 / 23.2, d3 50.4 / 43.7 (lights and rugs out).
- `test_variance.js`, means (closest pair) before / after: home-a s2d2 0.36 (0.56) / 0.45 (0.54), s3d3 0.36 / 0.35;
  home-b s2d2 0.38 / 0.36, s3d3 0.54 (0.80) / 0.45 (0.71); home-c s2d2 0.38 / 0.42, s3d3 0.41 / 0.39; hall s2d2 0.37 /
  0.43, s3d3 0.46 / 0.50. All under 0.6.
- `compare_page.js` with the page rebuilt locally from this branch: all five requests the same (the bundle was put back
  before committing).

## Renders (`/tmp/rooms-renders`, not committed)

- `households-home-meadows-s3d3-11.png` (after) and `before-households-home-meadows-s3d3-11.png`
- `views-home-meadows-s3d3-11.png`
- `households-tavern-swamp-s3d3-11.png`, `views-tavern-swamp-s3d3-11.png` (after) and
  `before-views-tavern-swamp-s3d3-11.png`

## Changes in other tracks' files

None. `lib/generate.js settle` (hearths track) removes cauldron upgrades farther than 5 m from a cauldron; the cooking
corner works within that rule.

## Open problems

- Dvergr wall lanterns: the kit now draws them (3 of 24 home rooms in a sample) and their spots are found, but none is
  put up (`putMount` refuses them; reason not traced). The mount height test in `mountSpots` reads a hung lantern as
  standing on its hook (wall top under y + 1.2 m); a change for lights only made no difference in the sample and was
  taken back.
- Rugs layered fell to 0 % (138 rugs): with one or two rugs per room the trim seldom has a pair to keep. Rugs per home
  now sit under the corpus density (median 0 against 0.10 per 10 m2), mostly households drawing none (16 of 36 home
  designs) and 4 of 36 where the budget was not placed.
- Homes with no light 44 % against 33 %; work buildings 44 to 50 % against 21 %. Part is d2 rounding and lights the
  budget allows but nothing places (no spot of the class).
- Tables dressed fell from 38 to 29 % (candles were part of it; corpus 41 %).
- Ovens seldom fit (3 m wide, tall, never under a window): 1 of 5 drawn in a sample. Stations stand only against
  walls; the corpus's free-standing half (islands) is not built.
- bareFloors 1 to 6 in check_interiors (small upper floors left with one piece).
- The village factor uses culture and biome; no caller passes `c.village` yet.

## Next

Trace the Dvergr lantern mount refusal; keep a layered rug pair by the culture's share when a room has two; a
free-standing station draw for big kitchens and taverns; a floor light or item where an upper floor would hold one
piece.

## Proposed Decisions rows

- None needed: lights, rugs and stations are decor (D-065, D-126), paid with stand-ins (D-080).
