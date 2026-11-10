// What a placed piece looks like, as oriented boxes in world space: the proxy parts of data/piece-models.json (boxes
// and prisms fitted to the game's meshes). lib/shapes.js gives what is solid (the colliders); this gives what shows.
// The two differ where a model stands proud of its collider (the 2x2 wood wall's cross bars stand 13 cm out on one
// face; a bed's blanket hangs past its frame), and that is where things hung or pushed against a piece clip visibly.
// Same box form as lib/shapes.js ({c, a, h} plus x0..z1), so shapes.hit and shapes' penetration math apply.
// Works in Node (reads data/piece-models.json) and in the game's bundle (window.VH_MESH, made by lite() below: the
// parts only for pieces whose model stands proud of its collider by 1.5 cm or more, and the prefab folder of each).
const NODE_M = typeof module !== 'undefined';
const shapesM = () => (NODE_M ? require('./shapes.js') : window.VHShapes);
let LITE = null;
function data() {
  if (LITE) return LITE;
  if (!NODE_M && window.VH_MESH) LITE = window.VH_MESH;
  else LITE = lite(require('../data/piece-models.json'));
  return LITE;
}
const r3 = v => Math.round(v * 1000) / 1000;
/** The compact form: { name: { src, p: [[c, size, q, polygon middle], ...] } }. all: keep the parts of every piece. */
function lite(models, all) {
  const out = {};
  for (const [n, v] of Object.entries(models.pieces || models)) {
    const src = v.prefab ? v.prefab.split('/')[2] : null;
    const e = { src };
    // its sizes in its own frame: what shows (bounds) and what is solid (collider), as [sx, sy, sz, cx, cy, cz]
    const box = q => q && q.min && q.max ? [0, 1, 2].map(i => r3(q.max[i] - q.min[i])).concat([0, 1, 2].map(i => r3((q.max[i] + q.min[i]) / 2))) : null;
    if (v.bounds) e.b = box(v.bounds);
    if (v.collider) e.c = box(v.collider);
    const b = v.bounds, c = v.collider;
    const proud = !c || !b ? 1 : Math.max(...[0, 1, 2].map(i => Math.max(c.min[i] - b.min[i], b.max[i] - c.max[i])));
    if (v.parts && (all || proud >= 0.015) && /Pieces|Items/.test(v.prefab || '')) {
      e.p = v.parts.map(pt => {
        if (pt.t === 'box') return [pt.c.map(r3), pt.s.map(r3), pt.q ? pt.q.map(r3) : 0];
        let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
        for (const [u, w] of pt.p) { u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, w); v1 = Math.max(v1, w); }
        return [pt.c.map(r3), [r3(u1 - u0), r3(v1 - v0), r3(pt.d)], pt.q ? pt.q.map(r3) : 0, [r3((u0 + u1) / 2), r3((v0 + v1) / 2)]];
      });
    }
    out[n] = e;
  }
  return out;
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

const LOCAL = new Map();
// The parts in the piece's own frame. A prism is its polygon (in local x, y) pushed d deep along local z; its box is
// the polygon's bounds by that depth, which is close for the thin boards and planks the models are made of. A piece
// with no parts kept (its model sits inside its collider) shows what is solid (lib/shapes.js).
function local(name) {
  if (LOCAL.has(name)) return LOCAL.get(name);
  const m = data()[name];
  let out = null;
  if (m && m.p) {
    out = m.p.map(([c, sz, q0, mid]) => {
      const q = q0 || [0, 0, 0, 1];
      const a = [rot(q, [1, 0, 0]), rot(q, [0, 1, 0]), rot(q, [0, 0, 1])];
      const h = sz.map(v => Math.max(v, 0.012) / 2);
      if (!mid) return { c, a, h };
      const off = rot(q, [mid[0], mid[1], 0]);
      return { c: [c[0] + off[0], c[1] + off[1], c[2] + off[2]], a, h };
    });
  }
  LOCAL.set(name, out);
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
  if (SEEN && p && typeof p === 'object') SEEN.set(p, { x: p.x, y: p.y, z: p.z, q: p.q, n: p.name, v });
  return v;
}
function world0(p) {
  const L = local(p.name);
  if (!L) return shapesM().world(p);
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
/** The deepest reach of any part of list A into any part of list B. */
function deepest(A, B) {
  if (!A || !B || !A.length || !B.length) return 0;
  const a = A._bb || (A._bb = aabbOf(A)), b = B._bb || (B._bb = aabbOf(B));
  if (a.x0 > b.x1 || b.x0 > a.x1 || a.y0 > b.y1 || b.y0 > a.y1 || a.z0 > b.z1 || b.z0 > a.z1) return 0;
  let m = 0;
  for (const a of A || []) for (const b of B || []) { const d = depth(a, b); if (d > m) m = d; }
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

const apiM = { world, aabbOf, depth, deepest, source, lite, proud, dims, setData: d => { LITE = d; LOCAL.clear(); } };
if (NODE_M) module.exports = apiM; else window.VHMesh = apiM;
