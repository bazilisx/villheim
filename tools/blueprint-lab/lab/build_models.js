// Raw measurements from the game (lab/extract_models.py on Tyler's PC) to data/piece-models.json and
// data/piece-solids.json.
//   node lab/build_models.js <piece-models-raw.json> [data/piece-models.json] [data/piece-solids.json] [coarse.json]
// The fine parts go to piece-fine.json beside piece-models.json; coarse.json is an earlier piece-models.json whose
// parts make the coarse level.
// piece-models.json keeps per piece: render bounds, the box round the solid colliders, the solid colliders themselves,
// whether a player walks through the piece, its snap points, triangle count, the prefab path and the proxy parts.
// piece-solids.json is the small part the checks need (lib/shapes.js), also bundled for the game and the request page.
// Both hold measurements and our own boxes and prisms; no mesh data from the game.
const fs = require('fs'), path = require('path');
const Mesh = require('../lib/mesh.js'), Pieces = require('../lib/pieces.js');
// A thin curved sheet (a blanket, a hide, a cloth) fits better as a flat box than as the outline of its wavy edge.
function sheetToBox(p) {
  if (p.t !== 'prism') return p;
  const xs = p.p.map(v => v[0]), ys = p.p.map(v => v[1]);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  if (Math.min(w, h) > 0.06 || Math.max(w, h) < 0.2) return p;
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const r = rot(p.q || [0, 0, 0, 1], [cx, cy, 0]);
  const o = { col: p.col, m: p.m, t: 'box', c: p.c.map((c, i) => +(c + r[i]).toFixed(3)), s: [+w.toFixed(3), +h.toFixed(3), p.d] };
  if (p.q) o.q = p.q;
  return o;
}
function rot(q, v) {
  const [x, y, z, w] = q;
  const ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
}

// One collider as the shapes the checks use: oriented boxes {c, s, q}, spheres {t: 'sph', c, r} and capsules
// {t: 'cap', c, r, h, ax}; a mesh collider is its box or few boxes.
function shapesOf(c) {
  if (c.type === 'box') return [c.q ? { c: c.c, s: c.s, q: c.q } : { c: c.c, s: c.s }];
  if (c.type === 'sphere') return [{ t: 'sph', c: c.c, r: c.r }];
  if (c.type === 'capsule') return [{ t: 'cap', c: c.c, r: c.r, h: c.h, ax: c.ax }];
  if (c.type === 'mesh') return (c.boxes || []).map(b => ({ ...b, m: 1 }));
  return [];
}

// ---------------------------------------------------------------- packed parts
// The parts are stored packed (lib/mesh.js unpack reads them): grouped by color, material and rotation, as
// [col, m, q, boxes, prisms]; q the group's rotation [x, y, z, w] or 0; boxes a flat list of whole millimeters
// [x0, y0, z0, sx, sy, sz, ...], the low corner and size in the group's own frame; prisms [[cx, cy, cz, d, u, v, u, v,
// ...], ...] in millimeters, c in the piece's frame. Before packing, the boxes of a group are merged without changing
// what they cover (to SLACK mm): a box inside another or covered by the others goes, and two boxes that line up on two
// axes and touch or overlap on the third become one.
const SLACK = 1;
function qn(q) { const l = Math.hypot(...q) || 1; return q.map(v => v / l); }
function rotInv(q, v) { return rot([-q[0], -q[1], -q[2], q[3]], v); }
function pack(parts) {
  const groups = new Map();
  for (const pt of parts) {
    const q = pt.q ? pt.q.map(v => Math.round(v * 10000) / 10000) : 0;
    const key = [pt.col, pt.m, q ? q.join(',') : 0].join('|');
    let g = groups.get(key);
    if (!g) groups.set(key, g = { col: pt.col, m: pt.m, q, boxes: [], prisms: [] });
    if (pt.t === 'box') {
      const l = rotInv(q ? qn(q) : [0, 0, 0, 1], pt.c);
      const lo = l.map((v, i) => Math.round((v - pt.s[i] / 2) * 1000)), hi = l.map((v, i) => Math.round((v + pt.s[i] / 2) * 1000));
      g.boxes.push({ lo, hi });
    } else {
      const mm = v => Math.round(v * 1000);
      g.prisms.push([...pt.c.map(mm), mm(pt.d), ...[].concat(...pt.p.map(u => u.map(mm)))]);
    }
  }
  const out = [];
  for (const g of groups.values()) {
    const B = mergeBoxes(g.boxes);
    const flat = [];
    for (const b of B) flat.push(...b.lo, ...b.hi.map((v, i) => Math.max(1, v - b.lo[i])));
    out.push([g.col, g.m, g.q, Mesh.encBoxes(flat), g.prisms]);
  }
  return out;
}
const vol = b => (b.hi[0] - b.lo[0]) * (b.hi[1] - b.lo[1]) * (b.hi[2] - b.lo[2]);
const inside = (a, b, s) => [0, 1, 2].every(i => b.lo[i] >= a.lo[i] - s && b.hi[i] <= a.hi[i] + s);
function lineUp(a, b, s) {
  // the one axis on which they may differ, or -1
  let k = -1;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(a.lo[i] - b.lo[i]) <= s && Math.abs(a.hi[i] - b.hi[i]) <= s) continue;
    if (k >= 0) return -1;
    k = i;
  }
  if (k < 0) return 0;
  return a.lo[k] <= b.hi[k] + s && b.lo[k] <= a.hi[k] + s ? k : -1;
}
function mergeBoxes(list, s = SLACK) {
  let B = list.slice().sort((a, b) => vol(b) - vol(a));
  // inside another
  const kept = [];
  for (const b of B) if (!kept.some(a => inside(a, b, s))) kept.push(b);
  B = kept;
  // lined up and touching
  for (let again = true; again;) {
    again = false;
    for (let i = 0; i < B.length; i++) {
      for (let j = i + 1; j < B.length; j++) {
        if (lineUp(B[i], B[j], s) < 0) continue;
        B[i] = { lo: B[i].lo.map((v, k) => Math.min(v, B[j].lo[k])), hi: B[i].hi.map((v, k) => Math.max(v, B[j].hi[k])) };
        B.splice(j, 1); j--; again = true;
      }
    }
  }
  // covered by the others: each cell of the box cut by the others' faces lies in one of them
  B.sort((a, b) => vol(a) - vol(b));
  const alive = B.map(() => true);
  for (let i = 0; i < B.length; i++) {
    const b = B[i];
    const O = B.filter((o, j) => j !== i && alive[j] && [0, 1, 2].every(k => o.lo[k] < b.hi[k] && o.hi[k] > b.lo[k]));
    if (!O.length) continue;
    const cuts = [0, 1, 2].map(k => [...new Set([b.lo[k], b.hi[k], ...O.flatMap(o => [o.lo[k], o.hi[k]]).filter(v => v > b.lo[k] && v < b.hi[k])])].sort((x, y) => x - y));
    if ((cuts[0].length - 1) * (cuts[1].length - 1) * (cuts[2].length - 1) * O.length > 3e5) continue;
    let all = true;
    for (let x = 0; all && x < cuts[0].length - 1; x++) {
      const cx = (cuts[0][x] + cuts[0][x + 1]) / 2;
      for (let y = 0; all && y < cuts[1].length - 1; y++) {
        const cy = (cuts[1][y] + cuts[1][y + 1]) / 2;
        for (let z = 0; all && z < cuts[2].length - 1; z++) {
          const cz = (cuts[2][z] + cuts[2][z + 1]) / 2;
          if (!O.some(o => cx >= o.lo[0] - s && cx <= o.hi[0] + s && cy >= o.lo[1] - s && cy <= o.hi[1] + s && cz >= o.lo[2] - s && cz <= o.hi[2] + s)) all = false;
        }
      }
    }
    if (all) alive[i] = false;
  }
  return B.filter((b, i) => alive[i]);
}

function buildPieces() {
// VH_SOLIDS_FROM=<piece-solids.json> [VH_MODELS_FROM=<piece-models.json>]: keep the solid colliders (and the collider
// box) of an earlier build, for a refit that should change what shows and nothing that is solid
const KEEP = process.env.VH_SOLIDS_FROM ? JSON.parse(fs.readFileSync(process.env.VH_SOLIDS_FROM, 'utf8')).pieces : {};
const keepCollider = {};
if (process.env.VH_MODELS_FROM) for (const [n, v] of Object.entries(JSON.parse(fs.readFileSync(process.env.VH_MODELS_FROM, 'utf8')).pieces)) keepCollider[n] = v.collider;
const [inp, out = path.join(__dirname, '../data/piece-models.json'), outSolids = path.join(__dirname, '../data/piece-solids.json'), coarseFile] = process.argv.slice(2);
const outFine = path.join(path.dirname(out), 'piece-fine.json');
const raw = JSON.parse(fs.readFileSync(inp, 'utf8'));
// The coarse level (the first round's proxy, 40 to 150 parts a piece) for the quick overlap pre-test (lib/mesh.js):
// the coarse parts of an earlier data/piece-models.json (k, packed, version 4; coarse or parts before that).
const coarseOf = coarseFile ? (() => {
  const d = JSON.parse(fs.readFileSync(coarseFile, 'utf8')).pieces;
  return n => d[n] && (d[n].k ? Mesh.unpack(d[n].k) : d[n].coarse || d[n].parts);
})() : () => null;

const pieces = {}, solidsOut = {}, fine = {};
let parts = 0, boxesIn = 0, boxesOut = 0, withSolid = 0, pass = 0, dropped = 0;
const count = pk => pk.reduce((n, g) => n + Mesh.decBoxes(g[3]).length / 6 + g[4].length, 0);
for (const [name, r] of Object.entries(raw.pieces).sort()) {
  if (r.error || !r.bounds) continue;
  const e = { bounds: r.bounds };
  // solid colliders: not triggers, on a layer the player collides with (from the game's collision matrix). One far
  // larger than the mesh (a placement or comfort volume left solid) is left out.
  const msz = r.bounds.max.map((v, i) => v - r.bounds.min[i]);
  const isSolid = c => c.solid != null ? c.solid : !c.trigger;
  const solid = (r.colliders || []).filter(c => isSolid(c) && c.max.every((v, i) => v - c.min[i] <= msz[i] + 1));
  dropped += (r.colliders || []).filter(isSolid).length - solid.length;
  if (KEEP[name]) {
    // VH_SOLIDS_FROM: the solids of an earlier data/piece-solids.json stay as they were
    const k = KEEP[name];
    if (k.s) { e.collider = keepCollider[name] || null; e.solids = k.s; withSolid++; } else { e.pass = true; pass++; }
    if (!e.collider) delete e.collider;
  } else if (solid.length) {
    e.collider = { min: [0, 1, 2].map(i => Math.min(...solid.map(c => c.min[i]))), max: [0, 1, 2].map(i => Math.max(...solid.map(c => c.max[i]))) };
    e.solids = solid.flatMap(shapesOf);
    // broken rocks and cliffs come as hundreds of fragments; their box is enough
    if (e.solids.length > 24) {
      const lo = e.collider.min, hi = e.collider.max;
      e.solids = [{ c: lo.map((v, i) => +((v + hi[i]) / 2).toFixed(3)), s: lo.map((v, i) => +(hi[i] - v).toFixed(3)), m: 1 }];
    }
    withSolid++;
  } else {
    e.pass = true;
    pass++;
  }
  if (r.snaps && r.snaps.length) e.snap = r.snaps;
  e.tris = r.tris;
  e.kind = Pieces.piece(name).role;
  if (r.parts) {
    // k: the coarse parts (or the only ones, for a piece not refitted or whose first proxy was close enough); the
    // fine parts go to data/piece-fine.json
    const ps = r.parts.map(sheetToBox);
    parts += ps.length;
    const co = coarseOf(name);
    if (co && !r.old && !r.kept) {
      e.k = pack(co);
      fine[name] = pack(ps);
      e.fine = 1;
      boxesIn += ps.length; boxesOut += count(fine[name]);
    } else {
      e.k = pack(ps);
      boxesIn += ps.length; boxesOut += count(e.k);
    }
  }
  // how close the parts are to the game's mesh (lab/extract_models.py fit_score, mm): miss, over (99th percentile),
  // box (the parts' bounds against the mesh's); 'old' marks a piece not refitted yet
  if (r.fit) e.err = { miss: r.fit.miss, over: r.fit.over, box: r.fit.box };
  if (r.old) e.old = 1;
  e.prefab = r.path;
  pieces[name] = e;
  solidsOut[name] = e.solids ? { s: e.solids } : { pass: 1 };
}
const data = {
  about: 'Measured from the vanilla prefabs by lab/extract_models.py (render bounds of the LOD0 meshes; the solid colliders, ' +
    'meaning not triggers and on a layer the player collides with, as oriented boxes c/s/q, spheres and capsules; snap points; ' +
    'all in the piece\'s own frame, metres) and a low-poly proxy per piece: boxes (c center, s size, q rotation) and prisms ' +
    '(p outline in the part\'s x-y plane, d depth along its z), each with a color sampled from the game texture (col) and a ' +
    'material class (m), packed (lib/mesh.js unpack: grouped by color, material and rotation, whole millimeters); k: the ' +
    'coarse proxy, for the quick overlap pre-test, or the only one; fine: 1 when data/piece-fine.json has its parts fitted ' +
    'to within 2 cm of the mesh (4 mm for the item stands; err gives the measure in mm). kind: lib/pieces.js role. pass: ' +
    'no solid collider, a player walks through it. Built by lab/build_models.js.',
  version: 4,
  pieces,
};
fs.writeFileSync(out, JSON.stringify(data));
fs.writeFileSync(outFine, JSON.stringify({
  about: 'The fine proxy parts of the vanilla pieces (within 2 cm of the game\'s mesh, 4 mm for the item stands), packed as in ' +
    'data/piece-models.json (lib/mesh.js unpack). Our own boxes and prisms, no mesh data from the game. Built by lab/build_models.js.',
  version: 4,
  pieces: fine,
}));
console.log(outFine, Object.keys(fine).length, 'pieces,', fs.statSync(outFine).size, 'bytes;', boxesIn, 'parts packed as', boxesOut);
fs.writeFileSync(outSolids, JSON.stringify({
  about: 'Solid colliders of the vanilla pieces in their own frame (from data/piece-models.json, lab/build_models.js): ' +
    'oriented boxes {c, s, q}, spheres {t: sph, c, r}, capsules {t: cap, c, r, h, ax}; m: 1 marks a box standing for a mesh ' +
    'collider. pass: 1 means nothing solid (rugs, cloth, food, plants). Read by lib/shapes.js.',
  pieces: solidsOut,
}));
console.log(out, Object.keys(pieces).length, 'pieces,', parts, 'parts,', fs.statSync(out).size, 'bytes;', withSolid, 'with solid colliders,', pass, 'pass-through,', dropped, 'oversize solids left out');
console.log(outSolids, fs.statSync(outSolids).size, 'bytes');

}

// Items as an item stand shows them (lab/extract_models.py items, collect_items) to data/item-models.json:
//   node lab/build_models.js --items <items-raw.json> [data/item-models.json] [item-gaps.json]
// Per item: b, the bounds of the shown branch (the game's LOD0 meshes, exact) in its own frame; parts, the proxy
// (boxes and prisms as in piece-models.json, to the tolerance tol); at, for each item stand, where the branch sits
// in the stand's frame (c position, q rotation, s scale, as ItemStand.SetVisualItem sets it at quality 1, first
// orientation); fits, whether the game lets that stand hold it (ItemStand.CanAttach: an 'attach' child, not on the
// stand's unsupported list, and on its supported list or of a supported item type). 'none' lists the stand items the
// game gives no model for.
function buildItems(inp, out, gapsFile) {
  const raw = JSON.parse(fs.readFileSync(inp, 'utf8'));
  const r3 = v => Math.round(v * 1000) / 1000;
  const round = pt => {
    const o = { col: pt.col, m: pt.m, t: pt.t, c: pt.c.map(r3) };
    if (pt.t === 'box') o.s = pt.s.map(r3); else { o.p = pt.p.map(v => v.map(r3)); o.d = r3(pt.d); }
    if (pt.q) o.q = pt.q.map(v => Math.round(v * 10000) / 10000);
    return o;
  };
  const gaps = gapsFile ? JSON.parse(fs.readFileSync(gapsFile, 'utf8')).gaps : {};
  const items = {};
  let parts = 0;
  for (const [n, it] of Object.entries(raw.items).sort()) {
    const fits = {};
    for (const [sn, st] of Object.entries(raw.stands)) {
      const un = (st.unsupported || []).includes(n);
      const sup = !(st.supported || []).length || st.supported.includes(n) || (st.types || []).includes(it.type);
      fits[sn] = !!it.at && !un && sup;
    }
    const e = { type: it.type, b: it.bounds, tris: it.tris, tol: it.tol, err: it.fit ? { miss: it.fit.miss, over: it.fit.over, box: it.fit.box } : null, at: it.at, fits };
    if (gaps[n]) e.gap = gaps[n];
    const ps = (it.parts || []).map(round);
    parts += ps.length;
    e.k = pack(ps);
    items[n] = e;
  }
  const data = {
    about: 'Items as the vanilla item stands show them, measured by lab/extract_models.py (items, collect_items) and built by ' +
      'lab/build_models.js --items. b: bounds of the shown branch of the item prefab (its attach child, or attachobj) in its own ' +
      'frame, metres, from the LOD0 meshes; k: a low-poly proxy (boxes and prisms, packed as in piece-models.json, lib/mesh.js ' +
      'unpack) within tol of the mesh; at: per ' +
      'stand, the branch\'s position c, rotation q and scale s in the stand piece\'s frame (ItemStand.SetVisualItem, quality 1, ' +
      'first orientation); fits: whether ItemStand.CanAttach takes it on that stand; gap: the mesh\'s and the proxy\'s lowest ' +
      'point against the flat stand\'s top (itemstandh) and their back against the wall stand\'s face (itemstand), mm. ' +
      'No mesh data from the game.',
    stands: raw.stands,
    items,
    none: raw.none,
  };
  fs.writeFileSync(out, JSON.stringify(data));
  console.log(out, Object.keys(items).length, 'items,', parts, 'parts,', fs.statSync(out).size, 'bytes;', Object.keys(raw.none || {}).length, 'without a model');
}

if (process.argv[2] === '--items') buildItems(process.argv[3], process.argv[4] || path.join(__dirname, '../data/item-models.json'), process.argv[5]);
else buildPieces();
