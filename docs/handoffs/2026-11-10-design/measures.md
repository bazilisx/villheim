# Corpus measures for trim, decks and storeys (measures helper, 2026-11-11)

Branch `design/wip-measures` from main 509744e. Scope: measure only. No generator code (`lib/*.js`), target or band
changed. No file in `src/` changed. Results: `docs/BLUEPRINT_LAB.md`, "Corpus measures for trim, decks and storeys".

## Files

- `tools/blueprint-lab/lab/measure_corpus.js`: reads the corpus (`i/n` chunks, one record per build). Run on the
  device: clone the branch to a scratch folder, `node --max-old-space-size=3000 lab/measure_corpus.js
  $HOME/mnt/Downloads/Villheim-blueprints <out> i/24` for i = 0..23 (about 4 s a chunk).
- `tools/blueprint-lab/lab/measure_merge.js`: `node lab/measure_merge.js <outdir> <chunks...>` writes the three data
  files and `measures.md` (the doc tables).
- `tools/blueprint-lab/data/measures-trim.json`, `measures-decks.json`, `measures-storeys.json`: counts and quartiles.
  The per-build records stay in the scratch folder on the device (they name corpus files).

## Open

- Wall-to-wall street widths, storeys of buildings with stairs and no floor pieces, and entry from doors to decks are
  not measured. Fence, low wall and rail heights are catalog heights.
- Roof clusters join wings closer than 1 m, so a large starter-home design is one building (home median roof area
  348 m2).
