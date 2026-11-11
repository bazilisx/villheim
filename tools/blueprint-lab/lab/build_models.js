// Raw measurements from the game (lab/extract_models.py on Tyler's PC) to data/piece-models.json and
// data/piece-solids.json.
//   node lab/build_models.js <piece-models-raw.json> [data/piece-models.json] [data/piece-solids.json]
// piece-models.json keeps per piece: render bounds, the box round the solid colliders, the solid colliders themselves,
// whether a player walks through the piece, its snap points, triangle count, the prefab path and the proxy parts.
// piece-solids.json is the small part the checks need (lib/shapes.js), also bundled for the game and the request page.
// Both hold measurements and our own boxes and prisms; no mesh data from the game.
const fs = require('fs'), path = require('path');
if (process.argv[2] === '--items') { buildItems(process.argv[3], process.argv[4] || path.join(__dirname, '../data/item-models.json'), process.argv[5]); process.exit(0); }
const [inp, out = path.join(__dirname, '../data/piece-models.json'), outSolids = path.join(__dirname, '../data/piece-solids.json'), coarseFile] = process.argv.slice(2);
const raw = JSON.parse(fs.readFileSync(inp, 'utf8'));
// The coarse level (the first round's proxy, 40 to 150 parts a piece) for the quick overlap pre-test (lib/mesh.js):
// the last data/piece-models.json's coarse parts, or its parts when it has none.
const coarseOf = coarseFile ? (() => { const d = JSON.parse(fs.readFileSync(coarseFile, 'utf8')).pieces; return n => d[n] && (d[n].coarse || d[n].parts); })() : () => null;

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

const pieces = {}, solidsOut = {};
let parts = 0, withSolid = 0, pass = 0, dropped = 0;
for (const [name, r] of Object.entries(raw.pieces).sort()) {
  if (r.error || !r.bounds) continue;
  const e = { bounds: r.bounds };
  // solid colliders: not triggers, on a layer the player collides with (from the game's collision matrix). One far
  // larger than the mesh (a placement or comfort volume left solid) is left out.
  const msz = r.bounds.max.map((v, i) => v - r.bounds.min[i]);
  const isSolid = c => c.solid != null ? c.solid : !c.trigger;
  const solid = (r.colliders || []).filter(c => isSolid(c) && c.max.every((v, i) => v - c.min[i] <= msz[i] + 1));
  dropped += (r.colliders || []).filter(isSolid).length - solid.length;
  if (solid.length) {
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
  if (r.parts) { e.parts = r.parts.map(sheetToBox); parts += r.parts.length; }
  const co = coarseOf(name);
  if (co && r.parts && !r.old && !r.kept) e.coarse = co;
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
    'material class (m), fitted to within 2 cm of the mesh (4 mm for the item stands; err gives the measure in mm); coarse: ' +
    'the first, coarser proxy, for the quick overlap pre-test. pass: no solid collider, a player walks through it. Built by ' +
    'lab/build_models.js.',
  version: 3,
  pieces,
};
fs.writeFileSync(out, JSON.stringify(data));
fs.writeFileSync(outSolids, JSON.stringify({
  about: 'Solid colliders of the vanilla pieces in their own frame (from data/piece-models.json, lab/build_models.js): ' +
    'oriented boxes {c, s, q}, spheres {t: sph, c, r}, capsules {t: cap, c, r, h, ax}; m: 1 marks a box standing for a mesh ' +
    'collider. pass: 1 means nothing solid (rugs, cloth, food, plants). Read by lib/shapes.js.',
  pieces: solidsOut,
}));
console.log(out, Object.keys(pieces).length, 'pieces,', parts, 'parts,', fs.statSync(out).size, 'bytes;', withSolid, 'with solid colliders,', pass, 'pass-through,', dropped, 'oversize solids left out');
console.log(outSolids, fs.statSync(outSolids).size, 'bytes');

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
    e.parts = (it.parts || []).map(round);
    parts += e.parts.length;
    items[n] = e;
  }
  const data = {
    about: 'Items as the vanilla item stands show them, measured by lab/extract_models.py (items, collect_items) and built by ' +
      'lab/build_models.js --items. b: bounds of the shown branch of the item prefab (its attach child, or attachobj) in its own ' +
      'frame, metres, from the LOD0 meshes; parts: a low-poly proxy (boxes c/s/q, prisms p/d) within tol of the mesh; at: per ' +
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
