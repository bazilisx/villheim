# Upper storeys at s3 (ideas track gap 1)

Design helper A, 2026-11-11. Branch `design/wip-storeys` from main 8e1860f. Files changed: `tools/blueprint-lab/lib/styles.js`
and `tools/blueprint-lab/lib/generate.js` (massing and storeys; the fallback bed in `bedIfNone`). No change in other
tracks' files.

Task (lead's brief): homes, taverns and halls at s3 with an upper storey or a loft at the corpus share by type and
culture, stairs or ladders the corpus way, beds upstairs at the corpus share, the plan's shape family kept between
stages (D-132), no bigger footprint for a storey (D-083). Gap 2 (roofscape) if time allowed.

## What was done

| Commit | What |
|---|---|
| 0fea698 | `styles.js` `UPPER_STOREY`: the s3 share of two storeys or more by culture. `generate.js` `massingPath` draws the s3 storey from it for homes, taverns and longhouses. Two storeys at s3 count their walls from the ground floor up in the eave rule (the footing is left out). |
| ad3ec02 | `generate.js` `bedIfNone` tries upper rooms first; `request.storeys` and `request.storeysDrawn` in the output for measures. |

### The share by culture

From `tools/blueprint-lab/data/culture-corpus/summary.json`, storeys of buildings, share with 2 or more. A culture
whose own group has 10 buildings or more takes its own share; one with fewer takes the first stand-in group of 10 or
more named in `research.md` (section "Options per culture"). The corpus summary has no split by building type, so
homes, taverns and halls share the culture's figure.

| Pool culture | Corpus group (buildings) | Share |
|---|---|---|
| norse, anglo-saxon | norse (455) | 0.75 |
| norse-forest, slavic, baltic | norse-forest (44) | 0.80 |
| norse-highland, lamari | norse-highland (27) | 0.81 |
| frankish-norman, byzantine, middle-eastern | stone-house (46) | 0.76 |
| fen-folk | fen-folk (13) | 0.77 |
| castle-medieval | castle (240) | 0.75 |
| celtic, steppe | celtic (10) | 0.30 |
| celtic-crannog | celtic and celtic-crannog together (6 of 15) | 0.40 |
| saami | saami (2, both one storey) | 0 |

The s3 odds are what is left after the s2 draw, `(share - s2 odds) / (1 - s2 odds)`, times the household's size
lean already in the code (one person 0.5, two 1, a family 1.5, capped at 1). Cultures whose types have a form of their
own keep the form's storeys: round (celtic, crannog, saami), yurt (steppe), gable row (norse-highland), court
(middle-eastern homes and taverns). Byzantine homes stay at the culture's fixed two storeys at s2 and s3.

Over 12 seeds (s3, skipDecor, every biome culture), buildings on the massing path came out 267 of 324 with two storeys
(82 %); over 60 more tavern seeds 74 % (norse 75, baltic 78, byzantine 68, castle-medieval 65, fen-folk 85).

### Eave rule

`generate.js` drops storeys while the eave is over 1.1 times the short side (comment: 2026-11-09 review, three storeys
on a 6 to 8 m plan read as a tower). With a 1 m footing, two 3 m storeys on a 6 m deep plan (7 m) failed it and the
second storey was dropped. At s3 the rule now counts two storeys from the ground floor up (6 m against 6.6 m); a third
storey and every other stage are checked as before.

### Stairs, beds, D-132 and D-083

- Stairs and ladders: unchanged. A straight stair replaces the first ladder in 75 % of two-storey buildings from s2
  where a wall has room (`stairWanted`); `wood_stepladder` is in 20 % of corpus builds (`docs/COVERAGE.md`).
- Beds: the decorator already gives upper rooms the sleeping role (homes, longhouses) or guest (taverns), and a two
  storey home's ground floor the living role (`lib/decorate.js` `roleFor`, `kinds`). The fallback bed now goes
  upstairs first. Longhouses still put some beds on the ground floor through the hall's own furnishing
  (`lib/decorate.js`, other track).
- D-132: plans are drawn as before; only the storey count changed. Pool gate nestBroken 0.
- D-083: a storey adds no cells; the footprint of every stage is the same as before.

## Measures

Ideas study pool (`/tmp/h8/gen_pool.js`, 612 made, 576 kept, same settings as `ideas.md`), mined with the culture
miner (`/tmp/h8/cm/mine_culture.js`, storeys 1.8 m apart, 6 cells; buildings of 40 structural pieces or more). Before is
main 8e1860f (`/tmp/h8/gen-feat.jsonl`), after is this branch.

| Measure | Corpus (Norse) | Before | After |
|---|---|---|---|
| s3, two storeys or more, all types | 75 % | 28 % | 39 % |
| s3 homes | | 41 % | 63 % |
| s3 longhouses | | 6 % | 63 % |
| s3 taverns | | 63 % | 63 % |
| s3 storehouses | | 13 % | 19 % |
| s3 workshops | | 27 % | 53 % |
| s3 height median, homes | 10.5 m (home shell) | 6.6 m | 7.9 m |
| s3 height median, longhouses | | 6.0 m | 7.7 m |
| s3 height median, all types | 9.3 m | 6 m | 6 m |
| s3 home pieces, median | 868 (home shell) | 391 | 452 |
| beds upstairs, s3 | 77 % | 53 % | 71 % |
| beds upstairs, furnished buildings, all stages | 77 % | 36 % | 46 % |

Storehouses and workshops rose through the eave rule alone; their odds are unchanged. With the research device rule
(storeys 2.4 m apart, 12 cells), the s3 subset of homes, longhouses, taverns and storehouses gives the same shares to
within 3 points. In the s3 subset by culture, the one-storey groups are celtic, celtic-crannog, norse-highland, saami
and steppe (forms).

## Checks

| Check | Result |
|---|---|
| `node lab/test_structure.js` | all structure rules hold on 36 designs |
| `node lab/test_sizes.js` | 0 off by more than 10 cm |
| `node lab/make_testpool.js /tmp/h3s/pool` (Norse Meadows) | pass, 81 designs; richness prefabsPerD3 14.5, setShare 0.358; nestBroken 0 |
| `node lab/check_interiors.js <lib> <out> 1` | main and branch alike: overlap 2, floating 8, stairs 1, bareFloors 1; d3 furniture 50.4 to 54.3 per design |
| `node lab/compare_page.js` (page rebuilt locally, then restored) | all same |
| s3 pool `/tmp/h3s/gen.js`, 85 designs | 1 design fails stability (stone_wall_2x1), the same one as on main |

## Renders

`/tmp/storeys-renders/` (render_views.js, roof cut away; before is main 8e1860f):
- `home-meadows-norse-s3d3-8-{before,after}.png`: one storey before, two after.
- `longhouse-blackforest-norse-forest-s3d3-11-{before,after}.png`: one storey before; after, a stair along the wall
  to a full upper floor with beds.
- `tavern-plains-byzantine-s3d3-11-{before,after}.png`: two storeys in both (Plains taverns are unchanged: byzantine
  ones already reached the share, middle-eastern and steppe ones keep their forms).

## Open

- Longhouses take a full upper floor over the whole hall. Corpus Norse halls show a loft or gallery over part of the
  hall (`hubs.md`, hub table); a loft over one end, leaving the fire bay open to the roof, needs per-storey heights or
  a partial floor and a change to the headroom check for floor under a roof slope (`lib/checks.js`). Not started.
- Lofts under a 45 degree roof with knee walls (the ideas track's other option) are not built; every upper storey is
  a full storey of the building's storey height.
- The corpus has no storeys by type; per-type shares need the culture miner run again on the device with folders
  (the device was not connected).
- Forms keep one storey: norse-highland gable rows (corpus 81 %), celtic and crannog round houses (30 and 40 %).
- Gap 2 (wings at their own ridge heights, valleys): not started.

## Proposed Decisions rows

1. "s3 buildings with an upper storey. D-069 keeps s1 and s2 as they are. A) the corpus share by culture (75 to 81 %
   for the Norse, stone-house and castle groups, 30 to 40 % for Celtic, 0 for Saami), now in `styles.js`
   `UPPER_STOREY`; B) about half; C) as before (28 % of s3 buildings). Recommend A. In use until answered: A.
   Mod side: villagers climb stairs and ladders to upstairs beds."
2. "Halls (longhouses) with an upper floor at s3. A) a full floor over the whole hall (built now); B) a loft or
   gallery over one end, the fire bay open to the roof, as in corpus Norse halls. Recommend B."
3. "Eave rule from the 2026-11-09 review (eave within 1.1 times the short side). At s3 two storeys now count their
   walls from the ground floor up, so a 1 m footing no longer drops the second storey on a 6 m deep plan; three
   storeys keep the old rule. A) keep this; B) the old rule. Recommend A."

## Next

A loft over part of a hall and knee-wall lofts in homes (per-storey heights in `generate.js`), forms that take a
storey where their corpus group shows one, then gap 2.

## Round 2 (lofts)

Lead's calls on the round 1 rows: the storey share follows the corpus (D-136), as built; the eave rule change stays;
longhouses and halls get a loft or gallery over one end as corpus Norse halls have it (D-127), in place of a full
floor over the whole hall. Files changed: `lib/styles.js`, `lib/generate.js`, `lib/checks.js` (headroom, new function),
`lib/details.js` (wall top, new function).

### What was done

- Hall loft (`generate.js` `hallLoft`, `loftRail`; `styles.js` `LOFT.hall`). A two-storey longhouse at s3 gets its
  upper floor over one end of the main wing only: a third of its length (at least 2 bays), at the end the stair or
  ladder lands on, or the other end when the fire's place falls under it. When the climb lands in the open part, a
  ladder is planned again under the loft. A fence rail (half walls in a kit with no fence) runs along every edge where
  the loft meets a cell with no loft floor, with a gap where the climb comes up. The rest of the hall and its wings
  are open to the roof; the ridge vent over a middle fire is a louver again (`from` the ridge). The loft is the only
  upper room (`room.loft = 'hall'`). The share of the loft's length is a setting: the corpus files in the repo hold no
  measure of it.
- Knee-wall loft (`generate.js` `kneeLoft`, `SHs`; `styles.js` `LOFT.home`). A two-storey home at s3 with a 45 degree
  gable roof takes its upper storey as a loft under the roof on 1 m knee walls, at a share by culture: the group's share
  of beds under a roof slope (culture-corpus `relx` `bedsUnderSlope`) over its share of two storeys (norse 21 / 75 =
  0.28, norse-forest 0.16, norse-highland 0.19, fen-folk 0.35, castle 0.09; stone-house, celtic, crannog and saami 0).
  The draw comes from the household's own stream. The loft floor covers the main wing; side wings stay open to their
  own roofs with a rail where the loft meets them. The climb lands in the cells along the ridge. Knee walls have no
  windows, and only the gable ends take things hung on walls. Fen-folk homes (eaves 2) do not take it. The 1 m knee
  is a setting: the corpus files in the repo hold no measure of it.
- Per-storey wall height: the storey loop takes each storey's height from `SHs(s)`; `dctx.wallTop` carries the real
  wall top to the details pass (`details.js` `wallTopOf`, used where corner posts and wall posts ran to
  `F + storeys * SH`), the wall hearth's roof cut, the slope vent and the stack fallback.
- Headroom (`checks.js` `underSlopeOK`): on an upper floor, a point under a roof slope may be lower than 2.4 m when the
  roof over it is at least 1.0 m up (`LOFT_LOW`) and a point of the same floor with full headroom and walls lies within
  3.0 m (`LOFT_REACH`). People walk where they can stand; the low edges hold beds and chests. Both values are settings.

### Measures

`/tmp/storeys2/measure.js` (in /tmp, kept out of the repo): s3d3, types home (seeds 11 and 47), longhouse, tavern,
storage, workshop, smithy, barn (seed 11), every culture of `BIOME_CULTURE`, `request.best` with 1 try; 136 designs.
Ridge lines are `lib/critic.js` `measure`; valleys are inner corner roof pieces per design; beds under a slope use the
culture miner's rule (a roof or roof corner piece within 1.6 m across, pivot 0 to 2.6 m over the bed). Before is
4990231.

| Measure | Corpus | Before | After |
|---|---|---|---|
| beds under a roof slope, all | 14 % (relxAll), Norse 21 % | 8 % | 10 % |
| beds under a slope, homes | | 16 % | 18 % |
| beds under a slope, longhouses | | 7 % | 10 % |
| longhouses with a hall loft | | 0 of 17 | 10 of 17 (the 10 two-storey ones) |
| homes with a knee-wall loft | | 0 of 34 | 2 of 34 (over 60 seeds: norse 11 of 46 two-storey, anglo-saxon 9 of 47, norse-forest 4 of 41) |
| ridge lines per design, median (mean) | top builds 4 | 2 (1.72) | 2 (1.72) |
| valley pieces per design | 2.2 sites per build | 1.22 | 1.22 |
| two storeys or more, s3 | Norse 75 % | 38 % | 38 % |

Gap 2 (roofscape) was not started this round; the ridge and valley figures are the baseline for it. By plan, valleys
come only from T, L, cross and U wings (4 on a T or cross with a narrow wing, 0 to 2 on an L, 0 on rect, long, nave
and octagon plans), and wings share the main wing's eave height.

### Checks

| Check | Result |
|---|---|
| `node lab/test_structure.js` | all structure rules hold on 36 designs |
| `node lab/test_sizes.js` | 0 off by more than 10 cm |
| `node lab/make_testpool.js /tmp/storeys2/pool` (Norse Meadows) | pass, 81 designs; prefabsPerD3 14.4 (14.5 before), setShare 0.342 (0.358); nestBroken 0 |
| `node lab/check_interiors.js lib <out> 1` | same totals as round 1: overlap 2, floating 8, stairs 1, bareFloors 1; d3 52.4 pieces of furniture per design |
| `node lab/compare_page.js` (page rebuilt locally, then restored) | all same |
| measure pool, 136 designs | after the last fix, the same two failures as before (castle-medieval tavern stability, castle-medieval barn headroom); the knee-loft home that failed headroom and ladders in the run (anglo-saxon nave, seed 47, climb planned in the annex) passes after the climb was kept to the main wing |

### Renders

`/tmp/storeys2-renders/` (`/tmp/storeys2/render2.js`: rows are roof on, cut 2.6 m over the upper floor, cut 2.6 m over
the ground floor; before is 4990231):
- `longhouse-blackforest-norse-forest-s3d3-13-{before,after}.png`: before, a full upper floor; after, a loft over one
  end with a rail, the rest open to the roof.
- `home-meadows-anglo-saxon-s3d3-7-{before,after}.png`: before, a full 3 m upper storey; after, a loft on knee walls.
- `home-meadows-norse-cross-s3d3-12-{before,after}.png` (cross plan): after, a knee-wall loft over the main wing with
  rails where it meets the wings, which are open to their roofs.

### Open

- Gap 2 (wings at their own ridge heights, valleys where wings meet): not started. A way in: per-wing storeys at s3
  (a one-storey wing on a two-storey main runs its roof into the upper wall), which needs per-storey cells and edges in
  the storey loop and ladders planned on the upper cells; wider wings meet the main roof in more valley pieces.
- Lofts are furnished lightly by the decorator (few wall slots: gable ends only).
- Loft length, knee height, `LOFT_LOW` and `LOFT_REACH` are settings with no corpus measure in the repo; the device
  (Tyler's PC) was not connected for a corpus run.
- Taverns keep full upper floors (guest rooms).

### Changes in other tracks' files

- `lib/details.js`: new `wallTopOf(ctx)`; three `F + storeys * SH` wall tops now call it (same value unless the
  generator sets `ctx.wallTop`).
- `lib/checks.js`: new `underSlopeOK` with `LOFT_LOW` and `LOFT_REACH`; the headroom loop collects low points and
  passes them through it.
