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
  // (the spice rack's board; the herbs hang a meter under it)
  cauldron_ext1_spice: { kind: 'rack', back: [0, 0, -1], plate: [-1.0, 1.0, 0.66, 1.3] },
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
// Separating axes: the 3 axes of each box and the 9 cross products. Written without arrays in the inner loop (the same
// arithmetic as before, in the same order), since it runs for every part a hung piece could meet and the in-game
// engine has a time limit per design.
function sweep(A, B, u) {
  let t0 = -Infinity, t1 = Infinity;
  const d0 = B.c[0] - A.c[0], d1 = B.c[1] - A.c[1], d2 = B.c[2] - A.c[2];
  const Aa = A.a, Ba = B.a, Ah = A.h, Bh = B.h;
  const axis = (L0, L1, L2) => {
    const l = Math.hypot(L0, L1, L2);
    if (l < 1e-5) return true;
    const n0 = L0 / l, n1 = L1 / l, n2 = L2 / l;
    const r = Ah[0] * Math.abs(Aa[0][0] * n0 + Aa[0][1] * n1 + Aa[0][2] * n2) + Ah[1] * Math.abs(Aa[1][0] * n0 + Aa[1][1] * n1 + Aa[1][2] * n2) + Ah[2] * Math.abs(Aa[2][0] * n0 + Aa[2][1] * n1 + Aa[2][2] * n2)
      + Bh[0] * Math.abs(Ba[0][0] * n0 + Ba[0][1] * n1 + Ba[0][2] * n2) + Bh[1] * Math.abs(Ba[1][0] * n0 + Ba[1][1] * n1 + Ba[1][2] * n2) + Bh[2] * Math.abs(Ba[2][0] * n0 + Ba[2][1] * n1 + Ba[2][2] * n2);
    const dd = d0 * n0 + d1 * n1 + d2 * n2, v = u[0] * n0 + u[1] * n1 + u[2] * n2;
    if (Math.abs(v) < 1e-9) return Math.abs(dd) < r;
    let a = (dd - r) / v, b = (dd + r) / v;
    if (a > b) { const t = a; a = b; b = t; }
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
    return t0 < t1;
  };
  for (let i = 0; i < 3; i++) {
    if (!axis(Aa[i][0], Aa[i][1], Aa[i][2]) || !axis(Ba[i][0], Ba[i][1], Ba[i][2])) return null;
  }
  for (let i = 0; i < 3; i++) {
    const a = Aa[i];
    for (let j = 0; j < 3; j++) {
      const b = Ba[j];
      if (!axis(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])) return null;
    }
  }
  return t0 < t1 ? [t0, t1] : null;
}

// ---------------------------------------------------------------- the walls round a piece
/** An index of what shows of the building's backing pieces (walls, beams, posts, windows, doors, gables), by 2 m
 * cells. pieces: the design's list; only pieces that are not decor and whose role backs a hung piece count. */
// What shows of a backing piece: its fine parts (to 2 cm of the game's mesh: a stone wall's single coarse box sits at
// its outermost stone, a log wall's 5 cm out), else its coarse parts where its model stands proud of its collider,
// else its colliders.
// Kept per piece object while its name, place and turn stay the same: the indexes are built again for every new list
// (a room's own list, a list joined with a set's pieces), and the parts were most of that cost.
const CACHE_P = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
function partsOf(p) {
  const key = p.name + '|' + p.x + '|' + p.y + '|' + p.z + '|' + p.yaw + '|' + (p.q ? p.q.join(',') : '') + '|' + (p.scale ? [].concat(p.scale).join(',') : '');
  const c = CACHE_P && CACHE_P.get(p);
  if (c && c.key === key) return c.parts;
  const Me = meshW();
  const parts = (Me.proud(p.name) && (Me.worldFine(p) || Me.world(p))) || shapesW().world(p) || null;
  if (CACHE_P) CACHE_P.set(p, { key, parts });
  return parts;
}
// opts.any: every piece but floors, roofs and the plants counts (what a piece is mounted on, for the corpus counts);
// opts.floors with it: floors and stairs too (what a piece stands on)
function backing(pieces, opts) {
  const cells = new Map(), list = [];
  const P = piecesW(), Me = meshW(), Sh = shapesW();
  const any = opts && opts.any;
  // a piece of the list goes in the index when it counts for these opts (the same test for the first build and for
  // pieces added to the list later, see indexOf)
  const addKeep = p => {
    const r = P.piece(p.name).role;
    if (any) { if ((!opts.floors && ['floor', 'stair'].includes(r)) || (!opts.roofs && ['roof', 'roofTop', 'roofCorner'].includes(r)) || ['plant', 'rug'].includes(r)) return; }
    // (a beam, post or quarter wall a set or an assembly adds, p.trim, holds what hangs on it as the shell's own do)
    else if ((p.decor && !(p.trim && P.piece(p.name).structural)) || isHung(p.name) || !BACKING[r]) return;
    let parts = partsOf(p);
    // a floor holds what stands on it by its collider, which can stand over what shows (the ashwood floor's model top
    // 0.077 m over its pivot, its collider 0.097; corpus furniture on it stands 0.099 over the pivot at the median of
    // 2,149, lab measure of 2026-11-12, track E record)
    if (any && opts.floors && r === 'floor') { const col = Sh && Sh.world ? Sh.world(p) : null; if (col && col.length) parts = (parts || []).concat(col); }
    // and a chest, barrel, table or seat holds what is set on it by what shows of its top: the barrel chest's collider
    // is its staves and its floor, open at the top, where corpus builders set flat stands on its lid (0.92 m over its
    // pivot at the median of 169, model top 0.899; lab measure of 2026-11-12, track E record)
    if (any && opts.floors && ['storage', 'table', 'seat', 'craft'].includes(r) && p.decor !== false) { const mb = modelWorldBox(p, 0); if (mb) parts = (parts || []).concat([{ ...mb, m: 1 }]); }
    if (!parts || !parts.length) return;
    const e = { p, role: r, parts, bb: Me.aabbOf(parts) };
    list.push(e);
    for (let i = Math.floor(e.bb.x0 / 2); i <= Math.floor(e.bb.x1 / 2); i++) for (let k = Math.floor(e.bb.z0 / 2); k <= Math.floor(e.bb.z1 / 2); k++) {
      const key = i + ',' + k;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(e);
    }
  };
  for (const p of pieces) addKeep(p);
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
  return { list, near, add, addKeep };
}

// How far box A moves along u before it meets what shows of the backing pieces in reach: the least t0 over the parts
// it would meet with t1 > 0 (below 0: it is already that far in). Infinity when nothing is met within reach.
// hit (optional): set to the backing entry first met.
const REACH = 1.5;
// The least move t along u at which box A's axis-aligned bounds meet box B's, or null when they never meet with t1 > 0.
function aabbFrom(A, B, u) {
  let t0 = -Infinity, t1 = Infinity;
  const lo = [A.x0, A.y0, A.z0], hi = [A.x1, A.y1, A.z1], blo = [B.x0, B.y0, B.z0], bhi = [B.x1, B.y1, B.z1];
  for (let k = 0; k < 3; k++) {
    const v = u[k];
    if (Math.abs(v) < 1e-9) { if (hi[k] < blo[k] || lo[k] > bhi[k]) return null; continue; }
    let a = (blo[k] - hi[k]) / v, b = (bhi[k] - lo[k]) / v;
    if (a > b) { const t = a; a = b; b = t; }
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
    if (t0 > t1) return null;
  }
  return t1 > 0 ? t0 : null;
}
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
      // the axis-aligned boxes hold the oriented ones, so the moves where the boxes meet hold the moves where the parts
      // meet: when those start past what is already met (or past reach), the full test cannot give a nearer touch
      const lo = aabbFrom(A, o, u);
      if (lo === null || lo >= best || lo > REACH) continue;
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
  // (as hang counts it: past the first touch, up to half the plate may stand off an uneven wall by its median)
  const cells = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const a0 = pl[0] + (pl[1] - pl[0]) * i / 3, b0 = pl[2] + (pl[3] - pl[2]) * j / 3;
    cells.push(travel(partBox(p, [a0, a0 + (pl[1] - pl[0]) / 3, b0, b0 + (pl[3] - pl[2]) / 3], 0.004), u, near) - gap);
  }
  const med = cells.slice().sort((a, b) => a - b)[4];
  const extra = med > 0.04 && med <= (BUMPY[h.kind] || 0) ? med : 0;
  const met = isFinite(gap) ? cells.filter(c => c <= extra + 0.05).length : 0;
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

/** What a piece of the hung kinds rests on or is mounted on when it is no wall's: { on, how } with how 'stands' (on a
 * floor, a shelf or furniture within 4 cm under it: a sign set on edge on a floor, a ledge as a cabinet's top) or
 * 'mounted' (on something that is no wall within 3 cm behind it: a label on a chest's front, a stand on a banner),
 * or null. A: backing(pieces, { any: true, floors: true }). */
function restsOn(p, A) {
  const near = A.near(p.x, p.z, 2.6);
  // the first piece met moving its box along u that it does not reach into already by more than 8 cm
  const meet = (box, u, lo, hi, under) => {
    let best = null;
    for (const e of near) {
      if (e.p === p) continue;
      for (const o of e.parts) {
        // (what it stands on: a part whose top is at its foot, not a wall it is hung against or a cup set on it)
        if (under && (o.y1 > box.y0 + 0.08 || o.y1 < box.y0 - 0.08)) continue;
        const iv = sweep(box, o, u);
        if (!iv || iv[1] <= 0 || iv[0] < lo || iv[0] > hi) continue;
        if (!best || iv[0] < best.t) best = { t: iv[0], e };
      }
    }
    return best;
  };
  const d = meet(partBox(p, null, 0.01), [0, -1, 0], -0.08, 0.04, true);
  if (d) return { on: d.e.p, how: 'stands' };
  const g = meet(partBox(p, HUNG[p.name].plate, 0.012), backDir(p), -0.1, 0.03);
  if (g && !BACKING[g.e.role]) return { on: g.e.p, how: 'mounted' };
  return null;
}

// ---------------------------------------------------------------- what any piece is attached to
// The model box of any piece in world space (shrink off its sides, so a piece touching its neighbor at an edge does
// not count as standing on it).
function modelWorldBox(p, shrink) {
  const mb = modelBox(p.name), q = qOf(p), s = shrink || 0;
  const c = rotW(q, mb.c);
  return boxW({ c: [c[0] + p.x, c[1] + p.y, c[2] + p.z], a: [rotW(q, [1, 0, 0]), rotW(q, [0, 1, 0]), rotW(q, [0, 0, 1])],
    h: [Math.max(0.004, mb.s[0] / 2 - s), mb.s[1] / 2, Math.max(0.004, mb.s[2] / 2 - s)] });
}
/** How a piece meets what holds it: { below, above } the gaps (m) from its model box down to the first piece under it
 * whose top is within reach of its foot, and up to the first piece over it whose underside is within reach of its top
 * (Infinity when none within 1.5 m); 0 or less: touching or into it. A: backing(pieces, { any: true, floors: true }). */
function attach(p, A) {
  const box = modelWorldBox(p, 0.02), near = A.near(p.x, p.z, 2.6);
  let below = Infinity, above = Infinity;
  for (const e of near) {
    if (e.p === p) continue;
    for (const o of e.parts) {
      const d = sweep(box, o, [0, -1, 0]);
      if (d && d[1] > 0 && d[0] > -0.15 && d[0] < below && o.y1 <= box.y0 + 0.15) below = d[0];
      const u = sweep(box, o, [0, 1, 0]);
      if (u && u[1] > 0 && u[0] > -0.15 && u[0] < above && o.y0 >= box.y1 - 0.15) above = u[0];
    }
  }
  return { below, above };
}

// A design's piece list only grows while it is made: an index kept for a list takes in the pieces added since it was
// built, in list order, which gives the same index as building it again (the same entries in the same order). When
// the list changed some other way (its last indexed piece is no longer where it was, or it is shorter), it is built
// again. This replaced rebuilding on every added piece, which cost the in-game engine its time limit on large
// buildings (gen-test longhouse bf s3d2, 2026-11-12).
function indexOf(cache, pieces, opts) {
  const c = cache && cache.get(pieces);
  const n = pieces.length;
  if (c && n >= c.n && (c.n === 0 || pieces[c.n - 1] === c.last)) {
    for (let i = c.n; i < n; i++) c.B.addKeep(pieces[i]);
    c.n = n; c.last = n ? pieces[n - 1] : null;
    return c.B;
  }
  const B = backing(pieces, opts);
  if (cache) cache.set(pieces, { n, last: n ? pieces[n - 1] : null, B });
  return B;
}

/** What holds pieces up, for attach and settle: every piece but roofs, rugs and plants, floors included, kept while
 * the list's length stays the same. */
const CACHE_S = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
function supportOf(pieces) {
  return indexOf(CACHE_S, pieces, { any: true, floors: true });
}
/** The height that hangs a ceiling piece (a hanging brazier) from the first beam, floor or roof over it, its chain's
 * top 5 cm into it as corpus builders hang them (739 in liked builds: 5 cm at the median, 13 cm at the 10th
 * percentile), or null when nothing is within 3 m over it (hub braziers hung 1.9 to 2.5 m under anything). */
const CACHE_H = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
function hangFrom(p, pieces) {
  const A = indexOf(CACHE_H, pieces, { any: true, floors: true, roofs: true });
  const m = attach({ ...p, y: p.y - 0.5 }, A);
  if (!isFinite(m.above) || m.above > 3.5) return null;
  let y = p.y - 0.5 + m.above + 0.05;
  // (under a sloped roof the first measure stops short of the slope: measured again from where it lands, as the float
  // check measures it; showcase 03 hung 9 cm under its roof)
  for (let i = 0; i < 3; i++) {
    const n = attach({ ...p, y }, A);
    if (!isFinite(n.above) || n.above <= 0.03 || n.above > 1) break;
    y += n.above + 0.05;
  }
  return +y.toFixed(3);
}
/** The height that sets a piece's model on the first thing under its foot within reach (m up or down), or null.
 * For what stands (a standing torch whose foot hovered 10 to 64 cm over the floor, showcase 01 and 05). */
function settle(p, pieces, reach) {
  const r = reach || 0.7, A = supportOf(pieces);
  const q = { ...p, y: p.y + r };
  const m = attach(q, A);
  if (!isFinite(m.below) || m.below > 2 * r) return null;
  return +(q.y - m.below).toFixed(3);
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
/** Two backing indexes read as one (a set's own pieces not yet in the building, lib/kitbash.js fit). */
function both(A, B) { return { list: A.list.concat(B.list), near: (x, z, r) => A.near(x, z, r).concat(B.near(x, z, r)), add: A.add }; }
function backingOf(pieces) {
  return indexOf(CACHE_W, pieces);
}

/** Put a hung piece up on the wall at a spot: { x, z } a point on or near the wall (its line or its face), { nx, nz }
 * the wall's normal into the room, y the pivot height. Moves the piece back from 0.7 m out until what shows of it
 * meets what shows of the wall at that height (a plinth's face and the thinner wall over it are different faces), then
 * as deep as the prefab sinks (sinkOf). Gives { name, x, y, z, yaw, q, gap, wclip, wall } or null when the spot has no
 * wall behind all of the piece's back (cover: share of the 3 by 3 parts of its back plate that meet the wall within
 * 4 cm; default all of them, opts.cover to ask less), when something stands in front of the wall there, or when the
 * piece would go deeper into anything than its sink (a crossing wall or a post at its side).
 * opts.heights: other heights to try, in order, when the first fails (a 2x2 wood wall's rails). opts.pieces: what is
 * in the building already (and of the set being fitted); a spot whose outline on the wall overlaps one hung there is
 * refused (a torch hung over an item stand, a spice rack over two ledges, showcase 01 and 06). B: backingOf(pieces). */
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
    // never over or under another piece hung on that wall: their outlines on the wall keep apart
    if (opts.pieces && clashOnWall(p, opts.pieces, opts.gapOk != null ? opts.gapOk : 0.02)) continue;
    const lim = h.kind === 'banner' ? 0.025 : 0.015;
    const res = { name, x: p.x, y: p.y, z: p.z, yaw, q: p.q, gap: -(sink + extra) };
    if (sink + extra > lim) res.wclip = +(sink + extra + 0.01).toFixed(3);
    return res;
  }
  return null;
}

// Whether a hung piece's outline on its wall overlaps one of the pieces of the hung kinds on the same wall (backs
// within 25 degrees, middles within 0.7 m out from the wall), closer than gap along the wall or up it.
function clashOnWall(p, pieces, gap) {
  const u = backDir(p), nx = -u[0], nz = -u[2];
  const ra = faceRect(p, nx, nz);
  for (const q of pieces) {
    if (q === p || !isHung(q.name) || Math.abs(q.x - p.x) > 3 || Math.abs(q.z - p.z) > 3 || Math.abs(q.y - p.y) > 3.5) continue;
    const v = backDir(q);
    if (u[0] * v[0] + u[2] * v[2] < 0.9) continue;
    const rb = faceRect(q, nx, nz);
    if (Math.abs((ra.n0 + ra.n1) / 2 - (rb.n0 + rb.n1) / 2) > 0.7) continue;
    if (Math.min(ra.a1, rb.a1) - Math.max(ra.a0, rb.a0) > -gap && Math.min(ra.y1, rb.y1) - Math.max(ra.y0, rb.y0) > -gap) return true;
  }
  return false;
}

// ---------------------------------------------------------------- arranging
// Where things go on a wall, from decor-use corpus pieces (docs/ROOM_STUDY.md section 7, data/rooms-corpus/walls.json,
// and the track record): one thing alone on its stretch of wall (59 % of item stands, 68 % of signs, 96 % of lights and
// banners), centered over what stands against the wall (15 % of signs over a chest), a pair either side of a window or
// a door at one height, or a row at one height. Lights stand alone on a wall, 2.7 m apart (p50) and at one height
// (71 %). Never one over another unless a set stacks them on purpose.
//
// plan(face, o): the slots of one wall face in the order to try them. face: { a0, a1, runs: [{ kind, a0, a1 }] } as
// lib/decorate.js faceModel makes it. o.under: what stands against the face, [{ t0, t1, kind }] along it; o.w: the
// width of what goes up; o.light: a light (alone on its stretch, beside openings first). Each slot: { t, why, rank,
// mate } (mate: the other slot of a symmetric pair, tried with the same thing or not at all).
// spaced(taken, t, w, light): whether t keeps clear of the slots already used on the face.
function plan(face, o) {
  o = o || {};
  const w = o.w || 1, out = [];
  const plain = face.runs.filter(r => r.kind === 'wall');
  const onPlain = (t0, t1) => plain.some(r => r.a0 <= t0 + 0.01 && r.a1 >= t1 - 0.01);
  const pairAt = (mid, d, why, rank) => {
    if (!onPlain(mid - d - w / 2, mid - d + w / 2) || !onPlain(mid + d - w / 2, mid + d + w / 2)) return false;
    const A = { t: +(mid - d).toFixed(3), why, rank }, B = { t: +(mid + d).toFixed(3), why, rank };
    A.mate = B; B.mate = A; out.push(A, B);
    return true;
  };
  // a pair either side of an opening, symmetric about its middle (lights first beside the door, as the corpus puts them)
  for (const r of face.runs) {
    if (r.kind !== 'window' && r.kind !== 'door') continue;
    const mid = (r.a0 + r.a1) / 2, half = (r.a1 - r.a0) / 2;
    for (const off of [0.3, 0.5, 0.8]) if (pairAt(mid, half + off + w / 2, 'beside the ' + r.kind, o.light ? 4 : 2)) break;
  }
  // over what stands against the wall, centered on it
  for (const u of o.under || []) {
    const t = (u.t0 + u.t1) / 2;
    if (onPlain(t - w / 2, t + w / 2)) out.push({ t: +t.toFixed(3), why: 'over the ' + (u.kind || 'furniture'), rank: o.light ? 1 : 3 });
  }
  for (const r of plain) {
    const len = r.a1 - r.a0, mid = (r.a0 + r.a1) / 2;
    // the middle of a plain stretch
    if (len >= w + 0.4) out.push({ t: +mid.toFixed(3), why: 'middle of the wall', rank: o.light ? 2 : 1.5 });
    // a long stretch: a pair at its quarters, mirrored about its middle
    if (len >= 2 * w + 2.4) pairAt(mid, len / 4, 'pair on a long wall', 1);
  }
  out.sort((x, y) => y.rank - x.rank || Math.abs(x.t - (face.a0 + face.a1) / 2) - Math.abs(y.t - (face.a0 + face.a1) / 2));
  return out;
}
/** The height of a building's wall lights over their floor: one for the household, 1.55 to 1.95 m (corpus wall torches
 * p25 1.9, p50 2.3 m over the floor, 71 % of lights on one wall at one height), the same in every room and every pass,
 * as an architect keeps a feature the same through a house (Tyler, 2026-11-12, on consistency). */
function lightY(P) { return P && P.salt != null ? 1.55 + ((P.salt >>> 3) % 5) * 0.1 : 1.75; }
function spaced(taken, t, w, light) {
  const min = light ? 2.0 : w + 0.6;
  return !taken.some(u => Math.abs(u.t - t) < Math.max(min, (u.w + w) / 2 + 0.6));
}
/** n pieces of width w in a row at one height centered on t, gap apart (the along-wall places). */
function row(t, n, w, gap) {
  const step = w + gap, out = [];
  for (let i = 0; i < n; i++) out.push(+(t + (i - (n - 1) / 2) * step).toFixed(3));
  return out;
}

const apiWH = { HUNG, isHung, BACKING, backing, backingOf, measure, overlaps, backDir, partBox, sweep, travel, modelBox, faceRect, hang, sinkOf, relOf, plan, spaced, row, restsOn, clashOnWall, both, attach, modelWorldBox, settle, supportOf, hangFrom, lightY };
if (NODE_W) module.exports = apiWH; else window.VHWallhang = apiWH;
