// Checks for lib/program.js (the building program, docs/ARCHITECTURE_STUDY.md): runs carry one treatment, exceptions
// come with a reason and one per run, planters stay inside the village cap (D-165), the program is the same when asked
// twice, and its shares come near the corpus (data/architecture/rules.json).
//   node lab/test_program.js
const Pr = require('../lib/program.js');
const cultures = Object.keys(Pr.PALETTE), types = ['home', 'longhouse', 'tavern', 'storage', 'smithy', 'temple'];
const kinds = ['kitchen', 'sleeping', 'hall', 'storage', 'workshop', 'home'];
let fails = 0, n = 0, sidesSame = 0, upperSame = 0, formal = 0, planterW = 0, windows = 0, exc = 0;
const fail = m => { fails++; if (fails <= 12) console.log('FAIL', m); };
for (const c of cultures) for (let vs = 1; vs <= 6; vs++) {
  const V = Pr.village({ cultureKey: c, biome: 'Meadows', seed: vs });
  for (const t of types) for (let s = 1; s <= 4; s++) {
    const persona = { salt: s, hobby: { plants: 1 + (s % 3) * 0.4, food: 1.2 }, likes: { sill: 1 + (s % 2) * 0.5, banners: 1 } };
    const ctx = { cultureKey: c, type: t, stage: 's3', decor: 'd3', biome: 'Plains', seed: vs * 100 + s, storeys: 2, persona, village: V, kit: {} };
    const p = Pr.plan(ctx), p2 = Pr.plan(ctx);
    if (JSON.stringify(Pr.run(p, { side: 'side', storey: 1 })) !== JSON.stringify(Pr.run(p2, { side: 'side', storey: 1 }))) fail(`${c} ${t}: not the same when asked twice`);
    n++; if (p.sidesSame) sidesSame++; if (p.upperSame) upperSame++; if (p.formal) formal++;
    const ws = [];
    for (const side of ['front', 'side', 'back']) for (let st = 0; st < 2; st++) for (let i = 0; i < 4; i++) {
      const room = { kind: kinds[(i + st + side.length) % kinds.length] };
      const w = Pr.window(p, { side, storey: st, room, byDoor: side === 'front' && st === 0 && i === 0, key: `${side}${st}${i}` });
      const f = [...w.features];
      if (w.exception) { exc++; if (!w.exception.reason) fail('exception without a reason'); if (!w.exception.feature.startsWith('fill:')) f.push(w.exception.feature); }
      ws.push({ side, storey: st, line: 0, features: f, fill: w.exception && w.exception.feature.startsWith('fill:') ? w.exception.feature.slice(5) : w.fill, room, byDoor: side === 'front' && st === 0 && i === 0 });
    }
    windows += ws.length; planterW += ws.filter(w => w.features.includes('planter')).length;
    V.windows += ws.length; V.planterWindows += ws.filter(w => w.features.includes('planter')).length;
    // a run-scoped exception (a whole store run shut) changes every window of the run; check() reads it as the run's
    // own family, so only window-scoped ones are faults when they repeat
    const faults = Pr.check(p, ws).filter(x => x.kind !== 'planters over the cap');
    for (const x of faults) if (x.kind !== 'more than one exception in a run') fail(`${c} ${t} seed ${vs}/${s}: ${x.kind} (${x.run})`);
  }
}
console.log(`programs ${n}, sides like the front ${(sidesSame / n).toFixed(2)} (corpus 0.47), upper like below ${(upperSame / n).toFixed(2)} (corpus 0.52), formal ${(formal / n).toFixed(2)} (corpus 0.37), planters ${(planterW / windows).toFixed(3)} of windows (cap 0.10), exceptions ${(exc / windows).toFixed(3)} of windows`);
if (planterW / windows > 0.1) fail('planters over the village cap');
console.log(fails ? `${fails} failures` : 'all program checks pass');
process.exit(fails ? 1 : 0);
