// Tyler's room scores into template weights for the decorator, and a model that scores the rooms he has not seen yet.
//
//   node lab/room_feedback.js [rooms.csv]           the Rooms tab downloaded as CSV (File > Download > CSV, that tab)
//   node lab/room_feedback.js --first 70            no scores yet: seed weights, and pick the first batch to score
//
// Writes data/room-scores.json: a weight per template (what lib/decorate.js reads), every room's score and where it
// came from (tyler, model or seed), the next batch to score, and a summary of what the high-scored rooms do.
// Weights: a score of 1 or 2 drops the template (weight 0), 3 keeps it (1), 4 weights it up (1.5), 5 more (2); the tag
// "copy this" adds a quarter. Rooms Tyler has not scored get the model's guess on the same scale, never below 0.15, so
// the model alone never drops a room. Before any scores the guess is a seed: popularity of the source build and the
// clean-room checks below.
//
// The model is a ridge regression on the room features below (standardized), refit on every run, with 40 bootstrap
// refits to say how sure it is. The next batch is the unscored rooms it is least sure of, spread over the room kinds.
const fs = require('fs'), path = require('path');
const lab = path.join(__dirname, '..');
const D = require(lab + '/lib/decorate.js');
const F = D.FURNITURE;
const L = require(lab + '/data/interior-lite.json');

const args = process.argv.slice(2);
const firstN = args.includes('--first') ? +args[args.indexOf('--first') + 1] : 0;
const csvPath = args.find(a => /\.csv$/i.test(a)) || null;
const outPath = path.join(lab, 'data/room-scores.json');
const T = JSON.parse(fs.readFileSync(path.join(lab, 'data/room-templates.json'), 'utf8')).templates;
const old = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : null;

const TAGS = ['natural flow', 'cozy', 'cluttered', 'sparse', 'odd placement', 'good lighting', 'good storage', 'good seating', 'bed nook', 'copy this'];
const KINDS = ['home', 'hall', 'tavern', 'kitchen', 'living', 'sleeping', 'storage', 'smithy', 'workshop', 'temple', 'other'];

// ---------------------------------------------------------------- the room laid out from its template
const sz = n => (F[n] ? F[n].s : [0.6, 0.6, 0.6]);
function ext(n, yaw) { const [w, , d] = sz(n), a = yaw * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a)); return [c * w / 2 + s * d / 2, s * w / 2 + c * d / 2]; }
function axis(a, e, lo, hi) {
  const k = a[0], g = +a.slice(1);
  if (k === 'L' || k === 'F') return lo + g + e;
  if (k === 'R' || k === 'B') return hi - g - e;
  if (k === 'C') return (lo + hi) / 2 + g;
  return (lo + hi) / 2 + g * (hi - lo);
}
function layout(t) {
  const W = t.W, Dp = t.D, out = [];
  t.p.forEach(q => {
    const n = q[1], f = F[n] || {};
    let it;
    if (q[0] === 'c') {
      const par = out[q[2]];
      if (!par) { out.push(null); return; }
      const a = par.yaw * Math.PI / 180, lx = q[3], lz = q[4];
      it = { n, u: par.u + lx * Math.cos(a) + lz * Math.sin(a), v: par.v - lx * Math.sin(a) + lz * Math.cos(a), yaw: (par.yaw + q[5]) % 360, kind: 'c', par };
    } else if (q[0] === 'm') {
      const side = q[2][0] === 'L' || q[2][0] === 'R' ? q[2][0] : q[3][0];
      const u = side === 'L' ? -W / 2 : side === 'R' ? W / 2 : axis(q[2], 0, -W / 2, W / 2);
      const v = side === 'F' ? 0 : side === 'B' ? Dp : axis(q[3], 0, 0, Dp);
      it = { n, u, v, yaw: 0, kind: 'm', side };
    } else {
      const [eu, ev] = ext(n, q[4]);
      it = { n, u: axis(q[2], eu, -W / 2, W / 2), v: axis(q[3], ev, 0, Dp), yaw: q[4], kind: q[0] };
    }
    it.f = f; it.cat = f.cat || 'deco'; it.at = f.at || 'floor';
    [it.eu, it.ev] = ext(n, it.yaw || 0);
    out.push(it);
  });
  return out.filter(Boolean);
}

// ---------------------------------------------------------------- features
const FEATS = [
  ['dens', 'pieces per 10 m2'], ['doorClear', 'clear depth inside the way in (m)'], ['wallShare', 'share of floor pieces against a wall'],
  ['clusterRate', 'groups of furniture per 10 m2'], ['clusterSize', 'pieces per group'], ['symmetry', 'share of pieces with a mirror partner'],
  ['lightRate', 'lights per 10 m2'], ['lightGap', 'mean distance to the nearest light (m)'], ['rugRate', 'rugs per 10 m2'],
  ['rugUnder', 'share of tables and fires with a rug under them'], ['pathWidth', 'width of the clear way from the door to the middle (m)'],
  ['freeShare', 'share of the floor left free'], ['kinds', 'kinds of piece'], ['wallDecor', 'wall pieces per meter of wall'],
];
function boxOverlap(a, b, m) { return Math.abs(a.u - b.u) < a.eu + b.eu + m && Math.abs(a.v - b.v) < a.ev + b.ev + m; }
function features(t) {
  const its = layout(t), W = t.W, Dp = t.D, area = t.area;
  const floor = its.filter(i => (i.kind === 'f' || i.kind === 'c') && !['rug', 'top', 'fire', 'mount', 'hang'].includes(i.at));
  const rugs = its.filter(i => i.at === 'rug');
  const lights = its.filter(i => i.cat === 'light');
  const f = { dens: t.dens };
  // the way in: the nearest floor piece in front of the door
  let dc = Math.min(Dp, 6);
  for (const i of floor) if (Math.abs(i.u - t.doorU) < i.eu + 0.6) dc = Math.min(dc, Math.max(0, i.v - i.ev));
  f.doorClear = dc;
  f.wallShare = floor.length ? floor.filter(i => Math.min(i.u - i.eu + W / 2, W / 2 - i.u - i.eu, i.v - i.ev, Dp - i.v - i.ev) < 0.35).length / floor.length : 0;
  // groups: pieces within 0.7 m of each other
  const par = floor.map((_, k) => k), root = k => (par[k] === k ? k : (par[k] = root(par[k])));
  for (let a = 0; a < floor.length; a++) for (let b = a + 1; b < floor.length; b++) if (boxOverlap(floor[a], floor[b], 0.7)) par[root(a)] = root(b);
  const groups = new Set(floor.map((_, k) => root(k))).size;
  f.clusterRate = groups / area * 10;
  f.clusterSize = groups ? floor.length / groups : 0;
  // mirror partners across the middle line either way
  const mirror = (fu, fv) => floor.filter(i => floor.some(o => o !== i && o.cat === i.cat && Math.hypot(fu(i.u) - o.u, fv(i.v) - o.v) < 0.6)).length;
  f.symmetry = floor.length ? Math.max(mirror(u => -u, v => v), mirror(u => u, v => Dp - v)) / floor.length : 0;
  f.lightRate = lights.length / area * 10;
  let gap = 0, gn = 0;
  for (let u = -W / 2 + 0.5; u < W / 2; u += 1) for (let v = 0.5; v < Dp; v += 1) {
    gap += lights.length ? Math.min(...lights.map(l => Math.hypot(l.u - u, l.v - v))) : Math.max(W, Dp); gn++;
  }
  f.lightGap = gn ? gap / gn : 0;
  f.rugRate = rugs.length / area * 10;
  const hosts = floor.filter(i => i.cat === 'table' || i.cat === 'fire');
  f.rugUnder = hosts.length ? hosts.filter(h => rugs.some(r => boxOverlap(h, r, -0.1))).length / hosts.length : 0;
  f.pathWidth = pathWidth(t, floor);
  const used = floor.reduce((s, i) => s + 4 * i.eu * i.ev, 0);
  f.freeShare = Math.max(0, 1 - used / Math.max(1, area));
  f.kinds = new Set(its.map(i => i.n)).size;
  f.wallDecor = its.filter(i => i.kind === 'm').length / (2 * (W + Dp));
  return f;
}
// the widest clear way from the door to the most open place in the room: grid of 0.25 m, clearance of every free cell,
// then the path whose narrowest point is widest (cells added widest first until the door joins the target)
function pathWidth(t, floor) {
  const G = 0.25, nu = Math.max(1, Math.round(t.W / G)), nv = Math.max(1, Math.round(t.D / G));
  const occ = new Uint8Array(nu * nv);
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const u = -t.W / 2 + (i + 0.5) * G, v = (j + 0.5) * G;
    if (floor.some(p => Math.abs(p.u - u) < p.eu && Math.abs(p.v - v) < p.ev)) occ[i * nv + j] = 1;
  }
  // clearance: distance to the nearest occupied cell or wall
  const cl = new Float32Array(nu * nv);
  const occList = [];
  for (let k = 0; k < occ.length; k++) if (occ[k]) occList.push(k);
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const k = i * nv + j;
    if (occ[k]) { cl[k] = 0; continue; }
    // the door wall does not count: the way starts at it
    let d = Math.min(i + 0.5, nu - i - 0.5, nv - j - 0.5) * G;
    for (const o of occList) { const oi = Math.floor(o / nv), oj = o % nv, dd = Math.max(0, Math.hypot(oi - i, oj - j) - 0.5) * G; if (dd < d) d = dd; }
    cl[k] = d;
  }
  const di = Math.max(0, Math.min(nu - 1, Math.floor((t.doorU + t.W / 2) / G)));
  let door = di * nv;
  let target = 0;
  for (let k = 1; k < cl.length; k++) if (cl[k] > cl[target]) target = k;
  if (occ[door]) return 0;
  const order = [...cl.keys()].filter(k => !occ[k]).sort((a, b) => cl[b] - cl[a]);
  const par = new Int32Array(cl.length).map((_, k) => k), on = new Uint8Array(cl.length);
  const root = k => { while (par[k] !== k) { par[k] = par[par[k]]; k = par[k]; } return k; };
  for (const k of order) {
    on[k] = 1;
    const i = Math.floor(k / nv), j = k % nv;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const i2 = i + a, j2 = j + b;
      if (i2 < 0 || j2 < 0 || i2 >= nu || j2 >= nv) continue;
      const k2 = i2 * nv + j2;
      if (on[k2]) par[root(k)] = root(k2);
    }
    if (on[door] && on[target] && root(door) === root(target)) return Math.min(4, 2 * cl[k]);
  }
  return 0;
}

// ---------------------------------------------------------------- seed scores (before Tyler has scored anything)
// 3, plus up to half a point for popularity, and a few tenths for each clean-room check: a clear way in at least as deep
// as nine builders in ten leave for that kind of room, a density within the middle half of the corpus, a clear way
// through at least 0.9 m wide, lights somewhere in the room.
const LK = { home: 'home', hall: 'hall', tavern: 'tavern', kitchen: 'kitchen', living: 'living', sleeping: 'sleeping', storage: 'storage', smithy: 'smithy', workshop: 'workshop', temple: 'hall', other: 'living' };
function seed(t, f) {
  const r = L.rooms[LK[t.kind]] || {}, door = ((L.doors || {}).byRoom || {})[LK[t.kind]] || [2.5];
  const iq = r.perTenM2 || [1, 2, 3];
  let s = 3 + (t.pop - 0.75);
  s += f.doorClear >= Math.min(door[0], 0.5 * t.D) ? 0.3 : -0.3;
  s += f.dens >= iq[0] && f.dens <= iq[2] * 1.15 ? 0.3 : -0.2;
  s += f.pathWidth >= 0.9 ? 0.2 : -0.3;
  s += f.lightRate > 0 ? 0.1 : -0.1;
  return Math.max(2, Math.min(4.5, s));
}

// ---------------------------------------------------------------- the sheet's CSV
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
function readScores(file) {
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  const head = rows[0].map(h => h.trim().toLowerCase());
  const col = re => head.findIndex(h => re.test(h));
  const ci = col(/^id$/), cs = col(/^score/), ct = col(/^tags/), cn = col(/^notes/);
  const out = {};
  for (const r of rows.slice(1)) {
    const id = (r[ci] || '').trim();
    if (!/^RT-\d+$/.test(id)) continue;
    const sc = parseFloat(r[cs]);
    const tags = (r[ct] || '').toLowerCase().split(/[,;]/).map(x => x.trim()).filter(Boolean);
    const notes = (r[cn] || '').trim();
    if (!(sc >= 1 && sc <= 5) && !tags.length && !notes) continue;
    out[id] = { score: sc >= 1 && sc <= 5 ? Math.round(sc) : null, tags, notes };
  }
  return out;
}

// ---------------------------------------------------------------- ridge regression
function ridge(X, y, lambda) {
  const n = X.length, p = X[0].length;
  const ym = y.reduce((a, b) => a + b, 0) / n;
  const A = Array.from({ length: p }, () => new Array(p).fill(0)), b = new Array(p).fill(0);
  for (let r = 0; r < n; r++) for (let i = 0; i < p; i++) { b[i] += X[r][i] * (y[r] - ym); for (let j = 0; j < p; j++) A[i][j] += X[r][i] * X[r][j]; }
  for (let i = 0; i < p; i++) A[i][i] += lambda;
  // Gaussian elimination
  for (let i = 0; i < p; i++) {
    let m = i;
    for (let k = i + 1; k < p; k++) if (Math.abs(A[k][i]) > Math.abs(A[m][i])) m = k;
    [A[i], A[m]] = [A[m], A[i]]; [b[i], b[m]] = [b[m], b[i]];
    for (let k = i + 1; k < p; k++) { const f = A[k][i] / A[i][i]; for (let j = i; j < p; j++) A[k][j] -= f * A[i][j]; b[k] -= f * b[i]; }
  }
  const w = new Array(p).fill(0);
  for (let i = p - 1; i >= 0; i--) { let s = b[i]; for (let j = i + 1; j < p; j++) s -= A[i][j] * w[j]; w[i] = s / A[i][i]; }
  return { w, b0: ym };
}
const predict = (m, x) => m.b0 + m.w.reduce((s, wi, i) => s + wi * x[i], 0);
function rng(seedN) { let s = seedN; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

// ---------------------------------------------------------------- run
const feats = new Map(T.map(t => [t.id, features(t)]));
const keys = FEATS.map(f => f[0]);
const mean = {}, sd = {};
for (const k of keys) {
  const v = T.map(t => feats.get(t.id)[k]);
  mean[k] = v.reduce((a, b) => a + b, 0) / v.length;
  sd[k] = Math.sqrt(v.reduce((a, b) => a + (b - mean[k]) ** 2, 0) / v.length) || 1;
}
const xOf = id => keys.map(k => (feats.get(id)[k] - mean[k]) / sd[k]);
const tyler = csvPath ? readScores(csvPath) : (old && old.tyler) || {};
const scored = T.filter(t => tyler[t.id] && tyler[t.id].score);
const rooms = {};
let model = null;
if (scored.length >= 8) {
  const X = scored.map(t => xOf(t.id)), y = scored.map(t => tyler[t.id].score);
  model = ridge(X, y, 4);
  const R = rng(7), boots = [];
  for (let b = 0; b < 40; b++) {
    const idx = scored.map(() => Math.floor(R() * scored.length));
    boots.push(ridge(idx.map(i => X[i]), idx.map(i => y[i]), 4));
  }
  for (const t of T) {
    const x = xOf(t.id), ps = boots.map(m => predict(m, x));
    const mu = ps.reduce((a, b) => a + b, 0) / ps.length;
    rooms[t.id] = { pred: +Math.max(1, Math.min(5, predict(model, x))).toFixed(2), sd: +Math.sqrt(ps.reduce((a, b) => a + (b - mu) ** 2, 0) / ps.length).toFixed(2) };
  }
}
const weightOf = sc => (sc <= 2 ? 0 : sc >= 5 ? 2 : sc >= 4 ? 1.5 : 1);
const smooth = sc => Math.max(0.15, Math.min(2, 0.5 * (sc - 1)));
const weights = {};
for (const t of T) {
  const f = feats.get(t.id), ty = tyler[t.id];
  const r = rooms[t.id] = rooms[t.id] || {};
  r.seed = +seed(t, f).toFixed(2);
  if (ty && ty.score) { r.score = ty.score; r.from = 'tyler'; weights[t.id] = weightOf(ty.score) * (ty.tags.includes('copy this') && ty.score > 2 ? 1.25 : 1); }
  else if (model) { r.from = 'model'; weights[t.id] = +smooth(r.pred).toFixed(2); }
  else { r.from = 'seed'; weights[t.id] = +smooth(r.seed).toFixed(2); }
  if (ty && ty.tags.length) r.tags = ty.tags;
}

// the next batch: unscored rooms, least sure first (before a model, the best-liked), spread over kinds and sizes
const sizeBin = t => (t.area < 12 ? 'small' : t.area < 30 ? 'medium' : 'large');
function pickBatch(n) {
  // rooms the decorator can use: a kind it furnishes, at least four pieces of three kinds
  const pool = T.filter(t => !(tyler[t.id] && tyler[t.id].score) && !(old && old.shown && old.shown.includes(t.id) && !firstN)
    && t.kind !== 'other' && t.p.length >= 4 && new Set(t.p.map(q => q[1])).size >= 3);
  const rank = t => (model ? -rooms[t.id].sd : 0) - t.pop - 0.2 * rooms[t.id].seed;
  const byKind = {};
  for (const t of pool.sort((a, b) => rank(a) - rank(b))) (byKind[t.kind] = byKind[t.kind] || []).push(t);
  // every kind gets a share of the batch; the commoner kinds a little more; a source build at most twice per batch
  const want = {};
  const order = KINDS.filter(k => byKind[k]);
  for (const k of order) want[k] = Math.min(byKind[k].length, Math.max(3, Math.round(n * Math.sqrt(byKind[k].length) / order.reduce((s, k2) => s + Math.sqrt(byKind[k2].length), 0))));
  const out = [], perSrc = {};
  for (const k of order) {
    const bins = { small: [], medium: [], large: [] };
    for (const t of byKind[k]) bins[sizeBin(t)].push(t);
    let got = 0;
    while (got < want[k] && (bins.small.length || bins.medium.length || bins.large.length)) {
      for (const b of ['large', 'medium', 'small']) {
        if (got >= want[k]) break;
        while (bins[b].length) {
          const t = bins[b].shift();
          if ((perSrc[t.src] || 0) >= 2) continue;
          perSrc[t.src] = (perSrc[t.src] || 0) + 1;
          out.push(t.id); got++;
          break;
        }
      }
    }
  }
  return out;
}
const batchN = firstN || 40;
const next = pickBatch(batchN);

// what the rooms scored 4 and 5 do that the rooms scored 1 and 2 do not, in standard deviations, and the tags
function summary() {
  const hi = scored.filter(t => tyler[t.id].score >= 4), lo = scored.filter(t => tyler[t.id].score <= 2);
  if (hi.length < 3) return null;
  const avg = (list, k) => list.reduce((s, t) => s + feats.get(t.id)[k], 0) / list.length;
  const base = lo.length >= 3 ? lo : T;
  const diffs = FEATS.map(([k, label]) => ({ k, label, hi: +avg(hi, k).toFixed(2), other: +avg(base, k).toFixed(2), z: +((avg(hi, k) - avg(base, k)) / sd[k]).toFixed(2) }))
    .sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
  const tagCount = list => { const c = {}; for (const t of list) for (const g of tyler[t.id].tags) c[g] = (c[g] || 0) + 1; return c; };
  const kinds = {};
  for (const t of scored) { const k = kinds[t.kind] = kinds[t.kind] || { n: 0, sum: 0 }; k.n++; k.sum += tyler[t.id].score; }
  return { high: hi.length, low: lo.length, against: lo.length >= 3 ? 'rooms scored 1 or 2' : 'all rooms', features: diffs.filter(d => Math.abs(d.z) >= 0.3),
    tagsHigh: tagCount(hi), tagsLow: tagCount(lo), meanByKind: Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, +(v.sum / v.n).toFixed(2)])),
    modelWeights: model ? Object.fromEntries(keys.map((k, i) => [k, +model.w[i].toFixed(3)])) : null };
}
const sum = summary();
const shown = [...new Set([...(old && old.shown || []), ...(firstN ? next : [])])];
const result = {
  meta: { made: new Date().toISOString().slice(0, 10), templates: T.length, scored: scored.length, model: model ? `ridge on ${keys.length} features, ${scored.length} scores` : 'none yet: weights are seeds (popularity and clean-room checks)',
    weights: '1-2 dropped (0), 3 kept (1), 4 up (1.5), 5 (2); unscored rooms 0.5 x (guess - 1), between 0.15 and 2', tags: TAGS, features: Object.fromEntries(FEATS) },
  weights, tyler, rooms, features: Object.fromEntries(T.map(t => [t.id, Object.fromEntries(Object.entries(feats.get(t.id)).map(([k, v]) => [k, +v.toFixed(2)]))])),
  shown, next, summary: sum,
};
fs.writeFileSync(outPath, JSON.stringify(result, null, 0).replace(/,"(weights|tyler|rooms|features|shown|next|summary)":/g, ',\n"$1":') + '\n');
console.log(`${T.length} templates, ${scored.length} scored by Tyler; ${model ? 'model fitted' : 'seed weights'}; next batch ${next.length}`);
const byK = {};
for (const id of next) { const t = T.find(x => x.id === id); byK[t.kind] = (byK[t.kind] || 0) + 1; }
console.log('next batch by kind', JSON.stringify(byK));
if (sum) {
  console.log(`\nWhat rooms scored 4 or 5 do (${sum.high} rooms, against ${sum.against}):`);
  for (const d of sum.features) console.log(`- ${d.label}: ${d.hi} against ${d.other} (${d.z > 0 ? 'more' : 'less'}, ${Math.abs(d.z)} sd)`);
  console.log('Tags on high rooms:', JSON.stringify(sum.tagsHigh), ' on low rooms:', JSON.stringify(sum.tagsLow));
}
