// node homecheck.js <lib dir> [seeds] : single-seed homes over cultures, biomes and stages; checks per hearth spot
const path = require('path');
const LIB = path.resolve(process.argv[2]);
const G = require(path.join(LIB, 'generate.js')), S = require(path.join(LIB, 'styles.js'));
const Ch = require(path.join(LIB, 'checks.js'));
const seeds = +(process.argv[3] || 4);
const by = {}, fails = {}, lines = [];
let n = 0, ok = 0;
for (const [key, C] of Object.entries(S.CULTURES)) {
  if (!C.village) continue;
  for (const biome of C.biomes.slice(0, 2)) for (const stage of ['s1', 's2', 's3']) for (let seed = 1; seed <= seeds; seed++) {
    const d = G.generate({ type: 'home', biome, culture: key, stage, decor: stage === 's1' ? 'd1' : stage === 's2' ? 'd2' : 'd3', seed: seed * 13 + 1 });
    const spot = d.request.hearth || 'round';
    const cs = Ch.check(d, biome, {});
    const bad = cs.filter(c => !c.ok);
    by[spot] = by[spot] || { n: 0, ok: 0 }; by[spot].n++; n++;
    if (!bad.length) { by[spot].ok++; ok++; }
    for (const c of bad) { fails[`${spot}:${c.check}`] = (fails[`${spot}:${c.check}`] || 0) + 1; lines.push(`${spot} ${key} ${biome} ${stage} ${seed * 13 + 1}: ${c.check}: ${c.detail}`); }
  }
}
console.log(ok, 'of', n, 'pass;', JSON.stringify(by));
console.log(JSON.stringify(fails));
if (process.argv.includes('--list')) console.log(lines.join('\n'));
