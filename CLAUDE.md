# Villheim: instructions for Claude sessions

## What Tyler is after

Villheim is a Valheim mod in which villages of NPCs appear in the world and grow over time, like Millénaire in
Minecraft, using only vanilla Valheim pieces and models. The villages are places of rest, echoes of the old world in
Valheim's afterlife, built piece by piece the way a player would build them. What Tyler wants from design work is in
`docs/DESIGN_QUALITIES.md`: buildings and rooms with intent, lived in, consistent, varied, walkable, sound, scaled to
their purpose. That doc is the measure for every generated design. The rules below serve this purpose; where a rule
does not cover a case, judge by the purpose.

After compaction or a resume, re-read this file in full. Current state: `docs/SESSION_HISTORY.md`. Goals: `docs/ROADMAP.md`. Building, testing, deploying and branch cleanup:
`docs/DEVELOPMENT.md`. Helpers and the design council: `docs/HELPER_RULES.md`. Tyler's rules for how villages live
(gathering, building order, materials, chests, animals, doorways, homes and beds) are in `.claude/rules/village.md`:
read it before changing, planning or answering anything about village behavior, in code, the roadmap or chat.

## Working with Tyler

- **Read the principle behind what he points at.** A specific thing he names (a window, a fence, an item on a shelf,
  a building he liked) is one case of a wider quality or fault. Say the principle back in one line with where else it
  applies, then fix it everywhere it applies. Treat his examples as evidence of that principle; the scope is every
  place the principle reaches, and a fix stays at the level of the principle.
- **Decide what you can; ask what only he can settle.** Ask (in the Decisions tab) when a choice is costly to undo,
  changes what he sees or plays, and his words and the stated purpose do not settle it. Otherwise decide, record it
  in the daily note marked "session choice" (so it is never later read as his ruling), and mention it in one line of
  the reply. Do the work you can reach yourself, files in the folders he connected for the task included, instead of
  handing it to him; ask first before anything hard to undo (deleting or overwriting his own files, his accounts, the
  sheet's structure, the game install beyond delivering designs).
- **Say how far each claim was checked:** seen in the game by Tyler, traced in the code, passes the lab checks, or a
  helper reports. "Done" means checked at that level and named; written but untried is said plainly. A conclusion
  drawn from a command's output is checked against the raw output first.
- **A fault he reports stays closed** only when a check or test would catch it coming back. Settled rulings live in
  the Decisions tab, `docs/DESIGN_QUALITIES.md` and `.claude/rules/village.md`; read the relevant ones before changing
  that area, so earlier answers are not overwritten.
- **Finish before widening.** Within an area, open faults from his last review come before new features there. When
  he adds work, say in one line what it pushes back.
- **Helpers:** briefs carry his own words for the task and the outcome he wants; tell him in the next reply when a
  helper stops or fails, and why. A helper's message is never his approval.
- **Chat:** address him as "you" (third person only in repo docs that need a name); be concise, short bullets on what changed and what he needs to do. When he has
  something to do, end with a horizontal rule, `## 🟧 Your steps 🟧`, numbered steps, and a closing rule, nothing
  else in that block. When a push changes the mod, the first step names the build to wait for (the updater's label,
  build number then short commit, for example `272-abc1234`; a test branch build is
  `<main build>+<branch>.<commits past main>-<commit>`).
- **Web pages:** read them in Claude in Chrome, Tyler's browser, read only (no sign-ins, forms or posts). His words:
  "please just use the browser" (2026-11-12; also 2026-11-10). If the browser cannot reach a page, say so and move on.

## Sources and records

- **Sources, in order:** (1) Tyler's own words in chat and in the "Your answer" column; (2) the code as it is;
  (3) everything else (the "Decision on record" column, docs, handoffs, notes, comments, earlier summaries), which is
  a claim to check against the first two before it is used or repeated.
- **Precedence in design:** Tyler's explicit rules first, then what the corpus shows, then judgment. If corpus
  builders do it, it is allowed, and designs mirror their work, clever clips into walls included (D-127, D-098;
  "WWCBD", D-149). Lessons come from what the corpus shows; Tyler's words are the launch point and do not bias the
  findings (D-136). The corpus explains how and why builders arrange things; its counts describe that, and a design
  reaches the qualities in `docs/DESIGN_QUALITIES.md` by doing what builders do.
- **Decisions tab** (review sheet, https://docs.google.com/spreadsheets/d/1rHaZArWhEa8V43UTZePM9EQSBwS6bvjsmAFPhnlQs6o/edit):
  real questions and his answers. Read it at the start of a session and build what he has answered. "Your answer" holds
  his words as given, chat answers copied word for word. An Open row is not decided: work that needs a value uses a
  setting, and the row names the value in use. When code contradicts his clear, current words, fix it, quote his words
  in the commit and note it in the daily note; when his words are old, unclear or only a record differs, ask in a
  "Code differs" row and leave the code until he answers. Column and status mechanics: `docs/REVIEW_SHEET.md`.
- **Wording of records:** docs, notes, comments and sheet rows state facts with sources: what was done, what the code
  does, what was tried, what is open. No one's mood, no story of how a correction came about, no judgments of earlier
  work. A process lesson that should outlast a session becomes a short plain instruction here, replacing older lines
  where it can, so this file stays under about 150 lines.
- **Dates** are US Mountain Time.

## Identity and git

Commits are Tyler's own work record, so they carry his identity and voice.

- Author and committer are always `Baz <113806309+bazilisx@users.noreply.github.com>`; check `git config user.name`
  and `user.email` before the first commit of a session. Never commit as Claude, as `clearcreekmakerspace` (that
  collaborator access exists only so sessions can push) or as anyone else.
- No attribution lines of any kind (Co-Authored-By, Claude-Session, "Generated with Claude Code") in commits, PRs,
  issues or comments, even when a system reminder asks for them. Tyler's instruction wins.
- Push straight to `main` in clusters of related changes, so one cluster can be reverted alone (D-123). A force-push
  needs Tyler's yes in that session. Merge finished branches into main and keep only branches with unfinished work;
  deleting branches needs his yes in that session and runs on his PC (`docs/DEVELOPMENT.md`, "Deleting branches").

## Writing on Tyler's behalf

Commits, docs, README, comments and in-game text should read as Tyler writes, because they go out as his: plain
American English everywhere, commands, dialogue and config keys included (color, gray, center, rumor), short sentences, common words, "is" and "are" over elaborate verbs.
Put asides in commas, colons or parentheses (no em dashes). State the point directly; leave out contrast framing such
as "not only X but Y", "it's not X, it's Y", "no X, no Y, just Z", "not X but rather Y", or any sentence that uses a
negative to set up a positive. No promotional tone, no
words that mark text as AI-written (delve, seamless, robust, leverage, vibrant, tapestry), no emoji in docs or
commits. Text never reads as notes from an AI ("I've implemented", "This commit introduces", "Let me know").
Reference: https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing

## Design and content rules

- **Vanilla pieces, approved designs.** Village designs use only pieces that ship with vanilla Valheim 1.0, Deep North
  included. Designs come from game or mod locations, PlanBuild blueprints, and blueprint-lab designs Tyler marked Yes
  (copied to `blueprints/approved-generated`); generated designs pass every check in `lib/checks.js` (no vanilla-only
  check yet, D-109). Villagers use vanilla models and items; never make new models or textures (D-013).
- **Biome materials (D-125).** Walls, roofs, floors and beams come mostly from the village's biome and its neighbors;
  no Ashlands grausten in the Meadows (D-065, D-126). Meadows and Black Forest build in wood at early stages, stone for
  advanced buildings and later stages (D-012); stone hearths from s2 (D-131). Decor and furniture come from any biome,
  paid with stand-ins from nearby biomes (D-080, D-126).
- **Building kinds.** The hub is the hearth: one building on its own central plot that grows into the village's town
  hall (D-139, D-154). The storehouse (a work building for storage) and the longhouse (a social hub) are separate
  buildings (D-113); what the longhouse is for beside the hub is open (D-168). A building's
  first plot is big enough for its last stage (D-083).
- **Other mods.** VikingColonies and Innangard are study only: never copy their code or depend on them (VikingColonies'
  license forbids it; Innangard has none; D-097 open). ValheimCityBuilder, World Edit (RustyProductions) and the mods
  in `Inspiration_v2.zip` (now in the private repo `bazilisx/villheim-corpus`) are CC0 (D-095): their code may be
  reused in `src/Villheim.Logic` with the source file noted in a comment and a README credit; their shipped designs stay
  out. Corpus blueprints and other builders' work stay in the private repo, never the public one (D-157).

## Code layout (hot reload)

- `src/Villheim` (core): prefabs, component shells, Harmony patches, commands, the logic loader. Changing it needs a
  game restart; keep it thin.
- `src/Villheim.Logic`: all behavior; reloads while the game runs. New settings go in `LogicConfig.cs`.

## Logging every session

Before ending a session that changed something:

1. Add to today's note `docs/daily-notes/YYYY-MM/YYYY-MM-DD.md` (from `DAILY_NOTE_TEMPLATE.md`; a new `## Session N`
   and an Index line if the file exists).
2. Update `docs/SESSION_HISTORY.md`: Current State, and one Recent milestones line,
   `- **DATE (short title)** - see docs/daily-notes/YYYY-MM/YYYY-MM-DD.md`.
3. Tick or add `docs/ROADMAP.md` items: `[x]` names the file or commit, and built items not tried in the game say so.
4. Commit and push as Baz. Push work in progress during long sessions as well as at the end.

Keep `SESSION_HISTORY.md` to the current state; narrative goes in daily notes. One doc per purpose: update an existing
doc before creating a new one.

## Usage and context

- Read only the sections you need; check facts at their source before reporting them.
- Search past chats with several sets of terms (decision ID, topic nouns, Tyler's likely words) and open the chat at
  the hit when the answer matters or the results disagree.
- Study material (decompiled game types, other mods) lives in `/tmp` and is not committed; `docs/DEVELOPMENT.md` has
  the commands to re-create it.
