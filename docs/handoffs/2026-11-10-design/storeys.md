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
