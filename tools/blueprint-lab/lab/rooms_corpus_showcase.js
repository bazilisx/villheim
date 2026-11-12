// The 16 showcase designs as the game makes them ('vh gen showcase', src/Villheim.Logic/Generator/GenCommands.cs
// ShowcaseList: LabEngine.Make with one try of the seed), written as one compact line each so lab/rooms_corpus_extract.js
// and lab/rooms_corpus_stats.js read them like corpus builds.
//   node lab/rooms_corpus_showcase.js <out.jsonl> [blueprint dir]
const fs = require('fs'), path = require('path');
const lab = path.join(__dirname, '..');
const Q = require(lab + '/lib/request.js'), BP = require(lab + '/lib/blueprint.js');
const scorer = JSON.parse(fs.readFileSync(path.join(lab, 'data/scorer.json'), 'utf8'));
const rules = JSON.parse(fs.readFileSync(path.join(lab, 'data/rules.json'), 'utf8'));
const LIST = [
  ['hub', 'md', 'norse', 's5d3', 2], ['hub', 'pl', 'byzantine', 's5d3', 1], ['hub', 'bf', 'celtic', 's4d3', 2], ['temple', 'ml', 'byzantine', 's3d3', 1],
  ['longhouse', 'bf', 'norse-forest', 's3d3', 3], ['tavern', 'pl', 'byzantine', 's3d3', 1], ['tavern', 'pl', 'steppe', 's3d3', 2], ['home', 'pl', 'middle-eastern', 's3d3', 1],
  ['home', 'sw', 'baltic', 's3d3', 2], ['home', 'bf', 'slavic', 's3d3', 3], ['home', 'md', 'anglo-saxon', 's2d3', 2], ['home', 'ml', 'lamari', 's2d3', 2],
  ['smithy', 'mt', 'norse-highland', 's2d3', 1], ['tower', 'mt', 'norse-highland', 's3d3', 1], ['workshop', 'al', 'castle-medieval', 's2d3', 3], ['home', 'al', 'castle-medieval', 's3d3', 1],
];
const [out, bpDir] = process.argv.slice(2);
if (!out) { console.error('usage: node lab/rooms_corpus_showcase.js <out.jsonl> [blueprint dir]'); process.exit(1); }
const yawOf = q => Math.atan2(2 * (q[3] * q[1] + q[0] * q[2]), 1 - 2 * (q[1] * q[1] + q[0] * q[0])) * 180 / Math.PI;
const lines = [];
LIST.forEach(([type, biome, culture, stage, seed], i) => {
  const r = Q.make({ type, biome, culture, stage, seed, tries: 1 }, scorer, rules);
  if (r.error) { console.error(type, r.error); return; }
  const name = `showcase-${String(i + 1).padStart(2, '0')}-${type}-${biome}-${culture}-${stage}-${seed}`;
  if (bpDir) { fs.mkdirSync(bpDir, { recursive: true }); fs.writeFileSync(path.join(bpDir, name + '.blueprint'), r.blueprint); }
  const d = BP.parse(r.blueprint);
  lines.push(JSON.stringify({ file: 'showcase/' + name + '.blueprint', title: name, cat: 'showcase ' + type, dls: 0, votes: 0, verdict: '',
    p: d.pieces.map(p => [p.name, +p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3), +yawOf(p.q).toFixed(1)]) }));
  console.log(name, r.pieces, 'pieces');
});
fs.writeFileSync(out, lines.join('\n') + '\n');
