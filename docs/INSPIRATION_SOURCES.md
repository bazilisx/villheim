# Inspiration sources

Places to find well-made Valheim buildings that can be put in a test world and looked at. They are for review and
ideas only. Tyler builds his own designs and saves them as his own blueprints; nothing listed here goes into the mod.
If a creator restricts use of their work, that restriction is respected. Checked on 2026-11-06.

What was reachable from the cloud container:

- valheimians.com: blocked (the host is outside the session's allowed network). Everything below about the site comes
  from web search results and their page snippets. Creator names and material notes are as the snippets gave them
  and should be checked on the page. To read the pages directly, the host `www.valheimians.com` has to be allowed in
  the environment's network settings.
- Thunderstore: the package index and READMEs were readable. Package downloads (`ccdn.thunderstore.io`) were blocked,
  so counts and contents come from the READMEs.
- Nexus Mods: answers 403, as noted in `docs/LEARNINGS.md`.

## How valheimians blueprint downloads work

- Each build page lives at `https://www.valheimians.com/build/<slug>/`. A page that has a file shows a "Download
  Valheim Build" button. A third-party guide (thegamercodex.com) says builds are public to view, and a free account is
  needed to download or comment. This could not be checked directly.
- File types: `.blueprint` (PlanBuild) and `.vbuild` (BuildShare). Some pages offer a zip with both. PlanBuild reads
  both; Infinity Hammer reads `.blueprint` (one creator added a `.blueprint` because Infinity Hammer did not read the
  `.vbuild`). Some large builds are hosted on Nexus because they were too big for the site.
- The direct download URL format is unknown. Pages could not be opened, and no search result showed a raw file link.
  Treat the download as a button behind a login until someone checks a page in a browser.
- Where the files go: `BepInEx/config/PlanBuild/blueprints/` for PlanBuild; BuildShare reads its own `Build` folder.
- Listing pages:
  - Categories: `/builds/<category>/`, for example `starter-home`, `blacksmith`, `farming`, `boat-house`, `tower`,
    `castle`, `village`, `tavern`, `advanced-base`.
  - Tags: `/builds/tag/<tag>/`, for example `house`, `small`, `starterhome`, `dock`, `harbor`, `port`, `stall`,
    `farm`, `town`, `village`, `blacksmith`, `building`, `world`, `base`.
  - Filters: `?share=downloadable` (only builds with a file), `?share=videos`, `?order=order_downloads`,
    `order_views`, `order_popularity`, `order_latest` or `order_updated`, `?p=2` for the next page,
    `?time_machine=y-2025` for one year.
  - Other: collections at `/collection/<id>/<slug>/`, member pages at `/member/<name>/`, articles at `/article/<slug>/`.
  - A good start: `https://www.valheimians.com/builds/starter-home/?share=downloadable&order=order_downloads`.
- No sitemap could be checked.

## Valheimians builds

Stage notes: "early" means wood, stone, core wood and other Meadows or Black Forest materials. Anything that needs
bronze, iron, black marble or Mistlands or Ashlands items is marked. "File" means a snippet said a blueprint or
download is offered.

### Homes and huts

| Title | Kind | Creator | Materials and stage | Page |
|---|---|---|---|---|
| Tiny home challenge, Part 1: Before Eikthyr | home | not shown | Pre-Eikthyr. No metals, no fine wood; core wood allowed. No digging. Posted 2022-01-23 | https://www.valheimians.com/build/tiny-home-challenge-part-1-before-eikthyr/ |
| Tiny Home Challenge: Before the Queen | home | not shown | Same rules, later stage (Mistlands) | https://www.valheimians.com/build/tiny-home-challenge-before-the-queen/ |
| The Ultimate Tiny Home in Valheim! Blueprint Available! | home | MythicBuilds (not confirmed) | Tiny home rules, 6x8 m ground floor. File | https://www.valheimians.com/build/the-ultimate-tiny-home-in-valheim-blueprint-available/ |
| Meadows Starter House | home | IzzyRiz | Pre-Black Forest, medium size, some storage, basic comfort | https://www.valheimians.com/build/meadows-starter-house/ |
| FULL Meadows Starter Base (100% Meadows materials) | home | maru | Meadows only, 10x10 m; core wood taken from Meadows campfires | https://www.valheimians.com/build/full-meadows-starter-base-100-meadows-materials/ |
| Meadows Home for 4 | home | Fluffy-n-Dana | Mostly early, just past Eikthyr; 4 beds; forge level 3 needs bronze-age items | https://www.valheimians.com/build/meadows-home-for-4/ |
| Octagon Starter Base | home | aSoftPea | Meadows and Black Forest materials only | https://www.valheimians.com/build/octagon-starter-base/ |
| Small Simple cabin (pre-plains) | home | not shown | Hearth, cauldron, workbench, forge; deep supports for uneven ground. Among the most downloaded small builds | https://www.valheimians.com/build/small-simple-cabin-pre-plains/ |
| Cottage | home | not shown | One bed, two hearths, workshop, kitchen with oven (the stone oven needs iron) | https://www.valheimians.com/build/cottage/ |
| Starter House (Pre-Bronze age) | home | not shown | Pre-bronze | https://www.valheimians.com/build/starter-house-pre-bronze-age/ |
| Bronze Age Starter House | home | Zohair47 | 20x20 m, furnished and empty versions; early bronze age | https://www.valheimians.com/build/bronze-age-starter-house/ |
| Quirky Log Cabin | home | not shown | Core wood, built on reaching the Black Forest | https://www.valheimians.com/build/quirky-log-cabin/ |
| A Small Cabin Getaway | home | not shown | Small Black Forest cabin | https://www.valheimians.com/build/a-small-cabin-getaway/ |
| Black Forest Lodge | home | not shown | Wood and core wood house; stone floor, outbuildings and garden walls | https://www.valheimians.com/build/black-forest-lodge/ |
| Black Forest Mansion | home | not shown | Large; mostly Black Forest and Meadows materials; for 5 to 10 players | https://www.valheimians.com/build/black-forest-mansion/ |
| House with barn (animal shelter) | home and barn | MutantArtCat | Small home with room for a boar, left empty to decorate | https://www.valheimians.com/build/house-with-barn-animal-shelter/ |
| viking house | home | not shown | Not stated | https://www.valheimians.com/build/viking-house-2718/ |
| Home on Stilts (perfect for Swamp) | home | not shown | Stilt house for the swamp | https://www.valheimians.com/build/home-on-stilts-perfect-for-swamp/ |
| Upgraded Starter Home with Hearth | home | not shown | Hearth needs a stonecutter (iron) | https://www.valheimians.com/build/upgraded-starter-home-with-hearth/ |
| FPS-optimized cozy house for low PCs | home | not shown | Compact, essentials up to mid-game | https://www.valheimians.com/build/fps-optimized-cozy-small-house-for-low-pc-all-essentials-in-a-compact-space/ |

### Longhouses and halls

| Title | Kind | Creator | Materials and stage | Page |
|---|---|---|---|---|
| Garllok's Longhouse Tutorial | longhouse | Garllok | Build file with a step by step tutorial, about 1.3k downloads | https://www.valheimians.com/build/garllok-039-s-longhouse-tutorial/ |
| Longhouse | longhouse | Nautilus94 | Basic Viking longhouse, about 4.1k downloads | https://www.valheimians.com/build/longhouse/ |
| My first Longhouse | longhouse | PUP | Furnished and empty versions, `.blueprint` and `.vbuild` | https://www.valheimians.com/build/my-first-longhouse/ |
| To be decorated Longhouse | longhouse | MutantArtCat | Empty shell for your own decor; PlanBuild file | https://www.valheimians.com/build/to-be-decorated-longhouse/ |
| Longhouse with secret storage | longhouse | MutantArtCat | Bare and furnished versions; hidden passage needs a rotation mod | https://www.valheimians.com/build/longhouse-with-secret-storage/ |
| Viking Longhouse V2 | longhouse | Versaugh | Tagged blueprint, about 700 downloads | https://www.valheimians.com/build/viking-longhouse-v2/ |
| Zertek's Longhouse | longhouse | Zertek | File, about 330 downloads | https://www.valheimians.com/build/zertek-s-longhouse/ |
| Large Longhouse | longhouse | not shown | Maxed stations and full bedroom (late-game stations) | https://www.valheimians.com/build/large-longhouse/ |
| The Village Longhouse (fully decorated, room for 6-12) | longhouse | not shown | Places without mods; decor in the screenshots needs mods | https://www.valheimians.com/build/the-village-longhouse-fully-decorated-room-for-6-12/ |
| Meadows Townhall (Nakd n Afraid season 2) | hall | not shown | First 100 days, at most 1,500 wood, Meadows decor only. File | https://www.valheimians.com/build/meadows-townhall-nakd-n-afraid-season-2/ |
| The Meadows Hall | hall | not shown | Fortified; banquet hall and many stations | https://www.valheimians.com/build/the-meadows-hall/ |
| Great Hall | hall | not shown | Simple vanilla style, hearth, no kitchen or forge | https://www.valheimians.com/build/great-hall-1835/ |
| The Great Hall | hall | not shown | Mid-game; modelled on the Kattegat hall from the TV show Vikings. File | https://www.valheimians.com/build/the-great-hall/ |
| Restored Mead Hall | hall | not shown | Rebuilt in a creative world | https://www.valheimians.com/build/restored-mead-hall/ |
| The Dragonhearth, Meadhall of the Dragonhammer Clan (No mods) | hall | not shown | Vanilla pieces | https://www.valheimians.com/build/the-dragonhearth-meadhall-of-the-dragonhammer-clan/ |
| My Ashlands Ocean Longhouse Build | longhouse | MythicBuilds | Ashlands materials. File added January 2025 | https://www.valheimians.com/build/my-ashlands-ocean-longhouse-build/ |

### Workshops and smithies

| Title | Kind | Creator | Materials and stage | Page |
|---|---|---|---|---|
| Simple Forge Workshop, Open Concept, Free Download | smithy | Boomboy | Open workshop; about 2.8k downloads | https://www.valheimians.com/build/simple-forge-workshop-open-concept-free-download/ |
| Valheim Forge Build | smithy | not shown | Not stated | https://www.valheimians.com/build/valheim-forge-build/ |
| Regal Smithy | smithy | not shown | No mods. Forge, kiln, smelter; also black forge (Mistlands) and blast furnace (Plains). File added April 2026 | https://www.valheimians.com/build/regal-smithy/ |
| Our compact and practical Blacksmith | smithy | not shown | Kilns, smelters, blast furnace (Plains) | https://www.valheimians.com/build/our-compact-and-practical-blacksmith/ |
| Round Workshop | workshop | not shown | Smelters, kilns, stonecutter; blast furnace and spinning wheels (Plains) | https://www.valheimians.com/build/round-workshop/ |
| Compact Pre-Mistlands Workshop & Smeltery | workshop | not shown | Level 7 forge, blast furnace (Plains) | https://www.valheimians.com/build/compact-pre-mistlands-workshop-amp-smeltery/ |
| Home on Stilts, upgraded with a smelter and kiln | home and workshop | not shown | Smelter and kiln (Black Forest) | https://www.valheimians.com/build/home-on-stilts-upgraded/ |
| Semi-automatic smelter / foundry and blacksmith shop | workshop | not shown | Level 7 forge, blast furnace (Plains) | https://www.valheimians.com/build/semi-automatic-smelter-foundry-and-blacksmith-shop/ |
| Mushroom Foundry | workshop | not shown | 6 kilns, 6 smelters, maxed forge and workbench | https://www.valheimians.com/build/mushroom-foundry/ |

### Storage

| Title | Kind | Creator | Materials and stage | Page |
|---|---|---|---|---|
| Small Storage Warehouse | storage | not shown | No mods. File added 2026-04-02 | https://www.valheimians.com/build/small-storage-warehouse/ |
| Warehouse | storage | not shown | Port warehouse | https://www.valheimians.com/build/warehouse/ |
| Custom Storehouse (Vanilla) | storage | not shown | Wood, thatch, crates | https://www.valheimians.com/build/vanilla-storehouse/ |
| Fully equipped warehouse/workshop | storage and workshop | not shown | Storage reachable inside and out; kilns, smelters | https://www.valheimians.com/build/fully-equipped-warehouse-workshop/ |
| Storage/Workshop | storage and workshop | not shown | Very large (about 580 boxes), blast furnace (Plains) | https://www.valheimians.com/build/storage-workshop/ |

### Farms and barns

| Title | Kind | Creator | Materials and stage | Page |
|---|---|---|---|---|
| Rustic Barn | barn | TheArtisan | Not stated | listed at https://www.valheimians.com/builds/farming/ |
| The Farmhouse | farm | not shown | Not stated | https://www.valheimians.com/build/the-farmhouse/ |
| Stable | barn | not shown | Not stated | https://www.valheimians.com/build/stable/ |
| Large farm | farm | not shown | Not stated | https://www.valheimians.com/build/large-farm/ |
| Thortress Boar Pen | pen | JessaFlux | Boar pen | https://www.valheimians.com/build/thortress-boar-pen/ |
| Coop'd Up Farmhouse and Bee'nery | farm | Fluffy-n-Dana | Bees and farmhouse | listed at https://www.valheimians.com/builds/farming/ |
| The Hive 1.0 | farm | Aodi | Bees | listed at https://www.valheimians.com/builds/farming/ |
| Chicken Breeder for eggs and chickens | farm | LooneyBandit | Chickens (later game) | listed at https://www.valheimians.com/builds/farming/ |
| Elevated Lox Farm | farm | Jeggyeggy | Lox (Plains); barn over the pen | https://www.valheimians.com/build/elevated-lox-farm/ |

### Docks

| Title | Kind | Creator | Materials and stage | Page |
|---|---|---|---|---|
| Open longboat dock | dock | not shown | Dock and port, bunks for three, fishing gear | https://www.valheimians.com/build/open-longboat-dock/ |
| How to Build a Dock for your Karve | dock | not shown | Bronze age (Karve) | https://www.valheimians.com/build/how-to-build-a-dock-for-your-karve/ |
| Boathouse | dock | not shown | Not stated | https://www.valheimians.com/build/boathouse-1924/ |
| Viking Dock; Viking Dock House | dock | MCRanger; Kingchickenx | Not stated | listed at https://www.valheimians.com/builds/boat-house/ |

### Gates, walls and towers

| Title | Kind | Creator | Materials and stage | Page |
|---|---|---|---|---|
| Crown Communities: Imperial Hamlet Fort | gate and wall | not shown | Stone walls with palisade and core wood logs, tall gate tower | https://www.valheimians.com/build/land-fortifications-hamlet-fort/ |
| Tower Builds | tower | not shown | Guard tower for city walls, watch tower, mage tower. File for guard and mage towers (April 2026) | https://www.valheimians.com/build/tower-builds/ |
| Watch Tower/Outpost | tower | not shown | Not stated | https://www.valheimians.com/build/watch-tower-outpost/ |
| Watch Tower | tower | not shown | Modelled on a Chivalry II tower | https://www.valheimians.com/build/watch-tower/ |
| medieval watchtower #2 | tower | not shown | Part of a castle set | https://www.valheimians.com/build/medieval-watchtower-2/ |

### Market stalls

| Title | Kind | Creator | Materials and stage | Page |
|---|---|---|---|---|
| Market Stall | stall | not shown | Built with a rotation mod. Zip with `.vbuild` and `.blueprint` | https://www.valheimians.com/build/market-stall/ |
| Food stall | stall | not shown | Simple; the sign is missing from the `.vbuild` | https://www.valheimians.com/build/food-stall/ |

### Villages

| Title | Kind | Creator | Materials and stage | Page |
|---|---|---|---|---|
| Tiny little viking inspired village | village | not shown | Two houses (comfort 13), kitchen, storage, portal room, port | https://www.valheimians.com/build/tiny-little-viking-inspired-village/ |
| Crown Communities: Hunters' Commune | village | not shown | Mini village around a hunting lodge, Meadows and Black Forest edge | https://www.valheimians.com/build/settlements-hunters-commune/ |
| Viking Village, 4 seasons (video wallpaper) | village | not shown | Meadows village, about 40% built when posted | https://www.valheimians.com/build/viking-village-4-seasons-in-the-valheim-game-video-wallpaper-1440p/ |

## Mods and packs with prebuilt buildings

How to spawn for review:

- Locations: on a new world they generate on their own. On an old world, add them with Upgrade World (JereKuusela)
  using the commands each mod gives. Infinity Hammer's `hammer_location <name>` places one location where you look.
  Villheim's own `vh gallery` also lists locations from installed mods.
- Blueprint files: PlanBuild's Blueprint Rune, or Infinity Hammer for `.blueprint` files.

| Name | Author | What it adds | Permissions on the page | How to spawn | URL |
|---|---|---|---|---|---|
| More World Locations AIO | warpalicious | 190 POIs: 188 custom locations plus 2 dungeons, all biomes. Village-relevant names: MWL_MeadowsBarn1, MWL_MeadowsFarm1, MWL_MeadowsHouse2, MWL_MeadowsSawmill1, MWL_MeadowsTavern1, MWL_MeadowsWall1, MWL_MeadowsTower1, MWL_OakHut1, MWL_SmallHouse1, MWL_MaypoleHut1, MWL_ForestForge1/2, MWL_ForestHouse2, MWL_ForestGreatHouse2, MWL_BlackForestBlacksmith1/2, MWL_Tavern1, MWL_WoodTower1-3, MWL_WoodBarn1, MWL_WoodFarm1, MWL_WoodHouse1, MWL_StoneHall1, MWL_StoneTavern1, MWL_SupplyBarn1, MWL_Shipyard1, MWL_Port1-6 | None on the page. "All the locations used in this mod were created by Valheim community members"; each builder is credited by location. GitHub repo `jneb802/MoreWorldLocations_All` is All Rights Reserved (checked earlier, see LEARNINGS) | Locations; `mwl_meadows`, `mwl_blackforest` and so on with Upgrade World | https://thunderstore.io/c/valheim/p/warpalicious/More_World_Locations_AIO/ |
| MWL biome packs (Meadows 1 and 2, Blackforest 1 and 2, Swamp 1, Mountains 1, Plains 1, Mistlands 1, Ashlands 1, Adventure Map 1) | warpalicious | 3 to 18 locations each; all included in the AIO | Same as AIO. The author says "I don't plan to continue support for the individual biome packs" | Locations | https://thunderstore.io/c/valheim/p/warpalicious/Meadows_Pack_2/ |
| BiomeBlueprints | OverDrive (team name); "Made by lg_9d" | 353 PlanBuild blueprints by biome: 78 generated house designs (the `hs_` names: hut, cottage, longhouse, stilt house, manor, great hall, villa) and 275 community builds by 89 builders, imported with names intact | No licence. Builders were asked for "permission to ship it", and "If one of these is yours and you would rather it were not included ... it will be changed or removed" | Blueprints (PlanBuild) | https://thunderstore.io/c/valheim/p/OverDrive/BiomeBlueprints/ |
| Expand_locations | Ashenius | Expand World configs and blueprints: location types for Meadows 11, Black Forest 10, Swamp 7, Mountain 6, Plains 7, Mistlands 7, Ocean 6 | No licence. "Thanks to the community members and Valheim players for the blueprints and inspiration" | Locations; `add_loki_meadows` and so on with Upgrade World | https://thunderstore.io/c/valheim/p/Ashenius/Expand_locations/ |
| VikingSettlements | morosmods (abjumb) | Meadows villages (longhouse, cabins, farm, maypole, watchtower, market stall), Black Forest stake-wall outposts, Plains stone steadings; builder blueprints for cabins, watchtowers, docks, longhouses, pens | None on the page; MIT on GitHub (see LEARNINGS) | Locations; `vs_spawn` with devcommands | https://thunderstore.io/c/valheim/p/morosmods/VikingSettlements/ |
| jtv_biomes | thedefside | Locations incl. WoodFarm1_Old (Meadows), StoneVillage1/2 (Plains), AbandonedLogCabin01, stone keeps and towers. Last update 2022 | None on the page | Locations | https://thunderstore.io/c/valheim/p/thedefside/jtv_biomes/ |
| RaiderClans | Ruijven | 11 raider locations incl. RC_WoodHouse3, RC_StoneHouse5_heath, ruins and towers | None on the page. The page points to "Plan Build files for additional builds" | Locations; `locations_add` with Upgrade World | https://thunderstore.io/c/valheim/p/Ruijven/RaiderClans/ |
| Swamp Revival After Bonemass | Enetesh | Restored swamp with ruins and settlements after Bonemass | "Concept, project components, approved release icon and blueprints: Enetesh, subject to the provenance details in LICENSING.md" | Locations | https://thunderstore.io/c/valheim/p/Enetesh/Swamp_Revival_After_Bonemass/ |
| LivingVillages | BjornToGame | Generated villages with merchants, guards and a forge master | None on the page | Locations | https://thunderstore.io/c/valheim/p/BjornToGame/LivingVillages/ |
| RavenHeim | JamesJonesTV | Over 100 enterable buildings as single pieces (the old MedievalHeim by Marlthon); medieval style, custom models | None. "I purchased this to make sure that people will have this forever on thunderstore" | Build pieces | https://thunderstore.io/c/valheim/p/JamesJonesTV/RavenHeim/ |
| RavenwoodUnderground | JamesJonesTV | About 100 structures taken from vanilla burial chambers, crypts and caves | None on the page | Build pieces | https://thunderstore.io/c/valheim/p/JamesJonesTV/RavenwoodUnderground/ |
| Glitnir_Locations | GlitnirBr | 5 fantasy locations (orc, fairy, elf, dwarf, coliseum); no Viking village style | None on the page | Locations; `hammer_location` | https://thunderstore.io/c/valheim/p/GlitnirBr/Glitnir_Locations/ |
| StonedProphets_BlueprintWorld_Pack | Prophet_Productions | Modpack for the author's "Blueprint Builds world"; contents not described | None | Unclear | https://thunderstore.io/c/valheim/p/Prophet_Productions/StonedProphets_BlueprintWorld_Pack/ |
| PlanBuild | MathiasDecrock, marcopogo | Blueprint Rune: capture, place and share `.blueprint` and `.vbuild` | WTFPL (see LEARNINGS) | Tool | https://thunderstore.io/c/valheim/p/MathiasDecrock/PlanBuild/ |
| Infinity Hammer | JereKuusela | Copy any object, place locations (`hammer_location`), read `.blueprint` | None on the page | Tool | https://thunderstore.io/c/valheim/p/JereKuusela/Infinity_Hammer/ |
| Upgrade World | JereKuusela | Adds new locations to an existing world | None on the page | Tool | https://thunderstore.io/c/valheim/p/JereKuusela/Upgrade_World/ |

Who made the `hs_` pack: BiomeBlueprints is published under the Thunderstore team OverDrive. Its README ends with
"Made by **lg_9d**" and links instagram.com/lg_9d. The `hs_` names belong to the 78 generated designs; the README does
not say what "hs" stands for. Builds can be sent to it through a Google form linked on the page.

Nexus: not readable from the container. Search results show BuildShare blueprint uploads at Nexus mods 135, 138 and
469. Mods 2747, 1522 and 954 (noted earlier as blueprint mods) are still unread.
