// Draws a blueprint from any angle with no game needed: each piece from its low-poly model (data/piece-models.json,
// boxes and prisms measured from the game's own prefabs) or, for pieces without one, from the box shapes in pieces.js.
// A small z-buffer rasterizer does the drawing, so faces never sort wrong; it shades each face from a sun and an ambient
// term, draws dark lines on edges and creases, puts a simple procedural pattern on each face (boards, blocks, thatch,
// shingles and so on) and can cut the scene at a height for plans. Works in Node (@napi-rs/canvas) and in a browser.
// A piece is {name, x, y, z, q: [qx, qy, qz, qw]} in Valheim world units (y up, left handed).

const Pieces = (typeof module !== 'undefined') ? require('./pieces.js') : window.VHPieces;

let MODELS;
function models() {
  if (MODELS !== undefined) return MODELS;
  MODELS = {};
  try {
    if (typeof window !== 'undefined' && window.VHModels) MODELS = window.VHModels.pieces || window.VHModels;
    else if (typeof require === 'function') MODELS = require('../data/piece-models.json').pieces;
  } catch (e) {
    MODELS = {};
  }
  return MODELS;
}
/** Use other models (or {} for none, to draw the old box shapes). */
function setModels(m) { MODELS = m ? (m.pieces || m) : {}; MODEL_CACHE.clear(); }

function rotate(q, v) {
  const [x, y, z, w] = q, [vx, vy, vz] = v;
  const ix = w * vx + y * vz - z * vy, iy = w * vy + z * vx - x * vz;
  const iz = w * vz + x * vy - y * vx, iw = -x * vx - y * vy - z * vz;
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z,
    iz * w + iw * -z + ix * -y - iy * -x];
}
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function hexRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }

// ---------------------------------------------------------------- old box shapes (pieces without a model)

// Faces of one piece in its own frame: arrays of [x,y,z] corners.
function localFaces(info) {
  const [w, h, d] = info.size;
  const hx = w / 2, hz = d / 2;
  const box = (x0, x1, y0, y1, z0, z1) => {
    const c = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    return [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]].map(f => f.map(i => c[i]));
  };
  switch (info.shape) {
    case 'slope26': case 'slope45': case 'slope67': {
      // a slab 2 m deep along z, rising toward -z by h, centered on the pivot
      // measured: a 26 degree roof piece has its pivot on its low edge, a 45 degree piece in its middle
      const t = 0.12, r = h / 2, lowPivot = info.shape === 'slope26';
      const yAt = z => -z / hz * r + (lowPivot ? r : 0);
      const top = [[-hx, yAt(-hz), -hz], [hx, yAt(-hz), -hz], [hx, yAt(hz), hz], [-hx, yAt(hz), hz]];
      const bot = top.map(([x, y, z]) => [x, y - t, z]);
      return [top, bot.slice().reverse(), [top[0], top[3], bot[3], bot[0]], [top[1], bot[1], bot[2], top[2]],
        [top[0], bot[0], bot[1], top[1]], [top[3], top[2], bot[2], bot[3]]];
    }
    case 'tri': case 'triInv': {
      // right triangle rising toward +x (measured: stacked gable pieces step +2 m along local x)
      const inv = info.shape === 'triInv';
      // pivot on the bottom edge (measured: the wall below a gable piece ends at its pivot)
      const f = inv ? [[-hx, h, -hz], [hx, h, -hz], [hx, 0, -hz]]
        : [[-hx, 0, -hz], [hx, 0, -hz], [hx, h, -hz]];
      const b = f.map(([x, y]) => [x, y, hz]);
      return [f, b.slice().reverse(), [f[0], b[0], b[1], f[1]], [f[1], b[1], b[2], f[2]], [f[2], b[2], b[0], f[0]]];
    }
    case 'beam26': case 'beam45': case 'beam67': {
      const t = 0.12, r = h / 2;
      const p = [[-hx, -r - t, -t], [hx, r - t, -t], [hx, r + t, -t], [-hx, -r + t, -t], [-hx, -r - t, t], [hx, r - t, t], [hx, r + t, t], [-hx, -r + t, t]];
      return [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]].map(f => f.map(i => p[i]));
    }
    case 'stair': {
      const out = [];
      for (let i = 0; i < 3; i++) {
        const z0 = hz - (i + 1) * d / 3, z1 = hz - i * d / 3;
        out.push(...box(-hx, hx, -h / 2, -h / 2 + (i + 1) * h / 3, z0, z1));
      }
      return out;
    }
    case 'prop':
      return box(-hx, hx, 0, h, -hz, hz);
    case 'hang':
      return box(-hx, hx, -h, 0, -hz, hz);
    case 'ladder': {
      const out = [];
      for (let i = 0; i < 4; i++) {
        const z0 = hz - (i + 1) * d / 4, z1 = hz - i * d / 4;
        out.push(...box(-hx * 0.8, hx * 0.8, i * h / 4, (i + 1) * h / 4, z0, z1));
      }
      return out;
    }
    case 'hipcorner26': case 'hipcorner45': {
      const r = info.shape === 'hipcorner45' ? 2 : 1, t = 0.12;
      const A = [hx, 0, hz], B = [hx, 0, -hz], Cc = [-hx, r, -hz], Dd = [-hx, 0, hz];
      const tri1 = [A, B, Cc], tri2 = [A, Cc, Dd];
      const dn = f => f.map(([x, y, z]) => [x, y - t, z]).reverse();
      return [tri1, tri2, dn(tri1), dn(tri2)];
    }
    case 'cap': {
      const a = [[-hx, 0, -1], [hx, 0, -1], [hx, 0.45, 0], [-hx, 0.45, 0]], c = [[-hx, 0.45, 0], [hx, 0.45, 0], [hx, 0, 1], [-hx, 0, 1]];
      return [a, c];
    }
    default:
      return box(-hx, hx, -h / 2, h / 2, -hz, hz);
  }
}

// ---------------------------------------------------------------- patterns

// Pattern ids. Each face gets one; the shading pass turns (u, v) in meters on the face into a brightness factor.
const PAT = { none: 0, plank: 1, board: 2, block: 3, thatch: 4, shingle: 5, log: 6, grain: 7, door: 8, lattice: 9, rails: 10,
  rug: 11, fur: 12, flame: 13, glass: 14, veins: 15, rivets: 16, bands: 17, banner: 18, blanket: 19, straw: 20 };
// the smallest feature of each pattern, metres; below about 4 px on screen the pattern is left out
const PAT_SIZE = [0, 0.25, 0.5, 0.5, 0.3, 0.35, 0.25, 0.4, 0.25, 0.2, 0.3, 0.3, 0.1, 0.3, 0.5, 0.6, 0.25, 0.3, 0.4, 0.3, 0.2];

function hash2(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const frac = x => x - Math.floor(x);

// Brightness factor for pattern 'p' at face coordinates (u along the face's more level axis, v across it) on a face
// spanning [0, du] x [0, dv]. 'k' fades the pattern in (0 none, 1 full).
function pattern(p, u, v, du, dv) {
  switch (p) {
    case PAT.plank: { // vertical boards in two tones
      const w = 0.25, i = Math.floor(u / w), f = u / w - i;
      if (f < 0.07) return 0.62;
      return 0.9 + 0.16 * hash2(i, 7);
    }
    case PAT.board: { // floor boards along v, with butt joints
      const w = 0.5, i = Math.floor(u / w), f = u / w - i;
      if (f < 0.05) return 0.62;
      const L = 2, off = hash2(i, 3) * L, g = frac((v + off) / L);
      if (g < 0.02) return 0.7;
      return 0.88 + 0.18 * hash2(i, 11);
    }
    case PAT.block: { // stone courses with mortar, blocks offset every other course
      const hgt = 0.5, row = Math.floor(v / hgt), fv = v / hgt - row;
      const w = 1, uu = u / w + (row & 1) * 0.5, col = Math.floor(uu), fu = uu - col;
      if (fv < 0.07 || fu < 0.035) return 0.66;
      const t = hash2(col, row);
      return t < 0.33 ? 0.86 : t < 0.66 ? 0.97 : 1.08;
    }
    case PAT.thatch: { // coarse cross-hatching in two straw shades
      const a = frac((u + v) / 0.3), b = frac((u - v) / 0.3);
      const row = Math.floor(v / 0.3);
      let k = (row & 1) ? 1.06 : 0.94;
      if (a < 0.16) k *= 0.8;
      if (b < 0.12) k *= 0.88;
      return k;
    }
    case PAT.shingle: { // zigzag dark lines on a charcoal ground
      const p2 = 0.35, row = v / p2, f = frac(row), tri = Math.abs(frac(u / 0.5) - 0.5) * 2;
      if (Math.abs(f - tri * 0.55) < 0.12) return 0.55;
      return 0.95 + 0.1 * hash2(Math.floor(u / 0.5), Math.floor(row));
    }
    case PAT.log: { // horizontal logs, rounded, with dark seams
      const w = 0.25, f = frac(v / w);
      if (f < 0.08) return 0.5;
      return 0.78 + 0.32 * Math.sin(Math.PI * f);
    }
    case PAT.grain: { // a few long stripes along the length
      const f = frac(v / 0.13 + 0.3 * Math.sin(u * 2.1));
      return f < 0.12 ? 0.82 : 1;
    }
    case PAT.door: { // vertical planks with a cross brace
      const nu = u / (du || 1), nv = v / (dv || 1);
      if (Math.abs(nv - 0.2) < 0.05 || Math.abs(nv - 0.8) < 0.05) return 0.78;
      if (Math.abs(nv - 0.2 - (0.6 * nu)) < 0.05 && nv > 0.2 && nv < 0.8) return 0.78;
      const f = frac(u / 0.25);
      return f < 0.07 ? 0.62 : 0.95 + 0.1 * hash2(Math.floor(u / 0.25), 5);
    }
    case PAT.lattice: {
      const a = frac(u / 0.2), b = frac(v / 0.2);
      return (a < 0.18 || b < 0.18) ? 1.05 : 0.55;
    }
    case PAT.rails: {
      const f = frac(v / 0.3);
      return f < 0.1 ? 0.65 : 1;
    }
    case PAT.rug: { // a border and a woven or furry middle
      const e = Math.min(u, v, (du || 1) - u, (dv || 1) - v);
      if (e < 0.18) return e < 0.05 ? 0.7 : 1.18;
      const s = frac((u + v) / 0.24);
      return 0.9 + 0.12 * hash2(Math.floor(u / 0.08), Math.floor(v / 0.08)) - (s < 0.15 ? 0.08 : 0);
    }
    case PAT.fur:
      return 0.86 + 0.24 * hash2(Math.floor(u / 0.06), Math.floor(v / 0.06));
    case PAT.straw: { // straw mat: close stripes
      const f = frac(u / 0.1);
      return f < 0.3 ? 0.82 : 1 + 0.08 * hash2(Math.floor(u / 0.1), Math.floor(v / 0.6));
    }
    case PAT.flame: {
      const nv = v / (dv || 1), spike = Math.abs(frac(u / 0.15) - 0.5);
      return nv > 0.55 + spike ? 1.35 : 1;
    }
    case PAT.glass: {
      const d = frac((u + v * 0.6) / 1.2);
      return d < 0.06 ? 1.35 : 1;
    }
    case PAT.veins: {
      const s = Math.sin(u * 3.1 + Math.sin(v * 2.3) * 1.7) + Math.sin(v * 4.7 + u * 1.3);
      return Math.abs(s) < 0.06 ? 1.8 : 1;
    }
    case PAT.rivets: {
      const a = frac(u / 0.25) - 0.5, b = frac(v / 0.25) - 0.5;
      return a * a + b * b < 0.03 ? 0.6 : 1;
    }
    case PAT.bands: { // chest: iron bands
      const nu = u / (du || 1);
      return (Math.abs(nu - 0.18) < 0.05 || Math.abs(nu - 0.82) < 0.05) ? 0.45 : 1;
    }
    case PAT.banner: { // a contrasting band and a border
      const nv = v / (dv || 1), nu = u / (du || 1);
      if (nu < 0.08 || nu > 0.92) return 0.6;
      return (nv > 0.72 && nv < 0.84) ? 1.45 : 1;
    }
    case PAT.blanket: { // stripes across a blanket
      const f = frac(v / 0.3);
      return f < 0.2 ? 0.8 : 1 + 0.06 * hash2(Math.floor(u / 0.1), Math.floor(v / 0.1));
    }
    default:
      return 1;
  }
}

// Which pattern a part of a piece gets, from the piece's role and the part's material and shape.
function patternFor(info, part, name) {
  const m = part.m || info.mat || '', role = info.role, n = name;
  if (m === 'glass' || info.mat === 'glass') return PAT.glass;
  if (m === 'fire' || /fire|flame/.test(part.go || '')) return PAT.flame;
  if (role === 'rug') return /straw/.test(n) ? PAT.straw : PAT.rug;
  if (/banner/.test(n) && m === 'cloth') return PAT.banner;
  if (role === 'bed') return m === 'fur' ? PAT.fur : (m === 'cloth' ? PAT.blanket : PAT.grain);
  if (role === 'storage') return /barrel/.test(n) ? PAT.log : PAT.bands;
  if (/blackmarble/.test(n)) return PAT.veins;
  if (/dvergr|iron|metal/.test(n) && (m === 'iron' || m === '')) return PAT.rivets;
  if (role === 'roof' || role === 'roofTop' || role === 'roofCorner') {
    if (m === 'thatch' || /^wood_roof|straw/.test(n) && m !== 'wood') return PAT.thatch;
    if (/darkwood|ashwood|Kokera|turf/.test(n)) return PAT.shingle;
    if (/stone|grausten/.test(n)) return PAT.block;
    return PAT.grain;
  }
  if (m === 'stone' || /stone|grausten|Ashlands/.test(n)) return (role === 'pole' || role === 'beam') ? PAT.none : PAT.block;
  if (role === 'door') return PAT.door;
  if (role === 'window') return PAT.lattice;
  if (role === 'fence') return /stake/.test(n) ? PAT.grain : PAT.rails;
  if (role === 'floor') return PAT.board;
  if (role === 'beam' || role === 'pole') return PAT.grain;
  if (role === 'fire' && !/fire_pit/.test(n)) return PAT.block;
  if (role === 'wall' || role === 'gable') return /log/.test(n) ? PAT.log : PAT.plank;
  if (m === 'fur') return PAT.fur;
  if (m === 'thatch') return PAT.thatch;
  if (role === 'table' || role === 'seat') return PAT.grain;
  return PAT.none;
}

// ---------------------------------------------------------------- models

// A face: corners (local frame), outward normal, color, pattern, and the face's (u, v) frame: origin O and axes U, V.
function faceFrame(pts, n) {
  // U: the edge direction most level with the ground, V: across it on the face
  let U = null, best = 2;
  for (let i = 0; i < pts.length; i++) {
    const e = sub(pts[(i + 1) % pts.length], pts[i]);
    const l = Math.hypot(e[0], e[1], e[2]);
    if (l < 1e-4) continue;
    const ey = Math.abs(e[1] / l);
    if (ey < best - 1e-3) { best = ey; U = [e[0] / l, e[1] / l, e[2] / l]; }
  }
  if (!U) U = [1, 0, 0];
  const V = norm(cross(n, U));
  let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
  for (const p of pts) { const u = dot(p, U), v = dot(p, V); u0 = Math.min(u0, u); v0 = Math.min(v0, v); u1 = Math.max(u1, u); v1 = Math.max(v1, v); }
  return { U, V, u0, v0, du: u1 - u0, dv: v1 - v0 };
}

function partFaces(part) {
  const q = part.q || [0, 0, 0, 1], c = part.c;
  const tf = p => { const r = rotate(q, p); return [r[0] + c[0], r[1] + c[1], r[2] + c[2]]; };
  let loops;
  if (part.t === 'box') {
    const [sx, sy, sz] = part.s.map(v => Math.max(v, 0.012) / 2);
    const k = [[-sx, -sy, -sz], [sx, -sy, -sz], [sx, sy, -sz], [-sx, sy, -sz], [-sx, -sy, sz], [sx, -sy, sz], [sx, sy, sz], [-sx, sy, sz]];
    loops = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 4, 7, 3], [1, 2, 6, 5], [3, 7, 6, 2], [0, 1, 5, 4]].map(f => f.map(i => k[i]));
  } else {
    let pts = part.p.slice();
    // counterclockwise in (x, y)
    let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], r = pts[(i + 1) % pts.length]; a += p[0] * r[1] - r[0] * p[1]; }
    if (a < 0) pts = pts.reverse();
    const h = Math.max(part.d, 0.012) / 2;
    const top = pts.map(([x, y]) => [x, y, h]), bot = pts.map(([x, y]) => [x, y, -h]);
    loops = [top, bot.slice().reverse()];
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      if (Math.hypot(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]) < 1e-4) continue;
      loops.push([bot[i], bot[j], top[j], top[i]]);
    }
  }
  const out = [];
  for (const loop of loops) {
    const pts = loop.map(tf);
    let n = [0, 0, 0];
    for (let i = 0; i < pts.length; i++) { // Newell's method; robust for any convex polygon
      const p = pts[i], r = pts[(i + 1) % pts.length];
      n[0] += (p[1] - r[1]) * (p[2] + r[2]); n[1] += (p[2] - r[2]) * (p[0] + r[0]); n[2] += (p[0] - r[0]) * (p[1] + r[1]);
    }
    if (Math.hypot(n[0], n[1], n[2]) < 1e-9) continue;
    n = norm(n);
    out.push({ pts, n });
  }
  return out;
}

// Colors: the model's own (sampled from the game's textures, which run dark) lifted a little toward the material color.
function partColor(part, info) {
  const base = hexRgb(part.col || info.color);
  const mc = hexRgb(Pieces.MAT[part.m] || info.color);
  if (part.m === 'glass') return [0, 1, 2].map(i => base[i] * 0.3 + mc[i] * 0.7);
  const l = 0.3 * base[0] + 0.59 * base[1] + 0.11 * base[2];
  const lift = c => Math.min(1, (c * 0.8 + l * 0.2) * 1.3 + 0.04);
  return [0, 1, 2].map(i => lift(base[i]) * 0.78 + mc[i] * 0.22);
}

const MODEL_CACHE = new Map();
/** The faces of one piece in its own frame, from its model or the old box shapes. */
function pieceModel(name) {
  let m = MODEL_CACHE.get(name);
  if (m) return m;
  const info = Pieces.piece(name);
  const md = models()[name];
  const faces = [];
  if (md && md.parts && md.parts.length) {
    md.parts.forEach((part, pi) => {
      const col = partColor(part, info), pat = patternFor(info, part, name);
      const alpha = part.m === 'glass' ? 0.5 : 1;
      for (const f of partFaces(part)) faces.push({ ...f, ...faceFrame(f.pts, f.n), col, pat, part: pi, alpha, closed: true });
    });
    m = { name, info, faces, model: true };
  } else {
    const col = hexRgb(info.color), pat = patternFor(info, { m: info.mat }, name);
    for (const pts of localFaces(info)) {
      let n = [0, 0, 0];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], r = pts[(i + 1) % pts.length];
        n[0] += (p[1] - r[1]) * (p[2] + r[2]); n[1] += (p[2] - r[2]) * (p[0] + r[0]); n[2] += (p[0] - r[0]) * (p[1] + r[1]);
      }
      if (Math.hypot(n[0], n[1], n[2]) < 1e-9) continue;
      n = norm(n);
      faces.push({ pts, n, ...faceFrame(pts, n), col, pat, part: 0, alpha: info.mat === 'glass' ? 0.45 : 1, closed: false });
    }
    m = { name, info, faces, model: false };
  }
  MODEL_CACHE.set(name, m);
  return m;
}

/** Which pieces of a list are drawn from a model and which from the old shapes. */
function coverage(pieces) {
  const out = { model: {}, fallback: {} };
  for (const p of pieces) {
    const m = pieceModel(p.name);
    const k = m.model ? 'model' : 'fallback';
    out[k][p.name] = (out[k][p.name] || 0) + 1;
  }
  return out;
}

// ---------------------------------------------------------------- scene

const ROOF_ROLES = ['roof', 'roofTop', 'roofCorner', 'gable'];

// Every face of the scene in camera space. Camera: turn round y by az, tilt by el; orthographic.
// Returns faces with screen points (x right, y up, metres), depth (larger is nearer) and per-corner world y, u, v.
function sceneFaces(pieces, opts = {}) {
  const az = (opts.az ?? 35) * Math.PI / 180, el = (opts.el ?? 30) * Math.PI / 180;
  const ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
  const D = [sa * ce, se, ca * ce]; // toward the camera, in the drawn (z flipped) world
  const light = norm(opts.sun || [-0.45, 0.85, -0.3]);
  const amb = opts.ambient ?? 0.5, dif = 1 - amb + 0.12;
  const cut = opts.cut, crop = opts.crop;
  const out = [];
  let id = 0;
  for (const p of pieces) {
    const m = pieceModel(p.name), info = m.info;
    if (opts.hide && opts.hide.includes(info.role)) continue;
    if (cut != null && (ROOF_ROLES.includes(info.role) || /^beam\d/.test(info.shape))) continue;
    if (cut != null && opts.clip === false && p.y > cut) continue;
    if (crop && (p.x < crop.x0 - 3 || p.x > crop.x1 + 3 || p.z < crop.z0 - 3 || p.z > crop.z1 + 3)) continue;
    const q = p.q || [0, 0, 0, 1], sc = p.s || [1, 1, 1];
    const inst = id++;
    const tint = p.repaired ? hexRgb(opts.repairColor || '#1fa595') : null;
    for (const f of m.faces) {
      const w = f.pts.map(([x, y, z]) => {
        const r = rotate(q, [x * sc[0], y * sc[1], z * sc[2]]);
        return [r[0] + p.x, r[1] + p.y, -(r[2] + p.z)];
      });
      const nr = rotate(q, f.n), n = [nr[0], nr[1], -nr[2]];
      const facing = dot(n, D);
      if (f.closed && facing < -1e-4 && cut == null) continue; // back face of a closed part
      const lit = amb + dif * Math.max(0, dot(n, light)) + 0.08 * Math.max(0, n[1]);
      const k = f.closed ? lit : amb + dif * Math.abs(dot(n, light));
      const cam = w.map(([x, y, z]) => {
        const x1 = x * ca - z * sa, z1 = x * sa + z * ca;
        return [x1, y * ce - z1 * se, y * se + z1 * ce];
      });
      const uv = f.pts.map(pt => [dot(pt, f.U) - f.u0, dot(pt, f.V) - f.v0]);
      const col = tint || f.col;
      out.push({ cam, wy: w.map(v => v[1]), wx: w.map(v => v[0]), wz: w.map(v => -v[2]), uv, du: f.du, dv: f.dv, back: facing < 0,
        col, k, pat: f.pat, alpha: f.alpha, inst, part: f.part, n, name: p.name });
    }
  }
  return out;
}

// Old API: projected polygons, far first. Kept for callers that want shapes rather than pixels.
function polygons(pieces, opts = {}) {
  const fs = sceneFaces(pieces, opts);
  const shade = (c, k) => `rgb(${c.map(v => Math.max(0, Math.min(255, Math.round(v * k * 255)))).join(',')})`;
  const polys = fs.map(f => ({ pts: f.cam.map(c => [c[0], c[1]]), depth: f.cam.reduce((s, c) => s + c[2], 0) / f.cam.length,
    fill: shade(f.col, f.k), alpha: f.alpha }));
  polys.sort((a, b) => a.depth - b.depth);
  return polys;
}

// ---------------------------------------------------------------- rasterizer

// Fill one triangle into the buffers (deferred: face id, u, v per pixel, nearest wins).
function rasterTri(B, fi, a, b, c, aa, ab, ac, cut, transparent) {
  // a, b, c: [sx, sy, depth]; aa..ac: [wy, u, v]
  const W = B.W, H = B.H;
  const x0 = a[0], y0 = a[1];
  const e1x = b[0] - x0, e1y = b[1] - y0, e2x = c[0] - x0, e2y = c[1] - y0;
  const det = e1x * e2y - e2x * e1y;
  if (Math.abs(det) < 1e-9) return;
  const inv = 1 / det;
  // gradient of an attribute over the screen: d/dx, d/dy
  const grad = (va, vb, vc) => {
    const d1 = vb - va, d2 = vc - va;
    return [(d1 * e2y - d2 * e1y) * inv, (d2 * e1x - d1 * e2x) * inv];
  };
  const gz = grad(a[2], b[2], c[2]), gy = grad(aa[0], ab[0], ac[0]), gu = grad(aa[1], ab[1], ac[1]), gv = grad(aa[2], ab[2], ac[2]);
  const minY = Math.max(0, Math.ceil(Math.min(a[1], b[1], c[1]) - 0.5)), maxY = Math.min(H - 1, Math.floor(Math.max(a[1], b[1], c[1]) - 0.5));
  const P = [a, b, c];
  const depth = B.depth, fid = B.fid, ub = B.u, vb = B.v;
  for (let y = minY; y <= maxY; y++) {
    const yc = y + 0.5;
    let xl = Infinity, xr = -Infinity;
    for (let i = 0; i < 3; i++) {
      const p = P[i], r = P[(i + 1) % 3];
      if ((p[1] <= yc && r[1] > yc) || (r[1] <= yc && p[1] > yc)) {
        const x = p[0] + (yc - p[1]) / (r[1] - p[1]) * (r[0] - p[0]);
        if (x < xl) xl = x;
        if (x > xr) xr = x;
      }
    }
    if (xl > xr) continue;
    const sx = Math.max(0, Math.ceil(xl - 0.5)), ex = Math.min(W - 1, Math.floor(xr - 0.5));
    if (sx > ex) continue;
    const dx0 = sx + 0.5 - x0, dy0 = yc - y0;
    let z = a[2] + gz[0] * dx0 + gz[1] * dy0;
    let wy = aa[0] + gy[0] * dx0 + gy[1] * dy0;
    let u = aa[1] + gu[0] * dx0 + gu[1] * dy0;
    let v = aa[2] + gv[0] * dx0 + gv[1] * dy0;
    let idx = y * W + sx;
    for (let x = sx; x <= ex; x++, idx++, z += gz[0], wy += gy[0], u += gu[0], v += gv[0]) {
      if (cut != null && wy > cut) continue;
      if (z <= depth[idx]) continue;
      if (transparent) { B.glass.push(idx, fi, u, v); continue; }
      depth[idx] = z; fid[idx] = fi; ub[idx] = u; vb[idx] = v;
    }
  }
}

function frameOf(faces, opts, W, H) {
  // the box to frame, in screen metres
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  if (opts.crop) {
    const az = (opts.az ?? 35) * Math.PI / 180, el = (opts.el ?? 30) * Math.PI / 180;
    const ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
    const c = opts.crop, ylo = c.y0 ?? (opts.cut != null ? opts.cut - 3 : 0), yhi = c.y1 ?? (opts.cut != null ? opts.cut : ylo + 3);
    for (const X of [c.x0, c.x1]) for (const Z of [c.z0, c.z1]) for (const Y of [ylo, yhi]) {
      const z = -Z, xx = X * ca - z * sa, z1 = X * sa + z * ca, yy = Y * ce - z1 * se;
      x0 = Math.min(x0, xx); x1 = Math.max(x1, xx); y0 = Math.min(y0, yy); y1 = Math.max(y1, yy);
    }
  } else {
    for (const f of faces) for (let i = 0; i < f.cam.length; i++) {
      const c = f.cam[i];
      if (opts.cut != null && f.wy[i] > opts.cut + 0.01) continue; // parts above the cut do not count
      x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]);
    }
  }
  if (!isFinite(x0)) { x0 = -1; x1 = 1; y0 = -1; y1 = 1; }
  const pad = opts.pad ?? (opts.crop ? 0.03 : 0.06);
  const s = opts.ppm || Math.min(W * (1 - 2 * pad) / (x1 - x0 || 1), H * (1 - 2 * pad) / (y1 - y0 || 1));
  return { s, ox: W / 2 - s * (x0 + x1) / 2, oy: H / 2 + s * (y0 + y1) / 2, box: { x0, x1, y0, y1 } };
}

/**
 * Draw to any canvas 2D context.
 * opts: az, el (degrees; el 90 is straight down), cut (height: everything above it is cut away and the cut faces are
 * filled dark, roofs left out), hide (roles), width, height, background, label, ss (supersampling, default 2),
 * crop {x0, x1, z0, z1} (world box to frame, for one room), ppm (pixels per metre; default fits the picture),
 * grid (1 m grid, top views), scale (scale bar), outline (default true), patterns (default true), models (false: old
 * box shapes). Returns {ppm, ms, faces} and the transform used.
 */
function draw(ctx, pieces, opts = {}) {
  const t0 = Date.now();
  const W = opts.width || ctx.canvas.width, H = opts.height || ctx.canvas.height;
  const bg = opts.background || '#e9e4d8';
  const prevModels = MODELS;
  if (opts.models === false) { MODELS = {}; MODEL_CACHE.clear(); }
  const faces = sceneFaces(pieces, opts);
  if (opts.models === false) { MODELS = prevModels; MODEL_CACHE.clear(); }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  if (!faces.length) return { ppm: 0, ms: Date.now() - t0, faces: 0 };
  const fr = frameOf(faces, opts, W, H);
  const ss = Math.max(1, Math.min(4, Math.round(opts.ss ?? 2)));
  const BW = W * ss, BH = H * ss, N = BW * BH;
  const B = { W: BW, H: BH, depth: new Float32Array(N).fill(-Infinity), fid: new Int32Array(N).fill(-1), u: new Float32Array(N), v: new Float32Array(N), glass: [] };
  const S = fr.s * ss, OX = fr.ox * ss, OY = fr.oy * ss;
  const cut = opts.cut;
  // opaque first, then glass on top of what is in front of it
  for (const pass of [false, true]) {
    for (let fi = 0; fi < faces.length; fi++) {
      const f = faces[fi];
      if ((f.alpha < 1) !== pass) continue;
      const P = f.cam.map(c => [OX + S * c[0], OY - S * c[1], c[2]]);
      const A = f.cam.map((c, i) => [f.wy[i], f.uv[i][0], f.uv[i][1]]);
      for (let i = 1; i + 1 < P.length; i++) rasterTri(B, fi, P[0], P[i], P[i + 1], A[0], A[i], A[i + 1], cut, pass);
    }
  }
  // shade
  const bgc = hexRgb(bg.startsWith('#') ? bg : '#e9e4d8');
  const R = new Float32Array(N), G = new Float32Array(N), Bl = new Float32Array(N);
  const pxm = fr.s; // output pixels per metre
  const usePat = opts.patterns !== false;
  const fade = faces.map(f => {
    if (!usePat || !f.pat) return 0;
    const px = PAT_SIZE[f.pat] * pxm;
    return px < 4 ? 0 : px > 8 ? 1 : (px - 4) / 4;
  });
  const section = hexRgb(opts.sectionColor || '#3b3029');
  const shadeAt = (fi, u, v, out, j) => {
    const f = faces[fi];
    if (f.back && cut != null) { out[0][j] = section[0]; out[1][j] = section[1]; out[2][j] = section[2]; return; }
    let k = f.k;
    const fd = fade[fi];
    if (fd > 0) k *= 1 + (pattern(f.pat, u, v, f.du, f.dv) - 1) * fd;
    out[0][j] = Math.min(1, f.col[0] * k); out[1][j] = Math.min(1, f.col[1] * k); out[2][j] = Math.min(1, f.col[2] * k);
  };
  const outArr = [R, G, Bl];
  for (let i = 0; i < N; i++) {
    const fi = B.fid[i];
    if (fi < 0) { R[i] = bgc[0]; G[i] = bgc[1]; Bl[i] = bgc[2]; continue; }
    shadeAt(fi, B.u[i], B.v[i], outArr, i);
  }
  // glass: blend over
  if (B.glass.length) {
    const tmp = [new Float32Array(1), new Float32Array(1), new Float32Array(1)];
    for (let j = 0; j < B.glass.length; j += 4) {
      const idx = B.glass[j], fi = B.glass[j + 1];
      shadeAt(fi, B.glass[j + 2], B.glass[j + 3], tmp, 0);
      const a = faces[fi].alpha;
      R[idx] = R[idx] * (1 - a) + tmp[0][0] * a; G[idx] = G[idx] * (1 - a) + tmp[1][0] * a; Bl[idx] = Bl[idx] * (1 - a) + tmp[2][0] * a;
    }
  }
  // outlines: where the face changes to another part, another piece, a crease, or the background
  if (opts.outline !== false) {
    const fid = B.fid, dep = B.depth;
    const edge = new Uint8Array(N);
    const dz = 0.15 / S * 3; // depth jump, metres, that counts as a silhouette at this scale
    const differs = (a, b, ia, ib) => {
      if (a === b) return false;
      if (a < 0 || b < 0) return true;
      const fa = faces[a], fb = faces[b];
      if (fa.inst !== fb.inst || fa.part !== fb.part) return Math.abs(dep[ia] - dep[ib]) > 0.004 || fa.inst !== fb.inst || dot(fa.n, fb.n) < 0.97;
      return dot(fa.n, fb.n) < 0.9;
    };
    void dz;
    for (let y = 0; y < BH; y++) {
      for (let x = 0; x < BW; x++) {
        const i = y * BW + x, a = fid[i];
        if (x + 1 < BW && differs(a, fid[i + 1], i, i + 1)) { edge[dep[i] >= dep[i + 1] ? i + 1 : i] = 1; if (a < 0 || fid[i + 1] < 0) edge[a < 0 ? i + 1 : i] = 1; }
        if (y + 1 < BH && differs(a, fid[i + BW], i, i + BW)) { edge[dep[i] >= dep[i + BW] ? i + BW : i] = 1; if (a < 0 || fid[i + BW] < 0) edge[a < 0 ? i + BW : i] = 1; }
      }
    }
    const ek = opts.outlineDark ?? 0.42;
    for (let i = 0; i < N; i++) if (edge[i] && fid[i] >= 0) { R[i] *= ek; G[i] *= ek; Bl[i] *= ek; }
  }
  // down to the canvas
  const img = ctx.createImageData(W, H);
  const d = img.data, inv = 1 / (ss * ss);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < ss; sy++) {
        let i = (y * ss + sy) * BW + x * ss;
        for (let sx = 0; sx < ss; sx++, i++) { r += R[i]; g += G[i]; b += Bl[i]; }
      }
      const o = (y * W + x) * 4;
      d[o] = r * inv * 255; d[o + 1] = g * inv * 255; d[o + 2] = b * inv * 255; d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const top = (opts.el ?? 30) >= 89.5;
  if (opts.grid && top) drawGrid(ctx, fr, opts, W, H);
  if (opts.scale) drawScale(ctx, fr.s, W, H);
  if (opts.label) {
    ctx.fillStyle = '#2b241c';
    ctx.font = `${Math.max(11, Math.round(Math.min(H, W) / 28))}px sans-serif`;
    ctx.fillText(opts.label, 10, H - 10);
  }
  return { ppm: fr.s, ms: Date.now() - t0, faces: faces.length, ox: fr.ox, oy: fr.oy };
}

// 1 m grid for top views: world x right, world z up the picture (az 0) or turned with az.
function drawGrid(ctx, fr, opts, W, H) {
  const az = (opts.az ?? 0) * Math.PI / 180, ca = Math.cos(az), sa = Math.sin(az);
  const toScreen = (X, Z) => { const z = -Z; const x1 = X * ca - z * sa, z1 = X * sa + z * ca; return [fr.ox + fr.s * x1, fr.oy + fr.s * z1]; };
  // world extent visible
  const corners = [[0, 0], [W, 0], [0, H], [W, H]].map(([sx, sy]) => {
    const x1 = (sx - fr.ox) / fr.s, z1 = (sy - fr.oy) / fr.s;
    return [x1 * ca + z1 * sa, -(-x1 * sa + z1 * ca)];
  });
  const xs = corners.map(c => c[0]), zs = corners.map(c => c[1]);
  const gx0 = Math.floor(Math.min(...xs)), gx1 = Math.ceil(Math.max(...xs)), gz0 = Math.floor(Math.min(...zs)), gz1 = Math.ceil(Math.max(...zs));
  ctx.save();
  ctx.lineWidth = 1;
  for (let X = gx0; X <= gx1; X++) {
    ctx.strokeStyle = X % 2 === 0 ? 'rgba(20,40,90,0.30)' : 'rgba(20,40,90,0.16)';
    const a = toScreen(X, gz0), b = toScreen(X, gz1);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  for (let Z = gz0; Z <= gz1; Z++) {
    ctx.strokeStyle = Z % 2 === 0 ? 'rgba(20,40,90,0.30)' : 'rgba(20,40,90,0.16)';
    const a = toScreen(gx0, Z), b = toScreen(gx1, Z);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  ctx.restore();
}

function drawScale(ctx, ppm, W, H) {
  let m = 1;
  for (const c of [1, 2, 5, 10, 20]) if (c * ppm <= W * 0.3) m = c;
  const x = W - 16 - m * ppm, y = H - 22;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillRect(x - 8, y - 20, m * ppm + 16, 34);
  ctx.fillStyle = '#2b241c';
  for (let i = 0; i < m; i++) { ctx.fillStyle = i % 2 ? '#ffffff' : '#2b241c'; ctx.fillRect(x + i * ppm, y, ppm, 6); }
  ctx.strokeStyle = '#2b241c'; ctx.lineWidth = 1; ctx.strokeRect(x, y, m * ppm, 6);
  ctx.fillStyle = '#2b241c'; ctx.font = '13px sans-serif';
  ctx.fillText(`${m} m`, x, y - 5);
  ctx.restore();
}

/** Canvas size for a top-down plan at 'ppm' pixels per metre: the crop box, or the whole design. */
function planSize(pieces, opts = {}) {
  const ppm = opts.ppm || 50, pad = opts.margin ?? 0.4;
  let c = opts.crop;
  if (!c) {
    c = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
    for (const p of pieces) { c.x0 = Math.min(c.x0, p.x); c.x1 = Math.max(c.x1, p.x); c.z0 = Math.min(c.z0, p.z); c.z1 = Math.max(c.z1, p.z); }
    c.x0 -= 1.5; c.x1 += 1.5; c.z0 -= 1.5; c.z1 += 1.5;
  }
  return { width: Math.ceil((c.x1 - c.x0 + 2 * pad) * ppm), height: Math.ceil((c.z1 - c.z0 + 2 * pad) * ppm), crop: c };
}

/**
 * Top-down plan of a room or a whole floor: straight down, everything above 'cut' removed (walls show their cut in
 * dark), at a true scale with a 1 m grid and a scale bar.
 * opts: cut (height, default floor + 1.8), crop {x0, x1, z0, z1}, ppm (default 50), margin, grid, scale, ss.
 */
function plan(ctx, pieces, opts = {}) {
  const ppm = opts.ppm || 50;
  const sz = planSize(pieces, opts);
  const pad = opts.margin ?? 0.4;
  const crop = { x0: sz.crop.x0 - pad, x1: sz.crop.x1 + pad, z0: sz.crop.z0 - pad, z1: sz.crop.z1 + pad, y0: opts.cut - 3, y1: opts.cut };
  return draw(ctx, pieces, { ...opts, az: 0, el: 90, crop, ppm, pad: 0, width: opts.width || sz.width, height: opts.height || sz.height,
    grid: opts.grid !== false, scale: opts.scale !== false, clip: true });
}

const VIEWS = [
  { key: 'front', az: 35, el: 28, label: 'front left' },
  { key: 'back', az: 215, el: 28, label: 'back right' },
  { key: 'top', az: 0, el: 90, label: 'top' },
  { key: 'inside', az: 35, el: 55, cut: 2.6, label: 'inside, roof off' },
];

const api = { polygons, draw, plan, planSize, VIEWS, pieceModel, coverage, setModels, PAT, pattern };
if (typeof module !== 'undefined') module.exports = api;
else window.VHRender = api;
