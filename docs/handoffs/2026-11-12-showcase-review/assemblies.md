# Track G: furniture assemblies and stand items (2026-11-12)

Branch `design/wip-assemblies` (from main 2e607cf). Owns new files only: `tools/blueprint-lab/lib/assemblies.js`,
`lib/standitems.js`, `data/assemblies/`, `data/stand-items/`, the lab scripts named below, `docs/FURNITURE_ASSEMBLIES.md`,
this record and `criteria/assemblies.md`. No file of another track was edited.

## What was done

Commits (all pushed): 601893a (stand items draft), 5ab483c (assembly miner, placer, renders, audit), 706181f
(authored recipes; corpus recipes keep the kind of item, not the builder's item), b9efe8e (caps from corpus medians;
loose items apart from hidden pieces), and the closing commit with the docs.

1. **Sources read.** Tyler's "Game Inspo" album (191 pictures, all looked at as contact sheets, about 40 interiors
   looked at large; notes per picture in the private repo `research/2026-11-12-assemblies/album/NOTES.md`), his
   collage (Versaugh's "100 Valheim Decoration Ideas"), builders' video chapter lists and thumbnails (Versaugh, saphonette,
   Alessio, Kyle Axington, Blue Dyno), a building tips transcript (SozAI) and valheimians forum thread 277. Corpus: the
   blueprints unpacked to `/work/bp` (2,657 files, 1,900 vanilla builds read).
2. **Stand items** (`lib/standitems.js`, `data/stand-items/`): a corpus pass over every item stand and armor stand
   inside a building (`lab/mine_stand_items.js`), item data from it and the item models (`lab/build_stand_items.js`:
   308 items with kind, tier, fits, box on a flat stand, tall flag), rules (`rules.json`: themes, rooms, groups, caps,
   pose, armor), and the code: `ledger`, `themesFrom`, `pick`, `armor`, `pose`, `overhang`, `check`, `kindOf`.
3. **Furniture assemblies** (`lib/assemblies.js`, `data/assemblies/`): a corpus miner (`lab/mine_assemblies.js`,
   9,521 clusters), a selector (`lab/select_assemblies.js`, 267 recipes in 29 kinds), 19 authored recipes
   (`lab/author_assemblies.js`, from the album, the collage, the videos and corpus rules), renders
   (`lab/render_assemblies.js`, contact sheets in the private repo `renders/`), and the code: `find`, `place` (any
   spot and facing, mirror, material family swap keeping box centres), `choose` (per-building caps), `kinds`.
4. **Checks**: `lab/test_standitems.js` (Tyler's failures each caught; 60 dressed houses pass), `lab/test_assemblies.js`
   (286 recipes at three facings, mirrored and swapped, stands filled, all pass check), `lab/audit_stand_items.js`
   (the showcase specs through `check`).

## What each function takes and returns (for track E)

- `SI.ledger({ biome, stage, kind, floorM2, persona | themes, seed, later })` -> ledger (one per building).
- `SI.pick(L, { stand, place, room, near, x, y, z, yaw, top, want, row })` -> `{ item, text, kind, group, yaw, q, y,
  tilt, why }` or null (leave the stand out). `top` is the box `{x0, x1, z0, z1, y}` the flat stand stands on; give it
  so edges are checked. Apply `q`, `y` and `yaw` to the stand: a tall weapon or tool comes back turned on its side.
- `SI.armor(L, { room, look, tier })` -> `{ text, items, pattern, set, look }`; put `text` in the armor stand's `info`.
- `SI.check(pieces, { kind, floorM2, topOf })` -> `{ fails: [{ code, msg, at }], counts }`.
- `AS.find(query)`, `AS.choose(L, query)` -> recipe; query `{ kind | kinds, room, culture, family, maxW, maxD, maxH,
  wall, from, noHidden, exclude }`.
- `AS.place(recipe, { x, y, z, facing }, { family, mirror, keep })` -> `{ id, kind, pieces, box, corners, front,
  stands: [{ i, stand, want, place, item }], hidden }`. `facing` turns the recipe's +z (out of the wall) to the world
  direction (as `catalog.yawFacing`). Each piece has `asm`.

## Findings (numbers and sources; full text in docs/FURNITURE_ASSEMBLIES.md)

By principle; Tyler's examples are one instance each.
- **Reason.** Kinds cluster by use piece: tools by a forge lift 5.0, by a workbench 4.1; raw meat by the cooking 4.7;
  fish 3.3, food 3.2, tankards 3.0 at a table; herbs by a bed 3.4; staffs 6.5 and bows 5.0 by a mage table; trophies
  2.2 and shields 1.9 by the hearth (22,042 dressed stands in 407 builds).
- **Repeats.** House-sized builds (87): the most repeated item of a kind at the median: weapons and tools 1, tankards,
  food, herbs, curios 2, trophies, shields, hats 3, meads, produce 4. Show items stand alone 91 to 98 %; produce comes
  in rows (31 % alone). Distinct items per dressed stand: homes median 0.40.
- **Rest.** Upright on a flat stand: axe 0.89 m, mace 1.05, sledge 1.38, battleaxe 1.68 tall; swords, knives and shields
  lie. Corpus flat stands with swords turned on their side 95 of 202, maces 261 of 544; tools lean 187 of 260; wall
  stands hang level 8,048 of 8,103.
- **Program.** Builders make 37 kinds of furniture from pieces (list in the doc); the corpus holds them as clusters
  against a wall: 28 kitchen stoves, 16 forge corners, 16 work corners, 16 cabinets, 16 armor alcoves, 14 brew corners
  in the selection.
- **Dressed.** 1,996 corpus armor stands, 1,219 dressed; patterns and sets in the doc. The generator dresses none.
- **Audit of main** (16 showcase specs, 2 seeds): 27 of 32 designs fail: edge 70, empty armor 43 of 43, mixed 34,
  repeat 33, head 9, run 5.

## Checks run

- `node lab/test_standitems.js`: 8 of 8 pass.
- `node lab/test_assemblies.js`: 286 recipes, 858 placements, all pass.
- `node lab/audit_stand_items.js 2`: baseline above (main's generator; this branch changes no generator file).
- Renders of all recipes looked at (two passes for corpus recipes; 37 left out by eye, `data/assemblies/drop.json`).
- Not run: `lab/test_structure.js` and the pool gate (no generator file changed).

## Open problems

- Track E has to call the two modules; until then generated designs are unchanged. `lib/stands.js` sets that put
  weapons and shields on dining tables (`KS-t-arms`, `KS-ch-shield`) and `lib/persona.js fromStock` reuse odds are the
  generator's sources of the audit failures; E owns both files.
- Corpus recipes that came in after the second drop list were not looked at one by one.
- Fountains and wash basins from the collage are not written (vanilla pieces for water and a basin not identified);
  banners left out of authored recipes (frame not checked).
- Hidden pieces: the catalog's `buildable` flag marks props without a build-menu piece; `wood_ledge` is added by hand
  (D-166). A full list of pieces missing from the hammer's table would need the game's piece tables.
- Item variants are always 0.

## Proposed Decisions rows

- D-new: Armor stands in generated buildings: every one dressed (Tyler 2026-11-12: "nothing currently hanging on any
  of the armorstands"), from the village's tier and the two before, with later sets rare (D-065 allows any biome's
  stand item). Options: (a) as built; (b) only the village's tier and earlier; (c) any tier at even odds. Recommend (a).
- D-new: Repeat caps for stand items per building follow the corpus medians (homes: one of each weapon or tool, two
  of each tankard, food, herb, three of each trophy or shield) and halls take the all-build medians. Options: (a) as
  built; (b) stricter (one of each show item everywhere); (c) looser (corpus 75th percentile). Recommend (a).
- D-new: Long weapons and tools on flat stands lie on their side (turned stands); none stand on their head. Options:
  (a) as built; (b) wall stands only for long weapons. Recommend (a) (corpus turns them about half the time).

## Next steps

1. Track E: per room, `AS.choose` the furniture its program needs (`criteria/assemblies.md` item 7), `place` it with
   the room's family, then fill every stand with `SI.pick` and every armor stand with `SI.armor`; keep the ledger per
   building.
2. Council: run `node lab/audit_stand_items.js --file <design> <kind>` on each building and score
   `criteria/assemblies.md`.
3. More authored recipes from the album's stone and Mistlands rooms (album 157, 158, 75) and a check of the banner frame.
