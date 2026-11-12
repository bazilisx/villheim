VERDICT: PASS

# Shell seat (track D), round 1: council-longhouse-bf-norse-forest-s3d3-208

Score 88 of 100 (pass mark 80), no hard fail. Criteria: `docs/handoffs/2026-11-12-showcase-review/criteria/shell.md`.

How it was measured: `lib/checks.js` `check()` on the blueprint, piece dumps, corpus measures from
`data/measures-storeys.json` (eave = top of the highest wall or post over the ground; width and length = the roofed
footprint, as `lab/measure_corpus.js` takes them), `G.generate` with the same request (518 pieces, same as the
blueprint) for source tags, and renders with the roof on: `/tmp/council-shell/long_roof.png`, `long_305.png`.

## Hard fails (all pass, checked on the blueprint)

| # | Item | Result | Measure |
|---|---|---|---|
| H1 | Game support | pass | `game support` and `stability` both clean |
| H2 | Walks two pieces wide | pass | `passages` clean; hall 6 m inside, stem 6 m |
| H3 | Doorways clear and stepped | pass | one door (wood_gate, 2 m wide, 3 m tall), a stone stair from the ground to the 1.1 m floor |
| H4 | No pasture fence raised or indoors | pass | none |
| H5 | One masonry family | pass | stone_wall_2x1 plinth only |

## Weighted items

| # | Item | Wt | Score | Measure |
|---|---|---|---|---|
| 1 | Walls meet the roof | 10 | 10 | `wall tops` clean |
| 2 | No roof holes | 8 | 8 | `roof holes` clean |
| 3 | Cross wings line up | 8 | 8 | main ridge z 0 (wing z -3 to 3); stem ridge x 1 (stem x -2 to 4) |
| 4 | Crossed boards in line | 4 | 4 | clean |
| 5 | Plants held | 6 | 6 | the one dandelion is on the ground |
| 6 | Planters by run or none | 6 | 6 | none |
| 7 | Wings 6 m or more | 8 | 8 | 6 m and 6 m, the minimum |
| 8 | Decks two deep | 6 | 6 | none |
| 9 | Stairs leave the walk | 5 | 5 | only the outside stone stair |
| 10 | Walls tall enough | 6 | 0 | wood walls 1.0 to 5.0 m on a 1 m stone plinth: 3.9 m over the floor, eave 5 m over the ground. Corpus halls: one storey eave p25 7 m (n 3), two storeys p25 9 m (n 14); 61 of 64 corpus halls have two storeys or more |
| 11 | Plan size | 6 | 0 | roof 24 x 14 m, about 270 m2, hall body 6 m between walls. Corpus halls: one storey p25 15 m wide, 308 m2 (n 3); two storeys p25 24.5 m wide, 575 m2 (n 14) |
| 12 | Real geometry | 6 | 6 | nothing found off its bearing |
| 13 | Rails | 5 | 5 | no raised floor |
| 14 | Gable apexes closed | 4 | 4 | yes |
| 15 | Posts under wide roofs | 6 | 6 | 6 m span, none needed |
| 16 | Timber partitions | 3 | 3 | none |

## Walking through it

- From outside it looks right for a Black Forest longhouse: a steep 45 degree thatch with deep eaves a whole row past
  the walls, a stone plinth, a dragon on one gable and a stub gable over the entrance side. The roof is closed and
  every join meets.
- Up close the front has two small faults of rhythm. The stub gable over the entrance is centered on x 1, but the
  door is at x -1, so the door sits under the gable's left third. The wall posts proud of the long walls stand at
  x -6, 2 and 6 on the front and x -6, -2 and 6 on the back, gaps of 8 m and 4 m, with none on the last 8 m to the
  east gable.
- Inside, it is a long narrow room: 24 m long and 6 m between the walls, with 3.9 m walls and the steep roof
  above. For a feast hall that holds tables, benches, a hearth, a bed and gear, 6 m wide is tight; the corpus halls
  are at least 15 m across at the quartile. It feels like a long home more than a hall.

## Rule changes (for every building)

1. **Size and height follow the corpus for the kind (items 10, 11).** Principle: a building's footprint and wall
   height start at the corpus quartile for its kind and storeys, and the first plot is big enough for the last stage
   (D-083).
   - Cause: `lib/generate.js` sizes the main wing from `T.bays` / `C.bays` (near lines 296 to 310) and the growth
     massing state `MS.W`, `MS.D` (near line 633); for halls the depth stays 3 bays (6 m) from s1 to s3, and `SH` is
     3 to 4 m whatever the kind.
   - Change: read a floor for width, length and eave per kind and storeys from `data/measures-storeys.json`
     `mainBuildingByType` (p25), and size W, D and SH up to it at s3, with the s1 plot laid out to fit (D-083). For a
     one-storey hall that means about 10 to 12 m between the walls (15 m with eaves) and walls of 5 m or more, or a
     second storey (the corpus norm for halls).
   - Check: a lab measure of roof footprint and eave against that table, scored as items 10 and 11 in
     `lab/council_candidate.js` `shellList` (now view only).
2. **The entrance lines up with what is over it.** Principle: a gable, porch or dormer on the entrance front is
   centered on the door, or the door is centered under it.
   - Cause: `lib/generate.js` carries the stem's ridge through to the opposite long wall (`crossLined`, a stub gable
     on the front), and the door is placed without reference to it.
   - Change: when a cross ridge is carried through to the door's wall, put the door under the stub gable's middle;
     when the door must stay elsewhere, end the cross ridge at the main ridge on that side.
3. **Wall posts keep a rhythm (shared with the architecture seat, D-167).** Principle: posts proud of a wall stand
   at even spacing along the whole run, and the door sits between two of them.
   - Cause: `lib/details.js` `exterior`, "bay posts" (near line 452): every 4 m from one end, skipping the post by a
     door and wherever a wing meets the wall, which leaves 8 m gaps.
   - Change: lay the rhythm from the door outward (a post each side of the door, then every 4 m both ways), keep
     the two long walls the same, and drop the posts on a run where the rhythm cannot hold.
