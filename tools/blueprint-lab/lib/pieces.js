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
  // floors and stairs
  [/stone_floor_2x2/, 'floor', [2, 1, 2], 'box'],
  [/floor_4x4|floor_large/, 'floor', [4, 0.25, 4], 'box'],
  [/floor_1x1|floor_triangle|tile_floor_1x1/, 'floor', [1, 0.25, 1], 'box'],
  [/floor/i, 'floor', [2, 0.25, 2], 'box'],
  [/spiralstair/, 'stair', [2, 4, 2], 'box'],
  [/stair|ladder|stepladder/i, 'stair', [1, 2, 2], 'stair'],
  // wall torches before the wall rules, or 'piece_walltorch' reads as a 2x2 wall
  [/walltorch/i, 'light', [0.3, 0.8, 0.3], 'prop'],
  // openings
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
  [/wall_quarter|quarterwall/i, 'wall', [2, 0.5, 0.2], 'box'],
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

const cache = new Map();
function piece(name) {
  let c = cache.get(name);
  if (c) return c;
  const n = name;
  let role = 'misc', size = [0.8, 0.8, 0.8], shape = 'prop';
  for (const [re, r, s, sh] of RULES) {
    if (re.test(n)) { role = r; size = s; shape = sh; break; }
  }
  const mat = material(n);
  const structural = ['wall', 'floor', 'roof', 'roofTop', 'roofCorner', 'gable', 'beam', 'pole', 'stair', 'door', 'window', 'fence'].includes(role);
  c = { name, role, size, shape, mat, color: MAT[mat], structural, exact: false };
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

// Materials a piece needs, for the biome rule (rough, from the prefab name).
function needs(name) {
  const m = material(name);
  return {
    wood: 'Meadows', thatch: 'Meadows', stake: 'Meadows', fur: 'Meadows', cloth: 'Meadows', fire: 'Meadows',
    corewood: 'Black Forest', stone: 'Black Forest', darkwood: 'Swamp', darkroof: 'Swamp', iron: 'Swamp',
    glass: 'Mountain', marble: 'Mistlands', dvergr: 'Mistlands', ashwood: 'Ashlands', grausten: 'Ashlands',
    flametal: 'Ashlands', turf: 'Meadows', green: 'Meadows', bone: 'Meadows', gold: 'Meadows', black: 'Swamp',
    white: 'Mountain',
  }[m] || 'Meadows';
}

const BIOME_ORDER = ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains', 'Mistlands', 'Ashlands', 'Deep North'];

if (typeof module !== 'undefined') module.exports = { piece, needs, MAT, BIOME_ORDER, exportSize };
else window.VHPieces = { piece, needs, MAT, BIOME_ORDER, exportSize };
