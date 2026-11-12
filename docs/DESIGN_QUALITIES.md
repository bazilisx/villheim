# Design qualities

What a good Villheim building and village is like, in Tyler's words. This is the measure for generated designs and
for judging them. It describes qualities to reach everywhere; it is not a list of bans. Corpus numbers (D-136) say how
builders reach each quality; Tyler's few hard rules are listed at the end.

Sources: `docs/handoffs/2026-11-12-showcase-review/TYLER_NOTES.md` (TN), the Decisions tab (D-###), chat.

## 1. Every choice has intent

Every room has a purpose and every piece in it has a reason tied to that purpose and to who lives there. Variety comes
from kitbashing purposeful sets, never from scattering.

- "My hope is that rooms have intent, and the furniture arrangement has intent within those rooms." (TN)
- "Not random in a good way, like kitbashing different prefab clusters together. It feels like just throwing things
  down hodgepodge." (TN)
- "Could there be a single planter outside a kitchen window? Sure, someone's growing herbs. But that's how the
  justification for these choices could come from: intent." (D-167)

## 2. Lived in

Rooms read as used by particular people: things mid-use, the clutter of a household near where it is used, a story
of who lives there. Bare rooms and empty wings fail this as surely as clutter without reason.

- "lived-in clutter and beauty... alive, lived in, homey, cosy" (TN, on the WoW housing house)
- Items on stands that are "random and meaningless" and "repeative and meaningless" fail it (TN, 2026-11-12).

## 3. Consistent, with thematic ties

A building follows one program: features chosen for a facade, a storey or a run go on the whole run; a room keeps
its materials and colors together. Exceptions carry a reason from the room behind them. A village shares one
vernacular with variation inside it.

- "windows in a row would all have the same feature... This applies to all architectural decisions... Intent.
  Consistency. Thematic ties. Not random thrown at the wall arbitrary decisions." (D-167)
- "we should aim to have the same wood color or material in a room... Cohesion among the lived-in clutter is
  something to consider. But dont treat this as law or a hard rule" (TN)

## 4. Varied, never repetitive

Across buildings and within one, pieces and sets vary the way builders vary them. The same torch, candles, drapes,
benches or stacked chests in every building fails this.

- "You seem to get fixated with reusing and reusing and reusing the same elements" (TN)

## 5. Movable and reachable

A person can walk in, through and around: into every room, around furniture to what it serves, up every stair.
Nothing crowds a doorway or the space just inside it.

- "a player or npc must be able to navigate around the table to the bed or vice versa... Defeats the purpose of a
  house if things are being forced in" (D-148)
- "egress and room movement should always allow someone to move into rooms and explore" (D-152)

## 6. Built the way it would stand

Pieces rest on, hang from or attach to what holds them, face the right way, join as builders join them, and stand by
the game's own support rules. Roofs read as one roof over the whole building.

- "Signs and stands and sometimes lights that werent touching walls and were a foot or more away" (TN)
- "gaps in wall before roof", roof pieces that "dont connect" (TN)

## 7. Each piece where it belongs

A piece is chosen for how it looks and where builders use it: indoor, outdoor, rooftop, pasture, hall or kitchen;
fine or rustic; its material and color beside its neighbors. Never by its name string.

- "My hypothesis is that you place things based on their naming string. You cannot do this." (TN)

## 8. Scaled to its purpose

Size and proportion follow what the building and each room hold. A small building is right when it is complete,
warm and intimate; a large hall when it is grand and well filled. Undersized means its purpose does not fit.

- "charming, small, cozy" (TN, smithy 13) names this quality, not a size rule.
- "exceptionally tight, almost too tight to walk around" (TN, home 08)

## 9. Growing with the village

Buildings, greenery and the village as a whole grow through the stages, from a camp to a dense small city with
landscaping (D-138, D-153, D-158). The hub is the hearth, the village's town hall, on its own central plot (D-154).

## How the qualities are used

- **Generating:** the corpus says how builders reach each quality (ranges, not thresholds), and the building's
  purpose, culture and household decide where in those ranges a design falls.
- **Judging:** a design passes when it has these qualities as a person walking through it would see them. Checklists
  and audits explain why a design falls short; they never pass a design that lacks a quality.
- **Feedback:** when Tyler points at one thing, read the quality behind it, say it back in one line with where else
  it applies, and fix the cause everywhere (CLAUDE.md, "Examples are symptoms").

## Tyler's hard rules

The few rules that hold whatever the corpus shows or a quality suggests, each from his words. Each is measured once by
the lab's shared checks (`lib/checks.js`), and breaking one fails a design on its own (`docs/HELPER_RULES.md`).

- Passages are at least two wood_floor pieces wide; one piece only for a closet or a hidden passage (TN).
- A person can walk into every room and around furniture to what it serves; nothing blocks a doorway or the space just
  inside it (D-148, D-152).
- Every piece is supported or attached as it would be when placed, by the game's own rules (CLAUDE.md building order).
- wood_fence stays on the ground in pastures, gardens, yards and at village edges; never indoors, on porches, lofts,
  balconies or towers (D-164).
- No woodpile or wood stack pieces by indoor hearths (D-163).
- Vanilla pieces only; no new models or textures (D-013). Building pieces follow the biome (D-125).

Order of precedence: these rules, then what the corpus shows, then judgment (CLAUDE.md, "Sources and records").
