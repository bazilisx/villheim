# Creative interior sets: full-corpus mining (design helper, 2026-11-10)

Scope: combined, stacked and clipped interior objects (D-065, D-098) mined from the corpus and added to the interior
library as creative sets. First round (Session 9 of the day): 92 hand-written sets `KC-001` to `KC-092`. Second round
(this file): the full corpus, 56 mined sets `KC-093` to `KC-148`. Write-up of the sets themselves:
`docs/INTERIOR_DESIGN.md`, "Creative sets" and "Full corpus round".

## How the mining ran

- Corpus: Tyler's PC, `C:\Users\tyler\Downloads\Villheim-blueprints` (read in the device VM as
  `$HOME/mnt/Downloads/Villheim-blueprints`), the valheimians downloads as `.blueprint` files in folders, with
  `index.json` beside them (title, maker, category, downloads per slug). Nothing was written into the Downloads folder.
  The OverDrive BiomeBlueprints pack was left out (blacklisted).
- Work folder on the device VM: `$HOME/vhlab` (a copy of `tools/blueprint-lab/lib`, `data`, and the lab scripts,
  fetched from the public repo). Files went across as gzip and base64 text; results came back the same way.
- Mining: `node lab/mine_creative.js $HOME/mnt/Downloads/Villheim-blueprints mined-full.json`. A folder is read one
  build at a time (loading all builds at once ran the 3 GB VM out of memory). Folders starting with `_` are skipped.
  A build is vanilla when no piece matches the mod-prefix pattern in the script, and it has 20 to 15,000 pieces.
- Likes: joined from `index.json` by slug (the file name before `__`); a build is well-liked when its downloads are in
  the top quarter of the corpus. With no index (Tyler's board) every build counts as liked.
- Result: over 2,100 builds read, 1,536 vanilla, 353 well-liked; 15,175 combined objects, 9,187 distinct (same prefabs
  within 0.35 m, mirrors included), 281 prefabs. `mined-full.json` (10.7 MB) stays on the device VM; the repo has the
  summaries below.
- Selection: `node lab/select_creative.js mined-full.json > sel.b64`. 1,308 objects passed (2+ builds or a liked
  build, 2 to 10 pieces, no seasonal pieces, treasure, piles, fires, beds or tables, within 4.6 m and 2.75 m high),
  295 kept (one per set of prefabs and anchor, liked first, then the best two for every prefab not yet in two). 125
  of the 295 were picked by hand for variety.
- Sets: `node lab/creative_sets.js` writes the hand-written sets and the picks in `data/creative-mined.json` into
  `data/kitbash-interior.json` (`NODROP=1` writes every pick, for probing).
- Probe: `node lab/creative_fit.js --probe KC-093 ...` tries each set alone in its rooms' building types (the set's
  biome and Mistlands, 3 seeds, s3d3).
- Pictures: `node lab/render_creative.js /tmp/out KC-093 ...` (three views each); judged by eye.
- Gate: `node lab/make_testpool.js /tmp/pool` (pool audit).

## Measurements committed

- `tools/blueprint-lab/data/creative-mined.json`: the 125 picks with geometry, clips, sinks, builds, liked builds and
  source builds.
- `tools/blueprint-lab/data/creative-corpus/selected.json`: the 295 objects `select_creative.js` kept.
- `tools/blueprint-lab/data/creative-corpus/kept.csv`: the 2,740 distinct objects in 2+ builds or a liked build
  (anchor, prefabs, pieces, builds, liked, deepest clip between members, first source build).
- `tools/blueprint-lab/data/creative-corpus/prefabs.csv`: each of the 281 prefabs: objects it is in, builds, liked.
- No blueprint files from the corpus are in the repo; they are other people's work.

## Families found and kept

Counts are the mined sets kept; sources are the builds the object was seen in (maker in parentheses).

| Family | Kept | Most repeated objects (builds / liked) and sources |
|---|---|---|
| Built (furniture of building pieces) | 22 | chest framed by beams and posts, a storage bay (16 / 6: Kjúklingur, Houses, homes and tinies, MutantArtCat; Leech Landing, The Greydwarf Wharf, HiccupTheHermit); chest between posts (11 / 6); chest behind a half wall (9 / 2); log bench with a quarter-wall back (Leech Landing); black metal chests between log posts (Fluffybunny's Home, Fluffy-n-Dana); chairs under a beam shelf (Fantasy Mage House, Apudma) |
| Stations (as household decor) | 12 | workbench boxed in half walls (The Greydwarf Wharf; Simple Corewood Lighthouse); artisan press (The Refinery, Fluffy-n-Dana; Outpost, ThugDragonz); smithing tools round a workbench (Storage/Workshop, Jacob_Lad); spinning wheel by a half wall (Kjúklingur; Complex Tower, MutantArtCat) |
| Food | 11 | fermenter under beams (3 / 2: Houses, homes and tinies; My First Home, Fluffy-n-Dana); feasts with cups, candles, a lantern (Daluffo Home, Deardly; Mistvale Keep, Jaikanatar); drinks round a chair (Workmans Pub, Bri Games); oven built into stone (Skyrim Nordic Home, Luxfen); mead ketill and cauldron (Octagon Starter Base, aSoftPea) |
| Light | 4 | torch set into a post (9 / 4: Quirky Log Cabin, HiccupTheHermit); lantern on a chair (8 / 2: Ultimate Outpost, Volfas; INCREDIBLE Tavern, Olivanderr); candles, pots and a torch on ashwood posts (Japanese Style Base, Dremka) |
| Storage | 3 | chest with its signs (Cozy tree house, PUP; The Refinery); Dvergr crates stacked; long crate on beams |
| Display | 2 | throne and armor stand (Chickensthorpe Longhouse, Kingchickenx); black marble bench between armor and posts (Big Spiral House, Haakonzen) |
| Window | 2 | pots by a post (My country house, PUP; Ashen Spire, Mint); signs and a pot on quarter walls (INCREDIBLE Tavern) |

The most repeated objects overall (`kept.csv`) are rug pairs (jute carpets 25 builds, deer rugs 25), which the
library already covers, then storage bays, torches in posts and chairs with something on the seat.

## Left out and why

- 49 of the 125 went into no room in the probe: chest pairs clipping deeper than the 12 cm furniture limit, signs
  hung on chest fronts (rest `hang` with nothing structural above), objects that only fit the room they came from.
- 16 read badly in the pictures: a chair whose cups did not fit (4); floor beams by a torch or chair (4); an armor
  stand or marble head leaning on a floor beam (2); pots strewn over floor beams; Dvergr shelves turned off the wall
  (2); three bone thrones in a row; two never seen in a picture.
- 4 failed the test pool audit: the galdr table sets (table and upgrades clip into each other: `furnClip`,
  `onStation`, 26 cm into a beam; the ledger on a chair: `stacked`) and item stands hung 0.5 m up a half wall (`hang`).
- All picks left out are listed by number in `lab/creative_sets.js` `DROP`.

## Pieces with no model (13 in the first round)

- Measured on Tyler's PC with `lab/extract_models.py` (UnityPy, needs `attrs` upgraded) and `lab/build_models.js`, and
  added to `data/piece-models.json` and `data/piece-solids.json`: `bar_iron_stack`, `bar_flametal_stack`,
  `stonechest`, `dvergrprops_crate_ashlands`, `CookedWolfMeat`, `LoxPie`, `OvenPancake`, `Salad`.
- `piece_drawer`, `piece_chest_cargo`, `MS_PressurePlate_BlackMarble`: not in the game's piece list, so they are mod
  pieces. The 224 `piece_drawer` placements come from modded builds.
- `cauldron_ext7_smoker`, `MeadStaminaLingering`: the extraction gave no usable mesh.

## Rules applied

- Decor in a set goes in any biome (Tyler, 2026-11-10); `from` counts only building pieces that keep their own
  prefab, and `lib/kitbash.js` (`fit` and `hopeless`) leaves out only such pieces where the village does not make
  them. The library-first helper is changing `lib/pieces.js` `decorOk` to match.
- Clips are measured from the source build; D-098 covers clips made on purpose.
- `lib/kitbash.js` `fit` carries a floor piece's source sink (`p.sink`) so the audit's rest test allows a sunk post.

## Open problems and next steps

- `lib/pieces.js` has no recipe biome for the galdr table and its upgrades, the black forge and its upgrades, the lava
  lantern, the bone throne, the mead ketill or the feasts (all read as Meadows). With decor in any biome this only
  affects the `biome` field and `decorOk` for stations.
- The galdr table sets could come back once the audit takes a station's own upgrades as part of it.
- 49 probe failures include good ideas that need the fitter to allow a chest pair's own clip (marked per D-098) and
  signs on chest fronts.
- None of the sets has been tried in the game.
