# Room layout

How the blueprint lab lays out the big furniture in a room: where beds, tables, seats, stations and storage stand,
which way they face, and how the walking paths stay open. The small things on tables and walls come from the interior
library (`docs/BLUEPRINT_LAB.md`, "Interior kitbash"). This note is the research behind the layout rules (D-070). The
same rules in machine form are in `tools/blueprint-lab/data/room-layouts.json`; the planner that reads them is
`tools/blueprint-lab/lib/layout.js`.

Each claim names its source in brackets, for example [S3]. The list of sources is at the end. Lines marked
**(inference)** are my own reading of the sources or of the game, with no source that says it outright.

Three drivers from D-068 run through all of it:

1. Messy realism: rooms look lived in and a little out of line, short of a hoard.
2. Environmental storytelling: what stands in a room says who lives or works there.
3. Variance: two smithies or two s1 houses of one culture do not share a layout.

Every rule below is a tendency with a weight or a range. None is a fixed interval or a placement that happens every
time (Tyler, D-070).

## What the studios say

### Baldur's Gate 3 (Larian)

Larian has said little in public about how it lays out a room. What is on record is about purpose and density:

- The world is a "curated open world", dense and hand built [S2].
- "Every building needs a story, a secret, a cellar." A shop can lead to a hidden cult two hours and three puzzles
  later [S2].
- Farhang Namdar's talk "Building Worlds for an RPG" covers level architecture, environmental storytelling and what
  makes a world feel alive [S2]. Only the summary is public in text.

What I take from it for Villheim: each building gets one thing that belongs only to it, its "secret" in a place of
rest: a half-finished carving, a letter on the table, an odd collection on a shelf, a chest in the loft. The
persona work (feat/persona) chooses the thing; the layout keeps a spot free for it. **(inference)**

### The Witcher 3 (CD Projekt Red)

Miles Tost, level designer [S3]:

- Interiors carry "tons and tons of more detail, even in the most unimportant interiors". The aim is that a player
  can "tell what kind of person lives in a place, just by studying the interior of their house".
- "Nothing is placed just for the sake of having it there."
- "Every village is there, because the people decided to settle there for a reason."
- Reuse is hidden by variation and hand placement: "more than 15 variations of chairs".
- Caves share modular pieces and are each "built completely from scratch and decorated individually", so no two share
  a layout.

### Skyrim and Fallout (Bethesda): kits

Joel Burgess and Nate Purkeypile, "Skyrim's Modular Approach to Level Design", GDC 2013 [S1]:

- Set world-wide measures before building kits: one door frame size, the narrowest space you can walk (they wanted
  room for two characters to pass), the steepest slope.
- Oblivion's copied "warehouse" rooms read as cookie-cutter; Skyrim moved to pieces placed by hand.
- Players "were quicker to react negatively to repeated detail elements" than to repeated architecture. Repeated
  clutter is the first thing a player notices.
- The kit is the architecture of a space; props, lighting and creatures give each space its own character.
- A few unique pieces in a familiar kit keep it fresh. Mixing kits changes the mood at once.

Hearthfire's houses grow from a one-room cabin by adding wings (a greenhouse, a trophy room, a cellar) [S18]. The
house's rooms each have one job. **(inference from [S18] and play)**

### Elder Scrolls Online and World of Warcraft housing

- ESO: every house ships with a default layout the studio made, and players can buy it pre-decorated. Items snap to
  surfaces by default; snapping can be turned off to place freely [S5].
- WoW (Midnight): interiors are separate from the outside shell. Players add partition walls to make rooms. A basic
  mode snaps items to floors, walls and ceilings and to a grid that shrinks on small surfaces such as a table, which
  keeps things "neat and tidy"; an advanced mode turns those rules off for free placement. Small items can be parented
  to a large one (books on a shelf) and move with it [S4].

What this means here: both games pair a tidy snapped layer with a free layer. The lab works the same way: the planner
places the big pieces on the room's grid and wall lines; the library and the persona pass add the loose layer that is
allowed to sit off the grid. A group (shelf and books, table and its dishes) moves as one. **(inference)**

### Enshrouded

- Comfort comes from the best piece in each category of furniture (beds, chairs, tables and so on), under a roof and
  near a fire [S6].
- Craftsmen have a roaming range and go back to their beds at night; players ask that they keep to their stations by
  day [S6].

What this means here: every villager needs a bed and a work place, and the walk between them should be short and
open. **(inference)**

### Level design and set dressing in general

- Environmental storytelling is "staging player-space with environmental properties that can be interpreted as a
  meaningful whole" (Harvey Smith and Matthias Worch, GDC 2010) [S7].
- Space shows status: in Thief's Bafford's Mansion the gold is in the lord's rooms and the servants' rooms hold little
  of value. Hitman splits spaces into public and private, and "when we design these spaces, we're designing rules of
  behaviour" [S7].
- Circulation is the space between areas. Wider passages read as the main public way [S8]. A hub with spokes gives a
  space a center and a structure [S8].
- Think like a cinematographer: frame what the eye should go to (Miriam Bellard, Rockstar, GDC 2019) [S9].
- An environment should feel logical and grounded, and strong props sell the story [S20].
- Choose furniture by the owner's taste and history; imperfections and signs of wear make a room feel lived in;
  overlapping shapes add depth; mix large, medium and small [S19].

## Measures, scaled to Valheim

Real interior guides measure for a person about 0.5 m across the shoulders. Valheim's player is about 1 m wide, and
its furniture is about 1.3 to 1.4 times real size (a bed is 1.2 m by 2.8 m, a table 2.45 m long). The walls stand on
a 2 m grid; the lab reads floors in 0.5 m cells. I scale the real clearances by 1.4 and never below one player width.
**(inference)**

| Clearance | Real source | Valheim |
|---|---|---|
| Main way (door to hearth, stairs, other doors) | 36 in (0.91 m) [S15]; two people pass [S1] | 1.2 m at least, 1.4 to 1.8 m wanted; 2 m in halls and taverns |
| Side way round furniture | 24 to 30 in (0.6 to 0.76 m) [S15] | 1.0 m at least |
| Behind a seat at a table | 24 to 30 in pull-out [S16] | 0.7 m at least, 0.9 to 1.1 m wanted |
| Table edge to a wall with no seat | 36 in (0.91 m), 42 to 44 in comfortable [S16] | 1.0 to 1.4 m, or set against the wall |
| Table edge per seat | 24 in (0.61 m) [S16] | about 1 m of table per seat (the decorator's 1.0 m) |
| Between smithing stations | one pace or two steps, a triangle; 36 in close but fine [S17] | 1.5 to 2.5 m between forge, anvil and quench tub |
| In front of a door | (the audit's 1.2 m box) | 1.5 to 2.5 m deep, the door's width plus 0.8 m |
| At a stair's foot and top | (the audit's 0.6 m round the flight) | 1.2 to 1.8 m clear |
| Along a bed's open side | room to get in [S15] | 0.8 to 1.2 m on at least one long side |

Measures already in the lab that these agree with: the door box (`doorZones`), the paths from each door to the fire,
stairs and other doors (`planPaths`, which keeps furniture 0.42 m from the path's 0.5 m cells, so a cleared lane is
about 1.3 m wide), the stair box and 0.9 m in front of every floor piece of the library.

## Rules for every room

**Circulation first.** The ways in, the fire and the stairs are joined by clear lanes before any furniture goes in
[S8]. The main lane runs from the main door to the hearth or the room's focal point, then on to the stairs and the
other doors. Lanes follow the middle of the room and keep away from walls, which are kept for furniture. The cells
under a lane stay free of floor pieces; rugs may lie on them. A room keeps 45 to 65 % of its floor walkable, and all
the walkable floor joins up. **(inference from [S8], [S15] and the corpus rate of half the floor furnished)**

**Walls are for furniture, the middle is for people and the fire.** Beds, chests, stations and benches go against
walls; the middle holds the hearth, a table with its seats, or nothing. A piece floats in the middle only when it is
meant to be walked round (a hearth, a dining table, a work island). **(inference from [S10], [S15], [S16])**

**Public near the door, private far from it.** The door end is for coming in, eating and working; the far end and
the upper floor are for sleeping and valuables. Status rises away from the door: the high seat and the dais sit at
the upper end, the servants' and service end by the door [S7], [S11], [S13].

**One focal point per room.** The hearth in a hall or home, the high seat in a chief's hall, the altar in a temple,
the forge in a smithy, the bar in a tavern [S9], [S11], [S13]. Seating faces it; the main lane leads to it; the light
gathers on it. **(inference from [S9])**

**Furniture comes in groups.** Furniture comes in working groups: a bed with its chest and a light, a table with its
seats, a station with its tools and stock, the hearth with its seats and pot [S4], [S16], [S17]. A group keeps its
inside clearances (seat pull-out, a place to stand at the station).

**Alignment with a little play.** Big pieces follow the walls and the room's long axis; only light things stand a
little off (a chair turned toward the fire, a stool pulled out, a bench a hand off square). Builders in the corpus
clip pieces into each other by 4 to 19 cm at the median (`docs/BLUEPRINT_LAB.md`). Big anchors move at most 0.15 m
and 10 degrees off the line; loose pieces up to 0.3 m and 25 degrees. The persona pass owns that play; the layout
leaves room for it. **(inference from [S19] and the corpus)**

**Variance from the start.** Each room draws its scheme (which end sleeps, which wall works, where the table goes)
from weights, and the weights shift with the culture, the village and the household. Repeated details are noticed
first [S1], so the rule that sets one piece is a range, and a scheme that won in one house of a village loses weight
in the next one. **(inference from [S1], [S3])**

**Lived in, short of a hoard.** At most about half the floor is furnished (the corpus rate). Clutter gathers where
work happens: by the fire, the bench, the bed [S19]. One thing in each building tells its own story [S2], [S3].

## Room types

The lab's room roles are in brackets.

### Sleeping room (sleeping, home upper floor)

- **Where:** the upper floor of a home, or the far end or a side wing of a one-storey home; never the room the main
  door opens into when there is a choice [S12], [S13].
- **Anchors:** beds (one per sleeper or couple), a chest at the foot or beside the bed, a light at the head side.
  At d2 on: a rug along the open side, a bench at the foot, a wardrobe or armor stand. [S15], corpus.
- **Orientation:** head to a solid wall, best the longest unbroken one [S15]. Not under a window when another wall
  serves [S15]. From the bed one sees the door, but the bed is not lined up with the doorway [S15]. One long side
  open for getting in; two beds share a wall with a gap of 0.7 m or more between them, or stand head to wall on
  facing walls. **(the last from the decorator's own spacing)**
- **Variants:** head to the far wall (most), side to the wall in an alcove or a box bed (Norse box beds for the
  master and mistress [S10]), two beds in an L in a corner, beds under the eaves in a loft (low side to the slope).
- **Circulation:** a lane from the door or stair head to the open side of each bed; the stair's head stays clear.
- **Story:** what lies on the chest and at the bedside says who sleeps there (a child's toy, a weapon, a sewing
  basket).

### Hall or main room with a hearth (home ground floor, hall, longhouse)

- **Where:** the room the main door opens into, in the middle of the building [S10], [S12].
- **Anchors:** the hearth in the middle, under the smoke hole [S10], [S12]; seats round it; a table; storage by the
  walls; in a chief's hall the high seat.
- **Orientation:** seats face the hearth. In a Norse hall the benches run along both long walls facing each other
  across the fire; the high seat (öndvegi) is in the middle of one long bench and the guest's seat opposite it;
  rank falls toward the ends and the door [S11]. In a medieval great hall the high table stands on a dais at the
  upper end, across the room's long axis, facing down the hall toward the screens passage and the door [S13]. Long
  tables run along the long axis.
- **Zones:** the entry by the door; the hearth zone in the middle; eating on one side or round the fire; sleeping
  or private space at the far end; storage at the service end by the door or under the benches [S10], [S12], [S13].
- **Circulation:** the main lane runs from the door to the hearth's open side and on to the stairs; in a longhouse
  the aisle between the posts and the fire is the passage between sections [S10].
- **Focal point:** the hearth, or the high seat or high table when the hall has one [S11], [S13].
- **Story:** the high seat's trappings (a rug, banners, a carving behind it), trophies on the posts, the work the
  family does by the fire.

### Kitchen and cooking area (kitchen, the cooking side of a home or tavern)

- **Where:** in a small house, the hearth itself is the kitchen; in a bigger one, a room or corner at the service
  end, next to the hall and the storeroom [S12], [S13]. Pantry and buttery are unheated, so cold stores sit away from
  the fire [S12].
- **Anchors:** the fire with a pot or spit, a work table against the nearest wall, the spice rack and pots hung by
  the fire, barrels and a chest for food. Cauldron upgrades stand within 5 m of the cauldron (the game's range).
- **Orientation:** the work table faces the room with its back to a wall, within two steps of the fire; storage
  between the work table and the door. **(inference, the work triangle of [S17] applied to cooking)**
- **Circulation:** a short lane fire to table to storage; a lane through to the hall.
- **Story:** what is being cooked, food on the table, the cook's stool.

### Tavern common room (tavern)

- **Where:** the ground floor, the room the main door opens into; guest chambers above, reached by a stair or a
  gallery [S14].
- **Anchors:** the hearth; the bar or serving corner with barrels behind it; tables with seats spread over the floor
  (one per 16 to 32 m2); a fermenter or two.
- **Orientation:** the bar along a long wall or across a corner, facing the room and the door so the keeper sees
  who comes in **(inference)**; tables along the long axis and by the walls, round tables in the open middle; seats
  face their tables, some turned toward the fire.
- **Zones:** entry; drinking floor; the bar and the cellar side (barrels, the tap) at the back or side [S14]; the
  stair foot near the bar.
- **Circulation:** 2 m lanes from the door to the bar, to the hearth and to the stair; tables keep their pull-out
  space off the lanes.
- **Story:** a regulars' table, a notice by the door, a game left on a table, the keeper's own corner.

### Tavern guest rooms (guest)

- **Where:** upper floors, off a passage or a gallery [S14].
- **Anchors:** two or three beds to a chamber in the old inns [S14]; a chest each; a light; at d3 a small table.
- **Orientation:** as sleeping rooms; beds spaced, never packed edge to edge (the review that called packed beds a
  barracks).
- **Circulation:** a lane from the door past the foot of every bed.

### Storage (storage, farm store rooms, the service end)

- **Where:** by the door at the service end, under the stairs and benches, or a room or building of its own [S10],
  [S12], [S13].
- **Anchors:** chests and barrels in groups of two or three along walls, crates, a sign over each group (D-016).
- **Orientation:** fronts to the room; heavy things low, at the back.
- **Circulation:** one lane down the middle reaching the front of every chest.
- **Story:** what is stored says what the household or village lives on (grain, fish, ore).

### Smithy (smithy)

- **Where:** ground floor, near the big door or an open side, often its own building [S10].
- **Anchors:** forge against a wall, anvil, grinding wheel, quench barrel, a bench, stock chests.
- **Orientation:** forge, anvil and vise in a triangle one to two paces apart; the anvil's horn turned to the outside
  of the triangle [S17]. The smith stands in the middle of the triangle.
- **Zones:** the hot work triangle at the back or side; the bench and stock along a side wall; finished work and
  the customer's side by the door. **(inference)**
- **Circulation:** a lane from the door to the open side of the triangle; 1.2 m clear in front of each station.
- **Story:** half-made work on the anvil, tools on the wall, a shield or a blade waiting for its owner.

### Workshop (workshop, sawmill)

- **Where:** ground floor by the door; light from the door or windows on the bench. **(inference)**
- **Anchors:** workbench against a wall with its upgrades beside it, the chopping block, a stonecutter or spinning
  wheel by the craft, stock in chests and barrels.
- **Orientation:** benches face the wall or a window; a work island in the middle when the room is wide.
- **Circulation:** a lane from the door to each station; 1.2 m clear in front of each.
- **Story:** the trade shows in the tools and the stock (timber, hides, wool).

### Temple (temple)

- **Where:** a building of its own; the altar at the far end from the door. **(inference from [S13], same axis as the
  great hall)**
- **Anchors:** the altar, benches in rows facing it with a center aisle, lights flanking the altar, banners.
- **Orientation:** everything faces the altar along the long axis.
- **Circulation:** a center aisle 1.5 to 2.5 m wide from the door to the altar; side aisles at the walls in a wide
  room.
- **Story:** offerings at the altar, the patron's emblem.

### Longhouse, open plan (hall in a longhouse)

- **Where:** one long room, the door near one end of a long wall or in the gable end; byre or store at one end, the
  living hall with the long fire in the middle, private space at the other end [S10], [S12].
- **Anchors:** a long fire down the middle; raised benches along both long walls between the posts and the walls,
  used for sitting, eating, working and sleeping [S10]; a box bed for the master and mistress [S10]; storage under
  the benches and at the ends [S10].
- **Orientation:** benches along the long walls face the fire; the high seat in the middle of one bench faces the
  guest seat across the fire [S11].
- **Zones by length:** entry and service end, hall, private end. Proportions vary by family; the hall takes the most.
- **Circulation:** the floor between the benches and the fire, the aisle [S10].

### Other roles in the lab

- **Guard room (guard):** a bed or two, an armor stand, a chest by the door, a table; the way to the ladder clear.
- **Lookout (lookout):** a bench and a chest against the rail; nothing else.
- **Market stall (market):** a counter table facing the front, stock behind it.
- **Farm (farm):** storage rows and a fermenter; animals and pens are outside.

## Adjacency

- Hall next to the kitchen and the service end; the service end next to the door [S12], [S13].
- Private rooms beyond the upper end of the hall, or upstairs [S12], [S13].
- Guest chambers off a passage or gallery, upstairs [S14].
- Smithies and workshops in their own buildings or at the door end of the ground floor [S10].
- Cold storage away from the fire [S12].

## Variance by culture, village and household

Weights shift the layout; nothing below is a rule that always holds. **(inference from [S10] to [S13] and the
culture styles in `docs/CULTURE_STYLES.md`)**

- **Norse, Norse forest, Norse highland:** benches along the long walls facing the hearth; high seat mid long wall;
  box bed; storage at the ends and under benches.
- **Anglo-Saxon, Frankish-Norman, castle medieval:** hall with an upper and a lower end; high table across the far
  end; private rooms beyond; benches at tables along the long axis.
- **Celtic, crannog, Baltic, fen folk:** round or near-square rooms; the hearth in the middle with beds and stores in
  a ring against the wall; the door facing the hearth.
- **Slavic:** the stove or hearth in a corner by the door, the "beautiful corner" diagonally opposite with the table.
- **Saami, steppe:** tent plans; no table; seats and beds on rugs round the fire; the place of honor opposite the door.
- **Byzantine, Middle Eastern, Lamari:** seats along the walls (benches and rugs), the middle left open; a table where
  the culture uses one.
- **Dwarven:** stone rooms with work at the center; more light.

A village draws its schemes once and its houses lean on them, so neighbors share habits. Each household then draws its
own within that lean. The persona hook (below) sets the household's draw.

## Clutter and storytelling

The persona helper (feat/persona) owns the clutter and the story props. The layout gives it:

- free spots by work places (the fire, the bench, the bed's side, the table's end) where clutter belongs [S19];
- a "story spot" per building: a place in view of the main lane, by the focal point or at the end of the main lane,
  kept for the one thing that tells the household's story [S2], [S3], [S9] **(inference)**;
- the tidy or cluttered setting, which moves how far the loose layer may stray from the grid and how much floor it
  may take.

## The planner (stage 2, being built)

`lib/layout.js` reads `data/room-layouts.json` and, for each room the decorator furnishes:

1. Reads the room's frame: the main way in, the depth axis away from it, the long axis, the walls with their plain,
   window and door stretches, the fire's place, the stairs.
2. Lays the lanes: from each door to the hearth or focal point, to each stair and to the other doors, on the 0.5 m
   cells, as the decorator's `planPaths` already does; lanes are laid before any anchor.
3. Draws a scheme for the room's role from the JSON weights, times the culture's lean and the persona's weights. The
   scheme names the zones (which end sleeps, which wall works, where the table stands, where storage gathers).
4. Scores every spot the decorator tries for a bed, table, station, chest, bench or high seat by its zone and the
   orientation rules, so the decorator's placers put each anchor where the scheme wants it; their usual tests
   (nothing through anything, doors and stairs clear, plain wall behind) still decide.
5. After the library and the persona pass have dressed the room, checks the lanes once more and takes out the
   loose piece or library assembly that blocks one, never a bed, station, fire, main chest or table.

The hook for the persona pass is an options object on the decorate context (`ctx.layout`): `{ tidy: 0..1, prefs:
{ ... } }`. `tidy` near 1 keeps the room to the grid; near 0 lets the loose layer stray and take more floor. `prefs`
multiplies the JSON weights by key (for example `{ 'home.scheme.side-sleep': 2, 'table.window': 1.5 }`). See the
comments at the top of `lib/layout.js`.

## Sources

- [S1] Joel Burgess and Nate Purkeypile, "Skyrim's Modular Approach to Level Design", GDC 2013. Write-up:
  https://www.gamedeveloper.com/design/skyrim-s-modular-approach-to-level-design ; slides:
  https://www.slideshare.net/JoelBurgess/gdc2013-kit-buildingfinal
- [S2] Farhang Namdar (Larian Studios), "Building Worlds for an RPG", Dutch Game Garden:
  https://dutchgamesindustry.nl/talk/building-worlds-rpg-farhang-namdar ; interview in PC Gamer:
  https://pcgamer.com/games/baldurs-gate/baldurs-gate-3-dev-spills-the-secret-sauce-players-love-finding-a-place-then-ending-up-2-hours-and-3-puzzles-later-in-a-sacrificial-chamber-of-a-cult-that-murders-giraffes
- [S3] Miles Tost (CD Projekt Red), level design Q&A on The Witcher 3, reported by Wccftech:
  https://wccftech.com/the-witcher-3-dev-answers-questions-level-design/
- [S4] Blizzard, "Azeroth Beautiful: A Look at Housing Interior Design":
  https://news.blizzard.com/en-us/article/24186690/azeroth-beautiful-a-look-at-housing-interior-design
- [S5] Massively OP, "Elder Scrolls Online's Homestead player housing":
  https://massivelyop.com/2017/01/11/tamriel-infinium-elder-scrolls-onlines-homestead-player-housing-blew-my-mind/
- [S6] Enshrouded: comfort guide, https://techraptor.net/gaming/guides/enshrouded-building-and-comfort-guide ;
  craftsmen and their stations (player feedback board),
  https://enshrouded.featureupvote.com/suggestions/646113/comment/717795
- [S7] Harvey Smith and Matthias Worch, "What Happened Here? Environmental Storytelling", GDC 2010:
  https://gdcvault.com/play/1012647/What-Happened-Here-Environmental ; quoted and expanded in Game Maker's Toolkit,
  "How Level Design Can Tell a Story" (transcript):
  https://amara.org/subtitles/Lv64YfjMFhOC/en/1/download/How%20Level%20Design%20Can%20Tell%20a%20Story%20%20Game%20Makers%20Toolkit.en.txt
- [S8] The Level Design Book, "Circulation" and "Typology":
  https://book.leveldesignbook.com/process/layout/flow/circulation ,
  https://book.leveldesignbook.com/process/layout/typology
- [S9] Miriam Bellard (Rockstar North), "Environment Design as Spatial Cinematography", GDC 2019:
  https://gdcvault.com/play/1025736/Environment-Design-as-Spatial-Cinematography
- [S10] Hurstwic, "The Viking Longhouse": https://hurstwic.com/history/articles/daily_living/text/longhouse.htm
- [S11] Hurstwic, "Seating in the Viking hall": https://www.hurstwic.com/history/articles/society/text/seating.htm
- [S12] Wikipedia, "Hall house": https://en.wikipedia.org/wiki/Hall_house
- [S13] Wikipedia, "Great hall": https://en.wikipedia.org/wiki/Great_hall
- [S14] W. A. Pantin and E. Clive Rouse, "The Golden Cross, Oxford", Oxoniensia 1955:
  https://oxoniensia.org/volumes/1955/pantin.pdf
- [S15] Gorin's Furniture, "How to arrange bedroom furniture" (citing Miller Waldrop on 36 in walkways):
  https://www.gorinsfurniture.com/how-to-arrange-bedroom-furniture/
- [S16] Eureka Ergonomic, dining table clearance guide (BIFMA G1-2013 figures):
  https://eurekaergonomic.com/blogs/eureka-ergonomic-blog/dining-table-space-clearance-guide
- [S17] IForgeIron forum, "How much space between stations":
  https://www.iforgeiron.com/topic/33749-how-much-space-between-stations/
- [S18] UESP, "Skyrim Team Diary 6: Hearthfire": https://content2.uesp.net/wiki/General:Skyrim_Team_Diary_6:_Hearthfire
- [S19] Magdalina Dianova, "How to use interior design to build narrative in digital art", Creative Bloq, 2025:
  https://www.creativebloq.com/art/digital-art/how-to-use-interior-design-to-build-narrative-in-digital-art
- [S20] Josh Lynch, "5 rules of environment design", 80.lv, 2016: https://80.lv/articles/5-rules-of-environment-design

Searched and found little to cite on room layout: Larian has no public written talk on interiors beyond [S2]; ESO
and WoW write about tools more than layouts; the Witcher 3 environment interviews on 80.lv are short teasers.
