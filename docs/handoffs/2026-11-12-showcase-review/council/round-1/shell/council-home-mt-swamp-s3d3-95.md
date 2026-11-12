VERDICT: PASS

# Shell seat (track D), round 1: council-home-mt-swamp-s3d3-95

Score 95 of 100 (pass mark 80), no hard fail. Criteria: `docs/handoffs/2026-11-12-showcase-review/criteria/shell.md`.

How it was measured: `lib/checks.js` `check()` run on the blueprint itself (pieces parsed with `lib/blueprint.js`,
decor marked as `lab/council_candidate.js` does), a piece dump, the corpus measures of `data/measures-storeys.json`
taken the way `lab/measure_corpus.js` takes them, `G.generate` with the same request (567-piece tower and this
585-piece house come out the same as the blueprints) to read each piece's source tag, and renders with the roof on.
Scripts and renders: `/tmp/council-shell/` (chk.js, meas.js, dump.js, gen.js, rv.js; home_roof.png, home_r125.png,
home_r305.png). The builder's shell column (28 of 28) scores only items 1, 2, 4 and 5; items 3 and 6 to 16 were not
scored there.

## Hard fails (all pass, checked on the blueprint)

| # | Item | Result | Measure |
|---|---|---|---|
| H1 | Game support | pass | `game support`: every piece holds. The lab's older `stability` names one wood_stair; the game rule is the one that counts. |
| H2 | Walks two pieces wide | pass | `passages`: every walk at least 4 m. Both wings 6 m wide; deck 4 m. |
| H3 | Doorways clear and stepped | pass | `doorways`: 1 door, clear. The stair from the ground to the deck is in place. (`ladders` says "no room at the foot": the stilts are sunk 1 m, so the lab's ground guess is y -1. In the game the foot is on the terrain.) |
| H4 | No pasture fence raised or indoors | pass | no wood_fence |
| H5 | One masonry family | pass | no masonry walls (the oven is furniture) |

## Weighted items

| # | Item | Wt | Score | Measure |
|---|---|---|---|---|
| 1 | Walls meet the roof | 10 | 10 | `wall tops` clean; gable apexes filled with a quarter wall at 6.7 m |
| 2 | No roof holes | 8 | 8 | `roof holes` clean; the shaft over the fire is meant |
| 3 | Cross wings line up | 8 | 8 | main ridge on z 0 (wing z -3 to 3), cross ridge on x -2 (wing x -5 to 1): both on their wing's middle line |
| 4 | Crossed boards in line | 4 | 4 | `crossed boards` clean |
| 5 | Plants held | 6 | 6 | no plants on raised surfaces |
| 6 | Planters by run or none | 6 | 6 | none |
| 7 | Wings 6 m or more | 8 | 8 | both wings exactly 6 m |
| 8 | Decks two pieces deep | 6 | 6 | deck 4 m all round |
| 9 | Stairs leave the walk | 5 | 5 | the only stair is outside, off the deck's front |
| 10 | Walls tall enough | 6 | 6 | walls 4 m (floor 2.0 to beam 6.0); eave 6 m over the ground (corpus one-storey home p25 5 m) |
| 11 | Plan size | 6 | 6 | roof 16 x 12 m, about 200 m2 (corpus one-storey home p25 11.5 m wide, 128 m2) |
| 12 | Real geometry | 6 | 6 | nothing found off its bearing |
| 13 | Rails where people stand high | 5 | 0 | **80 m of deck edge at 2.1 m over the ground with no rail at all** |
| 14 | Gable apexes closed | 4 | 4 | yes |
| 15 | Posts under wide roofs | 6 | 6 | 6 m spans, none needed |
| 16 | Timber partitions | 3 | 3 | no partitions |

## Walking through it

- You climb a plain stair to a deck 2.1 m up that runs 4 m wide all the way round the house. The deck has no rail
  on any side, so every step along its edge is a 2 m drop. The other renders show the deck as a large bare platform
  with the house in the middle.
- One door on the long front, about 8 m in from the stair head. Inside it is one L-shaped room, 6 m wide in both
  arms, with 4 m walls. That is roomy enough and nothing pinches.
- The roof is a low 26 degree thatch. The two wings are full gables that cross over the corner square, so a short
  gable rises from the middle of each outer eave at the corner, with four valleys between them. The ridges line up
  and nothing is open to the sky. It reads busy from above but sound. The shaft box over the hearth sits on the
  main ridge.
- Four outer corners carry two 2 m posts, one on the corner and one 0.4 m out from it, on the lower half of a 4 m
  wall (corner motif MC-0148). It is a small thing, but up close it looks like a doubled post.

## Rule changes (for every building)

1. **Every open edge of a raised floor gets a rail (item 13).** Principle: a floor people stand on 1.2 m or more over
   the ground is railed with posts and beams on every open edge (D-164), whatever the plan form.
   - Cause: `lib/generate.js`, the rectangular stilt deck (`const deck = C.stilts && plan !== 'octagon' ...` near
     line 679, floor cells laid near line 769) never calls `railing()`. Only `octagonDesign` rails a deck (the
     crannog fence, lines 3143 to 3151), and only at s3.
   - Change: after the deck's floor cells are laid, walk every deck cell edge that has no floor beyond it and call
     `railing(b, K, ex, F, ez, yaw)`. Leave a 2 m gap at the stair head and where a boardwalk starts. Use the same
     pass for loggias, balconies, galleries and lookouts, so one rule covers every raised floor (`loftRail` already
     does this for lofts).
   - Check: add an `open edges` result to `lib/checks.js` (floor top at least 1.2 m over the ground, edge with no floor
     beyond, nothing standing 0.4 to 1.1 m over the edge line; stair heads aside). Score it in
     `lab/council_candidate.js` `shellList` as item 13, so the builder's card catches it.
2. **Lab ground under sunk stilts.** `lib/checks.js` `check()` takes the ground as the 2nd percentile of structural
   bottoms. Stilts sunk 1 m put it at y -1, so a stair foot on the terrain reads as hanging. Take the ground from the
   lowest pivot, the way the mod places the design (`Designs/Blueprints.cs` Center), or from the stair's own foot.
