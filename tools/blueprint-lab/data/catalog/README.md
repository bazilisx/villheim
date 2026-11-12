# Piece catalog data

`pieces.json` holds one record per vanilla prefab that appears in the corpus (`compact.json`, 2,128 builds) or that
the generator can place. Lookups for code are in `lib/catalog.js`; the method, families, tag sets and findings are in
`docs/PIECE_CATALOG.md`. Everything here is derived: hex colors, shares, counts and sizes. No game art or corpus
blueprint is stored here.

## Files

| File | What it holds |
|---|---|
| `pieces.json` | `{ about, version, corpus_builds, families, pieces: { <prefab id>: record } }` |
| `pairs.json` | Look family co-occurrence: lift inside the same build and inside the same covered area |
| `overuse.json` | The 16 showcase designs against the corpus, per piece |
| `tools/` | The scripts that make the files (see "How to rebuild") |

## Record fields

| Field | Meaning | Source |
|---|---|---|
| `id` | Game prefab id (the key) | game |
| `name` | Our working name: what a person sees ("stool" for `piece_chair`) | ours; Tyler's words where he gave them |
| `name_src` | `ours`, `game` (the English in-game name, lowercased) or `id` | |
| `game_name` | English in-game name from the game's localization file | game files |
| `kind` | What it is for: seat, table, bed, storage, light, fire, rug, station, station-addon, display-stand, sign, carving, hanging-cloth, container-decor, seasonal-decor, resource-stack, decor, wall, floor, roof, roofTop, roofCorner, gable, beam, pole, stair, door, window, fence, plant, rock, food, item, creature, effect, misc | lab role (`lib/pieces.js`) and game folder |
| `family`, `family_label`, `family_src` | Look family and the evidence that put it there (shared texture or id series) | game textures, contact sheets |
| `material`, `material_mix` | Main material, and the share of the visible surface per material when the mesh has several | mesh parts' material names |
| `finish`, `formality`, `tier_biome` | Finish words, 1 rough to 4 grand, and the biome tier of the family | family table |
| `look` | `mean` hex, up to 4 `swatches` with surface shares, `L` (CIE lightness 0 to 100), `value` (very dark, dark, mid, light, very light), `hue`, `warmth`, `chroma`, `saturation`, `source` (mesh, texture or icon), `parts` per material, `icon_mean` | mesh colors sampled from the game textures at the mesh UVs; icons |
| `glow` | Light color and range, emissive color, particle systems, and a note for glows set by an emission map | game prefab |
| `materials`, `textures` | Game material and texture names | game prefab |
| `size_m`, `size_class` | Mesh bounds in meters (x, y, z in the piece's frame); tiny, small, medium, large, huge | mesh cache |
| `placement` | Vote-weighted mean over the builds that use it of: `covered` (a roof or floor above), `on_roof`, `by_gable_outside`, `yard_ground`, `open_deck`, `against_wall` (within 0.7 m of a wall), `wall_hung` (against a wall and 0.8 m or more above the floor below), `under_ceiling`, `on_furniture`, and `height_m` (p10, median, p90 of the per-build median height above the floor piece below) | corpus |
| `zone`, `mount` | Placement in words: indoors, outdoors, yard and grounds, roof and gable outside, indoors or outdoors; floor-standing, wall-hung, ceiling-hung, on furniture, raised or mixed | corpus |
| `reuse` | `builds`, `share` of all builds, `vote_share`, `placements`, `per_build` counts when used (p50, p75, p90, max, and vote-weighted p50 and p90), `per_100m2_floor` (p50, p90), `tier` (staple 20 %+, common 8 %+, occasional 2.5 %+, rare 5+ builds, very rare), `showcase` counts | corpus |
| `build_kinds` | Corpus categories where it shows up at 1.4 times its base rate or more: `[category, builds, lift]` | corpus |
| `facing` | `front`, `back` in the piece's frame, `sure` (high, medium, low, unknown), with the evidence: `corpus_back` (the side builders put against a wall), `corpus_share`, `corpus_builds`, `mesh_tall_side` (backrest or headboard side) | corpus and mesh |
| `buildable` | Has a build-menu Piece in the game's Pieces folder (world props, items and creatures are false) | game |
| `game_tab`, `comfort`, `comfort_group` | Build menu tab number, comfort value and group | game |
| `generator_files` | Lab files that name the prefab | `lib/*.js` |
| `tags` | Flat tags for filtering: `kind:`, `family:`, `material:`, `value:`, `hue:`, `warmth:`, `saturation:`, `light:`, `glow:`, `zone:`, `mount:`, `reuse:`, `formality:`, `size:`, `finish:`, `comfort:`, `not-buildable`, `generator` | |

Votes: each build counts with weight 1 + ln(1 + votes) (votes run 0 to 47, median 5). Shares and placement means use
these weights; `per_build` gives plain and weighted quantiles. compact.json has no verdict field (all empty).

## How to rebuild

On Tyler's PC (game files): `tools/icons.py index` then `tools/icons.py run <Valheim_Data> <work> <names.txt> 140`
(one call reads one bundle group in under three minutes; repeat until it reports nothing left) writes icons, texture
thumbnails and the look facts per prefab. The icons and thumbnails are game art and stay out of this repo; the contact
sheets are in the private repo under `research/2026-11-12-catalog/`.

In the cloud machine, with `compact.json` converted to one build per line:

```
node data/catalog/tools/corpus_pass.js tools/blueprint-lab /tmp/catalog/stats.json
python3 -I data/catalog/tools/colors.py            # mesh colors from the measured mesh cache
python3 -I data/catalog/tools/build_catalog.py /tmp/catalog data/catalog/pieces.json
```
