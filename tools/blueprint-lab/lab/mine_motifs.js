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
// every prefab and model that ships with the game counts (D-065: trader decor, Dvergr props, tents, crafting
// stations as props); the ruin pieces of the Ashlands are scenery
const vanilla = n => !!MODELS[n] && !MODDED.test(n) && !/^Ashlands_/.test(n);
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
// VH_SHAPES=collider|coarse|fine: whether pieces visibly touch (nothing floating) and how far one goes into another (hidden pieces,
// clips between pieces, clips into the wall) are read from those shapes (lab/shape_mode.js), each part as a box in the feature's
// frame; unset: the model bounds and collider boxes as the committed motifs.json was made. What counts as in the region, the
// anchor lists and the doorway cover test keep the model bounds.
const SM = require('./shape_mode.js');
function fineBoxes(p, f) {
  const W = SM.parts({ name: p.name, x: p.x, y: p.y, z: p.z, yaw: p.yaw });
  if (!W || !W.length) return null;
  const c = Math.cos(f.Y * deg), s = Math.sin(f.Y * deg);
  return W.map(w => {
    let a0 = Infinity, a1 = -Infinity, o0 = Infinity, o1 = -Infinity, h0 = Infinity, h1 = -Infinity;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const X = w.c[0] + sx * w.a[0][0] * w.h[0] + sy * w.a[1][0] * w.h[1] + sz * w.a[2][0] * w.h[2];
      const Y = w.c[1] + sx * w.a[0][1] * w.h[0] + sy * w.a[1][1] * w.h[1] + sz * w.a[2][1] * w.h[2];
      const Z = w.c[2] + sx * w.a[0][2] * w.h[0] + sy * w.a[1][2] * w.h[1] + sz * w.a[2][2] * w.h[2];
      const dx = X - f.x, dz = Z - f.z, a = dx * c - dz * s, o = dx * s + dz * c, h = Y - f.y;
      a0 = Math.min(a0, a); a1 = Math.max(a1, a); o0 = Math.min(o0, o); o1 = Math.max(o1, o); h0 = Math.min(h0, h); h1 = Math.max(h1, h);
    }
    return { a0, a1, o0, o1, h0, h1 };
  });
}
const L = x => (Array.isArray(x) ? x : [x]);
const V = x => L(x).reduce((t, b) => t + vol(b), 0);
const I = (x, y) => L(x).reduce((t, a) => t + L(y).reduce((u, b) => u + inter(a, b), 0), 0);
const D = (x, y) => L(x).reduce((m, a) => L(y).reduce((n, b) => Math.max(n, depthOf(a, b)), m), 0);
const depthOf = (A, Bx) => Math.max(0, Math.min(Math.min(A.a1, Bx.a1) - Math.max(A.a0, Bx.a0), Math.min(A.o1, Bx.o1) - Math.max(A.o0, Bx.o0), Math.min(A.h1, Bx.h1) - Math.max(A.h0, Bx.h0)));
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

// ---------------------------------------------------------------- what belongs to a feature

// the trim each feature takes; anything else near it (stairs passing by, a deck, the next roof) is the building
const TRIM = /^(beam\d+|beam26|beam45|beam67|pole\d|pillar|pillarBase|xbrace\d\d|cross26|cross45|arch|ledge|fence|panel|wallTorch|groundTorch|hangLight|brazier|lantern|candle|dragon|raven|wolf|stand|standH|banner|sign|garland)$/;
function allowed(kind, c, fb, fit) {
  const mh = (fb.h0 + fb.h1) / 2, mo = (fb.o0 + fb.o1) / 2;
  if (TRIM.test(c)) return !(kind === 'gable' && c === 'fence');
  if (kind === 'window') {
    if (/^(shutter|glass|grate)$/.test(c)) return true;
    // a 1 m board as a sill or a head; floors and roofs out from a window make a box round it, which is a dormer or a
    // bay and not window trim
    if (c === 'floor1') return mo > -0.1 && ((mh > -0.45 && mh < 0.25) || (mh > fit.h - 0.2 && mh < fit.h + 0.5));
    if (/^(wall1x1|wallHalf|logWall|block1)$/.test(c)) return true; // box sides, sills
    return false;
  }
  if (kind === 'door') {
    if (/^(floor1|floor2|stair)$/.test(c)) return mh < 0.25; // a step, a landing, stairs down
    if (/^(roof26|roof45|gable26|gable45|cap26|cap45)$/.test(c)) return fb.h0 > fit.h - 0.4; // a hood or a porch roof
    if (/^(shutter|wall1x1|wallHalf|logWall)$/.test(c)) return true;
    return false;
  }
  if (kind === 'gable') return /^(shutter|glass)$/.test(c);
  // a dormer is a small roof of its own: its slopes, ridge, gable face, cheek walls and window
  if (kind === 'dormer') return /^(shutter|glass|roof26|roof45|cap26|cap45|gable26|gable45|gable26inv|gable45inv|wall1x1|wallHalf|wall2|logWall|icorner26|icorner45|ocorner26|ocorner45|cross26|cross45)$/.test(c);
  // a plain stretch of wall with something hung on it: the accents and what holds them (a bracket, a board)
  if (kind === 'wallface') return /^(shutter|hooknchain|chain|cloth)$/.test(c);
  if (kind === 'corner' || kind === 'icorner') return /^(logWall|logWall4|block1|wall1x1)$/.test(c);
  // the foot of a wall: stone courses, log sills and a 1 m board laid out from the wall
  if (kind === 'base') return /^(logWall|logWall4|block1|block2|wall1x1|wallHalf|floor1)$/.test(c) && mh < 0.9;
  // a porch: its deck and steps, its roof over the door, its side walls and rails
  if (kind === 'porch') {
    if (/^(floor1|floor2|stair)$/.test(c)) return mh < 0.4;
    if (/^(roof26|roof45|cap26|cap45|gable26|gable45|ocorner26|ocorner45)$/.test(c)) return fb.h0 > fit.h - 0.6;
    if (/^(wall1x1|wallHalf|logWall|shutter)$/.test(c)) return fb.h1 < fit.h + 0.6;
    return false;
  }
  // stairs up to a raised door: the stairs (the generator lays its own), the landing, cheek walls and the rails
  if (kind === 'stairentry') {
    if (/^(stair|floor1|floor2)$/.test(c)) return mh < 0.4;
    if (/^(wall1x1|wallHalf)$/.test(c)) return mh < 1.4;
    if (/^(roof26|roof45|cap26|cap45)$/.test(c)) return fb.h0 > fit.h - 0.6;
    return false;
  }
  // a balcony or gallery outside an upper door: its floor, the rail or parapet round it, a roof over it
  if (kind === 'balcony') {
    if (/^(floor1|floor2)$/.test(c)) return mh > -0.6 && mh < 0.35 && mo > 0.2;
    if (/^(wall1x1|wallHalf)$/.test(c)) return mh > 0 && fb.h1 < 1.5 && mo > 0.3;
    if (/^(roof26|roof45|cap26|cap45)$/.test(c)) return fb.h0 > fit.h - 0.6;
    return false;
  }
  // the top of a chimney stack: the last courses, slabs, a pot, grates and vents
  if (kind === 'chimney') return /^(block1|block2|wall1x1|wallHalf|wall2|floor1|floor2|pillar|pillarBase|grate|stoneWindow|roof26|roof45|cap26|cap45)$/.test(c);
  return false; // eaves, wall tops and roof valleys: timber, lamps and carvings only
}
// in front of an opening, a person (doors) or the light (windows) has to get through: only a mullion, a lattice,
// glass or a shutter may stand in it
// the most pieces one assembly may have before it is a part of the building more than trim on it
const BUSY = { door: 24, gable: 24, porch: 40, balcony: 40, stairentry: 30, chimney: 24, dormer: 40, base: 10, walltop: 12, corner: 18, icorner: 18, wallface: 12, valley: 12 };
const OPEN_OK = /^(glass|shutter|grate|fence|beam1|beam2|pole1|pole2|beam26|beam45|xbrace26|xbrace45|panel)$/;

// ---------------------------------------------------------------- collecting one feature

const stats = { features: {}, why: {} };
const tally = (k, w) => { stats.why[k + ' ' + w] = (stats.why[k + ' ' + w] || 0) + 1; };
const instances = [];

// f: frame { x, y, z, Y }; box: { a0, a1, o0, o1, h0, h1 } (the region read); isBase(p, q): a piece of the building
// itself (the wall the feature is in, the roof surface), which anchors the motif but is not part of it;
// clear: a region nothing may stand in (a doorway); fit: what the motif fits
function collect(kind, B, ctx, f, box, isBase, fit, clear, keep, need) {
  stats.features[kind] = (stats.features[kind] || 0) + 1;
  const { ps, near } = ctx;
  const c = Math.cos(f.Y * deg), s = Math.sin(f.Y * deg);
  // world rectangle round the frame region
  const pts = [[box.a0, box.o0], [box.a0, box.o1], [box.a1, box.o0], [box.a1, box.o1]].map(([a, o]) => [f.x + a * c + o * s, f.z - a * s + o * c]);
  const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
  const items = [], anchors = [], baseNames = {}, baseSolid = [];
  // the boxes a piece's shapes make in this frame (VH_SHAPES), or its one box where it has none
  const shownOf = (bx, sol) => { if (!SM.MODE) return sol || bx; if (!bx.pc) return [bx]; return bx.fp || (bx.fp = fineBoxes(bx.pc, f) || [sol || bx]); };
  const touchesS = (A, Bx, gap) => (!SM.MODE ? touches(A, Bx, gap) : shownOf(A).some(a => shownOf(Bx).some(b => touches(a, b, gap))));
  for (const i of near(Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs))) {
    const p = ps[i];
    if (p === f.self || p === f.self2) continue;
    const q = toFrame(f, p);
    const fb = boxAt(p.name, q.a, q.o, q.h, q.r, false);
    // the piece's middle in the region, and the piece not much bigger than it
    const ma = (fb.a0 + fb.a1) / 2, mo = (fb.o0 + fb.o1) / 2, mh = (fb.h0 + fb.h1) / 2;
    const inside = ma > box.a0 && ma < box.a1 && mo > box.o0 && mo < box.o1 && mh > box.h0 && mh < box.h1;
    if (isBase(p, q, fb)) {
      if (touches(fb, box, 0.3)) {
        fb.pc = p; anchors.push(fb);
        if (p.info.role === 'wall') { baseNames[p.name] = (baseNames[p.name] || 0) + 1; baseSolid.push(SM.MODE ? (fineBoxes(p, f) || boxAt(p.name, q.a, q.o, q.h, q.r, true)) : boxAt(p.name, q.a, q.o, q.h, q.r, true)); }
      }
      continue;
    }
    if (!inside) {
      // structure reaching into the region still holds things up
      if (p.info.structural && touches(fb, box, 0)) { fb.pc = p; anchors.push(fb); }
      continue;
    }
    const role = p.info.role;
    if (keep && !keep(p, q, fb)) { if (p.info.structural) { fb.pc = p; anchors.push(fb); } continue; }
    if (!allowed(kind, classOf(p.name), fb, fit)) { if (p.info.structural) { fb.pc = p; anchors.push(fb); } continue; }
    if (!TRIM_ROLES.has(role) && !/garland|banner|sign|itemstand|dragon|raven|wolf|hooknchain|WallChain|cloth_hanging_long|fenrirhide_hanging/.test(p.name)) {
      if (['nature', 'misc', 'clutter'].includes(role)) continue; // plants and odds and ends are not trim
      if (p.info.structural) { fb.pc = p; anchors.push(fb); }
      continue; // furniture, beds, chests: the yard and the rooms, not the motif
    }
    if (fb.a1 - fb.a0 > (box.a1 - box.a0) + 0.6 || fb.h1 - fb.h0 > (box.h1 - box.h0) + 0.6) { fb.pc = p; anchors.push(fb); continue; }
    fb.pc = p;
    items.push({ p, ...q, fb, sb: boxAt(p.name, q.a, q.o, q.h, q.r, true) });
  }
  if (!items.length) { tally(kind, 'bare'); return null; }
  if (items.some(t => MODDED.test(t.p.name) || !vanilla(t.p.name))) { tally(kind, 'modded'); return null; }
  if (items.some(t => t.p.tilt || t.p.scaled)) { tally(kind, 'tilted'); return null; }
  if (items.length > (BUSY[kind] || 18)) { tally(kind, 'busy'); return null; }
  if (items.some(t => /^(door|spiral)$/.test(classOf(t.p.name)))) { tally(kind, 'door'); return null; }
  // the ground holds things that stand on it
  if (ctx.ground != null) anchors.push({ a0: -99, a1: 99, o0: -99, o1: 99, h0: ctx.ground - f.y - 5, h1: ctx.ground - f.y + 0.05 });
  // nothing floating: every piece touches an anchor or a piece that does
  const held = items.map(t => anchors.some(a => touchesS(t.fb, a, 0.08)));
  for (let k = 0, more = true; more && k < 20; k++) {
    more = false;
    items.forEach((t, i) => { if (!held[i] && items.some((u, j) => held[j] && touchesS(t.fb, u.fb, 0.08))) { held[i] = true; more = true; } });
  }
  if (held.some(h => !h)) { tally(kind, 'floating'); return null; }
  // nothing through anything: two solid pieces sharing more than half of the smaller one
  const boxy = t => !/^(gable|beam26|beam45|beam67|roof|cap|cross|xbrace|arch|stair|ocorner|icorner|dragon|raven|wolf|banner)/.test(classOf(t.p.name));
  // a piece hidden inside another (an iron pole inside a wooden one for strength) is left out; two pieces partly
  // through each other spoil the assembly
  // two pieces partly through each other are kept as a deliberate clip (D-065: pieces nested or set into a wall)
  // when the smaller one goes in no deeper than 0.4 m; its depth goes with it (clip), and the generator allows that
  // much and no more
  const hidden = new Set(), clipOf = new Map();
  const depth = (A, Bx) => Math.max(0, Math.min(Math.min(A.a1, Bx.a1) - Math.max(A.a0, Bx.a0), Math.min(A.o1, Bx.o1) - Math.max(A.o0, Bx.o0), Math.min(A.h1, Bx.h1) - Math.max(A.h0, Bx.h0)));
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    if (!boxy(items[i]) || !boxy(items[j]) || hidden.has(i) || hidden.has(j)) continue;
    const A = shownOf(items[i].fb, items[i].sb), Bx = shownOf(items[j].fb, items[j].sb), m = Math.min(V(A), V(Bx)), v = I(A, Bx);
    if (m <= 0.02 || v <= 0.5 * m) continue;
    if (v > 0.8 * m) { hidden.add(V(A) < V(Bx) ? i : j); continue; }
    const d = D(A, Bx), timber = t => ['beam', 'pole'].includes(t.p.info.role);
    // timber through timber is a joint, which the generator allows anyway
    const k = timber(items[i]) && !timber(items[j]) ? j : !timber(items[i]) && timber(items[j]) ? i : V(A) < V(Bx) ? i : j;
    if (d > 0.4) {
      tally(kind, 'clipping');
      if (process.env.DEBUG === 'clip' && kind === 'window') console.log('clip', items[i].p.name, items[j].p.name);
      return null;
    }
    if (!(timber(items[i]) && timber(items[j]))) clipOf.set(k, Math.max(clipOf.get(k) || 0, d));
  }
  // set into the wall the feature is on: a log end through it, a sconce sunk in it
  // (timber laid on its own wall overlaps it a little in every build and is allowed anyway: only props, and timber
  // sunk deeper than 0.15 m, count)
  items.forEach((t, i) => {
    const prop = !t.p.info.structural || ['deco', 'light', 'craft', 'storage', 'seat', 'table', 'misc', 'fire'].includes(t.p.info.role);
    for (const w of baseSolid) { const sbx = shownOf(t.fb, t.sb), d = D(sbx, w); if (d > (prop ? 0.06 : 0.15) && d < 0.6 && V(sbx) > 0.0005) clipOf.set(i, Math.max(clipOf.get(i) || 0, Math.min(d, 0.5))); }
  });
  items.forEach((t, i) => { if (clipOf.has(i) && clipOf.get(i) > 0.04) t.clip = Math.round(clipOf.get(i) * 100) / 100; });
  if ([...clipOf.values()].some(v => v > 0.04)) tally(kind, 'kept clip');
  if (hidden.size) { const keepI = items.filter((t, i) => !hidden.has(i)); items.length = 0; items.push(...keepI); tally(kind, 'hidden piece dropped'); }
  // in front of the opening: a piece covering more than a third of it (seen from outside) blocks it
  const cover = t => {
    if (!overlap3(t.fb, clear, 0.05)) return 0;
    const da = Math.max(0, Math.min(t.fb.a1, clear.a1) - Math.max(t.fb.a0, clear.a0)), dh = Math.max(0, Math.min(t.fb.h1, clear.h1) - Math.max(t.fb.h0, clear.h0));
    return da * dh / ((clear.a1 - clear.a0) * (clear.h1 - clear.h0));
  };
  if (clear && items.some(t => !(clear.ok || /^(glass|shutter|grate|fence)$/).test(classOf(t.p.name)) && (kind === 'door' ? cover(t) > 0.05 : cover(t) > 0.34))) { tally(kind, 'blocked'); return null; }
  // a motif is trim: wall pieces alone are the wall
  if (!items.some(t => TRIM.test(classOf(t.p.name)) || /^(shutter|glass|floor1|floor2|stair|roof26|roof45)$/.test(classOf(t.p.name)) ||
    (/^(chimney|base|corner|icorner|dormer)$/.test(kind) && /^(block1|block2|logWall|logWall4|wall1x1|grate)$/.test(classOf(t.p.name))))) { tally(kind, 'no trim'); return null; }
  // what makes the feature what it is (a porch has posts or a roof out in front, a balcony a floor and a rail)
  if (need && !need(items)) { tally(kind, 'not one'); return null; }
  const out = items.map(t => ({ n: t.p.name, c: classOf(t.p.name), m: matOf(t.p.name), a: t.a, o: t.o, h: t.h, r: t.r, ...(t.clip ? { clip: t.clip } : {}) }));
  const wall = Object.entries(baseNames).sort((x, y) => y[1] - x[1])[0];
  instances.push({ kind, fit: { ...fit, wall: wall ? wall[0] : null, wt: fit.wt || ctx.wt, ...(items.run ? { run: items.run } : {}) }, items: out, b: B.ix });
  tally(kind, 'kept');
  return true;
}

// ---------------------------------------------------------------- features of one build

const WALL_FILL = p => p.info.role === 'wall' && !/arch|divider|decowall|cross|grausten_window|crystal/.test(p.name) && p.axis;
// a wall at any angle (round and many-sided plans)
const WALL_ANY = p => p.info.role === 'wall' && !/arch|divider|decowall|cross|grausten_window|crystal/.test(p.name) && !p.tilt && !p.scaled;
// the kind of wall round a feature, as the generator names its wall styles: plank, log, half-timber, stone, stone-base
// (stone below, timber over it), or other. Read from the wall pieces in the feature's plane, a metre and a half either
// side and three meters up from the foot.
const STONE_N = /^stone_|blackmarble|grausten/;
function wallTypeAt(ctx, f, foot) {
  const { ps, near } = ctx, c = Math.cos(f.Y * deg), s = Math.sin(f.Y * deg);
  let low = { stone: 0, wood: 0, log: 0 }, high = { stone: 0, wood: 0, log: 0 }, diag = 0, n = 0;
  for (const i of near(f.x - 2, f.x + 2, f.z - 2, f.z + 2)) {
    const p = ps[i], dx = p.x - f.x, dz = p.z - f.z, a = dx * c - dz * s, o = dx * s + dz * c, h = p.y - foot;
    if (Math.abs(a) > 1.6 || Math.abs(o) > 0.7 || h < -0.3 || h > 3.2) continue;
    if (/beam_(26|45)|log_(26|45)|wall_cross/.test(p.name)) { diag++; continue; }
    if (!WALL_ANY(p)) continue;
    const m = STONE_N.test(p.name) ? 'stone' : /_log/.test(p.name) ? 'log' : 'wood';
    (h < 1.1 ? low : high)[m]++; n++;
  }
  if (!n) return 'other';
  const top = o => Object.entries(o).sort((x, y) => y[1] - x[1])[0];
  const lo = top(low), hi = top(high);
  if (lo[1] && lo[0] === 'stone' && hi[1] && hi[0] !== 'stone') return 'stone-base';
  const m = hi[1] ? hi[0] : lo[0];
  if (m === 'stone') return 'stone';
  if (m === 'log') return 'log';
  return diag >= 1 ? 'half-timber' : 'plank';
}
function mine(B) {
  const { ps } = B, near = gridOf(ps);
  const struct = ps.filter(p => p.info.structural);
  if (struct.length < 30) return;
  const ys = struct.map(p => p.box.y0).sort((a, b) => a - b), ground = ys[Math.floor(ys.length * 0.02)];
  const walls = ps.filter(WALL_FILL);
  if (walls.length < 6) return;
  const mid = [walls.reduce((t, p) => t + p.x, 0) / walls.length, walls.reduce((t, p) => t + p.z, 0) / walls.length];
  const ctx = { ps, near, ground };
  // the build's own wall type, for features whose walls cannot be read close by (gables, eaves)
  {
    const n = { stone: 0, log: 0, wood: 0, diag: 0, low: 0 };
    for (const w of walls) {
      const m = STONE_N.test(w.name) ? 'stone' : /_log/.test(w.name) ? 'log' : 'wood';
      n[m]++;
      if (m === 'stone' && w.box.y0 < ground + 1.1) n.low++;
    }
    n.diag = ps.filter(p => /beam_(26|45)|log_(26|45)|wall_cross/.test(p.name)).length;
    const t = walls.length;
    ctx.wt = n.stone > 0.65 * t ? 'stone' : n.low > 0.15 * t && n.low > 0.6 * n.stone && n.wood + n.log > 0.3 * t ? 'stone-base' : n.log > 0.35 * t ? 'log' : n.diag > 0.2 * n.wood ? 'half-timber' : 'plank';
  }
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
  const cube = p => /^(stone_wall_1x1|blackmarble_1x1|blackmarble_2x2x2|iron_wall_1x1|stone_wall_2x1|blackmarble_2x1x1)$/.test(p.name);
  const inPlane = (k, line) => (p, q) => WALL_FILL(p) && ((planeOf(p).k === k && Math.abs(planeOf(p).line - line) < 0.8) || (cube(p) && Math.abs(q.o) < 0.8));

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
  const gapCols = new Set();
  for (const [gk, ts] of gaps) { const [k, line] = gk.split('|').map(Number); for (const t of ts) gapCols.add(`${k}|${line}|${t}`); }
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
        { w: W, h: H, sill: Math.round((g0 - foot) * 4) / 4, wt: wallTypeAt(ctx, f, foot) }, { a0: -W / 2 + 0.1, a1: W / 2 - 0.1, o0: -0.15, o1: 1.0, h0: 0.1, h1: H - 0.1, ok: OPEN_OK });
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
    if (rise < -0.4) { tally('door', 'below ground'); continue; }
    const sg = outward(ps, near, op.x, op.z, op.nx, op.nz, op.y, mid);
    if (!sg) { tally('door', 'unsure side'); continue; }
    const f = { x: op.x, y: op.y, z: op.z, Y: frameYaw(op.nx * sg, op.nz * sg), self: d, self2: e };
    const k = Math.abs(op.nx) > 0.5 ? 1 : 0, line = Math.round((k === 0 ? op.z : op.x) * 4) / 4;
    const wt = wallTypeAt(ctx, f, op.y);
    const doorway = { a0: -op.w / 2 + 0.15, a1: op.w / 2 - 0.15, o0: -0.9, o1: 1.0, h0: 0.15, h1: Math.min(op.h, 2.3) - 0.05 };
    const plainWall = (p, q, fb) => !(p.info.role === 'wall' && fb.h1 - fb.h0 > 1.5 && Math.abs(Math.sin(q.r * deg)) < 0.2);
    const outAt = (items, o, test) => items.some(t => (t.fb.o0 + t.fb.o1) / 2 > o && test(classOf(t.p.name), t));
    if (rise <= 1.6) {
      const keep = (p, q, fb) => !(p.info.role === 'floor' && (fb.h0 + fb.h1) / 2 > 0.4) && plainWall(p, q, fb);
      collect('door', B, ctx, f, { a0: -op.w / 2 - 1.6, a1: op.w / 2 + 1.6, o0: -0.35, o1: 2.6, h0: -Math.max(0, rise) - 0.35, h1: op.h + 1.1 }, inPlane(k, line),
        { w: op.w, h: op.h, door: d.name, rise: Math.round(Math.max(0, rise) * 4) / 4, wt }, doorway, keep);
      // the porch: the same door read further out, with posts or a roof in front of it; the way out stays clear
      collect('porch', B, ctx, f, { a0: -op.w / 2 - 3, a1: op.w / 2 + 3, o0: -0.35, o1: 5, h0: -Math.max(0, rise) - 0.35, h1: op.h + 2.8 }, inPlane(k, line),
        { w: op.w, h: op.h, rise: Math.round(Math.max(0, rise) * 4) / 4, wt }, { ...doorway, o1: 2.4 }, keep,
        items => outAt(items, 1.2, c => /^(pole\d|pillar|roof26|roof45|cap26|cap45)$/.test(c)) && items.length >= 4);
    }
    // stairs up to a raised door, straight out from it or along the wall
    const stairsIn = near(op.x - 6, op.x + 6, op.z - 6, op.z + 6).some(i => ps[i].info.role === 'stair' && ps[i].y < op.y - 0.2 && Math.hypot(ps[i].x - op.x, ps[i].z - op.z) < 2 * rise + 3);
    if (rise >= 0.4 && rise <= 3.4 && stairsIn) {
      collect('stairentry', B, ctx, f, { a0: -op.w / 2 - 2.6, a1: op.w / 2 + 2.6, o0: -0.35, o1: 2 * rise + 3.5, h0: -rise - 0.4, h1: op.h + 1.2 }, inPlane(k, line),
        { w: op.w, h: op.h, rise: Math.round(rise * 2) / 2, wt }, doorway, (p, q, fb) => plainWall(p, q, fb),
        items => {
          const st = items.filter(t => classOf(t.p.name) === 'stair');
          if (!st.length) return false;
          // which way the flight runs: out from the door, or along the wall
          const ma = st.reduce((t, x) => t + Math.abs((x.fb.a0 + x.fb.a1) / 2), 0) / st.length;
          items.run = ma < op.w / 2 + 0.6 ? 'out' : 'side';
          return items.some(t => !/^(stair|floor1|floor2)$/.test(classOf(t.p.name)));
        });
    }
    // a balcony or gallery outside an upper door
    if (rise > 1.6) {
      const deck = near(op.x - 3, op.x + 3, op.z - 3, op.z + 3).some(i => { const p = ps[i]; if (p.info.role !== 'floor') return false; const q = toFrame(f, p); return q.o > 0.4 && q.o < 3 && Math.abs(q.h) < 0.35 && Math.abs(q.a) < op.w / 2 + 1.5; });
      if (!deck) { tally('balcony', 'no deck'); continue; }
      collect('balcony', B, ctx, f, { a0: -op.w / 2 - 3.2, a1: op.w / 2 + 3.2, o0: -0.35, o1: 3.6, h0: -3.2, h1: op.h + 1.6 }, inPlane(k, line),
        { w: op.w, h: op.h, rise: Math.round(rise * 2) / 2, wt }, { ...doorway, h0: 0.25 }, (p, q, fb) => plainWall(p, q, fb) && p.info.role !== 'stair',
        items => outAt(items, 0.3, c => /^(floor1|floor2)$/.test(c)) && outAt(items, 0.8, (c, t) => /^(fence|beam1|beam2|beam4|wallHalf|wall1x1|pole1)$/.test(c) && t.h > 0.2 && t.h < 1.4));
    }
  }

  // ---- corners at the foot of the walls, at any angle: two walls ending at one point. Outside corners (the building
  // in the wedge between the two walls: 90 degrees on a box, 135 on an octagon, 120 on a hexagon) and inside corners
  // (the building all round but the wedge: where wings meet). The old miner took the one quadrant less covered than
  // the other three, which is an inside corner; an outside corner has three open quadrants.
  const footWalls = ps.filter(p => WALL_ANY(p) && p.box.y0 < ground + 0.6 && p.box.y1 - p.box.y0 > 0.4);
  const endPts = [];
  for (const w of footWalls) {
    const bb = bounds(w.name, true), c = Math.cos(w.yaw * deg), s = Math.sin(w.yaw * deg);
    const len = bb.max[0] - bb.min[0];
    if (len < 0.9) continue; // a 1 x 1 block is no wall run
    const mx = (bb.max[0] + bb.min[0]) / 2, mz = (bb.max[2] + bb.min[2]) / 2;
    for (const sg of [-1, 1]) {
      const lx = mx + sg * len / 2;
      // the end on the wall's middle line; d points from the end back along the wall
      endPts.push({ x: w.x + lx * c + mz * s, z: w.z - lx * s + mz * c, dx: -sg * c, dz: sg * s, y: w.box.y0, w });
    }
  }
  const usedEnd = new Set();
  for (let i = 0; i < endPts.length; i++) {
    if (usedEnd.has(i)) continue;
    const grp = [i];
    for (let j = i + 1; j < endPts.length; j++) if (!usedEnd.has(j) && Math.hypot(endPts[j].x - endPts[i].x, endPts[j].z - endPts[i].z) < 0.45) grp.push(j);
    for (const j of grp) usedEnd.add(j);
    // the directions the walls run from here, 10 degrees apart or more
    const dirs = [];
    for (const j of grp) { const e = endPts[j]; if (!dirs.some(d => d.dx * e.dx + d.dz * e.dz > 0.985)) dirs.push(e); }
    if (dirs.length !== 2) { if (dirs.length > 2) tally('corner', 'three ways'); continue; }
    const [d1, d2] = dirs, cosT = d1.dx * d2.dx + d1.dz * d2.dz;
    if (cosT < -0.97) continue; // a straight run
    const theta = Math.acos(Math.max(-1, Math.min(1, cosT))) / deg;
    const cx = grp.reduce((t, j) => t + endPts[j].x, 0) / grp.length, cz = grp.reduce((t, j) => t + endPts[j].z, 0) / grp.length;
    const foot = Math.min(...grp.map(j => endPts[j].y));
    let bx = d1.dx + d2.dx, bz = d1.dz + d2.dz; const bl = Math.hypot(bx, bz); bx /= bl; bz /= bl;
    // the wedge between the walls covered and the other side open: an outside corner; the other way round, inside
    const cov = sg => coverScore(ps, near, cx + sg * bx * 1.5, cz + sg * bz * 1.5, foot) + coverScore(ps, near, cx + sg * bx * 2.8, cz + sg * bz * 2.8, foot);
    const wedge = cov(1), rest = cov(-1);
    if (wedge === rest) { tally('corner', 'unsure side'); continue; }
    const convex = wedge > rest, kind = convex ? 'corner' : 'icorner';
    const angle = Math.round((convex ? theta : 360 - theta) / 7.5) * 7.5;
    const ox = convex ? -bx : bx, oz = convex ? -bz : bz;
    const f = { x: cx, y: foot, z: cz, Y: frameYaw(ox, oz) };
    // each wall's outward normal, and the wall lines that are the building here
    const nrm = d => { let nx = -d.dz, nz = d.dx; if (nx * ox + nz * oz < 0) { nx = -nx; nz = -nz; } return [nx, nz]; };
    const n1 = nrm(d1), n2 = nrm(d2);
    const dist = (p, n) => (p.x - cx) * n[0] + (p.z - cz) * n[1];
    const isBase = p => WALL_ANY(p) && [[d1, n1], [d2, n2]].some(([d, n]) => Math.abs(Math.sin((p.yaw - Math.atan2(-d.dz, d.dx) / deg) * deg)) < 0.15 && Math.abs(dist(p, n)) < 0.8);
    const keep = p => (convex ? dist(p, n1) > -0.3 || dist(p, n2) > -0.3 : dist(p, n1) > -0.3 && dist(p, n2) > -0.3) &&
      ['beam', 'pole', 'deco', 'light', 'wall', 'fence'].includes(p.info.role);
    collect(kind, B, ctx, f, { a0: -1.7, a1: 1.7, o0: -0.3, o1: 1.5, h0: -0.6, h1: 3.2 }, isBase, { angle, wt: wallTypeAt(ctx, { x: cx + d1.dx, z: cz + d1.dz, Y: frameYaw(n1[0], n1[1]) }, foot) }, null, keep);
  }

  // ---- the foot of the walls (plinths, sill logs, stone courses) and the top of the walls under the eaves: one wall
  // piece of 2 m or more per bay, at most 40 of each a build, spread along its walls
  const bays = footWalls.filter(w => { const bb = bounds(w.name, true); return bb.max[0] - bb.min[0] > 1.9; });
  const every = Math.max(1, Math.ceil(bays.length / 40));
  bays.forEach((w, i) => {
    if (i % every) return;
    const c = Math.cos(w.yaw * deg), s = Math.sin(w.yaw * deg), nx = s, nz = c; // a wall faces its local z
    const sg = outward(ps, near, w.x, w.z, nx, nz, w.box.y0, mid);
    if (!sg) { tally('base', 'unsure side'); return; }
    const bb = bounds(w.name, true), half = Math.min(2, (bb.max[0] - bb.min[0]) / 2);
    const f = { x: w.x, y: w.box.y0, z: w.z, Y: frameYaw(nx * sg, nz * sg), self: w };
    const plane = (p, q) => WALL_ANY(p) && Math.abs(q.o) < 0.7 && Math.abs(Math.sin(q.r * deg)) < 0.15;
    const wt = wallTypeAt(ctx, f, w.box.y0);
    // only what lies low along the foot and stands proud of the wall: posts and beams in the wall's own plane are its
    // frame (the wall type), not a plinth
    collect('base', B, ctx, f, { a0: -half - 0.2, a1: half + 0.2, o0: -0.3, o1: 1.3, h0: -0.7, h1: 1.1 }, plane, { w: half * 2, wt }, null,
      (p, q, fb) => (fb.h0 + fb.h1) / 2 < 0.7 && fb.h1 < 1.3 && ((fb.o0 + fb.o1) / 2 > 0.12 || /floor_1x1/.test(p.name) || (STONE_N.test(p.name) && (fb.o0 + fb.o1) / 2 > 0.02)) && !['floor', 'stair'].includes(p.info.role) || (/floor_1x1/.test(p.name) && (fb.h0 + fb.h1) / 2 < 0.7));
  });
  // wall tops: the highest wall piece in its column with a roof over it within 2.5 m
  const topWalls = ps.filter(p => WALL_ANY(p) && p.box.y1 > ground + 1.8 && (bounds(p.name, true).max[0] - bounds(p.name, true).min[0]) > 1.9);
  let nTop = 0;
  for (const w of topWalls) {
    if (nTop >= 40) break;
    const c = Math.cos(w.yaw * deg), s = Math.sin(w.yaw * deg), nx = s, nz = c;
    const over = near(w.x - 2.5, w.x + 2.5, w.z - 2.5, w.z + 2.5).map(i => ps[i]);
    if (over.some(p => p !== w && WALL_ANY(p) && Math.hypot(p.x - w.x, p.z - w.z) < 0.6 && p.box.y0 > w.box.y1 - 0.3 && p.box.y0 < w.box.y1 + 1)) continue;
    const roofs = over.filter(p => ['roof', 'roofCorner'].includes(p.info.role) && p.box.y0 < w.box.y1 + 1.5 && p.box.y1 > w.box.y1 - 0.5);
    if (!roofs.length) continue;
    const sg = outward(ps, near, w.x, w.z, nx, nz, w.box.y0, mid);
    if (!sg) continue;
    const f = { x: w.x, y: w.box.y1, z: w.z, Y: frameYaw(nx * sg, nz * sg), self: w };
    // how far the roof runs out past the wall's face, and its slope
    const eave = Math.max(0, ...roofs.map(p => { const q = toFrame(f, p), fb = boxAt(p.name, q.a, q.o, q.h, q.r, false); return Math.abs((fb.a0 + fb.a1) / 2) < 1.5 ? fb.o1 : 0; }));
    const slope = roofs.some(p => /slope45/.test(p.info.shape)) ? 45 : 26;
    nTop++;
    const plane = (p, q) => (WALL_ANY(p) && Math.abs(q.o) < 0.7) || ['roof', 'roofTop', 'roofCorner', 'gable'].includes(p.info.role);
    collect('walltop', B, ctx, f, { a0: -1.2, a1: 1.2, o0: -0.3, o1: 1.8, h0: -1.0, h1: 0.9 }, plane,
      { eave: Math.round(eave * 4) / 4, slope, wt: wallTypeAt(ctx, { ...f, y: w.box.y0 }, Math.max(ground, w.box.y1 - 3)) }, null,
      (p, q, fb) => (fb.o0 + fb.o1) / 2 > -0.05);
  }

  // ---- wall faces: a plain bay of wall (no opening in it or beside it) with something hung on it outside: a sconce,
  // a lantern on a hook, a banner, an item stand with a shield or a trophy, a sign, a carving
  const ACCENT = /^(wallTorch|hangLight|lantern|candle|banner|stand|standH|sign|garland|dragon|raven|wolf|chain|cloth)$/;
  const faceBays = ps.filter(p => WALL_FILL(p) && (bounds(p.name, true).max[0] - bounds(p.name, true).min[0]) > 1.9 && p.box.y1 - p.box.y0 > 0.9);
  const everyF = Math.max(1, Math.ceil(faceBays.length / 80));
  faceBays.forEach((w, i) => {
    if (i % everyF) return;
    const { k, line } = planeOf(w), t0 = k === 0 ? w.x : w.z;
    for (let t = Math.round((t0 - 1.25) * 2) / 2 + 0.25; t <= t0 + 1.26; t += 0.5) if (gapCols.has(`${k}|${line}|${t}`)) return;
    if (doorsHere.some(d => Math.hypot(d.x - w.x, d.z - w.z) < 2.4 && Math.abs(d.y - w.y) < 2.5)) return;
    const c = Math.cos(w.yaw * deg), s = Math.sin(w.yaw * deg), nx = s, nz = c;
    const sg = outward(ps, near, w.x, w.z, nx, nz, w.box.y0, mid);
    if (!sg) return;
    // the frame stands on the floor of the storey (the bay may be the upper course of a taller wall): the highest floor
    // just inside the wall at or under the bay's foot, else the ground
    const ix = w.x - nx * sg * 0.7, iz = w.z - nz * sg * 0.7;
    let foot = ground;
    for (const j of near(ix - 0.1, ix + 0.1, iz - 0.1, iz + 0.1)) {
      const q = ps[j];
      if (q.info.role !== 'floor' || ix < q.box.x0 || ix > q.box.x1 || iz < q.box.z0 || iz > q.box.z1) continue;
      if (q.box.y1 <= w.box.y0 + 0.3 && q.box.y1 > w.box.y0 - 3.2) foot = Math.max(foot, q.box.y1);
    }
    const f = { x: w.x, y: foot, z: w.z, Y: frameYaw(nx * sg, nz * sg), self: w };
    const h0 = w.box.y0 - foot;
    collect('wallface', B, ctx, f, { a0: -1.3, a1: 1.3, o0: -0.3, o1: 1.0, h0: h0 - 0.2, h1: w.box.y1 - foot + 0.6 }, inPlane(k, line),
      { h: Math.round((w.box.y1 - foot) * 4) / 4, storey: foot > ground + 1.5 ? 1 : 0, wt: wallTypeAt(ctx, f, foot) }, null,
      // the accents wherever they hang; timber only where it stands proud of the wall (the wall's own frame stays out)
      (p, q, fb) => !['floor', 'stair', 'wall', 'roof', 'gable'].includes(p.info.role) && (fb.o0 + fb.o1) / 2 > -0.05 &&
        (ACCENT.test(classOf(p.name)) || (fb.o0 + fb.o1) / 2 > 0.15),
      items => items.some(t => ACCENT.test(classOf(t.p.name))));
  });

  // ---- chimney caps: the top of a stack standing over the roof (stone courses, slabs, a grate, a little roof)
  const roofH = new Map();
  for (const p of ps) if (['roof', 'roofTop', 'roofCorner'].includes(p.info.role)) { const k = `${Math.round(p.x)}|${Math.round(p.z)}`; roofH.set(k, Math.max(roofH.get(k) || -1e9, p.box.y1)); }
  const roofNear = p => { let m = -1e9; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const v = roofH.get(`${Math.round(p.x) + a}|${Math.round(p.z) + b}`); if (v != null) m = Math.max(m, v); } return m; };
  const stackP = ps.filter(p => /^(stone_wall|stone_pillar|blackmarble_(1x1|2x1|2x2|column)|Piece_grausten_wall|iron_grate)/.test(p.name) && !p.tilt && (() => { const m = roofNear(p); return m > -1e9 && p.box.y1 > m + 0.5 && p.box.y0 > m - 2.5; })());
  const stacks = [];
  for (const p of stackP) { const c = stacks.find(c => Math.abs(c.x - p.x) < 2.5 && Math.abs(c.z - p.z) < 2.5); if (c) c.p.push(p); else stacks.push({ x: p.x, z: p.z, p: [p] }); }
  for (const st of stacks) {
    if (st.p.length < 3) continue;
    const x0 = Math.min(...st.p.map(p => p.box.x0)), x1 = Math.max(...st.p.map(p => p.box.x1)), z0 = Math.min(...st.p.map(p => p.box.z0)), z1 = Math.max(...st.p.map(p => p.box.z1));
    if (x1 - x0 > 3.2 || z1 - z0 > 3.2) { tally('chimney', 'too wide'); continue; }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, top = Math.max(...st.p.filter(p => p.info.role === 'wall').map(p => p.box.y1), -1e9);
    if (top === -1e9) continue;
    // faces out from the middle of the build, on an axis
    const dx = cx - mid[0], dz = cz - mid[1], f = Math.abs(dx) > Math.abs(dz) ? { x: cx, y: top, z: cz, Y: frameYaw(Math.sign(dx) || 1, 0) } : { x: cx, y: top, z: cz, Y: frameYaw(0, Math.sign(dz) || 1) };
    const inStack = new Set(st.p);
    collect('chimney', B, ctx, f, { a0: -1.9, a1: 1.9, o0: -1.9, o1: 1.9, h0: -1.3, h1: 2.6 },
      (p, q, fb) => ['roof', 'roofTop', 'roofCorner', 'gable'].includes(p.info.role) || (inStack.has(p) && fb.h1 < -0.95) || (p.info.role === 'wall' && fb.h1 < -0.95),
      { w: Math.round((x1 - x0) * 2) / 2, d: Math.round((z1 - z0) * 2) / 2 }, null, null);
  }

  // ---- ridge lines: dormers (a short cross ridge lower than the main one) and roof valleys
  const ridgeCaps = ps.filter(p => p.info.role === 'roofTop' && !/wall_roof_top/.test(p.name) && !p.tilt && p.axis);
  const rl = new Map();
  for (const c of ridgeCaps) {
    const k = Math.round(c.yaw / 90) % 2, line = Math.round((k === 0 ? c.z : c.x) * 2) / 2, y = Math.round(c.y * 2) / 2;
    const key = `${k}|${line}|${y}`; let l = rl.get(key); if (!l) rl.set(key, l = []); l.push(c);
  }
  const ridgeL = [...rl.entries()].map(([key, cs]) => { const [k, line, y] = key.split('|').map(Number); const ts = cs.map(c => (k === 0 ? c.x : c.z)).sort((a, b) => a - b); return { k, line, y, t0: ts[0] - 1, t1: ts[ts.length - 1] + 1, cs }; });
  ridgeL.sort((a, b) => (b.t1 - b.t0) - (a.t1 - a.t0));
  const mainRidge = ridgeL[0];
  if (mainRidge) for (const r of ridgeL) {
    if (r === mainRidge || r.k === mainRidge.k || r.t1 - r.t0 > 4.6 || r.y > mainRidge.y - 0.9) continue;
    // the front of the dormer is the end away from the main ridge
    const mLine = mainRidge.line, end = Math.abs(r.t1 - mLine) > Math.abs(r.t0 - mLine) ? r.t1 : r.t0, sgn = end === r.t1 ? 1 : -1;
    const ex = r.k === 0 ? end : r.line, ez = r.k === 0 ? r.line : end, nx = r.k === 0 ? sgn : 0, nz = r.k === 0 ? 0 : sgn;
    const f = { x: ex, y: r.y, z: ez, Y: frameYaw(nx, nz) };
    const L = r.t1 - r.t0;
    // the main roof: slopes falling square to the dormer's ridge's neighbor (parallel to the dormer ridge), and its ridge
    const mainSlope = p => p.info.role === 'roof' && p.axis && (Math.round(p.yaw / 90) % 2) === r.k;
    const slope = r.cs.some(c => /45/.test(c.name)) ? 45 : 26;
    collect('dormer', B, ctx, f, { a0: -3.2, a1: 3.2, o0: -L - 2.5, o1: 1.4, h0: -4.2, h1: 1.4 },
      (p, q, fb) => mainSlope(p) || (p.info.role === 'roofTop' && !r.cs.includes(p)) || (WALL_ANY(p) && fb.h1 < -2.6),
      { slope, len: Math.round(L * 2) / 2 }, null, (p, q, fb) => !['floor', 'stair'].includes(p.info.role) && (fb.o0 + fb.o1) / 2 > -L - 1.5,
      items => items.some(t => /^(gable26|gable45|wall2|wall1x1|wallHalf|logWall)$/.test(classOf(t.p.name))) && items.some(t => /^(roof26|roof45)$/.test(classOf(t.p.name))));
  }
  for (const p of ps) {
    if (!/icorner/.test(p.name) || p.tilt || !p.axis) continue;
    const f = { x: p.x, y: p.y, z: p.z, Y: norm(p.yaw), self: p };
    collect('valley', B, ctx, f, { a0: -1.6, a1: 1.6, o0: -1.6, o1: 1.6, h0: -1.6, h1: 1.2 },
      q => ['roof', 'roofTop', 'roofCorner', 'gable'].includes(q.info.role) || WALL_ANY(q), { slope: /45/.test(p.name) ? 45 : 26 }, null,
      q => !['floor', 'stair', 'wall', 'fence'].includes(q.info.role));
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
const fitKey = (kind, fit) => kind === 'window' ? `${fit.w}x${fit.h}` : kind === 'door' ? `${fit.w}x${Math.min(fit.h, 3)}` : kind === 'gable' || kind === 'eave' || kind === 'valley' ? `${fit.slope}`
  : kind === 'corner' || kind === 'icorner' ? `${fit.angle}|${fit.wt}` : kind === 'base' || kind === 'wallface' ? `${fit.wt}` : kind === 'walltop' ? `${fit.slope}|${fit.wt}`
    : kind === 'porch' || kind === 'balcony' ? `${fit.w}` : kind === 'stairentry' ? `${fit.rise}|${fit.run}` : kind === 'dormer' ? `${fit.slope}|${fit.len}` : kind === 'chimney' ? `${fit.w}x${fit.d}` : '';
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
  const items = ex.items.map(t => ({ n: t.n, c: t.c, m: t.m, a: fmt(t.a), o: fmt(t.o), h: fmt(t.h), r: Math.round(t.r * 10) / 10, clip: t.clip }))
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
const CAP = { window: 700, door: 200, corner: 200, gable: 300, eave: 300, icorner: 150, base: 200, walltop: 200, wallface: 300, porch: 150, balcony: 150, stairentry: 150, chimney: 120, dormer: 150, valley: 100 }, seen = {};
const keptMotifs = motifs.filter(m => (seen[m.kind] = (seen[m.kind] || 0) + 1) <= CAP[m.kind]);
motifs.length = 0; motifs.push(...keptMotifs);

// stable IDs: a motif keeps its ID from one run to the next while its key stays the same
const PREFIX = { window: 'MW', door: 'MD', corner: 'MC', gable: 'MG', eave: 'ME', icorner: 'MI', base: 'MF', walltop: 'MT', wallface: 'MA', porch: 'MP', balcony: 'MB', stairentry: 'MS', chimney: 'MH', dormer: 'MR', valley: 'MV' };
let old = {};
// a motif whose fit key gained a field (corners now carry their angle and wall type) keeps its ID by kind and pieces
const sigKey = k => { const parts = k.split('|'); return parts[0] + '|' + parts[parts.length - 1]; };
const oldBySig = {};
try { for (const m of JSON.parse(fs.readFileSync(outPath, 'utf8')).motifs) { old[m.key] = m.id; oldBySig[sigKey(m.key)] = m.id; } } catch (e) { old = {}; }
const used = new Set(Object.values(old));
const next = {};
for (const m of motifs) {
  if (old[m.key]) { m.id = old[m.key]; continue; }
  const bySig = oldBySig[sigKey(m.key)];
  if (bySig && !motifs.some(o => o !== m && o.id === bySig)) { m.id = bySig; continue; }
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
// a sixth field is the depth a piece is set into the wall or into another piece in its source build (D-065)
for (const m of motifs) { m.p = m.pieces.map(t => (t.clip ? [t.n, t.a, t.o, t.h, t.r, t.clip] : [t.n, t.a, t.o, t.h, t.r])); delete m.pieces; m.src = m.src.slice(0, 3); }
fs.writeFileSync(outPath, JSON.stringify({
  about: 'Exterior motifs mined from the best-liked corpus builds by lab/mine_motifs.js. Frame: a along the wall, o out from it, h up from the feature foot; r piece yaw from the frame. See docs/BUILDING_DETAILS.md.',
  builds: builds.length, counts: byKind, skipped: why, motifs,
}, null, 0).replace(/\{"key"/g, '\n{"key"'));
console.log('wrote', outPath);
