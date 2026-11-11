// Where the home fire stands, by culture, form, plan and roof, and the share against a wall in homes under 120 m2
// (corpus: docs/INTERIOR_DESIGN.md, "Hearths and lights in the corpus"). Same homes as spotshare.js: every village
// culture, its first two biomes, seeds 1 to 6, s1 to s3, d1.
// node lab/hearths/spotmix.js lib [seeds]
const path = require('path');
const LIB = path.resolve(process.argv[2] || 'lib'), SEEDS = +process.argv[3] || 6;
const G = require(path.join(LIB, 'generate.js')), S = require(path.join(LIB, 'styles.js'));
const rows = [];
for (const [key, C] of Object.entries(S.CULTURES)) {
  if (!C.village) continue;
  for (const biome of C.biomes.slice(0, 2)) for (let seed = 1; seed <= SEEDS; seed++) {
    const line = [];
    for (const st of ['s1', 's2', 's3']) {
      const d = G.generate({ type: 'home', biome, culture: key, stage: st, decor: 'd1', seed, skipDecor: true });
      const r = d.request;
      const area = d.rooms.reduce((a, o) => a + (o.x1 - o.x0) * (o.z1 - o.z0), 0);
      const h = r.hearth || 'round';
      const shape = ['round', 'tent', 'yurt'].includes(r.form) || r.plan === 'octagon' ? 'round' : r.form || `${r.plan}/${r.roof}`;
      const row = { culture: key, biome, seed, stage: st, form: r.form || '', plan: r.plan, roof: r.roof, walls: r.walls, hearth: h, why: r.hearthWhy || '', moved: !!r.hearthMoved, area, shape };
      rows.push(row); line.push(row);
    }
  }
}
const pct = (a, n) => n ? `${(100 * a / n).toFixed(0)}%` : '-';
const share = (rs, f) => { const t = {}; for (const r of rs) { const k = f(r); t[k] = (t[k] || 0) + 1; } return Object.entries(t).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v, rs.length)}`).join(', '); };
const wall = r => !['middle', 'round'].includes(r.hearth);
console.log('homes', rows.length, share(rows, r => r.hearth));
const sq = rows.filter(r => r.hearth !== 'round');
console.log('not round', sq.length, 'middle', pct(sq.filter(r => r.hearth === 'middle').length, sq.length));
const small = sq.filter(r => r.area < 120);
console.log('under 120 m2 (not round)', small.length, 'against a wall', pct(small.filter(wall).length, small.length));
for (const st of ['s1', 's2', 's3']) { const s = rows.filter(r => r.stage === st); console.log(st, share(s, r => r.hearth)); }
const mid = rows.filter(r => r.hearth === 'middle');
console.log('\nmiddle fires by reason:', share(mid, r => r.why || '?'));
console.log('middle by shape:', share(mid, r => r.shape));
console.log('middle by culture:', share(mid, r => r.culture));
const byLine = {};
for (const r of rows) (byLine[`${r.culture}|${r.biome}|${r.seed}`] = byLine[`${r.culture}|${r.biome}|${r.seed}`] || []).push(r);
const lines = Object.values(byLine);
const kind = h => h === 'stack' ? 'end' : h;
console.log('\nlines', lines.length, 'fire changes kind s1-s2', lines.filter(l => kind(l[0].hearth) !== kind(l[1].hearth)).length,
  's2-s3', lines.filter(l => kind(l[1].hearth) !== kind(l[2].hearth)).length, 'moved (planned)', rows.filter(r => r.moved).length);
if (process.argv[4] === 'rows') for (const r of mid) console.log(JSON.stringify(r));
