// Middle home fires by the size of the main room (corpus: corpus-hearths-lights.json homePlaceByServedRoom, the room
// measured from 2.5 m in front of the fire: middle 3 of 137 under 35 m2, 0 of 67 at 35 to 80 m2, 74 of 325 over 80).
// Same homes as spotmix.js: every village culture, its first two biomes, seeds 1 to N, s1 to s3, d1.
// node lab/hearths/roommix.js lib [seeds] [rows]
const path = require('path');
const LIB = path.resolve(process.argv[2] || 'lib'), SEEDS = +process.argv[3] || 6;
const G = require(path.join(LIB, 'generate.js')), S = require(path.join(LIB, 'styles.js'));
const rows = [];
for (const [key, C] of Object.entries(S.CULTURES)) {
  if (!C.village) continue;
  for (const biome of C.biomes.slice(0, 2)) for (let seed = 1; seed <= SEEDS; seed++) for (const st of ['s1', 's2', 's3']) {
    const d = G.generate({ type: 'home', biome, culture: key, stage: st, decor: 'd1', seed, skipDecor: true });
    const r = d.request;
    const m = d.rooms.find(o => o.main) || d.rooms[0];
    const room = m ? (m.x1 - m.x0) * (m.z1 - m.z0) : 0;
    const h = r.hearth || 'round';
    const shape = ['round', 'tent', 'yurt'].includes(r.form) || r.plan === 'octagon' ? 'round' : r.form || `${r.plan}/${r.roof}`;
    rows.push({ culture: key, biome, seed, stage: st, shape, hearth: h, why: r.hearthWhy || '', room });
  }
}
const band = a => a < 35 ? '<35' : a < 80 ? '35-80' : '80+';
const pct = (a, n) => n ? `${(100 * a / n).toFixed(0)}%` : '-';
const sq = rows.filter(r => r.hearth !== 'round');
for (const b of ['<35', '35-80', '80+']) {
  const s = sq.filter(r => band(r.room) === b), mid = s.filter(r => r.hearth === 'middle');
  const t = {}; for (const r of mid) { const k = `${r.shape} (${r.why})`; t[k] = (t[k] || 0) + 1; }
  console.log(b, 'homes', s.length, 'middle', mid.length, pct(mid.length, s.length), Object.entries(t).sort((a, c) => c[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
}
if (process.argv[4] === 'rows') for (const r of sq.filter(r => r.hearth === 'middle')) console.log(JSON.stringify(r));
