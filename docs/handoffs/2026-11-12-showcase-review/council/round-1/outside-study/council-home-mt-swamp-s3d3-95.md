VERDICT: FAIL

# Outside study: council-home-mt-swamp-s3d3-95 (round 1)

Score 72.5 of 100 (pass mark 75). No hard fail. Groups: Intent 26 of 37, Palette and light 17 of 20, Clutter 17 of 23,
Story 12.5 of 20 (all at half or more). Fails on points: items 3, 7, 11, 16, 19, 20 and 22.

Checklist: `docs/handoffs/2026-11-12-showcase-review/criteria/outside-study.md`. Measured from the blueprint with
`lib/blueprint.js` and `lib/pieces.js` sizes; renders made with `lib/render.js` under `/tmp/council-outside/`
(`home-plan.png` labeled plan, `home-v1.png` view from the south, `home-v2.png` table and bed corner). The builder's
scorecard gives this seat 32 of 32: it measures only 8 of the 23 items and leaves the other 68 points by eye.

One room, 108 m2, L-shaped, on stilts. Door at (4, -3) in the inner wall of the L, opening north.

## Hard fails

| # | Result | Measure |
|---|---|---|
| H1 passages | pass | one room; the kitchen wing is a dead end 3.4 m clear |
| H2 door box | pass | nothing but a wall torch beside the door (x 2.5, outside the 2 m door box) |
| H3 reach | pass | fire, bed sides, chests, oven and prep table all reached over open floor |
| H4 black marble | pass | none |
| H5 outdoor pieces | pass | none |

## Scores

| # | Item | Wt | Score | Measure |
|---|---|---|---|---|
| 1 | Core set | 7 | 7 | fire pit with cauldron, table with chairs |
| 2 | Focal from the door | 6 | 3 | the fire is 2 m left of the door's line and the bed 2 m right; both in the far half; the fire carries nothing over it and the bed competes with it |
| 3 | Command position | 4 | 0 | bed head 0.35 m from the north wall, 25 degrees off the door: pass. Head chair at (-0.2, 2.0) faces east with 4.6 m of open floor behind it to the west wall: fail. 1 of 2 |
| 4 | Zones | 6 | 3 | seven zones in one room (fire, cooking wall, table, bed, head chair, gear, store); the table set touches the bed |
| 5 | One seat kind per table | 6 | 6 | two `piece_chair02` |
| 6 | Walking lines | 6 | 6 | door to fire, bed, kitchen and gear corner over open floor over 2 m wide |
| 7 | Pull-back and bed sides | 2 | 1 | the chairs' backs stop 0.2 m short of the bed's foot (chair at z -0.85, bed foot at z -0.15); bed sides open |
| 8 | Woods | 5 | 5 | one base wood family (table, chairs, stool, straw bed, chests, prep table) |
| 9 | Stone, metal, glow | 4 | 4 | the stone oven only; no cold glow |
| 10 | Fabric colors | 2 | 2 | none at all (plan `rugs: []`, `piece_banner08` planned and not placed); the cap is met, the room has no textiles |
| 11 | Light layers | 6 | 3 | lights: the fire and two wall torches (0.28 per 10 m2). Table 5.0 m from the nearest light, gear corner 6.3 m, store chests 4.0 m, bed 4.1 m from the fire; no task light at the table, no accent at the focal |
| 12 | Light variety | 3 | 3 | two lights of one kind; under the 5 lights the corpus band is drawn from |
| 13 | Near its use | 6 | 3 | mushrooms and a mead on the table and on the ledge over it (by use); three buff meads on a ledge over the bed; nothing at the cooking, oven, prep table or butcher table |
| 14 | On a parent | 3 | 3 | every stand on a table or a ledge |
| 15 | Hot spots | 5 | 5 | two dressed spots: table with its ledge, bed head with stool and ledge |
| 16 | Layers | 3 | 0 | wall (ledges, torches) and medium (chests, barrel, armor stand); no floor layer (no rug, no loose thing at a wall) and no ceiling layer |
| 17 | Density | 2 | 2 | 16 floor pieces, 1.48 per 10 m2 (corpus home p25 to p75: 0.75 to 1.49) |
| 18 | Repeats | 4 | 4 | no kind repeated outside a set |
| 19 | Mid-task scene | 6 | 3 | "supper left mid-meal": a raw mushroom and a Hasty mead on the table, one chair turned 20 degrees; the cauldron 6.8 m away holds nothing, so the scene has no cause in reach |
| 20 | Who lives here | 6 | 3 | the bed has a stool and two meads over it; the head chair's side barrel is bare (the drink stand `headChair` puts on it is not in the blueprint); the Fenring armor stands 10 m from the bed |
| 21 | One story | 4 | 4 | a cooking household with a hunter's armor; nothing off-story |
| 22 | Clue at the focal, one unique piece | 3 | 1.5 | the Fenring armor is the unique piece; nothing marks the fire |
| 23 | Imperfect placement | 1 | 1 | 1 of 4 seats turned over 10 degrees (0.25) |

## What a person walking through would notice

- You come in at the inner corner of the L and face a wide, empty floor. The middle of the room (about 5 by 6 m) holds
  nothing. Everything stands against the walls.
- The fire pit with its cauldron is the first thing ahead and a little left. It sits in a kerb of beams, but the wall
  behind it is bare, and the pot is empty. Nothing says a meal is cooking.
- To the right, the dining table stands against the door wall. The two chairs face the wall with their backs almost
  touching the foot of the bed. You could not pull a chair out to sit.
- The bed sits in the open room beside the table and 4 m from the fire. A stool by its head serves as a nightstand,
  and a ledge over it holds frost and healing meads. It reads as a sickbed shelf more than a bedside.
- The kitchen runs down the west wing: a stone oven, a prep table, and a butcher table 4 m from the cauldron. None of
  it has food, tools or pots. It looks unused.
- In the far west corner a full Fenring armor set stands on its stand by a chest. It is the one personal piece in
  the house, and it is as far from the bed as the room allows.
- The room is dim away from the fire. The table and the armor corner have no light within 5 m.
- Good: one wood family throughout, one chair kind at the table, no stacked chests, no log benches, no candles
  everywhere. The repetition Tyler named is gone. What is left is sparse: a showroom of pieces along the walls.

## Rule changes (by principle, for every building)

1. **A set keeps its use space.** Seats need about 1 m behind them at a table, a bed one open side, a chest its front,
   a station its work place (Houzz clearances; corpus bench gap 1.0 m). Here the table set and the bed were placed
   independently and the chairs back into the bed. Rule: `lib/decorate.js` `room.fits` / `room.put` reserve each
   placed set's use envelope (pull-back strip behind seats, bed side strip, chest front, station front) as a keep-out
   for later pieces, and `placeTable` scores candidate spots by the free space behind the seats. Same fault in the
   longhouse (a bench 0.06 m behind a bench) and the tower (a chest pinching the aisle between beds).
2. **Light by zone, then by count.** `lib/rooms_intent.js` `lightN` asks for a count from the corpus and
   `lib/decorate.js` `lightsIn` spends it by darkness and a random "purpose" weight. Rule: before the count, each used
   zone (table, bed head, station, gear corner, seat group) gets a light within about 2.5 m, and the focal gets its
   accent; then fill to the corpus lights per 10 m2 (home rooms p50 5 lights where lit). `capBuilding` may not take a
   zone's only light.
3. **The focal carries the clue.** `wallBay` dresses the focal wall only with banners when the ceiling is 3.4 m or
   more, and item stands only over a chest or bed. Rule: `wallBay` dresses the focal first (over the hearth or fire:
   a trophy, the household's banner, a shield, cooking tools over a cooking fire), at any ceiling height, using an
   item stand or a single banner where the room is low; then one supporting bay.
4. **A mid-task scene is placed whole with its cause.** `vignettes` dresses the table for "supper" without looking
   at the cooking. Rule: vignette 1 places food on the cooking (cauldron or spit stand items), plates and a drink at
   the table, and one seat pushed back, or it is not placed; it needs the cooking within about 4 m of the table, else
   the vignette is "drink by the fire" or "work laid out" instead.
5. **Every living room gets a floor layer.** The home's plan has no rug kinds, so `rugAt` returns at once. Rule:
   `planBuilding` gives every household with d2 or more at least one rug kind (corpus: a rug at the foot or side of
   25 to 49 % of beds, under 22 % of tables, `data/intent.json` beds and tables), and a room that ends with no rug
   gets a loose floor group at a wall by its store or kitchen (a sack, a basket, a pot on a floor stand).
6. **The head chair faces the room with a wall behind it.** `headChair` tries spots 1.6 to 2.1 m from the fire in
   three directions and takes the first that fits. Rule: score the spots by a wall within 2 m behind the chair and a
   view of the door (command position), and keep the side barrel's drink (dropped later, likely by `capBuilding` or
   the stand pass; check which).
7. **Kitchen pieces carry their food.** Prep table, oven and butcher table are placed bare. Rule: `cookCorner`
   places each with its stand items (raw food on the prep surface, a tool over it) as one set, and the butcher table
   (a cauldron extension) within the corpus distance of the cauldron.
