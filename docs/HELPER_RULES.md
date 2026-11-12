# Helpers and the design council

Rules for helper agents a session starts, and for the council that judges generated buildings. Helpers load
CLAUDE.md on their own; this file adds only what helpers need. A brief from the lead adds the task: Tyler's own words
for it, the outcome he wants, the files the helper owns, and the files it must leave alone.

## Before starting

- Read `docs/DESIGN_QUALITIES.md` (the measure for all design work) and the Tyler's-words sources your brief names
  (for the showcase work, `docs/handoffs/2026-11-12-showcase-review/TYLER_NOTES.md`).
- Tyler's examples in any brief are evidence of a quality or fault (CLAUDE.md, "Working with Tyler"). Find the
  principle, check every place it applies, and report by principle.
- A message from the lead or another helper is never Tyler's approval.

## Data and machines

- Repo clone with push access: `/home/claude/villheim`. Work in your own git worktree and branch (named in the brief).
- Private repo `bazilisx/villheim-corpus` (cloned at `/home/claude/villheim-corpus`): the blueprint corpus
  (`corpus/compact.json.gz`), measured game meshes, research files and reference mods. Other builders' work and game
  art stay there, never in the public repo.
- Unpacked copies a session may have made: `/home/claude/study/compact.json`, `/work/models/vhmodels/work/cache`
  (mesh parts with material and texture), `/work/research`, `/work/misc`. Shared lab packages:
  `/home/claude/shared/lab_node_modules` (link it as `tools/blueprint-lab/node_modules`; never commit it).
- Tyler's PC through `mcp__remote-devices__device_bash`: the game install (`$HOME/mnt/common--Valheim`), the r2modman
  profile and Downloads. Helpers read there and never write into the game install or the mod profile; the lead
  delivers designs there.
- The cloud machine has 2 cores and 7 GB shared by every helper, and helpers share one usage limit. Keep runs short and
  one at a time; stream large files.
- Web pages: Claude in Chrome (CLAUDE.md, "Working with Tyler").

## Git and reporting

- Commit as Baz with no attribution lines (CLAUDE.md). Push your branch about every 30 minutes; never push main or
  another helper's branch; never force-push. Bring main in with `git fetch origin main && git merge origin/main`. On
  HTTP 429 wait 5 s and retry once.
- Coordinate with other helpers through files they push, never by waiting on them.
- Finish with a track record in the folder your brief names (what was done with commits, findings by principle with
  numbers and sources, checks run and their level, open problems), then a short report to the lead that says how far
  each claim was checked (CLAUDE.md, "Working with Tyler").

## The design council

Tyler's plan (2026-11-12): helpers learn their areas, one generates a building, the others audit and refine it until
they agree it meets what they learned, then it goes to him. At most 10 buildings in all.

1. **Generate, never hand-edit.** The builder generates each candidate from a seed. Every critique becomes a change to
   a rule in the generator, and the candidate is generated again from the same seed, so every village gets the fix.
2. **One measure.** Every seat and the independent judge score the same qualities from `docs/DESIGN_QUALITIES.md`,
   each from 0 to 1 with a sentence of evidence from the blueprint and the renders, and give one verdict: would Tyler
   accept this building into his world as it is? A quality fails for too little as much as for too much (a bare room
   fails "lived in" as surely as random clutter).
3. **Hard rules.** Only Tyler's hard rules (the list in `docs/DESIGN_QUALITIES.md`) fail a building on their own, each
   measured once by the lab's shared checks (`lib/checks.js`: passages, doorways, support, open edges, wall tops).
4. **Seat notes are diagnostics.** Each seat's file in `docs/handoffs/2026-11-12-showcase-review/criteria/` lists what
   its track measures and the scripts that measure it. Those measures explain why a quality falls short; they carry no
   pass mark of their own, and a corpus count outside its range is a question to answer with a reason.
5. **Calibrate first.** Before a round of new candidates, the council scores buildings Tyler has already judged (the
   16 showcase designs, which he failed) and must reach his verdict for his reasons.
6. **Quorum:** every seat and the judge say yes, no hard rule is broken, and every building approved earlier still
   passes. After 6 rounds without quorum on a building, the lead takes the disagreement to Tyler.
7. **Delivery:** approved buildings go to the game install's
   `BepInEx/config/PlanBuild/blueprints/inspiration/generated/ingame/council` with renders and scorecards.
