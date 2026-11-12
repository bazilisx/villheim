# Architecture study: intent, consistency and reasoned exceptions

Track H of the showcase review (2026-11-12). Tyler asked whether any helper had read the literature on architectural
design, interior design and game interior design (`docs/handoffs/2026-11-12-showcase-review/TYLER_NOTES.md`, last
section). Interior design and game interiors had been read from web articles and a few game sources
(`docs/INTERIOR_DESIGN.md`, "Room intent: outside study"; `docs/handoffs/2026-11-12-showcase-review/outside/`).
Architecture had not been read. This study covers architecture and the design grammar of a whole building and a
village, adds interior and game sources the earlier studies did not use, measures each rule in the corpus, and turns
the rules into a building program the generator can follow (`tools/blueprint-lab/lib/program.js`).

Binding: D-167 (one program per facade, storey and run; an exception needs a reason tied to the room behind it),
D-165 (planters are a household and culture trait, about 10 % of a village's windows at most), D-136 (corpus numbers
win over outside sources and over Tyler's examples), D-127 (what corpus builders do is allowed). Tyler (2026-11-12):
his examples are symptoms; each one is reported here as one case of a principle, with the other places the generator
breaks it.

## Contents

1. Sources and what they say, by principle
2. Corpus measures
3. Where the generator breaks each principle
4. The building program (`lib/program.js`) and its rules data
5. The room program for interiors
6. Limits of the measures
7. Source list

## 1. Sources and what they say, by principle

Books by Ching (Architecture: Form, Space, and Order; Building Construction Illustrated; Interior Design Illustrated)
and Totten (An Architectural Approach to Level Design) are not readable online in full. Ching was read through a
university lecture handout on his ordering principles; Totten through two of his own articles. An archive.org copy of
a Ching chapter came up in search and was left alone (it is a pirated copy). Alexander's patterns were read on
patternlanguage.com (sample pages on the authors' own site) and urbigenous.net (pattern summaries). Quotes are short;
everything else is paraphrase.

### Repetition and rhythm: one treatment for the elements of one kind

- Ching's ordering principles (Tishk International University lecture 6, after Architecture: Form, Space, and
  Order): rhythm is a patterned reappearance of elements at regular or irregular intervals, where the shape may change
  yet stays recognizable; repetition keeps the shape the same. A datum (a line or plane) gathers and organizes the
  elements around it.
- Christine Franck (architect, ICAA program director, "Avoiding fenestration fiascos"): keep window sizes and shapes
  consistent through a building and save special shapes for special places; match the window type to the building's
  style; keep related shapes compatible (no pointed arches with round ones); a regular rhythm within each mass; side
  elevations follow the bay structure with small inconsistencies allowed, since they matter less than the front.
- Duo Dickinson (architect, Journal of Light Construction, "Window placement inside and out"): one window style across
  the house makes changes in size and place less jarring; a strong horizontal line (a trim band, the eave) ties
  scattered windows together; shutters, flower boxes and small roofs over windows add depth and mark focal points such
  as the front door or the gable peak.
- Brendan Whitsitt (trained as an architect, "Three rules for great facade design"): start from an ordered design and
  deviate where it makes sense; inconsistent alignment and mixed tones with no steady pattern make a facade feel
  unsettled; patterns that repeat read as a composition.
- Alexander, A Pattern Language, 249 Ornament: put ornament at edges and seams (door frames, windows, corners, where
  materials meet); pick one simple theme and repeat its elements across the boundaries so it "knit[s] the two sides
  together".
- Alexander, The Timeless Way of Building (notes at lib.fo.am): patterns recur through a place and each instance
  differs because its context differs: "the sameness of the patterns, interacting with the difference of the
  contexts, makes the windows different."
- Interior principles (Ohio University course handout, the same set Ching's Interior Design Illustrated teaches):
  unity comes from repetition, variety from subtle or surprising differences; too much unity is monotonous, too much
  variety chaotic; design is "sameness tempered with difference". Rhythm by repetition, progression, transition and
  contrast.
- Dan Cox (Ubisoft, GDC 2014, write-up by 3DVF): repeating a motif, shape or material unifies a space and ties areas
  together.
- Slavic carved window frames (nalichniki): one ornament family on every window of the house, the main windows a
  little richer, the side windows simpler, all variations on one theme and one frame width (Stavros decor guide, a
  maker's advice); styles differ by region (Calvert Journal).

### Hierarchy: the front and the main door lead

- Ching (lecture handout): hierarchy ranks forms by importance through exceptional size, a unique shape or a
  strategic place.
- Alexander 110 Main Entrance: placing the main entrance is "perhaps the single most important step"; it is seen at
  once from the approach and has a bold form. 242 Front Door Bench: a bench by the front door to watch the street.
- Alexander 116 Cascade of Roofs: the largest, highest roof over the most important space, smaller roofs falling from
  it. 117 Sheltering Roof: the roof visible, its eaves low at entrances.
- Whitsitt rule 1: base, middle and top, each legible.
- Franck and Dickinson: the street front symmetric and centered; side and back walls follow the rooms inside.
- Syrian courtyard houses (Muslim Heritage): plain street walls with small undecorated windows; the ornament on the
  courtyard faces, the iwan and the reception hall. The hierarchy turns inward.
- Nalichniki guide: the main facade carries the richer frames, the ends and sides calmer.

### Reasoned exceptions: the room behind decides

- Alexander 221 Natural Doors and Windows: "On no account use standard doors or windows"; size and place each
  opening for its room and view; windows grow smaller going up (upper rooms are smaller and more private and see more
  sky).
- Alexander 159 Light on Two Sides of Every Room and 180 Window Place: windows serve the room behind them; one window
  in a lived-in room becomes a place to sit.
- Franck: the guidelines are broken on purpose by Lutyens, Wright and the Arts and Crafts houses, with careful study.
- Joel Burgess (Bethesda, GDC 2013 "Skyrim's Modular Approach to Level Design", Game Developer write-up; 80.lv
  interview): kits work when their core rules hold; breaking them should be deliberate and have a reason; limit
  rule-bending to one quirk per kit; a few unique assets in a space give it identity.
- Don Carson (theme parks to games, earlier study): one unique pillar in a repeating row draws the eye; the exception
  works because the row is regular.

### Symmetry and balance

- Ching: bilateral and radial symmetry about an axis.
- Franck: symmetric buildings stack windows and spread them in three, five or seven bays balanced about the center;
  windows no nearer a corner than their width; window heads aligned on each floor.
- Dan Cox: symmetry reads calm and imposing, fit for rest and ceremony; asymmetry invites movement.
- Dickinson: an asymmetric front balances on the door as a pivot.

### Material order and the base

- Whitsitt: base, middle, top. Franck: windows do not cut across string courses, water tables or bases.
- Corpus and vernacular agree on heavy below light (section 2). Norwegian storehouses stood on stones or a low
  foundation, later raised on wooden posts (Norsk Folkemuseum, Numedal farm).

### Village scale: one vernacular, variation inside it

- Alexander (Timeless Way, lib.fo.am notes): a farmer builds a barn from a shared set of patterns, and many barns made
  from one language are each different and all recognizably barns; a town shares a language, so its structure comes
  from many small acts, varied and harmonious.
- Norwegian farm (Norsk Folkemuseum, Numedal): every building of the farm is log-built with galleries or overhangs;
  each differs by its use (the dwelling with its fireplace, the bakehouse with its oven, the storehouse raised on
  posts, the stable with its hay loft).
- Icelandic gabled farms, burstabaer (UNESCO tentative list): from about 1800 the farm became a row of small houses,
  each with its own roof, their gable fronts turned to the yard, the entrance in the middle of the row; turf walls and
  roofs shared by all, timber fronts on many.
- Iron Age roundhouses at Danebury (Digital Digging): one house type, circular, one door, 6 to 9 m across, about 70
  excavated, in two wall types. Butser Ancient Farm keeps one wall treatment on each house.
- Naughty Dog (80.lv, The Last of Us Part II, Reuben Shah, Anthony Vaccaro): shared assets give a location a
  consistent, lived-in quality; every piece of decoration has a reason and fits the people who live there.

### Interiors and game spaces (beyond the earlier studies)

- Alexander 252 Pools of Light: low lights spaced apart over each table and seat group, darker places between.
  179 Alcoves: small nooks at the edges of common rooms, about 1.8 m wide and 0.9 to 1.8 m deep. 127 Intimacy
  Gradient: spaces in order from the public entrance to the most private rooms. 251 Different Chairs asks for mixed
  chairs; the corpus seats one kind at a table in 91 % of tables (ROOM_STUDY.md), so the corpus rule stands (D-136).
- Dan Cox (GDC 2014): form and function balanced; light and contrast mark focal points; emphasis by color or accent;
  60-30-10 color as a rough guide; work with the architecture (molding lowers the eye line in a tall room).
- Totten ("Towards a Digital Architecture", "Designing Better Levels Through Human Survival Instincts", Game
  Developer): form follows the use of the space; prospect and refuge in sequence; low ceilings and shadow read as
  refuge; covered entries and columns mark a space apart.
- Burgess: players notice repeated clutter sooner than repeated architecture; the kit is the architectural identity
  of the space, and the clutter and a few unique pieces give each space its own identity.
- Anthony Vaccaro (Naughty Dog, 80.lv): cluster detail and leave open areas for the eye to rest; vary the size and
  spacing of clusters so they do not read as a mechanical pattern; group colors into zones.

## 2. Corpus measures

Corpus: the 2,128 builds of `compact.json`, vanilla pieces only, turned square to their walls. Windows are read on the
outer walls of rooms (lab/rooms_corpus_extract.js room reader, plus lights filled with iron bars, which that reader
counts as wall). Scripts: `lab/arch_facades.js`, `lab/arch_grammar.js`, `lab/arch_rooms.js`; data in
`tools/blueprint-lab/data/architecture/` (`corpus-*.json`, `showcase-*.json`, `rules.json`). The showcase columns are
the 16 designs Tyler walked (build 1000-4015579).

### Windows: runs, sides, storeys

A run is the windows of one wall line on one floor level. 1,288 builds have rooms; 22,755 windows; 4,199 runs of two
or more windows. The shuffle deals each build's own windows to its own runs at random, so it keeps every build's mix of
features and loses only where they were put.

| Measure | Corpus | Shuffle | Showcase |
|---|---|---|---|
| Runs whose windows share one built treatment (frame features and fill) | 66.8 % | 28.5 % | 67.5 % (40 runs) |
| Runs uniform including lights and hung decor | 64.8 % | 26.8 % | 47.5 % |
| Runs of 5 or more windows uniform | 51.9 % | | 0 % (3 runs) |
| Builds: share of their runs uniform, p50 | 0.67 | | |
| Builds with no run of mixed treatment | 33 % | | 5 of 10 with runs |

Per feature (runs holding the feature at least once): the share where every window of the run has it, the share where
one window alone has it, and the full-run share after the shuffle.

| Feature | Windows with it | Full run | One window alone | Full run, shuffled | One piece on every window of a full run |
|---|---|---|---|---|---|
| Side posts | 33.0 % | 68 % | 25 % | 29 % | 95 % |
| Sill board or 1x1 box | 16.0 % | 62 % | 29 % | 17 % | 95 % |
| Slanted braces (45, 26) | 12.7 % | 63 % | 31 % | 19 % | 99 % |
| Hood (roof piece over) | 8.6 % | 56 % | 39 % | 11 % | 99 % |
| Head board | 8.5 % | 43 % | 46 % | 10 % | 96 % |
| Arch | 6.0 % | 46 % | 41 % | 10 % | 98 % |
| Lights at the window, outside | 4.9 % | 46 % | 42 % | 7 % | |
| Hung decor (stands, signs, banners) | 4.5 % | 44 % | 47 % | 9 % | |
| Vines round the window | 1.7 % | 41 % | 52 % | 11 % | 100 % |
| Shutters (wood_window) | 0.7 % | 50 % | 36 % | 12 % | 100 % |
| Planters (plants on a sill) | 0.1 % | 27 % (11 runs) | 64 % | 0 % | |
| Fill: iron bars | 9.5 % | 69 % | 19 % | 19 % | |
| Fill: glass | 4.5 % | 70 % | 21 % | 15 % | |
| Fill: closed shutter | 0.3 % | 83 % | 11 % | 39 % | |

Reading: builders put a feature on a whole run two to five times as often as chance would. The built frame (posts,
braces, sills, fills) holds runs best; decor at windows (lights, hung things, vines, planters) is lone more often. A
full run uses one piece for its feature in 95 to 100 % of runs.

Showcase against the corpus: planters on 8.2 % of windows (corpus 0.1 %, vines 1.7 %; track B measured 7.7 %);
showcase designs 05, 09 and 10 carry 2 to 3 runs of mixed treatment each, home 11 has planters on a third of its
windows.

Sides and storeys:

| Measure | Corpus |
|---|---|
| Levels with windows on 2 or more sides where every side's lead treatment is the same | 32.5 % (2,356 levels) |
| Lowest level: the front (side with the most outer doors) differs from the other sides | 53 % (149) |
| Front richer (more features per window) / poorer | 36.9 % / 27.5 % |
| Front against other sides, share of windows: posts, hood, head, light | 0.51 / 0.42, 0.13 / 0.12, 0.10 / 0.07, 0.06 / 0.03 |
| Upper windows over a lower run (a window on the level below within 1 m of its wall line) | 31.6 % (13,066) |
| Of those, a window right under them (middles within 0.35 m) / within 1 m | 29.8 % / 43.0 % |
| Aligned pairs with the same built treatment | 52.4 % |
| Runs of 3 or more with equal gaps between windows (0.3 m) | 25.4 % (961 runs; the gap is 2 m in 81 of them, 4 m in 35) |
| Runs of 3 or more with every window the same width | 46.5 % |

Reading: the corpus holds a treatment along a run, and lets sides and storeys differ in about half of buildings, the
front richer more often than poorer. Exact geometric order (windows over windows, equal gaps) is a minority practice in
the corpus, though the literature asks for it (Franck, Whitsitt). D-136 gives the corpus the say: alignment and even
spacing are weighted items for formal buildings, never hard rules.

### Exceptions: where the odd window sits

Runs of 3 or more where one treatment holds most windows (763 runs, 3,258 windows): 10.9 % of windows differ.

| Room behind | Odd windows | All windows of those runs | Lift |
|---|---|---|---|
| Kitchen (cooking station, cauldron, oven) | 23.2 % | 16.0 % | 1.45 |
| Storage (3 or more chests, barrels, crates) | 11.0 % | 8.0 % | 1.38 |
| Hall (table and 3 or more seats, or a throne) | 4.2 % | 3.4 % | 1.24 |
| Bedroom | 9.3 % | 9.3 % | 1.00 |
| Workshop | 12.1 % | 16.5 % | 0.73 |
| Plain room (none of the above) | 29.4 % | 35.5 % | 0.83 |

Lone features (one window of a run of 3 or more has a feature the others lack, 366 cases): behind a kitchen 26.2 %
(base 16.0 %, lift 1.64), a hall 7.4 % (3.4 %, lift 2.2), a bedroom 11.5 % (9.3 %, lift 1.24); by a door 4.1 %; on the
top level 7.1 %. The lone features: posts 22 %, head 15 %, sill 13 %, braces 12 %, arch 11 %, hood 10 %, light 9 %.
Odd windows sit at a run's end 50 % of the time (base 46 %). How they differ: posts added or missing (24 %), another
fill (11 %), a sill added or missing (10 %).

Reading: Tyler's kitchen window with herbs (D-167) matches the corpus: kitchens and halls hold the windows that break
their run more often than other rooms. The program allows exceptions only there, at the corpus rate.

### Building grammar (lab/arch_grammar.js, 1,146 buildings in 1,827 builds)

| Principle | Measure | Corpus | Showcase (16) |
|---|---|---|---|
| Material order | Wall material families with 10 % or more of the walls: 1 / 2 / 3 / 4+ | 43 / 38 / 16 / 3 % | 25 / 56 / 19 / 0 % |
| | Heavy walls (stone, black marble, grausten) below light ones / above | 78.4 / 14.9 % (450) | 90 / 10 % |
| | Where heavy gives way to light: floor line / elsewhere / plinth of 1.5 m or less | 49 / 40 / 11 % (316) | 2 / 0 / 5 |
| | A plinth on all four sides | 88 % (25) | 4 of 4 |
| Roofs | One roof material on 90 % of roof pieces | 88.2 % | 100 % |
| | One slope family / two | 48.7 / 45.3 % | 93 % one |
| | With two: the minor family lower / the main family steeper | 49 / 44 % | |
| Carved heads | Dragon, raven and wolf heads with a mirrored twin | 85.7 % (4,168) | 4 of 8 |
| | Near a roof (8 m) / within 2.5 m of that roof's top | 88.8 / 27.1 % | |
| Symmetry | Shell mirrored across its middle, share of pieces, p25 / p50 / p75 | 0.13 / 0.64 / 0.89 | 0.50 / 0.59 / 0.91 |
| | Formal (0.8 or more): all / longhouse / home / tavern / farm | 37 / 51 / 37 / 30 / 18 % | 44 % |
| | Door on the axis, where the shell is 0.6 or more mirrored | 79 % (428) | 6 of 7 |
| Doors | Buildings with 2 or more outer doors: one door clearly richest / all dressed alike | 36.8 / 26.4 % (326) | 1 of 3 |
| | The richest door on a long side | 54 % | |
| Trim | Outside corner posts: all corners / none / some | 28 / 23 / 48 % (461) | 18 / 64 / 18 % |
| | One post piece at every posted corner | 56 % | 100 % |
| | Wall bands at the foot, by side: no side / some sides / all sides | 71 / 29 / 0.4 % (785) | 100 / 0 / 0 % |
| Bays | Lines of 3 or more posts with equal gaps | 34.7 % (30,189 lines; 2 m gap in 4,044, 4 m in 2,115) | 87 % |
| Village | Builds with 3 or more buildings: share of buildings with the lead wall material, p50 | 0.80 (43 builds, 205 buildings) | |
| | Lead roof material / lead roof slope / all three, p50 | 1.00 / 0.88 / 0.67 | |

Readings:
- Heavy under light, with the change at a floor line or a plinth and level all round, is the corpus norm. The
  generator's stone-base walls already do this; the program states it as a rule for every material change.
- One roof material per building is the norm; a second slope is common, and the corpus does not say it must be lower
  (Alexander's cascade of roofs is a weighted item, not a hard one).
- Carved heads come in mirrored pairs. A single head is the exception.
- About a third of buildings are formal; longhouses most (half), taverns and farms least. When a building is formal,
  its door is on the axis.
- Corner posts and wall bands are all-or-none less often than windows: half of the buildings post some corners. Read
  with section 6 (the reader counts room corners that are not the building's outer corners). The program gives three
  modes: all, none, the entry side's corners.
- A village keeps its roof material on every building, its wall material and roof slope on most; about one building
  in three changes one of them.

### Rooms: one program per room and per household (lab/arch_rooms.js, 1,217 builds)

Per room (covered rooms of 6 m2 or more holding two or more of the kind), and per household (builds with three or more
rooms holding the kind): the share of rooms whose lead kind is the build's lead kind, against rooms drawn from all
builds at random.

| Channel | One kind in the room | Room takes the household's lead | Drawn at random |
|---|---|---|---|
| Light kind | 61.7 % (3,254 rooms) | 68.8 % | 33.7 % |
| Banner | 68.9 % | 74.2 % | 31.8 % |
| Drape | 79.4 % | 75.3 % | 54.7 % |
| Rug | 46.0 % | 61.2 % | 35.6 % |
| Furniture family (track A catalog) | 44.0 % | 65.8 % | 44.7 % |

Reading: a household keeps one light kind, one banner, one drape and one wood family across its rooms about two
times in three, twice the chance rate for lights and banners. Rugs mix more inside a room. The showcase file holds the
same measure for the 16 designs (`showcase-room-programs.json`).

## 3. Where the generator breaks each principle

Read from the code on design/wip-architecture (main 0d22c7d). File owners: track D (`lib/generate.js`,
`lib/details.js`), track E (`lib/decorate.js` and the interior files). This track edits none of them; the call sites
to change are in section 4.

| Principle | Where it breaks | What it does |
|---|---|---|
| One treatment per run | `lib/details.js` exterior, windows loop: `dressed(ctx, 'window', key, front)` | each window draws bare or dressed from its own place (70 % dressed), so a run has holes |
| | `lib/details.js` shutters (`X.shutters`) | shutters only where the bays beside the window are plain, so some windows of a run get them and others do not |
| | `lib/details.js` `shutterKit` | open shutters where there is room, closed shutters in the light where there is not: open and closed in one run |
| | `lib/details.js` `motifWindow` (`lib/motifs.js` `plan().get`) | the motif is cached by window size and front; windows of two sizes in one run get two motifs; a window under a lean-to stays plain |
| | `lib/details.js` window boxes | a different plant in each box (`SILL_PLANTS` by box place); the corpus keeps one species to a cluster in 73 % (ROOM_STUDY.md) |
| Reasoned exceptions only | `lib/details.js` window boxes | boxes on every dressed front ground window of every home, tavern and longhouse from d2 (Ashlands aside): a rule by building kind, with no household reason; showcase 8.2 % of windows against D-165's "most windows have none" |
| Rhythm and storey order | `lib/generate.js` walls: `evenBay \|\| windowExtra(C, seed, e, s)` | the bays between windows take a window by a draw per bay and per storey, so storeys of one wall differ and the gaps are uneven with no reason |
| Trim modes | `lib/details.js` corner posts: `cornerDressed` per corner; stone corners `dressed(ctx, 'corner', ...)`; corner motifs per corner | each corner draws its own post or none: some corners posted, others bare, with no pattern (entry side or all) |
| Hierarchy of doors | `lib/details.js` doors loop | every door gets the same frame and the same hood draw; lamps and banners skip only the back door, so a second door can match the front |
| Thematic ties | `lib/details.js` `profile`: shutters 0.6, door hood 0.7, gable truss 0.6, porch 0.5 each from `R()` | building-level draws, each on its own; a building can get a carved gable truss and no frame on its windows. The program draws one family and ties them |
| One program per room | `lib/decorate.js` (track E) | lights, drapes and rugs picked per slot; the corpus keeps one light kind per room in 62 % and the household's lead light in 69 % of rooms (section 2) |

The same principle shows in Tyler's other examples: wood_ledge "placed randomly on a wall... like throwing spaghetti"
(015), torches and candles repeated in every building, stacked chests in every corner. Each is a choice made per slot
with no program above it. The wall-hung pieces belong to track F and the interiors to track E; the room program
(section 5) gives them the household rule.

## 4. The building program (`lib/program.js`)

API (Node and the page; reads `data/architecture/rules.json`, or `window.VH_ARCH` in the page):

```js
const Program = require('./program.js');
const V = Program.village({ cultureKey, biome, seed });        // optional: the village's shared family
const prog = Program.plan({ cultureKey, type, stage, decor, biome, seed, storeys, persona, village: V, kit: K });
Program.run(prog, { side, storey });     // { features, fill, pieces, why } for every window of that run
Program.window(prog, { side, storey, line, room: { kind }, byDoor, key }); // the run's family, plus at most one
                                          // exception per run: { feature, reason, room }
Program.door(prog, { main });             // { rank: 'main' | 'secondary', dressing: [...] }
Program.room(prog, { kind, key });        // per channel (light, banner, rug, drape, wood): 'lead' or 'own', second kind
Program.setLead(prog, channel, kind);     // the interior owner sets the household's lead kinds once
Program.check(prog, windows);             // faults: lone feature without a reason, mixed run, planters over the cap
```

side: `front` (the main door's wall), `back`, `side`, `gable` (a loft or gable window, its own run), `court`. Every
choice comes from a hash of the building's make (culture, type, biome, seed, household salt), never from the random
stream the generator draws from, so the program is the same at every decor stage and can be asked again by any file.

What it decides:

- Front family: from the culture's palette (`PALETTE`, a program choice from CULTURE_STYLES.md and the vernacular
  sources: what each culture builds round a window), each feature at its corpus group's window share times 1.3 (the front
  is the richer side). Fill (open, bars, glass, closed) at the group's shares. s1 keeps the frame features only; a
  plain or austere household drops the decor ones.
- Village: with a village program, a building takes the village family unless it is one of the one in three that
  varies (corpus village p50 all three shared 0.67). Corner mode is the village's.
- Other sides: the front family whole in 47 % of buildings, else its built frame only (posts, braces, arches,
  shutters, fill). Middle-eastern outer walls always keep the frame only; their court faces take the full family.
- Upper storeys: the family below in 52 %, else the frame only. Gable and loft windows are their own run.
- Planters: a household trait (persona hobby.plants times likes.sill 1.5 or more, drawn), on the whole front ground run,
  never past the village cap of 10 % (D-165). The test pool gives 6.5 % of windows.
- Exceptions: at most one per run, each from the rule list in `rules.json` with its reason: herbs at a kitchen
  window, a hood over a kitchen window, a lamp or the household banner at a hall window, a shut or barred store, shutters
  on a bedroom, a lamp by the door. Drawn at half the corpus rate of odd windows (10.9 %) times the room's lift; the
  test pool gives 7.2 % of windows.
- One piece per feature for the building (`prog.pieces`), from the kit.
- Doors: one main door with frame, step and one of hood, lamps or banners; the others the frame only.
- Formal or free: formal at the corpus share for the kind (home 37 %, longhouse 51 %, tavern 30 %, farm 18 %), more
  for byzantine, castle-medieval, middle-eastern and lamari; formal means the door on the middle bay and the front
  windows mirrored about it.
- Trim: corners all, none or the entry side's (28 / 23 / 48 %); wall bands on no side (71 %) or the entry side; one
  post piece.
- Materials: heavy under light, the change at a floor line or a plinth, level on every side.
- Roof: one material; a second slope family allowed (45 %).

Checks: `node lab/test_program.js` (2,592 programs over every culture, six kinds, six villages): every run one
treatment or one reasoned exception, the program the same when asked twice, planters under the cap. Shares against the
corpus: sides like the front 0.44 (0.47), upper like below 0.51 (0.52), formal 0.39 (0.37).

Call sites for track D (their files; a small function and a minimal call site each):

1. `lib/generate.js` after `dctx.profile` is set: `dctx.program = Program.plan({ cultureKey, type, stage, decor, biome,
   seed, storeys, persona: dctx.persona, village: req.village, kit: K })`.
2. `lib/generate.js` walls: replace `evenBay || windowExtra(C, seed, e, s)` with a rhythm chosen per wall line, the same
   on every storey of that wall (every other bay, or every bay for a `single` kit), mirrored about the door on a formal
   front.
3. `lib/details.js` windows loop: replace `dressed(ctx, 'window', ...)` with `Program.window(ctx.program, { side, storey:
   o.storey, line, room, byDoor })` and build exactly its `features` (sill, head, posts, shutters, hood, planter) for
   every window of the run; the motif for a run is chosen once per run (one size per run) and kept on each window.
   Shutters: both leaves open where the wall allows, else closed in the light, the same choice on the whole run.
4. `lib/details.js` window boxes: only where `features` holds `planter` or the exception is `planter`; one plant
   species per run (`prog.pieces.planter`), herbs at a kitchen exception.
5. `lib/details.js` corners: `prog.corners` (`all`, `none`, `entry`) in place of `cornerDressed` per corner; one post
   piece (`prog.cornerPiece`).
6. `lib/details.js` doors: `Program.door(prog, { main: !o.back && o.kind === 'door' && first })` picks the main door's
   dressing; the others keep the frame.
7. `lib/build_web.js`: `program.js` in `libs` before `details.js`, and `window.VH_ARCH = rules.json` in the page code;
   the integrator rebuilds `src/Villheim.Logic/Generator/lab.js`.

The room behind a window: the decorator knows the rooms (track E). Until it hands rooms to the details, `room` may be
left out and the program gives the run's family with no exception.

## 5. The room program for interiors (track E)

The same rule inside: a room picks one program (wood family, metal, fabric, light kind) for its purpose, and the
household keeps one lead kind across its rooms, each with the corpus share in section 2.

- `Program.room(prog, { kind, key })` returns, for light, banner, rug, drape and wood: `use: 'lead'` (the household's
  kind, about two rooms in three) or `'own'` (this room's own kind, with its purpose as the reason: a forge light in
  the smithy, a hearth's fire in the hall), and `second: true` where a second kind may join the lead in this room
  (light 38 %, banner 31 %, drape 21 %, rug 54 %, wood 56 % of rooms).
- The lead kinds are set once per household with `Program.setLead`, from the catalog (track A) and the culture's corpus
  leads (`data/rooms-corpus/caps.json` byCulture, lib/decorate.js CORPUS_CULT).
- Wood: one furniture family per zone, two at most per room (track C criteria item 8; ROOM_STUDY.md section 4 for the
  pairs that go together); the household's lead family in two rooms of three.
- Metal: one metal family per room for fittings of one use (Jordan Samson in the earlier study; the corpus pairs iron
  props with log furniture at 0.34 of chance).
- Exceptions follow the room's purpose and nothing else, as on the facade.

## 6. Limits of the measures

- Windows come from the room reader: a window on a wall with no room behind it (a stair tower, an open loft) is
  missed, and an upper window high in a tall hall is missed. Lights filled with iron bars are added by the miner.
- The treatment reader counts what stands round a window on the outside within set distances. A post at a corner next
  to a window counts as that window's post, so runs ending at a corner read as mixed more often than they are: the
  corpus mixed-run counts are an upper bound.
- Room kinds come from the furniture in the room (kitchen, workshop, bedroom, hall, storage, living, plain).
- Corners: two outer faces of one room meeting, the building outside both; a room corner inside a courtyard or on a
  stepped wall counts too.
- Post lines include fence posts and furniture of posts in the build's box: the bay measure is noisy.
- Culture groups: 878 builds have windows and a culture group; groups under 8 builds are left out of the per-culture
  shares and the program blends small groups with the whole corpus (n / (n + 40)).
- The study pages for most cultures in the brief (Baltic, Slavic log houses, Byzantine houses, steppe dwellings,
  Anglo-Saxon halls) are in CULTURE_STYLES.md from earlier studies; this study added the Norwegian farm, the
  Icelandic gabled farm, the Syrian courtyard house, the Danebury roundhouses, nalichniki and Middle Byzantine
  regional notes. Wikipedia pages for timber framing and the stabbur were refused by the fetch tool; the Loft
  (building) page and Looking at Buildings were read in their place.

## 7. Source list

Architecture
- Christopher Alexander, A Pattern Language: 159 Light on Two Sides of Every Room and 221 Natural Doors and Windows
  (patternlanguage.com sample pages, https://www.patternlanguage.com/apl/aplsample/apl159/apl159.htm and apl221);
  110 Main Entrance, 116 Cascade of Roofs, 117 Sheltering Roof, 127 Intimacy Gradient, 179 Alcoves, 180 Window Place,
  242 Front Door Bench, 245 Raised Flowers, 246 Climbing Plants, 249 Ornament, 251 Different Chairs, 252 Pools of Light
  (urbigenous.net/a-pattern-language/pattern-NNN.html).
- Christopher Alexander, The Timeless Way of Building, notes at https://lib.fo.am/the_timeless_way_of_building.
- Francis D. K. Ching, ordering principles after Architecture: Form, Space, and Order: Tishk International University,
  Theory of Architecture I, lecture 6
  (https://lecture-notes.tiu.edu.iq/wp-content/uploads/2023/06/Lecture-6-Ordering-Principles.pdf).
- Christine Huckins Franck, "Avoiding fenestration fiascos" (https://christinefranck.com/2012/11/30/avoiding-fenestration-fiascos/).
- Duo Dickinson, "By Design: Window Placement Inside and Out", Journal of Light Construction
  (https://www.jlconline.com/projects/design-build/by-design-window-placement-inside-and-out_o/).
- Brendan Whitsitt, "#17 Three Rules for Great Facade Design" (https://brendanwhitsitt.substack.com/p/17-three-rules-for-great-facade-design).
- Looking at Buildings, medieval timber walls (https://www.lookingatbuildings.org.uk/styles/medieval/walls-and-windows/timber-walls.html).

Vernacular
- Loft (building), Wikipedia (https://en.wikipedia.org/wiki/Loft_(building)), facts only.
- Norsk Folkemuseum, farm from Numedal (https://norskfolkemuseum.no/en/numedal).
- UNESCO tentative list, Icelandic turf houses (https://whc.unesco.org/fr/listesindicatives/5589/).
- Muslim Heritage, "The Courtyard Houses of Syria" (https://muslimheritage.com/the-courtyard-houses-of-syria/).
- Calvert Journal, "Nalichniki: traditional Russian windows" (https://www.calvertjournal.com/articles/show/11565/nalichniki-traditional-russian-windows).
- Stavros decor, carved window frames in the Russian style (https://stavrosdecor.com/articles/reznye-nalichniki-v-russkom-stile-kak-oformit-fasad-derevyannogo-doma-bez-peregruza/).
- Smarthistory, "Regional variations in Middle Byzantine architecture" (https://smarthistory.org/regional-variations-in-middle-byzantine-architecture).
- Butser Ancient Farm, roundhouses (https://butser.org.uk/roundhouses.html); Digital Digging, Danebury roundhouses
  (https://www.digitaldigging.net/iron-age-roundhouses-danebury-ring-hillfort/).

Interiors and games
- Ohio University, "Some Principles of Design" (https://people.ohio.edu/ziff/ART%202650/Some%20Principles%20of%20Design.pdf).
- Dan Cox, GDC 2014, "What Modern Interior Design Teaches Us About Environment Art": 3DVF write-up
  (https://3dvf.com/dossier-1175-1-dan-cox-ce-que-decoration-d-interieur-moderne-nous-apprend-sur-l-environment-art-html/)
  and Ringling student notes (https://sites.google.com/a/c.ringling.edu/ringling-ca-ga-wiki/gdc-notes/gdc-2014_1).
- Joel Burgess, "Skyrim's Modular Approach to Level Design", Game Developer (https://gamedeveloper.com/design/skyrim-s-modular-approach-to-level-design);
  80.lv interview "Building Huge Open Worlds: Modularity, Kits and Art Fatigue" (https://80.lv/articles/building-huge-open-worlds-modularity-kits-art-fatigue).
- Christopher Totten, "Towards a Digital Architecture" (https://gamedeveloper.com/design/towards-a-digital-architecture) and
  "Designing Better Levels Through Human Survival Instincts" (https://gamedeveloper.com/design/designing-better-levels-through-human-survival-instincts).
- 80.lv, "How Naughty Dog Created the Immersive World of The Last of Us Part II"
  (https://80.lv/articles/how-naughty-dog-created-the-immersive-world-of-the-last-of-us-part-ii).
- 80.lv, "Environment Art Tips from Anthony Vaccaro" (https://80.lv/articles/environment-art-tips-from-anthony-vaccaro/).
- DiGRA book notice for Totten's An Architectural Approach to Level Design (https://digra.org/book-an-architectural-approach-to-level-design/):
  an announcement only.

Not read: Ching's books in full, Totten's book, Interior Design Illustrated, Building Construction Illustrated, the GDC
talk videos. The earlier studies' sources (feng shui, wood mixing, Carson, 80.lv, WoW housing, Skyrim) are in
`docs/handoffs/2026-11-12-showcase-review/outside/sources.md`.
