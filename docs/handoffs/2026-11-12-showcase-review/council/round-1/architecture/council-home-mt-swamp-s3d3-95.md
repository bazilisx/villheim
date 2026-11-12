VERDICT: PASS

Architecture seat (track H), round 1. Checklist: `docs/handoffs/2026-11-12-showcase-review/criteria/architecture.md`.
Evidence: the candidate blueprint re-made read-only with `lib/request.js make` (same seed, blueprint identical byte for
byte), its program record and facade (`b.facade`, `ctx.program`), `lab/arch_facades.js --perbuild`,
`lab/arch_grammar.js`, `lab/arch_rooms.js`, and roof-on renders in `/tmp/council-arch/council-home-mt-swamp-s3d3-95/`
(`ext.png`, `elev.png`, `roof-4.png`, `clip-west.png`).

## Scores

Score 82.5 of 93 applicable points = 88.7 %. Openings 38.5 of 40. No hard fail. Not applicable: item 18 (no village),
item 21 (no banner or drape placed).

| # | Item | Wt | Pts | Measure |
|---|---|---|---|---|
| H1 | Lone feature without a reason | - | no | program record: 0 faults |
| H2 | Mixed treatments in a run | - | no | program: every window `posts`. Blueprint reader shows 2 mixed runs; both read the low eave and the gable bargeboards as a hood and brace (reader noise, criteria notes); renders show plain posts on every window |
| H3 | Planters past the rule | - | no | none |
| 1 | One built treatment per run | 12 | 12 | 10 windows, 5 runs, all `posts`, fill open |
| 2 | One piece per feature | 4 | 4 | wood_pole on every window |
| 3 | Front hierarchy | 5 | 5 | the door (frame, step, hood) is the richest opening |
| 4 | Storeys | 4 | 4 | one storey |
| 5 | Rhythm per wall | 4 | 4 | back every other bay at even 4 m; each wall set once |
| 6 | Formal front | 3 | 1.5 | program `formal: true`, built free: door at x=4 on a wall from 1 to 9, no mirror |
| 7 | Few reasoned exceptions | 5 | 5 | none |
| 8 | Planters | 3 | 3 | none |
| 9 | One main door | 5 | 5 | single door, frame, step, hood |
| 10 | Material order | 6 | 6 | all wood |
| 11 | One roof material | 5 | 5 | thatch, one slope (26) |
| 12 | Corner trim in one mode | 4 | 0 | program `entry`; built: corner motif on 4 of 5 outside corners, including the back west corner, none on the back east corner |
| 13 | Carved heads in pairs | 3 | 3 | none |
| 14 | Symmetry fits the kind | 4 | 2 | mirror 0.61, door off axis, program's formal flag unmet |
| 15 | One wood family in the trim | 6 | 3 | two: log frame and stilts, planed corner posts, window posts and beams |
| 16 | Wall bands | 2 | 2 | none |
| 17 | Vernacular | 5 | 5 | swamp palette (posts), one roof material |
| 19 | Planters under 10 % | 2 | 2 | 0 % |
| 20 | One light kind per room | 5 | 5 | wall sconces only |
| 22 | Woods per room | 4 | 4 | two families, lead 0.67 |
| 23 | Room breaks with a reason | 2 | 2 | kitchen pieces in the home room |

## Walk-through

- An L house of plank walls on log frame posts, set 2 m up on a deck of stilts. The deck runs 4 m past the walls on
  every side, 8 m in front of the door, with a 6 by 4 m bite out of its south east corner beside the stair that
  follows nothing in the house. About half the pieces (280 of 585) are stilts and deck posts.
- The stair lands on the door's axis (x=4): a clear approach.
- The entry wall is blank except the door. The windows are small 1 m lights with a post each side, the same all round.
  Calm and consistent.
- Roof: the wing's ridge runs right through the main block to a cross gable on the back wall. The main ridge then ends
  at x=-5 with a full gable wall and bargeboards that stand up out of the wing's west slope, a gable stub mid-slope with
  a dark gap at its foot (`roof-4.png`, `clip-west.png`). A person looking from the west sees a small gable stuck on
  the roof for no reason.
- The chimney box sits on the north slope beside a valley, the spot builders avoid.
- Corner posts appear on four corners and not the fifth, and one corner post sits inside the log frame post at the
  same spot.

## Rule changes (for every building)

1. **Roof ends follow the mass as seen, not the wing record.** Principle: a ridge that runs into another roof ends in
   valleys; a gable only where the roof ends in open air. Here the main wing's west gable lies under the cross wing's
   slope. `lib/generate.js` roof per wing (gable wall_roof and bargeboard placement): before placing a gable end, test
   whether the end lies inside another wing's roof outline; if so, end the ridge in valleys and place no gable or
   bargeboards. Same cause as the longhouse's eave jog and lone carving.
2. **Corner motifs read the program.** `lib/details.js` `motifCorners` draws `dressed(ctx, 'corner', ...)` per corner
   and ignores `prog.corners`; call `cornerDressed` (all, none, entry) as the plain corner posts do, and skip a post
   where the frame already stands a post at that point.
3. **The formal flag is set with the plan.** `lib/program.js` `plan` sets `formal` before the plan and door are known;
   `lib/generate.js` `formalLine` then drops it silently when the door is not on a middle bay. Pass the plan shape and
   door bay into `Program.plan`, or let generate.js write the built result back to `prog.formal`, so the record and the
   building agree.
4. **Deck outline follows the house.** The deck's missing corner beside the stair has no reason; the deck should keep
   an even margin round the walls, or cut back only where the stair or a path needs it (outside-study seat's file).
