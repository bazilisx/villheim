# Blueprint lab

Tools that learn how Valheim buildings are put together from Tyler's approved designs and other builders'
blueprints, then generate new designs, strip or furnish existing ones, check them, and draw them without the game.
Code in `tools/blueprint-lab/`. Built 2026-11-08 night. Nothing generated here is used by villages: see "Rules".

## What is where

| Part | File | What it does |
|---|---|---|
| Corpus reader | `lab/build_corpus.py` | Reads every PlanBuild blueprint (Tyler's, the 718 in PlanBuild's inspiration folder, the 12 permitted `hs_` keepers, the valheimians downloads), skips copies of the same build, joins the review sheet's Yes and No and the sort's type and subtype. Never reads the rest of the BiomeBlueprints pack. |
| Rules | `lab/learn.py` | Per design: category, culture, size stage, decor stage, palette. Then sizes per category, piece palettes per biome, furniture per room use and decor stage, where each furniture piece stands (against a wall, on a wall, in the middle; how far out; how high; which way it faces), and furniture groups (what stands next to what, and where). Writes `data/rules.json`. |
| Shapes | `lab/shapes.py` | Turns each build to its main axis, then sorts plans (rectangle, long, square, L, T, U, cross, octagon), roofs (gable, cross-gable, hip, half-hip, shed, flat, ring), walls (plank, half-timber, log, stone, stone base, marble, grausten), windows and gable ends, and counts which go together. Summary in `data/shapes-summary.json`. |
| Offsets | `lab/offsets.js` | How two pieces sit next to each other in the corpus, measured in the first piece's frame. The roof and gable rules below come from this. |
| Scorer | `lib/features.js`, `lab/train_scorer.py` | 21 numbers per design and a logistic regression on the review's Yes and No (206 kept, 455 dropped). Cross-validated AUC 0.70. `data/scorer.json`. |
| Pieces | `lib/pieces.js` | Size, shape, role and material for any prefab name; the biome a material first appears in. |
| Generator | `lib/generate.js`, `lib/styles.js` | A request (type, biome, culture, plan, roof, walls, size stage, decor stage, seed) to a design. |
| Decorator | `lib/decorate.js` | Furnishes rooms to d1, d2 or d3; strips any design to d1; furnishes any existing blueprint against its real walls. |
| Checks | `lib/checks.js` | Every piece connected to the ground, no doubled pieces, doors with room on both sides, materials the biome has, floor left free. |
| Renderer | `lib/render.js`, `lib/sheet.js` | Four views (front left, back right, top, inside with the roof off) as PNG in Node or on a canvas in a browser. |
| Request page | `web/app.html`, built to `web/index.html` by `lib/build_web.js` | Type or pick a request, get the best of up to 16 candidates, turn it round, download the `.blueprint`; a second tab strips or furnishes an uploaded blueprint. Published as the artifact "Villheim Blueprint Lab"; a copy is in `BepInEx/config/Villheim-tools/` on Tyler's PC and opens offline. |
| Review set | `lib/gen_set.js` | Every type in five biomes at s1d1, s2d2, s3d3, plus six cultures; best of 8 each. 273 designs, all pass every check. |

## Measured building conventions

From `lab/offsets.js` over the corpus. The generator and renderer both follow these, so a generated design lines up
the way a hand build does.

- Walls, floors, beams and poles pivot at their centre. Furniture and props stand on their pivot (about 0.1 m above
  the floor piece's pivot).
- A gable roof has a 2 m ridge cap on the ridge and rows centred 2, 4, 6 m out from it. Each row's low
  edge rests on the beam at its outer edge.
- A 26 degree roof piece pivots on its low edge; a 45 degree piece in its middle. Both run 2 m across and rise 1 m or
  2 m toward their local -z.
- Gable pieces (`wood_wall_roof`, `_45`) sit under each row with their pivot on the row's low edge and rise toward
  their local +x. Plain walls fill below them.
- Hip corners (`*_ocorner`) sit at a row's low edge, turned 180 at the front left, 90 at the front right, 0 at the back
  right and 270 at the back left. A 45 degree corner sits 1 m below the side piece next to it; a 26 degree corner level
  with it.
- Roof rows line up with wall bays only when the building's depth is an odd number of bays, so the generator keeps
  depths odd under pitched roofs.

## What the corpus says (1,427 designs, 2026-11-08)

- Plans: irregular 452, T 150, rectangle 130, octagon or round 113, L 94, square 84, U or courtyard 58, long 36,
  cross 17. Tyler's keepers: irregular 68, T 37, rectangle 35, L 21, octagon 15.
- Roofs: cross-gable 274, gable 261, ring 180, flat 178, hip 94. Keepers: gable 73, cross-gable 62, ring 35.
- Walls by biome: Meadows half-timber 144 and plank 110; Black Forest stone 151, stone base 41, log 34; Swamp stone,
  stone base, half-timber and plank; Mistlands black marble; Ashlands grausten.
- Pairings: round plans carry ring roofs, L and T plans carry cross-gables, towers carry hip roofs or none.
- What the keep score rewards: more kinds of piece for the size, fewer pieces overall, more roof and posts, fuller
  rooms, fewer modded pieces, less lighting.
- Thin spots: only 3 builds read as Middle Eastern and 24 as East Asian. Those styles lean on hand-set rules
  (`styles.js`) more than on learned numbers. A slow keyword search of valheimians for desert, Asian, medieval,
  Celtic and other styles found 17 more downloadable builds (8 Japanese among them); they and about 200 late downloads
  wait in Downloads to be sorted and added (see the 2026-11-08 note).

## Request to design

1. Plan from the type and stage (weights from the corpus counts per type), unless the request names one. Round plans
   only for styles that build them.
2. Roof from the culture (weights from culture by roof), forced to a ring roof on an octagon and to a hip or gable
   elsewhere.
3. Walls from the biome's corpus counts, or the culture's own.
4. Size from the type table, nudged by the seed; depth kept odd under a pitched roof.
5. Footing: stilts (swamp), short posts (raised floors), a stone course (Black Forest, Mountain), or none.
6. Wings for the plan; floor cells; outside edges; one door on the main wing's front; windows on alternate bays;
   posts at every corner of every bay; top plates.
7. Roof per wing. Where wings cross, the lower roof runs into the higher one; pieces hidden under the higher roof are
   left out. The ridge cap is left open over an indoor fire for smoke.
8. Porch, pier, field, pen, dragon heads where the type and culture call for them.
9. Furnishing by room use and decor stage, then anything standing in a doorway is taken out.
10. The page and the review set build several seeds and keep the one that passes the most checks, then scores highest.

## Rules

- CLAUDE.md still says "existing designs and assets only". Generated designs are approved in principle (Tyler,
  2026-11-08) with controls still to agree, so they are kept apart: `Downloads\Villheim-generated\` on Tyler's PC and
  the Generated tab of the review sheet. Villages never build them. Villheim reads every blueprint under PlanBuild's
  folder, so do not copy generated designs there unless they sit under a folder named `inspiration` (which villages
  skip) and the gallery numbering is ready for them.
- Proposed wording for CLAUDE.md once Tyler agrees: "Generated designs from the blueprint lab may be built by villages
  once Tyler has marked them Yes in the Generated tab and they are copied to `blueprints/approved-generated`. They use
  only vanilla pieces and pass every check in `lib/checks.js`."
- The BiomeBlueprints pack stays blacklisted. Only the 12 builds by other creators listed in `Keepers.cs` are read.
- Other creators' builds are study material. They are not committed to the repo and not shipped.

## Limits

- Piece sizes come from names and corpus measurements, so the pictures are close. An in-game export of each piece's
  collider would make them exact.
- Crop fields need the ground cultivated in game for crops to grow back.
- The decorator's facing per item comes from the corpus. Items whose facing the corpus does not settle face into the
  room.
- None of the generated designs has been placed in the game yet.

## Commands

```
cd tools/blueprint-lab && npm install
python3 lab/build_corpus.py <corpus dir> corpus.json        # pb/, hs/, vh/, profile/, review.json
python3 lab/learn.py corpus.json [index.json] learn/
python3 lab/shapes.py corpus.json learn/catalog.csv learn/shapes.json
node lab/export_features.js corpus.json features.csv && python3 lab/train_scorer.py features.csv data/scorer.json
node lib/cli.js gen home "Black Forest" - s2 d2 7 out/house       # one design and its four views
node lib/cli.js decorate in.blueprint home d3 Swamp out/furnished  # furnish or strip (d1) a blueprint
node lib/batch.js out/shapes shapes                                # plan and roof matrix with an overview image
node lib/gen_set.js out/set 8                                      # the review set
node lib/build_web.js web/index.html                               # the request page
```
