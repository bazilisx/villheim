VERDICT: PASS

Seat: wall-hung (track F). Checklist: `docs/handoffs/2026-11-12-showcase-review/criteria/wallhung.md`. Pass mark 85 of 100, no hard fail.
Score: 89 of 100. No hard fail. The weak points are where things hang (item 7) and their heights (item 3). How they sit on the walls is clean.

## How it was measured

- `node lab/wallhung_measure.js <blueprint> --list` and `--json` (main at a4282bc): 8 hung pieces, 8 flush, 0 off, 0 in the air, 0 too deep, 0 half off, 0 turned, 0 over one another. Every gap is -0.4 to -0.5 cm. Two stands have less than all of their back on the wall: #559 (shield) cover 0.78 and #564 (hammer) cover 0.89. Both are at or above the 7 of 9 mark.
- `node lab/audit_pool.js` on the design alone: wallOff 0, wallTurn 0, wallHalf 0, wallStack 0, mountClip 0, floats 0, overWin 0.
- `node lab/attach_measure.js`: 8 standing or hanging decor pieces, all held within 3 cm.
- Renders: `lab/render_walls.js`, wall views and `VH_CLOSE=8` close-ups. They were drawn from this blueprint through a read-only shim in `/tmp/council-wall/shimlib` that hands the file to the script in place of a fresh generation. Output is in `/tmp/council-wall/`. I also looked at views.png, floor-1.png and floor-2.png.
- Each piece's neighbors: `/tmp/council-wall/scripts/under.js`. It lists what stands within 1.6 m in front of each hung piece and how far along the wall.

| Hung piece | Where | Height over floor | On it | What stands under or near |
|---|---|---|---|---|
| itemstand #559 | ground floor, east wall, z 3.5 | 1.45 | ShieldSilver | chair 1.4 m along; nothing under |
| itemstand #560, #561 | ground floor, back wall, x 0.95 and 1.5 | 1.25, 1.32 | PickaxeBronze, PickaxeIron | nothing |
| itemstand #562, #563 | floor 1, west wall, z -1.3 and -0.65 | 1.85, 1.70 | Fish11, Fish3 | nothing (the room has only an armor stand) |
| itemstand #564 | floor 1, east wall, z 0 | 1.45 | Hammer | armor stand 1.5 m along |
| piece_walltorch #565, #566 | outside, either side of the door, x -1.15 and 1.15 | 1.55 over the door's floor | | the door between them |

## Hard fails

| # | Result |
|---|---|
| H1 off its wall | none (all gaps -0.5 to -0.4 cm) |
| H2 in the air | none |
| H3 turned wrong | none (measure facing true for all 8; the close-ups show every board against its stone) |
| H4 over one another | none (no overlapping outlines) |
| H5 sunk too deep | none (mountClip 0) |
| H6 floating lights | none (the tower has no standing torches or braziers) |

## Scores

| # | Item | Weight | Points | Why |
|---|---|---|---|---|
| 1 | Back on the wall | 8 | 8 | wallHalf 0; lowest cover 0.78 |
| 2 | Flat on the wall | 6 | 6 | 8 of 8 within -1 to +1 cm |
| 3 | Heights | 6 | 3 | All are in the corpus p10 to p90 range. The pieces in a room are not at one height: the ground floor's three stands are at 1.25, 1.32 and 1.45 m, and floor 1's at 1.45, 1.70 and 1.85 m |
| 4 | Lights alone on their stretch | 6 | 6 | The door pair is 2.3 m apart |
| 5 | Lights spaced and level | 5 | 5 | 2.3 m apart, one height |
| 6 | Rows level and even | 6 | 4 | The fish pair steps 15 cm. That is the set's own layout (KS-w-fish) and normal for the corpus: item stand neighbors differ by 0.11 m at the p50, and 49 % share one height (`data/rooms-corpus/walls.json` spacing). The pickaxe pair steps 7 cm because it is two of three pieces of an arched set (below) |
| 7 | Placed with intent | 12 | 6 | 2 of 5 groups meet the rule: the hammer is in the middle of its wall, and the torches are a mirrored pair about the door. The shield is 0.55 m off the middle of its stretch, between the bed's head and the corner. The pickaxes are 1.5 m off center over nothing. The fish are 1 m off center over nothing |
| 8 | No even spreading | 8 | 8 | No repeated kit at a fixed step |
| 9 | Clear of openings | 4 | 4 | overWin 0 |
| 10 | Ledges with a purpose | 6 | 6 | No ledges |
| 11 | Signs | 6 | 6 | No signs |
| 12 | Banners | 4 | 4 | No banners (the plan names piece_banner05; none was put up) |
| 13 | Not crowded | 7 | 7 | One group per stretch; nothing behind a tall piece |
| 14 | Lights by purpose | 4 | 4 | Both wall lights are beside the door. There are no lights inside; see the walk-through |
| 15 | Seen in the renders | 12 | 12 | Every piece reads as fixed to its wall in the side views |
| | Total | 100 | 89 | |

## Walk-through

- Outside, the two torches either side of the door look right: same height, mirrored, tight to the stone.
- Ground floor (four beds, a chest, two chairs). A silver shield hangs on the east wall a little way from the corner and lines up with nothing. On the back wall, by the ladder, two pickaxes hang side by side with the right one a hand higher. It reads like a row with a piece missing, and that is what it is: KS-w-tools is three stands in a low arch (1.55, 1.62, 1.55), and the third was dropped where it did not fit. Mining tools over a bunk room have no use there.
- Floor 1 ("watch room, focal table"): a bare 75 m2 room with no table. Two fish hang on the west wall about 1 m off center, a hammer hangs in the middle of the east wall, and an armor stand stands near it. Things on bare walls with nothing to relate to read as scattered. The missing table is the corpus-rooms seat's point. For this seat, it means nothing on these walls had an anchor.
- Floor 2 (lookout) is bare. That is fine for this seat.
- No room inside has a light. The plan names a hanging brazier as the lead light, but the light budget (`lib/decorate.js` lightBudget) drew none. That follows the corpus: 29 % of bedrooms and 72 % of "other" rooms have no light (`data/rooms-corpus/kinds.json`). Still, the intent record names a light that is not in the building.
- Fit is clean everywhere. Nothing stands off, sinks or turns.

## Rule changes (for every building)

1. **A set that is a shape keeps its shape.** Principle: a row, arch or mirrored set reads as one thing, and a fragment reads as a mistake. Rule: `lib/kitbash.js` fit (the keep test at lines 695 and 828: a set is kept when 60 % of its pieces and `min` fit). Change: mark sets whose pieces form a row or arch of one prefab (KS-w-tools, KS-w-shields, KS-w-trophy3, KS-t-row, the KC-138 sign row, and the like). For those, keep every piece, or a symmetric subset re-centered on the anchor (the outer pair, or the middle one alone). Otherwise drop the set. Here this is the pickaxe pair. It is also the track F record's open problem 3.
2. **The stand pass hangs at planned slots.** Principle: a hung group sits over what stands under it, in the middle of a plain stretch, or as a mirrored pair about an opening. Rule: `lib/stands.js` dressTops takes its wall spots from `KB.anchorsOf` (`lib/kitbash.js` anchorsOf), which walks the face. Only the library's wall pass (`lib/kitbash.js` dressWallsPlanned) uses `lib/wallhang.js` plan(). Change: dressTops builds its wall anchors from `WH.plan(face)`, with the face split into panels between posts, windows and doors, and tries the slots in plan order. Here this covers the shield, the fish and the pickaxes.
3. **A set tied to a use hangs where that use happens.** Principle: tools hang by the work place, food and fish by the kitchen or the door, and trophies and shields wherever there is a plain wall. Rule: the `ctx` lists of the wall sets in `lib/stands.js` (lines 98 to 138) let tool, fishing and herb sets take a 'plain' wall in any room. Change: a set with a `want` tied to a use (tool, fishing, fish, herbs, food) needs the room's zone for that use in `intent.zones`, and goes to an anchor in that zone. 'plain' stays for trophies, shields and curios. With no such zone, the set is not placed in that room. Here this covers the pickaxes in the bunk room and the fish in the watch room. Which items go on the stands is track G's. This rule only decides which wall.
4. Lower priority: **one hanging height per room for single stands.** `lib/wallhang.js` lightY gives one light height per house. Single stands (KS-w-one) in a room could share one height in the same way, while a set keeps its own inner steps. The corpus support is weaker for stands than for lights (49 % of stand neighbors at one height, 71 % of lights).
