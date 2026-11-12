# Handoff: the memory look (branch `look/memory`)

State on 2026-11-11 (US Mountain Time). Branch `look/memory` at the commit that adds this file; main is merged in.
The look is not on main. Next work on it goes to its own session.

## Goal (Tyler's words)

D-160, "Your answer" in the Decisions tab (chat, 2026-11-11):

- "adjust how the villagers look (instead of ghostly seethrough maybe some other effect taht gives them a little
  hologram blue-teal outline and they're only semi-transparent and teal still? Something that would make them feel
  more like memories than dead/ghosts. This would be a new villheim repo branch while I test this, however. And I'd
  like to set up dials to tweak the settings with a static t-posed villager model first via F1 config."
- Reference picture (`/mnt/user-data/uploads/530eaa84-image.png` in the first session): a dog model, semi-transparent
  with its own colors, a fine teal grid over the body, a soft teal glow at the outline, brightest at the feet.
- "no grid over the body, no pulse please. Those are too much like tech-holograms. Im aiming for some middleground
  between ghost and memory, but certainly want to avoid hologram."
- "ya and also glow under the feet as you can see in the image too."

Later in chat (relayed by the lead, 2026-11-11):

- "a milky transparent effect, like milky glass, tinted, and with a glowy border."
- "the glow should be under each individual foot (and attached to the bottom of each foot if we can, not the ground
  so it doesnt look weird when they walk and the glow stays on the ground and not their foot itself)."

D-162 (Open): whether the card mesh and the 64 x 64 round texture made in code fit D-013 ("never make new models or
textures"). Value in use until answered: A, made in code.

## What each part uses

All in `src/Villheim.Logic/Villagers/MemoryLook.cs` (summary comment at the top). Shaders and materials were checked
in the game's shader bundle (`Valheim_Data/StreamingAssets/SoftRef/Bundles/c4210710`, read with UnityPy on Tyler's
PC) and found at runtime with `Resources.FindObjectsOfTypeAll<Material>()`. Only game shaders are used.

- **Colors (body):** GhostLook's swap to the borrowed see-through shader. The log on Tyler's PC says "Ghost look:
  borrowing the see-through shader 'Custom/Fallen Warrior' from Bjorn_spiritcaller". That shader keeps the player body
  textures (`_MainTex` skin, `_ChestTex`, `_LegsTex`). Its passes are "Depth Pre-Pass" (writes depth) and "Render
  Color" with Blend OneMinusDstColor One (a screen blend), queue Transparent. In memory mode its `_TintColor` is
  `lerp(white, MemoryTintColor, tint) * MemoryBrightness * alpha` (`MemoryLook.BodyTint`, used in `GhostLook.Apply`).
- **Milk (queue 2999) and glow shells (3001 to 3004):** copies of the game material named by `MemoryPassMaterial`:
  FallenWarrior (`FallenWarrior`, default), WeaponGlow (`Berzerkr_LightningGlow_Static_Mat`, `Unlit/WeaponGlow`),
  LitParticles (`distant_fog`), SurfaceParticles (`feather_white`, `Particles/Standard Surface2` with
  `_ALPHABLEND_ON`), LuxParticles (`Lux Lit Particles/ Bumped`). Each copy gets white textures, `_Cutoff` 0, no
  noise, curl or scrolling.
  - The passes are extra renderers named `villheim_memory_pass` under each villager part, with the pass material on
    every sub-mesh (the body has two). GhostLook and GhostDeath skip them (`MemoryLook.IsPass`).
  - The milk is a skinned copy that shares the part's mesh and bones.
  - The shells are pushed out along the normals. Only `Unlit/WeaponGlow` has a push (`_VertPush`, set per renderer
    through a property block). For the other materials (`MemoryShellMode` Auto or Baked) each skinned part is baked
    every second frame with `SkinnedMeshRenderer.BakeMesh(mesh, true)`, pushed out in meters and drawn on a plain
    mesh renderer with the part's scale undone. Only parts within 30 m of the camera, at most 48 a frame. Cost not
    measured.
- **Feet:** one card under each sole, a child of the foot bone (names the game's `FootStep` and `CharacterAnimEvent`
  look for: `LeftFoot`, `RightFoot` and others), placed between ankle and toe at sole height. A 4-corner card with
  white vertex colors and a 64 x 64 soft round texture, both made in code (D-162), on a copy of `distant_fog`
  (`Custom/LitParticles`, emission set so it shows after dark). A faint point light at 0.25 m.
- **Other files touched:** `LogicConfig.cs` (section "3e - Look: memory", WatchLooks list), `LogicCommands.cs` (help
  and `villheim_memory`), `GhostLook.cs` (memory branch in Update and Apply, skip of pass renderers, `ApplyNow`
  marks the look dirty, `Darkness` internal), `ChildBody.cs` (`Model` internal), `GhostDeath.cs` (skips pass
  renderers and materials), `VillheimLogic.cs` (`MemoryLook.Unload`), `docs/DEVELOPMENT.md`.

## What Tyler's tests showed

Sources: his reports relayed by the lead, and his `BepInEx/LogOutput.log` (Villheim Test profile).

- Build 977+look.3: alpha "only binary: 0 or 1". Then: "it was just very subtle but it does semi-work". The body
  renderer has two sub-meshes (the game's `VisEquipment` sets `materials[0]` and `materials[1]`), and that build
  added passes only to renderers with one sub-mesh, so the body had no darkening and no glow. The Fallen Warrior
  colors only add light (screen blend) and cannot hide what is behind. The milk pass is the answer to that.
- Same build: "the memory glow feet effect is a big black rectangle"; 4 log errors "Error assigning 2D texture to 3D
  texture property '_CurlTex'". Fixed in look.4 (card with white vertex colors and round texture; `_CurlTex` left alone).
- 979+look-memory.6: WeaponGlow shells drew nothing visible on villagers.
- 979+look-memory.7 (solo Glow, FallenWarrior): magenta shapes about 95 times too large. The probe showed every part
  with scale 95. Fixed in .8 (bake with the part's scale, shell scale undone).
- 979+look-memory.8 (solo Glow, FallenWarrior, spread 0.04, 4 layers): only a small patch at one calf. Probe: shells
  on every part, scale 1, shader Custom/Fallen Warrior, queue 3001 to 3004, `_TintColor` magenta, `_Cutoff` 0.45.
  Fallen Warrior clips by `_Cutoff` against texture alpha. The last build sets `_Cutoff` 0 on every pass material
  and lists each texture slot in the probe. Not yet tried.
- Milk reads in .7 ("body milky white-teal"). The feet showed as a green pool under the feet in .7 (ground cards,
  since replaced by sole cards).

## Dials and commands

F1, section "3e - Look: memory" (`LogicConfig.BindMemoryLook`); every change shows at once:

- `LookMode` Memory (default) or Ghost.
- Body: `MemoryAlpha` 0.6 and `MemoryAlphaDay` 0.75 (how strongly the own colors show; 1 is solid, no look),
  `MemoryMilk` 0.4, `MemoryMilkDay` 0.5, `MemoryMilkColor`, `MemoryTint` 0.35, `MemoryTintDay` 0.45,
  `MemoryTintColor`, `MemoryBrightness` 1.1.
- Glow: `MemoryGlow` 0.35, `MemoryGlowDay` 0.18, `MemoryGlowColor`, `MemoryGlowSpread` 0.015 m (0 to 0.08),
  `MemoryGlowSoftness` 0.6, `MemoryGlowLayers` 2 (0 to 4), `MemoryGlowEdge` (WeaponGlow's `_EdgeFading`).
- Feet: `MemoryFeetGlow` on, `MemoryFeetStrength` 0.6, `MemoryFeetSize` 0.35 m, `MemoryFeetColor`,
  `MemoryFeetLight` 0.5.
- Testing: `MemoryDebugSolo` (Off, Milk, Glow, Feet; the villager's own colors go black meanwhile, so the body is
  unseen), `MemoryPassMaterial`, `MemoryShellMode` (Auto, Push, Baked).

Commands: `vh memory [woman]` (still T-posed model 3 m in front, probe to the log once its passes exist, up to 10 s),
`vh memory clear`, `vh memory shaders`, `vh memory probe` (model and 3 nearest villagers: shader, supported, queue,
keywords, values, texture slots, sub-meshes, scales, passes), `vh memory pass next`.

## Test channel

- A push to `look/memory` makes CI (`.github/workflows/build.yml`) build it with the label
  `<main build>+look-memory.<commits past main>-<commit>` and post the release `test-look-memory`.
- Tyler's updater (`scripts/Villheim-Updater.ps1`) follows that release while
  `BepInEx/plugins/bazilisx-Villheim/villheim-channel.txt` in the Villheim Test profile says `look-memory`. Removing
  the file or writing `main` in it goes back to main.
- The `.main-backup` files in that plugin folder are main build 977 from the hand installs before the channel existed.
- Before each push: `git fetch origin main && git merge origin/main`. Check the Build run and read the release's
  `version.txt` through the REST API (`gh api repos/bazilisx/villheim/releases/tags/test-look-memory`); `gh release
  view` is blocked in these sessions.

## Open

- Whether the shells draw once `_Cutoff` is 0 (the last build; label in the session report).
- Whether any other pass material draws on skinned villager meshes (`vh memory pass next` with solo on).
- The cost of baked shells with many villagers near.
- D-162 (card mesh and round texture made in code against D-013).
- The milk and colors together against "milky glass, tinted": not judged by Tyler yet.
- Default `LookMode` on main once Tyler is happy (not asked yet).
- The feet glow on the sole cards: not tried yet.

## Next steps

1. Tyler: solo Glow with FallenWarrior on the newest build; if the shell shows whole, solo Off and tune spread (0.01
   to 0.04 m), layers and softness.
2. If shells still do not show, read the probe lines (texture slots, `_Cutoff`) and try `vh memory pass next`.
3. Measure the baked shells' frame time with a village (`vh lag`), and limit the count or the range if needed.
4. Once Tyler approves the look: ask about the default LookMode, record D-160 as Done with the files, merge to main.
