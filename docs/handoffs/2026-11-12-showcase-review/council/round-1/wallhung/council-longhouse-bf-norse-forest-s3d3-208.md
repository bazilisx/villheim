VERDICT: PASS

Seat: wall-hung (track F). Checklist: `docs/handoffs/2026-11-12-showcase-review/criteria/wallhung.md`. Pass mark 85 of 100, no hard fail.
Score: 98 of 100. No hard fail.

## How it was measured

- `node lab/wallhung_measure.js` (main at a4282bc): 6 hung pieces. 5 are flush at -0.5 cm with cover 1: three trophy stands and the two ledges of one two-tier shelf. The sixth, the gable dragon wood_dragon1 #339 at the west gable's peak (y 7.3), measures 43 cm off a quarter wall with cover 0.33. The checklist leaves roof carvings out (notes: roof trim, track D). In the side view (close-up 1 in `/tmp/council-wall/council-longhouse-bf-norse-forest-s3d3-208-close.png`), it rests on the beam end that sticks out of the gable and points out over the door end, the way corpus gables carry them. It is attached, so no fail. The 43 cm is the measure reading a roof carving against a wall.
- `node lab/audit_pool.js` on the design alone: wallOff, wallTurn, wallHalf, wallStack, mountClip, floats and overWin are all 0.
- `node lab/attach_measure.js`: 53 standing or hanging decor pieces, all held. That includes the two standing torches (wood, pivot 0.75 m over the floor, as in the corpus).
- Renders: `lab/render_walls.js` wall views and `VH_CLOSE=6` close-ups, drawn from this blueprint through the read-only shim in `/tmp/council-wall/shimlib`. The script's front view shows walls facing east or west from behind (see the tool notes), so I also drew the design turned a quarter (`VH_ROT=90` in the shim; the measures are the same after the turn). I also looked at views.png.

| Hung piece | Where | Height | Holds | What stands under or near |
|---|---|---|---|---|
| itemstand #501 | north wall, x -4.5 | 1.35 | TrophyDraugrElite | the end of the feast table, 0.25 m along |
| itemstand #490 | north wall, x 10.7, on the plank panel between two window bays (panel center x 11) | 1.35 | TrophyBoar | nothing |
| itemstand #510 | west end wall, z 2 | 2.25 | TrophyDeer | a chair 0.35 m along |
| wood_ledge #484, #485 (KS-s-two) | east end wall, centered at z 0 | 1.25 and 1.90 | two items on each: meads, tankards, a soup | nothing |
| wood_dragon1 #339 | west gable peak, outside | roof | | roof trim |

## Hard fails

None. H1 to H6 are all clear (the gable dragon is out of scope and attached by eye, as above).

## Scores

| # | Item | Weight | Points | Why |
|---|---|---|---|---|
| 1 | Back on the wall | 8 | 8 | cover 1 for every wall piece |
| 2 | Flat | 6 | 6 | 5 of 5 within 1 cm |
| 3 | Heights | 6 | 5 | All are in range. Two of the three trophies are at 1.35 and the deer is at 2.25 (it hangs over a seat, so higher is reasonable) |
| 4 | Lights alone | 6 | 6 | No wall lights |
| 5 | Lights spaced and level | 5 | 5 | No wall lights |
| 6 | Rows | 6 | 6 | No rows. The two-tier shelf is stacked on purpose (KS-s-two; corpus shelves stack, `walls.json` shelves) |
| 7 | Intent | 12 | 11 | Every group has a reason: a trophy over the table's end, a trophy on its own panel, a trophy over a seat, and a shelf in the middle of the end wall. Two are just past the 0.25 m mark (the boar 0.3 m off its panel's center, the deer 0.35 m off the chair) |
| 8 | No even spreading | 8 | 8 | |
| 9 | Clear of openings | 4 | 4 | The boar is on the panel between window bays, not over a window |
| 10 | Ledges with a purpose | 6 | 6 | One ledge kit, holding four things |
| 11 | Signs | 6 | 6 | None |
| 12 | Banners | 4 | 4 | None (the plan names piece_banner02; none was put up) |
| 13 | Not crowded | 7 | 7 | |
| 14 | Lights by purpose | 4 | 4 | No wall lights. Of the two standing torches, one is just inside the door (good). The other is in the empty north wing, where nothing needs it |
| 15 | Seen in the renders | 12 | 12 | |
| | Total | 100 | 98 | |

## Walk-through

- The hall's long north wall carries a draugr head over the end of the feast table and, further on toward the fire, a boar head on a plank panel between two windows. Both are tight to the planks at the same height.
- At the west end, over a chair by the bed, a deer head hangs higher. At the east end, a two-tier shelf with drinks and a bowl of soup is centered on the end wall.
- Outside, a carved dragon sits on the beam end at the west gable's peak.
- For a 180 m2 hall the walls are bare. There are three trophies and one shelf, and no wall lights. The plan names a wall sconce and a hanging brazier as the lead lights, but neither was placed. The hall is lit by the fire and two standing torches. The corpus allows this (22 % of feast halls have no light, and 49 % have no item stands, `data/rooms-corpus/kinds.json`), but the intent record and the building disagree.
- The north wing (the T's stem) is empty, apart from a standing torch.
- What is on the walls is placed well. Nothing hangs off its wall, nothing is stacked, and nothing is turned.

## Rule changes (for every building)

1. **The intent record names only what was built** (for the builder; this does not change the score). Rule: `lib/rooms_intent.js` planBuilding writes the lead light into `plan.lights` and the "Suite: ... lead light" line before the light budget (`lib/decorate.js` lightBudget) and `lib/kitbash.js` trimLights decide what stays. Change: after the furnishing, note in the intent record which planned lights were put up, or "none drawn" for a room that the budget left dark. Otherwise a reviewer reads "lead light wall sconce torch" in a hall with no sconce. The same applies to `plan.banner`.
2. **Measure roof carvings against what holds them.** Rule: `lab/wallhung_measure.js` measures wood_dragon1 against walls (`lib/wallhang.js` measure with walls as backing), so a gable dragon reads 43 cm off. Change: measure carvings against beams and roof pieces (backing with roofs and beams), or list them apart, as the track F record's open problem 1 proposes with track D.
3. **Tool notes.** `lab/render_walls.js` draws the front view at az = yawN + 180. For walls whose room side faces +x or -x, that view comes from behind the wall: the ledges show as ends sticking out past a plank panel. Walls facing +z or -z come out right. Fix: work out the camera azimuth from the room side for every wall, and check it on a design turned a quarter. Also, `lab/council_candidate.js` fills the wallhung audit with hard fails only (points null, counts null in all four scorecards), so these scores come from this seat alone.
4. The two-tier shelf and the trophies came out well. The rules that made them (KS-s-two as one centered kit, single trophies on plain panels) should stay through the next round.
