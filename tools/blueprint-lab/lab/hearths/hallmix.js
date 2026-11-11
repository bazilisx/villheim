// Where the fire stands in longhouses and taverns (corpus: halls and taverns over 80 m2, middle 32 %).
// node lab/hearths/hallmix.js lib
const path = require('path');
const LIB = path.resolve(process.argv[2] || 'lib');
const G = require(path.join(LIB, 'generate.js')), S = require(path.join(LIB, 'styles.js'));
const t = {}; let n = 0, mid = 0;
for (const type of ['longhouse', 'tavern']) for (const [k, C] of Object.entries(S.CULTURES)) {
  if (!C.village) continue;
  for (let seed = 1; seed <= 6; seed++) for (const st of ['s2', 's3']) {
    const d = G.generate({ type, biome: C.biomes[0], culture: k, stage: st, decor: 'd1', seed, skipDecor: true });
    const a = d.rooms.find(r => r.main), ar = a ? (a.x1 - a.x0) * (a.z1 - a.z0) : 0;
    const h = d.request.hearth || 'round';
    if (ar > 80 && h !== 'round') { n++; if (h === 'middle') mid++; }
    const key = `${h}${d.request.hearthWhy ? ` (${d.request.hearthWhy})` : ''}`; t[key] = (t[key] || 0) + 1;
  }
}
console.log(t);
console.log('over 80 m2, not round:', n, 'middle', `${(100 * mid / n).toFixed(0)}%`);
