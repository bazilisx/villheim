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
