# Trim, wear and banners track (ideas gaps 4 and 5)

Branch `design/wip-trim-banners`, from main 8e1860f. Files: `lib/details.js` (trim budget, banners), `lib/motifs.js`
(decor props any biome), `lab/mine_motifs.js` (tilted sites recorded). One small change in `lib/audit.js` (below).
Rates come from the corpus files only (D-136).

## Commits

- 9a4caed: trim budget and banners from the corpus shares; motif props decor; the miner records tilted sites.
- 998cf3e: banners try heights and offsets, keep clear of windows, hang to the ground on raised floors; the pool
  audit leaves outside banners out of setShare.
- The last commit on the branch: banners turned front out (the decorator's mountOk), a plain wall behind each
  banner; this record.

## What the code does now

**Trim budget** (`details.js` `DRESS`, `trimBudget`, `dressed`, `cornerDressed`). Share of each feature dressed, from
`data/motifs.json` `skipped` (543 builds): windows 0.70, outside corners 0.77, inside corners 0.78. The corpus has no
split by culture for these, so none is used. One building moves the shares by its household's tidiness
(`persona.tidy`, 0.3 x (tidy - 0.5)) and by `ctx.village.tidy` when a request carries one (none does yet; see
"Changes in other tracks' files"); the shift is held to 0.2 either way. The front facade takes the share plus 0.15,
the other walls minus 0.06. A bare window gets no motif, frame, mullion, shutters or window box. A bare corner gets no
corner motif and no corner post (log walls keep their posts, as the code says for the decorator). The draws come from
the building's make and its household's salt, never from the details' random stream.

**Banners** (`details.js` `BANNER_SHARE`, `BANNER_SITES`, `BANNER_KINDS`, `bannerPlan`, `bannerDoor`, `bannerFace`,
`hangBanners`, `wallBehind`; the gable banner in `bargeboards`).
- Which buildings: none at d1; from d2 the share of corpus buildings with a banner piece for the culture's group
  (`culture-corpus/summary.json` `signs.bannerPiece`): norse 0.53, norse-forest 0.68, norse-highland 0.63,
  anglo-saxon and frankish-norman 0.53 (medieval-timber), castle-medieval 0.53 (castle), lamari 0.31 (mistlands);
  groups under 20 corpus buildings take 0.49, the share over all 1,619 buildings. Times the household's
  `likes.banners` and `ctx.village.banners` when there is one. The draw leaves out the decor stage, so d2 and d3
  agree.
- Where: banner uses in the kept exterior motifs of `motifs.json`: wall bay 64 plus beside a window 9 (both built as
  a wall bay), by the door 25 (door 9, porch 8, stair entry 8), gable 19. Corners 23, valleys 10, eaves 8, balconies 3
  and dormers 2 are not built. Door banners are a pair in 5 of 7 corpus door motifs; wall bays carry two side by side
  in 4 of 45.
- Kinds: by their uses in the same motifs (banner01 94, 04 34, 02 24, 11 20, 07 17, 03 12, 05 10, 06 8, 08 5, 09 1,
  10 1), every kind in every biome (D-065, D-126).
- How: the rod 2.98 to 3.62 m over the floor (corpus banner motifs 2.9 to 3.6 for most uses), 0.3 m from the wall's
  middle (0.1 m off a stone face by `relief`), else 0.15 m further out; through `motifs.js place` (doorways, climbs,
  cloth clear of walls, posts, roof) and `commitMotifs` (cloth foot 0 to 1 m over the floor or ground under it); clear
  of window lights; a plain wall behind the cloth, as `decorate.js mountOk` reads it. On a raised floor the cloth hangs
  from the ground's height. Door banners replace the door's lamps. A gable banner that does not go up, or a door with
  no room, falls back to a wall bay.
- The gable banner was on every d3 building; now it is the gable site of the plan, in the plan's kind, turned front
  out.

**Decor props** (`motifs.js swap`, `details.js commitMotifs`). Motif lamps, banners, signs, stands and carvings are
decor: any kind in any biome (`pieces.js decorOk`), and they carry `decor: true`, so they go up from d2 with the
household's decor stage (`persona.js stageOf`). Before this, `swap` dropped a prop beyond the village's biome and
`generate.js biomeSafe` removed trim props that needed a later biome (every banner in the Meadows: banner01 needs the
Plains in `pieces.js`), so most banners never reached a file.

**Tilt.** Not built. The device with the corpus was not connected, and the data on this machine gives only the share
of sites with a tilted or scaled piece, with neither the pieces nor the angles. `lab/mine_motifs.js` now writes
`tilts` (kind, class, tilt in 5 degree steps, scaled) and `tiltSites` (per kind, the classes at tilted sites, tilted or
level) when it runs on the corpus. The miner's "tilted" count includes scaled pieces.

**Wear.** Not built. No corpus file counts patched or mismatched pieces (mixed wall materials per build are close
already: 32 % of corpus builds against 31 %, ideas.md).

## Measures, before and after

Pool: `/tmp/h8/gen_pool.js` (ideas.md), 612 made, 576 files (byzantine Plains and Mistlands share names), mined with
the ideas copy of `mine_motifs.js` (ALL, LAB, DUMP), compared with `/tmp/h8/cmp_motifs.js`. Before: main 8e1860f.
After: the last commit (code as in this record).

| Site | Corpus dressed | Before | After |
|---|---|---|---|
| window | 70 % | 94 % | 91 % |
| outside corner | 77 % | 96 % | 94 % |
| inside corner | 78 % | 100 % | 100 % |
| wall top | 60 % | 93 % | 93 % |

Windows and corners by wall frame: cultures with `C.frame` (norse, anglo-saxon, frankish-norman, celtic,
celtic-crannog, fen-folk, castle-medieval) stay at 100 %: `generate.js` puts a frame post at every wall vertex of
every storey (line 866), and the miner reads a post within 2.3 m of a window, or at a corner, as trim. Other cultures:
windows 88 to 83 %, corners 91 to 87 %. Wall tops: the top plate on every edge (`generate.js` line 868) is
the commonest corpus wall-top motif too (MT-0001, a beam at 0,0,0); the corpus leaves it off on 40 % of wall tops.

Banners, share of files with a banner piece (corpus Norse 53 %, groups 43 to 68 %):

| | Before | After |
|---|---|---|
| all 612 | 6 % | 15 % |
| s1d1, s2d2, s3d3 | 8, 4, 4 % | 0, 21, 24 % |
| norse (s2, s3) | 8 % | 45 % |

Counted over the 612 index entries (byzantine counted twice: 18 of 24 files). Other cultures at s2 and s3:
anglo-saxon 29 %, frankish-norman 37, slavic 33, norse-forest 25, norse-highland 20, castle-medieval 12, lamari 12,
saami 8, fen-folk 8, celtic 4, baltic, celtic-crannog, middle-eastern and steppe 0. The plan draws a banner for
about half the buildings; many have no place it fits: the 3 m walls of one-storey houses end under 45 degree eaves at
0.3 m out, open bays and windows leave no plain wall, and stone and log relief push the cloth out. A check on 52 s3d3
designs (home, longhouse, tavern, smithy, every biome culture, seed 11) before the wall-behind test: 31 planned, 16
hung (wall bay 6 of 14, door 5 of 10, gable 5 of 7).

## Checks

- test_structure: all structure rules hold on 36 designs.
- Pool gates: Norse Meadows pass, setShare 0.342 (floor 0.34); middle-eastern Plains pass, setShare 0.508. Main 8e1860f with its own audit: pass, setShare 0.349.
- check_interiors, 1 seed, 234 designs (main in brackets): bareFloors 1 (1), floating 4 in 4 designs (6 in 5), overlap 2 (2), stairs 1 (1),
  mountOnOpening 3 (0), the check: rows (beds, doors, headroom, ladders, materials, overlap, space,
  stability, support, woodpiles) 0 (0), decorBiome 0 (0). Main ran in a worktree of 8e1860f at the same time.
- compare_page on a page built to /tmp from this branch, tries 2: all five requests the same.
- Renders (`lab/render_views.js`, roof cut at 2.6 m, so banner rods do not show): `/tmp/trim-renders/
  home-meadows-norse-s2d3-seed1.png` (a banner on the wall), `longhouse-blackforest-norseforest-s3d3-seed8.png`
  (a banner on the wall), `home-plains-middleeastern-s3d3-seed11.png` (none: the flat-roofed court plan had no wall
  bay that fit).

## Changes in other tracks' files

- `lib/audit.js`: `indoorDecor`, one call in the richness loop. Banners outside the floors' footprint are left out of
  setShare's decor count. With every outside banner in it the Norse Meadows pool read 0.339 against the 0.34 floor.
  Revert by replacing `indoorDecor(v.pieces, decor).length` with `decor.length`.
- Wanted, not made: `generate.js` passing a village (`req.village`, `{ tidy, banners }`) into `dctx` as `village`
  (one line at line 810), so the trim budget and the banner share vary by village.

## Open

- Tilt: run `lab/mine_motifs.js` on the corpus (device) to get `tilts` and `tiltSites`; then tilt trim and props
  from those classes and angles. Proposed row: "Tilted pieces (turned off level). The vanilla build menu turns pieces
  about the vertical only; corpus builders tilt or scale pieces through mods at 6 to 28 % of feature sites. A) tilt
  trim and props at the corpus share by class and angle (braces, leaning logs, shutters), never walls, floors or
  roofs that carry load; B) no tilt. Recommend A." (ideas.md Top 10 item 4.)
- Window and corner dress share: the frame posts at every vertex and the top plate on every edge (`generate.js`)
  carry the measure; the massing track would need the corpus post spacing first.
- Banners sunk into the floor: 17 of 115 corpus banner uses on wall bays, doors and stair entries hang with the cloth
  into the floor or ground, 0.05 to 1.48 m. Under the 3 m eaves of a one-storey house a banner fits only that way. Not
  built: `place` and `commitMotifs` refuse it, and the pool audit's hang test allows 3 cm. It would be a D-098 clip
  with a depth field in `#VillheimClips`. Proposed row: "Banners with the cloth into the ground (15 % of corpus banner
  uses, 0.05 to 1.48 m). A) allow it at the corpus share, marked as clips; B) keep banners clear of the ground.
  Recommend A."
- Banners inside halls (corpus rooms: hall 19 %, tavern 13 %, sleeping 35 %, home 30 %; generated rooms 0 %) belong
  to the interior track (`decorate.js`, `kitbash.js`); with them in, the outside share here should come down by what
  the rooms carry.
- Sites not built: corners, valleys, eaves, balconies, dormers (49 of 220 corpus uses).
- check_interiors mountOnOpening: 3 in 234 designs (main 0): two motif signs on a byzantine sawmill and a motif wall torch on a byzantine
  storehouse (motif props are decor now, so the check reads them; before they were not read), and a banner on a Norse
  Meadows tower (s3d3 seed 175) that passes `wallBehind` and fails `mountOk`.
