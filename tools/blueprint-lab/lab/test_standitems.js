// Checks lib/standitems.js against Tyler's failures of 2026-11-12 (TYLER_NOTES.md, last section) and against itself:
// each failure he named must fail check(), and a building dressed by pick() and armor() must pass it.
//   node lab/test_standitems.js
const SI = require('../lib/standitems.js');
let bad = 0;
const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
const H = (x, y, z, item, o) => Object.assign({ name: 'itemstandh', x, y, z, yaw: 0, item }, o || {});
const W = (x, y, z, item) => ({ name: 'itemstand', x, y, z, yaw: 0, item });
const codes = r => r.fails.map(f => f.code);

// "Literally 3 of the yellow dripping axes next to each other" and "an axe sticking straight up on its head"
let r = SI.check([H(0, 0.8, 0, 'AxeJotunBane'), H(0.4, 0.8, 0, 'AxeJotunBane'), H(0.8, 0.8, 0, 'AxeJotunBane')]);
ok(codes(r).includes('repeat') && codes(r).includes('run') && codes(r).includes('head'), 'three Jotun Bane axes side by side, upright: repeat, run, head');
// "800 lox pies for reason on every single damn shelf"
r = SI.check([0, 1, 2, 3, 4, 5, 6, 7].map(i => H(i * 2, 1.5, 0, 'LoxPie')));
ok(codes(r).includes('repeat'), 'a lox pie on eight shelves: repeat');
// "The same raspberry + poison pot 5x in the same house"
r = SI.check([0, 1, 2, 3, 4].flatMap(i => [H(i * 3, 0.8, 0, 'Raspberry'), H(i * 3 + 0.3, 0.8, 0, 'MeadPoisonResist')]));
ok(codes(r).includes('repeat'), 'raspberry and poison mead five times: repeat');
// "A full raw fish on a chest next to a raspberry and a poison pot"
r = SI.check([H(0, 0.8, 0, 'Fish1'), H(0.3, 0.8, 0, 'Raspberry'), H(0.6, 0.8, 0, 'MeadPoisonResist')]);
ok(codes(r).includes('mixed'), 'raw fish, raspberry and poison mead on one chest: mixed');
// "A saddle halfway off a table"
r = SI.check([H(1.1, 0.83, 0, 'SaddleLox')], { topOf: () => ({ x0: -1.2, x1: 1.2, z0: -0.4, z1: 0.4, y: 0.83 }) });
ok(codes(r).includes('edge'), 'a lox saddle at the end of a table: edge');
// "there is nothing currently hanging on any of the armorstands"
r = SI.check([{ name: 'ArmorStand', x: 0, y: 0, z: 0, info: '' }]);
ok(codes(r).includes('empty-armor'), 'an empty armor stand: empty-armor');
// the same serpent shield on three walls side by side
r = SI.check([W(0, 2, 0, 'ShieldSerpentscale'), W(0.5, 2, 0, 'ShieldSerpentscale'), W(1.0, 2, 0, 'ShieldSerpentscale')]);
ok(codes(r).includes('repeat') && codes(r).includes('run'), 'three serpent shields side by side: repeat, run');

// a house dressed by pick() passes its own check, over many seeds and biomes
let worst = 0;
for (let seed = 1; seed <= 60; seed++) {
  const biome = SI.BIOMES[seed % 7];
  const L = SI.ledger({ biome, stage: 3, kind: seed % 5 ? 'home' : 'tavern', floorM2: 90, themes: SI.themesFrom({ hobby: { crafts: (seed % 3) / 2, collect: (seed % 4) / 3, plants: (seed % 5) / 4, food: 0.5, games: 0.2, maps: 0.1 } }), seed });
  const ps = [];
  const put = (stand, q) => { const got = SI.pick(L, Object.assign({ stand }, q)); if (got) ps.push({ name: stand, x: q.x, y: got.y, z: q.z, yaw: got.yaw, q: got.q, item: got.item }); };
  const table = { x0: -1.2, x1: 1.2, z0: -0.4, z1: 0.4, y: 0.83 };
  for (let i = 0; i < 4; i++) put('itemstandh', { place: 'table', room: 'dining', near: 'dine', x: -0.9 + i * 0.6, y: 0.83, z: 0.2 * (i % 2 ? 1 : -1), top: table });
  for (let i = 0; i < 4; i++) put('itemstandh', { place: 'shelf', room: 'kitchen', near: 'kitchen', x: 4 + i * 0.33, y: 1.5, z: 3, top: { x0: 3.8, x1: 5.4, z0: 2.75, z1: 3.25, y: 1.5 } });
  for (let i = 0; i < 4; i++) put('itemstand', { near: 'hearth', room: 'hearth', x: -4 + i * 1.6, y: 1.8, z: 5 });
  for (let i = 0; i < 3; i++) put('itemstand', { near: 'sleep', room: 'bedroom', x: 8 + i * 1.2, y: 1.8, z: -3 });
  for (let i = 0; i < 3; i++) put('itemstandh', { place: 'workbench', room: 'workshop', near: 'craft', x: 10 + i * 0.5, y: 0.9, z: 6, top: { x0: 9.5, x1: 11.5, z0: 5.6, z1: 6.4, y: 0.9 } });
  for (let i = 0; i < 2; i++) { const a = SI.armor(L, { room: i ? 'bedroom' : 'entry' }); ps.push({ name: 'ArmorStand', x: 12, y: 0, z: i * 2, info: a ? a.text : '' }); }
  const res = SI.check(ps, { kind: L.kind, topOf: p => (p.y < 1 && p.x < 2 ? table : p.y > 1.2 ? { x0: 3.8, x1: 5.4, z0: 2.75, z1: 3.25, y: 1.5 } : { x0: 9.5, x1: 11.5, z0: 5.6, z1: 6.4, y: 0.9 }) });
  if (res.fails.length) { worst++; if (worst < 4) console.log('  seed', seed, biome, res.fails.map(f => f.code + ': ' + f.msg).join('; ')); }
}
ok(worst === 0, `60 dressed houses pass check() (${worst} failed)`);
process.exitCode = bad ? 1 : 0;
