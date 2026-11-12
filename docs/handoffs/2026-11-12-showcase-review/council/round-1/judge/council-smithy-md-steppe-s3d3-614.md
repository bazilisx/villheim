VERDICT: FAIL

Smithy, Meadows, steppe culture, s3d3, seed 614. An open sunshade (the steppe culture's smithy form in
`lib/styles.js`): 72 m2 of floor under a hip roof on 18 posts, with an 8 m lean-to at the back. The forge corner is
right (Tyler's 13 fault, an extension in front of the forge, does not come back), but the building is a bare platform
with one row of stations along one side.

## Scores (judge checklist, see README.md)

| # | Item | Score | Points | Evidence |
|---|---|---|---|---|
| J1 | Rooms have intent | Partly | 7 / 14 | Forge row on the north side: grinding wheel, anvil block, bellows, forge, tool rack, all beside one another and none in front. Workbench with its chopping block on the west side. Two iron-banded chests on the east side. Nothing else. |
| J2 | Lived in, nothing bare | Fail | 0 / 14 | 9 items in 72 m2: 1.25 per 10 m2 (smithy corpus p25 1.33). The middle 5 m by 4 m is bare. No light of any kind (the plan's lead light is a wall torch; none built). No item stand, no tools hung, no ore or bars, no seat for the smith, no water barrel, no stock of iron. The only lived-in touch is a woodpile under the lean-to. Render `sm-int.png`. |
| J3 | Walkable | Pass | 10 / 10 | Open on all sides; no lane narrower than 2 m. |
| J4 | Nothing floating or squished | Pass | 8 / 8 | Stations rest on the floor; nothing off its wall. |
| J5 | No repetition | Partly | 4 / 8 | Two chests side by side 2 m apart on one side (5.31, -2 and 0), the same pair as in the home and longhouse. |
| J6 | One material family | Pass | 8 / 8 | Wood posts and floor, the forge set, iron-banded chests. |
| J7 | Pieces where builders use them | Pass | 6 / 6 | Extensions beside the forge and bench; a woodpile under a lean-to. |
| J8 | Stand items with meaning | Partly | 3 / 6 | There are none. A smith's tools, bars and finished pieces are the obvious story here (assemblies criteria item 2: "a smith's tools"); a smithy with nothing on show tells nothing about who works it. |
| J9 | Sets as builders set them | Pass | 6 / 6 | Work corners as the corpus sets them: extensions beside their station. |
| J10 | Roof and walls complete | Partly | 5 / 10 | Side elevation (`sm-side.png`, az 90): the lean-to's upper edge sits on top of the main roof's eave, a separate plane perched there, where builders tuck a lean-to under the eave. The main roof's hip is sound. The floor runs 1 m past the posts on all sides in 1x1 floor pieces set at y 0.125 against y 0 for the 2x2 floor (a step, if the two pieces share a pivot height; not checked in the game). The design's own name says "half-timber walls"; it has none. |
| J11 | Outside program, greenery | Partly | 2.5 / 5 | No yard, no plants, no path; the shade stands alone. |
| J12 | One program, plan equals build | Partly | 2.5 / 5 | The suite names a round table, darkwood chairs, a dragon bed, candles, two rugs and banner11; none are built, and nothing in the record says why. |
| | Total | | 62 / 100 | |

## Walking through it

A wide plank platform under a low roof held up by a close row of posts. Along the back runs the smith's line, neat
and usable. Along one end, a workbench; along the other, two chests. In between, nothing: no stool, no lamp, no rack of
tools on a post, no barrel to quench in, no stack of bars. At night it is dark but for the forge. From the side, the
back lean-to looks like a second roof set on top of the first.

Tyler called the showcase smithy (13) "charming, small, cozy". This one is correct and empty, and the charm is gone
with the clutter. He would accept the forge corner and ask where the smith is.

## Rule changes (for every building, not this one)

1. **Work buildings get their working clutter.** `lib/rooms_intent.js` places the station corners and stops (zones:
   forge, bench). Change: each work kind's program includes its supply and show zones from the corpus clusters
   (smithy: a quench barrel or tub, a bar and ore stock, a tool wall or rack on a post, a seat; workshop: lumber stack,
   tool wall), and the stand items for them come from the household's trade (`lib/standitems.js` themes).
2. **Every room gets light.** The light pass left the smithy and the tower without one light. Change: lights are placed
   with the room's zones, before decor, at least the room kind's p25 count from the corpus, and never cut by a budget
   below one per room or one per 30 m2 (the home's note "1 lights over the rooms' budgets left out" is the same rule).
   In an open shed, lights hang from the beams or stand on posts.
3. **A lean-to tucks under the eave.** The lean-to roof (generator roof code for `lean-to` additions) is set so its
   top edge meets the main roof's eave from below, or the main slope runs on over it at a lower pitch; never a
   separate plane resting on the eave.
4. **The suite record lists what is built.** The suite (table, seat, bed, rugs, banner, candles) is chosen for every
   building whether its rooms use those pieces or not. The record shown to Tyler and the audits should list only what
   stands; the name should not say "half-timber walls" on an open form.
5. **Density floor in the generator's checks.** `lib/checks.js` has no lower bound on what a room holds. Add one: each
   room of 8 m2 or more at or above its kind's corpus p25 (`data/interior-lite.json`), or the design is regenerated.
