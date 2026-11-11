// Landscaping (D-143 to D-147): greenery round and on a finished building, after its yard. Vines on the walls, flowers,
// bushes and mushrooms at the foot of the walls, under the eaves, in the yard, along the yard path and the fence, pots
// by the door, small trees put in grown and scaled (D-146), and planting in a courtyard.
//
// Every share, spacing, distance, group size and scale comes from the corpus (data/landscape/corpus-greenery.json,
// 609 builds with vanilla greenery, 296 of them house builds; D-136). What has no corpus number (how the stages and the
// village change it) is a setting, named as such below.
//
// Every piece this pass places, and the plants the yard and the window boxes put in (lib/yards.js, lib/details.js), is
// marked p.green = { k: class, at: place, src: gathered | standin | built, use: food | keep, own: home | shared }.
// lib/blueprint.js writes the marks as the file's '#VillheimGreen' section, so the mod can tell village greenery from
// wild growth: no gathering for materials (D-143); 'food' plants stay when picked and may be picked for food by the
// household of the home they serve, or by anyone at a shared building (D-144); 'keep' plants are never taken by
// villagers; players may pick or fell any of it and the village plants it back (D-147). src says how it is paid
// (D-145: gathered nearby, or a stand-in from the chests; pots are built as decor, D-080).
//
// Kept clear: each door's entry zone (the opening plus 0.3 m each side, 1.5 m out, D-152) and a walk lane on from it,
// the yard path and the gate, the foot of outside stairs, the front of woodpiles. A vine never covers a door and never
// covers most of a window; a plant on the ground never stands full in front of a window.
const NODE_L = typeof module !== 'undefined';
const PL = NODE_L ? require('./pieces.js') : window.VHPieces;
const checksL = () => (NODE_L ? require('./checks.js') : window.VHChecks);
const normL = a => ((a % 360) + 360) % 360;
function rngL(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const hashL = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

// ---------------------------------------------------------------- corpus measures

// House builds with greenery outside (corpus-greenery.json house_builds.outdoor_per_build): the share that has any of
// the class, and the pieces when they do [median, p75]. Crops are the yard's beds (lib/yards.js); roots stand mostly on
// decks and in planters (raised places) in the corpus, which the lab does not build, so neither is placed here.
const HOUSE = { vine: [0.27, 23, 64], bush: [0.36, 6, 19], flower: [0.30, 2, 8], tree: [0.28, 3, 6], pot: [0.11, 4, 8], mushroom: [0.16, 8, 56] };
// Where each class stands outside: pieces by place (pieces_by_class_place), the places this pass makes. Mushrooms and
// pots: builds by place (builds_by_class_place), since their piece counts by place were not kept; pots on sills are the
// window boxes (lib/details.js).
const PLACES = {
  vine: { wall: 13308 },
  flower: { yard: 435, eaves: 288, foot: 179, court: 80, fence: 52, path: 43 },
  bush: { yard: 692, eaves: 626, foot: 399, court: 119, path: 107, fence: 69 },
  tree: { yard: 240, eaves: 106, foot: 83, court: 40, path: 22, fence: 8 },
  mushroom: { yard: 25, eaves: 20, foot: 17, court: 11, path: 3, fence: 1 },
  pot: { eaves: 63, foot: 8, path: 3, fence: 2, court: 1, yard: 1 },
};
// Nearest piece of the same class [p25, median, p75], m (spacing_nearest_same_kind_m), by place; 'all' where the place
// has no number of its own.
const SPACING = {
  tree: { all: [1.83, 2.99, 4.73], yard: [1.92, 2.79, 4.62], foot: [2.69, 3.67, 5.26], court: [1.94, 2.84, 3.98], path: [3.55, 3.9, 5.18] },
  bush: { all: [0.71, 1.24, 2.53], yard: [0.77, 1.14, 2.23], foot: [0.82, 1.33, 3.53], path: [0.73, 1.72, 3.82], court: [0.41, 0.82, 1.73], fence: [0.41, 2.69, 2.74] },
  flower: { all: [0.51, 1.01, 1.44], yard: [0.41, 1.01, 1.06], foot: [0.45, 0.87, 1.73], path: [0.93, 1.35, 2.68], court: [0.45, 0.69, 1.0], fence: [0.45, 2.74, 2.74] },
  pot: { all: [0.22, 0.69, 2.09], eaves: [0.37, 0.77, 2.39] },
  mushroom: { all: [0.51, 1.01, 1.44] }, // no number of its own: the flowers'
  vine: { all: [0.11, 0.28, 0.61] }, // vines.spacing_on_wall_m
};
// Distance from the nearest wall for plants on the ground away from it (distance_from_walls_on_the_ground_m)
const FROM_WALL = { bush: [1.39, 3.25, 5.43], flower: [1.64, 3.69, 5.54], tree: [1.74, 3.74, 5.47], mushroom: [1.64, 3.69, 5.54], pot: [1.64, 3.69, 5.54] };
// The place 'against a wall' is the ground within 1.5 m of it (corpus-greenery.json places); 'path edge' within 1.6 m of
// a floor laid on the ground; 'along a fence' within 1.5 m of a fence.
const FOOT_MAX = 1.5, PATH_MAX = 1.6, FENCE_MAX = 1.5;
// Groups of one class within 2 m (groups): singles, pairs, clusters of 3 to 6, masses of 7 and more; and of the groups
// of two or more, the share in a line and the share that mixes prefabs.
const GROUPS = {
  bush: { n: [1899, 422, 274, 109], line: 111 / 805, mixed: 308 / 805 },
  flower: { n: [660, 203, 95, 36], line: 17 / 334, mixed: 45 / 334 },
  tree: { n: [1284, 116, 38, 2], line: 5 / 156, mixed: 49 / 156 },
  pot: { n: [850, 172, 180, 25], line: 42 / 377, mixed: 288 / 377 },
  mushroom: { n: [517, 192, 227, 104], line: 0, mixed: 0.3 },
  vine: { n: [251, 147, 351, 596], line: 275 / 1094, mixed: 0 }, // vines.groups; mass size p90 28
};
// Scaled pieces (scale): the share placed at a scale other than 1, and the 10th and 90th percentile scale.
const SCALE = { tree: [0.79, 0.49, 1.46], bush: [0.28, 0.9, 1.29], mushroom: [0.16, 1.0, 1.55] };
// Vines: height on the wall [p10, median, p90] m, and the share of vines at a corner (vines)
const VINE_HEIGHT = [1.03, 5.6, 16.72], VINE_CORNER = 0.38;
// Culture leans: a class's share of the culture group's builds over its share of all 609 builds (by_culture), pulled
// toward 1 by 20 builds so small groups count for less. Lab cultures with a corpus group of their own; Ashlands
// buildings without one use the Ashlands group.
const LEAN = {
  'norse': { vine: 0.77, bush: 1.14, flower: 1.22, tree: 1.21, pot: 1.1, mushroom: 1.05 },
  'norse-forest': { vine: 1.03, bush: 1.04, flower: 1.03, tree: 0.79, pot: 0.89, mushroom: 0.45 },
  'norse-highland': { vine: 0.88, bush: 1.06, flower: 1.26, tree: 1.15, pot: 0.74, mushroom: 1.24 },
  'fen-folk': { vine: 1.09, bush: 1.26, flower: 1.02, tree: 1.09, pot: 0.93, mushroom: 0.8 },
  'castle-medieval': { vine: 1.17, bush: 1.02, flower: 1.0, tree: 1.03, pot: 1.16, mushroom: 0.97 },
  'ashlands': { vine: 0.93, bush: 0.67, flower: 0.83, tree: 0.78, pot: 1.62, mushroom: 0.59 },
};

// Settings with no corpus number (the corpus has no stages and 9 village builds): how likely each class is by stage
// (averaging 1 over the three, so the shares across stages match the corpus), and the range of a village's own
// greenness roll. Values in use until the lead or Tyler sets them.
const STAGE_W = { s1: 0.5, s2: 1.0, s3: 1.5 };
const VILLAGE_GREEN = [0.6, 1.4];
// The most the pass may grow the plot (Blueprints.cs Center: the farthest pivot plus 2 m), m.
const PLOT_GROW = 0.5;
// Decor stage each class goes in at (D-071; Persona.growth keeps ds <= the decor asked): first flowers, then the rest.
const DS = { flower: 1, pot: 2, bush: 2, mushroom: 2, tree: 2, vine: 3 };

// ---------------------------------------------------------------- plants by biome

// Where each prefab grows wild (data/landscape/vanilla-greenery.json grows_wild_in) and its model's size (w, h, d, m;
// size_m). Only prefabs with a measured model, so the renders and the spread rules read true; Birch, Oak, the Swamp
// trees and the glowing mushroom have none yet.
const PLANTS = {
  vine: [['vines', ['Meadows', 'Black Forest'], [2.32, 2.43, 0.46], 1], ['VineGreen', ['Ashlands'], [0.46, 2.39, 2.54], 2], ['VineAsh', ['Ashlands'], [0.46, 2.39, 2.54], 1]],
  bush: [['Bush01', ['Meadows'], [2.91, 2.56, 2.85], 2], ['shrub_2', ['Meadows'], [3.59, 3.1, 3.47], 1], ['RaspberryBush', ['Meadows'], [2.91, 2.56, 2.85], 1],
    ['Bush02_en', ['Black Forest', 'Swamp', 'Mistlands'], [3.43, 5.11, 3.53], 2], ['BlueberryBush', ['Black Forest'], [2.91, 2.56, 2.85], 1],
    ['Bush01_heath', ['Plains', 'Mountain'], [2.91, 2.56, 2.85], 2], ['shrub_2_heath', ['Plains', 'Mountain'], [3.59, 3.1, 3.47], 1], ['CloudberryBush', ['Plains'], [0.99, 0.87, 0.69], 1],
    ['AshlandsBush1', ['Ashlands'], [3.39, 2.65, 2.29], 1]],
  flower: [['Pickable_Dandelion', ['Meadows'], [0.75, 0.52, 0.49], 1], ['Pickable_Thistle', ['Black Forest'], [0.54, 1.52, 0.47], 1],
    ['Pickable_Fiddlehead', ['Ashlands'], [0.72, 1.39, 1.19], 1], ['Fiddleheadfern', ['Ashlands'], [0.34, 0.33, 0.4], 1], ['FernAshlands', ['Ashlands'], [2.64, 0.81, 2.64], 1]],
  mushroom: [['Pickable_Mushroom', ['Meadows', 'Black Forest'], [0.36, 0.37, 0.33], 2], ['Pickable_Mushroom_yellow', ['Black Forest', 'Swamp'], [0.3, 0.31, 0.28], 1]],
  tree: [['Beech_small1', ['Meadows'], [2.54, 3.78, 2.31], 2], ['Beech_small2', ['Meadows'], [2.97, 3.88, 2.61], 1], ['FirTree_small', ['Black Forest', 'Mountain'], [6.25, 10.89, 7.18], 2],
    ['FirTree_small_dead', ['Black Forest', 'Mountain'], [6.25, 10.89, 7.18], 0.3], ['YggaShoot_small1', ['Mistlands'], [1.75, 3.84, 2.0], 1]],
  // pots are pieces the village builds (decor in any biome, D-065, paid as decor, D-080)
  pot: [['piece_pot1', null, [0.76, 0.95, 0.76], 1], ['piece_pot2', null, [0.69, 1.59, 0.69], 1], ['piece_pot3', null, [0.9, 0.72, 0.9], 1], ['piece_pot2_cracked', null, [0.69, 1.59, 0.69], 0.2]],
};
// What lies near a village's biome, to gather from (D-145: "their biome proximity"): the biome and the ones that
// border it in the world (value in use; the lead's call).
const NEAR = {
  'Meadows': ['Meadows', 'Black Forest'], 'Black Forest': ['Black Forest', 'Meadows', 'Swamp', 'Mountain'], 'Swamp': ['Swamp', 'Black Forest', 'Plains'],
  'Mountain': ['Mountain', 'Black Forest', 'Plains'], 'Plains': ['Plains', 'Swamp', 'Mountain', 'Black Forest', 'Mistlands'], 'Mistlands': ['Mistlands', 'Plains', 'Mountain'],
  'Ashlands': ['Ashlands'], 'Deep North': ['Deep North', 'Mountain'],
};
const BIOMES_L = PL.BIOME_ORDER;
const KIND_OF = {};
for (const [k, list] of Object.entries(PLANTS)) for (const e of list) KIND_OF[e[0]] = k;
// other greenery the lab places (lib/yards.js beds and bushes, lib/details.js window boxes) and its class
const OTHER_GREEN = { Pickable_Carrot: 'crop', Pickable_Turnip: 'crop', Pickable_Onion: 'crop', Pickable_Barley: 'crop', Pickable_Flax: 'crop',
  Pickable_Mushroom_blue: 'mushroom', Pickable_Mushroom_Magecap: 'mushroom', GlowingMushroom: 'mushroom' };
const classOf = name => KIND_OF[name] || OTHER_GREEN[name] || null;
// D-144: a garden plant that stays when picked (it grows its food back) may be picked for food by those it belongs to;
// everything else is never taken. Plants that stay: the berry bushes, the flowers and mushrooms that grow back where
// they stood, and Ashvine (its berries grow on the vine). Crops are gone when picked. Read from how these prefabs
// behave in the game as the lab knows it; not checked against the game files (the mod can confirm with the Pickable's
// respawn time).
const STAYS = /^(RaspberryBush|BlueberryBush|CloudberryBush|Pickable_Dandelion|Pickable_Thistle|Pickable_Mushroom(_yellow|_blue)?|Pickable_Fiddlehead|VineAsh)$/;
const useOf = name => (STAYS.test(name) ? 'food' : 'keep');
// D-144: a home's garden is its household's; a shared building's greenery is everyone's.
const ownerOf = type => (['home', 'farm'].includes(type) ? 'home' : 'shared');

// The plants of a class the village can gather near its biome, the village's own first; when there are none, the
// nearest biome's (a stand-in from the chests, D-145, D-080). Pots are built.
function choices(kind, biome) {
  const list = PLANTS[kind];
  if (kind === 'pot') return list.map(e => ({ e, w: e[3], src: 'built' }));
  const near = NEAR[biome] || [biome];
  const got = list.filter(e => e[1].some(b => near.includes(b))).map(e => ({ e, w: e[3] * (e[1].includes(biome) ? 3 : 1), src: 'gathered' }));
  if (got.length) return got;
  const at = BIOMES_L.indexOf(biome), far = e => Math.min(...e[1].map(b => Math.abs(BIOMES_L.indexOf(b) - at)));
  const best = Math.min(...list.map(far));
  return list.filter(e => far(e) === best).map(e => ({ e, w: e[3], src: 'standin' }));
}
function pickW(R, list) {
  const t = list.reduce((s, x) => s + x.w, 0);
  let v = R() * t;
  for (const x of list) if ((v -= x.w) <= 0) return x;
  return list[list.length - 1];
}
// a draw from three quantiles [p25, median, p75] (or p10, median, p90 with q = 1.2816): log-normal through them
function gauss(R) { let u = 0, v = 0; while (u === 0) u = R(); v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function quant(R, [lo, mid, hi], q = 0.6745, clip = 2.2) {
  const z = Math.max(-clip, Math.min(clip, gauss(R)));
  return z < 0 ? mid * Math.pow(lo / mid, -z / q) : mid * Math.pow(hi / mid, z / q);
}
// (never more than twice the p75: the corpus's long tails are whole decorated estates)
function count(R, med, p75, lift) { return Math.max(1, Math.min(2 * p75, Math.round(quant(R, [med * med / p75, med, p75], 0.6745, 2) * (lift || 1)))); }
function groupSize(R, kind) {
  const g = GROUPS[kind].n, t = g[0] + g[1] + g[2] + g[3];
  let v = R() * t;
  if ((v -= g[0]) <= 0) return 1;
  if ((v -= g[1]) <= 0) return 2;
  if ((v -= g[2]) <= 0) return 3 + Math.floor(R() * 4);
  return kind === 'vine' ? 7 + Math.floor(Math.pow(R(), 2) * 22) : 7 + Math.floor(R() * 5);
}

// ---------------------------------------------------------------- what is there

const hit = (a, z, pad = 0) => a.x0 < z.x1 + pad && a.x1 > z.x0 - pad && a.z0 < z.z1 + pad && a.z1 > z.z0 - pad && a.y0 < z.y1 && a.y1 > z.y0;

// The walls' outer faces, the doors' openings with their entry zones and lanes, the ground floor, the roofs, and the
// places to keep clear.
function survey(b, G0) {
  const Ck = checksL();
  const boxes = b.pieces.map(p => ({ p, o: Ck.aabb(p), info: PL.piece(p.name) }));
  const floors = boxes.filter(x => x.info.role === 'floor' && !x.p.decor && x.o.y1 < G0 + 1.4 && x.o.y1 > G0 - 0.8 && !x.p.yard).map(x => x.o);
  const onFloor = (x, z) => floors.some(o => x > o.x0 - 0.05 && x < o.x1 + 0.05 && z > o.z0 - 0.05 && z < o.z1 + 0.05);
  const segs = [];
  for (const x of boxes) {
    if (x.p.decor || x.p.trim || x.p.yard || !['wall', 'door', 'window'].includes(x.info.role)) continue;
    const sz = x.info.size, along = sz[0] >= sz[2];
    const a = ((x.p.yaw != null ? x.p.yaw : 0) + (along ? 0 : 90)) * Math.PI / 180;
    const u = [Math.cos(a), -Math.sin(a)], n = [Math.sin(a), Math.cos(a)];
    const cx = (x.o.x0 + x.o.x1) / 2, cz = (x.o.z0 + x.o.z1) / 2, half = Math.max(sz[0], sz[2]) / 2, thick = Math.min(sz[0], sz[2]) / 2;
    if (half < 0.4) continue;
    // the outer side: the side whose ground is not the house's floor
    const out = s => !onFloor(cx + n[0] * s * 0.7, cz + n[1] * s * 0.7);
    const o1 = out(1), o2 = out(-1);
    if (!o1 && !o2) continue;
    const sg = o1 && o2 ? (Math.hypot(cx + n[0], cz + n[1]) > Math.hypot(cx - n[0], cz - n[1]) ? 1 : -1) : o1 ? 1 : -1;
    segs.push({ cx, cz, u, n: [n[0] * sg, n[1] * sg], half, thick, y0: x.o.y0, y1: x.o.y1, role: x.info.role, p: x.p });
  }
  // faces: segments in one plane facing one way
  const faces = [];
  for (const s of segs) {
    const off = s.cx * s.n[0] + s.cz * s.n[1];
    let f = faces.find(f => f.n[0] * s.n[0] + f.n[1] * s.n[1] > 0.995 && Math.abs(f.off - off) < 0.35);
    if (!f) { f = { n: s.n, u: [-s.n[1], s.n[0]], off, segs: [], ox: s.cx, oz: s.cz }; faces.push(f); }
    f.segs.push(s);
  }
  for (const f of faces) {
    for (const s of f.segs) { s.t = (s.cx - f.ox) * f.u[0] + (s.cz - f.oz) * f.u[1]; s.face = f.off + s.thick; }
    f.t0 = Math.min(...f.segs.map(s => s.t - s.half)); f.t1 = Math.max(...f.segs.map(s => s.t + s.half));
    f.plane = Math.max(...f.segs.map(s => s.face)); // the outer face, along n
    f.ground = f.segs.filter(s => s.y0 < G0 + 1.2);
    // the outer face at t (and height y): the pieces there, as a stone course may stand out from the wall under it
    // (a vine over y0..y1 keeps to the wall face farthest in, clipping into a course that stands out)
    f.planeAt = (t, y0, y1) => {
      const at = f.segs.filter(s => Math.abs(t - s.t) <= s.half + 0.02 && (y0 == null || (y1 >= s.y0 - 0.05 && y0 <= s.y1 + 0.05)));
      return at.length ? (y0 == null ? Math.max(...at.map(s => s.face)) : Math.min(...at.map(s => s.face))) : f.plane;
    };
    f.base = (t, d, y0, y1) => { const pl = f.planeAt(t, y0, y1); return [f.ox + f.u[0] * t + f.n[0] * (pl - f.off + d), f.oz + f.u[1] * t + f.n[1] * (pl - f.off + d)]; };
    // is (t, y) on the wall? (a door's or window's piece is an opening)
    f.cover = (t, y) => f.segs.some(s => s.role === 'wall' && Math.abs(t - s.t) <= s.half + 0.02 && y >= s.y0 - 0.02 && y <= s.y1 + 0.02);
    f.top = t => Math.max(-Infinity, ...f.segs.filter(s => s.role === 'wall' && Math.abs(t - s.t) <= s.half).map(s => s.y1));
    // openings in the wall: window pieces, and holes between wall pieces with wall under or over them
    f.holes = [];
    const yTop = Math.max(...f.segs.map(s => s.y1));
    for (let t = f.t0 + 0.125; t < f.t1; t += 0.25) for (let y = G0 + 0.4; y < yTop; y += 0.3) {
      if (f.cover(t, y)) continue;
      const under = f.cover(t, y - 0.6) || f.cover(t, y - 1.2), over = f.cover(t, y + 0.6) || f.cover(t, y + 1.2);
      const side = f.cover(t - 0.6, y) && f.cover(t + 0.6, y);
      if ((under && over) || (side && (under || over))) f.holes.push([t, y]);
    }
  }
  // doors: the entry zone outside (the opening plus 0.3 m each side, 1.5 m out, D-152) on both sides, a lane on from it
  // to 4 m out, and the door's opening on its wall for the vines
  const keep = [], doors = [];
  for (const x of boxes) {
    if (x.info.role !== 'door' || x.p.yard) continue;
    const o = PL.doorOpening(x.p);
    doors.push(o);
    if (o.y > G0 + 2.5) continue;
    const hw = o.w / 2 + 0.3;
    for (const s of [-1, 1]) {
      const nx = o.nx * s, nz = o.nz * s;
      keep.push({ ...rectAlong(o.x, o.z, o.ux, o.uz, nx, nz, -hw, hw, 0, 1.5), why: 'entry' });
      keep.push({ ...rectAlong(o.x, o.z, o.ux, o.uz, nx, nz, -o.w / 2 - 0.1, o.w / 2 + 0.1, 1.5, 4), why: 'lane' });
    }
  }
  // the yard's path planks and its gate, with 0.25 m round the planks and 1.2 m either side of the gate
  for (const x of boxes) {
    if (!x.p.yard) continue;
    if (x.info.role === 'floor') keep.push({ x0: x.o.x0 - 0.25, x1: x.o.x1 + 0.25, z0: x.o.z0 - 0.25, z1: x.o.z1 + 0.25, y0: -50, y1: 50, why: 'path', path: true });
    if (/gate/.test(x.p.name)) keep.push({ x0: x.o.x0 - 1.3, x1: x.o.x1 + 1.3, z0: x.o.z0 - 1.3, z1: x.o.z1 + 1.3, y0: -50, y1: 50, why: 'gate' });
  }
  // the foot of a stair, the front of a woodpile
  for (const x of boxes) {
    if (x.info.role === 'stair' && x.o.y0 < G0 + 0.8) keep.push({ x0: x.o.x0 - 1.2, x1: x.o.x1 + 1.2, z0: x.o.z0 - 1.2, z1: x.o.z1 + 1.2, y0: -50, y1: 50, why: 'stair' });
    if (/^wood_(fine_|core_)?stack$/.test(x.p.name) && x.o.y0 < G0 + 0.5) keep.push({ x0: x.o.x0 - 1, x1: x.o.x1 + 1, z0: x.o.z0 - 1, z1: x.o.z1 + 1, y0: -50, y1: 50, why: 'woodpile' });
  }
  // what a plant may not stand in: anything but floors laid on the ground, rugs and other plants
  const solid = boxes.filter(x => !['rug'].includes(x.info.role) && !classOf(x.p.name) && !(x.info.role === 'floor' && x.o.y1 < G0 + 0.12)).map(x => x.o);
  const roofs = boxes.filter(x => ['roof', 'roofTop', 'roofCorner', 'gable', 'beam', 'floor'].includes(x.info.role) && x.o.y0 > G0 + 1.2).map(x => x.o);
  const fences = boxes.filter(x => x.p.yard && x.info.role === 'fence').map(x => x.o);
  const paths = keep.filter(z => z.path);
  return { boxes, faces, doors, keep, solid, roofs, fences, paths, onFloor };
}
function rectAlong(x, z, ux, uz, nx, nz, a0, a1, b0, b1) {
  const xs = [], zs = [];
  for (const a of [a0, a1]) for (const c of [b0, b1]) { xs.push(x + ux * a + nx * c); zs.push(z + uz * a + nz * c); }
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), y0: -50, y1: 50 };
}

// A courtyard point: on the ground, off the floor, with walls met by 6 of 8 rays within 12 m (the corpus's courtyard)
function courtSpots(S, G0) {
  const segs = S.faces.flatMap(f => f.ground.map(s => ({ ax: s.cx - s.u[0] * s.half, az: s.cz - s.u[1] * s.half, bx: s.cx + s.u[0] * s.half, bz: s.cz + s.u[1] * s.half })));
  if (segs.length < 4) return [];
  const xs = segs.flatMap(s => [s.ax, s.bx]), zs = segs.flatMap(s => [s.az, s.bz]);
  const out = [];
  const ray = (x, z, dx, dz) => segs.some(s => {
    const ex = s.bx - s.ax, ez = s.bz - s.az, den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-9) return false;
    const t = ((s.ax - x) * ez - (s.az - z) * ex) / den, v = ((s.ax - x) * dz - (s.az - z) * dx) / den;
    return t > 0 && t < 12 && v >= 0 && v <= 1;
  });
  for (let x = Math.min(...xs) + 0.5; x < Math.max(...xs); x += 1) for (let z = Math.min(...zs) + 0.5; z < Math.max(...zs); z += 1) {
    if (S.onFloor(x, z)) continue;
    let k = 0;
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; if (ray(x, z, Math.cos(a), Math.sin(a))) k++; }
    if (k >= 6) out.push([x, z]);
  }
  void G0;
  return out;
}

// ---------------------------------------------------------------- placing

/**
 * Adds greenery to a finished design b (after its yard). ctx: { type, stage, biome, cultureKey, decor, seed, persona,
 * opts } with opts from req.landscape (false turns the pass off; an object may set green: the village's greenness,
 * and only: a list of classes). Returns a summary, or null when nothing fits.
 */
function add(b, ctx) {
  const opts = ctx.opts && typeof ctx.opts === 'object' ? ctx.opts : {};
  const C = ctx.C || {};
  mark(b, ctx);
  if (C.stilts || C.boardwalk) return null;
  const G0 = Math.min(...b.pieces.map(p => p.y));
  if (!(G0 > -0.6 && G0 < 0.01)) return null;
  const S = survey(b, G0);
  if (!S.faces.length) return null;
  const Ck = checksL();
  const R = rngL(hashL(`${ctx.seed || 1}|${ctx.type}|${ctx.biome}|${ctx.cultureKey}|${ctx.stage}|${b.pieces.length}`));
  const H = ctx.persona || {}, hob = (H.hobby && H.hobby.plants) || 0.3, tidy = H.tidy != null ? H.tidy : 0.5;
  const cared = tidy > 0.5;
  // the village's greenness: one roll per village (opts.green, or one from the village's seed, else the design's)
  const vR = rngL(hashL(`${opts.village != null ? opts.village : ctx.seed}|${ctx.cultureKey}|${ctx.biome}`));
  const village = opts.green != null ? +opts.green : VILLAGE_GREEN[0] + vR() * (VILLAGE_GREEN[1] - VILLAGE_GREEN[0]);
  const lean = LEAN[ctx.cultureKey] || (ctx.biome === 'Ashlands' ? LEAN.ashlands : {});
  const stageW = STAGE_W[ctx.stage] || 1;
  const own = ownerOf(ctx.type);
  const radius0 = plotR(b.pieces);
  const placed = [];
  const court = courtSpots(S, G0);

  // which classes this building carries, and how many of each
  const want = {};
  const hh = { flower: 0.7 + 0.6 * hob, pot: 0.6 + 0.8 * hob, bush: 0.85 + 0.3 * hob, mushroom: 0.9 + 0.2 * hob, tree: 1, vine: 1.15 - 0.3 * tidy };
  for (const k of Object.keys(HOUSE)) {
    if (opts.only && !opts.only.includes(k)) continue;
    const [share, med, p75] = HOUSE[k];
    const p = Math.min(0.95, share * stageW * village * (lean[k] || 1) * hh[k]);
    if (R() < p) want[k] = count(R, med, p75, k === 'vine' && !cared ? 1.2 : 1);
  }

  // ---- the checks every piece passes
  const spread = e => Math.max(e[2][0], e[2][2]) / 2;
  const inKeep = (o) => S.keep.some(z => hit(o, z, 0));
  const grows = p => plotR([...b.pieces, p]) - radius0 > PLOT_GROW;
  const sameNear = (kind, x, z, d) => placed.some(q => q.green.k === kind && Math.hypot(q.x - x, q.z - z) < d);
  // a plant on the ground in front of a window, as wide as most of it
  const blocksWindow = (x, z, r, top) => S.faces.some(f => {
    const d = (x - f.ox) * f.n[0] + (z - f.oz) * f.n[1] - (f.plane - f.off);
    if (d < 0 || d > 1.6) return false;
    const t = (x - f.ox) * f.u[0] + (z - f.oz) * f.u[1];
    const holes = f.holes.filter(([ht, hy]) => hy < G0 + top && Math.abs(ht - t) < r + 1.2);
    if (holes.length < 3) return false;
    return holes.filter(([ht]) => Math.abs(ht - t) < r * 0.9).length / holes.length > 0.8;
  });
  // the piece on the ground at (x, z): its collider clear of what is there, its spread clear of the kept places, off
  // the floor, under no roof that it would grow into, within the plot
  // inside the yard: no fence between the house's middle and the spot (a fence crossing the way out)
  const mid = (() => { const g = S.faces.flatMap(f => f.ground); return g.length ? [g.reduce((a, s) => a + s.cx, 0) / g.length, g.reduce((a, s) => a + s.cz, 0) / g.length] : [0, 0]; })();
  const crosses = (x, z, o) => {
    let t0 = 0, t1 = 1;
    for (const [p0, d, lo, hi] of [[mid[0], x - mid[0], o.x0, o.x1], [mid[1], z - mid[1], o.z0, o.z1]]) {
      if (Math.abs(d) < 1e-9) { if (p0 < lo || p0 > hi) return false; continue; }
      let a = (lo - p0) / d, c = (hi - p0) / d;
      if (a > c) { const t = a; a = c; c = t; }
      t0 = Math.max(t0, a); t1 = Math.min(t1, c);
      if (t0 > t1) return false;
    }
    return true;
  };
  const inYard = (x, z) => !S.fences.length || !S.fences.some(o => crosses(x, z, o));
  const groundOk = (e, x, z, sc, kind) => {
    if (S.onFloor(x, z) || !inYard(x, z)) return false;
    const r = spread(e) * sc * 0.7, top = e[2][1] * sc;
    const foot = { x0: x - r, x1: x + r, z0: z - r, z1: z + r, y0: G0, y1: G0 + top };
    // a tree's crown stands over the way; a bush's or a flower's whole spread keeps off it
    const rk = kind === 'tree' ? Math.min(r, 0.6) : Math.max(r, 0.25);
    if (inKeep({ ...foot, x0: x - rk, x1: x + rk, z0: z - rk, z1: z + rk })) return false;
    const box = Ck.aabb({ name: e[0], x, y: G0, z, yaw: 0, s: sc !== 1 ? [sc, sc, sc] : undefined });
    if (S.solid.some(o => hit(box, o, 0.08))) return false;
    // the crown of a tree or bush clear of roofs, eaves and floors over it (a low plant passes under the eaves)
    if (kind === 'tree' || kind === 'bush') {
      const crown = { x0: x - r, x1: x + r, z0: z - r, z1: z + r, y0: G0 + top * 0.35, y1: G0 + top };
      if (S.roofs.some(o => hit(crown, o, 0))) return false;
    }
    if (kind !== 'flower' && kind !== 'mushroom' && blocksWindow(x, z, r, top)) return false;
    if (S.paths.some(o => x > o.x0 && x < o.x1 && z > o.z0 && z < o.z1)) return false;
    return true;
  };
  // one piece per spot as the overlap check counts them (prefab, place to 0.1 m, turn)
  const keyOf = (n, x, y, z, yaw) => `${n}|${x.toFixed(1)}|${y.toFixed(1)}|${z.toFixed(1)}|${Math.round(normL(yaw)) % 360}`;
  const keys = new Set(b.pieces.map(p => keyOf(p.name, p.x, p.y, p.z, p.yaw || 0)));
  const put = (e, kind, at, src, x, y, z, yaw, sc, extra) => {
    const p0 = { name: e[0], x, y, z, yaw };
    if (grows(p0) || keys.has(keyOf(e[0], x, y, z, yaw))) return false;
    keys.add(keyOf(e[0], x, y, z, yaw));
    const more = { green: { k: kind, at, src, use: useOf(e[0]), own }, ds: DS[kind], ...(extra || {}) };
    if (sc && Math.abs(sc - 1) > 0.01) more.s = [+sc.toFixed(3), +sc.toFixed(3), +sc.toFixed(3)];
    if (kind === 'pot') { more.decor = true; more.trim = true; }
    const n0 = b.pieces.length;
    if (typeof b.put === 'function') b.put(e[0], x, y, z, yaw, more);
    else b.pieces.push({ name: e[0], x: +x.toFixed(3), y: +y.toFixed(3), z: +z.toFixed(3), yaw: normL(yaw), q: quatL(yaw), ...more });
    if (b.pieces.length > n0) { placed.push(b.pieces[b.pieces.length - 1]); return true; }
    return false;
  };
  const scaleFor = kind => {
    const s = SCALE[kind];
    if (!s || R() >= s[0]) return 1;
    return Math.max(0.4, Math.min(1.7, quant(R, [s[1], Math.sqrt(s[1] * s[2]), s[2]], 1.2816, 1.6)));
  };

  // ---- spots by place: a point and a direction along which a group runs
  const groundFaces = S.faces.filter(f => f.ground.length);
  const pickFace = () => groundFaces[Math.floor(R() * groundFaces.length)];
  const onFace = (f, d) => { const t = f.t0 + R() * (f.t1 - f.t0); const [x, z] = f.base(t, d); return { x, z, dir: f.u, f, t }; };
  const eaveAt = (x, z) => S.roofs.some(o => x > o.x0 && x < o.x1 && z > o.z0 && z < o.z1 && o.y0 < G0 + 4.5);
  const spotFor = (kind, at) => {
    if (at === 'foot' || at === 'eaves' || at === 'yard') {
      if (!groundFaces.length) return null;
      const f = pickFace();
      const d = at === 'yard' ? Math.max(FOOT_MAX + 0.05, quant(R, FROM_WALL[kind] || FROM_WALL.bush)) : kind === 'bush' ? 0.8 + R() * 0.7 : kind === 'tree' ? 1.2 + R() * 0.3 : 0.3 + R() * 1.2;
      const s = onFace(f, d);
      const under = eaveAt(s.x, s.z);
      if (at === 'eaves' ? !under : at === 'foot' ? under : false) return null;
      return s;
    }
    if (at === 'court') {
      if (!court.length) return null;
      const c = court[Math.floor(R() * court.length)];
      const a = R() * Math.PI * 2;
      return { x: c[0] + (R() - 0.5), z: c[1] + (R() - 0.5), dir: [Math.cos(a), Math.sin(a)] };
    }
    if (at === 'path') {
      if (!S.paths.length) return null;
      const o = S.paths[Math.floor(R() * S.paths.length)];
      const side = Math.floor(R() * 4), d = 0.3 + R() * (PATH_MAX - 0.3);
      const cx = (o.x0 + o.x1) / 2, cz = (o.z0 + o.z1) / 2;
      const pts = [[o.x0 - d, cz + (R() - 0.5)], [o.x1 + d, cz + (R() - 0.5)], [cx + (R() - 0.5), o.z0 - d], [cx + (R() - 0.5), o.z1 + d]];
      return { x: pts[side][0], z: pts[side][1], dir: side < 2 ? [0, 1] : [1, 0] };
    }
    if (at === 'fence') {
      if (!S.fences.length) return null;
      const o = S.fences[Math.floor(R() * S.fences.length)];
      const along = o.x1 - o.x0 > o.z1 - o.z0;
      const d = (0.4 + R() * (FENCE_MAX - 0.4)) * (R() < 0.5 ? -1 : 1);
      const cx = (o.x0 + o.x1) / 2, cz = (o.z0 + o.z1) / 2;
      return along ? { x: cx + (R() - 0.5) * 1.6, z: cz + d, dir: [1, 0] } : { x: cx + d, z: cz + (R() - 0.5) * 1.6, dir: [0, 1] };
    }
    return null;
  };

  // ---- plants on the ground, by groups
  const got = {};
  const ground = kind => {
    let left = want[kind];
    const opts0 = choices(kind, ctx.biome);
    const places = Object.entries(PLACES[kind]).filter(([at]) => at !== 'court' || court.length).filter(([at]) => at !== 'path' || S.paths.length).filter(([at]) => at !== 'fence' || S.fences.length);
    let tries = 0, first = true;
    while (left > 0 && tries++ < 40) {
      const at = pickW(R, places.map(([k, w]) => ({ k, w }))).k;
      let s = spotFor(kind, at);
      // a courtyard's first tree in its middle
      if (kind === 'tree' && at === 'court' && first && court.length) { const mx = court.reduce((a, c) => a + c[0], 0) / court.length, mz = court.reduce((a, c) => a + c[1], 0) / court.length; s = { x: mx, z: mz, dir: [1, 0] }; }
      if (!s) continue;
      const n = Math.min(left, groupSize(R, kind));
      const sp = SPACING[kind][at] || SPACING[kind].all;
      const line = n > 1 && R() < Math.min(0.9, GROUPS[kind].line * (cared ? 3 : 0.7) + (at === 'foot' || at === 'path' ? 0.3 : 0));
      const mixed = n > 1 && R() < GROUPS[kind].mixed * (cared ? 0.6 : 1.4);
      let pick = pickW(R, opts0);
      // a tidy household keeps an even step along a line; a wild one draws each step
      const step0 = quant(R, sp);
      let x = s.x, z = s.z, k = 0, dir = s.dir, miss = 0;
      while (k < n && miss < 6) {
        const e = pick.e, sc = scaleFor(kind);
        const minGap = Math.max(sp[0] * 0.8, kind === 'tree' ? spread(e) * sc * 0.45 : 0.25);
        if (groundOk(e, x, z, sc, kind) && !sameNear(kind, x, z, minGap) && !placed.some(q => q.green.k !== kind && Math.hypot(q.x - x, q.z - z) < 0.35)) {
          const sink = kind === 'tree' || kind === 'bush' ? -R() * 0.12 : 0;
          if (put(e, kind, at, pick.src, x, G0 + sink, z, Math.floor(R() * 16) * 22.5, sc)) { k++; left--; first = false; got[kind] = (got[kind] || 0) + 1; }
          else miss++;
        } else miss++;
        if (mixed) pick = pickW(R, opts0);
        const st = cared && line ? step0 * (0.9 + R() * 0.2) : quant(R, sp);
        if (!line) { const a = R() * Math.PI * 2; dir = [Math.cos(a), Math.sin(a)]; }
        x += dir[0] * st; z += dir[1] * st;
      }
    }
  };
  for (const kind of ['tree', 'bush', 'pot', 'flower', 'mushroom']) if (want[kind]) ground(kind);

  // ---- vines: patches on the walls, from a corner or along a face, climbing in steps of the corpus spacing
  if (want.vine) {
    const opts0 = choices('vine', ctx.biome);
    let left = want.vine, tries = 0;
    const faces = S.faces.filter(f => f.t1 - f.t0 > 1.6);
    const doorRects = S.doors.map(o => ({ o, hw: o.w / 2 + 0.3 }));
    while (left > 0 && faces.length && tries++ < 30) {
      const f = faces[Math.floor(R() * faces.length)];
      const pick = pickW(R, opts0), e = pick.e, w = Math.max(e[2][0], e[2][2]), h = e[2][1];
      const n = Math.min(left, groupSize(R, 'vine'));
      const corner = R() < VINE_CORNER;
      let t = corner ? (R() < 0.5 ? f.t0 + w * 0.3 : f.t1 - w * 0.3) : f.t0 + w / 2 + R() * Math.max(0, f.t1 - f.t0 - w);
      let y = G0 + R() * 0.2;
      const cap = quant(R, VINE_HEIGHT, 1.2816, 1.6) + (cared ? 0 : 0.8);
      const yaw = normL(Math.atan2(-f.u[1], f.u[0]) * 180 / Math.PI + (e[2][0] >= e[2][2] ? 0 : 90));
      let k = 0, miss = 0;
      const sideways = R() < 0.5 ? 1 : -1;
      const patch = [];
      while (k < n && miss < 8) {
        // a vine grows from the ground up: its foot on the ground outside, or on a vine of the patch under it
        const [ox, oz] = f.base(t, 0.5);
        const rooted = !S.onFloor(ox, oz) && (y <= G0 + 0.35 || patch.some(([pt, py]) => Math.abs(pt - t) < w * 0.5 && py < y && y - py <= h * 0.9));
        const ok = rooted && vineOk(f, t, y, w, h, cap, doorRects, G0);
        const [x, z] = f.base(t, 0.08 + R() * 0.12, y, y + h);
        if (ok && !placed.some(q => q.green.k === 'vine' && Math.hypot(q.x - x, q.z - z) < 0.08 && Math.abs(q.y - y) < 0.08)) {
          if (put(e, 'vine', 'wall', pick.src, x, y, z, yaw, 1)) { k++; left--; got.vine = (got.vine || 0) + 1; patch.push([t, y]); }
          else miss++;
        } else miss++;
        // the next one a corpus step on: up the wall, or along it in a line
        const st = quant(R, SPACING.vine.all);
        const up = GROUPS.vine.line && R() < (cared ? 0.55 : 0.3) ? 0.15 : 0.75;
        y += st * up * 2.2; t += st * sideways * (1 - up) * 2.2 + (R() - 0.5) * 0.3;
        if (y + h > Math.min(G0 + cap, f.top(t) + 0.1)) { y = G0 + R() * 0.3; t += sideways * w * 0.4; }
      }
    }
  }

  const summary = { classes: want, placed: got, pieces: placed.length, village: +village.toFixed(2), court: court.length > 0, grows: +(plotR(b.pieces) - radius0).toFixed(2) };
  b.landscape = summary;
  if (placed.length) b.notes.push(`Greenery: ${Object.entries(got).map(([k, v]) => `${v} ${k}${v > 1 ? (k === 'bush' ? 'es' : 's') : ''}`).join(', ')}.`);
  return summary;
}

// A vine on face f at t (along the face), its foot at y: on the wall all the way (at most a quarter of it over a
// window or other opening), clear of every door and its 0.3 m each side, under the wall top and the patch's height.
function vineOk(f, t, y, w, h, cap, doorRects, G0) {
  if (t - w * 0.35 < f.t0 - 0.2 || t + w * 0.35 > f.t1 + 0.2) return false;
  if (y + h > G0 + cap + 0.3) return false;
  let on = 0, off = 0;
  for (const a of [-0.35, -0.12, 0.12, 0.35]) for (const c of [0.15, 0.45, 0.75, 0.95]) {
    const tt = t + a * w, yy = y + c * h;
    if (f.cover(tt, yy)) on++;
    else if (f.top(tt) < yy - 0.05 || !Number.isFinite(f.top(tt))) return false; // over the wall top or past its end
    else off++;
  }
  if (off > (on + off) / 4) return false;
  const [x, z] = f.base(t, 0);
  for (const { o, hw } of doorRects) {
    if (Math.abs(o.nx * f.n[0] + o.nz * f.n[1]) < 0.9) continue;
    const along = (x - o.x) * o.ux + (z - o.z) * o.uz, off2 = Math.abs((x - o.x) * o.nx + (z - o.z) * o.nz);
    if (off2 > 0.8) continue;
    if (Math.abs(along) < hw + w * 0.4 && y < o.y + o.h + 0.3) return false;
  }
  return true;
}

// Marks the greenery already in the design (the yard's beds and bushes, the window boxes) as the pass's own. A farm's
// field crops are the farmer's work (Farms.cs), so they stay unmarked.
function mark(b, ctx) {
  const own = ownerOf(ctx.type);
  for (const p of b.pieces) {
    if (p.green) continue;
    const k = classOf(p.name);
    // pots indoors are furnishing; a farm's field crops are the farmer's
    if (!k || k === 'pot' || (k === 'crop' && !p.yard)) continue;
    const near = NEAR[ctx.biome] || [ctx.biome];
    const e = (PLANTS[k] || []).find(x => x[0] === p.name);
    const src = e && e[1] && !e[1].some(bm => near.includes(bm)) ? 'standin' : 'gathered';
    p.green = { k, at: p.yard ? 'yard' : 'sill', src, use: useOf(p.name), own };
  }
}

function plotR(pieces) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of pieces) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.z < z0) z0 = p.z; if (p.z > z1) z1 = p.z; }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  let r = 0;
  for (const p of pieces) r = Math.max(r, Math.hypot(p.x - cx, p.z - cz));
  return Math.max(4, r + 2);
}
function quatL(yaw) { const a = yaw * Math.PI / 360; return [0, +Math.sin(a).toFixed(6), 0, +Math.cos(a).toFixed(6)]; }

// The pieces of one road kit set (data/landscape/road-kit.json) for a village biome, at a stage: each slot's class
// gets a plant gathered near the biome or a stand-in (D-145), a corpus scale, and the marks (owner shared: road
// greenery belongs to no building). y is the ground (0).
function kitPieces(set, biome, stage = 's3', seed = 1) {
  const R = rngL(hashL(`${set.id}|${biome}|${seed}`));
  const lvl = st => +String(st || 's1').replace(/\D/g, '');
  const out = [];
  for (const sl of set.slots) {
    if (lvl(sl.stage) > lvl(stage)) continue;
    const c = pickW(R, choices(sl.k, biome)), s = SCALE[sl.k];
    const sc = s && R() < s[0] ? Math.max(0.4, Math.min(1.7, quant(R, [s[1], Math.sqrt(s[1] * s[2]), s[2]], 1.2816, 1.6))) : 1;
    const yaw = Math.floor(R() * 16) * 22.5;
    const p = { name: c.e[0], x: sl.x, y: 0, z: sl.z, yaw, q: quatL(yaw), green: { k: sl.k, at: set.place, src: c.src, use: useOf(c.e[0]), own: 'shared' } };
    if (sc !== 1) p.s = [+sc.toFixed(3), +sc.toFixed(3), +sc.toFixed(3)];
    out.push(p);
  }
  return out;
}

/** Does this request get landscaping? req.landscape false turns it off; bare builds (skipDecor) get none. */
function wants(req) { return !(req && (req.landscape === false || req.skipDecor)); }

const apiL = { add, wants, mark, kitPieces, survey, classOf, useOf, ownerOf, choices, HOUSE, PLACES, SPACING, FROM_WALL, GROUPS, SCALE, VINE_HEIGHT, VINE_CORNER, LEAN, STAGE_W, VILLAGE_GREEN, PLANTS, NEAR, PLOT_GROW };
if (NODE_L) module.exports = apiL; else window.VHLandscape = apiL;
