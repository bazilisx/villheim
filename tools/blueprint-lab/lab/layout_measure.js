// node lab/layout_measure.js [lib dir] [seeds] [out.json] [--household]
// Lanes and layout variance over a sample (docs/ROOM_LAYOUT.md): per room the walkable share, the share of it joined to
// the first door, the targets reached (doors, fire, stairs, beds; with the furniture and with the structure alone), the
// main lane's width; per request, how much the anchor layout repeats across seeds: beds, tables, stations, the fire and
// storage, each by its depth from the door in thirds, middle or side, and facing the door, away or across. Measured with this tree's lib/layout.js whatever generator made the design.
const path = require('path');
const HOUSE = process.argv.includes('--household');
process.argv = process.argv.filter(a => a !== '--household');
const lib = path.resolve(process.argv[2] || path.join(__dirname, '../lib'));
const seeds = +(process.argv[3] || 4);
const G = require(lib + '/generate.js');
const S = require(lib + '/styles.js');
const L = require('../lib/layout.js');
const K = require('../lib/kitbash.js');
const PL = require('../lib/pieces.js');
const types = ['home', 'longhouse', 'tavern', 'smithy', 'workshop', 'storage', 'temple'];
const biomes = ['Meadows', 'Black Forest', 'Swamp', 'Plains'];
const stages = [['s1', 'd1'], ['s2', 'd2'], ['s3', 'd3']];
const rows = [], sig = new Map();
const ANCH = ['bed', 'table', 'craft', 'fire', 'storage'];
for (const type of types) for (const biome of biomes) for (const [stage, decor] of stages) for (let s = 0; s < seeds; s++) {
  const seed = 5 + s * 37;
  // --household: one building, another layout draw per 'seed' (ctx.layout.seed), to see the planner's own variety
  const d = HOUSE ? G.generate({ type, biome, stage, decor, seed: 5, yard: false, layout: { seed: s } }) : G.generate({ type, biome, stage, decor, seed, yard: false });
  const ctx = { T: S.TYPES[type], type, decor };
  const rooms = K.roomsB(d, ctx);
  const m = L.measure(d, ctx, rooms);
  for (const r of m) rows.push({ type, biome, stage, ...r });
  // the anchor layout: each anchor's place in thirds of the room's box and its facing in quarters, per room
  const key = `${type}|${biome}|${stage}`;
  const set = new Set();
  for (const room of rooms) {
    // in the frame of the room's first door: depth in thirds, middle or side, facing the door, away or across
    const M = room.m, dr = M.doors[0];
    if (!dr) continue;
    const v = (x, z) => (x - dr.x) * dr.nx + (z - dr.z) * dr.nz, u = (x, z) => -(x - dr.x) * dr.nz + (z - dr.z) * dr.nx;
    let D = 0.1, W = 0.1;
    for (const c of M.cells) { D = Math.max(D, v(c.x, c.z)); W = Math.max(W, Math.abs(u(c.x, c.z))); }
    for (const p of d.pieces) {
      if (!p.decor || !M.inside(p.x, p.z) || Math.abs(p.y - M.stand) > 0.8) continue;
      const role = PL.piece(p.name).role;
      if (!ANCH.includes(role)) continue;
      const a = (p.yaw != null ? p.yaw : 0) * Math.PI / 180, fx = Math.sin(a), fz = Math.cos(a);
      const toward = -(fx * dr.nx + fz * dr.nz), face = toward > 0.7 ? 'to' : toward < -0.7 ? 'away' : 'across';
      set.add(`${room.li}|${role}|${Math.min(2, Math.floor(3 * v(p.x, p.z) / D))}|${Math.abs(u(p.x, p.z)) / W < 0.33 ? 'mid' : 'side'}|${face}`);
    }
  }
  if (!sig.has(key)) sig.set(key, []);
  sig.get(key).push(set);
}
const avg = (a, f) => a.length ? a.reduce((x, r) => x + f(r), 0) / a.length : 0;
const furnished = rows.filter(r => r.area >= 8);
let sim = 0, pairs = 0;
for (const list of sig.values()) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
  const a = list[i], b = list[j];
  const inter = [...a].filter(x => b.has(x)).length, uni = new Set([...a, ...b]).size;
  if (uni) { sim += inter / uni; pairs++; }
}
const lanes = furnished.filter(r => r.laneWidth != null);
const out = {
  lib, rooms: furnished.length,
  walkable: +avg(furnished, r => r.walk).toFixed(3),
  joined: +avg(furnished, r => r.joined).toFixed(3),
  allTargets: +(furnished.filter(r => r.reached === r.targets).length / furnished.length).toFixed(3),
  allTargetsStructure: +(furnished.filter(r => r.reachedBare === r.targets).length / furnished.length).toFixed(3),
  furnitureBlocks: furnished.filter(r => r.reachedBare === r.targets && r.reached < r.targets).length,
  laneWidth: +avg(lanes, r => r.laneWidth).toFixed(2),
  laneUnder12: +(lanes.filter(r => r.laneWidth < 1.2).length / Math.max(1, lanes.length)).toFixed(3),
  anchorRepeat: +(sim / pairs).toFixed(3),
};
const by = {};
for (const r of furnished) { const k = r.role; by[k] = by[k] || []; by[k].push(r); }
out.byRole = Object.fromEntries(Object.entries(by).map(([k, v]) => [k, { n: v.length, walk: +avg(v, r => r.walk).toFixed(2), joined: +avg(v, r => r.joined).toFixed(2), all: +(v.filter(r => r.reached === r.targets).length / v.length).toFixed(2), lane: +avg(v.filter(r => r.laneWidth != null), r => r.laneWidth).toFixed(2) }]));
console.log(JSON.stringify(out, null, 1));
if (process.argv[4]) require('fs').writeFileSync(process.argv[4], JSON.stringify({ out, rows }, null, 1));
