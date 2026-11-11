// How often each creative set (KC-, lab/creative_sets.js) is placed in generated designs, and which prefabs reach a
// design through the library.
//   node lab/creative_fit.js [seeds] [out.json]
//   node lab/creative_fit.js --probe [KC-001 ...]
// Every type in six biomes at s2d2 and s3d3; prints each set's count (and the sets never placed), the prefabs placed by
// the library before and after the creative sets, and writes the designs' pieces by set for rendering. With --probe
// each set is tried alone (the library and the built kits set aside) in rooms of the kinds it names, at d3 in its own
// biome and the Mistlands, and the last reason the fitter gave is printed for sets that never went in.
const fs = require('fs');
const G = require('../lib/generate.js');
const KB = require('../lib/kitbash.js');
const probe = process.argv.includes('--probe');
if (probe) {
  const only = process.argv.slice(3);
  const all = KB.library();
  const built = KB.BUILT.splice(0);
  const TYPES = { home: 'home', sleeping: 'home', kitchen: 'tavern', tavern: 'tavern', hall: 'longhouse', temple: 'temple', smithy: 'smithy', workshop: 'workshop', storage: 'storage', barn: 'barn' };
  for (const a of all.assemblies.filter(x => x.creative && (!only.length || only.includes(x.id)))) {
    KB.setLibrary({ assemblies: [a] });
    globalThis.__kbNo = {};
    const types = [...new Set(a.rooms.map(r => TYPES[r]).filter(Boolean))];
    let tries = 0, ok = 0;
    for (const type of types) for (const biome of [...new Set([a.biome, a.biome === 'Ashlands' ? 'Ashlands' : 'Mistlands'])]) for (let s = 0; s < 3; s++) {
      const d = G.generate({ type, biome, stage: 's3', decor: 'd3', seed: 5 + s * 37 });
      tries++;
      if (d.pieces.some(p => p.kb && p.kb.startsWith(a.id + '@'))) ok++;
    }
    const top = Object.entries(globalThis.__kbNo).sort((x, y) => y[1] - x[1]).slice(0, +process.env.WHY || 4).map(([k, v]) => `${k}:${v}`).join(', ');
    console.log(a.id, `${ok}/${tries}`.padStart(6), a.name.padEnd(40), ok ? '' : `why ${KB.why()}`, process.env.WHY ? top : '');
  }
  KB.BUILT.push(...built);
  KB.setLibrary(all);
  process.exit(0);
}
const seeds = +(process.argv[2] || 2);
const out = process.argv[3] || null;
const types = ['home', 'longhouse', 'tavern', 'smithy', 'workshop', 'barn', 'storage', 'temple', 'tower'];
const biomes = ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains', 'Mistlands'];
const lib = KB.library().assemblies;
const ids = lib.filter(a => a.creative).map(a => a.id);
const count = {}, where = {}, prefabs = new Set(), kcPrefabs = new Set(), kbPrefabs = new Set();
let n = 0;
for (const type of types) for (const biome of biomes) for (const [stage, decor] of [['s2', 'd2'], ['s3', 'd3']]) for (let s = 0; s < seeds; s++) {
  const seed = 7 + s * 131 + n;
  const d = G.generate({ type, biome, stage, decor, seed });
  n++;
  const seen = new Set();
  for (const p of d.pieces) {
    if (!p.kb) continue;
    const id = p.kb.split('@')[0];
    prefabs.add(p.name);
    if (/^KC-/.test(id)) kcPrefabs.add(p.name); else if (/^KB-/.test(id)) kbPrefabs.add(p.name);
    if (seen.has(p.kb)) continue;
    seen.add(p.kb);
    count[id] = (count[id] || 0) + 1;
    if (/^KC-/.test(id) && !where[id]) where[id] = { type, biome, stage, decor, seed };
  }
}
console.log(`${n} designs`);
const byId = new Map(lib.map(a => [a.id, a]));
for (const id of ids) console.log(id, String(count[id] || 0).padStart(3), byId.get(id).name);
console.log('never placed:', ids.filter(id => !count[id]).join(' '));
console.log(`prefabs placed by the library: ${prefabs.size} (creative sets ${kcPrefabs.size}, mined ${kbPrefabs.size})`);
if (out) fs.writeFileSync(out, JSON.stringify({ count, where, prefabs: [...prefabs].sort() }, null, 1));
