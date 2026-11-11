# Ideas track: where the generator differs from the corpus

Branch `design/wip-ideas`, from main a7f1566. Docs and data only; no generator or mod code changed.
Asked by Tyler on 2026-11-11 (through the lead): find ways to improve building design, exterior design, yards and
landscaping, and interior design, serving the drivers (messy realism, environmental storytelling, variance by
culture, village, family and household traits, professional room layouts, no fixed-interval rules), toward designs
good enough for the front page of r/ValheimBuilds. Lessons and rates below come from the corpus measures only (D-136).

## Files

- `tools/blueprint-lab/data/ideas/generated-measures.json`: every measure below for the generated pool (motif sites,
  shapes, culture-corpus measures by type, stage and culture, rooms by kind, yards, and per design sizes, pitch,
  critic numbers, outdoor greenery, relx counts, tilted pieces). Derived counts only.

## Method

Generated pool: `lib/request.js` `make` from origin/design/integration (d167cc4), tries 1, in a worktree at
`/tmp/h8-int`. Types home (seeds 11 and 47), longhouse, tavern, smithy, sawmill, workshop, barn, farm, storage,
tower, temple (seed 11); every culture of `styles.js` `BIOME_CULTURE` in its biome; s1d1, s2d2, s3d3. 612 made, 576
kept (byzantine is in the Plains and the Mistlands under the same file names, so the Mistlands set replaced the
Plains set). Median 239 pieces. 9 designs failed one check each (headroom 5, stability 2, support 1, overlap 1).

Each corpus measure was taken again on the pool with the code that made it:

| Corpus file | Corpus set | Measure run on the pool |
|---|---|---|
| `data/motifs.json` `skipped` | 543 builds: Tyler's Yes and the top 40 % by downloads | `lab/mine_motifs.js`, every build taken (`ALL`), site outcomes per build dumped |
| `data/yards.json` `wellLiked` | 115 builds, top quarter by downloads | `lab/mine_yards.js`, every build taken (`ALL`): 526 |
| `data/interior.json` `rooms` | 497 designs, top half by popularity plus Tyler's Yes | `lab/learn_interior.py`, every design marked Yes: 343 with interiors, 410 rooms |
| `data/shapes-summary.json` | 1,755 builds | `lab/shapes.py` |
| `culture-corpus/summary.json` (origin/design/wip-research) | 2,153 builds; norse 455 buildings, norse-named 142 | `mine_culture.js` and `sort_culture.js` from `/tmp/h4-research/dev` with `p/patch.js`, grouped by pool culture, type and stage |
| `culture-corpus` `relxAll` | 1,093 furnished buildings | the `note` definitions written again (`/tmp/h8/ext.js`); the device script is not on this machine |
| `data/critic.json` | 49 top-quarter house builds | `lib/critic.js` `measure` |
| `rules.json` `shell` | per category | sizes and the `learn.py` pitch rule in `/tmp/h8/ext.js` |
| `landscape/corpus-greenery.json` (origin/design/wip-landscape) | 296 house builds with greenery | class lists from the file; outdoor is "no roof or floor 1.2 to 12 m over it" (the culture miner's rule) |

Commands (scripts in `/tmp/h8`, kept out of the repo):
```
cd /tmp/h8-int/tools/blueprint-lab && node /tmp/h8/gen_pool.js . /tmp/h8/pool          # 312 s
node /tmp/h8/prep.js /tmp/h8-int/tools/blueprint-lab /tmp/h8/pool                       # compact.json
cd /tmp/h8/lab && ALL=1 LAB=/tmp/h8-int/tools/blueprint-lab DUMP=/tmp/h8/gen-motifs-dump.json node mine_motifs.js /tmp/h8/pool/compact.json /tmp/h8/pool /tmp/h8/gen-motifs.json
ALL=1 LAB=/tmp/h8-int/tools/blueprint-lab node mine_yards.js /tmp/h8/pool/compact.json /tmp/h8/gen-yards.json
cd /tmp/h8-int/tools/blueprint-lab && python3 -I lab/learn_interior.py /tmp/h8/iroot /tmp/h8/gen-interior.json --top 1
python3 -I lab/shapes.py /tmp/h8/shapes-in.json /tmp/h8/shapes-cat.csv /tmp/h8/gen-shapes.json
cd /tmp/h8/cm && node mine_culture.js /tmp/h8/croot /tmp/h8/gen-feat.jsonl 600 && GROUP=all node sort_pool.js /tmp/h8/gen-feat.jsonl /tmp/h8/gsum-all
node /tmp/h8/ext.js /tmp/h8-int/tools/blueprint-lab /tmp/h8/pool /tmp/h8/gen-ext.json
node /tmp/h8/cmp_motifs.js <motifs.json> /tmp/h8/gen-motifs.json; node /tmp/h8/overhang.js <motifs.json> /tmp/h8/gen-motifs.json
```
Motif site rates: a site is every terminal outcome of the miner ("kept clip" and "hidden piece dropped" are notes on
the way, and "no wall", "no face", "unsure side" and the like are sites it could not read). Dressed is a site with
trim (neither bare nor "no trim"); clean is "kept"; tilted is a site whose trim has a piece turned off level.

Limits: the corpus is mostly player bases, larger than village houses, so sizes are set against the stage the
corpus resembles (s3). Pool types are single-use buildings, so the corpus's mixed-use shares (uses, crafting in homes)
are set against homes, taverns and halls only. The relx counts on the pool use the note's rules, written again here.
The yard corpus set is small (115 builds). Corpus rooms count window pieces only, so a generated opening with no
window piece counts 0.

## Gaps, ranked by how much a person would notice

Notice: screen size (3 the whole building, 2 a roof or facade, 1 a part of a room), times the share of pool
buildings it touches, times how often the liked corpus set shows it. C is the corpus, G the generated pool.

| # | Gap | C | G | Notice |
|---|---|---|---|---|
| 1 | Upper storeys and height at s3 | Norse buildings 75 % two storeys or more (norse-named 85 %), height median 9.3 m; home shell median 868 pieces, 10.5 m | s3 27 % (homes 41, taverns 63, longhouses 6, storehouses 13), height 5.8 m; s3 homes 391 pieces, 6.6 m | whole building, every s3 building |
| 2 | Roofscape | top builds 4 ridge lines; 2.2 roof valleys per build; cross-gable 32 %, hip 7 % (Norse) | s3 median 2 ridge lines; 0.5 valleys per build; cross-gable 21 %, hip 17 % | roof, every building |
| 3 | Windows: kind, size and count | arch 27 %, glass 24 %, half-wall gap 17 %, grate 7 % of builds; 0.56 windows per wall-face site; 74 % single 1 m lights, 13 % 0.5 m, 10 % 2 m tall; shutters on 17 % of good builds (`docs/BUILDING_DETAILS.md`) | half-wall gap 64 %, none 33 %, glass 1 %, arch 1 %, grate 0; 0.31 per wall-face site; 82 % twin 2 m lights, none 2 m tall; shutters in 6 of 576 | facade, every building |
| 4 | The same trim everywhere, nothing worn | windows dressed 70 % (clean 44 %), corners 77 %, wall tops 60 %, inside corners 78 %; a tilted piece at 10 % of windows, 7.5 % of corners, 15 % of porches, 21 % of balconies, 16 % of stair entries | 95, 96, 92 and 100 % dressed, a clean motif on 93 % of windows; 0 tilted pieces in 147,914 | facade, every building |
| 5 | Banners | a banner piece in 53 % of Norse buildings (norse-named 65, norse-forest 68, highland 63, stone-house 43) | 6 % (34 of 576; longhouses 0) | facade and hall walls, half the buildings |
| 6 | Yards and outside life | decks and rails 50 %, low walls 37 %, steps 55 %, work stations 20 %, seats 14 %, signs 7 %, loose things 9 % of liked builds; fences 9 %, gates 3 %; fence pieces mostly low stone walls, stake walls, low log and half walls, `wood_fence` about 10 % (733 builds), `stone_fence` 25 pieces | rails 18 %, low walls 8 %, steps 38 %, work 9 %, seats 3 %, signs 0, loose 0; fences 30 %, gates 23 %; `wood_fence` 2,066 and `stone_fence` 789 of 2,886 fence pieces; paths of 1 m planks (524) | ground round s2 and s3 homes |
| 7 | Eave depth | kept eave motifs: 26 % reach 1.75 m past the wall, 16 % 0.75 to 1.25 m; gable rakes 73 % flush, 20 % 1 m | none past 0.75 m; rakes 85 % at 1 m, 15 % flush | roof edge and shadow, every pitched roof |
| 8 | Too many lights (generator does more) | 0.2 lights per 10 m2 (0.2 to 0.4 in every group); resin candles in 0 to 7 % of rooms; wall torches in 7 to 25 % of storage, sleeping and workshop rooms; Dvergr lanterns in 17 to 30 % | 0.7 per 10 m2 (s3 0.9); candles in 36 to 77 % of rooms; wall torches in 77 to 86 %; Dvergr lanterns 0 | every interior |
| 9 | Kitchens and cooking corners | kitchens: butcher table 54 %, oven 32 %, prep table 26 %, hearth 23 %, mortar 22 %, fire pit 15 %; home rooms fire pit 7 % | kitchens: each of those 0 %, fire pit 100 %; home rooms fire pit 75 % | a corner of every home and tavern |
| 10 | Wide doors | 42 % of kept door motifs 4 m wide (two doors or a gate) | 8 % | entrance, halls, taverns, barns |
| 11 | Storage rooms (generator does more) | median 7.5 m2, 1 kind of piece, 7.6 pieces per 10 m2 | 44 m2, 6 kinds, 4 per 10 m2; torches 86 %, barrel chests 78 %, signs 56 %, candles 50 % | rooms in storehouses and big homes |
| 12 | Tables on rugs, seats at tables (generator does more) | tables on a rug 27 % (Norse, 4 to 26 % by group); seats at a table 28 %, seats by a wall 42 % of seats | tables on a rug 76 %; seats at a table 46 %, by a wall 29 % | every furnished room |
| 13 | Ceiling heights all alike | room ceilings p25 to p75 2.0 to 4.4 m by kind (halls 2.2 to 4.2, storage 2.0 to 2.3) | 3.0 m in every room kind | every interior |
| 14 | Greenery on and round houses | of house builds with greenery, vines outside 27 %, bushes 36 %, flowers 30 %, trees 28 % | 432 house-like designs: vines 0, trees 0, bushes 9 %, any outdoor greenery 18 % (s3 29 %) | covered by the landscape track (D-143, `docs/handoffs/2026-11-10-design/landscaping.md`) |
| 15 | Sills and private chests | windows dressed 17 %; private chest in 20 % of home rooms; beds side by side 21 % | 3 %; 0; 7 % | small |

Close to the corpus, no change needed: wall base trim (15 % against 22 % dressed), wall-face trim (26 against 20),
eaves dressed (65 against 64), roof pitch (Norse 45 and 26 degree half each; pool 47 to 69 % 45 degree by type),
chests stacked (58 against 40 % of chests), beds lit (14 against 41 % of beds, the pool higher), beds under a slope
(14 against 12), seats, tables and rugs off the wall axes (42, 29, 31 against 34, 25, 33 %), mixed wall materials
(half-timber and stone-base 32 % of corpus builds against 31 %). Dormers (0.1 per build) and stone chimneys (0.1 per
build) are rare in the corpus too.

## Top 10: the change, the files, decisions, size

1. **Upper storeys at s3.** `lib/styles.js` (`GROWTH`, `LADDER`) and `lib/generate.js` (`massingPath`, storeys):
   at s3, homes, taverns, halls and storehouses take a full upper storey or a loft under a 45 degree roof (knee walls
   1 m) by culture weight, with the sleeping room upstairs and stairs where they fit (D-064). Brings beds upstairs
   (77 % in the corpus, 36 % now) and taller silhouettes. Massing track. 12 to 16 h.
   Proposed row: "s3 buildings with an upper storey or loft. D-069 keeps s1 and s2 one storey and three storeys rare.
   A) the corpus share, about three in four homes, taverns and halls at s3; B) about half; C) as now (27 %).
   Recommend A. Mod side: villagers climb stairs to upstairs beds."
2. **Roofscape.** `lib/generate.js` roof per wing, `lib/styles.js` `ROOF_SETS`: wings at their own ridge heights,
   cross gables over the entrance and stair, lean-to outshots along a long wall at s2 and s3; hip weight per culture
   to the corpus share. Massing track. 10 to 14 h. No decision (D-069 asks for more complex roofs at later stages).
3. **Windows.** `lib/generate.js` (openings) and `lib/details.js` (frames, shutters): a window kit per building drawn
   by culture and household (single 1 m lights most often, 0.5 m slits, 2 m tall lights in halls and at s3), openings
   at the corpus count per wall run, shutters placed where their present conditions fail, arches in stone walls where
   D-012 allows stone, iron grates from the Swamp. Exterior track. 8 to 10 h.
   Proposed row: "Glass windows (`crystal_wall_1x1`, Mountain crystal; 24 % of corpus builds). A) a building piece
   under D-126: the Mountain and its neighbors on; B) a window counts as decor, any biome (D-065). Recommend A."
4. **Varied trim and wear.** `lib/details.js`, `lib/motifs.js`, `lab/mine_motifs.js`: a trim budget per building from
   household and culture traits, a bare share per feature kind at the corpus rates, the front richer than the back;
   motifs with tilted pieces mined and kept (the miner skips them now) for braces, leaning logs and shutters; an odd
   patch piece in a wall at s2 and s3. Exterior track. 8 to 12 h.
   Proposed row: "Tilted pieces (turned off level). The vanilla build menu turns pieces about the vertical only;
   corpus builders tilt pieces through mods at 6 to 28 % of feature sites. A) tilt trim and props at the corpus share
   (braces, leaning logs, crooked shutters), never walls, floors or roofs that carry load; B) no tilt. Recommend A."
5. **Banners.** `lib/details.js` (the d3 gable banner) and `lib/decorate.js` or `lib/kitbash.js`: banners beside
   doors and on gables from d2, along hall and tavern walls inside, more for households with a status trait. Exterior
   and interior tracks. 3 to 5 h. No decision (D-065, D-126).
6. **Yards.** `lib/yards.js`: fewer closed fenced yards and gates, decks and terraces with rails and steps at the
   door, low log or half walls (low stone walls only where D-012 allows stone), a seat and a work corner by the door, a
   sign, loose things; fence pieces drawn from the corpus kinds, `stone_fence` rare; paths of 2 x 2 floors. Yards
   track. 8 to 10 h. No decision (D-012, D-124 hold).
7. **Eave depth.** `lib/generate.js` (roof rows), `lib/details.js` (`:679`, `:758`): deep eaves on part of the
   buildings, rakes mostly flush. Massing track. 4 to 6 h.
   Proposed row: "Eaves deeper than D-059's 1 m. A) keep 1 m (D-059); B) about a quarter of roofs reach about 1.75 m
   where the walls are tall enough or a porch or gallery is under them, the rest 1 m, gable rakes mostly flush as in
   73 % of corpus gables. Recommend B, tried in the game on two houses first (T-102 roofs stuck out)."
8. **Fewer lights.** `lib/decorate.js` and `lib/kitbash.js` light passes: a light budget per room kind from the corpus
   (0.2 to 0.4 per 10 m2), candles on tables and altars at the corpus shares, Dvergr lanterns in the mix. Hearths and
   lighting track. 3 to 4 h. No decision (D-065).
9. **Kitchens.** `lib/decorate.js` and the kitbash library: a cooking corner in homes and taverns (butcher table,
   oven, prep table, mortar) and the `hearth` piece in larger rooms (stone from s2, D-131). Essentials or hearths
   track. 4 to 6 h. No decision (D-065).
10. **Wide doors.** `lib/generate.js` doors, `lib/details.js` door frames: a 4 m entrance (two doors side by side,
    or a gate) on halls, taverns, barns and large s3 homes. Exterior track. 3 h. No decision; every door stays usable
    (D-096).

## Open

- Gaps 11 to 13 (storage rooms, tables on rugs, ceilings) each fit the layout or decorator track; D-149 (open)
  covers lone chairs and bare rugs.
- The relx device script should be committed by the track that owns lab scripts, so the pool and the corpus run one
  file (research record says the same of `mine_culture.js`).
- The worktree `/tmp/h8-int` was removed after the run.
