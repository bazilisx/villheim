VERDICT: FAIL

Home, Mountain, swamp culture, s3d3, seed 95. One L-shaped room of 108 m2 on a raised deck. Closest of the four to
what Tyler asked for, but he would still call it bare, and two of his named faults come back (fire_pit, pairs of
chests on a wall).

## Scores (judge checklist, see README.md)

| # | Item | Score | Points | Evidence |
|---|---|---|---|---|
| J1 | Rooms have intent | Partly | 7 / 14 | A kitchen line on the west wall (prep table, oven, chest), the fire with a cauldron on the back wall, bed and table at the east end. But the armor stand stands in the kitchen corner between a chest and the butcher table (-4.25, 2.0), cooking is split between the oven corner and the cauldron 6 m away, and the south leg of the L (about 24 m2) holds only a prep table in its corner and two chests on the inner wall. |
| J2 | Lived in, nothing bare | Partly | 7 / 14 | 21 items in 108 m2: 1.94 per 10 m2 (home corpus p25 1.48, p50 2.27). Walls nearly bare: 2 wall torches, 2 wood_ledges with two things each. The plan names banner08; none is built. No rug, nothing hung over the table or bed, nothing at the bed's side but a stool. Renders `home-west.png`, `home-east.png`. |
| J3 | Walkable | Pass | 10 / 10 | Door at (4, -3); 5 m clear in front of it. Every part of the room reached on lines of 2 m or more. |
| J4 | Nothing floating or squished | Pass | 8 / 8 | Stands sit on table and ledges; nothing off its wall at render scale. |
| J5 | No repetition | Partly | 4 / 8 | Two chests side by side 2 m apart on one wall (0.43, -4 and -6); the same pair pattern stands in the longhouse and the smithy. The fire assembly (fire_pit, wooden hood, raised lid) is the longhouse's too. |
| J6 | One material family | Pass | 8 / 8 | Plank table, wood chairs, stool, straw bed, stone oven. Reads as one rustic room. |
| J7 | Pieces where builders use them | Partly | 3 / 6 | Main fire is a fire_pit under a wooden hood, in a stage-3 home. Tyler on 06: "why use fire_pit for this area when we could use hearth". The two ledges hold things (D-166 met). |
| J8 | Stand items with meaning | Partly | 3 / 6 | Dining table: one mushroom and one Hasty mead. Ledge over the table: two yellow mushrooms. Ledge over the bed: Medium Health mead and Frost Resist mead. Reads as a forager's house in part; the potions are the same "meads as filler" seen in the longhouse. Fenring armor on the stand is dressed and fits the Mountain (good). |
| J9 | Sets as builders set them | Pass | 6 / 6 | Two chairs on the open side of the table, facing it; a chair by the fire faces the fire with a barrel beside it; stool at the bed's side. |
| J10 | Roof and walls complete | Pass | 10 / 10 | L roof with valleys and a box chimney; no gap seen at render scale (`home-ext.png`). Not checked piece by piece. |
| J11 | Outside program, greenery | Partly | 2.5 / 5 | The house sits on 2 m stilts in the Mountain with about 260 m2 of open deck around it: no railing, no seat, no plant, nothing. Stilts are a wetland form; nothing on this site calls for them. No greenery. |
| J12 | One program, plan equals build | Partly | 2.5 / 5 | Plan lists banner08 (not built); notes say "a kerb of beams round the fire pit" and "1 lights over the rooms' budgets left out". |
| | Total | | 71 / 100 | |

## Walking through it

Up a 2 m wide stair onto a large bare deck, across about 7 m of planks to the door. Inside, the room is tidy and you
can tell what each end is for: the cook's wall on the left, the fire with its pot straight ahead on the back wall, the
bed and a small table on the right. That is a real step up from the showcase homes.

What Tyler would notice:
- The walls. Long runs of plain plank with nothing on them: no banner, no hung tools or herbs, no shelf of pots by the
  oven. Two torches light 108 m2.
- The south leg of the L is a dead end with nothing in it but two chests against one wall.
- The Fenring armor stand stands in the kitchen, beside the butcher's table. Gear belongs by the bed or the door.
- A campfire with a wooden hood in a finished stage-3 house, after he asked for hearths in this kind of room.
- The deck: more than twice the house's floor, open to a 2 m drop, with nothing on it. In the mountains it raises the
  question why the house is on stilts at all.

## Rule changes (for every building, not this one)

1. **A room plan covers the whole floor.** `lib/rooms_intent.js` `furnishRoom` sets zones for a room's main uses and
   places them against the nearest walls, so the far leg of an L or the end of a long room gets nothing. Change: split
   a room into bays (each wing or leg of an L, each 4 to 6 m of a long room) and give each bay one zone from the
   household's program (store corner, work corner, sitting corner, sleeping alcove), or mark it a walking lane. Add a
   check in `lib/checks.js`: no bay of 12 m2 or more outside walking lanes with no furniture.
2. **Gear by its owner.** The gear zone (armor stand and its chest) goes by the bed or the door, never in the cooking
   zone. In `rooms_intent.js` give zones a set of zones they may stand beside (gear: sleeping, entry; cooking: eating,
   store) and refuse others.
3. **Walls get a layer.** The wall pass (`rooms_intent.js` wall layer, `lib/wallhang.js`) dressed two ledges and two
   torches in 108 m2. Change: each zone gets its wall kit over it (pots and herbs over the cook line, a banner on the
   focal wall, hung gear over the armor stand), from the household's themes, with whole walls left bare only by choice
   (wallhung criteria item 8).
4. **Hearth over campfire.** In a home, hall, longhouse or tavern at stage 2 or later the main fire is a hearth (or a
   built stone hearth), as the catalog criteria item 6 asks; a fire_pit only at stage 1 or in a camp. The audit now
   counts a fire_pit under a hood as a built hearth; it should not.
5. **Raised forms need a reason.** In `lib/styles.js` the swamp culture's raised form applies in any biome. Keep it for
   wetland, shore or steep sites; elsewhere build the culture's look on the ground. A raised deck wider than one bay
   past the walls is a porch: it gets a railing (not wood_fence, D-164) and a use (seat, drying rack, plants).
