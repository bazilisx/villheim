VERDICT: FAIL

Architecture seat (track H), round 1. Evidence: blueprint re-made read-only (identical), program record and facade,
the miners, and renders in `/tmp/council-arch/council-tower-mt-frankish-norman-s3d3-31/` (`ext.png`, `elev.png`,
`clip-front.png`), plus the candidate's floor views.

## Scores

Score 62.5 of 88 applicable points = 71.0 %, under the 75 % mark. Openings 33 of 40. No hard fail. Not applicable:
items 18, 20 (no light inside any room), 21. Deciding items: 10, 15, 3, 2.

| # | Item | Wt | Pts | Measure |
|---|---|---|---|---|
| H1-H3 | | - | no | program record 0 faults; blueprint reader uniform 1.0 |
| 1 | One treatment per run | 12 | 12 | each run uniform |
| 2 | One piece per feature, on its window | 4 | 2 | front storey 1: the iron sill beams sit 1 m below the lights and beside them (left: x -6 to -4 for a light at -4 to -3, 1 m past the corner into the air; right: x 1 to 3 for a light at 3 to 4) |
| 3 | Front hierarchy | 5 | 0 | front storey 1 takes motif MW-0005 (iron sill, mullion), west and east take a different motif MW-0347 (twin posts), the back none; on storey 2 the west carries a motif while the front is plain |
| 4 | Storeys | 4 | 4 | each wall keeps its family or its frame above |
| 5 | Rhythm per wall | 4 | 4 | same bays on both storeys |
| 6 | Formal front | 3 | 3 | door centered, windows mirrored at x=±4, upper over lower |
| 7 | Exceptions | 5 | 5 | none |
| 8 | Planters | 3 | 3 | none |
| 9 | One main door | 5 | 5 | frame, stone step, two lamps (program asked for a hood) |
| 10 | Material order | 6 | 0 | wood strips 2 m wide run up through the stone over every opening, through two storeys and through the parapet; no level change at a floor line |
| 11 | One roof material | 5 | 5 | flat deck |
| 12 | Corner mode | 4 | 4 | all |
| 13 | Carved heads | 3 | 3 | none |
| 14 | Symmetry | 4 | 2 | front mirrored; back and east walls carry one off-center window each (x=2, z=2) |
| 15 | One trim family | 6 | 0 | three: log frame posts, planed posts, iron-banded sill beams; parapet half stone merlons, half wood boards |
| 16 | Bands | 2 | 2 | none |
| 17 | Vernacular | 5 | 2.5 | Norman keeps are masonry with arched openings (the palette has `arch`); timber strips and borrowed timber window motifs are off the vernacular |
| 19 | Planters | 2 | 2 | none |
| 22 | Woods per room | 4 | 2 | one room with three furniture families |
| 23 | Room breaks | 2 | 2 | none |

## Walk-through

- A squat 10 by 10 by 11 m stone keep with flat buttresses and battlements: the massing reads as a Norman keep.
- Up close the stone is cut into vertical timber strips: one from the door to the parapet, one over each window bay.
  At the top, three crenels are filled with wood boards, so the battlements are half stone, half fence.
- The front windows carry iron sill beams that sit beside and below the openings; the left one sticks out past the
  corner. Loose posts hang on the stone below the windows.
- Each side wears a different window dress: front one motif, sides another, back none, and the upper storey flips it.
- Inside, the door opens straight into a four-bed dormitory, with the guard table on the floor above and an empty top
  room. The quiet room is at the entry and the public room is upstairs.

## Rule changes (for every building)

1. **Openings in stone get a lintel, never a timber strip.** `lib/generate.js` wallSegment and the stone window rule
   ("a stone wall needs a timber bay over every opening", `b.woodBays`): put a lintel at the light's head (the
   program's `arch` piece where the culture has it, else a beam) and keep stone above and below; never carry wood into
   the parapet. The parapet is one material.
2. **One window motif per storey family, anchored on the light.** `lib/details.js` `motifWindow` and `lib/motifs.js`
   `plan().get` key the motif by facade and size, so the front and sides get different motifs and the back none. Choose
   the motif once for the front family (`Program.run`); the sides take it whole or its frame only. Place it on the
   light's center and width (`o.light`), mirrored left and right, and refuse a motif made for another light width.
3. **Entry floor is the public floor.** `lib/decorate.js` `roleFor` and `lib/rooms_intent.js` (role `guard` maps to
   bedroom on the ground floor): on towers, put the guard room (table, gear, store) at the door and sleeping above
   (Alexander 127, intimacy gradient).
4. **Program honored or re-planned.** The program's fill `bars` and door `hood` were not built and nothing records
   why; the council's `archList` in `lab/council_candidate.js` should compare door dressing, corners, fill and the
   formal flag with the build, not only the window runs.
