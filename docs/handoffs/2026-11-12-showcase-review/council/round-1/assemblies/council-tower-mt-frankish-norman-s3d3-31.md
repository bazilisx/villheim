VERDICT: FAIL

# Assemblies seat (track G), round 1: council-tower-mt-frankish-norman-s3d3-31

Tower, Mountain, frankish-norman culture, s3d3, seed 31. A square stone keep: ground floor 79 m2 (intent: bedroom,
four dragon beds), first floor 75 m2 (intent: watch room, a table and gear), second floor 77 m2 (lookout, "a small
room kept plain"), flat roof. 6 wall stands, 1 armor stand.

How it was checked: `node lab/audit_stand_items.js --file <blueprint> tower` run by this seat; furniture and stands
listed from the blueprint; the generation re-run from the same seed (identical blueprint) with `VH_DEBUG_ASM=1` and
hooks on `lib/standitems.js ledger/pick` and `lib/assemblies.js find/place`; `views.png`, `floor-1.png`,
`floor-2.png`, `floor-3.png` read; close views rendered read-only (`/tmp/council-assemblies/tower-f0*.png`).

## Scores

Hard fails:

| # | Result | Evidence |
|---|---|---|
| H1 repeat | pass | 0; every item once |
| H2 run | pass | 0 |
| H3 head | pass | 0 (wall stands only) |
| H4 edge | pass | 0 |
| H5 mixed | pass | 0 |
| H6 armor dressed | pass | 1 of 1, but with one piece: ArmorRootChest |
| H7 furniture rests | pass | no assembly placed |

Weighted:

| # | Weight | Score | Points | Measured |
|---|---|---|---|---|
| 1 Items fit the room | 10 | 0 | 0 | judged by the room each stand is in (the intent): 1 of 6 fits. Bedroom: ShieldSilver fits; PickaxeBronze and PickaxeIron have no weight in a bedroom. Watch room (armory weights): Hammer, Fish3 and Fish11 have none. The generator picked them as 'home' and 'storage' (see fault 1), where all 6 fit |
| 2 Items tell the household | 10 | 0.5 | 5 | ledger themes smith 0.96, woodworker 0.67, lore 0.28. Show items 4 of 4 are smith kinds (2 pickaxes, hammer, shield); food 0 of 2 (two fish). It reads as a smith, in a guard tower |
| 3 Variety | 8 | 1 | 8 | 6 stands, not tested |
| 4 Village's world | 8 | 1 | 8 | village tier 3; 1 later item (Fish11, tier 6, Ashlands), limit 1 |
| 5 Show items in bays | 6 | 1 | 6 | no item repeated |
| 6 Armor outfit | 8 | 1 | 8 | root set, tier 2 (within the two before); pattern chest only (46 of 1,219 corpus stands) |
| 7 Built furniture where the room has a program | 10 | 0 | 0 | 0 of 2 rooms with a purpose: no bedside, dresser, wardrobe nook or armor alcove for four sleepers; no weapon rack or armor row in the watch room |
| 8 to 10 Assemblies fit, materials, repeats | 22 | 1 | 22 | none placed |
| 11 Hidden pieces with a purpose | 6 | 1 | 6 | none used |
| 12 Shelves read as shelves | 4 | 1 | 4 | no shelf |
| Total | 100 | | 67 | pass mark 75; on the items that apply (1, 2, 4, 5, 6, 7), 27 of 52 |

Fails on: item 1 (items for the wrong rooms), item 7 (no built furniture on any floor), item 2 (a smith's things in a
guard tower).

## Walk-through

- Ground floor: four large dragon beds, one in each quarter, an iron-banded chest in the middle between them, two
  stools. On the north wall, a bronze pickaxe and an iron pickaxe hang half a meter apart; a silver
  shield hangs on the east wall. Mining tools over a bunk room have no reason. The shield fits.
- Four people sleep here and nothing is made for their things: no bedside shelf, no dresser or wardrobe nook, no armor
  alcove. Their gear has no place.
- First floor, the watch room: the table it was planned around was taken out to keep the way clear, so 75 m2 hold one
  armor stand wearing only a root chest plate, a hammer on the wall beside it, and two fish on the opposite wall (Fish3,
  and Fish11, an Ashlands fish). No weapon rack, shields, bows or table. Nothing says this is where guards keep watch.
- Second floor, the lookout: 77 m2, empty. The roof: empty.
- Every wall stand is level and on its wall (wall stands only, no flat stands in the building).

## Rule faults found here (each is general)

1. **Stand items read the building's use and the floor height, never the room.** `lib/persona.js roleAt` maps the
   tower's 'guard' use to 'home' and every floor over 1.6 m to 'storage' for any building that is not a home or hall
   (hook trace: ground floor picks `room=home`, first floor `room=storage`). The room intent (bedroom, watch room) is
   never read. So tools went to a bunk room and fish to a watch room. Change R2.
2. **The watch room has no numbers, so it gets no zones and no built furniture.** `data/intent.json` kinds has no
   'watch room' entry; `supportZones` returns before `builtZone` (trace: only the bedroom called `AS.find`). When the
   one planned table was left out for the way through, nothing replaced it. The same holds for any intent kind the
   generator assigns without corpus numbers. Change R8.
3. **Built furniture comes after the beds.** In the bedroom `builtZone` tried 4 recipes (AC-armor-alcove-16,
   AA-dresser-01, AC-dresser-05, AC-wardrobe-nook-03) and found no spot: 82 overlapped furniture already placed and 39
   fell in keep-clear zones (37 by the stair, 2 by the door). Change R1.
4. **Armor stands dressed by pattern alone.** The watch room's one gear stand got a single chest plate. The pattern is
   in the corpus (C only, 46 of 1,219), but a watch room's stand is where the full kit of the guard would hang. Change:
   `SI.armor` weights patterns by room (armory and entry: full set with weapon or shield; bedroom: set or cape;
   storage: chest or helmet alone).

## Rule changes (for every building)

- **R1, program furniture first.** In `lib/rooms_intent.js`, place the room's built furniture in its core set before
  loose furniture: a bedroom for several sleepers takes bed-nook or bedside recipes (each bringing its own bed, in
  place of the suite's) and an armor-alcove or wardrobe-nook; a watch room takes a weapon-rack or armor-row; query wall
  back or corner.
- **R2, stands read the room's intent.** `lib/persona.js dressStands` takes the room kind and the stand's zone from
  the intent record and maps it to `rules.rooms` (bedroom and dormitory: bedroom; watch room: armory; feast hall:
  hall; kitchen zone: kitchen; eating zone: dining; fire zone: hearth). `roleAt` stays only as a fallback, with
  "upper" measured from the building's lowest floor.
- **R8, every intent kind has numbers.** Each room kind the generator assigns (watch room, lookout and the like) gets
  an entry in `data/intent.json` kinds or names the corpus kind it borrows from (for example watch room from dining
  or display), so `supportZones` and `builtZone` run for it; a room whose planned focal piece is taken out for the way
  through gets its next zone instead of staying bare.
