# Piece catalog

What every building piece, piece of furniture and decor item looks like, where corpus builders put it, how often they
repeat it and which side is its front. Made for the showcase review (Tyler, 2026-11-11: "You must create a database or
spreadsheet tab with the original name or id of the piece from Valheim, and then you must come up with your own naming
for them ... describe the element color, texture, material, etc."). The generator picks pieces by their id string
today; this catalog is what it should ask instead.

- Data: `tools/blueprint-lab/data/catalog/pieces.json` (1,107 records), `pairs.json` (look family co-occurrence),
  `overuse.json` (the 16 showcase designs against the corpus), `pieces.csv` (the sheet rows). Field list:
  `tools/blueprint-lab/data/catalog/README.md`.
- Code: `tools/blueprint-lab/lib/catalog.js` (read-only lookups: `name`, `family`, `look`, `material`, `belongs`,
  `indoorOk`, `reuse`, `cap`, `facing`, `yawFacing`, `pairsWith`, `familyLift`, `withTag`).
- Review sheet: tab "Pieces", one row per prefab, sorted by how many corpus builds use it.
- Contact sheets (game art, private repo): `villheim-corpus/research/2026-11-12-catalog/`.

## Method

Scope: every vanilla prefab placed in the corpus (`compact.json`, 2,128 builds, 4.27 million placements; 1,107 vanilla
prefabs, 1,881 modded names dropped) and every prefab the lab names in `lib/*.js` (394 of them; all appear in the corpus,
the other 188 names in `lib/persona.js` are stand items, covered by `data/item-models.json`).

Look, from evidence in this order:
1. **The game's own files** on Tyler's PC, read with UnityPy (`data/catalog/tools/icons.py`, 2026-11-12): the build menu
   icon of 622 pieces, the main texture of each material (568 textures), material tint, emission color and map, gloss,
   metal, light components (color and range), particle systems, the Piece fields (category, comfort) and the English
   in-game name from the localization file (901 names).
2. **The measured meshes** (`/work/models/vhmodels/work/cache`, 722 of the prefabs): triangle colors sampled from the
   game textures at the mesh UVs, weighted by surface area, clustered into up to four swatches in CIE Lab
   (`data/catalog/tools/colors.py`). For the other pieces the texture thumbnail times the material tint, or the icon.
3. **Looking**: icon and texture contact sheets grouped by texture and by family, read one by one before the families
   and the hand-written descriptions were set. Corrections that came from looking: the "darkwood chair" (`piece_chair03`)
   and the raven throne are honey to mid brown, much lighter than darkwood building pieces; the Deep North timber
   (`stave_*`) uses the darkwood texture sheet but its light boards; grausten roofs are red-brown clay tiles; the wisp
   torch gives cold blue light.

Colors are albedo (the unlit texture), so in-game lighting makes everything look lighter and warmer, as the icons show.
Compare `L` values between pieces; do not read them as what the eye sees in the game.

Placement, from the corpus (`data/catalog/tools/corpus_pass.js`), for each placement:
- *covered*: a roof or floor piece above it, within that piece's footprint, 0.4 to 14 m up;
- *on roof*: not covered, more than 2 m above the build's ground (3rd percentile height), a roof piece within 1.8 m
  and 2.6 m below to 0.6 m above;
- *by gable outside*: not covered and within 2.2 m of a gable piece;
- *yard*: not covered, not on a roof, under 1.5 m above ground and with no floor piece under it;
- *open deck*: not covered, standing on a floor piece;
- *against wall*: within 0.7 m of a wall, gable, door or window piece at its height; *wall-hung*: against a wall and
  0.8 m or more above the floor piece below; *under ceiling*: less than 1 m below a roof or floor and over 1.2 m up;
  *on furniture*: 0.3 to 1.4 m above a table, chest or station under it.
Each build's shares count once, weighted 1 + ln(1 + votes) (votes run 0 to 47, median 5; compact.json has no verdict).
Builds that spam a piece (piece_chair 1,150 times as trim in one build) therefore do not decide its placement.

Reuse: share of builds using the piece, count per build when used (median, 75th, 90th percentile, max, also vote
weighted), and count per 100 m2 of floor (floor area from the floor pieces). Tier: staple (20 % of builds or more),
common (8 %), occasional (2.5 %), rare (5 builds or more), very rare.

Front: two sources. (a) The side corpus builders put against a wall: for every placement within 0.7 m of a wall, the
direction to the wall in the piece's own frame, summed per build (each build counts once). (b) The side the mesh's tall
part sits on (vertices in the top 35 % of its height): the backrest of a chair, the headboard of a bed. Seats and beds
take (b) and are "high" when (a) agrees; other pieces take (a): high with 70 % of builds agreeing and 25 builds or more,
medium with 55 % and 10 builds, low with 40 % and 5 builds. 18 pieces are high, 29 medium, 72 low.

## Look families

45 families. Building materials: plank wood, round log, darkwood, timber (Deep North), scalewood (Deep North),
ashwood, wood and iron, Dvergr wood and copper, Fuling wood, straw thatch, turf, cut stone, grausten, grausten roof
tiles, black marble, iron, flametal, crystal glass, ice. Furniture and props: rustic furniture, fine furniture, carved
high-back wood (raven set), carved furniture (Deep North), black marble furniture, ashwood furniture, Dvergr props,
hide and fur, dyed cloth, glazed ceramic, iron props, stone props, forge set, black forge set, galdr table set, kitchen
set, workbench set, bone, gold, yule and festival, statues and heads, plants, rocks, food and drink, resource stacks,
other. The table with each family's look, material, finish, formality and biome is in `pieces.json` `families` and in
`data/catalog/tools/families.py`.

| Family | Measured look (mean albedo) | Notes from the sheets |
|---|---|---|
| Plank wood | #5a442a, L 31 | honey to mid brown planks in game light; the base of most builds |
| Round log | #765236, L 36 | lighter, warmer than plank; bark and pale cut ends |
| Darkwood | #3b2e1e to #453522, L 20 to 25 | tarred beams and shingles; the raven and wolf heads are near black (L 12) |
| Timber (Deep North) | #5b452b, L 31 | same sheet as darkwood, light boards; carved bead beams |
| Ashwood | #211f1e, L 13 | charcoal gray with dusty gray tops; the darkest wood |
| Cut stone | #6b6761, L 44 | chunky light gray |
| Grausten | #545454, L 36 | smooth, darker gray, thinner; roofs red-brown tile |
| Black marble | #323230, L 21 | near black with gray veins |
| Carved high-back wood | #72513a, L 37 | piece_chair03 and raven throne, honey brown |
| Black marble furniture | #343230, L 21 | bench with a brown cushion strip |
| Glazed ceramic | green #454d3e; cracked #663f33 with red-orange emission | the cracked pots glow |

## Tag sets

Every record carries flat tags (`tags`) and the fields they come from:

| Tag set | Values | Why |
|---|---|---|
| `kind` | seat, table, bed, storage, light, fire, rug, station, station-addon, display-stand, sign, carving, hanging-cloth, container-decor, seasonal-decor, resource-stack, decor, building parts, plant, rock, food, item, creature, effect | what the piece is for; rooms are filled by function first |
| `family` | 45 look families | pieces that read as one set |
| `material` | wood, stone, marble, grausten, iron, copper, cloth, hide, straw, ceramic, glass, bone, wood+iron, wood+copper ... | from the mesh parts' material names, or the family |
| `value` | very dark, dark, mid, light, very light (CIE L) | light and dark balance in a room |
| `hue`, `warmth`, `saturation` | brown, gray, black, red ...; warm, neutral, cool; muted, colored, vivid | color pairing; vivid pieces are accents |
| `light`, `glow` | light color, emission color | Tyler: purple rune glow, red glowing cracks |
| `zone` | indoors, outdoors, yard and grounds, roof and gable outside, indoors or outdoors | where builders put it |
| `mount` | floor-standing, wall-hung, ceiling-hung, on furniture, raised or mixed | how it attaches |
| `reuse` | staple, common, occasional, rare, very rare | how heavily a build may use it |
| `formality` | rough, plain, fine, grand | rustic to grand, by family |
| `size` | tiny, small, medium, large, huge | from mesh bounds |
| `finish` | metallic, glossy | from the game materials |
| `comfort` | the game's comfort value | |
| `not-buildable` | world props, items, creatures | for the vanilla-pieces rule |
| `generator` | named in `lib/*.js` | |

Other fields: `build_kinds` (corpus categories where it shows up 1.4 times its base rate or more), `pairs_with` and
`rarely_with` (pieces under cover within 4 m of it, from this catalog's pass), `room_pairs` (track B's room-level lifts,
`data/rooms-corpus/pairs.json`, folded in for its 143 prefabs), `facing`, `tier_biome`.

## Findings

Where pieces belong (vote-weighted per build means):
- `wood_fence` (121 builds): yard and grounds 40 %, covered 34 %, wall-hung 0. Of the covered placements (543 of
  2,082), 252 are under roof pieces only (porch roofs and eaves) and 258 are more than 2 m up (loft and balcony
  railings), 83 next to stairs. Corpus builders use it for yards and pastures first and as a railing under porch roofs
  and on lofts second; none hang it on walls. `starter-home` builds use it 3.9 times their base rate.
- `darkwood_raven` (205 builds): on roofs 43 %, by gables outside 13 %, covered 26 %, wall-hung 36 %, median height 6 m;
  median 2 per build, 90th percentile 16. `darkwood_wolf` (129 builds): roofs 35 %, median 6.95 m, 2 per build.
  `wood_dragon1` (221 builds): roofs 34 %, median 6.5 m. The covered share is mostly porch roofs and eaves over the
  gable ends (`open_deck` 31 to 36 %). Indoors at floor level they are rare.
- Wall torches (`piece_walltorch`): 81 % covered, 56 % wall-hung, median 2.64 m above the floor; front at local +x
  (86 % of 486 builds).
- Resin candles: 43 % stand on furniture, median 0.94 m up.

Repetition (16 showcase designs regenerated at main b18cf36 with the showcase seeds; reference: 909 corpus buildings
with 40 m2 or more of floor). The showcase does not exceed the corpus per build for most pieces; it repeats the same
choice in every design:

| Piece | Showcase designs using it | Corpus buildings using it | Note |
|---|---|---|---|
| `wood_ledge` | 12 of 16 (111 placed) | 3 % | 24 in the Byzantine tavern |
| `fire_pit` | 12 of 12 with a fire | 36 % of buildings with a fire; `hearth` 74 % | hearth in 1 design |
| `piece_walltorch` | 14 of 15 with a light | 57 % of buildings with a light | `piece_brazierceiling01` 45 % in the corpus, 2 designs |
| `piece_bench01` | 11 of 13 with a seat | 37 % | `piece_chair03` 57 % in the corpus |
| `piece_logbench01` | 6 of 13 with a seat (8 in the longhouse) | 11 % | corpus 90th percentile 5 per build, 1.1 per 100 m2; the longhouse has 4.3 |
| `piece_chest_barrel` | 9 of 16 | 23 % | |
| `itemstandh` | 14 of 16 | 38 % | |
| `Candle_resin` | 4 of 16 (23, 17, 7, 1) | 10 % | all in the hubs and the temple |
| `wood_fence` | 7 of 16 (183 placed) | 10 % | `stone_fence` 4 of 16 against 1 % |

Light variety per building is the same as the corpus (median 2 kinds); the choice is the same everywhere.
Stacked storage is normal in the corpus: 43 % of storage pieces sit on another (15,957 of 37,278), and 531 of 1,011
buildings with storage have a stack; the showcase stacks 13 of 106. Where the stacks stand (corners of living rooms,
by doors) is a room question for track B.

Fronts checked against the showcase (`overuse.json` `facing_showcase`): the hub #3 wardrobe has its front against the
wall and the Baltic home's dragon bed has its foot to the wall, the two Tyler saw turned wrong; 18 of 76 wall sconces
have a wall on their side; item stands (157 of 159), signs (34 of 34) and chests face out.

Pairing (`pairs.json`, `pairs_with`, track B `room_pairs`):
- Black marble table: the seats under cover within 4 m are the darkwood (raven set) chair 44 % of the builds that have
  both, the black marble throne 42 %, the black marble bench 31 %, the wood chair 21 %, the plank bench 17 %, the stool
  15 %, the sitting log 5 %. Track B, room level: the marble table goes with the bone throne (lift 21), marble throne
  (17) and marble bench (16).
- Plank table: wood chair 68 %, raven-set chair 50 %, plank bench 43 %, stool 33 %, sitting log 18 %, black marble
  bench 6 %. Round table and long heavy table: the raven-set chair 75 % and 64 %.
- Green pots stand with other green pots (80 %); the galdr set rarely shares an area with the kitchen set (9 %) or the
  raven-set furniture (15 %), against a median of 27 % for all family pairs.
- Building families in one build: ashwood with grausten lift 3.07, ashwood with darkwood 1.58, darkwood with round log
  1.39, grausten with cut stone 1.09, grausten with plank 0.89.
- Deep North: timber 19 prefabs in at most 14 builds, scalewood 15 in at most 11, carved furniture 6 in at most 14.
  The corpus has too few uses to show what they pair with; their colors (timber L 31, carved L 31) sit between plank and
  darkwood.

## How to use it

```js
const C = require('./lib/catalog.js');
C.name('piece_chair');              // 'stool'
C.family('piece_blackmarble_bench') // 'marble_furniture'
C.belongs('darkwood_raven')         // { zone: 'roof and gable outside', covered: 0.26, onRoof: 0.43, ... }
C.indoorOk('darkwood_raven')        // false (covered under 50 %)
C.cap('piece_walltorch', 150)       // count a 150 m2 build can hold within the corpus 90th percentile
C.facing('piece_chest_warderobe')   // { front: '-z', back: '+z', sure: 'medium', ... }
C.yawFacing('piece_bed02', 0, 1)    // yaw that points the bed's foot along +z
```

## Rebuild

See `tools/blueprint-lab/data/catalog/README.md`. The PC step needs the game files; the rest runs on the cloud machine
in a few minutes.
