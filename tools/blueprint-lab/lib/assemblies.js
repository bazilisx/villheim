// Furniture assemblies (track G, showcase review 2026-11-12; docs/FURNITURE_ASSEMBLIES.md): furniture builders make
// out of building pieces, stations and decor, as recipes that can be placed at any spot and facing. Tyler,
// 2026-11-12: "research images or video stills that show how folks in the corpus or elsewhere make interior design
// elements like potion cabinets, kitchen tables, shelves, etc."
//
// Recipes: data/assemblies/corpus.json (mined, lab/mine_assemblies.js and lab/select_assemblies.js) and
// data/assemblies/authored.json (written from Tyler's album, his collage and builders' pictures). A recipe's frame: x
// along the wall it backs onto, z into the room from the wall face, y over the floor; each piece's yaw is against the
// frame (lab convention, lib/pieces.js: local x -> (cos a, -sin a), local z -> (sin a, cos a)).
//
//   const AS = require('./lib/assemblies.js');
//   AS.find({ kind: 'potion-shelf', room: 'study', family: 'darkwood', maxW: 2.2, maxD: 0.8 })  // recipes, best first
//   AS.place('AA-potion-cabinet-01', { x, y, z, facing }, { family: 'darkwood' })
//     // -> { id, kind, pieces: [{ name, x, y, z, yaw, q, info, want, asm }], box, front, stands }
//   AS.choose(ledger, query)  // a recipe the building has not used yet, within the per-building caps
//
// facing: the yaw that turns the recipe's +z (out of the wall, into the room) to the world direction, the same yaw
// lib/catalog.js yawFacing gives for (dx, dz). Nothing here checks the room; the caller fits the box (box, front) into
// its plan and keeps walking lines clear.

const NODE_AS = typeof module !== 'undefined' && typeof require === 'function';
let REC;
function data() {
  if (REC) return REC;
  REC = [];
  if (typeof window !== 'undefined' && window.VHAssembliesData) REC = window.VHAssembliesData;
  else if (NODE_AS) {
    const fs = require('fs'), path = require('path'), dir = path.join(__dirname, '../data/assemblies');
    for (const f of ['authored.json', 'corpus.json']) { const p = path.join(dir, f); if (fs.existsSync(p)) REC.push(...JSON.parse(fs.readFileSync(p, 'utf8')).recipes); }
  }
  return REC;
}
function setData(list) { REC = list; }
const SHa = () => (NODE_AS ? require('./shapes.js') : window.VHShapes);

function all() { return data(); }
function get(id) { return typeof id === 'object' ? id : data().find(r => r.id === id) || null; }

// ---------------------------------------------------------------- material families of the built parts
// Pieces of one shape in each family, so a recipe takes the building's own wood or stone. A swap keeps the piece's
// box centre (pivots differ: darkwood_beam has its pivot at the bottom, wood_beam in the middle).
const SWAP = {
  beam2: { plank: 'wood_beam', darkwood: 'darkwood_beam', woodiron: 'woodiron_beam', ashwood: 'ashwood_beam_2m', timber: 'stave_beam_2m' },
  beam1: { plank: 'wood_beam_1', ashwood: 'ashwood_beam_1m' },
  pole2: { plank: 'wood_pole2', darkwood: 'darkwood_pole', woodiron: 'woodiron_pole', ashwood: 'ashwood_pole_2m', log: 'wood_pole_log', timber: 'stave_pole_2m' },
  pole1: { plank: 'wood_pole', ashwood: 'ashwood_pole_1m' },
  half: { plank: 'wood_wall_half', ashwood: 'ashwood_halfwall_1x2', scalewood: 'scale_halfwall_1x2' },
  quarter: { plank: 'wood_wall_quarter', ashwood: 'ashwood_quarterwall_1x1', scalewood: 'scale_quarterwall_1x1' },
  block2: { stone: 'stone_wall_2x1', marble: 'blackmarble_2x1x1' },
  block1: { stone: 'stone_wall_1x1', marble: 'blackmarble_1x1' },
  top1: { plank: 'wood_floor_1x1', ashwood: 'ashwood_floor_1x1', grausten: 'Piece_grausten_floor_1x1' },
};
const SHAPE_OF = {};
for (const [shape, m] of Object.entries(SWAP)) for (const [fam, n] of Object.entries(m)) SHAPE_OF[n] = [shape, fam];
// the catalog's look families to the swap families
const FAM_ALIAS = { plank: 'plank', rustic_furniture: 'plank', log: 'log', round_log: 'log', darkwood: 'darkwood', woodiron: 'woodiron', 'wood and iron': 'woodiron', ashwood: 'ashwood', timber: 'timber', scalewood: 'scalewood', stone: 'stone', cut_stone: 'stone', grausten: 'grausten', marble: 'marble', black_marble: 'marble' };
const famKey = f => FAM_ALIAS[f] || f;

const boxCache = new Map();
function localBox(name) {
  if (boxCache.has(name)) return boxCache.get(name);
  let b = null;
  try {
    const w = SHa().world({ name, x: 0, y: 0, z: 0, yaw: 0, q: [0, 0, 0, 1] });
    if (w && w.length) b = { x0: Math.min(...w.map(o => o.x0)), x1: Math.max(...w.map(o => o.x1)), y0: Math.min(...w.map(o => o.y0)), y1: Math.max(...w.map(o => o.y1)), z0: Math.min(...w.map(o => o.z0)), z1: Math.max(...w.map(o => o.z1)) };
  } catch (e) { b = null; }
  boxCache.set(name, b);
  return b;
}
/** The prefab of the same shape in another family, or the same prefab when there is none. */
function swapName(name, family) {
  const s = SHAPE_OF[name];
  if (!s || !family) return name;
  return SWAP[s[0]][famKey(family)] || name;
}

// ---------------------------------------------------------------- finding recipes
/**
 * Recipes for a query, best first. q: { kind or kinds, room, culture, family (the room's wood or stone), maxW (along
 * the wall), maxD (into the room), maxH, wall ('back', 'corner', 'none'), from ('corpus', 'album', ...), noHidden,
 * exclude (ids or a Set) }.
 */
function find(q) {
  q = q || {};
  const kinds = q.kinds || (q.kind ? [q.kind] : null), ex = q.exclude instanceof Set ? q.exclude : new Set(q.exclude || []);
  const out = [];
  for (const r of data()) {
    if (kinds && !kinds.includes(r.kind)) continue;
    if (ex.has(r.id)) continue;
    if (q.room && r.rooms && !r.rooms.includes(q.room)) continue;
    if (q.wall && r.wall !== q.wall && !(q.wall === 'corner' && r.wall === 'back')) continue;
    if (q.from && r.from !== q.from) continue;
    if (q.noHidden && r.hidden && r.hidden.length) continue;
    const w = r.foot.x[1] - r.foot.x[0], d = r.foot.z[1] - Math.max(0, r.foot.z[0]);
    if (q.maxW && w > q.maxW + 0.05) continue;
    if (q.maxD && d > q.maxD + 0.05) continue;
    if (q.maxH && r.foot.h > q.maxH + 0.05) continue;
    if (q.culture && r.cultures && !r.cultures.includes('any') && !r.cultures.includes(q.culture) && !(r.cultures.includes('stone') && STONE_CULTURES.has(q.culture))) continue;
    // score: corpus support, a family the room already has, authored recipes from Tyler's own pictures first
    let s = Math.log(1 + (r.builds || 1)) + (r.from === 'album' || r.from === 'collage' ? 1.5 : 0) + Math.log(1 + ((r.src && r.src.votes) || 0)) * 0.3;
    if (q.family && r.families && r.families.map(famKey).includes(famKey(q.family))) s += 1;
    out.push([s, r]);
  }
  return out.sort((a, b) => b[0] - a[0]).map(x => x[1]);
}
const STONE_CULTURES = new Set(['byzantine', 'middle-eastern', 'lamari', 'castle-medieval', 'dwarven', 'celtic', 'saami', 'norse-highland']);

// ---------------------------------------------------------------- placing a recipe
function qmul(a, b) { return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]; }
const qyaw = y => { const a = y * Math.PI / 360; return [0, Math.sin(a), 0, Math.cos(a)]; };
const norm = a => ((a % 360) + 360) % 360;

/**
 * Places a recipe. spot: { x, y (the floor's top), z, facing }. o: { family (swap the built parts to the room's wood or
 * stone), mirror (flip along the wall), keep (piece names to leave as they are) }.
 * Returns { id, kind, pieces, box: { x0, x1, z0, z1, y0, y1 } (world, from the recipe's footprint), corners (the four
 * floor corners of the footprint), front: { x, z } (where a person stands to use it: the middle of the footprint's
 * front edge, 0.6 m out), stands: [{ i, stand, want, place }] (the item stands in pieces, with what they should hold) }.
 * Every piece carries asm: '<id>' so a design can tell its assemblies apart (lib/blueprint.js keeps unknown fields
 * out of the file).
 */
function place(recipe, spot, o) {
  const r = get(recipe);
  if (!r) return null;
  o = o || {};
  const F = spot.facing || 0, a = F * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const toW = (lx, lz) => [spot.x + lx * c + lz * s, spot.z - lx * s + lz * c];
  const m = o.mirror ? -1 : 1;
  const pieces = [];
  const stands = [];
  for (const p of r.pieces) {
    // mirrored: x -> -x; a piece keeps its front, so its yaw a becomes -a
    let name = p.n, lx = p.x * m, ly = p.y, lz = p.z, yaw = o.mirror ? norm(-p.yaw) : p.yaw;
    const sw = o.family && !(o.keep || []).includes(name) ? swapName(name, o.family) : name;
    if (sw !== name) {
      // keep the box centre: move by the difference of the two pivots' box centres, turned with the piece
      const A = localBox(name), B = localBox(sw);
      if (A && B) {
        const dx = (A.x0 + A.x1) / 2 - (B.x0 + B.x1) / 2, dy = (A.y0 + A.y1) / 2 - (B.y0 + B.y1) / 2, dz = (A.z0 + A.z1) / 2 - (B.z0 + B.z1) / 2;
        const ya = yaw * Math.PI / 180;
        lx += dx * Math.cos(ya) + dz * Math.sin(ya); lz += -dx * Math.sin(ya) + dz * Math.cos(ya); ly += dy;
      }
      name = sw;
    }
    const [wx, wz] = toW(lx, lz);
    const wyaw = norm(F + yaw);
    const q = p.q ? qmul(qyaw(F), o.mirror ? [-p.q[0], p.q[1], p.q[2], -p.q[3]] : p.q).map(v => +v.toFixed(6)) : qyaw(wyaw).map(v => +v.toFixed(6));
    const out = { name, x: +wx.toFixed(3), y: +(spot.y + ly).toFixed(3), z: +wz.toFixed(3), yaw: wyaw, q, asm: r.id };
    if (p.info && /^sign/.test(name)) out.info = p.info;
    if (p.want) out.want = p.want;
    if (/^itemstand|^ArmorStand/.test(name)) stands.push({ i: pieces.length, stand: name, want: p.want || null, place: p.place || null, item: p.info ? p.info.split(':')[0] : null });
    if (p.hidden) out.hidden = true;
    pieces.push(out);
  }
  const fx = r.foot.x, fz = r.foot.z;
  const xs = o.mirror ? [-fx[1], -fx[0]] : fx;
  const corners = [[xs[0], fz[0]], [xs[1], fz[0]], [xs[1], fz[1]], [xs[0], fz[1]]].map(([u, v]) => toW(u, v)).map(([x, z]) => ({ x: +x.toFixed(3), z: +z.toFixed(3) }));
  const box = { x0: Math.min(...corners.map(p => p.x)), x1: Math.max(...corners.map(p => p.x)), z0: Math.min(...corners.map(p => p.z)), z1: Math.max(...corners.map(p => p.z)), y0: spot.y, y1: spot.y + r.foot.h };
  const [fxw, fzw] = toW((xs[0] + xs[1]) / 2, fz[1] + 0.6);
  return { id: r.id, kind: r.kind, pieces, box, corners, front: { x: +fxw.toFixed(3), z: +fzw.toFixed(3) }, stands, hidden: r.hidden || [] };
}

// ---------------------------------------------------------------- choosing per building
/**
 * A recipe the building has not used, within its caps. L: a ledger ({ used: {} }, or lib/standitems.js ledger; the
 * field is added). q: as find(), plus seed or rng. Caps: a recipe once per building; one kind at most twice in a home,
 * four times in a hall, tavern or storehouse (one shelving unit or kitchen stove is the corpus norm per room; Tyler:
 * "Noone needs that many chests").
 */
function choose(L, q) {
  L.asmUsed = L.asmUsed || {};
  L.asmKinds = L.asmKinds || {};
  const large = L.large || /hall|tavern|hub|storage|longhouse/.test(L.kind || '');
  const cap = large ? 4 : 2;
  const list = find(Object.assign({}, q, { exclude: new Set([...(q.exclude || []), ...Object.keys(L.asmUsed)]) })).filter(r => (L.asmKinds[r.kind] || 0) < cap);
  if (!list.length) return null;
  const R = q.rng || L.R || Math.random;
  // the best few, weighted by rank, so buildings differ
  const top = list.slice(0, 6);
  const w = top.map((_, i) => 1 / (1 + i));
  let t = w.reduce((x, y) => x + y, 0) * R(), k = 0;
  while (k < top.length - 1 && (t -= w[k]) > 0) k++;
  const r = top[k];
  L.asmUsed[r.id] = 1;
  L.asmKinds[r.kind] = (L.asmKinds[r.kind] || 0) + 1;
  return r;
}

const kinds = () => [...new Set(data().map(r => r.kind))].sort();

const apiAS = { data, setData, all, get, find, place, choose, swapName, kinds, SWAP };
if (typeof module !== 'undefined') module.exports = apiAS;
else window.VHAssemblies = apiAS;
