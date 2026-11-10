# Questions for Tyler (rows for the Decisions tab)

Not entered in the sheet: this session could not read or write its rows. Give each the next free D-number.
Asked 2026-11-09, Status Open unless marked.

| Topic | Question | Options and recommendation | Tonight's working answer (in the code) |
|---|---|---|---|
| Clearing | What size of boulder blocks a plot? | A: 12 m across or more (about a house). B: 8 m. C: 16 m. Recommend A. | A (`BoulderStaysFrom` 12). Tyler said "house size or larger"; the number is a guess. |
| Spacing | How much clear ground between two buildings? | A: 2.5 m between footprints (room for a path). B: 1.5 m (eaves nearly touch). C: 4 m. Recommend A. | A (`BuildingGap` 2.5). |
| Spacing | Should a building keep room for its last stage? | A: yes, neighbors keep off the ground it will cover at s3, so it can always grow where it stands. B: no, pack by today's size; later homes stand 26 to 32 m out in the packing test where A gives 44 to 52 m, and some buildings will find no room to grow. Recommend A, with B as a setting. | A (`ReserveGrowthRoom` true). |
| Spacing | How near the hearth may a wall stand? | A: the dirt circle (10 m) plus 4.5 m. B: plus 3 m. C: plus 6 m. Recommend A. | A (`HearthMargin` 4.5), from "perhaps 15 feet". |
| Layout | Should workshops and farms start nearer the hearth? | Today's rings by share of the radius: homes from 0.1, workshops from 0.3 (was 0.45), farms from 0.4 (was 0.45). A: as now. B: one ring for all, order by build time only. C: back to 0.45. Recommend A. | A. |
| Clearing | Which of the game's structures may villagers take down? | A: small places (30 m or less) with no interior, outside a protected list (start stones, boss altars, traders, rune stones, dolmens, ship settings, towers, forts). B: A plus towers and forts. C: only places named on a list. Recommend A. | A (`ClearRuins`, `RuinMaxRadius`, `ProtectedPlaces`). |
| Clearing | Is a plot cleared at once when ground is broken, or by villagers? | A: at once, as trees are today. B: villagers chop, mine and take the ruin down piece by piece before building starts (slower, shows the work, matches "nothing appears or vanishes by itself"). Recommend B as the next step. | A (unchanged behavior, now also for ruins). |
| Clearing | What does a village get from a ruin? | A: half the materials of each piece. B: all. C: none. Recommend A (same as taking down its own fence). | A. |
| Hold-ups | Where should "no room" show? | A: the hearth's hover (done) and one line on the notice board. B: also a message to nearby players when it first happens. Recommend A. | Hover only so far. |
| Spot tool | Which item is the plot tool? | KnifeWood is already the Shaper Tool (`vh tool`). A: a second mode of that knife. B: another vanilla item (a hoe or a torch) made at the notice board. C: KnifeWood for plots, Shaper Tool moves. Recommend A. | Commands only: `vh plot check`, `here`, `clear`. |
| Spot tool | What does the preview show? | A: the building's rectangle on the ground, green when it fits, red when it does not, with the reason on screen. B: also the door side and the hearth's kept circle. Recommend B. | Backend returns the rectangle and the reason. |
| Spot tool | May a hand-picked spot override a refusal? | A: never; it must pass the same tests. B: it may override "too near another building" down to 1 m and "too steep" up to 5 m. Recommend A first. | A. |
| Spot tool | Who may choose a plot? | A: any player the village counts as a friend. B: any player. C: admins only. Recommend A. | The command is open to anyone with the console. |
| Generator | May a store room's sign go up in the Meadows? | The decorator dates signs to the Black Forest (coal); the village already makes house signs and storage signs in the Meadows. A: yes for labels. B: wait for D-080. Recommend A. | A, for store room labels only. |
| Generator | Minor decor and biomes | `decorate.js` refuses any piece from a later biome, while the checks allow minor decor from any biome (D-066). This is why Meadows rooms never get banners, pots or signs from the decorator's own rules. Tied to D-080. | Unchanged. |
