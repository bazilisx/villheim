// Generate the review set: node lib/gen_set.js <out dir> [tries]
// Every building type in five biomes at s1d1, s2d2 and s3d3, plus a showcase of the non-Norse styles.
// Each design is the best of several seeds: most checks passed, then the highest keep score.
const fs = require('fs'), path = require('path');
const { createCanvas } = require('@napi-rs/canvas');
const G = require('./generate.js'), BP = require('./blueprint.js'), Sh = require('./sheet.js'), R = require('./render.js');
const Ch = require('./checks.js'), F = require('./features.js'), S = require('./styles.js');
const scorer = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/scorer.json'), 'utf8'));
const K = require('./critic.js'), critic = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/critic.json'), 'utf8'));
const out = process.argv[2], tries = +(process.argv[3] || 8);
const reqs = [];
const stages = [['s1', 'd1'], ['s2', 'd2'], ['s3', 'd3']];
for (const type of Object.keys(S.TYPES)) for (const biome of ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains'])
  for (const [stage, decor] of stages) reqs.push({ type, biome, stage, decor, group: biome });
for (const [culture, biome] of [['middle-eastern', 'Black Forest'], ['east-asian', 'Swamp'], ['castle-medieval', 'Plains'], ['celtic', 'Meadows'], ['slavic', 'Black Forest'], ['dwarven', 'Mistlands']])
  for (const type of ['home', 'tavern', 'smithy', 'storage']) for (const [stage, decor] of stages.slice(1)) reqs.push({ type, biome, culture, stage, decor, group: 'styles/' + culture });
const rows = [];
let n = 0;
for (const q of reqs) {
  let best = null;
  for (let i = 0; i < tries; i++) {
    const d = G.generate({ ...q, seed: 1 + i * 37 + n * 1009 });
    const checks = Ch.check(d, q.biome), pass = checks.filter(c => c.ok).length, score = 0.4 * F.score(scorer, d.pieces) + 0.6 * K.score(critic, d.pieces, q.stage);
    if (!best || pass * 10 + score > best.key) best = { d, checks, pass, score, key: pass * 10 + score };
  }
  const d = best.d, dir = path.join(out, q.group, q.type);
  fs.mkdirSync(dir, { recursive: true });
  const base = path.join(dir, d.meta.Name);
  fs.writeFileSync(base + '.blueprint', BP.write(d));
  const c = createCanvas(256, 256); R.draw(c.getContext('2d'), d.pieces, { az: 35, el: 28, width: 256, height: 256 });
  fs.writeFileSync(base + '.png', c.toBuffer('image/png')); // PlanBuild shows a png of the same name as the icon
  Sh.sheet(d.pieces, base + '-views.png', `${d.meta.Description} (${d.pieces.length} pieces)`, 360);
  rows.push({ name: d.meta.Name, file: path.relative(out, base + '.blueprint'), type: q.type, biome: q.biome, culture: d.request.cultureKey,
    plan: d.request.plan || '', roof: d.request.roof || '', walls: d.request.walls || '', stage: q.stage, decor: q.decor,
    pieces: d.pieces.length, score: +best.score.toFixed(3), checks: `${best.pass}/${best.checks.length}`, notes: d.notes.join(' ') });
  n++;
  if (n % 25 === 0) console.log(n, '/', reqs.length);
}
fs.writeFileSync(path.join(out, 'generated.json'), JSON.stringify(rows, null, 1));
const csv = [Object.keys(rows[0]).join(','), ...rows.map(r => Object.values(r).map(v => JSON.stringify(v)).join(','))].join('\n');
fs.writeFileSync(path.join(out, 'generated.csv'), csv);
console.log('done', rows.length, 'all checks passed:', rows.filter(r => r.checks.split('/')[0] === r.checks.split('/')[1]).length);
