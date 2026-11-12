VERDICT: PASS

Architecture seat (track H), round 1. Pass on the points my checklist can test, which are few: the smithy has no walls,
windows or doors, so the Openings group (40) and items 18, 20, 21 do not apply. This pass says little about D-167.
Renders: `/tmp/council-arch/council-smithy-md-steppe-s3d3-614/` (`ext.png`, `elev.png`). Blueprint re-made read-only,
identical.

## Scores

Score 45.5 of 48 applicable points = 94.8 %. No hard fail (no windows). Openings gate not applicable.

| # | Item | Wt | Pts | Measure |
|---|---|---|---|---|
| 9 | One main entry | 5 | 2.5 | no door; no side marked as the way in (every gap between posts alike) |
| 10 | Material order | 6 | 6 | wood only |
| 11 | One roof material | 5 | 5 | thatch, lean-to on the same slope family |
| 12 | Corner mode | 4 | 4 | posts on every corner |
| 13 | Carved heads | 3 | 3 | none |
| 14 | Symmetry | 4 | 4 | mirrored about the short axis, lean-to centered |
| 15 | One trim family | 6 | 6 | planed posts and beams only |
| 16 | Bands | 2 | 2 | none |
| 17 | Vernacular | 5 | 5 | steppe palette (posts) |
| 19 | Planters | 2 | 2 | none |
| 22 | Woods | 4 | 4 | one family |
| 23 | Room breaks | 2 | 2 | forge, bench, wood store: all to purpose |

## Walk-through

- An open 12 by 6 m forge shed under a hipped thatch roof, with a lean-to for firewood along the back. The type fits a
  smithy and the plan is orderly.
- Posts stand every 2 m on all four sides (43 post pieces), so the shed reads as a cage and no side says "enter here".
- The lean-to roof starts 0.4 m above the main roof's eave and runs parallel to it, a second plane stacked on the
  first (`elev.png` az 90 and 270). It should continue the main slope or tuck under its eave.
- The floor edge is ragged: 1 m strips stick out past the end posts and two notches break the back edge.
- The style name is "half-timber" but there are no walls to carry it.

## Rule changes (for every building)

1. **A lean-to meets the main roof at or below its eave.** `lib/generate.js` `outshut`: the lean-to's top is fixed at
   3.4 m whatever the main eave's height; set it from the main eave (continue the main plane as a catslide, or start
   just under the eave).
2. **Open buildings mark their entry.** For `T.open` kinds, make the entry bay wider (drop one post, 4 m bay) on the
   side the path comes from, with a step or a sign; set posts at the corpus bay spacing for open sheds rather than every
   2 m (measure with `lab/arch_grammar.js` bays on corpus sheds before choosing).
3. **Floor edge follows the post line.** The platform's 1 x 1 edging should run an even margin round the posts.

Criteria gap: my checklist has no item for roof junctions or for the entry of an open building, so the lean-to fault
does not move the score. Proposed for round 2: a hard fail "a roof plane stacked on or poking through another, or a
gable end inside another roof" (shared with the shell seat).
