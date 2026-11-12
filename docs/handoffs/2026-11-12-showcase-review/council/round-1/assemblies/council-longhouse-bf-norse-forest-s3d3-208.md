VERDICT: FAIL

# Assemblies seat (track G), round 1: council-longhouse-bf-norse-forest-s3d3-208

Longhouse, Black Forest, norse-forest culture, s3d3, seed 208. One feast hall of 180 m2 (T plan): fire, four tables
end to end, a bed and its chest at the west end, two chests at the east end. 38 item stands, 1 armor stand.

How it was checked: `node lab/audit_stand_items.js --file <blueprint> longhouse` run by this seat; all furniture and
stands listed from the blueprint; item boxes on flat stands tested against each other (turned boxes from
`data/stand-items/items.json` flat, script `/tmp/council-assemblies/overlap.js`); the generation re-run from the same
seed (identical blueprint) with hooks on `lib/standitems.js ledger/pick` and `lib/assemblies.js find/place`;
`views.png` read; close view of the table rendered read-only (`/tmp/council-assemblies/lh-table.png`).

## Scores

Hard fails:

| # | Result | Evidence |
|---|---|---|
| H1 repeat | pass | 0 `repeat`; Tankard, Tankard_dvergr, TankardAnniversary and MeadLightfoot 4 each (large-building caps 4) |
| H2 run | pass | 0 `run`; 4 MeadLightfoot in a row on one table (mead run 6) |
| H3 head | pass | 0 |
| H4 edge | pass | 0 |
| H5 mixed | pass | 0 (food and drink share the 'meal' group) |
| H6 armor dressed | pass | 1 of 1: troll leather set with cape |
| H7 furniture rests | pass | no assembly placed; stands on their tops (table 1.10 + 0.82, barrel + 0.90) |

Not on the checklist yet, found here (proposed as H8, see below): items pass through one another. 18 pairs of flat
items have overlapping boxes; 6 pairs stand 0.08 to 0.14 m apart center to center, where each item is at least
0.25 m across. Two clumps: four stands within 0.17 m on the second table (Tankard, Tankard_dvergr, MeadLightfoot,
CarrotSoup at x -2.09 to -1.97, z 2.44 to 2.61), and a MeadTasty set into a CookedWolfMeat on the chest by the bed
(0.12 m apart).

Weighted:

| # | Weight | Score | Points | Measured |
|---|---|---|---|---|
| 1 Items fit the room | 10 | 1 | 10 | 38 of 38 kinds weighted for a hall (mead, tankard, food, trophy) |
| 2 Items tell the household | 10 | 0.5 | 5 | ledger themes lore 0.79, fisher 0.43, hunter 0.43. Show items: 4 trophies, all hunter. But 27 of 38 stands are drink (15 meads, 12 tankards); the strongest theme (lore: curios, staffs, hats) shows nothing and fisher shows no fish. It reads as a drinking hall |
| 3 Variety | 8 | 1 | 8 | distinct per stand 0.50 (19 items on 38 stands) |
| 4 Village's world | 8 | 0 | 0 | village tier 1. Next tier: 2 (ShocklateSmoothie, TrophyDraugrElite), limit 2. Later tiers: 7 (Tankard_dvergr x4 tier 5, Bread and FishWraps tier 4, CookedWolfMeat tier 3), limit 1 |
| 5 Show items in bays | 6 | 1 | 6 | 4 trophies, all different |
| 6 Armor outfit | 8 | 1 | 8 | troll set, tier 1 (the village's), pattern CLH+c |
| 7 Built furniture where the room has a program | 10 | 0 | 0 | none. The hall's kinds (weapon rack, armor row, display shelf, keg rack) never placed; no bar, drink shelf or keg rack for a feast hall that serves 27 drinks |
| 8 Assemblies fit the room | 8 | 1 | 8 | none placed |
| 9 Assemblies in the room's materials | 8 | 1 | 8 | none placed |
| 10 No assembly repeated | 6 | 1 | 6 | none placed |
| 11 Hidden pieces with a purpose | 6 | 1 | 6 | 2 wood_ledge stacked as a two-shelf with things on both |
| 12 Shelves read as shelves | 4 | 0.5 | 2 | the two-shelf holds one mug and one other thing per shelf (TankardAnniversary + MeadStaminaMinor; Tankard_dvergr + CarrotSoup); the bedside chest holds wolf meat under three potions |
| Total | 100 | | 67 | pass mark 75; without items 8 to 10, 45 of 78 (58 %) |

Fails on: item 4 (seven later-tier items), item 7 (no built furniture in a 180 m2 hall), item 2 (the household's
own themes do not show), and the overlapping clumps (proposed H8).

## Walk-through

- The hall is long and mostly empty. The four tables run end to end against the north wall with benches on one side
  only. The T wing (about 6 x 6 m) holds nothing, and the east half has only the fire and two chests.
- Every table is covered in drink: 21 things on the tables, of them 7 meads and 9 tankards. Four Lightfoot meads
  (a jumping potion) stand in a row as if they were the drink at supper. In the middle of the second table a mug, a
  Dvergr tankard, a mead bottle and a bowl of carrot soup are pushed into one another in a 17 cm heap.
- Dvergr tankards (Mistlands) four times, bread and fish wraps (Plains) and cooked wolf meat (Mountain) in a Black
  Forest village at its third stage. A Black Forest household would not have these.
- By the bed, the chest holds a cooked wolf leg with a mead bottle set into it and two potions beside it: poison
  resistance and minor healing. This is the same fault as the raw fish, raspberry and poison pot Tyler found on a
  chest: food and medicine on one surface for no reason. Poison resistance mead stands three times in the hall.
- The east chests hold a greydwarf trophy, a Dvergr tankard and two poison resistance meads.
- The walls carry a deer, a boar and a draugr elite trophy, spread well apart. The armor stand by the bed wears a full
  troll leather set with its cape. These read well.
- Nothing is built from pieces for the hall: no weapon rack by the high seat, no keg rack or drink shelf where all the
  drink would come from, no display shelf for the trophies.

## Rule faults found here (each is general)

1. **Built furniture blocked by the window rhythm and the filters.** `builtZone` asked for the feast hall's kinds and
   got 3 recipes, 2 after its filters (AC-display-shelf-06 2.0 m wide, AA-weapon-rack-01 2.5 m). No spot passed the
   wall-stretch test: every stretch that wide on both long walls has a window or a door (debug object empty: no
   recipe reached the spot tests). The hall's list also leaves out bar-counter (8 recipes), drink-shelf (3) and
   sitting-nook. Change R1.
2. **Later tiers have a weight per draw and no cap per building.** `lib/standitems.js itemOf` gives the next tier
   0.12 and later tiers 0.03 per draw, and a theme's `prefer` list multiplies by 3 (Tankard_dvergr is on the brewer
   list). Over 38 stands the small weights add up to 7 later items. Change R5.
3. **Heaps mix kinds and nothing checks items against each other.** `lib/stands.js pileStands` builds a heap of one
   kind, but `lib/persona.js dressStands` picks each heap stand on its own, and the 'meal' group lets food, tankards
   and meads into one heap. `lib/standitems.js check` has no code for two items whose boxes cross. Corpus heaps are one
   kind (food under food 209 pairs, drink 94, herbs 65; `lib/stands.js` HEAP note). Change R4.
4. **Items picked by kind, not by where each item is shown.** MeadLightfoot: 0 of 20 corpus stands at a dining spot,
   yet 4 on the feast table. MeadFrostResist 17 of 603 at dining (3 %). Change R3.
5. **Set wants override the household.** Every table and chest set asks for 'meal' or 'drink' (`KS-t-meal2`,
   `KS-t-meal4`, `KS-ch-three`), so a lore and fisher household shows only drink. The wall fish set asked for fish and
   got nothing, because `rules.rooms.hall` has no fish weight. Change R7.

## Rule changes (for every building)

- **R1, program furniture first.** In `lib/rooms_intent.js`, place the room's built furniture as part of its core
  set, before loose furniture, from the corpus kinds of its zones (feast hall: bar-counter, keg-rack, drink-shelf,
  weapon-rack, display-shelf; sleeping corner: bed-nook, bedside), on a wall back or corner, letting a recipe's own
  table, seat or station stand in for the suite's. Where every wall stretch has a window, place it under a window when
  it stays below the sill (exists) or ask the facade plan for one blind bay in the room (see conflicts in the lead
  message).
- **R3, items by their own corpus place** (`lib/standitems.js itemOf`): weight by the item's share of corpus stands at
  the stand's use; leave out items with 10 or more corpus stands and none there.
- **R4, one-kind heaps and a clash check.** Heap stands take the base stand's item (a pile of one thing), or at least
  its kind; `check` gets a code `clash` for two flat items whose turned boxes cross unless both belong to one heap of
  one kind. Add it to the criteria as H8.
- **R5, a tier budget per building.** The ledger counts items past the village's tier; once 2 from the next tier or 1
  from later tiers are placed, those items weigh 0 for the building, and `prefer` never lifts an item past the next
  tier.
- **R7, themes choose the sets.** In `lib/stands.js dressTops`, weight each set by how well its wants match the
  ledger's themes (lore: KS-t-curio, KS-s-curios; fisher: KS-w-fish with a room that takes fish; hunter: trophy walls),
  so food and drink sets go mainly to the tables of a feasting or brewing household.
