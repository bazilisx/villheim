# Hub generator track: the village hearth as a building type, s1 to s5

Branch `design/wip-hub-gen`, from main 509744e. State on 2026-11-11 (Mountain Time): the lab has a `hub` type with
four lines built and tested; not tried in the game. Plan and corpus numbers: `hubs.md` in this folder.

Tyler's answers this work follows (2026-11-11): D-138 "5th stage always planned from the start ... "City" stage. More
common to have multiple story buildings (even 3 storeys high) by s5." D-139 "The hub is the hearth. Synonymous. ...
It's its own building plot ... the hearth must 1000% grow and evolve and become a grand central building across stages
and decor too." D-140 "My hub1 drafts at diff stages should be used simply as mock-up examples. Not as law ... stick to
existing building material rules ... The only thing that must always appear somewhere in the hearth area is the notice
board, either freestanding as it appears or simply as signs on an open wall as the hearth grows larger." D-141 C (a
leader marker and the high seat or throne). D-142 "Hub1 just a proof of concept mock-up ... build their final designs,
adhering to our generative design guidelines across cultures." D-137 is Open: the value in use is B (Norse has two
lines, a long hall and a round line, picked per village), as the setting `HUB.d137` in `lib/styles.js`.

## Commits

- ab4f2a9 Hub generator: the village hearth from camp to grand hall, s1 to s5 (lib/hub.js, lab/test_hub.js, the hub
  entries in request.js and styles.js, the hook in generate.js, hub.js in the two bundle lists)
- this file

## What each line is (seed 1, d3; measures from `lab/test_hub.js`)

Every line starts from the same s1 camp and keeps its plan's shape family from s2 to s5 (D-132). The fire is at the
plot's middle (0, 0) at every stage: a fire pit at s1, a hearth on stone flags from s2 (D-131, flags marked
`hearthStone`). The plot is the s5 one from s1 (D-083); the test holds the camp inside the s5 footprint.

| Line | s1 | s2 | s3 | s4 | s5 |
|---|---|---|---|---|---|
| Norse long (Meadows) | camp, 54 pieces, 2.2 m | hall 18 x 10 m, 7.2 m | hall 22 x 14 m, 12 aisle posts, high seat at the +x end, 10.2 m | hall 30 x 14 m, second fire, loft at the -x end (2 levels), gate door, stone course, dragon heads | mead hall 34 x 18 m, 14.2 m, 3 floor levels (ground, gallery over both aisles at 3 m, end loft at 6 m), 16 aisle posts, high seat on a dais, upper windows, 944 m2 of floor |
| Norse round (Meadows, hub1 as a guide) | camp | 16 sides, 10 m across, 5.6 m | 24 sides, 15.2 m, high seat opposite the door, back door | 16 sides, 20.1 m, a drum of high windows on 16 posts, outer ring roof up to it and a low cone, 10.7 m (hub1 s4: 20 m, 11.5 m), stone course | 24 sides, 30.4 m across, 14.7 m (Hogan: 30 m, 15.5 m), drum on 18 posts, gallery ring at 3 m on a ring of posts, 2 floor levels, 942 m2 |
| Celtic round (Black Forest) | camp | as Norse round s2 | as Norse round s3 | 20.1 m, a ring of posts at 6.3 m, one cone open at the crown, 12.6 m, stone course | 30.4 m, 16.6 m, two rings of posts (Navan Fort), gallery ring at 3 m, open crown over the fire |
| Middle Eastern court (Plains) | camp | back wing with an arcade on a paved 14 m yard, stone walls, flat roof with a parapet | three wings round the yard, arcade on three sides | four wings, gate through the front wing, an iwan open to the yard a storey higher with the high seat, a corner tower of three storeys (9 m and a parapet) | wings of two storeys with a ladder, four corner towers, high seat on a dais in the iwan, 26 x 26 m, 1,602 m2 of floor |

s1 (all lines): a fire pit with a cooking station, two to four lean-tos (three 60 % of the time) 5.4 to 6.2 m out with
the open side to the fire, never on the door side, each 4 m wide with two posts, a beam and two rows of 26 degree roof to
the ground (hub1 s1 measures as a guide, D-140); a log bench 3 m out in line with each lean-to; the notice board at about
8.6 m between the door side and the first lean-to with chests beside it (two at d1, three at d2, five at d3); deer rugs
under the lean-tos and a wood stack at d2; torches, berry bushes and dandelions at d3; a path marker at the door side.

Floor area grows every stage in every line (test). s5 has the most floor of any building in its culture's set (every
other type at s3, seeds 1 to 3): Norse long 944 m2 against the tavern's 358; Norse round 942 against 358; Celtic 942
against the tower's 356; court 1,602 against the tavern's 458. Height: the Celtic s5 (16.6 m) is lower than the Celtic
s3 tower (17.6 m); the others are the tallest in their set.

## How it is built (lib/hub.js)

- `generate(req, tools)`: req as for any type plus `line` ('long', 'round', 'court'); stages s1 to s5; d1 to d3 by the
  pieces' `ds` tags (D-071: d2 holds all of d1, d3 all of d2). `skipDecor` keeps the structure, the fires, the notice
  board and the high seat.
- Line per culture: `styles.js HUB.lines`. Norse: `HUB.d137` ('B' in use: long or round from the village's lineage; 'A'
  round only; 'C' long only). Cultures without a form of their own take the long hall (anglo-saxon, frankish-norman,
  norse-forest, slavic, baltic, fen-folk, norse-highland, lamari), the round (celtic-crannog, saami, steppe) or the
  court (byzantine). All of them pass every check at s1 to s5 (seed 1, d3, run by hand).
- Materials (D-125, D-012, D-131, D-140 "stick to existing building material rules"): the biome kit's pieces
  (`styles.js kitFor`); wood walls in the Meadows and the Black Forest at s1 to s3 (log walls where the culture builds
  in log outside the Meadows); a stone course under the walls from s4 (setting `HUB.stoneFrom`, value in use 's4'; the
  Meadows takes the Black Forest's stone, its next biome, as `lib/pieces.js buildReach` allows); stone walls in the
  Plains court. Every stage passes the materials check.
- Grand features (hubs.md "Grand buildings for s5"): each village draws one number per feature, and s5 has it under
  the top tenth's share, s4 under the rest's (`GRAND` in hub.js), so a feature an s4 hub has stays at s5. Built from
  the draw: three fires (long s5, round s5), a porch of 10 posts (long s4 and s5), a dais under the high seat (all), a
  second corner tower at s4 (court). Built at every village: aisle posts from s3 in the long line (12 to 16, the top
  tenth has 8 or more in 89 %), a high seat from s3 (D-141), upper windows at s5 in the long line, the drum with high
  windows in the Norse round from s4, four towers at court s5.
- Rooms walkable (D-148): furniture goes in only where it clips no wall, door, post, stair or other furniture and stays
  out of keep-clear zones: every doorway (both sides, always), ladders, the way from the main door to the fire and from
  the fire to the high seat. A piece that does not fit is left out.
- Notice board (D-140): freestanding at every stage (two posts, a board, three notices a side as signs headed
  "Village notices", "Work wanted", "Trades"); from s4 three more signs on the wall by the main door inside (court: by
  the yard door of the front wing). Pieces carry `notice: true`.
- Leader (D-141 C): `piece_throne01` from s3, at the +x end of the long hall facing down it, opposite the door in the
  round hall, in the main iwan of the court; at s1 and s2 the leader's place is the bench facing the door side. Written
  in the blueprint as `#VillheimLeader` with one line `seat;x;y;z;yaw` (proposed name, row below). Path markers as
  `#VillheimPaths` `path;x;y;z;yaw` at the main door, the format the board writes
  (`src/Villheim.Logic/Village/DesignBoard.cs`). `hub.write(d)` writes both; `request.make` uses it for hubs.
- Mementos (D-134): empty `itemstand` on the walls, 2 at s2, 4 at s3, 6 at s4, 10 at s5 (tagged `memento`, d1). The
  hub has its own finish, so `Persona.dressStands` never fills them.
- Furnishing is the hub's own pass: feast tables with benches along the aisles (long), a ring of tables (round), tables
  in the wings (court); benches round the fire to s3, rugs by the fires (d2), chests at the walls, a cauldron and a
  fermenter from s3, wall torches, banners from s4, a guest bed and chest in the loft, a wood stack and a stone pile
  outside. The interior library (`decorate.js`, `kitbash.js`) is not run on hubs.

## Checks run

- `node lab/test_hub.js /tmp/hub-renders 2`: four lines x seeds 1 and 2 x s1 to s5 x d1 and d3 (80 designs): every
  check in `lib/checks.js` passes (support, stability, overlap, doors, headroom, ladders, woodpiles, materials,
  space); shape family measured from the pieces (wall turns, plan aspect, roofed or open fire) holds s2 to s5; fire at
  the heart; notice board present within 22 m of the fire; leader marker and path marker written; memento stands
  empty; s1 camp inside the s5 plot; floor grows every stage; s5 the largest in the culture's set. Result: all pass,
  about 15 s.
- `node lab/test_structure.js`: all structure rules hold on 36 designs (the hook leaves other types as they were).
- The game bundle built to `/tmp/hub-lab.js` (`node lib/build_engine.js /tmp/hub-lab.js`) and run in a plain VM
  context: `VHRequest.make({ type: 'hub', biome: 'md', culture: 'norse', stage: 's4d2' })` passes 9 of 9 checks and
  writes `#VillheimLeader`. The bundles in the repo were not rebuilt (integration does that).
- Not run: the pool gate and `check_interiors.js` (hubs are not in a pool yet).

Renders (`/tmp/hub-renders`, each a whole view and a view cut at 2.6 m): norse-long_s1 to _s5, norse-round_s1 to _s5,
celtic-round_s1 to _s5, court_s1 to _s5 (`.png`).

## Changes in other tracks' files

- `lib/generate.js`: two lines at the top of `generate()` (`if (req.type === 'hub') return ... hub.js generate(req,
  HUB_TOOLS)`) and one constant before the exports, `HUB_TOOLS = { Build, quat, wallSegment, gablePieces, posts,
  putLadder, column, putDoor }`. No other change.
- `lib/build_web.js`, `lib/build_engine.js`: 'hub.js' added to the file list before 'generate.js'.
- `lib/request.js` (hub entries): the refusal of `hub` is gone; 'hearth' maps to 'hub'; the words "hub", "hearth",
  "village hearth" read as the hub; stages s4 and s5 are taken for the hub and refused for other types; `line` passes
  through (or "round", "long", "courtyard" in the words); a hub's blueprint is written by `hub.write`.
- `lib/styles.js`: `TYPES.hub` and the `HUB` settings (`d137`, `stoneFrom`, `lines`), exported. Every loop over
  `TYPES` (gen_set, check_set, coverage, the lab page) now meets `hub`; it builds at s1 to s3 there like any type.

## Open problems

- Norse round and Celtic s2 and s3 are the same plan in the same wood (the lines part at s4: drum against post rings).
- Round s2 (10 m) stands inside the s1 camp ring (lean-tos 5.4 to 9 m out); hub1's s2 ring (20 m) went round the camp.
  D-132 lets the camp go; a 15 m s2 would keep more of the s1 idea.
- Not built yet from the grand list: towers on the long and round lines, a column porch on the round and court lines,
  a gallery ring in the court (it has upper rooms), high windows over a lower roof in the long line (it has windows in
  the upper wall), stairs (ladders only).
- Ring roofs of 45 degrees near the crown show gaps between pieces; the crown is left open from 2.4 m (smoke hole).
- The mod: villages never build hubs yet. `VillageBrain.cs` keeps the hearth from being built over and
  `PlotFinder.cs` puts the hub behind the hearth (hubs.md section 6); D-139 now says the hub is the hearth. The leader
  marker needs a reader (`Designs/Blueprints.cs`) and the leader's daytime hours there. Mod side, not this track.
- The hub's furnishing does not use the interior library or household traits; one village's hub looks the same at a
  given stage and seed whatever its people.

## Proposed Decisions rows (for the lead)

- **Leader marker section.** Hub blueprints carry the leader's place as `#VillheimLeader` with `seat;x;y;z;yaw`.
  Options: A) a section of its own (in use); B) a line `leader;x;y;z;yaw` in `#VillheimPaths`, where the board's reader
  may take it as a road join. Recommendation: A.
- **Stone course on Meadows and Black Forest hubs.** The lab's other buildings put no stone walls in the Meadows
  (`generate.js wallStyleFor`); D-012 allows stone for advanced buildings and later stages. Options: A) a stone course
  under the hub's walls from s4 (setting `HUB.stoneFrom` 's4', in use); B) from s5 only; C) wood at every stage.
  Recommendation: A.
- **Hub lines for the other cultures.** Until their own forms are built: long hall for anglo-saxon, frankish-norman,
  norse-forest, slavic, baltic, fen-folk, norse-highland and lamari; round for celtic-crannog, saami and steppe; court
  for byzantine. Options: A) as in use; B) refuse a hub for those cultures until their form exists. Recommendation: A.

## Next

1. The lead merges and rebuilds the bundles; Tyler reviews the renders and a few hubs in the lab or with `vh gen`.
2. The forms in hubs.md section 4 for the other cultures (stave tiers, keep, terem, platform, gables, goahti ring,
  yurt ring, dome).
3. The missing grand features above, and stairs to the galleries.
4. Mod side: build the hub round the hearth (D-139), read `#VillheimLeader`.

## Round 2 (2026-11-11)

Lead's calls on the round 1 rows (no rows for Tyler): the `#VillheimLeader` marker with `seat;x;y;z;yaw` (A), the
stone course on Meadows and Black Forest hubs from s4 under D-012 and D-125 (A), the fallback hub lines for cultures
with no form yet (A).

Commits: 37be34a (reach: stairs, ladders, rooms, furniture that leaves the way open), 82aa6b8 (exteriors, the round
forms, the s2 woodshed), and this file.

### Every floor reached on foot

- `lib/hub.js walker(b)`: the reach logic of `lab/reach.js` (design/integration2) inside the hub's placer. Furniture
  goes in only when every room, every stair and ladder and every bed, table, station and chest placed so far stays
  reached from a door to the outside, the new piece included (D-148, D-152). Pieces tagged d2 or d3 are tested too, so
  d1 stays inside d2 and d3 (D-071).
- Room rects for every floor: the long hall's galleries and loft, the round hall's gallery ring, each court wing on
  each floor, the court roofs, the tower floors and the tower tops.
- Long hall s5: a stair of three `wood_stair` to each gallery in the outer aisle row at the high seat end, rising to the
  end wall; the gallery floor is open over the flight. s4: the loft ladder stands at the nave's side by the aisle
  posts at the -x end (it stood in the nave between the two fires). s5 loft: a ladder up from the gallery at the end.
- Court: s2 and s3 a ladder through the roof at the back wing's end; from s4 each tower has a ladder per storey up to
  a lookout on top and a door onto each wing roof it stands between.
- `lab/test_hub.js`: the reach logic copied in (reach.js is not on this branch). Every stage s2 to s5 at d1 and d3:
  no floor, room or main piece unreached, nothing in an entry zone.

Measures (seed 1, d3; main pieces reached of those counted, reach logic, before / after):

| Line | s2 | s3 | s4 | s5 |
|---|---|---|---|---|
| Norse long | 2/7 / 6/6 | 6/10 / 10/10 | 10/17 / 18/18 | 16/23 / 23/23, both galleries and the loft reached (one gallery before) |
| Norse round | 1/2 / 1/1 | 3/4 / 3/3 | 6/6 / 6/6 | 9/9 / 9/9, gallery ring reached |
| Court | 0/7 / 6/6, roof reached | 1/14 / 12/12, roof reached | 13/13 / 13/13, roofs and tower top reached | 10/12 / 12/12, 16 rooms on 4 levels reached |
| Celtic round (after only) | 0 | 2 | 2 | 9 |

Before: round 1 code with one room rect per hall. After: the room rects above.

### Exteriors from s4

- `GRAND` gains `tiers3` (3 or more roof tiers, 62 % rest, 68 % top tenth) and `dragons` (19 %, 26 %).
  `exteriorOf()`: per line a list in the order of the top tenth's shares (long: tiers3, porch6, dragons, highWindows;
  round: tiers3, porch6, dragons; court: porch6, towers2), each from the village's draw; s5 has at least three, s4 at
  least one, and s5 keeps what s4 had. Dragons only where the culture has them (`C.dragons`). Recorded in
  `request.features`.
- Long hall, tiers3: lean-to roofs (26 degrees) over the aisles from the wall top to the aisle posts, a wall band on
  the posts (3 m at s5, 2 m at s4; windows every other bay with highWindows), the nave's gable over it, and a lantern
  over the main fire (posts on the ridge, a small roof, open at the sides). s5 is 17.6 m (14.2 before). The aisle
  roofs' ends close with roof gable pieces. Dragons: heads on both gables (as before) and on the lantern.
  porch6: the porch of 10 posts as before; without it a covered entrance on 4 posts with a small gable roof.
- Round: a covered entrance at the main door from s4 (6 posts with porch6, else 4); a carved head on its gable with
  dragons (Norse). Norse tiers3 is its drum.
- Court: porch6 is a portico of six stone columns with a flat roof and parapet before the gate. Towers as before.

### The two round forms

| | Norse round | Celtic round |
|---|---|---|
| Walls s2 to s4 | 4 m, plank (stone course from s4) | 3 m, logs (`wood_wall_log`, Black Forest kit; stone course from s4) |
| Roof | two low rings of 26 degrees, then 45 (drum from s4) | one ring of 26 degrees, then 45 (two at s5) |
| Posts | clear inside to s4; the drum's posts at s4; outer ring at s5 | a ring from s2 (8 posts at s2), one at s4, two at s5 |
| Crown | a smoke cap on four posts at s2 and s3; the drum's cone from s4 | open at s2 and s3; a raised roof on 8 posts over the open crown from s4, a finial post |
| Height s2 / s3 / s4 / s5 | 6.9 / 8.9 / 10.7 / 14.7 m | 5.6 / 7.6 / 15.8 / 23.8 m |

The Celtic s5 (23.8 m) is now taller than every other Celtic building (the tower s3, 17.6 m, test_hub.js).

### Round s2 and the camp

The s2 hall (10 m across) stands inside the camp's ring of lean-tos. The camp gives way (D-132); the mod tears an old
stage down before the new one goes up (`ConstructionSite.cs` TeardownOld). One lean-to stands on behind the s2 hall as
a woodshed, moved out clear of the eaves, with the wood stack under it.

### Checks run

- `node lab/test_hub.js /tmp/hub2-renders 2`: 4 lines x seeds 1, 2 x s1 to s5 x d1, d3, every check in
  `lib/checks.js`, the reach checks above, the round 1 checks. All pass. s5 against the culture's set: Norse long
  926 m2, 17.6 m (tavern 358 m2, 10.2 m); Norse round 942 m2, 14.7 m; Celtic 942 m2, 23.8 m (tower 356 m2, 17.6 m);
  court 1,618 m2, 10 m (tavern 458 m2, 7 m).
- `node lab/test_structure.js`: all structure rules hold on 36 designs.
- Engine bundle built to `/tmp/hub2-lab.js` and run in a VM: `VHRequest.make` of a Norse long s5d2 hub passes its
  checks and writes `#VillheimLeader`. Repo bundles not rebuilt.
- Renders in `/tmp/hub2-renders` (whole and cut at 2.6 m): each line s1 to s5.

### Open

- Towers on the long and round lines are not built (towers2 and anyTower draw nothing there yet).
- The round gallery and the long hall's loft use ladders; the round line has no stair.
- The raised roof over the high seat end of the long hall is not built (the tiers are the aisle roofs, the nave and
  the lantern).
- The Celtic raised crown roof and the ring roofs of 45 degrees still show gaps between pieces near the crown.
- Furniture refused by the reach test is left out; the s2 halls hold fewer tables than before (long s2: 6 main pieces
  of 7). The Celtic s2 holds no chest or table: its ring of posts leaves no spot the reach test allows.

## Round 3 (2026-11-11): lines by culture, the grand interior, the height cap, the lab page

Tyler's words this round follows: D-137 "Strongly leanign toward circular/octagonal or partial variants thereof for
most, and cross-shape for those that are more strongly rectangular or l-shaped sturectures throughout the rest of the
settlement ... I want to avoid using the typical shotgun-style longhouse as the ultimate building ... folks gather from
all corners" and "circular, semi-circular (i.e. half or 3/4 circle with open chunk on one side?), octagonal, etc.";
D-154 "The hearth IS the central hub, the townhall, the primary resource. It holds storage ... It's where the leader
and their spouse spend time ... the leader doesnt reside or sleep there"; the design brief (tall ceilings, chandeliers
or braziers, warm hearths, seating for the leader, big open areas, a few side rooms); and his correction of the brief:
"i misused the word parapet here, so strike it from outside. I was thinking about those raised platforms along higher
inner walls or across ceilings for folks to walk and look down and observe the grandeur." No parapets are built.

Commits: a49d246 (lines, interior, cap, tests), 14ad1ea (lab page), this file.

### Lines per culture

`lab/hub_lines.js` builds every other type of each village culture at s3 (seeds 1 to 3) and reads each plan from its
pieces. Rule: long and branched (L, T, U, cross) plans together 70 % or more (`HUB.crossFrom`) take the cross; the rest
the round family: round buildings of their own (measured, or round or yurt in the culture's `forms`) take the round
hall (part round one village in four), a courtyard culture the part round (octagon one in four), the others the octagon
(part round one in four). The village's lineage picks between them; a village keeps its line at every stage. The
result is in `styles.js HUB.lines` and the script checks that it matches.

| Culture | long + branched | Line |
|---|---|---|
| Norse, Frankish-Norman, Norse forest, Lamari | 76, 76, 73, 80 % | cross |
| Celtic, Crannog, Saami, Steppe | 40, 4, 58, 47 % | round 3, part 1 |
| Anglo-Saxon, Slavic, Baltic, Fen folk, Norse highland, Byzantine | 53 to 69 % | octagon 3, part 1 |
| Middle Eastern | 64 % | part 3, octagon 1 |

The Norse long hall and the court are gone as lines (lib/hub.js); an old request for 'long' or 'court' gets the
culture's line. The cross keeps from the long hall the high seat at the far end, the porch, tie beams and the lantern.

### What each line is (seed 1, d3)

- Cross: s2 14 x 14 m, arms 6 m wide; s3 18 x 18 m, arms 10 m, 4 m walls; s4 22 x 26 m, two storeys of 3 m; s5 26 x
  30 m, arms 14 m. Gables over each pair of arms with valleys where they cross; from s4 a lantern tower over the
  crossing by the draw (posts at the crossing's inner corners, walls at its corners, the middle bays open for smoke).
  Side rooms from s4 at the side arms' ends: a kitchen with its own door out, a storage closet.
- Round: 16 or 24 sides, 10, 15, 20, 30 m across. Octagon: 8 sides, 10, 14.5, 19, 29 m. Part round: the round's ring
  cut by a straight front with the door, 3 to 9 m in front of the fire; the cut-off part is the forecourt with the
  notice board. Roof by the culture: rings of posts and an open crown under a cone (conical roofs), a drum of high
  windows over the fire from s4 (gable and hip cultures), or a flat roof open over the fire with a lantern (flat roof
  cultures). Octagon roofs are rows of pieces along each side. From s4 a kitchen and a storage closet against the +x
  wall under the gallery, with the back door into the kitchen.

### The grand interior (s3 on)

- Galleries (Tyler's correction): from s4, at 3 m, railed, reached by wood_stair flights. Cross s4: over the door and
  along one wall of the front arm, one stair. Cross s5: along both walls of every arm, so the gallery crosses the front,
  back and side arms round the opening over the fire, lofts over the side rooms, two stairs. Round family s4 and s5: a
  ring between a ring of posts and the wall, one stair along the -x wall; at s5 a walkway across the hall at z = -8 on
  two posts, between the gallery's sides (part round: along the straight front). No gallery or walkway is over a fire.
- High seat from s3 at the back facing the fire, on a dais by the draw and always at s5; piece_chair02 beside it for the
  spouse, written as `spouse;x;y;z;yaw` under `#VillheimLeader`.
- Trophy wall behind the high seat: 4, 8, 12 empty item stands at s3, s4, s5 (tagged `trophy`, `memento`), plus 2 to 4
  more along the walls.
- Chandeliers: piece_brazierceiling01 from s3, from tie beams across the cross's arms (2 to 6) or from the roof of a round
  hall (4), never within 2.5 m of a fire.
- Storage (D-154): hall chests 3, 6, 6, 8 at s2 to s5; the closet holds up to 8 more chests; the kitchen a prep table, a
  butcher's table, a fermenter and chests.
- Fires: the hearth at the heart with benches round it; the cross a second fire in the front arm from s4 and one in the
  back arm at s5 by the draw; the round family two at s5 by the draw.

### Height cap

`styles.js HUB.capH` is each culture's tallest other building at s3 in the lab, leaving out the watchtower (measured by
lab/hub_lines.js); a hub may stand `HUB.capStoreys` storeys of 3 m over it. Value in use: 2 storeys (one for the s5 rule
in the brief, one for the other buildings' growth from s3 to s5, which the lab does not build). A hub over the cap is
built again a step plainer (the TIERS loop in lib/hub.js generate(): 1 no tower, drum or raised crown; 2 low roofs; 3 a wide open
crown; 4 one storey without a gallery); `request.tier` records the step.

Measures at s5 (d3, seed 1), before (round 2) and after:

| Line | before | after |
|---|---|---|
| Norse | long 926 m2, 17.6 m; round 942 m2, 14.7 m | cross 1,004 m2, 15.2 m (cap 16.2), tier 0 |
| Celtic | round 942 m2, 23.8 m | round 974 m2, 12.1 m (cap 15), tier 2 |
| Anglo-Saxon | long (no own line) | octagon 960 m2, 14.7 m (cap 16.2), tier 0 |
| Middle Eastern | court 1,618 m2, 10 m | part round 1,360 m2 (floor and flat roof), 9.1 m (cap 17), tier 0 |

Every culture at s5 for lineages 1 and 2 stays under its cap (test output): Steppe 12.1 of 12.2 m (tier 1), Norse
highland 12.9 and 13.9 of 14.2 m (tier 2), Lamari 12.2 of 22.7 m.

### Lab page

`web/app.html`: Hub (the existing type) is in the Building choice of the New building tab and now of the Interiors tab;
when it is chosen the size slider runs s1 to s5 (s1 camp, s2 hamlet, s3 village, s4 town, s5 city) and the ticks follow.
`lab/compare_page.js` checks two hub requests besides the five others: all seven the same in node and the page.

### Checks run

- `node lab/test_hub.js /tmp/hub3-renders 1`: the four lines at s1 to s5, d1 and d3, and every village culture's own
  line (lineages 1 and 2) at s2 to s5: every check in lib/checks.js, reach (every floor, gallery cell rect, side room and
  main piece reached on foot, nothing in an entry zone), shape family kept, high seat and spouse seat from s3, gallery
  with a stair from s4, height under the cap, s5 the largest in the culture's set. All pass.
- `node lab/test_structure.js`: all structure rules hold on 36 designs.
- `node lab/hub_lines.js 3`: styles.js HUB.lines and HUB.capH match.
- `node lib/build_web.js` then `node lab/compare_page.js`: all same (web/index.html restored, not committed).
- Renders in /tmp/hub3-renders, each line s1, s3, s5, whole and cut at 2.6 m.

### Hub refs tab

Read on 2026-11-11 before the first and the last commit: only the lead's example row (MASSIVE Viking Hall), no builds
listed by Tyler. Nothing taken from it.

### Open

- Octagon roofs show ragged hips and stepped edges where the rows of pieces overlap.
- The part round's front gable is stepped wall bays under the ring roof (no gable pieces).
- The Celtic and Crannog s4 and s5 lose their raised crown roof to the cap (tier 1 and 2); the Steppe s5 its crown.
- Side rooms in round halls leave a gap of about 1 m where the partition meets the curved wall.
- The cap uses s3 buildings; it should be measured again once the lab builds other types to s5.
- Proposed Decisions rows are in the report to the lead.

## Round 4 (2026-11-11): open floors, floors at the walls, hips, crowns, interiors, renders

The lead's review of the round 3 renders set this round: open floors measured on the corpus, floors that meet curved
walls, clean octagon hips and flat roof edges, crowns kept over the cap, interiors that differ by culture and line, and
renders from one side. Tyler's correction stands: no parapets outside; galleries and walkways inside.

Commits: b9a4ef4 (posts, floor band, hips, crowns, lanterns), 39003b5 (seating, gallery torches, checks, renders), this
file. The Hub refs tab held only the lead's example row at the start and before the last commit.

### 1. Corpus: free-standing inner posts

`lab/hub_posts.py`, run read only over Villheim-blueprints on Tyler's PC (2,322 .blueprint files). A building counts
when its ground floor (floor pieces within 0.6 m of the lowest floor level) is 300 m2 or more, it is at most 75 m long
and 6 m high or more, with 20 or more wall pieces at the ground storey. Each build is first turned back by its commonest
wall turn (blueprints keep their turn in the world). Round or polygon: 30 % or more of its walls off its own square.
Halls: an orthogonal plan with hall, longhouse, mead, throne, jarl, chief or feast in the title or file. Folders of
whole bases, castles, arenas, villages and art are left out. A free-standing inner post: a pole, pillar or column whose
foot is within 2.6 m over the ground floor, over a floor cell and 0.7 m or more from every wall piece; stacked pieces
count once.

| Measure | Round or polygon (72 builds) | Halls (51 builds) |
|---|---|---|
| Ground floor, median | 514 m2 | 528 m2 |
| Inner posts, median (quartiles) | 7.5 (2 to 14) | 4 (1 to 8) |
| Per 100 m2, median (q3) | 1.45 (2.5) | 0.7 (1.2) |
| None at all | 13 builds | 10 builds |
| Layout (ring / rings / two rows / other) | 2 / 6 / 3 / 48 | 0 / 1 / 3 / 37 |
| Clear radius round the middle, median (q1 to q3) | 6.0 m (2.6 to 8.5) | 4.7 m (2.9 to 7.0) |
| Nearest post, median | 2.1 to 6.5 m by layout | 3 to 4 m |
| Ring diameter (ring builds) | 20 to 30 m | |
| Two rows apart | 10 to 16 m | 6 m |

Most corpus posts stand in no clean layout ("other"); where there is one it is a ring. The hub now has one ring:
the gallery's inner edge (from s4), posts 5.5 m or more apart, the drum on posts at every second to fourth corner, and
at s4 under a drum the drum's posts are the gallery's ring. The inner ring of the Celtic s5 and the walkway's two posts
are gone (the walkway spans from gallery to gallery; stability holds). The fire's middle and the way from the door to
the high seat stay clear.

Measured with the same rule on the hub (seed 1, d1/d3), before (round 3, c8f08aa) and after:

| Line | s4 before | s4 after | s5 before | s5 after |
|---|---|---|---|---|
| Round (Celtic) | 9 posts, 3.1 / 100 m2 | 5, 1.4 | 24, 3.6 | 10, 1.3, clear radius 10.6 m |
| Octagon (Anglo-Saxon) | 26, 10.0 | 8, 2.4 | 34, 5.4 | 16, 2.1, clear radius 5.8 m |
| Part round (Middle Eastern) | 7, 3.0 | 3, 1.1 | 12, 2.1 | 8, 1.3 |
| Cross (Norse) | 0 | 4 (tower) | 4, 0.7 | 4, 0.7 |

`lab/test_hub.js` fails a hub of 300 m2 of ground floor or more with more than 2.5 inner posts per 100 m2 (round family)
or 1.2 (cross), or a post nearer the middle than 2.6 m or 2.9 m (the corpus q3 and q1).

### 2. Floors meet curved walls

`polyFloor`: 2 m cells keep 0.9 m off the walls; 1 m pieces where their middle is 0.3 m or more inside (their corners
run under the wall line); a band of 1 m pieces turned with each wall side along its inner face; the part round's front
gets a row of 1 m pieces and closes against the ring with 1 m wall pieces. New check in `lab/test_hub.js`
(`floorGaps`): points 0.3 and 0.8 m in from every ground-storey wall bay, on its floored side inside the hall, must lie
on a floor piece. Open points before and after (s2 to s5, seed 1, d1):

| Line | before | after |
|---|---|---|
| Round | 566, 932, 380, 700 | 0 at every stage |
| Octagon | 188, 72, 520, 744 | 0 |
| Part round | 180, 252, 270, 490 | 0 |
| Cross | 0 | 0 |

### 3. Octagon hips and the flat roof edge

Each side's row of roof pieces stops inside its hips; one roof piece turned along each hip and set 0.12 m lower closes
the wedge between two rows (a hip line). The flat roof's edge follows the walls with the same band of pieces turned with
each side, so its rim is straight; no parapet.

### 4. Crowns

The cap applies to the main roof; a crown, lantern or finial may rise `CROWN_OVER` over it. Value in use: 3 m (lib/hub.js;
the lead's call, 2026-11-11: up to one storey). Pieces of the drum, the lantern tower, the raised crown and the flat
roof's lantern carry `crown: true`; `request.mainTop` and `request.top` record both. Tier order is now: 1 low roofs,
2 no tower, drum or raised crown, 3 a wide open crown, 4 one storey. The raised crown is low (26 degrees) from tier 1.
Celtic s5: tier 1, main roof 12.1 m under a cap of 15, crown and finial to 17.1 m. Steppe s5 still loses its crown
(main roof 12.1 m against a cap of 12.2; the Steppe's tallest other building is a 6.2 m dock).
The flat roof's dome is now a square lantern: corner walls (windows with the draw), the middle bay of each side open for
the smoke, a flat top. The cross's lantern tower uses the same helper.

### 5. Interiors by line and culture

- Cross (Norse, Frankish-Norman, Norse forest, Lamari): long tables end to end with a bench row down each side, down
  both sides of the front and back arms and along the side arms; at s5 the rows start in the crossing's corners inside
  the stairs. High seat on its dais at the back arm's end facing the door.
- Round under a drum (octagon and part round of the gable and hip cultures): up to five long tables like spokes from
  the fire out to the gallery, clear of the seat's, door's and stair's sides; a few tables under the gallery.
- Round under a cone (Celtic, Crannog, Saami, Steppe): benches round the fire and a ring of eight log benches at 5.4 m;
  tables under the gallery.
- Flat roof (Middle Eastern): rugs and carpets in a ring round the fire; tables under the gallery.
- Galleries and walkways (as round 3) now carry standing torches by the rail (d2); chandeliers as round 3, inside the
  drum's ring when the drum stands on the gallery's posts.

The stair and side rooms still sit on the same side in every round hall.

### 6. Renders

All views are drawn from the same side (az 35): whole, cut at 2.6 m, and from s4 a cut 2.6 m over the gallery floor; the
label says so. The six posts outside the wall in the round 3 cut views were the covered entrance's posts (porch draw, six
posts) with its roof cut away. Renders: /tmp/hub4-renders, each line s1, s3, s5.

### Checks run

- `node lab/test_hub.js /tmp/hub4-renders 1`: all hub tests pass (the four lines s1 to s5 at d1 and d3, every
  culture's line at s2 to s5 for lineages 1 and 2, with reach, floor gaps, inner posts, crown and cap).
- `node lab/test_structure.js`: all structure rules hold on 36 designs.
- `node lib/build_web.js` then `node lab/compare_page.js`: all seven same (web/index.html restored).

### Open

- Octagon hall s3 and s4 hold one table or none: the placer judges a turned piece by its whole box, so long tables off
  the square stop at the octagon's walls.
- The stair and side rooms do not change side by village.
- Steppe s5 has no crown under its cap.
- The hub_posts.py "round" test reads walls off the build's own square; houses with angled wings count as polygon.
