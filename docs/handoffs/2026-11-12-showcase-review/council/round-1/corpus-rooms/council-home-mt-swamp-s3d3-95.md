VERDICT: PASS

Seat: corpus rooms (track B). Candidate: home mt swamp s3d3 seed 95 (585 pieces).
Passes at 111 of 115 (97 %; criteria file as written 98 of 100), no hard fail. The best of the four rooms. Faults
to fix by rule: lights at half the corpus count for a home, and a mixed tone between the table's chairs and the rest.

## How it was scored

Same method as the tower file (`council-tower-mt-frankish-norman-s3d3-31.md`, "How it was scored"): my own audit run,
raw records, the views and plan, one generator trace; item 1 over every room of 20 m2 or more, added items 20 (8) and
21 (7), out of 115 with the pass at 92.

## The room as the reader finds it

One L-shaped room of 108 m2 on a raised deck; the reader and the generator both call it a home, focal the fire.
16 floor pieces, 1.48 per 10 m2 (home p50 1.05, p75 1.49); about 8 floor types (home p50 6, p90 9). No part of the
room is more than 4 m from a piece.

- Fire pit at the north wall under a hood, with a kerb of beams and the cauldron over it.
- Table set: piece_table with two piece_chair02 at 0.59 m, both facing it; 2.3 m inside the door.
- Bed in the north-east corner, head at the wall, a stool by its head as a nightstand, a ledge with two stands above
  it.
- Cooking: butcher table at the north wall west of the fire, with a chair02 and a barrel beside it; oven on the west
  wall; prep table in the south-west leg.
- Storage: two chests on the inner wall of the south-west leg, one chest on the west wall, an armor stand in the
  north-west corner.
- Two piece_walltorch (the trace shows `furnishRoom` put up two of the four `lightN` asked for, and the notes say one
  more light was trimmed). No rugs: the household plan drew none (`planBuilding` rugsOn), which the corpus allows (68 %
  of furnished buildings have rugs). Banner piece_banner08 in the plan, none placed.

## Scores

| # | Item | Weight | Score | Measured |
|---|---|---|---|---|
| H1 to H5 | Hard fails | hard | ok | door clear depth 6 m, nearest piece the table at 2.3 m; way to the fire 6 m |
| H6 (proposed) | Planned focal set left out | hard | ok | openWays moved and left out nothing |
| 1 | Purpose and focal | 8 | 8 | home, focal fire |
| 2 | One seat prefab per table | 6 | 6 | chair02 |
| 3 | Seats per table | 5 | 5 | 2 at piece_table (p90 3); no loose seat |
| 4 | Seats face their table | 5 | 5 | turns 0 and 20 degrees |
| 5 | Seats match their table | 6 | 6 | delta E 0 |
| 6 | One tone per room | 4 | 2 | luma spread 52 (target 43): chair02 (fine_furniture) is darker than the plank table, straw bed and chests |
| 7 | No avoided family pairs | 5 | 5 | |
| 8 | Counts per kind | 8 | 8 | 1 table, 4 seats, 1 bed, 3 chests, 2 lights: all at or under home p90 |
| 9 | Few light kinds | 6 | 6 | 1 kind |
| 10 | Repetition caps | 8 | 8 | wood_ledge 2 |
| 11 | Stacked chests | 4 | 4 | none |
| 12 | Beds | 5 | 5 | head at the wall |
| 13 | Work corners | 5 | 5 | no station |
| 14 | Walking lines | 6 | 6 | |
| 15 | Clear zone inside doors | 4 | 4 | |
| 16 | Wall decor offsets | 6 | 6 | |
| 17 to 19 | Planters, clusters, gardens | 9 | 9 | |
| 20 | Furnished for its size (added) | 8 | 8 | 1.48 per 10 m2, no bare part |
| 21 | Lights and rugs (added) | 7 | 5 | lights 2, under the 3 for full marks (home p50 when present 5, lights in 85 % of homes); rugs: none drawn by the plan |

Criteria file as written: 98 of 100 (matches the builder). With the brief's tests: 111 of 115.

## Walking through it

- You climb the stair onto the deck and enter through the south wall of the east part. A small plank table with two
  chairs is just inside on the right, far enough off the door to walk past.
- Ahead and a little left, the fire pit sits under its hood at the back wall with the cauldron over it; the floor
  round it is open. To the right the bed fills the far corner with a stool by its head and a shelf above it.
- West of the fire the butcher table stands at the back wall with a chair and a barrel beside it. The west wall has
  the oven, a chest and an armor stand; the south-west leg of the L has the prep table on its outer wall and two
  chests on its inner wall, with a clear lane between. Cooking and storage keep to the west half, eating and sleeping
  to the east.
- Everything stands where a person can reach it, and each part of the room has a job. It reads as one family's house.
- It is dim for 108 m2: two wall torches and the fire. No rug by the bed or the fire, no banner. The darker chairs
  stand out a little against the pale table and straw bed.
- Tyler's notes on 09 to 12 (a fire just inside the door, chests side by side as a table, a stool alone in the middle
  of the floor, a bed facing the wrong way, cramped ways in): none of these is here.

## Misses, the principle each breaks, and the rule to change

1. Principle: lights to the kind's corpus count. `furnishRoom` asked for four (`lightN`: home p50 when present 5,
   scaled to 108 m2, less one for the fire), `lib/decorate.js placeLights` placed two, and `lib/kitbash.js trimLights`
   trims to a second, separate budget (`lib/decorate.js lightBudget`, drawn from `LIGHT_ROOM` by role with its own
   share of dark rooms). Change: one budget per room, the kind's corpus count from `countFor`, used by both the
   furnisher and `trimLights`; a light that finds no spot is reported, and the next spot type (floor torch, a light on
   the table) is tried before the room is left short.
2. Principle: one tone per room (corpus luma spread p50 0, p75 43). Rule: `planBuilding` chooses the seat by the
   table's corpus partners and the bed and chest by color near the table (`near(id, table, ...)`), but the seat's own
   tone is not held to the bed's and chests'. Here chair02 sits at piece_table in the corpus (it is a real set), so
   the set is right; the spread comes from the room as a whole. Change: when the seat is darker or lighter than the
   table by more than the corpus p75, pick the bed and chests nearer the seat's tone, or the seat nearer theirs, so
   the room's spread stays at or under 43. Low weight; the set itself is corpus-true.
3. Principle: the household's banner color shows where its kind of room has banners (homes 55 %, p50 when present 3).
   The plan names piece_banner08 and no banner was placed in this home, nor in the other three candidates. This is
   the wall-hung seat's to judge on placement; for rooms, the count per kind should come from `countFor(kind,
   'banner', room)` when the plan draws a banner.
