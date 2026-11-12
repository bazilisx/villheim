VERDICT: FAIL

# Assemblies seat (track G), round 1: council-smithy-md-steppe-s3d3-614

Smithy, Meadows, steppe culture, s3d3, seed 614. One room of 72 m2: an open frame of posts and beams under a hip roof,
no walls, with a lean-to on the back. Furniture: the forge with four extensions in a row along the back, a workbench
and its chopping block at the west end, two iron-banded chests side by side at the east end, a wood stack in the
lean-to. 0 item stands, 0 armor stands.

How it was checked: `node lab/audit_stand_items.js --file <blueprint> smithy` run by this seat (stands 0); the furniture
listed from the blueprint; the generation re-run from the same seed (identical blueprint) with hooks on
`lib/standitems.js` and `lib/assemblies.js find/place`; `views.png` read.

## Scores

Hard fails: H1 to H6 pass with nothing to test (no stands, no armor stand). H7 passes (no assembly placed).

Weighted. Items whose subject is absent are scored as written: a pass where placing none is right, and 0 where the
room's program calls for them. A smithy's program calls for tools on show: tools stand by a forge at a lift of 5.0 and
by a workbench at 4.1 in the corpus (22,042 dressed stands in 407 builds), and the corpus selection holds 16 forge
corners.

| # | Weight | Score | Points | Measured |
|---|---|---|---|---|
| 1 Items fit the room | 10 | 0 | 0 | 0 dressed stands where the room calls for tools |
| 2 Items tell the household | 10 | 0 | 0 | nothing on show; the ledger's themes are brewer 0.79, feaster 0.70, cook 0.68 |
| 3 Variety | 8 | 1 | 8 | not tested (under 8 stands) |
| 4 Village's world | 8 | 1 | 8 | nothing out of tier |
| 5 Show items in bays | 6 | 1 | 6 | none |
| 6 Armor outfit | 8 | 1 | 8 | no armor stand |
| 7 Built furniture where the room has a program | 10 | 0.5 | 5 | the stations stand together (forge and extensions in one line, workbench with its block), but no tool wall, tool shelf or forge corner built from pieces |
| 8 to 10 Assemblies fit, materials, repeats | 22 | 1 | 22 | none placed |
| 11 Hidden pieces with a purpose | 6 | 1 | 6 | none used |
| 12 Shelves read as shelves | 4 | 1 | 4 | no shelf |
| Total | 100 | | 67 | pass mark 75; on the items that apply (1, 2, 7), 5 of 30 |

Fails on: items 1 and 2 (a smith's place with nothing of the smith's on show) and item 7 (no tool wall or forge corner).

## Walk-through

- An open shed with the forge, bellows, grindstone and the other forge pieces lined up along the back beam, each one
  once. The workbench and its chopping block stand at one end, two dark iron-banded chests at the other.
- Nothing lies or hangs anywhere: no hammer or tongs over the forge, no ingots or ore by it, no tools over the
  workbench, no blade or shield being worked, no armor stand. A person could not tell what this smith makes or that
  anyone works here.
- With no walls, nothing can hang where the generator looks for walls, and the only flat tops it dresses (tables,
  benches, chests) are two chests, which were left bare.
- Nothing is built from pieces: no tool rack on the posts, no shelf for ingots, no bench built around the anvil.
- The stations are each used once here, which avoids the repeated anvils of showcase 13.

## Rule faults found here (each is general)

1. **The smithy has no built furniture kinds that fit.** `ASM_KINDS.smithy` in `lib/rooms_intent.js` lists tool-shelf,
   weapon-rack and armor-row; `AS.find` returns 1 recipe for them and the filters leave 0 (trace: `FIND ... smithy ->
   1`). The library's own smithy kinds are left out: forge-corner (16 recipes), work-corner (16), labeled-storage (12).
   Change R1.
2. **Open frames get no stand anchors.** `lib/kitbash.js anchorsOf` makes wall anchors only from wall runs, so posts
   and beams hold nothing, though the corpus hangs 29 % of its wall stands on walls and beams together
   (`lib/stands.js` notes) and the KS-w-tools set already has a 'workbench' context. No set anchors on a workbench or a
   forge top, where the corpus shows tools most. Change R6.
3. **A trade room can end with nothing of its trade.** Nothing makes sure a smithy, workshop or kitchen shows its
   work; the stand budget is spread by the household's favored places, and here those places did not exist. Change R6.

## Rule changes (for every building)

- **R1, program furniture first.** In `lib/rooms_intent.js`, place the room's built furniture as part of its core
  set: for a smithy, a forge-corner or work-corner recipe that brings its own forge or workbench (standing in for the
  room's station rather than being skipped by `ASM_SKIP`), then a tool-shelf or labeled-storage; query wall back or
  corner.
- **R6, anchors and a trade set.** Posts and beams on a room's edge count as wall anchors in `anchorsOf` (both faces
  of a beam that has open air under it), workbench and forge tops count as flat anchors (`standAt` already reads them
  as 'workbench'), and a room whose kind has a trade (smithy, workshop, kitchen) gets at least one set of its trade
  (KS-w-tools over the forge or bench, tools on the bench top, ingots or ore by the forge) before the household's
  favored places take the rest of the budget.
