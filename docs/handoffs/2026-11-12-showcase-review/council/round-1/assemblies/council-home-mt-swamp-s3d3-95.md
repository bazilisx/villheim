VERDICT: PASS

# Assemblies seat (track G), round 1: council-home-mt-swamp-s3d3-95

Home, Mountain, swamp culture, s3d3, seed 95. One room of 108 m2 on stilts (floor at 2.1 m): fire, sleeping, eating,
gear zones. Judged against `docs/handoffs/2026-11-12-showcase-review/criteria/assemblies.md`.

How it was checked: `node lab/audit_stand_items.js --file <blueprint> home` run by this seat (not taken from the
scorecard); every furniture and stand piece listed from the blueprint; the generation re-run from the same seed with
`VH_DEBUG_ASM=1` and with hooks on `lib/standitems.js ledger/pick` and `lib/assemblies.js find/place` (output identical
to the candidate's blueprint); `views.png` read; close views rendered read-only with `lib/render.js` (crop) under
`/tmp/council-assemblies` (home-kitchen.png, home-west.png, home-east.png).

## Scores

Hard fails (all measured by this seat):

| # | Result | Evidence |
|---|---|---|
| H1 repeat | pass | 0 `repeat`; most repeated item MushroomYellow x2 (herbs cap 2) |
| H2 run | pass | 0 `run` |
| H3 head | pass | 0 `head`; no long weapon or tool on a flat stand |
| H4 edge | pass | 0 `edge` |
| H5 mixed | pass | 0 `mixed` |
| H6 armor dressed | pass | 1 of 1: ArmorFenringChest, Legs, HelmetFenring, CapeWolf |
| H7 furniture rests | pass | no assembly placed; the 6 flat stands sit on their tops (table 2.10 + 0.82 = 2.92; ledges +0.03) |

Weighted (0, 0.5 or 1 times weight). Items 8 to 10 judge placed assemblies; none was placed, so they pass as written.
Without them the score is 51 of 56 applicable (91 %).

| # | Weight | Score | Points | Measured |
|---|---|---|---|---|
| 1 Items fit the room | 10 | 1 | 10 | 6 of 6 kinds weighted for a home (herbs, mead) |
| 2 Items tell the household | 10 | 1 | 10 | ledger themes farmer 0.70, healer 0.56, feaster 0.53; 6 of 6 food, drink and herb items are theme kinds (meads, mushrooms); reads as a healer. The farmer theme (produce, farm tools) shows nothing |
| 3 Variety | 8 | 1 | 8 | 6 dressed stands (under 8, not tested); distinct 0.83 |
| 4 Village's world | 8 | 1 | 8 | village tier 3; items tier 0 to 2; none later |
| 5 Show items in bays | 6 | 1 | 6 | no show items |
| 6 Armor outfit | 8 | 1 | 8 | Fenris set, tier 3 (the village's), pattern CLH+c (266 corpus stands) |
| 7 Built furniture where the room has a program | 10 | 0.5 | 5 | no assembly placed; the kitchen stations (oven, prep table, butcher table) stand at the west and north walls, split by the gear zone (chest and armor stand between them); nothing built for the bed or the table |
| 8 Assemblies fit the room | 8 | 1 | 8 | none placed |
| 9 Assemblies in the room's materials | 8 | 1 | 8 | none placed |
| 10 No assembly repeated | 6 | 1 | 6 | none placed |
| 11 Hidden pieces with a purpose | 6 | 1 | 6 | 2 wood_ledge, each a shelf with two things on it |
| 12 Shelves read as shelves | 4 | 1 | 4 | ledge by the table: a pair of yellow mushrooms; ledge over the bed: two meads |
| Total | 100 | | 87 | pass mark 75 |

## Walk-through

- You come in to a large plank room. The stone oven, the prep table and a butcher's table with its cleaver make a
  kitchen along the west side, but the chest and the Fenris armor stand stand between the oven and the butcher's
  table, so cooking is split in two.
- Nothing is set out where the cooking happens: no pot, no bread, no vegetables by the oven or on the prep table. The
  kitchen reads as stations, not as a kitchen in use.
- The dining table has a raw mushroom and a mead bottle on it, and a shelf beside it holds two yellow mushrooms. Over
  the bed a small shelf holds a healing mead and a frost mead. Together they read as someone who gathers mushrooms
  and keeps potions. That is a clear household, and every item sits flat on its surface.
- The armor stand is dressed in a Fenris set with a wolf cape, which fits a Mountain village.
- No furniture is built from pieces: no hutch, pantry shelf or pot rack by the kitchen, no bedside table or dresser
  by the bed. The two ledges are the only built pieces.
- Three wooden chests in one room, two of them side by side on the inner wall.

## Rule faults found here (each is general, not this house)

1. **Built furniture never reaches the room.** `lib/rooms_intent.js builtZone` asked `AS.find` for the home's kinds
   and got 7 recipes; its own filters (wall 'back' only, `ASM_SKIP` drops any recipe holding a chair, bench, table or
   bed, the beam test, at most 3 signs) left 1 (AC-cabinet-14, 3.9 x 1.9 m), and all 3 spots it tried overlapped
   furniture already placed (debug: placed 3). The home's list `ASM_KINDS.home` also leaves out the corpus's most
   common built furniture for a home: kitchen-stove (28 recipes), bed-nook (18), dresser (9), potion-shelf (8),
   bedside (7). Change: see R1 below.
2. **The stand pass reads this whole house as a bedroom.** `lib/persona.js roleAt` calls a room "upper" when its floor
   is over 1.6 m, measured from 0, so a house on stilts (floor 2.1 m) is 'sleeping' and every stand, the dining table
   included, was picked with the bedroom weights (hook trace: `room=bedroom` for all 7 picks). It did no harm here
   because herbs and meads suit a bedroom, but the same rule mislabels every raised floor. Change: R2.
3. **Item choice ignores where each item is shown in the corpus.** MeadHasty went on the dining table; the corpus shows
   it at a dining spot 0 times in 30 stands (`data/stand-items/items.json` corpus.use). Change: R3.

## Rule changes (for every building)

- **R1, program furniture first.** In `lib/rooms_intent.js`, make the room's built furniture part of its core set,
  placed before loose furniture: take the kinds from the room's zones (kitchen zone: kitchen-stove, kitchen-hutch,
  pantry-shelf; sleeping zone: bed-nook, bedside, dresser; gear zone: armor-alcove; eating zone: display-shelf or
  drink-shelf), query `wall` back or corner, and when a recipe holds its own bed, seat, table or station, let it stand
  in for the suite's piece of that role (swapped to the suite family with `place(..., { family })`) instead of
  skipping the recipe. Keep the existing checks for ways in, rest and hang.
- **R2, stands read the room's intent.** In `lib/persona.js dressStands`, take the room kind and the zone the stand
  is in from the room's intent record (bedroom, watch room, feast hall, kitchen zone, eating zone, fire zone) and map
  them to `rules.rooms` (bedroom, armory, hall, kitchen, dining, hearth). Keep `roleAt` only as a fallback, with
  "upper" measured from the building's lowest floor.
- **R3, items by their own corpus place.** In `lib/standitems.js itemOf`, weight each item by its own share of corpus
  stands at the stand's use (corpus.use: dine, kitchen, sleep, smith, brew, magic) against its kind's share there, and
  leave out an item with 10 or more corpus stands and none at that use.
