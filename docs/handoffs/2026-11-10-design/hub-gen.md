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
