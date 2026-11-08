# World life

Reference for the systems that make the world between the villages feel lived in: visitors, hermits, news,
personalities, relations between villages, and the plan for outposts, roads between villages, caravans, gear crafting
and quests. What is built is marked; the rest is a plan in order of value. Research behind it: the 2026-11-08 survey in
`docs/RELATED_MODS.md` and the Millénaire notes in `docs/MILLENAIRE.md`. Ideas only from GPL, All Rights Reserved and
unlicensed sources; code only from the MIT and Unlicense projects listed at the end, with their notices.

## Built (2026-11-07 late session, not yet tested in game)

All of it is logic only (hot-reloads). Visitors and hermits only appear with `WorldLife` on (config section
"5 - World life", off by default during the design review). The test commands work either way.

| Part | File | What it does |
|---|---|---|
| Wanderer brain | `Villagers/Wanderers.cs` | Villager prefab with village id 0 and a `villheim_wanderer` kind (pedlar, pilgrim, hermit). Own routine, hover, talk, store; Shift + Use trades. Removed once done (or three days old) when no player is within 70 m. |
| Visitors | `Village/WorldLife.cs` | Ten-second check on the hearth owner with a player within 120 m. Pedlar 08:00 to 15:00, pilgrim 17:00 to 20:00, no rain, at most one per `DaysBetweenVisitors`, `VisitorChancePerDay` spread over the hours. Spawn 75 to 95 m out toward the nearest other village, within 110 m of the player. |
| Pedlar trade | `WorldLife.TradeWithChest` | Brings up to 15 of what the village is shortest of (VillageNeeds), paid from chest coins, then spare goods (Market's list and prices); at least 2 as a sweetener. Player wares by biome, six per pedlar from his seed. |
| Pilgrim | `Wanderers`, `WorldLife.Blessing` | Sits by the hearth through the night, leaves at 06:00 with a blessing: mood thought `blessing` (+6 for half an hour of game time) for everyone. |
| Hermits | `WorldLife.MaybeMakeCamps` | Host only. `HermitChance` percent of `HermitPlaces` locations (picked by position) in `HermitBiomes`, 400 m from any village site, get a `fire_pit` camp 18 to 28 m out and a hermit who keeps it fuelled. A dead hermit is replaced after three days (counted from the saved objects). Talk: once per player, the nearest unpinned place from a list (Haldor, Hildir, the bog witch, boss altars, crypts, troll caves, frost caves) gets a map pin and a line. |
| News | `WorldLife.NoteNews`, `CarryNews` | Village events (finished, arrival, birth, death, fight driven off, hunt, upgrade) go on the hearth's news list (six kept). A visitor from a village copies its two newest items into the host village's "heard" list (eight kept). Tag `news`, fill-in `{news}`. |
| Personality | `Villagers/Personality.cs` | From the seed: homeland, favourite food, fear, pastime, hope. Friend and rival from a fixed pair liking plus chats. Yesterday's main activity (sampled every 30 s, kept in the ZDO). Village events remembered two to five days (`mem:x`). Day tags `restday`, `tenthday`. |
| Relations | `Village/Relations.cs` | Each village's view of each other village (-100 to 100), Millénaire's daily drift that leans toward where it stands, +3 per visitor from there, band changes in the chronicle. Tags `neighbour:<band>`, fill-in `{neighbour}`. |
| Watching | `Villagers/FreeTime.cs` (Kind.Watch) | After Millénaire's observe goals: an idle villager walks to 3.5 m from a neighbour who is building, felling, cooking, mining, farming, repairing, laying a path or fencing (within 35 m), or a pedlar or pilgrim (within 40 m, weighted higher), watches 35 to 70 s and may comment (tags `watching`, `watch:<work>`, fill-in `{watched}`). |
| Lines | `Dialogue/wanderers.txt`, `Dialogue/personal.txt` | About 260 new lines. Wanderer sections need the tag `wanderer`; fill-ins can start a sentence (capitalised after filling). |

Commands: `vh pedlar`, `vh pilgrim` (nearest village within 200 m), `vh hermit` (camp in front of you),
`vh wanderers` or `vh news`. `vh villager` shows the personality line, `vh village` the neighbours.

Known limits: hermit camps need a host (no dedicated server yet). Wanderers have no weapon; the game's AI fights for
them (Dverger faction). Visitors walk only while their zone is loaded. A pedlar's chest trade ignores the biome rule
for materials only in the sense that it brings what the village already needs.

## Next, in order

Effort is a rough guess: S an evening, M a session or two, L several sessions.

1. **Dialogue fallback chains and per-player fatigue (S).** MCA resolves a line key from most specific to least
   (trade.voice.key, voice.key, trade.key, key) with numbered variants, and lowers the weight of topics a player has
   heard a lot (fatigue +1 per talk, -1 every in-game hour). Villheim's tag sections already do most of this; add a
   per-player recent-topic count that lowers a section's weight, and lines bound to a spot (at the forge, the dock, the
   fire), as Stardew does with location keys.
2. **Gatherings (S).** Built on watching: the whole village turns out for a finished building, a newcomer or a pedlar
   (Millénaire's listen_to_speech gathers people for a speech at set hours); a feast at the longhouse after a good hunt.
3. **Caravans as records (M).** Living Factions keeps travelling bands as data (position, target, people, state) and
   moves them at a set pace (2,400 m a day) while no one is near; within about 130 m of the nearest player they become
   real NPCs, and despawn past 200 m. Do the same for a pedlar's route between two hearths: the record moves on the
   world clock, a real pedlar (and a tamed boar or lox as pack animal later) appears when a player is close to the
   route. Millénaire's merchants pick the next village by what it lacks, stay two nights, and carry goods from one
   village's store to the next: route surplus from the village that has it to the one that needs it.
4. **Outposts (L).** Millénaire hamlets and Living Factions outposts: a small owned camp where the land gives what home
   lacks (core wood in the Black Forest for a Meadows village, copper, tin, a fishing spot on the coast), at most two
   per village, one or two huts and the trade's workshop, never growing into a village. Two villagers live there, carry
   stock home when it passes a set amount (Living Factions: 12), and a path joins it to the village. Site rules from
   Living Factions: dry ground at least 1.5 m above water, one biome, two rings of eight height samples within
   2 + 0.2 r m, clear of vanilla locations, more than r + 60 m from any player while it is placed. Designs: small Work
   designs from the board (Mining, Woodworking, Harbour). The biome rule then reads "a village builds with what its
   biome and its outposts give".
5. **Roads between villages (M to L).** Two routes:
   - Runtime, after Living Factions: each village links to its nearest reachable neighbour, A* on an 8 m grid in an
     ellipse corridor (2.2 times the straight distance, 40,000 nodes at most), never across water, price
     step x (1 + 12 grade squared). Paint only within 80 m of a player on loaded zones, 60 points a pass, with the same
     `TerrainComp` operations `PathBuilder.cs` already uses. Villheim's `PathPlanner` already has A* with slope cost.
   - World generation, after ProceduralRoads (MIT): roads planned once from `WorldGenerator` heights and written into
     `TerrainComp` as zones spawn, trees kept off the road by a `ClearArea` in `PlaceVegetation`. Heavier, but roads
     exist before anyone walks there.
   Then road posts (a watchtower design halfway on a long road) and signposts at junctions.
6. **Desire paths (M).** AntTrails (MIT): footsteps counted per terrain tile, 25 steps make a dirt path, unfinished
   charge fades over 12 days, finished paths fade over 30 days to a trace, very busy tiles can turn to stone. Feed it
   villager footsteps and villages wear their own paths between doors, the chest, the farms and the hearth.
7. **A smith who makes gear (M).** No published Valheim mod has NPCs craft gear from materials. Plan: a smith trade
   (from the Workshop subtype) runs a real recipe (`ObjectDB.GetRecipe`, `m_resources`, `m_minStationLevel`) at a
   village forge or workbench that passes `CheckUsable`, takes the materials from the chest, plays the station's craft
   effect, and puts the item in the chest; protectors and workers then take their weapon, shield, tool and armour from
   the chest. The forge level caps the tier (MineColonies caps equipment by building level). Gear tiers by village
   tier stay as the fallback. Repairs after Offline Companions Reborn (MIT): worn items repaired at a station that can
   repair them.
8. **Requests and contracts (M).** Notice board work for players: Millénaire quests (chance per hour, minimum
   reputation, steps with goods, a time limit, reputation gained or lost) and MineColonies two-villager favours ("take
   this to my brother at the outpost", both moods up for a week). Bounties that only exist on paper until the player
   arrives (TraderQuests: a pinned spot, the target spawned when the player comes near). Social.cs already has a daily
   material request to build on.
9. **Village events director (M).** Living Factions rolls 3.5% a day per settlement for a good harvest, sickness, a
   beast attack or newcomers; RimWorld spends an event budget that grows with wealth. A small director per village:
   feasts after a good harvest, a quarrel between rivals, a lost villager found by the player, a visiting skald. Raids
   go through the game's `RandEventSystem` (CustomRaids, Unlicense, shows how to add `RandomEvent`s and centre them on
   a point).
10. **Raids and help between villages (M).** With relations in place: below -50 a village may send a raid party to a
    neighbour (Millénaire picks targets weaker than the raider), above 70 it sends help when the neighbour is attacked.
    Needs caravans as records first.
11. **Skills that grow (M).** MineColonies: each trade has a primary and secondary skill; practice raises them, the
    opposite skill slips a little, the home's level caps them, and children start from their parents' skills. Work
    speed and output scale with skill, so villagers grow apart over time.
12. **Newcomers at the longhouse (S).** MineColonies taverns: wanderers sit in the longhouse with a backstory line and
    a price to stay (mead, a hide, coins). A way for villages to grow beyond births and the empty-bed arrivals.

## Sources that allow copying

| Project | Licence | Worth reading |
|---|---|---|
| ProceduralRoads (jneb802) | MIT | `RoadPathfinder.cs`, `RoadTerrainModifier.cs`, the `ZoneSystem` patches |
| AntTrails (egaroib) | MIT | `TrailEngine.cs`, `TerrainPainter.cs` |
| Offline Companions Reborn (MaddhattrRocks) | MIT | `SpeechConfig.cs`, `CompanionTalk.cs` (tagged barks, priority queue), `RepairController.cs` |
| CustomRaids (ASharpPen) | Unlicense | raid manager and `RandEventSystem` patches |

Anything copied keeps its licence notice in `THIRD_PARTY_NOTICES.md`. Living Factions, TraderQuests, Norsemen and
ServerGuide have no licence file and Millénaire is All Rights Reserved: ideas only. Clones for study go in `/tmp`.
