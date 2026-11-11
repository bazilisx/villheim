# Handoff: item stands and feasts (design helper, 2026-11-10)

Branch `design/wip-stands` on origin, on top of main at 539a56f. Not merged to main. Not tried in the game.

## Tyler's request and the rules in force

- Tyler, 2026-11-10: "included in decor are any items in vanilla that can be added to itemstandh (and also itemstand
  which is the vertical wall one) to add additional context, flavor, lived-in feel to the house. That can include food
  on the table. Tools hung up near benches. Rare items. Trophies earned. [...] These, as well as feasts laid down by the
  serving tray [...] are among the most common ways that creative designers add depth and flavor and warmth/livelihood
  to rooms... ensure these elements are included in significant ways to all the houses. Things on tables, side tables,
  things on walls, things on windowsills. Things on benches, workbenches. Things mounted to rafters, etc."
- Clarification (Tyler, 2026-11-10, through the coordinator): item stands, especially itemstandh, as single stands and
  as clusters or groups, are the main body of the work, with corpus-based rates and many arrangements; feasts on the
  Serving Tray are fairly common but much less so: a smaller, occasional addition (mostly dining and feast tables at
  d3, by household).
- Rule correction (Tyler, 2026-11-10): "there are no restrictions on any level of furniture, decoration, or limits on
  whats shown for any decor... decor can be freely used across any biome." D-080 is only about payment. Any item that
  fits a stand, from any biome (Deep North included), may go in any village; the village's own biome may weigh a
  little more, never exclude. No caps beyond corpus densities varied by household and decor stage, repetition weighed
  down. The library-first helper is changing `lib/pieces.js` decorOk and `lib/persona.js` itemFrom to match; keep
  their version on rebase.
- Standing rules: households never trades; additive decor stages (d1 inside d2 inside d3); loose food and drink never
  placed loose (T-626), always on a stand; hung stands keep their collider against the wall's (pool audit mountClip
  and hang); deliberate clips allowed for a purpose (D-098).

## What the wiki says (valheim.weirdgloop.org)

- Item Stand page: the vertical stand (`itemstand`) and the horizontal one (`itemstandh`), Workbench, 4 fine wood and
  1 bronze nails. Can hold: all food (honey listed as not placeable), meads (horizontal only), bombs, trophies,
  weapons (no arrows or bolts), shields, tools, fish, Ancient Seed, Asksvin egg, Barber Kit, Barrel Hoops, Bell, Black
  Core, Celestial Feather, Dandelion, Dragon Egg, Dragon Tear, Dverger Circlet, Dvergr Tankard, Egg, Fuling Totem,
  Hildir's hats, Hildir's chests (horizontal only), Midsummer Crown, Molten Core, Proustite Powder, saddles, Scythe,
  Scythe Handle, Sealbreaker, Surtling Core, Swamp Key, Thistle, Torn Spirit, trinkets, Volture Egg, Yule Hat. Cannot:
  accessories, armor (but the hats above), arrows, bolts, gems, valuables (rubies, amber and the like), metals, ores,
  hides, pelts, raw meat, resin, seeds (but Jotun Puffs and Magecap), stone, wood, torch, honey and others. The wiki
  marks its list incomplete. A vertical stand turned flips left and right only.
- Serving Tray: internal ID `Feaster`, a two-handed tool. "Feasts can only be eaten after they have been placed with a
  Serving Tray." It places food, mead or feasts on the ground or on structures. The placed feasts are pieces:
  `FeastMeadows`, `FeastBlackforest`, `FeastSwamps`, `FeastOceans`, `FeastMountains`, `FeastPlains`,
  `FeastMistlands`, `FeastAshlands`, `FeastDeepNorth` (the item is `FeastDeepNorth_Material` per a third-party list).
- Trophies page: every trophy ID by biome, Deep North included (`TrophyBarka`, `TrophyElaking`, `TrophyMole`,
  `TrophyJotunWitch`, `TrophyJotunWarrior`, `TrophyMoose`, `TrophyBlob_Morkhalla`, `TrophySeal`). Other Deep North
  IDs used (third-party list, gameserverkings.com): drinks `Lingondricka`, `OatMilk`; food `Pancakes`, `SmokedFish`,
  `FishSoup`, `SealSoup`, `KaleChips`, `MooseKebab`, `BakedPoteitr`, `Lingonberry`; `Kale`; gold weapons and shields
  (`SwordGold`, `ShieldGold`, `ShieldGoldBuckler`, ...); `Shovel`. Check these against the game's ObjectDB when tested.

## The corpus mining

- Corpus: Tyler's PC, `C:\Users\tyler\Downloads\Villheim-blueprints` (2,153 .blueprint files by category folder,
  `index.json` with slug, title, author, downloads). Reached through the remote device (`device_bash`, the folder is
  mounted at `$HOME/mnt/Downloads/Villheim-blueprints`). The device has node and git; the repo clones there
  (`git clone --depth 1 https://github.com/bazilisx/villheim /tmp/vhs`). Background jobs on the device are killed at
  the end of a call; one full run takes 34 s, inside the 180 s limit.
- Command: `node --max-old-space-size=2800 lab/mine_stands.js <corpus dir> <out.json> <corpus dir>/index.json`
  (`tools/blueprint-lab/lab/mine_stands.js`; exports `scan`, `newStats`, `kindOf` for `lab/test_stands.js`).
- Derived data committed: `tools/blueprint-lab/data/stands-corpus.json` (counts only, no community blueprint
  content). The full output (with 605 exemplar groups in their anchor's frame) was `/tmp/stands-full.json` on the
  device; it is not kept. Rerun the command for it.
- Totals: 1,559 vanilla builds, 939 with interiors, 346 with stands holding something inside. Inside: 9,211 wall
  stands (4,424 empty), 15,822 flat stands (4,882 empty).
- Wall stands hold trophies 1,838, shields 1,106, weapons 985, tools 168, rare things 134, boss trophies 127, fish
  101. Flat stands hold drink 3,690, food 2,332, herbs 1,079, weapons 969, trophies 691, rare things 506, hats 480
  (mostly the Dvergr circlet), tools 263, shields 244, fish 143.
- Where flat stands are: floor 2,080, shelves 1,858, tables 1,629, low ledges 1,123, by the fire (mantel) 1,019, on
  another stand 745, counters 360, benches and chairs 218, beams over 2.3 m 191, sills 187, chest lids 58,
  workbenches 32. Where wall stands are: plain wall 757, beams and posts at eye height 648, over a workbench or
  station 578, by the hearth 558, beams over 2.3 m 533, over a chest 333, over a table 328, over a bed 208, by a door
  175, over a bench 141.
- Heights (median): a table's stands 0.77 m, shelf 1.1, mantel 0.97, sill 0.97, bench 0.55; wall stands 1.88 m, over
  a bench 1.66, over a workbench 2.08, over a bed 2.85; on rafters 2.96. Wall stands sit about a metre apart (median
  0.97 m, quarter of them 0.49 m or closer). A third of flat stands (3,287 of 10,115) are sunk over 6 cm into what
  they stand on, the stand hidden in a table top so only the item shows.
- Groups (stands within 0.9 m): 4,611 single, 690 pairs, 416 threes, 251 fours, 556 of five or more. Commonest:
  drink with food on a table (60), herbs drying with a knife (99, mostly one build), four trophies, two drinks on a
  table or shelf, a hat and a weapon on a rafter, two trophies on a sill, rows of drinks on shelves and counters.
- Of the 211 house-like builds with stands: a stand on a table 52 % (of those with a table; a third of their tables),
  on a wall 79 %, on a sill 14 % (of those with a window piece), shelf 51 %, by the fire 38 %, bench or workbench 51 %,
  rafters 38 %, floor 41 %, chest 33 %, a feast 21 %; distinct items per build median 7 (quartiles 2 and 20), stands
  19 (5 and 49).
- Feasts: 266 in 65 builds, 150 on tables (several along one long oak table, spaced 1.2 to 2.5 m), 76 on floors.
  3,549 loose food and drink items (1,613 on floors, 1,192 on tables).
- Builds whose arrangements were read: The Lost Hall of Aegir (doublea1ron), Simple Corewood Lighthouse, The
  Greydwarf Wharf, Quirky Log Cabin, Fogbreaker Fortress (HiccupTheHermit), INCREDIBLE Tavern (Olivanderr), Big Spiral
  House v2.5 (Haakonzen), The Hall of the Gods (halfnate), Badger Forge, Wizard Tower, The Serpent's Tail, The Burning
  Tree Hideout (Fluffy-n-Dana), Fantasy Mage House (Apudma), Guest House Mistlands Era, Tiny Home Challenge 2
  (Viking_Anarchist), Stone Chateau (wolvendrake), Daluffo Home (Deardly), The Iron Villa (Boomboy), medieval tavern
  (thepower3412), Circular Temple for Trader (Mamlaka). Not yet credited in `docs/INTERIOR_DESIGN.md`.

## What is built (branch design/wip-stands, commits 818984f and f5927ea)

- `lib/persona.js`: `ITEMS` rewritten: every stand item by kind (trophy 60, boss 11, shield 18, weapon 54, tool 15,
  farm 4, fishing, fish 12, drink 19, food 59, herbs 8, hat 3, rare 13, tray), Deep North included, weights from the
  builds that show each one (`itemBuilds`). `valuable` draws from the rare things (valuables cannot go on a stand);
  honey, rubies and amber removed. `itemFrom` takes any biome; the village's own weighs 1.6. `AT_KINDS` (the corpus mix
  per place), `kindLean` (household lean per kind), `standItem` reads the place (`o.at`), `standAt` reads a stand's
  place as the miner does, `dressStands` splits a set's `want: 'kind@place'`. `ITEMS.tray` is the Serving Tray.
- `lib/stands.js` (new, in the engine and web bundles): `dressTops`, the stand pass, 30 sets (`KS-`) plus height
  variants of the wall sets: table meals, rows, mugs, left things, tools, arms, herbs, a curio; round and long table
  settings; feasts (five spots on a table, two on a long table; third stage only, once per room, weight 0.12 each);
  bench and chair mugs; chest tops (one, two, three things, a shield); wall tools, farm tools, arms, shields, trophies,
  one thing, a rod and a fish; ledges (pantry, meads, herbs, curios, two ledges, arms); a mantel; sills (made per
  window, one to three stands on the wall under the opening); rafters (stands on beams across a room; a beam at 2.6 m
  or a ledge at 2.3 m on the wall); a mug on the floor by a bed. Budget per room by area, clutter and plainness; about
  half at d2; never before what it stands on. Flat stands on a wall's or a beam's top are lifted onto the visible top
  (mountClip).
- `lib/kitbash.js`: apply calls `dressTops` after the library and the lanes; exports `boxIndex` and `stands`;
  `placeable` passes over another stretch of the same wall line (the wall either side of a doorway counted as "past the
  end" for a piece hung on the first).
- `lib/generate.js`: round houses call `Kitbash.stands` after their decorator pass.
- `lab/test_stands.js` (measure and targets), `lab/render_stands.js` (room pictures and close-ups with items drawn as
  stand-ins; `ONLY=<regex> CLOSE=<n> CLOSE_ONLY=1`), `lab/mine_stands.js`, `data/stands-corpus.json`.
- `docs/BLUEPRINT_LAB.md`: "Items on stands" rewritten and "Stands round the house" added.

## Measures (lab/test_stands.js 3, before the last two sets; 162 designs)

House share at d3 (room share in brackets), against the corpus: table 92 % (92) vs 52; wall 100 (84) vs 79; sill 43
(23) vs 14; shelf 78 (50) vs 51; hearth 87 (57) vs 38; bench or workbench 67 (37) vs 51; rafters 33 (25) vs 38;
chest 61 (27) vs 33; feast 26 % vs 21 (homes 11, longhouses 33, taverns 33); distinct items median 26 vs 7; stands 29
vs 19. d2 roughly half of each; d1 nothing from this pass. Every d3 target met.

Checks run on the 1545946 base (before rebasing on 539a56f): `check_set.js 2` 224 of 225, 90 of 90, 147 of 147 (the
one overlap fails on main too); `test_structure.js` holds; `make_testpool.js` pool audit pass (after the lift onto
visible tops); `stages.js lib 1` d1 in d2 and d2 in d3 100 %; `check_interiors.js` every `lib/checks.js` check 0,
floating 35 designs (base 34; the one case found, a mug on a third-stage bench, fixed), overlap 2 (3); gen-test 5 of
5 byte for byte; dotnet build 0 errors. After the rebase and the last two sets only the bundles were rebuilt and
`test_stands.js 2` run; the full checks were not rerun.

## Session of 2026-11-11 (work in progress, paused for usage)

Commits on `design/wip-stands`: b2869b7 (merge of main 0604748, no conflicts; main's creative sets kept), 979ea18
(the work below, work in progress). Bundles not rebuilt or committed.

What is done (979ea18):
- `lib/stands.js` `showOf`: how much a household shows. From clutter, the collect, food and plants hobbies, wealth,
  comfort, less for tidy; times 0.35 for a plain house, 1.15 for a tavern; times the village's culture lean
  (`CULTURE_SHOW`, a setting with no corpus source, since the corpus is not split by culture); times a household draw
  (log-normal, sd 0.6). Clamped to 0.08 to 4.
- `dressTops`: a house budget of stands, `show * (4 + floor area / 6)`, shared among rooms by area, less what stands
  there already. Places the household favors (`FAV_P`, drawn per house, more kinds in a house that shows more);
  this pass leaves the other kinds alone. The decorator's single stands and stands of library sets that keep another
  piece (a ledge, a table) are taken away: 80 % of those in places the household does not favor, then more down to
  55 % of the budget. Each kind of place (`CLASS_W`, `classOf`) gets its own share of the picks, so many chest sets
  or many wall anchors no longer make it come up more. The d2 share counts stands, 40 to 65 % of a room's.
- Sunk stands: half the households (`sinker`) sink 55 to 95 % of the flat stands of this pass's table sets into the
  top. Depth is the household's habit drawn from the corpus's sink percentiles (`SINK_Q`, `sinkDepth`: 6 cm, 9.7 at
  the 75th percentile, 21.6 at the 90th, never deeper), plus or minus 1.5 cm. Each carries `p.fclip` (depth + 0.5
  cm), which `lib/blueprint.js` writes in `#VillheimClips` as the furniture depth (the e44db1e format). Found in
  `lib/audit.js`: no pool audit test looks at a flat stand inside a table (itemstandh is role deco, outside the
  furnClip pairs; mountClip only measures structure), so the mark is a record; nothing failed without it.
- `lib/persona.js` `fromStock`, `repeatOf`, `REPEAT_K`: a stand takes an item the house already shows, by
  household (0.15 to 0.95; tidy and plain more, collectors and the well-off less) and by kind (drink, herbs 1, food
  0.9, trophy 0.25; rare things, boss trophies and the tray never). `itemFrom` unchanged.
- `lab/test_stands.js`: distinct items and stands print as quartile-median-quartile.

Measures, `node lab/test_stands.js 3` (162 designs; d3 house share, distinct and stands as q1-median-q3):

| | table | wall | sill | shelf | hearth | bench | rafter | chest | feast | distinct | stands |
|---|---|---|---|---|---|---|---|---|---|---|---|
| before (b2869b7) | 92 | 100 | 46 | 63 | 85 | 72 | 35 | 61 | 19 | 26 (median) | 28 (median) |
| now (979ea18) | 68 | 94 | 2 | 48 | 63 | 46 | 24 | 30 | 17 | 3-8-13 | 5-10-19 |
| corpus | 52 | 79 | 14 | 51 | 38 | 51 | 38 | 33 | 21 | 2-7-20 | 5-19-49 |

The test's gate (`--gate`, d3 rates at or over TARGET) now fails on sill (2 % < 10) and rafter (24 % < 25).

Half done:
- Sill too low: `FAV_P.sill` 0.12 with `CLASS_W.sill` 0.22 nearly removes it; raise `FAV_P.sill` to about 0.25.
- Rafter low: raise `FAV_P.rafter` (0.35) and `CLASS_W.rafter`.
- Hearth (63) and table (68) still over: what remains is library sets of stands alone (BK-wtrophy and the like) and
  favored places; consider lower `FAV_P.hearth`.
- Stands median 10 against 19 and the top quartile 19 against 49: raise the budget constant in `dressTops`
  (`4 + area / 6`), or `showOf`'s scale.
- `lab/test_stands.js` gate still checks minimums only; change it to a band round the corpus (rate within about 0.6
  to 1.6 times the corpus, medians within half) and state it.
- D-127, D-128, D-129 Open: behavior kept (no stands into wall relief, no new tie beams, unconfirmed items as they
  were).

Not run yet on 979ea18: `node lab/test_structure.js`, the Norse Meadows pool gate (`node lab/make_testpool.js
/tmp/h2-pool`), `node lab/check_interiors.js` on a small sample.

Next steps, in order:
1. Tune `FAV_P`, `CLASS_W` and the budget as above; rerun `node lab/test_stands.js 3`.
2. Band gate in `lab/test_stands.js`.
3. Quick checks: test_structure, the Norse Meadows pool gate, check_interiors on a small sample; compare with the
   numbers in "Measures" above for the base.
4. Then the next task: side tables and nightstands as their own anchors, stands on stands (745 in the corpus),
   "Items on stands" with credits in `docs/INTERIOR_DESIGN.md`.

## Known problems

- Wall sets fit poorly: stands into the 2x2 wood wall's planks and the stone wall's bevels fail the audit's hung test
  (about 9 in 10 tries); multi-stand wall sets rarely fit, single stands and the decorator's wall pass carry the wall
  rate. Corpus builders hang trophies into stone; the audit (T-606, T-612) forbids it.
- Few generated rooms have a tie beam across them, so "rafters" are mostly a beam or ledge high on a wall; the miner
  calls a ledge a shelf, so `lab/test_stands.js` counts any flat stand over 2.2 m on a shelf as rafters.
- Openings without a window piece read as counters to the miner; the test counts `KS-sill` stands as sills.
- The renderer has no item models; `lab/render_stands.js` draws stand-ins. The renders were checked for placement
  only.
- Items not yet seen on a stand in the game: the Deep North IDs, `Feaster`, `DvergrKey`, `YagluthDrop`,
  `Lingondricka`, `OatMilk`. `StandItems.cs` leaves a stand empty when CanAttach refuses.
- Stands at sinks (hidden in a table top) are not used yet.
- The shelf, hearth and chest rates are over the corpus; tidy households could take fewer.

## Next steps

1. `git fetch origin main && git rebase origin/main` on `design/wip-stands`; keep the library-first helper's decorOk
   and itemFrom biome rule and build on it; rebuild `src/Villheim.Logic/Generator/lab.js` and `web/index.html`.
2. Run the full checks (from `tools/blueprint-lab`): `node lab/check_set.js 2`, `node lab/test_structure.js`,
   `node lab/check_interiors.js`, `node lab/make_testpool.js /tmp/stands-pool` (pool audit pass), `node lab/stages.js
   lib 1`, `node lab/test_stands.js 3 --gate`, `node lib/build_engine.js`, `node lib/build_web.js web/index.html`,
   `VH_GEN_OUT=/tmp/stands-gen tools/gen-test/run.sh` from the repo root, `dotnet build Villheim.sln -c Release`.
3. More single and clustered flat-stand arrangements (the main body of the work): stands sunk into table tops
   (corpus sink), clusters on counters and the decorator's shelves, side tables and nightstands as their own anchor,
   stands on stands (745 in the corpus).
4. Credit the source builds and write "Items on stands" in `docs/INTERIOR_DESIGN.md`; daily note section and an Index
   line, `docs/SESSION_HISTORY.md` and `docs/ROADMAP.md` lines.
5. Merge to main and `design/kitbash` fast-forward.
6. For Tyler's Decisions tab: whether wall stands may clip into stone or plank walls the way corpus builders do (the
   audit forbids it now), and whether generated rooms should get tie beams for things hung from rafters.

## Session of 2026-11-11, part 2 (stand shares by place)

Branch `design/wip-stands`. Bundles not rebuilt or committed. Not tried in the game.

### What the targets are now

- Tyler, 2026-11-10 (through the lead): "I rarely see stands on rafters. I sometimes see stands on sills. I constantly
  see stands on tables." D-136 (Tyler): "targets should never come from my words. Targets across the entire corpus
  should come only from what's observed and learned." D-127 answered A (wall stands may clip into wall relief as
  corpus builders do, marked as D-098 clips). D-128: tie beams only in halls, taverns and large houses (another
  track). D-129 answered A (keep the unconfirmed items).
- The main measure in `lab/test_stands.js` is now the share of a house's stands by place, from
  `data/stands-corpus.json` `anchors` (stands holding something, inside). Flat stands (10,940): floor 2,080, shelf
  1,858, table 1,629, ledge 1,123, mantel 1,019, on another stand 745, none 606, other 476, counter 360, bench 218,
  wallside 201, rafter 191, sill 187, walltop 84, chest 58, stair 41, workbench 32, hung 18, bed 14. Wall stands
  (4,787): wall 757, beam 648, over a workbench 578, by the hearth 558, rafter 533, free 447, over a chest 333, over a
  table 328, over a bed 208, by a door 175, over a bench 141, furnside 54, ceiling 16, laid 6, chestside 5. `inst`: 20 %
  of tables carry a stand, 0.4 % of windows.
- Shares are of the stands at the places this pass makes. Flat groups and corpus shares: table (table, sidetable)
  24.1 %, shelf (shelf, ledge) 44.1, mantel 15.1, counter (counter, walltop) 6.6, bench (bench, workbench) 3.7, sill
  2.8, rafter 2.8, chest 0.9. Wall groups: wall (wall, beam) 33.0, station (over a workbench or bench) 16.9, hearth
  13.1, rafter 12.5, chest 7.8, table 7.7, bed 4.9, door 4.1. Floor, on another stand, none, other, wallside, stair,
  hung and bed (flat) and free, furnside, ceiling, laid, chestside (wall) are left out of the base and reported apart.
- The gate (`--gate`), d3 houses: each share from 0.6 to 1.6 times the corpus share and never tighter than 2 points
  either side; flat stands 50 to 80 % of all stands (corpus 70 % in stands-corpus.json, 50 to 72 % by culture in the
  research branch's `culture-corpus/summary.json` rel.standsHorizontal); each quartile and the median of stands and of
  distinct items per house from half to 1.5 times the corpus's (stands 5, 19, 49; distinct 2, 7, 20). Not gated
  (reported): flat sill and rafter, wall rafter, for the reasons under "Held outside this pass".
- The house shares (a house with at least one stand at a place: rafter 38 %, sill 14 % and so on) are reported only.
  The relabel of flat stands on a shelf over 2.2 m as "rafter" is gone; the count is printed apart (101 at d3). Sill
  sets read by the miner as counter or shelf are printed apart too (59 at d3). The test also prints the share of
  tables, fires, beds, benches, chests and windows with a stand, sunk flat stands as the miner reads them (over 6 cm
  into what they stand on), and the stands median for the third of houses that show least and the third that show
  most (from the household's clutter, collect hobby, tidiness and plainness). `--d3` runs the d3 requests only with the
  same seeds.

### What the miner's floor, stand and other places are (lab/mine_stands.js, read from the code and the counts)

- "floor" (2,080 flat stands): the highest top under the stand is a floor piece and the stand is less than 12 cm over
  the room's floor, so these stand on the floor. They hold drink 665, food 432, herbs 277, rare things 225, weapons 116,
  trophies 90, hats 72 (`anchorKinds`); groups on the floor include four drinks (16), two rare things (13), three
  drinks (11), three foods (10), two hats (10). A rug is passed through (`pass`), so a stand on a rug reads as floor.
  How many builds the floor stands come from is not in the committed data; a corpus rerun on the device can give it.
- "stand" (745): the top under it is another item stand, a stand set on a stand. Not made by this pass yet (next task).
- "none" (606) and the chest count: `SH.topAt` gives the chest's collider top far under its box (piece_chest_wood
  0.21 m against a box top of 0.79, piece_chest 0.30 against 1.09), so a flat stand on a chest lid finds nothing under
  it and reads as "none". This pass's chest sets read that way too (40 of 46 KS chest stands at d3 before this
  session). So the corpus's chest share (0.5 %) and window share are low, and part of "none" is stands on chests. The
  corpus counts stay as mined; fixing the miner needs a rerun of the corpus on the device.
- Wall stand places: the miner reaches furniture "under" a wall stand through the 2 m grid cells of `lib/checks.js`
  index, so a table or a bed up to about 3 m away counts. `lib/stands.js wallAtS` now reads a wall stand's place the
  same way (40 of 41 wall stands agree with the miner over 9 d3 designs).

### What changed (lib/stands.js, lib/persona.js, lab/test_stands.js)

- `CLASS_W` (each kind of place's share of this pass's picks): table 1.6, wall 1.1, shelf 0.8, bench 0.45, hearth 0.3,
  rafter 0.22, chest 0.3, sill 1.1, floor 0.15. Tables get the largest share since the library and the decorator
  already put up most shelf, mantel and wall stands.
- `FAV_P` (the chance a household puts things at a place): table 0.7, wall 0.65, shelf 0.5, bench 0.4, hearth 0.25,
  rafter 0.2, chest 0.25, sill 0.45, floor 0.25, each times `favLean` (the household's traits: likes.sill for sills,
  likes.hung for rafters and walls, likes.shelves, the food and games hobbies for tables, crafts for benches, comfort
  for the hearth, clutter for chests), then more places for a house that shows more, as before.
- `CTX_W` (this pass's wall spots by what is under them): plain 0.9, workbench 0.5, hearth 0.4, chest 0.35, bench
  0.3, door 0.3, table 0.15, bed 0.1. Wall spots are read with `wallAtS` (the miner's reading) in place of the old
  `wallContext`, which is removed.
- Budget `show * (6 + floor area / 3.5)` (was `4 + area / 6`); `showOf` scale 0.8 (was 0.7) and household draw
  log-normal sd 0.7 (was 0.6). The budget is seldom what stops a house: most rooms run out of places that take a set
  (tables already set by the library, wall sets refused by the fitter).
- D-127: every wall stand of a KS wall set may go up to 12 cm into what shows of the wall (`WALL_SHOW`, the set's
  `clips`; the fitter keeps the depth used as `p.wclip`, written in `#VillheimClips`), and `dressTops` refuses a set
  whose wall stand goes more than 4 cm into a collider (`WALL_COLL`, `intoCollider`). Corpus: 4,318 wall stands go 0 cm
  into the collider behind them up to the 75th percentile and 4 cm at the 90th (`clips`). Hung against the collider,
  the generator's walls need 4 to 11 cm into what shows (measured over the d3 houses). Ledges (`wood_ledge`) get no
  allowance: the corpus has no depth measure for them.
- Sinking: a sinking household (half of them) now also sinks the flat stands already on its tables (the library's and
  the decorator's) whose foot is within 3 cm of the table's collider top, the same share and depth as its own sets,
  each marked `p.fclip`.
- `lib/persona.js`: `repeatOf` base 0.7 (was 0.45), floor 0.25; `REPEAT_K` weapon 0.5, farm 0.45, tool 0.45, trophy
  0.4 (were 0.4, 0.4, 0.3, 0.25).

### The removal pass (dressTops, before this pass places anything)

This pass takes away stands put up earlier by the decorator (`p.decor`, no `p.kb`, not trim) and by the interior
library (`p.kb` not `KS-`). Exactly:
1. Each decorator stand, and each stand of a library set that also holds another piece (a ledge, a table, a candle),
   at a kind of place the household does not favor (`fav`, read with persona `standAt`) goes with chance
   `0.9 - 0.45 * show`, between 0 and 0.85 (was a fixed 0.8). The set's other pieces stay.
2. Then more of those, in random order with favored places last, until the stands up are at most `keep = 0.4 *
   budget` (was 0.55).
3. Then, if still over `keep`, whole library sets made only of stands (a pair of trophies, a row of shields), in
   random order. In the d3 run with `keep` at 0.55 this step changed no measure.
4. New: wall stands (decorator and library) over a bed, a table, a chest, a workbench or bench, by the hearth or a
   door (read with `wallAtS`), past `floor(wall stands in the house * WALL_SHARE * (1.2 to 1.8) + R)`: the extras go, a
   whole library set at a time, the decorator's one by one. `WALL_SHARE` is the corpus share of wall stands at that
   place among those at a known place (bed 208 of 4,259, table 328, chest 333, workbench 578, bench 141, hearth 558,
   door 175).
Measured without step 1 (`dropP` 0): the per-place shares stayed within a point or two; the stands quartiles rose to
8-15-30 and distinct items to 5-11-18 (both over the band at q1). So steps 1 and 2 are what keeps the low end of the
corpus spread; step 4 is what brings wall stands over tables and beds down (table 22.5 % to 14.2, bed 15.6 to 11.4).
The lead puts the question to Tyler.

### Measures, `node lab/test_stands.js 3` (d3, 54 houses; base = 979ea18 read with the new test)

| flat % | table | shelf | mantel | counter | bench | sill | rafter | chest | n |
|---|---|---|---|---|---|---|---|---|---|
| base | 23.9 | 48.2 | 20.0 | 1.6 | 3.9 | 0.0 | 0.2 | 2.1 | 485 |
| now | 28.4 | 43.0 | 21.0 | 2.8 | 3.5 | 0.0 | 0.0 | 1.3 | 761 |
| corpus | 24.1 | 44.1 | 15.1 | 6.6 | 3.7 | 2.8 | 2.8 | 0.9 | |

| wall % | wall | station | hearth | rafter | chest | table | bed | door | n |
|---|---|---|---|---|---|---|---|---|---|
| base | 13.4 | 20.3 | 17.0 | 0.0 | 9.1 | 22.5 | 15.6 | 2.2 | 276 |
| now | 24.4 | 25.6 | 12.2 | 0.0 | 10.2 | 14.2 | 11.4 | 2.0 | 254 |
| corpus | 33.0 | 16.9 | 13.1 | 12.5 | 7.8 | 7.7 | 4.9 | 4.1 | |

Per house at d3: stands q1-median-q3 5-10-19 (base) to 6-14-27 (corpus 5-19-49); distinct items 3-8-13 to 4-8-13
(corpus 2-7-20); flat stands 65 % to 77 % (corpus 70); sunk as the miner reads it 13 % (corpus 32 %; base not measured
this way); stands median for the third of households that show least and most 6 / 11 (base) to 8 / 20 (homes 6 / 24,
taverns 33 / 35, longhouses 8 / 4). Wall stands into what shows of the wall: 46 % of 257, 75th and 90th percentile 9
and 11 cm; into the collider behind, as the miner reads it, 0 cm at every percentile.

Gate result (`--gate`, exit 1): outside the band at d3: flat counter 2.8 % (band 3.9 to 10.5), wall table 14.2 %
(4.6 to 12.3), wall bed 11.4 % (2.9 to 7.8), wall door 2.0 % (2.1 to 6.6), distinct q1 4 (1 to 3). Inside: every other
share, flat share, stands q1, median and q3, distinct median and q3. With 54 d3 houses a share moves a point or two
between seeds.

### Held outside this pass

- Sills: the miner reads a stand as on a sill only under a window piece (`WINDOWISH`); most generated openings have
  none, so the sill sets read as counter or shelf (59 stands at d3).
- Rafters: flat and wall stands on beams over 2.3 m need beams there (tie beams, D-128, another track). The pool
  audit also keeps a wall stand's middle at 0.7 to 2.4 m over its floor (`lib/audit.js` `MID.itemstand`), while the
  corpus's wall stands on beams over 2.3 m sit at a median 2.96 m (`heights` itemstand|rafter: 2.42, 2.71, 2.96, 3.33,
  3.8) and over a bed at 2.85. By D-127 that audit limit is the thing to change; it is the library-first helper's file
  and is not changed here.
- Wall stands over tables and beds: most are now this pass's own; the miner's 2 m grid reach reads many spots in
  small generated rooms as over a table or a bed.

### Checks run (this session, from tools/blueprint-lab)

- `node lab/test_structure.js`: all structure rules hold on 36 designs.
- `node lab/make_testpool.js /tmp/h2-pool` (Norse Meadows): pool audit pass (81 designs); richness prefabsPerD3 11.4,
  setShare 0.502, corpusSetsPerD3 1.44; watched outside 11, intoWallSoft 192. Base (979ea18, same command): pass, 11.5,
  0.509, 1.48, outside 11, intoWallSoft 192.
- `node lab/check_interiors.js lib /tmp/h2-ci.json 1` (234 designs): every `lib/checks.js` check 0; floating 14
  designs (52 problems), door 1, stairs 1, bareFloors 1, overlap 0; d3 49.1 pieces of furniture. Base, same command:
  the same counts, d3 47.2.
- Not run: check_set, stages, gen-test, dotnet build, bundles (integration step).

### Changes in other tracks' files

None.

### Next task

1. Side tables and nightstands as anchors of their own (the miner's "sidetable", area under 1 m²).
2. Stands on stands (745 flat stands in the corpus stand on another stand).
3. Floor stands (19 % of flat stands): first a corpus rerun on the device for how many builds they come from, then
   decide with the counts.
4. Fix the miner's chest top (collider top far under the lid) and rerun the corpus, so chest and "none" shares are
   right.
5. "Items on stands" with credits for the builds read (list under "The corpus mining") in `docs/INTERIOR_DESIGN.md`.

### Proposed Decisions rows

- The removal pass above (steps 1 to 4): may the stand pass take away the decorator's and the library's stands to
  keep the corpus's spread and place shares? Options: A keep as is; B only step 4 (place shares); C none. Recommended
  A. In use until answered: A.
- The pool audit's wall stand height (`lib/audit.js` MID itemstand 0.7 to 2.4 m) against the corpus's wall stands
  (over a bed median 2.85 m, on beams over 2.3 m median 2.96): raise it to the corpus's 90th percentile (3.8 m) for the
  library-first track to make under D-127? Recommended yes.
