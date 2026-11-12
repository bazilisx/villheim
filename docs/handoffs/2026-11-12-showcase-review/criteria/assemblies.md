# Council criteria, track G (furniture assemblies and stand items)

> Since 2026-11-12 this file is a seat's diagnostic notes: what the track measures and how. A design's verdict comes
> from the qualities in `docs/DESIGN_QUALITIES.md` and Tyler's hard rules there; the pass marks and hard fails below
> explain shortfalls and do not decide a verdict on their own (`docs/HELPER_RULES.md`, "The design council").

How track G judges a generated s3d3 building: what stands on item stands, shelves, tables and armor stands, whether
it means something for the household and the room, how often it repeats, whether it rests the way it would, and
whether the custom furniture fits the room. The rules and numbers are in `docs/FURNITURE_ASSEMBLIES.md`; the data in
`tools/blueprint-lab/data/stand-items/` and `data/assemblies/`. Tyler's examples (lox pies, the poison mead and
raspberry, the Jotun Bane axes, the saddle, empty armor stands) are single instances of the principles below; every
check covers every item kind and every assembly kind.

Tools:
- `node lab/audit_stand_items.js --file <design.blueprint> <kind>` runs `lib/standitems.js check` on a design: hard
  fail codes `repeat`, `run`, `mixed`, `head`, `edge`, `empty-armor`, and the counts used below.
- Renders: the council's room views of the building (from the room side, cut at 2.6 m) and the top view.

Scoring: each weighted item scores 0 (fails), 0.5 (partly) or 1 (passes), times its weight. Pass mark: 75 of 100, and
no hard fail.

## Hard fails (any one fails the building)

| # | Check | Test | Source |
|---|---|---|---|
| H1 | No item over its cap | `check` code `repeat` is zero: one item per building at most the corpus median of the most repeated item of its kind (homes: weapons, bows, knives, tools 1; tankards, food, herbs, curios 2; trophies, shields, hats 3; meads, produce 4; large buildings: trophies, tankards, meads 4, food 3, produce 8). | Tyler: "800 lox pies", "The same raspberry + poison pot 5x"; corpus `kindMaxHomes` (87 house-sized builds), `kindMax` (407 builds) |
| H2 | No show item side by side with itself | `check` code `run` is zero: weapons, shields, trophies, tools, curios and hats never next to the same item (within 0.6 m); drink, food, herbs and produce rows no longer than their run (6, 6, 3, 3, 6 items). | Tyler: "Literally 3 of the yellow dripping axes next to each other"; corpus: shields alone 95 %, trophies 91 %, axes 98 % |
| H3 | Nothing on its head or end | `check` code `head` is zero: no axe, mace, sledge, pickaxe, farm tool, bow, staff or other long weapon or tool upright on a flat stand. | Tyler: "an axe sticking straight up on its head"; item models: axe 0.89 m tall upright, sledge 1.38 m; corpus: swords and maces on flat stands turned on their side about half the time |
| H4 | Nothing over an edge | `check` code `edge` is zero: every item's box on a flat stand stays inside the top under it, 5 cm at most over. | Tyler: "A saddle halfway off a table"; item models (lox pie 0.57 m across, bread 0.91 m long) |
| H5 | No surface mixing unrelated things | `check` code `mixed` is zero: stands within 0.9 m on one surface share a theme (meal, drink, pantry, apothecary, arms, work, trophies, curios). | Tyler: "A full raw fish on a chest next to a raspberry and a poison pot"; corpus groups (table drink+food, shelf drink rows, wall weapon+weapon) |
| H6 | Armor stands dressed | `check` code `empty-armor` is zero in rooms that show gear (every armor stand the generator places). | Tyler: "there is nothing currently hanging on any of the armorstands" |
| H7 | Furniture rests | Every piece of a placed assembly rests on the floor, on another of its pieces or on the wall behind it; nothing floats (render: no gap under a shelf board, a stand or a chest). | Tyler 2026-11-11: hovering signs, stands and lights; `lab/select_assemblies.js floats` |

## Weighted checks

| # | Weight | Check | Test | Pass | Source |
|---|---|---|---|---|---|
| 1 | 10 | Items fit the room's purpose | For each dressed stand, its kind has a weight in `rules.rooms` for the room it stands in (kitchen: food, produce, raw meat, knives; smithy: tools, materials, weapons; bedroom: herbs, meads, the sleeper's gear ...). | 90 % of dressed stands | corpus lifts: tools by a forge 5.0, raw meat by the cooking 4.7, fish at a table 3.3, herbs by a bed 3.4 |
| 2 | 10 | Items tell the household | The building's dressed stands lean to its two or three themes: at least half of the show items (trophies, weapons, tools, curios) and half of the food and drink belong to a kind its themes weigh (`rules.themes`). Render: a reader can name who lives there from the stands. | half or more | Tyler: a hunter's trophies and bows, a cook's pans and food, a smith's tools, a healer's potions (brief); INTERIOR_DESIGN.md storytelling |
| 3 | 8 | Variety across the building | Distinct items per dressed stand, counting each row once: 0.3 or more in a building with 8 or more dressed stands. | 0.3 | corpus homes: distinct per stand p25 0.18, median 0.40 |
| 4 | 8 | Items mostly from the village's world | Items from tiers past the village's are allowed (D-065, D-126: stand items from any biome) but few: at most 2 from the next tier and 1 from later tiers per building. | yes | brief: biome tier and village stage; `items.json tier`; D-065 |
| 5 | 6 | Show items spread in bays | Repeats of a show item (the same shield, trophy, curio) stand 1.5 m or more apart, one per wall bay. | yes | album 125 and 127 (one shield per post bay); corpus shield and trophy repeats |
| 6 | 8 | Armor outfits by stage and household | Every armor stand's outfit: a corpus pattern (set with or without cape, weapon and shield; cape alone; helmet alone), its set from the village's tier or the two before, the same outfit at most once per building unless the building has more stands than outfits. | yes | corpus: 1,219 dressed stands, patterns and sets in FURNITURE_ASSEMBLIES.md; median 2 outfits on 3 stands |
| 7 | 10 | Assemblies used where a room has a program | Each room with a purpose has its furniture made for it: a kitchen a stove or hutch or pantry, a study a potion or display shelf, a tavern a bar or keg rack, a bedroom a bed set with nightstands or a dresser or wardrobe nook, a smithy or workshop its station corner with a tool wall. Count rooms with at least one fitting assembly or station corner. | 75 % of rooms with a purpose | album and collage; corpus clusters (28 kitchen stoves, 16 forge corners, 16 cabinets ...) |
| 8 | 8 | Assemblies fit the room | Each placed assembly: its kind lists the room's kind; its box inside the room with its front (`front`) on or beside a walking line; nothing in a door box. | every assembly | D-148, D-152; `lib/assemblies.js place` box and front |
| 9 | 8 | Assemblies in the room's materials | The built parts of each assembly are the room's structure or furniture wood or stone family (swapped by `place(..., { family })`); a black marble or grausten recipe only in a stone room. | every assembly | catalog pairing (one furniture family per zone); Tyler on mixed woods |
| 10 | 6 | No assembly repeated | The same recipe at most once per building; one kind at most twice in a home, four times in a hall, tavern or storehouse. | yes | Tyler: "the same pattern of stacking chests on practically every corner" |
| 11 | 6 | Hidden pieces with a purpose | Pieces hidden from the build menu (`hidden` in a recipe, wood_ledge) only inside an assembly that uses them for its purpose (kegs as kegs, a ledge as a shelf with things on it); never as loose filler. | yes | D-166 (Tyler 2026-11-12) |
| 12 | 4 | Shelves read as shelves | Render: each shelf or counter has its things in groups with gaps (pairs, a row of one kind, one curio), never one of every kind spread evenly; a row of one drink on a bar shelf is right. | reviewer's call | album 128, 176, 180; saphonette pantries (one kind per shelf) |

Total weight 100. Pass: 75, with no hard fail.

## Baseline (main at 2e607cf)

`node lab/audit_stand_items.js 2` over the 16 showcase specs at 2 seeds: 27 of 32 designs fail at least one hard
check: edge 70, empty-armor 43 (every armor stand), mixed 34, repeat 33, head 9, run 5. No generated design uses an
assembly recipe yet (the library is new).
