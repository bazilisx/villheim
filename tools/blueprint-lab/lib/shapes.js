// What a placed piece is solid in the game: its colliders from the vanilla prefabs (data/piece-solids.json, made by
// lab/build_models.js from lab/extract_models.py), as oriented boxes in world space. A collider counts when it is not a
// trigger and its layer collides with the player; rugs, cloth doors, food and plants have none and are walked through.
// Spheres and capsules are taken as the boxes round them. Pieces with no measurement (mod pieces) return null, so the
// caller falls back to the catalog box of lib/pieces.js. Works in Node, in the browser and in the game (Jint).
// An oriented box is {c: [x, y, z], a: [three unit axes], h: [three half sizes]} plus its world box x0..z1.

const NODE_SH = typeof module !== 'undefined';

let SOL;
function data() {
  if (SOL) return SOL;
  SOL = {};
  try {
    if (typeof window !== 'undefined' && window.VH_SOLIDS) SOL = window.VH_SOLIDS.pieces || window.VH_SOLIDS;
    else if (NODE_SH) SOL = require('../data/piece-solids.json').pieces;
  } catch (e) {
    SOL = {};
  }
  return SOL;
}
/** Use other solids data (or {} for none). */
function setData(d) { SOL = d ? (d.pieces || d) : {}; LOCAL.clear(); }

function rot(q, v) {
  const [x, y, z, w] = q, [vx, vy, vz] = v;
  const ix = w * vx + y * vz - z * vy, iy = w * vy + z * vx - x * vz;
  const iz = w * vz + x * vy - y * vx, iw = -x * vx - y * vy - z * vz;
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z,
    iz * w + iw * -z + ix * -y - iy * -x];
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function unit(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function perp(a) { const t = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; const u = unit(cross(a, t)); return [u, cross(a, u)]; }

/** Has the game's colliders for this piece (solid or not). */
function has(name) { return Object.prototype.hasOwnProperty.call(data(), name); }
/** Measured and nothing solid: a player walks through it. */
function pass(name) { const d = data()[name]; return !!(d && d.pass); }

const LOCAL = new Map();
// The piece's solids in its own frame, each as an oriented box.
function local(name) {
  if (LOCAL.has(name)) return LOCAL.get(name);
  const d = data()[name];
  let out = null;
  if (d) {
    out = [];
    for (const s of d.s || []) {
      if (s.t === 'sph') out.push({ c: s.c, a: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], h: [s.r, s.r, s.r] });
      else if (s.t === 'cap') { const ax = unit(s.ax), [u, v] = perp(ax); out.push({ c: s.c, a: [ax, u, v], h: [s.h / 2, s.r, s.r] }); }
      else {
        const q = s.q || [0, 0, 0, 1];
        out.push({ c: s.c, a: [rot(q, [1, 0, 0]), rot(q, [0, 1, 0]), rot(q, [0, 0, 1])], h: [s.s[0] / 2, s.s[1] / 2, s.s[2] / 2], m: s.m });
      }
    }
  }
  LOCAL.set(name, out);
  return out;
}

function pieceQ(p) {
  if (p.q) return p.q;
  const a = (p.yaw || 0) * Math.PI / 360;
  return [0, Math.sin(a), 0, Math.cos(a)];
}

function withBox(o) {
  const e = [0, 1, 2].map(k => Math.abs(o.a[0][k]) * o.h[0] + Math.abs(o.a[1][k]) * o.h[1] + Math.abs(o.a[2][k]) * o.h[2]);
  o.x0 = o.c[0] - e[0]; o.x1 = o.c[0] + e[0]; o.y0 = o.c[1] - e[1]; o.y1 = o.c[1] + e[1]; o.z0 = o.c[2] - e[2]; o.z1 = o.c[2] + e[2];
  return o;
}

/** The piece's solid boxes in world space: [] when it is measured and nothing is solid, null when it is not measured. */
function world(p) {
  const L = local(p.name);
  if (!L) return null;
  const q = pieceQ(p), sc = p.s || [1, 1, 1];
  return L.map(o => {
    const c = rot(q, [o.c[0] * sc[0], o.c[1] * sc[1], o.c[2] * sc[2]]);
    const a = [], h = [];
    for (let i = 0; i < 3; i++) {
      const v = rot(q, [o.a[i][0] * sc[0], o.a[i][1] * sc[1], o.a[i][2] * sc[2]]), l = Math.hypot(v[0], v[1], v[2]) || 1;
      a.push([v[0] / l, v[1] / l, v[2] / l]); h.push(o.h[i] * l);
    }
    return withBox({ c: [c[0] + p.x, c[1] + p.y, c[2] + p.z], a, h, m: o.m });
  });
}

/** The world box round all solids of a piece, or null (not measured, or nothing solid). */
function aabb(p) {
  const W = world(p);
  if (!W || !W.length) return null;
  const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const o of W) {
    b.x0 = Math.min(b.x0, o.x0); b.x1 = Math.max(b.x1, o.x1); b.y0 = Math.min(b.y0, o.y0);
    b.y1 = Math.max(b.y1, o.y1); b.z0 = Math.min(b.z0, o.z0); b.z1 = Math.max(b.z1, o.z1);
  }
  return b;
}

const AX = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
// Separating axis test of two oriented boxes; 'e' shrinks both (a negative e lets them touch without counting).
function hit(A, B, e = 0) {
  if (A.x0 > B.x1 + e || B.x0 > A.x1 + e || A.y0 > B.y1 + e || B.y0 > A.y1 + e || A.z0 > B.z1 + e || B.z0 > A.z1 + e) return false;
  const d = [B.c[0] - A.c[0], B.c[1] - A.c[1], B.c[2] - A.c[2]];
  const test = L => {
    const l = Math.hypot(L[0], L[1], L[2]);
    if (l < 1e-6) return true;
    const ra = A.h[0] * Math.abs(dot(A.a[0], L)) + A.h[1] * Math.abs(dot(A.a[1], L)) + A.h[2] * Math.abs(dot(A.a[2], L));
    const rb = B.h[0] * Math.abs(dot(B.a[0], L)) + B.h[1] * Math.abs(dot(B.a[1], L)) + B.h[2] * Math.abs(dot(B.a[2], L));
    return Math.abs(dot(d, L)) <= ra + rb + e * l;
  };
  for (let i = 0; i < 3; i++) if (!test(A.a[i]) || !test(B.a[i])) return false;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (!test(cross(A.a[i], B.a[j]))) return false;
  return true;
}
/** An axis-aligned box {x0..z1} as an oriented box. */
function boxOf(b) {
  return withBox({ c: [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2], a: AX, h: [(b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2, (b.z1 - b.z0) / 2] });
}
/** Does any solid of the list reach into the world box b (shrunk by e, as checks.js 'touch')? */
function hitsBox(list, b, e = 0) {
  if (!list || !list.length) return false;
  const B = boxOf(b);
  return list.some(o => hit(o, B, e));
}
function inside(o, x, y, z, e = 0) {
  const d = [x - o.c[0], y - o.c[1], z - o.c[2]];
  return Math.abs(dot(d, o.a[0])) <= o.h[0] + e && Math.abs(dot(d, o.a[1])) <= o.h[1] + e && Math.abs(dot(d, o.a[2])) <= o.h[2] + e;
}
/** Where a plumb line at (x, z) passes through a solid: [bottom, top], or null. */
function spanY(o, x, z) {
  if (x < o.x0 || x > o.x1 || z < o.z0 || z > o.z1) return null;
  let t0 = -Infinity, t1 = Infinity;
  for (let i = 0; i < 3; i++) {
    const a = o.a[i], d = (x - o.c[0]) * a[0] - o.c[1] * a[1] + (z - o.c[2]) * a[2];
    // along the line the axis coordinate is d + y * a[1]
    if (Math.abs(a[1]) < 1e-9) { if (Math.abs(d) > o.h[i]) return null; continue; }
    let lo = (-o.h[i] - d) / a[1], hi = (o.h[i] - d) / a[1];
    if (lo > hi) [lo, hi] = [hi, lo];
    t0 = Math.max(t0, lo); t1 = Math.min(t1, hi);
    if (t0 > t1) return null;
  }
  return [t0, t1];
}
/** The lowest solid surface of a piece over (x, z) above y, or null. */
function undersideAt(list, x, z, above = -Infinity) {
  let best = null;
  for (const o of list || []) {
    const s = spanY(o, x, z);
    if (s && s[0] > above && (best == null || s[0] < best)) best = s[0];
  }
  return best;
}
/** The top of the solids of a piece at (x, z), or null. */
function topAt(list, x, z) {
  let best = null;
  for (const o of list || []) { const s = spanY(o, x, z); if (s && (best == null || s[1] > best)) best = s[1]; }
  return best;
}
/** Volume of a list of solids that lies inside another list (sampled on a 5 x 5 x 5 grid per box). */
function overlapVolume(A, B) {
  let v = 0;
  for (const o of A) {
    if (!B.some(b => hit(o, b))) continue;
    const n = 5, cell = 8 * o.h[0] * o.h[1] * o.h[2] / (n * n * n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
      const u = (i + 0.5) / n * 2 - 1, w = (j + 0.5) / n * 2 - 1, t = (k + 0.5) / n * 2 - 1;
      const x = o.c[0] + o.a[0][0] * u * o.h[0] + o.a[1][0] * w * o.h[1] + o.a[2][0] * t * o.h[2];
      const y = o.c[1] + o.a[0][1] * u * o.h[0] + o.a[1][1] * w * o.h[1] + o.a[2][1] * t * o.h[2];
      const z = o.c[2] + o.a[0][2] * u * o.h[0] + o.a[1][2] * w * o.h[1] + o.a[2][2] * t * o.h[2];
      if (B.some(b => inside(b, x, y, z))) v += cell;
    }
  }
  return v;
}
function volume(list) { return (list || []).reduce((s, o) => s + 8 * o.h[0] * o.h[1] * o.h[2], 0); }

// How far two pieces' solids reach into each other, in metres: for the deepest pair of their boxes, the least overlap
// over the separating axes (how far one would have to move to come clear). 0 when they are apart. The interior library
// (lab/mine_kitbash.js) records the depth of every clip builders made on purpose, and the checks allow that much.
function penetration(A, B) {
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
function clipDepth(A, B) {
  if (!A || !B) return 0;
  let best = 0;
  for (const a of A) for (const b of B) {
    if (a.x0 >= b.x1 || b.x0 >= a.x1 || a.y0 >= b.y1 || b.y0 >= a.y1 || a.z0 >= b.z1 || b.z0 >= a.z1) continue;
    const v = penetration(a, b);
    if (v > best) best = v;
  }
  return best;
}

const apiSh = { has, pass, local, world, aabb, hit, hitsBox, boxOf, inside, spanY, undersideAt, topAt, overlapVolume, volume, clipDepth, setData };
if (NODE_SH) module.exports = apiSh; else window.VHShapes = apiSh;
