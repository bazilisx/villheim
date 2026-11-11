// Checks the lab page builds what node builds: node lab/compare_page.js [page.html] [requests JSON] [tries]
// Runs the page's library script (web/index.html by default) in a vm with a window shim and compares VHRequest.best on
// seven requests, two of them hubs (or the JSON list given) with node's lib/request.js best: seed, name and every piece.
const fs = require('fs'), vm = require('vm'), path = require('path');
const LAB = path.join(__dirname, '..');
const html = fs.readFileSync(process.argv[2] || path.join(LAB, 'web/index.html'), 'utf8');
const s = html.indexOf('<script>') + 8, e = html.indexOf('</script>', s);
const code = html.slice(s, e);
const win = { console, Math, JSON, Date };
win.window = win;
const ctx = vm.createContext(win);
vm.runInContext(code, ctx, { filename: 'page.js' });
const SCORER = JSON.parse(fs.readFileSync(path.join(LAB, 'data/scorer.json'), 'utf8'));
const Q = require(path.join(LAB, 'lib/request.js'));
const reqs = JSON.parse(process.argv[3] || 'null') || [
  { type: 'home', culture: 'norse', biome: 'Meadows', stage: 's1', decor: 'd3', seed: 7 },
  { type: 'longhouse', culture: 'norse-forest', biome: 'Black Forest', stage: 's3', decor: 'd2', seed: 7 },
  { type: 'tavern', culture: 'middle-eastern', biome: 'Plains', stage: 's2', decor: 'd3', seed: 11 },
  { type: 'smithy', culture: undefined, biome: 'Mountain', stage: 's2', decor: 'd1', seed: 5 },
  { type: 'storage', culture: undefined, biome: 'Swamp', stage: 's1', decor: 'd2', seed: 3 },
  { type: 'hub', culture: 'norse', biome: 'Meadows', stage: 's5', decor: 'd2', seed: 3 },
  { type: 'hub', culture: 'celtic', biome: 'Black Forest', stage: 's4', decor: 'd3', seed: 2 },
];
const tries = +process.argv[4] || 8;
let bad = 0;
for (const r of reqs) {
  const a = Q.best({ ...r }, tries, SCORER);
  const b = win.VHRequest.best(JSON.parse(JSON.stringify({ ...r, lineage: r.seed })), tries, SCORER);
  const pa = a.d.pieces.length, pb = b.d.pieces.length;
  const na = a.d.meta.Name, nb = b.d.meta.Name;
  const same = pa === pb && na === nb && a.seed === b.seed && JSON.stringify(a.d.pieces) === JSON.stringify(b.d.pieces);
  if (!same) bad++;
  console.log(`${r.type} ${r.biome} ${r.stage}${r.decor}: node ${pa} "${na}" seed ${a.seed} | page ${pb} "${nb}" seed ${b.seed} ${same ? 'same' : 'DIFF'}`);
}
console.log(bad ? `${bad} differ` : 'all same');
process.exitCode = bad ? 1 : 0;
