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
