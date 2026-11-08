# World life

Reference for the systems that make the world between the villages feel lived in: visitors, hermits, news,
personalities, relations between villages, and the plan for outposts, roads between villages, caravans, gear crafting
and quests. What is built is marked; the rest is a plan in order of value. Research behind it: the 2026-11-08 survey in
`docs/RELATED_MODS.md` and the Millénaire notes in `docs/MILLENAIRE.md`. Ideas only from GPL, All Rights Reserved and
unlicensed sources; code only from the MIT and Unlicense projects listed at the end, with their notices.

## Built (2026-11-07 overnight session, not yet tested in game)

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
| Smith | `Villagers/Smithing.cs` | Gear tier = min(size tier, armoury tier). Sets per tier: leather; flint spear and leather helmet; troll leather; bronze chest, spear and buckler. Costs and station from `ObjectDB.GetRecipe`. The carpenter (or builder before trades) works 20 s at the station when the chest has the set's materials; the chronicle records it. No station (forge for bronze): a pedlar sells the tier for 40 coins a tier from the chest. `SmithMakesGear` (on by default, config 3b); villages from before keep their tier. The pedlar never takes the smith's materials as payment. |
| Outposts | `Village/Outposts.cs` | With WorldLife and `Outposts` on: a village with 4 buildings and 4 villagers plans a logging camp 150 to 700 m out, 25 m inside the nearest Black Forest (core wood, for a Meadows village) or Meadows (fine wood, for a Black Forest village), from world generator heights. Camp (fire pit and two campers of kind `camper`) made on the host when a player is within 150 m. 10 wood a day into the village stock, up to three days caught up. `vh outpost`. |
| Trails | `Village/Trails.cs` | With WorldLife and `Trails` on: A* from world generator heights to the outpost and the nearest neighbour within 2,500 m (planned by the lower village id), kept on the hearth ZDO, painted as dirt within 50 m of the player, 40 spots each ten seconds. `vh trails`. |
| Lines | `Dialogue/wanderers.txt`, `Dialogue/personal.txt` | About 260 new lines. Wanderer sections need the tag `wanderer`; fill-ins can start a sentence (capitalised after filling). |

Commands: `vh pedlar`, `vh pilgrim` (nearest village within 200 m), `vh hermit` (camp in front of you),
`vh wanderers` or `vh news`. `vh villager` shows the personality line, `vh village` the neighbours.

Known limits: hermit camps need a host (no dedicated server yet). Wanderers have no weapon; the game's AI fights for
them (Dverger faction). Visitors walk only while their zone is loaded. A pedlar's chest trade ignores the biome rule
for materials only in the sense that it brings what the village already needs.

## Built (2026-11-08 night, villager minds; compiles, not yet tested in game)

All logic only (hot-reloads), on whether or not `WorldLife` is on. Nothing here could be tried in the game that
night; every part needs a test. Research behind it: section 6 of `docs/RELATED_MODS.md`.

| Part | File | What it does |
|---|---|---|
| What villagers see | `Villagers/Context.cs` | Tags worked out at most every 3 s per villager. Place: at the hearth (6 m), forge, workbench, cauldron, stonecutter (5 m), a fire (4 m), the chest (4 m), the shore (ground under water level within 10 m), home (8 m), the edge (past 0.7 of the village radius), outside (past 1.2), indoors. Sky: storm, rain, snow, mist, clear; dawn, midday, dusk, late night; a young or old world. Bosses felled (global keys). Animals and enemies within 40 m, tame ones apart, and `fearnear` when the nearest enemy is the villager's own fear. The player within 15 m: hurt, wet, cold, poisoned, burning, rested, sneaking, a heavy pack, what is in his hand, his chest armour (none to padded), a cape, boss trophies, 20 or more wood or stone, food, skills at 50 or more. Fill-ins {place} {beast} {playergear} {playerweapon} {lastboss} {daypart} {weather}. |
| Topic fatigue | `Villagers/Dialogue.cs` | Plan item 1, after MCA. Each section the player hears a line from (within 20 m) gets +1 fatigue, which wears off one point every 150 s (two game hours); its weight is divided by 1 + 0.8 x fatigue. Together with the place tags this is item 1. |
| Memory of the player | `Villagers/PlayerMemory.cs` | On the hearth, per player: days visited, the day before this visit, gifts and their total, pieces built within the village (a patch on `Piece.SetCreator`), kills within it (a patch on `Character.OnDeath`, the last creature and the last big one), deaths there (`Player.OnDeath`), fights beside the village, requests done, villagers hit (`Character.Damage`, -2 reputation; killing one -15), tame animals killed, and the chest armour last worn (better gear is noticed). Tags `pmem:...`. |
| Word passing on | `Villagers/PlayerMemory.cs` | After Minecraft's gossip. Villagers within 25 m of a deed saw it (remembered 2 to 20 days by deed); in a chat the speaker passes on what the listener doesn't know, for half the time it had left (at most two days), and the opening line can be about it (`tell:x`). Tags `saw:x`, `heard:x`, `knows:x`; fill-in {teller}. |
| Skills | `Villagers/VillagerSkills.cs` | Plan item 11. Nine skills, 0 to 100, in the ZDO; a start from the seed (0 to 15) and +20 in the trade. Every 30 s of work: +0.6 x learning rate x (1 - level/120); the partner skill +a fifth, the opposite -8%. Watching work teaches 15% of a step. Felling and mining blows and the time per building piece scale 0.8 to 1.3 with skill. A good day once a day at (mood - 60)% chance: +25% speed. Each tenth point a mood lift (+4) and a line; 50 and 75 go in the chronicle. |
| Wants | `Villagers/Goals.cs` | After The Sims. One want at a time for 2 to 6 days: a bed, a bigger house, to learn the weakest skill (+6), to reach the next tenth in the best one, to court a friend liked above 0.5 (five chats, then sweethearts in both ZDOs and the chronicle), peace with a rival (three chats), a feast, news (a visitor), a hunt, a quiet day, the player back. Met: +8 for half a game day and a line; given up: -3. |
| Gatherings | `Villagers/Gatherings.cs` | Plan item 2. A finished building, a newcomer, a pedlar or pilgrim: up to eight idle villagers within 70 m come and stand round, a speaker (the Jarl, an elder, or the nearest) speaks, the rest cheer, one or two speak after 12 to 16 s; one turnout per village every two minutes. A hunt, a birth, a finished building, an upgrade or a felled boss makes the evening a feast (half the ring up, more dancing, +6). Evening words between 18:00 and 19:30 with a player by the hearth. |
| Noticing | `Villagers/Noticing.cs` | Every 2 s with a player within 60 m and no fight in the last 30 s: rain, storm, snow and mist starting and rain stopping (4 min apart), dawn and dusk, a boss felled (chronicle, +8 for everyone, a feast), a weapon out within 5 m by day (Gothic), the player sneaking, a boss trophy in the pack (once in 20 minutes), animals within 30 m and enemies at 25 to 50 m before they come close. |
| Idle glances | `Villagers/IdleLife.cs` | Standing villagers (strolling, between jobs, up at the evening fire) glance for 1.5 to 3.5 s every 5 to 14 s at a neighbour, the player, an animal, the sky in rain or storm, the fire (hands out to it when cold or at night), or about; a stretch once some mornings. Sitters keep still. |
| Chats of two and three | `Villagers/FreeTime.cs`, `Dialogue.cs` | Pair tags on the chat opening (`with:friend`, `with:rival`, `with:sweetheart`, `with:courting`, `with:sametrade`, `with:trade:x`, `with:voice:x`, `with:child`, `with:newcomer`, `with:jarl`, `with:hurt`, `with:sad`, `with:happy`, `with:skilled`). A part `@key` is answered from `answer:key` sections in the answerer's own voice and state; `+key` brings in a third villager within 9 m (`chime:key`). |
| Newcomers' stories | `Villagers/Personality.cs` | Part of plan item 12: a villager who came from outside is a `newcomer` for three days and tells why he left home ({whyleft}, fifteen reasons by seed). The day of arrival is set in `VillageBrain`'s arrival code. |
| Lines | `Dialogue/places.txt`, `sky.txt`, `player.txt`, `memory.txt`, `wants.txt`, `gatherings.txt`, `scenes.txt`, `chatter.txt` | 1,211 new lines (1,780 before, 2,991 after); each file lists its tags at the top. Sections that fit almost always (the player's gear, how often he visits, a villager's best skill) carry a lower weight so they don't crowd out the moment. |

Commands: `vh minds` (the nearest villager's skills, want, what he knows of you and from whom, what he sees, the
village's record of you, the topics you have heard most), `vh feast`, `vh speech`, `vh goal [kind]`,
`vh notice <event>`.

Known limits: per-player fatigue lives on the client and is lost on a reload. The memory of the player is written
to the hearth's ZDO by whichever client sees the deed, as `Social` already does. Kills only count when the local
player's hit was the last one. Villagers know deeds by player name.

## Next, in order

Effort is a rough guess: S an evening, M a session or two, L several sessions.

1. **Dialogue fallback chains and per-player fatigue (S).** Built 2026-11-08 night (topic fatigue in `Dialogue.cs`,
   place tags in `Context.cs`). Still to do: a dock tag once villages have docks, and keeping fatigue across reloads.
2. **Gatherings (S).** Built 2026-11-08 night (`Gatherings.cs`): turnouts, feasts at the hearth, evening words.
   Still to do: the feast in the longhouse itself once villagers use its benches and tables, and food taken from the
   chest for it.
3. **Caravans as records (M).** Living Factions keeps travelling bands as data (position, target, people, state) and
   moves them at a set pace (2,400 m a day) while no one is near; within about 130 m of the nearest player they become
   real NPCs, and despawn past 200 m. Do the same for a pedlar's route between two hearths: the record moves on the
   world clock, a real pedlar (and a tamed boar or lox as pack animal later) appears when a player is close to the
   route. Millénaire's merchants pick the next village by what it lacks, stay two nights, and carry goods from one
   village's store to the next: route surplus from the village that has it to the one that needs it.
4. **Outposts, second step (L).** First version built (logging camps, daily haul). Still to do: Millénaire hamlets and Living Factions outposts: a small owned camp where the land gives what home
   lacks (core wood in the Black Forest for a Meadows village, copper, tin, a fishing spot on the coast), at most two
   per village, one or two huts and the trade's workshop, never growing into a village. Two villagers live there, carry
   stock home when it passes a set amount (Living Factions: 12), and a path joins it to the village. Site rules from
   Living Factions: dry ground at least 1.5 m above water, one biome, two rings of eight height samples within
   2 + 0.2 r m, clear of vanilla locations, more than r + 60 m from any player while it is placed. Designs: small Work
   designs from the board (Mining, Woodworking, Harbour). The biome rule then reads "a village builds with what its
   biome and its outposts give".
5. **Roads between villages (M to L).** First version built (`Trails.cs`: runtime, dirt only). Still to do: widen and
   pave busy trails, signposts at junctions, road posts halfway on long trails. The other route:
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
7. **A smith who makes gear (M).** First version built (`Smithing.cs`, sets per tier). Still to do: a village forge so
   bronze can be made at home, gear kept in the chest and taken by each villager, repairs. The full plan: a smith trade
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
11. **Skills that grow (M).** Built 2026-11-08 night (`VillagerSkills.cs`). Still to do: a cap from the home's level,
    children starting from their parents' skills (no parent records yet), output (not only speed) by skill, and trades
    chosen by skill once a village has them.
12. **Newcomers at the longhouse (S).** MineColonies taverns: wanderers sit in the longhouse with a backstory line and
    a price to stay (mead, a hide, coins). A way for villages to grow beyond births and the empty-bed arrivals. The
    backstory part is built (2026-11-08 night: `newcomer` tag and {whyleft} for three days after arriving); the
    seeker who waits in the longhouse and the price to stay need a new wanderer kind in `WorldLife.cs` and are left
    for the world-growth work.

## Sources that allow copying

| Project | Licence | Worth reading |
|---|---|---|
| ProceduralRoads (jneb802) | MIT | `RoadPathfinder.cs`, `RoadTerrainModifier.cs`, the `ZoneSystem` patches |
| AntTrails (egaroib) | MIT | `TrailEngine.cs`, `TerrainPainter.cs` |
| Offline Companions Reborn (MaddhattrRocks) | MIT | `SpeechConfig.cs`, `CompanionTalk.cs` (tagged barks, priority queue), `RepairController.cs` |
| CustomRaids (ASharpPen) | Unlicense | raid manager and `RandEventSystem` patches |

Anything copied keeps its licence notice in `THIRD_PARTY_NOTICES.md`. Living Factions, TraderQuests, Norsemen and
ServerGuide have no licence file and Millénaire is All Rights Reserved: ideas only. Clones for study go in `/tmp`.
