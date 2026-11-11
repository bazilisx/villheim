// node hearths.js <lib> biome type cultures... : hearth spot per culture, stage and seed
const G = require(require('path').resolve(process.argv[2], 'generate.js'));
const [, , , biome, type, ...cs] = process.argv;
for (const c of cs) for (const st of ['s1', 's2', 's3']) {
  const out = [];
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) { const d = G.generate({ type, biome, culture: c, stage: st, decor: 'd2', seed }); out.push((d.request.hearth || '?').padEnd(6)); }
  console.log(c.padEnd(16), st, out.join(' '));
}
