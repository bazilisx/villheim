const G = require(process.cwd() + '/lib/generate.js'), BP = require(process.cwd() + '/lib/blueprint.js'), Sh = require(process.cwd() + '/lib/sheet.js'), fs = require('fs');
const out = process.argv[2];
const jobs = [];
// node lab/hearths/renders.js <out dir> [round2]: round2 renders the forms checked in round 2 (gable rows, Svan, a
// court house, a longhouse with an end hearth, a Meadows stone stack under D-131)
if (process.argv[3] === 'round2') {
  for (const st of ['s1', 's2', 's3']) jobs.push(['home', 'Mountain', 'norse-highland', st, 'd' + st[1], 1]);
  jobs.push(['home', 'Mistlands', 'lamari', 's2', 'd2', 1], ['home', 'Plains', 'middle-eastern', 's3', 'd3', 1],
    ['longhouse', 'Meadows', 'norse', 's3', 'd3', 12], ['home', 'Meadows', 'frankish-norman', 's3', 'd3', 8]);
} else for (const [c, b, seed] of [['norse', 'Black Forest', 2], ['frankish-norman', 'Swamp', 3], ['slavic', 'Black Forest', 1]]) {
  for (const [st, d] of [['s1', 'd1'], ['s2', 'd2'], ['s3', 'd3']]) jobs.push(['home', b, c, st, d, seed]);
  jobs.push(['longhouse', b, c, 's3', 'd3', seed]);
}
for (const [type, biome, culture, stage, decor, seed] of jobs) {
  const d = G.generate({ type, biome, culture, stage, decor, seed });
  const f = `${out}/${type}-${culture}-${stage}-${seed}`;
  fs.writeFileSync(f + '.blueprint', BP.write(d));
  Sh.sheet(d.pieces, f + '.png', `${d.meta.Description} hearth ${d.request.hearth}`);
  Sh.plan(d.pieces, f + '-plan.png', { ppm: 40, cut: Sh.groundOf(d.pieces) + 1.8, title: d.meta.Name });
  console.log(f, d.request.hearth);
}
