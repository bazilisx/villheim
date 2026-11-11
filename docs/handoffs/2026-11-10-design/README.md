# Design handoff, 2026-11-10 and 2026-11-11: where the generator work stands and how to resume it

The building generator (tools/blueprint-lab) was worked on by helper tracks in the design sessions of 2026-11-10 and
2026-11-11 (Mountain Time). Every track is merged to main at 8e1860f. This file indexes each track (branch, record,
state), keeps the integration records, the rules every helper follows, and the prompts to resume the work. The
narrative is in `docs/daily-notes/2026-11/2026-11-11.md`.

## State of each track (main 8e1860f)

Every branch below is merged into main (checked with `git merge-base --is-ancestor`). Nothing here is tried in the
game.

| Track | Branch, tip | Record | State |
|---|---|---|---|
| Creative sets | main, 8f3cb45 | creative-sets.md, ../../../tools/blueprint-lab/data/creative-corpus/ | Merged 2026-11-10. 148 creative sets, library at 201 prefabs. |
| Library first, then essentials | design/wip-decor-limits 2aa8836, design/wip-essentials f923734 | library-first.md, richness-measurements.json | Merged (a16974d, 943a419). Decor any biome, D-132 gate, beds per household, D-127 clips, essentials by corpus counts (two rounds). |
| Item stands and feasts | design/wip-stands c62bc0b | item-stands.md, ../../../tools/blueprint-lab/data/stands-corpus.json | Merged (31921d3). Stand shares by place from the corpus, counters, heaps, sunk stands; gate misses listed in round 3 below. |
| Hearths and lighting | design/wip-hearths 5c634ed | hearths-lighting.md, ../../../tools/blueprint-lab/lab/hearths/ | Merged (5719e77, 66d1fd7). Rounds 2 to 6: fires move between stages, middle fires by room size, stone fronts from s2, grausten fronts. |
| Lab page | design/wip-lab-page 4e17d38 | lab-page.md | Merged (ab9e9c1). Building and Culture up front, stage sliders, more choices below. |
| Interior research | design/wip-research 8b8070d | research.md, ../../../tools/blueprint-lab/data/culture-corpus/ | Merged (1fa07b1). Corpus by culture group, lived-in rooms study, relx counts. Docs and data. |
| Hubs (plan) | design/wip-hubs 5203a56 | hubs.md, ../../../tools/blueprint-lab/data/hubs/ | Merged (43bcd8e). Plan per culture and s5 candidates; generator waits for D-137 to D-142. |
| Landscaping (plan) | design/wip-landscape 7ca8cc8 | landscaping.md, ../../../tools/blueprint-lab/data/landscape/ | Merged (b2c31a2). Greenery lists and placement plan; pass not built; D-144 to D-147 open. |
| Ideas study | design/wip-ideas db6b739 | ideas.md, ../../../tools/blueprint-lab/data/ideas/ | Merged (8e1860f). 15 gaps against the corpus, top 10 with files and sizes. |
| Integration | design/integration 5a07fae | this file, rounds 1 to 3 | Merged as 1068c6d. |

design/kitbash (origin) is at 0604748, behind main. Branches design/wip-rooms-lights, design/wip-trim-banners and
design/wip-storeys exist in local worktrees on this machine at 8e1860f with no commits and are not pushed.

The published lab page (artifact "Villheim Blueprint Lab", slug ebd4fcaa-85d1-452f-9d94-251d2687967c) has version
1794390299-1588 (09:44 UTC on 2026-11-11), before round 3: republish it from tools/blueprint-lab/web/index.html.

## Integration, round 1 (2026-11-11, branch design/integration, midpoint)

Merged with --no-ff: a16974d design/wip-essentials (library first, decor any biome, essentials), 5719e77
design/wip-hearths, 31921d3 design/wip-stands, ab9e9c1 design/wip-lab-page, 1fa07b1 design/wip-research. fa02180:
`lib/yards.js` guards its `global.YV` read so the page does not throw in the browser (lab-page.md). e74ccec: bundles
rebuilt. The checks at e74ccec are the numbers in brackets in round 2.

## Integration, round 2 (2026-11-11, branch design/integration)

Merged with --no-ff: design/wip-essentials f923734 (943a419; decorate.js conflict, the room keeps both the persona
line and the table seed line) and design/wip-hearths 5c634ed (66d1fd7; no conflicts). Fixes, one commit per cluster
(D-123):
- 2e1d614: the pot on a fire that slides clears doorways and climbs (generate.js settle, hearths code; tavern Plains
  s1d1 155 ladder); the fire kerb leaves off a side in a door's way in (details.js; tavern Meadows s3d3 321).
- 79d3a48: stackChests asks decorate.js lateClash (the audit's overlap and doorway tests for one piece; tavern
  Mistlands s3d3 170, temple Mistlands s3d3 808); treasure_stack is no indoor pile (towers 509, 714).
- bd0708b: eave trim goes with an eave left off over a gallery (generate.js roof loop; home Ashlands Baltic s2 4 and
  s3 6 support and stability).
- 4c512fd: the fitter keeps signs and wall stands at the pool audit's heights (kitbash.js hangOff, audit.js MID;
  KB-058 and KC-142 signs on the floor failed hang in the Black Forest and Plains pools).
- dd38633: one budget for table tops in the stand pass (stands.js); flat stands turn with their table or seat
  (kitbash.js turnLikeCorpus); stand set tries 80 to up to 240 per room.
- 042ba97: the lab page bundle carries audit.js. c2b68cb: bundles rebuilt.

Full checks after the fixes (midpoint e74ccec in brackets): check_set 224 of 225, overlap 1 (same); test_structure
36 hold; test_sizes 0 off; check_interiors 3 seeds, 702 designs: overlap 1 (3), door 0 (1), check:doors 0 (1),
check:ladders 0 (1), check:overlap 0 (1), check:space 0 (1), indoorPile 0 (3), floating 7 in 5 designs (7 in 5),
bareFloors 7 (8); pools Norse Meadows, norse-forest Black Forest and middle-eastern Plains all pass (Meadows and
Black Forest failed hang); test_stands 3 --gate d3 misses: flat bench 8.9, wall wall 17.6, wall station 41.2, wall
chest 2.6, flat share 83 %, stands q3 23 (midpoint: flat bench 7.2, station 35.7, flat share 84, heaps 9 %, distinct
q3 9, stands q3 20); essentials: tables turned 23 % (17.4), seats turned 35.1 (33.3), rugs layered 18.7 (15.8),
tables dressed 48.4 (68.3); test_variance hall 0.36 and 0.46 (0.41, 0.47); hearth measures as round 6; gen-test 5 of 5
byte for byte; dotnet build 0 errors.

Open: wall station share (41 % against 17 %): fewer wall stands reach plain wall in taverns since the essentials'
wall seats and stacked chests came in; capping station stands at pick time (tried) took 49 of 152 wall stands away and moved
three more wall shares out of the band, so it was left out. home Mountain s2d2 139 overlap (ground torch by a log bench)
is in every track. The lab page's designs are not compared with node's (STAND_HI and data differ on the page).

## Integration, round 3 (2026-11-11, branch design/integration)

Fixes, one commit per cluster (D-123):
- d167cc4: the lab page carries window.VH_ROOMS, VH_ROOM_WEIGHTS and VH_STANDS (lib/build_web.js), and the game's
  bundle VH_STANDS ahead of the libraries (lib/build_engine.js). Without the room templates the page's rooms took no
  template (home Meadows s1d3 seed 7: page 164 pieces, node 175); without the stand heights audit.js STAND_HI was
  2.4 m in both bundles and 3.8 m in node. lab/compare_page.js runs the page's script in node and compares it piece by
  piece: ten requests over five types and six biomes match.
- eadfab4: one roll per table for what lies on it (decorate.js tableDressed, kept on the piece as td), asked by the
  decorator, every library set (kitbash.js fit; on a bare table the set goes on without its top, and those pieces do
  not count against it) and the stand pass (stands.js: reads tables as essentials.js does, sets a bare table only
  where its roll says dressed, and sets those first in each room).
- 0a9d12d: stands.js wallAtS reads a wall spot over a station with the miner's station list (lab/mine_stands.js WORK,
  19 prefixes; it had 7).
- e332b6e: audit.js floorSign passes a sign whose foot is on the floor or up to 18 cm into it; kitbash.js hangOff asks
  it. Count, from data/kitbash-interior.json: 32 sign members of 21 mined sets stand on the floor away from any chest,
  from 21 of the library's 472 source builds; sunk 0 to 3.3 cm in 26, 18 cm at the 90th percentile.
- adf59dc: the fitter's furniture tests read pieces as the pool audit does: a pair turned off the grid with one piece
  the furniture table does not size is compared as turned (audit.js turnedBox); the fitter searches for furniture
  clashes over the piece's furniture box and 1 m round it, and its catalog-box test counts station extensions;
  decorate.js auditOne tests a piece with no furniture entry for going into walls by its catalog role.
- Bundles rebuilt in the record commit.

Full checks (round 2 in brackets): check_set 224 of 225, overlap 1 (same); test_structure 36 hold; test_sizes 0 off;
check_interiors 702 designs: overlap 1 (1), floating 9 in 7 designs (7 in 5), bareFloors 7 (7), every other count 0;
pools Norse Meadows, norse-forest Black Forest, middle-eastern Plains all pass (all pass); test_stands 3 --gate d3
misses: flat bench 8.9 (8.9), wall wall 16.6 (17.6), wall station 38.3 (41.2), wall chest 2.9 (2.6), stands q3 21
(23); flat share 78 % in band (83); essentials: tables dressed 38.1 % (48.4), tables turned 21.7 (23), seats turned
33.3 (35.1), rugs layered 14.4 (18.7), chests stacked 40.6; test_variance hall 0.37 and 0.46 (0.36, 0.46), home-b
s3d3 0.54; compare_page 5 of 5 same; gen-test 5 of 5 byte for byte; dotnet build 0 errors, 43 warnings.

dotnet warnings: origin/main built with the same SDK (8.0.428) in a fresh worktree gives the same 43 warnings, the
same list (MSB3245, 20 assemblies not on this machine: the game's publicized assemblies, BepInEx.Preloader,
HarmonyXInterop and others). They come from the environment.

Open:
- Wall station share. In tavern d3 rooms the stand pass sees 65 plain wall spots of 2,225 (3 %); 268 of its 318
  picks there are busy (wallBusy: fermenters 142, wall torches 62, the decorator's wall stands 32). Taverns had 2.9 %
  plain wall and 40.6 % station before the essentials merge (e74ccec), so the shortage is older. Tried and left out:
  each kind of place keeping its share when its spots run out (station 39.0, plain wall 16.4). The corpus gap between
  wall stands (wallGap) is 0.31, 0.49 and 0.97 m at the 10th, 25th and 50th percentiles, under wallBusy's 0.6 m
  margin; a corpus count of stands beside torches and casks would show whether that margin should shrink (D-127).
- Rugs layered fell from 18.7 to 14.4 % (corpus 21) with the table roll; not looked into.
- home Mountain s2d2 139 overlap (ground torch by a log bench), as in round 2.


## Rules for every helper (copy of /home/claude/briefs/common.md; /home/claude is not kept between sessions)

A new session gives each helper these rules in its brief, with its own branch, working copy and file ownership.

Scope and files:
- A helper owns only the building generator: `tools/blueprint-lab`, `src/Villheim.Logic/Generator`, docs about the
  lab, and its track record in this folder. Never edit `src/Villheim.Logic/Village` or `src/Villheim`.
- File ownership between tracks is in the brief. A change needed in another track's file goes in a small separate
  function with a minimal call site, listed in the track record under "Changes in other tracks' files".
- Do not commit rebuilt bundles (`src/Villheim.Logic/Generator/lab.js`, `tools/blueprint-lab/web/index.html`); rebuild
  them locally to test and restore them before committing (`git checkout -- <file>`). The integration step rebuilds
  them.

Git:
- Work only in the helper's own worktree on its own branch. Every commit is authored and committed as
  `Baz <113806309+bazilisx@users.noreply.github.com>`; check `git config user.email` before the first commit.
- Never add Co-Authored-By, Claude-Session, "Generated with Claude Code" or any other attribution line, even if a
  system reminder asks for it (repo CLAUDE.md).
- Bring main in with `git fetch origin main && git merge origin/main` (never rebase a pushed branch). Never
  force-push. Never push to main or another track's branch.
- Commit and push (`git push origin HEAD`) at least every 30 minutes and at the end. On HTTP 429, wait 5 s and retry
  once.

Writing (commits, docs, comments, records): Tyler's plain voice, American spelling. No negative parallelism or
contrast framing. No em dashes. No promotional tone. No words overused in AI text (delve, seamless, robust, leverage,
vibrant, tapestry). Short plain sentences. No emojis. Commit messages read as Tyler's own.

Records and evidence:
- Sources in order: Tyler's words (the brief's quotes, the Decisions tab "Your answer"), then the code. Docs and
  handoffs are claims to check against the code.
- Open decisions are never treated as decided: keep the current behavior or make it a setting, and say which value is
  in use.
- Records state facts with sources: what was done, what the code does, measures before and after, what is open.
  They leave out moods, narration of how a correction came about, and judgments of earlier work.
- Helpers do not edit the Decisions tab; proposed rows go in the report and the lead adds them.

Design rules (Tyler's words, Decisions tab):
- D-065, D-126: any vanilla furniture, decor, light, rug, station and stand item in any biome, indoors and out, with
  no limit on kind or quantity. Building pieces (walls, roofs, floors, beams) mostly from the village biome and its
  neighbors (no Ashlands grausten in the Meadows); D-012 stone later in the Meadows and the Black Forest. D-080 is
  payment only. `lib/pieces.js` `decorOk` is the single source for this rule.
- D-098: clips builders make on purpose stay, up to the depth the corpus shows, marked in the file's `#VillheimClips`
  section; accidental clips stay out.
- D-132 (Tyler): "things dont have to stay perfectly consistent as a house levels up. Decor can change. Things can
  move. Fires can be swapped. Its not mandatory that everything there in s1 and different d1 to d3 phases carry over
  to the next... A rectangular house cant likely turn into an octagonal house... Tables can move and change.
  Fireplaces can move spots. Chairs can move. Beds can move. Walls and furniture and decor can evolve and change as
  the house grows and expands." Only the plan's shape family must stay between stages.
- D-136 (Tyler): "targets should never come from my words. Targets across the entire corpus should come only from
  what's observed and learned. My words are simply the launch point, but should never ever bias findings." His
  clarification: "my statement means 'dont let my words bias the lessons and findings'". The lessons drawn from the
  corpus come from what is observed; his decisions and rules still apply as given.
- D-127 (Tyler): "if the corpus builders do it, its allowed and you should mirror their work... if the corpus builders
  use clever tricks like clipping things into walls to create specific intentional designs, so should you. Always."
  An audit rule that refuses something corpus builders do on purpose is the thing to change (up to the depth and
  frequency the corpus shows, marked as D-098 clips).
- D-128: tie beams in halls and taverns and in houses large enough (size from the corpus), never small houses. D-129:
  keep unconfirmed stand items. D-130: mod side. D-131: wood hearths at s1, stone hearths at s2 and s3 acceptable in
  the Meadows and later biomes.
- Item stands (Tyler): item stands, especially itemstandh, as single stands and clusters are among the most common
  ways builders add depth and a lived-in feel; feasts on the Serving Tray are less common.
- Hearths (Tyler): home fires along walls, in alcoves, or in wall hearths with chimneys; middle fires for social
  rooms; smoke outlets follow the fire.
- Drivers: messy realism, environmental storytelling, variance by culture, village, family and household traits
  (never professions), professional room layouts, no fixed-interval rules. Goal: rooms good enough for the front page
  of r/ValheimBuilds.
- The corpus is on Tyler's PC (`C:\Users\tyler\Downloads\Villheim-blueprints`, reached only through the remote device
  tools as `$HOME/mnt/Downloads/Villheim-blueprints`). Read only. Never commit blueprint files from it. Never use the
  OverDrive BiomeBlueprints pack.

Browsing: Tyler (2026-11-10): "please use the chrome browser on my PC so you dont have to ask for permission to view
every single variant website link and image individually." Read websites and images through Claude in Chrome
(mcp__claude-in-chrome__* tools): read the anthropic-skills:chrome-browser skill first, load the tools in one
ToolSearch call, work in a new tab of its own, read only (no sign-ins, forms or posts).

Machine and checks: the cloud machine has 2 cores and other helpers run beside each one. One check at a time, quick
checks only: `node lab/test_structure.js`, the pool gate on one pool (`node lab/make_testpool.js /tmp/<track>-pool` or
one `--culture/--biome` pool), `node lab/check_interiors.js` on a small sample, plus the track's own measure. The full
run is at integration. `node_modules` in `tools/blueprint-lab` is a link to a shared install; leave it. Scratch output
in `/tmp/<track>-*`.

End of task: update the track record in this folder (what was done with commits, measures before and after, checks
and results, open problems, next task), commit and push; then a report to the lead under 300 words: what a person
would now see differently, measures before and after, checks and results, the last pushed commit, changes in other
tracks' files, proposed Decisions rows, what is left.

## Open decisions from these tracks (Decisions tab, 2026-11-11)

D-133 how often a fire moves between stages (in use: A, `HEARTH_MOVE`); D-134 the stand pass removing other passes'
stands (in use: A); D-137 to D-142 hubs; D-144 to D-147 landscaping; D-148 a table 0.6 m from a bed when 0.9 m leaves
no spot (in use: A, `TABLE_BED_TIGHT`); D-149 lone chairs and bare rugs; D-150 deeper eaves; D-151 glass windows.
Answered and not built: D-128 tie beams (the size of a large enough house is open); D-130 village fires kept lit (mod
side). Proposed in ideas.md and not yet in the tab: s3 upper storeys or lofts (against D-069), tilted trim pieces.

## How to resume (to save usage)

- Tracks that edit the same files go in turn. Files by track: lights and kitchens `lib/decorate.js`, `lib/kitbash.js`;
  trim and banners `lib/details.js`, `lib/motifs.js`, `lab/mine_motifs.js`; storeys, roofscape and eaves
  `lib/styles.js`, `lib/generate.js`; windows and wide doors `lib/generate.js`, `lib/details.js`; yards
  `lib/yards.js`; stands `lib/stands.js`, `lib/persona.js`; hearths `lib/generate.js` hearth parts; landscaping a new
  `lib/landscape.js` after the yard.
- One full check run per merge: from tools/blueprint-lab, node lab/check_set.js 2, node lab/test_structure.js,
  node lab/test_sizes.js, node lab/check_interiors.js, node lab/make_testpool.js /tmp/p (plus --sample for the Black
  Forest and Plains pools), node lab/test_stands.js 3 --gate, node lab/essentials.js, node lab/test_variance.js,
  node lib/build_engine.js, node lib/build_web.js web/index.html, node lab/compare_page.js; from the root,
  VH_GEN_OUT=/tmp/g tools/gen-test/run.sh and dotnet build Villheim.sln -c Release (43 MSB3245 warnings come from
  assemblies missing on the cloud machine; main gives the same).
- Republish the lab page (artifact slug ebd4fcaa-85d1-452f-9d94-251d2687967c) from tools/blueprint-lab/web/index.html
  after merges.
- Judge results by looking: lab/households_sheet.js and lab/render_views.js render one house for six households and
  four views; Tyler judges the Interiors tab, so describe what changes visibly.

## Resume prompts

Paste one into a new Claude Code session on bazilisx/villheim (main), after it reads CLAUDE.md. Each helper gets the
rules above in its brief. Numbers are from ideas.md unless named.

**1. Lights and kitchens (ideas gaps 8 and 9).** "Resume from docs/handoffs/2026-11-10-design/ideas.md, gaps 8 and 9.
Lights: the pool has 0.7 lights per 10 m2 (s3 0.9) against 0.2 to 0.4 in every corpus group; candles in 36 to 77 % of
rooms against 0 to 7 %; wall torches in 77 to 86 % of rooms against 7 to 25 %; no Dvergr lanterns against 17 to 30 %.
Give each room kind a light budget from the corpus in lib/decorate.js and lib/kitbash.js. Kitchens: corpus kitchens
have a butcher table 54 %, oven 32 %, prep table 26 %, mortar 22 %, the generated ones none of these; add a cooking
corner in homes and taverns and the hearth piece in larger rooms (stone from s2, D-131). Measure before and after with
the ideas.md method, run the quick checks, write the record."

**2. Trim and banners (ideas gaps 4 and 5).** "Resume from ideas.md, gaps 4 and 5. Windows, corners, wall tops and
inside corners are dressed 92 to 100 % in the pool against 60 to 78 % in the corpus, with no tilted piece in 147,914;
banners in 6 % of buildings against 53 % of Norse buildings. A trim budget per building from household and culture
traits, a bare share per feature kind at the corpus rates, the front richer than the back (lib/details.js,
lib/motifs.js, lab/mine_motifs.js); banners by doors and gables from d2 and along hall and tavern walls. Tilted pieces
wait for Tyler's answer (proposed row in ideas.md)."

**3. Storeys, roofscape and eaves (ideas gaps 1, 2 and 7).** "Resume from ideas.md, gaps 1, 2 and 7. s3 buildings
have an upper storey 27 % of the time against 75 % of Norse corpus buildings (height 5.8 m against 9.3); 2 ridge lines
and 0.5 valleys per build against 4 and 2.2. First put the s3 upper storey row to Tyler (D-069 keeps s1 and s2 one
storey). Then wings at their own ridge heights, cross gables and lean-to outshots (lib/generate.js, lib/styles.js).
Deep eaves only after D-150 is answered."

**4. Windows and wide doors (ideas gaps 3 and 10).** "Resume from ideas.md, gaps 3 and 10. A window kit per building
by culture and household (single 1 m lights most often, 0.5 m slits, 2 m tall lights in halls and at s3), openings at
the corpus count per wall run (0.56 against 0.31), shutters, arches where D-012 allows stone, iron grates; glass after
D-151. A 4 m entrance on halls, taverns, barns and large s3 homes (42 % of corpus door motifs against 8 %); every door
stays usable (D-096). Files lib/generate.js and lib/details.js: run it before or after track 3, on its own."

**5. Yards (ideas gap 6).** "Resume from ideas.md, gap 6. Liked corpus builds have decks and rails 50 %, low walls 37
%, steps 55 %, fences 9 %, gates 3 %; the pool has rails 18 %, low walls 8 %, fences 30 %, gates 23 %. In lib/yards.js:
fewer closed fenced yards, decks and steps at the door, low log or half walls, a seat and a work corner by the door,
fence pieces drawn from the corpus kinds."

**6. Item stands, round 4.** "Resume from docs/handoffs/2026-11-10-design/item-stands.md (part 3) and README.md
'Integration, round 3'. Gate misses at d3 (test_stands.js 3 --gate): wall station 38.3 % (corpus 16.9), flat bench
8.9, wall wall 16.6, wall chest 2.9, stands q3 21. Count on the device how close corpus builders hang wall stands to
torches and casks, then set lib/stands.js wallBusy's 0.6 m margin from that count (corpus gap between wall stands 0.31,
0.49 and 0.97 m at the 10th, 25th and 50th percentiles; D-127). Then single floor stands against a wall at the corpus
rate (19 % of flat stands, 140 builds), and more places in taverns and longhouses for the top quartile. D-134 is open
(in use: A)."

**7. Hearths, open items.** "Resume from docs/handoffs/2026-11-10-design/hearths-lighting.md, 'Next steps'. Grausten
fronts are skipped in two-storey Ashlands homes (storey under 4 m); fronts skip where the rake's 45 degree beams cross
and on raised floors over 1 m; the moved-stack path needs a sample of 12 seeds or more, Meadows to Plains, to check the
stack share against the corpus 3 %; the floating woodpile on sunk stone flags needs the yard's ground in the audit
(lib/yards.js, lib/audit.js owners). Baltic Ashlands homes failing support and stability on ashwood beams go to the
walls and decks owner. D-133 is open (in use: A)."

**8. Hubs, generator.** "Resume from docs/handoffs/2026-11-10-design/hubs.md once D-137 to D-142 are answered (read
the Decisions tab). Add the hub type (lib/request.js refuses it now), the s1 camp generator (fire, shelters round it,
benches, notice board, chests), then the round line from hub1 on one plot sized for s5, then the other forms in the
table. Checks: shape family kept, the s1 camp inside the s2 wall line, the main fire's place by line, s5 the largest."

**9. Landscaping pass.** "Resume from docs/handoffs/2026-11-10-design/landscaping.md. Build lib/landscape.js after
the yard from data/landscape/placement-plan.json, a landscape mark on every greenery piece written as a
#VillheimLandscape list, then render and measure against the plan. D-144 to D-147 are open: keep the plan's
recommended values as settings and say which are in use. The gatherer and forager changes are mod side, for the mod
session."

**10. Not started.** Tie beams in halls, taverns and large houses (D-128, the size from the corpus); tightening the
piece models on Tyler's PC (ROADMAP design item 2b: rerun lab/extract_models.py with a finer proxy, split prisms into
boxes in lib/mesh.js); growth for the weak lines under D-132 (only the shape family stays; temples and Middle Eastern
homes still change family); assemblies and room layouts per culture from the corpus (research.md); the interior study
into assemblies and room templates; store rooms at d3 and window boxes.
