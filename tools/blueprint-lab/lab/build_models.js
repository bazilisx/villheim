// Raw measurements from the game (lab/extract_models.py on Tyler's PC) to data/piece-models.json.
//   node lab/build_models.js <piece-models-raw.json> [data/piece-models.json]
// Keeps per piece: render bounds, solid collider bounds and boxes, triangle count, the prefab path and the proxy parts.
// The file holds measurements and our own boxes and prisms; no mesh data from the game.
const fs = require('fs'), path = require('path');
const [inp, out = path.join(__dirname, '../data/piece-models.json')] = process.argv.slice(2);
const raw = JSON.parse(fs.readFileSync(inp, 'utf8'));
// A thin curved sheet (a blanket, a hide, a cloth) fits better as a flat box than as the outline of its wavy edge.
function sheetToBox(p) {
  if (p.t !== 'prism') return p;
  const xs = p.p.map(v => v[0]), ys = p.p.map(v => v[1]);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  if (Math.min(w, h) > 0.06 || Math.max(w, h) < 0.2) return p;
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const q = p.q || [0, 0, 0, 1];
  // the outline's middle, from the part's frame to the piece's
  const [x, y, z, ww] = q, v = [cx, cy, 0];
  const ix = ww * v[0] + y * v[2] - z * v[1], iy = ww * v[1] + z * v[0] - x * v[2], iz = ww * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
  const r = [ix * ww + iw * -x + iy * -z - iz * -y, iy * ww + iw * -y + iz * -x - ix * -z, iz * ww + iw * -z + ix * -y - iy * -x];
  const out = { col: p.col, m: p.m, t: 'box', c: p.c.map((c, i) => +(c + r[i]).toFixed(3)), s: [+w.toFixed(3), +h.toFixed(3), p.d] };
  if (p.q) out.q = p.q;
  return out;
}

const pieces = {};
let parts = 0;
for (const [name, r] of Object.entries(raw.pieces).sort()) {
  if (r.error || !r.bounds) continue;
  const e = { bounds: r.bounds };
  // solid colliders; one far larger than the mesh (a placement or comfort volume left solid) is left out
  const msz = r.bounds.max.map((v, i) => v - r.bounds.min[i]);
  const solid = (r.colliders || []).filter(c => !c.trigger && c.max.every((v, i) => v - c.min[i] <= msz[i] + 1))
    .map(c => ({ type: c.type, min: c.min, max: c.max }));
  if (solid.length) {
    e.collider = { min: [0, 1, 2].map(i => Math.min(...solid.map(c => c.min[i]))), max: [0, 1, 2].map(i => Math.max(...solid.map(c => c.max[i]))) };
  }
  if (solid.length && solid.length <= 12) e.colliders = solid;
  e.tris = r.tris;
  if (r.parts) { e.parts = r.parts.map(sheetToBox); parts += r.parts.length; }
  e.prefab = r.path;
  pieces[name] = e;
}
const data = {
  about: 'Measured from the vanilla prefabs by lab/extract_models.py (render bounds of the LOD0 meshes, solid colliders, ' +
    'in the piece\'s own frame, metres) and a low-poly proxy per piece: boxes (c center, s size, q rotation) and prisms ' +
    '(p outline in the part\'s x-y plane, d depth along its z), each with a color sampled from the game texture (col) and a ' +
    'material class (m). Built by lab/build_models.js.',
  version: 1,
  pieces,
};
fs.writeFileSync(out, JSON.stringify(data));
console.log(out, Object.keys(pieces).length, 'pieces,', parts, 'parts,', fs.statSync(out).size, 'bytes');
