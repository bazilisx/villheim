# Building details

The trim, framing and small additions the blueprint lab puts on a generated building so it looks built by hand.
Code: `tools/blueprint-lab/lib/details.js` (called from `lib/generate.js`). Started 2026-11-09 from Tyler's request for
"more dynamism, more human touch, more texture, more nuance" in windows, doors, stairs, walls, roofs, gables, decks
and yards.

## Where the rules come from

1. **The corpus.** 557 well-liked community builds (Tyler's Yes, or the top 40 % of valheimians builds by downloads),
   vanilla pieces only. Scripts in `/home/claude/study` during the session (`rel.py`, `openings.py`, `corners.py`,
   `pair.py`, `grammar2.py`); they read `corpus.json` from `lab/build_corpus.py`. Each feature (a window opening, a
   door, an outside corner, a gable end) is read in its own frame: along the wall, out from it, up from its foot.
2. **Builder guides and video transcripts** on the open web (sources at the end).
3. **Norse building practice:** Viking halls, Norwegian farm buildings (loft, stabbur), log building.

Reddit and YouTube pages cannot be read by the session's web tools. Pictures Tyler saves into a shared folder can be
studied the same way.

## What the corpus says

Share of features with the piece, counted once per feature.

| Feature | What builders put there |
|---|---|
| Window openings (22,032 in 363 builds) | The opening is 1 m tall (48 %) or 0.5 m (44 %), its foot 0.5 m or 1 m up the wall. Poles beside it (wood pole 40 %, 2 m pole 35 %), a beam under or over it (32 %), 1 m beams (15 %), a 1 x 1 floor as a sill inside or out (7 %), 45 degree beams (6 %), stone arches in stone walls (4 %), glass (4 %), item stands on the sill (2 %). Trim stands 0.25 to 0.5 m proud of the wall. |
| Doors (2,695) | A floor in front (43 %), a beam over it (43 %), 2 m posts at both sides (34 %), 1 m beams (24 %), a stone floor step (15 %), a roof piece over it (14 %), stairs up to it (12 %), a wall torch beside it (8 %). Gates are used as doors in half the builds, often two side by side. |
| Outside corners (8,312) | A post on 64 %: 2 m wood pole 29 %, 1 m pole 11 %, log pole 9 %, iron pole 5 %, dark wood pole 6 %. Beams in the wall plane at 0, 1 and 2 m on either side. |
| Gable ends (1,359) | The ridge cap turned at the apex (Wood Roof Cross, 24 %), a 45 or 26 degree beam along the roof edge (bargeboard, 15 %), posts in the gable wall, a beam across at the wall top. |
| Roof edges | A beam along the eave on 14 % of roof pieces only: the corpus does not use fascia boards much. |
| Pieces our generator never used | 1 m beams (76 % of good builds), 2 m poles as trim (73 %), 26 degree beams (57 %), 45 degree beams as braces (55 %), log poles (37 %), gates (39 %), Wood Shutter (17 %), carved dark wood dividers (25 %). |

Measured sizes that were wrong in `lib/pieces.js`: `wood_wall_quarter` is the 1 x 1 m "Wood Wall 1x1" (its neighbors
stack 1 m apart up and sideways); the catalog had it as a 2 x 0.5 m strip. Generated windows had used it as a 0.5 m strip over a 2 m
opening, which in the game left a 1 m block in the middle of the window. `wood_window` is the 1 x 1 m Wood Shutter (4
wood, 2 bronze nails, so Black Forest on).

## What the generator now adds

By stage: s1 keeps the plain shell with frames on its doors; s2 and s3 add the rest. Decor stages d2 and d3 add the
things a person would set outside (a lamp, a bench). Cultures: the northern timber cultures get everything; stone and
flat-roofed cultures keep their own forms and get the door and window frames only.

| Detail | Pieces | When |
|---|---|---|
| Window | A 1 m tall opening from 1 m up (was 0.5 m). Twin lights with a 1 m post in the middle; a single 1 m light beside a Wood Wall 1x1 on small and early buildings. | always |
| Window frame | A beam under (sill) and over (head) the light, 0.1 m proud of the wall, sized to it (1 m boards on a single light where posts carry them); 1 m posts at its sides where the culture has no timber frame, never on log walls. | s2 on, or timber-frame cultures |
| Shutters | Two Wood Shutters flat on the wall either side of the window: both or none, only where a plain bay is beside it and the bay past that is no window. | s2 d2 on, Black Forest on, 60 % of buildings of the northern cultures |
| Door frame | 2 m posts at both sides of the door piece's own opening (a cloth door hangs beside the wall's middle), a beam over it with its underside at the door's top. | always (posts where there is no timber frame) |
| Door step | Two beams laid along the threshold of a ground-level door (a 2 x 2 floor there read as a mat), unless a porch, stair or walkway is there. | always |
| Door hood | A 26 degree roof piece falling away from the wall, its low edge level with the door's head 2 m out (the doorway keeps its headroom), on a 26 degree rafter each side inside the frame width. Only with the frame, never where an eave or porch is less than 1.5 m over the door. | s2 on, northern cultures, 70 % |
| Lamp | A pair of standing wood torches just outside the door posts; with a frame only; on a raised house only where a landing is. | d2 on |
| Bench by the door | A wood bench or sitting log against the wall beside the front door, facing out. | d2 on, homes and halls |
| Corner posts | Posts the full height of the walls on every outside corner, from the ground under a raised floor. | timber walls without a frame (log poles on log walls: without them the decorator set chests into the log corners) |
| Wall bands | A beam along the foot of every wall and every upper floor line. | plank and half-timber walls, s2 on |
| Bargeboards | A 45 or 26 degree beam along each roof edge at the gable end. | northern cultures, s2 on |
| Crossed gable boards | The game's Wood Roof Cross on the ridge at the gable (Norwegian vindskier). It is 4 m across and rises 1.5 m over the ridge, so it is rare. | Norse, Slavic, Baltic and mountain cultures, one building in five, where no dragon head stands and no gable motif has its own apex piece |
| Loft window | A 2 m opening with a post in the middle, 1 m up a gable that is at least 4 m tall, framed by beams. | northern cultures, s2 on |
| Rafter tails | A sloped beam at every seam of the lowest roof row, 0.7 m out past the roof edge and under it, never over a door. They read as planks lying on the roof in renders; kept because the canopy beds depend on them (see Motifs, still to do). | northern cultures, s2 on, roofs that end at the wall |
| Ridge beam ends | A 1 m beam where the ridge would run out past each gable, 0.55 m out. | northern cultures, s2 on, where no dragon head stands |
| Gable truss | A king post up the middle of the gable face (above the loft window when there is one) and collar beams across at half height. | northern cultures, s2 on, 60 % |
| Leaning hall posts | Off: they ran from the eaves past the wall foot and across windows. To redo as short knee braces in the wall plane. | |
| Upper gallery (svalgang) | A balcony three bays wide over the front door on posts from the ground, a beam under its edge, a rail round it, a door from the upper room. Below, it roofs the entrance. | two-storey homes, storehouses and taverns of the Norse and Slavic cultures, s3 (s2 at d3), 75 % |
| Gabled porch | Posts 4 m apart 2 m out from the front door, beams to the wall and across the front, a small 45 degree gable roof with its ridge running out from the door, a gable over the open front and one closing it against the wall, a step. The entrance dormer of the community longhouses in the corpus. | northern cultures, homes, longhouses, taverns and temples, s3 (s2 at d3), 50 %, ground-level doors |
| Back room | A wall across the main wing 4 m from one end with a door in its middle bay. The decorator furnishes both rooms. | homes and taverns with a main wing at least 10 m long, s3 (s2 at d3) |
| Fire kerb | Four beams round a fire pit on the floor, so it reads as a hearth set into the floor. | d2 on |
| Hall benches (pallr) | A platform 0.3 m up and 1 m deep along the long walls of a hall, on short beams; beds, chests and benches against the wall go up onto it, the platform widened under them. | longhouses and halls, s2 on |

Every check in `lib/checks.js` still passes on the review set (225) and the culture samples (147), and the interior
checks are unchanged. The rules were revised on 2026-11-09 after a review of the component bench (`lab/bench.js`).

## Motifs: whole assemblies from the best-liked builds

The rules above put one kind of trim on every building. Motifs are the trim real builders put round one window, one
door, one outside corner, one gable end or one stretch of eave, taken whole from the corpus and built again on a
generated building (the room templates of `docs/INTERIOR_DESIGN.md` applied to the outside).

### How they are mined

`lab/mine_motifs.js` (Node) reads the 543 well-liked builds (Tyler's Yes, or the top 40 % of valheimians builds by
downloads; 60 to 6,000 pieces; no modded pieces) from their .blueprint files, so tilt and scale are known. Each build
is turned so its walls run along the axes. Then, per feature:

- **Window:** a gap 0.4 to 2.2 m tall between wall below and wall above in 0.5 m columns of each wall plane, the same
  gap over neighboring columns one opening. Frame: the bottom middle of the opening, on the wall's middle plane.
- **Door:** each door piece's opening (two doors side by side in one wall are one 4 m doorway), ground floor only,
  up to 1.6 m above the ground.
- **Outside corner:** two wall planes meeting at the foot of the walls, with the building behind both.
- **Gable:** the last ridge cap of a ridge line, with a gable or wall face under it; the frame is on the face.
- **Eave:** the lowest roof piece of a slope, one 2 m bay, with the wall face under it.

The frame is a along the wall, o out from it, h up from the feature's foot. The side of a wall that is outside is the
side with less floor under and less roof over it, 1.5 to 5.5 m out. Inside the region read round the feature, only
the trim that feature takes is kept: timber, lamps, carvings, banners and signs everywhere; sills, shutters and glass
at windows; steps, stairs and a hood at doors; log ends at corners. Everything else nearby (stairs passing by, a deck,
the next roof) holds things up but is not part of the motif. An assembly is dropped when a piece is modded, tilted or
scaled, when a piece floats (touches neither the wall, the roof, the ground nor a piece that does), when two pieces
are through each other (one hidden inside another, such as an iron pole inside a wooden one, is left out instead),
when something blocks a doorway or covers more than a third of a window, or when nothing in it is trim.

Each assembly is turned the way round (mirrored or not) that sorts first, so a motif and its mirror image are one;
assemblies with the same pieces within a quarter meter are one motif, and within half a meter they are one under the
most used form. A motif keeps its pieces (the example from the best-liked build that uses it), the opening, slope or
overhang it fits, the wall it was on, its earliest biome, how many builds and uses it has and its source builds.
`data/motifs.json` holds the best-ranked 700 windows, 110 doors, 131 corners, 300 gables and 300 eaves (of 2,801,
110, 131, 525 and 1,690). Of 8,666 window openings 3,634 were clean; the rest were bare (2,366), tilted (904),
blocked (946), unsure of their outside (807), clipping (349) or busy (227). Doors are few: most doors in the corpus
are upper doors or double gates, and many have a deck or stair right in front.

IDs (MW-0001 windows, MD doors, MC corners, MG gables, ME eaves) stay with their motif from one run to the next.

### How they are chosen and built

`lib/motifs.js`, called from `lib/details.js`:

- Per building one family of trim: each feature kind and size picks once (a seeded draw weighted by the motif's
  weight), so every window of a size on a facade matches; the front may take a richer window than the other walls.
  Motifs from a source build already used count three times, so door, windows and gables tend to come from one
  builder's house.
- The motif's own random stream comes from the building's make, so the rest of the design draws as it does without
  motifs.
- How much: at most 3 pieces at s1, 5 to 7 at s2, 7 to 10 at s3 (more on the front); lamps and banners from d2,
  carvings from d3.
- Materials: the motif's main wood becomes the building's trim wood (its beam); a second wood stays where the biome
  has it (log poles from the Black Forest, dark wood from the Plains); stone pieces only on stone walls, from the
  Black Forest, on s2 and later buildings in Meadows and Black Forest villages (D-012); glass only where the culture
  glazes, from the Mountain. Window and door motifs from stone walls go on stone walls, from timber walls on timber.
- Fit: a motif fits openings a meter larger or smaller; pieces at the sides keep their distance from the opening's
  edge, pieces over it from its head, and what stood inside a different-sized opening is left out. Window motifs keep
  to the wall face (no struts, crosses or beams reaching out more than 0.75 m), corner motifs stay within 0.8 m of the
  corner, gable motifs stay inside the gable and under the roof line and leave the bargeboards to the rules, eave
  motifs stay under the roof (eave motifs are off for now: few fit a roof that ends at the wall, and they hardly show). The generator lays its own entry stairs, so motif stairs are left out.
- Each piece is tested as it goes in: nothing in a doorway's passage or over a stair, nothing through a wall, a door,
  a window, a roof or furniture, nothing into the building past the wall face, nothing below ground, and every piece
  touching the building or a placed piece. A motif that loses more than two pieces in five is not used and the rules
  do that feature. Windows under a lean-to stay plain.
- Wall motifs (windows, doors, corners) are fitted with the shell and put in after the rooms are furnished, so the
  decorator lays out the rooms as it would without them. A last pass takes out any motif piece that doubles another,
  is not connected to the ground, or would fall by its material (`checks.js` stability).
- `req.details.motifs = false` turns them off (the bench and before/after pictures); `VH_NO_MOTIFS=1` does the same
  for Node runs.

In a sample of 180 requests (every type, four biomes, three stages) 110 buildings carry at least one motif: windows
on 94, gables on 51, eaves on 10, doors on 10, corners on 8.

### Weights and scoring

`data/motif-scores.json` holds a weight per motif, written by `lab/motif_feedback.js`. Until there are scores each
weight is a seed: 0.5, plus a third for each doubling of the builds that use it, plus a little for how well liked
they are, less for a motif seen once only, one with more than ten pieces, or one of a single post or beam (0.3 to 2).
After scoring (a Motifs tab like the Rooms tab, downloaded as CSV): `node lab/motif_feedback.js motifs.csv`. A score of
1 or 2 drops the motif, 3 keeps it, 4 weights it up (1.5), 5 more (2); "copy this" adds a quarter, "busy" takes a
fifth off. `node lab/motif_feedback.js --first 70` picks a first batch (two in three windows and doors from timber
walls, no two alike); `lab/render_motifs.js` draws each motif on a plain wall bay, corner or gable at 40 px to the
meter.

The game's bundle and the request page carry the 701 motifs the generator can use, with their weights (about 230 KB,
`lib/build_engine.js`, `lib/build_web.js`); Node reads the full file through the same cut, so both pick alike.

### More kinds (2026-11-09, second pass)

D-065 lets exterior trim use every prefab that ships with the game, the way builders use them (lamps, banners, item
stands, Dvergr and trader decor, crafting stations as props, pieces set into walls). The miner now reads every model
in `data/piece-models.json` (the Ashlands ruin pieces excepted) and these features as well:

| Kind (ID) | Read from | Fit | Mined | Used by the generator |
|---|---|---|---|---|
| Outside corner (MC) | two walls ending at one point at any angle, the building in the wedge between them (90 on a box, 135 on an octagon, 157.5 on a 16-sided tower) | angle, wall type | 200 | 90 on timber walls, 135 on round plans (`roundTrim`) |
| Inside corner (MI) | the same with the building round the other three sides: where wings meet | angle, wall type | 124 | 270 on L, T, U and cross plans |
| Wall foot (MF) | one 2 m wall bay, what lies low along its foot and stands proud of it | wall type | 200 | flat strips only (a 1 m board path along the foot), s2 on |
| Wall face (MA) | a plain 2 m bay (no opening in it) with a lamp, banner, item stand, sign, carving, chain or cloth hung on it; the frame stands on the storey's floor | wall type | 300 | d2 on, two bays (four at d3), never on a corner bay or within 3 m of a door; an item stand only beside a lamp, banner or sign (the blueprint cannot hold its shield) |
| Eave (ME) | the lowest roof row, now fitted to the overhang (D-059 B): eaves 0.5 to 1.5 m past the wall's face | slope, overhang | 300 | northern cultures s2 on, on roofs with the 1 m eave; the beam-end rule does the rest |
| Porch (MP), stair entry (MS), balcony (MB) | a ground door read 5 m out with posts or a roof in front; a raised door with stairs; an upper door with a deck and rail | width, rise, run | 55, 99, 31 | data only (the lead's generate.js work) |
| Chimney cap (MH) | stone pieces standing over the roof, the top 1.2 m of the stack | section | 20 | data only |
| Dormer (MR), valley (MV), wall top (MT) | a short cross ridge lower than the main one; an inner roof corner piece; the top of a wall under a roof | slope | 6, 100, 200 | data only |

Each motif records the wall type of its source (plank, half-timber, log, stone, stone-base, read from the wall pieces
round the feature), and the generator picks corner, foot and face motifs from walls of the same kind (boards for
boards, logs for logs, stone for stone).

Deliberate clips: a piece set into the wall it stands on, or partly through another piece of the motif (a beam end in
a post, a sconce sunk in a wall), keeps how deep it went as a sixth field (`p.clip`, at most 0.4 m between pieces and
0.5 m into the wall). `lib/motifs.js` lets such a piece into a wall, post or beam no deeper than that, and the overlap
check in `lib/checks.js` allows the same depth. Timber through timber was allowed before and is not marked. 1,985 of
the 2,750 mined motifs carry one.

Motif IDs stay with their motif from one run to the next; a motif whose fit gained a field (corners now carry their
angle and wall type) keeps its ID by kind and pieces. The old corner motifs were inside corners read as outside ones
and are gone. `lab/bench.js` has `corner`, `entry`, `eave`, `face` and `base` parts.

### Still to do with motifs

- The Motifs tab and its pictures (`docs/motifs/`), for Tyler to score.
- Openings of other sizes (2 m tall windows, 1.5 m lights): most well-liked wood windows are 2 x 2 or 1.5 x 2, and
  the generator makes only 2 x 1 and 1 x 1.
- Porches, stair entries, balconies, chimney caps, dormers and roof valleys are mined (see the table above) and wait
  for generate.js frames to put them on. Yard edges are not mined.
- Item stands with shields or trophies: the blueprint keeps the stand only; the game side could hang an item on it.
- Nothing of a motif may hang lower than 2.35 m over a floor (an inner corner of a cross plan, a deck).
- Kitbash canopy beds: where a gable motif replaces the rule truss, a canopy goes on a bed the truss boxes used to
  block, and its log posts clip the bed (longhouse Black Forest norse-forest s3d3 seed 178 in the interior check).
- Requests with `skipDecor` (request.js ranks bare builds that way) carry no wall motifs, since those go in after the
  furnishing.

## Looking at the corpus

`/home/claude/study/gallery/render.js` (session only) draws the most downloaded vanilla builds with the new renderer, six
to a sheet, so their details can be looked at directly. What the best of them share, and where it went:

- Crossed boards over the gable apex (the longboat dock, the meadows tavern): crossed gable boards.
- Exposed rafters under deep eaves and beams laid along the roof (Halls of Valhalla, the hunter cabin): rafter tails.
- Gable faces in timber patterns, king posts, collars and diagonals (the multiplayer base, Valhalla): gable truss.
- A stone footing under timber walls, glass in framed windows, a timber deck and stair at the entrance (Valhalla):
  stone-base walls, window frames, door step and stairs.
- Galleries with rails on the upper floor (the hunter cabin, the mountain house): the upper gallery.
- Smaller gabled roofs over doors and windows, stepped roofs over several wings (the compact four-storey house):
  door hoods; dormers still to do.

## Not done yet

- Dormers: a small gable out of the main roof over the door or a window, and stepped roof heights between wings.

- A smaller cross over the gable apex: the game's Wood Roof Cross is 4 m across, so it is used rarely.
- Gable windows 2 m wide at about two thirds of the gable height, with a sill (they are made in `generate.js`).
- Dragon heads either side of the door: the corpus has them on 40 builds, but which way the carving faces is not
  certain yet.
- Yards: a small fenced garden, a woodshed lean-to, paths of stone. They widen the footprint, so they wait for the
  village plot rules.
- A raised dais at the far end of a hall for the high seat, a sunken floor in a hall, a cellar.
- Window hoods (a roof piece over a window): they clash with the main roof's eaves on one-storey houses.

## Sources

- Corpus scripts and numbers above (session of 2026-11-09).
- "50+ Building Tips in Valheim" transcript: beams round windows, 1 x 1 floors as sills with item stands, shutters
  and doors as window shutters, chimney caps, 26 degree roofs past the walls, half wall and sign cabinets.
  https://sozai.app/transcript/building-tips-valheim-2026/
- Vanilla piece list with recipes (Valheim 1.0.7): https://physgun.com/tools/valheim-build-calculator/
- PC Gamer review of player homes: exterior wainscoting from beams, dragons flanking the entry, a sunken common area,
  a mudroom entry, a loft bedroom. https://www.pcgamer.com/best-valheim-house-building-tips-guide
- Hurstwic, longhouses: raised benches along the walls, two rows of posts, cross benches at the ends.
  https://hurstwic.org/history/articles/daily_living/text/longhouse.htm
- Loft (building): the external gallery (svalgang) on a log corbel; stabbur on posts.
  https://en.wikipedia.org/wiki/Loft_(building)
- Norsk Folkemuseum, Numedal buildings: overhanging upper floors and galleries.
  https://norskfolkemuseum.no/en/numedal
- Viking reconstructions with posts leaning against the outer walls (Ribe).
  https://benedante.blogspot.com/2014/09/viking-buildings-reconstructed.html
