# Design review guide

How to review, edit and save village designs in the game. Kept up to date as the tools change. Everything here is
typed in the in-game console (F5) unless it says otherwise.

## Where we are

1. **Pass 1 (done).** Every design (963) got Yes, Yes with edits or No in the Review tab of the review sheet. 264 were
   kept.
2. **Sorting the 264 kept designs, in small steps (from 2026-11-07).** The old Pass 2 plan (use, biomes and level all
   at once) is replaced by these phases. Everything is done in the game; the sheet keeps the record.
   - **Phase A, type (now).** Each design is Home (anything people live in), Work (anything that keeps the village
     running: farms, woodworking, mining and smithing, cooking and brewing, crafting, storage, defence such as guard
     houses, fences and barracks) or Community (third places for social and idle time: the hearth, taverns,
     longhouses). Drop means the design is not used. Sort knife A.
   - **Phase B, subtype.** Work and Community designs only. Work: Farming, Woodworking, Mining, Cooking, Crafting,
     Storage, Defence. Community: Hearth, Tavern, Longhouse. Sort knife B.
   - **Phase C, biome.** Each design gets the biome it suits best, and its materials are fixed for that biome with the
     Shaper Tool inside a marked plot.
   - **Slotting.** Designs of one biome and subtype are put side by side and grouped under one base ID, each in a
     structure stage: house1_s1, house1_s2, house1_s3. The base ID and stage are given here, not earlier.
   - **Phase D, decor.** Each structure stage gets three decor stages, made from the richest down: d3 is saved first,
     copied to the d2 plot and stripped, saved, copied to d1 and stripped to the bare minimum.
   - **Phase E, review rows.** One base ID in one biome laid out in a row, s1d1 to s3d3, to check how it grows.
3. Saves from the old pass 2 (`p3-<number>-<name>`) stay where they are and are used as the starting point of a design.

## Naming

Blueprints get their final name once slotting has given them a base ID: `<baseID>_s<structure>d<decor>`, for example
`house1_s2d3`.

- **Base ID:** a short root and a number, for one building in one biome: house1, farm2, woodshop1, smithy1,
  cookhouse1, workshop1, storehouse1, guardhouse1, hub1 (the hearth), tavern1, longhouse1. The biome is not in the
  name; the sheet keeps it, so a Black Forest version of a Meadows house is a new base ID.
- **s1, s2, s3:** the structure stage. A new stage comes when the village moves up a stage: an added room, a second
  floor, a wing, a bigger yard. In the game the old building is taken down and the next stage built in its place.
- **d1, d2, d3:** the decor stage, interior and yard only. d1 is sparse (a bed, perhaps a plain table and chair); d2
  is furnished (a crafting station, small decor, more lights, an early rug); d3 is rich (rugs, drapes, glass windows,
  plants, a tended garden along the walls, wall hangings, tables set with food).
- Until slotting, a design is known by its design number (`0283`), which never changes.

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
9. For sorting (phases A and B) take a sort knife instead: `vh sort tools` the first time.

## Sorting in the game (phases A and B)

Sort knife A is the vanilla flint knife and sort knife B the copper knife (config SortToolA and SortToolB), renamed
**Villheim Sort Tool A: Type** and **Villheim Sort Tool B: Subtype**; A glows amber, B purple. `vh sort tools` puts
both in your inventory. Keep them on quick slots next to the Shaper Tool.

With a sort knife in hand, the hotbar keys pick a choice (the slot shows as selected; the same key again puts it
down) and **left click** on any piece or the sign of a design, up to 80 m away, gives that design the choice. Aiming
at a design shows its number, name and current sort at the top left.

| Key | Knife A (type) | Knife B, aiming at a Work design | Knife B, aiming at a Community design |
|---|---|---|---|
| 1 | Home | Farming | Hearth |
| 2 | Work | Woodworking | Tavern |
| 3 | Community | Mining | Longhouse |
| 4 | Drop | Cooking | |
| 5 | | Crafting | |
| 6 | | Storage | |
| 7 | Clear (back to unsorted) | Defence | Clear |
| 8 | Undo (each press takes back one choice) | Undo | Undo |

- The first line of each sign shows the sort in colour (grey Unsorted, green Home, purple Work, teal Community, red
  Drop), and the big number above the sign takes the same colour, so the field shows what is left to do.
- Changing a design's type clears its subtype.
- Every choice is kept in `BepInEx/Villheim/design-sort.csv` and, once the sheet address is set, written to the Pass
  2 tab at once.
- Pages by sort: `vh gallery keepers type work` (or `home`, `community`, `drop`, `unsorted`, `nosubtype`, or a
  subtype such as `farming`). Phase B: `vh gallery keepers type nosubtype` shows only the work and community designs
  still without a subtype.
- `vh sort` shows the counts and the sheet's last answer; `vh sort undo`; `vh sort push` sends every choice to the
  sheet again.

### Connecting the game to the sheet (once)

1. In the sheet: Extensions, Apps Script. Replace everything there with `scripts/review-sheet.gs` and save.
2. Deploy, New deployment, type **Web app**. Execute as: **Me**. Who has access: **Anyone**. Deploy, then allow access
   when Google asks.
3. Copy the web app address (it ends in `/exec`). Opening it in a browser should show `{"ok":true,...}`.
4. In the game console: `vh sort url <the address>`. From then on every choice goes to the sheet. `vh sort push`
   sends what was sorted before.
5. Keep the address to yourself: anyone who has it can write the Type and Subtype columns.
6. When `review-sheet.gs` changes: paste it again, then Deploy, Manage deployments, edit, Version: New version. The
   address stays the same.

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

The shaping knife is the vanilla wooden knife (`KnifeWood`, config ShapingTool), renamed **Villheim Dev Shaper Tool**
(on the ground, in the inventory and on the hotbar). How it looks in hand and on the ground is chosen in F1 (see
Settings); its icon is tinted the same colour in the inventory and on the hotbars. With it in hand, hotbar keys 1 to 8
stop using items and become the editing tools, with their own icons and labels. **Press a key to pick a tool** (its
slot shows as selected), then **left click to use it**; your character makes the hammer's building swing, and one
click is one action. Press the same key again to put the tool down. Swap is picked when you take the knife out. Put the knife away (press its quick
slot again, or take another tool) and the hotbar is back to normal.

| Key | Label | Left click does |
|---|---|---|
| 1 | Move | You stand still (flying too). The design you aim at is highlighted, and **W A S D** move it away, left, back, right (as you look), **E** up, **Q** down. 10 cm a press, Shift for 50 cm. Click a structure to lock onto it: then only that is highlighted and moves. Click it again to let go, or click another structure to switch. Press 1 again to walk. |
| 2 | Turn | You stand still. The design you aim at is highlighted and the **mouse wheel** turns all of it about the middle of its plot. Click one object to lock onto it: then only that turns. Click it again to let go. Press 2 again to walk. See Turning below. |
| 3 | Swap | Click a design piece: pick it and put up stand-ins at its sign. Click a stand-in (or a piece you built): use it. |
| 4 | Delete | Click removes what you aim at within 6 m: pieces, creatures, traders and other NPCs. Never a player. |
| 5 | Del all | Click something (a dvergr lantern, say): every object with that exact name in that design is highlighted and the screen asks "Delete all 14 ...?". Click again within 6 seconds to delete them all; otherwise the highlight fades and nothing is deleted. Outside a design it takes everything of that name within 20 m. |
| 6 | Save | Click anything of a design: it is highlighted and the label turns "Save?". Click again within 6 seconds to save it as it stands. |
| 7 | Reset | Click anything of a design: it is highlighted and the label turns "Reset?". Click again within 6 seconds: the design is taken down (with anything built on its plot) and put up again as the gallery shows it, from its pass 3 save if it has one, otherwise as its creator built it. Its swaps and moves are forgotten. For the creator's original of a saved design, `vh bp forget <number>` first. |
| 8 | Undo | Pressing 8 takes back your last change, one per press (up to 50): a delete or Delete all (the objects come back), a move step, a turn, a swap, a reset. Clicking does nothing. |

Every highlight of the knife (what you aim at, the design Move or Turn works on, a locked structure or object, Delete
all's marks) is the one colour set by LookColor.

### Turning (key 2)

| Input | Nothing clicked: the whole design turns | One object clicked: only it turns |
|---|---|---|
| Mouse wheel | about the up axis, round the middle of its plot | about the up axis, on its own pivot |
| Shift + wheel | tilts about the plot's X axis | tilts about its own X axis |
| Alt + wheel | tilts about the plot's Z axis | rolls about its own Z axis |
| Ctrl + wheel | (as the wheel) | every object of that name in the design, each on its own pivot |

- A ring shows the axis the wheel will turn about: green for up, red for X (Shift), blue for Z (Alt). Hold the
  modifier to see its ring before turning.
- One notch is 22.5 degrees (ShaperTurnStep).
- The camera does not zoom while Turn has something to turn. Aim at the sky or pick another tool to zoom.
- One press of 8 undoes a whole run of wheel notches on the same design or object.
- Turns are kept when the design is saved, and a turned design counts as changed for `vh bp save page`.
- `vh swap turn` still gives the current swap choice a quarter turn everywhere in the design.

While the knife is in hand, look is always on: what you aim at (within 4 m) is highlighted and its name shows in the
middle of the screen, with what it stands in for if it is a stand-in. Full details go to the console and
`looked-at.txt`.

Everything below about swapping, moving and saving works the same with the knife or with typed commands.

## Swapping pieces (`vh swap`)

With the knife: pick Swap (key 3) and left click. Without it: turn on `vh swap`, and the swap key is **numpad 5** (middle mouse
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
3. **Fix it:** turn pieces with Turn (key 2, click the piece, mouse wheel), or `vh swap turn` for a quarter turn of
   the current choice everywhere in the design. `vh swap undo` (key 8) takes back the last change.
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
  it, for example a hut beside a hall). While Ctrl is held, the numpad moves only the green pieces. (With the knife in
  hand, Ctrl belongs to Turn; use Move (key 1) and click instead.)
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

- Columns: page, design number, name, pieces, built as (the stage of its materials), Type, Subtype, Biome, Base ID, s,
  note, link to the original. Type and Subtype are filled from the game; Biome, Base ID and s come in later phases.
- The top bar counts sorted designs and subtypes. One page at a time (the sheet script hides the rest): tick the box
  after "next ▶" to go on, the box after "◀ back" to go back, or type a page number in the white box.
- The old guesses (kind, use, biome ticks, level) were removed on 2026-11-07; every design starts unsorted.

## Settings (F1, section "4 - Design review")

- **ShapingTool:** which item is the shaping knife (`KnifeWood`).
- **ShaperHandEffect:** how the knife looks in hand while shaping: None, Glow, Fire, Frost, Spirit, Lightning (default:
  small teal Lightning with zaps). Changes show at once; the effect is on the knife only.
- **ShaperGroundEffect:** how it looks on the ground: None, Glow, Beam (a tall light column, like magic loot), Beam and
  Glow, Fire, Frost, Spirit, Lightning.
- **ShaperColor:** colour of Glow and Beam (and the icon tint).
- **ShaperEffectScale:** size of Fire, Frost, Spirit and Lightning on the knife (0.205; 1 is sword size).
- **ShaperEffectStrength:** how many particles and how bright (0.561; lower is subtler).
- **ShaperEffectBursts:** on keeps the periodic zaps (default on); off leaves only the steady sparks.
- **ShaperEffectBurstScale:** with bursts on, the size and reach of the zaps (0.592; lower is tinier, 1 is as the weapon has them).
- **ShaperEffectTint:** on colours Fire, Frost, Spirit and Lightning with ShaperColor (teal lightning).
- **ShaperTurnStep:** degrees per mouse wheel notch for Turn (22.5).
- **LookColor:** the colour of every highlight while shaping (what you aim at, the design being moved or turned, locked
  parts, Delete all's marks). Default a soft teal (#2172651E). Darker or more see-through is subtler.
- **SortToolA / SortToolB:** which items are the sort knives (`KnifeFlint`, `KnifeCopper`).
- **SortSheetUrl:** the sheet's web app address (`vh sort url` sets it).
- **GallerySwapKey:** the swap key without the knife (numpad 5).
- **GallerySwapBiomes:** which biomes stand-ins come from, e.g. `meadows,blackforest,swamp,plains`.
- **GalleryNumberText:** size and height of the floating number over each sign.

## Files to send to Claude

| File (in the profile's `BepInEx` folder) | Why |
|---|---|
| `Villheim/design-sort.csv` | Every sort choice (if the sheet is not connected). |
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
| `vh sort tools` | Puts both sort knives in your inventory. |
| `vh help` | Every Villheim command. |
