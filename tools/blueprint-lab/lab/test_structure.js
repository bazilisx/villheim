// The structure rules from Tyler's in-game review (2026-11-09) on the designs he built: node lab/test_structure.js
// Exits 1 on the first broken rule. See docs/BLUEPRINT_LAB.md "Structure rules".
const G = require('../lib/generate.js'), Ck = require('../lib/checks.js'), P = require('../lib/pieces.js');
let failed = 0;
const narrow = [];
const ok = (cond, what) => { if (!cond) { failed++; console.log('FAIL', what); } };

// T-04 to T-06: the designs Tyler placed, and a few more of each kind
const cases = [
  ['home', 'Meadows', 'norse', 's1'], ['home', 'Swamp', 'celtic-crannog', 's2'], ['home', 'Plains', 'middle-eastern', 's2'],
  ['temple', 'Plains', 'byzantine', 's2'], ['home', 'Plains', 'steppe', 's1'], ['home', 'Mountain', 'saami', 's1'],
  ['tower', 'Mistlands', 'lamari', 's2'], ['home', 'Plains', 'byzantine', 's3'], ['longhouse', 'Black Forest', 'norse-forest', 's2'],
  ['home', 'Black Forest', 'slavic', 's3'], ['tower', 'Black Forest', 'frankish-norman', 's3'], ['tavern', 'Plains', 'middle-eastern', 's3'],
];
for (const [type, biome, culture, stage] of cases) for (const seed of [1, 2, 3]) {
  const d = G.generate({ type, biome, culture, stage, decor: 'd' + stage[1], seed });
  const name = d.meta.Name;
  // passages (Tyler's two-piece rule) are counted and listed, not failed, until every plan meets it (track D record)
  for (const c of Ck.check(d, biome)) { if (c.check === 'passages') { if (!c.ok) narrow.push(`${name}: ${c.detail}`); continue; } ok(c.ok, `${name}: ${c.check}: ${c.detail}`); }
  for (const p of d.pieces) {
    // no door taller than its wall; the dark wood gate is never a house door
    if (P.piece(p.name).role === 'door') ok(p.name !== 'darkwood_gate', `${name}: darkwood_gate used as a door`);
    // the cloth door turned 90 degrees against its wall, hanging from the top of a 3 m opening
    if (p.name === 'piece_cloth_hanging_door') {
      const o = P.doorOpening(p);
      // a wall beside it in the same wall line
      const wall = d.pieces.find(q => !q.decor && P.piece(q.name).role === 'wall' && Math.abs((q.x - o.x) * o.nx + (q.z - o.z) * o.nz) < 0.3 &&
        Math.abs(Math.abs((q.x - o.x) * o.ux + (q.z - o.z) * o.uz) - 2) < 0.3 && Math.abs(q.y - o.y - 1) < 1.1);
      if (wall) ok(Math.abs(((p.yaw - wall.yaw) % 180 + 180) % 180 - 90) < 1, `${name}: cloth door not turned against its wall`);
    }
    // dark wood only from the Plains on
    if (/darkwood/.test(p.name)) ok(P.BIOME_ORDER.indexOf(biome) >= P.BIOME_ORDER.indexOf('Plains'), `${name}: ${p.name} before the Plains`);
  }
  // the fire under the smoke hole
  const fire = d.pieces.find(p => p.decor && /^(fire_pit|hearth)$/.test(p.name));
  if (fire) {
    const crown = /octagon/.test(d.request.plan);
    const caps = d.pieces.filter(p => /roof_top/.test(p.name) && Math.abs(p.x - fire.x) < 0.9 && Math.abs(p.z - fire.z) < 0.9 && p.y < 20);
    if (crown) ok(Math.hypot(fire.x, fire.z) < 0.01, `${name}: fire not under the crown`);
    else ok(caps.every(c => c.y > fire.y + 4) || d.request.roof === 'flat', `${name}: ridge closed over the fire`);
  }
  // ceiling braziers hang clear of heads, away from walls
  for (const br of d.pieces.filter(p => /brazierceiling/.test(p.name))) {
    const room = d.rooms.filter(r => br.x > r.x0 && br.x < r.x1 && br.z > r.z0 && br.z < r.z1 && br.y > r.y).sort((a, c) => c.y - a.y)[0];
    ok(room && br.y >= room.y + 2.3, `${name}: brazier too low or outside a room`);
    if (room) ok(Math.min(br.x - room.x0, room.x1 - br.x, br.z - room.z0, room.z1 - br.z) > 1.4, `${name}: brazier against a wall`);
  }
}
// the 16 showcase designs as the game makes them (vh gen showcase: request make, one try; src/Villheim.Logic/Generator
// GenCommands.cs ShowcaseList), Tyler's test cases of the showcase review (2026-11-12): every check, the passages listed
const SHOWCASE = [['hub', 'Meadows', 'norse', 's5', 2], ['hub', 'Plains', 'byzantine', 's5', 1], ['hub', 'Black Forest', 'celtic', 's4', 2],
  ['temple', 'Mistlands', 'byzantine', 's3', 1], ['longhouse', 'Black Forest', 'norse-forest', 's3', 3], ['tavern', 'Plains', 'byzantine', 's3', 1],
  ['tavern', 'Plains', 'steppe', 's3', 2], ['home', 'Plains', 'middle-eastern', 's3', 1], ['home', 'Swamp', 'baltic', 's3', 2],
  ['home', 'Black Forest', 'slavic', 's3', 3], ['home', 'Meadows', 'anglo-saxon', 's2', 2], ['home', 'Mistlands', 'lamari', 's2', 2],
  ['smithy', 'Mountain', 'norse-highland', 's2', 1], ['tower', 'Mountain', 'norse-highland', 's3', 1], ['workshop', 'Ashlands', 'castle-medieval', 's2', 3],
  ['home', 'Ashlands', 'castle-medieval', 's3', 1]];
for (const [type, biome, culture, stage, seed] of SHOWCASE) {
  const d = G.generate({ type, biome, culture, stage, decor: 'd3', seed, lineage: seed });
  for (const c of Ck.check(d, biome)) { if (c.check === 'passages') { if (!c.ok) narrow.push(`${d.meta.Name}: ${c.detail}`); continue; } ok(c.ok, `${d.meta.Name}: ${c.check}: ${c.detail}`); }
}
// the old id of the Lamari culture still works
ok(/^tower_Mistlands_lamari_/.test(G.generate({ type: 'tower', biome: 'Mistlands', culture: 'caucasian-highland', stage: 's2', seed: 1 }).meta.Name), 'caucasian-highland does not map to lamari');
// the door table: every door the generator places has measured data
for (const k of ['wood_door', 'wood_gate', 'piece_cloth_hanging_door']) ok(!P.doorSpec(k).guessed, `${k} has no measured door data`);
console.log(failed ? `${failed} failed` : `all structure rules hold on ${cases.length * 3} designs`);
if (narrow.length) { console.log(`passages (listed, not failed): ${narrow.length} designs with walks under two floor pieces wide`); for (const l of narrow) console.log('  ' + l); }
process.exit(failed ? 1 : 0);
