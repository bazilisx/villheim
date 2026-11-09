// Checks on a design: every piece supported, no doubled or crushed pieces, doors you can walk through, headroom
// under roofs and ceilings, ladders and stairs you can climb, materials the biome has, and room left to move inside.
// Rough, from piece boxes and the measured shapes of roofs, doors and ladders; good for catching mistakes.

const NODE_C = typeof module !== 'undefined';
const PC = NODE_C ? require('./pieces.js') : window.VHPieces;
const SHP = NODE_C ? require('./shapes.js') : window.VHShapes;

// A player is about 1.8 m tall. Walkable rooms need 2.4 m clear under every roof and ceiling piece; a doorway needs its
// own height, and 2.3 m in front of it and behind it, for a metre each way.
const HEADROOM = 2.4, DOOR_CLEAR = 2.3, CORRIDOR = 1.0, WALL_MIN = 2.5;
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
function aabb(p) { return SHAPES_DEFAULT && SHP ? gameBox(p) : catBox(p); }
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
  const none = [];
  return (b, pad = 1) => {
    const ia = Math.floor(b.x0 / 2) - pad, ib = Math.floor(b.x1 / 2) + pad, ja = Math.floor(b.z0 / 2) - pad, jb = Math.floor(b.z1 / 2) + pad;
    if (ia === ib && ja === jb) return g.get(k(ia, ja)) || none;
    const out = new Set();
    for (let i = ia; i <= ib; i++) for (let j = ja; j <= jb; j++) for (const n of g.get(k(i, j)) || none) out.add(n);
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
      if (touch(b, o, 0.16) && (b.info.structural || o.info.role === 'craft' || o.info.role === 'deco' || o.info.role === 'light')) { held[j] = true; queue.push(j); }
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
        // a piece set into a wall or another piece on purpose, no deeper than its source build had it (p.clip, D-065)
        const cl = Math.max(pieces[i].clip || 0, pieces[j].clip || 0);
        if (cl && Math.min(Math.min(b.x1, o.x1) - Math.max(b.x0, o.x0), Math.min(b.y1, o.y1) - Math.max(b.y0, o.y0), Math.min(b.z1, o.z1) - Math.max(b.z0, o.z0)) <= cl + 0.03) continue;
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
  const lowBy = new Set(), where = [];
  for (const pt of pts) {
    // the lowest roof or ceiling over the point; a floor open to the sky (a roof terrace, a yard) is left out
    const col = ptBox(pt.x, pt.y + 0.05, pt.y + 30, pt.z);
    let lowest = Infinity, by = null;
    for (const j of near(col, 0)) {
      if (j === pt.floor) continue;
      const u = undersideOf(pieces[j], pt.x, pt.z, boxes[j]);
      // what is less than 0.5 m over the floor is a kerb, sill or dais on it, never the ceiling (with the game's
      // colliders a beam laid on the floor shows 5 cm over it)
      if (u != null && u > pt.y + (useShapes ? 0.5 : 0.05) && u < lowest) { lowest = u; by = pieces[j].name; }
    }
    if (!isFinite(lowest)) continue;
    if (!walls.inside(pt.x, pt.y, pt.z) || walls.near(pt.x, pt.y, pt.z, 0.45)) continue;
    inside++;
    let bad = lowest < pt.y + HEADROOM - 0.01 ? by : null;
    // walls at least 2.5 m tall: a point beside a wall needs wall at that height too (from the floor piece's middle)
    if (!bad && walls.near(pt.x, pt.y, pt.z, 1.0, 0.6, 1.9) && !walls.near(pt.x, pt.y - 0.15, pt.z, 1.6, WALL_MIN - 0.05)) bad = 'walls under 2.5 m';
    if (bad) { low++; lowBy.add(bad); if (where.length < 6) where.push({ x: +pt.x.toFixed(2), y: +pt.y.toFixed(2), z: +pt.z.toFixed(2), under: bad }); }
  }
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

  // beds: every house and longhouse sleeps someone, in a bed its biome can make (Tyler, T-102)
  const kind = design.request && design.request.type;
  if (['home', 'longhouse'].includes(kind)) {
    const ord = PC.BIOME_ORDER, limit = biome ? ord.indexOf(biome) : 99;
    const beds = pieces.filter(p => PC.piece(p.name).role === 'bed' && ord.indexOf(PC.needs(p.name)) <= limit).length;
    results.push({ check: 'beds', ok: beds > 0, detail: beds ? `${beds} beds` : `no bed in this ${kind}` });
  }

  // woodpiles stand outside: none under a roof inside walls
  const piles = pieces.filter((p, i) => /^wood_(fine_|core_)?stack$/.test(p.name) && walls.inside(p.x, p.y, p.z) &&
    [...near(ptBox(p.x, p.y + 0.5, p.y + 30, p.z), 0)].some(j => j !== i && (undersideOf(pieces[j], p.x, p.z, boxes[j]) ?? -1) > p.y + 0.5));
  results.push({ check: 'woodpiles', ok: piles.length === 0, detail: piles.length ? `${piles.length} woodpiles indoors` : 'no woodpiles indoors' });

  // materials for the biome, building pieces and furnishing alike
  if (biome) {
    const ord = PC.BIOME_ORDER, limit = ord.indexOf(biome);
    const over = [...new Set(pieces.filter(p => ord.indexOf(PC.needs(p.name)) > limit).map(p => p.name))];
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
  return results;
}

const apiC = { check, stability, aabb, catBox, gameBox, aabbShapes, underside, undersideOf, blocks, localOf, doorBlockers, index, HEADROOM, DOOR_CLEAR, CORRIDOR,
  setShapes(on) { SHAPES_DEFAULT = !!on; }, get shapes() { return SHAPES_DEFAULT; } };
if (NODE_C) module.exports = apiC; else window.VHChecks = apiC;
