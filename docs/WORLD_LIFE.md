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

Commands (2026-11-07): `vh pedlar`, `vh pilgrim` (nearest village within 200 m), `vh hermit` (camp in front of you),
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
| Gatherings | `Villagers/Gatherings.cs` | Plan item 2. A finished building, a newcomer, a pedlar or pilgrim: up to eight idle villagers within 70 m come and stand round, a speaker (the Jarl, an elder, or the nearest) speaks, the rest cheer, one or two speak after 12 to 16 s; one turnout per village every two minutes. A hunt, a birth, a big finished building (D-005), an upgrade or a felled boss makes the evening a feast (half the ring up, more dancing, +6). Evening words between 18:00 and 19:30 with a player by the hearth. |
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

## Built (2026-11-08 night, world growth; compiles, not yet tested in game)

All logic only (hot-reloads), all in config section "5 - World life", all behind WorldLife (off by default during
the design review) and each behind its own switch (on by default). The `vh` commands work with WorldLife off, for
testing. Research behind it: section 7 of `docs/RELATED_MODS.md`. Nothing here was run in the game: the build was
checked with `scripts/build-cloud.sh` only.

| Part | File | What it does |
|---|---|---|
| Gear before the wilds | `Village/Outposts.cs`, `Villagers/Smithing.cs` (`Armoury`) | Tyler's rule of 2026-11-08: no camp in a biome before the village has made the gear tier `OutpostGear` asks for there (Meadows 0, Black Forest 2 flint and leather, Swamp, Mountain and Plains 4). Until then the chronicle says what it waits for, every five days, and `vh village` shows it. |
| Outpost materials | `Village/Materials.cs` (`From`), `Village/VillageBrain.cs` | Tyler's rule of 2026-11-08: the biome rule reads "a village builds with what its biome and its outposts give". While the brain ticks a village, `Materials.AllowedIn` adds what its camps send (`OutpostMaterials`). A Meadows village with a Black Forest logging camp can pick designs that need core wood. |
| Outposts, second step | `Village/Outposts.cs` | Up to `OutpostsPerVillage` (2) camps, one of each kind: the logging camp as before, and a flint camp on the nearest shore (1 to 3 m above water, water within 15 m) while the smith's next set needs flint, so a Meadows village can make the flint spear it needs before it goes into the Black Forest. A camp gathers 10 wood or 5 flint a day into its own stock (three days caught up); at `OutpostCarryAt` (12) a camper carries the load home along the camp's trail as a haul caravan. Old single-camp saves still read. |
| Caravans | `Village/Caravans.cs` | Records on the source hearth: kind, from, to, cargo, departure time, pace (`CaravanMetresPerDay`, 2,400 m a day, Living Factions' figure). Position follows from the clock along the trail (or a straight line). Once a day (`CaravanChancePerDay` 0.3) a village sends up to 20 of one or two things it can spare (over 30 wood or stone, 10 else, after the building going up and the smith's needs) to the village within `CaravanReach` (2,500 m) that lacks them most: not given by its biome first, then low in its stock; never to one it is wary of or hostile to. The destination's owner takes the load into its stock when due and keeps the id; the source forgets it after that or twenty days. Within 100 m of a player it is a real person (wanderer kind `carrier`) walking 15 m ahead of the record; gone past 110 m. A trade carrier who reaches the hearth becomes a visiting pedlar (WorldLife.Arrived: news, relations, trade). Since D-008 goods no longer move between villages by default (`CaravanDeliveries` off): see "Tyler's decisions applied" below. |
| Daughter villages | `Village/Daughters.cs` | Off by default since D-010 (`DaughterVillages`). A full village (MaxVillagers or MaxBuildings), at most `DaughtersPerVillage` (2), one party every ten days, `DaughterChancePerDay` 0.25: a site 600 to 1,200 m away in its own biome or one it has the gear for, 3 m over water, flat within 2 m over 10 m, 500 m from villages and village sites, 120 m from game locations. Two grown villagers (not the builder) become the settlers' caravan and walk off, with up to 40 wood and 20 stone. When due, the site is settled; its hearth is lit (as settled by hand) the first time a player comes within 150 m. The new village gets the goods, a chronicle line about where it came from, and both sides start at 80 (close). |
| Village events | `Village/VillageEvents.cs` | One roll a day after 07:00, `EventChancePerDay` 0.35, none for a lone camp. Good: feast (berries and mushrooms into the stock, `atewell`), skald (`blessing`), market day at a friendly neighbour (+5), lost traveller taken in (next arrival at once if a bed is free). Bad: fever (a third of one villager's health, `hurt`), beasts at night (`sleptrough`; a real raid only with RaidsEnabled and a player there), quarrel between rivals (`fight` for both), falling-out with a neighbour (-8). After RimWorld: no bad events in the first five days, within three days of a death (half as likely to six), or two days after another; a little more likely per size tier. Chronicle, news (`WorldLife.NoteNews`), `event:<kind>` lines. |
| Contracts | `Village/Contracts.cs`, `Village/NoticeBoard.cs`, `Villagers/Smithing.cs` (`Shortfall`) | Once a day (`ContractChancePerDay` 0.5), with none up: a notice for what the smith still lacks for the next set, or a material the pending work needs that the biome does not give. Pays about 1.5 times the store price in chest coins, or spare goods when coins are short. Shown on the back of the notice board since D-009 (what, reward, where), stands three days. Met when the chest holds the amount more than at posting; a player within 15 m of the chest is paid. |
| Signposts | `Village/Trails.cs` | `TrailSigns`: a pair of the game's wooden signs back to back, standing 2.2 m beside the trail, where a trail leaves a village (where it goes, how far) and halfway along trails longer than 600 m; neighbour trails get one out of each village. Made on the host within 60 m of the player, marked so they are made once. Each camp has its own trail now. |
| Groves | `Village/Groves.cs` | A village of four or more buildings with fewer than `GroveTrees` (25) standing trees within 60 m of its edge owes three extra saplings a day; the existing replanters plant them. |
| Lines | `Dialogue/growth.txt` | About 45 lines for `event:feast`, `skald`, `fair`, `takenin`, `sickness`, `beasts`, `quarrel`, `dispute`, `outpostwait`, `caravan`, `cargo`, `daughter`, `founded`, `contract`. |

Small hooks outside these files: `Villagers/Wanderers.cs` (the `carrier` kind runs `Caravans.WalkTick`),
`Village/VillageChest.cs` (anything in the stock moves to the chest, not only building materials),
`Village/Relations.cs` (`Adjust`, `Set`, `View`), `Village/WorldLife.cs` (news for the new events, the day of the last
death, world-tick calls), `Village/VillageBrain.cs` (hearth-tick calls and `Daughters.Initialized`).

Commands for testing, at the nearest village within 200 m unless said:

- `vh outpost [logging|flint]` founds the next camp now whatever the size and gear; `vh outpost haul` sends every
  camp's load home now; `vh outpost forget` drops the camps and their trails.
- `vh caravan` sends a trade caravan now (or says why not); `vh caravan list` or `vh caravans` lists every caravan
  with how far along it is and how far from you.
- `vh daughter` sends settlers now; walk to the pin and `vh daughter here` lights the site's hearth at once.
- `vh event [feast|skald|fair|takenin|sickness|beasts|quarrel|dispute]` makes one happen now; `vh events` lists the
  recent ones and the bad-event factor.
- `vh contract` posts a contract now; `vh contract clear` takes it down.
- `vh trails` plans the trails again and checks the signposts again.
- `vh village` shows outposts (and the gear they wait for), caravans, events, daughters and the contract.

To see caravans and hauls walk, stand on a trail between two villages (or a village and its camp) after
`vh caravan` or `vh outpost haul`, with WorldLife on. A caravan at 2,400 m a day covers about 80 m a minute.

Known limits: caravans and daughters read other hearths' ZDOs, so on a multiplayer client a far village may not be
seen (single player and the host see all). A settlers' party that never sees a player stays a site on paper. Trade
caravans are one way and unpaid; the next caravan back evens it out. Cargo from a caravan does not count toward what
a village can build (only outposts do, as Tyler decided). Groves count trees with a physics sweep once a day.

## Review 2026-11-08 day

A read-through of everything the minds and world branches added (`git diff f1f244f..main -- src`), before any of it
has run in game. Branch `night2/harden`. Compiles with `scripts/build-cloud.sh`.

### Fixed

- **Logic loader.** Harmony patches go on one class at a time, each in its own try/catch with a warning that names
  the class. Before, `PatchAll` threw at the first bad target, and `LogicConfig.Bind` (called after it) never ran, so
  the whole logic ran without settings. Settings are now bound first. Unpatching on reload is unchanged
  (`UnpatchSelf`, same Harmony id).
- **Hot reload.** The old build's config watcher now stops on unload (each build has its own statics, so the
  generation count never stopped it), and the look settings' change handlers come off (every reload added another
  set to the same config entries).
- **Player memory hooks** (`Piece.SetCreator`, `Character.OnDeath`, `Player.OnDeath`, `Character.Damage`) catch their
  own errors and log each once. An exception in a prefix on `Character.Damage` would have stopped all damage.
- **Hearth writes from clients.** The player record and reputation changes from those hooks are written only by the
  hearth's owner. A client writing a hearth it does not own sends its whole copy, which can undo the owner's newer
  stock and plots.
- **Skills.** A record missing a skill (or holding an unknown one) is filled in on read; lookups by name threw
  `KeyNotFoundException` in practice, tags and wants.
- **Wants.** `{goalskill}` printed a villager's seed for court and peace wants. The sweetheart mark is written only on
  a villager this machine owns, and the courting match skips the villager himself.
- **Gossip** was worked out every frame while a village was talked out (the chat branch runs each frame until a line
  is allowed). It now waits until a chat can open.
- **Dialogue statics.** `{partner}` and `{beast}` are cleared in `finally`, so a line that throws does not leave them
  set for every later line.
- **Harvest feast.** The "feast" village event now makes the evening a feast (Gatherings only listened for hunts,
  births, buildings and bosses).
- **Caravans.** No carrier tick or spawn without a ZDO. A trade caravan judges what the other village lacks by that
  village's biome alone; the brain's outpost scope was adding this village's outpost materials to it.
- **Daughters.** The "hearth already lit" check looks at loaded hearths before scanning every ZDO (it ran every ten
  seconds near a daughter village). The site search tests only game locations within 1,800 m (it tested all of them
  for each of 312 points). Settlers without a ZDO are skipped.
- **Trails.** One A* plan per hearth tick; the day is marked done once nothing is left. Up to three plans ran in one
  tick before.
- **Contracts.** Pay goes into the inventory a stack at a time; what does not fit is dropped at the player's feet.
- **Kill switches.** Every system from 2026-11-07 and 08 has its own setting, all on by default. World life (section
  5): WorldLife, Outposts, Trails, TrailSigns, VillageEvents, EventFever (new), Caravans, Daughters, Contracts, Groves.
  Villager minds (new section 5b): PlayerMemory, VillagerSkills, VillagerWants, Gatherings, Noticing, IdleGlances,
  SurroundingsTags, TopicFatigue, ChatScenes. `vh switches` lists them with their values; `vh help` names them.
- **Piece export.** `vh exportpieces` writes `BepInEx/config/Villheim/pieces.json` for the blueprint lab (see
  `tools/blueprint-lab/lib/pieces.js`; copy it to `tools/blueprint-lab/data/pieces-export.json`).

### Still risky

- **Patch targets.** The stubs used to compile are Valheim 1.0.21/22: `Piece.SetCreator(long, PlatformUserID)`. If
  the installed game differs, that one patch is left off with a warning ("Patch ... failed") and building near a
  village is not remembered. Check the log after the first load.
- **Kills are seen by the creature's owner.** `Character.OnDeath` runs on the machine that owns the creature. In
  multiplayer a kill by a player who does not own the creature is not remembered.
- **Only the hearth owner remembers players.** With two players in a village, deeds of the one who does not own the
  hearth are not recorded (by design of the fix above), and only the owner is paid for a contract.
- **Daughter hearths and camps are made on the host only** (`ZNet.IsServer` in `WorldLife.Tick`, which runs from the
  local player's update). On a dedicated server nobody lights daughter hearths or makes outpost camps.
- **Far hearths on clients.** Caravans, relations and daughters read hearth ZDOs the machine knows. A client may not
  have far hearths, so deliveries wait until someone near the destination has both, and a village that cannot see
  that its trade caravan was taken sends no new one until the record ages out (20 days).
- **Two players near one caravan** can each spawn its carrier (the check for one already walking sees only
  characters this machine has loaded).
- **Fever** lowers a villager's health by a third with `SetHealth`. It cannot kill (only villagers above 80% are
  picked), but it has not been seen in game. `EventFever` turns it off.
- **Trail planning** is still one A* search of up to 30,000 cells in a single tick: a short hitch when a village
  plans a trail.
- **Groves** count trees with one `Physics.OverlapSphere` of about 120 m on all layers, once a day per grown village.
- **Signposts** check every hearth's trails every ten seconds on the host; cheap for a few villages, not measured.
- **Statics reset on reload.** Feast days, the evening words, noticing cool-downs and topic fatigue live in memory, so
  a logic reload during a feast evening ends the feast.
- **Settlers** become wanderers (village 0, kind carrier). If the world is closed while they walk, they come back as
  carriers whose record may be due; they walk to the site or vanish once nobody is within 70 m.

### Test plan (about 20 minutes)

Use a test world with a village of four or more buildings. Console: F5, `devcommands` first. Set `WorldLife = true`
in `BepInEx/config/bazilisx.villheim.cfg` before step 4 (it reloads live).

1. Load the world. In `BepInEx/LogOutput.log`, look for `Loaded logic #1` and any `Patch ... failed` lines.
   `vh version`, then `vh switches`: every switch should read on except WorldLife.
2. Walk into the village. `vh minds`: skills, a want, "sees" tags and the village's record of you (one visit).
   Put 20 wood in the chest, then `vh minds` again: gifts and given count up, and nearby villagers know "gift".
3. Place one piece within the village, kill a boar or deer nearby, and hit a villager once with a fist.
   `vh minds` should show built, kills and hurtus. The game must place, kill and damage as normal.
4. `vh feast`, then `vh speech` near the hearth with two villagers by it: one speaks, one or two answer.
   `vh goal court`, `vh goal`: the want is set. `vh notice rainstart`: one to three villagers remark.
5. `vh event feast`, `vh event sickness` (one villager loses about a third of health), `vh events`.
6. `vh outpost logging` (or `flint`), `vh trails`, then `vh village`: camp and trail listed. `vh outpost haul`,
   then `vh caravans`: a haul on the road. Walk along the trail: a carrier walks with it and signposts stand where
   it leaves the village.
7. `vh caravan`: a trade caravan to a neighbour within 2,500 m (or a reason why not). `vh contract`: a notice on the
   board; `vh contract clear` takes it down.
8. `vh daughter`: two villagers leave as settlers and a pin marks the site. Go to the pin, `vh daughter here`: a
   hearth is lit and settles within a few ticks (`vh village` there shows where it came from).
9. Turn one switch off in the config (for example `Gatherings = false`), save, `vh switches`: it reads off, and a
   finished building gets the old few onlookers. Turn it back on.
10. Hot reload: copy the logic DLL again (or `vh reload`). The log shows `Loaded logic #2` with no doubled "Config
    reloaded" lines afterward when the config is saved once.
11. `vh exportpieces`: `BepInEx/config/Villheim/pieces.json` is written with several hundred pieces. Spot-check
    `wood_wall` (about 2 by 2 by 0.2 collider) and copy the file to `tools/blueprint-lab/data/pieces-export.json`.

## Built (2026-11-08 day, round 2: the living village; compiles, not yet tested in game)

All logic only (hot-reloads), in config section "6 - Living village", each part behind its own switch (on by default).
Three parts that take villagers away or hold growth back also need WorldLife (off during the design review): leaving,
elder deaths and the boss stage cap. One hub, `Village/Living.cs`, is called from the hearth's tick
(`VillageBrain`), the villager's brain tick (`Brain`), `Moods.Target`, `Dialogue` (tags, fill-ins, `Note`) and
`WorldLife`'s visitor chance, so the existing files gain a line each. The numbers come from the proposals in
`docs/LIVING_WORLD_RESEARCH.md` ("Beyond Millénaire"); nothing was run in the game, only `scripts/build-cloud.sh`.

| Part | File | What it does |
|---|---|---|
| Prosperity (1) | `Village/Prosperity.cs` | 5 per grown villager + per building (5 + stage squared / 5) + chest worth / 50 (store prices, 1 a coin), times (0.5 + mood / 100); worked out once a game hour, kept on the hearth. A villager killed or a raid lost takes 15% off (at most 60%), back 2% a day. Shown on the board's Level sign in brackets and as a "Prosperity" heading. Visitors x0.6 to x2, the wait between newcomers x0.75 to x1.25, no raid below `ProsperityRaidsFrom` (75), one more raider per 60. Tags `prosper:poor/modest/thriving/rich`, `prosper:hit`. |
| Expectations (2) | `Villagers/Expectations.cs` | A mood bonus by stage (`ExpectationBonus` 18, 12, 6, 0). Food variety: distinct foods eaten in three days (from `Healing.Eat`) against the stage, -2.5 each short, +1 each over (at most +2). Stage 2 and up without a longhouse -4; stage 3 and up with seats for under half the village -2, fewer than eight fence pieces -3. Per village once a minute. Tags `expect:met`, `expect:short:x`. |
| Calendar and festivals (3) | `Village/Calendar.cs` | Four seasons of `DaysPerSeason` (10). With shudnal's Seasons installed, its `seasonState.GetCurrentSeason()` and `GetCurrentDay()` are read by reflection (no code copied). A festival on `FestivalDay` (5) of each season: sowing feast, midsummer fire, harvest feast, Yule. From 16:00 nobody works (`Brain` runs free time), the evening is a feast (`Gatherings.Feast`), everyone takes "festival" (+10 for a day), visitors x3, and with WorldLife a pilgrim comes when a neighbour is above 20. Chronicle lines for each season and festival. |
| Winter stores (21) | `Village/Calendar.cs` | Autumn: wood kept between buildings x1.5 (`VillageNeeds`), food foragers and hunters keep x2. Winter: farmers and foragers rest, fire sitting twice as likely (`FreeTime`), rain in the open -3, and a winter morning with under 5 wood in the chest gives everyone "coldhome" (-6). |
| Player standing (5) | `Villagers/Standing.cs`, `Villagers/Social.cs` | Reputation may now fall to -100 and comes back `ForgivePerDay` (1) a day. Prices x0.85 hero, x0.93 friend, x1.2 below -10, x1.35 below `FineBelow` (-30). Below `FineBelow` a fine of 10 + 2 per point under: talking to a villager names it, crouching and talking pays it from your coins into the chest, sets the standing to -5 and goes in the chronicle; the store stays shut until then. Walking in below -10: the nearest villager comes to turn you away; below `GuardBelow` (-60) up to two protectors arm themselves and stand watching. Tags `standing:x`, `standing:fined`; fill-in {fine}. |
| Needs that complain (7) | `Villagers/Complaints.cs` | Each morning each grown villager counts days in a row without a bed, food (none in effect and none in the chest) and safety (a fight in the last day). 3 days: complain lines, the need weighs a third more on his mood. 6 days: a chronicle line and he walks up to a known player within 60 m to ask (`demand:x`); the need weighs double. 10 days: he leaves only with `VillagersLeave` on (off by default, D-003). |
| Leaving and migrants (16) | `Villagers/Leaving.cs`, `Village/VillageBrain.cs` | Off by default since D-003 (`VillagersLeave`); needs WorldLife too. A villager whose need went 10 days, or (after `ExodusDays` mornings with village mood under `ExodusMood`) the least content one, says goodbye and walks out toward the neighbour his village thinks best of; the village takes "leftus" (-4). Nobody leaves a village of two, nor the Jarl. Out of sight past the edge, he is removed and put on the neighbour's migrant list; the next newcomer there (free bed, within ten days) is the same person, name and look, "came over from X". |
| Visitors who judge (8) | `Village/VisitorJudging.cs`, `Villagers/Wanderers.cs` | A pedlar's or pilgrim's feeling (0 to 1) on arrival and every 20 s of the stay: village mood, rain on him, a fight, being hurt, a feast or festival. Score = mean of (rise x 2.75) and (feeling x 1.35). His home village's view of this one moves up to 3 toward lerp(-100, 100, score). Under 0.5 no visitor for up to three more days; the next visitor x0.5 to x1.5 by the last score. A gift in the chest at 0.2 to 0.9 (chance = score). Goodbye lines `stay:good/fair/bad`. Relations.Visited's +3 for the host stays. |
| The want by the chest (9) | `Village/WantPile.cs` | Once a game hour the top need from `VillageNeeds` is shown 1.8 m beside the chest: the game's woodpile, fine or core wood stack, stone pile, or an item stand with the item. The hammer cannot take it down and the item cannot be taken off the stand. Filled within a day with a player near the chest: "promisekept" (+6) and a chronicle line. |
| Boss stages (10) | `Village/BossStages.cs` | Off by default since D-004 (`BossStageCap`); needs WorldLife too. Stage cap = `BossStageStart` (2, a hamlet) + bosses felled, by the world's keys, trophies hung on item stands in the village, or either (`BossStageSource`). A new building past the cap waits ("Waiting for the next boss to fall (Eikthyr) ..."); upgrades go on, and a home is always allowed while someone has no bed. A trophy found hung: chronicle and "bossdown". Tag `stagecap`, fill-in {nextboss}. |
| Elders (18) | `Villagers/Elders.cs`, `Villagers/Personality.cs` | Days in the village count from arrival or birth. From `ElderDays` (40) an elder: chronicle line, no felling, mining or hauling unless he is the builder (`Chores`), stories from the older half of the chronicle ({chronicle}, {chronicleday}, {yearshere}). With WorldLife and `EldersDieOfAge` (off by default since D-003), from day 60 a 2% chance each morning of dying in the night: chronicle, mourning, no prosperity lost. A child born in the village takes one parent's homeland and the other's pastime. |
| Neighbours (33) | `Villagers/Neighbours.cs`, `Villagers/Sleep.cs` | A bed claim counts a bed within 30 m of the friend's as 15 m nearer and within 40 m of the rival's as 25 m farther. Each morning: home within 30 m of the friend's "goodneighbour" (+2), within 20 m of the rival's "badneighbour" (-3). The store opened through him x0.94 or x1.06. |
| The horn (35) | `Villagers/Escort.cs`, `VillheimLogic.cs` | Use the hearth while crouching: a friend of the village (standing 5) gets every grown protector within 80 m armed and following for `HornSeconds` (240 s). Once a game hour. Otherwise the hearth opens the chronicle as before. |
| Help in a fight (37) | `Villagers/Escort.cs` | Each hearth tick: a friend of the village within its radius + 60 m with a creature targeting him (25 m) or a hostile one within 8 m gets up to two protectors running to him; they go home 8 s after the last enemy. Not at night unless the village is raided. The brain's own fight takes over once they see the enemy. |
| Lines | `Dialogue/living.txt` | 188 lines for all of the above; the tags are listed at the top of the file. |

Commands, at the nearest village or villager: `vh living` (everything at a glance), `vh prosperity [now|hit]`,
`vh season [next|<days>]` (moves the own calendar this session), `vh festival`, `vh standing [<points>]`,
`vh complain [bed|food|safety] [days]`, `vh leave [why]`, `vh migrants`, `vh judge`, `vh want`, `vh stages`,
`vh elder [days|die]`, `vh horn`, `vh rescue`. They are not in `vh help` (to keep `LogicCommands.cs` edits to the
switch); `vh living` lists them.

Not done from these proposals: empty houses that stop being repaired after ten days and the logistic arrival chance
(16); the request on the notice board at the demand stage (7); a horn sound (35); elders who slow down (18).

Known limits: the food eaten and the horn's once-an-hour are kept in memory and lost on a reload. A visitor's judgement
changes his home village's view only on the host or the owner of that hearth. The want pile and the item stand are
locked by setting the piece's `m_canBeRemoved` on the instance; the logic sets it again each game hour, so a fresh load
leaves it open for up to an hour. Migrants write to another hearth's ZDO, as caravans do.

## Built (2026-11-08 night 3, village knowledge; compiles, not yet tested in game)

Tyler's rule: rumours and idle talk must be true. If a villager says there are boar along the coast, boar can spawn
there. All logic only (hot-reloads), in config section "5c - Village knowledge", on whether or not WorldLife is on.
Branch `night3/knowledge`. Nothing here was run in the game: only `scripts/build-cloud.sh`.

| Part | File | What it does |
|---|---|---|
| Reading the world | `Village/WorldSurvey.cs` | Locations from `ZoneSystem.m_locationInstances` (the whole world from generation, explored or not), named by prefix: boss altars (`Eikthyrnir`, `GDKing`, `Bonemass`, `Dragonqueen`, `GoblinKing`, `Mistlands_DvergrBossEntrance`, `FaderLocation`), dungeons (`Crypt`, `SunkenCrypt`, `TrollCave`, `MountainCave`, `Mistlands_DvergrTownEntrance`), traders (`Vendor_BlackForest`, `Hildir_camp`, `BogWitch_Camp`), runestones, `StartTemple`, tar pits, towers, giant bones, stone rings, dolmens, wrecks, wells, cairns, drake nests, greydwarf camps, fuling villages (`GoblinCamp`), dvergr outposts (`Mistlands_GuardTower`, `_Harbour`, `_Camp`, `_Excavation`, `_Lighthouse`) and ruins. Objects in generated zones by prefab with the game's `GetAllZDOsWithPrefabIterative`, one call per hearth tick: copper, tin, silver, obsidian, iron scrap piles, meteorites, greydwarf nests, draugr and bone piles, raspberry, blueberry and cloudberry bushes, wild beehives (no creator); a new sweep five minutes after the last. Creature spawns from the zone controller's `SpawnSystem` lists, merged per creature (biomes, height above the sea, forest or open, day or night; event-only and boss-key spawns left out). Terrain words from `WorldGenerator` heights sampled every 40 m on the line (6 to 24 samples). |
| Reach | `Village/Knowledge.cs` | Target reach = `KnowledgeReach` by stage (200, 400, 650, 900 m) + `KnowledgeReachPerGear` (60 m) per gear tier. The explored radius on the hearth grows `KnowledgeReachGrowth` (150 m) a day toward it. A place counts as reached when its biome is open to the village's gear (`KnowledgeGear`: Meadows 0, Black Forest 2, coast 1, Swamp, Mountain and Plains 4, Mistlands, Ashlands and the north never) and no stretch of water over 120 m lies on the way. Big things past that line (altars, landmarks, ruins, fuling and dvergr camps, traders, biome edges, creatures) can be spotted within `KnowledgeSight` (150 m, twice across water) of the last safe ground. Outpost camps and daughter villages know 250 m round them; trails to camps and neighbours know 120 m to each side. |
| Discoveries | `Village/Knowledge.cs` | Hearth key `villheim_known`: id, kind, key, position, day, witness, how (went, reach, spotted, camp, trail, daughter), terrain code, lean (toward the sea, inland), and day or night for creature grounds. Kept to `KnowledgeKeep` (60), ordinary and old dropped first. Ore and nests keep the nearest three of each (one per 120 m cluster); creature grounds and biome edges one each, at the nearest sample that fits. Bosses, dungeons and traders found go in the chronicle. |
| Survey in slices | `Village/Knowledge.cs` | From the hearth tick (5 s, hearth owner): the reach grows, one slice of the object sweep, 48 land samples (16 directions, rings every 80 m) until done, 12 candidates checked (the walk out is worked out once per gear tier per candidate). Candidates are made again once a game day or when the reach target grows. |
| Witnesses | `Village/Knowledge.cs` | Every 5 s, villagers (and the village's campers) past 1.1 x the village radius: their furthest point on the trip is noted, and anything within `KnowledgeWitness` (60 m, twice for big things) becomes a discovery they saw. If a player is within 30 m he says so (`rumour:new`). A place the reach covers first goes to the villager whose trip came nearest in the last hour, else to one whose trade fits (protector for creatures, nests, dungeons and bosses; miner for ore; woodcutter for the land), the same one each time. |
| Firsthand and secondhand | `Village/Knowledge.cs`, `Villagers/FreeTime.cs` | The witness knows it firsthand. In a chat in the village a speaker who saw or heard something passes the newest thing the listener does not know (`villheim_rumheard` on the listener: id and teller, 16 kept); the opening line can be about it (`tell:rumour`). After `KnowledgeCommonDays` (2) everyone has heard. Places found by a camp, trail or daughter village are common at once. |
| Rumours | `Village/Rumours.cs`, `Villagers/Dialogue.cs` | Each line pick, with `RumourChance` (0.5), one discovery the villager knows, weighted by kind (bosses 5, traders 4, dungeons 3.5, ore 3 ... ruins 1), how he knows it (saw 2.5, heard 1.8, common 1), freshness, and bosses not felled x2 (felled x0.4). Tags and fill-ins are listed at the top of `Dialogue/rumours.txt`. Requests: `findit:known/unknown` and {findit} for the top need when it is a material the land gives (ore, core wood, fine wood, flint, hides, meat, berries, honey...), `need:meat`, `meat:known/unknown` and {meatwhere} when the chest has no food. |
| Lines | `Dialogue/rumours.txt`, `Dialogue/land.txt` | 381 lines in eight voices: each boss (what the place is, felled or not), dungeons, traders, ore, nests, berries and bees, game, creatures that fight, biome edges, runestones, landmarks, ruins, fuling and dvergr camps, finds of the day, chats passing it on, requests. Retired: lines in `world.txt`, `more.txt`, `gatherings.txt`, `player.txt`, `daily.txt`, `people.txt` and `scenes.txt` that named a place or creature near the village (the stag on the hill, the crypt in the forest, copper in these hills, Haldor in this forest, raspberries past the big rock, a fox, a frog, trolls past the fence). General talk about the lands stays. |
| Contracts | `Village/Contracts.cs` | The "Needed" sign gets a second line: "Where: north-east, over the ridge, a good walk", or "Where: nobody here knows". |
| Work reach | `Villagers/Chores.cs`, `Hunting.cs`, `Foraging.cs` | The felling, mining, hunting and foraging radius (55 and 45 m) is multiplied by `HarvestReachByStage` (1, 1.15, 1.35, 1.6), at most `HarvestReachMax` (90 m). Past the old radius, only ground in a biome the village has the gear for. |
| Map table | `Village/MapTables.cs` | From `MapTableFromStage` (2, a hamlet) the game's `piece_cartographytable` stands 4.5 m from the hearth across from the chest (the first clear spot of twelve), marked with `villheim_maptable`. Reading it copies every discovery to the player's map as ordinary pins (deletable): boss icon for bosses, Icon4 dungeons, Icon1 traders, Icon2 ore, Icon0 nests and fighting creatures, Icon3 the rest; skipped when a pin of the same name is within 30 m or any pin within 6 m. Writing is refused with a message. Hover: "Hallby's map (12 places), [E] Copy them to your map". Put back a minute after it goes missing. |

Settings ("5c - Village knowledge"): `VillageKnowledge`, `KnowledgeReach`, `KnowledgeReachPerGear`,
`KnowledgeReachGrowth`, `KnowledgeGearGate`, `KnowledgeGear`, `KnowledgeWitness`, `KnowledgeSight`, `KnowledgeKeep`,
`KnowledgeCommonDays`, `RumourChance`, `KnowledgeRequests`, `HarvestReach`, `HarvestReachByStage`, `HarvestReachMax`,
`MapTable`, `MapTableFromStage`. The switches `VillageKnowledge`, `KnowledgeGearGate`, `KnowledgeRequests`,
`HarvestReach` and `MapTable` are in `vh switches`.

Commands, at the nearest village within 300 m:

- `vh know` lists every discovery: kind, key, distance and direction from the hearth, terrain, day, how and by whom,
  and its position.
- `vh know reach` (or `vh reach`): explored and target reach, stage, gear tier, which biomes the villagers go into,
  the work radius, camps, trails and daughters, and the survey's progress.
- `vh know survey` runs the land sampling and every candidate check now (a short hitch) and restarts the object sweep;
  `vh know survey full` first sets the explored radius to its target.
- `vh know rumours [n]` (or `vh rumours`): n sample lines (8) from the nearest villager, each with its real target,
  position, distance, direction, terrain, how the speaker knows it, the witness and the day.
- `vh know names`: every location prefab name within the survey radius, how many, and what it is read as ("not used"
  for names the table skips).
- `vh know table` puts the map table down now (whatever the stage) and says where it stands.
- `vh know forget` clears the village's discoveries and its explored radius.

Known limits:

- **Prefab names are from memory, not checked against the game.** Location names (above) and object names
  (`rock4_copper`, `MineRock_Tin`, `silvervein`, `rock3_silver`, `MineRock_Obsidian`, `mudpile`, `mudpile2`,
  `MineRock_Meteorite`, `Spawner_GreydwarfNest`, `Spawner_DraugrPile`, `BonePileSpawner`, `RaspberryBush`,
  `BlueberryBush`, `CloudberryBush`, `Beehive`), creature prefabs (`Greydwarf_Elite`, `Hatchling`, `GoblinBrute`...)
  and `piece_cartographytable`. A wrong location name only means it is skipped: check with `vh know names`. A wrong
  object name finds nothing. A missing cartography table prefab logs a warning.
- **Objects only in generated zones**, and on a multiplayer client only the ZDOs that machine has. Locations, land
  and spawns cover the whole world.
- **Spawn grounds are the nearest land sample (80 m rings) that fits** a creature's biome, height and forest rule.
  The creature can come out there, but the game's own spawn chance, group size and distance from players decide
  whether one is there when the player arrives.
- **Terrain words** come from the generated height, not from terrain the players or villages have dug. "Across the
  river" means some water under 150 m wide on the straight line.
- **`GetAllZDOsWithPrefabIterative`** is the stub's signature. If it throws, the object sweep turns itself off with one
  warning and knowledge rests on locations, land and spawns.
- **MapTable patches** go on every `OnRead` and `OnWrite` overload found. If the game's table calls its read through
  a different method, reading a village table would show the vanilla behaviour (sharing explored map), and no pins.
- **The hearth owner writes**: discoveries, reach and the map table come from the client that owns the hearth. A
  listener's heard list is written only by the machine that owns him.
- Heard lists, the trips used to pick a witness and the survey's candidates live in memory; a logic reload restarts
  the survey (the discoveries stay on the hearth).
- No "explorer" trade exists; protectors on hunts, foragers, campers and carriers are the ones who walk out.

Test plan (about 25 minutes, devcommands on):

1. Load a world with a village of two or more buildings. `vh switches`: VillageKnowledge, KnowledgeGearGate,
   KnowledgeRequests, HarvestReach and MapTable read on. The log has no "Patch ... failed" for `MapTables`.
2. At the village: `vh know reach`. Note the stage, gear tier, explored and target reach, and which biomes are open.
3. `vh know names`: the boss altars, dungeons and traders you know to be near show as read ("boss eikthyr" etc.).
   Note any "not used" names that should count.
4. `vh know survey full`, then `vh know`: discoveries listed with distance, direction and terrain. Open the map (with
   `exploremap` in a test world) and check two or three against their positions.
5. `vh know rumours 10`: read each line against its target line (direction, distance in plain words, "over the ridge",
   "across the river"). Walk to one creature ground and one ore discovery to see that it is there.
6. Stand by a villager who was not the witness of a fresh discovery (`vh know` shows witness and day) and wait for
   him to chat with the witness. `vh know rumours` near him then gives "heard" for it, and his lines name the teller.
7. Find the map table by the hearth (or `vh know table`). Hover: "<village>'s map (n places)". Use it: "Copied n places".
   Use it again: "Nothing new". Delete one pin by hand, use again: one copied. Try to write: the refusal message.
8. With a Meadows village of gear tier below 2, `vh know reach` says they stay out of the Black Forest; no forest
   discoveries are "reach" (only "spotted"). Watch a woodcutter: he never fells past 55 m inside Black Forest ground.
9. `vh contract` with a need the land gives (ore, core wood): the board's Needed sign shows a "Where:" line.
   With an empty food chest, talk to villagers: a line with where the deer or boar come out, or that nobody knows.
10. Set `VillageKnowledge = false` and save: no rumour lines, no new map table, `vh know` still lists. Set it back.
    `vh reload`: the survey starts again and `vh know` still lists the same discoveries.


Name check (2026-11-08, main session): object prefabs `rock4_copper`, `MineRock_Tin`, `silvervein`, `rock3_silver`,
`MineRock_Obsidian`, `mudpile2`, `MineRock_Meteorite`, `Spawner_GreydwarfNest`, `Spawner_DraugrPile`, `BonePileSpawner`,
`DrakeNest`, `piece_cartographytable` and the creatures `Greydwarf_Elite`, `Hatchling`, `GoblinBrute`, `GoblinShaman`
are in the game's own asset list (SoftRef manifest on Tyler's install). Location names are not in that list; the
LocationFinder mod's notes confirm `Hildir_camp`, `BogWitch_Camp`, `FaderLocation`, `Dragonqueen`,
`Mistlands_DvergrBossEntrance1` and `GoblinCamp2`, all caught by the prefix match. `vh know names` remains the check.

## Built (2026-11-08, cultures and biome defenders; compiles, not yet tested in game)

Logic only (hot-reloads). Settings in config sections "5c - Cultures" and "5d - Biome defenders"; the on/off ones are
in `vh switches`. Data in `src/Villheim.Logic/Cultures/cultures.txt`, lines in `Dialogue/cultures.txt`.

### Cultures by biome

Villages are echoes of the old world the heroes came from, so the cultures are peoples of the Viking-age world: the
Norse and the peoples they traded with, settled among or served beside. Each biome has up to three, picked per village
by weight with the village's seed and kept on the hearth (`villheim_culture`). The map is the setting `CultureMap`,
`Biome=culture:weight,...; Biome=...`. Biomes left out (Ashlands, Deep North, Ocean) build like the Meadows.

| Biome | Cultures (weight) | Why |
|---|---|---|
| Meadows | norse 3, anglo-saxon 1, frankish-norman 1 | The home farms; England and Normandy are where the Norse settled and mixed. |
| Black Forest | norse-forest 2, celtic 1, slavic 1 | Forest Norse (Swedish runestone names, forest place names); Gaelic Ireland and the Slavic lands of the Rus routes, both forest and timber peoples. |
| Swamp | celtic-crannog 1, baltic 1, fen-folk 1 | Lake dwellings on stilts and islands (crannogs), the Baltic bog and amber coast, the Frisian marsh villages built on mounds. |
| Mountain | norse-highland 1, saami 1 | Icelandic turf farms and fells; the Saami of the northern fells and reindeer country. |
| Plains | middle-eastern 2, byzantine 1, steppe 1 | The silver road east: Persian and Arab lands, Byzantium where the Varangians served, the Khazar and Turkic steppe. |
| Mistlands | byzantine 1, caucasian-highland 1 | Stone tower villages of the Caucasus (Svaneti) in the mist; Byzantine stonework. |

Tyler still has to confirm every row (provisional, from his 2026-11-08 list). The Mountains row is settled: both
equally common (D-039). Open questions: whether Mistlands get villages at all; whether fen-folk should be Frisian (as
built) or English fenland.

What a culture gives (`cultures.txt`, one `[key]` block each, `base = key` copies another):

- Names: at least 40 men's and 40 women's given names per culture from the region's naming tradition (Old Norse and
  Icelandic sagas, Old English, Norman and Frankish, Old Irish, Old East and West Slavic, Lithuanian and Old Prussian,
  Frisian, Saami, Persian and Arabic, Byzantine Greek, Old Turkic, Kipchak and Bulgar, Georgian and Armenian), plain
  letters only. The three Norse keys share one list with a few extra names each.
- Surnames, where the people used them: Norse son/dottir from a father's name (Snorrason, Leifsdottir), Gaelic mac and
  ingen, Arabic ibn and bint, Slavic -ich and -na, Norman "de" and a seat in Normandy, Byzantine and Caucasian family
  names (Doukas and Doukaina; Dadeshkeliani). Shown after the name in the hover text (`CultureSurnames`); the name in
  lines stays the given name.
- Village and home place names from the culture's parts (Sabzabad, Dunmore, Novgorod, Kyzyltepe).
- The leader's title in the hover text, short and plain (D-040): Jarl (the three Norse keys), Reeve (anglo-saxon),
  Lord (frankish-norman), Chief (celtic, celtic-crannog, baltic, fen-folk), Elder (slavic, saami,
  caucasian-highland), Sheikh (middle-eastern), Archon (byzantine), Beg (steppe). Fill-in `{leader}`.
- Looks: a skin range on the game's slider (0.25 to 1 as before; Norse 0.25 to 0.7, Persian and Arab 0.5 to 1),
  hair darkness and redness ranges, beard share, and words that make some hair and beard styles come up more (braid,
  curl, long...; matched against the style names the game shows). `LooksOutlierChance` (0.1) gives anyone any tone.
- Clothes: extra vanilla items mixed into the gear tier's pool, `Prefab@fromTier:weight`, women-only with `f:`, any
  item by prefix with `*` (Hildir's tunics and dresses, `ArmorTunic*`, `ArmorDress*`; hats `HelmetHat*`; linen capes in
  Plains cultures, wolf capes for the high country, lox capes on the steppe). An item the game lacks is skipped.
- Feasts: the four seasonal feasts by the culture's own names. Norse keep the sowing feast, the midsummer fire, the
  harvest feast and Yule; Gaelic Bealtaine, Lughnasa, Samhain, Imbolc; Slavic the spring feast, Kupala night, Dozhinki,
  Koliada; Persian Nowruz, Tirgan, Mehregan, Yalda night; and so on (`vh cultures`). Used for `{festival}`,
  `{nextfestival}` and the chronicle.
- Design sets: optional `designs.house = ...` tiers tried before the biome's (none set yet: no installed design is
  known to belong to one of these peoples). Blueprints may carry `villheim: culture=key`: they go only to villages of
  that culture and weigh double there. Everything else falls back to the biome's set.
- Lines: `Dialogue/cultures.txt`, 179 lines, tags `culture:<key>`, `people:<group>`, `villageculture:<key>`,
  `foreign`. Greetings and goodbyes are now picked like other lines for village villagers, so culture greetings come up.

Who gets which culture: the first settlers and children take the village's (children a parent's); a newcomer from
outside is of another people with `CultureForeignChance` (0.15), weighted by the map; a migrant from a neighbour keeps
his own (a fifth field in the migrant list); pedlars, pilgrims and hermits roll from the biome they walk in; caravan
carriers take their home village's. A village that had villagers before this build takes the first culture listed
for its biome (norse, norse-forest), so its people keep a Norse look.

### Biome defenders

`Villagers/Defenders.cs`. One mechanism, one profile per biome (Plains and Mistlands now), each with its own settings:
the biomes that always count (`PlainsDefenderBiomes`), how near that biome's ground must be to the hearth to count
(`PlainsDefenderReach` 400 m, sampled on three rings of 16 points), the creature prefabs it covers
(`PlainsDefenderTargets` Deathsquito; Mistlands Seeker, SeekerBrute, SeekerBrood, Tick, Gjall), a damage multiplier
(2 and 3), arrow spread (1.5 and 2 degrees) and reaction time (0.4 s). Shared: `DefenderRange` 35 m,
`DefenderShotSeconds` 1.2, `DefenderLead` 1, `DefenderCarers` on, `DefenderBowAnimation` on.

How the game fights, and what changes:

- MonsterAI.UpdateTarget calls BaseAI.FindEnemy every 2 s near a player (6 s far): the closest enemy it senses.
  For covered creatures, Brain now starts the fight at the first sighting, and a villager already fighting is turned
  onto a covered creature in range (MonsterAI.SetTarget) every half second.
- MonsterAI.SelectBestAttack has Humanoid.EquipBestWeapon pick a weapon once a second; DoAttack fires when the AI is
  looking at the target. A monster never draws a player bow (m_attackDrawTime stays 0), so its arrows fly at the
  bow's slowest and widest, and Attack aims them at the target's centre as it is, which misses a deathsquito.
- So bows are run by Villheim: a prefix on `VillagerAI.UpdateAI` (works while the game's AI has the villager
  alerted) takes over while a covered flying creature is within range and in sight. The villager stands, turns, and
  after the reaction time looses an arrow every DefenderShotSeconds. The arrow is built as Attack.FireProjectileBurst
  builds one at full draw: the arrow's projectile prefab, HitData from bow and arrow damage, IProjectile.Setup at the
  bow's full speed, aimed where the target will be when it arrives (speed measured over the last half second, plus the
  arrow's drop), turned by up to the spread. Bow and arrow by gear tier: crude bow and wood, flint arrows from tier 1,
  fine wood bow and bronze arrows from tier 3. Arrows are not carried or used up and never drop.
- A prefix on `Character.Damage` multiplies every blow or arrow a villager lands on a covered creature.
- When no flyer is left the bow leaves the inventory (so the game's AI never takes it into a ground fight) and a
  protector takes his weapon and shield again (`Roles.Rearm`).
- Fights with every other creature are as before.

### Commands

- `vh cultures`: the map and every culture in short.
- `vh culture [set <key>|reroll]`: the nearest village's culture, leader title, this season's feast and each loaded
  villager's culture; change it.
- `vh relook [culture]`: the nearest villager gets a new seed, name, face and clothes (his culture or the one named).
  The seed also sets voice and small facts, so those change too.
- `vh defenders`: the nearest village's profile, its creatures and numbers, how many would shoot, arrows loosed and
  flyers downed this session.

### Limits and risks

- Existing villagers get the new look formula on the next load (the culture ranges draw differently from the seed), so
  faces in old villages change once. Their stored names stay.
- `Outposts.cs` (being changed in another branch) still names haulers with `Names.Villager(seed)`, which is Norse; it
  should call `Names.Villager(seed, Cultures.Of(hearth))`.
- Hair, beard and clothes words and Hildir item prefixes are guesses until checked in game; a word that matches no
  style or an item the game lacks changes nothing.
- The bow animation trigger (`bow_fire`) is sent without the player's draw state; if the model sticks in a pose, turn
  off `DefenderBowAnimation`.
- Deathsquitos and gjall count only if `BaseAI.IsEnemy` says villagers (Dverger faction) and they are enemies.
- Village gear stays at bronze at most; the Mistlands damage multiplier is what keeps seekers in reach.
- Mountain drakes and bats are not covered; add their prefab names to a profile to try it.

## Tyler's decisions applied (2026-11-08, Decisions tab D-003 to D-040; compiles, not yet tested in game)

Branch `night3/decisions`, one commit per decision. Everything is in `src/Villheim.Logic` (hot-reloads); the core
was not changed. Settings that were on and are now off moved to new config keys, so a config file written before
keeps nothing on by accident; the code for them stays.

| Decision | What changed | Settings |
|---|---|---|
| D-003, D-004 | Villagers never leave and elders do not die of age. Growth is never capped by bosses felled; it follows materials, people and needs. Complaints stay: a villager still grumbles at 3 days and asks a player at 6. Lines for farewells, migrants, elder deaths and the boss stage cap are retired (comments in `living.txt` say where they went). | `VillagersLeave` (was `Leaving`), `EldersDieOfAge` (was `ElderDeaths`), `BossStageCap` (was `BossStages`): all new keys, off. |
| D-005 | A feast only after a big building: the hall, a new home, or a design of `FeastPieces` pieces or more (8 m footprint when the count is unknown). Smaller ones get a short look from three villagers. Hunts, births, a felled boss and the harvest event still make feasts. | `FeastPieces` 150 (section 5b). |
| D-007 | Anything in the village's chests and stock counts toward what it can build, whoever brought it: a design that needs a material the land does not give can go up once the chests hold all of it (`Materials.Held`, `DesignLibrary.MissingIn`). Villagers still gather only what their land gives. | `BroughtMaterials` on. |
| D-008 | Caravans carry no village goods. A trader walks the trail with his own pack (`Caravans.SendTraveller`); Shift + Use opens it (the pedlar's wares, for coins), and he stays at the far hearth as a pedlar. `vh caravan` sends one. | `CaravanDeliveries` off (on restores goods between villages). |
| D-009 | The notice board has a back. Each front sign gets a vanilla sign mirrored through the frame: the name, then Contract, Reward, Where, Season, Next feast, Prosperity. The front "Needed" sign shows needs again. Boards already up get the back signs as their next amenity job. | none |
| D-010 | No daughter villages: one village per site plus resource outposts. Lines about settlers founding a village are retired. | `DaughterVillages` (was `Daughters`), off. |
| D-012 | In the Meadows and Black Forest a design with more than `EarlyStoneMax` stone waits for `StoneFromStage` (3, the stage the next building reaches), or `StoneHallFromStage` (2) for the hall; a stone level of a blueprint family waits too. If a role has only stone designs, the one with the least stone is used. `MaterialSwap` counts stone pieces as Swamp at the earliest, so the gallery's "as Meadows/Black Forest" swaps stone for wood. | `WoodFirstBiomes`, `StoneFromStage` 3, `StoneHallFromStage` 2, `EarlyStoneMax` 30. |
| D-014 | Mood no longer changes work speed: the builder's mood factor and the good day's +25% are gone. A good day is a cheerful mood with its lines (reworded where they spoke of working faster). Mood changes free time only. | none |
| D-015 | Village animals never breed or eat by themselves: Harmony prefixes on `Procreation.Procreate` and `MonsterAI.UpdateConsumeItem` for animals with the village mark (turning the breeding component off did not stop its timer). The herd grows on the farm schedule: a piglet when a new stage wants one more, or for one that died. The farmer acts out feeding with no food. Player-tamed animals are untouched. | none |
| D-016 | Storage chests (`Village/StorageChests.cs`, `Villagers/Sorting.cs`): vanilla wood chests in a row along the main chest's side, past the board's posts, each with a vanilla sign for its kind (wood, stone, fine wood, core wood, food, ore and metal, other). One with the first building, two with the second, four with the third (the village has no decor stages yet, so its first three buildings stand for s1d1 to s1d3), one more per `StorageChestPeople` villagers past six, one more a day when the main chest is full with nowhere to sort to, at most `StorageChestMax`. When the main chest is `StorageSortAt` full a villager carries a stack to the right chest. The main chest's counts include them and `VillageChest.Take` pays from them, so the builder takes from any. The storehouse building keeps its own plain chests. | `StorageChests` on, `StorageChestSteps` "1:1, 2:2, 3:4", `StorageChestPeople` 3, `StorageChestMax` 8, `StorageSortAt` 0.75. |
| D-038 | Village pieces take no rain or water damage: a prefix on `WearNTear.UpdateWear` clears `m_noRoofWear` on pieces with the village mark (`Village/WaterProof.cs`). Fen-folk and crannog villages lay boardwalks where a path crosses wet ground (`Village/Boardwalks.cs`): a `wood_floor_1x1` per path metre on `wood_pole2`/`wood_pole` posts down into the ground, deck 0.5 m over the water, paid from the chest; dirt where the chest cannot pay or the water is over 4 m deep. | `WaterProofPieces` on, `BoardwalkCultures` "fen-folk, celtic-crannog", `BoardwalkWetHeight` 0.8. |
| D-039 | Mountains: norse-highland 1, saami 1. A config still on the old default `CultureMap` moves to the new one. | `CultureMap` |
| D-040 | Leader titles: Jarl, Reeve, Lord, Chief, Elder, Sheikh, Archon, Beg (see Cultures). Lines that said Jarl outright use `{leader}`. | none |
| D-017, D-018 | Checked: `RaidsEnabled` and `VillagerTrading` are off by default and were never on under those keys. Raid code kept. | none |

Commands: `vh caravan` (a traveller now, or goods with `CaravanDeliveries` on), `vh village` (adds a storage chest
line: how many of how many, kinds, stacks), `vh board` (the back signs show as missing pieces until built),
`vh switches` (shows the renamed keys).

Not done or left open:

- Player trade with a caravan beyond the pedlar's coin store: paying with gifts, wares that come from the trader's
  home village, and a pack animal. What it needs: a gift path on the carrier's Use (an item from the hotbar into his
  pack for goods of equal store value), wares drawn from his home village's spare stock without taking it from the
  chest, and a tamed lox or boar walking behind him.
- The village has no decor stages (d1 to d3) yet, so storage chest steps go by buildings.
- Boardwalks stay when a rebuilt building's road is taken up; there is no ramp where the deck meets dry ground.

To check in game: the back signs sit flush behind the frame and read the right way; storage chest signs stay up (a
sign needs support from the chest face); boardwalk posts reach the ground and the deck holds; rain on a village roof
over a day leaves no wear; a village boar never breeds in a pen; a fen-folk village's paths over wet ground.

## Next, in order

Effort is a rough guess: S an evening, M a session or two, L several sessions.

1. **Dialogue fallback chains and per-player fatigue (S).** Built 2026-11-08 night (topic fatigue in `Dialogue.cs`,
   place tags in `Context.cs`). Still to do: a dock tag once villages have docks, and keeping fatigue across reloads.
2. **Gatherings (S).** Built 2026-11-08 night (`Gatherings.cs`): turnouts, feasts at the hearth, evening words.
   Still to do: the feast in the longhouse itself once villagers use its benches and tables, and food taken from the
   chest for it.
3. **Caravans as records (M).** First version built (2026-11-08 night, `Caravans.cs`: trade caravans, hauls,
   settlers; records on the world clock, real carriers near a player). Since D-008 a caravan is a
   trader with his own pack (`CaravanDeliveries` off). Still to do: player trade by gifts, a pack animal, two nights' stay. The plan as it was: Living Factions keeps travelling bands as data (position, target, people, state) and
   moves them at a set pace (2,400 m a day) while no one is near; within about 130 m of the nearest player they become
   real NPCs, and despawn past 200 m. Do the same for a pedlar's route between two hearths: the record moves on the
   world clock, a real pedlar (and a tamed boar or lox as pack animal later) appears when a player is close to the
   route. Millénaire's merchants pick the next village by what it lacks, stay two nights, and carry goods from one
   village's store to the next: route surplus from the village that has it to the one that needs it.
4. **Outposts, second step (L).** Built further (2026-11-08 night): the gear gate, outpost materials in the biome
   rule, two camps, a flint camp on the shore, stock carried home along the trail at 12. Still to do: huts and the
   trade's workshop at the camp, mining (copper, tin) and fishing camps, Living Factions' site rules. The plan as it was: Millénaire hamlets and Living Factions outposts: a small owned camp where the land gives what home
   lacks (core wood in the Black Forest for a Meadows village, copper, tin, a fishing spot on the coast), at most two
   per village, one or two huts and the trade's workshop, never growing into a village. Two villagers live there, carry
   stock home when it passes a set amount (Living Factions: 12), and a path joins it to the village. Site rules from
   Living Factions: dry ground at least 1.5 m above water, one biome, two rings of eight height samples within
   2 + 0.2 r m, clear of vanilla locations, more than r + 60 m from any player while it is placed. Designs: small Work
   designs from the board (Mining, Woodworking, Harbour). The biome rule then reads "a village builds with what its
   biome and its outposts give".
5. **Roads between villages (M to L).** First version built (`Trails.cs`: runtime, dirt only), with signposts where
   trails leave a village and halfway on long ones (2026-11-08 night). Still to do: widen and pave busy trails (count
   caravans along them), signposts at junctions, a watchtower design as a road post. The other route:
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
7. **A smith who makes gear (M).** First version built (`Smithing.cs`, sets per tier); its tier now gates outposts and
   daughter sites, and its shortfall becomes a contract. Still to do: a village forge so
   bronze can be made at home, gear kept in the chest and taken by each villager, repairs. The full plan: a smith trade
   (from the Workshop subtype) runs a real recipe (`ObjectDB.GetRecipe`, `m_resources`, `m_minStationLevel`) at a
   village forge or workbench that passes `CheckUsable`, takes the materials from the chest, plays the station's craft
   effect, and puts the item in the chest; protectors and workers then take their weapon, shield, tool and armour from
   the chest. The forge level caps the tier (MineColonies caps equipment by building level). Gear tiers by village
   tier stay as the fallback. Repairs after Offline Companions Reborn (MIT): worn items repaired at a station that can
   repair them.
8. **Requests and contracts (M).** First version built (2026-11-08 night, `Contracts.cs`: one notice at a time, paid
   at the chest). Still to do: reputation per player, two-villager favours, bounties. The plan as it was: notice board work for players: Millénaire quests (chance per hour, minimum
   reputation, steps with goods, a time limit, reputation gained or lost) and MineColonies two-villager favours ("take
   this to my brother at the outpost", both moods up for a week). Bounties that only exist on paper until the player
   arrives (TraderQuests: a pinned spot, the target spawned when the player comes near). Social.cs already has a daily
   material request to build on.
9. **Village events director (M).** First version built (2026-11-08 night, `VillageEvents.cs`, eight kinds). Still
   to do: a feast that gathers everyone (needs gatherings, item 2), raids through `RandEventSystem`, a lost villager
   the player finds. The plan as it was: Living Factions rolls 3.5% a day per settlement for a good harvest, sickness, a
   beast attack or newcomers; RimWorld spends an event budget that grows with wealth. A small director per village:
   feasts after a good harvest, a quarrel between rivals, a lost villager found by the player, a visiting skald. Raids
   go through the game's `RandEventSystem` (CustomRaids, Unlicense, shows how to add `RandomEvent`s and centre them on
   a point).
10. **Raids and help between villages (M).** Paused: raids stay off (D-017) and villages are a place of rest. The
    old plan: with relations in place, below -50 a village may send a raid party to a
    neighbour (Millénaire picks targets weaker than the raider), above 70 it sends help when the neighbour is attacked.
    Caravans as records now exist (`Caravans.cs`): a raid party or help is a new caravan kind.
11. **Skills that grow (M).** Built 2026-11-08 night (`VillagerSkills.cs`). Still to do: a cap from the home's level,
    children starting from their parents' skills (no parent records yet), output (not only speed) by skill, and trades
    chosen by skill once a village has them.
12. **Newcomers at the longhouse (S).** MineColonies taverns: wanderers sit in the longhouse with a backstory line and
    a price to stay (mead, a hide, coins). A way for villages to grow beyond births and the empty-bed arrivals. The
    backstory part is built (2026-11-08 night: `newcomer` tag and {whyleft} for three days after arriving); the
    seeker who waits in the longhouse and the price to stay need a new wanderer kind in `WorldLife.cs` and are left
    for the world-growth work.
13. **Daughter villages (M).** First version built (2026-11-08 night, `Daughters.cs`); off since D-010, one village
    per site. Kept for a later choice. Was still to do: a daughter that
    starts as a hamlet of its parent (shared stock by caravan, as Sim Settlements 2), sites by what the land gives,
    the parent's culture and designs carried over.
14. **Groves and animals (S to M).** Groves built (2026-11-08 night). Animals follow D-015 (born on a schedule, no
    breeding, feeding acted out with no food). Still to do: a pen design, chickens, orchards of berry bushes by the
    farms.

## Sources that allow copying

| Project | Licence | Worth reading |
|---|---|---|
| ProceduralRoads (jneb802) | MIT | `RoadPathfinder.cs`, `RoadTerrainModifier.cs`, the `ZoneSystem` patches |
| AntTrails (egaroib) | MIT | `TrailEngine.cs`, `TerrainPainter.cs` |
| Offline Companions Reborn (MaddhattrRocks) | MIT | `SpeechConfig.cs`, `CompanionTalk.cs` (tagged barks, priority queue), `RepairController.cs` |
| CustomRaids (ASharpPen) | Unlicense | raid manager and `RandEventSystem` patches |

Anything copied keeps its licence notice in `THIRD_PARTY_NOTICES.md`. Living Factions, TraderQuests, Norsemen and
ServerGuide have no licence file and Millénaire is All Rights Reserved: ideas only. Clones for study go in `/tmp`.
