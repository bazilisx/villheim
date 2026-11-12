// One table of piece sizes: the decorator's furniture table (lib/decorate.js) and the catalog (lib/pieces.js) against
// the game's models (data/piece-models.json, read through lib/mesh.js). Fails when either is more than 10 cm off for
// furniture and decor, so a hand-typed size cannot drift from the game again. The decorator may reserve more round a
// piece than its body (pad: a torch's keep-clear, a table setting's place); the body itself must match.
// Usage, from tools/blueprint-lab: node lab/test_sizes.js [--list]
const D = require('../lib/decorate.js'), PC = require('../lib/pieces.js'), Me = require('../lib/mesh.js');
const list = process.argv.includes('--list');
D.itemOf({ name: 'bed', x: 0, y: 0, z: 0, q: [0, 0, 0, 1] }); // the decorator reads the models on first use
const bad = [], pads = [];
const off = (a, b) => Math.max(...[0, 1, 2].map(i => Math.abs(a[i] - b[i])));
for (const [name, f] of Object.entries(D.FURNITURE)) {
  const md = Me.dims(name);
  if (!md) continue;
  const hung = ['deco', 'light'].includes(f.cat) || ['rug', 'mount', 'hang'].includes(f.at);
  const m = (!hung && md.solid && md.solid.every(v => v > 0.01) ? md.solid : md.show).slice();
  m[1] = md.show[1];
  // (a bed is as long as it shows: lib/decorate.js modelSizes)
  if (f.cat === 'bed' && md.show[2] > m[2]) m[2] = md.show[2];
  if (Math.abs(f.rel || 0) % 180 === 90) [m[0], m[2]] = [m[2], m[0]];
  if (off(f.s, m) > 0.1) bad.push(`decorator ${name}: ${f.s.join(' x ')} against the model's ${m.join(' x ')}`);
  if (f.pad) pads.push(`${name}: body ${f.s.join(' x ')}, keeps ${f.pad.join(' and ')} m more clear`);
}
for (const name of Object.keys(D.FURNITURE)) {
  const c = PC.piece(name), md = Me.dims(name);
  if (!md || c.structural) continue;
  const hung = ['deco', 'light', 'rug'].includes(c.role);
  const m = (!hung && md.solid && md.solid.every(v => v > 0.01) ? md.solid : md.show).slice();
  m[1] = md.show[1];
  if (off(c.size, m) > 0.1) bad.push(`catalog ${name}: ${c.size.join(' x ')} against the model's ${m.join(' x ')}`);
}
if (list) for (const p of pads) console.log('  ' + p);
console.log(`${Object.keys(D.FURNITURE).length} pieces in the decorator's table, ${pads.length} with a keep-clear pad; ${bad.length} off by more than 10 cm`);
for (const b of bad) console.log('  ' + b);
if (bad.length) process.exitCode = 1;
