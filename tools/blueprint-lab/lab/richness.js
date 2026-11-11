// How much of the corpus and the interior library reaches generated designs (Tyler, 2026-11-10: "what can I or my
// helpers do to get as much as appropriate from the corpus and the library into these different designs?").
//
// Usage, from tools/blueprint-lab: node lab/richness.js [--seeds 2] [--quick] [--json out.json] [--list] [--why]
// Sample: home, longhouse, tavern, smithy, workshop, storage in Meadows, Black Forest, Swamp, Mountain, Plains and
// Mistlands, at s1d3, s2d3 and s3d3, two seeds each (216 designs, no yards). --quick: s3d3 only.
// Reports: distinct decor prefabs; the share of decor pieces from mined assemblies (kb 'KB-'), creative sets ('KC-',
// lab/creative_sets.js), hand-made kits ('BK-') and from the decorator's own rules (no kb); distinct mined assemblies placed; the share of decor from the 16
// most used prefabs; per biome; and why the library turned sets down (lib/kitbash.js WHY_B, one count per set tried).
const G = require('../lib/generate.js'), K = require('../lib/kitbash.js'), PB = require('../lib/pieces.js');
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const seeds = +arg('--seeds', 2), jsonOut = arg('--json', null), quick = process.argv.includes('--quick');
const TYPES = ['home', 'longhouse', 'tavern', 'smithy', 'workshop', 'storage'];
const BIOMES = ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains', 'Mistlands'];
const STAGES = quick ? [['s3', 'd3']] : [['s1', 'd3'], ['s2', 'd3'], ['s3', 'd3']];
// what the reasons mean (lib/kitbash.js fit and placeable)
const WHY = {
  0: 'no reason set', anchor: 'no anchor of its kind left', area: 'room floor half full', 1: 'off this room', 2: 'off the floor edge',
  3: 'floor not level (raised section)', 4: 'over the ceiling', 5: 'sunk too deep', 6: 'in a keep-clear box', 7: 'in the fire ring',
  8: 'in a doorway', 9: 'by a stair', 10: 'over a door', 11: 'tall in front of a window', 12: 'hung on a window', 13: 'audit (rests, visible clip)',
  14: 'no plain wall behind', 15: 'nothing to hang from', 16: 'small things too close', 17: 'clips something placed', 18: 'clips its own set',
  19: 'same piece twice', 20: 'too few pieces fit (quick look)', 21: 'too few pieces fit', 22: 'no way past in front', 23: 'moves too much',
  24: 'wall relief too deep', 25: 'core piece off the floor or in a keep-clear box', 26: 'one kind only', 27: 'free-floor set too near a wall',
  28: 'where a stair lands', 29: 'free floor taken', 30: 'no prefab in reach', 31: 'furniture into furniture (pool audit furnClip)', 32: 'banner rod in the ceiling',
};

function run(opts = {}) {
  const stats = {};
  K.setStats(stats);
  const all = new Map(), byBiome = {}, byStage = {};
  let pieces = 0, mined = 0, creative = 0, built = 0, own = 0, n = 0, ms = 0;
  const minedIds = new Set(), creativeIds = new Set();
  for (const type of TYPES) for (const biome of BIOMES) for (const [stage, decor] of STAGES) for (let s = 0; s < seeds; s++) {
    const t0 = Date.now();
    const d = G.generate({ type, biome, stage, decor, seed: 11 + 97 * s, yard: false, ...(opts.req || {}) });
    ms += Date.now() - t0; n++;
    const bb = byBiome[biome] || (byBiome[biome] = { names: new Set(), pieces: 0, mined: 0 });
    const bs = byStage[stage] || (byStage[stage] = { names: new Set(), pieces: 0, mined: 0 });
    for (const p of d.pieces) {
      if (!p.decor || p.trim || PB.piece(p.name).structural) continue;
      pieces++; bb.pieces++; bs.pieces++;
      all.set(p.name, (all.get(p.name) || 0) + 1); bb.names.add(p.name); bs.names.add(p.name);
      const kb = p.kb || '';
      if (/^KB-/.test(kb)) { mined++; bb.mined++; bs.mined++; minedIds.add(kb.split('@')[0]); } else if (/^KC-/.test(kb)) { creative++; creativeIds.add(kb.split('@')[0]); } else if (/^BK-/.test(kb)) built++; else own++;
    }
  }
  K.setStats(null);
  const top = [...all.entries()].sort((a, b) => b[1] - a[1]);
  const top16 = top.slice(0, 16).reduce((a, [, c]) => a + c, 0);
  const pct = (a, b) => (b ? Math.round(1000 * a / b) / 10 : 0);
  return {
    designs: n, msPer: Math.round(ms / n), pieces, prefabs: all.size, minedShare: pct(mined, pieces), creativeShare: pct(creative, pieces), builtShare: pct(built, pieces), ownShare: pct(own, pieces),
    minedSets: minedIds.size, creativeSets: creativeIds.size, top16Share: pct(top16, pieces), top: top.slice(0, 16),
    biomes: Object.fromEntries(Object.entries(byBiome).map(([k, v]) => [k, { prefabs: v.names.size, minedShare: pct(v.mined, v.pieces), perDesign: Math.round(v.pieces / (n / BIOMES.length)) }])),
    stages: Object.fromEntries(Object.entries(byStage).map(([k, v]) => [k, { prefabs: v.names.size, minedShare: pct(v.mined, v.pieces), perDesign: Math.round(v.pieces / (n / STAGES.length)) }])),
    library: stats, prefabList: top,
  };
}

if (require.main === module) {
  const r = run();
  console.log(`${r.designs} designs (${TYPES.length} types x ${BIOMES.length} biomes x ${STAGES.map(s => s.join('')).join(', ')} x ${seeds} seeds), ${r.msPer} ms each`);
  console.log(`decor pieces ${r.pieces} (${Math.round(r.pieces / r.designs)} a design); distinct prefabs ${r.prefabs}`);
  console.log(`from mined sets ${r.minedShare} %, creative sets ${r.creativeShare} %, hand-made kits ${r.builtShare} %, the decorator's rules ${r.ownShare} %`);
  console.log(`distinct mined sets placed ${r.minedSets}, creative sets ${r.creativeSets}; share from the 16 most used prefabs ${r.top16Share} %`);
  console.log('top 16:', r.top.map(([k, c]) => `${k} ${c}`).join(', '));
  console.log('by biome:', Object.entries(r.biomes).map(([k, v]) => `${k} ${v.prefabs} prefabs, ${v.minedShare} % mined, ${v.perDesign} a design`).join('; '));
  console.log('by stage:', Object.entries(r.stages).map(([k, v]) => `${k} ${v.prefabs} prefabs, ${v.minedShare} % mined, ${v.perDesign} a design`).join('; '));
  for (const kind of ['mined', 'creative', 'built']) {
    const S = r.library[kind];
    if (!S) continue;
    console.log(`\n${kind} sets: placed ${S.placed}, turned down ${S.refused} (sets tried and refused at every anchor)`);
    for (const [k, c] of Object.entries(S.why).sort((a, b) => b[1] - a[1])) console.log(`  ${String(c).padStart(5)}  ${String(k).padEnd(6)} ${WHY[k] || ''}`);
  }
  // --why: which of the audit's tests (auditOne) and what the clips were against, counted per piece tried
  if (process.argv.includes('--why')) for (const k of ['audit', 'clip']) console.log(`\n${k}:`, Object.entries(r.library[k] || {}).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([x, c]) => `${x} ${c}`).join(', '));
  if (process.argv.includes('--list')) console.log('\nall prefabs:', r.prefabList.map(([k, c]) => `${k} ${c}`).join(', '));
  if (jsonOut) require('fs').writeFileSync(jsonOut, JSON.stringify(r, null, 1));
}
module.exports = { run, TYPES, BIOMES, WHY };
