# Judge, round 1: how the four candidates were judged

The judge's checklist is Tyler's own review (TYLER_NOTES.md, his answers D-164 to D-167 in briefs/common.md, and the
frames in `frames/`). Each item below is one principle from his notes. Each candidate scores Pass (1), Partly (0.5)
or Fail (0) per item. Weights follow his split: interior 80, roofs 10, windows and gardens 10.

| # | Principle (Tyler's words as the ground) | Weight |
|---|---|---|
| J1 | Every room has intent: a purpose, and furniture arranged for that purpose ("My hope is that rooms have intent") | 14 |
| J2 | Rooms read lived in, homey, cozy; nothing left bare (WoW house as "an exemplar layout"; "uninspired spartan") | 14 |
| J3 | Walkable: passages two wood_floor wide, nothing crowding a door or the way to what you need (his hard rule; D-148, D-152) | 10 |
| J4 | Nothing floating, squished or off its wall; furniture rests and stands touch their wall ("hovering", "smushed") | 8 |
| J5 | No repetition of the same pieces and patterns (torches, candles, drapes, log benches, stacked chests) | 8 |
| J6 | One material and color family per room; building materials that belong together ("odd mixture of grausten, stone, wood") | 8 |
| J7 | Pieces used where corpus builders use them (fence, darkwood carvings, hearth over fire_pit, ledges with a purpose) | 6 |
| J8 | Stand items with meaning: one theme per surface, no repeats, armor stands dressed ("random and meaningless") | 6 |
| J9 | Furniture sets as builders set them: seats face and line up with their table, no extra bench behind a bench, beds the right kind and way | 6 |
| J10 | Roof and walls complete: pieces connect, nothing misaligned, walls tall enough (10 %) | 10 |
| J11 | Outside features with a consistent program; greenery clustered and matched to the biome (D-165, D-167) (10 %) | 5 |
| J12 | One building with one program: what the plan says is what stands | 5 |

Pass for the judge: Tyler would accept the building into his world as it is. In practice that means no item at Fail
in J1 to J4 and 80 or more points.

Renders made by the judge (not committed; in `/tmp/council-judge/`): `home-a.png`, `home-west.png`, `home-east.png`,
`home-ext.png`, `lh-west.png`, `lh-east.png`, `lh-ext.png`, `sm-int.png`, `sm-ext.png`, `sm-side.png`, `tw-g.png`,
`tw-1.png`, `tw-ext.png`. Scripts: `rv.js` (cut views of one room), `ext.js` (outside views with the roof), `dump.js`
and `near.js` (piece lists) in the same folder.

Densities are items per 10 m2 from each design's own room report, against the corpus band (p25 / p50 / p75) in
`tools/blueprint-lab/data/interior-lite.json` `rooms.<kind>.perTenM2`.
