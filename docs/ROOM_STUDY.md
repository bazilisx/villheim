# Room study: how corpus builders lay out rooms

Track B of the showcase review (2026-11-12, `docs/handoffs/2026-11-12-showcase-review/README.md`). Tyler asked for
the corpus to be read for "how many typical benches are in different types of rooms. How many tables. How many
different types of furniture... Consider the logic of the room", and for "exactly how the designers weaves differnt
materials together and how they pair sets of tables and chairs, or benches, etc. and what furniture they use in
specific rooms, and how they make custom furniture for different rooms" (TYLER_NOTES.md). Everything below is measured
from the corpus. The numbers are targets for the furnishing rewrite (track E) and for the council's checks
(`docs/handoffs/2026-11-12-showcase-review/criteria/corpus-rooms.md`).

Status: first draft of the numbers (2026-11-12). Sections marked "to refine" are being checked against renders.

## Data and method

- Source: `compact.json`, 2,128 builds (valheimians downloads). 1,520 are vanilla: every prefab is in the game's
  bundles (`vhmodels/work/index.json`, 5,936 prefabs) and none matches a mod prefix. Only vanilla builds are used.
- Rooms: each build is turned so its walls run along x and z, then read floor by floor with the decorator's own room
  reader (`lib/decorate.js` `floorLevels`, `readLevel`): floor cells on a 0.5 m grid, split by walls and doors. A room
  of the study has half or more of its floor under a roof and 4 to 400 m2 of floor, and no mod piece inside: 20,400
  rooms. Floor furniture is a furniture piece whose pivot is under 0.5 m over the room's floor.
- Room kinds come from the floor furniture (rules in `lab/rooms_corpus_stats.js` `kindOf`, after
  `lab/mine_room_templates.js` `classify`, with more kinds): smithy (a forge, smelter, kiln or refinery), dormitory
  (3 or more beds), bedroom (beds, no fire, few seats), home (beds with a fire or a table set: the one-room or open-plan
  house), throne hall, workshop, kitchen, storage, feast hall (8 seats or 3 tables; tavern hall when the build is a
  tavern), dining (a table with 2 or more seats), hearth room, bath, shrine, display (stands only), corridor (long, at
  most one piece), sitting, empty, other.
- Weighting: every count is given over all rooms and over rooms in liked builds, the top quarter of vanilla builds by
  votes (380 builds, 10 votes or more). The corpus has no Tyler verdicts (`verdict` is empty in compact.json). Liked
  builds are larger on average, so they hold 11,945 of the 20,400 rooms; per-build numbers below count each build once.
- Material families: a first cut by prefab (`lab/rooms_corpus_lib.js` `FAMILY_PREFAB`), labeled as such in every
  output, until track A's catalog (`data/catalog/pieces.json`) exists; the scripts read the catalog when it is there.
  Where families are uncertain the prefab pairs are given, which do not depend on the labels.
- Showcase: the 16 showcase designs are made again with the lab exactly as `vh gen showcase` makes them
  (`lab/rooms_corpus_showcase.js`, one try of each seed) and read with the same scripts.

Commands (scratch output in /tmp holds blueprint content and stays out of the repo):

```
python3 -c "import json;[print(json.dumps(b)) for b in json.load(open('/home/claude/study/compact.json'))]" > /tmp/corpus-rooms/compact.jsonl
node lab/rooms_corpus_extract.js /tmp/corpus-rooms/compact.jsonl /tmp/corpus-rooms/all
node lab/rooms_corpus_showcase.js /tmp/corpus-rooms/showcase.jsonl && node lab/rooms_corpus_extract.js /tmp/corpus-rooms/showcase.jsonl /tmp/corpus-rooms/show
node lab/rooms_corpus_stats.js /tmp/corpus-rooms/all data/rooms-corpus --showcase /tmp/corpus-rooms/show --compact /tmp/corpus-rooms/compact.jsonl
node lab/rooms_corpus_gardens.js /tmp/corpus-rooms/compact.jsonl /tmp/corpus-rooms/all data/rooms-corpus/gardens.json --showcase /tmp/corpus-rooms/showcase.jsonl /tmp/corpus-rooms/show
node lab/rooms_corpus_render.js <compact.jsonl> <builds.jsonl> <file> <cx> <cz> <floor y> <radius> <out.png>
```

Outputs in `tools/blueprint-lab/data/rooms-corpus/`, each with a `fields` entry: `kinds.json` (per room kind: size,
focal point, counts, seat and light kinds), `sets.json` (table sets, beds, work corners, counters, custom furniture),
`materials.json`, `caps.json` (repetition per build and per room, with the showcase), `space.json` (halls, door zones,
walking lines), `walls.json` (wall decor), `pairs.json` (co-occurrence of every pair of items), `gardens.json`
(window planters, plant clusters, gardens) and `examples.json` (example rooms of each kind in liked builds).

## What was reused, and what was missing or wrong

- Reused: the decorator's room reader (`lib/decorate.js` readLevel and roomModel: cells, wall faces with door, window
  and open runs, doors, stairs, ceiling), its box helpers (`obox`, `ptDist`), piece sizes and roles from
  `lib/pieces.js`, the build turn and room kind rules of `lab/mine_room_templates.js`, the culture lists in
  `data/culture-corpus/members.json`, the facts already in `docs/INTERIOR_DESIGN.md` "What builders do".
- `lab/mine_room_templates.js` keeps only clean rooms of the top builds (464 templates) and drops a room for one
  clipping or askew piece, so it cannot give counts per kind. The study reads every room instead.
- `lib/pieces.js` gives `piece_workbench_ext1` to `ext4` (chopping block, tanning rack, adze, tool shelf) the role
  `seat`. Any count of seats from that role includes them. The study uses its own type table
  (`rooms_corpus_lib.js` `TYPE`).
- `lib/pieces.js` `mat` marks `piece_chair03` as wood; its mesh material is `Darkwoodchair_material`.
- `lib/pieces.js` treats `piece_cloth_hanging_door` (the drapes) as a structural door, so the room reader takes a
  drape for a door. The study counts drapes on walls and in doorways.
- `lab/layout_measure.js` measures generated designs only. Its lane width is not comparable with the corpus because
  the corpus was not measured with it; `space.json` gives the corpus side.
- The data in `data/room-layouts.json`, `data/room-templates.json` and `data/kitbash-interior-fine.json` are clean
  subsets; their rates are not corpus rates.

## 1. Room kinds, purpose and focal point

Rooms of the study by kind (rooms / builds, floor m2 p50), and the focal piece (share of rooms):

| Kind | Rooms / builds | Area p50 | Focal piece |
|---|---|---|---|
| bedroom | 559 / 287 | 36 | dragon bed 45 %, bed 37 %, ashwood bed 16 % |
| dormitory | 61 / 53 | 144 | ashwood bed 41 %, bed 31 %, dragon bed 28 % |
| home (beds with a fire or table) | 201 / 167 | 129 | table 23 %, round table 22 %, hearth 21 %, fire pit 9 % |
| dining | 104 / 84 | 68 | round table 43 %, table 39 %, oak table 8 %, black marble table 7 % |
| feast hall | 86 / 64 | 108 | table 24 %, oak table 21 %, round table 11 % |
| tavern hall | 31 / 22 | 171 | counter 39 %, hearth 23 %, round table 19 % |
| throne hall | 178 / 147 | 117 | raven throne 62 %, black marble throne 16 %, stone throne 15 % |
| hearth room (a fire alone) | 177 / 126 | 12 | hearth 61 %, fire pit 14 %, iron fire pit 12 % |
| kitchen | 313 / 237 | 18 | fermenter 49 %, oven 15 %, butcher table 8 %, iron cooking station 8 % |
| smithy | 280 / 216 | 77 | forge 48 %, black forge 27 %, kiln 10 % |
| workshop | 223 / 174 | 36 | workbench 58 %, cartography table 12 %, galdr table 10 % |
| storage | 882 / 282 | 11 | wood chest 48 %, black metal chest 23 %, reinforced chest 21 % |
| bath | 45 / 38 | 43 | bathtub |
| shrine | 121 / 22 | 66 | none on the floor: statues and stands |

How the rest orients to it (`kinds.json` seatsFacingFocal, `sets.json`):

- Beds stand with the head (local -z) at a wall: 78 % of bedroom beds, 62 % in homes, 61 % in dormitories.
- Seats at a table face it: at every table prefab the most common turn between the seat's yaw and the bearing to the
  table is 0 degrees (piece_chair02 131 of 263 seats at a piece_table, piece_chair03 430 of 517 at an oak table).
  Stools (`piece_chair`, `dvergrprops_stool`) have no front; they stand at 90 or 270 as often as 0.
- Seats away from a table, within 8 m of the focal piece: 35 % to 57 % of them turn within 30 degrees of the most
  common turn toward it (bedroom 38 %, home 36 %, throne hall 44 %, hearth room 57 %).
- Stations with the pivot under 0.6 m from a wall face: workbench 31 %, forge 46 % (to refine: measured from the
  pivot, not the back).

## 2. Counts per room kind

Share of rooms with one or more / p50 when present / p90 when present (`kinds.json` counts). Lights include wall and
floor lights; drapes, banners, shelves and stands are those on the room's walls.

| Kind | Rooms / builds | Area | Tables | Seats | Beds | Chests | Barrels | Lights | Drapes | Banners | Rugs | Shelves | Pots | Item stands | Floor types p50 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bedroom | 559 / 287 | 36 | 0.23/1/1 | 0.52/1/2 | 1.00/1/2 | 0.56/1/4 | 0.05/1/3 | 0.71/2/7 | 0.26/4/10 | 0.37/2/4 | 0.64/3/11 | 0.05/2/99 | 0.06/1/3 | 0.29/4/22 | 3 |
| dormitory | 61 / 53 | 144 | 0.51/1/2 | 0.61/4/5 | 1.00/4/7 | 0.62/4/9 | 0.05/5/7 | 0.92/4/11 | 0.26/8/39 | 0.57/4/8 | 0.85/7/28 | 0 | 0.08/2/3 | 0.36/3/18 | 3 |
| home | 201 / 167 | 129 | 0.74/1/2 | 0.90/4/11 | 1.00/1/3 | 0.81/2/8 | 0.10/2/6 | 0.85/5/12 | 0.28/6/18 | 0.55/3/7 | 0.91/6/22 | 0.05/15/42 | 0.10/3/7 | 0.54/5/36 | 6 |
| dining | 104 / 84 | 68 | 1.00/1/2 | 0.99/4/6 | 0 | 0.36/2/3 | 0.08/1/3 | 0.75/3/8 | 0.21/3/12 | 0.33/2/8 | 0.74/3/9 | 0.09/4/10 | 0.06/3/3 | 0.42/10/44 | 3 |
| feast hall | 86 / 64 | 108 | 0.83/3/5 | 0.83/10/21 | 0 | 0.29/2/4 | 0.08/3/9 | 0.78/5/13 | 0.23/4/9 | 0.31/4/9 | 0.57/6/18 | 0.06/6/86 | 0.13/4/6 | 0.51/12/55 | 3 |
| tavern hall | 31 / 22 | 171 | 0.97/2/5 | 1.00/12/30 | 0 | 0.23/4/8 | 0.39/3/5 | 0.90/9/25 | 0.23/5/14 | 0.45/2/31 | 0.90/8/22 | 0.10/73/136 | 0.26/3/7 | 0.74/29/64 | 4 |
| throne hall | 178 / 147 | 117 | 0.75/1/4 | 0.69/4/13 | 0 | 0.47/3/10 | 0.08/3/6 | 0.84/4/15 | 0.27/5/13 | 0.57/3/8 | 0.86/5/22 | 0.04/2/15 | 0.10/2/6 | 0.55/9/42 | 4 |
| kitchen | 313 / 237 | 18 | 0.10/1/1 | 0.12/2/4 | 0 | 0.28/2/6 | 0.11/2/9 | 0.45/2/7 | 0.06/2/11 | 0.13/2/6 | 0.28/3/10 | 0.02/8/99 | 0.02/2/2 | 0.31/8/42 | 2 |
| smithy | 280 / 216 | 77 | 0.17/1/2 | 0.23/2/6 | 0 | 0.51/4/12 | 0.06/3/8 | 0.70/4/10 | 0.08/2/11 | 0.23/2/7 | 0.46/4/14 | 0.03/5/11 | 0.05/2/8 | 0.33/8/50 | 4 |
| workshop | 223 / 174 | 36 | 0.09/1/1 | 0.20/2/3 | 0 | 0.30/3/9 | 0.07/3/6 | 0.57/3/7 | 0.10/3/12 | 0.13/2/4 | 0.39/2/13 | 0.01/8/10 | 0.03/1/2 | 0.26/4/19 | 2 |
| storage | 882 / 282 | 11 | 0.03/1/2 | 0.04/2/4 | 0 | 0.97/4/10 | 0.07/3/9 | 0.29/2/7 | 0.02/2/6 | 0.07/2/4 | 0.11/2/10 | 0/1/4 | 0.01/4/8 | 0.14/4/17 | 1 |
| bath | 45 / 38 | 43 | 0.16/1/1 | 0.24/1/2 | 0 | 0.07/1/3 | 0 | 0.60/1/5 | 0.18/4/9 | 0.27/2/6 | 0.51/2/6 | 0.02 | 0.02/1/1 | 0.29/5/14 | 1 |

Read as rules (p50 when present, p90 as the cap):

- A bedroom has one bed (p90 two), one seat, a chest in half of them (one), two lights, a rug in two of three. A
  table in one bedroom in four. Three floor furniture types.
- Dining rooms: one table (p90 two) with four seats (p90 six). Feast halls: three tables (p90 five) and ten seats
  (p90 21). A second table stands in a dining room only one time in five.
- Homes (open plan with beds and a fire or table): one table (p90 2), four seats (p90 11), one bed (p90 3), two chests
  (p90 8), five lights, six rugs. Six floor furniture types: the open-plan house mixes the most kinds.
- Kitchens are small (18 m2) and hold two floor types; fermenters, ovens and the butcher table are their focal.
- Storage rooms (11 m2) hold four chests (p90 10) and one floor type.
- Seat kinds by room (`kinds.json` seatKinds): dining 77 % chairs, 14 % benches, 6 % stools, 3 % log benches;
  bedroom 44 % chairs, 44 % stools; feast hall 42 % chairs, 39 % stools, 19 % benches; tavern hall 75 % chairs.
  Log benches are 0 to 12 % of seats in every kind; they are most common by a hearth (12 %) and in portal rooms.

## 3. Sets as geometry

Table sets (`sets.json` tableSets; a seat belongs to the nearest table within 1.25 m of its box):

| Table | Tables | With seats | Seats p50 / p90 | One seat prefab | Main seats | Heads used |
|---|---|---|---|---|---|---|
| piece_table | 640 | 419 | 2 / 3 | 86 % | chair02 42 %, chair03 24 %, bench01 17 %, stool 11 % | 30 % |
| piece_table_round | 358 | 323 | 3 / 5 | 93 % | chair03 86 %, raven throne 6 % | 73 % |
| piece_table_oak | 126 | 103 | 7 / 10 | 76 % | chair03 83 %, bench01 6 %, raven throne 4 % | 52 % |
| piece_blackmarble_table | 121 | 65 | 2 / 4 | 99 % | chair03 60 %, black marble bench 22 %, black marble throne 10 % | 39 % |
| dvergrprops_table | 72 | 32 | 1.5 / 4 | 94 % | dvergr stool 85 % | 3 % |

- One seat prefab per table in 76 % to 99 % of sets. Mixed seats at one table are the exception; the mixed sets seen
  most often add a raven throne to chairs.
- Seat distance: a side seat's pivot sits 0.43 m (p50; p10 0.03, p90 0.74) from the table's box at a piece_table,
  0.29 m at a round table, 0.46 m at an oak table. The middle line to a side seat: 1.04 m at piece_table (p25 0.86,
  p75 1.21), 1.52 m at a round table, 1.39 m at the oak table.
- Heads: seats at the ends sit 0.6 m (piece_table) to 0.74 m (oak table) from the box; round tables use all sides.
- Turn: 0 degrees to the table is the rule for every chair and bench prefab; turns of 15 to 45 degrees are the next
  most common (chair02 at 45 in 33 of 263 seats), so a seat pushed out at an angle is a pattern, at about one seat in
  six.
- Combos seen most: 1 or 2 chair02 at a piece_table; 2 to 4 chair03 round a round table; 6 to 10 chair03 along an oak
  table; 2 black marble benches at a black marble table; 1 to 4 dvergr stools at a dvergr table.

Beds (`sets.json` beds; 1,289 beds):

- Head against a wall: dragon bed 74 %, bed 62 %, ashwood bed 76 %.
- Beside the head (nightstand place): a seat at 25 % of dragon beds and 23 % of beds, most often a stool
  (piece_chair, 217 times at dragon beds), a building piece as a side table (wood_floor_1x1 139 times, wood_beam,
  wood_wall_half), a light at 21 % (37 % at ashwood beds, mostly candles and lava lanterns), a chest at 13 %.
- At the foot: a chest at 15 % to 18 %; rugs at the foot and the foot sides at 47 % to 49 % of dragon beds.
- Item stands and signs over the head are common at dragon beds (206 item stands behind the head).

Work corners (`sets.json` work; within 4 m of the station):

- Forge (231): the forge extensions stand beside it, one of each: cooler (ext6) behind or beside at 0.6 m, 68 %;
  ext5 1.7 m beside 61 %; ext2 (the anvils on a log) 1.85 m beside 60 %; ext1 1.6 m 58 %; ext4 (the big anvil on a
  stump) 2.25 m beside 50 %; ext3 2.4 m beside 47 %. 86 % to 94 % of each are beside, under 7 % in front. A wall
  torch beside the forge in 28 %, a wood chest beside in 23 %.
- Workbench (399): chopping block (ext1) beside at 1.95 m in 43 %, tool shelf (ext4) behind at 0.7 m in 40 %, tanning
  rack (ext2) beside at 2.4 m in 36 %, adze (ext3) beside 2.5 m in 22 %; one of each. Chests beside at 2.4 m in 25 %.
- Extensions never stand in front of their station more than 7 % of the time.

Counters and bars (`sets.json` bars, to refine): runs of building pieces with tops 0.8 to 1.4 m over the floor, 2 m or
longer. Counter tops sit at 1.02 m (p50; p10 0.88, p90 1.27). The common counter pieces are wood_floor_1x1 (788),
grausten floor 1x1 (386), wood_beam_1 and wood_beam (500), wood_wall_half (134). Most such runs stand against a wall
(worktops, chest shelves); free-standing bars with a walk-in space behind them are being separated.

Custom furniture (`sets.json` custom, to refine): the most used are wood_floor_1x1 at table and shelf height over or
beside chests (shelves over chest rows, 242 builds), wood_beam at table height, wood_wall_half at seat height (bench
seats along walls and hearths), wood_floor_1x1 beside a bed head (nightstand, 139 dragon beds and 108 beds).

## 4. Material cohesion

`materials.json`, prefab first cut of families; prefab pairs below do not depend on the labels.

- Table sets: 86 % to 99 % of sets use one seat prefab. The seats builders put at each table: piece_table with
  chair02 (42 %) or chair03 (24 %) or bench01 (17 %); round table with chair03 (86 %); oak table with chair03 (83 %);
  black marble table with chair03 (60 %) or black marble bench (22 %); dvergr table with dvergr stools (85 %).
- piece_bench01 at a black marble table: 1.4 % of its seats (139 seats). Black marble benches at wooden tables: none
  at piece_table, 0.2 % of seats at round tables, 0.6 % at oak tables.
- Rooms with two or more family-tagged pieces (tables, seats, thrones, beds, chests; 2,853 rooms): one family in 60 %,
  two in 23 %, three or more in 18 %. Storage rooms are 94 % one family; bedrooms, homes and halls mix two to three.
- Family pairs against chance in one room: dark wood with stone 2.3 times chance, ashwood with dark wood 2.0, black
  marble with dark wood 1.9, dark wood with the round table's family 1.5. Rarely together: bone with plain wood (0.27),
  black metal with log (0.34), black metal with plain wood (0.38), black marble with plain wood (0.43).

## 5. Repetition caps

Indoors, per build, for builds with 30 to 400 m2 of indoor floor (579 builds; `caps.json` indoor). has = share of
builds; p50 and p90 among builds that use it; per 100 m2 among builds that use it.

| Piece | Has | p50 | p90 | per 100 m2 p50 / p90 |
|---|---|---|---|---|
| piece_walltorch | 35 % | 3 | 10 | 2.0 / 4.9 |
| piece_groundtorch_wood | 15 % | 4.5 | 10 | 2.6 / 5.5 |
| piece_dvergr_lantern | 19 % | 3 | 9 | 2.3 / 6.6 |
| piece_brazierceiling01 | 13 % | 1 | 3 | 0.7 / 2.3 |
| Candle_resin | 5.4 % | 3 | 13 | 1.9 / 5.8 |
| any light | 70 % | 5.5 | 14 | 3.2 / 7.9 |
| light kinds per build | | 1 | 3 | |
| piece_cloth_hanging_door (drapes) | 8 % | 4 | 8 | 1.5 / 4.7 |
| piece_logbench01 | 6 % | 1 | 2.6 | 0.6 / 2.0 |
| piece_bench01 | 11 % | 1 | 4 | 0.7 / 1.5 |
| piece_chest_wood | 39 % | 7 | 39 | 4.4 / 20 |
| all chests | 61 % | 8 | 39 | 4.6 / 20 |
| itemstandh | 24 % | 11.5 | 55 | 6.4 / 26 |
| itemstand | 28 % | 7 | 28 | 3.3 / 16 |
| sign | 25 % | 7 | 32 | 3.8 / 27 |
| shelves (wood_ledge, dvergr shelf) | 1.4 % | 2 | 32 | |
| pots | 4.5 % | 3 | 10 | 1.9 / 5.6 |

- One light kind per build is the median (p90 three); the most used light prefab is all of a build's lights in the
  median build. Builders vary the light from build to build: wall torch in 35 % of builds, dvergr lantern 19 %, wooden
  standing torch 15 %, hanging brazier 13 %.
- Candles are in one build in twenty. wood_ledge is in 1.4 % of house-sized builds (43 of 2,128 builds anywhere).
- Stacked chests: 53 % of builds with chests have a chest or barrel standing on another, and 35 % of all chests and
  barrels are stacked. Per room kind: storage rooms 48 % (6 stacked per room p50), smithies 49 %, workshops 36 %,
  throne halls 37 %, bedrooms 19 %, dining rooms 12 %, sitting rooms 13 %.
- Showcase against these (`caps.json` showcaseIndoor, showcaseIndoorOver): the hubs use 2 to 5 light kinds (corpus
  p90 3) and 8 and 17 candles (p90 13); the longhouse has 8 log benches (p90 2.6); the Byzantine tavern 70
  itemstandh; 12 of the 16 designs use wood_ledge (1 to 24 each) where 1.4 % of corpus houses use any.

## 6. Walking space

`space.json`. Widths are the clear width of the floor on a 0.25 m grid, walls and posts blocking, from the turned
build (exact for walls along x and z).

- Walk-through halls (corridor rooms that join two or more doors or stairs, ceiling 1.9 m or more; 750 halls in
  all builds): clear width p50 2.0 m (p10 1.0, p90 3.5). 47 % are under 2 m and 7.5 % are 4 m or wider. In wood_floor
  tiles (2 m): p50 one tile, p90 1.75 tiles. Liked builds: p50 1.5 m.
- Tyler's rule stands as given: passages are at least two wood_floor pieces wide; one piece only for a closet or a
  hidden passage. The corpus halls are narrower than the rule in most builds; the rule is the target.
- Porches (ground floor, 30 % or more of the edge open): clear width p50 2 m, box short side p50 3.1 m. Galleries and
  balconies (upper floors): clear width p50 2 m, short side p50 4 m.
- Clear zone straight in from a door (to the first furniture): p50 2.5 m in bedrooms, 3.5 m in throne halls, 3.25 m
  in hearth rooms, 2 m in dining rooms, 2.25 m in workshops, 1.75 m in homes; storage rooms 0.5 m.
- Nearest floor furniture to a door (pivot of the door to the furniture box): p50 1.5 m in bedrooms, 1.8 m throne
  halls, 1.9 m feast halls, 1.1 m homes; storage 0.2 m (chests line the door wall).
- Main walking line (narrowest point of the widest way from the main door to each other door or stair, furniture in
  place): p50 2 m in bedrooms, smithies, hearth rooms, dormitories and tavern halls; 2.25 m in workshops; 1.75 m in
  homes and throne halls; 1.5 m in feast halls and dining rooms. 23 % to 41 % of rooms have such a way under 1.2 m.
- Way to the focal piece: p50 2.5 m in bedrooms, dining rooms, feast and throne halls; 2.75 m in homes and
  workshops; 2.25 m to a forge; 12 % to 25 % of rooms narrow under 1.2 m on that way.
- Stairs: the nearest floor furniture to a stair is 2.7 m (p50); 12 % are under 1 m.

## 7. Wall decor

`walls.json` (13,505 item stands, 4,965 lights, 3,803 signs, 1,975 drapes, 1,931 banners, 2,018 shelves on room walls).

- Heights of the pivot over the floor (p25 / p50 / p75): itemstandh 1.0 / 1.4 / 2.5 m; itemstand 1.6 / 2.3 / 3.4;
  sign 1.2 / 2.1 / 3.2; wall torch 1.9 / 2.3 / 2.9; banners 2.9 to 3.7 / 3.6 to 3.8 / 4.1; drapes 2.9 / 3.8 / 4.1.
- Out from the wall face (p50): wall torch 0.2 m, itemstand 0.04 m, itemstandh 0.09 m, sign 0.14 m, banners 0.1 to
  0.15 m. These are pivots; track F owns how a piece meets the wall.
- Item stands sit in rows: neighbors on one wall 0.19 m apart (p50) and 90 % under 1 m apart; 91 % are the same
  prefab; 49 % at the same height. 59 % of item stands stand alone on their wall stretch, 41 % in rows of 2 to 6.
- Signs: 68 % alone; in rows they touch (0.03 m apart) and step in height (0.48 m p50), which is the label over a
  column of stacked chests: 15 % of signs have a chest under them.
- Lights on one wall: 2.7 m apart (p50), 71 % at the same height, 96 % the same prefab, 96 % alone (no light within
  1.25 m of another on that wall).
- Banners: 1.8 m apart, 90 % at the same height, 73 % the same prefab, alone 96 %. Drapes: 1.4 m apart, 80 % same
  height, 89 % same prefab.
- What stands under wall decor: nothing for 67 % to 74 %; over a chest 15 % of signs and 8 % of item stands; over a
  bed 7 % of banners and 8 % of drapes.
- Windows: 72 % of wall decor is on a wall with no window. On window walls, 12 % to 15 % sits within the window's
  stretch (over or under it) and 5 % to 7 % centered on it; banners keep away from windows more than the rest.
- Shelves (wood_ledge): 28 % empty; p50 two items, p90 seven. On them: more wood_ledge (stacked ledges as trim or as
  shelving), sign_notext, itemstandh, meads, lanterns, small chests. dvergr shelves are 87 % empty.

## 8. Windows and gardens

`gardens.json` (1,827 vanilla builds read for plants).

- Window planters are rare: of 31,319 windows in 893 builds, 0.9 % have plants outside within reach of the sill (67
  builds). 87 % of those planters are vines. A planter carries 1 plant (p50; p90 3), set 0.5 m out from the wall, the
  pivots at sill height (p50 0.01 m over the wall top under the window), centered 0.56 m off the window middle (p50).
  55 % of planter windows have beams or poles framing them (wood_beam, wood_beam_1, woodiron_pole, wood_pole2,
  woodiron_beam, darkwood beams, dvergr poles). Under the plants: stone_wall_2x1 (the wall under the window itself),
  dvergr wood wall, wood_wall_quarter, darkwood_decowall, wood_beam, wood_floor_1x1; 27 % have nothing under them.
- Vines are their own thing: in 158 builds, 31 per build (p50), on walls.
- Plant clusters (plants other than vines joined at 1.2 m, 6,317 groups): 78 % of plants stand alone. Clusters hold 2
  plants (p50; p90 7) of one species in 73 %; neighbors 0.64 m apart (p50), about one plant width (spacing over width
  1.1, p25 0.53, so a quarter of neighbors overlap by half); 80 % of clusters turn their plants to two or more yaws,
  and the median cluster gives every plant its own yaw.
- Species that go together in one cluster: the Meadows heath mix (Pickable_Thistle, shrub_2, Bush01_heath,
  Pickable_Mushroom_yellow), berry bushes (BlueberryBush with RaspberryBush), Beech_small1 with Bush01, Mistlands
  mushrooms (MushroomJotunPuffs with MushroomMagecap).
- Gardens (clusters of 6 or more plants, 209): 8 plants (p50; p90 38), one species in 53 % (yellow mushroom beds are
  the most common), the heath mix of four species next. 62 % stand on the ground with nothing built under them; the
  rest sit on wood beams, wood_floor_1x1 or black marble blocks. Edges: wood_floor_1x1, wood_wall_half, darkwood_beam,
  wood_beam, stakes and stake walls, log poles, stone_wall_2x1. 69 % come within 1 m of a wall (gap p50 0.15 m).
- Trees placed in builds: FirTree_small and Beech_small1 lead in every kind and culture; YggaShoot_small1 in temples
  and castles; old logs (FirTree_oldLog) as props.
- Showcase: planters at 7.7 % of windows (corpus 0.9 %), with crops and flowers where the corpus uses vines; plant
  clusters of one species 19 % (corpus 73 %).

## Co-occurrence of items (`pairs.json`)

For Tyler's added question ("how often to certain lighting fixutres go with different benches, or tables, or decor...
the frequency and pattern and recurrence of all items compared to each other"). Every pair of vanilla furniture and
decor prefabs seen together in a room (5,924 rooms with two or more) and in a build (1,230 builds), with the count,
the count expected by chance and the lift (observed over expected). Per prefab: the partners it goes with most
(`pairsWellWith`, lift 1.5 or more, 8 rooms or more) and those it avoids (`rarelyWith`). By group pair (light~seat,
seat~table, table~rug and so on) the most common pairs.

- Lights: wall torches go with forge extensions, workbench extensions, chair02 and spinning wheels (lift about 2.4);
  dvergr lanterns go with ashwood benches, blue drapes and other dvergr pieces and avoid wooden standing torches (0.12)
  and wall torches (0.47): builders keep one light family per room.
- Seats and tables: piece_table with chair02 (lift 6.6) and bench01 (5.3); chair03 with round table (6.1) and oak
  table (6.0); black marble bench with black marble table (15.6) and away from wood chests (0.26).
- Log benches go with wood stacks, wooden standing torches, workbench extensions and the plain bed: a rustic set.
- Pots go with pots (pot1 with pot2 29.6, with pot3 27.5), lava lanterns and ashwood benches.
- Candles go with ashwood beds (7.5), pot3, barrels and ashwood benches.

## Showcase notes against the corpus

Measured on the showcase designs as made by the lab (`caps.json` showcaseIndoor, `gardens.json` showcase):

- wood_ledge in 12 of 16 designs (1.4 % of corpus houses), up to 24 in the Byzantine tavern.
- Light kinds 2 to 5 per design; the corpus median is 1.
- Log benches 8 in the longhouse (corpus p90 2.6 in the builds that use any).
- Window planters at 7.7 % of showcase windows (corpus 0.9 %), with crops and flowers where the corpus uses vines.
- Plant clusters of one species: 19 % in the showcase, 73 % in the corpus.
