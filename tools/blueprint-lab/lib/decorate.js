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
const SHD = NODE_D ? require('./shapes.js') : window.VHShapes;
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
// Sizes are at least the game's own: the box round each piece's solid colliders (its mesh for rugs), from
// data/piece-models.json, so furniture does not clip into walls or each other in the game. For pieces turned 90 or
// 270 degrees against a wall the size is [along the wall, height, out from the wall]. c: [x, z], where the middle of the
// footprint is from the piece's pivot in its own frame, when the game's piece is not centered on its pivot (the
// carvings run 3 m to one side); the decorator places footprints and writes the pivot.
const F = {
  bed: { s: [1.2, 0.8, 2.8], at: 'wall', b: 'Meadows', cat: 'bed' },
  piece_bed02: { s: [2.3, 1.5, 3.43], c: [0.0, 0.12], at: 'wall', b: 'Swamp', cat: 'bed' },
  ashwood_bed: { s: [1.6, 1.0, 2.8], at: 'wall', b: 'Ashlands', cat: 'bed' },
  piece_chest_wood: { s: [1.65, 0.8, 0.75], at: 'wall', b: 'Meadows', cat: 'storage' },
  piece_chest_barrel: { s: [0.79, 1.0, 0.71], at: 'wall', b: 'Black Forest', cat: 'storage' },
  piece_chest: { s: [1.84, 1.0, 1.0], at: 'wall', b: 'Swamp', cat: 'storage' },
  piece_chest_blackmetal: { s: [2.06, 1.0, 1.29], at: 'wall', b: 'Plains', cat: 'storage' },
  piece_table: { s: [2.45, 0.8, 1.22], at: 'floor', b: 'Meadows', cat: 'table', top: 0.75 },
  piece_table_round: { s: [2.53, 0.86, 2.43], at: 'floor', b: 'Black Forest', cat: 'table', top: 0.75, round: true },
  piece_table_oak: { s: [6.45, 0.8, 1.85], c: [0.07, 0.0], at: 'floor', b: 'Swamp', cat: 'table', top: 0.75 },
  piece_chair: { s: [0.6, 0.6, 0.6], at: 'floor', b: 'Meadows', cat: 'seat' },
  piece_chair02: { s: [0.7, 1.2, 0.94], c: [0.04, -0.08], at: 'floor', b: 'Black Forest', cat: 'seat' },
  piece_chair03: { s: [0.8, 1.2, 0.8], at: 'floor', b: 'Swamp', cat: 'seat' },
  piece_bench01: { s: [2.41, 0.9, 0.7], c: [0.06, -0.04], at: 'floor', b: 'Meadows', cat: 'seat', long: true },
  piece_logbench01: { s: [2.38, 0.5, 0.6], at: 'floor', b: 'Black Forest', cat: 'seat', long: true, back: true },
  piece_throne01: { s: [1.4, 2.5, 1.0], at: 'wall', b: 'Swamp', cat: 'seat' },
  fire_pit: { s: [1.4, 0.4, 1.4], at: 'floor', b: 'Meadows', cat: 'fire' },
  hearth: { s: [4.0, 0.6, 3.0], at: 'floor', b: 'Swamp', cat: 'fire' },
  piece_cookingstation: { s: [2.0, 0.8, 0.5], at: 'fire', b: 'Meadows', cat: 'craft', lift: 0.25 },
  piece_cookingstation_iron: { s: [3.6, 2.0, 0.73], at: 'fire', b: 'Swamp', cat: 'craft', lift: 0.25 },
  piece_cauldron: { s: [1.0, 1.4, 1.0], at: 'fire', b: 'Black Forest', cat: 'craft', lift: 0.25 },
  fermenter: { s: [1.6, 2.2, 1.55], at: 'wall', b: 'Black Forest', cat: 'craft', tall: true },
  piece_workbench: { s: [3.01, 1.03, 1.1], at: 'wall', b: 'Meadows', cat: 'craft' },
  piece_workbench_ext1: { s: [0.81, 1.01, 0.8], c: [-0.06, 0.0], at: 'wall', b: 'Meadows', cat: 'craft' },
  piece_workbench_ext2: { s: [2.01, 1.8, 0.6], at: 'wall', b: 'Meadows', cat: 'craft', tall: true },
  piece_workbench_ext3: { s: [2.13, 1.23, 1.1], at: 'wall', b: 'Black Forest', cat: 'craft' },
  piece_workbench_ext4: { s: [1.6, 1.6, 0.5], at: 'wall', b: 'Swamp', cat: 'craft', tall: true },
  forge: { s: [1.8, 2.2, 1.0], at: 'wall', b: 'Black Forest', cat: 'craft', tall: true },
  forge_ext1: { s: [1.1, 0.8, 0.88], c: [-0.12, 0.01], at: 'wall', b: 'Black Forest', cat: 'craft' },
  forge_ext2: { s: [0.8, 1.0, 0.8], at: 'wall', b: 'Black Forest', cat: 'craft' },
  forge_ext3: { s: [0.9, 1.41, 1.0], at: 'wall', b: 'Swamp', cat: 'craft' },
  forge_ext4: { s: [1.0, 1.4, 0.9], at: 'wall', b: 'Black Forest', cat: 'craft' },
  forge_ext5: { s: [1.6, 1.6, 0.83], at: 'wall', b: 'Black Forest', cat: 'craft', tall: true },
  forge_ext6: { s: [2.5, 0.8, 0.8], at: 'wall', b: 'Swamp', cat: 'craft' },
  piece_stonecutter: { s: [3.23, 1.81, 1.5], c: [-0.11, 0.0], at: 'wall', b: 'Swamp', cat: 'craft' },
  // kitchen pieces from the Mistlands, for the kitchen templates; sizes estimated from screenshots, not measured yet
  piece_oven: { s: [3.0, 2.37, 2.0], at: 'wall', b: 'Mistlands', cat: 'craft', tall: true },
  piece_preptable: { s: [2.54, 1.12, 1.0], at: 'wall', b: 'Mistlands', cat: 'craft' },
  piece_artisanstation: { s: [2.65, 2.46, 1.15], at: 'wall', b: 'Mountain', cat: 'craft' },
  piece_spinningwheel: { s: [1.78, 1.82, 1.59], c: [0.43, -0.13], at: 'wall', b: 'Plains', cat: 'craft', rel: 270 },
  piece_cartographytable: { s: [3.93, 1.39, 1.95], c: [0.07, 0.07], at: 'floor', b: 'Black Forest', cat: 'table' },
  ArmorStand: { s: [0.9, 1.9, 0.6], at: 'wall', b: 'Swamp', cat: 'deco', tall: true },
  itemstand: { s: [0.6, 0.6, 0.25], at: 'mount', b: 'Meadows', cat: 'deco', wall: 0.14, y: 1.6 },
  itemstandh: { s: [0.9, 0.2, 0.5], at: 'top', b: 'Meadows', cat: 'deco' },
  sign: { s: [1.0, 0.55, 0.1], at: 'mount', b: 'Black Forest', cat: 'deco', wall: 0.12, y: 1.3 },
  piece_banner01: { s: [1.41, 2.0, 0.1], at: 'mount', b: 'Black Forest', cat: 'deco', wall: 0.2, under: 0.33, rel: 90 },
  piece_banner02: { s: [1.41, 2.0, 0.1], at: 'mount', b: 'Black Forest', cat: 'deco', wall: 0.2, under: 0.33, rel: 90 },
  piece_banner03: { s: [1.41, 2.0, 0.1], at: 'mount', b: 'Black Forest', cat: 'deco', wall: 0.2, under: 0.33, rel: 90 },
  piece_banner04: { s: [1.41, 2.0, 0.1], at: 'mount', b: 'Swamp', cat: 'deco', wall: 0.2, under: 0.33, rel: 90 },
  piece_banner05: { s: [1.41, 2.0, 0.1], at: 'mount', b: 'Swamp', cat: 'deco', wall: 0.2, under: 0.33, rel: 90 },
  wood_dragon1: { s: [3.34, 1.46, 1.0], c: [0.0, 1.69], at: 'mount', b: 'Black Forest', cat: 'deco', wall: -0.1, y: 1.7, rel: 90 },
  darkwood_raven: { s: [3.09, 1.46, 0.8], c: [0.0, 1.54], at: 'mount', b: 'Swamp', cat: 'deco', wall: -0.1, y: 1.7, rel: 90 },
  darkwood_wolf: { s: [2.18, 1.79, 0.83], c: [0.0, 1.09], at: 'mount', b: 'Swamp', cat: 'deco', wall: -0.1, y: 1.7, rel: 90 },
  piece_groundtorch_wood: { s: [0.4, 1.6, 0.4], at: 'floor', b: 'Meadows', cat: 'light', base: 0.75 },
  piece_groundtorch: { s: [0.4, 1.6, 0.4], at: 'floor', b: 'Swamp', cat: 'light', base: 0.75 },
  piece_groundtorch_green: { s: [0.4, 1.6, 0.4], at: 'floor', b: 'Swamp', cat: 'light', base: 0.75 },
  piece_groundtorch_mist: { s: [0.4, 1.6, 0.4], at: 'floor', b: 'Mistlands', cat: 'light', base: 0.75 },
  piece_walltorch: { s: [0.31, 0.95, 0.45], at: 'mount', b: 'Black Forest', cat: 'light', wall: 0.28, y: 1.55, rel: 270 },
  piece_dvergr_lantern: { s: [0.78, 1.21, 1.11], c: [-0.55, 0.0], at: 'mount', b: 'Mistlands', cat: 'light', wall: -0.1, under: 0.35, rel: 90 },
  piece_brazierceiling01: { s: [0.97, 1.6, 0.91], at: 'hang', b: 'Swamp', cat: 'light', under: 1.6 },
  Candle_resin: { s: [0.25, 0.32, 0.25], c: [0.06, 0.01], at: 'top', b: 'Mountain', cat: 'light' },
  rug_deer: { s: [3.11, 0.05, 3.11], at: 'rug', b: 'Meadows', cat: 'rug' },
  rug_wolf: { s: [2.55, 0.05, 3.46], at: 'rug', b: 'Mountain', cat: 'rug' },
  jute_carpet: { s: [3.99, 0.05, 3.0], at: 'rug', b: 'Mountain', cat: 'rug' },
  rug_fur: { s: [3.06, 0.05, 3.97], at: 'rug', b: 'Plains', cat: 'rug' },
  rug_straw: { s: [2.12, 0.05, 2.6], at: 'rug', b: 'Plains', cat: 'rug' },
  rug_hare: { s: [2.0, 0.05, 2.5], at: 'rug', b: 'Mistlands', cat: 'rug' },
  jute_carpet_blue: { s: [3.0, 0.05, 3.0], at: 'rug', b: 'Mistlands', cat: 'rug' },
  rug_asksvin: { s: [3.0, 0.05, 3.0], at: 'rug', b: 'Ashlands', cat: 'rug' },
  treasure_stack: { s: [0.5, 0.54, 0.5], at: 'top', b: 'Black Forest', cat: 'deco' },
  dvergrprops_crate: { s: [1.2, 1.02, 1.02], at: 'wall', b: 'Mistlands', cat: 'storage' },
  dvergrprops_barrel: { s: [1.5, 1.6, 2.0], at: 'wall', b: 'Mistlands', cat: 'storage' },
  wood_stack: { s: [2.46, 1.14, 2.05], c: [-0.07, -0.04], at: 'out', b: 'Meadows', cat: 'clutter' },
  wood_fine_stack: { s: [2.0, 1.0, 1.9], at: 'out', b: 'Black Forest', cat: 'clutter' },
  wood_core_stack: { s: [2.0, 1.31, 2.22], at: 'out', b: 'Black Forest', cat: 'clutter' },
  stone_pile: { s: [1.6, 0.81, 1.6], c: [0.08, 0.07], at: 'out', b: 'Meadows', cat: 'clutter' },
  coal_pile: { s: [1.6, 0.82, 1.6], c: [0.02, 0.1], at: 'out', b: 'Black Forest', cat: 'clutter' },
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
// Footprint middle to pivot and back, for pieces whose game footprint is off their pivot (F c).
function pivotOf(name, x, z, yaw) {
  const c = F[name] && F[name].c;
  if (!c) return [x, z];
  const a = yaw * PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  return [x - (c[0] * ca + c[1] * sa), z - (-c[0] * sa + c[1] * ca)];
}
function middleOf(name, x, z, yaw) {
  const c = F[name] && F[name].c;
  if (!c) return [x, z];
  const a = yaw * PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  return [x + c[0] * ca + c[1] * sa, z - c[0] * sa + c[1] * ca];
}
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
// The game's solids of a wall, post, window, fence or stair in the piece's own frame, as width and depth: walls are
// 0.3 m and posts 0.4 m thick in the game, so furniture against them keeps that much clear.
const GAME_WD = new Map();
function gameWD(name) {
  if (GAME_WD.has(name)) return GAME_WD.get(name);
  let v = null;
  const L = SHD && SHD.local(name);
  if (L && L.length) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const o of L) for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const x = o.c[0] + sx * o.a[0][0] * o.h[0] + sy * o.a[1][0] * o.h[1] + sz * o.a[2][0] * o.h[2];
      const z = o.c[2] + sx * o.a[0][2] * o.h[0] + sy * o.a[1][2] * o.h[1] + sz * o.a[2][2] * o.h[2];
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
    }
    v = [2 * Math.max(-x0, x1), 2 * Math.max(-z0, z1)];
  }
  GAME_WD.set(name, v);
  return v;
}
function structBox0(p) {
  const info = P.piece(p.name);
  const [w, h, d] = info.size;
  const g = BLOCKING.has(info.role) && info.role !== 'door' && gameWD(p.name);
  const prop = info.shape === 'prop' || info.shape === 'cap' || info.shape === 'tri' || info.shape === 'triInv' || info.onPivot;
  const y0 = prop ? p.y : p.y - h / 2, y1 = prop ? p.y + h : p.y + h / 2;
  const out = { p, info, role: info.role, b: obox(p.x, p.z, w, d, pyaw(p)), y0, y1 };
  // gb: the box the game's solids take, where larger (furniture keeps clear of it; rooms are read from b)
  if (g && (g[0] > w + 0.02 || g[1] > d + 0.02)) out.gb = obox(p.x, p.z, Math.max(w, g[0]), Math.max(d, g[1]), pyaw(p));
  return out;
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
    const gb = s.gb || s.b;
    const ht = gb.hw * Math.abs(gb.c * nx - gb.s * nz) + gb.hd * Math.abs(gb.s * nx + gb.c * nz);
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
      const f = { ux, uz, nx: r.nx, nz: r.nz, off: 0, side: 1, a0: lo - G / 2, a1: hi + G / 2, ht: 0.15, edge: true, runs: [], samples: [] };
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
        if (overlap(s.gb || s.b, b, -0.02)) return false;
      }
      // both sides of every door within reach, as the audit sees them, whichever room they open into
      if (f.at !== 'mount' && f.at !== 'hang') for (const s of this.near(x, z, b.r + 2.4)) {
        if (s.role !== 'door' || s.y0 > y0 + 1.8 || s.y1 < y0 + 0.05) continue;
        const dy = pyaw(s.p), ar = dy * PI / 180, nx = Math.sin(ar), nz = Math.cos(ar);
        for (const sg of [1, -1]) if (overlap(obox(s.p.x + nx * sg * (s.b.hd + 0.6), s.p.z + nz * sg * (s.b.hd + 0.6), s.b.hw * 2, 1.2, dy), b, -0.02)) return false;
      }
    }
    // furnishing already in the building that this floor's rooms do not know of (another room's, laid earlier)
    if (!rug) for (const q of this.outBoxes()) {
      if (q.y0 > y1 - 0.05 || q.y1 < y0 + 0.05) continue;
      if (overlap(q.b, b, -0.02)) return false;
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
  outBoxes() {
    const out = this.out || [];
    if (this._ob && this._obN === out.length) return this._ob;
    const mine = new Set(this.mates.map(q => q.p).filter(Boolean));
    this._ob = [];
    for (const p of out) {
      const f = F[p.name];
      if (!p.decor || !f || mine.has(p) || !['floor', 'wall'].includes(f.at)) continue;
      const [w, h, d] = size(p.name), yaw = pyaw(p), [mx, mz] = middleOf(p.name, p.x, p.z, yaw), y0 = p.y - (f.base || 0);
      this._ob.push({ b: obox(mx, mz, w, d, yaw), y0, y1: y0 + h });
    }
    this._obN = out.length;
    return this._ob;
  }
  add(name, x, y, z, yaw, extra = {}) {
    const [w, h, d] = size(name);
    const f = F[name] || {};
    const rec = { name, b: obox(x, z, w, d, yaw), y0: y, y1: y + h, rug: f.at === 'rug', fire: f.cat === 'fire', mount: !!extra.mount, x, z, yaw, ...extra };
    if (extra.mount) rec.b = obox(x, z, w, Math.max(d, 0.3), yaw);
    this.placed.push(rec);
    rec.room = this;
    this.mates.push(rec);
    const [px, pz] = pivotOf(name, x, z, yaw);
    const piece = { name, x: +px.toFixed(3), y: +y.toFixed(3), z: +pz.toFixed(3), q: quatY(norm(yaw)), yaw: norm(yaw), decor: true };
    rec.p = piece;
    this.out.push(piece);
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
      if (p === t.p) { room.out.splice(j, 1); break; }
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
      for (const r of done) { room.placed.splice(room.placed.indexOf(r), 1); room.mates.splice(room.mates.indexOf(r), 1); room.mounts.pop(); room.count--; const j = room.out.lastIndexOf(r.p); if (j >= 0) room.out.splice(j, 1); }
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
  // furniture built from building pieces (a bar counter of half walls and beams) is held up by the support check;
  // here it is structure that other furniture stands on
  const built = p => isDeco(p) && !F[p.name] && P.piece(p.name).structural;
  const deco = pieces.filter(p => isDeco(p) && !built(p));
  const struct = pieces.filter(p => !isDeco(p) || built(p)).map(structBox);
  const boxOf = p => { const [w, h, d] = size(p.name); const f = F[p.name] || {}; const y0 = p.y - (f.base || 0) - (f.at === 'hang' ? 0 : 0); const [mx, mz] = middleOf(p.name, p.x, p.z, pyaw(p)); return { p, f, b: obox(mx, mz, w, d, pyaw(p)), y0: f.at === 'hang' ? p.y : y0, y1: f.at === 'hang' ? p.y + h : y0 + h }; };
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
        const px = it.b.x + ux * t - nx * back, pz = it.b.z + uz * t - nz * back;
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
    if (fa === 'rug' && struct.filter(s => built(s.p) && s.role === 'pole' && Math.abs(s.y1 - it.p.y) < 0.15 && overlap(s.b, it.b, 0)).length >= 3) continue; // a canopy on posts
    if (fa === 'top' && struct.some(s => built(s.p) && ptDist(s.b, it.p.x, it.p.z) < 0.05 && Math.abs(s.y1 - it.p.y) < 0.2)) continue; // on a built counter
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
