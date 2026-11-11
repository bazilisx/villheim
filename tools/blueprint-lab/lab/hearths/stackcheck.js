const path = require('path');
const LIB = path.resolve(process.argv[2]);
const G = require(path.join(LIB, 'generate.js')), Ch = require(path.join(LIB, 'checks.js'));
const by = {}, lines = [];
for (const culture of ['anglo-saxon', 'frankish-norman', 'castle-medieval', 'norse', 'baltic', 'slavic']) for (const biome of ['Swamp', 'Mountain', 'Plains']) for (const stage of ['s2', 's3']) for (let seed = 1; seed <= 6; seed++) {
  const d = G.generate({ type: 'home', biome, culture, stage, decor: 'd2', seed });
  const spot = d.request.hearth || 'round';
  const bad = Ch.check(d, biome, {}).filter(c => !c.ok);
  by[spot] = by[spot] || { n: 0, ok: 0 }; by[spot].n++; if (!bad.length) by[spot].ok++;
  for (const c of bad) lines.push(`${spot} ${culture} ${biome} ${stage} ${seed}: ${c.check}: ${c.detail}`);
}
console.log(JSON.stringify(by)); console.log(lines.join('\n'));
