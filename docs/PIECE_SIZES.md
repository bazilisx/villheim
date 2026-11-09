# Piece sizes: the catalog against the game

`lib/pieces.js` guesses each piece's size from its name and the corpus. The renderer now draws each piece from a
model measured in the game's own prefabs (`data/piece-models.json`, made by `lab/extract_models.py` on Tyler's PC and
`lab/build_models.js`). This page lists every piece the lab writes whose catalog size or pivot is off from the game by
more than 10 cm. The catalog sizes are unchanged: `lib/checks.js`, the decorator and the generator still use them.
Changing them is the lead's call, with `node lab/check_set.js 8 --list` and `node lab/check_interiors.js lib /tmp/ci.json 3`
run after.

Made by `node lab/piece_sizes.js` (2026-11-09). "Game, solid collider" is the box round the piece's solid colliders
(what the game tests against; the mesh when a piece has none); "Game, mesh" is the box round the LOD0 meshes. Both
are in the piece's own frame, so a collider turned at an angle (roof, gable and sloped beam pieces) gives a box
larger than the slab itself. "Bottom below pivot" is where the piece's lowest point sits: the catalog's from its
shape (centered, standing on the pivot, hanging from it), the game's from the mesh.

## What matters for the checks

Measured in the game files, in order of how much they move things:

1. **Walls that stand on their pivot.** `wood_wall_quarter` (the 1 x 1 m "Wood Wall 1x1"), the grausten walls
   (`Piece_grausten_wall_1x2`, `_2x2`, `_4x2`, `Piece_grausten_window_2x2`), `darkwood_decowall` and `crystal_wall_1x1`
   have their bottom at the pivot; the catalog centers them on it. `wood_wall_quarter` is 1 x 1 x 0.3 (collider),
   which agrees with the lead's corpus fix to [1, 1, 0.2] for the size; its bottom is 0, so a centered box puts it
   0.5 m too low. `darkwood_decowall` is 1 m wide, not 2. `wood_window` (the shutter) is 1.15 x 1.05 x 0.36 and
   centered on its pivot, so [1, 1, 0.2] is right for the opening it fills.
2. **Stairs.** `wood_stair` is 2 m wide and rises 1 m over 2 m toward its local -z, from its pivot (bottom -0.13,
   top 1.05). The catalog and `CLIMB` read it as 1 m wide, centered on a pivot 1 m up and rising 2 m. `stone_stair` is
   2.04 x 1 x 2 and stands on its pivot. `wood_stepladder` agrees with `CLIMB` (bottom 0, 2 m over about 2 m).
3. **Floors.** `stone_floor` is 4 x 1 x 4 (the catalog has 2 x 0.25 x 2); `blackmarble_floor_triangle` is 2 x 1 x 2;
   the grausten floors are 0.5 m thick; `wood_floor` and `wood_floor_1x1` are 0.13 m thick with their top 0.1 m above
   the pivot; `blackmarble_tile_floor_*` sit on their pivot.
4. **Beams and posts are 0.4 m thick.** Every wood, dark wood and ash wood beam and post is 0.4 x 0.4 in the game (the
   catalog has 0.2 or 0.25). Log posts are 0.4 (collider) to 0.55 (mesh). `ashwood_beam_2m`'s mesh and collider sit
   1 m below its pivot (bottom -1.2); worth a look in the game.
5. **Walls are thicker.** Wood walls are 0.3 m (collider) and 0.43 m (mesh, with the posts at the ends);
   stone_wall_4x2 is 1 m thick; grausten walls 0.4.
6. **Doors and gates.** `wood_door` is 2 x 2.02 x 0.5 with its frame, centered; `wood_gate` is 3 m tall (catalog 2);
   `darkwood_gate` 4 m and standing on its pivot (as `DOORS` says). `piece_cloth_hanging_door` is 1.13 m wide and hangs
   2.4 m below its pivot (the catalog has 2 m).
7. **Furniture is mostly larger than the catalog.** `piece_table` 2.45 x 0.79 x 1.22, `piece_table_oak` 6.45 x 1.85,
   `piece_table_round` 2.5 across, `piece_chest_wood` 1.64 x 0.74 x 0.76, `piece_chest` 1.84 x 1.07 x 0.95,
   `piece_bench01` 2.41 long, `piece_logbench01` 2.38 long, `hearth` 4 x 3, `rug_deer` 3.11 square, `rug_fur`
   2.56 x 3.57, `rug_wolf` and `rug_straw` 2 x 3, `piece_bed02` 2.3 x 3.44 (collider). `piece_chair` is a low stool
   0.53 m tall. Wall torches stick out 0.3 m below the pivot; ground torches stand 0.65 m below theirs (the catalog
   has 0.75).

The models keep all of this, so pictures are right whatever the catalog says. A check that wants game sizes can read
`collider` or `colliders` from `data/piece-models.json` the same way `pieces.js` reads an in-game export.

## The checks use the game's colliders (2026-11-09)

`data/piece-solids.json` holds every piece's solid colliders (not a trigger, on a layer the player collides with in
the game's collision matrix: Default, piece, terrain, static_solid, blocker, vehicle and a few more; `piece_nonsolid`
and `item` are walked through). 578 of 685 pieces have solids; 107 have none (rugs, cloth doors, food, plants).
`lib/shapes.js` turns them into oriented boxes in world space. `lib/checks.js` uses them by default
(`check(design, biome, {shapes: false})` or `setShapes(false)` for the catalog boxes): overlaps by solid volume,
furniture clipping into walls, posts and other furniture, doorways and climbs against the solids, headroom from the
real underside of roofs, floors and level beams (anything under 0.5 m over the floor is a kerb or dais, never the
ceiling), support and stability from the catalog box and the solids together. `Ck.aabb` gives the catalog box grown
to the solids, so the generator and the details test against true sizes too. `lib/decorate.js` sizes furniture at
least as large as its solids.

`node lab/check_set.js 8` after the change: set 225 of 225 either way; cultures 147 of 147 with `--no-shapes`, 143
of 147 with the colliders. The four that fail are middle-eastern homes and taverns on Plains: the fire pit or hearth
the generator lays at the flat roof's vent stands 0.2 m or more into a 1 m stone wall, and the barrel by the court
stands in a stone_wall_1x1. Doorways blocked by a `wood_beam_45` brace (0.4 m thick in the game) and a `wood_beam`
lintel 0.1 m into the door's top were the most common new finds; the lintel is allowed (0.15 m), the brace is not.

## Every piece off by more than 10 cm

| Piece | Role | Catalog (x y z) | Game, solid collider (x y z) | Game, mesh (x y z) | Bottom below pivot: catalog / game mesh | Off by more than 10 cm |
|---|---|---|---|---|---|---|
| `ArmorStand` | deco | 0.90 x 1.90 x 0.60 | 0.55 x 1.92 x 0.30 | 1.35 x 2.03 x 1.13 | 0 / 0 | x -0.35, z -0.3 |
| `Candle_resin` | light | 0.40 x 1.20 x 0.40 | 0.15 x 0.30 x 0.15 | 0.25 x 0.32 x 0.25 | 0 / -0.02 | x -0.25, y -0.9, z -0.25 |
| `Fiddleheadfern` | deco | 1.00 x 1.00 x 0.20 | 0.42 x 0.13 x 0.54 | 0.34 x 0.33 x 0.40 | 0 / -0.11 | x -0.58, y -0.87, z +0.34, bottom -0.11 |
| `Pickable_Barley` | nature | 1.00 x 1.00 x 1.00 | 0.80 x 1.45 x 0.80 | 1.04 x 1.46 x 1.18 | 0 / -0.05 | x -0.2, y +0.45, z -0.2 |
| `Pickable_Carrot` | nature | 1.00 x 1.00 x 1.00 | 0.28 x 0.89 x 0.28 | 0.42 x 1.14 x 0.42 | 0 / -0.32 | x -0.72, y -0.11, z -0.72, bottom -0.32 |
| `Pickable_Onion` | nature | 1.00 x 1.00 x 1.00 | 0.28 x 1.00 x 0.28 | 0.82 x 1.64 x 0.83 | 0 / -0.18 | x -0.72, z -0.72, bottom -0.18 |
| `Pickable_Turnip` | nature | 1.00 x 1.00 x 1.00 | 0.28 x 1.00 x 0.28 | 0.59 x 0.93 x 0.59 | 0 / -0.17 | x -0.72, z -0.72, bottom -0.17 |
| `Piece_grausten_floor_1x1` | floor | 1.00 x 0.25 x 1.00 | 1.00 x 0.50 x 1.00 | 1.03 x 0.50 x 1.03 | -0.12 / -0.25 | y +0.25, bottom -0.12 |
| `Piece_grausten_floor_2x2` | floor | 2.00 x 0.25 x 2.00 | 2.00 x 0.50 x 2.00 | 2.04 x 0.50 x 2.04 | -0.12 / -0.25 | y +0.25, bottom -0.12 |
| `Piece_grausten_floor_4x4` | floor | 4.00 x 0.25 x 4.00 | 4.00 x 0.50 x 4.00 | 4.03 x 0.50 x 4.03 | -0.12 / -0.25 | y +0.25, bottom -0.12 |
| `Piece_grausten_wall_1x2` | wall | 1.00 x 2.00 x 0.30 | 1.00 x 2.00 x 0.40 | 1.03 x 2.05 x 0.38 | -1 / -0.01 | z +0.1, bottom +0.99 |
| `Piece_grausten_wall_2x2` | wall | 2.00 x 2.00 x 0.20 | 2.00 x 2.00 x 0.40 | 2.05 x 2.04 x 0.38 | -1 / 0 | z +0.2, bottom +1 |
| `Piece_grausten_wall_4x2` | wall | 4.00 x 2.00 x 0.40 | 4.00 x 2.00 x 0.40 | 4.10 x 2.03 x 0.38 | -1 / 0 | bottom +1 |
| `Piece_grausten_window_2x2` | window | 1.00 x 1.00 x 0.20 | 2.00 x 2.00 x 0.40 | 2.04 x 2.03 x 0.39 | -0.5 / 0 | x +1, y +1, z +0.2, bottom +0.5 |
| `RaspberryBush` | nature | 1.00 x 1.00 x 1.00 | 1.42 x 1.42 x 1.42 | 2.91 x 2.56 x 2.85 | 0 / -0.76 | x +0.42, y +0.42, z +0.42, bottom -0.76 |
| `artisan_ext1` | craft | 1.40 x 1.40 x 1.20 | 1.04 x 1.90 x 0.66 | 1.36 x 1.90 x 0.65 | 0 / 0 | x -0.36, y +0.5, z -0.54 |
| `ashwood_beam_1m` | beam | 1.00 x 0.20 x 0.20 | 1.00 x 0.40 x 0.40 | 1.02 x 0.40 x 0.40 | -0.1 / -0.2 | y +0.2, z +0.2 |
| `ashwood_beam_2m` | beam | 2.00 x 0.20 x 0.20 | 1.96 x 0.36 x 0.40 | 2.04 x 0.40 x 0.40 | -0.1 / -1.2 | y +0.16, z +0.2, bottom -1.1 |
| `ashwood_bed` | bed | 1.30 x 0.60 x 2.30 | 1.20 x 0.40 x 2.80 | 1.84 x 1.07 x 3.10 | 0 / -0.08 | x -0.1, y -0.2, z +0.5 |
| `ashwood_deco_floor` | floor | 2.00 x 0.25 x 2.00 | 2.00 x 0.13 x 2.00 | 2.00 x 0.17 x 2.00 | -0.12 / -0.07 | y -0.12 |
| `ashwood_floor_1x1` | floor | 1.00 x 0.25 x 1.00 | 1.00 x 0.13 x 1.00 | 1.03 x 0.18 x 1.02 | -0.12 / -0.1 | y -0.12 |
| `ashwood_floor_2x2` | floor | 2.00 x 0.25 x 2.00 | 2.00 x 0.13 x 2.00 | 2.04 x 0.18 x 2.02 | -0.12 / -0.1 | y -0.12 |
| `ashwood_pole_2m` | pole | 0.25 x 2.00 x 0.25 | 0.40 x 2.00 x 0.40 | 0.40 x 2.04 x 0.40 | -1 / -1.01 | x +0.15, z +0.15 |
| `ashwood_wall_2x2` | wall | 2.00 x 2.00 x 0.20 | 2.00 x 2.00 x 0.30 | 2.03 x 2.00 x 0.28 | -1 / -1 | z +0.1 |
| `ashwood_wall_roof_26` | gable | 2.00 x 1.00 x 0.20 | 2.32 x 1.63 x 0.40 | 2.29 x 1.57 x 0.44 | 0 / -0.27 | x +0.32, y +0.63, z +0.2, bottom -0.27 |
| `ashwood_wall_roof_45` | gable | 2.00 x 2.00 x 0.20 | 2.43 x 2.43 x 0.40 | 2.40 x 2.39 x 0.43 | 0 / -0.21 | x +0.43, y +0.43, z +0.2, bottom -0.21 |
| `bed` | bed | 1.20 x 0.80 x 2.80 | 1.20 x 0.40 x 2.80 | 1.70 x 0.68 x 3.13 | 0 / 0 | y -0.4 |
| `blackforge` | craft | 1.40 x 1.40 x 1.20 | 3.60 x 0.91 x 1.00 | 3.66 x 1.16 x 1.78 | 0 / 0.01 | x +2.2, y -0.49, z -0.2 |
| `blackforge_ext2_vise` | craft | 1.40 x 1.40 x 1.20 | 0.73 x 1.20 x 0.53 | 0.71 x 1.21 x 0.84 | 0 / -0.02 | x -0.67, y -0.2, z -0.67 |
| `blackmarble_1x1` | wall | 1.00 x 1.00 x 0.50 | 1.00 x 1.00 x 1.00 | 1.00 x 1.00 x 1.00 | -0.5 / -0.5 | z +0.5 |
| `blackmarble_arch` | wall | 2.00 x 2.00 x 0.50 | 2.00 x 2.00 x 1.00 | 1.99 x 2.00 x 1.00 | -1 / -1 | z +0.5 |
| `blackmarble_column_1` | pole | 0.60 x 1.00 x 0.60 | 1.00 x 1.00 x 1.00 | 1.00 x 1.00 x 1.00 | -0.5 / -0.5 | x +0.4, z +0.4 |
| `blackmarble_floor_triangle` | floor | 1.00 x 0.25 x 1.00 | 2.00 x 1.00 x 2.00 | 1.96 x 1.00 x 1.96 | -0.12 / -0.5 | x +1, y +0.75, z +1, bottom -0.37 |
| `blackmarble_tile_floor_1x1` | floor | 1.00 x 0.25 x 1.00 | 1.00 x 0.20 x 1.00 | 1.05 x 0.19 x 1.03 | -0.12 / 0 | bottom +0.13 |
| `blackmarble_tile_floor_2x2` | floor | 2.00 x 0.25 x 2.00 | 2.00 x 0.20 x 2.00 | 2.09 x 0.19 x 2.06 | -0.12 / 0 | bottom +0.13 |
| `bone_stack` | clutter | 1.60 x 0.80 x 1.20 | 0.90 x 0.50 x 0.90 | 1.01 x 0.63 x 1.05 | 0 / -0.06 | x -0.7, y -0.3, z -0.3 |
| `cauldron_ext3_butchertable` | table | 2.00 x 0.90 x 1.00 | 1.20 x 0.95 x 1.20 | 1.25 x 1.37 x 1.25 | 0 / 0.01 | x -0.8, z +0.2 |
| `cauldron_ext5_mortarandpestle` | craft | 1.20 x 1.00 x 1.20 | 1.85 x 0.88 x 0.72 | 1.98 x 0.95 x 0.99 | 0 / -0.01 | x +0.65, y -0.12, z -0.48 |
| `coal_pile` | clutter | 1.60 x 0.80 x 1.20 | 1.46 x 1.03 x 1.49 | 1.46 x 1.03 x 1.49 | 0 / -0.09 | x -0.14, y +0.23, z +0.29 |
| `crystal_wall_1x1` | wall | 1.00 x 1.00 x 0.50 | 1.00 x 1.00 x 0.30 | 1.09 x 1.18 x 0.36 | -0.5 / -0.08 | z -0.2, bottom +0.42 |
| `darkwood_beam` | beam | 2.00 x 0.20 x 0.20 | 2.00 x 0.40 x 0.40 | 2.02 x 0.41 x 0.49 | -0.1 / 0.05 | y +0.2, z +0.2, bottom +0.15 |
| `darkwood_beam4x4` | beam | 4.00 x 0.25 x 0.25 | 4.00 x 0.40 x 0.40 | 4.02 x 0.42 x 0.49 | -0.12 / 0.05 | y +0.15, z +0.15, bottom +0.17 |
| `darkwood_beam_45` | beam | 2.00 x 2.00 x 0.20 | 2.33 x 2.33 x 0.40 | 2.36 x 2.36 x 0.49 | -1 / -1.18 | x +0.33, y +0.33, z +0.2, bottom -0.18 |
| `darkwood_decowall` | wall | 2.00 x 2.00 x 0.20 | 1.00 x 2.00 x 0.10 | 1.00 x 2.00 x 0.20 | -1 / 0 | x -1, bottom +1 |
| `darkwood_pole` | pole | 0.25 x 2.00 x 0.25 | 0.40 x 2.00 x 0.40 | 0.49 x 2.02 x 0.49 | -1 / -1.01 | x +0.15, z +0.15 |
| `darkwood_pole4` | pole | 0.25 x 4.00 x 0.25 | 0.40 x 4.00 x 0.40 | 0.49 x 4.02 x 0.49 | -2 / -2.01 | x +0.15, z +0.15 |
| `darkwood_raven` | deco | 1.00 x 1.00 x 0.20 | 0.42 x 1.46 x 3.09 | 0.53 x 1.46 x 3.12 | 0 / -0.24 | x -0.58, y +0.46, z +2.89, bottom -0.24 |
| `darkwood_roof` | roof | 2.00 x 1.00 x 2.00 | 2.00 x 1.13 x 2.12 | 2.38 x 1.16 x 2.70 | -0.12 / -0.08 | y +0.13, z +0.12 |
| `darkwood_roof_45` | roof | 2.00 x 2.00 x 2.00 | 2.00 x 2.14 x 2.14 | 2.36 x 2.47 x 2.76 | -1.12 / -1.4 | y +0.14, z +0.14, bottom -0.28 |
| `darkwood_roof_top` | roofTop | 2.00 x 0.45 x 2.00 | 2.00 x 0.85 x 2.21 | 2.41 x 1.01 x 3.47 | 0 / -0.24 | y +0.4, z +0.21, bottom -0.24 |
| `darkwood_roof_top_45` | roofTop | 2.00 x 0.45 x 2.00 | 2.00 x 1.25 x 2.12 | 2.32 x 1.66 x 3.36 | 0 / -0.45 | y +0.8, z +0.12, bottom -0.45 |
| `darkwood_wolf` | deco | 1.00 x 1.00 x 0.20 | 0.83 x 1.79 x 2.18 | 0.97 x 2.05 x 2.16 | 0 / -0.72 | x -0.17, y +0.79, z +1.98, bottom -0.72 |
| `dvergrprops_barrel` | storage | 1.20 x 0.80 x 0.70 | 1.50 x 1.60 x 2.00 | 1.51 x 1.59 x 1.78 | 0 / 0 | x +0.3, y +0.8, z +1.3 |
| `dvergrprops_crate` | storage | 1.20 x 0.80 x 0.70 | 1.02 x 1.02 x 1.02 | 1.02 x 1.02 x 1.02 | 0 / 0 | x -0.18, y +0.22, z +0.32 |
| `dvergrprops_lantern_standing` | light | 0.40 x 1.20 x 0.40 | 0.30 x 0.55 x 0.30 | 0.36 x 0.66 x 0.36 | 0 / 0.02 | x -0.1, y -0.65, z -0.1 |
| `dvergrprops_wood_floor` | floor | 2.00 x 0.25 x 2.00 | 2.00 x 0.13 x 2.00 | 2.07 x 0.25 x 2.09 | -0.12 / -0.12 | y -0.12 |
| `fermenter` | craft | 1.40 x 1.80 x 1.40 | 1.60 x 2.20 x 1.55 | 1.68 x 2.20 x 2.02 | 0 / 0 | x +0.2, y +0.4, z +0.15 |
| `fire_pit` | fire | 1.60 x 0.40 x 1.60 | 1.40 x 0.20 x 1.40 | 1.58 x 0.27 x 1.51 | 0 / -0.08 | x -0.2, y -0.2, z -0.2 |
| `fire_pit_iron` | fire | 1.60 x 0.40 x 1.60 | 1.27 x 1.20 x 1.27 | 1.50 x 1.08 x 1.50 | 0 / 0 | x -0.33, y +0.8, z -0.33 |
| `forge` | craft | 1.40 x 1.40 x 1.20 | 1.80 x 0.91 x 1.00 | 1.87 x 1.25 x 1.17 | 0 / 0 | x +0.4, y -0.49, z -0.2 |
| `forge_ext1` | craft | 1.40 x 1.40 x 1.20 | 1.76 x 1.91 x 1.59 | 1.76 x 1.91 x 1.59 | 0 / 0 | x +0.36, y +0.51, z +0.39 |
| `forge_ext2` | craft | 1.40 x 1.40 x 1.20 | 0.84 x 0.84 x 0.90 | 0.84 x 0.84 x 0.90 | 0 / 0 | x -0.56, y -0.56, z -0.3 |
| `forge_ext3` | craft | 1.40 x 1.40 x 1.20 | 0.75 x 1.41 x 1.05 | 0.75 x 1.41 x 1.05 | 0 / 0 | x -0.65, z -0.15 |
| `forge_ext4` | craft | 1.40 x 1.40 x 1.20 | 0.90 x 1.40 x 0.90 | 0.90 x 1.40 x 1.27 | 0 / 0.04 | x -0.5, z -0.3 |
| `forge_ext5` | craft | 1.40 x 1.40 x 1.20 | 0.95 x 1.00 x 0.94 | 0.95 x 1.00 x 0.94 | 0 / 0 | x -0.45, y -0.4, z -0.26 |
| `forge_ext6` | craft | 1.40 x 1.40 x 1.20 | 2.50 x 0.30 x 0.20 | 2.50 x 0.94 x 0.41 | 0 / -0.7 | x +1.1, y -1.1, z -1, bottom -0.7 |
| `goblinking_totemholder` | deco | 1.00 x 1.00 x 0.20 | 0.40 x 0.21 x 0.40 | 0.40 x 0.21 x 0.40 | 0 / 0 | x -0.6, y -0.79, z +0.2 |
| `guard_stone` | deco | 0.60 x 1.50 x 0.60 | 1.03 x 1.61 x 0.78 | 1.03 x 1.61 x 0.78 | 0 / 0 | x +0.43, y +0.11, z +0.18 |
| `hearth` | fire | 3.20 x 0.60 x 2.00 | 4.00 x 0.60 x 3.00 | 4.12 x 0.76 x 3.10 | 0 / -0.01 | x +0.8, z +1 |
| `iron_floor_1x1_v2` | floor | 1.00 x 0.25 x 1.00 | 1.00 x 0.10 x 1.00 | 1.00 x 0.12 x 1.16 | -0.12 / -0.54 | y -0.15, bottom -0.41 |
| `iron_floor_2x2` | floor | 2.00 x 0.25 x 2.00 | 2.00 x 0.10 x 2.00 | 2.00 x 0.12 x 2.16 | -0.12 / -0.04 | y -0.15 |
| `itemstand` | deco | 1.00 x 1.00 x 0.20 | 0.50 x 0.55 x 0.09 | 0.50 x 0.50 x 0.20 | 0 / -0.25 | x -0.5, y -0.45, z -0.11, bottom -0.25 |
| `itemstandh` | deco | 1.00 x 1.00 x 0.20 | 0.20 x 0.04 x 0.20 | 0.20 x 0.06 x 0.20 | 0 / -0.02 | x -0.8, y -0.96 |
| `jute_carpet` | rug | 2.00 x 0.05 x 2.60 | 3.99 x 0.14 x 3.00 | 3.99 x 0.09 x 3.00 | 0 / 0.03 | x +1.99, z +0.4 |
| `jute_carpet_blue` | rug | 2.00 x 0.05 x 2.60 | 3.00 x 0.09 x 3.00 | 3.00 x 0.06 x 3.00 | 0 / 0.03 | x +1, z +0.4 |
| `piece_Lavalantern` | light | 0.40 x 1.20 x 0.40 | 0.41 x 0.81 x 0.38 | 0.38 x 0.82 x 0.38 | 0 / -0.01 | y -0.39 |
| `piece_artisanstation` | craft | 1.40 x 1.40 x 1.20 | 2.65 x 2.46 x 1.15 | 2.76 x 2.59 x 1.90 | 0 / -0.01 | x +1.25, y +1.06 |
| `piece_banner01` | deco | 1.00 x 2.00 x 0.20 | 0.20 x 0.20 x 1.41 | 0.20 x 3.03 x 1.41 | -2 / -2.93 | x -0.8, y -1.8, z +1.21, bottom -0.93 |
| `piece_banner02` | deco | 1.00 x 2.00 x 0.20 | 0.20 x 0.20 x 1.41 | 0.20 x 3.03 x 1.41 | -2 / -2.93 | x -0.8, y -1.8, z +1.21, bottom -0.93 |
| `piece_banner03` | deco | 1.00 x 2.00 x 0.20 | 0.20 x 0.20 x 1.41 | 0.20 x 3.03 x 1.41 | -2 / -2.93 | x -0.8, y -1.8, z +1.21, bottom -0.93 |
| `piece_banner04` | deco | 1.00 x 2.00 x 0.20 | 0.20 x 0.20 x 1.41 | 0.20 x 3.03 x 1.41 | -2 / -2.93 | x -0.8, y -1.8, z +1.21, bottom -0.93 |
| `piece_banner05` | deco | 1.00 x 2.00 x 0.20 | 0.20 x 0.20 x 1.41 | 0.20 x 3.03 x 1.41 | -2 / -2.93 | x -0.8, y -1.8, z +1.21, bottom -0.93 |
| `piece_banner06` | deco | 1.00 x 2.00 x 0.20 | 0.20 x 0.20 x 1.41 | 0.20 x 3.03 x 1.41 | -2 / -2.93 | x -0.8, y -1.8, z +1.21, bottom -0.93 |
| `piece_banner07` | deco | 1.00 x 2.00 x 0.20 | 0.20 x 0.20 x 1.41 | 0.20 x 3.03 x 1.41 | -2 / -2.93 | x -0.8, y -1.8, z +1.21, bottom -0.93 |
| `piece_banner08` | deco | 1.00 x 2.00 x 0.20 | 0.20 x 0.20 x 1.41 | 0.20 x 3.03 x 1.41 | -2 / -2.93 | x -0.8, y -1.8, z +1.21, bottom -0.93 |
| `piece_banner09` | deco | 1.00 x 2.00 x 0.20 | 0.20 x 0.20 x 1.41 | 0.20 x 3.03 x 1.41 | -2 / -2.93 | x -0.8, y -1.8, z +1.21, bottom -0.93 |
| `piece_banner10` | deco | 1.00 x 2.00 x 0.20 | 0.20 x 0.20 x 1.41 | 0.20 x 3.03 x 1.41 | -2 / -2.93 | x -0.8, y -1.8, z +1.21, bottom -0.93 |
| `piece_banner11` | deco | 1.00 x 2.00 x 0.20 | 0.20 x 0.20 x 1.41 | 0.20 x 3.03 x 1.41 | -2 / -2.93 | x -0.8, y -1.8, z +1.21, bottom -0.93 |
| `piece_bathtub` | craft | 1.20 x 1.20 x 1.20 | 3.17 x 2.24 x 3.81 | 3.29 x 2.29 x 3.68 | 0 / -0.03 | x +1.97, y +1.04, z +2.61 |
| `piece_bed02` | bed | 2.00 x 1.00 x 3.30 | 2.30 x 1.50 x 3.44 | 2.79 x 1.75 x 3.49 | 0 / -0.01 | x +0.3, y +0.5, z +0.14 |
| `piece_bench01` | seat | 2.00 x 0.50 x 0.60 | 2.41 x 0.55 x 0.65 | 2.50 x 0.54 x 0.61 | 0 / 0 | x +0.41 |
| `piece_blackmarble_bench` | seat | 2.00 x 0.50 x 0.60 | 2.54 x 0.99 x 0.63 | 2.55 x 1.01 x 0.63 | 0 / 0 | x +0.54, y +0.49 |
| `piece_blackmarble_table` | table | 2.00 x 0.90 x 1.00 | 2.45 x 0.82 x 1.33 | 2.56 x 0.82 x 1.49 | 0 / 0 | x +0.45, z +0.33 |
| `piece_blackmarble_throne` | seat | 1.00 x 1.60 x 1.00 | 1.39 x 2.97 x 1.09 | 1.61 x 2.94 x 1.20 | 0 / 0 | x +0.39, y +1.37 |
| `piece_blackwood_bench01` | seat | 2.00 x 0.50 x 0.60 | 1.98 x 0.56 x 1.97 | 2.04 x 0.50 x 2.04 | 0 / 0 | z +1.37 |
| `piece_bone_throne` | seat | 1.00 x 1.60 x 1.00 | 1.39 x 2.97 x 0.79 | 1.56 x 3.17 x 0.83 | 0 / -0.04 | x +0.39, y +1.37, z -0.21 |
| `piece_brazierceiling01` | light | 0.40 x 1.20 x 0.40 | 0.97 x 1.96 x 0.91 | 1.00 x 1.95 x 0.99 | 0 / 0.03 | x +0.57, y +0.76, z +0.51 |
| `piece_cartographytable` | table | 2.00 x 0.90 x 1.00 | 3.93 x 1.39 x 1.95 | 4.24 x 1.61 x 2.50 | 0 / 0 | x +1.93, y +0.49, z +0.95 |
| `piece_cauldron` | craft | 1.20 x 1.00 x 1.20 | 0.94 x 1.40 x 0.94 | 1.38 x 2.46 x 1.51 | 0 / -0.25 | x -0.26, y +0.4, z -0.26, bottom -0.25 |
| `piece_chair` | seat | 0.60 x 1.00 x 0.60 | 0.54 x 0.53 x 0.50 | 0.59 x 0.52 x 0.50 | 0 / 0.07 | y -0.47, z -0.1 |
| `piece_chair02` | seat | 0.60 x 1.00 x 0.60 | 0.55 x 1.20 x 0.94 | 0.51 x 1.20 x 1.14 | 0 / 0 | y +0.2, z +0.34 |
| `piece_chair03` | seat | 0.60 x 1.00 x 0.60 | 0.55 x 1.21 x 0.57 | 0.59 x 1.28 x 0.62 | 0 / -0.01 | y +0.21 |
| `piece_chair_runed` | seat | 0.60 x 1.00 x 0.60 | 0.55 x 1.19 x 0.90 | 0.47 x 1.24 x 1.13 | 0 / -0.03 | y +0.19, z +0.3 |
| `piece_chest` | storage | 1.20 x 0.80 x 0.70 | 1.84 x 1.07 x 0.95 | 1.84 x 1.09 x 0.97 | 0 / 0 | x +0.64, y +0.27, z +0.25 |
| `piece_chest_barrel` | storage | 0.70 x 1.00 x 0.70 | 0.80 x 0.90 x 0.80 | 0.80 x 0.90 x 0.80 | 0 / 0 | y -0.1, z +0.1 |
| `piece_chest_blackmetal` | storage | 1.20 x 0.80 x 0.70 | 2.06 x 0.92 x 1.35 | 2.31 x 1.04 x 1.52 | 0 / 0 | x +0.86, y +0.12, z +0.65 |
| `piece_chest_grausten` | storage | 1.20 x 0.80 x 0.70 | 1.31 x 0.72 x 1.13 | 1.71 x 1.17 x 1.21 | 0 / 0 | x +0.11, z +0.43 |
| `piece_chest_private` | storage | 1.20 x 0.80 x 0.70 | 0.92 x 0.54 x 0.48 | 0.92 x 0.54 x 0.49 | 0 / 0 | x -0.28, y -0.26, z -0.22 |
| `piece_chest_treasure` | storage | 1.20 x 0.80 x 0.70 | 1.16 x 0.52 x 0.76 | 1.16 x 0.58 x 1.00 | 0 / 0 | y -0.28 |
| `piece_chest_warderobe` | storage | 1.20 x 0.80 x 0.70 | 1.35 x 2.09 x 0.85 | 1.68 x 2.67 x 1.11 | 0 / 0.01 | x +0.15, y +1.29, z +0.15 |
| `piece_chest_wood` | storage | 1.20 x 0.80 x 0.70 | 1.64 x 0.74 x 0.76 | 1.64 x 0.79 x 0.76 | 0 / 0 | x +0.44 |
| `piece_cloth_hanging_door` | door | 0.20 x 2.00 x 2.00 | 0.20 x 0.20 x 1.13 | 0.20 x 2.50 x 1.13 | -2 / -2.4 | y -1.8, z -0.87, bottom -0.4 |
| `piece_cookingstation` | craft | 1.20 x 1.00 x 1.20 | 1.73 x 1.28 x 0.78 | 1.73 x 1.28 x 0.78 | 0 / -0.18 | x +0.53, y +0.28, z -0.42, bottom -0.18 |
| `piece_cookingstation_iron` | craft | 1.20 x 1.00 x 1.20 | 3.60 x 2.08 x 1.00 | 4.73 x 2.70 x 0.96 | 0 / -0.3 | x +2.4, y +1.08, z -0.2, bottom -0.3 |
| `piece_dvergr_lantern` | light | 0.40 x 1.20 x 0.40 | 1.11 x 1.21 x 0.78 | 1.14 x 1.34 x 0.67 | 0 / -0.89 | x +0.71, z +0.38, bottom -0.89 |
| `piece_groundtorch` | light | 0.40 x 1.50 x 0.40 | 0.23 x 1.48 x 0.24 | 0.23 x 1.48 x 0.24 | -0.75 / -0.65 | x -0.17, z -0.16 |
| `piece_groundtorch_blue` | light | 0.40 x 1.50 x 0.40 | 0.23 x 1.48 x 0.24 | 0.23 x 1.48 x 0.24 | -0.75 / -0.65 | x -0.17, z -0.16 |
| `piece_groundtorch_green` | light | 0.40 x 1.50 x 0.40 | 0.23 x 1.48 x 0.24 | 0.23 x 1.48 x 0.24 | -0.75 / -0.65 | x -0.17, z -0.16 |
| `piece_groundtorch_mist` | light | 0.40 x 1.50 x 0.40 | 0.23 x 0.95 x 0.24 | 0.30 x 1.20 x 0.30 | -0.75 / -0.65 | x -0.17, y -0.55, z -0.16, bottom +0.1 |
| `piece_groundtorch_wood` | light | 0.40 x 1.50 x 0.40 | 0.12 x 1.41 x 0.13 | 0.12 x 1.41 x 0.13 | -0.75 / -0.65 | x -0.28, z -0.27 |
| `piece_jackoturnip` | deco | 1.00 x 1.00 x 0.20 | 0.61 x 0.61 x 0.61 | 0.61 x 0.69 x 0.59 | 0 / 0 | x -0.39, y -0.39, z +0.41 |
| `piece_logbench01` | seat | 1.40 x 0.50 x 0.60 | 2.38 x 0.57 x 0.58 | 2.70 x 0.59 x 0.63 | 0 / -0.1 | x +0.98, bottom -0.1 |
| `piece_magetable` | table | 2.00 x 0.90 x 1.00 | 2.64 x 2.69 x 2.19 | 3.56 x 2.73 x 3.32 | 0 / -0.04 | x +0.64, y +1.79, z +1.19 |
| `piece_magetable_ext` | table | 2.00 x 0.90 x 1.00 | 1.00 x 1.08 x 1.00 | 1.01 x 1.09 x 1.01 | 0 / -0.01 | x -1, y +0.18 |
| `piece_magetable_ext2` | table | 2.00 x 0.90 x 1.00 | 0.59 x 1.12 x 0.59 | 0.62 x 1.14 x 0.62 | 0 / 0 | x -1.41, y +0.22, z -0.41 |
| `piece_oven` | craft | 1.20 x 1.00 x 1.20 | 3.00 x 2.37 x 2.00 | 3.03 x 2.38 x 2.00 | 0 / 0 | x +1.8, y +1.37, z +0.8 |
| `piece_preptable` | table | 2.00 x 0.90 x 1.00 | 2.54 x 1.12 x 0.60 | 2.53 x 1.22 x 0.69 | 0 / -0.03 | x +0.54, y +0.22, z -0.4 |
| `piece_spinningwheel` | craft | 1.40 x 1.40 x 1.20 | 2.04 x 2.27 x 2.67 | 1.89 x 2.16 x 2.96 | 0 / -0.01 | x +0.64, y +0.87, z +1.47 |
| `piece_stonecutter` | craft | 1.40 x 1.40 x 1.20 | 3.23 x 1.81 x 1.50 | 3.28 x 2.08 x 1.63 | 0 / 0 | x +1.83, y +0.41, z +0.3 |
| `piece_table` | table | 2.00 x 0.90 x 1.00 | 2.45 x 0.79 x 1.22 | 2.50 x 0.83 x 1.25 | 0 / -0.01 | x +0.45, y -0.11, z +0.22 |
| `piece_table_oak` | table | 4.20 x 0.80 x 1.60 | 6.45 x 0.79 x 1.85 | 6.60 x 0.82 x 1.92 | 0 / -0.01 | x +2.25, z +0.25 |
| `piece_table_round` | table | 1.70 x 0.90 x 1.70 | 2.53 x 0.80 x 2.46 | 2.53 x 0.82 x 2.51 | 0 / -0.02 | x +0.83, y -0.1, z +0.76 |
| `piece_throne01` | seat | 1.00 x 1.60 x 1.00 | 1.40 x 2.49 x 0.84 | 2.12 x 2.79 x 0.94 | 0 / 0 | x +0.4, y +0.89, z -0.16 |
| `piece_throne02` | seat | 1.00 x 1.60 x 1.00 | 1.43 x 2.95 x 0.88 | 1.62 x 2.97 x 1.13 | 0 / 0 | x +0.43, y +1.35, z -0.12 |
| `piece_walltorch` | light | 0.30 x 0.80 x 0.30 | 0.45 x 0.95 x 0.31 | 0.45 x 0.95 x 0.31 | 0 / -0.33 | x +0.15, y +0.15, bottom -0.33 |
| `piece_workbench` | table | 2.00 x 0.90 x 1.00 | 3.01 x 1.03 x 1.10 | 3.05 x 1.85 x 1.33 | 0 / -0.02 | x +1.01, y +0.13, z +0.1 |
| `piece_workbench_ext1` | seat | 2.00 x 0.50 x 0.60 | 0.81 x 1.02 x 0.72 | 0.98 x 1.14 x 0.72 | 0 / 0 | x -1.19, y +0.52, z +0.12 |
| `piece_workbench_ext2` | seat | 2.00 x 0.50 x 0.60 | 2.01 x 1.75 x 0.60 | 2.41 x 1.99 x 1.22 | 0 / -0.04 | y +1.25 |
| `piece_workbench_ext3` | seat | 2.00 x 0.50 x 0.60 | 2.15 x 1.29 x 1.09 | 2.19 x 1.45 x 1.33 | 0 / -0.35 | x +0.15, y +0.79, z +0.49, bottom -0.35 |
| `piece_workbench_ext4` | seat | 2.00 x 0.50 x 0.60 | 1.50 x 1.30 x 0.30 | 1.80 x 1.66 x 0.44 | 0 / -0.37 | x -0.5, y +0.8, z -0.3, bottom -0.37 |
| `piece_xmastree` | deco | 1.00 x 1.00 x 0.20 | 1.56 x 2.72 x 1.80 | 1.56 x 2.80 x 1.80 | 0 / -0.17 | x +0.56, y +1.72, z +1.6, bottom -0.17 |
| `portal_wood` | craft | 3.00 x 3.00 x 1.00 | 4.23 x 3.29 x 1.18 | 4.23 x 3.29 x 1.18 | 0 / -0.01 | x +1.23, y +0.29, z +0.18 |
| `rug_Bjorn` | rug | 2.00 x 0.05 x 2.60 | 5.00 x 0.68 x 4.66 | 4.25 x 1.13 x 5.07 | 0 / -0.16 | x +3, y +0.63, z +2.06, bottom -0.16 |
| `rug_asksvin` | rug | 2.00 x 0.05 x 2.60 | 2.67 x 0.05 x 2.57 | 3.00 x 0.02 x 3.00 | 0 / 0.03 | x +0.67 |
| `rug_deer` | rug | 2.00 x 0.05 x 2.60 | 3.11 x 0.07 x 3.11 | 3.11 x 0.01 x 3.11 | 0 / 0.06 | x +1.11, z +0.51 |
| `rug_fur` | rug | 2.00 x 0.05 x 2.60 | 2.56 x 0.05 x 3.57 | 3.06 x 0.08 x 3.97 | 0 / 0.03 | x +0.56, z +0.97 |
| `rug_hare` | rug | 2.00 x 0.05 x 2.60 | 0.98 x 0.03 x 1.57 | 1.08 x 0.02 x 1.85 | 0 / 0.03 | x -1.02, z -1.03 |
| `rug_straw` | rug | 2.00 x 0.05 x 2.60 | 2.00 x 0.05 x 3.00 | 2.12 x 0.27 x 2.09 | 0 / -0.03 | z +0.4 |
| `rug_wolf` | rug | 2.00 x 0.05 x 2.60 | 2.00 x 0.05 x 3.00 | 2.55 x 0.11 x 3.46 | 0 / 0.03 | z +0.4 |
| `sign` | deco | 1.00 x 1.00 x 0.20 | 1.00 x 0.55 x 0.09 | 1.00 x 0.50 x 0.10 | 0 / -0.25 | y -0.45, z -0.11, bottom -0.25 |
| `stone_floor` | floor | 2.00 x 0.25 x 2.00 | 4.00 x 1.00 x 4.00 | 4.00 x 1.00 x 4.00 | -0.12 / -0.5 | x +2, y +0.75, z +2, bottom -0.37 |
| `stone_pile` | clutter | 1.60 x 0.80 x 1.20 | 1.67 x 0.92 x 1.54 | 1.67 x 0.92 x 1.54 | 0 / -0.09 | y +0.12, z +0.34 |
| `stone_stair` | stair | 1.00 x 2.00 x 2.00 | 2.04 x 1.00 x 2.00 | 2.04 x 1.00 x 2.00 | -1 / 0 | x +1.04, y -1, bottom +1 |
| `stone_wall_4x2` | wall | 4.00 x 2.00 x 0.40 | 4.00 x 2.00 x 1.00 | 4.22 x 2.22 x 1.34 | -1 / -1.11 | z +0.6, bottom -0.11 |
| `treasure_pile` | clutter | 1.60 x 0.80 x 1.20 | 1.50 x 0.27 x 1.51 | 2.30 x 0.40 x 2.30 | 0 / 0.04 | x -0.1, y -0.53, z +0.31 |
| `treasure_stack` | clutter | 1.60 x 0.80 x 1.20 | 0.25 x 0.54 x 0.27 | 0.37 x 0.54 x 0.42 | 0 / 0.02 | x -1.35, y -0.26, z -0.93 |
| `wood_beam` | beam | 2.00 x 0.20 x 0.20 | 2.00 x 0.40 x 0.40 | 2.00 x 0.40 x 0.40 | -0.1 / -0.2 | y +0.2, z +0.2 |
| `wood_beam_1` | beam | 1.00 x 0.20 x 0.20 | 1.00 x 0.40 x 0.40 | 1.00 x 0.40 x 0.40 | -0.1 / -0.2 | y +0.2, z +0.2 |
| `wood_beam_45` | beam | 2.00 x 2.00 x 0.20 | 2.43 x 2.43 x 0.40 | 2.41 x 2.41 x 0.40 | -1 / -1.2 | x +0.43, y +0.43, z +0.2, bottom -0.2 |
| `wood_core_stack` | clutter | 1.60 x 0.80 x 1.20 | 1.99 x 1.31 x 2.22 | 1.99 x 1.32 x 2.22 | 0 / -0.04 | x +0.39, y +0.51, z +1.02 |
| `wood_door` | door | 2.00 x 2.00 x 0.20 | 2.00 x 2.02 x 0.50 | 2.00 x 2.02 x 0.50 | -1 / -1.01 | z +0.3 |
| `wood_dragon1` | deco | 1.00 x 1.00 x 0.20 | 0.58 x 1.46 x 3.34 | 0.59 x 1.49 x 3.32 | 0 / -0.26 | x -0.42, y +0.46, z +3.14, bottom -0.26 |
| `wood_fence` | fence | 2.00 x 1.00 x 0.20 | 2.69 x 2.08 x 0.29 | 2.69 x 2.30 x 0.31 | -0.5 / -0.16 | x +0.69, y +1.08, bottom +0.34 |
| `wood_fine_stack` | clutter | 1.60 x 0.80 x 1.20 | 1.90 x 0.90 x 1.90 | 2.08 x 1.10 x 2.08 | 0 / -0.08 | x +0.3, z +0.7 |
| `wood_floor` | floor | 2.00 x 0.25 x 2.00 | 2.00 x 0.13 x 2.00 | 2.01 x 0.22 x 2.00 | -0.12 / -0.14 | y -0.12 |
| `wood_floor_1x1` | floor | 1.00 x 0.25 x 1.00 | 1.00 x 0.13 x 1.00 | 0.99 x 0.10 x 1.00 | -0.12 / -0.02 | y -0.12, bottom +0.11 |
| `wood_gate` | door | 2.00 x 2.00 x 0.20 | 1.98 x 3.00 x 0.50 | 1.99 x 3.03 x 0.50 | -1 / -1.03 | y +1, z +0.3 |
| `wood_log_26` | beam | 2.00 x 1.00 x 0.20 | 2.23 x 1.45 x 0.50 | 2.45 x 1.59 x 0.63 | -0.5 / -0.3 | x +0.23, y +0.45, z +0.3, bottom +0.2 |
| `wood_pole` | pole | 0.20 x 1.00 x 0.20 | 0.40 x 1.00 x 0.40 | 0.40 x 1.00 x 0.40 | -0.5 / -0.5 | x +0.2, z +0.2 |
| `wood_pole2` | pole | 0.25 x 2.00 x 0.25 | 0.40 x 2.00 x 0.40 | 0.40 x 2.00 x 0.40 | -1 / -1 | x +0.15, z +0.15 |
| `wood_pole_log` | pole | 0.25 x 2.00 x 0.25 | 0.40 x 2.00 x 0.40 | 0.53 x 2.22 x 0.55 | -1 / -1.11 | x +0.15, z +0.15, bottom -0.11 |
| `wood_pole_log_4` | pole | 0.25 x 4.00 x 0.25 | 0.40 x 4.00 x 0.40 | 0.53 x 4.44 x 0.55 | -2 / -2.21 | x +0.15, z +0.15, bottom -0.21 |
| `wood_roof` | roof | 2.00 x 1.00 x 2.00 | 2.00 x 1.13 x 2.12 | 2.22 x 1.61 x 2.96 | -0.12 / -0.35 | y +0.13, z +0.12, bottom -0.23 |
| `wood_roof_45` | roof | 2.00 x 2.00 x 2.00 | 2.00 x 2.12 x 2.12 | 2.21 x 2.79 x 2.92 | -1.12 / -1.4 | y +0.12, z +0.12, bottom -0.28 |
| `wood_roof_top` | roofTop | 2.00 x 0.45 x 2.00 | 2.00 x 0.91 x 2.21 | 2.21 x 0.98 x 2.87 | 0 / -0.17 | y +0.46, z +0.21, bottom -0.17 |
| `wood_roof_top_45` | roofTop | 2.00 x 0.45 x 2.00 | 2.00 x 1.21 x 2.12 | 2.20 x 1.27 x 2.58 | 0 / -0.12 | y +0.76, z +0.12, bottom -0.12 |
| `wood_stack` | clutter | 1.60 x 0.80 x 1.20 | 2.46 x 1.28 x 2.31 | 2.46 x 1.30 x 2.31 | 0 / -0.58 | x +0.86, y +0.48, z +1.11, bottom -0.58 |
| `wood_stair` | stair | 1.00 x 2.00 x 2.00 | 2.00 x 1.12 x 2.03 | 2.00 x 1.18 x 2.09 | -1 / -0.13 | x +1, y -0.88, bottom +0.87 |
| `wood_stepladder` | stair | 1.00 x 2.00 x 2.00 | 1.00 x 2.16 x 2.16 | 1.00 x 2.15 x 2.15 | 0 / -0.07 | y +0.16, z +0.16 |
| `wood_wall_quarter` | wall | 2.00 x 0.50 x 0.20 | 1.00 x 1.00 x 0.30 | 1.01 x 1.00 x 0.43 | -0.25 / 0 | x -1, y +0.5, bottom +0.25 |
| `wood_wall_roof` | gable | 2.00 x 1.00 x 0.20 | 2.27 x 1.54 x 0.40 | 2.26 x 1.51 x 0.40 | 0 / -0.26 | x +0.27, y +0.54, z +0.2, bottom -0.26 |
| `wood_wall_roof_45` | gable | 2.00 x 2.00 x 0.20 | 2.43 x 2.43 x 0.40 | 2.41 x 2.41 x 0.40 | 0 / -0.2 | x +0.43, y +0.43, z +0.2, bottom -0.2 |
| `wood_window` | window | 1.00 x 1.00 x 0.20 | 1.15 x 1.05 x 0.36 | 1.15 x 1.05 x 0.36 | -0.5 / -0.52 | x +0.15, z +0.16 |
