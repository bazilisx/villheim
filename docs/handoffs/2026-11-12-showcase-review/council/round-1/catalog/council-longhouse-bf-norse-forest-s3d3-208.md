VERDICT: PASS

Seat: catalog (track A). Checklist: `docs/handoffs/2026-11-12-showcase-review/criteria/catalog.md`.
Score: 78 of 93 measured weight (83.9 %), pass mark 80 %. No hard fail. A narrow pass: items 6, 12 and 16 lose points,
and the record of the room does not match what is built.
Item 5 is left out of the total (no approved buildings yet; preview in the home file).

## Scores

Measured with `lab/council_checks.js` (re-run), `lib/catalog.js`, my piece list with positions, track B
`data/rooms-corpus/kinds.json`, and renders from the blueprint (views.png, four exterior views, two interior views cut
at 3.4 m; files in `/tmp/council-catalog/`).

| # | Weight | Score | Measured | Note |
|---|---|---|---|---|
| H1 | hard | pass | one carved dragon head, outside on the west gable end at 7.3 m | |
| H2 | hard | pass | the bed's headboard on the south wall | |
| H3 | hard | pass | 3 wall item stands, backs to the wall | |
| 1 | 10 | 10 | 4 of 4 seats at the tables are plain plank benches with the plain plank table | |
| 2 | 8 | 8 | all large furniture rustic | |
| 3 | 8 | 8 | no rarely-with pair | |
| 4 | 8 | 4 | over `catalog.cap` at 144 m2: table 4 (cap 2), bench 4 (cap 2), flat stand 35 (cap 33) | tables and benches are within the corpus feast hall (tables p50 3, p90 5; seats p90 21, kinds.json), so only the 35 flat stands count as over |
| 5 | 7 | not scored | | |
| 6 | 7 | 3.5 | the hall's fire is a fire pit with a kerb of beams under a wooden hood | corpus: the stone hearth stands in longhouses at lift 3.1 (54 builds), the fire pit at lift 3.8 in starter homes. The builder's script passed this item because a foundation stone (`stone_wall_2x1`, 0.6 m below the fire) lies within 1.6 m; that stone is the plinth, not a hearth |
| 7 | 6 | 6 | 0 rare kinds; 2 wood ledges stacked as a two-shelf rack on the east wall with drinks and soup | D-166: a use is there |
| 8 | 6 | 6 | 1 carving, on the gable | |
| 9 | 6 | 6 | stone plinth, plank walls, thatch | plank/stone lift 1.14, stone/thatch 1.20 |
| 10 | 6 | 6 | | |
| 11 | 5 | 5 | | |
| 12 | 5 | 2.5 | no pots; the drinking vessels on the long table are four looks mixed: plain tankard 4, anniversary tankard 4, Dvergr tankard 4 | the item reads the containers-in-sets rule onto items on stands; a Dvergr tankard is Mistlands ware in a Black Forest hall |
| 13 | 5 | 5 | wall stands 1.25 and 2.15 m above the floor | |
| 14 | 4 | 4 | | |
| 15 | 4 | 4 | no wood_fence | |
| 16 | 5 | 0 | see below | |

Item 16, the record against the building: `intent.json` names one room, "feast hall, focal high seat", with a fire zone
"hearth". Built: no high seat (no throne, no head chair at the long table), a fire pit in place of the hearth, and a
straw bed in the hall's west end that the record does not list. Corpus feast halls hold no bed (0 of 86 rooms,
kinds.json). The 35 m2 north wing is a second room with nothing in it but a standing torch, and no record.

## What a person walking through would notice

- A long plank hall on a stone plinth, thatch roof with deep eaves and a carved dragon head on the west gable. All one
  wood tone inside. It looks of a piece.
- One long feast table of four plank tables end to end across the mouth of the north wing, benches of the same wood.
  Seats are thin for a table 10 m long: four benches, and two of them stand one behind the other at the west end, so
  the back one faces a bench.
- The table is crowded with flat stands: 35 in the building, 21 on the long table, five of them within half a meter
  of each other at one spot. The same drinks come back again and again: four Lightfoot meads, four of each of three
  tankards, three poison-resist meads (one pair side by side on a chest in the south-east corner).
- No high seat. The far end of the hall, where a person would look for it, has a straw bed, an armor stand in troll
  armor, a chest, a barrel with a mead on it, and a stool.
- The east half of the hall is empty but for the fire at the north wall and two chests in the south-east corner; about
  10 by 6 m of bare floor.
- The north wing (35 m2) is empty.
- Light: two wooden standing torches for a hall of 110 m2 plus the wing. The plan named a wall sconce lead with a
  hanging iron brazier; neither was built.
- A boar, a greydwarf, a draugr elite and a deer trophy; the greydwarf trophy lies on a chest on a flat stand.

## Misses: principle, rule, change

1. **The plan and the record are written before later passes change the building.** The intent is recorded in
   `lib/decorate.js` (the report at the end of furnishing) and `lib/rooms_intent.js furnishRoom` (`zone()`, and the
   fixed `FOCAL` map in `intentOf`). After that, `lib/generate.js settle` swaps the hearth for a fire pit,
   `lib/layout.js openWays` drops pieces ("5 left out"), `lib/kitbash.js trimLights` and `trimRugs` drop lights and
   rugs, and the fallback in `decorate.js` ("a house always has at least one bed") adds a bed. Nothing rebuilds the
   record. Change: rebuild each room's intent from the finished blueprint after the last pass (focal and zones from
   the pieces that stand), and add a generator check in `lib/checks.js`: a room whose recorded focal piece is missing,
   or whose plan lead light is missing, fails, so the room is furnished again. Applies to every building.
2. **The high seat is dropped when the long table cannot take a head.** `rooms_intent.js furnishRoom` skips the
   throne in a feast hall with two or more tables and leaves the head to `longTable`; `longTable` picks the table line
   by fit and only then tries the head seat at the far end. When the head does not fit, the hall has no focal. Change:
   `longTable` accepts a line only where the head seat also fits at its far end, and tries one table fewer before it
   gives up the head; if no line keeps the head, the throne is placed by the wall as in throne halls.
3. **The fallback bed goes into any room.** `decorate.js` puts the one guaranteed bed in the largest furnished room,
   here the feast hall. Change: the fallback tries rooms whose kind holds beds in the corpus (`kinds.json`
   `counts.bed.has` above 0: bedroom, dormitory, home) and unfurnished side rooms first (here the empty north wing);
   never a feast hall, kitchen, smithy or storage room.
4. **The vent decides the fire.** As in the home: `lib/generate.js settle` turns a hearth under a hood into a fire pit.
   `furnishRoom fireKind` asked for a hearth in this hall ("tavern or hall: hearth"). Change as in the home file: the
   vent is chosen and sized for the fire.
5. **Items on stands repeat and mix looks.** `lib/standitems.js itemOf` lets a drink repeat in a row and treats all
   tankards as one kind (`kindOf`: /^(Tankard|Horn)/), so three tankard looks share one table. Change: a table set
   takes one vessel look (the household's), the catalog's containers-in-sets rule extends to stand items, and an
   item's biome is at most one past the building's biome (as `lib/pieces.js decorOk` does for pieces).
6. **Caps** (item 4): the same capOf change as in the home file. The 35 flat stands pass the generator's cap of 54.9.

## Checks run

- `lab/council_checks.js`: catalog 78 of 82, no hard fail. My score differs on 6 (the plinth stone counted as a
  hearth), 12 and 16.
- Fire surroundings listed piece by piece within 2.2 m: one `stone_wall_2x1` 1.0 m away and 0.6 m down (plinth),
  beams of the kerb, wood half walls of the hood from 2.9 m up.
- Stand items counted from the blueprint text.
- All renders read.
