// Corpus measures for tilted trim, decks and low walls, and storeys and density (design/wip-measures).
//   node --max-old-space-size=3000 lab/measure_corpus.js <corpus dir> <out.json> [i/n]   one chunk: files with index % n == i
// Output: one record per build read (no blueprint content). lab/measure_merge.js sums the chunks into the data files.
// Builds kept: no modded piece, 40 pieces or more, 4 roof pieces or more; folders statue, bridge, arena, mini-game,
// portal-hub, farming and artistic are skipped; hs_ files and OverDrive BiomeBlueprints are skipped (none in the folder).
// Each build is turned to its main axis (the most common horizontal wall direction, folded to 0..90 degrees).
const fs = require('fs'), path = require('path');
const lab = path.join(__dirname, '..');
const P = require(lab + '/lib/pieces.js'), Ck = require(lab + '/lib/checks.js'), BP = require(lab + '/lib/blueprint.js');

const dir = process.argv[2], out = process.argv[3] || '/tmp/measure-chunk.json';
const [ci, cn] = (process.argv[4] || '0/1').split('/').map(Number);
const MOD = /^(kg_|GB_|CastleKit|MB|mm_|BBH|rk_|Piece_vf|OdinsKingdom|h_|\$|Hayze|rae_|teq_|tkd_|rkc_)/;
const SKIP = /^hs_|biomeblueprint|overdrive/i;
const SKIP_FOLDERS = new Set(['statue', 'bridge', 'arena', 'mini-game', 'portal-hub', 'farming', 'artistic']);
const deg = 180 / Math.PI;

// ---------------------------------------------------------------- the corpus lists
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) { if (!/^_/.test(e.name)) walk(path.join(d, e.name)); } else if (/\.blueprint$/.test(e.name) && !SKIP.test(e.name) && !SKIP.test(d)) files.push(path.join(d, e.name)); } })(dir);
files.sort();
let INDEX = [];
try { INDEX = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')); } catch (e) { /* titles stay the slug */ }
const bySlug = new Map(INDEX.map(d => [d.slug, d]));
let CULT = {};
try {
  const m = JSON.parse(fs.readFileSync(process.env.VH_MEMBERS || path.join(lab, 'data/culture-corpus/members.json'), 'utf8')).cultures;
  for (const [c, list] of Object.entries(m)) for (const [k, conf] of list) CULT[k] = [c, conf];
} catch (e) { /* every build stays unsorted */ }

// ---------------------------------------------------------------- what kind of building a file is
// The folder names the kind where it says one; the general folders (building, advanced-base, other, village, castle,
// interior-design, underground, boat-house, recreation, tree-house) are sorted by words in the title or slug.
const FOLDER_TYPE = { 'starter-home': 'home', longhouse: 'hall', tavern: 'tavern', blacksmith: 'workshop', tower: 'tower', storage: 'storehouse', temple: 'temple' };
const WORDS = [
  ['temple', /temple|church|chapel|shrine|cathedral|monastery|sanctuary|abbey/],
  ['tavern', /tavern|\binn\b|\bpub\b|brewery|meadery|meadhall bar|alehouse|bistro|bar\b|cafe|restaurant|bakery/],
  ['hall', /longhouse|long house|mead ?hall|great hall|\bhall\b|jarl|town hall|guildhall/],
  ['tower', /tower|lighthouse|watchtower|keep|spire/],
  ['workshop', /smith|forge|workshop|\bmill\b|windmill|tannery|smelter|carpenter|foundry|craft/],
  ['storehouse', /storehouse|warehouse|barn|granary|stable|storage|silo|shed|depot/],
  ['home', /house|home|cottage|cabin|hut|villa|manor|lodge|farmhouse|dwelling|hovel|bungalow|apartment/],
];
function typeOf(folder, title) {
  if (FOLDER_TYPE[folder]) return FOLDER_TYPE[folder];
  const t = ' ' + (title || '').toLowerCase().replace(/[-_]+/g, ' ') + ' ';
  for (const [k, re] of WORDS) if (re.test(t)) return k;
  return 'other';
}

// ---------------------------------------------------------------- piece geometry
function axes(q) {
  const [x, y, z, w] = q;
  return {
    ax: [1 - 2 * (y * y + z * z), 2 * (x * y + w * z), 2 * (x * z - w * y)],
    ay: [2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x)],
    az: [2 * (x * z + w * y), 2 * (y * z - w * x), 1 - 2 * (x * x + y * y)],
  };
}
const foldDir = a => { const r = ((a % 90) + 90) % 90; return r > 45 ? r - 90 : r; }; // to [-45, 45)
const BEAMNN = /beam_26|beam_45|beam_67|log_26|log_45|log_67/;
const TRIM_NAME = /beam|pole|log|rafter|stake_wall$/i;
const q = (a, t) => { if (!a.length) return null; const v = a.slice().sort((x, y) => x - y); return v[Math.min(v.length - 1, Math.floor(v.length * t))]; };
const inc = (o, k, v = 1) => { o[k] = (o[k] || 0) + v; };
const r2 = v => +v.toFixed(2);

const BIOMES = P.BIOME_ORDER;
const ROOFISH = new Set(['roof', 'roofTop', 'roofCorner']);

function analyse(f) {
  let bp;
  try { bp = BP.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; }
  const ps = bp.pieces;
  const folder = path.basename(path.dirname(f));
  if (SKIP_FOLDERS.has(folder)) return null;
  if (ps.length < 40 || ps.some(p => MOD.test(p.name))) return { f: folder + '/' + path.basename(f), skip: 'mod_or_small' };
  const info = ps.map(p => P.piece(p.name));
  const roofN = info.filter(i => ROOFISH.has(i.role)).length;
  if (roofN < 4) return { f: folder + '/' + path.basename(f), skip: 'no_roof' };
  const base = path.basename(f, '.blueprint'), slug = base.split('__')[0];
  const meta = bySlug.get(slug) || bySlug.get(base) || { title: slug };
  const ckey = [folder + '/' + base, folder + '/' + slug].find(k => CULT[k]);
  const culture = ckey ? CULT[ckey][0] : 'unsorted';
  const type = typeOf(folder, meta.title + ' ' + slug);

  const A = ps.map(p => axes(p.q));
  const tiltedQ = i => Math.abs(A[i].ay[1]) < 0.995; // the piece's up axis leans more than 5.7 degrees
  const boxes = ps.map(p => Ck.aabb(p));
  const near = Ck.index(boxes);
  const R = (i) => info[i].role;

  // main axis from horizontal walls
  const hist = {};
  ps.forEach((p, i) => { if (R(i) === 'wall' && !tiltedQ(i) && Math.abs(A[i].ax[1]) < 0.1) { const k = Math.round(foldDir(Math.atan2(A[i].ax[2], A[i].ax[0]) * deg)); inc(hist, k); } });
  const axis = +(Object.entries(hist).sort((a, b) => b[1] - a[1])[0] || [0])[0];
  // ground: 5th percentile of the bottoms of structural pieces
  const struct = ps.map((p, i) => i).filter(i => info[i].structural && !tiltedQ(i));
  const ys = struct.map(i => boxes[i].y0).sort((a, b) => a - b);
  const g = ys[Math.floor(ys.length * 0.05)];

  // biome: the highest biome that at least 10 % of the building pieces need
  const bl = ps.map((p, i) => i).filter(i => ['wall', 'floor', 'roof', 'roofTop', 'roofCorner', 'beam', 'pole', 'gable'].includes(R(i)));
  const bc = {};
  for (const i of bl) inc(bc, P.needs(ps[i].name));
  let biome = 'Meadows';
  for (const b of BIOMES) if ((bc[b] || 0) >= 0.1 * bl.length) biome = b;

  // turn the plan to the main axis (positions only; tilts are taken from the axes)
  const ca = Math.cos(-axis / deg), sa = Math.sin(-axis / deg);
  const X = ps.map(p => p.x * ca + p.z * sa), Z = ps.map(p => -p.x * sa + p.z * ca);
  const rec = { f: folder + '/' + base, folder, type, culture, biome, n: ps.length, roofs: roofN, axis };

  // ---------------------------------------------------------------- 1. tilted trim
  const trim = ps.map((p, i) => i).filter(i => (R(i) === 'beam' || R(i) === 'pole') && TRIM_NAME.test(ps[i].name) && info[i].shape !== 'prop');
  const T = { trimAll: trim.length, yawRef: { wall: 0, axis: 0 }, tilted: 0, kinds: {}, pitch: {}, yaw: {}, place: {}, kindPlace: {}, len: [], names: {}, byKindN: {}, crossings: 0 };
  const tl = [];
  for (const i of trim) {
    const inf = info[i], s = ps[i].s || [1, 1, 1];
    let a, L, kind;
    if (R(i) === 'pole') { a = A[i].ay; L = inf.size[1] * s[1]; kind = 'pole'; }
    else if (BEAMNN.test(ps[i].name)) {
      const th = Math.atan2(inf.size[1], inf.size[0]), c = Math.cos(th), sn = Math.sin(th);
      a = [A[i].ax[0] * c + A[i].ay[0] * sn, A[i].ax[1] * c + A[i].ay[1] * sn, A[i].ax[2] * c + A[i].ay[2] * sn]; L = Math.hypot(inf.size[0], inf.size[1]) * s[0]; kind = 'slopeBeam';
    } else { a = A[i].ax; L = inf.size[0] * s[0]; kind = 'beam'; }
    const hz = Math.hypot(a[0], a[2]);
    // pitch: beams from horizontal, poles from vertical
    const pitch = kind === 'pole' ? Math.atan2(hz, Math.abs(a[1])) * deg : Math.atan2(Math.abs(a[1]), hz) * deg;
    // turn of the direction (the lean for a pole) away from the walls
    // turn away from the nearest wall within 1.5 m (its direction), the main axis where no wall is near
    let wallDir = null, wd = 9;
    for (const j of near({ x0: ps[i].x - 1.5, x1: ps[i].x + 1.5, z0: ps[i].z - 1.5, z1: ps[i].z + 1.5 }, 0)) {
      if (R(j) !== 'wall' || tiltedQ(j) || Math.abs(A[j].ax[1]) > 0.1) continue;
      const b = boxes[j], d = Math.hypot(Math.max(b.x0 - ps[i].x, 0, ps[i].x - b.x1), Math.max(b.z0 - ps[i].z, 0, ps[i].z - b.z1), Math.max(b.y0 - ps[i].y, 0, ps[i].y - b.y1));
      if (d < 1.5 && d < wd) { wd = d; wallDir = Math.atan2(A[j].ax[2], A[j].ax[0]) * deg; }
    }
    const yaw = Math.abs(foldDir(Math.atan2(a[2], a[0]) * deg - (wallDir == null ? axis : wallDir)));
    T.yawRef = T.yawRef || { wall: 0, axis: 0 }; T.yawRef[wallDir == null ? 'axis' : 'wall']++;
    const offAxis = kind === 'pole' ? pitch > 3 : (pitch > 3 || (hz > 0.05 && yaw > 3));
    if (kind === 'slopeBeam') { /* sloped by its model */ }
    const isTilt = kind === 'slopeBeam' ? true : offAxis;
    inc(T.byKindN, kind);
    if (!isTilt) continue;
    T.tilted++;
    tl.push({ i, kind, a, L, pitch, yaw, c: [X[i], ps[i].y, Z[i]], cw: [ps[i].x, ps[i].y, ps[i].z] });
  }
  // places
  const slopeOf = i => { const sh = info[i].shape; return sh === 'slope45' ? 45 : sh === 'slope26' ? 26.6 : sh === 'slope67' ? 63.4 : null; };
  const hit = (pt, r, pred) => {
    for (const j of near({ x0: pt[0] - r, x1: pt[0] + r, z0: pt[2] - r, z1: pt[2] + r }, 0)) {
      if (!pred(j)) continue;
      const b = boxes[j];
      if (pt[0] >= b.x0 - r && pt[0] <= b.x1 + r && pt[1] >= b.y0 - r && pt[1] <= b.y1 + r && pt[2] >= b.z0 - r && pt[2] <= b.z1 + r) return j;
    }
    return -1;
  };
  const tset = new Set(tl.map(t => t.i));
  const BRACEBASE = j => !tset.has(j) && !tiltedQ(j) && ['wall', 'pole', 'beam', 'floor', 'gable', 'door', 'window'].includes(R(j));
  const hashT = new Map();
  tl.forEach((t, n) => { const k = Math.round(t.cw[0] / 1) + ',' + Math.round(t.cw[2] / 1); (hashT.get(k) || hashT.set(k, []).get(k)).push(n); });
  const crossed = new Set();
  for (let n = 0; n < tl.length; n++) {
    const t = tl[n];
    if (t.pitch < 10) continue;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const m of hashT.get((Math.round(t.cw[0]) + dx) + ',' + (Math.round(t.cw[2]) + dz)) || []) {
      if (m <= n) continue;
      const u = tl[m];
      if (u.pitch < 10) continue;
      if (Math.hypot(t.cw[0] - u.cw[0], t.cw[1] - u.cw[1], t.cw[2] - u.cw[2]) > 0.5) continue;
      const dot = Math.abs(t.a[0] * u.a[0] + t.a[1] * u.a[1] + t.a[2] * u.a[2]);
      if (Math.acos(Math.min(1, dot)) * deg < 20) continue;
      crossed.add(n); crossed.add(m);
    }
  }
  T.crossings = crossed.size;
  tl.forEach((t, n) => {
    const e1 = [t.cw[0] + t.a[0] * t.L / 2, t.cw[1] + t.a[1] * t.L / 2, t.cw[2] + t.a[2] * t.L / 2], e2 = [t.cw[0] - t.a[0] * t.L / 2, t.cw[1] - t.a[1] * t.L / 2, t.cw[2] - t.a[2] * t.L / 2];
    let place;
    const roofJ = hit(t.cw, 0.35, j => ROOFISH.has(R(j)));
    const gableJ = hit(t.cw, 1.2, j => R(j) === 'gable');
    if (crossed.has(n)) place = (roofJ >= 0 || gableJ >= 0) ? 'gableCross' : 'xBrace';
    else if (t.kind !== 'pole' && roofJ >= 0 && slopeOf(roofJ) && Math.abs(t.pitch - slopeOf(roofJ)) < 12) place = 'roofSlope';
    else {
      const j1 = hit(e1, 0.35, BRACEBASE), j2 = hit(e2, 0.35, BRACEBASE);
      if (j1 >= 0 && j2 >= 0 && j1 !== j2 && t.L <= 3.6 && t.pitch >= 15 && t.pitch <= 75) place = 'brace';
      else if (t.kind !== 'pole' && roofJ >= 0) place = 'roofOther';
      else place = 'loose';
    }
    t.place = place;
    const pb = t.pitch < 3 ? '00-03' : t.pitch < 10 ? '03-10' : t.pitch < 20 ? '10-20' : t.pitch < 35 ? '20-35' : t.pitch < 55 ? '35-55' : t.pitch < 75 ? '55-75' : '75-90';
    const yb = t.yaw < 3 ? '00-03' : t.yaw < 10 ? '03-10' : t.yaw < 25 ? '10-25' : t.yaw < 40 ? '25-40' : '40-45';
    inc(T.kinds, t.kind); inc(T.pitch, t.kind + '|' + pb); inc(T.yaw, t.kind + '|' + yb); inc(T.place, place); inc(T.kindPlace, t.kind + '|' + place);
    T.len.push(r2(t.L));
    inc(T.names, ps[t.i].name);
  });
  rec.trim = T;

  // ---------------------------------------------------------------- walls, interior, building footprint
  const CELL = 0.5;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const i of struct) { minX = Math.min(minX, X[i]); maxX = Math.max(maxX, X[i]); minZ = Math.min(minZ, Z[i]); maxZ = Math.max(maxZ, Z[i]); }
  const PAD = 14;
  minX -= PAD; minZ -= PAD; maxX += PAD; maxZ += PAD;
  const W = Math.ceil((maxX - minX) / CELL) + 1, H = Math.ceil((maxZ - minZ) / CELL) + 1;
  if (W * H > 4e6) { rec.skipGeo = 'huge'; return rec; }
  const cx = x => Math.floor((x - minX) / CELL), cz = z => Math.floor((z - minZ) / CELL);
  // the box of an untilted piece in the turned frame, from its collider box and the turn
  const box2 = i => {
    const b = boxes[i], pts = [[b.x0, b.z0], [b.x0, b.z1], [b.x1, b.z0], [b.x1, b.z1]].map(([x, z]) => [x * ca + z * sa, -x * sa + z * ca]);
    return { x0: Math.min(...pts.map(v => v[0])), x1: Math.max(...pts.map(v => v[0])), z0: Math.min(...pts.map(v => v[1])), z1: Math.max(...pts.map(v => v[1])), y0: b.y0, y1: b.y1 };
  };
  const B2 = new Array(ps.length);
  const bx = i => B2[i] || (B2[i] = box2(i));
  const paint = (mask, b, val = 1) => {
    for (let x = Math.max(0, cx(b.x0 + 0.01)); x <= Math.min(W - 1, cx(b.x1 - 0.01)); x++) for (let z = Math.max(0, cz(b.z0 + 0.01)); z <= Math.min(H - 1, cz(b.z1 - 0.01)); z++) mask[z * W + x] = val;
  };
  const wallMask = new Uint8Array(W * H), roofMask = new Uint8Array(W * H);
  for (let i = 0; i < ps.length; i++) {
    if (tiltedQ(i)) continue;
    const r = R(i), b = boxes[i];
    // walls of any storey count, so rooms above the ground floor are inside too
    if ((r === 'wall' || r === 'door' || r === 'window') && b.y1 - b.y0 >= 1.4 && b.y1 >= g + 1.8 && b.y0 <= g + 30 && !/fence|stake/.test(ps[i].name)) paint(wallMask, bx(i));
    if (r === 'pole' && b.y1 - b.y0 >= 1.6 && b.y1 >= g + 1.8 && b.y0 <= g + 30) paint(wallMask, bx(i));
    if (ROOFISH.has(r)) paint(roofMask, bx(i));
  }
  // enclosed by full-height walls: not reached from the border through cells that are not wall (walls grown by one cell
  // to close hairline gaps)
  const grown = new Uint8Array(W * H);
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) if (wallMask[z * W + x]) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, zz = z + dz; if (xx >= 0 && zz >= 0 && xx < W && zz < H) grown[zz * W + xx] = 1; }
  const reach = new Uint8Array(W * H), stack = [];
  const push = (x, z) => { const k = z * W + x; if (!grown[k] && !reach[k]) { reach[k] = 1; stack.push(k); } };
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let z = 0; z < H; z++) { push(0, z); push(W - 1, z); }
  while (stack.length) { const k = stack.pop(), x = k % W, z = (k - x) / W; if (x > 0) push(x - 1, z); if (x < W - 1) push(x + 1, z); if (z > 0) push(x, z - 1); if (z < H - 1) push(x, z + 1); }
  const interior = new Uint8Array(W * H); // enclosed cells plus the wall cells themselves
  let inCells = 0;
  for (let k = 0; k < W * H; k++) if (!reach[k]) { interior[k] = 1; inCells++; }
  // interior bounds
  let ix0 = Infinity, ix1 = -Infinity, iz0 = Infinity, iz1 = -Infinity;
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) if (interior[z * W + x]) { ix0 = Math.min(ix0, x); ix1 = Math.max(ix1, x); iz0 = Math.min(iz0, z); iz1 = Math.max(iz1, z); }
  rec.enclosed = inCells * CELL * CELL;

  // ---------------------------------------------------------------- 3. buildings, storeys and gaps
  // clusters of roofed cells joined across gaps under 1 m (a roof overhang closes most of them)
  const lab_ = new Int32Array(W * H).fill(-1);
  const clusters = [];
  const stk = [];
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const k0 = z * W + x;
    if (!roofMask[k0] || lab_[k0] >= 0) continue;
    const id = clusters.length, cells = [];
    lab_[k0] = id; stk.push(k0);
    while (stk.length) {
      const k = stk.pop(), xx = k % W, zz = (k - xx) / W; cells.push(k);
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        const x2 = xx + dx, z2 = zz + dz; if (x2 < 0 || z2 < 0 || x2 >= W || z2 >= H) continue;
        const kk = z2 * W + x2; if (roofMask[kk] && lab_[kk] < 0) { lab_[kk] = id; stk.push(kk); }
      }
    }
    clusters.push(cells);
  }
  const keep = clusters.map((c, id) => ({ id, cells: c, area: c.length * CELL * CELL })).filter(c => c.area >= 10).sort((a, b) => b.area - a.area);
  for (const c of keep) { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const k of c.cells) { const x = k % W, z = (k - x) / W; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } c.box = [x0, x1, z0, z1]; }
  rec.single = keep.length >= 1 && (keep.length === 1 || keep[1].area < 0.25 * keep[0].area);
  rec.clusters = keep.length;
  // ---------------------------------------------------------------- 2. decks and low walls
  const D = { enclosed: rec.enclosed >= 6, decks: [], runs: [], deckN: 0, floorsOut: 0 };
  if (D.enclosed) {
    // doors on the ground floor: the side the building fronts
    const mb = keep.length ? keep[0].box : [ix0, ix1, iz0, iz1];
    const mid = [(mb[0] + mb[1]) / 2, (mb[2] + mb[3]) / 2], hx = (mb[1] - mb[0]) / 2 || 1, hz = (mb[3] - mb[2]) / 2 || 1;
    const sideOfCell = (x, z) => { const dx = x - mid[0], dz = z - mid[1]; return Math.abs(dx) / hx > Math.abs(dz) / hz ? (dx > 0 ? '+x' : '-x') : (dz > 0 ? '+z' : '-z'); };
    const doorSides = {};
    for (let i = 0; i < ps.length; i++) if (R(i) === 'door' && !/gate/.test(ps[i].name) && boxes[i].y0 < g + 2.5) {
      const x = cx(X[i]), z = cz(Z[i]);
      let near_ = false;
      for (let dz = -3; dz <= 3 && !near_; dz++) for (let dx = -3; dx <= 3; dx++) { const xx = x + dx, zz = z + dz; if (xx >= 0 && zz >= 0 && xx < W && zz < H && interior[zz * W + xx]) { near_ = true; break; } }
      if (near_) inc(doorSides, sideOfCell(x, z));
    }
    const front = Object.entries(doorSides).sort((a, b) => b[1] - a[1])[0];
    const frontSide = front ? front[0] : null;
    const opposite = s => (s[0] === '+' ? '-' : '+') + s[1];
    const sideName = s => !frontSide ? ((s[1] === 'z') === (hx >= hz) ? 'longSide' : 'endSide') : s === frontSide ? 'front' : s === opposite(frontSide) ? 'back' : 'side';
    const reachBox = { x0: ix0 - 20, x1: ix1 + 20, z0: iz0 - 20, z1: iz1 + 20 };
    const near_int = (x, z, d) => { for (let dz = -d; dz <= d; dz++) for (let dx = -d; dx <= d; dx++) { const xx = x + dx, zz = z + dz; if (xx >= 0 && zz >= 0 && xx < W && zz < H && interior[zz * W + xx]) return true; } return false; };
    rec.frontSide = frontSide || 'none';
    // --- raised floors outside the walls
    const deckCells = new Map(); // key -> {band, name}
    for (let i = 0; i < ps.length; i++) {
      if (R(i) !== 'floor' || tiltedQ(i)) continue;
      const b = boxes[i], top = b.y1 - g;
      if (top < -0.1 || top > 4) continue;
      const bb = bx(i);
      let tot = 0, ins = 0;
      for (let x = cx(bb.x0 + 0.01); x <= cx(bb.x1 - 0.01); x++) for (let z = cz(bb.z0 + 0.01); z <= cz(bb.z1 - 0.01); z++) { tot++; if (x >= 0 && z >= 0 && x < W && z < H && interior[z * W + x]) ins++; }
      if (!tot || ins / tot > 0.25) continue;
      const mx = cx(X[i]), mz = cz(Z[i]);
      if (!near_int(mx, mz, 16)) continue; // within 8 m of the walled rooms
      D.floorsOut++;
      const band = top < 0.35 ? 'ground' : top < 1.2 ? 'low' : 'high';
      for (let x = cx(bb.x0 + 0.01); x <= cx(bb.x1 - 0.01); x++) for (let z = cz(bb.z0 + 0.01); z <= cz(bb.z1 - 0.01); z++) {
        if (x < 0 || z < 0 || x >= W || z >= H || interior[z * W + x]) continue;
        deckCells.set(z * W + x, { band, top, name: ps[i].name, y: b.y1 });
      }
    }
    // components per band (4-connected, tops within 0.6 m)
    const seen = new Set();
    for (const [k0, c0] of deckCells) {
      if (seen.has(k0)) continue;
      const comp = [], st = [k0]; seen.add(k0);
      while (st.length) {
        const k = st.pop(), x = k % W, z = (k - x) / W; comp.push(k);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + dx, zz = z + dz; if (xx < 0 || zz < 0 || xx >= W || zz >= H) continue;
          const kk = zz * W + xx, c = deckCells.get(kk);
          if (c && !seen.has(kk) && c.band === c0.band && Math.abs(c.y - deckCells.get(k).y) < 0.6) { seen.add(kk); st.push(kk); }
        }
      }
      const area = comp.length * CELL * CELL;
      if (area < 3) continue;
      const sides = {}, names = {}, tops = [];
      for (const k of comp) { const x = k % W, z = (k - x) / W, c = deckCells.get(k); inc(sides, sideOfCell(x, z)); inc(names, c.name); tops.push(c.top); }
      const sideSet = Object.keys(sides);
      const dom = Object.entries(sides).sort((a, b) => b[1] - a[1])[0][0];
      const where = sideSet.length >= 3 ? 'round' : sideName(dom);
      // distance from the interior (cells), to tell a porch against the walls from a platform apart
      let touch = false;
      for (const k of comp) { const x = k % W, z = (k - x) / W; if (near_int(x, z, 1)) { touch = true; break; } }
      D.decks.push({ band: c0.band, area: r2(area), top: r2(q(tops, 0.5)), where, names, touch });
    }
    D.deckN = D.decks.length;

    // --- low walls, fences and railings outside the walls
    const runPieces = [];
    for (let i = 0; i < ps.length; i++) {
      if (tiltedQ(i)) continue;
      const r = R(i), b = boxes[i], bb = bx(i), nm = ps[i].name;
      let cls = null, len = 0, railH = null;
      const topG = b.y1 - g, botG = b.y0 - g;
      const mx = cx(X[i]), mz = cz(Z[i]);
      if (mx < 0 || mz < 0 || mx >= W || mz >= H || interior[mz * W + mx]) continue;
      if (!near_int(mx, mz, 24)) continue;
      const dk = deckCells.get(mz * W + mx);
      const ph = b.y1 - b.y0;
      if (r === 'fence' && !/sharpstakes|stake_wall|stakewall/.test(nm)) { cls = 'fence'; len = info[i].size[0] * (ps[i].s || [1, 1, 1])[0]; }
      else if (r === 'wall' && ph <= 1.7 && ph >= 0.3 && !near_int(mx, mz, 1) && !/fence/.test(nm) && (dk ? b.y0 >= dk.y - 0.3 && b.y1 - dk.y <= 1.7 : botG <= 1.5)) { cls = 'lowWall'; len = Math.max(bb.x1 - bb.x0, bb.z1 - bb.z0); }
      else if (r === 'beam' && info[i].shape === 'box' && !BEAMNN.test(nm) && Math.abs(A[i].ax[1]) < 0.1 && !near_int(mx, mz, 1)) {
        // a rail: horizontal beam 0.5 to 1.5 m over its post's foot, with a post within 1 m
        const pj = hit([ps[i].x, (b.y0 + b.y1) / 2, ps[i].z], 1.0, j => R(j) === 'pole' && !tiltedQ(j));
        if (pj >= 0) { const h = (b.y0 + b.y1) / 2 - boxes[pj].y0; if (h >= 0.5 && h <= 1.5) { cls = dk ? 'deckRail' : 'yardRail'; len = info[i].size[0] * (ps[i].s || [1, 1, 1])[0]; railH = h; } }
      }
      if (!cls) continue;
      if (cls === 'lowWall' && dk) cls = 'deckWall';
      if (cls === 'fence' && dk) cls = 'deckRail';
      runPieces.push({ i, cls, len, mx, mz, top: railH != null ? railH : ph, name: nm, onDeck: !!dk, base: 0 });
    }
    // runs: pieces of one class joined within 1.2 m
    const used = new Array(runPieces.length).fill(false);
    for (let a = 0; a < runPieces.length; a++) {
      if (used[a]) continue;
      used[a] = true;
      const run = [runPieces[a]], st = [a];
      while (st.length) {
        const k = st.pop(), pk = runPieces[k];
        for (let m = 0; m < runPieces.length; m++) {
          if (used[m]) continue;
          const pm = runPieces[m], same = pm.cls === pk.cls || (/Rail|fence/.test(pm.cls) && /Rail|fence/.test(pk.cls));
          if (same && Math.hypot(pm.mx - pk.mx, pm.mz - pk.mz) * CELL <= 2.6) { used[m] = true; run.push(pm); st.push(m); }
        }
      }
      const sides = {}, names = {}, tops = [];
      let len = 0;
      for (const p of run) { inc(sides, sideOfCell(p.mx, p.mz)); inc(names, p.name); tops.push(p.top); len += p.len; }
      const dom = Object.entries(sides).sort((x, y) => y[1] - x[1])[0][0];
      const cls = run[0].cls;
      D.runs.push({ cls, n: run.length, len: r2(len), top: r2(q(tops, 0.5)), where: Object.keys(sides).length >= 3 ? 'round' : sideName(dom), names });
    }
  }
  rec.decks = D;

  const S = { buildings: [], gaps: [] };
  // level cells: floors by cluster and height
  const floorsBy = new Map();
  for (let i = 0; i < ps.length; i++) {
    if (R(i) !== 'floor' || tiltedQ(i)) continue;
    const mx = cx(X[i]), mz = cz(Z[i]);
    if (mx < 0 || mz < 0 || mx >= W || mz >= H) continue;
    // the cluster whose roofed cells lie within 2 cells
    let cid = -1;
    for (let dz = -3; dz <= 3 && cid < 0; dz++) for (let dx = -3; dx <= 3; dx++) { const x2 = mx + dx, z2 = mz + dz; if (x2 >= 0 && z2 >= 0 && x2 < W && z2 < H && lab_[z2 * W + x2] >= 0) { cid = lab_[z2 * W + x2]; break; } }
    if (cid < 0) continue;
    const bb = bx(i);
    (floorsBy.get(cid) || floorsBy.set(cid, []).get(cid)).push({ y: boxes[i].y1, area: (bb.x1 - bb.x0) * (bb.z1 - bb.z0) });
  }
  for (const c of keep) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const k of c.cells) { const x = k % W, z = (k - x) / W; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    // wall bottoms and tops inside the cluster's bounds
    const wl = [];
    for (let i = 0; i < ps.length; i++) if ((R(i) === 'wall' || R(i) === 'pole') && !tiltedQ(i)) { const mx = cx(X[i]), mz = cz(Z[i]); if (mx >= x0 - 1 && mx <= x1 + 1 && mz >= z0 - 1 && mz <= z1 + 1 && lab_[Math.max(0, Math.min(H - 1, mz)) * W + Math.max(0, Math.min(W - 1, mx))] !== undefined) wl.push(i); }
    const wb = wl.map(i => boxes[i].y0).sort((a, b) => a - b);
    const ground = wb.length ? wb[Math.floor(wb.length * 0.1)] : g;
    // upper levels: floor tops at least 2 m over the ground, grouped by 0.5 m, with 6 m2 or more
    const fl = (floorsBy.get(c.id) || []).filter(f => f.y - ground >= 2.0 && f.y - ground <= 40);
    const lv = new Map();
    for (const f of fl) { const k = Math.round(f.y * 2) / 2; lv.set(k, (lv.get(k) || 0) + f.area); }
    // a level counts when walls or posts stand on it (4 pieces or more), so landings, decks and flat roofs do not
    const ups = [...lv.entries()].filter(([y, a]) => a >= 6 && wl.filter(i => boxes[i].y0 >= y - 0.6 && boxes[i].y0 <= y + 0.8).length >= 4).map(([y]) => y).sort((a, b) => a - b);
    const levels = [ground];
    for (const y of ups) if (y - levels[levels.length - 1] >= 2.4) levels.push(y);
    const eave = wl.length ? Math.max(...wl.map(i => boxes[i].y1)) - ground : null;
    let roofTop = -Infinity;
    for (const k of c.cells) { /* roof top from the cluster's roof pieces */ }
    S.buildings.push({ id: c.id, area: r2(c.area), w: r2((x1 - x0 + 1) * CELL), l: r2((z1 - z0 + 1) * CELL), storeys: levels.length, eave: eave == null ? null : r2(eave), walls: wl.length });
    c.box = [x0, x1, z0, z1];
  }
  // gap to the nearest other building: roof edge cell to roof edge cell, within 15 m
  if (keep.length >= 2) {
    const edge = keep.map(c => c.cells.filter(k => { const x = k % W, z = (k - x) / W; return x === 0 || z === 0 || x === W - 1 || z === H - 1 || !roofMask[k - 1] || !roofMask[k + 1] || !roofMask[k - W] || !roofMask[k + W]; }));
    const B = 8, hs = new Map();
    keep.forEach((c, n) => { for (const k of edge[n]) { const x = k % W, z = (k - x) / W, key = Math.floor(x / B) + ',' + Math.floor(z / B); (hs.get(key) || hs.set(key, []).get(key)).push([n, x, z]); } });
    keep.forEach((c, n) => {
      let best = Infinity;
      for (const k of edge[n]) {
        const x = k % W, z = (k - x) / W, bx_ = Math.floor(x / B), bz_ = Math.floor(z / B);
        for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (const [m, x2, z2] of hs.get((bx_ + dx) + ',' + (bz_ + dz)) || []) { if (m === n) continue; const d = Math.hypot(x - x2, z - z2) * CELL; if (d < best) best = d; }
      }
      S.buildings[n].gap = best === Infinity ? null : r2(Math.max(0, best - CELL));
    });
  }
  rec.st = S;
  return rec;
}

// ---------------------------------------------------------------- run
const R = [];
let done = 0;
files.forEach((f, fi) => {
  if (fi % cn !== ci) return;
  try { const r = analyse(f); if (r) R.push(r); } catch (e) { R.push({ f: path.basename(f), error: String(e.stack || e).slice(0, 300) }); }
  done++;
});
fs.writeFileSync(out, JSON.stringify({ chunk: [ci, cn], files: done, records: R }));
console.log(`chunk ${ci}/${cn}: ${done} files, ${R.filter(r => r.trim).length} builds, ${R.filter(r => r.error).length} errors`);
