# Council criteria: corpus rooms (track B)

> Since 2026-11-12 this file is a seat's diagnostic notes: what the track measures and how. A design's verdict comes
> from the qualities in `docs/DESIGN_QUALITIES.md` and Tyler's hard rules there; the pass marks and hard fails below
> explain shortfalls and do not decide a verdict on their own (`docs/HELPER_RULES.md`, "The design council").

What a generated s3d3 building is judged by, from the room study (`docs/ROOM_STUDY.md`, data in
`tools/blueprint-lab/data/rooms-corpus/`). Every target is a corpus number unless it is Tyler's rule, and each item
names its source. Measure with `node lab/rooms_corpus_audit.js <design.blueprint>` (it reads the design with the same
room reader and rules as the study and prints each item below with its value and target); the render views are the
lab's four views and plan (`lab/render_views.js`) or the game.

Pass: 80 points or more of 100, and no hard fail.

## Hard fails (each fails the building alone)

| # | Fail | Test | Source |
|---|---|---|---|
| H1 | A passage people walk through narrower than two wood_floor pieces | Straight halls joining two or more doors or stairs with an inside width under 3.9 m, and wings inside a room (6 m2 or more of floor whose shorter free run is under 3.9 m while the longer is twice that and 4 m or more); a closet or hidden passage (dead end) is exempt by Tyler's words and is judged by eye | Tyler (TYLER_NOTES.md, longhouse): "Anything small passageway must be at minimum two wood_floor pieces wide". The corpus houses are narrower (p50 2.0 m, 13 % at 4 m or more): the rule stands as the target |
| H2 | Something crowds a doorway | At a real door (an open side of an alcove does not count): floor furniture (rugs excepted) whose box is within 1.0 m of the door's middle, or a clear depth straight in from the door under 1.0 m | D-148, D-152; Tyler on 09 (fire pit inside the door), 11 (beam across the door), 12 (cook station and armor stand at the door). Corpus nearest furniture to a door p50 1.1 to 1.9 m in living rooms |
| H3 | A room or its focal piece cannot be reached | Widest way from a room's main door to its focal piece or to each other door or stair under 0.75 m | D-148, D-152; Tyler on 12 (upstairs blocked), 16 (stairs block the hall) |
| H4 | A station blocked by its own extension | A forge or workbench extension standing in front of its station within 1.5 m | Tyler on 13 (forge_ext4 in front); corpus: extensions in front of their station 1 % to 7 % (`sets.json` work) |
| H5 | Fence indoors | wood_fence inside a room | Tyler on 14: "never for building fences atop towers, etc. and certainly never indoors". The rooftop carvings (darkwood_raven, darkwood_wolf, wood_dragon1) are left to the catalog's `zone`: the corpus has them under a roof 26 % to 41 % of the time (catalog placement.covered), so D-127 keeps them allowed |

## Scored items (100 points)

| # | Item | Weight | Test and target | Evidence |
|---|---|---|---|---|
| 1 | Each furnished room has a purpose and a focal piece | 8 | Every room with 2 or more floor furniture pieces reads as a kind other than other, empty, corridor or display, and its focal piece is in the kind's list (bedroom: a bed; dining: a table; smithy: a forge; and so on). Full marks at 100 %, none under 70 % | `kinds.json` focal; ROOM_STUDY section 1 |
| 2 | One seat prefab per table | 6 | Share of table sets whose seats are one prefab: 0.85 or more for full marks (a throne at the head may be the one exception) | Corpus 76 % to 99 % by table (`sets.json` matchedShare) |
| 3 | Seats per table in the corpus range | 5 | Each table has 1 to its p90 seats: piece_table 3, round 5, oak 10, black marble 4, dvergr 4; at most one loose seat in the building (a seat in no table set, more than 1 m from a wall and more than 3 m from a fire or throne) | `sets.json` seatsPerSeatedTable |
| 4 | Seats face their table | 5 | 80 % or more of seats at a table turned within 45 degrees of facing it, none turned away (more than 90 degrees) | Corpus: 0 degrees is the most common turn for every chair and bench prefab, turns of 15 to 45 degrees about one in six (`sets.json` turnBySeat); Tyler on 06 |
| 5 | Seats match their table | 6 | Seat to table color difference (catalog look.mean, delta E) p50 10 or less and no seat over 25; no prefab pair the corpus never seats together (for example piece_bench01 at piece_blackmarble_table, 1.4 %) | Corpus p50 6.1, chance 10.4, over 25 in 4.4 % (`materials.json` color); Tyler on 04, 05, 07, 08 |
| 6 | One tone per room | 4 | Luma spread across a room's tables, seats, thrones, beds and chests: p50 over rooms 0 to 43 | Corpus p50 0, p75 43; random 48 (`materials.json` color.roomLumaSpread) |
| 7 | No family pairs the corpus avoids | 5 | No room holds marble furniture with rustic furniture, bone with rustic furniture, ashwood with hide, iron props with log, runed with rustic furniture (lift under 0.5) | `materials.json` rarelyTogether; Tyler on 06 (runetable in a wooden room) |
| 8 | Counts per room kind | 8 | At most one count over the kind's p90 when present (tables, seats, beds, chests, lights and rugs per room) (bedroom: 1 table, 2 seats, 2 beds, 4 chests; dining: 2 tables, 6 seats; feast hall 5 tables, 21 seats); a second table in a dining room or home only as a feast hall | `kinds.json` counts; Tyler on 05 (two tables side by side) |
| 9 | Few light kinds per building | 6 | Light kinds indoors 3 or fewer, the most used light 50 % or more of all lights | Corpus p50 1, p90 3 kinds; main light share p50 1.0 (`caps.json` indoor); Tyler: "the exact same type of torches in every biuld" |
| 10 | Repetition caps | 8 | Indoors per building, at or under the corpus p90 among builds that use it: wall torch 10, wooden standing torch 10, candles 13, drapes 8, log benches 3, bench01 4, chests 39 (20 per 100 m2), itemstandh 55, pots 10; wood_ledge 2 or fewer unless it holds items (in 1.4 % of corpus houses) | `caps.json` indoor; Tyler's repetition list |
| 11 | Stacked chests where builders stack them | 4 | Stacks only in storage, smithy, workshop and kitchen rooms, or one stack at most in another room | Rooms with a stack: storage 48 %, smithy 49 %, workshop 36 %, bedroom 19 %, dining 12 % (`kinds.json` stackedChests); Tyler on 06, 10 |
| 12 | Beds set as builders set them | 5 | 75 % or more of beds with the head against a wall (within 0.4 m) and nothing but a chest, rug, seat, light or built piece just past the foot | Head at a wall 62 % to 76 % (`sets.json` beds); Tyler on 09 (bed facing the wrong way), 10 |
| 13 | Work corners | 5 | Extensions beside or behind their station, one of each kind; the station's back at a wall | Extensions beside 86 % to 96 %; back to wall: workbench 77 %, forge 65 % (`sets.json` work) |
| 14 | Walking lines inside rooms | 6 | 75 % or more of the ways from a main door to each other door or stair 1.5 m wide or more (to the focal piece 1.2 m), none under 1.0 m | Corpus p50 1.5 to 2.25 m by kind; to the focal 2.25 to 2.75 m (`space.json`); D-148 |
| 15 | Clear zone inside doors | 4 | Half or more of real doors with a clear depth straight in at or over the corpus p50 for the room kind: bedroom 2.5 m, home 1.75, dining 2.0, throne or feast hall 2.9 to 3.5, workshop 2.25 | `space.json` doorClearDepth; D-152 |
| 16 | Wall decor placed as builders place it | 6 | 90 % or more of hung pieces with the pivot within the corpus p10 to p90 of the wall offset (-0.25 to 0.5 m from the face). By eye in the views: item stands in rows at one height and of one prefab; lights alone on their wall stretch, 2 m or more apart at one height; signs over chests or alone, never in piles; banners in pairs at one height | `walls.json` heights, spacing, runs; Tyler's note on signs and stands (TYLER_NOTES.md, later the same night); track F owns how they meet the wall |
| 17 | Window planters | 3 | Where there is a planter: under its window and centered within 0.6 m, at sill height, framed by beams or poles; planters on 10 % of windows or fewer | Corpus: 0.9 % of windows, at sill height, 55 % framed (`gardens.json` planters); Tyler's mockup (`frames/shot-c-sill-mockup.jpg`) |
| 18 | Plant clusters | 4 | One species in 60 % or more of clusters; neighbors 0.5 to 1.1 plant widths apart; every plant its own yaw | Corpus 73 % one species, spacing over width p25 0.53 to p50 1.1, the median cluster gives every plant its own yaw (`gardens.json` clusters); Tyler on 06 (random mixed plants) |
| 19 | Gardens meet the building | 2 | Each garden of 6 or more plants within 1 m of a wall, its bed and edge of one material | Corpus 69 % within 1 m (`gardens.json` gardens); Tyler on 06 (two woods), 07 (garden does not meet the wall) |

Scoring: an item scores its weight when it meets the target, half its weight when it is near it (the half mark of each
item is in `lab/rooms_corpus_audit.js`), and nothing otherwise.

## Calibration (2026-11-12)

`lab/rooms_corpus_audit.js` on five liked corpus builds and on the 16 showcase designs as the game makes them:

| Design | Points | Hard fails |
|---|---|---|
| corpus `building/thatch-cottage` | 93.5 | H1 (a 1.6 m side passage) |
| corpus `advanced-base/modern-home-in-the-meadows-contest-entry` | 85.5 | H1, H2 |
| corpus `starter-home/cottage` | 84 | H1 (a 1 m loft walkway) |
| corpus `starter-home/geletopp-cabin...gumdropendgame` | 62.5 | H1, H2 |
| corpus `tavern/forest-lodge` | 61.5 | H1, H2, H3 |
| showcase 01 to 16 | 62 (05 longhouse) to 98 (16 home) | H1 in 12 designs; H5 in 02, 05, 14; H4 in 13 |

The hard fails find what Tyler wrote about: the narrow halls and wings (09, 10, 16, 05), the fence indoors (05 and 14
by name, 02), the forge extension in front of the forge (13). The scored items find the longhouse's mixed seats, log
benches turned away from the table, four tables and twelve seats in one room, eight log benches and black marble among
rustic furniture (05), the dragon bed with its head away from any wall (09), wood_ledge over the cap (01 with 7, 09
with 14). One loose seat per building is allowed, so the lone stool of 09 is not flagged. Two showcase designs
pass this list (03 at 86.5 and 07 at 93.5): what Tyler found there (a chest clipping the throne stage, a wardrobe
turned the wrong way, wall gaps, short walls) belongs to the catalog, shell and wall-hung checks of the other members.
Corpus builds fail H1, H2 and H3 because those are Tyler's rules and the corpus does not hold to them; the scored
items are set so that liked corpus builds mostly reach the pass mark.
