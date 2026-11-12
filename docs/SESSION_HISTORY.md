# Session history

Current facts only. Read this at the start of a session. Narrative is in `docs/daily-notes/`, goals in
`docs/ROADMAP.md`, how-to in `docs/DEVELOPMENT.md`.

## Current State (as of 2026-11-12)

- **Design work:** Tyler's review of the 16 showcase designs is the plan (`docs/handoffs/2026-11-12-showcase-review/`).
  The measure for designs is `docs/DESIGN_QUALITIES.md`. On main: piece catalog (`lib/catalog.js`), corpus room study
  (`docs/ROOM_STUDY.md`), outside and architecture studies, furniture assemblies and stand items (`lib/assemblies.js`,
  `lib/standitems.js`), wall-hung placement (`lib/wallhang.js`), building program (`lib/program.js`), shell rules and
  room intent furnishing (`lib/rooms_intent.js`). None of it tried in the game.
- **Council:** round 1 failed all four candidates (judge); its findings are in the showcase-review folder,
  `council/round-1/`. Open from it: plans undone by later passes, empty and unlit rooms, built furniture never placed,
  roofs judged per wing, open edges without rails (branch `wip/shell-open-edge-rails`, unfinished). Council rules:
  `docs/HELPER_RULES.md`.
- **Mod:** items on stands and sign text from designs (88e10c8, Tyler saw stand items in 1003-88e10c8); armor stand gear
  (73ebdb5) and the design ground line (fbe5967) not tried in the game; in-game generator limit 4 minutes; the memory
  look is on main behind LookMode, default Ghost, until Tyler tests it (D-160).
- **Session instructions:** tuned 2026-11-12 (CLAUDE.md, `docs/DESIGN_QUALITIES.md`, `docs/HELPER_RULES.md`); the
  configuration proposal in `docs/handoffs/2026-11-12-tuneup/` waits for Tyler.
- **Branches:** main, `wip/shell-open-edge-rails` (unfinished), `wip/tuneup` (merged, to delete).

## Systems in the mod (inventory from 2026-11-09; check the code before relying on a line)

Latest build fb15f86 (evening test fixes, see the 2026-11-09 note, Session 3): test pool only with TestPool on,
hearth kept clear (11 m then; since 2026-11-10 walls stay 14.5 m from the hearth, `HearthKeep`, D-084), rings widen per stage and overflow outward, zone collider no longer blocks plots, generated
designs keep their saved origin, repairs put back every piece, storehouse takes the storage chests, four starting
villagers, builder never hunts while settling, mining fixed for broken-up rocks. Next: let helpers build amenities,
walkable building pads, underwater rocks, smaller lag spikes, D-080.

- **Overnight work (2026-11-09 Session 4, merged to main 2026-11-10 as cluster A, not tried in the game past its
  first two commits):** handed over as a git bundle in `BepInEx/Villheim/handoff-2026-11-10/`. Plot
  search by real footprints with causes named, ruins and all but house-size boulders cleared, hold-ups on the hearth's
  hover, projects with no room set aside, search spread over frames, tool and job churn, `vh plot`, store room chests
  stacked and labeled, `lab/audit_pool.js`. Read HANDOFF.md there first. Open: which pieces blocked the plots.
- **Next session (handoff 2026-11-09, usage ran low):** merge feat/layout (WIP b9a500d, run the full checks
  first); feat/persona and feat/massing are merged. Each wrote a "Handoff (2026-11-09)" in its doc. Check the test pool
  before Tyler tests it: `node /tmp/det/lineage.js <lab dir>` style measure (decor stages must keep the shell, about
  80 % or more, for `HomeDecor`; on feat/massing at acff118 shells kept 82 to 100 % across decor, growth 50 to 99 %).
  Then the open "Next test build" items in `docs/ROADMAP.md` (items 3 and 8 to 11). Nothing from 2026-11-09 has been
  tried in the game yet; Tyler's results go in the Tests tab, T-601 to T-630 (round 6).
- **Kitbash libraries (2026-11-09, not tested in game):** interior assemblies mined from the corpus and placed in
  every room with 18 built kits (`data/kitbash-interior.json`, `lib/kitbash.js`); yards with fences, gates, paths,
  beds and lamps on s2 and s3 homes and farms (`lib/yards.js`, `data/yards.json`); exterior accents and a coverage
  audit (`lab/coverage.js`, `docs/COVERAGE.md`). New parts: roof overhangs, door lights, gate front doors, gable
  balconies, roof valleys. Marked clips (`p.clip`) pass the checks up to their mark.
- **Blueprint lab, building quality (2026-11-09 overnight, Session 13, not tested in game):** room templates, exterior
  details and motifs from the best-liked builds, game-measured piece models with the game's colliders in the checks,
  a design critic, the component bench (`lab/bench.js`), and new parts: stairs, dormers, chimney stacks, lean-tos,
  hearthstones, kitchens, bar counters, canopy beds, barn stalls. Parts table in `docs/BLUEPRINT_LAB.md`.
- **Design review (the current work):** how-to for Tyler in `docs/DESIGN_REVIEW_GUIDE.md`. Review sheet
  https://docs.google.com/spreadsheets/d/1rHaZArWhEa8V43UTZePM9EQSBwS6bvjsmAFPhnlQs6o/edit (tabs Pass 2, Review,
  All data, Variants, Mods; sheet script `scripts/review-sheet.gs`).
  - Pass 1 done: 264 of 963 designs kept (`src/Villheim.Logic/Village/Keepers.cs`, in gallery order).
  - New plan (2026-11-07): phases A type (Home, Work, Community, Drop), B subtype, C biome and material fixes in
    marked plots, slotting (base ID and structure stage), D decor stages, E review rows. Names `<baseID>_s#d#`
    (house1_s2d3), given at slotting; until then the design number. Details in the guide.
  - Phases A, B and B2 done 2026-11-07, game and sheet agree: Home 53, Work 125, Community 84, Drop 2; subtypes
    Longhouse 36, Defence 31, Hearth 21, Farming 20, Tavern 18, Workshop 16, Harbour 15, Mining 14, Decor 9,
    Storage 9, Woodworking 9, Cooking 5, Hunting 4, Arcane 2. Slotting under way with `vh slot` (Village/DesignBoard.cs): Meadows hearth first; drafts, decor rows, ground and path
    markers in saves; paths use markers. Open: board copies of a plot's ground (d3 to d2) still differ from the original; method and history in the 2026-11-07 note, Session 5 end state. `vh snow` sets or clears snow on the aimed design. Next: villages build the board's saves. Sort knives
    (`Village/DesignSort.cs`, `vh sort`): A = KnifeFlint (type), B = KnifeCopper (subtype); key picks, click sorts,
    sign and number colours, `BepInEx/Villheim/design-sort.csv`, live writes to the Pass 2 tab once the sheet's web
    app is deployed and `vh sort url` is set; `vh gallery keepers type <x>`. Sorted designs leave the field (undo brings them back) and are left off when a
    page is put up again (SortHideSorted). Knife A, the sheet link and page 1 tried by Tyler; hiding not yet tried.
  - Shaper Tool (`vh tool`, KnifeWood): 1 Move, 2 Turn, 3 Swap, 4 Delete, 5 Delete all, 6 Save, 7 Reset, 8 Undo;
    saves to `blueprints/inspiration/pass3/p3-<number>-<name>.blueprint` (`pass3-saved.csv`). Used from phase C on.
    The new layout, Reset, design turning and the one-click fix are not yet tried in game.
  - Design numbers come from `BepInEx/Villheim/design-list.csv` (`vh report`) and never change.
  - Licensing to settle before shipping blueprints: valheimians builds and copied MWL locations belong to their
    creators; ship only Tyler's own or with permission.
- **Decisions (2026-11-08):** questions and answers live in the review sheet's Decisions tab. Knowledge (true
  rumours, map table), cultures by biome, biome defenders and D-003 to D-040 are in main; none tested in game. Tyler
  starts a new test world for village testing.
- **Decisions D-059 to D-066 (2026-11-09):** roof overhangs back (eaves 1 m, rakes 0.5 to 1 m); yards on stage 2 and 3
  homes and farms inside the plot; game hit boxes stay on in the checks; no screenshots folder; community renders
  in `docs/renderer/corpus` with credit; stairs where they fit; interiors and accents may use any prefab that ships
  with Valheim (walls and roofs follow the biome's materials); minor decor is free or paid in the village biome's
  own materials. D-080 (2026-11-10) says decor is never free; home decor pays local stand-ins
  (`Village/DecorAnalogs.cs`), with the free cases listed in `docs/ROADMAP.md`.
- **Decisions D-067 to D-071 (2026-11-09):** working yards for work and community buildings; base crafting stations
  outside without a roof are avoided (Tyler, chat 2026-11-09: "Im hesitant about adding the base workbenches ...
  outside without roofs"; extensions as decor are fine), market area later and no village square; three
  drivers for the whole generator: messy realism, environmental storytelling, variance by culture, village, family
  and NPC, with no fixed-interval rules applied every time; a complexity ladder per stage (s1 and s2 one storey and
  simple, three storeys rare and late) and houses that grow from their own earlier stage; room layout learned from
  professional game interiors (BG3 first) plus the kitbash library; decor stages additive (d2 keeps d1, d3 keeps d2).
  D-072: household traits are broad (tidiness and use, decor taste, hobbies, comfort, wealth display, size), never
  professions. D-073: home life (assigned homes, house signs with name and role or family and members, residents
  decorate their own homes in stages in idle time, evenings at home or the hearth, bed by about 22:00, doors usually closed).
  The code lets villagers take free beds (`Villagers/Sleep.cs`, `Villagers/Households.cs`); D-077 sets beds and
  houses by arrival order and is not built.
- **Feature checklist (2026-11-08):** every built, planned and proposed feature plus ideas from other mods, 730 rows,
  in the review sheet's Features tab (Yes, No or Later). Source files in `docs/features/`. ValheimCityBuilder is CC0
  per its authors; study in `docs/CITYBUILDER_STUDY.md`.
- **Culture styles (2026-11-08, branch night3/styles):** `docs/CULTURE_STYLES.md`; the lab generates the 14 approved
  cultures with their own forms, weighted by biome; 147 samples pass every check; overviews in `docs/cultures/`.
- **Millénaire translation (2026-11-08):** `docs/MC_TRANSLATION.md`. Converted designs and their learned rules stay
  outside the repo; the lab's data is unchanged. Usable for plans, roofs and room uses in five of seven cultures;
  materials, hips and domes do not carry over. Whether mc rules may feed the lab is Tyler's call.
- **Blueprint lab (2026-11-08 night, not tested in game):** `tools/blueprint-lab`, `docs/BLUEPRINT_LAB.md`. Learns from
  2,134 designs (valheimians downloads and their `.vbuild` files included since 2026-11-08 day); generates by type,
  biome, style, plan, roof, walls, s1 to s3 and d1 to d3; strips or furnishes any blueprint; repairs missing pieces of
  an uploaded blueprint; checks and draws designs without the game. Page "Villheim Blueprint Lab"
  (https://claude.ai/artifact/W83rbAvBBLXWeXdLmap3Gf; offline copy in `BepInEx/config/Villheim-tools`). 273 generated
  designs in `Downloads\Villheim-generated` and the sheet's Generated tab (click "Allow access" for pictures).
  Villages build generated designs that Tyler marked Yes and copied to `blueprints/approved-generated` (CLAUDE.md;
  `Designs/Blueprints.cs` reads that folder), and with `TestPool` on, the test pool.
- **Villager minds and world growth (2026-11-08 night, compiles, not tested in game):** memory, gossip, skills, wants,
  gatherings, noticing, 1,211 new lines; outpost gear gate and materials, caravans, daughter villages, events,
  contracts, groves, signposts. Tables in `docs/WORLD_LIFE.md`. Four new Harmony patches: if logic fails to load, read
  the BepInEx log first. Reviewed and hardened 2026-11-08 day: each patch class loads alone, ten kill switches
  (`vh switches`), a 20 minute test plan in `docs/WORLD_LIFE.md`. Research: `docs/LIVING_WORLD_RESEARCH.md` (43 proposals).
- **World life (2026-11-07 overnight session, logic only, not tested in game):** pedlars, pilgrims, hermits, news
  between villages, villager personalities, relations between villages, villagers watching others work, outposts
  (logging camps), trails to the outpost and the nearest neighbour. `WorldLife` (config "5 - World life") is off by
  default so the design review is not disturbed; `vh pedlar`, `vh pilgrim`, `vh hermit`, `vh wanderers`, `vh outpost`,
  `vh trails` work for testing. Design and plan: `docs/WORLD_LIFE.md`; survey: `docs/RELATED_MODS.md` section 5.
- **Smith (2026-11-07 overnight, on by default, `SmithMakesGear`):** gear only rises a tier once the village has made
  that tier's set at the recipe's station from the chest (or bought it from a pedlar). Existing villages keep their tier.
- **Outpost materials (D-024):** what an outpost sends home counts toward what the village can build
  (`OutpostMaterials` on, `Village/Materials.cs`).
- **Profile mods now also:** More Vanilla Build Prefabs and Infinity Hammer (2026-11-07, for placing hidden objects while
  making variants), PlanBuild (blueprint folder `BepInEx/config/PlanBuild/blueprints`, community builds in
  its `inspiration` subfolder), BiomeBlueprints (fails to load its commands on this game version; its files are read
  directly), Server Devcommands, ComfyGizmo, More World Locations AIO.

- **Branch:** `main` (the cloud session branch is kept equal to it). All commits authored by Baz.
- **On main, not tested in game:** both 2026-11-06 overnight sessions (builder at the piece, levelled sites, beds and
  sleep, furnished buildings, Millénaire placement, cooking, roles and trades, dialogue library, walked A* paths,
  blueprints, growth tiers and upgrades, longhouse around the hearth, hunting, repairs, shelter, seats, trading,
  furniture by tier, morning hearth, moods, social layer, fence ring, reactions to the player, chronicle, night watch,
  foraging, signs, village types, Jarl, children, echo look, farms and animals, map pins, flat pads). Raids are built but off
  (`RaidsEnabled`); trading with villagers is off (`VillagerTrading`). Logic only, hot-reloads; core DLL unchanged. Rollback
  branches `stage/2026-11-06-a` to `-l`.
- **Network:** the cloud environment allows Thunderstore, Nexus, the Valheim wiki, CurseForge, Modrinth, the
  MineColonies wiki and millenaire.org. Nexus still answers 403 from the cloud.
- **Blacklisted source (D-022, recorded 2026-11-08; Tyler's own words not found in chat, D-112):** the OverDrive BiomeBlueprints pack. Never used as a design source, a
  study source or a reference (D-022). The 12 builds by other creators that shipped in that pack stay in `Keepers.cs`
  (`bp:hs_...`) by D-011 ("Keep"); D-011 and D-022 conflict (Open: D-108).
- **Generated designs (Tyler, 2026-11-08; D-013, D-023):** villages may use generated designs that Tyler marked Yes in
  the Generated tab and that were copied to `blueprints/approved-generated`; they must pass every check in
  `lib/checks.js` (CLAUDE.md). `Designs/Blueprints.cs` reads that folder.
- **Decided (Tyler, 2026-11-08):** outpost wood counts toward what a village can build, and villagers only go out to
  another biome once they are equipped and able to defend themselves. Built 2026-11-08 night, not tested.
- **Access as of 2026-11-08 night:** the desktop app's folder bridge reaches the Valheim, r2modman and Downloads
  folders on TKERR-NZXT-BLD; valheimians.com works through Tyler's Chrome (downloads need no account, the site
  rate-limits bursts) and stays blocked from the cloud.
  Branch `corpus` exists (README only, never merged).
- **Blueprints:** `BepInEx/config/Villheim/blueprints` (and PlanBuild's folder), named `role-family-level`.
- **Dialogue:** `src/Villheim.Logic/Dialogue/*.txt`; the format is at the top of `lines.txt`.
- **Also untested from 2026-11-05:** sessions 4, 5 and 7 (doors, support order, free time, chest by the hearth,
  healing). Healing was replaced by the cooking rework.
- **Updater:** `scripts/Villheim-Updater.ps1` keeps the profile on main. The hearth's hover text shows the commit.
- **Cloud builds:** `scripts/build-cloud.sh` (nuget.bepinex.dev is blocked from cloud containers).
- **Profile mods:** BepInEx, Jötunn 2.30.2, More World Locations, PlanBuild (Villheim reads its blueprint folders,
  `Designs/Blueprints.cs`).
- **Known issue to check:** the biome rule drops Meadows MWL designs that use core wood (likely including the
  Meadows hub `MWL_MeadowsTavern1`). The design report's materials column will show which designs remain. Since D-007
  such a design can go up once the village's chests hold the core wood (`BroughtMaterials`,
  `Designs/DesignLibrary.cs`); not checked in the game.
- **Study material:** Millénaire findings (buildings, levels, tiers, placement, paths) are in `docs/MILLENAIRE.md`; decompile steps in `docs/DEVELOPMENT.md`.

## Outstanding work

- Council round 1 changes (see Current State), then council rounds to at most 10 approved s3d3 buildings.
- In-game test of everything since 2026-11-10 (Tests tab).
- In-game generator time on large designs (gen-test longhouse about 95 to 160 s of the 4-minute limit).
- Open Decisions rows (read the tab).

## Recent milestones

- **2026-11-12 (session instructions tune-up, audited)** - see docs/daily-notes/2026-11/2026-11-12.md
- **2026-11-12 (showcase review: eight design tracks, stand and armor stand fixes, council)** - see docs/daily-notes/2026-11/2026-11-12.md
- **2026-11-11 (design rounds 4 to 7c merged, hub and landscaping, build labels, test channels)** - see docs/daily-notes/2026-11/2026-11-11.md
- **2026-11-11 (design tracks merged: library first, essentials, hearths, stands, lab page)** - see docs/daily-notes/2026-11/2026-11-11.md
- **2026-11-10 (design pause: four helper tracks, handoff)** - see docs/daily-notes/2026-11/2026-11-10.md
- **2026-11-10 (design helper: library first, richness gate)** - see docs/daily-notes/2026-11/2026-11-10.md
- **2026-11-10 (design helper: creative interior sets)** - see docs/daily-notes/2026-11/2026-11-10.md
- **2026-11-10 (records audit: Decisions, Features, roadmap, comments, CLAUDE.md)** - see docs/daily-notes/2026-11/2026-11-10.md
- **2026-11-10 (design: layout planner, pool gate, piece sizes, decor reach)** - see docs/daily-notes/2026-11/2026-11-10.md
- **2026-11-10 (elders, healers, fish by biome; roster reverted)** - see docs/daily-notes/2026-11/2026-11-10.md
- **2026-11-10 (status line, snapshot, D-080 to D-094, guards, hunting trips)** - see docs/daily-notes/2026-11/2026-11-10.md
- **2026-11-10 (overnight merge, lag cluster, immediate fixes)** - see docs/daily-notes/2026-11/2026-11-10.md
- **2026-11-09 (plot search audit and overnight fixes, handed over as a bundle)** - see docs/daily-notes/2026-11/2026-11-09.md

Older milestones: the daily notes in `docs/daily-notes/`.
