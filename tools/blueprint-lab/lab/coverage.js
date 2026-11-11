// Coverage audit: how common each building shape, wall type, roof type, feature and decoration prefab is in the
// well-liked community builds, against the generator's own output. Writes the ranked gaps to docs/COVERAGE.md.
//   node lab/coverage.js [compact.json] [out md] [--json out.json] [--quick]
//
// Well-liked: the top quarter by downloads among vanilla-only builds with downloads (as lab/learn_critic.js), kept
// where they are buildings (12 wall pieces or more). The generated side: every type in every biome at s1d1, s2d2 and
// s3d3 (seed 1), and every village culture's samples, as lab/check_set.js makes them (one try each).
//
// Both sides go through the same measure, so the numbers compare like with like. A build is turned so its walls run
// along the axes, its ground-storey walls are drawn on a half-meter grid, and what the outside cannot reach is its
// footprint. The footprint's shape family comes from the bounding box less the footprint: no big bite is a rect (or
// long, or square), one bite at a corner an L, one in the middle of a side a U, two corner bites on one side a T (or a
// nave), two across from each other a Z, four a cross, a hole in the middle a court; walls off the axes make a round or
// many-sided plan.
const fs = require('fs'), path = require('path');
const lab = path.join(__dirname, '..');
const P = require(lab + '/lib/pieces.js');
const MODELS = require(lab + '/data/piece-models.json').pieces;
const SM = require('./shape_mode.js'), SHP = require(lab + '/lib/shapes.js');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1] === '--json'));
const compactPath = pos[0] || '/home/claude/study/compact.json';
const outMd = pos[1] || path.join(lab, '../../docs/COVERAGE.md');
const outJson = opt('--json', '/tmp/coverage.json');
const QUICK = args.includes('--quick');

const deg = Math.PI / 180;
const norm = a => ((a % 360) + 360) % 360;
const MODDED = /^(kg_|GB_|CastleKit|MB|mm_|BBH|rk_|Piece_vf|OdinsKingdom|h_|\$|Hayze|rae_|teq_|tkd_|rkc_|MountainKit)/;
const known = n => !!MODELS[n] && !MODDED.test(n);
const role = n => P.piece(n).role;

// ---------------------------------------------------------------- one build's measure

function bounds(n) {
  const m = MODELS[n];
  if (m && m.collider) return m.collider;
  if (m && m.bounds) return m.bounds;
  const s = P.piece(n).size;
  return { min: [-s[0] / 2, -s[1] / 2, -s[2] / 2], max: [s[0] / 2, s[1] / 2, s[2] / 2] };
}
function box(p) {
  const b = bounds(p.name), c = Math.cos(p.yaw * deg), s = Math.sin(p.yaw * deg);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const x of [b.min[0], b.max[0]]) for (const z of [b.min[2], b.max[2]]) {
    const wx = p.x + x * c + z * s, wz = p.z - x * s + z * c;
    x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); z0 = Math.min(z0, wz); z1 = Math.max(z1, wz);
  }
  return { x0, x1, z0, z1, y0: p.y + b.min[1], y1: p.y + b.max[1] };
}
const isStone = n => /^stone_|blackmarble|grausten|Ashlands_Wall|Ashlands_Fortress/.test(n);
const isAxis = yaw => Math.abs(((yaw + 45) % 90) - 45) < 4;

const G = 0.5; // grid step, meters
function measure(raw) {
  // a yard's fence and its gate are not the building's walls (the generator marks its yard pieces)
  const ps = raw.filter(p => known(p.name)).map(p => ({ ...p, yaw: norm(p.yaw), r: role(p.name) }));
  const yardish = p => p.yard || /fence_gate|stake_wall|sharpstakes/.test(p.name);
  const walls = ps.filter(p => p.r === 'wall' && !/arch|divider|decowall/.test(p.name));
  if (walls.length < 12) return null;
  // turn the build so most walls run along the axes
  const hist = new Map();
  for (const w of walls) { const a = Math.round(w.yaw % 90); hist.set(a, (hist.get(a) || 0) + 1); }
  let rot = [...hist.entries()].sort((a, b) => b[1] - a[1])[0][0];
  if (rot > 45) rot -= 90;
  if (Math.abs(rot) > 0.5) {
    const a = rot * deg, ca = Math.cos(a), sa = Math.sin(a);
    for (const p of ps) { const x = p.x, z = p.z; p.x = x * ca - z * sa; p.z = x * sa + z * ca; p.yaw = norm(p.yaw - rot); }
  }
  for (const p of ps) p.b = box(p);
  const struct = ps.filter(p => P.piece(p.name).structural);
  const ys = struct.map(p => p.b.y0).sort((a, b) => a - b), ground = ys[Math.floor(ys.length * 0.02)];
  const wlen = w => { const b = bounds(w.name); return b.max[0] - b.min[0]; };
  const offAxis = walls.filter(w => !isAxis(w.yaw)).reduce((t, w) => t + wlen(w), 0) / walls.reduce((t, w) => t + wlen(w), 0);

  // ---- footprint: ground-storey walls and doors on a half-meter grid; the outside floods in; gaps up to 2 m are
  // closed by growing the walls a meter and shrinking the result again
  const low = ps.filter(p => (p.r === 'wall' || p.r === 'door' || p.r === 'window') && !yardish(p) && p.b.y0 < ground + 3.2 && p.b.y1 > ground + 0.3);
  if (low.length < 6) return null;
  let X0 = Infinity, X1 = -Infinity, Z0 = Infinity, Z1 = -Infinity;
  for (const p of low) { X0 = Math.min(X0, p.b.x0); X1 = Math.max(X1, p.b.x1); Z0 = Math.min(Z0, p.b.z0); Z1 = Math.max(Z1, p.b.z1); }
  if ((X1 - X0) * (Z1 - Z0) > 160 * 160) return null;
  const pad = 4, nx = Math.ceil((X1 - X0) / G) + 2 * pad, nz = Math.ceil((Z1 - Z0) / G) + 2 * pad;
  const ix = x => Math.floor((x - X0) / G) + pad, iz = z => Math.floor((z - Z0) / G) + pad;
  const wall = new Uint8Array(nx * nz);
  for (const p of low) {
    const bb = bounds(p.name), c = Math.cos(p.yaw * deg), s = Math.sin(p.yaw * deg), mz = (bb.min[2] + bb.max[2]) / 2;
    for (let t = bb.min[0]; t <= bb.max[0] + 1e-6; t += 0.2) {
      const x = p.x + t * c + mz * s, z = p.z - t * s + mz * c, i = ix(x), k = iz(z);
      if (i >= 0 && i < nx && k >= 0 && k < nz) wall[k * nx + i] = 1;
    }
  }
  const grow = (m, r, v) => { // dilate cells equal to v by r cells (square)
    const out = new Uint8Array(m);
    for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) if (m[k * nx + i] === v)
      for (let dk = -r; dk <= r; dk++) for (let di = -r; di <= r; di++) { const a = i + di, b = k + dk; if (a >= 0 && a < nx && b >= 0 && b < nz) out[b * nx + a] = v; }
    return out;
  };
  const closed = grow(wall, 2, 1);
  const outside = new Uint8Array(nx * nz), st = [0];
  outside[0] = 1;
  while (st.length) {
    const c = st.pop(), i = c % nx, k = (c - i) / nx;
    for (const [a, b] of [[i + 1, k], [i - 1, k], [i, k + 1], [i, k - 1]]) {
      if (a < 0 || a >= nx || b < 0 || b >= nz) continue;
      const j = b * nx + a;
      if (!outside[j] && !closed[j]) { outside[j] = 1; st.push(j); }
    }
  }
  // the outside grown back by the same two cells: what is left is the footprint
  const out2 = grow(outside, 2, 1);
  const foot = new Uint8Array(nx * nz);
  let area = 0;
  for (let j = 0; j < foot.length; j++) if (!out2[j]) { foot[j] = 1; area++; }
  // floors at the foot of the walls count too where the walls do not close (open halls, arcades)
  area *= G * G;
  if (area < 8) {
    for (const p of ps) if (p.r === 'floor' && Math.abs(p.b.y1 - ground) < 1) for (let x = p.b.x0 + 0.25; x < p.b.x1; x += G) for (let z = p.b.z0 + 0.25; z < p.b.z1; z += G) { const i = ix(x), k = iz(z); if (i >= 0 && i < nx && k >= 0 && k < nz) foot[k * nx + i] = 1; }
    area = foot.reduce((t, v) => t + v, 0) * G * G;
    if (area < 8) return null;
  }
  const inFoot = (x, z) => { const i = ix(x), k = iz(z); return i >= 0 && i < nx && k >= 0 && k < nz && foot[k * nx + i] === 1; };
  // the footprint's parts: the biggest one gets the shape; two or more big ones make a group of buildings
  const lab2 = new Int32Array(nx * nz), comps = [];
  for (let j = 0; j < foot.length; j++) {
    if (!foot[j] || lab2[j]) continue;
    const id = comps.length + 1, q = [j], cs = [];
    lab2[j] = id;
    while (q.length) {
      const c = q.pop(); cs.push(c);
      const i = c % nx, k = (c - i) / nx;
      for (const [a, b] of [[i + 1, k], [i - 1, k], [i, k + 1], [i, k - 1]]) { const t = b * nx + a; if (a >= 0 && a < nx && b >= 0 && b < nz && foot[t] && !lab2[t]) { lab2[t] = id; q.push(t); } }
    }
    comps.push(cs);
  }
  comps.sort((a, b) => b.length - a.length);
  const big = comps.filter(c => c.length * G * G >= 16);
  const mainC = comps[0];
  let bi0 = Infinity, bi1 = -1, bk0 = Infinity, bk1 = -1;
  for (const c of mainC) { const i = c % nx, k = (c - i) / nx; bi0 = Math.min(bi0, i); bi1 = Math.max(bi1, i); bk0 = Math.min(bk0, k); bk1 = Math.max(bk1, k); }
  const bw = bi1 - bi0 + 1, bd = bk1 - bk0 + 1, mainSet = new Set(mainC);
  const fill = mainC.length / (bw * bd);
  // the bounding box less the footprint: its bites, each by the box sides it touches
  const seen = new Uint8Array(bw * bd), bites = [];
  for (let k = 0; k < bd; k++) for (let i = 0; i < bw; i++) {
    const j0 = k * bw + i;
    if (seen[j0] || mainSet.has((k + bk0) * nx + i + bi0)) continue;
    const q = [j0]; let n = 0; const sides = new Set();
    seen[j0] = 1;
    while (q.length) {
      const c = q.pop(); n++;
      const a = c % bw, b = (c - a) / bw;
      if (a === 0) sides.add('W'); if (a === bw - 1) sides.add('E'); if (b === 0) sides.add('S'); if (b === bd - 1) sides.add('N');
      for (const [u, v] of [[a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]]) {
        if (u < 0 || u >= bw || v < 0 || v >= bd) continue;
        const t = v * bw + u;
        if (!seen[t] && !mainSet.has((v + bk0) * nx + u + bi0)) { seen[t] = 1; q.push(t); }
      }
    }
    if (n >= 0.06 * bw * bd && n * G * G >= 6) bites.push({ n, sides: [...sides].sort().join('') });
  }
  const W = bw * G, D = bd * G, aspect = Math.max(W, D) / Math.min(W, D);
  let shape;
  const holes = bites.filter(b => !b.sides), edge = bites.filter(b => b.sides);
  const corner = edge.filter(b => b.sides.length === 2 && !/EW|NS/.test(b.sides)), side = edge.filter(b => b.sides.length === 1);
  if (offAxis > 0.22) shape = 'round';
  else if (holes.length) shape = 'court';
  else if (!edge.length) shape = aspect < 1.2 ? 'square' : aspect < 1.75 ? 'rect' : 'long';
  else if (edge.length === 1 && corner.length === 1) shape = 'L';
  else if (edge.length === 1 && side.length === 1) shape = 'U';
  else if (edge.length === 2 && corner.length === 2) {
    const [a, b] = corner.map(c => c.sides);
    shape = [...a].some(ch => b.includes(ch)) ? 'T' : 'Z';
  } else if (edge.length === 2 && corner.length === 1 && side.length === 1) shape = 'L+U';
  else if (edge.length === 4 && corner.length === 4) shape = 'cross';
  else shape = 'complex';
  if (shape === 'T') {
    // a T whose stem is the building's own long axis run on (a chancel, a narrower end bay) reads as a nave
    const f = edge.reduce((t, b) => t + b.n, 0) / (bw * bd);
    if (f < 0.3 && aspect > 1.6) shape = 'nave';
  }

  // ---- storeys and height
  const upper = ps.filter(p => p.r === 'floor' && p.b.y1 > ground + 1.6 && inFoot((p.b.x0 + p.b.x1) / 2, (p.b.z0 + p.b.z1) / 2)).map(p => p.b.y1 - ground).sort((a, b) => a - b);
  const levels = [];
  for (const y of upper) if (!levels.length || y - levels[levels.length - 1] > 1.5) levels.push(y);
  const lvCount = levels.filter(y => upper.filter(v => Math.abs(v - y) < 0.8).length >= 4).length;
  const roofs = ps.filter(p => ['roof', 'roofCorner', 'roofTop'].includes(p.r));
  const top = Math.max(...ps.filter(p => P.piece(p.name).structural).map(p => p.b.y1)) - ground;

  // ---- wall type: stone low and timber over it, logs, framed boards (diagonal beams in the wall planes), boards
  const wt = { stoneLow: 0, stoneHigh: 0, log: 0, wood: 0, marble: 0, grausten: 0, other: 0 };
  for (const w of walls) {
    const y = w.b.y0 - ground, lowW = y < 1.2;
    if (/blackmarble/.test(w.name)) wt.marble++;
    else if (/grausten|Ashlands_/.test(w.name)) wt.grausten++;
    else if (isStone(w.name)) lowW ? wt.stoneLow++ : wt.stoneHigh++;
    else if (/_log/.test(w.name)) wt.log++;
    else if (/wood|ashwood|stave|darkwood/.test(w.name)) wt.wood++;
    else wt.other++;
  }
  const diag = ps.filter(p => /beam_26|beam_45|log_26|log_45|wall_cross|beam_67/.test(p.name) && p.b.y0 < top + ground - 1).length;
  const tot = walls.length, stone = wt.stoneLow + wt.stoneHigh;
  let wallType;
  if (wt.marble > 0.4 * tot) wallType = 'marble';
  else if (wt.grausten > 0.4 * tot) wallType = 'grausten';
  else if (stone > 0.65 * tot) wallType = 'stone';
  else if (wt.stoneLow > 0.15 * tot && wt.stoneLow > 2 * wt.stoneHigh && (wt.wood + wt.log) > 0.3 * tot) wallType = 'stone-base';
  else if (wt.log > 0.35 * tot) wallType = 'log';
  else if (diag > 0.2 * wt.wood) wallType = 'half-timber';
  else wallType = 'plank';

  // ---- roof
  const surf = ps.filter(p => p.r === 'roof');
  const ocorner = ps.filter(p => /ocorner/.test(p.name)).length, icorner = ps.filter(p => /icorner/.test(p.name)).length;
  const gables = ps.filter(p => p.r === 'gable' && !/upsidedown/.test(p.name)).length;
  const pitch45 = surf.filter(p => /45/.test(p.name)).length, pitch26 = surf.filter(p => !/45|67/.test(p.name)).length;
  const dirs = new Set(surf.filter(p => isAxis(p.yaw)).map(p => Math.round(p.yaw / 90) % 4));
  let roofType;
  if (surf.length < 4) roofType = ps.some(p => p.r === 'floor' && p.b.y1 > ground + 2.2) ? 'flat' : 'none';
  else if (surf.filter(p => !isAxis(p.yaw)).length > 0.3 * surf.length) roofType = 'conical';
  else if (dirs.size === 1) roofType = 'shed';
  else if (ocorner >= 4 && gables <= 2) roofType = 'hip';
  else if (gables >= 2 && ocorner >= 4) roofType = 'gable+hip';
  else if (gables >= 2) roofType = 'gable';
  else roofType = 'other';
  const pitch = surf.length < 4 ? '-' : pitch45 > 2 * pitch26 ? '45' : pitch26 > 2 * pitch45 ? '26' : 'mixed';
  // eaves: the lowest roof piece of each slope; how far it reaches past the footprint
  const roofAt = new Set(surf.map(p => `${Math.round(p.x)}|${Math.round(p.z)}`));
  const over = [];
  for (const p of surf) {
    if (!isAxis(p.yaw)) continue;
    const dx = Math.round(Math.sin(p.yaw * deg)), dz = Math.round(Math.cos(p.yaw * deg)); // down the slope
    if (roofAt.has(`${Math.round(p.x + dx * 2)}|${Math.round(p.z + dz * 2)}`)) continue;
    const ex = p.x + dx, ez = p.z + dz; // the low edge
    let d = 0;
    while (d < 3 && !inFoot(ex - dx * d, ez - dz * d)) d += 0.25;
    if (d < 3) over.push(d);
  }
  over.sort((a, b) => a - b);
  const overhang = over.length ? over[Math.floor(over.length / 2)] : null;

  // ---- ridges: lines of ridge caps, by direction and height
  const caps = ps.filter(p => p.r === 'roofTop' && !/wall_roof_top/.test(p.name) && isAxis(p.yaw));
  const lines = new Map();
  for (const c of caps) {
    const k = Math.round(c.yaw / 90) % 2, line = Math.round((k === 0 ? c.z : c.x) * 2) / 2, y = Math.round(c.y * 2) / 2;
    const key = `${k}|${line}|${y}`; let l = lines.get(key); if (!l) lines.set(key, l = []); l.push(k === 0 ? c.x : c.z);
  }
  const ridges = [...lines.entries()].map(([key, v]) => { const [k, line, y] = key.split('|').map(Number); v.sort((a, b) => a - b); return { k, line, y, len: v[v.length - 1] - v[0] + 2, n: v.length }; }).filter(r => r.n >= 1);
  ridges.sort((a, b) => b.len - a.len);
  const mainR = ridges[0];
  const dormers = mainR ? ridges.filter(r => r !== mainR && r.k !== mainR.k && r.len <= 4.5 && r.y < mainR.y - 0.9) : [];
  const ridgeYs = [...new Set(ridges.filter(r => r.len >= 4).map(r => r.y))];
  const stepped = ridgeYs.length >= 2 && Math.max(...ridgeYs) - Math.min(...ridgeYs) > 1;
  const multiRidge = ridges.filter(r => mainR && r.k === mainR.k && r.len >= 6 && Math.abs(r.y - mainR.y) < 1.5).length >= 2;

  // ---- outside and inside: a piece is on the outside when its middle is off the footprint, or on its rim
  const rim = (x, z) => { if (!inFoot(x, z)) return true; return [[G, 0], [-G, 0], [0, G], [0, -G]].some(([a, b]) => !inFoot(x + a, z + b)); };
  const mid = p => [(p.b.x0 + p.b.x1) / 2, (p.b.z0 + p.b.z1) / 2];
  const outer = p => { const [x, z] = mid(p); return rim(x, z); };
  const offFoot = p => { const [x, z] = mid(p); return !inFoot(x, z); };
  const prefabs = new Set(ps.map(p => p.name)), outerPrefabs = new Set(ps.filter(outer).map(p => p.name));

  // ---- features
  const f = {};
  const has = (re, test) => ps.some(p => re.test(p.name) && (!test || test(p)));
  const count = (re, test) => ps.filter(p => re.test(p.name) && (!test || test(p))).length;
  const roofish = p => ['roof', 'roofCorner', 'roofTop'].includes(p.r);
  const nearStruct = (p, re, d) => ps.some(q => q !== p && re.test(q.r) && Math.abs(q.x - p.x) < d && Math.abs(q.z - p.z) < d);
  // a porch or canopy: roof 1.5 m or more past the footprint, 2 to 5 m up, with posts under it
  f.porch = ps.some(p => roofish(p) && p.b.y0 > ground + 1.8 && p.b.y0 < ground + 5 && (() => { const [x, z] = mid(p); if (inFoot(x, z)) return false; for (const [a, b] of [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]) if (inFoot(x + a, z + b)) return false; return true; })() &&
    ps.some(q => (q.r === 'pole' || /pillar/.test(q.name)) && q.b.y0 < ground + 0.6 && Math.abs(q.x - p.x) < 2.2 && Math.abs(q.z - p.z) < 2.2));
  // a balcony or gallery: an upper floor out past the footprint with a rail or fence on it
  f.balcony = ps.some(p => p.r === 'floor' && p.b.y1 > ground + 1.8 && offFoot(p) && ps.some(q => (q.r === 'fence' || q.r === 'beam' || /halfwall|wall_half|quarter/.test(q.name)) && q.b.y0 > p.b.y1 - 0.1 && q.b.y0 < p.b.y1 + 1.2 && Math.abs(q.x - p.x) < 1.6 && Math.abs(q.z - p.z) < 1.6));
  // a deck or terrace at the foot of the house, 8 square meters or more
  f.deck = ps.filter(p => p.r === 'floor' && p.b.y1 < ground + 1.6 && offFoot(p)).reduce((t, p) => t + (p.b.x1 - p.b.x0) * (p.b.z1 - p.b.z0), 0) >= 8;
  f.stairEntry = ps.some(p => p.r === 'stair' && offFoot(p) && p.b.y0 < ground + 1.5);
  f.raised = (() => { const fl = ps.filter(p => p.r === 'floor' && inFoot(...mid(p)) && p.b.y1 < ground + 3).map(p => p.b.y1 - ground).sort((a, b) => a - b); return fl.length > 4 && fl[Math.floor(fl.length / 2)] > 0.9; })();
  f.dormer = dormers.length > 0;
  f.stepped = stepped;
  f.multiRidge = multiRidge;
  f.valley = icorner > 0;
  f.tower = top > 11 && area < 120 || (top > 14);
  // a chimney: stone or timber pieces standing over the roof surface next to it
  const rh = new Map();
  for (const p of roofs) { const k = `${Math.round(p.x)}|${Math.round(p.z)}`; rh.set(k, Math.max(rh.get(k) || -1e9, p.b.y1)); }
  const stack = ps.filter(p => /^(stone_wall|stone_pillar|blackmarble|Piece_grausten_wall|iron_grate)/.test(p.name) && (() => { let m = -1e9; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const v = rh.get(`${Math.round(p.x) + a}|${Math.round(p.z) + b}`); if (v != null) m = Math.max(m, v); } return m > -1e9 && p.b.y0 > m - 0.5 && p.b.y1 > m + 0.4; })());
  f.chimney = stack.length >= 2;
  f.cornerPosts = (() => { // poles standing on the footprint's convex corners
    let n = 0, w = 0;
    for (let k = 1; k < nz - 1; k++) for (let i = 1; i < nx - 1; i++) {
      const j = k * nx + i;
      if (!foot[j]) continue;
      const e = !foot[j + 1], wv = !foot[j - 1], s = !foot[j - nx], nn = !foot[j + nx];
      if (!((e || wv) && (s || nn)) || (e && wv) || (s && nn)) continue;
      const x = X0 + (i - pad + 0.5) * G, z = Z0 + (k - pad + 0.5) * G;
      n++;
      if (ps.some(p => p.r === 'pole' && Math.abs(p.x - x) < 0.6 && Math.abs(p.z - z) < 0.6 && p.b.y0 < ground + 1.5)) w++;
    }
    return n > 0 && w / n >= 0.5;
  })();
  f.bargeboard = has(/beam_26|beam_45|log_26|log_45/, p => p.b.y0 > ground + 2.5 && ps.some(q => q.r === 'gable' && Math.hypot(q.x - p.x, q.z - p.z) < 1.4 && Math.abs(q.y - p.y) < 1.5));
  f.roofCross = has(/wall_roof_top/);
  f.glass = has(/crystal_wall|window_glass/);
  f.shutters = has(/^wood_window$/);
  f.stoneArch = has(/stone_arch|blackmarble_arch|grausten_wall_arch|ashwood_wall_arch|darkwood_arch/);
  f.gateDoor = has(/^wood_gate|iron_gate|^gate|_gate$/, p => p.r === 'door' && !/fence/.test(p.name));
  f.wallTorchOut = has(/walltorch|dvergr_lantern$|piece_hoodedlantern|brazierceiling/, outer);
  f.groundTorchOut = has(/groundtorch|lantern_standing|brazier/, p => offFoot(p) && !/ceiling/.test(p.name));
  f.bannerOut = has(/banner|cloth_hanging/, outer);
  f.itemStandOut = has(/itemstand/, outer);
  f.dragon = has(/wood_dragon|darkwood_raven|darkwood_wolf/);
  f.fenceYard = count(/fence|stake_wall|sharpstakes|stakewall/, offFoot) >= 6;
  f.craftOutside = has(/./, p => p.r === 'craft' && offFoot(p) && !/portal/.test(p.name));
  f.storageOutside = has(/./, p => (p.r === 'storage' || p.r === 'clutter') && offFoot(p));
  f.seatOutside = has(/./, p => p.r === 'seat' && offFoot(p));
  f.plantsOutside = has(/./, p => p.r === 'nature' && offFoot(p));
  f.logPoles = has(/wood_pole_log/);
  f.ironTrim = has(/woodiron_beam|woodiron_pole/);
  f.darkTrim = has(/darkwood_beam|darkwood_pole/);
  f.dvergr = has(/dvergr/);
  f.decowall = has(/decowall|divider/);
  f.halfWalls = has(/wall_half|halfwall/, outer);
  f.oneByOne = has(/wood_wall_quarter|quarterwall|stone_wall_1x1|blackmarble_1x1/, outer);
  f.stoneFloorOut = has(/stone_floor|blackmarble_floor|grausten_floor/, offFoot);
  f.ladderOut = has(/ladder/, offFoot);
  // clipped and nested pieces: a decoration or a light whose middle lies inside a wall
  const wallBoxes = walls.map(w => ({ ...w.b, w }));
  // VH_SHAPES=collider|coarse|fine: the middle must lie inside what shows of the wall (its shapes, lab/shape_mode.js); unset: the wall's collider box
  const wallParts = b => (b.sp || (b.sp = SM.parts({ name: b.w.name, x: b.w.x, y: b.w.y, z: b.w.z, yaw: b.w.yaw }) || []));
  const inWall = (b, x, y, z) => (SM.MODE ? wallParts(b).some(o => SHP.inside(o, x, y, z, -0.02)) && Math.min(b.x1 - b.x0, b.z1 - b.z0) < 0.6
    : x > b.x0 + 0.02 && x < b.x1 - 0.02 && z > b.z0 + 0.02 && z < b.z1 - 0.02 && y > b.y0 && y < b.y1 && Math.min(b.x1 - b.x0, b.z1 - b.z0) < 0.6);
  const clipN = ps.filter(p => ['deco', 'light', 'misc', 'craft'].includes(p.r) && (() => { const [x, z] = mid(p), y = (p.b.y0 + p.b.y1) / 2; return wallBoxes.some(b => inWall(b, x, y, z)); })()).length;
  f.clipped = clipN >= 3;
  f.deepOverhang = overhang != null && overhang >= 0.5;

  return {
    shape, compound: big.length >= 2, area: Math.round(area), W, D, aspect: +aspect.toFixed(2), fill: +fill.toFixed(2),
    storeys: 1 + lvCount, height: +top.toFixed(1), wallType, roofType, pitch, overhang, features: f, prefabs: [...prefabs], outerPrefabs: [...outerPrefabs],
  };
}

// ---------------------------------------------------------------- the corpus

console.log('reading', compactPath);
const all = JSON.parse(fs.readFileSync(compactPath, 'utf8'));
const vanilla = all.filter(d => d.dls > 0 && d.p.length >= 60 && d.p.length <= 8000 && d.p.every(p => !MODDED.test(p[0])) && d.p.filter(p => !MODELS[p[0]]).length <= d.p.length * 0.02);
vanilla.sort((a, b) => b.dls - a.dls);
const topQ = vanilla.slice(0, Math.ceil(vanilla.length / 4));
console.log('vanilla builds with downloads', vanilla.length, 'top quarter', topQ.length, 'download cut', topQ[topQ.length - 1].dls);
const corpus = [];
for (const d of topQ) {
  const m = measure(d.p.map(p => ({ name: p[0], x: p[1], y: p[2], z: p[3], yaw: p[4] })));
  if (!m) continue;
  m.id = d.id; m.title = d.title; m.dls = d.dls; m.cat = d.cat; m.n = d.p.length;
  // the build's palette, as a biome: the latest-biome building material it uses in quantity
  const ns = d.p.map(p => p[0]), share = re => ns.filter(n => re.test(n)).length / ns.length;
  m.palette = share(/grausten|ashwood|Ashlands/) > 0.05 ? 'Ashlands' : share(/blackmarble|dvergr/) > 0.05 ? 'Mistlands' : share(/darkwood|tar/) > 0.08 ? 'Plains'
    : share(/woodiron|iron_/) > 0.03 ? 'Swamp' : share(/^stone_|_log|wood_pole_log|wood_wall_log/) > 0.05 ? 'Black Forest' : 'Meadows';
  corpus.push(m);
}
all.length = 0;
console.log('corpus buildings measured', corpus.length);

// ---------------------------------------------------------------- the generator

const Gen = require(lab + '/lib/generate.js'), S = require(lab + '/lib/styles.js');
const yawOfQ = q => Math.atan2(2 * (q[3] * q[1] + q[0] * q[2]), 1 - 2 * (q[1] * q[1] + q[2] * q[2])) / deg;
const reqs = [];
const stages = [['s1', 'd1'], ['s2', 'd2'], ['s3', 'd3']];
for (const type of Object.keys(S.TYPES)) for (const biome of ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains', 'Mistlands', 'Ashlands'])
  for (const [stage, decor] of QUICK ? [['s3', 'd3']] : stages) reqs.push({ type, biome, stage, decor, seed: 1 });
for (const [key, C] of Object.entries(S.CULTURES)) {
  if (!C.village) continue;
  (C.sample || ['home', 'longhouse', 'workshop']).forEach((entry, ti) => (QUICK ? [['s3', 'd3']] : stages).forEach(([stage, decor], si) => {
    const [type, where] = entry.split('@');
    reqs.push({ type, biome: where || C.biomes[0], culture: key, stage, decor, seed: 1 + ti * 1009 + si * 101 });
  }));
}
const gen = [];
for (const q of reqs) {
  let d;
  try { d = Gen.generate(q); } catch (e) { continue; }
  const m = measure(d.pieces.map(p => ({ name: p.name, x: p.x, y: p.y, z: p.z, yaw: p.yaw != null ? p.yaw : yawOfQ(p.q || [0, 0, 0, 1]), yard: !!p.yard })));
  if (!m) continue;
  const info = d.request || {};
  m.req = q; m.culture = info.cultureKey || q.culture || '?'; m.genPlan = info.plan; m.genRoof = info.roof; m.genWalls = info.walls;
  m.palette = q.biome;
  gen.push(m);
}
console.log('generated buildings measured', gen.length, 'of', reqs.length);

// ---------------------------------------------------------------- comparing

const share = (set, test) => set.length ? set.filter(test).length / set.length : 0;
const pct = v => `${Math.round(v * 100)} %`;
const dist = (set, key) => { const c = {}; for (const m of set) c[m[key]] = (c[m[key]] || 0) + 1; return c; };
// example builds: well liked ones with the thing, spread so the same few showcase builds do not stand for every gap
const exUsed = new Map();
const examples = test => {
  const seenId = new Set(), out = [];
  for (const m of corpus.filter(test).sort((a, b) => (exUsed.get(a.id) || 0) - (exUsed.get(b.id) || 0) || b.dls - a.dls)) {
    if (seenId.has(m.id)) continue;
    seenId.add(m.id); out.push(m);
    if (out.length === 3) break;
  }
  for (const m of out) exUsed.set(m.id, (exUsed.get(m.id) || 0) + 1);
  return out.map(m => `${(m.title || m.id).replace(/\s+/g, ' ').trim()} (${m.id}, ${m.dls} dl)`);
};
const gaps = [];
const addGap = (kind, name, test, note, w = 1) => {
  const c = share(corpus, test), g = share(gen, test), g3 = share(gen.filter(m => m.req.stage === 's3'), test);
  gaps.push({ kind, name, corpus: c, gen: g, gen3: g3, gap: (c - g) * w, note, test });
};
const SHAPES = ['square', 'rect', 'long', 'L', 'T', 'nave', 'U', 'Z', 'cross', 'court', 'round', 'L+U', 'complex'];
for (const s of SHAPES) addGap('shape', s, m => m.shape === s, 'footprint family');
addGap('shape', 'group of buildings', m => m.compound, 'two or more footprints of 16 square meters or more in one build');
for (const w of ['plank', 'half-timber', 'log', 'stone', 'stone-base', 'marble', 'grausten']) addGap('wall', w, m => m.wallType === w, 'main wall type');
for (const r of ['gable', 'hip', 'gable+hip', 'shed', 'flat', 'conical', 'other']) addGap('roof', r, m => m.roofType === r, 'roof type');
addGap('roof', 'pitch 45', m => m.pitch === '45', 'roof pitch');
addGap('roof', 'pitch 26', m => m.pitch === '26', 'roof pitch');
addGap('roof', 'mixed pitch', m => m.pitch === 'mixed', 'both 26 and 45 degree slopes');
addGap('size', 'three storeys or more', m => m.storeys >= 3, 'upper floor levels inside the footprint');
addGap('size', 'footprint over 150 square meters', m => m.area > 150, 'main footprint');
addGap('size', 'taller than 10 m', m => m.height > 10, 'from the ground to the highest structural piece');
const FEAT = {
  porch: 'a roof 1.5 m past the walls on posts', balcony: 'an upper floor past the walls with a rail', deck: 'a deck or terrace at the foot, 8 square meters or more',
  stairEntry: 'stairs outside the walls', raised: 'the ground floor 0.9 m up or more', dormer: 'a short cross ridge lower than the main one', stepped: 'ridges at two heights',
  multiRidge: 'two or more parallel ridges', valley: 'roof valleys (inner corner pieces)', tower: 'a tower (tall for its footprint)', chimney: 'a stack over the roof',
  cornerPosts: 'posts on half the outside corners or more', bargeboard: 'sloped beams along the gable edge', roofCross: 'the crossed gable boards', glass: 'glass windows',
  shutters: 'wood shutters', stoneArch: 'arches', gateDoor: 'gates used as doors', wallTorchOut: 'wall torches, sconces or hanging lanterns on the outside',
  groundTorchOut: 'standing torches or braziers outside', bannerOut: 'banners or drapes on the outside', itemStandOut: 'item stands (shields, trophies) on the outside',
  dragon: 'carved heads (dragon, raven, wolf)', fenceYard: 'a fence or stakes round a yard', craftOutside: 'crafting stations outside as props',
  storageOutside: 'chests, barrels or piles outside', seatOutside: 'seats outside', plantsOutside: 'plants and rocks outside', logPoles: 'log poles', ironTrim: 'iron-bound beams or poles',
  darkTrim: 'dark wood beams or poles', dvergr: 'Dvergr pieces', decowall: 'carved panels and dividers', halfWalls: 'half walls on the outside', oneByOne: '1 x 1 wall pieces on the outside',
  stoneFloorOut: 'stone paving outside', ladderOut: 'ladders outside', clipped: 'three or more props set into a wall', deepOverhang: 'eaves 0.5 m or more past the walls',
};
for (const [k, note] of Object.entries(FEAT)) addGap('feature', k, m => m.features[k], note);

// prefabs: decoration and lights by group, and each prefab on the outside
const PGROUPS = {
  'banners and drapes': /banner|cloth_hanging|garland/, 'item stands': /itemstand/, 'wall torches and sconces': /walltorch|hoodedlantern|brazierceiling|dvergr_lantern$|dvergrprops_lantern$/,
  'standing lights': /groundtorch|lantern_standing|brazierfloor|Lavalantern|dvergrprops_lantern_standing/, 'carvings': /wood_dragon|darkwood_raven|darkwood_wolf|blackmarble_head/,
  'Dvergr props and pieces': /dvergr/, 'trader and odd props': /trader|piece_pot|cloth_hanging|Pickable_DvergrStein|hooknchain/, 'rugs outside': /rug_|jute_carpet/,
  'woodpiles and stacks': /_stack$|_pile$/, 'barrels and crates': /barrel|crate/, 'carts and wagons': /^Cart$|wagon/,
};
for (const [g, re] of Object.entries(PGROUPS)) addGap('prefab', g, m => m.outerPrefabs.some(n => re.test(n)), 'on or outside the walls', 0.8);
const pre = {};
for (const m of corpus) for (const n of m.outerPrefabs) (pre[n] = pre[n] || { c: 0, g: 0 }).c++;
for (const m of gen) for (const n of m.outerPrefabs) (pre[n] = pre[n] || { c: 0, g: 0 }).g++;
const prefabRows = Object.entries(pre).map(([n, v]) => ({ n, role: role(n), c: v.c / corpus.length, g: v.g / gen.length }))
  .filter(r => r.c >= 0.05).sort((a, b) => (b.c - b.g) - (a.c - a.g));

// by culture: what each culture's generated buildings use, against the corpus builds of its biome's palette
const cultures = [...new Set(gen.map(m => m.culture))].sort();
const palettes = ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains', 'Mistlands', 'Ashlands'];
const topK = (o, k = 4) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, k);
const fmtDist = (set, key) => { const o = dist(set, key); return topK(o, 5).map(([k, v]) => `${k} ${Math.round(v / set.length * 100)}`).join(', '); };
const med = (set, key) => { const v = set.map(m => m[key]).filter(x => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : '-'; };
const q75 = (set, key) => { const v = set.map(m => m[key]).filter(x => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length * 0.75)] : '-'; };

// ---------------------------------------------------------------- writing

gaps.sort((a, b) => b.gap - a.gap);
for (const g of gaps) { g.ex = examples(g.test); delete g.test; }
fs.writeFileSync(outJson, JSON.stringify({ gaps, prefabRows, corpus: corpus.map(m => ({ ...m, prefabs: undefined, outerPrefabs: undefined })), gen: gen.map(m => ({ ...m, prefabs: undefined, outerPrefabs: undefined })) }, null, 1));
const L = [];
L.push('# Coverage: what well-liked builds have and the generator does not', '');
L.push(`Made by \`tools/blueprint-lab/lab/coverage.js\` (${new Date().toISOString().slice(0, 10)}). Corpus: the top quarter by downloads of the vanilla-only builds with downloads (${topQ.length} builds, ${topQ[topQ.length - 1].dls} downloads or more), ${corpus.length} of them buildings (12 wall pieces or more). Generated: ${gen.length} buildings, every type in every biome at s1d1, s2d2 and s3d3 and every village culture's samples (seed 1, one try each).`, '');
L.push('Both sides go through the same measure (see the head of the script). Shares are of buildings. The gap is the corpus share less the generated share, in points; prefab groups count four fifths. Numbers from a measure this rough are a guide: a few points either way mean little.', '');
L.push('## The 20 biggest gaps', '');
L.push('| # | Kind | What | Corpus | Generated | Generated s3 | Gap | Example source builds |', '|---|---|---|---|---|---|---|---|');
gaps.slice(0, 20).forEach((g, i) => L.push(`| ${i + 1} | ${g.kind} | ${g.name}: ${g.note} | ${pct(g.corpus)} | ${pct(g.gen)} | ${pct(g.gen3)} | ${Math.round(g.gap * 100)} | ${g.ex.join('; ')} |`));
L.push('', '## Where the generator has more than the corpus', '');
L.push('| Kind | What | Corpus | Generated |', '|---|---|---|---|');
for (const g of gaps.slice().sort((a, b) => a.gap - b.gap).slice(0, 10)) L.push(`| ${g.kind} | ${g.name} | ${pct(g.corpus)} | ${pct(g.gen)} |`);
L.push('', '## Shapes, walls and roofs side by side', '');
L.push('| Measure | Corpus | Generated |', '|---|---|---|');
L.push(`| Shape | ${fmtDist(corpus, 'shape')} | ${fmtDist(gen, 'shape')} |`);
L.push(`| Wall type | ${fmtDist(corpus, 'wallType')} | ${fmtDist(gen, 'wallType')} |`);
L.push(`| Roof type | ${fmtDist(corpus, 'roofType')} | ${fmtDist(gen, 'roofType')} |`);
L.push(`| Pitch | ${fmtDist(corpus, 'pitch')} | ${fmtDist(gen, 'pitch')} |`);
L.push(`| Footprint, square meters (median, 75th percentile) | ${med(corpus, 'area')}, ${q75(corpus, 'area')} | ${med(gen, 'area')}, ${q75(gen, 'area')} |`);
L.push(`| Storeys (median, 75th) | ${med(corpus, 'storeys')}, ${q75(corpus, 'storeys')} | ${med(gen, 'storeys')}, ${q75(gen, 'storeys')} |`);
L.push(`| Height, m (median, 75th) | ${med(corpus, 'height')}, ${q75(corpus, 'height')} | ${med(gen, 'height')}, ${q75(gen, 'height')} |`);
L.push(`| Eave past the walls, m (median, 75th) | ${med(corpus, 'overhang')}, ${q75(corpus, 'overhang')} | ${med(gen, 'overhang')}, ${q75(gen, 'overhang')} |`);
L.push('', 'Shares in percent of buildings, the five commonest of each.', '');
L.push('## By palette and culture', '');
L.push('Corpus builds are grouped by the latest biome\'s material they use in quantity; generated buildings by the biome they were asked for.', '');
L.push('| Biome | Corpus builds | Corpus shapes | Generated shapes | Corpus walls | Generated walls | Corpus roofs | Generated roofs |', '|---|---|---|---|---|---|---|---|');
for (const pl of palettes) {
  const c = corpus.filter(m => m.palette === pl), g = gen.filter(m => m.palette === pl);
  if (!c.length && !g.length) continue;
  L.push(`| ${pl} | ${c.length} | ${c.length ? fmtDist(c, 'shape') : '-'} | ${g.length ? fmtDist(g, 'shape') : '-'} | ${c.length ? fmtDist(c, 'wallType') : '-'} | ${g.length ? fmtDist(g, 'wallType') : '-'} | ${c.length ? fmtDist(c, 'roofType') : '-'} | ${g.length ? fmtDist(g, 'roofType') : '-'} |`);
}
L.push('', 'Per generated culture: the shapes and features it makes, and the corpus features of its biome it lacks (corpus share 20 % or more, the culture under half of that).', '');
L.push('| Culture | Buildings | Shapes | Median footprint | Missing features (corpus share of its biome) |', '|---|---|---|---|---|');
for (const cu of cultures) {
  const g = gen.filter(m => m.culture === cu);
  if (!g.length) continue;
  const bi = dist(g, 'palette'), main = topK(bi, 1)[0][0], c = corpus.filter(m => m.palette === main);
  const pool = c.length >= 12 ? c : corpus;
  const miss = Object.keys(FEAT).map(k => ({ k, c: share(pool, m => m.features[k]), g: share(g, m => m.features[k]) })).filter(r => r.c >= 0.2 && r.g < r.c / 2).sort((a, b) => (b.c - b.g) - (a.c - a.g)).slice(0, 5);
  L.push(`| ${cu} | ${g.length} | ${fmtDist(g, 'shape')} | ${med(g, 'area')} | ${miss.map(r => `${r.k} ${pct(r.c)}`).join(', ') || '-'} |`);
}
L.push('', '## Decoration prefabs on the outside', '');
L.push('Each vanilla prefab seen on or outside the walls of 5 % or more of the corpus buildings, by how much more the corpus uses it.', '');
L.push('| Prefab | Role | Corpus | Generated |', '|---|---|---|---|');
for (const r of prefabRows.filter(r => !['wall', 'floor', 'roof', 'roofTop', 'roofCorner', 'gable', 'door'].includes(r.role)).slice(0, 40)) L.push(`| ${r.n} | ${r.role} | ${pct(r.c)} | ${pct(r.g)} |`);
L.push('', '## All measures', '');
L.push('| Kind | What | Corpus | Generated | Gap |', '|---|---|---|---|---|');
for (const g of gaps.slice().sort((a, b) => a.kind.localeCompare(b.kind) || b.gap - a.gap)) L.push(`| ${g.kind} | ${g.name} | ${pct(g.corpus)} | ${pct(g.gen)} | ${Math.round(g.gap * 100)} |`);
const head = fs.existsSync(outMd) ? fs.readFileSync(outMd, 'utf8') : '';
// a hand-written part (what was filled, what is left for the lead) is kept from one run to the next
const keepFrom = head.indexOf('<!-- hand -->');
fs.writeFileSync(outMd, L.join('\n') + '\n' + (keepFrom >= 0 ? '\n' + head.slice(keepFrom) : ''));
console.log('wrote', outMd, outJson);
for (const g of gaps.slice(0, 20)) console.log(`${g.kind.padEnd(8)} ${g.name.padEnd(28)} corpus ${pct(g.corpus).padStart(5)} gen ${pct(g.gen).padStart(5)} gap ${Math.round(g.gap * 100)}`);
