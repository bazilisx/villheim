# Culture styles

Building style guides for Villheim's village cultures, and how the blueprint lab builds each one. Villages are echoes
of the Viking-age world the heroes came from, so each culture follows real building traditions of roughly the 8th to
11th centuries, with older forms where a people kept them (crannogs, roundhouses, goahti).

Written 2026-11-08 on branch `night3/styles`. Code: `tools/blueprint-lab/lib/styles.js` (cultures, weights, kits),
`lib/generate.js` (forms), `lib/gen_cultures.js` (sample set). Overview pictures: `docs/cultures/<key>.png`.
Nothing here is used by villages yet; generated designs stay apart as `docs/BLUEPRINT_LAB.md` "Rules" says.

## Rules followed

- Vanilla pieces only (D-013: anything that ships with vanilla Valheim 1.0, Deep North included, trader decorations,
  tents and awnings; nothing from mods). Each biome uses its own materials: Meadows has no stone or core wood.
- Meadows and Black Forest build in wood at s1, and at s2 except halls, temples and towers; stone comes at s3 and in
  s2 halls (D-012). The generator drops stone walls and stone footings for those cases.
- Villages are a place of rest. Defensive forms (keeps, Svan towers, lake forts) are kept as the culture's look;
  palisades and gates that would shut a player out are left out of single buildings.
- Ideas and measurements only from outside sources. No building is copied whole from any source. Millénaire stays
  study material: only its plan, roof, proportion and room-use counts were read (from `/home/claude/corpus/learn-mc/`),
  for Byzantine, Middle Eastern (Seljuk) and Frankish-Norman (Norman); never its materials, scorer or Norse rules.
- Every generated sample passes `lib/checks.js` (support, overlap, doors, materials, space): 147 of 147.

## Cultures per biome

Weights are provisional (Tyler, 2026-11-08; Mountain even, D-039). `S.cultureFor(biome, R)` picks by weight.

| Biome | Cultures (weight) |
|---|---|
| Meadows | norse 5, anglo-saxon 3, frankish-norman 2 |
| Black Forest | norse-forest 5, celtic 3, slavic 3 |
| Swamp | celtic-crannog 3, baltic 3, fen-folk 3 |
| Mountain | norse-highland 1, saami 1 |
| Plains | middle-eastern 3, byzantine 3, steppe 3 |
| Mistlands | byzantine 3, lamari 4 |
| Ashlands | castle-medieval 1 (lab style; no approved culture yet) |

The older lab styles (`black-forest`, `swamp`, `mountain`, `east-asian`, `castle-medieval`, `dwarven`) stay on the
request page marked "(lab)". Villages never pick them. No Mayan, Japanese, Fuling or Dvergr culture.

## Piece kits per biome

Exact prefab names the generator uses. Later biomes keep earlier pieces.

| Biome | Walls | Frame | Roof | Floor and openings |
|---|---|---|---|---|
| Meadows | `woodwall`, `wood_wall_half`, `wood_wall_quarter`, `wood_beam_45` (braces) | `wood_pole2`, `wood_pole`, `wood_beam` | `wood_roof`, `wood_roof_45`, `wood_roof_top`, `wood_roof_top_45`, `wood_roof_ocorner(_45)`, gables `wood_wall_roof(_45)` | `wood_floor`, `wood_floor_1x1`, `wood_door`, `wood_gate`, `wood_fence`, `wood_stair`, `wood_stepladder` |
| Black Forest | `wood_wall_log`, `stone_wall_2x1`, `stone_wall_1x1`, `stone_wall_4x2` | `wood_pole_log`, `wood_pole_log_4`, `stone_pillar` | as Meadows | `stone_floor_2x2`, `stone_arch`, `stone_stair` |
| Swamp | as above | as above, and `woodiron_beam`, `woodiron_pole` | as Meadows | as above |
| Mountain | as above | as above | as above | `crystal_wall_1x1`; red jute for `piece_cloth_hanging_door` |
| Plains | as above | `darkwood_pole`, `darkwood_pole4`, `darkwood_beam`, `darkwood_beam_45` | `darkwood_roof`, `darkwood_roof_45`, `darkwood_roof_top(_45)`, `darkwood_roof_ocorner(_45)` | as above |
| Mistlands | `blackmarble_2x1x1`, `blackmarble_1x1` | `blackmarble_column_1` | as above | `blackmarble_floor`, `blackmarble_arch` |

Roof sets a culture may ask for in any biome that has them: thatch (`wood_roof*`: reed, straw, and the stand-in for
turf and felt) and dark wood (`darkwood_roof*`: shingle, slate, lead and tile stand-in, Plains on: dark wood takes tar,
which comes from the Plains). Every house door is `wood_door` (2 m) or, where the culture uses one and red jute is in
reach, `piece_cloth_hanging_door` (3 m); `darkwood_gate` (4 m tall) is never used as a house door.

Measured in the corpus this session (`lab/offsets.js`, now in `lib/pieces.js`): a `stone_pillar` is 2 m tall and
stands on a 1 m `stone_wall_1x1`; a `stone_arch` is 2 x 1 x 1 m with its top level with pillar tops 1.5 m to either
side, so a stone arcade has a 3 m bay; a `blackmarble_arch` spans 2 m between `blackmarble_column_1` columns, which
stack every metre; `stone_wall_1x1` is a 1 m cube. A hanging cloth door takes red jute (Cultists, Mountain), so
cloth doors appear from the Mountain on.

Vanilla pieces outside the hammer that D-013 now allows and the lab does not place yet: `turf_roof` and
`turf_roof_top` (one corpus turf house, `vh/other/icelandic-tuft-house`, lays 161 of them tilted by hand about 30
degrees, so their shape is unknown), trader tents and awnings. Their sizes need the in-game piece export
(`vh exportpieces`) before the generator can use them. Until then thatch stands in for turf and felt.

## Forms the generator builds

| Form | Used by | What it is |
|---|---|---|
| `round` | celtic, celtic-crannog, saami (goahti) | eight walls of 2, 4 or 6 m a side (4.8, 9.7, 14.5 m across), ring roof whose first ring is a 26 degree eave (1 m drop) and then 45 degree rings; a porch on 4 m sides; on stilts with a deck, a walkway and a stair (crannog) |
| `tent` | saami (lavvu) | cone of 45 degree rings from the floor, a doorway in the first ring, dark roof from the Plains on |
| `yurt` | steppe | 2 m lattice wall (plank with a brace each bay), low 26 degree cone starting at the wall top, open crown |
| `gables` | norse-highland | 1 to 3 narrow houses (6 m wide) side by side, wooden gable fronts and doors to the yard, stone side and back walls, the middle house deeper at s3 |
| `court` | middle-eastern | four wings round a yard, a gallery on the yard side with a stone arcade (3 m bays) or marble arcade (2 m bays), one door per wing, paved yard with a well; corner towers on s3 caravanserais |
| `keep` | frankish-norman | square keep, 2 to 3 storeys of 3 m; stone with flat buttresses and a parapet, or timber with a pyramid roof where stone is not used yet |
| `svan`, `tower-svan` | lamari | stone house with a 6 x 6 m tower of 4 or 5 storeys at a back corner; the tower alone 4 to 6 storeys; wooden floors, slit windows, low pyramid roof |
| `dome` | byzantine | s1 square chapel; s2 and s3 equal-armed cross; four columns carry a ceiling; drum with windows; stepped dome (45 then 26 degree rings) or a low dome on small drums |
| `drum` | lamari | hall church with a drum and a cone over the middle |
| `stave` | norse-forest | plank walls 4 m high on log posts, steep roof, dragon heads, a low gallery roof all round on posts |
| `sunken` | anglo-saxon | small hut with the roof down to the ground and the door in the gable end |
| `open` | steppe, fen-folk | posts and a roof, no walls, things stand along the floor's edge |
| `raised` | norse-forest, slavic, baltic, saami | storehouse on posts (2 m posts with a landing and stair for Saami) |
| plans `nave`, `greek`, `court`, `gables` | any | also on the request page's plan menu |

Other culture switches: `opposedDoors` (Anglo-Saxon), `podklet` log ground storey (Slavic s2 and s3), `kick` 26
degree eave row under a 45 degree hip (fen-folk), stone masonry gable ends for stone cultures, a landing and stair
to any 2 m high door, walkways from the door (crannog, fen-folk), `stiltChance` (fen-folk on stilts 40 % of the time,
on a low mound of posts otherwise; D-038).

## Meadows

### norse

Who and why: the Norse of Scandinavia, the heroes' own people; the Meadows are home. Unchanged from the lab.

- Buildings: home (rectangular house), longhouse (hall), smithy and workshop, storehouse, barn, dock.
- Plans: rectangle 6 to 10 m by 4 to 6 m for houses; halls long, 12 to 22 m by 6 to 10 m.
- Build-up: timber frame of `wood_pole2` at every 2 m bay on a stone course from the Black Forest on; plank or
  half-timber walls; `wood_roof_45` gable, 45 degrees; `wood_dragon1` on hall gables; short porch.
- Layout: houses round the hearth and the village chest; the hall at the centre.
- s1 to s3: one room; two rooms or an L; T or long hall with aisle posts. d1 to d3: bed, chest, fire; table, rug,
  torch, item stand; banners, armour stand, fermenter, more stands.
- Overview: `docs/cultures/norse.png`.

| Data we have | Data we need |
|---|---|
| 1,106 corpus designs read as Norse; scorer and rules learned from them | nothing urgent |

### anglo-saxon

Who and why: English kingdoms of the 5th to 11th centuries, farming on open lowland like the Meadows.

- Buildings: home (post-built hall house), longhouse (great hall), workshop, smithy, storehouse as sunken huts
  (grubenhaus), temple as a timber church of nave and chancel.
- Plans and sizes: West Stow halls 7.9 x 4.1 m, 9.8 x 4.3 m with a 2.4 m end room, the largest about 11.4 x 7.8 m;
  great halls 15 to 25 m. Sunken huts 3 to 4 m by 4 to 6 m. Generator: halls 2 m bays, depth 6 m, length 6 to 22 m;
  sunken huts 4 to 8 m by 6 m.
- Build-up: straight plank walls (`woodwall`, some half-timber with `wood_beam_45`) between earthfast posts
  (`wood_pole2` at every bay), no stone footing; thatched gable or hip (`wood_roof_45`, `wood_roof_ocorner_45`),
  45 degrees.
- Doors and windows: doors in the middle of both long sides, facing each other; few small windows.
- Signature: opposed doors; sunken huts with the roof to the ground and a gable-end door; halls on a slight rise.
- Interiors: one hall with a central hearth, sometimes a partition for an end room; sunken huts for weaving and
  craft.
- Layout: scattered farmsteads, halls lined up east to west along a spine, each with sunken huts round it; no
  enclosure early, fenced plots later.
- s1 to s3: small hall and one sunken hut; longer hall with a second room; great hall up to 22 m. d1 to d3 as Norse.
- Sources: West Stow Anglo-Saxon Village (Wikipedia, CC BY-SA 4.0, facts only).
- Overview: `docs/cultures/anglo-saxon.png`.

| Data we have | Data we need |
|---|---|
| West Stow hall sizes; corpus Norse halls for the frame | a church or great-hall plan (Yeavering, Lyminge, Cowdery's Down) with measurements; whether halls should be hipped more often |

### frankish-norman

Who and why: Frankish and Norman lords and farmers of northern France, 9th to 11th centuries, next door to the Norse.

- Buildings: home (timber-framed house), keep (motte tower), workshop, church (nave and chancel), barn.
- Plans and sizes: houses 6 to 12 m long, L and T plans for larger farms; Millénaire Norman homes median 14 x 9 m with
  a 45 degree thatch roof; keeps 6 x 6 m (s1, s2) and 10 x 10 m (s3), 2 to 3 storeys of 3 m.
- Build-up: half-timber walls (`woodwall` with `wood_beam_45` braces), steep 45 degree thatch gables (`wood_roof_45`);
  the keep in timber with a pyramid roof while stone is not used, then `stone_wall_2x1` walls with flat buttresses of
  `stone_wall_1x1` at the middle of each side and a parapet of `stone_wall_1x1` blocks every other metre.
- Doors and windows: houses door on the long side; keeps windows on upper storeys only. Real Norman keeps often had
  their door on the first floor; the generator puts it on the ground.
- Signature: the square keep with buttresses and battlements; steep gables; L-shaped farm houses.
- Interiors: hall and chamber; keep ground floor storage, first floor hall, top chamber.
- Layout: houses along one street leading to the church and the keep; the keep on a mound (terrain) with a yard below.
- s1 to s3: timber house; L house; T house. Keep: timber; stone (Black Forest on); stone 10 m.
- Sources: Millénaire Norman (study only, proportions and room uses); general history of motte and bailey castles.
- Overview: `docs/cultures/frankish-norman.png` (keep shown in the Meadows and the Black Forest).

| Data we have | Data we need |
|---|---|
| 170 corpus medieval designs; 92 Millénaire Norman buildings (sizes, plans, rooms) | a source for 10th century Frankish farm houses; first-floor door and outside stair for keeps |

Meadows cultures are all timber and thatch, so they are told apart by plan and layout more than by material.

## Black Forest

### norse-forest

Who and why: Norse of the forested inland valleys of Norway and Sweden, building in log and stave; the Black Forest
is their wood.

- Buildings: home (log house, stue), storehouse raised on posts (stabbur), stave church, byre, smithy.
- Plans and sizes: log houses 6 to 10 m by 6 m; storehouses 4 to 6 m; stave churches 6 x 6 to 10 x 6 m nave.
- Build-up: `wood_wall_log` walls in 0.5 m courses, `wood_pole_log` corners, a stone course (`stone_wall_2x1`) from
  s2 halls and s3; steep 45 degree gable; stave church walls of `woodwall` planks 4 m high on log posts, a 26 degree
  gallery roof all round at 2 m (`wood_roof`, `wood_roof_ocorner`) on posts and beams, `wood_dragon1` on the gables.
- Signature: stave church with its low gallery; raised storehouses; carved ridge ends.
- Interiors: one room with a hearth; storehouse chests and barrels; church benches and a table at the end.
- Layout: farm clusters (tun) of many small single-purpose buildings round a yard.
- s1 to s3: log cabin; log house with porch; larger house on stone. Church grows from 6 x 6 m to 10 x 6 m.
- Overview: `docs/cultures/norse-forest.png`.

| Data we have | Data we need |
|---|---|
| 34 corpus log builds, Black Forest palettes | stave church measurements (Borgund, Urnes) for tiered roofs; a stabbur with a jettied upper floor |

### celtic

Who and why: Irish, Scots and Welsh of the early medieval period, who kept round houses inside ringforts; forest and
upland farming suits the Black Forest.

- Buildings: home and hall (round house), smithy and workshop (smaller round houses), round tower (cloigtheach),
  oratory or small church (rectangle, steep gable, nave and chancel at s2 and s3).
- Plans and sizes: round houses 4.8 m (s1), 9.7 m (s2), 14.5 m (s3 hall) across; round towers 4.8 m across, 3 to 5
  storeys.
- Build-up: walls 2 m of plank (wattle stand-in) or, from s3, `stone_wall_2x1` base; conical thatch, a 26 degree eave
  ring then 45 degree rings (`wood_roof`, `wood_roof_45`); a porch of two short walls and a small gable at the door on
  houses 9.7 m and larger; round towers in stone with a cone.
- Doors and windows: one door, often facing east; no windows in houses.
- Signature: the round house with a deep thatch cone and porch; the tall round tower at monasteries.
- Interiors: hearth in the middle, beds and stores round the wall.
- Layout: a ringfort (rath or cashel), a circular bank 20 to 60 m across, holding one to three round houses; the
  enclosure is terrain and is left to the village layout.
- Overview: `docs/cultures/celtic.png`.

| Data we have | Data we need |
|---|---|
| 8 corpus Celtic builds; Crannog Centre and Butser-style round house facts | ringfort layout measurements; the change to rectangular houses after about 800 for later stages |

### slavic

Who and why: East Slavs of the early Rus, 9th to 11th centuries, in log villages of the northern forests.

- Buildings: izba (home), larger house on a log ground storey (terem), granary (ambar) on posts, bath house (banya),
  hay barn.
- Plans and sizes: izba 4 to 6 m square to 6 x 8 m; the stove took up to a quarter of the floor.
- Build-up: `wood_wall_log` walls in courses; s2 and s3 houses on a 2 m log ground storey (podklet) of the same logs
  with an outside stair (`wood_stair`) to a landing; steep 45 degree gable with a carved ridge (`wood_dragon1` as the
  carved ridge end); covered porch.
- Doors and windows: door from the yard side; small windows.
- Signature: log house on a log ground storey with an outside stair; carved gable boards and ridge.
- Interiors: stove in a corner with the red corner diagonal from it; benches along walls. The lab puts the fire in
  the middle; a corner stove is still to do.
- Layout: houses along a street, gable ends to the street, each in a fenced yard (dvor) with its outbuildings.
- Sources: Izba (Wikipedia, CC BY-SA 4.0, facts only).
- Overview: `docs/cultures/slavic.png`.

| Data we have | Data we need |
|---|---|
| izba facts; corpus log palettes | measured plans of 10th century houses (Novgorod, Staraya Ladoga); corner stove placement in the decorator |

## Swamp

### celtic-crannog

Who and why: Irish and Scots who built round houses on timber platforms in lakes and bogs; the Swamp's water and mire.

- Buildings: home, hall and workshop as round houses on platforms; storehouse round; shore buildings use the same form.
- Plans and sizes: the Scottish Crannog Centre house is about 15 m across on 168 piles with a 20 m causeway.
  Generator: houses 4.8, 9.7 and 14.5 m across on 2 m stilts (`wood_pole2`), a deck 3 m wide all round,
  a walkway 6 to 10 m long to the shore ending in a stair; a `wood_fence` round the deck at s3.
- Build-up: plank (wattle hurdle) walls, thatch cone (`wood_roof` set kept in the Swamp), hearth on clay in the middle.
- Signature: the round house over water with its walkway; no smoke hole (smoke goes through the thatch).
- Interiors: animals just inside the door, sleeping areas round the wall, food hung from the ring beam.
- Layout: several crannogs in a lake, each with its own walkway to the shore, raised walkways between them (D-038).
- Sources: Undiscovered Scotland, Scottish Crannog Centre; Scottish Crannog Centre blog "Building a Crannog" (both
  copyright of their owners, facts only).
- Overview: `docs/cultures/celtic-crannog.png`.

| Data we have | Data we need |
|---|---|
| Crannog Centre sizes and build-up | early medieval Irish crannog plans (Lagore, Ballinderry) |

### baltic

Who and why: Latgalians, Curonians, Prussians and Lithuanians of the 9th and 10th centuries; the Āraiši lake fortress
in Latvia stood on a platform in a lake.

- Buildings: log house, rija (threshing and drying barn, the longhouse type), klēts granary on posts.
- Plans and sizes: Āraiši had remains of 151 wooden buildings; 14 are rebuilt. Generator: log houses 6 to 10 m on a
  platform of short posts (1 m) with a 2 m deck all round; rija long, 12 to 22 m.
- Build-up: `wood_wall_log` walls, steep 45 degree thatch gable or hip.
- Signature: log houses packed on one timber platform in a lake; raised granaries.
- Layout: houses round the edge of the platform with a lane inside, a palisade and a bridge or causeway to shore.
- Sources: Āraiši lake fortress (Wikipedia, CC BY-SA 4.0, facts only); EXARC pages on the Āraiši reconstruction (not
  read in full).
- Overview: `docs/cultures/baltic.png`.

| Data we have | Data we need |
|---|---|
| Āraiši building count | house sizes and roof forms from the Āraiši excavation reports; the rija's plan |

### fen-folk

Who and why: Frisians of the North Sea marshes, living on raised mounds (terpen) and on stilts with raised walkways
between buildings (D-038), with the English fenland as kin.

- Buildings: home and longhouse as aisled byre-houses, workshop, hay barrack (open shed).
- Plans and sizes: Old Frisian longhouses 25 to 35 m long, three-aisled, bays 2 to 2.5 m, byre at one end and living
  rooms at the other. Generator: homes 6 to 12 m, longhouses 12 to 22 m long with aisle posts.
- Build-up: on 1 m posts (a mound stand-in) or 2 m stilts; plank and half-timber walls; hipped thatch at 45 degrees
  with a 26 degree eave row that comes down to about 2 m above the floor (`wood_roof_45`, `wood_roof`,
  `wood_roof_ocorner(_45)`); a walkway on posts from the door.
- Signature: long low hipped roofs; walkways on stilts between the houses.
- Interiors: byre with stalls on both sides of a central aisle, living end with a smoke hatch.
- Layout: houses set radially round the top of a round mound, gable ends to the middle, walkways joining them.
- Sources: Old Frisian longhouse (Wikipedia, CC BY-SA 4.0, facts only).
- Overview: `docs/cultures/fen-folk.png`.

| Data we have | Data we need |
|---|---|
| longhouse length and bay spacing | Ezinge's radial layout measured; a byre interior for the decorator; terrain raising for mounds in the mod |

## Mountain

### norse-highland

Who and why: Norse settlers of Iceland and the Atlantic islands, who built in turf and stone where timber was scarce.

- Buildings: farm house as a row of gabled houses (home), hall farm (longhouse), turf church, storehouse (skemma),
  smithy.
- Plans and sizes: Stöng's main house 28 m long; turf walls about 2 m thick; Glaumbær 13 joined houses, 6 with gables
  to the yard. Generator: houses 6 m wide, 6 to 12 m deep, 1 to 3 side by side; the middle one deeper at s3.
- Build-up: side and back walls `stone_wall_2x1` 2 m high (turf and stone stand-in); wooden gable fronts of
  `woodwall` with the door and windows; steep 45 degree gable in thatch until turf pieces are measured (see "Rules
  followed"); no posts or footing.
- Signature: the row of wooden gables facing the yard; low thick walls.
- Interiors: long fire in the hall, benches along both walls, sleeping lofts at the ends.
- Layout: single farms with a home field and its wall, a few farms within sight; no village enclosure.
- Sources: Hurstwic, Turf Houses (copyright Hurstwic, facts only); Glaumbær museum page (glaumbaer.is, facts only).
- Overview: `docs/cultures/norse-highland.png`.

| Data we have | Data we need |
|---|---|
| one corpus Icelandic turf house; Stöng and Glaumbær facts | `turf_roof` size from the piece export; passage (göng) plans for a hall behind the gables |

### saami

Who and why: the Saami of the northern fells, reindeer herders with turf huts, tents and storehouses on posts.

- Buildings: goahti (turf hut, home and gathering hut), lavvu (tent, for work), njalla or luovvi storehouse on posts,
  reindeer pen.
- Plans and sizes: goahti frame of four bent poles 2.4 to 3.7 m long, 1.5 to 2.4 m high, often longer than wide.
  Generator: goahti 4.8 m across (9.7 m gathering hut), 3 m stone and turf wall, thatch cone with a smoke hole;
  lavvu 8.8 m across at the base and 4 m high (real lavvu are 4 to 6 m; the smallest ring roof the lab can lay
  is this wide), dark cover from the Plains on; storehouse 4 x 6 m in log on 2 m posts with
  a landing and stair.
- Signature: low round huts and tents; storehouses on posts.
- Interiors: hearth in the middle; logs from the door to the fire mark a path; the area behind the fire (boaššu) is
  for stores and is kept apart; sleeping and working areas either side.
- Layout: a loose ring of huts and tents near water, storehouses apart on posts, a pen for reindeer.
- Sources: Goahti (Wikipedia, CC BY-SA 4.0, facts only); Dennis R. Holloway, Lavvu and Goahti (copyright 2021,
  facts only).
- Overview: `docs/cultures/saami.png`.

| Data we have | Data we need |
|---|---|
| goahti frame sizes and floor zones | a longer (bread-box) goahti plan; a smaller njalla on one post; the decorator's floor zones |

## Plains

### middle-eastern

Who and why: Persians and Arabs of the Abbasid and Samanid world, traders who reached the Norse along the Volga; the
open Plains suit flat-roofed courtyard houses.

- Buildings: house (s1 and s2 rectangle or U, s3 courtyard), caravanserai (tavern type), workshop, mosque or temple
  with a tower.
- Plans and sizes: Millénaire Seljuk homes median 10 x 8 m with flat roofs; Ribat-i Sharaf caravanserai about
  110 x 75 m with two courtyards, four iwans each and six round towers. Generator: courtyard houses 12 x 12 m with a
  4 m yard; caravanserais 16 x 16 m with an 8 m yard and four corner towers.
- Build-up: `stone_wall_2x1` walls, flat roof of `wood_floor` with a parapet of `stone_wall_1x1` every other metre,
  `piece_cloth_hanging_door`, dark awnings over the front; yard arcade of `stone_wall_1x1`, `stone_pillar` and
  `stone_arch` in 3 m bays; paved yard (`stone_floor_2x2`) with a well.
- Signature: rooms round a courtyard with an arcade; flat roofs; a tall tower (windcatcher or minaret) beside temples.
- Interiors: rugs, low seats, chests; rooms open to the gallery.
- Layout: lanes between blank outer walls; caravanserai on the road outside the village.
- Sources: Ribat-i Sharaf (ancient-history-sites.com, facts only); Millénaire Seljuk (study only).
- Overview: `docs/cultures/middle-eastern.png`.

| Data we have | Data we need |
|---|---|
| 3 corpus designs; 79 Millénaire Seljuk buildings | iwan and dome forms; trader tents and awnings measured (D-013 allows them) |

### byzantine

Who and why: the Eastern Roman empire, whose Varangian Guard drew Norse men to Constantinople.

- Buildings: house of one or two storeys, church (cross-in-square), workshop, courtyard house at s3.
- Plans and sizes: Millénaire Byzantine homes median 13 x 10 m at 26 degrees with dark tile; middle Byzantine domes
  were under 6 m across (under 7 m for the four-column plan). Generator: chapel 6 x 6 m (s1), cross 10 x 10 m with
  6 m arms (s2), 14 x 14 m with 10 m arms (s3); drum 4.8 m or 9.7 m across.
- Build-up: `stone_wall_2x1` (Plains) or `blackmarble_2x1x1` (Mistlands) walls, storeys of 3 m, masonry gable ends,
  26 degree `darkwood_roof` for tile; church crossing on four columns (`stone_wall_1x1` and `stone_pillar`, or
  `blackmarble_column_1`), a ceiling of `wood_floor` with the middle open, a drum with windows, a dome of 45 then
  26 degree rings and a block on top.
- Signature: the domed church; low tiled roofs; two-storey stone houses.
- Interiors: church benches and a table at the east end; houses with storage below and living above.
- Layout: houses round a church square.
- Sources: 10th-century Byzantine domes (Wikipedia, CC BY-SA 4.0, facts only); Millénaire Byzantine (study only).
- Overview: `docs/cultures/byzantine.png` (church shown in the Plains and the Mistlands).

| Data we have | Data we need |
|---|---|
| 62 Millénaire Byzantine buildings; dome size rules | an apse; narthex; a bath house plan; red tile has no vanilla piece |

### steppe

Who and why: Khazars and Turkic peoples of the Pontic steppe, who traded with the Rus and Norse; tents on the open
Plains.

- Buildings: yurt (home), great yurt (hall), open sunshade (workshop), corral (barn).
- Plans and sizes: generator yurts 9.7 m across (homes) and 14.5 m (great yurt at s2 and s3), lattice wall 2 m, low
  cone with an open crown 1.7 to 2.5 m across.
- Build-up: `woodwall` with `darkwood_beam_45` braces (lattice), thatch cone (felt stand-in) of `wood_roof` from the
  wall top, `piece_cloth_hanging_door`; sunshades of posts and a hip roof.
- Signature: round tents with an open crown; a hanging door.
- Interiors: hearth in the middle under the crown; seating round the wall, place of honour opposite the door.
- Layout: a ring of yurts round an open space, doors to the south or east, pens outside.
- Sources: Khazar urban archaeology summary (vectree.io; thin, facts only). The Yurt article on Wikipedia was not
  reached.
- Overview: `docs/cultures/steppe.png`.

| Data we have | Data we need |
|---|---|
| general yurt proportions only | Khazar dwelling plans (Saltovo-Mayaki settlements, Sarkel); vanilla tents measured |

## Mistlands

### byzantine

As in the Plains, in black marble (`blackmarble_2x1x1`, `blackmarble_floor`, `blackmarble_column_1`,
`blackmarble_arch`) with dark roofs.

### lamari

Who and why: Georgians, Armenians and Svans of the Caucasus mountains, whose stone tower villages stand in high
misty valleys.

- Buildings: house (machub) with an attached tower, tower alone, hall church with a drum, workshop.
- Plans and sizes: Svan towers 3 to 5 storeys, walls thinning upward, mostly 9th to 12th century; houses 80 to 130
  m2 on two floors (machub below, darbazi above). Generator: house 6 to 10 m, 1 to 2 storeys of 3 m; tower 6 x 6 m,
  4 to 6 storeys of 3 m, wooden floors, slit windows above the ground storey, a low 26 degree pyramid roof.
- Build-up: `blackmarble_2x1x1` walls, masonry gables, `darkwood_roof` (slate stand-in) at 26 degrees; the church
  drum is a ring of marble walls with windows under a 45 degree cone.
- Signature: clusters of square towers; drum and cone churches.
- Interiors: the machub is one hall with a hearth, people and animals divided by carved wooden screens; tower floors
  for storage and refuge.
- Layout: dense clusters of house-and-tower farms on a slope, a church on a rise.
- Sources: Svan towers and Darbazi (Wikipedia, CC BY-SA 4.0, facts only).
- Overview: `docs/cultures/lamari.png`.

| Data we have | Data we need |
|---|---|
| Svan tower storeys and house areas | tower base sizes and heights in metres; the stepped corbelled roof of the darbazi (hazarashen) with its smoke hole, not built yet |

## Corpus by culture

Counts from Tyler's downloads corpus (`C:\Users\tyler\Downloads\Villheim-blueprints`, valheimians downloads, 2,153
`.blueprint` files), sorted by culture on 2026-11-11. Data: `tools/blueprint-lab/data/culture-corpus/summary.json`
(counts) and `members.json` (builds sorted with high or medium confidence). Method, units and commands:
`docs/handoffs/2026-11-10-design/research.md`. Nothing here is copied from a blueprint; titles and makers are credits.

How to read the tables:

- A group is a sort label. Confidence high means a style word in the title or slug, medium a word in the description or
  a strong material sign (turf, dragon heads, grausten or ashwood walls), low a form and material rule only (wooden
  walls under a pitched roof read as norse, tall stone as castle, stone under a pitched roof as stone-house, black
  marble walls as mistlands, a small round thatched build as celtic). `norse-named` is the norse group without its low
  builds.
- "Buildings" are builds with 40+ building pieces outside the statue, bridge, arena, mini-game, portal-hub, farming and
  artistic folders; plan, roof, storeys, size and materials are shares of those. "Furnished" are buildings with 5+
  pieces of furniture inside (under a roof or floor); room uses, kinds and relations are shares of those.
- Shares are percent of builds. Medians and shares are the numbers to use: a few very large bases dominate raw totals.
- Several groups are named by a form or biome word, which says nothing about culture: `celtic` is mostly "roundhouse"
  titles, `celtic-crannog` "lake house" and "on stilts" titles, `fen-folk` "swamp" titles, `saami` two "Teepee" builds
  (a Plains Native form) and one description match.
- The steppe build's height (4,979 m) is a stray piece far from the house; its footprint is right.

### Forms

| Group | Builds (high / medium / low) | Buildings, furnished | Plan % | Roof % | Storeys % | Footprint m (median) | Height m | Floor area m2 |
|---|---|---|---|---|---|---|---|---|
| norse | 495 (86 / 71 / 338) | 455, 387 | irregular 39, rectangle 15 | gable 42, cross-gable 32 | 2 34, 1 25 | 17 x 24 | 9.3 | 400 |
| norse-named | 157 (86 / 71 / 0) | 142, 131 | irregular 41, T 19 | cross-gable 35, gable 34 | 4+ 35, 2 29 | 21 x 30 | 12.5 | 736 |
| norse-forest | 48 (45 / 3 / 0) | 44, 44 | irregular 41, T 20 | cross-gable 45, gable 39 | 2 48, 1 20 | 18 x 22 | 10 | 368 |
| norse-highland | 29 (22 / 7 / 0) | 27, 23 | irregular 44, octagon/round 15 | cross-gable 33, conical 26 | 4+ 44, 2 22 | 30 x 31 | 16 | 821 |
| celtic | 15 (6 / 0 / 9) | 10, 8 | octagon/round 30, irregular 20 | conical 80, gable 10 | 1 70, 2 20 | 15 x 15 | 11.7 | 151 |
| celtic-crannog | 6 (6 / 0 / 0) | 5, 5 | irregular 60, octagon/round 20 | gable 60, conical 20 | 1 40, 2 20 | 19 x 20 | 10.5 | 554 |
| fen-folk | 18 (16 / 2 / 0) | 13, 12 | irregular 46, T 31 | conical 46, cross-gable 38 | 4+ 54, 1 23 | 24 x 36 | 14 | 694 |
| saami | 3 (2 / 1 / 0) | 2, 2 | octagon/round 100 | conical 100 | 1 100 | 16 x 18 | 11.5 | 232 |
| stone-house | 55 (0 / 0 / 55) | 46, 37 | irregular 41, rectangle 17 | gable 46, cross-gable 30 | 2 52, 1 24 | 14 x 20 | 8.7 | 289 |
| medieval-timber | 31 (31 / 0 / 0) | 30, 27 | irregular 40, T 27 | cross-gable 47, gable 30 | 4+ 50, 3 30 | 19 x 29 | 17.1 | 580 |
| castle | 264 (143 / 2 / 119) | 240, 176 | irregular 41, T 13 | gable 24, cross-gable 20 | 4+ 47, 1 25 | 22 x 31 | 15.5 | 645 |
| mistlands | 81 (14 / 0 / 67) | 62, 44 | irregular 40, octagon/round 15 | flat 44, none 31 | 4+ 39, 1 23 | 20 x 22 | 15 | 421 |
| ashlands | 175 (32 / 143 / 0) | 159, 119 | none 21, irregular 20 | none 29, flat 23 | 1 39, 4+ 23 | 20 x 28 | 10.6 | 264 |
| east-asian | 22 (21 / 1 / 0) | 18, 14 | irregular 33, square 17 | cross-gable 50, hip 28 | 4+ 56, 1 33 | 22 x 27 | 14.6 | 552 |
| fantasy | 41 (40 / 1 / 0) | 35, 31 | irregular 26, octagon/round 23 | conical 37, cross-gable 26 | 4+ 46, 3 29 | 20 x 26 | 22.3 | 730 |
| greco-roman | 7 (7 / 0 / 0) | 6, 5 | irregular 50, rectangle 33 | flat 33, none 33 | 4+ 50, 3 33 | 22 x 43 | 17.3 | 1472 |
| modern | 15 (14 / 1 / 0) | 13, 10 | irregular 31, rectangle 31 | flat 54, none 15 | 3 31, 4+ 31 | 14 x 20 | 10 | 401 |
| tree-house | 7 (6 / 1 / 0) | 7, 6 | irregular 43, octagon/round 29 | cross-gable 43, conical 29 | 4+ 71, 1 14 | 24 x 25 | 45 | 1588 |
| slavic | 1 (1 / 0 / 0) | 1, 1 | irregular 100 | gable 100 | 1 100 | 8 x 15 | 7.7 | 86 |
| frankish-norman | 1 (0 / 1 / 0) | 1, 1 | L 100 | none 100 | 3 100 | 25 x 38 | 14.5 | 1097 |
| middle-eastern | 1 (1 / 0 / 0) | 1, 1 | U/courtyard 100 | cross-gable 100 | 2 100 | 34 x 38 | 10 | 1010 |
| steppe | 1 (1 / 0 / 0) | 1, 1 | octagon/round 100 | none 100 | 2 100 | 20 x 22 | 4979.1 | 344 |
| unsorted | 837 (0 / 0 / 837) | 301, 139 | irregular 26, none 25 | none 41, flat 27 | 1 59, 2 18 | 14 x 17 | 7 | 58 |

- Norse (495, 338 of them low): plank walls 79 %, thatch roofs 63 % (dark wood 36 %), gable 42 % and cross-gable
  32 %, median 17 x 24 m and 9.3 m tall, 2 storeys most often. The named builds (`norse-named`) are larger (21 x 30 m,
  12.5 m), with dark wood and thatch roofs about even and stone low walls in 30 %.
- Norse-forest: log walls in 25 %, thatch 64 %, 2 storeys in 48 %. Norse-highland: stone walls 52 %, turf roofs 27 %,
  round plans 15 %, and large (30 x 31 m, 16 m tall): strongholds and lodges more than houses.
- Celtic: conical roofs 80 %, one storey 70 %, log walls 44 %, 15 x 15 m. Crannog: plank walls 80 %, gable roofs 60 %.
  Fen-folk: conical roofs 46 % and 4+ storeys 54 % (towers and tree houses).
- Stone-house: all stone walls, dark wood roofs 59 %, 2 storeys 52 %, 14 x 20 m and 8.7 m tall; 70 % add
  diagonal beams on the stone (more than six 45 degree beams: braces or a half-timber look). Medieval-timber: stone low walls 70 %, dark wood roofs 74 %, half are 4+ storeys.
- Castle: stone walls 75 %, 4+ storeys 47 %. Mistlands: black marble walls 95 %, flat roofs 44 %. Ashlands: ashwood
  52 % and grausten 45 % of walls; 29 % have no roof (walls, yards, ruins).

### Materials by part

Dominant material of each part, percent of buildings.

| Group | Walls % | Low walls % | Roof % | Floor % | Frame % |
|---|---|---|---|---|---|
| norse | plank 79, log 14 | plank 66, stone 17 | thatch 63, darkwood 36, grausten 0 | wood 86, stone 11 | timber 69, darkwood 12 |
| norse-named | plank 61, log 18 | plank 46, stone 30 | darkwood 49, thatch 48, grausten 1 | wood 76, stone 18 | timber 67, darkwood 11 |
| norse-forest | plank 52, log 25 | plank 42, log 26 | thatch 64, darkwood 36 | wood 84, marble 5 | timber 75, log 7 |
| norse-highland | stone 52, plank 22 | stone 63, plank 17 | darkwood 36, thatch 32, turf 27 | wood 52, stone 37 | timber 38, darkwood 23 |
| celtic | log 44, plank 33 | log 44, stone 33 | thatch 80, darkwood 20 | wood 100 | timber 90, iron 10 |
| celtic-crannog | plank 80, darkwood 20 | plank 50, log 25 | other 40, thatch 40, darkwood 20 | wood 100 | timber 80, darkwood 20 |
| fen-folk | plank 38, stone 31 | stone 50, marble 17 | darkwood 50, thatch 33, other 17 | wood 67, stone 25 | timber 62, iron 15 |
| saami | stone 100 | stone 100 | thatch 100 | stone 50, wood 50 | timber 100 |
| stone-house | stone 100 | stone 100 | darkwood 59, thatch 41 | wood 52, stone 48 | timber 76, darkwood 13 |
| medieval-timber | stone 47, plank 40 | stone 70, plank 17 | darkwood 74, thatch 11, grausten 7 | wood 60, stone 23 | timber 57, ashwood 13 |
| castle | stone 75, plank 10 | stone 74, plank 9 | darkwood 56, thatch 36, grausten 6 | wood 49, stone 35 | timber 51, iron 10 |
| mistlands | marble 95, stone 2 | marble 87, stone 7 | darkwood 89, grausten 11 | marble 66, stone 10 | timber 24, iron 21 |
| ashlands | ashwood 52, grausten 45 | grausten 38, ashwood 37 | darkwood 63, grausten 32, thatch 2 | grausten 47, ashwood 31 | grausten 46, ashwood 38 |
| east-asian | plank 47, ashwood 18 | stone 50, plank 13 | darkwood 56, thatch 44 | wood 65, stone 29 | timber 76, ashwood 18 |
| fantasy | stone 34, marble 26 | stone 40, marble 20 | darkwood 67, grausten 13, thatch 13 | wood 37, grausten 20 | timber 38, ashwood 21 |
| greco-roman | stone 50, plank 17 | stone 80, marble 20 | darkwood 67, grausten 33 | stone 50, grausten 33 | timber 50, grausten 33 |
| modern | plank 30, log 20 | stone 40, iron 20 | thatch 67, darkwood 33 | wood 62, ashwood 15 | timber 38, ashwood 31 |
| tree-house | plank 43, marble 14 | marble 29, plank 29 | darkwood 67, thatch 33 | wood 71, marble 14 | timber 57, log 14 |
| slavic | plank 100 | plank 100 | darkwood 100 | wood 100 | timber 100 |
| frankish-norman | stone 100 | stone 100 | darkwood 100 | stone 100 | iron 100 |
| middle-eastern | plank 100 | plank 100 | thatch 100 | wood 100 | plank 100 |
| steppe | stone 100 | stone 100 | - | stone 100 | plank 100 |
| unsorted | stone 38, plank 30 | stone 42, plank 30 | darkwood 47, thatch 24, other 17 | wood 57, stone 27 | timber 50, grausten 10 |

### Room uses

Percent of furnished buildings with a room or corner of each use (bed for sleeping, fire for hearth, cooking station
or cauldron for cooking, crafting station, chests, a table with seats for feasting, item and armor stands for display,
a bathtub for bathing).

| Group | sleeping | hearth | cooking | crafting | storage | feasting | display | bathing |
|---|---|---|---|---|---|---|---|---|
| norse | 71 | 84 | 77 | 70 | 80 | 50 | 44 | 18 |
| norse-named | 72 | 85 | 77 | 78 | 82 | 62 | 68 | 27 |
| norse-forest | 70 | 91 | 86 | 84 | 77 | 50 | 55 | 18 |
| norse-highland | 61 | 83 | 61 | 70 | 65 | 65 | 48 | 30 |
| celtic | 50 | 63 | 50 | 63 | 50 | 25 | 50 | 13 |
| celtic-crannog | 60 | 100 | 80 | 80 | 60 | 40 | 0 | 0 |
| fen-folk | 50 | 67 | 67 | 83 | 75 | 50 | 58 | 17 |
| saami | 100 | 100 | 50 | 50 | 50 | 0 | 50 | 0 |
| stone-house | 27 | 81 | 65 | 57 | 78 | 32 | 41 | 11 |
| medieval-timber | 56 | 78 | 81 | 63 | 74 | 67 | 63 | 30 |
| castle | 44 | 63 | 53 | 58 | 57 | 47 | 44 | 16 |
| mistlands | 25 | 48 | 36 | 52 | 45 | 34 | 39 | 14 |
| ashlands | 28 | 40 | 43 | 55 | 54 | 35 | 55 | 17 |
| east-asian | 29 | 36 | 29 | 43 | 43 | 21 | 50 | 14 |
| fantasy | 45 | 71 | 71 | 71 | 74 | 65 | 65 | 35 |
| greco-roman | 20 | 40 | 0 | 20 | 20 | 0 | 20 | 0 |
| modern | 70 | 80 | 70 | 50 | 60 | 70 | 70 | 40 |
| tree-house | 100 | 100 | 83 | 83 | 100 | 100 | 100 | 50 |
| slavic | 0 | 0 | 0 | 100 | 0 | 0 | 100 | 0 |
| frankish-norman | 0 | 100 | 100 | 0 | 0 | 0 | 0 | 0 |
| middle-eastern | 0 | 0 | 0 | 100 | 100 | 0 | 0 | 0 |
| steppe | 100 | 100 | 100 | 100 | 100 | 100 | 0 | 100 |
| unsorted | 36 | 56 | 53 | 58 | 63 | 42 | 50 | 19 |

- Most furnished builds mix home, workshop and storage in one building: in the norse group hearth 84, storage 80,
  cooking 77, sleeping 71 and crafting 70.
- Stone-house builds are mostly workshops, smithies and taverns (sleeping 27, hearth 81). Mistlands and Ashlands builds
  sleep least (25 and 28): towers, refineries and forges.
- Feasting is highest in medieval-timber (67), highland (65) and fantasy (65); bathing in fantasy (35) and
  medieval-timber (30).

### Interior sets and essentials

Kinds of furniture inside: percent of furnished buildings with one or more, then the median count per build in
brackets.

| Group | bed | table | seat | rug | storage | fire | light | stand | craft | cook |
|---|---|---|---|---|---|---|---|---|---|---|
| norse | 71 (1) | 68 (2) | 83 (8) | 72 (4) | 89 (17) | 84 (1) | 84 (8) | 59 (3) | 70 (4) | 77 (5) |
| norse-named | 72 (1) | 77 (3) | 89 (10) | 75 (11) | 92 (20) | 85 (1) | 92 (16) | 81 (15) | 78 (11) | 77 (7) |
| norse-forest | 70 (1) | 77 (2) | 93 (10) | 84 (7) | 86 (15) | 91 (1) | 98 (14) | 70 (8) | 84 (6) | 86 (7) |
| norse-highland | 61 (1) | 83 (3) | 96 (9) | 83 (9) | 74 (15) | 83 (1) | 91 (13) | 65 (5) | 70 (5) | 61 (4) |
| celtic | 50 (1) | 50 (1) | 63 (3) | 50 (7) | 63 (4) | 63 (1) | 75 (6) | 63 (6) | 63 (3) | 50 (3) |
| celtic-crannog | 60 (1) | 60 (1) | 80 (6) | 80 (2) | 80 (7) | 100 (1) | 100 (24) | 60 (2) | 80 (12) | 80 (2) |
| fen-folk | 50 (1) | 83 (3) | 92 (9) | 75 (10) | 92 (7) | 67 (1) | 100 (33) | 67 (24) | 83 (12) | 67 (6) |
| saami | 100 (2) | 0 (0) | 50 (3) | 100 (18) | 100 (11) | 100 (1) | 50 (5) | 50 (26) | 50 (10) | 50 (3) |
| stone-house | 27 (0) | 76 (1) | 86 (5) | 68 (2) | 89 (12) | 81 (1) | 89 (6) | 59 (2) | 57 (3) | 65 (5) |
| medieval-timber | 56 (1) | 74 (5) | 81 (11) | 81 (15) | 78 (14) | 78 (2) | 96 (21) | 70 (10) | 63 (2) | 81 (7) |
| castle | 44 (0) | 63 (2) | 76 (7) | 64 (4) | 70 (6) | 63 (1) | 89 (16) | 59 (3) | 58 (2) | 53 (1) |
| mistlands | 25 (0) | 45 (0) | 52 (1) | 45 (0) | 55 (2) | 48 (0) | 86 (13) | 55 (1) | 52 (3) | 36 (0) |
| ashlands | 28 (0) | 54 (1) | 71 (5) | 52 (1) | 67 (5) | 40 (0) | 89 (13) | 76 (7) | 55 (1) | 43 (0) |
| east-asian | 29 (0) | 43 (0) | 50 (2) | 50 (1) | 50 (1) | 36 (0) | 93 (33) | 57 (8) | 43 (0) | 29 (0) |
| fantasy | 45 (0) | 77 (6) | 77 (16) | 84 (24) | 87 (15) | 71 (1) | 97 (33) | 68 (19) | 71 (9) | 71 (7) |
| greco-roman | 20 (0) | 0 (0) | 60 (4) | 60 (4) | 20 (0) | 40 (0) | 80 (50) | 20 (0) | 20 (0) | 0 (0) |
| modern | 70 (1) | 80 (4) | 80 (20) | 90 (17) | 80 (6) | 80 (1) | 80 (9) | 70 (15) | 50 (4) | 70 (3) |
| tree-house | 100 (10) | 100 (14) | 100 (55) | 100 (56) | 100 (26) | 100 (9) | 100 (68) | 100 (32) | 83 (22) | 83 (18) |
| slavic | 0 (0) | 0 (0) | 100 (6) | 100 (1) | 100 (2) | 0 (0) | 100 (39) | 100 (14) | 100 (1) | 0 (0) |
| frankish-norman | 0 (0) | 100 (1) | 0 (0) | 0 (0) | 0 (0) | 100 (3) | 100 (13) | 0 (0) | 0 (0) | 100 (1) |
| middle-eastern | 0 (0) | 0 (0) | 100 (4) | 0 (0) | 100 (78) | 0 (0) | 0 (0) | 0 (0) | 100 (7) | 0 (0) |
| steppe | 100 (1) | 100 (7) | 100 (8) | 100 (18) | 100 (20) | 100 (1) | 100 (11) | 100 (3) | 100 (25) | 100 (11) |
| unsorted | 36 (0) | 55 (1) | 71 (7) | 59 (3) | 73 (7) | 56 (1) | 79 (10) | 65 (8) | 58 (1) | 53 (1) |

Relations between pieces, percent (furniture and lights per 10 m2 of floor are counts):

| Group | beds above main floor | beds by a rug | beds with a chest | beds side by side | tables with seats | seats at tables | seats by fire | rugs layered | tables dressed | windows dressed | furniture per 10 m2 | lights per 10 m2 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| norse | 64 | 30 | 34 | 21 | 51 | 28 | 4 | 23 | 41 | 17 | 2.2 | 0.2 |
| norse-named | 65 | 30 | 29 | 26 | 52 | 25 | 3 | 22 | 43 | 19 | 2.2 | 0.2 |
| norse-forest | 71 | 31 | 35 | 45 | 10 | 11 | 5 | 7 | 49 | 19 | 3.1 | 0.4 |
| norse-highland | 51 | 35 | 19 | 7 | 68 | 50 | 8 | 18 | 24 | 22 | 1.6 | 0.2 |
| celtic | 50 | 50 | 25 | 0 | 47 | 34 | 9 | 12 | 59 | 7 | 5.5 | 0.3 |
| celtic-crannog | 40 | 0 | 20 | 0 | 67 | 7 | 1 | 2 | 0 | 16 | 3 | 0.3 |
| fen-folk | 67 | 33 | 17 | 20 | 43 | 24 | 5 | 27 | 23 | 23 | 2.8 | 0.6 |
| saami | 33 | 67 | 67 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3.3 | 0.2 |
| stone-house | 54 | 23 | 38 | 0 | 43 | 16 | 1 | 10 | 29 | 17 | 2 | 0.2 |
| medieval-timber | 84 | 35 | 37 | 13 | 30 | 14 | 2 | 19 | 37 | 15 | 1.4 | 0.3 |
| castle | 66 | 34 | 32 | 12 | 42 | 18 | 7 | 25 | 41 | 17 | 1.4 | 0.2 |
| mistlands | 46 | 44 | 34 | 0 | 31 | 26 | 1 | 15 | 35 | 42 | 2.4 | 0.2 |
| ashlands | 60 | 44 | 38 | 11 | 44 | 32 | 3 | 15 | 41 | 20 | 1.5 | 0.3 |
| east-asian | 91 | 64 | 0 | 18 | 63 | 27 | 1 | 11 | 56 | 2 | 2 | 0.5 |
| fantasy | 62 | 45 | 34 | 9 | 43 | 35 | 3 | 18 | 53 | 31 | 3.2 | 0.4 |
| greco-roman | 0 | 0 | 0 | 60 | 0 | 0 | 0 | 10 | 0 | 0 | 0.9 | 0.2 |
| modern | 60 | 20 | 12 | 16 | 34 | 14 | 3 | 13 | 47 | 19 | 1.9 | 0.2 |
| tree-house | 50 | 71 | 38 | 8 | 43 | 16 | 13 | 25 | 26 | 33 | 3 | 0.4 |
| slavic | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100 | 7.9 | 4.8 |
| frankish-norman | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 6 | 0.3 | 0.1 |
| middle-eastern | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.8 | 0 |
| steppe | 0 | 0 | 100 | 0 | 0 | 0 | 0 | 0 | 43 | 39 | 5.4 | 0.3 |
| unsorted | 39 | 18 | 33 | 40 | 32 | 23 | 3 | 28 | 47 | 24 | 2.6 | 0.2 |

Kinds used most, and what stands on tables and under or in windows (furniture roles only; mod prefixes dropped):

| Group | Kinds most used (bed; table; seat; rug; fire; light) | On tables | Under or in windows |
|---|---|---|---|
| norse | `bed`/`piece_bed02`; `piece_table`/`piece_table_round`; `piece_chair`/`piece_chair03`; `rug_deer`/`rug_fur`; `hearth`/`fire_pit`; `piece_walltorch`/`piece_dvergr_lantern` | `itemstandh`, `itemstand`, `treasure_stack` | `itemstandh`, `itemstand`, `piece_groundtorch_mist` |
| norse-named | `piece_bed02`/`bed`; `piece_table`/`piece_table_round`; `piece_chair`/`piece_chair03`; `rug_deer`/`rug_fur`; `hearth`/`fire_pit`; `piece_walltorch`/`piece_dvergr_lantern` | `itemstandh`, `itemstand`, `treasure_stack` | `itemstandh`, `itemstand`, `piece_groundtorch_mist` |
| norse-forest | `bed`/`piece_bed02`; `dvergrprops_table`/`piece_table`; `piece_chair`/`piece_chair03`; `jute_carpet`/`rug_deer`; `fire_pit`/`hearth`; `piece_walltorch`/`piece_groundtorch_wood` | `dvergrprops_table`, `itemstandh`, `Candle_resin` | `blackforge_ext1`, `itemstand`, `itemstandh` |
| norse-highland | `piece_bed02`/`bed`; `piece_table`/`piece_table_round`; `piece_chair03`/`dvergrprops_stool`; `rug_fur`/`rug_wolf`; `hearth`/`fire_pit`; `piece_dvergr_lantern`/`piece_walltorch` | `itemstandh`, `piece_jackoturnip`, `sign` | `piece_dvergr_lantern`, `goblinking_totemholder`, `darkwood_raven` |
| celtic | `bed`/`piece_bed02`; `piece_table`/`piece_table_oak`; `piece_chair`/`piece_chair03`; `rug_hare`/`rug_deer`; `hearth`/`fire_pit`; `piece_groundtorch_wood`/`piece_walltorch` | `itemstandh`, `sign`, `piece_magetable_ext` | `piece_groundtorch` |
| celtic-crannog | `bed`; `cauldron_ext3_butchertable`/`piece_table`; `piece_chair`/`piece_chair03`; `rug_fur`/`rug_deer`; `hearth`/`fire_pit`; `piece_groundtorch_mist`/`piece_walltorch` | - | `piece_chest`, `piece_logbench01`, `piece_chest_barrel` |
| fen-folk | `bed`/`piece_bed02`; `piece_table`/`piece_table_round`; `piece_chair03`/`piece_chair02`; `rug_deer`/`rug_straw`; `hearth`/`fire_pit`; `piece_walltorch`/`piece_groundtorch_green` | `itemstandh`, `treasure_stack`, `piece_groundtorch` | `piece_groundtorch_green`, `piece_chest_wood`, `itemstandh` |
| saami | `bed`; -; `piece_workbench`/`piece_workbench_ext4`; `rug_deer`; `fire_pit`; `piece_groundtorch`/`piece_walltorch` | - | - |
| stone-house | `piece_bed02`/`bed`; `piece_table`/`cauldron_ext3_butchertable`; `piece_chair`/`piece_chair02`; `rug_fur`/`rug_hare`; `hearth`/`fire_pit`; `piece_walltorch`/`piece_groundtorch_wood` | `itemstandh`, `itemstand`, `treasure_stack` | `itemstandh`, `piece_chest_wood`, `ArmorStand` |
| medieval-timber | `piece_bed02`/`bed`; `piece_table_round`/`piece_table`; `piece_chair`/`piece_chair03`; `rug_fur`/`jute_carpet`; `hearth`/`fire_pit`; `piece_dvergr_lantern`/`piece_walltorch` | `itemstandh`, `Candle_resin`, `itemstand` | `goblinking_totemholder`, `piece_dvergr_lantern`, `piece_chest_treasure` |
| castle | `piece_bed02`/`bed`; `piece_table`/`piece_blackmarble_table`; `piece_chair`/`piece_chair03`; `jute_carpet`/`rug_fur`; `hearth`/`fire_pit`; `piece_walltorch`/`piece_dvergr_lantern` | `itemstandh`, `treasure_stack`, `Candle_resin` | `blackmarble_head01`, `sign`, `itemstandh` |
| mistlands | `piece_bed02`; `piece_table_round`/`piece_magetable_ext2`; `piece_chair03`/`piece_throne02`; `jute_carpet`/`rug_fur`; `fire_pit_hildir`/`hearth`; `piece_groundtorch_mist`/`piece_dvergr_lantern` | `piece_dvergr_lantern`, `piece_Lavalantern`, `piece_throne02` | `itemstandh`, `piece_groundtorch_mist`, `dvergrprops_crate_long` |
| ashlands | `piece_bed02`/`bed`; `piece_table`/`piece_table_round`; `piece_chair03`/`piece_chair`; `rug_fur`/`jute_carpet`; `hearth`/`fire_pit_iron`; `piece_groundtorch_mist`/`piece_dvergr_lantern` | `itemstandh`, `Candle_resin`, `piece_Lavalantern` | `blackmarble_head01`, `itemstandh`, `itemstand` |
| east-asian | `bed`/`piece_bed02`; `piece_table`/`piece_magetable_ext`; `piece_chair`/`piece_bench01`; `rug_asksvin`/`rug_fur`; `hearth`/`fire_pit_iron`; `piece_groundtorch`/`piece_dvergr_lantern` | `itemstandh`, `piece_chest_private`, `piece_jackoturnip` | `piece_bench01` |
| fantasy | `piece_bed02`/`bed`; `piece_table`/`piece_table_round`; `piece_chair03`/`piece_chair`; `jute_carpet`/`rug_fur`; `hearth`/`fire_pit_iron`; `piece_groundtorch_mist`/`dvergrprops_lantern_standing` | `itemstandh`, `Candle_resin`, `itemstand` | `itemstandh`, `dvergrprops_lantern_standing`, `TreasureChest_dvergrtower` |
| greco-roman | `bed`; -; `piece_chair02`/`piece_bench01`; `jute_carpet_blue`/`jute_carpet`; `fire_pit_iron`/`hearth`; `piece_groundtorch_mist`/`piece_walltorch` | - | - |
| modern | `piece_bed02`/`bed`; `piece_table`/`cauldron_ext3_butchertable`; `piece_chair`/`piece_bench01`; `rug_fur`/`jute_carpet`; `hearth`/`rk_hearthsmall`; `piece_walltorch`/`piece_dvergr_lantern` | `itemstandh`, `sign`, `itemstand` | `itemstandh`, `sign`, `Candle_resin` |
| tree-house | `bed`/`piece_bed02`; `piece_table`/`piece_table_round`; `piece_chair`/`piece_chair03`; `rug_deer`/`rug_wolf`; `hearth`/`fire_pit`; `piece_walltorch`/`piece_groundtorch_mist` | `itemstandh`, `piece_jackoturnip`, `piece_Lavalantern` | `itemstandh`, `goblinking_totemholder`, `itemstand` |
| slavic | -; -; `piece_chair02`/`piece_workbench`; `rug_Rotten_TW`; -; `piece_groundtorch_mist`/`$custompiece_candlelit2` | - | `piece_groundtorch_mist`, `IG_Candle_Tray`, `piece_groundtorch_green` |
| frankish-norman | -; `piece_table`; -; -; `fire_pit`/`hearth`; `piece_groundtorch_mist`/`piece_dvergr_lantern` | - | `piece_xmascrown`, `sign_notext`, `piece_groundtorch_mist` |
| middle-eastern | -; -; `piece_workbench`/`piece_workbench_ext3`; -; -; - | - | - |
| steppe | `piece_bed02`; `piece_table_round`/`piece_magetable`; `piece_chair`/`piece_workbench_ext2`; `jute_carpet`; `hearth`; `piece_dvergr_lantern`/`piece_Lavalantern` | `piece_Lavalantern`, `piece_magetable_ext2`, `goblinking_totemholder` | `sign`, `goblinking_totemholder` |
| unsorted | `bed`/`piece_bed02`; `piece_table`/`piece_table_round`; `piece_chair`/`piece_chair03`; `jute_carpet`/`rug_fur`; `hearth`/`fire_pit`; `piece_dvergr_lantern`/`piece_groundtorch_mist` | `itemstandh`, `Candle_resin`, `piece_Lavalantern` | `itemstandh`, `piece_groundtorch_mist`, `itemstand` |

- Essentials. In every group with more than 10 furnished builds the most common kind is light (79 to 100 %) or
  storage (50 to 92 %); seats, fire and cooking follow in the house groups. A bed is in 71 % of furnished norse builds and 25 to 56 % of castle,
  stone-house, Mistlands, Ashlands and medieval-timber builds.
- Beds. `bed` and `piece_bed02` are near even in the norse group (389 and 375); `piece_bed02` leads in the named,
  highland, castle, Ashlands, Mistlands, medieval-timber, fantasy and modern groups, `bed` in norse-forest, celtic,
  fen-folk, crannog and tree-house. Beds stand above the main floor in 39 to 91 % of builds with beds (groups with 10+ furnished
  builds). Beds side by side: norse-forest 45 %, unsorted 40 %, norse 21 %, castle 12 %, Ashlands 11 %, Mistlands 0.
  A chest within 2.6 m: 17 to 38 %.
- Seats. Most seats stand away from tables: 11 to 35 % stand at a table (highland 50 %). Seats by a fire: 1 to 13 %.
- Tables. `piece_table` leads, then `piece_table_round`; the butcher table is third in the norse group. Tables carry
  something in 23 to 59 % (so most tables are bare), and the thing on top is most often a horizontal item stand (`itemstandh`),
  then candles, treasure stacks and lanterns. Two groups differ: in norse-forest the most common thing on a table is
  another table (`dvergrprops_table`, 418 pieces), in Mistlands a Dvergr lantern.
- Rugs. Median per furnished build: norse 4, norse-forest 7, highland 9, fen-folk 10, medieval-timber 15, fantasy 24,
  tree-house 56. Layered rugs (another rug within 1.2 m) 7 to 28 %. `rug_deer` and `rug_fur` lead in norse groups,
  `rug_wolf` second in highland, `jute_carpet` in castle, Mistlands and fantasy.
- Windows. 2 to 42 % have something under or in them: `itemstandh` in most groups, black marble heads in castle (3,032
  pieces) and Ashlands, the goblin totem holder in medieval-timber and highland, `darkwood_raven` in highland.
- Light. 0.2 to 0.6 lights per 10 m2. Wall torches lead in norse, norse-forest, stone-house and fen-folk; Dvergr
  lanterns in highland and medieval-timber; mist torches in Mistlands, Ashlands, fantasy and crannog.

### Most downloaded builds

By downloads in the corpus index (the site's like counts were not read). Low means the sort is a form rule only.

| Group | Most downloaded (title, maker, downloads, sort confidence) |
|---|---|
| norse | NPC House 3 (AstridSinjesdottir, 910, low); Watch Tower/Outpost (ZomZero, 907, low); Standing Stone Sanctuary (HiccupTheHermit, 905, low) |
| norse-named | Skyrim Nordic Home for Light Start (Luxfen, 894, high); core wood mansion (thepower3412, 842, medium); Concept Build (Artyfacts, 799, medium) |
| norse-forest | Tiny home challenge, part 2: before The Elder (SorchaAzura, 838, medium); Cozy Blacksmith Cabin (Olivanderr, 789, high); The Raspberry Cabin (HiccupTheHermit, 689, high) |
| norse-highland | Mountain Stronghold (mobiobi, 857, high); Mountain Lodge (FOB for 4+ vikings) (Fluffy-n-Dana, 821, high); A Mountain Home (smurfopax, 674, high) |
| celtic | Plains triple round house (BuilderG, 857, high); Cooking hut (Veseljko, 567, low); A round house (smurfopax, 559, high) |
| celtic-crannog | Epic Lake House (Drengr, 501, high); Home on Stilts - upgraded with a smelter and kiln! (LooneyBandit, 166, high); Home on Stilts (perfect for Swamp) (LooneyBandit, 117, high) |
| fen-folk | Starter Swamp Home (LooneyBandit, 418, high); Swamp Mage Tower (Sven of Undenfell, 341, high); Kuppelen Base (Open Concept Swamp stage base for 4 vikings) (Fluffy-n-Dana, 300, high) |
| saami | Teepee Supreme (Artyfacts, 606, high); Teepee (Artyfacts, 245, high) |
| stone-house | NPC House 1 (AstridSinjesdottir, 839, low); Grill Market (Dorakanar, 537, low); medium sized house towards the end of the game (thepower3412, 511, low) |
| medieval-timber | Upper Class Medieval Townhouse w/download (Apudma, 759, high); medieval watchtower #2 (thepower3412, 663, high); Vinland Manor (RAIZEN, 652, high) |
| castle | Alfheim (Artyfacts, 850, high); Castle/Wall Tower (Maleficarum, 839, high); Dawn Hill Retreat (AstridSinjesdottir, 832, low) |
| mistlands | Evil Tower (Pika, 713, low); Small Black Marble Base House (wolvendrake, 680, low); Refinery and Workshop (wolvendrake, 572, low) |
| ashlands | Ashland's Materials Home for up to 10 (Fully Decorated) \*Basement added with storage\* (Fluffy-n-Dana, 793, high); the charred Dawn Hill Retreat (AstridSinjesdottir, 785, high); The TALLEST possible tower in valheim vanilla (Olivanderr, 677, medium) |
| east-asian | Asian style Mountain Castle (Artyfacts, 932, high); Lin's Japanese themed base called Kuzuri (Lin, 886, high); Detailed Japanese village (Olivanderr, 728, high) |
| fantasy | Mage Tower (jaylaxel, 571, high); Elven Feast Hall - 6.8k Instances (Con Seannery, 505, high); Stone Watch (aSoftPea, 454, high) |
| greco-roman | full size Rome coloseum blueprint download (((READ DESCRIPTION))) (FlyRepresentative977, 539, high); The Parthenon of the Acropolis of Athens (Albireo, 227, high); The Martyr Colosseum (jlinde69, 197, high) |
| modern | Modern Tiny Home (GH05T, 562, high); Tiny Home Challenge, Part 4: Before Moder (SorchaAzura, 439, medium); Modern Starter House - Unfurnished (MADZO, 373, high) |
| tree-house | Simple Treehouse (HiccupTheHermit, 275, high); Skardvakt: The Black Watchtower (Aodi, 140, medium); The Rawcliffe Treehouse (Includes Old Mistland's Trees) \*IH BP\* Circa Oct/Nov 2021 (Fluffy-n-Dana, 133, high) |
| slavic | Baba Yaga Hut (Kasoline, 215, high) |
| frankish-norman | Falling Water (Kasoline, 78, medium) |
| middle-eastern | Ottoman Turkish House with courtyard /storage room meadows (venoms3131, 18, high) |
| steppe | Stone Yurt (RAIZEN, 312, high) |
| unsorted | Дом комфорт (istego, 986, low); INCREDIBLE Tavern - Valheim Build (Olivanderr, 969, low); Honeycomb Blossom Bee Farm (1sot0pe, 930, low) |

The most downloaded norse build, NPC House 3 by AstridSinjesdottir, is a shell made for an RP server's NPC village;
its interior photos on valheimians.com show empty rooms. Downloads rank shells and bases as well as finished
interiors, so this list is a list of credits and popular forms, and a poor guide to rooms.

### Spot check of the low-confidence sort

28 builds checked by title, description, materials and form on 2026-11-11 (spread through each group in slug order;
14 norse, 3 castle, 3 Mistlands, 3 stone-house, 2 celtic, and 3 unsorted builds with 40+ building pieces).

| Group (checked) | Right | Partly | Wrong | Notes |
|---|---|---|---|---|
| norse (14) | 12 | 1 | 1 | right: wooden houses, docks, a lodge and a log cabin with nothing pointing to another culture; partly: a farm base with plank, stone and marble walls and Ashlands wood; wrong: Silver Spire (RAIZEN), an 8-storey castle whose frame is grausten and marble |
| castle (3) | 0 | 1 | 2 | partly: Cathedral (Maleficarum), stone and tall, a church; wrong: Broken Bridge 1 (a bridge, and outside the building measures by folder), Common hall (a 4-storey stone hall that reads as stone-house) |
| mistlands (3) | 3 | 0 | 0 | Eitr Refinery, Mistlands Outpost, Eitr Temple |
| stone-house (3) | 2 | 1 | 0 | partly: a base with stone and ashwood walls |
| celtic (2) | 1 | 0 | 1 | right by form: The Flint Flat, a 6 x 6 m round thatched hut; wrong: Suspicious Turnip, a turnip-shaped novelty |
| unsorted (3) | 2 | 0 | 1 | rightly unsorted: a cemetery statue, a giant snowflake; missed: a black marble pyramid portal room (Dvergr wall pieces, 613 marble pieces) that could be mistlands |

Sorted low builds: 18 of 25 right (72 %), 3 partly, 4 wrong. "Right" for the norse rule means a wooden Valheim build
with no sign of another culture; the rule cannot tell a Norse house from a culture-neutral one, and the corpus gives
no way to tell them apart. The wrong ones are big mixed builds (castles with wooden walls), non-buildings in house
folders, and novelty shapes.

### Cultures with little or no corpus

Counts above, checked against `members.json`:

| Generator culture | Builds in the corpus | What they are |
|---|---|---|
| slavic | 1 | Baba Yaga Hut (Kasoline): a folklore hut; plank walls, dark wood roof, 8 x 15 m |
| frankish-norman | 0 | the one match, Falling Water (Kasoline), is a modern house; its description names Frank Lloyd Wright and the word "Frank" matched |
| middle-eastern | 1 | Ottoman Turkish House with courtyard (venoms3131, 18 downloads): plank walls and thatch round a courtyard, a storage and crafting building; later period |
| steppe | 1 | Stone Yurt (RAIZEN): round, stone walls |
| anglo-saxon | 0 | |
| baltic | 0 | |
| byzantine | 0 | greco-roman has 7 builds (colosseums, Parthenons, a temple): no houses |
| caucasian-highland (lamari) | 0 | |
| saami | 3 | two "Teepee" builds (Artyfacts) and one description match; no goahti or lavvu by name |
| celtic-crannog | 6 | lake houses and homes on stilts; none names a crannog |

Tyler on this gap (D-135, chat 2026-11-11): "corpus being all norse is okay because weve done research re: the other
cultures and buildings, yes? Its not mission critical if there are options for inspiration from other sources outside
the corpus that can be built via our generator. Minecraft, other building games, even actual historical or fantasy
houses from other games that match the style are fair game."

Options per culture, as found. None is chosen here. All are study only: facts, sizes, plans, room uses and credits go
in the docs; no design, image or text is copied into the repo.

| Culture | Corpus groups that could stand in (counts above) | Outside sources (read or found) |
|---|---|---|
| anglo-saxon | norse halls (wooden, gable); medieval-timber (31, mostly stone and tall); celtic round huts for small single rooms | West Stow (in use). Conquest Reforged (Minecraft project rebuilding Winchester about 927): an Anglo-Saxon longhouse and a set of sunken-feature buildings; posts set in the ground, wattle and daub or plank walls, earth or plank floors, thatch roofs, shingle and turf named; no licence stated. Assassin's Creed Valhalla in-game entry "Anglo-Saxon Homes": oak, wattle and daub; common homes are one room for cooking, eating and sleeping; richer homes have a hall with the family sleeping in a separate building. Not read: Lyminge royal hall (Archaeology magazine), Butser Ancient Farm's Saxon hall, the AC Valhalla historian interview (Ryan Lavelle) |
| frankish-norman | stone-house (55, low); medieval-timber; castle keeps | Millénaire Norman (in use, study only). Lauresham open-air laboratory (Lorsch): a 1:1 Carolingian manor of the 8th and 9th centuries on 4.1 ha with houses, farm buildings, stables, granaries and a chapel; sizes not on the page read. Mount & Blade II: Bannerlord, Vlandia (a feudal western culture; the wiki page read gives no building facts) |
| slavic | norse-forest log builds (48; log walls 25 %) | Izba (in use). "Early medieval dwelling houses of the northern Slavic region" (medievalheritage.eu): sunken houses often under 6 to 7 m2 inside; above-ground log, wattle or post-and-plank huts, no foundations; a clay dome stove in a corner (north-east corner, door in the south wall) taking about a quarter of the floor; one undivided room; bedding in opposite corners; stools and pegs and no tables; raised plank beds with animals beneath; lean-to porches holding work racks; upper floors only from the 12th century. Not read: Medieval Dynasty, Kingdom Come: Deliverance (Bohemia, 1403), "The medieval peasant house in Bohemia" (medievalists.net) |
| baltic | norse-forest log builds; fen-folk; crannog stilt houses | Āraiši (in use). Not read: EXARC "How and why is the reconstruction of Āraiši lake fortress being built", Āraiši Archaeological Park pages |
| byzantine | greco-roman (7, public buildings only); stone-house courtyard plans (U/courtyard 9 %) | Millénaire Byzantine (in use). "Middle Byzantine secular architecture" (Smarthistory): houses often of wood; rural houses at Armatova with small rectangular rooms and a porch; houses at Corinth round a courtyard with a well and ovens, rooms and storerooms; rock-cut Cappadocian houses round a courtyard with a portico and chapel; Myrelaion palace with a pi-shaped plan and front portico; a 12th century three-storey tenement with a family and pigs upstairs and hay below; kitchens, storerooms, cisterns, dovecotes and stables. Bannerlord, Empire |
| middle-eastern | the one Ottoman courtyard build; stone-house courtyard plans | Ribat-i Sharaf and Millénaire Seljuk (in use). Bannerlord, Aserai. Not read: Assassin's Creed Mirage (Baghdad, 9th century) |
| steppe | saami teepees (round, conical, one storey); celtic round huts | "Dwellings" (University of Washington, Silk Road Seattle): fire in the middle; the place of honor (tör) opposite the door for elders and guests; the right side as you enter for men (tools, saddle, saddlebags, whip), the left for women and the kitchen; things hung on pegs round the wall; rolled felts, bolsters and rugs piled in one quarter, the pile showing wealth; quilts against the wall by day on a raised platform; size counted in wall sections (kanat), 5 or 6 usual, 12 for the richest. Bannerlord, Khuzait |
| caucasian-highland (lamari) | norse-highland (stone walls 52 %, towers); castle towers | Svan towers and Darbazi (in use). "Svaneti: traditional customs, the Svan house and the role of the man" (Stefan Applis): ground floor (machubi) shared by people and animals, rectangular, a hearth in the middle that always burns and a second hearth for bread; door on the east near a corner; stalls for oxen right of the door and the cow barn on the next wall; the family's sides on the fourth; the head of the family's seat and a long bench on one side with wine vessels, weapons and tools, household things on the other; the couple's bed through a door from one side; the upper floor (darbazi) over it. Not read: Ushguli Ethnographic Museum pages |

Sources were found with web search on 2026-11-11; "not read" pages were found but not opened in the time set.

### Where the counts differ from examples named in briefs

D-136 (Tyler): "targets should never come from my words. Targets across the entire corpus should come only from what's
observed and learned." These differences between the counts and examples named in earlier briefs and handoffs are
recorded as found:

- frankish-norman was listed with one build; the one match is a Frank Lloyd Wright style house, so the count is 0.
- saami was listed with three builds; two are teepees and none is a goahti or lavvu.
- The research brief asks for the best-liked builds; the corpus index holds downloads, the top norse build by
  downloads is an empty shell (see above), and 3 of the top 5 norse builds are low-confidence sorts.
- Seats: most seats stand away from tables (65 to 89 % of seats in most groups, 50 % in highland), and 1 to 13 % stand
  by a fire.
- Messy realism (a design driver): most tables are bare (dressed 23 to 59 %) and most rugs lie alone (layered 7 to
  28 %). Where builders dress, they dress densely: builds that use horizontal item stands have a median of 18.

## Outside sources: licences and usefulness

| Source | Licence or terms | Use |
|---|---|---|
| Wikipedia (Svan towers, Goahti, Izba, Āraiši, West Stow, Darbazi, Old Frisian longhouse, Byzantine domes) | CC BY-SA 4.0 | facts and measurements only; nothing copied |
| Hurstwic, Turf Houses | copyright Hurstwic | facts only |
| Glaumbær museum page | copyright the museum | facts only |
| Undiscovered Scotland, Crannog Centre; Scottish Crannog Centre blog | copyright their owners | facts only |
| ancient-history-sites.com, Ribat-i Sharaf | copyright the site | facts only |
| Dennis R. Holloway Architect, Lavvu and Goahti | copyright 2021, no licence | facts only |
| vectree.io, Khazar urban archaeology | not stated | thin; facts only |
| Millénaire (`/home/claude/corpus/learn-mc/`) | All Rights Reserved | study only: plan, roof, size and room-use counts for byzantine, middle-eastern, frankish-norman; nothing committed |
| MineColonies schematics (minecolonies.com/schematics) | code GPL-3.0; the schematics page states no licence | not downloaded; styles listed (Nordic Spruce, Caledonia, Medieval, Ancient Athens and others) are candidates once the licence is asked |
| Rebrickable MOCs | owned by each designer; no republishing without permission; no use for AI training | not usable |
| LEGO Ideas | rights assigned to LEGO while in review; no copying or downloading without authorisation; no AI training | not usable |
| BrickLink Studio gallery | each designer chooses whether files can be downloaded; only one's own designs may be uploaded | not usable without the designer's permission |
| Thunderstore, More Vanilla Build Prefabs | mod page | confirms turf roofs are vanilla prefabs outside the hammer |
| Thunderstore, MissingPieces | mod page | shows `stone_wall_1x1_triangular` and similar names in the corpus come from a mod; not used |
| bamboogaming.net, hanging cloth door | fan database | recipe (red jute, fine wood) |
| Conquest Reforged, Anglo-Saxon longhouse and sunken-feature buildings (planetminecraft.com) | none stated | facts only (D-135); Minecraft builds, nothing downloaded |
| Assassin's Creed Valhalla, "Learnings: Anglo-Saxon Homes" (assassinscreedwiki.accesstheanimus.com) | fan wiki of game text | facts only (D-135) |
| medievalheritage.eu, Early medieval dwelling houses of the northern Slavic region | copyright the site | facts only (D-135) |
| Lauresham open-air laboratory (kloster-lorsch.de) | copyright the museum | facts only (D-135) |
| Smarthistory, Middle Byzantine secular architecture | not checked | facts only (D-135) |
| University of Washington, Silk Road Seattle, Dwellings | copyright the authors | facts only (D-135) |
| Stefan Applis, Svaneti: the Svan house | copyright the author | facts only (D-135) |
| Mount & Blade Wiki (fandom), Culture | not checked | names of Bannerlord cultures only; no building facts on the page |

Not reached or not checked: Wikipedia Crannog and Yurt (permission prompts went unanswered), Planet Minecraft terms
(the page failed). Building games with shareable designs (Enshrouded, Conan Exiles, Medieval Dynasty, Townscaper,
Tiny Glade, Foundation, Manor Lords) were not checked this session; none was found with an open licence for its
shared designs. Mecabricks was not checked.

## Commands

```
cd tools/blueprint-lab && npm install
node lib/gen_cultures.js out/cultures 6 ../../docs/cultures        # sample set and overview images (147 designs)
node lib/gen_cultures.js out/cultures 6 - saami,steppe             # some cultures only, no overview copy
python3 -I -c "from PIL import Image; import glob; [Image.open(f).convert('RGB').quantize(128, dither=0).save(f, optimize=True) for f in glob.glob('../../docs/cultures/*.png')]"
node lib/cli.js gen home Swamp celtic-crannog s3 d3 4 out/crannog   # one design
node lib/build_web.js web/index.html                                # the request page
```

The sample set lives in `tools/blueprint-lab/out/cultures/<key>/` (blueprint, four-view sheet and icon per design,
`summary.json`) and is not committed.
