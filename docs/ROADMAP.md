# Roadmap

Goals and milestones for Villheim, set by Tyler. `[x]` means built, with the file or commit named (CLAUDE.md,
"Records and evidence"). Each built item says whether it was tried in the game: "Pass in T-###" names a Tests row
Tyler marked Pass; "not tried in the game" or "no Pass in the Tests tab yet" otherwise. An item that conflicts with a
decision or a project rule is removed, with the decision named.

## The vision

Villages like Millénaire's in Minecraft, made only from things already in Valheim and its mods. Millénaire's design
and logic are the main reference for how villages grow, place buildings, assign roles and run their days
(docs/LEARNINGS.md). You come across a
couple of villagers at a hearth. Over the in-game days they gather, build, move into houses and grow into a town
with its own look for its biome.

Villages are echoes of the old world, memories of the real villages the heroes came from, set in Valheim's
afterlife. They are places of rest that the player finds, watches grow and helps along, and they add life to the
generated world. Things still happen to a village: local, biome-appropriate creatures wander in and the villagers
fend them off, or fail to. There are no raiders, feuds or wars between villages, no outlaws and no thieves. A village
that empties is settled again after a while. Features that make the player do chores or manage menus are out as
well (Tyler, 2026-11-08). The Features tab of the review sheet (`docs/features/box.csv`) holds his Yes, No and Later.

## Ground rules

- Existing designs and assets only (vanilla locations, More World Locations, PlanBuild blueprints and prefabs).
- Independent of other village mods. Ideas are fine, code is not (`docs/LEARNINGS.md`).
- A village only uses materials found in its biome.

## Milestone 1: a village that founds and grows (done)

- [x] Hearth, founding, names, village state stored on the hearth.
- [x] Buildings copied from location prefabs, placed on a grid aligned to the village axis.
- [x] Terrain leveled and cleared like the original location.
- [x] Villagers from the player model with vanilla looks, chatter, night gathering at the hearth.
- [x] Hot-reload test loop with the r2modman profile.

## Milestone 2: work and materials (in progress)

- [x] Woodcutters, miners and a builder; nothing drops on death. Gear goes up a tier once the village's smith has
  made that tier's set (`SmithMakesGear`, `Villagers/Smithing.cs`).
- [x] Material stock (wood, fine wood, core wood, stone) priced from vanilla recipes.
- [x] Staged construction: structure, roof, doors and windows, interior.
- [x] Gathering order: dropped material, then half-harvested work (felled logs, cracked rocks), then fresh trees and
  rocks; loose sticks and stones only when there is nothing bigger to work, and only close by (CLAUDE.md;
  `Villagers/Chores.cs`). Pass in T-39 and T-408.
- [x] Village chest by the hearth, kept for good. Villagers and players fill it, the builder builds from it when it
  has enough, and a destroyed chest is rebuilt before anything else (`Village/VillageChest.cs`, `SiteChest`). Pass in
  T-38 (hover).
- [x] One prioritized builder per village who builds whenever the chest covers the next piece and gathers otherwise
  (`Villagers/Chores.cs`). No Pass in the Tests tab yet.
- [x] Biome materials: no core wood in the Meadows, and so on (`Village/Materials.cs`, `BiomeMaterials`). No Pass in
  the Tests tab yet.
- [x] Movement without jitter: stand spots, steady goals, unstuck re-path and sidestep (`Villagers/Walker.cs`). No
  Pass in the Tests tab yet; jitter work goes on (below).
- [x] Build order (Tyler, 2026-11-06): homes with beds until every villager has one, then the longhouse, then the hub
  area (sign, notice board, benches) and, while waiting, a workshop (basic workbench house) and a storehouse (extra
  chests); then more homes, farms and workshops as trades appear (`Village/Growth.cs`). No Pass in the Tests tab yet.
- [x] Notice board from the `villagenotice` blueprint over the village chest (`Village/NoticeBoard.cs`). T-406 Pass
  with notes; earlier board tests failed (T-14, T-37, T-105, T-123).
- [ ] Food and dishes in interiors: food on horizontal item stands (all food but honey can go on one, per the wiki)
  and the serving tray (Feaster) on tables, for village-built buildings (Tyler, 2026-11-08). Built so far: an item
  stand in a design gets the item the design saved and is locked (`Designs/StandItems.cs`); food the village picks
  itself is not built.
- [ ] Clickable notice board signs with a menu, like Haldor's or Millénaire's: accept a contract, see the list of
  buildings to come, move or prioritize them, or ask for a different building. Approved by Tyler 2026-11-10; not
  built.
- [x] The back of the notice board carries the contract, season, next feast and prosperity (D-009,
  `Village/NoticeBoard.cs`). Not tried in the game.
- [x] Storage chests by the main chest as the village grows, each labeled with a vanilla sign and kept sorted by a
  villager; the builder takes from any (D-016; `Village/StorageChests.cs`, `Villagers/Sorting.cs`). The code adds
  them by buildings standing (1, 2, 4 with the first three buildings, `StorageChestSteps`), then by people and need.
  T-307 Pass with no note.
- [x] Anything brought into the village counts toward what it can build (D-007, `BroughtMaterials`,
  `Village/Materials.cs`). Not tried in the game.
- [x] Village-built pieces take no rain or water damage (D-038, `Village/WaterProof.cs`, `WaterProofPieces`). Not
  tried in the game.
- [x] Roads and facing after Millénaire: doors toward the hearth, parent-rule paths, buildings along roads, wider
  trunks, queued paths join, daily door check (`Village/PathPlanner.cs`, `Village/PlotFinder.cs`). No Pass in the
  Tests tab yet.
- [x] Design review pass 1: `vh report` lists every design with one stage each into the review sheet; Tyler kept
  264 of 963 (2026-11-07).
- [x] Shaper Tool: hotbar tools picked by key and used by click, mouse wheel turning, reset, undo, look, effects;
  Tyler's F1 values as defaults. Guide: `docs/DESIGN_REVIEW_GUIDE.md`.
- [x] Sort knives for phases A and B (2026-11-07): type and subtype set in the game by click, sign colors,
  `design-sort.csv`, live writes to the Pass 2 tab through the sheet's web app, `vh gallery keepers type X`.
- [x] Phase A: every kept design sorted Home, Work, Community or Drop (Tyler, in game, 2026-11-07): Work 126,
  Community 84, Home 53, Drop 1.
- [x] Phase B (done 2026-11-07): subtypes for Work (Farming, Woodworking, Mining, Cooking, Crafting, Storage, Defence) and Community
  (Hearth, Tavern, Longhouse, Decor: village decor built in idle time, such as water wheels, outhouses, gardens).
- [x] Phase B2 (done 2026-11-07): Crafting split into Harbour, Masonry, Weaving, Hunting, Arcane, Workshop (sort knife B2, chitin).
- [x] Slotting board `vh slot <biome> <kind>` (2026-11-07): one row of stage plots (5, up to 10) in green beams for
  one base ID; the kind's designs written to PlanBuild's "Villheim board" tab with pictures; plots saved with the
  Shaper Tool as `<baseID>_s<n>d3`, source design found by piece comparison, Slots tab in the sheet. Phase C (biome)
  is folded in: the board's biome is the design's biome.
- [ ] Slotting done for Meadows, then the Black Forest: hearth first, then houses, then the work buildings.
- [ ] Board ground copies (d3 to d2) match the original exactly, all but the grass. Open as of 2026-11-07: pieces
  match, the dirt outline differs. Methods tried are listed in the 2026-11-07 note, Session 5 end state.
- [ ] Slotting board only: grow a board plot (and slide its neighbors) when a design needs more room; for now
  'size N' sets every plot of a board (`Village/DesignBoard.cs`). In villages the first plot already keeps the
  ground of the building's last stage (D-083, `ReserveGrowthRoom`, `Village/Footprints.cs`; Tyler
  2026-11-10: "the very first plot is large enough to accommodate the final size").
- [x] Path markers on the board (2026-11-07): one meaning, "connect roads and paths here"; saved as "#VillheimPaths"
  (path;x;y;z;yaw, yaw = outward from the design's middle through the marker), read into Blueprint.Markers.
- [x] Paths use the markers (2026-11-07): a building's road starts a meter out from its marker nearest the hub (or the
  hearth), the hub's road ends at its nearest marker, the parent rule uses markers too; designs without markers keep
  the Doors guess.
- [ ] Villages build the board's saves (`<baseID>_s<n>d<n>` from blueprints/inspiration/board): pick a base ID per
  kind and biome, build s1 at d1, raise d# over time and s# with the hearth's stage. Until then the markers only
  matter for blueprints that carry them.
- [x] Roads follow the buildings (2026-11-07): a rebuilt building's old road is taken up (to where another building's
  road joins it) and a new one is laid from its markers.
- [ ] A rebuilt hub: roads of the other buildings move to the new hub's markers.
- [ ] Villages build a save's terrain section (paths, paving, leveled spots) along with its pieces. Board saves keep pieces, ground and markers relative to the plot's middle: read them with `Blueprints.FromFile(file, asSaved: true)` so the pieces are not re-centered off their ground.
- [ ] PNG pictures for saved stage files too (copy them to PlanBuild as a "Villheim saved" tab).
- [x] Decor stages on the slotting board (2026-11-07): saving d3 brings up a d2 copy behind it, d2 a d1 copy.
- [ ] Phase D: decor stages from the richest down. Save d3, it is copied to the d2 plot; strip and save d2, copied to
  d1; strip to the bare minimum and save. Files named `<baseID>_s<n>d<n>` (e.g. `house1_s2d3`). Optional: a key that
  removes every non-structural piece as a start for d1.
- [ ] Phase E: one base ID in one biome in a row, s1d1 to s3d3, to review how it grows.
- [ ] Bake common hand swaps into the stand-in suggestions once a pattern shows (same original, same choice).
- [ ] Teach the blueprint reader the `<baseID>_s<n>d<n>` naming and the sheet's type, subtype and biome; the hearth's
  stage unlocks the next s#, villagers raise d# between stages (see `docs/MILLENAIRE.md`).
- [x] Villagers decorate between upgrades, homes only: in idle time residents add the pieces the next decor stage
  has, one at a time, so a home moves from d1 to d2 to d3 (D-073, `Villagers/HomeDecor.cs`, `HomeDecor`). Not tried
  in the game.
- [ ] The same for work and community buildings: not built. A new s# is a real rebuild of the building.
- [ ] Ship Tyler's finished blueprints inside the mod (Villheim reads .blueprint files itself, so PlanBuild is only
  needed to make them, never to play).
- Removed: "Storehouse grows into the longhouse". Tyler, 2026-11-10: two separate buildings, one for storage (work)
  and one a social hub.
- [x] Replant one sapling per tree felled, 8 to 25 m outside the village radius (`Villagers/Replanting.cs`). No Pass
  in the Tests tab yet.
- [ ] Jitter: record traces with `vh trace` and fix from the data. Session 12 fixed two causes (NpcTalk turning to the
  player, seat sawtooth); trace again to confirm.
- [x] Building ground flat at floor height like the hearth (`Village/ConstructionSite.cs` PrepareGround). No Pass in
  the Tests tab yet.
- [ ] Drop designs that trap villagers.
- [x] Trees felled away from the village: a tree is cut from the village side (`Villagers/Chores.cs`). No Pass in
  the Tests tab yet.
- [x] Right tool for each job: hammer to build, axe for trees, pickaxe for rocks (`Villagers/Chores.cs`,
  `Villagers/VillagerLooks.cs`). No Pass in the Tests tab yet.
- [x] Villagers open and close doors (`Villagers/Walker.cs`). No Pass in the Tests tab yet.
- [x] Support-aware build order: nothing goes up unsupported; openings before what rests on them
  (`Village/ConstructionSite.cs`). No Pass in the Tests tab yet.
- [x] Never copy wild bee hives from designs; they poison villagers and players nearby. Crafted bee hives
  (`piece_beehive`, made from a queen bee) are a normal piece and are copied (Tyler, 2026-11-08; D-027;
  `Designs/DesignSpawner.cs`). Not tried in the game since the 2026-11-08 change.
- [x] Villagers gather from nothing for their first building (`StartingStock` 0). No Pass in the Tests tab yet.
- [x] No swings from a distance: reach checked against the real surface before every blow (`Villagers/Chores.cs`).
  No Pass in the Tests tab yet.
- [x] Smooth walking: own brain outside fights, player speeds, no shoving (`Villagers/Brain.cs`,
  `Villagers/Walker.cs`, `Villagers/Body.cs`). No Pass in the Tests tab yet.

## Milestone 3: a village that looks planned

- [ ] Central hub first (tavern or longhouse), then houses, workshops (carpentry, forge) and farms. The code follows
      Tyler's build order of 2026-11-06 instead (homes with beds first, then the longhouse; `Village/Growth.cs`).
- [x] Paths from a grid search that join into streets (replacing the L-shaped paths): A* with slope, turn and reuse
      costs, joining the laid network (`Village/PathPlanner.cs`). No Pass in the Tests tab yet.
- [x] Earth floor painted under buildings (`Village/ConstructionSite.cs`). No Pass in the Tests tab yet.
- [x] Millénaire-like alignment: buildings face the hearth, or a road when that brings the door at least 3 m nearer
      one (`Village/PlotFinder.cs`). No Pass in the Tests tab yet.
- [x] Buildings stay close: distance bands per role (homes from 0.1, workshops from 0.3, farms from 0.4 of the radius,
      D-085), ring order, workshops near trees and rocks (`Village/PlotFinder.cs`). The rings widen with each stage
      (`RadiusPerStage`), and a building with no room in its ring tries the next ring outward, out to twice the
      village radius (D-079 answer, Tyler 2026-11-09: villages are not constrained by size and grow outward). Not
      tried in the game since 2026-11-10.
- [x] Buildings never overlap other buildings or paths: real footprints with a 2.5 m gap (D-082, `BuildingGap`), kept
      off each building's last-stage ground (D-083), walls 4.5 m past the hearth's dirt circle (D-084)
      (`Village/PlotFinder.cs`, `Village/Footprints.cs`). Not tried in the game since 2026-11-10.
- [x] Ground first: every site is flattened before the first piece goes up (Tyler, 2026-11-05): whole outline at
      break ground, and under each ground piece (`Village/ConstructionSite.cs`). No Pass in the Tests tab yet.
- [x] Paths are laid by a villager walking the route, one stretch at a time (Tyler, 2026-11-05;
      `Villagers/PathLaying.cs`). No Pass in the Tests tab yet.
- [x] Repairs: villagers fix broken pieces, structural first (flatten under ground pieces), cosmetic later (Tyler,
      2026-11-05; `Villagers/Repairs.cs`). No Pass in the Tests tab yet.
- [x] Fencing that keeps enemies out and grows with the village (Tyler, 2026-11-06): a ring around the buildings with
      gates where paths cross it, a light wood fence for a hamlet (`HamletFence`), then a stake wall; when buildings go
      up outside the ring, the old ring comes down (all its materials back, D-088) and a wider one goes up. Built by
      the builder from the chest, repaired like buildings (`Village/Palisade.cs`). No Pass in the Tests tab yet.
- [ ] Stone fence ring at later stages: not built.
- [x] Stone building waits until the village advances in the Meadows and Black Forest: wood at early stages, stone
      from stage 3, the hall from stage 2 (D-012; `WoodFirstBiomes`, `StoneFromStage`, `StoneHallFromStage`,
      `Village/Materials.cs`). Not tried in the game.
- [x] Boardwalks on poles over wet ground in fen-folk and crannog villages (D-038, `Village/Boardwalks.cs`,
      `BoardwalkCultures`). Not tried in the game.

## Milestone 4: villagers with lives

- [ ] Homes and beds by D-077 (answered 2026-11-09, clarified 2026-11-10): beds and houses are set by arrival order,
      never claimed as villagers arrive. The roster is rolled ahead of time, with family sizes and who arrives later,
      and decides which houses are built first and how big. Families have at most four people in any mix. Four
      villagers arrive at the start (`StartingVillagers` 4); no fixed rule such as the first two always being single.
      Children do not count toward the population cap but show on the population sign, which lists each kind (adults,
      elders, children). Beds never change hands; a dead villager's bed is kept. Not built; first try reverted
      2026-11-10 (6014028). The current code differs: villagers take a free bed (`Villagers/Sleep.cs`, `Beds`), a
      household is whoever's beds stand in the same house (`Villagers/Households.cs`), a dead villager's bed is freed,
      and children count toward the cap (`Village/VillageBrain.cs`). Open: D-099.
- [x] Newcomers only arrive for a free bed, by day, walking in from the edge; capacity is one per bed
      (`Village/VillageBrain.cs`). No Pass in the Tests tab yet. D-077 will change how beds and houses are given out.
- [x] Free time: fire, sitting, strolls, chats, keeping busy at stations; gestures only with a reason
      (`Villagers/FreeTime.cs`, `Villagers/TaskGestures.cs`; idle gestures by mood removed, Tyler 2026-11-08). No Pass
      in the Tests tab yet (T-504 failed).
- [x] Evening ring at the hearth, sitting and resting by the fire at night (`Villagers/FreeTime.cs`). No Pass in the
      Tests tab yet.
- [x] Sit on the village's chairs and benches (`Villagers/Seats.cs`). No Pass in the Tests tab yet.
- [x] Sleep in beds, bedtime 22:00 to 23:00 and up at 05:00 to 06:00, random per villager (Tyler, 2026-11-06;
      `Villagers/Sleep.cs`). The current code lets villagers take free beds; D-077 sets beds by arrival order (not
      built, see above). T-607 to T-609 Pass with no notes.
- [x] Villagers with nothing else to do make a fire pit, cooking station, workbench and benches by the hearth, piece
      by piece (`Village/Amenities.cs`). No Pass in the Tests tab yet.
- [x] Villagers cook for real at the hearth's cooking station: put food on, wait its cooking time, take it off, eat
      and heal by the food's regen over its duration; cooked food in the chest is eaten when needed, raw food is
      cooked and eaten or stored (Tyler, 2026-11-06; `Villagers/Healing.cs`). T-311 Pass with notes.
- [ ] Enough in the chest means no harvesting: villagers switch to two roles, builder and crafter/interior designer
      (Tyler, 2026-11-05). Built so far: nobody harvests when the village needs nothing (`Villagers/Chores.cs`); the
      crafter/interior designer role is not built.
- [x] Crafted pieces follow the game's rules: workbenches and other crafting stations go under a roof (inside a
      village building) so they are usable (Tyler, 2026-11-05): workshops get a workbench at a spot that passes the
      game's cover test (`Village/Interior.cs`). No Pass in the Tests tab yet.
- [ ] Profession buildings with their workbenches near key resources (Tyler, 2026-11-06). (Workshops placed near
      trees and rocks 2026-11-06; more profession buildings to come.)
- [ ] Central building built around the hearth and cooking station, growing with it (Tyler, 2026-11-06). Built
      2026-11-06 for longhouse designs with a fire pit; since 2026-11-09 the hearth is never built over and no hall
      goes up around it (Tyler; `Village/VillageBrain.cs`). D-067: the hearth is the hub, an evolving structure around
      the hearth fire (see the hearth upgrade item below).
- [x] Millénaire growth: tiers, weighted picks, one pending project (`Village/Growth.cs`). No Pass in the Tests tab
      yet.
- [x] Hunting for the cooking station's meat (`Villagers/Hunting.cs`). No Pass in the Tests tab yet.
- [x] Carers shelter indoors in a fight; no bed means sleeping under a roof (`Villagers/Combat.cs`,
      `Villagers/Sleep.cs`). No Pass in the Tests tab yet.
- [x] Hurt villagers put healing first: cook food at the hearth and eat it; with no cooking station, make one first
      (Tyler, 2026-11-05; `Villagers/Healing.cs`). No Pass in the Tests tab yet.
- [ ] Villagers never walk or run through a fire: the hearth, fire pits and campfires are kept out of every walk,
      including straight steps (door passes, last meters to a tree) (Tyler, 2026-11-05). Built so far: only the game's
      own fire avoidance (`m_avoidFire`, `Villagers/VillagerTuning.cs`).
- [x] Every building site is flattened where needed before and while building, beyond the design's own terrain
      shaping and the simple pad (Tyler, 2026-11-05): eased slopes between pads and walkable banks
      (`Village/ConstructionSite.cs`, `Village/GroundBlend.cs`). Not tried in the game since 2026-11-10.
- [ ] The hearth upgrades over time as the village grows (Tyler, 2026-11-05): campfire, then a hearth with the
      cooking station over it, then larger vanilla fire pieces; the cooking station is part of the hearth, not a
      separate fire. (Cooking station moved onto the hearth 2026-11-05 session 7; upgrades not started.)
- [x] One task at a time: pieces only appear while the builder stands next to them; a fight pauses the build or path,
      which resumes afterwards (Tyler, 2026-11-05; `Villagers/Chores.cs`, `Villagers/Brain.cs`). No Pass in the Tests tab yet.
- [x] The builder stands right by the piece and taps it with the hammer's own animation; no punching, no jitter at
      the workbench (Tyler, 2026-11-06; `Villagers/Chores.cs`). No Pass in the Tests tab yet.
- [x] Protector and carer roles: never by gender; arrivals alternate protector, carer, protector. Roles do not limit
      jobs; they show in idle time and emergencies. When attacked, protectors take basic weapons and defend (Tyler,
      2026-11-05; D-034; `Villagers/Roles.cs`, `Villagers/Combat.cs`). T-48 Pass with notes.
- [x] Trades by village size (D-075): two or three villagers are generalists; from four, a carpenter and a smith and
      the rest generalists; from six, every villager a trade from carpenter, smith, cook, farmer, guard, hunter,
      healer, fisher. Elders take only light trades (cook, healer) (`Villagers/Roles.cs`). Not tried in the game.
- [x] Villager moods with reasons (needs and fading thoughts, scaled by personality) and a village mood from its
      people (Tyler, 2026-11-06; `Villagers/Moods.cs`, `Village/VillageMood.cs`). No Pass in the Tests tab yet.
- [x] Talk is periodic, never a constant stream; events get a reaction from two or three villagers, never the same line
      (Tyler, 2026-11-06; `Villagers/Dialogue.cs`, `Villagers/Social.cs`). No Pass in the Tests tab yet.
- [x] Villagers notice and greet new players, remember them, listen and react to each other, spread news and ask for
      help (Tyler, 2026-11-06, a "Turing test lite"; `Villagers/PlayerMemory.cs`, `Villagers/Social.cs`,
      `Villagers/Complaints.cs`). No Pass in the Tests tab yet.
- [ ] Dialogue about what villagers are doing, want and need, with conditions; grow into a large library of lines
      (Tyler, 2026-11-05). (Library of about 670 lines in eight voices with chats built 2026-11-06; about 3,000 lines
      after 2026-11-08 night; keep growing it.) Rewrite needed: T-20 failed (lines read as AI-written); new
      lines wait until a sample passes. Rules in `docs/DIALOGUE_STYLE.md`.
- [x] Villager minds (`docs/WORLD_LIFE.md`): memory of each player and gossip about them, place, weather and player
      tags, per-player topic fatigue, skills, wants and sweethearts, gatherings and feasts, noticing, idle glances,
      chats of three. Feasts after big buildings (D-005); mood never changes work speed (D-014). Not tried in the game.
- [x] Interiors upgrade over time (bed, chests, table, then better furniture) by village tier (`Village/Interior.cs`).
      No Pass in the Tests tab yet.
- [x] Exteriors upgrade over time (swap a building for a better design of the same role): next blueprint level or a
      bigger design, old building taken down first with all its materials back (D-088, `Village/ConstructionSite.cs`).
      No Pass in the Tests tab yet.

## Milestone 5: cultures by biome

- [x] Different building sets and villager looks per biome: cultures by biome with their own names, looks and design
      sets (`Village/Cultures.cs`, `Cultures/cultures.txt`, `CultureMap`, `CultureDesigns`). T-13, T-24 and T-128
      Pass.
- [x] PlanBuild blueprints as a design source (`Designs/Blueprints.cs` reads PlanBuild's blueprint folders). No Pass
      in the Tests tab yet.
- [ ] Curated blueprint sets for Meadows and Black Forest with upgrade levels (Tyler, 2026-11-06). The OverDrive
      BiomeBlueprints pack is blacklisted (D-022). `Village/Keepers.cs` still holds 12 `bp:hs_` builds that came with
      that pack (D-011: keep); the two answers conflict (Open: D-108). Capture with `vh savebp` or PlanBuild, or use
      downloads with the author's permission.
- [x] Generated designs learned from Tyler's approved set and other creators' builds, with quality controls; renders
      of any blueprint from several angles; a request-to-blueprint tool (Tyler, 2026-11-08): `tools/blueprint-lab`,
      `docs/BLUEPRINT_LAB.md`, the "Villheim Blueprint Lab" page. `vh gen` places them in the game (T-33, T-34, T-103
      Pass). Villages build generated designs that Tyler marked Yes and copied to `blueprints/approved-generated`
      (CLAUDE.md; `Designs/Blueprints.cs`), and with `TestPool` on, the test pool.
- [ ] Review the Generated tab; Yes and No feed the scorer (`lab/train_scorer.py`).
- [ ] Decorator takes over Phase D: strip any design to d1 and furnish to d2 and d3 (`lib/decorate.js`, built
      2026-11-08 night; try it on the board's d3 saves).
- [x] Exact piece shapes for the lab's pictures and checks: the game's colliders read from the game files on Tyler's
      PC (models v2, 2026-11-09; `data/piece-solids.json`, `lib/shapes.js`; checks use them by default).
- [x] Building details and motifs from the best-liked builds, component bench, design critic, new parts (stairs,
      dormers, chimney stacks, lean-tos, hearthstones, kitchens, bar counters, canopy beds, barn stalls) (2026-11-09).
- [x] Roof overhangs (D-059), inner roof corners at L and T valleys, yards, fences, gates and paths (D-060), door
      lights, gates as front doors, gable-end balconies (2026-11-09).
- [ ] Next for building quality: an upper storey over a loggia on posts or a jetty, varied heights between wings,
      arches (check `stone_arch` in the game first), stone paving outside, taller and larger s3 buildings, door
      lights on octagon plans, better proxies for roof corners and carvings, the middle-eastern court tavern fire,
      the two middle-eastern temples.
- [ ] **From the first test pool test (2026-11-09 Session 3), do first:** benches on tables in game; bed through a
  wall gap; outside benches and logs clipping walls; storehouse chests clipping and stair foot above ground; chests
  around the hearth move into the storehouse once built; hunters find game farther out or go on trips (D-078); growth
  stalls on "nowhere to put a home". Done: hearth kept clear, pool-only stand-ins, item stands at decor (df075f7).
- [x] **Later-biome decor (D-080, answered 2026-11-10):** home decor stages pay for lox pelts, iron, silver and the
  like with stand-ins from the village biome and its neighbors (Meadows: Meadows and Black Forest; Black Forest:
  Meadows and Swamp; and so on), from the chests (`Village/DecorAnalogs.cs`, `Villagers/HomeDecor.cs`,
  `DecorPaidWithAnalogs`). Mod side 5ba7984; lab side d40b648 (decor reach one biome further, stations, fires and
  chests at home). Not tried in the game.
- [ ] D-080 says decor is never free. Still free in the code: beds (`DecorAnalogs.cs`, beds exempt); materials not in
  the stand-in table; cloth (linen, jute) in Meadows, Black Forest and Swamp villages, which have no cloth stand-in;
  and the interior pieces a design brings when the builder puts it up, which pay only wood, fine wood, core wood and
  stone (`Designs/DesignSpawner.cs` RecipeCost). Open: D-101.
- [ ] **Generator, design session (branch `design/kitbash`, 2026-11-10):**
  1. [x] Pool audit as a gate for `make_testpool.js` and `vh testpool make`; every round 6 screenshot defect is a
     measure (558604b).
  2. [x] One table of piece sizes from the game's models, `lab/test_sizes.js` (4496d51).
  2h. [ ] Paused 2026-11-10, resume from docs/handoffs/2026-11-10-design/README.md: decor any biome and no caps (D-065,
     D-126; design/wip-decor-limits), item stands (design/wip-stands), hearths and lighting (design/wip-hearths), and
     D-132 (stages and decor phases need not carry everything over; nesting and shell kept become reported measures).
  2i. [ ] **Central hearth (hub) per culture, growing with the village (Tyler, 2026-11-11):** the village's
     gathering place and the leader's usual spot, the same idea as Millénaire's town halls (D-067: the hearth is the
     hub). Early stages are spare: a campfire with lean-tos round it. Each stage grows larger and grander, with more
     storeys and richer architecture; in most villages the hub is the grandest structure at the last stage. By
     culture it may be a longhouse, a round structure, or another form. Reference: Tyler's board saves for the
     Meadows hearth (`BepInEx/config/Villheim/blueprints/inspiration/board/`: hub1_s1d2, hub1_s1d3; drafts
     hub1_s2d3, hub1_s3d3, hub1_s4d3, the last two the same 1,006 pieces). No s5 save or draft was found; work on
     s2 to s5 made after the drafts were written (2026-11-07, 6:54 PM MT) may still stand on the board in the flat
     test world. Plan: docs/handoffs/2026-11-10-design/hubs.md (design/wip-hubs); questions D-137 to D-142. Plan first (docs and
     data), generator work after the interior tracks merge.
  2j. [ ] **Landscaping and greenery across the village (Tyler, 2026-11-11, D-143):** trees, bushes, plants, vines
     on houses, gardens and raised beds as beautification, placed along roads, around and on houses, in courtyards and
     yards, and at road junctions. Research first from the corpus and outside sources (player builds and professionally
     made games), then placement in the lab. Villagers never harvest village landscaping for materials (mod side).
  2b. [ ] **Next, asked for by Tyler (2026-11-10):** one more round of tightening the piece models: rerun
     `lab/extract_models.py` on Tyler's PC (game files under Z:\SteamLibrary\steamapps\common\Valheim, UnityPy) with
     a finer proxy (more parts than the 40 or so now), `lab/build_models.js`, then every check; and in `lib/mesh.js`
     split a prism (a blanket, a hide) into several boxes along its outline instead of one box round it. Used by the
     generator, the checks and the lab page; no textures.
  2d. [x] Creative interior sets (D-065, D-098, design helper 2026-11-10): 92 combined and clipped sets, KC-001 on,
     each with role, household traits, rooms, decor stages, biome, footprint and height; the interior library holds
     193 of the 220 decor prefabs the corpus uses (was 109). `docs/INTERIOR_DESIGN.md`, "Creative sets".
  2e. [x] Run `lab/mine_creative.js` on the full corpus and add the objects that repeat or come from liked builds
     (2026-11-10: 56 sets KC-093 to KC-148 from 1,536 builds, library at 201 prefabs); 8 of the 13 prefabs with no
     model measured, `piece_drawer` and two others are mod pieces.
  2c. [x] Intentional clips (D-098): a set's own pieces go into what shows of the walls and into each other as deep as
     their source builds; marked in a `#VillheimClips` section that `lib/audit.js` honors (e44db1e). Not tried in the
     game.
  2f. [x] Richness measure `lab/richness.js` (7850007); room ceilings read from the game's solids (77452c3); the
     interior library's sets come before the decorator's extras, hung pieces slide, floor sets on raised sections,
     biomeSafe keeps decor reach (1545946); richness floors in the pool gate, `make_testpool.js --sample` for a Black
     Forest and a Plains pool (d9103bf). Not tried in the game.
  2g. [ ] From the richness work: engine time per design is up about a third (gen-test); test_variance at s2d2 a
     little closer (home-a 0.61, home-c 0.66, hall 0.60); the Black Forest and Plains sample pools fail the gate on
     defects main had before (mountClip, hang, intoWall, doorway); the 16 most used prefabs still make 80 % of decor.
  3. [ ] Growth that adds to the earlier stage for storehouse (46 %), home a (49 %), hall (54 %), barn (63 %); origins
     centered on the s3 footprint. Found: the storehouse's s2 back-room partition is planned again at s3 and moves;
     home a loses floors, roof ridges and its yard fence. Keep the partition and yard decisions across a line's stages.
  4. [x] Household variance as a measure (c8c63f0): likeness by furniture and arrangement, gate on home lines over
     0.7, `lab/test_variance.js` (7 of 8 houses under 0.6; home a s2d2 0.61). Floor sets may stand on the raised
     sections that line Norse homes' walls (1545946).
  4b. [x] Interiors tab on the lab page (c8c63f0); page republished 2026-11-10.
  5. [ ] Sort the corpus by culture and mine assemblies per culture (blueprints on Tyler's PC and branch `corpus`).
  6. [ ] Interior study (valheimians, BG3 and the rest) into assemblies and room templates.
  7. [ ] Store rooms at d3 (barrels, crates, sacks), window boxes. Slopes: walkable banks done mod side (fb96935).
  8. [ ] Open from the checks: 7 decorator overlaps (a torch into an oak feast table, chests, a table against a forge
     part), a bench in a tower's half wall, 11 barn chests outside the floor outline (watched).
  9. [ ] Hung pieces keep their collider against the wall's: confirm in the game that stands, signs and banners hold.
  10. [ ] Lab comments to match the decisions (code audit 2026-11-10; the bundled `Generator/lab.js` carries the same):
     `lib/audit.js:6` cites D-070 for nested decor stages (that is D-071); "minor decor goes in any biome (D-066)" in
     `lib/checks.js:532`, `lib/kitbash.js:13`, `lab/mine_kitbash.js:322`, `lib/generate.js:1590` and "free in the
     game (D-066)" in `lib/yards.js:17` (D-080: never free; D-101); "stations, fires and chests keep to the village's
     own biome" citing D-066 or D-080 in `lib/pieces.js:332-335`, `lib/decorate.js:130`, `lib/kitbash.js:11, :18`,
     `lab/check_interiors.js:34` (in neither answer); no stone yard fences in the Meadows at any stage
     (`lib/yards.js:252-254`; D-012 allows stone later; D-124); the east-asian style and the Ashlands culture
     (`lib/styles.js`, D-105); role display names in `lib/kitbash.js:1571-1574` are not D-075 trades.
- [ ] **Walkable villages:** paths and building pads smooth slopes so no route needs a climb villagers cannot make
  (a path went down a 3 m embankment, 2026-11-09). Storehouse: stacked, labeled chests along the walls; hearth chests
  move in once it stands. Window flower beds need better pieces.
- [ ] **Village placement and lag (Tyler, 2026-11-09 night), merged to main 2026-11-10 (cluster A), not tried in the game:**
  1. [x] Villages find room by themselves: real footprints, 2.5 m gap (D-082), hearth circle plus 4.5 m (D-084), every
     tree and all but house-size boulders (12 m or more, D-081) cleared, the game's small ruins taken down for
     materials (D-086) (`Village/PlotFinder.cs`, `Village/Ruins.cs`). Not tried in the game.
  2. [x] A building with no room is set aside and the next project goes on; the reason shows on the hearth's hover
     (`Village/PlotFinder.cs`, `Village/NextStep.cs`). Not tried in the game.
  3. [x] Choose a building's spot by hand: `vh plot check | here | clear` (`Village/PlotPick.cs`) and the Shaper Tool's
     plot mode, key 9, with the outline green or red, the door side and the hearth's ring (D-090 to D-093,
     `Village/PlotTool.cs`). Not tried in the game.
  4. [x] Tools stay in hand between job steps; fewer job changes shown (`Villagers/Chores.cs`). Not tried in the game.
  5. [x] Lag: plot search within 25 ms a tick (`PlotSearchMs`), fence and sign scans listed once, next step cached
     3 s. Not tried in the game.
  6. [ ] Confirm from the log which pieces blocked the plots before these changes.
  7. [x] Hold-up reason on the notice board's Project sign (D-089, `Village/NoticeBoard.cs`). Plot clearing as
     villager work (D-087, `ClearPlotsByHand`), all materials back from what the village takes down (D-088,
     `Village/Refund.cs`), `Village status` line and `vh snapshot`. Not tried in the game.
  8. [x] Lag, cluster B: shared piece list (`PieceIndex`), blueprints read in the background, lag summary line and
     `vh lag` A/B tests for villager draw cost, notice board and hearth tick split (`Village/LagProbe.cs`,
     `Village/PieceIndex.cs`). Not tried in the game.
  9. [ ] Read the first lag summary; preload any villager gear or spawn that spikes; act on `vh lag hide` results.
  10. [x] Cluster C: churn (material kept two minutes, unreachable idle spots remembered), decor reach, loose design
      items locked (T-626), signs off barred walls (T-606, T-612), `vh villager add` adults (T-616), no call to arms
      for game (T-58), bedtime on the third try (D-076). Not tried in the game.
- [x] Storehouse chests stacked and labeled along the walls (generator, 2026-11-09 night).
- [ ] **Next test build (Tyler, 2026-11-09), do first:**
  1. [x] Beds: the bed shows its villager's name as a player's claimed bed does, villagers sleep in their beds, and
     village beds cannot be claimed by players (`Villagers/Sleep.cs`). In the current code villagers take free beds;
     D-077 sets beds by arrival order (item 10, not built). T-607 to T-609 Pass with no notes.
  2. [x] House signs in a fixed place: outside, right of the front door at about head height (where a
     house number goes); inside (families), right of the door as seen from inside looking out, one column, stacked;
     set 2 cm into the wall (D-073, `Village/HouseSigns.cs`). Not tried in the game.
  3. [x] [built 2026-11-09: `vh testpool make`, setting TestPool; waits for additive decor stages and growth lineage
     from the helpers before the test] Swap the test village's random buildings for the generated Norse s1d1 to s3d3
     set: a small pool of Norse
     variants in the building pools, so the test covers villagers building, living in, expanding and decorating
     houses, and the role buildings where each role spends its day. (`Generator/TestPool.cs`, `TestPool`.)
  4. [x] Evenings at home: no sitting on the floor (only at the earliest stages or with no seats); sit on chairs,
     benches or beds (one per bed), stand and talk, or use shelves, cook stations and stock (`Villagers/HomeLife.cs`).
     Not tried in the game.
  5. [x] Hide protector and carer from signs and hover text (internal only; `Villagers/Households.cs`,
     `Villagers/VillagerBehaviour.cs`). Not tried in the game.
  6. [x] Role colors and the role set (D-075, D-076): carpenter (brown, also cuts wood), smith (pale steel, also
     mines), cook coral, farmer green, guard blue, hunter dark green, fisher teal, healer white-pink, elder gray, child
     light blue (boys) or light pink (girls), leader gold (`Villagers/Households.cs`, `Villagers/Roles.cs`). Not tried
     in the game.
  7. [x] Short hover texts ("at home", "fixing up the home"). T-622 Pass.
  9. [x] 7d70f54 and a67b3d0, D-076 follow-ups: guards gather by day between watches; the guard on watch fights without an alarm, other
     guards wake at 50 % of his health, all able adults under 25 %; a villager stuck on the way to bed is put in it
     at bedtime even with a player near (`Villagers/Chores.cs`, `Villagers/Combat.cs`, `Villagers/Sleep.cs`). Not
     tried in the game.
  10. [ ] D-077: beds and houses set by arrival order, never claimed as villagers arrive. The whole roster is rolled
     ahead of time, with family sizes and who arrives later, and decides the houses built first, sized for the family
     to come. Families have at most four people in any mix (1 adult and 3 children; 1 adult, 1 elder and 2 children;
     2 adults, 1 elder and 1 child; and so on). Four villagers at the start (`StartingVillagers` 4); no fixed rule such
     as the first two always being single. Children do not count toward the population cap and do count on the
     population sign, which lists each kind (3 adults, 2 elders, 1 child). Beds never change hands; a dead villager's
     bed is kept. Not built; first try reverted 2026-11-10 (6014028).
  11. [x] D-078, built 2026-11-10: elders mend inside the village off the outer fence, feed animals (acted), forage
      and help with crops; hunters go away overnight with a roll for success, catch and health
      (`Villagers/HuntTrips.cs`); healers use potions, healing foods and herbs (`Villagers/Tending.cs`); fish by biome
      (`Villagers/Fishing.cs`); children light blue or light pink. Not tried in the game.
  11b. [ ] D-078, not built: rafts and fishing from docks (after a feasibility check); a roll for the fisher's success,
      catch and health.
  8. [ ] Role touches only through kitbashed role displays that fit many arrangements (D-074). The lab holds the
     displays as data (`tools/blueprint-lab/lib/kitbash.js`); the mod does not place them yet.
- [ ] Home life (D-073, built 2026-11-09, not tried in the game; homes come from villagers taking free beds until
      D-077 is built): try signs, home decor, evenings and bedtime; get
      `_s#d#` designs (board saves, approved generated designs) into the village building pools so home decor has
      stages to build; role touches (D-074); decor pieces overlapping amenity furniture or signs.
- [ ] Kitbash libraries in stages (helpers, 2026-11-09): interior assemblies and clips (stages 1 and 2 merged), yards
      (stages 1 and 2 merged), exterior accents and the coverage audit (stage 1 merged).
- [ ] Interiors (2026-11-09 review; vignettes on bare walls done): at most two chests side by side,
      an anchor per building type (smithy forge corner, home bed corner), square yaws for clutter, fuller main halls.
- [ ] Later, for Tyler to look at: redraw `docs/rooms` and `docs/generated` with the v2 models, a Motifs tab, before
      and after renderer pictures, the renderer preview page on Tyler's PC, republish the lab page.
- [x] Repair tab: fill missing pieces of an uploaded blueprint from rows, stacks, floors, mirror and the build's own
      patterns, with a confidence for each (2026-11-08 day; measured accuracy in `docs/BLUEPRINT_LAB.md`).
- [ ] Millénaire translation pilot (2026-11-08, branch `night2/mc`, `docs/MC_TRANSLATION.md`): converter and
      measurements done; decide whether mc-learned rules may feed thin cultures behind an off switch; add hip corners
      and triangle gables to the converter.
- [ ] Repair for irregular hand builds: learn neighbor patterns across the whole corpus, so builds without a mirror
      line get more than row and floor fixes.
- [ ] Villagers repair damaged buildings from the same rules (gap in a row, missing course) when no saved design
      covers the piece.
- [x] Style guides and lab forms for the approved cultures (2026-11-08, branch night3/styles,
      `docs/CULTURE_STYLES.md`; 147 samples pass every check).
- [ ] Measure `turf_roof`, trader tents and awnings with `vh exportpieces` and use them for turf houses, steppe,
      Persian and Saami styles (D-013).
- [ ] Culture forms still to build: darbazi stepped roof, church apse and narthex, Slavic corner stove, keep door on
      the first floor, passage farm behind Icelandic gables.
- [ ] More Middle Eastern builds to learn from: still only 3 in 2,134 designs.
- [ ] More biomes (Plains, Mountain, Swamp) with their own materials.
- [ ] Gear by biome and village level: basic Meadows tools for everyone, biome weapons and shields for protectors,
      better materials and Black Forest gear as the village levels up (Tyler, 2026-11-05). (Since 2026-11-07 each tier
      is made by the village's smith first; see Milestone 7.)

## Milestone 6: Millénaire village life

- [x] Village chronicle read at the hearth (`Village/Chronicle.cs`). No Pass in the Tests tab yet.
- [x] Mourning when a villager dies (`Villagers/Moods.cs`). No Pass in the Tests tab yet.
- [x] Night watch by protectors in turn; a lone guard keeps every other night (D-076, `Villagers/Roles.cs`). Not tried
      in the game since 2026-11-10.
- Removed: raids at night with a warning at dusk (D-028: raids are out; D-017: the code stays, `RaidsEnabled` off,
  `Village/Raids.cs`).
- [x] Foraging for food (`Villagers/Foraging.cs`). No Pass in the Tests tab yet.
- [x] Village sign and notice board (`Village/NoticeBoard.cs`). T-406 Pass with notes.
- [x] Village types: woodland, fortified, farming (`Village/VillageState.cs`). No Pass in the Tests tab yet.
- [x] A chieftain: the first settler still living, titled by culture (D-040; `Villagers/Roles.cs`,
      `Cultures/cultures.txt`). No Pass in the Tests tab yet.
- [x] Children born to families who grow up (`Villagers/Childhood.cs`, `Village/VillageBrain.cs`). No Pass in the
      Tests tab yet. D-077 rolls the roster ahead, including who arrives later; how births fit that is open (D-099).
- [ ] Villages visiting each other: pedlars and pilgrims from the nearest other village bring news and move relations
      (`Village/WorldLife.cs`, `Villagers/Wanderers.cs`; `WorldLife` off by default). Merchants between villages: since
      D-008 a trader walks the trail with his own pack and sells to players; caravans carry nothing between villages.
- [x] Farms (Tyler, 2026-11-06): berry and mushroom farms in the Meadows, made by planting the vanilla bush and
      mushroom pickables in rows on a farm plot (they regrow after picking) (`Village/Farms.cs`). No Pass in the Tests
      tab yet. Crops from seeds later (carrots in the Black Forest). Saplings replanted where trees were felled
      (`Villagers/Replanting.cs`).
- [x] A farmer trade: tends and harvests the farms, keeps the chest in food (`Villagers/Farming.cs`). No Pass in the
      Tests tab yet.
- [x] Domesticated animals (Tyler, 2026-11-06): tamed boars and piglets at farms, in a pen, added on a schedule as the
      village grows (one a day at most, capped by village size), never by feeding or breeding. Breeding and eating
      blocked for village animals by Harmony patch, feeding acted out (D-015, D-036; `Village/Farms.cs`). T-117 Pass.
      Chickens later.
- [x] Ghostly villagers (Tyler, 2026-11-06): Valheim is the afterlife, so villages may be echoes or memories.
      Villagers slightly see-through, faintly blue or teal, with a faint glow after dark (`Villagers/GhostLook.cs`,
      `GhostLook`); village animals too (D-053); a dying villager fades as a ghost (D-051, `Villagers/GhostDeath.cs`,
      T-49 Pass).
- [x] Map pins: a village pin within 70 m of the hearth (campfire icon for a camp, house icon from a hamlet up) and a
      dot for each villager while the player is inside the village (`Village/MapPins.cs`). T-22 Pass for the map
      table; T-106 Pass with no note.
- [ ] Map icons near a village (Tyler, 2026-11-10): an icon for each building, with the house icon for homes, while the
      player is near the village; only the village icon when he is away. Not built.
- [ ] All of the village's villager dots on the map while the player is near the village, including villagers outside
      the village radius (a hunter on a trip, for example) (Tyler, 2026-11-10). Not built: today the dots show only
      while the player is inside the village (`Village/MapPins.cs`).

## Milestone 7: the world between villages (Tyler, 2026-11-07)

Villages that reach out past their fence, and a world with other people in it. Design and order of work:
`docs/WORLD_LIFE.md`; research in `docs/RELATED_MODS.md` section 5.

Everything here that needs `WorldLife` is off by default (`WorldLife` false).

- [x] Travelling pedlars who trade with the village chest and the player (`Village/WorldLife.cs`,
      `Villagers/Wanderers.cs`, `vh pedlar`). No Pass in the Tests tab yet.
- [x] Pilgrims who stay the night by the hearth and bless it (`vh pilgrim`). No Pass in the Tests tab yet.
- [x] Hermits at camps by ruins who point players to places worth finding (`vh hermit`). No Pass in the Tests tab
      yet.
- [x] News that travels between villages with visitors (`Village/WorldLife.cs`, `vh news`). No Pass in the Tests tab
      yet.
- [x] Villagers with their own homeland, food, fear, pastime, hope, friend, rival, yesterday and memories
      (`Villagers/Personality.cs`, `vh villager`). No Pass in the Tests tab yet.
- [x] Relations between villages that drift day by day (`Village/Relations.cs`, `vh village`). No Pass in the Tests
      tab yet. D-028 rules out feuds between villages; the events director's "dispute" (a falling-out with a neighbor,
      `Village/VillageEvents.cs`) differs from D-028 (Open: D-107).
- [x] Idle villagers watch others work and comment (`Villagers/FreeTime.cs`). No Pass in the Tests tab yet.
- [x] Caravans as records that move on the world clock and become real only near a player (`Village/Caravans.cs`).
      Since D-008 a caravan is a trader on the trail with his own pack, for players (`CaravanDeliveries` off). No Pass
      in the Tests tab yet. Paying him with gifts and a pack animal are tabled (D-045).
- [x] Outpost wood counts for the biome rule; villagers go out only once equipped to defend themselves (Tyler,
      2026-11-08; D-024; `OutpostMaterials`, `OutpostGear`, `Village/Outposts.cs`). Not tried in the game.
- Removed: daughter villages founded 600 to 1,200 m away by a full village (D-010: one village per site plus resource
  outposts). `Village/Daughters.cs` kept, `DaughterVillages` off.
- [x] Groves: a grown village with few trees around it plants more (`Village/Groves.cs`). Not tried in the game.
- [x] Signposts where trails leave a village and halfway along long trails (`Village/Trails.cs`, `TrailSigns`). Not
      tried in the game.
- [ ] Outposts at far resources (core wood, ore, the coast), joined to the village by a path. Built: logging camps,
      flint camps on the shore and their trails (`Village/Outposts.cs`, `Village/Trails.cs`, `vh outpost`,
      `vh trails`); ore camps not built.
- [x] Roads between villages: dirt trails to the nearest neighbor (`Village/Trails.cs`). No Pass in the Tests tab yet.
- [ ] Desire paths worn by villagers' feet.
- [ ] A smith who crafts gear from the chest at a real station; villagers take gear from the chest. Built: sets per
      tier made at the recipe's station from the chest (`Villagers/Smithing.cs`, `SmithMakesGear`); gear in the chest
      and a village forge to come.
- [ ] Requests and contracts on the notice board; bounties. Built: contracts on the back of the board (D-009,
      `Village/Contracts.cs`); bounties to come.
- [x] A village events director (feasts, quarrels, a lost villager, a skald) (`Village/VillageEvents.cs`, eight
      kinds). No Pass in the Tests tab yet. Its "dispute" event differs from D-028 (Open: D-107).
- Removed: raids and help between villages by relation (D-028: no raids, feuds or wars between villages; D-017: raid
  code kept, off).
- [x] Skills that grow with practice (`Villagers/VillagerSkills.cs`). Not tried in the game.
- [ ] Wanderers at the longhouse who can be asked to stay. (Newcomer backstories built 2026-11-08 night,
      `Villagers/Personality.cs`; the seeker who asks a price to stay is still to do.)
- [ ] Proposals from `docs/LIVING_WORLD_RESEARCH.md` (43, ranked): pick the next ones with Tyler.
- [x] Living village rules from Tyler's decisions (2026-11-08): villagers never leave, elders do not die of age,
      growth is never capped by bosses (D-003, D-004; `VillagersLeave`, `EldersDieOfAge`, `BossStageCap` off,
      code kept). Complaints and asking a player for help stay (`Villagers/Complaints.cs`). Not tried in the game.

- [x] True rumors from the land: idle talk, requests and hints come from real locations, spawns, ore and terrain
      around the village (boss hints, animals, dungeons, biome edges, landmarks), firsthand from the villager who saw
      it, then passed on by others (Tyler, 2026-11-08; D-033; `Village/Knowledge.cs`, `Village/Rumors.cs`). T-19 and
      T-21 Pass.
- [x] Village reach grows with stage and gear; villagers only explore and harvest where they can hold their own, and
      only know what lies inside their reach, widened by hunters, trails and outposts (Tyler, 2026-11-08;
      `Village/Knowledge.cs`, `KnowledgeReach`). T-18 Pass.
- [x] Map table by the hearth from the hamlet stage: copy the village's discoveries onto your map (Tyler, 2026-11-08;
      D-047; `Village/MapTables.cs`, `MapTableFromStage` 2). T-22 Pass with notes.
- [x] Cultures by biome, up to three per biome, from the Viking-age world (Tyler, 2026-11-08; D-030): Meadows norse,
      anglo-saxon, frankish-norman; Black Forest norse-forest, celtic, slavic; Swamp celtic-crannog, baltic, fen-folk;
      Mountains norse-highland, saami (equal weight, D-039); Plains middle-eastern, byzantine, steppe; Mistlands
      byzantine, lamari. No villages in the Ashlands or Deep North. Names, skin tones, looks and a few
      lines per culture. Short leader titles: Jarl, Reeve, Lord, Chief, Elder, Sheikh, Archon, Beg (D-040)
      (`Village/Cultures.cs`, `CultureMap`). T-13, T-24 and T-128 Pass.
- [x] Biome defenders: villagers near the Plains shoot deathsquitos out of the sky; villagers near the Mistlands are
      skilled against and hit harder at Mistlands creatures (Tyler, 2026-11-08; D-032, D-042;
      `Villagers/Defenders.cs`). T-25 and T-47 Pass.
- [ ] Style guides and lab templates for each culture, learned from Millénaire (allowed for plans, roofs and room uses
      of cultures with little data, Tyler 2026-11-08), Lego and other modular builds, and architecture references
      (helper branch night3/styles).

## Later ideas

- Trading with the player at village shops, as in Millénaire. (First step 2026-11-06: crouch and talk to buy
  what the chest can spare. Next: the village buys what it needs, shops per building.)
- Removed: raids on villages through the game's own random events (D-028).
- Removed: a mood that speeds or slows work (D-014).

- Ghost previews of the next building.
- Builders carrying materials from a village store.
- Roads between villages and trade.
- Thunderstore release.
