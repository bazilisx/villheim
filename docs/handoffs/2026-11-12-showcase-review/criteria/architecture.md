# Council criteria: architecture (track H)

The checklist track H judges a generated s3d3 building by: does the building read as designed with intent, one
program applied whole with reasoned exceptions. Grounds: `docs/ARCHITECTURE_STUDY.md` (sources and corpus measures),
`tools/blueprint-lab/data/architecture/` (the numbers), D-165, D-167 and Tyler's words in `../TYLER_NOTES.md` ("windows
in a row would all have the same feature... This applies to all architectural decisions... Intent. Consistency.
Thematic ties."). D-136: where a source and the corpus disagree, the corpus band is the test.

## How to score

- Inputs: the building's blueprint, the generator's program record when it writes one (`lib/program.js`: `b.program`
  and the windows the details placed with their features), and the renders of `lab/render_views.js` (four outside
  views at azimuth 35, 215, 125 and 305 with the roof on, and the cut views).
- Measures from the blueprint, the same readers as the corpus numbers:
  1. `node lab/rooms_corpus_extract.js <building.jsonl> /tmp/arch-x` (a one-line compact file of the building),
  2. `node lab/arch_facades.js <building.jsonl> /tmp/arch-x /tmp/arch-x/f.json --perbuild /tmp/arch-x/pb.json`
     (runs, built-treatment uniform share, mixed runs, lone features without a room reason, planter share),
  3. `node lab/arch_grammar.js <building.jsonl> /tmp/arch-x/builds.jsonl /tmp/arch-x/g.json` (materials, roofs,
     symmetry, doors, corners, carved heads),
  4. `node lab/arch_rooms.js /tmp/arch-x /tmp/arch-x/r.json` (light, fabric and wood programs per room and household).
- The geometric reader counts a corner post beside an end window as that window's post (ARCHITECTURE_STUDY.md section
  6). Where the program record exists, the hard fails are read from it, and the blueprint reading is the cross-check
  in the renders.
- Each weighted item scores full, half or zero. Total 100. **Pass: 75 or more, no hard fail, and the Openings group at
  28 of its 40 or more.**
- Every critique names the rule to change (council rule: no hand edits): the program rule in `lib/program.js` or
  `data/architecture/rules.json`, or the call site in the shell or details.

## Hard fails (any one fails the building)

| # | Fail | Test | Ground |
|---|---|---|---|
| H1 | A lone feature with no reason: one window of a run of three or more carries a planter, a window box, shutters, a hood, a sill board or hung decor the others lack, and the room behind it gives no reason (kitchen: herbs, hood; hall: lamp, banner; storage: shut or barred; bedroom: shutters; a lamp by the door) | program record (`Program.check`: "lone feature without a reason"); blueprint `pb.json` `loneUnreasoned` with the fault list, checked in the outside renders | Tyler (D-167: "weird to have one feature on only one window and then none others... a single planter outside a kitchen window? Sure"); corpus lone features behind kitchens 1.64 and halls 2.2 times their share |
| H2 | Mismatched treatments within one window run: windows of one wall and one storey differ in a decorative feature (sill or box, planter, shutters open on some and closed or missing on others, hood) beyond one reasoned exception, or two windows of the run are exceptions | program record ("mixed treatments in one run", "more than one exception in a run"); blueprint `pb.json` faults of kind `mixed` whose signatures differ in sill, planter, shutter or hood | Tyler (D-167: "windows in a row would all have the same feature"); corpus runs share one built treatment 67 % against 29 % if dealt at random |
| H3 | Planters past the household rule: planters on more than one run of the building (the front ground run) plus one kitchen exception, or on a building whose household has no plant trait | program record (`prog.planters`, exceptions); blueprint plants within 1.4 m of a sill per run | D-165 ("not every single window should have planters... dependent on the culture, the people living there"); corpus 0.1 % of windows with planters, 1.7 % with vines; showcase 8.2 % |

## Weighted items

### Openings (40)

| # | Item | Weight | Test | Pass (full / half) | Ground |
|---|---|---|---|---|---|
| 1 | Runs carry one built treatment (frame features and light fill) | 12 | `pb.json` `archUniform` over runs of 2 or more | 0.9 or more / 0.67 or more | corpus p50 of builds 0.67, p75 1.0; Franck (consistent window types); Dickinson (one window style) |
| 2 | One piece per feature along a run (the same sill board, post, hood piece on each window) | 4 | blueprint: pieces of each feature per run | every full run / all but one | corpus 95 to 100 % of full runs (`corpus-facades.json` runs.onePieceInFullRun) |
| 3 | Front hierarchy: the main door's side at least as dressed as the others; the other sides carry the front family whole or its built frame only (posts, braces, arches, shutters, fill), never features the front lacks | 5 | blueprint: features per window by side; outside renders | holds / one side off | corpus front richer 37 % against poorer 28 %; Franck (side elevations less important); nalichniki (main windows richer, the same motif) |
| 4 | Storeys: an upper storey keeps the family below or its built frame; gable and loft windows are one run with one frame | 4 | blueprint by level | holds / one storey off | corpus aligned pairs with the same treatment 52 %; Alexander 221 (upper windows smaller) |
| 5 | Rhythm per wall: the window pattern of a wall chosen once (every other bay, every bay, paired), the same on each storey of that wall, no window added in one bay with no reason | 4 | blueprint: window bays per wall line and storey | holds on every wall / one wall off | Ching (rhythm); Franck (regular rhythm within each mass); generator's per-bay draw (`windowExtra`) is the fault named in ARCHITECTURE_STUDY.md section 3 |
| 6 | Formal fronts: on a building laid out formally, windows mirrored about the door and upper windows over lower ones | 3 | blueprint: mirror of the front's openings; upper windows within 0.35 m of a lower one | 80 % / 60 %; a free plan scores full | Franck (stack and balance); corpus aligned 30 % of upper windows over a lower run, so only formal buildings are asked for it (D-136) |
| 7 | Exceptions are few and reasoned: at most one per run, each with the room behind it, about one window in ten or fewer | 5 | program record exceptions with reasons; blueprint odd windows and the room kind behind | all reasoned and 11 % or less / one unreasoned built-frame difference | corpus 10.9 % of windows differ from their run, behind kitchens 1.45, storage 1.38, halls 1.24 times their share; Burgess (one quirk, with a reason) |
| 8 | Planters, where the household has them: the whole front ground run, one species to a box with a few turned and clustered, set under the window with the beam frame of Tyler's mock-up | 3 | blueprint; outside render | holds / one off; no planters scores full | D-165; Tyler (`frames/shot-c-sill-mockup.jpg`); ROOM_STUDY.md (clusters one species 73 %, yaws varied) |

### Building grammar (35)

| # | Item | Weight | Test | Pass (full / half) | Ground |
|---|---|---|---|---|---|
| 9 | One main door: the main door carries the richest dressing (frame and step plus one of hood, lamps, banners), the others the frame only | 5 | `g.json` doors score per door; renders | the main door 2 points or more over the next / the richest is the main door | corpus 37 % one clear main door, 26 % all alike; Alexander 110 Main Entrance |
| 10 | Material order: heavy walls under light ones, the change at a floor line or a plinth, level on every side | 6 | `g.json` materials (heavyUnder, changeAt, plinth on all sides) | holds / one side off | corpus heavy under light 78 % (over 15 %), change at a floor line 49 % or plinth 11 %, plinth all round 88 %; Whitsitt (base, middle, top); Franck (never cut across a base) |
| 11 | One roof material; a second slope only on a secondary roof (porch, lean-to, aisle) | 5 | `g.json` roofs | one material and the minor slope on secondary roofs / one material | corpus one material 88 %; Alexander 116 Cascade of Roofs |
| 12 | Corner trim in one mode: posts on every outside corner, on none, or on the entry side's corners; one post piece | 4 | blueprint: posts at outside corners | one mode and one piece / one mode | corpus all 28 %, none 23 %, some 48 %; one piece at every posted corner 56 % |
| 13 | Carved heads in mirrored pairs on the ridge ends, one kind | 3 | `g.json` ornament twinned | all paired / one single; no heads scores full | corpus 86 % twinned |
| 14 | Symmetry fits the kind: formal kinds (longhouse half, temple, castle) mirrored 0.8 or more with the door on the axis; free plans balanced on the door | 4 | `g.json` symmetry score, door on axis | holds / mirrored 0.6 or more | corpus formal 37 % (longhouse 51 %, tavern 30 %, farm 18 %), door on axis 79 %; Ching; Dan Cox (symmetry for rest and ceremony) |
| 15 | Thematic ties: one wood family across the trim (posts, beams, bargeboards, door and window frames); ornament at the seams (corners, frames, gables) in one theme | 6 | blueprint: trim pieces by family; renders | one family / two | Alexander 249 Ornament (one theme repeated at the boundaries); corpus one piece per feature 95 % |
| 16 | Wall bands on no side or on the entry side, never broken round the building at random | 2 | blueprint: foot beams by side | holds / one side off | corpus no side 71 %, some sides 29 %, all 0.4 % |

### Vernacular (10)

Scored against the village when a village set is judged together; for one building, against the culture's vernacular
(CULTURE_STYLES.md and `lib/program.js` PALETTE).

| # | Item | Weight | Test | Pass (full / half) | Ground |
|---|---|---|---|---|---|
| 17 | Shared vernacular: the culture's window features only; the village's roof material, its lead wall material and slope | 5 | blueprint against the palette and the village's other buildings | holds / one change | corpus village p50: lead wall material 0.80 of buildings, roof material 1.00, slope 0.88; Alexander (Timeless Way, the barn); Norwegian and Icelandic farms |
| 18 | Variation inside it: in a village, about one building in three varies one thing (a window family, a slope, a material) for its use | 3 | the village set | one in five to one in two / any variation | corpus all three shared p50 0.67; Norsk Folkemuseum (each farm building by its use) |
| 19 | Village planters 10 % of windows or fewer | 2 | the village set; one building: its share stays under its household rule (H3) | holds / up to 15 % | D-165 |

### Interior program (15)

| # | Item | Weight | Test | Pass (full / half) | Ground |
|---|---|---|---|---|---|
| 20 | One light kind per room in most rooms, the household's lead light in two rooms of three | 5 | `r.json` light: oneKind, roomTakesBuildLead | 0.6 and 0.66 or more / 0.45 and 0.5 | corpus 62 % one kind, 69 % take the lead (34 % at random); Alexander 252 Pools of Light |
| 21 | Fabrics: one banner and one drape kind per room, the household's lead in most rooms | 4 | `r.json` banner, drape | 0.7 or more / 0.5 | corpus banner 74 %, drape 75 % take the household lead |
| 22 | Woods: the household's lead furniture family in two rooms of three, two families at most in a room | 4 | `r.json` wood; blueprint | holds / one room off | corpus 66 % take the lead (45 % at random); ROOM_STUDY.md section 4; Tyler 04 ("aim to have the same wood color or material in a room") |
| 23 | A room that breaks the household program has its purpose as the reason (a forge light in the smithy, a rune table only in a study) | 2 | judge from cut views and the room kinds | all / one off | Tyler 06 (rune table in a wooden bedroom); Burgess, Naughty Dog (every piece has a reason) |

Weights: Openings 40, Building grammar 35, Vernacular 10, Interior program 15.

## Notes for the judge

- The blueprint reader is a cross-check, never the hard fail by itself: read the same way, 235 of 656 corpus builds
  with window runs (36 %) show at least one run that differs in a sill, planter, shutter or hood, part of it reader
  noise (a corner post or a beam of the frame next to an end window), and 5 of the 14 showcase designs with windows do.
  H1 and H2 rest on the program record and on what the outside renders show. D-167 is Tyler's rule for the generator;
  the corpus share is reported so the judge knows the reader's noise.
- Corpus tricks stay allowed (D-127). A builder's lone feature with a room reason is the corpus practice, and the
  program allows it; the fail is the lone feature with no reason.
- Items 5 and 6 rest more on sources than on the corpus (the corpus holds treatments along runs far more firmly than
  it holds equal gaps or windows over windows). They carry 7 points, and a free plan is not asked to align storeys.
- Items 20 to 23 overlap track C's items 8 to 12 (palette and light). Track C scores the room, this list scores the
  household across rooms.
