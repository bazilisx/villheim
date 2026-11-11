// What a person sees of the essentials: per building kind, the distinct prefabs among beds, tables, seats, rugs, lights
// and chests, and the share of floors that use the single most common choice of each; then how the essentials stand,
// against the corpus relations (research branch data/culture-corpus/summary.json, relx and rel, D-136).
//
// Usage, from tools/blueprint-lab: node lab/essentials.js [lib dir] [--seeds 2] [--json out.json]
// The lib dir is the generator to measure (default ../lib), so an older tree can be measured the same way.
// Sample: home, longhouse, tavern, smithy, workshop, storage in Meadows, Black Forest, Swamp, Mountain, Plains and
// Mistlands, at s2d2 and s3d3, seeds 11 + 97 s (216 designs at three seeds), no yards. A "floor" is the furniture of one
// design within 1.6 m of one floor level (the generator's rooms overlap, so a floor stands in for a room).
// Relations, as the corpus note defines them where it does:
// - offAxis: turned more than 10 degrees off the design's wall axes (tables, seats, rugs).
// - seatsByWall: a seat's pivot within 1.1 m of a wall piece's box.
// - seatsAtTable: a seat within 2.2 m of a table (the corpus rel.seatsAtTables, pivots).
// - seatsByFire: a seat within 3.5 m of a fire (rel.seatsByFire).
// - rugsLayered: a rug with another rug within 1.2 m and 0.3 m in height (rel.rugsLayered).
// - chestsStacked: a chest with another within 0.6 m across and 0.3 to 1.5 m above or below (the corpus note).
// - chestsPaired: a chest with another of the same kind beside it, sides 0.15 m apart or closer (this file's own).
// - tablesDressed: a table with a loose piece within 0.9 m and 0.5 to 1.6 m over its pivot (rel.tablesDressed).
// - tablesWithSeats: a table with a seat within 2.2 m (rel.tablesWithSeats, this file's reading of it).
// - bedsAboveMain: a bed more than 1.2 m over the lowest storey with a fire (or the lowest storey) (rel.bedsAboveMainFloor).
// - bedsOnFireStorey: a bed with a fire within 1.2 m in height (rel.bedsOnFireStorey).
// - bedsSideBySide: a bed with another bed of the same facing within 2.6 m, 0.3 m in height (rel.bedsSideBySide, this
//   file's reading).
// - wallSeatsCrowded: seats more than 2.2 m from every table with another such seat within 1.2 m.
// - Table to fire: the distance from each table to the nearest fire on its storey (0.3 m in height), quartiles, against
//   data/interior.json items piece_table fire [3.73, 7.44, 14.94] and piece_table_round [3.93, 6.54, 12.61].
// - Door distance: tables, seats and chests to the nearest door piece on their storey, quartiles, against the corpus
//   items' door quartiles in data/interior.json.
// - Bare floor: per design, the share of the ground storey's covered floor (1 m points on floor pieces with a roof or
//   floor 2 to 9 m over them) farther than 2.5 m from every piece standing on that floor (rugs, mounts and things
//   on tables left out); the mean over designs. The corpus has no count for this; it is a measure of what the lead
//   saw (bare halves of big rooms).
const path = require('path');
const flags = process.argv.slice(2);
const arg = (k, d) => (flags.includes(k) ? flags[flags.indexOf(k) + 1] : d);
const libDir = path.resolve(flags[0] && !/^--/.test(flags[0]) ? flags[0] : path.join(__dirname, '../lib'));
const seeds = +arg('--seeds', 3), jsonOut = arg('--json', null);
const G = require(path.join(libDir, 'generate.js')), PB = require(path.join(libDir, 'pieces.js'));
const TYPES = ['home', 'longhouse', 'tavern', 'smithy', 'workshop', 'storage'];
const BIOMES = ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains', 'Mistlands'];
const STAGES = [['s2', 'd2'], ['s3', 'd3']];
const CAT = {
  bed: /^(bed|piece_bed0\d|ashwood_bed)$/,
  table: /^(piece_table|piece_table_round|piece_table_oak|dvergrprops_table|piece_blackmarble_table|cauldron_ext3_butchertable|piece_magetable)$/,
  seat: /^(piece_chair\d*|piece_bench01|piece_logbench01|piece_blackwood_bench01|piece_blackmarble_bench|dvergrprops_stool|dvergrprops_chair|piece_throne0\d|piece_blackmarble_throne|piece_bone_throne)$/,
  rug: /^(rug_|jute_carpet)/,
  light: /torch|lantern|brazier|Candle|sconce|piece_Lavalantern/,
  chest: /^(piece_chest(_wood|_barrel|_blackmetal)?|dvergrprops_barrel|dvergrprops_crate(_long)?|piece_chest_private)$/,
};
const catOf = n => Object.keys(CAT).find(k => CAT[k].test(n)) || null;
const yawOf = p => (p.yaw != null ? p.yaw : Math.atan2(2 * (p.q[3] * p.q[1] + p.q[0] * p.q[2]), 1 - 2 * (p.q[1] * p.q[1] + p.q[0] * p.q[0])) * 180 / Math.PI);
const off90 = a => { const m = ((a % 90) + 90) % 90; return Math.min(m, 90 - m); };
const box = p => { const s = PB.piece(p.name).size || [1, 1, 1], a = yawOf(p) * Math.PI / 180, c = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a)); const hx = (c * s[0] + sn * s[2]) / 2, hz = (sn * s[0] + c * s[2]) / 2; return { x0: p.x - hx, x1: p.x + hx, z0: p.z - hz, z1: p.z + hz, y0: p.y - s[1] / 2, y1: p.y + s[1] / 2 }; };
const ptBox = (x, z, b) => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1));

function run() {
  const kinds = {}, rel = {};
  const r = (k, hit) => { const e = rel[k] || (rel[k] = [0, 0]); e[1]++; if (hit) e[0]++; };
  let n = 0, ms = 0;
  const tableFire = [], bare = [], doorD = { table: [], seat: [], chest: [] };
  for (const type of TYPES) for (const biome of BIOMES) for (const [stage, decor] of STAGES) for (let s = 0; s < seeds; s++) {
    const t0 = Date.now();
    const d = G.generate({ type, biome, stage, decor, seed: 11 + 97 * s, yard: false });
    ms += Date.now() - t0; n++;
    const walls = d.pieces.filter(p => !p.decor && ['wall', 'window', 'door'].includes(PB.piece(p.name).role));
    // the design's wall axis: the most common wall yaw, mod 90
    const hist = new Map();
    for (const w of walls) { const k = Math.round(((yawOf(w) % 90) + 90) % 90); hist.set(k, (hist.get(k) || 0) + 1); }
    const axis = [...hist.entries()].sort((a, b) => b[1] - a[1])[0];
    const ax = axis ? axis[0] : 0;
    const wb = walls.map(box);
    const dec = d.pieces.filter(p => p.decor && !p.outside && !p.yard);
    const fires = dec.filter(p => /^(fire_pit|hearth|fire_pit_iron|bonfire)/.test(p.name));
    const levels = [...new Set(dec.filter(p => catOf(p.name)).map(p => Math.round(p.y / 1.6)))];
    const K = kinds[type] || (kinds[type] = {});
    for (const lv of levels) {
      const on = dec.filter(p => Math.round(p.y / 1.6) === lv);
      for (const c of Object.keys(CAT)) {
        const names = new Set(on.filter(p => catOf(p.name) === c).map(p => p.name));
        if (!names.size) continue;
        const e = K[c] || (K[c] = { floors: 0, names: new Map() });
        e.floors++;
        for (const nm of names) e.names.set(nm, (e.names.get(nm) || 0) + 1);
      }
    }
    const of = c => dec.filter(p => catOf(p.name) === c);
    const tables = of('table'), seats = of('seat'), rugs = of('rug'), chests = of('chest');
        for (const p of tables) r('tablesOffAxis', off90(yawOf(p) - ax) > 10);
    for (const p of seats) {
      r('seatsOffAxis', off90(yawOf(p) - ax) > 10);
      r('seatsByWall', wb.some(b => Math.abs(b.y0 - p.y) < 2.5 && ptBox(p.x, p.z, b) < 1.1));
      r('seatsAtTable', tables.some(t => Math.abs(t.y - p.y) < 1 && Math.hypot(t.x - p.x, t.z - p.z) < 2.2));
      r('seatsByFire', fires.some(f => Math.abs(f.y - p.y) < 1.2 && Math.hypot(f.x - p.x, f.z - p.z) < 3.5));
    }
    const rb = rugs.map(box);
    rugs.forEach((p, i) => {
      r('rugsOffAxis', off90(yawOf(p) - ax) > 10);
      r('rugsLayered', rugs.some((q, j) => j !== i && Math.abs(q.y - p.y) < 0.3 && Math.hypot(q.x - p.x, q.z - p.z) < 1.2));
    });
    const cb = chests.map(box);
    chests.forEach((p, i) => {
      r('chestsStacked', chests.some((q, j) => j !== i && Math.hypot(q.x - p.x, q.z - p.z) < 0.6 && Math.abs(q.y - p.y) >= 0.3 && Math.abs(q.y - p.y) <= 1.5));
      r('chestsPaired', chests.some((q, j) => j !== i && q.name === p.name && Math.abs(q.y - p.y) < 0.2 && Math.max(cb[j].x0 - cb[i].x1, cb[i].x0 - cb[j].x1, cb[j].z0 - cb[i].z1, cb[i].z0 - cb[j].z1) < 0.15));
    });
    const loose = dec.filter(q => !/^(rug_|jute_carpet)/.test(q.name) && !CAT.table.test(q.name) && !CAT.seat.test(q.name) && !CAT.bed.test(q.name));
    for (const p of tables) r('tablesDressed', loose.some(q => Math.hypot(q.x - p.x, q.z - p.z) < 0.9 && q.y - p.y >= 0.5 && q.y - p.y <= 1.6));
    for (const p of tables) r('tablesWithSeats', seats.some(q => Math.abs(q.y - p.y) < 1 && Math.hypot(q.x - p.x, q.z - p.z) < 2.2));
    const doors = d.pieces.filter(p => !p.decor && PB.piece(p.name).role === 'door');
    for (const [c, list] of [['table', tables], ['seat', seats], ['chest', chests]]) for (const p of list) {
      const dd = doors.filter(q => q.y - p.y > -0.6 && q.y - p.y < 1.6).map(q => Math.hypot(q.x - p.x, q.z - p.z));
      if (dd.length) doorD[c].push(Math.min(...dd));
    }
    for (const p of tables) { const fd = fires.filter(f => Math.abs(f.y - p.y) < 0.3).map(f => Math.hypot(f.x - p.x, f.z - p.z)); if (fd.length) tableFire.push(Math.min(...fd)); }
    const free = seats.filter(p => !tables.some(t => Math.abs(t.y - p.y) < 1 && Math.hypot(t.x - p.x, t.z - p.z) < 2.2));
    for (const p of free) r('wallSeatsCrowded', free.some(q => q !== p && Math.abs(q.y - p.y) < 0.3 && Math.hypot(q.x - p.x, q.z - p.z) < 1.2));
    const beds = of('bed');
    if (beds.length) {
      const fy = fires.map(f => f.y), ly = Math.min(...dec.map(p => p.y));
      const main = fy.length ? Math.min(...fy) : ly;
      for (const p of beds) {
        r('bedsAboveMain', p.y > main + 1.2);
        r('bedsOnFireStorey', fires.some(f => Math.abs(f.y - p.y) < 1.2));
        r('bedsSideBySide', beds.some(q => q !== p && Math.abs(q.y - p.y) < 0.3 && Math.hypot(q.x - p.x, q.z - p.z) < 2.6 && off90(yawOf(q) - yawOf(p)) < 10 && Math.abs(((yawOf(q) - yawOf(p)) % 360 + 360) % 360 - 180) > 10));
      }
    }
    // bare floor of the ground storey
    const fl = d.pieces.filter(p => !p.decor && PB.piece(p.name).role === 'floor');
    if (fl.length) {
      const f0 = Math.min(...fl.map(p => p.y));
      const over = d.pieces.filter(p => !p.decor && ['roof', 'floor'].includes(PB.piece(p.name).role) && p.y > f0 + 2 && p.y < f0 + 9).map(box);
      const stand = dec.filter(p => !/^(rug_|jute_carpet)/.test(p.name) && Math.abs(p.y - f0) < 0.6).map(box);
      if (stand.length) {
        let pts = 0, far = 0;
        for (const f of fl.filter(p => Math.abs(p.y - f0) < 0.3)) {
          const s = PB.piece(f.name).size || [2, 0.25, 2], fb = box(f);
          for (let x = fb.x0 + 0.5; x < fb.x1; x += 1) for (let z = fb.z0 + 0.5; z < fb.z1; z += 1) {
            if (!over.some(o => x > o.x0 && x < o.x1 && z > o.z0 && z < o.z1)) continue;
            pts++;
            if (!stand.some(b2 => ptBox(x, z, b2) < 2.5)) far++;
          }
          void s;
        }
        if (pts) bare.push(far / pts);
      }
    }
  }
  const out = { designs: n, msPer: Math.round(ms / n), kinds: {}, rel: {} };
  for (const [t, K] of Object.entries(kinds)) {
    out.kinds[t] = {};
    for (const [c, e] of Object.entries(K)) {
      const top = [...e.names.entries()].sort((a, b) => b[1] - a[1]);
      out.kinds[t][c] = { floors: e.floors, distinct: e.names.size, top: top[0][0], topShare: Math.round(100 * top[0][1] / e.floors) };
    }
  }
  for (const [k, [h, t]] of Object.entries(rel)) out.rel[k] = { pct: t ? Math.round(1000 * h / t) / 10 : 0, of: t };
  const q = (a, f) => { const b = a.slice().sort((x, y) => x - y); return b.length ? Math.round(b[Math.min(b.length - 1, Math.floor(f * b.length))] * 100) / 100 : null; };
  out.doorDist = Object.fromEntries(Object.entries(doorD).map(([k, a]) => [k, { n: a.length, q: [q(a, 0.25), q(a, 0.5), q(a, 0.75)] }]));
  out.tableFire = { n: tableFire.length, q: [q(tableFire, 0.25), q(tableFire, 0.5), q(tableFire, 0.75)] };
  out.bare = { designs: bare.length, mean: bare.length ? Math.round(1000 * bare.reduce((a, b) => a + b, 0) / bare.length) / 10 : null, over20: bare.filter(v => v > 0.2).length };
  return out;
}

if (require.main === module) {
  const o = run();
  console.log(`${o.designs} designs from ${libDir}, ${o.msPer} ms each`);
  const cats = Object.keys(CAT);
  console.log('kind'.padEnd(10) + cats.map(c => c.padStart(16)).join(''));
  for (const [t, K] of Object.entries(o.kinds)) console.log(t.padEnd(10) + cats.map(c => (K[c] ? `${K[c].distinct} / ${K[c].topShare}%` : '-').padStart(16)).join(''));
  console.log('(distinct prefabs / share of floors using the most common one)');
  for (const [t, K] of Object.entries(o.kinds)) console.log(t.padEnd(10) + cats.map(c => (K[c] ? K[c].top : '-').slice(0, 15).padStart(16)).join(''));
  for (const [k, v] of Object.entries(o.rel)) console.log(k.padEnd(16), String(v.pct).padStart(6), '%', `of ${v.of}`);
  console.log('table to fire (m, quartiles)', o.tableFire.q.join(' / '), `of ${o.tableFire.n}`, '(corpus piece_table 3.73 / 7.44 / 14.94, round 3.93 / 6.54 / 12.61)');
  for (const [k, v] of Object.entries(o.doorDist)) console.log(`${k} to the nearest door on its storey (m)`, v.q.join(' / '), `of ${v.n}`);
  console.log('(corpus, data/interior.json items door quartiles: piece_table 2.71 / 3.75 / 6.63, round 3.41 / 4.82 / 6.56, piece_chair 2.64 / 4.37 / 7.23, piece_chest_wood 2.02 / 3.69 / 6.46)');
  console.log(`bare ground floor ${o.bare.mean} % mean over ${o.bare.designs} designs; ${o.bare.over20} designs over 20 %`);
  if (jsonOut) require('fs').writeFileSync(jsonOut, JSON.stringify(o, null, 1));
}
module.exports = { run };
