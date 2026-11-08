# Villheim

NPC villages for Valheim that grow over time, inspired by Millénaire for Minecraft.

Every village is made from things that are already in the game. Buildings are copied from Valheim's own locations (the Meadows houses and farms, the Black Forest cabins), and villagers use the vanilla player model with vanilla hair, beards, clothes and tools. The mod adds no models, textures or building designs of its own. Locations added by other mods, such as More World Locations, can be used as designs too.

> **Status: in development.** Villages found, gather and build in game. Goals and progress are in [docs/ROADMAP.md](docs/ROADMAP.md); working notes for contributors are in [CLAUDE.md](CLAUDE.md) and [docs/](docs).

## What it does

- The world generator places village sites in the Meadows and Black Forest. Each site starts as a single hearth.
- When you first come near a site, the village is founded: it gets a name, builds its first building and a couple of settlers arrive.
- Every couple of in-game days the village raises another building, picked from a pool of existing designs and placed on a free, fairly flat spot around the hearth. Trees and rocks are cleared and the ground is leveled the way the original location levels it.
- More buildings support more villagers. New villagers arrive over time and replace any that die.
- Villagers wander around their home building by day and gather at the hearth at night. They greet you, chat, fight off monsters, and only turn on you if you attack them.
- Villages only grow while a player is nearby, but they catch up on missed time when you return (one building every few seconds until they are up to date).

Village sizes, using the buildings count: Camp (1), Hamlet (2 to 3), Village (4 to 6), Town (7 or more).

## Installing

Requirements:

- [BepInExPack Valheim](https://thunderstore.io/c/valheim/p/denikson/BepInExPack_Valheim/)
- [Jötunn](https://thunderstore.io/c/valheim/p/ValheimModding/Jotunn/)

Copy `Villheim.dll`, `Villheim.Logic.dll`, `Jint.dll`, `Acornima.dll` and `System.Runtime.CompilerServices.Unsafe.dll` into `Valheim/BepInEx/plugins/Villheim/`. The last three run the building generator (`vh gen`). In multiplayer, the server and every player need the mod.

You can get a built `Villheim.dll` from the **Actions** tab of this repository: open the latest successful "Build" run and download the `Villheim` artifact. It also contains the files Thunderstore expects (except an icon).

## Getting a village

- **New world:** village sites are placed when the world is generated.
- **Existing world:** open the console (F5) and run `genloc`. This places new locations, including village sites, in areas you have not explored yet.
- **Right now:** run `devcommands`, then `villheim_found` to light a hearth in front of you.

## Console commands

| Command | Needs devcommands | What it does |
|---|---|---|
| `villheim_found` | yes | Lights a new village hearth in front of you. |
| `villheim_grow` | yes | Makes the nearest village start its next building now. |
| `villheim_preview <location>` | yes | Builds one design in front of you, outside any village. Good for checking how a design looks. |
| `villheim_info` | no | Shows every loaded village, its buildings and its population. |
| `villheim_designs [meadows\|blackforest]` | no | Lists the designs a village of that biome can build. |
| `villheim_locations [filter]` | no | Lists every location name in the game, including other mods' locations, so you can add them as designs. |
| `villheim_dump <location>` | no | Writes everything inside a location to the BepInEx log, and whether Villheim keeps or leaves out each object. |
| `vh gen <biome> <type> <stage> [culture] ["request"] [seed]` | yes | Makes a new building with the blueprint lab's generator and builds it in front of you, e.g. `vh gen md home s1d3 "two storeys with a porch"`. Saves it to `PlanBuild/blueprints/inspiration/generated/ingame/`. `vh gen help` lists the codes. |
| `vh ask <biome> <type> <stage> [culture] "request"` | yes | Saves the request to `BepInEx/config/Villheim/requests/requests.jsonl` for Claude to make with more care. |
| `vh asks` | yes | Lists those requests and their status. |
| `vh place <id\|name> [here]` | yes | Builds a finished request (`R-0001`) or a design made with `vh gen` in front of you; `here` builds a request where you stood when you asked. |
| `vh village spawn [stage] [villagers] [buildings] [culture] [biome] [options]` | yes | Sets up a whole village in front of you at once, at a stage (camp, hamlet, village, town or 1 to 4), for testing. `vh village spawn help` lists the codes and options; `vh testvillage` is short for it. Example: `vh village spawn town 14 12 celtic`. |
| `vh village stage <stage>` | yes | Takes the nearest village to that stage at once: the buildings, villagers and the rest the stage adds. |
| `vh village clear [yes]` | yes | Removes the nearest test village and everything Villheim made for it (asks first; `yes` goes ahead). `vh tidy villages` clears any village in range. |

`vh help` lists every developer command. Villages never build the generated designs: they sit in an `inspiration` folder.

You can also hover over or interact with a hearth or a villager to see the village summary.

## Configuration

The config file is `BepInEx/config/bazilisx.villheim.cfg`. Server values are synced to players. The main settings:

| Setting | Default | Notes |
|---|---|---|
| `VillageCount` | 30 | Village sites per world. |
| `DaysPerBuilding` | 2 | In-game days between buildings. A day is 30 real minutes by default. |
| `MaxBuildings` | 6 | Largest a village grows. |
| `StartingBuildings` | 1 | Buildings a village has when you find it. |
| `VillageRadius` | 60 | How far from the hearth buildings may go, in meters. |
| `MeadowsDesigns` / `BlackForestDesigns` | vanilla houses, farm and cabins | Comma separated location names. Add `:weight` to make one rarer or more common, for example `WoodFarm1:0.25`. |
| `AnyBiomeDesigns` | empty | Extra designs for every village. |
| `ExcludedObjects` | spawners, loot chests, bones, vines | Objects inside a design whose names contain these words are left out. Creatures, spawners and dungeon entrances are always left out. |
| `UseVanillaRandomness` | true | Many vanilla locations randomly include some parts. Turn this off to always build every part. |
| `VillagersPerBuilding` / `MaxVillagers` | 2 / 12 | Population limits. |
| `DaysPerNewVillager` | 0.5 | How often a new villager arrives while there is room. |

### Using designs from other mods

Any location registered in the game works as a design. For example, with More World Locations installed:

1. Run `villheim_locations MWL` to see its location names.
2. Run `villheim_preview <name>` to see how a copy looks.
3. Add the names you like to `AnyBiomeDesigns` (or one of the biome lists).

Villheim reads those mods' locations at runtime and nothing from them is copied into this mod, so those designs are available only while that mod is installed.

## How it works

- **Village site:** a custom location holding a single hearth. The hearth is a clone of the vanilla campfire with endless fuel. All village data (name, buildings, timers) is stored on the hearth's network object, so it is saved with the world and shared in multiplayer.
- **Growth:** the player who owns the hearth (usually the nearest one) runs the village every 5 seconds. When a growth period has passed, it picks a design, searches rings around the hearth for dry, fairly flat ground that does not overlap other buildings, player builds or other locations, and copies the design there.
- **Copying a design:** Villheim loads the location's prefab, replays its terrain leveling as permanent terrain edits, rolls its random parts the way the world generator would, and spawns its networked objects (building pieces, beds, doors, fires and similar) from the game's own prefabs. Creatures, spawners, loot chests and non-networked ruin dressing are left out, and random ruin damage is turned off, so abandoned houses come out lived in.
- **Villagers:** a clone of the player prefab with the player-only parts swapped for an NPC humanoid and a monster AI in the Dvergr faction (neutral to players, hostile to monsters). Each villager has a stored seed that decides its name and look, so it looks the same every time it loads.

Code layout:

```
src/Villheim/            the core plugin (changes need a game restart)
  Plugin.cs              entry point, registers prefabs and the village site
  LogicHost.cs           loads Villheim.Logic.dll and reloads it when the file changes
  IVillheimLogic.cs      the contract between core and logic
  Components/            hearth, villager and AI components (thin shells that call the logic)
  Prefabs/               hearth, villager and village site prefabs
  Commands.cs, Patches.cs, Keys.cs, VillheimConfig.cs
src/Villheim.Logic/      everything that decides behaviour (hot reloadable)
  Village/               founding, growth, population, saved state, plot search
  Designs/               design pool, copying designs, terrain edits
  Villagers/             looks, routine, dialogue, AI tuning
  LogicCommands.cs       console command implementations
```

## Building from source

1. Install the [.NET 8 SDK](https://dotnet.microsoft.com/download) (Windows, macOS or Linux).
2. Run `dotnet build Villheim.sln -c Release`.
3. The DLLs are `src/Villheim/bin/Release/Villheim.dll` and `src/Villheim.Logic/bin/Release/Villheim.Logic.dll`, with `Jint.dll`, `Acornima.dll` and `System.Runtime.CompilerServices.Unsafe.dll` next to the second.

You do not need Valheim installed to build: the project uses NuGet packages with publicized reference copies of the game assemblies.

## Developing with Valheim open (hot reload)

Villheim is split in two so most changes do not need a game restart:

- **Villheim.dll (core)** registers prefabs, components, patches and command names. Changing it needs a restart.
- **Villheim.Logic.dll (logic)** holds the village rules, design copying, villager behaviour and command implementations. The core checks the file every couple of seconds and swaps in a new build as soon as it changes. A message in the top left corner and a line in the log (`Loaded logic #N`) confirm the reload.

Suggested setup:

1. In r2modman, create a profile called `Villheim Test` with only Jotunn (it brings BepInEx) plus anything you want to test against. A small profile starts much faster.
2. Add `-console` to the launch parameters (r2modman: Settings, Launch parameters) so F5 opens the console.
3. Run `./scripts/deploy.ps1 -Core` once, then start the game. After that, `./scripts/deploy.ps1` updates only the logic while the game runs.

Notes:

- Changes to ZDO keys, prefab structure, patches, or `IVillheimLogic` need a core update and a restart.
- Buildings already being placed when a reload happens finish with the old code.
- Each reload keeps the previous build in memory until the game closes. That is fine for development; set `HotReload = false` in the config for normal play if you like.

## First test checklist

Things that could not be checked without running the game, in the order worth testing:

1. The log shows `Villheim 0.1.0 loaded` and `Registered village sites` with no errors.
2. `villheim_dump WoodHouse1` lists objects marked KEEP. If almost everything is SKIP or the list is short, that design is mostly decoration and should be dropped from the design lists.
3. `villheim_preview AbandonedLogCabin03` builds a cabin in front of you, sitting on the ground.
4. `villheim_found` lights a hearth, a first building appears within a few seconds, and two villagers arrive.
5. Villagers are dressed, animate, walk around, and greet you. Hit one and check that it fights back and calms down later.
6. `villheim_grow` adds a second building without overlapping the first.
7. Leave and come back, or log out and in: the village keeps its name, buildings and villagers.

If something fails, the BepInEx log (`BepInEx/LogOutput.log`) usually says why. Turn on `VerboseLogging` for more detail.

## Known limitations

- Untested in game (see above).
- Villagers that wander out of the loaded area are not counted, so a village may occasionally gain an extra villager.
- If a player leaves in the middle of a build, the ground may be leveled with no building on it. The village tries again later on a different spot.
- Building pieces in villages can be damaged and broken like any other pieces.
- Hearths placed with `villheim_found` in other biomes use the Meadows design list.

## Roadmap ideas

Ideas from Millénaire that fit Valheim:

- Villager jobs that use the copied buildings: farmers at farms, woodcutters, a trader at a market.
- Trading with villagers for coins, and village reputation that rises when you help and falls when you steal.
- Village cultures by biome, using existing designs: Fuling-style camps in the Plains, Dvergr outposts in the Mistlands.
- Roads between buildings using the vanilla path tool.
- Raids on villages at night, and quests from village elders.

## Related mods

[docs/RELATED_MODS.md](docs/RELATED_MODS.md) lists village, villager and colony mods for Minecraft and Valheim, what each does, and what Villheim can take from them.

## Credits

- **Millénaire** by Kinniken, for the idea of villages that grow around the player.
- **Norse Personality Construction System** and **Location Reset** by OrianaVenture (MIT). Villheim builds NPCs from the player model and re-spawns a location's contents the same way those mods do, and some AI settings come from them. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- **ValheimCityBuilder** and **World Edit** by RustyProductions, with 1Day2Die and Ybivec228 (CC0). Ideas for settlers, production, terrain and paths, and code where noted in the source.
- **Jötunn** by the Valheim Modding team, for prefab, location and command management.
- **Jint** by Sebastien Ros (BSD-2-Clause) and **Acornima** by Adam Simon (BSD-3-Clause) run the blueprint lab's JavaScript in the game. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- Other village mods for Valheim (VikingSettlements, ValheimVillages, VillageLife, PopVillages) were looked at for ideas.

## License

MIT. See [LICENSE](LICENSE).
