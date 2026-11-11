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
  tab and copied to `blueprints/approved-generated`; generated designs must pass every check in `lib/checks.js`
  (no vanilla-only check exists yet, see D-109).
  Villagers use vanilla models and items. Never make new models or textures (Tyler, 2026-11-08, D-013).
- **Independent of other village mods.** VikingColonies and Innangard were studied for ideas
  (`docs/LEARNINGS.md`). Never copy their code, never depend on them. VikingColonies' license forbids publishing
  its code or changed copies of it; Innangard has no license.
- **ValheimCityBuilder and World Edit (RustyProductions) are CC0** (the authors to Tyler, 2026-11-08). Their code
  may be reused and changed in `src/Villheim.Logic`; note the source file in a comment and credit them in the README.
  The designs they ship (BiomeBlueprints houses, `anno_*` blueprints) stay out. Study notes: `docs/CITYBUILDER_STUDY.md`.
- **Every mod in `Inspiration_v2.zip` is CC0** (`inspiration-v2` branch: ValheimVillages, VikingSettlements, Vikings
  Village, Living Villages, Living World, Hearthfolk; Tyler 2026-11-10, D-095). Same terms as the CityBuilder rule (a project convention): code may be reused in
  `src/Villheim.Logic` with the source file noted in a comment and a README credit. Innangard in `Inspiration.zip` on
  main stays study only until D-097 is answered.
- **One village per site.** Each village is one primary village plus resource outposts. No daughter villages.
  Villagers never move away and elders do not die (D-003); how a villager's death is handled is open (D-122). Growth is never capped by bosses felled; it follows
  materials, people and needs (D-003, D-004, D-010; MaxBuildings and MaxVillagers still cap it, see D-106).
- **Village-built pieces take no water or rain damage** (D-038).
- **Villages are a place of rest.** They are echoes of the old world in Valheim's afterlife. No raids, feuds, wars
  between villages, outlaws or thieves; villages never fine, turn away or guard against a player by default. A player who
  harms villagers is warned and banned for some days; one who kills a villager is never welcome there again (D-054).
  Local creatures may wander in and be fought off. Empty villages are settled again.
- **Biome materials (D-125).** The look of a village's buildings follows its biome and the biomes around it: walls,
  roofs, floors and beams come mostly from those, with no Ashlands grausten in the Meadows (D-065, D-126). Stone waits
  for advanced buildings and later stages in the Meadows and Black Forest (D-012), with stone hearths allowed from s2
  (D-131). Anything brought into the village counts toward paying for what it builds, whether it comes from villagers,
  outposts or players (D-007, D-024). Decor and furniture can come from any biome and are paid with stand-ins from
  nearby biomes (D-080, D-126).
- **Gathering order.** Material on the ground first, then half-harvested work (felled logs, cracked rocks), then
  fresh trees and rocks. Loose sticks and stones (one material each) only when there is nothing bigger to work, and
  only close by. Nobody harvests when the village needs nothing.
- **Building order.** Ground up, every piece supported when placed; doors and windows before what rests on them.
  Villages never build anything instantly: every building and amenity (notice boards, fences, chests included) goes up
  piece by piece from materials in the village (Tyler, 2026-11-08). Only `vh` test commands place whole designs at once.
- **Village chest.** One main chest by the hearth holds the building materials. Villagers and players fill it, the
  builder builds from it when it has enough. If it is destroyed, rebuilding it comes before anything else. Extra
  storage chests come with growth (one at s1d1, two at s1d2, four at s1d3, more with population and need), each
  labeled with a sign and kept sorted by material (D-016; the code counts buildings standing, see D-104). Anything brought into the village counts toward what it can
  build, from villagers, outposts or players (D-007).
- **Animals.** Village animals are born on a schedule (new stages, or to replace an adult that died); they never breed
  by themselves and real feed is never used, though villagers may act out feeding. Animals tamed by players behave as
  in vanilla (D-015).
- **Stone in early villages.** Meadows and Black Forest villages build in wood at their early stages; stone only for
  advanced buildings and later stages (D-012). Hearths: wood at s1, stone acceptable at s2 and s3 in the Meadows and
  every later biome (D-131).
- **Learn from the corpus.** If the corpus builders do it, it is allowed and the designs mirror their work, clever
  clips into walls included (D-127, D-098). Lessons and findings come from what the corpus shows; the examples Tyler
  gives when setting a task do not bias them (D-136).
- **Materials as for a player.** Building pieces and paths cost materials; anything the village breaks down returns
  its full materials, straight into the chest with nothing dropped; trees, rocks and obstacles yield what they yield a
  player; changing a path returns nothing (D-088, Tyler 2026-11-10). Open questions on costs: D-100.
- **Doorways.** Villagers always use doorways and never use indoor things from outside or through windows. Every door
  is usable by villagers and players. A villager at a blocked entrance opens the door, tries, then passes through the
  blocked doorway; never through a closed door (D-096; built in part).
- **Homes and beds.** Beds and houses are assigned ahead of time by arrival order, never claimed. The roster is rolled
  ahead with family sizes; a first house is big enough for the family still to come. Families have at most 4 people
  in any mix. Four villagers at the start, with no fixed rule that the first ones are single. No house without beds
  for everyone who will live in it. Beds never change hands (D-077, not built yet).
- **Building kinds.** The storehouse (storage) and the longhouse (social hub) are separate buildings (D-113). The first
  plot of a building is big enough for its last stage (D-083).

## Code layout rule (hot reload)

- `src/Villheim` (core) holds prefabs, component shells, Harmony patches, commands and the logic loader. Changing it
  needs a game restart. Keep it thin and change it rarely.
- `src/Villheim.Logic` holds all behavior and reloads while the game runs. Put new behavior here. New settings go in
  `LogicConfig.cs` so they also hot-reload.

## Communication style with Tyler

- Address Tyler as "you" in chat. Third person only inside repo docs where a name is needed.
- Be concise in chat: short bullets on what changed and what he needs to do.
- When Tyler has something to do (restart the game, test, install a mod), end the reply with a horizontal rule, then
  `## 🟧 Your steps 🟧`, then numbered steps, then a closing horizontal rule. Nothing else goes in that block.
- Whenever a push changes the mod, the first step in that block names the build to wait for: the build label the
  updater installs, build number then short commit (`dev/version.txt`, shown by `vh version`, for example `272-abc1234`;
  a higher number is a later build). A test branch build is labeled `<main build>+<branch>.<commits past main>-<commit>`.
- Every question or decision for Tyler goes in the **Decisions** tab of the review sheet
  (https://docs.google.com/spreadsheets/d/1rHaZArWhEa8V43UTZePM9EQSBwS6bvjsmAFPhnlQs6o/edit): one row with an ID
  (D-###), the date asked, Status Open, the question, the options and a recommendation. Read the tab at the start of a
  session and build what Tyler has answered. Answers given in chat are added there too, so the tab is the record.

## Records and evidence

- **Sources, in order.** (1) Tyler's own words: his messages in chat and the "Your answer" column. (2) The code as it
  is. Everything else (the "Decision on record" column, docs, handoffs, daily notes, code comments, summaries of
  earlier sessions) is a claim to check against those two before it is used or repeated.
- **Decisions tab columns.** "Your answer" holds Tyler's words as he gave them; a session copies chat answers in word
  for word and does not reword them. "Decision on record" restates only what the answer says, then where it is built
  (file) once it is built. A detail the answer leaves open becomes a new Open row.
- **Status.** Open: asked. Answered: Tyler has answered. Done: built in the code, with the file named in "Decision on
  record"; for a rule with no code, written into CLAUDE.md or the doc named there. A row with an Open "Code differs"
  row stays Answered until that row is settled. A decision that needs no work is Done with "No code" in Decision on
  record. Tyler sets rows to Answered; a
  session sets Done once the work is built. Whether it works in the game is recorded in the Tests tab.
- **Open rows.** Code does not treat an Open row as decided. When work needs a value before Tyler answers, the value is
  a setting and the row says which value is in use until he answers.
- **Code that differs from a decision** gets an Open row ("Code differs from D-###") stating the decision, what the
  code does (file) and the options. The code stays as it is until Tyler answers.
- **Tests and Features tabs.** "Result" and "What you saw" are Tyler's reports. "Built and tested" in the Features tab
  needs a Tests row he marked Pass, or his word in chat.
- **Roadmap.** `[x]` means built, with the file or commit named. Built items not yet tried in the game say "not tried
  in the game". An item that conflicts with a decision or a project rule is removed, with the decision named.
- **Code comments** that cite a decision state only what that decision says.
- **Checking before reporting.** Before stating that something is built, fixed, decided or tested, check it at its
  source (the code, the tab, Tyler's words) and name that source. A conclusion from a command's output is checked
  against the raw output first.
- **Dates** are US Mountain Time. "Asked" is the day the question was put to Tyler, or the day he gave the answer
  unasked.
- **Wording.** Docs, notes, handoffs, comments and sheet rows state facts: what was done, what the code does, what
  was tried, what is open, with sources. They contain no descriptions of anyone's mood, tone or reactions, no
  narration of how a correction came about, and no judgments of earlier work. A correction is written as the
  corrected fact with its source, for example "D-077 record set to match the answers of 2026-11-09 and 2026-11-10 (chat)."

## Logging every session

Before ending any session that changed something:

1. Create or append to today's note `docs/daily-notes/YYYY-MM/YYYY-MM-DD.md` (date in US Mountain Time), always starting from
   `docs/daily-notes/DAILY_NOTE_TEMPLATE.md`. If the file exists, add a new `## Session N` and a line in `## Index`.
2. Update `docs/SESSION_HISTORY.md`: the Current State section, and one line in Recent milestones in exactly this
   form: `- **DATE (short title)** - see docs/daily-notes/YYYY-MM/YYYY-MM-DD.md`.
3. Tick off or add items in `docs/ROADMAP.md` by the Roadmap rule in Records and evidence.
4. Commit and push as Baz.

Pushes come in clusters of related fixes and changes, so one cluster can be reverted alone if it proves faulty
(D-123).

Keep `SESSION_HISTORY.md` short. Narrative goes in daily notes. One doc per purpose: update an existing doc before
creating a new one.

## Usage and context

- Do not re-read large docs or decompiled sources after every resume. Read only the section needed, and check any
  fact about the code, a decision or a test at its source before reporting it (see Records and evidence).
- Search past chats with several sets of terms (the decision ID, the topic's nouns, Tyler's likely words) and open the
  chat at the hit when the answer matters or the results disagree.
- Study material (decompiled game types, other mods) lives in `/tmp` and is not committed. Re-create it with the
  commands in `docs/DEVELOPMENT.md` when needed.
