# Corpus recount 2 (recount helper, 2026-11-11)

Branch `design/wip-recount2` from `design/wip-recount` 0b5fa55. Measure only; no generator code or target changed.
Result: `docs/BLUEPRINT_LAB.md`, "Miners that need compact.json (second recount)".

## What was done

- `lab/build_compact.js` makes `compact.json` from the corpus folder (device, 44 s). Kept in `/home/claude/study`, not in the repo.
- `lab/shape_mode.js` and `VH_SHAPES=collider|coarse|fine` in `mine_kitbash.js`, `mine_creative.js`, `mine_yards.js`, `mine_motifs.js`,
  `coverage.js` for the judgments of what shows. Default output unchanged (kitbash, creative, yards, motifs checked against the
  collider path: same counts for creative, yards identical apart from the clip depth definition).
- `mine_motifs.js`: `SLICE=i/k`, `DUMP`, `MERGE` for runs over the device's 180 s limit.
- `lab/recount2_compare.js`: the tables. New data: `kitbash-interior-fine.json`, `yards-fine.json`, `motifs-fine.json`,
  `coverage-fine.json`, `creative-mined-fine-sample.json`, `recount2-compare.json`.

## Commands

Device (node 22): `node lab/build_compact.js $HOME/mnt/Downloads/Villheim-blueprints compact.json`; yards and motifs run on the device
(motifs reads the files); kitbash, creative and coverage ran in the cloud on `compact.json` staged from the device.
`VH_SHAPES=fine node --max-old-space-size=3800 lab/mine_kitbash.js compact.json out.json`; coverage with `--quick` and an `out md`
path outside docs.

## Not run or limited

- No Review tab: `verdict` empty, so motifs lose Tyler's Yes builds. The old column is the miner on this corpus, not the committed file.
- Creative fine: 256 of 1,536 builds (over 20 minutes for the full run; a full run needs over 3 GB and was killed twice by memory).
- Kitbash on the collider path was not run (creative and yards show the path matches the unchanged miner).
- Coarse mode ran for yards and motifs (outputs not committed), not for kitbash, creative or coverage.
- Candidate lists (`around`) still use collider boxes in fine mode.

## Open

- Whether the library is rebuilt with the fine clip values (kitbash clips, motif clip allowance, yard sink and heights), and whether
  the creative set membership change is wanted. Integration decides.
