VERDICT: FAIL

Seat: corpus rooms (track B). Candidate: tower mt frankish-norman s3d3 seed 31 (567 pieces).
Deciding items: two of three floors have no purpose (item 1 over all rooms), 33 % of the floor in an empty room and
a 75 m2 floor with one piece (item 20), no light and no rug in any room (item 21), the way from the door to the stair
0.75 m wide (item 14). Proposed H6 (a room's planned focal set left out) also fails.

## How it was scored

- `node lab/rooms_corpus_audit.js` run by me on the blueprint (work files in `/tmp/council-rooms/<candidate>/`), raw
  room records read, the views and the three floor plans looked at, and the generator traced once with
  `corpus-rooms/scripts/trace.js` in this round folder (wraps `furnishRoom`, `capBuilding` and `openWays` to log what each placed or
  left out; the repo is unchanged).
- The criteria file scores rooms with two or more floor pieces only (item 1), so an empty floor escapes it. My brief
  says empty wings and bare halls count against a building, so I score item 1 over every room of 20 m2 or more and add
  two items from the corpus. Totals: criteria file as written out of 100 (pass 80), and with the brief's tests out of
  115 (pass 92, the same 80 %).
- Added item 20, furnished for its size (8): every reached room of 20 m2 or more at or over its kind's corpus p25 of
  floor furniture per 10 m2 (bedroom 0.55, dormitory 0.58, home 0.75, feast hall 0.92, smithy 0.65, dining 0.69), and
  the share of the building's floor in empty rooms of 20 m2 or more at or under the corpus p75 (0.08; half marks to
  the p90, 0.32). Corpus: furnished vanilla builds of 30 to 400 m2 (378 builds), measured today from the study's room
  extract with `corpus-rooms/scripts/empty_zones.js`: largest empty room p50 0 m2, p75 23, p90 51; an empty
  room of 60 m2 or more in 8 % of them. Empty rooms in the whole study: p90 31.75 m2 (`kinds.json` empty).
- Added item 21, lights and rugs to the corpus counts (7): lights 4 points (full when each room of 20 m2 or more has
  at least half its kind's corpus p50 when present: home and feast hall 3, dormitory and smithy 2; half when each has
  one); rugs 3 points (full when each room of a kind with rugs in 60 % or more of corpus rooms has one, or the
  household plan draws no rugs). Corpus `kinds.json` counts: lights in 92 % of dormitories (p50 4), 85 % of homes (p50
  when present 5), 70 % of smithies; rugs in 85 % of dormitories, 91 % of homes, 57 % of feast halls, 46 % of smithies.

## Rooms as the reader finds them

| Floor | Generator's intent | Reader's kind | m2 | Floor pieces | Per 10 m2 | Corpus p25 / p50 |
|---|---|---|---|---|---|---|
| 1.1 m | bedroom (4 dragon beds) | dormitory | 79 | 4 piece_bed02, piece_chest, 2 piece_chair | 0.89 | 0.58 / 0.79 |
| 4.1 m | watch room, focal table | display | 74.5 | ArmorStand | 0.13 | none fits |
| 7.1 m | other, "a small room kept plain" | empty | 77 | none | 0 | empty rooms p90 31.75 m2 |

Trace: `furnishRoom` put an oak table, two piece_chair03 and an ArmorStand on floor 4.1, and a chest on floor 7.1.
`openWays` (lib/layout.js) then left out the table, both chairs and five itemstandh ("Ways in kept open: ... 8 left
out"). The top floor's chest is gone from the blueprint as well. No room got a light: the plan's only light kind is
piece_brazierceiling01, and no tower floor takes it. The two piece_walltorch stand outside by the doors.

## Scores

| # | Item | Weight | Score | Measured |
|---|---|---|---|---|
| H1 | Passage two wood_floor wide | hard | ok | no halls or wings |
| H2 | Doorway crowded | hard | ok | door at (0, -5): clear depth 4.5 m, nearest bed 1.9 m |
| H3 | Room or focal unreachable | hard | ok, at the line | door to stair 0.75 m; H3 fails under 0.75 |
| H4 | Station blocked by extension | hard | ok | no stations |
| H5 | Fence indoors | hard | ok | none |
| H6 (proposed) | A room's planned focal set left out | hard | FAIL | watch room table and chairs left out by openWays |
| 1 | Purpose and focal (every room of 20 m2 or more) | 8 | 0 | 1 of 3 rooms (33 %); the file's own test (2+ pieces) gives 8 |
| 2 | One seat prefab per table | 6 | 6 | no table left |
| 3 | Seats per table | 5 | 5 | the two piece_chair stand by beds, not loose |
| 4 | Seats face their table | 5 | 5 | no table sets |
| 5 | Seats match their table | 6 | 6 | no table sets |
| 6 | One tone per room | 4 | 2 | luma spread 47 (target 43) |
| 7 | No avoided family pairs | 5 | 5 | hide, iron props, rustic |
| 8 | Counts per kind | 8 | 8 | 4 beds in a dormitory (p50 4, p90 7) |
| 9 | Few light kinds | 6 | 6 | no indoor light at all (see item 21) |
| 10 | Repetition caps | 8 | 8 | none over |
| 11 | Stacked chests | 4 | 4 | none |
| 12 | Beds as builders set them | 5 | 5 | all four heads at a wall |
| 13 | Work corners | 5 | 5 | none |
| 14 | Walking lines | 6 | 0 | 25 % of ways 1.5 m or more; door to stair 0.75, 1.0, 1.0 m |
| 15 | Clear zone inside doors | 4 | 4 | |
| 16 | Wall decor offsets | 6 | 6 | |
| 17 | Window planters | 3 | 3 | none |
| 18 | Plant clusters | 4 | 4 | |
| 19 | Gardens meet the building | 2 | 2 | |
| 20 | Furnished for its size (added) | 8 | 0 | 33 % of floor in an empty room (corpus p90 0.32); floor 4.1 at 0.13 per 10 m2 |
| 21 | Lights and rugs (added) | 7 | 0 | 0 lights in 3 rooms; plan rugs rug_hare, rug_straw, none placed |

Criteria file as written: 92 of 100 (my run matches the builder's 92). With the brief's tests: 84 of 115 (73 %).

## Walking through it

- You climb the ramp and open the door straight into a barracks: four big dragon beds, one in each corner, heads to
  the walls. That reads as a guard dormitory, and four beds is the corpus median for one.
- A black iron chest sits in the middle of the aisle between the bed feet, with a stool by two of the beds. To reach
  the ladder you squeeze past the chest and a bed corner at about 0.75 m. The room is dark: no torch, no brazier.
- Up the ladder, the second floor is 75 m2 of bare planks with one armor stand by the wall. Nothing says what the
  floor is for. The record calls it a watch room round a table; the table is not there.
- The top floor under the parapet roof is 77 m2 with nothing in it at all.
- No rug, no banner, no light anywhere inside. The stone keep is handsome from outside; inside it is one full room and
  two empty ones.

## Misses, the principle each breaks, and the rule to change

1. Principle: the way-clearing pass may move or shrink a room's set but never hollow the room out. Rule:
   `lib/layout.js openWays` keeps only fires and the first chest (`keepAlways`) and otherwise drops whatever still
   blocks a lane ("what still finds no place is left out"). Change: treat each room's focal set (the pieces in
   `room.intent.zones` for the focal zone: the table with its seats, the bed, the station) as kept; when no move clears
   the lane, ask the room's furnisher for a smaller set at another wall (the corpus's smaller tables, two seats) before
   leaving anything out; after the pass, any room of 20 m2 or more left with fewer than two floor pieces is furnished
   again. This fixes every building where a lane runs past a focal set, not just this tower.
2. Principle: rooms are as furnished as corpus rooms of their size; only small rooms stand empty (empty rooms p90
   31.75 m2; largest empty room in furnished houses p90 51 m2). Rule: `lib/rooms_intent.js kindOf` maps role
   `lookout` to `other` ("a small room kept plain" whatever its size), and `furnishRoom` gives a lookout one chest.
   Change: `other` only under 30 m2; a larger lookout or top floor takes a kind with corpus counts by area (a watch
   room: a table with two seats by a window, a chest, a weapon rack or armor stand, lights; or a store room when the
   building needs one). Add a last check in `furnishRoom` callers that every reached room reaches its kind's p25
   furniture per 10 m2.
3. Principle: a room's lights follow its kind's corpus count, in the building's light kinds, and a room never goes
   dark because one kind cannot be placed. Rules: `planBuilding` can draw a single light kind (`nKinds` 1 in half the
   draws) that is the hanging brazier; `roomLights` in `furnishRoom` falls back only within `plan.lights`;
   `lib/decorate.js lightBudget` allows hanging lights only under a ceiling over 3.9 m (`hangOk`), and these floors are
   3 m apart. Change: when the lead kind cannot stand in a room (no ceiling for a brazier, no wall for a sconce),
   `roomLights` takes the next corpus light that can (wall torch, then standing torch) and records it as the room's own
   kind; the one-kind rule counts kinds the building actually places.
4. Principle: a chest belongs at a wall or a bed foot only where it leaves the aisle open (corpus way from a door to a
   stair p50 1.5 to 2.25 m; dormitory chests at a wall 50 %). Rule: the chest at the foot of the bed in
   `lib/rooms_intent.js bedsides` and `placeBeds` (lib/decorate.js). Change: a foot chest only where the aisle past it
   stays 1.5 m or more; otherwise at the wall beside the head.
5. Principle: rugs follow the household plan and the room's kind. The plan drew rug_hare and rug_straw and none was
   placed; `furnishRoom` asks for at most one or two rugs per room (`rugAt` beside two beds), never the kind's count.
   Change: when the plan draws rugs, place the kind's corpus count by area (`countFor(kind, 'rug', room)`: dormitory
   p50 7, bedroom 3, home 6), and report rugs left out.
