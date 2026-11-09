# Coverage: what well-liked builds have and the generator does not

Made by `tools/blueprint-lab/lab/coverage.js` (2026-11-09). Corpus: the top quarter by downloads of the vanilla-only builds with downloads (183 builds, 449 downloads or more), 153 of them buildings (12 wall pieces or more). Generated: 365 buildings, every type in every biome at s1d1, s2d2 and s3d3 and every village culture's samples (seed 1, one try each).

Both sides go through the same measure (see the head of the script). Shares are of buildings. The gap is the corpus share less the generated share, in points; prefab groups count four fifths. Numbers from a measure this rough are a guide: a few points either way mean little.

## The 20 biggest gaps

| # | Kind | What | Corpus | Generated | Generated s3 | Gap | Example source builds |
|---|---|---|---|---|---|---|---|
| 1 | feature | gateDoor: gates used as doors | 65 % | 6 % | 6 % | 60 | Starter Community Home (starter-community-home, 4000 dl); Open longboat dock (open-longboat-dock, 3600 dl); Endgame Base for 10 Players (endgame-base-for-10-players, 3300 dl) |
| 2 | feature | roofCross: the crossed gable boards | 59 % | 10 % | 15 % | 50 | Lin's Fancy mountain house with underground workshop vbuild (fancy-mountain-house-with-underground-workshop-vbuild, 2800 dl); Mage house, inspired by Apudma (mage-house-wip-inspired-by-apudma, 2600 dl); Tavern in the meadows (contest) (tavern-in-the-meadows-contest, 2000 dl) |
| 3 | size | taller than 10 m: from the ground to the highest structural piece | 78 % | 29 % | 52 % | 49 | medieval walls #1 (medieval-walls-1, 2500 dl); Lin's beautiful mansion (lin-s-beautifull-mansion, 2100 dl); Lin's Survival farm-all purpose base vbuild (survival-farm-all-purpose-base, 2000 dl) |
| 4 | feature | oneByOne: 1 x 1 wall pieces on the outside | 70 % | 23 % | 17 % | 47 | gate to the castle #4 (gate-to-the-castle-4, 2000 dl); Multiplayer Base (multiplayer-base, 1900 dl); Hunter Cabin (hunter-cabin, 1700 dl) |
| 5 | size | three storeys or more: upper floor levels inside the footprint | 59 % | 15 % | 26 % | 45 | A cozy home for a friendly company of Vikings (a-cozy-home-for-a-friendly-company-of-vikings, 1500 dl); Treehouse (treehouse, 1500 dl); Thortress Castle (thortress-castle, 1400 dl) |
| 6 | feature | tower: a tower (tall for its footprint) | 54 % | 10 % | 14 % | 45 | A teeny house for a friendly family of 4 Vikings (1900inst) (a-teeny-house-for-a-friendly-family-of-4-vikings-1900inst, 1300 dl); Garllok's Longhouse Tutorial (garllok-039-s-longhouse-tutorial, 1300 dl); medieval watchtower #2.1 (medieval-watchtower-2-1, 1300 dl) |
| 7 | feature | stoneArch: arches | 44 % | 2 % | 3 % | 43 | Decorative portal buildings 11-15 (decorative-portal-buildings-11-15, 1400 dl); Medieval Church (medieval-church, 1200 dl); main tower of the castle #5 (main-tower-of-the-castle-5, 1200 dl) |
| 8 | feature | wallTorchOut: wall torches, sconces or hanging lanterns on the outside | 47 % | 5 % | 9 % | 42 | Warehouse (warehouse, 1400 dl); halls of valhalla (halls-of-valhalla, 1200 dl); The GRAND Forge - Valheim Build (the-grand-forge, 1200 dl) |
| 9 | feature | ironTrim: iron-bound beams or poles | 44 % | 3 % | 4 % | 41 | gigantic medieval watchtower #3 (gigantic-medieval-watchtower-3, 1200 dl); Dwarf Statue (dwarf-statue-1103, 1200 dl); Community Longhouse (community-longhouse, 1100 dl) |
| 10 | feature | stairEntry: stairs outside the walls | 78 % | 38 % | 47 % | 39 | Decorative starter building for small community (decorative-starter-building-for-small-community, 1300 dl); Сompact 4-storey house (ompact-4-storey-house, 1200 dl); medieval style mansion (medieval-style-mansion, 1100 dl) |
| 11 | feature | balcony: an upper floor past the walls with a rail | 46 % | 8 % | 10 % | 38 | Town Bakery Kitchen Open Floor Concept Download (town-bakery-kitchen-open-floor-concept-download, 1100 dl); Lin's Cute little Blacksmith vbuild. (cute-little-blacksmith-vbuild, 1000 dl); Medieval Blacksmith's Home and dock w/Download (small-blacksmith-s-house-and-dock-w-download, 1000 dl) |
| 12 | feature | valley: roof valleys (inner corner pieces) | 38 % | 0 % | 0 % | 38 | compact house for survival (compact-house-for-survival, 1000 dl); Large Manor house (large-manor-house, 1000 dl); small house for the endgame (small-house-for-the-endgame, 1000 dl) |
| 13 | feature | stoneFloorOut: stone paving outside | 39 % | 2 % | 2 % | 37 | Medieval Greek bridge Height 18meters (medieval-greek-bridge-height-18meters, 1100 dl); Deep North 1.0 Ready Base (deep-north-1-0-ready-base, 1000 dl); Portal Halle / Round Portal Hub (portal-halle-round-portal-hub, 1000 dl) |
| 14 | feature | deck: a deck or terrace at the foot, 8 square meters or more | 44 % | 8 % | 8 % | 35 | BEAUTIFUL Cozy Cabin - Valheim Vanilla Build (beautiful-cozy-cabin-valheim-vanilla-build, 1000 dl); Community Portal Hub SS (community-portal-hub-ss, 1000 dl); The Wizard's Rook (the-wizard-s-rook, 1000 dl) |
| 15 | feature | decowall: carved panels and dividers | 34 % | 0 % | 1 % | 34 | crane to decorate your port (crane-to-decorate-your-port, 1000 dl); Kai's tavern (kai-s-tavern, 1000 dl); Дом комфорт (-1838, 986 dl) |
| 16 | prefab | wall torches and sconces: on or outside the walls | 47 % | 5 % | 9 % | 33 | Storage Clutter (storage-clutter, 982 dl); Lin's Japanese themed base called Kuzuri (lin-s-japanese-themed-base-called-kuzuri, 886 dl); Plains triple round house (plains-triple-round-house, 857 dl) |
| 17 | feature | seatOutside: seats outside | 37 % | 5 % | 9 % | 32 | portal hub (portal-hub-1797, 867 dl); Multi-storey fantasy-style base (7400 instances) (multi-storey-fantasy-style-base-7400-instances, 819 dl); Mistvale Keep (mistvale-keep, 786 dl) |
| 18 | size | footprint over 150 square meters: main footprint | 55 % | 24 % | 47 % | 31 | Mountain Stronghold (mountain-stronghold-1690, 857 dl); Ultimate Outpost (ultimate-outpost, 852 dl); Glass Portal Hub (glass-portal-hub, 851 dl) |
| 19 | feature | craftOutside: crafting stations outside as props | 33 % | 3 % | 3 % | 30 | Fantasy Mage House w/download (apudma-s-mage-house, 721 dl); Fogbreaker Fortress (fogbreaker-fortress, 708 dl); Cosy home (cosy-home, 687 dl) |
| 20 | feature | dvergr: Dvergr pieces | 31 % | 2 % | 5 % | 29 | core wood mansion (core-wood-mansion, 842 dl); Bridge (bridge, 774 dl); Upper Class Medieval Townhouse w/download (upper-class-medieval-house-w-download, 759 dl) |

## Where the generator has more than the corpus

| Kind | What | Corpus | Generated |
|---|---|---|---|
| roof | gable | 37 % | 63 % |
| shape | square | 10 % | 33 % |
| roof | pitch 45 | 43 % | 58 % |
| wall | log | 5 % | 19 % |
| feature | cornerPosts | 42 % | 55 % |
| roof | hip | 3 % | 14 % |
| shape | rect | 10 % | 19 % |
| feature | logPoles | 38 % | 45 % |
| wall | marble | 3 % | 11 % |
| prefab | woodpiles and stacks | 17 % | 26 % |

## Shapes, walls and roofs side by side

| Measure | Corpus | Generated |
|---|---|---|
| Shape | round 24, L 16, complex 11, long 10, rect 10 | square 33, rect 19, L 15, long 13, round 9 |
| Wall type | half-timber 35, stone 25, plank 24, stone-base 6, log 5 | stone 25, plank 22, log 19, half-timber 15, marble 11 |
| Roof type | gable 37, gable+hip 24, conical 15, flat 13, none 6 | gable 63, hip 14, conical 12, gable+hip 6, flat 4 |
| Pitch | 45 43, 26 22, - 19, mixed 16 | 45 58, 26 27, mixed 11, - 4 |
| Footprint, square meters (median, 75th percentile) | 181, 386 | 81, 136 |
| Storeys (median, 75th) | 3, 4 | 2, 2 |
| Height, m (median, 75th) | 14.1, 21 | 8.1, 10.4 |
| Eave past the walls, m (median, 75th) | 0, 0.5 | 0, 0 |

Shares in percent of buildings, the five commonest of each.

## By palette and culture

Corpus builds are grouped by the latest biome's material they use in quantity; generated buildings by the biome they were asked for.

| Biome | Corpus builds | Corpus shapes | Generated shapes | Corpus walls | Generated walls | Corpus roofs | Generated roofs |
|---|---|---|---|---|---|---|---|
| Meadows | 28 | L 21, rect 21, T 14, long 14, square 11 | square 29, L 19, long 19, rect 17, T 7 | half-timber 61, plank 39 | half-timber 54, plank 46 | gable 82, gable+hip 14, conical 4 | gable 80, hip 10, gable+hip 8, shed 2 |
| Black Forest | 38 | round 21, long 16, L 16, square 13, T 11 | square 33, rect 16, L 14, round 14, long 11 | stone 45, half-timber 24, plank 13, stone-base 11, log 8 | log 47, stone-base 20, plank 20, half-timber 6, stone 6 | gable 37, flat 18, none 18, gable+hip 13, conical 8 | gable 63, conical 14, gable+hip 11, hip 8, flat 3 |
| Swamp | 29 | L 24, complex 17, round 17, L+U 10, cross 7 | long 25, square 21, round 21, rect 18, L 7 | stone 34, half-timber 24, plank 21, stone-base 14, log 7 | log 63, plank 33, half-timber 4 | gable+hip 34, flat 21, gable 21, hip 10, conical 7 | gable 44, hip 32, conical 21, gable+hip 4 |
| Mountain | 0 | - | square 41, rect 31, round 12, long 8, U 4 | - | stone 92, log 6, stone-base 2 | - | gable 86, conical 12, shed 2 |
| Plains | 37 | round 35, square 14, T 11, L 11, rect 11 | square 33, L 20, rect 17, round 11, long 7 | half-timber 43, plank 30, stone 22, stone-base 3, log 3 | stone 72, half-timber 11, stone-base 9, plank 7 | gable+hip 41, gable 27, conical 27, other 3, hip 3 | gable 46, flat 22, conical 19, hip 9, gable+hip 4 |
| Mistlands | 7 | round 57, complex 14, L 14, square 14 | square 40, L 20, rect 20, long 7, T 7 | marble 43, plank 29, half-timber 14, stone 14 | marble 87, plank 13 | conical 43, flat 43, none 14 | gable 58, hip 18, conical 16, gable+hip 9 |
| Ashlands | 14 | complex 36, round 36, L+U 14, rect 7, long 7 | square 37, L 20, rect 17, long 11, T 6 | grausten 29, half-timber 21, marble 14, log 14, stone 14 | plank 37, grausten 37, half-timber 26 | conical 29, flat 29, gable 21, gable+hip 14, other 7 | gable 69, hip 23, gable+hip 6, shed 3 |

Per generated culture: the shapes and features it makes, and the corpus features of its biome it lacks (corpus share 20 % or more, the culture under half of that).

| Culture | Buildings | Shapes | Median footprint | Missing features (corpus share of its biome) |
|---|---|---|---|---|
| anglo-saxon | 9 | long 56, rect 33, square 11 | 107 | stairEntry 93 %, roofCross 93 %, raised 89 %, gateDoor 82 %, balcony 39 % |
| baltic | 36 | long 28, square 28, rect 22, L 8, T 6 | 81 | ironTrim 90 %, gateDoor 76 %, tower 79 %, wallTorchOut 55 %, roofCross 59 % |
| byzantine | 69 | square 42, L 23, rect 12, long 9, T 6 | 94 | oneByOne 78 %, decowall 76 %, stairEntry 78 %, tower 78 %, bargeboard 68 % |
| castle-medieval | 35 | square 37, L 20, rect 17, long 11, T 6 | 78 | dvergr 93 %, stoneArch 79 %, decowall 79 %, wallTorchOut 79 %, deck 71 % |
| celtic | 9 | round 100 | 92 | oneByOne 79 %, stairEntry 66 %, raised 55 %, roofCross 53 %, gateDoor 53 % |
| celtic-crannog | 12 | round 100 | 85 | ironTrim 90 %, raised 86 %, tower 79 %, gateDoor 76 %, oneByOne 66 % |
| fen-folk | 9 | long 44, rect 22, square 22, L 11 | 120 | ironTrim 90 %, gateDoor 76 %, tower 79 %, roofCross 59 %, wallTorchOut 55 % |
| frankish-norman | 12 | square 42, L 25, T 17, rect 17 | 55 | roofCross 93 %, stairEntry 93 %, gateDoor 82 %, raised 89 %, balcony 39 % |
| lamari | 12 | rect 42, square 33, L 17, T 8 | 55 | stairEntry 78 %, halfWalls 71 %, oneByOne 70 %, gateDoor 65 %, roofCross 59 % |
| middle-eastern | 12 | rect 42, square 25, L 17, long 8, complex 8 | 106 | stairEntry 78 %, tower 78 %, decowall 76 %, bargeboard 68 %, gateDoor 68 % |
| norse | 41 | square 29, L 20, long 15, rect 12, T 10 | 65 | stairEntry 93 %, raised 89 %, gateDoor 82 %, roofCross 93 %, valley 39 % |
| norse-forest | 43 | square 40, L 21, rect 19, long 9, T 5 | 68 | roofCross 53 %, gateDoor 53 %, oneByOne 79 %, stoneArch 42 %, balcony 34 % |
| norse-highland | 42 | square 43, rect 38, long 10, U 5, L 5 | 68 | stairEntry 78 %, oneByOne 70 %, gateDoor 65 %, raised 71 %, tower 54 % |
| saami | 9 | round 67, square 33 | 91 | raised 71 %, gateDoor 65 %, roofCross 59 %, tower 54 %, wallTorchOut 47 % |
| slavic | 9 | square 33, long 33, rect 22, T 11 | 107 | roofCross 53 %, gateDoor 53 %, stoneArch 42 %, wallTorchOut 37 %, craftOutside 37 % |
| steppe | 6 | round 100 | 85 | stairEntry 78 %, tower 78 %, oneByOne 78 %, decowall 76 %, raised 70 % |

## Decoration prefabs on the outside

Each vanilla prefab seen on or outside the walls of 5 % or more of the corpus buildings, by how much more the corpus uses it.

| Prefab | Role | Corpus | Generated |
|---|---|---|---|
| wood_beam_1 | beam | 71 % | 17 % |
| wood_beam_26 | beam | 52 % | 2 % |
| wood_pole2 | pole | 75 % | 26 % |
| wood_stair | stair | 51 % | 22 % |
| wood_pole_log_4 | pole | 25 % | 0 % |
| stone_stair | stair | 41 % | 17 % |
| piece_walltorch | light | 29 % | 5 % |
| woodiron_pole | pole | 25 % | 2 % |
| stone_pillar | pole | 21 % | 0 % |
| wood_stepladder | stair | 20 % | 0 % |
| wood_wall_log_4x0.5 | beam | 20 % | 0 % |
| darkwood_pole4 | pole | 20 % | 0 % |
| itemstandh | deco | 20 % | 0 % |
| piece_chest | storage | 20 % | 1 % |
| itemstand | deco | 31 % | 13 % |
| wood_beam | beam | 83 % | 64 % |
| wood_beam_45 | beam | 58 % | 40 % |
| sign | deco | 22 % | 5 % |
| piece_workbench | table | 22 % | 5 % |
| woodiron_beam | beam | 18 % | 0 % |
| darkwood_beam4x4 | beam | 18 % | 1 % |
| piece_dvergr_lantern | light | 17 % | 0 % |
| piece_workbench_ext1 | seat | 20 % | 3 % |
| piece_workbench_ext3 | seat | 18 % | 1 % |
| piece_chest_wood | storage | 21 % | 5 % |
| piece_chair | seat | 16 % | 1 % |
| hearth | fire | 16 % | 0 % |
| piece_workbench_ext2 | seat | 16 % | 0 % |
| piece_brazierceiling01 | light | 15 % | 0 % |
| rug_fur | rug | 14 % | 0 % |
| piece_table | table | 16 % | 2 % |
| forge_ext5 | craft | 14 % | 1 % |
| piece_bed02 | bed | 14 % | 0 % |
| forge_ext6 | craft | 14 % | 0 % |
| rug_deer | rug | 14 % | 0 % |
| piece_chair03 | seat | 13 % | 0 % |
| piece_banner01 | deco | 13 % | 0 % |
| piece_workbench_ext4 | seat | 14 % | 1 % |
| piece_groundtorch | light | 14 % | 1 % |
| piece_cauldron | craft | 12 % | 0 % |

## All measures

| Kind | What | Corpus | Generated | Gap |
|---|---|---|---|---|
| feature | gateDoor | 65 % | 6 % | 60 |
| feature | roofCross | 59 % | 10 % | 50 |
| feature | oneByOne | 70 % | 23 % | 47 |
| feature | tower | 54 % | 10 % | 45 |
| feature | stoneArch | 44 % | 2 % | 43 |
| feature | wallTorchOut | 47 % | 5 % | 42 |
| feature | ironTrim | 44 % | 3 % | 41 |
| feature | stairEntry | 78 % | 38 % | 39 |
| feature | balcony | 46 % | 8 % | 38 |
| feature | valley | 38 % | 0 % | 38 |
| feature | stoneFloorOut | 39 % | 2 % | 37 |
| feature | deck | 44 % | 8 % | 35 |
| feature | decowall | 34 % | 0 % | 34 |
| feature | seatOutside | 37 % | 5 % | 32 |
| feature | craftOutside | 33 % | 3 % | 30 |
| feature | dvergr | 31 % | 2 % | 29 |
| feature | glass | 23 % | 0 % | 23 |
| feature | itemStandOut | 33 % | 13 % | 21 |
| feature | ladderOut | 18 % | 0 % | 18 |
| feature | raised | 71 % | 55 % | 16 |
| feature | bannerOut | 36 % | 21 % | 15 |
| feature | plantsOutside | 21 % | 6 % | 15 |
| feature | shutters | 18 % | 4 % | 14 |
| feature | porch | 20 % | 8 % | 12 |
| feature | chimney | 12 % | 1 % | 11 |
| feature | groundTorchOut | 22 % | 11 % | 10 |
| feature | clipped | 7 % | 0 % | 7 |
| feature | bargeboard | 45 % | 39 % | 6 |
| feature | storageOutside | 35 % | 28 % | 6 |
| feature | darkTrim | 33 % | 27 % | 6 |
| feature | dragon | 20 % | 16 % | 5 |
| feature | deepOverhang | 20 % | 16 % | 4 |
| feature | dormer | 4 % | 4 % | 0 |
| feature | multiRidge | 5 % | 5 % | -1 |
| feature | stepped | 14 % | 16 % | -2 |
| feature | halfWalls | 71 % | 73 % | -2 |
| feature | fenceYard | 9 % | 13 % | -3 |
| feature | logPoles | 38 % | 45 % | -8 |
| feature | cornerPosts | 42 % | 55 % | -13 |
| prefab | wall torches and sconces | 47 % | 5 % | 33 |
| prefab | Dvergr props and pieces | 25 % | 0 % | 20 |
| prefab | rugs outside | 23 % | 0 % | 18 |
| prefab | item stands | 33 % | 13 % | 17 |
| prefab | banners and drapes | 36 % | 21 % | 12 |
| prefab | standing lights | 27 % | 17 % | 8 |
| prefab | carts and wagons | 5 % | 0 % | 4 |
| prefab | carvings | 18 % | 14 % | 3 |
| prefab | barrels and crates | 1 % | 7 % | -4 |
| prefab | trader and odd props | 14 % | 20 % | -5 |
| prefab | woodpiles and stacks | 17 % | 26 % | -7 |
| roof | gable+hip | 24 % | 6 % | 18 |
| roof | flat | 13 % | 4 % | 9 |
| roof | mixed pitch | 16 % | 11 % | 5 |
| roof | conical | 15 % | 12 % | 3 |
| roof | other | 3 % | 0 % | 3 |
| roof | shed | 0 % | 1 % | -1 |
| roof | pitch 26 | 22 % | 27 % | -5 |
| roof | hip | 3 % | 14 % | -10 |
| roof | pitch 45 | 43 % | 58 % | -15 |
| roof | gable | 37 % | 63 % | -27 |
| shape | group of buildings | 16 % | 0 % | 16 |
| shape | round | 24 % | 9 % | 14 |
| shape | complex | 11 % | 0 % | 11 |
| shape | L+U | 5 % | 1 % | 4 |
| shape | T | 8 % | 5 % | 4 |
| shape | cross | 3 % | 1 % | 2 |
| shape | L | 16 % | 15 % | 1 |
| shape | Z | 1 % | 0 % | 1 |
| shape | nave | 1 % | 1 % | 0 |
| shape | court | 0 % | 0 % | 0 |
| shape | U | 2 % | 3 % | -1 |
| shape | long | 10 % | 13 % | -3 |
| shape | rect | 10 % | 19 % | -9 |
| shape | square | 10 % | 33 % | -23 |
| size | taller than 10 m | 78 % | 29 % | 49 |
| size | three storeys or more | 59 % | 15 % | 45 |
| size | footprint over 150 square meters | 55 % | 24 % | 31 |
| wall | half-timber | 35 % | 15 % | 20 |
| wall | plank | 24 % | 22 % | 1 |
| wall | stone-base | 6 % | 5 % | 1 |
| wall | stone | 25 % | 25 % | 0 |
| wall | grausten | 3 % | 4 % | -1 |
| wall | marble | 3 % | 11 % | -7 |
| wall | log | 5 % | 19 % | -14 |

<!-- hand -->
## Reading the numbers

- The corpus builds are showcase builds: bigger, taller and busier than a village house needs to be. The size gaps
  (storeys, height, footprint) say the generator tops out early more than that every house should be large. The
  "Generated s3" column is the fairer comparison for them.
- Palettes are guessed from materials, so a Mountain build reads as Black Forest or Swamp (no Mountain-only building
  material); the Mountain row of the corpus is empty for that reason.
- "On or outside the walls" counts a piece whose middle is off the footprint or on its rim. Something hung on the
  inside face of an outer wall can count as outside.
- The eave measure (how far the lowest roof row reaches past the footprint) was taken before D-059 B lands.

## What the motif work fills (motifs.js, details.js)

Draft, filled in as each stage lands.

- Lights, banners and item stands hung on the outside walls (wall-face motifs, D-065).
- Wall bases and plinths per wall type.
- Corners at any angle (octagon and other many-sided plans) and inside corners where wings meet.
- Porches, balconies and stair entries mined from the corpus, used where the generator's own frame fits.

## Left for the lead (generate.js and plans)

Draft.

- Gates used as doors (two gates side by side as a wide entrance): a door choice in generate.js.
- Roof valleys at wing junctions: the generated L, T and cross roofs carry no inner corner pieces.
- Towers and taller buildings: three storeys or more, a tower wing on a hall.
- Stone arches in stone walls (doors and windows).
- Decks and terraces at the foot, stone paving outside (with the yard work).
