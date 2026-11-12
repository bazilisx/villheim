VERDICT: FAIL

Longhouse, Black Forest, norse-forest, s3d3, seed 208. One T-shaped hall of 180 m2 (main hall 6 m by 24 m, a wing of
about 6 m by 8 m at the back). Several of Tyler's named faults come back almost word for word: a bench set behind
another bench, a fire_pit where a hearth belongs, mixed things on chest tops, and large parts of the hall left bare.

## Scores (judge checklist, see README.md)

| # | Item | Score | Points | Evidence |
|---|---|---|---|---|
| J1 | Rooms have intent | Fail | 0 / 14 | The intent record calls it a feast hall with the high seat as its focal piece. No throne or high seat is built (the plan's throne01 is missing from the piece list). The back wing holds one standing torch and nothing else. The east 10 m of the hall holds a fire_pit on the wall and two chests at the far end. The household's bed, chest, armor stand, stool and barrel are crowded into the west end corner. |
| J2 | Lived in, nothing bare | Fail | 0 / 14 | 24 items in 180 m2: 1.33 per 10 m2 (hall corpus p50 1.76). About 60 m2 of bare floor in the east half and 40 m2 in the wing. Light: two wooden standing torches and the fire for a 24 m hall; the plan lists wall torches and a hanging brazier, none built. Renders `lh-west.png`, `lh-east.png`. |
| J3 | Walkable | Pass | 10 / 10 | The hall is wide; the door's clear zone is open. |
| J4 | Nothing floating or squished | Partly | 4 / 8 | The armor stand (-9.24, -2.0) is wedged between the bed's head and the west wall, about 0.8 m of gap: the "squished to the left" look Tyler named on 14. One wood_beam lies loose on the floor in front of the fire (7.0, 0.85); the note calls it "a kerb of beams round the fire pit", but it is one beam on one side. |
| J5 | No repetition | Partly | 4 / 8 | Two chests side by side on the south wall at the east end (11 and 13, -2.44), the pair seen in the home and smithy too. 13 of 35 stand items are meads. The fire assembly is the home's. |
| J6 | One material family | Pass | 8 / 8 | Plank tables, plank benches, a stool, a barrel, a straw bed: one rustic family. |
| J7 | Pieces where builders use them | Fail | 0 / 6 | The main fire of a Norse longhouse is a fire_pit pushed against the north wall under a hood, while the plan's own purpose line says "at the long fire". Tyler on 06: "why use fire_pit for this area when we could use hearth". The front door is a wood_gate (the yard gate piece). One dragon head on one gable end only; the corpus twins them 86 % of the time (architecture criteria item 13). |
| J8 | Stand items with meaning | Fail | 0 / 6 | The east chest carries a Greydwarf trophy, a Dvergr tankard and two Poison Resist meads; the west chest carries cooked wolf meat with Tasty, Poison Resist and Minor Health meads. This is the "raw fish on a chest next to a raspberry and a poison pot" fault again. The feast table carries 25 things: four Lightfoot meads in one clump, three different tankard kinds (plain, Dvergr, Anniversary), a Shocklate smoothie, stews and bread spread along the whole 10 m. |
| J9 | Sets as builders set them | Fail | 0 / 6 | Four plank tables end to end along the north wall. Three benches on the south side do not line up with the tables, and at the west table a second bench stands 0.7 m behind the first (-4.81, 1.13 and -4.19, 0.42). Tyler on 05: "another log bench and one stool ... slightly farther back". No seat at the head. |
| J10 | Roof and walls complete | Pass | 10 / 10 | T roof with valleys, a chimney box, deep eaves, stone plinth all round (`lh-ext.png`). No gap seen at render scale. |
| J11 | Outside program, greenery | Partly | 2.5 / 5 | Six trees and two dandelions set singly around the house, one fir hard against the front wall by the door. Beech (a Meadows tree) mixed with firs at a Black Forest site. Tyler on 06: "the trees should match ... clusters of the plants too". Window runs are uniform small square openings (good). |
| J12 | One program, plan equals build | Fail | 0 / 5 | Focal "high seat" not built; fire zone says "hearth" and a fire_pit stands there; lights in the plan not built; note "Ways in kept open: 1 pieces moved, 0 swapped for smaller ones, 5 left out". |
| | Total | | 38.5 / 100 | |

## Walking through it

You come up the stone ramp through a gate in the middle of the long front wall. To the left, a long run of tables
against the back wall, with benches on your side only, set at odd offsets, one behind another. The tables are covered
end to end with mugs of three kinds, potions and bowls. Past the tables, in the far corner, a bed, a chest with meat
and potions on it, and an armor stand pressed into the corner behind the bed. To the right, a long empty floor with a
campfire against the back wall and two chests at the far end carrying a Greydwarf head and a tankard among the
potions. Behind you through the wide opening, the wing is an empty room with a torch.

Tyler would see the same hall he described for 05: furniture with no reason to stand where it does, the same drinks
everywhere, and half the building empty. The feast hall has no lord's seat, which is the one thing its own plan says it
is built around.

## Rule changes (for every building, not this one)

1. **The access pass never drops what the room is for.** `lib/layout.js` `openWays` clears blocked lanes by moving
   pieces and, when that fails, leaving out loose things, chests, tables and stations ("5 left out" here; the tower lost
   its watch-room table the same way). The intent record keeps listing them, so every audit that reads the record
   passes a room that no longer has its focal piece. Change: the focal piece and each zone's anchor are never dropped;
   if they cannot be placed with lanes open, `openWays` hands the room back to `rooms_intent.js` `furnishRoom` to
   re-plan it (a smaller set, another wall, another bay) and the intent record is rebuilt from what is placed.
2. **Feast tables are built as one set.** The table run and its seats come from one recipe: benches aligned with each
   table on both long sides (one side only when the run is against a wall), never a seat behind a seat, and the high
   seat at the head placed first. Corpus-rooms item 3 already caps seats per table; add a check for any seat whose
   facing line to its table passes through another seat.
3. **A hall's fire is a hearth in the middle.** For longhouse and hall kinds the long fire stands on the hall's axis
   with seating round it, as the purpose line says; a wall fire under a hood is for homes and kitchens. A kerb is on
   all four sides or none.
4. **One theme per surface, one vessel set per table.** `lib/standitems.js`: a chest top or table takes its items from
   one theme (meal, drink, trophies, apothecary) and one tankard kind per table; resistance potions are apothecary
   items and never meal drink. A trophy goes on a wall stand or a trophy shelf, not among cups.
5. **Every bay of a large room gets a zone.** As in the home: the wing and the empty half are bays with no zone. In a
   feast hall the program has more zones than this one used (high seat, sleeping benches along the walls, store
   corner, drink corner with kegs). The density check in `lib/checks.js` should fail a room under its kind's p25.
6. **Paired carvings.** A carved ridge head on one gable is mirrored on the other (architecture criteria item 13).
