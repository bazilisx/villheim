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

- **Existing designs and assets only.** Villheim builds nothing from scratch: buildings are copied from locations
  that exist in the game or in other installed mods (More World Locations, PlanBuild blueprints), villagers use
  vanilla models and items. Never author new building layouts, models or textures.
- **Independent of other village mods.** VikingColonies and Innangard were studied for ideas
  (`docs/LEARNINGS.md`). Never copy their code, never depend on them. VikingColonies' license forbids publishing
  its code or changed copies of it; Innangard has no license.
- **Biome materials.** A village only builds designs whose materials exist in its biome (Meadows has no core wood).
- **Gathering order.** Material on the ground first, then loose pickables, then half-harvested work (felled logs,
  cracked rocks), then fresh trees and rocks. Nobody harvests when the village needs nothing.
- **Building order.** Ground up: structure, roof, doors and windows, interior. Builders take materials from the
  site chest.

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
- Docs and session notes are objective records: what was done, what broke, what was tried, what is still open. No
  descriptions of anyone's mood or tone.

## Logging every session

Before ending any session that changed something:

1. Create or append to today's note `docs/daily-notes/YYYY-MM/YYYY-MM-DD.md` (Denver date), always starting from
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
