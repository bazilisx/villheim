# What I learned from VikingColonies and Innangard

I read through the source of two village mods to see how they solve the same problems Villheim has. VikingColonies
(by DaAlmyte) publishes its source. Innangard (by Yololo) ships as a compiled plugin, so I read a decompiled copy.
Villheim takes ideas from both and keeps its own code. Nothing here is copied, and Villheim does not depend on
either mod.

These are the ideas I'm taking, in my own words, and what each one means for Villheim.

## Walking

**Both mods use the game's own pathfinding for walking.** Settlers call `BaseAI.MoveTo` and let the navmesh handle
the route. They add their own logic on top for the cases where the navmesh gives up.

**A goal only counts as new when it moves.** VikingColonies keeps a settler's current goal and only treats a new one
as different when it is more than a metre away. That stops a settler from re-planning every frame because the target
point wobbled a few centimetres. Innangard does the same thing when it approaches an object: it works out the spot
to walk to once per target and only redoes it if the target itself moves.

**Arriving uses two distances.** A settler arrives at the stop distance and only counts as "not there" again once it
is half a metre past that. Without the gap, a settler standing right at the edge flips between walking and stopping
every frame. That is the twitching we saw.

**Stuck settlers try to get loose before giving up.** VikingColonies watches whether a settler has moved half a
metre. After 3 seconds without moving he jumps and throws away his path. After 5 seconds he steps sideways for half
a second, checking first that the step doesn't go off a ledge or into water. He tries this twice before giving up on
the target.

**Decisions happen on a slower clock than movement.** Innangard only lets a settler change his mind every 0.3
seconds and turns him at a fixed rate. Walking still updates every frame. Scanning the world for a new target every
frame makes settlers jittery and costs a lot.

## Chopping and mining

**Stand next to the thing, then hit it.** Both mods work out a spot to stand first:

- A standing tree: a spot on the trunk's edge plus a short step back. The side matters, because a tree falls away
  from the axe. VikingColonies picks the side so the trunk falls clear of buildings.
- A log on the ground: beside the log at the point closest to the settler, on the uphill side so it doesn't roll
  onto him.
- A stump or rock: the near side.

The settler walks to that spot, stops, faces the target, and swings. If he can't reach the spot after a while, the
target is set aside for a few minutes and he picks something else.

**Set-asides expire.** Unreachable trees, rocks and drops go on a list with a time limit. Innangard makes the time
longer for targets that keep failing.

## Building

**Builders stand outside the building.** VikingColonies works out the building's outline and puts a ring of standing
spots a metre outside it, about a metre and a half apart. The builder walks to the ring spot closest to the next
piece.

**Lowest pieces first, nearby pieces first.** Innangard builds the lowest piece that has support, and among pieces at
the same height it prefers ones the builder can already reach from where he is standing. That keeps him from running
back and forth across the site.

**Each piece takes a few swings.** Innangard gives each piece a few seconds of hammering before it appears, sped up
by skill. That reads much better than a piece popping in on every swing.

**Nothing goes where someone is standing.** Both mods check whether a player or settler stands where a piece will go
before placing it.

## Roads and paths

**Roads come from a grid search.** Innangard lays a grid over the area between two places, gives each cell a cost
(steeper ground and swamp cost more, water and mountains are off limits, existing road is cheap), and runs A* over
it. Then it simplifies the result into a few straight runs. Because existing road is cheap, new roads join old ones
and the network grows into something that looks planned.

For Villheim this replaces the L-shaped paths. A new building's path searches toward the hearth over a small grid,
avoids other buildings' footprints, prefers ground that already has a path, and joins the network wherever that is
cheapest.

## Newcomers and housing

**People arrive for free beds.** VikingColonies checks once a day, in daylight. If there are free beds and food in
the town hall chest, newcomers walk in from the edge of the colony. Villheim will count the real beds in its buildings,
only let people arrive by day, and have them walk in from the village edge.

## Free time

**Settlers have an evening.** VikingColonies settlers sit on benches, sit by the fire, stroll, and chat with each
other, choosing something new every 30 to 90 seconds. Villheim already sends villagers to the hearth at night. Sitting
on the village's own benches and by its fires is a later step.

## Plan

First round (this round):

1. A shared walker for villagers: steady goals, two-distance arrival, jump and sidestep when stuck.
2. Stand spots for trees, logs and rocks, worked out once per target. Trees are felled away from the village.
3. Builders stand on a ring outside the building and hammer each piece for a couple of seconds.
4. Grid-searched paths that join the existing network.
5. Newcomers need a free bed, come by day, and walk in from the edge.

Later:

- Free time at benches and fires in the evening.
- Builders carrying materials from a village chest.
- Ghost previews of the next building.
- Roads between villages.
