// Runs every check on the review set and the culture samples, without drawing anything.
//   node lab/check_set.js [tries] [--gen <lib dir>] [--list] [--only <culture,...>]
// tries: seeds per request, the best kept as in lib/gen_set.js and lib/gen_cultures.js (default 8).
// --gen: make the designs with another copy of the lib (an older one, to compare), checked with this one.
// --list: print every design that fails a check, with the reason.
const path = require('path');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const tries = +(args.find(a => /^\d+$/.test(a)) || 8);
const genDir = path.resolve(opt('--gen', path.join(__dirname, '../lib')));
const only = opt('--only', null);
const G = require(path.join(genDir, 'generate.js')), S = require(path.join(genDir, 'styles.js'));
const Ch = require('../lib/checks.js'), F = require('../lib/features.js');
const scorer = require('../data/scorer.json');

const stages = [['s1', 'd1'], ['s2', 'd2'], ['s3', 'd3']];
const reqs = [];
if (!only) {
  for (const type of Object.keys(S.TYPES)) for (const biome of ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains'])
    for (const [stage, decor] of stages) reqs.push({ type, biome, stage, decor, group: 'set', seed0: 1 });
}
for (const [key, C] of Object.entries(S.CULTURES)) {
  if (!C.village || (only && !only.split(',').includes(key))) continue;
  (C.sample || ['home', 'longhouse', 'workshop']).forEach((entry, ti) => stages.forEach(([stage, decor], si) => {
    const [type, where] = entry.split('@');
    reqs.push({ type, biome: where || C.biomes[0], culture: key, stage, decor, group: 'cultures', seed0: 1 + ti * 1009 + si * 101 });
  }));
}

const fails = {}, perGroup = {};
const lines = [];
let n = 0;
for (const q of reqs) {
  let best = null;
  for (let i = 0; i < tries; i++) {
    const d = G.generate({ ...q, seed: q.seed0 + i * 37 + (q.group === 'set' ? n * 1009 : 0) });
    const checks = Ch.check(d, q.biome), pass = checks.filter(c => c.ok).length, score = F.score(scorer, d.pieces);
    if (!best || pass * 10 + score > best.key) best = { d, checks, pass, key: pass * 10 + score };
  }
  const g = perGroup[q.group] || (perGroup[q.group] = { n: 0, ok: 0 });
  g.n++;
  if (best.pass === best.checks.length) g.ok++;
  for (const c of best.checks) if (!c.ok) {
    fails[c.check] = (fails[c.check] || 0) + 1;
    lines.push(`${q.group} ${q.culture || '-'} ${q.type} ${q.biome} ${q.stage}${q.decor}: ${c.check}: ${c.detail}`);
  }
  n++;
}
for (const [k, g] of Object.entries(perGroup)) console.log(`${k}: ${g.ok} of ${g.n} pass every check`);
console.log('failed checks:', JSON.stringify(fails));
if (args.includes('--list')) console.log(lines.join('\n'));
