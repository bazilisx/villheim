---
paths:
  - "src/Villheim.Logic/**"
  - "src/Villheim/**"
---

# Village rules (Tyler's rulings for how villages live)

These load when a session works on the mod's code. The reason behind them all: villages are places of rest, echoes of
the old world in Valheim's afterlife, that grow the way a player would build them.

- **One village per site.** Each village is one primary village plus resource outposts; no daughter villages.
  Villagers never move away and elders do not die (D-003); how a villager's death is handled is open (D-122). Growth
  follows materials, people and needs, never bosses felled (D-003, D-004, D-010; MaxBuildings and MaxVillagers still
  cap it, see D-106).
- **A place of rest.** No raids, feuds, wars between villages, outlaws or thieves; villages never fine, turn away or
  guard against a player by default. A player who harms villagers is warned and banned for some days; one who kills a
  villager is never welcome there again (D-054). Local creatures may wander in and be fought off. Empty villages are
  settled again.
- **Village-built pieces take no water or rain damage** (D-038).
- **Gathering order.** Material on the ground first, then half-harvested work (felled logs, cracked rocks), then fresh
  trees and rocks. Loose sticks and stones (one material each) only when there is nothing bigger to work, and only
  close by. Nobody harvests when the village needs nothing.
- **Building order.** Ground up, every piece supported when placed; doors and windows before what rests on them.
  Every building and amenity (notice boards, fences, chests included) goes up piece by piece from materials in the
  village (Tyler, 2026-11-08). Only `vh` test commands place whole designs at once.
- **Materials as for a player.** Building pieces and paths cost materials; anything the village breaks down returns
  its full materials straight into the chest; trees, rocks and obstacles yield what they yield a player; changing a
  path returns nothing (D-088). Anything brought into the village counts toward what it builds, from villagers,
  outposts or players (D-007, D-024). Open questions on costs: D-100.
- **Village chest.** One main chest by the hearth holds the building materials; the builder builds from it when it
  has enough. If it is destroyed, rebuilding it comes first. Extra storage chests come with growth (one at s1d1, two at
  s1d2, four at s1d3, more with population and need), each labeled with a sign and sorted by material (D-016; the code
  counts buildings standing, see D-104).
- **Animals.** Born on a schedule (new stages, or to replace an adult that died); they never breed by themselves and
  real feed is never used, though villagers may act out feeding. Animals tamed by players behave as in vanilla (D-015).
- **Doorways.** Villagers always use doorways and never use indoor things from outside or through windows. Every door
  is usable by villagers and players. A villager at a blocked entrance opens the door, tries, then passes through the
  blocked doorway; never through a closed door (D-096; built in part).
- **Homes and beds.** Beds and houses are assigned ahead of time by arrival order, never claimed. The roster is rolled
  ahead with family sizes; a first house is big enough for the family still to come. Families have at most 4 people in
  any mix. Four villagers at the start, with no fixed rule that the first ones are single. No house without beds for
  everyone who will live in it. Beds never change hands (D-077, not built yet).
