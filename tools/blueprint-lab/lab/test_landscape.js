// Checks for the greenery pass (lib/landscape.js, D-143 to D-147): node lab/test_landscape.js [seeds]
//   shares    the share of homes with each class outside, and the pieces when they have any, inside a band round the
//             corpus house builds (data/landscape/corpus-greenery.json house_builds)
//   clear     nothing in a door's entry zone (the opening plus 0.3 m each side, 1.5 m out, D-152), no plant on the yard
//             path, no vine over a door
//   ground    no floating plants: plants on the ground at the ground, vines on a wall and rooted, pots on the ground
//             or a floor
//   biome     a plant marked gathered grows near the village's biome; a stand-in only where the class has none near it
//   marks     every plant carries its marks, and they come back from the written file
//   checks    every lib/checks.js check that passes without greenery passes with it
//   kit       the road kit sets: no plant in a kept box, none on another, marks and the biome rule
// Exits 1 when a rule breaks.
const G = require('../lib/generate.js'), L = require('../lib/landscape.js'), Ck = require('../lib/checks.js'), P = require('../lib/pieces.js'), B = require('../lib/blueprint.js');
const fs = require('fs'), path = require('path');
const seeds = +(process.argv[2] || 2);
let failed = 0;
const fail = m => { failed++; if (failed < 40) console.log('FAIL', m); };

const cases = [
  ['Meadows', 'norse'], ['Meadows', 'anglo-saxon'], ['Meadows', 'frankish-norman'], ['Black Forest', 'norse-forest'], ['Black Forest', 'slavic'],
  ['Swamp', 'fen-folk'], ['Swamp', 'baltic'], ['Mountain', 'norse-highland'], ['Mountain', 'saami'], ['Plains', 'byzantine'], ['Plains', 'middle-eastern'],
  ['Mistlands', 'byzantine'], ['Ashlands', 'castle-medieval'],
];
const stats = {}, n = { homes: 0 };
for (const k of Object.keys(L.HOUSE)) stats[k] = { any: 0, counts: [] };
const t0 = Date.now();
const designs = [];
for (const [biome, culture] of cases) for (const stage of ['s1', 's2', 's3']) for (let seed = 1; seed <= seeds; seed++) designs.push({ type: 'home', biome, culture, stage, decor: 'd3', seed });
// shared buildings too, for the rules (not the shares)
for (const [type, biome, culture] of [['tavern', 'Meadows', 'norse'], ['longhouse', 'Black Forest', 'celtic'], ['smithy', 'Plains', 'steppe'], ['farm', 'Swamp', 'fen-folk']])
  designs.push({ type, biome, culture, stage: 's3', decor: 'd3', seed: 1, shared: true });

for (const req of designs) {
  const d = G.generate(req), name = d.meta.Name, biome = req.biome;
  const green = d.pieces.filter(p => p.green);
  const mine = green.filter(p => ['wall', 'foot', 'eaves', 'yard', 'court', 'path', 'fence'].includes(p.green.at) && !p.yard);
  if (!req.shared) {
    n.homes++;
    for (const k of Object.keys(L.HOUSE)) { const c = mine.filter(p => p.green.k === k).length; if (c) { stats[k].any++; stats[k].counts.push(c); } }
  }
  // the lab's ground is 0; the pass sets plants on the lowest pivot before the pieces go down to their feet (-0.6 to 0)
  const G0 = Math.min(0, ...mine.filter(p => p.green.k !== 'vine').map(p => p.y));
  // marks
  for (const p of d.pieces) {
    const k = L.classOf(p.name);
    if (k && k !== 'pot' && !(k === 'crop' && !p.yard) && !p.green) fail(`${name}: ${p.name} unmarked`);
    if (!p.green) continue;
    const g = p.green;
    if (!['food', 'keep'].includes(g.use) || !['home', 'shared'].includes(g.own) || !['gathered', 'standin', 'built'].includes(g.src)) fail(`${name}: ${p.name} marks ${JSON.stringify(g)}`);
    if (g.use !== L.useOf(p.name)) fail(`${name}: ${p.name} use ${g.use}`);
    if (g.own !== (['home', 'farm'].includes(req.type) ? 'home' : 'shared')) fail(`${name}: ${p.name} owner ${g.own}`);
  }
  const back = B.parse(B.write(d)).pieces.filter(p => p.green).length;
  if (back !== green.length) fail(`${name}: ${green.length} marked, ${back} read back`);
  // biome
  for (const p of mine) {
    const list = L.choices(p.green.k, biome), here = list.find(c => c.e[0] === p.name);
    if (!here) fail(`${name}: ${p.name} is no ${p.green.k} for ${biome}`);
    else if (here.src !== p.green.src) fail(`${name}: ${p.name} marked ${p.green.src}, the rule says ${here.src}`);
  }
  // clear: entry zones, the path, vines over doors
  const zones = [], doors = [];
  for (const q of d.pieces) {
    if (P.piece(q.name).role !== 'door' || q.yard) continue;
    const o = P.doorOpening(q);
    doors.push(o);
    const hw = o.w / 2 + 0.3;
    for (const s of [-1, 1]) {
      const xs = [], zs = [];
      for (const a of [-hw, hw]) for (const c of [0, 1.5 * s]) { xs.push(o.x + o.ux * a + o.nx * c); zs.push(o.z + o.uz * a + o.nz * c); }
      zones.push({ x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), y: o.y });
    }
  }
  const planks = d.pieces.filter(q => q.yard && P.piece(q.name).role === 'floor').map(q => Ck.aabb(q));
  for (const p of mine) {
    if (p.green.k === 'vine') {
      for (const o of doors) {
        const along = Math.abs((p.x - o.x) * o.ux + (p.z - o.z) * o.uz), off = Math.abs((p.x - o.x) * o.nx + (p.z - o.z) * o.nz);
        if (off < 0.5 && along < o.w / 2 + 0.3 && p.y < o.y + o.h) fail(`${name}: vine over a door at ${p.x},${p.z}`);
      }
      continue;
    }
    const r = 0.2;
    if (zones.some(z => p.x + r > z.x0 && p.x - r < z.x1 && p.z + r > z.z0 && p.z - r < z.z1 && p.y < z.y + 2)) fail(`${name}: ${p.name} in an entry zone at ${p.x},${p.z}`);
    if (planks.some(o => p.x > o.x0 && p.x < o.x1 && p.z > o.z0 && p.z < o.z1)) fail(`${name}: ${p.name} on the path at ${p.x},${p.z}`);
  }
  // ground
  const walls = d.pieces.filter(q => !q.green && ['wall', 'door', 'window'].includes(P.piece(q.name).role)).map(q => Ck.aabb(q));
  const floors = d.pieces.filter(q => !q.green && P.piece(q.name).role === 'floor').map(q => Ck.aabb(q));
  for (const p of mine) {
    if (p.green.k === 'vine') {
      const o = Ck.aabb(p);
      if (!walls.some(w => o.x0 < w.x1 + 0.16 && o.x1 > w.x0 - 0.16 && o.z0 < w.z1 + 0.16 && o.z1 > w.z0 - 0.16 && o.y0 < w.y1 && o.y1 > w.y0)) fail(`${name}: vine off the wall at ${p.x},${p.y},${p.z}`);
      if (p.y > 0.45 && !mine.some(q => q !== p && q.green.k === 'vine' && q.y < p.y && p.y - q.y < 2.3 && Math.hypot(q.x - p.x, q.z - p.z) < 1.3)) fail(`${name}: vine floating at ${p.x},${p.y},${p.z}`);
    } else if (p.green.k === 'pot' && floors.some(o => Math.abs(o.y1 - p.y) < 0.05 && p.x > o.x0 && p.x < o.x1 && p.z > o.z0 && p.z < o.z1)) {
      // a pot on a floor
    } else if (p.y > 0.02 || p.y < -0.8 || mine.some(q => q.green.k !== 'vine' && q.green.k !== 'pot' && q.y > p.y + 0.15)) fail(`${name}: ${p.name} at y ${p.y}, ground ${G0}`);
  }
  // the checks: what passes bare passes with greenery
  const bare = G.generate({ ...req, landscape: false });
  const was = Object.fromEntries(Ck.check(bare, biome).map(c => [c.check, c.ok]));
  for (const c of Ck.check(d, biome)) if (was[c.check] && !c.ok) fail(`${name}: ${c.check} fails with greenery: ${c.detail}`);
}

// shares against the corpus house builds
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
console.log(`${n.homes} homes (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
console.log('class     share  corpus  band          pieces median  corpus');
for (const [k, [share, cmed]] of Object.entries(L.HOUSE)) {
  const got = stats[k].any / n.homes, m = med(stats[k].counts);
  const lo = share * 0.5, hi = share * 1.7, ok = got >= lo && got <= hi && (!stats[k].counts.length || (m >= cmed * 0.35 && m <= cmed * 2.5));
  console.log(`${k.padEnd(9)} ${got.toFixed(2).padStart(5)}  ${share.toFixed(2).padStart(6)}  ${lo.toFixed(2)} to ${hi.toFixed(2)}  ${String(m).padStart(13)}  ${String(cmed).padStart(6)}${ok ? '' : '  OUT'}`);
  if (!ok) fail(`share or pieces of ${k} outside the band`);
}

// the road kit
const kit = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/landscape/road-kit.json'), 'utf8'));
for (const set of kit.sets) for (const biome of ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains', 'Mistlands', 'Ashlands']) {
  const ps = L.kitPieces(set, biome);
  for (const p of ps) {
    if (p.green.own !== 'shared') fail(`kit ${set.id}: owner ${p.green.own}`);
    const c = L.choices(p.green.k, biome).find(x => x.e[0] === p.name);
    if (!c || c.src !== p.green.src) fail(`kit ${set.id} ${biome}: ${p.name} biome rule`);
    const r = p.green.k === 'bush' ? 0.6 : 0.2;
    for (const z of set.keep) if (p.x + r > z.x0 && p.x - r < z.x1 && p.z + r > z.z0 && p.z - r < z.z1) fail(`kit ${set.id}: ${p.name} at ${p.x},${p.z} in ${z.why}`);
    if (set.anchor && Math.hypot(p.x - set.anchor.x, p.z - set.anchor.z) < set.anchor.r) fail(`kit ${set.id}: ${p.name} on the anchor`);
    if (ps.some(q => q !== p && Math.hypot(q.x - p.x, q.z - p.z) < 0.3)) fail(`kit ${set.id}: ${p.name} on another plant`);
  }
}
console.log(failed ? `${failed} failures` : 'all landscaping rules hold');
process.exit(failed ? 1 : 0);
