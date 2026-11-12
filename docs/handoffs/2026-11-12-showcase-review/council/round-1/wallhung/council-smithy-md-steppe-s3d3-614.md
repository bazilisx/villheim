VERDICT: PASS

Seat: wall-hung (track F). Checklist: `docs/handoffs/2026-11-12-showcase-review/criteria/wallhung.md`. Pass mark 85 of 100, no hard fail.
Score: 100 of 100, by default. Nothing hangs on anything in this building, so nothing can fail this checklist. Read the PASS that way.

## How it was measured

- `node lab/wallhung_measure.js` (main at a4282bc): 0 hung pieces.
- `node lab/audit_pool.js` on the design alone: every wall measure is 0 (wallOff, wallTurn, wallHalf, wallStack, mountClip, floats, overWin).
- `node lab/attach_measure.js`: 10 decor pieces (the forge and its four extensions, the workbench and its chopping block, two iron-banded chests, a wood stack), all standing on the floor within 3 cm.
- The shell has no wall pieces. It has 43 wood_pole2, 5 wood_pole, 23 wood_beam, wood floors and a hip roof: an open-sided forge shed on posts, with a lean-to on the back. The design name says "half-timber walls", but the blueprint has none. That is the shell seat's to judge.
- `lab/render_walls.js` has nothing to draw (no hung pieces). I looked at views.png.

## Hard fails

None (nothing hung).

## Scores

All 15 items score full because nothing is placed that could break them: 100 of 100.

## Walk-through

- An open forge shed: posts, beams overhead, the forge and its anvils and bellows along the back, a workbench at one end, and two chests at the other.
- Nothing hangs on the posts or beams. There are no tools on the wall over the workbench and no lights apart from the forge.
- In the corpus, no light in a smithy is a 30 % case, and no item stands a 67 % case (`data/rooms-corpus/kinds.json`, smithy: light in 70 % of rooms, itemstand in 33 %). So bare is allowed, and I do not fail it.
- The shed has no walls, so the generator had no place to hang anything. `lib/wallhang.js` plan() and `lib/stands.js` dressTops only look at wall faces.

## Rule changes (for every building)

1. **Posts and beams are places things are attached to.** Principle: what this seat judges covers anything attached, not only walls. An open building's posts and beams are where builders put a torch or hang a tool, and where a hanging light goes. Rule: `lib/wallhang.js` plan(face) takes wall faces only, and `lib/kitbash.js` anchorsOf lists wall, table, seat, chest, bed, counter and window anchors. Change: add post faces (a torch or a single stand at the lights' height on the side of a post that faces the work place) and beam spans (a hanging brazier or lantern at its corpus depth, via `hangFrom`) as anchors. Use them only where the room's light budget or stand pass asks for something and no wall is near. This needs a corpus count first: how often corpus smithies and open sheds put torches and stands on poles and beams (`walls.json` reads room wall faces only). Until that count exists, I would not add a check for it.
2. **The checklist needs a floor.** A building with nothing hung scores 100 here. A building with too little on its walls for its kind should lose points against the corpus share (for example, a home with no wall decor in any room, where 54 % of corpus home rooms have stands and 85 % have a light). That share belongs to the corpus-rooms seat's counts, so I raise it there and do not add it to this checklist on my own.
