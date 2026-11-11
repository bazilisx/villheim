# Handoff: the lab page with fewer choices up front (design helper 5, 2026-11-10)

Branch `design/wip-lab-page` from main 9b9711d. Only `tools/blueprint-lab/web/app.html` changed. Nothing in `lib/`
was changed; `web/index.html` was built locally to test and restored.

## Tyler's request (2026-11-10)

"I would like far fewer toggles to start, and then these more detailed nuanced toggles can always be below. But to
generate, I just want two things: 1) the building type and the culture. No other choices. Then it randomly makes
something with those two. And then below, I can run things again with additiaonl toglges if I want. And I also dont
necessarily want to have the open text field of "what shold it be" to start either. I want to have that below if
necessary but I almost never use it" and "maybe all the other default to "pick for me" so under the secondary
options, I can toggle on only one or two and modify the existing design to (say) add more decor by turning into d3?
Maybe these can be slider options that change the exising model from s1 to s2 to s3 and from d1 to d2 to d3?"

## What the page does now (app.html)

- New building: Building and Culture at the top, then Build it and Another one. Culture lists "Any culture", then
  each village culture with its biomes, then the older lab styles in their own group. Build it draws the culture (for
  Any culture), the biome from that culture's biomes, the size and decor stages and a seed, and builds the best of 8
  candidates. Another one keeps the culture, biome and stages and draws a new seed. A caption under the building
  lists building, culture, biome, plan, roof, walls, stages and seed, and which of them the viewer set.
- Two sliders under the caption, Size stage s1 to s3 and Decor stage d1 to d3. A move rebuilds the kept candidate
  seed with the same household seed (lineage), culture, biome and choices at the new stage.
- More choices (closed at first): biome, plan, roof, walls, stories, porch, roof pitch, candidates and seed, each
  starting at Pick for me (empty, so the generator gets no value for it, as the game's requests do). Changing one
  rebuilds the current design with that change; candidates and seed run the candidate search again. "All back to Pick
  for me" clears them.
- Describe it in words (closed at first): the text box and Read my request, as before. The words fill Building,
  Culture and More choices, and the stages they name; the rest is drawn.
- Interiors: Building and Culture, Show interiors, a caption, the two stage sliders, and More choices with household,
  compare, examples, house seed and biome. A slider or choice change shows the same interiors again and keeps the
  plan that was open.
- Decorate and Repair are unchanged.
- The viewer's choices (top selects, More choices except the seeds, which sections are open) are kept in
  localStorage inside try/catch.
- American spelling on the page: Stories, Cozy, neighbors, color (comment), "Rooms around a courtyard".

## How stages relate for one seed (lib/generate.js, read only)

- generate() takes the household seed as `lineage` (the asked seed when the request has none). massingPath() draws
  the roof, walls and the main wing and each stage's step from lineage, type and culture only, so the stages of one
  lineage share the roof and wall family and grow in steps (rect, then keep, long, L, T, cross, U). Furnishing,
  fires and other parts come from the seed and the stage, so they change between stages (D-132 allows this).
- massingPath is skipped when a plan is set, when the culture's form sets its own shape (forms other than svan,
  raised, open), for towers, and for types with no GROWTH entry (tower, dock, stall, temple, well, camp). Then each
  stage draws its own plan.
- Decor stages of one seed keep the same building: d1 and d2 are cut from the d3 furnishing (D-071, persona growth).
- Sample, pinned seed and lineage (node, /tmp/h5-scratch/stages.js): Norse home 7 rect, rect, L; Slavic home 42 rect,
  long, long; Norse longhouse 7 long, T, cross; fen folk smithy 7 L at every stage; Saami and Celtic homes octagon at
  every stage. Two cases change the shape family: Norse temple seed 42 goes rect at s1 to octagon at s2 (no growth
  path for temples), and Middle Eastern homes go rect, L, then court at s3 with no massing path at s3.
- Tavern s2 d1 against d3, seed 42: the only non-decor differences are yard plants (Bush01_heath, Pickable_*).

## Generator findings for the lead

- lib/yards.js line 640 reads `global.YV` without checking that `global` exists. In the browser this throws
  "global is not defined" whenever a yard fence piece is refused, and the page shows no design. app.html sets
  `window.global = window` before the libraries as a stopgap; the lasting fix is a `typeof global !== 'undefined'`
  check on that line.
- generate() treats a missing roof or walls differently from 'auto': lines 541 (`!req.roof`, the 40 % shed roof for
  open-sided types) and 551 (`!req.walls`, the culture's typeWalls) only apply when the field is missing. The old page
  always sent 'auto'; the new page sends nothing for Pick for me, the same as request.js make() and the game.
- Temples (and other types without GROWTH) can change shape family between stages, against D-132.

## Checks run

- `node lib/build_web.js web/index.html` builds (3.87 MB).
- Headless Chrome (puppeteer, /tmp/h5-scratch/run.js) on the built page: load, Another one, Build it, both sliders,
  every More choices field, seed, reset, Read my request, Decorate and Repair tabs, Interiors with both sliders and
  every More choices field, a plan click, Show interiors again, back to New building, localStorage. No page errors.
  Norse home: seed and kept candidate stayed the same over s1, s2, s3.
- A script listed every id the page's code uses; all exist in the page.

## Open

- Build it draws the stages at random (s1 to s3, d1 to d3) on both tabs. If Tyler wants Build it to keep the slider
  positions, that is a small change in draw() and iDraw().
- The yards.js guard and the temple growth path are generator work.
