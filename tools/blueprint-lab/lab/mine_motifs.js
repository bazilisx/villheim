// Exterior motifs from the best-liked builds: the trim people put round windows, doors, outside corners, gable ends and
// eaves, each read in its feature's own frame, so the generator can build the same assemblies (docs/BUILDING_DETAILS.md,
// "Motifs").
//   node lab/mine_motifs.js [compact.json] [corpus dir] [out json]
//
// compact.json (the lead's study file) gives each build's popularity and Tyler's verdict; the pieces are read from the
// .blueprint files themselves, so tilt and scale are known. Builds kept: Tyler's Yes, or the top 40 % of the
// valheimians builds by downloads, 60 to 6,000 pieces, no modded pieces.
//
// A feature's frame: a along the wall, o out from it, h up from the feature's foot. Window: the bottom middle of the
// opening on the wall's middle plane. Door: the bottom middle of the door's opening. Corner: the corner of the two wall
// planes at the foot of the walls, o along the outward diagonal. Gable: the ridge's end on the gable's face, h from
// the ridge cap's pivot. Eave: the low edge of the lowest roof row, o out and down the slope. Each assembly is turned
// the way round (mirrored or not) that sorts first, so a motif and its mirror image are one.
//
// Kept when clean: vanilla pieces only, nothing tilted or scaled, every piece touching the wall, the roof, the ground
// or another piece of the motif (nothing floating), no two pieces through each other, nothing in a door's way.
const fs = require('fs'), path = require('path');
const lab = path.join(__dirname, '..');
const P = require(lab + '/lib/pieces.js'), B = require(lab + '/lib/blueprint.js');
const MODELS = require(lab + '/data/piece-models.json').pieces;

const compactPath = process.argv[2] || '/home/claude/study/compact.json';
const root = process.argv[3] || '/home/claude/corpus';
const outPath = process.argv[4] || path.join(lab, 'data/motifs.json');
const LIMIT = +(process.env.LIMIT || 0);

// ---------------------------------------------------------------- pieces

const MODDED = /^(kg_|GB_|CastleKit|MB|mm_|h_chain|Heavy|BBH|OdinsKingdom|rk_|Piece_vf|BCW_|BRP_|rae_|piece_Rustic|\$)/;
const vanilla = n => {
  const m = MODELS[n];
  return !!m && (m.prefab || '').startsWith('Assets/GameElements/Pieces') && !/^Ashlands_/.test(n);
};
const deg = Math.PI / 180;
const norm = a => ((a % 360) + 360) % 360;
const yawOfQ = q => Math.atan2(2 * (q[3] * q[1] + q[0] * q[2]), 1 - 2 * (q[1] * q[1] + q[0] * q[0])) / deg;

// what a piece is, for matching motifs across woods: a class (the shape) and a material (lib/motifs.js)
const { classOf, matOf, xAsym, symOf } = require(lab + '/lib/motifs.js');
// what is trim (the motif) and what is the building (walls, roof surfaces, furniture, plants)
const TRIM_ROLES = new Set(['beam', 'pole', 'deco', 'light', 'fence', 'window', 'floor', 'stair', 'wall', 'roof', 'roofTop', 'gable', 'roofCorner']);
// the piece's box in its own frame (measured models; the catalog where a model is missing)
const boundsCache = new Map();
function bounds(n, solid) {
  const k = n + (solid ? '|c' : '');
  if (boundsCache.has(k)) return boundsCache.get(k);
  const m = MODELS[n];
  let b;
  if (m && solid && m.collider) b = { min: m.collider.min, max: m.collider.max };
  else if (m && m.bounds) b = m.bounds;
  else { const s = P.piece(n).size; b = { min: [-s[0] / 2, -s[1] / 2, -s[2] / 2], max: [s[0] / 2, s[1] / 2, s[2] / 2] }; }
  boundsCache.set(k, b);
  return b;
}
// a box in a frame: the piece at (a, o, h) turned r degrees from the frame
function boxAt(n, a, o, h, r, solid) {
  const b = bounds(n, solid), c = Math.cos(r * deg), s = Math.sin(r * deg);
  // local x -> (c, -s) in (a, o); local z -> (s, c)
  let a0 = Infinity, a1 = -Infinity, o0 = Infinity, o1 = -Infinity;
  for (const x of [b.min[0], b.max[0]]) for (const z of [b.min[2], b.max[2]]) {
    const da = x * c + z * s, dO = -x * s + z * c;
    a0 = Math.min(a0, a + da); a1 = Math.max(a1, a + da); o0 = Math.min(o0, o + dO); o1 = Math.max(o1, o + dO);
  }
  return { a0, a1, o0, o1, h0: h + b.min[1], h1: h + b.max[1] };
}
const overlap3 = (p, q, pad = 0) => p.a0 < q.a1 - pad && p.a1 > q.a0 + pad && p.o0 < q.o1 - pad && p.o1 > q.o0 + pad && p.h0 < q.h1 - pad && p.h1 > q.h0 + pad;
const touches = (p, q, gap) => p.a0 <= q.a1 + gap && p.a1 >= q.a0 - gap && p.o0 <= q.o1 + gap && p.o1 >= q.o0 - gap && p.h0 <= q.h1 + gap && p.h1 >= q.h0 - gap;
const inter = (p, q) => Math.max(0, Math.min(p.a1, q.a1) - Math.max(p.a0, q.a0)) * Math.max(0, Math.min(p.o1, q.o1) - Math.max(p.o0, q.o0)) * Math.max(0, Math.min(p.h1, q.h1) - Math.max(p.h0, q.h0));
const vol = p => (p.a1 - p.a0) * (p.o1 - p.o0) * (p.h1 - p.h0);

// world boxes (yaw only)
function worldBox(p, solid) {
  const b = bounds(p.name, solid), c = Math.cos(p.yaw * deg), s = Math.sin(p.yaw * deg);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const x of [b.min[0], b.max[0]]) for (const z of [b.min[2], b.max[2]]) {
    const wx = p.x + x * c + z * s, wz = p.z - x * s + z * c;
    x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); z0 = Math.min(z0, wz); z1 = Math.max(z1, wz);
  }
  return { x0, x1, z0, z1, y0: p.y + b.min[1], y1: p.y + b.max[1] };
}

// ---------------------------------------------------------------- builds

const compact = JSON.parse(fs.readFileSync(compactPath, 'utf8'));
const vhDls = compact.filter(d => d.dls > 0).map(d => d.dls).sort((a, b) => a - b);
const cut = vhDls[Math.floor(vhDls.length * 0.6)];
const chosen = compact.filter(d => ((d.verdict || '').startsWith('Yes') || d.dls >= cut) && d.p.length >= 60 && d.p.length <= 6000 && !d.p.some(p => MODDED.test(p[0])))
  .map(d => ({ id: d.id, file: d.file, verdict: d.verdict || '', dls: d.dls, votes: d.votes, title: d.title, img: d.img, cat: d.cat }));
compact.length = 0;
console.log('builds chosen', chosen.length, 'download cut', cut);

function loadBuild(file) {
  const bp = B.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  const ps = [];
  for (const q of bp.pieces) {
    const tilt = Math.abs(q.q[0]) > 0.03 || Math.abs(q.q[2]) > 0.03;
    const scaled = q.s.some(v => Math.abs(v - 1) > 0.03);
    ps.push({ name: q.name, x: q.x, y: q.y, z: q.z, yaw: norm(yawOfQ(q.q)), tilt, scaled, info: P.piece(q.name) });
  }
  // turn the build so most of its walls run along the axes
  const hist = new Map();
  for (const p of ps) if (!p.tilt && p.info.role === 'wall') { const a = Math.round(p.yaw % 90); hist.set(a, (hist.get(a) || 0) + 1); }
  let rot = [...hist.entries()].sort((a, b) => b[1] - a[1])[0];
  rot = rot ? rot[0] : 0;
  if (rot > 45) rot -= 90;
  if (Math.abs(rot) > 0.5) {
    const a = rot * deg, ca = Math.cos(a), sa = Math.sin(a);
    for (const p of ps) { const x = p.x, z = p.z; p.x = x * ca - z * sa; p.z = x * sa + z * ca; p.yaw = norm(p.yaw - rot); }
  }
  for (const p of ps) { p.box = worldBox(p, false); p.sbox = worldBox(p, true); p.cbox = p.info.role === 'wall' ? p.sbox : p.box; p.axis = !p.tilt && Math.abs(((p.yaw + 45) % 90) - 45) < 3; }
  return { meta: bp.meta, ps };
}

// a 2 m grid for neighbor lookups
function gridOf(ps) {
  const g = new Map();
  ps.forEach((p, i) => {
    const b = p.box;
    for (let gx = Math.floor(b.x0 / 2); gx <= Math.floor(b.x1 / 2); gx++) for (let gz = Math.floor(b.z0 / 2); gz <= Math.floor(b.z1 / 2); gz++) {
      const k = gx * 100003 + gz; let l = g.get(k); if (!l) g.set(k, l = []); l.push(i);
    }
  });
  return (x0, x1, z0, z1) => {
    const out = new Set();
    for (let gx = Math.floor(x0 / 2); gx <= Math.floor(x1 / 2); gx++) for (let gz = Math.floor(z0 / 2); gz <= Math.floor(z1 / 2); gz++) for (const i of g.get(gx * 100003 + gz) || []) out.add(i);
    return [...out];
  };
}

// ---------------------------------------------------------------- frames

// frame yaw Y from the outward direction (nx, nz): u = (cos Y, -sin Y), n = (sin Y, cos Y)
const frameYaw = (nx, nz) => norm(Math.atan2(nx, nz) / deg);
function toFrame(f, p) {
  const c = Math.cos(f.Y * deg), s = Math.sin(f.Y * deg), dx = p.x - f.x, dz = p.z - f.z;
  return { a: dx * c - dz * s, o: dx * s + dz * c, h: p.y - f.y, r: norm(p.yaw - f.Y) };
}

// inside or outside: floor or ground under the point and something over it
function coverScore(ps, near, x, z, foot) {
  let under = 0, over = 0;
  for (const i of near(x - 0.1, x + 0.1, z - 0.1, z + 0.1)) {
    const p = ps[i], b = p.box;
    if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue;
    const r = p.info.role;
    if ((r === 'floor' || r === 'stair') && b.y1 > foot - 1 && b.y0 < foot + 0.4) under = 1;
    if (['floor', 'roof', 'roofTop', 'roofCorner'].includes(r) && b.y0 > foot + 1.9 && b.y0 < foot + 14) over = 1;
  }
  return under + over;
}
function outward(ps, near, x, z, nx, nz, foot, mid) {
  let s = 0, any = 0;
  for (const d of [1.5, 2.5, 4, 5.5]) {
    const a = coverScore(ps, near, x - nx * d, z - nz * d, foot), b = coverScore(ps, near, x + nx * d, z + nz * d, foot);
    s += a - b; any += a + b;
  }
  if (s > 0) return 1;
  if (s < 0) return -1;
  if (!mid || any) return 0; // covered on both sides: an inner wall
  return (x - mid[0]) * nx + (z - mid[1]) * nz >= 0 ? 1 : -1;
}

// ---------------------------------------------------------------- collecting one feature

const stats = { features: {}, why: {} };
const tally = (k, w) => { stats.why[k + ' ' + w] = (stats.why[k + ' ' + w] || 0) + 1; };
const instances = [];

// f: frame { x, y, z, Y }; box: { a0, a1, o0, o1, h0, h1 } (the region read); isBase(p, q): a piece of the building
// itself (the wall the feature is in, the roof surface), which anchors the motif but is not part of it;
// clear: a region nothing may stand in (a doorway); fit: what the motif fits
function collect(kind, B, ctx, f, box, isBase, fit, clear, keep) {
  stats.features[kind] = (stats.features[kind] || 0) + 1;
  const { ps, near } = ctx;
  const c = Math.cos(f.Y * deg), s = Math.sin(f.Y * deg);
  // world rectangle round the frame region
  const pts = [[box.a0, box.o0], [box.a0, box.o1], [box.a1, box.o0], [box.a1, box.o1]].map(([a, o]) => [f.x + a * c + o * s, f.z - a * s + o * c]);
  const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
  const items = [], anchors = [], baseNames = {};
  for (const i of near(Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs))) {
    const p = ps[i];
    if (p === f.self || p === f.self2) continue;
    const q = toFrame(f, p);
    const fb = boxAt(p.name, q.a, q.o, q.h, q.r, false);
    // the piece's middle in the region, and the piece not much bigger than it
    const ma = (fb.a0 + fb.a1) / 2, mo = (fb.o0 + fb.o1) / 2, mh = (fb.h0 + fb.h1) / 2;
    const inside = ma > box.a0 && ma < box.a1 && mo > box.o0 && mo < box.o1 && mh > box.h0 && mh < box.h1;
    if (isBase(p, q, fb)) { if (touches(fb, box, 0.3)) { anchors.push(fb); if (p.info.role === 'wall') baseNames[p.name] = (baseNames[p.name] || 0) + 1; } continue; }
    if (!inside) {
      // structure reaching into the region still holds things up
      if (p.info.structural && touches(fb, box, 0)) anchors.push(fb);
      continue;
    }
    const role = p.info.role;
    if (keep && !keep(p, q, fb)) { if (p.info.structural) anchors.push(fb); continue; }
    if (!TRIM_ROLES.has(role) && !/garland|banner|sign|itemstand|dragon|raven|wolf/.test(p.name)) {
      if (['nature', 'misc', 'clutter'].includes(role)) continue; // plants and odds and ends are not trim
      if (p.info.structural) anchors.push(fb);
      continue; // furniture, beds, chests: the yard and the rooms, not the motif
    }
    if (fb.a1 - fb.a0 > (box.a1 - box.a0) + 0.6 || fb.h1 - fb.h0 > (box.h1 - box.h0) + 0.6) { anchors.push(fb); continue; }
    items.push({ p, ...q, fb, sb: boxAt(p.name, q.a, q.o, q.h, q.r, true) });
  }
  if (!items.length) { tally(kind, 'bare'); return null; }
  if (items.some(t => MODDED.test(t.p.name) || !vanilla(t.p.name))) { tally(kind, 'modded'); return null; }
  if (items.some(t => t.p.tilt || t.p.scaled)) { tally(kind, 'tilted'); return null; }
  if (items.length > (kind === 'door' || kind === 'gable' ? 24 : 18)) { tally(kind, 'busy'); return null; }
  if (items.some(t => /^(door|spiral)$/.test(classOf(t.p.name)))) { tally(kind, 'door'); return null; }
  // the ground holds things that stand on it
  if (ctx.ground != null) anchors.push({ a0: -99, a1: 99, o0: -99, o1: 99, h0: ctx.ground - f.y - 5, h1: ctx.ground - f.y + 0.05 });
  // nothing floating: every piece touches an anchor or a piece that does
  const held = items.map(t => anchors.some(a => touches(t.fb, a, 0.08)));
  for (let k = 0, more = true; more && k < 20; k++) {
    more = false;
    items.forEach((t, i) => { if (!held[i] && items.some((u, j) => held[j] && touches(t.fb, u.fb, 0.08))) { held[i] = true; more = true; } });
  }
  if (held.some(h => !h)) { tally(kind, 'floating'); return null; }
  // nothing through anything: two solid pieces sharing more than half of the smaller one
  const boxy = t => !/^(gable|beam26|beam45|beam67|roof|cap|cross|xbrace|arch|stair|ocorner|icorner|dragon|raven|wolf|banner)/.test(classOf(t.p.name));
  // a piece hidden inside another (an iron pole inside a wooden one for strength) is left out; two pieces partly
  // through each other spoil the assembly
  const hidden = new Set();
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    if (!boxy(items[i]) || !boxy(items[j]) || hidden.has(i) || hidden.has(j)) continue;
    const A = items[i].sb, Bx = items[j].sb, m = Math.min(vol(A), vol(Bx)), v = inter(A, Bx);
    if (m <= 0.02 || v <= 0.5 * m) continue;
    if (v > 0.8 * m) { hidden.add(vol(A) < vol(Bx) ? i : j); continue; }
    tally(kind, 'clipping');
    if (process.env.DEBUG === 'clip' && kind === 'window') console.log('clip', items[i].p.name, items[j].p.name);
    return null;
  }
  if (hidden.size) { const keepI = items.filter((t, i) => !hidden.has(i)); items.length = 0; items.push(...keepI); tally(kind, 'hidden piece dropped'); }
  if (clear && items.some(t => overlap3(t.sb, clear, 0.05) && !/^(glass|shutter|grate|fence)$/.test(classOf(t.p.name)))) { tally(kind, 'blocked'); return null; }
  const out = items.map(t => ({ n: t.p.name, c: classOf(t.p.name), m: matOf(t.p.name), a: t.a, o: t.o, h: t.h, r: t.r }));
  const wall = Object.entries(baseNames).sort((x, y) => y[1] - x[1])[0];
  instances.push({ kind, fit: { ...fit, wall: wall ? wall[0] : null }, items: out, b: B.ix });
  tally(kind, 'kept');
  return true;
}

// ---------------------------------------------------------------- features of one build

const WALL_FILL = p => p.info.role === 'wall' && !/arch|divider|decowall|cross|grausten_window|crystal/.test(p.name) && p.axis;
function mine(B) {
  const { ps } = B, near = gridOf(ps);
  const struct = ps.filter(p => p.info.structural);
  if (struct.length < 30) return;
  const ys = struct.map(p => p.box.y0).sort((a, b) => a - b), ground = ys[Math.floor(ys.length * 0.02)];
  const walls = ps.filter(WALL_FILL);
  if (walls.length < 6) return;
  const mid = [walls.reduce((t, p) => t + p.x, 0) / walls.length, walls.reduce((t, p) => t + p.z, 0) / walls.length];
  const ctx = { ps, near, ground };
  // wall planes: key by orientation and the plane's line, 0.5 m columns along it
  const planeOf = p => { const k = Math.round(p.yaw / 90) % 2; return { k, line: Math.round((k === 0 ? p.z : p.x) * 4) / 4 }; };
  const cols = new Map();
  for (const w of walls) {
    const { k, line } = planeOf(w), b = w.cbox;
    const lo = k === 0 ? b.x0 : b.z0, hi = k === 0 ? b.x1 : b.z1;
    for (let t = Math.round(lo * 2) / 2 + 0.25; t < hi - 0.1; t += 0.5) {
      const key = `${k}|${line}|${t}`; let l = cols.get(key); if (!l) cols.set(key, l = []); l.push([Math.round(b.y0 * 20) / 20, Math.round(b.y1 * 20) / 20]);
    }
  }
  const inPlane = (k, line) => (p, q) => WALL_FILL(p) && planeOf(p).k === k && Math.abs(planeOf(p).line - line) < 0.8;

  // ---- windows: a gap 0.4 to 2.2 m tall between wall below and wall above, the same over neighboring columns
  const gaps = new Map(); // `${k}|${line}|${g0}|${g1}` -> [t...]
  for (const [key, iv] of cols) {
    iv.sort((a, b) => a[0] - b[0]);
    const m = [];
    for (const [a, b] of iv) { if (m.length && a <= m[m.length - 1][1] + 0.06) m[m.length - 1][1] = Math.max(m[m.length - 1][1], b); else m.push([a, b]); }
    for (let i = 0; i + 1 < m.length; i++) {
      const g0 = m[i][1], g1 = m[i + 1][0];
      if (g1 - g0 < 0.4 || g1 - g0 > 2.2 || m[i][1] - m[i][0] < 0.45) continue;
      const [k, line, t] = key.split('|').map(Number);
      const gk = `${k}|${line}|${g0}|${g1}|${m[i][0]}`;
      let l = gaps.get(gk); if (!l) gaps.set(gk, l = []); l.push(t);
    }
  }
  const doorsHere = ps.filter(p => p.info.role === 'door');
  for (const [gk, ts] of gaps) {
    const [k, line, g0, g1, foot] = gk.split('|').map(Number);
    ts.sort((a, b) => a - b);
    const runs = [];
    for (const t of ts) { const r = runs[runs.length - 1]; if (r && t - r[r.length - 1] < 0.51) r.push(t); else runs.push([t]); }
    for (const r of runs) {
      const W = r.length * 0.5, H = Math.round((g1 - g0) * 4) / 4;
      if (W > 4.01) continue;
      const tc = (r[0] + r[r.length - 1]) / 2;
      const x = k === 0 ? tc : line, z = k === 0 ? line : tc;
      if (doorsHere.some(d => Math.hypot(d.x - x, d.z - z) < W / 2 + 0.5 && d.y > g0 - 2.5 && d.y < g1 + 0.5)) continue;
      const [nx, nz] = k === 0 ? [0, 1] : [1, 0];
      const sg = outward(ps, near, x, z, nx, nz, foot, mid);
      if (!sg) { tally('window', 'unsure side'); continue; }
      const f = { x, y: g0, z, Y: frameYaw(nx * sg, nz * sg) };
      collect('window', B, ctx, f, { a0: -W / 2 - 1.3, a1: W / 2 + 1.3, o0: -0.35, o1: 1.4, h0: -1.0, h1: H + 1.0 }, inPlane(k, line),
        { w: W, h: H, sill: Math.round((g0 - foot) * 4) / 4 }, null);
    }
  }

  // ---- doors: the opening of each door piece; two doors side by side in one wall are one 4 m doorway
  const houseDoors = doorsHere.filter(d => !/fence_gate/.test(d.name) && !d.tilt && d.axis);
  const pairedWith = new Map();
  for (const d of houseDoors) for (const e of houseDoors) {
    if (e === d || pairedWith.has(d) || pairedWith.has(e)) continue;
    if (Math.hypot(e.x - d.x, e.z - d.z) < 2.6 && Math.abs(e.y - d.y) < 0.3 && Math.abs(Math.sin((e.yaw - d.yaw) * deg)) < 0.1) { pairedWith.set(d, e); pairedWith.set(e, d); }
  }
  const doneDoors = new Set();
  for (const d of houseDoors) {
    if (doneDoors.has(d)) continue;
    const e = pairedWith.get(d);
    doneDoors.add(d); if (e) doneDoors.add(e);
    const op = { ...P.doorOpening(d) };
    if (e) {
      const o2 = P.doorOpening(e);
      if (Math.abs((e.x - d.x) * op.nx + (e.z - d.z) * op.nz) > 0.35) { tally('door', 'odd pair'); continue; }
      op.x = (op.x + o2.x) / 2; op.z = (op.z + o2.z) / 2; op.w = op.w + o2.w;
    }
    const rise = op.y - ground;
    if (rise > 1.6 || rise < -0.4) { tally('door', 'upper'); continue; }
    const sg = outward(ps, near, op.x, op.z, op.nx, op.nz, op.y, mid);
    if (!sg) { tally('door', 'unsure side'); continue; }
    const f = { x: op.x, y: op.y, z: op.z, Y: frameYaw(op.nx * sg, op.nz * sg), self: d, self2: e };
    const k = Math.abs(op.nx) > 0.5 ? 1 : 0, line = Math.round((k === 0 ? op.z : op.x) * 4) / 4;
    const keep = (p, q, fb) => !(p.info.role === 'floor' && (fb.h0 + fb.h1) / 2 > 0.4) && !(p.info.role === 'wall' && fb.h1 - fb.h0 > 1.5 && Math.abs(Math.sin(q.r * deg)) < 0.2);
    collect('door', B, ctx, f, { a0: -op.w / 2 - 1.6, a1: op.w / 2 + 1.6, o0: -0.35, o1: 2.6, h0: -Math.max(0, rise) - 0.35, h1: op.h + 1.1 }, inPlane(k, line),
      { w: op.w, h: op.h, door: d.name, rise: Math.round(Math.max(0, rise) * 4) / 4 },
      { a0: -op.w / 2 + 0.15, a1: op.w / 2 - 0.15, o0: -0.9, o1: 1.0, h0: 0.15, h1: Math.min(op.h, 2.3) - 0.05 }, keep);
  }

  // ---- outside corners at the foot of the walls: two wall planes meeting, the diagonal outward open
  const ends = new Map();
  for (const w of walls) {
    if (w.box.y0 > ground + 0.6) continue; // the ground storey only
    const { k, line } = planeOf(w), b = w.box;
    for (const t of k === 0 ? [b.x0, b.x1] : [b.z0, b.z1]) {
      const x = k === 0 ? t : line, z = k === 0 ? line : t;
      const key = `${Math.round(x * 2) / 2}|${Math.round(z * 2) / 2}`;
      let e = ends.get(key); if (!e) ends.set(key, e = { x: 0, z: 0, n: 0, ks: new Map(), y: Infinity });
      e.ks.set(k, line); e.y = Math.min(e.y, b.y0);
    }
  }
  for (const [key, e] of ends) {
    if (e.ks.size < 2) continue;
    const x = e.ks.get(1), z = e.ks.get(0);
    // which quadrant is outside
    // the outside quadrant is the least covered one, with the quadrant across from it covered more than it and both
    // quadrants beside it
    let best = null;
    const cov = (sx, sz) => coverScore(ps, near, x + sx * 1.5, z + sz * 1.5, e.y) + coverScore(ps, near, x + sx * 2.8, z + sz * 2.8, e.y);
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const out = cov(sx, sz), inn = cov(-sx, -sz), side1 = cov(sx, -sz), side2 = cov(-sx, sz);
      if (out < inn && out < side1 && out < side2) best = [sx, sz];
    }
    if (!best) { tally('corner', 'not outside'); continue; }
    const l = Math.SQRT1_2, f = { x, y: e.y, z, Y: frameYaw(best[0] * l, best[1] * l) };
    const isBase = (p, q) => WALL_FILL(p) && ((planeOf(p).k === 0 && Math.abs(planeOf(p).line - z) < 0.8) || (planeOf(p).k === 1 && Math.abs(planeOf(p).line - x) < 0.8));
    const keep = p => ((p.x - x) * best[0] > -0.3 || (p.z - z) * best[1] > -0.3) && ['beam', 'pole', 'deco', 'light', 'wall', 'fence'].includes(p.info.role);
    collect('corner', B, ctx, f, { a0: -1.7, a1: 1.7, o0: -0.3, o1: 1.5, h0: -0.6, h1: 3.2 }, isBase, { y: 0 }, null, keep);
  }

  // ---- gable ends: the last ridge cap of a ridge line, with a gable or wall face under it
  const caps = ps.filter(p => p.info.role === 'roofTop' && !/wall_roof_top/.test(p.name) && !p.tilt && p.axis);
  const capAt = new Set(caps.map(p => `${Math.round(p.x)}|${Math.round(p.y * 2)}|${Math.round(p.z)}`));
  for (const cp of caps) {
    const ux = Math.cos(cp.yaw * deg), uz = -Math.sin(cp.yaw * deg); // the ridge runs along the cap's local x
    for (const sg of [-1, 1]) {
      if (capAt.has(`${Math.round(cp.x + ux * 2 * sg)}|${Math.round(cp.y * 2)}|${Math.round(cp.z + uz * 2 * sg)}`)) continue;
      const ex = cp.x + ux * sg, ez = cp.z + uz * sg, nx = ux * sg, nz = uz * sg;
      // the gable face: a gable or wall piece square to the ridge within 1.5 m inside the end, under the apex
      const face = near(ex - 2, ex + 2, ez - 2, ez + 2).map(i => ps[i]).filter(p => ['gable', 'wall'].includes(p.info.role) && p.axis && !p.tilt &&
        Math.abs(Math.abs(Math.cos((p.yaw - cp.yaw) * deg))) < 0.2 && p.box.y1 > cp.y - 3 && p.box.y0 < cp.y)
        .map(p => ({ p, d: (p.x - ex) * nx + (p.z - ez) * nz, along: Math.abs((p.x - ex) * nz - (p.z - ez) * nx) }))
        .filter(t => t.d > -1.6 && t.d < 0.3 && t.along < 2.2).sort((a, b) => b.d - a.d);
      if (!face.length) { tally('gable', 'no face'); continue; }
      const d = face[0].d, slope = ps.some(p => /roof.*45|roof_45/.test(p.name) && p.info.role === 'roof' && Math.hypot(p.x - cp.x, p.z - cp.z) < 2.6) ? 45 : 26;
      const f = { x: ex + nx * d, y: cp.y, z: ez + nz * d, Y: frameYaw(nx, nz), self: cp };
      const isBase = (p, q) => ['roof', 'roofTop', 'roofCorner'].includes(p.info.role) || (['gable', 'wall'].includes(p.info.role) && Math.abs(q.o) < 0.8 && p.axis && Math.abs(Math.sin(q.r * deg)) < 0.2);
      // inside the gable triangle (a little over its edges) and in front of the face
      const kk = slope === 45 ? 1 : 0.5;
      const keep = (p, q, fb) => {
        const ma = (fb.a0 + fb.a1) / 2, mh = (fb.h0 + fb.h1) / 2, mo = (fb.o0 + fb.o1) / 2;
        return mh <= -kk * Math.max(0, Math.abs(ma) - 0.3) + 0.8 && mh >= -kk * 4 - 0.2 && mo < 1.1 && !['floor', 'stair', 'wall'].includes(p.info.role);
      };
      collect('gable', B, ctx, f, { a0: -4.2, a1: 4.2, o0: -0.4, o1: 1.8, h0: -4.6, h1: 2.2 }, isBase, { slope, overhang: Math.round(-d * 4) / 4 }, null, keep);
    }
  }

  // ---- eaves: the lowest piece of a roof slope (nothing below it down the slope), one 2 m bay
  const roofs = ps.filter(p => p.info.role === 'roof' && !p.tilt && p.axis && /slope26|slope45/.test(p.info.shape));
  const roofAt = new Set(roofs.map(p => `${Math.round(p.x)}|${Math.round(p.z)}`));
  let eaves = 0;
  for (const rp of roofs) {
    const nx = Math.sin(rp.yaw * deg), nz = Math.cos(rp.yaw * deg); // down the slope: the piece's local +z
    if (roofAt.has(`${Math.round(rp.x + nx * 2)}|${Math.round(rp.z + nz * 2)}`)) continue;
    if (eaves++ > 60) break; // enough bays per build
    const rise = rp.info.shape === 'slope45' ? 2 : 1;
    const f = { x: rp.x + nx, y: rp.y - (rise === 2 ? 1 : 0), z: rp.z + nz, Y: frameYaw(nx, nz), self: rp }; // a 26 degree roof pivots on its low edge, a 45 in its middle
    const isBase = p => ['roof', 'roofTop', 'roofCorner', 'gable'].includes(p.info.role) || WALL_FILL(p);
    // the wall under the eave: its outer face sets how far the roof reaches past it
    let oFace = -Infinity;
    for (const i of near(f.x - 3, f.x + 3, f.z - 3, f.z + 3)) {
      const p = ps[i];
      if (!WALL_FILL(p)) continue;
      const qq = toFrame(f, p);
      if (Math.abs(Math.sin(qq.r * deg)) > 0.2) continue;
      const fb = boxAt(p.name, qq.a, qq.o, qq.h, qq.r, false);
      if (fb.a1 < -0.9 || fb.a0 > 0.9 || fb.o1 > 0.6 || fb.o1 < -3 || fb.h1 < -3.2 || fb.h1 > 2.7) continue;
      oFace = Math.max(oFace, fb.o1);
    }
    if (oFace === -Infinity) { tally('eave', 'no wall'); if (process.env.DEBUG === 'eave') console.log('nowall', B.ix, rp.name, rp.x.toFixed(1), rp.y.toFixed(1), rp.z.toFixed(1), rp.yaw.toFixed(0), near(f.x - 3, f.x + 3, f.z - 3, f.z + 3).map(i => ps[i]).filter(p => p.info.role === 'wall').slice(0, 4).map(p => { const qq = toFrame(f, p); return p.name + ':' + [qq.a, qq.o, qq.h, qq.r].map(v => v.toFixed(1)).join(','); }).join(' ')); continue; }
    const keep = (p, q, fb) => (fb.o0 + fb.o1) / 2 > oFace - 0.25 && !['floor', 'stair', 'wall', 'fence'].includes(p.info.role);
    collect('eave', B, ctx, f, { a0: -1.1, a1: 1.1, o0: -1.6, o1: 1.4, h0: -2.2, h1: 0.4 }, isBase, { slope: rise === 2 ? 45 : 26, overhang: Math.round(-oFace * 4) / 4 }, null, keep);
  }
}

// ---------------------------------------------------------------- run

const builds = [];
let n = 0;
for (const d of chosen) {
  if (LIMIT && n >= LIMIT) break;
  let B;
  try { B = loadBuild(d.file); } catch (e) { continue; }
  B.ix = builds.length;
  builds.push({ id: d.id, title: d.title, creator: (B.meta.Creator || '').trim(), dls: d.dls, votes: d.votes, verdict: d.verdict, img: d.img, file: d.file, cat: d.cat });
  mine(B);
  n++;
  if (n % 50 === 0) console.log(n, 'builds,', instances.length, 'assemblies');
}
console.log('features', stats.features);

// ---------------------------------------------------------------- clustering

const q = (v, s) => Math.round(v / s) * s;
const fmt = v => (Math.abs(v) < 1e-9 ? 0 : +v.toFixed(2));
function mirrorItem(t) {
  const r = xAsym(t.c) ? norm(180 - t.r) : norm(-t.r);
  return { ...t, a: -t.a, r };
}
function sigOf(items, step) {
  return items.map(t => { const sy = symOf(t.c); return `${t.c}@${fmt(q(t.a, step))},${fmt(q(t.o, step === 0.25 ? 0.1 : 0.25))},${fmt(q(t.h, step))},${q(norm(t.r) % sy, 15) % sy}`; }).sort().join(';');
}
const fitKey = (kind, fit) => kind === 'window' ? `${fit.w}x${fit.h}` : kind === 'door' ? `${fit.w}x${Math.min(fit.h, 3)}` : kind === 'gable' ? `${fit.slope}` : kind === 'eave' ? `${fit.slope}` : '';
const clusters = new Map();
for (const ins of instances) {
  const a = sigOf(ins.items, 0.25), m = ins.items.map(mirrorItem), b = sigOf(m, 0.25);
  const flip = b < a, items = flip ? m : ins.items, sig = flip ? b : a;
  const coarse = sigOf(items.map(t => ({ ...t })), 0.5);
  const key = `${ins.kind}|${fitKey(ins.kind, ins.fit)}|${sig}`;
  let c = clusters.get(key);
  if (!c) clusters.set(key, c = { kind: ins.kind, fitKey: fitKey(ins.kind, ins.fit), sig, coarse, uses: [], fits: [] });
  c.uses.push({ b: ins.b, items }); c.fits.push(ins.fit);
}
// near copies: the same pieces within half a metre are one motif, under its most used form
const byCoarse = new Map();
for (const c of [...clusters.values()].sort((x, y) => y.uses.length - x.uses.length)) {
  const k = `${c.kind}|${c.fitKey}|${c.coarse}`;
  const top = byCoarse.get(k);
  if (top) { top.uses.push(...c.uses); top.fits.push(...c.fits); top.variants = (top.variants || 1) + 1; } else byCoarse.set(k, c);
}

const pop = b => Math.log10(1 + (builds[b].dls || 0)) + ((builds[b].verdict || '').startsWith('Yes') ? 2.5 : 0);
const BI = P.BIOME_ORDER;
const needs = n => (/^stave_|^scale_/.test(n) ? 'Deep North' : P.needs(n));
const motifs = [];
for (const c of byCoarse.values()) {
  const bset = [...new Set(c.uses.map(u => u.b))];
  // every clean assembly is kept; how many builds and uses it has sets its weight
  // the example: the use in the best-liked build
  const ex = c.uses.slice().sort((u, v) => pop(v.b) - pop(u.b))[0];
  const items = ex.items.map(t => ({ n: t.n, c: t.c, m: t.m, a: fmt(t.a), o: fmt(t.o), h: fmt(t.h), r: Math.round(t.r * 10) / 10 }))
    .sort((s, t) => s.h - t.h || s.a - t.a);
  const mats = {};
  for (const t of items) if (!['prop', 'glass'].includes(t.m)) mats[t.m] = (mats[t.m] || 0) + 1;
  const biome = items.reduce((m, t) => (BI.indexOf(needs(t.n)) > BI.indexOf(m) ? needs(t.n) : m), 'Meadows');
  const fit = { ...c.fits[0] };
  if (c.kind === 'gable') fit.overhang = c.fits.map(f => f.overhang).sort((a, b) => a - b)[Math.floor(c.fits.length / 2)];
  
  const popAvg = bset.reduce((t, b) => t + pop(b), 0) / bset.length;
  motifs.push({
    key: `${c.kind}|${c.fitKey}|${c.sig}`, kind: c.kind, fit, pieces: items, mats, biome,
    builds: bset.length, uses: c.uses.length, variants: c.variants || 1, pop: +popAvg.toFixed(2),
    src: bset.sort((a, b) => pop(b) - pop(a)).slice(0, 5).map(b => ({ id: builds[b].id, title: builds[b].title, creator: builds[b].creator, dls: builds[b].dls, verdict: builds[b].verdict, img: builds[b].img })),
    srcBuild: builds[ex.b].id,
  });
}
// rank: how many builds use it, then how well liked they are
for (const m of motifs) m.rank = +(Math.log2(1 + m.builds) * 1.5 + m.pop + Math.min(1, m.pieces.length / 4)).toFixed(2);
motifs.sort((a, b) => b.rank - a.rank);
// a cap per kind keeps the file small: the best-ranked first
const CAP = { window: 700, door: 200, corner: 200, gable: 300, eave: 300 }, seen = {};
const keptMotifs = motifs.filter(m => (seen[m.kind] = (seen[m.kind] || 0) + 1) <= CAP[m.kind]);
motifs.length = 0; motifs.push(...keptMotifs);

// stable IDs: a motif keeps its ID from one run to the next while its key stays the same
const PREFIX = { window: 'MW', door: 'MD', corner: 'MC', gable: 'MG', eave: 'ME' };
let old = {};
try { for (const m of JSON.parse(fs.readFileSync(outPath, 'utf8')).motifs) old[m.key] = m.id; } catch (e) { old = {}; }
const used = new Set(Object.values(old));
const next = {};
for (const m of motifs) {
  if (old[m.key]) { m.id = old[m.key]; continue; }
  const pf = PREFIX[m.kind];
  let k = next[pf] || 1;
  while (used.has(`${pf}-${String(k).padStart(4, '0')}`)) k++;
  m.id = `${pf}-${String(k).padStart(4, '0')}`; used.add(m.id); next[pf] = k + 1;
}
const byKind = {};
for (const m of motifs) byKind[m.kind] = (byKind[m.kind] || 0) + 1;
console.log('motifs', byKind);
const why = {};
for (const [k, v] of Object.entries(stats.why).sort()) why[k] = v;
console.log(why);
for (const m of motifs) { m.p = m.pieces.map(t => [t.n, t.a, t.o, t.h, t.r]); delete m.pieces; m.src = m.src.slice(0, 3); }
fs.writeFileSync(outPath, JSON.stringify({
  about: 'Exterior motifs mined from the best-liked corpus builds by lab/mine_motifs.js. Frame: a along the wall, o out from it, h up from the feature foot; r piece yaw from the frame. See docs/BUILDING_DETAILS.md.',
  builds: builds.length, counts: byKind, skipped: why, motifs,
}, null, 0).replace(/\{"key"/g, '\n{"key"'));
console.log('wrote', outPath);
