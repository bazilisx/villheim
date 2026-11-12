VERDICT: PASS

Architecture seat (track H), round 1. Evidence as for the other candidates: the blueprint re-made read-only (identical),
program record and facade, the three miners, the wing records, and roof-on renders in
`/tmp/council-arch/council-longhouse-bf-norse-forest-s3d3-208/` (`ext.png`, `elev.png`, `clip-entry.png`).

## Scores

Score 77.5 of 93 applicable points = 83.3 %. Openings 38 of 40. No hard fail. Not applicable: items 18, 21.

| # | Item | Wt | Pts | Measure |
|---|---|---|---|---|
| H1 | Lone feature | - | no | program: 0 faults. Blueprint reader's one lone window is a corner post beside an end window (reader noise) |
| H2 | Mixed run | - | no | program: all 24 windows `head`; renders agree |
| H3 | Planters | - | no | none |
| 1 | One treatment per run | 12 | 12 | 7 runs, all head board, fill open |
| 2 | One piece per feature | 4 | 4 | wood_beam_1 on every light |
| 3 | Front hierarchy | 5 | 5 | sides take the front family whole |
| 4 | Storeys | 4 | 4 | one storey |
| 5 | Rhythm per wall | 4 | 2 | each wall set once, but the two gable ends of one nave differ: west one centered window, east two |
| 6 | Formal front | 3 | 3 | free plan |
| 7 | Exceptions | 5 | 5 | none |
| 8 | Planters | 3 | 3 | none |
| 9 | One main door | 5 | 5 | one gate, frame and stone step; the program's hood was dropped under the deep eave without a note |
| 10 | Material order | 6 | 6 | stone plinth all round, wood above, change at the floor line |
| 11 | One roof material | 5 | 5 | thatch 45 throughout |
| 12 | Corner mode | 4 | 0 | program `none`; built posts on the east end and the rear wing's back corners, none on the west end |
| 13 | Carved heads paired | 3 | 1.5 | one dragon, west ridge end only |
| 14 | Symmetry | 4 | 0 | mirror 0.47; the door is 2 m off the front cross gable's axis |
| 15 | One trim family | 6 | 3 | log bay posts and planed corner posts; the front cross gable lacks its lower left bargeboard (the back one has all four) |
| 16 | Wall bands | 2 | 1 | a beam on the plinth top on every side; program says `none` (reads as a plinth cap, see note) |
| 17 | Vernacular | 5 | 5 | norse-forest palette |
| 19 | Planters | 2 | 2 | 0 % |
| 20 | Light kinds | 5 | 5 | one kind in the hall |
| 22 | Woods | 4 | 4 | one family |
| 23 | Room breaks | 2 | 2 | none without a reason |

## Walk-through

- A long thatched nave on a stone plinth with a cross wing through the middle: a strong, readable longhouse. The
  plinth and the thatch are consistent all round, and the windows are one quiet family.
- The front cross gable is the obvious place to enter, but the door sits 2 m to its left under the plain eave. The
  eye goes to the gable, the feet go somewhere else.
- The front gable's left foot has no bargeboard; the right foot does.
- The back eave is short from the west end to x=10, then drops a full row deeper for the last 4 m. The east gable has
  two windows, the west gable one. The dragon rides only the west ridge end. All three come from one cause: the nave
  is two wing records (main wing to x=10, an inline annex from 10 to 14) and each rule treats the annex as a separate
  building though it carries the same ridge and eave.
- Bay posts on the long walls stand at x=-6, 2 and 6 and skip x=10 on both sides, so the 4 m rhythm breaks.

## Rule changes (for every building)

1. **One mass, one set of roof and gable rules.** `lib/generate.js`: an inline annex with the main wing's depth and
   ridge height joins wing 0 for the eave depth (`open(sv)` in the eave loop: choose the depth per continuous slope,
   not per wing), the gable-window rule (`w0g` test), and the carved heads (the dragons loop skips an end that has an
   inline annex; with the merged mass the head goes on the annex's end).
2. **The entry sits under its gable.** Where the plan has a front cross gable (T or cross plans), put the main door on
   that gable's axis, or center the gable on the door bay (`lib/generate.js` door placement and wing `spec.at: 'mid'`).
3. **Paired ornament or none.** Carved heads and bargeboards go in mirrored pairs; when one cannot be placed, drop its
   twin (`lib/generate.js` dragons loop; the gable bargeboard placement).
4. **Bay posts as a run.** `lib/details.js` bay posts: a post blocked by a window head is dropped silently; lay posts
   and windows from one grid (windows between posts) or drop the wall's whole post line.
5. **Program honored or re-planned.** Corners (`motifCorners`, as in the home file), the door hood (when the deep eave
   blocks it, the program should pick lamps or banners), and bands: the plinth cap at the stone-to-wood change should be
   a program field (`materials.changeAt` with a cap), so the record says what is built.

Note for the criteria: item 16 counts a plinth cap as a band on every side (corpus 0.4 %). A beam at the material
change is the base course of Whitsitt's base, middle and top and belongs under item 10. I scored it half pending that
change.
