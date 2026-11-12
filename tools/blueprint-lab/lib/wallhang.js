// Things hung on a wall: signs, item stands, wall torches and Dvergr wall lanterns, banners, shelves (wood_ledge),
// wall carvings and the cauldron's wall racks. One place decides how each one sits against what shows of the wall
// behind it, and one place measures it, so the generator, the pool audit (lib/audit.js) and lab/test_structure.js
// agree.
//
// Measuring: each hung piece's model box (data/piece-models.json bounds) is moved straight back along the side that
// goes to the wall until it meets what shows of a wall, beam, post, window or door (lib/mesh.js parts, the colliders
// where a model shows no more than its collider). The distance moved is its gap: 0 flush, below 0 into the wall,
// above 0 standing off it. The same is done for the front side, so a piece with the wall in front of it and the room
// behind it is turned the wrong way. Corpus depths in docs/handoffs/2026-11-12-showcase-review/wallhung.md.
//
// Placing: hang() puts a piece out in front of a wall and moves it back the same way until it meets what shows, then
// as deep into it as corpus builders hang that prefab. No wall within reach behind every part of its back, no spot.
// Works in Node, the lab page and the game's bundle (Jint), like lib/mesh.js.

const NODE_W = typeof module !== 'undefined';
const meshW = () => (NODE_W ? require('./mesh.js') : window.VHMesh);
const shapesW = () => (NODE_W ? require('./shapes.js') : window.VHShapes);
const piecesW = () => (NODE_W ? require('./pieces.js') : window.VHPieces);

// ---------------------------------------------------------------- what hangs, and which side goes to the wall
// back: the piece's own axis that points into the wall (from the game's models: the torch's wall plate is at local -x,
// the Dvergr lantern's at +x, the item stand's board at -z with its peg toward +z, a banner's rod and cloth lie in
// local y-z). sym: the model is the same from both sides along that axis, so it cannot face the wrong way. plate: the
// part of the back that rests on the wall, as [a0, a1, b0, b1] over the two other local axes (horizontal first, then y);
// null for the whole model box. kind: the family the arrangement rules use.
const HUNG = {
  sign: { kind: 'sign', back: [0, 0, -1], sym: true },
  sign_notext: { kind: 'sign', back: [0, 0, -1], sym: true },
  itemstand: { kind: 'stand', back: [0, 0, -1] },
  piece_walltorch: { kind: 'light', back: [-1, 0, 0], plate: [-0.15, 0.15, -0.33, 0.34] },
  piece_dvergr_lantern: { kind: 'light', back: [1, 0, 0], plate: [-0.33, 0.33, -0.45, 0.45] },
  wood_ledge: { kind: 'shelf', back: [0, 0, -1], sym: true },
  wood_dragon1: { kind: 'carving', back: [0, 0, -1], plate: [-0.25, 0.25, 0, 1.2] },
  darkwood_raven: { kind: 'carving', back: [0, 0, -1], plate: [-0.2, 0.2, 0, 1.2] },
  darkwood_wolf: { kind: 'carving', back: [0, 0, -1], plate: [-0.2, 0.2, 0, 1.2] },
  cauldron_ext1_spice: { kind: 'rack', back: [0, 0, -1] },
  cauldron_ext4_pots: { kind: 'rack', back: [0, 0, -1] },
};
// the banners: rod across local z, cloth down local -y; only the rod rests on the wall
for (let i = 1; i <= 11; i++) HUNG['piece_banner' + (i < 10 ? '0' : '') + i] = { kind: 'banner', back: [1, 0, 0], sym: true, plate: [-0.6, 0.6, -0.1, 0.1] };
const isHung = name => Object.prototype.hasOwnProperty.call(HUNG, name);

// What a hung piece rests against: what shows of these roles of building piece.
const BACKING = { wall: 1, beam: 1, pole: 1, window: 1, door: 1, gable: 1 };

// ---------------------------------------------------------------- small vector helpers
function rotW(q, v) {
  const [x, y, z, w] = q, [vx, vy, vz] = v;
  const ix = w * vx + y * vz - z * vy, iy = w * vy + z * vx - x * vz;
  const iz = w * vz + x * vy - y * vx, iw = -x * vx - y * vy - z * vz;
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
}
const dotW = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const crossW = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function qOf(p) {
  if (p.q) return p.q;
  const a = (p.yaw || 0) * Math.PI / 360;
  return [0, Math.sin(a), 0, Math.cos(a)];
}
function boxW(o) {
  const e = [0, 1, 2].map(k => Math.abs(o.a[0][k]) * o.h[0] + Math.abs(o.a[1][k]) * o.h[1] + Math.abs(o.a[2][k]) * o.h[2]);
  o.x0 = o.c[0] - e[0]; o.x1 = o.c[0] + e[0]; o.y0 = o.c[1] - e[1]; o.y1 = o.c[1] + e[1]; o.z0 = o.c[2] - e[2]; o.z1 = o.c[2] + e[2];
  return o;
}

// The model's box of a hung piece in its own frame: [sx, sy, sz] and its middle, from the game's model.
function modelBox(name) {
  const d = meshW().dims(name);
  if (d && d.show) return { s: d.show, c: d.showAt };
  const P = piecesW().piece(name);
  return { s: P.size || [0.5, 0.5, 0.1], c: P.center || [0, (P.size ? P.size[1] / 2 : 0.25), 0] };
}

// The oriented box of a part of a hung piece in world space. sub: [a0, a1, b0, b1] over the two local axes that are
// not its back axis (horizontal first, then y), clipped to the model box; shrink: taken off every side but the back
// and the front, so a piece resting on a beam or touching a crossing wall at its edge does not count as meeting it.
function partBox(p, sub, shrink) {
  const h = HUNG[p.name], mb = modelBox(p.name), q = qOf(p);
  const bk = h.back, ax = Math.abs(bk[0]) > 0.5 ? 0 : 2, side = ax === 0 ? 2 : 0;
  let lo = mb.c.map((c, i) => c - mb.s[i] / 2), hi = mb.c.map((c, i) => c + mb.s[i] / 2);
  if (sub) {
    lo = lo.slice(); hi = hi.slice();
    lo[side] = Math.max(lo[side], sub[0]); hi[side] = Math.min(hi[side], sub[1]);
    lo[1] = Math.max(lo[1], sub[2]); hi[1] = Math.min(hi[1], sub[3]);
  }
  const s = shrink || 0;
  const hs = [0, 1, 2].map(i => Math.max(0.004, (hi[i] - lo[i]) / 2 - (i === ax ? 0 : s)));
  const lc = [0, 1, 2].map(i => (lo[i] + hi[i]) / 2);
  const c = rotW(q, lc);
  return boxW({ c: [c[0] + p.x, c[1] + p.y, c[2] + p.z], a: [rotW(q, [1, 0, 0]), rotW(q, [0, 1, 0]), rotW(q, [0, 0, 1])], h: hs });
}
/** The world direction from a hung piece into the wall it hangs on (its back), as [x, y, z]. */
function backDir(p) { return rotW(qOf(p), HUNG[p.name].back); }

// The moves t along unit u for which box A moved by t*u meets box B: [t0, t1], or null when it never does.
function sweep(A, B, u) {
  let t0 = -Infinity, t1 = Infinity;
  const d = [B.c[0] - A.c[0], B.c[1] - A.c[1], B.c[2] - A.c[2]];
  const axis = L => {
    const l = Math.hypot(L[0], L[1], L[2]);
    if (l < 1e-5) return true;
    const n = [L[0] / l, L[1] / l, L[2] / l];
    const r = A.h[0] * Math.abs(dotW(A.a[0], n)) + A.h[1] * Math.abs(dotW(A.a[1], n)) + A.h[2] * Math.abs(dotW(A.a[2], n))
      + B.h[0] * Math.abs(dotW(B.a[0], n)) + B.h[1] * Math.abs(dotW(B.a[1], n)) + B.h[2] * Math.abs(dotW(B.a[2], n));
    const dd = dotW(d, n), v = dotW(u, n);
    if (Math.abs(v) < 1e-9) return Math.abs(dd) < r;
    let a = (dd - r) / v, b = (dd + r) / v;
    if (a > b) { const t = a; a = b; b = t; }
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
    return t0 < t1;
  };
  for (let i = 0; i < 3; i++) if (!axis(A.a[i]) || !axis(B.a[i])) return null;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (!axis(crossW(A.a[i], B.a[j]))) return null;
  return t0 < t1 ? [t0, t1] : null;
}

// ---------------------------------------------------------------- the walls round a piece
/** An index of what shows of the building's backing pieces (walls, beams, posts, windows, doors, gables), by 2 m
 * cells. pieces: the design's list; only pieces that are not decor and whose role backs a hung piece count. */
// What shows of a backing piece: its fine parts (to 2 cm of the game's mesh: a stone wall's single coarse box sits at
// its outermost stone, a log wall's 5 cm out), else its coarse parts where its model stands proud of its collider,
// else its colliders.
function partsOf(p) {
  const Me = meshW();
  return (Me.proud(p.name) && (Me.worldFine(p) || Me.world(p))) || shapesW().world(p) || null;
}
// opts.any: every piece but floors, roofs and the plants counts (what a piece is mounted on, for the corpus counts)
function backing(pieces, opts) {
  const cells = new Map(), list = [];
  const P = piecesW(), Me = meshW(), Sh = shapesW();
  const any = opts && opts.any;
  for (const p of pieces) {
    const r = P.piece(p.name).role;
    if (any) { if (['floor', 'roof', 'roofTop', 'roofCorner', 'plant', 'rug'].includes(r)) continue; }
    else if (p.decor || isHung(p.name) || !BACKING[r]) continue;
    const parts = partsOf(p);
    if (!parts || !parts.length) continue;
    const e = { p, role: r, parts, bb: Me.aabbOf(parts) };
    list.push(e);
    for (let i = Math.floor(e.bb.x0 / 2); i <= Math.floor(e.bb.x1 / 2); i++) for (let k = Math.floor(e.bb.z0 / 2); k <= Math.floor(e.bb.z1 / 2); k++) {
      const key = i + ',' + k;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(e);
    }
  }
  const near = (x, z, r) => {
    const out = new Set();
    for (let i = Math.floor((x - r) / 2); i <= Math.floor((x + r) / 2); i++) for (let k = Math.floor((z - r) / 2); k <= Math.floor((z + r) / 2); k++)
      for (const e of cells.get(i + ',' + k) || []) out.add(e);
    return [...out];
  };
  const add = p => {
    const r = P.piece(p.name).role;
    if (!BACKING[r]) return;
    const parts = partsOf(p);
    if (!parts || !parts.length) return;
    const e = { p, role: r, parts, bb: Me.aabbOf(parts) };
    list.push(e);
    for (let i = Math.floor(e.bb.x0 / 2); i <= Math.floor(e.bb.x1 / 2); i++) for (let k = Math.floor(e.bb.z0 / 2); k <= Math.floor(e.bb.z1 / 2); k++) {
      const key = i + ',' + k;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(e);
    }
  };
  return { list, near, add };
}

// How far box A moves along u before it meets what shows of the backing pieces in reach: the least t0 over the parts
// it would meet with t1 > 0 (below 0: it is already that far in). Infinity when nothing is met within reach.
// hit (optional): set to the backing entry first met.
const REACH = 1.5;
function travel(A, u, B, hit, skip) {
  let best = Infinity;
  // the corridor A sweeps through, from where it is (and a little in front) to reach behind it
  const sx0 = Math.min(A.x0, A.x0 + u[0] * REACH) - 0.3, sx1 = Math.max(A.x1, A.x1 + u[0] * REACH) + 0.3;
  const sy0 = Math.min(A.y0, A.y0 + u[1] * REACH) - 0.3, sy1 = Math.max(A.y1, A.y1 + u[1] * REACH) + 0.3;
  const sz0 = Math.min(A.z0, A.z0 + u[2] * REACH) - 0.3, sz1 = Math.max(A.z1, A.z1 + u[2] * REACH) + 0.3;
  for (const e of B) {
    if (skip && e.p === skip) continue;
    const b = e.bb;
    if (b.x0 > sx1 || b.x1 < sx0 || b.y0 > sy1 || b.y1 < sy0 || b.z0 > sz1 || b.z1 < sz0) continue;
    for (const o of e.parts) {
      if (o.x0 > sx1 || o.x1 < sx0 || o.y0 > sy1 || o.y1 < sy0 || o.z0 > sz1 || o.z1 < sz0) continue;
      const iv = sweep(A, o, u);
      if (!iv || iv[1] <= 0 || iv[0] > REACH) continue;
      if (iv[0] < best) { best = iv[0]; if (hit) { hit.e = e; hit.o = o; } }
    }
  }
  return best;
}

/** One hung piece against the walls behind it: { gap, front, cover, facing, wall } (metres). gap: from its back to
 * what shows behind it (Infinity: nothing within 1.5 m); front: the same out of its front; cover: share of its back
 * plate (3 by 3 parts) that meets the wall within 5 cm of the gap; facing: false when the wall is on its front side
 * (only for pieces that look different from the front). B: backing(...) of the design. */
function measure(p, B) {
  const h = HUNG[p.name];
  if (!h) return null;
  const u = backDir(p), n = [-u[0], -u[1], -u[2]];
  const near = B.near(p.x, p.z, 2.6);
  const whole = partBox(p, h.plate, 0.012);
  const hit = {};
  const gap = travel(whole, u, near, hit);
  const front = travel(partBox(p, h.plate, 0.012), n, near);
  // the plate in 3 by 3 parts: how much of it has the wall behind it
  const mb = modelBox(p.name), ax = Math.abs(h.back[0]) > 0.5 ? 0 : 2, side = ax === 0 ? 2 : 0;
  const pl = h.plate || [mb.c[side] - mb.s[side] / 2, mb.c[side] + mb.s[side] / 2, mb.c[1] - mb.s[1] / 2, mb.c[1] + mb.s[1] / 2];
  let met = 0;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const a0 = pl[0] + (pl[1] - pl[0]) * i / 3, b0 = pl[2] + (pl[3] - pl[2]) * j / 3;
    const g = travel(partBox(p, [a0, a0 + (pl[1] - pl[0]) / 3, b0, b0 + (pl[3] - pl[2]) / 3], 0.004), u, near);
    if (isFinite(gap) && g <= gap + 0.05) met++;
  }
  // turned the wrong way: the wall it touches or is sunk into lies on its front side, or the wall is nearer in front
  // (pieces that look the same from both sides only by the sides); turned a quarter: a wall nearer at its side than
  // behind it, and none behind it within 10 cm (a torch put up with its arm along the wall)
  let facing = true, turn = 0;
  if (!h.sym) {
    if (gap <= 0.1 && hit.o) facing = (hit.o.c[0] - whole.c[0]) * u[0] + (hit.o.c[1] - whole.c[1]) * u[1] + (hit.o.c[2] - whole.c[2]) * u[2] > 0;
    else facing = !(front < gap - 0.02 && front < 0.6);
    if (!facing) turn = 180;
  }
  if (facing && !(gap <= 0.1)) {
    const sx = -u[2], sz = u[0];
    for (const sd of [[sx, 0, sz], [-sx, 0, -sz]]) {
      const g = travel(partBox(p, h.plate, 0.012), sd, near);
      if (g >= -0.05 && g < 0.1 && g < gap - 0.05) { facing = false; turn = 90; }
    }
  }
  return { gap, front, cover: met / 9, facing, turn, wall: hit.e ? hit.e.p : null, kind: h.kind };
}

// ---------------------------------------------------------------- hung pieces against each other
// The rectangle a hung piece covers on its wall: along the wall (a), up (y), and how far out (n), given the wall's
// inward normal nx, nz.
function faceRect(p, nx, nz) {
  const A = partBox(p, null, 0);
  const ux = -nz, uz = nx;
  const ea = A.h[0] * Math.abs(A.a[0][0] * ux + A.a[0][2] * uz) + A.h[1] * Math.abs(A.a[1][0] * ux + A.a[1][2] * uz) + A.h[2] * Math.abs(A.a[2][0] * ux + A.a[2][2] * uz);
  const en = A.h[0] * Math.abs(A.a[0][0] * nx + A.a[0][2] * nz) + A.h[1] * Math.abs(A.a[1][0] * nx + A.a[1][2] * nz) + A.h[2] * Math.abs(A.a[2][0] * nx + A.a[2][2] * nz);
  const a = A.c[0] * ux + A.c[2] * uz, n = A.c[0] * nx + A.c[2] * nz;
  return { a0: a - ea, a1: a + ea, y0: A.y0, y1: A.y1, n0: n - en, n1: n + en };
}
/** Pairs of hung pieces on the same wall (backs within 25 degrees, out from it within 0.7 m of each other) whose
 * pictures on the wall overlap: { i, j, share (of the smaller one's picture), depth (how far apart out from the wall
 * their middles are), names }. A pair a third or more over one another with one standing out in front of the other is
 * a stack. Skips a stand or a torch on a banner, which builders do (see the corpus counts in the track record). */
function overlaps(pieces, idx) {
  const hung = [];
  pieces.forEach((p, i) => { if (isHung(p.name) && (!idx || idx(p))) hung.push({ p, i, u: backDir(p) }); });
  const out = [];
  const cells = new Map();
  for (const h of hung) { const k = Math.floor(h.p.x / 2) + ',' + Math.floor(h.p.z / 2); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(h); }
  for (const A of hung) {
    const ci = Math.floor(A.p.x / 2), ck = Math.floor(A.p.z / 2);
    for (let i = ci - 1; i <= ci + 1; i++) for (let k = ck - 1; k <= ck + 1; k++) for (const Bq of cells.get(i + ',' + k) || []) {
      if (Bq.i <= A.i) continue;
      if (A.u[0] * Bq.u[0] + A.u[2] * Bq.u[2] < 0.9) continue;
      const nx = -(A.u[0] + Bq.u[0]) / 2, nz = -(A.u[2] + Bq.u[2]) / 2, l = Math.hypot(nx, nz) || 1;
      const ra = faceRect(A.p, nx / l, nz / l), rb = faceRect(Bq.p, nx / l, nz / l);
      if (Math.abs((ra.n0 + ra.n1) / 2 - (rb.n0 + rb.n1) / 2) > 0.7) continue;
      const oa = Math.min(ra.a1, rb.a1) - Math.max(ra.a0, rb.a0), oy = Math.min(ra.y1, rb.y1) - Math.max(ra.y0, rb.y0);
      if (oa <= 0.01 || oy <= 0.01) continue;
      const sa = Math.min((ra.a1 - ra.a0) * (ra.y1 - ra.y0), (rb.a1 - rb.a0) * (rb.y1 - rb.y0));
      out.push({ i: A.i, j: Bq.i, share: oa * oy / Math.max(1e-4, sa), depth: Math.abs((ra.n0 + ra.n1) / 2 - (rb.n0 + rb.n1) / 2), names: [A.p.name, Bq.p.name] });
    }
  }
  return out;
}

// ---------------------------------------------------------------- placing
// How deep a hung piece goes into what shows of the wall when it is put up: just touching (5 mm in, so no seam shows)
// for boards, stands, torches and shelves, where decor-use corpus pieces sit (liked builds: wall torches 0 mm at the
// median, item stands and signs 5 cm, the 25th percentile of torches 8 cm); a banner's rod 10 cm, so its cloth lies on
// the wall (corpus median 12 cm); a Dvergr wall lantern's bracket 15 cm (corpus median 20 cm); the wall carvings and
// the cauldron's racks 5 cm (corpus medians 10 to 23 cm). Past 1.5 cm (2.5 cm for a banner) the piece carries the depth as a
// clip made on purpose (p.wclip, D-098), so the pool audit's mountClip passes it.
const SINK = { light: 0.005, sign: 0.005, stand: 0.005, shelf: 0.005, banner: 0.10, carving: 0.05, rack: 0.05 };
const SINK_NAME = { piece_dvergr_lantern: 0.15 };
// How much further a piece may go into an uneven wall so half its back touches (stones bulge 5 to 10 cm, log rounds
// 3 to 5 cm): up to the depth decor-use corpus pieces sit at the 25th percentile (liked builds: item stands 11 cm,
// signs and torches 8 to 9 cm), less for a shelf, whose top must stay level.
const BUMPY = { stand: 0.10, sign: 0.08, light: 0.08, shelf: 0.03, rack: 0.08, carving: 0.1, banner: 0.05 };
const sinkOf = name => (SINK_NAME[name] != null ? SINK_NAME[name] : SINK[HUNG[name].kind] != null ? SINK[HUNG[name].kind] : 0.005);
// The turn from a wall's inward normal that puts a piece's back to the wall (lib/decorate.js rel): 0 for a back along
// local -z, 270 for local -x (the torch), 90 for local +x (the lantern, the banners).
function relOf(name) {
  const b = HUNG[name].back;
  return Math.abs(b[0]) > 0.5 ? (b[0] < 0 ? 270 : 90) : (b[2] < 0 ? 0 : 180);
}
const normW = a => ((a % 360) + 360) % 360;
const quatW = yaw => { const a = yaw * Math.PI / 360; return [0, +Math.sin(a).toFixed(6), 0, +Math.cos(a).toFixed(6)]; };

// The backing index of a design's piece list, kept while its building pieces stay the same (the furnishing passes ask
// again and again; walls are all in before any decor).
const CACHE_W = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
function backingOf(pieces) {
  let nb = 0;
  for (const p of pieces) if (!p.decor) nb++;
  const c = CACHE_W && CACHE_W.get(pieces);
  if (c && c.nb === nb) return c.B;
  const B = backing(pieces);
  if (CACHE_W) CACHE_W.set(pieces, { nb, B });
  return B;
}

/** Put a hung piece up on the wall at a spot: { x, z } a point on or near the wall (its line or its face), { nx, nz }
 * the wall's normal into the room, y the pivot height. Moves the piece back from 0.7 m out until what shows of it
 * meets what shows of the wall at that height (a plinth's face and the thinner wall over it are different faces), then
 * as deep as the prefab sinks (sinkOf). Gives { name, x, y, z, yaw, q, gap, wclip, wall } or null when the spot has no
 * wall behind all of the piece's back (cover: share of the 3 by 3 parts of its back plate that meet the wall within
 * 4 cm; default all of them, opts.cover to ask less), when something stands in front of the wall there, or when the
 * piece would go deeper into anything than its sink (a crossing wall or a post at its side).
 * opts.heights: other heights to try, in order, when the first fails (a 2x2 wood wall's rails). B: backingOf(pieces). */
function hang(name, spot, B, opts) {
  opts = opts || {};
  const h = HUNG[name];
  if (!h) return null;
  const l = Math.hypot(spot.nx, spot.nz) || 1, nx = spot.nx / l, nz = spot.nz / l;
  const yaw = normW(Math.atan2(nx, nz) * 180 / Math.PI + relOf(name) + (opts.turn || 0));
  const sink = opts.sink != null ? opts.sink : sinkOf(name);
  const need = opts.cover != null ? opts.cover : 7 / 9;
  const out0 = opts.out != null ? opts.out : 0.7;
  const near = B.near(spot.x, spot.z, 2.6);
  for (const y of [spot.y].concat(opts.heights || [])) {
    const p = { name, x: spot.x + nx * out0, y, z: spot.z + nz * out0, yaw, q: quatW(yaw) };
    const u = backDir(p);
    const g = travel(partBox(p, h.plate, 0.012), u, near);
    if (!(g > 0.02) || g > (opts.reach || 1.4)) continue;
    // the back plate in 3 by 3 parts: how far past the first touch each part meets the wall; on an uneven wall (stones,
    // logs) the piece goes in until half its parts touch, as builders sink them (D-127), no deeper than BUMPY
    const mb = modelBox(name), ax = Math.abs(h.back[0]) > 0.5 ? 0 : 2, side = ax === 0 ? 2 : 0;
    const pl = h.plate || [mb.c[side] - mb.s[side] / 2, mb.c[side] + mb.s[side] / 2, mb.c[1] - mb.s[1] / 2, mb.c[1] + mb.s[1] / 2];
    const cells = [];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const a0 = pl[0] + (pl[1] - pl[0]) * i / 3, b0 = pl[2] + (pl[3] - pl[2]) * j / 3;
      cells.push(travel(partBox(p, [a0, a0 + (pl[1] - pl[0]) / 3, b0, b0 + (pl[3] - pl[2]) / 3], 0.004), u, near) - g);
    }
    const sorted = cells.slice().sort((a, b) => a - b), med = sorted[4];
    const extra = med > 0.04 && med <= (BUMPY[h.kind] || 0) ? med : 0;
    const d = g + sink + extra;
    p.x = +(p.x + u[0] * d).toFixed(3); p.z = +(p.z + u[2] * d).toFixed(3); p.y = +(+y).toFixed(3);
    // nothing deeper than the sink: the whole model against everything round it
    const deep = travel(partBox(p, null, 0.004), u, near);
    if (deep < -(sink + extra) - 0.02) continue;
    // the back plate on the wall: parts within 4 cm of touching
    const met = cells.filter(c => c <= extra + 0.05).length;
    if (met / 9 < need - 1e-6) continue;
    const lim = h.kind === 'banner' ? 0.025 : 0.015;
    const res = { name, x: p.x, y: p.y, z: p.z, yaw, q: p.q, gap: -(sink + extra) };
    if (sink + extra > lim) res.wclip = +(sink + extra + 0.01).toFixed(3);
    return res;
  }
  return null;
}

// ---------------------------------------------------------------- arranging
// Where builders put things on a wall, from decor-use corpus pieces (docs/handoffs/2026-11-12-showcase-review/wallhung.md):
// over the piece of furniture against the wall, centered on it; a pair either side of a window, a door or a hearth at
// one height; one in the middle of a plain stretch of wall; a row at one height with even gaps. Lights stand alone on
// a wall run (96 % of corpus runs). Never two in one place, never one over another unless a set stacks them on purpose.
// slots(face, o): the slots of one wall face, best first. face: { a0, a1, runs: [{ kind, a0, a1 }], px(t), pz(t), nx, nz }
// (lib/decorate.js faceModel); o.under: what stands against the face [{ t0, t1, top, kind }]; o.w: the width of what
// goes up; o.taken: [{ t0, t1, y0, y1 }] already on the face; o.kind: the hung family. Each slot: { t, y (over the
// floor, or null for the caller's), why, pair (the other slot of a pair) }.
function slots(face, o) {
  const w = o.w || 0.5, out = [];
  const plain = face.runs.filter(r => r.kind === 'wall');
  const clearRun = (t0, t1) => plain.some(r => r.a0 <= t0 + 0.01 && r.a1 >= t1 - 0.01);
  const free = (t, y0, y1) => !(o.taken || []).some(m => m.t0 < t + w / 2 + 0.15 && m.t1 > t - w / 2 - 0.15 && m.y0 < y1 + 0.15 && m.y1 > y0 - 0.15);
  // over furniture standing against this wall, centered on it
  for (const u of o.under || []) {
    const t = (u.t0 + u.t1) / 2;
    if (clearRun(t - w / 2 - 0.05, t + w / 2 + 0.05)) out.push({ t, y: u.top != null ? u.top : null, why: 'over ' + (u.kind || 'furniture'), rank: 3 });
  }
  // a pair either side of an opening, symmetric about its middle
  for (const r of face.runs) {
    if (r.kind !== 'window' && r.kind !== 'door') continue;
    const mid = (r.a0 + r.a1) / 2, half = (r.a1 - r.a0) / 2;
    for (const off of [0.35, 0.55]) {
      const d = half + off + w / 2;
      if (clearRun(mid - d - w / 2, mid - d + w / 2) && clearRun(mid + d - w / 2, mid + d + w / 2)) {
        const a = { t: mid - d, y: null, why: 'beside ' + r.kind, rank: 2 }, b = { t: mid + d, y: null, why: 'beside ' + r.kind, rank: 2 };
        a.pair = b; b.pair = a; out.push(a); break;
      }
    }
  }
  // the middle of each plain stretch long enough
  for (const r of plain) if (r.a1 - r.a0 >= w + 0.6) out.push({ t: (r.a0 + r.a1) / 2, y: null, why: 'middle of the wall', rank: 1 });
  out.sort((a, b) => b.rank - a.rank);
  return out.filter(s => free(s.t, -Infinity, Infinity) || true);
}
/** n pieces of width w in a row at one height centered on t, with even gaps (corpus: same-prefab neighbors at one
 * height, see the track record): the along-wall positions. */
function row(t, n, w, gap) {
  const step = w + gap, out = [];
  for (let i = 0; i < n; i++) out.push(+(t + (i - (n - 1) / 2) * step).toFixed(3));
  return out;
}

const apiWH = { HUNG, isHung, BACKING, backing, backingOf, measure, overlaps, backDir, partBox, sweep, travel, modelBox, faceRect, hang, sinkOf, relOf, slots, row };
if (NODE_W) module.exports = apiWH; else window.VHWallhang = apiWH;
