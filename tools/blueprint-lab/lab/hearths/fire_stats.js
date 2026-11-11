const d = require(process.argv[2]);
const pct = (a, n) => a.length ? (100 * a.filter(n).length / a.length).toFixed(0) + '%' : '-';
const q = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2); };
const tab = (rows, key, val) => { const m = {}; for (const r of rows) { const k = key(r); m[k] = m[k] || {}; const v = val(r); m[k][v] = (m[k][v] || 0) + 1; } return m; };
const F = d.fires.filter(f => f.indoor && f.name !== 'piece_oven' && f.name !== 'bonfire');
console.log('fires', d.fires.length, 'indoor', F.length, 'builds', d.builds.length, 'builds with indoor fire', new Set(F.map(f => f.file)).size);
const bucket = f => f.room < 30 ? 'room<30' : f.room < 70 ? 'room30-70' : 'room70+';
const place = f => f.place;
const show = (t) => { for (const [k, v] of Object.entries(t)) { const n = Object.values(v).reduce((a, b) => a + b, 0); console.log('  ', k.padEnd(10), n, Object.entries(v).sort((a, b) => b[1] - a[1]).map(([x, c]) => `${x} ${(100 * c / n).toFixed(0)}%`).join(', ')); } };
console.log('place by build kind'); show(tab(F, f => f.kind, place));
console.log('place by room size'); show(tab(F, bucket, place));
console.log('home fires: place by room size'); show(tab(F.filter(f => f.kind === 'home'), bucket, place));
console.log('fire prefab by kind'); show(tab(F, f => f.kind, f => f.name));
const vk = f => typeof f.vent === 'string' ? f.vent : f.vent.kind.replace(/gap [\d.]+ m/, f.vent.kind.match(/gap ([\d.]+)/) && +f.vent.kind.match(/gap ([\d.]+)/)[1] <= 1.5 ? 'gap<=1.5m' : 'gap 2-4m');
const wallish = f => ['wall', 'corner', 'alcove', 'in-wall'].includes(f.place);
console.log('vent by place'); show(tab(F, place, vk));
console.log('vent by kind'); show(tab(F, f => f.kind, vk));
for (const [nm, set] of [['wallish', F.filter(wallish)], ['middle', F.filter(f => f.place === 'middle')], ['near-wall', F.filter(f => f.place === 'near-wall')]]) {
  console.log(nm, set.length, 'stone around', pct(set, f => f.stone > 0), 'stone>=4', pct(set, f => f.stone >= 4), 'mantel beam', pct(set, f => f.mantel), 'hood', pct(set, f => typeof f.vent !== 'string' && /hood/.test(f.vent.kind)),
    'cook', pct(set, f => f.cook.length), 'woodpile<3.5m', pct(set, f => f.wood > 0), 'raised>0.25', pct(set, f => f.raised > 0.25), 'stone under', pct(set, f => f.under && /stone|marble|grausten/.test(f.under)),
    'seats<4m med', q(set.map(f => f.seats), 0.5), 'lights<4m med', q(set.map(f => f.fireLights), 0.5), 'door dist med', q(set.map(f => f.door), 0.5), 'room med', q(set.map(f => f.room), 0.5));
}
// lights per 10 m2 by build kind
const B = d.builds.filter(b => b.area >= 20);
console.log('lights per 10 m2 of covered floor (builds with >= 20 m2): p25 / p50 / p75');
for (const k of ['home', 'hall', 'tavern', 'temple', 'castle', 'work', 'village', 'other']) {
  const bs = B.filter(b => b.kind === k); if (!bs.length) continue;
  const per = kk => bs.map(b => 10 * (kk === 'all' ? Object.values(b.lights).reduce((x, y) => x + y, 0) : b.lights[kk]) / b.area);
  console.log('  ', k.padEnd(8), bs.length, ['all', 'wall', 'hang', 'floor', 'small'].map(kk => `${kk} ${q(per(kk), 0.25)}/${q(per(kk), 0.5)}/${q(per(kk), 0.75)} (${pct(bs, b => kk === 'all' ? Object.values(b.lights).some(v => v) : b.lights[kk] > 0)} use)`).join('  '));
}
const L = d.lights;
console.log('indoor lights', L.length);
show(tab(L, l => l.lk, l => l.name));
for (const k of ['wall', 'hang', 'floor', 'small']) {
  const s = L.filter(l => l.lk === k);
  console.log(k, s.length, 'h p10/50/90', q(s.map(l => l.h), 0.1), q(s.map(l => l.h), 0.5), q(s.map(l => l.h), 0.9), 'by door<1.5', pct(s, l => l.door < 1.5), 'by bed<1.5', pct(s, l => l.bed < 1.5), 'on table', pct(s, l => l.onTable), 'by table<1.5', pct(s, l => l.table < 1.5), 'sill', pct(s, l => l.sill), 'fire<3', pct(s, l => l.fire < 3));
}
// spacing: nearest same-kind light in the same build and floor; CV of those distances per build
for (const k of ['wall', 'floor', 'hang']) {
  const byB = new Map(); for (const l of L.filter(l => l.lk === k)) { const key = l.file + '|' + Math.round(l.ft); if (!byB.has(key)) byB.set(key, []); byB.get(key).push(l); }
  const nn = [], cvs = [];
  for (const [, ls] of byB) { if (ls.length < 3) continue; const ds = ls.map(a => Math.min(...ls.filter(b => b !== a).map(b => Math.hypot(a.x - b.x, a.z - b.z)))); nn.push(...ds); const m = ds.reduce((x, y) => x + y, 0) / ds.length; const sd = Math.sqrt(ds.reduce((x, y) => x + (y - m) ** 2, 0) / ds.length); cvs.push(sd / m); }
  console.log(k, 'nearest same-kind light m p25/50/75', q(nn, 0.25), q(nn, 0.5), q(nn, 0.75), 'per-floor CV of spacing p50', q(cvs, 0.5), 'floors', cvs.length);
}
