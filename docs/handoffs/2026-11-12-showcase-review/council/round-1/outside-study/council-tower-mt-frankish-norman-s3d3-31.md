VERDICT: FAIL

# Outside study: council-tower-mt-frankish-norman-s3d3-31 (round 1)

Score 41 of 100 (pass mark 75). Hard fails H1 and H3. Groups: Intent 18 of 37, Palette and light 14 of 20, Clutter 8
of 23, Story 1 of 20 (Intent, Clutter and Story under half). Deciding items: H1/H3 (way to the upper floors), 1, 2, 6,
11, 13, 15, 16, 19 to 22.

Checklist: `criteria/outside-study.md`. Measured from the blueprint; renders `floor-1.png`, `floor-2.png`,
`views.png` and my labeled plan `/tmp/council-outside/tw-plan0.png`. The builder's scorecard gives this seat 32 of 32
and no hard fail; corpus-rooms H1 and H3 also passed.

Three rooms, one per floor, 3 m floor to floor (floors at y 1, 4, 7): floor 0 "bedroom" 79 m2, floor 1 "watch room"
75 m2, floor 2 "lookout" 77 m2. Door at (0, -5) in the south wall; stepladders along the north wall.

## Hard fails

| # | Result | Measure |
|---|---|---|
| H1 passages | **FAIL** | The only way up is the stepladder at x -3 to 0, z 3.5 to 4.5 (foot at the west end). To reach its foot you pass between the NW dragon bed (x -4.59 to -1.15, z 0.35 to 2.65) and the ladder: 0.85 m. Before that the aisle between the beds is split by an iron chest standing in it: 0.90 m on one side, 0.44 m on the other. The way between floors is under half a floor piece wide. |
| H3 reach | **FAIL** | The generator's own walk map agrees: tracing `lib/layout.js` `openWays` on this seed returns `left: ["room -5,-5 to 5,5 at 4", "room -5,-5 to 5,5 at 7"]` (floors 1 and 2 out of reach). On the way it left out the watch room's oak table, two chairs and five stand items. Beds are never moved or left out, so the beds that close the way stayed. |
| H2, H4, H5 | pass | door aisle 3.7 m wide; no black marble; no outdoor pieces |

## Scores

| # | Item | Wt | Score | Measure |
|---|---|---|---|---|
| 1 | Core set | 7 | 0 | floor 0 has beds; floor 1 "watch room" has lost its table (the record still names it the focal); floor 2, 77 m2, is "a small room kept plain" with nothing in it |
| 2 | Focal from the door | 6 | 0 | floor 0: the first thing ahead is the chest in the aisle, then the ladder; four equal beds and no focal. Floor 1: an armor stand at the side |
| 3 | Command position | 4 | 4 | all four bed heads to walls, none within 20 degrees of the door axis (the two south beds stand 0.85 m either side of the door, which the test does not catch) |
| 4 | Zones | 6 | 6 | one zone per room |
| 5 | Seat kind per table | 6 | 6 | no tables |
| 6 | Walking lines | 6 | 0 | 0.44, 0.85 and 0.90 m pinches on the line from the door to the stair |
| 7 | Pull-back, bed sides | 2 | 2 | each bed has one open side |
| 8 | Woods | 5 | 5 | dragon beds, base wood stools; chest is storage |
| 9 | Stone, metal, glow | 4 | 4 | one stone (the keep) |
| 10 | Fabric colors | 2 | 2 | none placed (plan lists `rug_hare`, `rug_straw`, `piece_banner05`) |
| 11 | Light layers | 6 | 0 | no light inside any floor; the two wall torches hang outside the door |
| 12 | Light variety | 3 | 3 | two lights |
| 13 | Near its use | 6 | 0 | 3 of 6 by use (shield near a bed corner, root armor chest with a hammer beside it as a mending corner); two pickaxes on the dormitory wall with no mine or station, two fish on the watch room wall with no kitchen |
| 14 | On a parent | 3 | 3 | all hung on walls |
| 15 | Hot spots | 5 | 0 | no spot with three or more dressing pieces round a use |
| 16 | Layers | 3 | 0 | wall and medium only; no floor or ceiling layer on any floor |
| 17 | Density | 2 | 1 | floor 0: 0.89 per 10 m2 (dormitory p25 to p75 0.58 to 1.18); floor 1: 0.13 |
| 18 | Repeats | 4 | 4 | no breach |
| 19 | Mid-task scene | 6 | 0 | none |
| 20 | Who lives here | 6 | 0 | 2 of 4 beds with a bare stool beside them; one shared chest in the aisle; nothing over any bed (corpus: item stands behind the head of 206 dragon beds) |
| 21 | One story | 4 | 0 | pickaxes and fish belong to no trait of a guard household |
| 22 | Clue, unique piece | 3 | 0 | none |
| 23 | Imperfect placement | 1 | 1 | 1 of 2 seats turned (0.5) |

## What a person walking through would notice

- The ground floor is four large dragon beds, one in each quarter, filling the room. Two of them stand right beside
  the door. An iron chest sits alone in the middle of the floor between them.
- To go upstairs you squeeze past the chest and then sidle along a gap of under a meter between a bed and the
  ladder. A player would bump and stick here; most villagers would not path it.
- No light inside. The two torches you passed are outside the door.
- Two pickaxes hang above the ladder and a silver shield in one corner. Nothing on or over the beds says who sleeps
  where. Eight people would share one chest.
- Upstairs (if you get there) the watch room is an empty 75 m2 floor with one armor stand holding only a root
  chestpiece, a hammer on the wall beside it, and two fish on the far wall. The floor above is completely bare.
- The tower reads as a barracks with its living floors stripped out. Tyler's 014 note ("squished" ground floor,
  "random" upstairs) has turned into a crowded ground floor and empty upstairs.

## Rule changes (by principle, for every building)

1. **Reserve the way to every stair before beds go in, and never ship an unreachable floor.** In `furnishRoom`'s
   bedroom branch `beds()` runs before `H.planPaths(room)`, so the stair lane does not exist when beds are placed;
   `openWays` later never moves or drops beds, so it drops the next floor's table instead. Rule: `planPaths` runs
   first, with lanes 2 m wide from each door to each stair foot (Tyler: two `wood_floor` for passages; existing
   decorator rule: a stair foot clear for one floor piece), and `placeBeds` treats lanes as walls; the dormitory bed
   count is what fits beside the lanes (corpus dormitory beds p50 4, so fewer double beds or single beds when the
   room is small). `lib/generate.js` keeps `openWays`' `left` list and fails the building on any entry (same rule
   as the longhouse).
2. **Lights that can be placed in the room.** The tower's only light kind is `piece_brazierceiling01`. `lightsIn`
   places it only when `R() < o.hang * likes` and only where the headroom is over 3.9 m; these floors have 3 m, so it
   can never be placed, and `roomLights`' fallback looks only in `plan.lights`, which holds nothing else. Every floor
   is dark by construction. Rule: `planBuilding` gives every building a wall or standing light kind as well as any
   hanging kind; `roomLights` falls back to the culture's wall light when the room is too low; lights outside the door
   do not count toward a room's lights.
3. **Every room over about 25 m2 has a purpose.** `kindOf` and the `lookout` branch call a 77 m2 floor "a small room
   kept plain" and place one chest (also left out). Rule: no room over 25 m2 gets kind `other`; a tower's floors take
   the program's purposes in order (sleeping, watch room with table and gear, store or armory, lookout with a seat by
   the window, a brazier and a map table), and when a floor's core set cannot be placed the room is re-planned, not
   left empty.
4. **Each bed is someone's.** `bedsides` rolls the corpus share per bed (23 % stool) and places nothing for most
   beds; `wallBay` hangs item stands only over the first bed or chest it finds. Rule: in a dormitory each bed gets one
   owner piece from the corpus bed neighbors (`data/intent.json` beds: rug at the foot 47 to 49 % of dragon beds,
   seat 25 %, light 20 %, chest at the foot 18 %, item stand behind the head), chosen per bed so the beds differ, and
   a chest per one or two sleepers against a wall, never in the aisle.
5. **Wall items belong to the room's use.** The stand pass hangs pickaxes in a dormitory and fish in a watch room.
   Rule: `lib/persona.js` `standItem` draws only kinds tied to a zone within 2 m (tools by a station, fish and food by
   cooking or a table, weapons and shields by a bed, the armor stand or the door), and the watch room draws from its
   own kit (weapons, a horn, a map, a lantern).
6. **The intent record is the room as built.** `intent.json` lists the watch room's table and focal after `openWays`
   left them out; the builder's scorecard reads that record. Rule as in the longhouse critique: rebuild the record
   from what stands after `openWays` and `capBuilding`.
