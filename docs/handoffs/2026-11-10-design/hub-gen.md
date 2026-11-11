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

## Round 5 (2026-11-11): gallery rails, radial tables, rugs, wall sides, crowns, sides

Commits: 5e0b25e, 32c3474, this file. The Hub refs tab held only the lead's example row at the end of this round.
`lab/hub_posts.py` now holds the version that was run in round 4 (the build turned back to its own square, `off` per
build).

### 1. Gallery rails

The opening of a round family gallery is now an even-sided polygon of 2 m sides, as near the gallery ring as can be
(34 sides at s5, 16 to 20 at s4). Its edge is two bands of 1 m floor pieces turned with its sides, and one 2 m rail
piece sits on each side, joined at the corners; none where the s5 walkway crosses the opening. At s4 the part round's
front stands clear of the opening (front 7 m out), so the rail runs whole. New check (`railFaults` in
`lab/test_hub.js`): every rail end meets another rail, a wall, a stair or the walkway's deck, and no two rails cross.
All lines, s4 and s5: 0 open ends, 0 crossings.

### 2. Tables in drum halls

Five spokes (the four diagonals and the side away from the stair) from the fire out to the gallery, each a long table
row along its spoke with a bench row down each side (D-152: a spoke that does not fit is left out, never turned). At s4,
where the drum stands on the gallery's posts, the spokes run under the gallery. In s3 halls with no gallery, two spokes
along the cross axis. The ring of tables is gone from these halls. Turned tables, and what stands or hangs at a wall,
are judged by their solids against walls and furniture (lib/shapes.js `hit`); the walk test still judges by boxes, as
`lab/test_hub.js` reach does. Tables (anglo-saxon octagon, seed 1, d3): s3 0 then 4, s4 0 then 2, s5 7 then 6.

### 3. Rugs

`lab/hub_dress.py` over the corpus: 764 builds with two rugs or more (median 12 rugs). Share of a build's rugs lying
on another by more than 5 % of their area: median 0.69 (q1 0.30, q3 0.93); among those, the share of the rug covered:
per-build median 0.48 (q1 0.26, q3 0.68). Builds with 2 to 12 rugs (387): share overlapping median 0.50 (q3 0.88),
covered median 0.36 (q3 0.52). No build sorted as Middle Eastern (culture list or title words) has two rugs, so the
all-build values are used. Rule (lib/hub.js `RUG_OVER` = 0.52, the q3): a rug goes in only where it lies on rugs
already down by 52 % of its area or less, and a new overlapping rug only while half or fewer overlap. Middle Eastern
part round s5: 8 rugs, the most covered 0.42 (before: about ten piled round the fire). Check: no rug over 0.58.

### 4. Sides and crowns

- Steppe s5 crown, traced: the main roof is 12.1 m under the cap of 12.2 m; the raised crown as built was about 5 m
  tall (2 m posts, a cap of two 45 or 26 degree rings, a 1.5 m finial), so its top reached 17.1 m, over the 15.2 m
  CROWN_OVER allows, and tier 2 dropped it. The crown now fits the room left: 2 m posts and a finial, else 1 m posts
  and no finial, else none. Steppe s5: tier 0, main roof 12.1 m, crown to 14.2 m. Celtic s5: tier 1, crown and
  finial to 17.1 m.
- Stair and side-room side by village: built as a mirror of the whole hall in half the villages (`MIRROR` in
  lib/hub.js). Doors are hung again in the mirrored bay. It is off (value in use: false): mirrored furniture whose
  solids sit a few cm off its middle closed clearances the walk test had passed (chests behind benches not reached).
  The culture data give no side.

### 5. Wall sides

`lab/hub_dress.py`, the 300 m2 set (122 builds): share of ground-storey wall bays with furniture or dressing within
1.3 m on the hall side, median 0.43 (q1 0.20, q3 0.59); round and polygon 0.47 (69 builds), halls 0.36 (53). By kind,
share of bays (median, q3): round: light 0.07 (0.13), seat 0.03 (0.09), craft 0.03 (0.14), storage 0.01 (0.18), stand
0.00 (0.21); halls: storage 0.14 (0.24), craft 0.06 (0.14), seat 0.05 (0.09), light 0.05 (0.11); banners, tables, beds,
shelves near zero. The hub dresses undressed bays in turn with a wall torch, a chest, a bench along the wall, an item
stand and a barrel until the share reaches the median (0.47 round family, 0.36 cross), counting every ground-storey bay;
chests and benches keep a step of clear floor in front. Check (`wallDress`): at least the corpus q1 (0.20) from s3 at d3.
After (seed 1, d3): cross s3 to s5 0.62, 0.40, 0.37; round 0.58, 0.45, 0.45; octagon 0.64, 0.47, 0.43; part round
0.60, 0.31, 0.44. Exterior ornament stays with the trim track.

### Checks run

- `node lab/test_hub.js /tmp/hub5-renders 1`: all hub tests pass (all lines and cultures, reach, floor gaps, posts,
  crown and cap, rails, rugs, wall sides).
- `node lab/test_structure.js`: all structure rules hold on 36 designs.
- `node lib/build_web.js` then `node lab/compare_page.js`: all seven same (web/index.html restored).
- Renders: /tmp/hub5-renders, each line s1, s3, s5 (whole, cut at 2.6 m, cut at the gallery).

### Open

- The stair and side rooms stay on one side (MIRROR off, see 4).
- The hub's walk test (lib/hub.js walker) and lab/test_hub.js reach still disagree in a few tight spots; the furniture
  rules above keep them apart. Worth one shared module at integration (lab/reach.js).
- The Middle Eastern s5 rugs all touch another (8 of 8, the corpus q3 is 0.88).

## Round 6 (2026-11-11): D-156 height, D-155 variety

Tyler's answers (Decisions tab, column G): D-156 "re your hight limit for roofs and crowns: yes, this shouldnt play a
role in the constraints youve set for storeys. Roofs can be taller depending on the design, and that's okay. It should
not be cut off. Rule of cool applies, yes? WWCDD." D-155 "Just like any other building, the layout and interior decor,
etc should be highly varied and dynamic and kitbashed such that even same cultural villages have different interior
layouts, design, decor, etc. based on the procedural generation." D-154 (column H): the hub holds storage until
storehouses are large enough.

Commits: b643df9 (heights, draws, reach, variance test), this file. Hub refs tab: only the lead's example row at the end
of the round.

### D-156: no height cap

Removed from lib/hub.js: the main-roof cap, `CROWN_OVER`, the crown that shrank to fit, the tier loop and its steps
(`req.minTier`, `request.tier`, `request.cap`); `styles.js HUB.capH` is gone and `lab/hub_lines.js` no longer checks it.
Kept: `HUB.capStoreys` counts storeys only; `lab/test_hub.js` checks the hub's wall storeys against the culture's other
buildings at s3 and capStoreys. The round 3 to 5 sections above that describe the cap record what was built then.

Roof proportions (`lab/hub_roofs.py`, the 300 m2 set, 108 builds): roof rise against the ground floor's short side,
round and polygon (55 builds) median 0.34 (q10 0.18, q1 0.22, q3 0.54, q90 0.82), halls (53) 0.49 (0.25, 0.37, 0.56,
0.64); rise median 10.9 and 9.0 m; eave median 5.2 and 3.8 m. Crown against the main roof, round 0.16 (q1 0.07, q3 0.32,
q90 0.50), halls 0.21 (q1 0.00, q3 0.33, q90 0.62). These are `ROOF_Q` in lib/hub.js. Each village draws its place in
the spread (`drawLayout` rise and crown; a culture with a 26 degree pitch draws in the lower 60 %): round halls get
that many steep (45 degree) inner rings over a low eave ring; the cross's gables are 45 degrees at a drawn ratio of 0.32
or more, else 26; the drum's walls 2 to 4 m, the posts-style raised crown 1 to 3 m posts with a finial when the draw
leaves a metre over, the lantern tower and the flat roof's lantern 2 to 4 m. s5 heights (main roof / top, villages 1 to
8, seed = lineage): Norse cross 9.2 to 12.2 / 9.2 to 16.2 m; Celtic round 12.1 to 18.6 / 12.1 to 23.3 m; Anglo-Saxon
10.1 to 14.6 / 13.7 to 18.7 m; Middle Eastern 6.1 / 8.1 to 10.1 m.

### D-155: layouts drawn per village

`drawLayout` in lib/hub.js draws each choice from the village's lineage on its own (hash of lineage, culture and the
choice), weights from the corpus and the culture data; recorded as `request.layout`:
- seat: the far end (3) or a side (1, round halls with a gallery) or the near end of the back arm (1, cross); raise: dais
  2, step 2, none 3 (s5 at least a step; corpus: 74 % of high seats at an end, dais 7 % of the set and 32 % of the top
  tenth); the trophy wall follows the seat;
- hearth: stone hearth, fire pit or a long fire (hearth between two pits), weights by the roof style;
- tables: cross rows 4, U 3, groups 2, mixed 1; drum halls spokes 4, ring 2, groups 2, mixed 2; cone halls ring 4,
  groups 3, spokes 1, mixed 1; flat roofs rugs 4, groups 3, ring 1; count 3 to 6. Spokes start at a drawn angle and keep
  clear of the door, seat and stair; groups are a table with chairs at its heads and sides (D-152);
- gallery at s4: full 3, none 1 (s5 always); walkway at s5 across the front 3, along a side 2, none 2 (a part round's
  walkway always runs along its front);
- stair side left or right; side rooms on the other side in round halls (each choice drawn, the rooms follow the
  stair), drawn side in the cross; one room (storage) or two (storage and food prep or a closet); storage always (D-154)
  besides the hall's wall chests;
- kit: wall light (wall torch 3, Dvergr lantern 1), banner kind, rug kind, trophy rows 2 or 3.
`MIRROR` is gone; the sides are drawn per choice.
Not done: the interior dressing through decorate.js and kitbash.js with the village persona; only the kit kinds above
vary. The cross builds both side rooms whatever `rooms` says.

### Reach

`lab/reach.js` copied from origin/design/integration2 (unchanged) and used by `lab/test_hub.js`. The same logic is
copied into lib/hub.js as `reachH` for a last pass in generate that takes out decor the walk cannot reach or that stands
in an entry zone, so the hub and the test read a design the same way. For the integration merge: lab/reach.js is that
branch's file; reachH in lib/hub.js is a copy of it to fold into one module.

### Checks run

- `node lab/test_hub.js /tmp/hub6-renders 1`: all hub tests pass.
- `node lab/test_hub_variance.js` (new): every culture, seeds 1 to 8 at s5: 8 distinct layouts of 8 in every culture;
  per choice 1 to 3 seat places, 2 to 3 raises, 2 to 3 hearth forms, 4 to 7 table plans, 1 to 3 gallery kinds, 2 stair
  sides, 4 to 6 room sets.
- `node lab/test_structure.js`: all structure rules hold on 36 designs.
- `node lib/build_web.js` then `node lab/compare_page.js`: all seven same (web/index.html restored).
- Renders /tmp/hub6-renders: norse-cross_s5_four-villages.png and celtic-round_s5_four-villages.png (villages 1 to 4
  side by side, whole and cut, each with its layout), and each line at s1, s3, s5.

### Open

- Dressing through the shared decorate and kitbash pipeline with the village persona (D-155) is not built.
- The cross's side rooms do not follow the one-room draw; its gallery kind varies only at s4.

## Round 7 (2026-11-11): the shared dressing pipeline, shapes per village, one reach module

Commits: 5a55cb8 (lib/reach.js, lab/hub_shapes.py), 3ca6f6e (shapes per village, cross side rooms and s5 gallery
kinds, walkway and stair for any size), 4609f32 (dressing through lib/kitbash.js and lib/persona.js, annexes), f8e5c77
(octagon sizes, side-room wall place, chairs, request.shape, lab/hub_villages.js), and the commit with this file. Hub
refs tab: only the lead's example row (MASSIVE Viking Hall) at the end of the round; nothing taken from it.

### 1. Interior dressing through the shared pipeline

- Persona: `persona.js persona({ type: 'hub', biome, culture, seed: lineage })`, the village's traits (never a trade),
  recorded as `request.persona`. It picks the wall light (corpus tilt of the culture from `decorate.js corpusTilt`
  times the persona's liking for lights and its wealth), the rug kind (corpus tilt times its liking for rugs), the
  chairs of the table groups (corpus seat tilt, finer chairs with comfort and wealth), the torch spacing
  (`torchGap`), the banner count (`wallWeights(P, 'hall').banner`, none to six) and the trophy rows (three when
  `wallWeights.trophy` is 1 or more). The draws `V.light`, `V.rug`, `V.trophyRows` of round 6 are replaced by these.
- `sharedDress` in lib/hub.js: the hub's rooms read by `decorate.js readLevel`, each model given the kind of the hub
  room it lies in (hall and gallery: hall; storage, closet and annex: storage; food prep: kitchen), then
  `kitbash.js furnishRooms` (corner, wall, window, table and hearth sets, and `dressWalls`: ledges, banners, stands,
  candles and torches by the persona's weights). Side rooms take every set; the hall and the gallery take none that
  stands on the free floor (anchors floor, bed, post left out), so the open floor stays. The hub's own pieces are never
  moved by a set. Every set then goes back in whole only if the walk still reaches every room, climb and main piece
  (placer `admit`, the hub walker); built frames of beams and posts, station extensions without their station, and
  rugs that would lie on others past `RUG_OVER` stay out. Sets stop dressing new hall wall bays at the corpus third
  quartile (0.59, `WALL_Q3`, lab/hub_dress.py). Item stands the sets bring get items by the persona
  (`persona.js dressStands`); memento and trophy stands stay empty (D-134). The last pass removes a whole set when one
  of its pieces is left unreached.
- Kept: the hub's own furnishing plan (fires, high seat and spouse seat, table plan, trophy wall, storage chests,
  chandeliers) and its wall-side fill to the corpus median after the library.
- Sets per s5 hub, villages 1 to 4: Norse cross 79, 52, 60, 38; Celtic round 85, 93, 134, 105; Anglo-Saxon octagon 118,
  63, 73, 103. Wall bays dressed as lab/test_hub.js measures them (every ground-storey bay, side rooms included), seed
  1, s3 to s5: 0.60 to 0.76; round 6: 0.31 to 0.64.

### 2. Round 6 leftovers

- Cross side rooms follow the draw: one room (storage at the end of one side arm) or two (storage and food prep or a
  closet). `inSide`, the wall spots, the rows' ends and the tie beams are per side.
- Cross gallery at s5 by the draw: every arm (as before), the nave (a U over each end of the front and back arms, one
  stair to each), or the back arm (a U round the high seat end, one stair). The corpus has no shares for these; even
  weights. Lofts over the side rooms only with every arm.

### 3. Shapes per village

`lab/hub_shapes.py` over the 300 m2 set of lab/hub_roofs.py (108 builds, run read only on Tyler's PC), quantiles 10,
25, 50, 75, 90 %:

| Measure | Round and polygon (55) | Halls (53) |
|---|---|---|
| Ground floor | 363, 432, 568, 696, 1,152 m2 | 360, 496, 529, 680, 830 m2 |
| Diameter | 19.2, 21.3, 25.9, 38.1, 46.1 m | |
| Sides (builds) | 16: 18, 8: 13, 12: 9, 32: 3, 10, 14, 6: 2 each, 18, 20, 22, 24, 28, 36: 1 each | |
| Long over short side | | 1.21, 1.29, 1.74, 1.99, 2.16 |
| Arm width over long side (22 branched) | | 0.21, 0.27, 0.38, 0.47, 0.67 |
| Inner wall lines (place) | 0.26, 0.42, 0.63, 0.87, 1.01 of the radius | 0.08, 0.16, 0.25, 0.36, 0.45 of the length from the end |
| Porch posts none / 2 to 5 / 6 or more | 16 / 13 / 26 | 17 / 20 / 16 |
| Annexes (lobes of 6 m2 or more) | none 22, one 9, two or more 24 | none 16, one or more 15 (31 unbranched) |
| Annex share of floor | 0, 0, 0.071, 0.174, 0.42 | 0, 0, 0, 0.032, 0.107 |

Drawn per village (`drawLayout`, `SHAPE_Q`, recorded in `request.layout`; the plan as built in `request.shape`):
- Size: the square root of an area drawn between the 25 % and 90 % quantiles over the median, as a scale on the
  stage's base size (round 10, 15, 20, 30 m; octagon sides 4, 6, 8, 12 m; cross 14 x 14 to 26 x 30 m). Round and
  octagonal halls at s4 keep at least the base size (the gallery, stair and side rooms need it); octagons at s5 take
  sides of 10, 12 or 16 m (14 m sides leave the floor band open at the corners, open problem).
- Round line sides: drawn from the corpus counts of 16 or more in fours (16, 20, 24, 28, 32), each stage taking the
  drawn count where an even side length comes within 6 % of the size, else the nearest. 10 to 14 sided halls are left
  out: the floor band does not close at their corners yet.
- Cross: aspect drawn over the 10 to 90 % quantiles, arm share over the 25 to 75 % ones; half sizes solved for the
  drawn area, odd metres, with the room the stairs and side rooms need (Wz at least D + 8, Wx at least D + 6 from s4).
- Side-room wall: round halls at the drawn share of the radius, 7 m or more from the fire and 3 m or more off the
  wall; the cross's room depth the drawn share of the side arms' length, 4 m or more.
- Porch: none, a covered entrance, or a column porch, at the corpus counts; the column porch is the `porch6` feature.
- Annexes (round family from s4): the corpus count of lobes (two or more read as two), a room 6 m wide and 4 or 6 m
  deep with a door from the hall and a gable roof under the hall's eave: on the side rooms' side where that wall is 10
  m long or more, and behind the hall where the high seat is not at the far end. The cross has none (the corpus annex
  measure covers unbranched halls only).
- The gallery's inner edge moves out where a 2 m stair cell must fit; the walkway's row and length follow the
  gallery's opening; the stair moves back where its landing would meet the wall; a seat drawn at the side with no room
  clear of the fires takes the far end.

Plans at s5, villages 1 to 4 (request.shape): Norse cross 26 x 38, 26 x 34 (arms 14), 26 x 34 (arms 10), 26 x 34 m;
Celtic round 24 sides 30.4 m, 16 sides 30.2 m, 32 sides 40.6 m, 16 sides 40.2 m (side rooms at 11, 11, 11, 17 m);
Anglo-Saxon octagon 38.6, 29.0, 29.0, 29.0 m (side rooms at 9 or 11 m; annexes 0, 0, 1, 1). Round 6: one footprint
per culture.

### 4. One reach module

`lib/reach.js` holds the reach logic (node and browser, `window.VHReach`, in both bundle lists before hub.js).
`lab/reach.js` loads it (same signature, `libDir` kept for check_interiors.js); lib/hub.js uses it for its last pass
(`reachH` is gone). The placer's walker now judges pieces by their whole box, as lib/reach.js does (it read turned
solids before, which let a turned table group close a stair the reach test then found shut).

### Checks run

- `node lab/test_hub.js /tmp/hub7-t 1`: all hub tests pass. Test changes: the notice board within 8 m past the main
  door's distance from the fire (it was 22 m from the fire; halls are larger now); storeys counted as the rooms' floor
  levels (gable walls of a wide cross were counted as storeys).
- `node lab/test_hub_variance.js`: 8 of 8 distinct in every culture; per choice now also the plan as built (2 to 6
  values), side-room wall (2 to 5), porch (3), annexes (1 to 3), personas (7 or 8 of 8).
- Sweep, every village culture, lineages 1 to 8, s2 to s5, d3 (checks.js and lib/reach.js; /tmp/h7/sweep.js): 0 of 480
  designs with a fault (before the wall cap; the run after it is in the report).
- `node lab/test_structure.js`: all structure rules hold on 36 designs.
- `node lib/build_web.js /tmp/h7/index.html` then `node lab/compare_page.js /tmp/h7/index.html`: all same.
  web/index.html in the repo not rebuilt. Engine bundle `/tmp/h7/lab.js` in a VM: an Anglo-Saxon s5d3 hub writes
  `#VillheimLeader`.
- Renders: /tmp/hub7-renders/norse-cross_s5_four-villages.png, celtic-round_s5_four-villages.png,
  anglo-saxon-octagon_s5_four-villages.png (`node lab/hub_villages.js /tmp/hub7-renders s5 4`): villages 1 to 4 side by
  side, rows whole, cut at 2.6 m, cut at the gallery.

### Changes in other tracks' files

None. lib/kitbash.js, lib/decorate.js and lib/persona.js are called through their exports (`furnishRooms`,
`library`, `setLibrary` for the hall's filtered library, `readLevel`, `corpusTilt`, `persona`, `wallWeights`,
`torchGap`, `pickW`, `dressStands`). lab/reach.js now loads lib/reach.js.

### Open

- Round halls of 10 to 14 sides and octagon sides of 14 m: the floor band leaves gaps at their corners; left out of
  the draws.
- Cross side-room depth is 4 m in most villages (the transept is often at its minimum, D + 6).
- Annexes are rare in round halls (their walls are mostly 4 or 6 m long); none on the stair side (the stair foot) or
  behind a far-end high seat.
- The cross s5 gallery kinds and the walkway kinds have no corpus shares (even weights or round 6 weights).
- The library's sets in the hall are many (38 to 134 at s5); the hall wall bays stop at the corpus q3, the side rooms
  and gallery are not capped.
