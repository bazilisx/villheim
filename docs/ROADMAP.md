# Roadmap

Goals and milestones for Villheim, set by Tyler. Tick items off as they are confirmed working in game, and link the
daily note where it happened.

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

- [x] Woodcutters, miners and a builder; gear tier rises with the village and nothing drops on death.
- [x] Material stock (wood, fine wood, core wood, stone) priced from vanilla recipes.
- [x] Staged construction: structure, roof, doors and windows, interior.
- [x] Gathering order: dropped material, loose pickables, half-harvested work, then fresh trees and rocks.
- [ ] Village chest by the hearth, kept for good. Villagers and players fill it, the builder builds from it when it
      has enough, and a destroyed chest is rebuilt before anything else. (Built 2026-11-05 session 5, needs testing;
      replaces the chest beside each building site.)
- [ ] One prioritized builder per village who builds whenever the chest covers the next piece and gathers otherwise.
      (Built 2026-11-05, needs testing.)
- [ ] Biome materials: no core wood in the Meadows, and so on. (Built 2026-11-05, needs testing.)
- [ ] Movement without jitter: stand spots, steady goals, unstuck re-path and sidestep. (Built 2026-11-05; 2026-11-06 session 10:
  walk the last metres, turn angle 90, one rotation driver, steady threat check. Needs testing.)
- [ ] Build order (Tyler, 2026-11-06): homes with beds until every villager has one, then the longhouse, then the hub
  area (sign, notice board, benches) and, while waiting, a workshop (basic workbench house) and a storehouse (extra
  chests); then more homes, farms and workshops as trades appear. Built session 11, needs testing.
- [ ] Notice board from the `villagenotice` blueprint over the village chest (session 13; repeated-board bug fixed
  2026-11-08, needs testing).
- [ ] Food and dishes in interiors: food on horizontal item stands (all food but honey can go on one, per the wiki)
  and the serving tray (Feaster) on tables, for village-built buildings; empty stands stand in for now (Tyler, 2026-11-08).
- [ ] Clickable notice board signs with a menu, like Haldor's or Millénaire's: accept a contract, see the list of
  buildings to come, move or prioritize them, or ask for a different building (Tyler, 2026-11-08, later). Its back
  carries the contract, season, next feast and prosperity (D-009, built 2026-11-08, needs testing).
- [ ] Storage chests by the main chest as the village grows (one, two, four, then by people and need), each labelled
  with a vanilla sign and kept sorted by a villager; the builder takes from any (D-016, built 2026-11-08,
  `StorageChests.cs`, `Sorting.cs`, needs testing).
- [ ] Anything brought into the village counts toward what it can build (D-007, built 2026-11-08, `BroughtMaterials`,
  needs testing).
- [ ] Village-built pieces take no rain or water damage (D-038, built 2026-11-08, `WaterProof.cs`, needs testing).
- [ ] Roads and facing after Millénaire (session 14, needs testing): doors toward the hearth, parent-rule paths,
  buildings along roads, wider trunks, queued paths join, daily door check (session 15).
- [x] Design review pass 1: `vh report` lists every design with one stage each into the review sheet; Tyler kept
  264 of 963 (2026-11-07).
- [x] Shaper Tool: hotbar tools picked by key and used by click, mouse wheel turning, reset, undo, look, effects;
  Tyler's F1 values as defaults. Guide: `docs/DESIGN_REVIEW_GUIDE.md`.
- [x] Sort knives for phases A and B (2026-11-07): type and subtype set in the game by click, sign colours,
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
- [ ] Grow a plot (and slide its neighbours) when a build needs more room; for now 'size N' sets every plot of a board.
- [x] Path markers on the board (2026-11-07): one meaning, "connect roads and paths here"; saved as "#VillheimPaths"
  (path;x;y;z;yaw, yaw = outward from the design's middle through the marker), read into Blueprint.Markers.
- [x] Paths use the markers (2026-11-07): a building's road starts a metre out from its marker nearest the hub (or the
  hearth), the hub's road ends at its nearest marker, the parent rule uses markers too; designs without markers keep
  the Doors guess.
- [ ] Villages build the board's saves (`<baseID>_s<n>d<n>` from blueprints/inspiration/board): pick a base ID per
  kind and biome, build s1 at d1, raise d# over time and s# with the hearth's stage. Until then the markers only
  matter for blueprints that carry them.
- [x] Roads follow the buildings (2026-11-07): a rebuilt building's old road is taken up (to where another building's
  road joins it) and a new one is laid from its markers.
- [ ] A rebuilt hub: roads of the other buildings move to the new hub's markers.
- [ ] Villages build a save's terrain section (paths, paving, levelled spots) along with its pieces. Board saves keep pieces, ground and markers relative to the plot's middle: read them with `Blueprints.FromFile(file, asSaved: true)` so the pieces are not re-centred off their ground.
- [ ] PNG pictures for saved stage files too (copy them to PlanBuild as a "Villheim saved" tab).
- [x] Decor stages on the slotting board (2026-11-07): saving d3 brings up a d2 copy behind it, d2 a d1 copy.
- [ ] Phase D: decor stages from the richest down. Save d3, it is copied to the d2 plot; strip and save d2, copied to
  d1; strip to the bare minimum and save. Files named `<baseID>_s<n>d<n>` (e.g. `house1_s2d3`). Optional: a key that
  removes every non-structural piece as a start for d1.
- [ ] Phase E: one base ID in one biome in a row, s1d1 to s3d3, to review how it grows.
- [ ] Bake common hand swaps into the stand-in suggestions once a pattern shows (same original, same choice).
- [ ] Teach the blueprint reader the `<baseID>_s<n>d<n>` naming and the sheet's type, subtype and biome; the hearth's
  stage unlocks the next s#, villagers raise d# between stages (see `docs/MILLENAIRE.md`).
- [ ] Villagers decorate between upgrades: instead of idling, they add single pieces that d1 lacks and d2 has, one
  at a time, so a house moves from d1 to d2 to d3 piece by piece; a new s# is a real rebuild of the building.
- [ ] Ship Tyler's finished blueprints inside the mod (Villheim reads .blueprint files itself, so PlanBuild is only
  needed to make them, never to play).
- [ ] Storehouse grows into the longhouse: its chests move into the central hall when the hall is rebuilt bigger.
- [ ] Replant one sapling per tree felled, 8 to 25 m outside the village radius. Built session 11, needs testing.
- [ ] Jitter: record traces with `vh trace` and fix from the data. Session 12 fixed two causes (NpcTalk turning to the
  player, seat sawtooth); trace again to confirm.
- [ ] Building ground flat at floor height like the hearth (session 12, needs testing); drop designs that trap villagers.
- [ ] Trees felled away from the village.
- [ ] Right tool for each job: hammer to build, axe for trees, pickaxe for rocks. (Built 2026-11-05 session 4,
      needs testing.)
- [ ] Villagers open and close doors. (Built 2026-11-05 session 4, needs testing.)
- [ ] Support-aware build order: nothing goes up unsupported; openings before what rests on them. (Built 2026-11-05
      session 4, needs testing.)
- [ ] Never copy wild bee hives from designs; they poison villagers and players nearby. Crafted bee hives
      (`piece_beehive`, made from a queen bee) are a normal piece and are copied (Tyler, 2026-11-08). (Built 2026-11-05
      session 4; narrowed to wild hives 2026-11-08, needs testing.)
- [ ] Villagers gather from nothing for their first building (no free starting stock). (Built 2026-11-05 session 5,
      needs testing.)
- [ ] No swings from a distance: reach checked against the real surface before every blow. (Built 2026-11-05
      session 5, needs testing.)
- [ ] Smooth walking: own brain outside fights, player speeds, no shoving. (Built 2026-11-05 session 5, needs
      testing.)

## Milestone 3: a village that looks planned

- [ ] Central hub first (tavern or longhouse), then houses, workshops (carpentry, forge) and farms.
- [ ] Paths from a grid search that join into streets (replacing the L-shaped paths). (Built 2026-11-06 after
      Millénaire: A* with slope, turn and reuse costs, joining the laid network; needs testing.)
- [ ] Earth floor painted under buildings.
- [ ] Millénaire-like alignment: buildings face the streets.
- [ ] Buildings stay close: houses orbit the hearth within a set distance; specialty buildings go a bit farther out or
      next to their resource (mining nodes, water), always inside a maximum radius (Tyler, 2026-11-05). (Built
      2026-11-06 after Millénaire: distance bands per role, ring order, workshops near trees and rocks; needs testing.)
- [ ] Buildings never overlap other buildings or paths (Tyler, 2026-11-06). (Built 2026-11-06, needs testing.)
- [ ] Ground first: every site is flattened before the first piece goes up (Tyler, 2026-11-05). (Built 2026-11-06:
      whole outline at break ground, and under each ground piece; needs testing.)
- [ ] Paths are laid by a villager walking the route, one stretch at a time (Tyler, 2026-11-05). (Built 2026-11-06,
      needs testing.)
- [ ] Repairs: villagers fix broken pieces, structural first (flatten under ground pieces), cosmetic later (Tyler,
      2026-11-05). (Built 2026-11-06, needs testing.)
- [ ] Fencing that keeps enemies out and grows with the village (Tyler, 2026-11-06): a ring around the buildings with
      gates where paths cross it, starting as sharpened stakes or a light fence in a small Meadows village and becoming
      a stake wall (and later stone) as the village advances; when buildings go up outside the ring, the old ring comes
      down and a wider one goes up, as Millénaire's walls grow with village level. Built by the builder from the chest,
      repaired like buildings. (First version built 2026-11-06: wood fence, then stake wall, gates at paths, rings
      replaced as the village grows; needs testing.)
- [ ] Stone building waits until the village advances in the Meadows and Black Forest: wood at early stages, stone
      from stage 3, the hall from stage 2 (Tyler, D-012; built 2026-11-08, needs testing).
- [ ] Boardwalks on poles over wet ground in fen-folk and crannog villages (D-038; built 2026-11-08,
      `Boardwalks.cs`, needs testing).

## Milestone 4: villagers with lives

- [ ] One small house per villager household; newcomers only arrive for a free bed, by day, walking in from the edge.
      (Built 2026-11-06: capacity is one per bed, small homes get one bed, larger homes two, the longhouse one per
      first settler; needs testing.)
- [ ] Free time: fire, sitting, strolls, chats, keeping busy at stations, gestures by village mood. (Built 2026-11-05
      session 5, needs testing.)
- [ ] Evening ring at the hearth, sitting and resting by the fire at night. (Built 2026-11-05 session 5, needs
      testing.)
- [ ] Sit on the village's chairs and benches. (Built 2026-11-06, needs testing.)
- [ ] Sleep in claimed beds, bedtime 22:00 to 23:00 and up at 05:00 to 06:00, random per villager (Tyler,
      2026-11-06). (Built 2026-11-06, needs testing.)
- [ ] Villagers with nothing else to do make a fire pit, cooking station, workbench and benches by the hearth.
      (Built 2026-11-05 session 5, needs testing.)
- [ ] Villagers cook for real at the hearth's cooking station: put food on, wait its cooking time, take it off, eat
      and heal by the food's regen over its duration; cooked food in the chest is eaten when needed, raw food is
      cooked and eaten or stored (Tyler, 2026-11-06). (Built 2026-11-06, needs testing.)
- [ ] Enough in the chest means no harvesting: villagers switch to two roles, builder and crafter/interior designer
      (Tyler, 2026-11-05).
- [ ] Crafted pieces follow the game's rules: workbenches and other crafting stations go under a roof (inside a
      village building) so they are usable; the workbench made outside in the test is not (Tyler, 2026-11-05).
      (Built 2026-11-06: workshops get a workbench at a spot that passes the game's cover test; needs testing.)
- [ ] Profession buildings with their workbenches near key resources (Tyler, 2026-11-06). (Workshops placed near
      trees and rocks 2026-11-06; more profession buildings to come.)
- [ ] Central building built around the hearth and cooking station, growing with it (Tyler, 2026-11-06). (Built
      2026-11-06 for longhouse designs with a fire pit; needs testing.)
- [ ] Millénaire growth: tiers, weighted picks, one pending project (Built 2026-11-06, needs testing.)
- [ ] Hunting for the cooking station's meat (Built 2026-11-06, needs testing.)
- [ ] Carers shelter indoors in a fight; no bed means sleeping under a roof (Built 2026-11-06, needs testing.)
- [ ] Hurt villagers put healing first: cook food at the hearth and eat it; with no cooking station, make one first
      (Tyler, 2026-11-05). (Real cooking built 2026-11-06; the cooking station is the first thing villagers make.)
- [ ] Villagers never walk or run through a fire: the hearth, fire pits and campfires are kept out of every walk,
      including straight steps (door passes, last metres to a tree) (Tyler, 2026-11-05).
- [ ] Every building site is flattened where needed before and while building, beyond the design's own terrain
      shaping and the simple pad (Tyler, 2026-11-05).
- [ ] The hearth upgrades over time as the village grows (Tyler, 2026-11-05): campfire, then a hearth with the
      cooking station over it, then larger vanilla fire pieces; the cooking station is part of the hearth, not a
      separate fire. (Cooking station moved onto the hearth 2026-11-05 session 7; upgrades not started.)
- [ ] One task at a time: pieces only appear while the builder stands next to them; a fight pauses the build or path,
      which resumes afterwards (Tyler, 2026-11-05). (Built 2026-11-06, needs testing.)
- [ ] The builder stands right by the piece and taps it with the hammer's own animation; no punching, no jitter at
      the workbench (Tyler, 2026-11-06). (Built 2026-11-06, needs testing.)
- [ ] Protector and carer roles: assigned at random, never by gender; new arrivals alternate protector, carer,
      protector. Roles do not limit jobs; they show in idle time and emergencies. When attacked, protectors take basic
      weapons and defend (Tyler, 2026-11-05). (Built 2026-11-06, needs testing.)
- [ ] Trades once the village has six villagers (carpenter, woodcutter, miner, cook, more as it grows), generalists
      before that, after Millénaire's villager types (Tyler, 2026-11-06). (Built 2026-11-06, needs testing.)
- [ ] Villager moods with reasons (needs and fading thoughts, scaled by personality) and a village mood from its
      people (Tyler, 2026-11-06). (Built 2026-11-06, needs testing.)
- [ ] Talk is periodic, never a constant stream; events get a reaction from two or three villagers, never the same line
      (Tyler, 2026-11-06). (Built 2026-11-06, needs testing.)
- [ ] Villagers notice and greet new players, remember them, listen and react to each other, spread news and ask for
      help (Tyler, 2026-11-06, a "Turing test lite"). (Built 2026-11-06, needs testing.)
- [ ] Newcomers only arrive for an empty bed, as in Millénaire (Tyler, 2026-11-06). (Built 2026-11-06, needs testing.)
- [ ] Dialogue about what villagers are doing, want and need, with conditions; grow into a large library of lines
      (Tyler, 2026-11-05). (Library of about 670 lines in eight voices with chats built 2026-11-06; about 3,000 lines
      after 2026-11-08 night; keep growing it.) Rewrite needed: T-20 failed (lines read as AI-written); new
      lines wait until a sample passes. Rules in `docs/DIALOGUE_STYLE.md`.
- [ ] Villager minds (built 2026-11-08 night, needs testing; `docs/WORLD_LIFE.md`): memory of each player and gossip
      about them, place, weather and player tags, per-player topic fatigue, skills, wants and sweethearts, gatherings
      and feasts, noticing, idle glances, chats of three. Feasts only after big buildings (D-005); mood changes free
      time only, never work speed (D-014).
- [ ] Interiors upgrade over time (bed, chests, table, then better furniture). (Built 2026-11-06 by village tier,
      needs testing.)
- [ ] Exteriors upgrade over time (swap a building for a better design of the same role). (Built 2026-11-06: next
      blueprint level or a bigger design, old building taken down first; needs testing.)

## Milestone 5: cultures by biome

- [ ] Different building sets and villager looks per biome (Meadows versus Black Forest first).
- [ ] PlanBuild blueprints as a design source. (Reader built 2026-11-06; needs blueprints in the folder and testing.)
- [ ] Curated blueprint sets for Meadows and Black Forest with upgrade levels (Tyler, 2026-11-06). The OverDrive
      BiomeBlueprints pack is blacklisted (Tyler, 2026-11-08). Capture with `vh savebp` or PlanBuild, or use downloads
      with the author's permission.
- [ ] Generated designs learned from Tyler's approved set and other creators' builds, with quality controls; renders
      of any blueprint from several angles; a request-to-blueprint tool (Tyler, 2026-11-08). (Built 2026-11-08 night:
      `tools/blueprint-lab`, `docs/BLUEPRINT_LAB.md`, the "Villheim Blueprint Lab" page, 273 designs in the Generated
      tab. Not yet placed in game. Villages do not build them until the CLAUDE.md wording is agreed.)
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
- [ ] **Later-biome decor (D-080, answered 2026-11-10):** pay for lox pelts, iron, silver, cloth and the like with
  stand-ins from the village biome and its neighbors (Meadows: Meadows and Black Forest; Black Forest: Meadows and
  Swamp; and so on), from the chests. Never free. Lab side in the design session; mod side done 2026-11-10 (5ba7984).
- [ ] **Walkable villages:** paths and building pads smooth slopes so no route needs a climb villagers cannot make
  (a path went down a 3 m embankment, 2026-11-09). Storehouse: stacked, labeled chests along the walls; hearth chests
  move in once it stands. Window flower beds need better pieces.
- [ ] **Village placement and lag (Tyler, 2026-11-09 night), merged to main 2026-11-10 (cluster A), not tried in the game:**
  1. [built] Villages find room by themselves: real footprints, 2.5 m gap, hearth circle plus 4.5 m, every tree and
     all but house-size boulders cleared, the game's small ruins taken down for materials.
  2. [built] A building with no room is set aside and the next project goes on; the reason shows on the hearth's hover.
  3. [backend built: `vh plot check | here | clear`] A tool made at the notice board to choose a building's spot by
     hand, with its size shown on the ground. The tool and its preview are open (item choice in DECISIONS).
  4. [built] Tools stay in hand between job steps; fewer job changes shown.
  5. [built] Lag: plot search within 25 ms a tick, fence and sign scans listed once, next step cached 3 s.
  6. [ ] Confirm from the log which pieces blocked the plots before these changes.
  7. [done 2026-11-10] Hold-up reason on the notice board. [done 2026-11-10] Plot clearing as villager work (D-087),
     full refunds (D-088), plot mode on the Shaper Tool (D-090 to D-093), `Village status` line and `vh snapshot`.
  8. [done 2026-11-10, cluster B, not tried in the game] Lag: shared piece list (PieceIndex), blueprints read in the
     background, lag summary line and `vh lag` A/B tests for villager draw cost, notice board and hearth tick split.
  9. [ ] Read the first lag summary; preload any villager gear or spawn that spikes; act on `vh lag hide` results.
  10. [done 2026-11-10, cluster C] Churn (material kept two minutes, unreachable idle spots remembered), decor reach,
      loose design items locked (T-626), signs off barred walls (T-606, T-612), `vh villager add` adults (T-616),
      no call to arms for game (T-58), bedtime on the third try (D-076).
- [x] Storehouse chests stacked and labeled along the walls (generator, 2026-11-09 night).
- [ ] **Next test build (Tyler, 2026-11-09), do first:**
  1. [done 2026-11-09, not tried in the game] Beds: every villager gets a bed, the bed shows his name as a player's claimed bed does, villagers sleep in their
     beds, and village beds cannot be claimed by players (today beds show "unassigned, claim bed" and nobody uses them).
  2. [done 2026-11-09] House signs in a fixed place: outside, right of the front door at about head height (where a
     house number goes); inside (families), right of the door as seen from inside looking out, one column, stacked;
     set 2 cm into the wall.
  3. [built 2026-11-09: `vh testpool make`, setting TestPool; waits for additive decor stages and growth lineage
     from the helpers before the test] Swap the test village's random buildings for the generated Norse s1d1 to s3d3
     set: a small pool of Norse
     variants in the building pools, so the test covers villagers building, living in, expanding and decorating
     houses, and the role buildings where each role spends its day.
  4. [done 2026-11-09] Evenings at home: no sitting on the floor (only at the earliest stages or with no seats); sit on chairs,
     benches or beds (one per bed), stand and talk, or use shelves, cook stations and stock.
  5. [done 2026-11-09] Hide protector and carer from signs and hover text (internal only).
  6. [done 2026-11-09; small choices in D-076] Role colors and the role set (D-075): carpenter (brown, also cuts wood), smith (charcoal or ore, also mines),
     cook coral, farmer green, guard blue, elder gray, child light blue or pink, leader gold.
  7. [done 2026-11-09] Short hover texts ("at home", "fixing up the home").
  9. [done 2026-11-10, 7d70f54 and a67b3d0] D-076 follow-ups: guards gather by day between watches; the guard on watch fights without an alarm, other
     guards wake at 50 % of his health, all able adults under 25 %; a villager stuck on the way to bed is put in it
     at bedtime even with a player near.
  10. D-077: pre-rolled village roster at settling (families up to 4, elders with elders), first two adults alone in
     their own houses, houses sized for the family to come, beds permanent, children outside the cap.
  11. [part done 2026-11-10: overnight hunting trips, children's colors] D-078: elders mend inside the village, feed animals, forage, help harvest; fish by biome; hunters hunt real game
     or go away overnight with a roll for success, catch, drops and health; healers use potions and healing foods and
     herbs; children light blue or light pink; rafts for fishers only after a feasibility check.
  8. Role touches only through kitbashed role displays that fit many arrangements (D-074).
- [ ] Home life (D-073, built 2026-11-09, not tried in the game): try signs, home decor, evenings and bedtime; get
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
- [ ] Repair for irregular hand builds: learn neighbour patterns across the whole corpus, so builds without a mirror
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

- [ ] Village chronicle read at the hearth (Built 2026-11-06, needs testing.)
- [ ] Mourning when a villager dies (Built 2026-11-06, needs testing.)
- [ ] Night watch by protectors in turn (Built 2026-11-06, needs testing.)
- [ ] Raids at night with a warning at dusk. (Built 2026-11-06; paused by Tyler the same day, `RaidsEnabled` is off.
      Revisit later.)
- [ ] Foraging for food in the Meadows (Built 2026-11-06, needs testing.)
- [ ] Village sign and notice board (Built 2026-11-06, needs testing.)
- [ ] Village types: woodland, fortified, farming (Built 2026-11-06, needs testing.)
- [ ] A chieftain (Built 2026-11-06, needs testing.)
- [ ] Children born to families who grow up (Built 2026-11-06, needs testing.)
- [ ] Villages trading or visiting each other; merchants travelling between villages. (First step 2026-11-07: pedlars
      and pilgrims from the nearest other village, news and relations; see Milestone 7.)
- [ ] Farms (Built 2026-11-06, needs testing.) (Tyler, 2026-11-06): berry and mushroom farms in the Meadows, made by planting the vanilla bush and
      mushroom pickables in rows on a farm plot (they regrow after picking); crops from seeds later (carrots in the
      Black Forest). Saplings replanted where trees were felled (Millénaire's lumbermen plant saplings).
- [ ] A farmer trade: tends and harvests the farms, keeps the chest in food. (Built 2026-11-06, needs testing.)
- [ ] Domesticated animals (Tyler, 2026-11-06): tamed boars and piglets at farms, added on a schedule as the village
      grows (one a day at most, capped by village size), never by feeding or breeding. (Built 2026-11-06, needs
      testing.) Breeding and eating blocked for village animals by Harmony patch, feeding acted out (D-015,
      2026-11-08). Pens, chickens later.
- [ ] Ghostly villagers (Tyler, 2026-11-06; built the same day, needs testing): Valheim is the afterlife, so villages may be echoes or
      memories. Villagers slightly see-through, faintly blue or teal, with a faint glow after dark. Subtle.

## Milestone 7: the world between villages (Tyler, 2026-11-07)

Villages that reach out past their fence, and a world with other people in it. Design and order of work:
`docs/WORLD_LIFE.md`; research in `docs/RELATED_MODS.md` section 5.

- [ ] Travelling pedlars who trade with the village chest and the player (built 2026-11-07, needs testing; `WorldLife`
      off by default, `vh pedlar`).
- [ ] Pilgrims who stay the night by the hearth and bless it (built 2026-11-07, needs testing; `vh pilgrim`).
- [ ] Hermits at camps by ruins who point players to places worth finding (built 2026-11-07, needs testing; `vh hermit`).
- [ ] News that travels between villages with visitors (built 2026-11-07, needs testing; `vh news`).
- [ ] Villagers with their own homeland, food, fear, pastime, hope, friend, rival, yesterday and memories (built
      2026-11-07, needs testing; `vh villager`).
- [ ] Relations between villages that drift day by day (built 2026-11-07, needs testing; `vh village`).
- [ ] Idle villagers watch others work and comment (built 2026-11-07, needs testing).
- [ ] Caravans as records that move on the world clock and become real only near a player. (Built 2026-11-08 night,
      `Caravans.cs`, needs testing.) Since D-008 a caravan is a trader on the trail with his own pack, for players
      (`CaravanDeliveries` off). Still to do: paying him with gifts, a pack animal.
- [ ] Outpost wood counts for the biome rule; villagers go out only once equipped to defend themselves (Tyler,
      2026-11-08). (Built 2026-11-08 night: `OutpostMaterials`, `OutpostGear`; needs testing.)
- [x] ~~Daughter villages founded 600 to 1,200 m away by a full village~~ Dropped by Tyler (D-010): one village
      per site plus resource outposts. `Daughters.cs` kept, `DaughterVillages` off.
- [ ] Groves: a grown village with few trees around it plants more (built 2026-11-08 night, needs testing).
- [ ] Signposts where trails leave a village and halfway along long trails (built 2026-11-08 night, needs testing).
- [ ] Outposts at far resources (core wood, ore, the coast), joined to the village by a path. (Logging camps and trails
      built 2026-11-07, needs testing; `vh outpost`, `vh trails`.)
- [ ] Roads between villages. (Dirt trails to the nearest neighbour built 2026-11-07, needs testing.)
- [ ] Desire paths worn by villagers' feet.
- [ ] A smith who crafts gear from the chest at a real station; villagers take gear from the chest. (Sets per tier
      built 2026-11-07, needs testing; gear in the chest and a village forge to come.)
- [ ] Requests and contracts on the notice board; bounties. (Contracts built 2026-11-08 night, `Contracts.cs`, needs
      testing; bounties to come.)
- [ ] A village events director (feasts, quarrels, a lost villager, a skald). (Built 2026-11-08 night,
      `VillageEvents.cs`, eight kinds, needs testing.)
- [ ] Raids and help between villages by relation. (Raids stay off, D-017; villages are a place of rest.)
- [ ] Skills that grow with practice. (Built 2026-11-08 night, `VillagerSkills.cs`, needs testing.)
- [ ] Wanderers at the longhouse who can be asked to stay. (Newcomer backstories built 2026-11-08 night; the seeker
      who asks a price to stay is still to do.)
- [ ] Proposals from `docs/LIVING_WORLD_RESEARCH.md` (43, ranked): pick the next ones with Tyler.
- [ ] Living village rules from Tyler's decisions (2026-11-08): villagers never leave, elders do not die of age,
      growth is never capped by bosses (D-003, D-004; `VillagersLeave`, `EldersDieOfAge`, `BossStageCap` off,
      code kept). Complaints and asking a player for help stay. Needs testing.

- [ ] True rumours from the land: idle talk, requests and hints come from real locations, spawns, ore and terrain
      around the village (boss hints, animals, dungeons, biome edges, landmarks), firsthand from the villager who saw
      it, then passed on by others (Tyler, 2026-11-08; helper branch night3/knowledge).
- [ ] Village reach grows with stage and gear; villagers only explore and harvest where they can hold their own, and
      only know what lies inside their reach, widened by hunters, trails and outposts (Tyler, 2026-11-08).
- [ ] Map table by the hearth from the hamlet stage: copy the village's discoveries onto your map (Tyler, 2026-11-08).
- [ ] Cultures by biome, up to three per biome, from the Viking-age world (Tyler, 2026-11-08): Meadows norse,
      anglo-saxon, frankish-norman; Black Forest norse-forest, celtic, slavic; Swamp celtic-crannog, baltic, fen-folk;
      Mountains norse-highland, saami (equal weight, D-039); Plains middle-eastern, byzantine, steppe; Mistlands
      byzantine, lamari. No villages in the Ashlands or Deep North. Names, skin tones, looks and a few
      lines per culture (helper branch night3/cultures). Short leader titles: Jarl, Reeve, Lord, Chief, Elder, Sheikh,
      Archon, Beg (D-040).
- [ ] Biome defenders: villagers near the Plains shoot deathsquitos out of the sky; villagers near the Mistlands are
      skilled against and hit harder at Mistlands creatures (Tyler, 2026-11-08).
- [ ] Style guides and lab templates for each culture, learned from Millénaire (allowed for plans, roofs and room uses
      of cultures with little data, Tyler 2026-11-08), Lego and other modular builds, and architecture references
      (helper branch night3/styles).

## Later ideas

- Trading with the player at village shops, as in Millénaire. (First step 2026-11-06: crouch and talk to buy
  what the chest can spare. Next: the village buys what it needs, shops per building.)
- Raids on villages through the game's own random events.
- A mood that speeds or slows work (Millénaire, Hirdmandr).

- Ghost previews of the next building.
- Builders carrying materials from a village store.
- Roads between villages and trade.
- Thunderstore release.
