# Villheim handoff, night of 2026-11-09 to 2026-11-10

For the next session. The session that wrote this could read the repo, build it and read Tyler's game log, but
could not push to GitHub. Its work is a branch in a git bundle beside this note. Nothing here is on `main`.

## Read in this order

1. This file.
2. `FINDINGS.md`: each problem with its evidence, the primary cause, the other suspects and what to try next.
3. `CHANGES.md`: each commit, what it changes, and how far it is proven.
4. `DECISIONS.md`: questions for Tyler, written as rows for the Decisions tab (not entered there yet).
5. `TEST_PLAN.md`: what Tyler should try in the game once the build is on `main`.
6. `GENERATOR.md`: the pool audit and ideas for the generator work.

Files: `villheim-overnight.bundle` (the branch), `pool-audit.json` (audit of the 81 pool designs), `sizes.js` and
`sim.js` (the two small scripts behind the size table and the packing test), `PROMPT.md` (for Tyler to paste).

## Get the work

```
git fetch "<this folder>/villheim-overnight.bundle" overnight/2026-11-10:overnight/2026-11-10
git log --oneline main..overnight/2026-11-10        # nine commits, all authored by Baz
```

The bundle is built on `ec0f0b1` (main as of 2026-11-09 22:23 Mountain Time). If `main` has not moved, a fast-forward
merge works. Each commit builds by itself, so any of them can be dropped or reordered.

Build check used here: `apt-get update && apt-get install -y dotnet-sdk-8.0`, then
`dotnet build Villheim.sln -c Release` (nuget.bepinex.dev answered from this container). Lab checks:
`node lab/check_set.js 2`, `node lab/test_structure.js`, `tools/gen-test/run.sh` (needs
`npm install --no-save @napi-rs/canvas` in `tools/blueprint-lab` for the picture commands only).

## What is in the branch, in one screen

| Commit | What | Proven how far |
|---|---|---|
| 4554836 | Plot search: causes counted, spot verdicts kept, 25 ms a tick, set-aside projects, fence no obstacle, fence and sign scans listed once, hammer held while decorating | Ran in Tyler's game about 2 minutes: set-aside and the time limit worked |
| 89027b9 | "No room" line names what stood in the way | Loaded in the game; no search ran before the game closed |
| de3c31e | Real footprints, 2.5 m gap, hearth margin, ruins and rocks cleared, hold-up text on the hearth | Builds; not tried in the game |
| 913d5cd | Tools held between job steps, job label held through the gap | Builds; not tried in the game |
| 730e909 | Next step cached 3 s; timers in the notice board update | Builds; not tried in the game |
| 1f95633 | Store rooms stacked and labeled; pool audit script; lab.js rebuilt | Lab checks and the engine comparison pass |
| 382142c | `vh plot check / here / clear` | Builds; not tried in the game |
| 801c6cb | Ruins cleared on upgrades and test villages; workshop and farm rings nearer | Builds; not tried in the game |
| d436074 | Daily note (Session 4), SESSION_HISTORY, ROADMAP | n/a |

## State of Tyler's game

- `main` is `ec0f0b1`. The plugin folder holds the logic DLL of `89027b9`, copied in by hand at 23:05 (the log shows
  "Loaded logic #8"). The updater compares against `villheim-build.txt` (still `ec0f0b1`) and leaves it alone until
  the next push to `main`, which replaces it.
- LagLog and DebugLog are on in his config. Log: `BepInEx/LogOutput.log` in the "Villheim Test" profile.
- Test villages in that world: Neuftot (3 homes, hall pending) and Tingvoll (shore village).

## Rules Tyler set tonight

- Builds reach the game only through `main` and the updater. No copies into the plugin folder.
- One build per bundle of related fixes, announced with its hash and what to test.
- Answer his messages and questions before going on with other work.
- Give more than one avenue per bug: the primary cause, the other suspects and their fixes.
- Priorities: lag and the immediate fixes first (this chat, the review sheet, earlier handoffs), then the generator.

## Not done, and why

- **The review sheet's rows were not read.** The Drive connection here returns tab headers and two sample rows per
  tab only. Tests T-601 to T-630 and the Decisions tab need reading, and `DECISIONS.md` needs entering.
- **Which pieces blocked the plots is still unknown.** See FINDINGS 1; one log line settles it.
- **The spot tool itself** (item, preview on the ground) is not built; its backend and commands are.
- **Nothing was tested in the game** after the first two commits.

## Earlier handoff

`handoff-2026-11-09/` (same parent folder) holds the first two commits as patch files and an older note. This
folder replaces it; the bundle contains those two commits.
