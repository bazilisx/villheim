# Furniture assemblies and stand items

Track G of the showcase review (`docs/handoffs/2026-11-12-showcase-review/`). Two things the generator places
inside rooms: furniture builders make out of building pieces, stations and decor (assemblies), and what goes on item
stands, shelves, tables and armor stands (stand items). Tyler, 2026-11-12 (`TYLER_NOTES.md`, last section): items on
stands are "both random and meaningless ... and theyre also repeative and meaningless", "there is nothing currently
hanging on any of the armorstands", and the helper on interior design should "research images or video stills that
show how folks in the corpus or elsehwere make interior design elements like potion cabinets, kitchen tables, shelves,
etc." His examples are instances of wider faults (common.md, "Tyler's examples are symptoms"); the rules below are
written by principle and apply to every item kind and every assembly kind.

- Code: `tools/blueprint-lab/lib/assemblies.js` (find, place, choose recipes), `tools/blueprint-lab/lib/standitems.js`
  (ledger, pick, armor, pose, overhang, check, kindOf).
- Data: `tools/blueprint-lab/data/assemblies/` (`authored.json`, `corpus.json`, `drop.json`),
  `tools/blueprint-lab/data/stand-items/` (`items.json`, `rules.json`, `corpus.json`).
- Lab: `lab/mine_assemblies.js`, `lab/select_assemblies.js`, `lab/author_assemblies.js`, `lab/render_assemblies.js`,
  `lab/test_assemblies.js`, `lab/mine_stand_items.js`, `lab/build_stand_items.js`, `lab/test_standitems.js`,
  `lab/audit_stand_items.js`.
- Pictures (private repo, builders' and Tyler's images): `villheim-corpus/research/2026-11-12-assemblies/` (`album/`
  with `NOTES.md`, `renders/`, `web/`).

## Sources

1. **Tyler's "Game Inspo" album** (Google Photos, 191 pictures, read in his Chrome on 2026-11-12). About 40 are
   interiors; each is described in `album/NOTES.md` in the private repo with what it teaches and whether it fits.
   The rest are exteriors (cottages, towers on rock spires, island bases), useful to the shell and garden tracks.
2. **Tyler's collage** (`research/2026-11-12-tyler/custom-furniture-collage.png`): stills from Versaugh's "100 Valheim
   Decoration Ideas You can DO in 1.0" (a kitchen hutch with pans, a display hutch with barrels under it, a dresser
   with an arched mirror, a stove with two grills, a fountain, a wash basin on a chest).
3. **Builders' videos and tips** (titles and chapter lists, thumbnails): Versaugh "Over 20 building interior build
   ideas, tips and hacks" (chapters: mead cabinet, kitchen, trophy case, pantry cabinet, small cabinet with shelf,
   study desk, grill, half barrel, flower pots, weapons cabinet, lamp shade, wardrobe closet, fridge, bedhead, sofa,
   table saw); saphonette "Valheim Ashwood Pantries / Kitchen Storages" (witchy, kitchen, minimal, compact, bookcase
   and modular pantries: one kind of thing per shelf); Alessio "10+ furniture ideas" (crates of berries, a planter box,
   a plate of food); a building tips transcript (SozAI, "50+ building tips in Valheim 2026": signs on half walls as
   cabinet drawer fronts, an item stand on a stool holding a wooden shield as a round side table, cooking stations over
   a fire as a drying rack, item stands on 1 x 1 floors along window sills); valheimians forum thread 277 (builders use
   pieces hidden from the build menu).
4. **The corpus**: the unpacked blueprints (2,657 files; 1,900 vanilla builds read), mined for furniture clusters and
   for every item stand and armor stand inside a building.

## Principle 1: every object has a reason (who lives there, what the room is for)

Tyler's instances: a carrot and a fire pot, a raw fish on a chest next to a raspberry and a poison mead, a saddle on a
table. The same fault shows across every kind in the current generator: `lib/persona.js standItem` picks a kind by
place shares and hobbies and then any item of that kind from any biome; `lib/stands.js` sets like `KS-t-arms` put
weapons and shields on dining tables and `KS-ch-three` puts three unrelated things on a chest lid.

What the corpus shows (`data/stand-items/corpus.json`, 22,042 dressed stands inside 407 builds): kinds cluster by the
use piece within 3 m. Lift against the average stand: tools next to a forge 5.0 and a workbench 4.1; raw meat by the
cooking 4.7; fish at a table 3.3; food at a table 3.2; tankards at a table 3.0; knives by the cooking 3.1; herbs by a
bed 3.4; staffs by a mage table 6.5, bows 5.0, curios 4.0; trophies by the hearth 2.2, shields 1.9; materials by a
workbench 7.0. Stands near each other on one surface hold one theme (corpus groups: table drink+food 60, drink+drink
26, shelf drink rows, ledge herbs, wall weapon+weapon, sill trophy+trophy).

Rules (`lib/standitems.js pick`, `data/stand-items/rules.json`):
- A building keeps one ledger with the household's two or three themes (`themesFrom(persona)`: hunter, cook, brewer,
  healer, smith, woodworker, farmer, fisher, warrior, lore, feaster, from the persona's hobbies; traits of the household,
  never a trade).
- A stand's kind is weighted by the corpus counts at its place (`placeKind`: table, shelf, counter, chest, seat, stand,
  floor; wall stands by the nearest use piece), times the room kind's weights (`rules.rooms`, from the lifts above;
  a kind missing from a room is never placed there), times the household's themes.
- Stands within 0.9 m on one surface share a theme (`rules.groups`: meal, drink, pantry, apothecary, arms, work,
  trophies, curios); a stand between two groups takes only what both take.
- Items from any biome may be on show (D-065, D-126); the village's tier and those before it weigh most, one tier
  ahead weighs 0.12 (a traded good), later tiers 0.03 (`ledger({ later })`, 0 keeps them out). Big trophies only at the
  hub, hall or temple (D-134 in `lib/persona.js`).
- A set that asks for a kind (`want`) gets that kind or nothing: when the house cannot show it (its cap reached, no
  fitting item), the stand is left out rather than filled with something unrelated.

## Principle 2: repeats are capped by what builders repeat

Tyler's instances: lox pies on every shelf of the longhouse's upper floor, the same raspberry and poison mead five
times, three Jotun Bane axes side by side, the same serpent shield and blackmetal tower shield. The same fault is in
every kind: `persona.js fromStock` reuses an item already on show with 35 to 95 % odds for drink, food, herbs, fish,
hats, shields, weapons, farm tools, tools and trophies.

What the corpus shows: in house-sized builds (87 builds with 5 to 60 dressed stands) the largest count of one item
of a kind is, at the median: weapons, bows, knives, tools and farm tools 1; tankards, food, herbs and curios 2;
trophies, shields and hats 3; meads and produce 4 (`corpus.json kindMaxHomes`). Over all 407 builds: trophies 4,
tankards 4, meads 4, food 3, produce 8. The same item side by side: shields stand alone 95 % of the time, trophies
91 %, axes 98 %, tools 92 %; meads 75 %, tankards 84 %, food 86 %, produce 31 % (produce comes in rows). Distinct
items per dressed stand: p25 0.18, median 0.43 (homes 0.40).

Rules (`rules.caps`): per item per building, the home median above, or the all-build median in halls, taverns, hubs,
temples, storehouses and buildings over 140 m2. Show items (weapons, shields, trophies, tools, curios, hats) never
stand side by side with the same item and repeat only 1.5 m or more apart (one shield per post bay, album 125 and
127). Drink, food, herbs and produce may stand in a row of one item up to their run (meads and tankards 6, produce 6,
food and herbs 3) when the set lays a row. Assemblies: one recipe once per building; one kind at most twice in a home,
four times in a large building (`lib/assemblies.js choose`).

## Principle 3: objects rest the way they physically would

Tyler's instances: an axe sticking straight up on its head, a saddle halfway off a table, signs and stands hovering
off walls (his 2026-11-11 notes). The same fault covers every long weapon and tool on a flat stand, every item near
an edge, and every built part of a piece of furniture.

What the item models show (`data/item-models.json`, the item's box as the flat stand shows it): swords, knives and
shields lie (sword top 0.07 m, 1.27 m long); axes stand 0.89 m on their head, maces 1.05 m on their end, sledges
1.38 m, battleaxes 1.68 m; a lox saddle reaches 1.31 m forward of its stand, a lox pie is 0.57 m across, bread 0.91 m
long. 44 items stand 0.55 m or more tall on an upright flat stand (`items.json tall`). In the corpus, flat stands with
swords are turned on their side 95 of 201 times, with maces and clubs 261 of 544, tools lean 187 of 260, shields lean
297 of 611; wall stands hang level (8,048 of 8,103). Builders turn the stand with its
local z pointing down 475 times out of 715 turned weapon stands.

Rules (`lib/standitems.js pose`, `overhang`):
- A tall weapon or tool (`rules.pose.tallKinds`) on a flat stand is turned 90 degrees about the stand's x axis so it
  lies on its side on the surface; the pivot is raised so the item's lowest point touches the top. On a floor stand it
  is left for a wall stand.
- An item's box stays inside the top it stands on, 5 cm at most over the edge; the picker turns the stand by 90
  degree steps until it fits, or picks a smaller item.
- Every piece of an assembly rests on the floor, on another of its pieces (top within 0.25 m under its foot), or hangs
  on the wall behind it (`lab/select_assemblies.js floats`); sets lifted off the floor or holding a piece in the air
  are left out (154 corpus candidates left out this way).

## Principle 4: furniture is made for the room's program, from the room's materials

Tyler's instance: "how they make custom furniture for different rooms". The generator's current custom furniture is
a few hand-built sets in `lib/kitbash.js` (bar counter, canopy bed, stalls, dais, vignettes) and the creative sets
mined by contact (`data/creative-mined*.json`), which group two or three touching pieces and lose the furniture they
belong to.

What builders make (album, collage, videos, corpus): potion and mead cabinets, kitchen hutches with pans and a prep
counter, pantries with one kind per shelf, bars with a back shelf of one drink and kegs at the end, keg racks,
canopy and four-post beds with nightstands, cabinets of chests framed by half or quarter walls (signs as drawer
fronts), dressers, wardrobes between posts, armor alcoves with a light over each, weapon racks with the shield in the
middle, tool walls over a chest, built-in benches round a low table, display counters with one kind of food per row,
trophy plinths, drying racks of herbs and fish on a beam, round side tables from a stool and a shield, kitchen stoves
(hearth or fire with a cauldron or grill, framed by stone or beams), forge, workbench, artisan, mason and spinning
corners with their extensions, galdr corners, labeled storage (chests with signs), chest shelves.

The recipes (`lib/assemblies.js`, 286 recipes in 37 kinds):
- 19 written from Tyler's album and collage, the videos and the corpus rules (`data/assemblies/authored.json`,
  `lab/author_assemblies.js`; each piece set by the bottom of its measured box).
- 267 mined from the corpus (`lab/mine_assemblies.js`: 9,521 clusters grown from a seed piece through touching
  pieces, from the floor to 2.9 m, within 2.2 m; written in the frame of the nearest full wall; `lab/select_assemblies.js`:
  furniture only, named by what they hold, near copies joined, the best liked example of each from different builds,
  floating sets left out, 37 more left out by eye after rendering, listed in `drop.json`). The builder's own items are
  not copied: each stand keeps the kind of thing it held (`want`) and the household's item is picked for it.
- Each recipe: pieces with offsets and turns in the wall frame (x along the wall, z into the room from the wall face,
  y over the floor), footprint, wall (back, corner, none), room kinds, look families (catalog), the built family,
  cultures (any, or stone), hidden pieces, corpus build count, source.
- `place(recipe, spot, { family })` swaps the built parts to the room's wood or stone (plank, darkwood, wood and iron,
  ashwood, log, timber, scalewood; stone, black marble; 1 x 1 tops to grausten), keeping each part's box centre, so a
  darkwood room gets a darkwood cabinet (the catalog's pairing finding: one wood family per zone, PIECE_CATALOG.md).
- Kinds name the rooms they suit (`rooms`); `find` filters by room, size, wall, culture and family and ranks by corpus
  support and by Tyler's own pictures.

Hidden pieces (D-166, Tyler 2026-11-12): pieces hidden from the build menu are fine with a purpose. Recipes list them
in `hidden` and mark each piece; 5 corpus recipes and one authored recipe use them (`barrell` as kegs,
`goblinking_totemholder`). Loose items builders set down as decor (food, meads) are marked `loose` (12 recipes).

## Principle 5: display pieces are dressed

Tyler's instance: "there is nothing currently hanging on any of the armorstands". The same holds for every display
piece the generator places: item stands without an item are taken out (`persona.js dressStands`), but armor stands
were never given gear (43 of 43 empty in the audit below).

What the corpus shows: 1,996 armor stands in the vanilla builds, 1,219 dressed (61 %). Patterns among the dressed
(C chest, L legs, H helmet, S shield, W weapon, c cape): CLH with a cape 266, CLH 184, CLH with a weapon and cape 112,
a cape alone 106, the full kit 77, a helmet alone 48, a chest piece alone 46. Sets as players wear them: Fenris 103,
iron 87, padded 75, eitr-weave 65, troll 60, wolf (with the drake helmet) 57, carapace 56, flametal 50, bronze 49,
root 40, leather 35, Ask 34, Hildir's tunics and dresses about 70 (often with wolf legs and the drake helmet). Per
build: median 3 armor stands with 2 outfits; the same outfit at most once in the median build; all stands the same in
8 of 134 builds with two or more.

Rules (`lib/standitems.js armor`, `rules.armor`): every generated armor stand gets an outfit. The pattern comes from
the room (entry: a cape or a working kit; bedroom: the sleeper's set; hall and armory: full kits; smithy and workshop:
part sets), the set from the village's tier and the one or two before, weighted by corpus use and the household's look
(warrior, hunter, lore, worker); capes, shields and weapons by tier and look. The same outfit comes again in a
building only when nothing new comes up. Output is the text the mod reads: `"ArmorBronzeChest:0,ArmorBronzeLegs:0,HelmetBronze:0,CapeDeerHide:0"`
(`src/Villheim.Logic/Designs/StandItems.cs ApplyArmor`); set it as the armor stand's `info`.

## Audit of the current generator

`node lab/audit_stand_items.js 2` (the 16 showcase specs at 2 seeds each, main at 2e607cf with this branch's
check): 27 of 32 designs fail. Failures: 70 items over the edge of what they stand on (food, drink, trophies, fish),
43 empty armor stands (all of them), 34 surfaces mixing unrelated things (tankards with trophies, a sword with a mead,
a fishing rod with a fish soup), 33 items over their cap (MeadHealthMajor 10 times in a home, TurnipStew 8, Bread 6,
Scythe 4, SwordMistwalker 3), 9 tall tools and weapons upright on flat stands (hoes, scythes, pickaxes, bows, the Jotun
Bane), 5 show items side by side. Tyler's examples are among these; the rest are the same faults in other kinds.

## Using it (for track E)

```js
const SI = require('./lib/standitems.js'), AS = require('./lib/assemblies.js');
// one ledger per building
const L = SI.ledger({ biome, stage: 3, kind: 'home', floorM2, persona: P, seed });
// furniture: a recipe for a wall 2.4 m long and 0.8 m deep in a study, in the room's wood
const r = AS.choose(L, { kinds: ['potion-shelf', 'display-shelf'], room: 'study', maxW: 2.4, maxD: 0.8, family: 'darkwood' });
const pl = AS.place(r, { x, y: floorTop, z, facing }, { family: 'darkwood' });
// pl.pieces (each with asm: r.id), pl.box and pl.corners (footprint), pl.front (where a person stands), pl.stands
for (const s of pl.stands) {
  const p = pl.pieces[s.i];
  if (p.name === 'ArmorStand') { p.info = SI.armor(L, { room: 'bedroom' }).text; continue; }
  const got = SI.pick(L, { stand: p.name, place: s.place, room: 'study', near: 'magic', x: p.x, y: p.y, z: p.z, yaw: p.yaw, top, want: s.want, row: s.row });
  if (got) Object.assign(p, { item: got.item, q: got.q, y: got.y, yaw: got.yaw }); else drop(p);
}
// any other stand the decorator places: the same pick with its place, room and nearest use piece
// the council audit: SI.check(design.pieces, { kind, topOf }) -> { fails, counts }
```

`pick` returns `q` (a quaternion) when the stand must be turned on its side; the blueprint writer takes `p.q` as it
is. `place` returns pieces with `yaw` and `q`; a mined piece turned off the vertical keeps its turn in `q`.

## Open

- The stand items picker does not yet know a stand's room on its own: the caller passes `room` and `near` (the
  decorator knows them). `standAt` and `roleAt` in `lib/persona.js` can supply them until track E's room intent does.
- Corpus recipes were looked at in renders twice; those that came in after the second drop list (to fill a kind's
  limit) were not looked at one by one. The renders are in the private repo.
- Fountains and wash basins (collage) are not written: the vanilla pieces for water and a basin were not identified.
- Banners in authored recipes are left out: the banner's hanging frame was not checked.
- Item variants (shield styles) are always 0.
