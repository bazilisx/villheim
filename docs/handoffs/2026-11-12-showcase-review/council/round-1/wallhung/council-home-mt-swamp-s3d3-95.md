VERDICT: PASS

Seat: wall-hung (track F). Checklist: `docs/handoffs/2026-11-12-showcase-review/criteria/wallhung.md`. Pass mark 85 of 100, no hard fail.
Score: 97 of 100. No hard fail.

## How it was measured

- `node lab/wallhung_measure.js` (main at a4282bc): 4 hung pieces (2 wall torches, 2 wood_ledge shelves). All are flush at -0.5 cm with cover 1, facing right, none over another.
- `node lab/audit_pool.js` on the design alone: wallOff, wallTurn, wallHalf, wallStack, mountClip, floats and overWin are all 0. (intoWallSoft 5 is furniture, which is not this seat's.)
- `node lab/attach_measure.js`: 22 standing or hanging decor pieces, all held. That includes the four small stands on the two shelves and the two on the table.
- Renders: `lab/render_walls.js` wall views, drawn from this blueprint through the read-only shim in `/tmp/council-wall/shimlib`, saved as `/tmp/council-wall/council-home-mt-swamp-s3d3-95-walls.png`. I also looked at views.png.

| Hung piece | Where | Height | Holds | What stands under or near |
|---|---|---|---|---|
| piece_walltorch #540 | wall at z -2.65, just beside the front door | 1.65 | | the door |
| piece_walltorch #539 | wall at z -6.65, kitchen end | 1.65 | | prep table 1.0 m along, 1.15 m out |
| wood_ledge #579 (KS-s-herbs) | same wall as #540, other side of the door, centered on its panel between two posts | 1.60 | two yellow mushrooms | dining table, its center 1.5 m along; the shelf is over the table's end |
| wood_ledge #582 (KS-s-curios) | wall at z 2.43, over the bed's head | 1.75 | two meads | bed centered under it; stool beside |

## Hard fails

None. H1 to H6 are all clear, by the measures above and by the side views.

## Scores

| # | Item | Weight | Points | Why |
|---|---|---|---|---|
| 1 | Back on the wall | 8 | 8 | cover 1 for all |
| 2 | Flat | 6 | 6 | 4 of 4 within 1 cm |
| 3 | Heights | 6 | 5 | All are in range; both torches are at 1.65. The two shelves are at 1.60 and 1.75 in the same room |
| 4 | Lights alone | 6 | 6 | The torches are on different walls |
| 5 | Lights spaced and level | 5 | 5 | One height |
| 6 | Rows | 6 | 6 | No rows |
| 7 | Intent | 12 | 11 | 3 of 4 groups meet the rule: the torch beside the door, the curios shelf over the bed's head, and the herbs shelf in the middle of its panel. The kitchen torch is 1 m off the prep table's center and serves it from the side |
| 8 | No even spreading | 8 | 8 | |
| 9 | Clear of openings | 4 | 4 | overWin 0. In the render, the kitchen torch is beside the window, not over it |
| 10 | Ledges with a purpose | 6 | 5 | Two ledge kits (the cap is two, D-166), both holding things. The herbs shelf hangs at the dining table, about 10 m from the kitchen |
| 11 | Signs | 6 | 6 | None |
| 12 | Banners | 4 | 4 | None (the plan names piece_banner08; none was put up) |
| 13 | Not crowded | 7 | 7 | |
| 14 | Lights by purpose | 4 | 4 | One torch by the front door, one by the work place |
| 15 | Seen in the renders | 12 | 12 | Torches and shelves sit tight to the planks in both views |
| | Total | 100 | 97 | |

## Walk-through

- Coming in by the front door, a torch hangs just beside it at about shoulder height. On the other side of the door, a short shelf with two mushrooms on it sits over the end of the dining table.
- At the kitchen end, a single torch hangs beside the window, near the prep table and the oven.
- Over the bed's head, a shelf with two meads works as a headboard shelf. This is the strongest piece of wall dressing in the house.
- Everything is tight to the planks, level, and facing the room. Nothing is stacked and nothing hangs in the air.
- The walls are sparse: four hung things in 108 m2. That is in line with the corpus: 54 % of home rooms have item stands, and the rest have none (`data/rooms-corpus/kinds.json`).
- The one thing a person might notice is the herbs. Drying herbs belong where the cooking happens, and here they are at the far end of the house by the table.

## Rule changes (for every building)

1. **A set tied to a use hangs where that use happens.** Rule: in `lib/stands.js`, the KS-s-herbs and KS-s-pantry `ctx` lists accept any table, and dressTops scores anchors by what stands under the spot (wallAtS), not by the room's zones. Change: herbs, pantry and food sets go to an anchor in the room's kitchen zone (prep table, oven, cauldron; `intent.zones`) when the room has one. Tool sets go to the work zone, and fishing sets to the door or a store zone. 'plain' stays for sets with no use. Here this is the herbs shelf. The same rule covers the tower's pickaxes and fish.
2. **The stand pass hangs at planned slots.** Rule: `lib/stands.js` dressTops takes wall anchors from `lib/kitbash.js` anchorsOf, not from `lib/wallhang.js` plan(). Change: build its anchors from `WH.plan(face)`, with the face split into panels between posts and openings. Here this placed the herbs shelf correctly by chance; the tower shows the miss.
3. Lower priority: **one height per kind in a room.** Shelves of two kits in one room hang at 1.60 and 1.75. The kits carry their own key heights (KS-s-herbs 1.5, KS-s-curios 1.65 in `lib/stands.js`). A room-level shelf line, like `lib/wallhang.js` lightY for lights, would put them level.
