VERDICT: FAIL

# Outside study: council-longhouse-bf-norse-forest-s3d3-208 (round 1)

Score 63 of 100 (pass mark 75). Hard fail H3. Groups: Intent 27 of 37, Palette and light 14 of 20, Clutter 7.5 of 23
(under half), Story 14.5 of 20. Deciding items: H3 (the T wing cut off by the long table), 6, 11, 16, 18.

Checklist: `criteria/outside-study.md`. Measured from the blueprint; renders under `/tmp/council-outside/`
(`lh-plan.png` labeled plan, `lh-v1.png` view from the door side). The builder's scorecard gives this seat 28.5 of 32
and no hard fail; its corpus-rooms H3 also passed. The generator's own walk map disagrees (below).

One room, the feast hall, 180 m2: a hall 24 by 6 m with a T wing 6 by 9 m on its north side. Door at (-1, -3) in
the south wall.

## Hard fails

| # | Result | Measure |
|---|---|---|
| H1 passages | pass | the wing mouth is 6 m wide in the shell |
| H2 door box | pass | 4.6 m clear straight in from the door to the table row (hall p10 4.0 m) |
| H3 reach | **FAIL** | four `piece_table` end to end span x -6.0 to 4.0 at z 1.64 to 2.86. The wing's walls stand at x -2 and x 4, its mouth on the line z 3.0. The table row covers the whole 6 m mouth with 0.14 m to spare, and a bench stands in the mouth at (0.33, 3.37). The wing (54 m2, 30 % of the room) cannot be walked into. The generator saw it: tracing `lib/layout.js` `openWays` on this seed shows it left out the wing's store zone (`piece_chest_wood` at (-1.0, 8.4), `piece_chest_barrel` at (0.5, 8.5) and three stands) instead of opening the way. `intent.json` still lists that store zone. |
| H4 black marble | pass | none |
| H5 outdoor pieces | pass | `wood_dragon1` is on the west gable outside |

## Scores

| # | Item | Wt | Score | Measure |
|---|---|---|---|---|
| 1 | Core set | 7 | 7 | long table and fire |
| 2 | Focal from the door | 6 | 6 | the long table straight ahead in the far half, the best dressed spot |
| 3 | Command position | 4 | 4 | bed head 0.15 m from the south wall, 77 degrees off the door; the corner chair has the north wall 0.65 m behind it |
| 4 | Zones | 6 | 3 | seven zones (fire, table, sitting, gear, bed, east shelves, store chests); each set together |
| 5 | One seat kind per table | 6 | 6 | `piece_bench01` only |
| 6 | Walking lines | 6 | 0 | door to the wing: closed (H3). Door to fire, bed, chests: open |
| 7 | Pull-back and bed sides | 2 | 1 | bench at (-4.81, 1.13) has a second bench (-4.19, 0.42) 0.06 m behind it, both facing the table |
| 8 | Woods | 5 | 5 | one base wood family |
| 9 | Stone, metal, glow | 4 | 4 | stone footing only; no cold glow |
| 10 | Fabric colors | 2 | 2 | none placed (plan lists `rug_hare`, `rug_wolf`, `piece_banner02`) |
| 11 | Light layers | 6 | 0 | the fire pit at (7, 2), a standing torch by the door, a standing torch in the cut-off wing: 0.17 per 10 m2 (corpus 0.2 to 0.6). The west two thirds of the table, the bed, the corner chair, the armor, the east shelves and the store chests are all 4.2 to 11.8 m from a light. The plan's hanging brazier and wall torch were not placed |
| 12 | Light variety | 3 | 3 | two lights of one kind, under 5 |
| 13 | Near its use | 6 | 3 | about 21 food and drink items on the table (by use); 8 drinks and cooked meat on chest lids in the west and southeast corners, away from any table or seat |
| 14 | On a parent | 3 | 0 | the one floor stand (`MeadFrostResist` at (-6.86, -0.91)) is 2.1 m from a wall and by no seat (builder's check agrees) |
| 15 | Hot spots | 5 | 2.5 | four dressed spots; the 10 m table is dressed evenly end to end, with no busy end and no rest |
| 16 | Layers | 3 | 0 | wall (trophies, two ledges) and medium (chests, barrel, armor); no rug, no ceiling layer |
| 17 | Density | 2 | 2 | 18 floor pieces, 1.0 per 10 m2 (feast hall p25 to p75: 0.92 to 2.53) |
| 18 | Repeats | 4 | 0 | Tankard 4, TankardAnniversary 4, Tankard_dvergr 4, MeadLightfoot 4, MeadTasty 3, MeadStaminaMinor 3, MeadPoisonResist 3; most kinds recur on the table, the ledges and chest lids at both ends of the hall |
| 19 | Mid-task scenes | 6 | 3 | one scene (the feast table) where a hall needs two to four; the record counts it four times ("supper" plus three "drinks set out", one per table piece of the same long table). No cooking at the fire pit, so the stew and soup have no source |
| 20 | Who lives here | 6 | 6 | troll armor 1.3 m from the bed, a chest beside it; the corner chair with a mead on its barrel and a deer trophy over it |
| 21 | One story | 4 | 2 | a hunting household that feasts: fits. Off: buff potions (Lightfoot, Poison Resist, Frost Resist, Stamina) served as supper drinks |
| 22 | Clue at the focal, unique piece | 3 | 3 | the Draugr Elite trophy over the long table |
| 23 | Imperfect placement | 1 | 0.5 | 1 of 5 seats turned (0.20) |

## What a person walking through would notice

- You step in from the stone steps and the long table is right ahead, dressed with bread, stew, fish wraps and a crowd
  of mugs. It reads as a feast hall at once. That first read is good.
- Behind the table the T wing opens north, but the table row runs across its whole mouth. A bench sits in the gap
  too. To go in you would climb over the table. Inside, the wing is bare floor with one standing torch.
- Benches stand on the near side of the table only, three of them, and one of those has a second bench jammed right
  behind it. The far side is the wall. Ten meters of table seat about six people, all facing the wall.
- There is no high seat. The intent record names one as the focal point; the generator skipped it.
- The fire pit sits against the north wall east of the table, in a beam kerb, with nothing cooking on it and nothing
  over it.
- The east half of the hall (10 by 6 m) is empty floor. At the far east wall two stacked ledges hold mead and soup,
  with two chests below in the corner carrying more mead and a greydwarf head.
- The west end is the household's corner: the bed, the troll armor, a chest with a supper of wolf meat and three
  meads on its lid, a stool with a barrel and a deer trophy above. This corner has the most life in the house.
- It is dark. Three light sources for 180 m2, one of them in the closed wing.
- The same mugs and potion meads turn up on the table, the ledges and the chest lids at both ends: the "800 lox pies"
  pattern Tyler described, now with tankards and buff meads.

## Rule changes (by principle, for every building)

1. **Ways to every part of a room are reserved before furniture, and a cut-off part fails the building.**
   `lib/decorate.js` `planPaths` routes only from the door to the fire, the stairs and other doors, so a wing with no
   door is never a goal. `lib/rooms_intent.js` `longTable` tests each candidate line only for `room.fits` and a seat
   on each side of the middle table, which the wing mouth supplies. Rule: `planPaths` adds a goal in each wing,
   alcove or bay of the room (cell regions joined to the main floor by a mouth), with lanes 2 m wide; `longTable`
   and `placeTable` reject lines that cross a lane; `longTable` requires seats to fit on both sides along at least
   three quarters of the run. Then: `lib/generate.js` (line 2124) drops `openWays`' return value; any `left` entry
   or any furniture `openWays` leaves out because it is unreachable becomes a failed generator check, so the seed is
   rejected or the rule fixed. Leaving out the wing's furniture made the wing emptier and kept the fault.
2. **Light by zone, with a light kind that can always be placed.** Same rule as the home (zone lights first, focal
   accent, then the corpus count). Add: `lightsIn`'s darkness score counts only cells on walking lines and in zones,
   so a torch never goes to a closed or empty wing; the hanging brazier the plan lists goes over the long table
   (WoW: a hung light over each table), one per 5 m of table.
3. **The intent record is the room as built.** The record says focal "high seat" and zone "fire: hearth"; the room
   has no high seat and a fire pit. `longTable` returns `head: null` and `furnishRoom` leaves `I.focal` as it was.
   Rule: when the head seat fails at one end, try the other end, then the middle of the long side facing the fire
   (Hurstwic high seat); if all fail, set the focal to the table. A final pass after `openWays` and `capBuilding`
   rebuilds `zones` and `focal` from the pieces that stand. The scorecard reads that pass.
4. **Small things repeat only as a set, in one place.** `lib/persona.js` `ITEMS.drink` pools buff meads with drinks,
   and `REPEAT_K.drink` is 1, so drinks repeat freely across surfaces. Rule: a table set takes one vessel kind (a row
   of one tankard kind) and one or two dishes; buff meads go only to a potion shelf or cabinet as their own set; per
   room a stand item kind appears in at most one place outside its set; chest lids take items only as part of a set
   beside them (bedside, head chair).
5. **A hall's seating faces its center.** Benches along both long sides of a table placed down the hall's middle, or
   benches along the long walls facing a long fire (Hurstwic; corpus feast halls p50 10 seats). Rule: `longTable`
   scores lines by distance from the long walls (seats on both sides), and the feast hall's fire goes on the long
   axis when the hall is 6 m wide or more, so the fire and table form one zone.
6. **One scene counts once.** `vignettes` loops over `o.tables.slice(1)` and adds "drinks set out" for each table
   piece of the long table. Rule: tables joined in one run count as one table for scenes; the other scenes come from
   other zones (the head's chair by the fire, a bar end, a trophy bay, a mending corner).
