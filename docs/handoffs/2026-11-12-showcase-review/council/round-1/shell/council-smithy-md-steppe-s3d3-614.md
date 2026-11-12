VERDICT: PASS

# Shell seat (track D), round 1: council-smithy-md-steppe-s3d3-614

Score 82 of 100 (pass mark 80), no hard fail. A narrow pass. Criteria:
`docs/handoffs/2026-11-12-showcase-review/criteria/shell.md`.

How it was measured: `lib/checks.js` `check()` on the blueprint, piece dumps, `G.generate` with the same request
(153 pieces, same as the blueprint; request form "open", plan "long", roof "hip") for source tags, corpus measures
from `data/measures-storeys.json` (the corpus files blacksmiths under "workshop"), and renders with the roof on:
`/tmp/council-shell/smithy_roof.png`, `smithy_side.png` (end and side elevations, 8 degrees up).

## Hard fails (all pass, checked on the blueprint)

| # | Item | Result | Measure |
|---|---|---|---|
| H1 | Game support | pass | `game support` clean. The lab's older `stability` names 14 posts and beams; the game rule is the one that counts. |
| H2 | Walks two pieces wide | pass | open shed 12 x 6 m |
| H3 | Doorways | pass | no doors (open on all sides) |
| H4 | Pasture fence | pass | none |
| H5 | Masonry | pass | none |

## Weighted items

| # | Item | Wt | Score | Measure |
|---|---|---|---|---|
| 1 | Walls meet the roof | 10 | 10 | no walls (open form); eave beams at 4 m carry the roof |
| 2 | No roof holes | 8 | 8 | clean |
| 3 | Cross wings | 8 | 8 | none |
| 4 | Crossed boards | 4 | 4 | none |
| 5, 6 | Plants, planters | 12 | 12 | none |
| 7 | Wings 6 m or more | 8 | 8 | 6 m |
| 8, 9 | Decks, stairs | 11 | 11 | none |
| 10 | Height for the kind | 6 | 0 | posts 4 m, eave 4 m over the ground; corpus one-storey workshop eave p25 6.5 m (n 10) |
| 11 | Plan size | 6 | 0 | roof 12 x 8 m with the lean-to, 88 m2; corpus one-storey workshop p25 12.5 m wide, 16.5 m long, 170 m2 |
| 12 | Real geometry | 6 | 0 | **the lean-to roof floats**: its low edge (pivot 3.4 m, 26 degree pieces pivot on the low edge) is 0.4 m over its post tops (3.0 m) and 0.95 m over its beam (2.35 m); its high edge (4.4 m) stands 0.4 m over the main eave (4.0 m) at z 3, a slot along its whole 8 m |
| 13 | Rails | 5 | 5 | none needed |
| 14 | Gable apexes | 4 | 4 | hip roof |
| 15 | Posts under wide roofs | 6 | 6 | perimeter posts every 2 m, none inside |
| 16 | Timber partitions | 3 | 3 | none |

## Walking through it

- It is an open forge shed: a row of 4 m posts every 2 m round a 12 x 6 m floor, eave beams, and a low hip roof
  whose ridge is 1 m over the eave. The design name says "half-timber", but no walls are built (form "open").
- Seen from either end, the lean-to on the back is the first thing you notice. Its roof sits on nothing: a 0.4 m
  gap over the posts and a beam a metre below it, and its top edge rides 0.4 m above the main eave instead of
  tucking under it. Its 8 m run starts and stops short of the shed's ends.
- A 1 m apron of 1x1 floor pieces runs round the outside (motif MF-0215), 12 cm higher than the main floor, with
  breaks in it at the back. A 2 m beam lies on the floor at the back edge (y 0.1). Both are small trip lines.
- For a village's last-stage smithy it is small and low next to the corpus. Tyler called the showcase smithy (13)
  "charming, small, cozy", so the size items here are the corpus's word against his liking for a small smithy; see
  the note to the lead.

## Rule changes (for every building)

1. **A roof rests on what carries it, and a lean-to tucks under the eave it leans on (item 12).**
   - Cause: `lib/generate.js`, the lean-to (near lines 3320 to 3360): the roof goes in at `F + SH - 0.6`, while the
     posts stop at `F + 2.3` and the beam at `F + 2.35`, numbers fixed for a 3 m storey. With this shed's 4 m posts
     (`SH` 4) the roof floats. It also tests only that no wall-like piece blocks the bay, never that a wall is there to
     lean on, so it builds against an open side.
   - Change: work down from the main eave. The lean-to's high edge is at or 0.1 m under the main roof's low edge at
     the wall line; its low edge is 1 m lower (one 26 degree piece over 2 m); the posts and beam reach that low edge.
     Build a lean-to only against a wall (no lean-to on open forms), or rest its high edge on the main eave beam.
   - Check: a new `roof bearings` result in `lib/checks.js`: every roof piece's low edge rests on a beam, wall top,
     post top or the roof below it within 0.1 m.
2. **Size and height follow the corpus for the kind (items 10, 11).** Same rule as for the longhouse:
   `lib/generate.js` sizes from `T.bays` and the growth state `MS` (D 3 bays here), and the open form sets one storey
   with `SH` 3 to 4 m. Floor W, D and eave at s3 on `data/measures-storeys.json` `mainBuildingByType.workshop` p25
   (12.5 x 16.5 m, eave 6.5 m for one storey), unless Tyler wants small smithies (open question below).
3. **Apron and floor beams flush with the floor (minor).** `lib/motifs.js` floor motifs (MF-0215) set 1x1 pieces at
   their own pivot height; set them to the main floor's top so no 12 cm lip forms, and leave no lone beam on a floor
   where no door or step needs it.

## Open question for Tyler (through the lead)

Should a stage 3 smithy reach the corpus workshop size (12.5 x 16.5 m roof, eave 6.5 m at the quartile), or stay
small, as he liked showcase 13? The size items here follow the corpus until he answers.
