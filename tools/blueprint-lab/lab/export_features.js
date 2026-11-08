// Write features of every corpus design with its keep/drop label: lab/export_features.js <corpus.json> <out.csv>
const fs = require('fs'), F = require('../lib/features.js');
const D = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const rows = [['id', 'label', ...F.NAMES].join(',')];
for (const d of D) {
  const pieces = d.pieces.map(p => ({ name: p[0], x: p[1], y: p[2], z: p[3], q: p[6] }));
  const f = F.features(pieces);
  rows.push([JSON.stringify(d.id), d.label == null ? '' : d.label, ...F.NAMES.map(k => (+f[k]).toFixed(5))].join(','));
}
fs.writeFileSync(process.argv[3], rows.join('\n'));
console.log(rows.length - 1);
