# Landscaping and greenery (D-143): research and placement plan

Design helper 7, 2026-11-11. Branch `design/wip-landscape` from main a7f1566. Docs and data only; no generator or mod
code changed.

Tyler's request (2026-11-11, D-143): "research from the corpus etc as well as outside sources including the games
we've listed to significantly flesh out landscaping, trees, bushes plants across the village as beautification
measures. The idea is to pull beautiful landscaping and greenery ideas, including vines on houses from player made
games and professionally made games and then your helper can decide how these get placed along roads, around houses,
on houses (in the case of vines), in courtyards, in yards, at road intersections or junctions, etc. crucially these
trees and landscaping (including gardens, raised beds, etc) should be ignored by npcs trying to harvest materials."

## What was done

| Commit | What |
|---|---|
| b519df0 | `tools/blueprint-lab/data/landscape/vanilla-greenery.json`, `corpus-greenery.json` |
| 81f64b4 | `placement-plan.json`, `docs/BLUEPRINT_LAB.md` "Landscaping and greenery (D-143)", this record |

The section went into `docs/BLUEPRINT_LAB.md` after "Yards": greenery is outdoor work beside `lib/yards.js`, and
`docs/INTERIOR_DESIGN.md` is about rooms.

## 1. Vanilla greenery

`vanilla-greenery.json` lists 64 prefabs and modes: vines (3), flowers and ferns (6), mushrooms (4), bushes (10),
trees (17), Swamp and Mistlands roots (5), crops and seed crops (10), pots (6), the Yule tree, and the cultivator's
`cultivate` and `replant` modes. 46 have sizes from `data/piece-models.json`. Not greenery: `ashwood_decowall_tree`
(a carved wall panel, 241 builds).

Vanilla has no hedge, planter box or raised-bed piece; builders make beds from beams, logs and floors and put
Pickable plants or crops in them (corpus: 29 flower groups and 11 crop groups with a low border of beams or logs).

From the Valheim wiki (fandom), read 2026-11-11:
- Cultivator (https://valheim.fandom.com/wiki/Cultivator): crops need cultivated ground, open sky and 1 m spacing
  (Magecap 1.6 m); trees need 4 m (Oak 6 m); Vineberry seeds grow Ashvine, which needs a wall within 1.8 m.
- Ashvine (https://valheim.fandom.com/wiki/Ashvine): grows on a wall up to about 10 by 10 m, spawns Vineberry
  clusters, cannot grow under an overhang or in the Mountain or Deep North; each wall vine has 30 health.

Harvest risk with the mod's code as it is (read only, `src/Villheim.Logic`):
- High: trees (TreeBase, felled by the Woodcutter profile when wood is wanted), berry bushes, crops, mushrooms,
  Ashvine clusters (Pickable food, taken by `Foraging.cs` `Nearest`), dandelion and thistle (`Foraging.cs` `Herbs`).
  `yards.js` already places RaspberryBush, BlueberryBush and CloudberryBush in yards and crops and dandelions in beds.
- Low: `vines`, the decorative bushes (Bush01, Bush02_en, shrub_2 and heath forms), roots, ferns, pots, the Yule tree.
- Not checked against the game files: whether the small trees (Beech_small1, FirTree_small) are TreeBase, the
  cultivator sapling prefab names, VineGreen's berries, and anything Deep North added.

## 2. The corpus

Method: one Python script on Tyler's PC (`~/h7/mine_greenery.py` in the remote device session, kept out of the repo),
reading each `.blueprint` once, in time-boxed runs that resume from a done list. For each vanilla greenery piece it
finds the local ground (the lowest piece pivot within 4 m), the nearest wall box (bounds from `piece-models.json`
turned by the piece's rotation), roofs and floors above or below, ground-level floors (paths) within 1.6 m, fences
within 3 m, low beams within 1.2 m (bed borders), and walls or fences met by 8 rays out to 12 m; then names one place.
Same-class pieces within 2 m form a group; three or more nearly in a line count as a line. Builds over 800 greenery
pieces are sampled and weighted back. Culture groups from `members.json` on `origin/design/wip-research`; liked
builds are the top quarter by downloads in `index.json`.

Commands (device session, `~/h7`):

```
curl -sS -o members.json https://raw.githubusercontent.com/bazilisx/villheim/design/wip-research/tools/blueprint-lab/data/culture-corpus/members.json
curl -sS -o piece-models.json https://raw.githubusercontent.com/bazilisx/villheim/main/tools/blueprint-lab/data/piece-models.json
python3 -I mine_greenery.py ~/mnt/Downloads/Villheim-blueprints bounds.json members-min.json state 160   # repeat until "left 0"
python3 -I agg.py                                                                                         # corpus-greenery.json
```

Run: 2,153 files read in four runs (60 + 160 + 160 + 134 s), 610 with greenery, 609 after duplicates.
Skipped: hs_ files, OverDrive files, `_tests` and `_errors`, and the 169 `.vbuild` files (their rotation fields
could not be read with confidence).

Results are in `corpus-greenery.json` and the table in `docs/BLUEPRINT_LAB.md`. The points the plan rests on:
- Vines: 168 builds, 24,000 pieces; 140 builds have vines on a wall; in liked builds "vine on a wall" is the most
  common outdoor place (42 of 153). Patches of 5 (p90 28) at 0.28 m spacing, 38 % at a corner, 275 lines along walls,
  climbing a median 5.6 m; 0.05 vines per wall piece (p75 0.15). Among house builds, 27 % have vines outside, a
  median 23 pieces when they do.
- Bushes: mostly single; spacing 1.1 m in yards, 0.8 m in courtyards, 1.7 m at path edges; a median 3.3 m from
  walls; 28 % scaled 0.9 to 1.3.
- Flowers: singles and pairs about 1 m apart; under eaves and porches in 77 builds; against walls in 42.
- Trees: singles 3 m apart (2.8 in yards, 3.65 on open ground, 3.9 at path edges), 3.7 m from walls; 79 % scaled
  (0.49 to 1.46). The 9 village builds put most trees on open ground between buildings.
- Pots: indoors, under eaves and on sills; clusters of 2 to 3 of mixed kinds 0.3 m apart.
- Crops: 23 builds only; rows 0.73 to 0.8 m apart, 2.1 m from walls.

Limits: heights for raised places are unreliable (stray pieces about 5,000 m down in some builds); window boxes are
counted with other raised spots by a wall; the corpus records no terrain; it holds few laid roads and 9 villages.

## 3. Outside references

Read through Tyler's Chrome, 2026-11-11, read only. Observations first (D-136); no images copied.

| Source | What it does with greenery |
|---|---|
| Tiny Glade, Steam store page (https://store.steampowered.com/app/2198150/) | Ivy is a procedural detail on the buildings: "Ivy envelops your buildings". Trees and flowers are placed by brush. |
| The Witcher 3, "World Building of Witcher 3", 80 Level (https://80.lv/articles/world-building-of-witcher-3/) | Foliage libraries per region (Novigrad, Skellige, Toussaint); big trees first, then smaller ones, then ferns and grass; brushes per terrain type that set the distance and scale variation between trees; "beautiful corners" finished early as targets; Polish open-air museum villages as reference. |
| Baldur's Gate 3, Rivington Cliffside, Gert-Jan van de Put (https://gjvandeput.artstation.com/projects/EvJeln) | Observed in the shots: grass tufts and small shrubs gather along the path edges and at the feet of rocks and walls; the path middle stays bare; one tall cypress stands beside a building; grass sits on the ledges of terraces; dead branches, nets and crates lie among the plants. |
| Manor Lords, "Burgage plot", official wiki (https://wiki.hoodedhorse.com/Manor_Lords/Burgage_plot) | The house faces the street; a vegetable garden or orchard fills the backyard behind it, sized by the plot. |
| Medieval Dynasty, "How to decorate your village", Steam community guide by a player (https://steamcommunity.com/app/1129580/discussions/0/2965016081074326010) | Fences make backyards, decorated with small details; plan the ways before building. |
| Skyrim Hearthfire, "Greenhouse", UESP (https://en.uesp.net/wiki/Skyrim:Greenhouse) | Up to 18 plots of fertile soil inside, and an exterior garden. |
| The Elder Scrolls Online, "Conservatory Furnishings/Hedges", UESP (https://en.uesp.net/wiki/ESO:Conservatory_Furnishings/Hedges) | Hedges come as walls, corners, arcs and horseshoes; the names split "Overgrown" from "Manicured" and "Pruned" topiary. |
| World of Warcraft housing, Blizzard Watch, 2026-02-05 (https://blizzardwatch.com/2026/02/05/plant-clusters-datamined-midnight-help-save-outdoor-decor-budget) | Large garden clusters: plants sold pre-grouped by zone style to fill landscaping at a lower decor cost. |
| Enshrouded, Prima Games farming guide (https://primagames.com/tips/everything-you-need-to-know-about-farming-in-enshrouded) | Farms are laid as farm soil plots with a seedbed station beside them. |
| Foundation, Polymorph Games "Modding Mondays Episode 1" (https://www.polymorph.games/foundation/news/2021/11/29/modding-mondays-episode-1-fantasy-decorations/) | A mod adds organic decorations with height scaling and removing grass in circles (modded content). |

valheimians.com could not be read: the Chrome extension refused page content for that domain. The corpus is the
valheimians download set, so its build list stands in; `corpus-greenery.json` `most_varied_outdoor_builds` names the
15 builds with the most varied outdoor greenery (for example Coop'd Up Farmhouse and Bee'nery, Fenrir's Manor,
Skeggox Manor, fehu green village, Watermill Cottage).

What reads as cared for and what reads as wild, from the corpus and the references together:
- Cared for: plants in lines along a wall or path, even spacing (crops 0.73 to 0.8 m), a low border, pots on sills
  and by the door, path middles kept clear, single trees with room round them, ESO's pruned and manicured forms.
- Wild: vines in masses high on one face or a corner, mixed bush masses, plants gathered at the feet of walls and
  rocks, dead small firs and roots, ESO's overgrown forms.

## 4. Placement plan

`tools/blueprint-lab/data/landscape/placement-plan.json` holds the numbers; in short:
- On houses: vines on 1 house in 4, one patch per chosen face, a corner first, 0.28 m apart, up to the eaves; doors,
  windows and smoke outlets kept clear.
- Around houses: flowers 0.3 to 1.5 m from the wall in runs of 2 to 4, bushes 0.8 to 1.5 m out; the yard's rule of
  nothing over 1 m within 1.2 m of the walls stays.
- Windows and porches: pots in mixed clusters of 2 to 3 on sills and beside the door; window boxes as `details.js`.
- Yards: bushes single or paired 1.1 m apart about 3.3 m from walls; 0 to 2 small trees 2.8 m apart, scaled 0.5
  to 1.0.
- Gardens and beds: rows 0.75 m apart in bordered beds on the side away from the street.
- Courtyards: denser than yards (bushes 0.8 m, flowers 0.7 m), a tree or bed in the middle, walking lines clear.
- Roads: verge plants 0.3 to 1.6 m off the road edge in uneven short runs, more where the road meets a wall or rock.
- Junctions (proposal): a bush cluster at s2, a tree at s3 on the outside corner, 1.5 m back, sight lines clear.
- Open ground: single trees 3.65 m apart and loose bush groups between houses.
- Stages (proposal): s1 almost nothing, s2 first vines, beds and sparse verges, s3 cared-for gardens, courtyard
  planting and junction trees.
- Variance: culture from the corpus groups, one greenness roll per village, household `persona.hobby.plants`,
  `persona.tidy` (cared for or wild) and `persona.yard`.

What the lab needs: a greenery pass (`lib/landscape.js` after the yard), a `landscape: true` mark on every greenery
piece written as a `#VillheimLandscape` index list, and small landscape sets for roads and junctions.

## For the mod session (read only; owned by another track)

How gatherers pick targets today (`src/Villheim.Logic/Villagers/Chores.cs`):
- `IsClutter` (clearing round the hearth and on roads) already skips anything with the village mark
  (`Keys.BuiltBy`, "villheim_v"), so clearing leaves village greenery alone.
- `FindNearest` with `profile.IsSource` / `IsPartial` (felling trees, breaking rocks for wanted materials) and
  `NearestPickable` (loose sticks and stones) do not read `Keys.BuiltBy`. `Available` (the shared filter) checks
  claimed, skipped, unreachable and under water only.
- `Foraging.cs` `Nearest` (food and herbs: berries, mushrooms, crops, dandelion, thistle) does not read it either.
- `DesignSpawner.cs` sets `Keys.BuiltBy` on every object it spawns from a design, plants included.

What would make villagers never harvest landscaping:
1. Skip objects whose ZDO has `Keys.BuiltBy` != 0 (or a new `villheim_landscape` key) in `Chores.Available` or in
   each match, and in `Foraging.Nearest`. Check first that `Farms.cs` crops and `Replanting.cs` / `Groves.cs` trees
   are meant to be worked: grove trees carry no `BuiltBy` today (Replanting.cs sets none), and the farmer works its
   own rows by another path (`Farming.cs`).
2. A plant grown from a sapling or seed (`Plant`) becomes a new object without the mark; a small patch that copies
   the key from the sapling to the grown object would keep planted landscaping protected. Placing grown prefabs
   avoids this.
3. Read the blueprint's `#VillheimLandscape` list (when the lab writes it) and set `villheim_landscape` on spawn.

## Proposed Decisions rows (for the lead to add)

- D-new A: Food-bearing village greenery (berry bushes, Ashvine, crops and herbs in beds): may the household ever
  pick its own garden, or do villagers act out tending only? Recommendation: act out tending only; the plants stay.
- D-new B: Road and junction greenery belongs to no building. Is it planted by a villager one piece at a time from a
  landscape set the mod places along its paths, at no material cost (as yard plants, D-066)? Recommendation: yes.
- D-new C: Landscaping trees: grown prefabs placed by villagers, or saplings that grow (needs the mark copied on
  growth)? Recommendation: grown small trees, scaled, until the copy is built.
- D-new D: May players pick or fell village landscaping as in vanilla? Recommendation: yes, and the village plants
  it back.

## Checks

Docs and data only: the three JSON files parse (`python3 -I -c "import json; json.load(open(...))"`); no lab checks
were needed.

## Open and next

- Build the pass in the lab (`lib/landscape.js`), the `landscape` mark and `#VillheimLandscape`, then render and
  measure against `placement-plan.json`.
- Check in the game files: small trees as TreeBase, sapling prefab names, VineGreen, Deep North plants.
- A finer corpus pass could tell window boxes from other ledges (a floor or beam under the plant, an opening above).

## The pass (design/wip-landscape2)

Design helper, 2026-11-11. Branch `design/wip-landscape2` from main 509744e. Built from this plan and D-143 to D-147
(Decisions tab, "Your answer"); not tried in the game.

| Commit | What |
|---|---|
| ea4b5bd | `lib/landscape.js` (the pass), `lib/generate.js` `outside()` (yard, then greenery) and `landscape` in `finish`, `lib/blueprint.js` `#VillheimGreen`, the bundles' file lists, `lab/render_landscape.js` |
| 581b013 | marks carry use (food, keep) and owner (home, shared) for D-144; `data/landscape/road-kit.json` and `lab/make_road_kit.py`; `lab/test_landscape.js` |
| 75bb98c | plants stay inside the yard gate; plants at the foot of a wall and under the eaves run along it; `docs/BLUEPRINT_LAB.md` "The greenery pass" |

What it does and the numbers it uses are in `docs/BLUEPRINT_LAB.md`, "The greenery pass", with the marker format
(`#VillheimGreen`: prefab;x;y;z;class;place;source;use;owner) and the road kit.

Differences from the plan above, with their source:
- The section is `#VillheimGreen` (the brief) with five fields per piece; the plan's `#VillheimLandscape` index list
  was not used. Use and owner follow D-144 (lead's correction, 2026-11-11).
- Food-bearing plants are placed (berry bushes, dandelion, thistle, mushrooms, Ashvine): D-144 lets the household (or
  anyone, at a shared building) pick plants that stay when picked; the mark tells the mod which.
- Trees go in grown and scaled (D-146), from the corpus scale (79 % scaled, 0.49 to 1.46).
- Plants come from the biome and its neighbors (`NEAR`), stand-ins from the nearest biome only when a class has none
  near (D-145).
- Prefabs without a measured model are left out for now (Birch, Oak, the Swamp trees, GlowingMushroom); roots and
  crops are left to the yard and raised places the lab does not build.

Checks run (2026-11-11):
- `node lab/test_landscape.js 3`: 117 homes, all rules hold; shares and medians in the doc's table.
- `node lab/check_set.js 2 --list`: set 224 of 225, late 90 of 90, cultures 147 of 147. The one failure (temple
  Plains s2d2, overlap, 4 pieces inside another of the same kind) is the same with main's lib
  (`--gen /home/claude/villheim/tools/blueprint-lab/lib`).
- `node lab/test_structure.js`: all structure rules hold on 36 designs.
- `node lib/build_web.js web/index.html`, `node lab/compare_page.js`: all same (bundles restored before committing).
- `tools/gen-test/run.sh` (VH_GEN_OUT=/tmp/h9-gen-test): 5 of 5 the same byte for byte; three of the five carry a
  `#VillheimGreen` section.
- Renders: `/tmp/landscape-renders` (12 buildings with and without greenery over seven biomes and eleven cultures,
  the six road kit sets in four biomes); not committed.

Changes in other tracks' files: `lib/generate.js` (the `outside()` function in place of the two `Yards.add` lines,
the `Landscape` require, `landscape` in `finish`'s return), `lib/blueprint.js` (`#VillheimGreen` read and write),
`lib/build_web.js` and `lib/build_engine.js` (`landscape.js` in the file lists).

Lead's calls (values in use):
- `STAGE_W` s1 0.5, s2 1.0, s3 1.5; `VILLAGE_GREEN` 0.6 to 1.4; `PLOT_GROW` 0.5 m; `DS` flowers d1, vines d3, the rest
  d2. The corpus has no stage or village numbers.
- `NEAR`, the biomes a village gathers from, set from the world's layout.
- The food list (`STAYS`) was not checked against the game files.
- The road kit's junction set-back (1.5 m), the well and notice board sets and their stages are proposals.

Open:
- Courtyard planting is built (`courtSpots`) and has not shown up in a render; a court plan with open ground would
  show it.
- The mod side: reading `#VillheimGreen` and applying D-143, D-144 and D-147 (mod session).
- The village layout placing the road kit (no roads in the lab).
- Window boxes stay with `lib/details.js`; no planters or raised beds beyond the yard's.
