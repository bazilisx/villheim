# Track A, piece catalog (2026-11-12)

Branch design/wip-catalog. Brief: build a catalog of every piece by how it looks and where corpus builders use it,
with our own working names, so the generator stops picking pieces by their id string (TYLER_NOTES.md, "Biggest
takeaways"). Method and findings: `docs/PIECE_CATALOG.md`. Council checklist: `criteria/catalog.md`.

## What was done

| Commit | What |
|---|---|
| 2ed1111 | First draft: `data/catalog/pieces.json` (1,107 prefabs), `lib/catalog.js`, data README, scripts in `data/catalog/tools/` |
| acfa44a | Families checked on the icon and texture contact sheets, piece pairs from the corpus, family lift (`pairs.json`), showcase overuse (`overuse.json`), descriptions |
| 9a13ad1 | `pieces.csv`, the rows of the review sheet's Pieces tab |
| c4b9b35 | Track B room pairs folded in (`room_pairs`), fronts checked on the showcase, `docs/PIECE_CATALOG.md`, `criteria/catalog.md` |
| 1510aa9 | main merged in |

Also:
- Review sheet: new tab "Pieces" (sheetId 2026111201), 1,107 rows sorted by corpus builds, 20 columns, header frozen
  with the first two columns, filter on. Filled from `pieces.csv` at commit 9a13ad1 through a temporary IMPORTDATA tab
  that was pasted as values and deleted. No other tab was changed (the Index tab does not list Pieces yet).
- Private repo villheim-corpus 54d3d26: `research/2026-11-12-catalog/` with the contact sheets, the game look facts
  (`catalog-look.tgz`: 622 icons, 568 texture thumbnails, per-prefab material, light and Piece data) and the English
  names.
- Tyler's PC: `C:\Users\tyler\Downloads\villheim-scratch\` holds `catalog-look.tgz` and `names-en.json`, written there
  to move them to the cloud (staging needs a connected folder). They can be deleted; deleting from the session was not
  allowed.
- The showcase files in the profile's `ingame/showcase` folder were gone (folder empty on 2026-11-12). The 16 designs
  were regenerated with the lab at main b18cf36 (`request.make`, tries 1, the seeds and stages in
  `GenCommands.cs` ShowcaseList; script `data/catalog/tools/showcase.js`).

## Findings (numbers in docs/PIECE_CATALOG.md)

- Same choice in every design, more than too many per design: `wood_ledge` in 12 of 16 designs against 3 % of corpus
  buildings; `fire_pit` in 12 of 12 designs with a fire against 36 % (hearth 74 % in the corpus, 1 design);
  `piece_walltorch` 14 of 15 against 57 % (hanging brazier 45 % in the corpus, 2 designs); `piece_bench01` 11 of 13
  against 37 %; `piece_logbench01` 6 of 13 against 11 %, 8 in the longhouse (4.3 per 100 m2 against a 1.1 corpus 90th
  percentile); `wood_fence` 7 of 16 against 10 %; candles 23, 17 and 7 in the hubs and temple.
- Stacked storage is common in the corpus (43 % of 37,278 storage pieces, 531 of 1,011 buildings); the showcase stacks
  13 of 106. Where stacks stand is the open question (track B).
- Fronts: the hub #3 wardrobe stands front to the wall and the Baltic dragon bed foot to the wall, the two pieces Tyler
  saw turned; 18 of 76 sconces have a wall on their side. Catalog fronts: wardrobe front -z (corpus 75 % of 12 builds),
  beds headboard at -z (mesh), sconce front +x (86 % of 486 builds).
- `wood_fence`: yard 40 %, covered 34 % (porch roofs and loft railings), never wall-hung. Darkwood raven, wolf and
  dragon heads: on roofs 34 to 43 %, median 6 to 7 m up, median 2 per build.
- Black marble table seats in the corpus: raven-set chair 44 %, marble throne 42 %, marble bench 31 %, stool 15 %,
  sitting log 5 %.
- The "darkwood chair" and raven throne are honey brown, lighter than darkwood building pieces; the name says dark.

## Checks

- `node -e` on `lib/catalog.js`: name, family, belongs, cap, facing, yawFacing, pairsWith return the values above.
- Placement and facing numbers re-read from `pieces.json` before writing them in the doc.
- Sheet: rows 1 to 3 and 1,105 to 1,108 read back after the paste.
- No generator file changed; no lab check was run (none needed for data-only changes).

## Open problems

- Colors are albedo from the textures; in-game lighting is lighter and warmer. Relative values are fine; absolute
  words like "dark brown" for plank wood read darker than the game shows.
- 385 prefabs had no measured mesh; their colors come from texture thumbnails or icons. Creatures, effects and loose
  items placed in the corpus (113 records) are kept for completeness and tagged by kind.
- Front is unknown for 286 non-structural pieces and low for 72; tables, rugs and round pieces have no front.
- The covered test counts porch roofs and eaves as cover, so "covered" overstates indoors for outdoor pieces.
- Deep North pieces (timber, scalewood, carved furniture) appear in at most 14 builds each; their pairings cannot come
  from the corpus yet.
- `lib/catalog.js` is not in the game bundle (`build_engine.js` lists the libraries); the generator does not call it
  yet. Track E wires it in.

## Proposed Decisions rows

1. Catalog in the game bundle: add `lib/catalog.js` and a slim `pieces.json` (names, family, look value, zone, mount,
   reuse caps, facing) to `lib/build_engine.js` so the game's generator can use it. Options: slim data in the bundle;
   lab only. Recommendation: slim data in the bundle (about 150 KB).
2. Deep North furniture pairing: the corpus has too few Deep North builds to learn from. Options: treat timber and
   carved furniture as a family that pairs with plank, log and raven-set furniture by color (L 31, between plank and
   darkwood); wait for more builds. Recommendation: pair by color now, as a setting.
3. wood_fence as porch and loft railing: corpus builders do it (510 of 2,082 placements). Tyler's notes say pastures,
   gardens and perimeters. Options: allow at porch and loft edges as the corpus does (D-127); yards only.
   Recommendation: allow as the corpus does, never indoors at floor level or on tower tops.
4. Scratch files on Tyler's PC in `Downloads\villheim-scratch\`: may they be deleted, and may later helpers use that
   folder to move files to the cloud?

## Next steps

- Track E: pick pieces through `catalog.family`, `belongs`, `cap` and `yawFacing`; the council items in
  `criteria/catalog.md` H2 and H3 measure the fronts.
- Re-run `build_catalog.py` when track B's `pairs.json` changes (it reads it from the corpus-rooms worktree).
- More hand descriptions (`families.py` DESC holds 60) and a look at in-game screenshots for the families whose albedo
  misleads (plank wood, ashwood).
