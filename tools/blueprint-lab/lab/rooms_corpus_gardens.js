// Window planters, plant clusters and gardens in the corpus (docs/ROOM_STUDY.md, windows and gardens).
//   node lab/rooms_corpus_gardens.js <compact.jsonl> <extract dir> <out json> [--showcase <showcase.jsonl> <showcase extract dir>]
// The extract dir is lab/rooms_corpus_extract.js output: its rooms give the windows (wall runs read as window) and
// builds.jsonl gives the turn of each build (rot), which is applied to the compact pieces so both are in one frame.
//
// Window planter: plants (flowers, herbs, crops, bushes, vines, ferns) outside a window, within 0.6 m of the window's
// ends along the wall, 0.1 to 1.4 m out from the wall face, their pivots from 0.8 m under to 0.9 m over the sill (the top
// of the wall under the window). What stands under them and what frames the window are read from the building pieces
// near it. Plant clusters: plants joined when 1.2 m or less apart (single linkage), anywhere in the build.
const fs = require('fs'), path = require('path'), readline = require('readline');
const L = require('./rooms_corpus_lib.js');
const { P, typeOf, qs, q, share, top, inc } = L;

const args = process.argv.slice(2);
const [compact, exDir, outFile] = args;
const si = args.indexOf('--showcase');
const showCompact = si >= 0 ? args[si + 1] : null, showDir = si >= 0 ? args[si + 2] : null;
if (!compact || !exDir || !outFile) { console.error('usage: node lab/rooms_corpus_gardens.js <compact.jsonl> <extract dir> <out json>'); process.exit(1); }
const r2 = v => Math.round(v * 100) / 100;

// plant classes
const plantClass = n => {
  if (/^(Rock|rock|Pickable_Stone|Pickable_Flint|cliff|caverock|Placeable_HardRock|widestone|MineRock|stubbe|HugeRoot|Pickable_.*Remains|Pickable_.*CoreStand|Pickable_MountainCaveCrystal|Pickable_Branch|Pickable_DvergrLantern)/.test(n)) return null;
  if (/^(vines|VineAsh|VineGreen|vineash|Vine)/.test(n)) return 'vine';
  if (/(Tree|^Beech|^Birch|^Oak|^Pine|^Fir|^SwampTree|^YggaShoot|^Ashlands.*Tree|^yggdrasil|^Poplar|^Juniper|^Cherry|^Shrub_?Ash)/.test(n) && !/small/.test(n)) return 'tree';
  if (/(FirTree_small|Beech_small|Birch.*small|Oak.*small|Pine.*small|YggaShoot_small)/.test(n)) return 'small tree';
  if (/(Bush|bush|shrub|Shrub|Fern|fern|Heath|heath)/.test(n)) return 'bush';
  if (/^(sapling_|Pickable_(Barley|Flax|Carrot|Turnip|Onion|SeedOnion|SeedCarrot|SeedTurnip|Potato))/.test(n)) return 'crop';
  if (/^(Pickable_(Dandelion|Thistle|Mushroom.*|Fiddlehead|SmokePuff|JotunPuffs|Magecap|Vineberry)|Mushroom|GlowingMushroom|Fiddleheadfern)/.test(n)) return 'flower';
  if (/^root\d/.test(n)) return 'root';
  return null;
};

async function main() {
  // windows per build, from the rooms (turned frame)
  const wins = new Map(), rot = new Map(), info = new Map();
  for (const line of fs.readFileSync(path.join(exDir, 'builds.jsonl'), 'utf8').split('\n')) { if (!line) continue; const b = JSON.parse(line); rot.set(b.b, b.rot || 0); info.set(b.b, b); }
  for await (const line of readline.createInterface({ input: fs.createReadStream(path.join(exDir, 'rooms.jsonl')) })) {
    if (!line.includes('"window"')) continue;
    const r = JSON.parse(line);
    if (r.cov < 0.5) continue;
    for (const f of r.faces) {
      if (f[9]) continue;
      for (const run of f[10]) {
        if (run[0] !== 'window' || run[2] - run[1] < 0.6) continue;
        if (!wins.has(r.b)) wins.set(r.b, []);
        wins.get(r.b).push({ x0: f[0], z0: f[1], ux: f[2], uz: f[3], nx: f[4], nz: f[5], ht: f[8], a0: run[1], a1: run[2], sill: run[3], stand: r.lvl });
      }
    }
  }
  const out = await scan(compact, wins, rot, info, true);
  let show = null;
  if (showCompact && showDir) {
    const wS = new Map(), rS = new Map(), iS = new Map();
    for (const line of fs.readFileSync(path.join(showDir, 'builds.jsonl'), 'utf8').split('\n')) { if (!line) continue; const b = JSON.parse(line); rS.set(b.b, b.rot || 0); iS.set(b.b, b); }
    for (const line of fs.readFileSync(path.join(showDir, 'rooms.jsonl'), 'utf8').split('\n')) {
      if (!line.includes('"window"')) continue;
      const r = JSON.parse(line);
      for (const f of r.faces) { if (f[9]) continue; for (const run of f[10]) if (run[0] === 'window' && run[2] - run[1] >= 0.6) { if (!wS.has(r.b)) wS.set(r.b, []); wS.get(r.b).push({ x0: f[0], z0: f[1], ux: f[2], uz: f[3], nx: f[4], nz: f[5], ht: f[8], a0: run[1], a1: run[2], sill: run[3], stand: r.lvl }); } }
    }
    show = await scan(showCompact, wS, rS, iS, false);
  }
  fs.writeFileSync(outFile, JSON.stringify({ meta: { made: new Date().toISOString().slice(0, 10), source: 'lab/rooms_corpus_gardens.js', builds: out.builds },
    fields: {
      windows: 'windows read on room walls (runs 0.6 m or wider): windows, builds with windows, share of windows with a planter outside, builds with any planter',
      planters: 'per window planter: plants (count), species (distinct), class mix, plants per meter of window, offset of the plants\' middle from the window middle along the wall (m), out from the wall (m), height of the plants\' pivots over the sill (m), under: what building pieces carry the plants (count of planters), frame: building pieces within 0.45 m of the window ends or just over and under it on the outside (count of planters), species: [prefab, planters]',
      vines: 'builds with vines (vines, VineAsh, VineGreen) and vines per build; vines are left out of clusters and gardens',
      clusters: 'plants other than vines joined at 1.2 m or less: sizes, species per cluster, nearest neighbor spacing (m), spacing over the plant width (under 1 means they overlap), share of clusters whose plants all share one yaw, distinct yaws (15 degree steps) per plant, class mixes, species pairs in one cluster [a+b, clusters]',
      gardens: 'clusters of 6 or more plants: count, size, species, the building pieces carrying them (beds), the building pieces round their edge (edging), the gap from the nearest plant to a wall (m) and the share within 1 m',
      trees: 'tree and small tree prefabs per build kind and per culture (builds)', byCulture: 'flower, bush and crop species per culture: [prefab, builds]', showcase: 'the same counts for the 16 showcase designs',
    }, ...out.res, showcase: show ? show.res : null }, null, 1));
  console.log(outFile, out.builds, 'builds');
}

async function scan(file, wins, rot, info, isCorpus) {
  const culture = new Map();
  try { const m = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/culture-corpus/members.json'), 'utf8')).cultures; for (const [c, l] of Object.entries(m)) for (const [k] of l) culture.set(k, c); } catch (e) { /* none */ }
  const W = { windows: 0, withPlanter: 0, builds: new Set(), buildsPl: new Set() }, VI = [], PL = [], CL = [], GA = [], trees = { byKind: {}, byCulture: {} }, cult = {};
  let bi = -1, nb = 0;
  for await (const line of readline.createInterface({ input: fs.createReadStream(file) })) {
    if (!line.trim()) continue;
    bi++;
    const b = JSON.parse(line);
    if (b.p.some(p => !L.isVanilla(p[0]))) continue;
    nb++;
    const a = rot.get(bi) || 0, ca = Math.cos(a * Math.PI / 180), sa = Math.sin(a * Math.PI / 180);
    const ps = b.p.map(([n, x, y, z, yaw]) => ({ n, x: x * ca - z * sa, y, z: x * sa + z * ca, yaw: yaw - a, c: plantClass(n), role: P.piece(n).role, st: P.piece(n).structural }));
    const plants = ps.filter(p => p.c && p.c !== 'tree' && p.c !== 'root');
    // vines climb walls; they are read on their own, and clusters and gardens are of the other plants
    const vines = plants.filter(p => p.c === 'vine'), beds = plants.filter(p => p.c !== 'vine');
    if (vines.length) VI.push({ n: vines.length, file: b.file });
    const struct = ps.filter(p => p.st && !p.c);
    const cul = culture.get(b.file.replace(/\.blueprint$/, '').split('__')[0]) || null;
    const kind = /tavern|inn\b/i.test(b.title + b.cat) ? 'tavern' : /castle|fort/i.test(b.title + b.cat) ? 'castle' : /temple/i.test(b.title + b.cat) ? 'temple' : /longhouse/i.test(b.title + b.cat) ? 'longhouse' : /farm/i.test(b.title + b.cat) ? 'farm' : /house|home|cabin|starter|cottage/i.test(b.title + b.cat) ? 'home' : 'other';
    for (const t of [...new Map(ps.filter(p => p.c === 'tree' || p.c === 'small tree').map(p => [p.n, p])).values()]) { inc(trees.byKind[kind] = trees.byKind[kind] || {}, t.n); if (cul) inc(trees.byCulture[cul] = trees.byCulture[cul] || {}, t.n); }
    if (cul) { const seen = new Set(plants.map(p => p.n)); for (const n of seen) inc(cult[cul] = cult[cul] || {}, n); }
    // window planters
    const ws = wins.get(bi) || [];
    if (ws.length) W.builds.add(bi);
    for (const w of ws) {
      W.windows++;
      const along = p => (p.x - w.x0) * w.ux + (p.z - w.z0) * w.uz, out = p => -((p.x - w.x0) * w.nx + (p.z - w.z0) * w.nz) - w.ht;
      const sillY = w.stand + w.sill;
      const here = plants.filter(p => { const t = along(p), o = out(p), h = p.y - sillY; return t > w.a0 - 0.6 && t < w.a1 + 0.6 && o > 0.1 && o < 1.4 && h > -0.8 && h < 0.9; });
      if (!here.length) continue;
      W.withPlanter++; W.buildsPl.add(bi);
      const mid = (w.a0 + w.a1) / 2;
      const under = new Set(), frame = new Set();
      for (const p of here) for (const s of struct) {
        const [sw, sh, sd] = P.piece(s.n).size;
        if (Math.abs(s.x - p.x) > Math.max(sw, sd) / 2 + 0.1 || Math.abs(s.z - p.z) > Math.max(sw, sd) / 2 + 0.1) continue;
        const topS = s.y + (/(beam|floor)/.test(s.role) ? sh / 2 : sh / 2);
        if (p.y - topS > -0.35 && p.y - topS < 0.45 && s.y < p.y) under.add(s.n);
      }
      for (const s of struct) {
        const t = along(s), o = out(s), h = s.y - sillY;
        if (o < -0.3 || o > 1.0 || !/(beam|pole)/.test(s.role)) continue;
        const nearEnd = (Math.abs(t - w.a0) < 0.45 || Math.abs(t - w.a1) < 0.45) && h > -0.6 && h < 2.2;
        const overUnder = t > w.a0 - 0.3 && t < w.a1 + 0.3 && ((h > -0.5 && h < 0.3) || (h > 1.2 && h < 2.4));
        if (nearEnd || overUnder) frame.add(s.n);
      }
      const yaws = new Set(here.map(p => Math.round(p.yaw / 15)));
      PL.push({ n: here.length, sp: new Set(here.map(p => p.n)).size, names: [...new Set(here.map(p => p.n))], cls: [...new Set(here.map(p => p.c))].sort().join('+'), perM: here.length / Math.max(0.6, w.a1 - w.a0),
        off: Math.abs(here.reduce((s2, p) => s2 + along(p), 0) / here.length - mid), out: here.reduce((s2, p) => s2 + out(p), 0) / here.length, h: here.reduce((s2, p) => s2 + p.y - sillY, 0) / here.length,
        under: [...under], frame: [...frame], yaws: yaws.size / here.length, file: b.file });
    }
    // clusters
    const used = new Set();
    for (const p of beds) {
      if (used.has(p)) continue;
      const cl = [p]; used.add(p);
      for (let i = 0; i < cl.length; i++) for (const o of beds) { if (used.has(o)) continue; if (Math.hypot(o.x - cl[i].x, o.z - cl[i].z) <= 1.2 && Math.abs(o.y - cl[i].y) < 1.5) { cl.push(o); used.add(o); } }
      if (cl.length < 2) { CL.push({ n: 1 }); continue; }
      const nn = cl.map(a2 => { let m = Infinity, mo = null; for (const o of cl) if (o !== a2) { const d = Math.hypot(o.x - a2.x, o.z - a2.z); if (d < m) { m = d; mo = o; } } const wa = Math.max(P.piece(a2.n).size[0], 0.3), wb = Math.max(P.piece(mo.n).size[0], 0.3); return [m, m / ((wa + wb) / 2)]; });
      const yaws = new Set(cl.map(c => Math.round(c.yaw / 15)));
      const sp = [...new Set(cl.map(c => c.n))].sort();
      const rec = { n: cl.length, sp: sp.length, names: sp, cls: [...new Set(cl.map(c => c.c))].sort().join('+'), nn: q(nn.map(v => v[0]), 0.5), rel: q(nn.map(v => v[1]), 0.5), oneYaw: yaws.size === 1, yawsPer: yaws.size / cl.length };
      CL.push(rec);
      if (cl.length >= 6) {
        const bed = {}, edge = {};
        for (const s of struct) {
          const [sw, sh, sd] = P.piece(s.n).size, rr = Math.max(sw, sd) / 2;
          let isUnder = false, isEdge = false;
          for (const p of cl) {
            const d = Math.hypot(s.x - p.x, s.z - p.z);
            if (d < rr + 0.1 && s.y < p.y && p.y - (s.y + sh / 2) > -0.35 && p.y - (s.y + sh / 2) < 0.45) isUnder = true;
            else if (d < rr + 0.8 && Math.abs(s.y - p.y) < 1.0 && /(fence|beam|wall|pole|floor)/.test(s.role)) isEdge = true;
          }
          if (isUnder) inc(bed, s.n); else if (isEdge) inc(edge, s.n);
        }
        let wallGap = Infinity;
        for (const s of struct) { if (!/^(wall|window|door)$/.test(s.role)) continue; for (const p of cl) { if (Math.abs(s.y - p.y) > 2.5) continue; const [sw, , sd] = P.piece(s.n).size; const d = Math.hypot(s.x - p.x, s.z - p.z) - Math.max(sw, sd) / 2; if (d < wallGap) wallGap = d; } }
        GA.push({ ...rec, bed: Object.keys(bed), edge: Object.keys(edge), wallGap: r2(Math.max(0, wallGap)), file: b.file, culture: cul, kind });
      }
    }
  }
  const pairC = {};
  for (const c of CL.filter(c2 => c2.n >= 2)) for (let i = 0; i < c.names.length; i++) for (let j = i + 1; j < c.names.length; j++) inc(pairC, c.names[i] + '+' + c.names[j]);
  const res = {
    windows: { windows: W.windows, builds: W.builds.size, planterShare: W.windows ? +(W.withPlanter / W.windows).toFixed(3) : null, buildsWithPlanter: W.buildsPl.size },
    planters: { n: PL.length, plants: qs(PL.map(p => p.n)), species: qs(PL.map(p => p.sp)), perMeter: qs(PL.map(p => p.perM)), offCenter: qs(PL.map(p => p.off)), out: qs(PL.map(p => p.out)), overSill: qs(PL.map(p => p.h)),
      distinctYawPerPlant: qs(PL.map(p => p.yaws)), classes: top(PL.reduce((o, p) => inc(o, p.cls), {}), 10), under: top(PL.reduce((o, p) => { for (const u of p.under) inc(o, u); return o; }, {}), 15), noneUnder: share(PL, p => !p.under.length),
      frame: top(PL.reduce((o, p) => { for (const u of p.frame) inc(o, u); return o; }, {}), 15), framed: share(PL, p => p.frame.length > 0), species: top(PL.reduce((o, p) => { for (const u of p.names) inc(o, u); return o; }, {}), 20),
      examples: PL.filter(p => p.n >= 3).slice(0, 10).map(p => ({ file: p.file, plants: p.n, species: p.names, under: p.under, frame: p.frame })) },
    vines: { builds: VI.length, perBuild: qs(VI.map(v => v.n)) },
    clusters: { all: CL.length, single: share(CL, c => c.n === 1), size: qs(CL.filter(c => c.n >= 2).map(c => c.n)), species: qs(CL.filter(c => c.n >= 2).map(c => c.sp)), oneSpecies: share(CL.filter(c => c.n >= 2), c => c.sp === 1),
      spacing: qs(CL.filter(c => c.n >= 2).map(c => c.nn)), spacingOverWidth: qs(CL.filter(c => c.n >= 2).map(c => c.rel)), oneYaw: share(CL.filter(c => c.n >= 2), c => c.oneYaw), yawsPerPlant: qs(CL.filter(c => c.n >= 2).map(c => c.yawsPer)),
      classes: top(CL.filter(c => c.n >= 2).reduce((o, c) => inc(o, c.cls), {}), 12), speciesPairs: top(pairC, 30) },
    gardens: { n: GA.length, size: qs(GA.map(g => g.n)), species: qs(GA.map(g => g.sp)), oneSpecies: share(GA, g => g.sp === 1), mixes: top(GA.reduce((o, g) => inc(o, g.names.slice(0, 6).join('+')), {}), 15),
      bed: top(GA.reduce((o, g) => { for (const u of g.bed) inc(o, u); return o; }, {}), 15), noBed: share(GA, g => !g.bed.length), edge: top(GA.reduce((o, g) => { for (const u of g.edge) inc(o, u); return o; }, {}), 15),
      bedPrefabsPerGarden: qs(GA.filter(g => g.bed.length).map(g => g.bed.length)), wallGap: qs(GA.filter(g => isFinite(g.wallGap)).map(g => g.wallGap)), atWall: share(GA, g => g.wallGap < 1),
      byKind: top(GA.reduce((o, g) => inc(o, g.kind), {}), 8), examples: GA.filter(g => g.sp >= 2).slice(0, 12).map(g => ({ file: g.file, plants: g.n, species: g.names, bed: g.bed, edge: g.edge, wallGap: g.wallGap })) },
    trees: { byKind: Object.fromEntries(Object.entries(trees.byKind).map(([k, o]) => [k, top(o, 8)])), byCulture: Object.fromEntries(Object.entries(trees.byCulture).map(([k, o]) => [k, top(o, 8)])) },
    byCulture: Object.fromEntries(Object.entries(cult).map(([k, o]) => [k, top(o, 12)])),
  };
  return { builds: nb, res };
}
main();
