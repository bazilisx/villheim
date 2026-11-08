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
