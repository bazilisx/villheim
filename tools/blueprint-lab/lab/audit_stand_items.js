// Audits the stand items of generated designs with lib/standitems.js check() (track G criteria,
// docs/handoffs/2026-11-12-showcase-review/criteria/assemblies.md): the 16 showcase specs (TYLER_NOTES.md) at a few
// seeds, or one blueprint file. Counts each failure code per design and in all.
//   node lab/audit_stand_items.js [seeds=3]            the showcase specs
//   node lab/audit_stand_items.js --file <x.blueprint> one design
const fs = require('fs');
const SI = require('../lib/standitems.js'), Ck = require('../lib/checks.js'), BP = require('../lib/blueprint.js');
const SPECS = [['hub', 'Meadows', 'norse', 's3'], ['hub', 'Plains', 'byzantine', 's3'], ['hub', 'Black Forest', 'celtic', 's3'], ['temple', 'Mistlands', 'byzantine', 's3'],
  ['longhouse', 'Black Forest', 'norse-forest', 's3'], ['tavern', 'Plains', 'byzantine', 's3'], ['tavern', 'Plains', 'steppe', 's3'], ['home', 'Plains', 'middle-eastern', 's3'],
  ['home', 'Swamp', 'baltic', 's3'], ['home', 'Black Forest', 'slavic', 's3'], ['home', 'Meadows', 'anglo-saxon', 's2'], ['home', 'Mistlands', 'lamari', 's2'],
  ['smithy', 'Mountain', 'norse-highland', 's2'], ['tower', 'Mountain', 'norse-highland', 's3'], ['workshop', 'Ashlands', 'castle-medieval', 's2'], ['home', 'Ashlands', 'castle-medieval', 's3']];

function topOf(pieces, bx) {
  return p => {
    let best = null, bt = -Infinity;
    pieces.forEach((q, j) => {
      if (q === p || /^itemstand/.test(q.name)) return;
      const b = bx[j];
      if (b.pass || b.x0 > p.x || b.x1 < p.x || b.z0 > p.z || b.z1 < p.z || b.y1 > p.y + 0.3 || b.y1 < p.y - 0.15) return;
      if (b.y1 > bt) { bt = b.y1; best = b; }
    });
    return best ? { x0: best.x0, x1: best.x1, z0: best.z0, z1: best.z1, y: best.y1 } : null;
  };
}
function audit(pieces, kind) {
  for (const p of pieces) if (!p.q) { const a = (p.yaw || 0) * Math.PI / 360; p.q = [0, Math.sin(a), 0, Math.cos(a)]; }
  const bx = pieces.map(p => Ck.aabb(p));
  return SI.check(pieces, { kind, topOf: topOf(pieces, bx) });
}
const fi = process.argv.indexOf('--file');
if (fi > 0) {
  const d = BP.parse(fs.readFileSync(process.argv[fi + 1], 'utf8'));
  const r = audit(d.pieces, process.argv[fi + 2] || 'home');
  const by = {};
  for (const f of r.fails) by[f.code] = (by[f.code] || 0) + 1;
  console.log(JSON.stringify({ fails: by, counts: { stands: r.counts.stands, dressed: r.counts.dressed, armor: r.counts.armor, armorDressed: r.counts.armorDressed, distinctShare: r.counts.distinctShare } }));
  for (const f of r.fails.slice(0, 40)) console.log(' ', f.code, f.msg);
} else {
  const G = require('../lib/generate.js');
  const seeds = +(process.argv[2] || 3);
  const tot = {}, rows = [];
  for (const [type, biome, culture, stage] of SPECS) for (let s = 1; s <= seeds; s++) {
    let d;
    try { d = G.generate({ type, biome, culture, stage, decor: 'd3', seed: s * 7919 }); } catch (e) { rows.push(`${type} ${biome} ${culture} seed ${s}: ${e.message}`); continue; }
    const r = audit(d.pieces, type);
    const by = {};
    for (const f of r.fails) { by[f.code] = (by[f.code] || 0) + 1; tot[f.code] = (tot[f.code] || 0) + 1; }
    tot.designs = (tot.designs || 0) + 1;
    if (r.fails.length) tot.failing = (tot.failing || 0) + 1;
    rows.push(`${type} ${biome} ${culture} ${stage} seed ${s * 7919}: stands ${r.counts.stands} dressed ${r.counts.dressed} distinct ${r.counts.distinctShare} armor ${r.counts.armorDressed}/${r.counts.armor} fails ${JSON.stringify(by)} ${r.fails.filter(f => f.code !== 'empty-armor').slice(0, 3).map(f => f.msg).join('; ')}`);
  }
  console.log(rows.join('\n'));
  console.log('TOTAL', JSON.stringify(tot));
}
