// Piece catalog: size, shape, role and material for Valheim prefab names.
// Sizes are [x, y, z] in metres in the piece's own frame. Measured from the corpus:
// building pieces have their pivot at their centre; furniture and props stand on their pivot.
// Roof pieces run 2 m along local z and rise toward -z (1 m for 26 degrees, 2 m for 45).
// Walls, beams and gable pieces run along local x.

const MAT = {
  wood: '#a07c4f', darkwood: '#4f3a28', thatch: '#b89a55', darkroof: '#3e3330', corewood: '#7b5a36',
  stone: '#8d8b84', marble: '#5b6467', grausten: '#5d5753', ashwood: '#8a4f3c', iron: '#5e6266',
  glass: '#b9dde8', dvergr: '#76643f', flametal: '#7d3d2a', cloth: '#8b2f2a', fur: '#8a7a66',
  green: '#557f3c', fire: '#e08a2c', gold: '#c8a640', bone: '#d8d2bf', black: '#2c2c2e', turf: '#5f7f3a',
  stake: '#6f5133', white: '#ddd8cc',
};

function material(n) {
  if (/crystal|glass|window_glass/.test(n)) return 'glass';
  if (/darkwood_roof|KokeraRoof/i.test(n)) return 'darkroof';
  if (/^wood_roof|straw|thatch/.test(n)) return 'thatch';
  if (/darkwood|blackwood/.test(n)) return 'darkwood';
  if (/turf/.test(n)) return 'turf';
  if (/ashwood/.test(n)) return 'ashwood';
  if (/grausten|Ashlands_/.test(n)) return 'grausten';
  if (/blackmarble/.test(n)) return 'marble';
  if (/flametal/.test(n)) return 'flametal';
  if (/dvergr|dverger/.test(n)) return 'dvergr';
  if (/woodiron|iron|metal|thin_iron/.test(n)) return 'iron';
  if (/stone|Rock|rock|cliff/.test(n)) return 'stone';
  if (/_log|corewood|wood_core|roundlog/i.test(n)) return 'corewood';
  if (/stake/.test(n)) return 'stake';
  if (/banner|cloth|carpet|curtain/.test(n)) return 'cloth';
  if (/rug|fur|bed/.test(n)) return 'fur';
  if (/Pickable|Bush|bush|Tree|tree|shrub|vines|Vine|Fern|root|Beech|Mushroom|Plant|sapling|Birch|Pine|Oak|grass/.test(n)) return 'green';
  if (/torch|fire|brazier|hearth|lantern|candle|Candle|Lava/.test(n)) return 'fire';
  if (/bone|Skull|skull/.test(n)) return 'bone';
  if (/treasure|coin|gold/.test(n)) return 'gold';
  return 'wood';
}

// role, size, shape. Order matters: first match wins.
const RULES = [
  // roofs
  [/roof.*top|_top_45|roof_top/, 'roofTop', [2, 0.45, 2], 'cap'],
  [/roof.*ocorner.*45/, 'roofCorner', [2, 2, 2], 'hipcorner45'],
  [/roof.*ocorner/, 'roofCorner', [2, 1, 2], 'hipcorner26'],
  [/roof.*icorner.*45/, 'roofCorner', [2, 2, 2], 'slope45'],
  [/roof.*icorner/, 'roofCorner', [2, 1, 2], 'slope26'],
  [/wall_roof.*upsidedown|roof.*upsidedown/, 'gable', [2, 1, 0.2], 'triInv'],
  [/wall_roof_45|wall_roof_67|wall_roof.*45/, 'gable', [2, 2, 0.2], 'tri'],
  [/wall_roof/, 'gable', [2, 1, 0.2], 'tri'],
  [/roof_67/, 'roof', [2, 4, 2], 'slope67'],
  [/roof_45|roof.*_45/, 'roof', [2, 2, 2], 'slope45'],
  [/roof/, 'roof', [2, 1, 2], 'slope26'],
  // arches and pillars, measured in the corpus (lab/offsets.js): a stone pillar is 2 m tall and stands on a 1 m block,
  // a stone arch is 2 m wide, 1 m tall and 1 m deep with its top level with the pillar tops 1.5 m to either side;
  // a black marble arch spans 2 m between 1 m columns, which stack every metre
  [/^stone_arch$/, 'wall', [2, 1, 1], 'box'],
  [/^stone_pillar$/, 'pole', [1, 2, 1], 'box'],
  // stone_wall_1x1 is a 1 m cube (docs/MC_TRANSLATION.md, neighbours 1 m apart in depth)
  [/^stone_wall_1x1$/, 'wall', [1, 1, 1], 'box'],
  [/^blackmarble_arch$/, 'wall', [2, 2, 0.5], 'box'],
  [/^blackmarble_column_1$/, 'pole', [0.6, 1, 0.6], 'box'],
  // beams and poles
  [/beam_26|log_26/, 'beam', [2, 1, 0.2], 'beam26'],
  [/beam_45|log_45/, 'beam', [2, 2, 0.2], 'beam45'],
  [/beam_67|log_67/, 'beam', [2, 4, 0.2], 'beam67'],
  [/beam4x4|beam_4m|beam.*4m|wall_log_4x0\.5/, 'beam', [4, 0.25, 0.25], 'box'],
  [/beam_1|beam.*1m|beam_small/i, 'beam', [1, 0.2, 0.2], 'box'],
  [/beam/i, 'beam', [2, 0.2, 0.2], 'box'],
  [/pole4|pole_log_4|pole_4m|pole.*4m/, 'pole', [0.25, 4, 0.25], 'box'],
  [/pole2|pole_log|pole_2m|pole.*2m|darkwood_pole$|woodiron_pole|stone_pillar|column|pillar$/, 'pole', [0.25, 2, 0.25], 'box'],
  [/pole_1m|pole/i, 'pole', [0.2, 1, 0.2], 'box'],
  [/pillar/i, 'pole', [0.6, 2, 0.6], 'box'],
  // floors and stairs; stone and black marble floors are 1 m thick with the pivot in the middle
  [/stone_floor_2x2|^blackmarble_floor$/, 'floor', [2, 1, 2], 'box'],
  [/floor_4x4|floor_large/, 'floor', [4, 0.25, 4], 'box'],
  [/floor_1x1|floor_triangle|tile_floor_1x1/, 'floor', [1, 0.25, 1], 'box'],
  [/floor/i, 'floor', [2, 0.25, 2], 'box'],
  [/spiralstair/, 'stair', [2, 4, 2], 'box'],
  // a step ladder stands on its pivot and climbs 2 m over 2 m toward its local -z (CLIMB below)
  [/stepladder|ladder/i, 'stair', [1, 2, 2], 'ladder'],
  // a wood or stone stair is 2 m wide and climbs 1 m over 2 m toward its local -z from its pivot at its foot (corpus:
  // stairs stack 1 m up and 2 m on; the game's mesh, 2026-11-09)
  [/stair/i, 'stair', [2, 1, 2], 'stair'],
  // wall torches before the wall rules, or 'piece_walltorch' reads as a 2x2 wall
  [/walltorch/i, 'light', [0.3, 0.8, 0.3], 'prop'],
  // floor torches pivot 0.75 m above their foot (measured by the interior helper, 2026-11-09)
  [/groundtorch/i, 'light', [0.4, 1.5, 0.4], 'box'],
  // rugs before the deco rule, or rug_wolf reads as a wolf carving
  [/^rug_|carpet/i, 'rug', [2.0, 0.05, 2.6], 'prop'],
  // banners hang down from their pivot
  [/banner/i, 'deco', [1, 2, 0.2], 'hang'],
  // openings; the cloth door hangs from its pivot, its leaf along its local z (DOORS below)
  [/cloth_hanging_door/, 'door', [0.2, 2, 2], 'hang'],
  [/door|gate/i, 'door', [2, 2, 0.2], 'box'],
  [/window/i, 'window', [1, 1, 0.2], 'box'],
  [/arch/i, 'wall', [2, 2, 0.3], 'box'],
  // walls by size in the name
  [/wall_4x2|wall4x2/i, 'wall', [4, 2, 0.4], 'box'],
  [/wall_2x1|2x1x1/, 'wall', [2, 1, 1], 'box'],
  [/wall_1x2/i, 'wall', [1, 2, 0.3], 'box'],
  [/wall_2x2|2x2x2|woodwall$|stave_wall/i, 'wall', [2, 2, 0.2], 'box'],
  [/wall_1x1|1x1|stoneblock/i, 'wall', [1, 1, 0.5], 'box'],
  [/2x2x1/, 'wall', [2, 1, 2], 'box'],
  [/wall_half|halfwall/i, 'wall', [2, 1, 0.2], 'box'],
  // 'Wood Wall 1x1': neighbors in the corpus stack 1 m apart up and sideways (it was read as 2 x 0.5 m before 2026-11-09)
  [/wall_quarter|quarterwall/i, 'wall', [1, 1, 0.2], 'box'],
  [/wall_log/, 'wall', [2, 0.5, 0.4], 'box'],
  [/stake_wall|stakewall|sharpstakes/, 'fence', [4, 3, 0.5], 'box'],
  [/fence/, 'fence', [2, 1, 0.2], 'box'],
  [/decowall|divider|wall/i, 'wall', [2, 2, 0.2], 'box'],
  // furniture and work
  [/bed/i, 'bed', [1.3, 0.6, 2.3], 'prop'],
  [/table_round/, 'table', [1.6, 0.9, 1.6], 'prop'],
  [/table|workbench$|piece_workbench$/, 'table', [2, 0.9, 1], 'prop'],
  [/bench|logbench/, 'seat', [2, 0.5, 0.6], 'prop'],
  [/throne/, 'seat', [1, 1.6, 1], 'prop'],
  [/chair|stool|seat/i, 'seat', [0.6, 1, 0.6], 'prop'],
  [/chest|barrel|drawer|crate|ItemDrawer/i, 'storage', [1.2, 0.8, 0.7], 'prop'],
  [/hearth/, 'fire', [3, 0.5, 3], 'prop'],
  [/fire_pit/, 'fire', [1.6, 0.4, 1.6], 'prop'],
  [/cookingstation|cauldron|oven|MeadCauldron/i, 'craft', [1.2, 1, 1.2], 'prop'],
  [/forge|smelter|kiln|blastfurnace|anvil|grindstone|tanning|spinning|stonecutter|artisan|magetable|ext\d|workbench|windmill|refinery|press/i, 'craft', [1.4, 1.4, 1.2], 'prop'],
  [/fermenter|beehive|bathtub|cart/i, 'craft', [1.2, 1.2, 1.2], 'prop'],
  [/itemstand|ArmorStand|sign|banner|trophy|raven|wolf|dragon|shield|xmas|garland|jackoturnip|totem|statue|head/i, 'deco', [1, 1, 0.2], 'prop'],
  [/rug|carpet/i, 'rug', [2.5, 0.05, 2.5], 'prop'],
  [/torch|lantern|brazier|candle|Candle|Lavalantern|wisplure|lamp/i, 'light', [0.4, 1.2, 0.4], 'prop'],
  [/portal/, 'craft', [3, 3, 1], 'prop'],
  [/stack|pile|Placeable_Stone|coal_pile|treasure/i, 'clutter', [1.6, 0.8, 1.2], 'prop'],
  [/Pickable|Bush|bush|Tree|tree|shrub|vines|Vine|Fern|root|Beech|Mushroom|sapling|Plant/, 'nature', [1, 1, 1], 'prop'],
  [/Rock|rock|cliff|Dolmen/, 'nature', [2, 1.5, 2], 'prop'],
  [/guard_stone|ward/i, 'deco', [0.6, 1.5, 0.6], 'prop'],
];

// Exact sizes from the game. 'vh exportpieces' writes BepInEx/config/Villheim/pieces.json; copied here as
// data/pieces-export.json (or named by the VH_PIECES environment variable), its sizes replace the name rules' guesses.
// The name rules stay for role, shape and colour, and for every piece the export does not have. The browser page has
// no file access: it uses the name rules unless the page sets window.VHPiecesExport before this script runs.
let EXPORT;
function exported() {
  if (EXPORT !== undefined) return EXPORT;
  EXPORT = null;
  try {
    if (typeof window !== 'undefined' && window.VHPiecesExport) {
      EXPORT = window.VHPiecesExport.pieces || window.VHPiecesExport;
    } else if (typeof require === 'function' && typeof __dirname !== 'undefined') {
      const fs = require('fs'), path = require('path');
      const file = process.env.VH_PIECES || path.join(__dirname, '../data/pieces-export.json');
      if (fs.existsSync(file)) {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        EXPORT = data.pieces || data;
      }
    }
  } catch (e) {
    EXPORT = null; // a broken export file falls back to the name rules
  }
  return EXPORT;
}

const round = v => Math.round(v * 100) / 100;
const usable = sz => Array.isArray(sz) && sz.length === 3 && sz.every(v => typeof v === 'number' && v > 0.01);

// Furniture sizes measured in the corpus by the interior work (docs/INTERIOR_DESIGN.md), w x h x d.
const SIZES = {
  bed: [1.2, 0.8, 2.8], piece_bed02: [2.0, 1.0, 3.3], hearth: [3.2, 0.6, 2.0], piece_table_oak: [4.2, 0.8, 1.6],
  piece_table_round: [1.7, 0.9, 1.7], fermenter: [1.4, 1.8, 1.4], piece_chest_barrel: [0.7, 1.0, 0.7], ArmorStand: [0.9, 1.9, 0.6],
  piece_logbench01: [1.4, 0.5, 0.6],
};

const meshP = () => (typeof module !== 'undefined' ? require('./mesh.js') : window.VHMesh);
const cache = new Map();
function piece(name) {
  let c = cache.get(name);
  if (c) return c;
  const n = name;
  let role = 'misc', size = [0.8, 0.8, 0.8], shape = 'prop';
  for (const [re, r, s, sh] of RULES) {
    if (re.test(n)) { role = r; size = s; shape = sh; break; }
  }
  if (SIZES[n]) size = SIZES[n];
  const mat = material(n);
  const structural = ['wall', 'floor', 'roof', 'roofTop', 'roofCorner', 'gable', 'beam', 'pole', 'stair', 'door', 'window', 'fence'].includes(role);
  // walls that stand on their pivot in the game (measured from the game's meshes, 2026-11-09): the generator writes
  // walls by their middle, and finish() in generate.js moves these down to their foot
  const onPivot = /^(wood_wall_quarter|Piece_grausten_wall_|Piece_grausten_window_|darkwood_decowall$|crystal_wall_1x1$)/.test(n);
  c = { name, role, size, shape, mat, color: MAT[mat], structural, exact: false, onPivot };
  const e = exported() && exported()[name];
  // furniture and decor take their size from the game's model (lib/mesh.js, data/piece-models.json): what is solid, or
  // what shows when nothing is (rugs, cloth). Walls, floors, roofs and the rest keep the sizes the generator's grid is
  // built on; lab/test_sizes.js holds both to the models.
  const md = !e && !structural && meshP() ? meshP().dims(name) : null;
  if (md) {
    // what hangs or lights (banners, signs, stands, torches) is judged by what shows: a banner's collider is its rod
    const solid = md.solid && md.solid.every(v => v > 0.01) && !['deco', 'light', 'rug'].includes(role);
    // footprint by what is solid, height by what shows (a spit's collider floats over its feet; its legs reach down)
    c.size = (solid ? [md.solid[0], md.show[1], md.solid[2]] : md.show).map(round);
    c.center = (solid ? [md.solidAt[0], md.showAt[1], md.solidAt[2]] : md.showAt).map(round);
    c.exact = true;
  }
  if (e) {
    // Solid colliders first (what the game tests against), the meshes when the piece has none.
    const box = e.collider && usable(e.collider.size) ? e.collider : e.renderer && usable(e.renderer.size) ? e.renderer : null;
    if (box) {
      c.size = box.size.map(round);
      c.center = box.center.map(round);
      c.exact = true;
    }
    // The game's colour sits mostly in its textures; the material tint is kept for reference, the colour by name stays.
    Object.assign(c, {
      pivotFromBottom: e.pivotFromBottom, tint: e.colour, texture: e.texture, category: e.category, comfort: e.comfort,
      cost: e.cost, station: e.station, inBuildMenu: e.inBuildMenu,
    });
  }
  cache.set(name, c);
  return c;
}

/** How many pieces the game export holds (0 without one). */
function exportSize() {
  const e = exported();
  return e ? Object.keys(e).length : 0;
}

// Biome where a piece's hardest material first exists, for the biome rule. Named pieces first (their names do not say
// what they are made of), then by material from the name. Dark wood pieces take tar, which comes from the Plains;
// iron from the Swamp; black marble and Dvergr parts from the Mistlands.
const NEEDS = {
  bed: 'Meadows', piece_bed02: 'Swamp', piece_chest_wood: 'Meadows', piece_chest: 'Swamp', piece_chest_barrel: 'Swamp',
  piece_chest_blackmetal: 'Plains', piece_table: 'Meadows', piece_table_round: 'Meadows', piece_table_oak: 'Swamp',
  piece_chair: 'Meadows', piece_chair02: 'Meadows', piece_chair03: 'Swamp', piece_bench01: 'Meadows', piece_logbench01: 'Black Forest',
  piece_throne01: 'Black Forest', fire_pit: 'Meadows', hearth: 'Black Forest', piece_cookingstation: 'Meadows',
  piece_cookingstation_iron: 'Swamp', piece_cauldron: 'Black Forest', fermenter: 'Swamp', piece_oven: 'Mistlands',
  piece_workbench: 'Meadows', piece_workbench_ext1: 'Meadows', piece_workbench_ext2: 'Black Forest', piece_workbench_ext3: 'Black Forest',
  forge: 'Black Forest', forge_ext1: 'Black Forest', forge_ext2: 'Black Forest', forge_ext3: 'Swamp', smelter: 'Black Forest',
  charcoal_kiln: 'Black Forest', piece_stonecutter: 'Black Forest', piece_spinningwheel: 'Plains', piece_artisanstation: 'Mountain',
  rug_deer: 'Meadows', rug_wolf: 'Mountain', rug_fur: 'Plains', rug_hare: 'Mistlands', rug_straw: 'Meadows', jute_carpet: 'Mistlands',
  itemstand: 'Meadows', itemstandh: 'Meadows', ArmorStand: 'Swamp', sign: 'Meadows', piece_banner01: 'Plains', piece_banner02: 'Plains',
  piece_banner05: 'Plains', piece_groundtorch_wood: 'Meadows', piece_groundtorch: 'Swamp', piece_walltorch: 'Black Forest', wood_window: 'Black Forest',
  piece_brazierceiling01: 'Black Forest', piece_dvergr_lantern: 'Mistlands', Candle_resin: 'Black Forest', wood_stack: 'Meadows',
  wood_fine_stack: 'Meadows', wood_core_stack: 'Black Forest', stone_pile: 'Meadows', coal_pile: 'Black Forest',
  wood_dragon1: 'Meadows', darkwood_raven: 'Plains', darkwood_wolf: 'Plains', piece_jackoturnip: 'Swamp', piece_xmastree: 'Meadows',
  piece_beehive: 'Meadows', piece_bathtub: 'Black Forest', guard_stone: 'Black Forest',
  // the cart takes bronze nails
  Cart: 'Black Forest',
  // cauldron upgrades: turnips for the spice rack, silver for the butcher's table, black metal for the pots and pans,
  // black marble for the mortar, flametal for the rolling pins
  cauldron_ext1_spice: 'Swamp', cauldron_ext3_butchertable: 'Mountain', cauldron_ext4_pots: 'Plains',
  cauldron_ext5_mortarandpestle: 'Mistlands', cauldron_ext6_rollingpins: 'Ashlands',
};
function needs(name) {
  if (NEEDS[name]) return NEEDS[name];
  // hanging cloth doors take red jute (Cultists, Mountain caves); the blue ones blue jute (Mistlands)
  if (/cloth_hanging_door|jute_carpet/.test(name)) return /blue/.test(name) ? 'Mistlands' : 'Mountain';
  if (/(^|_)tar(_|$)/i.test(name)) return 'Plains';
  const m = material(name);
  return {
    wood: 'Meadows', thatch: 'Meadows', stake: 'Meadows', fur: 'Meadows', cloth: 'Meadows', fire: 'Meadows',
    corewood: 'Black Forest', stone: 'Black Forest', darkwood: 'Plains', darkroof: 'Plains', iron: 'Swamp',
    glass: 'Mountain', marble: 'Mistlands', dvergr: 'Mistlands', ashwood: 'Ashlands', grausten: 'Ashlands',
    flametal: 'Ashlands', turf: 'Meadows', green: 'Meadows', bone: 'Meadows', gold: 'Meadows', black: 'Plains',
    white: 'Mountain',
  }[m] || 'Meadows';
}

// Door pieces, measured in the corpus from the walls, beams and floors around 2,500 placed doors (2026-11-09):
//   w, h     the opening the piece fills, metres
//   bottom   the opening's bottom relative to the pivot (wood_door pivots in its middle, 1 m up; the dark wood gate
//            stands on its pivot; the cloth door hangs about 2 m from its pivot, so its pivot is the top of a 2 m
//            opening: hung at 3 m it stopped a metre short of the floor, T-102)
//   along    the piece's local axis the leaf runs along: x for wooden doors, z for the cloth door (it is turned 90
//            degrees against the wall it hangs in, and hangs 0.3 m to one side of the wall's middle)
const DOORS = {
  wood_door: { w: 2, h: 2, bottom: -1, along: 'x', offset: 0 },
  wood_gate: { w: 2, h: 3, bottom: -1, along: 'x', offset: 0 },
  darkwood_gate: { w: 2, h: 4, bottom: 0, along: 'x', offset: 0 },
  // the fence gate (lib/yards.js): snap points at -1.2 and 0.8 along x, 1 m under and over its pivot, so its 2 m
  // opening is 0.2 m to the -x side of the pivot; the leaf is 1.5 m tall
  wood_fence_gate: { w: 2, h: 2, bottom: -1, along: 'x', offset: -0.2 },
  piece_cloth_hanging_door: { w: 2, h: 2, bottom: -2, along: 'z', offset: 0.3 },
  piece_cloth_hanging_door_blue: { w: 2, h: 2, bottom: -2, along: 'z', offset: 0.3 },
  piece_cloth_hanging_door_blue2: { w: 2, h: 2, bottom: -2, along: 'z', offset: 0.3 },
};
function doorSpec(name) { return DOORS[name] || { w: 2, h: 2, bottom: -1, along: 'x', offset: 0, guessed: true }; }

// Placed door to its opening in the world: the middle of the opening at floor level (x, y, z), the wall's yaw, and the
// unit vectors along the wall (ux, uz) and across it (nx, nz).
function doorOpening(p) {
  const s = doorSpec(p.name), a = (p.yaw != null ? p.yaw : yawOfQ(p.q)) * Math.PI / 180;
  const lx = [Math.cos(a), -Math.sin(a)], lz = [Math.sin(a), Math.cos(a)];
  const [u, n] = s.along === 'z' ? [lz, lx] : [lx, lz];
  // the wall's middle is 'offset' along the piece's local x from its pivot (cloth doors hang beside it)
  const x = p.x + lx[0] * s.offset, z = p.z + lx[1] * s.offset;
  return { x, y: p.y + s.bottom, z, w: s.w, h: s.h, ux: u[0], uz: u[1], nx: n[0], nz: n[1], spec: s };
}
function yawOfQ(q) { const [x, y, z, w] = q || [0, 0, 0, 1]; return Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + x * x)) * 180 / Math.PI; }

// Ladders and stairs, measured the same way: wood_stepladder stands on its pivot and climbs 2 m over 2 m toward its
// local -z (the floor above starts 1 m past the pivot that way); wood_stair pivots in its middle, 1 m up, and climbs
// 2 m over 2 m toward its local -z.
const CLIMB = {
  wood_stepladder: { bottom: 0, rise: 2, run: 2 },
  wood_stair: { bottom: 0, rise: 1, run: 2 },
};
function climbSpec(name) { return CLIMB[name] || (/ladder/i.test(name) ? CLIMB.wood_stepladder : /stair/i.test(name) ? CLIMB.wood_stair : null); }

const BIOME_ORDER = ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains', 'Mistlands', 'Ashlands', 'Deep North'];

// Valheim's structural support by material (WearNTear; numbers from the community wiki): a piece on the ground has
// the material's max; each piece up loses the vertical share of its support, each piece out sideways the horizontal
// share; under min it breaks. A piece takes no more than its own material's max, so stone (min 100) on wood (max 100)
// always falls, and stone (horizontal loss 1) cannot reach out sideways at all.
const SUPPORT = {
  wood: { max: 100, min: 10, v: 1 / 8, h: 1 / 5 }, hardwood: { max: 140, min: 10, v: 1 / 10, h: 1 / 6 },
  stone: { max: 1000, min: 100, v: 1 / 8, h: 1 }, iron: { max: 1500, min: 20, v: 1 / 13, h: 1 / 13 },
  marble: { max: 1500, min: 100, v: 1 / 8, h: 1 / 2 }, ashstone: { max: 2000, min: 100, v: 1 / 10, h: 1 / 3 },
};
function supportClass(n) {
  if (/grausten|Ashlands_/i.test(n)) return 'ashstone';
  if (/blackmarble/.test(n)) return 'marble';
  if (/woodiron|iron|dvergr|flametal|metal/i.test(n)) return 'iron';
  if (/^stone_|_stone|stone$/.test(n) && !/crystal/.test(n)) return 'stone';
  if (/_log|corewood|wood_core|roundlog/i.test(n)) return 'hardwood';
  return 'wood';
}
function support(n) { return SUPPORT[supportClass(n)]; }

// Minor decor (Tyler, D-066): small pieces that dress a room. They cost nothing or are paid in the village biome's own
// materials, so any biome may have them; stations, beds, chests, tables, seats, fires and building pieces still need
// their own materials.
const MINOR = /^(rug_|jute_carpet|piece_banner\d|piece_pot\d|ashland_pot|piece_gift\d|piece_mistletoe|piece_xmas|piece_jackoturnip|piece_(Celebration|Fairylight)Garland|Candle_resin|Skull\d|ancient_skull|cloth_hanging_long|fenrirhide_hanging|dvergrprops_(barrel|crate|crate_long|shelf|hooknchain|lantern|lantern_standing)$|treasure_stack$|sign$|sign_notext$|Feast[A-Z]|Mead[A-Z]|BarleyWine$|Bread$|CookedMeat$|Sausages$|Honey|MeatPlatter$|LoxPie$|PiquantPie$|RoastedCrustPie$|SerpentStew$|MashedMeat$|MarinatedGreens$|MisthareSupreme$|QueensJam$|Salad$|Eyescream$|ShocklateSmoothie$|SparklingShroomshake$|SizzlingBerryBroth$|ScorchingMedley$|SpicyMarmalade$|Blueberries$|Raspberry$|Cloudberry$|Carrot$|Onion$|Pukeberries$|Fish\d+$)/;
function minor(name) { return MINOR.test(name); }

// Decor reach (D-080, Tyler 2026-11-10): furniture and decor come from the village's biome and the next one (Meadows
// draws on the Black Forest, the Black Forest on the Swamp, and so on), paid in local stand-ins from the chests (the
// mod's DecorPaidWithAnalogs). Crafting stations, fires, chests and what is built (walls, floors, roofs) keep to the
// village's own biome (D-066).
function decorReach(biome) {
  const i = Math.max(0, BIOME_ORDER.indexOf(biome));
  return BIOME_ORDER[Math.min(BIOME_ORDER.length - 1, i + 1)];
}
function decorOk(name, biome) {
  const info = piece(name), lim = BIOME_ORDER.indexOf(biome);
  // storage keeps to the village's own biome too: the interior library's sets are laid out round the chest they were
  // mined with, and a bigger iron chest from the next biome went into the workbench beside it
  const station = info.structural || ['craft', 'fire', 'storage'].includes(info.role) || /^(piece_workbench|forge|piece_stonecutter|piece_artisanstation|blackforge|piece_magetable|piece_cauldron|piece_oven|smelter|charcoal_kiln|blastfurnace|eitrrefinery|windmill|piece_spinningwheel)/.test(name);
  return BIOME_ORDER.indexOf(needs(name)) <= (station ? lim : BIOME_ORDER.indexOf(decorReach(biome)));
}

// D-131 (Tyler, 2026-11-11): "Wood hearths (s1) and then stone hearths (s2 and s3) acceptable in meadows onward."
// The stone of a hearth (its stack, the alcove floor, the flags under the fire, a front of jambs and an arch or lintel)
// is allowed from s2 in every biome. The generator marks those pieces hearthStone where it places them
// (lib/generate.js hearthStack, hearthstone, hearthFront); the materials check lets a marked piece pass here.
const HEARTH_STONE = /^(stone_wall_(1x1|2x1|4x2)|stone_floor_2x2|stone_arch)$/;
function hearthStoneOk(name, stage) { return HEARTH_STONE.test(name) && +String(stage || 's1').replace(/\D/g, '') >= 2; }

const apiP = { piece, minor, decorReach, decorOk, hearthStoneOk, support, supportClass, SUPPORT, needs, MAT, BIOME_ORDER, exportSize, NEEDS, DOORS, doorSpec, doorOpening, CLIMB, climbSpec };
if (typeof module !== 'undefined') module.exports = apiP;
else window.VHPieces = apiP;
