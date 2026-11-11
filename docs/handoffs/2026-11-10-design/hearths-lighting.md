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

## Open problems

- Rerun on the branch: `node lab/check_set.js 2`, `node lab/check_interiors.js lib out.json 3` (compare with main),
  `node lab/make_testpool.js /tmp/x` and `node lab/audit_pool.js /tmp/x` (lineage), `VH_GEN_OUT=/tmp/y
  tools/gen-test/run.sh`, `dotnet build Villheim.sln -c Release`. Then merge to main.
- The lineage drops above come from yard fences; decide whether to accept them or make the yard's margins steadier
  (`lib/yards.js`, another helper's file).
- Meadows never gets the stone stack (no stone pieces before the Black Forest, and `checks.js` materials would fail).
  Under the new rule (neighbors' build pieces allowed, D-012 for stone) a Meadows s3 home could get one once the
  build-piece rule in `lib/pieces.js` and `checks.js` allows Black Forest stone in the Meadows at late stages.
- Hip roofs only get side hearths a bay in from the corner; middle when doors block it.
- The hood and shaft are planks; no stone surround or hood in stone (stone cannot hang on wood); a stone firebox inside
  the house would need a stone floor from the ground and timber over it.
- Mod side (for Tyler): nothing in the mod stops a village fire from going out when its smoke is blocked or rain falls
  on it; `KeepLitPatch` only refuels. Designs from the lab keep a 1 m clear shaft with a cap, but hand-placed or older
  designs may not. A mod change (in `src/Villheim.Logic/Designs/DesignSpawner.cs` or a patch on `Fireplace`) would be
  needed to keep village fires burning regardless; not done.
- Not tried in the game.

## Next steps

1. Rerun the checks listed above on the branch, fix what they show, merge to main and to `design/kitbash`.
2. Look at more renders (`lab/hearths/renders.js`) for the side shaft through the eave and the stack against a T or L
   plan.
3. When the decor-any-biome change lands in `lib/pieces.js` `decorOk`, the lights and fire dressing follow it with no
   change here (`lightOk`, the kit's light picks, `settle`'s filter).
4. Candles by beds (15 % in the corpus) need a surface; none is placed yet.
5. Tyler's words for the goals: home fires along walls, in alcoves or in wall hearths with chimneys; middle fires for
   social rooms; vents follow the fire; lights from any biome, no fixed counts.
