// Checks on furnished interiors over a sample of generated designs.
// node lab/check_interiors.js [lib dir] [out.json] [seeds per request] [--shapes | --no-shapes]
// The lib dir is the generator to test (default ../lib); the checks are always this tree's decorate.js audit, so an
// older generator can be measured the same way. Prints a table of problems per check and writes the details.
const fs = require('fs'), path = require('path');
const flags = process.argv.filter(a => /^--/.test(a));
process.argv = process.argv.filter(a => !/^--/.test(a));
const copt = flags.includes('--shapes') ? { shapes: true } : flags.includes('--no-shapes') ? { shapes: false } : {};
const libDir = path.resolve(process.argv[2] || path.join(__dirname, '../lib'));
const out = process.argv[3] || null;
const seeds = +(process.argv[4] || 3);
const G = require(path.join(libDir, 'generate.js'));
const Ck = require(path.join(libDir, 'checks.js'));
const D = require('../lib/decorate.js');
// the switch also decides what the generator and decorator test against
if (copt.shapes != null) Ck.setShapes(copt.shapes);
const types = ['home', 'longhouse', 'tavern', 'smithy', 'sawmill', 'workshop', 'barn', 'farm', 'storage', 'tower', 'dock', 'stall', 'temple'];
const biomes = ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains', 'Mistlands'];
const stages = [['s1', 'd1'], ['s2', 'd2'], ['s3', 'd3']];
const ORDER = ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains', 'Mistlands', 'Ashlands', 'Deep North'];
const totals = {}, designs = {}, rows = [];
const add = (k, n) => { totals[k] = (totals[k] || 0) + n; designs[k] = (designs[k] || 0) + (n ? 1 : 0); };
const sets = new Map();
let n = 0, ms = 0;
for (const type of types) for (const biome of biomes) for (const [stage, decor] of stages) for (let s = 0; s < seeds; s++) {
  const seed = 11 + s * 97 + n;
  const t0 = Date.now();
  const d = G.generate({ type, biome, stage, decor, seed });
  ms += Date.now() - t0;
  n++;
  const a = D.audit(d, decor);
  const marked = d.pieces.some(p => p.decor);
  const deco = d.pieces.filter(p => (marked ? p.decor : D.FURNITURE[p.name] && !require('../lib/pieces.js').piece(p.name).structural));
  const PCi = require('../lib/pieces.js');
  // decor goes in any biome (D-065, Tyler 2026-11-10); only building pieces past the village's biome and the next count
  const biomeBad = deco.filter(p => !PCi.decorOk(p.name, biome)).map(p => p.name);
  const checks = Ck.check(d, biome, copt);
  const row = { type, biome, stage, decor, seed, name: d.meta.Name, items: deco.length, kinds: new Set(deco.map(p => p.name)).size };
  for (const [k, v] of Object.entries(a)) { add(k, v.length); if (v.length) row[k] = v.slice(0, 6); }
  add('decorBiome', biomeBad.length); if (biomeBad.length) row.decorBiome = [...new Set(biomeBad)];
  for (const c of checks) { add('check:' + c.check, c.ok ? 0 : 1); if (!c.ok) row['check:' + c.check] = c.detail; }
  rows.push(row);
  const key = `${type}|${biome}|${stage}`;
  if (!sets.has(key)) sets.set(key, []);
  sets.get(key).push(deco.map(p => p.name).sort());
}
// variety: how alike the furniture of two designs of the same request is (shared share of their piece lists)
let sim = 0, pairs = 0;
for (const list of sets.values()) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
  const a = new Map(), b = new Map();
  for (const x of list[i]) a.set(x, (a.get(x) || 0) + 1);
  for (const x of list[j]) b.set(x, (b.get(x) || 0) + 1);
  let inter = 0, uni = 0;
  for (const k of new Set([...a.keys(), ...b.keys()])) { inter += Math.min(a.get(k) || 0, b.get(k) || 0); uni += Math.max(a.get(k) || 0, b.get(k) || 0); }
  if (uni) { sim += inter / uni; pairs++; }
}
const perStage = {};
for (const r of rows) { const k = r.decor; perStage[k] = perStage[k] || { n: 0, items: 0, kinds: 0 }; perStage[k].n++; perStage[k].items += r.items; perStage[k].kinds += r.kinds; }
console.log(`${n} designs from ${libDir}, ${(ms / n).toFixed(0)} ms each`);
console.log('check'.padEnd(22), 'designs', 'problems');
for (const k of Object.keys(totals).sort()) console.log(k.padEnd(22), String(designs[k]).padStart(7), String(totals[k]).padStart(8));
for (const [k, v] of Object.entries(perStage)) console.log(`${k}: ${(v.items / v.n).toFixed(1)} pieces of furniture, ${(v.kinds / v.n).toFixed(1)} kinds per design`);
console.log(`same request, other seed: furniture lists ${(100 * sim / pairs).toFixed(0)} % alike`);
if (out) fs.writeFileSync(out, JSON.stringify({ totals, designs, perStage, similarity: sim / pairs, rows }, null, 1));
