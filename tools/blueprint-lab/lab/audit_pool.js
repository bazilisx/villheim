// Audits a folder of blueprints against the defects found in game tests (lib/audit.js says what each measure is).
// Reads the files only; changes nothing.
//
// Usage, from tools/blueprint-lab: node lab/audit_pool.js <folder> [--json out.json] [--list] [--gate]
// A test pool's files (<culture>-<line>_s#d#.blueprint) are read as lines; any other .blueprint file is audited alone.
// --gate: exit 1 when any gated measure is above zero (make_testpool.js runs it so; the game's 'vh testpool make' runs
// the same audit from the bundle). Each new defect from a game test becomes a measure in lib/audit.js.
const fs = require('fs'), path = require('path');
const B = require('../lib/blueprint.js'), A = require('../lib/audit.js');

const dir = process.argv[2];
if (!dir) { console.error('usage: node lab/audit_pool.js <folder> [--json out.json] [--list] [--gate]'); process.exit(1); }
const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
const list = process.argv.includes('--list');
const files = {};
for (const f of fs.readdirSync(dir).filter(f => /\.blueprint$/.test(f)).sort()) files[f] = fs.readFileSync(path.join(dir, f), 'utf8');
const report = A.pool(A.group(files, B.parse), dir);
const tot = report.totals;

if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(report, null, 1));
console.log(`${report.designs} designs in ${Object.keys(report.lines).length} lines`);
console.log('totals:', JSON.stringify(tot));
for (const [line, L] of Object.entries(report.lines)) {
  console.log(`\n${line}`);
  console.log('  lineage:', Object.entries(L.lineage).map(([k, v]) => `${k} ${v}`).join(', '));
  console.log('  shape:', Object.entries(L.shape || {}).map(([k, v]) => `${k} ${v}`).join(', '));
  const broken = Object.entries(L.nest).filter(([, v]) => v !== 'ok');
  console.log('  decor nesting:', broken.length ? broken.map(([k, v]) => `${k}: ${v}`).join('; ') : 'ok at every stage');
  console.log('  beds at d1:', JSON.stringify(L.beds));
  if (L.storage) for (const [s, v] of Object.entries(L.storage)) if (list || /d3$/.test(s)) console.log(`  storage ${s}: ${v}`);
  for (const [s, f] of Object.entries(L.issues)) if (list || /d3$/.test(s) || /s1d1/.test(s)) for (const x of f) console.log(`  ${s} ${x}`);
}
console.log('\nfurniture likeness between home lines (1 = same list):', JSON.stringify(report.same));
if (report.rich) console.log(`\nrichness (floors in lib/audit.js RICH_FLOOR): ${Object.entries(report.rich).map(([k, v]) => `${k} ${v}`).join(', ')}${report.richLow && report.richLow.length ? `; UNDER: ${report.richLow.join('; ')}` : ''}`);
console.log(`\nwatched (not gated yet): ${Object.entries(report.watch).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(report.failed.length ? `GATE: fail (${report.failed.map(k => `${k} ${tot[k]}`).join(', ')})` : 'GATE: pass');
if (process.argv.includes('--gate') && report.failed.length) process.exitCode = 1;
