# Corpus recount with fine models (recount helper, 2026-11-11)

Branch `design/wip-recount` from `design/wip-models` ee15184. Scope: measure only; no generator code, target or band changed.
The result is in `docs/BLUEPRINT_LAB.md`, "Corpus recount with fine models".

## What was done

- Inventory of corpus measures that use piece shapes (table in the lab doc). Colliders and bounds are identical on main
  509744e and ee15184, so every collider-based corpus measure is unchanged; `lab/mine_stands.js --counts` gives the
  committed `data/stands-corpus.json` byte for byte on both.
- `lab/mine_stands.js`: `VH_SHAPES=coarse|fine` reads surface tops and wall stand clip depths from the model parts.
  Default output is unchanged.
- `lab/recount_compare.js`: counts files side by side with the test_stands tolerances.
- `lab/recount_clips.js`: ledge and furniture clip depths from colliders, coarse and fine parts (24 chunks, merge).
- New data: `data/recount-stands.json`, `data/recount-clips.json`. Old data files untouched.

## Open

- Corpus "into what shows" targets for wall stands (75th 5.0 cm, 90th 9.7 cm fine) against `WALL_SHOW` 12 cm and the
  generator's d3 line in test_stands (46 % of 257, 75th 9 cm, 90th higher): the integration round decides.
- Measures that need `compact.json` were not rerun (not on the device); they read colliders only.
