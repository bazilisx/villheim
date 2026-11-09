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
| Window frame | A beam under (sill) and over (head) the opening, 0.2 m proud of the wall; 1 m posts at its sides where the culture has no timber frame. | s2 on, or timber-frame cultures |
| Shutters | Two Wood Shutters flat on the wall either side of the window, only where the wall continues beside it. | s2 d2 on, Black Forest on, 60 % of buildings of the northern cultures |
| Door frame | 2 m posts at both sides, a beam over the door with its underside at the door's top. | always (posts where there is no timber frame) |
| Door step | A floor piece in front of a ground-level door, unless a porch, stair or walkway is there. | s2 on |
| Door hood | A 26 degree roof piece over the door, its edge 2.5 m up, with a 26 degree beam under each side. | s2 on, northern cultures, 70 % |
| Lamp | A standing wood torch beside the front door. | d2 on |
| Bench by the door | A wood bench or sitting log against the wall beside the front door, facing out. | d2 on, homes and halls |
| Corner posts | Posts the full height of the walls on every outside corner (log poles on log walls). | timber walls without a frame |
| Wall bands | A beam along the foot of every wall and every upper floor line, a rail at 1 m on half-timbered walls. | s2 on |
| Bargeboards | A 45 or 26 degree beam along each roof edge at the gable end. | northern cultures, s2 on |
| Crossed gable boards | The boards carried one row past the ridge so they cross over it (Norwegian vindskier). | Norse, Slavic, Baltic and mountain cultures, 45 degree roofs, where no dragon head stands |
| Loft window | A 2 m opening with a post in the middle, 1 m up a gable that is at least 4 m tall, framed by beams. | northern cultures, s2 on |
| Rafter tails | A sloped beam at every seam of the lowest roof row, 0.7 m out past the roof edge and under it, so the rafter ends show along the eaves (Halls of Valhalla and the hunter cabin in the corpus). | northern cultures, s2 on, roofs that end at the wall |
| Ridge beam ends | A 1 m beam where the ridge would run out past each gable. | northern cultures, s2 on, where no dragon head stands |
| Gable truss | A king post up the middle of the gable face (above the loft window when there is one) and collar beams across at half height. | northern cultures, s2 on, 60 % |
| Leaning hall posts | 45 degree beams from the ground 2 m out to 2 m up the long walls, every 4 m (Trelleborg, Ribe). | halls and longhouses of the Norse cultures, s2 on |
| Upper gallery (svalgang) | A balcony three bays wide over the front door on posts from the ground, a beam under its edge, a rail round it, a door from the upper room. Below, it roofs the entrance. | two-storey homes, storehouses and taverns of the Norse and Slavic cultures, s3 (s2 at d3), 75 % |
| Back room | A wall across the main wing 4 m from one end with a door in its middle bay. The decorator furnishes both rooms. | homes and taverns with a main wing at least 10 m long, s3 (s2 at d3) |
| Fire kerb | Four beams round a fire pit on the floor, so it reads as a hearth set into the floor. | d2 on |
| Hall benches (pallr) | A platform 0.3 m up and 1 m deep along the long walls of a hall, on short beams; beds, chests and benches against the wall go up onto it, the platform widened under them. | longhouses and halls, s2 on |

Every check in `lib/checks.js` still passes on the review set (225) and the culture samples (147), and the interior
checks are unchanged.

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

- Wood Roof Cross at the gable apex: in the code but switched off (`roofCross` in `details.js`) until its shape is
  checked against the game model (the renderer helper measures it).
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
