# Council criteria: attached pieces, wall-hung first (track F)

What a generated s3d3 building is judged by for everything hung on a wall: signs, item stands, wall torches, Dvergr
wall lanterns, banners, wall ledges (shelves), wall carvings and the cauldron's wall racks. Evidence in
`docs/handoffs/2026-11-12-showcase-review/wallhung.md` (the track record) and `docs/ROOM_STUDY.md` section 7.

Measure with, from `tools/blueprint-lab`:
- `node lab/wallhung_measure.js <folder or .blueprint> --list`: per hung piece the gap from its back to what shows of
  the wall behind it, how much of its back is on the wall (cover, 3 by 3 parts), facing, height over the floor, pieces
  over one another, and the pieces that stand on a floor or furniture instead (counted apart).
- `node lab/audit_pool.js <folder> --list`: the pool audit's wallOff, wallHalf, wallTurn, wallStack and mountClip.
- `VH_CLOSE=12 node lab/render_walls.js lib <type> <biome> <stage> <decor> <seed> <out.png> [culture]`: close-ups of
  the 12 hung pieces furthest off their wall, each from the side and from the front; without VH_CLOSE, the walls with
  the most hung pieces seen straight on with a side view (set NODE_PATH to the shared lab_node_modules if the canvas
  binding is not found).

Pass: 85 points or more of 100, and no hard fail.

## Hard fails (each fails the building alone)

| # | Fail | Test | Source |
|---|---|---|---|
| H1 | A piece stands off its wall | Gap from its back to what shows of the wall behind it over 3 cm (audit wallOff), unless it stands on a floor or furniture or is set on something that is no wall (a label on a chest's front, a stand on a banner) | Tyler (TYLER_NOTES.md, last section): "Signs and stands and sometimes lights that werent touching walls and were a foot or more away"; earlier: "signs and item stands sticking out from the wall, not attached". Corpus, liked builds, decor use: wall torches gap p50 0 cm, item stands and signs about -5 cm (into the wall); off more than 3 cm with nothing behind about 2 % of torches and 3 % of stands. Showcase before: 115 of 314 |
| H2 | A piece hung in the air | No wall within 1.5 m behind it (audit wallOff "no wall behind it") | Tyler: "Some hovered away from the walls". Showcase before: 11 (hub torches turned along the wall) |
| H3 | A piece turned wrong | Its back away from the wall or along it: the wall on its front side, or a wall at its side within 10 cm and none behind (audit wallTurn); the torch's wall plate is its local -x, the Dvergr lantern's +x, a stand's board -z (lib/wallhang.js HUNG, matching the piece catalog's front sides) | Tyler: "torches oriented the wrong way". Showcase before: 11 |
| H4 | Pieces over one another | Two hung pieces on one wall whose outlines overlap by 10 % or more of the smaller, at any depth (audit wallStack) | Tyler: "signs were all stacked and layered and smushed randomly together... Some were 3-stacks thick, randomly pushed in front of each other at odd positions". The notice board's three 1 m signs 0.55 m apart overlapped by 45 % |
| H6 | A standing or hanging light floats | A standing torch whose foot is more than 3 cm over what is under it, or a hanging brazier more than 3 cm under the beam, floor or roof over it (`lab/attach_measure.js`; audit floats; test_structure) | Tyler: "lots of hovering stuff (both walls and on the floor)". Corpus: standing torches 0.75 m over the floor piece's pivot, foot on the floor's top; brazier chains 5 cm into what is over them. Showcase before: 42 of 50 standing torches 10 to 64 cm up |
| H5 | A piece sunk deeper than builders sink it | What shows of it more than 1.5 cm (a banner 3 cm) into what shows of a wall, beam, post or roof, past the depth it carries as a clip made on purpose (audit mountClip; the generator marks pieces it sinks into uneven walls, up to 8 to 10 cm, as `#VillheimClips`) | D-098, D-127. Corpus decor use, 25th percentile of pieces touching their wall: torches 9 cm into it, stands 13 cm |

## Scored items (100 points)

| # | Item | Weight | Test and target | Evidence |
|---|---|---|---|---|
| 1 | The back on the wall | 8 | Every hung piece with 7 of 9 parts of its back plate within 5 cm of the wall (audit wallHalf zero); no piece over a wall's end, a window hole or a plinth's step | Showcase before: 43 half off (stands half over a plinth's top, signs past a wall's end) |
| 2 | Flat on the wall | 6 | 95 % or more of hung pieces with a gap from -1 cm to +1 cm, or sunk no deeper than their mark on an uneven wall | Corpus torches p50 0 cm, p75 0 cm (liked builds); lib/wallhang.js puts boards 5 mm in |
| 3 | Heights where builders hang them | 6 | 90 % or more of pivots over their floor within the corpus p10 to p90: item stand 1.05 to 4.63 m, sign 0.74 to 4.04, wall torch 1.40 to 3.87, Dvergr lantern 2.19 to 5.59, ledge 0.91 to 5.5; in a room, pieces of one kind at one height | `data/rooms-corpus/walls.json` heights; ROOM_STUDY 7 |
| 4 | Lights alone on their stretch | 6 | No two wall lights within 1.25 m of each other on one wall | 96 % of corpus wall lights alone on their stretch (walls.json runs) |
| 5 | Lights spaced and level | 5 | Wall lights on one wall 2 m or more apart, 70 % or more of them at one height | Corpus 2.7 m apart (p50), 71 % at one height (walls.json spacing light+light) |
| 6 | Rows level and even | 6 | Item stands, signs and shelves in a row on one wall at one height (within 5 cm) with even gaps (within 10 cm); by eye in render_walls: the row reads as one thing | Corpus item stand neighbors 91 % the same prefab, 49 % at one height; signs in rows touch (0.03 m) or step 0.48 m (ROOM_STUDY 7) |
| 7 | Placed with intent | 12 | Each hung thing or group is centered over what stands against the wall under it (within 0.25 m), in the middle of a plain stretch, or one of a mirrored pair about a window, door or hearth at one height; 80 % or more of groups. By eye in render_walls: no wall where things look thrown at it | Tyler on wood_ledge: "randomly placed like throwing spaghetti at a wall... zero intent, zero human intuitiion". Corpus: 59 % of stands and 68 % of signs alone on their stretch, 15 % of signs over a chest, 7 % of banners over a bed (ROOM_STUDY 7) |
| 8 | No even spreading | 8 | No wall carries the same kit three times or more at a fixed step; walls left bare by a tidy household are whole walls, not random gaps | Tyler: "No uniform spreading, no random scatter" (brief); the library's wall pass put a kit every 2.5 to 3.2 m with a random jitter before 2026-11-12 |
| 9 | Clear of openings | 4 | Nothing hung over a window or door opening (audit overWin zero); within a window's stretch only above or below the opening | Corpus: 72 % of wall decor on walls without windows; 5 % to 7 % centered on a window (walls.json windows) |
| 10 | Ledges with a purpose | 6 | Wall ledges only as shelves holding things, two ledge kits at most in a building, none in most buildings | D-166 (Tyler): "theyre fine to use provided you have use for them and dont use them randomly, or all the time". Corpus shelves 28 % empty, p50 two items (walls.json shelves); showcase before: wood_ledge in all 16 buildings, 111 pieces |
| 11 | Signs as labels or notices | 6 | Signs alone, over a chest or a row of chests, or on a notice board tiled edge to edge (none over another); a notice board with its notices in a column or a row | ROOM_STUDY 7: 68 % of signs alone, rows touch; Tyler on the notice board |
| 12 | Banners | 4 | The rod against the wall, the cloth on it, the foot 0 to 1 m over the floor (audit hang zero); pairs at one height | Corpus banners 1.8 m apart, 90 % at one height, 96 % alone (ROOM_STUDY 7); T-606 |
| 13 | Not crowded | 7 | On each plain wall stretch, one hung group per 2.5 m or less; nothing hung behind a tall piece (a wardrobe, a canopy bed) | Corpus: 59 % of stands alone on their stretch; Tyler on 14: "all squished to the left... smushed together" |
| 14 | Lights by purpose | 4 | Wall lights beside the door and over work places and beds before the middle of a blank wall; the same prefab on one wall | Corpus wall lights 96 % the same prefab on one wall (walls.json); lib/decorate.js lightsIn purposes |
| 15 | Seen in the renders | 12 | In `render_walls.js` close-ups and wall views, and in the game: every hung piece reads as fixed to its wall from the side, turned out to the room, nothing in front of anything else; 3 points off for each piece that does not | Tyler's frames video1-05 (signs stacked), video2-08 (a shelf off a stone wall), video2-16 (torches off the wall) |

## Notes for the council

- The principle covers anything attached: what stands on a floor, a table or a shelf sits on it (audit floats, watched:
  33 in the showcase after, mostly flat stands over shelves and hub furniture 3 to 4 cm up, for tracks E and G), what
  hangs from a ceiling hangs from it, and each faces the way the catalog's front side says.
- What stands on a floor or furniture (signs set on edge between bookends in a corpus set, a ledge as a cabinet's top)
  is judged by the furniture criteria, not by these. The roof carvings on gable ends are roof trim (track D).
- A clip made on purpose is fine up to its mark (D-098): the generator sinks a piece into an uneven wall until half its
  back touches, no deeper than 10 cm for a stand, 8 cm for a sign or torch, 3 cm for a shelf, and marks it.
- Which items stands and shelves hold is track G's; these criteria judge where and how the stand or shelf hangs.
