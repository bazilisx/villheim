VERDICT: PASS

Seat: corpus rooms (track B). Candidate: smithy md steppe s3d3 seed 614 (153 pieces).
Passes at 108.5 of 115 (94 %; criteria file as written 97.5 of 100), no hard fail. Faults to fix by rule: the forge's
extensions strung out along a 7 m line past the corpus distances, and no light in the room.

## How it was scored

Same method as the tower file (`council-tower-mt-frankish-norman-s3d3-31.md`, "How it was scored"): my own audit run,
raw records, the views and plan, one generator trace; item 1 over every room of 20 m2 or more, added items 20 (8) and
21 (7), out of 115 with the pass at 92.

## The room as the reader finds it

An open shed: 43 wood_pole2, beams and a roof, no wall pieces; a lean-to woodpile behind. The generator's room is
72 m2; the reader takes 104 m2 with the floor's edge. 9 floor pieces, 0.87 per 10 m2 (smithy p25 0.65, p50 1.11);
4 floor types (corpus p50 4). Share of floor more than 4 m from any piece: 0.07.

- Forge row along the back line (z about 2.3), all facing the same way: forge_ext3 at x -2, forge_ext4 at -0.5,
  forge_ext1 at 0.88, forge at 3, forge_ext5 at 5. Distances from the forge: ext5 2.0 m (corpus p90 3.33), ext1 2.12 m
  (corpus p90 1.88), ext4 3.5 m (p90 3.54), ext3 5.0 m (p90 3.48, and beyond the study's 4 m window). The most common
  forge extension, the tool rack forge_ext6 (68 % of corpus forges, 64 % of them behind it), is not there: `placeStation` skips a
  wall-hung extension on an open edge.
- Workbench on the west side with its chopping block (piece_workbench_ext1) beside it, 2.07 m off.
- Two iron-banded chests side by side on the east side.
- No lights (the plan's only kind is the wall sconce and the shed has no walls), no rugs, no stands, no seat.

## Scores

| # | Item | Weight | Score | Measured |
|---|---|---|---|---|
| H1 to H5 | Hard fails | hard | ok | open sides; no extension within 1.5 m in front of its station |
| H6 (proposed) | Planned focal set left out | hard | ok | forge and workbench stand |
| 1 | Purpose and focal | 8 | 8 | smithy, focal forge |
| 2 to 5 | Table sets | 22 | 22 | no table |
| 6 | One tone per room | 4 | 4 | |
| 7 | No avoided family pairs | 5 | 5 | forge set, workshop set, iron props |
| 8 | Counts per kind | 8 | 8 | 2 chests (smithy p50 when present 4) |
| 9 | Few light kinds | 6 | 6 | none indoors (see 21) |
| 10 | Repetition caps | 8 | 8 | |
| 11 | Stacked chests | 4 | 4 | |
| 12 | Beds | 5 | 5 | none |
| 13 | Work corners | 5 | 2.5 | backs 9 m from any wall face (an open shed: the row stands on the back line, which I accept by eye); two of four extensions past the corpus p90 distance (the audit's "beside 1.00" does not test distance) |
| 14 | Walking lines | 6 | 6 | way to the forge 5.25 m |
| 15 | Clear zone inside doors | 4 | 4 | |
| 16 | Wall decor offsets | 6 | 6 | none hung |
| 17 to 19 | Planters, clusters, gardens | 9 | 9 | |
| 20 | Furnished for its size (added) | 8 | 8 | 0.87 per 10 m2, over smithy p25 |
| 21 | Lights and rugs (added) | 7 | 3 | no light (lights in 70 % of corpus smithies, p50 when present 4); rugs are in 46 % of smithies, under the 60 % line, so no rug is no fault |

Criteria file as written: 97.5 of 100 (matches the builder). With the brief's tests: 108.5 of 115.

## Walking through it

- You walk in from any side of an open post shed. The floor is clear and easy to cross.
- Along the back runs one straight line of five pieces: the grinding wheel, the smith's anvil, the bellows, the forge
  and the cooler, set 1.4 to 2.1 m apart, the grinding wheel 5 m from the forge and nearer the workbench than the forge. It reads as a display
  row more than a work corner where a smith turns from the fire to the anvil.
- The workbench and chopping block stand at the west end, the two chests at the east end. The middle third of the
  shed is open floor, which suits a smithy (corpus smithies are large and sparse, 1.11 pieces per 10 m2).
- No torch, no tools on stands, no rack of iron or stock beside the chests. At dusk only the forge lights it.
- Against Tyler's note on showcase 13 (an extension in front of the forge, a second anvil in the middle of the floor):
  that is gone; nothing stands in front of a station and no extension repeats.

## Misses, the principle each breaks, and the rule to change

1. Principle: a station's extensions cluster at the station, at the corpus distances (median 0.6 m for forge_ext6,
   1.6 to 2.4 m for the others, p90 under 3.6 m). Rule: `lib/decorate.js placeStation` puts each extension at "the next
   free stretch of the same wall", alternating sides, and each one pushes the next further out (`extOff` grows by the
   gap and width); `lib/rooms_intent.js workExts` asks for every extension that passes its share draw at d3. Change:
   give each extension a spot no further from the station than its corpus p75 distance (`sets.json` work near
   distance), try behind and the side of the station as the corpus does, and leave an extension out when no spot is
   within that distance. At d3 ask for two or three extensions, not all of them, by their shares.
2. Principle: a wall-hung extension needs a wall, and an open station gets its corpus partner some other way. Rule:
   `placeStation` drops forge_ext6 on an open edge (`HUNG_EXT`). Change: on an open edge, put the hung extension on
   the nearest post or beam behind the station where the shell has one, else take the next extension by share.
3. Principle: a room's lights follow its kind's count in the building's light kinds, and an open room is lit too.
   Rule: `planBuilding` drew only the wall sconce; `roomLights` in `furnishRoom` has nothing to fall back on when the
   room has no wall. Change as in the tower file: when the lead kind cannot stand in the room, use the next corpus kind
   that can (a standing torch or iron brazier on the floor, a hanging brazier from the roof beams) and count it as
   the room's own kind.
4. Principle (furnishing for purpose): a smithy at s3d3 holds what the work needs. The corpus smithy has chests in
   51 % of rooms (p50 when present 4), item stands in 33 % (p50 8), rugs in 46 %. Rule: `furnishRoom` smithy branch
   places two chests and `supportZones` and `wallBay`, which placed nothing here. Change: for an open shed, let the
   support zones use posts and the lean-to (tools on stands on posts, a stock pile by the chests), so `wallBay` is not
   limited to wall faces.
