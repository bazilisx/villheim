// How much of a design's decor stays when it grows a decor stage (D-071): the same request and seed at d1, d2 and d3,
// and the share of d1's decor pieces found in d2 (same prefab, same place within 5 cm, same turn within 3 degrees), and
// of d2's in d3. node lab/stages.js [lib dir] [seeds] [--list]
const path = require('path');
const flags = process.argv.filter(a => /^--/.test(a));
process.argv = process.argv.filter(a => !/^--/.test(a));
const libDir = path.resolve(process.argv[2] || path.join(__dirname, '../lib'));
const seeds = +(process.argv[3] || 2);
const G = require(path.join(libDir, 'generate.js'));
const types = ['home', 'longhouse', 'tavern', 'smithy', 'sawmill', 'workshop', 'barn', 'farm', 'storage', 'tower', 'dock', 'temple'];
const biomes = ['Meadows', 'Black Forest', 'Swamp', 'Plains'];
const key = p => `${p.name}|${Math.round(p.x * 20)}|${Math.round(p.y * 20)}|${Math.round(p.z * 20)}`;
const yawOf = p => (p.yaw != null ? p.yaw : Math.atan2(2 * p.q[1] * p.q[3], 1 - 2 * p.q[1] * p.q[1]) * 180 / Math.PI);
function share(lo, hi) {
  const map = new Map();
  for (const p of hi) { const k = key(p); if (!map.has(k)) map.set(k, []); map.get(k).push(p); }
  let n = 0;
  const lost = [];
  for (const p of lo) {
    const l = map.get(key(p)) || [];
    const i = l.findIndex(q => Math.abs(((yawOf(q) - yawOf(p)) % 360 + 540) % 360 - 180) < 3);
    if (i >= 0) { l.splice(i, 1); n++; } else lost.push(p.name);
  }
  return { n, of: lo.length, lost };
}
const tot = { a: 0, an: 0, b: 0, bn: 0 }, lostA = {}, lostB = {};
let ms = 0, k = 0;
for (const type of types) for (const biome of biomes) for (const stage of ['s2', 's3']) for (let s = 0; s < seeds; s++) {
  const seed = 5 + s * 131 + k++;
  const t0 = Date.now();
  const d = ['d1', 'd2', 'd3'].map(decor => G.generate({ type, biome, stage, decor, seed }).pieces.filter(p => p.decor));
  ms += Date.now() - t0;
  const a = share(d[0], d[1]), b = share(d[1], d[2]);
  tot.a += a.n; tot.an += a.of; tot.b += b.n; tot.bn += b.of;
  for (const n of a.lost) lostA[n] = (lostA[n] || 0) + 1;
  for (const n of b.lost) lostB[n] = (lostB[n] || 0) + 1;
  if (flags.includes('--list')) console.log(`${type} ${biome} ${stage} ${seed}: d1 in d2 ${a.n}/${a.of}, d2 in d3 ${b.n}/${b.of}`);
}
const top = o => Object.entries(o).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([n, c]) => `${n} ${c}`).join(', ');
console.log(`${k} requests at d1, d2 and d3 from ${libDir}, ${(ms / k / 3).toFixed(0)} ms a design`);
console.log(`d1 in d2: ${tot.a} of ${tot.an} (${(100 * tot.a / Math.max(1, tot.an)).toFixed(0)} %); lost most: ${top(lostA)}`);
console.log(`d2 in d3: ${tot.b} of ${tot.bn} (${(100 * tot.b / Math.max(1, tot.bn)).toFixed(0)} %); lost most: ${top(lostB)}`);
