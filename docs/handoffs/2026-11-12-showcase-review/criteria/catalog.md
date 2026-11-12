# Council criteria, track A (piece catalog)

> Since 2026-11-12 this file is a seat's diagnostic notes: what the track measures and how. A design's verdict comes
> from the qualities in `docs/DESIGN_QUALITIES.md` and Tyler's hard rules there; the pass marks and hard fails below
> explain shortfalls and do not decide a verdict on their own (`docs/HELPER_RULES.md`, "The design council").

How track A judges a generated s3d3 building: piece fit by look and place, repetition, material families and
orientation. Numbers come from `tools/blueprint-lab/data/catalog/` (pieces.json, pairs.json, overuse.json) and the
corpus (909 buildings in the building categories with 40 m2 or more of floor, unless a line says otherwise). Each item
names how to test it: a number measured from the blueprint with `lib/catalog.js`, or what to look for in a render view.

Scoring: each item scores 0 (fails), 0.5 (partly) or 1 (passes), times its weight. Pass mark: 80 % of the total weight
(total 100), and no hard fail.

## Hard fails (any one fails the building)

| # | Check | Test | Source |
|---|---|---|---|
| H1 | No outdoor-only piece indoors | No placement under cover at floor level (covered, under 1.5 m above the floor) of a piece whose corpus `covered` share is under 0.3 and `zone` is outdoors, yard and grounds, or roof and gable outside: `wood_fence` anywhere under cover (D-164), `darkwood_raven`, `darkwood_wolf`, `wood_dragon1`, `piece_sharpstakes`, `stake_wall`. Corpus builders use it as porch and loft railing (258 of 2,082 fence placements over 2 m up, 252 under porch roofs only); Tyler ruled it out there (D-164, 2026-11-12). | Tyler: wood_fence "never for building fences atop towers, etc. and certainly never indoors"; darkwood animals "outdoor rooftop decor"; catalog placement shares |
| H2 | Large furniture faces the room | Every wardrobe, bed and throne within 2.5 m of a wall has its catalog `back` side to that wall (`facing_check.js`). | Tyler: wardrobe "180 degrees wrong way", bed_02 "facing the wrong direction"; corpus 75 % of wardrobe builds back at +z, mesh headboards at -z |
| H3 | Wall-hung pieces hang with their back on a wall | Every `mount` wall-hung piece with `facing.sure` high or medium (sconce, item stand, tool shelf, forge tool rack, pots and pans rack) has its back side within 0.3 m of a wall. | Tyler: "signs and item stands sticking out from the wall", "torches oriented the wrong way"; sconce front +x in 86 % of 486 builds |

## Weighted checks

| # | Weight | Check | Test | Pass | Source |
|---|---|---|---|---|---|
| 1 | 10 | Seats match their table's material family | For each table, the seats within 2.5 m: share whose family is the table's family or appears in the table's `pairs_with` / `room_pairs.pairs_well_with`. | 80 % or more | Tyler on the black marble table with plank benches; corpus: marble table seats are raven-set chairs 44 %, marble throne 42 %, marble bench 31 %, stool 15 %, sitting log 5 % |
| 2 | 8 | One furniture family leads each room | In each room, the largest furniture family (seats, tables, beds, storage) holds at least 60 % of those pieces; at most two other families. | yes | Tyler: "aim to have the same wood color or material in a room ... dont treat this as law"; family lift data |
| 3 | 8 | No piece from the rarely-with list in the same room | No pair in one room where one is in the other's `rarely_with` or `room_pairs.rarely_with` (rune table with bed; galdr set with kitchen set). | none, or one with a reason | Tyler: rune table in a sleeping room; galdr set shares an area with the kitchen set 9 % against a 27 % median |
| 4 | 8 | Per-piece count within the corpus | For each non-structural piece, count per 100 m2 of floor at or below its `per_100m2_floor.p90`, and count at or below `per_build.p90` (`catalog.cap`). | every piece | Tyler: "which elements can be used heavily in a build, and which elements should be used less"; logbench 4.3 per 100 m2 in the showcase longhouse against a 1.1 corpus 90th percentile |
| 5 | 7 | Variant spread across buildings | Over the council's approved buildings so far, no light, seat, table or rug variant appears in a larger share of them than its corpus share plus 25 points (walltorch at most 82 %, plank bench at most 62 %). | yes | Tyler: "the exact same type of torches in every biuld"; overuse.json variant_choice |
| 6 | 7 | Hearth before campfire in homes, halls and taverns | The main fire of a home, longhouse, hall or tavern is a `hearth` or a built hearth; a lone `fire_pit` only in a small or camp-like building. | yes | corpus: hearth in 74 % of buildings with a fire, fire_pit 36 %; showcase fire_pit 12 of 12; Tyler on the tavern fire pit |
| 7 | 6 | Rare pieces stay rare | Pieces of tier rare or very rare (and `wood_ledge`, 3 % of buildings): at most 2 kinds of them per building, each within its corpus count. | yes | wood_ledge in 12 of 16 showcase designs |
| 8 | 6 | Roof decor on the roof | Darkwood raven, wolf and dragon heads: on a roof, gable end or eave, 4 m or more above ground; at most 2 per building unless the building is a hall or castle (corpus median 2, 90th percentile 16 mostly in large builds). | yes | Tyler: "used mostly just on gables of houses, and not too often"; raven median 6 m |
| 9 | 6 | Building materials do not clash | Building families present: no pair with `shell_families` lift under 0.9 sharing a wall run (grausten beside plank 0.89); stone and grausten not on the same wall face. | yes | Tyler: "Stone is chunky and light gray. Grausten is smooth and dark gray"; pairs.json shell lifts |
| 10 | 6 | Light and dark balance | In each room, furniture `value` spread: not every large piece very dark or very light; one or two accent pieces (vivid or glowing) per room at most. | yes | look `value`, `saturation`, glow |
| 11 | 5 | Glowing pieces fit the room | Pieces with a colored glow (purple runes, red cracks, blue wisp) only where the room's purpose fits (study, temple, smithy, storage of valuables); not in bedrooms. | yes | Tyler: rune table "funky in the wooden sleeping room"; cracked pots next to green pots |
| 12 | 5 | Containers in sets | Pots, candles and item stands in groups of one family (green pots with green pots; cracked or red pots together). | 80 % of groups | corpus: green pots stand with green pots in 80 % of builds with both |
| 13 | 5 | Wall-hung pieces at corpus heights | Sconces 1.7 to 5.6 m above the floor (p10 to p90), item stands and signs within their p10 to p90 height. | 90 % of them | catalog `placement.height_m` |
| 14 | 4 | Indoor pieces indoors | Pieces with `covered` 0.75 or more stand under a roof (beds 0.89 to 0.92, chests 0.89, wardrobe 1.0). | 95 % | catalog zone |
| 15 | 4 | Fences where builders put them | `wood_fence` on the ground around yards, pastures, gardens and village edges only; never as porch, loft, balcony or tower railing (D-164). | yes | Tyler; fence placement shares |
| 16 | 5 | Names and families in the record | The build's piece list read through `catalog.name` and `catalog.family` gives a room description that makes sense (no "stool" counted as a table, no chest used as a table). | reviewer's call on the render | Tyler: "two chests side by side next to fire also odd. Are they a table?" |

Total weight 100. Pass: 80, with no hard fail.

## Render views to look at

- Front and three-quarter exterior: roof decor placement (8), fences (15, H1), building materials (9).
- Plan cut at 1.8 m per storey: furniture families per room (1, 2, 3), fire type (6), wardrobe and bed orientation (H2).
- Interior wall elevations: sconces, stands, signs on walls and their heights (H3, 13).
