# Track B, corpus rooms: record (2026-11-12)

Branch `design/wip-corpus-rooms`. Brief: learn from the corpus how builders lay out rooms, in numbers the furnishing
rewrite (track E) can follow, and write the council criteria for this track. Findings in full: `docs/ROOM_STUDY.md`.
Data: `tools/blueprint-lab/data/rooms-corpus/*.json`. Criteria: `criteria/corpus-rooms.md` in this folder.

## What was done

- `ad6f80a` first draft of the numbers (06:54 UTC); `c526024` and after carry the refined numbers,
  the catalog families and colors, the criteria file, the audit script and this record.
- New scripts in `tools/blueprint-lab/lab/` (no lib file changed):
  - `rooms_corpus_extract.js`: every build of `compact.json` turned square to the axes and read floor by floor with
    the decorator's own room reader (`lib/decorate.js` floorLevels, readLevel); one line per room with its cells, wall
    faces and their door, window and open runs, doors, stairs and the pieces in and on it. 2,128 builds, 46,675 rooms,
    about 4 minutes.
  - `rooms_corpus_stats.js`: room kinds, focal points, counts, table sets, beds, work corners, counters, custom
    furniture, material families and colors, caps per build and per room (with the showcase), walking space, wall
    decor, and pair co-occurrence; `--audit` adds raw records for one design.
  - `rooms_corpus_gardens.js`: window planters, vines, plant clusters, gardens, trees by kind and culture.
  - `rooms_corpus_showcase.js`: the 16 showcase designs made as `vh gen showcase` makes them (one try of each seed).
    The showcase folder in Tyler's profile is empty, so the designs were made again in the lab.
  - `rooms_corpus_render.js`: views and plan of one corpus room. Renders are in the private repo,
    `research/2026-11-12-rooms/` (commit `6870f87` there).
  - `rooms_corpus_audit.js`: the council check of one design against `criteria/corpus-rooms.md`.
  - `rooms_corpus_lib.js`: piece types, light and seat kinds, the prefab family first cut, the vanilla prefab list
    (game bundle index, 5,936 prefabs), catalog loading and color difference.
- Tyler's added scope (lead, 2026-11-12): pairwise co-occurrence of all items at room and build level with lift, by
  group (light~seat, seat~table and so on), and per prefab the partners it goes with and avoids: `pairs.json`, section
  "Co-occurrence of items" in ROOM_STUDY.md.

## Reused, missing, wrong

- Reused: the room reader and box helpers of `lib/decorate.js`, sizes and roles of `lib/pieces.js`, the build turn and
  kind rules of `lab/mine_room_templates.js`, `data/culture-corpus/members.json`, track A's catalog
  (`data/catalog/pieces.json` version 1: `family`, `look.mean`, `placement.covered`).
- `lib/pieces.js` gives `piece_workbench_ext1` to `ext4` the role `seat`, marks `piece_chair03` as wood (its mesh
  material is Darkwoodchair_material), and makes `piece_cloth_hanging_door` (drapes) a structural door, so the room
  reader takes drapes for doors.
- `lab/mine_room_templates.js` keeps only clean rooms of top builds (464), so its file gives layouts, not corpus rates.
- `lab/layout_measure.js` measures generated designs only.
- The lab's node_modules link to `/home/claude/shared/lab_node_modules` needs `NODE_PATH` set to that folder for the
  canvas package to load its native part.

## Findings that matter most (sources in ROOM_STUDY.md)

- Rooms: 20,400 study rooms in 1,520 vanilla builds. Per kind, p50 and p90 when present: bedroom 1 bed (2), 1 seat
  (2), 1 chest (4), 2 lights (7); dining 1 table (2), 4 seats (6); feast hall 3 tables (5), 10 seats (21); open-plan
  home 1 table (2), 4 seats (11), 1 bed (3). Floor furniture types per room p50: 1 (storage) to 6 (open-plan home).
- Table sets: one seat prefab per table in 76 % to 99 % of sets. piece_table with chair02, chair03 or bench01; round
  and oak tables with chair03 (86 %, 83 %); black marble table with chair03 or black marble benches; bench01 at a black
  marble table 1.4 %. Side seats 0.43 m off the table box, 1.04 m from the middle line of a piece_table; turn 0 to the
  table, 15 to 45 degrees in about one seat in six.
- Color: seat to table delta E p50 6.1 against 10.4 by chance; per room luma spread p50 0 against 48 by chance.
- Repetition (indoors, builds of 30 to 400 m2): 1 light kind per build p50 (p90 3); candles in 5 % of builds; log
  benches in 6 % (p90 2.6 when used); wood_ledge in 1.4 %; chests and barrels stacked in 53 % of builds with chests,
  mostly in storage rooms (48 % of them) and smithies (49 %), 19 % of bedrooms.
- Walking space: straight walk-through halls in house-sized builds p50 2.0 m wide (half under 2 m, 13 % at 4 m or
  more); Tyler's two-wood_floor rule stays the target. Clear depth inside a door p50 2.5 m in bedrooms, 1.75 m in
  homes. Way from the main door to other doors p50 1.5 to 2.25 m.
- Wall decor: item stands in rows (91 % the same prefab, 0.19 m apart); lights alone on their wall (96 %), 2.7 m apart,
  71 % at one height; banners at one height (90 %).
- Windows and gardens: planters at 0.9 % of windows (67 builds), mostly vines; 55 % of them framed by beams or poles.
  Plant clusters are one species in 73 %, each plant at its own yaw, about one plant width apart.
- Showcase against the corpus: wood_ledge in 12 of 16 designs; 2 to 5 light kinds; 8 log benches in the longhouse;
  planters at 7.7 % of windows with mixed crops; clusters one species in 19 %.

## Checks

- Renders of exemplar rooms looked at by eye: tavern hall, bedroom, dining room, smithy floor, halls (four), counter.
  The all-halls count takes in balconies and castle walls, so the straight-hall count in house-sized builds is the one
  given. The counter finder has false positives (the counter render was a run beside a stair); bar numbers are an
  upper bound.
- The audit on five liked corpus builds (61.5 to 93.5 points) and the 16 showcase designs (62 to 98, 13 with a hard
  fail): table in `criteria/corpus-rooms.md`. Its flags match Tyler's notes on 05, 09, 10, 13, 14 and 16.

## Open problems

- Room kinds come from furniture; an open-plan ground floor is one room, and a hearth alcove reads as its own small
  "hearth room". Kinds by the build's own room walls would split them better.
- Bars: the counter finder needs a check by eye before its numbers are used.
- Material families: the catalog puts piece_table_round and piece_table_oak in fine_furniture and chair03 in
  darkwood_furniture, though chair03 is 90 % of their seats and close in color (for track A).
- The criteria do not see clipping, a wardrobe or chest turned the wrong way, or shell gaps; those are other members'.
- Per culture samples are small (22 to 41 builds); only norse, norse-forest, ashlands and castle are given.

## Proposed Decisions rows (for the lead to add)

1. Passages and loft walkways. Tyler's rule: walk-through passages at least two wood_floor pieces wide (4 m), one
   piece only for a closet or hidden passage. Corpus: straight halls p50 2.0 m; the narrow ones are side passages beside
   stairs and loft walkways round a hearth opening. Question: does the rule cover loft walkways and balconies round an
   open hearth? Options: (a) yes, 4 m everywhere people walk; (b) 2 m allowed for a loft walkway or balcony that is not
   the only way to a room. Recommendation: (a) until Tyler says otherwise; the criteria use (a).
2. Window planters. Corpus: 0.9 % of windows have plants, mostly vines; Tyler mocked up a framed sill planter.
   Question: how often do generated windows get planters? Options: (a) the corpus rate (about 1 window in 100);
   (b) a household or culture trait that gives some buildings planters on most windows, built like the mockup with the
   corpus geometry (at sill height, centered, beam frame); (c) every building, a few windows. Recommendation: (b), at
   most 10 % of windows over a village, as the criteria file sets.
3. Stacked chests. Corpus: 53 % of builds with chests stack them, mostly in storage rooms and smithies; 19 % of
   bedrooms. Proposed rule: stacks in storage, smithy, workshop and kitchen rooms; at most one stack in any other room.
   Recommendation: adopt.
4. wood_ledge. Corpus: in 1.4 % of house-sized builds; 72 % of ledges have something on them, often another ledge. Proposed rule: at most 2 per
   building unless they are a shelf that holds items. Recommendation: adopt.

## Next steps

- Track E: furnish from `kinds.json` (counts and focal per kind), `sets.json` (table sets, beds, work corners, custom
  furniture), `materials.json` and `pairs.json` (what goes together), `caps.json` (caps), `space.json` and
  `walls.json`; check each regenerated building with `node lab/rooms_corpus_audit.js <design.blueprint>`.
- When the catalog changes: rerun `rooms_corpus_stats.js` (about 1.5 minutes after the extract) to refresh the family
  and color numbers.
