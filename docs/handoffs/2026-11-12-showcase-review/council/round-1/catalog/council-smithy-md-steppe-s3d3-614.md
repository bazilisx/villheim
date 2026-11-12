VERDICT: PASS

Seat: catalog (track A). Checklist: `docs/handoffs/2026-11-12-showcase-review/criteria/catalog.md`.
Score: 93 of 93 measured weight (100 %), pass mark 80 %. No hard fail.
Item 5 is left out of the total (no approved buildings yet). The full score says more about what my checklist tests
than about the building: a room with few pieces gives few chances to mismatch. See "Gap in my checklist" below.

## Scores

Measured with `lab/council_checks.js` (re-run), `lib/catalog.js`, my piece list with positions, track B
`kinds.json` (smithy rooms), and renders (views.png and four exterior views from the blueprint).

| # | Weight | Score | Measured | Note |
|---|---|---|---|---|
| H1 | hard | pass | no outdoor-only piece | |
| H2 | hard | pass | no wardrobe, bed or throne | |
| H3 | hard | pass | no wall-hung piece | |
| 1 | 10 | 10 | no table, no seat | corpus smithy rooms: seats in 23 %, tables in 17 % |
| 2 | 8 | 8 | 2 iron-banded chests only | |
| 3 | 8 | 8 | | |
| 4 | 8 | 8 | every forge piece once, workbench and chopping block once, 2 chests (cap 6), 1 woodpile (cap 3) | |
| 5 | 7 | not scored | | |
| 6 | 7 | 7 | not a home, hall or tavern; no fire beyond the forge | |
| 7 | 6 | 6 | no rare piece | |
| 8 | 6 | 6 | | |
| 9 | 6 | 6 | plank posts and beams, thatch | |
| 10 | 6 | 6 | | |
| 11 | 5 | 5 | the forge's glow in a smithy | |
| 12 | 5 | 5 | | |
| 13 | 5 | 5 | | |
| 14 | 4 | 4 | chests under the roof | |
| 15 | 4 | 4 | | |
| 16 | 5 | 5 | "smithy, focal forge, zones forge, bench" matches the plan view | |

## What a person walking through would notice

- An open forge shed: posts, beams and a hipped thatch roof, no walls. The design name says half-timber; the piece
  list has no wall piece at all (track D's call). A lean-to at the back holds the firewood stack.
- The forge line runs along the back: grinding wheel, the big anvil on its stump, bellows, the forge, the cooling
  trough. Each piece once, in a row, at the forge's side. Workbench and chopping block on the west end. Two
  iron-banded chests side by side on the open east side.
- The middle of the floor, about 6 by 4 m, is empty. Track B's smithy rooms hold 1.11 pieces per 10 m2 at the median;
  this one holds 9 pieces in 72 m2, near that median, so the open floor is a fair working space.
- No light anywhere. The plan names a wall sconce as the lead light and candles; with no walls the sconces had nowhere
  to hang, and nothing took their place. In the corpus the hanging iron brazier stands in blacksmith builds at lift
  2.2, a light that needs no wall.
- The plan also names two rugs (fur and hare) and a banner; none was built. In a forge shed that is right, but the
  record still lists them.

## Misses: principle, rule, change

No item on my list is missed. Two rules still show here:

1. **The plan's lights are tied to walls.** `lib/rooms_intent.js planBuilding` chooses the lead light before it knows
   the building has no walls. Here its only light is the wall sconce, `kitFor` passes it on as the wall light with no
   floor or hanging light, and with no wall to hang it on the room goes dark.
   Change: the lead light is chosen from lights that fit the shell (`catalog.belongs(id).mount`: an open shed takes a
   hanging or standing light), and a room left without any light by a later pass gets the plan's next light that fits.
2. **The plan is not checked against the building** (as in the longhouse file): the record lists rugs, a banner and
   candles that are not there. The rebuild of the record from the finished blueprint covers this.

## Gap in my checklist

My list tests pieces that are there against each other and the corpus. It has no item for what a room of a kind
should hold (a light, a focal piece) or for the plan's pieces going missing, so a sparse building scores full. I
propose two items for round 2 (needs the lead's agreement): "every room has its kind's focal and at least one light
the plan names, or a reason in the notes" and "the record matches the blueprint".

## Checks run

- `lab/council_checks.js`: catalog 82 of 82, no hard fail; my score agrees.
- Piece counts against `catalog.cap` at 85.5 m2 of floor: none over.
- Renders read: views.png (four cut views and the plan) and four full exterior views.
