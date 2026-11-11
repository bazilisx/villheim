# Piece models, round 2, and items on stands (models helper, 2026-11-11)

Branch `design/wip-models` from main 509744e. Roadmap 2b. Tyler's words (2026-11-11, by the lead): tighten the meshes,
show items on the item stands; then "fully accurate" within about 2 cm, and items that go on a stand captured exactly.

## What was done

- `lab/extract_models.py`
  - Measuring and fitting are separate steps. `run` and `items` read the game once (all 693 pieces in 85 s, all 265 stand
    items in about 30 s, one bundle) and keep the measured meshes in `<work>/cache` on Tyler's PC (`$HOME/vhmodels` in the
    device shell, never in the game folder, never committed). `fit` fits from that cache; `rescore` measures again.
  - Proxies fitted to a tolerance instead of a part count (`tol_fit`, `TOL`): 2 cm for pieces, 4 mm for the two item
    stands, 1.5 cm for stand items (1/50 of the item's size for a large one, 1.8 times that when it needs more than 250
    parts). A part keeps one box or one prism when it is within the tolerance both ways; otherwise boxes inside its
    solid are added until no cell of the solid is farther than the tolerance (at most 400 boxes a part).
  - `fit_score`: per piece, how far the mesh's solid reaches past the proxy (miss) and the proxy past the solid (over),
    99th percentile and worst cell in mm, and the proxy's bounds against the mesh's (box). Each connected part is
    filled on its own, so an open cup is its wall and the drink's surface.
  - A piece whose first-round proxy already meets the tolerance keeps it (`VH_OLD`); 106 did.
  - `stands`: the item stands' attach points (`m_attachOther`), orientation type and what they take, read from the
    ItemStand component. `items`: each item as `ItemStand.SetVisualItem` shows it (the `attach` child, or
    `attachobj`; attach's local position, rotation and scale; the first stand offset for the stand's orientation;
    quality 1). `collect_items` gives each item's place in each stand's frame.
  - The collider boxes keep the first round's sampling, so `data/piece-solids.json` is unchanged.
- `lab/build_models.js`: `version 3`; `coarse` (the first round's parts) next to `parts`; `err` per piece (mm);
  `old: 1` on pieces not refitted yet. `--items` builds `data/item-models.json`.
- `data/item-models.json` (new, 2.9 MB): 265 items, 25,408 parts, exact bounds, `at` per stand, `fits` per stand
  (ItemStand.CanAttach), `gap` per stand. `MeadStaminaLingering` and `SmokedFish` have no mesh under their `attach`
  child in the game data (`none`); the renderer draws a small red box for them.
- `lib/mesh.js`: two levels. `world` gives the coarse parts (the quick pre-test); where two coarse lists meet,
  `deepest` measures again with the fine parts (`worldFine`) and that is the answer. `VH_COARSE=1` or `fine(false)`
  turns the fine level off. A prism whose box stands well past its outline is cut into 2 to 6 strips along its longer
  side (`prismStrips`), at both levels.
- `lib/render.js`: items on stands (`standItems`, `itemModel`, own functions): read from `p.item` or the info field
  (`Tankard:0:1`), placed at the stand's attach point as the game places them. `opts.items: false` leaves them out.

## Clusters and time on the PC (2 processes, 2 cores)

| Cluster | Pieces | Fit time | State |
|---|---|---|---|
| 1. Stand items and the two stands | 265 + 2 | about 9 min | done; stands kept (already exact, box error 0 to 0.1 mm) |
| 2. Seats and tables | 38 | 2 min | done |
| 3. Storage, beds, rugs | 38 | 2 min | done |
| 4. Lights, decor, misc, clutter, fire, crafting, nature | 339 | about 17 min | 20 to 30 cut off by the call limit keep the first-round proxy |
| 5. Building pieces | 276 | about 12 min | done but for 30 or so cut off |

Pieces not refitted (`old: 1` in `data/piece-models.json`): 116 of 693 (most are nature, rocks and Ashlands ruins).
They can be fitted with `VH_RETRY=1 python3 extract_models.py fit work <list> 150` on the PC.

## Measures, before and after

Parts: 12,501 to 168,158 in `data/piece-models.json` (1.9 MB to 19.3 MB). `mesh.lite` (bundled for the game and the
lab page): 0.52 MB to 6.4 MB.

Worst 99th percentile miss per kind, refitted pieces (mm; the worst piece in brackets): storage 19.5, seat 20.9
(piece_moose_throne), bed 25.3 (piece_bed02), floor 25.3, fence 25.3, rug 39.3 (rug_Bjorn), light 87.7
(piece_dvergr_lantern), beam 188 (wood_beam_67), roof 159 (wood_roof), fire 146 (hearth), craft 400 (fermenter),
nature 630 (Rock_destructible). Pieces past the tolerance are those that hit the 400-box limit of a part or, for
large pieces, a voxel larger than the tolerance (the 1.2 million cell limit).

Stand items: 258 of 265 within the tolerance plus 5 mm; the rest are boss and large trophies (TrophyCultist,
TrophyMoose, TrophySeekerBrute, TrophyWraith) whose proxy stands 11 to 22 cm past the mesh in places.

Item against stand, mm, `[mesh, proxy]`: the flat stand's top (y 0.034) to the item's lowest point; the wall stand's
face (z 0.146) to the item's back. Before this round no item was drawn.
Tankard flat [-14.2, -14.5]; MeadTasty flat [-32.3, -34.5]; Bread flat [-30.0, -30.5]; TrophyDeer flat [-68, -34] and
wall [-102, -114]; SwordIron flat and wall [-16, -3.5]; ShieldWood wall [-22.9, -24.3]; Hammer wall [-45, -38];
Fish1 flat [-128, -75]. The game sets an item by its attach point and offsets, not on the stand's top, so the mesh's
own gap is not 0; these were not seen in the game.

Tops of the pieces flat stands rest on (`anchor-tops.json`, median and 95th percentile of the height error over the
top, mm, one 2 cm cell in from the edge, 4 mm steps): piece_table 16.1/16.8 to 8.8/16.8; piece_bench01 29.4/44.4 to
5.5/20.9; dvergrprops_crate 28.7/86.5 to 4.7/55.3; dvergrprops_crate_long 29.6/29.6 to 1.6/5.7; wood_wall_half,
wood_ledge, piece_table_round, piece_chest_wood, piece_chair 0 to 4 both; wood_floor 4/4 to 8/8. The tops are not
exact yet.

Game data: every stand item the pool `/tmp/h2-pool` uses fits the stand it is on (480 of 480). The wall stand refuses
78 of the 265 items (food and drink, most of all: Tankard, MeadTasty and ChickenEgg are on its unsupported list).

## Checks (this tree, 2-core machine shared with other helpers)

- check_set 2: 224 of 225, 90 of 90, 147 of 147, one overlap, the same as before; 3 min 32 s against 2 min 55 s
  (1.21 times).
- test_structure: all rules hold on 36 designs. test_sizes: 0 off by more than 10 cm.
- check_interiors, 1 seed, 234 designs: overlap 2 to 1, floating 6 (8) to 5 (6), stairs 1, other checks 0; 308 to
  284 ms per design (the same within the machine's noise).
- test_stands 3: stands at d3 584 to 581, shares move by a few points; no gate failed.
- Not run: check_interiors full, the pools, lab/compare_page.js, gen-test.

Renders: `/tmp/models-renders/{home-Meadows,tavern-Swamp}-s3d3-{before,after}.png` (seed 11, close up round the
spot with the most flat stands).

## Changes in other tracks' files

None. `lib/build_web.js` does not yet put `data/item-models.json` on the lab page (`window.VHItemModels`); the page
draws no items until it does.

## Open

- Item meshes in the repo: the lead asked for each stand item's mesh (reduced to about 2 mm) in
  `data/item-models.json`. The repo is public and the lab's rule is that game meshes stay on Tyler's PC
  (`docs/BLUEPRINT_LAB.md`, the mesh pack). The items are kept as proxies with exact bounds and the exact attach
  transform; the near-exact triangles (0.5 mm grid) are in `<work>/item_meshes` on the PC for an offline pack.
  Proposed Decisions row below.
- Exact tops for the anchor pieces: a pass that sets each proxy part's top face, where it lies on the mesh's top, to
  the mesh's height.
- Size: 19 MB of piece models and 6.4 MB of lite data in the bundles. A cap on parts per piece, or the fine level only
  for the pieces the generator uses, would cut it.
- 116 pieces not refitted; pieces past the tolerance (above).

Proposed Decisions rows:
- D-new: "Stand items as exact meshes in the public repo?" Options: (a) keep the proxies plus exact bounds and attach
  transform in the repo, exact meshes only in the offline pack on the PC; (b) commit the meshes reduced to 2 mm.
  Recommendation (a), since the game's meshes are Iron Gate's and the repo is public.
- Test: put a Tankard, a TrophyDeer and a Fish1 on a flat stand in the game and compare with the lab render.

## Round 2 (2026-11-11)

Branch `design/wip-models` from 29a1f2f. Lead's calls: stand items stay proxies with exact bounds and attach
transforms in the repo, near-exact triangles only on Tyler's PC; the in-game stand test goes to the Tests tab at merge.
The work folder on the PC is `$HOME/vhmodels` (device shell); nothing is written to Tyler's connected folders.

### What was done

- d6f6d3f: packed parts. `lab/build_models.js` groups each piece's parts by color, material and rotation and writes
  the boxes as whole millimeters in the group's frame, six numbers a box in a short text code (`lib/mesh.js`
  `encBoxes`, `decBoxes`, `unpack`). Boxes inside another or covered by the others are dropped and boxes that line up
  on two axes and touch on the third are joined (to 1 mm); this removes 0.1 % of the boxes, since the fit's boxes are
  grown as far as the solid allows. `data/piece-models.json` (version 4) keeps the coarse parts (`k`) and the
  measurements; the fine parts go to the new `data/piece-fine.json`. `lib/mesh.js` reads the fine file the first time
  two coarse lists meet. Both bundles carry the fine parts as one JSON text per piece kind (`lib/pieces.js` role,
  `VH_MESH_FINE`, `lib/mesh_fine.js`), parsed the first time a piece of that kind needs them. `lib/render.js` reads
  the parts through `lib/mesh.js` `parts`. `data/item-models.json` is packed the same way.
- `lib/build_web.js` sets `window.VHItemModels`, so the page draws items on stands. The page's `VHModels` holds the
  bounds only; its parts come from `VH_MESH` and `VH_MESH_FINE`.
- `VH_SOLIDS_FROM` and `VH_MODELS_FROM` (build_models.js) keep the solids and collider boxes of an earlier build, so
  `data/piece-solids.json` and every `solids` and `collider` field are unchanged.
- 1b763c7, bd05f10: `extract_models.py tops`, exact tops. For the pieces flat stands rest on, each part that is the
  proxy's top somewhere on the mesh's top area has its most upward face (a box face, a prism end or one edge of its
  outline, tilted up to 45 degrees) moved to the median of the mesh's height there. `top_error` measures it on a
  1 cm grid over the area within 15 cm of the highest point.
- f905d19: sampling fix. `sample_tris` capped a triangle at 400 steps, so a triangle longer than about 2 m was sampled
  more coarsely than the 1 cm voxel; the solid of a low-poly log or roof stayed a hollow shell and the fit covered only
  the shell. The fit and the score now take as many steps as the longest edge needs (up to 1500). `VH_MAX_BOXES` and
  `VH_CELL_CAP` raise the fit limits.
- c9e43ec: the 66 pieces cut off last round are fitted (the 10 started and cut off with `VH_RETRY=1`); 14 hard pieces
  are fitted again with the sampling fix and 1200 boxes a part, 3 million cells; the 17 anchor pieces get exact tops.

### Sizes, before (29a1f2f) and after

| File | Before | After |
|---|---|---|
| `data/piece-models.json` | 19.3 MB | 0.91 MB |
| `data/piece-fine.json` | none | 2.38 MB |
| `data/item-models.json` | 2.88 MB | 0.46 MB |
| mesh lite in the game's bundle | 6.43 MB | 0.42 MB coarse + 1.54 MB fine (per kind, parsed when needed) |
| `src/Villheim.Logic/Generator/lab.js` | 8.56 MB (main 2.64 MB) | 4.09 MB |
| `web/index.html` (lab page) | 26.6 MB (main 4.42 MB) | 5.85 MB, items included |

Parts: 168,158 before; 208,559 after the refit (packed as 208,386). Packing alone (d6f6d3f, same parts): models plus
fine 2.84 MB, lab.js 3.74 MB, page 5.39 MB; every measured field the same as 29a1f2f, the parts' bounds within 2.3 mm.

### Fit, before and after (99th percentile miss and over, mm; fit_score)

The 14 pieces fitted again: fermenter 400 to 19 (over 19); hearth 146 to 21; bonfire 289 to 162; wood_roof 159 to 51
(over 134 to 21); wood_roof_45 91 to 25; darkwood_roof_67 61 to 31; wood_beam_67 188 to 0 (one box); stave_deco_beam_67
114 to 14; wood_wall_roof_67_a 140 to 0; wood_log_67 196 to 17; piece_bathtub 334 to 28; piece_table_oak 84 to 21;
piece_dvergr_lantern 88 to 10; rug_Bjorn 39 to 28. Values of 20 to 31 on large pieces are the score's own voxel (the
score grid is capped at 1.5 million cells), so they read as within the tolerance at that resolution.

The 66 refitted pieces: in `data/piece-models.json` `err`. Not refitted, kept coarse (34, `old: 1`): rocks, cliffs,
trees, roots, shrubs, vines, giant bones and the like (Beech1, FirTree*, cliff_*, rock*, root07/08/11/12, shrub_2*,
vines, highstone, widestone, flint_pile, giant_*, lox_ribs, mudpile_old, portal_stone, stoneblock_fracture,
tarlump1_frac). The generator places none of them inside a building.

### Top error of the pieces flat stands rest on (mm, median and 95th percentile, before and after)

beam: wood_beam 0/0 to 0/0; wood_beam_1 0/0 to 0/0. floor: wood_floor 9.2/9.2 to 0/0. ledge: wood_ledge 0/0.1 to
0/0.1. seat: piece_chair 0.2/0.2 to 0/0; piece_bench01 8.1/20.3 to 2.2/19.5; piece_chair03 5.3/28.8 to 5.1/15.6;
piece_logbench01 8.0/47.2 to 4.4/24.2. storage: piece_chest_wood 2.8/2.8 to 0/0; dvergrprops_crate_long 4.0/5.5 to
0/1.6; dvergrprops_crate 5.8/51.7 to 0.7/57.7; piece_chest 5.3/18.3 to 3.6/15.6; piece_chest_barrel 1.0/99 to
0.1/99. table: piece_table 12.2/18.2 to 3.9/10.7; piece_table_round 0/10.6 to 0/10.5; piece_workbench 7.2/26.1 to
0.4/20.7. wall: wood_wall_half 0/0 to 0/0.

Ten of the 17 are at 0 to 1 mm (median). The rest have tops that are not flat in the mesh (planks with bevels and
gaps, round logs, a curved lid), so one level face per part stays 2 to 5 mm off the median; the 95th percentile there
is the edges and the uneven boards. The anchors used are the pieces under flat stands in the Norse pool (10) and the
seven from the stand sets (chest_barrel, workbench, chest, wood_beam, wood_beam_1, logbench01, chair03).

### Checks (this tree, 2-core machine)

- check_set 2: 224 of 225, 90 of 90, 147 of 147, overlap 1, as before; 233 s (round 1 212 s).
- test_structure: 36 designs hold. test_sizes: 0 off by more than 10 cm.
- check_interiors in full (3 seeds, 702 designs), 29a1f2f then this round: bareFloors 5 (5) to 4 (5); floating 7 (9)
  to 6 (8); overlap 1 (1) to 4 (6); headroom 0 to 1 (1); the rest 0; 222 to 240 ms a design. The overlap and headroom
  checks read the colliders (lib/shapes.js), which are unchanged; the designs differ because the generator's model
  tests now see the refitted parts. New cases: piece_groundtorch_mist against wood_ledge (Plains tavern s3d3 seed 357,
  Plains temple s3d3 seed 701), piece_chest against wood_ledge (Mountain octagon tower s3d3 seed 628), and one low
  floor point by a wood_beam (Mountain square tower s3d3 seed 530). Packing alone already moved one-seed counts by one
  either way (bareFloors 1 to 2, overlap 2 to 1).
- Pools: Norse Meadows, norse-forest Black Forest, middle-eastern Plains: audit pass, 81 each.
- test_stands 3 --gate: 29a1f2f and d6f6d3f (packing only) give the same table, 4 bands missed (flat bench, wall
  station, wall chest, stands q3). After the refit and tops: flat stands at d3 581 to 645, wall stands 188 to 168; two
  more bands missed: flat share 81 % (band 50 to 80) and wall hearth 22.0 % (band up to 21.0). The fuller models of
  the hearth and the roofs and the level tops change which stands the checks let through.
- compare_page: 5 of 5 the same. gen-test: 5 of 5 byte for byte. dotnet build: 0 errors, 43 warnings.
- gen-test times (C# engine, s, requests 1 to 5; machine load average 3 to 4 on 2 cores, so a few seconds either
  way are noise): 29a1f2f 16.6 / 72.2 / 14.2 / 1.6 / 12.1; packing only 23.3 / 99.1 / 21.2 / 2.3 / 18.5 (run under
  heavier load); this round 18.7 / 87.3 / 39.6 / 1.5 / 9.7. Requests 3 and 5 now make other designs (267 and 407
  pieces against 262 and 391). Request 2, the same 808-piece design, takes about 20 % longer: more fine parts to test
  (208,559 against 168,158; hearth 704 to 1240, bonfire 760 to 1560).

Renders: `/tmp/models2-renders/{home-Meadows,tavern-Swamp}-s3d3-{round1,round2,whole}.png` (seed 11, close up round
the spot with the most flat stands; round1 is last round's).

### Changes in other tracks' files

None. `lib/build_web.js` and `lib/build_engine.js` changed in the lines that load the models.

### Open

- The sampling fix touches every piece with a triangle longer than 1.9 m: 270 in the cache (walls, floors, roofs,
  beams, beds, stone pieces, trees). Only the 14 hard pieces are fitted again with it. A refit of the rest (about 45
  minutes on the PC) and a rescore of all pieces with the fixed score is the next task.
- Two more stand bands missed (above); the stands track may want to look at hearth wall stands and the flat share
  with the new models.
- check_interiors in full: overlap 1 to 4 designs and headroom 0 to 1 (cases above); the generator's placement around
  ground torches, ledges and chests in those designs needs a look.
- Tops not flat in the mesh (tables, benches, chests) stay 2 to 5 mm off at the median; a finer fit of those tops
  would bring them closer.
- Work files left in Tyler's game profile from round 1 (`BepInEx/config/Villheim-tools/models-run`, 18 files, 24 MB):
  copies of all of them are in `$HOME/vhmodels` (`from-profile/` holds the four debug files and the longer
  anchors.txt). The lead handles the folder.

## Round 3 (2026-11-11)

The work folder in Tyler's game profile was copied to `$HOME/vhmodels/from-profile` and removed by the lead with
Tyler's approval. Round 3 wrote nothing to his connected folders.

### Refit and rescore of the pieces with long triangles

- 239 pieces with a triangle longer than 1.9 m (the 270 found in round 2, less 31 that are either trees, rocks and
  cliffs kept coarse or among the 14 hard pieces done in round 2), the 43 the pools use first. Each was scored again with the fixed
  sampling (`fit_score`), fitted again (800 boxes a part, 2 million cells) and the closer of the two kept (miss plus
  over at least 2 mm lower). Driver: `$HOME/vhmodels/r3.py` on the PC.
- 224 done: 34 take the new fit, 190 keep their parts with the new score in `err`. Pieces with a 99th percentile miss
  over 20 mm among the 224: 56 before, 42 after (most of the 42 are large pieces where the score's own voxel is 20 to
  40 mm). New fits include the six scale roof walls (miss 37 to 13), wood_wall_roof_67_upsidedown (140 to 0),
  ashwood_wall_roof_67_a (157 to 0), wood_roof_top_45 (33/81 to 19/19), darkwood_roof_45 (33 to 23),
  darkwood_roof_ocorner (46 to 33), MountainKit_wood_gate (76 to 25), piece_bench01 (18/13 to 9/9), wood_pole_log
  (16 to 11), stave_beam_67, woodiron_beam_67, iron_wall_2x2, piece_hexagonal_door (63 to 30).
- piece_bench01 got its tops set again: median 7.0 to 2.1 mm, 95th percentile 10.3 to 15.1.
- Not done, cut off by the time limit (15): piece_artisanstation and darkwood_roof_ocorner_67 (scored, kept),
  wood_roof_67, wood_pole_log_4, wood_roof_top, wood_wall_roof_a, smelter, eitrrefinery, incinerator, piece_maypole,
  trader_wagon_destructable, Ashlands_Fortress_Wall_Pillar_frac, Charred_altar_bellfragment, Rock_destructible,
  SwampTree1, cliff_mistlands1, cliff_mistlands1_creep.
- Commit e9d467c. Parts 209,771; `data/piece-models.json` 0.91 MB, `data/piece-fine.json` 2.41 MB.

### The stand bands and the new check_interiors cases, traced

Method: the d3 requests of test_stands at 3 seeds made with the 29a1f2f lib and data, then with that lib and the new
parts of only some pieces swapped in (`/tmp/models3-hyb.js`), stands counted by place with lab/mine_stands.js.

- Stand bands (flat share 81 %, wall hearth 22.0 %): all from `stone_wall_2x1`. With only its new parts swapped in,
  the counts match this round exactly (flat 630 to 703, wall 190 to 170, shelf 207 to 255, mantel 115 to 145, table
  164 to 146); the tops and the other 78 refitted pieces change nothing. Its first proxy was one prism a full 1.18 m
  thick everywhere (9 cm past its collider on each face); the fine parts follow the stones (miss 14 mm, over 0). Ledges
  on stone walls in Plains, Mountain and Black Forest houses now pass: in the Plains taverns 84 ledge and wall pairs
  touch, 3 to 7 mm into the fine parts, 8 to 10 cm into the old prism, 0 into the colliders. Model correction, no
  model error. The band misses follow from more shelf and mantel stands in stone houses.
- Overlaps (check_interiors, from the colliders): real clips in placement. The ledges in these sets sit on stone walls
  and now pass the wall test; the set is then placed over furniture already there:
  - tavern Plains s3d3 seed 357: KS-mantel wood_ledge at (-5.0, 1.5, -7.2) over piece_groundtorch_mist at (-5.5,
    1.25, -7.21): 5.8 cm into the fine parts, 8.0 cm into the colliders.
  - temple Plains s3d3 seed 701: BK-wcandles ledges at (-0.5, 1.55, -6.2), (6.2, 1.75, 2.0) and (-6.2, 1.55, 1.0)
    over piece_groundtorch_mist: 5.0 to 7.4 cm fine, 0 to 3 cm colliders.
  - tower Mountain s3d3 seed 628: KS-s-two wood_ledge at (-2.2, 5.05, 1.0) over piece_chest at (-1.96, 4.10, 1.0):
    11.4 cm fine, 13.8 cm colliders.
  - home Mountain s2d2 seed 139: piece_groundtorch_wood against piece_logbench01 (also in 29a1f2f): 4.4 cm fine, 0
    colliders.
- Headroom (tower Mountain s3d3 seed 530): a decor wood_beam from kitbash KC-100 at (-0.99, 5.06, -2.17), 0.96 m over
  the floor at y 4.1, is read as a ceiling over the point (-0.25, 4.1, -2.25). The check reads the colliders and the
  placement; no model involved.
- For the integration helper (placement code, not changed here): the wall set placement (lib/stands.js KS-mantel,
  KS-s-two; lib/kitbash.js BK-wcandles) lets a ledge go over a ground torch or a chest; the headroom check counts a low decor beam as a ceiling.

### Checks (round 3 tree, e9d467c)

- check_set 2: 224 of 225, 90 of 90, 147 of 147, overlap 1 (same); 294 s with other helpers on the machine.
- test_structure: 36 hold. test_sizes: 0 off.
- check_interiors in full (702 designs): bareFloors 4 (5), floating 6 (8), overlap 4 (6), headroom 1 (1), the rest 0;
  219 ms a design. The same as round 2; cases traced above.
- Pools: Norse Meadows, norse-forest Black Forest, middle-eastern Plains: audit pass, 81 each.
- test_stands 3 --gate: the same table as round 2 (flat 645, wall 168 at d3); six bands missed (flat bench, wall
  station, wall hearth, wall chest, flat share, stands q3); the two new ones traced above.
- compare_page: 5 of 5 the same. gen-test: 5 of 5 byte for byte. dotnet build: 0 errors, 43 warnings.
- gen-test times (C# engine, s, requests 1 to 5, load average about 2.5): 11.7 / 81.7 / 31.1 / 1.6 / 9.5 (29a1f2f
  16.6 / 72.2 / 14.2 / 1.6 / 12.1 under load 3 to 4; requests 3 and 5 make other designs since round 2).
- Bundles: lab.js 4.09 MB, lab page 5.88 MB.

### Open

- The 15 pieces cut off above; the 31 trees, rocks and cliffs kept coarse.
- Placement: the ledge sets over ground torches and a chest, and the decor beam read as a ceiling (above).
- Band misses flat share and wall hearth: they follow from the fine stone wall; the stands track decides whether the
  bands or the sets change.
