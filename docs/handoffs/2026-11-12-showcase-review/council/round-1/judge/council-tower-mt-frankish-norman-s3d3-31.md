VERDICT: FAIL

Tower, Mountain, frankish-norman, s3d3, seed 31. A square stone keep, about 8.5 m inside, with a ground floor at
1 m, floors at 4 m and 7 m and a flat roof with merlons at 10 m. The worst of the four: two of its three rooms are
empty, the third is four large beds, and the stone faces are patched with wood.

## Scores (judge checklist, see README.md)

| # | Item | Score | Points | Evidence |
|---|---|---|---|---|
| J1 | Rooms have intent | Fail | 0 / 14 | Ground floor: four dragon beds (piece_bed02, 2.3 m by 3.4 m each, the most luxurious bed in the game) for guards, a chest in the middle of the floor, two stools, two pickaxes and a silver shield on the walls. Floor at 4 m: the record calls it a watch room with a table; no table is built, only an armor stand, a hammer on a stand and two fish on stands. Floor at 7 m: 77 m2 called "a small room kept plain", with nothing in it. |
| J2 | Lived in, nothing bare | Fail | 0 / 14 | Ground 7 items in 79 m2 (0.89 per 10 m2), floor at 4 m 0.53, floor at 7 m 0.13; sleeping p25 1.09, other p25 0.82. No light inside on any floor: the only two torches hang outside the door (the plan's hanging brazier is not built). Renders `tw-g.png`, `tw-1.png`, and the candidate's `floor-2.png` and `floor-3.png`. |
| J3 | Walkable | Partly | 5 / 10 | From the door, the way to the stairs runs between the two middle beds (2.3 m apart) past the chest at (0.23, 0.5), leaving about 1 m on one side. The only way between floors is a 1 m wide stepladder, three times over. Tyler's rule: one floor piece wide is for "a small closet or hidden passageway". |
| J4 | Nothing floating or squished | Partly | 4 / 8 | The two fish stands on the west wall hang 0.65 m apart at different heights (5.70 and 5.85). Two woodiron_beams stick out of the front at the first-floor line, one past the left corner (-5.02) and one right of the door (1.98), with no partner. |
| J5 | No repetition | Partly | 4 / 8 | Four identical beds in one room; two pickaxes side by side on one wall (Tyler: "3 of the yellow dripping axes next to each other"). |
| J6 | One material family | Fail | 0 / 8 | The Norman stone keep has plank wall panels let into its front above the door on both upper floors and at the back corner, and plank wall pieces at the top corners beside the stone merlons (`tw-ext.png`). Tyler on 15 and 16: "odd mixture of grausten, stone, wood". Inside, dark dragon beds stand with light plank stools. |
| J7 | Pieces where builders use them | Partly | 3 / 6 | No wood_fence on the roof (D-164 met). Pickaxes are mining tools; in a guard room they have no reason. |
| J8 | Stand items with meaning | Fail | 0 / 6 | Two pickaxes and a shield in a bedroom; a hammer and two fish in a watch room; an armor stand wearing only a root chest piece (Swamp armor in a Mountain keep, no helmet, legs or cape). |
| J9 | Sets as builders set them | Partly | 3 / 6 | Beds have their heads to the walls (good), but four master beds in a barracks, and the room's one chest stands in the middle of the floor at the beds' feet. |
| J10 | Roof and walls complete | Partly | 5 / 10 | Merlons and the flat roof read well. The front and back faces are broken by the wood patches and a notch at the back corner where stone pieces stop (`tw-ext.png`, az 200). |
| J11 | Outside program, greenery | Partly | 2.5 / 5 | Windows sit only in the wood patches, so the window program follows the patching, not the floors. No greenery. |
| J12 | One program, plan equals build | Fail | 0 / 5 | Watch-room table missing ("Ways in kept open: ... 8 left out"); lead light missing; the top enclosed floor is called a lookout while the real lookout is the roof above it. |
| | Total | | 26.5 / 100 | |

## Walking through it

Up the ramp, through the door between two lamps. Inside it is dark. Four huge carved beds fill the room, two either
side of the door and two in the middle, with a chest on the floor between their feet. You squeeze past the chest to a
narrow ladder in the corner. Upstairs, a bare stone room with a single armor stand wearing one piece of root armor, a
hammer on the wall and two fish on the other wall. Up another ladder, a second bare room of the same size, with nothing
at all. Up a third ladder to the roof. From outside, the stone front is patched with planks above the door and a beam
pokes out of the wall near the corner.

Tyler said of the showcase tower (14): "upstairs rooms feel random. Same old thing over and over". This one has
traded the random clutter for nothing, and kept the squeeze on the ground floor.

## Rule changes (for every building, not this one)

1. **Every storey gets a role from the building's program.** `lib/decorate.js` `roleFor` gives a guard tower's upper
   storeys "guard" and its top enclosed storey "lookout"; `lib/rooms_intent.js` furnishes a lookout with at most one
   storage row. With a roof terrace above, that storey is an ordinary room and should get a role: for a tower the
   program is entry and store below, watch room (table, map, weapons rack), barracks (simple beds, a chest each), and
   the lookout only on the open roof. No two storeys with an empty program.
2. **Never drop the focal piece** (same rule as the longhouse): `lib/layout.js` `openWays` left out 8 pieces here,
   among them the watch room's table; the room must be re-planned instead.
3. **Bed kind by who sleeps there, count by floor.** The suite picks one bed for the whole building (`piece_bed02`
   here). A barracks or guest room takes simple beds or bunks; a master bedroom takes the large bed. Beds per room are
   capped so the walking line from the door to every other door or stair stays 1.5 m (corpus-rooms item 14), and
   storage goes at a wall, never mid-floor.
4. **Stairs in towers.** A tower whose storeys are rooms people live in gets a stair at least one 2 m piece wide along
   a wall, or a ladder only to a hatch on the roof (Tyler's two-floor-pieces rule; ladders are the closet case).
5. **One wall material per storey on a stone building.** The trim pass ("Trim after community builds") puts plank
   wall panels and single beams into a stone keep's faces. Change: on a stone building, wood appears as whole bands or
   framed openings in mirrored pairs, never as patches in one bay (architecture criteria items 10, 15, 16; catalog item
   9).
6. **Stand items follow the room.** `lib/standitems.js`: in a guard or watch room, weapons, shields and helmets of the
   village's tier; tools only in work rooms; fish only in kitchens and pantries or as a matched trophy pair. Armor
   stands wear a corpus outfit (assemblies criteria item 6), never one stray chest piece.
