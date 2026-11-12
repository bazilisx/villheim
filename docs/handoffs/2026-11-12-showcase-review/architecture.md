# Track H: architecture and design literature (2026-11-12)

Branch design/wip-architecture (from main 0d22c7d). Brief: Tyler's question whether any helper had read the
literature on architectural design, interior design and game interior design, and his note on consistent
architectural features (D-167, `TYLER_NOTES.md` last section). Scope widened by the lead the same day (common.md,
"Tyler's examples are symptoms"): the design grammar of a whole building and village, with windows as one feature
among many. Study: `docs/ARCHITECTURE_STUDY.md`. Criteria: `criteria/architecture.md`.

## What was done

| Commit | What |
|---|---|
| c34202e | Corpus miners `lab/arch_facades.js` (window runs, sides, storeys, exceptions, corners, bands), `lab/arch_grammar.js` (materials, roofs, bays, symmetry, carved heads, doors, villages), `lab/arch_rooms.js` (light, fabric and wood programs per room and household); measures in `tools/blueprint-lab/data/architecture/` |
| f1315fc | `lib/program.js` (the building program), `data/architecture/rules.json`, `lab/test_program.js`; per-culture feature shares, window spacing and a per-build council reading (`--perbuild`) in `arch_facades.js` |
| (this commit) | `docs/ARCHITECTURE_STUDY.md`, `criteria/architecture.md`, this record |

Private repo (`villheim-corpus`, `research/2026-11-12-architecture/`): `corpus-examples.json` (example builds for lone
features, uniform runs and odd windows) and `corpus-perbuild.json` (the council reading per corpus build). Both name
builders' files and stay private.

`lib/facade.js` from the brief is `lib/program.js`: it plans the whole building (windows, doors, trim, materials,
roof, symmetry, the village family and the room program), as the lead's correction asks.

## Findings, by principle (numbers and sources in ARCHITECTURE_STUDY.md)

1. **One treatment per run.** Corpus: 66.8 % of 4,199 window runs share one built treatment against 28.5 % when each
   build's own windows are dealt to its runs at random; per feature, full runs 43 to 68 % against 10 to 29 %; one piece
   per feature along a full run in 95 to 100 %. Showcase: 67.5 % overall, 0 of 3 runs of five or more windows uniform,
   mixed runs in designs 05, 09, 10. Sources: Ching (repetition), Franck and Dickinson (one window type), Alexander
   249 (one ornament theme repeated at the seams), nalichniki (one frame family per house).
2. **Hierarchy.** Corpus front richer 37 % against poorer 28 %; the other sides take the front's treatment on 47 % of
   the 149 ground levels read; one door clearly richest in 37 % of buildings with two or more doors, all alike in 26 %. Sources:
   Alexander 110 and 116, Franck, Whitsitt, Syrian courtyard houses (plain street, rich court).
3. **Reasoned exceptions.** 10.9 % of windows in runs of three or more differ from their run; behind kitchens 1.45
   times their share, storage 1.38, halls 1.24. Lone features behind kitchens 1.64, halls 2.2. Tyler's kitchen herbs
   are the corpus pattern. Sources: Alexander 221, Burgess (one quirk per kit, with a reason), Carson.
4. **Material order.** Heavy walls below light ones in 78 % of mixed buildings (above 15 %); the change at a floor
   line 49 %, a plinth 11 %; a plinth on all four sides 88 %.
5. **Roofs and ornament.** One roof material 88 %; one slope family 49 %, two 45 %, the minor not reliably lower
   (49 %). Carved heads twinned 86 %.
6. **Symmetry.** Formal (0.8 or more of the shell mirrored) 37 %: longhouses 51 %, homes 37 %, taverns 30 %, farms
   18 %; the door on the axis 79 % where the shell is 0.6 mirrored.
7. **Geometric rhythm.** Weak in the corpus: equal gaps in 25 % of runs of three or more, one width in 47 %; 30 % of
   upper windows over a lower run stand right over a lower window. The literature asks for more (Franck, Whitsitt).
   D-136: weighted items for formal buildings only.
8. **Trim modes.** Corner posts on all corners 28 %, none 23 %, some 48 %; one post piece 56 %. Wall bands on no side
   71 %, some sides 29 %.
9. **Village vernacular.** In 43 builds of three or more buildings: lead wall material p50 0.80 of buildings, roof
   material 1.00, slope 0.88, all three 0.67. Sources: Alexander (Timeless Way, the barn), Norwegian and Icelandic
   farms, Danebury roundhouses.
10. **Household program inside.** Rooms take the build's lead light kind 69 % (34 % at random), banner 74 % (32 %),
    drape 75 % (55 %), rug 61 % (36 %), furniture family 66 % (45 %); one light kind in 62 % of rooms.

Where the generator breaks these (read from the code, ARCHITECTURE_STUDY.md section 3): per-window bare or dressed
draws (`lib/details.js` `dressed`), shutters by neighboring bays and open or closed by room, motifs keyed by window
size, a different plant per window box, window boxes on every dressed front ground window from d2 (D-165), a window per
bay and per storey by draw (`lib/generate.js` `windowExtra`), corner posts per corner by draw, door dressing equal on
all but the back door, building features drawn each on its own (`profile` rolls), interior lights and fabrics per slot.

## The program's API (for track D and track E)

In `docs/ARCHITECTURE_STUDY.md` section 4 (building) and section 5 (rooms). Short form:
`Program.plan(ctx)`, `Program.village(ctx)`, `Program.run(prog, { side, storey })`, `Program.window(prog, { side,
storey, line, room, byDoor, key })`, `Program.door(prog, { main })`, `Program.room(prog, { kind, key })`,
`Program.setLead(prog, channel, kind)`, `Program.check(prog, windows)`. Pure functions of the building's make; no
draws from the generator's random stream.

## Changes in other tracks' files

None made. Call sites proposed for track D (`lib/generate.js`, `lib/details.js`), listed with the change each needs in
ARCHITECTURE_STUDY.md section 4, items 1 to 6; item 7 is the integrator's (`lib/build_web.js` libs and
`window.VH_ARCH`, and the game bundle rebuild). Track E: `Program.room` and `Program.setLead` in the decorator's room
loop, and the room kind passed to `Program.window` once the details see the rooms.

## Checks

- `node lab/test_program.js`: 2,592 programs over every culture in the palette, six kinds, six villages: every run one
  treatment or one reasoned exception, the program the same when asked twice, planters 6.5 % of windows (cap 10 %),
  exceptions 7.2 % of windows; sides like the front 0.44 (corpus 0.47), upper like below 0.51 (0.52), formal 0.39
  (0.37). All pass.
- `node lab/test_structure.js`: all structure rules hold on 36 designs (the program is not wired in, so the
  generator's output is unchanged).
- The council pipeline (rooms extract, then the three miners with `--perbuild`) run on showcase 05: it reads 5 runs,
  0.4 uniform, two mixed runs and one window lacking the sill planters of its run of seven.

## Open problems

- The geometric reader is noisy at run ends (a corner post read as a window post) and misses windows with no room
  behind. By that reader 36 % of corpus builds show a decorative mismatch in some run; the hard fails rest on the
  program record.
- Room kinds behind windows come from the furniture; a kitchen with no cooking piece reads as plain.
- Culture groups are thin outside norse, castle, ashlands, norse-forest and medieval-timber; the program blends the
  rest with the whole corpus.
- The program is not wired into the generator; the showcase numbers are those of build 1000.
- Ching's and Totten's books, Interior Design Illustrated and Building Construction Illustrated were read only through
  summaries and the authors' own articles; the GDC talks through write-ups. Wikipedia's timber framing and stabbur
  pages were refused by the fetch tool.

## Proposed Decisions rows

1. **Code differs from D-165**: `lib/details.js` puts window boxes under every dressed front ground window of every
   home, tavern and longhouse from d2 (Ashlands aside), a different plant in each; D-165 makes planters a household
   and culture trait with most windows bare. Options: (a) boxes only from `lib/program.js` (household trait, whole
   front ground run, one species, kitchen herbs as the one exception); (b) keep the rule with a lower share.
   Recommendation (a).
2. **Storey alignment and even window spacing.** The literature (Franck, Whitsitt) asks for windows over windows and
   even bays; the corpus does it on a minority (30 % of upper windows over a lower run, 25 % of runs evenly spaced).
   Options: (a) required on formal buildings only (the program's formal share by kind), weighted elsewhere; (b)
   required on all; (c) never required. Recommendation (a); value in use until answered: (a) in the criteria.
3. **Shutters.** Corpus 0.7 % of windows carry shutters (Wood Shutter); the generator draws them for 60 % of buildings of
   the shutter cultures from s2 d2 in the Black Forest and later biomes, where no window kit sets them
   (`lib/details.js` profile). Options: (a) the program's culture shares (rare, whole runs, bedrooms as the exception); (b)
   keep. Recommendation (a), D-136.

## Next steps

1. Track D wires `Program.plan`, `Program.window` and `Program.door` into the call sites in section 4 and regenerates
   the 16 showcase designs; this track reruns `lab/arch_facades.js --perbuild` and `lab/arch_grammar.js` on them.
2. Track E passes room kinds to the details and uses `Program.room` for lights, fabrics and woods.
3. The integrator adds `program.js` and `window.VH_ARCH` to the page and the game bundle.
4. Council rounds: score each building with `criteria/architecture.md`.
