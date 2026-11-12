VERDICT: PASS

Seat: catalog (track A). Checklist: `docs/handoffs/2026-11-12-showcase-review/criteria/catalog.md`.
Score: 85.5 of 93 measured weight (91.9 %), pass mark 80 %. No hard fail.
Item 5 (variant spread across approved buildings) is left out of the total: no building is approved yet. A preview over
this round's four is in the last section.

## Scores

Measured with `lab/council_checks.js` (the builder's script, re-run), `lib/catalog.js` (`cap`, `family`, `pairsWith`,
`belongs`), my own piece list with positions, and renders from the blueprint (plan cut at 4.0 m, interior view cut at
4.3 m, four exterior views; files in `/tmp/council-catalog/`).

| # | Weight | Score | Measured | Note |
|---|---|---|---|---|
| H1 | hard | pass | no wood_fence, carving or stake in the building | |
| H2 | hard | pass | the one bed has its headboard (-z) on the north wall | checked by hand from yaw 180 |
| H3 | hard | pass | 2 wall sconces, back to the wall | |
| 1 | 10 | 10 | 2 of 2 seats at the table pair with it | plain plank table (rustic) with wood chairs with backs (fine); the pair is in the table's corpus pairs |
| 2 | 8 | 8 | rustic family 7 of 10 large pieces (70 %), one other family | |
| 3 | 8 | 8 | no rarely-with pair in one area (4 m) or room | the armor stand stands 2.3 m from the butcher table; armor stand with cauldron or oven shares an area in 4 % of builds with both, but the pieces here are 4.5 and 6.3 m apart |
| 4 | 8 | 4 | 1 piece over `catalog.cap`: wood chair with back 3, cap 2 (per 100 m2 p90 1.39 at 78 m2) | the generator's cap is 3 (`rooms_intent.js capOf`) |
| 5 | 7 | not scored | see the last section | |
| 6 | 7 | 3.5 | main fire is a fire pit with a kerb of beams, a wooden hood and a chimney, a cauldron on it | a cooking fire with some build-up; the stone hearth the corpus uses is not there. Homes in the corpus: hearth is the focal of 21 % of home rooms, fire pit 9 % (track B kinds.json). The builder's script skipped this item because the room is 77.75 m2, under its 80 m2 line |
| 7 | 6 | 6 | 0 rare kinds; 2 wood ledges | D-166: ledges need a use. Here: a shelf over the table (mushrooms) and one over the bed (meads). Both hold things |
| 8 | 6 | 6 | no roof carvings | |
| 9 | 6 | 6 | plank, log poles, thatch | shell lifts log/plank 1.27, log/thatch 1.63 (pairs.json) |
| 10 | 6 | 6 | large pieces mid and dark, none all very dark | |
| 11 | 5 | 5 | no glowing piece | |
| 12 | 5 | 5 | no pots; stand items are mushrooms and meads in pairs | two yellow mushrooms side by side on one ledge |
| 13 | 5 | 5 | sconces 1.55 m above the floor | corpus p10 1.74 m; inside the 0.2 m margin, at its low edge |
| 14 | 4 | 4 | every indoor piece under the roof | |
| 15 | 4 | 4 | no wood_fence | |
| 16 | 5 | 5 | the record (home, focal fire, zones fire, sleeping, eating, gear) matches the plan view | |

## What a person walking through would notice

- A plank house on stilts on a wide open deck. Inside, one L-shaped room of about 78 m2 in one wood color with a thatch
  roof. Nothing clashes in color or material.
- The kitchen is spread over the whole room: the cauldron on the fire at the north wall, the butcher table by the
  north-west corner, the stone oven on the west wall, the prep table in the far corner of the south wing. Cooking means
  walking 7 m between stations.
- An armor stand in Fenris armor stands in the kitchen corner, 2.3 m from the butcher table.
- The dining table stands against the inner wall with two chairs on one side, two flat stands on it with a mushroom
  and a mead. A shelf above holds two yellow mushrooms. It reads as a meal set out.
- One straw bed, by the dining table, with a stool beside it as a night table and a shelf of meads above it. For a
  stage 3 home it is the only bed.
- Light: two wall sconces (one by the door, one in the south wing). The fire end of the room has only the fire. The
  plan's notes say one light was left out over the room's budget.

## Misses: principle, rule, change

1. **Piece counts follow two different caps.** The wood chair with back is 3 against the catalog cap of 2. The cause:
   `lib/rooms_intent.js capOf` takes the larger of the area bound and the per-build p90 and allows up to twice the
   p90; `lib/catalog.js cap` takes the smaller. In this house capOf allows 38.8 small chests (catalog: 7), 54.9 flat
   stands (catalog: 18), 14 barrels (catalog: 7). This house stays low only because it is sparse. Change: capOf uses
   the catalog's rule (the smaller of the per-100 m2 p90 bound and the per-build p90, never under the p50), and takes a
   room kind's own count from track B `kinds.json` (`p90_when`) where one exists (beds in a dormitory, tables in a
   feast hall). One cap for the generator and the audit.
2. **The vent decides the fire.** `lib/generate.js settle` turns a hearth into a fire pit whenever the vent is a hood
   or a stone stack, or the main room is under 40 m2 ("a hearth is 3 m across ... a fire pit takes its place"). Every
   fire against a wall under a hood becomes a fire pit, whatever `rooms_intent.js furnishRoom fireKind` chose (hearth
   in 74 % of homes of 60 m2 or more). Change: pick the fire first, from the corpus for the room kind, then pick or
   size the vent to the fire: a hearth gets a ridge or crown vent or a stack wide enough for it. Only when no vent
   fits does the fire change, and then the note and the room record say so.
3. **Gear placed among the cooking.** The gear set (armor stand, chest) was put in the corner next to the butcher
   table. `rooms_intent.js supportZones` places each zone "at a wall, away from the other zones", but the kitchen
   pieces are spread out, so no wall is away from them. Change: the home's kitchen pieces form one zone with one
   anchor (the fire or the oven), placed as a set within about 3 m, before the support zones; the support zones then
   test distance to that zone and use the catalog's area-level `rarely_with` (armor stand with cauldron or oven 4 %)
   as a penalty.

## Checks run

- `node lab/council_checks.js <bp> --intent intent.json --json ...`: catalog 82 of 82, no hard fail (my score differs
  on items 4 and 6, for the reasons above).
- `catalog.cap` and `rooms_intent.capOf` per piece at 77.75 m2 (the room area from `decorate.readLevel`).
- Area and room `rarely_with` pairs within 8 m: the four listed under item 3, all at more than 4 m.
- Renders: plan, interior three-quarter view, four exterior views, all read.

## Preview of item 5 over this round (not scored)

Over the four candidates: the fire pit is the fire in 2 of 2 buildings with a fire (corpus 36 % of builds with a
fire, limit 61 %); the stool is in 3 of 3 with seats (corpus 50 %, limit 75 %); the plain plank table in 2 of 2 with
tables (corpus 64 %, limit 89 %); the wall sconce in 2 of 3 with lights (corpus 57 %, limit 82 %, passes). The fire pit
result is the showcase's (12 of 12) again, for the cause in miss 2.
