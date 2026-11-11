# Handoff: hearths, smoke outlets and lights (design helper, 2026-11-10)

Branch `design/wip-hearths` (work in progress, not merged to main). Base: main at 539a56f, with the work rebased on
it. Lab code in `tools/blueprint-lab`; nothing in `src/Villheim` or `src/Villheim.Logic/Village` was changed.

## Tyler's request (2026-11-10)

"focusing on different uses of lighting elements (wall, ceiling, floor etc) where necessary, and finding ways to have
firepits not always centered in the room. Firepits (and chimneys) in alcoves or partially in the wall with chimneys etc
are more common than firepits in the middle of the floor that disrupt the flow of the room. Only firepits and hearths
in social environments where folks gather around. In homes, it's much more common for them to be along walls or built
into chimneys or hearths on the wall that funnel smoke outward. This, obviously, may have big impacts on where you place
roof elements like ventilation holes etc. too so this is obviously a bigger job."

Rule correction from Tyler (relayed by the coordinator, 2026-11-10): decor has no biome limit and no quantity limit;
decor may come from any biome; build pieces (walls, roofs and the like) come mostly from the village's biome and its
neighbors, never Ashlands grausten in the Meadows. So lights and the fire's dressing may come from any biome; the
chimney, the hearth surround and any walls or roof pieces follow the village biome and neighbors, with D-012 (stone
later in Meadows and Black Forest). No fixed light counts per room.

## Game facts (valheim.weirdgloop.org, read 2026-11-10)

- Smoke: made by the campfire, bonfire, hearth, hanging brazier, smelter, blast furnace, charcoal kiln and hot tub, only
  with a player within 64 m. Each puff is 0.42 m in radius and needs about 1 m of space to pass; it rises at 0.75 m/s,
  drifts sideways at 0.15 m/s, catches on corners, and fades after 60 s; at most 100 puffs. Standing in smoke gives the
  Smoked effect (damage over time; the Campfire page gives 2 hp a tick). "Chimneys are not needed if enough space is
  provided for the smoke"; about 4 x 2 x 2 m of room 0.75 m above a structure holds its smoke. Beams can block smoke.
  Smelters and kilns stop if they cannot make smoke for 4 s.
- Campfire: 5 stone and 2 wood, no station. Hearth: 15 stone, stonecutter, 4 x 3 m, must stand on stone, the ground or
  supported wood. Both are not damaged by rain but stop burning in rain without a roof, and in strong wind without 70 %
  cover. Hearth comfort 2 when sheltered within 8 m.
- Hanging brazier: forge, bronze 5, coal 2, chain 1; burns coal; makes smoke; hangs 2 to 6 m off the ground; stops in
  rain without a roof.
- Sconce: forge, wood 2, copper 2, resin 2; resin fuel; not put out by rain; turns off unless 1 m below a ceiling.
- Standing wood torch: workbench, wood 2, resin 2; resin fuel; not damaged by rain.
- Resin candle: workbench, resin and a candle wick; 4 h 10 m and cannot be refueled; rain puts the flame out.
- Stone oven: artisan table, iron 15, stone 20, surtling core 4; makes smoke; 3 x 2 m.
- Dvergr wall and pole lanterns are building pieces; the Dvergr lantern item comes from the black forge.
- The mod (read, not changed): `src/Villheim.Logic/Designs/DesignSpawner.cs` fills a spawned fire to max fuel and
  `KeepLitPatch` keeps it full. Nothing in the mod handles blocked smoke or rain: a village fire under a closed roof or
  open to the rain would go out in the game. The lab's shafts all have a cap and at least 1 m clear (see below).

Prefab sizes from `data/piece-models.json` (collider): fire_pit 1.4 x 0.2 x 1.4; fire_pit_iron 1.27 x 1.2; hearth
4 x 0.58 x 3; piece_oven 3 x 2.37 x 2; piece_brazierceiling01 bowl 0.97 x 0.22 hanging about 2 m under its pivot;
piece_brazierfloor01 0.75 wide, pivot at its top; piece_walltorch 0.45 x 0.95 x 0.31; piece_groundtorch 0.23 x 1.48;
piece_dvergr_lantern reaches 1.1 m out from the wall; piece_dvergr_lantern_pole 3 m; deepnorth_lantern_standing 3 m;
piece_hoodedlantern 0.36 x 0.65; Candle_resin has no collider.

## Corpus mining

- Corpus: Tyler's PC, connected folder `C:\Users\tyler\Downloads`, subfolder `Villheim-blueprints` (2,153 blueprints
  in category folders; `index.json` holds titles and creators). The BiomeBlueprints pack is not in it; the miner also
  skips any `hs_` file and any path with BiomeBlueprints or OverDrive in it. The r2modman profile `Villheim Test` has
  only Tyler's board and generated builds.
- How it was run: the remote device shell (`mcp__remote-devices__device_bash`) has node 22. A folder `$HOME/vhfire` there
  holds copies of `lib/pieces.js`, `checks.js`, `shapes.js`, `mesh.js`, `blueprint.js` and `data/piece-*.json` and the
  miner. Each call may run 180 s at most and background processes are stopped when the call ends, so run it in the
  foreground: `cd $HOME/vhfire && timeout 170 node fire_mine.js lib out.json "$HOME/mnt/Downloads/Villheim-blueprints"`
  (about 160 s). Files go to the device by `echo <base64> | base64 -d > file`.
- Scripts (committed in `tools/blueprint-lab/lab/hearths/`): `fire_mine.js` (turns each build to its walls' axis, casts
  16 rays from each fire at 0.4 and 0.9 m to find the walls round it, classes it middle, near-wall, wall, corner,
  alcove or in-wall, measures the room it serves from 2.5 m in front of it, looks over it for what blocks the smoke,
  and records stone, beams, pots, woodpiles, seats and lights round it; records every indoor light with its height,
  kind and distance to doors, beds, tables and fires); `fire_stats.js` (tables from its output).
- Derived measurements (no community files): `tools/blueprint-lab/lab/hearths/corpus-hearths-lights.json`.

Findings (1,663 vanilla builds, 3,434 fires, 1,647 indoors):

- Home main fire (one per build, 291 homes): middle 16 %, against a wall 15 %, corner 11 %, alcove 34 %, half in the
  wall 24 %. Homes under 120 m2: 92 % against a wall in one of these ways. Halls and taverns in rooms over 80 m2: middle
  32 %, half in the wall 29 %, against a wall 16 %, alcove 16 %.
- Smoke over home wall fires (443): a gap within 1.5 m 48 %, a gap 2 to 4 m away 20 %, a shaft (walls round an open
  column) 13 %, a roof hole 9 %, a stone stack past the roof 3 %, closed 5 %. Middle home fires (86): gap 49 %, roof hole
  20 %, closed 15 %. Castles: stone stack 22 %, open sky 21 %, shaft 17 %.
- Round a home wall fire: four or more stone pieces within 1.5 m 55 %, a beam over or beside it 77 % (wall tops count),
  stone overhead 5 %, wood overhead 10 %, a pot or spit 67 %, stone floor under it 36 %, a woodpile within 3.5 m 7 %,
  raised 5 %, the hearth piece 54 %; a median of one seat within 4 m.
- Lights indoors (18,380): wall 51 % (sconces 60 %, Dvergr wall lanterns 40 %), floor 33 %, candles and small lanterns
  12 %, hanging 4 % (hanging braziers 88 %). Per 10 m2 of covered floor, median to upper quartile: homes 0.10 to 0.22,
  halls 0.10 to 0.22, taverns 0.20 to 0.33, temples 0.18 to 0.38. Builds using each kind: homes wall 50 %, hanging 14 %,
  floor 39 %, candles 16 %; taverns wall 83 %, hanging 29 %, candles 35 %. 70 % of homes under 60 m2 have no light.
- Where lights stand: 14 % of sconces and 20 % of Dvergr wall lanterns within 1.5 m of a door; candles on a table 17 %,
  within 1.5 m of one 29 %, by a bed 15 %; any light within 3 m of a fire 2 to 4 %. Sconce foot 1.4 to 3.8 m over the
  floor (median 2.3). Wall lights on one floor: nearest other one 1.7 to 5.9 m (median 3.9), spread 0.28 of that.
- Source builds (titles and creators from `index.json`): "A teeny house for a friendly family of 4 Vikings" and "Cute
  cozy house" by PUP, "The Safehouse" by LordCainhurst, "Custom Grausten Fireplace (Smokeless)" by Bri Games, "Hermits
  Mountain Hut" by Fluffy-n-Dana, "Beginner Cabin" by Abzul, "Tiny home challenge, Part 1" by SorchaAzura, "Artistic
  medieval house No. 2" by Alexlucker, "Simple Start Base" by Deguinho, "New Year, New Home" by kinesthesia, "Modern
  Starter House" by MADZO. Credited in `docs/INTERIOR_DESIGN.md`, "Hearths and lights in the corpus".

## What is built (on the branch)

`lib/generate.js`:
- `HEARTHS` (weights per culture) and `hearthPlan`: a home under a gable or hip roof gets 'middle', 'end' (gable end
  under the ridge, a plank hood from 2.55 m with mantel beams, the shaft up to the raised ridge cap and rake cap), 'side'
  (back wall, or the front wall for the Slavic stove corner by the door: a shaft out through the lowest roof row and the
  eave, a plank lid on posts) or 'stack' (an end hearth rebuilt in stone from s2 where stone is allowed: the gable's
  middle bay opened 1.8 m under a lintel, the fire in a stone alcove outside, a hollow stack with shoulders, a 2 x 2 m
  firebox narrowing to a 1 x 2 m flue, a plank lid on four posts). Drawn from the lineage, so the fire keeps its place
  over stages; the end is the one the house does not grow toward (`massingPath` records `fam.growSide`). Fallbacks: the
  other wall at that end, the end, any back-wall bay, then the front, then the middle.
- `hearthStack`, `takeOut` (removes pieces and their keys so they can be put back), `HOOD` (2.55 m).
- `chimney()` handles the 'slope' kind and hood mantels; `settle()` handles 'slope' and 'stack' vents, keeps one pot
  on the fire, turns a hearth against a wall into a fire pit, closes the roof again when no fire is laid, and keeps
  lights and fire dressing by `P.decorOk` (the shared decor rule).
- Windows are left out of the bay behind a wall hearth on every storey; ladders and stairs keep off its cell; the
  balcony, woodshed and ridge carvings keep to the other end; dormers keep off a side shaft's slope; the decorative
  `chimneyStack` goes only on middle-fire homes. Flat-roof homes put the fire in a wall cell by the culture's odds.
  `req.hearth: 'middle'` gives the old way. `info.hearth` names the spot.

`lib/details.js`: the back room (`partition`) never takes the hearth's end; the fire kerb goes on open sides only and
not on a stack hearth.

`lib/decorate.js`: `placeLights` rewritten: one light at a time at the best scored spot (darkness from the nearest light
or fire, purpose: by the way in, a bed, a table or bench, weighted per room), never within 3 m of a fire, sconces at the
household's 1.6 to 2.0 m, an optional hanging brazier (halls 35 %, d3 homes 20 %); `lightCount` from the corpus rates
per room kind, more at d3, the household's liking for lights and the culture's taste, less half a light with a fire;
`lightStream`: lights draw from their own random stream per room; `lightOk` and the kit's light picks follow
`P.decorOk`, own-biome lights twice as likely.

Docs: `docs/BLUEPRINT_LAB.md` ("Hearths and light", the "Fires sit under the smoke" rule), `docs/INTERIOR_DESIGN.md`
("Hearths and lights in the corpus").

## Measures on the branch

- Before the rebase onto 539a56f: `lab/check_set.js 2` 224 of 225, 90 of 90, 147 of 147 (the one fail is the temple
  overlap main also has); `lab/test_structure.js` holds; `lab/make_testpool.js` pool audit pass. After the rebase:
  `test_structure.js` holds; 144 single-seed homes over the village cultures pass as main does (the two failures are
  main's); `check_set` and `check_interiors` were not rerun (stopped at the wrap-up). `tools/gen-test/run.sh` and
  `dotnet build` were not run on the branch. `lab.js` and `web/index.html` were rebuilt after the rebase.
- `check_interiors` before the rebase: same counts as main but floating 121 problems in 34 designs (main 111 in 34):
  chest stacks in storehouses moved by the changed draws.
- Lineage (`lab/audit_pool.js`, Norse Meadows pool) before the rebase, against main: home-b s1 to s2 91 % (92), home-c
  s1 to s2 94 % (93), s2 to s3 70 % (76); others equal. Without the yard's fences and path tiles the house shells keep as
  much as main. The yard's fit moved half a metre once the window behind the hearth was walled up.
- Spots over 288 single-seed homes (village cultures, their first two biomes, s1 to s3): middle 32 %, end 15 %, side
  26 %, stack 1 %, round 26 % (round houses and tents keep the middle). Most middle ones are forms that keep it: Icelandic
  gable rows, Svan towers, Middle Eastern flat stone houses. The fire changes kind between stages in 14 of 96 lines.
- Lights per 10 m2 inside (homes s2 and s3): wall 0.15 to 0.21, floor 0.05 to 0.08, candles 0.19 to 0.25.

Renders looked at: Norse (Black Forest), Frankish (Swamp) and Slavic (Black Forest) homes at s1, s2, s3 and their
longhouses at s3 (`lab/hearths/renders.js <out dir>`): the Norse fire stays at its gable end from s1 to s3 with the
woodpile outside that wall and becomes a stone stack at s3; the Slavic fire stays in the front corner by the door; the
longhouses keep the middle fire. The Frankish s3 house (a U plan) took the back wall after its gable ends went to wings.

## Round 2 (2026-11-11): D-132 moves, fewer middle fires, halls

Main merged in (7f3ed3f, merge, conflicts in the daily note and `docs/INTERIOR_DESIGN.md` kept both sides). Work in
4bc4dac, all in `tools/blueprint-lab/lib/generate.js` unless named:

- `hearthDraw` (new): the fire's place per stage. s1 draws from the household's stream at the end the house does not
  grow toward (as before). Each later stage draws again with odds `HEARTH_MOVE`: 30 % when the massing state changes
  (size, wings, storeys), 8 % when the shell stays; the new place differs from the old. The rates are a choice (the
  corpus has no house seen at two stages): moving a fire means a new hood or shaft and roof patching, so it mostly
  happens with building work. No fixed interval. `info.hearthMoved` names the stage; a note is added when the fire
  moved at the stage asked for. The rework round a new hearth comes from each stage being built whole: no window in
  the bay behind the new wall hearth, the vent over the new place, the old ridge caps or roof row left in place.
- Home middle odds scale with floor area (cells x 4 x storeys): x0.3 under 120 m2, x0.6 under 250, x0.9 above.
- `hearthPlan`: returns `why` for a middle fire (`info.hearthWhy`). Icelandic gable rows (`plan 'gables'`): end hearth
  at the back gable of the main row (`rot: true`, `xW: NaN` so `hearthBay` never matches; gable backs have no windows
  already). Svan (`form 'svan'`): end or side at the end away from the tower (sg -1); `HEARTHS.lamari` middle 0.35.
  Halls and taverns (`T.use 'hall'`) go through `hearthPlan` with `HALL_HEARTH` (middle 0.22, end 0.4, side 0.25),
  salted by type.
- Flat roofs (the `flatCell` block in `generate`): the stage's draw for homes and halls; thick stone walls now take a
  wall fire half a cell out from the wall (a niche) under the 4 x 2 m opening, corners last; `HEARTHS['middle-eastern']`.
- A stone stack that cannot be built (something outside the gable) falls back to a middle fire under ridge caps
  taken out over it, clear of the climbs (before: a middle fire under a closed roof).
- `settle`: the fire's slide off a wall also clears the pot or spit on it; a long iron spit turns, then becomes a
  wooden spit, then comes off.

Measures (`lab/hearths/spotmix.js lib 6`, 288 single-seed homes, village cultures, first two biomes, s1 to s3):

| | Before (7f3ed3f) | After (4bc4dac) | Corpus |
|---|---|---|---|
| All homes | middle 32, end 15, side 26, stack 1, round 26 | middle 10, end 26, side 31, wall 6, stack 1, round 26 | middle 16 |
| Middle, not round (213) | 44 % | 14 % | 16 % |
| Against a wall, under 120 m2, not round (128) | 64 % | 94 % | 92 % |
| Lines where the fire changes kind, s1-s2 / s2-s3 (96) | 3 / 11 | 12 / 20 | |

Middle homes left (29): drawn 17, no free wall 9 (s3 cross, T, U and L+T plans over 140 m2 whose wings cover every
wall of the main wing), stack blocked 3. Halls and taverns (`lab/hearths/hallmix.js`, 360 designs): before all
middle; after 37 % middle among those over 80 m2 (corpus 32 %).

Checks: `lab/test_structure.js` all hold on 36. Norse Meadows pool (`make_testpool.js /tmp/h3-pool`): pass, 81 designs;
nestBroken 0 before and after. Lineage (shell kept) against 7f3ed3f: home-c s1-s2 94 to 79 %, s2-s3 70 to 64 %; hall
68 to 66 %, 54 to 52 %; the rest equal. These drops are the fire moving (D-132); `audit.js` was not changed.
Not run: `check_interiors` on a sample, `check_set`, other pools, `gen-test`, `dotnet build`, renders.

Next steps (exact):
1. `node lab/check_interiors.js lib /tmp/h3-ci.json 3` (small sample) and compare with main; look at hall and tavern
   fires that moved to an end or side (tables and benches round the old middle place, `fireAt` in `generate`).
2. Render a Norse-highland gable row s1 to s3, a Svan house s2, a Middle Eastern court house s3 and a longhouse with
   an end hearth (`lab/hearths/renders.js <dir>`) and check the hood and shaft on the turned gable wing.
3. Wall spots for the 9 "no free wall" plans: let the hearth stand against a wall of another wing (generalize the
   side shaft and `hearthBay` to a turned wing), or accept the middle for those big houses.
4. Then the rest of "Next steps" below. (Round 3: D-131 answered and built; D-130 answered, mod side.)

## Round 3 (2026-11-11): interiors, D-131 stone hearths, renders

Commits 4c41951, 7842089 and the round 3 handoff commit, all in `tools/blueprint-lab`.

- `check_interiors` (1 seed, 234 designs) against 7f3ed3f showed three new problems from round 2, all fixed:
  - a side hearth's cooking spit reached a ladder landing (home Plains byzantine s2 seed 24). `ladderPlan` takes
    `ring` (the wall hearth's cell for 'side' and 'end') and scores a ladder down by 12 when its foot, hole or landing
    is within 1.1 m of it.
  - a court house's niche fire stood in the walk where the south wing opens into the east wing (home Plains
    middle-eastern s3 seed 25). The flat-roof cell score adds 12 to a wall fire's cell next to another wing's cell.
  - a bar counter's beams left in the air in a tavern with an end hearth (tavern Black Forest norse-forest s3 seed
    52): the lane from the door to the end fire took the counter's half walls as riders of a rug and left the beams.
    `lib/layout.js` `clearLanes` now walks the set it drops as it grows (`for (const p of drop)`), so what stands on a
    rider goes too.
  - After: same or fewer problems than 7f3ed3f in every column (door 0 against 1, floating 13/49 against 14/50, stairs
    1 against 1, support 1 against 1); after the D-131 change one more floating (below).
- Halls and longhouses with a wall fire: the decorator already lays out round the new spot (`fireAt` from `generate`
  is the hearth's place for 'end', 'side', 'stack' and flat 'wall' fires; `placeFire` and the template choice use it).
  Seats within 3.5 m of the fire, 54 wall-fire halls and taverns (2 seeds, s2 and s3): 61 of 484 seats; 20 of the 40
  designs with seats have one by the fire. Corpus count (`lab/hearths/seat_mine.js`, pivots, roofed fires, 1,739
  builds): a seat within 3.5 m of a fire with a wall within 1.8 m in 14 of 120 hall fires (12 %), 21 of 72 tavern fires
  (29 %), 120 of 491 home fires (24 %). The generator is at or above the corpus, so no seats are added (D-136); a trial
  function that added benches was taken out.
- D-131 (Tyler: "Wood hearths (s1) and then stone hearths (s2 and s3) acceptable in meadows onward."):
  `lib/pieces.js` `hearthStoneOk(name, stage)`: stone_wall_1x1, 2x1, 4x2 and stone_floor_2x2 pass from s2. `checks.js`
  materials lets a piece marked `hearthStone` pass by it. `generate.js`: `KH` (the kit with Black Forest stone for a
  biome without stone), `hearthStoneOK` (s2 and later, any biome) for the stack hearth plan, `hearthStack` and
  `hearthstone` (flags under the fire); the stone they place is marked `hearthStone`. Black Forest homes at s2 (wood only
  under D-012) also get the stack and the flags now. Plank hoods stay at every stage; the decorative `chimneyStack` on
  middle-fire homes still follows `stoneOK` (not changed).
- `STACK_SHARE` 0.5 scales the culture's stack odds. Corpus: a stone stack past the roof over 13 of 443 home wall fires
  (3 %). Unscaled after D-131: about 9 % of s2 and s3 wall fires; at 0.5 about 3 % (`spotmix.js lib 14`).
- `flueEnd`: a middle fire's chimney within 2.5 m of a gable keeps the balcony to the other end (home Meadows norse
  cross+nave s3 seed 2: the plank chimney stood across the balcony door, `doors` check failed).
- Wall dormers are off for gable rows (`plan 'gables'`): the rows' long walls meet in valleys and the dormer stood in
  the valley at the back gable (render of norse-highland s2 seed 1; there in 7f3ed3f too). The condition comes after
  the draw, so other designs keep their draws.
- Renders (`lab/hearths/renders.js <dir> round2`): norse-highland gable row s1 to s3 seed 1 (fire at the back gable of
  the middle row, a hood, raised ridge caps over it, flags and kerb, a table and benches beside it); Lamari Svan s2 (side
  hearth at the back corner away from the tower, a plank shaft box with a lid beside the tower); Middle Eastern court s3
  (niche fire in the south wing's corner, a 4 x 2 m plank chimney box on the flat roof); Norse longhouse T s3 seed 12
  (end hearth under a plank hood with mantel beams, raised caps on the ridge, woodpile outside that gable, tables down
  the middle); Frankish Meadows L s3 seed 8 (stone stack hearth from D-131, the stack past the ridge with a plank lid).
  Nothing else read wrong in these.
- The 9 "no free wall" plans keep the middle fire. Main rooms of 80 m2 or more: the corpus keeps 74 of 325 home fires
  in the middle (23 %, `homePlaceByServedRoom`); the generator 10 of 39 (26 %, 6 seeds). Of those 10: drawn 6, no free
  wall 2, stack blocked 2.
- Candles by beds: corpus resin candles in homes, halls and taverns 503, within 1.5 m of a bed 4 (on a barrel, a wall
  and a beam). The 15 % in "Where lights stand" counts all small lights (Lavalanterns, hooded and standing lanterns). No
  candles by beds are added.

Measures (round 3):

| | 7f3ed3f | 4bc4dac | Now | Corpus |
|---|---|---|---|---|
| Home middle, not round (213) | 44 % | 14 % | 14 % | 16 % |
| Against a wall, under 120 m2, not round | 64 % | 94 % | 94 % | 92 % |
| Stack, s2 / s3 homes | | | 3 % / 1 % | 3 % of home wall fires |
| Middle, main room 35 to 80 m2 | | | 11 % | 0 of 67 |
| Halls and taverns over 80 m2, middle | 100 % | 37 % | 37 % | 32 % |

Checks: `test_structure.js` all hold on 36. Norse Meadows pool (`make_testpool.js /tmp/h3-pool`): pass, 81 designs,
nestBroken 0; lineage lines 68/63, 86/84, 66/52, 83/49, 91/98. `check_interiors` 1 seed: as above, plus one floating
woodpile (home Meadows frankish-norman s2 seed 12): the stone flags under the fire are 1 m floors sunk 0.4 m, the yard
(`yards.js`) takes the lowest pivot as its ground (-0.4) and sets the woodpile and fence on it, and the audit takes the
design's `ground: 0`. The same happens in every biome that had the flags before (Black Forest and later).

Next task:
1. Middle fires in mid-size homes: 11 % of main rooms 35 to 80 m2 against 0 of 67 in the corpus. The middle odds scale
   by floor area (`hearthDraw`); scale by the main room's size from the corpus table instead.
2. The audit's ground for designs with sunk stone floors (the floating woodpile above): `finish` returns `ground: 0`;
   it could return the yard's ground. Needs the lead (yards and audit are other tracks).
3. A stone hood or surround from s2 (D-131 allows stone hearths); the hood is planks now.
4. `chimneyStack` (the decorative stack on middle-fire homes) could follow D-131 too; ask before changing it.

## Round 4 (2026-11-11): mid-size homes, D-131 gable stack, stone hoods counted

Commits 5662f6a, 64b5507, 188b531, all in `tools/blueprint-lab`.

- `lib/decorate.js`: `const PIECES = P;` at the top; `lightOk` and `chooseKit`'s `pickLight` read `PIECES.decorOk`, so a
  persona argument named P in `chooseKit` (design/wip-decor-limits) cannot shadow the pieces module.
- Middle fires by the main room (`hearthDraw` takes `room`, the main wing's area, from `hearthPlan` and the flat-roof
  cell): under 80 m2 the culture's middle odds are scaled by `MID_SMALL_ROOM` 0.05 (corpus `homePlaceByServedRoom`: 3
  of 204 home fires in rooms under 80 m2 in the middle, 0 of 67 at 35 to 80 m2); at 80 m2 and over the floor-area
  scale stays (74 of 325 in the corpus). Halls keep `HALL_HEARTH`.
- Wall spots for the forms that had none (`hearthPlan` `sideAt`): after every strict try, a last pass over the back
  and front bays takes a wall cell with another wing's floor on one side (both sides is still refused), counts a wing
  that runs the main wing on at the same depth and turn (a nave, an annex) as the main wing, and lets the bay next to
  a door do (2.2 m, as for an end hearth). The side shaft takes out whatever roof is over the cell, so it works under
  another wing's eave. Forms that got a wall fire this way (6 seeds, s3): Norse Meadows L+T+nave (seed 1) and cross
  (seed 5), Frankish-Norman Meadows T+nave (seed 5), Byzantine Plains and Mistlands U (seed 5), Anglo-Saxon Meadows L
  hip (seed 6, by the door rule), and two over 80 m2 (cross, T+nave). All pass `checks.js` at d3; renders of the Norse
  cross and the Frankish T+nave show the shaft box beside the cross wing's valley (`/tmp/h3-r4/rend`, not committed).
  Still middle with no free wall: Norse Meadows Z+T s3 seed 6, Anglo-Saxon Meadows cross+nave s3 seed 4 (the one
  free cell is the door's bay), Frankish-Norman Meadows U s3 seed 4 (other wings on both sides of every free cell).
- D-131 for the decorative stack (lead's call: the stone chimney stack on middle-fire homes is part of a stone
  hearth): `wantStack` also holds for a home where `stoneOK` is false and `hearthStoneOK` is true (s2 and later), with
  its 0.6 odds drawn from a stream of its own (lineage and culture) so other draws stay as they were; `chimneyStack`
  gets `KH` and `o.hearthStone`, and marks its pieces `hearthStone` (stone_wall_2x1, stone_wall_1x1, stone_floor_2x2,
  all in `HEARTH_STONE`). It is never built at s1. Count: `chimneyStack` placed no stack on any of 128 homes forced to
  a middle fire (`hearth: 'middle'`, every village culture, first two biomes, seeds 1 to 4, s2 and s3), on the branch
  and on 6907cbd alike: the free gable end is taken by the woodshed (placed first), a wing or annex past it, or
  half-timber braces of another wall inside the stack's column. So the D-131 gate is in place and nothing changes in
  the designs yet.
- Stone hoods (`lab/hearths/fire_mine.js` now records `hood`, the pieces 1.3 to 3.4 m over each fire with their place
  and any clip into a wall, and `backD`; `lab/hearths/hood_stats.js` counts them; run on the device from raw GitHub
  files, 1,663 builds, 3,434 fires as before). Indoor home wall fires (wall, corner, alcove, in-wall): 556. Something
  over the fire 1.3 to 2.9 m up: wood only 238 (43 %), any stone 79 (14 %: basic stone 39, grausten 32, black marble
  10), nothing 239. The 39 basic-stone fires are in 33 builds; the pieces are a stone_arch across the fire's mouth (19,
  mostly alcove and in-wall fires, 2 to 3 m up, a metre in front of the fire) or a stone_wall_2x1 or 1x1 lintel (17);
  36 of their stone pieces overlap a wall piece (median 1 m: set into the wall line on purpose). Not built this round:
  stone takes no support from wood (T-102), so a stone front needs stone jambs from the floor under the arch, which
  the end and side hearths do not have; the stack hearth is the stone form now.

Measures (round 4):

| | 6907cbd | Now | Corpus |
|---|---|---|---|
| Middle, main room 35 to 80 m2 (`roommix.js lib 6`, 174 homes) | 19 (11 %) | 7 (4 %): drawn 3, no free wall 3, stack blocked 1 | 0 of 67 |
| Middle, main room 80 m2 and over (39 homes) | 10 (26 %) | 8 (21 %) | 74 of 325 (23 %) |
| Home middle, not round (`spotmix.js lib 6`, 213) | 14 % | 7 % | 16 % of all homes |
| Against a wall, under 120 m2, not round | 94 % | 97 % | 92 % |
| Halls and taverns over 80 m2, middle (`hallmix.js`) | 37 % | 32 % | 32 % |
| Lines where the fire changes kind, s1-s2 / s2-s3 (96) | 12 / 20 (round 2, 4bc4dac) | 12 / 11 | |

The home middle share over all homes is under the corpus because the generated homes are smaller (174 of 213 have a
main room of 35 to 80 m2); by room size the generator is near the corpus.

Checks: `test_structure.js` all hold on 36. Norse Meadows pool (`make_testpool.js /tmp/h3-pool4`): pass, 81 designs,
nestBroken 0; lineage lines 68/63, 86/84, 66/52, 83/48, 91/98 (round 3: the same but 83/49). `check_interiors` 1 seed
(234 designs) against 64b5507 with the same data: equal in every column (floating 14/50, support 1/1, overlap 2/2,
stairs 1/1, decorBiome 11/22). All 60 side-hearth homes at s2 and s3 (6 seeds, d2 and d3) pass `checks.js`.

## Round 5 (2026-11-11): stone hearth fronts, the gable stack's end, end hearth before the middle

All in `tools/blueprint-lab/lib/generate.js` and `lib/pieces.js`. Main merged in first (9b9711d, CLAUDE.md only).

- Stone front on a home's wall hearth from s2 (D-131, D-127): `hearthFront`. Two jambs of 1 m blocks from the ground
  to 3 m at the sides of the hood's mouth (1.75 to 2.75 m out from the wall line, further out by the wall's thickness
  past 0.25 m), the mouth 1.6 m wide; across it from 2 to 3 m a stone_arch or a 2 m block as a lintel, its ends set
  0.2 m into the jambs' top blocks and resting on the blocks under them (stone takes no support from wood, T-102). The
  span carries `clip` and `wclip` 0.2 (written to `#VillheimClips`, D-098; the corpus clips are a median 1 m). The plank
  hood starts on the front's top (the vent's `from` set to 3 m). On a floor up to 1 m above the ground the jambs go
  down through it to the ground and a post under the floor in their way comes out. Odds `FRONT_SHARE` 0.14 (corpus,
  `hood_stats.js`: stone 1.3 to 2.9 m over 79 of 556 indoor home wall fires; there are no stages in the corpus, so the
  rate applies to s2 and s3) and `FRONT_ARCH` 19/36 (arch against lintel), drawn from a stream of lineage, culture and
  biome. Pieces by kit: basic stone in the Meadows (Black Forest blocks and arch, marked `hearthStone`) to the Plains,
  black marble blocks and a marble lintel in the Mistlands (the marble arch is 2 m tall). The Ashlands grausten blocks
  are 2 m tall and 0.3 m thick, so no front is built there (open). Skipped where a wall, post, window, stair, rake beam
  or a doorway or climb zone is in the place, on gable rows, and where an upper storey is under 3 m. Bench switch:
  `req.details.hearthFront`. `info.frontWhy` says why a front was not built.
- `lib/pieces.js` `HEARTH_STONE` takes `stone_arch`. `KH` (the Meadows hearth kit) gets `stoneArch: 'stone_arch'`.
- The woodshed keeps off the gable end a middle-fire home's stack may take: `stackEndFor` gives the end chimneyStack
  tries first (no wing past it, no tower), passed as the woodshed's `avoid` (the call site in `generate`;
  `woodshed` itself unchanged). It applies when the stack may be built (`stoneOK` at s2 and later for the stack's
  types, or D-131 for homes); the stoneOK draw comes after the woodshed's, so the end is kept on the 40 % that then do
  not draw a stack too. `info.stackEnd` records it. The yards (`lib/yards.js`) are not changed and do not read it.
- `chimneyStack`: the rake's bargeboards (trim beams and `_26`/`_45` beams within 1.6 m of the gable) no longer block
  the stack's column; those in the stack's way come out, as `hearthStack` does. `info.stackWhy` says why no stack was
  built. On 128 homes forced to a middle fire (every village culture, first two biomes, seeds 1 to 4, s2 and s3) the
  blockers were: the woodshed, wings past the gable and the rake's `wood_beam_45` (8 of 20 tried). Now: 10 stacks, all
  pass `checks.js`; still blocked by a carved ridge beam or dragon at the gable (5), a ridge beam (3), posts (2).
  108 of the 128 never try (roof not a gable, stone walls, or the 0.6 draw).
- A stack hearth whose stack cannot stand (`hearthStack` false) now becomes an end hearth at the same gable before the
  middle (`endFallback`: the ridge caps and the rake's cap over the cell come out for the hood's shaft, a ridge vent
  with `hood: true`); `info.hearthWhy` stays 'stack blocked'. 6 of these in the sample below (all Baltic Swamp, the
  lake fort deck in the way of the stack), all pass `checks.js`.
- Renders (`/tmp/h3-r5/rend`, not committed; close views made from the pieces within 4.5 m of the front): Anglo-Saxon
  Meadows cross s3 seed 2 (side hearth, stone_arch: jambs, the arch's curved shoulder at one side of the mouth, the
  fire pit and spit behind it, the plank hood over it); Baltic Swamp s2 seed 2 (end hearth on a 1 m raised floor, the
  jambs down to the ground under the floor, a cauldron in the mouth); Lamari Mistlands s2 seed 4 (end hearth, black
  marble jambs and lintel against marble walls); Frankish-Norman Meadows s3 seed 6 (end hearth, stone lintel, two
  storeys, the upper floor resting on the jambs). Also the Baltic fallback (raised caps at the end over the hood) and a
  Norse Meadows T s2 seed 2 gable stack (the stack outside the gable, the fire in the middle of the room: the stack is
  the decorative one from round 4).

Measures (round 5, base = 0def7c5 with main merged):

| | Base | Now | Corpus |
|---|---|---|---|
| Stone front, s2 and s3 home wall hearths (`front.js`, 6 seeds, 114) | 0 | 17 (15 %): arch 6, lintel 11 | stone over 14 % of home wall fires |
| Gable stack, 128 homes forced to the middle | 0 | 10 | |
| Home middle, not round (`spotmix.js lib 6`, 213) | 7 % (stack blocked 3 of 15) | 6 % (stack blocked 0 of 12) | 16 % of all homes |
| Against a wall, under 120 m2, not round | 97 % | 99 % | 92 % |
| Middle, main room 35 to 80 m2 (`roommix.js lib 6`, 174) | 7 (4 %) | 6 (3 %) | 0 of 67 |
| Middle, main room 80 m2 and over (39) | 8 (21 %) | 6 (15 %) | 74 of 325 (23 %) |
| Halls and taverns over 80 m2, middle (`hallmix.js`) | 32 % | 32 % | 32 % |
| Lines where the fire changes kind, s1-s2 / s2-s3 (96) | 12 / 11 | 10 / 12 | |

Checks: `test_structure.js` all hold on 36. Norse Meadows pool (`make_testpool.js /tmp/h3-pool5`): pass, 81 designs,
nestBroken 0; lineage lines as round 4 (68/63, 86/84, 66/52, 83/48, 91/98, ...). `check_interiors` 1 seed (234
designs): the same as the base in every column. All 17 front homes and the 6 fallback homes pass `checks.js`.

Scratch scripts (not committed): `/tmp/h3-r5/front.js` (fronts and checks), `why.js` (why a forced front was not
built), `stackwhy.js` (why no gable stack), `fallback.js`, `close.js` (close renders).

## Changes in other tracks' files (round 5)

- None outside the hearth parts. The woodshed's end is kept through its existing `avoid` argument at the call site in
  `lib/generate.js`; `info.stackEnd` is a new field on the design's info that no other file reads yet.

## Changes in other tracks' files (round 3)

- `lib/layout.js` `clearLanes`: `for (const p of list)` became `for (const p of drop)` in the rider loop, with a comment.
- `lib/pieces.js`: new `hearthStoneOk` and `HEARTH_STONE`, added to the exports.
- `lib/checks.js` materials: one more condition, `!(p.hearthStone && PC.hearthStoneOk(p.name, design.request && design.request.stage))`.
- `lib/generate.js` outside the hearth parts: the dormer condition `&& plan !== 'gables'`; `ladderPlan` takes `o.ring`.
- The decor-limits branch has `buildReach` in `pieces.js`; this branch does not. The D-131 exception does not go
  through it: the generator places the hearth stone itself and marks it, so `buildReach` needs no change.

## Open problems

- Rerun on the branch: `node lab/check_set.js 2`, `node lab/check_interiors.js lib out.json 3` (compare with main),
  `node lab/make_testpool.js /tmp/x` and `node lab/audit_pool.js /tmp/x` (lineage), `VH_GEN_OUT=/tmp/y
  tools/gen-test/run.sh`, `dotnet build Villheim.sln -c Release`. Then merge to main.
- The lineage drops above come from yard fences; decide whether to accept them or make the yard's margins steadier
  (`lib/yards.js`, another helper's file).
- (Done in round 3, D-131: the Meadows gets the stone stack and flags from s2.)
- Hip roofs only get side hearths a bay in from the corner; middle when doors block it.
- The hood and shaft are planks; no stone surround or hood in stone (stone cannot hang on wood); a stone firebox inside
  the house would need a stone floor from the ground and timber over it.
- Mod side (for Tyler): nothing in the mod stops a village fire from going out when its smoke is blocked or rain falls
  on it; `KeepLitPatch` only refuels. Designs from the lab keep a 1 m clear shaft with a cap, but hand-placed or older
  designs may not. A mod change (in `src/Villheim.Logic/Designs/DesignSpawner.cs` or a patch on `Fireplace`) would be
  needed to keep village fires burning regardless; not done.
- Not tried in the game.

- Round 4: the floating woodpile on sunk stone flags (the yard's ground is the lowest pivot, -0.4 m; the audit takes
  the design's `ground: 0`) stays for the yards and audit owners (`lib/yards.js`, `lib/audit.js`).
- Round 4: `chimneyStack` (the gable stack on middle-fire homes) is never placed on a home in the samples above; the
  woodshed takes the one free gable end first. Making room for it means the woodshed keeping off the stack's end. (Round 5: the woodshed keeps off it and the rake's bargeboards
  no longer block it; 10 of 128 forced homes.)
- Round 4: a stone hearth front (stone_arch over stone jambs from the floor, the corpus's commonest stone form over a
  home wall fire, 19 of 556) is not built. (Built in round 5, `hearthFront`; not in the Ashlands.)
- Round 4: three s3 plans keep the middle with no free wall (above); a stack that cannot be built still falls back to
  the middle (1 of 174 mid-size homes), where an end hearth with a plank hood would serve. (Round 5: it becomes an end hearth, `endFallback`.)

## Next steps

Round 5 next task:
1. Ashlands hearth fronts in grausten (its 1 x 2 m blocks and `Piece_grausten_wall_arch`, 2 m tall): a geometry of its
   own; the corpus has 32 grausten-over-fire home wall fires.
2. Middle fires in main rooms of 80 m2 and over: 15 % against 23 % in the corpus (39 homes), lower since stack-blocked
   homes now get an end hearth. Their middle odds could rise a little (`hearthDraw`, area over 80 m2).
3. The gable stack on a middle-fire home stands apart from the fire (round 4, lead's call); it is now built (10 of
   128 forced homes). A render review should say whether it reads right, or whether the fire should move to that end.
4. Fronts are skipped where the rake's 45 degree beams cross the place (5 of 55 forced) and on raised floors over 1 m.


Round 4 next task:
1. A stone hearth front from s2 for end and side hearths (D-131, D-127): two stone_wall_1x1 jambs from the floor at the
   fire's sides, a stone_arch across the mouth at 2 to 3 m set into the wall line as corpus builders do (marked in
   `#VillheimClips`, up to 1 m deep), the plank hood from 3 m. Odds from `hood_stats.js` (basic stone over 7 % of
   home wall fires).
2. Let the woodshed keep off the end a middle-fire home's stack wants, then count stacks again.
3. A blocked stack falls back to an end hearth (hood and raised caps) before the middle.

Earlier steps:

1. Rerun the checks listed above on the branch, fix what they show, merge to main and to `design/kitbash`.
2. Look at more renders (`lab/hearths/renders.js`) for the side shaft through the eave and the stack against a T or L
   plan.
3. When the decor-any-biome change lands in `lib/pieces.js` `decorOk`, the lights and fire dressing follow it with no
   change here (`lightOk`, the kit's light picks, `settle`'s filter).
4. Candles by beds: 4 of 503 corpus resin candles stand within 1.5 m of a bed (round 3); none are placed.
5. Tyler's words for the goals: home fires along walls, in alcoves or in wall hearths with chimneys; middle fires for
   social rooms; vents follow the fire; lights from any biome, no fixed counts.
