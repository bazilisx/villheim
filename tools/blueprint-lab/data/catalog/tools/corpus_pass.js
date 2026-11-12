// One pass over the corpus: per prefab, where it stands (covered, roof, yard, height, walls) and how often it repeats.
const fs = require('fs'), rl = require('readline');
const LAB = process.argv[2], OUT = process.argv[3];
const P = require(LAB + '/lib/pieces.js');
const idx = JSON.parse(fs.readFileSync('/work/models/vhmodels/work/index.json', 'utf8')).prefabs;
const OVER = new Set(['roof', 'roofTop', 'roofCorner', 'floor']);
const ROOF = new Set(['roof', 'roofTop', 'roofCorner']);
const WALL = new Set(['wall', 'gable', 'door', 'window']);
const info = new Map();
function inf(n) { let c = info.get(n); if (!c) { const p = P.piece(n); c = { role: p.role, size: p.size, structural: p.structural, onPivot: p.onPivot }; info.set(n, c); } return c; }
const S = new Map();
function st(n) {
  let s = S.get(n);
  if (!s) { s = { n: 0, builds: 0, wbuilds: 0, per: [], cov: 0, roof: 0, gable: 0, yard: 0, high: 0, hf: [], wall: 0, hung: 0, ceil: 0, dir: [0, 0, 0, 0], dirN: 0, cats: {}, yawq: [0, 0, 0, 0], floorOn: 0, onTop: 0 }; S.set(n, s); }
  return s;
}
const q = (a, f) => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(f * (b.length - 1) + 0.5))]; };
const pairs = new Map(); // "a|b" -> [builds both present, builds both in same covered area]
const cell = 2, key = (i, k) => i * 100003 + k;
let nb = 0, totalW = 0;
const catCount = {};
(async () => {
  for await (const line of rl.createInterface({ input: fs.createReadStream(process.env.CORPUS || '/tmp/catalog/compact.jsonl') })) {
    const r = JSON.parse(line); nb++;
    const w = 1 + Math.log(1 + (r.votes || 0)); totalW += w;
    const cat = String(r.cat || '').replace(/ Build$/, '').toLowerCase().replace(/[\s-]+/g, '-');
    catCount[cat] = (catCount[cat] || 0) + 1;
    const ps = [];
    for (const p of r.p) if (idx[p[0]]) ps.push(p);
    if (!ps.length) continue;
    const ys = ps.map(p => p[2]).sort((a, b) => a - b), ground = ys[Math.floor(0.03 * (ys.length - 1))];
    const over = new Map(), walls = new Map(), floors = new Map(), roofs = new Map(), gables = new Map(), tops = new Map();
    const add = (m, p, c) => { const i = Math.floor(p[1] / cell), k = Math.floor(p[3] / cell); const kk = key(i, k); let a = m.get(kk); if (!a) m.set(kk, a = []); a.push([p, c]); };
    for (const p of ps) {
      const c = inf(p[0]);
      if (OVER.has(c.role)) add(over, p, c);
      if (c.role === 'floor') add(floors, p, c);
      if (ROOF.has(c.role)) add(roofs, p, c);
      if (c.role === 'gable') add(gables, p, c);
      if (WALL.has(c.role)) add(walls, p, c);
      if (!c.structural && ['table', 'storage', 'craft'].includes(c.role)) add(tops, p, c);
    }
    const near = (m, x, z, rad, fn) => { const i0 = Math.floor((x - rad) / cell), i1 = Math.floor((x + rad) / cell), k0 = Math.floor((z - rad) / cell), k1 = Math.floor((z + rad) / cell); for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) { const a = m.get(key(i, k)); if (a) for (const e of a) fn(e[0], e[1]); } };
    const counts = new Map(), areaItems = [], acc = new Map();
    const A = n => { let a = acc.get(n); if (!a) acc.set(n, a = { n: 0, cov: 0, roof: 0, gable: 0, yard: 0, deck: 0, wall: 0, hung: 0, ceil: 0, onTop: 0, hf: [], dir: [0, 0, 0, 0] }); return a; };
    for (const p of ps) {
      const [n, x, y, z, yaw] = p; const c = inf(n); const s = st(n);
      s.n++; counts.set(n, (counts.get(n) || 0) + 1);
      // covered: a roof or floor above, within its footprint
      let covered = false, ceilGap = 99;
      near(over, x, z, 2.2, (o, oc) => { const hr = Math.max(oc.size[0], oc.size[2]) / 2 + 0.1; if (Math.abs(o[1] - x) <= hr && Math.abs(o[3] - z) <= hr && o[2] > y + 0.4 && o[2] < y + 14) { covered = true; ceilGap = Math.min(ceilGap, o[2] - y); } });
      // floor below
      let fl = null;
      near(floors, x, z, 2.2, (o, oc) => { const hr = Math.max(oc.size[0], oc.size[2]) / 2 + 0.05; if (o !== p && Math.abs(o[1] - x) <= hr && Math.abs(o[3] - z) <= hr && o[2] <= y + 0.3) { const top = o[2] + (n === o[0] ? 0 : 0); if (fl == null || top > fl) fl = top; } });
      const hf = fl == null ? y - ground : y - fl;
      const b = A(n); b.n++;
      if (covered) { s.cov++; b.cov++; }
      if (c.structural && !['fence'].includes(c.role)) continue;
      s.hf.push(Math.round(hf * 20) / 20); b.hf.push(hf);
      if (!covered && fl != null) b.deck++;
      if (y - ground > 2.5) s.high++;
      // on a roof: uncovered, roof surface close under or around it, well above ground
      let onRoof = false, nearGable = false;
      if (!covered && y - ground > 2) near(roofs, x, z, 1.8, (o) => { if (Math.hypot(o[1] - x, o[3] - z) < 1.8 && o[2] > y - 2.6 && o[2] < y + 0.6) onRoof = true; });
      near(gables, x, z, 2.2, (o, oc) => { if (Math.hypot(o[1] - x, o[3] - z) < 2.2 && Math.abs(o[2] - y) < 2.5) nearGable = true; });
      if (onRoof) { s.roof++; b.roof++; }
      if (nearGable && !covered) { s.gable++; b.gable++; }
      if (!covered && !onRoof && y - ground < 1.5 && fl == null) { s.yard++; b.yard++; }
      // standing on a table, chest or station
      let onTop = false;
      near(tops, x, z, 1.5, (o, oc) => { if (o !== p && Math.abs(o[1] - x) < oc.size[0] / 2 + 0.1 && Math.abs(o[3] - z) < oc.size[0] / 2 + 0.1 && y - o[2] > 0.3 && y - o[2] < 1.4) onTop = true; });
      if (onTop) { s.onTop++; b.onTop++; }
      if (ceilGap < 1.0 && hf > 1.2) { s.ceil++; b.ceil++; }
      if (c.structural) continue;
      // nearest wall, and the side of the piece that faces it (in the piece's own frame)
      let best = 9, bdx = 0, bdz = 0;
      near(walls, x, z, 3, (o, oc) => {
        const a = o[4] * Math.PI / 180, ux = Math.cos(a), uz = -Math.sin(a);
        const lo = oc.onPivot ? o[2] - 0.3 : o[2] - oc.size[1] / 2 - 0.3, hi = oc.onPivot ? o[2] + oc.size[1] + 0.3 : o[2] + oc.size[1] / 2 + 0.3;
        if (y < lo || y > hi) return;
        const dx = x - o[1], dz = z - o[3]; let t = dx * ux + dz * uz; const hl = oc.size[0] / 2; t = Math.max(-hl, Math.min(hl, t));
        const px = o[1] + ux * t, pz = o[3] + uz * t; const d = Math.hypot(x - px, z - pz);
        if (d < best) { best = d; bdx = px - x; bdz = pz - z; }
      });
      if (best < 0.7) {
        s.wall++; b.wall++; if (hf > 0.8) { s.hung++; b.hung++; }
        const a = yaw * Math.PI / 180, lx = [Math.cos(a), -Math.sin(a)], lz = [Math.sin(a), Math.cos(a)];
        const u = bdx * lx[0] + bdz * lx[1], v = bdx * lz[0] + bdz * lz[1];
        if (Math.hypot(u, v) > 0.02) { const i = Math.abs(u) > Math.abs(v) ? (u > 0 ? 0 : 1) : (v > 0 ? 2 : 3); s.dir[i]++; s.dirN++; b.dir[i]++; }
      }
      if (covered && c.role !== 'nature' && !/^(Pickable_|vfx_|fx_|sfx_|Spawner|LocationProxy)/.test(n)) areaItems.push(p);
    }
    for (const [n, k] of counts) { const s = st(n); const b = acc.get(n);
      if (b) { const f = v => v / b.n, hs = b.hf.slice().sort((x, y) => x - y); s.pb = s.pb || []; const dn = b.dir.reduce((x, y) => x + y, 0); s.pb.push([w, f(b.cov), f(b.roof), f(b.gable), f(b.yard), f(b.deck), f(b.wall), f(b.hung), f(b.ceil), f(b.onTop), hs.length ? hs[hs.length >> 1] : null, b.hf.length]); if (dn) { s.dirB = s.dirB || [0, 0, 0, 0]; for (let i = 0; i < 4; i++) s.dirB[i] += w * b.dir[i] / dn; s.dirBn = (s.dirBn || 0) + 1; } } s.builds++; s.wbuilds += w; s.per.push([k, w, nb - 1]); s.cats[cat] = (s.cats[cat] || 0) + 1; }
    // same covered area: within 4 m and 1.5 m in height, both under cover
    const names = [...counts.keys()].filter(n => !inf(n).structural);
    const inArea = new Set();
    const ah = new Map(); for (const p of areaItems) add(ah, p, null);
    for (const p of areaItems) near(ah, p[1], p[3], 4, (o) => { if (o !== p && o[0] !== p[0] && Math.hypot(o[1] - p[1], o[3] - p[3]) < 4 && Math.abs(o[2] - p[2]) < 1.5) { const a = p[0] < o[0] ? p[0] + '|' + o[0] : o[0] + '|' + p[0]; inArea.add(a); } });
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) { const a = names[i] < names[j] ? names[i] + '|' + names[j] : names[j] + '|' + names[i]; let e = pairs.get(a); if (!e) pairs.set(a, e = [0, 0]); e[0]++; }
    for (const a of inArea) { let e = pairs.get(a); if (!e) pairs.set(a, e = [0, 0]); e[1]++; }
    if (nb % 200 === 0) console.error(nb, S.size, pairs.size);
  }
  const out = { builds: nb, totalW, catCount, pieces: {} };
  for (const [n, s] of S) {
    const c = inf(n), m = s.n - 0;
    const ks = s.per.map(e => e[0]);
    out.pieces[n] = { role: c.role, n: s.n, builds: s.builds, wshare: s.wbuilds / totalW, p50: q(ks, 0.5), p90: q(ks, 0.9), max: Math.max(...ks),
      cov: s.cov, roof: s.roof, gable: s.gable, yard: s.yard, high: s.high, wall: s.wall, hung: s.hung, ceil: s.ceil, onTop: s.onTop,
      hf10: q(s.hf, 0.1), hf50: q(s.hf, 0.5), hf90: q(s.hf, 0.9), nonStruct: s.hf.length, dir: s.dir, dirN: s.dirN, cats: s.cats, per: s.per, pb: s.pb, dirB: s.dirB, dirBn: s.dirBn };
  }
  const pr = {}; for (const [a, e] of pairs) if (e[0] >= 5) pr[a] = e;
  out.pairs = pr;
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.error('done', nb, S.size, Object.keys(pr).length);
})();
