# Roadmap

Goals and milestones for Villheim, set by Tyler. Tick items off as they are confirmed working in game, and link the
daily note where it happened.

## The vision

Villages like Millénaire's in Minecraft, made only from things already in Valheim and its mods. You come across a
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
- [ ] Movement without jitter: stand spots, steady goals, unstuck jump and sidestep. (Built 2026-11-05, needs testing.)
- [ ] Trees felled away from the village.
- [ ] Right tool for each job: hammer to build, axe for trees, pickaxe for rocks. (Built 2026-11-05 session 4,
      needs testing.)
- [ ] Villagers open and close doors. (Built 2026-11-05 session 4, needs testing.)
- [ ] Support-aware build order: nothing goes up unsupported; openings before what rests on them. (Built 2026-11-05
      session 4, needs testing.)
- [ ] Never copy bee hives from designs. (Built 2026-11-05 session 4; a bee hive still appeared in the session 8 test.)
- [ ] Villagers gather from nothing for their first building (no free starting stock). (Built 2026-11-05 session 5,
      needs testing.)
- [ ] No swings from a distance: reach checked against the real surface before every blow. (Built 2026-11-05
      session 5, needs testing.)
- [ ] Smooth walking: own brain outside fights, player speeds, no shoving. (Built 2026-11-05 session 5, needs
      testing.)

## Milestone 3: a village that looks planned

- [ ] Central hub first (tavern or longhouse), then houses, workshops (carpentry, forge) and farms.
- [ ] Paths from a grid search that join into streets (replacing the L-shaped paths).
- [ ] Earth floor painted under buildings.
- [ ] Millénaire-like alignment: buildings face the streets.
- [ ] Buildings stay close: houses orbit the hearth within a set distance; specialty buildings go a bit farther out or
      next to their resource (mining nodes, water), always inside a maximum radius (Tyler, 2026-11-05).
- [ ] Ground first: every site is flattened before the first piece goes up (Tyler, 2026-11-05).
- [ ] Paths are laid by a villager walking the route, one stretch at a time (Tyler, 2026-11-05).
- [ ] Repairs: villagers fix broken pieces, structural first (flatten under ground pieces), cosmetic later (Tyler,
      2026-11-05).
- [ ] Stone building waits until the village advances, at least in the Meadows (Tyler, 2026-11-05; to decide).

## Milestone 4: villagers with lives

- [ ] One small house per villager household; newcomers only arrive for a free bed, by day, walking in from the edge.
- [ ] Free time: fire, sitting, strolls, chats, keeping busy at stations, gestures by village mood. (Built 2026-11-05
      session 5, needs testing.)
- [ ] Evening ring at the hearth, sitting and resting by the fire at night. (Built 2026-11-05 session 5, needs
      testing.)
- [ ] Sit on the village's chairs and benches; sleep in beds.
- [ ] Villagers with nothing else to do make a fire pit, cooking station, workbench and benches by the hearth.
      (Built 2026-11-05 session 5, needs testing.)
- [ ] Villagers cook for real at the hearth's cooking station.
- [ ] Enough in the chest means no harvesting: villagers switch to two roles, builder and crafter/interior designer
      (Tyler, 2026-11-05).
- [ ] Crafted pieces follow the game's rules: workbenches and other crafting stations go under a roof (inside a
      village building) so they are usable; the workbench made outside in the test is not (Tyler, 2026-11-05).
- [ ] Hurt villagers put healing first: cook food at the hearth and eat it; with no cooking station, make one first
      (Tyler, 2026-11-05). (Basic version built 2026-11-05 session 7: kneel and cook at the hearth, raw meat from the
      chest heals more. Real cooking on the station and making one first are still to do.)
- [ ] Villagers never walk or run through a fire: the hearth, fire pits and campfires are kept out of every walk,
      including straight steps (door passes, last metres to a tree) (Tyler, 2026-11-05).
- [ ] Every building site is flattened where needed before and while building, beyond the design's own terrain
      shaping and the simple pad (Tyler, 2026-11-05).
- [ ] The hearth upgrades over time as the village grows (Tyler, 2026-11-05): campfire, then a hearth with the
      cooking station over it, then larger vanilla fire pieces; the cooking station is part of the hearth, not a
      separate fire. (Cooking station moved onto the hearth 2026-11-05 session 7; upgrades not started.)
- [ ] One task at a time: pieces only appear while the builder stands next to them; a fight pauses the build or path,
      which resumes afterwards (Tyler, 2026-11-05).
- [ ] Protector and carer roles: assigned at random, never by gender; new arrivals alternate protector, carer,
      protector. Roles do not limit jobs; they show in idle time and emergencies. When attacked, protectors take basic
      weapons and defend (Tyler, 2026-11-05).
- [ ] Dialogue about what villagers are doing, want and need, with conditions; grow into a large library of lines
      (Tyler, 2026-11-05).
- [ ] Interiors upgrade over time (bed, chests, table, then better furniture).
- [ ] Exteriors upgrade over time (swap a building for a better design of the same role).

## Milestone 5: cultures by biome

- [ ] Different building sets and villager looks per biome (Meadows versus Black Forest first).
- [ ] PlanBuild blueprints as a design source.
- [ ] More biomes (Plains, Mountain, Swamp) with their own materials.
- [ ] Gear by biome and village level: basic Meadows tools for everyone, biome weapons and shields for protectors,
      better materials and Black Forest gear as the village levels up (Tyler, 2026-11-05).

## Later ideas

- Ghost previews of the next building.
- Builders carrying materials from a village store.
- Roads between villages and trade.
- Thunderstore release.
