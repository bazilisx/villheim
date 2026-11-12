# Track D, shell and space: record (2026-11-12)

Branch `design/wip-shell` (from main b18cf36, main merged at 2e607cf and f70fa23). Files: `lib/generate.js`,
`lib/hub.js`, `lib/details.js`, `lib/checks.js`, `lib/yards.js` (the yard's ground only), `lib/build_engine.js` and
`lib/build_web.js` (program.js in the bundles), `lib/request.js` (one call site), `lab/test_structure.js`,
`lab/test_hub.js`, new `lab/shell_mine.js`. Criteria: `criteria/shell.md`.

## Findings by principle

Each principle lists Tyler's example as one instance, the other places found, the fix and the check.

### 1. Every piece rests on what holds it, by the game's own rule

- The game's rule (WearNTear.UpdateSupport, decompiled 2026-11-12): a piece takes the best of each touching piece's
  support less its own material's loss times the distance between pivots (plus 0.1 m); horizontal loss from any
  touching piece, blended toward vertical by how steeply down the contact lies; two contacts 100 degrees apart give the
  mean of their vertical values. The lab's old rule had no distance term and never took support from above, so it held
  things the game drops.
- Instances: the Meadows s5 hub (57 pieces fall: ridge caps 7 to 9 where wood needs 10, valleys, and the gallery's
  wood fences set 0.6 m over the floor touching nothing); Plains and Black Forest hubs (52, 26); round towers' crowns;
  a ridge carving's beam over a lower annex; a grausten partition on an ash floor; crannog deck rail beams with no post.
- Fixes: `propUp` (generate.js, used by every building and the hub) puts core wood post columns under what would fall,
  in rows, clear of fire, stairs, doors, galleries and the high seat; rails need a post on the floor; partitions are
  timber; no carving over an annex. Check: `game support`.
- Numbers: showcase hubs 57, 52, 26 falling pieces before; 1, 1, 0 now. Pool of 63 (every type and biome, s3): 5
  before, 5 now (round towers' crowns over weak top floors: a 13 m wood tower's top floor holds about 20).

### 2. Every place people walk is two floor pieces wide (Tyler's hard rule)

- Instances: one-cell wings (05, 10, 16), the court home (08, 3 m clear between 1 m stone walls), balconies one piece
  out (12), loggias, stilt decks, crannog decks and boardwalks one piece, the hub s4 gallery one row.
- Fixes: wings never under three cells; loggia two rows; decks 4 m; boardwalk two pieces; balcony two by two on posts;
  courts four cells deep with a two-cell arcade walk (20 m square, 24 m for an s3 hall); s4 hub gallery two rows.
- Check: `passages` (floor under a roof between walls on three sides, and raised floors; walls at their middle line,
  stairs as they stand). Pool of 63: 28 before, 6 now. Listed (not failed) in the tests: hub galleries of round lines,
  temple aisles, flat-roof stair huts.

### 3. Doorways clear from floor to door height, stepped to the ground (D-096)

- Cause of showcase 11: the mod sets a design's lowest pivot on the terrain (`Designs/Blueprints.cs` Center). A stone
  hearth floor half in the ground (-0.4 m) or a bush set into it (-0.49 m) lifts the house; the doorstep beams laid 5 cm
  over the floor (2026-11-09) then stood 0.6 m over the ground outside: a log across the doorway. Other instances: dark
  wood band beams 0.25 m too high (a 0.35 m kerb in upper doorways), yards laid on a footing's middle a metre over the
  ground the game uses (Ashlands).
- Fixes: `doorSteps` lays treads of beams 0.3 m apart from each outside door down to that ground; yards read the
  footed lowest pivot; dark beams placed by their snap line. Check: `doorways`. Pool: 18 before, 0 now.

### 4. Pieces placed by their real geometry (snap points and colliders, not the wood piece's convention)

- Instances: darkwood_beam's line is 0.25 m over its pivot (the bar's top beam hovered over its half walls, showcase
  06; door kerbs), darkwood_beam_26 0.25 m under, crossed boards a metre under the bargeboards' line (13), crossed boards
  lifted 0.6 m with the smoke caps (09), standing torches 0.1 m over the floor, ceiling braziers hung for 3 m rooms.
- Fixes: PIVOT_SHIFT from the snap points (kit by kit: poles, 45 degree beams, roofs, caps and corners match); crossed
  boards at the cap's height, collinear with the bargeboards (corpus: 1,881 of 5,042 in-plane 45 degree beams on the
  boards' line, nearly all the rest 2 m off; cap at the cross's pivot height 958 times, next 142 at 2 m); lifted caps
  leave crossed boards; braziers hang 1.6 m under what is over them, torches stand 0.653 m under their pivot.
  Check: `crossed boards`. Pool: 10 before, 0 now.

### 5. Walls meet the roof; roofs close

- Instances: a triangle of sky under every ridge cap at the gable apex (a 45 degree cap's underside is 0.86 m over its
  pivot at the middle; showcases 03, 15, and every gable), the L and T wings 2 m apart crossing the ridge from both sides
  (09: "shifted left 5 feet").
- Fixes: a 1 m square piece on every gable apex up into the cap; cross wings share a middle line or stand a bay apart
  (`crossLined`). Checks: `wall tops` (pool 29 before, 5 now), `roof holes` (listed; a well's shaft and a dome top read
  as holes). Open: the part round hub's straight front under its ring roof (18 gaps on showcase 03).

### 6. Railings are posts and beams; the pasture fence stays outside (D-164)

- Instances: hub galleries (01, 02), tower lookouts (14), loft edges, crannog decks. Corpus railing pieces by builds:
  wood_beam 747, wood_pole 593, wood_pole2 547, wood_wall_half 537, wood_beam_1 504; wood_fence not in the top 40.
- Fix: `railing` (generate.js) and the hub's `rail`. Check: `railings` (indoors means between walls). Pool 18, now 0.

### 7. One masonry family in a wall

- Instances: every grausten wall took stone_wall_2x1 for a metre left over (under windows, over 3 m storeys) and as
  the stone-base course (15, 16). Corpus: stone and grausten mixed in 150 of 1,001 masonry builds, mostly big castles.
- Fix: a 2 m footing course of the wall's own family, a metre left over is timber and the bay stays timber above.
  Check: `masonry`. Pool 8, now 0.

### 8. Plants on raised surfaces are ones the game holds; planters as the mockup, by program

- The game's StaticPhysics (decompiled; prefabs read on Tyler's PC) drops Pickable_Dandelion, Onion, Thistle, Carrot,
  Turnip, Mushroom, Vineberry and the berry and heath bushes to the terrain 20 s after load. Pickable_Fiddlehead settles
  on solids; vines, shrub_2, yellow and blue mushrooms, FirTree_small and Beech_small1 stay. Pool: 18 designs had
  dropped plants up high, now 0. Check: `plants held`.
- `planter()` builds Tyler's mockup lined up on the light; `planterSurfaces(b)` and `PLANTS_HOLD` are for track E;
  `ctx.planterWindows` and `ctx.plantPlanter` are its hooks. Windows chosen by the building program's front run (D-165,
  D-167).
- For track H: `program.js` lists Pickable_Dandelion and Pickable_Thistle as planter plants; the game drops both.
  details.js falls back to a held plant.

### 9. Height and size from the corpus

- One-storey s3 walls are 4 m (corpus one-storey eaves 5 m at the quartile for homes, 6.5 workshops, 6 storehouses);
  showcase 07 eave 3 to 4 m, 08 now 4 m with a 20 m court.

## Commits (design/wip-shell)

d00980c checks; 692215b hub posts, rails, galleries; 569dfea rails; 73bc81b walks and heights; 63ac089 dark beams;
f9db29b door steps; 9327f3e crossed boards; e63b3d0 masonry; cf977ed yard ground; f9a6a14 planters; 4707769 cross wings, roof
holes; 2c56a89 gable apex, wall tops; ffc4805 posts everywhere, partitions, dark 26 beam; 63b25b4 merge main, braziers;
bdc01bd program wiring; 1a4d7bd ranking leaves the shell checks out.

## Checks run (last)

- `node lab/test_structure.js`: all structure rules hold on 36 designs plus the 16 showcase designs; listed: 27
  (passages, roof holes, wall tops, hub game support).
- `node lab/test_hub.js`: no hard failure outside the listed checks; listed 50 hub designs with pieces the game drops
  (1 to 78 each, round and part lines mostly) and 163 with narrow walks.
- `tools/gen-test/run.sh`: 5 of 5 the same byte for byte; request 2 155 s in the engine (with the shell checks in the
  ranking it passed the 4 minute limit).
- Showcase table (before, now) for game support, passages, doorways, railings, masonry, plants held, crossed boards,
  wall tops, roof holes: every house passes all but 06 (one 6.6 m2 upper walk) and 08 (rooftop stair hut walk, court
  well read as a roof hole); hubs 01 and 02 one falling piece each, narrow galleries; 03 the part front's wall tops.

## Changes in other tracks' files

- `lib/yards.js` survey: minY reads pieces at their foot (one function line).
- `lib/request.js` evaluate: `check(d, biome, { shell: false })`.
- `lib/details.js` and `lib/generate.js` call `lib/program.js` (track H) for planters and corners.

## Open

- Hubs: 50 test_hub designs still drop pieces (round and part lines, tie beams at the high seat); galleries of round
  lines one row; the part hub's front under its ring roof.
- Round towers over 12 m: top floors hold about 20; posts there do not save the crown. Iron or core wood posts from
  the ground, or a lower crown.
- The mod's ground contract (principle 3): decision row below.
- program.js call sites 2, 3 and 6 (wall rhythm per line, windows dressed per run, door dressing) not wired.

## Proposed Decisions rows

- D-xxx: the mod sets a design's lowest pivot on the terrain, the lab treats y = 0 as the ground. Sunk pieces lift
  houses up to 1 m in the game (yards, steps). A: the mod keeps generated designs at their own y = 0 (write
  `#GroundOffset` and apply it in Spawn and BuildHeld); B: the lab never puts a pivot under 0. Recommend A.
- D-xxx: tall timber towers and the widest hub roofs cannot hold their crowns by the game's rule. A: core wood or iron
  posts from the ground in towers over 9 m and hubs; B: cap tower height by material. Recommend A.
