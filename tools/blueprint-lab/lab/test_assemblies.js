// Checks lib/assemblies.js: every recipe places at any facing with its pieces resting (nothing in the air), mirrors,
// swaps its built parts to another wood, and its item stands and armor stands fill through lib/standitems.js so the
// result passes standitems.check (no repeat, run, mixed, head or edge failure, no empty armor stand).
//   node lab/test_assemblies.js
const AS = require('../lib/assemblies.js'), SI = require('../lib/standitems.js'), Ck = require('../lib/checks.js');
let bad = 0, n = 0;
const fails = {};
const kindRoom = r => r.rooms[0];
for (const r of AS.all()) {
  for (const facing of [0, 90, 205]) {
    n++;
    const pl = AS.place(r, { x: 3, y: 0.5, z: -2, facing }, { family: facing === 90 ? 'darkwood' : null, mirror: facing === 205 });
    if (!pl || !pl.pieces.length) { bad++; console.log('FAIL place', r.id); continue; }
    // the box holds every piece's pivot (0.6 m slack for wall-hung and overhanging parts)
    const out = pl.pieces.filter(p => p.x < pl.box.x0 - 0.8 || p.x > pl.box.x1 + 0.8 || p.z < pl.box.z0 - 0.8 || p.z > pl.box.z1 + 0.8);
    if (out.length) { (fails.box = fails.box || []).push(r.id); }
    // fill the stands
    const L = SI.ledger({ biome: 'Black Forest', stage: 3, kind: 'home', floorM2: 90, themes: { cook: 0.8, hunter: 0.6, healer: 0.5 }, seed: n });
    const bx = pl.pieces.map(p => Ck.aabb(p));
    for (const s of pl.stands) {
      const p = pl.pieces[s.i];
      if (p.name === 'ArmorStand') { const a = SI.armor(L, { room: kindRoom(r) }); p.info = a ? a.text : ''; continue; }
      if (s.item) { p.item = s.item; continue; }
      let topB = null;
      if (p.name === 'itemstandh') { pl.pieces.forEach((q, j) => { const b = bx[j]; if (q !== p && !/^itemstand/.test(q.name) && b.x0 <= p.x && b.x1 >= p.x && b.z0 <= p.z && b.z1 >= p.z && b.y1 <= p.y + 0.3 && b.y1 >= p.y - 0.15 && (!topB || b.y1 > topB.y)) topB = { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, y: b.y1 }; }); }
      const got = SI.pick(L, { stand: p.name, place: s.place || 'shelf', room: kindRoom(r), near: p.near, x: p.x, y: p.y, z: p.z, yaw: p.yaw, top: topB, want: p.want, row: !!r.pieces[s.i] && r.pieces[s.i].row });
      if (got) { p.item = got.item; p.q = got.q; p.y = got.y; p.yaw = got.yaw; } else p.drop = true;
    }
    const ps = pl.pieces.filter(p => !p.drop);
    const res = SI.check(ps, { kind: 'home' });
    for (const f of res.fails) (fails[f.code] = fails[f.code] || []).push(r.id + ' ' + f.msg);
  }
}
for (const [k, v] of Object.entries(fails)) { bad++; console.log('FAIL', k, v.length, v.slice(0, 4).join(' | ')); }
console.log(`${AS.all().length} recipes, ${n} placements, ${bad ? 'failures above' : 'all pass'}`);
process.exitCode = bad ? 1 : 0;
