VERDICT: PASS

Seat: corpus rooms (track B). Candidate: longhouse bf norse-forest s3d3 seed 208 (518 pieces).
Passes at 101.5 of 115 (88 %; criteria file as written 98 of 100), no hard fail. It passes with four faults to fix
by rule: a bench set behind another bench, half the long table without seats, the T wing emptied, and too few lights
and no rugs for a 180 m2 hall.

## How it was scored

Same method as the tower file (`council-tower-mt-frankish-norman-s3d3-31.md`, "How it was scored"): my own audit run,
raw room records, the views and plan, one generator trace; item 1 over every room of 20 m2 or more, and the added
items 20 (furnished for its size, 8) and 21 (lights and rugs, 7), out of 115 with the pass at 92.

## The room as the reader finds it

One room, 180 m2 (nave about 23 by 6 m plus a T wing about 6 by 6 m). The generator calls it a feast hall with a high
seat as its focal. The reader calls it an open-plan home (a bed and a fire), focal the fire pit. 16 floor pieces, 0.89
per 10 m2 (home p25 0.75, p50 1.05; feast hall p25 0.92, p50 1.21). Share of floor more than 4 m from any floor piece:
0.13 (corpus rooms of 120 to 400 m2 with furniture: p50 0.17, p75 0.38).

- Long table: four piece_table end to end against the north wall, x -4.75 to 2.78. Seats: piece_bench01 at
  (-4.81, 1.13) and at (0.21, 1.13) on the near side, one at (0.33, 3.37) on the far side in the mouth of the T wing,
  and one at (-4.19, 0.42), 0.7 m behind the first bench (gap to the table 1.22 m). The two east table pieces have no
  seat. Trace: `openWays` moved that bench from (-2.30, 1.13), where it sat at the second table piece.
- Fire: a hearth placed by `furnishRoom`, a fire_pit in the blueprint at (7, 2) by the north wall, with a kerb.
- West end: bed (head at the wall), a stool, a barrel, an armor stand and a chest at the bed foot.
- East end: two chests at the end wall under two wood_ledge shelves.
- T wing: empty. Trace: `openWays` left out its store (piece_chest_wood and piece_chest_barrel at z 8.44 with three
  itemstandh).
- Lights: two piece_groundtorch_wood. The plan names piece_walltorch as the lead light with the brazier and the
  standing torch; no wall torch or brazier was placed. Rugs: the plan drew rug_hare and rug_wolf; none placed.
- 52 itemstandh with drinks and food on the table and shelves (at the corpus feast hall p90 of 55 item stands; the
  stand seats judge what is on them).

## Scores

| # | Item | Weight | Score | Measured |
|---|---|---|---|---|
| H1 to H5 | Hard fails | hard | ok | no halls or wings under 3.9 m; door clear depth 3.75 m, nearest piece 3.68 m; way to the fire 3.75 m |
| H6 (proposed) | Planned focal set left out | hard | ok | the long table stands; the intent's "high seat" was never placed (see 4 below) |
| 1 | Purpose and focal | 8 | 8 | reads as home, focal fire pit (corpus feast hall focal is a table in over half: piece_table 24 %, oak 21 %, round 11 %) |
| 2 | One seat prefab per table | 6 | 6 | bench01 only |
| 3 | Seats per table | 5 | 5 | in range; two table pieces unseated (noted under walk-through) |
| 4 | Seats face their table | 5 | 2.5 | all turned to the table, but one bench sits behind another and cannot reach it (audit gives 5) |
| 5 | Seats match their table | 6 | 6 | delta E p50 0.4 |
| 6 | One tone per room | 4 | 2 | luma spread 52 |
| 7 | No avoided family pairs | 5 | 5 | |
| 8 | Counts per kind | 8 | 8 | as a home 4 tables is over p90 2 (the one allowed); as a feast hall 4 table pieces, 5 seats |
| 9 | Few light kinds | 6 | 6 | 1 kind |
| 10 | Repetition caps | 8 | 8 | |
| 11 | Stacked chests | 4 | 4 | none |
| 12 | Beds | 5 | 5 | head at the wall |
| 13 | Work corners | 5 | 5 | none |
| 14 | Walking lines | 6 | 6 | |
| 15 | Clear zone inside doors | 4 | 4 | |
| 16 | Wall decor offsets | 6 | 6 | 92 % within corpus offsets |
| 17 to 19 | Planters, clusters, gardens | 9 | 9 | no planters; trees and one flower outside |
| 20 | Furnished for its size (added) | 8 | 4 | density between home p25 and feast hall p25; the 34 m2 T wing has no purpose after openWays took its store |
| 21 | Lights and rugs (added) | 7 | 2 | 2 lights (home or feast hall needs 3 for full); rugs drawn by the plan, none placed |

Criteria file as written: 98 of 100 (matches the builder). With the brief's tests: 101.5 of 115.

## Walking through it

- You come up the stone steps into the middle of the long south wall. The hall is wide and open; nothing crowds the
  door.
- To the left a long plank table runs along the north wall with mugs and food on it. A bench is pulled up at the near
  side of the first table piece, and a second bench stands right behind it, so whoever sits there faces someone's back.
  The middle of the table has a bench on each side; the two pieces nearest the fire have drinks set out and nowhere to
  sit.
- The fire pit sits against the north wall just east of the T wing, under its hood. Between the fire and the east end is open
  floor, then two chests under two shelves at the end wall.
- The far west end is a sleeping corner: straw bed with its head at the wall, armor stand, chest, stool, barrel. That
  makes the hall a lived-in longhouse with one bed, which the corpus calls a home.
- The T wing opening off the table is an empty room about 6 by 6 m with one standing torch.
- Two standing torches and the fire light 180 m2. No rugs, no banners, no wall torches.

Compared with Tyler's notes on showcase 05 (two tables side by side, mixed seats, eight log benches, black marble
among rustic furniture), this is one table run with one seat prefab and one tone: those faults are gone.

## Misses, the principle each breaks, and the rule to change

1. Principle: a seat belongs to its table's seating line; a seat that cannot stay there goes, it never moves to a spot
   with no use. Rule: `lib/layout.js openWays` (`tryMove` with `spotsFor`) moves a seat anywhere that opens a lane, here
   to 0.7 m behind another bench. Change: for a seat in a table set (`tagSet` 'table'), allowed spots are only the
   free places along its own table's sides at the corpus offset (0.43 m off the table box, `sets.json`); none free,
   the seat is left out. The same rule for a nightstand at its bed and an extension at its station.
2. Principle: the way-clearing pass may not empty a part of a room the furnisher gave a purpose. Rule: `openWays`
   left out the T wing's chest, barrel and stands. Change as in the tower file: keep zone sets, try a smaller set at
   the same wall, and furnish again any part of a room of 20 m2 or more left with no piece within 4 m.
3. Principle: a long table is seated along its length (corpus feast halls p50 10 seats, p90 21, and one seat prefab).
   Rule: `lib/rooms_intent.js longTable` places the run; seats lost to the wall side are not made up elsewhere. Change:
   when one side of the run is against a wall, seat the open side fully (one bench per table piece) and leave the wall
   side empty, or pull the run off the wall by the seat depth; never leave table pieces with food and no seat.
4. Principle: the intent record states what was built. `intentOf` sets focal "high seat" for every feast hall, and the
   throne is skipped when the hall has two or more tables (`furnishRoom`, feast hall branch). Change: the focal of a
   feast hall without a throne is its long table; write the record from what was placed.
5. Principle: lights and rugs to the kind's corpus count. `furnishRoom` asked about 5 lights (`lightN` from
   `countFor('feast hall', 'light')`), `placeLights` put up two standing torches, and the plan's wall sconce never went
   up; one rug at most is asked for (`rugAt(tables[0], 'under')`, which placed nothing here). Change: as in the
   tower file, one light budget (the kind's corpus count) used by both `furnishRoom` and `lib/kitbash.js trimLights`,
   and rugs placed to `countFor(kind, 'rug', room)` when the plan draws rugs (feast hall p50 when present 6).
