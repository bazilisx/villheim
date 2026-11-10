# Generator notes, 2026-11-09 night

What was measured and changed in `tools/blueprint-lab`, and ideas for the next steps, tied to Tyler's drivers
(messy realism, no cookie-cutter rules, a complexity ladder by stage, additive decor, professional layouts, grounded
in the real game).

## Done and checked

- **Store rooms** (open thread "storehouse chests stacked and labeled along the walls"): two finishing passes in
  `lib/decorate.js` for rooms whose use is storage, at d2 and d3. `storeLabels` puts one sign on each wall that has
  chests against it. `storeStacks` puts a second chest on some chests by a wall. Both are fixed by where things
  stand (a hash of the chest's position for stacks), so d1 is inside d2 and d2 inside d3 as before.
  Pool result: s1d2 and s1d3 9 chests (4 on top of others) and 2 signs; s2 7 chests (3 on top) and 2 signs; s3 14
  chests (2 on top) and 1 sign. Before: 4, 4 and 12 chests, none stacked, no signs.
- **A guard against deep clips**: chests, stations and their extensions, beds and tables may not reach into one
  another by more than 3 cm of the game's solids, whatever the source build of a kit did.
- **`lab/audit_pool.js <pool folder> [--json out] [--list]`**: turns the defects from Tyler's game tests into
  numbers for a whole pool. It reads the files and changes nothing.

## What the audit says about the Norse Meadows pool (81 designs, after the store room change)

| Measure | Result |
|---|---|
| Decor stages nest (d1 in d2 in d3) | Yes, at every stage of every line |
| Furniture inside furniture | 0 (measured with the decorator's own sizes) |
| Furniture standing on furniture, chest stacks and table settings aside | 0 |
| Hangings over a window or door | 0 |
| Stairs with nothing under their foot | 0 |
| Base stations with no roof over them | 0 |
| Furniture outside the floor's outline | 11: a chest in every barn stage, a chopping block at home b s3d3 |

Shell kept from one stage to the next (structural pieces of the earlier stage still in place):

| Line | s1 to s2 | s2 to s3 |
|---|---|---|
| home a | 83 % | 51 % |
| home b | 91 % | 98 % |
| home c | 93 % | 76 % |
| hall | 69 % | 54 % |
| woodworker | 81 % | 80 % |
| smithy | 95 % | 100 % |
| storehouse | 94 % | 46 % |
| farm | 86 % | 83 % |
| barn | 68 % | 61 % |

Likeness of the three homes' furniture lists (1 means the same list): 0.56 to 0.67 at s1d1, 0.50 to 0.70 at s2d2,
0.43 to 0.48 at s3d3.

What this means:
- The pool files are clean on the defects Tyler photographed. That agrees with the earlier finding that benches on
  tables and chests in chests came from the mod furnishing designs a second time (fixed in c436bb4). If clips show
  again in the game, look at the mod side or at a size mismatch (below), before the generator.
- The weak growth steps are the same four as yesterday: storehouse, home a, hall, barn at s2 to s3.
- Homes differ most at s3d3 and least at s2d2.

## Ideas, in rough order of value

1. **Make the audit a gate.** Run `audit_pool.js` at the end of `make_testpool.js` and of `vh testpool make`, and
   fail the pool when nesting breaks or any clip, hanging or stair count is above zero. Add each new screenshot
   defect as a measure there. This is the "every visual defect becomes a check" loop in one place.
2. **One table of piece sizes.** The decorator's table says a wood chest is 1.65 x 0.75 m; the catalog in
   `lib/pieces.js` says 1.2 x 0.7 m. The first draft of the audit used the catalog and reported 39 clips that are
   not there. Any check built on the catalog has the same blind spot in the other direction. Suggest: both read
   the measured models (`data/piece-models.json`), and a test fails when the two tables disagree by more than 10 cm.
3. **Growth that adds to the earlier stage.** For the four weak steps, build s3 as s2 plus parts (a wing, a second
   storey, a lean-to) and keep the s2 shell fixed, then measure. A target of 70 % or more kept would mean a
   villager never tears down most of a house to grow it. The storehouse at 46 % is the clearest case: its s3 is a
   different building.
4. **Origins centered on the last stage's footprint.** Several lines sit off their origin (barn 3.8 m, farm 4.9 m,
   home c 1.8 and 2.3 m). The mod now measures the real footprint, so this no longer wastes ground, but the door
   and path code still reason from the origin. If every stage of a line shared an origin at the middle of its s3
   footprint, door, path and pad code would all agree. Every stage must keep sharing one origin.
5. **Footprint and door in the file header.** The mod now derives the footprint from the pieces at load. A header
   line per design (footprint rectangle, door side, yard extent) would let the generator say what ground it
   really needs, yards included or left out.
6. **Variance by household, measured.** Use the likeness number as a check: for the same line and stage, two
   households with different traits should score under about 0.6, and no two home lines in a pool above 0.7. At
   s2d2 two pairs are at 0.69 and 0.70. This puts a number on "no cookie-cutter".
7. **The decorator's biome rule and minor decor.** `decorate.js` refuses any piece from a later biome, while the
   checks let minor decor through in any biome (D-066). Meadows rooms therefore get no banners, pots or signs from
   the decorator's own rules. The store room label makes an exception for signs. A general answer depends on D-080.
8. **Decor order for idle-time building.** Decor stages nest, so a resident can add d2's pieces one at a time. A
   per-piece order in the file (beds, then seats and tables, then storage, then hangings and small things) would
   let the mod place them in a believable order with no search at run time, which also keeps lag down.
9. **Store rooms at d3.** Chest counts are the same at d2 and d3 in the pool. Barrels, crates and sacks at d3
   (messy realism: a storehouse fills up) would make the stages read differently.
10. **Window boxes.** Not touched tonight. The open thread stands: better pieces under windows.
11. **Room layout branch.** `feat/layout` (WIP b9a500d) was not merged or tested here. Before merging: rebase on
    the branch above, run `check_set.js`, `test_structure.js`, `check_interiors.js`, `audit_pool.js` on a fresh
    pool, and `tools/gen-test/run.sh`.

## Commands used

```
cd tools/blueprint-lab
node lab/make_testpool.js <out folder>          # 81 designs in about 25 s
node lab/audit_pool.js <out folder> --list      # the measures above
node lab/check_set.js 2                         # 224 of 225, 90 of 90, 147 of 147 (same before and after)
node lab/test_structure.js                      # 36 hold
node lib/build_engine.js                        # rebuilds src/Villheim.Logic/Generator/lab.js
../gen-test/run.sh                              # 5 of 5 the same byte for byte
```
