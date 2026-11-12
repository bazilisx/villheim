VERDICT: PASS

Seat: catalog (track A). Checklist: `docs/handoffs/2026-11-12-showcase-review/criteria/catalog.md`.
Score: 82 of 93 measured weight (88.2 %), pass mark 80 %. No hard fail. Item 16 scores 0: two of the three storeys are
empty, and the record names a table that is not there.
Item 5 is left out of the total (no approved buildings yet).

## Scores

Measured with `lab/council_checks.js` (re-run), `lib/catalog.js`, my piece list with positions, track B `kinds.json`,
and renders (views.png, floor-1.png to floor-3.png).

| # | Weight | Score | Measured | Note |
|---|---|---|---|---|
| H1 | hard | pass | no wood_fence (D-164); the parapet is stone merlons with wood half walls between | |
| H2 | hard | pass | 4 dragon beds, each headboard (-z) on its wall | checked by hand: yaw 270 east wall, 90 west, 0 south |
| H3 | hard | pass | 6 wall item stands and 2 sconces on walls | |
| 1 | 10 | 10 | no table | |
| 2 | 8 | 4 | ground floor: dragon beds (hide) 4 of 7 large pieces (57 %), with an iron-banded chest and 2 stools: three families | just under the 60 % line; the mix reads fine on the render |
| 3 | 8 | 8 | | |
| 4 | 8 | 8 | dragon beds 4 against `catalog.cap` 1 | the room is a dormitory by its beds: corpus dormitories hold 4 beds at the median, 7 at p90, and the dragon bed is the focal in 28 % of them (kinds.json); counted as within |
| 5 | 7 | not scored | | |
| 6 | 7 | 7 | not a home, hall or tavern | |
| 7 | 6 | 6 | | |
| 8 | 6 | 6 | | |
| 9 | 6 | 6 | stone walls, plank floors, wood poles, wood half walls in the parapet | plank/stone lift 1.14; no stone and grausten |
| 10 | 6 | 6 | | |
| 11 | 5 | 5 | | |
| 12 | 5 | 5 | | |
| 13 | 5 | 5 | wall stands 1.25 to 1.85 m above their floors | |
| 14 | 4 | 2 | 8 of 10 indoor pieces under a roof: the 2 wall sconces flank the outside door | corpus: 19 % of wall sconce uses are uncovered; my test should exempt lights at an outside door (see the end) |
| 15 | 4 | 4 | | |
| 16 | 5 | 0 | see below | |

Item 16, the record against the building:
- Floor 0, recorded "bedroom, focal bed": it holds 4 beds, a dormitory by the corpus (bedrooms hold at most 2 beds,
  kinds.json). Two pickaxes and a shield hang on its walls.
- Floor 1, recorded "watch room, focal table, zones table, gear": no table and no seat. One armor stand with a root
  harnesk and nothing else on it, two fish and a hammer on wall stands. 74 m2.
- Floor 2, "other, kept plain": 77 m2 with nothing in it.
- The roof terrace: nothing.
- The plan's lead light, the hanging iron brazier, is not built; no storey has an indoor light.

## What a person walking through would notice

- A square stone keep, stone stair up to a plank door with a sconce on each side. Crenellations on top.
- Inside the door, a dormitory: four dragon beds in four spots along the walls, an iron-banded chest in the middle of
  the floor, a stool beside two of the beds. Tidy and readable. The fanciest bed in the game for four guards.
- Two pickaxes and a silver shield hang over the beds.
- Up the ladder: a big empty room with one armor stand and two mounted fish. Up again: an empty room. Up again: an
  empty roof. Three of the four levels have nothing to do in them, and no level has a light inside.

## Misses: principle, rule, change

1. **A room's plan is dropped without a trace.** The watch room's table (the plan's long heavy table) is not built,
   and "Ways in kept open: 8 left out" in the notes. `lib/layout.js openWays` leaves out tables and stations that close
   a lane, after the room's intent was recorded (`lib/decorate.js` report, `rooms_intent.js furnishRoom`). Change: as
   in the longhouse file, rebuild the record from the finished blueprint and fail a room in `lib/checks.js` when its
   focal piece is gone, so the room is furnished again with a smaller table or in another spot. A room may stay plain
   only when the plan says so from the start.
2. **Room kind by role, not by contents.** `rooms_intent.js kindOf` maps every 'guard' room to 'bedroom' and every
   'lookout' to 'other'. The ground floor holds four beds (a dormitory); the lookout is a room to watch from. Change:
   kindOf for guard rooms picks dormitory when the household's beds there are 3 or more, and the lookout gets the
   watch room's program (a table, seats, a light) since it is the room the tower exists for.
3. **One bed for every room.** The suite picks one bed for the building (`planBuilding`: "dragon bed with furs") and
   every room takes it. A guards' dormitory and a family's best bedroom get the same bed. Change: the bed for a
   dormitory is chosen from the corpus dormitory focal shares (ashwood bed 41 %, straw bed 31 %, dragon bed 28 %,
   kinds.json) weighed by the household's wealth, and the suite bed stays for the head's bedroom.
4. **Stand items by wall, not by room.** Pickaxes in a bedroom: the `KS-w-tools` set in `lib/stands.js` lists
   `ctx: ['workbench', 'chest', 'door', 'plain']`, so any plain wall in any room takes it (the fish set likewise has
   'plain'). Change: each wall set also names the room kinds it belongs in (tools: workshop, smithy, storage, a gear
   zone), read from track B room kinds; a bedroom wall takes only the sleeper's own gear (shield, weapon, cape).
5. **No light inside** (as in the smithy file): the lead light is a hanging brazier, and nothing in the furnishing
   placed it; `kitFor` hands rooms only a wall light and a floor light. Change: `kitFor` passes the plan's hanging
   light as a ceiling light, and a room without any light after `kitbash.js trimLights` gets one back.

## Checks run

- `lab/council_checks.js`: catalog 74 of 82, no hard fail. My score differs on item 2 (the script found no room
  over the line; by my count the ground floor is 57 %), item 4 (the script counts the beds over its cap of 2) and
  item 14 (the script gives 0 at 0.8).
- Bed yaws worked out by hand against the catalog front (headboard at -z).
- All renders read.

## A fix to my own checklist

Item 14 counts wall sconces (covered share 0.81) with beds and chests. A sconce beside an outside door is a corpus use.
For round 2 I would exempt lights within 1.8 m of an outside door.
