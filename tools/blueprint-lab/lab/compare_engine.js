// Same requests through the lab in node, compared with the game's engine (tools/gen-test):
// node lab/compare_engine.js <requests.txt> <C# out dir> <node out dir> [tries]
// Writes <node out>/<n>.blueprint and reports, per request, whether the two files are the same byte for byte, and if
// not, how many pieces differ.
const fs = require('fs'), path = require('path');
const Q = require('../lib/request.js'), BP = require('../lib/blueprint.js');
const scorer = require('../data/scorer.json'), rules = require('../data/rules-lite.json');
const [list, csDir, out, triesArg] = process.argv.slice(2);
const tries = +triesArg || 8;
fs.mkdirSync(out, { recursive: true });
let n = 0, same = 0, bad = 0;
for (const raw of fs.readFileSync(list, 'utf8').split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line[0] === '#') continue;
  const [type, biome, culture, stage, words, seed] = line.split('|');
  n++;
  const r = Q.make({ type, biome, culture: culture || undefined, stage, words, seed: +seed, tries }, scorer, rules);
  if (r.error) { console.log(`${n}: node error ${r.error}`); bad++; continue; }
  const file = path.join(out, n + '.blueprint');
  fs.writeFileSync(file, r.blueprint);
  const other = path.join(csDir, n + '.blueprint');
  if (!fs.existsSync(other)) { console.log(`${n}: ${r.name}: no C# file`); bad++; continue; }
  const a = fs.readFileSync(file, 'utf8'), b = fs.readFileSync(other, 'utf8');
  if (a === b) { same++; console.log(`${n}: ${r.name}: same (${r.pieces} pieces, ${a.length} bytes)`); continue; }
  bad++;
  const pa = BP.parse(a).pieces, pb = BP.parse(b).pieces;
  const key = p => [p.name, p.x, p.y, p.z, ...p.q].join(';');
  const sb = new Set(pb.map(key)), sa = new Set(pa.map(key));
  console.log(`${n}: ${r.name}: DIFFERENT: node ${pa.length} pieces, C# ${pb.length}; ${pa.filter(p => !sb.has(key(p))).length} only in node, ${pb.filter(p => !sa.has(key(p))).length} only in C#`);
}
console.log(`${same} of ${n} the same byte for byte`);
process.exit(bad ? 1 : 0);
