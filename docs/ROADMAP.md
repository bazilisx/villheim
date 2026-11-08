# Roadmap

Goals and milestones for Villheim, set by Tyler. Tick items off as they are confirmed working in game, and link the
daily note where it happened.

## The vision

Villages like Millénaire's in Minecraft, made only from things already in Valheim and its mods. Millénaire's design
and logic are the main reference for how villages grow, place buildings, assign roles and run their days
(docs/LEARNINGS.md). You come across a
couple of villagers at a hearth. Over the in-game days they gather, build, move into houses and grow into a town
with its own look for its biome.

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
- [ ] Notice board from the `villagenotice` blueprint over the village chest (session 13, needs testing); extra chests
  under it as the village grows; inside the longhouse once there is one.
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
- [ ] Never copy bee hives from designs. (Built 2026-11-05 session 4; a bee hive still appeared in the session 8 test.
      Names containing "hive" are also left out since 2026-11-06, needs testing.)
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
- [ ] Stone building waits until the village advances, at least in the Meadows (Tyler, 2026-11-05; to decide).

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
      (Tyler, 2026-11-05). (Library of about 670 lines in eight voices with chats built 2026-11-06; keep growing it.)
- [ ] Interiors upgrade over time (bed, chests, table, then better furniture). (Built 2026-11-06 by village tier,
      needs testing.)
- [ ] Exteriors upgrade over time (swap a building for a better design of the same role). (Built 2026-11-06: next
      blueprint level or a bigger design, old building taken down first; needs testing.)

## Milestone 5: cultures by biome

- [ ] Different building sets and villager looks per biome (Meadows versus Black Forest first).
- [ ] PlanBuild blueprints as a design source. (Reader built 2026-11-06; needs blueprints in the folder and testing.)
- [ ] Curated blueprint sets for Meadows and Black Forest with upgrade levels (Tyler, 2026-11-06). The OverDrive
      BiomeBlueprints pack works as an optional install (2026-11-06); ask its author lg_9d about a licence for the
      78 generated designs if they are ever to ship. No openly licensed
      set was found online; capture with `vh savebp` or PlanBuild, or use downloads with the author's permission.
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
      testing.) Pens, chickens later.
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
- [ ] Caravans as records that move on the world clock and become real only near a player.
- [ ] Outposts at far resources (core wood, ore, the coast), joined to the village by a path. (Logging camps and trails
      built 2026-11-07, needs testing; `vh outpost`, `vh trails`.)
- [ ] Roads between villages. (Dirt trails to the nearest neighbour built 2026-11-07, needs testing.)
- [ ] Desire paths worn by villagers' feet.
- [ ] A smith who crafts gear from the chest at a real station; villagers take gear from the chest. (Sets per tier
      built 2026-11-07, needs testing; gear in the chest and a village forge to come.)
- [ ] Requests and contracts on the notice board; bounties.
- [ ] A village events director (feasts, quarrels, a lost villager, a skald).
- [ ] Raids and help between villages by relation.
- [ ] Skills that grow with practice.
- [ ] Wanderers at the longhouse who can be asked to stay.

## Later ideas

- Trading with the player at village shops, as in Millénaire. (First step 2026-11-06: crouch and talk to buy
  what the chest can spare. Next: the village buys what it needs, shops per building.)
- Raids on villages through the game's own random events.
- A mood that speeds or slows work (Millénaire, Hirdmandr).

- Ghost previews of the next building.
- Builders carrying materials from a village store.
- Roads between villages and trade.
- Thunderstore release.
