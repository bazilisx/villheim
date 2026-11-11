# Design handoff, 2026-11-10 and 2026-11-11: where the generator work stands and how to resume it

The building generator (tools/blueprint-lab) was worked on by helper tracks in the design sessions of 2026-11-10 and
2026-11-11 (Mountain Time). Every track is merged to main at 8e1860f. This file indexes each track (branch, record,
state), keeps the integration records, the rules every helper follows, and the prompts to resume the work. The
narrative is in `docs/daily-notes/2026-11/2026-11-11.md`.

## State of each track (main 8e1860f)

Every branch below is merged into main (checked with `git merge-base --is-ancestor`). Nothing here is tried in the
game.

| Track | Branch, tip | Record | State |
|---|---|---|---|
| Creative sets | main, 8f3cb45 | creative-sets.md, ../../../tools/blueprint-lab/data/creative-corpus/ | Merged 2026-11-10. 148 creative sets, library at 201 prefabs. |
| Library first, then essentials | design/wip-decor-limits 2aa8836, design/wip-essentials f923734 | library-first.md, richness-measurements.json | Merged (a16974d, 943a419). Decor any biome, D-132 gate, beds per household, D-127 clips, essentials by corpus counts (two rounds). |
| Item stands and feasts | design/wip-stands c62bc0b | item-stands.md, ../../../tools/blueprint-lab/data/stands-corpus.json | Merged (31921d3). Stand shares by place from the corpus, counters, heaps, sunk stands; gate misses listed in round 3 below. |
| Hearths and lighting | design/wip-hearths 5c634ed | hearths-lighting.md, ../../../tools/blueprint-lab/lab/hearths/ | Merged (5719e77, 66d1fd7). Rounds 2 to 6: fires move between stages, middle fires by room size, stone fronts from s2, grausten fronts. |
| Lab page | design/wip-lab-page 4e17d38 | lab-page.md | Merged (ab9e9c1). Building and Culture up front, stage sliders, more choices below. |
| Interior research | design/wip-research 8b8070d | research.md, ../../../tools/blueprint-lab/data/culture-corpus/ | Merged (1fa07b1). Corpus by culture group, lived-in rooms study, relx counts. Docs and data. |
| Hubs (plan) | design/wip-hubs 5203a56 | hubs.md, ../../../tools/blueprint-lab/data/hubs/ | Merged (43bcd8e). Plan per culture and s5 candidates; generator waits for D-137 to D-142. |
| Landscaping (plan) | design/wip-landscape 7ca8cc8 | landscaping.md, ../../../tools/blueprint-lab/data/landscape/ | Merged (b2c31a2). Greenery lists and placement plan; pass not built; D-144 to D-147 open. |
| Ideas study | design/wip-ideas db6b739 | ideas.md, ../../../tools/blueprint-lab/data/ideas/ | Merged (8e1860f). 15 gaps against the corpus, top 10 with files and sizes. |
| Integration | design/integration 5a07fae | this file, rounds 1 to 3 | Merged as 1068c6d. |

design/kitbash (origin) is at 0604748, behind main. Branches design/wip-rooms-lights, design/wip-trim-banners and
design/wip-storeys exist in local worktrees on this machine at 8e1860f with no commits and are not pushed.

The published lab page (artifact "Villheim Blueprint Lab", slug ebd4fcaa-85d1-452f-9d94-251d2687967c) has version
1794390299-1588 (09:44 UTC on 2026-11-11), before round 3: republish it from tools/blueprint-lab/web/index.html.

## Integration, round 1 (2026-11-11, branch design/integration, midpoint)

Merged with --no-ff: a16974d design/wip-essentials (library first, decor any biome, essentials), 5719e77
design/wip-hearths, 31921d3 design/wip-stands, ab9e9c1 design/wip-lab-page, 1fa07b1 design/wip-research. fa02180:
`lib/yards.js` guards its `global.YV` read so the page does not throw in the browser (lab-page.md). e74ccec: bundles
rebuilt. The checks at e74ccec are the numbers in brackets in round 2.

## Integration, round 2 (2026-11-11, branch design/integration)

Merged with --no-ff: design/wip-essentials f923734 (943a419; decorate.js conflict, the room keeps both the persona
line and the table seed line) and design/wip-hearths 5c634ed (66d1fd7; no conflicts). Fixes, one commit per cluster
(D-123):
- 2e1d614: the pot on a fire that slides clears doorways and climbs (generate.js settle, hearths code; tavern Plains
  s1d1 155 ladder); the fire kerb leaves off a side in a door's way in (details.js; tavern Meadows s3d3 321).
- 79d3a48: stackChests asks decorate.js lateClash (the audit's overlap and doorway tests for one piece; tavern
  Mistlands s3d3 170, temple Mistlands s3d3 808); treasure_stack is no indoor pile (towers 509, 714).
- bd0708b: eave trim goes with an eave left off over a gallery (generate.js roof loop; home Ashlands Baltic s2 4 and
  s3 6 support and stability).
- 4c512fd: the fitter keeps signs and wall stands at the pool audit's heights (kitbash.js hangOff, audit.js MID;
  KB-058 and KC-142 signs on the floor failed hang in the Black Forest and Plains pools).
- dd38633: one budget for table tops in the stand pass (stands.js); flat stands turn with their table or seat
  (kitbash.js turnLikeCorpus); stand set tries 80 to up to 240 per room.
- 042ba97: the lab page bundle carries audit.js. c2b68cb: bundles rebuilt.

Full checks after the fixes (midpoint e74ccec in brackets): check_set 224 of 225, overlap 1 (same); test_structure
36 hold; test_sizes 0 off; check_interiors 3 seeds, 702 designs: overlap 1 (3), door 0 (1), check:doors 0 (1),
check:ladders 0 (1), check:overlap 0 (1), check:space 0 (1), indoorPile 0 (3), floating 7 in 5 designs (7 in 5),
bareFloors 7 (8); pools Norse Meadows, norse-forest Black Forest and middle-eastern Plains all pass (Meadows and
Black Forest failed hang); test_stands 3 --gate d3 misses: flat bench 8.9, wall wall 17.6, wall station 41.2, wall
chest 2.6, flat share 83 %, stands q3 23 (midpoint: flat bench 7.2, station 35.7, flat share 84, heaps 9 %, distinct
q3 9, stands q3 20); essentials: tables turned 23 % (17.4), seats turned 35.1 (33.3), rugs layered 18.7 (15.8),
tables dressed 48.4 (68.3); test_variance hall 0.36 and 0.46 (0.41, 0.47); hearth measures as round 6; gen-test 5 of 5
byte for byte; dotnet build 0 errors.

Open: wall station share (41 % against 17 %): fewer wall stands reach plain wall in taverns since the essentials'
wall seats and stacked chests came in; capping station stands at pick time (tried) took 49 of 152 wall stands away and moved
three more wall shares out of the band, so it was left out. home Mountain s2d2 139 overlap (ground torch by a log bench)
is in every track. The lab page's designs are not compared with node's (STAND_HI and data differ on the page).

## Integration, round 3 (2026-11-11, branch design/integration)

Fixes, one commit per cluster (D-123):
- d167cc4: the lab page carries window.VH_ROOMS, VH_ROOM_WEIGHTS and VH_STANDS (lib/build_web.js), and the game's
  bundle VH_STANDS ahead of the libraries (lib/build_engine.js). Without the room templates the page's rooms took no
  template (home Meadows s1d3 seed 7: page 164 pieces, node 175); without the stand heights audit.js STAND_HI was
  2.4 m in both bundles and 3.8 m in node. lab/compare_page.js runs the page's script in node and compares it piece by
  piece: ten requests over five types and six biomes match.
- eadfab4: one roll per table for what lies on it (decorate.js tableDressed, kept on the piece as td), asked by the
  decorator, every library set (kitbash.js fit; on a bare table the set goes on without its top, and those pieces do
  not count against it) and the stand pass (stands.js: reads tables as essentials.js does, sets a bare table only
  where its roll says dressed, and sets those first in each room).
- 0a9d12d: stands.js wallAtS reads a wall spot over a station with the miner's station list (lab/mine_stands.js WORK,
  19 prefixes; it had 7).
- e332b6e: audit.js floorSign passes a sign whose foot is on the floor or up to 18 cm into it; kitbash.js hangOff asks
  it. Count, from data/kitbash-interior.json: 32 sign members of 21 mined sets stand on the floor away from any chest,
  from 21 of the library's 472 source builds; sunk 0 to 3.3 cm in 26, 18 cm at the 90th percentile.
- adf59dc: the fitter's furniture tests read pieces as the pool audit does: a pair turned off the grid with one piece
  the furniture table does not size is compared as turned (audit.js turnedBox); the fitter searches for furniture
  clashes over the piece's furniture box and 1 m round it, and its catalog-box test counts station extensions;
  decorate.js auditOne tests a piece with no furniture entry for going into walls by its catalog role.
- Bundles rebuilt in the record commit.

Full checks (round 2 in brackets): check_set 224 of 225, overlap 1 (same); test_structure 36 hold; test_sizes 0 off;
check_interiors 702 designs: overlap 1 (1), floating 9 in 7 designs (7 in 5), bareFloors 7 (7), every other count 0;
pools Norse Meadows, norse-forest Black Forest, middle-eastern Plains all pass (all pass); test_stands 3 --gate d3
misses: flat bench 8.9 (8.9), wall wall 16.6 (17.6), wall station 38.3 (41.2), wall chest 2.9 (2.6), stands q3 21
(23); flat share 78 % in band (83); essentials: tables dressed 38.1 % (48.4), tables turned 21.7 (23), seats turned
33.3 (35.1), rugs layered 14.4 (18.7), chests stacked 40.6; test_variance hall 0.37 and 0.46 (0.36, 0.46), home-b
s3d3 0.54; compare_page 5 of 5 same; gen-test 5 of 5 byte for byte; dotnet build 0 errors, 43 warnings.

dotnet warnings: origin/main built with the same SDK (8.0.428) in a fresh worktree gives the same 43 warnings, the
same list (MSB3245, 20 assemblies not on this machine: the game's publicized assemblies, BepInEx.Preloader,
HarmonyXInterop and others). They come from the environment.

Open:
- Wall station share. In tavern d3 rooms the stand pass sees 65 plain wall spots of 2,225 (3 %); 268 of its 318
  picks there are busy (wallBusy: fermenters 142, wall torches 62, the decorator's wall stands 32). Taverns had 2.9 %
  plain wall and 40.6 % station before the essentials merge (e74ccec), so the shortage is older. Tried and left out:
  each kind of place keeping its share when its spots run out (station 39.0, plain wall 16.4). The corpus gap between
  wall stands (wallGap) is 0.31, 0.49 and 0.97 m at the 10th, 25th and 50th percentiles, under wallBusy's 0.6 m
  margin; a corpus count of stands beside torches and casks would show whether that margin should shrink (D-127).
- Rugs layered fell from 18.7 to 14.4 % (corpus 21) with the table roll; not looked into.
- home Mountain s2d2 139 overlap (ground torch by a log bench), as in round 2.


## Integration, round 4 (2026-11-11, branch design/integration2 from main 509744e)

Merged with --no-ff, no conflicts: f7c5797 design/wip-storeys 014c3c1 (storeys.md), ba6eaca design/wip-trim-banners
44d9a9f (trim-banners.md), 26e65e3 design/wip-rooms-lights 87e6845 (rooms-lights.md). Fixes, one commit per cluster
(D-123); the track whose code changed is in each commit message:
- 5b03e83 rugs (rooms-lights code; settle in generate.js): trimRugs fills the d2 budget with rugs that lie at d2 first
  (a set's d3 rug took a d2 room's one place); one layered pair per room with room for two, drawn so the design's
  layered rugs come to the culture's rl share, a second rug laid over the first where no pair was laid (layOver);
  rugTopUp for rooms the furnishing left short; settle keeps rugs in door and ladder zones (checks.js doors and ladders
  pass over rugs). Homes with no rug: the household draw (has share per group, 27 to 44 % none) gave 7 of the 18
  sample households none.
- b2a865f lights (rooms-lights code): the draw of none passes over the stream's first four values (44 % of main rooms
  drew under 0.33) and uses the corpus share alone (the household's liking divided into it put homes' main rooms at
  0.46); the main room is found on raised floors and court plans (storage took the room share 0.83); trimLights puts
  lights that stand at d2 first; round houses and the Svan tower are trimmed too (kitbash.js budgets).
- 9191bb9 tables dressed (rooms-lights code): redressTables lays one non-light top piece on a table rolled dressed and
  left bare, in generate.js finish before dressStands. 116 of 311 tables dressed against the roll's 36 %; the roll is
  each culture's corpus td rate (norse 41 %, fen-folk 23, norse-highland 24), so the sample mix sits under 41 %.
- dea0562 bare floors (rooms-lights code): sparseTopUp, a chest then an armor stand or barrel in a room of 8 m2 or
  more holding under two pieces (every corpus room kind holds 0.82 pieces per 10 m2 or more at its lower quartile).
- ce6c2cc mountOnOpening (trim-banners code): banners and motif props pass the decorator's mountOk (decorate.js
  mountClear) where they are hung and committed.
- 843af16 combined tracks: no svalgang on a knee-wall loft (2 of 63 knee lofts failed support, stability, doors);
  benchByDoor, the lean-to goods and standing motif pieces keep out of the audit's 0.6 m ring round a climb and the
  keep-clear zones (a straight stair up the inside of a wall to an s3 upper floor; 72 s3 longhouses, 46 with a hall
  loft: audit stairs 3 to 0).
- f13da3f table sets (D-152 g; essentials and stands code in kitbash.js): a seat whose dining table box is within
  0.9 m turns only with its table; liveIn turns it 3 to 8 degrees toward the nearest seat at the table or pushes it
  back 0.1 to 0.3 m and turns it 4 to 10 degrees (settings: data/interior.json pairs show turned seats at tables in
  0.25 m steps with no turn size). Set seats turned over 10 degrees: 30.7 to 4.7 % (72 homes, longhouses, taverns).
- e401eb2 circulation (D-152 i): lab/reach.js in check_interiors (reachRoom, reachPiece, entryZone; a 0.9 m lane walked
  from inside the outside doors and up the climbs over the design's room rects); layout.js targetsOf adds tables,
  stations and floor chests; clearLanes runs again after the late passes.
- 43b1c12 entry zones (D-152 h): layout.js clearEntries, loose furniture out of a zone inside each door, the opening's
  width plus 0.3 m each side and 1.5 m deep (accessibility turning circle; corpus p10 free depth inside a home's door
  1.6 m, docs/INTERIOR_DESIGN.md). Beds, fires, stations, tables and the first chest stay and are counted.
- d940c83: lanes and entries leave rooms of 8 m2 or more two pieces (layout.js leavesBare); sparseTopUp does not count
  lights. 27c7fcd: bundles rebuilt.

Reach, one seed (234 designs), before e401eb2 and after 43b1c12: main pieces not reached 395 of 1,548 to 255 of 1,395;
room rects 28 to 24 of 323; pieces in entry zones 27 to 5. Renders in /tmp/int4-renders (not kept).

Full checks (round 3 in brackets): check_set 224 of 225, overlap 1 (same); test_structure 36 hold; test_sizes 0 off;
check_interiors 702 designs: overlap 3 (1), floating 7 (9), bareFloors 10 (7), stairs 0, mountOnOpening 0, door 0,
every checks.js column 0, reach 769 of 4,067 main pieces and 71 of 987 room rects not reached, entryZone 37;
furniture per design d2 21.5, d3 38.7; pools Norse Meadows pass (prefabsPerD3 13.1, setShare 0.36), norse-forest Black
Forest pass (11.8, 0.345), middle-eastern Plains FAIL prefabsPerD3 10.3 under 11 (the merge 26e65e3 gave 10.8,
5b03e83 11.1, b2a865f 10.4); test_stands 3 --gate d3 misses: flat bench 6.3 (8.9), flat chest 4.4 (in), wall station
31.4 (38.3), wall table 13.9 (in), flat share 81 % (78); essentials: tables dressed 37.3 % (38.1), tables turned 23.2
(21.7), seats turned 28.3 (33.3), rugs layered 20.9 (14.4), chests stacked 47.2, homes with no light 36 % (corpus 33),
longhouses 25 (23), taverns 3 (6), workshops 31, smithies 44 and storehouses 50 (work 21); test_variance hall 0.44
and 0.42, home-b s3d3 0.44 (closest 0.79); hearths spotmix and hallmix as main (homes s3 middle 8 %, halls over 80 m2
middle 32 %); compare_page 5 of 5 same; gen-test 5 of 5 byte for byte; dotnet build 0 errors, 43 warnings.

Ideas study measures (ideas.md commands, 612 designs, 576 files; main 509744e, then this branch; corpus as in ideas.md):
s3 two storeys or more 28 to 39 % (Norse 75); beds upstairs 36 to 44 % (77); banner piece in 7 to 14 % of buildings,
s3 5 to 24 % (Norse 53); windows dressed 94 to 91 % (70), corners 96 to 94 (77), inside corners 100 (78), wall tops 93
(60); valleys 0.5 per build (2.2); lights per 10 m2 0.7 to 0.2 (0.2); home rooms with a wall torch 83 to 45 % (36), a
candle 49 to 7 % (0 to 7); tables on a rug 72 to 25 % (27); seats at tables 46 % both (28); tables dressed 36 % both
(41); rugs layered 17 to 8 % in the culture miner's reading (essentials reads 20.9 %); tavern rooms with a butcher table,
prep table, mortar 0 to 10, 8, 10 % (27, 14, 16).

Open:
- Middle-eastern Plains pool prefabsPerD3 10.3 under its floor of 11. Dvergr wall lanterns (40 % of corpus wall
  lights) are drawn and never put up (decorate.js putMount refuses them; rooms-lights.md); they are one kind more where
  a room is lit.
- Smithies and storehouses read 44 and 50 % dark in essentials with zero budgets at 22 and 28 % (corpus 21 and 29 %):
  the measure counts lights over floor pieces with a roof 2 to 9 m over them, and 6 of 36 smithies have their wall
  torches outside that reading; two steppe smithies place no light where the budget gives two.
- Reach: 19 % of main pieces stay out of reach on a 0.9 m lane; beds, tables and stations are never taken out of a lane,
  so a bed across a wing or a table set in a narrow room still closes it. Entry zones hold 37 pieces, mostly the kinds
  the pass keeps.
- bareFloors 10: tower upper floors where the light budget took a library ledge set's lights and the ledge, and the
  top-up found no wall spot.
- Homes with no rug 50 % in the 36-home sample (corpus 28 to 32 %), from 7 of 18 household draws.
- Wall station stands 31.4 % (corpus 16.9), as in round 3.

## Integration, round 5 (2026-11-11, branch design/integration2 from dda70fe)

Tyler's words this round: D-152 "egress and room movement should always allow someone to move into rooms and
explore"; D-148 "a player or npc must be able to navigate around the table to the bed or vice versa. So if .6m is too
tight to do so, any furniture or decor that disrupts that expectation should not be placed. Any furniture or decor.";
D-149 "B. Always mirror what corpus builders do. WWCBD should be a central tenet". Fix clusters (D-123):
- a29e5b1 reach (layout.js, generate.js finish, kitbash.js apply): `openWays` reads the finished design as
  lab/reach.js does (`walkMap`: 0.25 m grid over the room rects, 0.9 m lane, walked from every door to the outside and
  over the climbs) and, for each closed room, out-of-reach bed, table, station or chest and piece in an entry zone:
  moves what stands in the cheapest lane (a group: the piece, what stands on it, a table's seats, a library set whole)
  to a spot of its floor clear of the lane, the entry zones, the climbs, doors and the fire's ring, that a person
  reaches; else moves or turns the piece itself; else makes a double bed single; else leaves out loose things, then
  chests, then the piece, then tables and stations in the lane. A change is kept only when the count falls and no new
  closed room or entry problem comes. A long hearth that leaves no lane where the structure does becomes a fire pit
  (D-132). Fires, doors, clipped pieces and the first chest never move; beds and fires are never left out. It runs in
  generate.js `finish` after every pass that sets furniture. clearLanes moves loose furniture aside (`moveAside`)
  before it takes any out; the late clearEntries and clearLanes calls at the end of kitbash.js apply are gone.
- 70f1bd8 D-148 (decorate.js): `TABLE_BED_TIGHT` removed; tableSure keeps 0.9 m from a bed on every try; what still
  closes a lane is moved or left out by openWays.
- 2e61017 D-149 (generate.js tidyFurniture): a lone chair stays where a wall, seat, stand, chest, window, light, rug or
  station is within 1.2 m of its box; bare rugs stay up to 67 % of a design's rugs. Corpus (1,739 vanilla builds,
  pivots only, device script `~/vhrug/rugmine.js`, kept off the repo): 69 % of roofed chairs stand 2.3 m or more from
  a table and 3 m from a fire, 99 % of those with one of those kinds within 1.6 m; 67 % of 14,540 flat rugs have no
  furniture on them (3,457 more hang on walls).
- 6398565, 6b61120, 3c20fd1 (layout.js, lab/reach.js): rooms are opened before single pieces (a smithy lost its forge
  to a closed room); the smallest blocking group, and a set's blocking pieces before the whole set, go first; a moved
  piece keeps within 5 cm of what shows of walls, beams and posts (the Plains pool's intoWall) and of stations
  (onStation); sets built of building pieces never move (a beam shelf moved into a tower room failed headroom);
  station extensions (`_ext`) are no reach target in walkMap or lab/reach.js (they work by standing near their
  station and are never used).
- 90ca538, 4895d1f lanterns (decorate.js, lights track's file): no Dvergr wall lantern was ever put up. mountSpots
  asked the wall to reach 1.2 m over a hung piece's hook; a hung lantern now needs the wall to the hook. clearOfRelief
  refused every lantern: HUNG_CORPUS gets the lantern's corpus clip, 18.8 cm (data/kitbash-interior.json, 462
  lanterns, 395 on the wall; D-127, marked as D-098 clips). Its back plate now sits at the wall's middle (it hung half
  through the wall, back out the far side). Floors with a Dvergr wall lantern: 0 to 17 % (essentials, 378 floors).

Reach, one seed (234 designs), round 4 tip then this round: main pieces out of reach 255 of 1,395 to 7 of 1,355
(extensions no longer counted); room rects 24 to 4 of 323; pieces in entry zones 5 to 0. Full run (702 designs):
769 of 4,067 to 42 of 3,848; 71 to 24 of 987; 37 to 1. What remains: 17 rooms and 25 pieces in 7 middle-eastern
court-flat-stone homes and taverns (the court plan joins its rooms through 1 m gaps between thick stone walls inside
the room rects; a plan matter, furniture is left as it is); 3 rooms and 6 pieces on the upper floor of workshop
Mistlands s3 seed 528; 4 single rooms in Swamp and Mistlands longhouses; one double bed in a Mountain home; the upper
bunk room of tavern Mistlands s3 seed 64 at one seed (beds that fit nowhere are never left out). The one entry-zone
piece is a library set's half wall.

Full checks at 3c20fd1 (round 4 in brackets); the lantern placement fix 4895d1f after it passed test_structure, the
Plains pool and one check_interiors seed: check_set 224 of 225, overlap 1 (same); test_structure 36 hold; test_sizes
0 off; check_interiors overlap 4 (3), floating 8 (7), bareFloors 9 (10), stairs 0, mountOnOpening 0, door 0, every
checks.js column 0; furniture per design d2 22.1 (21.5), d3 39.9 (38.7); pools Norse Meadows pass (prefabsPerD3 13.2,
setShare 0.342), norse-forest Black Forest FAIL setShare 0.324 under 0.34 (0.345; prefabsPerD3 11.7), middle-eastern
Plains FAIL prefabsPerD3 10.5 under 11 (10.3); test_stands 3 --gate misses: flat bench 6.5 (6.3), flat chest 3.8
outside 0 to 3.5 (4.4), wall station 29.4 (31.4), wall door 8.7 outside 2.1 to 6.6 (in), stands q3 23 outside 24.5 to
73.5 (in); essentials: tables dressed 35.7 % (37.3), tables turned 23 (23.2), seats turned 31.8 (28.3), rugs layered
18.6 (20.9), chests stacked 47.6 (47.2), homes with no light 39 % (36), longhouses 25 (25), taverns 6 (3), smithies 42
(44), storehouses 50 (50); test_variance (at 6398565) hall 0.45 and 0.42, home-b s3d3 0.38 (closest 0.76); compare_page all same;
gen-test 5 of 5 byte for byte; dotnet build 0 errors, 43 warnings. Pool audits report nestBroken 8 to 18 per pool
(never gated, D-132; round 4 0): pieces moved between stages.

Furniture per d3 design (item 3): 38.7 to 39.9 on the full run, one seed 42.3 to 42.8. Per d3 design (one seed, 78
designs, measured at a29e5b1) the budgets leave out 3.5 lights and 1.3 rugs and openWays 1.8 pieces. In the 27 d3
designs of the Plains pool (6398565) clearLanes moved 27 pieces aside and took 8 out; openWays moved 23 and left 41
out. Round 3's 47 came before the light and rug budgets.

Plains pool (item 2): what the d3 rooms lost against 5b03e83 (11.1) is mostly light kinds (wall torches 5 designs,
standing torches 3, candles 2: the light budget, with all three woodworker stages and smithy s3 drawing a dark
building at the corpus share of 21 %), chests and an armor stand (lanes), and library ledge sets. The lanterns bring
10.3 to 10.6; openWays costs 0.2 (10.8 with it off). Light kinds are not what holds the pool down: 56 % of its
designs with two lights or more use one kind against 30 % of 1,134 corpus builds (median two kinds;
`~/vhrug/lightkinds.js`); a bonus in trimLights for a kind the building lacks changed nothing, as each room's kit
places one kind. The gate is not lowered.

Black Forest setShare: 444 set pieces of 1,319 decor (round 4) to 431 of 1,362. The woodworker loses its library
dining set and stations at s2 and s3 (its door opens into a corner closed by furniture; openWays leaves them out
under D-148); the decor kept by D-149 and by moving instead of removing is not from sets.

Ideas measures (ideas.md commands gen_pool, learn_interior and ext.js, 612 designs; main 509744e as round 4 had it,
then 4895d1f; corpus in brackets): home rooms with a wall torch 81 to 45 % (36), a candle 49 to 7 % (0 to 7), a Dvergr
wall lantern 0 to 6 % (sleeping rooms 7, taverns 21; corpus wall lights 40 % lanterns); lights per 10 m2 in home
rooms, median, 2.92 to 2.18 (the learner's count of all items); tables on a rug: piece_table 68 to 31 %, round tables
79 to 18 % (27); relx: chests stacked 38 to 42 % (58), beds lit 35.6 to 12.9 (14), seats by a wall 28.5 to 30.9 (42),
seats off axis 33.8 to 27.4 (42), tables off axis 25.2 to 26.0 (29), rugs off axis 32.5 to 42.6 (31), windows lit in
pairs 5.4 to 0 (3). The culture miner's rows (seats at tables, tables dressed, rugs layered) were not run again; the
essentials figures above stand for them.

Renders: /tmp/int5-renders (not kept): households-home-meadows-s2d3-7 and views-tavern-swamp-s3d3-11, after and
round 4. The households house has one door (x 0, the long wall); the bed of neat and cosy stands 1.85 m or more to its
side, out of the entry zone, in round 4 and now; the right-hand steps in the round 4 sheet are outside the plain end
wall.

Open:
- Pools: middle-eastern Plains prefabsPerD3 10.5 under 11; norse-forest setShare 0.324 under 0.34.
- Court-flat-stone plans (middle-eastern) hold most of what stays out of reach; the plan, not the furniture.
- Decorator placers still fill doors' corners and lanes first and leave openWays to put them right; placing lanes and
  entry zones before big furniture in lib/decorate.js and the library would cut the leave-outs (1.8 per d3 design).
- test_stands wall door and stands q3 newly outside their bands; nestBroken reported 8 to 18 per pool.

## Integration, round 6 (2026-11-11, branch design/integration2 from abad43c)

Merged with --no-ff, no conflicts: 9432380 design/wip-lab-page2 e688583 (lab-page.md), 1091153 design/wip-windows
56594de (windows.md). Bundles rebuilt after each merge; compare_page all the same each time. design/wip-hub-gen and
design/wip-models are left for round 7. Fix clusters (D-123):
- a6ffb0d nothing left in the air (layout.js openWays and groupOf, generate.js finish and dropOrphans, decorate.js
  storeStacks, details.js benchByDoor). Traced on one check_interiors seed after the merges: floating 7, overlap 2,
  entryZone 1. A set piece that says it rests on another (`rest: 'on'`) goes with the piece it rests on and only that
  piece (`wRestsOn`, the audit's kbRests reading); a mug stand on a chair's box moved with a dining set it did not stand
  on. A set's plank top resting on its chests is no longer fixed in openWays, so drawers move whole (their two ledges
  were left at 2.42 m). Spits and cauldrons (`at: 'fire'`) never move off their fire; when a hearth becomes a fire pit
  one goes over the pit and the rest go with the hearth. A chest the decorator stacked (storeStacks) carries
  `stacked` on its piece and goes when its lower chest is taken out (a barrel at 2.0 m over a library crate). dropOrphans
  reads a top piece as the audit does (on a table's box within 5 cm and 15 cm of its top, a built counter, a wall
  within 0.4 m spanning its height), sets one up to 0.3 m off onto its table's top, and leaves set pieces with a rest to
  the rest check in finish; the old reading (any table within 1.6 m, any wall within 1.2 m) dropped set pieces that
  stood where the audit has them. The door bench keeps off the second leaf of a wide entrance (windows track) and
  0.15 m off the door torches.
- f343997 court plans (D-152, lead's call): the walls between a court's gallery and the rooms behind it are planks
  (`wallSegment` style override). The rooms behind a 2 m gallery are 2 m deep; a 1 m stone wall each side left them
  1 m clear. The paved yard is a walk: `b.walks` (generate.js), walked by layout.js walkMap and lab/reach.js, never a
  room and never counted. The yard well goes in only where it leaves 0.9 m round it: a home's yard is 4 m and the well
  3 m, so homes have an open paved yard; caravanserai-size yards (8 m) keep it. Court homes and taverns, Plains s2 and
  s3, seeds 7, 8, 25, 26, 61, 62: no room or piece out of reach (round 5: 17 rooms and 25 pieces in 7 designs).
- a30494a layout.js: a set in a lane that finds no spot whole moves piece by piece (part group) before anything is
  left out. The bench stand cap in the same commit is taken back out in d75c7d8: any cap on bench sets (at the corpus
  share 3.7 %, at twice and at five times it) put the Norse Meadows pool's set share at 0.319 to 0.323 under its 0.34
  floor (0.376 without it).

Before and after (round 5 record, then d75c7d8; full runs, 702 designs for check_interiors):

| Measure | Round 5 | Round 6 |
|---|---|---|
| check_interiors floating | 8 | 3 |
| overlap | 4 | 4 |
| bareFloors | 9 | 10 |
| door | 0 | 2 |
| stairs | 0 | 1 |
| entryZone | 1 | 1 |
| rooms not reached | 24 of 987 | 6 of 987 |
| main pieces not reached | 42 of 3,848 | 11 of 3,898 |
| furniture per d2 / d3 design | 22.1 / 39.9 | 22.0 / 40.6 |
| Norse Meadows pool prefabsPerD3, setShare | 13.2, 0.342 pass | 13.0, 0.376 pass |
| norse-forest Black Forest | 11.7, 0.324 FAIL | 11.7, 0.366 pass |
| middle-eastern Plains | 10.5 FAIL, setShare n/a | 11.7, 0.502 pass |
| test_stands misses at d3 | flat bench 6.5, flat chest 3.8, wall station 29.4, wall door 8.7, stands q3 23 | flat bench 21.8, wall station 32.0, wall table 15.5, flat share 82, stand on a stand 11 % |
| tables dressed, seats turned, rugs layered, chests stacked | 35.7, 31.8, 18.6, 47.6 % | 39.5, 30.6, 14.9, 49.2 % |
| homes, longhouses, taverns, smithies, storehouses with no light | 39, 25, 6, 42, 50 % | 36, 19, 6, 42, 53 % |
| test_variance hall s2 and s3, home-b s3d3 (closest) | 0.45, 0.42, 0.38 (0.76) | 0.45, 0.47, 0.39 (0.71) |

Other full checks at d75c7d8: check_set 224 of 225 (late 90 of 90, cultures 147 of 147), overlap 1 (same);
test_structure 36 hold; test_sizes 0 off; every checks.js column in check_interiors 0, mountOnOpening 0; hearths
spotmix homes 288, under 120 m2 against a wall 97 %, s3 middle 8 %, hallmix over 80 m2 middle 32 % (as round 4);
compare_page all the same; dotnet build 0 errors, 43 warnings; gen-test (tools/gen-test/run.sh) FAILS: LabEngine (Jint) throws in LabJint.Make on the rebuilt lab.js (exit 134), cause not traced yet.

Where round 6 stopped: every fix and the record are pushed; the bundles (lab.js, web/index.html) are rebuilt locally from d75c7d8 and not committed, because gen-test fails on them. Left: trace the Jint error (likely a construct in the round 6 code Jint does not take, in layout.js, generate.js or lab/reach.js is not bundled), fix it, run gen-test again, commit the bundles.

One check_interiors seed (234 designs), round 5 tip, the two merges, then a6ffb0d: floating 1, 7, 0; overlap 1, 2, 1;
bareFloors 1, 3, 3; reach rooms 4, 6, 6 of 323; d3 furniture 42.8, 42.3, 43.7. The windows track's own run gave
entryZone 9 on its base; after the merges and these fixes it is 1 on one seed and 1 on the full run.

Item 2 of the brief, what was found:
- Black Forest setShare: 0.324 to 0.366. The gain is a6ffb0d: dropOrphans no longer drops set pieces the audit reads as
  standing, and sets move whole. The woodworker s3 (seed 21, norse-forest) still leaves out its BK-workzone (workbench,
  chests) and the stonecutter: a 6 by 6 m main room with a wing whose way in runs through them, and no spot in a reached
  place holds the set whole or piece by piece. Its s2 keeps the workzone. Not fixed.
- Plains prefabsPerD3: 10.5 to 11.7, from a6ffb0d (set pieces kept, KS stand sets among them). The light budget was not
  changed; the corpus count of light kinds per room (round 5: 56 % of the pool's designs with two lights or more use
  one kind against 30 % of 1,134 corpus builds) was not compared again this round.
- test_stands: wall door and stands q3 are back in their bands (stands q3 28). Flat bench goes from 6.5 to 21.8 %: the
  old dropOrphans dropped bench mug sets (KS-b-two, KS-b-mug; 147 of 159 stands on benches in a 54-house sample), so
  round 5's figure was what was left after that. The pick weights do not hold them down (bench weight 0.45 to 0.1 gave
  18.4 %): bench sets fit where table and shelf sets do not, and the room keeps picking until its count is met.
- Mistlands workshop seed 528 upper floor: still 3 rooms and 6 pieces. The longhouse single rooms (lamari 211, byzantine
  116 and 312 in the full run) share the court's cause: a 2 m wide nave end (z -1 to 1) between 1 m black marble or
  stone walls, 1 m clear, closed with no furniture in it. Not fixed this round; the court fix (planks for inner walls)
  does not apply to outer walls.
- Decorator entry zones up front (decorate.js): not done. openWays still puts right what the placers leave in lanes.

Open:
- test_stands: flat bench 21.8 % (band 1.7 to 5.9) against the Norse Meadows set share; wall station 32.0, wall table
  15.5, flat share 82, stand on a stand 11 %.
- Narrow wings between thick walls: nave ends in Mistlands longhouses, the Mistlands workshop's upper floor.
- check_interiors door 2 (a flat stand and a chair in a door box), stairs 1 (a wood stack by a tavern stair), floating
  3 (two outdoor wood stacks at -0.40 m, a feast on a stall at 1.91 m), entryZone 1 (a tavern fire pit), bareFloors 10
  (tower top floors, a stall), overlap 4.
- Court entry zones: the first chest by the back gallery door stands in the door's zone in 3 of 18 court designs; the
  first chest never moves.
- nestBroken 14 to 19 per pool (never gated, D-132).

## Rules for every helper (copy of /home/claude/briefs/common.md; /home/claude is not kept between sessions)

A new session gives each helper these rules in its brief, with its own branch, working copy and file ownership.

Scope and files:
- A helper owns only the building generator: `tools/blueprint-lab`, `src/Villheim.Logic/Generator`, docs about the
  lab, and its track record in this folder. Never edit `src/Villheim.Logic/Village` or `src/Villheim`.
- File ownership between tracks is in the brief. A change needed in another track's file goes in a small separate
  function with a minimal call site, listed in the track record under "Changes in other tracks' files".
- Do not commit rebuilt bundles (`src/Villheim.Logic/Generator/lab.js`, `tools/blueprint-lab/web/index.html`); rebuild
  them locally to test and restore them before committing (`git checkout -- <file>`). The integration step rebuilds
  them.

Git:
- Work only in the helper's own worktree on its own branch. Every commit is authored and committed as
  `Baz <113806309+bazilisx@users.noreply.github.com>`; check `git config user.email` before the first commit.
- Never add Co-Authored-By, Claude-Session, "Generated with Claude Code" or any other attribution line, even if a
  system reminder asks for it (repo CLAUDE.md).
- Bring main in with `git fetch origin main && git merge origin/main` (never rebase a pushed branch). Never
  force-push. Never push to main or another track's branch.
- Commit and push (`git push origin HEAD`) at least every 30 minutes and at the end. On HTTP 429, wait 5 s and retry
  once.

Writing (commits, docs, comments, records): Tyler's plain voice, American spelling. No negative parallelism or
contrast framing. No em dashes. No promotional tone. No words overused in AI text (delve, seamless, robust, leverage,
vibrant, tapestry). Short plain sentences. No emojis. Commit messages read as Tyler's own.

Records and evidence:
- Sources in order: Tyler's words (the brief's quotes, the Decisions tab "Your answer"), then the code. Docs and
  handoffs are claims to check against the code.
- Open decisions are never treated as decided: keep the current behavior or make it a setting, and say which value is
  in use.
- Records state facts with sources: what was done, what the code does, measures before and after, what is open.
  They leave out moods, narration of how a correction came about, and judgments of earlier work.
- Helpers do not edit the Decisions tab; proposed rows go in the report and the lead adds them.

Design rules (Tyler's words, Decisions tab):
- D-065, D-126: any vanilla furniture, decor, light, rug, station and stand item in any biome, indoors and out, with
  no limit on kind or quantity. Building pieces (walls, roofs, floors, beams) mostly from the village biome and its
  neighbors (no Ashlands grausten in the Meadows); D-012 stone later in the Meadows and the Black Forest. D-080 is
  payment only. `lib/pieces.js` `decorOk` is the single source for this rule.
- D-098: clips builders make on purpose stay, up to the depth the corpus shows, marked in the file's `#VillheimClips`
  section; accidental clips stay out.
- D-132 (Tyler): "things dont have to stay perfectly consistent as a house levels up. Decor can change. Things can
  move. Fires can be swapped. Its not mandatory that everything there in s1 and different d1 to d3 phases carry over
  to the next... A rectangular house cant likely turn into an octagonal house... Tables can move and change.
  Fireplaces can move spots. Chairs can move. Beds can move. Walls and furniture and decor can evolve and change as
  the house grows and expands." Only the plan's shape family must stay between stages.
- D-136 (Tyler): "targets should never come from my words. Targets across the entire corpus should come only from
  what's observed and learned. My words are simply the launch point, but should never ever bias findings." His
  clarification: "my statement means 'dont let my words bias the lessons and findings'". The lessons drawn from the
  corpus come from what is observed; his decisions and rules still apply as given.
- D-127 (Tyler): "if the corpus builders do it, its allowed and you should mirror their work... if the corpus builders
  use clever tricks like clipping things into walls to create specific intentional designs, so should you. Always."
  An audit rule that refuses something corpus builders do on purpose is the thing to change (up to the depth and
  frequency the corpus shows, marked as D-098 clips).
- D-128: tie beams in halls and taverns and in houses large enough (size from the corpus), never small houses. D-129:
  keep unconfirmed stand items. D-130: mod side. D-131: wood hearths at s1, stone hearths at s2 and s3 acceptable in
  the Meadows and later biomes.
- Item stands (Tyler): item stands, especially itemstandh, as single stands and clusters are among the most common
  ways builders add depth and a lived-in feel; feasts on the Serving Tray are less common.
- Hearths (Tyler): home fires along walls, in alcoves, or in wall hearths with chimneys; middle fires for social
  rooms; smoke outlets follow the fire.
- Drivers: messy realism, environmental storytelling, variance by culture, village, family and household traits
  (never professions), professional room layouts, no fixed-interval rules. Goal: rooms good enough for the front page
  of r/ValheimBuilds.
- The corpus is on Tyler's PC (`C:\Users\tyler\Downloads\Villheim-blueprints`, reached only through the remote device
  tools as `$HOME/mnt/Downloads/Villheim-blueprints`). Read only. Never commit blueprint files from it. Never use the
  OverDrive BiomeBlueprints pack.

Browsing: Tyler (2026-11-10): "please use the chrome browser on my PC so you dont have to ask for permission to view
every single variant website link and image individually." Read websites and images through Claude in Chrome
(mcp__claude-in-chrome__* tools): read the anthropic-skills:chrome-browser skill first, load the tools in one
ToolSearch call, work in a new tab of its own, read only (no sign-ins, forms or posts).

Machine and checks: the cloud machine has 2 cores and other helpers run beside each one. One check at a time, quick
checks only: `node lab/test_structure.js`, the pool gate on one pool (`node lab/make_testpool.js /tmp/<track>-pool` or
one `--culture/--biome` pool), `node lab/check_interiors.js` on a small sample, plus the track's own measure. The full
run is at integration. `node_modules` in `tools/blueprint-lab` is a link to a shared install; leave it. Scratch output
in `/tmp/<track>-*`.

End of task: update the track record in this folder (what was done with commits, measures before and after, checks
and results, open problems, next task), commit and push; then a report to the lead under 300 words: what a person
would now see differently, measures before and after, checks and results, the last pushed commit, changes in other
tracks' files, proposed Decisions rows, what is left.

## Open decisions from these tracks (Decisions tab, 2026-11-11)

D-133 how often a fire moves between stages (in use: A, `HEARTH_MOVE`); D-134 the stand pass removing other passes'
stands (in use: A); D-137 to D-142 hubs; D-144 to D-147 landscaping; D-148 a table 0.6 m from a bed when 0.9 m leaves
no spot (in use: A, `TABLE_BED_TIGHT`); D-149 lone chairs and bare rugs; D-150 deeper eaves; D-151 glass windows.
Answered and not built: D-128 tie beams (the size of a large enough house is open); D-130 village fires kept lit (mod
side). Proposed in ideas.md and not yet in the tab: s3 upper storeys or lofts (against D-069), tilted trim pieces.

## How to resume (to save usage)

- Tracks that edit the same files go in turn. Files by track: lights and kitchens `lib/decorate.js`, `lib/kitbash.js`;
  trim and banners `lib/details.js`, `lib/motifs.js`, `lab/mine_motifs.js`; storeys, roofscape and eaves
  `lib/styles.js`, `lib/generate.js`; windows and wide doors `lib/generate.js`, `lib/details.js`; yards
  `lib/yards.js`; stands `lib/stands.js`, `lib/persona.js`; hearths `lib/generate.js` hearth parts; landscaping a new
  `lib/landscape.js` after the yard.
- One full check run per merge: from tools/blueprint-lab, node lab/check_set.js 2, node lab/test_structure.js,
  node lab/test_sizes.js, node lab/check_interiors.js, node lab/make_testpool.js /tmp/p (plus --sample for the Black
  Forest and Plains pools), node lab/test_stands.js 3 --gate, node lab/essentials.js, node lab/test_variance.js,
  node lib/build_engine.js, node lib/build_web.js web/index.html, node lab/compare_page.js; from the root,
  VH_GEN_OUT=/tmp/g tools/gen-test/run.sh and dotnet build Villheim.sln -c Release (43 MSB3245 warnings come from
  assemblies missing on the cloud machine; main gives the same).
- Republish the lab page (artifact slug ebd4fcaa-85d1-452f-9d94-251d2687967c) from tools/blueprint-lab/web/index.html
  after merges.
- Judge results by looking: lab/households_sheet.js and lab/render_views.js render one house for six households and
  four views; Tyler judges the Interiors tab, so describe what changes visibly.

## Resume prompts

Paste one into a new Claude Code session on bazilisx/villheim (main), after it reads CLAUDE.md. Each helper gets the
rules above in its brief. Numbers are from ideas.md unless named.

**1. Lights and kitchens (ideas gaps 8 and 9).** "Resume from docs/handoffs/2026-11-10-design/ideas.md, gaps 8 and 9.
Lights: the pool has 0.7 lights per 10 m2 (s3 0.9) against 0.2 to 0.4 in every corpus group; candles in 36 to 77 % of
rooms against 0 to 7 %; wall torches in 77 to 86 % of rooms against 7 to 25 %; no Dvergr lanterns against 17 to 30 %.
Give each room kind a light budget from the corpus in lib/decorate.js and lib/kitbash.js. Kitchens: corpus kitchens
have a butcher table 54 %, oven 32 %, prep table 26 %, mortar 22 %, the generated ones none of these; add a cooking
corner in homes and taverns and the hearth piece in larger rooms (stone from s2, D-131). Measure before and after with
the ideas.md method, run the quick checks, write the record."

**2. Trim and banners (ideas gaps 4 and 5).** "Resume from ideas.md, gaps 4 and 5. Windows, corners, wall tops and
inside corners are dressed 92 to 100 % in the pool against 60 to 78 % in the corpus, with no tilted piece in 147,914;
banners in 6 % of buildings against 53 % of Norse buildings. A trim budget per building from household and culture
traits, a bare share per feature kind at the corpus rates, the front richer than the back (lib/details.js,
lib/motifs.js, lab/mine_motifs.js); banners by doors and gables from d2 and along hall and tavern walls. Tilted pieces
wait for Tyler's answer (proposed row in ideas.md)."

**3. Storeys, roofscape and eaves (ideas gaps 1, 2 and 7).** "Resume from ideas.md, gaps 1, 2 and 7. s3 buildings
have an upper storey 27 % of the time against 75 % of Norse corpus buildings (height 5.8 m against 9.3); 2 ridge lines
and 0.5 valleys per build against 4 and 2.2. First put the s3 upper storey row to Tyler (D-069 keeps s1 and s2 one
storey). Then wings at their own ridge heights, cross gables and lean-to outshots (lib/generate.js, lib/styles.js).
Deep eaves only after D-150 is answered."

**4. Windows and wide doors (ideas gaps 3 and 10).** "Resume from ideas.md, gaps 3 and 10. A window kit per building
by culture and household (single 1 m lights most often, 0.5 m slits, 2 m tall lights in halls and at s3), openings at
the corpus count per wall run (0.56 against 0.31), shutters, arches where D-012 allows stone, iron grates; glass after
D-151. A 4 m entrance on halls, taverns, barns and large s3 homes (42 % of corpus door motifs against 8 %); every door
stays usable (D-096). Files lib/generate.js and lib/details.js: run it before or after track 3, on its own."

**5. Yards (ideas gap 6).** "Resume from ideas.md, gap 6. Liked corpus builds have decks and rails 50 %, low walls 37
%, steps 55 %, fences 9 %, gates 3 %; the pool has rails 18 %, low walls 8 %, fences 30 %, gates 23 %. In lib/yards.js:
fewer closed fenced yards, decks and steps at the door, low log or half walls, a seat and a work corner by the door,
fence pieces drawn from the corpus kinds."

**6. Item stands, round 4.** "Resume from docs/handoffs/2026-11-10-design/item-stands.md (part 3) and README.md
'Integration, round 3'. Gate misses at d3 (test_stands.js 3 --gate): wall station 38.3 % (corpus 16.9), flat bench
8.9, wall wall 16.6, wall chest 2.9, stands q3 21. Count on the device how close corpus builders hang wall stands to
torches and casks, then set lib/stands.js wallBusy's 0.6 m margin from that count (corpus gap between wall stands 0.31,
0.49 and 0.97 m at the 10th, 25th and 50th percentiles; D-127). Then single floor stands against a wall at the corpus
rate (19 % of flat stands, 140 builds), and more places in taverns and longhouses for the top quartile. D-134 is open
(in use: A)."

**7. Hearths, open items.** "Resume from docs/handoffs/2026-11-10-design/hearths-lighting.md, 'Next steps'. Grausten
fronts are skipped in two-storey Ashlands homes (storey under 4 m); fronts skip where the rake's 45 degree beams cross
and on raised floors over 1 m; the moved-stack path needs a sample of 12 seeds or more, Meadows to Plains, to check the
stack share against the corpus 3 %; the floating woodpile on sunk stone flags needs the yard's ground in the audit
(lib/yards.js, lib/audit.js owners). Baltic Ashlands homes failing support and stability on ashwood beams go to the
walls and decks owner. D-133 is open (in use: A)."

**8. Hubs, generator.** "Resume from docs/handoffs/2026-11-10-design/hubs.md once D-137 to D-142 are answered (read
the Decisions tab). Add the hub type (lib/request.js refuses it now), the s1 camp generator (fire, shelters round it,
benches, notice board, chests), then the round line from hub1 on one plot sized for s5, then the other forms in the
table. Checks: shape family kept, the s1 camp inside the s2 wall line, the main fire's place by line, s5 the largest."

**9. Landscaping pass.** "Resume from docs/handoffs/2026-11-10-design/landscaping.md. Build lib/landscape.js after
the yard from data/landscape/placement-plan.json, a landscape mark on every greenery piece written as a
#VillheimLandscape list, then render and measure against the plan. D-144 to D-147 are open: keep the plan's
recommended values as settings and say which are in use. The gatherer and forager changes are mod side, for the mod
session."

**10. Not started.** Tie beams in halls, taverns and large houses (D-128, the size from the corpus); tightening the
piece models on Tyler's PC (ROADMAP design item 2b: rerun lab/extract_models.py with a finer proxy, split prisms into
boxes in lib/mesh.js); growth for the weak lines under D-132 (only the shape family stays; temples and Middle Eastern
homes still change family); assemblies and room layouts per culture from the corpus (research.md); the interior study
into assemblies and room templates; store rooms at d3 and window boxes.
