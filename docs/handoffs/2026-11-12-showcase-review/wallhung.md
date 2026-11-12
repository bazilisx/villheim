# Track F: wall-hung pieces (showcase review, 2026-11-12)

Branch `design/wip-wallhung`. Tyler (TYLER_NOTES.md, the night's note on wall pieces): "Signs and stands and sometimes lights that werent
touching walls and were a foot or more away, as well as their random assorted layout and positioning was the issue";
earlier "signs and item stands sticking out from the wall, not attached", "torches oriented the wrong way", wood_ledge
"like throwing spaghetti at a wall". Criteria: `criteria/wallhung.md`.

## By principle

Tyler's signs, stands, torches and ledges are cases of one principle: anything attached to something (a wall, a beam, a
post, a ceiling, a roof, a floor, a table, a shelf) sits on it the way builders attach it, faces the way it is meant
to, and is placed with intent. Measured for every attached kind, not only the ones he named:

| Principle | Cases found (showcase before, same measures) | Fixed here | Left, with owner |
|---|---|---|---|
| Hung on a wall: on what shows of the wall at its own height | signs, item stands, wall torches, Dvergr lanterns, banners (inside and out), wall ledges, the cauldron's racks, door torches outside, motif props: 115 of 314 more than 3 cm off, 11 in the air, 26 too deep, 43 half off | all of these (`hang()`) | the roof carvings on gable ends (track D) |
| Turned the way it is meant to | hub torches with the arm along the wall (11); every hung prefab's wall side checked against the catalog | hung pieces | furniture fronts (a wardrobe and a bed turned around, Tyler on 03 and 09): track E, with the catalog's front sides |
| Standing on what holds it | standing torches 10 cm over every floor (42 of 50 in the showcase), hub torches up to 64 cm; hub benches and chests 3 to 4 cm (stand 0.125 m against the corpus 0.097 to 0.10 m over the floor pivot); a mead cauldron 1.9 m over the floor under a gallery; flat stands up to 80 cm over their shelf | standing torches (`settle()`, decorator base 0.65 m) | hub furniture height and the cauldron (track E); flat stands on shelves (track G) |
| Hanging from what holds it | ceiling braziers set at a computed height: one hub brazier 25 cm under its roof; the decorator's chain top 35 cm into the ceiling | braziers (`hangFrom()`, corpus 5 cm in) | none known |
| Not over or in front of another | signs 45 % over each other on the notice board, torches over stands, a spice rack over ledges | the overlap guard in `hang()`; notice layout | furniture on furniture (a chest on a table in the throne shot): track E |
| Placed with intent | a kit every 2.5 to 3.2 m with random jitter; ledges in 12 of 16 buildings | wall slots by intent, ledge cap (D-166) | the decorator's lights (`lightsIn` ranks by darkness with noise; track E can move it to `plan()`); what sits on tables and shelves (track G) |

## What was done

| Commit | What |
|---|---|
| 3266467 | `lib/wallhang.js`: one place that measures and places everything hung on a wall. Decorator mounts (`lib/decorate.js` putMount), the library's wall sets (`lib/kitbash.js` fit), the hub's stands, lights and notices (`lib/hub.js` placer, notice board) go through it. `lab/wallhung_measure.js` |
| 40ee0e6 | The game bundle carries `lib/wallhang.js` (`lib/build_engine.js` list) |
| f32b23f | Wall dressing by intent (`lib/kitbash.js` dressWallsPlanned, `lib/wallhang.js` plan); overlap guard in hang(); ledges capped (D-166); door torches (`lib/generate.js`) and outside banners (`lib/details.js`) through hang(); the measure tells pieces standing on furniture from hung ones |
| ed8e6cb | Pool audit measures wallOff, wallHalf, wallTurn, wallStack, gated (`lib/audit.js`); `lab/test_structure.js` wall checks; motif props (`lib/motifs.js`) and the vignette torch (`lib/kitbash.js`) through hang() |
| a418715 | Notice board as a column of notices per face; `lab/render_walls.js` (wall views and close-ups) |
| 080cfc5 | A set's own pieces count as wall when its hung pieces go up; the spice rack's back plate |
| 849e422 | One wall light height through a house (`lightY`), for the library's torch kit, the hub and the decorator (Tyler's note on consistency) |
| a5b8a10 | Standing and hanging pieces: `attach`, `settle`, `hangFrom` in `lib/wallhang.js`; standing torch base; hub torches and braziers; `lab/attach_measure.js`; the audit's watched floats measure; test_structure checks |

## How it works

- `HUNG` lists each hung prefab with the side that goes to the wall, from the game's meshes (the torch's wall plate at
  local -x, the Dvergr lantern's at +x, the item stand's board at -z with its peg toward +z, a banner's rod and cloth in
  local y-z). They match the piece catalog's corpus-read back sides (`lib/catalog.js` facing) for every prefab the
  catalog is sure of; `lab/test_structure.js` checks that.
- `measure(p)`: the piece's model box (data/piece-models.json bounds) moves straight back until it meets what shows of
  a wall, beam, post, window, door or gable (fine parts of data/piece-fine.json, 2 cm to the mesh; colliders where a
  model shows no more than them). The distance is the gap. Its back plate in 3 by 3 parts gives cover; the same test to
  the front and both sides gives facing.
- `hang(name, spot)`: puts the piece 0.7 m out from a wall point, moves it back until it meets what shows at its own
  height, then in by its sink (5 mm for boards, stands, torches and shelves; a banner's rod 10 cm so its cloth lies on
  the wall; a Dvergr lantern's bracket 15 cm). On an uneven wall (stones, logs) it goes in until half its back touches,
  no deeper than 10 cm for a stand, 8 for a sign or torch, 3 for a shelf, and carries the depth as a clip made on
  purpose (`wclip`, D-098). It refuses a spot with less than 7 of 9 parts of the back on the wall, with anything deeper
  than the sink at its sides, or whose outline on the wall overlaps a piece hung there.
- `plan(face)`: the slots of a wall face in order: centered over what stands against the wall, a mirrored pair either
  side of a window or door, the middle of a plain stretch, a pair at the quarters of a long wall; lights beside the door
  first. `lib/kitbash.js` dressWallsPlanned takes them: one kit per slot, never nearer than its width plus 0.6 m to the
  next (lights 2 m), a pair or nothing, the high shelf only as a second tier over a ledge, a household's bare walls
  whole walls, at most two wall-ledge kits in a building and only ledges holding things (D-166).

## Findings: the causes

The 16 showcase files on Tyler's PC are byte for byte what the lab makes at 4015579 (md5 of all 16 match;
`/tmp/wallhung-scripts/regen_showcase.js` emulates GenCommands ShowcaseList and ForPlanBuild), and the lab code has not
changed since. So what Tyler saw in the game is in the files; nothing in the game moves the pieces.

1. **The room's wall face is the collider line of the lowest wall, not what shows at the piece's height.** Hub 01's
   walls are a 1 m stone plinth (face at z -6.5) with a 2x2 wood wall set 35 cm back above it (face at -6.85). Every
   stand, sign and torch hung above the plinth was put at the plinth's face, 30 to 35 cm out from the wood wall: the
   "foot or more away" in video1. The library's wall sets (`lib/kitbash.js` fit) put a hung piece's collider on the
   face's collider: stone walls show 9 to 11 cm past their collider (so stands sank into the stones) and log walls 3 to
   5 cm. The decorator's mounts used a fixed pivot offset per prefab from the collider face.
2. **Hub lights turned by the wall's yaw alone** (`lib/hub.js`, torches and banners passed `sp.yawIn`): the torch's
   wall plate is its local -x, so its arm ran along the wall, in the air or through the side wall. 11 turned wrong in
   the showcase measure; video2-16.
3. **Notice board.** Three 1 m signs 0.55 m apart on a 2 m board: each overlapped its neighbor by 45 %, the middle one
   raised 0.2 m over them, all set 0.16 m from the half wall's middle, so on the face with the rail the signs went
   through it. The wall notices of the s4 and s5 halls: three signs 0.6 m apart, alternately 0.35 m higher. Video1-05.
4. **Even spreading.** The library's wall pass walked each face and put a kit every 2.5 to 3.2 m with a jitter of 0.7 to
   1.5 and random skips; a ledge kit came up on most walls (wood_ledge in 12 of the 16 buildings, 107 pieces). The tool
   wall set alone put 55 stands up in the showcase, 33 of them off their wall.
5. **Things hung over one another.** The torch pass looked only for other lights before hanging a torch, so torches went
   over item stands; a kitchen kit's ledges went over a spice rack. Nothing checked hung pieces against each other.
6. **Outside.** Door torches at the collider plus 0.28 m stood 4 cm off log walls; banners on outside walls 20 to 29 cm
   off; a motif's sign 21 cm into the beam over a door; the hub's dragons and the gable dragons sit on roof ends (left
   to track D, below).

## Numbers

Showcase, `lab/wallhung_measure.js` (same measure before and after; pieces standing on a floor or furniture counted
apart):

| | wall pieces | flush | off > 3 cm | in the air | too deep | half off | turned | stacked |
|---|---|---|---|---|---|---|---|---|
| Before (Tyler's files) | 314 | 162 | 115 | 11 | 26 | 43 | 11 | 2 pairs |
| After (080cfc5) | 284 | 277 | 5 | 1 | 1 | 0 | 0 | 0 |

The 5 off and 1 in the air: four hub roof dragons and one gable dragon (roof trim), and one ledge of the BK-drawers kit
22 cm over its chest (below). Pool audit on the showcase: wallOff 121 to 1, wallTurn 11 to 0, wallHalf 30 to 0,
wallStack 3 to 0, mountClip 33 to 12 (the 12: flat stands, itemstandh, 2 to 3 cm into the half walls of shelves and
counters, and two signs of the KC-138 corpus set standing on edge against its quarter walls).

Ten fresh designs (seed 7: Meadows and Black Forest homes, fen-folk tavern, highland smithy, longhouse, castle home,
dwarven workshop, byzantine temple, slavic hub s4, anglo-saxon storehouse): before 139 wall pieces, 65 flush, 55 off,
5 in the air, 14 too deep, 24 half off, 4 turned; after 108, 102 flush, 2 off (the BK-drawers ledges), 4 in the air
(gable dragons), none too deep, half off, turned or stacked.

Standing and hanging pieces (`lab/attach_measure.js`, decor that neither stands on nor hangs from anything within 3 cm):
showcase 77 of 656 before, 33 of 587 after. Corpus: standing torches 0.75 m over the wood_floor piece's pivot (most of
100 in liked builds), their foot on the floor's collider top (0.097 m); chests, benches, chairs, thrones and armor
stands 0.09 to 0.10 m over it; ceiling braziers' chain top 5 cm into what is over them (p50 of 739; p10 13 cm).

Arrangement (`/tmp/wallhung-scripts/arrange.js`): showcase wood_ledge 107 pieces in 12 buildings before, 36 in 9 after;
fresh set 45 in 9, 25 in 7. Wall lights with another within 1.25 m on one wall: 2 of 63 after (corpus: 96 % alone).

Corpus (`compact.json`, every hung piece measured the same way; decor use: no more than 3 of its family within
0.8 m, which leaves out the sign walls and stand panels builders use as material), liked builds (votes 10 or more),
coarse wall parts:

| | n | gap p10 | p25 | p50 | p75 | p90 | off > 3 cm | of which nothing behind |
|---|---|---|---|---|---|---|---|---|
| wall torch | 2,606 | -13 cm | -8 | 0 | 0 | 0 | 4 % | 2 % |
| item stand | 7,890 | -25 | -11 | -5 | -0.5 | 8 | 12 % | 3 % (the rest on another stand, a flat stand or a sign) |
| sign | 6,905 | -49 | -27 | -5 | -0.5 | 28 | 17 % | 3.5 % (the rest on a chest front, a sign or a stand) |
| banner rod | 4,717 | -38 | -30 | -12 | 1 | 16 | 22 % | 8 % |
| Dvergr lantern | 4,423 | -34 | -27 | -20 | -2 | 0 | 5 % | 3 % |

Builders hang decor touching the wall or into it; standing off it with nothing behind is rare. Pieces over one another
in the corpus are mostly material use (sign walls, stand panels: 30,878 sign over sign stacks in all builds); in liked
builds a stand over a banner (104 pairs) or over a sign (813) is the layering builders do on purpose. Corpus arrangement numbers
are track B's (`docs/ROOM_STUDY.md` section 7, `data/rooms-corpus/walls.json`): lights 96 % alone on their stretch, 2.7 m
apart, 71 % at one height; stands 59 % alone, rows at one height 49 %; signs 68 % alone, 15 % over a chest.

## Checks

- `node lab/test_structure.js`: all rules hold on 36 designs, with the new wall checks on each and on the Meadows hub
  s5d3 (notice board, catalog back sides, hang on a plinth wall).
- `node lab/test_hub.js`: on 3266467 the notice board test failed for the Plains middle-eastern part hall (signs did
  not go up against the board's posts); a418715 lays the notices in a column, and all hub tests pass on 080cfc5 (main
  at 0d22c7d passes too); all hub tests pass on a5b8a10 and on 849e422.
- Pool audit on the showcase after: wallOff 1 (a BK-drawers ledge), wallTurn, wallHalf, wallStack 0, floats 33
  (watched).
- The game bundle (`lib/build_engine.js` to /tmp) runs vhMake for the Meadows hub in a plain VM context.
- Renders in `/tmp/wallhung-renders/` (not committed): `0N-close-before.png` and `-after.png` for 01, 02, 06, 14 show
  each piece from the side and the front; before, the hub torches hang in front of the wood wall over the plinth with
  their arms along it; after, stands, signs and torches sit flat on the boards and stones.

## Changes in other tracks' files

- `lib/kitbash.js` (track E): `dressWalls` calls the new `dressWallsPlanned` and `busyAt` (its walk removed); fit's
  hung pieces through `hangB().hang` with `wallFaceAt`; the slide re-hangs; vignettes' torch; `LEDGE_KITS`.
- `lib/decorate.js` (track E): putMount calls hang() for HUNG prefabs; auditOne honors `p.wclip`; the standing
  torches' base 0.65 m; lightsIn's brazier through hangFrom.
- `lib/generate.js` (track D): `doorTorchOnWall` called from doorLights.
- `lib/details.js` (track D): `bannersOnWall` called from hangBanners.
- `lib/build_engine.js`: wallhang.js in the bundle list.

## Open problems

1. Roof carvings (wood_dragon1 on gable ends, `lib/generate.js` 1217; the hub's dragons over the door, `lib/hub.js`
   899) sit on roof ends and beams with no wall behind; the audit leaves them out. Track D: place them on the gable's
   beam ends with hang() against roof and beam parts, or measure them against roofs.
2. BK-drawers kit (`lib/kitbash.js`, track E): its two ledges sit 22 cm over the upper chest (rest 'on' reads the
   chest's open lid). In two designs.
3. KC-138 (a corpus set of signs standing on edge between two quarter walls) keeps 4 of its 6 signs where the set fits;
   with gaps it reads as a pile. Sets that are a row of the same piece should keep all of it or none (track E or G).
4. Decorator lights (`lib/decorate.js` lightsIn) still rank wall spots by darkness and purpose with a little noise; the
   planned slots are used by the library's wall pass only. Track E can move lightsIn to `plan()`.
5. The corpus pass with fine wall parts (`/tmp/wallhung-scripts/corpus_cells.js`) ran out of memory three times on the
   liked builds (2 cores, 7 GB shared); the table above is from the coarse pass. Stone walls' coarse box sits at the
   outermost stone, so the corpus depths into stone are a few cm deeper than shown.
8. Door torches outside (`lib/generate.js` doorLights, track D) hang at 1.55 m over the door's floor, apart from the
   household's light height inside.
7. Hub furniture stands at 0.125 m over the floor pivot against the corpus 0.097 to 0.10 m (benches and chests 3 to 4 cm
   up); a mead cauldron on a gallery 1.9 m over the floor under it; flat stands over their shelves (`lab/attach_measure.js`
   lists them). Tracks E and G.
6. Not tried in the game.

## Proposed Decisions rows

- D-new: Hung pieces on uneven walls (stone, logs) sink until half their back touches, up to 8 to 10 cm, marked as clips
  made on purpose (corpus decor-use stands sit 5 cm in at the median, 11 cm at the 25th percentile). Option: keep them
  touching the outermost stone, with gaps behind. Recommendation: sink, as builders do (D-127). In use now.
- D-new: Notice board layout: a column of two notices on the plain face and one over the rail on the other (in use), or
  a board two half walls wide with three notices side by side on each face.

## Next

Merge into track E's furnishing rewrite (E keeps the hang() call sites); move lightsIn to plan(); track D for the roof
carvings; the council criteria file is `criteria/wallhung.md`.
