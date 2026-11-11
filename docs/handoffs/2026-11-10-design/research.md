# Research track: corpus by culture, interior references

Branch `design/wip-research`, from main 0604748. Data and docs only; no generator code changed.
State on 2026-11-11 (Mountain Time): part (a) done: counts in `tools/blueprint-lab/data/culture-corpus/`, the write-up
in `docs/CULTURE_STYLES.md` "Corpus by culture" (commit 46ecbae) with a spot check of the low-confidence sort and
outside sources for the thin cultures (D-135). Part (b) in part: `docs/INTERIOR_DESIGN.md` "Lived-in rooms: outside
references (D-025)" (commit c630579): three valheimians builds from their photos, four historical households,
Skyrim, Witcher 3, WoW housing, Enshrouded and a design talk, with options under the drivers and a table of
on-purpose tricks with corpus counts (D-127).

## Files

- `tools/blueprint-lab/data/culture-corpus/summary.json`: derived counts per culture group (plans, roofs, storeys,
  footprint, materials by part, sign pieces, furniture kinds, layout relations, room uses, what stands on tables and
  under windows, top items, best-liked buildings by title and maker). The `note` field explains the units. No
  blueprint content.
- `tools/blueprint-lab/data/culture-corpus/members.json`: the builds sorted with high or medium confidence
  (corpus folder/slug, confidence, reason). Low-confidence builds are counted in summary.json only.

## Method

Corpus: `C:\Users\tyler\Downloads\Villheim-blueprints` (valheimians downloads), read only through the remote device
tools as `$HOME/mnt/Downloads/Villheim-blueprints`. 2,153 `.blueprint` files in 24 category folders (`_tests`,
`_errors` skipped; no OverDrive BiomeBlueprints pack and no `hs_` files are in this folder). Titles, makers and
downloads come from the root `index.json` (1,450 entries, matched by slug); the description from each file's
`#Description`. The 325 `.zip` and 169 `.vbuild` files were not read.

Mining (one build at a time, 42 s for all 2,153 on the device, node 22):
- Parser: the lab's `lib/blueprint.js` and `lib/pieces.js` copied to the device, with a stub `mesh.js` (sizes from the
  name rules only; role and material are what the miner uses). `lib/shapes.js` was not needed.
- Per build: the plan shape, roof type and wall rules of `lab/shapes.py` ported to JS (main walls turned to the axes;
  plan from floor cells on a 1 m grid of the largest storey); storeys are floor levels of 6+ cells, 2.4 m or more apart
  and 12+ cells; floor area summed over storeys; dominant material of walls, walls under 1.6 m, roof, floor and frame;
  counts of sign pieces (dragon heads, turf, cloth doors, tents, Dvergr, black marble, grausten, stone arches...).
- Furniture counts only pieces "inside": a roof or floor piece 1.2 to 12 m above within one 2 m cell. Relations:
  bed on a rug (rug within 1.8 m), chest within 2.6 m of a bed, beds side by side (another bed within 2.4 m), table on a
  rug, seats within 2.2 m of a table, seats and rugs within 3.5 m of a fire, beds above the main floor (more than 2 m
  over the largest storey), beds on a storey with a fire, layered rugs (another rug within 1.2 m and 0.3 m in height),
  dressed tables (any loose piece within 0.9 m, 0.5 to 1.6 m over the table), dressed windows (any loose piece within
  1 m, from 1.3 m under the window pivot to 0.1 m over it). On-table and sill lists keep furniture roles only and drop
  mod prefixes (`$`, `GB_`, `kg_`, `VC_`, `MWL_`, `Pickable_`, `CastleKit_`).

Sorting by culture (`sort_culture.js`), in this order:
1. Style words in the title or slug (confidence high), then in the description (medium). Word groups in priority
   order: saami, steppe, caucasian-highland, celtic-crannog, baltic, slavic, byzantine, middle-eastern, east-asian,
   greco-roman, anglo-saxon, frankish-norman, celtic, norse-highland (mountain, highland, turf, Iceland), norse-forest
   (stave, Black Forest, forest, cabin), fen-folk (swamp, fen, marsh, bog, witch), ashlands, mistlands (Dvergr words
   only; "Mistlands era" names the game stage), fantasy, modern, tree-house, castle, medieval-timber (tudor, medieval,
   half-timber, cottage, manor), norse (viking, norse, nordic, longhouse, jarl, mead hall...). Biome words map to that
   biome's D-001 culture.
2. With no style words, form and material (low unless stated): under 20 building pieces unsorted; grausten walls
   over 40 % or ashwood walls over 40 % ashlands (medium); black marble walls over 50 % mistlands; 20+ turf pieces
   norse-highland (medium); dragon heads on a wooden build norse (medium); a small round or conical thatched one-storey
   build celtic; wooden walls with a thatch or dark wood pitched or conical roof norse; stone walls under a pitched
   roof up to 12 m high stone-house; stone over 50 % and over 12 m castle; the rest unsorted.
3. `norse-named` is the norse group without its low-confidence builds.
Building measures use builds with 40+ building pieces outside the statue, bridge, arena, mini-game, portal-hub,
farming and artistic folders; interior measures use those with 5+ pieces of furniture inside.

Commands (device, `$HOME/vhresearch`; the scripts are kept out of the repo):
```
node mine_culture.js $HOME/mnt/Downloads/Villheim-blueprints feat.jsonl 160   # resumes; one line per build
node sort_culture.js feat.jsonl out                                           # out/summary.json, out/builds.json
node compact.js                                                               # out/summary-compact.json, out/members.json
```
Files went to the cloud as tar + gzip + base64 (md5 checked). Intermediate files on the device: `$HOME/vhresearch/`
(`feat.jsonl` 2.6 MB with short descriptions, `out/`). The device session folder may be cleared when the session ends;
rerunning takes under a minute. Cloud copies of the scripts: `/tmp/h4-research/dev/` (`mine_culture.js` and
`sort_culture.js` before the device edits) and `/tmp/h4-research/p/patch.js` (the relation, sill and table additions);
the device copies hold the final versions, including inline edits (storey rule 2.4 m and 12 cells, ashwood and
stone-house rules, the norse word boundary, `sami\b`, `romans?\b`, Ghibli words, no game titles in fantasy, best
lists from buildings only, furniture-only sill lists). These scripts should be committed later as
`tools/blueprint-lab/lab/mine_cultures.js` by a track that owns lab scripts.

## Findings so far (part a)

1. The corpus is almost all Norse-style or culture-neutral. Of 2,153 builds: norse 495 (157 by name), castle 264,
   ashlands materials 175, mistlands 81, stone-house 55, norse-forest 48, fantasy 41, medieval-timber 31,
   norse-highland 29, east-asian 22, fen-folk 18, celtic 15, modern 15, greco-roman 7, tree-house 7, celtic-crannog 6,
   saami 3, and one each for slavic, frankish-norman, middle-eastern and steppe; none for anglo-saxon, baltic,
   byzantine or caucasian-highland. 837 stay unsorted (458 of them under 40 building pieces). `index-keywords.json`
   lists desert, mosque and pagoda builds marked not downloaded. The non-Norse D-001 cultures need outside sources or
   proxies (medieval-timber and stone-house for anglo-saxon and frankish-norman; castle for keeps; greco-roman for
   byzantine forms).
2. Beds: two kinds in near equal use in Norse builds (`bed` 389, `piece_bed02` 375); `piece_bed02` leads in larger
   and later builds (norse-named, highland, castle, ashlands). Beds sit above the main floor in 50 to 85 % of builds
   that have them (91 % east-asian); a bed shares a storey with a fire in 25 to 56 %. About 30 % of beds have a rug
   beside or under them (45 % fantasy, 64 % east-asian); 17 to 38 % have a chest within 2.6 m; beds side by side are
   rare except norse-forest cabins (45 %).
3. Tables and seats: `piece_table` first, then `piece_table_round`; the butcher table is a common third. Half of Norse
   tables have a seat within 2.2 m, but only a quarter of seats stand at a table: the rest stand along walls, by
   stations or as decor. Seats near fires are rare (3 to 9 %). Tables carry something 23 to 59 % of the time, and the
   thing on top is mostly a horizontal item stand (`itemstandh`), then candles, treasure stacks, private chests,
   turnip lanterns and signs. Chairs: `piece_chair`, `piece_chair03`, `piece_chair02`.
4. Rugs: `rug_deer` and `rug_fur` lead, `jute_carpet` third (wolf rugs lead in the Mountain group). 18 to 27 % of
   rugs overlap another rug (layering); only 4 to 11 % lie by a fire; tables stand on a rug 4 to 41 % of the time.
   Rugs per furnished build: median 4 Norse, 9 to 11 highland and fen, 24 fantasy.
5. Sills and walls: 15 to 31 % of windows have something under or in them, again mostly `itemstandh`, then lanterns
   and signs. Horizontal stands are about half of all item stands in every group. Lights run 0.2 to 0.6 per 10 m2;
   wall torches lead in Norse builds, Dvergr lanterns in later builds.
6. Forms: Norse houses are wooden plank walls (66 % plank low walls, 17 % stone footing), thatch roofs 63 % (dark wood
   36 %), gable 42 % and cross-gable 32 %, plans irregular or rectangle and T, median footprint 17 x 24 m, 2 storeys
   most often. Norse-highland: stone walls 52 %, turf roofs 27 %, round plans 15 %. Celtic: conical thatch 80 %, round
   plans, one storey 70 %, log walls. Stone-house: all stone walls, 2 storeys, 14 x 20 m.
7. Room uses (share of furnished builds): Norse sleeping 71, hearth 84, cooking 77, crafting 70, storage 80, feasting
   50, display 44, bathing 18. Most popular builds mix home, workshop and storage in one building.

Caveats: the "inside" test, storeys and sill reach are coarse; some builds use mod pieces; counts are of whole builds
(large bases dominate the totals), so medians and shares are the numbers to use.

## Session 2026-11-11

- Spot check: 25 low-confidence sorted builds and 3 unsorted, by title, description, materials and form (device query
  of `out/builds.json` and `feat.jsonl`, spread through each group in slug order). 18 of 25 right, 3 partly, 4 wrong;
  2 of 3 unsorted rightly so. Table in `docs/CULTURE_STYLES.md`.
- frankish-norman's one match is a Frank Lloyd Wright style house (the `franks?` word matched "Frank"): the count is 0.
  The saami group is two teepees and one description match.
- Trick counts (D-127) over the 1,093 furnished buildings: a one-off node query on the device over `feat.jsonl` `items`
  (regex groups for wood stacks, piles, treasure, candles, banners, item stands, armor stands, rugs, cauldron
  extensions, barrels). `items` holds pieces inside only.
- Valheimians photos: read in the cloud browser tool (`remote-browser`), read only, image URLs opened directly
  (`static.valheimians.com/.../*_xl.webp`). WebFetch to valheimians build pages and to UESP was blocked (permission
  prompt unanswered); after that no more pages needing approval were tried.
- Web search and WebFetch for the D-135 sources; each is listed with its URL in `docs/CULTURE_STYLES.md`.

## Changes in other tracks' files

None.

## What is left

- Part (a): per-room layouts by culture would need the room finder of `lab/learn_interior.py` run per build. The
  sort script's `franks?` word should get a guard for "Frank Lloyd Wright" when the miner is committed.
- Part (b): Baldur's Gate 3 and ESO housing (no interior write-up read yet); more valheimians interiors (only three
  builds viewed; captioned village builds such as the Valheimberg series give who-lives-where); UESP house pages for
  Skyrim (who owns what in each home); the "not read" D-135 sources in `docs/CULTURE_STYLES.md`.
- Measures that the references suggest and the corpus data lacks: chair angles off the table axis, beds in lofts,
  rugs over beds, cloth hangings used as dividers, resource stacks set into wall bays.
- For the essentials task first: findings 2 to 5 (bed kinds and their rug and chest rates, beds above the main floor,
  seats mostly away from tables, `itemstandh` as the main table and sill dressing, rug kinds and layering), from
  `summary.json` `kinds`, `rel`, `onTable`, `onSill`.
