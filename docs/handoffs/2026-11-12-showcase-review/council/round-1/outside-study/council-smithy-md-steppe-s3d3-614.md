VERDICT: FAIL

# Outside study: council-smithy-md-steppe-s3d3-614 (round 1)

Score 62 of 100 (pass mark 75). No hard fail. Groups: Intent 34 of 37, Palette and light 14 of 20, Clutter 9 of 23
(under half), Story 5 of 20 (under half). Deciding items: 11, 13, 15, 16, 19, 20, 22.

Checklist: `criteria/outside-study.md`. Measured from the blueprint and the builder's `views.png`. The builder's
scorecard gives this seat 32 of 32.

One room, 72 m2: an open-sided shed (posts, a hip roof, a lean-to at the back; no walls, no doors). Ten decor pieces:
forge with four extensions, workbench with its chopping block, two iron-banded chests, a wood stack outside.

## Hard fails

| # | Result | Measure |
|---|---|---|
| H1 to H3 | pass | open floor; forge front, bench front and chest fronts all clear |
| H4, H5 | pass | none |

## Scores

| # | Item | Wt | Score | Measure |
|---|---|---|---|---|
| 1 | Core set | 7 | 7 | the forge |
| 2 | Focal from the door | 6 | 3 | no door; from the open front the forge line is on the far edge, but nothing in the room is dressed |
| 3 | Command position | 4 | 4 | no beds or chief seat |
| 4 | Zones | 6 | 6 | forge, bench, store: three |
| 5 | One seat kind per table | 6 | 6 | no tables with seats |
| 6 | Walking lines | 6 | 6 | open |
| 7 | Pull-back | 2 | 2 | no seats |
| 8 | Woods | 5 | 5 | base wood bench; iron-banded chests are storage |
| 9 | Stone, metal, glow | 4 | 4 | none |
| 10 | Fabric colors | 2 | 2 | none placed (plan lists `rug_fur`, `rug_hare`, `piece_banner11`, candles) |
| 11 | Light layers | 6 | 0 | no light of any kind (corpus: 70 % of smithy rooms have lights, p50 4 where lit) |
| 12 | Light variety | 3 | 3 | no lights to vary |
| 13 | Near its use | 6 | 0 | no small things at all: no tools, ore, bars or finished goods anywhere |
| 14 | On a parent | 3 | 3 | nothing loose |
| 15 | Hot spots | 5 | 0 | no dressed spot |
| 16 | Layers | 3 | 0 | medium only (chests); no wall, floor or ceiling dressing |
| 17 | Density | 2 | 2 | 9 floor pieces, 1.25 per 10 m2 (smithy p25 to p75: 0.65 to 1.83) |
| 18 | Repeats | 4 | 4 | no extension twice |
| 19 | Mid-task scene | 6 | 0 | none (`story: []`); a smithy has its work to show (work laid out on the bench, a blade at the grindstone) |
| 20 | Who works here | 6 | 0 | no rest spot, no personal piece |
| 21 | One story | 4 | 4 | no prop off-story (there are no props) |
| 22 | Clue at the focal, unique piece | 3 | 0 | none |
| 23 | Imperfect placement | 1 | 1 | no seats |

## What a person walking through would notice

- An open shed with a heavy hip roof and a lot of bare plank floor. It is tidy to the point of looking unused, like a
  shop before opening day.
- The forge and its four extensions stand in one straight line along the back edge, 7.9 m from the grindstone's far
  side to the tool rack, with the grindstone 3.7 m from the forge's edge. It reads as a row of products on display, not
  as a smith's work place gathered round the fire.
- The workbench and its chopping block sit at the west end; two iron chests at the east end. The middle (about 8 by
  5 m) is empty.
- No lights, no tools hanging, no ore or bars, no blade on the grindstone, no water by the cooler, no stool for the
  smith, no rug, no sign. Nothing says who works here or what was made today.
- Good: the extensions no longer block the forge (Tyler's 013 note), the bench has its block, nothing crowds a way.

## Rule changes (by principle, for every building)

1. **Rooms without walls still get their wall layer, on posts and beams.** `lib/decorate.js` `mountSpots` and
   `lib/rooms_intent.js` `wallBay` look for wall faces; this room has none, so the wall layer, wall lights and the
   tool row were never placed. Rule: in an open-sided room, posts and roof beams give mount and hang spots (tools on
   a post by the bench, a lantern or torch on a post, items hung from the beam over the forge), as the corpus open
   smithies do; `lightsIn` falls back to standing torches or a hanging brazier when `wallLight` finds no wall.
2. **A station's dressing is part of the station set.** `placeStation` places the forge and extensions bare, and the
   stand pass finds no surface in a smithy. Rule: each station places its use items with it as one set (ore and bars
   on stands by the forge, a blade on the grindstone, tools over the bench, a finished-goods rack as a built
   assembly from `ASM_KINDS.smithy`), the way `cookCorner` should for the kitchen.
3. **Extensions gather round the station.** `placeStation` with `workExts` lays the extensions in a row out from the
   forge. Rule: extensions stand within the corpus distance of the station's edge (the existing note: anvil 1.5 m to
   one side, cooler and bellows 1.25 m to the other; check the corpus p90 in `data/intent.json` `work`) and wrap
   round its sides in a U before going further along the wall.
4. **Every work room has a scene and a worker.** `furnishRoom`'s smithy branch never calls `vignettes` or
   `headChair`. Rule: smithies and workshops at d3 take one work scene (a piece mid-work on the bench with its tools
   beside it) and the worker's rest spot (a stool or bench with a drink, the "rest corner"), and the culture's or
   household's clue at the forge (the household's banner or sign on the lean-to beam, a trophy).
5. **Planned layers have fallbacks.** The plan lists rugs, a banner and candles; none were placed because no call in
   the smithy branch asks for them. Rule: every room kind's branch in `furnishRoom` ends with the same layer check
   (wall, floor, medium or ceiling, light) and fills a missing layer from the plan's kinds at the room's focal or
   main zone.
