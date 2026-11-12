// The structure rules from Tyler's in-game review (2026-11-09) on the designs he built: node lab/test_structure.js
// Exits 1 on the first broken rule. See docs/BLUEPRINT_LAB.md "Structure rules".
const G = require('../lib/generate.js'), Ck = require('../lib/checks.js'), P = require('../lib/pieces.js');
const WH = require('../lib/wallhang.js'), Au = require('../lib/audit.js');
let failed = 0;
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
  for (const c of Ck.check(d, biome)) ok(c.ok, `${name}: ${c.check}: ${c.detail}`);
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
  // what hangs on a wall touches it, faces the room and keeps clear of what else hangs there (lib/wallhang.js)
  wallChecks(d, name);
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
// Things hung on walls (track F, showcase 2026-11-12; Tyler: "signs and item stands sticking out from the wall, not
// attached", "torches oriented the wrong way", "3-stacks thick"): the pool audit's wall measures, all zero.
function wallChecks(d, name) {
  const r = { wallOff: [], wallTurn: [], wallHalf: [], wallStack: [] };
  Au.wallHung(d.pieces, r);
  for (const [k, list] of Object.entries(r)) for (const m of list) ok(false, `${name}: ${k}: ${m}`);
}
// the showcase's worst case for wall pieces: the Meadows hub, a stone plinth under 2x2 wood walls
{ const d = G.generate({ type: 'hub', biome: 'Meadows', culture: 'norse', stage: 's5', decor: 'd3', seed: 2 }); wallChecks(d, d.meta.Name);
  // the notice board's signs side by side, none over another
  const notes = d.pieces.filter(p => p.notice && /^sign/.test(p.name));
  ok(notes.length >= 6 && !WH.overlaps(notes).length, `${d.meta.Name}: notice board signs over one another`); }
// the side of each hung piece that goes to the wall is the side the piece catalog reads from the corpus, where it is sure
{ let C = null; try { C = require('../lib/catalog.js'); } catch (e) { C = null; }
  if (C) for (const n of Object.keys(WH.HUNG)) {
    const f = C.facing(n);
    if (!f || !f.back || !['high', 'medium'].includes(f.sure)) continue;
    const b = WH.HUNG[n].back, mine = Math.abs(b[0]) > 0.5 ? (b[0] > 0 ? '+x' : '-x') : (b[2] > 0 ? '+z' : '-z');
    ok(mine === f.back, `${n}: back ${mine} in lib/wallhang.js, ${f.back} in the catalog`);
  } }
// a stand hung over a stone plinth goes against the wood wall above it, not the plinth's face; with no wall, no stand
{ const walls = [{ name: 'stone_wall_2x1', x: 0, y: 0.5, z: 0, yaw: 0 }, { name: 'woodwall', x: 0, y: 2, z: -0.35, yaw: 0 }];
  const B = WH.backing(walls);
  const r = WH.hang('itemstand', { x: 0, z: 0.5, nx: 0, nz: 1, y: 1.7 }, B);
  ok(r && Math.abs(r.z - (-0.35 + 0.15 + 0.05 - 0.005)) < 0.02, `itemstand over a plinth at z ${r && r.z}, wanted against the wood wall`);
  const m = r && WH.measure(r, B);
  ok(m && m.facing && Math.abs(m.gap + 0.005) < 0.01 && m.cover > 0.99, 'itemstand over a plinth: measured off its wall or turned');
  const t = WH.hang('piece_walltorch', { x: 0, z: 0.5, nx: 0, nz: 1, y: 1.7 }, B);
  ok(t && WH.measure(t, B).facing && t.yaw === 270, 'wall torch over a plinth: turned wrong');
  ok(!WH.hang('sign', { x: 4, z: 0.5, nx: 0, nz: 1, y: 1.7 }, B), 'a sign hung where there is no wall'); }
// the old id of the Lamari culture still works
ok(/^tower_Mistlands_lamari_/.test(G.generate({ type: 'tower', biome: 'Mistlands', culture: 'caucasian-highland', stage: 's2', seed: 1 }).meta.Name), 'caucasian-highland does not map to lamari');
// the door table: every door the generator places has measured data
for (const k of ['wood_door', 'wood_gate', 'piece_cloth_hanging_door']) ok(!P.doorSpec(k).guessed, `${k} has no measured door data`);
console.log(failed ? `${failed} failed` : `all structure rules hold on ${cases.length * 3} designs`);
process.exit(failed ? 1 : 0);
