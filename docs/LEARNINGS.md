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

## Second, closer read of VikingColonies (1.6.0)

A section-by-section read of the movement, jobs, free time and building code, after Villheim villagers still
wandered, stuttered and swung at trees from far away. Notes in my own words; nothing copied.

**Their villager never runs the monster brain.** The AI class sits on the game's base AI, which issues no movement of
its own. Ours sat on the monster AI, whose idle wandering ran whenever our code let go for a moment. Villheim now
keeps control every tick outside a fight and hands over only when an enemy is sensed (checked twice a second).

**The body is the player's.** Speeds, turn rates and acceleration come from the player prefab, so the jog animation
matches the real speed. They always jog on errands and only sprint when fleeing. Turning while walking
(`m_moveMinAngle` 90 with smooth movement) avoids stopping at every path corner.

**Walking rules.** Stop distance at least 0.8 m, stay arrived until 0.5 m past it, a path that ends early only counts
within 2 m, a fresh path only after a hop, sidestep or door. Nothing counts as stuck within 3 m of the goal.
Villagers and players pass through each other (collision pairs ignored, set again every couple of seconds, because
Unity forgets them). Animation-driven movement is dropped for villagers outside a real attack, so gestures and work
swings never slide them.

**Doors.** Used when the path dead-ends or a closed door is right ahead. Stand about a metre out, face the door, use
it, step straight through to 1.5 m beyond without a path (the navmesh still sees a wall for a while), close it 2 m
later once the doorway is clear.

**Reach is a hard gate on every swing, against the real surface.** Their workers measure to the actual shape (a ray
for a tree trunk's radius, a line with a radius for a log, a small box per rock section) and only swing within the
tool's range. Unity's closest point does not work on concave mesh colliders, and a big rock's bounding box can sit
metres from its face, which is how our villagers chopped from 15 m. Villheim now casts a ray at the collider itself.
They also face the target before swinging, land the blow partway through the animation, use the tool's real tier,
and pass the struck collider so big rocks take the hit.

**Jobs decide from facts on a slow clock.** Each tick a job picks one action from a fixed priority list and logs a
line when the action changes, which makes "does nothing" easy to explain. Villheim logs why a villager has no work
and shows it in the hover text.

**Free time is asked for, not left running.** Whatever wants a pose (sitting, dancing) asks every tick; when nothing
asks, the villager stands up. Activities are picked by weight from what is at hand every 30 to 90 seconds: seats,
fires, chats (pairs meet 1.6 m apart and take turns), strolls. The evening is a ring around the main fire where
every other one sits and the rest toast and laugh. Held poses are animator bools (`emote_sit`, `emote_dance`,
`emote_rest`, `emote_kneel`), gestures are triggers (`emote_wave`, `emote_cheer` and so on), and `emote_stop` ends a
held one.

**Mood does not drive their idle behaviour.** Their mood (0 to 100 from home, food, comfort, deaths and so on) sets
work speed and arrivals. Villheim uses its own village mood to weight free-time choices and gestures instead.

**Building.** Lowest supported piece first, restarting the search after every placement; a support check before
placing; the builder always outside the outline with a hard distance limit; never placing a piece where someone
stands; doorways kept clear.

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
