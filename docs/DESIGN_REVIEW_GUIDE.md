# Design review guide

How to review, edit and save village designs in the game. Kept up to date as the tools change. Everything here is
typed in the in-game console (F5) unless it says otherwise.

## Where we are

1. **Pass 1 (done).** Every design (963) got Yes, Yes with edits or No in the Review tab of the review sheet. 264 were
   kept.
2. **Pass 2 (now).** Look at the 264 kept designs in the game, 50 at a time, swap pieces by hand, move things, save
   the ones worth keeping, and fill in the Pass 2 tab (what each design is for, which biomes it suits, village level).
3. **Pass 3 (next).** Make decor tiers (a1, a2, a3) and upgrade levels (a, b, c) from the pass 2 saves.

Review sheet: https://docs.google.com/spreadsheets/d/1rHaZArWhEa8V43UTZePM9EQSBwS6bvjsmAFPhnlQs6o/edit

## Starting a session

1. Start the updater in PowerShell and leave the window open:

   ```
   irm https://raw.githubusercontent.com/bazilisx/villheim/main/scripts/Villheim-Updater.ps1 | iex
   ```

2. Start Valheim (r2modman profile "Villheim Test") and load the test world with the flat meadow (vhtest5).
3. Check the build: `vh version`. It should match the newest commit the updater reported.
4. Optional cheats that make reviewing easier (vanilla commands, need `devcommands` first):
   - `devcommands` turns cheats on.
   - `god` so nothing kills you, `ghost` so creatures ignore you.
   - `debugmode`, then Z to fly and B to build without materials (handy for building stand-ins).
   - `pos` shows your coordinates; `goto <x> <z>` takes you back to a spot. Write down the coordinates of the near edge
     of the flat meadow once, so you can return with `goto`.
5. Go to the near edge of the flat meadow and face into it. Pages are laid out in front of you from where you stand
   (or on the area last made with `vh flatten`, if that is within 600 m).
6. Clear anything left from last time: `vh gallery clear`.
7. Put up a page: `vh gallery keepers` (page 1), or `vh gallery keepers page 3`.
8. Take the shaping knife in hand (see Shaping below). The first time, `vh tool` puts one in your inventory; keep it on a
   quick slot (V or C). Typed commands (`vh swap` and the numpad) still work without it.

## Showing designs

| Command | What it does |
|---|---|
| `vh gallery keepers` | The 264 kept designs, 50 a page, by piece count, as their creators built them. Page 1 of 6. |
| `vh gallery keepers page N` | Page N. The Pass 2 tab of the sheet has the same pages. |
| `vh gallery next` / `prev` / `again` | Clear the page and put up the next, the one before, or the same one again. |
| `vh gallery keepers size 25` | Smaller pages (any number up to 150). The sheet assumes 50. |
| `vh gallery clear` | Remove every gallery piece and sign within 600 m. The ground stays as it is. |
| `vh gallery show <name>` | Put up one design by name, e.g. a saved copy. |
| `vh gallery keepers as meadows` | Optional: put the page up with every later-stage building piece swapped automatically. Not needed for the hand review. |

Each design has a sign in front: kind, stage, name, design number, creator, and a big floating number above it. A
design saved earlier goes up from its save and its sign says "edited (pass 3 save)".

Walk along the rows: far parts of a page only go up once that part of the world has loaded. The message "page ready"
means everything is up.

## Shaping: the knife and the hotbar

The shaping knife is the vanilla wooden knife (`KnifeWood`, config ShapingTool). It glows teal while shaping, so it
reads as the shaping tool. With it in hand, hotbar keys 1 to 8 stop using items and
become the editing tools, with their own icons and labels. Put the knife away (press its quick slot again, or take
another tool) and the hotbar is back to normal.

| Key | Label | What it does |
|---|---|---|
| 1 or left click | Swap | Aim at a design piece: pick it and put up stand-ins at its sign. Aim at a stand-in (or a piece you built): use it. |
| 2 | Turn | Quarter turn for the current choice. |
| 3 | Undo | The original piece back. |
| 4 | Move | Toggle Move. You stand still; **W A S D** move the design away, left, back, right (as you look), **E** up, **Q** down. 10 cm a press, Shift for 50 cm. The label shows "Move ON". |
| 5 | Part | Pick the structure you aim at (it turns green). While Part is on, Move moves only that structure. 5 again lets go. |
| 6 | Delete | Removes what you aim at within 6 m: pieces, creatures, traders and other NPCs. Never a player. |
| 7 | Save | Saves the design you aim at as it stands. The label turns "Save?"; press 7 again within 6 seconds to save. |
| 8 | Del all | Aim at something (a dvergr lantern, say): every object with that exact name in that design glows orange and the screen asks "Delete all 14 ...?". Press 8 again within 6 seconds to delete them all; otherwise the orange fades and nothing is deleted. Outside a design it takes everything of that name within 20 m. |

While the knife is in hand, look is always on: what you aim at (within 4 m) glows orange and its name shows in the
middle of the screen, with what it stands in for if it is a stand-in. Pieces of a green Part stay green. Full details
go to the console and `looked-at.txt`.

Everything below about swapping, moving and saving works the same with the knife or with typed commands.

## Swapping pieces (`vh swap`)

With the knife: key 1 or left click. Without it: turn on `vh swap`, and the swap key is **numpad 5** (middle mouse
removes pieces when the hammer is out, so it is not used).

1. **Pick a piece:** aim at a piece of a design (within about 4 m) and press numpad 5.
   - In front of that design's sign, stand-ins go up in groups by biome: Meadows, Black Forest, Swamp. Each group has
     a label sign and up to 4 single pieces, best match first.
   - Where the piece's name gives a size (like `_2x2`), each group can also show up to 2 combinations, such as two
     `stone_wall_2x1` stacked for a 2x2 wall.
   - The top left lists what was put up.
2. **Choose a stand-in:** aim at one and press numpad 5. Every piece of that kind in that one design changes to
   it. Nothing else in the gallery changes.
   - Click other stand-ins to compare; the last one clicked stays.
   - Clicking any piece of a combination takes the whole combination.
   - You can also build your own stand-in with the hammer, somewhere open, and click it. Pieces you built that touch
     it come along as a group (up to 20): two fences side by side can stand in for a wall twice as wide.
3. **Fix it:** `vh swap turn` gives the current choice a quarter turn (repeat as needed). `vh swap undo` puts the
   original back.
4. `vh swap done` removes the stand-ins. `vh swap off` ends swap mode.

Nothing you swap is kept until you save the design (see Saving). Putting a page up again without saving shows the
originals.

## Moving designs without the knife (with `vh swap` on)

| Key | Moves |
|---|---|
| Numpad + / - | up / down |
| Numpad 8 / 2 | away from you / towards you |
| Numpad 4 / 6 | left / right |
| Shift with any of these | 50 cm instead of 10 cm |

- Without Ctrl: moves the whole design you aim at (or the one you last picked), with its stand-ins and anything you
  built on its plot. Use this for designs that float because their lowest pieces were meant to sit in the ground.
- Hold Ctrl and aim at part of a design: that structure turns green (the piece and everything of the design touching
  it, for example a hut beside a hall). While Ctrl is held, the numpad moves only the green pieces.
- The arrow keys and Page Up/Down also work.
- A design's height change is saved with it and used every time it goes up again.

## Other editing

- **Remove pieces:** with the hammer, as normal. Removed pieces are left out when the design is saved.
- **Add pieces:** build inside the design's plot with the hammer. Anything built on the plot is saved with the design.
- **Names of things:** `vh look` (again to turn it off). Aim at anything within 4 m: the top left shows its name, kind,
  size, stage and what it would swap to. Each new name goes to `BepInEx/Villheim/looked-at.txt`.
- **Notes for Claude:** `vh note <text>`, for example `vh note needs a door on the left side`. It records the time,
  what you are aiming at and the nearest design sign in `BepInEx/Villheim/notes.txt`.

## Saving

| Command | What it does |
|---|---|
| `vh bp save <number>` | Saves one design as it stands now: its pieces that are left, its stand-ins, anything built on its plot and its height. The design must be standing near you. |
| `vh bp save page` | Saves every changed design of the page that is standing near you. Stand near the middle of the page first: the far ends may not be loaded. The message says how many were saved. |
| `vh bp save page all` | Saves every design of the page near you, changed or not. |
| `vh bp forget <number>` | Deletes the save of one design, so the gallery shows the original again. `vh bp forget all` deletes every save. |

- Saves are named `p3-<number>-<name>`, for example `p3-0283-WoodHouse8`, and go to
  `BepInEx/config/Villheim/blueprints/inspiration/pass3/`. Saving again replaces the earlier save.
- Everything saved is listed in `BepInEx/Villheim/pass3-saved.csv`.
- Saves are for review only: villages do not build them yet. Pass 3 starts from these files.

## The Pass 2 tab of the sheet

- One page at a time (the sheet script hides the rest). Tick the box after "next ▶" to go on, the box after "◀ back"
  to go back, or type a page number in the white box.
- The top bar shows the in-game command for the page.
- For each design: Use for (home, central hub, longhouse, a trade and so on, or Drop), tick the biomes it suits,
  village level 1 to 4, and a note.
- The sheet script (`scripts/review-sheet.gs`) is pasted once into Extensions, Apps Script.

## Settings (F1, section "4 - Design review")

- **ShapingTool:** which item is the shaping knife (`KnifeWood`).
- **GallerySwapKey:** the swap key without the knife (numpad 5).
- **GallerySwapBiomes:** which biomes stand-ins come from, e.g. `meadows,blackforest,swamp,plains`.
- **GalleryNumberText:** size and height of the floating number over each sign.

## Files to send to Claude

| File (in the profile's `BepInEx` folder) | Why |
|---|---|
| `Villheim/pass3-saved.csv` | What you saved, for the sheet. |
| `Villheim/notes.txt` | Your notes from the game. |
| `Villheim/looked-at.txt` | Names of pieces you looked at, to set better stand-ins. |
| `LogOutput.log` | When something goes wrong. |

## When something looks wrong

- **Commands behave like an older version:** check `vh version` and let the updater finish. A running gallery from an
  older build keeps going until the game restarts.
- **A swap or save does nothing for a page put up before an update:** put the page up again (`vh gallery again`)
  before editing; new features often need the new signs.
- **Pieces float or sink:** move the design with the numpad and save it.
- **A page save missed designs:** stand nearer the middle of the page, or save the missing ones by number.

## Other commands

| Command | What it does |
|---|---|
| `vh report` | Writes the list of every design (`BepInEx/Villheim/design-list.csv`). Numbers never change once given. |
| `vh gallery page N` | Every design (not only the kept ones), 10 a page. |
| `vh bp swap <number> <stage>` | Saves a copy with every later building piece swapped automatically (to `inspiration/edits`). |
| `vh flatten [size]` | Clears and levels an area in front of you for the gallery. Usually done with PlanBuild instead. |
| `vh tool` | Puts the shaping knife (a wooden knife) in your inventory. |
| `vh help` | Every Villheim command. |
