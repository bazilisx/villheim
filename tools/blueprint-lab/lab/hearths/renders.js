const G = require(process.cwd() + '/lib/generate.js'), BP = require(process.cwd() + '/lib/blueprint.js'), Sh = require(process.cwd() + '/lib/sheet.js'), fs = require('fs');
const out = process.argv[2];
const jobs = [];
for (const [c, b, seed] of [['norse', 'Black Forest', 2], ['frankish-norman', 'Swamp', 3], ['slavic', 'Black Forest', 1]]) {
  for (const [st, d] of [['s1', 'd1'], ['s2', 'd2'], ['s3', 'd3']]) jobs.push(['home', b, c, st, d, seed]);
  jobs.push(['longhouse', b, c, 's3', 'd3', seed]);
}
for (const [type, biome, culture, stage, decor, seed] of jobs) {
  const d = G.generate({ type, biome, culture, stage, decor, seed });
  const f = `${out}/${type}-${culture}-${stage}`;
  fs.writeFileSync(f + '.blueprint', BP.write(d));
  Sh.sheet(d.pieces, f + '.png', `${d.meta.Description} hearth ${d.request.hearth}`);
  Sh.plan(d.pieces, f + '-plan.png', { ppm: 40, cut: Sh.groundOf(d.pieces) + 1.8, title: d.meta.Name });
  console.log(f, d.request.hearth);
}
