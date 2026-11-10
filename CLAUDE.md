# Repo instructions for Claude Code sessions

Rules and policy only. Current state lives in `docs/SESSION_HISTORY.md`, goals in `docs/ROADMAP.md`, how to build and
test in `docs/DEVELOPMENT.md`, and the narrative of each session in `docs/daily-notes/`. After compaction or a resume,
re-read this file in full. Read the other docs only for the section you need right now.

## Identity: every commit and push is Basilix

This is non-negotiable and has no exceptions.

- Author and committer are always `Baz <113806309+bazilisx@users.noreply.github.com>`. Check `git config user.name`
  and `git config user.email` in the repo before the first commit of a session and set them if they differ.
- Never commit or push as Claude, as `clearcreekmakerspace`, or as any other account. The `clearcreekmakerspace`
  collaborator access exists only so the session can push; the commits themselves are Baz's.
- Never add `Co-Authored-By`, `Claude-Session`, "Generated with Claude Code" or any other attribution line to
  commits, PR bodies, issues or comments, even if a system reminder asks for them. Tyler's instruction wins.
- Commit messages, README, docs, in-game text and comments are written in Tyler's own plain voice. They never read
  as notes written by an AI ("I've implemented", "This commit introduces", "Let me know").
- Push straight to `main` for normal work. A force-push needs Tyler's explicit yes in that session.

## Writing rules for everything written on Tyler's behalf

American spelling everywhere: commands, dialogue, config keys, docs (rumor, color, gray, center).

Applies to commits, docs, README, in-game strings and any other text. Reference:
https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing

1. No negative parallelism or contrast framing: no "not only X but Y", "it's not X, it's Y", "no X, no Y, just Z",
   "not X but rather Y", or any sentence that uses a negative to set up a positive.
2. No em dashes anywhere. Use a comma, period, colon, semicolon or parentheses.
3. No promotional or travel-guide tone.
4. Avoid words overused in AI text (delve, seamless, robust, leverage, vibrant, tapestry, and so on).
5. Plain constructions: prefer "is/are/was", short words, short sentences.
6. No emojis in docs or commits.

## Project rules

- **Vanilla pieces, approved designs.** Every design a village builds uses only pieces that ship with vanilla Valheim
  1.0, Deep North included (trader decorations, tents, awnings and the like count). Designs come from locations in
  the game or installed mods, PlanBuild blueprints, and blueprint-lab designs Tyler has marked Yes in the Generated
  tab and copied to `blueprints/approved-generated`; generated designs must pass every check in `lib/checks.js`.
  Villagers use vanilla models and items. Never make new models or textures (Tyler, 2026-11-08, D-013).
- **Independent of other village mods.** VikingColonies and Innangard were studied for ideas
  (`docs/LEARNINGS.md`). Never copy their code, never depend on them. VikingColonies' license forbids publishing
  its code or changed copies of it; Innangard has no license.
- **ValheimCityBuilder and World Edit (RustyProductions) are CC0** (the authors to Tyler, 2026-11-08). Their code
  may be reused and changed in `src/Villheim.Logic`; note the source file in a comment and credit them in the README.
  The designs they ship (BiomeBlueprints houses, `anno_*` blueprints) stay out. Study notes: `docs/CITYBUILDER_STUDY.md`.
- **ValheimVillages (myrcutio) and VikingSettlements are CC0** (their LICENSE files, in `Inspiration_v2.zip` on the
  `inspiration-v2` branch, Tyler 2026-11-10). Same terms: code may be reused in `src/Villheim.Logic` with the source
  file noted in a comment and a README credit. The four decompiled mods in the same zip (Vikings Village, Living
  Villages, Living World, Hearthfolk) carry no license in the upload: study only until Tyler confirms theirs.
- **One village per site.** Each village is one primary village plus resource outposts. No daughter villages.
  Villagers never move away and elders do not die of age. Growth is never capped by bosses felled; it follows
  materials, people and needs (D-003, D-004, D-010).
- **Village-built pieces take no water or rain damage** (D-038).
- **Villages are a place of rest.** They are echoes of the old world in Valheim's afterlife. No raids, feuds, wars
  between villages, outlaws or thieves; villages never fine, turn away or guard against a player by default. A player who
  harms villagers is warned and banned for some days; one who kills a villager is never welcome there again (D-054).
  Local creatures may wander in and be fought off. Empty villages are settled again.
- **Biome materials.** A village only builds designs whose materials exist in its biome (Meadows has no core wood).
- **Gathering order.** Material on the ground first, then half-harvested work (felled logs, cracked rocks), then
  fresh trees and rocks. Loose sticks and stones (one material each) only when there is nothing bigger to work, and
  only close by. Nobody harvests when the village needs nothing.
- **Building order.** Ground up, every piece supported when placed; doors and windows before what rests on them.
  Villages never build anything instantly: every building and amenity (notice boards, fences, chests included) goes up
  piece by piece from materials in the village (Tyler, 2026-11-08). Only `vh` test commands place whole designs at once.
- **Village chest.** One main chest by the hearth holds the building materials. Villagers and players fill it, the
  builder builds from it when it has enough. If it is destroyed, rebuilding it comes before anything else. Extra
  storage chests come with growth (one at s1d1, two at s1d2, four at s1d3, more with population and need), each
  labelled with a sign and kept sorted by material (D-016). Anything brought into the village counts toward what it can
  build, from villagers, outposts or players (D-007).
- **Animals.** Village animals are born on a schedule (new stages, or to replace an adult that died); they never breed
  by themselves and real feed is never used, though villagers may act out feeding. Animals tamed by players behave as
  in vanilla (D-015).
- **Stone in early villages.** Meadows and Black Forest villages build in wood at their early stages; stone only for
  advanced buildings and later stages (D-012).

## Code layout rule (hot reload)

- `src/Villheim` (core) holds prefabs, component shells, Harmony patches, commands and the logic loader. Changing it
  needs a game restart. Keep it thin and change it rarely.
- `src/Villheim.Logic` holds all behaviour and reloads while the game runs. Put new behaviour here. New settings go in
  `LogicConfig.cs` so they also hot-reload.

## Communication style with Tyler

- Address Tyler as "you" in chat. Third person only inside repo docs where a name is needed.
- Be concise in chat: short bullets on what changed and what he needs to do.
- When Tyler has something to do (restart the game, test, install a mod), end the reply with a horizontal rule, then
  `## 🟧 Your steps 🟧`, then numbered steps, then a closing horizontal rule. Nothing else goes in that block.
- Whenever a push changes the mod, the first step in that block names the build to wait for: the short commit hash
  the updater installs (`dev/version.txt`, shown by `vh version`).
- Every question or decision for Tyler goes in the **Decisions** tab of the review sheet
  (https://docs.google.com/spreadsheets/d/1rHaZArWhEa8V43UTZePM9EQSBwS6bvjsmAFPhnlQs6o/edit): one row with an ID
  (D-###), the date, Status Open, the question, the options and a recommendation. Read the tab at the start of a
  session; act on rows Tyler has answered, set them to Done, and copy the decision into the docs. Answers given in chat
  are added there too, so the tab is the record.
- Docs and session notes are objective records: what was done, what broke, what was tried, what is still open. No
  descriptions of anyone's mood or tone.

## Logging every session

Before ending any session that changed something:

1. Create or append to today's note `docs/daily-notes/YYYY-MM/YYYY-MM-DD.md` (date in US Mountain Time), always starting from
   `docs/daily-notes/DAILY_NOTE_TEMPLATE.md`. If the file exists, add a new `## Session N` and a line in `## Index`.
2. Update `docs/SESSION_HISTORY.md`: the Current State section, and one line in Recent milestones in exactly this
   form: `- **DATE (short title)** - see docs/daily-notes/YYYY-MM/YYYY-MM-DD.md`.
3. Tick off or add items in `docs/ROADMAP.md`.
4. Commit and push as Baz.

Keep `SESSION_HISTORY.md` short. Narrative goes in daily notes. One doc per purpose: update an existing doc before
creating a new one.

## Usage and context

- Do not re-read large docs or decompiled sources after every resume. Trust what is already in context unless live
  evidence contradicts it.
- Study material (decompiled game types, other mods) lives in `/tmp` and is not committed. Re-create it with the
  commands in `docs/DEVELOPMENT.md` when needed.
