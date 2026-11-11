// Compares the outputs of the corpus miners run with the colliders (VH_SHAPES unset or 'collider') and with the fine parts (VH_SHAPES=fine)
// on the same builds (docs/BLUEPRINT_LAB.md, "Corpus recount with fine models", "Miners that need compact.json").
//   node lab/recount2_compare.js <dir with kitbash-default.json, kitbash-fine.json, creative-*, yards-*, motifs-*, coverage-*> [out.json]
// Tolerances: 1 cm for depths and heights; for shares and counts the test_stands band (0.6 to 1.6 times, at least 2 points of share).
const fs = require('fs'), path = require('path');
const dir = process.argv[2], outFile = process.argv[3];
const rd = f => (fs.existsSync(path.join(dir, f)) ? JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) : null);
const qf = (a, t) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * t))]; };
const cm = v => (v == null ? null : +(v * 100).toFixed(1));
const R = {};
const rows = [];
const flagDepth = (a, b) => a != null && b != null && Math.abs(b - a) > 1.0001; // cm
const flagPts = (a, b) => a != null && b != null && Math.abs(b - a) > 5;
const flagShare = (a, b, n) => { if (a == null || b == null) return false; const lo = Math.min(a * 0.6, a - 2), hi = Math.max(a * 1.6, a + 2); return b < lo || b > hi; };
const add = (group, measure, oldV, newV, unit, feeds, flag) => rows.push({ group, measure, old: oldV, fine: newV, change: typeof oldV === 'number' && typeof newV === 'number' ? +(newV - oldV).toFixed(2) : null, unit, feeds, flag: !!flag });

// ---- kitbash and creative: clips of the assemblies
function clipStats(name, A, B, feeds) {
  // A, B: arrays of assemblies / objects with clips [[u, v|'a'|'w', depth]]
  const kinds = { 'to each other': c => typeof c[1] === 'number', 'to the anchor': c => c[1] === 'a', 'to the wall': c => c[1] === 'w' };
  for (const [k, f] of Object.entries(kinds)) {
    const a = A.flatMap(x => (x.clips || []).filter(f).map(c => c[2])), b = B.flatMap(x => (x.clips || []).filter(f).map(c => c[2]));
    add(name, `clips ${k}: count`, a.length, b.length, 'clips', feeds, flagShare(a.length, b.length));
    for (const t of [0.5, 0.9]) add(name, `clips ${k}: ${t * 100}th percentile`, cm(qf(a, t)), cm(qf(b, t)), 'cm', feeds, flagDepth(cm(qf(a, t)), cm(qf(b, t))));
  }
  const ma = A.map(x => x.maxClip != null ? x.maxClip : Math.max(0, ...(x.clips || []).map(c => c[2]))), mb = B.map(x => x.maxClip != null ? x.maxClip : Math.max(0, ...(x.clips || []).map(c => c[2])));
  for (const th of [0.03, 0.12]) {
    const sa = 100 * ma.filter(v => v >= th).length / Math.max(1, ma.length), sb = 100 * mb.filter(v => v >= th).length / Math.max(1, mb.length);
    add(name, `share of entries with a clip of ${th * 100} cm or more`, +sa.toFixed(1), +sb.toFixed(1), "%", feeds, flagPts(sa, sb));
  }
  add(name, 'entries', A.length, B.length, 'entries', feeds, A.length !== B.length);
}
const sigOf = a => `${a.anchor}|${(a.members || a.pieces || []).map(m => m.n + '@' + Math.round((m.x || 0) * 3) + ',' + Math.round((m.z || 0) * 3)).sort().join(';')}`;
const kd = rd('kitbash-default.json'), kf = rd('kitbash-fine.json');
if (kd && kf) {
  clipStats('kitbash', kd.assemblies, kf.assemblies, 'data/kitbash-interior.json assemblies[].clips and maxClip (lib/kitbash.js clipOf, intoWall and furnClip gates)');
  const sa = new Set(kd.assemblies.map(sigOf)), sb = new Set(kf.assemblies.map(sigOf));
  const onlyA = [...sa].filter(s => !sb.has(s)).length, onlyB = [...sb].filter(s => !sa.has(s)).length;
  add('kitbash', 'assemblies kept by both (same anchor, same pieces at the same spots)', sa.size - onlyA, sb.size - onlyB, 'entries', 'library membership', onlyA + onlyB > 0);
  add('kitbash', 'assemblies only in the colliders run / only in the fine run', onlyA, onlyB, 'entries', 'library membership', onlyA + onlyB > 0);
  const da = new Map(kd.decor.map(d => [d.n, d])), movers = [];
  for (const d of kf.decor) { const o = da.get(d.n); if (o && Math.abs(d.clip90 - o.clip90) > 0.01 && d.pieces >= 30) movers.push({ n: d.n, pieces: d.pieces, clip90_old: cm(o.clip90), clip90_fine: cm(d.clip90), clip_old: cm(o.clip), clip_fine: cm(d.clip) }); }
  movers.sort((a, b) => Math.abs(b.clip90_fine - b.clip90_old) - Math.abs(a.clip90_fine - a.clip90_old));
  R.kitbashDecorMovers = { total: movers.length, of: kf.decor.filter(d => d.pieces >= 30).length, top: movers.slice(0, 12) };
}
const cd = rd('creative-sample-collider.json') || rd('creative-default.json'), cf = rd('creative-sample-fine.json') || rd('creative-fine.json');
if (cd && cf) {
  clipStats('creative', cd.objects, cf.objects, 'data/creative-mined.json objects[].clips (lib/kitbash.js creative sets, D-098 marks)');
  const sa = new Set(cd.objects.map(sigOf)), sb = new Set(cf.objects.map(sigOf));
  const onlyA = [...sa].filter(s => !sb.has(s)).length, onlyB = [...sb].filter(s => !sa.has(s)).length;
  add('creative', 'objects kept by both / only colliders run / only fine run', sa.size - onlyA, `${onlyA} / ${onlyB}`, 'entries', 'creative set library membership', onlyA + onlyB > 0);
  add('creative', 'combined objects found (all sightings)', cd.found, cf.found, 'objects', 'creative set library', flagShare(cd.found / 100, cf.found / 100));
}
// ---- yards
const flat = (o, p, out) => { if (o && typeof o === 'object' && !Array.isArray(o)) { if ('median' in o && 'n' in o) { out[p] = o; return out; } for (const k in o) flat(o[k], p ? p + '.' + k : k, out); } return out; };
const yd = rd('yards-collider.json'), yf = rd('yards-fine.json'), y0 = rd('yards-default.json');
const YF = { sink: 'lib/yards.js sink into the ground (sink.*)', clipDepth: 'lib/yards.js prop clip allowance', top: 'lib/yards.js fence, post and gate heights', foot: 'lib/yards.js fence foot', lowWallTop: 'lib/yards.js low wall height', postTop: 'lib/yards.js post height' };
if (yd && yf) for (const set of ['wellLiked', 'allVanilla']) {
  const A = flat(yd[set], '', {}), B = flat(yf[set], '', {});
  for (const p of Object.keys(A)) {
    if (!B[p] || !/sink|clipDepth|top|foot|Top/i.test(p)) continue;
    const feed = Object.entries(YF).find(([k]) => p.includes(k));
    for (const t of ['median', 'p75', 'p90']) { const a = cm(A[p][t]), b = cm(B[p][t]); if (a == null || b == null) continue; if (flagDepth(a, b) || (set === 'wellLiked' && ['sink.', 'clipDepth', 'fence.top', 'fence.postTop', 'gate.top'].some(s => p.startsWith(s) || p === s.replace('.', '')))) add(`yards ${set}`, `${p} ${t} (n ${A[p].n} to ${B[p].n})`, a, b, 'cm', feed ? feed[1] : '', flagDepth(a, b)); }
  }
  if (y0) R.yardsDefaultNote = 'yards-default is the unchanged miner (axis-aligned collider boxes, depth = shallowest of dx, dz); yards-collider reads the colliders through the same code path as fine';
}
// ---- motifs
const md = rd('motifs-collider.json') || rd('motifs-default.json'), mf = rd('motifs-fine.json'), m0 = rd('motifs-default.json');
if (md && mf) {
  const kinds = new Set([...Object.keys(md.counts), ...Object.keys(mf.counts)]);
  const outcome = (m, kind, w) => m.skipped[`${kind} ${w}`] || 0;
  const W = ['kept', 'kept clip', 'clipping', 'floating', 'hidden piece dropped'];
  for (const k of kinds) for (const w of W) {
    const a = outcome(md, k, w), b = outcome(mf, k, w);
    if (a || b) add('motifs sites', `${k} ${w}`, a, b, 'sites', 'data/motifs.json (lib/motifs.js site rates, test_variance bands)', flagShare(a, b));
  }
  const clipShare = m => { const t = m.motifs.length, c = m.motifs.filter(x => x.p.some(i => i.length > 5)).length; return +(100 * c / t).toFixed(1); };
  add('motifs', 'motifs kept (distinct)', md.motifs.length, mf.motifs.length, 'motifs', 'motif library size', flagShare(md.motifs.length / 10, mf.motifs.length / 10));
  add('motifs', 'share of motifs with a clipped piece', clipShare(md), clipShare(mf), '%', 'D-098 clip marks in motifs', flagShare(clipShare(md), clipShare(mf)));
  const cl = m => m.motifs.flatMap(x => x.p.filter(i => i.length > 5).map(i => i[5]));
  for (const t of [0.5, 0.9]) add('motifs', `clip depth ${t * 100}th percentile`, cm(qf(cl(md), t)), cm(qf(cl(mf), t)), 'cm', 'motif clip allowance', flagDepth(cm(qf(cl(md), t)), cm(qf(cl(mf), t))));
  const ka = new Set(md.motifs.map(x => x.key)), kb = new Set(mf.motifs.map(x => x.key));
  add('motifs', 'motif keys only in the colliders run / only in the fine run', [...ka].filter(k => !kb.has(k)).length, [...kb].filter(k => !ka.has(k)).length, 'motifs', 'motif library membership', ka.size !== kb.size || [...ka].some(k => !kb.has(k)));
  const top = m => new Set(m.motifs.filter(x => x.rank != null).sort((a, b) => b.rank - a.rank).slice(0, 100).map(x => x.key));
  const ta = top(md), tb = top(mf);
  add('motifs', 'top 100 by rank: keys shared', [...ta].filter(k => tb.has(k)).length, 100, 'motifs', 'motif library membership', false);
  if (m0) R.motifsDefaultNote = 'motifs-default is the unchanged miner on the new corpus; motifs-collider is the same code path as fine with the colliders';
}
// ---- coverage
const cvd = rd('coverage-default.json'), cvf = rd('coverage-fine.json');
if (cvd && cvf) {
  for (const side of ['corpus', 'gen']) if (cvd[side] && cvf[side]) {
    const sh = (S) => +(100 * S.filter(m => m.features && m.features.clipped).length / Math.max(1, S.length)).toFixed(1);
    add('coverage', `share of ${side} buildings with 3 or more props set into a wall`, sh(cvd[side]), sh(cvf[side]), '%', 'docs/COVERAGE.md gap "three or more props set into a wall"', flagShare(sh(cvd[side]), sh(cvf[side])));
  }
}
R.rows = rows;
if (outFile) fs.writeFileSync(outFile, JSON.stringify(R));
for (const r of rows) console.log(`| ${r.group} | ${r.measure} | ${r.old} | ${r.fine} | ${r.change == null ? '' : (r.change > 0 ? '+' : '') + r.change} ${r.unit} | ${r.feeds} | ${r.flag ? 'PAST' : ''} |`);
if (R.kitbashDecorMovers) console.log(JSON.stringify(R.kitbashDecorMovers));
