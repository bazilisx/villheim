// Checks on a design: every piece supported, no doubled or crushed pieces, doors you can walk through, headroom
// under roofs and ceilings, ladders and stairs you can climb, materials the biome has, and room left to move inside.
// Rough, from piece boxes and the measured shapes of roofs, doors and ladders; good for catching mistakes.

const NODE_C = typeof module !== 'undefined';
const PC = NODE_C ? require('./pieces.js') : window.VHPieces;
const SHP = NODE_C ? require('./shapes.js') : window.VHShapes;

// A player is about 1.8 m tall. Walkable rooms need 2.4 m clear under every roof and ceiling piece; a doorway needs its
// own height, and 2.3 m in front of it and behind it, for a metre each way.
const HEADROOM = 2.4, DOOR_CLEAR = 2.3, CORRIDOR = 1.0, WALL_MIN = 2.5, ROOF_HOLE = 2.5;
// A clip the generator means (a piece marked p.clip = depth in metres, set into a fence, a wall or another piece) is
// allowed up to its mark and never past the median clip of props in the corpus builds (lab/mine_yards.js: 0.36 m).
const CLIP_MAX = 0.36;
// check() uses the game's colliders unless told otherwise ({shapes: false})
let SHAPES_DEFAULT = true;

function yawOf(q) { const [x, y, z, w] = q || [0, 0, 0, 1]; return Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + x * x)) * 180 / Math.PI; }
function tilted(q) { return q && (Math.abs(q[0]) > 0.02 || Math.abs(q[2]) > 0.02); }
function yawDeg(p) { return p.yaw != null ? p.yaw : yawOf(p.q); }

// A point in a piece's own frame: u along its local x, v along its local z.
function localOf(p, x, z) {
  const a = yawDeg(p) * Math.PI / 180, dx = x - p.x, dz = z - p.z;
  return [dx * Math.cos(a) - dz * Math.sin(a), dx * Math.sin(a) + dz * Math.cos(a)];
}

// The catalog box (lib/pieces.js), or, with the game's colliders on (the default), the catalog box and the solids
// together, with the solids in 'sol' (see gameBox).
// Kept per piece object while its name, place, turn and scale are the same (the motif passes and the stability test
// read every piece's box several times over); callers read the box and never change it.
const AABB_C = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
function aabb(p) {
  if (!(SHAPES_DEFAULT && SHP)) return catBox(p);
  if (!AABB_C || !p || typeof p !== 'object') return gameBox(p);
  const c = AABB_C.get(p);
  if (c && c.n === p.name && c.x === p.x && c.y === p.y && c.z === p.z && c.q === p.q && c.yaw === p.yaw && c.s === p.s) return c.v;
  const v = gameBox(p);
  AABB_C.set(p, { n: p.name, x: p.x, y: p.y, z: p.z, q: p.q, yaw: p.yaw, s: p.s, v });
  return v;
}
function catBox(p) {
  const info = PC.piece(p.name);
  let [w, h, d] = info.size;
  const s = p.s || [1, 1, 1];
  w *= s[0]; h *= s[1]; d *= s[2];
  if (info.role === 'door' && !tilted(p.q)) {
    const o = PC.doorOpening(p), hw = o.w / 2, ex = Math.abs(o.ux) * hw + Math.abs(o.nx) * 0.1, ez = Math.abs(o.uz) * hw + Math.abs(o.nz) * 0.1;
    return { x0: o.x - ex, x1: o.x + ex, y0: o.y, y1: o.y + o.h, z0: o.z - ez, z1: o.z + ez, info };
  }
  const a = yawDeg(p) * Math.PI / 180, c = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a));
  const ex = (w * c + d * sn) / 2, ez = (w * sn + d * c) / 2;
  const prop = info.shape === 'prop' || info.shape === 'cap' || info.shape === 'tri' || info.shape === 'triInv' || info.onPivot;
  let y0 = prop ? p.y : p.y - h / 2, y1 = prop ? p.y + h : p.y + h / 2;
  if (info.shape === 'hang') { y0 = p.y - h; y1 = p.y; }
  if (info.shape === 'slope26') { y0 = p.y - 0.15; y1 = p.y + h; }
  const climb = info.role === 'stair' && PC.climbSpec(p.name);
  if (climb && (info.shape === 'stair' || info.shape === 'ladder')) { y0 = p.y + climb.bottom; y1 = y0 + climb.rise; }
  if (tilted(p.q)) { const m = Math.max(w, h, d) / 2; return { x0: p.x - m, x1: p.x + m, y0: p.y - m, y1: p.y + m, z0: p.z - m, z1: p.z + m, info }; }
  return { x0: p.x - ex, x1: p.x + ex, y0, y1, z0: p.z - ez, z1: p.z + ez, info };
}

// With the game's colliders (lib/shapes.js): the box round the piece's solids, with the solids themselves in 'sol'
// and 'pass' for a piece nothing of which is solid (rugs, cloth doors). Doors keep their opening as the box. Pieces
// with no measurement keep the catalog box.
function aabbShapes(p) {
  const b = catBox(p);
  const W = SHP && SHP.world(p);
  if (!W) return b;
  b.sol = W;
  if (!W.length) { b.pass = true; return b; }
  if (b.info.role === 'door') return b;
  const s = SHP.aabb(p);
  b.x0 = s.x0; b.x1 = s.x1; b.y0 = s.y0; b.y1 = s.y1; b.z0 = s.z0; b.z1 = s.z1;
  return b;
}
// The catalog box grown to hold the game's solids too, with the solids in 'sol' and 'pass' for pieces nothing of which
// is solid: what the generator and the decorator test against, so a table or bench takes the room it takes in the game.
function gameBox(p) {
  const b = catBox(p);
  const W = SHP && SHP.world(p);
  if (!W) return b;
  b.sol = W;
  if (!W.length) { b.pass = true; return b; }
  if (b.info.role === 'door') return b;
  const s = SHP.aabb(p);
  b.x0 = Math.min(b.x0, s.x0); b.x1 = Math.max(b.x1, s.x1); b.y0 = Math.min(b.y0, s.y0);
  b.y1 = Math.max(b.y1, s.y1); b.z0 = Math.min(b.z0, s.z0); b.z1 = Math.max(b.z1, s.z1);
  return b;
}
const ROOFISH = ['roof', 'roofTop', 'roofCorner'];
// Does piece j's box (or, with shapes, any of its solids) reach into the box col?
function blocks(col, b, e) {
  if (b.sol) return !b.pass && SHP.hitsBox(b.sol, col, e);
  return touch(col, b, e);
}
// Underside over a point: the catalog's shapes, or with shapes the lowest solid surface of a roof, floor or level beam.
function undersideOf(p, x, z, b) {
  if (b.sol && b.sol.length) {
    const info = b.info;
    if (ROOFISH.includes(info.role) || info.role === 'floor' || (info.role === 'beam' && info.shape === 'box')) return SHP.undersideAt(b.sol, x, z);
    return null;
  }
  return underside(p, x, z, b.info);
}

// Height of the underside of a roof or ceiling piece over a world point, or null when the piece is not over it.
// Roof pieces run 2 m along their local z and rise toward local -z; a 26 degree piece pivots on its low edge, a 45
// degree one in its middle (BLUEPRINT_LAB.md). Hip corners are taken at their low edge, ridge caps 0.3 m below
// their pivot, floors and level beams at the bottom of their box.
function underside(p, x, z, info) {
  info = info || PC.piece(p.name);
  if (tilted(p.q)) return null;
  const sh = info.shape, s = p.s || [1, 1, 1];
  const w = info.size[0] * s[0], h = info.size[1] * s[1], d = info.size[2] * s[2];
  const roofish = ['roof', 'roofTop', 'roofCorner'].includes(info.role);
  const level = info.role === 'floor' || (info.role === 'beam' && sh === 'box');
  if (!roofish && !level) return null;
  const [u, v] = localOf(p, x, z);
  if (Math.abs(u) > w / 2 + 0.01 || Math.abs(v) > d / 2 + 0.01) return null;
  if (level) return p.y - h / 2;
  if (sh === 'cap') return p.y - 0.3;
  if (sh === 'hipcorner26' || sh === 'hipcorner45') return p.y - 0.1;
  if (sh === 'slope26') return p.y + h * (d / 2 - v) / d - 0.1;
  if (sh === 'slope45' || sh === 'slope67') return p.y - h * v / d - 0.1;
  return p.y - 0.1;
}

// Grid of boxes for fast neighbour search.
function index(boxes) {
  const g = new Map(), k = (i, j) => i * 100003 + j;
  boxes.forEach((b, n) => {
    for (let i = Math.floor(b.x0 / 2); i <= Math.floor(b.x1 / 2); i++) for (let j = Math.floor(b.z0 / 2); j <= Math.floor(b.z1 / 2); j++) {
      const key = k(i, j); if (!g.has(key)) g.set(key, []); g.get(key).push(n);
    }
  });
  // pad 1 also returns pieces in the cells round the box (for touching with a margin); pad 0 only those whose box can
  // reach into it, which is all a point or a small column needs
  // the answer is a list in the order a Set would give (first seen first), each piece once; a mark per piece tells it
  // was seen in this query
  const none = [], mark = new Uint32Array(boxes.length);
  let q = 0;
  return (b, pad = 1) => {
    const ia = Math.floor(b.x0 / 2) - pad, ib = Math.floor(b.x1 / 2) + pad, ja = Math.floor(b.z0 / 2) - pad, jb = Math.floor(b.z1 / 2) + pad;
    if (ia === ib && ja === jb) return g.get(k(ia, ja)) || none;
    if (++q === 0xffffffff) { mark.fill(0); q = 1; }
    const out = [];
    for (let i = ia; i <= ib; i++) for (let j = ja; j <= jb; j++) { const l = g.get(k(i, j)); if (l) for (const n of l) if (mark[n] !== q) { mark[n] = q; out.push(n); } }
    return out;
  };
}
const touch = (a, b, e) => a.x0 <= b.x1 + e && b.x0 <= a.x1 + e && a.y0 <= b.y1 + e && b.y0 <= a.y1 + e && a.z0 <= b.z1 + e && b.z0 <= a.z1 + e;
const vol = a => Math.max(0, a.x1 - a.x0) * Math.max(0, a.y1 - a.y0) * Math.max(0, a.z1 - a.z0);
function inter(a, b) {
  return Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));
}
const ptBox = (x, y0, y1, z, r = 0.05) => ({ x0: x - r, x1: x + r, y0, y1, z0: z - r, z1: z + r });

// Walls on a 0.25 m grid, for "is this point inside walls" and "is it right against a wall".
const WALLISH = ['wall', 'door', 'window', 'gable'];
function wallGrid(pieces, boxes) {
  const g = new Map(), key = (i, j) => i * 100003 + j;
  pieces.forEach((p, n) => {
    const b = boxes[n];
    if (!WALLISH.includes(b.info.role) || tilted(p.q) || p.decor) return; // furniture made of wall pieces (a bar counter) is no wall
    const s = p.s || [1, 1, 1], w = b.info.size[0] * s[0], d = Math.max(0.2, b.info.size[2] * s[2]);
    for (let i = Math.round(b.x0 * 4); i <= Math.round(b.x1 * 4); i++) for (let j = Math.round(b.z0 * 4); j <= Math.round(b.z1 * 4); j++) {
      const [u, v] = localOf(p, i / 4, j / 4);
      if (b.info.role !== 'door' && (Math.abs(u) > w / 2 + 0.13 || Math.abs(v) > d / 2 + 0.13)) continue;
      const k = key(i, j);
      if (!g.has(k)) g.set(k, []);
      g.get(k).push([b.y0, b.y1, w]);
    }
  });
  const at = (x, z, y, minW = 0) => (g.get(key(Math.round(x * 4), Math.round(z * 4))) || []).some(([a, c, w]) => a <= y && y <= c && w >= minW);
  // Per floor height, maps on the same 0.25 m grid: which cells have walls on all four sides within 14 m, and sums for
  // "a wall within r" at a few heights. Built once per height; the checks ask thousands of points.
  let i0 = Infinity, i1 = -Infinity, j0 = Infinity, j1 = -Infinity;
  for (const k of g.keys()) {
    const i = Math.round(k / 100003), j = k - i * 100003;
    if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j;
  }
  const nx = i1 - i0 + 1, nz = j1 - j0 + 1;
  const levels = new Map();
  const level = y => {
    const lk = Math.round(y * 20);
    if (levels.has(lk)) return levels.get(lk);
    const N = nx * nz, ray = new Uint8Array(N), ins = new Uint8Array(N);
    const sums = {};
    const mk = (h, minW) => {
      const a = new Uint8Array(N), yy = y + h;
      for (const [k, list] of g) if (list.some(([lo, hi, w]) => lo <= yy && yy <= hi && w >= minW)) { const i = Math.round(k / 100003), j = k - i * 100003; a[(i - i0) * nz + (j - j0)] = 1; }
      return a;
    };
    const lo = mk(0.6, 0), hi = mk(1.2, 0);
    for (let n = 0; n < N; n++) ray[n] = lo[n] | hi[n];
    // walls within 14 m (56 cells) in each direction
    const R = 56, seen = new Int32Array(N).fill(0);
    const pass = (outer, inner, idx) => {
      for (let a = 0; a < outer; a++) { let last = -1e9; for (let b = 0; b < inner; b++) { const n = idx(a, b); if (ray[n]) last = b; else if (b - last <= R) seen[n]++; } }
    };
    pass(nx, nz, (a, b) => a * nz + b); pass(nx, nz, (a, b) => a * nz + (nz - 1 - b));
    pass(nz, nx, (a, b) => b * nz + a); pass(nz, nx, (a, b) => (nx - 1 - b) * nz + a);
    for (let n = 0; n < N; n++) ins[n] = seen[n] === 4 ? 1 : 0;
    const prefix = a => { const P = new Int32Array((nx + 1) * (nz + 1)); for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) P[(i + 1) * (nz + 1) + j + 1] = a[i * nz + j] + P[i * (nz + 1) + j + 1] + P[(i + 1) * (nz + 1) + j] - P[i * (nz + 1) + j]; return P; };
    const L = { ins, sums, mk, prefix };
    levels.set(lk, L);
    return L;
  };
  const cell = (x, z) => [Math.round(x * 4) - i0, Math.round(z * 4) - j0];
  const boxSum = (P, i, j, r) => {
    const a0 = Math.max(0, i - r), a1 = Math.min(nx - 1, i + r), b0 = Math.max(0, j - r), b1 = Math.min(nz - 1, j + r);
    if (a0 > a1 || b0 > b1) return 0;
    return P[(a1 + 1) * (nz + 1) + b1 + 1] - P[a0 * (nz + 1) + b1 + 1] - P[(a1 + 1) * (nz + 1) + b0] + P[a0 * (nz + 1) + b0];
  };
  return {
    at,
    // walls on all four sides within 14 m, at knee or chest height, so a window opening does not count as a way out
    inside(x, y, z) {
      if (!g.size) return false;
      const [i, j] = cell(x, z);
      if (i < 0 || j < 0 || i >= nx || j >= nz) return false;
      return level(y).ins[i * nz + j] === 1;
    },
    // a wall within r metres at height y + h (of at least minW metres wide)
    near(x, y, z, r, h = 1.2, minW = 0) {
      if (!g.size) return false;
      const L = level(y), k = `${h}|${minW}`;
      if (!L.sums[k]) L.sums[k] = L.prefix(L.mk(h, minW));
      const [i, j] = cell(x, z);
      return boxSum(L.sums[k], i, j, Math.round(r * 4)) > 0;
    },
  };
}

// Floor points a person walks on: 0.5 m apart on top of every floor piece (and stair landing), with the floor's top.
function floorPoints(pieces, boxes) {
  const pts = [];
  pieces.forEach((p, n) => {
    const b = boxes[n];
    if (b.info.role !== 'floor' || tilted(p.q)) return;
    const s = p.s || [1, 1, 1], w = b.info.size[0] * s[0], d = b.info.size[2] * s[2];
    const a = yawDeg(p) * Math.PI / 180, lx = [Math.cos(a), -Math.sin(a)], lz = [Math.sin(a), Math.cos(a)];
    for (let u = -w / 2 + 0.25; u < w / 2; u += 0.5) for (let v = -d / 2 + 0.25; v < d / 2; v += 0.5)
      pts.push({ x: p.x + lx[0] * u + lz[0] * v, z: p.z + lx[1] * u + lz[1] * v, y: b.y1, floor: n });
  });
  return pts;
}

// The space a person needs to walk through a door: its opening, then 2.3 m up for a metre in front and behind.
// Returns the pieces in the way (indices).
function doorBlockers(o, pieces, boxes, near, skip) {
  const out = new Set();
  const hw = 0.45;
  for (let s = -CORRIDOR; s <= CORRIDOR + 0.001; s += 0.2) {
    const inPlane = Math.abs(s) < 0.55;
    const yLo = o.y + 0.25, yHi = o.y + (inPlane ? Math.min(o.h, DOOR_CLEAR) - 0.05 : DOOR_CLEAR);
    for (let t = -hw; t <= hw + 0.001; t += hw / 2) {
      const x = o.x + o.nx * s + o.ux * t, z = o.z + o.nz * s + o.uz * t;
      const col = ptBox(x, yLo, yHi, z);
      for (const j of near(col, 0)) {
        if (skip && skip(j)) continue;
        const b = boxes[j], role = b.info.role;
        if (['floor', 'rug', 'door', 'stair', 'nature', 'misc'].includes(role) || b.pass) continue;
        const u = undersideOf(pieces[j], x, z, b);
        if (u != null) {
          // with the game's colliders a ceiling or beam may reach 0.15 m into the top of the frame, as a lintel does
          if (u > yLo && u < yHi && !(inPlane && b.sol && u >= o.y + o.h - 0.15)) out.add(j);
          continue;
        }
        if (!b.sol && role === 'beam' && b.info.shape !== 'box') continue; // braces lie in the wall beside the door
        if (blocks(col, b, -0.02)) {
          // walls and gables over the opening, in its own wall, are its lintel; with the game's colliders a beam is
          // too, and a lintel may reach 0.15 m into the top of the frame (the opening is 2 m, a player 1.8 m)
          if (inPlane && WALLISH.includes(role) && b.y0 >= o.y + o.h - 0.06) continue;
          if (inPlane && b.sol && (WALLISH.includes(role) || role === 'beam') && b.y0 >= o.y + o.h - 0.15) continue;
          out.add(j);
        }
      }
    }
  }
  return [...out];
}

// Ladder and stair pieces as lines: bottom and top points and the climbing direction.
function climbs(pieces) {
  const out = [];
  pieces.forEach((p, n) => {
    const info = PC.piece(p.name);
    if (info.role !== 'stair') return;
    const c = PC.climbSpec(p.name);
    if (!c || /spiral/.test(p.name)) return;
    const a = yawDeg(p) * Math.PI / 180, dx = -Math.sin(a), dz = -Math.cos(a), half = c.run / 2;
    const y0 = p.y + c.bottom;
    out.push({ n, p, dx, dz, bx: p.x - dx * half, bz: p.z - dz * half, by: y0, tx: p.x + dx * half, tz: p.z + dz * half, ty: y0 + c.rise, run: c.run, rise: c.rise });
  });
  // a piece continues another when its end lies on the other's line (stacked ladders, long stairs)
  const onLine = (L, x, y, z, lo, hi) => {
    const t = (x - L.bx) * L.dx + (z - L.bz) * L.dz, px = L.bx + L.dx * t, pz = L.bz + L.dz * t;
    return t > lo && t < hi && Math.hypot(px - x, pz - z) < 0.3 && Math.abs(L.by + t * L.rise / L.run - y) < 0.3;
  };
  for (const L of out) {
    const par = out.filter(M => M !== L && M.dx * L.dx + M.dz * L.dz > 0.9);
    L.continuesBelow = par.some(M => onLine(M, L.bx, L.by, L.bz, 0.05, M.run + 0.05));
    L.continuesAbove = par.some(M => onLine(M, L.tx, L.ty, L.tz, -0.05, M.run - 0.05));
  }
  return out;
}

function stability(pieces, boxes, near, ground) {
  const n = pieces.length, sup = new Float64Array(n).fill(-1), mat = new Array(n);
  const heap = [];
  const push = i => { heap.push(i); let k = heap.length - 1; while (k > 0) { const pk = (k - 1) >> 1; if (sup[heap[pk]] >= sup[heap[k]]) break; [heap[pk], heap[k]] = [heap[k], heap[pk]]; k = pk; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && sup[heap[l]] > sup[heap[m]]) m = l; if (r < heap.length && sup[heap[r]] > sup[heap[m]]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  for (let i = 0; i < n; i++) {
    if (!boxes[i].info.structural) continue;
    mat[i] = PC.support(pieces[i].name);
    if (boxes[i].y0 <= ground + 0.1) { sup[i] = mat[i].max; push(i); }
  }
  const done = new Uint8Array(n);
  while (heap.length) {
    const i = pop();
    if (done[i]) continue;
    done[i] = 1;
    const a = boxes[i];
    for (const j of near(a)) {
      if (j === i || !mat[j] || done[j]) continue;
      const o = boxes[j];
      if (!touch(a, o, 0.02)) continue;
      const cx = (o.x0 + o.x1) / 2, cy = (o.y0 + o.y1) / 2, cz = (o.z0 + o.z1) / 2;
      const px = Math.max(a.x0, Math.min(a.x1, cx)), py = Math.max(a.y0, Math.min(a.y1, cy)), pz = Math.max(a.z0, Math.min(a.z1, cz));
      if (py > cy + 0.05) continue; // a piece is held from below or beside, never from above
      const d = Math.hypot(px - cx, py - cy, pz - cz);
      // arches stand on their feet, which the boxes here do not show
      const t = d < 1e-3 || /arch/.test(pieces[j].name) ? 1 : Math.acos(1 - Math.abs(py - cy) / d) / (Math.PI / 2);
      const loss = mat[j].h + (mat[j].v - mat[j].h) * t;
      const got = Math.min(mat[j].max, sup[i] * (1 - loss));
      if (got > sup[j] + 1e-6) { sup[j] = got; push(j); }
    }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (mat[i] && sup[i] < mat[i].min) out.push(i);
  return out;
}

// Passages (Tyler, showcase review 2026-11-11, a hard rule): "Anything small passageway must be at minimum two
// wood_floor pieces wide. Wider hallways can be 3 or more. But 1 of them is far too narrow for anything besides a
// small closet or hidden passageway." Measured on each floor level in floor pieces: the floor under a roof between
// walls on three sides or more, and floors 0.6 m or more over the ground (balconies, galleries, decks, raised porches). Walls and windows count at
// their middle line (a stone wall's thickness is the builder's choice, the floor between is what the rule names);
// stairs and ladders count as they stand (a post stands in open floor). A point is in a passage of full width when a circle PASSAGE_W wide
// (less a little for rounding) fits round it on that floor. What is left over, in pieces of more than PASSAGE_CLOSET
// m2, is a passage too narrow when it runs PASSAGE_LONG m or more: a closet of one piece across stays under that, and
// the corners of a room are short. Furniture is left out here; the space
// beside furniture is the furnishing's own check.
const PASSAGE_W = 4, PASSAGE_CLOSET = 6, PASSAGE_LONG = 3, PASSAGE_CELL = 0.25;
function passages(pieces, opts = {}) {
  // (the walls' band takes a quarter metre off each side)
  const G = PASSAGE_CELL, R = PASSAGE_W / 2 - 0.4;
  const boxes = pieces.map(catBox);
  const ys0 = boxes.filter(b => b.info.structural).map(b => b.y0).sort((a, c) => a - c);
  const ground = opts.ground != null ? opts.ground : Math.max(0, ys0.length ? ys0[Math.floor(ys0.length * 0.02)] : 0);
  const floors = [];
  pieces.forEach((p, i) => { const b = boxes[i]; if (b.info.role === 'floor' && !p.decor && !tilted(p.q)) floors.push(i); });
  const levels = new Map();
  for (const i of floors) { const k = Math.round(boxes[i].y1 * 4) / 4; if (!levels.has(k)) levels.set(k, []); levels.get(k).push(i); }
  const out = [];
  for (const [y, list] of levels) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const i of list) { const b = boxes[i]; x0 = Math.min(x0, b.x0); x1 = Math.max(x1, b.x1); z0 = Math.min(z0, b.z0); z1 = Math.max(z1, b.z1); }
    x0 -= 1; z0 -= 1; x1 += 1; z1 += 1;
    const nx = Math.ceil((x1 - x0) / G), nz = Math.ceil((z1 - z0) / G), N = nx * nz;
    if (N > 600000) continue;
    const free = new Uint8Array(N), wallm = new Uint8Array(N), cx = i => x0 + (i + 0.5) * G, cz = j => z0 + (j + 0.5) * G;
    const raised = y > ground + 0.6;
    for (const n of list) {
      const b = boxes[n];
      for (let i = Math.max(0, Math.floor((b.x0 - x0) / G)); i < Math.min(nx, Math.ceil((b.x1 - x0) / G)); i++)
        for (let j = Math.max(0, Math.floor((b.z0 - z0) / G)); j < Math.min(nz, Math.ceil((b.z1 - z0) / G)); j++) {
          const x = cx(i), z = cz(j);
          if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue;
          free[i * nz + j] = 1;
        }
    }
    // what stands on this floor: walls at their middle line, climbs, posts
    pieces.forEach((p, n) => {
      const b = boxes[n], role = b.info.role;
      if (p.decor || b.y1 < y + 0.3 || b.y0 > y + 1.8) return;
      if (['wall', 'window', 'gable'].includes(role)) {
        if (tilted(p.q)) return;
        const s = p.s || [1, 1, 1], w = b.info.size[0] * s[0], a = yawDeg(p) * Math.PI / 180, ux = Math.cos(a), uz = -Math.sin(a);
        // (a block a metre wide or less standing alone is a jamb or a column, as a hearth's surround)
        if (w <= 1.01 && !pieces.some((q, m) => m !== n && ['wall', 'window', 'door'].includes(boxes[m].info.role) && boxes[m].info.size[0] > 1.01 && Math.hypot(q.x - p.x, q.z - p.z) < 1.6 && boxes[m].y0 < y + 1.6 && boxes[m].y1 > y + 0.3)) return;
        // a band a cell wide each way of the line, so a wall at an angle leaves no gap a ray could pass
        for (let t = -w / 2; t <= w / 2 + 1e-6; t += G / 4) for (const [ex, ez] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
          const i = Math.floor((p.x + ux * t + ex * G / 2 - x0) / G), j = Math.floor((p.z + uz * t + ez * G / 2 - z0) / G);
          if (i >= 0 && j >= 0 && i < nx && j < nz) { free[i * nz + j] = 0; wallm[i * nz + j] = 1; }
        }
      } else if (role === 'stair' || (role === 'fence' && b.y0 > y - 0.3)) {
        for (let i = Math.max(0, Math.floor((b.x0 - x0) / G)); i < Math.min(nx, Math.ceil((b.x1 - x0) / G)); i++)
          for (let j = Math.max(0, Math.floor((b.z0 - z0) / G)); j < Math.min(nz, Math.ceil((b.z1 - z0) / G)); j++) free[i * nz + j] = 0;
      }
    });
    // only the floor under a roof or an upper floor (rooms, halls, porches), or raised floor outside
    const use = new Uint8Array(N);
    const over = new Uint8Array(N);
    if (!raised) pieces.forEach((p, n) => {
      const b = boxes[n], role = b.info.role;
      if (p.decor || !['roof', 'roofTop', 'roofCorner', 'floor'].includes(role) || b.y0 < y + 1.5 || b.y0 > y + 14) return;
      for (let i = Math.max(0, Math.floor((b.x0 - x0) / G)); i < Math.min(nx, Math.ceil((b.x1 - x0) / G)); i++)
        for (let j = Math.max(0, Math.floor((b.z0 - z0) / G)); j < Math.min(nz, Math.ceil((b.z1 - z0) / G)); j++) over[i * nz + j] = 1;
    });
    // (roof pieces turned round a crown leave thin gaps between their boxes: a metre round each closes them)
    if (!raised) {
      const o2 = new Uint8Array(N);
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        if (!over[i * nz + j]) continue;
        for (let a = Math.max(0, i - 4); a <= Math.min(nx - 1, i + 4); a++) for (let c = Math.max(0, j - 4); c <= Math.min(nz - 1, j + 4); c++) o2[a * nz + c] = 1;
      }
      over.set(o2);
    }
    // on the ground, a floor between walls on three sides or more (rooms, halls, a passage with a door at its end);
    // an open porch or stoop with the house wall behind it is an entrance, its depth the porch's own choice
    const walled = (i, j) => {
      let n = 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        for (let t = 1; t <= 56; t++) { const a = i + di * t, c = j + dj * t; if (a < 0 || c < 0 || a >= nx || c >= nz) break; if (wallm[a * nz + c]) { n++; break; } }
      }
      return n >= 3;
    };
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const k = i * nz + j; if (free[k] && (raised || (over[k] && walled(i, j)))) use[k] = 1; }
    // distance (chamfer 3-4, in metres) from every usable cell to the nearest unusable one
    const dist = (src, edge) => {
      const d = new Float32Array(N);
      for (let k = 0; k < N; k++) d[k] = src[k] ? 1e9 : 0;
      const a = G, bD = G * Math.SQRT2;
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const k = i * nz + j; if (!d[k]) continue;
        let v = d[k];
        if (i > 0) { v = Math.min(v, d[k - nz] + a); if (j > 0) v = Math.min(v, d[k - nz - 1] + bD); if (j < nz - 1) v = Math.min(v, d[k - nz + 1] + bD); } else if (edge) v = Math.min(v, a);
        if (j > 0) v = Math.min(v, d[k - 1] + a); else if (edge) v = Math.min(v, a);
        d[k] = v;
      }
      for (let i = nx - 1; i >= 0; i--) for (let j = nz - 1; j >= 0; j--) {
        const k = i * nz + j; if (!d[k]) continue;
        let v = d[k];
        if (i < nx - 1) { v = Math.min(v, d[k + nz] + a); if (j > 0) v = Math.min(v, d[k + nz - 1] + bD); if (j < nz - 1) v = Math.min(v, d[k + nz + 1] + bD); } else if (edge) v = Math.min(v, a);
        if (j < nz - 1) v = Math.min(v, d[k + 1] + a); else if (edge) v = Math.min(v, a);
        d[k] = v;
      }
      return d;
    };
    const dIn = dist(use, true);
    const notCentre = new Uint8Array(N);
    for (let k = 0; k < N; k++) notCentre[k] = use[k] && dIn[k] >= R ? 0 : 1;
    const dC = dist(notCentre, false);
    const narrow = new Uint8Array(N);
    for (let k = 0; k < N; k++) if (use[k] && dC[k] > R + G) narrow[k] = 1;
    // pieces of narrow floor
    const seen = new Uint8Array(N);
    for (let k0 = 0; k0 < N; k0++) {
      if (!narrow[k0] || seen[k0]) continue;
      const st = [k0]; seen[k0] = 1; let n = 0, bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
      while (st.length) {
        const k = st.pop(); n++;
        const i = Math.floor(k / nz), j = k % nz;
        bx0 = Math.min(bx0, cx(i)); bx1 = Math.max(bx1, cx(i)); bz0 = Math.min(bz0, cz(j)); bz1 = Math.max(bz1, cz(j));
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const a = i + di, c = j + dj;
          if (a < 0 || c < 0 || a >= nx || c >= nz) continue;
          const kk = a * nz + c;
          if (narrow[kk] && !seen[kk]) { seen[kk] = 1; st.push(kk); }
        }
      }
      const area = n * G * G;
      // a passage runs on: leftovers in the corners of a room, by a post or a doorway are short
      const len = Math.max(bx1 - bx0, bz1 - bz0) + G;
      if (area > (opts.min != null ? opts.min : PASSAGE_CLOSET) && len >= PASSAGE_LONG) out.push({ y, area: +area.toFixed(1), x0: +bx0.toFixed(1), x1: +bx1.toFixed(1), z0: +bz0.toFixed(1), z1: +bz1.toFixed(1), raised });
    }
  }
  return out;
}

// Doorways clear and stepped (D-096; Tyler, showcase review 2026-11-11: a beam across a doorway stopped him at the door of a
// Meadows home, "something we discussed and resolved days ago"). Through every door and every opening a door piece
// stands in, a lane 0.9 m wide from a metre outside to a metre inside: with the game's colliders, nothing solid from
// 0.25 m over the walking surface to the opening's top (2 m) or DOOR_CLEAR beyond the frame, and the surface itself
// steps no more than DOOR_STEP from one 0.2 m sample to the next (a beam laid across the threshold, a log or a raised
// sill). A stair is a way up and counts as surface. Returns a list of problems: { door, at, what }.
// DOOR_STEP is the rise the generator builds treads to; the check fails a step over DOOR_STEP_MAX (a log across a
// threshold stood 0.45 to 0.64 m over the ground outside it).
const DOOR_STEP = 0.3, DOOR_STEP_MAX = 0.4;
const PLANT_FALL = /^(Pickable_(Dandelion|Onion|Thistle|Carrot|Turnip|Mushroom)|Vineberry|Bush01|Bush02_en|RaspberryBush|BlueberryBush|CloudberryBush|shrub_2_heath)$/;
function doorways(pieces, opts = {}) {
  const boxes = pieces.map(gameBox), near = index(boxes), out = [];
  // the game's ground: the mod sets a design's lowest pivot on the terrain (src/Villheim.Logic/Designs/Blueprints.cs,
  // the lowest piece at y = 0), so a bush or a stone floor sunk under the house floor lifts the house that much over it
  const ground = opts.ground != null ? opts.ground : Math.min(0, ...pieces.map(p => p.y));
  pieces.forEach((d, n) => {
    if (boxes[n].info.role !== 'door') return;
    const o = PC.doorOpening(d);
    if (o.w < 1.2) return;
    // the walking surface along the lane's middle line, and what stands over it
    let last = null;
    for (let si = -5; si <= 5; si++) {
      const s = si / 5, inPlane = Math.abs(s) < 0.55, top = o.y + (inPlane ? Math.min(o.h, DOOR_CLEAR) : DOOR_CLEAR);
      let surf = -Infinity;
      for (const t of [-0.3, 0, 0.3]) {
        const x = o.x + o.nx * s + o.ux * t, z = o.z + o.nz * s + o.uz * t;
        const col = ptBox(x, o.y - 0.8, o.y + 0.6, z, 0.02);
        let here = Math.abs(s) < 0.3 ? o.y : ground; // the sill of the opening itself
        for (const j of near(col, 0)) {
          if (j === n) continue;
          const b = boxes[j];
          if (b.pass || ['rug', 'nature', 'misc', 'door', 'light', 'deco'].includes(b.info.role) || pieces[j].decor && !b.info.structural) continue;
          const tp = b.sol && b.sol.length ? SHP.topAt(b.sol, x, z) : (b.x0 <= x && x <= b.x1 && b.z0 <= z && z <= b.z1 ? b.y1 : null);
          if (tp != null && tp <= o.y + 0.6 && tp > here) here = tp;
        }
        surf = Math.max(surf, here);
      }
      if (last != null && surf - last > DOOR_STEP_MAX && !opts.noStep) out.push({ door: d.name, at: +s.toFixed(1), what: `a step of ${(surf - last).toFixed(2)} m` });
      if (last != null && last - surf > DOOR_STEP_MAX && !opts.noStep) out.push({ door: d.name, at: +s.toFixed(1), what: `a drop of ${(last - surf).toFixed(2)} m` });
      last = surf;
      // nothing solid over the surface up to the top
      for (const t of [-0.45, 0, 0.45]) {
        const x = o.x + o.nx * s + o.ux * t, z = o.z + o.nz * s + o.uz * t;
        const col = ptBox(x, surf + 0.25, top - 0.03, z, 0.02);
        for (const j of near(col, 0)) {
          if (j === n) continue;
          const b = boxes[j], role = b.info.role;
          if (b.pass || ['rug', 'door', 'nature', 'misc'].includes(role)) continue;
          if (role === 'stair') continue;
          if (blocks(col, b, -0.01)) { out.push({ door: d.name, at: +s.toFixed(1), what: pieces[j].name }); break; }
        }
      }
    }
  });
  const seen = new Set();
  return out.filter(p => { const k = p.door + p.what; if (seen.has(k)) return false; seen.add(k); return true; });
}

// Pasture fences (Tyler, showcase review 2026-11-11): wood_fence is "really only intended for pastures, garden fences,
// maybe village perimeter fencing. Never for building fences atop towers, etc. and certainly never indoors." A
// wood_fence whose foot is 0.6 m or more over the ground, or that stands under a roof or floor, fails.
function pastureFences(pieces, opts = {}) {
  const boxes = pieces.map(catBox), near = index(boxes), out = [], walls = wallGrid(pieces, boxes);
  // (the lab's ground: a design lifted by a piece sunk under it is the ground check's matter, lab/shell_ground.js)
  const ground = opts.ground != null ? opts.ground : 0;
  pieces.forEach((p, i) => {
    if (p.name !== 'wood_fence') return;
    if (boxes[i].y0 > ground + 0.6) { out.push(`${p.name} ${(boxes[i].y0 - ground).toFixed(1)} m up`); return; }
    // indoors: under a roof or floor and between walls (an eave over a yard fence is outdoors)
    if (!walls.inside(p.x, boxes[i].y0 + 0.1, p.z)) return;
    const col = ptBox(p.x, boxes[i].y1 + 0.3, boxes[i].y1 + 12, p.z, 0.05);
    for (const j of near(col, 0)) {
      const r = boxes[j].info.role;
      if (['roof', 'roofTop', 'roofCorner', 'floor'].includes(r) && !pieces[j].decor && touch(col, boxes[j], 0)) { out.push(`${p.name} indoors`); break; }
    }
  });
  return out;
}

// Crossed boards on a gable (wood_wall_roof_top_45, wood_wall_roof_top): corpus builders run their boards on in line
// with the sloped bargeboards beside them (lab/shell_mine.js: of 5,042 sloped 45 degree beams in a cross's plane
// within 3.2 m, 1,881 lie on a board's line and nearly all the rest 2 m or more off it, the next bargeboard row). A
// cross with sloped beams of its pitch in its plane and none on a board's line fails (showcase 13: a metre under it).
function crossedBoards(pieces) {
  const out = [];
  for (const c of pieces) {
    const m = c.name === 'wood_wall_roof_top_45' ? 1 : c.name === 'wood_wall_roof_top' ? 0.5 : 0;
    if (!m) continue;
    const a = yawDeg(c) * Math.PI / 180, ux = Math.cos(a), uz = -Math.sin(a), nx = Math.sin(a), nz = Math.cos(a);
    let any = 0, inLine = 0;
    for (const q of pieces) {
      if (q === c || !(m === 1 ? /beam_45$/ : /beam_26$/).test(q.name)) continue;
      const dx = q.x - c.x, dz = q.z - c.z, dy = q.y - c.y;
      if (Math.hypot(dx, dz) > 3.2 || Math.abs(dy) > 3.2) continue;
      const along = dx * ux + dz * uz, norm = dx * nx + dz * nz, rel = ((yawDeg(q) - yawDeg(c)) % 360 + 360) % 360;
      if (Math.abs(norm) > 0.35 || Math.round(rel) % 180 !== 0) continue;
      // a wood beam's pivot is its middle; the board's line through the crossing (m over the pivot) at slope +-m
      const sg = Math.round(rel) % 360 === 0 ? 1 : -1;
      const yMid = /^wood_beam_26$/.test(q.name) ? dy + 0.5 : dy;
      any++;
      if (Math.abs(yMid - sg * m * along - m) < 0.2) inLine++;
    }
    if (any && !inLine) out.push(`${c.name} at ${c.x.toFixed(1)},${c.y.toFixed(1)},${c.z.toFixed(1)}`);
  }
  return out;
}

// Wall tops meet the roof (Tyler, showcases 03 and 15: "gaps up top on the wall that dont complete the wall-to-roof
// connection"). Along each outside wall or gable piece (floor on one side of it only), at its ends and middle: when
// the next solid straight over its top is a roof piece, it is no more than WALL_GAP m higher, unless a window or door
// is in between. Returns the gaps found.
const WALL_GAP = 0.25;
function wallTops(pieces) {
  const boxes = pieces.map(gameBox), near = index(boxes), out = [];
  // (a smoke louver's raised caps over a fire are open at the sides on purpose)
  const fires = pieces.filter(p => PC.piece(p.name).role === 'fire' || /fire_pit|hearth|bonfire/.test(p.name));
  const floorAt = (x, z, y1) => { for (const j of near(ptBox(x, y1 - 4.5, y1, z), 0)) { const b = boxes[j]; if (b.info.role === 'floor' && !pieces[j].decor && b.x0 <= x && x <= b.x1 && b.z0 <= z && z <= b.z1 && b.y1 < y1 && b.y1 > y1 - 4.5) return true; } return false; };
  pieces.forEach((p, n) => {
    const b = boxes[n], role = b.info.role;
    if (p.decor || !['wall', 'window', 'gable'].includes(role) || tilted(p.q) || /arch/.test(p.name)) return;
    const a = yawDeg(p) * Math.PI / 180, ux = Math.cos(a), uz = -Math.sin(a), w = b.info.size[0];
    if (floorAt(p.x - uz, p.z + ux, b.y1) && floorAt(p.x + uz, p.z - ux, b.y1)) return;
    for (const t of [-w / 2 + 0.25, 0, w / 2 - 0.25]) {
      const x = p.x + ux * t, z = p.z + uz * t, top = b.y1;
      let next = Infinity, by = -1;
      for (const j of near(ptBox(x, top + 0.02, top + 4, z), 0)) {
        if (j === n || pieces[j].decor || boxes[j].pass) continue;
        const o = boxes[j];
        let y0 = null;
        if (o.sol && o.sol.length) { for (const sd of o.sol) { const sp = SHP.spanY(sd, x, z); if (sp && sp[1] > top - 0.05 && (y0 == null || sp[0] < y0)) y0 = sp[0]; } }
        else if (o.x0 <= x && x <= o.x1 && o.z0 <= z && z <= o.z1 && o.y1 > top) y0 = o.y0;
        if (y0 != null && y0 < next) { next = Math.max(y0, top); by = j; }
      }
      if (!isFinite(next) || next - top <= WALL_GAP || !['roof', 'roofTop', 'roofCorner'].includes(boxes[by].info.role)) continue;
      if (fires.some(f => Math.hypot(f.x - x, f.z - z) < 4)) continue; // (and a smoke shaft's boards end under the ridge)
      const opening = pieces.some((q, m) => m !== n && ['window', 'door'].includes(boxes[m].info.role) && boxes[m].x0 <= x + 0.3 && boxes[m].x1 >= x - 0.3 && boxes[m].z0 <= z + 0.3 && boxes[m].z1 >= z - 0.3 && boxes[m].y0 < next && boxes[m].y1 > top);
      if (!opening) out.push({ name: p.name, x: +x.toFixed(1), y: +top.toFixed(2), z: +z.toFixed(1), gap: +(next - top).toFixed(2), under: pieces[by].name });
    }
  });
  return out;
}

// The game's own support rule (WearNTear.UpdateSupport in assembly_valheim, decompiled 2026-11-12). A piece looks at
// every collider that reaches into its own colliders grown by 0.15 m on each side. The ground gives the material's
// max. From each touching piece it may take that piece's support less its own material's horizontal loss times the
// distance between the two pivots (plus 0.1 m), whichever way the other piece lies, above included; from a piece whose
// nearest point lies under its pivot, the loss is blended toward the vertical loss by how steeply down that point
// lies, again times the distance. Two such points on opposite sides (100 degrees or more apart seen from above) give
// the mean of their vertical values (a span between two posts). It falls under its material's min. Because the loss
// grows with the distance between pivots, a 2 m piece loses twice what a 1 m piece loses per step, and long pieces
// hung off one end (a roof row, a beam out from a wall) lose the most. Pivots stand in for the centre of mass (the
// prefabs' m_comOffset is not measured). Returns the support per piece (NaN for pieces the rule skips) and the ones
// that fall.
const GAME_LOSS = {
  wood: { max: 100, min: 10, v: 0.125, h: 0.2 }, hardwood: { max: 140, min: 10, v: 0.1, h: 1 / 6 },
  stone: { max: 1000, min: 100, v: 0.125, h: 1 }, iron: { max: 1500, min: 20, v: 1 / 13, h: 1 / 13 },
  marble: { max: 1500, min: 100, v: 0.125, h: 0.5 }, ashstone: { max: 2000, min: 100, v: 0.1, h: 1 / 3 },
};
function gameSupport(pieces, opts = {}) {
  const n = pieces.length, sol = new Array(n), grown = new Array(n), mat = new Array(n), bb = new Array(n);
  for (let i = 0; i < n; i++) {
    const p = pieces[i], info = PC.piece(p.name);
    if (!info.structural || p.decor) continue;
    let W = SHP && SHP.world(p);
    if (!W || !W.length) W = SHP ? [SHP.boxOf(catBox(p))] : null;
    if (!W) continue;
    sol[i] = W;
    mat[i] = GAME_LOSS[PC.supportClass(p.name)] || GAME_LOSS.wood;
    grown[i] = W.map(o => { const h = o.h.map(v => v + 0.15), g = { c: o.c, a: o.a, h }; const e = [0, 1, 2].map(k => Math.abs(o.a[0][k]) * h[0] + Math.abs(o.a[1][k]) * h[1] + Math.abs(o.a[2][k]) * h[2]); return Object.assign(g, { x0: o.c[0] - e[0], x1: o.c[0] + e[0], y0: o.c[1] - e[1], y1: o.c[1] + e[1], z0: o.c[2] - e[2], z1: o.c[2] + e[2] }); });
    const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
    for (const o of grown[i]) { b.x0 = Math.min(b.x0, o.x0); b.x1 = Math.max(b.x1, o.x1); b.y0 = Math.min(b.y0, o.y0); b.y1 = Math.max(b.y1, o.y1); b.z0 = Math.min(b.z0, o.z0); b.z1 = Math.max(b.z1, o.z1); }
    bb[i] = b;
  }
  const list = [];
  for (let i = 0; i < n; i++) if (sol[i]) list.push(i);
  const ys = list.map(i => Math.min(...sol[i].map(o => o.y0))).sort((a, b) => a - b);
  // the lab's ground is y = 0 (floors on the ground stand there; stone floors and footings go half into it), or lower
  // when the whole design stands lower
  const ground = opts.ground != null ? opts.ground : Math.max(0, ys.length ? ys[Math.floor(ys.length * 0.02)] : 0);
  const boxes = new Array(n);
  for (const i of list) boxes[i] = bb[i];
  const fake = boxes.map(b => b || { x0: 1e9, x1: 1e9, z0: 1e9, z1: 1e9 });
  const near = index(fake);
  // the ways each piece can take support: [other, horizontal factor, vertical factor or -1, support point dir x, z]
  const ways = new Array(n), grounded = new Uint8Array(n);
  const closest = (o, q) => { const d = [q[0] - o.c[0], q[1] - o.c[1], q[2] - o.c[2]]; const r = [...o.c]; for (let k = 0; k < 3; k++) { const t = Math.max(-o.h[k], Math.min(o.h[k], d[0] * o.a[k][0] + d[1] * o.a[k][1] + d[2] * o.a[k][2])); r[0] += o.a[k][0] * t; r[1] += o.a[k][1] * t; r[2] += o.a[k][2] * t; } return r; };
  for (const i of list) {
    const p = pieces[i], m = mat[i], com = [p.x, p.y, p.z], W = [];
    if (bb[i].y0 <= ground + 0.02) grounded[i] = 1;
    for (const j of near(bb[i], 0)) {
      if (j === i || !sol[j]) continue;
      const q = pieces[j], dist = Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z) + 0.1;
      for (const o of sol[j]) {
        if (!grown[i].some(g => SHP.hit(g, o))) continue;
        const hf = 1 - m.h * dist;
        const pt = closest(o, com);
        let vf = -1, dx = 0, dz = 0, item = -1;
        if (pt[1] < com[1] + 0.05) {
          const d = [pt[0] - com[0], pt[1] - com[1], pt[2] - com[2]], l = Math.hypot(d[0], d[1], d[2]) || 1;
          if (d[1] / l < 0) { const t = Math.acos(1 - Math.abs(d[1] / l)) / (Math.PI / 2); vf = 1 - (m.h + (m.v - m.h) * t) * dist; }
          item = 1 - m.v * dist; dx = d[0]; dz = d[2];
        }
        W.push([j, hf, vf, item, dx, dz]);
      }
    }
    ways[i] = W;
  }
  const s = new Float64Array(n).fill(NaN);
  for (const i of list) s[i] = grounded[i] ? mat[i].max : 0;
  for (let sweep = 0; sweep < 400; sweep++) {
    let moved = 0;
    for (const i of list) {
      if (grounded[i]) continue;
      let best = 0;
      const pts = [];
      for (const [j, hf, vf, item, dx, dz] of ways[i]) {
        const sj = s[j];
        if (!(sj > 0)) continue;
        best = Math.max(best, sj * hf);
        if (vf > -1) best = Math.max(best, sj * vf);
        if (item > -1) pts.push([sj * item, dx, dz]);
      }
      for (let a = 0; a < pts.length - 1; a++) for (let c = a + 1; c < pts.length; c++) {
        const mean = (pts[a][0] + pts[c][0]) / 2;
        if (mean <= best) continue;
        const la = Math.hypot(pts[a][1], pts[a][2]), lc = Math.hypot(pts[c][1], pts[c][2]);
        if (la < 1e-6 || lc < 1e-6) continue;
        const cos = (pts[a][1] * pts[c][1] + pts[a][2] * pts[c][2]) / (la * lc);
        if (Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI >= 100) best = mean;
      }
      const v = Math.min(best, mat[i].max);
      if (Math.abs(v - s[i]) > 1e-4) { moved++; s[i] = v; }
    }
    if (!moved) break;
  }
  const fall = list.filter(i => s[i] < mat[i].min - 1e-6);
  return { support: s, fall, ground };
}

// A loft under the roof (storeys track, 2026-11-11): on an upper floor, a point under a roof slope may be lower than
// the headroom where people stand up close by: the roof over it is at least LOFT_LOW over the floor, and a point of
// the same floor with full headroom (and walls) lies within LOFT_REACH. People walk where they can stand; the low
// edges under the slope hold beds and chests (corpus: 21 % of Norse beds stand under a roof slope, culture-corpus
// summary.json relx bedsUnderSlope). LOFT_LOW and LOFT_REACH are settings.
const LOFT_LOW = 1.0, LOFT_REACH = 3.0;
function underSlopeOK(L, stand, ground) {
  const { pt, lowest, slope } = L;
  if (!slope || pt.y < ground + 1.5 || lowest - pt.y < LOFT_LOW) return false;
  return stand.some(q => Math.abs(q.y - pt.y) < 0.05 && Math.hypot(q.x - pt.x, q.z - pt.z) <= LOFT_REACH);
}

// opts.shapes: use the game's colliders (lib/shapes.js) for boxes, overlaps, doorways, headroom and climbs
function check(design, biome, opts = {}) {
  const pieces = design.pieces;
  const useShapes = opts.shapes != null ? !!opts.shapes : SHAPES_DEFAULT;
  const boxes = pieces.map(useShapes && SHP ? aabbShapes : catBox);
  // support and stability: the catalog box and the solids together, so a collider that leaves out legs or a base
  // never cuts a piece off; the index uses the same, larger boxes
  const held_ = useShapes && SHP ? pieces.map(gameBox) : boxes;
  const near = index(held_);
  const ys = held_.filter(b => b.info.structural).map(b => b.y0).sort((a, b) => a - b);
  const ground = design.ground != null ? design.ground : ys.length ? ys[Math.floor(ys.length * 0.02)] : 0;
  const results = [];

  // support: Valheim holds a piece up through any touching piece that is itself held up, back to the ground.
  // Walk outward from everything that stands on the ground; whatever is never reached floats.
  const held = new Array(boxes.length).fill(false), queue = [];
  held_.forEach((b, i) => { if (b.y0 <= ground + 0.35) { held[i] = true; queue.push(i); } });
  while (queue.length) {
    const i = queue.pop(), b = held_[i];
    for (const j of near(b)) {
      if (held[j]) continue;
      const o = held_[j];
      // furniture holds what stands on it (a chest on a chest, a pot on a crate): Valheim's furniture carries load
      const onTop = !b.info.structural && o.y0 >= b.y1 - 0.15 && o.y0 <= b.y1 + 0.16 && o.x0 < b.x1 && o.x1 > b.x0 && o.z0 < b.z1 && o.z1 > b.z0;
      if (touch(b, o, 0.16) && (b.info.structural || onTop || o.info.role === 'craft' || o.info.role === 'deco' || o.info.role === 'light')) { held[j] = true; queue.push(j); }
    }
  }
  const unsupported = pieces.filter((p, i) => !held[i] && (boxes[i].info.structural || ['craft', 'storage', 'bed', 'table', 'seat', 'fire'].includes(boxes[i].info.role))).map(p => p.name);
  results.push({ check: 'support', ok: unsupported.length === 0, detail: unsupported.length ? `${unsupported.length} pieces not connected to the ground (${[...new Set(unsupported)].slice(0, 4).join(', ')})` : 'every piece connects to the ground' });

  // stability: Valheim's support by material, from the ground up (pieces.js SUPPORT). Each piece takes the best
  // support any touching piece below or beside it passes on: that piece's support less the share the receiving
  // material loses that way (straight down: vertical loss; sideways: horizontal loss; in between, a blend), never more
  // than its own material's max. Under its material's min it falls.
  const crumble = stability(pieces, held_, near, ground);
  results.push({ check: 'stability', ok: crumble.length === 0,
    detail: crumble.length ? `${crumble.length} pieces would fall (${[...new Set(crumble.map(i => pieces[i].name))].slice(0, 4).join(', ')})` : 'every piece holds by its material' });

  // doubles and crushed pieces
  let doubles = 0, crushed = 0;
  const seen = new Map();
  pieces.forEach((p, i) => {
    const key = `${p.name}|${p.x.toFixed(1)}|${p.y.toFixed(1)}|${p.z.toFixed(1)}|${Math.round(yawOf(p.q))}`;
    if (seen.has(key)) doubles++; else seen.set(key, i);
    const b = boxes[i];
    if (!b.info.structural || ['roof', 'roofTop', 'roofCorner', 'gable', 'beam', 'pole', 'stair'].includes(b.info.role)) return;
    for (const j of near(b)) {
      if (j <= i) continue;
      const o = boxes[j];
      if (o.info.role !== b.info.role || !o.info.structural) continue;
      const solid = b.sol && o.sol && b.sol.length && o.sol.length;
      if (solid && !touch(b, o, -0.02)) continue;
      const v = solid ? SHP.overlapVolume(b.sol, o.sol) : inter(b, o), m = solid ? Math.min(SHP.volume(b.sol), SHP.volume(o.sol)) : Math.min(vol(b), vol(o));
      if (m > 0.05 && v / m > 0.6 && pieces[j].name !== p.name) crushed++;
    }
  });
  // with shapes: furniture whose solids reach into a wall, door, post or other furniture (it clips in the game)
  const clips = [];
  if (useShapes) {
    const FURN = ['bed', 'table', 'seat', 'storage', 'craft', 'fire'], HARD = ['wall', 'door', 'window', 'pole', 'stair', 'gable'];
    pieces.forEach((p, i) => {
      const b = boxes[i];
      if (!FURN.includes(b.info.role) || !b.sol || !b.sol.length) return;
      const v0 = SHP.volume(b.sol);
      for (const j of near(b, 0)) {
        if (j === i) continue;
        const o = boxes[j];
        if (!o.sol || !o.sol.length || !(HARD.includes(o.info.role) || (FURN.includes(o.info.role) && j > i))) continue;
        // a station's extensions stand against it in the game
        if (/_ext\d/.test(pieces[i].name) || /_ext\d/.test(pieces[j].name)) continue;
        // cooking stations and cauldrons stand over the fire
        if ((b.info.role === 'fire' || o.info.role === 'fire') && /cookingstation|cauldron/.test(pieces[i].name + pieces[j].name)) continue;
        if (!touch(b, o, -0.03)) continue;
        // a clip made on purpose (lib/kitbash.js marks it with the depth its source builds used) is allowed that deep
        const allow = Math.max(p.clip || 0, pieces[j].clip || 0);
        if (allow > 0 && SHP.clipDepth(b.sol, o.sol) <= allow + 0.02) continue;
        // yard pieces: a marked clip whose shallowest way out of the overlap is within the mark (lib/yards.js)
        const mark = Math.min(CLIP_MAX, allow);
        if (mark > 0 && Math.min(Math.min(b.x1, o.x1) - Math.max(b.x0, o.x0), Math.min(b.z1, o.z1) - Math.max(b.z0, o.z0), Math.min(b.y1, o.y1) - Math.max(b.y0, o.y0)) <= mark) continue;
        const v = SHP.overlapVolume(b.sol, o.sol);
        if (v > 0.03 && v > 0.08 * Math.min(v0, SHP.volume(o.sol))) clips.push([i, j, v]);
      }
    });
  }
  const clipNames = [...new Set(clips.map(([i, j]) => `${pieces[i].name} in ${pieces[j].name}`))];
  results.push({ check: 'overlap', ok: doubles === 0 && crushed <= 2 && clips.length === 0, clips: clips.map(([i, j, v]) => ({ a: i, b: j, v: +v.toFixed(3) })),
    detail: `${doubles} doubled, ${crushed} pieces inside another of the same kind` + (useShapes ? `, ${clips.length} furniture clipping${clipNames.length ? ` (${clipNames.slice(0, 3).join('; ')})` : ''}` : '') });

  // doors: nothing in the doorway or in the metre in front and behind it up to 2.3 m, and something to step on
  const doors = pieces.map((p, i) => i).filter(i => boxes[i].info.role === 'door');
  const blockedBy = new Set();
  let blocked = 0, noStep = 0;
  const pts = floorPoints(pieces, boxes);
  const standAt = (x, y, z) => {
    if (y <= ground + 0.6) return true;
    const col = ptBox(x, y - 0.7, y + 0.3, z, 0.3);
    for (const j of near(col, 0)) {
      const b = boxes[j];
      if (!['floor', 'stair'].includes(b.info.role) && !(b.info.role === 'wall' && b.y1 <= y + 0.05)) continue;
      if (touch(col, b, 0)) return true;
    }
    return false;
  };
  for (const i of doors) {
    const o = PC.doorOpening(pieces[i]);
    const hit = doorBlockers(o, pieces, boxes, near, j => j === i);
    if (hit.length) { blocked++; hit.forEach(j => blockedBy.add(pieces[j].name)); }
    for (const sg of [-1, 1]) if (!standAt(o.x + o.nx * sg * 0.9, o.y, o.z + o.nz * sg * 0.9)) noStep++;
  }
  results.push({ check: 'doors', ok: blocked === 0 && noStep === 0,
    detail: doors.length ? `${doors.length} doors, ${blocked} blocked${blockedBy.size ? ` (${[...blockedBy].slice(0, 4).join(', ')})` : ''}, ${noStep} sides with nothing to step on` : 'no doors (open building)' });

  // headroom: every floor point inside walls has 2.4 m clear under roofs, ceilings and beams; points right against a
  // wall are left out (nobody stands in the wall)
  const walls = wallGrid(pieces, boxes);
  let low = 0, inside = 0;
  const lowBy = new Set(), where = [], stand = [], lows = [], open = [];
  for (const pt of pts) {
    // the lowest roof or ceiling over the point; a floor open to the sky (a roof terrace, a yard) is left out
    const col = ptBox(pt.x, pt.y + 0.05, pt.y + 30, pt.z);
    let lowest = Infinity, by = null;
    for (const j of near(col, 0)) {
      if (j === pt.floor) continue;
      const u = undersideOf(pieces[j], pt.x, pt.z, boxes[j]);
      // what is less than 0.5 m over the floor is a kerb, sill or dais on it, never the ceiling (with the game's
      // colliders a beam laid on the floor shows 5 cm over it)
      // a furnishing's piece (p.decor) under 1.8 m is furniture people walk round (a beam laid on a half wall and a
      // chest as a counter top, creative set KC-100), never the ceiling; one hung higher still counts
      if (u != null && pieces[j].decor && u < pt.y + 1.8) continue;
      if (u != null && u > pt.y + (useShapes ? 0.5 : 0.05) && u < lowest) { lowest = u; by = pieces[j].name; }
    }
    if (!isFinite(lowest)) { if (walls.inside(pt.x, pt.y, pt.z) && !walls.near(pt.x, pt.y, pt.z, 0.45)) open.push(pt); continue; }
    if (!walls.inside(pt.x, pt.y, pt.z) || walls.near(pt.x, pt.y, pt.z, 0.45)) continue;
    inside++;
    let bad = lowest < pt.y + HEADROOM - 0.01 ? by : null;
    // walls at least 2.5 m tall: a point beside a wall needs wall at that height too (from the floor piece's middle)
    if (!bad && walls.near(pt.x, pt.y, pt.z, 1.0, 0.6, 1.9) && !walls.near(pt.x, pt.y - 0.15, pt.z, 1.6, WALL_MIN - 0.05)) bad = 'walls under 2.5 m';
    if (!bad) stand.push(pt);
    else lows.push({ pt, bad, lowest, slope: by && ['roof', 'roofCorner', 'roofTop'].includes(PC.piece(by).role) });
  }
  for (const L of lows) {
    if (underSlopeOK(L, stand, ground)) continue;
    const { pt, bad } = L;
    low++; lowBy.add(bad); if (where.length < 6) where.push({ x: +pt.x.toFixed(2), y: +pt.y.toFixed(2), z: +pt.z.toFixed(2), under: bad });
  }
  // holes in the roof (Tyler, showcase 09: "gaps and holes in the ceiling, roof pieces dont connect"): a floor point
  // inside walls with nothing over it while roofed points of the same floor lie on all four sides of it within
  // ROOF_HOLE m. The edge of a court's yard has roof on one side only; a smoke hole over a fire is meant.
  const roofed = new Set([...stand, ...lows.map(L => L.pt)].map(q => `${Math.round(q.x * 2)},${Math.round(q.y * 20)},${Math.round(q.z * 2)}`));
  const fires = pieces.filter(p => PC.piece(p.name).role === 'fire' || /fire_pit|hearth|bonfire/.test(p.name));
  const holes = open.filter(pt => {
    if (fires.some(f => Math.hypot(f.x - pt.x, f.z - pt.z) < 2.6)) return false;
    const ky = Math.round(pt.y * 20);
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dz]) => {
      for (let t = 0.5; t <= ROOF_HOLE + 1e-6; t += 0.5) if (roofed.has(`${Math.round((pt.x + dx * t) * 2)},${ky},${Math.round((pt.z + dz * t) * 2)}`)) return true;
      return false;
    });
  });
  results.push({ check: 'roof holes', ok: holes.length === 0, detail: holes.length ? `${holes.length} floor points inside walls open to the sky with roof all round (${holes.slice(0, 3).map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`).join('; ')})` : 'no holes in the roof' });
  results.push({ check: 'headroom', ok: low === 0, where,
    detail: low ? `${low} of ${inside} floor points under ${HEADROOM} m or by low walls (${[...lowBy].slice(0, 4).join(', ')})` : `${inside} floor points inside, all with ${HEADROOM} m or more and walls of ${WALL_MIN} m or more` });

  // ladders and stairs: room to stand at the foot, a floor to step onto at the top, and the climb itself clear
  const ls = climbs(pieces);
  const climbIdx = new Set(ls.map(L => L.n));
  const problems = [];
  for (const L of ls) {
    const name = L.p.name;
    if (!L.continuesBelow) {
      // a metre of clear floor (or ground) in front of the foot
      let clear = true;
      for (let t = 0.2; t <= 1.0 + 0.001; t += 0.4) {
        const x = L.bx - L.dx * t, z = L.bz - L.dz * t;
        if (!standAt(x, L.by + 0.05, z)) clear = false;
        const col = ptBox(x, L.by + 0.3, L.by + 1.8, z, 0.3);
        for (const j of near(col, 0)) {
          if (climbIdx.has(j)) continue;
          const b = boxes[j];
          if (['floor', 'rug', 'nature', 'misc'].includes(b.info.role) || b.pass) continue;
          const u = undersideOf(pieces[j], x, z, b);
          if (u != null ? u > col.y0 && u < col.y1 : blocks(col, b, -0.02)) { clear = false; break; }
        }
      }
      if (!clear) problems.push(`${name}: no room at the foot`);
    }
    if (!L.continuesAbove) {
      const x = L.tx + L.dx * 0.5, z = L.tz + L.dz * 0.5;
      if (!standAt(x, L.ty + 0.1, z)) problems.push(`${name}: nothing to step onto at the top`);
    }
    // head room along the climb: nothing over the steps lower than 1.9 m above them
    let hit = null;
    for (let t = 0.25; t <= L.run - 0.25 + 0.001 && !hit; t += 0.25) {
      const x = L.bx + L.dx * t, z = L.bz + L.dz * t, y = L.by + t * L.rise / L.run;
      const col = ptBox(x, y + 0.3, y + 1.9, z, 0.23);
      for (const j of near(col, 0)) {
        if (climbIdx.has(j)) continue;
        const b = boxes[j];
        if (!b.info.structural || ['door', 'stair'].includes(b.info.role)) continue;
        if (b.info.role === 'floor' && b.y1 <= y + 0.35) continue; // the landing at the top
        const u = undersideOf(pieces[j], x, z, b);
        if (u != null ? u > col.y0 && u < col.y1 : blocks(col, b, -0.02)) { hit = pieces[j].name; break; }
      }
    }
    if (hit) problems.push(`${name}: ${hit} over the climb`);
  }
  results.push({ check: 'ladders', ok: problems.length === 0,
    detail: ls.length ? (problems.length ? `${problems.length} problems: ${[...new Set(problems)].slice(0, 3).join('; ')}` : `${ls.length} ladder and stair pieces, all climbable`) : 'no ladders or stairs' });

  // beds: every house and longhouse sleeps someone (Tyler, T-102); any vanilla bed in any biome (D-065)
  const kind = design.request && design.request.type;
  if (['home', 'longhouse'].includes(kind)) {
    const beds = pieces.filter(p => PC.piece(p.name).role === 'bed').length;
    results.push({ check: 'beds', ok: beds > 0, detail: beds ? `${beds} beds` : `no bed in this ${kind}` });
  }

  // woodpiles stand outside: none under a roof inside walls
  const piles = pieces.filter((p, i) => /^wood_(fine_|core_)?stack$/.test(p.name) && walls.inside(p.x, p.y, p.z) &&
    [...near(ptBox(p.x, p.y + 0.5, p.y + 30, p.z), 0)].some(j => j !== i && (undersideOf(pieces[j], p.x, p.z, boxes[j]) ?? -1) > p.y + 0.5));
  results.push({ check: 'woodpiles', ok: piles.length === 0, detail: piles.length ? `${piles.length} woodpiles indoors` : 'no woodpiles indoors' });

  // materials for the biome: building pieces from the village's biome and its neighbors; furniture and decor from any
  // biome (D-065, Tyler 2026-11-10; lib/pieces.js decorOk)
  if (biome) {
    const over = [...new Set(pieces.filter(p => !PC.decorOk(p.name, biome) && !(p.hearthStone && PC.hearthStoneOk(p.name, design.request && design.request.stage))).map(p => p.name))];
    results.push({ check: 'materials', ok: over.length === 0, detail: over.length ? `needs later biomes: ${over.slice(0, 5).join(', ')}` : `all pieces available in ${biome}` });
  }

  // room to move: share of floor not covered by furniture
  const floors = boxes.filter(b => b.info.role === 'floor');
  const furn = boxes.filter(b => ['bed', 'table', 'seat', 'storage', 'craft', 'fire', 'clutter', 'deco'].includes(b.info.role) && b.y0 < b.y1);
  let area = 0, used = 0;
  for (const f of floors) {
    const fa = (f.x1 - f.x0) * (f.z1 - f.z0); area += fa;
    for (const u of furn) if (u.y0 >= f.y1 - 0.3 && u.y0 <= f.y1 + 0.5) used += Math.max(0, Math.min(f.x1, u.x1) - Math.max(f.x0, u.x0)) * Math.max(0, Math.min(f.z1, u.z1) - Math.max(f.z0, u.z0));
  }
  const free = area ? 1 - used / area : 1;
  results.push({ check: 'space', ok: free >= 0.45, detail: `${Math.round(free * 100)} % of the floor is free to walk` });

  // the shell rules of the showcase review (2026-11-12), each from one of Tyler's notes; opts.shell false leaves them out
  if (opts.shell !== false) {
    const gs = gameSupport(pieces);
    results.push({ check: 'game support', ok: gs.fall.length === 0, detail: gs.fall.length ? `${gs.fall.length} pieces the game would let fall (${[...new Set(gs.fall.map(i => pieces[i].name))].slice(0, 4).join(', ')})` : 'every piece holds by the game\'s support rule' });
    const ps = passages(pieces);
    results.push({ check: 'passages', ok: ps.length === 0, where: ps, detail: ps.length ? `${ps.length} walks narrower than ${PASSAGE_W} m (${ps.slice(0, 3).map(p => `${p.area} m2 at y ${p.y}`).join('; ')})` : `every walk at least ${PASSAGE_W} m wide` });
    const dw = doorways(pieces);
    results.push({ check: 'doorways', ok: dw.length === 0, detail: dw.length ? `${dw.length} problems (${dw.slice(0, 3).map(p => `${p.door}: ${p.what} at ${p.at}`).join('; ')})` : 'every doorway clear and stepped' });
    const pf = pastureFences(pieces);
    results.push({ check: 'railings', ok: pf.length === 0, detail: pf.length ? `${pf.length} pasture fences used as rails (${pf.slice(0, 3).join('; ')})` : 'no pasture fence raised or indoors' });
    // one masonry family in the walls (Tyler, showcases 15 and 16: "Stone is chunky and light gray. Grausten is smooth
    // and dark gray and half the width"; the corpus mixes them in 150 of 1,001 masonry builds, mostly large castles,
    // lab/shell_mine.js); a hearth's own stone is the hearth's
    const fam = p => /^stone_(wall|arch|pillar)/.test(p.name) ? 'stone' : /^Piece_grausten_(wall|pillar)/i.test(p.name) ? 'grausten' : null;
    const fams = [...new Set(pieces.filter(p => !p.decor && !p.hearthStone && fam(p)).map(fam))];
    results.push({ check: 'masonry', ok: fams.length < 2, detail: fams.length < 2 ? 'one masonry family in the walls' : `walls of ${fams.join(' and ')}` });
    // plants the game drops to the terrain (StaticPhysics without solids, read from the prefabs: lib/details.js
    // PLANTS_FALL) standing over the ground: on a sill or a shelf they fall (showcase 05, the onion and the dandelion)
    const G0 = Math.min(0, ...pieces.map(p => p.y));
    const falls = pieces.filter(p => PLANT_FALL.test(p.name) && p.y > G0 + 0.3);
    results.push({ check: 'plants held', ok: falls.length === 0, detail: falls.length ? `${falls.length} plants over the ground the game drops (${[...new Set(falls.map(p => p.name))].slice(0, 4).join(', ')})` : 'no plant the game drops stands over the ground' });
    const wt = wallTops(pieces);
    results.push({ check: 'wall tops', ok: wt.length === 0, detail: wt.length ? `${wt.length} gaps over outside walls under the roof (${wt.slice(0, 3).map(g => `${g.name} ${g.gap} m under ${g.under}`).join('; ')})` : 'outside walls meet the roof' });
    const cb = crossedBoards(pieces);
    results.push({ check: 'crossed boards', ok: cb.length === 0, detail: cb.length ? `${cb.length} out of line with the bargeboards (${cb.slice(0, 2).join('; ')})` : 'crossed boards in line' });
  }
  return results;
}

const apiC = { check, CLIP_MAX, stability, gameSupport, GAME_LOSS, passages, PASSAGE_W, PASSAGE_CLOSET, doorways, DOOR_STEP, DOOR_STEP_MAX, pastureFences, crossedBoards, wallTops, aabb, catBox, gameBox, aabbShapes, underside, undersideOf, blocks, localOf, doorBlockers, index, HEADROOM, DOOR_CLEAR, CORRIDOR,
  setShapes(on) { SHAPES_DEFAULT = !!on; }, get shapes() { return SHAPES_DEFAULT; } };
if (NODE_C) module.exports = apiC; else window.VHChecks = apiC;
