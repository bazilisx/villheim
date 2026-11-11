# Windows, eaves and doors (ideas gaps 3, 7 and 10)

Design helper W, 2026-11-11. Branch `design/wip-windows` from design/integration2 dda70fe. Files: `lib/generate.js`
(window openings and kit, eave rows, wide doors), `lib/details.js` (window frames and shutters, eave trim). Small
changes in other files are listed below. Rates come from the corpus only (D-136).

Decisions used: D-151 (Tyler: "Glass is a building piece"), D-150 (Tyler: no preference; lead's call A), D-059 B
(eaves 1 m past the long walls), D-125. Tyler on 2026-11-11 through the lead: "Not mandatory, perhaps only some
cultures. Other can use shutters, iron 1x1 or 2x2 gates as windows, the dveger copper mesh things too, etc etc
depending on culture... don't force glass windows." and "Dvegr metal wall, for example, is what I was referring to".

## Commits

| Commit | What |
|---|---|
| 31e57ee | Window kit by culture and biome; extra windows between window bays |
| 3b486f2 | Deep eaves, flush rakes (D-150); wide entrances |
| 3a89f82 | Deep eaves keep 1 m on sides facing another wing; no gable porch over a wide entrance; extra windows only with 1 m lights |
| f5cde36 | A balcony keeps its rake; no 2 m tall lights in stone walls |

## What the code does now

**Window kit** (`generate.js` `windowKit`, `fillLight`, `WINDOW_FILL`, `WINDOW_GROUP`, `WINDOW_SIZE`; the kit branch of
`wallSegment`). One draw per building from its culture, type and seed, so it holds across stages.
- Fill, by the corpus builds of the culture's group with a light of that kind set in a wall (wall in its plane on both
  sides and under it). Counted on Tyler's PC (`Villheim-blueprints`, 1,416 builds) with the members of
  `data/culture-corpus/members.json`; the scripts are in `/tmp/windows-work` (`count_windows2.js`, `agg.js`).

  | Group (builds) | glass | iron bars or grate | Dvergr metal wall | arch | shutter | none |
  |---|---|---|---|---|---|---|
  | norse (112) | 26 | 49 | 19 | 22 | 14 | 47 |
  | norse-forest (42) | 4 | 8 | 4 | 6 | 3 | 29 |
  | norse-highland (19) | 2 | 2 | 1 | 6 | 1 | 11 |
  | medieval-timber (28) | 11 | 6 | 4 | 11 | 3 | 9 |
  | castle (61) | 10 | 24 | 7 | 16 | 3 | 27 |
  | fen-folk (13) | 1 | 4 | 2 | 2 | 3 | 8 |
  | all (1,416) | 213 | 258 | 124 | 177 | 76 | 867 |

  Pool cultures to groups: norse and anglo-saxon to norse; norse-forest, slavic, baltic to norse-forest;
  norse-highland and lamari to norse-highland; frankish-norman to medieval-timber; castle-medieval and byzantine to
  castle; fen-folk its own; the rest (under 10 builds) to all. Glass only for cultures whose own builds show it:
  celtic (0 of 5), saami (0 of 2), steppe and middle-eastern (0 of 1) get none.
  Pieces: glass `crystal_wall_1x1`; bars `iron_wall_1x1` and `iron_wall_2x2`; the Dvergr metal wall
  `piece_dvergr_metal_wall_2x2` (the only Dvergr metal wall prefab in `data/piece-models.json`), 2 x 2 lights only;
  arch: a window motif from `data/motifs.json` with an arch piece (`MT.get` with an accept test), else an open light;
  shutters: Wood Shutters open either side of a 1 m tall light where the wall beside is plain, else one closed in a
  1 m light. None is an open light.
- Biome (D-125, `pieces.js buildReach`): a fill whose piece the village's biome and the next one cannot make drops out
  of the draw. Glass from the Swamp on (D-151), iron from the Black Forest on, Dvergr metal walls from the Plains on.
  Meadows villages draw from open, shutter and arch only.
- Size, from the kept window motifs (2,008 uses): 1 m light 83 % (0.5 m slits counted here), 2 m light 5.5 %,
  1 x 2 m 4.2 %, 2 x 2 m 5.8 %. A 1 m light stands on the side toward the middle of the wall with a 1 m wall piece in
  the other half (a 1 m stone block on stone walls). A 2 m tall light needs a 3 m storey, a bay with wall on both
  sides, and a wall that is not stone (stone beside one fell in the stability check).
- Count: with a kit of 1 m lights, a bay between two window bays takes a window at 0.45 (`WINDOW_EXTRA`). The hearth,
  door and gable-end keep-offs are unchanged; the second leaf of a wide door has the same keep-off as the door.
- Frames (`details.js`): the rules' sill, posts and mullion follow the kit's light; the mullion only in open, shutter
  or arch lights. `motifWindow` fits the motif to the light's size and keeps the motif's infill out of filled lights.
  The old `shutters` rule is off when a kit is set; `shutterKit` takes its place.

**Eaves** (`generate.js` `eaveDraw`, `gablePieces`; `details.js bargeboards`). D-150 A: one draw per building from the
details' hash. Deep eave at 0.6 (`DEEP_EAVE`): the next full roof row past the wall, its edge 2 m past the wall's
middle (the miner reads 1.5 to 1.75 m), only where that edge stays 2.3 m over the ground and the side does not face
another wing (there it keeps D-059's 1 m). The draw is higher than the corpus's 26 % because about a third of s2 and
s3 halls, taverns and homes have walls tall enough. Rake a metre past the gable at 0.25 (`RAKE_OUT`; corpus gables 73 %
flush, 20 % at 1 m), and always on buildings with a balcony. Bargeboards run along the deep row; the eave motifs and
beam ends follow the side's depth.

**Wide doors** (`generate.js` `wideDoor`). 42 % of corpus kept door motifs are 4 m wide. Longhouses, taverns, temples
and s3 homes with a front of 8 m or more draw a wide entrance at 0.42: a second door (or a second gate where the
building has a gate door) in the bay beside the front door toward the middle of the wall, turned round so the pair
hangs from the outer posts. Not on floors raised more than 0.3 m (the entry steps serve one door), not with a gable
porch, not on barns (their own gates). Room slots, windows, the fire's place and the climbs keep off the second leaf.

## Measures, before (dda70fe) and after (3a89f82)

Ideas study pool (`/tmp/h8/gen_pool.js`, 612 made, 576 files), mined with `/tmp/h8/lab/mine_motifs.js` (ALL, LAB),
compared with `/tmp/h8/cmp_motifs.js` and `/tmp/h8/overhang.js`. The pool gates ran on 3a89f82, check_interiors on f5cde36.

| Measure | Corpus | Before | After |
|---|---|---|---|
| window light width 1 m / 2 m (kept motifs) | 74 / 8 % (13 % 0.5 m) | 16 / 84 % | 68 / 32 % |
| window light 2 m tall | 10 % | 0 % | 3 % |
| window sites per wall-face site | 0.56 | 0.31 (3,459 / 11,078) | 0.28 (3,449 / 12,167) |
| door motifs 4 m wide | 42 % | 10 % | 12 % |
| eave motifs 1.5 to 1.75 m | 26 % | 2 % | 4 % |
| gable rakes flush | 73 % | 15 % | 65 % |

The miner reads a window as a gap between wall below and wall above, so lights filled with glass, bars or a metal
wall count as wall (in the corpus too). On 102 s2 and s3 homes, longhouses and taverns (seed 11, every biome
culture), before: 2 Wood Shutters, no glass or bars; after: 87 shutters, 156 `iron_wall_1x1`, 58 `crystal_wall_1x1`,
6 Dvergr metal walls, 1,104 `wood_wall_quarter` (1 m lights).

## Checks

| Check | Result |
|---|---|
| `node lab/test_structure.js` | all structure rules hold on 36 designs |
| `node lab/test_sizes.js` | 0 off by more than 10 cm |
| Norse Meadows pool | pass, 81 designs, no issues; prefabsPerD3 12.6 (before 13.1), setShare 0.344 (before 0.36, floor 0.34) |
| middle-eastern Plains pool | FAIL richness prefabsPerD3 10.5 under 11; before 10.3, also FAIL; no design issues either side |
| `check_interiors` 1 seed, 234 designs | check rows 0 (doors and stability fixed in f5cde36); bareFloors 3 (before 0), entryZone 9 (5), floating 5 (2), overlap 3 (2), reachRoom 28 (24); d3 furniture 39.9 (42.3) |
| `lab/compare_page.js` (page built to /tmp, bundles untouched) | all five the same |
| Deep eaves forced on (102 s2 and s3 homes, longhouses, taverns) | 33 took them; no new stability or support failures (the Ashlands castle-medieval tavern stability failure is on dda70fe too) |

## Renders

`/tmp/windows-renders/` (`lab/render_views.js`, roof cut at 2.6 m, so the upper part of the lights and the eaves do
not show):
- `home-mountain-norsehighland-s3d3-seed3.png`: kit tall glass; stone walls, so 1 m lights with 4 glass panes.
- `longhouse-meadows-norse-s3d3-seed11.png`: wide entrance (two gates side by side), deep eaves, 1 m lights.
- `home-blackforest-norseforest-s2d2-seed15.png`: kit iron bars, 12 `iron_wall_1x1` in 1 m lights.

## Changes in other tracks' files

- `lib/pieces.js`: `iron_wall_1x1` added to the `onPivot` list (its pivot is at its foot, as the game's collider
  shows). Revert by taking it out of the regex.
- `lib/motifs.js` `plan().get`: the cache key carries `a` for an arched-window request, so it does not share the plain
  motif's slot. Revert by taking `${f.arch ? 'a' : ''}` out of the key.

## Open

- Windows per wall face stayed at 0.28 to 0.31 on the miner. More would cost wall space the decorator uses (setShare
  0.344 against the 0.34 floor; d3 furniture down 2.4 per design). Needs the decorator track to agree first.
- check_interiors after: bareFloors 3, entryZone 9, floating 5 against 0, 5, 2. Not traced yet.
- Deep eaves reach 4 % of eave motifs against the corpus's 26 %: one-storey buildings fail the 2.3 m edge rule (r5
  review). A 26 degree kick row on 45 degree roofs or deep eaves over raised floors would reach more.
- Wide doors 12 % of door motifs against 42 %: the share applies to four types only; raised floors take none.
- Arched windows come only from motifs, which exist for stone walls; Meadows and Black Forest timber houses that draw
  an arch get an open light.
- Grates: `iron_grate` (2 x 3 m) is counted with the bars and never placed. D-151 says "arched openings and grates
  everywhere"; iron bars need the Black Forest on under D-125 (the materials check). Proposed row: "Iron bars as
  windows in the Meadows. D-151 says grates everywhere; iron is a Swamp material, so D-125 keeps it to Black Forest
  villages and later. A) Meadows too (D-151); B) Black Forest on (D-125). Recommend B. Value in use: B."
- Not tried in the game.
