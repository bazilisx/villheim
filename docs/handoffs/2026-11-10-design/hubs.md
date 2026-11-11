# Hub track: the central hearth per culture, growing with the village

Branch `design/wip-hubs`, from main 644e888. Docs and data only; no generator or mod code changed. Roadmap item 2i
("Generator, design session"). State on 2026-11-11 (Mountain Time): plan written; generator work waits for the interior
tracks to merge.

Tyler's request (2026-11-11): "we have to design the central hearth area for each culture that levels up over time.
The hearths are the same idea as the town halls in Millenaire: the central spot in the middle the village, where
everyone gathers outside of work or home life. It's where the leader spends the most time too. In some villages, it
could be the longhouse idea but in others, a circular structure that grows larger and grander each stage, with more
and more stories and opulent architecture. In most villages, at the max stage, it will be the grandest structure. In
earliest stages of villages, it will be fairly spartan and only a campfire and series of leantos surround those."

Tyler on hub1 (2026-11-11): "S5 was a large round thatch roofed winter structure (largely broken) with icicles on it.
A prefab I was gonna to fix up. Rocks and for trees too. And s3 and s4 were going to differ slightly. I was modifying
s3 to simplify it from s4 Ie not the inner roof, simpler interior fire etc."

## Files

- `tools/blueprint-lab/data/hubs/hub1.json`: measures of Tyler's hub1 saves and drafts (counts by class, material and
  prefab, footprint, height, floor and roof levels, distances from the fire, lean-to groups), a plain reading of each
  stage, and the s5 candidates. No piece list.
- `tools/blueprint-lab/data/hubs/corpus-gathering.json`: gathering places in the corpus by kind and culture group
  (camps, halls, round halls, temples, taverns, squares, whole villages): sizes, storeys, plans, roofs, where the fire
  is, seats and rugs by the fire, thrones; the eight most downloaded of each kind by title and maker.

## 1. Tyler's hub1 (Meadows hearth board)

Folder: `BepInEx/config/Villheim/blueprints/inspiration/board/` in the Villheim Test profile, read only; nothing there
was changed or moved. Saves hub1_s1d2 (73 pieces) and hub1_s1d3 (122); drafts hub1_s2d3 (61), hub1_s3d3 and
hub1_s4d3 (1,006 each). File times are 2026-11-08 01:54 UTC for the three drafts and 03:59 and 04:04 UTC for the two
saves (2026-11-07 18:54, 20:59 and 21:04 Mountain Time; the saves' own descriptions give 20:59 and 21:04). No s1d1,
s2d2, s2d1 or s5 file exists. The drafts are what the board kept when it was last taken down, so work on s3 to s5
done after 18:54 MT on 2026-11-07 may still stand on the board in Tyler's flat test world (vhtest5); the steps to save
it are the lead's to give.

What each stage is (measures in `hub1.json`):

- **s1 (d3 and d2): a campfire ring with three lean-tos.** About 19 m across, no walls. A fire pit in the middle with a
  cooking station over it; three log benches 3 m from the fire, each in line with a lean-to. Three lean-tos 5.4 to
  8.8 m out, 113 to 134 degrees apart, open side to the fire: two 2 m log posts, a 4 m log beam at 2.1 m, four 26
  degree thatch pieces in two rows down to the ground (4 m wide, about 4 m deep, 2 m high at the front). The notice
  board (Tyler's villagenotice) at 9.2 m between two lean-tos, with chests beside it. Four path markers. d3 adds a ring
  of beams round the fire, deer rugs under the lean-tos, eight ground torches, two chests, a second cooking station and
  berry bushes, dandelions and mushrooms round the edge; d2 is d3 with that decor taken away (every d2 prefab count is
  in d3).
- **s2 (draft): a started round wall.** 29 plank walls in a ring 20.3 m across (a 32-wall ring with gaps one and two
  walls wide) and the first ring of 45 degree thatch at 2 m. No fire, floor or furniture yet. The ring stands just
  outside the s1 lean-tos and notice board (all within 9.7 m of the fire), so the round hall can go up round the camp.
- **s4 (draft): a 16-sided round hall, 20 m across inside the wall, 11.5 m high, two roofs.** Hearth in a sunken stone
  floor ringed by 24 stone steps (r 5.3) up to a raised wooden ring floor at 2 m; 16 inner posts at r 6.3 carry a drum
  with 16 windows at 7.5 m and an upper ring floor at 7 m, open over the fire; an outer ring roof from the 4 m eave to the
  drum, and an inner cone to 11.5 m. Main door with outside stairs and torches at one side; a back stair to a loft and
  the 7 m floor. On the ring floor: a smithy corner, a workbench corner, two beds opposite each other, a table with
  five chairs, chests, armor stands, rugs and 16 item stands along the wall. Outside on the ground: fermenters, a
  bathtub, chests, a cart, crates, wood stacks. Seating round the fire is the stone step ring and four fur rugs; no
  chair or bench stands within 6 m of the fire; no throne; doorways have no doors.
- **s3 (draft): the same 1,006 pieces as s4** (1,005 of 1,006 match by prefab, distance from the hearth and height). By
  Tyler's note, s3 was to be s4 without the inner roof (the cone, 75 thatch pieces and the ridge top over the drum) and
  with a simpler fire than s4's sunken stone hearth with cauldron, butcher table and rack.
- **s5 (no file): "a large round thatch roofed winter structure (largely broken) with icicles on it".** Best candidate
  found: **MWL_MountainsHogan1** (More World Locations AIO, installed in the profile): about 30 x 31 m and 15.5 m high,
  1,162 pieces, 196 thatch roof pieces, log walls on an upper storey from 4 to 12 m, floors at 7.8 to 11.8 m, 38 icicle
  pieces (`caverock_ice_stalagtite` and `_stalagmite`), 8 fir and pine trees and 9 rocks. The other Mountain locations
  in the pack with icicles (Pagota, Aedicule, Tower) are stone and square or tall and narrow. Vanilla locations were
  not searched. Plan for s5: the Hogan repaired: whole roof and walls, the icicles, trees and rocks left outside the
  plot or kept at the edge as the setting, lived in like s4 (sunken hearth ring, raised ring floor, upper floor),
  and the grandest stage at about 30 m across and 15 m high.

The line keeps one shape family throughout: a ring round one fire (camp ring, round wall, 16-sided hall, round hall).

Things to settle before villages use hub1 (rows below): s1 uses 12 core wood pieces (log posts, log beams, log benches)
and s4 uses core wood 99 and iron 51 (48 `woodiron_pole`). Core wood comes from the Black Forest, a Meadows neighbor;
iron comes from the Swamp, two biomes out (CLAUDE.md "Biome materials", D-125: building pieces mostly from the village
biome and the biomes around it). s4 holds one
mod piece, `MWL_PlainsTrainer1_Trainer`, 3.5 m from the hearth, which the vanilla rule keeps out. The Hogan is a mod
location; CLAUDE.md lets designs come from installed mods' locations as long as the pieces are vanilla (its children
are vanilla prefabs by name).

## 2. The corpus: gathering places by culture group (D-136, counts first)

From the research track's `feat.jsonl` (2,153 builds) and culture sort (`builds.json`, branch `design/wip-research`),
plus a rerun over the matching builds for where the fire stands and what is round it. Builds were matched by title
words (folders longhouse, temple, tavern and village as fallback); statue, bridge, arena, mini-game, portal-hub,
farming and artistic folders were left out; 40 or more building pieces (8 for camps). 218 builds. Full numbers in
`corpus-gathering.json`; medians below.

| Kind | n | Size (m) | Height | Storeys | Fire in build | Fire place (middle / mid / edge) | Fire at a wall | Seat within 4 m of a fire | Throne |
|---|---|---|---|---|---|---|---|---|---|
| Camp | 7 | 8 x 8 | 2.9 | 1 | 86 % | 31 / 23 / 46 % | 23 % | 31 % of fires | 0 % |
| Hall (all) | 86 | 22 x 36 | 12.9 | 3 | 94 % | 30 / 38 / 32 % | 51 % | 33 % | 66 % (32 % at an end of the long axis) |
| Hall, Norse group | 60 | 20 x 36 | 11.0 | 3 | 93 % | 34 / 38 / 28 % | 49 % | 44 % | 62 % (34 % at an end) |
| Hall, castle and stone | 10 | 25 x 37 | 16.0 | 4 | 90 % | 33 / 33 / 33 % | 46 % | 13 % | 80 % (47 % at an end) |
| Hall, later biomes | 5 | 31 x 46 | 14.9 | 3 | 100 % (7 per build) | 15 / 38 / 48 % | 75 % | 6 % | 80 % |
| Round hall | 9 | 27 x 30 | 11.2 | 3 | 67 % | 55 / 18 / 27 % | 9 % | 27 % | 56 % (15 % at an end) |
| Temple | 38 | 23 x 40 | 17.8 | 3 | 39 % | 25 / 14 / 61 % | 35 % | 10 % | 34 % (61 % at an end) |
| Tavern | 50 | 19 x 28 | 14.1 | 3 | 90 % | 24 / 29 / 47 % | 74 % | 51 % | 52 % |
| Square, market, town hall | 17 | 21 x 24 | 10.0 | 2 | 24 % | 71 / 29 / 0 % | 29 % | 57 % | 18 % |

Readings:
- Halls are the corpus's main gathering building: 86 by title, against 7 camps and 17 squares or town halls. The Norse
  group's halls (20 x 36 m, 3 storeys, 11 m) are larger than Norse builds in general (median footprint 17 x 24 m in the
  research summary), so a hall-sized last stage matches the "grandest structure" idea from the corpus side too.
- Halls are long (aspect 1.8 in the Norse group); gable roofs 63 %, cross-gable 25 %, conical 7 %. Round halls are few
  (9: 3 unsorted, 2 fantasy, 2 castle, 1 Norse temple, 1 Ashlands) and nearly all conical; their fire is in the middle
  55 % of the time, against 30 to 34 % in long halls.
- Fires in halls are covered 83 to 87 % of the time and stand at a wall half the time (hearth walls and wall fires),
  so a hall hub has a middle fire and often a second fire at a wall.
- Seats rarely ring a fire: 33 to 44 % of hall fires have any bench or chair within 4 m; rugs by the fire are more
  common (47 to 51 %). Taverns are the exception (51 % of fires seated). hub1 s4 matches this: rugs and a step ring,
  no chairs, by the fire.
- A throne (`piece_throne01`, `02`) stands in 62 to 80 % of halls; a third to a half of them at an end of the long axis,
  the rest along the sides. Temples put the throne at the end 61 % of the time.
- Camps are thin evidence (7 builds); hub1 s1 is the main reference for the spare first stage. No vanilla tents or
  awnings were found by name in the matched builds.
- Most downloaded halls: Dawn Hill Retreat (AstridSinjesdottir, 832), Nuhedeby Longhus (Jarl_Bjorn_KrigsRavn, 824,
  32 x 52 m, 14 m, seven fires, three in the middle with 10 to 12 seats near them), The Lost Hall of Aegir (doublea1ron,
  718), Longhouse with crafting area (Dremka, 656). Round: Elven Feast Hall (Con Seannery, 505, 27 x 32 m, 14 m),
  Meeting Hall at the Portal Hub Hull (AstridSinjesdottir, 380, 22 x 23 m, 11 m, conical, fire in the middle).

Caveats: titles decide the kind, so a "hall" can be a whole base; the culture sort is coarse (research.md); fire place
uses the floor's main axes, which is rough for irregular plans.

## 3. Millénaire town halls (study only) and outside sources

Millénaire 9.0.3 (`Inspiration/millenaire-9.0.3.jar` in `Inspiration.zip`), the town hall plans and their level
schematics, read for numbers only (All Rights Reserved; nothing copied). 29 town hall plans across 7 cultures (player
plans and sub-buildings left out):

- **Levels:** 4 to 18 per plan, median 8. Byzantine church 14, fortress 18; Norman manor 11, abbey 11, "Place du
  village" (the village square as town hall) 10; Inuit council house 7.
- **The plot is the last level's from level 0.** Width and depth never change; only the height grows (manor 21 to 26 m
  at level 7; Byzantine church 13 to 25 at levels 1, 8 and 10; Norman abbey 9 to 54 over eight levels; Inuit council 8
  to 11). Same rule as D-083 (first plot big enough for the last stage).
- **Level 0 lays a large share** (13 to 65 % of all blocks, median about 40 %, including the ground work): the base
  across the whole plot. Later levels add in parts, each over a smaller area than the plot.
- **The tall parts come late:** the church's tallest parts at levels 8 and 10 of 14, the palace's at 10 of 13, the
  Indian fort's at 13 of 14. Glass comes in the middle (levels 4 to 7). The most decor goes in at middle and late
  levels.
- **The town hall gains functions as sub-buildings:** inn (manor from level 0; four Seljuk town halls), markets
  (kastron, Seljuk market), archives (kastron level 10), school and warehouse (church level 2), towers and temple
  (forts level 7). Tags at late levels: leisure, garden.
- **Kinds:** a hall or manor (Norman), a square (Norman), a church or mosque (Byzantine, Seljuk), a fort or palace
  (Indian, Japanese, Seljuk), a council house or kashim kept low (Inuit, 5 to 12 m high at the end).

Outside sources for thin cultures (D-135, facts only, Wikipedia CC BY-SA 4.0, read through Chrome 2026-11-11):
- **Navan Fort (Emain Macha), Ireland:** in the 1st century BC a round timber building 40 m across, an outer wall and
  four inner rings of posts round a central oak pillar about 13 m tall, western entrance; earlier a figure-of-eight of
  30 m and 20 m rings with a hearth in the smaller one; all inside a 250 m ring bank. A grand round hub for the Celtic
  cultures: rings of posts that multiply with size.
- **Yeavering (Ad Gefrin), Northumbria, 7th century:** great halls up to about 300 m2, twice as long as wide, one room
  with small end partitions, later rebuilt with annexes at the ends and rooms inside; a "Great Enclosure" interpreted
  as an assembly place; a timber auditorium of nine concentric trenches, a wedge of tiered seats for about 300 facing a
  platform that may have held a throne. For anglo-saxon: the hall grows annexes, and a tiered seating stand is a
  grand late addition.
- **Groß Raden, Mecklenburg, 9th and 10th centuries:** a Slavic temple settlement with a ring rampart 50 m across on a
  peninsula (the Wikipedia page is a stub; nothing more on the temple's size).

## 4. The plan per culture

Rules that shape every line:
- **Shape family stays** (D-132): a long hall stays a long hall, a round stays round, a court stays a court. Fires,
  furniture, walls and decor may move and change between stages.
- **One plot for all five stages** (D-083, and Millénaire's town halls): the s1 plot is sized for s5, and the s1 camp
  sits inside the s2 wall line (hub1 s2's ring stands just outside the camp).
- **Materials by stage** (CLAUDE.md "Biome materials", D-125, D-012, D-131): walls, roofs, floors and beams mostly
  from the village biome and the biomes around it (core wood from the Black Forest is a Meadows neighbor; iron from
  the Swamp is two biomes out); Meadows and Black Forest hubs in wood at s1 and s2; stone hearths from s2 (D-131);
  stone footings and walls at s4 and s5, the hub being an advanced building (D-012); what the chests hold pays for it,
  whoever brought it (D-007). Decor and furniture from any biome (D-065, D-126).
- **s1 is spare everywhere:** a campfire, two to four shelters round it open to the fire (lean-tos, or the culture's
  own shelter: an awning, a small tent), log benches, the notice board and chests. hub1 s1 is the reference.
- **s5 is the grandest structure** in the village in every culture except where the plan says otherwise (saami),
  measured as the largest floor area and, in most lines, the tallest.
- **Sizes for s4 and s5 from the corpus:** halls 20 x 36 m and 11 m (Norse group) to 25 x 37 m and 16 m (castle and
  stone); round halls 27 x 30 m and 11 m; temples 23 x 40 m and 18 m; 3 storeys (medians, section 2). hub1 s4 (20 m,
  11.5 m) and the Hogan (30 m, 15.5 m) sit in that range.
- **Fire and seating from the corpus:** the main fire in the middle in round lines (55 %) and in the middle or the
  middle third of long halls (72 %); a second fire at a wall in about half of halls; rugs by the fire about half the
  time, benches near it less; a throne or high seat in about two thirds of halls, a third to a half at an end.

| Culture (biome) | Leader | Shape family | s1 | s2 | s3 | s4 | s5 (grandest) |
|---|---|---|---|---|---|---|---|
| norse (Meadows) | Jarl | long hall; hub1 is a round line (D-137) | campfire, 3 lean-tos, benches, notice board (hub1 s1) | small open-ended hall over part of the camp, wood | longhouse with aisle posts, stone hearth (D-131) | great hall, loft or gallery, high seat, second fire at a wall | mead hall about 20 x 36 m, 2 to 3 storeys, dragon heads, side rooms (corpus Norse hall median) |
| anglo-saxon (Meadows) | Reeve | long hall, doors in both long sides | as norse | hall twice as long as wide, one room | hall with an end partition | hall with annexes at both ends, rooms inside | great hall about 300 m2 with annexes, a tiered timber seating stand outside facing a platform (Yeavering) |
| frankish-norman (Meadows) | Lord | long hall with a keep | as norse | timber hall | hall with a timber tower at one end | stone ground storey, hall over an undercroft, low yard wall | stone keep of 3 storeys joined to the hall, yard; no gate that shuts a player out |
| norse-forest (Black Forest) | Jarl | stave hall | campfire, log lean-tos | log hall | stave hall with the low gallery roof all round | stave hall on stone, two roof tiers | stave hall with three roof tiers and dragon heads, the tallest building |
| celtic (Black Forest) | Chief | round | campfire, lean-tos in a ring | roundhouse 9.7 m | round hall 14.5 m, porch | round hall about 20 m, inner post ring (hub1 s4 is this form) | great round about 30 m, two inner post rings, central post or open crown (Navan Fort) |
| slavic (Black Forest) | Elder | log hall | campfire, log lean-tos | log hall, porch | hall on a log ground storey (podklet), outside stair | terem of 2 to 3 storeys with a gallery | terem with a tower and carved gables over a square |
| celtic-crannog (Swamp) | Chief | round on a platform | campfire on a deck at the shore end of the walkway | roundhouse 9.7 m on stilts | 14.5 m on a wider deck | about 20 m, deck all round, railing | great round about 20 to 30 m on its own platform with a causeway (Crannog Centre house 15 m) |
| baltic (Swamp) | Chief | long log hall (rija) on a platform | campfire on the platform | log hall | longer hall with a granary on posts beside it | rija 12 to 22 m with a loft | long log hall at the platform's center, lane round it, gallery |
| fen-folk (Swamp) | Chief | aisled longhouse, hipped | campfire on the mound top | aisled hall on posts | longhouse with byre end | longhouse with walkways to it | longhouse 25 to 35 m with low hipped roof, the houses set round it (Old Frisian) |
| norse-highland (Mountain) | Jarl | gables in a row with a hall behind | campfire behind a low stone windbreak | one gabled house | two gables and a long fire hall | three gables, hall behind | hall farm about 28 m (Stöng), benches along both walls; the Hogan is the alternative (D-137) |
| saami (Mountain) | Elder | round, low | campfire, lavvu | gathering goahti 9.7 m | goahti 14.5 m | two goahti joined, storehouses on posts | the largest goahti (about 20 m) with a ring of lavvu and storehouses; grandest by floor area while staying low (Millénaire's Inuit council stays 8 to 11 m) |
| middle-eastern (Plains) | Sheikh | court | campfire under an awning (trader awnings, D-013) | one wing with an arcade on a paved yard | three wings and a well | four wings, an iwan facing the yard, a tower | courtyard of 24 m or more with iwans and corner towers, a raised seat in the main iwan |
| byzantine (Plains, Mistlands) | Archon | cross-domed church on a square | campfire on paving | chapel 6 x 6 m | cross 10 x 10 m with a dome | cross-in-square 14 x 14 m with a narthex | domed church with an arcaded square in front; the dome comes late (Millénaire's church: tallest parts at levels 8 and 10 of 14) |
| steppe (Plains) | Beg | round (yurt) | campfire, felt lean-tos or awnings | great yurt 9.7 m | great yurt 14.5 m | great yurt with smaller yurts joined by covered ways | the largest yurt the lab can lay (about 20 m) in a ring of yurts, seat of honor opposite the door |
| lamari (Mistlands) | Elder | hall with towers | campfire by a marble wall | machub hall | hall with a 4-storey tower | darbazi hall (stepped roof with a smoke hole, not built yet) | hall with two towers and a drum church, the towers the tallest |

Where the leader sits, by line: a high seat or throne on the long axis or at the middle of a long side facing the fire
(halls; the corpus places it at an end in a third to a half of halls); opposite the door (round lines: steppe, saami,
celtic); in the main iwan (court); at the east end (byzantine church). hub1 s4 has no throne; its two beds opposite
each other on the ring floor and the table with five chairs are the leader household's places in that design.

Gathering zones every hub has, from s1: the ring round the fire (benches at about 3 m in s1; rugs and steps later), a
work and storage edge (chests, notice board, stations), and the door side where the roads join (path markers). From
s3 or s4: a raised or upper floor (hub1 s4's 2 m ring and 7 m floor) and a second fire at a wall in long halls.

## 5. What the generator needs

- **A building type `hub`** in the lab (`lib/request.js` refuses `hub` and `hearth` today: "the lab has no hub or
  hearth design yet"). Five structure stages: the lab's styles hold s1 to s3 (`lib/styles.js` sizes), the board has
  five hub plots, and the mod has four village stages (camp, hamlet, village, town; `LogicConfig.cs` text). D-138.
- **A growth path per culture** as the table above: s1 a camp generator (fire, ring of shelters by count and angle,
  benches, board); s2 to s5 the culture's form (`round`, `stave`, `court`, `keep`, `dome`, `yurt`, `gables`,
  `svan`) at growing sizes, all on the s5 plot.
- **Checks:** shape family kept between stages (D-132, a report and a gate on the family only); the s1 camp inside
  the s2 wall line; the main fire's place by line (middle for round lines; middle third for long halls); a leader
  seat present from s3 (by the corpus throne rate, as a measure); one or more path markers at the door side; s5 floor
  area and height the largest in the culture's s5 set (or flagged); the biome material rule per stage; vanilla pieces
  only.
- **A marker for the leader's spot** (like the `#VillheimPaths` markers) so the mod can send the leader there. Mod side.
- **hub1 as a line:** hub1 s1, s2 to s4 and an s5 from the Hogan become the reference set for the round line, once
  Tyler saves s2 and s3 and the questions below are answered.

## 6. How the mod uses the hub today (read only, `src/Villheim.Logic`)

- `Designs/Culture.cs`: `Role.Hub` is a role like House or Workshop. `Village/VillageBrain.cs` `RoleName`: a hub is
  called a "longhouse".
- `Village/Growth.cs`: the hub has the highest build priority (10, homes 6) and is urgent right after every villager
  has a bed; only one is built.
- `Village/PlotFinder.cs`: the hub goes on the village axis straight behind the hearth (0 to 0.6 of the ring range).
- `Village/VillageBrain.cs:396`: "The hearth is the village hub and is never built over (Tyler, 2026-11-09), so no hall
  goes up around it." The AroundHearth placement (a hall with the fire inside) is off since 2026-11-09 (daily note
  2026-11-09: a hall went up round the hearth). hub1 s2 to s4 put a hall round the central fire, so this rule and the
  hub designs need one answer (D-139).
- `Village/Amenities.cs`: once the hub stands, benches round the fire, a wood stack and a stone pile, on rings 5.5 m and
  8.5 m round the hearth.
- `Village/PathPlanner.cs`: roads join the hub's path markers.
- `Villagers/Roles.cs`: a villager with no home shelters in the hub. The leader has a title per culture
  (`Cultures/cultures.txt`: Jarl, Reeve, Lord, Chief, Elder, Sheikh, Archon, Beg) and takes a trade like anyone; no
  code was found that sends the leader to the hub.
- Designs: with TestPool on, the hub comes from the pool's "hall" line (type longhouse, `Generator/TestPool.cs`).
  Board saves are read with TestPool on (`Designs/Blueprints.cs` `OutsideTestPool`) but inspiration designs are not
  put in the pools (`Designs/DesignLibrary.cs` `AddBlueprints`), so villages never build hub1. D-120 (Tyler: villages
  build only "the saved hub1 variants (for the hearth)" and the test pool) is Answered with "Not set to match yet".
- D-067 (Tyler, "Your answer"): "we treat the hearth as the central village hub, and it itself is an evolving
  structure around the primary hearth fire."

## Proposed Decisions rows (for the lead to add)

- **D-137 Hub shape per culture: which lines are round.** The corpus gives Norse halls as long (63 % gable, 7 %
  conical); hub1 is round. Options: A) Norse Meadows hub is round (hub1) only; B) Norse has two lines, a long hall from
  the corpus and hub1's round, picked per village; C) hub1 becomes the celtic hub and Norse keeps the long hall;
  the Hogan s5 also fits norse-highland and saami. Recommendation: B, with the Hogan as the round line's s5.
- **D-138 Hub stages and village stages.** The board has five hub plots, the mod four village stages (camp, hamlet,
  village, town). Options: A) a fifth village stage; B) hub s5 comes after town on hearth level alone; C) four hub
  stages. Recommendation: B (keeps the five stages Tyler built toward).
- **D-139 Building round the hearth.** VillageBrain keeps the hearth from being built over (2026-11-09); D-067 and
  hub1 s2 to s4 put the hub round the hearth fire. Options: A) the hub is the one building allowed round the village
  hearth, the fire staying where the hearth is; B) the hub's fire is its own and the hearth stays outside the door;
  C) the hub from s2 on is built round the hearth, s1 stays open. Recommendation: A.
- **D-140 hub1 materials.** s1 uses core wood (12 pieces) and s4 core wood (99) and iron (51 woodiron poles) in the
  Meadows. Options: A) keep both, paid from what the chests hold; B) swap both to wood poles and beams for the Meadows;
  C) keep core wood (the Black Forest is the neighbor), swap the iron poles for log poles. Recommendation: C.
- **D-141 The leader's spot.** No code sends the leader to the hub. Options: A) a leader marker in hub designs (like path
  markers) and daytime hours there; B) the leader sits at the hub's high seat or throne when there is one; C) both.
  Recommendation: C.
- **D-142 s3 for hub1.** The s3 draft is a copy of s4. Options: A) Tyler finishes s3 on the board (no inner roof,
  simpler fire); B) the generator makes s3 from s4 by those two rules for review. Recommendation: A, with B as a draft
  for him to start from.

## Next

1. Save what still stands on the board: hub1 s2 to s5 in the flat test world (steps from the lead).
2. **Follow-up task (asked by Tyler 2026-11-11, through the lead):** search the whole corpus for large, grand buildings
   that fit the hub's role (great halls, mead halls, round halls, temples, keeps, gathering halls) as inspiration for
   each culture's final stage (s5). For each culture group, record the best candidates with title, maker, downloads,
   size, storeys, form and what makes them grand, all from counts and measures (D-136). Start from
   `corpus-gathering.json` and `$HOME/vhhub/rows.json` on the device (218 matched builds with fire places); widen the
   match beyond titles (floor area, storeys, height over the culture's median) and add keeps.
3. After the interior tracks merge: the `hub` type and the s1 camp generator, then the round line from hub1, then the
   other forms in the table.

## Commands (device, `$HOME/vhhub`; scripts kept out of the repo, copies in `/tmp/h6-scripts/` in the cloud)

```
# lab parser from the public repo at 644e888
curl -sSL -o repo.tgz https://codeload.github.com/bazilisx/villheim/tar.gz/644e888 && tar xzf repo.tgz --wildcards '*/tools/blueprint-lab/lib/*' '*/tools/blueprint-lab/data/*.json'
B="$HOME/mnt/r2modmanPlus-local--Valheim/profiles/Villheim Test/BepInEx/config/Villheim/blueprints/inspiration/board"
node measure.js lab m.json "s1d2=$B/hub1_s1d2.blueprint" "s1d3=$B/hub1_s1d3.blueprint" "s2d3=$B/drafts/hub1_s2d3.blueprint" "s3d3=$B/drafts/hub1_s3d3.blueprint" "s4d3=$B/drafts/hub1_s4d3.blueprint"
node detail.js lab "$B/drafts/hub1_s4d3.blueprint"            # per prefab and height: count, distance and bearing from the fire
node same.js lab "$B/drafts/hub1_s3d3.blueprint" "$B/drafts/hub1_s4d3.blueprint"
# s5 candidates (pip install --user UnityPy "attrs>=23"; run with -E; -I hides the user site)
python3 -E bund2.py ".../warpalicious-More_World_Locations_AIO/Bundles/mwl_mountainshogan1"
# corpus gathering places from the research track's files
node hubmine.js lab $HOME/mnt/Downloads/Villheim-blueprints $HOME/vhresearch/feat.jsonl $HOME/vhresearch/out/builds.json rows.json
node hubagg.js rows.json gathering.json
# Millenaire town halls (cloud, /tmp/h6-mill): unzip the jar from Inspiration.zip, then
python3 -I /tmp/h6-scripts/nbtlevels.py jar/millenaire/cultures
```
