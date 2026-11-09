// Furniture per 10 m2 by room role, the decorator against the corpus.
// node lab/interior_density.js [seeds per request]
// Pieces counted as the learner counts them: everything the decorator places in a room except rugs.
const G = require('../lib/generate.js'), D = require('../lib/decorate.js');
const L = require('../data/interior-lite.json');
const seeds = +(process.argv[2] || 3);
const types = ['home', 'longhouse', 'tavern', 'smithy', 'sawmill', 'workshop', 'storage', 'tower', 'temple', 'barn'];
const biomes = ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains', 'Mistlands'];
const LEARN_KIND = { home: 'home', sleeping: 'sleeping', guest: 'sleeping', hall: 'hall', tavern: 'tavern', temple: 'hall', smithy: 'smithy', workshop: 'workshop', storage: 'storage', guard: 'sleeping', farm: 'storage', kitchen: 'kitchen', market: 'living' };
const acc = {};
let n = 0;
for (const type of types) for (const biome of biomes) for (const decor of ['d1', 'd2', 'd3']) for (let s = 0; s < seeds; s++) {
  const stage = decor === 'd1' ? 's1' : decor === 'd2' ? 's2' : 's3';
  const d = G.generate({ type, biome, stage, decor, seed: 5 + s * 131 + n++ });
  const b = { pieces: d.pieces.filter(p => !p.decor), rooms: d.rooms };
  let r = 7 + n;
  D.decorate(b, { use: require('../lib/styles.js').TYPES[type].use, type, decor, biome, culture: d.request.cultureKey, R: () => { r = (r * 16807) % 2147483647; return r / 2147483647; } });
  for (const rep of b.decorReport || []) {
    if (rep.area < 8) continue;
    const k = rep.role + '|' + decor;
    acc[k] = acc[k] || [];
    acc[k].push(rep.items / rep.area * 10);
  }
}
const q = (a, t) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * t))]; };
console.log('role'.padEnd(10), 'decor', 'rooms', 'median', ' corpus p25/p50/p75 (learned kind)');
for (const k of Object.keys(acc).sort()) {
  const [role, decor] = k.split('|');
  const c = (L.rooms[LEARN_KIND[role]] || {}).perTenM2 || [];
  console.log(role.padEnd(10), decor.padEnd(5), String(acc[k].length).padStart(5), q(acc[k], 0.5).toFixed(2).padStart(6), '  ', c.join(' / '), `(${LEARN_KIND[role]})`);
}
