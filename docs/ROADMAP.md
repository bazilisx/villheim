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
- [ ] Site chest next to every building in progress. Villagers deliver to it, the builder takes from it, players can
      add to it. (Built 2026-11-05, works in first test.)
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
- [ ] Never copy bee hives from designs. (Built 2026-11-05 session 4, needs testing.)
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

## Milestone 4: villagers with lives

- [ ] One small house per villager household; newcomers only arrive for a free bed, by day, walking in from the edge.
- [ ] Free time: fire, sitting, strolls, chats, keeping busy at stations, gestures by village mood. (Built 2026-11-05
      session 5, needs testing.)
- [ ] Evening ring at the hearth, sitting and resting by the fire at night. (Built 2026-11-05 session 5, needs
      testing.)
- [ ] Sit on the village's chairs and benches; sleep in beds.
- [ ] Villagers build a cooking fire and cooking station by the hearth, and cook for real.
- [ ] Interiors upgrade over time (bed, chests, table, then better furniture).
- [ ] Exteriors upgrade over time (swap a building for a better design of the same role).

## Milestone 5: cultures by biome

- [ ] Different building sets and villager looks per biome (Meadows versus Black Forest first).
- [ ] PlanBuild blueprints as a design source.
- [ ] More biomes (Plains, Mountain, Swamp) with their own materials.

## Later ideas

- Ghost previews of the next building.
- Builders carrying materials from a village store.
- Roads between villages and trade.
- Thunderstore release.
