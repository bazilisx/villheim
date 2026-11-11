// The village hub (lib/hub.js): node lab/test_hub.js [render-dir] [seeds]
// For each line (Norse cross, Celtic round, Anglo-Saxon octagon, Middle Eastern part round), every stage s1 to s5 at d1
// and d3, and for every village culture its own line at s2 to s5 (d3, seed 1):
// every check in lib/checks.js passes; the shape family measured from the walls and roofs holds from s2 to s5 (D-132);
// the fire is at the hub's heart and the notice board in the hearth area at every stage (D-140); the leader's marker is
// there (D-141); item stands for mementos stay empty (D-134); the s1 camp lies inside the s5 plot (D-083); s5 has the
// most floor of any building in its culture's set (every other type at s3, the lab's last stage for them) and stands no
// higher than lib/hub.js capFor allows (styles.js HUB: the culture's tallest other building and capStoreys storeys);
// from s3 a high seat and the seat beside it for the spouse (D-154), from s4 a gallery reached by a stair.
// Every floor of every stage s2 to s5 is reached on foot from a door to the outside, by its stairs and ladders, and so is
// every bed, table, station and chest; nothing stands in a doorway's entry zone (the reach logic of lab/reach.js).
// Renders each line s1, s3 and s5 into the render dir (default /tmp/hub3-renders). Exits 1 on a failure.
const path = require('path'), fs = require('fs');
const G = require('../lib/generate.js'), Ck = require('../lib/checks.js'), P = require('../lib/pieces.js');
const S = require('../lib/styles.js'), H = require('../lib/hub.js');
const outDir = process.argv[2] || '/tmp/hub3-renders';
const seeds = +(process.argv[3] || 2);
let failed = 0;
const ok = (cond, what) => { if (!cond) { failed++; console.log('FAIL', what); } };

const LINES = [
  { id: 'norse-cross', culture: 'norse', biome: 'Meadows', line: 'cross' },
  { id: 'celtic-round', culture: 'celtic', biome: 'Black Forest', line: 'round' },
  { id: 'anglo-saxon-octagon', culture: 'anglo-saxon', biome: 'Meadows', line: 'octagon' },
  { id: 'middle-eastern-part', culture: 'middle-eastern', biome: 'Plains', line: 'part' },
];
const famOf = line => (line === 'cross' ? 'cross' : 'round');

// Shape family from the pieces: a wall turned off the square makes it round (rings and octagons); an orthogonal plan
// whose ground floor fills under 85 % of its bounding box with the fire's middle covered is a cross.
function family(d) {
  const walls = d.pieces.filter(p => ['wall', 'door', 'window'].includes(P.piece(p.name).role) && !p.notice && !p.decor && p.y < 3);
  if (!walls.length) return 'camp';
  if (walls.some(p => { const a = (((p.yaw || 0) % 90) + 90) % 90; return a > 5 && a < 85; })) return 'round';
  const fl = d.pieces.filter(p => P.piece(p.name).role === 'floor' && !p.decor && !p.dais && Math.abs(p.y) < 0.2);
  const xs = fl.map(p => p.x), zs = fl.map(p => p.z);
  const area = fl.reduce((a, p) => a + P.piece(p.name).size[0] * P.piece(p.name).size[2], 0);
  const boxA = (Math.max(...xs) - Math.min(...xs) + 2) * (Math.max(...zs) - Math.min(...zs) + 2);
  return area / boxA < 0.85 ? 'cross' : 'square';
}
// Floor on every level, m2, and the height
function measure(d) {
  let area = 0, top = 0;
  for (const p of d.pieces) {
    const pi = P.piece(p.name);
    if (pi.role === 'floor' && !p.yard && !p.dais) area += pi.size[0] * pi.size[2];
    if (pi.structural) top = Math.max(top, p.y + pi.size[1] / 2);
  }
  return { area: Math.round(area), top: +top.toFixed(1) };
}
const box = ps => { const xs = ps.map(p => p.x), zs = ps.map(p => p.z); return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }; };

// Can a person walk in and round a design (D-148, D-152)? The logic of lab/reach.js on design/integration2, copied here
// while that module is not on this branch: rooms (room rects) and main pieces (beds, tables, stations, chests) with no
// cell reached from a door to the outside, climbing every stair and ladder; furniture standing in a door's entry zone.
function reach(design) {
  const D = require('../lib/decorate.js');
  const F = D.FURNITURE, I = D._int;
  const S = 0.25, R = 0.45, rooms = (design.rooms || []).filter(r => r.x1 > r.x0 && r.z1 > r.z0);
  const out = { rooms: 0, roomsOut: [], pieces: 0, piecesOut: [], entry: [] };
  if (!rooms.length) return out;
  const pieces = design.pieces;
  const PASS = new Set(['floor', 'rug', 'roof', 'roofTop', 'roofCorner', 'door', 'nature', 'misc']);
  const hungAt = p => { const f = F[p.name]; return f && ['mount', 'hang', 'top', 'rug'].includes(f.at); };
  // each piece's footprint test and its height range
  const solids = [];
  for (const p of pieces) {
    const role = P.piece(p.name).role;
    if (PASS.has(role) || (p.decor && hungAt(p)) || p.onTable) continue;
    if (role === 'stair') continue; // a climb is walked as a portal; its own cells are not floor
    { const o = Ck.aabbShapes(p); if (o.pass) continue; solids.push({ p, y0: o.y0, y1: o.y1, d: (x, z) => Math.hypot(Math.max(o.x0 - x, 0, x - o.x1), Math.max(o.z0 - z, 0, z - o.z1)), bx: (o.x0 + o.x1) / 2, bz: (o.z0 + o.z1) / 2, r: Math.hypot(o.x1 - o.x0, o.z1 - o.z0) / 2 }); }
  }
  // floors by height
  const levels = [...new Set(rooms.map(r => Math.round(r.y * 4) / 4))].sort((a, b) => a - b);
  const grids = new Map();
  for (const y of levels) {
    const rs = rooms.filter(r => Math.abs(r.y - y) < 0.2);
    const x0 = Math.min(...rs.map(r => r.x0)), x1 = Math.max(...rs.map(r => r.x1)), z0 = Math.min(...rs.map(r => r.z0)), z1 = Math.max(...rs.map(r => r.z1));
    const here = solids.filter(s => s.y0 < y + 1.8 && s.y1 > y + 0.25);
    const cells = new Map();
    for (let x = x0 + S / 2; x < x1; x += S) for (let z = z0 + S / 2; z < z1; z += S) {
      if (!rs.some(r => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1)) continue;
      const free = !here.some(s => Math.abs(s.bx - x) < s.r + R + 0.01 && Math.abs(s.bz - z) < s.r + R + 0.01 && s.d(x, z) < R);
      cells.set(`${Math.round(x / S)},${Math.round(z / S)}`, { x, z, free, seen: false });
    }
    grids.set(y, { rs, cells });
  }
  const near = (g, x, z, rad) => [...g.cells.values()].filter(c => c.free && Math.hypot(c.x - x, c.z - z) <= rad);
  const queue = [];
  const seed = (y, c) => { if (!c.seen) { c.seen = true; queue.push([y, c]); } };
  // doors to the outside
  const doors = pieces.filter(p => !p.decor && P.piece(p.name).role === 'door');
  for (const p of doors) {
    const o = P.doorOpening(p);
    const y = levels.find(l => Math.abs(l - o.y) < 0.6);
    if (y == null) continue;
    const g = grids.get(y);
    const inRoom = (x, z) => g.rs.some(r => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
    for (const sg of [1, -1]) {
      const ix = o.x + o.nx * sg * 0.8, iz = o.z + o.nz * sg * 0.8, ox = o.x - o.nx * sg * 0.8, oz = o.z - o.nz * sg * 0.8;
      if (inRoom(ix, iz) && !inRoom(ox, oz)) for (const c of near(g, o.x + o.nx * sg * 0.6, o.z + o.nz * sg * 0.6, 1.2)) seed(y, c);
      // the entry zone on each inside side
      if (inRoom(ix, iz)) {
        const hw = o.w / 2 + 0.3, ux = o.ux, uz = o.uz, nx = o.nx * sg, nz = o.nz * sg;
        for (const s of solids) {
          if (!s.p.decor || s.y0 > y + 1.8 || s.y1 < y + 0.05) continue;
          // the piece's box against the zone: sample its footprint by distance from points of the zone
          let hit = false;
          for (let a = -hw; a <= hw + 1e-6 && !hit; a += 0.25) for (let dd = 0.15; dd <= 1.5 + 1e-6 && !hit; dd += 0.25) if (s.d(o.x + ux * a + nx * dd, o.z + uz * a + nz * dd) < 0.01) hit = true;
          if (hit && !out.entry.some(e => e.p === s.p)) out.entry.push({ p: s.p, name: s.p.name, at: `${s.p.x.toFixed(1)},${s.p.y.toFixed(1)},${s.p.z.toFixed(1)}` });
        }
      }
    }
  }
  // climbs: touching stair and ladder pieces
  const climbs = [];
  for (const p of pieces.filter(q => !q.decor && P.piece(q.name).role === 'stair')) {
    const o = Ck.aabb(p);
    const touch = climbs.filter(c => c.some(q => q.o.x0 < o.x1 + 0.3 && q.o.x1 > o.x0 - 0.3 && q.o.z0 < o.z1 + 0.3 && q.o.z1 > o.z0 - 0.3 && q.o.y0 < o.y1 + 0.3 && q.o.y1 > o.y0 - 0.3));
    const merged = [{ p, o }, ...touch.flat()];
    for (const t of touch) climbs.splice(climbs.indexOf(t), 1);
    climbs.push(merged);
  }
  const links = [];
  for (const c of climbs) {
    const lo = c.reduce((a, q) => (q.o.y0 < a.o.y0 ? q : a)), hi = c.reduce((a, q) => (q.o.y1 > a.o.y1 ? q : a));
    const yl = levels.filter(l => Math.abs(l - lo.o.y0) < 0.7).sort((a, b) => Math.abs(a - lo.o.y0) - Math.abs(b - lo.o.y0))[0];
    const yh = levels.filter(l => Math.abs(l - hi.o.y1) < 0.9 && l !== yl).sort((a, b) => Math.abs(a - hi.o.y1) - Math.abs(b - hi.o.y1))[0];
    if (yl == null || yh == null) continue;
    const d = (q, x, z) => Math.hypot(Math.max(q.o.x0 - x, 0, x - q.o.x1), Math.max(q.o.z0 - z, 0, z - q.o.z1));
    const a = [...grids.get(yl).cells.values()].filter(cc => cc.free && d(lo, cc.x, cc.z) <= 1.2);
    const b = [...grids.get(yh).cells.values()].filter(cc => cc.free && d(hi, cc.x, cc.z) <= 1.2);
    if (a.length && b.length) links.push([yl, a, yh, b]);
  }
  if (!queue.length) { const g = grids.get(levels[0]); const m = g.rs.find(r => r.main) || g.rs[0]; for (const c of g.cells.values()) if (c.free && c.x > m.x0 && c.x < m.x1 && c.z > m.z0 && c.z < m.z1) { seed(levels[0], c); break; } }
  const walk = () => {
    while (queue.length) {
      const [y, c] = queue.pop(), g = grids.get(y);
      const i = Math.round(c.x / S), j = Math.round(c.z / S);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = g.cells.get(`${i + di},${j + dj}`); if (n && n.free && !n.seen) { n.seen = true; queue.push([y, n]); } }
    }
  };
  walk();
  for (let k = 0; k < links.length + 1; k++) {
    let more = false;
    for (const [yl, a, yh, b] of links) {
      if (a.some(c => c.seen) && !b.some(c => c.seen)) { for (const c of b) seed(yh, c); more = true; }
      if (b.some(c => c.seen) && !a.some(c => c.seen)) { for (const c of a) seed(yl, c); more = true; }
    }
    walk();
    if (!more) break;
  }
  // rooms and main pieces
  for (const r of rooms) {
    out.rooms++;
    const g = grids.get(levels.find(l => Math.abs(l - r.y) < 0.2));
    const ok = [...g.cells.values()].some(c => c.seen && c.x > r.x0 && c.x < r.x1 && c.z > r.z0 && c.z < r.z1);
    if (!ok) out.roomsOut.push(`room ${r.x0},${r.z0} to ${r.x1},${r.z1} at ${r.y}`);
  }
  const MAIN = new Set(['bed', 'table', 'craft', 'storage']);
  for (const s of solids) {
    const p = s.p, f = F[p.name];
    if (!p.decor || !f || !MAIN.has(f.cat) || p.outside || p.yard || /cauldron|cookingstation/.test(p.name)) continue; // a pot on the fire is reached with the fire
    const y = levels.find(l => p.y > l - 0.3 && p.y < l + 0.45);
    if (y == null) continue;
    out.pieces++;
    const ok = [...grids.get(y).cells.values()].some(c => c.seen && Math.abs(c.x - s.bx) < s.r + 1 && Math.abs(c.z - s.bz) < s.r + 1 && s.d(c.x, c.z) < 0.9);
    if (!ok) out.piecesOut.push(`${p.name} at ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`);
  }
  return out;
}

let render = null;
try {
  const R = require('../lib/render.js');
  const { createCanvas } = require(path.join(__dirname, '../node_modules/@napi-rs/canvas'));
  fs.mkdirSync(outDir, { recursive: true });
  render = (d, file) => {
    const tiles = [];
    for (const v of [{ az: 35, el: 35 }, { az: 215, el: 55, cut: 2.6 }]) {
      const c = createCanvas(800, 600);
      R.draw(c.getContext('2d'), d.pieces, { width: 800, height: 600, az: v.az, el: v.el, cut: v.cut, background: '#e9e4d8', ss: 1 });
      tiles.push(c);
    }
    const Sc = createCanvas(1600, 630), g = Sc.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 1600, 630);
    tiles.forEach((t, i) => g.drawImage(t, i * 800, 30));
    g.fillStyle = '#222'; g.font = '20px sans-serif';
    const m = measure(d);
    g.fillText(`${d.meta.Name}  ${d.pieces.length} pieces, ${m.area} m2 of floor, ${m.top} m high (left: whole; right: cut at 2.6 m)`, 8, 22);
    fs.writeFileSync(file, Sc.toBuffer('image/png'));
  };
} catch (e) { console.log('no renders:', e.message); }

const rows = [], rendered = [], reachRows = [];
// one design's checks; returns the reach result
function checkOne(d, L, stage, decor) {
  const name = d.meta.Name;
  for (const c of Ck.check(d, L.biome)) ok(c.ok, `${name}: ${c.check}: ${c.detail}`);
  ok(d.pieces.some(p => /^(hearth|fire_pit)$/.test(p.name) && Math.hypot(p.x, p.z) < 0.5), `${name}: no fire at the hub's heart`);
  const signs = d.pieces.filter(p => p.notice && p.name === 'sign');
  ok(signs.length >= 3 && signs.every(p => Math.hypot(p.x, p.z) < 22), `${name}: notice board missing or outside the hearth area`);
  ok((d.markers || []).some(m => m.leader), `${name}: no leader marker`);
  if (+stage[1] >= 3) {
    ok(d.pieces.some(p => p.highSeat), `${name}: no high seat`);
    ok(d.pieces.some(p => p.spouseSeat) && (d.markers || []).some(m => m.spouse), `${name}: no seat for the spouse`);
  }
  if (+stage[1] >= 4 && (d.request.tier || 0) < 4) ok(d.rooms.some(r => r.use === 'gallery') && d.pieces.some(p => p.name === 'wood_stair'), `${name}: no gallery with a stair`);
  ok(d.pieces.filter(p => /^itemstand/.test(p.name) && p.memento).every(p => !p.item), `${name}: a memento stand holds an item`);
  ok(d.request.top <= H.capFor(d.request.cultureKey) + 0.01, `${name}: ${d.request.top} m over the cap ${H.capFor(d.request.cultureKey)}`);
  let rr = null;
  if (+stage[1] >= 2) {
    rr = reach(d);
    ok(rr.roomsOut.length === 0, `${name}: floors not reached: ${rr.roomsOut.slice(0, 4).join('; ')}`);
    ok(rr.piecesOut.length === 0, `${name}: pieces not reached: ${rr.piecesOut.slice(0, 4).join('; ')}`);
    ok(rr.entry.length === 0, `${name}: in an entry zone: ${rr.entry.slice(0, 4).map(e => e.name + ' ' + e.at).join('; ')}`);
  }
  ok((d.markers || []).some(m => m.kind === 'path'), `${name}: no path marker`);
  const text = H.write(d);
  ok(/#VillheimLeader\nseat;/.test(text) && /#VillheimPaths\npath;/.test(text), `${name}: markers not written`);
  return rr;
}
for (const L of LINES) for (let seed = 1; seed <= seeds; seed++) {
  const fams = {}, ds = {};
  for (const stage of H.STAGES) for (const decor of ['d1', 'd3']) {
    const d = G.generate({ type: 'hub', biome: L.biome, culture: L.culture, line: L.line, stage, decor, seed });
    const name = d.meta.Name;
    const rr = checkOne(d, L, stage, decor);
    ok(d.request.line === L.line, `${name}: line ${d.request.line}`);
    if (rr && decor === 'd3') reachRows.push({ name, levels: new Set(d.rooms.map(r => Math.round(r.y * 4) / 4)).size, rooms: rr.rooms, pieces: rr.pieces });
    if (decor === 'd3') {
      fams[stage] = family(d);
      ds[stage] = d;
      const m = measure(d);
      rows.push({ line: L.id, seed, stage, pieces: d.pieces.length, area: m.area, top: m.top, family: fams[stage], features: (d.request.features || []).join(' ') + (d.request.tier ? ` (tier ${d.request.tier})` : '') });
      if (render && seed === 1 && ['s1', 's3', 's5'].includes(stage)) { const f = path.join(outDir, `${L.id}_${stage}.png`); render(d, f); rendered.push(f); }
    }
  }
  const fam = fams.s2;
  ok(fam === famOf(L.line), `${L.id} seed ${seed}: s2 family ${fam}`);
  for (const st of ['s3', 's4', 's5']) ok(fams[st] === fam, `${L.id} seed ${seed}: ${st} family ${fams[st]}, s2 ${fam} (D-132)`);
  // the camp lies inside the last stage's plot (D-083), a metre of slack for the lean-to eaves
  const p5 = box(ds.s5.pieces.filter(p => P.piece(p.name).structural)), p1 = box(ds.s1.pieces.filter(p => P.piece(p.name).structural));
  ok(p1.x0 >= p5.x0 - 1 && p1.x1 <= p5.x1 + 1 && p1.z0 >= p5.z0 - 4 && p1.z1 <= p5.z1 + 1, `${L.id} seed ${seed}: s1 camp outside the s5 plot`);
  // each stage larger than the one before
  const areas = H.STAGES.slice(1).map(st => measure(ds[st]).area);
  ok(areas.every((a, i) => i === 0 || a > areas[i - 1]), `${L.id} seed ${seed}: floor does not grow every stage (${areas.join(', ')})`);
}

// every village culture: its own line (the village's draw for lineages 1 and 2) at s2 to s5, d3, seed 1
const sweep = [];
for (const [key, C] of Object.entries(S.CULTURES)) {
  if (!C.village) continue;
  for (const lineage of [1, 2]) {
    const L = { culture: key, biome: C.biomes[0] };
    let line = null, fam = null;
    for (const stage of ['s2', 's3', 's4', 's5']) {
      const d = G.generate({ type: 'hub', biome: L.biome, culture: key, stage, decor: 'd3', seed: 1, lineage });
      checkOne(d, L, stage, 'd3');
      line = d.request.line;
      const f = family(d);
      ok(f === famOf(line) && (!fam || f === fam), `${d.meta.Name}: family ${f}, line ${line}`);
      fam = f;
      if (stage === 's5') sweep.push({ key, lineage, line, top: d.request.top, cap: d.request.cap, tier: d.request.tier, area: measure(d).area });
    }
  }
}
console.log('every culture at s5 (d3, seed 1): line, height and cap, tier');
for (const r of sweep) console.log(`${r.key.padEnd(16)} lineage ${r.lineage} ${r.line.padEnd(8)} ${String(r.top).padStart(5)} m of ${r.cap} m, tier ${r.tier}, ${r.area} m2`);

// s5 is the largest building in its culture's set
for (const L of LINES) {
  const hub = measure(G.generate({ type: 'hub', biome: L.biome, culture: L.culture, line: L.line, stage: 's5', decor: 'd1', seed: 1 }));
  let best = null;
  for (const type of Object.keys(S.TYPES)) {
    if (type === 'hub') continue;
    for (let seed = 1; seed <= 3; seed++) {
      const m = measure(G.generate({ type, biome: L.biome, culture: L.culture, stage: 's3', decor: 'd1', seed, skipDecor: true, yard: false }));
      if (!best || m.area > best.area) best = { ...m, type, seed };
    }
  }
  ok(hub.area > best.area, `${L.id}: s5 hub ${hub.area} m2 is not larger than ${best.type} s3 (${best.area} m2)`);
  console.log(`${L.id}: s5 ${hub.area} m2, ${hub.top} m; largest other building ${best.type} s3 seed ${best.seed}: ${best.area} m2, ${best.top} m`);
}

console.log('\nline           seed stage pieces  floor m2  top m  family  features');
for (const r of rows) console.log(`${r.line.padEnd(14)} ${String(r.seed).padStart(4)} ${r.stage.padEnd(5)} ${String(r.pieces).padStart(6)} ${String(r.area).padStart(9)} ${String(r.top).padStart(6)}  ${r.family.padEnd(7)} ${r.features}`);
console.log('\nreached on foot (d3): floors, rooms and main pieces');
for (const r of reachRows) console.log(`${r.name.padEnd(44)} ${r.levels} floor levels, ${r.rooms} rooms, ${r.pieces} main pieces, all reached`);
if (rendered.length) console.log('\nrenders:\n' + rendered.join('\n'));
console.log(failed ? `\n${failed} failures` : '\nall hub tests pass');
process.exit(failed ? 1 : 0);
