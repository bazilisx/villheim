# Design handoff, 2026-11-10: where the generator work stands and how to resume it

The building generator (tools/blueprint-lab) was worked on by four helper tracks in one design session on 2026-11-10.
Work paused at the end of that session to save usage. This file indexes each track: where its code is, what it
found, what is left, and a prompt to resume it in a new session. Each track's full record is in this folder.

## State of each track

| Track | Code | Record | State |
|---|---|---|---|
| Creative sets (combined and clipped objects from the corpus) | main, 8f3cb45 | creative-sets.md, ../../../tools/blueprint-lab/data/creative-corpus/ | Merged. 148 creative sets, library at 201 prefabs. Not tried in the game. |
| Library first (sets lead the furnishing; decor any biome; no caps) | main up to 539a56f; branch design/wip-decor-limits, 89fe8f29 | library-first.md, richness-measurements.json | Library first, ceilings, D-098 clips, richness gate, Black Forest and Plains pools merged. The decor-any-biome and no-caps work (D-065, D-126) is on the branch: Plains pool fails (an itemstandh 9 cm into stone_wall_2x1), households closer together (test_variance up to 0.71), check_interiors overlap 7, stairs 2, bareFloors 12. |
| Item stands and feasts | branch design/wip-stands, 1dfa7fd | item-stands.md, tools/blueprint-lab/data/stands-corpus.json (on the branch) | About 290 stand items, about 30 KS- stand sets, feasts at d3. Full checks not run after its last rebase. Houses run above the corpus rates (median 26 distinct items against 7). |
| Hearths and lighting | branch design/wip-hearths, 63d4c19 | hearths-lighting.md, tools/blueprint-lab/lab/hearths/ (on the branch) | Four home fire spots (middle, end hood, side, stone stack from s2), smoke outlets that follow the fire, lights by corpus rate and darkness. Full checks not run after its last rebase. |

All three branches sit on 539a56f; main is one commit ahead (8f3cb45). The corpus is on Tyler's PC in
C:\Users\tyler\Downloads\Villheim-blueprints (connected to the session as Downloads; read only; never commit the
builds; never use the OverDrive BiomeBlueprints pack).

## Rules to carry into every track (Tyler's words, Decisions tab)

- D-065, D-126: any vanilla furniture, decor, light, rug, station and stand item in any biome, indoors and out, with no
  limit on kind or quantity. Building pieces (walls, roofs, floors, beams) come mostly from the village biome and its
  neighbors (no Ashlands grausten in the Meadows); D-012 stone later in the Meadows and the Black Forest. D-080 is
  payment only (the mod pays decor with local stand-ins).
- D-098: clips builders make on purpose stay, up to the depth the corpus shows, marked in the file's #VillheimClips
  section; accidental clips stay out.
- D-132 (2026-11-10): "things dont have to stay perfectly consistent as a house levels up. Decor can change. Things
  can move. Fires can be swapped. Its not mandatory that everything there in s1 and different d1 to d3 phases carry
  over to the next... A rectangular house cant likely turn into an octagonal house... Tables can move and change.
  Fireplaces can move spots. Chairs can move. Beds can move. Walls and furniture and decor can evolve and change as the
  house grows and expands." So: the pool gate's nestBroken (d1 inside d2 inside d3) and the shell-kept target become
  reported measures, never a gate; keep only the plan's shape family between stages. Check the mod side
  (src/Villheim.Logic, owned by the other session) for decor phases and upgrades that remove or move pieces.
- Item stands (Tyler): item stands, especially itemstandh, as single stands and clusters are among the most common
  ways builders add depth and a lived-in feel; feasts on the Serving Tray are less common.
- Hearths (Tyler): home fires along walls, in alcoves, or in wall hearths with chimneys; middle fires for social rooms;
  smoke outlets follow the fire.
- Drivers: messy realism, environmental storytelling, variance by culture, village, family and household (never
  professions), professional room layouts, no fixed-interval rules.

## Open decisions from these tracks

D-127 wall stands into wall relief; D-128 tie beams for rafters; D-129 unconfirmed stand items; D-130 village fires
kept lit against smoke and rain (mod side); D-131 stone hearth stacks in Meadows at s3.

## How to resume (to save usage)

- Run at most two tracks at a time, and only tracks that do not edit the same files. Library first and item stands
  both edit lib/kitbash.js and lib/persona.js; library first and hearths both edit lib/decorate.js and lib/generate.js.
  A good order: (1) library first alone (merge the decor rule, D-132 gate change); (2) then item stands and hearths in
  turn, each rebased on it.
- One full check run per merge: from tools/blueprint-lab, node lab/check_set.js 2, node lab/test_structure.js,
  node lab/test_sizes.js, node lab/check_interiors.js, node lab/make_testpool.js /tmp/p (plus --sample for the Black
  Forest and Plains pools), node lib/build_engine.js, node lib/build_web.js web/index.html; from the root,
  VH_GEN_OUT=/tmp/g tools/gen-test/run.sh and dotnet build Villheim.sln -c Release.
- Republish the lab page (artifact "Villheim Blueprint Lab", slug ebd4fcaa-85d1-452f-9d94-251d2687967c) from
  tools/blueprint-lab/web/index.html after merges.
- Judge results by looking: lab/households_sheet.js and lab/render_views.js (on design/wip-decor-limits) render one
  house for six households and four views; Tyler judges the Interiors tab, so describe what changes visibly.

## Resume prompts

Paste one into a new Claude Code session on bazilisx/villheim (branch design/kitbash), after it reads CLAUDE.md.

**1. Library first, then essentials from the corpus.** "Resume the design track in docs/handoffs/2026-11-10-design/
library-first.md. Rebase design/wip-decor-limits (89fe8f29) on main. Fix what blocks its merge: households drifting
together (feed household traits into varyKit and the decorator's extras until lab/test_variance.js is under 0.6), the
Plains pool's itemstandh in stone_wall_2x1, and the new check_interiors overlaps, stair zones and bare floors. Apply
D-132: nestBroken and lineage become reported measures in lib/audit.js, not gated; keep the plan's shape family.
Merge after the full checks. Then the essentials task in library-first.md: beds, tables, seats, rugs, sills and the
decorator's pick lists from the corpus, so the rooms Tyler sees in the Interiors tab differ visibly; render a Meadows
home, a Plains house, a Swamp tavern and a Meadows hall and judge them against the corpus."

**2. Item stands.** "Resume the design track in docs/handoffs/2026-11-10-design/item-stands.md, branch
design/wip-stands (1dfa7fd). Rebase on main after the library-first track merges; keep main's lib/pieces.js decorOk
and persona itemFrom biome rule. Bring house rates toward the corpus (stands are the main body, singles and clusters;
feasts occasional; medians near the corpus, not far above it), add sunk stands in table tops, side tables and stands on
stands, apply D-127 to D-129 once answered, run the full checks, merge, and credit source builds in
docs/INTERIOR_DESIGN.md."

**3. Hearths and lighting.** "Resume the design track in docs/handoffs/2026-11-10-design/hearths-lighting.md, branch
design/wip-hearths (63d4c19). Rebase on main after the library-first track merges. Under D-132 a fire may change spot
between stages, so drop the rule that keeps its end, and let the house rework walls round a new hearth. Bring the share
of middle fires in homes toward the corpus (16 %; 92 % along a wall in homes under 120 m2), apply D-130 and D-131 once
answered, run the full checks, merge."

**4. Not started:** tightening the piece models on Tyler's PC (ROADMAP design item 2b: rerun lab/extract_models.py
with a finer proxy, split prisms into boxes in lib/mesh.js); growth for the weak lines (now under D-132's looser
rules); corpus by culture; the valheimians and game-reference interior study; store rooms at d3 and window boxes.
