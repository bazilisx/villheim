# Shell criteria (track D): how a generated s3d3 building is judged

Source: Tyler's showcase notes (TYLER_NOTES.md, quoted below), the game's code (WearNTear, StaticPhysics, decompiled
from assembly_valheim 2026-11-12), the prefabs read on Tyler's PC, and corpus counts from `lab/shell_mine.js` and
`data/measures-storeys.json`. Measured items name the `lib/checks.js` result that tests them (`node lab/test_structure.js`
runs them; `Ck.check(design, biome)` returns them). Views are the four `lab/render_views.js` views plus the plan.

Score: each item passes (full weight) or fails (0). Pass mark: 80 of 100 with no hard fail.

## Hard fails (any one fails the building)

| # | Item | Test | Evidence |
|---|---|---|---|
| H1 | Every piece holds by the game's support rule | `game support`: no structural piece under its material's min | Meadows s5 hub lost its upper parts in the game (README Next work 0); the rule is WearNTear.UpdateSupport |
| H2 | No walk under two floor pieces wide | `passages`: no piece of floor narrower than 4 m (in floor pieces) over 6 m2 running 3 m, inside or raised | Tyler: "Anything small passageway must be at minimum two wood_floor pieces wide"; D-164 note: "anything" covers galleries, lofts, balconies |
| H3 | Every doorway clear and stepped | `doorways`: lane 0.9 m wide, 1 m each side, clear to the door's height; no step over 0.4 m to the ground the game sets the design on | Showcase 11: "wood-beam blocking the door and prevents me from entering"; D-096 |
| H4 | No pasture fence on a raised floor or indoors | `railings` | Tyler (showcase 14), D-164 |
| H5 | One masonry family in the walls | `masonry` | Showcases 15, 16: "Stone is chunky and light gray. Grausten is smooth and dark gray and half the width." |

## Weighted items

| # | Item | Weight | Test | Evidence |
|---|---|---|---|---|
| 1 | Outside walls meet the roof | 10 | `wall tops`: no gap over 0.25 m from an outside wall's top to the roof piece over it (smoke louvers, shafts, arches aside) | Showcases 03, 15: "gaps up top on the wall that dont complete the wall-to-roof connection" |
| 2 | No hole in the roof over a room | 8 | `roof holes`; view 3 and 4 from below the eaves | Showcase 09: "gaps and holes in the ceiling" |
| 3 | Wings across the main wing line up or stand a bay apart | 8 | plan view: two cross wings share a middle line or leave 2 m of roof between them | Showcase 09: "one side of the roof is shifted left 5 feet compared to the other side" |
| 4 | Crossed boards on the bargeboards' line | 4 | `crossed boards` | Showcase 13; corpus: 1,881 of 5,042 in-plane 45 degree beams on the boards' line, nearly all the rest 2 m off |
| 5 | Plants on raised surfaces are ones the game holds | 6 | `plants held` | Showcase 05: onion and dandelion fell; StaticPhysics drops them to the terrain (prefabs read 2026-11-12) |
| 6 | Planters as the mockup, on a whole run or none | 6 | view: box under the light, 1 m beams on its front and sides, sill beam, posts by the light; `Program.check` | Showcase 05 mockup; D-165 (at most about 10 % of windows), D-167 |
| 7 | Wings and rooms wide enough | 8 | plan view: no wing under three cells (6 m) | Showcases 05, 10, 16 |
| 8 | Balconies, decks, loggias, boardwalks two pieces deep | 6 | plan view, `passages` raised | Showcase 12: "far too narrow at only 1 wood_floor piece wide" |
| 9 | Stairs and ladders leave the walk | 5 | `passages` (stairs count as they stand), `ladders` | Showcase 16: "stairs are also blocking it so I cant even look in" |
| 10 | Walls tall enough for the kind | 6 | one-storey s3 walls 4 m or more; eave against the corpus quartile for the kind and storeys | Showcases 07, 08; corpus one-storey home eaves 5 m at the quartile (78 builds) |
| 11 | Plan size for the kind | 6 | roof footprint against the corpus quartile (home one storey 11.5 m wide, two storeys 15 m) | Showcase 08: "needs to be wider in all areas" |
| 12 | Pieces placed by their real geometry | 6 | view: beams on what they rest on (dark beams, dark 26 degree beams, ash beams by their snap points) | Showcase 06: "darkwood beams are hovering above the woodwall_half" |
| 13 | Rails of posts and beams where people stand high | 5 | view: a rail on every open edge of a raised floor over 1.2 m | Corpus rail pieces by builds: wood_beam 747, wood_pole 593, wood_pole2 547 |
| 14 | Gable apexes closed into the ridge cap | 4 | `wall tops` at the gable; view 3 and 4 | Showcases 03, 15 |
| 15 | Posts under wide roofs stand in rows, clear of the fire, stairs, doors and the high seat | 6 | plan view at the hall's floor | Hub collapse; corpus halls carry ridges on posts |
| 16 | Timber partitions inside | 3 | no masonry on a timber floor | Ashlands tavern grausten partition fell (support rule) |

Total weight 100.
