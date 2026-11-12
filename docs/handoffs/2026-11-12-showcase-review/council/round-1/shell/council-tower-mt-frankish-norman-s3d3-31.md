VERDICT: FAIL

# Shell seat (track D), round 1: council-tower-mt-frankish-norman-s3d3-31

Score 77 of 100 (pass mark 80), no hard fail. Deciding items: 13 (the roof deck's crenels open to the floor 10 m up),
12 (an iron band beam hanging past the corner), 10 and 11 (low and narrow for a three-storey tower). Criteria:
`docs/handoffs/2026-11-12-showcase-review/criteria/shell.md`.

How it was measured: `lib/checks.js` `check()` on the blueprint, piece dumps of the top level, `G.generate` with the
same request (567 pieces, same as the blueprint) for source tags, corpus measures from `data/measures-storeys.json`,
and renders: `/tmp/council-shell/tower_full.png` (four elevations), `tower_fl.png` (front left, roof deck), plus the
builder's `floor-1.png` to `floor-3.png`.

## Hard fails (all pass, checked on the blueprint)

| # | Item | Result | Measure |
|---|---|---|---|
| H1 | Game support | pass | clean; floors carried by 20 posts a level along the inner wall faces |
| H2 | Walks two pieces wide | pass | `passages` clean; rooms about 9 x 9 m |
| H3 | Doorways clear and stepped | pass | ground door at the front, stone stair from the ground to the 1.1 m floor |
| H4 | Pasture fence | pass | none |
| H5 | One masonry family | pass | stone_wall_2x1 and stone_wall_1x1 only |

## Weighted items

| # | Item | Wt | Score | Measure |
|---|---|---|---|---|
| 1 | Walls meet the roof | 10 | 10 | flat roof on the wall tops |
| 2 | No roof holes | 8 | 8 | only the ladder hatch |
| 3, 4 | Cross wings, crossed boards | 12 | 12 | none |
| 5, 6 | Plants, planters | 12 | 12 | none |
| 7 | Rooms wide enough | 8 | 8 | 10 m square on the wall lines |
| 8 | Decks two deep | 6 | 6 | the roof deck is the whole top |
| 9 | Stairs leave the walk | 5 | 5 | stepladders along the walls, `ladders` clean |
| 10 | Height for the kind | 6 | 0 | 3 m storeys (floors at 1.1, 4.1, 7.1, deck 10.1); walls and merlons top 11 m; eave by the corpus method 10 m. Corpus three-storey towers: eave p25 14.6 m (n 15); two storeys p25 11 m |
| 11 | Plan size | 6 | 0 | 11 m across the wall faces (12 m at the buttresses), 121 m2; corpus three-storey towers p25 13 m wide, 136 m2 |
| 12 | Real geometry | 6 | 0 | two woodiron_beam pieces (motif MW-0347) at the second floor line on the front only: one spans x -6.02 to -4.02 while the corner's outer face is at x -5.5, so 0.5 m hangs in the air; they cover 4 of the 11 m front, off center from the door at x 0 |
| 13 | Rails where people stand high | 5 | 0 | **roof deck at 10.1 m: the parapet is 1x1 stone merlons and plank half walls 0.87 m high, set straight on the deck; the crenels between them are open to the floor, 13 m of the 40 m edge** (west 3 m, south 2 m, north 4 m, east 4 m) |
| 14 | Gable apexes | 4 | 4 | none |
| 15 | Posts in rows | 6 | 6 | posts only along the inner wall faces |
| 16 | Timber partitions | 3 | 3 | none |

## Walking through it

- A stone keep with flat buttresses, a stone stair to a door at the front, two torches beside it. Above the ground
  storey the walls change: each window sits in a timber bay, and a strip of planks runs up the front over the door to
  the parapet. Seen from any side the keep reads as stone with wooden patches, not as one stone mass.
- Inside, three storeys of 3 m on ladders that keep to the walls. The rooms are open and easy to cross. (Not my seat:
  the watch room's table was left out by the decorator and the top room is empty, so floors 1 and 2 read as bare.)
- On the roof you come up through a hatch onto a flat deck with nothing to stop you walking off. The merlons are
  waist high and sit straight on the deck, and between them the gaps go down to the floor: 13 m of the edge is open
  to a 10 m drop. The parapet also switches between grey stone blocks and brown planks at uneven spacing (stone
  where stone is under it, planks over the timber bays).
- The iron band at the first floor line is two loose beams on the front, one sticking half a metre out past the
  left corner into the air.

## Rule changes (for every building)

1. **A parapet is a breast wall with merlons on top (item 13).** Principle: every open edge of a floor people stand
   on more than 1.2 m up is closed to at least 1 m (D-164 railing rule; corpus railings are posts, beams and half
   walls).
   - Cause: `lib/generate.js` `flatRoof` (near line 3005): with `C.parapet`, a 1x1 stone block every other metre
     straight on the deck (`top + 0.5`), a plank half wall where no stone is under the edge.
   - Change: a 1 m breast wall along every edge first (the wall's own masonry course, `K.stoneWall`), then merlons
     (`K.stoneBlock`) from `top + 1` every other metre. One material along the whole parapet: carry the stone course
     over the timber bays (check with `game support` that it holds there) or end the timber bays a course below the
     roof.
   - Check: the `open edges` measure proposed with the home candidate (floor 1.2 m or more up, nothing 0.4 to 1.1 m
     over the edge line), scored as item 13 in `lab/council_candidate.js` `shellList`.
2. **Trim stops at the corner and runs the whole facade or not at all (item 12, with the architecture seat).**
   - Cause: `lib/details.js` places corpus motifs as found (`b.put(..., { trim: true, motif: m.m.id })`, near line
     1116, through `lib/motifs.js` `place`), keeping a beam that runs past the end of its wall line, and keeping a band
     where only part of the facade takes it.
   - Change: clip motif pieces to the facade's outer faces (nothing past the corner); a band motif at a floor line goes
     on the whole run of that facade and storey, or on none of it (D-167).
   - Check: a `trim ends` result in `lib/checks.js`: a beam whose end is more than 0.1 m past every wall, post or beam
     under or behind it.
3. **Towers reach the corpus height and width for their storeys (items 10, 11).**
   - Cause: `lib/generate.js` keep form: `bx = bz = 5` bays at s3 (near line 634) and `SH` 3 for towers
     (`MIN_STOREY`).
   - Change: storey height and width from `data/measures-storeys.json` `mainBuildingByType.tower` p25 for the storey
     count (three storeys: eave 14.6 m, so about 4.5 m a storey, and 13 m across), or one more storey at 3 m.
4. **One wall material per facade on a stone keep (walk-through, not scored).** My track's masonry rule ("a metre
   left over is timber and the bay stays timber above", `lib/generate.js`) puts every window in a timber bay up to the
   roof. On a keep, set the window in the stone course with `stone_wall_1x1` pieces each side (the generator already
   does this beside the lights) and keep timber off the face.
