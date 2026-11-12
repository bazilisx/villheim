// What a placed piece looks like, as oriented boxes in world space: the proxy parts of data/piece-models.json (boxes
// and prisms fitted to the game's meshes). lib/shapes.js gives what is solid (the colliders); this gives what shows.
// The two differ where a model stands proud of its collider (the 2x2 wood wall's cross bars stand 13 cm out on one
// face; a bed's blanket hangs past its frame), and that is where things hung or pushed against a piece clip visibly.
// Same box form as lib/shapes.js ({c, a, h} plus x0..z1), so shapes.hit and shapes' penetration math apply.
// Two levels: k, the coarse parts (the first round's proxy, 40 to 150 parts a piece) in data/piece-models.json, for
// the quick pre-test; the fine parts (to 2 cm of the game's mesh) in data/piece-fine.json, read the first time two
// coarse lists meet. Both are packed (unpack below).
// Works in Node (reads the two files) and in the game's bundle and the lab page: window.VH_MESH (made by lite()
// below; the parts only for pieces whose model stands proud of its collider by 1.5 cm or more, and the prefab folder
// of each) and window.VH_MESH_FINE (the fine parts per piece kind, as JSON text, read the first time a piece of that
// kind needs them).
const NODE_M = typeof module !== 'undefined';
const shapesM = () => (NODE_M ? require('./shapes.js') : window.VHShapes);
let LITE = null, FINE = null;
function data() {
  if (LITE) return LITE;
  if (!NODE_M && window.VH_MESH) LITE = window.VH_MESH;
  else LITE = lite(require('../data/piece-models.json'), { draw: true });
  return LITE;
}
/** The packed fine parts of one piece, or null. */
function fineOf(name) {
  const m = data()[name];
  if (!m || !m.f) return null;
  if (!FINE) FINE = {};
  if (NODE_M && !(typeof window !== 'undefined' && window.VH_MESH_FINE)) {
    if (!FINE._all) FINE._all = require('../data/piece-fine.json').pieces;
    return FINE._all[name] || null;
  }
  const kd = m.kd || 'misc';
  if (!FINE[kd]) { const t = window.VH_MESH_FINE && window.VH_MESH_FINE[kd]; FINE[kd] = t ? JSON.parse(t) : {}; }
  return FINE[kd][name] || null;
}
const r3 = v => Math.round(v * 1000) / 1000;
/** The compact form: { name: { src, kd, b, c, k, p, f } }: kd the piece's kind (lib/pieces.js role); b and c its
 * sizes; k its packed coarse parts; p 1 when what shows is tested (its model stands proud of its collider); f 1 when it
 * has fine parts. opts.draw keeps k for every piece (the lab page draws them all). */
function lite(models, opts = {}) {
  const out = {};
  for (const [n, v] of Object.entries(models.pieces || models)) {
    const src = v.prefab ? v.prefab.split('/')[2] : null;
    const e = { src };
    if (v.kind) e.kd = v.kind;
    // its sizes in its own frame: what shows (bounds) and what is solid (collider), as [sx, sy, sz, cx, cy, cz]
    const box = q => q && q.min && q.max ? [0, 1, 2].map(i => r3(q.max[i] - q.min[i])).concat([0, 1, 2].map(i => r3((q.max[i] + q.min[i]) / 2))) : null;
    if (v.bounds) e.b = box(v.bounds);
    if (v.collider) e.c = box(v.collider);
    const b = v.bounds, c = v.collider;
    const proud = !c || !b ? 1 : Math.max(...[0, 1, 2].map(i => Math.max(c.min[i] - b.min[i], b.max[i] - c.max[i])));
    const test = v.k && proud >= 0.015 && /Pieces|Items/.test(v.prefab || '');
    if (v.k && (test || opts.draw)) e.k = v.k;
    if (test) e.p = 1;
    if (v.fine && (test || opts.draw)) e.f = 1;
    out[n] = e;
  }
  return out;
}

// ---------------------------------------------------------------- packed parts (lab/build_models.js pack)
// [[col, m, q, boxes, prisms], ...]: one group per color, material and rotation q ([x, y, z, w], or 0); boxes as text,
// six whole millimeters a box (the low corner in the group's frame, as the change from the last box's, then the size),
// each number in base 45 written with 90 characters (the upper 45 for the leading digits); prisms
// [[cx, cy, cz, d, u, v, u, v, ...], ...] in millimeters, c in the piece's frame.
const ALPHA = []; for (let ch = 35; ch < 127 && ALPHA.length < 90; ch++) if (ch !== 92) ALPHA.push(String.fromCharCode(ch));
const DIG = {}; ALPHA.forEach((ch, i) => { DIG[ch] = i; });
function encBoxes(flat) {
  const out = [], p = [0, 0, 0];
  const put = v => { const d = []; do { d.push(v % 45); v = Math.floor(v / 45); } while (v > 0); for (let i = d.length - 1; i > 0; i--) out.push(ALPHA[45 + d[i]]); out.push(ALPHA[d[0]]); };
  for (let i = 0; i < flat.length; i += 6) {
    for (let k = 0; k < 3; k++) { const dv = flat[i + k] - p[k]; put(dv >= 0 ? 2 * dv : -2 * dv - 1); p[k] = flat[i + k]; }
    for (let k = 3; k < 6; k++) put(flat[i + k]);
  }
  return out.join('');
}
function decBoxes(s) {
  const v = [];
  let x = 0;
  for (let i = 0; i < s.length; i++) { const d = DIG[s[i]]; if (d >= 45) x = x * 45 + d - 45; else { v.push(x * 45 + d); x = 0; } }
  const out = [], p = [0, 0, 0];
  for (let i = 0; i + 5 < v.length; i += 6) {
    for (let k = 0; k < 3; k++) { const z = v[i + k]; p[k] += z & 1 ? -(z + 1) / 2 : z / 2; out.push(p[k]); }
    out.push(v[i + 3], v[i + 4], v[i + 5]);
  }
  return out;
}
/** Packed parts as part objects {t, c, s | p, d, q, col, m}, metres. */
function unpack(pk) {
  const out = [];
  for (const [col, m, q0, boxes, prisms] of pk || []) {
    const q = q0 || null, qq = q || [0, 0, 0, 1];
    const fl = typeof boxes === 'string' ? decBoxes(boxes) : boxes || [];
    for (let i = 0; i + 5 < fl.length; i += 6) {
      const s = [fl[i + 3] / 1000, fl[i + 4] / 1000, fl[i + 5] / 1000];
      const l = [fl[i] / 1000 + s[0] / 2, fl[i + 1] / 1000 + s[1] / 2, fl[i + 2] / 1000 + s[2] / 2];
      const c = q ? rot(qq, l) : l;
      const o = { col, m, t: 'box', c: c.map(v => Math.round(v * 10000) / 10000), s };
      if (q) o.q = q;
      out.push(o);
    }
    for (const pr of prisms || []) {
      const p = [];
      for (let i = 4; i + 1 < pr.length; i += 2) p.push([pr[i] / 1000, pr[i + 1] / 1000]);
      const o = { col, m, t: 'prism', c: [pr[0] / 1000, pr[1] / 1000, pr[2] / 1000], p, d: pr[3] / 1000 };
      if (q) o.q = q;
      out.push(o);
    }
  }
  return out;
}
const PARTS = new Map();
const COARSE = new Map();
/** The coarse parts of a piece (its packed k level), or null: the lab page draws these where fine parts cost too much. */
function coarseParts(name) {
  if (COARSE.has(name)) return COARSE.get(name);
  const m = data()[name];
  const v = m && m.k ? unpack(m.k) : null;
  COARSE.set(name, v);
  return v;
}
/** The parts to draw a piece with: its fine parts, or its coarse ones when it has no fine level; null when none. */
function parts(name) {
  if (PARTS.has(name)) return PARTS.get(name);
  const m = data()[name];
  const pk = fineOf(name) || (m && m.k);
  const v = pk ? unpack(pk) : null;
  PARTS.set(name, v);
  return v;
}

// One part as boxes [center, size, rotation, polygon middle]: a box as it is; a prism as one box round its outline,
// or, where that box would stand well past the outline (a hide, a blanket, a round table top), as strips along the
// outline's longer side, each as wide as the outline is there.
function liteParts(pt) {
  if (pt.t === 'box') return [[pt.c.map(r3), pt.s.map(r3), pt.q ? pt.q.map(r3) : 0]];
  const q = pt.q ? pt.q.map(r3) : 0;
  return prismStrips(pt.p, pt.d).map(([u0, u1, v0, v1]) => [pt.c.map(r3), [r3(u1 - u0), r3(v1 - v0), r3(pt.d)], q, [r3((u0 + u1) / 2), r3((v0 + v1) / 2)]]);
}
/** A convex outline [[u, v], ...] as strips [u0, u1, v0, v1]: one when its box is close to it, else up to 6. */
function prismStrips(poly, d) {
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity, a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x, y] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
    u0 = Math.min(u0, x); u1 = Math.max(u1, x); v0 = Math.min(v0, y); v1 = Math.max(v1, y); a += x * y2 - x2 * y;
  }
  const W = u1 - u0, Hh = v1 - v0, area = Math.abs(a) / 2;
  if (W * Hh <= 0 || area >= 0.85 * W * Hh || Math.max(W, Hh) < 0.3) return [[u0, u1, v0, v1]];
  const along = W >= Hh ? 0 : 1, lo = along ? v0 : u0, L = along ? Hh : W;
  const k = Math.max(2, Math.min(6, Math.round(L / 0.25)));
  const out = [];
  for (let s = 0; s < k; s++) {
    const a0 = lo + L * s / k, a1 = lo + L * (s + 1) / k;
    // the outline's reach across within [a0, a1]: its corners in the strip and where its edges cross the strip's ends
    let c0 = Infinity, c1 = -Infinity;
    for (let i = 0; i < poly.length; i++) {
      const p0 = poly[i], p1 = poly[(i + 1) % poly.length];
      const t0 = p0[along], t1 = p1[along], w0 = p0[1 - along], w1 = p1[1 - along];
      if (t0 >= a0 - 1e-9 && t0 <= a1 + 1e-9) { c0 = Math.min(c0, w0); c1 = Math.max(c1, w0); }
      for (const at of [a0, a1]) {
        if ((t0 - at) * (t1 - at) < 0) { const w = w0 + (w1 - w0) * (at - t0) / (t1 - t0); c0 = Math.min(c0, w); c1 = Math.max(c1, w); }
      }
    }
    if (!(c1 > c0)) continue;
    out.push(along ? [c0, c1, a0, a1] : [a0, a1, c0, c1]);
  }
  void d;
  return out.length ? out : [[u0, u1, v0, v1]];
}

function rot(q, v) {
  const [x, y, z, w] = q, [vx, vy, vz] = v;
  const ix = w * vx + y * vz - z * vy, iy = w * vy + z * vx - x * vz;
  const iz = w * vz + x * vy - y * vx, iw = -x * vx - y * vy - z * vz;
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function withBox(o) {
  const e = [0, 1, 2].map(k => Math.abs(o.a[0][k]) * o.h[0] + Math.abs(o.a[1][k]) * o.h[1] + Math.abs(o.a[2][k]) * o.h[2]);
  o.x0 = o.c[0] - e[0]; o.x1 = o.c[0] + e[0]; o.y0 = o.c[1] - e[1]; o.y1 = o.c[1] + e[1]; o.z0 = o.c[2] - e[2]; o.z1 = o.c[2] + e[2];
  return o;
}

const LOCAL = new Map(), LOCALF = new Map();
// The parts in the piece's own frame. A prism is its polygon (in local x, y) pushed d deep along local z; its box is
// the polygon's bounds by that depth, which is close for the thin boards and planks the models are made of. A piece
// with no parts kept (its model sits inside its collider) shows what is solid (lib/shapes.js).
function local(name, fine) {
  const cache = fine ? LOCALF : LOCAL;
  if (cache.has(name)) return cache.get(name);
  const m = data()[name];
  let out = null;
  const pk = m && m.p ? (fine ? fineOf(name) : m.k) : null;
  if (pk) {
    const list = [].concat(...unpack(pk).map(liteParts));
    out = list.map(([c, sz, q0, mid]) => {
      const q = q0 || [0, 0, 0, 1];
      const a = [rot(q, [1, 0, 0]), rot(q, [0, 1, 0]), rot(q, [0, 0, 1])];
      const h = sz.map(v => Math.max(v, 0.012) / 2);
      if (!mid) return { c, a, h };
      const off = rot(q, [mid[0], mid[1], 0]);
      return { c: [c[0] + off[0], c[1] + off[1], c[2] + off[2]], a, h };
    });
  }
  cache.set(name, out);
  return out;
}

function pieceQ(p) {
  if (p.q) return p.q;
  const a = (p.yaw || 0) * Math.PI / 360;
  return [0, Math.sin(a), 0, Math.cos(a)];
}

/** The piece's visible parts in world space; its solids when no parts are kept; null when neither is known. */
// Kept per placed piece while it stays where it is (walls are asked about many times while a building is furnished).
const SEEN = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
function world(p) {
  const c = SEEN && SEEN.get(p);
  if (c && c.x === p.x && c.y === p.y && c.z === p.z && c.q === p.q && c.n === p.name) return c.v;
  const v = world0(p);
  // the piece it came from, so deepest can look again with the fine parts
  if (v && p && typeof p === 'object') Object.defineProperty(v, '_p', { value: p, enumerable: false });
  if (SEEN && p && typeof p === 'object') SEEN.set(p, { x: p.x, y: p.y, z: p.z, q: p.q, n: p.name, v });
  return v;
}
const SEENF = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
/** The piece's parts fitted to 2 cm of the game's mesh, in world space; null when it has no fine level. */
function worldFine(p) {
  const c = SEENF && SEENF.get(p);
  if (c && c.x === p.x && c.y === p.y && c.z === p.z && c.q === p.q && c.n === p.name) return c.v;
  const v = world0(p, true);
  if (SEENF && p && typeof p === 'object') SEENF.set(p, { x: p.x, y: p.y, z: p.z, q: p.q, n: p.name, v });
  return v;
}
function world0(p, fine) {
  const L = local(p.name, fine);
  if (!L) return fine ? null : shapesM().world(p);
  const q = pieceQ(p), sc = p.s || [1, 1, 1];
  return L.map(o => {
    const c = rot(q, [o.c[0] * sc[0], o.c[1] * sc[1], o.c[2] * sc[2]]);
    const a = [], h = [];
    for (let i = 0; i < 3; i++) {
      const v = rot(q, [o.a[i][0] * sc[0], o.a[i][1] * sc[1], o.a[i][2] * sc[2]]), l = Math.hypot(v[0], v[1], v[2]) || 1;
      a.push([v[0] / l, v[1] / l, v[2] / l]); h.push(o.h[i] * l);
    }
    return withBox({ c: [c[0] + p.x, c[1] + p.y, c[2] + p.z], a, h });
  });
}

function aabbOf(list) {
  if (!list || !list.length) return null;
  const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const o of list) {
    b.x0 = Math.min(b.x0, o.x0); b.x1 = Math.max(b.x1, o.x1); b.y0 = Math.min(b.y0, o.y0);
    b.y1 = Math.max(b.y1, o.y1); b.z0 = Math.min(b.z0, o.z0); b.z1 = Math.max(b.z1, o.z1);
  }
  return b;
}

// How far two boxes reach into each other (the least overlap over the separating axes), 0 when apart.
function depth(A, B) {
  if (A.x0 > B.x1 || B.x0 > A.x1 || A.y0 > B.y1 || B.y0 > A.y1 || A.z0 > B.z1 || B.z0 > A.z1) return 0;
  const d = [B.c[0] - A.c[0], B.c[1] - A.c[1], B.c[2] - A.c[2]];
  let m = Infinity;
  const test = L => {
    const l = Math.hypot(L[0], L[1], L[2]);
    if (l < 1e-4) return true;
    const u = [L[0] / l, L[1] / l, L[2] / l];
    const ra = A.h[0] * Math.abs(dot(A.a[0], u)) + A.h[1] * Math.abs(dot(A.a[1], u)) + A.h[2] * Math.abs(dot(A.a[2], u));
    const rb = B.h[0] * Math.abs(dot(B.a[0], u)) + B.h[1] * Math.abs(dot(B.a[1], u)) + B.h[2] * Math.abs(dot(B.a[2], u));
    const ov = ra + rb - Math.abs(dot(d, u));
    if (ov <= 0) return false;
    if (ov < m) m = ov;
    return true;
  };
  for (let i = 0; i < 3; i++) if (!test(A.a[i]) || !test(B.a[i])) return 0;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (!test(cross(A.a[i], B.a[j]))) return 0;
  return isFinite(m) ? m : 0;
}
/** The deepest reach of any part of list A into any part of list B. Lists from world() are tested with the coarse
 * parts first; where those meet, the fine parts (worldFine) of whichever side has them give the answer. */
// cap (optional): a caller that only asks whether the depth passes cap gets the depth itself up to cap and some depth
// over cap otherwise (the search stops at the first part pair past it).
function deepest(A, B, cap) {
  if (!FINE_ON) return deepest0(A, B, cap);
  const pa = A && A._p, pb = B && B._p;
  // with no fine parts on either side the coarse parts give the answer
  if (!(pa && local(pa.name, true)) && !(pb && local(pb.name, true))) return deepest0(A, B, cap);
  // else the coarse parts only tell whether to look again: the first pair that meets is enough
  if (!(deepest0(A, B, 0) > 0)) return 0;
  const fa = pa ? worldFine(pa) : null, fb = pb ? worldFine(pb) : null;
  return deepest0(fa || A, fb || B, cap);
}
let FINE_ON = !(typeof process !== 'undefined' && process.env && process.env.VH_COARSE);
function deepest0(A, B, cap) {
  if (!A || !B || !A.length || !B.length) return 0;
  const a = A._bb || (A._bb = aabbOf(A)), b = B._bb || (B._bb = aabbOf(B));
  if (a.x0 > b.x1 || b.x0 > a.x1 || a.y0 > b.y1 || b.y0 > a.y1 || a.z0 > b.z1 || b.z0 > a.z1) return 0;
  // only parts that reach the other list's box can meet a part of it; pairs whose boxes miss give depth 0 (depth's own
  // first test, made here before the call)
  const As = [], Bs = [];
  for (const p of A) if (!(p.x0 > b.x1 || b.x0 > p.x1 || p.y0 > b.y1 || b.y0 > p.y1 || p.z0 > b.z1 || b.z0 > p.z1)) As.push(p);
  for (const q of B) if (!(a.x0 > q.x1 || q.x0 > a.x1 || a.y0 > q.y1 || q.y0 > a.y1 || a.z0 > q.z1 || q.z0 > a.z1)) Bs.push(q);
  let m = 0;
  for (const pa of As) for (const pb of Bs) {
    if (pa.x0 > pb.x1 || pb.x0 > pa.x1 || pa.y0 > pb.y1 || pb.y0 > pa.y1 || pa.z0 > pb.z1 || pb.z0 > pa.z1) continue;
    const d = depth(pa, pb);
    if (d > m) { m = d; if (cap != null && m > cap) return m; }
  }
  return m;
}

/** Where the piece came from in the game: 'Pieces', 'Items', 'Props' and so on (the prefab's folder). */
function source(name) {
  const m = data()[name];
  return m ? m.src : null;
}

/** The piece's sizes from the game's model: { show: [sx, sy, sz], showAt: [cx, cy, cz], solid, solidAt } or null. */
function dims(name) {
  const m = data()[name];
  if (!m || !m.b) return null;
  return { show: m.b.slice(0, 3), showAt: m.b.slice(3), solid: m.c ? m.c.slice(0, 3) : null, solidAt: m.c ? m.c.slice(3) : null };
}

/** Does the piece show past its collider (its parts are kept)? Where it does not, its solids are what shows. */
function proud(name) { const m = data()[name]; return !!(m && m.p); }

const apiM = { coarseParts, world, worldFine, aabbOf, depth, deepest, source, lite, proud, dims, prismStrips, parts, unpack, encBoxes, decBoxes, fine: on => { FINE_ON = on; },
  setData: d => { LITE = d; FINE = null; LOCAL.clear(); LOCALF.clear(); PARTS.clear(); } };
if (NODE_M) module.exports = apiM; else window.VHMesh = apiM;
