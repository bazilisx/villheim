# Council criteria: outside study (track C)

The checklist track C judges a generated s3d3 building by: does each room read as lived in and intentional. Grounds:
`docs/INTERIOR_DESIGN.md` section "Room intent: outside study (2026-11-12)", the notes in `../outside/`, Tyler's
showcase notes (`../TYLER_NOTES.md`) and the corpus measures named per item. Tyler (2026-11-12, through the lead):
intentional clutter and environmental storytelling are "among our most important interior design drivers"; the Clutter and
Story groups carry 43 of the 100 points below.

## How to score

- Inputs: the building's blueprint (pieces with positions and turns), the decorator's room list (rooms, doors, kinds,
  from `lib/decorate.js`'s reader), and the renders of `lab/render_views.js` (four cut views at azimuth 35, 215, 125
  and 305, roof cut 2.6 m over the lowest floor, and the ground floor plan). Upper floors are judged from a cut view
  at each floor's height (`render_views.js` with the cut raised) or from the blueprint.
- Room items are scored per furnished room and averaged over the rooms, weighted by floor area. Storage rooms skip
  items marked "living rooms".
- Each item scores full, half or zero weight by its test. Total 100.
- **Pass:** 75 or more, no hard fail, and each of the four groups (Intent, Palette and light, Clutter, Story) at half
  its weight or more.
- Every critique names the rule in the generator to change (council rule: no hand edits).

## Hard fails (any one fails the building)

| # | Fail | Test | Ground |
|---|---|---|---|
| H1 | A passage between rooms under two `wood_floor` pieces (4 m) wide, other than a closet or hidden passage | blueprint: clear width of every corridor, wing and gallery used as a way between rooms | Tyler, showcase notes ("must be at minimum two wood_floor pieces wide") |
| H2 | Anything but a rug in a door's box on either side, or a beam, stair or furniture across a doorway | blueprint: decorator door boxes (corpus depth by room kind, p10 hall 4.0 m to home 1.6 m) | D-148, D-152; Tyler 011 (beam in the door), 09 (fire pit inside the door), 012 (cookstation before the door) |
| H3 | A room or a zone a person cannot walk to: furniture closes the line from the door to the focal point, to a bed side, to a chest front or to a station's work place | blueprint: walking-line check from each door on a 0.5 m grid with the character's width | D-148; Tyler 012 (upstairs blocked), 06 (behind the bar blocked) |
| H4 | A black marble seat at a table of another material | blueprint: seats within 2.2 m of a table | corpus 5 of 1,847 tables (0.3 %); Tyler 04, 05, 07, 011 |
| H5 | Outdoor-only pieces indoors: `wood_fence` inside walls or on a tower top, `darkwood_raven` and the other darkwood animals indoors | blueprint: piece inside the room footprint | Tyler 01, 02, 03, 014 |

## Weighted items

### Intent (37)

| # | Item | Weight | Test | Pass (full / half) | Ground |
|---|---|---|---|---|---|
| 1 | Purpose reads at once: the room holds its kind's core set | 7 | blueprint: core set per kind ("Room kinds" in INTERIOR_DESIGN.md: hearth and table in a home main room, bed in a bedroom, fire and counter in a tavern, station in a workshop) | every room / all but one | 80.lv strong first read; Carson familiar reference points |
| 2 | One focal point per room, seen from the main door at the far end or far wall, and the best dressed spot | 6 | cut views: from the main door side, the first piece the eye meets; blueprint: focal piece in the far half of the room from the main door | 80 % of rooms / 50 % | WoW tour (every room); Carson (best detail at the destination) |
| 3 | Command position: bed heads to a solid wall, not under a window, not in line with the door; the chief seat (high seat, throne, desk chair, head of table) with a wall behind it, facing the door | 4 | blueprint: bed local -z to a wall within 2 m, no door within 20 degrees of the bed's axis; chief seat's back within 2 m of a wall | 90 % of beds and chief seats / 70 % | feng shui (Cliff Tan, NPR); Hurstwic high seat; corpus bed head 1.75 m from a wall |
| 4 | Zones: one to four per room (one or two under 25 m2), each a set placed together; no two eating tables side by side in a home | 6 | blueprint: furniture clusters (pieces within 2.5 m chains) per room; tables per room | all rooms / one room off | Tyler 05 ("why would this family need one table ... and 5 feet away ... another"); WoW plan |
| 5 | One seat kind per table | 6 | blueprint: seat kinds within 2.2 m of each table | 90 % of tables / 75 % | corpus 91 % (1,816 of 1,987 tables) |
| 6 | Walking lines bare: door to door, door to stair, door to focal point and to each zone; in-room lines at least 2 m wide | 6 | blueprint: lines on a 0.5 m grid, nothing but rugs on them | all lines / one pinch under 2 m | Tyler (passages), D-148; WoW (aisles bare); Houzz clearances scaled |
| 7 | Seat pull-back and bed-side space off the lines: about 1 m behind seats at a table, one side of each bed open | 2 | blueprint | all / one off | Houzz (0.9 m behind a diner, 0.5 m bed sides); corpus bench gap 1.0 m |

### Palette and light (20)

| # | Item | Weight | Test | Pass (full / half) | Ground |
|---|---|---|---|---|---|
| 8 | Woods: one furniture wood family per zone, two at most per room, three wood tones at most in one cut view | 5 | blueprint: families by mesh texture (INTERIOR_DESIGN.md "Palette"); catalog colors when track A lands | all rooms / one room off | Tyler 04 ("aim to have the same wood color or material in a room"); Apartment Therapy rule of threes; corpus pairings |
| 9 | Stone, metal and glow: one stone besides the hearth, never stone with grausten; cold glow (blue, green, purple) at most once per room and only where the purpose calls for it | 4 | blueprint | all rooms / one off | Tyler 015, 016 (stone and grausten), 06 (rune table in a bedroom); Jordan Samson (two to three metals) |
| 10 | Two fabric colors per room besides hides, the household color repeated across rooms | 2 | blueprint: banner, rug and drape kinds by color | all / most | WoW (two fabric colors per room) |
| 11 | Light layers: a general light, a task light at each table, desk, counter and bed head zone, an accent at the focal point; no used zone more than about 4 m from a light | 6 | blueprint: light positions against zones | 90 % of zones lit / 70 % | Redfin layered light; WoW (a light every few steps); corpus 0.2 to 0.6 lights per 10 m2 |
| 12 | Light variety: the building's lead light kind is 50 to 91 % of its lights, and the lead kind is not the same kind in every building of a village | 3 | blueprint: light kind counts | in band / within 10 points of it | corpus p25 to p75 of 947 builds; Tyler ("the exact same type of torches in every build") |

### Clutter (23)

| # | Item | Weight | Test | Pass (full / half) | Ground |
|---|---|---|---|---|---|
| 13 | Near where it is used: food at cooking or tables, drink at bar, kegs or fire seats, tools at their station, gear by the armor stand, bed or door | 6 | blueprint: each stand item and small decor within 2 m of a piece of its use | 80 % / 60 % | 80.lv ("placed according to usage logic"); WoW; Tyler 013 (anvils in the middle of the floor) |
| 14 | On a parent: small things on a surface or hung over their piece; loose floor things only at a wall or a seat | 3 | blueprint: floor stands within 0.5 m of a wall or seat | 90 % / 75 % | corpus 1,893 of 2,078 floor stands within 0.5 m of a wall; WoW parenting |
| 15 | Hot spots: two to four dressed spots per room (one or two in small rooms), plain floor and wall between them, density falling off from the busiest end | 5 | cut views: dressed spots counted; blueprint: small items clustered | 80 % of rooms / 60 % | WoW; 80.lv (vary how crowded each area is, rest areas) |
| 16 | Layers: each used living room has wall, floor and either medium or ceiling dressing | 3 | blueprint: layer of each decor piece | 90 % / 70 % | WoW (ceiling layer in every used room) |
| 17 | Density inside the corpus band for the room kind (p25 to p75 pieces per 10 m2) | 2 | `lab/interior_density.js` measure | all rooms / most | corpus ("How full rooms are") |
| 18 | Repeats capped: no small decor kind repeated outside a set within a room; log benches at most three in a building; stacked chests only in storage rooms and store walls; no extension twice at one station | 4 | blueprint: kind counts per room and building | all / one breach | Tyler (same torches, candles, drapes, log benches, stacked chests); corpus log benches in 7 % of builds, median 2, p75 3 |

### Story (20)

| # | Item | Weight | Test | Pass (full / half) | Ground |
|---|---|---|---|---|---|
| 19 | Mid-task scene: each home has one or two vignettes caught mid-use, taverns and halls two to four, each with its cause within reach (plates by the cooking, tools by the station) | 6 | blueprint and cut views: vignettes from INTERIOR_DESIGN.md "Vignettes" | count met / one short | WoW (open book, plans with ruler, steam, cups); Smith and Worch; Carson |
| 20 | Who lives here: each bed carries its sleeper's things (gear, a chest, a light), a couple's bed differs side to side, the head's seat by the fire has its own touch | 6 | blueprint: pieces within 2 m of each bed and the chief seat | 80 % of beds / 60 % | Breezehome housecarl room; Ubbe's butchery; Hurstwic high seat; D-077 |
| 21 | One story: every prop fits the household's traits (never a profession) and culture; no prop that belongs to no trait | 4 | judge from cut views and the build's household record | none off-story / one | 80.lv (one story, or a museum); drivers (household traits, never professions) |
| 22 | A clear clue at the focal point and one unique piece per room that breaks the pattern | 3 | cut views | 80 % of rooms / 50 % | 80.lv narrative (clue at the fireplace); Carson (one unique pillar); WoW odd personal piece |
| 23 | Imperfect placement: loose seats and small things turned off the grid, sets square | 1 | blueprint: share of seats turned more than 10 degrees | 25 to 60 % / 15 to 70 % | corpus 42 % of seats (`relx`); 80.lv (usage logic, never grid) |

Weights: Intent 37, Palette and light 20, Clutter 23, Story 20.

## Notes for the judge

- A rule from outside sources that the corpus contradicts loses to the corpus (D-136). Items 3, 4, 7, 10, 15, 16 and
  19 rest partly on outside sources and carry "[confirm]" marks in INTERIOR_DESIGN.md; when track B measures them, the
  pass bands here change to the corpus numbers.
- Corpus tricks stay allowed (D-127): clips, items on stands in heaps, chests stacked in a store wall. Item 18 limits
  where stacked chests go, never whether they are used.
