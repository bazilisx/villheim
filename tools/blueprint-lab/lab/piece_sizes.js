// Catalog sizes (lib/pieces.js) against the sizes measured from the game (data/piece-models.json).
//   node lab/piece_sizes.js [names.txt] > report.md
// Without a names file: every piece the catalog names (NEEDS, SIZES, DOORS, CLIMB) plus every piece the generator,
// decorator, styles and floorplans write, when the game has a model of it. Compares the solid collider (what the game
// tests against; the mesh bounds when the piece has no collider) with the catalog box, and the catalog's pivot
// convention (centered, standing on the pivot, hanging from it) with the measured bottom.
const fs = require('fs'), path = require('path');
const P = require('../lib/pieces.js');
const M = require('../data/piece-models.json').pieces;
let names;
if (process.argv[2]) names = fs.readFileSync(process.argv[2], 'utf8').split(/\s+/).filter(Boolean);
else {
  const src = ['generate.js', 'decorate.js', 'styles.js', 'floorplan.js', 'pieces.js'].map(f => fs.readFileSync(path.join(__dirname, '../lib', f), 'utf8')).join('\n')
    + fs.readFileSync(path.join(__dirname, '../data/interior-lite.json'), 'utf8');
  names = [...new Set((src.match(/['"][A-Za-z][A-Za-z0-9_]*['"]/g) || []).map(s => s.slice(1, -1)))];
}
names = names.filter(n => M[n]).sort();
const r2 = v => Math.round(v * 100) / 100;
const fmt = a => a.map(v => r2(v).toFixed(2)).join(' x ');
// the catalog's y range for a piece, from its shape (see render.js localFaces)
function catY(info) {
  const h = info.size[1];
  switch (info.shape) {
    case 'prop': return [0, h];
    case 'hang': return [-h, 0];
    case 'ladder': return [0, h];
    case 'tri': case 'triInv': return [0, h];
    case 'slope26': return [-0.12, h];
    case 'slope45': case 'slope67': return [-h / 2 - 0.12, h / 2];
    case 'cap': return [0, 0.45];
    case 'hipcorner26': case 'hipcorner45': return [-0.12, info.shape === 'hipcorner45' ? 2 : 1];
    default: return [-h / 2, h / 2];
  }
}
const rows = [];
for (const n of names) {
  const m = M[n], info = P.piece(n);
  const box = m.collider || m.bounds;
  const size = box.max.map((v, i) => v - box.min[i]);
  const mesh = m.bounds.max.map((v, i) => v - m.bounds.min[i]);
  const cat = info.size;
  // roof and gable pieces are drawn on a 2 m grid by design; compare their footprint only
  const d = size.map((v, i) => v - cat[i]);
  const [cy0, cy1] = catY(info);
  const dy = m.bounds.min[1] - cy0;
  const off = d.some(v => Math.abs(v) > 0.1) || Math.abs(dy) > 0.1;
  rows.push({ n, role: info.role, cat, size, mesh, d, dy, off, bottom: m.bounds.min[1], catBottom: cy0, from: m.collider ? 'collider' : 'mesh' });
}
const off = rows.filter(r => r.off);
console.log(`| Piece | Role | Catalog (x y z) | Game, ${'solid collider'} (x y z) | Game, mesh (x y z) | Bottom below pivot: catalog / game mesh | Off by more than 10 cm |`);
console.log('|---|---|---|---|---|---|---|');
for (const r of off) {
  const what = [];
  ['x', 'y', 'z'].forEach((a, i) => { if (Math.abs(r.d[i]) > 0.1) what.push(`${a} ${r.d[i] > 0 ? '+' : ''}${r2(r.d[i])}`); });
  if (Math.abs(r.dy) > 0.1) what.push(`bottom ${r.dy > 0 ? '+' : ''}${r2(r.dy)}`);
  console.log(`| \`${r.n}\` | ${r.role} | ${fmt(r.cat)} | ${fmt(r.size)}${r.from === 'mesh' ? ' (mesh)' : ''} | ${fmt(r.mesh)} | ${r2(r.catBottom)} / ${r2(r.bottom)} | ${what.join(', ')} |`);
}
console.error(`${rows.length} pieces compared, ${off.length} off by more than 10 cm`);
