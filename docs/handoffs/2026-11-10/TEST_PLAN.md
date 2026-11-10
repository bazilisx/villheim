# Test plan for Tyler, once the build is on main

One build holds everything. Use `vh version` to confirm the hash the next session gives you. LagLog and DebugLog
stay on.

## A. Why they could not build (old village first, about 10 minutes)

1. Load the world with Neuftot. Stand near the hearth and wait two minutes.
2. Look at the hearth. If the hall still has no room, the hover text says why and what would help.
3. Tell the session, so it can read the log line "No room ... In the way:". That line names what blocked the plots.
4. Watch whether the village starts a workshop, storehouse or home while the hall waits.
5. If a plot is chosen across the ring fence or an old ruin: the fence or ruin pieces on the plot should go, and
   the chest should gain some wood.

## B. A new village (about 20 minutes)

1. Start a test village on ground with rocks, stumps and a ruin or lean-to nearby.
2. Buildings should stand closer than before, never touching, with a path's width between them, and none nearer
   than about 4.5 m to the hearth's dirt circle.
3. Small rocks, stumps and bushes under a new building should be gone. A boulder the size of a house should be
   left alone and built round.
4. `vh grow` a few times: each building should find a place within a few seconds, with no freeze.

## C. Tools and jobs (about 10 minutes of watching)

1. A villager decorating a home keeps the hammer out until done.
2. A miner keeps the pickaxe out from rock to rock.
3. A tool goes away about 2.5 s after the work stops, and at once for bed.
4. Hover a working villager for a minute: the text should stay on one job through its steps.
5. Afterwards the session counts "Loop watch" and "[hands]" lines in the log.

## D. Choosing a spot by hand (about 5 minutes)

1. While a building is planned, walk to open ground and run `vh plot check`. It names the building, its size, and
   whether it fits there and why.
2. `vh plot here` on a spot that fits. The village should break ground there next, door toward the hearth.
3. `vh plot here` on a bad spot (on a home, in water): it should refuse with the reason.
4. `vh plot clear` gives the choice back to the village.

## E. Storehouse (after `vh testpool make` or a new pool copy)

1. Build the storehouse to d2 or d3 (`vh decor now`).
2. Some chests along the walls should have a second chest on top, and each wall with chests should carry a sign.
3. Chests should not clip each other, the walls or the signs.

## F. Lag

1. Play 15 minutes near a village with the game in front (a background window gives false numbers).
2. Say when it stuttered, if it did. The session ranks the "Lag:" lines and compares with last night's table.
