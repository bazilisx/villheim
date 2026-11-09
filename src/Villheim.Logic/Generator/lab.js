// Villheim blueprint lab, bundled for the game. Made by tools/blueprint-lab/lib/build_engine.js; do not edit.
var window = this;
// ---- pieces.js
(function () {
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

const apiP = { piece, support, supportClass, SUPPORT, needs, MAT, BIOME_ORDER, exportSize, NEEDS, DOORS, doorSpec, doorOpening, CLIMB, climbSpec };
if (typeof module !== 'undefined') module.exports = apiP;
else window.VHPieces = apiP;

})();
// ---- styles.js
(function () {
// Building kits per biome and culture. The piece choices and proportions come from the corpus palettes
// (lab/learn.py, rules.json "palettes" and "shell"); the combinations per culture follow how the corpus builds
// in each style. A kit names the pieces; the generator decides where they go.

const BIOMES = ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains', 'Mistlands', 'Ashlands'];

// Pieces every biome kit has. Later biomes may use earlier biomes' pieces.
const BIOME_KIT = {
  'Meadows': {
    floor: 'wood_floor', floor1: 'wood_floor_1x1', wall: 'woodwall', wallHalf: 'wood_wall_half', wallQuarter: 'wood_wall_quarter',
    pole: 'wood_pole2', pole1: 'wood_pole', poleLong: 'wood_pole2', beam: 'wood_beam', beam1: 'wood_beam_1',
    roof26: 'wood_roof', roof45: 'wood_roof_45', roofTop26: 'wood_roof_top', roofTop45: 'wood_roof_top_45',
    gable26: 'wood_wall_roof', gable45: 'wood_wall_roof_45', door: 'wood_door', gate: 'wood_gate', window: 'wood_window',
    stair: 'wood_stair', ladder: 'wood_stepladder', fence: 'wood_fence', plinth: null, stoneFloor: null,
  },
  'Black Forest': {
    wall: 'wood_wall_log', wallLog: true, poleLong: 'wood_pole_log_4', pole: 'wood_pole_log', plinth: 'stone_wall_2x1',
    stoneWall: 'stone_wall_2x1', stoneWall4: 'stone_wall_4x2', stoneBlock: 'stone_wall_1x1', stoneFloor: 'stone_floor_2x2',
    stoneArch: 'stone_arch', stonePillar: 'stone_pillar', stoneStair: 'stone_stair', beamLog: 'wood_log_26',
  },
  // Dark wood pieces take tar, so they start in the Plains (Tyler, 2026-11-09); the Swamp adds iron.
  'Swamp': { ironBeam: 'woodiron_beam', ironPole: 'woodiron_pole' },
  'Mountain': { window: 'crystal_wall_1x1', glass: 'crystal_wall_1x1' },
  'Plains': {
    pole: 'darkwood_pole', poleLong: 'darkwood_pole4', beam: 'darkwood_beam', beamLong: 'darkwood_beam4x4',
    roof26: 'darkwood_roof', roof45: 'darkwood_roof_45', roofTop26: 'darkwood_roof_top', roofTop45: 'darkwood_roof_top_45',
    decowall: 'darkwood_decowall',
  },
  'Mistlands': {
    wall: 'blackmarble_2x1x1', stoneWall: 'blackmarble_2x1x1', stoneBlock: 'blackmarble_1x1', stoneFloor: 'blackmarble_floor',
    stonePillar: 'blackmarble_column_1', stoneArch: 'blackmarble_arch', plinth: 'blackmarble_2x1x1',
  },
  'Ashlands': {
    wall: 'ashwood_wall_2x2', pole: 'ashwood_pole_2m', poleLong: 'ashwood_pole_2m', beam: 'ashwood_beam_2m', beam1: 'ashwood_beam_1m',
    floor: 'ashwood_floor_2x2', stoneWall: 'Piece_grausten_wall_2x2', stoneWall4: 'Piece_grausten_wall_4x2', stoneFloor: 'Piece_grausten_floor_2x2',
    stoneBlock: 'Piece_grausten_wall_1x2', plinth: 'Piece_grausten_wall_2x2', window: 'Piece_grausten_window_2x2',
    gable26: 'ashwood_wall_roof_26', gable45: 'ashwood_wall_roof_45',
  },
};

// Merge kits up to the biome so later biomes keep earlier pieces they do not replace.
function kitFor(biome) {
  const out = {};
  for (const b of BIOMES) {
    Object.assign(out, BIOME_KIT[b]);
    if (b === biome) break;
  }
  return out;
}

// Roof sets a culture can ask for whatever its biome's kit has: thatch (reed, straw, and the stand-in for turf and
// felt) and dark wood (shingle, slate, lead and tile stand-in; Plains on, as dark wood takes tar).
const ROOF_SETS = {
  thatch: { roof26: 'wood_roof', roof45: 'wood_roof_45', roofTop26: 'wood_roof_top', roofTop45: 'wood_roof_top_45' },
  dark: { roof26: 'darkwood_roof', roof45: 'darkwood_roof_45', roofTop26: 'darkwood_roof_top', roofTop45: 'darkwood_roof_top_45' },
};

// Culture ids that have changed or may change: the id lives here once; a renamed id goes in RENAMED so old requests
// still work. The Mistlands tower culture was 'caucasian-highland' until Tyler named it Lamari (D-046, after Lamaria,
// the Svan hearth goddess).
const ID = { lamari: 'lamari' };
const RENAMED = { 'caucasian-highland': ID.lamari }; // old id: new id

// Culture: how a building is put together. The first block are the village cultures Tyler approved (2026-11-08),
// with the shapes and sizes in docs/CULTURE_STYLES.md. The older lab styles after them stay for the request page
// and the review set; villages do not use them.
//
// Fields the generator reads:
//   roof, pitch, eaves     main roof form, 26 or 45 degrees, eaves rows (2 = one row past the wall, roof to the ground)
//   roofs, walls, plans    weights: roof kinds; wall styles; plan per type and stage ({ home: { s1: { rect: 1 } } })
//   roofSet                'thatch' or 'dark' whatever the biome kit has (dark falls back to thatch before the Plains)
//   forms                  building type to a special form: round, tent, yurt, gables, court, keep, svan, tower-svan,
//                          dome, drum, stave, sunken, open, raised (see generate.js)
//   frame, logWalls, plinth, stilts, stiltH, deck, raised, podklet, porch, dragons, carved, glass, arches, parapet,
//   stoneWalls, courtyard, awnings, opposedDoors, clothDoor, boardwalk, frontWood, buttress
//   size                   per type: octagon side in metres for round forms ({ home: { s1: 2, s2: 4 } })
//   sample                 the types drawn for the culture's overview sheet
const CULTURES = {
  'norse': {
    label: 'Norse', village: true, biomes: ['Meadows'], roof: 'gable', pitch: 45, eaves: 1, frame: true, plinth: 'byBiome', porch: 0.5, dragons: true,
    sample: ['home', 'longhouse', 'smithy'],
    note: 'Steep thatch or darkwood gable, timber frame with posts at every bay, dragon heads on the ridge of halls.',
  },
  'anglo-saxon': {
    label: 'Anglo-Saxon', village: true, biomes: ['Meadows'], roof: 'gable', pitch: 45, eaves: 1, frame: true, porch: 0, opposedDoors: true,
    roofs: { gable: 3, hip: 2 }, walls: { plank: 3, 'half-timber': 1 },
    plans: { home: { s1: { rect: 1 }, s2: { rect: 3, long: 1 }, s3: { long: 2, rect: 1 } }, longhouse: { s1: { long: 1 }, s2: { long: 1 }, s3: { long: 1 } }, temple: { s1: { nave: 1 }, s2: { nave: 1 }, s3: { nave: 1 } } },
    forms: { workshop: 'sunken', sawmill: 'sunken', smithy: 'sunken', storage: 'sunken' },
    sample: ['home', 'longhouse', 'workshop'],
    note: 'Straight-walled timber halls with doors in the middle of both long sides, thatched gable or hip roofs, sunken huts for work.',
  },
  'frankish-norman': {
    label: 'Frankish-Norman', village: true, biomes: ['Meadows'], roof: 'gable', pitch: 45, eaves: 1, frame: true, porch: 0.3,
    roofs: { gable: 5, hip: 1 }, walls: { 'half-timber': 3, plank: 1, 'stone-base': 2, stone: 1 }, buttress: true,
    plans: { home: { s1: { rect: 1 }, s2: { rect: 2, L: 1 }, s3: { L: 2, T: 1 } }, temple: { s1: { nave: 1 }, s2: { nave: 1 }, s3: { nave: 1 } } },
    forms: { tower: 'keep' },
    sample: ['home', 'tower', 'tower@Black Forest', 'workshop'],
    note: 'Timber-framed houses along a street, a keep of timber (Meadows) or stone (later biomes) with flat buttresses and a parapet.',
  },
  'norse-forest': {
    label: 'Norse forest (stave and log)', village: true, biomes: ['Black Forest'], roof: 'gable', pitch: 45, eaves: 1, frame: false, logWalls: true,
    plinth: 'stone', porch: 0.6, dragons: true, carved: true, roofs: { gable: 6, hip: 1 }, walls: { log: 4, plank: 1 },
    forms: { temple: 'stave', storage: 'raised' },
    sample: ['home', 'temple', 'storage'],
    note: 'Log houses on a stone course, raised log storehouses, stave churches with a low gallery roof all round and dragon heads.',
  },
  'celtic': {
    label: 'Celtic (Irish, Scots, Welsh)', village: true, biomes: ['Black Forest'], roof: 'conical', pitch: 45, eaves: 1, frame: true, porch: 0,
    walls: { 'stone-base': 2, stone: 1, plank: 2 },
    forms: { home: 'round', longhouse: 'round', tavern: 'round', smithy: 'round', workshop: 'round', barn: 'round', tower: 'round' },
    plans: { temple: { s1: { rect: 1 }, s2: { nave: 1 }, s3: { nave: 1 } } },
    size: { home: { s1: 2, s2: 4, s3: 4 }, longhouse: { s1: 4, s2: 4, s3: 6 }, tavern: { s1: 4, s2: 4, s3: 6 }, smithy: { s1: 2, s2: 2, s3: 4 },
      workshop: { s1: 2, s2: 2, s3: 4 }, barn: { s1: 4, s2: 4, s3: 4 }, tower: { s1: 2, s2: 2, s3: 2 } },
    sample: ['home', 'longhouse', 'smithy'],
    note: 'Round houses of eight walls under a steep cone of thatch, one door, fire in the middle; tall round stone towers.',
  },
  'slavic': {
    label: 'Slavic (early Rus)', village: true, biomes: ['Black Forest'], roof: 'gable', pitch: 45, eaves: 1, frame: false, logWalls: true, plinth: 'stone',
    porch: 0.8, carved: true, podklet: true, roofs: { gable: 5, hip: 1 }, walls: { log: 1 }, forms: { storage: 'raised' },
    sample: ['home', 'longhouse', 'storage'],
    note: 'Log izba with a steep gable and carved ridge; larger houses stand on a log ground storey (podklet) reached by an outside stair.',
  },
  'celtic-crannog': {
    label: 'Crannog (lake dwellers)', village: true, biomes: ['Swamp'], roof: 'conical', pitch: 45, eaves: 1, frame: true, porch: 0,
    roofSet: 'thatch', stilts: 1, stiltH: 2, deck: 3, boardwalk: true, walls: { plank: 3, 'half-timber': 1 },
    forms: { home: 'round', longhouse: 'round', tavern: 'round', workshop: 'round', smithy: 'round', storage: 'round', temple: 'round' },
    size: { home: { s1: 2, s2: 4, s3: 4 }, longhouse: { s1: 4, s2: 4, s3: 6 }, tavern: { s1: 4, s2: 4, s3: 6 }, workshop: { s1: 2, s2: 2, s3: 4 },
      smithy: { s1: 2, s2: 2, s3: 4 }, storage: { s1: 2, s2: 2, s3: 2 }, temple: { s1: 2, s2: 4, s3: 4 } },
    sample: ['home', 'longhouse', 'workshop'],
    note: 'Round thatched houses on a timber platform over water, a deck round the house and a walkway to the shore.',
  },
  'baltic': {
    label: 'Baltic (lake fort)', village: true, biomes: ['Swamp'], roof: 'gable', pitch: 45, eaves: 1, frame: false, logWalls: true, porch: 0.5,
    roofSet: 'thatch', stilts: 1, stiltH: 1, deck: 2, roofs: { gable: 3, hip: 2 }, walls: { log: 1 },
    forms: { storage: 'raised' }, plans: { longhouse: { s1: { long: 1 }, s2: { long: 1 }, s3: { long: 1 } } },
    sample: ['home', 'longhouse', 'storage'],
    note: 'Log houses packed on a timber platform in a lake, steep thatch, granaries raised on posts.',
  },
  'fen-folk': {
    label: 'Fen folk (Frisian and fenland)', village: true, biomes: ['Swamp'], roof: 'hip', pitch: 45, eaves: 2, frame: true, porch: 0,
    roofSet: 'thatch', raised: 1, stiltChance: 0.4, boardwalk: true, kick: true, roofs: { hip: 4, gable: 1 }, walls: { plank: 2, 'half-timber': 2 },
    plans: { home: { s1: { rect: 1 }, s2: { long: 2, rect: 1 }, s3: { long: 1 } }, longhouse: { s1: { long: 1 }, s2: { long: 1 }, s3: { long: 1 } } },
    forms: { storage: 'open' },
    sample: ['home', 'longhouse', 'workshop'],
    note: 'Long low byre-houses on raised ground with hipped reed roofs coming down near the ground, timber trackways between them.',
  },
  'norse-highland': {
    label: 'Norse highland (Icelandic turf)', village: true, biomes: ['Mountain'], roof: 'gable', pitch: 45, eaves: 1, frame: false, porch: 0,
    roofSet: 'thatch', frontWood: true, walls: { stone: 1 },
    forms: { home: 'gables', longhouse: 'gables', tavern: 'gables', temple: 'gables', storage: 'gables', workshop: 'gables', smithy: 'gables', barn: 'gables' },
    sample: ['home', 'longhouse', 'storage'],
    note: 'Low thick stone walls under a steep roof (thatch stands in for turf), wooden gable fronts in a row facing the yard.',
  },
  'saami': {
    label: 'Saami', village: true, biomes: ['Mountain'], roof: 'conical', pitch: 45, eaves: 1, frame: false, porch: 0, roofSet: 'thatch',
    walls: { stone: 1 }, storeH: 2, typeWalls: { storage: 'log' }, roofs: { gable: 1 }, storeys: { storage: { s1: 1, s2: 1, s3: 1 } },
    bays: { storage: { s1: [2, 3], s2: [2, 3], s3: [3, 3] } },
    forms: { home: 'round', longhouse: 'round', tavern: 'round', workshop: 'tent', smithy: 'tent', storage: 'raised', temple: 'tent', barn: 'tent', camp: 'tent' },
    size: { home: { s1: 2, s2: 2, s3: 2 }, longhouse: { s1: 2, s2: 4, s3: 4 }, tavern: { s1: 2, s2: 4, s3: 4 }, workshop: { s1: 2, s2: 2, s3: 2 },
      smithy: { s1: 2, s2: 2, s3: 2 }, temple: { s1: 2, s2: 2, s3: 2 }, barn: { s1: 2, s2: 2, s3: 2 }, camp: { s1: 2, s2: 2, s3: 2 } },
    sample: ['home', 'longhouse', 'storage', 'workshop'],
    note: 'Goahti: low round huts with a stone and turf wall and a cone with a smoke hole; lavvu tents; small storehouses high on posts.',
  },
  'byzantine': {
    label: 'Byzantine', village: true, biomes: ['Plains', 'Mistlands'], roof: 'gable', pitch: 26, eaves: 1, frame: false, porch: 0.2,
    roofSet: 'dark', stoneWalls: true, arches: true, storeyH: 3, roofs: { gable: 3, hip: 2 }, walls: { stone: 4, 'stone-base': 1 },
    plans: { home: { s1: { rect: 1 }, s2: { rect: 2, L: 2 }, s3: { L: 2, U: 1 } } },
    forms: { temple: 'dome' }, storeys: { home: { s1: 1, s2: 2, s3: 2 } },
    sample: ['home', 'temple', 'temple@Mistlands', 'workshop'],
    note: 'Stone houses of one or two storeys under low tile roofs; cross-in-square churches with a dome on a drum over four columns.',
  },
  'steppe': {
    label: 'Steppe (Khazar and Turkic camps)', village: true, biomes: ['Plains'], roof: 'conical', pitch: 26, eaves: 1, frame: false, porch: 0,
    roofSet: 'thatch', clothDoor: true, walls: { 'half-timber': 1 },
    forms: { home: 'yurt', longhouse: 'yurt', tavern: 'yurt', temple: 'yurt', storage: 'yurt', workshop: 'open', smithy: 'open', sawmill: 'open' },
    size: { home: { s1: 4, s2: 4, s3: 4 }, longhouse: { s1: 4, s2: 6, s3: 6 }, tavern: { s1: 4, s2: 4, s3: 6 }, temple: { s1: 4, s2: 4, s3: 4 }, storage: { s1: 2, s2: 2, s3: 2 } },
    sample: ['home', 'longhouse', 'workshop'],
    note: 'Round felt tents on a lattice wall under a low cone with an open crown; open sunshades for work.',
  },
  [ID.lamari]: {
    label: 'Lamari', village: true, biomes: ['Mistlands'], roof: 'gable', pitch: 26, eaves: 1, frame: false, porch: 0,
    roofSet: 'dark', stoneWalls: true, storeyH: 3, roofs: { gable: 4, hip: 1 }, walls: { stone: 1 },
    forms: { home: 'svan', tower: 'tower-svan', temple: 'drum' }, storeys: { home: { s1: 1, s2: 2, s3: 2 } },
    sample: ['home', 'tower', 'temple', 'workshop'],
    note: 'Two-storey stone houses with a tall square tower beside them, low slate roofs, hall churches with a drum and a cone.',
  },
  'middle-eastern': {
    label: 'Middle Eastern (Persian and Arab)', village: true, biomes: ['Plains'], roof: 'flat', parapet: true, frame: false, stoneWalls: true, arches: true,
    courtyard: true, awnings: true, rugs: 2, clothDoor: true, forms: { tavern: { s2: 'court', s3: 'court' }, home: { s3: 'court' } },
    plans: { home: { s1: { rect: 1 }, s2: { U: 2, rect: 1 } } },
    sample: ['home', 'tavern', 'workshop'],
    note: 'Flat roofs with parapets, thick stone walls, arched doors, cloth awnings; houses and caravanserais round a courtyard with an arcade.',
  },
  // ---- older lab styles (not village cultures)
  'black-forest': {
    label: 'Black Forest log (lab)', roof: 'gable', pitch: 45, eaves: 1, frame: true, logWalls: true, plinth: 'stone', porch: 0.6,
    note: 'Log walls on a stone footing, steep roof, short porch.',
  },
  'swamp': {
    label: 'Swamp stilt', roof: 'gable', pitch: 26, eaves: 2, frame: true, stilts: 1.6, porch: 0.9, ironTrim: true,
    note: 'Raised on darkwood stilts with a deck all round, low wide darkwood roof, iron trim.',
  },
  'mountain': {
    label: 'Mountain lodge', roof: 'gable', pitch: 45, eaves: 1, frame: true, plinth: 'stone', plinthHigh: true, porch: 0.3, glass: true,
    note: 'Tall stone base against the snow, steep roof, glass windows.',
  },
  'east-asian': {
    label: 'East Asian (lab)', roof: 'gable', pitch: 26, eaves: 2, frame: true, raised: 0.5, darkFrame: true, lanterns: true, porch: 1,
    note: 'Raised floor, dark timber grid on light walls, wide low eaves, lanterns.',
  },
  'castle-medieval': {
    label: 'Medieval (lab)', roof: 'gable', pitch: 45, eaves: 1, frame: true, stoneGround: true, jetty: true, porch: 0.2,
    note: 'Stone ground floor, timber upper floor set out over the street, steep roof.',
  },
  'dwarven': {
    label: 'Dwarven (lab)', roof: 'flat', parapet: true, frame: false, stoneWalls: true, arches: true, lanterns: true,
    note: 'Heavy stone or black marble blocks, flat roofs, arches, many lanterns.',
  },
};

// Cultures a biome's villages come from when none is asked for, with weights (provisional, Tyler 2026-11-08; Mountain even, D-039). Up to
// three per biome. Ashlands has no approved culture yet and keeps the lab's medieval style.
const BIOME_CULTURE = {
  'Meadows': { 'norse': 5, 'anglo-saxon': 3, 'frankish-norman': 2 },
  'Black Forest': { 'norse-forest': 5, 'celtic': 3, 'slavic': 3 },
  'Swamp': { 'celtic-crannog': 3, 'baltic': 3, 'fen-folk': 3 },
  'Mountain': { 'norse-highland': 1, 'saami': 1 },
  'Plains': { 'middle-eastern': 3, 'byzantine': 3, 'steppe': 3 },
  'Mistlands': { 'byzantine': 3, [ID.lamari]: 4 },
  'Ashlands': { 'castle-medieval': 1 },
};

// A culture key as asked, an old key renamed since, or null.
function cultureKey(k) {
  if (!k) return null;
  const key = RENAMED[k] || k;
  return CULTURES[key] ? key : null;
}

// A culture for a biome: weighted by BIOME_CULTURE, R a random source (0..1). Without R, the heaviest.
function cultureFor(biome, R) {
  const w = BIOME_CULTURE[biome] || BIOME_CULTURE.Meadows;
  const e = Object.entries(w);
  if (!R) return e.sort((a, b) => b[1] - a[1])[0][0];
  let x = R() * e.reduce((s, [, v]) => s + v, 0);
  for (const [k, v] of e) if ((x -= v) <= 0) return k;
  return e[0][0];
}

// Roof pieces for a culture in a biome: the kit's own, or the culture's roof set where the biome has it.
function roofKit(K, C, biome) {
  const order = BIOMES.indexOf(biome);
  if (C.roofSet === 'thatch') return { ...K, ...ROOF_SETS.thatch };
  if (C.roofSet === 'dark') return { ...K, ...(order >= BIOMES.indexOf('Plains') ? ROOF_SETS.dark : ROOF_SETS.thatch) };
  return K;
}

// Building types: footprint in 2 m bays per stage (from the corpus shell numbers, scaled to one building without its
// yard), storeys, and how it opens.
const TYPES = {
  home:      { label: 'House', bays: { s1: [3, 2], s2: [4, 3], s3: [5, 4] }, storeys: { s1: 1, s2: 1, s3: 2 }, use: 'home' },
  longhouse: { label: 'Longhouse', bays: { s1: [6, 3], s2: [8, 4], s3: [11, 5] }, storeys: { s1: 1, s2: 1, s3: 1 }, tall: 1, use: 'hall', aisles: true },
  tavern:    { label: 'Tavern', bays: { s1: [5, 4], s2: [7, 4], s3: [8, 5] }, storeys: { s1: 1, s2: 2, s3: 2 }, use: 'hall' },
  smithy:    { label: 'Smithy', bays: { s1: [3, 2], s2: [4, 3], s3: [5, 4] }, storeys: { s1: 1, s2: 1, s3: 1 }, open: 'front', use: 'smithy' },
  sawmill:   { label: 'Woodworker', bays: { s1: [3, 2], s2: [4, 3], s3: [6, 3] }, storeys: { s1: 1, s2: 1, s3: 1 }, open: 'sides', use: 'workshop' },
  workshop:  { label: 'Workshop', bays: { s1: [3, 3], s2: [4, 3], s3: [5, 4] }, storeys: { s1: 1, s2: 1, s3: 2 }, use: 'workshop' },
  barn:      { label: 'Barn and pen', bays: { s1: [3, 3], s2: [5, 4], s3: [6, 5] }, storeys: { s1: 1, s2: 1, s3: 1 }, tall: 1, use: 'farm', pen: true, bigDoor: true },
  farm:      { label: 'Crop farm', bays: { s1: [2, 2], s2: [3, 2], s3: [4, 3] }, storeys: { s1: 1, s2: 1, s3: 1 }, use: 'farm', field: true },
  storage:   { label: 'Storehouse', bays: { s1: [2, 2], s2: [3, 3], s3: [5, 3] }, storeys: { s1: 1, s2: 1, s3: 2 }, use: 'storage', raised: 0.5 },
  tower:     { label: 'Watchtower', bays: { s1: [2, 3], s2: [3, 3], s3: [3, 3] }, storeys: { s1: 3, s2: 4, s3: 5 }, use: 'guard', tower: true },
  dock:      { label: 'Dock and boathouse', bays: { s1: [3, 2], s2: [4, 3], s3: [6, 4] }, storeys: { s1: 1, s2: 1, s3: 1 }, use: 'workshop', dock: true, open: 'front' },
  stall:     { label: 'Market stall', bays: { s1: [2, 1], s2: [3, 2], s3: [4, 2] }, storeys: { s1: 1, s2: 1, s3: 1 }, use: 'market', open: 'all', low: true },
  temple:    { label: 'Temple', bays: { s1: [3, 2], s2: [5, 3], s3: [7, 4] }, storeys: { s1: 1, s2: 1, s3: 1 }, tall: 2, use: 'temple' },
  well:      { label: 'Well', bays: { s1: [1, 1], s2: [1, 1], s3: [2, 2] }, storeys: { s1: 1, s2: 1, s3: 1 }, use: 'yard', well: true, open: 'all', low: true },
  camp:      { label: 'Camp', bays: { s1: [2, 2], s2: [3, 2], s3: [3, 3] }, storeys: { s1: 1, s2: 1, s3: 1 }, use: 'yard', camp: true },
};

const api = { BIOMES, kitFor, CULTURES, BIOME_CULTURE, TYPES, ROOF_SETS, cultureFor, roofKit, ID, RENAMED, cultureKey };
if (typeof module !== 'undefined') module.exports = api;
else window.VHStyles = api;

})();
// ---- blueprint.js
(function () {
// Read and write PlanBuild .blueprint files.
function parse(text) {
  const meta = {}, pieces = [], snaps = [];
  let mode = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line[0] === '#') {
      const i = line.indexOf(':');
      const key = i < 0 ? line.slice(1) : line.slice(1, i);
      if (['Pieces', 'SnapPoints', 'Terrain'].includes(key)) mode = key;
      else meta[key] = line.slice(i + 1).replace(/^"|"$/g, '');
      continue;
    }
    const p = line.split(';');
    if (mode === 'Pieces' && p.length >= 9) {
      const n = p.slice(2, 9).map(Number);
      if (n.some(isNaN)) continue;
      const s = p.length >= 13 ? p.slice(10, 13).map(Number) : [1, 1, 1];
      pieces.push({ name: p[0], cat: p[1], x: n[0], y: n[1], z: n[2], q: n.slice(3, 7),
        s: s.some(isNaN) ? [1, 1, 1] : s, info: p[9] || '', data: p[13] || '' });
    } else if (mode === 'SnapPoints' && p.length === 3) snaps.push(p.map(Number));
  }
  return { meta, pieces, snaps };
}

const f = v => (Math.abs(v) < 1e-6 ? 0 : +v.toFixed(4)).toString();

function write(bp) {
  const m = bp.meta || {};
  const out = [`#Name:${m.Name || 'Villheim design'}`, `#Creator:${m.Creator || 'Villheim generator'}`,
    `#Description:"${(m.Description || '').replace(/"/g, "'")}"`, `#Category:${m.Category || 'Villheim'}`];
  if (bp.snaps && bp.snaps.length) { out.push('#SnapPoints'); for (const s of bp.snaps) out.push(s.map(f).join(';')); }
  out.push('#Pieces');
  for (const p of bp.pieces) {
    const q = p.q || [0, 0, 0, 1], s = p.s || [1, 1, 1];
    out.push([p.name, p.cat || 'Building', f(p.x), f(p.y), f(p.z), f(q[0]), f(q[1]), f(q[2]), f(q[3]),
      JSON.stringify(p.info || ''), f(s[0]), f(s[1]), f(s[2])].join(';') + (p.data ? ';' + p.data : ''));
  }
  return out.join('\n') + '\n';
}

if (typeof module !== 'undefined') module.exports = { parse, write };
else window.VHBlueprint = { parse, write };

})();
// ---- checks.js
(function () {
// Checks on a design: every piece supported, no doubled or crushed pieces, doors you can walk through, headroom
// under roofs and ceilings, ladders and stairs you can climb, materials the biome has, and room left to move inside.
// Rough, from piece boxes and the measured shapes of roofs, doors and ladders; good for catching mistakes.

const NODE_C = typeof module !== 'undefined';
const PC = NODE_C ? require('./pieces.js') : window.VHPieces;

// A player is about 1.8 m tall. Walkable rooms need 2.4 m clear under every roof and ceiling piece; a doorway needs its
// own height, and 2.3 m in front of it and behind it, for a metre each way.
const HEADROOM = 2.4, DOOR_CLEAR = 2.3, CORRIDOR = 1.0, WALL_MIN = 2.5;

function yawOf(q) { const [x, y, z, w] = q || [0, 0, 0, 1]; return Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + x * x)) * 180 / Math.PI; }
function tilted(q) { return q && (Math.abs(q[0]) > 0.02 || Math.abs(q[2]) > 0.02); }
function yawDeg(p) { return p.yaw != null ? p.yaw : yawOf(p.q); }

// A point in a piece's own frame: u along its local x, v along its local z.
function localOf(p, x, z) {
  const a = yawDeg(p) * Math.PI / 180, dx = x - p.x, dz = z - p.z;
  return [dx * Math.cos(a) - dz * Math.sin(a), dx * Math.sin(a) + dz * Math.cos(a)];
}

function aabb(p) {
  const info = PC.piece(p.name);
  let [w, h, d] = info.size;
  const s = p.s || [1, 1, 1];
  w *= s[0]; h *= s[1]; d *= s[2];
  if (info.role === 'door' && !tilted(p.q)) {
    const o = PC.doorOpening(p), hw = o.w / 2, ex = Math.abs(o.ux) * hw + Math.abs(o.nx) * 0.1, ez = Math.abs(o.uz) * hw + Math.abs(o.nz) * 0.1;
    return { x0: o.x - ex, x1: o.x + ex, y0: o.y, y1: o.y + o.h, z0: o.z - ez, z1: o.z + ez, info };
  }
  const a = yawDeg(p) * Math.PI / 180, c = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a));
  const ex = (w * c + d * sn) / 2, ez = (w * sn + d * c) / 2;
  const prop = info.shape === 'prop' || info.shape === 'cap' || info.shape === 'tri' || info.shape === 'triInv' || info.onPivot;
  let y0 = prop ? p.y : p.y - h / 2, y1 = prop ? p.y + h : p.y + h / 2;
  if (info.shape === 'hang') { y0 = p.y - h; y1 = p.y; }
  if (info.shape === 'slope26') { y0 = p.y - 0.15; y1 = p.y + h; }
  const climb = info.role === 'stair' && PC.climbSpec(p.name);
  if (climb && (info.shape === 'stair' || info.shape === 'ladder')) { y0 = p.y + climb.bottom; y1 = y0 + climb.rise; }
  if (tilted(p.q)) { const m = Math.max(w, h, d) / 2; return { x0: p.x - m, x1: p.x + m, y0: p.y - m, y1: p.y + m, z0: p.z - m, z1: p.z + m, info }; }
  return { x0: p.x - ex, x1: p.x + ex, y0, y1, z0: p.z - ez, z1: p.z + ez, info };
}

// Height of the underside of a roof or ceiling piece over a world point, or null when the piece is not over it.
// Roof pieces run 2 m along their local z and rise toward local -z; a 26 degree piece pivots on its low edge, a 45
// degree one in its middle (BLUEPRINT_LAB.md). Hip corners are taken at their low edge, ridge caps 0.3 m below
// their pivot, floors and level beams at the bottom of their box.
function underside(p, x, z, info) {
  info = info || PC.piece(p.name);
  if (tilted(p.q)) return null;
  const sh = info.shape, s = p.s || [1, 1, 1];
  const w = info.size[0] * s[0], h = info.size[1] * s[1], d = info.size[2] * s[2];
  const roofish = ['roof', 'roofTop', 'roofCorner'].includes(info.role);
  const level = info.role === 'floor' || (info.role === 'beam' && sh === 'box');
  if (!roofish && !level) return null;
  const [u, v] = localOf(p, x, z);
  if (Math.abs(u) > w / 2 + 0.01 || Math.abs(v) > d / 2 + 0.01) return null;
  if (level) return p.y - h / 2;
  if (sh === 'cap') return p.y - 0.3;
  if (sh === 'hipcorner26' || sh === 'hipcorner45') return p.y - 0.1;
  if (sh === 'slope26') return p.y + h * (d / 2 - v) / d - 0.1;
  if (sh === 'slope45' || sh === 'slope67') return p.y - h * v / d - 0.1;
  return p.y - 0.1;
}

// Grid of boxes for fast neighbour search.
function index(boxes) {
  const g = new Map(), k = (i, j) => i * 100003 + j;
  boxes.forEach((b, n) => {
    for (let i = Math.floor(b.x0 / 2); i <= Math.floor(b.x1 / 2); i++) for (let j = Math.floor(b.z0 / 2); j <= Math.floor(b.z1 / 2); j++) {
      const key = k(i, j); if (!g.has(key)) g.set(key, []); g.get(key).push(n);
    }
  });
  // pad 1 also returns pieces in the cells round the box (for touching with a margin); pad 0 only those whose box can
  // reach into it, which is all a point or a small column needs
  const none = [];
  return (b, pad = 1) => {
    const ia = Math.floor(b.x0 / 2) - pad, ib = Math.floor(b.x1 / 2) + pad, ja = Math.floor(b.z0 / 2) - pad, jb = Math.floor(b.z1 / 2) + pad;
    if (ia === ib && ja === jb) return g.get(k(ia, ja)) || none;
    const out = new Set();
    for (let i = ia; i <= ib; i++) for (let j = ja; j <= jb; j++) for (const n of g.get(k(i, j)) || none) out.add(n);
    return out;
  };
}
const touch = (a, b, e) => a.x0 <= b.x1 + e && b.x0 <= a.x1 + e && a.y0 <= b.y1 + e && b.y0 <= a.y1 + e && a.z0 <= b.z1 + e && b.z0 <= a.z1 + e;
const vol = a => Math.max(0, a.x1 - a.x0) * Math.max(0, a.y1 - a.y0) * Math.max(0, a.z1 - a.z0);
function inter(a, b) {
  return Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));
}
const ptBox = (x, y0, y1, z, r = 0.05) => ({ x0: x - r, x1: x + r, y0, y1, z0: z - r, z1: z + r });

// Walls on a 0.25 m grid, for "is this point inside walls" and "is it right against a wall".
const WALLISH = ['wall', 'door', 'window', 'gable'];
function wallGrid(pieces, boxes) {
  const g = new Map(), key = (i, j) => i * 100003 + j;
  pieces.forEach((p, n) => {
    const b = boxes[n];
    if (!WALLISH.includes(b.info.role) || tilted(p.q)) return;
    const s = p.s || [1, 1, 1], w = b.info.size[0] * s[0], d = Math.max(0.2, b.info.size[2] * s[2]);
    for (let i = Math.round(b.x0 * 4); i <= Math.round(b.x1 * 4); i++) for (let j = Math.round(b.z0 * 4); j <= Math.round(b.z1 * 4); j++) {
      const [u, v] = localOf(p, i / 4, j / 4);
      if (b.info.role !== 'door' && (Math.abs(u) > w / 2 + 0.13 || Math.abs(v) > d / 2 + 0.13)) continue;
      const k = key(i, j);
      if (!g.has(k)) g.set(k, []);
      g.get(k).push([b.y0, b.y1, w]);
    }
  });
  const at = (x, z, y, minW = 0) => (g.get(key(Math.round(x * 4), Math.round(z * 4))) || []).some(([a, c, w]) => a <= y && y <= c && w >= minW);
  // Per floor height, maps on the same 0.25 m grid: which cells have walls on all four sides within 14 m, and sums for
  // "a wall within r" at a few heights. Built once per height; the checks ask thousands of points.
  let i0 = Infinity, i1 = -Infinity, j0 = Infinity, j1 = -Infinity;
  for (const k of g.keys()) {
    const i = Math.round(k / 100003), j = k - i * 100003;
    if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j;
  }
  const nx = i1 - i0 + 1, nz = j1 - j0 + 1;
  const levels = new Map();
  const level = y => {
    const lk = Math.round(y * 20);
    if (levels.has(lk)) return levels.get(lk);
    const N = nx * nz, ray = new Uint8Array(N), ins = new Uint8Array(N);
    const sums = {};
    const mk = (h, minW) => {
      const a = new Uint8Array(N), yy = y + h;
      for (const [k, list] of g) if (list.some(([lo, hi, w]) => lo <= yy && yy <= hi && w >= minW)) { const i = Math.round(k / 100003), j = k - i * 100003; a[(i - i0) * nz + (j - j0)] = 1; }
      return a;
    };
    const lo = mk(0.6, 0), hi = mk(1.2, 0);
    for (let n = 0; n < N; n++) ray[n] = lo[n] | hi[n];
    // walls within 14 m (56 cells) in each direction
    const R = 56, seen = new Int32Array(N).fill(0);
    const pass = (outer, inner, idx) => {
      for (let a = 0; a < outer; a++) { let last = -1e9; for (let b = 0; b < inner; b++) { const n = idx(a, b); if (ray[n]) last = b; else if (b - last <= R) seen[n]++; } }
    };
    pass(nx, nz, (a, b) => a * nz + b); pass(nx, nz, (a, b) => a * nz + (nz - 1 - b));
    pass(nz, nx, (a, b) => b * nz + a); pass(nz, nx, (a, b) => (nx - 1 - b) * nz + a);
    for (let n = 0; n < N; n++) ins[n] = seen[n] === 4 ? 1 : 0;
    const prefix = a => { const P = new Int32Array((nx + 1) * (nz + 1)); for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) P[(i + 1) * (nz + 1) + j + 1] = a[i * nz + j] + P[i * (nz + 1) + j + 1] + P[(i + 1) * (nz + 1) + j] - P[i * (nz + 1) + j]; return P; };
    const L = { ins, sums, mk, prefix };
    levels.set(lk, L);
    return L;
  };
  const cell = (x, z) => [Math.round(x * 4) - i0, Math.round(z * 4) - j0];
  const boxSum = (P, i, j, r) => {
    const a0 = Math.max(0, i - r), a1 = Math.min(nx - 1, i + r), b0 = Math.max(0, j - r), b1 = Math.min(nz - 1, j + r);
    if (a0 > a1 || b0 > b1) return 0;
    return P[(a1 + 1) * (nz + 1) + b1 + 1] - P[a0 * (nz + 1) + b1 + 1] - P[(a1 + 1) * (nz + 1) + b0] + P[a0 * (nz + 1) + b0];
  };
  return {
    at,
    // walls on all four sides within 14 m, at knee or chest height, so a window opening does not count as a way out
    inside(x, y, z) {
      if (!g.size) return false;
      const [i, j] = cell(x, z);
      if (i < 0 || j < 0 || i >= nx || j >= nz) return false;
      return level(y).ins[i * nz + j] === 1;
    },
    // a wall within r metres at height y + h (of at least minW metres wide)
    near(x, y, z, r, h = 1.2, minW = 0) {
      if (!g.size) return false;
      const L = level(y), k = `${h}|${minW}`;
      if (!L.sums[k]) L.sums[k] = L.prefix(L.mk(h, minW));
      const [i, j] = cell(x, z);
      return boxSum(L.sums[k], i, j, Math.round(r * 4)) > 0;
    },
  };
}

// Floor points a person walks on: 0.5 m apart on top of every floor piece (and stair landing), with the floor's top.
function floorPoints(pieces, boxes) {
  const pts = [];
  pieces.forEach((p, n) => {
    const b = boxes[n];
    if (b.info.role !== 'floor' || tilted(p.q)) return;
    const s = p.s || [1, 1, 1], w = b.info.size[0] * s[0], d = b.info.size[2] * s[2];
    const a = yawDeg(p) * Math.PI / 180, lx = [Math.cos(a), -Math.sin(a)], lz = [Math.sin(a), Math.cos(a)];
    for (let u = -w / 2 + 0.25; u < w / 2; u += 0.5) for (let v = -d / 2 + 0.25; v < d / 2; v += 0.5)
      pts.push({ x: p.x + lx[0] * u + lz[0] * v, z: p.z + lx[1] * u + lz[1] * v, y: b.y1, floor: n });
  });
  return pts;
}

// The space a person needs to walk through a door: its opening, then 2.3 m up for a metre in front and behind.
// Returns the pieces in the way (indices).
function doorBlockers(o, pieces, boxes, near, skip) {
  const out = new Set();
  const hw = 0.45;
  for (let s = -CORRIDOR; s <= CORRIDOR + 0.001; s += 0.2) {
    const inPlane = Math.abs(s) < 0.55;
    const yLo = o.y + 0.25, yHi = o.y + (inPlane ? Math.min(o.h, DOOR_CLEAR) - 0.05 : DOOR_CLEAR);
    for (let t = -hw; t <= hw + 0.001; t += hw / 2) {
      const x = o.x + o.nx * s + o.ux * t, z = o.z + o.nz * s + o.uz * t;
      const col = ptBox(x, yLo, yHi, z);
      for (const j of near(col, 0)) {
        if (skip && skip(j)) continue;
        const b = boxes[j], role = b.info.role;
        if (['floor', 'rug', 'door', 'stair', 'nature', 'misc'].includes(role)) continue;
        const u = underside(pieces[j], x, z, b.info);
        if (u != null) { if (u > yLo && u < yHi) out.add(j); continue; }
        if (role === 'beam' && b.info.shape !== 'box') continue; // braces lie in the wall beside the door
        if (touch(col, b, -0.02)) {
          // walls and gables over the opening, in its own wall, are its lintel
          if (inPlane && WALLISH.includes(role) && b.y0 >= o.y + o.h - 0.06) continue;
          out.add(j);
        }
      }
    }
  }
  return [...out];
}

// Ladder and stair pieces as lines: bottom and top points and the climbing direction.
function climbs(pieces) {
  const out = [];
  pieces.forEach((p, n) => {
    const info = PC.piece(p.name);
    if (info.role !== 'stair') return;
    const c = PC.climbSpec(p.name);
    if (!c || /spiral/.test(p.name)) return;
    const a = yawDeg(p) * Math.PI / 180, dx = -Math.sin(a), dz = -Math.cos(a), half = c.run / 2;
    const y0 = p.y + c.bottom;
    out.push({ n, p, dx, dz, bx: p.x - dx * half, bz: p.z - dz * half, by: y0, tx: p.x + dx * half, tz: p.z + dz * half, ty: y0 + c.rise, run: c.run, rise: c.rise });
  });
  // a piece continues another when its end lies on the other's line (stacked ladders, long stairs)
  const onLine = (L, x, y, z, lo, hi) => {
    const t = (x - L.bx) * L.dx + (z - L.bz) * L.dz, px = L.bx + L.dx * t, pz = L.bz + L.dz * t;
    return t > lo && t < hi && Math.hypot(px - x, pz - z) < 0.3 && Math.abs(L.by + t * L.rise / L.run - y) < 0.3;
  };
  for (const L of out) {
    const par = out.filter(M => M !== L && M.dx * L.dx + M.dz * L.dz > 0.9);
    L.continuesBelow = par.some(M => onLine(M, L.bx, L.by, L.bz, 0.05, M.run + 0.05));
    L.continuesAbove = par.some(M => onLine(M, L.tx, L.ty, L.tz, -0.05, M.run - 0.05));
  }
  return out;
}

function stability(pieces, boxes, near, ground) {
  const n = pieces.length, sup = new Float64Array(n).fill(-1), mat = new Array(n);
  const heap = [];
  const push = i => { heap.push(i); let k = heap.length - 1; while (k > 0) { const pk = (k - 1) >> 1; if (sup[heap[pk]] >= sup[heap[k]]) break; [heap[pk], heap[k]] = [heap[k], heap[pk]]; k = pk; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && sup[heap[l]] > sup[heap[m]]) m = l; if (r < heap.length && sup[heap[r]] > sup[heap[m]]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  for (let i = 0; i < n; i++) {
    if (!boxes[i].info.structural) continue;
    mat[i] = PC.support(pieces[i].name);
    if (boxes[i].y0 <= ground + 0.1) { sup[i] = mat[i].max; push(i); }
  }
  const done = new Uint8Array(n);
  while (heap.length) {
    const i = pop();
    if (done[i]) continue;
    done[i] = 1;
    const a = boxes[i];
    for (const j of near(a)) {
      if (j === i || !mat[j] || done[j]) continue;
      const o = boxes[j];
      if (!touch(a, o, 0.02)) continue;
      const cx = (o.x0 + o.x1) / 2, cy = (o.y0 + o.y1) / 2, cz = (o.z0 + o.z1) / 2;
      const px = Math.max(a.x0, Math.min(a.x1, cx)), py = Math.max(a.y0, Math.min(a.y1, cy)), pz = Math.max(a.z0, Math.min(a.z1, cz));
      if (py > cy + 0.05) continue; // a piece is held from below or beside, never from above
      const d = Math.hypot(px - cx, py - cy, pz - cz);
      // arches stand on their feet, which the boxes here do not show
      const t = d < 1e-3 || /arch/.test(pieces[j].name) ? 1 : Math.acos(1 - Math.abs(py - cy) / d) / (Math.PI / 2);
      const loss = mat[j].h + (mat[j].v - mat[j].h) * t;
      const got = Math.min(mat[j].max, sup[i] * (1 - loss));
      if (got > sup[j] + 1e-6) { sup[j] = got; push(j); }
    }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (mat[i] && sup[i] < mat[i].min) out.push(i);
  return out;
}

function check(design, biome) {
  const pieces = design.pieces;
  const boxes = pieces.map(aabb);
  const near = index(boxes);
  const ys = boxes.filter(b => b.info.structural).map(b => b.y0).sort((a, b) => a - b);
  const ground = design.ground != null ? design.ground : ys.length ? ys[Math.floor(ys.length * 0.02)] : 0;
  const results = [];

  // support: Valheim holds a piece up through any touching piece that is itself held up, back to the ground.
  // Walk outward from everything that stands on the ground; whatever is never reached floats.
  const held = new Array(boxes.length).fill(false), queue = [];
  boxes.forEach((b, i) => { if (b.y0 <= ground + 0.35) { held[i] = true; queue.push(i); } });
  while (queue.length) {
    const i = queue.pop(), b = boxes[i];
    for (const j of near(b)) {
      if (held[j]) continue;
      const o = boxes[j];
      if (touch(b, o, 0.16) && (b.info.structural || o.info.role === 'craft' || o.info.role === 'deco' || o.info.role === 'light')) { held[j] = true; queue.push(j); }
    }
  }
  const unsupported = pieces.filter((p, i) => !held[i] && (boxes[i].info.structural || ['craft', 'storage', 'bed', 'table', 'seat', 'fire'].includes(boxes[i].info.role))).map(p => p.name);
  results.push({ check: 'support', ok: unsupported.length === 0, detail: unsupported.length ? `${unsupported.length} pieces not connected to the ground (${[...new Set(unsupported)].slice(0, 4).join(', ')})` : 'every piece connects to the ground' });

  // stability: Valheim's support by material, from the ground up (pieces.js SUPPORT). Each piece takes the best
  // support any touching piece below or beside it passes on: that piece's support less the share the receiving
  // material loses that way (straight down: vertical loss; sideways: horizontal loss; in between, a blend), never more
  // than its own material's max. Under its material's min it falls.
  const crumble = stability(pieces, boxes, near, ground);
  results.push({ check: 'stability', ok: crumble.length === 0,
    detail: crumble.length ? `${crumble.length} pieces would fall (${[...new Set(crumble.map(i => pieces[i].name))].slice(0, 4).join(', ')})` : 'every piece holds by its material' });

  // doubles and crushed pieces
  let doubles = 0, crushed = 0;
  const seen = new Map();
  pieces.forEach((p, i) => {
    const key = `${p.name}|${p.x.toFixed(1)}|${p.y.toFixed(1)}|${p.z.toFixed(1)}|${Math.round(yawOf(p.q))}`;
    if (seen.has(key)) doubles++; else seen.set(key, i);
    const b = boxes[i];
    if (!b.info.structural || ['roof', 'roofTop', 'roofCorner', 'gable', 'beam', 'pole', 'stair'].includes(b.info.role)) return;
    for (const j of near(b)) {
      if (j <= i) continue;
      const o = boxes[j];
      if (o.info.role !== b.info.role || !o.info.structural) continue;
      const v = inter(b, o), m = Math.min(vol(b), vol(o));
      if (m > 0.05 && v / m > 0.6 && pieces[j].name !== p.name) crushed++;
    }
  });
  results.push({ check: 'overlap', ok: doubles === 0 && crushed <= 2, detail: `${doubles} doubled, ${crushed} pieces inside another of the same kind` });

  // doors: nothing in the doorway or in the metre in front and behind it up to 2.3 m, and something to step on
  const doors = pieces.map((p, i) => i).filter(i => boxes[i].info.role === 'door');
  const blockedBy = new Set();
  let blocked = 0, noStep = 0;
  const pts = floorPoints(pieces, boxes);
  const standAt = (x, y, z) => {
    if (y <= ground + 0.6) return true;
    const col = ptBox(x, y - 0.7, y + 0.3, z, 0.3);
    for (const j of near(col, 0)) {
      const b = boxes[j];
      if (!['floor', 'stair'].includes(b.info.role) && !(b.info.role === 'wall' && b.y1 <= y + 0.05)) continue;
      if (touch(col, b, 0)) return true;
    }
    return false;
  };
  for (const i of doors) {
    const o = PC.doorOpening(pieces[i]);
    const hit = doorBlockers(o, pieces, boxes, near, j => j === i);
    if (hit.length) { blocked++; hit.forEach(j => blockedBy.add(pieces[j].name)); }
    for (const sg of [-1, 1]) if (!standAt(o.x + o.nx * sg * 0.9, o.y, o.z + o.nz * sg * 0.9)) noStep++;
  }
  results.push({ check: 'doors', ok: blocked === 0 && noStep === 0,
    detail: doors.length ? `${doors.length} doors, ${blocked} blocked${blockedBy.size ? ` (${[...blockedBy].slice(0, 4).join(', ')})` : ''}, ${noStep} sides with nothing to step on` : 'no doors (open building)' });

  // headroom: every floor point inside walls has 2.4 m clear under roofs, ceilings and beams; points right against a
  // wall are left out (nobody stands in the wall)
  const walls = wallGrid(pieces, boxes);
  let low = 0, inside = 0;
  const lowBy = new Set(), where = [];
  for (const pt of pts) {
    // the lowest roof or ceiling over the point; a floor open to the sky (a roof terrace, a yard) is left out
    const col = ptBox(pt.x, pt.y + 0.05, pt.y + 30, pt.z);
    let lowest = Infinity, by = null;
    for (const j of near(col, 0)) {
      if (j === pt.floor) continue;
      const u = underside(pieces[j], pt.x, pt.z, boxes[j].info);
      if (u != null && u > pt.y + 0.05 && u < lowest) { lowest = u; by = pieces[j].name; }
    }
    if (!isFinite(lowest)) continue;
    if (!walls.inside(pt.x, pt.y, pt.z) || walls.near(pt.x, pt.y, pt.z, 0.45)) continue;
    inside++;
    let bad = lowest < pt.y + HEADROOM - 0.01 ? by : null;
    // walls at least 2.5 m tall: a point beside a wall needs wall at that height too (from the floor piece's middle)
    if (!bad && walls.near(pt.x, pt.y, pt.z, 1.0, 0.6, 1.9) && !walls.near(pt.x, pt.y - 0.15, pt.z, 1.6, WALL_MIN - 0.05)) bad = 'walls under 2.5 m';
    if (bad) { low++; lowBy.add(bad); if (where.length < 6) where.push({ x: +pt.x.toFixed(2), y: +pt.y.toFixed(2), z: +pt.z.toFixed(2), under: bad }); }
  }
  results.push({ check: 'headroom', ok: low === 0, where,
    detail: low ? `${low} of ${inside} floor points under ${HEADROOM} m or by low walls (${[...lowBy].slice(0, 4).join(', ')})` : `${inside} floor points inside, all with ${HEADROOM} m or more and walls of ${WALL_MIN} m or more` });

  // ladders and stairs: room to stand at the foot, a floor to step onto at the top, and the climb itself clear
  const ls = climbs(pieces);
  const climbIdx = new Set(ls.map(L => L.n));
  const problems = [];
  for (const L of ls) {
    const name = L.p.name;
    if (!L.continuesBelow) {
      // a metre of clear floor (or ground) in front of the foot
      let clear = true;
      for (let t = 0.2; t <= 1.0 + 0.001; t += 0.4) {
        const x = L.bx - L.dx * t, z = L.bz - L.dz * t;
        if (!standAt(x, L.by + 0.05, z)) clear = false;
        const col = ptBox(x, L.by + 0.3, L.by + 1.8, z, 0.3);
        for (const j of near(col, 0)) {
          if (climbIdx.has(j)) continue;
          const b = boxes[j];
          if (['floor', 'rug', 'nature', 'misc'].includes(b.info.role)) continue;
          const u = underside(pieces[j], x, z, b.info);
          if (u != null ? u > col.y0 && u < col.y1 : touch(col, b, -0.02)) { clear = false; break; }
        }
      }
      if (!clear) problems.push(`${name}: no room at the foot`);
    }
    if (!L.continuesAbove) {
      const x = L.tx + L.dx * 0.5, z = L.tz + L.dz * 0.5;
      if (!standAt(x, L.ty + 0.1, z)) problems.push(`${name}: nothing to step onto at the top`);
    }
    // head room along the climb: nothing over the steps lower than 1.9 m above them
    let hit = null;
    for (let t = 0.25; t <= L.run - 0.25 + 0.001 && !hit; t += 0.25) {
      const x = L.bx + L.dx * t, z = L.bz + L.dz * t, y = L.by + t * L.rise / L.run;
      const col = ptBox(x, y + 0.3, y + 1.9, z, 0.23);
      for (const j of near(col, 0)) {
        if (climbIdx.has(j)) continue;
        const b = boxes[j];
        if (!b.info.structural || ['door', 'stair'].includes(b.info.role)) continue;
        if (b.info.role === 'floor' && b.y1 <= y + 0.35) continue; // the landing at the top
        const u = underside(pieces[j], x, z, b.info);
        if (u != null ? u > col.y0 && u < col.y1 : touch(col, b, -0.02)) { hit = pieces[j].name; break; }
      }
    }
    if (hit) problems.push(`${name}: ${hit} over the climb`);
  }
  results.push({ check: 'ladders', ok: problems.length === 0,
    detail: ls.length ? (problems.length ? `${problems.length} problems: ${[...new Set(problems)].slice(0, 3).join('; ')}` : `${ls.length} ladder and stair pieces, all climbable`) : 'no ladders or stairs' });

  // beds: every house and longhouse sleeps someone, in a bed its biome can make (Tyler, T-102)
  const kind = design.request && design.request.type;
  if (['home', 'longhouse'].includes(kind)) {
    const ord = PC.BIOME_ORDER, limit = biome ? ord.indexOf(biome) : 99;
    const beds = pieces.filter(p => PC.piece(p.name).role === 'bed' && ord.indexOf(PC.needs(p.name)) <= limit).length;
    results.push({ check: 'beds', ok: beds > 0, detail: beds ? `${beds} beds` : `no bed in this ${kind}` });
  }

  // woodpiles stand outside: none under a roof inside walls
  const piles = pieces.filter((p, i) => /^wood_(fine_|core_)?stack$/.test(p.name) && walls.inside(p.x, p.y, p.z) &&
    [...near(ptBox(p.x, p.y + 0.5, p.y + 30, p.z), 0)].some(j => j !== i && (underside(pieces[j], p.x, p.z, boxes[j].info) ?? -1) > p.y + 0.5));
  results.push({ check: 'woodpiles', ok: piles.length === 0, detail: piles.length ? `${piles.length} woodpiles indoors` : 'no woodpiles indoors' });

  // materials for the biome, building pieces and furnishing alike
  if (biome) {
    const ord = PC.BIOME_ORDER, limit = ord.indexOf(biome);
    const over = [...new Set(pieces.filter(p => ord.indexOf(PC.needs(p.name)) > limit).map(p => p.name))];
    results.push({ check: 'materials', ok: over.length === 0, detail: over.length ? `needs later biomes: ${over.slice(0, 5).join(', ')}` : `all pieces available in ${biome}` });
  }

  // room to move: share of floor not covered by furniture
  const floors = boxes.filter(b => b.info.role === 'floor');
  const furn = boxes.filter(b => ['bed', 'table', 'seat', 'storage', 'craft', 'fire', 'clutter', 'deco'].includes(b.info.role) && b.y0 < b.y1);
  let area = 0, used = 0;
  for (const f of floors) {
    const fa = (f.x1 - f.x0) * (f.z1 - f.z0); area += fa;
    for (const u of furn) if (u.y0 >= f.y1 - 0.3 && u.y0 <= f.y1 + 0.5) used += Math.max(0, Math.min(f.x1, u.x1) - Math.max(f.x0, u.x0)) * Math.max(0, Math.min(f.z1, u.z1) - Math.max(f.z0, u.z0));
  }
  const free = area ? 1 - used / area : 1;
  results.push({ check: 'space', ok: free >= 0.45, detail: `${Math.round(free * 100)} % of the floor is free to walk` });
  return results;
}

const apiC = { check, stability, aabb, underside, localOf, doorBlockers, index, HEADROOM, DOOR_CLEAR, CORRIDOR };
if (NODE_C) module.exports = apiC; else window.VHChecks = apiC;

})();
// ---- features.js
(function () {
// Numbers that describe a design, used by the scorer. The same code runs on the corpus (for training) and on
// generated designs (for ranking), so both are measured the same way.
const NODE_F = typeof module !== 'undefined';
const PF = NODE_F ? require('./pieces.js') : window.VHPieces;
const NAMES = ['log_pieces', 'log_kinds', 'wall', 'floor', 'roof', 'beam', 'pole', 'openings', 'furniture', 'deco', 'light',
  'nature', 'misc', 'mat_entropy', 'decor_density', 'height_ratio', 'log_area', 'levels', 'diag', 'roof_cover', 'top_mat_share'];
function yawOf(q) { const [x, y, z, w] = q || [0, 0, 0, 1]; return Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + x * x)) * 180 / Math.PI; }
function features(pieces) {
  const n = pieces.length || 1, roles = {}, mats = {}, kinds = new Set();
  let st = [];
  for (const p of pieces) {
    const i = PF.piece(p.name); roles[i.role] = (roles[i.role] || 0) + 1; kinds.add(p.name);
    if (i.structural) { st.push(p); mats[i.mat] = (mats[i.mat] || 0) + 1; }
  }
  if (!st.length) st = pieces;
  const q = (a, t) => a[Math.min(a.length - 1, Math.floor(a.length * t))];
  const xs = st.map(p => p.x).sort((a, b) => a - b), zs = st.map(p => p.z).sort((a, b) => a - b), ys = st.map(p => p.y).sort((a, b) => a - b);
  const w = Math.max(1, q(xs, 0.97) - q(xs, 0.03)), l = Math.max(1, q(zs, 0.97) - q(zs, 0.03)), h = Math.max(0.5, q(ys, 0.98) - q(ys, 0.05));
  const floors = pieces.filter(p => PF.piece(p.name).role === 'floor');
  const floorArea = floors.reduce((s, p) => s + PF.piece(p.name).size[0] * PF.piece(p.name).size[2], 0) || w * l;
  const roofArea = pieces.filter(p => ['roof', 'roofCorner'].includes(PF.piece(p.name).role)).length * 4;
  const lv = {}; for (const f of floors) { const k = Math.round(f.y * 2); lv[k] = (lv[k] || 0) + 1; }
  const tot = Object.values(mats).reduce((a, b) => a + b, 0) || 1;
  const ent = -Object.values(mats).reduce((s, c) => s + c / tot * Math.log(c / tot), 0);
  const r = k => (roles[k] || 0) / n;
  const furn = ['bed', 'table', 'seat', 'storage', 'fire', 'craft'].reduce((s, k) => s + (roles[k] || 0), 0);
  const deco = (roles.deco || 0) + (roles.rug || 0) + (roles.clutter || 0);
  return {
    log_pieces: Math.log(n), log_kinds: Math.log(kinds.size), wall: r('wall'), floor: r('floor'),
    roof: r('roof') + r('roofTop') + r('roofCorner') + r('gable'), beam: r('beam'), pole: r('pole'),
    openings: r('door') + r('window'), furniture: furn / n, deco: deco / n, light: r('light'), nature: r('nature'), misc: r('misc'),
    mat_entropy: ent, decor_density: (furn + deco + (roles.light || 0)) / floorArea, height_ratio: h / Math.sqrt(w * l),
    log_area: Math.log(w * l), levels: Object.values(lv).filter(c => c >= 4).length,
    diag: st.filter(p => { const a = ((yawOf(p.q) % 90) + 90) % 90; return Math.abs(a - 45) < 30; }).length / st.length,
    roof_cover: Math.min(3, roofArea / Math.max(1, floorArea)), top_mat_share: Math.max(...Object.values(mats), 0) / tot,
  };
}
function score(model, pieces) {
  const f = features(pieces);
  let z = model.bias;
  NAMES.forEach((k, i) => { z += model.w[i] * ((f[k] - model.mean[i]) / (model.std[i] || 1)); });
  return 1 / (1 + Math.exp(-z));
}
if (NODE_F) module.exports = { features, score, NAMES }; else window.VHFeatures = { features, score, NAMES };

})();
// ---- decorate.js
(function () {
// Decorator: furnishes every floor of a building at decor stage d1 (bare needs), d2 (lived in) or d3 (rich), or
// strips a design down. Works on generated buildings and on any existing blueprint.
//
// What goes where comes from the best-liked builds in the corpus (lab/learn_interior.py, data/interior-lite.json,
// notes in docs/INTERIOR_DESIGN.md): beds head to a wall far from the door with a chest at the foot, tables in the
// middle or against a side wall with seats facing them, stations against walls, a clear way in at every door and
// clear paths to the fire, the stairs and the ladders, wall pieces centered on a wall face and never over a window or
// a door, floor torches standing on the floor at their own height. Rooms are read from the pieces themselves (floors,
// walls, doors, windows, stairs, ceilings), so heights and wall thicknesses are whatever the building has.

const NODE_D = typeof module !== 'undefined';
const P = NODE_D ? require('./pieces.js') : window.VHPieces;
let RULES = null, LEARN = null;
function setRules(r) { RULES = r; }
function setInterior(d) { LEARN = d; }
if (NODE_D) { try { LEARN = require('../data/interior-lite.json'); } catch (e) { LEARN = null; } }
function learned() { return LEARN || (typeof window !== 'undefined' && window.VH_INTERIOR) || { items: {}, rooms: {}, doors: {} }; }

const ORDER = ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains', 'Mistlands', 'Ashlands', 'Deep North'];

// ---------------------------------------------------------------- furniture facts
// s: [width (local x), height, depth (local z)], measured in the corpus where it could be (ray distances to walls and
// spacing between two of the same; see docs/INTERIOR_DESIGN.md). Pivots are in the middle of the footprint.
// at: floor (stands free), wall (back to a wall), mount (hung on a wall), rug, top (on a table), fire (on a fire),
// hang (from the ceiling). rel: turn from the wall's inward normal when standing against a wall (0: local +z faces
// the room). base: pivot height above the floor (floor torches stand 0.75 m below their pivot). b: the first biome
// whose village can make it, the lower of the game's notes (design-list.csv) and the recipe.
const F = {
  bed: { s: [1.2, 0.8, 2.8], at: 'wall', b: 'Meadows', cat: 'bed' },
  piece_bed02: { s: [2.0, 1.0, 3.3], at: 'wall', b: 'Swamp', cat: 'bed' },
  ashwood_bed: { s: [1.6, 1.0, 2.8], at: 'wall', b: 'Ashlands', cat: 'bed' },
  piece_chest_wood: { s: [1.3, 0.8, 0.75], at: 'wall', b: 'Meadows', cat: 'storage' },
  piece_chest_barrel: { s: [0.7, 1.0, 0.7], at: 'wall', b: 'Black Forest', cat: 'storage' },
  piece_chest: { s: [1.4, 0.9, 0.8], at: 'wall', b: 'Swamp', cat: 'storage' },
  piece_chest_blackmetal: { s: [1.6, 1.0, 0.9], at: 'wall', b: 'Plains', cat: 'storage' },
  piece_table: { s: [2.0, 0.8, 0.9], at: 'floor', b: 'Meadows', cat: 'table', top: 0.75 },
  piece_table_round: { s: [1.7, 0.8, 1.7], at: 'floor', b: 'Black Forest', cat: 'table', top: 0.75, round: true },
  piece_table_oak: { s: [4.2, 0.8, 1.6], at: 'floor', b: 'Swamp', cat: 'table', top: 0.75 },
  piece_chair: { s: [0.6, 0.6, 0.6], at: 'floor', b: 'Meadows', cat: 'seat' },
  piece_chair02: { s: [0.7, 1.1, 0.7], at: 'floor', b: 'Black Forest', cat: 'seat' },
  piece_chair03: { s: [0.8, 1.2, 0.8], at: 'floor', b: 'Swamp', cat: 'seat' },
  piece_bench01: { s: [2.0, 0.9, 0.7], at: 'floor', b: 'Meadows', cat: 'seat', long: true },
  piece_logbench01: { s: [1.4, 0.5, 0.6], at: 'floor', b: 'Black Forest', cat: 'seat', long: true, back: true },
  piece_throne01: { s: [1.2, 2.0, 1.0], at: 'wall', b: 'Swamp', cat: 'seat' },
  fire_pit: { s: [1.4, 0.4, 1.4], at: 'floor', b: 'Meadows', cat: 'fire' },
  hearth: { s: [3.2, 0.6, 2.0], at: 'floor', b: 'Swamp', cat: 'fire' },
  piece_cookingstation: { s: [2.0, 0.8, 0.5], at: 'fire', b: 'Meadows', cat: 'craft', lift: 0.25 },
  piece_cookingstation_iron: { s: [2.0, 0.8, 0.6], at: 'fire', b: 'Swamp', cat: 'craft', lift: 0.25 },
  piece_cauldron: { s: [1.0, 0.8, 1.0], at: 'fire', b: 'Black Forest', cat: 'craft', lift: 0.25 },
  fermenter: { s: [1.4, 1.8, 1.4], at: 'wall', b: 'Black Forest', cat: 'craft', tall: true },
  piece_workbench: { s: [1.8, 1.0, 1.0], at: 'wall', b: 'Meadows', cat: 'craft' },
  piece_workbench_ext1: { s: [0.8, 0.8, 0.8], at: 'wall', b: 'Meadows', cat: 'craft' },
  piece_workbench_ext2: { s: [1.6, 1.8, 0.5], at: 'wall', b: 'Meadows', cat: 'craft', tall: true },
  piece_workbench_ext3: { s: [0.9, 0.9, 0.9], at: 'wall', b: 'Black Forest', cat: 'craft' },
  piece_workbench_ext4: { s: [1.6, 1.6, 0.5], at: 'wall', b: 'Swamp', cat: 'craft', tall: true },
  forge: { s: [1.6, 2.2, 1.0], at: 'wall', b: 'Black Forest', cat: 'craft', tall: true },
  forge_ext1: { s: [1.0, 0.8, 0.6], at: 'wall', b: 'Black Forest', cat: 'craft' },
  forge_ext2: { s: [0.8, 1.0, 0.8], at: 'wall', b: 'Black Forest', cat: 'craft' },
  forge_ext3: { s: [0.9, 1.0, 1.0], at: 'wall', b: 'Swamp', cat: 'craft' },
  forge_ext4: { s: [1.0, 0.8, 0.8], at: 'wall', b: 'Black Forest', cat: 'craft' },
  forge_ext5: { s: [1.6, 1.6, 0.5], at: 'wall', b: 'Black Forest', cat: 'craft', tall: true },
  forge_ext6: { s: [1.2, 0.8, 0.8], at: 'wall', b: 'Swamp', cat: 'craft' },
  piece_stonecutter: { s: [1.6, 1.2, 1.2], at: 'wall', b: 'Swamp', cat: 'craft' },
  // kitchen pieces from the Mistlands, for the kitchen templates; sizes estimated from screenshots, not measured yet
  piece_oven: { s: [1.6, 1.8, 1.4], at: 'wall', b: 'Mistlands', cat: 'craft', tall: true },
  piece_preptable: { s: [2.0, 1.0, 1.0], at: 'wall', b: 'Mistlands', cat: 'craft' },
  piece_artisanstation: { s: [2.0, 1.4, 1.0], at: 'wall', b: 'Mountain', cat: 'craft' },
  piece_spinningwheel: { s: [1.0, 1.4, 1.4], at: 'wall', b: 'Plains', cat: 'craft', rel: 270 },
  piece_cartographytable: { s: [2.0, 1.0, 1.6], at: 'floor', b: 'Black Forest', cat: 'table' },
  ArmorStand: { s: [0.9, 1.9, 0.6], at: 'wall', b: 'Swamp', cat: 'deco', tall: true },
  itemstand: { s: [0.6, 0.6, 0.25], at: 'mount', b: 'Meadows', cat: 'deco', wall: 0.14, y: 1.6 },
  itemstandh: { s: [0.9, 0.2, 0.5], at: 'top', b: 'Meadows', cat: 'deco' },
  sign: { s: [1.0, 0.5, 0.1], at: 'mount', b: 'Black Forest', cat: 'deco', wall: 0.12, y: 1.3 },
  piece_banner01: { s: [1.0, 2.0, 0.1], at: 'mount', b: 'Black Forest', cat: 'deco', wall: 0.2, under: 0.33, rel: 90 },
  piece_banner02: { s: [1.0, 2.0, 0.1], at: 'mount', b: 'Black Forest', cat: 'deco', wall: 0.2, under: 0.33, rel: 90 },
  piece_banner03: { s: [1.0, 2.0, 0.1], at: 'mount', b: 'Black Forest', cat: 'deco', wall: 0.2, under: 0.33, rel: 90 },
  piece_banner04: { s: [1.0, 2.0, 0.1], at: 'mount', b: 'Swamp', cat: 'deco', wall: 0.2, under: 0.33, rel: 90 },
  piece_banner05: { s: [1.0, 2.0, 0.1], at: 'mount', b: 'Swamp', cat: 'deco', wall: 0.2, under: 0.33, rel: 90 },
  wood_dragon1: { s: [0.5, 1.2, 1.0], at: 'mount', b: 'Black Forest', cat: 'deco', wall: -0.1, y: 1.7, rel: 90 },
  darkwood_raven: { s: [0.6, 1.2, 0.8], at: 'mount', b: 'Swamp', cat: 'deco', wall: -0.1, y: 1.7, rel: 90 },
  darkwood_wolf: { s: [0.6, 1.2, 0.8], at: 'mount', b: 'Swamp', cat: 'deco', wall: -0.1, y: 1.7, rel: 90 },
  piece_groundtorch_wood: { s: [0.4, 1.6, 0.4], at: 'floor', b: 'Meadows', cat: 'light', base: 0.75 },
  piece_groundtorch: { s: [0.4, 1.6, 0.4], at: 'floor', b: 'Swamp', cat: 'light', base: 0.75 },
  piece_groundtorch_green: { s: [0.4, 1.6, 0.4], at: 'floor', b: 'Swamp', cat: 'light', base: 0.75 },
  piece_groundtorch_mist: { s: [0.4, 1.6, 0.4], at: 'floor', b: 'Mistlands', cat: 'light', base: 0.75 },
  piece_walltorch: { s: [0.3, 0.7, 0.4], at: 'mount', b: 'Black Forest', cat: 'light', wall: 0.28, y: 1.55, rel: 270 },
  piece_dvergr_lantern: { s: [0.4, 0.7, 0.4], at: 'mount', b: 'Mistlands', cat: 'light', wall: -0.1, under: 0.35, rel: 90 },
  piece_brazierceiling01: { s: [0.8, 1.6, 0.8], at: 'hang', b: 'Swamp', cat: 'light', under: 1.6 },
  Candle_resin: { s: [0.2, 0.3, 0.2], at: 'top', b: 'Mountain', cat: 'light' },
  rug_deer: { s: [2.0, 0.05, 2.5], at: 'rug', b: 'Meadows', cat: 'rug' },
  rug_wolf: { s: [2.0, 0.05, 2.6], at: 'rug', b: 'Mountain', cat: 'rug' },
  jute_carpet: { s: [2.0, 0.05, 3.0], at: 'rug', b: 'Mountain', cat: 'rug' },
  rug_fur: { s: [2.4, 0.05, 3.0], at: 'rug', b: 'Plains', cat: 'rug' },
  rug_straw: { s: [2.0, 0.05, 2.6], at: 'rug', b: 'Plains', cat: 'rug' },
  rug_hare: { s: [2.0, 0.05, 2.5], at: 'rug', b: 'Mistlands', cat: 'rug' },
  jute_carpet_blue: { s: [2.0, 0.05, 3.0], at: 'rug', b: 'Mistlands', cat: 'rug' },
  rug_asksvin: { s: [2.4, 0.05, 2.8], at: 'rug', b: 'Ashlands', cat: 'rug' },
  treasure_stack: { s: [0.5, 0.3, 0.5], at: 'top', b: 'Black Forest', cat: 'deco' },
  dvergrprops_crate: { s: [1.2, 1.0, 0.8], at: 'wall', b: 'Mistlands', cat: 'storage' },
  dvergrprops_barrel: { s: [0.8, 1.1, 0.8], at: 'wall', b: 'Mistlands', cat: 'storage' },
  wood_stack: { s: [2.0, 1.0, 1.0], at: 'out', b: 'Meadows', cat: 'clutter' },
  wood_fine_stack: { s: [2.0, 1.0, 1.0], at: 'out', b: 'Black Forest', cat: 'clutter' },
  wood_core_stack: { s: [2.0, 1.0, 1.0], at: 'out', b: 'Black Forest', cat: 'clutter' },
  stone_pile: { s: [1.6, 0.8, 1.6], at: 'out', b: 'Meadows', cat: 'clutter' },
  coal_pile: { s: [1.6, 0.8, 1.6], at: 'out', b: 'Black Forest', cat: 'clutter' },
};
// Older names kept for callers that read the table.
const ITEM_BIOME = {};
for (const [k, v] of Object.entries(F)) ITEM_BIOME[k] = v.b;

const bi = b => { const i = ORDER.indexOf(b); return i < 0 ? 0 : i; };
const ok = (name, biome) => !!F[name] && bi(F[name].b) <= bi(biome);
const ok0 = ok;
const size = name => (F[name] ? F[name].s : P.piece(name).size);
// Biome where a culture's own taste is wanted: no tar, darkwood, black marble or Plains goods before their biome.
// Choice lists per kind of piece; the learned shares in each room kind weight the choice.
const KIT = {
  bed: ['bed', 'piece_bed02', 'ashwood_bed'],
  chest: ['piece_chest_wood', 'piece_chest_barrel', 'piece_chest', 'piece_chest_blackmetal'],
  table: ['piece_table', 'piece_table_round', 'piece_table_oak'],
  chair: ['piece_chair', 'piece_chair02', 'piece_chair03'],
  bench: ['piece_bench01', 'piece_logbench01'],
  rug: ['rug_deer', 'rug_wolf', 'jute_carpet', 'rug_fur', 'rug_straw', 'rug_hare', 'jute_carpet_blue', 'rug_asksvin'],
  floorLight: ['piece_groundtorch_wood', 'piece_groundtorch', 'piece_groundtorch_green', 'piece_groundtorch_mist'],
  wallLight: ['piece_walltorch', 'piece_dvergr_lantern'],
  banner: ['piece_banner01', 'piece_banner02', 'piece_banner03', 'piece_banner04', 'piece_banner05'],
  carving: ['wood_dragon1', 'darkwood_raven', 'darkwood_wolf'],
  stack: ['wood_stack', 'wood_fine_stack', 'wood_core_stack'],
};

// Culture taste: what a culture leans to or leaves out (docs/CULTURE_STYLES.md).
const CULTURE_TASTE = {
  saami: { noTable: true, seat: 'bench', rugs: 2 },
  steppe: { noTable: true, seat: 'bench', rugs: 2 },
  'middle-eastern': { seat: 'bench', rugs: 2 },
  'east-asian': { seat: 'bench', rugs: 1.5 },
  'castle-medieval': { banners: 1.5 },
  byzantine: { banners: 1.3 },
  dwarven: { lights: 1.4 },
};

// ---------------------------------------------------------------- small helpers
const PI = Math.PI;
function quatY(yaw) { const a = yaw * PI / 360; return [0, +Math.sin(a).toFixed(6), 0, +Math.cos(a).toFixed(6)]; }
function yawOf(q) { const [x, y, z, w] = q || [0, 0, 0, 1]; return Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + x * x)) * 180 / PI; }
const norm = a => ((a % 360) + 360) % 360;
const yawOfDir = (nx, nz) => norm(Math.atan2(nx, nz) * 180 / PI);
const pyaw = p => (p.yaw != null ? p.yaw : yawOf(p.q));
function rngFrom(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
// weighted pick, deterministic for the same R
function pickW(R, list) {
  const tot = list.reduce((a, [, w]) => a + w, 0);
  if (tot <= 0) return list.length ? list[0][0] : null;
  let r = R() * tot;
  for (const [v, w] of list) { r -= w; if (r <= 0) return v; }
  return list[list.length - 1][0];
}

// Oriented boxes on the ground plane. Local +x of a yaw is (cos, -sin) in world x, z; local +z is (sin, cos).
function obox(x, z, w, d, yaw) { const a = yaw * PI / 180; return { x, z, hw: w / 2, hd: d / 2, c: Math.cos(a), s: Math.sin(a), r: Math.hypot(w, d) / 2 }; }
function overlap(a, b, m) {
  const rr = (a.r != null ? a.r : Math.hypot(a.hw, a.hd)) + (b.r != null ? b.r : Math.hypot(b.hw, b.hd)) + m;
  if (Math.abs(b.x - a.x) > rr || Math.abs(b.z - a.z) > rr) return false;
  const axes = [[a.c, -a.s], [a.s, a.c], [b.c, -b.s], [b.s, b.c]];
  const dx = b.x - a.x, dz = b.z - a.z;
  for (const [ax, az] of axes) {
    const ra = a.hw * Math.abs(a.c * ax - a.s * az) + a.hd * Math.abs(a.s * ax + a.c * az);
    const rb = b.hw * Math.abs(b.c * ax - b.s * az) + b.hd * Math.abs(b.s * ax + b.c * az);
    if (Math.abs(dx * ax + dz * az) >= ra + rb + m) return false;
  }
  return true;
}
function ptDist(b, x, z) {
  const dx = x - b.x, dz = z - b.z;
  const lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
  return Math.hypot(Math.max(0, Math.abs(lx) - b.hw), Math.max(0, Math.abs(lz) - b.hd));
}
function corners(b, shrink = 0) {
  const hw = Math.max(0.01, b.hw - shrink), hd = Math.max(0.01, b.hd - shrink), out = [];
  for (const [u, v] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd], [0, -hd], [0, hd], [-hw, 0], [hw, 0], [0, 0]])
    out.push([b.x + u * b.c + v * b.s, b.z - u * b.s + v * b.c]);
  return out;
}

const CU = [-1, 1, 1, -1, 0, 0, -1, 1], CV = [-1, -1, 1, 1, -1, 1, 0, 0];

// ---------------------------------------------------------------- reading a floor of a building
// Furniture stands this far above its floor piece's pivot (learned from the corpus, data/interior-lite.json stand).
function standOf(name) {
  const st = learned().stand || {};
  if (st[name] != null) return st[name];
  if (name === 'stone_floor_2x2' || name === 'stone_floor' || name === 'blackmarble_floor') return 0.5;
  if (/grausten_floor/i.test(name)) return 0.25;
  return 0.1;
}
const WALLISH = new Set(['wall', 'door', 'window', 'fence']);
const BLOCKING = new Set(['wall', 'door', 'window', 'fence', 'pole', 'stair']);
const OVERHEAD = new Set(['floor', 'roof', 'roofTop', 'roofCorner', 'beam', 'gable']);
const isGlass = n => /crystal|glass|window/i.test(n);

const SB = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
function structBox(p) {
  if (SB) { const c = SB.get(p); if (c && c.x === p.x && c.y === p.y && c.z === p.z) return c.v; }
  const v = structBox0(p);
  if (SB) SB.set(p, { x: p.x, y: p.y, z: p.z, v });
  return v;
}
function structBox0(p) {
  const info = P.piece(p.name);
  const [w, h, d] = info.size;
  const prop = info.shape === 'prop' || info.shape === 'cap' || info.shape === 'tri' || info.shape === 'triInv' || info.onPivot;
  const y0 = prop ? p.y : p.y - h / 2, y1 = prop ? p.y + h : p.y + h / 2;
  return { p, info, role: info.role, b: obox(p.x, p.z, w, d, pyaw(p)), y0, y1 };
}

const G = 0.5; // grid step

// A 2 m bucket index of boxes, so a query looks only at what is near.
function indexOf(list, getB) {
  const m = new Map(), K = 2;
  for (const it of list) {
    const b = getB(it), r = b.r != null ? b.r : Math.hypot(b.hw, b.hd);
    for (let i = Math.floor((b.x - r) / K); i <= Math.floor((b.x + r) / K); i++) for (let j = Math.floor((b.z - r) / K); j <= Math.floor((b.z + r) / K); j++) {
      const k = ck(i, j);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(it);
    }
  }
  let stamp = 0;
  const seen = new Map();
  return (x, z, r) => {
    const out = [];
    stamp++;
    for (let i = Math.floor((x - r) / K); i <= Math.floor((x + r) / K); i++) for (let j = Math.floor((z - r) / K); j <= Math.floor((z + r) / K); j++) {
      const l = m.get(ck(i, j));
      if (l) for (const it of l) if (seen.get(it) !== stamp) { seen.set(it, stamp); out.push(it); }
    }
    return out;
  };
}
const ck = (i, j) => i * 65536 + j;

// One floor level: the free floor cells at this height, split into rooms by walls and doors; for each room its wall
// faces (runs of collinear wall pieces, with doors, windows and open stretches marked), doors, stairs and ceiling.
function readLevel(pieces, levelY, rects) {
  const floors = [];
  for (const p of pieces) {
    const info = P.piece(p.name);
    if (info.role !== 'floor' || p.decor) continue;
    const st = p.y + standOf(p.name);
    if (Math.abs(st - levelY) < 0.3) floors.push({ p, st, b: obox(p.x, p.z, info.size[0], info.size[2], pyaw(p)) });
  }
  if (!floors.length) return null;
  const stand = floors.map(f => f.st).sort((a, b) => a - b)[Math.floor(floors.length / 2)];
  const boxes = [];
  for (const p of pieces) {
    const sb = structBox(p);
    if (p.decor) continue;
    if (sb.y1 < stand + 0.15 || sb.y0 > stand + 2.6) continue;
    if (BLOCKING.has(sb.role) || (!sb.info.structural && sb.role !== 'floor' && sb.role !== 'rug' && sb.role !== 'nature')) boxes.push(sb);
    else if (sb.role === 'beam' && sb.y0 < stand + 1.9) boxes.push(sb);
  }
  const over = pieces.filter(p => !p.decor && OVERHEAD.has(P.piece(p.name).role)).map(structBox).filter(s => s.y0 > stand + 1.2 && s.y0 < stand + 12);
  // the extent: hint rectangles or the floor pieces
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const f of floors) { const r = Math.max(f.b.hw, f.b.hd) * 1.42; x0 = Math.min(x0, f.p.x - r); x1 = Math.max(x1, f.p.x + r); z0 = Math.min(z0, f.p.z - r); z1 = Math.max(z1, f.p.z + r); }
  const inRects = (x, z) => !rects || !rects.length || rects.some(r => x > r.x0 - 0.01 && x < r.x1 + 0.01 && z > r.z0 - 0.01 && z < r.z1 + 0.01);
  const near = indexOf(boxes, s => s.b);
  const cells = new Map();
  void x0; void x1; void z0; void z1;
  for (const f of floors) {
    const r = f.b.r;
    for (let i = Math.floor((f.p.x - r) / G); i <= Math.floor((f.p.x + r) / G); i++) for (let j = Math.floor((f.p.z - r) / G); j <= Math.floor((f.p.z + r) / G); j++) {
      const k = ck(i, j);
      if (cells.has(k)) continue;
      const x = (i + 0.5) * G, z = (j + 0.5) * G;
      if (!inRects(x, z) || ptDist(f.b, x, z) >= 0.001) continue;
      // under a blocker at walking height (a thick wall, a post, a stair)
      let blocked = false;
      for (const s of near(x, z, 0.2)) if (s.y0 < f.st + 1.6 && s.y1 > f.st + 0.3 && ptDist(s.b, x, z) < (s.role === 'pole' ? 0.12 : 0.03)) { blocked = true; break; }
      if (!blocked) cells.set(k, { i, j, x, z, st: f.st });
    }
  }
  // rooms: cells joined unless a wall or door stands on the edge between them
  const edgeBlocked = (a, c) => {
    const mx = (a.x + c.x) / 2, mz = (a.z + c.z) / 2;
    for (const s of near(mx, mz, 0.1)) if (WALLISH.has(s.role) && s.y0 < stand + 1.4 && s.y1 > stand + 0.4 && ptDist(s.b, mx, mz) < 0.02) return true;
    return false;
  };
  const comp = new Map(), rooms = [];
  for (const [k, c] of cells) {
    if (comp.has(k)) continue;
    const id = rooms.length, list = [c], stack = [c];
    comp.set(k, id);
    while (stack.length) {
      const a = stack.pop();
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const kk = ck(a.i + di, a.j + dj), c2 = cells.get(kk);
        if (!c2 || comp.has(kk) || edgeBlocked(a, c2)) continue;
        comp.set(kk, id); list.push(c2); stack.push(c2);
      }
    }
    rooms.push({ cells: list });
  }
  const out = [];
  for (const r of rooms) {
    if (r.cells.length * G * G < 3) continue;
    out.push(roomModel(r.cells, stand, boxes, over, pieces, near));
  }
  return out;
}

function roomModel(cellList, stand, boxes, over, pieces, near) {
  const set = new Map(cellList.map(c => [ck(c.i, c.j), c]));
  const room = { cells: cellList, set, stand, boxes, near, area: cellList.length * G * G };
  room.cellAt = (x, z) => set.get(ck(Math.floor(x / G), Math.floor(z / G)));
  room.inside = (x, z) => !!room.cellAt(x, z);
  // a corner of a piece may hang over a small gap between the floor and a wall (round plans leave one)
  room.nearWall = (x, z, reach = 0.45) => {
    if (room.inside(x, z)) return true;
    let near = false;
    for (const [dx, dz] of [[reach, 0], [-reach, 0], [0, reach], [0, -reach]]) if (room.inside(x + dx, z + dz)) near = true;
    if (!near) return false;
    for (const s of room.near(x, z, reach + 0.4)) if (WALLISH.has(s.role) && ptDist(s.b, x, z) < reach + 0.25) return true;
    return false;
  };
  let sx = 0, sz = 0;
  for (const c of cellList) { sx += c.x; sz += c.z; }
  room.cx = sx / cellList.length; room.cz = sz / cellList.length;
  room.x0 = Math.min(...cellList.map(c => c.x)) - G / 2; room.x1 = Math.max(...cellList.map(c => c.x)) + G / 2;
  room.z0 = Math.min(...cellList.map(c => c.z)) - G / 2; room.z1 = Math.max(...cellList.map(c => c.z)) + G / 2;
  // ceiling over each cell
  const nearOver = indexOf(over, o => o.b);
  for (const c of cellList) {
    let h = Infinity;
    for (const o of nearOver(c.x, c.z, 0.1)) if (o.y0 < h && ptDist(o.b, c.x, c.z) < 0.01) h = o.y0;
    c.ceil = h;
  }
  const ceils = cellList.map(c => c.ceil).filter(isFinite).sort((a, b) => a - b);
  room.covered = ceils.length / cellList.length;
  room.ceiling = ceils.length ? ceils[Math.floor(ceils.length / 2)] : stand + 3;
  room.ceilAt = (x, z) => { const c = room.cellAt(x, z); return c && isFinite(c.ceil) ? c.ceil : room.ceiling; };
  // wall faces: wall pieces next to the room, grouped by line and side, joined where they touch
  const groups = new Map();
  for (const s of boxes) {
    if (!WALLISH.has(s.role) && s.role !== 'pole') continue;
    if (s.role === 'pole') continue;
    const yaw = pyaw(s.p), a = norm(yaw) % 180, ar = a * PI / 180;
    const ux = Math.cos(ar), uz = -Math.sin(ar), nx = Math.sin(ar), nz = Math.cos(ar);
    const off = s.p.x * nx + s.p.z * nz, along = s.p.x * ux + s.p.z * uz;
    // half thickness of this piece across its line
    const ht = s.b.hw * Math.abs(s.b.c * nx - s.b.s * nz) + s.b.hd * Math.abs(s.b.s * nx + s.b.c * nz);
    const hl = s.b.hw * Math.abs(s.b.c * ux - s.b.s * uz) + s.b.hd * Math.abs(s.b.s * ux + s.b.c * uz);
    for (const side of [1, -1]) {
      if (![0.3, 0.6, 0.9].some(e => room.inside(s.p.x + nx * side * (ht + e), s.p.z + nz * side * (ht + e)))) continue;
      const key = `${Math.round(a)}|${Math.round(off * 4)}|${side}`;
      if (!groups.has(key)) groups.set(key, { a, ux, uz, nx: nx * side, nz: nz * side, off, side, parts: [] });
      groups.get(key).parts.push({ s, a0: along - hl, a1: along + hl, ht, off });
    }
  }
  room.faces = [];
  for (const g of groups.values()) {
    g.parts.sort((p, q) => p.a0 - q.a0);
    let cur = null;
    const flush = () => { if (cur) room.faces.push(faceModel(cur, room)); cur = null; };
    for (const pt of g.parts) {
      if (cur && pt.a0 <= cur.a1 + 0.15) { cur.parts.push(pt); cur.a1 = Math.max(cur.a1, pt.a1); }
      else { flush(); cur = { ...g, parts: [pt], a0: pt.a0, a1: pt.a1 }; }
    }
    flush();
  }
  room.faces = room.faces.filter(f => f && f.len >= 0.9);
  // doors into this room
  room.doors = [];
  for (const s of boxes) {
    if (s.role !== 'door') continue;
    if (s.y0 > stand + 0.6 || s.y1 < stand + 1.2) continue;
    const yaw = pyaw(s.p), ar = yaw * PI / 180, nx = Math.sin(ar), nz = Math.cos(ar);
    for (const side of [1, -1]) {
      if ([0.35, 0.7, 1.1].some(e => room.inside(s.p.x + nx * side * (s.b.hd + e), s.p.z + nz * side * (s.b.hd + e)))) room.doors.push({ x: s.p.x, z: s.p.z, nx: nx * side, nz: nz * side, w: s.b.hw * 2, ht: s.b.hd, p: s.p });
    }
  }
  // open stretches of a face (an open front, an arcade) count as ways in when the room has no door
  const realDoors = room.doors.length;
  for (const f of room.faces) for (const run of f.runs) if (!realDoors && run.kind === 'open' && run.a1 - run.a0 >= 1.5) {
    const t = (run.a0 + run.a1) / 2;
    room.doors.push({ x: f.px(t), z: f.pz(t), nx: f.nx, nz: f.nz, w: Math.min(2.5, run.a1 - run.a0), ht: f.ht, open: true });
  }
  edgeFaces(room);
  // stairs and ladders that reach this floor
  room.stairs = boxes.filter(s => s.role === 'stair' && s.y1 > stand - 0.3 && s.y0 < stand + 2.2 && cellList.some(c => ptDist(s.b, c.x, c.z) < 1.2));
  for (const s of pieces) {
    if (P.piece(s.name).role !== 'stair' || s.decor) continue;
    const sb = structBox(s);
    // a ladder from the floor below: its top arrives beside this floor
    if (sb.y1 > stand - 0.8 && sb.y1 < stand + 0.6 && !room.stairs.some(q => q.p === s) && cellList.some(c => ptDist(sb.b, c.x, c.z) < 1.2)) room.stairs.push(sb);
  }
  return room;
}

// Floor edges with no wall: things may stand with their backs to them (an open shed, a tent whose walls are roof);
// nothing hangs on them. A room with no door gets its longest edge, the front first, as the way in.
function edgeFaces(room) {
  const runs = new Map();
  for (const c of room.cells) for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (room.set.has(ck(c.i + di, c.j + dj))) continue;
    const mx = c.x + di * G / 2, mz = c.z + dj * G / 2;
    if (room.faces.some(f => { const t = mx * f.ux + mz * f.uz; return t > f.a0 - 0.3 && t < f.a1 + 0.3 && Math.abs((mx - f.px(t)) * f.nx + (mz - f.pz(t)) * f.nz) < f.ht + 0.45; })) continue;
    const nx = -di, nz = -dj;
    const key = `${nx},${nz},${di ? mx.toFixed(2) : mz.toFixed(2)}`;
    if (!runs.has(key)) runs.set(key, { nx, nz, line: di ? mx : mz, ts: [] });
    runs.get(key).ts.push(di ? mz : mx);
  }
  const faces = [];
  for (const r of runs.values()) {
    r.ts.sort((a, b) => a - b);
    let a0 = r.ts[0], prev = r.ts[0];
    const flush = (lo, hi) => {
      // along runs the same way as wall faces: ux, uz is the face's own direction
      const ux = r.nx ? 0 : 1, uz = r.nx ? 1 : 0;
      const f = { ux, uz, nx: r.nx, nz: r.nz, off: 0, side: 1, a0: lo - G / 2, a1: hi + G / 2, ht: 0, edge: true, runs: [], samples: [] };
      f.len = f.a1 - f.a0;
      f.px = t => (r.nx ? r.line : t);
      f.pz = t => (r.nx ? t : r.line);
      for (let t = f.a0 + 0.125; t < f.a1; t += 0.25) f.samples.push({ t, kind: 'edge', top: 0 });
      f.runs.push({ kind: 'edge', a0: f.a0, a1: f.a1, top: 0 });
      if (f.len >= 1) faces.push(f);
    };
    for (const t of r.ts.slice(1)) { if (t - prev > G + 0.01) { flush(a0, prev); a0 = t; } prev = t; }
    flush(a0, prev);
  }
  if (!room.doors.length && faces.length) {
    faces.sort((a, b) => (b.nz > 0.7 ? 2 : 0) + b.len * 0.2 - ((a.nz > 0.7 ? 2 : 0) + a.len * 0.2));
    const f = faces[0], t = (f.a0 + f.a1) / 2;
    for (const sm of f.samples) sm.kind = 'open';
    f.runs = [{ kind: 'open', a0: f.a0, a1: f.a1, top: 0 }];
    room.doors.push({ x: f.px(t), z: f.pz(t), nx: f.nx, nz: f.nz, w: Math.min(2.5, f.len), ht: 0, open: true });
  }
  room.faces.push(...faces);
}

// A face: a run of collinear wall pieces. Along it, every quarter meter is wall, window, door or open.
function faceModel(f, room) {
  const ht = Math.max(...f.parts.map(p => p.ht + Math.abs(p.off - f.off)));
  const face = { ux: f.ux, uz: f.uz, nx: f.nx, nz: f.nz, off: f.off, side: f.side, a0: f.a0, a1: f.a1, len: f.a1 - f.a0, ht, runs: [], marks: [] };
  // world point on the wall line at 'along' t
  face.px = t => t * f.ux + f.off * f.nx * f.side;
  face.pz = t => t * f.uz + f.off * f.nz * f.side;
  const stand = room.stand;
  const samples = [];
  for (let t = f.a0 + 0.125; t < f.a1; t += 0.25) {
    const x = face.px(t), z = face.pz(t);
    const here = f.parts.filter(p => t >= p.a0 - 0.01 && t <= p.a1 + 0.01);
    const cov = h => here.some(p => !isGlass(p.s.p.name) && p.s.role !== 'door' && p.s.y0 - 0.01 <= stand + h && p.s.y1 + 0.01 >= stand + h);
    const glass = here.some(p => (isGlass(p.s.p.name) || p.s.role === 'window') && p.s.y1 > stand + 1.0 && p.s.y0 < stand + 1.9);
    const door = here.some(p => p.s.role === 'door');
    // is this stretch part of this room at all (the room's floor in front of it)
    const inRoom = [0.3, 0.6, 0.9].some(e => room.inside(x + f.nx * (ht + e), z + f.nz * (ht + e)));
    let kind;
    if (!inRoom) kind = 'none';
    else if (door) kind = 'door';
    else if (!cov(0.3) && !cov(0.7)) kind = 'open';
    else if (glass || !cov(1.3) || !cov(1.7)) kind = 'window';
    else kind = 'wall';
    let top = 0;
    for (let h = 0.1; h < 4; h += 0.1) { if (cov(h)) top = h; else if (h > 0.4) break; }
    samples.push({ t, kind, top });
  }
  face.samples = samples;
  for (const s of samples) {
    const last = face.runs[face.runs.length - 1];
    if (last && last.kind === s.kind) { last.a1 = s.t + 0.125; last.top = Math.min(last.top, s.top); }
    else face.runs.push({ kind: s.kind, a0: s.t - 0.125, a1: s.t + 0.125, top: s.top });
  }
  if (!samples.some(s => s.kind !== 'none')) return null;
  return face;
}
// the kinds along a stretch of a face
function stretch(face, t0, t1) {
  const ks = new Set();
  let top = Infinity;
  for (const s of face.samples) if (s.t + 0.125 > t0 + 0.01 && s.t - 0.125 < t1 - 0.01) { ks.add(s.kind); top = Math.min(top, s.top); }
  if (t0 < face.a0 - 0.01 || t1 > face.a1 + 0.01) ks.add('none');
  return { ks, top };
}

// ---------------------------------------------------------------- one room being furnished
class Room {
  constructor(model, opts) {
    Object.assign(this, model);
    this.placed = [];      // { name, b, y0, y1, at, rug, mount, face }
    this.zones = [];       // { b, why } kept free of anything but rugs
    this.paths = [];       // [x, z] points kept free
    this.pathSet = new Set();
    this.mounts = [];      // { face, t0, t1, y0, y1 }
    this.out = opts.out;   // the building's piece list
    this.mates = opts.mates || []; // pieces placed in the other rooms of this floor
    this.R = opts.R;
    this.count = 0;
  }
  // can a floor piece go here
  fits(name, x, z, yaw, o = {}) {
    const [w, h, d] = size(name);
    const f = F[name] || {};
    const b = obox(x, z, w, d, yaw);
    const rug = f.at === 'rug';
    // all of it on this room's floor
    if (!this.inside(x, z)) return false;
    const hw = Math.max(0.01, b.hw - 0.04), hd = Math.max(0.01, b.hd - 0.04);
    for (let q = 0; q < 8; q++) {
      const u = CU[q] * hw, v = CV[q] * hd;
      if (!this.nearWall(x + u * b.c + v * b.s, z - u * b.s + v * b.c, o.overhang)) return false;
    }
    const y0 = this.stand + (o.lift || 0), y1 = y0 + (rug ? 0.05 : h);
    if (!rug) {
      for (const s of this.near(x, z, b.r + 0.1)) {
        if (s.y1 < y0 + 0.05 || s.y0 > y1 - 0.05) continue;
        if (overlap(s.b, b, -0.02)) return false;
      }
      // both sides of every door within reach, as the audit sees them, whichever room they open into
      if (f.at !== 'mount' && f.at !== 'hang') for (const s of this.near(x, z, b.r + 2.4)) {
        if (s.role !== 'door' || s.y0 > y0 + 1.8 || s.y1 < y0 + 0.05) continue;
        const dy = pyaw(s.p), ar = dy * PI / 180, nx = Math.sin(ar), nz = Math.cos(ar);
        for (const sg of [1, -1]) if (overlap(obox(s.p.x + nx * sg * (s.b.hd + 0.6), s.p.z + nz * sg * (s.b.hd + 0.6), s.b.hw * 2, 1.2, dy), b, -0.02)) return false;
      }
    }
    for (const q of this.mates) {
      if (q.room === this || q.mount || q.rug || rug) continue;
      if (q.y0 > y1 + 0.05 || q.y1 < y0) continue;
      if (overlap(q.b, b, 0.05)) return false;
    }
    for (const q of this.placed) {
      if (q.mount) {
        if (rug) continue;
        if (q.y0 > y1 + 0.05 || q.y1 < y0) continue;
        if (overlap(q.b, b, 0)) return false;
        continue;
      }
      if (o.on && o.on === q) continue;
      if (rug && o.clearOf && !q.rug && o.clearOf.includes((F[q.name] || {}).cat) && q !== o.near && overlap(q.b, b, 0.05)) return false;
      if (rug !== q.rug) { if (q.fire || f.cat === 'fire') { if (overlap(q.b, b, 0.3)) return false; } continue; }
      // a table and a bed keep a meter apart (Tyler, FP-003: the table too close to the beds)
      const qc = (F[q.name] || {}).cat;
      if (((f.cat === 'table' && qc === 'bed') || (f.cat === 'bed' && qc === 'table')) && overlap(q.b, b, 0.9)) return false;
      if (overlap(q.b, b, rug ? -0.05 : (o.tight ? 0.02 : 0.08))) return false;
    }
    if (!rug || f.cat === 'fire') {
      for (const zn of this.zones) if (!(o.ignore && o.ignore.includes(zn.why)) && overlap(zn.b, b, 0)) return false;
      if (!o.onPath && this.paths.length) {
        const r = b.r + 0.45;
        for (let i = Math.floor((x - r) / G); i <= Math.floor((x + r) / G); i++) for (let j = Math.floor((z - r) / G); j <= Math.floor((z + r) / G); j++)
          if (this.pathSet.has(ck(i, j)) && ptDist(b, (i + 0.5) * G, (j + 0.5) * G) < 0.42) return false;
      }
    } else {
      for (const zn of this.zones) if (zn.why === 'stair' && overlap(zn.b, b, 0)) return false;
    }
    return true;
  }
  add(name, x, y, z, yaw, extra = {}) {
    const [w, h, d] = size(name);
    const f = F[name] || {};
    const rec = { name, b: obox(x, z, w, d, yaw), y0: y, y1: y + h, rug: f.at === 'rug', fire: f.cat === 'fire', mount: !!extra.mount, x, z, yaw, ...extra };
    if (extra.mount) rec.b = obox(x, z, w, Math.max(d, 0.3), yaw);
    this.placed.push(rec);
    rec.room = this;
    this.mates.push(rec);
    this.out.push({ name, x: +x.toFixed(3), y: +y.toFixed(3), z: +z.toFixed(3), q: quatY(norm(yaw)), yaw: norm(yaw), decor: true });
    if (!rec.rug && f.cat !== 'fire') this.count++;
    return rec;
  }
  floorY(b) {
    let y = -Infinity;
    for (const [px, pz] of corners(b, 0.05)) { const c = this.cellAt(px, pz); if (c) y = Math.max(y, c.st); }
    return isFinite(y) ? y : this.stand;
  }
  put(name, x, z, yaw, o = {}) {
    if (!this.fits(name, x, z, yaw, o)) return null;
    const f = F[name] || {};
    const [w, , d] = size(name);
    const y = this.floorY(obox(x, z, w, d, yaw)) + (f.base || 0) + (o.lift || 0) + (f.at === 'rug' ? 0.02 : 0);
    return this.add(name, x, y, z, yaw, o.extra);
  }
  // frame from the main way in: v runs into the room, u across
  frame() {
    if (this._frame && this._frameFor === this.entry) return this._frame;
    this._frameFor = this.entry;
    this._frame = this.frame0();
    return this._frame;
  }
  frame0() {
    const d = this.entry;
    if (!d) return { u: () => 0, v: () => 0, D: 1, W: 1 };
    const ux = -d.nz, uz = d.nx;
    const v = (x, z) => (x - d.x) * d.nx + (z - d.z) * d.nz, u = (x, z) => (x - d.x) * ux + (z - d.z) * uz;
    let D = 0.1, W = 0.1;
    for (const c of this.cells) { D = Math.max(D, v(c.x, c.z)); W = Math.max(W, Math.abs(u(c.x, c.z))); }
    return { u, v, D, W, ux, uz };
  }
  doorDist(x, z) {
    let m = Infinity;
    for (const d of this.doors) m = Math.min(m, Math.hypot(x - d.x, z - d.z));
    return m;
  }
}

// ---------------------------------------------------------------- candidates
// Positions against walls: along every face where the stretch behind the piece is wall (or a window, for low pieces).
function wallSpots(room, name, o = {}) {
  const f = F[name] || {};
  const [w, h, d] = size(name);
  const rel = o.rel != null ? o.rel : (f.rel || 0);
  const side = rel === 90 || rel === 270;
  const along = side ? d : w, deep = side ? w : d;
  const out = [];
  for (const face of room.faces) {
    if (o.face && o.face !== face) continue;
    // on the world's half-meter grid, so a piece can sit in the middle of a bay between posts
    const step = o.step || 0.5;
    for (let t = Math.ceil((face.a0 + along / 2 - 0.001) / step) * step; t <= face.a1 - along / 2 + 0.001; t += step) {
      const { ks, top } = stretch(face, t - along / 2, t + along / 2);
      if (ks.has('none') || ks.has('door') || ks.has('open')) continue;
      // under a window or a rail only what stays below the sill
      if (ks.has('window') && !o.tallOk && (h > top + 0.15 || f.tall || o.noWindow)) continue;
      const dist = face.ht + 0.04 + deep / 2 + (o.gap || 0);
      const x = face.px(t) + face.nx * dist, z = face.pz(t) + face.nz * dist;
      const yaw = norm(yawOfDir(face.nx, face.nz) + rel);
      // a corner: the piece's side within reach of a crossing wall
      const endGap = Math.min(t - along / 2 - face.a0, face.a1 - (t + along / 2));
      out.push({ x, z, yaw, face, t, corner: endGap < 0.35 && cornerAt(room, face, t < (face.a0 + face.a1) / 2 ? face.a0 : face.a1), win: ks.has('window') });
    }
  }
  return out;
}
function cornerAt(room, face, a) {
  const x = face.px(a), z = face.pz(a);
  return room.faces.some(g => g !== face && Math.abs(g.nx * face.nx + g.nz * face.nz) < 0.3 && Math.abs((x - g.px(0)) * g.nx * g.side + (z - g.pz(0)) * g.nz * g.side) < 0.8 + g.ht);
}

// Choose the best spot by score (with a little seeded noise so houses differ), the first that fits.
function best(room, name, spots, score, o = {}) {
  const R = room.R;
  const ranked = spots.map(s => [s, score(s) + (o.noise != null ? o.noise : 0.35) * R()]).filter(([, v]) => v > -50);
  ranked.sort((a, b) => b[1] - a[1]);
  for (const [s] of ranked.slice(0, o.tries || 400)) {
    const rec = room.put(name, s.x, s.z, s.yaw, o);
    if (rec) { rec.spot = s; return rec; }
  }
  return null;
}

// Wall pieces: centered on a wall face, or on the plain stretch between openings, never over a door or a window.
function mountSpots(room, name, o = {}) {
  const f = F[name] || {};
  const [w, h] = size(name);
  const out = [];
  for (const face of room.faces) {
    if (o.face && o.face !== face) continue;
    const plain = face.runs.filter(r => r.kind === 'wall');
    // the whole face's middle, and the middle of each plain stretch, and pairs either side of the middle
    const mids = [(face.a0 + face.a1) / 2, ...plain.map(r => (r.a0 + r.a1) / 2)];
    const cands = [];
    for (const m of mids) cands.push({ t: m, centered: 2 });
    if (o.pairs) for (let k = 0.75; k < face.len / 2; k += 0.25) cands.push({ t: (face.a0 + face.a1) / 2 - k, pair: k, centered: 1 }, { t: (face.a0 + face.a1) / 2 + k, pair: -k, centered: 1 });
    if (o.at != null) cands.push({ t: o.at, centered: 2 });
    for (const c of cands) {
      const t = c.t, x0 = face.px(t), z0 = face.pz(t);
      const ceil = room.ceilAt(x0 + face.nx * 0.5, z0 + face.nz * 0.5);
      let y;
      if (f.under != null) y = ceil - f.under;
      else y = room.stand + Math.min(o.y || f.y || 1.6, ceil - room.stand - h - 0.25);
      if (y - room.stand < (f.under != null ? 1.8 : 0.9)) continue;
      const span = stretch(face, t - w / 2 - 0.35, t + w / 2 + 0.35);
      if (span.ks.size !== 1 || !span.ks.has('wall')) continue;  // keeps clear of doors and windows on either side
      if (span.top + room.stand < y + Math.min(h, 1.2) - 0.05) continue;
      const off = face.ht + (f.wall != null ? f.wall : 0.12);
      out.push({ x: x0 + face.nx * off, z: z0 + face.nz * off, y, yaw: norm(yawOfDir(face.nx, face.nz) + (f.rel || 0)), face, t, centered: c.centered, pair: c.pair });
    }
  }
  return out;
}
function putMount(room, name, spot) {
  const [w, h] = size(name);
  const f = F[name] || {};
  const y0 = spot.y - (f.under != null ? h : 0), y1 = f.under != null ? spot.y : spot.y + h;
  for (const m of room.mounts) if (m.face === spot.face && Math.abs(m.t - spot.t) < (m.w + w) / 2 + 0.3 && m.y0 < y1 + 0.2 && m.y1 > y0 - 0.2) return null;
  // in front of a tall piece standing against this wall: no
  const probe = obox(spot.x + spot.face.nx * 0.3, spot.z + spot.face.nz * 0.3, w, 0.6, spot.yaw);
  for (const q of room.placed) if (!q.rug && !q.mount && q.y1 > y0 && overlap(q.b, probe, 0)) return null;
  room.mounts.push({ face: spot.face, t: spot.t, w, y0, y1 });
  return room.add(name, spot.x, spot.y, spot.z, spot.yaw, { mount: true, face: spot.face, t: spot.t, y0, y1: y0 + h });
}

// ---------------------------------------------------------------- clusters
function placeFire(room, ctx, kind) {
  const R = room.R;
  const name = kind || 'fire_pit';
  const [w, , d] = size(name);
  let spot = ctx.fireAt && room.inside(ctx.fireAt.x, ctx.fireAt.z) ? ctx.fireAt : null;
  if (!spot) {
    const main = ctx.mainRect;
    const x = ctx.use === 'home' && ctx.doorX != null && main && ctx.doorX > main.x0 && ctx.doorX < main.x1 ? ctx.doorX : (main ? (main.x0 + main.x1) / 2 : room.cx);
    const z = main ? (main.z0 + main.z1) / 2 : room.cz;
    spot = { x, z };
  }
  const long = (room.x1 - room.x0) >= (room.z1 - room.z0);
  const yaw = name === 'hearth' ? (long ? 0 : 90) : 0;
  let rec = null;
  for (const [dx, dz] of [[0, 0], [0, 0.5], [0, -0.5], [0.5, 0], [-0.5, 0], [0, 1], [0, -1]]) {
    rec = room.put(name, spot.x + dx, spot.z + dz, yaw, { ignore: ['door', 'flue', 'keep'] });
    if (rec) break;
  }
  if (!rec) return null;
  rec.fire = true;
  room.fire = rec;
  // keep a ring round the fire free; seats and rugs may come close
  room.zones.push({ b: obox(rec.x, rec.z, w + 1.4, d + 1.4, yaw), why: 'fire' });
  void R;
  return rec;
}
function onFire(room, name) {
  const fire = room.fire;
  if (!fire || fire.name !== 'fire_pit') return null;
  const f = F[name];
  return room.add(name, fire.x, fire.y0 + (f.lift || 0.25), fire.z, fire.yaw, { onFire: true });
}

// Paths: from each way in to the fire, the stairs and ladders and the other ways in, through the middle of the room.
function planPaths(room) {
  const starts = room.doors.map(d => [d.x + d.nx * (d.ht + 0.4), d.z + d.nz * (d.ht + 0.4)]);
  const goals = [];
  if (room.fire) goals.push([room.fire.x + (room.fire.b.hw + 0.9) * (room.entry ? room.entry.nx * -1 : 0), room.fire.z + (room.fire.b.hd + 0.9) * (room.entry ? -room.entry.nz : 0)]);
  for (const s of room.stairs) goals.push([s.b.x, s.b.z]);
  for (const st of starts.slice(1)) goals.push(st);
  if (!starts.length && room.stairs.length) starts.push([room.stairs[0].b.x, room.stairs[0].b.z]);
  if (!starts.length) return;
  const freeC = new Map();
  const free = c => {
    const kk = ck(c.i, c.j);
    if (freeC.has(kk)) return freeC.get(kk);
    let v = true;
    for (const s of room.near(c.x, c.z, 0.3)) if (s.y0 < room.stand + 1.6 && s.y1 > room.stand + 0.3 && ptDist(s.b, c.x, c.z) < 0.15) { v = false; break; }
    if (v && room.placed.some(q => !q.rug && !q.mount && ptDist(q.b, c.x, c.z) < 0.2)) v = false;
    freeC.set(kk, v);
    return v;
  };
  const wallC = new Map();
  const nearWall = c => { const kk = ck(c.i, c.j); if (!wallC.has(kk)) wallC.set(kk, nearWall0(c)); return wallC.get(kk); };
  const nearWall0 = c => room.faces.some(f => Math.abs((c.x - f.px(0)) * f.nx + (c.z - f.pz(0)) * f.nz) < f.ht + 0.6 && (c.x * f.ux + c.z * f.uz) > f.a0 - 0.3 && (c.x * f.ux + c.z * f.uz) < f.a1 + 0.3);
  const nearest = ([x, z]) => {
    let bestC = null, bd = Infinity;
    for (const c of room.cells) { const dd = Math.hypot(c.x - x, c.z - z); if (dd < bd && free(c)) { bd = dd; bestC = c; } }
    return bestC;
  };
  const s0 = nearest(starts[0]);
  if (!s0) return;
  for (const g of [...goals, ...starts.slice(1)]) {
    const goal = nearest(g);
    if (!goal || goal === s0) continue;
    // Dijkstra on the cells, dearer next to walls so the path keeps to the middle
    const dist = new Map([[ck(s0.i, s0.j), 0]]), prev = new Map(), done = new Set();
    const heap = [[0, s0]];
    const push = e => { heap.push(e); let i = heap.length - 1; while (i > 0) { const pa = (i - 1) >> 1; if (heap[pa][0] <= heap[i][0]) break; [heap[pa], heap[i]] = [heap[i], heap[pa]]; i = pa; } };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } }
      return top;
    };
    while (heap.length) {
      const [, a] = pop(), ka = ck(a.i, a.j);
      if (done.has(ka)) continue;
      done.add(ka);
      if (a === goal) break;
      for (const [di, dj, c] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.42], [1, -1, 1.42], [-1, 1, 1.42], [-1, -1, 1.42]]) {
        const kb = ck(a.i + di, a.j + dj), b = room.set.get(kb);
        if (!b || !free(b)) continue;
        if (di && dj && (!room.set.get(ck(a.i + di, a.j)) || !room.set.get(ck(a.i, a.j + dj)))) continue;
        const nd = dist.get(ka) + c + (nearWall(b) ? 0.8 : 0);
        if (!dist.has(kb) || nd < dist.get(kb)) { dist.set(kb, nd); prev.set(kb, a); push([nd, b]); }
      }
    }
    let c = goal;
    if (!prev.has(ck(goal.i, goal.j))) continue;
    while (c && c !== s0) { room.paths.push([c.x, c.z]); room.pathSet.add(ck(c.i, c.j)); c = prev.get(ck(c.i, c.j)); }
    room.paths.push([s0.x, s0.z]); room.pathSet.add(ck(s0.i, s0.j));
  }
}

// Keep the ways in clear: a box in front of each door as wide as the door and as deep as builders leave it.
function doorZones(room, kind) {
  const L = learned().doors || {};
  if (kind === 'lookout') kind = 'other';
  const p10 = (L.byRoom && L.byRoom[kind] && L.byRoom[kind][0]) || (L.freeDepth && L.freeDepth[0]) || 2;
  for (const d of room.doors) {
    let depth = 0;
    for (const c of room.cells) depth = Math.max(depth, (c.x - d.x) * d.nx + (c.z - d.z) * d.nz);
    const want = Math.max(1.5, Math.min(p10, 3, depth * 0.4));
    const cx = d.x + d.nx * (d.ht + want / 2), cz = d.z + d.nz * (d.ht + want / 2);
    room.zones.push({ b: obox(cx, cz, d.w + 0.8, want, yawOfDir(d.nx, d.nz)), why: 'door' });
  }
  for (const s of room.stairs) room.zones.push({ b: obox(s.b.x, s.b.z, s.b.hw * 2 + 1.6, s.b.hd * 2 + 1.6, Math.atan2(-s.b.s, s.b.c) * 180 / PI), why: 'stair' });
}

// Beds: head to a wall, far from the door, on the sleeping side; side by side with room between; a chest at the foot.
function placeBeds(room, k, n, d, row = 1.5) {
  const fr = room.frame(), out = [];
  const L = learned().items || {};
  for (let i = 0; i < n; i++) {
    const name = k.bed;
    const doorMin = Math.min(3.0, fr.D * 0.55);
    const spots = wallSpots(room, name, { noWindow: false });
    const prev = out[out.length - 1];
    const rec = best(room, name, spots, s => {
      let v = 2 * fr.v(s.x, s.z) / fr.D + (fr.u(s.x, s.z) * k.side > 0 ? 1 : 0);
      if (room.doorDist(s.x, s.z) < doorMin) v -= 3;
      if (room.sideCells && room.sideCells(s.x, s.z)) v += 1.5;
      if (room.fire && Math.hypot(s.x - room.fire.x, s.z - room.fire.z) < 2.6) v -= 2;
      if (prev) { const dd = Math.hypot(s.x - prev.x, s.z - prev.z); v += (s.face === prev.spot.face ? row : 0) - Math.abs(dd - (size(name)[0] + 0.7)) * 0.6 * (row > 1 ? 1 : 0.3); }
      if (s.win) v -= 0.3;
      return v;
    }, { noise: 0.25 });
    if (!rec) break;
    out.push(rec);
    void L;
    // a chest at the foot (learned: 1.75 m out from the bed's pivot, same facing)
    if (d >= 2 || i === 0) {
      const ch = k.chest;
      const off = size(name)[2] / 2 + size(ch)[2] / 2 + 0.3;
      const ax = Math.sin(rec.yaw * PI / 180), az = Math.cos(rec.yaw * PI / 180);
      if (i < (d >= 3 ? 3 : d >= 2 ? 2 : 1)) room.put(ch, rec.x + ax * off, rec.z + az * off, rec.yaw);
    }
  }
  if (!out.length && n > 0) {
    // a house always has a bed: side to a wall, then free-standing, then the plain wooden bed, the way in kept clear
    for (const name of [...new Set([k.bed, 'bed'])]) {
      const spots = [...wallSpots(room, name, { rel: 90 }), ...wallSpots(room, name, { rel: 270 }),
        ...room.cells.filter(c => room.area < 40 || (c.i % 2 === 0 && c.j % 2 === 0)).flatMap(c => [0, 90, 45, 135].map(yaw => ({ x: c.x, z: c.z, yaw }))),
        ...room.cells.filter(c => room.area < 40).flatMap(c => [0, 90].map(yaw => ({ x: c.x + 0.25, z: c.z + 0.25, yaw })))];
      const rec = best(room, name, spots, sp => 2 * fr.v(sp.x, sp.z) / fr.D - (room.fire ? Math.max(0, 2.6 - Math.hypot(sp.x - room.fire.x, sp.z - room.fire.z)) * 2 : 0), { noise: 0.2, ignore: ['work', 'fire'], tries: 2000, overhang: 0.9 });
      if (rec) { out.push(rec); break; }
    }
  }
  return out;
}

// A table with its seats: in the middle, or with one long side to a wall and seats on the room side.
function placeTable(room, k, o = {}) {
  const banned = [];
  for (let attempt = 0; attempt < 4; attempt++) {
    const t = placeTable1(room, k, { ...o, banned });
    if (!t) return null;
    if (t.seats > 0 || (o.seats != null && o.seats === 0)) return t;
    // nobody can sit at it: take it back and try somewhere else
    banned.push([t.x, t.z]);
    room.placed.splice(room.placed.indexOf(t), 1);
    room.mates.splice(room.mates.indexOf(t), 1);
    for (let j = room.out.length - 1; j >= 0; j--) {
      const p = room.out[j];
      if (p.decor && p.name === t.name && Math.abs(p.x - t.x) < 0.001 && Math.abs(p.z - t.z) < 0.001 && Math.abs(p.y - t.y0) < 0.001) { room.out.splice(j, 1); break; }
    }
    room.count--;
  }
  return null;
}
function placeTable1(room, k, o = {}) {
  const fr = room.frame();
  const name = o.table || k.table;
  const [tw, , td] = size(name);
  const round = !!(F[name] || {}).round;
  const doorMin = Math.min(2.7, fr.D * 0.5);
  const spots = [];
  // middle spots on the grid, along the room's axes
  for (const c of room.cells) if (c.i % 2 === 0 && c.j % 2 === 0) for (const yaw of round ? [0] : [0, 90]) spots.push({ x: c.x, z: c.z, yaw, mid: true });
  if (!round && o.wall !== false) for (const s of wallSpots(room, name, { gap: 0.15 })) spots.push({ ...s, wallSide: true });
  const seatsWanted = o.seats != null ? o.seats : 4;
  const longX = (room.x1 - room.x0) >= (room.z1 - room.z0);
  const rec = best(room, name, spots, s => {
    let v = 0;
    const dd = room.doorDist(s.x, s.z);
    if (dd < doorMin) v -= 4;
    v -= Math.abs(fr.v(s.x, s.z) / fr.D - (o.depth != null ? o.depth : 0.55)) * 2;
    v += (fr.u(s.x, s.z) * k.side < 0 ? 1 : 0) * (o.sideBias != null ? o.sideBias : 1);
    if (room.fire) { const fd = Math.hypot(s.x - room.fire.x, s.z - room.fire.z); if (fd < 2.4) v -= 3; else v += Math.max(0, 1 - Math.abs(fd - 3.2) * 0.4) * (o.nearFire || 0.5); }
    if (s.mid && !round) v += ((longX ? s.yaw === 0 : s.yaw === 90) ? (o.axis || 0.4) : 0);
    if (s.wallSide) v += o.wallBias || 0.3;
    if (o.near) v -= Math.hypot(s.x - o.near.x, s.z - o.near.z) * 0.4;
    if (o.banned && o.banned.some(([bx2, bz2]) => Math.hypot(s.x - bx2, s.z - bz2) < 1.5)) return -99;
    // tables spread through the room, with room for their seats between them
    for (const q of room.placed) if ((F[q.name] || {}).cat === 'table') v -= Math.max(0, (o.spread || 4.5) - Math.hypot(s.x - q.x, s.z - q.z)) * 1.2;
    // room to sit: the spots for seats must be on the floor
    const ax = Math.sin(s.yaw * PI / 180), az = Math.cos(s.yaw * PI / 180);
    for (const sg of s.wallSide ? [1] : [1, -1]) if (!room.inside(s.x + ax * sg * (td / 2 + 0.7), s.z + az * sg * (td / 2 + 0.7))) v -= 2;
    return v;
  }, { noise: 0.4 });
  if (!rec) return null;
  // seats: benches along long sides (learned 1.0 m out), chairs round round tables (1.25 to 1.5 m)
  const seat = o.seat || k.seat;
  const ax = Math.sin(rec.yaw * PI / 180), az = Math.cos(rec.yaw * PI / 180), bx = Math.cos(rec.yaw * PI / 180), bz = -Math.sin(rec.yaw * PI / 180);
  const sides = rec.spot && rec.spot.wallSide ? [1] : [1, -1];
  let n = 0;
  const backs = (F[seat] || {}).back ? 180 : 0;
  if (round) {
    const r = tw / 2 + size(seat)[2] / 2 + 0.15;
    for (let i = 0; i < 4 && n < seatsWanted; i++) {
      const a = (rec.yaw + i * 90) * PI / 180, sx = rec.x + Math.sin(a) * r, sz = rec.z + Math.cos(a) * r;
      if (room.put(seat, sx, sz, norm(yawOfDir(rec.x - sx, rec.z - sz) + backs), { tight: true })) n++;
    }
  } else {
    const [sw, , sd] = size(seat);
    const long = (F[seat] || {}).long;
    for (const sg of sides) {
      // learned 1.0 m from the table's middle line to a bench's (Tyler, FP-003: the log benches too close to the table)
      const dist = td / 2 + sd / 2 + 0.2;
      const sx0 = rec.x + ax * sg * dist, sz0 = rec.z + az * sg * dist;
      const faceYaw = norm(yawOfDir(-ax * sg, -az * sg) + backs);
      const perSide = Math.ceil(seatsWanted / sides.length);
      let onSide = 0;
      if (long) {
        const cnt = Math.max(1, Math.floor(tw / sw + 0.2));
        for (let i = 0; i < cnt && n < seatsWanted && onSide < perSide; i++, onSide++) {
          const off = (i - (cnt - 1) / 2) * sw;
          if (room.put(seat, sx0 + bx * off, sz0 + bz * off, faceYaw, { tight: true })) n++;
        }
      } else {
        const per = Math.min(perSide, Math.max(1, Math.floor(tw / 1.0)));
        for (let i = 0; i < per && n < seatsWanted; i++) {
          const off = (i - (per - 1) / 2) * 1.0;
          if (room.put(seat, sx0 + bx * off, sz0 + bz * off, faceYaw, { tight: true })) n++;
        }
      }
    }
    // a seat at the head of a long table in a big room
    const headSeat = o.headSeat || (k.chair && !(F[k.chair] || {}).long ? k.chair : null);
    if (o.head && headSeat) {
      for (const sg of [1, -1]) {
        const hx = rec.x + bx * sg * (tw / 2 + 0.55), hz = rec.z + bz * sg * (tw / 2 + 0.55);
        if (room.put(headSeat, hx, hz, norm(yawOfDir(-bx * sg, -bz * sg)), { tight: true })) { n++; break; }
      }
    }
  }
  rec.seats = n;
  return rec;
}

// A rug under a table, beside a bed or in front of a fire or a seat of honor.
function placeRug(room, k, near, o = {}) {
  const rug = o.rug || k.rug;
  if (!rug) return null;
  const tries = [];
  if (near) {
    const ax = Math.sin(near.yaw * PI / 180), az = Math.cos(near.yaw * PI / 180), bx = Math.cos(near.yaw * PI / 180), bz = -Math.sin(near.yaw * PI / 180);
    if (o.mode === 'under') tries.push({ x: near.x, z: near.z, yaw: near.yaw + ((F[near.name] || {}).cat === 'table' ? 90 : 0) });
    if (o.mode === 'front') for (const dz of [1.6, 1.9, 2.2]) tries.push({ x: near.x + ax * dz, z: near.z + az * dz, yaw: near.yaw + 90 });
    if (o.mode === 'beside') for (const sg of [1, -1]) tries.push({ x: near.x + bx * sg * 1.75, z: near.z + bz * sg * 1.75, yaw: near.yaw }, { x: near.x + bx * sg * 1.75 + ax * 0.4, z: near.z + bz * sg * 1.75 + az * 0.4, yaw: near.yaw });
    if (o.mode === 'fire') for (const d of [room.entry || { nx: 0, nz: -1 }]) for (const dd of [2.4, 2.8]) tries.push({ x: near.x - d.nx * dd, z: near.z - d.nz * dd, yaw: yawOfDir(d.nx, d.nz) + 90 }, { x: near.x - d.nz * dd, z: near.z + d.nx * dd, yaw: yawOfDir(d.nx, d.nz) });
  } else {
    for (const c of room.cells) tries.push({ x: c.x, z: c.z, yaw: (room.x1 - room.x0) >= (room.z1 - room.z0) ? 90 : 0, free: true });
  }
  if (!near) {
    // a free rug: in the open floor, not by a door, not across a path
    const fr = room.frame();
    return best(room, rug, tries, s => -Math.abs(fr.v(s.x, s.z) / fr.D - 0.6) - (room.doorDist(s.x, s.z) < 2.2 ? 3 : 0), { noise: 0.6, tries: 120 });
  }
  const clearOf = o.mode === 'beside' ? ['bed', 'table', 'storage', 'craft'] : o.mode === 'front' || o.mode === 'fire' ? ['bed', 'table', 'storage', 'craft', 'seat'] : null;
  for (const s of tries) { const r = room.put(rug, s.x, s.z, norm(s.yaw), { clearOf, near }); if (r) return r; }
  return null;
}

// Chests and barrels in a row along a wall, a sign over the middle of the row.
function placeStorageRow(room, k, n, o = {}) {
  const fr = room.frame();
  const name = o.chest || k.chest;
  const [w] = size(name);
  const spots = wallSpots(room, name);
  const placed = [];
  for (let i = 0; i < n; i++) {
    const last = placed[placed.length - 1];
    const rec = best(room, name, spots, s => {
      let v = (s.corner ? 1.2 : 0) + fr.v(s.x, s.z) / fr.D * (o.back != null ? o.back : 0.6);
      if (room.doorDist(s.x, s.z) < 1.6) v -= 3;
      if (last) v += (s.face === last.spot.face ? 2 : -1) - Math.abs(Math.hypot(s.x - last.x, s.z - last.z) - (w + 0.2)) * 1.5;
      if (o.near) v -= Math.hypot(s.x - o.near.x, s.z - o.near.z) * 0.3;
      if (o.side) v += (fr.u(s.x, s.z) * o.side > 0 ? 0.8 : 0);
      return v;
    }, { noise: 0.2 });
    if (!rec) break;
    placed.push(rec);
  }
  if (o.sign && placed.length >= 2 && ok('sign', room.biome)) {
    const f0 = placed[0].spot.face, ts = placed.filter(p => p.spot.face === f0).map(p => p.spot.t);
    const mid = (Math.min(...ts) + Math.max(...ts)) / 2;
    const s = mountSpots(room, 'sign', { face: f0, at: mid, y: 1.3 }).find(m => Math.abs(m.t - mid) < 0.01);
    if (s) putMount(room, 'sign', s);
  }
  return placed;
}

// A station against a wall with its extensions beside it (learned offsets: chopping block 2 m to the side, anvil
// 1.5 m, bellows and cooler on the other side).
function placeStation(room, k, name, exts, o = {}) {
  if (!ok(name, room.biome)) return null;
  const fr = room.frame();
  const spots = wallSpots(room, name);
  const [w] = size(name);
  const rec = best(room, name, spots, s => {
    let v = (o.back != null ? o.back : 0.5) * fr.v(s.x, s.z) / fr.D;
    if (room.doorDist(s.x, s.z) < 2.2) v -= 2;
    if (o.side) v += fr.u(s.x, s.z) * o.side > 0 ? 1 : 0;
    // room either side for the extensions
    const st = stretch(s.face, s.t - w / 2 - 1.2, s.t + w / 2 + 1.2);
    if (!st.ks.has('wall') || st.ks.has('door') || st.ks.has('none')) v -= 0.8;
    return v;
  }, { noise: 0.3 });
  if (!rec) return null;
  // the place to stand and work, kept clear
  const fx = Math.sin(rec.yaw * PI / 180), fz = Math.cos(rec.yaw * PI / 180);
  room.zones.push({ b: obox(rec.x + fx * (size(name)[2] / 2 + 0.6), rec.z + fz * (size(name)[2] / 2 + 0.6), w + 0.4, 1.2, rec.yaw), why: 'work' });
  let sgn = room.R() < 0.5 ? 1 : -1;
  for (const e of exts) {
    if (!ok(e, room.biome)) continue;
    const [ew] = size(e);
    let done = false;
    for (const sg of [sgn, -sgn]) {
      // the next free stretch of the same wall
      for (let gap = 0.1; gap < 1.6 && !done; gap += 0.25) {
        const t = rec.spot.t + sg * (w / 2 + gap + ew / 2 + (rec.extOff && rec.extOff[sg] || 0));
        const sp = wallSpots(room, e, { face: rec.spot.face }).filter(s => Math.abs(s.t - t) < 0.13);
        for (const s of sp) {
          const r = room.put(e, s.x, s.z, s.yaw);
          if (r) { rec.extOff = rec.extOff || {}; rec.extOff[sg] = (rec.extOff[sg] || 0) + gap + ew + 0.05; done = true; break; }
        }
      }
      if (done) { sgn = -sg; break; }
    }
  }
  return rec;
}

// Lights: torches on the walls in pairs either side of a face's middle; floor torches in corners and by beds and seats
// of honor, clear of furniture (learned: 1.4 m to the nearest furniture at the tenth percentile).
function placeLights(room, k, n, o = {}) {
  let done = 0;
  if (k.wallLight && ok(k.wallLight, room.biome)) {
    const faces = [...room.faces].sort((a, b) => b.len - a.len);
    for (const face of faces) {
      if (done >= n) break;
      const spots = mountSpots(room, k.wallLight, { face, pairs: true }).filter(s => s.pair && Math.abs(s.pair) >= Math.min(1.5, face.len / 4));
      // a pair at the same distance either side of the middle, as far apart as a third of the face
      const byK = new Map();
      for (const s of spots) { const kk = Math.abs(s.pair).toFixed(2); if (!byK.has(kk)) byK.set(kk, []); byK.get(kk).push(s); }
      const want = face.len / 3.2;
      const ks = [...byK.keys()].sort((a, b) => Math.abs(+a - want) - Math.abs(+b - want));
      for (const kk of ks) {
        const pr = byK.get(kk);
        if (pr.length < 2) continue;
        const a = putMount(room, k.wallLight, pr[0]);
        if (!a) continue;
        const b = putMount(room, k.wallLight, pr[1]);
        if (!b) { room.out.pop(); room.mates.splice(room.mates.indexOf(room.placed.pop()), 1); room.mounts.pop(); room.count--; continue; }
        done += 2;
        break;
      }
    }
  }
  if (done < n && k.floorLight && ok(k.floorLight, room.biome)) {
    const name = k.floorLight;
    const spots = wallSpots(room, name, { gap: 0.05, tallOk: o.tallOk });
    while (done < n) {
      const rec = best(room, name, spots, s => {
        let v = s.corner ? 1.5 : 0;
        let near = Infinity;
        for (const q of room.placed) if (!q.rug && !q.mount) near = Math.min(near, ptDist(q.b, s.x, s.z));
        if (near < 0.9) return -99;
        v += Math.min(near, 3) * 0.3;
        if (o.flank) v -= Math.min(...o.flank.map(f => Math.abs(Math.hypot(s.x - f.x, s.z - f.z) - 1.6))) * 0.8;
        for (const q of room.placed) if (q.name === name && Math.hypot(q.x - s.x, q.z - s.z) < 3) v -= 2;
        return v;
      }, { noise: 0.3 });
      if (!rec) break;
      done++;
    }
  }
  return done;
}

// Wall pieces centered on faces: the longest plain faces first, the door's wall last; pairs either side when a face is
// long, so a wall reads as one composition.
function placeMounts(room, names, o = {}) {
  let done = 0;
  const fr = room.frame();
  const faces = [...room.faces].sort((a, b) => {
    const sa = a.len - (a.runs.some(r => r.kind === 'door') ? 3 : 0) + (fr.v(a.px((a.a0 + a.a1) / 2), a.pz((a.a0 + a.a1) / 2)) > fr.D * 0.6 ? 1 : 0);
    const sb = b.len - (b.runs.some(r => r.kind === 'door') ? 3 : 0) + (fr.v(b.px((b.a0 + b.a1) / 2), b.pz((b.a0 + b.a1) / 2)) > fr.D * 0.6 ? 1 : 0);
    return sb - sa;
  });
  const used = new Set();
  for (const name of names) {
    if (!ok(name, room.biome)) continue;
    let placed = false;
    for (const face of faces) {
      if (used.has(face) && !o.share) continue;
      const spots = mountSpots(room, name, { face }).filter(s => s.centered === 2);
      spots.sort((a, b) => Math.abs(a.t - (face.a0 + face.a1) / 2) - Math.abs(b.t - (face.a0 + face.a1) / 2));
      for (const s of spots) if (putMount(room, name, s)) { placed = true; break; }
      if (placed) { used.add(face); done++; break; }
    }
  }
  return done;
}

// Something standing against a wall (armor stand, fermenter, barrel, cartography table).
function placeAgainst(room, name, score, o = {}) {
  if (!ok(name, room.biome)) return null;
  return best(room, name, wallSpots(room, name, o), s => {
    let v = score ? score(s) : 0;
    if (room.doorDist(s.x, s.z) < 1.8) v -= 3;
    return v;
  }, { noise: 0.4 });
}

// On a table: horizontal item stands (dishes and goods), candles from the Mountain on.
function placeOnTable(room, table, names) {
  if (!table) return 0;
  table.topped = true;
  const f = F[table.name] || {};
  const top = table.y0 + (f.top || 0.75);
  const [tw] = size(table.name);
  const bx = Math.cos(table.yaw * PI / 180), bz = -Math.sin(table.yaw * PI / 180);
  let n = 0;
  names.forEach((name, i) => {
    if (!ok(name, room.biome)) return;
    const off = f.round ? (i - (names.length - 1) / 2) * 0.45 : (i - (names.length - 1) / 2) * Math.min(0.9, tw / (names.length + 0.5));
    room.add(name, table.x + bx * off, top, table.z + bz * off, table.yaw + (name === 'itemstandh' ? 0 : 0), { onTable: table });
    n++;
  });
  return n;
}

// Seats facing the fire, a little way back from it.
function placeFireSeats(room, k, n) {
  if (!room.fire) return 0;
  const seat = k.bench || k.seat;
  const backs = (F[seat] || {}).back ? 180 : 0;
  const fire = room.fire;
  let done = 0;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].sort(() => 0);
  const order = dirs.map(d => [d, room.R()]).sort((a, b) => a[1] - b[1]).map(([d]) => d);
  for (const [dx, dz] of order) {
    if (done >= n) break;
    const ext = Math.abs(dx) ? fire.b.hw : fire.b.hd;
    for (const dist of [ext + 1.0, ext + 1.3, ext + 1.6]) {
      const x = fire.x + dx * dist, z = fire.z + dz * dist;
      if (room.put(seat, x, z, norm(yawOfDir(-dx, -dz) + backs), { ignore: ['fire'] })) { done++; break; }
    }
  }
  return done;
}

// ---------------------------------------------------------------- the building
// Whole-building limits per decor stage, so a big house with several rooms is furnished like one home.
const CAPS = { d1: { bed: 2, table: 2 }, d2: { bed: 3, table: 6 }, d3: { bed: 4, table: 9 } };
const BED_CAP = { hall: [2, 6, 8], guard: [1, 3, 4] }; // inns and guard towers sleep more

// Furniture per 10 m2 of floor, from the corpus per room kind (25th, 50th and 75th percentile for d1, d2, d3).
function density(kind, decor) {
  const r = (learned().rooms || {})[kind];
  const q = r && r.perTenM2 ? r.perTenM2 : [1.2, 2.2, 3.2];
  return q[decor === 'd1' ? 0 : decor === 'd2' ? 1 : 2];
}

// The building's kit: one choice of bed, chest, table, seats, rug and lights per building, seeded, from what the biome
// can make, weighted by how often each shows in that kind of room in the corpus.
function chooseKit(R, biome, culture, kind) {
  const L = learned().rooms || {};
  const shares = new Map(((L[kind] || L.home || {}).items || []).map(([n, s]) => [n, s]));
  const pick = (list, floor = 0.15) => {
    const ok2 = list.filter(n => ok(n, biome));
    if (!ok2.length) return null;
    return pickW(R, ok2.map(n => [n, (shares.get(n) || 0) + floor]));
  };
  const taste = CULTURE_TASTE[culture] || {};
  const k = {
    bed: pick(KIT.bed.filter(n => n !== 'piece_bed02' || R() < 0.5), 0.2),
    chest: pick(KIT.chest, 0.2),
    table: taste.noTable ? null : pick(KIT.table),
    chair: pick(KIT.chair),
    bench: pick(KIT.bench, 0.3),
    rug: pick(KIT.rug, 0.2),
    floorLight: pick(KIT.floorLight, 0.3),
    wallLight: pick(KIT.wallLight, 0.3),
    banner: pick(KIT.banner, 0.2),
    carving: pick(KIT.carving, 0.2),
    stack: pick(KIT.stack, 0.3),
    side: R() < 0.5 ? 1 : -1,
    taste,
  };
  k.seat = taste.seat === 'bench' ? (k.bench || k.chair) : (R() < 0.45 ? k.bench || k.chair : k.chair || k.bench);
  return k;
}

function decorate(b, ctx) {
  const R = ctx.R || Math.random;
  const decor = ['d1', 'd2', 'd3'].includes(ctx.decor) ? ctx.decor : 'd2';
  const biome = ctx.biome || 'Meadows';
  const use = ctx.use || 'home';
  const type = ctx.type || use;
  // levels from the building's rooms (or from its floors when it has none)
  const byY = new Map();
  for (const r of b.rooms || []) { const k = Math.round(r.y * 4) / 4; if (!byY.has(k)) byY.set(k, []); byY.get(k).push(r); }
  if (!byY.size) for (const y of floorLevels(b.pieces)) byY.set(y, []);
  const ys = [...byY.keys()].sort((a, c) => a - c);
  const counts = { bed: 0, table: 0 };
  const kitKind = { home: 'home', hall: type === 'tavern' ? 'tavern' : 'hall', smithy: 'smithy', workshop: 'workshop', storage: 'storage', temple: 'hall', guard: 'sleeping', farm: 'storage', market: 'living' }[use] || 'home';
  const kit = chooseKit(R, biome, ctx.culture, kitKind);
  const report = [], furnished = [];
  const usedTemplates = ctx.usedTemplates || new Set();
  ys.forEach((y, li) => {
    const rects = byY.get(y);
    const hintY = rects.length ? standGuess(b.pieces, rects, y) : y;
    const models = readLevel(b.pieces, hintY, rects.length ? rects : null) || [];
    const main = rects.find(r => r.main) || rects[0];
    const levelPlaced = [];
    for (const m of models) {
      if (m.area < 4) continue;
      // an open deck or lookout with nothing over it gets nothing
      if (m.covered < 0.5) continue;
      const room = new Room(m, { out: b.pieces, R, mates: levelPlaced });
      room.biome = biome;
      room.level = li;
      room.upper = li > 0 || (rects.length && rects.every(r => r.upper));
      const inMain = main && m.cells.filter(c => c.x > main.x0 && c.x < main.x1 && c.z > main.z0 && c.z < main.z1).length;
      const role = ctx.role || roleFor(use, type, room, inMain / m.cells.length, rects, ys.length, li);
      if (!role) continue;
      // the main way in: a door, else the top of the stairs, else the room's longest open side
      room.entry = room.doors.slice().sort((a, c) => (a.open ? 1 : 0) - (c.open ? 1 : 0) || Math.abs(a.x - (ctx.doorX ?? a.x)) - Math.abs(c.x - (ctx.doorX ?? c.x)))[0] || null;
      if (!room.entry && room.stairs.length) {
        const s = room.stairs[0];
        const dx = room.cx - s.b.x, dz = room.cz - s.b.z, l = Math.hypot(dx, dz) || 1;
        room.entry = { x: s.b.x, z: s.b.z, nx: dx / l, nz: dz / l, w: 1, ht: s.b.hd, stair: true };
      }
      if (main && rects.length > 1) {
        const side = rects.filter(r => r !== main);
        room.sideCells = (x, z) => side.some(r => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) && !(x > main.x0 && x < main.x1 && z > main.z0 && z < main.z1);
      }
      doorZones(room, role);
      // what the building keeps clear: the chimney over the fire (every floor) and its rooms' own keep-clear boxes
      for (const v of b.vents || []) if (v.rect) room.zones.push({ b: obox((v.rect.x0 + v.rect.x1) / 2, (v.rect.z0 + v.rect.z1) / 2, v.rect.x1 - v.rect.x0, v.rect.z1 - v.rect.z0, 0), why: 'flue' });
      // over the fire on an upper floor: the generator clears what stands over a fire it moves under the smoke hole
      if (room.upper && ctx.fireAt) room.zones.push({ b: obox(ctx.fireAt.x, ctx.fireAt.z, 4.0, 2.8, 0), why: 'flue' });
      for (const r of rects) for (const kp of r.keep || []) room.zones.push({ b: obox((kp.x0 + kp.x1) / 2, (kp.z0 + kp.z1) / 2, kp.x1 - kp.x0, kp.z1 - kp.z0, 0), why: 'keep' });
      furnish(room, role, { ...ctx, use, type, decor, biome, kit, counts, mainRect: main, levels: ys.length, usedTemplates });
      report.push({ level: li, role, area: room.area, items: room.count, room, template: room.template || null });
      furnished.push({ room, role });
    }
  });
  // a house always has at least one bed, whatever its floors made room for
  if (counts.bed === 0 && (ctx.role ? ['home', 'sleeping', 'guest'].includes(ctx.role) : use === 'home')) {
    const order = furnished.slice().sort((a, c2) => (a.role === 'sleeping' ? 0 : 1) - (c2.role === 'sleeping' ? 0 : 1) || c2.room.area - a.room.area);
    for (const { room } of order) { if (placeBeds(room, kit, 1, decor === 'd1' ? 1 : decor === 'd2' ? 2 : 3, 0.4).length) { counts.bed++; break; } }
  }
  for (const r of report) { r.items = r.room.count; delete r.room; }
  if (decor !== 'd1') outside(b, { use, type, decor, biome, kit, R });
  b.decorReport = report;
  return b;
}

function standGuess(pieces, rects, y) {
  // the floor pieces inside these rooms at about this height: their stand height
  const vals = [];
  for (const p of pieces) {
    if (p.decor || P.piece(p.name).role !== 'floor') continue;
    if (p.y < y - 0.7 || p.y > y + 0.3) continue;
    if (!rects.some(r => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1)) continue;
    vals.push(+(p.y + standOf(p.name)).toFixed(2));
  }
  if (!vals.length) return y + 0.1;
  const c = new Map();
  for (const v of vals) c.set(v, (c.get(v) || 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

// Floor heights of a blueprint without room hints: stand heights with at least four floor pieces.
function floorLevels(pieces) {
  const c = new Map();
  for (const p of pieces) {
    if (p.decor || P.piece(p.name).role !== 'floor') continue;
    const k = Math.round((p.y + standOf(p.name)) * 4) / 4;
    c.set(k, (c.get(k) || 0) + 1);
  }
  // heights within 0.6 m of a busier one are the same floor (steps, a raised hearth platform)
  const lv = [...c.entries()].filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]);
  const kept = [];
  for (const [k] of lv) if (!kept.some(q => Math.abs(q - k) < 0.6)) kept.push(k);
  return kept.sort((a, b) => a - b);
}

// Under a roof with walls on all four sides: indoors, whatever the floor.
function enclosed(x, z, y, over, wallish) {
  if (!over.some(o => o.y0 > y + 1 && ptDist(o.b, x, z) < 0.01)) return false;
  let sides = 0;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let hit = false;
    for (let t = 0.3; t < 6 && !hit; t += 0.3) for (const s of wallish) if (s.y0 < y + 1 && s.y1 > y + 0.3 && ptDist(s.b, x + dx * t, z + dz * t) < 0.05) { hit = true; break; }
    if (hit) sides++;
  }
  return sides >= 4;
}

// What a room is for: the building's use on the main floor, sleeping or storage above, side wings by use.
function roleFor(use, type, room, mainShare, rects, nLevels, li) {
  if (use === 'yard') return null;
  if (room.upper) {
    if (use === 'guard') return li === nLevels - 1 ? 'lookout' : 'guard';
    if (use === 'home') return 'sleeping';
    if (use === 'hall') return type === 'tavern' ? 'guest' : 'sleeping';
    return 'storage';
  }
  if (use === 'guard') return 'guard';
  if (use === 'hall') return type === 'tavern' ? 'tavern' : type === 'temple' ? 'temple' : 'hall';
  return use;
}

// ---------------------------------------------------------------- room plans
function furnish(room, role, c) {
  if (tplFurnish(room, role, c)) {
    if (c.templateOnly) return; // 'vh floorplan template': the room as the template lays it out, nothing added
    // a template thin for a big room is topped up with the extras toward the corpus rate, a little short of it at d2 so
    // the template's own layout stays the larger part
    if (c.decor !== 'd1') fill(room, role, { ...c, fillShare: c.decor === 'd3' ? 1 : 0.9 });
    return;
  }
  furnishPlan(room, role, c);
  if (c.decor !== 'd1') fill(room, role, c);
}

const LEARN_KIND = { lookout: 'sleeping', home: 'home', sleeping: 'sleeping', guest: 'sleeping', hall: 'hall', tavern: 'tavern', temple: 'hall', smithy: 'smithy', workshop: 'workshop', storage: 'storage', guard: 'sleeping', farm: 'storage', market: 'living', kitchen: 'kitchen' };

// What builders add once the needs are met, per room role, with weights. Each is a cluster from the corpus pairs:
// trophies (item stands in a row on one wall), shelves (horizontal item stands), barrels and crates in a corner, a
// seating corner, rugs, armor stands, banners in pairs, carvings, things on tables, tools on a work wall.
// The touches Tyler asked for (2026-11-09) are extras too: a bench at the foot of a bed (footBench) or by the door
// (doorBench), a reading corner (nook: a chair in a corner with a light beside it), seats on every side of the fire
// (ring), storage along one wall with a sign (storeWall), a rug under a table or before a fire that has none (groupRug),
// and a light where the room is darkest (evenLights).
const EXTRAS = {
  home: { trophies: 2, shelf: 2, barrels: 2, chest: 1, armor: 1, fermenter: 1, seating: 2, rug: 1, banners: 1, carving: 1, torches: 1, tabletop: 2,
    footBench: 2, doorBench: 1, nook: 1, groupRug: 2, evenLights: 1, storeWall: 1 },
  sleeping: { rug: 1, armor: 2, chest: 2, shelf: 1, trophies: 1, seating: 1, torches: 1, banners: 1, footBench: 3, nook: 1, groupRug: 1, evenLights: 1 },
  guest: { rug: 2, chest: 2, armor: 1, shelf: 1, torches: 1, seating: 1, footBench: 2, evenLights: 1 },
  hall: { banners: 3, trophies: 2, shelf: 1, barrels: 2, armor: 2, rug: 1, tabletop: 2, torches: 2, carving: 1, chart: 1, bench: 2, ring: 2, doorBench: 1, groupRug: 2, evenLights: 2 },
  tavern: { barrels: 3, fermenter: 2, shelf: 2, tabletop: 3, trophies: 1, rug: 1, seating: 3, torches: 1, banners: 1, doorBench: 1, groupRug: 2, evenLights: 2, nook: 1 },
  smithy: { tools: 3, barrels: 2, chest: 1, armor: 2, shelf: 1, torches: 1, storeWall: 2, evenLights: 1 },
  workshop: { tools: 3, barrels: 2, chest: 1, shelf: 2, torches: 1, bench: 1, storeWall: 2, evenLights: 1 },
  storage: { chest: 2, barrels: 3, crates: 2, shelf: 2, torches: 1, storeWall: 3 },
  farm: { barrels: 2, chest: 2, fermenter: 1, shelf: 1 },
  temple: { banners: 3, carving: 2, torches: 2, rug: 1, bench: 2, evenLights: 1 },
  kitchen: { barrels: 3, shelf: 3, tabletop: 2, chest: 2, fermenter: 1, crates: 1, storeWall: 1, evenLights: 1 },
  guard: { armor: 2, trophies: 2, chest: 1, barrels: 1, torches: 1 },
  lookout: { chest: 1, barrels: 1, rug: 1 },
};

// Top the room up toward the corpus density for its kind (d2 the median, d3 the 75th percentile), with seeded choice
// among the extras. Stops at the target, when every extra has failed, or when half the floor is taken.
function fill(room, role, c) {
  const extras = EXTRAS[role];
  if (!extras) return;
  const d = c.decor === 'd2' ? 2 : 3;
  const k = c.kit, biome = c.biome;
  const tune = ((learned().tuning || {}).density || {})[role] || 1;
  let dens = density(LEARN_KIND[role] || 'home', c.decor) * tune;
  if (role === 'storage' || role === 'farm') dens = Math.min(dens, 4.5); // small store rooms set the corpus rate
  const target = Math.round(room.area / 10 * dens * (c.fillShare || 1));
  if (c.fillOnly && room.count >= target * c.fillOnly / (c.fillShare || 1)) return;
  const floorUsed = () => room.placed.reduce((a, q) => a + (q.rug || q.mount || q.onTable || q.onFire ? 0 : q.b.hw * q.b.hd * 4), 0);
  const barrel = ok('dvergrprops_barrel', biome) && room.R() < 0.4 ? 'dvergrprops_barrel' : ok('piece_chest_barrel', biome) ? 'piece_chest_barrel' : null;
  const pairOn = (name, y, gap, n) => {
    // n pieces in a row centered on the freest plain wall face
    const faces = room.faces.filter(f => !f.edge).sort((a, b2) => (b2.len - room.mounts.filter(m => m.face === b2).length * 2) - (a.len - room.mounts.filter(m => m.face === a).length * 2));
    for (const face of faces) {
      const mid = (face.a0 + face.a1) / 2;
      const ts = n === 3 ? [mid, mid - gap, mid + gap] : n === 2 ? [mid - gap / 2, mid + gap / 2] : [mid];
      const spots = ts.map(t => mountSpots(room, name, { face, at: t, y }).find(m => Math.abs(m.t - t) < 0.01));
      if (spots.some(x => !x)) continue;
      const done = [];
      for (const sp of spots) { const r = putMount(room, name, sp); if (!r) break; done.push(r); }
      if (done.length === spots.length) return done.length;
      for (const r of done) { room.placed.splice(room.placed.indexOf(r), 1); room.mates.splice(room.mates.indexOf(r), 1); room.mounts.pop(); room.count--; const j = room.out.lastIndexOf(room.out.find(p => p.decor && p.name === r.name && p.x === +r.x.toFixed(3) && p.z === +r.z.toFixed(3))); if (j >= 0) room.out.splice(j, 1); }
    }
    return 0;
  };
  const before = () => room.count;
  const run = {
    trophies: () => pairOn('itemstand', 1.6, 1.0, d >= 3 ? 3 : 2),
    shelf: () => pairOn('itemstandh', 1.3, 1.0, 2),
    barrels: () => barrel ? placeStorageRow(room, k, d >= 3 ? 3 : 2, { chest: barrel, back: 1 }).length : 0,
    crates: () => ok('dvergrprops_crate', biome) ? placeStorageRow(room, k, 2, { chest: 'dvergrprops_crate' }).length : 0,
    chest: () => placeStorageRow(room, k, 1).length,
    armor: () => placeAgainst(room, 'ArmorStand', s => (s.corner ? 0.5 : 0)) ? 1 : 0,
    fermenter: () => placeAgainst(room, 'fermenter', s => (s.corner ? 1 : 0)) ? 1 : 0,
    seating: () => { if (!ok('piece_table_round', biome) || (k.taste || {}).noTable) return 0; const n0 = before(); const t = placeTable(room, k, { table: 'piece_table_round', seats: 2, seat: k.chair || k.seat, depth: 0.7, spread: 3.5 }); if (t && d >= 3) placeOnTable(room, t, [ok('Candle_resin', biome) ? 'Candle_resin' : 'itemstandh']); return room.count - n0; },
    rug: () => (k.rug && placeRug(room, k, null) ? 1 : 0),
    banners: () => (k.banner && room.ceiling - room.stand >= 2.9 ? pairOn(k.banner, 0, 2.0, 2) : 0),
    carving: () => (k.carving ? pairOn(k.carving, 1.7, 0, 1) : 0),
    torches: () => placeLights(room, k, 2),
    tabletop: () => {
      let n = 0;
      for (const t of room.placed.filter(q => (F[q.name] || {}).cat === 'table' && !q.topped)) {
        t.topped = true;
        n += placeOnTable(room, t, [ok('treasure_stack', biome) && room.R() < 0.3 ? 'treasure_stack' : 'itemstandh', ok('Candle_resin', biome) ? 'Candle_resin' : 'itemstandh']);
        if (n) break;
      }
      return n;
    },
    tools: () => pairOn('itemstand', 1.5, 0.8, 3) + (placeAgainst(room, ok('piece_workbench_ext4', biome) ? 'piece_workbench_ext4' : 'forge_ext5') ? 1 : 0),
    chart: () => placeAgainst(room, 'piece_cartographytable') ? 1 : 0,
    bench: () => placeAgainst(room, k.bench || 'piece_bench01', null, { rel: (F[k.bench] || {}).back ? 180 : 0 }) ? 1 : 0,
    footBench: () => footBench(room, k),
    doorBench: () => {
      const b = k.bench || 'piece_bench01';
      if (!ok(b, biome)) return 0;
      // against a wall a couple of meters from the door, where you sit to pull your boots on
      return placeAgainst(room, b, s => -Math.abs(room.doorDist(s.x, s.z) - 2.4) * 1.5, { rel: (F[b] || {}).back ? 180 : 0 }) ? 1 : 0;
    },
    nook: () => nook(room, k),
    // a ring of seats on every side of the fire, only in a big hall (a single bench by a fire read as out of place, FP-010)
    ring: () => (room.fire && room.area >= 60 ? placeFireSeats(room, k, 4) : 0),
    storeWall: () => placeStorageRow(room, k, d >= 3 ? 3 : 2, { sign: true, back: 1 }).length,
    groupRug: () => groupRug(room, k),
    evenLights: () => evenLights(room, k),
  };
  // how often one extra may repeat in a room, so a room is a mix and never twenty of one thing
  const MAX = { barrels: 2, crates: 1, chest: 2, armor: 2, fermenter: 1, seating: 2, rug: 2, banners: 1, carving: 2, torches: 1, tabletop: 4, tools: 2, chart: 1, bench: 2, trophies: 2, shelf: 2,
    footBench: 2, doorBench: 1, nook: 1, ring: 1, storeWall: 1, groupRug: 2, evenLights: 2 };
  const used = {};
  const rugs = () => room.placed.filter(q => q.rug).length;
  const live = Object.entries(extras).filter(([kk]) => run[kk]);
  for (let tries = 0; tries < 40 && live.length && room.count < target; tries++) {
    const key = pickW(room.R, live);
    const floor = !['trophies', 'shelf', 'banners', 'carving', 'tabletop', 'rug', 'groupRug'].includes(key);
    let got = 0;
    const full = (used[key] || 0) >= (MAX[key] || 2) || (key === 'rug' && rugs() >= Math.max(1, Math.floor(room.area / 15)));
    if (!full && !(floor && floorUsed() > room.area * 0.5)) got = run[key]();
    used[key] = (used[key] || 0) + 1;
    if (!got || full) live.splice(live.findIndex(([kk]) => kk === key), 1);
  }
}

// A bench across the foot of a bed, facing the room, where no chest stands there already.
function footBench(room, k) {
  const b = ok('piece_bench01', room.biome) ? 'piece_bench01' : k.bench;
  if (!b || !ok(b, room.biome)) return 0;
  let n = 0;
  for (const bed of room.placed.filter(q => (F[q.name] || {}).cat === 'bed' && !q.footed)) {
    bed.footed = true;
    const a = bed.yaw * PI / 180, ax = Math.sin(a), az = Math.cos(a);
    const reach = size(bed.name)[2] / 2 + size(b)[2] / 2 + 0.12;
    if (room.placed.some(q => q !== bed && !q.rug && !q.mount && Math.hypot(q.x - (bed.x + ax * reach), q.z - (bed.z + az * reach)) < 0.7)) continue;
    // the bench's front (local +z) faces away from the bed; a log bench sits the other way round
    const yaw = norm(bed.yaw + ((F[b] || {}).back ? 180 : 0));
    for (const extra of [0, 0.15, 0.3]) {
      if (room.put(b, bed.x + ax * (reach + extra), bed.z + az * (reach + extra), yaw)) { n++; break; }
    }
    if (n) break;
  }
  return n;
}

// A reading corner: a chair in a corner turned to the room, a light beside it, a rug in front where it fits.
function nook(room, k) {
  const chair = ok('piece_chair02', room.biome) ? 'piece_chair02' : k.chair || 'piece_chair';
  if (!ok(chair, room.biome)) return 0;
  const spots = wallSpots(room, chair, { gap: 0.15 }).filter(s => s.corner);
  const rec = best(room, chair, spots, s => (room.doorDist(s.x, s.z) < 2.5 ? -99 : 0) + Math.min(4, room.doorDist(s.x, s.z)) * 0.2, { noise: 0.5 });
  if (!rec) return 0;
  // the chair turned 45 degrees out of the corner, toward the middle of the room
  const yaw = norm(yawOfDir(room.cx - rec.x, room.cz - rec.z));
  if (room.fits(chair, rec.x, rec.z, yaw, { on: rec })) { const o = room.out[room.out.length - 1]; rec.yaw = yaw; rec.b = obox(rec.x, rec.z, ...[size(chair)[0], size(chair)[2]], yaw); o.yaw = yaw; o.q = quatY(yaw); }
  let n = 1;
  n += placeLights(room, k, 1, { flank: [rec] });
  if (k.rug && room.R() < 0.6 && placeRug(room, k, rec, { mode: 'front' })) n++;
  return n;
}

// A rug under the table or before the fire that has none.
function groupRug(room, k) {
  if (!k.rug) return 0;
  for (const t of room.placed.filter(q => (F[q.name] || {}).cat === 'table' || q.fire)) {
    if (room.placed.some(r => r.rug && overlap(r.b, t.b, -0.1))) continue;
    if (t.fire) { if (placeRug(room, k, t, { mode: 'fire' })) return 1; continue; }
    if (placeRug(room, k, t, { mode: 'under' })) return 1;
  }
  return 0;
}

// A floor torch where the room is darkest: the wall spot farthest from every light, if that is more than 3.5 m.
function evenLights(room, k) {
  const name = k.floorLight;
  if (!name || !ok(name, room.biome)) return 0;
  const lights = room.placed.filter(q => (F[q.name] || {}).cat === 'light' || q.fire).map(q => [q.x, q.z]);
  const far = (x, z) => (lights.length ? Math.min(...lights.map(([lx, lz]) => Math.hypot(lx - x, lz - z))) : 9);
  // darkest floor cell
  let dark = null, dd = 0;
  for (const c of room.cells) { const v = far(c.x, c.z); if (v > dd) { dd = v; dark = c; } }
  if (!dark || dd < 3.5) return 0;
  const spots = wallSpots(room, name, { gap: 0.05 });
  const rec = best(room, name, spots, s => {
    for (const q of room.placed) if (!q.rug && !q.mount && ptDist(q.b, s.x, s.z) < 0.9) return -99;
    if (room.doorDist(s.x, s.z) < 1.8) return -99;
    return -Math.hypot(s.x - dark.x, s.z - dark.z) + (s.corner ? 0.5 : 0);
  }, { noise: 0.2 });
  return rec ? 1 : 0;
}

function furnishPlan(room, role, c) {
  const { decor, kit: k, counts } = c;
  const d = decor === 'd1' ? 1 : decor === 'd2' ? 2 : 3;
  const biome = c.biome;
  const fr = () => room.frame();
  const taste = k.taste || {};
  const learnKind = { home: 'home', sleeping: 'sleeping', guest: 'sleeping', hall: 'hall', tavern: 'tavern', temple: 'hall', smithy: 'smithy', workshop: 'workshop', storage: 'storage', guard: 'sleeping', farm: 'storage', market: 'living', lookout: 'other' }[role] || 'home';
  const budget = Math.max(3, Math.round(room.area / 10 * density(learnKind, decor)));
  const room_ok = () => room.count < budget;
  const capBed = n => Math.max(0, Math.min(n, (BED_CAP[c.use] ? BED_CAP[c.use][d - 1] : CAPS[decor].bed) - counts.bed));
  const lights = n => Math.round(n * (taste.lights || 1));
  const bed = (n, row) => { const r = placeBeds(room, k, capBed(n), d, row); counts.bed += r.length; return r; };
  const table = o => { if (!k.table || counts.table >= CAPS[decor].table) return null; const t = placeTable(room, k, o); if (t) counts.table++; return t; };
  const mountsFor = () => {
    const list = ['itemstand'];
    if (d >= 3 && k.banner && room.ceiling - room.stand >= 2.9) list.push(k.banner);
    if (d >= 3 && k.carving) list.push(k.carving);
    if (d >= 3) list.push('itemstand');
    return list;
  };
  const isFire = ['home', 'hall', 'tavern'].includes(role) && !room.upper;

  if (role === 'home') {
    if (isFire) { placeFire(room, c, 'fire_pit'); onFire(room, d >= 2 && ok('piece_cauldron', biome) && room.R() < 0.4 ? 'piece_cauldron' : 'piece_cookingstation'); }
    // beds first: a house always sleeps someone (Tyler, T-102)
    const nb = c.levels > 1 ? (d === 1 ? 1 : 0) : Math.max(1, Math.min(d + 1, Math.round(room.area / (d >= 3 ? 22 : 30))));
    const beds = bed(nb, 0.4);
    planPaths(room);
    placeStorageRow(room, k, d >= 2 ? 1 : 0, { side: k.side });
    if (d >= 2) {
      const t = table({ seats: d >= 3 ? 4 : 2 });
      if (t && k.rug && d >= 3) placeRug(room, k, t, { mode: 'under' });
      if (k.rug) placeRug(room, k, room.fire, { mode: 'fire' });
      placeLights(room, k, lights(d >= 3 ? 3 : 1));
      placeMounts(room, mountsFor());
      if (d >= 3) {
        if (t) placeOnTable(room, t, ['itemstandh', 'Candle_resin']);
        // no bench by the fire in a home (Tyler, FP-002: bench not necessary)
        placeAgainst(room, 'ArmorStand', s => (beds[0] ? -Math.hypot(s.x - beds[0].x, s.z - beds[0].z) * 0.3 : 0));
        if (room_ok()) placeAgainst(room, 'fermenter', s => (s.corner ? 1 : 0) - fr().v(s.x, s.z) / fr().D);
        if (room_ok()) placeStorageRow(room, k, 1, { chest: ok('piece_chest_barrel', biome) ? 'piece_chest_barrel' : k.chest });
        if (room_ok()) placeStation(room, k, 'piece_workbench', ['piece_workbench_ext1'], { side: -k.side, back: 0.2 });
      }
    } else {
      placeLights(room, k, 0);
    }
    return;
  }
  if (role === 'sleeping' || role === 'guest') {
    const nb = role === 'guest' ? Math.max(2, Math.round(room.area / 14)) : Math.max(1, Math.round(room.area / 18));
    const beds = bed(d === 1 ? Math.min(nb, 2) : nb, role === 'guest' ? 1.5 : 0.4);
    planPaths(room);
    if (d >= 2 || !beds.length) placeStorageRow(room, k, beds.length ? 0 : 1);
    if (d >= 2) {
      for (const bd of beds.slice(0, d >= 3 ? 2 : 1)) if (k.rug) placeRug(room, k, bd, { mode: 'beside' });
      placeLights(room, k, lights(d >= 3 ? 2 : 1), { flank: beds });
      placeMounts(room, d >= 3 ? ['itemstand', k.banner, 'itemstand'] : ['itemstand']);
      if (d >= 3) placeAgainst(room, 'ArmorStand', s => (beds[0] ? -Math.hypot(s.x - beds[0].x, s.z - beds[0].z) * 0.3 : 0));
      if (d >= 3 && room_ok() && room.area > 20) { const t = table({ seats: 2, depth: 0.5 }); if (t) placeOnTable(room, t, ['Candle_resin']); }
    }
    return;
  }
  if (role === 'hall' || role === 'tavern') {
    const tavern = role === 'tavern';
    if (isFire) {
      placeFire(room, c, ok('hearth', biome) && !tavern ? 'hearth' : 'fire_pit');
      if (room.fire && room.fire.name === 'fire_pit') onFire(room, ok('piece_cookingstation_iron', biome) && d >= 3 ? 'piece_cookingstation_iron' : 'piece_cookingstation');
    }
    planPaths(room);
    const fr0 = fr();
    // the seat of honor at the far end, facing the way in
    let throne = null;
    if (d >= 2 && !tavern && ok('piece_throne01', biome)) {
      throne = best(room, 'piece_throne01', wallSpots(room, 'piece_throne01'), s => fr0.v(s.x, s.z) / fr0.D * 3 - Math.abs(fr0.u(s.x, s.z)) * 0.8 - (s.win ? 2 : 0), { noise: 0.1 });
      if (throne) { if (k.rug) placeRug(room, k, throne, { mode: 'front' }); placeLights(room, { ...k, wallLight: null }, 2, { flank: [throne] }); }
    }
    // corpus taverns: about one table per 45 m2 (tables, round tables and long heavy tables together)
    const nt = tavern ? Math.max(2, Math.min(8, Math.round(room.area / (d >= 3 ? 22 : 32)))) : Math.max(1, Math.min(d + 1, 5, Math.round(room.area / 24)));
    const tables = [];
    for (let i = 0; i < nt; i++) {
      const longT = !tavern || i % 2 === 0;
      const tn = longT ? (ok('piece_table_oak', biome) && d >= 3 && room.area > 60 && i === 0 ? 'piece_table_oak' : 'piece_table') : (ok('piece_table_round', biome) ? 'piece_table_round' : 'piece_table');
      const t = table({ table: tn, seats: tn === 'piece_table_round' ? 4 : 6, seat: tavern && tn === 'piece_table_round' ? (k.chair || k.seat) : (k.bench || k.seat), head: !tavern && d >= 3, depth: 0.5, nearFire: tavern ? 0.5 : 0, sideBias: 0.3, wallBias: tavern ? 0.6 : -0.3, spread: tavern ? 4.5 : 6, axis: tavern ? 0.4 : 1.5 });
      if (!t) break;
      tables.push(t);
      if (d >= 3 && i < 2) placeOnTable(room, t, ['itemstandh', 'Candle_resin', 'itemstandh']);
    }
    placeStorageRow(room, k, d >= 2 ? 2 : 1, { sign: d >= 2 });
    if (!tavern && d >= 2) {
      // benches along the long walls, where the household sat and slept
      const bench = k.bench || 'piece_bench01';
      const longX = (room.x1 - room.x0) >= (room.z1 - room.z0);
      for (let i = 0; i < (d >= 3 ? 4 : 2); i++) placeAgainst(room, bench, s => (Math.abs(longX ? s.face.nz : s.face.nx) > 0.7 ? 2 : -2)
        - room.placed.filter(q => q.name === bench).reduce((a, q) => a + Math.max(0, 4 - Math.hypot(q.x - s.x, q.z - s.z)), 0), { rel: (F[bench] || {}).back ? 180 : 0 });
    }
    if (tavern && d >= 2) {
      // the bar: barrels and fermenters along one wall
      placeAgainst(room, 'fermenter', s => (s.corner ? 1 : 0) + fr().v(s.x, s.z) / fr().D);
      if (d >= 3) placeAgainst(room, 'fermenter', s => (s.corner ? 1 : 0) + fr().v(s.x, s.z) / fr().D);
      placeStorageRow(room, k, d >= 3 ? 3 : 2, { chest: ok('piece_chest_barrel', biome) ? 'piece_chest_barrel' : k.chest });
    }
    if (d >= 2) {
      placeLights(room, k, lights(d >= 3 ? 4 : 2));
      if (ok('piece_brazierceiling01', biome) && tables[0] && room.ceilAt(tables[0].x, tables[0].z) - room.stand > 3.5) {
        const t = tables[0];
        room.add('piece_brazierceiling01', t.x, room.ceilAt(t.x, t.z) - F.piece_brazierceiling01.under, t.z, 0, { mount: true, y0: room.ceilAt(t.x, t.z) - 1.6 });
      }
      placeMounts(room, d >= 3 ? ['itemstand', k.banner, k.carving, 'itemstand', k.banner].filter(Boolean) : ['itemstand', 'itemstand'], { share: d >= 3 });
      if (d >= 3) {
        if (room_ok()) placeAgainst(room, 'ArmorStand', s => (throne ? -Math.abs(Math.hypot(s.x - throne.x, s.z - throne.z) - 2) : 0));
        if (room_ok() && !tavern) placeAgainst(room, 'piece_cartographytable', s => -Math.abs(fr().v(s.x, s.z) / fr().D - 0.6));
        if (k.rug) for (const t of tables.slice(0, 1)) placeRug(room, k, t, { mode: 'under' });
        // seats by the fire in a hall only; a tavern sits at its tables (Tyler, FP-010: bench not needed next to campfire)
        if (!tavern) placeFireSeats(room, k, 2);
      }
    }
    return;
  }
  if (role === 'temple') {
    planPaths(room);
    const fr0 = fr();
    // an altar table in the middle of the far wall, benches in two rows facing it with an aisle between
    const altarName = k.table && !(F[k.table] || {}).round ? k.table : 'piece_table';
    let altar = best(room, altarName, wallSpots(room, altarName, { gap: 0.3 }), s => fr0.v(s.x, s.z) / fr0.D * 4 - Math.abs(s.t - (s.face.a0 + s.face.a1) / 2) * 1.5 - (s.win ? 1 : 0), { noise: 0.05 });
    if (!altar && room.entry) {
      // no wall to stand it against: free-standing near the far end, facing the way in
      const e = room.entry, yaw = norm(yawOfDir(-e.nx, -e.nz));
      altar = best(room, altarName, room.cells.map(c => ({ x: c.x, z: c.z, yaw })), sp => fr0.v(sp.x, sp.z) / fr0.D * 4 - Math.abs(fr0.u(sp.x, sp.z)) * 1.5, { noise: 0.05 });
    }
    if (altar) {
      placeOnTable(room, altar, ['Candle_resin', 'itemstandh', 'Candle_resin']);
      placeLights(room, { ...k, wallLight: null }, 2, { flank: [altar] });
    }
    if (d >= 2 && altar) {
      const seat = k.bench || 'piece_bench01';
      const yawIn = altar.yaw;
      const ax = Math.sin(yawIn * PI / 180), az = Math.cos(yawIn * PI / 180), bx = Math.cos(yawIn * PI / 180), bz = -Math.sin(yawIn * PI / 180);
      const half = size(seat)[0] / 2 + 1.1;
      for (let row = 0; row < 8; row++) for (const sg of [1, -1]) {
        const dist = 2.4 + row * 1.3;
        for (const lat of [half, half + 0.25, half - 0.15, half + 0.5]) {
          if (room.put(seat, altar.x + ax * dist + bx * sg * lat, altar.z + az * dist + bz * sg * lat, norm(yawIn + 180 + ((F[seat] || {}).back ? 180 : 0)))) break;
        }
      }
      placeMounts(room, d >= 3 ? [k.banner, k.banner, k.carving, k.carving].filter(Boolean) : [k.banner || 'itemstand'], { share: true });
      placeLights(room, k, lights(d >= 3 ? 4 : 2));
      if (d >= 3 && k.rug) {
        // a runner down the aisle
        for (let dist = 1.6, n = 0; dist < 12 && n < 3; dist += size(k.rug)[2], n++) if (!room.put(k.rug, altar.x + ax * dist, altar.z + az * dist, norm(yawIn), { clearOf: ['seat', 'table'] })) break;
      }
    }
    return;
  }
  if (role === 'smithy') {
    planPaths(room);
    const exts = ['forge_ext1', 'forge_ext2', 'forge_ext4', 'forge_ext3', 'forge_ext5', 'forge_ext6'].slice(0, d === 1 ? 0 : d === 2 ? 2 : 5);
    placeStation(room, k, 'forge', exts, { back: 1 });
    placeStation(room, k, 'piece_workbench', d >= 2 ? ['piece_workbench_ext1', 'piece_workbench_ext3'] : [], { side: -k.side });
    placeStorageRow(room, k, d >= 2 ? 2 : 1, { sign: d >= 3 });
    if (d >= 2) {
      placeLights(room, k, lights(d >= 3 ? 3 : 1));
      placeMounts(room, d >= 3 ? ['itemstand', 'itemstand', 'itemstand'] : ['itemstand']);
      if (d >= 3) { placeAgainst(room, 'ArmorStand'); if (room_ok()) table({ seats: 1, depth: 0.5 }); }
    }
    return;
  }
  if (role === 'workshop') {
    planPaths(room);
    placeStation(room, k, 'piece_workbench', d === 1 ? [] : d === 2 ? ['piece_workbench_ext1', 'piece_workbench_ext2'] : ['piece_workbench_ext1', 'piece_workbench_ext2', 'piece_workbench_ext3', 'piece_workbench_ext4'], { back: 1 });
    placeStorageRow(room, k, d >= 2 ? 2 : 1, { sign: d >= 3 });
    if (d >= 2) {
      placeStation(room, k, 'piece_stonecutter', [], { side: k.side });
      placeStation(room, k, 'piece_spinningwheel', [], { side: -k.side });
      if (d >= 3) placeStation(room, k, 'piece_artisanstation', []);
      placeLights(room, k, lights(d >= 3 ? 2 : 1));
      placeMounts(room, d >= 3 ? ['itemstand', 'itemstand', 'sign'] : ['itemstand']);
      if (d >= 3 && room_ok()) table({ seats: 2, depth: 0.5 });
    }
    return;
  }
  if (role === 'storage' || role === 'farm') {
    planPaths(room);
    const n = Math.max(1, Math.min(room.area / 10 * density('storage', decor) * (role === 'farm' ? 0.4 : 0.6), d === 1 ? 2 : 12));
    const rows = Math.max(1, Math.ceil(n / 4));
    for (let r = 0; r < rows && room.count < n; r++) placeStorageRow(room, k, Math.min(4, Math.ceil(n - room.count)), { sign: d >= 2 });
    if (d >= 2) {
      if (ok('piece_chest_barrel', biome)) placeStorageRow(room, k, d >= 3 ? 2 : 1, { chest: 'piece_chest_barrel' });
      placeLights(room, k, lights(1));
      if (role === 'farm' && d >= 3) placeAgainst(room, 'fermenter', s => (s.corner ? 1 : 0));
      if (role === 'farm' && d >= 3 && k.rug) placeRug(room, { ...k, rug: ok('rug_straw', biome) ? 'rug_straw' : k.rug }, null);
    }
    return;
  }
  if (role === 'guard') {
    planPaths(room);
    placeStorageRow(room, k, 1);
    if (d >= 2) {
      if (room.area >= 12) bed(1);
      placeAgainst(room, 'ArmorStand');
      placeMounts(room, d >= 3 ? ['itemstand', 'itemstand'] : ['itemstand']);
      placeLights(room, k, lights(1));
      if (d >= 3 && room.area >= 14) table({ seats: 2, depth: 0.5, table: 'piece_table' });
    }
    return;
  }
  if (role === 'lookout') {
    // a roofed lookout: a chest and a bench against the rail
    if (d >= 2) { placeStorageRow(room, k, 1); placeAgainst(room, k.bench || 'piece_bench01'); placeLights(room, { ...k, wallLight: null }, 1, { tallOk: true }); }
    return;
  }
  if (role === 'market') {
    planPaths(room);
    const t = table({ seats: 0, wallBias: 0, depth: 0.3 });
    placeStorageRow(room, k, 1);
    if (d >= 2) {
      placeOnTable(room, t, ['itemstandh', 'itemstandh']);
      if (ok('piece_chest_barrel', biome)) placeStorageRow(room, k, 2, { chest: 'piece_chest_barrel' });
      placeLights(room, k, 1);
      placeMounts(room, ['sign']);
    }
    return;
  }
  if (role === 'kitchen') {
    // a fire with a cauldron or a spit, a work table against a wall, barrels and a chest
    placeFire(room, c, 'fire_pit');
    onFire(room, ok('piece_cauldron', biome) && room.R() < 0.6 ? 'piece_cauldron' : 'piece_cookingstation');
    planPaths(room);
    const t = table({ seats: 1, wallBias: 2, depth: 0.6 });
    placeStorageRow(room, k, 1, { chest: ok('piece_chest_barrel', biome) ? 'piece_chest_barrel' : k.chest });
    if (d >= 2) { placeLights(room, k, lights(1)); if (t) placeOnTable(room, t, ['itemstandh', 'itemstandh']); }
    return;
  }
  // anything else: one chest and a light
  planPaths(room);
  placeStorageRow(room, k, 1);
  if (d >= 2) placeLights(room, k, 1);
}

// ---------------------------------------------------------------- room templates (D-058)
// Furniture layouts taken from rooms in the best-liked builds (lab/mine_room_templates.js, data/room-templates.json).
// A room picks a template of its kind, near its size and shape, seeded and never the same one twice in a building
// (or a floorplan set). The template is turned and mirrored so its door is on the room's door wall on the same side,
// then fitted: pieces against a wall stay against that wall, pieces a set gap off a wall keep the gap, centered pieces
// stay centered, the rest keep their share of the room. Seats, pots, things on tables and rugs keep their place by the
// piece they belong with. Each piece becomes the nearest one of the same use the biome can make, a long table only
// where its length fits. The usual tests decide each placement (nothing through anything, doors and stairs clear,
// wall pieces centered on plain wall, never over a window); a piece that fails is moved a little or left out. A room no
// template fits is furnished by the rules above.
// Tyler scores the rooms the templates come from (the review sheet's Rooms tab, lab/room_feedback.js): each template
// has a weight, 0 for a dropped one, 1 for a kept one, up to 2.5 for one to copy; rooms he has not scored carry the
// model's guess. A template's weight adds log(weight) to its fit score.
let TPL = null, TPL_IDX = null, TPL_W = null;
function setTemplates(d, w) { TPL = d; TPL_IDX = null; if (w) TPL_W = w; }
if (NODE_D) {
  try { TPL = require('../data/room-templates.json'); } catch (e) { TPL = null; }
  try { TPL_W = require('../data/room-scores.json').weights; } catch (e) { TPL_W = null; }
}
function templateById(id) {
  const d = TPL || (typeof window !== 'undefined' && window.VH_ROOMS) || { templates: [] };
  return (d.templates || []).find(t => t.id === String(id).toUpperCase()) || null;
}
function tplWeight(id) {
  const w = TPL_W || (typeof window !== 'undefined' && window.VH_ROOM_WEIGHTS) || null;
  return w && w[id] != null ? w[id] : 1;
}
function tplIndex() {
  if (TPL_IDX) return TPL_IDX;
  const d = TPL || (typeof window !== 'undefined' && window.VH_ROOMS) || { templates: [] };
  TPL_IDX = {};
  for (const t of d.templates || []) (TPL_IDX[t.kind] = TPL_IDX[t.kind] || []).push(t);
  return TPL_IDX;
}
// which template kinds serve a role, and a small cost for the second choice
const TPL_KINDS = {
  home: [['home', 0], ['sleeping', 0.5], ['living', 0.7]], sleeping: [['sleeping', 0]], guest: [['sleeping', 0]],
  hall: [['hall', 0], ['tavern', 0.6], ['living', 1.0]], tavern: [['tavern', 0], ['hall', 0.6], ['living', 0.9]], smithy: [['smithy', 0]], workshop: [['workshop', 0]], storage: [['storage', 0]],
  farm: [['storage', 0]], market: [['living', 0]], temple: [['temple', 0]], kitchen: [['kitchen', 0], ['living', 0.3]],
};
// pieces of the same use, for swapping one the biome cannot make
const TPL_GROUP = {};
for (const [g, list] of Object.entries({
  bed: KIT.bed, chest: KIT.chest, table: ['piece_table', 'piece_table_oak', 'piece_table_round'], chair: [...KIT.chair, 'piece_throne01'],
  bench: KIT.bench, rug: KIT.rug, floorLight: KIT.floorLight, wallLight: KIT.wallLight, banner: KIT.banner, carving: KIT.carving,
  fire: ['fire_pit', 'hearth'], cook: ['piece_cookingstation', 'piece_cookingstation_iron', 'piece_cauldron'],
  store2: ['piece_chest_barrel', 'dvergrprops_barrel', 'dvergrprops_crate', 'piece_chest_wood'], top: ['itemstandh', 'Candle_resin', 'treasure_stack'],
})) for (const n of list) if (!TPL_GROUP[n]) TPL_GROUP[n] = list;
// pieces that do not belong in a room of this role
const TPL_OFF = {
  home: /^forge|^piece_stonecutter|^piece_artisan/, sleeping: /^forge|^piece_stonecutter|^piece_artisan|^piece_cooking|^piece_cauldron|^piece_throne/,
  guest: /^forge|^piece_stonecutter|^piece_artisan|^piece_cooking|^piece_cauldron|^piece_throne/, hall: /^forge|^piece_stonecutter/,
  tavern: /^forge|^piece_stonecutter|^piece_artisan/, smithy: /^piece_throne|^bed$|^piece_bed/, workshop: /^piece_throne|^bed$|^piece_bed/,
  storage: /^piece_throne|^bed$|^piece_bed/, market: /^piece_throne|^bed$|^piece_bed|^forge/, kitchen: /^piece_throne|^bed$|^piece_bed|^forge/,
};

const tplA = s => [s[0], +s.slice(1)];
const TPL_SPREAD = 2.0; // how wide the draw among fitting templates is
// a template turned k quarter turns and mirrored: pieces with their anchors, the doors and the fire, in centered
// coordinates (u across, w = v - D/2 into the room)
function tplOriented(t, k, mir) {
  let W = t.W, D = t.D;
  const flipU = a => (a[0] === 'L' ? ['R', a[1]] : a[0] === 'R' ? ['L', a[1]] : a[0] === 'F' ? ['B', a[1]] : a[0] === 'B' ? ['F', a[1]] : [a[0], -a[1]]);
  const toU = a => (a[0] === 'F' ? ['L', a[1]] : a[0] === 'B' ? ['R', a[1]] : a);
  const toV = a => (a[0] === 'L' ? ['F', a[1]] : a[0] === 'R' ? ['B', a[1]] : a);
  const ps = t.p.map(q => {
    if (q[0] === 'c') return { c: true, n: q[1], par: q[2], lx: mir ? -q[3] : q[3], lz: q[4], dy: mir ? norm(-q[5]) : q[5], rise: q[6] };
    let ua = tplA(q[2]), va = tplA(q[3]);
    let yaw = q[0] === 'm' ? 0 : q[4];
    if (mir) { ua = flipU(ua); yaw = norm(-yaw); }
    for (let i = 0; i < k; i++) {
      // a quarter turn: the new u is the old v, the new v the old u turned round
      const nu = toU(va), nv = toV(flipU(ua));
      ua = nu; va = nv; yaw = norm(yaw + 90);
    }
    return { kind: q[0], n: q[1], ua, va, yaw, h: q[0] === 'm' ? q[4] : q[0] === 'h' ? q[5] : 0 };
  });
  const pt = (u, w) => {
    if (mir) u = -u;
    let Wc = t.W, Dc = t.D;
    for (let i = 0; i < k; i++) { [u, w] = [w, -u]; [Wc, Dc] = [Dc, Wc]; }
    return [u, w];
  };
  if (k % 2) [W, D] = [D, W];
  // doors on the wall that will be the room's door wall (w = -D/2), as u
  const doors = [];
  const main = pt(t.doorU, -t.D / 2);
  if (Math.abs(main[1] + D / 2) < 0.4) doors.push(main[0]);
  for (const o of t.open || []) {
    if (o[0] !== 'd') continue;
    const side = o[1];
    const u0 = side === 'F' || side === 'B' ? o[2] : side === 'L' ? -t.W / 2 : t.W / 2;
    const w0 = side === 'L' || side === 'R' ? o[2] : side === 'F' ? -t.D / 2 : t.D / 2;
    const q = pt(u0, w0);
    if (Math.abs(q[1] + D / 2) < 0.4 && !doors.some(u => Math.abs(u - q[0]) < 0.5)) doors.push(q[0]);
  }
  const fire = t.fire ? pt(t.fire[0], t.fire[1]) : null;
  return { t, k, mir, W, D, ps, doors, fire };
}

// the room in the frame of its way in; null when its walls do not run along the frame's axes
function tplFrame(room) {
  const e = room.entry;
  if (!e) return null;
  const nx0 = e.nx, nz0 = e.nz;
  if (Math.abs(Math.abs(nx0) - 1) > 0.05 && Math.abs(Math.abs(nz0) - 1) > 0.05) return null;
  const nx = Math.abs(nx0) > 0.5 ? Math.sign(nx0) : 0, nz = nx ? 0 : Math.sign(nz0);
  const ux = nz, uz = -nx;
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const c of room.cells) {
    const a = (c.x - e.x) * ux + (c.z - e.z) * uz, b = (c.x - e.x) * nx + (c.z - e.z) * nz;
    if (a < u0) u0 = a; if (a > u1) u1 = a; if (b < v0) v0 = b; if (b > v1) v1 = b;
  }
  u0 -= G / 2; u1 += G / 2; v0 -= G / 2; v1 += G / 2;
  const uc = (u0 + u1) / 2, vc = (v0 + v1) / 2;
  const fr = { e, nx, nz, ux, uz, W: u1 - u0, D: v1 - v0, uc, vc, yaw: yawOfDir(nx, nz) };
  fr.world = (u, w) => { const U = u + uc, V = w + vc; return [e.x + U * ux + V * nx, e.z + U * uz + V * nz]; };
  fr.local = (x, z) => [(x - e.x) * ux + (z - e.z) * uz - uc, (x - e.x) * nx + (z - e.z) * nz - vc];
  fr.doorU = -uc;
  fr.fill = room.area / (fr.W * fr.D);
  return fr;
}

// position along one axis from an anchor, for a piece reaching e either side of its middle
function tplAxis(a, e, len) {
  const lo = -len / 2, hi = len / 2;
  if (a[0] === 'L' || a[0] === 'F') return lo + a[1] + e;
  if (a[0] === 'R' || a[0] === 'B') return hi - a[1] - e;
  if (a[0] === 'C') return Math.max(-0.35, Math.min(0.35, a[1]));
  return Math.max(lo + e, Math.min(hi - e, a[1] * len));
}
const tplExt = (name, yaw) => { const [w, , d] = size(name), a = yaw * PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a)); return [c * w / 2 + s * d / 2, s * w / 2 + c * d / 2]; };

// the piece this room gets for a template piece: the same if the biome makes it, else the nearest of the same use
function tplSwap(name, room, c, along) {
  const biome = c.biome;
  const f = F[name] || {};
  // the biome as this table and the generator's own (pieces.js, which takes out what the biome cannot make) both read it
  const ok = (n2, b) => ok0(n2, b) && P.BIOME_ORDER.indexOf(P.needs(n2)) <= Math.max(0, P.BIOME_ORDER.indexOf(b));
  let n = name;
  if (n === 'piece_table_oak' && along != null && along < size(n)[0] + 2.4) n = 'piece_table';
  if (ok(n, biome)) return n;
  const group = TPL_GROUP[name];
  if (!group) return null;
  const [w0, , d0] = size(name);
  const cands = group.filter(g => g !== name && ok(g, biome) && !(g === 'piece_table_oak' && along != null && along < 6.6));
  if (!cands.length) return null;
  // the kit's choice when it is of this use; else the largest that is no bigger, else the smallest
  const kitHit = Object.values(c.kit || {}).find(v => typeof v === 'string' && cands.includes(v) && size(v)[0] <= w0 + 0.3 && size(v)[2] <= d0 + 0.3);
  if (kitHit) return kitHit;
  const fitsIn = cands.filter(g => size(g)[0] <= w0 + 0.2 && size(g)[2] <= d0 + 0.2).sort((a, b) => size(b)[0] * size(b)[2] - size(a)[0] * size(a)[2]);
  if (fitsIn.length) return fitsIn[0];
  void f;
  return cands.sort((a, b) => size(a)[0] * size(a)[2] - size(b)[0] * size(b)[2])[0];
}

// choose the templates to try for a room, best first
function tplChoose(room, role, c, fr, needFire) {
  const idx = tplIndex(), out = [];
  const forced = c.forceTemplate ? templateById(c.forceTemplate) : null;
  const kinds = forced ? [[forced.kind, 0]] : (role === 'home' && c.levels > 1 && !room.upper) ? [['living', 0], ['home', 0.3]] : TPL_KINDS[role];
  if (!kinds) return out;
  const used = c.usedTemplates;
  const dens = density(LEARN_KIND[role] || 'home', 'd2');
  const fireAt = needFire && c.fireAt && room.inside(c.fireAt.x, c.fireAt.z) ? fr.local(c.fireAt.x, c.fireAt.z) : null;
  const taste = (c.kit && c.kit.taste) || {};
  for (const [kind, cost] of kinds) for (const t of idx[kind] || []) {
    if (forced && t.id !== forced.id) continue;
    if (!forced && used && used.has(t.id)) continue;
    const tw = forced ? 1 : tplWeight(t.id);
    if (tw <= 0) continue;
    if (t.fire && !needFire) continue;
    if (!!t.stair !== !!room.entry.stair && (t.stair || room.entry.stair) && Math.min(t.W, t.D) < 3) continue;
    for (let k = 0; k < 4; k++) {
      const Wt = k % 2 ? t.D : t.W, Dt = k % 2 ? t.W : t.D;
      const rw = fr.W / Wt, rd = fr.D / Dt;
      if (rw < 0.6 || rw > 1.7 || rd < 0.6 || rd > 1.7) continue;
      for (const mir of [false, true]) {
        const o = tplOriented(t, k, mir);
        if (!o.doors.length) continue;
        const du = Math.min(...o.doors.map(u => Math.abs(u * rw - fr.doorU)));
        if (du > Math.max(1.2, fr.W * 0.2)) continue;
        let s = -cost - 2.5 * (Math.abs(Math.log(rw)) + Math.abs(Math.log(rd))) - 3 * Math.abs(fr.fill - t.fill) - du * 0.4 - (k ? 0.5 : 0);
        if (needFire) s -= t.fire ? (fireAt && o.fire ? Math.hypot(o.fire[0] * rw - fireAt[0], o.fire[1] * rd - fireAt[1]) * 0.3 : 0) : 1.2;
        if (c.decor === 'd3') s += Math.max(-0.6, Math.min(0.6, (t.dens - dens) / dens * 0.6));
        else if (c.decor === 'd2') s -= Math.min(0.8, Math.abs(t.dens - dens) / dens * 0.4);
        if (taste.noTable && t.p.some(q => q[1] === 'piece_table' || q[1] === 'piece_table_oak')) s -= 1.5;
        if (!!t.stair === !!room.entry.stair) s += 0.3;
        // the score, the room score's weight, and a seeded draw (a Gumbel draw, so the choice among close fits is a
        // weighted lottery and two seeds of one request pick different rooms)
        const g = -Math.log(-Math.log(Math.max(1e-6, Math.min(1 - 1e-6, room.R()))));
        out.push({ o, s: s + Math.log(tw) + g * TPL_SPREAD, rw, rd });
      }
    }
  }
  out.sort((a, b) => b.s - a.s);
  // one orientation per template
  const seen = new Set(), list = [];
  for (const x of out) { if (seen.has(x.o.t.id)) continue; seen.add(x.o.t.id); list.push(x); if (list.length >= 4) break; }
  return list;
}

// essentials only, for d1: beds, a chest, the fire and its pot, stations
function tplKeep(role, decor) {
  if (decor !== 'd1') return () => true;
  let chests = 0, tables = 0;
  return n => {
    const f = F[n] || {};
    if (f.cat === 'bed' || f.cat === 'fire' || f.at === 'fire') return true;
    if (f.cat === 'craft' && f.at !== 'fire' && n !== 'fermenter') return true;
    if (f.cat === 'storage' && /chest/.test(n)) return chests++ < 1;
    if (f.cat === 'table' && (role === 'tavern' || role === 'hall')) return tables++ < 2;
    if (f.cat === 'seat' && (role === 'tavern' || role === 'hall')) return true;
    return false;
  };
}

function tplUndo(room, snap, counts) {
  room.out.length = snap.out; room.placed.length = snap.placed; room.mates.length = snap.mates;
  room.mounts.length = snap.mounts; room.zones.length = snap.zones; room.count = snap.count; room.fire = snap.fire;
  counts.bed = snap.bed; counts.table = snap.table;
}

// fit one oriented template to the room; true when it is kept
function tplFit(room, role, c, fr, ch, needFire) {
  const { o, rw, rd } = ch;
  const counts = c.counts;
  const d = c.decor === 'd1' ? 1 : c.decor === 'd2' ? 2 : 3;
  const bedCap = (BED_CAP[c.use] ? BED_CAP[c.use][d - 1] : CAPS[c.decor].bed);
  const keep = tplKeep(role, c.decor);
  const off = TPL_OFF[role];
  const taste = (c.kit && c.kit.taste) || {};
  const recs = new Array(o.ps.length).fill(null);
  let want = 0, got = 0, beds = 0, tables = 0, storage = 0, stations = 0;
  const has = new Set();
  // the fire first, where the building's smoke hole is
  if (needFire) {
    const tf = o.ps.find(q => !q.c && (F[q.n] || {}).cat === 'fire');
    const fn = tf && tplSwap(tf.n, room, c) || 'fire_pit';
    const rec = placeFire(room, c, fn) || (fn !== 'fire_pit' ? placeFire(room, c, 'fire_pit') : null);
    if (!rec) return false;
    if (tf) recs[o.ps.indexOf(tf)] = rec;
    if (!tf || !o.ps.some(q => q.c && q.par === o.ps.indexOf(tf) && (F[q.n] || {}).at === 'fire')) onFire(room, d >= 2 && ok('piece_cauldron', c.biome) && room.R() < 0.4 ? 'piece_cauldron' : 'piece_cookingstation');
    has.add('fire');
  }
  const along = (yaw) => (Math.abs(Math.sin(yaw * PI / 180)) > 0.7 ? fr.D : fr.W);
  o.ps.forEach((q, i) => {
    if (recs[i]) return;
    if (!keep(q.n) || (off && off.test(q.n))) return;
    const f0 = F[q.n] || {};
    if (f0.cat === 'fire') return; // only the one fire, placed above
    if (taste.noTable && f0.cat === 'table') return;
    if (q.c) {
      const par = recs[q.par];
      if (!par) return;
      want++;
      const n = tplSwap(q.n, room, c);
      if (!n) return;
      const f = F[n] || {};
      const pq = o.ps[q.par];
      // seats and the like keep their side of a table that changed size
      const [pw0, , pd0] = size(pq.n), [pw, , pd] = size(par.name);
      let lx = q.lx, lz = q.lz;
      if (pw !== pw0) lx = Math.abs(lx) <= pw0 / 2 + 0.3 ? lx * pw / pw0 : Math.sign(lx) * (pw / 2 + Math.abs(lx) - pw0 / 2);
      if (pd !== pd0) lz = Math.abs(lz) <= pd0 / 2 + 0.3 ? lz * pd / pd0 : Math.sign(lz) * (pd / 2 + Math.abs(lz) - pd0 / 2);
      const a = par.yaw * PI / 180, bx = Math.cos(a), bz = -Math.sin(a), ax = Math.sin(a), az = Math.cos(a);
      const yaw = norm(par.yaw + q.dy);
      const at = (dx, dz) => [par.x + bx * dx + ax * dz, par.z + bz * dx + az * dz];
      let rec = null;
      if (f.at === 'top') {
        if ((F[par.name] || {}).cat !== 'table') return;
        // well inside the top, by the smaller of the two sizes known for the table (the generator's own tidying reads
        // pieces.js sizes)
        const ps0 = P.piece(par.name).size, tw0 = Math.min(pw, ps0[0]), td0 = Math.min(pd, ps0[2]);
        const [x, z] = at(Math.max(-tw0 / 2 + 0.2, Math.min(tw0 / 2 - 0.2, lx)), Math.max(-td0 / 2 + 0.15, Math.min(td0 / 2 - 0.15, lz)));
        // things on a table keep apart; a smaller table holds fewer
        const [tw2, , td2] = size(n);
        if (room.placed.some(r => r.onTable === par && overlap(r.b, obox(x, z, tw2, td2, yaw), 0.02))) return;
        rec = room.add(n, x, par.y0 + ((F[par.name] || {}).top || 0.75), z, yaw, { onTable: par });
      } else if (f.at === 'fire') {
        if (!par.fire) return;
        if (par.name === 'fire_pit') { if (!room.placed.some(r => r.onFire)) rec = onFire(room, n); }
        else { const [x, z] = at(Math.max(-pw / 2 + 0.3, Math.min(pw / 2 - 0.3, lx)), Math.max(-pd / 2 + 0.2, Math.min(pd / 2 - 0.2, lz))); rec = room.add(n, x, par.y0 + (f.lift || 0.25), z, yaw, { onFire: true }); }
      } else {
        // a seat tucked under a table in the build comes out until it is clear
        const outDir = f.cat === 'seat' ? [Math.sign(lx) * (Math.abs(lx) > pw / 2 ? 1 : 0), Math.sign(lz) * (Math.abs(lz) > pd / 2 - 0.2 || Math.abs(lx) <= pw / 2 ? 1 : 0)] : [0, 0];
        const ign = { ignore: ['fire', 'work'], tight: true };
        for (const s of [0, 0.15, 0.3, 0.45, 0.6]) {
          const [x, z] = at(lx + outDir[0] * s, lz + outDir[1] * s);
          rec = room.put(n, x, z, yaw, ign);
          if (rec) break;
        }
        if (!rec && f.cat !== 'seat') for (const [ex, ez] of [[0.25, 0], [-0.25, 0], [0, 0.25], [0, -0.25]]) { const [x, z] = at(lx + ex, lz + ez); rec = room.put(n, x, z, yaw, ign); if (rec) break; }
      }
      if (rec) { recs[i] = rec; got++; if (f.cat === 'seat') has.add('seat'); }
      return;
    }
    want++;
    if (q.kind === 'm') {
      const n = tplSwap(q.n, room, c);
      if (!n) return;
      // the wall it hangs on, and the place along it
      const wallU = q.ua[0] === 'L' || q.ua[0] === 'R' ? q.ua[0] : null, wallV = !wallU ? q.va[0] : null;
      const w = size(n)[0] / 2;
      const tu = wallU ? (wallU === 'L' ? -fr.W / 2 : fr.W / 2) : tplAxis(q.ua, w, fr.W);
      const tw = wallV ? (wallV === 'F' ? -fr.D / 2 : fr.D / 2) : tplAxis(q.va, w, fr.D);
      const [px, pz] = fr.world(tu, tw);
      const sideN = wallU === 'L' ? [fr.ux, fr.uz] : wallU === 'R' ? [-fr.ux, -fr.uz] : wallV === 'F' ? [fr.nx, fr.nz] : [-fr.nx, -fr.nz];
      const faces = room.faces.filter(fc => !fc.edge && fc.nx * sideN[0] + fc.nz * sideN[1] > 0.7);
      const spots = [];
      for (const face of faces) for (const s of mountSpots(room, n, { face, pairs: true, y: Math.max(1.2, Math.min(2.6, q.h || 1.6)) })) spots.push(s);
      spots.sort((a, b) => (Math.hypot(a.x - px, a.z - pz) - (a.centered === 2 ? 0.4 : 0)) - (Math.hypot(b.x - px, b.z - pz) - (b.centered === 2 ? 0.4 : 0)));
      const reach = Math.max(1.5, 0.3 * (wallU ? fr.D : fr.W));
      for (const s of spots) {
        if (Math.hypot(s.x - px, s.z - pz) > reach) break;
        const rec = putMount(room, n, s);
        if (rec) { recs[i] = rec; got++; break; }
      }
      return;
    }
    if (q.kind === 'h') {
      const n = tplSwap(q.n, room, c);
      if (!n) return;
      const [x, z] = fr.world(tplAxis(q.ua, 0.4, fr.W), tplAxis(q.va, 0.4, fr.D));
      if (!room.inside(x, z)) return;
      const ceil = room.ceilAt(x, z);
      if (ceil - room.stand < 3.4 || (room.fire && Math.hypot(x - room.fire.x, z - room.fire.z) < 1.5)) return;
      recs[i] = room.add(n, x, ceil - (F[n].under || 1.6), z, 0, { mount: true, y0: ceil - 1.6 });
      got++;
      return;
    }
    // a piece standing on the floor
    const f = F[q.n] || {};
    let n = tplSwap(q.n, room, c, along(q.yaw + 0));
    if (!n) return;
    if (F[n].cat === 'bed') { if (counts.bed >= bedCap) return; }
    if (F[n].cat === 'table' && counts.table >= CAPS[c.decor].table + (role === 'tavern' ? 4 : 0)) return;
    // a round piece swapped for a long one stands square to the walls
    const fyaw = (F[q.n] || {}).round && !(F[n] || {}).round ? norm(Math.round(q.yaw / 90) * 90) : q.yaw;
    const yaw = norm(fyaw + fr.yaw);
    const [eu, ev] = tplExt(n, fyaw);
    const tu = tplAxis(q.ua, eu, fr.W), tw = tplAxis(q.va, ev, fr.D);
    const [x0, z0] = fr.world(tu, tw);
    // seats may sit in the ring round the fire (a seating ring); everything else keeps out of it
    const ign = (F[n] || {}).cat === 'seat' ? { ignore: ['fire'] } : {};
    let rec = null;
    // against a wall: the wall spots of that wall, nearest first (they know windows, doors and corners)
    const wallKey = (q.ua[0] === 'L' || q.ua[0] === 'R') && q.ua[1] < 0.35 ? q.ua[0] : (q.va[0] === 'F' || q.va[0] === 'B') && q.va[1] < 0.35 ? q.va[0] : null;
    if (wallKey && f.at !== 'rug') {
      const sideN = wallKey === 'L' ? [fr.ux, fr.uz] : wallKey === 'R' ? [-fr.ux, -fr.uz] : wallKey === 'F' ? [fr.nx, fr.nz] : [-fr.nx, -fr.nz];
      const rel = Math.round(norm(yaw - yawOfDir(sideN[0], sideN[1])) / 90) % 4 * 90;
      const spots = wallSpots(room, n, { rel }).filter(s => s.face.nx * sideN[0] + s.face.nz * sideN[1] > 0.7 && Math.hypot(s.x - x0, s.z - z0) < 1.6);
      spots.sort((a, b) => Math.hypot(a.x - x0, a.z - z0) - Math.hypot(b.x - x0, b.z - z0));
      for (const s of spots.slice(0, 10)) { if (!fireAabbClear(room, n, s.x, s.z, s.yaw)) continue; rec = room.put(n, s.x, s.z, s.yaw, ign); if (rec) { rec.spot = s; break; } }
    }
    if (!rec) {
      const steps = [[0, 0], [0.25, 0], [-0.25, 0], [0, 0.25], [0, -0.25], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5], [0.5, 0.5], [-0.5, 0.5], [0.5, -0.5], [-0.5, -0.5], [0.75, 0], [-0.75, 0], [0, 0.75], [0, -0.75]];
      for (const [du, dw] of steps) {
        // a piece against a wall slides only along it
        if (wallKey && ((wallKey === 'L' || wallKey === 'R') ? du : dw)) continue;
        const [x, z] = fr.world(tu + du, tw + dw);
        if (f.at !== 'rug' && !fireAabbClear(room, n, x, z, yaw)) continue;
        rec = room.put(n, x, z, yaw, f.at === 'rug' ? { clearOf: ['bed', 'storage', 'craft'] } : ign);
        if (rec) break;
      }
    }
    if (!rec) return;
    recs[i] = rec; got++;
    const cat = F[n].cat;
    if (cat === 'bed') { counts.bed++; beds++; }
    if (cat === 'table' && n !== 'piece_cartographytable') { counts.table++; tables++; }
    if (cat === 'storage') storage++;
    if (cat === 'craft' && f.at !== 'fire') stations++;
    has.add(n);
  });
  // what the room must have
  const fresh = room.placed.filter(r => !r.rug).length;
  const need = {
    smithy: () => has.has('forge'), workshop: () => has.has('piece_workbench') || stations >= 2,
    sleeping: () => beds >= 1 || counts.bed >= bedCap, guest: () => beds >= 1 || counts.bed >= bedCap,
    home: () => (c.levels > 1 && !room.upper && d >= 2) || beds >= 1 || counts.bed >= bedCap || (beds += placeBeds(room, c.kit, 1, d, 0.4).length, counts.bed += beds, beds >= 1), tavern: () => tables >= 1, hall: () => tables >= 1 || has.has('piece_throne01'),
    storage: () => storage >= 2, farm: () => storage >= 1, market: () => tables >= 1 || storage >= 1, temple: () => tables >= 1,
  }[role];
  if (typeof process !== 'undefined' && process.env && process.env.TPLDBG) console.error('tpl', role, ch.o.t.id, ch.o.t.kind, `k${ch.o.k}${ch.o.mir ? 'm' : ''}`, 'want', want, 'got', got, 'need', need ? need() : '-', 'count', room.count, 'min', (0.5 * room.area / 10 * density(LEARN_KIND[role] || 'home', 'd1')).toFixed(1));
  if (c.forceTemplate) return got > 0;
  if (want === 0 || got < Math.max(2, Math.ceil(want * 0.6)) || (need && !need()) || fresh < 2) return false;
  // and enough for the room's size: at d2 and d3 at least half the corpus rate for the kind
  const low = density(LEARN_KIND[role] || 'home', 'd1') * (role === 'storage' || role === 'farm' ? 0.5 : 1);
  if (d >= 2 && room.count < 0.5 * room.area / 10 * low) return false;
  void rw; void rd;
  return true;
}

// The generator takes out whatever stands within 0.4 m of the fire, measured on boxes square to the world with the
// sizes in pieces.js (lib/generate.js settle). A piece turned at an angle near the fire is kept that far off, seats
// excepted (they sit round it).
function fireAabbClear(room, n, x, z, yaw) {
  const fr = room.fire;
  if (!fr || (F[n] || {}).cat === 'seat') return true;
  const box = (name, px, pz, y) => { const [w, , d] = P.piece(name).size, a = y * PI / 180, c = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a)); return [px - (w * c + d * sn) / 2, px + (w * c + d * sn) / 2, pz - (w * sn + d * c) / 2, pz + (w * sn + d * c) / 2]; };
  const a = box(n, x, z, yaw), b = box(fr.name, fr.x, fr.z, fr.yaw || 0), pad = 0.45;
  return !(a[0] < b[1] + pad && a[1] > b[0] - pad && a[2] < b[3] + pad && a[3] > b[2] - pad);
}

// furnish a room from a template; false when none fits (the room is then left as it was)
function tplFurnish(room, role, c) {
  if (c.templates === false || !room.entry) return false;
  const fr = tplFrame(room);
  if (!fr || fr.W < 2 || fr.D < 2) return false;
  const forced = c.forceTemplate ? templateById(c.forceTemplate) : null;
  const needFire = forced ? !!forced.fire : (['home', 'hall', 'tavern'].includes(role) && !room.upper) || role === 'kitchen';
  const list = tplChoose(room, role, c, fr, needFire);
  if (typeof process !== 'undefined' && process.env && process.env.TPLDBG) console.error('choose', role, fr.W, fr.D, 'cands', list.length);
  for (const ch of list.slice(0, 3)) {
    const snap = { out: room.out.length, placed: room.placed.length, mates: room.mates.length, mounts: room.mounts.length, zones: room.zones.length, count: room.count, fire: room.fire, bed: c.counts.bed, table: c.counts.table };
    if (tplFit(room, role, c, fr, ch, needFire)) {
      if (c.usedTemplates) c.usedTemplates.add(ch.o.t.id);
      room.template = ch.o.t.id;
      return true;
    }
    tplUndo(room, snap, c.counts);
  }
  return false;
}

// Outside: woodpiles and stone or coal heaps against a back or side wall, clear of doors (Tyler, T-05: wood piles go
// outside). Only where the floor is on the ground.
function outside(b, c) {
  const { use, type, decor, biome, kit: k, R } = c;
  const wants = [];
  if (['home', 'hall', 'workshop', 'farm'].includes(use)) wants.push(k.stack || 'wood_stack');
  if (decor === 'd3' && ['home', 'hall', 'workshop'].includes(use)) wants.push(ok('wood_fine_stack', biome) ? 'wood_fine_stack' : 'wood_stack');
  if (use === 'smithy') { wants.push(ok('coal_pile', biome) ? 'coal_pile' : 'stone_pile'); if (decor === 'd3') wants.push(k.stack || 'wood_stack'); }
  if (use === 'workshop' && type === 'sawmill' && decor === 'd3') wants.push(ok('wood_core_stack', biome) ? 'wood_core_stack' : 'wood_stack');
  if (!wants.length) return;
  const structs = b.pieces.filter(p => !p.decor).map(structBox);
  const ys = structs.filter(s => s.info.structural).map(s => s.y0).sort((a, c2) => a - c2);
  const low = ys.length ? ys[Math.floor(ys.length * 0.02)] : 0;
  // the ground: where the lowest floors lie (a stone floor's top, a wooden floor's pivot)
  const gfl = structs.filter(s => s.role === 'floor' && s.y0 < low + 0.8).map(s => s.p.name === 'stone_floor_2x2' || s.p.name === 'stone_floor' ? s.p.y + 0.5 : s.p.y);
  const ground = gfl.length ? Math.min(...gfl) : low;
  const walls = structs.filter(s => s.role === 'wall' && s.y0 < ground + 0.6 && s.y1 > ground + 1.2);
  const doors = structs.filter(s => s.role === 'door' || s.role === 'stair');
  const placed = [];
  // the middle of the floor plan, to tell outside from inside
  const floors = structs.filter(s => s.role === 'floor');
  if (!floors.length) return;
  const onFloor = (x, z) => floors.some(f => ptDist(f.b, x, z) < 0.01 && Math.abs(f.y1 - ground) < 1.5);
  for (const name of wants) {
    if (!ok(name, biome)) continue;
    const [w, h, d] = size(name);
    const cands = [];
    for (const s of walls) {
      const yaw = pyaw(s.p), ar = yaw * PI / 180, nx = Math.sin(ar), nz = Math.cos(ar);
      for (const sg of [1, -1]) {
        const dist = s.b.hd + 0.1 + d / 2;
        const x = s.p.x + nx * sg * dist, z = s.p.z + nz * sg * dist;
        // outside: no floor here or a little further out, and the other side of the wall is floor
        if (onFloor(x, z) || onFloor(x + nx * sg * 0.8, z + nz * sg * 0.8)) continue;
        if (!onFloor(s.p.x - nx * sg * 0.6, s.p.z - nz * sg * 0.6)) continue;
        // and open to the outside: no wall across the way out for 6 m
        let shut = false;
        for (let t = 1; t <= 6 && !shut; t += 0.5) { const qx = x + nx * sg * t, qz = z + nz * sg * t; if (walls.some(w2 => w2 !== s && ptDist(w2.b, qx, qz) < 0.05)) shut = true; }
        if (shut) continue;
        cands.push({ x, z, yaw: norm(yaw + (sg < 0 ? 180 : 0)), nx: nx * sg, nz: nz * sg });
      }
    }
    const ranked = cands.map(cc => {
      let v = R() * 0.5;
      const dd = Math.min(...doors.map(q => Math.hypot(q.p.x - cc.x, q.p.z - cc.z)), 99);
      if (dd < 3) v -= 10;
      v += cc.nz > 0.7 ? 1.5 : Math.abs(cc.nx) > 0.7 ? 1 : 0; // back first, then the sides
      return [cc, v];
    }).sort((a2, b2) => b2[1] - a2[1]);
    const over = structs.filter(s => OVERHEAD.has(s.role)), wallish = structs.filter(s => WALLISH.has(s.role));
    for (const [cc] of ranked) {
      if (enclosed(cc.x, cc.z, ground, over, wallish)) continue;
      const bb = obox(cc.x, cc.z, w, d, cc.yaw);
      if (structs.some(s => s.role !== 'wall' && s.role !== 'nature' && s.y0 < ground + h && s.y1 > ground + 0.05 && overlap(s.b, bb, 0.05))) continue;
      if (walls.some(s => overlap(s.b, bb, -0.03))) continue;
      if (placed.some(q => overlap(q, bb, 0.3))) continue;
      placed.push(bb);
      b.pieces.push({ name, x: +cc.x.toFixed(3), y: +ground.toFixed(3), z: +cc.z.toFixed(3), q: quatY(cc.yaw), yaw: cc.yaw, decor: true, outside: true });
      break;
    }
  }
}

// ---------------------------------------------------------------- checks on the furnishing
// Overlaps between furniture, things in a doorway, wall pieces over a window or door, things floating, things on the
// way to stairs and ladders, woodpiles indoors, floor torches sunk in the floor, floors left bare at d2 and d3.
function audit(design, decor) {
  const pieces = design.pieces;
  const res = { overlap: [], door: [], mountOnOpening: [], floating: [], stairs: [], indoorPile: [], torchHeight: [], bareFloors: [] };
  const marked = pieces.some(p => p.decor);
  const isDeco = p => (marked ? !!p.decor : !!F[p.name] && !P.piece(p.name).structural);
  const deco = pieces.filter(isDeco);
  const struct = pieces.filter(p => !isDeco(p)).map(structBox);
  const boxOf = p => { const [w, h, d] = size(p.name); const f = F[p.name] || {}; const y0 = p.y - (f.base || 0) - (f.at === 'hang' ? 0 : 0); return { p, f, b: obox(p.x, p.z, w, d, pyaw(p)), y0: f.at === 'hang' ? p.y : y0, y1: f.at === 'hang' ? p.y + h : y0 + h }; };
  const items = deco.map(boxOf);
  const floorsAt = struct.filter(s => s.role === 'floor');
  const tops = struct.filter(s => s.role === 'floor' || s.role === 'stair');
  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    const fa = a.f.at;
    if (fa === 'mount' || fa === 'hang' || fa === 'top' || fa === 'fire' || fa === 'rug') continue;
    for (let j = i + 1; j < items.length; j++) {
      const c = items[j];
      const fc = c.f.at;
      if (fc === 'mount' || fc === 'hang' || fc === 'top' || fc === 'fire' || fc === 'rug') continue;
      if (a.y0 > c.y1 - 0.05 || c.y0 > a.y1 - 0.05) continue;
      if (overlap(a.b, c.b, -0.06)) res.overlap.push(`${a.p.name} / ${c.p.name} at ${a.p.x.toFixed(1)},${a.p.z.toFixed(1)}`);
    }
  }
  // doors: nothing but rugs in a box 1.2 m deep and the door's width in front of each side
  for (const s of struct.filter(s2 => s2.role === 'door')) {
    const yaw = pyaw(s.p), ar = yaw * PI / 180, nx = Math.sin(ar), nz = Math.cos(ar);
    for (const sg of [1, -1]) {
      const zb = obox(s.p.x + nx * sg * (s.b.hd + 0.6), s.p.z + nz * sg * (s.b.hd + 0.6), s.b.hw * 2, 1.2, yaw);
      for (const it of items) if (it.f.at !== 'rug' && it.f.at !== 'mount' && it.f.at !== 'hang' && it.y0 < s.y0 + 1.8 && it.y1 > s.y0 + 0.05 && overlap(zb, it.b, -0.02)) res.door.push(`${it.p.name} at ${it.p.x.toFixed(1)},${it.p.z.toFixed(1)}`);
    }
  }
  // wall pieces: the wall behind must be plain wall, not a window or a door, across the piece's width
  const wallish = struct.filter(s => WALLISH.has(s.role));
  for (const it of items) {
    if (it.f.at !== 'mount') continue;
    const yaw = pyaw(it.p) - (it.f.rel || 0), ar = yaw * PI / 180, nx = Math.sin(ar), nz = Math.cos(ar), ux = Math.cos(ar), uz = -Math.sin(ar);
    const w = size(it.p.name)[0];
    let bad = false;
    const y = it.f.under != null ? it.p.y - size(it.p.name)[1] / 2 : it.p.y + size(it.p.name)[1] / 2;
    for (const t of [-w / 2 + 0.05, 0, w / 2 - 0.05]) {
      // walk back from the piece to the first wall piece behind it at its height
      let here = [];
      for (let back = 0; back <= 1.0 && !here.length; back += 0.05) {
        const px = it.p.x + ux * t - nx * back, pz = it.p.z + uz * t - nz * back;
        here = wallish.filter(s => ptDist(s.b, px, pz) < 0.01 && s.y0 <= y + 0.01 && s.y1 >= y - 0.01);
      }
      if (!here.length || here.some(s => s.role !== 'wall' || isGlass(s.p.name))) bad = true;
    }
    if (bad) res.mountOnOpening.push(`${it.p.name} at ${it.p.x.toFixed(1)},${it.p.y.toFixed(1)},${it.p.z.toFixed(1)}`);
  }
  // floating: floor pieces need a floor (or the ground) under them; table pieces a table; fire pieces a fire
  const ys = struct.filter(s => s.info.structural).map(s => s.y0).sort((a, b) => a - b);
  // generated designs say where the ground is (posts and stone floors reach below it)
  const ground = design.ground != null ? design.ground : ys.length ? ys[Math.floor(ys.length * 0.02)] : 0;
  for (const it of items) {
    const fa = it.f.at || 'floor';
    if (fa === 'mount' || fa === 'hang') continue;
    if (fa === 'top' && wallish.some(s => ptDist(s.b, it.p.x, it.p.z) < 0.4 && s.y0 < it.p.y && s.y1 > it.p.y)) continue; // hung on a wall as a shelf
    if (fa === 'top') { if (!items.some(o => (o.f.cat === 'table') && ptDist(o.b, it.p.x, it.p.z) < 0.05 && Math.abs(o.p.y + (o.f.top || 0.75) - it.p.y) < 0.15)) res.floating.push(`${it.p.name} at ${it.p.x.toFixed(1)},${it.p.y.toFixed(1)},${it.p.z.toFixed(1)}`); continue; }
    if (fa === 'fire') { if (!items.some(o => o.f.cat === 'fire' && ptDist(o.b, it.p.x, it.p.z) < 0.1)) res.floating.push(`${it.p.name} at ${it.p.x.toFixed(1)},${it.p.z.toFixed(1)}`); continue; }
    const yb = it.y0;
    // the floor under it: the highest one whose top is no higher than the piece's pivot
    let under = -Infinity;
    for (const s of floorsAt) { const st = s.p.y + standOf(s.p.name); if (st <= it.p.y + 0.05 && st > under && ptDist(s.b, it.p.x, it.p.z) < 0.45) under = st; }
    if (it.f.base && isFinite(under) && under - yb > 0.3) { res.torchHeight.push(it.p.name); continue; }
    const onFloor = Math.abs(yb - ground) < 0.15 || (isFinite(under) && Math.abs(under - yb) < 0.12);
    if (!onFloor) res.floating.push(`${it.p.name} at ${it.p.x.toFixed(1)},${it.p.y.toFixed(2)},${it.p.z.toFixed(1)}`);
  }
  // stairs and ladders: their own footprint and 0.6 m round it at their foot and top
  for (const s of struct.filter(s2 => s2.role === 'stair')) {
    const zb = { ...s.b, hw: s.b.hw + 0.6, hd: s.b.hd + 0.6 };
    for (const it of items) if (it.f.at !== 'rug' && it.f.at !== 'mount' && it.f.at !== 'hang' && it.y0 < s.y1 + 0.3 && it.y1 > s.y0 && overlap(zb, it.b, -0.02)) res.stairs.push(`${it.p.name} at ${it.p.x.toFixed(1)},${it.p.y.toFixed(1)},${it.p.z.toFixed(1)}`);
  }
  // woodpiles and heaps under a roof inside walls
  const over = struct.filter(s => OVERHEAD.has(s.role));
  for (const it of items) {
    if (!/stack|pile/.test(it.p.name)) continue;
    if (enclosed(it.p.x, it.p.z, it.p.y, over, wallish)) res.indoorPile.push(it.p.name);
  }
  // every floor furnished at d2 and d3: each roofed room of 8 m2 or more holds at least two pieces
  if (decor && decor !== 'd1') {
    const bare = pieces.filter(p => !isDeco(p));
    const hint = design.rooms && design.rooms.length;
    const ysL = hint ? [...new Set(design.rooms.map(r => Math.round(r.y * 4) / 4))].sort((a, b) => a - b) : floorLevels(bare);
    ysL.forEach((y0, li) => {
      const rects = hint ? design.rooms.filter(r => Math.round(r.y * 4) / 4 === y0) : null;
      const y = hint ? standGuess(bare, rects, y0) : y0;
      for (const m of readLevel(bare, y, rects) || []) {
        if (m.area < 8 || m.covered < 0.5) continue;
        const n = items.filter(it => it.f.at !== 'rug' && it.p.y > m.stand - 0.3 && it.p.y < m.stand + 3 && m.inside(it.p.x, it.p.z)).length;
        if (n < 2) res.bareFloors.push(`level ${li} ${m.area} m2 holds ${n}`);
      }
    });
  }
  return res;
}

// ---------------------------------------------------------------- existing blueprints
const ESSENTIAL = /^(bed|piece_bed02|ashwood_bed|piece_chest_wood|piece_chest|hearth|fire_pit|forge|piece_workbench|piece_cookingstation|smelter|portal_wood)$/;

// Strip a design to d1: keep structure and the essentials (beds, two chests, fires and main stations).
function strip(pieces) {
  const keep = [], counts = {};
  for (const p of pieces) {
    const info = P.piece(p.name);
    if (info.structural || info.role === 'nature' || info.role === 'misc') { keep.push(p); continue; }
    if (ESSENTIAL.test(p.name)) {
      const k = /bed/.test(p.name) ? 'bed' : /chest/.test(p.name) ? 'chest' : p.name;
      counts[k] = (counts[k] || 0) + 1;
      if (k === 'chest' && counts[k] > 2) continue;
      keep.push(p);
    }
  }
  return keep;
}

// Rooms in any blueprint, as the decorator sees them (for the request page and tests).
function findRooms(pieces) {
  const out = [];
  for (const y of floorLevels(pieces)) for (const m of readLevel(pieces, y, null) || []) if (m.area >= 4) out.push({ y, area: m.area, x0: m.x0, x1: m.x1, z0: m.z0, z1: m.z1, faces: m.faces.length, doors: m.doors.length, stairs: m.stairs.length, covered: m.covered });
  return out;
}

// Decorate an existing design to d2 or d3. Existing furniture stays and is worked round.
function decorateExisting(pieces, { use = 'home', decor = 'd2', biome = 'Meadows', seed = 1, culture } = {}) {
  const b = { pieces: pieces.map(p => ({ ...p })), rooms: [] };
  decorate(b, { use, type: use, decor, biome, culture, R: rngFrom(seed) });
  return b.pieces;
}

const api = { decorate, strip, findRooms, decorateExisting, setRules, setInterior, setTemplates, templateById, audit, ITEM_BIOME, FURNITURE: F, readLevel,
  _int: { floorLevels, stretch, size, ok, obox, overlap, ptDist, yawOfDir, pyaw, standOf, norm, WALLISH } };
if (NODE_D) module.exports = api; else window.VHDecorate = api;

})();
// ---- details.js
(function () {
// Villheim building details: the trim, framing and small additions that make a generated shell look built by hand.
// Called by generate.js after the walls and roof are up (exterior, partition) and after the furnishing (interior).
//
// Every rule here comes from the corpus (557 well-liked community builds, docs/BLUEPRINT_LAB.md "Details") or from
// Norse building practice (docs/BUILDING_DETAILS.md):
//   - windows: the commonest window is 1 m tall from 1 m up; builders frame it with posts at the sides (27 % of
//     openings have a 2 m pole beside them), a beam under it (sill) and over it, a post in the middle of a 2 m opening
//     (two 1 m lights), and shutters (Wood Shutter, 1 x 1 m) beside it
//   - doors: posts at both sides (34 % of doors), a beam over the door at its top edge and one at its foot, a floor or
//     step in front (43 %), a lamp or torch beside it
//   - corners: 64 % of outside wall corners carry a post (wood pole, log pole, dark wood pole)
//   - walls: beams laid in the wall plane at its foot and at 1 m and 2 m (the timber frame bands)
//   - gables: a 45 or 26 degree beam along each roof edge at the gable end (the bargeboard: the corpus puts it at the
//     roof piece's side edge, turned 90 degrees); crossed boards over the ridge on Norse and Slavic houses
//   - halls: leaning outer posts against the long walls (Ribe, Trelleborg), raised benches along the long walls inside
//   - homes: a bench and a lamp by the door, a kerb round the fire pit, a back room behind a partition in big houses
// Pieces are put with b.put, so the same piece in the same place goes in once only. Trim pieces carry trim: true.

const NODE_D = typeof module !== 'undefined';
const PD = NODE_D ? require('./pieces.js') : window.VHPieces;
const checksD = () => (NODE_D ? require('./checks.js') : window.VHChecks);

const normD = a => ((a % 360) + 360) % 360;
const quatD = yaw => { const a = yaw * Math.PI / 360; return [0, +Math.sin(a).toFixed(6), 0, +Math.cos(a).toFixed(6)]; };
const BIOMES_D = ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains', 'Mistlands', 'Ashlands'];
const reachesD = (biome, b) => BIOMES_D.indexOf(biome) >= BIOMES_D.indexOf(b);

// Cultures by the trim they use. Northern timber cultures get the full set; stone and flat-roofed cultures keep their
// own forms and get only the door and window frames.
const NORTH = ['norse', 'norse-forest', 'norse-highland', 'anglo-saxon', 'slavic', 'baltic', 'fen-folk', 'celtic',
  'celtic-crannog', 'frankish-norman', 'black-forest', 'mountain', 'swamp', 'castle-medieval', 'saami'];
const CROSSED = ['norse', 'norse-forest', 'norse-highland', 'slavic', 'baltic', 'black-forest', 'mountain'];
const BRACED = ['norse', 'norse-forest', 'norse-highland', 'anglo-saxon', 'black-forest'];
const SHUTTERS = ['norse', 'norse-forest', 'norse-highland', 'slavic', 'baltic', 'anglo-saxon', 'frankish-norman',
  'celtic', 'fen-folk', 'black-forest', 'mountain', 'swamp', 'castle-medieval'];

// What a building gets, from its culture, type, size stage (s1 to s3) and decor stage (d1 to d3).
function profile(ctx) {
  const { C, cultureKey, T, stage, decor, biome, R } = ctx;
  const sN = +stage[1], dN = +decor[1];
  const north = NORTH.includes(cultureKey);
  const wood = /plank|half-timber|log/.test(C.wallStyle || 'plank');
  const roll = p => R() < p;
  return {
    sN, dN, north, wood,
    windowFrame: (sN >= 2 || C.frame) && !C.arches,
    mullion: !C.glass && C.windowStyle !== 'single' && !C.arches,
    shutters: sN >= 2 && dN >= 2 && SHUTTERS.includes(cultureKey) && reachesD(biome, 'Black Forest') && !C.glass && roll(0.6),
    doorFrame: !C.arches,
    doorHood: north && sN >= 2 && !C.awnings && roll(0.7),
    doorstep: sN >= 2,
    doorLamp: dN >= 2,
    cornerPosts: wood && !C.frame && !T.tower,
    bands: wood && sN >= 2 && !C.frame,
    midRail: false, // with the braces and window frames a rail at 1 m made half-timbered walls too busy (2026-11-09 render)
    bargeboards: north && (sN >= 2 || C.carved),
    crossed: CROSSED.includes(cultureKey) && sN >= 2,
    svalgang: ['norse', 'norse-forest', 'norse-highland', 'slavic', 'baltic'].includes(cultureKey) && ctx.storeys >= 2 &&
      ['home', 'storage', 'tavern'].includes(ctx.type) && (sN >= 3 || (sN === 2 && dN >= 3)) && ['rect', 'long', 'L', 'T'].includes(ctx.plan) &&
      !C.awnings && !ctx.flat && roll(0.75),
    gableWindow: north && sN >= 2,
    rafterTails: north && sN >= 2 && !C.eaves2 && (C.eaves || 1) < 2,
    purlinEnds: north && sN >= 2,
    gableTruss: north && sN >= 2 && roll(0.6),
    gablePorch: north && (sN >= 3 || (sN === 2 && dN >= 3)) && ['home', 'longhouse', 'tavern', 'temple'].includes(ctx.type) && roll(0.5),
    roofCross: false, // Wood Roof Cross at the gable apex: off until its shape is checked against the game model

    braces: BRACED.includes(cultureKey) && sN >= 2 && (T.use === 'hall' || ctx.type === 'longhouse'),
    benchOut: dN >= 2 && ['home', 'hall'].includes(T.use),
    fireKerb: dN >= 2,
    wallBenches: (ctx.type === 'longhouse' || (T.use === 'hall' && ['long', 'rect'].includes(ctx.plan))) && sN >= 2,
    partition: ['home', 'tavern'].includes(ctx.type) && (sN >= 3 || (sN === 2 && dN >= 3)) && ['rect', 'long', 'L', 'T'].includes(ctx.plan),
  };
}

// The kit's beam for a slope: 45 or 26 degrees, in the wood the frame uses.
function slopeBeam(K, deg) {
  const b = K.beam || 'wood_beam';
  if (/darkwood/.test(b)) return `darkwood_beam_${deg}`;
  if (/ashwood/.test(b)) return `ashwood_wall_beam_${deg}`;
  return `wood_beam_${deg}`;
}
function framePoleD(K, C) { return C.darkFrame && reachesD(C.biome || 'Meadows', 'Plains') ? 'darkwood_pole' : (K.pole || 'wood_pole2'); }

// along-the-wall and outward unit vectors of an outer edge
function axes(e) {
  const ux = e.yaw === 0 ? 1 : 0, uz = e.yaw === 0 ? 0 : 1;
  return { ux, uz, ox: e.out[0], oz: e.out[1] };
}
function outYaw(ox, oz) { return normD(Math.atan2(ox, oz) * 180 / Math.PI); } // a piece facing local +z faces out

// A box test against what is already there (furniture, doors, stairs, other trim), for pieces that stand free.
function clear(b, cand, roles, pad = 0.05) {
  const Ck = checksD(), cb = Ck.aabb(cand);
  return !b.pieces.some(p => {
    if (roles && !roles.includes(PD.piece(p.name).role)) return false;
    const o = Ck.aabb(p);
    return o.x0 < cb.x1 - pad && o.x1 > cb.x0 + pad && o.y0 < cb.y1 - pad && o.y1 > cb.y0 + pad && o.z0 < cb.z1 - pad && o.z1 > cb.z0 + pad;
  });
}

// ---------------------------------------------------------------- exterior

function exterior(b, ctx) {
  const { K, C, F, SH, storeys, edges, verts, door } = ctx;
  const X = ctx.profile || profile(ctx);
  ctx.profile = X;
  const put = (name, x, y, z, yaw) => { if (name) b.put(name, x, y, z, yaw, { trim: true }); };
  const beam = K.beam || 'wood_beam', pole1 = K.pole1 || 'wood_pole', pole = framePoleD(K, C);
  const edgeAt = new Map(edges.map(e => [`${e.x},${e.z}`, e]));
  const openings = b.openings || [];
  const isOpen = new Set(openings.map(o => `${o.e.x},${o.e.z},${o.y0}`));
  const added = { windows: 0, doors: 0, corners: 0, gables: 0, braces: 0, gallery: 0 };
  if (X.svalgang && ctx.wallSegment) added.gallery = svalgang(b, ctx) ? 1 : 0;
  if (X.gablePorch && !added.gallery) added.porch = gablePorch(b, ctx) ? 1 : 0;

  // ---- windows
  for (const o of openings) {
    if (o.kind !== 'window') continue;
    const { e, y0 } = o, { ux, uz, ox, oz } = axes(e);
    const stone = /stone|marble|grausten/.test(C.wallStyle || '') && !(b.woodBays && b.woodBays.has(`${Math.round(e.x * 10)},${Math.round(e.z * 10)}`));
    const f = 0.1; // trim stands a little proud of the wall face
    if (X.mullion && C.windowStyle !== 'single') put(pole1, e.x, y0 + 1.5, e.z, 0); // two 1 m lights
    if (X.windowFrame) {
      put(beam, e.x + ox * f, y0 + 0.9, e.z + oz * f, e.yaw); // sill under the opening
      put(beam, e.x + ox * f, y0 + 2.1, e.z + oz * f, e.yaw); // head over it
      if (!C.frame || stone) for (const s of [-1, 1]) put(pole1, e.x + ux * s * 1 + ox * f, y0 + 1.5, e.z + uz * s * 1 + oz * f, 0); // side posts
    }
    if (X.shutters && !stone && o.storey === 0 + o.storey) {
      // open shutters flat against the wall either side, only where wall continues beside the window
      for (const s of [-1, 1]) {
        const n = edgeAt.get(`${e.x + ux * s * 2},${e.z + uz * s * 2}`);
        if (!n || n.yaw !== e.yaw || isOpen.has(`${n.x},${n.z},${y0}`)) continue;
        put('wood_window', e.x + ux * s * 1.5 + ox * 0.12, y0 + 1.5, e.z + uz * s * 1.5 + oz * 0.12, e.yaw);
      }
    }
    added.windows++;
  }

  // ---- doors
  for (const o of openings) {
    if (o.kind === 'window') continue;
    const { e, y0 } = o, { ux, uz, ox, oz } = axes(e);
    const h = o.kind === 'gate' ? 3 : 2;
    if (X.doorFrame && o.kind === 'door') {
      if (!C.frame) for (const s of [-1, 1]) put(pole, e.x + ux * s * 1.05 + ox * 0.1, y0 + 1, e.z + uz * s * 1.05 + oz * 0.1, 0);
      put(beam, e.x + ox * 0.12, y0 + h + 0.1, e.z + oz * 0.12, e.yaw); // the lintel, its underside at the door's top
    }
    if (o.storey > 0) continue;
    const outside = { x: e.x + ox, z: e.z + oz };
    // a step or landing in front of a ground-level door, unless a porch, stair or deck is already there
    const busy = b.pieces.some(p => Math.hypot(p.x - outside.x, p.z - outside.z) < 1.1 && ['floor', 'stair'].includes(PD.piece(p.name).role) && Math.abs(p.y - F) < 1.2);
    if (X.doorstep && F < 0.01 && !busy) put(K.floor, outside.x, F, outside.z, 0);
    // a small roof over the door (pent hood) with a rafter under each side, where no porch or awning covers it
    const covered = b.pieces.some(p => /roof/.test(p.name) && Math.hypot(p.x - outside.x, p.z - outside.z) < 1.2 && p.y > y0 + 2 && p.y < y0 + SH + 0.6);
    if (X.doorHood && !covered && !(b.gallery && o.storey === 0) && SH >= 3 && !(ctx.flat && storeys === 1 && false)) {
      const yaw = normD(Math.atan2(ox, oz) * 180 / Math.PI + 180);
      put(K.roof26, outside.x, y0 + SH - 0.5, outside.z, yaw);
      const r26 = slopeBeam(K, 26);
      for (const s of [-1, 1]) put(r26, outside.x + ux * s * 1, y0 + SH - 0.5, outside.z + uz * s * 1, yaw + 90);
      b.notes.push('A small roof over the door.');
    }
    // a lamp post beside the door on the ground
    if (X.doorLamp && F < 0.01 && !o.back) {
      for (const s of [1, -1]) {
        const cand = { name: 'piece_groundtorch_wood', x: +(e.x + ux * s * 1.8 + ox * 0.8).toFixed(3), y: F + 0.75, z: +(e.z + uz * s * 1.8 + oz * 0.8).toFixed(3), q: quatD(0), yaw: 0 };
        if (!clear(b, cand)) continue;
        b.pieces.push({ ...cand, decor: true, trim: true });
        break;
      }
    }
    added.doors++;
  }

  // ---- corner posts, from the foot of the walls to their top, on every outside corner
  if (X.cornerPosts) {
    const dirs = new Map();
    for (const e of edges) {
      const { ux, uz } = axes(e);
      for (const s of [-1, 1]) { const k = `${e.x + ux * s},${e.z + uz * s}`; if (!dirs.has(k)) dirs.set(k, new Set()); dirs.get(k).add(e.yaw); }
    }
    const top = F + storeys * SH, p = C.wallStyle === 'log' ? (K.pole || pole) : pole;
    for (const [k, ys] of dirs) {
      if (ys.size < 2) continue;
      const [x, z] = k.split(',').map(Number);
      for (let y = F; y < top - 0.01;) { const h = top - y >= 2 ? 2 : 1; put(h === 2 ? p : pole1, x, y + h / 2, z, 0); y += h; }
      added.corners++;
    }
  }

  // ---- bands: a beam at the foot of the walls and along the floor line of each upper storey; a rail at 1 m on
  // half-timbered walls. Laid a little proud of the outside face, never across a door.
  if (X.bands || X.midRail) for (const e of edges) {
    const { ox, oz } = axes(e);
    for (let s = 0; s < storeys; s++) {
      const y0 = F + s * SH;
      const opening = openings.find(o => o.e === e && o.y0 === y0);
      if (X.bands && !(opening && opening.kind !== 'window')) put(beam, e.x + ox * 0.08, y0 + 0.1, e.z + oz * 0.08, e.yaw);
      if (X.midRail && !opening) put(beam, e.x + ox * 0.08, y0 + 1, e.z + oz * 0.08, e.yaw);
    }
  }

  // ---- leaning outer posts against the long walls of halls (a 45 degree beam from the ground to 2 m up the wall)
  if (X.braces && F < 1.6 && !ctx.flat) {
    const w0 = ctx.wings[0];
    const doors = openings.filter(o => o.kind !== 'window').map(o => o.e);
    const brace = slopeBeam(K, 45);
    for (const [x, z] of verts) {
      // on the long sides of the main wing only, not at its corners, every other post
      const onLong = Math.abs(Math.abs(z - w0.cz) - w0.D) < 0.01 && Math.abs(x - w0.cx) < w0.W - 0.5;
      if (!onLong || Math.round(x) % 4 !== 0) continue;
      if (doors.some(d => Math.hypot(d.x - x, d.z - z) < 2.2)) continue;
      const nz = z > w0.cz ? 1 : -1, cand = { name: brace, x, y: 1, z: z + nz * 1.05, yaw: normD(Math.atan2(nz, -0) * 180 / Math.PI) };
      // the beam rises toward its local +x: turned so +x points back at the wall
      cand.yaw = normD(Math.atan2(nz, 0) * 180 / Math.PI); // yaw with local +x = (0, -nz)
      if (!clear(b, { ...cand, q: quatD(cand.yaw) }, ['door', 'stair', 'floor', 'storage', 'craft', 'seat', 'table', 'light', 'fence'])) continue;
      put(brace, cand.x, cand.y, cand.z, cand.yaw);
      added.braces++;
    }
    if (added.braces) b.notes.push('Leaning posts against the long walls, after the Viking halls at Trelleborg.');
  }

  b.detailReport = added;
  return added;
}

// The upper gallery of a Norwegian loft (svalgang): a balcony three bays wide over the front door, on posts from the
// ground with a beam under its edge and a rail round it, reached by a door from the upper room. Below, it roofs the
// entrance like a porch.
function svalgang(b, ctx) {
  const { K, C, F, SH, edges, door, ladders, cells } = ctx, w0 = ctx.wings[0];
  if (!door || door.out[1] >= 0) return false;
  const yU = F + SH, zf = door.z;
  const front = new Map(edges.filter(e => e.out[1] < 0 && Math.abs(e.z - zf) < 0.01).map(e => [e.x, e]));
  // three bays of the front wall with the door among them, the door in the middle where it can be
  const xs = [[-2, 0, 2], [-4, -2, 0], [0, 2, 4]].map(o => o.map(d => door.x + d)).find(c => c.every(x => front.has(x)));
  if (!xs) return false;
  const x0 = xs[0] - 1, x1 = xs[2] + 1;
  // nothing in front of the door already (a porch, a stair, a walkway)
  if (b.pieces.some(p => p.z < zf - 0.5 && p.z > zf - 2.6 && p.x > x0 + 0.3 && p.x < x1 - 0.3 && p.y < yU + 1)) return false;
  // the upper door: a bay beside the middle whose inside cell is no ladder hole or landing
  const L = ladders || [];
  const freeCell = x => cells.has(`${x},${zf + 1}`) && !L.some(l => [l.hole, l.land, l.stand].some(c => c[0] === x && c[1] === zf + 1));
  const ux = xs.filter(x => x !== door.x).sort((a, c) => Math.abs(a - door.x) - Math.abs(c - door.x)).find(freeCell);
  if (ux == null) return false;
  // take out the upper bay's wall and window pieces, and build it again as a door
  const inBay = p => Math.abs(p.x - ux) < 1.01 && Math.abs(p.z - zf) < 0.3 && p.y > yU + 0.05 && p.y < yU + SH - 0.05 &&
    ['wall', 'window', 'door'].includes(PD.piece(p.name).role) && !p.decor;
  b.pieces = b.pieces.filter(p => !inBay(p));
  b.openings = (b.openings || []).filter(o => !(o.e.x === ux && Math.abs(o.y0 - yU) < 0.01));
  const e = front.get(ux);
  ctx.wallSegment(b, K, C, ux, yU, zf, e.yaw, SH, 'door');
  b.openings.push({ e, y0: yU, SH, storey: 1, kind: 'door', gallery: true });
  const pole = framePoleD(K, C), pole1 = K.pole1 || 'wood_pole', beam = K.beam || 'wood_beam', T = { trim: true };
  // floor, posts at the outer corners of each bay, beams under the edge and back to the wall, a rail round it
  for (const x of xs) b.put(K.floor, x, yU, zf - 1, 0, T);
  for (const x of [x0, xs[0] + 1, xs[1] + 1, x1]) {
    for (let y = 0; y < yU - 0.01;) { const h = yU - y >= 2 ? 2 : 1; b.put(h === 2 ? pole : pole1, x, y + h / 2, zf - 2, 0, T); y += h; }
    b.put(pole1, x, yU + 0.5, zf - 2, 0, T); // the rail's post
  }
  for (const x of xs) b.put(beam, x, yU - 0.15, zf - 2, 0, T);
  for (const x of [x0, x1]) b.put(beam, x, yU - 0.15, zf - 1, 90, T);
  const rail = K.fence || 'wood_fence';
  for (const x of xs) b.put(rail, x, yU + 0.5, zf - 2, 0, T);
  for (const x of [x0, x1]) b.put(rail, x, yU + 0.5, zf - 1, 90, T);
  b.gallery = true;
  b.notes.push('An upper gallery over the front door with a door from the upper room, after the Norwegian lofts.');
  return true;
}

// A gabled porch over the front door (the entrance dormer of the community longhouses in the corpus): posts 4 m apart
// two metres out, a small 45 degree gable roof whose ridge runs from the door out, closed against the wall by a gable,
// and a gable triangle over the open front. Its eaves are 2.4 m up, clear of anyone walking in.
function gablePorch(b, ctx) {
  const { K, C, F, SH, edges, door, roofKind, flat } = ctx;
  if (!door || door.out[1] >= 0 || F > 0.01 || flat || ctx.dragonsHere === undefined) return false;
  if (!K.roof45 || !K.gable45) return false;
  const zf = door.z, x = door.x;
  const front = new Set(edges.filter(e => e.out[1] < 0 && Math.abs(e.z - zf) < 0.01).map(e => e.x));
  if (!front.has(x - 2) || !front.has(x + 2)) return false;
  if (b.pieces.some(p => p.z < zf - 0.3 && p.z > zf - 3.2 && Math.abs(p.x - x) < 2.6 && p.y > F - 0.5 && !['floor'].includes(PD.piece(p.name).role))) return false;
  const yR = F + 4.4, T = { trim: true }, pole = framePoleD(K, C), pole1 = K.pole1 || 'wood_pole', beam = K.beam || 'wood_beam';
  for (const s of [-1, 1]) {
    b.put(pole, x + 2 * s, F + 1, zf - 2, 0, T);
    b.put(pole1, x + 2 * s, F + 1.9, zf - 2, 0, T);
    b.put(beam, x + 2 * s, F + 2.35, zf - 1, 90, T); // plate from the wall to the post
    b.put(beam, x + s, F + 2.35, zf - 2, 0, T); // tie beam across the front
    b.put(K.roof45, x + s, yR - 1, zf - 1, s > 0 ? 90 : 270, T);
    for (const z of [zf - 2, zf]) b.put(K.gable45, x + s, yR - 2, z, s > 0 ? 180 : 0, T); // the open front, and the back closing it against the wall
    b.put(slopeBeam(K, 45), x + s, yR - 1, zf - 2.08, s > 0 ? 180 : 0, T); // bargeboard on the open front
  }
  b.put(K.roofTop45, x, yR, zf - 1, 90, T);
  if (!b.pieces.some(p => p.name === K.floor && Math.abs(p.x - x) < 0.1 && Math.abs(p.z - (zf - 1)) < 0.1)) b.put(K.floor, x, F, zf - 1, 0, T);
  b.notes.push('A gabled porch over the front door.');
  return true;
}

// Bargeboards for one wing's gable ends, as roof parts (generate.js lays them with the rest of the roof so crossing
// wings hide them where another roof runs over). Arguments as gablePieces: K, C, the wing, the roof top, rise per row,
// which ends get a gable, and helpers to place a part in wing-local coordinates.
function bargeboards(K, C, w, ctx, rows, ends, add, low, pivot, r) {
  const X = ctx.profile;
  if (!X) return;
  const name = slopeBeam(K, r === 2 ? 45 : 26), beam = K.beam || 'wood_beam', capY = low(-1);
  // rafter tails: a sloped beam at every seam of the lowest roof row, half a metre out past its edge and just under it
  // (the exposed rafters of Norse halls; the corpus lays sloped beams along roof piece edges)
  if (X.rafterTails) for (let u = -w.W + 2; u <= w.W - 2 + 0.01; u += 2) for (const sv of [-1, 1]) {
    const v = sv * (2 + 2 * rows + 0.7);
    add(name, u, pivot(rows) - 0.7 - (r === 2 ? 0 : 0), v, (sv < 0 ? 180 : 0) + 90, 'trim', low(rows));
  }
  // the ridge beam's end out past each gable
  if (X.purlinEnds && !ctx.dragonsHere && ctx.wings.length === 1) [-1, 1].forEach((sg, k) => { if (ends[k]) add(K.beam1 || 'wood_beam_1', sg * (w.W + 0.45), capY - 0.35, 0, 0, 'trim', capY); });
  // a timber truss on the face of each gable: a king post up the middle and a collar beam across at half height
  if (X.gableTruss) [-1, 1].forEach((sg, k) => {
    if (!ends[k] || capY - low(rows) < 2.9) return;
    const u = sg * (w.W + 0.1), top = low(rows) + (r === 2 ? 0 : 0), h = capY - top;
    const from = X.gableWindow && h >= 3.9 ? top + 2.2 : top;
    for (let y = from; y < capY - 0.6;) { const step = capY - 0.6 - y >= 2 ? 2 : 1; add(step === 2 ? (K.pole || 'wood_pole2') : (K.pole1 || 'wood_pole'), u, y + step / 2, 0, 0, 'trim', y + step); y += step; }
    const yc = top + Math.round(h / 2);
    // collar beams wherever 2 m of beam fits under the roof at that height
    for (let v = -w.D + 2; v <= w.D - 2 + 0.01; v += 2) {
      const edge = Math.abs(v) + 1, surf = capY - (r / 2) * Math.max(0, edge - 1);
      if (surf > yc + 0.3) add(beam, u, yc, v, 90, 'trim', yc + 0.1);
    }
  });
  if (!X.bargeboards) return;
  [-1, 1].forEach((sg, k) => {
    if (!ends[k]) return;
    const u = sg * (w.W + 0.06);
    for (let i = 0; i <= rows; i++) for (const sv of [-1, 1]) {
      const v = sv * (2 + 2 * i), roofYaw = sv < 0 ? 180 : 0;
      add(name, u, pivot(i), v, roofYaw + 90, 'trim', low(i) + r);
    }
    // the roof cross on the apex of a thatched gable, as a quarter of the corpus builds do (the ridge cap turned 90
    // degrees at the gable end)
    if (X.roofCross && /^wood_roof/.test(K.roof45 || '')) add(r === 2 ? 'wood_wall_roof_top_45' : 'wood_wall_roof_top', sg * w.W, low(-1) + (r === 2 ? 0 : 0) + 0, 0, 90, 'trim', low(-1) + 0.4);
    // crossed boards over the ridge: each slope's board carried one row past the ridge, so the two cross
    if (X.crossed && r === 2 && !ctx.dragonsHere) for (const sv of [-1, 1]) add(name, u, pivot(-1), 0, (sv < 0 ? 180 : 0) + 90, 'trim', low(-1) + r);
  });
}

// ---------------------------------------------------------------- partition (before the furnishing)

// A big house gets a back room: a wall across the main wing two cells from one end, with a door in the middle bay.
function partition(b, ctx, wallSegment) {
  const X = ctx.profile;
  if (!X || !X.partition) return false;
  const { K, C, F, SH, cells, door, ladders, flue } = ctx, w0 = ctx.wings[0];
  if (w0.alpha !== 0 || w0.W < 5 || w0.D < 3) return false;
  const sides = ctx.R() < 0.5 ? [1, -1] : [-1, 1];
  for (const sg of sides) {
    const xp = w0.cx + sg * (w0.W - 4); // two 2 m cells deep
    if (Math.abs(xp - door.x) < 2.5) continue;
    if (flue && xp > flue.x0 - 1 && xp < flue.x1 + 1) continue;
    const zs = [...cells.values()].filter(([x, z]) => Math.abs(x - (xp - sg)) < 0.01 && Math.abs(z - w0.cz) < w0.D).map(([, z]) => z).sort((a, c) => a - c);
    if (zs.length < 3) continue;
    // ladders keep their foot, hole and landing
    const blocked = (ladders || []).some(L => [L.stand, L.hole, L.land].some(c => Math.abs(c[0] - xp) < 1.01));
    if (blocked) continue;
    const mid = zs.slice().sort((a, c) => Math.abs(a - w0.cz) - Math.abs(c - w0.cz))[0];
    for (const z of zs) wallSegment(b, K, C, xp, F, z, 90, SH, z === mid ? 'door' : 'wall');
    b.pieces.push(...[]);
    b.notes.push('A back room behind a wall with a door.');
    b.partitionX = xp;
    return true;
  }
  return false;
}

// A bench against the wall beside the front door, facing out (a place to sit in the evening). After the furnishing,
// so the woodpiles and stacks the decorator sets outside keep their places.
function benchByDoor(b, ctx) {
  const X = ctx.profile, F = ctx.F;
  if (!X.benchOut || F > 0.01) return;
  const edgeAt = new Map(ctx.edges.map(e => [`${e.x},${e.z}`, e]));
  for (const o of b.openings || []) {
    if (o.kind !== 'door' || o.back || o.storey > 0 || o.gallery) continue;
    const { e } = o, { ux, uz, ox, oz } = axes(e);
    const name = reachesD(ctx.biome, 'Black Forest') && ctx.R() < 0.4 ? 'piece_logbench01' : 'piece_bench01';
    const faceOut = name === 'piece_logbench01' ? outYaw(-ox, -oz) : outYaw(ox, oz); // the log bench faces its local -z
    for (const s of ctx.R() < 0.5 ? [1, -1] : [-1, 1]) {
      const cand = { name, x: +(e.x + ux * s * 3 + ox * 0.45).toFixed(3), y: F + 0.1, z: +(e.z + uz * s * 3 + oz * 0.45).toFixed(3), yaw: faceOut, q: quatD(faceOut) };
      if (!edgeAt.has(`${e.x + ux * s * 2},${e.z + uz * s * 2}`) || !edgeAt.has(`${e.x + ux * s * 4},${e.z + uz * s * 4}`)) continue; // wall behind it
      if (!clear(b, cand)) continue;
      b.pieces.push({ ...cand, decor: true, trim: true });
      break;
    }
    return;
  }
}

// ---------------------------------------------------------------- interior (after the furnishing)

function interior(b, ctx) {
  const X = ctx.profile;
  if (!X) return;
  const { K } = ctx, Ck = checksD();
  benchByDoor(b, ctx);
  const furniture = () => b.pieces.filter(p => p.decor);
  // a kerb of beams round a fire pit on the floor, so it reads as a hearth set into the floor
  if (X.fireKerb) {
    const fire = b.pieces.find(p => p.decor && p.name === 'fire_pit');
    if (fire) {
      const beam = K.beam || 'wood_beam', y = fire.y + 0.0;
      const ring = [[0, -1.15, 0], [0, 1.15, 0], [-1.15, 0, 90], [1.15, 0, 90]].map(([dx, dz, yaw]) => ({ name: beam, x: fire.x + dx, y, z: fire.z + dz, yaw, q: quatD(yaw) }));
      const ok = ring.every(c => { const cb = Ck.aabb(c); return !furniture().some(p => p !== fire && !/cookingstation|cauldron/.test(p.name) && PD.piece(p.name).role !== 'rug' && (o => o.x0 < cb.x1 && o.x1 > cb.x0 && o.z0 < cb.z1 && o.z1 > cb.z0 && o.y0 < cb.y1 + 0.3 && o.y1 > cb.y0)(Ck.aabb(p))); });
      if (ok) { for (const c of ring) b.put(c.name, c.x, c.y, c.z, c.yaw, { trim: true }); b.notes.push('A kerb of beams round the fire pit.'); }
    }
  }
  // raised benches along the long walls of a hall (the Viking pallr): a platform 0.3 m up and 1 m deep wherever the
  // wall is free, widened under beds, chests and benches that stand against the wall, which are lifted onto it
  if (X.wallBenches && ctx.F < 0.01) {
    const w0 = ctx.wings[0], lift = 0.3, f1 = K.floor1 || 'wood_floor_1x1', beam = K.beam || 'wood_beam';
    const zones = ctx.zones || [];
    const liftable = p => p.decor && ['bed', 'storage', 'seat'].includes(PD.piece(p.name).role) && !/throne/.test(p.name);
    let laid = 0;
    for (const sz of [-1, 1]) {
      const zWall = w0.cz + sz * w0.D, y = ctx.F + lift;
      const rowZ = k => zWall - sz * (0.5 + k); // 1 m rows out from the wall
      const cellBox = (x, k) => ({ x0: x - 0.5, x1: x + 0.5, z0: rowZ(k) - 0.5, z1: rowZ(k) + 0.5 });
      const ov = (a, o) => o.x0 < a.x1 - 0.02 && o.x1 > a.x0 + 0.02 && o.z0 < a.z1 - 0.02 && o.z1 > a.z0 + 0.02;
      const cells = new Map(); // "x|k" -> true
      const lifted = [];
      // furniture against this wall: its footprint becomes platform, the piece goes up onto it
      for (const p of b.pieces) {
        if (!liftable(p)) continue;
        const o = Ck.aabb(p);
        const near = sz > 0 ? zWall - o.z1 : o.z0 - zWall;
        if (near > 0.6 || near < -0.3 || Math.abs(o.y0 - (ctx.F + 0.1)) > 0.3) continue;
        const depth = sz > 0 ? zWall - o.z0 : o.z1 - zWall;
        if (depth > 3.1 || o.x0 < w0.cx - w0.W || o.x1 > w0.cx + w0.W) continue;
        lifted.push({ p, o, k: Math.ceil(depth - 0.05) });
      }
      const blocked = box => b.pieces.some(p => {
        if (lifted.some(l => l.p === p)) return false;
        const role = PD.piece(p.name).role;
        if (!p.decor && ['floor', 'roof', 'roofTop', 'roofCorner', 'gable', 'wall', 'beam'].includes(role)) return false;
        if (role === 'rug') return false;
        const o = Ck.aabb(p);
        return o.y0 < y + 2 && o.y1 > y - lift && ov(box, o);
      }) || zones.some(zn => zn.y0 < y + 2 && zn.y1 > y - lift && ov(box, zn));
      for (let x = w0.cx - w0.W + 0.5; x < w0.cx + w0.W; x += 1) if (!blocked(cellBox(x, 0))) cells.set(`${x}|0`, true);
      for (const l of lifted) {
        const want = [];
        for (let x = w0.cx - w0.W + 0.5; x < w0.cx + w0.W; x += 1) for (let k = 0; k < l.k; k++) if (ov(cellBox(x, k), l.o)) want.push([x, k]);
        if (!want.length || want.some(([x, k]) => blocked(cellBox(x, k)))) { l.skip = true; continue; }
        for (const [x, k] of want) cells.set(`${x}|${k}`, true);
      }
      // only runs of three meters or more along the wall make a bench; lifted pieces keep their own platform
      const row0 = [...cells.keys()].filter(c => c.endsWith('|0')).map(c => +c.split('|')[0]).sort((a, c) => a - c);
      const runs = [];
      for (const x of row0) { const r = runs[runs.length - 1]; if (r && x - r[r.length - 1] < 1.01) r.push(x); else runs.push([x]); }
      const keep = new Set();
      for (const r of runs) {
        const hasLift = lifted.some(l => !l.skip && r.some(x => x > l.o.x0 - 0.5 && x < l.o.x1 + 0.5));
        if (r.length >= 3 || hasLift) for (const x of r) keep.add(`${x}|0`);
      }
      for (const l of lifted) if (!l.skip) for (const c of cells.keys()) { const [x, k] = c.split('|').map(Number); if (k > 0 && x > l.o.x0 - 0.5 && x < l.o.x1 + 0.5) keep.add(c); }
      if (!keep.size) continue;
      for (const c of keep) {
        const [x, k] = c.split('|').map(Number);
        b.put(f1, x, y, rowZ(k), 0, { trim: true });
        // it rests on short beams laid across under each cell
        b.put(K.beam1 || 'wood_beam_1', x, y - 0.1, rowZ(k), 90, { trim: true });
        laid++;
      }
      for (const l of lifted) if (!l.skip) {
        const ok = [...keep].some(c => { const [x] = c.split('|').map(Number); return x > l.o.x0 - 0.5 && x < l.o.x1 + 0.5; });
        if (!ok) continue;
        // whatever stands on the piece goes up with it
        for (const q of b.pieces) if (q === l.p || (q.decor && q.x > l.o.x0 && q.x < l.o.x1 && q.z > l.o.z0 && q.z < l.o.z1 && q.y > l.p.y + 0.2 && q.y < l.p.y + 1.5)) q.y = +(q.y + lift).toFixed(3);
      }
    }
    if (laid) b.notes.push('Raised benches along the long walls, with the beds and chests up on them.');
  }
}

const apiD = { profile, exterior, bargeboards, partition, interior, slopeBeam };
if (NODE_D) module.exports = apiD; else window.VHDetails = apiD;

})();
// ---- generate.js
(function () {
// Villheim building generator. Builds a design from a request (type, biome, culture, plan, roof, stage, decor,
// seed) with a kit of real Valheim pieces, proportions learned from the corpus, and the building conventions the
// corpus shows. Coordinates: building centred near the origin, the main door on the -z side, ground at y = 0,
// grid 2 m.
//
// Plans (lab/shapes.py counts in the corpus, after turning each build to its main axis): rectangle, long, square,
// L, T, U or courtyard, cross, octagon. A plan is a set of wings (rectangles), each with its own roof axis.
// Roofs: gable, cross-gable (a gable per wing, the lower wing's roof running into the main roof), hip (corner
// pieces at each ring, measured with lab/offsets.js), shed, flat with parapet, conical over an octagon.
// Roof layout measured in the corpus: a 2 m ridge cap on the ridge, rows centred 2, 4, 6 m out from it, each row's
// low edge on the beam at its outer edge, 26 degree pieces pivoting on the low edge and 45 degree pieces in the
// middle, gable pieces under each row pivoting on the row's low edge, hip corners at the row's low edge.
//
// Culture forms (styles.js "forms", shapes and sizes in docs/CULTURE_STYLES.md):
//   round   round house of eight walls under a ring roof; on stilts with a deck and a walkway for crannogs
//   tent    lavvu: a cone of roof rings from the ground, no walls
//   yurt    low lattice wall (braced plank) under a low cone with an open crown
//   gables  Icelandic turf farm: narrow houses side by side, wooden gable fronts, stone side and back walls
//   court   rooms on four sides of a yard, an arcade on the yard side, flat roofs
//   keep    square keep: stone with buttresses and a parapet, or timber with a pyramid roof in the Meadows
//   svan    stone house with a tall square tower at a back corner (s2 and s3)
//   tower-svan  the tower alone
//   dome    cross-in-square church: equal arms, four columns, a drum and a stepped dome over the crossing
//   drum    hall church with a drum and a cone over the middle
//   stave   tall plank walls on log posts, a low gallery roof all round
//   sunken  small hut with the roof down to the ground and the door in the gable end
//   open    posts and a roof, no walls
//   raised  storehouse on posts

const NODE = typeof module !== 'undefined';
const S = NODE ? require('./styles.js') : window.VHStyles;
const Decor = NODE ? require('./decorate.js') : window.VHDecorate;
const P = NODE ? require('./pieces.js') : window.VHPieces;
const Details = NODE ? require('./details.js') : window.VHDetails;
const checksLib = () => (NODE ? require('./checks.js') : window.VHChecks);

// Heights (Tyler's in-game review, 2026-11-09). A player is about 1.8 m tall: rooms get walls of 3 m, so doors, beams
// and roofs clear the head; sunken huts, low by nature, get 2.5 m under a steep roof.
const MIN_STOREY = 3, LOW_STOREY = 2.5;

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function quat(yaw) { const a = yaw * Math.PI / 360; return [0, +Math.sin(a).toFixed(6), 0, +Math.cos(a).toFixed(6)]; }
const norm = a => ((a % 360) + 360) % 360;
const reaches = (biome, b) => S.BIOMES.indexOf(biome) >= S.BIOMES.indexOf(b);

class Build {
  constructor() { this.pieces = []; this.rooms = []; this.notes = []; this.keys = new Set(); this.vents = []; }
  put(name, x, y, z, yaw = 0, extra) {
    if (!name) return;
    yaw = norm(yaw);
    const key = `${name}|${Math.round(x * 100)}|${Math.round(y * 100)}|${Math.round(z * 100)}|${Math.round(yaw) % 360}`; // rounded so -0.00 and 0.00 match
    if (this.keys.has(key)) return; // the same piece in the same place once only (porch eaves, meeting wings)
    this.keys.add(key);
    this.pieces.push({ name, x: +x.toFixed(3), y: +y.toFixed(3), z: +z.toFixed(3), q: quat(yaw), yaw, ...(extra || {}) });
  }
}

// Wing-local (u along the ridge, v across, local yaw) to world. alpha is the wing's yaw: 0 = ridge along x,
// 270 = ridge along z (Unity's yaw maps local x to (cos a, -sin a)).
function toWorld(w, u, v, yaw) {
  const a = w.alpha * Math.PI / 180;
  return [w.cx + u * Math.cos(a) + v * Math.sin(a), w.cz - u * Math.sin(a) + v * Math.cos(a), norm(yaw + w.alpha)];
}
function inside(w, x, z, pad = 0) {
  const a = w.alpha * Math.PI / 180, dx = x - w.cx, dz = z - w.cz;
  const u = dx * Math.cos(a) - dz * Math.sin(a), v = dx * Math.sin(a) + dz * Math.cos(a);
  return Math.abs(u) < w.W + pad && Math.abs(v) < w.D + pad;
}

// ---------------------------------------------------------------- plan choice

const PLAN_BY_TYPE = {
  // weights per stage, from the corpus counts per category (category x plan), favouring Tyler's keepers
  home: { s1: { rect: 6, square: 3 }, s2: { rect: 5, L: 3, T: 2, square: 2, octagon: 0.6 }, s3: { T: 3, L: 3, rect: 2, cross: 1, octagon: 0.6 } },
  longhouse: { s1: { long: 1 }, s2: { long: 3, T: 1 }, s3: { long: 2, T: 2, cross: 1 } },
  tavern: { s1: { rect: 1 }, s2: { L: 2, T: 2, rect: 1 }, s3: { T: 2, cross: 1, U: 1 } },
  smithy: { s1: { rect: 2, square: 1 }, s2: { rect: 2, L: 1, T: 1 }, s3: { L: 2, T: 2, U: 1 } },
  sawmill: { s1: { rect: 1 }, s2: { rect: 2, L: 1 }, s3: { L: 1, rect: 1 } },
  workshop: { s1: { rect: 1 }, s2: { rect: 2, L: 1 }, s3: { L: 2, T: 1 } },
  barn: { s1: { rect: 1 }, s2: { rect: 2, long: 1 }, s3: { long: 1, L: 1 } },
  farm: { s1: { rect: 1 }, s2: { rect: 1 }, s3: { rect: 1, L: 1 } },
  storage: { s1: { rect: 1, square: 1 }, s2: { rect: 2, L: 1 }, s3: { L: 1, T: 1 } },
  tower: { s1: { square: 2, octagon: 1 }, s2: { square: 2, octagon: 1 }, s3: { square: 1, octagon: 1 } },
  dock: { s1: { rect: 1 }, s2: { rect: 1 }, s3: { rect: 1, L: 1 } },
  stall: { s1: { rect: 1 }, s2: { rect: 1 }, s3: { rect: 1, L: 1 } },
  temple: { s1: { rect: 1 }, s2: { rect: 1, cross: 1, octagon: 1 }, s3: { cross: 2, octagon: 1 } },
};
const ROOF_BY_CULTURE = {
  'norse': { gable: 6, hip: 2 }, 'black-forest': { gable: 5, hip: 2 }, 'swamp': { gable: 4, hip: 3 },
  'mountain': { gable: 6, hip: 1 }, 'middle-eastern': { flat: 1 }, 'east-asian': { hip: 4, gable: 1 },
  'castle-medieval': { gable: 5, hip: 2 }, 'dwarven': { flat: 2, hip: 1 }, 'slavic': { gable: 5, hip: 1 }, 'celtic': { gable: 1 },
  'celtic-crannog': { gable: 1 }, 'saami': { gable: 1 }, 'steppe': { gable: 1, hip: 1 },
};
// Wall styles per biome: counts of the main wall style in the corpus by material palette (lab/shapes.py).
const WALLS_BY_BIOME = {
  'Meadows': { 'half-timber': 144, plank: 110 },
  'Black Forest': { stone: 151, 'stone-base': 41, log: 34, plank: 15, 'half-timber': 10 },
  'Swamp': { stone: 36, 'stone-base': 33, 'half-timber': 27, plank: 25, log: 11 },
  'Mountain': { 'stone-base': 8, stone: 7, plank: 4, 'half-timber': 3 },
  'Plains': { 'stone-base': 10, 'half-timber': 10, plank: 8, stone: 6 },
  'Mistlands': { marble: 36, stone: 11, plank: 10 },
  'Ashlands': { grausten: 77, plank: 61, 'stone-base': 61, 'half-timber': 61, stone: 41 },
};
const WALLS_BY_CULTURE = {
  'black-forest': { log: 3, 'stone-base': 2, stone: 1 }, 'slavic': { log: 1 }, 'middle-eastern': { stone: 1 },
  'dwarven': { stone: 1 }, 'castle-medieval': { 'stone-base': 3, stone: 1 }, 'east-asian': { 'half-timber': 1 },
  'mountain': { 'stone-base': 2, stone: 1 },
};
function wallStyleFor(R, C, cultureKey, biome) {
  const w = { ...(C.walls || WALLS_BY_CULTURE[cultureKey] || WALLS_BY_BIOME[biome] || { plank: 1 }) };
  if (biome === 'Meadows') { delete w.stone; delete w['stone-base']; delete w.log; } // no stone or core wood yet
  if (C.early) { delete w.stone; delete w['stone-base']; delete w.marble; } // wood first (D-012)
  if (!Object.keys(w).length) w.plank = 1;
  return pick(R, w);
}

function pick(R, weights) {
  const e = Object.entries(weights), tot = e.reduce((s, [, w]) => s + w, 0);
  let x = R() * tot;
  for (const [k, w] of e) { if ((x -= w) <= 0) return k; }
  return e[0][0];
}

function formFor(C, type, stage) {
  const f = C.forms && C.forms[type];
  if (!f) return null;
  return typeof f === 'string' ? f : (f[stage] || null);
}

// Wings for a plan, from the main wing's half sizes W (along x) and D (across, odd). Every wing's cells must fall on
// the main wing's 2 m grid, so a side wing runs through the main wing's whole depth and out the other side: its half
// length is D plus the part that sticks out, and its centre sits on the right parity.
function wingsFor(plan, W, D, R, o = {}) {
  const odd = n => (n % 2 ? n : n + 1);
  const wD = Math.max(1, odd(D - 2)); // side wings are a bay narrower
  const ext = Math.max(2, Math.ceil(D * 0.8)); // how far a wing sticks out, metres in 2 m steps below
  const out = 2 * Math.round(ext / 2);
  const main = { cx: 0, cz: 0, W, D, alpha: 0, main: true };
  const mid = (W % 2 === wD % 2) ? 0 : 1; // centre x for a wing in the middle, on the grid
  switch (plan) {
    case 'L': {
      const side = R() < 0.5 ? -1 : 1;
      return [main, { cx: side * (W - wD), cz: -out / 2, W: D + out / 2, D: wD, alpha: 270 }];
    }
    case 'T':
      return [main, { cx: mid, cz: out / 2, W: D + out / 2, D: wD, alpha: 270 }];
    case 'cross':
      return [main, { cx: mid, cz: 0, W: D + out, D: wD, alpha: 270 }];
    case 'greek':
      // equal arms of the same width crossing in the middle (cross-in-square church)
      return [main, { cx: 0, cz: 0, W, D, alpha: 270 }];
    case 'nave': {
      // a narrower chancel in line at the +x end (2 cells long, a bay narrower)
      return [main, { cx: W + 2, cz: 0, W: 2, D: wD, alpha: 0 }];
    }
    case 'U': {
      // wings at both ends with a yard of at least 4 m between them (the main wing is widened when it is too short)
      const uD = Math.min(wD, 3), Wu = Math.max(W, 2 * uD + 3);
      main.W = Wu;
      return [main, { cx: -(Wu - uD), cz: -out / 2 - 1, W: D + out / 2 + 1, D: uD, alpha: 270 },
        { cx: Wu - uD, cz: -out / 2 - 1, W: D + out / 2 + 1, D: uD, alpha: 270 }];
    }
    case 'court': {
      // four wings dW cells deep round a yard; the outer square is 2Q metres; the front wing holds the gate
      const { Q, dW } = o;
      return [{ cx: 0, cz: -(Q - dW), W: Q, D: dW, alpha: 0, main: true }, { cx: 0, cz: Q - dW, W: Q, D: dW, alpha: 0 },
        { cx: -(Q - dW), cz: 0, W: Q - 2 * dW, D: dW, alpha: 270 }, { cx: Q - dW, cz: 0, W: Q - 2 * dW, D: dW, alpha: 270 }];
    }
    case 'gables': {
      // n narrow houses side by side, ridges front to back, fronts in one line; the middle one may run deeper
      const { n, deeper } = o, ws = [];
      for (let k = 0; k < n; k++) {
        const middle = n % 2 === 1 && k === (n - 1) / 2, Wk = W + (middle && deeper ? 1 : 0);
        ws.push({ cx: (k - (n - 1) / 2) * 2 * D, cz: Wk - W, W: Wk, D, alpha: 270, main: middle || (n % 2 === 0 && k === 0) });
      }
      return ws.sort((a, c) => (c.main ? 1 : 0) - (a.main ? 1 : 0));
    }
    default:
      return [main];
  }
}

// Floor cells (2 m, keyed by centre) and the outside edges of their union.
function cellsOf(wings) {
  const cells = new Map();
  for (const w of wings) {
    const a = w.alpha === 270 || w.alpha === 90;
    const hx = a ? w.D : w.W, hz = a ? w.W : w.D;
    for (let x = w.cx - hx + 1; x < w.cx + hx; x += 2) for (let z = w.cz - hz + 1; z < w.cz + hz; z += 2) cells.set(`${x},${z}`, [x, z]);
  }
  return cells;
}
function edgesOf(cells) {
  const out = [];
  for (const [, [x, z]] of cells) {
    for (const [dx, dz, yaw, inYaw] of [[0, -2, 0, 0], [0, 2, 0, 180], [-2, 0, 90, 90], [2, 0, 90, 270]]) {
      if (cells.has(`${x + dx},${z + dz}`)) continue;
      out.push({ x: x + dx / 2, z: z + dz / 2, yaw, inYaw, out: [dx / 2, dz / 2], cell: [x, z] });
    }
  }
  return out;
}
function vertsOf(edges) {
  const m = new Map();
  for (const e of edges) {
    const ux = e.yaw === 0 ? 1 : 0, uz = e.yaw === 0 ? 0 : 1;
    for (const s of [-1, 1]) { const x = e.x + s * ux, z = e.z + s * uz; m.set(`${x},${z}`, [x, z]); }
  }
  return [...m.values()];
}
// yaw of a slope piece whose low edge faces out (rises toward the building), from the edge's outward direction
function slopeYaw(out) { return out[1] < 0 ? 180 : out[1] > 0 ? 0 : out[0] < 0 ? 270 : 90; }

// ---------------------------------------------------------------- generator

function generate(req) {
  const type = S.TYPES[req.type] ? req.type : 'home';
  const T = { ...S.TYPES[type] };
  const biome = S.BIOMES.includes(req.biome) ? req.biome : 'Meadows';
  const seed = req.seed ?? 1;
  const cultureKey = S.cultureKey(req.culture) || S.cultureFor(biome, rng(seed * 104729 + type.length * 13 + 7));
  const C = { ...S.CULTURES[cultureKey], biome };
  const stage = ['s1', 's2', 's3'].includes(req.stage) ? req.stage : 's1';
  const decor = ['d1', 'd2', 'd3'].includes(req.decor) ? req.decor : 'd2';
  const R = rng(seed * 7919 + type.length * 31 + stage.charCodeAt(1) * 7 + cultureKey.length);
  const K = S.roofKit(S.kitFor(biome), C, biome);
  const b = new Build();
  const form = req.form || formFor(C, type, stage);
  const info = { type, biome, cultureKey, stage, decor, seed, form };
  // asked-for storeys, porch and pitch go into the name, so different requests never share a file name
  info.asked = (req.storeys >= 1 && req.storeys <= 3 ? `-${Math.round(req.storeys)}st` : '') + (req.porch === true ? '-porch' : req.porch === false ? '-noporch' : '') + (req.pitch ? `-p${+req.pitch}` : '');
  // Meadows and Black Forest villages build in wood at first; stone for later stages and for halls from s2 (D-012)
  const early = (biome === 'Meadows' || biome === 'Black Forest') && (stage === 's1' || (stage === 's2' && !['longhouse', 'tavern', 'temple', 'tower'].includes(type)));
  C.early = early;
  const stoneOK = !!K.stoneWall && biome !== 'Meadows' && !early;
  // a request may name the storeys (1 to 3) and ask for a porch or none; otherwise the culture and type decide
  const askedStoreys = req.storeys >= 1 && req.storeys <= 3 ? Math.round(req.storeys) : null;
  const storeysOf = () => askedStoreys || (C.storeys && C.storeys[type] && C.storeys[type][stage]) || T.storeys[stage];

  if (T.well) return finish(wellDesign(b, K, biome, stage), info);
  if (T.camp && !form) return finish(campDesign(b, K, biome, stage, R, decor), info);

  let plan = req.plan && req.plan !== 'auto' ? req.plan : null;

  // ---- round forms: round houses, crannogs, goahti, lavvu, yurts, round towers
  if (['round', 'tent', 'yurt'].includes(form) || plan === 'octagon' || (!plan && T.camp)) {
    const kind = form === 'tent' || form === 'yurt' ? form : (T.camp ? 'tent' : 'round');
    const [bx, bz] = T.bays[stage];
    const avg = Math.round((bx + bz) / 2);
    let side = (C.size && C.size[type] && C.size[type][stage]) || (avg >= 7 ? 6 : avg >= 4 ? 4 : 2);
    const storeys = T.tower ? T.storeys[stage] : 1;
    if (storeys > 1 && side < 4) side = 4; // a ladder needs three cells in a row: the foot, the hole and the landing
    // a home or hall has a fire in the middle and at least one bed: a 4.8 m round house has no room for both (T-102)
    if (['home', 'hall'].includes(T.use) && kind !== 'tent' && side < 4) side = 4;
    const r = kind === 'yurt' ? 1 : (C.pitch === 26 && kind === 'round' ? 1 : 2);
    const SH = MIN_STOREY;
    const F = C.stilts ? (C.stiltH || 2) : (T.raised || C.raised ? 1 : 0);
    let wallStyle = req.walls && req.walls !== 'auto' ? req.walls : wallStyleFor(R, C, cultureKey, biome);
    if (T.tower && stoneOK) wallStyle = 'stone';
    if (/stone/.test(wallStyle) && !stoneOK && !reaches(biome, 'Swamp')) wallStyle = 'plank';
    C.wallStyle = wallStyle;
    const Kr = kind === 'tent' && reaches(biome, 'Plains') ? { ...K, ...S.ROOF_SETS.dark } : K;
    C.baseTop = F + 0.6; // stone-base courses on the ground storey only
    if (F > 0.01 && /stone|marble|grausten/.test(C.wallStyle)) { C.wallStyle = 'plank'; wallStyle = 'plank'; } // stone on posts would fall
    octagonDesign(b, Kr, C, { side, F, SH, storeys, r, T, kind, stage, deck: C.stilts ? (C.deck || 2) : 0,
      walk: C.boardwalk ? { s1: 6, s2: 8, s3: 10 }[stage] : 0, fence: !!C.stilts && stage === 's3' });
    info.plan = 'octagon'; info.roof = kind === 'yurt' ? 'crown' : 'conical'; info.walls = kind === 'tent' ? 'none' : wallStyle;
    const ctx = { K: Kr, C, biome, use: T.use, stoneOK, F, SH, storeys, top: F + storeys * SH };
    clearDoorways(b);
    if (!req.skipDecor) Decor.decorate(b, { use: T.use, decor, biome, type, R, culture: cultureKey, doorX: b.doorX, fireAt: { x: 0, z: 0 } });
    settle(b, { ...ctx, type, skipDecor: !!req.skipDecor });
    return finish(b, info);
  }

  // ---- a square stone tower alone (Svan)
  if (form === 'tower-svan') {
    C.wallStyle = stoneOK ? 'stone' : 'plank';
    const n = { s1: 4, s2: 5, s3: 6 }[stage];
    towerAt(b, K, C, { cx: 0, cz: 0, n: 3, F: 0, storeys: n, SH: MIN_STOREY, door: 'front', use: 'guard' });
    info.plan = 'square'; info.roof = 'hip'; info.walls = C.wallStyle;
    b.notes.push('Square stone tower with wooden floors, slit windows and a low pyramid roof.');
    clearDoorways(b);
    if (!req.skipDecor) Decor.decorate(b, { use: 'guard', decor, biome, type, R, culture: cultureKey, doorX: b.doorX });
    settle(b, { K, C, biome, use: 'guard', stoneOK, F: 0, SH: MIN_STOREY, storeys: n, top: n * MIN_STOREY, skipDecor: !!req.skipDecor });
    return finish(b, info);
  }

  // ---- plan and roof
  if (form === 'sunken') Object.assign(C, { eaves: 2, porch: 0, pitch: 45 });
  if (!plan) {
    const fixed = { gables: 'gables', court: 'court', keep: 'square', svan: 'rect', drum: 'rect', stave: 'rect', sunken: 'rect' }[form];
    if (fixed) plan = fixed;
    else if (form === 'dome') plan = stage === 's1' ? 'square' : 'greek';
    else if (C.courtyard && stage === 's3' && !T.tower && type === 'home') plan = 'U';
    else {
      const w = { ...((C.plans && C.plans[type] && C.plans[type][stage]) || (PLAN_BY_TYPE[type] || PLAN_BY_TYPE.home)[stage]) };
      // round plans belong to Norse, Celtic, Black Forest and Mountain building in the corpus; flat-roofed styles never
      if (!['norse', 'black-forest', 'mountain', 'swamp', 'norse-forest'].includes(cultureKey) && type !== 'tower') delete w.octagon;
      if (!['home', 'tavern', 'smithy'].includes(type)) delete w.U;
      if (form === 'raised' || form === 'open') { delete w.L; delete w.T; delete w.U; delete w.cross; delete w.octagon; }
      plan = pick(R, Object.keys(w).length ? w : { rect: 1 });
    }
  }
  let roofKind = req.roof && req.roof !== 'auto' ? req.roof : null;
  if (!roofKind) {
    if (plan === 'court') roofKind = 'flat';
    else if (['gables', 'greek', 'nave'].includes(plan) || ['drum', 'stave', 'sunken', 'svan'].includes(form) || (form === 'dome')) roofKind = 'gable';
    else if (form === 'keep') roofKind = stoneOK ? 'flat' : 'hip';
    else roofKind = plan === 'octagon' ? 'conical' : pick(R, C.roofs || ROOF_BY_CULTURE[cultureKey] || { gable: 1 });
  }
  if (T.open === 'sides' && !req.roof && R() < 0.4) roofKind = 'shed';
  if (plan === 'octagon' && roofKind !== 'flat') roofKind = 'conical';
  if (plan !== 'octagon' && roofKind === 'conical') roofKind = 'hip';
  if (roofKind === 'shed' && plan !== 'rect' && plan !== 'long' && plan !== 'square') plan = 'rect';
  if (roofKind === 'hip' && ['gables', 'court', 'greek', 'nave', 'U'].includes(plan)) roofKind = 'gable';
  let wallStyle = req.walls && req.walls !== 'auto' ? req.walls : wallStyleFor(R, C, cultureKey, biome);
  if (form === 'keep') wallStyle = stoneOK ? 'stone' : (biome === 'Meadows' ? 'half-timber' : wallStyle);
  if (form === 'stave') wallStyle = 'plank';
  if (C.typeWalls && C.typeWalls[type] && !req.walls) wallStyle = C.typeWalls[type];
  if (plan === 'gables') wallStyle = stoneOK ? 'stone' : 'plank';
  C.wallStyle = wallStyle;
  if (form === 'keep' && stoneOK) Object.assign(C, { stoneWalls: true, parapet: true });
  if (form === 'open') T.open = 'all';
  info.plan = plan; info.roof = roofKind; info.walls = wallStyle;

  // ---- size
  let [bx, bz] = (C.bays && C.bays[type] && C.bays[type][stage]) || T.bays[stage];
  const wingOpts = {};
  if (plan === 'gables') {
    const n = { home: [1, 2, 3], longhouse: [2, 3, 3], tavern: [2, 3, 3], temple: [1, 1, 2] }[type] || [1, 1, 2];
    const depth = { home: [4, 4, 5], longhouse: [5, 5, 6], tavern: [5, 5, 6], temple: [4, 5, 5] }[type] || [3, 3, 4];
    const i = +stage[1] - 1;
    Object.assign(wingOpts, { n: n[i], deeper: ['home', 'longhouse', 'tavern'].includes(type) && stage === 's3' });
    bx = depth[i]; bz = 3;
  } else if (plan === 'court') {
    Object.assign(wingOpts, { Q: stage === 's3' && type !== 'home' ? 8 : 6, dW: 2 });
    bx = wingOpts.Q; bz = 2;
  } else if (form === 'keep') { bx = bz = { s1: 3, s2: 3, s3: 5 }[stage]; }
  else if (form === 'dome') { bx = { s1: 3, s2: 5, s3: 7 }[stage]; bz = { s1: 3, s2: 3, s3: 5 }[stage]; }
  else if (form === 'stave' || form === 'drum') { bx = { s1: 3, s2: 4, s3: 5 }[stage]; bz = 3; }
  else if (form === 'sunken') { bx = { s1: 2, s2: 3, s3: 4 }[stage]; bz = 3; }
  else {
    if (plan === 'long') bx = Math.max(bx + 2, Math.round(bz * 2.4));
    if (!T.tower && R() < 0.5 && plan !== 'square') bx += 1;
    if (!T.tower && stage !== 's1' && R() < 0.3 && plan !== 'square') bz += 1;
    if (bz % 2 === 0 && roofKind !== 'flat') bz += 1; // a ridge over a bay centre
    if (plan === 'square') bx = bz = Math.max(bx, bz) % 2 ? Math.max(bx, bz) : Math.max(bx, bz) + 1;
    if (roofKind === 'hip' && bx < bz) bx = bz;
  }
  let W = bx; const D = bz;
  const storeys = form === 'open' ? 1 : ['keep'].includes(form) ? { s1: 2, s2: 3, s3: 3 }[stage] : ['stave', 'court', 'dome', 'drum', 'sunken', 'gables'].includes(form) || plan === 'gables' ? 1 : storeysOf();
  let SH = T.low ? 2 : T.tower ? 3 : (['longhouse', 'tavern', 'temple'].includes(type) || stage === 's3') ? 3 : 2;
  if (form === 'keep' || plan === 'court') SH = 3;
  if (form === 'stave') SH = 4;
  if (plan === 'gables') SH = 2;
  if (form === 'open') SH = 3;
  if (C.storeyH && !T.low) SH = Math.max(SH, C.storeyH);
  SH = Math.max(SH, form === 'sunken' ? LOW_STOREY : MIN_STOREY);
  const flat = roofKind === 'flat';
  const pitch = req.pitch || (T.low || roofKind === 'shed' ? 26 : (C.pitch || 45));
  const r = +pitch === 45 ? 2 : 1;
  const lookout = T.tower && !['keep'].includes(form);

  // ---- foundation height
  let F = 0;
  const stoneBase = (C.plinth === 'stone' || (C.plinth === 'byBiome' && biome !== 'Meadows') || C.stoneGround) && K.plinth && !early;
  const podklet = C.podklet && stage !== 's1' && ['home', 'longhouse', 'tavern'].includes(type);
  if (plan === 'gables') F = 0; else if (T.dock) F = 1; else if (C.stilts) F = C.stiltH || 2; else if (podklet) F = 2; else if (form === 'raised') F = C.storeH || 1;
  else if (T.raised || C.raised) F = C.stiltChance && R() < C.stiltChance ? 2 : 1; else if (stoneBase) F = C.plinthHigh ? 2 : 1;
  const deck = C.stilts && plan !== 'octagon' ? (C.deck || 2) : 0;
  // stone and marble walls take no support from wooden posts or floors in Valheim: on posts the walls are planks
  C.baseTop = F + 0.6; // stone-base courses only at the bottom (F may still become 0.5 for a stone floor)
  const onPosts = F > 0.01 && !podklet && (C.stilts || T.dock || T.raised || C.raised || form === 'raised' || !stoneBase);
  if (onPosts && /stone|marble|grausten/.test(C.wallStyle)) { C.wallStyle = C.logWalls ? 'log' : 'plank'; C.stoneWalls = false; C.parapet = false; info.walls = C.wallStyle; }

  const wings = wingsFor(plan, W, D, R, wingOpts);
  W = wings[0].W; // a U plan may widen the main wing
  const cells = cellsOf(wings);
  const edges = edgesOf(cells);
  const verts = vertsOf(edges);

  // courtyard: cells next to the yard are a gallery; their yard side is an arcade
  const Q = wingOpts.Q;
  const inYard = (x, z) => plan === 'court' && Math.abs(x) < Q && Math.abs(z) < Q && !cells.has(`${x},${z}`);
  const arcade = new Set(edges.filter(e => inYard(e.cell[0] + 2 * e.out[0], e.cell[1] + 2 * e.out[1])));
  const gallery = new Set([...arcade].map(e => `${e.cell[0]},${e.cell[1]}`));

  // footing: stilts and short posts on a grid, a log ground storey, or a stone course round the edge
  if (F > 0) {
    if (podklet) {
      for (const e of edges) for (let y = 0; y < F - 0.01; y += 0.5) b.put('wood_wall_log', e.x, y + 0.25, e.z, e.yaw);
      b.notes.push('Log ground storey (podklet) for storage under the living floor.');
    } else if (C.stilts || T.dock || T.raised || C.raised || form === 'raised' || !stoneBase) {
      const grid = new Map(verts.map(v => [`${v[0]},${v[1]}`, v]));
      if (deck) for (const [, [x, z]] of cells) for (const dx of [-1, 1]) for (const dz of [-1, 1]) for (let k = 0; k <= 1; k++) { const vx = x + dx * (1 + k * 2), vz = z + dz * (1 + k * 2); grid.set(`${vx},${vz}`, [vx, vz]); }
      for (const [, [x, z]] of grid) posts(b, K, x, z, F);
    } else {
      // stone courses down from the floor; a 2 m course stands half in the ground under a 1 m floor
      const ch = P.piece(K.plinth).size[1];
      for (let t = F; t > 0.01; t -= ch) for (const e of edges) b.put(K.plinth, e.x, t - ch / 2, e.z, e.yaw);
    }
  }

  // floors (and a deck all round on stilts)
  const floorPiece = (C.stoneWalls && K.stoneFloor && F === 0) ? K.stoneFloor : K.floor;
  // A 1 m stone floor sits half in the ground: its middle on the ground, the rooms on its top. The game sets a design's
  // lowest pivot on the ground, so this keeps fields, wells and pens on the ground too; the spawner then raises the
  // earth round the stone so only its top edge shows.
  if (thickFloor(floorPiece) && F === 0) F = 0.5;
  const floorY = thickFloor(floorPiece) ? F - 0.5 : F;
  const floorCells = new Map(cells);
  if (deck) for (const [, [x, z]] of cells) for (let dx = -deck; dx <= deck; dx += 2) for (let dz = -deck; dz <= deck; dz += 2) floorCells.set(`${x + dx},${z + dz}`, [x + dx, z + dz]);
  for (const [k, [x, z]] of floorCells) b.put(cells.has(k) ? floorPiece : K.floor, x, cells.has(k) ? floorY : F, z);

  // door: the front edge of the main wing nearest the middle; in a sunken hut, the middle of the left gable end
  let door;
  if (form === 'sunken') door = edges.filter(e => e.out[0] < 0 && inside(wings[0], e.cell[0], e.cell[1])).sort((a, c) => Math.abs(a.z) - Math.abs(c.z))[0];
  if (!door) {
    const front = edges.filter(e => e.out[1] < 0 && inside(wings[0], e.cell[0], e.cell[1])).sort((a, c) => Math.abs(a.x - wings[0].cx) - Math.abs(c.x - wings[0].cx));
    door = front.length ? front[0] : edges.filter(e => e.out[1] < 0)[0] || edges[0];
  }
  const doorX = door.x, doorZ = door.z;
  const backDoor = C.opposedDoors && !T.tower && form !== 'sunken'
    ? edges.filter(e => e.out[1] > 0 && inside(wings[0], e.cell[0], e.cell[1])).sort((a, c) => Math.abs(a.x - doorX) - Math.abs(c.x - doorX))[0] : null;
  if (backDoor) b.notes.push('Doors in the middle of both long sides.');

  // the fire's place: the middle of the main wing's ridge, in line with the door in a house (the smoke hole and chimney
  // go over it), kept free of ladders
  const fireInside = ['hall', 'home', 'smithy', 'temple'].includes(T.use) && !T.tower;
  const lit = ['hall', 'home'].includes(T.use) && !T.tower; // rooms the decorator lays a fire in
  const w0 = wings[0], hipMain = roofKind === 'hip' && w0.W >= w0.D;
  let ventAt = fireInside && !['dome', 'drum'].includes(form) && !flat && roofKind !== 'shed' && !lookout
    ? (w0.alpha === 0 && T.use === 'home' ? { x: doorX, z: w0.cz } : { x: w0.cx, z: w0.cz }) : null;
  if (ventAt && hipMain) ventAt = { x: Math.max(w0.cx - (w0.W - w0.D), Math.min(w0.cx + (w0.W - w0.D), ventAt.x)), z: w0.cz }; // over a hip ridge
  let flue = lit && ventAt ? flueRect(w0, ventAt, hipMain ? w0.W - w0.D : w0.W - 1) : null;
  // under a flat roof the fire gets a cell of its own, away from the doors, before the ladders are placed; a chimney
  // goes up from it
  let flatCell = null;
  if (lit && flat && !lookout) {
    const doorEdges = [door, backDoor].filter(Boolean);
    // a courtyard wing has doors to the yard near its middle: its fire goes to the far end
    const score = ([x, z]) => (doorEdges.some(e => Math.hypot(e.x - x, e.z - z) < 2.5) ? 100 : 0) + (plan === 'court' ? -1 : 1) * Math.hypot(x - doorX, z - w0.cz);
    flatCell = [...cells.values()].filter(([x, z]) => inside(w0, x, z) && !gallery.has(`${x},${z}`)).sort((a, c) => score(a) - score(c))[0] || null;
    if (flatCell) flue = cellRect(flatCell);
  }
  const doorCell = [door.cell[0], door.cell[1]];
  const backCell = backDoor ? [backDoor.cell[0], backDoor.cell[1]] : null;

  // ladders: one per storey above the ground, each with a clear foot, a hole above it and a landing; a flat roof gets a
  // last one up to a hatch
  const climbsUp = storeys - 1 + (flat && !lookout ? 1 : 0);
  const ladders = climbsUp > 0 ? ladderPlan(cells, climbsUp, { door: doorCell, back: backCell, flue }) : [];
  if (climbsUp > 0 && ladders.length < climbsUp) b.notes.push('No room for a ladder with a clear foot and landing in this plan.');

  // details (lib/details.js): what trim this building gets, drawn from its own random stream so the rest of the
  // design comes out as before
  C.windowStyle = (T.low || ['storage', 'barn'].includes(type) || form === 'sunken' || (stage === 's1' && !['longhouse', 'tavern', 'temple'].includes(type))) ? 'single' : 'twin';
  const dragonsHere = roofKind === 'gable' && plan !== 'gables' && ((C.dragons && ['longhouse', 'temple', 'tavern'].includes(type)) || (C.carved && stage !== 's1'));
  const dctx = { K, C, cultureKey, T, type, stage, decor, biome, plan, F, SH, storeys, edges, verts, cells, door, wings, flat,
    ladders, flue, dragonsHere, R: rng(seed * 31337 + 7) };
  dctx.profile = Details.profile(dctx);
  dctx.wallSegment = wallSegment;

  // walls, frame and top plates per storey
  const open = T.open || null;
  let top = F;
  for (let s = 0; s < storeys; s++) {
    const y0 = F + s * SH;
    const up = ladders[s - 1], next = ladders[s];
    if (s > 0) {
      for (const [, [x, z]] of cells) if (!onLadder(up, x, z, SH) && !(flue && inRect(flue, x, z))) b.put(K.floor, x, y0, z);
      if (up) putLadder(b, K, up, y0 - SH, SH);
      else b.notes.push('Upper floor without a ladder.');
    }
    const isTopLookout = lookout && s === storeys - 1;
    for (const e of edges) {
      if (isTopLookout) { b.put(K.fence || K.wallHalf, e.x, y0 + 0.5, e.z, e.yaw); continue; }
      if (open === 'all') continue;
      if (open === 'front' && e.out[1] < 0) continue;
      if (open === 'sides' && !(e.out[1] > 0)) continue;
      if (arcade.has(e)) continue;
      const isDoor = s === 0 && (e === door || e === backDoor);
      // a barn's gates: three bays on the ground, the door bay alone when the floor is raised (one stair up)
      const isGate = T.bigDoor && s === 0 && e.out[1] < 0 && Math.abs(e.x - doorX) <= (F >= 0.9 ? 0.01 : 2.01) && Math.abs(e.z - doorZ) < 0.1;
      let isWindow = !isDoor && !isGate && (!T.tower || (form === 'keep' && s > 0)) && (Math.round((e.x + e.z) / 2) % 2 === 0) && Math.abs(e.x - doorX) + Math.abs(e.z - doorZ) > 2.5;
      if (plan === 'gables' && e.out[1] >= 0) isWindow = false;
      const style = C.frontWood && plan === 'gables' ? (e.out[1] < 0 ? 'plank' : null) : null;
      wallSegment(b, K, C, e.x, y0, e.z, e.yaw, SH, isGate ? 'gate' : isDoor ? 'door' : isWindow ? 'window' : 'wall', style);
      if (isWindow || isDoor || isGate) (b.openings = b.openings || []).push({ e, y0, SH, storey: s, kind: isGate ? 'gate' : isDoor ? 'door' : 'window', back: e === backDoor });
    }
    if (C.frame || open || T.tower || form === 'stave') for (const [x, z] of verts) {
      for (let y = y0; y < y0 + SH - 0.01;) { const h = (y0 + SH - y) >= 2 ? 2 : 1; b.put(h === 2 ? framePole(K, C) : K.pole1, x, y + h / 2, z); y += h; }
    }
    for (const e of edges) b.put(K.beam, e.x, y0 + SH, e.z, e.yaw);
    for (const w of wings) {
      const a = w.alpha === 270;
      const room = { x0: w.cx - (a ? w.D : w.W), x1: w.cx + (a ? w.D : w.W), z0: w.cz - (a ? w.W : w.D), z1: w.cz + (a ? w.W : w.D),
        y: y0, h: SH, use: T.use, upper: s > 0, door: s === 0 && w.main ? { x: doorX, z: doorZ } : null, main: !!w.main, slots: [] };
      for (const e of edges) {
        if (!(e.cell[0] > room.x0 && e.cell[0] < room.x1 && e.cell[1] > room.z0 && e.cell[1] < room.z1)) continue;
        if (s === 0 && Math.abs(e.x - doorX) + Math.abs(e.z - doorZ) < 1.8) continue;
        if (backDoor && s === 0 && Math.abs(e.x - backDoor.x) + Math.abs(e.z - backDoor.z) < 1.8) continue;
        if (open === 'all' || (open === 'front' && e.out[1] < 0) || (open === 'sides' && !(e.out[1] > 0)) || arcade.has(e)) continue;
        const ux = e.yaw === 0 ? 1 : 0, uz = e.yaw === 0 ? 0 : 1, nx = -e.out[0], nz = -e.out[1];
        for (const t of [-0.5, 0.5]) room.slots.push({ x: e.x + ux * t, z: e.z + uz * t, y: y0, yaw: e.inYaw, nx, nz });
      }
      if (s > 0 && up) room.hole = up.hole;
      // keep the ladders, their feet and landings, and the chimney free of furniture
      room.keep = [];
      if (up && s > 0) room.keep.push(cellRect(up.hole), cellRect(up.land));
      if (next) room.keep.push(cellRect(next.stand), cellRect(next.hole));
      if (flue && s > 0) room.keep.push(flue);
      if (room.slots) room.slots = room.slots.filter(sl => !room.keep.some(k => inRect(k, sl.x, sl.z, 0.6)));
      if (form === 'open') delete room.slots; // no walls: things stand along the edges of the floor
      b.rooms.push(room);
    }
    top = y0 + SH;
  }
  b.doorX = doorX;

  // courtyard: walls between the gallery and the rooms behind it, one door per wing, the arcade on the yard side
  if (plan === 'court') {
    const inner = [];
    for (const k of gallery) {
      const [x, z] = k.split(',').map(Number);
      for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
        const nk = `${x + dx},${z + dz}`;
        if (cells.has(nk) && !gallery.has(nk)) inner.push({ x: x + dx / 2, z: z + dz / 2, yaw: dx ? 90 : 0 });
      }
    }
    const doors = new Set();
    wings.forEach((w, i) => {
      const own = inner.filter(e => inside(w, e.x, e.z, 0.01));
      const target = i === 0 ? [doorX, w.cz] : [w.cx, w.cz];
      own.sort((a, c) => Math.hypot(a.x - target[0], a.z - target[1]) - Math.hypot(c.x - target[0], c.z - target[1]));
      if (own[0]) doors.add(own[0]);
    });
    for (const e of inner) wallSegment(b, K, C, e.x, F, e.z, e.yaw, SH, doors.has(e) ? 'door' : 'wall');
    arcadeAlong(b, K, [...arcade], F, SH);
    b.notes.push('Rooms on four sides of a yard, an arcade on the yard side.');
  }

  // a back room in a big house (before the furnishing, so the rooms are read with it)
  if (!open && plan !== 'court' && !req.skipDecor) Details.partition(b, dctx, wallSegment);

  // inner aisle posts for halls
  if (T.aisles && D >= 3 && plan === 'long') for (let x = -W + 2; x <= W - 2; x += 2) for (const z of [-(D - 2), D - 2])
    for (let y = F; y < top - 0.01; y += 2) b.put(framePole(K, C), x, y + 1, z);

  // ---- roof
  const roofTop = lookout ? F + (storeys - 1) * SH + 3 : top;
  // places where a drum, a dome or a tower stands instead of roof
  const holes = [];
  const domeCfg = form === 'dome' ? { x: 0, z: 0, side: D >= 5 ? 4 : 2 } : form === 'drum' ? { x: 0, z: 0, side: 2 } : null;
  if (domeCfg) { const ap = domeCfg.side / 2 / Math.tan(Math.PI / 8); holes.push({ x0: -ap - 0.6, x1: ap + 0.6, z0: -ap - 0.6, z1: ap + 0.6 }); }
  if (form === 'dome' && plan === 'greek') holes.push({ x0: -D, x1: D, z0: -D, z1: D });
  const svanTower = form === 'svan' && stage !== 's1' ? { cx: W - 3, cz: D + 3, n: 3 } : null;
  if (svanTower) holes.push({ x0: W - 6, x1: W + 0.01, z0: D - 0.01, z1: D + 6 });
  const inHole = p => holes.some(h => p.x > h.x0 && p.x < h.x1 && p.z > h.z0 && p.z < h.z1);
  if (flat && !lookout) flatRoof(b, K, C, cells, edges, top, F, SH, ladders[storeys - 1]);
  else if (roofKind === 'shed') shedRoof(b, K, wings[0], roofTop, r);
  else {
    const parts = [];
    for (const w of wings) {
      const others = wings.filter(o => o !== w);
      // a gable end is built unless it runs into a wing at least as wide (a narrower chancel or porch runs into it)
      const ends = [-1, 1].map(sg => { const [x, z] = toWorld(w, sg * (w.W + 0.5), 0, 0); return !others.some(o => inside(o, x, z) && o.D >= w.D); });
      const kind = roofKind === 'hip' && w.main && w.W >= w.D ? 'hip' : 'gable';
      const vent = w.main && !domeCfg ? ventAt : null;
      parts.push(...(kind === 'hip' ? hipPieces(K, w, roofTop, r, C.eaves, { kick: C.kick, vent }) : gablePieces(K, C, w, roofTop, r, ends, vent, dctx)));
    }
    const caps = [];
    // where wings cross, keep the higher roof so the lower roof runs into the higher one
    const placed = new Set();
    for (const p of parts) {
      const key = `${p.name}|${Math.round(p.x * 100)}|${Math.round(p.y * 100)}|${Math.round(p.z * 100)}|${Math.round(p.yaw) % 360}`;
      if (placed.has(key)) continue; // two wings can lay the same piece where they meet
      placed.add(key);
      if (inHole(p) && p.role !== 'gable') continue;
      if (p.vent) { caps.push(p); continue; }
      // a stone gable course needs stone right under it, or it falls: over a timber bay or a plank wall it is planks
      if (p.role === 'gable' && p.name === K.stoneWall && !stoneUnder(b, p, /2x2/.test(K.stoneWall) ? 2 : 1)) {
        p.name = /2x2/.test(K.stoneWall) ? 'woodwall' : K.wallHalf;
        // where another wing's gable already fills the spot, nothing more is needed
        if (b.pieces.some(q => Math.abs(q.x - p.x) < 0.05 && Math.abs(q.z - p.z) < 0.05 && Math.abs(q.y - p.y) < 0.9 && P.piece(q.name).role === 'wall')) continue;
      }
      const hidden = wings.some(o => o !== p.wing && inside(o, p.x, p.z, -0.2) && p.surf < surfaceAt(o, p.x, p.z, roofTop, r) - 0.25);
      if (!hidden) b.put(p.name, p.x, p.y, p.z, p.yaw);
    }
    // the ridge caps over the fire's place stay out for smoke; the last pass puts them back if no fire is laid
    if (caps.length) b.vents.push({ kind: 'ridge', caps, x: avg(caps.map(c => c.x)), z: avg(caps.map(c => c.z)), y: caps[0].y,
      rect: rectOf(caps), from: storeys > 1 ? F + SH : caps[0].y });
  }

  // porch at the front door: one or three bays wide, on the grid, never on top of a wing
  // a low roof's eaves already run 2 m past the wall, so only steep roofs get a porch roof of their own
  const porchFits = !flat && roofKind !== 'shed' && !T.dock && !T.tower && !['U', 'cross', 'court', 'gables', 'greek'].includes(plan) && !deck && !podklet && form !== 'sunken' && r === 2 && (C.eaves || 1) < 2;
  if (req.porch === true && !porchFits) b.notes.push('No porch: this plan, roof or form has no front for one.');
  if (req.porch === true ? porchFits : req.porch !== false && !flat && roofKind !== 'shed' && !T.dock && !T.tower && C.porch && R() < C.porch + (stage === 's1' ? -0.3 : 0.2) && porchFits && !dctx.profile.svalgang && !dctx.profile.gablePorch) {
    const h = R() < 0.5 ? 0 : 1, zf = doorZ;
    const bays = [];
    for (let k = -h; k <= h; k++) { const x = doorX + 2 * k; if (!cells.has(`${x},${zf - 1}`) && !cells.has(`${x},${zf - 3}`)) bays.push(x); }
    if (bays.length) {
      // posts 2.3 m tall, a beam on them, and a low roof from 2.5 m at the front up to 3.5 m at the wall
      const postAt = new Set();
      for (const x of bays) { b.put(K.floor, x, F, zf - 1); postAt.add(x - 1); postAt.add(x + 1); }
      const taken = new Set(verts.map(([vx, vz]) => `${vx},${vz}`));
      for (const x of postAt) {
        if (taken.has(`${x},${zf - 2}`)) continue; // a wing's corner post already stands here
        if (F > 0.01) posts(b, K, x, zf - 2, F);
        b.put(framePole(K, C), x, F + 1, zf - 2);
        b.put(K.pole1, x, F + 1.8, zf - 2);
      }
      for (const x of bays) { b.put(K.beam, x, F + 2.4, zf - 2, 0); b.put(K.roof26, x, F + 2.5, zf - 1, 180); }
    }
  }

  // a way up to a raised door: a landing and a stair from the ground (2 m up), a stair at the front of a deck, or a
  // stair set half in the ground in front of a door 1 m up
  const porchBuilt = b.pieces.some(p => p.name === K.floor && Math.abs(p.z - (doorZ - 1)) < 0.01 && Math.abs(p.x - doorX) < 0.01 && Math.abs(p.y - F) < 0.01);
  // a stone course is thick: the stair stops at its outer face
  // steps of stone up to a door on a stone footing (Black Forest on, once stone is built)
  if (stoneBase && K.stoneStair && !early && F >= 0.9 && !podklet) b.stairName = K.stoneStair;
  const lip = F >= 0.9 && stoneBase && !podklet && !C.stilts && !T.raised && !C.raised && form !== 'raised' && K.plinth ? P.piece(K.plinth).size[2] / 2 : 0;
  if (F >= 0.9 && door.out[1] < 0 && !T.dock) {
    if (deck && !C.boardwalk) {
      const zEdge = Math.min(...[...floorCells.values()].filter(([x]) => Math.abs(x - doorX) < 0.01).map(([, z]) => z)) - 1;
      stairUp(b, K, doorX, zEdge, F);
    } else if (!C.boardwalk) {
      if (F >= 1.99) {
        if (!porchBuilt) b.put(K.floor, doorX, F, doorZ - 1);
        for (const x of [doorX - 1, doorX + 1]) posts(b, K, x, doorZ - 2, F);
        stairUp(b, K, doorX, doorZ - 2, F);
      } else stairUp(b, K, doorX, porchBuilt ? doorZ - 2 : doorZ - lip, F);
    }
  }
  // the back door of a hall with doors on both long sides
  if (backDoor && F >= 0.9 && F <= 2.01 && !deck) for (let k = 0; k < Math.round(F); k++) b.put(K.stair || 'wood_stair', backDoor.x, F - (k + 1), backDoor.z + 1 + lip + 2 * k, 0);
  // a door in a gable end (sunken huts) on raised ground
  if (F >= 0.9 && F < 1.99 && door.out[0] !== 0) stairUpX(b, K, door.x, doorZ, F, door.out[0]);
  if (C.boardwalk && door.out[1] < 0 && !T.dock) {
    // the walkway starts past any deck in front of the door, so its stair is in the open
    const deckFront = deck ? Math.min(doorZ, ...[...floorCells.entries()].filter(([k, [x]]) => !cells.has(k) && Math.abs(x - doorX) < 2.9).map(([, [, z]]) => z - 1)) : doorZ;
    boardwalk(b, K, doorX, deckFront, Math.max(F, 0), { s1: 4, s2: 6, s3: 8 }[stage]);
    b.notes.push('Timber walkway out from the door; lay it over wet ground or water.');
  }

  // desert houses: a well in the yard of a U plan, a tall stone tower at a back corner of large ones
  if (cultureKey === 'middle-eastern' && !T.tower && plan !== 'court') {
    if (plan === 'U') {
      // pave the yard between the wings
      const zmin = wings[1].cz - wings[1].W;
      const pave = K.stoneFloor || K.floor;
      for (let x = -W + 1; x < W; x += 2) for (let z = zmin + 1; z < -D; z += 2)
        if (!cells.has(`${x},${z}`)) b.put(pave, x, 0, z);
      const yz = Math.round((zmin - D) / 2);
      const well = new Build(); wellDesign(well, K, biome, 's1');
      const lift = thickFloor(pave) ? 0.5 : 0; // on top of the paving
      for (const p of well.pieces) b.put(p.name, p.x, p.y + lift, p.z + yz, p.yaw);
    }
    if ((stage === 's3' && type === 'home') || type === 'temple') {
      stoneTowerAt(b, K, W + 1, D - 1, top + 6, F);
      b.notes.push('Tall stone tower at a back corner, after the desert style.');
    }
  }
  if (plan === 'court') {
    const yard = Q - 2 * wingOpts.dW, pave = K.stoneFloor || K.floor;
    for (let x = -yard + 1; x < yard; x += 2) for (let z = -yard + 1; z < yard; z += 2) b.put(pave, x, 0, z);
    const well = new Build(); wellDesign(well, K, biome, 's1');
    const lift = thickFloor(pave) ? 0.5 : 0; // on top of the paving
    for (const p of well.pieces) b.put(p.name, p.x, p.y + lift, p.z, p.yaw);
    if (stage === 's3' && type !== 'home') {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) stoneTowerAt(b, K, sx * (Q + 1), sz * (Q + 1), top + 2, 0, true);
      b.notes.push('Corner towers, after the caravanserais.');
    }
  }

  // forms that add to the shell
  if (domeCfg) {
    const ap = domeCfg.side / 2 / Math.tan(Math.PI / 8);
    if (form === 'dome') {
      // four columns at the corners of the middle bay carry the ceiling the drum stands on
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) column(b, K, sx * 2, sz * 2, F, top);
    }
    const ceiling = [...cells.values()].filter(([x, z]) => Math.abs(x) < ap + 1 && Math.abs(z) < ap + 1 && !(Math.abs(x) < 1.01 && Math.abs(z) < 1.01));
    const capY = capOf(wings[0], top, r);
    const h = Math.max(2, Math.ceil(capY - top) + (form === 'drum' ? 3 : 2));
    domeOn(b, K, C, { x: 0, z: 0, side: domeCfg.side, y: top, h, ceiling, cone: form === 'drum' });
    b.notes.push(form === 'dome' ? 'Dome on a drum over the crossing, stepped from vanilla roof rings.' : 'Drum with a cone over the middle of the hall.');
  }
  if (form === 'stave') {
    skirtRoof(b, K, edges, F + Math.min(3, SH - 1));
    b.notes.push('Low gallery roof all round on posts, after the stave churches.');
  }
  if (form === 'keep' && stoneOK) {
    // flat buttresses at the middle of each side, the full height of the walls
    for (const e of edges) {
      const mid = e.yaw === 0 ? Math.abs(e.x) < 1.01 : Math.abs(e.z) < 1.01;
      if (!mid || e === door) continue;
      for (let y = 0.5; y < top; y += 1) b.put(K.stoneBlock || 'stone_wall_1x1', e.x + e.out[0], y, e.z + e.out[1], e.yaw);
    }
    b.notes.push('Stone keep with flat buttresses and a parapet; Norman keeps often had their door on the first floor.');
  }
  if (svanTower) {
    const houseTop = top;
    towerAt(b, K, C, { cx: svanTower.cx, cz: svanTower.cz, n: 3, F, storeys: stage === 's3' ? 5 : 4, SH: 3, door: 'right', use: 'guard',
      skip: (e, y0, sh) => e.out[1] < 0 && y0 + sh <= houseTop + 0.01 });
    b.notes.push('Tall square tower at a back corner of the house.');
  }

  // awnings over the front of each wing, never out over a yard
  // an awning over each outside door only (a row of them along the front stuck out too far, T-102)
  if (C.awnings) for (const e of [door, backDoor].filter(e => e && e.out[1] < 0)) b.put(K.roof26, e.x, F + SH - 0.5, e.z - 1, 180); // 2.5 m up at its edge
  if (T.dock) dockDesign(b, K, W, D, F, stage);
  // the field starts past the walkway and the stairs (each stair takes 2 m for every metre of height)
  const stairRun = F >= 0.9 ? 2 * Math.round(Math.min(F, 2)) : 0;
  if (T.field) fieldDesign(b, K, W, D + (C.boardwalk ? { s1: 4, s2: 6, s3: 8 }[stage] + Math.max(2, stairRun) : stairRun), biome, stage, R, doorX);
  if (T.pen) penDesign(b, K, Math.max(...[...cells.values()].map(c => c[0])) + 1, D, stage); // beside the last wing
  if (roofKind === 'gable' && plan !== 'gables' && ((C.dragons && ['longhouse', 'temple', 'tavern'].includes(type)) || (C.carved && stage !== 's1')))
    for (const sx of [-1, 1]) b.put('wood_dragon1', sx * (W + 0.6), roofTop + r * (D - 1) / 2 + 0.3, 0, sx > 0 ? 90 : 270);

  b.outer = edges;
  if (!flat || plan === 'court' || true) Details.exterior(b, dctx);
  clearDoorways(b);
  // the fire's place for the decorator: under the ridge vent, or a cell of a flat roof (a chimney goes up from it),
  // clear of the ladders
  let fireAt = ventAt && lit && flue ? { x: avg(rectXs(flue)), z: avg(rectZs(flue)) } : null;
  if (flatCell) { fireAt = { x: flatCell[0], z: flatCell[1] }; b.vents.push({ kind: 'flat', x: flatCell[0], z: flatCell[1], rect: flue, from: storeys > 1 ? F + SH : top }); }
  if (!req.skipDecor) Decor.decorate(b, { use: T.use, decor, biome, type, R, culture: cultureKey, doorX: b.doorX, fireAt });
  settle(b, { K, C, biome, use: T.use, type, stoneOK, F, SH, storeys, top, flat, cells, wing: w0, roofTop, skipDecor: !!req.skipDecor });
  if (!req.skipDecor) Details.interior(b, { ...dctx, zones: keepClear(b) });
  return finish(b, info);
}

// Before furnishing: roof, eave and beam pieces in a doorway or in the 2.3 m a person needs in front of and behind it
// come out (an eave cut back over the door, the way thatch is cut over a door).
function clearDoorways(b) {
  const Ck = checksLib();
  for (let round = 0; round < 2; round++) {
    const boxes = b.pieces.map(Ck.aabb), near = Ck.index(boxes), drop = new Set();
    b.pieces.forEach((p, i) => {
      if (boxes[i].info.role !== 'door') return;
      for (const j of Ck.doorBlockers(P.doorOpening(p), b.pieces, boxes, near, k => k === i)) {
        const role = boxes[j].info.role;
        if (['roof', 'roofTop', 'roofCorner'].includes(role) || (role === 'beam' && boxes[j].info.shape === 'box')) drop.add(j);
      }
    });
    if (!drop.size) break;
    b.pieces = b.pieces.filter((p, i) => !drop.has(i));
    if (round === 0) b.notes.push('Eaves cut back over the door.');
  }
}

// Boxes [x0, x1, y0, y1, z0, z1] that furniture must stay out of: doorways and the metre either side, ladders with
// their feet and landings, chimneys.
function keepClear(b) {
  const zones = [];
  for (const p of b.pieces) {
    const info = P.piece(p.name);
    if (info.role === 'door') {
      const o = P.doorOpening(p), ex = Math.abs(o.ux) * 0.9 + Math.abs(o.nx) * 1.2, ez = Math.abs(o.uz) * 0.9 + Math.abs(o.nz) * 1.2;
      zones.push({ x0: o.x - ex, x1: o.x + ex, y0: o.y - 0.2, y1: o.y + 2.3, z0: o.z - ez, z1: o.z + ez });
    }
    const c = info.role === 'stair' && P.climbSpec(p.name);
    if (c) {
      const a = (p.yaw || 0) * Math.PI / 180, dx = -Math.sin(a), dz = -Math.cos(a);
      // the piece itself and a metre and a half before its foot, a metre wide either side of its line
      const xs = [p.x - dx * 2.5, p.x + dx * 1.2], zs = [p.z - dz * 2.5, p.z + dz * 1.2];
      zones.push({ x0: Math.min(...xs) - (dx ? 0 : 0.8), x1: Math.max(...xs) + (dx ? 0 : 0.8), y0: p.y + c.bottom - 0.1, y1: p.y + c.bottom + c.rise + 1.9,
        z0: Math.min(...zs) - (dz ? 0 : 0.8), z1: Math.max(...zs) + (dz ? 0 : 0.8) });
    }
  }
  for (const room of b.rooms) for (const k of room.keep || []) zones.push({ x0: k.x0, x1: k.x1, y0: room.y - 0.1, y1: room.y + 2.3, z0: k.z0, z1: k.z1 });
  for (const v of b.vents) if (v.rect) zones.push({ x0: v.rect.x0, x1: v.rect.x1, y0: -1, y1: 999, z0: v.rect.z0, z1: v.rect.z1, flue: true });
  return zones;
}
const hits = (bx, z) => bx.x0 < z.x1 && bx.x1 > z.x0 && bx.y0 < z.y1 && bx.y1 > z.y0 && bx.z0 < z.z1 && bx.z1 > z.z0;

// After furnishing: furnishing the biome cannot make comes out; the fire goes under the smoke hole, with a chimney
// over it where the culture builds one (or the ridge closed again when no fire was laid); ceiling braziers hang from
// the ceiling in the middle of their room; woodpiles go outside; nothing stays in a doorway, on a ladder or in a
// chimney.
function settle(b, ctx) {
  const Ck = checksLib(), ord = P.BIOME_ORDER, limit = ord.indexOf(ctx.biome);
  b.pieces = b.pieces.filter(p => !p.decor || ord.indexOf(P.needs(p.name)) <= limit);

  const isFire = p => p.decor && /^(fire_pit|hearth)$/.test(p.name);
  const ground = b.rooms.filter(r => !r.upper);
  const mainRoom = ground.find(r => r.main) || ground[0];
  let fire = b.pieces.find(p => isFire(p) && mainRoom && Math.abs(p.y - mainRoom.y - 0.1) < 0.6);
  const ridge = b.vents.find(v => v.kind === 'ridge'), crown = b.vents.find(v => v.kind === 'crown');
  const laysFire = ['home', 'hall'].includes(ctx.use);
  const flatVent = b.vents.find(v => v.kind === 'flat');
  if (!fire && laysFire && !ctx.skipDecor && mainRoom && (ridge || crown || flatVent)) {
    // the decorator found no room for the fire: lay it in the fire's place anyway
    const name = ctx.use === 'hall' && ord.indexOf('Black Forest') <= limit ? 'hearth' : 'fire_pit';
    const v = ridge || crown || flatVent;
    b.pieces.push({ name, x: v.x, y: mainRoom.y + 0.1, z: v.z, q: quat(0), yaw: 0, decor: true });
    fire = b.pieces[b.pieces.length - 1];
  }
  const target = ridge || crown || flatVent;
  if (flatVent && !fire) flatVent.rect = null; // no fire, no chimney
  if (fire && target) {
    // a hearth is 3 m across: in a small room a fire pit takes its place
    if (fire.name === 'hearth' && mainRoom && (mainRoom.x1 - mainRoom.x0) * (mainRoom.z1 - mainRoom.z0) < 40) fire.name = 'fire_pit';
    const dx = target.x - fire.x, dz = target.z - fire.z, ox = fire.x, oz = fire.z;
    const moving = b.pieces.filter(p => p.decor && (p === fire || (/cookingstation/.test(p.name) && Math.hypot(p.x - ox, p.z - oz) < 0.4)));
    for (const p of moving) { p.x = +(p.x + dx).toFixed(3); p.z = +(p.z + dz).toFixed(3); }
    // whatever now stands where the fire went comes out
    const fb = Ck.aabb(fire), pad = 0.4;
    b.pieces = b.pieces.filter(p => {
      if (!p.decor || p === fire || /cookingstation/.test(p.name)) return true;
      const o = Ck.aabb(p);
      return !(o.x0 < fb.x1 + pad && o.x1 > fb.x0 - pad && o.z0 < fb.z1 + pad && o.z1 > fb.z0 - pad && Math.abs(p.y - fire.y) < 1);
    });
    if (target.kind !== 'crown') chimney(b, ctx, target);
    else b.notes.push('Fire under the open crown of the roof.');
  }
  if (ridge && !(fire && target === ridge)) {
    for (const c of ridge.caps) b.put(c.name, c.x, c.y, c.z, c.yaw); // no fire: the ridge is closed again
    ridge.rect = null;
  }

  hangBraziers(b, ctx, fire);
  woodpilesOutside(b);

  // the same furnishing twice in one spot once only
  const seen = new Set();
  b.pieces = b.pieces.filter(p => {
    if (!p.decor) return true;
    const k = `${p.name}|${p.x.toFixed(1)}|${p.y.toFixed(1)}|${p.z.toFixed(1)}|${Math.round(p.yaw || 0)}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });

  // nothing in a doorway, on a ladder or its foot, or in a chimney
  const zones = keepClear(b), gone = [];
  if (!ctx.skipDecor && ['home', 'longhouse'].includes(ctx.type)) bedIfNone(b, ctx, fire, zones);
  b.pieces = b.pieces.filter(p => {
    if (!p.decor || p === fire || /cookingstation/.test(p.name) && fire && Math.hypot(p.x - fire.x, p.z - fire.z) < 0.4) return true;
    const bx = Ck.aabb(p);
    if (!zones.some(z => hits(bx, z))) return true;
    gone.push(bx); return false;
  });
  // and whatever stood on a table or bench that came out
  if (gone.length) b.pieces = b.pieces.filter(p => {
    if (!p.decor) return true;
    const bx = Ck.aabb(p);
    return !gone.some(g => bx.y0 >= g.y0 + 0.3 && bx.y0 <= g.y1 + 0.2 && p.x > g.x0 && p.x < g.x1 && p.z > g.z0 && p.z < g.z1);
  });
}

// A chimney over the fire: through any floor above it and out of the roof, of stone where the culture may build in
// stone, else a box of planks with a raised cap on short posts (a smoke louver).
function chimney(b, ctx, v) {
  const { K, stoneOK } = ctx, r = v.rect;
  // always planks: a stone stack would stand on the wooden roof or upper floor, and Valheim's stone takes no support
  // from wood, so it would fall (T-102)
  const stone = false;
  void stoneOK;
  const piece = stone ? K.stoneWall : K.wallHalf, course = stone && /2x2/.test(K.stoneWall) ? 2 : 1;
  const yRoof = v.kind === 'ridge' ? v.y : ctx.top; // the ridge, or the flat roof
  const yTop = yRoof + (stone ? 2 : 1);
  // floors above the fire inside the chimney's footprint come out (the upper floors and a flat roof)
  b.pieces = b.pieces.filter(p => !(P.piece(p.name).role === 'floor' && !p.decor && p.y > ctx.F + 0.5 && inRect(r, p.x, p.z)));
  const sides = [];
  for (let x = r.x0 + 1; x < r.x1; x += 2) { sides.push([x, r.z0, 0]); sides.push([x, r.z1, 0]); }
  for (let z = r.z0 + 1; z < r.z1; z += 2) { sides.push([r.x0, z, 90]); sides.push([r.x1, z, 90]); }
  for (let y = v.from; y < yTop - 0.01; y += course) for (const [x, z, yaw] of sides) b.put(piece, x, y + course / 2, z, yaw);
  if (!stone) {
    // the cap: short posts at the corners, the ridge caps (or flat roof caps) half a metre over the box
    const cap = v.caps ? v.caps : null;
    for (const [x, z] of [[r.x0, r.z0], [r.x0, r.z1], [r.x1, r.z0], [r.x1, r.z1]]) b.put(K.pole1, x, yTop, z);
    if (cap) for (const c of cap) b.put(c.name, c.x, yTop + 0.5, c.z, c.yaw);
    else for (let x = r.x0 + 1; x < r.x1; x += 2) for (let z = r.z0 + 1; z < r.z1; z += 2) b.put(K.floor, x, yTop + 0.55, z);
  }
  b.notes.push(stone ? 'Stone chimney over the fire.' : 'Plank chimney over the fire with a raised cap for the smoke.');
}

// Ceiling braziers hang on their chain (the pivot 1.6 m below what it hangs from) from the lowest roof or ceiling piece
// over the middle of their room, away from the fire; where the room is too low for the bowl to clear a person's head
// they stand as a torch instead. One the decorator hung well (high enough, clear of the walls) stays where it is.
function hangBraziers(b, ctx, fire) {
  const Ck = checksLib();
  const list = b.pieces.filter(p => p.decor && /brazierceiling/.test(p.name));
  if (!list.length) return;
  const structure = b.pieces.filter(p => !p.decor);
  const used = [];
  for (const br of list) {
    const room = b.rooms.filter(r => br.x >= r.x0 - 0.5 && br.x <= r.x1 + 0.5 && br.z >= r.z0 - 0.5 && br.z <= r.z1 + 0.5 && br.y >= r.y - 0.2)
      .sort((a, c) => c.y - a.y)[0];
    if (!room) continue;
    if (br.y >= room.y + 2.3 && Math.min(br.x - room.x0, room.x1 - br.x, br.z - room.z0, room.z1 - br.z) > 1.4 && !(fire && Math.hypot(fire.x - br.x, fire.z - br.z) < 1.5)) { used.push([br.x, br.z]); continue; }
    const cx = (room.x0 + room.x1) / 2, cz = (room.z0 + room.z1) / 2, longX = room.x1 - room.x0 >= room.z1 - room.z0;
    const L = longX ? room.x1 - room.x0 : room.z1 - room.z0;
    const spots = [0, -L / 4, L / 4, -L / 8, L / 8].map(t => (longX ? [cx + t, cz] : [cx, cz + t]));
    let placed = false;
    for (const [x, z] of spots) {
      if (used.some(([ux, uz]) => Math.hypot(ux - x, uz - z) < 2)) continue;
      if (fire && Math.hypot(fire.x - x, fire.z - z) < 2) continue;
      if (b.vents.some(v => v.rect && inRect(v.rect, x, z, 0.5))) continue;
      let ceil = Infinity;
      for (const p of structure) {
        let u = Ck.underside(p, x, z);
        if (u == null) {
          // anything else solid right over the spot: the block on top of a dome, a beam
          const bx = Ck.aabb(p);
          if (['wall', 'beam'].includes(bx.info.role) && x > bx.x0 && x < bx.x1 && z > bx.z0 && z < bx.z1) u = bx.y0;
        }
        if (u != null && u > room.y + 0.5 && u < ceil) ceil = u;
      }
      if (!isFinite(ceil) || ceil - 1.6 < room.y + 2.3) continue;
      br.x = +x.toFixed(3); br.z = +z.toFixed(3); br.y = +(ceil - 1.6).toFixed(3); br.yaw = 0; br.q = quat(0);
      used.push([x, z]); placed = true; break;
    }
    if (!placed) { br.name = reaches(ctx.biome, 'Swamp') ? 'piece_groundtorch' : 'piece_groundtorch_wood'; br.y = room.y + 0.85; br.toWall = true; } // a floor torch's pivot is 0.75 m up
  }
  // standing torches put back against the wall they were hung on, a little out from it
  for (const br of list) if (br.toWall) {
    const room = b.rooms.find(r => br.x >= r.x0 - 0.5 && br.x <= r.x1 + 0.5 && br.z >= r.z0 - 0.5 && br.z <= r.z1 + 0.5);
    if (room) { const cx = (room.x0 + room.x1) / 2, cz = (room.z0 + room.z1) / 2, d = Math.hypot(cx - br.x, cz - br.z) || 1; br.x = +(br.x + (cx - br.x) / d * 0.5).toFixed(3); br.z = +(br.z + (cz - br.z) / d * 0.5).toFixed(3); }
    delete br.toWall;
  }
}

// Every house and longhouse sleeps someone (Tyler, T-102). When the furnishing left a building without a bed, one
// goes against a wall: the best bed the biome can make, its head to the wall, clear of doors, ladders, the fire and
// everything else. Ground rooms first, then upper ones.
function bedIfNone(b, ctx, fire, zones) {
  const Ck = checksLib(), ord = P.BIOME_ORDER, limit = ord.indexOf(ctx.biome);
  const fits = n => ord.indexOf(P.needs(n)) <= limit;
  if (b.pieces.some(p => P.piece(p.name).role === 'bed' && fits(p.name))) return;
  // the best bed first, the narrow wooden one where the best does not fit (between a hall's aisle posts); head to the
  // wall, else along the wall (a hall's side benches)
  const names = ['ashwood_bed', 'piece_bed02', 'bed'].filter(n => fits(n) && (n !== 'ashwood_bed' || ctx.biome === 'Ashlands'));
  const doors = b.pieces.filter(p => P.piece(p.name).role === 'door').map(p => P.doorOpening(p));
  const rooms = [...b.rooms].sort((a, c) => (a.upper ? 1 : 0) - (c.upper ? 1 : 0) || (c.main ? 1 : 0) - (a.main ? 1 : 0));
  // first round: only free floor; second: a table, bench or other furnishing (not the fire or its pot) makes room
  const movable = p => p.decor && !/^(fire_pit|hearth)$|cookingstation|cauldron/.test(p.name);
  for (const pass of [0, 1]) {
  const solid = b.pieces.filter(p => !['floor', 'rug'].includes(P.piece(p.name).role) && !(pass && movable(p))).map(p => Ck.aabb(p));
  for (const name of names.length ? names : ['bed']) for (const along of [false, true]) for (const r of rooms) {
    const [wid, , len] = P.piece(name).size, deep = along ? wid : len;
    const y = r.y + 0.1;
    const sides = [];
    for (let t = r.x0 + 1; t <= r.x1 - 1 + 0.001; t += 0.5) { sides.push([t, r.z0, 0, 1]); sides.push([t, r.z1, 0, -1]); }
    for (let t = r.z0 + 1; t <= r.z1 - 1 + 0.001; t += 0.5) { sides.push([r.x0, t, 1, 0]); sides.push([r.x1, t, -1, 0]); }
    for (const inset of [0.15, 0.55]) for (const [wx, wz, nx, nz] of sides) {
      const x = wx + nx * (inset + deep / 2), z = wz + nz * (inset + deep / 2);
      const yaw = norm(Math.atan2(nx, nz) * 180 / Math.PI + (along ? 90 : 0));
      const cand = { name, x: +x.toFixed(3), y: +y.toFixed(3), z: +z.toFixed(3), yaw, q: quat(yaw), decor: true };
      const cb = Ck.aabb(cand);
      if (cb.x0 < r.x0 || cb.x1 > r.x1 || cb.z0 < r.z0 || cb.z1 > r.z1) continue;
      if (doors.some(o => Math.hypot(o.x - x, o.z - z) < 2 + len / 2 && Math.abs(o.y - r.y) < 1)) continue;
      // the bed's nearest edge at least 1.4 m from the middle of the fire (a fire pit is 1.6 m across)
      if (fire && Math.abs(fire.y - y) < 1 && Math.hypot(Math.max(cb.x0 - fire.x, 0, fire.x - cb.x1), Math.max(cb.z0 - fire.z, 0, fire.z - cb.z1)) < (fire.name === 'hearth' ? 2 : 1.4)) continue;
      if (zones.some(zn => hits(cb, zn))) continue;
      if (solid.some(o => o.x0 < cb.x1 && o.x1 > cb.x0 && o.z0 < cb.z1 && o.z1 > cb.z0 && o.y0 < cb.y1 - 0.05 && o.y1 > cb.y0 + 0.05)) continue;
      // furnishing in the bed's place (and anything standing on it) goes
      if (pass) b.pieces = b.pieces.filter(p => { if (!movable(p)) return true; const o = Ck.aabb(p); return !(o.x0 < cb.x1 + 0.1 && o.x1 > cb.x0 - 0.1 && o.z0 < cb.z1 + 0.1 && o.z1 > cb.z0 - 0.1 && o.y0 < cb.y1 + 1 && o.y1 > cb.y0); });
      b.pieces.push(cand);
      return;
    }
  }
  }
  b.notes.push('No room for a bed: this building needs a larger plan.');
}

// Woodpiles stand outside, against an outside wall away from the doors; where there is no free spot they are left out.
function woodpilesOutside(b) {
  const Ck = checksLib();
  const piles = b.pieces.filter(p => p.decor && /^wood_(fine_|core_)?stack$/.test(p.name));
  if (!piles.length) return;
  const insideAny = p => b.rooms.some(r => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1 && p.y >= r.y - 0.3 && p.y < r.y + (r.h || 3));
  const doors = b.pieces.filter(p => P.piece(p.name).role === 'door').map(p => P.doorOpening(p));
  const ground = b.rooms.filter(r => !r.upper);
  if (!ground.length) return;
  // spots along the outside of the ground rooms, 0.9 m out from the wall, on the ground
  const spots = [];
  if (b.outer) for (const e of b.outer) spots.push({ x: e.x + e.out[0] * 0.9, z: e.z + e.out[1] * 0.9, yaw: e.yaw });
  else for (const r of ground) {
    for (let x = r.x0 + 1; x < r.x1; x += 2) { spots.push({ x, z: r.z0 - 0.9, yaw: 0 }); spots.push({ x, z: r.z1 + 0.9, yaw: 0 }); }
    for (let z = r.z0 + 1; z < r.z1; z += 2) { spots.push({ x: r.x0 - 0.9, z, yaw: 90 }); spots.push({ x: r.x1 + 0.9, z, yaw: 90 }); }
  }
  for (const pile of piles) {
    if (!insideAny(pile)) continue;
    let moved = false;
    for (const s of spots) {
      if (s.taken || doors.some(o => Math.hypot(o.x - s.x, o.z - s.z) < 2.6)) continue;
      const cand = { ...pile, x: +s.x.toFixed(3), y: 0, z: +s.z.toFixed(3), yaw: s.yaw, q: quat(s.yaw) };
      const cb = Ck.aabb(cand);
      const clash = b.pieces.some(p => p !== pile && P.piece(p.name).role !== 'floor' && hits(cb, Ck.aabb(p)));
      if (clash) continue;
      Object.assign(pile, cand); s.taken = true; moved = true; break;
    }
    if (!moved) pile.gone = true;
  }
  b.pieces = b.pieces.filter(p => !p.gone);
}

// Pieces the biome cannot make yet, swapped for the nearest it can, or left out (props the generator sets itself:
// barrels by wells and pens, benches round a camp fire).
const STAND_IN = { piece_chest_barrel: 'piece_chest_wood', piece_logbench01: 'piece_bench01', piece_groundtorch: 'piece_groundtorch_wood',
  piece_chest: 'piece_chest_wood', piece_cookingstation_iron: 'piece_cookingstation', hearth: 'fire_pit' };
function biomeSafe(b, biome) {
  const ord = P.BIOME_ORDER, limit = ord.indexOf(biome), fits = n => ord.indexOf(P.needs(n)) <= limit;
  b.pieces = b.pieces.filter(p => {
    if (fits(p.name) || P.piece(p.name).structural) return true;
    const alt = STAND_IN[p.name];
    if (alt && fits(alt)) { p.name = alt; return true; }
    return false;
  });
}

function finish(b, info) {
  biomeSafe(b, info.biome);
  // the generator places walls by their middle; the pieces that stand on their pivot go down to their foot
  for (const p of b.pieces) { const pi = P.piece(p.name); if (pi.onPivot && !p.decor && !p.footed) { p.y = +(p.y - pi.size[1] / 2).toFixed(3); p.footed = true; } }
  const name = `${info.type}_${info.biome.replace(' ', '')}_${info.cultureKey}_${info.plan || 'x'}-${info.roof || 'x'}-${info.walls || 'x'}${info.asked || ''}_${info.stage}${info.decor}_${info.seed}`;
  return {
    ground: 0,
    meta: { Name: name, Creator: 'Villheim generator', Category: 'Villheim generated',
      Description: `${S.TYPES[info.type].label}, ${info.biome}, ${S.CULTURES[info.cultureKey].label}, ${info.plan || ''} plan, ${info.roof || ''} roof, ${info.walls || ''} walls, ${info.stage}${info.decor}, seed ${info.seed}` },
    pieces: b.pieces, rooms: b.rooms, notes: [...new Set(b.notes)], request: info,
  };
}

// ---------------------------------------------------------------- small helpers

const avg = a => a.reduce((t, v) => t + v, 0) / a.length;
// 1 m floors (stone, black marble) pivot in their middle
const thickFloor = n => !!n && P.piece(n).size[1] >= 0.9;
// rectangles are { x0, x1, z0, z1 } in world metres
const rectXs = r => [r.x0, r.x1], rectZs = r => [r.z0, r.z1];
const cellRect = c => ({ x0: c[0] - 1, x1: c[0] + 1, z0: c[1] - 1, z1: c[1] + 1 });
const inRect = (r, x, z, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
function rectOf(caps) {
  return { x0: Math.min(...caps.map(c => c.x)) - 1, x1: Math.max(...caps.map(c => c.x)) + 1, z0: Math.min(...caps.map(c => c.z)) - 1, z1: Math.max(...caps.map(c => c.z)) + 1 };
}
// a stone-like piece whose top meets the bottom of a course of height h centred at p
function stoneUnder(b, p, h) {
  const bottom = p.y - h / 2;
  return b.pieces.some(q => Math.abs(q.x - p.x) < 0.05 && Math.abs(q.z - p.z) < 0.05 && P.supportClass(q.name) !== 'wood' && P.supportClass(q.name) !== 'hardwood' &&
    Math.abs(q.y + P.piece(q.name).size[1] / 2 - bottom) < 0.05);
}
// a world point's place along a wing's ridge
function ridgeU(w, pt) { const a = w.alpha * Math.PI / 180; return (pt.x - w.cx) * Math.cos(a) - (pt.z - w.cz) * Math.sin(a); }
// The chimney's footprint: the ridge caps within a metre of the vent (caps sit every 2 m from -maxU to maxU), the
// width of one cap across the ridge.
function flueRect(w, vent, maxU) {
  const uv = ridgeU(w, vent), us = [];
  for (let u = -maxU; u <= maxU + 0.01; u += 2) if (Math.abs(u - uv) < 1.01) us.push(u);
  if (!us.length) return null;
  const pts = us.map(u => toWorld(w, u, 0, 0)).map(([x, z]) => ({ x, z }));
  return rectOf(pts);
}

// Posts from a metre down in the ground up to height F: a 2 m post standing half in the ground, then 2 m and 1 m
// lengths. The game sets a design's lowest pivot on the ground, so posts set in the ground keep a raised house at the
// height it was drawn.
function posts(b, K, x, z, F, pole) {
  b.put(pole || K.pole, x, 0, z);
  for (let y = 1; y < F - 0.01;) { const h = F - y >= 2 ? 2 : 1; b.put(h === 2 ? (pole || K.pole) : K.pole1, x, y + h / 2, z); y += h; }
}

// A door piece in a 2 m wall bay whose middle is (x, z) at floor height y0, the wall turned 'yaw'. Uses the door's
// measured pivot, its turn against the wall and its side offset (pieces.js DOORS). Returns the opening's height.
function putDoor(b, name, x, y0, z, yaw) {
  const sp = P.doorSpec(name), a = (yaw + (sp.along === 'z' ? 90 : 0)) * Math.PI / 180;
  b.put(name, x - Math.cos(a) * sp.offset, y0 - sp.bottom, z + Math.sin(a) * sp.offset, yaw + (sp.along === 'z' ? 90 : 0));
  return sp.h;
}

// Where ladders go. Each ladder needs three 2 m cells in a row: its foot (clear floor below), the hole it climbs
// through, and a landing above. Cells along an outside wall come first, away from the door and the fire. The ladder
// to the next storey starts from the landing of the one before when it can (round a tower's walls). n ladders; fewer
// when the plan has no room.
function ladderPlan(cells, n, o = {}) {
  const has = (x, z) => cells.has(`${x},${z}`);
  const same = (a, c) => a && c && a[0] === c[0] && a[1] === c[1];
  const near = (a, c, r) => a && c && Math.abs(a[0] - c[0]) <= r && Math.abs(a[1] - c[1]) <= r;
  const all = [];
  for (const [, [x, z]] of cells) for (const [dx, dz] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
    const stand = [x - 2 * dx, z - 2 * dz], land = [x + 2 * dx, z + 2 * dz];
    if (!has(...stand) || !has(...land)) continue;
    if (o.flue && [stand, [x, z], land].some(c => inRect(o.flue, c[0], c[1]))) continue;
    const wallSide = !has(x + 2 * dz, z + 2 * dx) || !has(x - 2 * dz, z - 2 * dx);
    all.push({ hole: [x, z], dir: [dx, dz], stand, land, wallSide });
  }
  const out = [];
  for (let k = 0; k < n; k++) {
    const prev = out[k - 1];
    let best = null, bestScore = -Infinity;
    for (const L of all) {
      if (prev && (same(L.hole, prev.hole) || same(L.stand, prev.hole) || same(L.land, prev.hole))) continue;
      if (k === 0 && [o.door, o.back].some(d => d && (near(L.stand, d, 0) || near(L.hole, d, 0)))) continue;
      let score = (L.wallSide ? 10 : 0);
      if (prev && same(L.stand, prev.land)) score += 30;
      if (k === 0 && o.door) score += Math.min(8, Math.hypot(L.hole[0] - o.door[0], L.hole[1] - o.door[1]));
      if (score > bestScore + 1e-9) { best = L; bestScore = score; }
    }
    if (!best) break;
    out.push(best);
  }
  return out;
}

// Ladder pieces for one plan entry, from the floor at yLow up 'rise' metres. A wood_stepladder climbs 2 m over 2 m
// from its pivot at its foot. The foot stands at the near edge of the hole, so the cell before it is all clear floor;
// for a 3 m storey the climb ends in the middle of the landing cell, whose near half stays open and whose far half
// gets two 1 m floor pieces (cutLanding).
function ladderFoot(rise) { return Math.min(-1, 2 - rise); }
function putLadder(b, K, L, yLow, rise) {
  const [dx, dz] = L.dir, yaw = norm(Math.atan2(-dx, -dz) * 180 / Math.PI), f = ladderFoot(rise);
  const ks = [];
  for (let k = 0; k < rise - 2 + 0.001; k += 2) ks.push(k);
  if (!ks.length || Math.abs(ks[ks.length - 1] - (rise - 2)) > 0.01) ks.push(Math.max(0, rise - 2));
  for (const k of ks) {
    const t = f + 1 + k; // the piece's middle, metres from the hole's middle toward the landing
    b.put(K.ladder, L.hole[0] + dx * t, yLow + k, L.hole[1] + dz * t, yaw);
  }
  if (cutLanding(rise)) {
    // the far half of the landing cell
    const [lx, lz] = L.land, px = -dz, pz = dx;
    for (const s of [-0.5, 0.5]) b.put(K.floor1 || 'wood_floor_1x1', lx + dx * 0.5 + px * s, yLow + rise, lz + dz * 0.5 + pz * s);
  }
}
const cutLanding = rise => ladderFoot(rise) + rise > 1.01;
// cells a floor leaves out for a ladder: the hole, and the landing cell when its near half is open
const onLadder = (L, x, z, rise) => !!L && ((x === L.hole[0] && z === L.hole[1]) || (cutLanding(rise) && x === L.land[0] && z === L.land[1]));

// ---------------------------------------------------------------- walls

// Dark wood takes tar, so dark frames start in the Plains.
function framePole(K, C) { return C.darkFrame && reaches(C.biome || 'Meadows', 'Plains') ? 'darkwood_pole' : (K.pole || 'wood_pole2'); }

// Door piece: a hanging cloth door where the culture uses one and red jute is in reach (Mountain on), else the wooden
// door. A door must fit the wall: the cloth door and the wooden door fill a 2 m opening; never a gate taller than the
// wall (the dark wood gate is 4 m).
function doorPiece(K, C, SH) {
  const cloth = (C.clothDoor || C.arches) && reaches(C.biome || 'Meadows', 'Mountain') ? 'piece_cloth_hanging_door' : null;
  if (cloth && P.doorSpec(cloth).h <= SH + 0.01) return cloth;
  return P.doorSpec(K.door).h <= SH + 0.01 ? K.door : 'wood_door';
}

// One 2 m wall bay. Wall styles: plank, half-timber (plank with a 45 degree brace across the bay), log,
// stone, stone-base (a metre of stone, then plank), marble, grausten.
function wallSegment(b, K, C, x, y0, z, yaw, SH, kind, styleOverride) {
  const plank = K.floor === 'ashwood_floor_2x2' ? 'ashwood_wall_2x2' : 'woodwall';
  const stonePiece = K.stoneWall || 'stone_wall_2x1';
  // Stone cannot span an opening in Valheim (it loses all its support sideways) and takes no support from wood, so
  // over a door or window in a stone wall, and in that bay all the way up, the wall is of planks (a timber lintel).
  // Black marble and grausten can span one bay and stay.
  const bay = `${Math.round(x * 10)},${Math.round(z * 10)}`;
  b.woodBays = b.woodBays || new Set();
  const noSpan = P.support(stonePiece).h >= 0.99;
  let style = styleOverride || C.wallStyle || 'plank';
  if (noSpan && style === 'stone' && b.woodBays.has(bay)) style = 'plank';
  const stoneLike = ['stone', 'marble', 'grausten'].includes(style);
  // over an opening: planks where the stone cannot span it (stone), or where the metre left over would be a stone
  // course (2 m grausten courses leave a 1 m gap); a stone that cannot span also takes the bay above to planks
  const lintel = () => {
    if (!stoneLike) return;
    if (noSpan) b.woodBays.add(bay);
    if (noSpan || stoneCourse === 2) style = 'plank';
  };
  const stoneCourse = /2x2/.test(stonePiece) ? 2 : 1;
  const pieceFor = y => {
    if (style === 'stone' || style === 'marble' || style === 'grausten') return [stonePiece, stoneCourse];
    // the stone course is the ground storey's footing only; upper storeys are all planks (stone on planks would fall)
    if (style === 'stone-base' && y < y0 + 0.99 && y0 <= (C.baseTop != null ? C.baseTop : Infinity)) return [stoneCourse === 1 ? stonePiece : 'stone_wall_2x1', 1];
    if (style === 'log') return ['wood_wall_log', 0.5];
    return [plank, 2];
  };
  const fill = (from, to) => {
    let y = from;
    while (to - y > 0.01) {
      const left = to - y;
      const [main, course] = pieceFor(y);
      if (course <= left + 0.01) { b.put(main, x, y + course / 2, z, yaw); y += course; }
      // a 1 m course in a wall of 2 m stone courses is stone too (a plank course there would leave the stone above it
      // standing on wood, which falls)
      else if (left >= 0.99 && main !== 'wood_wall_log') { b.put(course === 1 ? main : (main === stonePiece ? 'stone_wall_2x1' : K.wallHalf), x, y + 0.5, z, yaw); y += 1; }
      else { if (main === 'wood_wall_log') b.put(main, x, y + 0.25, z, yaw); else b.put(K.wallHalf, x, y + 0.5, z, yaw); y += 0.5; } // a half wall standing on the gap pokes 0.5 m up into the roof
    }
  };
  if (kind === 'door' || kind === 'gate') {
    let name = kind === 'gate' ? (K.gate || K.door) : doorPiece(K, C, SH);
    if (P.doorSpec(name).h > SH + 0.01) name = doorPiece(K, C, SH);
    const h = putDoor(b, name, x, y0, z, yaw);
    lintel();
    fill(y0 + h, y0 + SH); return;
  }
  if (kind === 'window' && SH >= 2) {
    fill(y0, y0 + 1);
    if (K.glass && C.glass) { const dx = Math.cos(yaw * Math.PI / 180) * 0.5, dz = -Math.sin(yaw * Math.PI / 180) * 0.5; b.put(K.glass, x - dx, y0 + 1.5, z - dz, yaw); b.put(K.glass, x + dx, y0 + 1.5, z + dz, yaw); }
    else if (!C.arches && !C.stoneWalls && C.windowStyle === 'single' && K.wallQuarter && !stoneLike) {
      // the light on the side toward the middle of the wall, the 1 m square wall piece in the other half
      const ux = Math.cos(yaw * Math.PI / 180), uz = -Math.sin(yaw * Math.PI / 180), side = (x * ux + z * uz) > 0 ? 1 : -1;
      b.put(K.wallQuarter, x + ux * side * 0.5, y0 + 1.5, z + uz * side * 0.5, yaw);
    }
    lintel();
    fill(y0 + 2, y0 + SH); return;
  }
  fill(y0, y0 + SH);
  if (style === 'half-timber' && SH >= 2) {
    const brace = (C.darkFrame && reaches(C.biome || 'Meadows', 'Plains')) || /darkwood/.test(K.beam || '') ? 'darkwood_beam_45' : 'wood_beam_45';
    const flip = Math.round(x + z) % 4 === 0 ? 180 : 0; // braces lean both ways along a wall
    b.put(brace, x, y0 + 1, z, yaw + flip);
  }
}

// A column from the floor to a ceiling: a stone block, then 2 m stone pillars (measured: the pillar stands on a 1 m
// block, its centre 1.5 m above the block's); black marble columns are 1 m tall and stack.
function column(b, K, x, z, y0, y1) {
  if (/blackmarble/.test(K.stoneWall || '')) { for (let y = y0; y < y1 - 0.01; y += 1) b.put('blackmarble_column_1', x, y + 0.5, z); return; }
  let y = y0;
  if ((y1 - y0) % 2 === 1) { b.put(K.stoneBlock || 'stone_wall_1x1', x, y + 0.5, z); y += 1; }
  for (; y < y1 - 0.01; y += 2) b.put(K.stonePillar || 'stone_pillar', x, y + 1, z);
}

// Arcade along the yard edges of a courtyard. Black marble: a column at every 2 m and an arch over each bay.
// Stone (measured in the corpus): a block, a 2 m pillar on it, a 2 m arch between pillars 3 m apart, its top level
// with the pillar tops; the run is centred on its side of the yard.
function arcadeAlong(b, K, edges, y0, SH) {
  const marble = /blackmarble/.test(K.stoneWall || '');
  const runs = new Map();
  for (const e of edges) {
    const key = e.yaw === 0 ? `z${e.z}` : `x${e.x}`;
    if (!runs.has(key)) runs.set(key, { yaw: e.yaw, fixed: e.yaw === 0 ? e.z : e.x, lo: Infinity, hi: -Infinity });
    const r = runs.get(key), t = e.yaw === 0 ? e.x : e.z;
    r.lo = Math.min(r.lo, t - 1); r.hi = Math.max(r.hi, t + 1);
  }
  const at = (r, t) => (r.yaw === 0 ? [t, r.fixed] : [r.fixed, t]);
  for (const r of runs.values()) {
    if (marble) {
      for (let t = r.lo; t <= r.hi + 0.01; t += 2) { const [x, z] = at(r, t); column(b, K, x, z, y0, y0 + SH - 2); }
      for (let t = r.lo + 1; t < r.hi; t += 2) { const [x, z] = at(r, t); b.put('blackmarble_arch', x, y0 + SH - 1, z, r.yaw); }
    } else if (K.stonePillar) {
      const n = Math.max(1, Math.floor((r.hi - r.lo) / 3)), mid = (r.lo + r.hi) / 2, start = mid - n * 1.5;
      for (let k = 0; k <= n; k++) { const [x, z] = at(r, start + 3 * k); column(b, K, x, z, y0, y0 + SH); }
      for (let k = 0; k < n; k++) { const [x, z] = at(r, start + 3 * k + 1.5); b.put(K.stoneArch || 'stone_arch', x, y0 + SH - 0.5, z, r.yaw); }
    } else {
      for (let t = r.lo; t <= r.hi + 0.01; t += 2) { const [x, z] = at(r, t); for (let y = y0; y < y0 + SH - 0.01; y += 1) b.put(K.pole1, x, y + 0.5, z); }
    }
  }
}

// ---------------------------------------------------------------- roofs

function capOf(w, top, r) { return top + r * (w.D - 1) / 2; }
// height of a wing's roof surface over a world point (for crossing wings)
function surfaceAt(w, x, z, top, r) {
  const a = w.alpha * Math.PI / 180, dx = x - w.cx, dz = z - w.cz;
  const v = Math.abs(dx * Math.sin(a) + dz * Math.cos(a));
  return capOf(w, top, r) - (r / 2) * Math.max(0, v - 1);
}

function gablePieces(K, C, w, top, r, ends, vent, dctx) {
  const roof = r === 2 ? K.roof45 : K.roof26, roofTop = r === 2 ? K.roofTop45 : K.roofTop26, gable = r === 2 ? K.gable45 : K.gable26;
  const capY = capOf(w, top, r), low = i => capY - r * (i + 1), pivot = i => low(i) + (r === 2 ? 1 : 0);
  // the last row ends on the wall (Tyler, T-102: roofs stuck out too far); only cultures with eaves 2 (fen houses,
  // sunken huts) carry a row past the wall down toward the ground
  const wallRow = (w.D - 3) / 2, rows = wallRow + ((C.eaves || 1) > 1 ? 1 : 0);
  const out = [], add = (name, u, y, v, yaw, role, surf) => { const [x, z, wy] = toWorld(w, u, v, yaw); out.push({ name, x, y, z, yaw: wy, role, surf, wing: w }); };
  const kick = C.kick && r === 2 && (C.eaves || 1) > 1;
  for (let u = -w.W + 1; u < w.W; u += 2) {
    for (let i = 0; i <= rows; i++) {
      const v = 2 + 2 * i, surf = low(i) + r / 2;
      if (kick && i === rows) { const y = low(i - 1) - 1; add(K.roof26, u, y, -v, 180, 'roof', y + 0.5); add(K.roof26, u, y, v, 0, 'roof', y + 0.5); continue; }
      add(roof, u, pivot(i), -v, 180, 'roof', surf); add(roof, u, pivot(i), v, 0, 'roof', surf);
    }
    add(roofTop, u, capY, 0, 0, 'cap', capY + 0.3);
    if (vent && Math.abs(u - ridgeU(w, vent)) < 1.01) out[out.length - 1].vent = true;
  }
  [-1, 1].forEach((sg, k) => {
    if (!ends[k]) return;
    const u = sg * w.W;
    // a window high in a tall gable lights the loft (a 2 m opening with a post in the middle, 1 m up the gable)
    const gw = dctx && dctx.profile.gableWindow && !C.stoneWalls && capY - top >= 3.9;
    if (gw) {
      add(K.wallHalf, u, top + 0.5, 0, 90, 'gable', top + 1);
      add(K.pole1 || 'wood_pole', u, top + 1.5, 0, 0, 'gable', top + 2);
      for (const yb of [top + 0.9, top + 2.1]) add(K.beam || 'wood_beam', u + Math.sign(u) * 0.2, yb, 0, 90, 'trim', yb + 0.1);
      gableFill(K, add, u, top + 2, 0, capY - top - 2, C.stoneWalls);
    } else gableFill(K, add, u, top, 0, capY - top, C.stoneWalls);
    for (let i = 0; i <= wallRow; i++) for (const sv of [-1, 1]) {
      const v = sv * (2 + 2 * i);
      gableFill(K, add, u, top, v, low(i) - top, C.stoneWalls);
      add(gable, u, low(i), v, sv < 0 ? 270 : 90, 'gable', low(i) + r);
    }
  });
  if (dctx && !(C.kick && (C.eaves || 1) > 1)) Details.bargeboards(K, C, w, dctx, rows, ends, add, low, pivot, r);
  return out;
}
function gableFill(K, add, u, from, v, h, stone) {
  const wall = /^(wood_wall_log|blackmarble|stone|Piece_grausten)/.test(K.wall) ? 'woodwall' : K.wall;
  const course = stone && K.stoneWall ? (/2x2/.test(K.stoneWall) ? 2 : 1) : 0;
  let y = from;
  while (h - (y - from) > 0.01) {
    const left = h - (y - from);
    if (course && left >= course - 0.01) { add(K.stoneWall, u, y + course / 2, v, 90, 'gable', y + course); y += course; continue; } // masonry gable in courses
    if (left >= 2) { add(wall, u, y + 1, v, 90, 'gable', y + 2); y += 2; }
    else if (left >= 1) { add(K.wallHalf, u, y + 0.5, v, 90, 'gable', y + 1); y += 1; }
    else { add(K.wallHalf, u, y + 0.25, v, 90, 'gable', y + 0.5); y += 0.5; }
  }
}

// Hip roof: rings of rows on all four sides with corner pieces, a ridge along what is left (needs W >= D).
// Corner yaw per corner from the corpus: front-left 180, front-right 90, back-right 0, back-left 270, each on its
// row's low edge (lab/offsets.js: ocorner to roof). eaves 2 adds a ring past the walls (fen and longhouse roofs).
function hipPieces(K, w, top, r, eaves, o = {}) {
  const roof = r === 2 ? K.roof45 : K.roof26, roofTop = r === 2 ? K.roofTop45 : K.roofTop26;
  const corner = r === 2 ? (K.roof45 || '').replace('_45', '_ocorner_45') : (K.roof26 || '') + '_ocorner';
  const capY = capOf(w, top, r), low = i => capY - r * (i + 1), pivot = i => low(i) + (r === 2 ? 1 : 0);
  const Xr = w.W - w.D, rows = (w.D - 3) / 2 + ((eaves || 1) > 1 ? 1 : 0);
  const kick = o.kick && r === 2 && (eaves || 1) > 1;
  const out = [], add = (name, u, y, v, yaw, role, surf) => { const [x, z, wy] = toWorld(w, u, v, yaw); out.push({ name, x, y, z, yaw: wy, role, surf, wing: w }); };
  for (let u = -Xr; u <= Xr + 0.01; u += 2) {
    add(roofTop, u, capY, 0, 0, 'cap', capY + 0.3);
    if (o.vent && Math.abs(u - ridgeU(w, o.vent)) < 1.01) out[out.length - 1].vent = true;
  }
  for (let i = 0; i <= rows; i++) {
    const d = 2 + 2 * i, k = kick && i === rows;
    // a kicked eave ring is a 26 degree ring hanging from the 45 degree ring above it
    const pc = k ? K.roof26 : roof, cn = k ? (K.roof26 || '') + '_ocorner' : corner, ly = k ? low(i - 1) - 1 : low(i), py = k ? ly : pivot(i);
    const surf = k ? ly + 0.5 : low(i) + r / 2;
    for (let u = -(Xr + 2 * i); u <= Xr + 2 * i + 0.01; u += 2) { add(pc, u, py, -d, 180, 'roof', surf); add(pc, u, py, d, 0, 'roof', surf); }
    for (let v = -2 * i; v <= 2 * i + 0.01; v += 2) { add(pc, -(Xr + d), py, v, 270, 'roof', surf); add(pc, Xr + d, py, v, 90, 'roof', surf); }
    add(cn, -(Xr + d), ly, -d, 180, 'roof', surf); add(cn, Xr + d, ly, -d, 90, 'roof', surf);
    add(cn, Xr + d, ly, d, 0, 'roof', surf); add(cn, -(Xr + d), ly, d, 270, 'roof', surf);
  }
  return out;
}

// Shed roof: one slope rising toward the back wall, side and back walls built up under it.
function shedRoof(b, K, w, top, r) {
  const roof = r === 2 ? K.roof45 : K.roof26, gable = r === 2 ? K.gable45 : K.gable26;
  const rows = w.D + 1;
  const lowAt = i => top + r * (i - 1); // row 1 starts at the front wall (no row hangs over it)
  for (let u = -w.W + 1; u < w.W; u += 2) for (let i = 1; i < rows; i++) b.put(roof, u, lowAt(i) + (r === 2 ? 1 : 0), -w.D - 1 + 2 * i, 180);
  for (const sx of [-w.W, w.W]) for (let i = 1; i < rows; i++) {
    const v = -w.D - 1 + 2 * i;
    if (Math.abs(v) >= w.D) continue;
    for (let y = top; y < lowAt(i) - 0.01; y += 1) b.put(K.wallHalf, sx, y + 0.5, v, 90);
    b.put(gable, sx, lowAt(i), v, 270);
  }
  const backY = lowAt(rows - 1);
  for (let u = -w.W + 1; u < w.W; u += 2) for (let y = top; y < backY - 0.01; y += 1) b.put(K.wallHalf, u, y + 0.5, w.D, 0);
  b.notes.push('Shed roof rising to the back.');
}

function flatRoof(b, K, C, cells, edges, top, F, SH, L) {
  for (const [, [x, z]] of cells) if (!onLadder(L, x, z, SH)) b.put(K.floor, x, top, z);
  // a stone block only stands on stone: over a timber lintel or an open side the parapet is wood
  const stoneUnder = e => b.pieces.some(p => p.name === K.stoneWall && Math.abs(p.x - e.x) < 0.05 && Math.abs(p.z - e.z) < 0.05 && p.y < top && p.y > top - 1.1);
  if (C.parapet) for (const e of edges) {
    if (C.stoneWalls && K.stoneBlock && stoneUnder(e)) {
      const ux = e.yaw === 0 ? 1 : 0, uz = e.yaw === 0 ? 0 : 1;
      b.put(K.stoneBlock, e.x - ux * 0.5, top + 0.5, e.z - uz * 0.5, e.yaw); // a block every other metre
    } else b.put(K.wallHalf, e.x, top + 0.5, e.z, e.yaw); // a 1 m parapet of planks
  }
  // a ladder up to a hatch in the roof
  if (L) putLadder(b, K, L, top - SH, SH);
  void F;
}

// Ring roof over a round plan: each ring 2 m further in and one row higher, pieces turned to rise toward the middle.
// rs: rise per ring (2 for 45 degrees, 1 for 26), the last value repeating. With eave the first ring hangs 2 m past
// the wall; without it the first ring starts at the wall top (drums and domes). gap leaves the first ring open
// either side of the front (a tent's doorway). Returns the height of the top ring's inner edge.
function ringRoof(b, K, ap, top, rs, o = {}) {
  const eave = o.eave !== false;
  // the first ring reaches 'out' metres past the wall (0.75 m; a tent's cone runs 2 m out to the ground), lower by
  // its slope so it still passes over the wall top
  const out = eave ? (o.out != null ? o.out : 0.75) : 0;
  let low = top - rs[0] * out / 2;
  for (let i = 0; ; i++) {
    const rho = ap + out - 1 - 2 * i;
    if (rho < 1.2) break;
    const r = rs[Math.min(i, rs.length - 1)], roof = r === 2 ? K.roof45 : K.roof26;
    const n = Math.max(4, Math.ceil(2 * Math.PI * rho / 1.7)); // a little overlap so the ring has no gaps
    for (let k = 0; k < n; k++) {
      const phi = k * 360 / n, pr = phi * Math.PI / 180;
      if (o.gap && i === 0 && Math.abs(phi - 180) < o.gap) continue;
      b.put(roof, (o.x || 0) + Math.sin(pr) * rho, low + (r === 2 ? 1 : 0), (o.z || 0) + Math.cos(pr) * rho, phi);
    }
    low += r;
  }
  return low;
}

// ---------------------------------------------------------------- octagon (round houses, crannogs, tents, yurts, round towers)

function octagonDesign(b, K, C, o) {
  const { F, SH, storeys, r, T, kind } = o;
  const side = o.side;                                // wall length per side (2, 4 or 6 m)
  const ap = side / 2 / Math.tan(Math.PI / 8);        // apothem
  const seg = side / 2;                               // 2 m walls per side
  const tent = kind === 'tent';
  const deckR = ap + (o.deck || 0);
  const inOct = (x, z, Rr, m = 0) => [0, 45, 90, 135].every(a => Math.abs(x * Math.sin(a * Math.PI / 180) + z * Math.cos(a * Math.PI / 180)) <= Rr - m);
  const Rr = Math.ceil(deckR);
  const big = [];
  let zFront = 0;
  for (let x = -Rr + 1; x < Rr; x += 2) for (let z = -Rr + 1; z < Rr; z += 2) {
    if (inOct(x, z, deckR, 0.99)) { b.put(K.floor, x, F, z); big.push([x, z]); zFront = Math.min(zFront, z - 1); }
    else for (const dx of [-0.5, 0.5]) for (const dz of [-0.5, 0.5]) if (inOct(x + dx, z + dz, deckR, o.deck ? 0.45 : 0.3)) { b.put(K.floor1, x + dx, F, z + dz); zFront = Math.min(zFront, z + dz - 0.5); }
  }
  const stack = (x, z, y1) => posts(b, K, x, z, y1);
  if (F > 0) {
    if (o.deck) { for (const [x, z] of big) if ((((x + z) / 2) % 2 + 2) % 2 === 0) stack(x, z, F); }
    else { for (let i = 0; i < 8; i++) { const a = i * 45 * Math.PI / 180; stack(Math.sin(a) * ap * 0.98, Math.cos(a) * ap * 0.98, F); } stack(0, 0, F); }
  }
  let top = F;
  const slots = [], keep = [];
  const sideAt = (i, k) => {
    const a = i * 45, ar = a * Math.PI / 180;
    const nx = Math.sin(ar), nz = Math.cos(ar), tx = Math.cos(ar), tz = -Math.sin(ar);
    const t = -side / 2 + 1 + 2 * k;
    return { a, nx, nz, tx, tz, x: nx * ap + tx * t, z: nz * ap + tz * t };
  };
  if (tent) {
    // lavvu: no walls; a doorway in the front of the first ring, the cone starting at the floor
    top = F + r;
    putDoor(b, doorPiece(K, C, 2), 0, F, -ap, 0);
    for (const x of [-1.1, 1.1]) b.put(K.pole, x, F + 1, -ap);
    for (let i = 0; i < 8; i++) for (let k = 0; k < seg; k++) {
      if (i === 4 && k === Math.floor(seg / 2)) continue;
      const s = sideAt(i, k);
      for (const dt of [-0.5, 0.5]) slots.push({ x: s.x + s.tx * dt - s.nx * 0.6, z: s.z + s.tz * dt - s.nz * 0.6, y: F, yaw: norm(s.a + 180), nx: -s.nx, nz: -s.nz });
    }
  } else {
    const inner = new Map(big.filter(([x, z]) => inOct(x, z, ap, 0.99)).map(c => [`${c[0]},${c[1]}`, c]));
    const ladders = storeys > 1 ? ladderPlan(inner, storeys - 1, { door: [sideAt(4, Math.floor(seg / 2)).x < 0 ? -1 : 1, -ap + 1] }) : [];
    if (storeys > 1 && ladders.length < storeys - 1) b.notes.push('No room for a ladder with a clear foot and landing in this plan.');
    if (ladders[0]) keep.push(cellRect(ladders[0].stand), cellRect(ladders[0].hole));
    for (let s = 0; s < storeys; s++) {
      const y0 = F + s * SH, up = ladders[s - 1];
      if (s > 0) {
        for (const [, [x, z]] of inner) if (!onLadder(up, x, z, SH)) b.put(K.floor, x, y0, z);
        // 1 m pieces out to the walls, as on the ground floor: a floor that stops short of the walls has nothing to
        // hold it up
        for (let x = -Rr + 1; x < Rr; x += 2) for (let z = -Rr + 1; z < Rr; z += 2) {
          if (inner.has(`${x},${z}`)) continue;
          for (const dx of [-0.5, 0.5]) for (const dz of [-0.5, 0.5]) if (inOct(x + dx, z + dz, ap, 0.3)) b.put(K.floor1, x + dx, y0, z + dz);
        }
        if (up) putLadder(b, K, up, y0 - SH, SH);
      }
      for (let i = 0; i < 8; i++) {
        for (let k = 0; k < seg; k++) {
          const sd = sideAt(i, k);
          const isDoor = s === 0 && i === 4 && k === Math.floor(seg / 2);
          wallSegment(b, K, C, sd.x, y0, sd.z, sd.a, SH, isDoor ? 'door' : (k === 0 && i % 2 && !T.tower ? 'window' : 'wall'));
          if (s === 0 && !isDoor) for (const dt of [-0.5, 0.5]) slots.push({ x: sd.x + sd.tx * dt, z: sd.z + sd.tz * dt, y: y0, yaw: norm(sd.a + 180), nx: -sd.nx, nz: -sd.nz });
          b.put(K.beam, sd.x, y0 + SH, sd.z, sd.a);
        }
        const sd = sideAt(i, 0), vx = sd.nx * ap + sd.tx * side / 2, vz = sd.nz * ap + sd.tz * side / 2;
        for (let y = y0; y < y0 + SH - 0.01;) { const h = (y0 + SH - y) >= 2 ? 2 : 1; b.put(h === 2 ? K.pole : K.pole1, vx, y + h / 2, vz); y += h; }
      }
      top = y0 + SH;
    }
  }
  const dx0 = tent ? 0 : sideAt(4, Math.floor(seg / 2)).x; // the door's 2 m bay is off centre when a side has two bays
  b.rooms.push({ x0: -ap, x1: ap, z0: -ap, z1: ap, y: F, h: tent ? 2 : SH, use: T.use, slots: slots.filter(sl => !keep.some(k => inRect(k, sl.x, sl.z, 0.6))),
    door: { x: dx0, z: -ap }, main: true, keep });
  // the ring roof leaves its crown open over the middle: the smoke hole, with the fire under it
  b.vents.push({ kind: 'crown', x: 0, z: 0 });
  b.doorX = dx0;
  const porch = kind === 'round' && !o.deck && !T.tower && side >= 4;
  if (kind === 'yurt') ringRoof(b, K, ap, top, [r], { eave: false });
  else ringRoof(b, K, ap, top, tent || r === 1 ? [r] : [1, r], { gap: tent ? 26 : porch ? 22 : 0, out: tent ? 2 : 0.75 });
  if (porch) {
    // entrance porch: two short walls and a small gable roof out from the door (Iron Age and early medieval round houses)
    const z = -ap - 1;
    b.put(K.floor, dx0, F, z);
    for (const x of [dx0 - 1, dx0 + 1]) { wallSegment(b, K, C, x, F, z, 90, SH, 'wall', C.wallStyle === 'stone' ? 'stone-base' : null); b.put(K.beam, x, F + SH, z, 90); }
    b.put(K.roof26, dx0 + 1, F + SH, z, 90); b.put(K.roof26, dx0 - 1, F + SH, z, 270);
    b.put(K.roofTop26, dx0, F + SH + 1, z, 90);
    b.notes.push('Porch at the door.');
  }
  // a stair up to a raised door (the walkway brings its own)
  if (F >= 0.9 && !o.walk && !o.deck) stairUp(b, K, dx0, porch ? -ap - 2 : -ap, F);
  if (kind === 'yurt') b.notes.push('Round tent on a lattice wall, low cone with an open crown.');
  else if (tent) b.notes.push('Cone tent from the ground, smoke hole at the top.');
  else b.notes.push('Round plan: eight walls and a ring roof, each ring turned toward the middle.');
  // crannog: a fence round the deck, a walkway to the shore with a stair down at its end
  if (o.fence) {
    const Rf = deckR - 0.5, L = 2 * Rf * Math.tan(Math.PI / 8), n = Math.max(1, Math.floor(L / 2));
    for (let i = 0; i < 8; i++) {
      const a = i * 45, ar = a * Math.PI / 180, nx = Math.sin(ar), nz = Math.cos(ar), tx = Math.cos(ar), tz = -Math.sin(ar);
      for (let k = 0; k < n; k++) {
        const t = -(n - 1) + 2 * k;
        if (i === 4 && Math.abs(t) < 1.5) continue;
        b.put(K.fence, nx * Rf + tx * t, F + 0.5, nz * Rf + tz * t, a);
      }
    }
  }
  if (o.walk) {
    let z = zFront - 1;
    for (let k = 0; k < o.walk / 2; k++, z -= 2) { b.put(K.floor, 0, F, z); stack(0, z, F); }
    stairUp(b, K, 0, z + 1, F);
    b.notes.push('Platform on stilts with a deck round the house and a walkway to the shore; place it over water.');
  }
}

// ---------------------------------------------------------------- additions to a shell

// A stair from the ground up to a floor whose front edge is at zEdge, climbing toward +z. wood_stair pivots in its
// middle and climbs 2 m over 2 m: for a floor 2 m up it stands on the ground; for one 1 m up it is set half in the
// ground so its top meets the floor.
// A stair climbs 1 m over 2 m from its foot: one per metre of height, each 2 m further out and 1 m lower.
function stairUp(b, K, x, zEdge, F) {
  if (F < 0.9 || F > 2.01) return;
  for (let k = 0; k < Math.round(F); k++) b.put(b.stairName || K.stair || 'wood_stair', x, F - (k + 1), zEdge - 1 - 2 * k, 180);
}
// The same up to a door in a side wall at xEdge; out is -1 for the left side, 1 for the right.
function stairUpX(b, K, xEdge, z, F, out) {
  if (F < 0.9 || F > 2.01) return;
  for (let k = 0; k < Math.round(F); k++) b.put(K.stair || 'wood_stair', xEdge + out * (1 + 2 * k), F - (k + 1), z, out < 0 ? 270 : 90);
}

// Timber trackway out from a door at (x, zDoor), len metres, on short posts.
function boardwalk(b, K, x, zDoor, F, len) {
  const y = Math.max(F, 0);
  let z = zDoor - 1;
  for (let k = 0; k < len / 2; k++, z -= 2) {
    b.put(K.floor, x, y, z);
    if (y > 0.01) for (const dx of [-1, 1]) posts(b, K, x + dx, z, y);
  }
  stairUp(b, K, x, z + 1, y);
}

// A 2 x 2 m stone tower up to height h at (tx, tz); open on its -x side at the bottom unless closed.
function stoneTowerAt(b, K, tx, tz, h, F, closed) {
  h = Math.ceil(h - 0.01); // whole courses up to the top floor
  const stone = K.stoneWall || 'stone_wall_2x1';
  for (let y = 0.5; y < h; y += 1) for (const [dx, dz, yaw] of [[0, -1, 0], [0, 1, 0], [-1, 0, 90], [1, 0, 90]])
    if (closed || !(y < F + 2 && dx === -1)) b.put(stone, tx + dx, y, tz + dz, yaw);
  b.put(K.floor, tx, h, tz);
  for (const [dx, dz, yaw] of [[0, -1, 0], [0, 1, 0], [-1, 0, 90], [1, 0, 90]]) b.put(K.stoneBlock || 'stone_wall_1x1', tx + dx * 1.0, h + 0.5, tz + dz * 1.0, yaw);
  // no ladder: a 2 m shaft has no room for one with a clear foot, so the tower is for looks
}

// Square tower of n x n cells centred on (cx, cz): wooden floors, a ladder per storey, slit windows above the ground
// storey, a low pyramid roof. skip(edge, y0, SH) leaves out walls another building already has.
function towerAt(b, K, C, o) {
  const { cx, cz, n, F, storeys, SH } = o;
  const w = { cx, cz, W: n, D: n, alpha: 0 };
  const cells = cellsOf([w]), edges = edgesOf(cells), verts = vertsOf(edges);
  const list = [...cells.values()];
  const door = o.door === 'right'
    ? edges.filter(e => e.out[0] > 0).sort((a, c) => Math.abs(a.z - cz) - Math.abs(c.z - cz))[0]
    : edges.filter(e => e.out[1] < 0).sort((a, c) => Math.abs(a.x - cx) - Math.abs(c.x - cx))[0];
  // on a house's 1 m stone floor (F 0.5) the tower gets the same floor, so its stone walls stand on stone
  const towerFloor = F > 0.01 && thickFloor(K.stoneFloor) && C.stoneWalls ? K.stoneFloor : K.floor;
  for (const [x, z] of list) b.put(towerFloor, x, towerFloor === K.floor ? F : F - 0.5, z);
  // ladders climb round the walls: each one's landing is the next one's foot
  const ladders = ladderPlan(cells, storeys - 1, { door: [door.cell[0], door.cell[1]] });
  let top = F;
  for (let s = 0; s < storeys; s++) {
    const y0 = F + s * SH, up = ladders[s - 1], next = ladders[s];
    if (s > 0) {
      for (const [x, z] of list) if (!onLadder(up, x, z, SH)) b.put(K.floor, x, y0, z);
      if (up) putLadder(b, K, up, y0 - SH, SH);
    }
    for (const e of edges) {
      if (o.skip && o.skip(e, y0, SH)) continue;
      const midSide = e.yaw === 0 ? Math.abs(e.x - cx) < 0.01 : Math.abs(e.z - cz) < 0.01;
      wallSegment(b, K, C, e.x, y0, e.z, e.yaw, SH, s === 0 && e === door ? 'door' : (s > 0 && midSide ? 'window' : 'wall'));
    }
    for (const e of edges) b.put(K.beam, e.x, y0 + SH, e.z, e.yaw);
    const keep = [];
    if (up) keep.push(cellRect(up.hole), cellRect(up.land));
    if (next) keep.push(cellRect(next.stand), cellRect(next.hole));
    b.rooms.push({ x0: cx - n, x1: cx + n, z0: cz - n, z1: cz + n, y: y0, h: SH, use: o.use || 'guard', upper: s > 0, main: s === 0 && !o.skip,
      door: s === 0 ? { x: door.x, z: door.z } : null, hole: s > 0 && up ? up.hole : null, keep });
    top = y0 + SH;
  }
  for (const p of hipPieces(K, w, top, 1, 1, { tight: true })) b.put(p.name, p.x, p.y, p.z, p.yaw);
  if (b.doorX == null) b.doorX = door.x;
  void verts;
  return top;
}

// Drum on a ceiling, then a stepped dome (45 then 26 degree rings) or a cone (45 degree rings), a block on top.
function domeOn(b, K, C, o) {
  const ap = o.side / 2 / Math.tan(Math.PI / 8), seg = o.side / 2;
  for (const [x, z] of o.ceiling) b.put(K.floor, x, o.y, z);
  for (let i = 0; i < 8; i++) {
    const a = i * 45, ar = a * Math.PI / 180, nx = Math.sin(ar), nz = Math.cos(ar), tx = Math.cos(ar), tz = -Math.sin(ar);
    for (let k = 0; k < seg; k++) {
      const t = -o.side / 2 + 1 + 2 * k, x = o.x + nx * ap + tx * t, z = o.z + nz * ap + tz * t;
      // planks: the drum stands on the wooden ceiling, and stone or marble on wood falls in Valheim (T-102)
      wallSegment(b, K, C, x, o.y, z, a, o.h, i % 2 === 0 && k === 0 ? 'window' : 'wall', 'plank');
      b.put(K.beam, x, o.y + o.h, z, a);
    }
  }
  const peak = ringRoof(b, K, ap, o.y + o.h, o.cone ? [2] : o.side >= 4 ? [2, 1] : [1], { eave: false, x: o.x, z: o.z });
  void peak; // the top of the dome stays open (a stone block there had nothing under it but the roof)
}

// Low gallery roof all round a building at height yS: a 26 degree lean-to 2 m deep against the walls, corner pieces,
// posts and beams along its outer edge.
function skirtRoof(b, K, edges, yS) {
  const roof = K.roof26, corner = K.roof26 + '_ocorner';
  const post = (x, z) => { for (let y = 0; y < yS - 0.01;) { const h = yS - y >= 2 ? 2 : 1; b.put(h === 2 ? K.pole : K.pole1, x, y + h / 2, z); y += h; } };
  const outs = new Map();
  for (const e of edges) {
    const [ox, oz] = e.out, ux = e.yaw === 0 ? 1 : 0, uz = e.yaw === 0 ? 0 : 1;
    b.put(roof, e.x + ox, yS, e.z + oz, slopeYaw(e.out));
    b.put(K.beam, e.x + 2 * ox, yS, e.z + 2 * oz, e.yaw);
    for (const s of [-1, 1]) {
      const vx = e.x + s * ux, vz = e.z + s * uz, k = `${vx},${vz}`;
      post(vx + 2 * ox, vz + 2 * oz);
      if (!outs.has(k)) outs.set(k, []);
      outs.get(k).push([ox, oz]);
    }
  }
  for (const [k, os] of outs) {
    const ax = os.find(o => o[0] !== 0), az = os.find(o => o[1] !== 0);
    if (!ax || !az || os.length !== 2) continue; // only outside corners
    const [vx, vz] = k.split(',').map(Number), sx = ax[0], sz = az[1];
    const yaw = sx < 0 && sz < 0 ? 180 : sx > 0 && sz < 0 ? 90 : sx > 0 ? 0 : 270;
    b.put(corner, vx + sx, yS, vz + sz, yaw);
    post(vx + 2 * sx, vz + 2 * sz);
    b.put(K.beam, vx + 2 * sx, yS, vz + sz, 90);
    b.put(K.beam, vx + sx, yS, vz + 2 * sz, 0);
  }
}

// ---------------------------------------------------------------- extras

function dockDesign(b, K, W, D, F, stage) {
  const len = stage === 's1' ? 3 : stage === 's2' ? 5 : 7;
  for (let i = 0; i < len; i++) {
    const z = -D - 1 - 2 * i;
    for (const x of [-1, 1]) b.put(K.floor, x, F, z);
    for (const x of [-2, 2]) { b.put(K.pole, x, F - 1, z - 1); b.put(K.pole, x, F - 3, z - 1); }
  }
  b.put(K.pole, -2, F + 1, -D - 2 * len, 0); b.put(K.pole, 2, F + 1, -D - 2 * len, 0);
  b.notes.push('Pier runs out on the door side; place it over water.');
  void W;
}

function fieldDesign(b, K, W, D, biome, stage, R, doorX = 0) {
  const crops = { 'Meadows': 'RaspberryBush', 'Black Forest': 'Pickable_Carrot', 'Swamp': 'Pickable_Turnip', 'Mountain': 'Pickable_Onion',
    'Plains': 'Pickable_Barley', 'Mistlands': 'Pickable_Barley', 'Ashlands': 'Pickable_Barley' };
  const crop = crops[biome] || 'Pickable_Carrot';
  const fw = stage === 's1' ? 4 : stage === 's2' ? 6 : 8, fd = stage === 's1' ? 3 : 4;
  const z0 = -D - 2 - fd * 2, x0 = -fw;
  for (let x = x0 + 1; x < x0 + fw * 2; x += 2) { b.put(K.fence, x, 0.5, z0, 0); if (Math.abs(x - doorX) > 1.5) b.put(K.fence, x, 0.5, -D - 2, 0); }
  for (let z = z0 + 1; z < -D - 2; z += 2) { b.put(K.fence, x0, 0.5, z, 90); b.put(K.fence, x0 + fw * 2, 0.5, z, 90); }
  const step = crop === 'RaspberryBush' ? 1.5 : 0.75;
  for (let x = x0 + 1; x < x0 + fw * 2 - 0.5; x += step * 1.5) for (let z = z0 + 1; z < -D - 2.5; z += step) b.put(crop, x, 0, z, Math.floor(R() * 4) * 90);
  if (reaches(biome, 'Swamp')) b.put('ArmorStand', x0 + fw, 0, z0 + fd, 0); // a scarecrow; the stand takes iron
  b.notes.push(`Field of ${crop}; the ground needs cultivating in game for crops to grow back.`);
  void W;
}

function penDesign(b, K, W, D, stage) {
  const pw = stage === 's1' ? 3 : 4, pd = D, x0 = W, x1 = W + pw * 2;
  for (let x = x0 + 1; x < x1; x += 2) { b.put(K.fence, x, 0.5, -pd, 0); b.put(K.fence, x, 0.5, pd, 0); }
  for (let z = -pd + 1; z < pd; z += 2) if (Math.abs(z) > 1.5) b.put(K.fence, x1, 0.5, z, 90);
  b.put('piece_chest_barrel', x1 - 1, 0, pd - 1, 0);
  b.put('wood_stack', x0 + 1.2, 0, pd - 1, 0);
  b.notes.push('Pen beside the barn; its gap faces away from the barn.');
}

function wellDesign(b, K, biome, stage) {
  const st = biome === 'Meadows' ? (K.wallHalf || 'wood_wall_half') : (K.stoneBlock || 'stone_wall_1x1');
  for (const [x, z, yaw] of [[0, -1, 0], [0, 1, 0], [-1, 0, 90], [1, 0, 90]]) b.put(st, x, 0.5, z, yaw);
  // posts 3.5 m tall and the roof from 2.5 m up, so nobody walking round the well hits the eaves
  for (const x of [-0.9, 0.9]) { b.put(K.pole, x, 1, 0); b.put(K.pole1, x, 2.5, 0); b.put(K.pole1, x, 3, 0); } // under the beam's ends
  b.put(K.beam || 'wood_beam', 0, 3.5, 0, 0);
  b.put(K.roof26, 0, 2.5, -1, 180); b.put(K.roof26, 0, 2.5, 1, 0);
  b.put('piece_chest_barrel', 1.6, 0, 1.6, 0);
  if (stage !== 's1') { b.put('piece_groundtorch_wood', -1.8, 0.75, -1.8, 0); b.put('piece_bench01', 0, 0, -2.6, 0); }
  b.notes.push('Well; Valheim has no water source piece, so the shaft is for looks.');
  return b;
}

function campDesign(b, K, biome, stage, R, decor) {
  b.put('fire_pit', 0, 0, 0, 0);
  b.put('piece_cookingstation', 0, 0.4, 0, 0);
  const n = stage === 's1' ? 2 : 3;
  for (let i = 0; i < n; i++) { const a = (i / n) * 2 * Math.PI + R() * 0.4; b.put('piece_logbench01', Math.sin(a) * 2.6, 0, Math.cos(a) * 2.6, (a * 180 / Math.PI + 180) % 360); }
  for (const x of [-1, 1]) { b.put(K.pole, x * 2, 1, 5, 0); b.put(K.roof45, x, 1.2, 4.6, 0); }
  b.put('bed', 0, 0, 5, 90);
  if (decor !== 'd1') { b.put('wood_stack', 3.5, 0, 3, 30); b.put('piece_chest_wood', -3.5, 0, 3, 150); }
  if (decor === 'd3') { b.put('piece_groundtorch_wood', 3.6, 0.75, -2, 0); b.put('rug_deer', 0, 0.02, 4.3, 0); b.put('itemstand', -2, 1.5, 5.3, 180); }
  return b;
}

if (NODE) module.exports = { generate, quat, PLAN_BY_TYPE, ROOF_BY_CULTURE };
else window.VHGenerate = { generate, quat, PLAN_BY_TYPE, ROOF_BY_CULTURE };

})();
// ---- request.js
(function () {
// Requests in plain words, and the best of several seeds. One copy for every place that makes designs: the request
// page (web/app.html), the game's 'vh gen' (the engine bundle, lib/build_engine.js), and lab/process_requests.js.
// A request is { type, biome, culture, plan, roof, walls, pitch, storeys, porch, stage, decor, seed }.

const NODE_Q = typeof module !== 'undefined';
const GQ = NODE_Q ? require('./generate.js') : window.VHGenerate;
const SQ = NODE_Q ? require('./styles.js') : window.VHStyles;
const CQ = NODE_Q ? require('./checks.js') : window.VHChecks;
const FQ = NODE_Q ? require('./features.js') : window.VHFeatures;
const BQ = NODE_Q ? require('./blueprint.js') : window.VHBlueprint;
const DQ = NODE_Q ? require('./decorate.js') : window.VHDecorate;

// Words to choices. The first match per field wins, so the more specific words come first.
const WORDS = [
  ['type', 'longhouse', /long ?house|great hall|mead ?hall|jarl/], ['type', 'tavern', /tavern|\binn\b|\bpub\b|feast/],
  ['type', 'smithy', /smith|forge|\bmine\b|mining|metal/], ['type', 'sawmill', /saw ?mill|wood ?work|lumber|carpent|woodcutter/],
  ['type', 'barn', /barn|stable|animal|\bpen\b|\bboar|\blox\b|chicken|coop/], ['type', 'farm', /farm|field|crop|garden/],
  ['type', 'storage', /storage|store ?house|granary|\bshed\b|warehouse/], ['type', 'tower', /tower|lookout|watch/],
  ['type', 'dock', /dock|pier|boat|harbou?r|shipyard/], ['type', 'stall', /stall|market|shop|bazaar/],
  ['type', 'temple', /temple|shrine|church|altar/], ['type', 'well', /\ba well\b|\bwell house|\bwater well/], ['type', 'camp', /camp\b|campfire|tent/],
  ['type', 'workshop', /workshop|workbench|craft/], ['type', 'home', /house|home|cottage|cabin|hut|hovel/],
  ['biome', 'Black Forest', /black ?forest/], ['biome', 'Swamp', /swamp|bog|marsh/], ['biome', 'Mountain', /mountain|snow/],
  ['biome', 'Plains', /plains/], ['biome', 'Mistlands', /mist/], ['biome', 'Ashlands', /ash ?lands/], ['biome', 'Meadows', /meadow/],
  ['culture', 'middle-eastern', /desert|arab|middle ?east|persian|moor|oasis|caravanserai|courtyard house/], ['culture', 'east-asian', /japan|asian|pagoda|chinese/],
  ['culture', 'byzantine', /byzantin|greek|domed? church/], ['culture', 'steppe', /steppe|yurt|khazar|turkic|nomad/],
  ['culture', SQ.ID.lamari, /lamari|svan|georgian|armenian|caucas|tower house/], ['culture', 'saami', /s[aá]a?mi|lavvu|goahti|kota/],
  ['culture', 'norse-highland', /iceland|turf/], ['culture', 'celtic-crannog', /crannog|lake ?dwell/], ['culture', 'baltic', /baltic|latvia|lithuan|prussia|curonian/],
  ['culture', 'fen-folk', /\bfen|frisian|terp/], ['culture', 'anglo-saxon', /anglo|saxon/], ['culture', 'frankish-norman', /norman|frank|motte|keep/],
  ['culture', 'norse-forest', /stave|log cabin|log house/], ['culture', 'castle-medieval', /medieval|castle|tudor|knight/], ['culture', 'dwarven', /dwar/],
  ['culture', 'slavic', /slav|russian|izba|\brus\b/], ['culture', 'celtic', /celtic|irish|scots|welsh|druid|round ?house/], ['culture', 'swamp', /stilt/],
  ['culture', 'mountain', /lodge/], ['culture', 'norse', /viking|norse|nordic/],
  ['plan', 'L', /\bl[- ]?shaped|\bl plan/], ['plan', 'T', /\bt[- ]?shaped|\bt plan/], ['plan', 'cross', /cross/], ['plan', 'U', /courtyard|u[- ]?shaped/],
  ['plan', 'octagon', /octagon|round\b|circular/], ['plan', 'long', /\blong\b/], ['plan', 'square', /square/],
  ['roof', 'hip', /hip/], ['roof', 'flat', /flat/], ['roof', 'shed', /shed roof|lean[- ]?to/], ['roof', 'gable', /gable/],
  ['stage', 's1', /small|tiny|little|starter/], ['stage', 's3', /large|big|grand|huge/], ['stage', 's2', /medium|middle/],
  ['decor', 'd1', /bare|empty|plain|stripped/], ['decor', 'd3', /rich|lavish|clutter|full of|well furnished|decorated|lots of decor/], ['decor', 'd2', /cosy|cozy|furnished|lived/],
  ['walls', 'half-timber', /half[- ]?timber|timber ?frame/], ['walls', 'log', /\blog\b/], ['walls', 'stone', /\bstone\b/], ['walls', 'stone-base', /stone base|stone footing/],
  ['pitch', '45', /steep/], ['pitch', '26', /low roof|shallow/],
  ['storeys', 3, /\b(three|3)[- ]?(stor(e?y|ies|eys)|floors?|levels?)\b/], ['storeys', 2, /\b(two|2)[- ]?(stor(e?y|ies|eys)|floors?|levels?)\b|upstairs|upper floor|loft/],
  ['storeys', 1, /\b(one|1|single)[- ]?(stor(e?y|ies|eys)|floors?|levels?)\b|bungalow/],
  ['porch', false, /\bno porch|without (a )?porch/], ['porch', true, /porch|veranda|stoop/],
];

// The fields a text names, e.g. "two storeys with a porch" gives { storeys: 2, porch: true }.
function read(text) {
  const t = String(text || '').toLowerCase(), out = {};
  for (const [k, v, re] of WORDS) if (!(k in out) && re.test(t)) out[k] = v;
  return out;
}

// Short codes for the game's console.
const BIOME_CODES = { md: 'Meadows', bf: 'Black Forest', sw: 'Swamp', mt: 'Mountain', pl: 'Plains', ml: 'Mistlands', al: 'Ashlands', dn: 'Deep North' };
// The lab has no Deep North kit yet; Deep North requests use the Mountain kit, the nearest one.
const BIOME_STAND_IN = { 'Deep North': 'Mountain' };
const TYPE_WORDS = { house: 'home', hall: 'longhouse', greathall: 'longhouse', inn: 'tavern', forge: 'smithy', woodworker: 'sawmill',
  storehouse: 'storage', watchtower: 'tower', market: 'stall', shrine: 'temple', church: 'temple', boathouse: 'dock' };

function evaluate(d, biome, scorer) {
  const checks = CQ.check(d, biome);
  const score = scorer ? FQ.score(scorer, d.pieces) : 0;
  return { checks, score, pass: checks.filter(c => c.ok).length };
}

// Builds n seeds (seed, seed + 101, ...) and keeps the one that passes the most checks, then scores highest.
// Furnishing and the checks are the slow parts (most of a few seconds a design in the game), so the seeds are built
// bare and ranked on their keep score alone; then the best are furnished and checked in that order until one passes
// every check (at most four; else the best of those). Bare and furnished builds of a seed share the same structure.
function best(req, n, scorer) {
  const base = +req.seed || 1;
  const bare = [];
  for (let i = 0; i < Math.max(1, n | 0); i++) {
    const seed = base + i * 101;
    const d = GQ.generate({ ...req, seed, skipDecor: true });
    bare.push({ seed, key: scorer ? FQ.score(scorer, d.pieces) : 0 });
  }
  bare.sort((a, c) => c.key - a.key || a.seed - c.seed);
  let top = null;
  for (const c of bare.slice(0, 4)) {
    const d = GQ.generate({ ...req, seed: c.seed });
    const ev = evaluate(d, req.biome, scorer);
    const key = ev.pass * 10 + ev.score;
    if (!top || key > top.key) top = { d, ev, key };
    if (ev.pass === ev.checks.length) break;
  }
  return top;
}

// One request as the game and the request processor make it. o: { type, biome (name or code), culture, stage
// ('s1d3' or 's1'), decor, words, seed, tries }. Fields named in o win over the words. Returns plain data.
function make(o, scorer, rules) {
  if (rules) DQ.setRules(rules);
  const words = read(o.words);
  const notes = [];
  let biome = BIOME_CODES[String(o.biome || '').toLowerCase()] || o.biome || words.biome || 'Meadows';
  const asked = biome;
  if (BIOME_STAND_IN[biome]) { biome = BIOME_STAND_IN[biome]; notes.push(`The lab has no ${asked} kit yet; built with the ${biome} kit.`); }
  let type = String(o.type || words.type || 'home').toLowerCase();
  type = TYPE_WORDS[type] || type;
  if (type === 'hub' || type === 'hearth') return { error: 'the lab has no hub or hearth design yet. Types: ' + Object.keys(SQ.TYPES).join(', ') };
  if (!SQ.TYPES[type]) return { error: `unknown type '${o.type}'. Types: ${Object.keys(SQ.TYPES).join(', ')}` };
  if (!SQ.BIOMES.includes(biome)) return { error: `unknown biome '${o.biome}'. Codes: ${Object.keys(BIOME_CODES).join(', ')}` };
  let stage = o.stage, decor = o.decor;
  const sd = /^(s[123])(d[123])?$/i.exec(String(stage || ''));
  if (sd) { stage = sd[1].toLowerCase(); decor = decor || (sd[2] && sd[2].toLowerCase()); }
  stage = stage || words.stage || 's2';
  decor = decor || words.decor || 'd2';
  // a culture key written among the words ("middle-eastern courtyard") counts as the culture
  const keyWord = String(o.words || '').toLowerCase().split(/[\s,;]+/).find(w => SQ.cultureKey(w));
  const culture = SQ.cultureKey(o.culture || keyWord || words.culture) || o.culture || keyWord || words.culture;
  if (culture && !SQ.CULTURES[culture]) return { error: `unknown culture '${culture}'. Cultures: ${Object.keys(SQ.CULTURES).join(', ')}` };
  const req = { type, biome, culture, stage, decor, seed: +o.seed || 1 };
  for (const k of ['plan', 'roof', 'walls', 'pitch', 'storeys', 'porch']) if (words[k] !== undefined) req[k] = words[k];
  if (req.pitch) req.pitch = +req.pitch;
  const top = best(req, o.tries || 8, scorer);
  const d = top.d, info = d.request;
  const failed = top.ev.checks.filter(c => !c.ok).map(c => `${c.check}: ${c.detail}`);
  return {
    name: d.meta.Name, description: d.meta.Description, blueprint: BQ.write(d), pieces: d.pieces.length,
    type: info.type, biome: info.biome, culture: info.cultureKey, plan: info.plan || '', roof: info.roof || '', walls: info.walls || '',
    stage: info.stage, decor: info.decor, seed: info.seed, score: top.ev.score, passed: top.ev.pass, checks: top.ev.checks.length,
    failed, notes: notes.concat(d.notes || []), read: words, request: req,
  };
}

const apiQ = { WORDS, read, best, evaluate, make, BIOME_CODES, BIOME_STAND_IN, TYPE_WORDS };
if (NODE_Q) module.exports = apiQ; else window.VHRequest = apiQ;

})();
// ---- floorplan.js
(function () {
// Floorplans: one room furnished by the decorator and shown without walls or roof, so the layout can be judged from
// above. The decorator works in a full temporary room (floor, walls with a door and windows, a ceiling); the plan
// keeps the floor, a low curb where walls stand, a rail where windows are, the door, the ladder, full wall stubs only
// where something hangs, and a post with a sign that carries the plan's ID (FP-001).
//
// floorplan({ shape, w, d, room, biome, culture, decor, seed, id, ladder }) gives { pieces, sign, summary, ... }.
// set(n) lays the first n plans of the catalog out in a grid, IDs FP-001 on, the same IDs as the review sheet's
// Floorplans tab. Shapes: rect, L, octagon (round), long (a hall with two rows of posts).
// Rooms: home, sleeping, hall, tavern, kitchen, smithy, workshop, temple, storage.

const NODE_FP = typeof module !== 'undefined';
const DF = NODE_FP ? require('./decorate.js') : window.VHDecorate;
const SF = NODE_FP ? require('./styles.js') : window.VHStyles;
const BF = NODE_FP ? require('./blueprint.js') : window.VHBlueprint;

const SHAPES = ['rect', 'L', 'octagon', 'long'];
const ROOMS = {
  home: { use: 'home', type: 'home', fire: true },
  sleeping: { use: 'home', type: 'home', role: 'sleeping' },
  hall: { use: 'hall', type: 'longhouse', fire: true },
  tavern: { use: 'hall', type: 'tavern', fire: true },
  kitchen: { use: 'home', type: 'home', role: 'kitchen' },
  smithy: { use: 'smithy', type: 'smithy' },
  workshop: { use: 'workshop', type: 'workshop' },
  temple: { use: 'hall', type: 'temple', role: 'temple' },
  storage: { use: 'storage', type: 'storage' },
};
const BIOME_CODES = { md: 'Meadows', bf: 'Black Forest', sw: 'Swamp', mt: 'Mountain', pl: 'Plains', ml: 'Mistlands', al: 'Ashlands', dn: 'Deep North' };

function rngFP(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const quatFP = yaw => { const a = yaw * Math.PI / 360; return [0, +Math.sin(a).toFixed(6), 0, +Math.cos(a).toFixed(6)]; };

// Floor cells (2 m) of a shape, centered on 0, 0.
function cellsOf(shape, w, d) {
  const W = Math.max(2, Math.round(w / 2)), D = Math.max(2, Math.round(d / 2));
  const out = [];
  for (let i = 0; i < W; i++) for (let j = 0; j < D; j++) {
    const x = -W + 1 + 2 * i, z = -D + 1 + 2 * j;
    if (shape === 'L' && i >= Math.ceil(W / 2) && j >= Math.ceil(D / 2)) continue;
    if (shape === 'octagon') {
      const R = Math.min(W, D);
      if (Math.abs(x) + Math.abs(z) > R * 1.42 - 0.5) continue;
    }
    out.push([x, z]);
  }
  return { cells: out, W, D };
}

// 'vh floorplan template RT-0001 [biome]': one room template laid out as it is, in a plain room of its size (rounded up
// to the 2 m floor), its fire where the template has it, nothing added, so a room scored in the Rooms tab can be walked
// through. The biome defaults to the Deep North, where every piece can be made.
const KIND_ROOM = { home: 'home', sleeping: 'sleeping', hall: 'hall', tavern: 'tavern', kitchen: 'kitchen', smithy: 'smithy', workshop: 'workshop',
  temple: 'temple', storage: 'storage', living: 'home', other: 'home' };
function templatePlan(id, biome) {
  const t = DF.templateById(id);
  if (!t) throw new Error(`no room template ${id}`);
  const w = Math.max(4, 2 * Math.ceil((t.W - 0.1) / 2)), d = Math.max(4, 2 * Math.ceil((t.D - 0.1) / 2));
  return { shape: 'rect', w, d, room: KIND_ROOM[t.kind] || 'home', biome: biome || 'dn', decor: 'd3', seed: 1, id: t.id, template: t };
}

function floorplan(spec) {
  const shape = SHAPES.includes(spec.shape) ? spec.shape : 'rect';
  const roomKind = ROOMS[spec.room] ? spec.room : 'home';
  const R0 = ROOMS[roomKind];
  const biome = BIOME_CODES[String(spec.biome || '').toLowerCase()] || (SF.BIOMES.concat(['Deep North']).includes(spec.biome) ? spec.biome : 'Meadows');
  const seed = +spec.seed || 1;
  const R = rngFP(seed * 7919 + 13);
  const culture = SF.CULTURES[spec.culture] ? spec.culture : SF.cultureFor(biome === 'Deep North' ? 'Mountain' : biome, rngFP(seed * 104729 + 7));
  const decor = ['d1', 'd2', 'd3'].includes(spec.decor) ? spec.decor : 'd2';
  const w = shape === 'long' ? Math.max(spec.w || 20, 2 * (spec.d || 8)) : spec.w || 10, dpt = spec.d || 8;
  const { cells, W, D } = cellsOf(shape, w, dpt);
  const key = new Set(cells.map(([x, z]) => `${x},${z}`));
  const H = 3;
  const shell = [], keep = [];
  const put = (list, name, x, y, z, yaw = 0, extra) => list.push({ name, x: +x.toFixed(3), y: +y.toFixed(3), z: +z.toFixed(3), q: quatFP(yaw), yaw, ...(extra || {}) });
  for (const [x, z] of cells) { put(keep, 'wood_floor', x, 0, z); put(shell, 'wood_floor', x, H, z); }
  // walls on every outside edge; the door on the front edge nearest the middle; windows on every other edge
  const edges = [];
  for (const [x, z] of cells) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (key.has(`${x + 2 * dx},${z + 2 * dz}`)) continue;
    edges.push({ x: x + dx, z: z + dz, yaw: dx ? 90 : 0, out: [dx, dz] });
  }
  const front = edges.filter(e => e.out[1] < 0).sort((a, b) => Math.abs(a.x) - Math.abs(b.x) || a.z - b.z);
  const door = front[0] || edges[0];
  for (const e of edges) {
    e.kind = e === door ? 'door' : (Math.round((e.x + e.z) / 2) % 2 === 0 && Math.hypot(e.x - door.x, e.z - door.z) > 2.5 ? 'window' : 'wall');
    if (e.kind === 'door') { put(keep, 'wood_door', e.x, 1, e.z, e.yaw); put(shell, 'woodwall', e.x, 2.5, e.z, e.yaw); }
    else if (e.kind === 'window') { put(shell, 'wood_wall_half', e.x, 0.5, e.z, e.yaw); put(shell, 'wood_wall_half', e.x, 2.5, e.z, e.yaw); }
    else { put(shell, 'woodwall', e.x, 1, e.z, e.yaw); put(shell, 'wood_wall_half', e.x, 2.5, e.z, e.yaw); }
  }
  // a long hall has two rows of posts, two cells in from the long walls
  if (shape === 'long' && D >= 3) for (let x = -W + 2; x <= W - 2; x += 2) for (const z of [-(D - 2), D - 2]) put(keep, 'wood_pole2', x, 1, z);
  // a ladder in the back corner when asked (it shows the way kept clear to it)
  if (spec.ladder) {
    const corner = cells.slice().sort((a, b) => (b[0] + b[1]) - (a[0] + a[1]))[0];
    put(keep, 'wood_stepladder', corner[0], 0, corner[1] - 0.5, 180);
  }
  const b = { pieces: [...keep, ...shell], rooms: [{ x0: -W, x1: W, z0: -D, z1: D, y: 0, h: H, use: R0.use, upper: false, main: true, door: { x: door.x, z: door.z } }], notes: [] };
  if (shape === 'L') {
    const wx = 2 * Math.ceil(W / 2) - W, dz = 2 * Math.ceil(D / 2) - D;
    b.rooms = [{ ...b.rooms[0], z1: -D + 2 * Math.ceil(D / 2) - 0 }, { ...b.rooms[0], x1: -W + 2 * Math.ceil(W / 2), main: false, door: null }];
    void wx; void dz;
  }
  const tp = spec.template || null;
  const fireAt = tp ? (tp.fire ? { x: Math.round(tp.fire[0] * (2 * W) / tp.W), z: Math.round(tp.fire[1] * (2 * D) / tp.D) } : null) : R0.fire ? (() => { const c = cells.slice().sort((a, b2) => Math.hypot(a[0], a[1]) - Math.hypot(b2[0], b2[1]))[0]; return { x: c[0], z: c[1] }; })() : null;
  DF.decorate(b, { use: R0.use, type: R0.type, role: tp ? (R0.role || roomKind) : R0.role, decor, biome, culture, R, doorX: door.x, fireAt, usedTemplates: spec.used,
    ...(tp ? { forceTemplate: tp.id, templateOnly: true } : {}) });
  const template = (b.decorReport || []).map(r => r.template).filter(Boolean).join(' ');
  const furniture = b.pieces.filter(p => p.decor && !p.outside);
  // keep a full wall wherever something hangs on it, so nothing floats
  const F = DF.FURNITURE;
  const hung = furniture.filter(p => { const f = F[p.name] || {}; return f.at === 'mount' || (p.name === 'itemstandh' && p.y > 0.6 && !furniture.some(t => (F[t.name] || {}).cat === 'table' && Math.hypot(t.x - p.x, t.z - p.z) < 2.2 && Math.abs(t.y + 0.75 - p.y) < 0.2)); });
  const stubs = new Set();
  for (const p of hung) {
    let bestE = null, bd = 1.2;
    for (const e of edges) { const dd = Math.hypot(p.x - e.x, p.z - e.z); if (dd < bd && e.kind !== 'door') { bd = dd; bestE = e; } }
    if (bestE) stubs.add(bestE);
  }
  const out = [...keep];
  for (const e of edges) {
    if (e.kind === 'door') continue;
    if (stubs.has(e)) { put(out, 'woodwall', e.x, 1, e.z, e.yaw); put(out, 'wood_wall_half', e.x, 2.5, e.z, e.yaw); }
    else if (e.kind === 'window') put(out, 'wood_fence', e.x, 0.5, e.z, e.yaw);
    // a low curb where the wall stands: a 2 m beam lying on the floor, 0.2 m high (wood_wall_quarter is a 1 x 1 m piece)
    else put(out, 'wood_beam', e.x, 0.1, e.z, e.yaw);
  }
  // hanging braziers need the ceiling the plan leaves out
  for (const p of furniture) if ((F[p.name] || {}).at !== 'hang') out.push(p);
  // the ID: a post at the front left corner, outside, with two signs back to back so it reads from either side
  const sx = -W - 1, sz = -D - 1;
  put(out, 'wood_pole2', sx, 1, sz);
  put(out, 'sign', sx, 1.5, sz - 0.15, 180, { idSign: true });
  put(out, 'sign', sx, 1.5, sz + 0.15, 0, { idSign: true });
  const counts = {};
  for (const p of furniture) { const n = p.name.replace(/^piece_/, ''); counts[n] = (counts[n] || 0) + 1; }
  const area = cells.length * 4;
  const items = furniture.filter(p => (F[p.name] || {}).at !== 'rug').length;
  const id = spec.id || 'FP-000';
  const bcode = Object.keys(BIOME_CODES).find(k => BIOME_CODES[k] === biome);
  const command = tp ? `vh floorplan template ${tp.id} ${bcode}` : `vh floorplan ${shape} ${w}x${dpt} ${roomKind} ${bcode} ${culture} ${decor} ${seed}${spec.ladder ? ' ladder' : ''}`;
  return {
    id, command, shape, w, d: dpt, room: roomKind, biome, culture, decor, seed, area, template,
    perTenM2: +(items / area * 10).toFixed(2), items,
    summary: Object.entries(counts).sort((a, c) => c[1] - a[1]).map(([n, c]) => `${n} ${c}`).join(', '),
    pieces: out, sign: { text: tp ? `${id} ${tp.kind} ${tp.W}x${tp.D}` : `${id} ${roomKind} ${w}x${dpt} ${decor}` },
  };
}

// The catalog behind 'vh floorplan set': every room, every shape, three decor stages, seven biomes.
const CATALOG = [
  ['rect', 10, 8, 'home', 'md', 'norse', 'd2'], ['rect', 10, 8, 'home', 'md', 'norse', 'd3'],
  ['L', 12, 10, 'home', 'bf', 'norse-forest', 'd2'], ['octagon', 10, 10, 'home', 'sw', 'celtic-crannog', 'd2'],
  ['rect', 8, 6, 'sleeping', 'bf', 'slavic', 'd2'], ['rect', 12, 8, 'sleeping', 'mt', 'norse-highland', 'd3', true],
  ['long', 20, 8, 'hall', 'bf', 'norse-forest', 'd2'], ['long', 24, 10, 'hall', 'sw', 'fen-folk', 'd3'],
  ['rect', 14, 10, 'tavern', 'pl', 'byzantine', 'd2'], ['L', 16, 12, 'tavern', 'md', 'anglo-saxon', 'd3'],
  ['rect', 8, 6, 'kitchen', 'bf', 'celtic', 'd2'], ['rect', 10, 8, 'kitchen', 'mt', 'norse-highland', 'd3'],
  ['rect', 10, 8, 'smithy', 'bf', 'norse-forest', 'd2'], ['octagon', 10, 10, 'smithy', 'pl', 'steppe', 'd3'],
  ['rect', 10, 8, 'workshop', 'md', 'frankish-norman', 'd2'], ['L', 12, 10, 'workshop', 'sw', 'baltic', 'd3'],
  ['rect', 12, 8, 'temple', 'mt', 'norse-highland', 'd2'], ['octagon', 12, 12, 'temple', 'ml', 'byzantine', 'd3'],
  ['rect', 8, 6, 'storage', 'sw', 'fen-folk', 'd2'], ['rect', 10, 8, 'storage', 'pl', 'middle-eastern', 'd3'],
  ['rect', 6, 6, 'home', 'md', 'anglo-saxon', 'd1'], ['octagon', 8, 8, 'home', 'mt', 'saami', 'd2'],
  ['rect', 14, 10, 'home', 'pl', 'middle-eastern', 'd3'], ['rect', 12, 10, 'home', 'ml', 'lamari', 'd3', true],
];
const catalogSpec = i => {
  const [shape, w, d, room, biome, culture, decor, ladder] = CATALOG[i];
  return { shape, w, d, room, biome, culture, decor, ladder: !!ladder, seed: 101 + i, id: 'FP-' + String(i + 1).padStart(3, '0') };
};

// One plan, or several in a grid four to a row, as one blueprint. Each plan sits in its own box (its pieces plus
// half a meter), 2 m from the next. The first row is the front (lowest z), plan 1 at its left; each row is centered
// on x = 0. 'pads' gives each plan's box and middle in the game's centered coordinates, and floorY the height of the
// floors there, so the game can set each plan on the ground under it.
const GAP_FP = 2, MARGIN_FP = 0.5, COLS_FP = 4;
function layout(plans) {
  const pieces = [], signs = [], pads = [];
  const boxes = plans.map(p => {
    const xs = p.pieces.map(q => q.x), zs = p.pieces.map(q => q.z);
    return { x0: Math.min(...xs) - MARGIN_FP, x1: Math.max(...xs) + MARGIN_FP, z0: Math.min(...zs) - MARGIN_FP, z1: Math.max(...zs) + MARGIN_FP };
  });
  let rowZ = 0;
  for (let first = 0; first < plans.length; first += COLS_FP) {
    const row = [...Array(Math.min(COLS_FP, plans.length - first)).keys()].map(k => first + k);
    const width = row.reduce((a, i) => a + boxes[i].x1 - boxes[i].x0, 0) + GAP_FP * (row.length - 1);
    const depth = Math.max(...row.map(i => boxes[i].z1 - boxes[i].z0));
    let x = -width / 2;
    for (const i of row) {
      const p = plans[i], b = boxes[i];
      const ox = x - b.x0, oz = rowZ - b.z0;
      pads.push({ id: p.id, x: ox, z: oz, r: Math.hypot(b.x1 - b.x0, b.z1 - b.z0) / 2, x0: b.x0 + ox, x1: b.x1 + ox, z0: b.z0 + oz, z1: b.z1 + oz });
      for (const q of p.pieces) {
        const c = { ...q, x: +(q.x + ox).toFixed(3), z: +(q.z + oz).toFixed(3) };
        delete c.decor; delete c.idSign; delete c.outside;
        pieces.push(c);
        if (q.idSign) signs.push({ x: c.x, y: c.y, z: c.z, text: p.sign.text, id: p.id });
      }
      x += b.x1 - b.x0 + GAP_FP;
    }
    rowZ += depth + GAP_FP;
  }
  // the game centers a blueprint on the middle of its pieces and its lowest piece: the signs and boxes, the same way
  const xs = pieces.map(p => p.x), zs = pieces.map(p => p.z), ys = pieces.map(p => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2, y0 = Math.min(...ys);
  const r3 = v => +v.toFixed(3);
  for (const s of signs) { s.lx = r3(s.x - cx); s.ly = r3(s.y - y0); s.lz = r3(s.z - cz); }
  for (const p of pads) {
    p.x = r3(p.x - cx); p.z = r3(p.z - cz);
    p.x0 = r3(p.x0 - cx); p.x1 = r3(p.x1 - cx); p.z0 = r3(p.z0 - cz); p.z1 = r3(p.z1 - cz);
  }
  return { pieces, signs, pads, floorY: r3(-y0) };
}

function make(specs, name) {
  // the plans of one set share their templates, so no two plans show the same one
  const used = new Set();
  const plans = specs.map(s => floorplan({ ...s, used }));
  const { pieces, signs, pads, floorY } = layout(plans);
  const blueprint = BF.write({ meta: { Name: name, Creator: 'Villheim floorplan', Category: 'Villheim floorplans', Description: plans.map(p => `${p.id} ${p.command}`).join('; ') }, pieces });
  return {
    name, blueprint, pieces: pieces.length, signs, pads, floorY,
    rows: plans.map(p => ({ id: p.id, command: p.command, shape: p.shape, size: `${p.w}x${p.d}`, room: p.room, biome: p.biome, culture: p.culture, stage: p.decor, seed: p.seed, area: p.area, perTenM2: p.perTenM2, summary: p.summary })),
  };
}

function one(spec) { return make([spec], spec.id || 'floorplan'); }
function template(id, biome) { const sp = templatePlan(id, biome); return make([sp], sp.id); }
function set(n) { const k = Math.max(1, Math.min(CATALOG.length, n | 0)); return make([...Array(k).keys()].map(catalogSpec), `floorplans-${k}`); }

const apiFP = { floorplan, one, set, template, CATALOG, catalogSpec, SHAPES, ROOMS: Object.keys(ROOMS), BIOME_CODES };
if (NODE_FP) module.exports = apiFP; else window.VHFloorplan = apiFP;

})();
// ---- data
window.VH_RULES = {"placement": {"Candle_resin": {"rel": 0, "lift": 0.8}, "itemstandh": {"rel": 180, "lift": 0.6}, "piece_brazierceiling01": {"rel": 0, "lift": 4.6}, "piece_chair02": {"rel": 0, "lift": 0.5}, "piece_chest_barrel": {"rel": 0, "lift": 0.3}, "rug_straw": {"rel": 0, "lift": 0.35}, "fire_pit": {"rel": 180, "lift": 0.5}, "piece_cookingstation": {"rel": 0, "lift": 0.7}, "piece_workbench": {"rel": 0, "lift": 0.1}, "piece_workbench_ext1": {"rel": 0, "lift": 0.1}, "rug_deer": {"rel": 90, "lift": 0.4}, "portal_wood": {"rel": 0, "lift": 0.5}, "bed": {"rel": 270, "lift": 0.1}, "piece_workbench_ext2": {"rel": 0, "lift": 0.1}, "piece_groundtorch_wood": {"rel": 0, "lift": 0.7}, "piece_chest_wood": {"rel": 0, "lift": 0.1}, "sign": {"rel": 0, "lift": 0.7}, "piece_groundtorch": {"rel": 0, "lift": 1.2}, "piece_chest": {"rel": 0, "lift": 0.1}, "rug_fur": {"rel": 270, "lift": 0.1}, "fermenter": {"rel": 0, "lift": 0.1}, "itemstand": {"rel": 0, "lift": 2.1}, "piece_dvergr_lantern": {"rel": 90, "lift": 3.7}, "MountainKit_brazier": {"rel": 270, "lift": 2.0}, "piece_groundtorch_blue": {"rel": 0, "lift": 1.7}, "piece_jackoturnip": {"rel": 90, "lift": 0.6}, "guard_stone": {"rel": 0, "lift": 0.5}, "piece_workbench_ext3": {"rel": 0, "lift": 0.1}, "windmill": {"rel": 180, "lift": 0.3}, "fire_pit_iron": {"rel": 270, "lift": 0.5}, "forge_ext2": {"rel": 0, "lift": 0.1}, "piece_beehive": {"rel": 90, "lift": 0.6}, "forge_ext4": {"rel": 0, "lift": 0.2}, "forge": {"rel": 0, "lift": 0.2}, "forge_ext3": {"rel": 90, "lift": 0.3}, "forge_ext5": {"rel": 180, "lift": 0.3}, "forge_ext1": {"rel": 180, "lift": 0.3}, "piece_workbench_ext4": {"rel": 0, "lift": 1.9}, "forge_ext6": {"rel": 0, "lift": 2.3}, "ArmorStand": {"rel": 0, "lift": 0.1}, "cauldron_ext1_spice": {"rel": 0, "lift": 3.0}, "cauldron_ext3_butchertable": {"rel": 180, "lift": 0.2}, "cauldron_ext4_pots": {"rel": 0, "lift": 2.6}, "cauldron_ext5_mortarandpestle": {"rel": 0, "lift": 0.5}, "cauldron_ext6_rollingpins": {"rel": 0, "lift": 1.8}, "jute_carpet": {"rel": 0, "lift": 0.2}, "piece_cauldron": {"rel": 180, "lift": 0.8}, "piece_chair03": {"rel": 0, "lift": 0.1}, "piece_preptable": {"rel": 0, "lift": 0.2}, "piece_table_oak": {"rel": 90, "lift": 0.1}, "wood_core_stack": {"rel": 270, "lift": 0.5}, "hearth": {"rel": 0, "lift": 0.5}, "piece_groundtorch_green": {"rel": 270, "lift": 1.2}, "piece_stonecutter": {"rel": 180, "lift": 0.1}, "piece_groundtorch_mist": {"rel": 0, "lift": 4.6}, "piece_chair": {"rel": 270, "lift": 0.9}, "wood_fine_stack": {"rel": 0, "lift": 0.2}, "rug_wolf": {"rel": 270, "lift": 0.1}, "stone_pile": {"rel": 0, "lift": 0.5}, "wood_stack": {"rel": 270, "lift": 0.7}, "piece_chest_blackmetal": {"rel": 0, "lift": 0.1}, "$custompiece_stackedpoetrybooks1": {"rel": 0, "lift": 1.2}, "$custompiece_stackedpoetrybooks2": {"rel": 180, "lift": 0.7000000000000001}, "piece_chest_private": {"rel": 0, "lift": 0.1}, "hildir_maptable_coe": {"rel": 90, "lift": 0.2}, "hildir_chest_coe": {"rel": 90, "lift": 0.3}, "piece_banner04": {"rel": 270, "lift": 5.0}, "$custompiece_candlebottle": {"rel": 90, "lift": 1.0}, "rug_asksvin": {"rel": 180, "lift": 0.1}, "piece_table": {"rel": 0, "lift": 0.1}, "wood_dragon1": {"rel": 0, "lift": 2.5}, "piece_oven": {"rel": 270, "lift": 0.5}, "rug_Bjorn": {"rel": 0, "lift": 0.1}, "piece_Lavalantern": {"rel": 180, "lift": 0.9}, "piece_cookingstation_iron": {"rel": 0, "lift": 1.1}, "piece_bench01": {"rel": 0, "lift": 0.1}, "rug_hare": {"rel": 90, "lift": 0.6}, "piece_table_round": {"rel": 180, "lift": 0.1}, "piece_banner11": {"rel": 90, "lift": 8.2}, "piece_chest_treasure": {"rel": 0, "lift": 0.5}, "piece_throne01": {"rel": 0, "lift": 0.1}, "jute_carpet_blue": {"rel": 90, "lift": 0.5}, "piece_bed02": {"rel": 0, "lift": 0.1}, "treasure_stack": {"rel": 0, "lift": 0.5}, "piece_banner05": {"rel": 90, "lift": 3.9}, "smelter": {"rel": 90, "lift": 0.5}, "charcoal_kiln": {"rel": 270, "lift": 0.5}, "piece_banner01": {"rel": 90, "lift": 4.3}, "piece_logbench01": {"rel": 180, "lift": 0.1}, "eitrrefinery": {"rel": 180, "lift": 0.5}, "blackforge": {"rel": 0, "lift": 0.5}, "piece_spinningwheel": {"rel": 270, "lift": 0.1}, "piece_artisanstation": {"rel": 0, "lift": 2.0}, "piece_magetable": {"rel": 0, "lift": 0.2}, "piece_magetable_ext": {"rel": 0, "lift": 0.2}, "piece_magetable_ext2": {"rel": 0, "lift": 0.1}, "wood_yggdrasil_stack": {"rel": 270, "lift": 0.3}, "blastfurnace": {"rel": 0, "lift": 0.5}, "blackforge_ext2_vise": {"rel": 0, "lift": 0.5}, "blackforge_ext1": {"rel": 0, "lift": 0.2}, "piece_bone_throne": {"rel": 0, "lift": 0.5}, "skull_pile": {"rel": 270, "lift": 0.2}, "piece_banner10": {"rel": 270, "lift": 4.0}, "darkwood_raven": {"rel": 0, "lift": 3.0}, "piece_cartographytable": {"rel": 0, "lift": 0.1}, "piece_blackwood_bench01": {"rel": 180, "lift": 0.1}, "piece_xmastree": {"rel": 180, "lift": 0.4}, "blackforge_ext3_metalcutter": {"rel": 90, "lift": 0.2}, "blackforge_ext4_gemcutter": {"rel": 270, "lift": 1.2}, "ashwood_bed": {"rel": 90, "lift": 0.1}, "piece_banner07": {"rel": 270, "lift": 1.4}, "piece_banner03": {"rel": 90, "lift": 8.45}, "piece_banner06": {"rel": 270, "lift": 3.6500000000000004}, "piece_banner02": {"rel": 270, "lift": 3.4}, "darkwood_wolf": {"rel": 180, "lift": 6.6}, "barrell": {"rel": 90, "lift": 0.9}, "blackmarble_head_big01": {"rel": 0, "lift": 3.0}, "blackmarble_head_big02": {"rel": 0, "lift": 10.5}, "bone_stack": {"rel": 270, "lift": 1.0}, "CastleKit_groundtorch": {"rel": 90, "lift": 2.2}, "dvergrprops_chair": {"rel": 0, "lift": 0.1}, "dvergrprops_crate": {"rel": 90, "lift": 0.0}, "dvergrprops_crate_long": {"rel": 0, "lift": 4.5}, "dvergrprops_lantern_standing": {"rel": 270, "lift": 2.45}, "dvergrprops_stool": {"rel": 180, "lift": 0.7}, "dvergrprops_table": {"rel": 90, "lift": 2.2}, "piece_banner08": {"rel": 90, "lift": 3.9}, "piece_banner09": {"rel": 90, "lift": 4.2}, "piece_magetable_ext3": {"rel": 0, "lift": 2.7}, "trader_wagon_destructable": {"rel": 270, "lift": -0.2}, "piece_xmasgarland": {"rel": 270, "lift": 2.2}, "piece_xmascrown": {"rel": 90, "lift": 3.2}, "piece_world_blueprint_rune_stack": {"rel": 0, "lift": 0.7}, "artisan_ext1": {"rel": 0, "lift": 1.5}, "piece_throne02": {"rel": 0, "lift": 0.5}, "piece_bathtub": {"rel": 0, "lift": 0.1}, "piece_blackmarble_bench": {"rel": 0, "lift": 0.2}, "piece_blackmarble_throne": {"rel": 0, "lift": 6.6}, "goblinking_totemholder": {"rel": 180, "lift": 0.4}, "dvergrprops_lantern": {"rel": 270, "lift": 5.35}, "dvergrprops_barrel": {"rel": 270, "lift": 0.1}, "treasure_pile": {"rel": 0, "lift": 0.4}, "piece_blackmarble_table": {"rel": 0, "lift": 0.3}, "Fiddleheadfern": {"rel": 180, "lift": 0.1}, "Placeable_Stone": {"rel": 0, "lift": -0.8}, "CastleKit_groundtorch_green": {"rel": 180, "lift": 0.1}, "mudpile": {"rel": 0, "lift": 0.0}, "coal_pile": {"rel": 270, "lift": 0.2}, "mountainkit_table": {"rel": 180, "lift": 0.5}, "goblin_bed": {"rel": 0, "lift": 2.1}, "piece_wisplure": {"rel": 0, "lift": 0.6}, "blackwood_stack": {"rel": 180, "lift": 0.8}, "surtling_lantern_1": {"rel": 270, "lift": 0.6}, "Pickable_Fiddlehead": {"rel": 90, "lift": -0.95}, "portal": {"rel": 0, "lift": 0.8}, "MountainKit_brazier_blue": {"rel": 0, "lift": 2.0}, "blackmarble_pile": {"rel": 180, "lift": 0.6}, "volture_strawpile": {"rel": 0, "lift": 5.65}, "mm_corewood_stackable_chest": {"rel": 270, "lift": 1.0}, "blackmarble_head02": {"rel": 0, "lift": 4.3}, "blackmarble_head01": {"rel": 90, "lift": 0.8}, "sign_notext": {"rel": 180, "lift": 2.3}, "GB_Hanging_Candles": {"rel": 0, "lift": 3.6}, "$custompiece_roundtablewithcloth": {"rel": 0, "lift": 0.5}, "mm_corewood_crate_onion": {"rel": 90, "lift": 2.55}, "MountainKit_brazier_purple": {"rel": 0, "lift": 1.5}, "cauldron_ext7_smoker": {"rel": 0, "lift": 0.5}, "piece_chest_warderobe": {"rel": 180, "lift": 0.1}, "piece_magetable_ext4": {"rel": 0, "lift": 0.5}, "piece_moose_throne": {"rel": 270, "lift": 0.2}, "blackforge_ext5_apron": {"rel": 0, "lift": 2.0}, "pressurePlate_stone_PressurePlate_Items_AddPlateItem": {"rel": 270, "lift": 0.5}, "pressurePlate_PressurePlate_Items_AddPlateItem": {"rel": 180, "lift": 0.1}, "apiary_ext2": {"rel": 180, "lift": -0.1}, "apiary_ext1": {"rel": 180, "lift": 0.7}, "M_Werewolf_Throne": {"rel": 90, "lift": 0.5}, "piece_chest_grausten": {"rel": 0, "lift": 0.1}, "piece_bench_runed": {"rel": 0, "lift": 0.1}, "rug_seal": {"rel": 180, "lift": 0.1}, "piece_table_runed_small": {"rel": 0, "lift": 0.5}, "piece_chair_runed": {"rel": 180, "lift": 0.3}, "piece_table_runed": {"rel": 0, "lift": 0.5}, "piece_hoodedlantern": {"rel": 0, "lift": 5.4}, "rug_moose": {"rel": 180, "lift": 0.1}, "CastleKit_groundtorch_blue": {"rel": 180, "lift": 0.4}, "piece_chest_barrel_bal": {"rel": 270, "lift": 1.3}, "piece_chest_seedbasket_bal": {"rel": 0, "lift": 0.8}, "fire_pit_hildir": {"rel": 270, "lift": 0.5}, "piece_drawer": {"rel": 180, "lift": 1.5}, "deepnorth_lantern_standing": {"rel": 270, "lift": 0.2}, "portal_stone": {"rel": 0, "lift": 0.9}, "flint_pile": {"rel": 270, "lift": 0.6}, "grausten_pile": {"rel": 180, "lift": -0.1}, "prop_itemstand_TrophyGoblinBrute": {"rel": 0, "lift": 1.5}, "rug_bogwitch_deer": {"rel": 0, "lift": 0.5}, "Candle_resin_bogwitch": {"rel": 270, "lift": 0.1}, "VC_Eldhrimnir_ext2": {"rel": 180, "lift": 0.6}, "teq_dv_ferm_fermenter": {"rel": 180, "lift": 0.1}, "corewood_crate_bal": {"rel": 180, "lift": 0.5}, "$custompiece_rug_fur_tablecloth": {"rel": 270, "lift": 1.2}, "$custompiece_rug_wolf_tablecloth": {"rel": 180, "lift": 1.2}, "h_woodtorch_white": {"rel": 0, "lift": 1.8}, "CastleKit_brazier": {"rel": 270, "lift": 14.75}, "loot_chest_wood": {"rel": 180, "lift": 15.2}, "goblin_banner": {"rel": 180, "lift": 6.7}, "piece_banner_BlackSaga1": {"rel": 90, "lift": 4.3}, "$custompiece_stool": {"rel": 0, "lift": -0.1}, "rk_rugsmall": {"rel": 270, "lift": 0.2}, "loot_chest_stone": {"rel": 0, "lift": 9.75}, "mudpile_old": {"rel": 0, "lift": 8.7}, "piece_seed_totem_auto_field": {"rel": 0, "lift": -0.5}, "dvergr_chest_bal": {"rel": 0, "lift": 0.1}, "piece_chest_private_bal": {"rel": 180, "lift": 1.0}, "itemstand45_inner_bal": {"rel": 0, "lift": 1.5}, "rk_oven": {"rel": 180, "lift": 0.1}, "goblin_trashpile": {"rel": 180, "lift": 0.8}, "rae_darkwood_iron_raven": {"rel": 90, "lift": 2.8}, "goblin_strawpile": {"rel": 0, "lift": -2.0}, "dvergrprops_bed": {"rel": 0, "lift": 3.25}, "$custompiece_couchbed1": {"rel": 0, "lift": 0.1}}};
window.VH_SCORER = {
 "names": [
  "log_pieces",
  "log_kinds",
  "wall",
  "floor",
  "roof",
  "beam",
  "pole",
  "openings",
  "furniture",
  "deco",
  "light",
  "nature",
  "misc",
  "mat_entropy",
  "decor_density",
  "height_ratio",
  "log_area",
  "levels",
  "diag",
  "roof_cover",
  "top_mat_share"
 ],
 "mean": [
  6.764891996974292,
  3.7009830559757915,
  0.25525028744326733,
  0.15991744326777615,
  0.10809491679273836,
  0.20999481089258684,
  0.12264177004538558,
  0.006414175491679272,
  0.040534220877458345,
  0.03861850226928894,
  0.008202723146747347,
  0.015248577912254155,
  0.01618373676248109,
  1.0036597125567313,
  0.3191787443267776,
  2.1701556580937984,
  5.787639939485628,
  7.285930408472012,
  0.5255306505295007,
  0.6668055219364604,
  0.6315766565809375
 ],
 "std": [
  1.4215922098319655,
  0.9148187963203895,
  0.18335452621181772,
  0.11665639865584233,
  0.09477297713735185,
  0.12363055353566728,
  0.08375973920258502,
  0.010836488620862207,
  0.054810634815982855,
  0.07677963281173499,
  0.0161939653272697,
  0.04555006916270081,
  0.04293323320583611,
  0.48724151345369365,
  0.783920806262776,
  18.443842210205016,
  1.3558449264782908,
  8.994784096634447,
  0.42151331053268,
  0.5977517801708216,
  0.1987993006762224
 ],
 "w": [
  -0.6390229090705772,
  0.6909294902345111,
  -0.08113794918181771,
  -0.27686606989229673,
  0.2904262217548144,
  0.04175112844462465,
  0.2951028947979103,
  0.13708589675815175,
  0.17470835676460106,
  0.003004685642491017,
  -0.44451473570723904,
  -0.10848628245675804,
  -0.2739070955433602,
  -0.16754909991683542,
  0.2200480955038386,
  -0.050363236895286836,
  -0.009483277314407216,
  0.08896574583393844,
  0.2111367322272386,
  0.06784251585535234,
  0.1304350411423744
 ],
 "bias": -0.1930183434933209,
 "auc": 0.6985003382215925,
 "n_kept": 206,
 "n_dropped": 455
};
window.VH_INTERIOR = {"meta":{"designs":497,"rooms":2686},"stand":{"wood_floor":0.1,"stone_floor_2x2":0.5,"wood_floor_1x1":0.1,"ashwood_floor_2x2":0.1,"ashwood_floor_1x1":0.1,"stone_floor":0.5,"blackmarble_floor":0.5,"Piece_grausten_floor_2x2":0.25,"Piece_grausten_floor_4x4":0.25,"Piece_grausten_floor_1x1":0.25,"iron_floor_2x2":0.05,"ashwood_deco_floor":0.09,"blackmarble_tile_floor_2x2":0.2,"blackmarble_floor_triangle":0.46,"mm_castle_floor":0.08,"mm_castle_floor_2x2":0.11,"blackmarble_tile_floor_1x1":0.1,"iron_floor_1x1_v2":0.5,"dvergrprops_wood_floor":0.1},"doors":{"freeDepth":[2.96,4,4,4,4],"byRoom":{"smithy":[2.16,4,4],"workshop":[2.44,4,4],"storage":[0.95,4,4],"other":[4,4,4],"hall":[3.99,4,4],"home":[1.62,4,4],"sleeping":[2.37,4,4],"kitchen":[3.49,4,4],"living":[3,4,4],"tavern":[2.58,4,4]}},"rooms":{"other":{"n":831,"area":[6.75,12.25,42.5],"perTenM2":[0.82,2.22,5],"items":[["itemstand",0.21,5.7],["piece_dvergr_lantern",0.19,2],["piece_walltorch",0.16,2.3],["sign",0.15,6.2],["rug_fur",0.13,2.6],["itemstandh",0.12,15.2],["goblinking_totemholder",0.11,2.7],["ArmorStand",0.09,3],["jute_carpet",0.09,3.8],["rug_deer",0.08,2.6],["piece_chest",0.07,2.5],["piece_chest_blackmetal",0.06,2.7],["piece_banner04",0.06,1.8],["piece_chest_wood",0.06,2],["piece_groundtorch_wood",0.05,1.8],["rug_wolf",0.05,1.9],["piece_groundtorch_mist",0.05,2.9],["fermenter",0.04,2.5],["portal_wood",0.04,2.6],["piece_banner11",0.03,2.8],["piece_groundtorch",0.03,2],["piece_chest_barrel",0.03,1.8],["piece_Lavalantern",0.03,1.8],["piece_bathtub",0.03,1],["piece_banner01",0.02,1.6],["wood_dragon1",0.02,2.6],["piece_chair",0.02,1],["piece_banner05",0.02,1.4],["rug_straw",0.02,6.7],["piece_chair03",0.02,1],["piece_banner02",0.02,1.7],["piece_table",0.02,1],["piece_xmastree",0.02,1.1],["Candle_resin",0.02,2.3],["piece_brazierceiling01",0.01,1.1],["piece_banner08",0.01,1.3],["rug_Bjorn",0.01,1],["piece_bench01",0.01,1],["guard_stone",0.01,1.2],["piece_banner03",0.01,1]]},"smithy":{"n":234,"area":[30.5,76.5,189.5],"perTenM2":[1.33,2.34,4.15],"items":[["forge",0.62,1],["forge_ext5",0.57,1.1],["piece_workbench",0.51,1],["forge_ext1",0.44,1],["forge_ext4",0.42,1],["piece_walltorch",0.38,4.3],["forge_ext2",0.37,1],["piece_workbench_ext1",0.37,1],["forge_ext3",0.36,1],["itemstand",0.34,8.7],["piece_chest_wood",0.29,5.9],["piece_chest",0.29,4.3],["rug_deer",0.29,4.8],["piece_workbench_ext2",0.28,1],["piece_workbench_ext3",0.27,1],["sign",0.23,9.2],["blackforge",0.22,1.1],["rug_wolf",0.21,2.9],["itemstandh",0.2,11],["rug_fur",0.19,2.9],["piece_dvergr_lantern",0.19,3.9],["piece_chest_blackmetal",0.18,2.5],["piece_table",0.18,1.5],["cauldron_ext3_butchertable",0.17,1],["piece_chair",0.16,3.3],["blackforge_ext2_vise",0.16,1],["ArmorStand",0.15,2.5],["hearth",0.15,1.2],["piece_chair02",0.15,2.4],["jute_carpet",0.14,4.2],["piece_chest_barrel",0.14,2.9],["piece_magetable_ext",0.13,1.1],["piece_chair03",0.12,5],["piece_magetable",0.12,1],["piece_artisanstation",0.11,1],["piece_spinningwheel",0.1,1.1],["piece_groundtorch",0.1,3.2],["piece_groundtorch_wood",0.09,2.9],["piece_bench01",0.09,1.9],["piece_banner01",0.09,3.7]]},"workshop":{"n":122,"area":[9,29,70.5],"perTenM2":[1.13,2.16,5.71],"items":[["piece_workbench",0.57,1],["rug_deer",0.31,2.3],["itemstand",0.25,3.8],["piece_chest_wood",0.25,4.6],["piece_workbench_ext1",0.21,1.1],["piece_workbench_ext2",0.2,1],["piece_walltorch",0.17,2.5],["piece_dvergr_lantern",0.17,2.1],["piece_groundtorch_wood",0.16,2.8],["piece_artisanstation",0.16,1],["sign",0.15,5.8],["rug_fur",0.13,1.9],["piece_workbench_ext3",0.11,1],["piece_chest_barrel",0.11,3.2],["piece_spinningwheel",0.1,1.6],["itemstandh",0.1,4.2],["rug_wolf",0.09,1.3],["piece_table",0.08,1.1],["piece_stonecutter",0.08,1],["piece_chair03",0.07,1.1],["piece_chair",0.07,1],["jute_carpet_blue",0.07,2.1],["piece_chest_blackmetal",0.07,4.1],["ArmorStand",0.06,5.1],["piece_groundtorch",0.06,1.7],["jute_carpet",0.06,2.7],["hearth",0.05,1],["goblinking_totemholder",0.05,5],["artisan_ext1",0.05,1],["piece_magetable",0.05,1],["piece_chest",0.04,4],["piece_throne01",0.04,1],["piece_logbench01",0.04,1.2],["piece_bench01",0.04,1],["stone_pile",0.04,5.4],["piece_banner08",0.04,1.2],["fermenter",0.04,1.8],["piece_magetable_ext",0.04,1],["piece_Lavalantern",0.04,2],["portal_wood",0.03,1.8]]},"storage":{"n":428,"area":[4.5,7.5,20.5],"perTenM2":[4,7.62,10],"items":[["piece_chest_wood",0.59,6.7],["piece_chest_blackmetal",0.21,4.8],["piece_chest",0.19,5.2],["piece_walltorch",0.07,3.4],["piece_chest_barrel",0.05,4.6],["sign",0.05,4.4],["piece_dvergr_lantern",0.04,2.2],["piece_chest_private",0.04,2.8],["rug_deer",0.03,3.4],["piece_groundtorch_wood",0.03,3.1],["hearth",0.03,1.1],["rug_fur",0.03,1.8],["jute_carpet",0.03,1.4],["itemstand",0.02,2.2],["cauldron_ext3_butchertable",0.02,1],["itemstandh",0.02,2.1],["piece_groundtorch",0.02,2],["piece_banner01",0.02,2],["piece_groundtorch_mist",0.01,2.3],["piece_table",0.01,1.6],["rug_wolf",0.01,1.4],["piece_oven",0.01,2.4],["piece_chair02",0.01,1.6],["piece_chest_warderobe",0.01,6],["fermenter",0.01,1.8],["piece_Lavalantern",0.01,1.2],["piece_chair",0.01,2],["piece_bench01",0.01,2],["piece_banner04",0.01,1.3],["piece_cartographytable",0.01,1],["portal_wood",0.01,1.3],["ArmorStand",0.01,2.3],["rug_asksvin",0.01,1],["piece_logbench01",0.01,1.7]]},"living":{"n":234,"area":[14.5,36,70.5],"perTenM2":[1.23,2.34,4.53],"items":[["piece_chair03",0.41,2.9],["itemstandh",0.27,12.3],["itemstand",0.27,7.8],["piece_chair",0.25,2.4],["piece_table",0.24,1.3],["rug_fur",0.2,4.4],["piece_walltorch",0.2,2.3],["piece_table_round",0.19,1.1],["piece_chair02",0.18,2.2],["piece_bench01",0.18,2.2],["rug_deer",0.17,2.4],["piece_dvergr_lantern",0.14,2.1],["rug_wolf",0.12,2],["jute_carpet",0.11,4],["sign",0.11,4.2],["piece_groundtorch_wood",0.08,2.2],["piece_table_oak",0.08,1],["ArmorStand",0.07,2.2],["piece_chest",0.07,1.6],["piece_chest_wood",0.06,2.2],["piece_jackoturnip",0.06,1.2],["piece_blackwood_bench01",0.06,2.6],["piece_banner01",0.06,2],["piece_Lavalantern",0.06,1.6],["piece_chest_barrel",0.05,2.4],["piece_logbench01",0.05,2.1],["jute_carpet_blue",0.05,1.6],["piece_brazierceiling01",0.05,1.3],["piece_banner05",0.04,1.9],["piece_blackmarble_bench",0.04,2.6],["piece_groundtorch_mist",0.03,3.4],["piece_banner02",0.03,1.9],["goblinking_totemholder",0.03,2.5],["rug_asksvin",0.03,1.5],["piece_banner04",0.03,2.4],["piece_bathtub",0.03,1],["portal_wood",0.03,3],["piece_xmastree",0.03,1.3],["dvergrprops_lantern_standing",0.03,1.2],["piece_groundtorch",0.03,3.3]]},"sleeping":{"n":333,"area":[20,39.25,83],"perTenM2":[1.09,1.85,3.27],"items":[["piece_bed02",0.57,1.3],["rug_fur",0.39,3.8],["rug_wolf",0.31,2.7],["bed",0.27,2.4],["ArmorStand",0.23,2],["rug_deer",0.23,2.8],["itemstand",0.23,5.9],["piece_walltorch",0.22,2],["piece_chair",0.22,1.8],["piece_chest_wood",0.21,3.1],["piece_chair03",0.21,1.7],["piece_dvergr_lantern",0.21,2.8],["sign",0.18,3.7],["piece_chest",0.17,1.7],["ashwood_bed",0.17,2.1],["jute_carpet",0.17,3.6],["piece_table",0.14,1.2],["itemstandh",0.11,5.9],["piece_chest_blackmetal",0.11,1.8],["piece_chair02",0.1,1.6],["piece_chest_private",0.1,2.5],["piece_groundtorch_wood",0.1,2.8],["piece_banner01",0.1,1.7],["piece_table_round",0.09,1],["piece_banner02",0.08,1.8],["piece_workbench",0.07,1],["piece_banner04",0.07,1.6],["piece_throne01",0.07,1.2],["goblinking_totemholder",0.07,2.1],["piece_xmastree",0.07,1.1],["piece_banner05",0.06,1.2],["piece_chest_barrel",0.06,1.9],["piece_Lavalantern",0.06,1.5],["rug_asksvin",0.06,5.1],["Candle_resin",0.05,3.8],["jute_carpet_blue",0.05,3.5],["piece_bathtub",0.05,1],["piece_brazierceiling01",0.04,1.6],["piece_bench01",0.04,1.3],["piece_jackoturnip",0.04,1]]},"kitchen":{"n":78,"area":[15.25,41.25,100.25],"perTenM2":[1.35,2.42,4.44],"items":[["cauldron_ext3_butchertable",0.54,1],["itemstand",0.38,8.7],["itemstandh",0.33,12.5],["piece_oven",0.32,2.1],["piece_chest",0.28,2.3],["rug_fur",0.28,2.3],["piece_preptable",0.26,1.1],["hearth",0.23,1.3],["sign",0.23,8.3],["piece_walltorch",0.23,3.1],["cauldron_ext5_mortarandpestle",0.22,1.1],["piece_chair03",0.21,2.6],["piece_cauldron",0.19,1.1],["piece_chest_wood",0.19,2.5],["rug_deer",0.19,1.9],["rug_wolf",0.18,1.9],["piece_chest_barrel",0.18,2.4],["fire_pit",0.15,1.5],["piece_dvergr_lantern",0.13,1.9],["piece_chest_blackmetal",0.12,4.3],["piece_table",0.12,1],["ArmorStand",0.12,2],["piece_table_round",0.1,1],["piece_chair02",0.1,1.8],["fermenter",0.09,2.3],["piece_cookingstation_iron",0.09,1],["jute_carpet",0.09,1.3],["piece_chair",0.08,1.3],["piece_cookingstation",0.06,2.4],["piece_groundtorch",0.06,4.2],["rug_hare",0.06,2],["piece_groundtorch_wood",0.05,1],["piece_groundtorch_mist",0.05,3.2],["piece_banner01",0.05,1.5],["piece_brazierceiling01",0.04,1],["piece_banner02",0.04,1.7],["piece_banner04",0.04,1],["piece_xmastree",0.04,6.3],["portal_wood",0.04,1.7],["wood_dragon1",0.04,4]]},"tavern":{"n":148,"area":[68.25,135.25,230.25],"perTenM2":[1.31,2.22,3.43],"items":[["piece_chair03",0.51,7.9],["itemstandh",0.45,14.2],["itemstand",0.45,6.3],["piece_walltorch",0.4,3.8],["piece_table",0.39,2.5],["rug_fur",0.34,4.5],["piece_table_round",0.33,1.7],["piece_chair",0.32,5.7],["rug_wolf",0.32,3.3],["rug_deer",0.3,4.3],["piece_dvergr_lantern",0.3,3.4],["cauldron_ext3_butchertable",0.27,1.1],["jute_carpet",0.26,4.1],["piece_table_oak",0.26,1.4],["piece_throne01",0.26,1.8],["piece_chest_wood",0.24,2.8],["piece_chair02",0.24,3.7],["sign",0.24,9],["piece_chest",0.24,2.5],["hearth",0.23,1.3],["piece_oven",0.18,1.5],["ArmorStand",0.18,2.1],["piece_bench01",0.16,3.5],["cauldron_ext5_mortarandpestle",0.16,1],["piece_workbench",0.14,1.2],["fermenter",0.14,1.9],["piece_preptable",0.14,1.1],["piece_chest_barrel",0.14,4.2],["piece_banner01",0.13,1.9],["piece_Lavalantern",0.12,2.3],["piece_chest_blackmetal",0.11,3.9],["rug_asksvin",0.1,1.9],["piece_cartographytable",0.09,1],["jute_carpet_blue",0.09,1.7],["piece_groundtorch",0.09,2.5],["piece_blackmarble_bench",0.08,2.9],["piece_magetable",0.08,1],["rug_hare",0.07,3.1],["piece_blackwood_bench01",0.07,2],["Candle_resin",0.07,3.6]]},"hall":{"n":153,"area":[18.75,55.25,107],"perTenM2":[0.86,1.76,3.33],"items":[["piece_throne01",0.47,1.5],["hearth",0.38,1.2],["rug_fur",0.3,3.4],["itemstand",0.29,5.4],["rug_wolf",0.28,2.3],["itemstandh",0.22,8.9],["piece_chair03",0.22,2.6],["rug_deer",0.22,2.3],["piece_walltorch",0.21,3.2],["piece_table_round",0.18,1],["jute_carpet",0.18,5.1],["ArmorStand",0.15,2.5],["piece_chest",0.14,1.5],["goblinking_totemholder",0.14,3.2],["sign",0.13,12.4],["piece_dvergr_lantern",0.13,2.7],["piece_chair",0.11,1.6],["piece_chest_wood",0.1,2.7],["jute_carpet_blue",0.09,1.9],["piece_table",0.08,1],["piece_chest_blackmetal",0.08,1.6],["piece_blackmarble_throne",0.08,1.7],["piece_bench01",0.08,1.9],["piece_banner01",0.07,2.2],["piece_chair02",0.07,1.2],["piece_blackmarble_table",0.07,1.4],["piece_groundtorch",0.07,1.7],["piece_table_oak",0.07,1.3],["piece_throne02",0.07,1.3],["portal_wood",0.06,3.6],["piece_bone_throne",0.06,1.2],["piece_bathtub",0.05,1],["fire_pit_iron",0.05,1.6],["piece_chest_private",0.05,1.4],["piece_banner05",0.05,1.8],["rug_hare",0.05,2.6],["piece_groundtorch_blue",0.05,4.6],["piece_cartographytable",0.05,1],["piece_groundtorch_green",0.05,2.7],["piece_banner07",0.04,3.2]]},"home":{"n":125,"area":[67.25,96.75,186],"perTenM2":[1.48,2.27,3.08],"items":[["piece_bed02",0.62,1.4],["piece_chair03",0.6,3.1],["piece_chair",0.5,2.8],["rug_fur",0.5,5.6],["rug_deer",0.48,3.6],["itemstand",0.42,6.5],["rug_wolf",0.41,2.6],["piece_table",0.4,1.5],["ArmorStand",0.38,2.7],["piece_table_round",0.38,1.1],["piece_walltorch",0.36,4.2],["piece_chest_wood",0.33,4.9],["piece_throne01",0.33,1.6],["piece_chest",0.31,2.8],["itemstandh",0.3,12.1],["piece_chair02",0.29,2],["jute_carpet",0.25,4],["piece_chest_blackmetal",0.24,2],["bed",0.24,1.7],["sign",0.22,20.1],["piece_workbench",0.22,1.1],["piece_chest_private",0.2,2],["piece_bench01",0.16,1.9],["hearth",0.16,1.1],["piece_chest_barrel",0.15,3.6],["piece_brazierceiling01",0.15,1.2],["piece_xmastree",0.14,1.4],["piece_banner01",0.14,2.1],["piece_cartographytable",0.14,1],["piece_dvergr_lantern",0.14,2.7],["ashwood_bed",0.14,1.6],["piece_bathtub",0.14,1.1],["forge",0.13,1.1],["piece_Lavalantern",0.13,1.6],["piece_groundtorch_wood",0.11,3.4],["piece_logbench01",0.1,1.5],["piece_banner04",0.1,2.6],["piece_workbench_ext2",0.1,1.2],["piece_banner02",0.1,1.5],["goblinking_totemholder",0.1,7]]}},"items":{"piece_chest":{"n":1279,"rel":0,"wall":0.64,"lift":0.04,"under":null,"door":2.19,"corner":0.53,"back":0.55},"piece_groundtorch":{"n":274,"rel":-1,"wall":0.39,"lift":0.75,"under":0.42,"door":2.52,"corner":0.36,"back":0.22},"forge_ext4":{"n":107,"rel":-1,"wall":0.6,"lift":0,"under":null,"door":2.96,"corner":0.54,"back":0.28},"piece_workbench":{"n":276,"rel":0,"wall":0.7,"lift":0.05,"under":null,"door":2.72,"corner":0.11,"back":0.62},"piece_workbench_ext1":{"n":148,"rel":-1,"wall":0.58,"lift":0.05,"under":null,"door":1.61,"corner":0.39,"back":0.5},"portal_wood":{"n":214,"rel":0,"wall":0.54,"lift":0.05,"under":null,"door":2.97,"corner":0.12,"back":0.28},"piece_groundtorch_blue":{"n":125,"rel":270,"wall":0.41,"lift":0.7,"under":0.35,"door":1.55,"corner":0.55,"back":0.36},"itemstand":{"n":4034,"rel":0,"wall":0.24,"lift":2.4,"under":0.9,"door":1.43,"corner":0.33,"back":0.19},"piece_walltorch":{"n":1660,"rel":270,"wall":0.38,"lift":2.29,"under":1.47,"door":1.18,"corner":0.28,"back":0.03},"forge_ext3":{"n":96,"rel":90,"wall":0.54,"lift":0.05,"under":null,"door":2.61,"corner":0.39,"back":0.74},"forge_ext5":{"n":168,"rel":-1,"wall":0.64,"lift":0.06,"under":null,"door":3.32,"corner":0.39,"back":0.61},"forge_ext1":{"n":110,"rel":180,"wall":0.79,"lift":0.05,"under":null,"door":3.97,"corner":0.27,"back":0.86},"forge":{"n":170,"rel":0,"wall":0.68,"lift":0.02,"under":null,"door":2.97,"corner":0.16,"back":0.57},"piece_stonecutter":{"n":32,"rel":0,"wall":0.76,"lift":0.02,"under":null,"door":1.96,"corner":0.2,"back":0.72},"forge_ext2":{"n":99,"rel":-1,"wall":0.55,"lift":0.06,"under":null,"door":1.89,"corner":0.41,"back":0.58},"hearth":{"n":218,"rel":90,"wall":0.44,"lift":0,"under":null,"door":4.36,"corner":0.22,"back":1},"piece_table":{"n":464,"rel":0,"wall":0.7,"lift":0.03,"under":null,"door":2.71,"corner":0.23,"back":0.56},"piece_chair02":{"n":470,"rel":-1,"wall":0.68,"lift":0.07,"under":null,"door":2.54,"corner":0.37,"back":0.85},"piece_chest_wood":{"n":2935,"rel":0,"wall":0.6,"lift":0.08,"under":null,"door":2.02,"corner":0.58,"back":0.53},"fermenter":{"n":239,"rel":0,"wall":0.77,"lift":0.06,"under":null,"door":2.31,"corner":0.62,"back":0.85},"rug_wolf":{"n":982,"rel":270,"wall":0.53,"lift":0.05,"under":null,"door":1.97,"corner":0.33,"back":1.15},"piece_brazierceiling01":{"n":128,"rel":90,"wall":0.83,"lift":3.63,"under":1.63,"door":1.59,"corner":0.38,"back":null},"piece_chair":{"n":912,"rel":-1,"wall":0.56,"lift":0.03,"under":null,"door":2.64,"corner":0.37,"back":0.5},"rug_deer":{"n":1465,"rel":-1,"wall":0.55,"lift":0.05,"under":null,"door":1.9,"corner":0.27,"back":1.26},"piece_banner04":{"n":246,"rel":270,"wall":0.3,"lift":3.73,"under":0.51,"door":1.77,"corner":0.25,"back":0.78},"piece_workbench_ext3":{"n":90,"rel":0,"wall":0.61,"lift":0.07,"under":null,"door":2.89,"corner":0.36,"back":0.54},"wood_fine_stack":{"n":40,"rel":270,"wall":0.74,"lift":0.08,"under":null,"door":2.54,"corner":0.71,"back":0.92},"stone_pile":{"n":86,"rel":-1,"wall":0.74,"lift":0.14,"under":null,"door":3.43,"corner":0.58,"back":0.65},"piece_chest_blackmetal":{"n":951,"rel":0,"wall":0.66,"lift":0.05,"under":null,"door":2.74,"corner":0.51,"back":0.59},"piece_chest_private":{"n":302,"rel":0,"wall":0.55,"lift":0.05,"under":null,"door":3.03,"corner":0.49,"back":0.49},"bed":{"n":265,"rel":270,"wall":0.75,"lift":0.09,"under":null,"door":3.68,"corner":0.06,"back":1.6},"rug_straw":{"n":205,"rel":-1,"wall":0.67,"lift":0.1,"under":null,"door":1.35,"corner":0.39,"back":0.67},"piece_workbench_ext2":{"n":123,"rel":0,"wall":0.61,"lift":0.09,"under":null,"door":2.2,"corner":0.23,"back":0.37},"piece_groundtorch_wood":{"n":456,"rel":-1,"wall":0.37,"lift":0.75,"under":0.44,"door":1.27,"corner":0.42,"back":0.33},"piece_chair03":{"n":1536,"rel":-1,"wall":0.64,"lift":0.08,"under":null,"door":3.31,"corner":0.37,"back":0.65},"cauldron_ext5_mortarandpestle":{"n":68,"rel":90,"wall":0.59,"lift":0.02,"under":null,"door":3.08,"corner":0.36,"back":0.6},"itemstandh":{"n":5182,"rel":90,"wall":0.26,"lift":0.89,"under":0.81,"door":3.15,"corner":0.26,"back":0.37},"piece_table_round":{"n":285,"rel":-1,"wall":0.43,"lift":0.08,"under":null,"door":3.41,"corner":0.18,"back":1.26},"piece_throne01":{"n":304,"rel":-1,"wall":0.64,"lift":0.05,"under":null,"door":3.03,"corner":0.39,"back":0.6},"jute_carpet_blue":{"n":209,"rel":0,"wall":0.43,"lift":0.07,"under":null,"door":2.5,"corner":0.23,"back":0.86},"piece_chest_treasure":{"n":42,"rel":-1,"wall":0.68,"lift":0.08,"under":null,"door":2.14,"corner":0.46,"back":0.51},"rug_fur":{"n":1959,"rel":180,"wall":0.5,"lift":0.05,"under":null,"door":2.27,"corner":0.39,"back":0.7},"ArmorStand":{"n":814,"rel":0,"wall":0.58,"lift":0.06,"under":1.99,"door":1.61,"corner":0.36,"back":0.4},"piece_bed02":{"n":355,"rel":90,"wall":0.49,"lift":0.14,"under":null,"door":2.54,"corner":0.19,"back":1.7},"piece_bench01":{"n":314,"rel":0,"wall":0.61,"lift":0.03,"under":null,"door":2.94,"corner":0.15,"back":0.53},"blackforge_ext2_vise":{"n":42,"rel":-1,"wall":0.65,"lift":0.06,"under":null,"door":4.31,"corner":0.44,"back":0.6},"sign":{"n":3040,"rel":0,"wall":0.29,"lift":2.18,"under":0.75,"door":1.18,"corner":0.3,"back":0.25},"rug_Bjorn":{"n":37,"rel":270,"wall":0.55,"lift":0,"under":null,"door":1.66,"corner":0.17,"back":0.82},"piece_banner01":{"n":306,"rel":270,"wall":0.3,"lift":3.55,"under":0.33,"door":1.9,"corner":0.4,"back":2.47},"piece_logbench01":{"n":118,"rel":180,"wall":0.5,"lift":0.12,"under":null,"door":3.06,"corner":0.16,"back":1.44},"wood_dragon1":{"n":232,"rel":90,"wall":0,"lift":2.55,"under":1,"door":1,"corner":0.41,"back":0},"fire_pit":{"n":56,"rel":-1,"wall":0.76,"lift":0,"under":null,"door":2.32,"corner":0.56,"back":0.44},"piece_cookingstation":{"n":35,"rel":180,"wall":0.73,"lift":0.2,"under":null,"door":5.39,"corner":0.58,"back":0.85},"piece_chest_barrel":{"n":532,"rel":-1,"wall":0.57,"lift":0.05,"under":null,"door":2.36,"corner":0.46,"back":0.51},"cauldron_ext3_butchertable":{"n":155,"rel":180,"wall":0.7,"lift":0.03,"under":null,"door":3.11,"corner":0.51,"back":0.57},"rug_hare":{"n":187,"rel":-1,"wall":0.59,"lift":0.05,"under":null,"door":1.23,"corner":0.59,"back":0.5},"jute_carpet":{"n":1181,"rel":0,"wall":0.39,"lift":0.06,"under":null,"door":1.85,"corner":0.37,"back":0.8},"dvergrprops_lantern_standing":{"n":99,"rel":180,"wall":0.05,"lift":3.18,"under":1.77,"door":2.66,"corner":0.22,"back":3.75},"piece_oven":{"n":151,"rel":270,"wall":0.5,"lift":0,"under":null,"door":4.27,"corner":0.36,"back":0.98},"piece_cauldron":{"n":32,"rel":-1,"wall":0.8,"lift":0.2,"under":null,"door":3.64,"corner":0.17,"back":0.87},"piece_banner07":{"n":67,"rel":90,"wall":0.3,"lift":3.13,"under":0.44,"door":1.81,"corner":0.38,"back":1.38},"piece_cartographytable":{"n":78,"rel":180,"wall":0.8,"lift":0.03,"under":null,"door":2.68,"corner":0.29,"back":0.91},"piece_xmastree":{"n":135,"rel":-1,"wall":0.63,"lift":0.2,"under":2.59,"door":2.68,"corner":0.57,"back":0.63},"rug_asksvin":{"n":189,"rel":-1,"wall":0.68,"lift":0.1,"under":null,"door":3.11,"corner":0.47,"back":1.27},"piece_Lavalantern":{"n":205,"rel":-1,"wall":0.39,"lift":0.99,"under":1,"door":3.33,"corner":0.56,"back":0.28},"piece_dvergr_lantern":{"n":1109,"rel":90,"wall":0.01,"lift":3.63,"under":0.35,"door":1,"corner":0.28,"back":0},"piece_preptable":{"n":75,"rel":0,"wall":0.59,"lift":0.05,"under":null,"door":2.82,"corner":0.4,"back":0.42},"piece_table_oak":{"n":125,"rel":0,"wall":0.63,"lift":0.04,"under":null,"door":4.65,"corner":0.19,"back":0.83},"piece_banner08":{"n":77,"rel":90,"wall":0.36,"lift":3.66,"under":0.29,"door":1.65,"corner":0.34,"back":1.24},"darkwood_wolf":{"n":31,"rel":270,"wall":0,"lift":3.05,"under":2.75,"door":0.74,"corner":0.24,"back":3.33},"piece_banner02":{"n":184,"rel":90,"wall":0.3,"lift":3.57,"under":0.65,"door":1.42,"corner":0.34,"back":2.47},"piece_banner10":{"n":42,"rel":90,"wall":0.3,"lift":3.7,"under":0.45,"door":1.96,"corner":0.48,"back":null},"piece_banner09":{"n":66,"rel":270,"wall":0.3,"lift":3.6,"under":0.49,"door":2.83,"corner":0.41,"back":1.03},"Candle_resin":{"n":241,"rel":-1,"wall":0.38,"lift":0.92,"under":0.87,"door":3.36,"corner":0.48,"back":0.37},"ashwood_bed":{"n":148,"rel":270,"wall":0.76,"lift":0.1,"under":null,"door":1.62,"corner":0.21,"back":1.52},"piece_jackoturnip":{"n":72,"rel":-1,"wall":0.58,"lift":0.94,"under":1.13,"door":2.28,"corner":0.3,"back":0.31},"piece_bathtub":{"n":88,"rel":-1,"wall":0.5,"lift":0,"under":null,"door":3.24,"corner":0.29,"back":0.83},"piece_banner06":{"n":30,"rel":270,"wall":0.3,"lift":3.61,"under":0.73,"door":1.12,"corner":0.61,"back":null},"piece_banner05":{"n":124,"rel":270,"wall":0.3,"lift":3.64,"under":0.45,"door":2.13,"corner":0.29,"back":0.23},"guard_stone":{"n":61,"rel":-1,"wall":0.46,"lift":0.1,"under":1,"door":2.67,"corner":0.42,"back":0.3},"piece_blackwood_bench01":{"n":91,"rel":-1,"wall":0.68,"lift":0.04,"under":null,"door":2.2,"corner":0.5,"back":0.9},"blackforge":{"n":62,"rel":0,"wall":0.74,"lift":0.03,"under":null,"door":3.12,"corner":0.24,"back":0.59},"piece_magetable":{"n":53,"rel":-1,"wall":0.7,"lift":0.03,"under":null,"door":5.38,"corner":0.4,"back":1.29},"piece_magetable_ext":{"n":57,"rel":-1,"wall":0.63,"lift":0.04,"under":null,"door":3.28,"corner":0.47,"back":0.57},"piece_magetable_ext2":{"n":42,"rel":-1,"wall":0.49,"lift":0.08,"under":null,"door":3.4,"corner":0.58,"back":0.44},"piece_blackmarble_bench":{"n":81,"rel":0,"wall":0.48,"lift":0.01,"under":null,"door":2.85,"corner":0.07,"back":0.34},"piece_groundtorch_mist":{"n":272,"rel":-1,"wall":0.24,"lift":0.83,"under":0.72,"door":3.27,"corner":0.4,"back":0.54},"piece_blackmarble_table":{"n":73,"rel":0,"wall":0.38,"lift":0.05,"under":null,"door":2.68,"corner":0.32,"back":0.25},"piece_spinningwheel":{"n":63,"rel":270,"wall":0.7,"lift":0.06,"under":null,"door":3.68,"corner":0.54,"back":1.43},"piece_artisanstation":{"n":62,"rel":0,"wall":0.72,"lift":0.05,"under":null,"door":3.33,"corner":0.19,"back":0.68},"piece_throne02":{"n":59,"rel":0,"wall":0.71,"lift":0.03,"under":null,"door":4.34,"corner":0.46,"back":0.54},"artisan_ext1":{"n":32,"rel":0,"wall":0.56,"lift":0.09,"under":null,"door":2.55,"corner":0.21,"back":0.4},"piece_banner11":{"n":214,"rel":270,"wall":0.3,"lift":3.71,"under":1.29,"door":1.39,"corner":0.24,"back":1.64},"piece_groundtorch_green":{"n":90,"rel":-1,"wall":0.27,"lift":0.73,"under":1,"door":3.01,"corner":0.52,"back":0.96},"darkwood_raven":{"n":63,"rel":-1,"wall":0,"lift":3.86,"under":1,"door":1,"corner":0.39,"back":0.04},"Fiddleheadfern":{"n":31,"rel":-1,"wall":0.43,"lift":0.94,"under":0.92,"door":5.83,"corner":0.31,"back":null},"goblinking_totemholder":{"n":543,"rel":-1,"wall":0.08,"lift":3.17,"under":0.37,"door":1.6,"corner":0.37,"back":0.16},"treasure_stack":{"n":121,"rel":-1,"wall":0.69,"lift":-0.1,"under":null,"door":3.22,"corner":0.11,"back":0.69},"piece_banner03":{"n":63,"rel":270,"wall":0.26,"lift":3.83,"under":0.48,"door":1.79,"corner":0.33,"back":null},"coal_pile":{"n":36,"rel":-1,"wall":0.63,"lift":0.11,"under":null,"door":3.97,"corner":0.29,"back":0.48},"piece_chest_warderobe":{"n":72,"rel":180,"wall":0.63,"lift":0.05,"under":null,"door":2.82,"corner":0.37,"back":0.65},"treasure_pile":{"n":98,"rel":-1,"wall":0.61,"lift":-0.02,"under":null,"door":5.09,"corner":0.47,"back":0.41},"piece_blackmarble_throne":{"n":44,"rel":-1,"wall":0.78,"lift":0.05,"under":null,"door":3.66,"corner":0.12,"back":0.84},"piece_chair_runed":{"n":30,"rel":null,"wall":null,"lift":0.13,"under":null,"door":3.02,"corner":null,"back":1.56},"bone_stack":{"n":30,"rel":90,"wall":0.43,"lift":0.1,"under":null,"door":1.34,"corner":0.64,"back":0.29},"piece_chest_grausten":{"n":30,"rel":0,"wall":0.66,"lift":-0.03,"under":null,"door":10.66,"corner":0.23,"back":0.65},"piece_drawer":{"n":50,"rel":180,"wall":0.26,"lift":-0.09,"under":null,"door":2.7,"corner":0.24,"back":null}},"tuning":{"density":{"home":1,"hall":0.894,"tavern":1.118,"kitchen":1.118}}};
window.VH_ROOMS = {"templates":[{"kind":"workshop","W":5.5,"D":10,"fill":0.93,"doorU":0.01,"fire":[1.09,3.58],"dens":1.37,"open":[["w","B",-2.08,1.25],["w","F",-1.94,1.5],["d","L",4.12,2],["w","L",2.12,2],["d","F",0.89,3.75],["w","R",2.07,6],["w","R",-3.93,2],["d","L",0.11,2],["d","L",2.12,2]],"p":[["f","hearth","R0.06","B0.42",180],["f","piece_workbench","L0.2","P-0.29",90],["f","piece_table","R0.03","P0.07",270],["c","piece_chair02",2,-0.11,1.06,169,0.04],["c","piece_cauldron",0,0.84,0.25,203,0.58],["c","piece_cookingstation",0,-0.38,0.03,270,0.58],["c","piece_cookingstation",0,-1.05,0.11,270,0.58]],"id":"RT-0001"},{"kind":"smithy","W":11.5,"D":8,"fill":0.95,"doorU":0,"fire":null,"dens":1.6,"open":[["w","B",-0.05,11.5],["w","L",0.08,8],["w","R",-2.69,1.75],["w","R",3.06,1.75],["w","F",3.89,3.75],["w","F",-3.86,3.75]],"p":[["f","forge","R0.94","F0.33",180],["f","piece_workbench","L1","F0.64",0],["f","piece_chest_wood","L0","C0.11",90],["f","piece_chest_wood","L0","F0.35",90],["f","piece_chest_wood","P-0.17","F0.39",90],["f","piece_chest_wood","R0","C0.18",270],["f","piece_chest_wood","P0.18","F0.47",270],["f","piece_groundtorch_wood","P-0.13","F0.03",270],["f","piece_groundtorch_wood","P0.14","F0.02",270],["c","forge_ext4",0,-1.38,-0.2,0,-0.01],["m","piece_walltorch","L0.98","B0",2.53],["m","piece_walltorch","L1","B0",2.53],["m","piece_walltorch","R1.03","B0",2.56],["m","piece_walltorch","R1.01","B0",2.57]],"id":"RT-0002"},{"kind":"other","W":7,"D":6.5,"fill":0.74,"doorU":0.56,"fire":null,"dens":0.9,"open":[["w","F",3.1,1],["w","F",-2.4,2],["w","R",-2.74,0.25],["w","R",-0.61,2],["d","F",0.56,2],["w","R",0.83,1]],"p":[["f","piece_chest_wood","R0","B0.35",270],["f","piece_chest_wood","R1.05","B0.38",270],["m","itemstand","L0","B0.57",2.72]],"id":"RT-0003"},{"kind":"home","W":16,"D":5.5,"fill":0.94,"doorU":0.63,"fire":null,"dens":1.45,"open":[["w","F",-4.08,6.75],["w","L",-2.23,1],["w","R",-2.23,1],["w","B",-0.09,16],["w","F",6.66,2.5],["w","F",1.66,1.5],["w","F",0.29,0.25],["d","F",-0.84,2],["w","R",0.7,1],["w","R",-0.92,1.75],["w","F",1.73,1.5],["w","L",0.84,2.5],["w","L",-1.78,0.75],["w","R",-2.25,1]],"p":[["f","piece_table","R0.14","C-0.05",90],["f","piece_bed02","L0.52","C-0.17",90],["f","piece_chair","L0.68","B0.62",270],["f","piece_chair","L0.58","F0.38",270],["f","piece_chest","R0.49","F0.05",0],["f","piece_chest_wood","P-0.19","B0.07",180],["f","piece_chest_wood","P-0.19","F0",0],["f","rug_fur","P0.16","C0.01",90],["f","rug_fur","P-0.17","C-0.04",0],["f","ArmorStand","P0.21","B0.48",180],["f","ArmorStand","P0.15","B0.48",180],["f","ArmorStand","P0.09","B0.55",180],["c","piece_chair03",0,-0.45,-1.25,28,0.02],["c","rug_fur",0,-0.06,-0.97,270,0.02],["c","rug_fur",1,-0.09,0.86,270,-0.07],["c","treasure_stack",0,-0.72,0.24,298,0.8],["c","itemstandh",0,0.13,-0.01,304,0.82],["c","itemstandh",0,0.24,0.16,304,0.82],["c","itemstandh",0,0.31,-0.13,124,0.82],["c","itemstandh",0,0.41,0.04,124,0.82],["m","piece_banner01","P-0.05","B0",3.85]],"id":"RT-0004"},{"kind":"hall","W":10,"D":6,"fill":0.7,"doorU":-1.05,"fire":null,"dens":0.95,"open":[["w","R",-1.07,2],["w","R",0.93,2],["w","F",-3.55,1],["w","L",0.53,1],["w","B",3.52,1],["w","R",2.38,1]],"p":[["f","piece_throne01","P-0.21","C-0.02",147],["f","piece_throne01","P0.07","C-0.09",214],["f","piece_chair","P-0.07","C0.04",180],["f","jute_carpet","P-0.1","F0.21",0],["f","rug_wolf","R0.34","F0.45",135],["f","ArmorStand","R0","F0",315]],"id":"RT-0005"},{"kind":"home","W":14,"D":8,"fill":0.85,"doorU":-2.23,"fire":null,"dens":0.95,"open":[["w","F",-5.05,4],["w","L",-2.71,2.5],["w","L",2.79,2.5],["w","R",-3.5,1],["w","F",3.95,6],["w","R",-2.83,2.5],["w","R",2.67,2.5],["w","B",-3.98,6],["w","B",3.02,8]],"p":[["f","piece_table","R0.28","F0.41",90],["f","piece_table","R0.3","C-0.12",90],["f","piece_table","P0.32","F0.34",180],["f","piece_table","P0.32","B0.47",180],["f","piece_table","R0.32","B0.68",90],["f","piece_bed02","L0.13","C0.02",90],["f","rug_fur","P-0.06","P-0.13",270],["f","rug_fur","P0.17","F1.18",0],["f","rug_fur","R0.86","F0.83",0],["f","rug_fur","R0.75","B0.67",0],["f","rug_fur","P-0.32","F0.78",180],["f","rug_fur","P-0.32","B0.67",180],["f","piece_chest","L0.59","P-0.25",90],["f","piece_chest","L0.61","P0.25",90],["c","piece_chair03",1,0.63,-1.43,332,0.02],["c","itemstandh",1,0.57,-0.22,332,0.76],["c","itemstandh",1,-0.4,-0.14,62,0.82],["c","itemstandh",3,0.64,-0.2,248,0.82],["c","itemstandh",3,-0.79,-0.08,248,0.82]],"id":"RT-0006"},{"kind":"sleeping","W":6,"D":8,"fill":0.59,"doorU":1.47,"fire":null,"dens":1.06,"open":[],"p":[["f","bed","L0.34","P0.17",90],["f","bed","L0.27","B0.33",90],["f","piece_logbench01","L1.06","P0.26",0],["c","rug_deer",0,-0.71,1.64,90,-0.02]],"id":"RT-0007"},{"kind":"home","W":10,"D":19.5,"fill":0.78,"doorU":-3.09,"fire":null,"dens":0.98,"open":[["w","B",-4.49,1],["w","L",-9.06,1.5],["w","F",-0.21,7.5],["w","B",-3.67,1],["w","B",-0.21,6],["w","B",-0.21,2],["w","F",-0.21,2],["w","F",-1.09,7.75],["w","B",-1.09,7.75],["w","B",3.25,1],["w","R",-9.06,1.5],["w","B",4.07,1]],"p":[["f","piece_cartographytable","P-0.16","P-0.29",180],["f","piece_table_round","P-0.13","C-0.17",315],["f","piece_throne01","L0.95","P-0.1",45],["f","piece_bed02","R0.35","P0.1",270],["f","piece_chair","P0.33","P0.18",270],["f","piece_bench01","L0.02","P-0.28",90],["f","piece_chair03","P0.1","P-0.3",270],["f","rug_deer","L0.49","P0.28",45],["f","rug_wolf","P0.06","P0.1",180],["f","piece_chest_blackmetal","R0.85","P-0.03",270],["f","piece_groundtorch_mist","P-0.29","F0.93",180],["f","piece_groundtorch_mist","P0.23","P-0.18",158],["f","piece_groundtorch_mist","P0.24","F0.97",180],["f","piece_groundtorch_mist","R0.63","B1.02",270],["f","piece_groundtorch_mist","C-0.22","P0.38",0],["c","piece_chair03",1,0.59,-1.56,338,-0.01],["c","piece_chair03",1,0.69,1.53,203,-0.01],["c","rug_fur",2,0.06,0.73,180,-0.02],["c","treasure_stack",1,0.32,0.89,112,0.78],["c","treasure_stack",1,-0.18,0.03,68,0.78],["c","treasure_stack",1,0.05,0.11,225,0.78],["c","treasure_stack",1,-0.13,-0.11,112,0.78],["c","itemstandh",1,-0.65,-0.31,315,0.8],["c","itemstandh",1,0.44,-0.14,338,0.8],["c","itemstandh",1,-0.09,-0.68,338,0.8],["c","itemstandh",1,0.28,-0.36,338,0.8]],"id":"RT-0008"},{"kind":"workshop","W":9.5,"D":6,"fill":0.84,"doorU":3.87,"fire":null,"dens":1.05,"open":[["w","B",2.13,1.5],["w","B",-2.37,1.5],["d","F",3.87,2],["d","F",1.87,2]],"p":[["f","piece_workbench","R0.57","P0.13",270],["f","piece_chest_wood","R0.21","P-0.15",180],["f","piece_chair02","C0.04","F0.93",180],["f","piece_chair02","P-0.09","F1.05",180],["c","piece_workbench_ext2",0,-0.01,-0.67,0,0.05]],"id":"RT-0009"},{"kind":"hall","W":5.5,"D":7.5,"fill":0.64,"doorU":-2.25,"fire":[-0.22,-1.31],"dens":1.89,"open":[],"p":[["f","hearth","L0.99","F0.57",113],["f","rug_deer","L0","P-0.13",90],["c","piece_chair03",0,-0.53,-2.32,23,-0.01],["c","piece_cauldron",0,1.04,-0.78,270,0.58],["c","piece_cookingstation_iron",0,-1.06,-1.11,315,0.6],["c","piece_cookingstation_iron",0,-1.63,-0.54,315,0.6]],"id":"RT-0010"},{"kind":"other","W":3,"D":4,"fill":1,"doorU":0.5,"fire":null,"dens":5.83,"open":[["d","F",0.5,2]],"p":[["f","piece_chest_wood","L0.18","F0.48",90],["f","piece_chest_wood","L0.15","B0.38",90],["m","sign","L0.54","F0",0.59],["m","sign","L0.54","F0",1.59],["m","sign","L0.54","F0",2.48],["m","sign","L0.54","F0",3.42],["m","piece_dvergr_lantern","R0","B0",3.69]],"id":"RT-0011"},{"kind":"home","W":7,"D":7,"fill":0.94,"doorU":0.5,"fire":[-2.46,-2.42],"dens":1.09,"open":[["w","L",0.5,4],["w","B",0.5,2],["d","R",-2.5,2],["d","F",0.5,2]],"p":[["f","fire_pit","L0.34","F0.38",180],["f","bed","P0.07","B0.29",180],["m","itemstand","R0","B0",3.69],["m","piece_dvergr_lantern","P-0.07","F0",3.69],["m","piece_dvergr_lantern","R0","P0.07",3.69]],"id":"RT-0012"},{"kind":"tavern","W":8,"D":12,"fill":0.84,"doorU":-2,"fire":null,"dens":1.36,"open":[["w","F",1.5,1],["w","R",-5.5,1],["d","R",-4,2],["w","B",0,4],["w","L",1,10],["d","F",-2,2]],"p":[["f","piece_table_oak","C-0.02","P0.16",270],["c","piece_chair03",0,2.1,1.13,202,0.01],["c","piece_chair03",0,0.76,1.09,180,0.01],["c","piece_chair03",0,-0.66,1.1,180,0.01],["c","piece_chair03",0,-2.13,1.08,135,0.01],["c","piece_chair03",0,2.39,-1.05,337,0.01],["c","piece_chair03",0,0.71,-1.23,0,0.01],["c","piece_chair03",0,-0.7,-1.15,0,0.01],["c","piece_chair03",0,-2.3,-1.19,23,0.01],["m","piece_dvergr_lantern","C0","B0",3.59],["m","piece_dvergr_lantern","P0.12","F0",3.59]],"id":"RT-0013"},{"kind":"home","W":18,"D":12,"fill":0.65,"doorU":0,"fire":[-0.03,0.89],"dens":2.43,"open":[["w","F",8.25,1.5],["w","B",8.25,1.5],["w","F",8.21,1.75],["w","B",8.21,1.75],["w","F",-6,2],["w","B",-6,2],["w","B",6,2],["d","F",0,2]],"p":[["f","fire_pit","C-0.03","P0.07",90],["f","piece_workbench","L0.78","P0.17",90],["f","bed","P0.24","B0.32",180],["f","bed","R0.79","B0.32",180],["f","piece_workbench_ext3","P-0.14","P-0.28",270],["f","piece_chest_wood","L0.37","P0.31",0],["f","piece_chest_wood","L0.51","P-0.12",0],["f","piece_chest_wood","L1.17","B0.19",180],["f","piece_chest_wood","P-0.19","P0.25",270],["f","piece_chest_wood","P-0.11","P0.13",180],["f","piece_chest_wood","P-0.1","F0.09",0],["f","piece_chest_wood","P0.12","P0.12",180],["f","piece_chest_wood","P0.33","B0.12",180],["f","piece_chest_wood","R0.16","P0.08",270],["f","piece_chest_wood","L0.32","C0.18",0],["f","piece_chest_wood","P-0.33","P-0.13",0],["f","piece_chest_wood","P0.11","F0.23",0],["f","rug_deer","P-0.07","P-0.15",180],["f","rug_deer","P0.05","P-0.16",180],["f","piece_workbench_ext2","P-0.22","P-0.11",0],["f","piece_workbench_ext2","P0.13","P-0.26",270],["f","piece_logbench01","R0.26","B1.16",90],["f","piece_logbench01","P0.2","P0.34",270],["f","piece_groundtorch_wood","P-0.19","B0.27",90],["f","piece_groundtorch_wood","P0.15","F0.1",90],["f","piece_groundtorch_wood","R0.07","P-0.15",90],["f","piece_groundtorch_wood","L0.1","P-0.14",90],["f","piece_groundtorch_wood","L0.13","B0.16",90],["f","piece_groundtorch_wood","P-0.15","F0.07",90],["c","rug_deer",1,-0.09,0.56,270,0.03],["c","rug_deer",2,0,0.12,0,-0.07],["c","rug_deer",3,0.47,0.1,0,-0.07],["c","piece_workbench_ext2",1,0.04,-0.69,0,0.05],["c","piece_groundtorch_wood",3,-1.06,-1.33,270,-0.17],["c","piece_groundtorch_wood",2,1.06,-1.36,270,-0.17],["c","piece_cookingstation",0,-0.05,-0.53,0,0.2],["c","piece_cookingstation",0,-0.09,-0.2,0,0.2],["c","piece_cookingstation",0,-0.03,0.13,0,0.2],["c","piece_cookingstation",0,-0.09,0.47,0,0.2]],"id":"RT-0014"},{"kind":"smithy","W":7.5,"D":3.5,"fill":0.78,"doorU":-1.5,"fire":null,"dens":2.44,"open":[["w","B",0.61,1.5],["w","R",-0.6,2.25],["w","R",0.49,2],["w","B",3.07,2],["w","B",1.57,0.5],["w","B",2.61,1.25],["w","B",-2.67,1.5],["w","B",-3.19,1.25],["w","L",-0.94,1.5]],"p":[["f","forge_ext5","R0.43","B0.21",225],["f","jute_carpet_blue","C0.21","B0",180],["f","jute_carpet_blue","L0.12","F0",180],["f","piece_chair03","P0.1","B0.61",338],["f","piece_chest_wood","L0.5","B0",158],["m","itemstand","P0.24","F0",3.71],["m","piece_walltorch","P-0.28","B0",3.33]],"id":"RT-0015"},{"kind":"storage","W":12,"D":14,"fill":0.91,"doorU":1,"fire":[-0.11,5.55],"dens":1.63,"open":[["w","L",5.02,4],["d","F",0,4]],"p":[["f","hearth","C-0.11","B0.45",180],["f","piece_throne01","R0.91","F0.54",303],["f","piece_table_round","R0.79","P0.03",123],["f","piece_chest_wood","R0.46","P0.26",0],["f","piece_chest_wood","R0.45","P0.32",0],["f","piece_chest_wood","R0.49","B0.18",0],["f","piece_chest_wood","L0.34","F0.39",0],["f","piece_chest_wood","L0.27","P-0.18",0],["f","piece_chest_wood","L0.3","P0.04",180],["f","piece_chest_wood","R0.41","B0.98",0],["f","piece_chest_wood","L0.42","P-0.39",0],["f","piece_chest_wood","L0.43","P-0.31",0],["f","piece_chest_wood","L0.39","P-0.26",0],["f","piece_chest_wood","L0.33","P-0.12",0],["f","piece_chest_wood","L0.36","C-0.32",180],["f","rug_wolf","P0.26","P-0.25",45],["f","rug_fur","P-0.07","F1.14",123],["c","piece_chair03",2,1.16,1.51,225,-0.06],["c","piece_chair03",2,-1.89,-0.17,90,-0.06],["c","piece_chair03",2,1.96,-0.04,270,-0.06],["c","rug_deer",2,0.32,-0.73,12,-0.05],["c","piece_chair03",2,-0.83,-1.73,23,-0.01],["c","piece_chair03",2,0.85,-1.7,338,-0.01],["c","piece_cauldron",0,-0.98,0.08,90,0.58],["c","piece_cookingstation",0,0.33,0.03,90,0.58],["c","piece_cookingstation",0,1.13,-0.12,90,0.58],["m","piece_walltorch","P-0.13","F0",1.03],["m","piece_walltorch","P-0.17","B0",1.18]],"id":"RT-0017"},{"kind":"storage","W":2,"D":4,"fill":0.97,"doorU":1.92,"fire":null,"dens":5.16,"open":[["w","R",0.02,4]],"p":[["f","piece_chest","L0.11","F0.19",0],["f","piece_chest","L0.13","F1.12",0],["f","piece_chest","L0.16","B1.2",0],["f","piece_chest","L0.11","B0.26",0]],"stair":1,"id":"RT-0018"},{"kind":"storage","W":2,"D":6,"fill":1,"doorU":-1.94,"fire":null,"dens":5,"open":[["w","B",0,2],["w","R",0,6],["w","F",0.05,2]],"p":[["f","piece_chest_wood","L0.31","B0.4",180],["f","piece_chest_wood","L0.3","B1.2",180],["f","piece_chest_wood","L0.25","P0.06",180],["f","piece_chest_wood","L0.3","P-0.08",180],["f","piece_chest_wood","L0.34","F1.02",180],["f","piece_chest_wood","R0.34","F0.25",180]],"stair":1,"id":"RT-0019"},{"kind":"smithy","W":10,"D":13,"fill":0.85,"doorU":0,"fire":[-0.1,5.06],"dens":2.08,"open":[["w","R",6.08,1],["w","L",6.04,1],["w","B",2.16,1.5],["w","B",-4.59,1],["d","F",0,2]],"p":[["f","hearth","C-0.1","B0.44",180],["f","forge","L0.23","P-0.08",90],["f","piece_workbench","L0.41","F1",90],["f","piece_chest_blackmetal","C-0.31","P0.04",270],["f","piece_chest_blackmetal","C-0.31","P-0.14",270],["f","piece_chest_wood","R0.48","P0.22",180],["f","piece_chest_wood","R0.45","P0.08",180],["f","piece_chest_wood","R0.41","P-0.08",180],["f","piece_chest_wood","R0.46","P-0.23",180],["f","piece_chest_wood","R0.42","F1.08",180],["f","piece_chest_wood","R0.48","P0.16",180],["f","piece_chest_wood","R0.44","C0.21",180],["f","piece_chest_wood","R0.45","P-0.14",180],["f","piece_chest_wood","R0.48","P-0.29",180],["f","piece_chest_wood","R0.4","F0.27",180],["f","fermenter","P-0.2","F0.33",0],["f","piece_chest","L0.43","P0.18",270],["c","forge_ext5",1,1.48,0.15,0,0.03],["c","forge_ext1",1,-1.54,0.41,0,0.04],["c","piece_cookingstation_iron",0,0.03,-0.83,0,0.58],["c","piece_cookingstation",0,-1.19,-0.11,90,0.58],["c","piece_cookingstation",0,-0.48,-0.23,90,0.58],["c","piece_cauldron",0,0.8,0.11,11,0.58]],"id":"RT-0020"},{"kind":"smithy","W":10,"D":2,"fill":1,"doorU":2.75,"fire":null,"dens":2,"open":[],"p":[["f","forge_ext4","L0","F0.4",180],["f","piece_workbench_ext1","P0.17","F0.21",180],["f","forge_ext3","P-0.24","F0.43",180],["f","piece_workbench_ext2","P-0.04","F0.66",180]],"id":"RT-0021"},{"kind":"storage","W":2,"D":10,"fill":0.99,"doorU":-2,"fire":null,"dens":5.06,"open":[],"p":[["f","piece_chest_wood","L0.02","B1",180],["f","piece_chest_wood","L0.04","P0.17",180],["f","piece_chest_wood","L0.09","P-0.04",180],["f","piece_chest_wood","L0.3","P-0.23",180],["f","piece_chest_wood","L0.21","F0.39",180],["f","piece_chest_wood","L0.06","B0.22",180],["f","piece_chest_wood","L0.01","P0.24",180],["f","piece_chest_wood","L0.12","P0.04",180],["f","piece_chest_wood","L0.25","P-0.15",180],["f","piece_chest_wood","L0.27","F1.18",180]],"stair":1,"id":"RT-0022"},{"kind":"storage","W":2,"D":10,"fill":0.99,"doorU":-2,"fire":null,"dens":5.06,"open":[],"p":[["f","piece_chest_wood","L0.18","B1.04",180],["f","piece_chest_wood","L0.21","P0.17",180],["f","piece_chest_wood","L0.21","C-0.31",180],["f","piece_chest_wood","L0.17","P-0.23",180],["f","piece_chest_wood","L0.21","F0.36",180],["f","piece_chest_wood","L0.17","B0.19",180],["f","piece_chest_wood","L0.21","P0.25",180],["f","piece_chest_wood","L0.23","P0.05",180],["f","piece_chest_wood","L0.24","P-0.15",180],["f","piece_chest_wood","L0.27","F1.17",180]],"stair":1,"id":"RT-0023"},{"kind":"home","W":10,"D":10,"fill":1,"doorU":0,"fire":null,"dens":1.4,"open":[["d","F",0,2]],"p":[["f","piece_throne01","L1.1","F1.01",33],["f","piece_table_round","P-0.21","P-0.17",33],["f","piece_bed02","R1.02","B0.05",180],["f","piece_chair","P0.08","B0.79",146],["f","piece_chest_blackmetal","R0.73","P-0.08",270],["f","rug_fur","L1","P0.19",225],["f","rug_deer","C0.31","P-0.04",270],["f","piece_chest","R0.45","F0.33",90],["f","piece_chest","P0.31","F0.26",90],["f","piece_chest","P0.2","F0.28",90],["c","piece_chair03",1,-2.03,0,102,-0.01],["c","piece_chair03",1,1.81,-0.22,270,-0.01],["c","rug_wolf",2,0.87,1.53,135,-0.04],["c","piece_chair03",1,-0.99,1.55,158,0.02],["c","piece_chair03",1,1.02,1.28,225,0.04],["m","piece_banner02","P-0.2","B0",3.54],["m","piece_banner02","P0.2","B0",3.57]],"id":"RT-0024"},{"kind":"storage","W":6,"D":8,"fill":0.69,"doorU":-1.74,"fire":null,"dens":0.91,"open":[["w","B",2.25,1.5],["w","B",-2.25,1.5],["w","L",-1,2],["w","F",0,2],["w","R",-3,2],["w","L",-2.75,1.5],["w","F",2,2],["d","F",-1.74,1.5]],"p":[["f","piece_chest_wood","L0.54","B0.39",180],["f","piece_chest_wood","L0.6","P0.29",180],["f","piece_chest_wood","R0","C0.25",270]],"id":"RT-0025"},{"kind":"sleeping","W":8,"D":6,"fill":0.9,"doorU":1,"fire":null,"dens":1.63,"open":[["d","F",1,2],["w","L",-2,2]],"p":[["f","piece_bed02","L0.15","C-0.31",90],["f","piece_chair","L0.71","F0.47",68],["f","piece_chest_blackmetal","R0.71","P0.09",270],["f","rug_wolf","P0.05","C-0.04",22],["f","rug_fur","P0.07","B0.85",90],["f","piece_chair03","C0.26","P0.18",135],["c","rug_deer",0,0.62,2.1,338,-0.02],["m","piece_walltorch","L0.87","F0",2.72],["m","piece_walltorch","P0.13","F0",2.87],["m","piece_banner01","P-0.12","F0",3.64]],"id":"RT-0026"},{"kind":"hall","W":8,"D":8,"fill":0.84,"doorU":-1,"fire":null,"dens":1.48,"open":[["w","L",-3,2],["d","F",-1,2],["w","R",-1,2]],"p":[["f","piece_throne01","P0.12","F0.47",304],["f","piece_table_round","R1.05","P0.15",113],["f","rug_deer","L0.3","P-0.05",68],["f","rug_fur","L0.59","B0.8",113],["c","piece_chair03",1,1.36,1.25,224,-0.03],["c","rug_wolf",1,0.62,-0.17,269,-0.03],["c","piece_chair03",1,1.6,-0.22,258,-0.01],["c","piece_chair03",1,0.72,-1.72,326,-0.01],["m","piece_walltorch","R1.13","F0",2.6],["m","piece_walltorch","R0","F0.85",2.67],["m","piece_banner01","P0.12","F0",3.64]],"id":"RT-0027"},{"kind":"storage","W":6,"D":8,"fill":0.68,"doorU":1.94,"fire":null,"dens":1.22,"open":[["w","L",-3,2],["w","L",1,2]],"p":[["f","piece_chest_wood","L0.28","B0.26",90],["f","piece_chest_wood","L1.07","B0.22",90],["f","piece_chest_wood","P-0.07","B0.33",90],["f","piece_chest_wood","P0.06","B0.37",90]],"stair":1,"id":"RT-0028"},{"kind":"home","W":14,"D":8,"fill":0.99,"doorU":-0.07,"fire":null,"dens":1.8,"open":[["d","F",-0.07,2]],"p":[["f","piece_table","P-0.17","F0.21",180],["f","piece_throne01","P0.34","P0.18",214],["f","piece_throne01","P0.31","F0.96",338],["f","piece_table_round","P0.26","C-0.15",90],["f","piece_bed02","L0.13","C0.07",90],["f","piece_chair","L0.65","P-0.21",270],["f","piece_chair","L0.38","P0.23",315],["f","piece_chair03","L0.44","F0.35",45],["f","piece_chest_blackmetal","C-0.05","B0.54",180],["f","rug_wolf","P-0.28","B0.29",90],["f","rug_deer","P-0.3","F0.67",90],["f","rug_fur","C0","C-0.35",180],["f","piece_chest","P-0.21","C0.04",90],["c","piece_chair03",3,1.49,-1.44,338,-0.01],["c","piece_chair03",0,-0.18,-0.96,12,0.02],["c","piece_chair03",3,-0.07,-1.96,0,-0.01],["c","piece_chair03",3,-1.54,-1.15,34,-0.01],["c","piece_chair03",3,0.11,1.88,180,-0.01],["h","piece_brazierceiling01","C-0.09","C-0.15",90,2.78],["m","piece_banner01","R0","B0.82",2.81],["m","piece_banner01","L0","B0.64",2.84],["m","piece_banner01","R0","F0.42",2.89],["m","piece_banner01","L0","F0.67",2.99]],"id":"RT-0029"},{"kind":"home","W":13.5,"D":8,"fill":0.99,"doorU":-0.09,"fire":null,"dens":1.78,"open":[["d","F",-0.09,2]],"p":[["f","piece_table","C-0.31","C0.15",270],["f","piece_throne01","R0.87","F0.81",304],["f","piece_table_round","R1.05","P0.2",282],["f","piece_bed02","L1.16","B0.07",180],["f","piece_chair","P0.27","F0.84",282],["f","piece_chair","L0.06","B0.46",158],["f","piece_chair03","L0.25","F0.5",34],["f","rug_wolf","P0.17","B0.98",225],["f","rug_deer","P0.28","P-0.13",282],["f","rug_deer","P-0.1","C0.26",237],["f","rug_deer","L0.64","F0.73",315],["f","piece_chest_blackmetal","P-0.3","F0.65",0],["c","piece_chair03",2,-1.33,-1.13,45,-0.01],["c","piece_chair03",2,-1.35,1.25,123,-0.01],["c","piece_chair03",2,0.37,1.78,180,-0.01],["c","rug_fur",3,-1.4,0.56,0,-0.05],["c","piece_chair02",0,0.29,1.08,203,0.09],["m","piece_walltorch","P0.29","F0",1.41],["m","piece_walltorch","P0.3","B0",1.45],["m","piece_walltorch","L0","B0.93",1.81],["m","piece_walltorch","L0","P-0.32",1.92],["h","piece_brazierceiling01","C-0.05","C0.02",90,2.78],["m","piece_banner02","P-0.31","F0",2.79],["m","piece_banner02","P-0.2","B0",2.83]],"id":"RT-0030"},{"kind":"workshop","W":10,"D":4,"fill":0.99,"doorU":0.05,"fire":null,"dens":1.01,"open":[["d","F",0.05,2]],"p":[["f","piece_workbench","R1.14","F0.32",0],["f","piece_bench01","L1.06","F0.17",0],["m","piece_walltorch","P-0.31","F0",1.99],["m","piece_walltorch","P0.3","F0",2.09]],"id":"RT-0031"},{"kind":"home","W":10,"D":12,"fill":0.79,"doorU":3.25,"fire":null,"dens":1.69,"open":[["w","R",-3.31,1.5]],"p":[["f","piece_throne01","P0.27","B1.06",213],["f","piece_table_round","P0.15","P0.19",213],["f","piece_bed02","P-0.25","B0.39",180],["f","piece_chair","L0.45","B0.73",135],["f","piece_chest_wood","P-0.26","F0.72",90],["f","piece_chest_wood","P-0.34","F0.73",90],["f","piece_chest_wood","L0.43","F0.71",270],["f","rug_wolf","P0.16","P0.05",45],["f","piece_chest","R0.42","B0.07",180],["f","piece_chest","P-0.25","P0.13",180],["f","piece_chair02","L0.83","P-0.2",45],["c","piece_chair03",1,-1.84,-0.33,90,-0.01],["c","piece_chair03",1,1.75,-0.52,282,-0.01],["c","rug_fur",2,-0.74,0.96,292,-0.07],["c","piece_chair03",1,-0.62,1.91,158,0.02],["c","piece_chair03",1,1.22,1.6,225,0.02],["m","piece_walltorch","P-0.11","F0",0.91],["m","piece_walltorch","P0.1","F0",0.97]],"id":"RT-0032"},{"kind":"sleeping","W":8,"D":4,"fill":1,"doorU":-1.05,"fire":null,"dens":2.19,"open":[["d","F",-1.05,2],["w","R",0.93,2],["w","B",-0.02,8]],"p":[["f","piece_table","L0.26","F0.82",90],["f","bed","R0.66","F0.33",270],["f","piece_chair","R0.62","C0.27",68],["f","piece_chest_wood","R0.62","B0.33",180],["f","piece_chest_wood","P0.14","B0.33",180],["f","piece_chest_wood","P-0.05","B0.31",180],["c","piece_chair02",0,-0.18,1.21,158,0.04]],"id":"RT-0033"},{"kind":"other","W":6,"D":4,"fill":1,"doorU":2,"fire":null,"dens":1.67,"open":[["d","F",2,2],["d","F",0,2]],"p":[["f","piece_chest_wood","L0.43","B0.66",180],["f","piece_chest_wood","C-0.17","B0.66",180],["m","itemstand","R0","F0.02",2.11],["m","itemstand","P0.17","F0",3.3]],"id":"RT-0034"},{"kind":"tavern","W":12,"D":14,"fill":0.76,"doorU":-3,"fire":[-2.11,5.53],"dens":1.64,"open":[["w","L",-6.2,1.5],["w","R",-6.2,1.5],["d","L",2,2],["d","L",0,2],["d","F",-2,4]],"p":[["f","hearth","P-0.18","B0.47",180],["f","piece_workbench","L0.34","F1.13",90],["f","piece_table","P0.09","P-0.32",270],["f","piece_throne01","P0.19","P0.12",224],["f","piece_table_round","P0.04","C0.25",224],["f","piece_chest_wood","P0.04","B0.29",90],["f","piece_chest_wood","P0.11","B0.31",90],["f","piece_chest_wood","P0.07","F0.41",0],["f","rug_deer","P-0.04","P-0.1",315],["f","rug_deer","L0.46","P0.1",225],["f","rug_fur","P-0.17","F1.19",270],["f","piece_chest","P0.33","C0.15",270],["f","piece_chest","P0.33","P-0.12",270],["f","piece_chest","P0.33","P0.15",270],["c","piece_chair03",4,-0.99,1.49,158,-0.01],["c","piece_chair03",4,1.69,-0.41,271,-0.01],["c","piece_chair03",4,0.8,1.56,203,-0.01],["c","piece_chair03",4,-1.96,-0.51,90,-0.01],["c","rug_wolf",4,0.84,-0.07,46,0],["c","piece_chair02",2,0.39,0.81,202,0.04],["c","piece_cauldron",0,0.93,-0.06,292,0.58],["c","piece_cookingstation",0,-0.85,0.05,270,0.58],["c","itemstandh",2,0.85,0.08,135,0.82],["c","itemstandh",2,0.35,0.06,225,0.82],["c","itemstandh",2,-0.92,-0.12,180,0.82],["c","itemstandh",4,0.44,0.89,226,0.8],["c","itemstandh",4,0.66,-0.05,203,0.8],["c","itemstandh",4,0.02,0.86,293,0.8],["c","itemstandh",4,0.21,0.38,226,0.8],["c","itemstandh",4,-0.06,0.06,158,0.8],["c","itemstandh",4,-0.24,0.47,226,0.8],["c","itemstandh",4,-0.02,-0.75,158,0.8],["c","itemstandh",4,-0.69,0.66,271,0.8],["c","itemstandh",4,-0.76,-0.18,203,0.8],["m","itemstand","L0","P0.08",2.11],["m","itemstand","L0","P0.07",3.3],["h","piece_brazierceiling01","P-0.17","F0.55",180,3.88]],"id":"RT-0035"},{"kind":"workshop","W":8,"D":6,"fill":0.99,"doorU":-1.07,"fire":null,"dens":0.84,"open":[["d","F",-0.07,4]],"p":[["f","piece_workbench","R0.58","C0.03",270],["f","piece_chair","P-0.3","B0.48",22],["f","piece_chair","P-0.08","B0.62",348],["f","piece_chest_wood","L0.37","F0.36",0]],"id":"RT-0036"},{"kind":"sleeping","W":8,"D":8,"fill":0.81,"doorU":-0.94,"fire":null,"dens":1.73,"open":[["w","B",-1,6],["w","F",3.07,2],["w","F",-2.93,2],["w","L",-3,2],["w","L",3,2],["w","R",3.05,2],["w","R",-2.93,2]],"p":[["f","piece_bed02","R0.11","C0.02",270],["f","piece_chair","P-0.17","P0.29",180],["f","piece_chair03","C-0.33","B0.9",213],["f","piece_chair03","L0.94","B1.13",146],["f","rug_fur","L1","P0.06",135],["f","piece_chest","L0.35","C0.23",90],["f","piece_chest","R0.4","F0.52",270],["m","piece_walltorch","L0","C0.01",2.02],["m","piece_walltorch","R0","C0.08",2.3],["m","piece_banner05","R0.85","B0",2.93]],"stair":1,"id":"RT-0037"},{"kind":"storage","W":5,"D":7,"fill":0.6,"doorU":0.18,"fire":null,"dens":6.19,"open":[["w","F",1.43,2]],"p":[["f","piece_chest","R0.34","C-0.07",0],["f","piece_chest","R0.36","P-0.15",0],["f","piece_chest","R0.37","F1.07",0],["f","piece_chest","R0.35","F0.09",0],["f","piece_chest_barrel","L0.22","P-0.14",90],["f","piece_chest_barrel","L0.17","F1.14",90],["f","piece_chest_barrel","L0.12","F0.14",0],["f","piece_groundtorch","L0","B0.16",180],["f","piece_groundtorch","P-0.15","F0",180],["m","sign","C-0.08","F0",0.93],["m","sign","C-0.07","F0",1.94],["m","sign","C-0.09","F0",2.97],["m","sign","C-0.1","F0",3.97]],"id":"RT-0039"},{"kind":"storage","W":10,"D":10,"fill":0.65,"doorU":1.28,"fire":null,"dens":2.91,"open":[["w","R",0.02,1],["w","R",-3.95,2],["d","F",1.03,2],["w","B",-1.92,1],["w","L",0.1,1]],"p":[["f","piece_bench01","R0.2","C-0.05",270],["f","jute_carpet","P0.13","C-0.01",180],["f","piece_oven","P0.21","P0.25",90],["f","piece_oven","P-0.09","P-0.29",270],["f","piece_chest_barrel","L0.36","P-0.13",90],["f","piece_chest_barrel","L0.3","P-0.23",90],["f","piece_chest_barrel","L0.33","P-0.04",90],["f","piece_chest_barrel","L0.28","P0.06",90],["f","piece_chest_barrel","L0.27","P0.16",90],["f","piece_chest_barrel","L0.26","P0.25",90],["f","piece_groundtorch","P0.34","P-0.24",90],["f","piece_groundtorch","R0.87","P0.25",90],["f","piece_groundtorch","P0.06","P-0.23",90],["f","piece_groundtorch","C0.01","P0.27",90],["m","piece_dvergr_lantern","P-0.11","F0",1.96],["m","piece_walltorch","L0","P0.21",1.98],["m","piece_walltorch","L0","P-0.2",1.99],["m","piece_dvergr_lantern","P0.1","F0",2.69],["m","piece_dvergr_lantern","R0","F0",3.69],["m","piece_banner04","P0.2","B0",4.03]],"id":"RT-0040"},{"kind":"storage","W":10,"D":13,"fill":0.85,"doorU":-0.04,"fire":null,"dens":1.8,"open":[["w","R",-0.45,2],["d","R",4.5,2],["w","L",-0.45,2],["w","L",-0.47,2],["w","R",-0.47,2],["d","F",-0.04,2]],"p":[["f","piece_bench01","R0.83","B0.23",270],["f","piece_chest_barrel","L0.33","B0.97",180],["f","piece_chest_barrel","L0.37","P0.34",180],["f","piece_chest_barrel","L0.38","P0.28",180],["f","piece_chest_barrel","L0.42","P-0.16",180],["f","piece_chest_barrel","L0.43","P-0.23",180],["f","piece_chest_barrel","L0.52","P-0.29",180],["f","piece_preptable","L0.97","F0",0],["f","piece_groundtorch","L0.15","B0.03",180],["f","piece_groundtorch","L0.11","P-0.38",270],["f","piece_groundtorch","R0.14","B0.19",270],["m","itemstand","L0","P-0.03",1.46],["m","itemstand","L0","P0.12",1.51],["m","piece_dvergr_lantern","P-0.09","B0",1.69],["m","piece_dvergr_lantern","L0","F0",1.69],["m","itemstand","R0","P0.05",1.78],["m","piece_walltorch","P-0.1","F0",2],["m","itemstand","L0","P0.05",2.48],["m","sign","C-0.11","F0",2.89],["m","piece_dvergr_lantern","R0","P0.19",3.69]],"id":"RT-0041"},{"kind":"smithy","W":10,"D":12,"fill":0.67,"doorU":-0.04,"fire":null,"dens":1.49,"open":[["w","L",0.09,4],["w","R",0.25,3.5],["w","F",3.99,2],["w","R",1.65,2],["w","L",-1.57,2],["w","L",1.67,2]],"p":[["f","forge","L1.03","P0.33",90],["f","piece_workbench","C0.05","P-0.3",90],["f","forge_ext3","L0.09","C-0.01",0],["f","piece_workbench_ext2","L0.35","P-0.18",270],["f","piece_groundtorch","L0.52","F0.33",0],["c","piece_workbench_ext1",1,1.75,-1.05,90,0.01],["c","forge_ext1",0,1.67,-0.3,180,0.04],["c","forge_ext2",0,-1.63,-1.02,180,0.04],["m","piece_walltorch","P0.31","B0",1.42],["m","piece_walltorch","P-0.29","B0",1.44],["m","piece_dvergr_lantern","C0.06","B0",1.88],["m","piece_banner04","C-0.02","B0",3.77]],"id":"RT-0042"},{"kind":"sleeping","W":8,"D":6,"fill":1,"doorU":0,"fire":null,"dens":1.25,"open":[["w","B",-2.9,2],["d","B",0.1,4],["w","B",3.1,2],["w","R",0,6],["w","L",0,6]],"p":[["f","bed","L0.62","F0.21",0],["f","piece_chest_wood","L0.33","P0.11",0],["f","piece_chest_wood","L0.32","B0.51",0],["f","piece_chest_wood","L0.32","P0.23",0],["f","rug_deer","P0.13","B0.37",180],["f","rug_deer","P-0.12","B0.35",180],["f","rug_deer","P-0.17","F0.01",90],["f","rug_deer","P-0.17","C-0.17",90],["f","piece_groundtorch_wood","P0.26","B0.31",0],["f","piece_groundtorch_wood","P-0.24","B0.3",0]],"id":"RT-0043"},{"kind":"sleeping","W":13.5,"D":5.5,"fill":0.83,"doorU":4.15,"fire":null,"dens":1.62,"open":[["w","L",1.91,1.75],["w","L",-1.84,1.75],["w","F",-5.85,2],["w","F",1.15,4],["d","F",4.15,2],["w","R",-1.84,1.75],["w","R",1.91,1.75],["w","L",2.1,1.5],["w","R",2.1,1.5],["w","L",2.1,1.5],["w","R",2.1,1.5],["w","F",-1.85,2]],"p":[["f","forge","P-0.3","C0.31",90],["f","bed","P0.23","B0",270],["f","piece_chest_wood","P0.09","F0.69",0],["f","rug_deer","P0.22","B0.83",248],["f","piece_logbench01","P-0.06","B0.07",0],["f","piece_logbench01","R0","F0.61",90],["f","piece_groundtorch_wood","P-0.34","P0.23",293],["f","piece_groundtorch_wood","P0.17","P-0.22",293],["c","rug_deer",0,-1.01,0.79,247,0.03],["c","forge_ext2",0,0.73,0.97,0,0.04],["m","itemstand","R0.87","F0",1.89],["m","itemstand","R0","P-0.17",2.13]],"id":"RT-0044"},{"kind":"living","W":13,"D":15.5,"fill":0.47,"doorU":2.27,"fire":null,"dens":2.34,"open":[["w","F",-1.81,1.75],["w","R",7.4,0.75],["w","R",4.77,0.5],["w","R",0.9,1.25],["w","R",5.4,1],["w","B",0.64,1],["w","B",1.91,1],["w","F",1.91,1],["w","F",-3.68,3],["w","F",-5.54,1.75],["w","L",1.02,2],["w","L",-2.98,2],["w","L",4.95,2],["w","B",-3.52,1.75],["w","R",1.15,1.75],["w","B",2.13,1.75],["w","B",-1.74,2],["w","B",5.88,1.25]],"p":[["f","piece_table","P-0.24","F0.5",225],["f","piece_chair03","P0.06","B0.52",90],["f","piece_chair03","P0.16","P0.37",45],["f","piece_chest_wood","P-0.13","F0",0],["f","piece_chest_wood","P0.22","P0.07",270],["f","rug_deer","P-0.25","C-0.31",45],["f","rug_wolf","P-0.15","P-0.09",112],["f","rug_wolf","P-0.29","P0.05",90],["f","rug_deer","P-0.26","P0.13",112],["f","rug_deer","P-0.2","P0.18",157],["f","rug_wolf","P0.07","P0.08",158],["f","rug_deer","P-0.03","P0.18",225],["f","piece_chair02","P-0.32","P0.35",315],["f","rug_wolf","P-0.11","P0.2",180],["c","piece_chair03",0,-0.87,-1.1,68,0.02],["m","piece_dvergr_lantern","L0","P0.06",0.59],["c","itemstandh",0,0.76,0.17,315,0.82],["c","itemstandh",0,-0.3,-0.02,90,0.82],["c","itemstandh",0,0.76,-0.36,315,0.82],["c","itemstandh",0,-0.9,-0.41,225,0.82],["c","treasure_stack",0,-0.9,0.27,90,0.85],["m","itemstand","P-0.29","B0",1.35],["m","itemstand","P-0.3","B0",1.36],["m","itemstand","P-0.32","B0",1.41],["m","sign","P0.15","F0",2.27],["m","sign","P0.16","F0",2.27],["m","sign","P0.16","F0",2.27],["m","sign","P0.17","F0",2.27],["m","piece_banner01","L0","P0.17",2.75],["m","piece_banner01","L0","P0.24",2.75],["m","itemstand","P-0.1","F0",2.93],["m","piece_dvergr_lantern","R0","P0.29",3.36],["m","piece_dvergr_lantern","R0","P0.1",3.39],["m","itemstand","R0","P0.03",3.4],["m","itemstand","P-0.16","F0",3.6]],"id":"RT-0054"},{"kind":"storage","W":5,"D":5.5,"fill":0.86,"doorU":-1.52,"fire":null,"dens":2.53,"open":[["w","L",1.18,2],["w","F",-2.06,1],["w","B",2,1],["w","R",1.62,1],["w","R",-2.38,1]],"p":[["f","piece_table","C0.28","F0.32",180],["f","piece_chest_wood","L0.04","C0.15",0],["f","piece_chest_wood","L0.07","P-0.08",0],["f","piece_chest_wood","L0.06","P-0.19",0],["f","rug_deer","R0.62","F0.85",23],["f","ArmorStand","R0.09","F0.04",158],["c","itemstandh",0,0.58,-0.15,113,0.82],["m","itemstand","C-0.21","F0",1.91]],"id":"RT-0055"},{"kind":"storage","W":5,"D":5.5,"fill":0.77,"doorU":0.86,"fire":null,"dens":4.71,"open":[["w","B",-1.6,1],["w","L",2.01,1],["w","F",-2.13,1],["w","F",2.49,0.25],["w","L",-0.47,1],["w","B",0.17,2.5]],"p":[["f","rug_straw","L0.58","B0",90],["f","piece_chest_barrel","L0.24","F0.72",90],["f","piece_chest_barrel","L0.21","P-0.2",90],["f","piece_chest_barrel","L0.05","C0.32",90],["f","piece_chest_barrel","L0.16","P0.19",90],["f","rug_straw","R0.56","B0",90],["m","itemstand","L0","C0.08",2.87],["m","itemstand","L0","P0.1",2.88],["m","itemstand","R0","C0.07",2.88],["m","itemstand","R0","P0.15",2.89],["m","itemstand","R0","P0.08",2.9],["h","piece_brazierceiling01","C0.04","P0.11",270,3.94]],"id":"RT-0056"},{"kind":"storage","W":6,"D":2.5,"fill":0.38,"doorU":-0.21,"fire":null,"dens":5.22,"open":[["w","F",-2.81,1.25],["w","F",2.22,1.5],["w","F",-0.71,1.5]],"p":[["f","piece_chest_wood","L0.24","B0.07",45],["f","piece_chest_wood","P0.15","F0.04",0],["f","piece_chest_wood","R0","F0.33",315]],"id":"RT-0057"},{"kind":"workshop","W":7,"D":7,"fill":0.78,"doorU":-0.51,"fire":null,"dens":1.58,"open":[["w","B",-3.45,1.5],["w","B",-1.26,1.5],["w","L",-1.04,1],["w","B",1.67,1.5],["w","F",-1.68,1.5],["w","R",0.21,3.5],["w","F",1.24,1.5],["d","F",-0.51,2],["w","F",3.44,1.5],["w","L",2.58,2],["w","R",2.33,1.5],["w","L",2.33,1.5],["w","R",2.58,2]],"p":[["f","piece_table","R0.08","C-0.04",270],["f","piece_chair","L0.97","P0.14",135],["f","piece_workbench_ext1","L0.51","F0.81",135],["f","piece_chest_wood","L0.1","P0.09",90],["f","piece_chest_wood","L0.1","P-0.13",90],["f","rug_deer","L0.78","F0.16",315],["c","rug_deer",0,-0.2,0.87,248,0.02],["c","piece_chair02",0,0.74,1.54,225,0.04],["c","itemstandh",0,0.67,0.27,315,0.82],["c","itemstandh",0,-0.02,0.01,22,0.82],["c","itemstandh",0,-0.78,0.22,225,0.82]],"id":"RT-0058"},{"kind":"sleeping","W":11.5,"D":10,"fill":0.61,"doorU":3.51,"fire":null,"dens":1,"open":[["w","F",-4.74,2],["w","B",-1.81,4],["w","F",-1.81,4],["w","L",3,4],["w","F",1.05,2],["w","F",3.48,3.75],["w","B",4.74,2],["w","F",4.91,1.75],["w","B",4.66,1.25],["w","R",-0.69,2],["w","R",2.01,1.75]],"p":[["f","piece_workbench","P-0.16","C0.29",180],["f","bed","P0.26","P-0.1",315],["f","piece_chest_wood","L0","F0.28",23],["f","piece_chest_wood","P0.32","P0.25",270],["f","piece_chest_wood","R0.37","P-0.04",293],["f","rug_deer","P-0.16","P-0.09",180],["f","rug_deer","L0","F0.88",157],["f","rug_deer","P0.14","P-0.13",248],["f","rug_deer","P0.17","B0.47",135],["f","piece_groundtorch_wood","P0.04","P0.09",270],["f","piece_groundtorch_wood","P-0.29","P0.05",248]],"id":"RT-0059"},{"kind":"storage","W":6,"D":6,"fill":0.97,"doorU":0.07,"fire":null,"dens":2.01,"open":[["d","F",0.07,2]],"p":[["f","piece_chest_wood","L0.4","B0.71",90],["f","piece_chest_wood","L0.42","C-0.16",90],["f","piece_chest_wood","L0.29","F0.4",90],["f","piece_chest_wood","R0.21","B0.72",270],["f","piece_chest_wood","R0.2","C-0.21",270],["f","piece_chest_wood","R0.25","F0.38",270],["f","piece_groundtorch_wood","C0.12","B0.66",180]],"id":"RT-0060"},{"kind":"workshop","W":2,"D":6,"fill":0.92,"doorU":0.5,"fire":null,"dens":4.55,"open":[["w","F",0,2]],"p":[["f","piece_workbench_ext3","L0.29","B0.73",90],["f","piece_workbench_ext2","L0.48","F0.22",270],["f","piece_groundtorch","L0.06","C-0.04",0],["m","piece_walltorch","R0.79","F0",2.04],["m","piece_walltorch","R0.75","B0",2.04]],"id":"RT-0061"},{"kind":"storage","W":2,"D":6,"fill":1,"doorU":1.5,"fire":null,"dens":4.17,"open":[],"p":[["f","piece_chest","R0.51","F0.37",90],["f","piece_chest","R0.6","C0",90],["f","piece_chest","R0.5","B0.38",90],["m","piece_walltorch","L0","B0.83",1.27],["m","piece_walltorch","L0","F0.9",1.28]],"stair":1,"id":"RT-0062"},{"kind":"living","W":10,"D":10,"fill":0.87,"doorU":1,"fire":null,"dens":2.18,"open":[],"p":[["f","piece_table_round","C-0.27","P0.21",180],["f","piece_chair","L0.86","C-0.02",225],["f","rug_deer","L0.21","P-0.05",180],["f","rug_fur","P0.07","P-0.04",248],["f","rug_fur","P0.16","F0.7",248],["f","piece_chest","R0.73","P-0.12",270],["f","piece_chest","R0.72","P0.06",270],["f","piece_chair","L1.05","P-0.18",315],["f","rug_deer","L0.31","P-0.15",0],["f","piece_groundtorch_green","P0.29","F0.21",180],["f","piece_groundtorch_green","P-0.1","F0.19",180],["c","piece_chair03",0,1.21,1.14,225,-0.03],["c","piece_chair03",0,1.91,-0.18,270,-0.03],["c","piece_chair03",0,-1.32,-1.1,45,-0.03],["c","jute_carpet_blue",0,0.23,-0.4,0,-0.03],["c","piece_chair03",0,1.41,-1.33,315,-0.01],["c","piece_chair03",0,0.16,-1.76,0,-0.01],["c","itemstandh",0,0.1,0.67,0,0.85],["c","itemstandh",0,0.59,-0.76,0,0.85],["c","itemstandh",0,-0.46,-0.27,0,0.85],["m","itemstand","R0","P-0.13",1.87],["m","itemstand","R0","P-0.08",1.87],["m","itemstand","R0","C-0.18",1.88],["m","itemstand","R0","P0.1",1.88],["m","itemstand","R0","P0.04",1.88],["m","itemstand","R0","P0.16",1.89],["m","piece_walltorch","P0.1","B0",2.62]],"id":"RT-0063"},{"kind":"home","W":10,"D":7.5,"fill":0.83,"doorU":1.3,"fire":null,"dens":1.28,"open":[["w","F",-0.66,2],["w","R",-2.22,1.25],["w","R",0.53,0.25],["w","R",1.78,0.75],["w","B",4.67,0.5],["w","F",-0.65,2.75],["w","F",2.03,0.25],["w","F",-0.72,2.75],["w","F",-1.83,0.25],["w","R",-1.85,2],["w","R",0.77,2.25],["w","L",0.18,4],["w","F",-2.74,1.75],["w","F",-4.35,1.25],["w","F",1.37,2],["w","F",-4.38,1]],"p":[["f","piece_table","R0.02","B0.16",270],["f","piece_table","P-0.29","C0.08",270],["f","ashwood_bed","R0.31","P-0.07",270],["f","piece_bench01","P0.24","B0",180],["f","ArmorStand","L0.08","B0.18",270],["c","piece_chair",0,-1.89,0.1,0,-0.05],["c","piece_chair03",1,-0.09,-0.69,0,0.02],["c","rug_fur",2,1.04,0.44,0,-0.02],["c","rug_fur",2,-1.38,0.44,0,-0.02],["c","rug_deer",1,0.08,0.12,0,0.02],["c","piece_chest",2,-0.04,1.67,0,-0.02],["c","itemstandh",0,-0.69,0.05,270,0.82],["c","Candle_resin",0,0.64,-0.12,270,0.84],["c","Candle_resin",1,-0.87,-0.02,270,0.84]],"id":"RT-0064"},{"kind":"storage","W":10,"D":4,"fill":0.89,"doorU":-1.97,"fire":null,"dens":0.84,"open":[["w","F",2.03,2],["w","F",2.05,2],["d","F",-1.97,2]],"p":[["f","piece_chest_wood","L0.15","F0.15",90],["f","piece_chest_wood","C0.06","F0",0],["f","piece_chest_wood","R0.32","F0.08",0],["f","rug_deer","L0","F0.19",203],["f","rug_deer","P0.2","F0.48",180]],"id":"RT-0065"},{"kind":"storage","W":2,"D":3.5,"fill":1,"doorU":0.47,"fire":null,"dens":4.29,"open":[["w","F",-0.03,2]],"p":[["f","piece_chest_wood","R0.28","B0.23",270],["f","piece_chest_wood","L0.04","B0.11",270],["f","piece_chest_wood","L0.1","F0.07",270]],"id":"RT-0066"},{"kind":"sleeping","W":8,"D":9.5,"fill":0.89,"doorU":-3,"fire":null,"dens":1.33,"open":[["w","F",3,2],["w","B",3,2],["d","F",-3,2]],"p":[["f","piece_table","L0.16","P-0.13",270],["f","piece_bed02","R0.11","P-0.14",270],["f","piece_bed02","R0.09","P0.11",270],["f","piece_chair","L0.94","B0.11",180],["f","piece_bench01","C0.07","C-0.17",270],["f","rug_deer","P-0.08","F0.48",248],["f","rug_wolf","P-0.14","P-0.08",135],["f","rug_deer","L0.46","P0.18",22],["f","piece_groundtorch_wood","P0.21","P-0.33",180],["f","piece_groundtorch_wood","C0.03","B0.21",90],["c","piece_groundtorch_wood",2,1.49,0.24,270,-0.14],["m","piece_banner01","P-0.13","F0",3.65]],"id":"RT-0067"},{"kind":"storage","W":9.5,"D":12,"fill":0.76,"doorU":-3.88,"fire":null,"dens":2.78,"open":[["w","L",1.5,1],["d","L",0,2],["w","L",-1.5,1],["d","F",-3.76,1.75],["w","F",0.12,2],["w","B",0.12,2],["w","L",4.01,2],["w","L",0.04,2],["w","L",-4.09,2],["w","B",2.47,3],["w","F",2.47,3],["w","B",2.41,3],["w","F",2.41,3],["w","B",2.45,3],["w","F",2.45,3]],"p":[["f","piece_table","L0.26","P0.25",90],["f","piece_chest_wood","P0.2","P-0.14",0],["f","piece_chest_wood","P0.2","P0.2",0],["f","piece_chest_wood","P0.2","P-0.2",0],["f","piece_chest_wood","P0.2","P0.14",0],["f","jute_carpet","C0.02","P-0.16",270],["f","rug_deer","L1.17","P-0.13",135],["f","rug_deer","P-0.2","P0.07",45],["f","rug_deer","L0.38","P-0.19",180],["f","jute_carpet","C0.01","P0.16",270],["f","ArmorStand","L0.21","B0.35",135],["f","rug_deer","L0.5","C-0.14",90],["f","rug_deer","P-0.18","C-0.27",90],["f","piece_groundtorch_wood","L0.05","P-0.11",135],["f","piece_groundtorch_wood","L0.07","P0.11",135],["f","piece_groundtorch_wood","L0.11","B0.27",180],["c","rug_deer",0,0.99,0.78,270,0.02],["c","piece_chair02",0,-0.97,0.87,135,0.04],["c","piece_chair02",0,1.58,0.19,270,0.09],["m","itemstand","R0","P-0.33",1.85],["m","piece_walltorch","R0","P-0.03",1.98],["m","itemstand","C0.13","F0",2.49],["m","itemstand","C0.12","F0",2.9],["m","piece_banner02","R0","P-0.16",2.9],["m","piece_banner02","R0","P0.17",2.91],["m","piece_banner02","L0","P-0.34",3.1],["m","piece_banner02","L0","P0.33",3.1],["m","piece_banner02","L0","C0.02",3.1],["m","piece_banner02","P0.22","B0",3.23],["m","piece_banner02","P-0.21","B0",3.23],["m","piece_banner02","P-0.21","F0",3.24],["m","piece_banner02","P0.23","F0",3.24]],"id":"RT-0068"},{"kind":"storage","W":9.5,"D":12,"fill":0.68,"doorU":4.12,"fire":null,"dens":2.05,"open":[["w","R",1.5,1],["d","R",0,2],["w","R",-1.5,1],["w","F",0.12,2],["d","F",3.99,1.75],["w","B",0.12,2],["w","B",-2.29,3],["w","F",-2.29,3],["w","R",-4.15,2],["w","R",0.19,2],["w","R",4.17,2],["w","B",-2.34,3],["w","F",-2.34,3],["w","B",-2.33,3],["w","F",-2.33,3]],"p":[["f","piece_table","R0.08","P0.24",90],["f","piece_chest_wood","P-0.19","P-0.13",0],["f","piece_chest_wood","P-0.18","P0.21",0],["f","piece_chest_wood","P-0.19","P-0.2",0],["f","piece_chest_wood","P-0.18","P0.15",0],["f","jute_carpet","P0.04","P0.19",270],["f","rug_wolf","P0.14","F0.76",270],["f","jute_carpet","P0.05","P-0.17",270],["f","ArmorStand","R0","B0.39",225],["f","piece_groundtorch_wood","R0","B0.25",0],["c","piece_chair02",0,1.62,-0.09,270,0.04],["c","piece_chair02",0,-0.75,-0.92,23,0.04],["m","piece_walltorch","L0","C0",1.28],["m","itemstand","C0.13","F0",2.56],["m","piece_banner05","L0","P-0.17",2.65],["m","piece_banner05","L0","P0.19",2.74],["m","piece_banner02","R0","P-0.34",3.1],["m","piece_banner02","R0","P0.35",3.1],["m","piece_banner02","R0","C0.2",3.15]],"id":"RT-0069"},{"kind":"sleeping","W":3,"D":4,"fill":0.83,"doorU":-1,"fire":null,"dens":7,"open":[],"p":[["f","piece_bed02","R0.01","B0",180],["c","jute_carpet",0,0.06,0.34,270,-0.17],["c","piece_chest",0,0.04,1.99,0,-0.17],["m","itemstand","R0","B0",1.86],["m","itemstand","L0.69","B0",1.89],["m","itemstand","R0.68","B0",1.93],["m","itemstand","R0.64","B0",2.89],["m","itemstand","L0.75","B0",3.89]],"id":"RT-0070"},{"kind":"workshop","W":19.5,"D":10,"fill":0.69,"doorU":-0.78,"fire":null,"dens":0.89,"open":[["w","B",-6.04,1.5],["w","B",-7.88,2.75],["w","B",-9.81,2.25],["w","B",3.88,5.5],["w","B",-3.62,5.5],["w","L",-0.39,3],["w","B",4.43,2],["w","F",4.43,2],["w","F",-6.05,2.75],["w","F",-8.37,3.25],["w","F",-10.15,1.25],["w","B",7.02,3.5],["w","B",7.51,4],["w","F",7.57,4],["w","B",8.03,4],["w","F",-2.78,4],["w","R",0.03,4],["w","F",9.48,3],["w","F",6.42,1.75],["w","F",3.72,3],["d","F",0.22,4]],"p":[["f","piece_workbench","P0.35","B0.88",224],["f","piece_workbench_ext1","R0.21","P-0.09",0],["f","piece_chest_wood","P0.05","B0.96",270],["f","piece_chest_wood","P0.14","P0.28",90],["f","piece_chest_wood","P-0.38","P-0.27",45],["f","piece_chest_wood","P0.05","P0.06",270],["f","piece_chest_wood","P0.14","P0.13",90],["f","piece_chest_wood","P0.14","C-0.15",90],["f","rug_deer","P0.31","P0.14",314],["f","rug_deer","C0.1","F0",135],["f","rug_deer","P-0.05","P0.17",180],["f","rug_deer","P-0.19","P-0.22",247],["f","rug_deer","P0.23","F1.07",225],["f","piece_groundtorch_wood","P-0.32","F1.07",180],["f","piece_groundtorch_wood","P-0.27","B0.78",180],["f","piece_groundtorch_wood","L0.37","C0.06",224],["m","sign","C0.21","F0",3.31]],"id":"RT-0071"},{"kind":"storage","W":6,"D":6,"fill":0.54,"doorU":-0.88,"fire":null,"dens":1.54,"open":[["w","F",-0.38,5],["w","F",-2.7,0.5],["w","F",-2.26,0.25]],"p":[["f","piece_chest_wood","P0.07","P-0.15",270],["f","piece_chest_wood","P0.07","B0.24",270],["f","piece_chest_wood","P0.07","P0.1",270]],"id":"RT-0072"},{"kind":"storage","W":2,"D":6,"fill":0.5,"doorU":0,"fire":null,"dens":5,"open":[],"p":[["f","piece_chest_wood","L0.1","P-0.24",0],["f","piece_chest_wood","R0.43","C0.01",270],["f","piece_chest_wood","R0.43","B0.34",270]],"id":"RT-0073"},{"kind":"storage","W":10,"D":8,"fill":0.21,"doorU":-4.25,"fire":null,"dens":4.24,"open":[],"p":[["f","piece_chest_wood","R0","C-0.02",270],["f","piece_chest_wood","R0","P0.26",270],["f","piece_chest_wood","R0","F1.05",270],["f","piece_chest_wood","P0.31","F0.23",0],["f","piece_chest_wood","P0.11","F0.25",0],["f","piece_chest_wood","P-0.09","F0.26",0],["f","piece_chest_wood","P-0.3","F0.24",0]],"id":"RT-0074"},{"kind":"other","W":9.5,"D":9.5,"fill":0.59,"doorU":-4,"fire":null,"dens":4.3,"open":[["w","L",2.31,1],["w","L",1.06,1],["w","R",-2.06,1],["w","R",-4.06,1],["w","F",-2.41,0.75],["w","B",-2.41,0.75],["w","F",-2.54,1],["w","F",2.56,2],["w","F",-2.34,0.75],["d","F",-0.09,3.75],["w","L",0.31,0.25],["w","L",-0.69,0.75]],"p":[["f","ArmorStand","P-0.26","F0",90],["f","ArmorStand","P-0.26","F0.55",90],["f","ArmorStand","P-0.26","P-0.33",90],["f","ArmorStand","P-0.26","P-0.26",90],["f","ArmorStand","P-0.26","P-0.19",90],["f","ArmorStand","P-0.26","P-0.13",90],["f","ArmorStand","P-0.26","P-0.06",90],["f","ArmorStand","P-0.27","B0",180],["f","ArmorStand","P-0.2","B0",180],["f","ArmorStand","P-0.07","B0",180],["f","jute_carpet","C0.02","F0.67",270],["f","rug_straw","R0.47","B0",90],["m","itemstand","L0","F0.1",3.79],["m","itemstand","L0","P-0.33",3.8],["m","itemstand","L0","P-0.2",3.71],["m","itemstand","L0","P-0.11",1.75],["m","itemstand","R0","P-0.07",2.22],["m","itemstand","R0","P-0.06",2.22],["m","itemstand","R0","P-0.05",2.22],["m","itemstand","R0","P-0.04",2.22],["m","piece_banner01","R0","P0.27",2.78],["m","piece_banner02","R0","P0.23",2.77],["m","piece_banner03","R0","P0.18",2.77],["m","piece_banner04","R0","P0.14",2.78],["m","piece_banner05","R0","P0.1",2.78]],"id":"RT-0075"},{"kind":"storage","W":3.5,"D":6,"fill":0.85,"doorU":0.97,"fire":null,"dens":1.69,"open":[["d","F",0.84,1.75],["w","L",0.11,2],["w","R",0.14,2]],"p":[["f","piece_chest_wood","L0","F0.64",270],["f","piece_chest_wood","L0","C0.1",90],["f","piece_chest_wood","L0","B0.69",90]],"id":"RT-0076"},{"kind":"smithy","W":8.5,"D":9,"fill":0.74,"doorU":0.13,"fire":null,"dens":1.42,"open":[["w","L",-2.49,1],["d","L",-0.03,3.5],["w","R",1.93,2],["w","F",3.51,0.25],["w","F",-2.61,2],["w","F",2.62,2]],"p":[["f","forge","L0.48","B0.86",136],["f","piece_workbench","L0.89","F0.96",46],["f","forge_ext5","P0.13","P0.19",90],["f","piece_workbench_ext3","P0.27","F0.55",338],["f","rug_deer","R0.15","B0.86",338],["f","rug_wolf","L0","C-0.1",0],["c","forge_ext1",0,-1.55,0.48,22,0.04],["m","itemstand","R0","P-0.28",2.61],["m","itemstand","R0","P-0.28",2.52],["m","sign","R0.38","B0",1.45]],"id":"RT-0077"},{"kind":"sleeping","W":8,"D":8,"fill":0.69,"doorU":-0.94,"fire":null,"dens":3.86,"open":[["w","B",-1.37,1],["w","F",-4.76,0.25]],"p":[["f","piece_bed02","R0","C-0.12",270],["f","piece_throne01","R1.02","F0.08",316],["f","ArmorStand","L1","F0.06",46],["f","ArmorStand","L0.49","F0.52",46],["f","ArmorStand","L0","F0.99",46],["c","jute_carpet",0,0.01,-0.13,180,-0.07],["c","jute_carpet",0,-0.04,1.27,180,-0.07],["m","itemstand","P-0.3","B0",3.16],["m","itemstand","L0.31","B0",3.15],["m","itemstand","L0.66","F0",2.97],["m","itemstand","P-0.24","B0",2.87],["m","itemstand","L0.63","F0",2.76],["m","itemstand","L0.87","B0",2.57],["m","itemstand","P-0.25","B0",2.15],["m","itemstand","L0.22","B0",1.61],["m","itemstand","P-0.28","B0",1.59],["m","itemstand","L0.43","B0",1.12],["m","itemstand","L1.19","B0",1.08],["m","itemstand","L0.74","B0",0.56]],"id":"RT-0078"},{"kind":"storage","W":8,"D":3.5,"fill":0.3,"doorU":3,"fire":null,"dens":4.71,"open":[],"p":[["f","piece_chest_wood","L0.31","F0.2",135],["f","piece_chest_wood","P-0.23","B0.73",135],["f","piece_chest_wood","P-0.05","B0.09",180],["f","piece_chest_wood","P0.17","B0.1",180]],"id":"RT-0079"},{"kind":"storage","W":9.5,"D":9,"fill":0.66,"doorU":4.13,"fire":null,"dens":2.12,"open":[["w","F",-1.9,1.75],["d","B",3.48,4],["d","F",4.13,2],["d","F",2.71,2]],"p":[["f","piece_chest_wood","R0.33","P0.22",225],["f","piece_chest_wood","P-0.04","B0.12",90],["f","piece_chest_wood","P-0.18","B0.21",45],["f","piece_chest_wood","P-0.24","B0.97",45],["f","piece_chest_wood","L1.12","P0.25",45],["f","rug_fur","P-0.05","P-0.1",315],["f","piece_chest","R0.26","C-0.33",270],["f","piece_chest_wood","L0.37","C0.24",0],["f","piece_chest_wood","L0.53","P0.12",0],["f","piece_chair02","C-0.09","P-0.23",248],["f","piece_chair02","P-0.11","P-0.1",203],["m","piece_banner04","R0","P-0.12",2.72],["m","piece_banner01","P0.08","F0",2.74]],"id":"RT-0080"},{"kind":"other","W":9.5,"D":9.5,"fill":0.65,"doorU":-3.75,"fire":null,"dens":1.37,"open":[["d","B",0.46,2],["d","F",2,0.25],["d","F",2.58,0.5]],"p":[["f","piece_groundtorch_mist","L0.05","P0.19",225],["f","piece_groundtorch_mist","L0.28","P-0.15",225],["f","piece_groundtorch_mist","P-0.17","B0.19",225],["f","piece_groundtorch_mist","P-0.2","F0.47",225],["f","piece_groundtorch_mist","P0.18","B0.49",225],["f","piece_groundtorch_mist","R0.59","P0.18",225],["f","piece_groundtorch_mist","P0.17","F0.44",225],["f","piece_groundtorch_mist","R0.44","P-0.18",225]],"id":"RT-0081"},{"kind":"sleeping","W":5.5,"D":7.5,"fill":0.85,"doorU":-0.36,"fire":null,"dens":0.86,"open":[["w","F",-1.73,1.75],["w","F",2.02,1.25],["w","B",-2.31,0.25]],"p":[["f","bed","R0.21","B0.39",180],["f","piece_chest_wood","R0.26","F0.21",270],["f","rug_deer","R1.17","B0.5",180],["f","piece_chest_wood","R0.32","P-0.16",270],["c","rug_deer",0,0.61,1.91,270,-0.02]],"id":"RT-0082"},{"kind":"home","W":8,"D":7.5,"fill":0.85,"doorU":2.5,"fire":[-3.02,2.78],"dens":1.37,"open":[["w","L",-0.14,2],["w","B",-0.13,2],["w","F",-0.06,2]],"p":[["f","bed","P0.12","B0.39",180],["f","fire_pit","L0","B0",315],["f","rug_deer","L0.33","P0.13",67],["f","rug_deer","C-0.25","B0.46",0],["f","piece_groundtorch_wood","P-0.27","F0",315],["c","piece_logbench01",1,0.92,-1.67,135,-0.03],["c","piece_groundtorch_wood",0,0.75,-1.37,135,-0.07],["c","piece_cookingstation",1,0.07,0.17,45,0.2],["c","piece_cookingstation",1,-0.43,-0.45,45,0.2]],"id":"RT-0083"},{"kind":"hall","W":8,"D":14,"fill":0.65,"doorU":-3.19,"fire":[0.06,5.5],"dens":2.07,"open":[["w","R",1.46,1],["w","R",-3.04,2],["w","B",3.55,1],["w","B",-2.48,1],["w","L",-3.47,1],["d","F",-1.05,2],["w","R",6.48,1],["w","L",2.03,2]],"p":[["f","piece_throne01","R0.32","P-0.16",270],["f","hearth","C0.06","B0.5",180],["f","piece_chair","L0.65","P0.16",180],["f","piece_chair","L0.64","P0.13",180],["f","piece_chair","L0.64","P0.09",0],["c","rug_fur",0,-0.71,1.04,135,0.02],["c","piece_chair",1,3.1,2.77,0,0.16],["c","piece_cauldron",1,0.48,-0.06,226,0.58],["m","piece_walltorch","R0","P-0.08",2.02],["m","piece_dvergr_lantern","R0","B0.82",3.19],["m","piece_dvergr_lantern","L0","B0.78",3.19],["m","piece_dvergr_lantern","R0","P-0.07",3.69],["m","itemstand","R0","P0.11",3.87],["m","itemstand","R0","P-0.25",3.87],["m","itemstand","L0","P0.11",3.87],["m","itemstand","L0","P-0.25",3.88]],"id":"RT-0084"},{"kind":"sleeping","W":8,"D":11,"fill":0.55,"doorU":-2.05,"fire":null,"dens":1.64,"open":[["w","B",1.2,1.5],["w","L",1.14,2],["w","L",3.93,2],["w","R",3.86,2]],"p":[["f","piece_bed02","C0.31","C0.02",270],["f","piece_chair","P0.06","P-0.36",180],["f","piece_chair03","P0.14","F0.53",226],["f","rug_wolf","C0","F0",293],["f","rug_deer","L0.01","C-0.21",158],["f","ArmorStand","L0.53","P0.24",113],["m","piece_walltorch","R0","P0.23",2.17],["m","piece_walltorch","L0","P0.23",2.3],["m","piece_dvergr_lantern","L0","P-0.08",3.6],["m","piece_dvergr_lantern","L0","P0.1",3.6]],"id":"RT-0085"},{"kind":"workshop","W":8.5,"D":9,"fill":0.82,"doorU":-1.83,"fire":null,"dens":0.8,"open":[["d","F",-1.9,4],["w","R",-4,1],["d","R",-2.5,2],["d","R",-0.5,2],["d","L",1.65,2]],"p":[["f","piece_workbench","P-0.23","B0.14",180],["f","piece_chest","P0.15","P0.09",180],["f","piece_chest","R0.81","P0.09",180],["f","rug_deer","R0","P-0.09",180],["f","rug_deer","R0","F0.95",0],["m","piece_dvergr_lantern","R0","B0",3.93],["m","piece_dvergr_lantern","R0","F0.38",3.98]],"id":"RT-0086"},{"kind":"sleeping","W":8,"D":12,"fill":0.59,"doorU":-1.1,"fire":null,"dens":2.63,"open":[],"p":[["f","piece_table","C-0.08","B0.16",0],["f","piece_bed02","R0.34","B0.08",180],["f","piece_bed02","L0.15","B0.01",180],["f","rug_wolf","P-0.07","P0.16",90],["f","rug_wolf","L0.01","P0.16",90],["f","rug_fur","C0.02","B0.54",180],["f","rug_wolf","R0.59","P0.16",90],["f","piece_chair","P0.23","P0.18",90],["f","piece_chest_blackmetal","L0","P0.12",90],["f","piece_chest_blackmetal","R0.3","P0.11",270],["f","rug_wolf","C0.11","B0.86",180],["f","piece_chair02","P-0.24","P0.17",90],["m","piece_dvergr_lantern","C-0.07","B0",2.92],["m","piece_dvergr_lantern","P0.14","F0",2.93],["m","itemstand","R0","P-0.34",2.99],["m","piece_dvergr_lantern","R0","B0",3.07],["m","piece_banner01","R1.19","B0",3.27],["m","piece_banner01","R0","P0.33",3.29],["m","piece_banner01","L0.75","B0",3.31],["m","piece_banner01","L0","P0.36",3.31]],"id":"RT-0087"},{"kind":"sleeping","W":5,"D":5,"fill":0.93,"doorU":-0.15,"fire":null,"dens":3.44,"open":[["d","F",-1.53,1.75],["w","R",-2,1],["w","B",0.5,2],["w","L",2,1]],"p":[["f","piece_bed02","R0.17","B0.23",180],["f","rug_asksvin","L0.22","B0.62",90],["f","piece_chest","R0.4","F0.24",0],["m","itemstand","R0","F0.61",2.9],["m","sign","R0.99","B0",3.12],["m","sign","C-0.02","B0",3.13],["m","piece_dvergr_lantern","P-0.08","F0",3.85],["m","piece_banner05","L0","C0.26",3.89],["m","piece_dvergr_lantern","P-0.12","F0",4.09]],"id":"RT-0088"},{"kind":"other","W":2,"D":10,"fill":1,"doorU":0.45,"fire":null,"dens":2.5,"open":[["w","F",0.08,1.75]],"p":[["f","fermenter","L0","P-0.22",270],["f","fermenter","L0","F0.19",270],["f","fermenter","L0","B0.59",270],["f","fermenter","L0","P0.17",270],["f","fermenter","L0","C-0.3",270]],"id":"RT-0089"},{"kind":"tavern","W":8.5,"D":21,"fill":0.82,"doorU":-3.03,"fire":[0.24,9.54],"dens":0.96,"open":[["w","L",-7.87,2],["w","F",-3.08,2],["w","F",-1.46,2],["w","F",0.46,2],["w","F",1.93,1],["w","F",3.1,2],["w","R",-8.33,2],["w","R",-6.91,1],["w","L",-2.65,4],["w","L",1.61,2],["w","L",-2.89,5],["w","L",-2.58,5.5],["w","L",6.86,3.5],["w","L",4.11,1],["w","L",9.6,2]],"p":[["f","hearth","C0.24","B0",180],["f","piece_table","C0.2","P-0.2",0],["f","piece_table","C0.2","P-0.15",0],["f","piece_table","C0.19","P-0.09",0],["f","piece_throne01","P-0.2","P-0.11",90],["f","piece_throne01","P-0.22","P-0.19",90],["f","piece_chest_wood","L0.74","P0.27",90],["f","rug_fur","C0.24","P-0.28",90],["f","jute_carpet","P0.18","P0.12",90],["f","jute_carpet","C0.34","P0.3",180],["f","piece_groundtorch","P-0.3","P-0.39",316],["f","piece_groundtorch","P0.33","P-0.4",316],["c","rug_fur",1,-1.24,0.42,0,0],["c","rug_fur",4,-0.49,0.7,270,-0.01],["c","rug_fur",1,1.27,0.41,0,0],["c","rug_fur",3,1.15,0.08,0,0],["c","piece_chair02",1,1.91,-0.65,293,0.04],["c","piece_chair02",2,1.97,-0.48,293,0.04],["c","piece_chair02",2,1.96,0.52,270,0.04],["c","piece_chair02",3,1.89,0.5,225,0.04],["c","piece_cookingstation_iron",0,0,-0.4,180,0.58]],"id":"RT-0090"},{"kind":"smithy","W":9,"D":10,"fill":0.76,"doorU":-0.69,"fire":null,"dens":1.46,"open":[["w","L",4.1,1.25],["w","B",-0.03,4.25],["w","F",-1.6,6],["w","F",-3.61,2]],"p":[["f","forge","L0.5","P0.14",180],["f","piece_workbench","C-0.12","B0.18",180],["f","jute_carpet","L0.86","P-0.1",270],["f","piece_chest","L0.71","B0.52",180],["f","piece_chest","P0.26","B0.65",270],["m","piece_walltorch","P-0.2","B0",1.87],["m","piece_walltorch","P0.16","B0",1.9],["m","wood_dragon1","P0.21","B0",2.9],["m","wood_dragon1","P-0.24","B0",2.9],["m","piece_banner04","P0.31","B0",3.58],["m","piece_banner04","L0.81","B0",3.58]],"id":"RT-0091"},{"kind":"home","W":15,"D":18,"fill":0.64,"doorU":6,"fire":[3.5,-7.5],"dens":1.68,"open":[["d","L",-2,4],["w","R",-2,4],["w","R",2.75,2.5],["w","B",6.5,2],["w","F",3.5,4],["w","F",-3,7],["w","B",3,3],["w","L",1.5,2],["w","L",4.25,1.5],["w","B",-2.5,7],["w","B",-6.25,2.5],["d","R",8.26,1.25],["d","L",8.14,1]],"p":[["f","hearth","P0.23","F0.5",180],["f","piece_table_oak","P0.24","P-0.17",180],["f","piece_throne01","C0.03","F0.93",270],["f","bed","P0.31","B0.17",180],["f","bed","P0.15","B0.19",180],["f","piece_chair03","R0","P-0.17",248],["f","piece_chair03","C-0.09","P-0.18",68],["f","jute_carpet","P0.23","P0.37",270],["f","jute_carpet","L0.26","P-0.11",90],["f","fermenter","P-0.28","F0.21",270],["f","fermenter","L1.05","F0.19",90],["c","piece_chair03",1,-2.1,-1.08,0,0.01],["c","piece_chair03",1,-1.09,-1.07,337,0.01],["c","piece_chair03",1,0.11,-1.09,23,0.01],["c","piece_chair03",1,1.27,-1.08,0,0.01],["c","piece_chair03",1,2.62,-1.14,337,0.01],["c","rug_deer",1,-2.48,0.55,248,0.02],["c","rug_fur",1,0.25,0.68,270,0.02],["c","rug_deer",1,2.28,0.74,293,0.02],["c","rug_hare",2,0.06,0.69,270,0.01],["c","piece_chest",3,-0.03,1.67,0,-0.02],["c","piece_chest",4,-0.02,1.65,0,-0.02],["c","treasure_stack",1,1.95,0.27,45,0.77],["c","itemstandh",1,-1.98,-0.69,23,0.79],["c","itemstandh",1,-1,-0.23,23,0.79],["c","itemstandh",1,-0.91,-0.77,315,0.79],["c","itemstandh",1,-0.64,0.61,23,0.79],["c","itemstandh",1,0.1,-0.69,45,0.79],["c","itemstandh",1,0.72,0.48,338,0.79],["c","itemstandh",1,1.05,-0.75,0,0.79],["c","itemstandh",1,1.13,-0.19,315,0.79],["c","itemstandh",1,-1.82,-0.23,315,0.85],["c","itemstandh",1,-0.08,-0.13,23,0.85],["m","itemstand","R0","P-0.21",1.18],["m","itemstand","R0","P0.16",1.18],["m","itemstand","R0","P-0.14",1.18],["m","itemstand","R0","P-0.17",1.18],["m","itemstand","R0","P-0.18",1.18],["m","itemstand","R0","P-0.2",1.18],["m","itemstand","R0","P0.15",1.18],["m","itemstand","R0","P-0.15",1.18],["m","wood_dragon1","R0","P-0.33",1.9],["m","wood_dragon1","R0","P-0.32",2.4],["m","wood_dragon1","R0","P-0.32",2.4],["m","piece_banner01","R0.44","F0",3.77],["m","piece_banner01","P0.03","F0",3.77]],"id":"RT-0092"},{"kind":"kitchen","W":12.5,"D":9.5,"fill":0.57,"doorU":-3.97,"fire":[-3.62,-0.72],"dens":1.48,"open":[["w","F",1.57,2],["w","F",5.9,1.75],["w","B",-3.26,9],["w","R",2.22,5],["w","B",0.69,2.25],["w","B",3.94,3.25],["w","R",3.81,1.75]],"p":[["f","piece_table","C-0.1","F0.23",180],["f","hearth","L0.8","P-0.08",135],["f","hearth","P-0.06","B0.8",135],["f","piece_chest_blackmetal","P0.23","B1.05",180],["f","piece_oven","L0.86","F0",0],["f","jute_carpet","P-0.14","F0.93",135],["f","rug_deer","R0.35","P0.16",180],["c","piece_cookingstation_iron",1,-0.02,0.49,180,0.58],["c","piece_cauldron",2,0.84,0.53,203,0.58],["c","piece_cookingstation",2,-0.05,0.08,270,0.58],["c","piece_cookingstation",2,-0.47,0.09,270,0.58],["c","piece_cookingstation",2,-1,0.05,270,0.58]],"id":"RT-0093"},{"kind":"sleeping","W":13.5,"D":18.5,"fill":0.61,"doorU":2,"fire":null,"dens":0.99,"open":[["w","R",1.09,6],["w","F",-5.93,1.5],["w","B",-5.93,1.5],["w","F",-5.93,1.5],["w","B",-5.93,1.5],["w","F",-5.18,2],["w","B",-5.18,2],["w","B",5.82,1],["w","F",6.07,1.5],["w","B",6.57,0.5],["w","F",6.57,0.5],["w","B",-5.18,2],["w","F",-5.18,2],["w","B",4.82,2],["w","F",4.82,2],["w","L",4.97,1.25],["w","L",-2.53,1.75]],"p":[["f","piece_table","P0.18","P0.06",90],["f","piece_bed02","P-0.19","P0.06",90],["f","piece_bed02","P-0.19","P-0.19",90],["f","piece_bed02","P-0.19","P0.31",90],["f","piece_chair","P-0.27","P0.15",90],["f","piece_chair","P-0.27","P-0.11",90],["f","piece_chair","P-0.25","P0.4",90],["f","rug_hare","P-0.18","P-0.1",270],["f","rug_hare","P-0.17","P0.15",270],["f","rug_hare","P-0.17","P0.22",270],["c","piece_chair03",0,-2.04,-0.07,67,-0.01],["c","rug_fur",0,0.1,-0.65,270,0],["c","piece_chair02",0,1.95,-0.26,293,0.01],["c","itemstandh",0,0.53,-0.1,180,0.82],["c","itemstandh",0,-1,0.03,270,0.82],["c","itemstandh",0,-0.28,0.07,157,0.82],["m","piece_walltorch","L0","P-0.27",2.32],["m","piece_walltorch","L0","P0.38",2.45],["m","itemstand","R0","P0.21",2.67],["m","itemstand","R0","P-0.09",2.67],["m","piece_dvergr_lantern","L0","P0.06",3.09],["m","piece_dvergr_lantern","L0","P0.38",3.09]],"id":"RT-0094"},{"kind":"living","W":6.5,"D":12,"fill":0.72,"doorU":1.03,"fire":null,"dens":1.77,"open":[["w","R",-4.93,2],["w","R",5.57,1],["w","R",3.57,2]],"p":[["f","piece_table","P0.11","P-0.13",180],["f","piece_table","P0.1","P0.13",180],["f","rug_fur","P0.1","C0.17",180],["c","piece_bench01",0,0.04,-0.87,0,0.01],["c","piece_bench01",1,0.01,0.82,180,0.01],["m","piece_walltorch","R0","P-0.37",1.87],["m","piece_walltorch","R0","B1.18",1.88],["m","piece_dvergr_lantern","P0.22","F0",4.09],["m","piece_dvergr_lantern","P-0.09","F0",4.09],["m","piece_dvergr_lantern","L0.85","B0",4.09],["m","piece_dvergr_lantern","P0.22","B0",4.09]],"id":"RT-0095"},{"kind":"sleeping","W":3.5,"D":18,"fill":0.67,"doorU":-0.8,"fire":null,"dens":0.94,"open":[["w","B",1.42,0.75],["w","F",1.42,0.75]],"p":[["f","piece_bed02","L0","B0.2",90],["f","piece_bed02","L0","P0.24",90],["f","piece_bed02","L0","P0.05",90],["f","piece_chair","R0","B0",90]],"id":"RT-0097"},{"kind":"storage","W":2.5,"D":9.5,"fill":0.74,"doorU":0.75,"fire":[0.05,3.04],"dens":6.29,"open":[],"p":[["f","hearth","R0.2","B0.11",270],["f","piece_chest_wood","L0.16","F0.67",180],["f","piece_chest_wood","L0.18","P-0.17",0],["f","piece_chest_wood","L0.25","P0.05",0],["f","piece_chest_wood","L0.18","P-0.26",0],["f","piece_chest_wood","L0.24","C-0.3",0],["c","piece_cookingstation_iron",0,-0.05,0.79,180,0.58],["c","piece_cookingstation",0,1.31,0.04,90,0.58],["c","piece_cookingstation",0,0.83,-0.02,90,0.58],["c","piece_cookingstation",0,0.31,-0.06,90,0.58],["c","piece_cauldron",0,-0.73,-0.43,135,0.58]],"id":"RT-0098"},{"kind":"home","W":17,"D":14,"fill":0.47,"doorU":6.5,"fire":null,"dens":0.89,"open":[["w","L",3.92,5.75],["w","L",-5.21,3.5]],"p":[["f","piece_table","P-0.15","P-0.09",270],["f","piece_throne01","P-0.24","P-0.07",112],["f","piece_bed02","P0.23","P-0.09",90],["f","piece_chair","P0.17","P-0.2",124],["f","piece_chair03","R0.3","P0.07",225],["f","piece_chest_wood","L0.19","P-0.28",0],["f","piece_chest_wood","P0.37","P-0.08",90],["f","piece_chest_wood","L0.26","P0.11",0],["f","rug_wolf","P0.3","P-0.23",225],["c","jute_carpet",1,0.79,0.23,12,0.01],["c","rug_fur",2,-1.59,0.84,214,-0.04],["m","piece_banner01","L0","P-0.09",3.15],["m","piece_banner01","R0","P-0.08",3.21]],"id":"RT-0099"},{"kind":"sleeping","W":6,"D":8,"fill":0.79,"doorU":2,"fire":null,"dens":1.05,"open":[["w","L",3,2],["w","B",-2,2],["d","F",2,2]],"p":[["f","bed","R0.74","B0.43",90],["f","piece_chest_wood","L0.47","F0.17",0],["f","piece_chest_wood","L0.49","F1.12",180],["f","rug_fur","R0.64","F0.92",202],["m","piece_walltorch","R0","P0.12",0.94]],"id":"RT-0100"},{"kind":"sleeping","W":6,"D":8,"fill":0.88,"doorU":-2,"fire":null,"dens":2.14,"open":[["w","L",3,2],["w","R",3,2],["d","F",-2,2]],"p":[["f","bed","L0.6","B0.43",90],["f","piece_chair","L0.73","C0.03",90],["f","piece_chest_wood","R0.63","F0.4",0],["f","piece_chest_wood","R0.24","B0.25",90],["f","piece_chest_wood","R1.08","B0.25",90],["f","piece_chest_wood","R0.59","P-0.3",0],["f","rug_fur","L0.96","C-0.31",191],["f","piece_chair02","L0.5","P0.12",146],["f","piece_chair02","L0.37","P-0.11",45],["m","piece_walltorch","L0","C0",1.28]],"id":"RT-0101"},{"kind":"smithy","W":8,"D":16,"fill":0.72,"doorU":1,"fire":null,"dens":1.85,"open":[["w","B",-3,2],["w","L",7,2],["d","L",0.5,3],["d","F",1,2],["d","B",1,2]],"p":[["f","forge","P0.18","P-0.12",270],["f","piece_workbench","P0.17","P0.04",270],["f","piece_spinningwheel","L0.4","P0.31",0],["f","piece_chest_wood","R0.49","B1.08",180],["f","piece_chest_wood","R0.48","F0.21",180],["f","piece_chest_wood","R0.47","B0.31",180],["f","piece_chest_wood","R0.41","F1.03",180],["f","piece_chest","L0.48","F0.28",0],["f","piece_chest","P-0.12","B0.48",180],["f","piece_chest","P0.16","P0.19",270],["f","piece_chest","P0.18","P-0.24",270],["f","piece_chest","L0.36","P0.18",90],["f","piece_chest","P-0.13","F0.23",0],["m","piece_walltorch","P-0.25","F0",1.88],["m","piece_walltorch","L0","B0.23",1.88],["m","piece_walltorch","L0","P0.31",2.06],["m","piece_walltorch","R0","C-0.13",2.44]],"id":"RT-0102"},{"kind":"smithy","W":2,"D":12,"fill":1,"doorU":0.5,"fire":null,"dens":2.08,"open":[],"p":[["f","piece_workbench_ext3","R0.5","C-0.23",90],["f","piece_workbench_ext1","L0.55","F1.06",90],["f","forge_ext5","L0.46","P0.31",90],["f","forge_ext1","R0.38","P0.15",0],["f","piece_workbench_ext2","R0.66","P-0.21",90]],"id":"RT-0103"},{"kind":"sleeping","W":8,"D":6,"fill":0.79,"doorU":1,"fire":null,"dens":1.58,"open":[["w","L",-2,2]],"p":[["f","bed","R0.51","F0.39",0],["f","piece_chair","C-0.21","P0.23",180],["f","piece_chest_blackmetal","R1.04","B0.76",270],["f","rug_deer","C0.21","C0.05",214],["f","piece_chair02","P-0.13","P0.21",135],["m","piece_walltorch","P-0.12","F0",2.68],["m","piece_walltorch","L0","F0.86",2.74]],"id":"RT-0104"},{"kind":"sleeping","W":8,"D":6,"fill":0.79,"doorU":1,"fire":null,"dens":2.11,"open":[["w","L",2,2]],"p":[["f","bed","R0.46","B0.73",180],["f","rug_wolf","C0.14","C-0.29",247],["f","piece_chest","P0.13","F1.02",180],["f","piece_chest","P-0.12","F1.13",180],["f","piece_chest","R0.33","F1",180],["m","piece_banner02","L0.63","B0",0.53],["m","piece_banner05","P-0.13","B0",0.54],["m","piece_walltorch","P-0.13","B0",1.24],["m","piece_walltorch","L0","P0.17",2.23]],"id":"RT-0105"},{"kind":"other","W":7.5,"D":3.5,"fill":0.93,"doorU":0.25,"fire":null,"dens":2.45,"open":[["w","R",-0.1,3.5],["w","B",0.04,7.5],["w","F",-1.94,3],["w","F",1.12,2.75],["w","B",-1.94,3],["w","B",1.12,2.75],["w","F",-0.78,6],["w","B",-0.78,6],["w","F",3.09,1.25],["w","B",3.35,2]],"p":[["f","piece_groundtorch_wood","R0.76","B0.52",0],["f","piece_groundtorch_wood","L0","B0.5",0],["f","piece_groundtorch_wood","P-0.05","B0.4",0],["m","itemstand","P0.05","F0",1.03],["m","itemstand","P0.25","F0",1.07],["m","itemstand","P0.15","F0",1.05]],"id":"RT-0106"},{"kind":"smithy","W":4,"D":4,"fill":1,"doorU":1,"fire":null,"dens":2.5,"open":[["d","F",0,4]],"p":[["f","piece_workbench_ext3","L0.58","C0.15",270],["f","forge_ext3","R0.49","B0.94",270],["m","piece_banner02","R0.37","B0",3.54],["m","piece_banner02","L0.33","B0",3.55]],"id":"RT-0107"},{"kind":"home","W":16,"D":8,"fill":0.94,"doorU":7,"fire":null,"dens":1.5,"open":[],"p":[["f","piece_throne01","P0.28","F1.13",315],["f","piece_table_round","C-0.22","C-0.07",56],["f","piece_bed02","L0.1","B0.78",90],["f","piece_bed02","L0.16","F0.98",90],["f","piece_chair","P-0.23","B0.41",124],["f","piece_chair","P-0.23","P-0.13",135],["f","rug_deer","P-0.18","B0.83",135],["f","piece_chest","P-0.24","P-0.26",90],["f","piece_chest","P-0.25","B1.13",90],["c","piece_chair03",1,1.87,0.4,259,-0.03],["c","piece_chair03",1,0.67,-1.46,326,-0.03],["c","piece_chair03",1,-1.69,0.1,90,-0.03],["c","rug_fur",1,0.22,0.69,0,-0.03],["c","rug_wolf",3,-0.18,1.87,315,-0.05],["c","piece_chair03",1,-0.98,1.46,147,-0.01],["h","piece_brazierceiling01","C0.03","C0.04",90,1.78],["m","piece_banner05","P-0.19","B0",3.55],["m","piece_banner05","P-0.31","B0",3.55],["m","piece_banner05","L0.72","B0",3.55],["m","piece_banner05","L0","P-0.18",3.68],["m","piece_banner05","L0","P0.18",3.68]],"id":"RT-0108"},{"kind":"smithy","W":32.5,"D":4.5,"fill":0.71,"doorU":-3.09,"fire":null,"dens":1.74,"open":[["w","R",0.21,3.75],["w","F",-7.21,8],["w","F",4.04,6.5],["w","F",12.29,8],["w","B",-15.49,1.75],["w","B",14.69,1],["w","F",-12.61,4],["w","B",15.54,1.5]],"p":[["f","piece_workbench","P0.38","B0.73",180],["f","forge","R0.46","F0.38",90],["f","piece_table_round","P-0.24","B1.17",0],["f","piece_chair03","P0.14","C-0.31",292],["f","piece_chair03","P0.08","C0.18",113],["f","jute_carpet","P0.24","F0.26",180],["c","forge_ext1",1,-1.54,0.05,0,-0.16],["c","piece_chair03",2,0.99,-0.99,315,-0.01],["c","piece_chair03",2,-1.12,-1.18,45,-0.01],["c","rug_fur",2,0.85,-0.06,90,0],["c","rug_fur",2,-1.09,-0.02,90,0],["c","piece_chair03",2,1.23,0.85,225,0.02],["c","piece_chair03",2,-1.28,0.54,113,0.02],["c","itemstandh",2,0.41,0.56,113,0.8],["c","itemstandh",2,0.48,-0.15,113,0.8],["c","itemstandh",2,-0.48,0.55,113,0.8],["c","itemstandh",2,-0.38,-0.46,180,0.8],["m","wood_dragon1","P0.44","F0",2.45],["m","wood_dragon1","P0.32","F0",2.45],["m","wood_dragon1","P0.17","F0",2.45],["m","wood_dragon1","P-0.11","F0",2.45],["m","wood_dragon1","P-0.23","F0",2.45],["m","wood_dragon1","R0","F0",2.47],["m","wood_dragon1","P0.38","B0",2.95],["m","wood_dragon1","P-0.45","B0",2.95]],"id":"RT-0109"},{"kind":"hall","W":3.5,"D":14,"fill":0.67,"doorU":1.11,"fire":null,"dens":0.91,"open":[["w","R",4.94,4],["w","R",1.43,2],["w","R",-1.57,2]],"p":[["f","piece_throne01","L0.88","P0.11",248],["f","piece_throne01","R0.89","P-0.14",315],["f","piece_chest","R0","C-0.08",270],["c","jute_carpet",0,-0.78,0.24,22,0],["c","jute_carpet",1,0.43,0.74,315,-0.02]],"id":"RT-0110"},{"kind":"smithy","W":6,"D":8,"fill":0.96,"doorU":0.05,"fire":null,"dens":1.95,"open":[["w","L",-3.18,1.5]],"p":[["f","forge","L0.78","P0.21",90],["f","piece_workbench","L0.6","F1.12",90],["f","piece_chest","R0.35","F0.29",0],["f","piece_chest","R0.01","C-0.01",270],["f","piece_chest","R0.28","B0.2",180],["f","piece_groundtorch_mist","P0.18","B0.06",180],["f","piece_groundtorch_mist","P-0.14","B0.08",180],["c","forge_ext4",0,1.35,-0.04,0,-0.01],["c","rug_deer",1,-0.37,0.92,270,0.03],["c","rug_deer",0,0.19,0.71,90,0.03],["c","forge_ext1",0,-1.45,0.06,0,0.04]],"stair":1,"id":"RT-0111"},{"kind":"workshop","W":2,"D":4,"fill":1,"doorU":-1.11,"fire":null,"dens":3.75,"open":[["w","B",-0.07,2]],"p":[["f","piece_workbench_ext3","R0","B0.81",90],["f","piece_chest_barrel","R0.22","F0.85",90],["f","piece_chest_barrel","R0.26","F0.06",90]],"stair":1,"id":"RT-0112"},{"kind":"storage","W":4,"D":2,"fill":1,"doorU":-0.25,"fire":null,"dens":5,"open":[],"p":[["f","piece_chest_barrel","R0.16","B0.31",180],["f","piece_chest_barrel","R0.13","B0",180],["f","piece_chest_barrel","R0.8","B0",180],["f","piece_chest_barrel","L0.14","B0",180]],"id":"RT-0113"},{"kind":"tavern","W":8,"D":21.5,"fill":0.85,"doorU":3.25,"fire":[0,-9.72],"dens":1.51,"open":[["w","R",7.84,1.75],["w","B",3.15,2],["w","B",1.52,2],["w","B",-0.4,2],["w","L",8.11,2],["w","B",-1.86,1],["w","B",-3.03,2],["w","F",-2.98,1],["w","B",-3.29,1.75],["w","B",3.24,1.75],["w","F",2.98,1],["w","F",-1.5,1],["w","R",-9.25,1],["w","R",3.25,4],["w","R",-7.25,3],["w","L",-9.25,1],["w","R",2.51,4],["w","R",0.75,1],["w","R",2.5,5.5]],"p":[["f","hearth","C0","F0.03",0],["f","piece_table","C-0.05","P0.08",180],["f","piece_table","C-0.06","P0.13",180],["f","piece_table","C-0.08","P0.19",180],["f","piece_throne01","P0.23","P0.1",270],["f","piece_throne01","P0.24","P0.18",270],["f","jute_carpet","C-0.15","P-0.3",180],["f","jute_carpet","P-0.16","P-0.13",90],["f","rug_fur","C-0.15","P0.27",270],["f","piece_groundtorch","R0.93","P0.4",0],["f","piece_groundtorch","L0.83","P0.39",0],["c","rug_fur",4,-0.49,0.69,270,-0.01],["c","rug_fur",3,-1.25,0.41,0,0],["c","rug_fur",1,1.15,0.09,0,0],["c","rug_fur",3,1.26,0.42,0,0],["c","piece_chair02",1,1.88,0.51,225,0.04],["c","piece_chair02",2,1.95,0.54,270,0.04],["c","piece_chair02",2,1.98,-0.46,292,0.04],["c","piece_chair02",3,1.91,-0.63,292,0.04],["c","piece_cookingstation",0,1.11,0.03,90,0.58],["c","piece_cookingstation",0,0.63,0.03,90,0.58],["c","piece_cookingstation_iron",0,0.01,-0.4,180,0.58],["c","piece_cookingstation",0,0.13,0.05,90,0.58],["c","piece_cauldron",0,-1.23,0.58,90,0.58],["c","itemstandh",1,1.02,0.14,225,0.82],["c","itemstandh",3,-0.92,-0.22,180,0.82],["c","itemstandh",3,0.6,-0.37,247,0.82],["c","itemstandh",3,0.98,0,45,0.82],["c","itemstandh",1,-0.87,0.33,225,0.84],["c","itemstandh",1,-0.86,-0.18,135,0.84],["c","itemstandh",2,-0.87,0.42,135,0.84],["c","itemstandh",1,0.02,-0.19,180,0.84],["c","itemstandh",1,0.68,0.31,180,0.84],["c","itemstandh",2,-0.44,0.08,158,0.84],["c","itemstandh",2,0.23,0.06,135,0.84],["c","itemstandh",2,0.72,0.14,292,0.84],["c","itemstandh",3,-0.39,-0.09,247,0.84],["c","itemstandh",3,0.47,0.31,247,0.84],["c","itemstandh",1,0.02,-0.19,180,0.88],["m","itemstand","R0","P-0.36",1.92],["m","itemstand","R0","P-0.36",1.93],["m","piece_walltorch","L0","P0.2",2.02],["m","wood_dragon1","P0.31","B0",3],["m","wood_dragon1","P-0.31","F0",3]],"id":"RT-0114"},{"kind":"sleeping","W":5,"D":5,"fill":0.84,"doorU":0.64,"fire":null,"dens":3.33,"open":[["w","B",1.75,1.25],["w","F",1.87,1.5],["w","L",0.99,3],["w","R",1.41,2.25],["d","F",0.64,2]],"p":[["f","bed","L0.42","F0.44",0],["f","piece_chest_wood","R0.1","F0.41",270],["f","rug_deer","R0.95","F0.98",247],["c","piece_groundtorch_wood",0,1.03,-1.2,90,-0.12],["m","itemstand","L0","P-0.18",1.83],["m","itemstand","L0.91","F0",1.85],["m","itemstand","L0","F0.52",2.57],["m","itemstand","P0.12","F0",2.89]],"id":"RT-0115"},{"kind":"sleeping","W":4.5,"D":5,"fill":0.83,"doorU":-0.61,"fire":null,"dens":2.13,"open":[["w","L",1.41,2.25],["w","R",0.33,1.5],["d","F",-0.61,2]],"p":[["f","bed","R0.1","F0.42",0],["f","piece_chest_wood","L0","F0.43",90],["f","rug_deer","L0.4","F0.7",315],["f","piece_groundtorch_wood","L0.29","C0.1",90],["m","itemstand","P-0.13","F0",2.85]],"id":"RT-0116"},{"kind":"living","W":7,"D":3.5,"fill":1,"doorU":0,"fire":null,"dens":0.82,"open":[["w","B",0.13,3.25]],"p":[["f","piece_table","R0.18","B0.67",90],["c","piece_chair03",0,0.04,-1.1,0,0.02],["c","itemstandh",0,-0.02,-0.04,0,0.74]],"id":"RT-0117"},{"kind":"storage","W":7,"D":2,"fill":0.95,"doorU":0.25,"fire":null,"dens":3.77,"open":[["w","B",-1.04,2]],"p":[["f","piece_chest","L0.3","B0.15",270],["f","piece_chest","P-0.27","B0.15",270],["f","piece_chest","P-0.13","B0.14",270],["m","piece_walltorch","P-0.15","B0",2.16],["m","piece_banner04","L0","F0.35",2.8]],"id":"RT-0118"},{"kind":"workshop","W":6.5,"D":8,"fill":0.81,"doorU":-0.59,"fire":null,"dens":2.62,"open":[["w","L",-3.19,1.75],["w","L",3.65,1.5],["w","R",-3.19,1.75],["w","F",2.54,1.25],["w","B",2.67,1],["w","F",2.55,1.25],["w","B",-2.96,0.75],["w","F",-2.96,0.75],["d","F",-0.59,2],["w","F",1.79,0.75]],"p":[["f","piece_workbench","L0.67","B0",180],["f","rug_fur","L0.81","C0.18",180],["f","piece_chest_barrel","P0.19","F0.27",270],["f","piece_chest_barrel","R0.9","F0.29",270],["f","piece_chest_barrel","R0","P-0.17",270],["f","piece_chest_barrel","R0","P-0.27",270],["f","piece_workbench_ext2","R0.35","B0.04",180],["c","piece_workbench_ext3",0,-2.41,-0.27,0,0],["m","piece_walltorch","R0","P-0.19",2.38],["m","piece_walltorch","L0.51","F0",2.39],["m","piece_walltorch","P0.21","F0",2.42],["m","piece_walltorch","R0","P0.21",2.43]],"id":"RT-0119"},{"kind":"sleeping","W":6,"D":6,"fill":0.91,"doorU":-2.06,"fire":null,"dens":1.22,"open":[["w","F",-2.56,0.75],["w","F",-0.18,2],["w","R",2.58,0.75],["w","L",-1.42,0.75],["w","L",2.41,1],["w","B",-2.56,0.75]],"p":[["f","piece_throne01","R0.11","P0.1",270],["f","piece_table_round","R0.62","F0.67",270],["f","ashwood_bed","R0.35","B0",270],["f","rug_fur","C0.16","P0.07",90],["c","piece_chair03",1,-0.84,1.24,112,-0.01]],"id":"RT-0120"},{"kind":"storage","W":6,"D":8,"fill":0.82,"doorU":0.08,"fire":null,"dens":1.27,"open":[["d","F",0.08,2],["w","F",-2.17,1.5],["w","F",2.33,1.5],["w","B",-1.92,1],["w","B",2.33,1.5],["w","R",-0.91,2],["w","L",-0.91,2],["w","L",3.09,2],["w","B",-1.67,1.5],["w","B",2.08,2],["w","R",3.09,2]],"p":[["f","piece_chest","R0.09","F0.39",270],["f","piece_chest","L0.23","F0.41",90],["f","piece_chest","R0.07","P-0.12",270],["f","piece_chest","L0.25","P-0.11",90],["f","rug_deer","R0.25","B0.66",202],["f","fermenter","L0.42","P0.17",0]],"id":"RT-0121"},{"kind":"storage","W":8,"D":6.5,"fill":0.75,"doorU":-0.92,"fire":null,"dens":4.36,"open":[["w","L",1.42,1.5],["w","L",-1.08,1.5],["w","R",-0.33,5]],"p":[["f","rug_hare","R0","B0",292],["f","piece_chest","R0.07","F0.76",270],["f","piece_chest","L0.2","F0",90],["f","piece_chest","L0.23","B0",270],["f","piece_chest","L1.16","F0",90],["f","piece_chest","L1.18","B0",270],["f","piece_chest","P-0.17","F0",90],["f","piece_chest","P-0.17","B0",270],["f","piece_chest","P-0.06","F0",90],["f","piece_chest","P-0.05","B0",270],["m","sign","L0.1","F0",2.68],["m","sign","P-0.05","B0",2.68],["m","sign","L0.12","B0",2.68],["m","sign","P-0.05","F0",2.68],["m","sign","L1.09","F0",2.68],["m","sign","P-0.18","B0",2.68],["m","sign","L1.12","B0",2.68],["m","sign","P-0.18","F0",2.68]],"id":"RT-0122"},{"kind":"workshop","W":6,"D":10,"fill":0.93,"doorU":0,"fire":null,"dens":2.16,"open":[["d","F",0,2],["w","B",-2.5,1],["w","B",2.5,1]],"p":[["f","piece_table","L0.43","P0.15",90],["f","piece_artisanstation","L0.55","P-0.1",90],["f","rug_fur","L0.69","P-0.1",180],["c","rug_deer",0,0.22,0.46,247,0.02],["c","treasure_stack",0,-1.03,-0.4,23,0.8],["c","itemstandh",0,0.9,-0.03,203,0.82],["c","itemstandh",0,0.14,0.19,247,0.82],["m","sign","P0.17","F0",0.83],["m","piece_dvergr_lantern","L0","F0",3.09],["m","sign","L0","P-0.13",3.27],["m","sign","L0","P-0.12",3.27],["m","sign","L0","P-0.11",3.27],["m","sign","L0","P-0.08",3.27],["m","sign","L0","P-0.07",3.27],["m","itemstand","R0","P-0.1",3.3],["m","piece_banner01","R0","B0",3.94],["m","piece_banner01","R0","P0.1",3.94]],"id":"RT-0123"},{"kind":"living","W":5,"D":6,"fill":0.78,"doorU":0,"fire":null,"dens":0.85,"open":[["w","L",0.5,5],["w","B",-1.5,2],["w","F",-0.5,4],["w","B",0.5,2],["w","L",-2.5,1],["w","B",-1.5,2],["w","B",-2,1],["w","F",0,5],["w","R",0.25,3.5],["w","F",-0.97,2],["w","B",-0.72,1.5],["w","L",0.25,3.5],["w","R",0.25,3.5]],"p":[["f","piece_table","R1.05","C0.23",270],["f","rug_wolf","R0.53","F0",247],["c","rug_fur",0,-0.04,-0.02,270,0.02],["c","piece_chair03",0,0.62,-0.76,338,0.04],["c","itemstandh",0,-0.89,-0.14,0,0.82],["c","itemstandh",0,0.34,0.04,315,0.87]],"id":"RT-0124"},{"kind":"smithy","W":8,"D":5,"fill":0.91,"doorU":-2.01,"fire":null,"dens":1.92,"open":[["w","R",-0.21,4.5],["w","F",-2.26,3.5],["w","F",2.24,3.5],["w","F",-4.01,1],["w","L",-0.21,4.5],["w","B",-0.01,2]],"p":[["f","piece_workbench","R0.07","C0.14",270],["f","forge","L0.06","B0.38",270],["f","piece_chest_wood","P0.24","F0.4",0],["f","piece_chest_wood","L0.17","F0.48",90],["c","piece_workbench_ext1",0,-1.84,0.23,90,0.01],["c","forge_ext2",1,-3.04,-1.58,0,0.04],["c","piece_workbench_ext2",0,1.71,2.02,270,0.04]],"id":"RT-0125"},{"kind":"sleeping","W":9,"D":13,"fill":0.56,"doorU":-1.75,"fire":null,"dens":1.83,"open":[["w","L",-1.99,1],["d","F",-1.75,2],["d","F",0.2,2],["w","L",0.18,1],["w","R",0.06,0.75],["w","L",0.06,0.75],["w","R",0.18,1]],"p":[["f","piece_bed02","L0.33","P-0.23",90],["f","piece_throne01","P0.26","P-0.34",315],["f","piece_chair","L0.69","P-0.36",90],["f","piece_chair","L0.62","P-0.09",90],["f","piece_chest","R0","P-0.3",90],["f","piece_chest","R0","P0.06",90],["f","rug_fur","L0.6","P-0.08",90],["f","rug_wolf","C0.28","P-0.1",113],["f","rug_fur","C-0.04","P-0.22",90],["f","rug_wolf","P0.2","P-0.22",0],["f","rug_fur","L0","F0.09",68],["f","rug_wolf","C0.23","F0.36",68],["c","piece_chest",0,-0.06,2.03,0,-0.02],["m","itemstand","L0","P-0.24",2.65],["m","piece_walltorch","L0","P-0.04",2.42],["m","piece_walltorch","L0","P-0.19",2.46],["m","piece_banner02","P-0.25","F0",3.58],["m","piece_banner02","P0.07","F0",3.47]],"id":"RT-0126"},{"kind":"sleeping","W":7.5,"D":8,"fill":0.6,"doorU":0.04,"fire":null,"dens":0.83,"open":[["w","R",-1.51,1],["w","B",-0.84,0.25],["w","F",4.16,1]],"p":[["f","bed","R0","F0.33",225],["f","bed","L0.41","F0.41",135],["h","piece_brazierceiling01","C-0.13","C0.17",203,3.78]],"id":"RT-0127"},{"kind":"storage","W":7.5,"D":7.5,"fill":0.43,"doorU":0.75,"fire":null,"dens":1.24,"open":[["w","F",-2.21,0.5],["w","L",1.26,1],["w","F",-1.41,1.25],["w","B",-2.04,1],["w","B",-4.16,1],["w","R",1.26,1]],"p":[["f","piece_chest_wood","L0.95","F0",45],["f","piece_chest_wood","L0","C0.2",90],["f","piece_chest_wood","L0.29","P0.23",135]],"id":"RT-0128"},{"kind":"storage","W":2,"D":6,"fill":1,"doorU":-1.9,"fire":null,"dens":5,"open":[["w","L",-2.99,0.25],["w","B",0.53,1],["w","F",0.09,2]],"p":[["f","piece_chest_wood","L0.33","B0.08",180],["f","piece_chest_wood","L0.28","B0.87",180],["f","piece_chest_wood","L0.26","P0.09",180],["f","piece_chest_wood","L0.22","C-0.27",180],["f","piece_chest_wood","R0.33","P-0.24",180],["f","piece_chest_wood","R0.23","F0.43",180]],"stair":1,"id":"RT-0129"},{"kind":"storage","W":2,"D":6,"fill":1,"doorU":-1.9,"fire":null,"dens":5,"open":[["w","L",2.51,0.75],["w","F",-0.41,1]],"p":[["f","piece_chest_wood","L0.27","B0.02",180],["f","piece_chest_wood","L0.29","B0.81",180],["f","piece_chest_wood","L0.32","P0.1",180],["f","piece_chest_wood","L0.34","C-0.25",180],["f","piece_chest_wood","R0.31","F0.38",180],["f","piece_chest_wood","R0.22","F1.17",180]],"stair":1,"id":"RT-0130"},{"kind":"workshop","W":14,"D":8,"fill":0.59,"doorU":-4.06,"fire":null,"dens":1.21,"open":[["w","F",-2.55,2],["w","F",0.45,2],["w","F",4.54,6]],"p":[["f","piece_table","P0.28","P-0.1",315],["f","piece_throne01","P0.22","C0.27",146],["f","piece_artisanstation","P0.11","F0.22",337],["f","piece_chair03","C0","P0.06",303],["f","piece_chair03","C0.06","P0.22",224],["f","piece_chest_wood","L0.36","F0.34",0],["f","piece_chest_wood","L0.43","F1.12",0],["m","piece_banner04","P0.13","B0",3.13]],"id":"RT-0131"},{"kind":"other","W":5.5,"D":9.5,"fill":0.91,"doorU":-1.59,"fire":null,"dens":1.05,"open":[["w","R",-4.03,1.5],["w","B",0.32,2],["w","B",-1.64,2],["w","F",-1.64,2],["w","B",-1.5,1.75],["w","F",-1.63,2],["w","F",0.41,2],["w","R",1.73,5],["w","R",-0.77,2]],"p":[["f","piece_chest_wood","L0.42","C0.15",180],["f","piece_chest_wood","L0.42","P-0.08",180],["m","itemstand","R0","P-0.19",1.4],["m","itemstand","R0","P-0.19",2.4],["m","itemstand","R0","P-0.19",3.38]],"id":"RT-0132"},{"kind":"workshop","W":14,"D":7.5,"fill":0.59,"doorU":-4.13,"fire":null,"dens":1.29,"open":[["w","F",-2.62,2],["w","F",0.38,2],["w","F",4.52,6]],"p":[["f","piece_table","P0.28","P-0.13",315],["f","piece_throne01","P0.22","C0.18",147],["f","piece_artisanstation","P0.1","F0",338],["f","piece_chest_wood","L0.31","F0.16",0],["f","piece_chest_wood","L0.39","F0.93",0],["f","piece_chair03","C0.01","P0.06",304],["f","piece_chair03","C0.09","P0.23",225],["m","piece_banner04","P0.14","B0",3.13]],"id":"RT-0133"},{"kind":"other","W":5.5,"D":9,"fill":0.94,"doorU":-0.36,"fire":null,"dens":1.07,"open":[["w","F",-0.35,2],["w","L",3.7,1.75],["w","L",-1.56,5.75],["w","L",3.94,1.25],["w","F",1.68,2],["w","B",1.68,2],["w","F",1.7,2],["w","B",1.7,2],["w","B",-0.26,2]],"p":[["f","piece_chest_wood","R0.37","P-0.08",0],["f","piece_chest_wood","R0.35","C0.26",0],["m","itemstand","L0","P0.15",1.4],["m","itemstand","L0","P0.15",2.4],["m","itemstand","L0","P0.15",3.38]],"id":"RT-0134"},{"kind":"home","W":11.5,"D":6,"fill":0.87,"doorU":5.61,"fire":null,"dens":1,"open":[],"p":[["f","piece_table","R0.52","C-0.08",90],["f","bed","P-0.2","C-0.04",90],["f","piece_chair02","P0.2","F0.33",34],["f","piece_chair","P-0.27","P-0.22",57],["f","jute_carpet_blue","R0.67","C-0.02",136],["f","ArmorStand","P0.22","B0.37",136],["f","rug_deer","P-0.16","B0.45",90],["c","piece_chair02",0,0.18,-0.88,338,0.04]],"id":"RT-0135"},{"kind":"storage","W":6,"D":4,"fill":0.78,"doorU":1,"fire":null,"dens":3.2,"open":[["w","L",1.23,1.5]],"p":[["f","piece_chest_wood","R1.18","B0.09",270],["f","piece_chest_wood","P-0.08","B0.11",270],["f","piece_chest_wood","L0.26","B0.03",270],["f","piece_chest_wood","R0.35","B0.12",270],["f","piece_chest_wood","P0.07","B0.04",270],["f","piece_chest_wood","L1.13","B0.02",270]],"id":"RT-0136"},{"kind":"living","W":7,"D":6.5,"fill":0.46,"doorU":-0.33,"fire":null,"dens":2.41,"open":[["d","F",-0.4,2],["w","B",-1.75,1.5],["w","B",2.91,1]],"p":[["f","piece_table","R0.04","B0.73",270],["f","piece_chest_wood","C0.34","B0.26",180],["f","rug_deer","C0","F0",112],["f","rug_deer","C-0.33","B0.61",258],["c","piece_chair",0,-0.84,1.05,337,0.05],["c","rug_wolf",0,-0.08,1.02,348,0.02],["m","piece_dvergr_lantern","P0.09","F0",3.69],["m","piece_walltorch","P0.16","B0",2.75]],"id":"RT-0137"},{"kind":"living","W":9.5,"D":10,"fill":0.68,"doorU":2.89,"fire":null,"dens":4.67,"open":[["w","F",1.05,7.5],["w","R",-4.09,2],["w","B",-1.8,1.75],["w","L",-2.04,2],["w","R",-2.35,1.5],["w","R",1.9,2],["w","F",-1.79,1.75],["w","B",4.09,1],["w","F",-3.89,1],["w","F",4.11,1],["w","L",1.99,2],["w","B",0.13,6]],"p":[["f","piece_table","L0.14","B0.56",270],["f","piece_cartographytable","P0.06","B0.37",180],["f","piece_chair","P0.1","F0.02",293],["f","piece_chair","P0.15","F0.03",203],["f","piece_chair","P0.15","F0.42",226],["c","piece_chair02",1,1.36,1.19,203,0.04],["c","piece_chair02",1,-0.34,1.3,180,0.04],["c","piece_chair02",1,-1.44,1.21,136,0.04],["m","piece_walltorch","P-0.2","F0",3.95],["m","piece_walltorch","C0.08","F0",4.01],["m","piece_walltorch","P0.21","F0",3.97],["m","piece_walltorch","R0.57","F0",3.93],["m","piece_walltorch","R0","P-0.31",3.79],["m","itemstand","P0.26","F0",2.71],["m","itemstand","P0.26","F0",1.61],["m","itemstand","P0.3","F0",2.72],["m","itemstand","P0.33","F0",2.7],["m","itemstand","R0.97","F0",2.7],["m","itemstand","P0.3","F0",1.62],["m","itemstand","P0.33","F0",1.64],["m","itemstand","R1.01","F0",1.6],["m","itemstand","R0","P-0.31",2.31],["m","itemstand","R0","P-0.34",2.29],["m","itemstand","R0","P-0.23",2.21],["m","itemstand","R0","P-0.27",2.23],["m","piece_walltorch","R0","P0.29",3.91],["m","piece_walltorch","L0","P0.3",3.87],["m","piece_walltorch","P0.22","B0",3.99],["m","piece_walltorch","C0.12","B0",3.97],["m","piece_walltorch","P-0.2","B0",3.94]],"id":"RT-0138"},{"kind":"living","W":10,"D":10,"fill":0.65,"doorU":-3.05,"fire":null,"dens":4.65,"open":[["w","R",0.07,6],["w","B",1.99,2],["w","F",-3.34,3.5],["w","F",1.91,2],["w","L",4.1,1],["w","L",-3.9,1],["w","L",2.12,2],["w","B",-2.04,2],["w","R",-3.88,1],["w","R",2.02,1.75],["w","L",-0.83,7.5]],"p":[["f","piece_cartographytable","R0.37","P-0.04",270],["f","piece_table","R0.56","B0.18",0],["f","piece_chair","L0.02","P-0.07",23],["f","piece_chair","L0.03","P-0.12",293],["f","piece_chair","L0.42","P-0.12",316],["c","piece_chair02",0,1.36,1.19,203,0.04],["c","piece_chair02",0,-0.34,1.3,180,0.04],["c","piece_chair02",0,-1.44,1.21,136,0.04],["m","piece_walltorch","R0","P0.21",3.94],["m","piece_walltorch","R0","C0.09",3.97],["m","piece_walltorch","R0","P-0.19",3.99],["m","piece_walltorch","P0.3","B0",3.87],["m","piece_walltorch","P0.29","F0",3.91],["m","piece_walltorch","P-0.31","F0",3.79],["m","itemstand","P-0.23","F0",2.21],["m","itemstand","P-0.31","F0",2.31],["m","itemstand","P-0.27","F0",2.23],["m","itemstand","L0","P-0.33",2.7],["m","itemstand","P-0.34","F0",2.29],["m","piece_walltorch","L0","P0.22",3.95],["m","piece_walltorch","L0","C0.13",4.01],["m","piece_walltorch","L0","P-0.18",3.97],["m","itemstand","L0","P-0.23",2.71],["m","itemstand","L0","P-0.23",1.61],["m","itemstand","L0","P-0.26",2.72],["m","itemstand","L0","P-0.29",2.7],["m","itemstand","L0","P-0.26",1.62],["m","itemstand","L0","P-0.29",1.64],["m","itemstand","L0","P-0.32",1.6],["m","piece_walltorch","L0","F1.03",3.93]],"id":"RT-0139"},{"kind":"living","W":13,"D":14,"fill":0.74,"doorU":2.15,"fire":null,"dens":0.81,"open":[["w","L",3.05,4],["w","L",2.05,2],["w","R",2.05,2],["w","B",2.63,0.5]],"p":[["f","piece_table_round","P-0.16","P0.21",270],["c","piece_chair03",0,-0.03,1.45,180,-0.01],["c","piece_chair03",0,1.41,-0.3,270,-0.01],["c","rug_deer",0,1.04,0.92,135,0],["c","rug_wolf",0,-0.73,0.69,225,0],["c","rug_fur",0,0.25,-1.45,270,0],["m","itemstand","L0","C0.19",0.54],["m","itemstand","P0.16","F0",0.56],["m","itemstand","L0","C0.12",0.74],["m","itemstand","R0","C0.14",0.75],["c","itemstandh",0,0.11,0.81,23,0.85],["c","itemstandh",0,-0.32,0.32,292,0.85],["c","itemstandh",0,0.07,-0.07,203,0.85],["c","itemstandh",0,-0.4,-0.16,45,0.85],["c","itemstandh",0,0.62,-0.51,90,0.85],["c","itemstandh",0,-0.13,-0.63,90,0.85],["m","itemstand","P-0.06","F0",3.3],["m","itemstand","R1.07","B0",3.84],["m","piece_banner01","P-0.05","F0",3.92],["m","piece_banner01","P0.11","F0",3.92]],"id":"RT-0140"},{"kind":"home","W":21,"D":13.5,"fill":0.33,"doorU":-1.75,"fire":null,"dens":1.38,"open":[["w","R",2.63,2],["w","L",2.88,1.5],["w","L",2.63,1]],"p":[["f","piece_cartographytable","P0.05","B0",180],["f","piece_bed02","L0.18","B0.78",90],["f","piece_artisanstation","P0.2","B0.24",180],["f","piece_chair03","P0.2","P0.37",0],["f","rug_wolf","P0.22","B0.53",90],["f","piece_chest","L0.09","P0.2",90],["f","ArmorStand","P-0.18","B0.08",180],["f","piece_chair02","R0.49","B0.42",135],["f","piece_chest","P-0.24","B0.14",180],["c","piece_chair03",0,-0.04,1.1,203,0.02],["c","rug_deer",0,-0.43,0.88,90,0.02],["c","rug_fur",1,-0.03,2.22,180,-0.04],["c","rug_deer",0,1.2,1,270,0.02],["m","itemstand","L0","P0.07",0.59],["m","piece_walltorch","R0","P0.12",1.7],["m","piece_banner01","L0","B0.87",3.83],["m","piece_banner01","L0","P0.21",3.89]],"id":"RT-0141"},{"kind":"other","W":8,"D":8,"fill":0.82,"doorU":-1.97,"fire":null,"dens":2.11,"open":[["d","L",-0.14,4],["d","B",0.1,4],["w","F",-2.4,1],["w","F",1.35,0.5],["w","L",-3.52,0.75],["w","R",-0.64,1],["w","R",3.98,0.25],["w","B",3.6,1]],"p":[["f","piece_groundtorch","L0.45","F0.23",270],["f","piece_groundtorch","L0.35","B0.53",270],["f","piece_groundtorch","R0.01","B0.34",270],["m","sign","R0","F0.02",0.65],["m","sign","R0","F0.49",0.65],["m","sign","R0","F0.45",0.65],["m","sign","P0.15","F0",0.65],["m","sign","R0","F0.02",0.99],["m","sign","R0","F0.48",0.99],["m","sign","R0","F0.43",0.99],["m","sign","P0.15","F0",1]],"id":"RT-0142"},{"kind":"sleeping","W":12,"D":13,"fill":0.78,"doorU":0.1,"fire":null,"dens":1.23,"open":[["w","R",-0.14,2],["w","R",-0.14,2],["w","L",-0.14,2],["w","F",-5.15,1.5],["w","F",-2.4,2],["w","F",2.6,2],["w","F",5.35,1.5],["w","B",-5.15,1.5],["w","B",-2.4,2],["w","B",2.6,2],["w","B",5.35,1.5],["w","B",-5.15,1.5],["w","B",-2.4,2],["w","B",2.6,2],["w","B",5.35,1.5],["w","F",5.6,1],["w","L",3.98,0.75],["w","R",-2.02,0.75],["w","R",2.73,0.75],["w","R",3.98,0.75],["w","B",5.6,1],["d","F",0.1,2],["d","B",0.35,1.5]],"p":[["f","bed","R0","C-0.23",270],["f","bed","R0","B0.18",180],["f","bed","P0.22","B0.18",180],["f","bed","P-0.19","B0.18",180],["f","bed","L0.09","B0.18",180],["f","rug_fur","L0.7","B0.36",180],["f","rug_fur","R0.87","B0.31",180],["f","rug_fur","C0.31","B0.17",180],["f","piece_chest","P0.21","C-0.12",270],["f","piece_chest","P0.22","P0.21",180],["f","piece_chest","P-0.21","P0.22",180],["f","piece_chest","R0","P0.22",180],["m","piece_banner02","R0","C-0.13",1.83],["m","piece_banner02","R0","F0",1.83],["m","piece_banner02","P0.22","F0",1.83],["m","piece_banner02","P-0.2","F0",1.83],["m","piece_banner02","L0.09","F0",1.83],["m","piece_banner02","R0","C-0.14",1.92]],"id":"RT-0143"},{"kind":"workshop","W":9.5,"D":15,"fill":0.79,"doorU":-0.28,"fire":null,"dens":1.33,"open":[["w","L",-4.96,2],["w","L",-6.96,1],["w","B",-4.18,1],["w","F",-4.18,1],["w","R",-1.54,1],["w","B",-4.21,1],["w","F",-4.21,1],["w","L",5.05,3],["w","L",0.55,2],["w","B",4.07,1.5],["w","F",4.07,1.5],["d","B",-0.24,3.75],["w","R",4.95,3],["w","R",1.95,1],["w","F",2.23,1],["w","F",-3.02,0.5]],"p":[["f","piece_workbench","L0","P0.34",90],["f","piece_bench01","L0","P-0.13",180],["f","piece_artisanstation","R0.29","P0.33",270],["f","rug_deer","L0.23","P-0.24",90],["f","rug_deer","L0.8","P-0.17",135],["f","ArmorStand","R1.16","P0.1",113],["f","rug_deer","L0","P-0.16",23],["f","rug_wolf","R0.1","P0.33",90],["c","rug_deer",0,0.5,0.64,45,0.07],["c","rug_deer",0,-0.3,0.58,316,0.02],["m","itemstand","L0.32","B0",1.75],["m","itemstand","L0.3","B0",3.46],["m","itemstand","L0.32","B0",1.75],["m","itemstand","L0.28","B0",1.77],["m","itemstand","L0.33","B0",3.42],["m","piece_walltorch","L0","P-0.28",2.67],["m","itemstand","R0","P-0.12",0.83],["m","itemstand","R0","P-0.14",0.81],["m","itemstand","R0","P-0.16",0.81],["m","itemstand","R0","P-0.2",0.82],["m","piece_banner04","L0.89","F0",3.54]],"id":"RT-0144"},{"kind":"hall","W":11,"D":8,"fill":0.36,"doorU":-4.5,"fire":null,"dens":0.95,"open":[["w","F",4.5,2],["w","F",-1.25,1.5],["w","R",-3.56,0.75]],"p":[["f","piece_throne01","P-0.19","P-0.06",22],["f","rug_deer","L0.43","B0.91",180],["f","ArmorStand","P-0.12","F0.25",292],["f","piece_groundtorch_wood","P0.26","P0.31",248]],"id":"RT-0145"},{"kind":"other","W":8,"D":2,"fill":0.66,"doorU":2.24,"fire":null,"dens":3.81,"open":[],"p":[["f","jute_carpet","P-0.21","B0",180],["f","ArmorStand","P0.12","B0",45],["f","piece_groundtorch_wood","C0.09","B0.59",180],["f","piece_groundtorch_wood","R0","B0.28",270],["f","piece_groundtorch_wood","L0.43","B0.41",180]],"id":"RT-0146"},{"kind":"workshop","W":4,"D":7.5,"fill":0.6,"doorU":0.97,"fire":null,"dens":1.67,"open":[["w","L",-0.15,4],["d","F",0.97,2],["w","L",-0.16,4]],"p":[["f","piece_workbench","L0.53","C-0.16",90],["f","piece_chest_wood","L0.11","B0.41",90],["f","piece_chest_wood","L0.21","F0.3",90]],"id":"RT-0148"},{"kind":"storage","W":7.5,"D":2,"fill":0.77,"doorU":-0.5,"fire":null,"dens":4.35,"open":[["w","B",0.1,4],["w","B",0.07,4]],"p":[["f","piece_chest_wood","R0","F0.17",270],["f","piece_chest_wood","P0.18","F0.22",270],["f","piece_chest_wood","L0.34","B0.32",180],["f","piece_chest_wood","R0.52","F0.2",270],["f","piece_chest_wood","P0.28","F0.22",270],["f","rug_deer","P-0.09","F0",270]],"id":"RT-0149"},{"kind":"living","W":5,"D":6,"fill":0.93,"doorU":-0.57,"fire":null,"dens":1.07,"open":[["d","F",-0.5,2],["d","L",0,2],["w","L",-2.5,1],["d","R",0,2],["w","B",0.5,4]],"p":[["f","piece_table","C-0.04","B0.33",0],["c","piece_chair03",0,-1.71,-0.28,157,0.02],["c","piece_chair03",0,1.82,-0.41,225,0.02],["c","rug_deer",0,-0.02,-0.67,180,0.02]],"id":"RT-0150"},{"kind":"sleeping","W":5.5,"D":7.5,"fill":0.96,"doorU":-0.12,"fire":null,"dens":1.01,"open":[["w","L",-2.6,2],["w","B",-2.19,1]],"p":[["f","ashwood_bed","R0","F0.32",180],["f","ashwood_bed","R0","B0",0],["f","piece_chest","R0.25","C0.15",90],["m","itemstand","L0.38","B0",3.37]],"id":"RT-0151"},{"kind":"sleeping","W":5.5,"D":8,"fill":0.91,"doorU":0.62,"fire":null,"dens":1.74,"open":[["w","R",-2.6,2],["w","B",2.22,1]],"p":[["f","ashwood_bed","C0.14","B0.19",180],["f","ashwood_bed","L0.19","B0.17",180],["f","piece_chest","R0","F0.41",270],["f","piece_chest","R0","P-0.11",270],["f","piece_chest","R0","P0.14",270],["f","piece_chair","L0.05","P0.07",135],["m","itemstand","R0.37","B0",3.39]],"id":"RT-0152"},{"kind":"smithy","W":15,"D":14,"fill":0.63,"doorU":-4.28,"fire":null,"dens":1.21,"open":[["w","L",-2.38,1],["w","R",-2.38,1],["w","B",6.62,1]],"p":[["f","piece_table","P0.11","P0.19",270],["f","piece_table","P0.24","P0.23",0],["f","forge_ext4","P-0.1","P0.2",0],["f","piece_chest_blackmetal","R0.29","P0.1",270],["f","piece_chest_blackmetal","R0.16","P0.34",270],["f","forge_ext3","P-0.11","P-0.05",0],["f","forge_ext1","P0.24","P-0.11",0],["f","piece_groundtorch","P0.17","P0.28",293],["f","ArmorStand","P0.39","P0.03",293],["f","piece_chair03","P0.3","P-0.06",90],["c","piece_chair03",0,1.86,-0.37,247,0.01],["c","piece_chair02",0,-1.12,1.14,135,0.01],["c","piece_chair02",1,0.23,-1.19,315,0.01],["m","piece_walltorch","P0.07","F0",3.18],["m","piece_walltorch","R0","P0.33",3.78],["m","piece_dvergr_lantern","R0","P-0.2",2.84]],"id":"RT-0153"},{"kind":"storage","W":2,"D":3,"fill":0.96,"doorU":1.95,"fire":null,"dens":5.22,"open":[["w","F",-0.55,1],["w","R",1.02,0.75],["w","R",-1.48,0.25]],"p":[["f","piece_chest","L0.23","F0.33",180],["f","piece_chest","L0.22","B0.99",180],["f","piece_chest","L0.22","B0.12",180]],"stair":1,"id":"RT-0155"},{"kind":"storage","W":9,"D":13,"fill":0.75,"doorU":-3.75,"fire":null,"dens":1.94,"open":[["d","F",0.5,2],["d","L",3,2],["w","L",-2.35,1],["w","L",-4.75,3.5],["w","B",0.03,9],["w","L",-3,2],["w","L",-5.2,2],["w","B",3.99,1.25],["w","R",-0.93,0.25],["w","R",-3.18,0.25],["w","R",-5.43,0.25]],"p":[["f","piece_chest","L0.97","B0.29",90],["f","piece_chest","P-0.24","B0.26",90],["f","piece_chest","P-0.14","B0.24",90],["f","piece_chest","C-0.08","B0.23",90],["f","piece_chest","P0.09","B0.25",90],["f","piece_chest","L0.1","B0.29",90],["f","piece_chest_barrel","P0.24","B0.15",0],["f","piece_chest_barrel","R1.2","B0.12",0],["f","piece_chest_barrel","R0.27","B0.2",0],["m","sign","R0","F0.71",1.66],["m","sign","R0","P-0.26",1.67],["m","sign","R0","F0.71",1.68],["m","sign","R0","P-0.09",1.71],["m","sign","R0","P-0.26",1.72],["m","piece_dvergr_lantern","L0","P0.27",2.44],["m","piece_dvergr_lantern","R0","P-0.33",2.62],["m","piece_dvergr_lantern","R0","P-0.33",2.65]],"id":"RT-0156"},{"kind":"workshop","W":13,"D":9.5,"fill":0.54,"doorU":-3,"fire":null,"dens":1.21,"open":[["w","R",-3.99,1.75],["w","F",-3.18,3],["w","F",-5.68,1.5],["w","L",0.36,1.75]],"p":[["f","piece_workbench","P0.3","B0.21",180],["f","piece_artisanstation","L0","P-0.04",90],["f","piece_chest_wood","R0.36","B0.1",90],["f","piece_chest_wood","P-0.32","P-0.19",0],["f","piece_chest_wood","L0","P0.27",90],["f","piece_workbench_ext2","P-0.31","B1.13",180],["m","piece_dvergr_lantern","R0.54","B0",2.35],["m","piece_dvergr_lantern","P-0.18","B0",2.49]],"id":"RT-0157"},{"kind":"sleeping","W":9,"D":12,"fill":0.75,"doorU":-1.1,"fire":null,"dens":1.47,"open":[["w","R",1.5,1]],"p":[["f","piece_table_round","L0.16","P0.06",180],["f","ashwood_bed","L0.45","F0.41",0],["f","ashwood_bed","P0.12","F0.33",0],["f","rug_asksvin","P-0.12","F0.43",0],["f","piece_chest_barrel","L0","B0.77",180],["f","piece_chest_barrel","L0","B0",180],["c","piece_chair03",0,0.67,1.55,225,-0.01],["c","piece_chair03",0,0.59,-1.5,315,-0.01],["m","sign","C-0.17","F0",2.78],["m","sign","P-0.23","F0",2.79],["m","sign","P0.2","F0",2.8],["m","piece_banner03","L0","P0.26",3.51],["m","piece_banner03","L0","P-0.15",3.6]],"id":"RT-0158"},{"kind":"hall","W":17,"D":15,"fill":0.52,"doorU":-3.79,"fire":null,"dens":1.06,"open":[["w","F",2.87,1.25],["w","B",-1.31,1],["w","B",-2.13,1],["w","L",-3.71,1],["w","L",-1.75,3],["w","B",-3.59,2],["w","B",-5.22,2],["w","L",0.21,1],["w","F",-1.31,1],["w","R",-3.42,1],["w","F",-2.13,1],["w","R",-1.96,2],["w","F",-3.09,1],["w","R",-0.49,1],["w","F",-4.05,1],["w","F",-5.22,2],["w","F",-0.53,3],["w","B",-0.03,4],["w","L",6.59,2],["w","R",6.59,2],["w","F",-4.65,2.75],["w","B",-5.01,3.75],["w","F",-6.93,1.25],["w","B",-6.67,2]],"p":[["f","piece_throne01","P-0.06","B0.7",180],["f","piece_throne01","P-0.32","P0.32",135],["f","jute_carpet","P-0.15","P0.25",157],["m","itemstand","P-0.3","B0",1.53],["m","itemstand","P-0.28","B0",1.53],["m","itemstand","P-0.1","B0",1.54],["m","itemstand","P-0.16","B0",1.54],["m","itemstand","P-0.13","B0",1.55],["m","itemstand","P-0.19","B0",1.55],["m","sign","P0.18","B0",2.49],["m","sign","P0.05","B0",2.49],["m","sign","P-0.03","B0",2.49],["m","sign","P-0.1","B0",2.49],["m","sign","P-0.37","B0",3.06],["m","sign","C-0.07","B0",3.14]],"id":"RT-0159"},{"kind":"kitchen","W":9,"D":8.5,"fill":0.49,"doorU":2.53,"fire":null,"dens":1.34,"open":[["w","B",-2.96,1],["w","L",1.97,0.75],["w","F",-0.84,0.25],["w","F",-2.09,1.25],["w","L",-1.63,2]],"p":[["f","rug_fur","C-0.35","P-0.08",90],["f","piece_oven","R0.78","C0.25",180],["f","piece_chest","P-0.19","P-0.27",90],["f","piece_oven","C-0.25","F0.79",270],["f","fermenter","L1.03","C0.32",90],["f","fermenter","L1.07","B0.1",90]],"id":"RT-0160"},{"kind":"sleeping","W":8,"D":10.5,"fill":0.88,"doorU":-0.88,"fire":null,"dens":3.39,"open":[["w","B",-3.24,1],["w","F",-3.24,1],["w","F",-3.24,1],["w","L",4.38,1.5],["w","B",-0.13,6.5],["w","R",3.13,1],["w","F",3.62,1],["w","F",0.62,1],["d","F",-0.88,2],["w","F",-2.63,1.5]],"p":[["f","piece_throne01","R0.06","P0.23",270],["f","piece_bed02","R0.1","C-0.21",270],["f","piece_bed02","R0.09","P-0.24",270],["f","piece_throne01","R0.54","B0.72",225],["f","piece_chest_wood","L0.51","P0.2",90],["f","rug_wolf","P-0.11","P0.25",90],["f","rug_deer","L0.12","C-0.08",45],["f","rug_wolf","P0.16","P0.24",270],["f","rug_deer","L0.8","P-0.12",90],["f","rug_deer","L0.05","P-0.22",135],["f","ArmorStand","P0.09","F0.03",0],["f","ArmorStand","L0.52","B0.98",112],["m","itemstand","L0.68","B0",1.23],["m","itemstand","L0.59","B0",1.23],["m","itemstand","L0.63","F0",1.23],["m","itemstand","L0.56","F0",1.23],["m","itemstand","L0.55","F0",1.23],["m","itemstand","L0.39","F0",1.26],["m","itemstand","L0.51","F0",1.26],["m","itemstand","L0.45","F0",1.26],["m","itemstand","L0.59","F0",1.26],["m","itemstand","L0.36","F0",1.26],["m","itemstand","L0","P-0.14",2.24],["m","piece_banner02","R0","P0.16",3.18],["m","piece_banner02","R0","F0.34",3.24],["m","piece_banner02","L0","F0.35",3.25],["m","piece_dvergr_lantern","R0","P0.32",3.38],["m","piece_banner04","L0","P0.19",3.44],["m","sign","P-0.11","F0",3.55],["m","piece_dvergr_lantern","R0","P-0.13",3.59]],"id":"RT-0161"},{"kind":"sleeping","W":8,"D":11,"fill":0.87,"doorU":0.88,"fire":null,"dens":2.75,"open":[["w","F",-3.47,1],["w","B",-3.47,1],["w","F",-3.23,0.5],["w","B",-3.48,1],["w","R",1.12,1],["w","B",0.17,6.75],["w","L",5.27,0.5],["w","L",4.27,0.5],["w","L",5.27,0.5],["w","F",-3.62,1],["w","F",-0.62,1],["d","F",0.88,2],["w","F",2.38,1],["w","R",-4.13,1.5]],"p":[["f","piece_throne01","R0.35","P0.14",292],["f","piece_throne01","R0.3","P0.28",247],["f","piece_bed02","L0.05","P-0.23",90],["f","piece_bed02","L0.09","C-0.22",90],["f","piece_chest_wood","R0.3","F0.57",270],["f","rug_deer","R0.22","P-0.2",225],["f","rug_deer","R0.94","P-0.11",270],["f","rug_deer","R0.21","C-0.08",315],["f","ArmorStand","P-0.08","F0.19",0],["f","ArmorStand","L0.08","F0.24",67],["m","itemstand","L0.29","B0",1.26],["m","itemstand","L0.33","B0",1.26],["m","itemstand","L0.37","B0",1.26],["m","itemstand","R0","P-0.11",2.28],["m","itemstand","R0","F0.07",2.63],["m","piece_dvergr_lantern","R0","P0.21",3.09],["m","piece_banner02","R0","P0.21",3.25],["m","piece_banner01","L0","F0",3.25],["m","piece_banner01","L0","F0.64",3.26],["m","piece_banner01","L0","B0",3.28],["m","piece_banner04","R0","P0.2",3.47],["m","sign","P0.11","F0",3.51],["m","piece_dvergr_lantern","L0","P-0.13",3.59],["m","piece_banner04","R0","F0.68",3.59]],"id":"RT-0162"},{"kind":"sleeping","W":8,"D":10.5,"fill":0.8,"doorU":1.12,"fire":null,"dens":1.04,"open":[["w","F",-2.93,1.25],["w","L",0.34,2],["w","L",3.34,2],["w","B",-3.18,1.75],["w","B",0.62,7],["w","R",3.38,1.5],["w","F",2.87,1.5],["d","F",1.12,2],["w","F",-0.38,1],["w","F",-3.38,1]],"p":[["f","piece_bed02","R0.25","P0.19",270],["f","piece_bed02","P-0.22","F0.12",0],["f","rug_wolf","L1.02","P0.12",45],["f","rug_deer","R0.25","C0.18",292],["f","rug_deer","R0.82","P-0.12",270],["f","ArmorStand","L0.36","P-0.06",112],["m","piece_dvergr_lantern","C-0.33","F0",3.22],["m","itemstand","R0","P-0.14",3.41],["m","piece_banner04","R0","P0.19",3.44],["m","sign","P0.14","F0",3.55]],"id":"RT-0163"},{"kind":"sleeping","W":8,"D":11,"fill":0.75,"doorU":-1.12,"fire":null,"dens":1.67,"open":[["w","F",3.13,0.5],["w","B",3.17,1.75],["w","R",4.2,0.25],["w","R",2.95,1.25],["w","R",0.32,2],["w","L",2.95,1.25],["w","B",2.42,0.25],["w","B",3.54,1],["w","B",-0.21,7.5],["w","L",0.87,1.5],["w","F",-3.12,2],["d","F",-1.12,2],["w","F",0.38,1],["w","F",3.38,1],["w","R",-1.3,1.75],["w","L",-4.38,2]],"p":[["f","piece_throne01","L0.24","F0.5",67],["f","piece_bed02","R1.09","F0.4",0],["f","piece_bed02","L0.12","P0.19",90],["f","piece_chest_wood","R0.38","P0.09",270],["f","piece_chest_wood","R0.39","P0.23",270],["f","rug_deer","L0.96","P-0.13",90],["f","rug_deer","L0.22","P-0.04",45],["m","itemstand","L0","F0.07",2.63],["m","piece_dvergr_lantern","L0","P0.21",3.09],["m","piece_dvergr_lantern","C0.31","F0",3.23],["m","piece_banner04","L0","P0.2",3.47],["m","sign","P-0.14","F0",3.54],["m","piece_banner04","L0","F0.68",3.59]],"id":"RT-0164"},{"kind":"storage","W":4,"D":4,"fill":0.75,"doorU":-0.97,"fire":null,"dens":3.33,"open":[["w","R",-1.5,1],["w","R",1.5,1]],"p":[["f","piece_chest_wood","L0.39","F0.11",180],["f","piece_chest_wood","L0.51","B0.07",0],["f","piece_chest_wood","R0.44","F0.12",180],["f","piece_chest_wood","R0.41","B0.06",0]],"stair":1,"id":"RT-0165"},{"kind":"sleeping","W":5,"D":5,"fill":0.8,"doorU":0.25,"fire":null,"dens":1.5,"open":[["w","B",3.09,0.5],["w","B",2.65,0.25],["w","B",0.55,1.25],["w","B",-2.08,0.75]],"p":[["f","ashwood_bed","R0","P-0.07",270],["f","ArmorStand","C0.32","B0.43",180],["c","rug_asksvin",0,-0.1,1.69,0,-0.02],["h","piece_brazierceiling01","C0.29","P-0.08",338,2.38]],"id":"RT-0166"},{"kind":"sleeping","W":6,"D":5.5,"fill":0.7,"doorU":-1,"fire":null,"dens":1.74,"open":[["w","L",-0.03,1.75],["w","F",-2.24,1.25],["w","B",-0.01,1.75],["w","F",2.14,1.25]],"p":[["f","ashwood_bed","L0","C-0.08",90],["f","ArmorStand","C-0.13","F0.24",0],["f","piece_chest","C-0.02","B0",180],["c","rug_asksvin",0,-0.1,1.69,0,-0.02],["h","piece_brazierceiling01","C-0.1","C-0.04",158,2.38]],"id":"RT-0167"},{"kind":"sleeping","W":5,"D":5,"fill":0.8,"doorU":0.25,"fire":null,"dens":1.5,"open":[["w","B",-1.83,1.25],["w","B",0.6,1.25],["w","B",2.72,0.25],["w","B",3.15,0.5]],"p":[["f","ashwood_bed","R0","C-0.33",270],["f","ArmorStand","P0.08","B0.41",180],["c","rug_asksvin",0,-0.1,1.69,0,-0.02],["h","piece_brazierceiling01","P0.07","P-0.08",338,2.38]],"id":"RT-0168"},{"kind":"sleeping","W":6,"D":6,"fill":0.62,"doorU":0.25,"fire":null,"dens":1.8,"open":[["w","F",2.07,0.5],["w","F",2.52,0.25],["w","R",0.03,1.75],["w","F",-2.73,0.75],["w","F",-2.21,0.25],["w","B",2.21,0.25],["w","B",2.56,0.25],["w","L",0.09,1.75],["w","B",0.03,1.75],["w","B",-2.16,0.25]],"p":[["f","ashwood_bed","C-0.06","B0",180],["f","ArmorStand","L0.52","C0.19",90],["f","piece_chest","R0.06","C0.07",270],["c","rug_asksvin",0,-0.1,1.69,0,-0.02],["h","piece_brazierceiling01","C-0.02","C0.15",248,2.38]],"id":"RT-0169"},{"kind":"smithy","W":8,"D":8.5,"fill":0.83,"doorU":-0.09,"fire":null,"dens":1.42,"open":[["w","L",1.11,6.5]],"p":[["f","piece_workbench","R0.39","B0.36",270],["f","forge","L0.32","P0.07",90],["f","piece_workbench_ext3","R0.99","P-0.2",180],["f","rug_wolf","C0","P0.1",180],["c","forge_ext1",1,1.95,0.24,180,0.04],["c","forge_ext3",1,-2.78,1.52,270,0.04],["c","forge_ext4",1,-1.65,-0.16,0,-0.01],["m","itemstand","L0","P-0.17",2.05],["m","itemstand","L0","P0.24",2.04]],"stair":1,"id":"RT-0170"},{"kind":"hall","W":6,"D":7.5,"fill":0.43,"doorU":-1.74,"fire":null,"dens":2.08,"open":[],"p":[["f","piece_throne01","C-0.28","F1.13",45],["f","piece_chair","P0.16","P-0.22",270],["f","piece_chair","P0.16","P-0.29",270],["f","piece_chair","P0.19","P0.17",157],["f","rug_wolf","R0.95","C0.14",135],["f","rug_deer","R0","P0.11",0],["c","rug_deer",0,-0.08,-0.01,225,-0.04]],"id":"RT-0171"},{"kind":"storage","W":2,"D":15,"fill":0.72,"doorU":0.49,"fire":null,"dens":3.26,"open":[["w","R",6.6,1],["w","R",4.6,1],["w","R",2.6,1],["w","R",0.6,1],["w","R",-1.4,1],["w","R",-3.4,1],["w","R",-5.4,1]],"p":[["f","piece_chest_wood","L0.24","B0.7",270],["f","piece_chest_wood","L0.15","P0.3",270],["f","piece_chest_wood","L0.18","P0.15",270],["f","piece_chest_wood","L0.14","P0.04",270],["f","piece_chest_wood","L0.21","P-0.12",270],["f","piece_chest_wood","L0.21","P-0.23",270],["f","piece_chest_wood","L0.12","F1.11",270]],"id":"RT-0172"},{"kind":"storage","W":15,"D":4.5,"fill":0.64,"doorU":1.02,"fire":null,"dens":1.84,"open":[["d","F",1.3,1.5],["w","L",1.17,1],["w","B",6.12,1],["w","F",6.12,1]],"p":[["f","piece_chest_barrel","C-0.02","B0.93",180],["f","piece_chest_barrel","P0.06","B0.96",180],["f","piece_chest_barrel","P-0.06","P0.15",180],["f","piece_chest_barrel","P-0.12","C0.26",180],["f","piece_chest_barrel","P0.32","C0.16",180],["f","piece_chest_barrel","P-0.18","C-0.17",180],["f","piece_chest_barrel","P-0.25","P-0.11",180],["f","piece_chest_barrel","P0.35","P-0.12",180]],"id":"RT-0173"},{"kind":"smithy","W":20,"D":2,"fill":0.94,"doorU":2.91,"fire":null,"dens":2.4,"open":[["d","F",2.91,2],["d","F",-3.09,2],["w","B",8.92,2],["w","B",0.92,10],["w","B",-8.08,4],["w","L",0.05,2]],"p":[["f","piece_workbench_ext3","P-0.28","B0.06",180],["f","forge_ext2","R0.47","B0.34",0],["f","forge_ext4","P0.36","B0.22",270],["f","piece_workbench_ext2","P-0.39","B0.43",180],["f","piece_workbench_ext1","L0","F0.05",180],["m","itemstand","P0.2","F0",3.89],["m","itemstand","P-0.21","F0",3.87],["h","piece_brazierceiling01","R0.83","F0.48",180,2.94],["h","piece_brazierceiling01","L0.6","B0.54",180,2.94]],"id":"RT-0175"},{"kind":"workshop","W":5.5,"D":7.5,"fill":0.61,"doorU":0.04,"fire":null,"dens":5.15,"open":[["w","B",-2.09,1.25],["w","B",2.16,1.25],["d","F",0.04,1.5],["d","R",-2.91,1.75]],"p":[["f","piece_workbench","L0.12","P-0.06",90],["f","piece_table","L0.24","B0.33",90],["f","piece_chair","P-0.21","P-0.09",292],["f","piece_chest_wood","R0","B0.15",270],["f","rug_deer","C-0.16","C0.08",180],["f","rug_deer","C-0.11","B0",180],["f","rug_deer","C-0.05","F0.02",180],["c","piece_chair02",1,0.53,0.83,180,0.09],["c","piece_chair02",1,-0.51,0.82,158,0.09],["c","itemstandh",1,0.66,0.26,270,0.82],["c","itemstandh",1,0.21,0.28,292,0.82],["c","itemstandh",1,-0.45,0.3,0,0.82],["c","itemstandh",1,-0.01,-0.27,270,0.82],["c","itemstandh",1,-0.85,0.31,0,0.82],["m","itemstand","L0","P0.17",1.07],["m","itemstand","L0","P0.2",1.07],["m","itemstand","L0","P0.2",1.07],["m","itemstand","L0","P0.23",1.07],["m","itemstand","R0","B0.4",1.94],["m","itemstand","L0","B0.56",1.97],["m","itemstand","R0","B1.07",1.97]],"id":"RT-0176"},{"kind":"storage","W":7,"D":7,"fill":0.79,"doorU":-1.53,"fire":null,"dens":1.82,"open":[["w","F",-1.47,2],["w","B",-1.47,2],["w","F",-1.54,2],["w","B",-1.54,2],["w","B",2.51,2],["w","R",-0.3,4],["w","F",2.44,2]],"p":[["f","piece_cartographytable","L0.17","P0.07",90],["f","piece_chest","R0.46","B1",0],["f","piece_chest","R0.44","P0.17",0],["f","piece_chest","R0.42","F0.45",0],["f","piece_chest","R0.43","C0.24",0],["f","piece_chest","R0.43","P-0.1",0],["f","piece_chest","R0.46","P-0.24",0]],"id":"RT-0177"},{"kind":"storage","W":2,"D":4,"fill":0.81,"doorU":2.22,"fire":null,"dens":6.15,"open":[],"p":[["f","piece_chest","R0","F0.32",180],["f","piece_chest","R0","B1.05",180],["f","piece_chest","R0","P-0.1",180],["f","piece_chest","R0","B0.17",180]],"stair":1,"id":"RT-0178"},{"kind":"storage","W":6,"D":2,"fill":0.96,"doorU":0.2,"fire":null,"dens":5.22,"open":[],"p":[["f","piece_chest","R0.13","B0.13",90],["f","piece_chest","R1.08","B0.1",90],["f","piece_chest","P0.1","B0.03",90],["f","piece_chest","C-0.32","B0.01",90],["f","piece_chest","P-0.2","B0.05",90],["f","piece_chest","L0.59","B0.07",90]],"id":"RT-0179"},{"kind":"sleeping","W":7,"D":6,"fill":0.89,"doorU":1.81,"fire":null,"dens":2.95,"open":[["w","B",2.85,1.5],["w","B",-2.64,1.5],["w","R",-1.76,2.5],["w","L",1.81,2.5],["d","F",-0.94,2],["w","F",3.05,1]],"p":[["f","piece_table","C0.06","B0.26",0],["f","ashwood_bed","R0","B0.47",180],["f","ashwood_bed","L0","B0.37",180],["f","piece_chest","L0.36","F0.19",0],["f","piece_chest","R0.25","F0.2",0],["c","piece_chair03",0,1.64,0.21,248,0.02],["c","piece_chair03",0,-1.61,0.2,158,0.02],["m","itemstand","L0.76","F0",1.76],["m","itemstand","R0.75","F0",1.79],["m","piece_banner04","L0.25","B0",2.92],["m","piece_banner01","R0.01","B0",2.92]],"id":"RT-0180"},{"kind":"sleeping","W":7,"D":6,"fill":0.76,"doorU":0.06,"fire":null,"dens":3.44,"open":[["w","F",-2.45,1],["w","F",2.8,1.5],["w","L",-2.74,0.5],["w","L",-0.24,0.5],["d","F",-0.94,2],["w","R",-2.31,0.5],["w","R",-0.06,1],["w","B",1.61,1],["w","F",-2.45,1],["w","F",2.8,1.5],["w","L",-2.49,1],["w","L",2.76,0.5],["w","B",-3.14,0.5],["w","B",3.35,0.5]],"p":[["f","ashwood_bed","L0","B0.38",180],["f","ashwood_bed","R0","B0.51",180],["f","jute_carpet_blue","C0.21","F0.93",315],["f","piece_chest","R0.25","F0.16",0],["f","piece_chest","L0.32","F0.18",0],["f","piece_chair03","P-0.2","B0.28",135],["f","piece_chair03","P0.24","B0.37",226],["c","rug_wolf",0,-0.67,1.85,180,-0.07],["c","rug_wolf",1,0.59,1.82,180,-0.07],["c","rug_deer",0,-0.88,0.02,225,-0.07],["c","rug_deer",1,0.67,-0.14,135,-0.07],["m","piece_banner02","L0.14","B0",2.87],["m","piece_banner05","R0","B0",2.9],["m","piece_banner04","R0.5","F0",2.91],["m","piece_banner05","L0.51","F0",2.91],["h","piece_brazierceiling01","C0.1","P0.09",0,4.19]],"id":"RT-0181"},{"kind":"storage","W":10.5,"D":5.5,"fill":0.51,"doorU":0.25,"fire":null,"dens":3.05,"open":[["w","B",4.6,1.5],["w","L",1.2,2],["w","B",-0.42,8]],"p":[["f","piece_chest_blackmetal","R0","C-0.19",270],["f","piece_chest_blackmetal","R0.55","F0.27",0],["f","piece_chest_blackmetal","R0","B0.08",270],["f","piece_chest_blackmetal","P0.19","F0.27",0],["f","piece_chest_blackmetal","C-0.03","F0.25",0],["f","piece_chest_blackmetal","P-0.2","F0.25",0],["f","piece_chest_blackmetal","L0.33","F0.25",0],["m","sign","L0","B0.44",1.05],["m","sign","L0","B0.44",2.39]],"id":"RT-0182"},{"kind":"storage","W":12,"D":6.5,"fill":0.5,"doorU":3.5,"fire":null,"dens":2.55,"open":[["w","B",-5.38,1],["w","B",-4.26,0.25],["w","R",0.8,2],["w","B",0.1,8],["w","L",1.73,3],["w","B",5.05,1],["d","R",1.86,3],["w","F",4.93,1.25],["w","B",4.43,0.25],["w","B",5.55,1],["w","R",-1.29,2]],"p":[["f","piece_chest_blackmetal","L0.3","P0.15",90],["f","piece_chest_blackmetal","L0.29","P-0.14",90],["f","piece_chest_blackmetal","P-0.32","F0.35",0],["f","piece_chest_blackmetal","P-0.17","F0.31",0],["f","piece_chest_blackmetal","C-0.02","F0.28",0],["f","piece_chest_blackmetal","P0.15","F0.3",0],["f","piece_chest_blackmetal","P0.31","F0.28",0],["f","piece_chest_blackmetal","R0.12","P-0.14",270],["m","sign","R0","P0.16",1.03],["m","sign","R0","P0.16",2.35]],"id":"RT-0183"},{"kind":"sleeping","W":4,"D":6,"fill":1,"doorU":-1.5,"fire":null,"dens":2.08,"open":[],"p":[["f","forge","L0.99","F0.29",180],["f","piece_workbench","L0.93","C-0.05",0],["f","piece_throne01","L0","P-0.06",90],["f","piece_bed02","L0","B0.54",270],["f","piece_stonecutter","R1.18","F1.02",180]],"id":"RT-0184"},{"kind":"sleeping","W":6,"D":4,"fill":1,"doorU":2.5,"fire":null,"dens":2.08,"open":[],"p":[["f","forge","L0","B0.22",270],["f","piece_workbench","L0.74","F0.42",270],["f","piece_throne01","R0.92","B0.2",90],["f","piece_bed02","R0.91","F0.48",270],["f","piece_stonecutter","P-0.1","B0.17",180]],"id":"RT-0185"},{"kind":"sleeping","W":10,"D":8,"fill":0.6,"doorU":1.75,"fire":null,"dens":1.26,"open":[],"p":[["f","piece_throne01","P0.04","B0.31",68],["f","piece_table_round","R1.03","P-0.11",270],["f","piece_bed02","R0.78","P0.14",270],["f","piece_groundtorch","P-0.35","C-0.27",90],["f","piece_groundtorch","P-0.04","P0.09",337],["f","piece_groundtorch","P-0.28","C0.06",90]],"id":"RT-0186"},{"kind":"workshop","W":8,"D":9,"fill":0.69,"doorU":0.9,"fire":[-3.12,-0.6],"dens":3,"open":[["w","B",-1.1,2],["w","B",2.9,2],["d","F",0.9,2]],"p":[["f","fire_pit","L0.18","P-0.07",90],["f","piece_workbench","R0","B0.78",270],["c","piece_cookingstation",0,0.07,0.13,180,0.2],["m","sign","L0","F1.09",0.89],["m","sign","L0","B0.67",0.97],["m","sign","L0","P0.15",0.99],["m","sign","R0","F0.25",1.05],["m","sign","L0","B0.65",2.26],["m","sign","L0","P0.15",2.27],["m","sign","L0","F0.99",2.28],["m","sign","R0","P-0.09",2.3],["m","sign","R0","F0.25",2.68],["m","itemstand","P0.11","B0",2.91],["m","itemstand","P0.12","F0",3.41],["m","itemstand","P0.12","B0",3.91]],"id":"RT-0187"},{"kind":"storage","W":12.5,"D":2.5,"fill":0.71,"doorU":-2.75,"fire":null,"dens":4.94,"open":[],"p":[["f","piece_chest","R0.32","B0",270],["f","piece_chest","R1.09","B0",90],["f","piece_chest","P0.3","B0",270],["f","piece_chest","P0.23","B0",90],["f","piece_chest","P0.15","B0",270],["f","piece_chest","P0.07","B0",90],["f","piece_chest","C-0.14","B0",270],["f","piece_chest","P-0.09","B0",90],["f","piece_chest","P-0.17","B0",270],["f","piece_chest","P-0.25","B0",90],["f","piece_chest","L0.95","B0",0]],"id":"RT-0188"},{"kind":"storage","W":12,"D":2,"fill":0.79,"doorU":-5,"fire":null,"dens":6.32,"open":[["w","R",0.16,1.5],["w","F",5.06,2],["w","B",-6.38,1.25]],"p":[["f","piece_chest","L0.5","B0",0],["f","piece_chest","R0.21","B0.02",270],["f","piece_chest","R1.14","B0",90],["f","piece_chest","P0.29","B0",270],["f","piece_chest","P0.21","B0",90],["f","piece_chest","P0.12","B0",270],["f","piece_chest","P0.04","B0.01",90],["f","piece_chest","P-0.04","B0",270],["f","piece_chest","P-0.12","B0",90],["f","piece_chest","P-0.2","B0",270],["f","piece_chest","P-0.28","B0",90],["m","piece_dvergr_lantern","L0","B0",1.69]],"id":"RT-0189"},{"kind":"storage","W":7,"D":14.5,"fill":0.27,"doorU":2.37,"fire":null,"dens":1.48,"open":[],"p":[["f","piece_chest","C0.14","F1.15",270],["f","piece_chest","P-0.12","F1.15",270],["f","piece_chest","P-0.27","F1.15",270],["f","piece_chest","L0.24","F1.15",270]],"id":"RT-0190"},{"kind":"sleeping","W":8,"D":8,"fill":0.94,"doorU":1.03,"fire":null,"dens":2.5,"open":[["d","F",1.03,2]],"p":[["f","piece_throne01","L0.93","B0.62",135],["f","piece_bed02","P-0.22","F0.32",0],["f","piece_chest_wood","R0.35","B0.29",180],["f","piece_chest_wood","R0.42","B1.06",180],["f","piece_chest_wood","R0.19","P0.18",180],["f","piece_chair","P-0.12","B0.51",281],["f","piece_chest_wood","R0.14","P0.08",180],["f","piece_chest_wood","R0.33","P-0.08",180],["f","piece_chest","P-0.2","C0.3",0],["f","piece_chest_wood","R0.39","P-0.18",180],["f","rug_fur","P0.08","B1.1",326],["m","piece_banner01","R0","B0.5",3.14],["m","piece_walltorch","C0.04","B0",2.22],["m","piece_banner01","R0","P-0.1",3.17],["m","piece_banner02","R0","F0.63",3.39],["m","piece_walltorch","P-0.22","F0",1.96]],"id":"RT-0191"},{"kind":"storage","W":2,"D":8,"fill":1,"doorU":-2.03,"fire":null,"dens":5,"open":[["w","R",0,8],["w","B",-0.03,2]],"p":[["f","piece_chest_wood","L0.28","F0.3",180],["f","piece_chest_wood","L0.35","F1.09",180],["f","piece_chest_wood","L0.28","P-0.18",180],["f","piece_chest_wood","L0.31","P-0.08",180],["f","piece_chest_wood","L0.31","P0.08",180],["f","piece_chest_wood","L0.31","P0.18",180],["f","piece_chest_wood","L0.18","B1.08",180],["f","piece_chest_wood","L0.32","B0.26",180]],"stair":1,"id":"RT-0192"},{"kind":"other","W":4,"D":4,"fill":0.38,"doorU":0.5,"fire":null,"dens":5,"open":[["w","B",0.47,3],["w","L",1.37,1.25],["w","L",-1.28,1.25]],"p":[["f","piece_chest","L0.25","F0.33",90],["f","piece_chair02","R0.2","B0.15",248],["m","itemstand","L0.85","B0",0.7]],"id":"RT-0193"},{"kind":"smithy","W":4.5,"D":9.5,"fill":0.82,"doorU":-0.33,"fire":null,"dens":2.29,"open":[["w","F",-1.5,1.5],["w","F",0.1,2.5],["w","F",1.66,2],["w","F",2.23,1],["w","L",-2.75,3],["w","L",2.25,3],["w","R",-2.34,2],["w","R",-1.49,1],["w","R",0.03,2.5],["w","R",1.89,2],["w","R",2.68,1],["w","B",1.66,2],["w","B",0.98,1],["w","B",-0.13,2],["w","B",-0.98,1],["w","B",-1.75,1]],"p":[["f","forge","R0.67","B0.99",225],["f","piece_workbench","R0","C-0.21",270],["f","rug_fur","L0","F0.61",225],["f","rug_fur","L0","P-0.04",0],["f","rug_fur","R0.46","C-0.24",180],["f","rug_fur","L0","B0.89",135],["c","forge_ext4",0,-1.37,0.02,0,-0.01],["c","forge_ext1",0,1.58,0.38,158,0.04],["m","piece_walltorch","R0","P0.25",2.79],["m","piece_walltorch","L0.84","F0",2.83],["m","piece_walltorch","L0.83","B0",2.88],["m","piece_walltorch","R0","P-0.29",2.93]],"id":"RT-0194"},{"kind":"sleeping","W":20,"D":8,"fill":0.84,"doorU":-4,"fire":null,"dens":1.42,"open":[["w","B",8.5,3],["w","B",4,2],["w","B",-4,2],["w","B",-8.25,2.5]],"p":[["f","piece_cartographytable","C-0.12","B0.42",180],["f","piece_table","L0.86","B0.46",180],["f","piece_table_round","P0.2","B0.45",0],["f","piece_bed02","L0.43","C0.03",90],["f","rug_fur","P-0.2","C0.1",0],["f","rug_fur","P-0.35","F0.92",90],["f","rug_wolf","P-0.21","F0.76",90],["f","rug_wolf","P-0.2","B0.41",90],["f","piece_chest","P-0.27","C0.06",90],["f","ArmorStand","P0.3","B0.39",180],["f","ArmorStand","P-0.29","B0.44",180],["c","rug_fur",1,-0.95,1.04,270,0.02],["c","rug_wolf",0,0.04,0.99,270,0.02],["c","treasure_stack",1,-0.37,-0.32,293,0.8],["c","treasure_stack",1,0.06,-0.32,293,0.8],["c","treasure_stack",1,-0.82,-0.28,293,0.8],["c","treasure_stack",1,0.24,0.08,293,0.8],["c","itemstandh",2,-0.04,0.57,0,0.8],["c","itemstandh",2,0.68,0.18,0,0.8],["c","itemstandh",2,-0.66,0.15,0,0.8],["c","itemstandh",2,0.05,0.09,0,0.8],["c","itemstandh",2,0.18,-0.35,90,0.8],["c","itemstandh",2,0.64,-0.43,0,0.8],["c","itemstandh",2,-0.43,-0.51,0,0.8],["c","itemstandh",2,0.24,-0.77,0,0.8],["m","piece_walltorch","P0.2","F0",2.33],["m","piece_walltorch","R0","B1.01",2.42],["m","piece_walltorch","P-0.3","B0",2.42],["m","piece_walltorch","P0.3","B0",2.44],["m","piece_walltorch","R0","B0.3",2.44],["m","piece_walltorch","P-0.21","F0",2.47],["m","piece_walltorch","P-0.4","F0",2.48],["m","piece_banner03","P-0.1","B0",3.94],["m","piece_banner03","P0.1","B0",3.94],["m","piece_banner03","P0.3","F0",3.98],["m","piece_banner03","P-0.3","F0",3.99],["m","itemstand","L0","C0.05",4.02]],"id":"RT-0195"},{"kind":"smithy","W":6,"D":6,"fill":0.69,"doorU":2,"fire":null,"dens":2.4,"open":[],"p":[["f","forge","L0","P-0.1",90],["f","piece_chair","R0.11","B0.16",45],["f","rug_fur","L0.93","F0.46",293],["f","piece_chair02","P-0.12","P0.06",180],["m","itemstand","R0.72","B0",2.15],["m","itemstand","P-0.2","F0",2.52],["m","piece_banner01","P-0.15","B0",3.91]],"id":"RT-0196"},{"kind":"workshop","W":10,"D":10,"fill":0.61,"doorU":4.25,"fire":null,"dens":2.95,"open":[["w","F",0.25,3.5],["w","F",3,1],["w","B",3.5,3],["w","R",2.24,1.5],["w","L",-4.3,1.5],["w","R",-4.3,1.5],["w","L",-3.8,0.5],["w","L",-4.8,0.5],["w","R",-4.3,1.5],["w","F",0,2]],"p":[["f","piece_table","P-0.16","C-0.34",270],["f","piece_artisanstation","L0.17","P-0.14",90],["f","jute_carpet","P0.07","F0.1",0],["m","itemstand","P0.04","F0",0.63],["m","itemstand","C-0.24","B0",0.67],["m","itemstand","P-0.08","B0",0.7],["m","itemstand","P-0.05","B0",0.7],["m","itemstand","P0.09","B0",0.73],["c","itemstandh",0,-0.03,0.25,270,0.82],["c","itemstandh",0,-0.65,0.11,270,0.82],["c","itemstandh",0,0.67,-0.09,337,0.82],["c","itemstandh",0,0.02,-0.17,270,0.82],["m","itemstand","P0.22","B0",0.81],["m","itemstand","P0.15","B0",0.93],["m","wood_dragon1","L0","F0.7",2.4],["m","wood_dragon1","P0.24","F0",2.4],["m","darkwood_wolf","C0.03","B0",2.49],["m","sign","R0.15","B0",2.5],["m","itemstand","P0.25","F0",2.56],["m","itemstand","P-0.05","F0",2.58],["m","sign","R1.15","B0",2.6],["m","itemstand","P0.11","F0",3.06],["m","piece_banner01","L0","B0",3.98]],"id":"RT-0197"},{"kind":"home","W":10,"D":13,"fill":0.64,"doorU":3.66,"fire":null,"dens":1.2,"open":[["w","F",2.13,2],["w","B",2.13,2],["w","B",2.51,3.5]],"p":[["f","piece_table","L1.12","B0.24",90],["f","piece_table","L1.12","P0.23",90],["f","piece_bed02","P0.2","F0.11",0],["f","rug_wolf","C-0.02","P0.14",0],["f","rug_fur","R0.77","P0.29",90],["f","piece_chest","R1.02","F0.39",270],["f","piece_chair02","C-0.06","F0.16",45],["f","piece_bench01","P0.23","C-0.18",180],["f","piece_chest_wood","R0.74","P0.31",270],["c","jute_carpet_blue",2,-1.51,0.13,180,-0.05],["c","rug_deer",2,-0.17,2.17,270,-0.05],["c","piece_chest",2,-0.14,1.98,0,0.01],["m","piece_dvergr_lantern","C0.01","F0",3.59],["m","piece_dvergr_lantern","C0.01","B0",3.59]],"id":"RT-0198"},{"kind":"sleeping","W":13.5,"D":13.5,"fill":0.56,"doorU":0.89,"fire":null,"dens":1.27,"open":[["w","B",-4.83,3],["d","F",0.89,2]],"p":[["f","piece_table_round","P-0.28","P0.28",101],["f","piece_bed02","L0","P-0.14",90],["f","piece_bed02","P0.13","B0",180],["f","rug_fur","L0","P0.04",90],["f","rug_fur","P-0.04","B0",180],["f","rug_fur","L0","P-0.31",90],["f","rug_wolf","P-0.24","P-0.14",0],["f","rug_wolf","P0.13","P0.22",101],["f","rug_fur","P0.3","B0.14",180],["f","ArmorStand","P0.15","P0.09",315],["f","ArmorStand","P-0.08","P-0.16",315],["f","piece_chest","L0.2","P0.12",180],["f","piece_chest","P-0.11","B0.43",90],["f","piece_chest","P0.37","B0.17",270],["c","piece_chair03",0,1.71,-0.21,282,-0.01],["c","piece_chair03",0,-0.65,1.48,158,-0.01],["m","piece_dvergr_lantern","L0.61","B0",2.35],["m","piece_banner03","P-0.15","F0",3.81],["m","piece_banner03","P0.26","F0",3.81]],"id":"RT-0199"},{"kind":"other","W":8,"D":6,"fill":0.65,"doorU":-3.07,"fire":null,"dens":1.6,"open":[["w","R",-1.56,2.75],["w","F",0.93,2],["w","F",0.93,2],["w","F",-1.32,1.5],["w","F",-3.32,1.5]],"p":[["f","rug_fur","P0.06","F0.83",90],["f","piece_chest","R0.38","F0.91",270],["f","ArmorStand","R0.51","C0.12",270],["m","piece_walltorch","L0.77","F0",1.73],["m","itemstand","L0.6","F0",1.91],["m","darkwood_raven","L0","F0",3.19]],"id":"RT-0200"},{"kind":"kitchen","W":10.5,"D":11.5,"fill":0.65,"doorU":-0.28,"fire":null,"dens":2.15,"open":[["w","F",-2.53,2],["w","B",3.47,2],["w","L",-1.03,1.5],["w","L",3.1,1.75],["w","F",-0.49,1.75],["w","F",4.12,2]],"p":[["f","piece_table","L0.23","B1.13",270],["f","piece_table_oak","P-0.05","B0.33",0],["f","piece_chest_wood","L0","P-0.14",0],["f","piece_chest_wood","L0","P-0.05",0],["f","jute_carpet","P0.16","P-0.04",180],["f","rug_hare","P-0.23","P-0.3",270],["f","jute_carpet","P0.29","P0.2",180],["f","jute_carpet","P-0.19","P-0.04",0],["f","jute_carpet","P-0.07","P0.21",180],["f","jute_carpet","P0.09","F0.96",270],["f","piece_oven","L0.49","P0.08",0],["c","piece_chair03",1,-2.45,-1.12,45,-0.11],["c","jute_carpet",0,-0.84,-0.76,180,0.02],["c","piece_chair03",1,0.13,-1.29,45,-0.09],["c","piece_chair03",1,1.52,-0.99,338,-0.09],["c","piece_chair03",1,-1.33,-1.14,0,-0.09],["c","itemstandh",1,2.12,0.01,0,0.79],["c","itemstandh",1,1.5,-0.47,248,0.79],["c","itemstandh",1,1.94,0.6,338,0.79],["c","itemstandh",1,0.84,-0.45,158,0.79],["c","itemstandh",1,1.26,0.07,112,0.79],["c","itemstandh",1,1.52,0.32,270,0.79],["c","itemstandh",1,0.13,-0.65,248,0.79],["c","itemstandh",1,0.85,0.14,0,0.79],["c","itemstandh",1,0.39,-0.05,0,0.79],["c","itemstandh",1,-0.6,-0.67,315,0.79],["c","itemstandh",1,0.47,0.59,180,0.79],["c","itemstandh",1,-0.25,-0.05,113,0.79],["c","itemstandh",1,0.02,0.3,158,0.79],["c","itemstandh",1,-0.79,-0.3,0,0.79],["c","itemstandh",1,-1.35,-0.58,270,0.79],["c","itemstandh",1,-1.06,-0.03,225,0.79],["c","itemstandh",1,-2.04,-0.63,292,0.79],["c","itemstandh",1,-0.96,0.57,247,0.79],["c","itemstandh",1,-1.47,0.17,0,0.79],["c","itemstandh",1,-1.89,-0.16,270,0.79],["c","itemstandh",1,-1.91,0.6,0,0.79],["m","itemstand","R0","F0",1.74],["m","piece_banner01","R0.49","F0",2.82],["m","itemstand","P-0.05","B0",3],["m","itemstand","P-0.05","F0",3.09],["m","piece_dvergr_lantern","R0","F0.55",3.33],["m","itemstand","P-0.24","B0",3.47],["m","itemstand","P0.14","B0",3.49],["m","piece_banner01","L0.62","F0",3.72]],"id":"RT-0201"},{"kind":"other","W":7.5,"D":5.5,"fill":0.75,"doorU":1.25,"fire":null,"dens":1.63,"open":[["w","B",-2.97,1.5],["w","B",0.03,3.5],["w","B",3.03,1.5],["w","R",1.85,1.75],["w","L",-0.03,5.5],["w","F",-0.85,1.75],["w","F",-2.97,1.5],["w","B",-1.1,1.25],["w","B",-2.35,0.25],["w","F",-2.85,1.25],["w","F",-1.6,0.25]],"p":[["f","piece_chest_blackmetal","L0","B0",180],["f","piece_chest_blackmetal","L0","F0",0],["f","jute_carpet","L0.94","B0",0],["f","jute_carpet","P0.05","B0.43",90],["f","jute_carpet","L0.89","F0",0],["f","piece_chair03","P-0.2","B0",157],["m","wood_dragon1","R0","B0.5",2.9],["m","wood_dragon1","R0","F0.5",2.9]],"id":"RT-0202"},{"kind":"home","W":6,"D":6,"fill":0.49,"doorU":-0.54,"fire":[-1.93,-2.2],"dens":2.82,"open":[["w","R",1.5,1],["d","B",-0.85,1.5],["w","F",-0.4,1.5]],"p":[["f","bed","R0.22","C-0.32",270],["f","fire_pit","L0.37","F0.1",0],["f","piece_chair02","P0.16","B1.15",236],["c","rug_wolf",0,1.15,-0.4,0,-0.02],["c","piece_cookingstation",1,0.12,0.66,180,0.2],["c","piece_cookingstation",1,0.11,0.19,180,0.2]],"id":"RT-0204"},{"kind":"storage","W":15,"D":7,"fill":0.98,"doorU":-2,"fire":null,"dens":2.03,"open":[["d","B",6.29,1.5],["w","B",-0.4,12],["w","R",0.51,6],["w","L",-2.41,2],["w","F",-5.43,4],["d","F",-2,2]],"p":[["f","piece_chest","P0.07","B0.18",90],["f","piece_chest","C0.21","B0.19",90],["f","piece_chest","P-0.04","B0.17",90],["f","piece_chest","P0.13","B0.19",90],["f","piece_chest","P0.2","B0.21",90],["f","piece_chest","P0.26","B0.2",90],["f","piece_chest","P0.32","B0.2",90],["f","piece_chest","L0.52","B0.29",90],["f","piece_chest","L0.54","P0.11",90],["f","piece_chest","L0.5","P-0.13",90],["f","piece_chest_wood","C0.11","F0.35",90],["f","piece_chest_wood","P0.06","F0.32",90],["f","piece_chest_wood","P0.1","F0.3",90],["f","piece_chest_wood","P0.15","F0.32",90],["f","piece_chest_wood","P0.19","F0.35",90],["f","piece_chest_wood","P0.24","F0.37",90],["f","piece_chest_wood","P0.28","F0.36",90],["f","piece_chest_wood","P0.33","F0.41",90],["f","piece_chest_wood","P0.37","F0.43",90],["f","piece_chest_wood","R0.92","F0.41",90],["f","piece_chest_wood","R0.28","F0.4",90]],"id":"RT-0205"},{"kind":"storage","W":8,"D":2,"fill":0.98,"doorU":-1.25,"fire":null,"dens":1.9,"open":[],"p":[["f","piece_chest_blackmetal","C0.03","F0.38",180],["f","piece_chest_blackmetal","L0.74","F0.35",180],["f","piece_chest_blackmetal","R0.71","F0.47",180]],"id":"RT-0206"},{"kind":"sleeping","W":15,"D":12,"fill":0.5,"doorU":1.5,"fire":null,"dens":1.44,"open":[["w","F",-4.75,1.5],["w","B",3.45,1],["w","B",-1.05,2],["w","B",-5.25,1.5],["w","B",0.22,1.5],["w","B",-2.28,1.5],["w","F",0.22,1.5],["w","F",7.15,2],["w","B",7.15,2],["w","R",0.97,2]],"p":[["f","piece_table","P0.04","P-0.31",0],["f","piece_bed02","P-0.31","P0.17",180],["f","rug_deer","P-0.21","P-0.04",135],["f","fermenter","P0.37","P-0.06",180],["f","ArmorStand","L0.61","P-0.06",67],["c","piece_chair",0,0.95,0.89,203,-0.07],["c","piece_chair",0,-0.53,0.91,180,-0.05],["c","rug_fur",0,0.78,0.2,90,-0.03],["c","rug_fur",0,-0.81,-0.21,0,0],["c","itemstandh",0,-0.79,0.3,0,0.82],["c","itemstandh",0,-0.1,-0.07,0,0.82],["c","itemstandh",0,0.5,0.35,337,0.82],["m","piece_walltorch","P-0.32","F0",1.39],["m","itemstand","L0","P0.25",2.43],["m","itemstand","L0","P-0.08",2.46],["m","piece_dvergr_lantern","P-0.03","B0",3.09],["m","piece_dvergr_lantern","L0","C-0.03",3.59],["m","piece_dvergr_lantern","L0","P0.17",3.59],["m","piece_dvergr_lantern","R0","C-0.03",3.59]],"id":"RT-0207"},{"kind":"storage","W":6.5,"D":6,"fill":0.45,"doorU":2.16,"fire":null,"dens":4.57,"open":[["w","F",3.22,1],["d","F",2.06,1.75],["w","F",1.17,0.75]],"p":[["f","piece_chest_wood","L0.6","C-0.22",46],["f","piece_chest_wood","L0.17","B1.18",135],["f","piece_chest_wood","P-0.12","F0.87",46],["f","piece_chest_wood","P0.06","F0",46],["f","piece_chest_wood","P-0.17","B0",135],["f","piece_chest_wood","C0.2","B0.5",225],["f","piece_chest_wood","P0.2","P0.1",225],["f","piece_chest_wood","R0.11","P-0.09",225]],"id":"RT-0208"},{"kind":"storage","W":4,"D":5.5,"fill":0.95,"doorU":-0.07,"fire":null,"dens":3.81,"open":[["w","F",-1.57,1],["d","F",-0.07,2],["w","F",1.43,1]],"p":[["f","piece_chest_wood","R0.51","B0",180],["f","piece_chest_wood","R0.25","B0.89",270],["f","piece_chest_wood","L0.44","B0",180],["f","piece_chest_wood","R0.29","P-0.07",270],["f","piece_chest_wood","L0.09","B0.8",90],["f","piece_chest_wood","R0.32","F0.1",270],["f","piece_chest_wood","L0.06","C-0.34",90],["f","piece_chest_wood","L0.04","F0.09",90]],"id":"RT-0209"},{"kind":"home","W":12,"D":12,"fill":0.86,"doorU":1.04,"fire":[-4.46,1.95],"dens":2.02,"open":[["w","L",2.45,7],["w","F",-3.96,4],["w","B",0.04,12],["w","L",-4.05,2],["w","F",-0.96,2],["w","F",5.04,2],["w","R",0.45,11],["d","F",2.04,4]],"p":[["f","forge","R0.22","P-0.32",270],["f","piece_workbench","P-0.06","P-0.32",90],["f","hearth","L0.54","P0.16",90],["f","piece_table_round","P0.17","P0.07",0],["f","piece_bed02","P0.17","B0.43",180],["f","rug_fur","P-0.12","P0.16",180],["f","rug_fur","P0.08","F0.54",0],["f","rug_fur","P0.29","F0.51",0],["f","forge_ext5","R0.32","P-0.03",90],["f","fermenter","P-0.07","B0.29",180],["f","piece_chest","R0.28","P0.25",270],["f","piece_chest","R0.26","B0.47",270],["f","piece_chest","R0.21","P0.1",270],["c","piece_chair03",3,-0.01,-1.17,0,-0.03],["c","rug_fur",3,0.12,0.24,270,-0.03],["c","forge_ext1",0,1.34,-0.05,180,0.04],["c","piece_chair03",3,-1.28,0.12,90,-0.01],["c","piece_chair03",3,1.39,0.09,270,-0.01],["c","piece_workbench_ext2",1,0.12,-0.88,0,0.05],["c","forge_ext2",0,2.33,0.33,270,0.16],["c","piece_cookingstation_iron",2,0.07,-0.49,180,0.58],["c","piece_cookingstation_iron",2,0.08,-0.05,180,0.58],["c","piece_cauldron",2,-0.91,0.75,203,0.58],["m","piece_walltorch","P-0.07","F0",2.83],["m","piece_walltorch","C0.1","B0",2.93],["m","piece_walltorch","P-0.16","F0",3],["m","piece_walltorch","R0","P-0.17",3.05],["m","piece_walltorch","P0.33","B0",3.1],["m","piece_walltorch","R0","P0.15",3.1]],"id":"RT-0210"},{"kind":"other","W":7,"D":8,"fill":0.69,"doorU":1.51,"fire":null,"dens":1.56,"open":[["w","F",1.51,3.75],["w","B",3.14,2],["w","F",3.11,2],["w","R",2.8,2]],"p":[["f","rug_fur","R1.04","F0.08",90],["f","rug_fur","L0.04","F0.3",22],["f","rug_deer","L1.14","C0.3",292],["f","rug_wolf","P0.1","B0.91",292],["f","ArmorStand","R0.6","B0.52",224],["f","piece_chest","L0.81","F0.32",90],["m","itemstand","R0","B0.93",3.11],["m","piece_banner03","L0","F0.41",3.57],["m","piece_banner03","L0","P-0.15",3.57],["m","piece_banner05","R0","B0.73",3.73]],"id":"RT-0211"},{"kind":"home","W":10.5,"D":11,"fill":0.71,"doorU":1.1,"fire":null,"dens":2.67,"open":[["w","F",-4.96,0.5],["w","R",4,1.5],["w","L",0.31,1.75],["w","B",2.98,1.5],["w","B",-0.14,3.25]],"p":[["f","piece_throne01","L0.46","P0.09",90],["f","piece_bed02","P-0.07","B0.62",180],["f","piece_bench01","P-0.21","F1.19",22],["f","piece_chair03","P-0.31","B0.01",157],["f","piece_chair03","R1.08","B0.02",202],["f","rug_wolf","L1.07","P-0.2",45],["f","rug_fur","C0.29","P-0.19",134],["f","rug_fur","C-0.22","P0.05",112],["f","jute_carpet","R0.88","P-0.05",157],["f","rug_deer","P0.23","P0.08",337],["f","rug_fur","R0","F0.52",112],["f","rug_deer","P-0.24","P-0.14",90],["f","piece_chest","P-0.06","C-0.12",0],["f","ArmorStand","P-0.17","C0.03",44],["f","rug_fur","C0.23","F0",134],["f","jute_carpet","P0.14","F0",202],["m","itemstand","R0","P0.26",0.94],["m","itemstand","R0","P0.18",0.94],["m","itemstand","R0","P0.3",0.94],["m","itemstand","R0","P0.22",0.94],["m","sign","L0","P0.3",2.17],["m","itemstand","R0.43","B0",2.33],["m","itemstand","L0","P0.11",2.74],["m","itemstand","P0.19","B0",2.87],["m","piece_banner05","L0.08","F0",3.5],["m","piece_banner03","P-0.32","F0",3.57],["m","piece_banner04","P-0.26","F0",3.57],["m","piece_banner05","P-0.07","B0",3.57],["m","itemstand","R0","P0.13",3.61],["m","piece_banner02","R0","P0.25",3.67],["m","piece_banner02","R0","B0.86",3.67]],"id":"RT-0212"},{"kind":"living","W":4,"D":10,"fill":0.85,"doorU":-1.02,"fire":null,"dens":1.76,"open":[["w","B",-0.1,4],["w","B",-2.27,1.5],["w","B",-2.27,1.5]],"p":[["f","piece_table_round","L0.68","P0.23",270],["f","rug_asksvin","R0","P0.08",112],["c","piece_chair03",0,0,-1.62,0,-0.01],["c","piece_chair03",0,1.03,-1.11,315,-0.01],["c","piece_chair03",0,-1.07,-1.11,44,-0.01],["c","piece_chair03",0,1.54,0.07,270,-0.01],["c","piece_chair03",0,-1.53,0.01,90,-0.01],["c","rug_asksvin",0,1.2,-0.84,90,0],["c","rug_fur",0,-0.47,-0.26,225,0],["c","rug_asksvin",0,1.02,0.91,22,0],["c","rug_asksvin",0,-1.25,0.89,314,0],["c","itemstandh",0,0.68,-0.82,315,0.8],["c","itemstandh",0,0.87,-0.58,315,0.8],["c","itemstandh",0,-0.53,-0.88,44,0.8],["c","itemstandh",0,0.37,-0.41,0,0.8],["c","itemstandh",0,-0.82,-0.75,44,0.8],["c","itemstandh",0,0.65,-0.03,337,0.8],["c","itemstandh",0,0.61,0.45,0,0.8],["c","itemstandh",0,-0.68,-0.07,44,0.8],["c","itemstandh",0,0.11,0.42,337,0.8],["c","itemstandh",0,-0.36,0.37,22,0.8],["c","itemstandh",0,0.45,0.84,22,0.8],["c","itemstandh",0,-0.83,0.57,0,0.8],["c","itemstandh",0,-0.38,0.85,337,0.8]],"stair":1,"id":"RT-0213"},{"kind":"smithy","W":14,"D":18,"fill":0.7,"doorU":-2.25,"fire":null,"dens":1.48,"open":[["d","B",-3,4],["d","R",-1,4],["d","F",-3,4]],"p":[["f","forge","P0.16","P0.31",180],["f","piece_workbench","P0.24","F1.08",0],["f","piece_oven","P-0.25","P0.11",0],["f","piece_preptable","P0.08","P-0.09",90],["f","forge_ext5","P-0.03","B0.23",180],["f","fermenter","L0.59","B0.41",90],["f","piece_chest","L1.13","P0.33",90],["f","piece_chest","P-0.28","P0.25",180],["f","piece_chest","R0.38","P0.24",0],["f","piece_chest","R0.38","P0.19",0],["f","piece_chest","R0.38","P0.08",0],["f","piece_chest","R0.43","P-0.3",0],["f","piece_chest","P-0.28","P0.2",180],["f","piece_chest","R0.39","P0.14",0],["f","piece_chest","R0.42","P-0.2",0],["f","piece_chest","P-0.31","P-0.23",90],["f","piece_chest","R0.43","P-0.25",0],["f","piece_chest","R0.42","P-0.35",0],["c","forge_ext4",0,1.68,0.13,0,-0.01],["c","forge_ext3",0,-1.14,1.63,0,0.03],["c","forge_ext1",0,-1.86,-0.24,0,0.04],["m","sign","R0","P0.22",1.27],["m","sign","R0","P-0.23",1.28],["m","sign","R0","P0.11",1.32],["m","sign","R0","P-0.33",1.39],["m","sign","L0","P0.22",1.67]],"id":"RT-0215"},{"kind":"home","W":14,"D":8,"fill":0.89,"doorU":-1,"fire":null,"dens":1.6,"open":[["w","L",3,2],["w","L",-3,2],["w","F",4.25,1.5],["d","F",-1,4],["w","F",-6.25,1.5],["w","R",-3,2],["w","F",6,2],["w","R",0,4],["w","B",-1,4]],"p":[["f","piece_cartographytable","R0.62","C0.07",90],["f","piece_throne01","P-0.28","F0.28",0],["f","piece_table_round","P0.25","F0.38",203],["f","piece_bed02","P-0.14","B0.36",180],["f","piece_bed02","P0.1","B0.37",180],["f","rug_wolf","P-0.12","F0.98",0],["f","rug_deer","P0.06","F0.98",0],["f","piece_chest","L0.54","P-0.07",180],["f","piece_chest","L0.55","P0.18",180],["f","piece_chest","L0.55","P0.07",180],["f","piece_chest","L0.56","B0.24",180],["f","piece_chest","L0.54","P-0.17",180],["f","piece_chest","L0.56","B1.08",180],["f","piece_chest_barrel","L1.16","F0.7",90],["f","piece_chest_barrel","C-0.33","B0.28",180],["c","piece_chair03",2,0.6,1.37,202,-0.01],["c","piece_bench01",2,1.53,0.84,269,0.04],["m","sign","L0.5","B0",0.67],["c","itemstandh",2,-0.75,0.06,247,0.8],["c","Candle_resin",2,0.32,-0.89,337,0.82]],"id":"RT-0216"},{"kind":"sleeping","W":14.5,"D":13.5,"fill":0.58,"doorU":2.07,"fire":null,"dens":2.11,"open":[["d","R",-0.78,2],["d","R",1.22,2],["w","B",2.07,9.5],["w","F",7.2,0.25],["w","R",-2.78,2],["w","R",2.72,1],["w","L",-3.27,0.75],["w","F",-2.3,0.75],["w","B",-2.3,0.75],["w","F",-1.51,1],["w","B",-1.34,0.5],["w","F",-2.93,1],["w","B",-2.93,1],["w","L",-4.98,1.25],["w","L",-3.23,1.25],["w","L",-0.28,1],["w","B",-6.93,3],["d","F",2.07,2]],"p":[["f","bed","R0.24","P-0.22",270],["f","bed","R0.4","P0.26",270],["f","bed","R0.47","B0.15",270],["f","bed","P-0.1","C-0.08",90],["f","bed","P-0.11","P0.25",90],["f","bed","P-0.08","B0.03",90],["c","piece_chest_wood",0,-0.03,1.84,0,-0.02],["c","piece_chest_wood",1,0.11,1.85,0,-0.02],["c","piece_chest_wood",4,-0.03,1.69,180,-0.02],["m","itemstand","P-0.15","F0",1],["m","itemstand","P-0.16","B0",1.09],["m","itemstand","P-0.17","B0",1.1],["m","itemstand","R0.76","F0",1.23],["m","itemstand","R0.56","F0",1.24],["m","sign","L0","B0.15",1.28],["m","sign","R0","B0.33",1.33],["m","itemstand","R0.46","B0",1.46],["m","sign","L0","C0.03",1.57],["m","sign","R0","P0.26",1.65],["m","sign","L0","P0.27",1.65],["m","sign","R0","P-0.2",1.7],["m","piece_walltorch","P0.18","F0",2.82],["m","piece_walltorch","P0.17","B0",2.98],["m","piece_banner01","L0","P0.13",3.15]],"id":"RT-0217"},{"kind":"other","W":8,"D":7.5,"fill":0.87,"doorU":0.47,"fire":null,"dens":0.96,"open":[["w","F",3.47,1],["w","F",-0.53,5],["w","L",-0.07,6],["w","F",-1.53,1],["w","R",-2.07,2],["w","B",-3.28,1.5],["w","B",2.72,0.5],["w","B",-0.03,6]],"p":[["f","piece_cartographytable","R0.59","F1.17",270],["f","piece_chest_blackmetal","L0.66","B0.15",0],["f","piece_chest_wood","P0.2","B0.08",180],["f","rug_hare","C0.01","B0.67",270],["h","piece_brazierceiling01","R0.17","C0",180,3.61],["h","piece_brazierceiling01","L0.38","C-0.17",180,3.78]],"id":"RT-0218"},{"kind":"sleeping","W":7,"D":8.5,"fill":0.47,"doorU":-2.5,"fire":null,"dens":1.44,"open":[["w","R",1.22,6],["w","B",-3.89,1]],"p":[["f","piece_bed02","P0.17","B0",180],["c","piece_chest_wood",0,0.18,2.09,0,-0.05],["m","sign","P0.23","B0",2.18],["m","piece_walltorch","P0.11","F0",2.22]],"id":"RT-0219"},{"kind":"storage","W":6,"D":4,"fill":0.4,"doorU":2.47,"fire":null,"dens":8.42,"open":[["w","F",2.95,1],["w","F",0.95,1],["w","F",-1.05,1],["w","F",-0.11,6],["w","B",3.57,0.75],["w","R",-0.1,2],["w","B",3.66,1]],"p":[["f","piece_chest_blackmetal","R0.07","B0.23",270],["f","piece_chest_blackmetal","C-0.24","F0.01",0],["f","piece_chest_blackmetal","L0.11","F0.04",0],["m","itemstand","R0","B0",2.14],["m","itemstand","R0","F0",2.42],["m","itemstand","P-0.18","F0",2.43],["m","itemstand","P0.15","F0",2.43],["m","itemstand","L0","F0",2.43]],"id":"RT-0220"},{"kind":"hall","W":8,"D":11.5,"fill":0.6,"doorU":-2.81,"fire":[-0.15,5.2],"dens":1.44,"open":[["d","F",-0.1,4],["w","F",3,2],["w","B",3,2],["w","F",3,2],["w","B",3,2]],"p":[["f","hearth","C-0.15","B0",0],["f","piece_chest_wood","R0.51","P-0.16",0],["f","piece_chest_wood","R0.49","P-0.08",0],["c","piece_cookingstation",0,1.19,0,270,0.58],["c","piece_cookingstation",0,0.71,0.03,270,0.58],["c","piece_cookingstation",0,0.21,0.11,270,0.58],["c","piece_cauldron",0,-1.12,-0.39,11,0.58],["c","piece_cookingstation_iron",0,-0.01,0.67,0,0.58]],"id":"RT-0221"},{"kind":"storage","W":2.5,"D":6,"fill":0.43,"doorU":1.29,"fire":null,"dens":4.62,"open":[],"p":[["f","piece_chest_wood","L0.21","P0.14",90],["f","piece_chest_wood","L0.51","B0",135],["f","piece_chest_wood","L0.17","P-0.14",90]],"stair":1,"id":"RT-0222"},{"kind":"other","W":8,"D":9.5,"fill":0.65,"doorU":-1,"fire":null,"dens":1.41,"open":[],"p":[["f","piece_groundtorch_mist","L0","C-0.18",303],["f","piece_groundtorch_mist","P0.07","F0",303],["f","piece_groundtorch_mist","R1.01","C0",45],["f","piece_groundtorch_mist","P0.07","B0.11",303],["m","darkwood_raven","L0","P-0.23",0.9],["m","darkwood_raven","R1.06","F0",0.9],["m","darkwood_raven","P-0.18","B0",0.9]],"id":"RT-0223"},{"kind":"other","W":9.5,"D":9,"fill":0.52,"doorU":-3.95,"fire":null,"dens":1.34,"open":[["d","L",1.1,2],["w","L",-0.9,2],["d","B",-4.01,2],["w","B",-2.95,1],["w","L",-0.9,2],["w","F",-0.35,3],["w","F",-3.18,3.75],["w","B",3.88,3],["w","B",0.11,3.5]],"p":[["f","piece_chest_wood","P0.1","B0",180],["f","piece_chest_wood","P-0.11","B0",180],["f","jute_carpet","P-0.08","P0.11",315],["f","ArmorStand","P-0.15","F1.08",348],["f","ArmorStand","P-0.29","P-0.25",45],["m","piece_walltorch","L0.33","F0",1.85],["m","piece_walltorch","P-0.31","B0",1.92]],"id":"RT-0224"},{"kind":"hall","W":8,"D":11.5,"fill":0.6,"doorU":-4.01,"fire":[0.22,-5.45],"dens":1.62,"open":[["d","B",0.17,4],["w","B",-2.94,2],["w","F",-2.94,2],["w","B",-2.93,2],["w","F",-2.93,2]],"p":[["f","hearth","C0.22","F0",180],["f","piece_chest_wood","L0.57","P0.14",180],["f","piece_chest_wood","L0.55","P0.06",180],["c","piece_cauldron",0,-1.12,-0.39,11,0.58],["m","darkwood_raven","P-0.23","B0",4],["c","piece_cookingstation",0,1.19,0,270,0.58],["c","piece_cookingstation",0,0.71,0.03,270,0.58],["c","piece_cookingstation",0,0.21,0.11,270,0.58],["c","piece_cookingstation_iron",0,-0.01,0.67,0,0.58]],"id":"RT-0225"},{"kind":"storage","W":2.5,"D":6,"fill":0.47,"doorU":-1.04,"fire":null,"dens":4.29,"open":[],"p":[["f","piece_chest_wood","R0.1","P0.18",270],["f","piece_chest_wood","R0.14","P-0.1",270],["f","piece_chest_wood","R0.44","F0",315]],"id":"RT-0226"},{"kind":"other","W":8,"D":9.5,"fill":0.67,"doorU":0.75,"fire":null,"dens":1.17,"open":[],"p":[["f","piece_groundtorch_mist","R0.76","C0.07",45],["f","piece_groundtorch_mist","P0.1","F0",303],["f","piece_groundtorch_mist","L0.16","C-0.11",303],["f","piece_groundtorch_mist","P0.1","B0.04",303],["m","darkwood_raven","L0","P-0.22",0.9],["m","darkwood_raven","R0.81","F0",0.9]],"id":"RT-0227"},{"kind":"other","W":9.5,"D":9,"fill":0.56,"doorU":-4.02,"fire":null,"dens":1.26,"open":[["w","F",-0.42,3],["w","B",3.46,4],["w","F",-3.34,4],["w","L",-1.15,2],["w","R",-1.15,2],["w","B",0.16,3.75],["d","L",0.85,2],["w","L",-1.15,2],["d","B",-4.08,2],["w","B",-2.67,2]],"p":[["f","ArmorStand","P-0.3","P-0.28",45],["f","jute_carpet","P-0.08","P0.09",315],["f","ArmorStand","P-0.15","F0.83",348],["f","piece_chest_wood","P-0.11","B0.01",180],["f","piece_chest_wood","P0.09","B0.01",180],["m","piece_walltorch","L0.26","F0",1.85],["m","piece_walltorch","P-0.32","B0",1.92]],"id":"RT-0228"},{"kind":"sleeping","W":12,"D":20,"fill":0.71,"doorU":-0.75,"fire":null,"dens":1.42,"open":[["w","L",5.26,1.5],["w","F",-3.51,3],["w","L",3.51,1],["w","L",0.01,4],["w","L",-6.49,7],["w","B",-0.01,12],["w","F",2.24,7.5],["w","L",8.04,2],["w","R",8.04,2]],"p":[["f","piece_cartographytable","C0.16","F0.78",0],["f","piece_bed02","R0.2","P-0.33",270],["f","piece_chair03","C0.21","C0.02",270],["f","rug_fur","C-0.17","P0.07",180],["f","rug_fur","P0.17","P-0.25",0],["f","rug_fur","R0.34","P-0.23",270],["f","rug_fur","C-0.28","P-0.05",0],["f","piece_chest","P0.26","F0.79",0],["f","piece_chest","R0.4","F0.79",0],["f","ArmorStand","R0.49","P-0.12",270],["f","ArmorStand","R0.48","P-0.06",270],["f","ArmorStand","R0.47","P0.05",270],["f","piece_chair","R0.43","P-0.23",45],["f","ArmorStand","R0.46","P-0.17",270],["f","piece_groundtorch","P-0.15","P0.21",90],["c","rug_fur",0,-0.05,1,270,0.02],["m","itemstand","R0","P-0.2",1.9],["m","itemstand","R0","C0.01",1.9],["m","itemstand","R0","B0",1.9],["m","itemstand","L0.57","B0",2.74],["m","piece_walltorch","R0","P-0.25",2.87],["m","piece_walltorch","R0","P0.25",2.9],["m","itemstand","P0.09","B0",2.92],["m","itemstand","P0.08","F0",2.96],["m","piece_walltorch","R0","P0.06",3],["m","piece_walltorch","R0","P-0.06",3.04],["m","piece_banner01","R0.3","B0",3.68],["m","piece_banner01","P0.33","B0",3.69],["m","piece_banner01","P0.23","B0",3.69]],"id":"RT-0229"},{"kind":"other","W":13,"D":12,"fill":0.39,"doorU":6.38,"fire":null,"dens":1.3,"open":[["w","F",-4.5,1],["w","L",-4.22,1],["w","F",-3.71,1],["w","F",-5.48,1],["w","R",-4.19,2.75],["w","F",2.48,2],["w","F",-1.64,2],["w","R",-0.4,2],["w","F",-0.58,1],["w","F",0.77,2],["w","F",4.69,3],["w","R",4.79,2.5],["w","B",4.92,3],["w","L",2.43,1.75],["w","L",-4.01,2]],"p":[["f","rug_fur","L0.31","F0",315],["f","ArmorStand","P-0.12","P-0.1",293],["f","piece_groundtorch_mist","L0","P-0.05",44],["m","itemstand","L0.73","F0",1.77],["m","itemstand","L0","F0",2.4],["m","itemstand","L0.73","F0",2.51],["m","itemstand","P-0.31","F0",2.52],["m","itemstand","L0.88","F0",3.3],["m","itemstand","L0","P-0.37",3.93]],"id":"RT-0230"},{"kind":"other","W":13,"D":12,"fill":0.39,"doorU":6.48,"fire":null,"dens":1.8,"open":[["w","B",5.02,3],["w","R",4.53,2.75],["w","F",4.79,3],["w","F",2.58,2],["w","F",-1.54,2],["w","F",0.88,2],["w","F",-0.48,1],["w","R",-0.28,2],["w","R",-4.2,3],["w","F",-5.38,1],["w","L",-4.1,1],["w","B",-3.61,1],["w","F",-3.61,1],["w","F",-3.9,2],["w","L",2.54,1.75],["w","L",-5.39,1]],"p":[["f","rug_fur","L0.41","F0",315],["f","ArmorStand","P-0.11","P-0.09",293],["f","piece_groundtorch_mist","L0.09","P-0.04",45],["m","itemstand","L0.83","F0",1.77],["m","itemstand","L0","F0.05",2.4],["m","itemstand","L0.83","F0",2.51],["m","itemstand","P-0.3","B0",2.52],["m","piece_dvergr_lantern","L0","C0.13",2.72],["m","itemstand","L0.98","F0",3.3],["m","itemstand","L0","P-0.36",3.93],["m","itemstand","L0","C0.16",4.11],["h","piece_brazierceiling01","P-0.03","P0.09",225,4.18]],"id":"RT-0232"},{"kind":"sleeping","W":12,"D":12.5,"fill":0.76,"doorU":5.25,"fire":null,"dens":2.1,"open":[["d","R",-1.22,2],["d","F",-1.02,2],["w","F",-1.92,2.75],["w","B",-2.45,4],["w","B",-4.35,2.75]],"p":[["f","piece_throne01","R0","P0.05",270],["f","piece_bed02","R0.03","B0.38",180],["f","piece_bed02","P0.06","B0.4",180],["f","piece_bed02","L0.2","P-0.07",90],["f","piece_bed02","L0.01","F0.22",90],["f","piece_chest_blackmetal","P-0.11","B0.32",180],["f","piece_chest_blackmetal","L0","P0.1",90],["f","piece_chest_blackmetal","R0.38","P0.14",180],["f","piece_chest_blackmetal","P0.06","F0",270],["f","piece_chest_blackmetal","P-0.17","F0.48",90],["f","rug_fur","P0.24","B1.13",180],["f","jute_carpet","P0.12","P0.1",202],["f","jute_carpet","P-0.05","C0",315],["f","jute_carpet","R0.68","C-0.02",180],["f","jute_carpet","P0.04","P-0.08",315],["f","rug_wolf","R0","P-0.1",270],["f","rug_fur","P0.12","P-0.2",45],["f","jute_carpet","P-0.26","P-0.22",0],["f","rug_deer","P-0.05","P-0.27",135],["f","rug_wolf","P-0.07","F0",0],["f","piece_chair03","C-0.12","P0.09",292],["f","piece_chair03","P-0.1","C0.05",337],["m","itemstand","P-0.35","F0",0.65],["m","itemstand","P-0.24","F0",0.65],["m","itemstand","P-0.31","F0",0.65],["m","itemstand","P-0.28","F0",0.66],["m","itemstand","L1.08","F0",0.66],["m","sign","L0","F0.72",0.91],["m","piece_walltorch","C0.11","F0",2.24],["m","piece_walltorch","R0","C-0.1",2.25],["m","piece_banner02","P0.31","B0",3.75],["m","piece_banner02","L0","P-0.3",3.84],["m","piece_banner01","L0","P-0.06",3.85],["m","piece_banner01","P0.07","B0",3.88]],"id":"RT-0233"},{"kind":"storage","W":4.5,"D":8,"fill":0.69,"doorU":1,"fire":null,"dens":4,"open":[],"p":[["f","piece_chest_blackmetal","R0.51","F0.26",180],["f","piece_chest_blackmetal","R0.52","P-0.27",180],["f","piece_chest_blackmetal","R0.54","P-0.12",180],["f","piece_chest_blackmetal","R0.55","C0.2",180],["f","piece_chest_blackmetal","R0.56","P0.17",0],["f","piece_chest_blackmetal","R0.56","B1.07",0],["f","piece_chest_blackmetal","L0.27","P0.21",180],["f","piece_chest_blackmetal","L0.25","P0.07",180],["f","piece_chest_blackmetal","R0.54","B0",0],["m","sign","L0","P0.13",2.76]],"stair":1,"id":"RT-0234"},{"kind":"sleeping","W":9.5,"D":9.5,"fill":0.81,"doorU":1.35,"fire":null,"dens":1.77,"open":[["w","B",-2.9,0.5],["w","B",-0.15,1],["w","B",4.6,0.5],["w","F",1.85,6],["w","L",3.19,0.25]],"p":[["f","piece_table","R0.59","F0.77",270],["f","piece_bed02","R0.27","B0.3",270],["f","piece_throne01","R0.2","C-0.01",270],["f","rug_deer","R0.21","P0.13",0],["f","rug_deer","R0.13","P-0.13",203],["f","rug_deer","P0.16","P-0.17",225],["f","rug_deer","L1.04","C-0.04",270],["f","rug_deer","R0.85","P0.15",90],["f","rug_deer","P0.16","C-0.22",225],["f","rug_wolf","R0.7","C-0.19",270],["f","ArmorStand","R0.37","P0.16",270],["c","piece_chest",1,0.02,2.13,0,-0.04],["c","treasure_stack",0,-0.86,0.35,157,0.8],["c","itemstandh",0,-0.85,-0.29,180,0.82],["c","itemstandh",0,0.98,-0.28,180,0.82],["c","itemstandh",0,0.88,0.14,180,0.82],["c","treasure_stack",0,-0.06,-0.37,112,0.85],["c","treasure_stack",0,-0.18,-0.3,23,0.85],["c","itemstandh",0,0.48,0.46,180,0.87],["m","piece_walltorch","R0","P-0.26",2.26],["m","piece_walltorch","L0","P-0.26",2.31],["m","piece_walltorch","R0","P0.28",2.32],["m","piece_walltorch","P-0.28","B0",2.33],["m","itemstand","C-0.14","F0",3.39],["m","itemstand","C-0.16","B0",3.41],["m","itemstand","L0","C0.1",3.42],["m","itemstand","R0","C0.07",3.67]],"id":"RT-0235"},{"kind":"smithy","W":14,"D":7.5,"fill":0.86,"doorU":3.99,"fire":null,"dens":2.33,"open":[["w","B",-0.08,6],["w","F",-2.01,2],["w","F",-4.06,2],["d","F",3.99,2],["w","F",0.99,4]],"p":[["f","forge","R0.1","P-0.14",270],["f","piece_table_round","P0.11","C-0.26",90],["f","piece_workbench","P-0.06","F0",0],["f","piece_chair","P-0.22","P0.18",180],["f","piece_chest_wood","R0.37","B0.3",90],["f","piece_chest_wood","R1.1","B0.3",90],["f","piece_chest_wood","P0.34","B0.32",90],["f","piece_chest_wood","P0.29","B0.32",90],["f","piece_chest","P0.17","B0.22",180],["f","piece_chest","P0.04","B0.22",180],["f","piece_chest","P-0.09","B0.23",180],["f","piece_chest","P0.16","F0.07",0],["f","rug_deer","P0.1","B1.06",270],["f","jute_carpet","P-0.15","C-0.24",270],["f","rug_wolf","P0.31","P-0.09",270],["f","piece_chest","L0.77","B0.16",90],["f","ArmorStand","R0.51","F0.2",315],["f","piece_chair02","P-0.17","P0.16",225],["f","piece_workbench_ext2","P-0.35","F0.58",0],["c","piece_workbench_ext1",2,1.91,-0.19,90,-0.09],["c","piece_workbench_ext4",2,-2.13,-0.44,0,0],["c","rug_deer",1,1.43,-0.45,180,0.1],["c","itemstandh",1,-0.6,-0.08,22,0.8],["c","itemstandh",1,-0.11,0.74,0,0.8],["c","itemstandh",1,0.17,-0.75,22,0.8],["c","itemstandh",1,0.75,0.04,315,0.8],["m","itemstand","P-0.15","B0",2.62],["m","itemstand","L0","F0.31",2.86],["m","itemstand","L0","B0.57",2.87]],"id":"RT-0236"},{"kind":"sleeping","W":4,"D":10,"fill":0.9,"doorU":0,"fire":null,"dens":1.11,"open":[["w","F",-0.5,3],["w","L",0,10]],"p":[["f","piece_bed02","R0.29","P0.27",90],["f","piece_bed02","L0.26","P-0.24",90],["f","piece_chair","L0.27","C0.07",90],["m","piece_dvergr_lantern","L0","B0",1.59]],"id":"RT-0237"},{"kind":"other","W":3.5,"D":4,"fill":0.38,"doorU":0.08,"fire":null,"dens":5.71,"open":[["w","F",-1.36,1],["w","B",-1.33,1]],"p":[["f","piece_chest","L0","F0.08",90],["f","piece_chest","L0","C0.1",90],["f","piece_chest","L0","B0",90]],"id":"RT-0238"},{"kind":"other","W":6,"D":6.5,"fill":0.31,"doorU":-0.04,"fire":null,"dens":2.45,"open":[],"p":[["f","piece_groundtorch_mist","R0.35","C-0.22",270],["f","piece_groundtorch_mist","C0.06","B0.28",180],["f","piece_groundtorch_mist","L0.42","C-0.18",90]],"stair":1,"id":"RT-0239"},{"kind":"other","W":6,"D":6.5,"fill":0.35,"doorU":1.25,"fire":null,"dens":2.22,"open":[],"p":[["f","piece_groundtorch_mist","L0.35","C0.22",90],["f","piece_groundtorch_mist","C-0.06","F0.28",0],["f","piece_groundtorch_mist","R0.42","C0.18",270]],"id":"RT-0240"},{"kind":"sleeping","W":6,"D":6,"fill":0.69,"doorU":-0.5,"fire":null,"dens":2.02,"open":[],"p":[["f","ashwood_bed","C0.06","B0.98",180],["f","piece_chair03","L0.92","P0.16",124],["f","piece_groundtorch_mist","L1.17","B0.23",327],["f","piece_groundtorch_mist","P-0.07","B0",349],["f","piece_groundtorch_mist","P0.11","B0",12],["c","rug_fur",0,-1.02,0.76,0,-0.04],["c","rug_fur",0,1.01,0.54,0,-0.04]],"id":"RT-0241"},{"kind":"other","W":7,"D":6.5,"fill":0.48,"doorU":-2.25,"fire":null,"dens":3.18,"open":[["d","R",1.21,2]],"p":[["f","piece_chair","P-0.23","P-0.19",90],["f","jute_carpet_blue","L0.95","B0.95",113],["f","piece_groundtorch_mist","P-0.06","B0.02",169],["f","piece_groundtorch_mist","R0.37","P0.1",259],["f","piece_groundtorch_mist","L0.5","C-0.34",79],["f","piece_groundtorch_mist","P-0.23","F0.78",34],["f","piece_groundtorch_mist","R0.8","P-0.23",304],["h","piece_brazierceiling01","C0.03","C0.19",113,2.88]],"id":"RT-0242"},{"kind":"workshop","W":10,"D":4,"fill":0.99,"doorU":-0.1,"fire":null,"dens":1.01,"open":[["d","F",-0.1,2]],"p":[["f","piece_workbench","P0.28","F0.23",0],["f","piece_bench01","L0.91","F0.07",0],["m","piece_walltorch","P-0.33","F0",1.99],["m","piece_walltorch","P0.29","F0",2.09]],"id":"RT-0243"},{"kind":"home","W":10,"D":10,"fill":0.85,"doorU":3.25,"fire":null,"dens":1.54,"open":[["w","R",-4.28,1.25]],"p":[["f","piece_bed02","P-0.26","B0.48",180],["f","piece_table_round","P0.13","P0.12",213],["f","piece_throne01","P0.25","B1.15",213],["f","piece_chair","L0.3","B0.82",135],["f","piece_chair02","L0.67","F0.96",45],["f","piece_chest","R0.57","B0.17",180],["f","piece_chest","P-0.26","P0.05",180],["f","rug_wolf","P0.14","P-0.05",45],["c","piece_chair03",1,-1.84,-0.33,90,-0.01],["c","piece_chair03",1,1.75,-0.52,282,-0.01],["c","rug_fur",0,-0.74,0.96,292,-0.07],["c","piece_chair03",1,-0.62,1.91,158,0.02],["c","piece_chair03",1,1.22,1.6,225,0.02],["m","piece_walltorch","P-0.12","F0",0.91],["m","piece_walltorch","P0.08","F0",0.97]],"id":"RT-0244"},{"kind":"hall","W":12,"D":12,"fill":0.83,"doorU":2.89,"fire":[-3.91,3.06],"dens":2.18,"open":[["d","F",2.89,2],["d","B",3,2],["d","L",-2.93,2]],"p":[["f","hearth","L1.09","P0.25",270],["f","piece_table","R0.49","P0.3",90],["f","piece_throne01","R0.98","P-0.1",304],["f","piece_table_round","P0.18","C-0.01",338],["f","piece_chest_blackmetal","P-0.05","B0.23",180],["f","piece_chest_blackmetal","C-0.19","F0.63",0],["f","rug_deer","R1.19","P0.19",338],["f","rug_wolf","P0.06","P-0.12",327],["f","piece_chest","R0.49","P0.11",270],["c","piece_chair03",3,-0.08,1.81,180,-0.01],["c","piece_chair03",3,-1.34,-1.36,56,0.02],["c","piece_chair03",3,-1.6,0.7,112,0.02],["c","piece_chair03",3,1.65,0.97,247,0.04],["c","piece_chair02",1,0.25,-1.11,349,0.09],["c","piece_cookingstation",0,-0.61,0.24,90,0.58],["c","piece_cauldron",0,0.9,0.08,158,0.58],["m","darkwood_wolf","R0","P-0.23",0.96],["m","piece_walltorch","L0","P-0.07",1.33],["m","piece_walltorch","L0","F0.96",1.43],["m","piece_walltorch","R0","P0.28",1.48],["m","piece_walltorch","P0.08","B0",1.48],["m","piece_walltorch","R0","P-0.25",1.49],["m","piece_banner02","P0.08","F0",2.79],["m","piece_banner02","R0.66","B0",2.8],["m","piece_banner02","P-0.04","B0",2.82],["m","piece_banner05","R0","C-0.18",2.83],["m","piece_banner02","R0.82","F0",2.88],["m","piece_walltorch","P0.16","F0",3.33]],"id":"RT-0245"},{"kind":"sleeping","W":7.5,"D":6,"fill":0.98,"doorU":-1.14,"fire":null,"dens":2.03,"open":[["d","F",-1.14,2]],"p":[["f","piece_bed02","R0.15","C-0.28",270],["f","piece_chair","R0.24","B0.81",237],["f","piece_chair03","L0.22","B0.41",113],["f","rug_fur","L0.51","B0.99",147],["m","piece_walltorch","P-0.15","B0",1.43],["m","piece_walltorch","P0.12","B0",1.43],["m","piece_walltorch","L0","C-0.02",1.45],["m","piece_banner02","P0.11","F0",2.79],["m","piece_banner02","L0.32","F0",2.88],["m","piece_banner05","P0.13","F0",3.27]],"id":"RT-0246"},{"kind":"sleeping","W":7.5,"D":6,"fill":0.98,"doorU":-1.06,"fire":null,"dens":1.81,"open":[["d","F",-1.06,2]],"p":[["f","piece_bed02","R0.07","C-0.31",270],["f","piece_chair","R0.16","B0.84",237],["f","piece_chair03","L0.3","B0.44",113],["f","rug_fur","L0.59","B1.01",147],["m","piece_walltorch","L0","C-0.05",1.45],["m","piece_walltorch","P0.13","B0",1.43],["m","piece_walltorch","P-0.13","B0",1.43],["m","piece_banner02","P0.12","F0",2.79],["m","piece_banner05","P0.14","F0",3.27]],"id":"RT-0247"},{"kind":"hall","W":12,"D":12,"fill":0.79,"doorU":2.9,"fire":[-3.08,-3.99],"dens":2.37,"open":[["d","L",2.92,2],["d","F",2.9,2],["d","R",2.81,2]],"p":[["f","piece_table","P-0.3","B0.57",0],["f","hearth","P-0.26","F1.01",180],["f","piece_table_round","C-0.01","P0.17",248],["f","piece_throne01","P0.1","B1.06",214],["f","rug_deer","P-0.19","P0.28",248],["f","piece_chest","P-0.11","B0.57",180],["f","piece_chest_blackmetal","R0.66","C-0.27",270],["f","rug_wolf","P0.12","P0.05",237],["f","piece_chest_blackmetal","L0.21","P-0.06",90],["c","piece_chair03",2,-0.08,1.81,180,-0.01],["c","piece_chair03",2,-1.34,-1.36,56,0.02],["c","piece_chair02",0,0.25,-1.11,349,0.09],["c","piece_chair03",2,-1.6,0.7,112,0.02],["c","piece_chair03",2,1.65,0.97,248,0.04],["m","piece_walltorch","R0.99","F0",1.43],["m","piece_walltorch","L0","P0.07",1.48],["m","piece_walltorch","P-0.29","B0",1.48],["m","piece_banner05","C0.16","B0",2.83],["m","darkwood_wolf","P0.23","B0",0.96],["m","piece_walltorch","P0.25","B0",1.49],["m","piece_walltorch","P0.07","F0",1.33],["c","piece_cauldron",1,0.9,0.08,158,0.58],["c","piece_cookingstation",1,-0.61,0.24,90,0.58],["m","piece_banner02","R0","P0.07",2.79],["m","piece_banner02","L0","B0.74",2.8],["m","piece_banner02","L0","P-0.05",2.82],["m","piece_banner02","R0","B0.9",2.88],["m","piece_banner05","R0","P0.06",3.27],["m","piece_walltorch","R0","P0.15",3.33]],"id":"RT-0248"},{"kind":"tavern","W":12,"D":14,"fill":0.73,"doorU":-3.15,"fire":[-2.26,5.43],"dens":1.72,"open":[["w","R",-6.31,1.5],["w","L",-6.31,1.5],["d","L",-0.11,2],["d","L",1.89,2],["d","F",-2.27,3.75]],"p":[["f","hearth","P-0.19","B0.57",180],["f","piece_workbench","L0.19","F1.03",90],["f","piece_table","P0.08","P-0.33",270],["f","piece_throne01","P0.18","P0.11",224],["f","piece_table_round","C0.28","C0.14",224],["f","piece_chest_wood","C0.33","B0.4",90],["f","piece_chest_wood","P0.09","B0.42",90],["f","piece_chest_wood","P0.06","F0.3",0],["f","rug_deer","P-0.05","P-0.11",315],["f","rug_deer","L0.31","P0.09",225],["f","rug_fur","P-0.18","F1.08",270],["f","piece_chest","P0.32","C0.04",270],["f","piece_chest","P0.32","P-0.13",270],["f","piece_chest","P0.32","P0.14",270],["c","piece_chair03",4,-0.99,1.49,158,-0.01],["c","piece_chair03",4,1.69,-0.41,271,-0.01],["c","piece_chair03",4,0.8,1.56,203,-0.01],["c","piece_chair03",4,-1.96,-0.51,90,-0.01],["c","rug_wolf",4,0.84,-0.07,46,0],["c","piece_chair02",2,0.39,0.81,202,0.04],["c","piece_cauldron",0,0.93,-0.06,292,0.58],["c","piece_cookingstation",0,-0.85,0.05,270,0.58],["c","itemstandh",2,0.85,0.08,135,0.82],["c","itemstandh",2,0.35,0.06,225,0.82],["c","itemstandh",2,-0.92,-0.12,180,0.82],["c","itemstandh",4,0.44,0.89,226,0.8],["c","itemstandh",4,0.66,-0.05,203,0.8],["c","itemstandh",4,0.02,0.86,293,0.8],["c","itemstandh",4,0.21,0.38,226,0.8],["c","itemstandh",4,-0.06,0.06,158,0.8],["c","itemstandh",4,-0.24,0.47,226,0.8],["c","itemstandh",4,-0.02,-0.75,158,0.8],["c","itemstandh",4,-0.69,0.66,271,0.8],["c","itemstandh",4,-0.76,-0.18,203,0.8],["m","itemstand","L0","P0.07",2.11],["m","itemstand","L0","P0.07",3.3],["h","piece_brazierceiling01","P-0.18","F0.44",180,3.88]],"id":"RT-0249"},{"kind":"workshop","W":8,"D":6,"fill":0.99,"doorU":1.14,"fire":null,"dens":0.84,"open":[["d","F",0.14,4]],"p":[["f","piece_workbench","R0.37","C-0.06",270],["f","piece_chair","P-0.27","B0.57",22],["f","piece_chair","P-0.06","B0.71",348],["f","piece_chest_wood","L0.59","F0.27",0]],"id":"RT-0250"},{"kind":"sleeping","W":8,"D":7.5,"fill":0.8,"doorU":-1.03,"fire":null,"dens":1.88,"open":[["w","F",-3.02,2],["w","F",2.98,2],["w","R",-2.77,1.75],["w","B",-1.09,6],["w","L",-2.83,1.75],["w","L",2.92,1.75],["w","R",2.97,1.75]],"p":[["f","piece_bed02","R0.2","C0.06",270],["f","piece_chest","R0.49","F0.31",270],["f","piece_chest","L0.26","C0.27",90],["f","rug_fur","L0.91","P0.07",135],["f","piece_chair03","L0.85","B0.84",146],["f","piece_chair03","P-0.05","B0.61",213],["f","piece_chair","P-0.18","B1.07",180],["m","piece_walltorch","L0","C0.05",2.02],["m","piece_walltorch","R0","C0.12",2.3],["m","piece_banner05","R0.94","B0",2.93]],"stair":1,"id":"RT-0251"},{"kind":"storage","W":4,"D":2.5,"fill":1,"doorU":1.43,"fire":null,"dens":6,"open":[["w","R",-0.79,0.75],["w","B",-1.11,2],["w","F",-1.08,2]],"p":[["f","piece_chest_wood","P0.1","F0.19",90],["f","piece_chest_wood","L0.07","F0.8",180],["f","piece_chest_wood","L0.11","F0",180],["f","piece_chest_wood","R0.46","B0.01",0],["f","piece_chest_wood","L0.12","B0.06",180],["f","piece_chest_wood","R0.33","F0.12",90]],"stair":1,"id":"RT-0252"},{"kind":"smithy","W":10,"D":13,"fill":0.81,"doorU":0.17,"fire":[0.07,4.98],"dens":2.17,"open":[["d","F",0.17,2],["w","B",2.33,1.5],["w","B",-4.42,1],["w","R",6,1],["w","L",5.97,1]],"p":[["f","forge","L0.4","P-0.09",90],["f","hearth","C0.07","B0.52",180],["f","piece_workbench","L0.58","F0.92",90],["f","piece_chest_wood","R0.25","F1",180],["f","piece_chest_wood","R0.31","P-0.3",180],["f","piece_chest_blackmetal","C-0.14","P-0.15",270],["f","piece_chest_blackmetal","C-0.15","P0.03",270],["f","piece_chest_wood","R0.32","P0.22",180],["f","fermenter","P-0.19","F0.25",0],["f","piece_chest_wood","R0.29","P-0.24",180],["f","piece_chest","L0.6","P0.17",270],["f","piece_chest_wood","R0.28","P-0.15",180],["f","piece_chest_wood","R0.23","F0.2",180],["f","piece_chest_wood","R0.27","C0.14",180],["f","piece_chest_wood","R0.28","P0.07",180],["f","piece_chest_wood","R0.25","P-0.09",180],["f","piece_chest_wood","R0.31","P0.16",180],["c","forge_ext5",0,1.48,0.15,0,0.03],["c","forge_ext1",0,-1.54,0.41,0,0.04],["c","piece_cauldron",1,0.8,0.11,11,0.58],["c","piece_cookingstation_iron",1,0.03,-0.83,0,0.58],["c","piece_cookingstation",1,-1.19,-0.11,90,0.58],["c","piece_cookingstation",1,-0.48,-0.23,90,0.58]],"id":"RT-0253"},{"kind":"smithy","W":10,"D":2,"fill":1,"doorU":1,"fire":null,"dens":2,"open":[],"p":[["f","piece_workbench_ext2","C-0.31","B0.68",180],["f","forge_ext4","L0","F0.57",180],["f","forge_ext3","P-0.23","B0.41",180],["f","piece_workbench_ext1","P0.18","F0.37",180]],"id":"RT-0254"},{"kind":"home","W":10,"D":10,"fill":0.97,"doorU":0.17,"fire":null,"dens":1.44,"open":[["d","F",0.17,2]],"p":[["f","piece_table_round","P-0.2","P-0.18",33],["f","piece_throne01","P-0.3","F0.93",33],["f","piece_bed02","R0.85","B0.12",180],["f","piece_chest","P0.22","F0.2",90],["f","piece_chair","P0.1","B0.87",146],["f","rug_fur","L1.17","P0.18",225],["f","rug_deer","P0.05","P-0.05",270],["f","piece_chest","R0.28","F0.25",90],["f","piece_chest_blackmetal","R0.56","P-0.09",270],["f","piece_chest","P0.32","F0.19",90],["c","piece_chair03",0,1.02,1.28,225,0.04],["c","rug_wolf",2,0.87,1.53,135,-0.04],["c","piece_chair03",0,-2.03,0,102,-0.01],["c","piece_chair03",0,1.81,-0.22,270,-0.01],["c","piece_chair03",0,-0.99,1.55,158,0.02],["m","piece_banner02","P-0.18","B0",3.54],["m","piece_banner02","P0.22","B0",3.57]],"id":"RT-0255"},{"kind":"storage","W":6,"D":7.5,"fill":0.77,"doorU":-1.79,"fire":null,"dens":0.87,"open":[["w","F",1.94,2],["w","L",-0.13,4],["w","B",-2.38,1.5],["w","B",2.12,1.5],["w","F",-0.07,2],["w","R",-2.99,1.75],["w","L",-2.97,1.75],["d","F",-1.92,1.75]],"p":[["f","piece_chest_wood","L0.42","B0.26",180],["f","piece_chest_wood","R0.09","C0.17",270],["f","piece_chest_wood","L0.49","B1.14",180]],"id":"RT-0256"},{"kind":"hall","W":8,"D":8,"fill":0.83,"doorU":-1.14,"fire":null,"dens":1.51,"open":[["w","R",-1.06,2],["d","F",-1.01,1.75],["w","L",-3.11,2]],"p":[["f","piece_table_round","P0.21","P0.14",112],["f","piece_throne01","P0.1","F0.39",303],["f","rug_fur","L0.41","B0.92",112],["f","rug_deer","L0.13","P-0.06",67],["c","piece_chair03",0,1.37,1.24,225,-0.03],["c","piece_chair03",0,0.71,-1.72,326,-0.01],["c","piece_chair03",0,1.6,-0.24,259,-0.01],["c","rug_wolf",0,0.62,-0.17,270,-0.03],["m","piece_walltorch","R0","F0.77",2.67],["m","piece_walltorch","P0.32","F0",2.6],["m","piece_banner01","P0.11","F0",3.64]],"id":"RT-0257"},{"kind":"storage","W":12,"D":14,"fill":0.85,"doorU":-0.93,"fire":[-0.04,5.4],"dens":1.62,"open":[["w","L",4.74,3.75],["d","F",0.07,4]],"p":[["f","hearth","C-0.04","B0.6",180],["f","piece_table_round","R0.73","C0.34",123],["f","piece_throne01","R0.84","F0.39",303],["f","piece_chest_wood","L0.39","P-0.13",0],["f","piece_chest_wood","L0.34","P-0.19",0],["f","rug_fur","P-0.07","F0.99",123],["f","piece_chest_wood","L0.41","F0.24",0],["f","piece_chest_wood","L0.49","P-0.33",0],["f","piece_chest_wood","L0.46","P-0.27",0],["f","piece_chest_wood","R0.38","P0.31",0],["f","piece_chest_wood","R0.4","P0.25",0],["f","piece_chest_wood","R0.42","B0.33",0],["f","rug_wolf","R1.14","P-0.26",45],["f","piece_chest_wood","L0.48","F1.07",0],["f","piece_chest_wood","R0.34","B1.13",0],["c","piece_chair03",1,1.96,-0.04,270,-0.06],["c","piece_chair03",1,-1.89,-0.17,90,-0.06],["c","piece_chair03",1,1.16,1.51,225,-0.06],["c","piece_chair03",1,0.85,-1.7,338,-0.01],["c","rug_deer",1,0.32,-0.73,12,-0.05],["c","piece_chair03",1,-0.83,-1.73,23,-0.01],["c","piece_cauldron",0,-0.98,0.08,90,0.58],["c","piece_cookingstation",0,0.33,0.03,90,0.58],["c","piece_cookingstation",0,1.13,-0.12,90,0.58],["m","piece_walltorch","P-0.16","B0",1.18],["m","piece_walltorch","P-0.12","F0",1.03]],"id":"RT-0258"},{"kind":"storage","W":2,"D":3.5,"fill":1,"doorU":1.99,"fire":null,"dens":5.71,"open":[["w","R",0.12,3.5]],"p":[["f","piece_chest","L0.2","F0.97",0],["f","piece_chest","L0.18","F0.04",0],["f","piece_chest","L0.23","B0.85",0],["f","piece_chest","L0.17","B0",0]],"stair":1,"id":"RT-0259"},{"kind":"storage","W":2,"D":5.5,"fill":1,"doorU":-2.01,"fire":null,"dens":5.45,"open":[["w","R",-0.1,5.5],["w","F",-0.01,2],["w","B",-0.07,2]],"p":[["f","piece_chest_wood","L0.18","C0.27",180],["f","piece_chest_wood","L0.24","P-0.1",180],["f","piece_chest_wood","L0.27","F0.67",180],["f","piece_chest_wood","L0.3","F0",180],["f","piece_chest_wood","L0.23","B1.05",180],["f","piece_chest_wood","L0.25","B0.25",180]],"stair":1,"id":"RT-0260"},{"kind":"home","W":14.5,"D":14.5,"fill":0.7,"doorU":-0.25,"fire":[-0.1,-0.15],"dens":1.64,"open":[["w","L",0.04,6],["w","F",5.04,6],["w","F",-2.25,2],["d","F",-0.25,2],["w","F",1.75,2]],"p":[["f","hearth","C-0.1","C-0.15",0],["f","piece_throne01","P-0.34","P-0.33",45],["f","piece_table_round","C-0.08","P-0.19",90],["f","piece_bed02","P-0.03","P0.21",0],["f","piece_chair03","P-0.18","B0.26",135],["f","rug_wolf","P0.11","P0.24",337],["f","rug_deer","P-0.21","F1.03",157],["f","rug_fur","C0.01","F0.68",270],["f","rug_wolf","P-0.3","P-0.2",270],["f","rug_deer","L0.44","C0.01",45],["f","rug_deer","P0.26","P-0.21",22],["f","ArmorStand","P0.15","B0.15",225],["c","piece_chair",0,1.41,2.32,157,0.03],["c","piece_chair03",2,1.34,0.89,224,-0.01],["c","piece_chair03",2,-0.31,1.89,180,-0.01],["c","piece_chair03",2,-0.44,-1.95,0,-0.01],["c","rug_fur",3,-0.16,2.09,22,-0.04],["c","piece_chair03",2,1.47,-0.99,292,0.02],["c","piece_cauldron",0,-1.03,-0.44,11,0.58],["c","piece_cookingstation",0,0.61,-0.02,90,0.58],["c","piece_cookingstation",0,1.19,-0.15,90,0.58],["c","piece_cookingstation_iron",0,-0.05,0.61,0,0.58],["m","itemstand","P-0.03","B0",1.85],["m","itemstand","L0","P0.36",1.87],["m","piece_walltorch","P-0.08","B0",2.11],["m","piece_walltorch","P0.03","B0",2.13],["m","itemstand","P-0.03","B0",2.25],["m","itemstand","L0","P0.36",2.37],["m","piece_banner04","P0.13","F0",2.94],["m","piece_banner04","P-0.17","F0",2.96],["m","itemstand","C-0.14","F0",3.02]],"id":"RT-0261"},{"kind":"storage","W":4,"D":6,"fill":1,"doorU":-0.25,"fire":null,"dens":2.5,"open":[["w","L",-0.06,6],["w","R",-0.02,6]],"p":[["f","piece_chest","R0.39","B0.13",0],["f","piece_chest","R0.4","B1.11",0],["f","piece_chest","R0.39","P0.08",0],["f","piece_chest","R0.39","P-0.08",0],["f","piece_chest","R0.35","F1.13",0],["f","piece_chest","R0.32","F0.12",0]],"id":"RT-0262"},{"kind":"home","W":14.5,"D":14,"fill":0.71,"doorU":0.1,"fire":[0.25,-0.12],"dens":1.67,"open":[["w","L",0.19,6],["w","F",5.4,6],["w","F",2.1,2],["d","F",0.1,2],["w","F",-1.9,2]],"p":[["f","piece_throne01","P-0.32","P-0.34",45],["f","piece_table_round","C0.27","P-0.19",90],["f","piece_bed02","C-0.06","P0.22",0],["f","hearth","C0.25","C-0.12",0],["f","piece_chair03","P-0.16","B0",135],["f","rug_wolf","P0.13","P0.25",337],["f","rug_deer","P-0.18","F0.8",157],["f","rug_fur","P0.03","F0.45",270],["f","rug_wolf","P-0.27","P-0.2",270],["f","rug_deer","L0.79","C0.03",45],["f","rug_deer","P0.28","P-0.22",22],["f","ArmorStand","P0.17","B0",225],["c","piece_chair03",1,-0.31,1.89,180,-0.01],["c","piece_chair03",1,-0.44,-1.95,0,-0.01],["c","rug_fur",2,-0.16,2.09,22,-0.05],["c","piece_chair03",1,1.47,-0.99,292,0.02],["c","piece_chair",3,1.41,2.32,157,0.03],["c","piece_chair03",1,1.34,0.89,224,-0.01],["c","piece_cauldron",3,-1.03,-0.44,11,0.58],["c","piece_cookingstation",3,0.61,-0.02,90,0.58],["c","piece_cookingstation",3,1.19,-0.15,90,0.58],["c","piece_cookingstation_iron",3,-0.05,0.61,0,0.58],["m","piece_walltorch","P-0.05","B0",2.11],["m","piece_walltorch","P0.06","B0",2.13],["m","itemstand","C-0.04","B0",2.25],["m","itemstand","R0","P0.37",2.37],["m","piece_banner04","P0.16","F0",2.94],["m","piece_banner04","P-0.15","F0",2.96],["m","itemstand","C0.21","B0",3.02],["m","itemstand","R0","P0.37",1.87],["m","itemstand","C-0.04","B0",1.85]],"id":"RT-0263"},{"kind":"home","W":14,"D":8,"fill":0.92,"doorU":0.08,"fire":null,"dens":1.84,"open":[["d","F",0.08,2]],"p":[["f","piece_table","C-0.14","C-0.08",270],["f","piece_throne01","R0.95","F0.58",304],["f","piece_table_round","R1.13","P0.17",282],["f","piece_bed02","P-0.32","B0.29",180],["f","piece_chest_blackmetal","P-0.28","F0.42",0],["f","piece_chair03","L0.67","F0.28",34],["f","rug_deer","P-0.09","C0.04",237],["f","rug_deer","L1.06","F0.5",315],["f","rug_wolf","P0.17","P0.15",225],["f","rug_deer","P0.28","P-0.16",282],["f","piece_chair","L0.48","B0.69",158],["f","piece_chair","P0.27","F0.61",282],["c","piece_chair03",2,-1.33,-1.13,45,-0.01],["c","piece_chair03",2,-1.35,1.25,123,-0.01],["c","piece_chair03",2,0.37,1.78,180,-0.01],["c","piece_chair02",0,0.29,1.08,203,0.09],["c","rug_fur",3,-1.4,0.56,0,-0.04],["m","piece_walltorch","L0","B1.16",1.81],["m","piece_walltorch","P0.29","F0",1.41],["m","piece_walltorch","L0","F1.09",1.92],["m","piece_walltorch","P0.3","B0",1.45],["h","piece_brazierceiling01","C0.12","C-0.2",90,2.78],["m","piece_banner02","P-0.28","F0",2.79],["m","piece_banner02","P-0.18","B0",2.83]],"id":"RT-0264"},{"kind":"home","W":14,"D":8,"fill":0.94,"doorU":0.01,"fire":null,"dens":1.9,"open":[["d","F",0.01,2]],"p":[["f","piece_bed02","L0.21","C0.3",90],["f","piece_table","P-0.17","F0.44",180],["f","piece_throne01","P0.31","F1.19",338],["f","piece_throne01","P0.35","P0.21",214],["f","piece_table_round","P0.26","C0.08",90],["f","piece_chair03","L0.51","F0.58",45],["f","rug_fur","C0.08","C-0.12",180],["f","rug_wolf","P-0.28","B0.07",90],["f","piece_chest_blackmetal","C0.03","B0.32",180],["f","piece_chest","P-0.21","C0.27",90],["f","rug_deer","P-0.29","F0.89",90],["f","piece_chair","L0.73","P-0.18",270],["f","piece_chair","L0.46","P0.25",316],["c","piece_chair03",4,0.11,1.88,180,-0.01],["c","piece_chair03",1,-0.18,-0.96,12,0.02],["c","piece_chair03",4,-1.54,-1.15,34,-0.01],["c","piece_chair03",4,-0.07,-1.96,0,-0.01],["c","piece_chair03",4,1.49,-1.44,338,-0.01],["h","piece_brazierceiling01","C-0.01","C0.07",90,2.78],["m","piece_banner01","R0","B0.6",2.81],["m","piece_banner01","L0","B0.41",2.84],["m","piece_banner01","R0","F0.64",2.89],["m","piece_banner01","L0","F0.9",2.99]],"id":"RT-0265"},{"kind":"storage","W":14,"D":12,"fill":0.79,"doorU":0.17,"fire":[-4.92,4.59],"dens":0.83,"open":[["d","F",0.17,2],["w","R",3.35,1.5],["w","L",3.35,1.5]],"p":[["f","hearth","L0.48","B0.41",180],["f","piece_chest_wood","R0.29","P-0.2",180],["f","piece_chest_wood","R0.28","P-0.1",180],["f","piece_chest_wood","R0.21","F0.41",180],["f","piece_chest_wood","R0.27","P-0.27",180],["f","piece_chest_wood","R0.23","P-0.37",180],["f","piece_chest_wood","R0.33","P0.22",180],["f","piece_chest_wood","R0.34","P0.13",180],["f","piece_chest_wood","R0.31","P-0.04",180],["f","piece_chest_wood","R0.31","P0.07",180],["f","piece_chest_wood","R0.38","P0.29",180]],"id":"RT-0266"},{"kind":"hall","W":6,"D":8,"fill":0.83,"doorU":0,"fire":[0.05,2.89],"dens":3.27,"open":[["w","R",2.96,2],["w","B",0.07,2],["w","L",2.98,2],["d","F",0,2]],"p":[["f","fire_pit","C0.05","B0.41",90],["f","piece_throne01","L0.25","F0.22",34],["f","piece_table_round","R0.52","P0.06",90],["f","piece_chair","L0.52","P-0.19",90],["f","rug_deer","L0.48","F0.56",293],["f","piece_chest","L0.5","P0.14",180],["f","piece_chest","R0.49","F0.22",0],["c","rug_wolf",2,0.75,-0.54,46,-0.03],["c","piece_chair03",2,1.76,-0.16,270,-0.01],["c","piece_chair03",2,0.89,-1.32,327,-0.01],["c","piece_cauldron",0,-0.11,0.07,90,0.2],["m","piece_walltorch","R0.96","B0",1.44],["m","piece_walltorch","L0.96","B0",1.48],["m","piece_banner02","R0","P-0.14",2.76],["m","piece_banner02","L0","P-0.12",2.76]],"id":"RT-0267"},{"kind":"hall","W":5.5,"D":7.5,"fill":0.81,"doorU":-0.07,"fire":[-0.01,2.82],"dens":3.91,"open":[["w","R",2.77,1.75],["w","B",0,1.5],["w","L",2.78,1.75],["d","F",-0.07,2]],"p":[["f","fire_pit","C-0.01","B0.23",90],["f","piece_throne01","L0","F0",34],["f","piece_table_round","R0.34","P0.06",90],["f","piece_chair","L0.21","P-0.21",90],["f","rug_deer","L0.17","F0.24",293],["f","piece_chest","L0.19","P0.14",180],["f","piece_chest","R0.3","F0",0],["c","rug_wolf",2,0.75,-0.54,45,-0.03],["c","piece_chair03",2,1.76,-0.16,270,-0.01],["c","piece_chair03",2,0.89,-1.32,327,-0.01],["c","piece_cauldron",0,-0.11,0.07,90,0.2],["m","piece_walltorch","R0.78","B0",1.44],["m","piece_walltorch","L0.64","B0",1.48],["m","piece_banner02","R0","P-0.16",2.76],["m","piece_banner02","L0","P-0.13",2.76]],"id":"RT-0268"},{"kind":"smithy","W":11,"D":6,"fill":0.9,"doorU":-2.5,"fire":[3.97,0.08],"dens":2.18,"open":[["w","R",2.32,1.5],["w","R",-2.18,1.5],["w","F",4.74,1.5],["w","B",4.96,1],["d","F",-2.5,2]],"p":[["f","hearth","R0.53","C0.08",90],["f","piece_table","P0.1","F0.3",180],["f","forge","L0.21","B0.24",90],["f","piece_workbench","L0.16","F0.75",90],["f","piece_chest_wood","P0.1","B0.36",90],["f","piece_chest_wood","P0.18","B0.39",90],["f","rug_wolf","P-0.25","C0.04",202],["f","rug_deer","P0.05","F1.13",146],["f","piece_chest","P-0.21","B0.24",180],["f","piece_chest","P-0.05","B0.25",180],["f","forge_ext2","P-0.35","F0.16",90],["c","forge_ext1",2,1.58,0.17,180,0.04],["c","piece_chair03",1,-0.41,-0.84,326,0.11],["c","piece_cookingstation_iron",0,-0.04,0.76,0,0.58],["c","piece_cauldron",0,-0.99,-0.43,11,0.58]],"id":"RT-0269"},{"kind":"smithy","W":10.5,"D":6,"fill":0.87,"doorU":-2.36,"fire":[4.11,-0.05],"dens":2.39,"open":[["w","R",-2.32,1.5],["w","R",2.18,1.5],["w","F",4.75,1.25],["w","B",4.97,0.75],["d","F",-2.36,2]],"p":[["f","hearth","R0.14","C-0.05",90],["f","piece_table","P0.12","F0.16",180],["f","forge","L0.1","B0.37",90],["f","piece_workbench","L0.05","F0.62",90],["f","piece_chest_wood","P0.11","B0.5",90],["f","piece_chest_wood","P0.2","B0.52",90],["f","rug_wolf","P-0.25","C-0.1",202],["f","rug_deer","P0.07","F0.99",146],["f","piece_chest","P-0.21","B0.38",180],["f","piece_chest","P-0.04","B0.39",180],["f","forge_ext2","L1.11","F0.02",90],["c","forge_ext1",2,1.58,0.17,180,0.04],["c","piece_chair03",1,-0.41,-0.84,326,0.11],["c","piece_cookingstation_iron",0,-0.04,0.76,0,0.58],["c","piece_cauldron",0,-0.99,-0.43,11,0.58]],"id":"RT-0270"},{"kind":"smithy","W":12,"D":14,"fill":0.93,"doorU":-0.1,"fire":[-0.22,-4.52],"dens":1.41,"open":[],"p":[["f","piece_table_oak","C-0.05","P0.16",0],["f","hearth","C-0.22","P-0.32",180],["f","piece_oven","P0.23","P-0.32",270],["f","piece_oven","P-0.27","P-0.32",270],["f","piece_preptable","L0","P-0.11",90],["f","forge_ext2","P0.32","B0.3",270],["f","piece_chest_blackmetal","L0.03","P0.17",180],["f","piece_chest_blackmetal","L0","P0.08",180],["f","piece_chest_blackmetal","L0","P0.27",180],["f","piece_groundtorch","P-0.35","P0.03",0],["f","piece_groundtorch","P-0.35","P0.33",0],["c","piece_chair03",0,0.75,-1.79,0,0.01],["c","piece_chair03",0,2.19,-1.74,0,0.01],["c","piece_chair03",0,-0.67,-1.72,0,0.01],["c","piece_chair03",0,-2.16,-1.6,0,0.01],["c","piece_chair03",0,-2.31,1.41,180,0.01],["c","piece_chair03",0,-0.85,1.44,180,0.01],["c","piece_chair03",0,0.81,1.47,180,0.01],["c","piece_chair03",0,2.38,1.49,180,0.01],["c","jute_carpet",0,-1.94,-0.19,0,0.02],["c","jute_carpet",0,1.71,-0.12,0,0.02],["c","piece_cookingstation",1,-0.68,0.19,90,0.58],["c","piece_cookingstation",1,-1.16,0.03,90,0.58],["c","piece_cauldron",1,0.9,-0.26,23,0.58]],"id":"RT-0271"},{"kind":"sleeping","W":4,"D":16.5,"fill":0.87,"doorU":0.04,"fire":null,"dens":1.39,"open":[["w","R",-3.27,8],["w","L",2.77,4],["d","L",6.77,2],["d","L",-3.23,2],["d","L",-6.23,2],["d","F",0.04,2]],"p":[["f","bed","R0","P0.06",180],["f","bed","R0","P-0.14",0],["f","piece_chest_wood","R0.44","P0.2",0],["f","ArmorStand","R0","P-0.3",180],["f","ArmorStand","R1.11","P-0.29",180],["f","ArmorStand","R0.18","P-0.38",270],["f","ArmorStand","R0.27","F0.25",270],["f","piece_groundtorch_wood","P0.12","P0.35",338]],"id":"RT-0272"},{"kind":"smithy","W":6,"D":4,"fill":1,"doorU":0,"fire":null,"dens":1.25,"open":[],"p":[["f","forge","L0.03","F0.8",90],["f","piece_workbench","L1.19","B0.24",180],["f","piece_groundtorch_wood","P0.14","B0.28",338]],"id":"RT-0273"},{"kind":"hall","W":15,"D":18,"fill":0.37,"doorU":1.65,"fire":[5.56,-7.5],"dens":1.19,"open":[["d","F",1.52,1.75],["w","F",0.27,0.75],["w","B",6.82,1.5],["w","B",4.32,1.5],["w","F",6.82,1.5],["w","F",4.32,1.5],["w","L",8.6,1],["w","L",5.6,1],["w","R",8.6,1],["w","R",5.6,1]],"p":[["f","hearth","R0.34","F0.5",0],["f","piece_chair","P0.28","P0.13",270],["f","piece_bench01","P-0.22","B0.08",180],["f","piece_bench01","P0.28","C0.16",90],["f","piece_bench01","P-0.23","P0.31",0],["f","jute_carpet","R0.9","P-0.26",180],["f","piece_chair03","R0","P-0.22",226],["f","piece_chair03","P0.28","P-0.22",135],["f","jute_carpet","R0.94","P-0.22",180],["m","piece_walltorch","L0","P0.32",2.22],["m","piece_walltorch","L0","P0.31",2.3],["m","piece_walltorch","L0","P0.26",2.37],["m","piece_walltorch","L0","B0.25",2.37],["m","piece_banner02","P0.08","B0",3.42]],"id":"RT-0274"},{"kind":"living","W":9.5,"D":10,"fill":0.63,"doorU":0.14,"fire":null,"dens":1.67,"open":[["w","B",1.83,1.25],["w","B",-0.3,1],["w","F",3.48,1.75],["w","R",-0.58,1],["w","B",0.43,1],["w","F",-0.93,1],["w","B",0.88,1],["w","F",-0.55,1],["w","L",0.4,1],["w","F",0.18,1],["w","F",-1.23,0.25],["w","F",-3.86,2.5],["w","R",-2.41,1],["w","B",-3.8,4],["w","B",4.27,1.5]],"p":[["f","piece_table_round","L0.86","F1.13",135],["c","piece_chair03",0,-0.91,1.1,135,-0.01],["c","piece_chair03",0,-0.94,-1.29,45,-0.01],["c","itemstandh",0,0.62,0.05,181,0.8],["c","itemstandh",0,-0.22,0.79,338,0.8],["c","itemstandh",0,-0.32,0.65,338,0.8],["c","itemstandh",0,-0.46,0.69,338,0.8],["c","itemstandh",0,-0.29,-0.79,315,0.8],["c","itemstandh",0,-0.77,0.35,23,0.8],["c","itemstandh",0,-0.7,-0.56,315,0.8],["m","itemstand","P0.29","B0",2.03],["m","itemstand","R0.98","B0",2.03],["m","itemstand","P0.27","B0",2.03],["m","itemstand","P0.34","B0",2.03],["m","itemstand","P0.31","B0",2.04],["m","piece_dvergr_lantern","P0.17","B0",2.69],["m","piece_dvergr_lantern","P-0.31","F0",3.69]],"id":"RT-0275"},{"kind":"smithy","W":6,"D":7.5,"fill":0.5,"doorU":-1.5,"fire":null,"dens":6.22,"open":[["w","F",0,2],["w","R",1.94,3.5],["w","L",0.94,1.5],["w","B",2,2],["w","F",1.25,1.5],["w","F",2.25,1.5],["d","F",0,2]],"p":[["f","piece_workbench_ext3","L0.12","P0.07",90],["f","piece_chest","P-0.08","C-0.22",270],["f","piece_chest","P0.07","C-0.22",90],["f","piece_chest","P-0.08","P0.16",270],["f","piece_chest","P0.08","P0.16",90],["f","piece_chest","P0.07","F0",90],["f","piece_chest","P-0.08","F0",270],["f","piece_chest","P-0.08","P-0.22",270],["f","forge_ext2","R0.61","B0.01",0],["m","itemstand","P-0.24","F0",2.78],["m","itemstand","L0.61","F0",3.23],["m","piece_banner05","R0.53","B0",3.73],["m","piece_banner05","R0","B0.43",3.76],["m","piece_banner04","R0","B0.31",4.01]],"id":"RT-0276"},{"kind":"smithy","W":4.5,"D":7.5,"fill":0.79,"doorU":-0.75,"fire":null,"dens":4.15,"open":[["w","L",-1.94,3.5],["w","L",-2.93,1.75],["w","R",-2.93,1.75],["w","L",-1.06,2],["w","R",-1.06,2],["d","F",-0.75,2]],"p":[["f","forge","R0","P-0.16",270],["f","rug_deer","R0.39","B0",270],["c","forge_ext4",0,1.87,0.28,90,-0.14],["c","forge_ext3",0,-2.29,0.61,180,-0.09],["m","piece_walltorch","R0.28","F0",1.35],["m","itemstand","R0","F0.31",1.89],["m","itemstand","R0","F0.91",1.94],["m","itemstand","R0.78","F0",2.07],["m","itemstand","L0","P0.12",2.2],["m","piece_banner05","L0","P0.12",2.72],["m","piece_banner05","R0.53","B0",2.73],["m","piece_banner05","R0","B0.43",2.76]],"id":"RT-0277"},{"kind":"hall","W":6,"D":7.5,"fill":0.72,"doorU":2,"fire":[0,2.56],"dens":2.46,"open":[["w","B",2.25,1.5],["w","B",-2.25,1.5],["w","L",2.93,1.75],["w","R",2.93,1.75],["w","L",-2.82,1.75],["w","R",-2.82,1.75],["w","F",0,2]],"p":[["f","hearth","C0","B0.19",180],["f","piece_table","L0.29","C-0.26",90],["f","piece_throne01","C-0.01","F0",0],["f","piece_chair","C0","F1.15",0],["f","rug_deer","C0.16","P-0.06",180],["f","ArmorStand","R0.2","C0.22",248],["c","piece_chair02",1,-0.29,0.76,158,0.04],["c","piece_cookingstation_iron",0,0.01,-0.55,180,0.58],["c","piece_cauldron",0,-0.01,0.52,90,0.58],["c","itemstandh",1,-0.7,0.26,113,0.82],["c","itemstandh",1,-0.23,0.28,180,0.82],["c","itemstandh",1,0.21,0.16,202,0.82],["c","itemstandh",1,0.73,-0.03,113,0.82]],"stair":1,"id":"RT-0278"},{"kind":"storage","W":10,"D":8,"fill":0.4,"doorU":-2,"fire":null,"dens":1.25,"open":[],"p":[["f","piece_chest_blackmetal","C0","B0.84",180],["f","piece_chest_blackmetal","P0.2","B0.84",180],["f","piece_chest_blackmetal","R0.17","B0.85",180],["f","piece_chest_blackmetal","P-0.2","B0.85",180]],"stair":1,"id":"RT-0279"},{"kind":"living","W":8,"D":6,"fill":0.92,"doorU":3,"fire":null,"dens":3.86,"open":[["w","B",0.5,2],["w","R",0,6],["d","F",3,2]],"p":[["f","piece_table","L0.41","B0.5",90],["f","piece_table","L0.4","F0.31",90],["f","rug_fur","L0.96","F0.19",270],["f","rug_fur","L0.99","B0.62",0],["f","rug_fur","R0.81","F0.25",270],["f","ArmorStand","P-0.14","F0.24",0],["f","ArmorStand","P0.1","F0.26",0],["f","piece_groundtorch_mist","P0.26","C-0.01",0],["f","piece_groundtorch_mist","P-0.13","C0.13",0],["m","itemstand","P-0.22","F0",1.91],["m","itemstand","P0.13","F0",1.92],["m","itemstand","P0.07","F0",1.92],["m","itemstand","P-0.17","F0",1.92],["m","itemstand","C0.09","F0",1.92],["m","itemstand","P-0.11","F0",1.92],["m","itemstand","P-0.05","F0",1.92],["m","itemstand","P0.19","F0",1.92],["m","piece_banner02","R1.03","F0",2.95],["m","piece_banner02","R0","F0",2.95],["m","sign","R0.42","F0",3.02]],"id":"RT-0280"},{"kind":"storage","W":8,"D":6,"fill":1,"doorU":-3,"fire":null,"dens":1.67,"open":[["d","F",-3,2],["d","L",0,6]],"p":[["f","piece_table","P-0.13","F0.26",180],["f","piece_chest_blackmetal","P-0.13","B1.04",180],["f","piece_chest_blackmetal","P0.12","B1.04",180],["f","piece_chest_blackmetal","R1.05","F0.38",270],["f","piece_chest_blackmetal","R1.05","C0.04",270],["c","itemstandh",0,0.92,0.09,45,0.82],["c","itemstandh",0,0.45,0.19,247,0.82],["c","itemstandh",0,0.04,0.25,90,0.82],["c","itemstandh",0,-0.35,0.17,45,0.82],["c","itemstandh",0,-0.82,0.13,45,0.82],["m","sign","L0.52","F0",2.97],["m","piece_banner05","L0.03","F0",2.98],["m","piece_banner05","L1.16","F0",2.99]],"id":"RT-0281"},{"kind":"sleeping","W":6,"D":5.5,"fill":0.57,"doorU":-1.43,"fire":null,"dens":2.13,"open":[["w","F",1.58,2.25],["w","B",0.5,1],["w","B",2.62,1],["d","F",-2.63,2],["w","L",1.37,3.75]],"p":[["f","piece_table_round","R0.95","F0.43",0],["f","ashwood_bed","L0","B0.26",203],["f","jute_carpet","L0.58","F0",315],["c","Candle_resin",0,-0.15,0,0,0.87],["m","darkwood_wolf","L0","F0",3],["m","wood_dragon1","L0","F0",4]],"id":"RT-0284"},{"kind":"workshop","W":8,"D":12,"fill":0.73,"doorU":-3,"fire":null,"dens":1,"open":[["d","F",-1.25,2]],"p":[["f","piece_workbench","R0.49","P-0.23",270],["f","piece_table_round","L0.68","P0.25",180],["f","piece_throne01","P-0.15","B0.56",180],["f","piece_chest_blackmetal","P0.18","F0.96",0],["f","piece_chest_blackmetal","P0.23","P-0.23",90],["f","piece_groundtorch_mist","P-0.13","B0.12",180],["m","piece_dvergr_lantern","P0.14","F0",3.86],["c","itemstandh",1,-0.67,0.49,90,0.8]],"id":"RT-0287"},{"kind":"other","W":5.5,"D":6,"fill":0.75,"doorU":-1.88,"fire":null,"dens":4.44,"open":[["w","R",2.7,0.5],["w","R",1.32,0.25],["w","F",1.12,0.5],["w","F",2.62,0.5],["w","R",0.46,5]],"p":[["f","piece_chest_blackmetal","R0.47","F0.61",0],["f","piece_chest","R0.15","B0.25",270],["f","ArmorStand","P0.19","B0",180],["f","ArmorStand","C-0.32","B0",180],["f","ArmorStand","L0.72","B0",180],["m","piece_dvergr_lantern","R0","F1.19",2.38],["m","itemstand","P-0.21","F0",3.74],["m","itemstand","L0.24","F0",3.63],["m","itemstand","P-0.2","B0",3.77],["m","itemstand","C0.05","B0",3.78],["m","itemstand","L0.21","B0",3.75]],"id":"RT-0288"},{"kind":"workshop","W":8,"D":9.5,"fill":0.97,"doorU":-3.01,"fire":null,"dens":2.57,"open":[["d","L",-1.91,2],["w","R",-2.91,3.5],["w","R",3.08,3.5],["w","L",-2.79,3.75],["w","L",2.95,3.75],["d","F",-3.01,2],["w","R",-1.44,1],["d","R",0.06,2],["w","R",1.56,1]],"p":[["f","piece_artisanstation","L0.7","B0.09",180],["f","piece_chest_wood","P-0.08","B0.19",270],["f","piece_chest_wood","P-0.08","P0.23",270],["f","rug_deer","R0.68","F0.48",225],["f","rug_wolf","R0.4","B0.61",214],["f","piece_chest_wood","P-0.09","F0.52",270],["f","piece_chest_wood","P-0.08","P-0.19",270],["m","piece_banner02","P0.12","F0",3.04],["m","itemstand","R0","P0.18",2.1],["m","itemstand","P0.12","F0",2.02],["m","piece_walltorch","R0","F0.06",2.24],["m","itemstand","R0","P0.27",2.08],["m","itemstand","R0.97","F0",1.99],["m","itemstand","L0","B1.1",1.98],["m","itemstand","L0","P0.27",2.01],["m","itemstand","L0","P0.2",2.03],["m","itemstand","L0","P0.12",2.02],["m","itemstand","L0","P0.04",2.02],["m","itemstand","L0","P-0.04",2.03],["m","piece_banner02","P-0.1","F0",3.06],["m","itemstand","R0","B0.99",2.08]],"id":"RT-0289"},{"kind":"storage","W":2,"D":8,"fill":1,"doorU":0,"fire":null,"dens":3.75,"open":[],"p":[["f","piece_chest","R0.27","B0.25",180],["f","piece_chest","R0.26","P0.28",180],["f","piece_chest","R0.23","P0.15",180],["f","piece_chest","R0.21","C0.07",180],["f","piece_chest","L0.27","P-0.12",180],["f","piece_chest","L0.28","P-0.25",180]],"id":"RT-0290"},{"kind":"storage","W":7,"D":8,"fill":0.89,"doorU":0,"fire":null,"dens":2.81,"open":[["w","L",2.16,2],["w","L",-1.84,2]],"p":[["f","piece_chest_wood","L0.23","P0.17",0],["f","piece_chest_wood","L0.26","P0.26",0],["f","piece_chest_wood","L0.28","B0.69",0],["f","piece_chest_wood","L0.21","P0.07",0],["f","piece_chest_wood","L0.2","C-0.3",0],["f","piece_chest_wood","L0.18","P-0.23",0],["f","piece_chest_wood","L0.17","F0.98",0],["f","piece_chest_wood","L0.22","P-0.13",0],["f","piece_chest","C-0.34","B1.2",270],["f","piece_chest","P0.1","P0.25",270],["f","piece_chest","P-0.06","P-0.23",270],["f","piece_chest_wood","P0.07","P-0.25",270],["f","piece_chest","P0.22","P-0.25",270],["f","piece_chest","R0.46","P-0.25",270]],"id":"RT-0291"},{"kind":"kitchen","W":7,"D":15,"fill":0.64,"doorU":-1.13,"fire":null,"dens":1.49,"open":[["w","B",2.12,3],["w","R",3.09,8.75],["w","L",5.63,3.75],["w","B",-1.31,3.5]],"p":[["f","piece_table","L0.48","P-0.31",270],["f","piece_chest_wood","L0.41","P-0.15",90],["f","piece_chest_wood","L0.26","C-0.32",90],["f","piece_chest_wood","L0.2","P0.11",90],["f","piece_oven","P0.08","F0.92",270],["f","fermenter","P-0.06","B0.13",180],["f","fermenter","L0.65","B0.22",180],["c","itemstandh",0,-0.93,-0.08,90,0.81],["c","itemstandh",0,-0.92,0.33,0,0.81],["c","itemstandh",0,-0.42,-0.12,90,0.81],["c","itemstandh",0,-0.41,0.29,90,0.81],["c","itemstandh",0,0.02,-0.12,90,0.81],["c","itemstandh",0,0.04,0.27,90,0.81],["c","itemstandh",0,0.47,-0.15,90,0.81],["c","itemstandh",0,0.49,0.24,90,0.81],["c","itemstandh",0,0.93,-0.16,90,0.81],["c","itemstandh",0,0.97,0.22,90,0.81],["m","sign","L0","P-0.15",2.44],["m","sign","L0","C-0.21",2.44],["m","sign","L0","P0.11",2.47]],"id":"RT-0292"},{"kind":"storage","W":9.5,"D":4,"fill":0.5,"doorU":-1.36,"fire":null,"dens":3.16,"open":[["w","B",0.85,5.75]],"p":[["f","piece_chest_wood","R0.75","F0.26",270],["f","piece_chest_wood","L0.54","F0.63",90],["f","piece_chest_wood","R0.65","B0.14",270],["m","itemstand","P-0.23","B0",2.06],["m","itemstand","P-0.3","B0",2.07],["m","itemstand","L0.94","B0",2.07]],"stair":1,"id":"RT-0293"},{"kind":"storage","W":5,"D":7.5,"fill":0.49,"doorU":-0.79,"fire":null,"dens":1.62,"open":[],"p":[["f","piece_chest_wood","R0.28","F0.32",0],["f","piece_chest_wood","L0.64","C0.18",90],["f","piece_chest_wood","L0.9","P-0.22",90]],"id":"RT-0294"},{"kind":"home","W":11,"D":7.5,"fill":0.64,"doorU":-0.52,"fire":[3.47,-2.36],"dens":2.27,"open":[["w","R",0.32,1],["w","R",2.32,1],["d","F",-0.52,2],["w","F",1.36,1.75],["w","R",0.78,6],["w","R",-2.48,1.75],["w","B",1.89,7],["w","R",1.28,2]],"p":[["f","hearth","R0.43","F0.39",180],["f","piece_throne01","R0.22","B0.16",203],["f","piece_bed02","L0","F0.89",90],["f","piece_chair","P0.28","B0.4",180],["f","rug_fur","P0.28","B0.4",180],["f","rug_fur","R0.55","C-0.29",270],["f","rug_fur","P-0.27","F0.52",180],["f","piece_chair02","P0.18","B0.31",158],["c","rug_fur",1,-0.28,1.07,337,-0.02],["c","rug_fur",2,-0.18,0.98,90,-0.07],["c","piece_chair02",0,-1.34,-2.04,135,0.02],["c","piece_chair02",0,1.15,-2.18,270,0.02],["m","piece_walltorch","L1.02","F0",2.42],["m","piece_banner01","R0.41","B0",2.43],["m","piece_banner01","L0","P0.1",2.87],["m","piece_banner01","L0.91","B0",3.41],["h","piece_brazierceiling01","P-0.16","P0.18",270,3.94]],"id":"RT-0295"},{"kind":"sleeping","W":11.5,"D":10,"fill":0.72,"doorU":-4.04,"fire":null,"dens":0.85,"open":[["w","R",-4.44,1.25],["w","L",-4.42,1.25],["w","R",3.57,3],["w","B",-4.31,2.75],["w","B",-3.93,2],["d","F",-4.04,1.5]],"p":[["f","bed","R0.49","F1.07",270],["f","piece_bench01","C-0.14","P0.25",180],["f","jute_carpet","L0.94","F0.11",0],["f","jute_carpet","C-0.32","P-0.07",0],["f","jute_carpet","L0.64","B0",0],["f","piece_chest","R0.04","B0.02",180],["f","piece_chest","P0.24","B0.59",90],["m","piece_walltorch","R0","C0.01",3.21],["m","piece_walltorch","P0.34","F0",3.34],["m","piece_walltorch","L0","C0.07",3.38]],"id":"RT-0296"},{"kind":"home","W":9.5,"D":7.5,"fill":0.82,"doorU":-2.14,"fire":null,"dens":1.37,"open":[["d","F",-2.14,2],["w","B",-3.56,2],["w","L",2.89,1.75],["d","F",3.77,1.75]],"p":[["f","piece_workbench","P0.06","F0.2",0],["f","bed","C-0.13","B0.24",180],["f","piece_bench01","L0.31","F0.98",90],["f","piece_bench01","R0.69","B0",180],["f","piece_chest_wood","P-0.16","B0",180],["c","piece_workbench_ext1",0,1.8,-0.62,90,0.01],["m","piece_walltorch","C0.07","B0",2.85],["m","piece_banner05","L0","F0.56",4.18]],"id":"RT-0297"},{"kind":"storage","W":9,"D":9.5,"fill":0.82,"doorU":1,"fire":null,"dens":0.99,"open":[["w","B",-0.5,3],["w","B",-3.77,3],["w","B",3.06,3],["w","L",-0.42,3],["w","R",0.58,3],["w","F",-3.06,3],["w","F",3.77,3],["d","F",0,4]],"p":[["f","piece_chest","L0.96","B1.09",135],["f","piece_chest","R0.92","P0.29",225],["f","piece_chest","R0.91","P-0.28",315],["f","piece_chest","L0.94","P-0.29",45],["m","sign","R0","C0.08",1.38],["m","sign","C0.02","B0",1.45],["m","sign","L0","C0.08",1.46]],"id":"RT-0298"},{"kind":"storage","W":4,"D":2,"fill":1,"doorU":-1,"fire":null,"dens":5,"open":[["w","F",0,4]],"p":[["f","piece_chest_wood","L0.29","B0.3",90],["f","piece_chest_wood","R1.09","B0.27",90],["f","piece_chest_wood","L1.1","F0.32",90],["f","piece_chest_wood","R0.3","B0.31",90]],"stair":1,"id":"RT-0299"},{"kind":"storage","W":8,"D":2,"fill":1,"doorU":1,"fire":null,"dens":2.5,"open":[["d","F",0,4]],"p":[["f","piece_chest_wood","L0.35","B0.22",0],["f","piece_chest_wood","R0.45","B0.19",0],["f","piece_chest_wood","L0.41","F0.17",0],["f","piece_chest_wood","R0.47","F0.24",0]],"id":"RT-0300"},{"kind":"storage","W":4,"D":4,"fill":1,"doorU":0,"fire":null,"dens":2.5,"open":[],"p":[["f","piece_chest_wood","L0.32","B0.6",90],["f","piece_chest_wood","L1","B0.57",90],["f","piece_chest_wood","R0.24","B0.54",90],["f","piece_chest_wood","R0.98","B0.46",90]],"id":"RT-0301"},{"kind":"other","W":4.5,"D":16,"fill":0.82,"doorU":-0.14,"fire":null,"dens":0.85,"open":[["w","R",-6.8,2],["d","R",0,4],["w","L",-6.71,0.75],["w","L",6.62,0.75],["w","B",0.48,3.75],["w","F",0.61,3.5]],"p":[["f","jute_carpet","R0.75","B0.98",0],["f","jute_carpet","R0.65","P0.16",0],["f","jute_carpet","R0.58","C-0.25",0],["f","jute_carpet","R0.64","F0.93",0],["f","piece_chest","L0","P-0.34",90],["f","piece_chest","L0","P0.34",90],["m","piece_dvergr_lantern","R0","P0.12",2.99],["m","piece_dvergr_lantern","R0","P0.12",3.99],["m","itemstand","R0","C-0.07",4.19]],"id":"RT-0302"},{"kind":"other","W":8,"D":8,"fill":0.8,"doorU":0,"fire":null,"dens":2.35,"open":[],"p":[["f","piece_groundtorch","L0.3","B0.39",315],["f","piece_groundtorch","R0.49","B0.3",315],["f","piece_groundtorch","L0.44","F0.42",315],["f","piece_groundtorch","R0.25","F0.59",315],["m","piece_dvergr_lantern","L0","P-0.25",0.59],["m","piece_dvergr_lantern","L0","P0.25",0.59],["m","piece_dvergr_lantern","P-0.25","F0",0.59],["m","piece_dvergr_lantern","P-0.25","B0",0.59],["m","piece_dvergr_lantern","P0.25","F0",0.59],["m","piece_dvergr_lantern","P0.25","B0",0.59],["m","piece_dvergr_lantern","R0","P-0.25",0.59],["m","piece_dvergr_lantern","R0","P0.25",0.59]],"id":"RT-0303"},{"kind":"storage","W":10,"D":16,"fill":0.75,"doorU":-0.45,"fire":null,"dens":1.08,"open":[["w","F",-0.95,2]],"p":[["f","piece_chest","P-0.2","B0.2",180],["f","piece_chest","C0.04","B0.16",180],["f","piece_chest","L0.37","B0.21",180],["f","piece_chest","P0.21","B0.16",180],["f","piece_chest","R0.39","B0.34",180],["f","piece_chest","L0.48","P-0.19",90],["f","piece_chest","R0.48","P-0.18",270],["f","piece_chest","L0.5","P-0.3",90],["f","piece_chest","R0.38","P-0.3",270],["f","piece_chest","P-0.17","F0.66",0],["f","piece_chest","C0.31","F0.69",0],["f","piece_chest","P0.22","F0.67",0],["m","piece_walltorch","C0.04","F0",1.6]],"id":"RT-0304"},{"kind":"other","W":20,"D":7.5,"fill":0.47,"doorU":0.99,"fire":null,"dens":1.83,"open":[["w","B",-3.93,2],["w","B",-7.93,2],["w","F",7.49,1],["w","F",3.99,2],["w","L",2.1,2],["w","L",-1.53,1.25],["w","F",-8.77,2.25],["w","L",-3.03,1.5],["d","F",0.91,2],["d","F",-1.01,2]],"p":[["f","piece_chest","L0.24","P0.05",90],["f","piece_chest","L0.24","P-0.18",90],["m","itemstand","P-0.14","B0",1.28],["m","itemstand","P-0.13","B0",1.28],["m","itemstand","P-0.17","B0",1.28],["m","itemstand","P-0.19","B0",1.28],["m","itemstand","P-0.22","B0",1.28],["m","itemstand","P-0.23","B0",1.28],["m","itemstand","P-0.15","B0",2.75],["m","itemstand","P-0.15","F0",2.89],["m","itemstand","P0.13","F0",3.43],["m","itemstand","P0.33","F0",3.49],["m","itemstand","P-0.15","F0",3.72]],"id":"RT-0305"},{"kind":"other","W":2,"D":8,"fill":0.48,"doorU":0,"fire":null,"dens":5.16,"open":[["w","L",0.33,1.5],["w","L",2.07,2],["w","L",-1.93,2],["w","B",-0.62,0.75],["w","F",-0.64,0.75]],"p":[["f","piece_chest","L0.46","C0.07",90],["f","piece_groundtorch","R0.55","P0.21",270],["f","piece_groundtorch","R0.58","P-0.18",270],["m","itemstand","L0","C0.07",2.91]],"id":"RT-0306"},{"kind":"home","W":11.5,"D":10,"fill":0.73,"doorU":0.81,"fire":null,"dens":2.14,"open":[["w","F",-5.58,0.5],["w","F",-0.34,1.5],["d","F",0.81,2]],"p":[["f","piece_table_oak","P0.04","P-0.1",180],["f","ashwood_bed","C0.3","B0",180],["f","piece_chair","P0.16","B0.01",0],["f","piece_chair","P-0.11","B0",0],["f","piece_chest_barrel","R0.13","F0.47",0],["f","piece_chest_barrel","R0.25","P-0.33",0],["f","jute_carpet","C0.3","P0.1",180],["f","piece_chest_barrel","R0.97","F0.46",0],["f","piece_bench01","L1.01","F0.49",90],["c","piece_chair03",0,2.22,0.82,180,0.01],["c","piece_chair03",0,2.26,-0.82,0,0.01],["c","piece_chair03",0,-0.33,0.89,180,0.01],["c","piece_chair03",0,0.88,0.83,180,0.01],["c","piece_chair03",0,-1.82,0.86,180,0.01],["c","piece_chair03",0,-1.84,-0.91,0,0.01],["c","piece_chair03",0,0.93,-0.87,0,0.03],["c","piece_chair03",0,-0.34,-0.94,0,0.03],["c","Candle_resin",0,0.39,0.08,152,0.81],["c","Candle_resin",0,-1.21,-0.04,152,0.81],["m","piece_dvergr_lantern","P-0.11","F0",1.92],["m","piece_dvergr_lantern","P0.24","F0",1.96]],"id":"RT-0307"},{"kind":"hall","W":13.5,"D":16,"fill":0.77,"doorU":1.04,"fire":[-2.46,-0.02],"dens":1.27,"open":[["w","F",-1.96,1],["w","R",-1.02,1],["w","R",0.98,1],["w","R",3.98,1],["w","R",5.98,1],["w","R",7.48,1],["w","L",-1.02,1],["w","L",0.98,1],["w","L",3.98,1],["w","L",5.98,1],["w","L",7.48,1],["w","R",-2.52,1],["w","L",-2.52,1],["w","L",2.48,1]],"p":[["f","hearth","P-0.18","C-0.02",270],["f","piece_table_round","P0.24","C-0.06",135],["f","piece_oven","P-0.18","P-0.25",0],["f","piece_oven","P-0.18","P-0.38",0],["c","piece_chair03",1,-1.51,-0.12,90,-0.01],["c","piece_chair03",1,0.13,1.47,180,-0.01],["c","piece_chair03",1,-0.93,-1.11,45,-0.01],["c","piece_chair03",1,1.15,0.92,225,-0.01],["c","piece_chair03",1,0.05,-1.45,0,-0.01],["c","piece_chair03",1,1.56,-0.05,270,-0.01],["c","piece_cookingstation_iron",0,-0.07,-0.21,180,0.58],["c","piece_cauldron",0,-0.63,-0.42,90,0.58],["c","itemstandh",1,-0.66,-0.69,135,0.8],["c","itemstandh",1,0.63,0.53,315,0.8],["c","itemstandh",1,0.02,-0.81,90,0.8],["c","itemstandh",1,0.79,-0.07,0,0.8],["c","Candle_resin",1,-0.12,0.05,45,0.82],["m","piece_walltorch","L0","P0.16",1.86],["m","piece_walltorch","L0","P-0.16",1.92],["m","piece_dvergr_lantern","R0","P-0.38",3.59],["m","piece_dvergr_lantern","P0.37","F0",3.59],["m","piece_dvergr_lantern","P0.37","B0",3.59],["m","piece_dvergr_lantern","P0.23","B0",3.59],["m","piece_dvergr_lantern","P0.23","F0",3.59],["m","piece_dvergr_lantern","P0.08","B0",3.59],["m","piece_dvergr_lantern","P0.08","F0",3.59]],"id":"RT-0308"},{"kind":"other","W":8.5,"D":9,"fill":0.24,"doorU":2.51,"fire":null,"dens":2.7,"open":[["w","B",2.26,2],["w","R",0.35,4.5],["w","B",3.51,1.5],["w","B",-2.49,3.5]],"p":[["f","piece_chest","P0.1","B0",90],["f","piece_chest","C-0.21","B0",90],["m","sign","C-0.19","B0",0.99],["m","sign","P0.09","B0",1],["m","piece_banner04","R0","F0",1.8]],"id":"RT-0309"},{"kind":"home","W":12,"D":14,"fill":0.75,"doorU":-3.07,"fire":null,"dens":1.42,"open":[["w","B",1.95,4],["w","F",1.95,4],["w","L",-4.96,2],["w","R",-1.96,2],["w","R",-4.96,2],["w","F",4.68,1.5],["w","R",4.07,2],["w","L",5.83,2.5],["w","L",2.34,1.5],["w","F",3.67,1.25],["w","B",3.17,1.75],["d","L",3.07,4],["w","L",-2.93,4],["w","F",-1.07,2],["d","F",-3.07,2],["w","B",4.68,1.5],["w","B",-2.57,7],["w","F",4.68,1.5],["w","L",0.05,2],["w","L",-5.9,2],["w","F",-5.11,2],["w","B",-5.06,2],["w","F",-5.06,2]],"p":[["f","piece_workbench","L0.06","P-0.21",90],["f","piece_table","P-0.26","B0.23",0],["f","piece_table","P-0.26","P0.38",180],["f","bed","R0.39","P0.15",270],["f","bed","R0.32","B0.27",270],["f","piece_chest_wood","L0.4","P-0.09",180],["f","piece_chest_wood","L0.42","P-0.33",0],["f","rug_deer","P-0.16","P-0.25",202],["f","rug_deer","L0","P0.21",202],["f","rug_deer","P-0.17","P0.03",157],["f","rug_deer","P0.06","C0.23",0],["f","rug_deer","L0.4","P-0.2",23],["f","rug_deer","P0.27","P-0.22",180],["f","rug_deer","P0.27","C-0.02",90],["f","rug_deer","C-0.18","P0.28",247],["f","rug_deer","R0.71","P0.29",90],["f","piece_groundtorch_wood","P-0.34","P-0.34",180],["c","piece_chair",2,-2.07,0.21,113,-0.05],["c","piece_chair02",1,-2,-0.19,113,0.04],["c","piece_chair02",1,1.88,0.02,225,0.04],["c","itemstandh",1,0.53,0.08,315,0.82],["c","itemstandh",1,-0.65,-0.42,315,0.82],["c","itemstandh",2,-0.69,0.07,202,0.82],["m","itemstand","P0.08","F0",1.5],["m","itemstand","P0.11","B0",2.1],["m","itemstand","P-0.05","B0",2.32],["m","itemstand","P0.04","B0",2.75],["m","itemstand","L0","P0.22",3.4],["m","piece_walltorch","L0","P0.22",3.42],["m","itemstand","L0","P-0.21",3.43]],"id":"RT-0310"},{"kind":"other","W":4,"D":5.5,"fill":0.73,"doorU":-1.22,"fire":null,"dens":3.13,"open":[["w","F",0.93,2],["w","R",0.93,3.5],["w","B",-0.32,3.5]],"p":[["f","rug_deer","L0.45","B0.28",203],["f","piece_logbench01","L0.23","P0.13",270],["f","piece_groundtorch_wood","L0.56","B0.65",270],["m","itemstand","L0","B1.01",1.66],["m","itemstand","L0","C-0.09",1.66],["m","itemstand","L0","P0.12",2.15]],"id":"RT-0311"},{"kind":"storage","W":5,"D":3,"fill":0.77,"doorU":0.5,"fire":null,"dens":2.61,"open":[],"p":[["f","piece_chest_wood","P-0.16","B0.19",270],["f","piece_chest_wood","C-0.06","B0.19",270],["f","piece_chest_wood","L0.63","B0.19",270]],"id":"RT-0312"},{"kind":"smithy","W":8,"D":9.5,"fill":0.78,"doorU":0.96,"fire":null,"dens":1.52,"open":[["w","R",0.78,4],["d","F",-0.04,4],["w","B",-3.02,2],["w","B",3.48,1],["w","R",4.03,1.5],["w","L",4.05,1.5]],"p":[["f","forge","L0.24","F0.11",0],["f","piece_table","P0.16","C-0.04",270],["f","ArmorStand","L0","P-0.22",270],["f","ArmorStand","L0","P-0.31",248],["f","piece_chest","L1.13","B0.27",90],["f","piece_chest","P0.27","B0.28",270],["c","piece_chair02",1,-1.75,0.05,68,0.04],["c","piece_chair03",1,0.78,0.91,225,0.02],["m","piece_dvergr_lantern","R0","F0",1.59]],"id":"RT-0313"},{"kind":"temple","W":5.5,"D":5.5,"fill":0.89,"doorU":-0.62,"fire":null,"dens":2.22,"open":[["d","F",0.88,2],["w","L",-0.25,3],["w","L",1.71,1],["w","R",-0.25,3],["w","R",1.71,1],["w","B",-2.38,1],["w","B",2.15,1],["w","B",-1.57,1],["w","B",-0.11,2],["w","B",1.33,1]],"p":[["f","piece_bench01","L0.39","F0.25",90],["f","piece_bench01","R0.04","F0.93",0],["f","piece_chair02","L0.28","P0.17",22],["f","piece_chair02","P-0.16","P0.19",338],["f","piece_chair","L0.81","B0.59",338],["m","piece_dvergr_lantern","C-0.12","F0",3.4]],"id":"RT-0314"},{"kind":"storage","W":6,"D":2,"fill":0.96,"doorU":-1.48,"fire":null,"dens":5.22,"open":[],"p":[["f","piece_chest_wood","L0.24","B0.13",270],["f","piece_chest_wood","P-0.06","B0.15",270],["f","piece_chest_wood","R1.02","B0.16",270],["f","piece_chest_wood","L1.07","B0.17",270],["f","piece_chest_wood","P0.06","B0.15",270],["f","piece_chest_wood","R0.21","B0.11",270]],"stair":1,"id":"RT-0315"},{"kind":"storage","W":6,"D":2,"fill":0.96,"doorU":-1.48,"fire":null,"dens":4.35,"open":[["w","F",-0.97,4]],"p":[["f","piece_chest_wood","L0.22","B0.25",270],["f","piece_chest_wood","P-0.08","B0.17",270],["f","piece_chest_wood","R0.83","B0.14",270],["f","piece_chest_wood","L0.99","B0.28",270],["f","piece_chest_wood","C0.31","B0.18",270]],"stair":1,"id":"RT-0316"},{"kind":"sleeping","W":9.5,"D":4,"fill":1,"doorU":-0.1,"fire":null,"dens":1.32,"open":[["w","B",3.78,1.75],["w","B",-3.97,1.75],["w","L",0,4],["w","R",0,4]],"p":[["f","bed","P-0.18","B0.34",180],["f","bed","L0.39","B0.38",180],["f","bed","C-0.07","B0.44",180],["f","bed","P0.2","B0.45",180],["f","bed","R0.47","B0.52",180]],"stair":1,"id":"RT-0317"},{"kind":"storage","W":2,"D":12,"fill":0.93,"doorU":-0.24,"fire":null,"dens":2.7,"open":[],"p":[["f","piece_chest_blackmetal","L0.17","P-0.21",270],["f","piece_chest_blackmetal","L0.15","B0",270],["f","piece_chest_blackmetal","L0.1","P-0.04",270],["f","piece_chest_blackmetal","L0.08","P0.28",270],["f","piece_chest_blackmetal","L0.06","P0.12",270],["f","piece_chest_blackmetal","L0.04","F0.66",270]],"stair":1,"id":"RT-0318"},{"kind":"storage","W":8,"D":2,"fill":0.97,"doorU":0.73,"fire":null,"dens":2.58,"open":[["w","F",1.73,4]],"p":[["f","piece_chest_blackmetal","L0.03","B0",0],["f","piece_chest_blackmetal","P-0.16","B0.03",0],["f","piece_chest_blackmetal","P0.1","B0.1",0],["f","piece_chest_blackmetal","R0.38","B0",0]],"id":"RT-0319"},{"kind":"storage","W":2,"D":7,"fill":0.93,"doorU":-0.03,"fire":null,"dens":2.31,"open":[["w","B",-0.25,1.5],["w","R",-1.77,2],["w","F",0.22,0.5],["w","B",0.47,1]],"p":[["f","piece_chest_blackmetal","L0","F0.97",270],["f","piece_chest_blackmetal","L0.06","C0.12",270],["f","piece_chest_blackmetal","L0.1","B0.49",270]],"stair":1,"id":"RT-0320"},{"kind":"workshop","W":8,"D":2,"fill":0.98,"doorU":1,"fire":null,"dens":1.9,"open":[],"p":[["f","piece_spinningwheel","C0.01","F0.26",180],["f","piece_stonecutter","R0.43","F0",90],["f","piece_artisanstation","L0.54","B0.22",180]],"id":"RT-0321"},{"kind":"hall","W":7.5,"D":9.5,"fill":0.37,"doorU":0.25,"fire":null,"dens":2.64,"open":[["w","F",-2.33,5],["w","F",0.86,2],["w","F",2.62,1],["d","B",2.56,4],["w","L",-3.72,2]],"p":[["f","piece_throne01","P-0.19","B0",180],["f","piece_throne01","R0.02","P-0.06",270],["f","rug_fur","R0.02","B0.07",315],["f","piece_groundtorch_green","L0","B0",315],["f","piece_groundtorch_green","R0","P-0.34",315],["m","piece_dvergr_lantern","P0.15","B0",3.69],["m","piece_dvergr_lantern","R0","P0.13",3.69],["m","piece_dvergr_lantern","R0","P0.24",3.69]],"id":"RT-0322"},{"kind":"hall","W":6,"D":9.5,"fill":0.64,"doorU":-0.95,"fire":null,"dens":2.48,"open":[["w","F",-1.84,1.25],["w","B",0.55,2],["w","B",-2.2,1.5],["w","F",0.3,1.5],["w","F",-2.2,1.5]],"p":[["f","piece_throne01","L0.11","C0",90],["f","rug_fur","L0.6","C0.26",270],["f","piece_groundtorch","R0.88","P-0.22",180],["m","itemstand","P-0.06","F0",0.77],["m","itemstand","C0.35","F0",1.34],["m","itemstand","C0.06","F0",1.75],["m","itemstand","P-0.07","F0",2.53],["m","itemstand","L0","P0.1",2.6],["m","itemstand","L0","P-0.32",2.61],["m","itemstand","C-0.14","F0",2.77]],"id":"RT-0323"},{"kind":"hall","W":6,"D":11.5,"fill":0.61,"doorU":1.55,"fire":null,"dens":3.31,"open":[["w","B",2.3,1.5],["w","B",-0.45,2],["w","F",2.3,1.5],["w","F",-0.2,1.5],["w","R",-4.5,1]],"p":[["f","piece_throne01","R0.02","P0.09",270],["f","piece_chest_wood","R0","P-0.08",270],["f","rug_fur","R0.7","P-0.05",270],["f","piece_groundtorch","L0.83","P-0.27",180],["m","itemstand","C0.22","F0",1.94],["m","sign","P0.18","F0",2.09],["m","itemstand","P-0.07","F0",2.27],["m","itemstand","R0","C-0.01",2.59],["m","itemstand","P0.17","F0",2.61],["m","itemstand","R0","P-0.35",2.61],["m","itemstand","R0.19","F0",2.67],["m","itemstand","C0","F0",2.73],["m","itemstand","P-0.06","F0",3.17],["m","itemstand","P0.17","F0",3.48],["m","itemstand","C0.05","F0",3.61]],"id":"RT-0324"},{"kind":"other","W":14,"D":2,"fill":1,"doorU":0,"fire":null,"dens":1.07,"open":[],"p":[["f","piece_chest_wood","R0.09","F0.26",0],["f","piece_chest_wood","L0.6","F0",0],["f","piece_groundtorch","L0.17","F0.06",270]],"id":"RT-0325"},{"kind":"smithy","W":6,"D":8,"fill":1,"doorU":0,"fire":null,"dens":1.88,"open":[["w","B",-2.5,1],["w","L",2.5,3],["w","L",-2,2],["w","L",0,2],["w","F",2.5,1],["d","L",3.43,1]],"p":[["f","piece_workbench_ext1","R0.44","P-0.15",270],["f","forge_ext5","C0.25","P0.19",180],["f","forge_ext1","C-0.23","B0.64",0],["f","forge_ext4","P0.22","B0.15",180],["f","piece_workbench_ext3","R0.34","P0.07",270],["f","forge_ext3","R0.14","P0.28",180],["f","forge_ext1","R0.2","B0",0],["f","forge_ext1","R0.39","B0.61",180],["f","forge_ext2","R1.2","P0.28",180]],"id":"RT-0326"},{"kind":"smithy","W":4,"D":4,"fill":0.63,"doorU":-0.76,"fire":null,"dens":5,"open":[["w","B",-0.01,2]],"p":[["f","piece_chest_wood","R0.25","B0.04",180],["f","piece_chest_wood","L0.28","F0.06",180],["f","piece_chest_wood","L0.23","F0.98",180],["f","piece_chest_wood","L0.27","C0.23",180],["f","forge_ext2","L0","B0",180]],"id":"RT-0327"},{"kind":"storage","W":4,"D":4,"fill":1,"doorU":0.5,"fire":null,"dens":2.5,"open":[],"p":[["f","piece_chest_blackmetal","L0.5","B0.43",270],["f","piece_chest_blackmetal","L0.49","F0.37",180],["f","piece_chest_blackmetal","R0.17","F0.43",90],["f","piece_chest_blackmetal","R0.24","B0.32",0]],"id":"RT-0328"},{"kind":"smithy","W":9,"D":8,"fill":0.98,"doorU":-0.4,"fire":null,"dens":2.55,"open":[["w","L",-0.43,7],["w","F",3.6,2],["w","F",-2.9,3],["w","B",0.1,9],["w","R",2.07,2],["w","R",-2.43,3],["d","F",0.6,4]],"p":[["f","forge","L0.42","P0.18",90],["f","piece_workbench","L0.39","F0.94",90],["f","piece_spinningwheel","R0.3","B0.67",180],["f","rug_fur","P-0.23","P0.14",0],["f","rug_fur","P-0.22","F0.32",0],["f","forge_ext5","C0.16","B0",90],["f","piece_chest","R0.25","P-0.07",180],["f","piece_chest","R0.24","P-0.18",180],["f","piece_chest","R0.23","F0.34",180],["f","piece_chest","R0.23","P-0.29",180],["c","forge_ext4",0,-2.01,2.64,0,-0.01],["c","piece_workbench_ext1",1,-1.73,-0.42,0,0.01],["c","forge_ext3",0,-2.1,1.48,0,0.03],["c","forge_ext1",0,-1.6,0.06,0,0.04],["c","forge_ext2",0,1.37,0.03,0,0.04],["c","piece_workbench_ext2",1,-0.13,-0.66,0,0.05],["m","sign","R1.13","B0",2.33],["m","piece_walltorch","R0.16","B0",3.15],["m","piece_walltorch","P-0.16","F0",3.29],["m","piece_walltorch","P0.28","F0",3.42]],"id":"RT-0329"},{"kind":"home","W":11,"D":8,"fill":0.82,"doorU":0.5,"fire":null,"dens":1.11,"open":[["w","B",-3.54,1],["w","R",-1,1],["w","B",-1.04,1],["w","R",3.25,0.5],["d","F",0.5,2]],"p":[["f","piece_table_round","R1.01","P-0.19",112],["f","piece_bed02","P-0.21","F0.12",0],["f","piece_chair","P-0.06","F0.28",180],["f","piece_chest_wood","L0.08","B0.44",270],["f","piece_chest_wood","L0.07","P0.15",270],["f","jute_carpet","P0.13","B0.65",180],["c","piece_chair03",0,-1.46,0.94,158,-0.01],["c","piece_chair03",0,1.37,0.9,225,-0.01],["m","piece_banner04","P-0.22","F0",3.58]],"id":"RT-0330"},{"kind":"sleeping","W":7,"D":8,"fill":0.87,"doorU":-2.5,"fire":null,"dens":1.44,"open":[["w","B",-1.5,1],["d","F",-2.5,2]],"p":[["f","piece_table","L0.27","B1.04",90],["f","ashwood_bed","P0.19","B0.61",180],["f","piece_bench01","C0.19","F0.37",0],["f","piece_chest_wood","R0.19","F0.52",270],["f","rug_deer","C0.31","F0.14",90],["c","jute_carpet_blue",1,0.74,0.11,270,-0.02],["c","piece_chair02",0,-0.55,0.92,135,0.04],["c","treasure_stack",0,-0.61,-0.03,135,0.8],["c","treasure_stack",0,0.3,-0.24,90,0.8],["m","piece_banner02","L0","C0.03",3.28],["m","piece_dvergr_lantern","L0","B0",3.69]],"id":"RT-0331"},{"kind":"other","W":6,"D":8,"fill":0.72,"doorU":-1,"fire":null,"dens":1.73,"open":[["w","F",0.18,2],["d","B",0.18,4]],"p":[["f","ArmorStand","R0.05","B0.63",180],["f","ArmorStand","L0.58","B0.49",157],["m","piece_dvergr_lantern","L0.98","B0",3.59],["m","piece_dvergr_lantern","R0.62","B0",3.59],["m","piece_banner02","R0","B0",3.88],["m","piece_dvergr_lantern","L0","P0.25",4.06]],"id":"RT-0332"},{"kind":"home","W":9,"D":11,"fill":0.85,"doorU":-1.57,"fire":null,"dens":3.1,"open":[["d","F",1.18,4],["w","B",1.18,6],["w","R",-4.67,1.5],["w","F",3.81,1.25],["w","B",-3.99,1],["w","L",4.8,1.5]],"p":[["f","piece_table","R0","P0.27",270],["f","piece_throne01","P-0.19","P-0.29",45],["f","piece_throne01","L0.79","P0.03",112],["f","piece_bed02","P0.09","B0.07",180],["f","piece_chest_wood","R0.62","B0",180],["f","piece_chest_wood","P-0.19","B0",180],["f","rug_wolf","R0.27","P-0.24",315],["f","jute_carpet_blue","P0.09","P-0.07",225],["f","rug_wolf","P-0.12","P0.1",135],["f","rug_wolf","R0.23","P0.09",225],["f","piece_chest","P0.09","P0.14",180],["f","piece_chest","R0","P-0.14",270],["f","piece_chest","R0","C0.31",270],["c","piece_chair03",0,0.2,0.75,202,0.02],["c","rug_wolf",1,0.01,0.8,0,0.02],["m","itemstand","L0","P-0.16",1.89],["m","itemstand","L0","P-0.2",2.55],["m","itemstand","L0","P-0.11",2.58],["m","itemstand","L0.35","B0",2.98],["m","itemstand","L0","B0.66",3.02],["m","piece_dvergr_lantern","P-0.09","F0",3.59],["m","darkwood_raven","L0","F1.09",3.8],["m","itemstand","L0","P0.06",3.82],["m","darkwood_raven","L0","P-0.25",3.9],["m","darkwood_raven","L0","P-0.08",3.9],["m","darkwood_raven","L0","P0.09",3.9],["m","darkwood_raven","R0","P-0.33",3.9],["m","darkwood_raven","R0","P-0.14",3.9],["m","darkwood_raven","R0","P0.04",3.9],["m","darkwood_raven","R0","P0.19",3.9],["m","darkwood_raven","R0","P0.28",3.9]],"id":"RT-0333"},{"kind":"smithy","W":6,"D":8,"fill":0.81,"doorU":0.07,"fire":null,"dens":1.81,"open":[["w","B",-0.01,2],["w","F",0.07,6],["w","L",-0.01,4],["d","B",2.02,2],["d","B",0,2],["d","L",3.02,2]],"p":[["f","piece_chest","P0.07","B0.92",90],["f","piece_chest","P-0.08","B0.92",270],["f","piece_chest","C-0.05","B0.06",0],["f","piece_chest","P0.07","P0.12",90],["f","piece_chest","P-0.08","P0.12",270],["f","forge_ext2","R0.95","P0.05",0],["m","itemstand","R0","C0.07",3.06]],"id":"RT-0334"},{"kind":"storage","W":10,"D":8,"fill":0.79,"doorU":2.27,"fire":null,"dens":3.78,"open":[["w","R",2.76,2.5],["w","R",-2.74,2.5],["w","L",2.67,2.5],["w","L",-2.83,2.5],["w","F",4.02,2],["w","B",4.02,2],["w","R",0.68,1.5],["w","B",0.99,2],["w","B",0,4]],"p":[["f","piece_workbench","L0.16","B0.61",90],["f","piece_workbench_ext3","L0","P-0.16",270],["f","piece_chest_wood","P0.27","F0.94",180],["f","piece_chest_wood","P0.27","P-0.24",180],["f","piece_chest_wood","P0.27","P-0.07",180],["f","piece_chest_wood","P0.27","F0.22",180],["f","piece_chest_wood","P-0.26","F0.08",0],["f","piece_chest_wood","P0.27","P-0.15",180],["f","rug_fur","R0.39","B1.07",0],["f","rug_fur","P0.11","B1.13",0],["f","rug_fur","P-0.23","B0.35",270],["f","rug_fur","C-0.09","F0.28",90],["f","rug_fur","C-0.3","B0.37",292],["f","piece_bench01","C0.3","P0.21",0],["f","rug_wolf","R0.62","P0.15",270],["f","rug_fur","P0.13","F0.72",0],["f","ArmorStand","C-0.28","F0.38",0],["f","piece_chair03","R0.45","P0.2",314],["c","piece_workbench_ext1",0,1.51,-0.27,0,0.01],["m","itemstand","L0","P-0.26",1.26],["m","itemstand","R0","C-0.09",1.27],["m","itemstand","R0","P-0.14",1.29],["m","piece_walltorch","P-0.34","B0",1.7],["m","piece_walltorch","P0.1","B0",2.23],["m","piece_walltorch","P-0.1","B0",2.24],["m","itemstand","R0","B0.99",2.36],["m","itemstand","C0.08","B0",3],["m","piece_walltorch","R0","P0.26",3.21],["m","piece_walltorch","R0","P-0.25",3.23],["m","piece_banner04","P0.23","B0",3.67],["m","piece_banner04","P-0.22","B0",3.67]],"id":"RT-0335"},{"kind":"storage","W":4,"D":4,"fill":1,"doorU":-1,"fire":null,"dens":2.5,"open":[],"p":[["f","piece_chest_wood","R0.15","B1.13",180],["f","piece_chest","R0.36","B0.1",180],["f","piece_chest","L0.53","B0.08",180],["f","piece_chest","R0.11","F0.43",270]],"id":"RT-0336"},{"kind":"smithy","W":7.5,"D":12,"fill":0.89,"doorU":0.08,"fire":null,"dens":1,"open":[["w","R",0,12],["w","L",-1.93,1],["w","L",2.07,1]],"p":[["f","forge","R0.76","P-0.33",270],["f","piece_workbench","R0.53","P0.28",270],["f","piece_chest_blackmetal","R0","C0.06",270],["f","rug_wolf","P0.05","C-0.11",270],["f","rug_wolf","C0.28","B0.67",316],["c","piece_workbench_ext3",1,2.1,0.09,270,0],["c","forge_ext1",0,1.52,-0.56,180,0.04],["m","sign","R0","C0.02",2.04],["m","piece_dvergr_lantern","R0","P-0.17",3.69],["m","piece_dvergr_lantern","R0","P0.17",3.69]],"id":"RT-0337"},{"kind":"smithy","W":8,"D":2,"fill":0.83,"doorU":0.25,"fire":null,"dens":2.26,"open":[["w","B",3.75,0.5]],"p":[["f","forge_ext4","P0.19","F0.07",90],["f","piece_workbench_ext1","P-0.07","F0.37",180],["f","piece_workbench_ext2","L0.55","F0",180]],"id":"RT-0338"},{"kind":"tavern","W":6,"D":10,"fill":0.91,"doorU":-2,"fire":null,"dens":1.83,"open":[["w","B",1.25,1.5],["w","B",-1.25,1.5],["w","R",-0.25,1.5],["w","R",2,1],["d","F",-2,2]],"p":[["f","piece_table_oak","C-0.04","P0.06",270],["f","rug_wolf","C0.19","F0.57",90],["f","rug_wolf","C-0.13","B0.13",90],["f","rug_fur","R0.3","C0.29",180],["c","piece_chair03",0,2.07,1.14,180,0.01],["c","piece_chair03",0,2.18,-1.12,0,0.01],["c","piece_chair03",0,-2.14,-1.18,0,0.01],["c","rug_fur",0,-0.33,1.23,270,0.02],["c","piece_chair03",0,0.73,1.12,180,0.03],["c","piece_chair03",0,-0.7,1.14,180,0.03],["c","piece_chair03",0,-1.98,1.08,180,0.03],["c","piece_chair03",0,0.77,-1.16,0,0.03],["c","piece_chair03",0,-0.73,-1.14,0,0.03],["c","Candle_resin",0,1.6,0.06,0,0.81],["c","Candle_resin",0,-1.38,0.07,0,0.81],["m","piece_dvergr_lantern","R0","F0",1.59]],"id":"RT-0339"},{"kind":"sleeping","W":6,"D":7,"fill":0.86,"doorU":2,"fire":null,"dens":1.66,"open":[["w","L",2,2],["w","B",-2.25,0.5],["w","R",1.5,2],["d","F",2,2]],"p":[["f","ashwood_bed","L0.36","B0.52",180],["f","rug_straw","C0.06","F0",270],["f","ArmorStand","C0.02","F0.33",0],["f","piece_chair03","C0.21","B0.2",202],["c","rug_asksvin",0,-1.26,-0.08,0,-0.02],["m","piece_dvergr_lantern","L0","F0",1.59],["m","piece_banner05","L0","P-0.1",3.46],["m","piece_dvergr_lantern","L0","P0.07",3.59]],"id":"RT-0340"},{"kind":"sleeping","W":8,"D":5,"fill":0.88,"doorU":3.71,"fire":null,"dens":1.71,"open":[["w","F",-2,2],["w","B",-0.5,1],["w","B",1.25,1.5],["d","F",3.62,1.75]],"p":[["f","ashwood_bed","L0.36","F0.27",0],["f","piece_chair","P-0.17","F0.3",0],["f","jute_carpet","C-0.18","F0.93",180],["f","rug_straw","R0.2","B0",180],["f","ArmorStand","R0.5","B0.33",225],["m","piece_banner04","P-0.1","F0",3.25],["m","piece_dvergr_lantern","P-0.25","F0",3.59],["m","piece_dvergr_lantern","R0","P-0.08",3.59]],"id":"RT-0341"},{"kind":"other","W":8,"D":12,"fill":0.73,"doorU":-2.74,"fire":null,"dens":1.29,"open":[["d","R",4.47,2],["d","R",-4.47,2],["w","B",1,2],["w","F",1,2]],"p":[["f","piece_groundtorch_mist","R0.72","P0.17",45],["f","piece_groundtorch_mist","R0.7","P-0.17",45],["m","piece_dvergr_lantern","C0","B0",1.59],["m","piece_dvergr_lantern","C0","F0",1.59],["m","piece_dvergr_lantern","C0.01","B0",3.4],["m","piece_dvergr_lantern","C0.01","F0",3.43],["m","darkwood_raven","C0","F0",3.9],["m","darkwood_raven","C0","B0",3.9],["m","darkwood_raven","R0","F0",3.9]],"id":"RT-0342"},{"kind":"hall","W":6,"D":8,"fill":0.95,"doorU":0,"fire":[0.1,0.07],"dens":1.54,"open":[],"p":[["f","piece_throne01","L0.17","B0.12",135],["f","piece_throne01","L0.19","F0.04",45],["f","fire_pit","C0.1","C0.07",270],["f","rug_wolf","L0.05","C-0.05",180],["f","rug_deer","C0.2","B0.06",90],["f","rug_deer","C0.24","F0",90],["f","rug_wolf","R0","C-0.07",180],["f","ArmorStand","R0","F0",315],["f","piece_groundtorch","L0","B0.03",90],["f","piece_groundtorch","L0","F0",90],["c","piece_chair02",2,2.03,-1.96,90,-0.04]],"id":"RT-0343"},{"kind":"smithy","W":7,"D":7.5,"fill":0.83,"doorU":-0.47,"fire":null,"dens":3.68,"open":[["w","B",2.81,1.5],["w","F",2.79,1.5],["w","B",-0.18,5.5],["w","F",1.53,2],["d","F",-0.47,2],["w","F",-2.22,1.5],["w","B",1.53,2],["w","F",1.53,2]],"p":[["f","forge","R1.18","F0.01",0],["f","piece_workbench","P-0.06","B0",180],["f","rug_deer","P-0.08","B1.14",0],["f","rug_deer","P-0.09","P-0.15",180],["f","rug_deer","L0.42","C0.22",270],["f","piece_chair02","L1.09","P-0.09",68],["m","itemstand","R0","B0.3",1.41],["m","itemstand","R0","F0.7",1.47],["m","itemstand","P-0.06","B0",1.51],["m","itemstand","R0","F1.02",1.9],["m","itemstand","R0.96","B0",1.9],["m","sign","P-0.2","B0",2.72],["m","piece_banner02","L0","B0.16",2.88],["m","itemstand","P-0.21","B0",3.18],["m","itemstand","P0.09","B0",3.19],["m","itemstand","L0","F0",3.38],["m","itemstand","P0.11","F0",3.39],["m","itemstand","P-0.07","B0",3.4],["m","itemstand","P-0.06","F0",3.73]],"id":"RT-0344"},{"kind":"tavern","W":10,"D":9.5,"fill":0.87,"doorU":-2.02,"fire":null,"dens":1.57,"open":[["w","F",1.93,2],["w","L",3.59,1.25],["w","R",4.34,0.25],["w","R",3.34,0.75],["w","R",1.96,2],["w","R",-2.04,2],["w","L",-0.11,2],["w","L",-3.99,1.75],["w","R",-0.11,2],["w","R",-3.99,1.75],["w","L",1.87,2],["w","B",-2.11,2],["d","F",-2.02,2]],"p":[["f","piece_cartographytable","L0.32","B1.2",270],["f","piece_table","R0.38","F0.02",180],["f","piece_table","P0.12","F0",180],["f","piece_bench01","P-0.06","P0.25",270],["f","piece_chest_wood","P-0.33","P-0.22",90],["f","piece_chest_wood","P-0.16","B0.12",180],["f","piece_groundtorch_wood","R0.94","B0.25",180],["c","rug_deer",0,-0.31,-1.25,314,0.02],["c","treasure_stack",1,-0.87,0.27,180,0.8],["c","treasure_stack",2,0.89,0.34,135,0.8],["c","itemstandh",1,0.33,-0.17,157,0.82],["c","itemstandh",2,-0.97,-0.15,270,0.82],["c","itemstandh",2,0.21,-0.24,224,0.82],["m","itemstand","L0","P-0.16",1.9],["m","itemstand","R0","C-0.04",2.16],["m","itemstand","L0","F0.29",2.25],["m","piece_walltorch","L0","P-0.17",2.67],["m","itemstand","L0","P-0.28",2.82],["m","itemstand","L0","C0.03",2.98]],"id":"RT-0346"},{"kind":"workshop","W":9,"D":14,"fill":0.7,"doorU":3.3,"fire":null,"dens":1.14,"open":[["w","F",-2.34,1.5],["w","L",4.51,3.75],["w","L",-5.52,3],["w","L",-4.02,2],["w","F",3.3,1.5],["w","F",-2.95,3],["w","R",5.98,1.25],["w","R",-6.27,1.25],["w","F",1.04,1],["w","F",-0.96,1],["d","L",1.85,2],["d","L",-2.15,2],["w","F",0.54,4],["w","L",-6.37,1.5],["w","L",6.14,1.5],["w","L",-6.36,1.5],["w","B",0.44,4],["w","R",5.99,1.25],["w","B",1.94,1],["w","B",-0.56,2]],"p":[["f","piece_workbench","L0.25","P0.33",90],["f","piece_throne01","P-0.28","B0.29",180],["f","piece_bench01","P0.29","P0.21",90],["f","rug_deer","P-0.16","P-0.09",90],["f","rug_deer","P-0.17","P0.06",90],["f","piece_chest","R0.43","B0.56",180],["f","piece_chest","P-0.29","F0.05",0],["f","ArmorStand","P-0.23","P0.15",90],["f","piece_groundtorch_wood","L0.3","F0.18",90],["f","piece_groundtorch_wood","L0.12","B0.31",90],["m","piece_banner02","R0.56","B0",1.97],["m","piece_banner02","P-0.29","F0",2.38]],"id":"RT-0347"},{"kind":"living","W":12,"D":14,"fill":0.49,"doorU":0,"fire":null,"dens":1.35,"open":[["d","F",-0.96,2],["w","F",0.79,0.5],["d","B",-0.96,2],["w","B",0.79,0.5],["w","B",5.16,2],["w","B",-5.05,2]],"p":[["f","piece_table_round","P-0.06","B0.52",180],["f","piece_workbench","P0.29","P-0.1",270],["f","piece_chest_blackmetal","P0.25","P0.14",180],["f","rug_deer","C-0.16","P0.24",0],["f","rug_deer","C-0.24","P0.05",180],["f","rug_fur","C0.08","P-0.21",180],["f","piece_chest_barrel","P-0.13","P0.19",180],["f","rug_wolf","C0.13","P-0.21",180],["c","piece_workbench_ext1",1,-3.01,-1.23,315,-0.04],["c","rug_deer",1,0.73,0.96,270,-0.03],["c","piece_chair02",0,-1.57,-0.48,67,0.01],["c","piece_chair02",0,-1.34,0.89,112,0.01],["c","piece_chair02",0,0.67,1.52,202,0.01],["h","piece_brazierceiling01","P-0.25","P0.14",113,3.39],["m","piece_banner02","R0","P0.36",3.46],["h","piece_brazierceiling01","P-0.08","F0.64",90,3.81]],"id":"RT-0348"},{"kind":"sleeping","W":4,"D":5,"fill":0.85,"doorU":1.21,"fire":null,"dens":1.76,"open":[],"p":[["f","piece_throne01","L0.12","F1.12",45],["f","ashwood_bed","L0.1","B0",90],["c","jute_carpet_blue",1,1.34,0.45,337,-0.04],["m","piece_banner03","L0.49","F0",2.31]],"id":"RT-0349"},{"kind":"other","W":5,"D":8,"fill":0.62,"doorU":-0.54,"fire":null,"dens":1.62,"open":[["w","R",2.96,2],["w","B",-1.61,2],["w","L",2.99,2]],"p":[["f","rug_deer","R0.04","F0",112],["f","piece_chest_barrel","P-0.13","F0.04",270],["f","piece_chest_barrel","L0.44","F0.36",270],["m","wood_dragon1","P-0.12","B0",0.98],["m","wood_dragon1","L0","P0.25",1.01]],"id":"RT-0350"},{"kind":"tavern","W":13,"D":7,"fill":0.62,"doorU":-1.5,"fire":null,"dens":1.24,"open":[["w","L",0.47,6],["w","B",-4.57,2],["w","R",2.44,2],["w","F",-4.63,2],["w","B",0.9,1],["w","F",0.88,1]],"p":[["f","piece_table","L0","B0.36",270],["f","piece_table","L0","P-0.05",270],["f","piece_table","L0.09","F1.08",180],["f","rug_deer","P-0.11","C0.28",90],["f","piece_chair02","P-0.33","B0.09",225],["f","piece_chair02","P-0.22","P0.13",113],["f","piece_chair02","C0.03","P0.11",270],["c","rug_deer",0,-1.2,-0.6,90,0.02],["c","piece_chair02",2,-1.64,0.07,226,0.04],["c","itemstandh",0,0.55,0.1,68,0.82],["c","itemstandh",0,0.8,-0.04,135,0.82],["c","itemstandh",0,0.74,-0.33,203,0.82],["c","itemstandh",0,0.44,-0.22,23,0.82],["c","itemstandh",0,-0.12,-0.02,293,0.82],["c","itemstandh",0,-0.59,-0.3,338,0.82],["c","itemstandh",1,0.32,0.09,135,0.82],["c","itemstandh",1,0.82,-0.37,113,0.82],["c","itemstandh",1,-0.7,0.14,248,0.82],["c","itemstandh",1,-0.19,-0.25,203,0.82],["c","itemstandh",2,0.88,-0.06,338,0.82],["c","itemstandh",2,0.75,0.27,113,0.82],["c","itemstandh",2,0.52,-0.01,23,0.82],["c","itemstandh",2,0.41,0.28,68,0.82],["c","itemstandh",2,-0.26,0.15,180,0.82],["c","itemstandh",2,-0.73,-0.25,180,0.82]],"id":"RT-0351"},{"kind":"temple","W":13,"D":4,"fill":0.89,"doorU":-4.25,"fire":null,"dens":1.3,"open":[["w","B",0.1,13],["w","R",0.44,3.25],["w","L",0.44,3.25]],"p":[["f","piece_throne01","R0.05","C-0.18",270],["f","piece_throne01","L0.26","F1.18",90],["m","piece_walltorch","R0","B1.04",1.71],["m","piece_walltorch","L0","B1.07",1.69],["m","piece_walltorch","R0","F0.67",1.7],["m","piece_walltorch","L0","F0.64",1.68]],"id":"RT-0352"},{"kind":"smithy","W":15.5,"D":3,"fill":1,"doorU":5.96,"fire":null,"dens":1.51,"open":[["w","R",-0.87,1.25],["d","R",0.63,1.75],["w","B",4.96,5.75],["d","B",0.08,4],["w","B",-4.79,5.75],["w","L",-0.87,1.25],["d","L",0.63,1.75]],"p":[["f","piece_workbench","P-0.32","F0",0],["f","forge_ext4","P0.2","B0",270],["f","forge_ext3","P0.35","B0",270],["f","piece_chest","P0.06","F0",0],["f","forge_ext1","P0.18","F0",0],["c","piece_workbench_ext3",0,-2.26,0.08,270,0],["c","piece_workbench_ext1",0,2.04,-0.35,0,0.01]],"id":"RT-0353"},{"kind":"storage","W":9.5,"D":16,"fill":0.88,"doorU":4,"fire":null,"dens":1.12,"open":[["d","F",3.88,1.75],["w","L",-2.83,1.5],["w","F",-3.87,1.75],["w","B",-3.87,1.75],["w","F",-3.87,1.75],["w","B",-3.87,1.75],["d","B",0,2]],"p":[["f","piece_chair","P-0.23","P-0.07",270],["f","piece_chair","P-0.24","P0.07",270],["f","rug_wolf","R0.15","F0.96",0],["f","rug_wolf","C-0.01","P-0.36",270],["f","rug_wolf","L1.17","P-0.03",180],["f","rug_wolf","L1.1","P0.16",0],["f","rug_wolf","C0","B0.47",270],["f","piece_chest","R0.41","P-0.22",0],["f","piece_chest","L0","P-0.18",90],["f","piece_chest","R0.39","P-0.16",0],["f","piece_chest","R0.4","P-0.1",0],["f","piece_chest","R0.45","P-0.04",0],["f","piece_chest","L0.27","C-0.3",180],["f","piece_chest","L0.26","P0.04",180],["f","piece_chest","L0.2","P0.1",180],["m","piece_walltorch","R0","P-0.34",1.67],["m","piece_walltorch","P0.11","B0",1.85],["m","piece_walltorch","L0.01","F0",2],["m","piece_walltorch","R0","P0.13",2.12],["m","itemstand","R0","P0.2",2.73]],"id":"RT-0354"},{"kind":"smithy","W":6.5,"D":4,"fill":0.88,"doorU":-0.04,"fire":null,"dens":3.08,"open":[["d","F",1.46,2],["w","R",-0.96,1],["w","R",1.04,1],["w","L",1.79,0.5]],"p":[["f","forge_ext5","R0","F0.85",0],["f","rug_asksvin","R0","F0",45],["f","rug_asksvin","L0.53","B0",315],["f","piece_preptable","P0.07","B0.2",0],["f","piece_chest_barrel","L0","B0.18",270],["m","itemstand","R0","F0",1.92],["m","itemstand","R0.37","F0",1.93],["m","itemstand","R0.85","F0",1.93],["m","itemstand","P0.07","F0",3.8]],"id":"RT-0358"},{"kind":"sleeping","W":9,"D":8,"fill":0.78,"doorU":1.73,"fire":null,"dens":1.25,"open":[["w","L",2.79,0.5],["w","L",0.79,1],["w","L",-1.09,0.75],["w","L",-3.21,1],["w","F",-4.02,1],["w","B",-3.52,1],["w","B",-1.52,1],["w","B",4.23,0.5],["w","B",3.48,1],["w","B",1.48,1],["w","B",-0.52,1],["w","B",-2.52,1],["w","F",-0.52,1],["w","F",-0.08,0.25],["w","F",-0.57,0.25],["w","F",0.14,1.25],["d","F",2.48,2],["w","R",-2.97,1],["w","F",3.78,1]],"p":[["f","piece_throne01","P0.16","B0.82",180],["f","ashwood_bed","L0.33","P-0.1",90],["f","piece_chair","R0.35","C0.21",270],["f","piece_chair","R0.34","P-0.09",270],["f","rug_wolf","P-0.2","P0.21",90],["f","rug_wolf","P0.17","P0.18",270],["f","rug_wolf","R0.97","C-0.15",180],["f","ArmorStand","R0.33","B0.98",225],["c","rug_wolf",1,1.07,0.91,0,-0.02],["m","sign","R1.01","F0",2.15],["m","piece_dvergr_lantern","P0.16","F0",3.85]],"id":"RT-0359"},{"kind":"storage","W":2,"D":4,"fill":1,"doorU":-0.01,"fire":null,"dens":5,"open":[],"p":[["f","piece_chest","L0.01","F0.33",0],["f","piece_chest","L0.04","P-0.09",0],["f","piece_chest","L0.04","B1.04",0],["f","piece_chest","L0.04","B0.11",0]],"stair":1,"id":"RT-0360"},{"kind":"hall","W":4,"D":6,"fill":0.96,"doorU":1.08,"fire":null,"dens":1.74,"open":[["d","F",1.08,2]],"p":[["f","piece_throne01","L0.42","F0.39",90],["f","piece_chair","R0","B0.33",225],["f","piece_chest","L0.16","C-0.33",90],["f","piece_chest_blackmetal","L0.4","B0.12",180],["f","rug_wolf","R0","F0.16",270]],"id":"RT-0361"},{"kind":"home","W":5.5,"D":3,"fill":0.79,"doorU":2.24,"fire":[-1.79,-0.28],"dens":3.85,"open":[["w","L",-0.42,2],["w","L",0.83,1.5],["w","R",-0.56,2]],"p":[["f","fire_pit","L0.26","F0.52",90],["f","bed","C0.29","B0",0],["f","piece_chest_wood","R0","F0.24",0],["f","rug_wolf","R0","B0.48",270],["m","itemstand","L0.72","B0",2.37],["m","piece_banner02","C0.32","F0",3.63]],"stair":1,"id":"RT-0362"},{"kind":"sleeping","W":3,"D":4,"fill":0.83,"doorU":-2.42,"fire":null,"dens":4,"open":[["w","F",-0.42,2]],"p":[["f","bed","R0","B0.56",90],["f","rug_wolf","L0","F0.15",90],["f","piece_chair03","R0.78","F0.08",0],["f","piece_chest_wood","L0.2","F0.31",90],["m","piece_banner02","L0","B0.59",3.57]],"stair":1,"id":"RT-0363"},{"kind":"sleeping","W":3,"D":4,"fill":0.83,"doorU":-1.49,"fire":null,"dens":4,"open":[["w","B",0.45,2]],"p":[["f","bed","L0","F0.29",270],["f","piece_chest_wood","R0.06","B0.51",270],["f","rug_deer","R0","B0.17",90],["f","piece_chair03","L1.02","B0.12",180],["m","piece_banner02","R0","F0.49",3.7]],"stair":1,"id":"RT-0364"},{"kind":"sleeping","W":3,"D":4,"fill":0.83,"doorU":-2.49,"fire":null,"dens":3,"open":[["w","B",-0.24,2.5],["w","F",-0.55,2]],"p":[["f","bed","R0","B0.42",90],["f","piece_chair03","L0.96","F0",0],["f","piece_chest_wood","L0.09","F0.36",90]],"stair":1,"id":"RT-0365"},{"kind":"hall","W":4,"D":2,"fill":1,"doorU":1,"fire":null,"dens":3.75,"open":[],"p":[["f","piece_throne01","C-0.04","F0.2",0],["f","piece_groundtorch_mist","R0.3","B0",0],["f","piece_groundtorch_mist","L0.1","B0",0]],"id":"RT-0366"},{"kind":"sleeping","W":9,"D":6,"fill":0.74,"doorU":0.74,"fire":null,"dens":1.75,"open":[["w","L",-0.92,4],["w","F",-3.51,2],["w","B",-3.01,2]],"p":[["f","piece_bed02","P-0.25","F0.52",0],["f","piece_bed02","R0.14","F0.25",0],["f","piece_chair03","P-0.09","P0.12",90],["f","piece_chair03","P0.19","P0.08",270],["f","piece_chest_wood","P0.19","F0.31",270],["f","rug_deer","P0.04","B0.2",180],["f","rug_wolf","P0.06","F0.6",180],["c","piece_chest_wood",0,1.45,-1.21,90,-0.05],["m","piece_banner02","R0","F0",4.1]],"id":"RT-0367"},{"kind":"home","W":11,"D":10,"fill":0.79,"doorU":3.5,"fire":[-4.42,2.9],"dens":1.73,"open":[["w","F",-1.51,8],["w","L",-1.08,6]],"p":[["f","piece_table","P-0.09","P0.26",0],["f","piece_throne01","P-0.29","F0.18",45],["f","fire_pit","L0.09","B1.11",135],["f","bed","L0.48","P-0.2",90],["f","bed","L0.47","P-0.06",90],["f","piece_bench01","P0.32","P-0.07",90],["f","piece_chest_barrel","L0.71","F0.93",270],["f","piece_chest_barrel","L0.28","P0.13",270],["f","piece_groundtorch_wood","L0.3","F0.18",158],["f","piece_groundtorch","P-0.14","F0",270],["c","rug_deer",1,0.72,0.9,45,0.01],["c","rug_deer",0,0.2,-1.03,112,0.02],["c","piece_chest",3,-0.03,1.8,180,-0.02],["c","piece_chest",4,0.11,1.88,180,-0.02],["c","piece_chair02",0,-0.94,-1.01,45,0.04],["c","piece_chair02",0,1.75,0.31,225,0.04],["m","itemstand","L0","P-0.13",1.66]],"id":"RT-0368"},{"kind":"living","W":14,"D":16.5,"fill":0.36,"doorU":1.14,"fire":null,"dens":2.63,"open":[["w","B",6.02,1.75],["w","B",6.02,1.75],["w","F",5.52,2.75],["w","F",1.64,1],["w","F",6.02,1.75],["w","R",-7.28,2],["w","R",2.47,11.5],["w","R",4.22,3],["w","B",-1.48,10.75],["w","F",3.02,1.75],["w","F",-0.73,1.75],["w","B",-1.86,10],["w","F",1.14,4],["w","B",1.54,1],["w","B",-0.98,9.75],["w","F",3.02,1.75]],"p":[["f","piece_table","P0.1","P0.33",0],["f","jute_carpet","P0.04","P-0.29",270],["f","jute_carpet","P0.03","P-0.13",270],["f","piece_chest","P0.25","F0.2",270],["f","piece_chest","P0.12","P-0.2",270],["c","piece_chair03",0,1.77,0.3,225,0.02],["c","piece_chair03",0,0.55,-1.03,67,0.02],["c","piece_chair03",0,0.44,1.07,180,0.02],["c","piece_chair03",0,-1.59,0.09,90,0.02],["c","piece_chair03",0,-0.49,-0.89,0,0.02],["c","piece_chair03",0,-0.55,1.07,180,0.02],["c","jute_carpet",0,0.38,0.05,180,0.02],["c","itemstandh",0,0.86,-0.32,270,0.82],["c","itemstandh",0,0.6,0.18,270,0.82],["c","itemstandh",0,0,-0.07,270,0.82],["c","itemstandh",0,-0.55,0.23,270,0.82],["c","itemstandh",0,-0.8,-0.31,270,0.82],["m","itemstand","R0","P0.11",2],["m","itemstand","R0","P-0.23",2.3],["m","itemstand","P0.11","B0",2.33],["m","itemstand","P0.11","F0",2.33],["m","itemstand","P0.11","F0",2.33],["m","itemstand","P0.11","B0",3.33],["m","itemstand","P0.11","B0",3.33],["m","itemstand","P0.11","B0",3.33],["m","itemstand","P0.11","B0",3.33],["m","itemstand","R0","P-0.17",3.34],["m","itemstand","R0","P-0.18",3.34],["m","piece_banner02","R0.48","F0",3.36],["m","piece_banner02","R0.32","B0",3.48]],"id":"RT-0369"},{"kind":"workshop","W":5,"D":12.5,"fill":0.72,"doorU":-0.21,"fire":null,"dens":0.89,"open":[["w","F",0.77,3.25],["w","F",0.52,3.25],["w","L",3.97,4.5],["w","L",2.97,5.5],["w","R",-4.03,3.5],["w","L",-4.03,3.5],["w","F",0.14,2]],"p":[["f","piece_workbench","R0.84","P0.33",270],["f","piece_chest_wood","R0.77","F0.54",0],["f","fermenter","L0","B0.87",90],["f","fermenter","L0","P0.25",90],["c","jute_carpet",0,-1.07,0.92,180,0]],"id":"RT-0370"},{"kind":"storage","W":6.5,"D":8.5,"fill":1,"doorU":2.29,"fire":null,"dens":1.63,"open":[["w","R",-0.28,8],["w","B",-0.11,6.5],["w","L",-0.28,8],["d","F",0.29,2]],"p":[["f","piece_oven","C0.29","P0.26",90],["f","piece_oven","L0.84","P0.26",90],["f","piece_chest","L0","F0.49",90],["f","piece_chest","L0","P-0.15",90],["f","piece_chest","L0","P0.08",90],["m","piece_dvergr_lantern","R0","P0.32",2.69],["m","piece_dvergr_lantern","R0","C-0.28",2.69],["m","piece_dvergr_lantern","L0","P0.32",4.12],["m","piece_dvergr_lantern","L0","P-0.27",4.12]],"id":"RT-0371"},{"kind":"living","W":6.5,"D":8,"fill":0.91,"doorU":-0.11,"fire":null,"dens":0.84,"open":[["w","F",-3.23,0.25],["w","L",-3.28,1.5],["w","R",-3.28,1.5]],"p":[["f","piece_table","R1.04","P-0.11",90],["c","piece_chair03",0,-0.47,-1.17,22,-0.09],["c","piece_chair03",0,0.8,-1.18,315,-0.09],["m","piece_banner02","L0","P-0.11",3.25]],"id":"RT-0372"},{"kind":"storage","W":14,"D":20,"fill":0.62,"doorU":-4,"fire":null,"dens":1.03,"open":[["d","F",-4,2],["w","L",-1,2],["w","L",-7,2],["d","B",-2,2],["w","R",-9,2],["w","R",-9,2],["w","L",-9,2],["w","F",0.29,2],["w","B",0.29,2],["w","F",4,2],["w","B",4,2],["w","R",6.41,2],["w","L",6.41,2],["d","F",0,2],["d","F",6,2],["d","R",1,2],["d","F",3,4],["d","B",6,2]],"p":[["f","piece_table_round","P-0.2","P-0.1",0],["f","piece_table","P-0.32","P0.34",270],["f","piece_bench01","P-0.32","B0.32",180],["f","piece_chest_blackmetal","C0.25","P0.15",270],["f","piece_chest_wood","P0.23","P0.35",270],["f","piece_chest_wood","P0.23","B0.41",270],["f","rug_wolf","P-0.09","P-0.1",0],["f","rug_deer","L1.2","P0.03",270],["f","rug_wolf","P-0.15","B0.99",0],["f","piece_chest","P0.14","P0.17",0],["f","piece_chest","P0.31","P0.25",270],["f","piece_chest","P0.28","P0.18",0],["f","piece_chair02","L0.49","P-0.02",90],["c","rug_fur",0,-0.12,0.04,180,-0.03],["c","piece_chair02",1,0.11,1.13,180,-0.01],["c","itemstandh",0,0,0.03,0,0.8],["c","itemstandh",1,0.79,0.17,135,0.81],["c","itemstandh",1,-0.66,-0.11,135,0.82],["c","itemstandh",1,-0.13,0.2,0,0.82],["c","itemstandh",1,0.17,-0.17,338,0.82],["c","itemstandh",1,0.4,0.1,338,0.82],["c","itemstandh",1,0.87,-0.34,247,0.82],["m","itemstand","P-0.03","B0",1.66],["m","piece_walltorch","R0","P0.25",2.11],["m","itemstand","R0","P0.14",2.24],["m","itemstand","R0","P-0.05",2.24],["m","itemstand","R0","P0.18",2.25],["h","piece_brazierceiling01","P-0.32","P0.35",203,3.16],["h","piece_brazierceiling01","P-0.21","P-0.15",90,3.92]],"id":"RT-0373"},{"kind":"sleeping","W":4,"D":8,"fill":0.92,"doorU":-1,"fire":null,"dens":1.02,"open":[["d","F",-1,2]],"p":[["f","bed","R0.34","B0.46",180],["f","piece_chair","C0.02","B0.39",180],["f","ArmorStand","R0.31","F0.28",135]],"id":"RT-0374"},{"kind":"kitchen","W":9.5,"D":9.5,"fill":0.7,"doorU":-2.04,"fire":null,"dens":1.11,"open":[["w","F",-3.84,0.5],["w","F",-2.06,0.5],["w","L",0.75,1],["w","B",-4.38,2],["w","L",2.58,2],["w","R",0.1,5],["w","F",-4.13,1.25]],"p":[["f","jute_carpet_blue","L0.98","B0",0],["f","piece_chair03","P0.2","C-0.22",314],["f","piece_chair03","C-0.34","P0.18",134],["f","piece_chest","P-0.14","F0.09",134],["f","piece_preptable","R0.43","B0.83",225],["f","rug_asksvin","P0.07","P-0.04",157],["f","rug_asksvin","P0.19","P0.07",67],["f","rug_asksvin","P0.1","P0.19",337],["m","itemstand","P0.19","F0",1.87],["h","piece_brazierceiling01","P0.04","P0.05",180,3.92],["m","piece_dvergr_lantern","L0.51","B0",1.59]],"id":"RT-0375"},{"kind":"home","W":19,"D":14.5,"fill":0.58,"doorU":8.6,"fire":[-1.64,-5.56],"dens":1.38,"open":[["d","B",-5.51,4]],"p":[["f","forge","P0.08","P0.34",225],["f","piece_workbench","P-0.09","P0.3",135],["f","hearth","P-0.09","F0.69",0],["f","piece_throne01","P-0.29","P-0.33",45],["f","piece_table_round","P-0.08","P-0.17",90],["f","piece_bed02","L0.91","P-0.13",45],["f","piece_chest_blackmetal","P0.31","P-0.31",315],["f","rug_fur","P-0.25","P-0.24",225],["f","rug_deer","P-0.26","C-0.13",146],["c","rug_wolf",4,-0.79,-0.35,12,-0.03],["c","forge_ext5",0,-1.44,0.27,0,0.03],["c","piece_chair03",4,-1.18,-1.34,34,-0.01],["c","piece_chair03",4,-1.25,1.22,124,-0.01],["m","itemstand","P0.25","B0",1.75],["m","itemstand","P0.19","B0",1.75],["m","itemstand","P0.41","B0",1.94],["m","itemstand","P0.29","B0",1.97],["m","itemstand","P0.33","B0",1.97],["m","itemstand","P0.37","B0",1.98],["m","itemstand","P0.24","B0",2.26],["m","itemstand","P0.19","B0",2.29],["m","itemstand","P0.31","F0",2.67],["m","itemstand","P0.27","F0",2.7],["m","itemstand","P0.35","F0",2.7],["m","piece_banner01","L1.14","F0",3.81]],"id":"RT-0376"},{"kind":"home","W":15,"D":19,"fill":0.57,"doorU":4.37,"fire":[5.74,1.92],"dens":1.35,"open":[["d","B",-2.64,4]],"p":[["f","forge","P-0.29","P-0.1",45],["f","piece_workbench","P-0.28","P0.08",135],["f","hearth","R0.76","P0.1",90],["f","piece_throne01","P0.33","P0.3",225],["f","piece_bed02","P0.15","B0.97",225],["f","piece_table_round","P0.19","P0.1",180],["f","rug_wolf","P0.03","P0.23",135],["f","rug_fur","P0.24","P0.26",225],["c","piece_chair03",5,1.03,1.57,225,-0.06],["c","piece_chair03",5,1.38,-0.81,304,-0.06],["c","forge_ext5",0,1.42,0.06,90,0.03],["c","rug_deer",5,-0.38,0.03,0,-0.05],["c","forge_ext1",0,-2.08,0.18,0,0.04],["m","itemstand","P-0.15","F0",1.64],["m","itemstand","P-0.21","F0",1.67],["m","itemstand","C-0.01","F0",1.91],["m","itemstand","P0.05","F0",1.94],["m","itemstand","P-0.05","F0",1.95],["m","itemstand","P-0.09","F0",1.95],["m","itemstand","P-0.2","F0",2.24],["m","itemstand","P-0.15","F0",2.27],["m","itemstand","R0.61","F0",2.55],["m","itemstand","P0.38","F0",2.58],["m","itemstand","P0.32","F0",2.59],["m","piece_banner01","P0.21","B0",3.94]],"id":"RT-0377"},{"kind":"storage","W":2,"D":6,"fill":1,"doorU":0.5,"fire":null,"dens":2.5,"open":[],"p":[["f","piece_chest_blackmetal","L0.17","B0.26",270],["f","piece_chest_blackmetal","L0.16","C-0.02",270],["f","piece_chest_blackmetal","L0.14","F0.23",270]],"id":"RT-0378"},{"kind":"storage","W":2,"D":6,"fill":1,"doorU":-0.5,"fire":null,"dens":2.5,"open":[["w","L",-1,4]],"p":[["f","piece_chest_blackmetal","R0.12","C0.05",90],["f","piece_chest_blackmetal","R0.12","B0.2",90],["f","piece_chest_blackmetal","R0.12","F0.31",90]],"id":"RT-0379"},{"kind":"other","W":4,"D":7.5,"fill":0.83,"doorU":-1.13,"fire":null,"dens":2.8,"open":[["w","L",0.01,4],["w","F",0.89,2],["d","F",-1.13,2]],"p":[["f","jute_carpet","R0.11","F1.03",90],["f","jute_carpet","L0","F1.01",90],["f","jute_carpet","R0","B1",90],["f","piece_chest","C0.02","P0.22",270],["f","piece_chest","C-0.04","B0",270],["m","itemstand","R0","C-0.19",2.87],["m","piece_dvergr_lantern","L0.63","B0",3.43],["m","itemstand","R0","P-0.2",3.6],["m","itemstand","R0","P0.26",3.65],["m","piece_dvergr_lantern","L0.66","F0",3.69]],"id":"RT-0380"},{"kind":"other","W":4,"D":6,"fill":0.63,"doorU":-0.01,"fire":null,"dens":4,"open":[["w","F",-1.63,1],["w","B",-1.57,1]],"p":[["f","piece_chest","R0.27","F0.64",270],["f","piece_chest","P0.09","F0.85",270],["f","piece_chest","L0.6","C-0.34",0],["f","piece_chest","L0.61","P0.11",0],["f","piece_chest","L0.72","B0.94",0],["f","piece_chest","L0.69","B0",0]],"id":"RT-0381"},{"kind":"workshop","W":8,"D":6,"fill":0.64,"doorU":-1,"fire":null,"dens":0.98,"open":[["w","L",-2.5,1],["d","F",-1,2],["w","F",0.5,1]],"p":[["f","piece_workbench","C0.19","B0.34",180],["f","piece_table","L0.49","C0.14",90],["f","piece_chest_wood","P0.08","F0.15",270],["f","rug_deer","R0.77","C-0.05",90]],"id":"RT-0382"},{"kind":"kitchen","W":7.5,"D":7.5,"fill":0.89,"doorU":2,"fire":[-2.98,0.03],"dens":1,"open":[["w","L",3.37,0.75],["w","L",-3.38,0.75],["d","F",1.87,1.75],["d","R",-2,1.5],["d","B",1.87,1.75]],"p":[["f","fire_pit","L0.07","C0.03",180],["f","piece_chest_blackmetal","L0","B0",180],["f","piece_oven","L0.45","F1.05",0],["c","piece_cauldron",0,-0.06,-0.01,0,0.2],["h","piece_brazierceiling01","P0.13","C-0.03",90,3.88]],"id":"RT-0383"},{"kind":"storage","W":11.5,"D":9,"fill":0.53,"doorU":-2.15,"fire":[4.79,0.13],"dens":2.01,"open":[["w","B",-2.36,4.5],["w","B",2.95,2],["w","F",2.86,1.75],["w","R",0.25,3.75]],"p":[["f","fire_pit","R0.26","C0.13",270],["f","piece_table","P-0.17","P0.1",135],["f","piece_table","P0.16","F0.78",135],["f","piece_chest_wood","P0.16","P0.28",135],["f","piece_chest_wood","P0.05","B0",135],["f","piece_chest_wood","P0.1","B0.57",135],["f","piece_chest_wood","P0.21","P0.2",135],["c","piece_chair",1,0.95,0.99,33,-0.05],["c","piece_cauldron",0,0.07,0.12,326,0.2],["c","itemstandh",1,0.33,-0.35,33,0.82],["c","itemstandh",1,0.68,-0.34,348,0.82],["c","itemstandh",1,-0.28,0.25,202,0.82],["c","itemstandh",1,0.97,0.14,326,0.82],["c","itemstandh",2,-0.39,-0.37,337,0.82],["c","itemstandh",2,0.24,-0.48,90,0.82],["c","itemstandh",2,0.5,-0.32,326,0.82],["c","itemstandh",2,0.84,-0.33,11,0.82],["c","itemstandh",1,0.46,0.15,168,0.84],["m","itemstand","L0","F0",2.73],["m","itemstand","P-0.31","F0",2.74]],"stair":1,"id":"RT-0384"},{"kind":"storage","W":6.5,"D":7,"fill":0.22,"doorU":1.25,"fire":null,"dens":6,"open":[],"p":[["f","piece_chair","R0.09","B0.16",112],["f","piece_chair","R0.76","B0.3",79],["f","piece_chest_wood","P-0.2","B0.48",135],["f","piece_chest_wood","L0.01","P0.15",135],["f","piece_chest_wood","L0.07","P-0.1",90],["f","piece_chest_wood","L0.07","F0.56",90]],"id":"RT-0385"},{"kind":"storage","W":9,"D":9.5,"fill":0.7,"doorU":0.62,"fire":null,"dens":2.18,"open":[["w","L",0.16,2],["d","R",0.19,4],["d","F",-0.38,4]],"p":[["f","piece_chest_wood","P0.21","B0.87",135],["f","piece_chest_wood","P0.1","B0.16",90],["f","piece_chest_wood","R0.49","P-0.1",270],["f","piece_chest_wood","C-0.12","B0.25",90],["f","piece_chest_wood","P0.29","P-0.11",270],["f","piece_chest_wood","P-0.1","B0.24",90],["f","rug_fur","P-0.16","C-0.12",0],["f","piece_chest","P0.25","F1.09",315],["f","piece_chest_wood","P-0.24","B0.51",45],["f","piece_chest_wood","L0.87","B1.03",45],["f","piece_chair02","P-0.2","C0.27",247],["f","piece_chair02","P-0.21","P-0.13",292],["m","piece_banner04","P0.24","F0",2.72],["m","piece_banner01","L0.96","F0",2.74]],"id":"RT-0386"},{"kind":"living","W":8.5,"D":9,"fill":0.6,"doorU":-3.48,"fire":null,"dens":0.87,"open":[["w","F",-1.01,3.25],["w","F",-0.04,1.5],["w","F",2.01,4],["w","L",-0.6,2],["w","F",-2.8,1.25]],"p":[["f","piece_table_round","C0.05","C0.22",191],["f","rug_deer","C-0.04","P-0.17",79],["f","rug_wolf","R0.75","P0.08",157],["c","piece_chair03",0,0.69,1.46,214,-0.01],["c","piece_chair03",0,-1.47,0.08,90,-0.01],["c","piece_chair03",0,-0.03,-1.65,0,-0.01]],"id":"RT-0387"},{"kind":"other","W":9,"D":9.5,"fill":0.71,"doorU":-3.56,"fire":null,"dens":1.15,"open":[],"p":[["f","piece_groundtorch_mist","L0.08","P-0.17",270],["f","piece_groundtorch_mist","P-0.2","F0.46",270],["f","piece_groundtorch_mist","L0.22","P0.19",270],["f","piece_groundtorch_mist","P0.17","F0.39",270],["f","piece_groundtorch_mist","R0.42","P-0.17",270],["f","piece_groundtorch_mist","P0.19","B0.45",270],["f","piece_groundtorch_mist","R0.41","P0.16",270]],"id":"RT-0388"},{"kind":"sleeping","W":11.5,"D":11.5,"fill":0.82,"doorU":-0.99,"fire":null,"dens":3.05,"open":[["d","R",-1,2],["w","R",1,2],["d","F",-0.12,3.75],["d","R",1,2]],"p":[["f","forge","L0.35","P0.12",90],["f","piece_workbench","L0.24","B0.51",90],["f","bed","R0.52","B0",180],["f","bed","P0.3","B0.02",180],["f","piece_chair","P-0.2","B1.2",315],["f","piece_chair","P0.23","B0.28",158],["f","piece_chair","R0","B0.27",180],["f","piece_chest_blackmetal","R0","C0.14",270],["f","piece_chest_wood","L0.24","F0",0],["f","piece_chest_wood","L0.25","F0.44",0],["f","piece_chest_wood","P-0.24","F0",0],["f","piece_chest_wood","L0.26","F1.07",0],["f","piece_chest_wood","L0.26","P-0.31",180],["f","piece_chest_wood","L0.25","P-0.26",180],["f","piece_chest_wood","L0.26","P-0.2",180],["f","piece_chest_wood","L0.18","P-0.13",180],["f","piece_chest_wood","L0.17","P-0.08",180],["f","piece_chest_wood","R0","P-0.26",270],["f","rug_wolf","R0.77","F0.03",23],["f","rug_fur","P-0.12","P-0.13",68],["f","rug_deer","R0","P-0.1",46],["f","rug_deer","C0.06","F0.03",90],["f","rug_hare","P0.11","P-0.26",113],["f","rug_hare","P-0.17","P0.07",203],["f","jute_carpet","L0.26","P0.26",90],["f","ArmorStand","P0.21","P0.24",90],["c","piece_chest",2,-0.02,1.71,0,-0.02],["c","piece_chest",3,-0.03,1.68,0,-0.02],["m","sign","R0","P-0.26",1.16],["m","piece_dvergr_lantern","L0","P0.17",1.26],["m","sign","P-0.25","F0",1.29],["m","itemstand","R0","P-0.08",1.95],["m","sign","P0.15","F0",2.7],["m","piece_banner03","L0","P0.24",2.81],["m","piece_banner03","R0","P0.23",2.83],["m","itemstand","P-0.25","B0",3.3],["m","itemstand","L1.04","B0",3.31],["m","itemstand","L0","P0.1",3.31],["m","itemstand","L0","P0.23",3.32],["m","itemstand","L0","P0.35",3.32]],"id":"RT-0389"},{"kind":"living","W":3.5,"D":4,"fill":0.89,"doorU":-0.5,"fire":null,"dens":2.4,"open":[["w","L",0.08,3.75],["w","B",0.07,3.5],["w","R",0.42,3]],"p":[["f","piece_table","R0.07","B0",180],["c","piece_chair",0,-0.75,1.01,135,-0.05],["c","piece_chair",0,1.86,0.1,270,-0.05],["c","jute_carpet",0,0.56,0.85,180,0.02],["c","itemstandh",0,0.95,0.11,90,0.82],["c","itemstandh",0,0.5,-0.11,225,0.82],["c","itemstandh",0,0.59,0.33,180,0.82],["c","itemstandh",0,-0.19,0.23,180,0.82],["c","itemstandh",0,-0.52,0.36,90,0.82],["c","itemstandh",0,-0.73,-0.1,316,0.82]],"id":"RT-0390"},{"kind":"other","W":16.5,"D":14.5,"fill":0.2,"doorU":-7.77,"fire":null,"dens":1.07,"open":[["w","R",-6.37,0.75],["w","F",-2.06,5],["w","R",-3.14,1],["w","F",3.67,2.75],["w","R",2.44,1.75],["w","R",2.46,1.5],["w","R",-2.16,1.25],["w","R",2.49,1],["w","B",-7.06,1.5],["d","F",-7.06,4],["d","B",2.87,1],["d","B",4.12,1]],"p":[["f","piece_groundtorch_mist","L1.12","P-0.16",90],["f","piece_groundtorch_mist","P-0.27","P-0.38",90],["f","piece_groundtorch_mist","P0.05","P-0.38",90],["f","piece_groundtorch_mist","P0.31","P-0.11",180],["m","itemstand","R0","C0.06",1.96]],"id":"RT-0391"},{"kind":"hall","W":13,"D":13.5,"fill":0.15,"doorU":-4.76,"fire":null,"dens":1.94,"open":[["w","R",3.09,0.5],["w","L",-0.47,1],["w","L",1.74,1],["w","F",-4.59,3.75],["w","B",4.59,3],["w","B",-0.05,4],["w","B",-0.18,3.75],["w","B",-3.59,2],["w","L",3.78,2],["w","L",1.13,3],["w","L",-0.87,1]],"p":[["f","piece_throne01","L0.34","P0.26",90],["f","piece_groundtorch_green","R1.01","P0.26",225],["f","piece_groundtorch_green","P0.23","B0.84",225],["c","rug_deer",0,0.3,0.31,270,-0.04],["m","itemstand","P0.33","B0",0.72],["m","itemstand","P0.29","B0",3]],"id":"RT-0392"},{"kind":"storage","W":8,"D":8,"fill":0.84,"doorU":1.1,"fire":null,"dens":1.12,"open":[["w","L",-0.11,4],["w","R",-0.11,4],["d","F",-0.9,2],["d","F",1.1,2]],"p":[["f","piece_chest","L0.3","P0.25",90],["f","piece_chest","L0.3","C0.18",90],["f","piece_chest_wood","R0.16","P-0.18",270],["f","piece_chest","L0.34","P-0.21",90],["f","piece_chest","R0.19","F0.33",90],["f","piece_chest","L0.53","F0.34",0]],"id":"RT-0393"},{"kind":"living","W":8,"D":10,"fill":0.72,"doorU":1.12,"fire":null,"dens":1.22,"open":[["w","R",3.83,2],["d","F",1.12,2]],"p":[["f","piece_table","L0.59","P-0.16",0],["f","piece_table","L0.65","P-0.06",0],["f","piece_chest","L0.61","F0.16",0],["f","jute_carpet_blue","C0.31","P-0.12",0],["f","piece_chest","P-0.11","F0.17",0],["c","piece_chair03",1,-0.63,1.17,169,0.02],["c","piece_chair03",0,-0.6,-0.84,0,0.02],["c","piece_chair03",0,0.54,-0.92,0,0.02]],"id":"RT-0394"},{"kind":"living","W":8,"D":8,"fill":0.65,"doorU":0.17,"fire":null,"dens":1.69,"open":[["w","B",-1.5,1],["w","F",-1.47,1],["d","L",1.99,2],["d","F",0.17,2]],"p":[["f","piece_table","P0.06","B0.08",0],["f","piece_chest_wood","L0.43","B0.11",180],["f","ArmorStand","R0.84","F0.08",315],["c","piece_chair03",0,0.39,-0.65,0,0.02],["c","piece_chair03",0,-0.48,-0.68,0,0.02],["c","piece_chair03",0,-1.7,-0.2,106,0.02],["c","itemstandh",0,0.37,-0.41,180,0.82],["c","itemstandh",0,0.03,0.03,107,0.82],["c","itemstandh",0,-0.49,-0.36,180,0.82],["c","itemstandh",0,-0.93,0.08,180,0.82],["m","piece_banner01","P-0.22","B0",3.82]],"id":"RT-0395"},{"kind":"living","W":5.5,"D":3.5,"fill":0.92,"doorU":0.24,"fire":null,"dens":2.82,"open":[["w","R",0.01,3.5],["w","L",-0.04,3.5],["w","B",-0.04,5.5],["d","F",0.24,2]],"p":[["f","piece_table","C0.14","B0",90],["c","piece_bench01",0,-0.02,1.39,180,-0.01],["c","piece_bench01",0,-0.04,-1.45,0,-0.01],["m","piece_walltorch","L0.89","F0",1.46],["m","piece_walltorch","R0.38","F0",1.48]],"id":"RT-0396"},{"kind":"sleeping","W":5.5,"D":7.5,"fill":0.78,"doorU":-2.07,"fire":null,"dens":2.19,"open":[["w","R",-2.09,3.5],["w","F",-0.03,5.5],["w","B",-1.33,3],["w","L",-0.13,7.5]],"p":[["f","piece_table","C0.21","F0",180],["f","piece_bed02","L0.5","B0.05",180],["f","jute_carpet","R0","F0.76",270],["f","jute_carpet","L0","F0.79",270],["f","piece_chest","R0","F0.04",270],["f","piece_chest","L0.02","F0.01",90],["c","jute_carpet",1,-0.1,1.83,180,-0.04],["c","piece_chair03",0,0.67,-1.16,303,0.02],["m","wood_dragon1","R0.32","F0",2.9],["m","wood_dragon1","L0.68","F0",2.9]],"id":"RT-0397"},{"kind":"home","W":6,"D":6,"fill":1,"doorU":0.04,"fire":null,"dens":2.22,"open":[["d","F",0.04,2]],"p":[["f","piece_table","L0.48","F0.31",90],["f","piece_bed02","R0.06","P-0.08",270],["f","piece_chair","R0.21","B1.17",112],["f","piece_chair03","R0.41","F0.06",315],["c","piece_chair03",0,-0.01,0.59,180,0.02],["c","rug_wolf",1,-1.46,0.76,0,-0.04],["m","piece_banner01","L0.62","F0",3.83],["m","piece_banner01","R0.75","F0",3.81],["m","piece_walltorch","C0.03","F0",2.84]],"id":"RT-0398"},{"kind":"sleeping","W":6,"D":6,"fill":1,"doorU":0.04,"fire":null,"dens":2.22,"open":[["d","F",0.04,2]],"p":[["f","piece_bed02","L0.18","P-0.06",90],["f","piece_throne01","R0.39","F0.2",292],["f","rug_fur","R0.03","F1.08",0],["f","piece_chair","L0.67","B1.07",135],["f","piece_chair03","L0.3","F0.1",56],["c","piece_chest",0,0.07,2.14,180,-0.02],["m","piece_banner01","L0.66","F0",3.69],["m","piece_walltorch","C-0.01","F0",3.01],["m","piece_banner01","R0.69","F0",3.63]],"id":"RT-0399"},{"kind":"smithy","W":4,"D":10,"fill":1,"doorU":1,"fire":null,"dens":1,"open":[],"p":[["f","piece_workbench_ext3","L0.83","P-0.23",0],["f","piece_workbench_ext2","L0.34","F0.42",0],["f","forge_ext2","R1.19","P0.26",270],["f","forge_ext3","L0.74","P0.09",270]],"id":"RT-0400"},{"kind":"workshop","W":6,"D":17.5,"fill":0.87,"doorU":2,"fire":null,"dens":1.64,"open":[["w","F",1.42,0.5],["w","F",1.24,1.5],["w","R",0.81,0.25]],"p":[["f","piece_chair","C0.22","F0",22],["f","piece_chair","L0.13","P-0.36",22],["f","piece_workbench_ext3","R0.18","B0.38",270],["f","jute_carpet_blue","R0.65","F0.2",180],["f","rug_deer","C-0.26","B0.14",270],["f","jute_carpet_blue","L0.37","F0.78",180],["f","rug_deer","L0","B0",225],["f","piece_chest","L0.08","P0.34",90],["f","piece_chest","L0.06","P0.24",90],["f","jute_carpet_blue","C0.1","F0.91",180],["f","piece_chest_wood","L0.35","B0.16",90],["f","rug_deer","R0","B0.9",292],["f","ArmorStand","R0.4","P0.31",270],["f","ArmorStand","R0.27","P0.37",67],["m","itemstand","C-0.11","F0",0.5],["m","itemstand","L0","P0.22",0.51],["m","itemstand","L0","P0.34",0.52],["m","itemstand","L0","B0.56",0.58],["m","itemstand","R1.02","B0",1.62],["m","itemstand","P0.21","B0",2.42],["m","itemstand","L1.06","B0",2.53]],"id":"RT-0401"},{"kind":"hall","W":8,"D":9.5,"fill":0.64,"doorU":-0.61,"fire":null,"dens":0.82,"open":[["w","R",-0.89,7.75],["w","F",3.77,0.25],["w","F",2.27,0.75],["w","F",0.39,1],["w","F",-1.61,1],["w","F",-3.36,0.5],["w","F",3.53,1],["w","F",-3.22,0.5],["w","L",1.74,2]],"p":[["f","piece_throne01","L0.42","B0.14",45],["f","piece_table_round","P-0.16","P0.25",0],["f","jute_carpet","R0","B0.42",0],["f","jute_carpet","R0.91","F0.17",0],["c","jute_carpet",1,0.83,0.5,0,0],["h","piece_brazierceiling01","P0.18","P0.21",0,2.94],["m","piece_banner01","L0","P0.2",3.85]],"stair":1,"id":"RT-0402"},{"kind":"storage","W":5.5,"D":8,"fill":0.68,"doorU":-0.25,"fire":null,"dens":1.34,"open":[["w","B",-0.94,1],["w","B",0.59,1],["w","F",0.59,1],["w","F",2.13,1]],"p":[["f","piece_chest_blackmetal","P-0.11","B0.18",68],["f","piece_chest_blackmetal","C-0.03","P0.17",68],["f","piece_chest_blackmetal","R1.19","P-0.08",68],["f","piece_chest_blackmetal","R0.52","F0.79",68]],"id":"RT-0404"},{"kind":"storage","W":7.5,"D":5.5,"fill":0.71,"doorU":1.75,"fire":null,"dens":1.37,"open":[["w","R",-0.94,1],["w","R",0.59,1],["w","L",0.59,1],["w","L",2.13,1]],"p":[["f","piece_chest_blackmetal","R0.03","P-0.11",23],["f","piece_chest_blackmetal","P0.16","C0.1",23],["f","piece_chest_blackmetal","P-0.12","B1.1",23],["f","piece_chest_blackmetal","L0.45","B0.45",23]],"id":"RT-0405"},{"kind":"storage","W":7.5,"D":5.5,"fill":0.7,"doorU":-1.75,"fire":null,"dens":1.38,"open":[["w","R",2.02,1],["w","R",0.49,1],["w","L",0.49,1],["w","L",-1.11,1]],"p":[["f","piece_chest_blackmetal","R0.67","B0.68",337],["f","piece_chest_blackmetal","P0.07","P0.12",337],["f","piece_chest_blackmetal","P-0.2","C-0.2",337],["f","piece_chest_blackmetal","L0","P-0.15",337]],"id":"RT-0406"},{"kind":"storage","W":7.5,"D":5.5,"fill":0.7,"doorU":1.75,"fire":null,"dens":1.38,"open":[["w","R",-1.04,1],["w","R",0.49,1],["w","L",0.49,1],["w","L",2.02,1]],"p":[["f","piece_chest_blackmetal","R0","P-0.13",22],["f","piece_chest_blackmetal","P0.17","C-0.01",22],["f","piece_chest_blackmetal","P-0.1","P0.15",22],["f","piece_chest_blackmetal","L0.57","B0.57",22]],"id":"RT-0407"},{"kind":"other","W":14,"D":2,"fill":0.91,"doorU":2.53,"fire":null,"dens":3.14,"open":[["d","F",-3.97,2]],"p":[["f","piece_chest","P0.22","B0",0],["f","piece_chest","P0.12","B0",0],["f","piece_chest","P0.03","B0",0],["f","piece_chest","P-0.06","B0",0],["f","piece_chest","P-0.15","B0",0],["f","piece_chest","P-0.24","B0",0],["f","piece_chest","P-0.33","B0",0],["f","piece_chest","L0.55","B0",0]],"id":"RT-0408"},{"kind":"other","W":14,"D":2,"fill":0.91,"doorU":-2.53,"fire":null,"dens":3.14,"open":[],"p":[["f","piece_chest","P-0.23","B0",0],["f","piece_chest","P-0.13","B0",0],["f","piece_chest","P-0.05","B0",0],["f","piece_chest","P0.04","B0",0],["f","piece_chest","P0.13","B0",0],["f","piece_chest","P0.22","B0",0],["f","piece_chest","P0.31","B0",0],["f","piece_chest","R0.83","B0",0]],"id":"RT-0409"},{"kind":"storage","W":2,"D":3,"fill":1,"doorU":0.21,"fire":null,"dens":5,"open":[],"p":[["f","piece_chest_barrel","R0.24","B0.4",0],["f","piece_chest_barrel","R0.14","F1.09",0],["f","piece_chest_barrel","R0.04","F0.26",0]],"stair":1,"id":"RT-0410"},{"kind":"living","W":6,"D":7,"fill":0.7,"doorU":-0.72,"fire":null,"dens":1.02,"open":[],"p":[["f","piece_table_round","R0.57","C0.21",0],["f","rug_fur","C0.35","F0.9",0],["c","rug_fur",0,-1.1,0.72,0,-0.03],["c","piece_chair03",0,-1.05,-1.49,45,-0.01],["c","piece_chair03",0,-1.01,1.25,135,-0.01]],"id":"RT-0411"},{"kind":"other","W":8,"D":4,"fill":0.43,"doorU":-0.02,"fire":null,"dens":3.64,"open":[["d","F",-1,2]],"p":[["f","piece_chest","R0.32","B0",0],["f","piece_chest","P0.21","B0",0],["f","piece_chest","P-0.21","B0",0],["f","piece_chest","L0.32","B0",0],["f","piece_chest_blackmetal","C-0.01","B0.11",0]],"id":"RT-0412"},{"kind":"other","W":11.5,"D":4,"fill":0.77,"doorU":-2.25,"fire":null,"dens":1.41,"open":[["w","L",0.9,1],["w","B",-4.48,1],["w","B",-2.48,1],["w","B",-0.23,1.5],["w","B",1.98,1],["w","B",3.98,1],["w","F",2.75,1],["w","F",-3.25,1],["d","F",0.75,2],["w","R",0.9,1]],"p":[["f","piece_chest","P0.23","F0",0],["f","piece_chest_barrel","R0.43","C0.23",0],["f","piece_chest_barrel","R0.26","F1.07",0],["m","piece_dvergr_lantern","P-0.2","F0",3.59],["m","piece_dvergr_lantern","P0.15","F0",3.59]],"id":"RT-0413"},{"kind":"kitchen","W":3.5,"D":4.5,"fill":0.87,"doorU":1.14,"fire":null,"dens":5.82,"open":[["w","B",-0.96,1.5],["w","F",0.72,2.25]],"p":[["f","piece_preptable","L0.41","F0.19",180],["f","piece_preptable","L0","C0.02",270],["m","itemstand","L0","F0",1.02],["m","itemstand","L1.11","F0",1.02],["m","itemstand","C-0.05","F0",1.03],["m","itemstand","L0.19","F0",1.05],["m","itemstand","L0.53","F0",1.05],["m","itemstand","L0.83","F0",1.11]],"id":"RT-0414"},{"kind":"smithy","W":13.5,"D":9.5,"fill":0.59,"doorU":5.84,"fire":null,"dens":2.75,"open":[["w","B",-5.83,1.75],["w","L",-1.83,1],["w","F",0.73,1],["w","F",5.86,1.75],["w","F",-2.65,6],["w","R",4.47,0.5],["w","B",-2.17,1.5],["w","R",1.47,0.5],["w","R",-2.28,1],["w","R",4.47,0.5],["w","B",1.86,0.5],["w","B",-6.11,1.25],["w","L",2.2,2],["w","L",2.22,2],["w","L",4.45,0.75],["w","F",4.34,1],["w","R",-3.97,1.5],["w","B",-0.56,1.75],["w","R",-1.97,2],["w","F",-0.72,2]],"p":[["f","piece_chest","P-0.29","B0.08",180],["f","piece_chest_barrel","P-0.07","F0.5",90],["f","forge_ext5","L0","P-0.04",180],["m","itemstand","L0.29","B0",0.69],["m","sign","L0","P0.31",0.69],["m","sign","L0","P0.12",0.72],["m","itemstand","L0.31","B0",0.73],["m","itemstand","L1.04","F0",1.07],["m","itemstand","P0.37","F0",1.25],["m","sign","P0.21","F0",1.89],["m","piece_dvergr_lantern","P0.18","B0",1.89],["m","piece_dvergr_lantern","P-0.16","B0",1.89],["m","piece_dvergr_lantern","P-0.16","B0",2.85],["m","piece_dvergr_lantern","P0.18","B0",2.87],["m","piece_dvergr_lantern","R0","F0",3.01],["m","itemstand","P-0.32","B0",3.52],["m","itemstand","P-0.26","B0",3.52],["m","sign","P-0.29","B0",3.52],["m","piece_dvergr_lantern","R0","B0.33",3.83],["m","piece_dvergr_lantern","P-0.23","F0",3.84],["m","piece_dvergr_lantern","P-0.15","B0",3.86]],"id":"RT-0415"},{"kind":"storage","W":9.5,"D":9.5,"fill":0.78,"doorU":-0.08,"fire":null,"dens":1.14,"open":[["w","L",-0.07,4],["w","L",-3.47,2],["w","L",-2.96,2],["w","R",-2.96,2],["d","R",-1.06,2],["w","F",-0.02,2],["w","L",-1.26,1.5],["w","R",1.26,1.25],["w","L",-1.06,2],["w","R",1.25,1.25],["w","L",1.05,1.75],["w","B",-3.11,3.25],["w","F",-3.09,3.25]],"p":[["f","piece_chest","R1.13","B0.3",270],["f","piece_chest_barrel","P-0.09","B0.01",90],["f","piece_preptable","L0.43","B0",0],["f","piece_chest","R0.18","B0.3",270],["f","piece_chest_barrel","P-0.17","B0.13",90],["f","piece_chair","R0.66","P-0.29",124],["f","ArmorStand","P0.04","B0.17",180],["f","piece_chair03","P0.27","F0.48",349],["f","rug_fur","R0.84","C0.05",90]],"id":"RT-0416"},{"kind":"sleeping","W":6,"D":6,"fill":0.67,"doorU":-2.17,"fire":null,"dens":1.65,"open":[["d","F",-2.04,1.75],["w","B",-1.43,3],["w","B",2.08,3.25],["w","B",0.42,0.25]],"p":[["f","ashwood_bed","L0.35","B0.26",180],["f","piece_chair03","P0.14","B0.46",214],["f","piece_chest_wood","R0.21","B0.8",214],["c","piece_chest_barrel",0,-1.22,-1.05,0,-0.02],["c","rug_fur",0,-1.26,1.36,45,-0.02]],"id":"RT-0420"},{"kind":"sleeping","W":6,"D":5.5,"fill":0.92,"doorU":-2.1,"fire":null,"dens":1.97,"open":[["d","F",-2.1,2]],"p":[["f","ashwood_bed","R0.39","B0.64",270],["f","ashwood_bed","R0.35","F0.34",270],["f","piece_chair03","L0","C0.22",45],["f","piece_chest_barrel","R0.3","C-0.16",270],["c","piece_chest_wood",0,0.1,1.85,0,-0.02],["c","piece_chest_wood",1,-0.11,1.84,0,-0.02],["c","rug_fur",1,1.32,0.74,270,-0.02]],"id":"RT-0421"},{"kind":"sleeping","W":6,"D":5.5,"fill":0.71,"doorU":2.1,"fire":null,"dens":1.7,"open":[["d","F",2.1,2],["w","L",3.14,0.5],["w","L",2.31,1],["w","B",0.47,5]],"p":[["f","piece_bed02","R0.31","B0",180],["f","piece_chair03","P-0.12","B0.15",180],["f","piece_chest_barrel","C0","B0",90],["f","piece_chest_wood","L0.14","B0.27",135],["c","rug_fur",0,1.09,1.06,315,-0.04]],"id":"RT-0422"},{"kind":"sleeping","W":6,"D":5.5,"fill":1,"doorU":-1.9,"fire":null,"dens":2.42,"open":[["d","F",-1.9,2],["w","B",0.22,5.5]],"p":[["f","ashwood_bed","R0.12","F0.63",270],["f","ashwood_bed","R0.14","B0.51",270],["f","piece_chair03","L0.31","P0.07",22],["f","piece_chair03","L0.28","B0",124],["f","piece_chest_barrel","L0.36","B1.01",90],["f","piece_chest_barrel","R0.07","C0.08",90],["c","piece_chest_wood",0,-0.11,1.85,0,-0.02],["c","piece_chest_wood",1,0.11,1.85,0,-0.02],["c","rug_fur",1,-1.37,0.94,90,-0.02]],"id":"RT-0423"},{"kind":"tavern","W":10,"D":14,"fill":0.72,"doorU":3.81,"fire":null,"dens":1.78,"open":[["w","F",-0.79,4]],"p":[["f","piece_table","C0.22","P-0.32",180],["f","piece_table","P-0.18","P-0.32",180],["f","piece_table","P-0.22","P0.09",270],["f","piece_table","P-0.22","P-0.05",270],["f","piece_table","P-0.22","P-0.2",270],["f","piece_table","L0.38","P0.13",180],["f","ArmorStand","R0.39","P-0.14",270],["f","piece_chest_wood","P0.16","F0.3",90],["c","piece_bench01",0,0.15,-0.78,0,0.01],["c","piece_bench01",2,-0.84,-0.74,0,0.01],["c","piece_bench01",4,0.57,-0.73,0,0.01],["c","piece_chair02",2,1.02,-0.91,337,0.04],["m","piece_walltorch","L0","P-0.21",2.26],["m","piece_walltorch","R0","P0.08",2.32],["m","piece_walltorch","P0.11","F0",3.21],["m","piece_banner03","L0","C0.1",3.26],["m","piece_banner03","R0","P0.31",3.26],["m","piece_banner03","R0","P-0.14",3.27]],"id":"RT-0424"},{"kind":"tavern","W":8,"D":8,"fill":1,"doorU":-1.03,"fire":null,"dens":2.5,"open":[["d","F",-1.03,2]],"p":[["f","piece_cartographytable","R0.31","B1",270],["f","piece_table","R0.61","F0.47",0],["f","piece_table","L0.35","F0.41",90],["f","piece_throne01","L0.27","P-0.08",90],["f","piece_chair","P-0.06","B0.52",90],["f","piece_groundtorch_wood","R0.14","B0.16",180],["f","piece_groundtorch_wood","R0.08","F0.07",113],["c","piece_bench01",1,0.03,0.79,180,0.02],["c","piece_chair02",1,-1.53,-0.11,68,0.04],["m","piece_walltorch","P-0.32","F0",1.79],["m","piece_walltorch","P0.31","B0",1.79],["m","itemstand","P0.06","F0",2.19],["m","itemstand","P0.06","F0",2.33],["m","piece_banner02","C-0.06","B0",2.98],["m","itemstand","C-0.02","F0",3.42],["m","itemstand","C-0.09","B0",3.69]],"id":"RT-0425"},{"kind":"hall","W":8,"D":9.5,"fill":0.98,"doorU":0.82,"fire":null,"dens":1.07,"open":[["d","F",0.82,2]],"p":[["f","piece_cartographytable","L0.87","F0.16",0],["f","piece_table","L0.07","P-0.05",270],["f","piece_throne01","P0.09","B0.02",180],["c","piece_chair",1,2.04,-0.27,180,-0.05],["c","piece_chair02",1,-1.4,0,113,0.04],["m","piece_walltorch","L1.12","F0",1.7],["m","piece_walltorch","R0.48","B0",2.25],["m","itemstand","P-0.22","B0",3.25]],"id":"RT-0426"},{"kind":"hall","W":22,"D":14,"fill":0.54,"doorU":4.02,"fire":[-0.08,1.88],"dens":1.32,"open":[["w","B",9.7,2.5],["w","B",6.2,2.5],["w","F",9.7,2.5],["w","F",6.2,2.5],["d","B",-5.07,4],["w","R",0.92,2],["w","L",0.92,2],["w","L",-4.61,1],["d","F",-2.94,4],["d","F",4.02,2],["d","F",-8,2]],"p":[["f","piece_throne01","P0.05","P-0.17",0],["f","fire_pit","C-0.08","P0.13",90],["f","hearth","P0.35","C0.02",180],["f","piece_bench01","P-0.16","P0.28",270],["f","rug_deer","P-0.23","B0.8",0],["f","piece_chest","P0.26","P0.27",90],["c","piece_chair",1,0,-2.84,180,-0.07],["c","piece_logbench01",2,-1.34,2.59,0,0.01],["c","piece_logbench01",2,1.44,2.63,0,0.01],["c","piece_cauldron",1,0.14,0.09,292,0.2],["c","piece_cookingstation_iron",2,-0.01,-0.51,180,0.58],["c","piece_cookingstation_iron",2,-0.03,0.33,0,0.58],["m","itemstand","R0","P0.06",1.4],["m","itemstand","P-0.25","F0",1.42],["m","sign","L0","P0.28",1.96],["m","itemstand","R0","P0.12",2.09],["m","itemstand","P-0.28","F0",2.42],["m","itemstand","R0","P0.03",2.46],["m","itemstand","P-0.25","F0",2.98],["m","sign","P0.18","F0",3.36],["m","piece_banner02","R0","P-0.29",3.5],["m","piece_banner01","L0","P0.27",3.73],["m","piece_banner01","R0","P0.28",3.78]],"id":"RT-0427"},{"kind":"storage","W":4,"D":6,"fill":0.97,"doorU":-1.02,"fire":null,"dens":6.88,"open":[["d","R",-2.02,2],["d","F",-1.02,2]],"p":[["f","rug_deer","R0.16","P0.08",0],["f","rug_deer","L0.18","P0.08",0],["f","piece_chest_wood","R0.32","B0.55",90],["f","piece_chest_wood","R1.14","B0.58",90],["f","piece_chest_wood","L1","B0.57",90],["f","piece_chest_wood","L0.22","B0.56",90],["m","sign","R0","P0.12",1.06],["m","sign","L0","P0.12",1.09],["m","itemstand","L0","F0.46",1.98],["m","itemstand","L0","B0.59",2],["m","sign","L0","P0.12",2.02],["m","sign","R0","P0.12",2.03],["m","piece_walltorch","L0","C0",2.05],["m","sign","L0","P0.12",3],["m","sign","R0","P0.12",3.01],["m","sign","R0","F0.55",3.36],["m","sign","L0.57","F0",3.42],["m","piece_banner02","R0.53","B0",3.5]],"id":"RT-0428"},{"kind":"home","W":16,"D":10,"fill":0.86,"doorU":-2.01,"fire":null,"dens":0.87,"open":[["w","F",-6.99,2]],"p":[["f","piece_cartographytable","P-0.11","P-0.25",180],["f","piece_table_round","P-0.04","P0.2",180],["f","piece_bed02","R0.53","C0.02",270],["f","rug_fur","R0.73","P0.17",270],["f","rug_fur","R0.66","P-0.2",270],["f","rug_wolf","P-0.1","P-0.1",270],["f","piece_chest","P0.33","P0.33",180],["f","ArmorStand","L0.69","P0.15",112],["c","piece_chair03",1,-1.56,-0.56,44,-0.01],["c","piece_chair03",1,1.61,-0.25,315,-0.01],["c","treasure_stack",1,0.05,0.15,315,0.78],["c","treasure_stack",1,0.3,0.53,315,0.78],["m","itemstand","P0.19","B0",1.19],["m","piece_walltorch","L0.32","F0",1.73],["m","piece_walltorch","R0","C0.01",2],["m","itemstand","R0","P0.14",2.22],["m","itemstand","R0","P-0.16",2.26]],"id":"RT-0429"},{"kind":"other","W":5.5,"D":7.5,"fill":0.85,"doorU":0.5,"fire":null,"dens":1.42,"open":[],"p":[["f","fermenter","P0.13","B0",180],["f","fermenter","L0","B0",180],["f","fermenter","P-0.14","B0.04",180],["f","fermenter","R0","B0.1",180],["h","piece_brazierceiling01","C0.09","B0.92",135,2.99]],"id":"RT-0430"},{"kind":"smithy","W":8,"D":6,"fill":0.8,"doorU":1,"fire":null,"dens":4.42,"open":[["d","B",-3,2],["w","F",1.01,2]],"p":[["f","forge","R0.12","P-0.09",90],["f","piece_workbench","L0.41","F0.98",90],["f","piece_chair03","P0.23","F0.92",247],["f","rug_wolf","L1.19","B0",180],["f","rug_fur","P-0.06","F0.68",180],["f","rug_fur","P0.12","F1.08",0],["f","piece_chest","L0.29","B0.38",90],["f","forge_ext2","P-0.04","F0.33",270],["f","piece_chair02","L0.77","P0.13",90],["c","forge_ext4",0,-1.32,0.09,180,-0.01],["c","forge_ext1",0,1.49,-0.38,180,0.04],["m","piece_walltorch","P-0.08","F0",1.23],["m","piece_walltorch","L0","P0.06",1.52],["m","piece_walltorch","R0","P0.17",1.66],["m","sign","L0.08","B0",1.91],["m","itemstand","P0.21","F0",1.99],["m","itemstand","C0.29","F0",1.99],["m","itemstand","P-0.16","F0",2],["m","itemstand","L0.96","F0",2.01],["m","piece_dvergr_lantern","L0","C0",3.69]],"id":"RT-0431"},{"kind":"sleeping","W":5,"D":4,"fill":0.88,"doorU":0.5,"fire":null,"dens":6.29,"open":[["w","B",0.5,4],["d","F",0.5,2],["w","F",-1.5,2],["w","R",-0.5,3]],"p":[["f","piece_bed02","L0.05","B0.41",90],["f","piece_chest","R0.36","B0.84",270],["f","ArmorStand","R0.09","F0.33",270],["c","rug_fur",0,0.7,-0.1,270,-0.07],["c","rug_fur",0,0.84,1.69,270,-0.07],["m","itemstand","R0","F0",1.51],["m","itemstand","R0","B0.3",1.64],["m","itemstand","L0","F0",2.27],["m","piece_walltorch","R0","F0",2.36],["m","piece_walltorch","L0","F0",2.37],["m","itemstand","R0","C0.06",2.57],["m","itemstand","L0","F0.72",2.87],["m","itemstand","L0","B0.65",2.9]],"id":"RT-0432"},{"kind":"kitchen","W":10,"D":8,"fill":0.81,"doorU":2,"fire":null,"dens":1.85,"open":[["w","R",0,3],["w","B",-4,2],["d","F",2,2],["w","F",4,2],["w","B",-1.5,3],["w","R",1.25,1.5],["w","L",1.25,1.5],["w","L",0,3]],"p":[["f","piece_table_round","P0.24","B0.58",0],["f","jute_carpet","R1.11","P0.06",180],["f","jute_carpet","P0.18","F0.06",180],["f","jute_carpet","P0.08","P0.06",180],["f","jute_carpet","C-0.09","B0.22",180],["f","jute_carpet","L0.16","B1.05",270],["f","fermenter","R0.18","P-0.2",270],["f","piece_preptable","P-0.15","P0.24",180],["f","jute_carpet","L1.12","P0.06",180],["f","piece_chest","L0.3","B1.16",180],["c","piece_chair03",0,1.72,0.04,270,-0.03],["c","piece_chair03",0,0.15,-1.52,0,-0.03],["c","piece_chair03",0,-1.77,0.17,90,-0.03],["c","jute_carpet",0,0.36,-0.56,180,-0.03],["c","itemstandh",0,0.8,-0.36,337,0.8],["c","itemstandh",0,0.54,0.68,337,0.8],["c","itemstandh",0,0.44,-0.85,270,0.8],["c","itemstandh",0,0.26,-0.25,337,0.8],["c","itemstandh",0,0.21,0.23,337,0.8],["c","itemstandh",0,-0.09,-0.78,337,0.8],["c","itemstandh",0,-0.2,0.78,337,0.8],["c","itemstandh",0,-0.26,-0.08,0,0.8],["c","itemstandh",0,-0.6,-0.55,337,0.8],["c","itemstandh",0,-0.7,0.39,337,0.8],["m","itemstand","R0","P0.25",1.98],["m","itemstand","R0.77","F0",2.27],["m","itemstand","R0","B1.02",2.29],["m","piece_walltorch","R0.99","F0",2.37],["m","piece_dvergr_lantern","P0.25","B0",3.4]],"id":"RT-0433"},{"kind":"home","W":3.5,"D":8,"fill":1,"doorU":1.04,"fire":null,"dens":4.29,"open":[["d","F",0.91,1.75]],"p":[["f","bed","L0.31","P0.17",180],["f","piece_table","R0","P0.2",270],["f","piece_workbench","L0.23","F0.49",90],["f","rug_deer","R0","F0.6",180],["c","piece_chair02",1,-1.87,0.17,0,-0.02],["c","piece_workbench_ext1",2,-2.07,-0.3,180,0.01],["c","rug_fur",0,-0.92,0.21,0,-0.02],["c","rug_wolf",2,-0.64,0.44,90,0],["c","itemstandh",1,-0.95,0.15,0,0.81],["c","itemstandh",1,-0.96,-0.31,338,0.81],["c","itemstandh",1,-0.45,0.03,22,0.81],["c","itemstandh",1,0.17,0.38,0,0.81],["c","itemstandh",1,0.24,-0.13,0,0.81],["m","itemstand","R0","C-0.13",2.16],["m","itemstand","R0","P-0.11",2.14],["m","itemstand","R0","P0.08",2.13],["m","itemstand","R0","P-0.24",2.15],["c","itemstandh",1,0.84,-0.09,0,0.81],["m","itemstand","R0","P0.2",2.15],["m","piece_banner02","R0","B0.51",3.34],["m","piece_banner02","L0","B0.39",3.4]],"id":"RT-0434"},{"kind":"other","W":16.5,"D":17,"fill":0.48,"doorU":-1.08,"fire":null,"dens":0.81,"open":[["w","B",4.42,2],["w","F",4.42,2],["w","B",4.42,2],["w","F",-4.37,2]],"p":[["f","piece_groundtorch_green","L0.32","P-0.17",90],["f","piece_groundtorch_green","L0","P0.21",90],["m","piece_dvergr_lantern","P-0.07","B0",1.59],["m","piece_dvergr_lantern","P0.11","F0",1.59],["m","sign","P0.19","B0",2.18],["m","piece_dvergr_lantern","L0","P0.08",3.59],["m","piece_dvergr_lantern","L0","P-0.04",3.59],["m","sign","P0.23","F0",3.82],["m","sign","C0.32","F0",3.86],["m","piece_banner05","R0","P0.19",3.92],["m","piece_banner05","R0","P-0.14",3.94]],"id":"RT-0435"},{"kind":"hall","W":4,"D":8.5,"fill":0.83,"doorU":-1.11,"fire":null,"dens":1.42,"open":[],"p":[["f","piece_cartographytable","R0.48","B1.02",270],["f","piece_throne01","R0.42","F0.51",270],["f","piece_throne01","R0.33","P-0.16",270],["f","rug_fur","L0.13","F0.68",0],["f","piece_groundtorch_green","R0.22","C0.02",293],["c","rug_fur",0,0.11,1.36,90,0.02]],"id":"RT-0436"},{"kind":"sleeping","W":9.5,"D":13.5,"fill":0.7,"doorU":1.92,"fire":null,"dens":1.78,"open":[["w","R",-3.86,2],["d","R",-0.86,4]],"p":[["f","piece_bed02","P-0.11","F0.06",270],["f","piece_bed02","P-0.1","B0",270],["f","piece_chest_blackmetal","L0.15","P0.32",180],["f","piece_chest_blackmetal","L0.06","P-0.3",0],["f","rug_wolf","R0.09","P-0.06",180],["f","rug_fur","P-0.09","P0.27",90],["f","rug_fur","P-0.13","P-0.22",90],["f","piece_chest","L0.37","P0.24",180],["f","piece_chest","L0.2","P-0.22",0],["f","piece_groundtorch_green","P0.33","P-0.32",157],["c","piece_groundtorch_green",1,-1.29,-1.77,247,-0.14],["c","piece_groundtorch_green",1,-1.36,1.66,247,-0.14],["c","piece_groundtorch_green",0,1.39,-1.62,247,-0.14],["c","piece_groundtorch_green",0,1.52,1.64,247,-0.14],["m","sign","L0.27","F0",2.29],["m","piece_dvergr_lantern","R0","P0.08",3.59],["m","piece_dvergr_lantern","P-0.11","B0",3.59],["m","piece_dvergr_lantern","R0","P-0.21",3.59],["m","piece_dvergr_lantern","P-0.11","F0",3.59]],"id":"RT-0437"},{"kind":"sleeping","W":6,"D":17.5,"fill":0.84,"doorU":-3.93,"fire":null,"dens":1.25,"open":[["w","F",0.04,6],["w","R",-7.31,3],["w","R",-3.56,3.5],["w","R",-0.06,0.5],["w","R",2.94,2.5],["w","R",6.69,4],["w","B",0.2,5.5]],"p":[["f","piece_table","P-0.18","C0.02",90],["f","bed","R1.15","F0",0],["f","bed","P-0.18","F0",0],["f","bed","L0.37","P-0.16",90],["f","bed","L0.41","P0.16",90],["f","bed","R1.18","B0",180],["f","bed","L1.06","B0",180],["f","piece_chair","P0.07","B0",180],["f","piece_chair","P-0.06","B0",180],["c","rug_fur",5,1.2,0.37,0,-0.07],["c","piece_chair02",0,1.11,1.06,225,0.04],["c","piece_chair02",0,-0.78,1.15,136,0.04]],"stair":1,"id":"RT-0438"},{"kind":"storage","W":8,"D":8,"fill":0.88,"doorU":0,"fire":null,"dens":1.43,"open":[["w","L",0,8],["w","B",0,8],["w","R",0,8]],"p":[["f","piece_chest_wood","L0.32","F0.78",180],["f","piece_chest_wood","L0.32","P-0.27",180],["f","piece_chest_wood","L0.35","F0.07",180],["f","piece_chest_wood","R0.38","F0.19",180],["f","piece_chest_wood","R0.38","P-0.25",180],["f","piece_chest_wood","R0.36","F0.89",180],["f","piece_groundtorch_wood","P-0.25","P-0.25",180],["f","piece_groundtorch_wood","P0.25","P-0.25",180]],"id":"RT-0439"},{"kind":"other","W":3.5,"D":4.5,"fill":0.52,"doorU":-0.09,"fire":null,"dens":6.06,"open":[["w","B",-0.27,2]],"p":[["f","rug_hare","R0","B0",180],["f","rug_hare","R0","B0.65",180],["f","rug_hare","L0","F0.09",270],["f","rug_hare","R0","F0.38",180],["f","piece_chest_barrel","L0.85","B0.12",270],["f","piece_chest_barrel","R0.22","F0.79",180],["m","itemstand","R0","F1.02",1.51],["m","itemstand","R0","B0.36",1.55],["m","itemstand","C-0.17","F0",1.86]],"id":"RT-0440"},{"kind":"living","W":8,"D":22,"fill":0.58,"doorU":1.33,"fire":null,"dens":1.18,"open":[["w","B",4.33,1],["w","F",4.33,1],["w","L",0.99,8],["w","F",2.96,1],["w","R",2.55,2],["w","R",-0.2,3.5]],"p":[["f","piece_cartographytable","P0.22","P0.04",90],["f","piece_chair03","P-0.08","P-0.38",22],["f","piece_chair03","C-0.28","P-0.26",180],["c","rug_fur",0,0.03,-0.99,0,0.02],["m","itemstand","R0","P0.09",2.26],["m","itemstand","R0","P-0.02",2.38],["m","piece_banner05","R0","P0.18",3.62],["m","piece_banner01","R0","P-0.09",3.72],["m","piece_banner05","L0","P0.05",3.76],["h","piece_brazierceiling01","P-0.13","P-0.04",0,3.78],["h","piece_brazierceiling01","P-0.14","P0.13",0,3.78],["m","piece_banner01","L0","P0.19",3.81],["m","piece_banner03","L0","P-0.1",3.84]],"id":"RT-0441"},{"kind":"living","W":4,"D":5.5,"fill":0.81,"doorU":1.01,"fire":null,"dens":2.82,"open":[["w","B",-1.04,2],["w","F",1.01,2]],"p":[["f","piece_table","L0.5","P0.09",0],["f","piece_chair","R0.22","B0",22],["c","piece_chair03",0,-0.13,1.38,157,0.02],["c","jute_carpet",0,0.44,0.16,0,0.02],["c","itemstandh",0,0.91,-0.2,337,0.82],["m","sign","L0","C0.27",1.07],["h","piece_brazierceiling01","L0.54","C0.27",0,2.52]],"id":"RT-0442"},{"kind":"workshop","W":8,"D":7.5,"fill":0.73,"doorU":-3.25,"fire":null,"dens":1.15,"open":[],"p":[["f","piece_workbench","P-0.19","P-0.05",90],["f","piece_table_round","R0.6","B0.43",90],["f","rug_deer","C-0.31","P-0.12",134],["f","piece_chest_barrel","C0.09","B0.33",90],["c","piece_workbench_ext1",0,-1.71,0.18,270,0.01],["m","itemstand","L0","P0.12",2.24]],"id":"RT-0443"},{"kind":"smithy","W":18,"D":12,"fill":0.81,"doorU":-7.73,"fire":[7.52,0.12],"dens":1.42,"open":[["d","F",-2.98,2],["d","F",-0.98,2],["w","L",3.62,1],["w","L",-0.88,6],["w","L",-5.38,1],["w","F",4.52,1],["w","F",1.52,1],["w","R",5.62,1],["w","B",-5.98,2],["w","B",-0.48,1],["w","B",3.02,2]],"p":[["f","forge","L0.27","P-0.24",90],["f","piece_workbench","L0.2","P0.18",90],["f","hearth","R0.48","C0.12",270],["f","piece_artisanstation","P-0.35","F0.23",0],["f","piece_chest_wood","L0.22","P-0.04",180],["f","piece_chest_wood","L0.24","C0.24",180],["f","piece_chest_wood","P-0.22","P0.15",0],["f","piece_chest_wood","P-0.22","P0.21",0],["f","forge_ext5","P-0.24","F0",90],["f","rug_deer","P-0.07","F0.73",45],["f","rug_deer","P-0.12","B0",315],["f","rug_deer","P0.25","C0.33",0],["f","piece_oven","P0.22","B0.58",90],["f","piece_chest","L0.32","B1.04",180],["f","piece_chest","L0.33","B0.1",180],["f","ArmorStand","P0.04","F0.49",0],["f","ArmorStand","P0.1","F0.33",0],["f","piece_workbench_ext2","P-0.34","B0",180],["c","forge_ext4",0,1.4,-0.05,90,-0.01],["c","forge_ext1",0,-1.32,-0.05,0,0.04],["c","piece_cauldron",2,-1.2,0.6,202,0.58],["c","piece_cookingstation",2,0.09,0.14,270,0.58],["c","piece_cookingstation_iron",2,-0.03,-0.33,180,0.58],["c","piece_cookingstation",2,0.4,0.1,270,0.58],["c","piece_cookingstation",2,0.79,0.12,270,0.58],["c","piece_cookingstation",2,1.17,0.17,270,0.58],["m","piece_walltorch","P-0.03","B0",2.02],["m","piece_walltorch","P-0.3","B0",2.14]],"id":"RT-0444"},{"kind":"smithy","W":8,"D":2,"fill":1,"doorU":-2.25,"fire":null,"dens":2.5,"open":[["w","L",0.12,2],["w","B",0.02,8]],"p":[["f","forge","L0.3","F0.14",90],["f","fermenter","P-0.12","B0.23",180],["f","fermenter","P0.13","F0.19",180],["f","fermenter","R0.34","B0.28",180]],"id":"RT-0445"},{"kind":"sleeping","W":7,"D":9,"fill":0.97,"doorU":0,"fire":null,"dens":1.8,"open":[["w","R",-2.38,2]],"p":[["f","piece_throne01","L0.48","P0.12",90],["f","piece_table_round","L0.33","P-0.1",0],["f","piece_bed02","R0.04","P0.18",270],["f","ArmorStand","R0.82","B0.71",270],["f","rug_wolf","P-0.18","P0.18",0],["f","piece_chest","P-0.06","P-0.23",90],["f","piece_chest","P0.08","P-0.23",90],["f","piece_chest","P0.22","P-0.23",90],["f","piece_chest","R0.61","P-0.23",90],["f","ArmorStand","R0.79","C-0.3",270],["f","piece_groundtorch","R0.29","B0.53",180],["f","piece_groundtorch","R0.45","P-0.09",180],["c","itemstandh",1,0.35,0.39,23,0.8]],"id":"RT-0446"},{"kind":"sleeping","W":7.5,"D":7.5,"fill":0.8,"doorU":1,"fire":null,"dens":0.88,"open":[],"p":[["f","piece_bed02","R0","P0.17",270],["f","piece_chair","R0.13","B0",45],["f","piece_chair","R0","P-0.06",315],["f","piece_chest_barrel","R0","B0.63",90]],"id":"RT-0447"},{"kind":"living","W":10,"D":6,"fill":0.82,"doorU":2,"fire":null,"dens":1.22,"open":[],"p":[["f","piece_table","P-0.23","B0.34",0],["f","piece_table_round","P0.17","C-0.02",225],["f","piece_chair03","P0.31","B0.75",225],["c","piece_chair03",1,1.55,-0.88,282,-0.01],["c","piece_chair03",1,-1.57,-1.29,34,-0.01],["c","piece_chair02",0,1.69,-0.06,225,0.04]],"id":"RT-0448"},{"kind":"sleeping","W":10,"D":10,"fill":1,"doorU":-0.08,"fire":null,"dens":1.1,"open":[["w","B",2.42,1],["w","B",-2.58,1],["d","F",-0.08,2]],"p":[["f","piece_workbench","L0.62","P-0.29",90],["f","bed","R0.75","P0.07",180],["f","piece_table","R0.47","B0.49",90],["f","piece_chest_wood","P-0.2","F0.33",0],["f","rug_wolf","P0.15","P0.07",180],["c","piece_chair02",2,-0.05,-0.99,0,-0.02],["m","itemstand","C-0.06","F0",3.84],["m","piece_banner01","P0.16","F0",2.92],["m","itemstand","P-0.2","B0",2.8],["m","itemstand","C-0.07","B0",3.77],["m","itemstand","P0.21","B0",2.75],["m","piece_banner01","P-0.14","F0",2.93]],"id":"RT-0449"},{"kind":"workshop","W":6,"D":11,"fill":0.64,"doorU":0.34,"fire":null,"dens":2.37,"open":[["w","R",-4.79,0.5],["w","R",-3.79,0.5],["w","R",1.46,2],["w","B",-2.87,0.25],["w","F",-2.87,0.25],["w","B",1.78,2.25],["w","R",3.48,3],["w","B",-1.22,0.75]],"p":[["f","piece_workbench","L0.32","P0.12",90],["f","jute_carpet","L0.64","P-0.25",180],["f","piece_chair03","R0.52","F0.01",338],["f","piece_chest","L0.3","P-0.09",180],["c","jute_carpet",0,-0.04,0.76,90,0.02],["m","itemstand","R1.08","F0",2.77],["m","itemstand","R0","F0.67",1.76],["m","itemstand","R0","F0.65",3.14],["m","piece_banner01","L0.4","B0",3.81],["h","piece_brazierceiling01","P0.11","P-0.11",270,3.58],["m","piece_dvergr_lantern","L0","B0",2.69],["m","piece_dvergr_lantern","L0","P0.13",2.69]],"id":"RT-0450"},{"kind":"storage","W":9.5,"D":7,"fill":0.89,"doorU":-0.1,"fire":null,"dens":2.37,"open":[["w","R",-0.65,2],["w","R",2.35,1.5],["w","B",-0.04,9.5],["d","F",-0.1,2],["w","L",1.44,4],["w","L",2.45,2]],"p":[["f","piece_chest_wood","R0.31","B0.79",90],["f","piece_chest_wood","P0.32","B0.81",90],["f","piece_chest_wood","P0.21","B0.82",90],["f","piece_chest_wood","P0.11","B0.8",90],["f","piece_chest_wood","C0","B0.81",90],["f","piece_chest_wood","P-0.11","B0.79",90],["f","piece_chest_wood","P-0.21","B0.78",90],["f","piece_chest_wood","P-0.32","B0.78",90],["f","piece_chest_wood","L0.34","B0.7",90],["m","sign","P-0.3","F0",0.95],["m","sign","P-0.3","F0",1.96],["m","piece_walltorch","R0","C-0.13",2.29],["m","piece_walltorch","L0","C-0.08",2.29],["m","sign","P-0.3","F0",2.92]],"id":"RT-0451"},{"kind":"smithy","W":9,"D":8,"fill":0.76,"doorU":4.2,"fire":null,"dens":1.1,"open":[["w","R",1.88,2],["w","B",3,2],["w","B",-3,2],["w","F",3,2],["w","F",-3,2]],"p":[["f","piece_throne01","P-0.05","P0.26",90],["f","piece_table_round","P0.15","B1.05",270],["f","forge_ext2","R0.63","B0.99",0],["f","piece_workbench_ext2","P0.27","F0.67",270],["f","piece_chest","P-0.07","F0.5",0],["f","piece_chair03","P-0.23","F0.72",0]],"id":"RT-0452"},{"kind":"sleeping","W":4,"D":6,"fill":0.76,"doorU":-1.09,"fire":null,"dens":3.29,"open":[["w","B",1.68,2],["w","F",1.28,1.5],["d","F",-1.09,2]],"p":[["f","piece_bed02","L0","B0.31",68],["f","jute_carpet","R0.18","F0.65",337],["f","ArmorStand","R0.22","P-0.17",315],["c","piece_groundtorch_mist",0,-0.59,2.07,202,-0.15],["m","darkwood_raven","L0","F0",1.9],["m","wood_dragon1","P-0.1","F0",1.9],["m","piece_dvergr_lantern","L0.6","F0",3.34]],"id":"RT-0454"},{"kind":"living","W":8,"D":4,"fill":0.72,"doorU":-2.75,"fire":null,"dens":1.3,"open":[["w","L",1.35,1],["w","L",-1.53,0.75],["w","B",-1.87,1.75],["w","F",0.09,6],["w","B",-0.56,1],["w","B",0.74,1],["w","B",2.05,1.75],["w","R",1.35,1],["w","R",-1.53,0.75]],"p":[["f","piece_table","C0.05","F0",0],["c","piece_chair03",0,-2.13,0.07,22,0.02],["c","piece_chair03",0,1.91,0.25,338,0.02]],"id":"RT-0456"},{"kind":"storage","W":7,"D":3,"fill":0.69,"doorU":1.57,"fire":null,"dens":2.76,"open":[["w","B",3.67,1],["w","R",0.05,1]],"p":[["f","piece_chest_blackmetal","P-0.16","B0.41",0],["f","piece_chest_blackmetal","P0.11","B0.41",0],["f","piece_chest_blackmetal","R0.08","B0.43",0],["m","itemstand","R0","F0.74",2.91]],"id":"RT-0457"},{"kind":"other","W":7,"D":3,"fill":0.68,"doorU":-1.43,"fire":null,"dens":2.81,"open":[["w","L",0.05,1],["w","B",-3.63,1]],"p":[["f","piece_chest_blackmetal","P-0.1","B0.42",0],["f","piece_chest_blackmetal","P0.18","B0.43",0],["m","itemstand","R0","B0",0.66],["m","itemstand","L0","F0",2.93]],"id":"RT-0458"},{"kind":"storage","W":7.5,"D":2.5,"fill":0.65,"doorU":1.32,"fire":null,"dens":4.08,"open":[["w","F",1.34,2]],"p":[["f","piece_chest_blackmetal","R0.64","B0",0],["f","piece_chest_blackmetal","P-0.19","B0",0],["f","piece_chest_blackmetal","P0.06","B0",0],["m","itemstand","R0.13","F0",1.91],["m","itemstand","R0","F0",2.47]],"id":"RT-0459"},{"kind":"storage","W":7.5,"D":2.5,"fill":0.63,"doorU":-1.18,"fire":null,"dens":4.26,"open":[["w","F",-1.16,2]],"p":[["f","piece_chest_blackmetal","P-0.05","B0",0],["f","piece_chest_blackmetal","P0.2","B0",0],["f","piece_chest_blackmetal","L0.72","B0",0],["m","itemstand","L0.23","F0",1.93],["m","itemstand","L0","F0",2.48]],"id":"RT-0460"},{"kind":"smithy","W":5.5,"D":16,"fill":0.89,"doorU":-1.97,"fire":null,"dens":1.67,"open":[["d","R",-0.52,3],["d","B",-1.84,1.75],["d","F",-1.84,1.75],["w","F",1.91,1.75],["w","R",-7.02,2]],"p":[["f","piece_workbench","L0","P-0.04",90],["f","forge","L0","P0.12",90],["f","piece_chest","C0.06","B0.24",180],["f","piece_chest","L0","P0.24",90],["f","piece_chest","L0.06","P-0.2",90],["f","piece_chest","R0.2","B0.3",180],["f","piece_spinningwheel","R0.12","P-0.31",180],["f","piece_chest","C-0.02","F0.47",0],["f","piece_chest","R0.08","P-0.18",270],["m","piece_walltorch","L0","C0.11",2.44],["m","piece_walltorch","R0","F0.21",1.88],["m","piece_walltorch","R0","P-0.31",2.06],["m","piece_walltorch","P0.19","B0",1.88]],"id":"RT-0461"},{"kind":"sleeping","W":6,"D":7.5,"fill":0.78,"doorU":-1.98,"fire":null,"dens":2.86,"open":[["d","F",-1.98,2]],"p":[["f","bed","L0.62","B0.15",90],["f","piece_chair02","L0.38","P-0.11",45],["f","piece_chest_wood","R0.57","F1.03",0],["f","piece_chest_wood","R0.61","F0.18",0],["f","piece_chair02","L0.51","P0.13",146],["f","piece_chair","L0.75","C0.06",90],["f","rug_fur","L0.97","C-0.27",191],["m","piece_banner02","L0","F0.42",3.53],["m","piece_walltorch","L0","C0.03",1.28],["m","piece_banner04","L0","P0.14",3.59],["m","piece_banner05","L0","P-0.14",3.54]],"id":"RT-0462"},{"kind":"sleeping","W":6,"D":7.5,"fill":0.78,"doorU":2.02,"fire":null,"dens":1.71,"open":[["d","F",2.02,2],["w","L",2.91,1.75],["w","B",-1.98,2]],"p":[["f","bed","R0.72","B0.15",90],["f","rug_fur","R0.6","F0.7",203],["f","piece_chest_wood","L0.5","F0.91",180],["f","piece_chest_wood","L0.48","F0",0],["m","piece_walltorch","R0","P0.13",0.94],["m","piece_banner04","R0","P0.13",3.62],["m","piece_banner01","R0","B0.21",3.57]],"id":"RT-0463"},{"kind":"sleeping","W":8,"D":6,"fill":0.74,"doorU":-1.03,"fire":null,"dens":1.68,"open":[["w","R",2.02,2]],"p":[["f","bed","L0.72","B0.37",180],["f","piece_chest_blackmetal","P-0.29","F0.77",90],["f","piece_chair02","P0.16","P-0.21",315],["f","rug_deer","C0.01","C-0.04",34],["f","piece_chair","P0.05","P-0.23",0],["m","piece_walltorch","R0","B0.84",2.74],["m","piece_walltorch","P0.15","B0",2.68]],"id":"RT-0464"},{"kind":"sleeping","W":8,"D":6,"fill":0.74,"doorU":0.91,"fire":null,"dens":2.25,"open":[["w","L",1.98,2]],"p":[["f","bed","R0.67","B0.75",180],["f","piece_chest","P-0.15","F1.11",180],["f","piece_chest","R0.55","F0.98",180],["f","piece_chest","P0.1","F1",180],["f","rug_wolf","C-0.08","C-0.31",247],["m","piece_banner02","L0.42","B0",0.53],["m","piece_walltorch","L0","P0.17",2.23],["m","piece_walltorch","P-0.15","B0",1.24],["m","piece_banner05","P-0.16","B0",0.54]],"id":"RT-0465"},{"kind":"smithy","W":2,"D":12,"fill":0.97,"doorU":0.49,"fire":null,"dens":2.15,"open":[],"p":[["f","piece_workbench_ext3","R0.5","C-0.35",90],["f","piece_workbench_ext1","L0.57","F0.94",90],["f","forge_ext5","L0.44","P0.3",90],["f","forge_ext1","R0.39","P0.14",0],["f","piece_workbench_ext2","R0.65","P-0.22",90]],"id":"RT-0466"},{"kind":"storage","W":3,"D":4,"fill":0.54,"doorU":0.74,"fire":null,"dens":4.62,"open":[],"p":[["f","piece_chest_wood","L0.09","B0.61",68],["f","piece_chest_wood","R0.87","B0.26",247],["f","piece_chest_wood","R0.03","B0",68]],"id":"RT-0467"},{"kind":"storage","W":11,"D":7.5,"fill":0.6,"doorU":-0.04,"fire":null,"dens":0.81,"open":[["w","B",1.92,1.25],["w","F",-3.85,1.75],["d","F",-0.04,2]],"p":[["f","piece_chest_wood","P0.29","P0.2",247],["f","piece_chest_wood","R0.92","C-0.35",247],["f","piece_chest_wood","R0.15","F0.9",247],["m","sign","P0.15","F0",2.21]],"id":"RT-0468"},{"kind":"other","W":8,"D":8,"fill":0.44,"doorU":-3.25,"fire":null,"dens":1.79,"open":[["w","B",-2.97,2]],"p":[["f","fermenter","P0.13","F0.64",0],["f","fermenter","R0.35","F0.61",0],["f","fermenter","L0.55","P0.13",90],["f","fermenter","P-0.1","F0.63",0],["f","fermenter","L0.88","P-0.11",90]],"id":"RT-0469"},{"kind":"sleeping","W":7.5,"D":5.5,"fill":1,"doorU":-2.8,"fire":null,"dens":2.91,"open":[["d","F",-2.8,2],["w","F",-0.05,0.5],["w","L",-1.19,0.5]],"p":[["f","piece_throne01","L0.1","B0",135],["f","piece_bed02","P0.12","B0",180],["f","piece_chair","L0.33","C0.2",247],["f","piece_chair03","R0","F0.05",315],["f","piece_chest_wood","P-0.16","B0",180],["f","rug_wolf","R0","C0.03",0],["f","rug_deer","L0.08","F0.29",0],["f","piece_chest","P0.12","P-0.17",180],["f","ArmorStand","R0","B0",202],["c","rug_fur",1,-0.03,0.26,0,-0.07],["m","itemstand","P-0.11","F0",2.25],["m","piece_banner01","R0","B0.3",3.08],["m","piece_banner01","R0","F0.45",3.18],["m","itemstand","R0","C0.19",3.9],["h","piece_brazierceiling01","P-0.11","C0.03",0,4.14]],"id":"RT-0470"},{"kind":"workshop","W":6,"D":6,"fill":0.97,"doorU":-2.36,"fire":null,"dens":1.14,"open":[],"p":[["f","piece_workbench","L0.48","C-0.04",90],["f","piece_workbench_ext3","R0.96","F0.23",0],["f","piece_chest_blackmetal","R1.11","C-0.1",270],["f","piece_workbench_ext2","R0.32","C0.04",90]],"id":"RT-0471"},{"kind":"smithy","W":6,"D":6,"fill":0.95,"doorU":-2.61,"fire":null,"dens":1.75,"open":[],"p":[["f","forge","C0.22","C0.28",270],["f","piece_chest_blackmetal","R0.11","C0.26",270],["c","forge_ext4",0,0.1,2.39,270,-0.01],["c","forge_ext5",0,-2.23,2.18,0,0.03],["c","forge_ext1",0,1.54,0.05,180,0.04],["c","forge_ext2",0,-2.58,0.17,270,0.04]],"id":"RT-0472"},{"kind":"storage","W":4,"D":3,"fill":0.79,"doorU":-1.29,"fire":null,"dens":3.16,"open":[["d","F",-1.24,2]],"p":[["f","piece_chest_wood","R0.38","B0.41",0],["f","piece_chest_wood","R0.42","F0.97",0],["f","piece_chest_wood","R0.45","F0.15",0]],"id":"RT-0473"},{"kind":"sleeping","W":8,"D":8,"fill":0.95,"doorU":-3,"fire":null,"dens":0.99,"open":[["w","L",-1.5,1],["d","L",0,2],["w","L",1.5,1],["w","R",-3,2],["w","R",2.75,1.5],["w","B",2,4],["w","B",-2,4],["d","F",-3,2]],"p":[["f","piece_throne01","L0.43","B0.45",135],["f","piece_bed02","R0.21","C0.33",270],["f","piece_chair","R0.43","P0.27",90],["f","piece_chest","C-0.08","C0.31",90],["c","rug_fur",1,-1.5,0.61,180,-0.04],["c","rug_fur",1,1.23,0.51,180,-0.04],["m","piece_walltorch","P-0.12","F0",1.88],["m","piece_banner02","P0.12","F0",3.49]],"id":"RT-0474"},{"kind":"sleeping","W":5,"D":7,"fill":0.95,"doorU":0.5,"fire":null,"dens":1.8,"open":[["w","L",-2.75,1.5],["w","R",-2.75,1.5],["w","F",1.75,1.5],["w","L",2.25,1.5],["w","B",-0.5,2],["d","F",0.5,2]],"p":[["f","bed","L0.37","B0.44",90],["f","piece_chair","L0.3","P0.14",90],["f","piece_chest_wood","L0.36","F0.19",0],["f","rug_asksvin","L0.39","P0.08",90],["f","ArmorStand","R0.36","B0.48",202],["m","piece_walltorch","R0","P-0.07",1.91],["m","piece_banner05","R0","P0.22",3.52]],"id":"RT-0475"},{"kind":"living","W":7,"D":11,"fill":0.69,"doorU":-1.5,"fire":null,"dens":0.94,"open":[["w","L",-5,1],["d","F",-1.5,2],["w","F",-3,1],["w","B",-2.75,1.5],["w","R",-2.75,1.5],["w","B",1.5,4]],"p":[["f","piece_cartographytable","C-0.16","B0.19",180],["f","piece_chest_wood","L0.16","F0.49",90],["c","rug_deer",0,0.12,1.09,90,0.02],["c","piece_chair02",0,-0.97,1.55,135,0.04],["m","piece_walltorch","R0","P0.14",1.91],["m","piece_banner05","L0","P0.23",3.52]],"id":"RT-0476"},{"kind":"sleeping","W":6,"D":6.5,"fill":0.88,"doorU":1.88,"fire":null,"dens":2.32,"open":[["w","R",-1.5,1.5],["w","R",-2.63,1],["w","B",-1,4],["w","L",2,1.5],["d","F",1.88,2]],"p":[["f","bed","L0.37","B0.38",180],["f","piece_chair","P-0.11","B0.35",0],["f","piece_chest_wood","C-0.15","F0",0],["f","piece_chest_wood","L0.5","F0",0],["f","ArmorStand","P0.17","B0.33",180],["f","piece_logbench01","R0.28","P0.09",90],["c","jute_carpet",0,-0.74,0.57,270,-0.02],["m","piece_walltorch","L0","P-0.11",1.89],["m","piece_banner04","R0","B0.22",3.57]],"id":"RT-0477"},{"kind":"storage","W":7.5,"D":3.5,"fill":0.87,"doorU":-0.75,"fire":null,"dens":6.15,"open":[["w","B",-1.35,2.75],["w","B",-3.47,0.5],["w","R",0.16,1],["w","R",-1.59,0.5]],"p":[["f","rug_fur","L0","F0",0],["f","rug_fur","C-0.26","F0",0],["f","piece_chest","R0.27","B0",180],["f","piece_chest","R0.29","B0.93",180],["f","piece_chest","R0.26","F0.83",180],["f","piece_chest","R0.26","F0",180],["f","piece_chest","L1.02","B0.31",270],["f","piece_chest","P-0.19","B0.31",270],["f","piece_chest","P-0.07","B0.3",270],["f","piece_chest","P0.06","B0.31",270],["f","piece_groundtorch_green","L0.04","B0.08",180],["f","piece_groundtorch_green","P0.21","B0",180],["m","piece_dvergr_lantern","R0","C0.16",2.19],["m","sign","L0","B0.46",2.56],["m","sign","C0.01","B0",2.56],["m","sign","L0","F0.32",2.56]],"id":"RT-0478"},{"kind":"storage","W":11.5,"D":4,"fill":0.63,"doorU":-3.39,"fire":null,"dens":4.17,"open":[["w","F",5,1.75],["w","R",-0.11,4]],"p":[["f","rug_fur","L0.08","F0.33",180],["f","rug_fur","P-0.16","F0.2",180],["f","piece_chest","P0.07","C0.27",0],["f","piece_chest","P0.07","F0.08",0],["f","piece_chest","L1.05","F0.53",90],["f","piece_chest","P-0.29","F0.53",90],["f","piece_chest","P-0.21","F0.53",90],["f","piece_chest","P-0.13","F0.53",90],["f","piece_groundtorch_green","P-0.03","F0.24",0],["f","piece_groundtorch_green","L0.04","F0",0],["m","sign","L0","C0.13",2.56],["m","sign","R0","F0.4",2.56],["m","sign","R0","B0.73",2.56],["m","sign","P-0.18","B0",2.58]],"id":"RT-0479"},{"kind":"smithy","W":7.5,"D":3.5,"fill":0.55,"doorU":0.13,"fire":null,"dens":2.76,"open":[["w","F",2.13,1]],"p":[["f","forge_ext1","P-0.12","B0",270],["f","piece_workbench_ext3","P0.15","B0.48",0],["m","itemstand","C0.11","B0",1.89],["m","piece_dvergr_lantern","L0","C-0.16",2.59]],"id":"RT-0480"},{"kind":"storage","W":7.5,"D":2,"fill":0.78,"doorU":-1.5,"fire":null,"dens":7.66,"open":[["w","L",-0.15,1]],"p":[["f","piece_chest_wood","L0.47","F0.16",270],["f","piece_chest_wood","P-0.07","F0.27",270],["f","piece_chest_wood","C0.26","F0.26",270],["f","piece_chest_wood","P0.13","F0.27",270],["f","piece_chest_wood","P0.22","F0.27",270],["f","piece_chest_wood","R1","F0.27",270],["f","piece_chest_wood","R0.27","F0.28",270],["m","piece_dvergr_lantern","C-0.1","B0",0.59],["m","itemstand","P0.26","B0",3.91]],"id":"RT-0481"},{"kind":"other","W":3.5,"D":4.5,"fill":0.75,"doorU":-0.5,"fire":null,"dens":4.26,"open":[["w","L",1.09,2.5]],"p":[["f","piece_chest","R0.2","F0.01",0],["f","jute_carpet","R0.7","B0",0],["f","piece_bench01","L0.64","B0",180],["m","piece_dvergr_lantern","R0.07","F0",1.57],["m","itemstand","C-0.1","B0",2.63],["m","sign","R0.39","F0",3.34]],"id":"RT-0482"},{"kind":"kitchen","W":2.5,"D":7.5,"fill":0.67,"doorU":-0.37,"fire":null,"dens":3.2,"open":[["w","B",-0.44,1],["w","R",0.71,2],["w","R",-1.92,3.5],["w","F",-0.37,1.5]],"p":[["f","piece_throne01","L0","B0.16",157],["f","piece_chest_barrel","L0.32","C0.3",270],["f","piece_preptable","L0.07","P-0.17",90],["m","piece_banner05","L0","P-0.16",3.37]],"id":"RT-0483"},{"kind":"other","W":7.5,"D":8,"fill":0.78,"doorU":0.43,"fire":null,"dens":1.94,"open":[],"p":[["f","piece_chest_blackmetal","L0.23","F0.14",0],["f","piece_chest_blackmetal","P-0.1","F0.16",0],["f","ArmorStand","R0.14","P-0.13",270],["f","ArmorStand","R0.2","P0.1",270],["f","ArmorStand","P0.13","B0.31",180],["f","ArmorStand","R0.21","B0.67",270],["m","piece_dvergr_lantern","P-0.14","F0",1.59],["m","darkwood_raven","P-0.14","F0",3.9],["m","itemstand","R0","C0",3.93]],"id":"RT-0484"},{"kind":"home","W":7.5,"D":7.5,"fill":0.91,"doorU":-1.42,"fire":null,"dens":2.94,"open":[["d","F",0.08,2],["w","L",0.91,2]],"p":[["f","piece_table","L0.17","B0",270],["f","piece_table","R0.66","C-0.06",180],["f","piece_bed02","R0.7","B0",180],["f","piece_chair","R0","B0.08",270],["f","piece_chair03","P-0.09","P0.24",224],["f","jute_carpet_blue","R0.23","F0.62",90],["f","rug_fur","L1.11","F0.22",0],["f","piece_chest","L0.23","F0",180],["f","piece_chest","L0.22","P-0.1",180],["f","piece_chest","L0.22","F0.8",180],["f","piece_chest","L0.22","P-0.22",180],["c","piece_chair03",1,-0.68,1.42,134,-0.01],["c","jute_carpet",2,0.02,0.8,90,-0.07],["c","rug_hare",0,0.05,-0.74,180,0],["m","itemstand","L0","P-0.16",3.22],["m","itemstand","L0","F0.38",3.22],["m","itemstand","L0","P-0.28",3.36],["m","piece_banner02","P0.14","F0",3.72],["m","piece_banner01","R0.2","F0",3.73]],"id":"RT-0485"},{"kind":"sleeping","W":6,"D":6.5,"fill":0.59,"doorU":0.4,"fire":null,"dens":4.35,"open":[["d","F",-1.1,2],["w","L",-2.25,1],["w","F",2.26,1],["w","B",2.26,1]],"p":[["f","ashwood_bed","L0","C-0.15",180],["f","piece_chair03","R1.11","P-0.17",0],["f","piece_chair","P0.24","P-0.06",0],["f","piece_chest","P0.21","F0.38",90],["f","piece_chest","L0","F0.46",180],["f","piece_chair03","R1.11","C0.18",180],["m","sign","R0","F0",2.67],["m","piece_banner04","L0","P0.14",3.92],["m","piece_banner04","L0","C0.02",3.92],["m","piece_banner04","L0","P-0.18",3.92]],"id":"RT-0486"},{"kind":"sleeping","W":4,"D":4,"fill":0.88,"doorU":0.83,"fire":null,"dens":2.86,"open":[],"p":[["f","bed","L0.28","F0.55",180],["f","piece_chest","R0","B1.05",90],["f","piece_chair","R0.97","B0.43",270],["m","piece_dvergr_lantern","C0.14","B0",3.45]],"id":"RT-0487"},{"kind":"sleeping","W":4,"D":4,"fill":0.88,"doorU":0.83,"fire":null,"dens":2.86,"open":[],"p":[["f","bed","L0.21","B0.33",180],["f","piece_chest","R0","B0.92",90],["f","piece_chair","R0.85","B0.6",270],["m","piece_dvergr_lantern","C0.16","B0",3.11]],"id":"RT-0488"},{"kind":"sleeping","W":3,"D":6,"fill":0.78,"doorU":0.5,"fire":null,"dens":2.86,"open":[["w","F",0.39,2]],"p":[["f","bed","R0.13","B0.33",180],["f","piece_chest","L0","C0.2",90],["f","piece_chair","L1","P0.17",68],["m","piece_dvergr_lantern","C0.06","B0",3.25]],"id":"RT-0489"},{"kind":"storage","W":10.5,"D":9,"fill":0.46,"doorU":-3.36,"fire":null,"dens":1.37,"open":[["w","R",3.79,2],["w","R",-2.35,4.25],["w","R",0.09,2.75],["w","R",3.21,2.5],["w","F",3.57,3.5],["w","B",3.05,2],["w","B",-1.05,8.5]],"p":[["f","piece_chair","R0.91","F0",0],["f","piece_chair","P0.11","B0.2",270],["f","piece_bench01","P0.25","B0.12",270],["f","rug_asksvin","R0.55","F0.7",270],["f","piece_chest","C-0.16","P0.18",45],["f","piece_chest","P0.11","P0.04",45],["f","piece_chest_barrel","R0.11","F0.01",270]],"id":"RT-0490"},{"kind":"sleeping","W":9,"D":9.5,"fill":0.68,"doorU":3.5,"fire":null,"dens":1.03,"open":[["w","R",-1.42,6.5],["w","L",1.33,1],["w","R",1.58,1.5],["w","B",3.41,4.5]],"p":[["f","piece_table","L0.36","C-0.03",90],["f","piece_bed02","L0.74","B0.94",135],["f","ArmorStand","P-0.09","B0.67",180],["c","piece_chair03",0,0.28,0.91,202,0.02],["c","jute_carpet",1,-1.57,1.6,315,-0.04],["c","treasure_stack",0,-0.91,-0.18,68,0.8],["m","piece_banner03","P-0.3","B0",2.22],["h","piece_brazierceiling01","C0.16","C-0.18",0,3.77]],"id":"RT-0491"},{"kind":"home","W":14,"D":12,"fill":0.99,"doorU":-5,"fire":null,"dens":1.08,"open":[["w","L",3,2],["w","L",-1,2],["w","F",-5.5,1],["w","F",5.5,1]],"p":[["f","piece_table_oak","C-0.01","P-0.22",0],["f","piece_throne01","C-0.02","F0.71",0],["f","piece_table_round","P-0.32","B1.02",90],["f","piece_bed02","P-0.17","B0.19",180],["f","piece_chest_blackmetal","P0.38","P-0.23",270],["f","piece_chest_blackmetal","P0.38","P-0.06",270],["f","piece_chest_blackmetal","P0.38","F0.46",270],["f","rug_fur","L0.38","P0.08",180],["f","rug_hare","P0.06","P0.04",225],["f","rug_hare","P0.15","B0",270],["f","rug_deer","P0.2","F0.48",247],["f","rug_wolf","P-0.31","P-0.27",157],["f","jute_carpet","P-0.17","P0.15",180],["f","jute_carpet","P-0.03","P0.3",270],["f","rug_wolf","P0.29","P0.04",112],["f","ArmorStand","P-0.14","F0.23",0],["f","ArmorStand","P0.15","F0.15",0],["f","piece_chair03","P0.31","P0.07",270],["f","piece_groundtorch","P-0.22","F0.19",90],["f","piece_groundtorch","P0.21","B0.18",90],["f","piece_groundtorch","L0.19","P0.3",270],["f","piece_groundtorch","L0.22","P-0.13",270],["f","piece_groundtorch","P0.22","F0.18",90],["c","rug_fur",0,0.05,0.11,270,0.07],["c","piece_groundtorch",3,-1.34,-1.49,270,-0.14],["m","itemstand","P0.08","F0",3.91],["m","itemstand","P-0.07","F0",3.93]],"id":"RT-0492"},{"kind":"hall","W":9.5,"D":3.5,"fill":0.91,"doorU":-1.64,"fire":[3.36,-0.04],"dens":2.98,"open":[["w","B",-0.14,2]],"p":[["f","hearth","R0.39","F0.11",90],["f","hearth","L0.11","F0.11",90],["f","hearth","C-0.09","F0.05",90],["c","piece_cookingstation_iron",0,0.13,-0.44,180,0.58],["c","piece_cookingstation_iron",1,0.11,0.44,180,0.58],["c","piece_cookingstation_iron",0,0.1,0.38,180,0.58],["c","piece_cookingstation_iron",1,0.09,-0.37,180,0.58],["c","piece_cookingstation_iron",2,0.09,-0.42,180,0.58],["c","piece_cookingstation_iron",2,0.07,0.42,180,0.58]],"id":"RT-0493"},{"kind":"sleeping","W":3.5,"D":6,"fill":0.99,"doorU":1.03,"fire":null,"dens":2.41,"open":[["w","L",1.04,4],["d","F",0.91,1.75]],"p":[["f","bed","L0.04","B0.47",90],["f","piece_chair","L0.17","P0.14",90],["f","rug_wolf","R0","F0",90],["f","ArmorStand","L0.78","F0.18",45],["c","piece_chest_wood",0,-0.13,1.88,180,-0.02],["c","piece_groundtorch_wood",0,-0.74,0.3,270,-0.12]],"id":"RT-0494"},{"kind":"sleeping","W":3.5,"D":4,"fill":0.95,"doorU":0.97,"fire":null,"dens":2.26,"open":[["d","F",0.84,1.75]],"p":[["f","bed","L0.12","B0.36",90],["f","rug_deer","R0.07","F0.07",0],["f","ArmorStand","L0.58","F0.26",45],["f","piece_groundtorch_wood","L0.14","F0.26",180]],"id":"RT-0495"},{"kind":"sleeping","W":8,"D":4.5,"fill":0.88,"doorU":1.16,"fire":null,"dens":1.89,"open":[["d","F",1.28,1.75],["d","F",-2.84,2],["w","L",-0.97,2]],"p":[["f","bed","R0.15","B0.8",180],["f","bed","P-0.12","B0.84",180],["f","piece_chair","P-0.25","B0.72",180],["f","piece_chair","P0.23","B0.81",180],["f","piece_chest_wood","P0.08","B0.93",270],["f","piece_chest_wood","L0.22","B0.84",270],["f","rug_deer","P0.13","F0.16",0],["f","rug_deer","L0","F0.02",337]],"id":"RT-0496"}]};
window.VH_ROOM_WEIGHTS = {"RT-0001":1.48,"RT-0002":1.58,"RT-0003":1.23,"RT-0004":1.23,"RT-0005":1.18,"RT-0006":1.23,"RT-0007":1.23,"RT-0008":1.02,"RT-0009":0.93,"RT-0010":0.93,"RT-0011":1.32,"RT-0012":1.32,"RT-0013":1.58,"RT-0014":1.58,"RT-0015":1.58,"RT-0017":1.32,"RT-0018":1.23,"RT-0019":1.23,"RT-0020":1.48,"RT-0021":1.48,"RT-0022":1.23,"RT-0023":1.23,"RT-0024":0.93,"RT-0025":1.23,"RT-0026":1.58,"RT-0027":1.58,"RT-0028":1.23,"RT-0029":1.58,"RT-0030":1.58,"RT-0031":1.32,"RT-0032":1.58,"RT-0033":1.18,"RT-0034":1.48,"RT-0035":1.58,"RT-0036":1.23,"RT-0037":1.58,"RT-0039":1.27,"RT-0040":1.32,"RT-0041":1.32,"RT-0042":1.02,"RT-0043":1.58,"RT-0044":1.58,"RT-0054":1.58,"RT-0055":0.98,"RT-0056":1.58,"RT-0057":0.93,"RT-0058":1.48,"RT-0059":1.32,"RT-0060":1.32,"RT-0061":1.02,"RT-0062":1.32,"RT-0063":1.58,"RT-0064":1.32,"RT-0065":1.23,"RT-0066":1.48,"RT-0067":1.58,"RT-0068":1.32,"RT-0069":1.32,"RT-0070":0.93,"RT-0071":1.32,"RT-0072":1.23,"RT-0073":1.48,"RT-0074":1.23,"RT-0075":1.48,"RT-0076":1.23,"RT-0077":1.48,"RT-0078":1.23,"RT-0079":1.48,"RT-0080":1.23,"RT-0081":1.58,"RT-0082":1.23,"RT-0083":1.32,"RT-0084":1.58,"RT-0085":1.58,"RT-0086":1.32,"RT-0087":1.58,"RT-0088":1.27,"RT-0089":0.93,"RT-0090":1.02,"RT-0091":1.58,"RT-0092":1.48,"RT-0093":0.93,"RT-0094":1.32,"RT-0095":1.58,"RT-0097":1.23,"RT-0098":0.93,"RT-0099":1.23,"RT-0100":1.32,"RT-0101":1.58,"RT-0102":1.58,"RT-0103":0.93,"RT-0104":1.58,"RT-0105":1.27,"RT-0106":1.58,"RT-0107":1.48,"RT-0108":1.58,"RT-0109":1.48,"RT-0110":1.48,"RT-0111":1.58,"RT-0112":1.23,"RT-0113":1.48,"RT-0114":1.58,"RT-0115":1.58,"RT-0116":1.58,"RT-0117":1.23,"RT-0118":1.32,"RT-0119":1.58,"RT-0120":1.48,"RT-0121":1.23,"RT-0122":0.93,"RT-0123":1.58,"RT-0124":0.93,"RT-0125":0.91,"RT-0126":1.56,"RT-0127":1.01,"RT-0128":1.21,"RT-0129":1.21,"RT-0130":1.21,"RT-0131":1.46,"RT-0132":1.21,"RT-0133":1.46,"RT-0134":1.21,"RT-0135":0.96,"RT-0136":1.2,"RT-0137":1.55,"RT-0138":1.54,"RT-0139":1.54,"RT-0140":1.19,"RT-0141":1.28,"RT-0142":1.54,"RT-0143":1.44,"RT-0144":1.53,"RT-0145":1.53,"RT-0146":1.53,"RT-0148":1.43,"RT-0149":1.43,"RT-0150":1.18,"RT-0151":1.18,"RT-0152":1.43,"RT-0153":1.28,"RT-0155":1.18,"RT-0156":1.27,"RT-0157":1.52,"RT-0158":1.42,"RT-0159":1.42,"RT-0160":1.17,"RT-0161":1.52,"RT-0162":1.52,"RT-0163":1.27,"RT-0164":1.52,"RT-0165":0.62,"RT-0166":1.22,"RT-0167":0.97,"RT-0168":1.22,"RT-0169":1.52,"RT-0170":1.42,"RT-0171":1.42,"RT-0172":1.16,"RT-0173":1.16,"RT-0175":1.51,"RT-0176":1.41,"RT-0177":1.16,"RT-0178":1.16,"RT-0179":0.85,"RT-0180":0.85,"RT-0181":1.5,"RT-0182":0.6,"RT-0183":0.6,"RT-0184":0.85,"RT-0185":0.85,"RT-0186":1.2,"RT-0187":1.4,"RT-0188":1.4,"RT-0189":1.5,"RT-0190":1.15,"RT-0191":1.5,"RT-0192":1.15,"RT-0193":1.4,"RT-0194":1.5,"RT-0195":1.5,"RT-0196":1.4,"RT-0197":1.4,"RT-0198":0.7,"RT-0199":1.49,"RT-0200":1.49,"RT-0201":1.49,"RT-0202":1.39,"RT-0204":1.38,"RT-0205":1.13,"RT-0206":0.83,"RT-0207":1.18,"RT-0208":1.38,"RT-0209":1.13,"RT-0210":1.48,"RT-0211":1.37,"RT-0212":1.37,"RT-0213":1.37,"RT-0215":1.37,"RT-0216":1.47,"RT-0217":1.47,"RT-0218":1.22,"RT-0219":1.47,"RT-0220":1.36,"RT-0221":1.36,"RT-0222":1.11,"RT-0223":1.47,"RT-0224":1.47,"RT-0225":1.11,"RT-0226":0.81,"RT-0227":0.67,"RT-0228":1.47,"RT-0229":1.16,"RT-0230":1.21,"RT-0232":1.21,"RT-0233":1.46,"RT-0234":0.8,"RT-0235":1.46,"RT-0236":1.35,"RT-0237":0.91,"RT-0238":1.1,"RT-0239":1.45,"RT-0240":1.45,"RT-0241":1.15,"RT-0242":1.15,"RT-0243":1.2,"RT-0244":1.45,"RT-0245":1.45,"RT-0246":1.45,"RT-0247":1.45,"RT-0248":1.45,"RT-0249":1.45,"RT-0250":1.1,"RT-0251":1.45,"RT-0252":0.8,"RT-0253":1.35,"RT-0254":0.8,"RT-0255":0.8,"RT-0256":1.1,"RT-0257":1.45,"RT-0258":1.2,"RT-0259":1.1,"RT-0260":1.1,"RT-0261":1.45,"RT-0262":0.55,"RT-0263":1.45,"RT-0264":1.45,"RT-0265":1.45,"RT-0266":1.1,"RT-0267":1.15,"RT-0268":0.9,"RT-0269":1.35,"RT-0270":1.35,"RT-0271":1.15,"RT-0272":1.45,"RT-0273":1.2,"RT-0274":1.45,"RT-0275":1.45,"RT-0276":0.84,"RT-0277":1.45,"RT-0278":1.04,"RT-0279":1.09,"RT-0280":1.45,"RT-0281":1.09,"RT-0284":1.14,"RT-0287":1.19,"RT-0288":1.44,"RT-0289":1.44,"RT-0290":1.09,"RT-0291":1.09,"RT-0292":1.33,"RT-0293":1.08,"RT-0294":1.08,"RT-0295":1.44,"RT-0296":1.19,"RT-0297":1.19,"RT-0298":1.08,"RT-0299":0.78,"RT-0300":1.08,"RT-0301":1.08,"RT-0302":1.19,"RT-0303":1.43,"RT-0304":0.88,"RT-0305":1.32,"RT-0306":1.13,"RT-0307":1.43,"RT-0308":1.43,"RT-0309":1.32,"RT-0310":1.17,"RT-0311":1.42,"RT-0312":1.07,"RT-0313":1.42,"RT-0314":1.42,"RT-0315":0.77,"RT-0316":0.77,"RT-0317":1.02,"RT-0318":0.77,"RT-0319":1.06,"RT-0320":1.06,"RT-0321":1.02,"RT-0322":1.42,"RT-0323":1.42,"RT-0324":1.42,"RT-0325":1.17,"RT-0326":1.31,"RT-0327":0.51,"RT-0328":0.51,"RT-0329":1.42,"RT-0330":1.06,"RT-0331":1.42,"RT-0332":1.42,"RT-0333":1.11,"RT-0334":1.31,"RT-0335":0.61,"RT-0336":1.06,"RT-0337":1.16,"RT-0338":0.76,"RT-0339":1.41,"RT-0340":1.41,"RT-0341":1.16,"RT-0342":1.41,"RT-0343":1.11,"RT-0344":1.3,"RT-0346":1.41,"RT-0347":1.41,"RT-0348":1.4,"RT-0349":1.3,"RT-0350":0.75,"RT-0351":1.05,"RT-0352":1.4,"RT-0353":1.29,"RT-0354":1.15,"RT-0358":1.29,"RT-0359":1.4,"RT-0360":0.75,"RT-0361":1.29,"RT-0362":0.5,"RT-0363":0.79,"RT-0364":0.5,"RT-0365":1.04,"RT-0366":1.09,"RT-0367":1,"RT-0368":1.4,"RT-0369":1.29,"RT-0370":1.04,"RT-0371":1.14,"RT-0372":0.74,"RT-0373":1.14,"RT-0374":1.04,"RT-0375":0.59,"RT-0376":1.04,"RT-0377":1.04,"RT-0378":0.5,"RT-0379":0.5,"RT-0380":1.39,"RT-0381":0.99,"RT-0382":1.03,"RT-0383":1.13,"RT-0384":1.03,"RT-0385":1.28,"RT-0386":1.03,"RT-0387":1.03,"RT-0388":0.83,"RT-0389":1.38,"RT-0390":1.28,"RT-0391":0.88,"RT-0392":1.38,"RT-0393":1.02,"RT-0394":1.02,"RT-0395":1.27,"RT-0396":1.07,"RT-0397":0.73,"RT-0398":0.82,"RT-0399":1.07,"RT-0400":1.02,"RT-0401":1.27,"RT-0402":1.13,"RT-0404":1.02,"RT-0405":1.02,"RT-0406":1.02,"RT-0407":1.02,"RT-0408":1.27,"RT-0409":1.27,"RT-0410":0.73,"RT-0411":1.02,"RT-0412":1.27,"RT-0413":1.38,"RT-0414":0.5,"RT-0415":1.38,"RT-0416":1.02,"RT-0420":1.27,"RT-0421":1.27,"RT-0422":0.97,"RT-0423":1.27,"RT-0424":1.36,"RT-0425":1.36,"RT-0426":1.36,"RT-0427":1.26,"RT-0428":1.36,"RT-0429":1.11,"RT-0430":1.36,"RT-0431":1.06,"RT-0432":0.81,"RT-0433":1.36,"RT-0434":1.01,"RT-0435":1.11,"RT-0436":1.36,"RT-0437":1.36,"RT-0438":1.01,"RT-0439":1.11,"RT-0440":1,"RT-0441":1.1,"RT-0442":1.35,"RT-0443":1.25,"RT-0444":0.8,"RT-0445":0.7,"RT-0446":1.05,"RT-0447":1,"RT-0448":0.7,"RT-0449":1.25,"RT-0450":1.34,"RT-0451":1.09,"RT-0452":0.75,"RT-0454":1.34,"RT-0456":0.69,"RT-0457":0.99,"RT-0458":1.24,"RT-0459":1.24,"RT-0460":1.24,"RT-0461":1.33,"RT-0462":1.33,"RT-0463":1.33,"RT-0464":1.33,"RT-0465":1.03,"RT-0466":0.94,"RT-0467":1.24,"RT-0468":0.99,"RT-0469":0.68,"RT-0470":1.33,"RT-0471":0.93,"RT-0472":0.68,"RT-0473":0.98,"RT-0474":1.08,"RT-0475":1.33,"RT-0476":1.08,"RT-0477":1.33,"RT-0478":1.33,"RT-0479":0.78,"RT-0480":1.33,"RT-0481":0.78,"RT-0482":1.33,"RT-0483":0.93,"RT-0484":0.78,"RT-0485":1.23,"RT-0486":0.68,"RT-0487":1.03,"RT-0488":1.03,"RT-0489":1.33,"RT-0490":0.98,"RT-0491":1.07,"RT-0492":1.07,"RT-0493":0.93,"RT-0494":1.32,"RT-0495":1.32,"RT-0496":1.23};
VHDecorate.setRules(VH_RULES);
// ---- entry point for the game: one request, best of 'tries' seeds
function vhMake(type, biome, culture, stage, words, seed, tries) {
  return VHRequest.make({ type: type, biome: biome, culture: culture || undefined, stage: stage, words: words, seed: seed, tries: tries }, VH_SCORER, VH_RULES);
}
function vhRead(words) { return JSON.stringify(VHRequest.read(words)); }
// floorplans ('vh floorplan'): one plan or the first n of the catalog, as JSON { name, blueprint, signs, rows }
function vhFloorplan(shape, w, d, room, biome, culture, decor, seed, id, ladder) {
  try { return JSON.stringify(VHFloorplan.one({ shape: shape, w: w, d: d, room: room, biome: biome, culture: culture || undefined, decor: decor, seed: seed, id: id, ladder: !!ladder })); }
  catch (e) { return JSON.stringify({ error: String(e && e.message || e) }); }
}
function vhFloorplanSet(n) {
  try { return JSON.stringify(VHFloorplan.set(n)); } catch (e) { return JSON.stringify({ error: String(e && e.message || e) }); }
}
// 'vh floorplan template RT-0001 [biome]': one room template laid out as it is, for walking through a scored room
function vhFloorplanTemplate(id, biome) {
  try { return JSON.stringify(VHFloorplan.template(id, biome || undefined)); } catch (e) { return JSON.stringify({ error: String(e && e.message || e) }); }
}
function vhFloorplanLists() { return JSON.stringify({ shapes: VHFloorplan.SHAPES, rooms: VHFloorplan.ROOMS, catalog: VHFloorplan.CATALOG.length }); }
function vhLists() {
  return JSON.stringify({ types: Object.keys(VHStyles.TYPES), cultures: Object.keys(VHStyles.CULTURES), biomes: VHRequest.BIOME_CODES });
}
