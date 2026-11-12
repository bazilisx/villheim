# Track C, outside study: track record (2026-11-12)

Branch `design/wip-outside-study`. Brief: learn how designers make rooms feel intentional, lived in, homey and cozy
(WoW housing tour first, then other games, set dressing talks and real-world interior design), and turn it into rules
a Valheim room generator can follow. Added during the day (lead, 2026-11-12): a council criteria file, and full
sections on intentional clutter and environmental storytelling (Tyler: "among our most important interior design
drivers"). No code changes.

## What was done

| Commit | What |
|---|---|
| a086ad2 | `outside/wow-housing-tour.md`: room by room notes on the WoW housing tour (scene graph of 36 viewpoints, floor plans, 14 scenes and about 30 cube faces looked at), and the 14 points the house shows throughout |
| e559db3 | `outside/sources.md`: notes per source with links (Skyrim pictures, Hurstwic longhouse and seating, great hall, Houzz clearances, feng shui, rule of odds, woods, metals, 60-30-10, layered light, coziness, Don Carson, three 80.lv articles, Witcher 3, Kingdom Come, Enshrouded) |
| 9131905 | `docs/INTERIOR_DESIGN.md` section "Room intent: outside study (2026-11-12)": corpus checks, WoW lessons, space and walking lines, focal point and command position, zones, light, palette, intentional clutter, environmental storytelling, the room intent template, ten room kinds, 18 vignettes, and the list of rules the corpus still has to confirm |
| last commit of the branch | `criteria/outside-study.md` (council checklist) and this record |

Private repo `villheim-corpus` (main): `research/2026-11-12-outside/wow/` (tour screenshots, floor plans,
`scenes.txt`, `cubes.json`), `games/` (four Skyrim pictures), `scripts/` (`seats.py`, `groups.py` and their output).
Commits 0e456de, 63d0753, 746ae1c.

## Findings

Corpus checks (`compact.json`, 2,128 builds; scripts in the private repo):

- One seat kind per table: 1,816 of 1,987 tables with seats within 2.2 m (91 %).
- Pairings: `piece_table_round` with `piece_chair03` 84 %; `piece_table_oak` with chair03 73 %; `piece_blackmarble_table`
  with chair03 58 % and black marble benches 23 %; Dvergr tables with Dvergr stools 70 %; runed tables with runed
  chairs 72 to 93 %; `piece_table` with chair02 33 %, chair03 31 %, bench01 17 %, chair 12 %, log bench 3 %.
- Black marble seats at a table of another material: 5 of 1,847 tables (0.3 %). Tyler's note on 04, 05, 07 and 011
  matches the corpus.
- Log benches: in 152 of 2,128 builds (7 %), median 2 per build, p75 3; 20 % within 3.5 m of a fire, 9 % at a table.
- Lights (947 builds with 5 or more): the commonest kind is 50 / 67 / 91 % of a build's lights (p25 / p50 / p75);
  2 kinds is the most common count (217), 1 kind 190, 3 kinds 191.
- Horizontal item stand groups (0.6 m, same height): singles 74 %, pairs 10 %, threes 4 %; even groups outnumber odd
  ones (1,656 to 1,191). The decorators' rule of odds does not show in the corpus and is kept as a styling option only.

Outside sources (details and links in `outside/`):

- WoW house: every group on its own rug (11 of 12 seen), bare walking lines, one furniture wood with a darker
  structure wood and iron fittings, two fabric colors per room, a focal point at the end of each door's view, walls
  dressed in bays, a ceiling layer in every used room, food at every stage, mid-use signs, a light every few steps,
  one odd personal piece per room, storage behind the room it serves.
- Skyrim inn and home: one central fire for the social room, the counter beside it, food hung behind the counter,
  service rooms with their own outside door; a sleeper's room told by three or four pieces.
- Longhouse and hall: benches along the long walls facing a long fire; high seat across the fire from the guest of
  honor; rank falls toward the door; great hall dais at the far end and a screen with service doors at the entry end.
- Real-world rules used: clearances (walkway 0.8 to 0.9 m, 0.9 m behind a diner, 0.5 m at bed sides, seating arc
  2.4 m), the command position, three wood tones at most with one undertone, two to three metals, 60-30-10, layered
  warm light, clutter by use with hot spots and rest areas, one story per room.

## Checks

- Every corpus number above was printed by the scripts and copied from their output files.
- Writing rules: no em dashes in the new text (grep), American spelling fixed ("centre" to "center").
- No code changed, so no lab checks were run.

## Open problems

- Track A's catalog was not there when the palette section was written (only `data/catalog/tools/`). Wood families
  come from mesh texture names; colors and finishes need the catalog.
- Track B's room findings were not there. Rules marked [confirm] in INTERIOR_DESIGN.md wait on its measures.
- Not read with pictures: ESO player showcases (the UESP housing page, read in Chrome, links only to videos), Witcher 3 and
  Kingdom Come interiors (no pictures found on the pages opened). Dan Cox's GDC 2014 talk is a video and was not
  watched. `images.uesp.net` showed a bot check in the cloud browser; it was left alone and the built-in browser used.
- Fuel beside an indoor hearth (vignette 4) conflicts with the decorator's woodpiles-outdoors rule from T-05.

## Proposed Decisions rows

- **Fuel by the indoor hearth.** Corpus: wood stacks in 19 % of furnished buildings (median 4); the Cozy Blacksmith
  Cabin stacks firewood in a wall bay beside the fire; the decorator keeps woodpiles outdoors since T-05. Options:
  (a) keep all woodpiles outside; (b) allow one small stack in a wall bay beside a hearth in homes and taverns, at the
  corpus rate. Recommendation: (b), at the corpus rate, never in a door box or on a walking line.
- **Track C criteria pass mark.** 75 of 100 with no hard fail and every group at half its weight. Options: keep, or
  set from the first council round's scores. Recommendation: keep for round one.

## Next steps

- When track A's catalog lands: replace the texture families in "Palette" with the catalog's look tags and recheck
  the pairings by color.
- When track B lands: replace each [confirm] with the corpus number; adjust the criteria bands to match.
- Track E: build the room intent record (template in INTERIOR_DESIGN.md) before placing pieces; vignettes as whole
  units at hot spots; seat kind per table from the corpus pairings.
