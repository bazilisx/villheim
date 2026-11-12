// Facade consistency in the corpus (docs/ARCHITECTURE_STUDY.md, track H of the showcase review, D-167).
//   node lab/arch_facades.js <compact.jsonl> <rooms extract dir> <out json> [--examples <private json>] [--limit N]
// The rooms extract dir is lab/rooms_corpus_extract.js output (rooms.jsonl, builds.jsonl, in build order). Its room
// faces give the windows (wall runs read as window, 0.6 m or wider) with the wall line, the room side and the sill. The
// compact pieces, turned by the build's rot, give what stands round each window on the outside.
//
// Per window, the treatment: which feature classes stand round it on the outside (shutter, sill board, head board,
// side posts, arch, brace, planter, hood, light, hung decor) and what fills the light (open, glass, bars, mesh, a closed
// shutter). Windows are grouped as a builder draws a facade:
//   run     windows on one wall line (same side, same line), one floor level
//   side    all runs of one side (the four compass sides of the turned build) on one level
//   stack   one wall line over all levels
// Measures: how often a run's windows all share a feature (all or none) against a shuffle of the build's own windows
// (the same features, dealt at random), lone features (one window of a run), how sides and storeys differ, which piece
// a feature uses across the build, where the odd window of a run sits (room behind, by a door, run end, top level),
// window columns across storeys, and the same all-or-none reading for wall bands and outside corner posts.
// The output holds counts and shares only. --examples writes file names of example builds (builders' work: keep it in
// the private repo).
const fs = require('fs'), path = require('path'), readline = require('readline');
const L = require('./rooms_corpus_lib.js');
const { P, qs, share, top, inc } = L;

const args = process.argv.slice(2);
const [compact, exDir, outFile] = args;
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const exOut = opt('--examples'), LIMIT = +(opt('--limit') || 1e9), LABEL = opt('--label') || 'corpus';
if (!compact || !exDir || !outFile) { console.error('usage: node lab/arch_facades.js <compact.jsonl> <extract dir> <out json>'); process.exit(1); }
const r3 = v => Math.round(v * 1000) / 1000;
const G = 0.5;

const plantClass = n => {
  if (/^(vines|VineAsh|VineGreen|vineash)/.test(n)) return 'vine';
  if (/^(sapling_|Pickable_(Barley|Flax|Carrot|Turnip|Onion|SeedOnion|SeedCarrot|SeedTurnip|Potato|Dandelion|Thistle|Mushroom.*|Fiddlehead|SmokePuff|JotunPuffs|Magecap|Vineberry)|Mushroom|GlowingMushroom|Fiddleheadfern)/.test(n)) return 'plant';
  if (/(Bush|bush|shrub|Shrub|Fern|fern|Heath|heath)/.test(n) && !/^Rock/.test(n)) return 'plant';
  return null;
};
const slopeBeam = n => /(_45|_26)$|beam_45|beam_26|_45_|_26_/.test(n);
const FEATS = ['shutter', 'sill', 'head', 'posts', 'arch', 'brace', 'planter', 'vine', 'hood', 'light', 'hung'];
const FILLS = ['open', 'glass', 'bars', 'mesh', 'closed'];

// what stands round one window on the outside
function treat(w, idx) {
  const along = p => (p.x - w.x0) * w.ux + (p.z - w.z0) * w.uz;
  const out = p => -((p.x - w.x0) * w.nx + (p.z - w.z0) * w.nz) - w.ht; // out from the outer face of the wall
  const sillY = w.stand + w.sill, mid = (w.a0 + w.a1) / 2, half = (w.a1 - w.a0) / 2;
  const near = idx.near(mid * w.ux + w.x0, mid * w.uz + w.z0, half + 2);
  // the head: the lowest wall-like piece over the light in the wall plane
  let head = null;
  for (const p of near) {
    if (!/^(wall|beam|window|roof|gable)$/.test(p.role) || p.plant) continue;
    const t = along(p), o = out(p);
    if (Math.abs(t - mid) > Math.max(0.3, half - 0.2) || o < -0.7 || o > 0.35) continue;
    const y0 = p.y - p.h / 2;
    if (y0 > sillY + 0.35 && (head == null || y0 < head)) head = y0;
  }
  const wh = head == null ? 1 : Math.min(3, head - sillY);
  const f = new Map(), fill = new Set();
  const add = (k, n) => { if (!f.has(k)) f.set(k, new Set()); f.get(k).add(n); };
  for (const p of near) {
    const t = along(p), o = out(p), h = p.y - sillY;
    if (t < w.a0 - 1.6 || t > w.a1 + 1.6) continue;
    const inSpan = t > w.a0 - 0.05 && t < w.a1 + 0.05;
    if (p.n === 'wood_window') {
      if (o < -0.6 || o > 0.6 || h < -0.4 || h > wh + 0.4) continue;
      if (inSpan && Math.abs(t - mid) < half - 0.1 && o < 0.25) fill.add('closed'); else if (t < w.a0 + 0.3 || t > w.a1 - 0.3) add('shutter', p.n);
      continue;
    }
    if (inSpan && Math.abs(o) < 0.6 && h > -0.1 && h < wh + 0.1) {
      if (/crystal|glass/.test(p.n)) { fill.add('glass'); continue; }
      if (/^iron_wall|iron_grate|metalbar/.test(p.n)) { fill.add('bars'); continue; }
      if (/dvergr_metal_wall/.test(p.n)) { fill.add('mesh'); continue; }
    }
    if (p.plant) {
      if (t > w.a0 - 0.6 && t < w.a1 + 0.6 && o > 0.05 && o < 1.4 && h > -0.8 && h < 0.9) add(p.plant === 'vine' ? 'vine' : 'planter', p.n);
      else if (p.plant === 'vine' && t > w.a0 - 1 && t < w.a1 + 1 && o > -0.1 && o < 0.8 && h > -1 && h < wh + 1.5) add('vine', p.n);
      continue;
    }
    if (/arch/.test(p.n) && p.st && t > w.a0 - 0.6 && t < w.a1 + 0.6 && o > -0.7 && o < 0.8 && h > wh - 1.3 && h < wh + 1) { add('arch', p.n); continue; }
    if (p.role === 'beam' && slopeBeam(p.n)) { if (t > w.a0 - 1.1 && t < w.a1 + 1.1 && o > -0.35 && o < 0.6 && h > -1.3 && h < wh + 1.1) add('brace', p.n); continue; }
    if ((p.role === 'beam' || (p.role === 'floor' && /1x1/.test(p.n))) && p.along) {
      const c = t > w.a0 - 0.3 && t < w.a1 + 0.3;
      if (c && o > -0.05 && o < 1.0 && h > -0.45 && h < 0.25) { add('sill', p.n); continue; }
      if (c && p.role === 'beam' && o > -0.05 && o < 1.0 && h > wh - 0.35 && h < wh + 0.45) { add('head', p.n); continue; }
    }
    if (p.role === 'floor' && /1x1/.test(p.n) && t > w.a0 - 0.3 && t < w.a1 + 0.3 && o > 0.1 && o < 1.1 && h > -1.1 && h < 0.25) { add('sill', p.n); continue; }
    if (p.role === 'pole' && (Math.abs(t - w.a0) < 0.45 || Math.abs(t - w.a1) < 0.45) && o > -0.35 && o < 0.7 && p.y + p.h / 2 > sillY + 0.2 && p.y - p.h / 2 < sillY + wh - 0.2) { add('posts', p.n); continue; }
    if (/^(roof|roofTop)$/.test(p.role) && t > w.a0 - 0.5 && t < w.a1 + 0.5 && o > 0 && o < 1.8 && h > wh - 0.3 && h < wh + 1.6) { add('hood', p.n); continue; }
    if (p.role === 'light' && o > -0.05 && o < 0.9 && h > -0.6 && h < wh + 1) { add('light', p.n); continue; }
    if (/^(itemstand|itemstandh|sign|piece_banner\d+)$/.test(p.n) && o > -0.05 && o < 0.7 && t > w.a0 - 0.8 && t < w.a1 + 0.8 && h > -0.8 && h < wh + 1.2) { add('hung', p.n); continue; }
  }
  if (!fill.size) fill.add('open');
  const lead = fill.has('glass') ? 'glass' : fill.has('bars') ? 'bars' : fill.has('mesh') ? 'mesh' : fill.has('closed') ? 'closed' : 'open';
  return { f, fill: lead, wh };
}

// a 1 m grid of the build's pieces
function indexOf(ps) {
  const m = new Map(), k = (i, j) => i * 100003 + j;
  for (const p of ps) { const key = k(Math.floor(p.x), Math.floor(p.z)); if (!m.has(key)) m.set(key, []); m.get(key).push(p); }
  return {
    near(x, z, r) {
      const out = [];
      for (let i = Math.floor(x - r); i <= Math.floor(x + r); i++) for (let j = Math.floor(z - r); j <= Math.floor(z + r); j++) { const l = m.get(k(i, j)); if (l) out.push(...l); }
      return out;
    },
  };
}

const roomKind = r => {
  const ts = new Map();
  for (const p of r.p) { const t = L.typeOf(p[0]); if (t) ts.set(t, (ts.get(t) || 0) + 1); }
  if (ts.get('kitchen')) return 'kitchen';
  if (ts.get('forge') || ts.get('station')) return 'workshop';
  if (ts.get('bed')) return 'bedroom';
  if ((ts.get('table') || 0) && (ts.get('seat') || 0) >= 3 || ts.get('throne')) return 'hall';
  if ((ts.get('chest') || 0) + (ts.get('barrel') || 0) + (ts.get('crate') || 0) >= 3) return 'storage';
  if (ts.get('fire') || ts.get('table')) return 'living';
  if (r.area < 8) return 'small';
  return 'plain';
};
const sig = w => [...FEATS.filter(k => w.f.has(k)), 'fill:' + w.fill].join('+');
// the architectural treatment only: what is built round the window (lights and hung decor left out)
const ARCH = ['shutter', 'sill', 'head', 'posts', 'arch', 'brace', 'planter', 'vine', 'hood'];
const asig = w => [...ARCH.filter(k => w.f.has(k)), 'fill:' + w.fill].join('+');

// ---------------------------------------------------------------- accumulators
const A = {
  builds: 0, buildsWithRuns: 0, windows: 0, runs: { n: 0, uniform: 0, auniform: 0, byLen: {} }, shuffle: { n: 0, uniform: 0, auniform: 0 },
  pieceRuns: {},
  feat: Object.fromEntries([...FEATS, ...FILLS.map(f => 'fill:' + f)].map(k => [k, { windows: 0, runsWith: 0, full: 0, lone: 0, partial: 0, shufFull: 0, shufRuns: 0, buildsWith: 0, buildsOnePiece: 0 }])),
  sides: { storeys: 0, allSame: 0, frontDiffers: 0, frontRicher: 0, frontPoorer: 0, featFront: {}, featOther: {} },
  stacks: { lines: 0, upper: 0, aligned: 0, sameSig: 0, pairs: 0 },
  odd: { runs3: 0, oddWindows: 0, windows3: 0, behind: {}, behindAll: {}, where: {}, whereAll: {}, how: {} },
  lone: { n: 0, behind: {}, where: {}, feat: {} },
  bands: { builds: 0, all: 0, none: 0, mixed: 0, faces: 0, banded: 0 },
  corners: { builds: 0, all: 0, none: 0, mixed: 0, n: 0, dressed: 0, onePiece: 0, withPosts: 0 },
  perBuild: [],
};
const EX = { lone: [], uniform: [], odd: [] };

function rate(arr) { return arr.length ? arr.filter(Boolean).length / arr.length : 0; }

function measure(b, rooms, rot, bi, cul, kindB) {
  const a = rot, ca = Math.cos(a * Math.PI / 180), sa = Math.sin(a * Math.PI / 180);
  const ps = b.p.map(([n, x, y, z, yaw]) => {
    const i = P.piece(n), yw = ((yaw - a) % 360 + 360) % 360;
    return { n, x: x * ca - z * sa, y, z: x * sa + z * ca, yaw: yw, role: i.role, st: i.structural, h: i.size[1] || 0.2, plant: plantClass(n), along: Math.abs((yw % 90)) < 5 || Math.abs((yw % 90) - 90) < 5 };
  });
  const idx = indexOf(ps);
  const rs = rooms.filter(r => r.cov >= 0.5 && r.area >= 3);
  // cells per level, to tell outer walls from walls between rooms
  const cellsAt = new Map();
  for (const r of rs) { const k = Math.round(r.lvl * 2); if (!cellsAt.has(k)) cellsAt.set(k, new Set()); const s = cellsAt.get(k); for (const [i, j] of r.cells) s.add(i * 100003 + j); }
  const roomAt = (x, z, lvl) => { for (const d of [-1, 0, 1]) { const s = cellsAt.get(Math.round(lvl * 2) + d); if (s && s.has(Math.floor(x / G) * 100003 + Math.floor(z / G))) return true; } return false; };
  const levels = [...new Set(rs.map(r => r.lvl))].sort((x, y) => x - y);
  const topLvl = levels[levels.length - 1];
  // exterior doors, for the front side and for windows by a door
  const doors = [];
  for (const r of rs) for (const d of r.doors) { if (d[5]) continue; const ox = d[0] - d[2] * 1.2, oz = d[1] - d[3] * 1.2, ix = d[0] + d[2] * 1.2, iz = d[1] + d[3] * 1.2; if (roomAt(ox, oz, r.lvl) && roomAt(ix, iz, r.lvl)) continue; doors.push({ x: d[0], z: d[1], nx: d[2], nz: d[3], lvl: r.lvl }); }
  const W = [], faces = [];
  for (const r of rs) {
    const kind = roomKind(r);
    for (const fc of r.faces) {
      if (fc[9]) continue;
      const [x0, z0, ux, uz, nx, nz, fa0, fa1, ht] = fc;
      const fm = (fa0 + fa1) / 2, px = x0 + fm * ux - nx * (ht + 0.9), pz = z0 + fm * uz - nz * (ht + 0.9);
      // an outer face: no room 0.9 m out from it at this level (checked at its middle and both quarter points)
      const outer = [0.25, 0.5, 0.75].every(q => { const t = fa0 + (fa1 - fa0) * q; return !roomAt(x0 + t * ux - nx * (ht + 0.9), z0 + t * uz - nz * (ht + 0.9), r.lvl); });
      if (!outer) continue;
      const side = `${Math.round(-nx)},${Math.round(-nz)}`, line = Math.round((Math.abs(nx) > 0.5 ? x0 : z0) * 2) / 2;
      faces.push({ r, x0, z0, ux, uz, nx, nz, a0: fa0, a1: fa1, ht, side, line, lvl: r.lvl, runs: fc[10] });
      // the room reader counts a light filled with iron bars as wall: read those lights here (bars in the wall plane,
      // their foot 0.4 to 1.6 m over the floor), as one window per 0.6 m or more of joined bars
      const bars = [];
      for (const p of idx.near(x0 + (fa0 + fa1) / 2 * ux, z0 + (fa0 + fa1) / 2 * uz, (fa1 - fa0) / 2 + 1)) {
        if (!/^(iron_wall_1x1|iron_wall_2x2|iron_grate)$/.test(p.n)) continue;
        const t = (p.x - x0) * ux + (p.z - z0) * uz, o = (p.x - x0) * nx + (p.z - z0) * nz, foot = p.y - p.h / 2 - r.lvl;
        if (t < fa0 || t > fa1 || Math.abs(o) > 0.6 || foot < 0.4 || foot > 1.6) continue;
        const wd = /2x2/.test(p.n) ? 2 : 1;
        bars.push([t - wd / 2, t + wd / 2, foot]);
      }
      bars.sort((x, y) => x[0] - y[0]);
      const extra = [];
      for (const bb of bars) { const l = extra[extra.length - 1]; if (l && bb[0] <= l[2] + 0.05 && Math.abs(bb[2] - l[3]) < 0.3) l[2] = Math.max(l[2], bb[1]); else extra.push(['window', bb[0], bb[1], bb[2]]); }
      for (const run of [...fc[10], ...extra.filter(e => !fc[10].some(q => q[0] === 'window' && q[1] < e[2] && q[2] > e[1]))]) {
        if (run[0] !== 'window' || run[2] - run[1] < 0.6) continue;
        const w = { x0, z0, ux, uz, nx, nz, ht, a0: run[1], a1: run[2], sill: run[3], stand: r.lvl, side, line, lvl: r.lvl, kind, area: r.area };
        Object.assign(w, treat(w, idx));
        const mx = x0 + (w.a0 + w.a1) / 2 * ux, mz = z0 + (w.a0 + w.a1) / 2 * uz;
        w.mx = mx; w.mz = mz;
        w.byDoor = doors.some(d => Math.abs(d.lvl - r.lvl) < 0.6 && Math.hypot(d.x - mx, d.z - mz) < 3.2);
        w.top = levels.length > 1 && r.lvl === topLvl;
        w.sig = sig(w); w.asig = asig(w);
        W.push(w);
      }
    }
  }
  // the same window read from two rooms (an open plan read twice): keep one
  const seen = new Set(), WS = [];
  for (const w of W) { const k = `${Math.round(w.mx * 4)},${Math.round(w.mz * 4)},${Math.round(w.lvl * 2)}`; if (seen.has(k)) continue; seen.add(k); WS.push(w); }
  if (!WS.length) return;
  A.windows += WS.length;
  // runs
  const runs = new Map();
  for (const w of WS) { const k = `${w.side}|${w.line}|${Math.round(w.lvl * 2)}`; if (!runs.has(k)) runs.set(k, []); runs.get(k).push(w); }
  const R = [...runs.values()].filter(l => l.length >= 2);
  // the shuffle: the build's own windows dealt to the same runs at random (a fixed stream per build)
  let s = (bi * 2654435761) >>> 0;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const pool = WS.map(w => w);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  let pi = 0;
  const shuffled = [...runs.values()].map(l => l.map(() => pool[pi++])).filter(l => l.length >= 2);
  const has = (w, k) => k.startsWith('fill:') ? w.fill === k.slice(5) : w.f.has(k);
  const keys = Object.keys(A.feat);
  if (R.length) A.buildsWithRuns++;
  for (const l of R) {
    A.runs.n++;
    const u = l.every(w => w.sig === l[0].sig);
    if (u) A.runs.uniform++;
    if (l.every(w => w.asig === l[0].asig)) A.runs.auniform++;
    // in a run where every window has a feature, is it one piece on all of them
    for (const k of ARCH) {
      if (!l.every(w => w.f.has(k))) continue;
      const pr = A.pieceRuns[k] = A.pieceRuns[k] || { n: 0, one: 0 };
      pr.n++;
      if ([...l[0].f.get(k)].some(n => l.every(w => w.f.get(k).has(n)))) pr.one++;
    }
    const bl = l.length >= 5 ? '5+' : String(l.length);
    const bucket = A.runs.byLen[bl] = A.runs.byLen[bl] || { n: 0, uniform: 0 };
    bucket.n++; if (u) bucket.uniform++;
    for (const k of keys) {
      const c = l.filter(w => has(w, k)).length;
      if (!c) continue;
      const F = A.feat[k];
      F.runsWith++;
      if (c === l.length) F.full++; else if (c === 1) F.lone++; else F.partial++;
      if (c === 1 && l.length >= 3 && !k.startsWith('fill:')) {
        const w = l.find(x => has(x, k));
        A.lone.n++; inc(A.lone.feat, k); inc(A.lone.behind, w.kind);
        inc(A.lone.where, w.byDoor ? 'by a door' : w.top ? 'top level' : 'other');
        if (EX.lone.length < 60) EX.lone.push({ file: b.file, feat: k, behind: w.kind, byDoor: w.byDoor, lvl: w.lvl, run: l.length });
      }
    }
    if (u && l.length >= 4 && l[0].f.size >= 2 && EX.uniform.length < 40) EX.uniform.push({ file: b.file, sig: l[0].sig, run: l.length });
    // the odd window: runs of 3 or more with one signature held by most
    if (l.length >= 3) {
      const cnt = {};
      for (const w of l) inc(cnt, w.sig);
      const [maj, mc] = Object.entries(cnt).sort((x, y) => y[1] - x[1])[0];
      if (mc > l.length / 2) {
        A.odd.runs3++;
        const sorted = [...l].sort((x, y) => (x.a0 + x.a1) - (y.a0 + y.a1));
        sorted.forEach((w, i) => {
          A.odd.windows3++;
          const where = w.byDoor ? 'by a door' : (i === 0 || i === sorted.length - 1) ? 'run end' : 'middle';
          inc(A.odd.behindAll, w.kind); inc(A.odd.whereAll, where);
          if (w.sig === maj) return;
          A.odd.oddWindows++;
          inc(A.odd.behind, w.kind); inc(A.odd.where, where);
          const mw = l.find(x => x.sig === maj);
          const plus = FEATS.filter(k => w.f.has(k) && !mw.f.has(k)), minus = FEATS.filter(k => !w.f.has(k) && mw.f.has(k));
          inc(A.odd.how, plus.length && !minus.length ? 'adds ' + plus.join('+') : minus.length && !plus.length ? 'lacks ' + minus.join('+') : w.fill !== mw.fill && !plus.length && !minus.length ? 'other fill' : 'swaps');
          if (EX.odd.length < 60) EX.odd.push({ file: b.file, maj, odd: w.sig, behind: w.kind, where });
        });
      }
    }
  }
  for (const l of shuffled) {
    A.shuffle.n++;
    if (l.every(w => w.sig === l[0].sig)) A.shuffle.uniform++;
    if (l.every(w => w.asig === l[0].asig)) A.shuffle.auniform++;
    for (const k of keys) { const c = l.filter(w => has(w, k)).length; if (!c) continue; A.feat[k].shufRuns++; if (c === l.length) A.feat[k].shufFull++; }
  }
  // per build: windows with each feature, and whether one piece serves the feature on every window that has it
  for (const k of keys) {
    const ws = WS.filter(w => has(w, k));
    if (!ws.length) continue;
    A.feat[k].windows += ws.length; A.feat[k].buildsWith++;
    if (k.startsWith('fill:')) continue;
    const names = new Map();
    for (const w of ws) for (const n of w.f.get(k)) names.set(n, (names.get(n) || 0) + 1);
    const lead = Math.max(...names.values());
    if (ws.length >= 2 && lead === ws.length) A.feat[k].buildsOnePiece++;
  }
  // sides on one level: does each side of the building treat its windows the same
  const byLvl = new Map();
  for (const w of WS) { const k = Math.round(w.lvl * 2); if (!byLvl.has(k)) byLvl.set(k, []); byLvl.get(k).push(w); }
  const lowest = Math.min(...[...byLvl.keys()]);
  for (const [lk, ws] of byLvl) {
    const sides = new Map();
    for (const w of ws) { if (!sides.has(w.side)) sides.set(w.side, []); sides.get(w.side).push(w); }
    if (sides.size < 2) continue;
    A.sides.storeys++;
    const dom = l => { const c = {}; for (const w of l) inc(c, w.sig); return Object.entries(c).sort((x, y) => y[1] - x[1])[0][0]; };
    const ds = [...sides.values()].map(dom);
    if (ds.every(d => d === ds[0])) A.sides.allSame++;
    if (lk !== lowest) continue;
    // the front: the side with the most outer doors on the lowest level
    const dc = {};
    for (const d of doors) if (Math.round(d.lvl * 2) === lk) inc(dc, `${Math.round(-d.nx)},${Math.round(-d.nz)}`);
    const front = Object.entries(dc).sort((x, y) => y[1] - x[1])[0];
    if (!front || !sides.has(front[0])) continue;
    const fw = sides.get(front[0]), ow = ws.filter(w => w.side !== front[0]);
    if (!ow.length) continue;
    const fr = FEATS.reduce((t, k) => t + rate(fw.map(w => w.f.has(k))), 0), orr = FEATS.reduce((t, k) => t + rate(ow.map(w => w.f.has(k))), 0);
    if (dom(fw) !== dom(ow)) A.sides.frontDiffers++;
    if (fr > orr + 0.25) A.sides.frontRicher++; else if (orr > fr + 0.25) A.sides.frontPoorer++;
    for (const k of FEATS) { A.sides.featFront[k] = (A.sides.featFront[k] || 0) + rate(fw.map(w => w.f.has(k))); A.sides.featOther[k] = (A.sides.featOther[k] || 0) + rate(ow.map(w => w.f.has(k))); }
    A.sides.frontN = (A.sides.frontN || 0) + 1;
  }
  // stacks: one wall line over the levels
  const stacks = new Map();
  for (const w of WS) { const k = w.side; if (!stacks.has(k)) stacks.set(k, []); stacks.get(k).push(w); }
  for (const l of stacks.values()) {
    const lv = [...new Set(l.map(w => Math.round(w.lvl * 2)))].sort((x, y) => x - y);
    if (lv.length < 2) continue;
    A.stacks.lines++;
    for (let i = 1; i < lv.length; i++) {
      const up = l.filter(w => Math.round(w.lvl * 2) === lv[i]), dn = l.filter(w => Math.round(w.lvl * 2) === lv[i - 1]);
      for (const w of up) {
        A.stacks.upper++;
        const c = (w.a0 + w.a1) / 2, m = dn.find(d => Math.abs(d.line - w.line) <= 1.01 && Math.abs((d.a0 + d.a1) / 2 - c) < 0.35);
        if (m) { A.stacks.aligned++; A.stacks.pairs++; if (m.asig === w.asig) A.stacks.sameSig++; }
        // the upper window over a lower run at all (some window of the level below on a line within 1 m)
        if (dn.some(d => Math.abs(d.line - w.line) <= 1.01)) A.stacks.overRun = (A.stacks.overRun || 0) + 1;
        if (m || dn.some(d => Math.abs(d.line - w.line) <= 1.01)) {
          // within 1 m of a lower window's middle (a window shifted by half a bay)
          if (dn.some(d => Math.abs(d.line - w.line) <= 1.01 && Math.abs((d.a0 + d.a1) / 2 - c) < 1.05)) A.stacks.near1 = (A.stacks.near1 || 0) + 1;
        }
      }
    }
  }
  // wall bands: a beam proud of the outer face at the foot of the wall on each outer face of 3 m or more
  const fbands = [];
  for (const fc of faces) {
    if (fc.a1 - fc.a0 < 3) continue;
    const mid = (fc.a0 + fc.a1) / 2, cand = idx.near(fc.x0 + mid * fc.ux, fc.z0 + mid * fc.uz, (fc.a1 - fc.a0) / 2 + 1);
    let cov = 0;
    for (const p of cand) {
      if (p.role !== 'beam' || slopeBeam(p.n) || !p.along) continue;
      const t = (p.x - fc.x0) * fc.ux + (p.z - fc.z0) * fc.uz, o = -((p.x - fc.x0) * fc.nx + (p.z - fc.z0) * fc.nz) - fc.ht, h = p.y - fc.lvl;
      if (t < fc.a0 || t > fc.a1 || o < -0.05 || o > 0.6 || h < -0.45 || h > 0.35) continue;
      cov += /_1$|_1m/.test(p.n) ? 1 : /4x4|_4/.test(p.n) ? 4 : 2;
    }
    fbands.push({ side: `${fc.side}|${Math.round(fc.lvl * 2)}`, cov, len: fc.a1 - fc.a0 });
  }
  // per side and level: banded when beams run along half the side's outer faces or more
  const bySide = new Map();
  for (const x of fbands) { const o = bySide.get(x.side) || { cov: 0, len: 0 }; o.cov += x.cov; o.len += x.len; bySide.set(x.side, o); }
  const sb = [...bySide.values()].map(o => o.cov >= o.len * 0.5);
  if (sb.length >= 3) {
    A.bands.builds++; A.bands.faces += sb.length; A.bands.banded += sb.filter(Boolean).length;
    const r = rate(sb);
    if (r === 0) A.bands.none++; else if (r === 1) A.bands.all++; else A.bands.mixed++;
  }
  // outside corners of the lowest level: two outer faces of one room meeting, the building outside both
  const cs = [];
  const lowFaces = faces.filter(fc => Math.abs(fc.lvl - levels[0]) < 0.6);
  for (let i = 0; i < lowFaces.length; i++) for (let j = i + 1; j < lowFaces.length; j++) {
    const f1 = lowFaces[i], f2 = lowFaces[j];
    if (f1.r !== f2.r || Math.abs(f1.nx * f2.nx + f1.nz * f2.nz) > 0.1) continue;
    for (const e1 of [f1.a0, f1.a1]) for (const e2 of [f2.a0, f2.a1]) {
      const x1 = f1.x0 + e1 * f1.ux, z1 = f1.z0 + e1 * f1.uz, x2 = f2.x0 + e2 * f2.ux, z2 = f2.z0 + e2 * f2.uz;
      if (Math.hypot(x1 - x2, z1 - z2) > 0.8) continue;
      const cx = (x1 + x2) / 2 - (f1.nx + f2.nx) * f1.ht, cz = (z1 + z2) / 2 - (f1.nz + f2.nz) * f1.ht;
      if (roomAt(cx - (f1.nx + f2.nx) * 0.8, cz - (f1.nz + f2.nz) * 0.8, f1.lvl)) continue;
      const posts = idx.near(cx, cz, 1).filter(p => p.role === 'pole' && Math.hypot(p.x - cx, p.z - cz) < 0.55 && p.y + p.h / 2 > f1.lvl + 0.3 && p.y - p.h / 2 < f1.lvl + 2);
      cs.push(posts.length ? posts[0].n : null);
    }
  }
  if (cs.length >= 3) {
    A.corners.builds++; A.corners.n += cs.length;
    const d = cs.filter(Boolean);
    A.corners.dressed += d.length;
    const r = d.length / cs.length;
    if (r === 0) A.corners.none++; else if (r === 1) A.corners.all++; else A.corners.mixed++;
    if (d.length >= 2) { A.corners.withPosts++; if (d.every(n => n === d[0])) A.corners.onePiece++; }
  }
  A.perBuild.push({ cul, kind: kindB, windows: WS.length, runs: R.length, uniform: R.filter(l => l.every(w => w.sig === l[0].sig)).length });
}

async function main() {
  const culture = new Map();
  try { const m = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/culture-corpus/members.json'), 'utf8')).cultures; for (const [c, l] of Object.entries(m)) for (const [k] of l) culture.set(k, c); } catch (e) { /* none */ }
  const rot = new Map();
  for (const line of fs.readFileSync(path.join(exDir, 'builds.jsonl'), 'utf8').split('\n')) { if (!line) continue; const b = JSON.parse(line); rot.set(b.b, b.rot || 0); }
  const roomIt = readline.createInterface({ input: fs.createReadStream(path.join(exDir, 'rooms.jsonl')) })[Symbol.asyncIterator]();
  let pending = null;
  const roomsFor = async bi => {
    const out = [];
    for (;;) {
      if (!pending) { const n = await roomIt.next(); if (n.done) break; if (!n.value) continue; pending = JSON.parse(n.value); }
      if (pending.b < bi) { pending = null; continue; }
      if (pending.b > bi) break;
      out.push(pending);
      pending = null;
    }
    return out;
  };
  let bi = -1;
  const t0 = Date.now();
  for await (const line of readline.createInterface({ input: fs.createReadStream(compact) })) {
    if (!line.trim()) continue;
    bi++;
    if (bi >= LIMIT) break;
    const rooms = await roomsFor(bi);
    const b = JSON.parse(line);
    if (b.p.some(p => !L.isVanilla(p[0]))) continue;
    if (!rooms.length) continue;
    A.builds++;
    const cul = culture.get(b.file.replace(/\.blueprint$/, '').split('__')[0]) || null;
    const tt = (b.title || '') + ' ' + (b.cat || '');
    const kindB = /tavern|inn\b/i.test(tt) ? 'tavern' : /castle|fort|keep/i.test(tt) ? 'castle' : /tower/i.test(tt) ? 'tower' : /temple|church/i.test(tt) ? 'temple' : /longhouse|hall/i.test(tt) ? 'longhouse' : /farm|barn/i.test(tt) ? 'farm' : /house|home|cabin|starter|cottage/i.test(tt) ? 'home' : 'other';
    try { measure(b, rooms, rot.get(bi) || 0, bi, cul, kindB); } catch (e) { process.stderr.write(`build ${bi}: ${e.message}\n`); }
    if (bi % 200 === 0) process.stderr.write(`${bi} builds, ${A.windows} windows, ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
  }
  // ---------------------------------------------------------------- summary
  const sh = (a, b2) => (b2 ? r3(a / b2) : null);
  const feat = {};
  for (const [k, F] of Object.entries(A.feat)) {
    if (!F.windows) continue;
    feat[k] = { windows: F.windows, windowShare: sh(F.windows, A.windows), builds: F.buildsWith, runsWith: F.runsWith, fullRun: sh(F.full, F.runsWith), loneInRun: sh(F.lone, F.runsWith), partial: sh(F.partial, F.runsWith),
      fullRunIfShuffled: sh(F.shufFull, F.shufRuns), onePieceInBuild: k.startsWith('fill:') ? null : sh(F.buildsOnePiece, F.buildsWith) };
  }
  const ratio = (o, all) => Object.fromEntries(Object.entries(o).sort((x, y) => y[1] - x[1]).map(([k, v]) => [k, { n: v, share: sh(v, Object.values(o).reduce((t, x) => t + x, 0)), base: all ? sh(all[k] || 0, Object.values(all).reduce((t, x) => t + x, 0)) : null }]));
  const perB = A.perBuild.filter(x => x.runs >= 2);
  const byCul = {};
  for (const x of perB) { const c = x.cul || 'unsorted'; const o = byCul[c] = byCul[c] || { builds: 0, runs: 0, uniform: 0 }; o.builds++; o.runs += x.runs; o.uniform += x.uniform; }
  for (const o of Object.values(byCul)) o.uniformShare = sh(o.uniform, o.runs);
  const byKind = {};
  for (const x of perB) { const o = byKind[x.kind] = byKind[x.kind] || { builds: 0, runs: 0, uniform: 0 }; o.builds++; o.runs += x.runs; o.uniform += x.uniform; }
  for (const o of Object.values(byKind)) o.uniformShare = sh(o.uniform, o.runs);
  const res = {
    meta: { made: new Date().toISOString().slice(0, 10), source: 'lab/arch_facades.js', set: LABEL, builds: A.builds, buildsWithRuns: A.buildsWithRuns, windows: A.windows },
    fields: {
      runs: 'runs of 2 or more windows on one wall line and level: count, share whose windows all carry the same treatment (feature classes and light fill), by run length; shuffle: the same with each build\'s windows dealt to its runs at random',
      feat: 'per feature: windows with it, builds, runs holding it, of those the share where every window of the run has it (fullRun), exactly one (loneInRun), some (partial), fullRun after the shuffle, and the share of builds whose windows with the feature all use one piece for it',
      sides: 'levels with windows on 2 or more sides: share where every side\'s lead treatment is the same; on the lowest level, the front (side with the most outer doors) against the other sides',
      stacks: 'sides with windows on 2 or more levels: upper windows over a lower run (a window of the level below on a wall line within 1 m), with a window right under them (middles within 0.35 m) or within 1 m, and of the aligned pairs the share with the same architectural treatment',
      archUniform: 'runs whose windows all carry the same architectural treatment (shutter, sill, head, posts, arch, brace, planter, vine, hood, fill; lights and hung decor left out)',
      odd: 'runs of 3 or more where one treatment holds most windows: the windows that differ, what room is behind them and where they sit, against all windows of those runs (base)',
      lone: 'runs of 3 or more where one window alone has a feature: the feature, the room behind, where it sits',
      bands: 'outer faces 3 m or longer, by side and level: beams at the foot proud of the face along half the side or more; builds (3 or more sides read) with all, none or some sides banded, and the share of sides banded',
      corners: 'outside corners of the lowest level: a post within 0.55 m; builds with all, none or some corners posted, and the share of posted builds with one post piece at every corner',
    },
    runs: { n: A.runs.n, uniform: sh(A.runs.uniform, A.runs.n), archUniform: sh(A.runs.auniform, A.runs.n), archUniformIfShuffled: sh(A.shuffle.auniform, A.shuffle.n),
      onePieceInFullRun: Object.fromEntries(Object.entries(A.pieceRuns).map(([k, v]) => [k, { runs: v.n, onePiece: sh(v.one, v.n) }])), byLen: Object.fromEntries(Object.entries(A.runs.byLen).map(([k, v]) => [k, { n: v.n, uniform: sh(v.uniform, v.n) }])), shuffleUniform: sh(A.shuffle.uniform, A.shuffle.n) },
    feat,
    sides: { levels: A.sides.storeys, allSidesSame: sh(A.sides.allSame, A.sides.storeys), frontLevels: A.sides.frontN || 0, frontDiffers: sh(A.sides.frontDiffers, A.sides.frontN), frontRicher: sh(A.sides.frontRicher, A.sides.frontN), frontPoorer: sh(A.sides.frontPoorer, A.sides.frontN),
      featureShareFront: Object.fromEntries(FEATS.map(k => [k, sh(A.sides.featFront[k] || 0, A.sides.frontN)])), featureShareOther: Object.fromEntries(FEATS.map(k => [k, sh(A.sides.featOther[k] || 0, A.sides.frontN)])) },
    stacks: { sides: A.stacks.lines, upperWindows: A.stacks.upper, overLowerRun: sh(A.stacks.overRun || 0, A.stacks.upper), aligned: sh(A.stacks.aligned, A.stacks.upper), alignedOfOverRun: sh(A.stacks.aligned, A.stacks.overRun || 0),
      within1mOfOverRun: sh(A.stacks.near1 || 0, A.stacks.overRun || 0), sameTreatmentWhenAligned: sh(A.stacks.sameSig, A.stacks.pairs) },
    odd: { runs: A.odd.runs3, windows: A.odd.windows3, oddShare: sh(A.odd.oddWindows, A.odd.windows3), behind: ratio(A.odd.behind, A.odd.behindAll), where: ratio(A.odd.where, A.odd.whereAll), how: ratio(A.odd.how) },
    lone: { n: A.lone.n, feat: ratio(A.lone.feat), behind: ratio(A.lone.behind, A.odd.behindAll), where: ratio(A.lone.where) },
    bands: { builds: A.bands.builds, all: sh(A.bands.all, A.bands.builds), none: sh(A.bands.none, A.bands.builds), mixed: sh(A.bands.mixed, A.bands.builds), faceShare: sh(A.bands.banded, A.bands.faces) },
    corners: { builds: A.corners.builds, all: sh(A.corners.all, A.corners.builds), none: sh(A.corners.none, A.corners.builds), mixed: sh(A.corners.mixed, A.corners.builds), cornerShare: sh(A.corners.dressed, A.corners.n), onePieceWhenPosted: sh(A.corners.onePiece, A.corners.withPosts) },
    byCulture: byCul, byKind,
    perBuildUniform: qs(perB.map(x => x.uniform / x.runs)),
  };
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(res, null, 1));
  if (exOut) fs.writeFileSync(exOut, JSON.stringify(EX, null, 1));
  console.log(outFile, A.builds, 'builds', A.windows, 'windows', ((Date.now() - t0) / 1000).toFixed(0), 's');
}
main();
