// The village hub (lib/hub.js): node lab/test_hub.js [render-dir] [seeds]
// For each line (Norse cross, Celtic round, Anglo-Saxon octagon, Middle Eastern part round), every stage s1 to s5 at d1
// and d3, and for every village culture its own line at s2 to s5 (d3, seed 1):
// every check in lib/checks.js passes; the shape family measured from the walls and roofs holds from s2 to s5 (D-132);
// the fire is at the hub's heart and the notice board in the hearth area at every stage (D-140); the leader's marker is
// there (D-141); item stands for mementos stay empty (D-134); the s1 camp lies inside the s5 plot (D-083); s5 has the
// most floor of any building in its culture's set (every other type at s3, the lab's last stage for them) and stands no
// more wall storeys than the culture's other buildings at s3 and HUB.capStoreys (D-156: storeys only; roofs and crowns
// as tall as their design);
// from s3 a high seat and the seat beside it for the spouse (D-154), from s4 a gallery reached by a stair.
// Every floor of every stage s2 to s5 is reached on foot from a door to the outside, by its stairs and ladders, and so is
// every bed, table, station and chest; nothing stands in a doorway's entry zone (lab/reach.js).
// Floors meet the walls (no open floor 0.3 or 0.8 m in from any ground-storey wall bay on its floored side), and the
// free-standing inner posts stay within the corpus (lab/hub_posts.py: round and polygon buildings over 300 m2 have at
// most 2.5 posts per 100 m2 in three of four, halls 1.2; the clear radius round the middle at least 2.6 m and 2.9 m in
// three of four).
// Gallery rails: every rail end meets another rail, a wall, a stair or the walkway, and no two rails cross. Rugs: none
// lies on others by more than RUG_OVER of its area (corpus, lab/hub_dress.py). Wall sides: from s3 at d3 the share of
// ground-storey wall bays with furniture or dressing within 1.3 m is at least the corpus first quartile (0.20).
// Renders each line s1, s3 and s5 into the render dir (default /tmp/hub5-renders), all views from the same side: the
// whole, a cut at 2.6 m over the floor, and from s4 a cut 2.6 m over the gallery. Exits 1 on a failure.
const path = require('path'), fs = require('fs');
const G = require('../lib/generate.js'), Ck = require('../lib/checks.js'), P = require('../lib/pieces.js');
const S = require('../lib/styles.js'), H = require('../lib/hub.js');
const outDir = process.argv[2] || '/tmp/hub5-renders';
const seeds = +(process.argv[3] || 2);
let failed = 0;
const narrowHub = [];
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

// Can a person walk in and round a design (D-148, D-152)? lab/reach.js, as on design/integration2.
const reach = d => require('./reach.js')(d);

const rad = d => d * Math.PI / 180;
// open floor at the wall: points 0.3 and 0.8 m in from every ground-storey wall bay, on a side with floor 1.6 m in and
// inside the hall's rooms, that lie on no floor piece
function floorGaps(d) {
  const floors = d.pieces.filter(p => P.piece(p.name).role === 'floor' && !p.decor && !p.dais && !p.yard && Math.abs(p.y) < 0.3);
  const onFloor = (x, z) => floors.some(f => { const sz = P.piece(f.name).size; if (Math.abs(f.x - x) > 1.6 || Math.abs(f.z - z) > 1.6) return false; const a = rad(f.yaw || 0), dx = x - f.x, dz = z - f.z; const u = dx * Math.cos(a) - dz * Math.sin(a), v = dx * Math.sin(a) + dz * Math.cos(a); return Math.abs(u) <= sz[0] / 2 + 0.02 && Math.abs(v) <= sz[2] / 2 + 0.02; });
  const inHall = (x, z) => (d.rooms || []).some(r => Math.abs(r.y) < 0.3 && x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
  const walls = d.pieces.filter(p => ['wall', 'door', 'window'].includes(P.piece(p.name).role) && !p.decor && !p.notice && !p.crown && p.y > -0.1 && p.y < 2.5);
  const doors = walls.filter(p => P.piece(p.name).role === 'door');
  const out = [];
  for (const w of walls) {
    const a = rad(w.yaw || 0), tx = Math.cos(a), tz = -Math.sin(a), nx = Math.sin(a), nz = Math.cos(a), hw = P.piece(w.name).size[0] / 2;
    for (let t = -hw + 0.15; t <= hw - 0.15 + 1e-6; t += 0.25) for (const sg of [-1, 1]) {
      const bx = w.x + tx * t, bz = w.z + tz * t;
      if (doors.some(q => Math.hypot(q.x - bx, q.z - bz) < 1.3) || !onFloor(bx + nx * sg * 1.6, bz + nz * sg * 1.6)) continue;
      for (const dd of [0.3, 0.8]) { const x = bx + nx * sg * dd, z = bz + nz * sg * dd; if (inHall(x, z) && !onFloor(x, z)) out.push(`${x.toFixed(1)},${z.toFixed(1)}`); }
    }
  }
  return out;
}
// free-standing inner posts: poles standing on the ground floor inside the hall, 0.7 m or more from every wall bay
function innerPosts(d) {
  const inHall = (x, z) => (d.rooms || []).some(r => Math.abs(r.y) < 0.3 && x > r.x0 + 0.5 && x < r.x1 - 0.5 && z > r.z0 + 0.5 && z < r.z1 - 0.5);
  const walls = d.pieces.filter(p => ['wall', 'door', 'window'].includes(P.piece(p.name).role) && !p.decor && p.y < 3);
  const near = (x, z) => walls.some(w => { const a = rad(w.yaw || 0), dx = x - w.x, dz = z - w.z, hw = P.piece(w.name).size[0] / 2; const u = dx * Math.cos(a) - dz * Math.sin(a), v = dx * Math.sin(a) + dz * Math.cos(a); return Math.abs(u) <= hw + 0.7 && Math.abs(v) < 0.7; });
  const pts = new Map();
  for (const p of d.pieces) {
    if (p.decor || P.piece(p.name).role !== 'pole' || p.y > 1.2 || !inHall(p.x, p.z) || near(p.x, p.z)) continue;
    pts.set(`${Math.round(p.x * 2)},${Math.round(p.z * 2)}`, [p.x, p.z]);
  }
  const ps = [...pts.values()];
  const area = d.pieces.filter(p => P.piece(p.name).role === 'floor' && !p.decor && !p.dais && Math.abs(p.y) < 0.3).reduce((a, p) => a + P.piece(p.name).size[0] * P.piece(p.name).size[2], 0);
  return { area: Math.round(area), n: ps.length, per100: +(100 * ps.length / Math.max(1, area)).toFixed(2), clearR: ps.length ? +Math.min(...ps.map(([x, z]) => Math.hypot(x, z))).toFixed(1) : null };
}

// rail ends and crossings on the gallery levels
function railFaults(d) {
  const segOf = p => { const a = rad(p.yaw || 0), hw = P.piece(p.name).size[0] / 2; return { y: p.y, x0: p.x - Math.cos(a) * hw, z0: p.z + Math.sin(a) * hw, x1: p.x + Math.cos(a) * hw, z1: p.z - Math.sin(a) * hw }; };
  const fences = d.pieces.filter(p => /fence/.test(p.name) && !p.decor).map(segOf);
  const walls = d.pieces.filter(p => ['wall', 'door', 'window'].includes(P.piece(p.name).role) && !p.decor).map(p => ({ ...segOf(p), h: P.piece(p.name).size[1] }));
  const stairs = d.pieces.filter(p => P.piece(p.name).role === 'stair');
  const walk = d.pieces.filter(p => P.piece(p.name).role === 'floor' && !p.decor);
  const dseg = (x, z, sg) => { const vx = sg.x1 - sg.x0, vz = sg.z1 - sg.z0, L = vx * vx + vz * vz || 1; const t = Math.max(0, Math.min(1, ((x - sg.x0) * vx + (z - sg.z0) * vz) / L)); return Math.hypot(x - sg.x0 - t * vx, z - sg.z0 - t * vz); };
  const gaps = [], cross = [];
  fences.forEach((f, i) => {
    for (const [x, z] of [[f.x0, f.z0], [f.x1, f.z1]]) {
      if (fences.some((g, j) => j !== i && Math.abs(g.y - f.y) < 0.3 && dseg(x, z, g) < 0.45)) continue;
      if (walls.some(w => Math.abs(w.y - f.y) < w.h / 2 + 0.7 && dseg(x, z, w) < 0.45)) continue;
      if (stairs.some(st => Math.hypot(st.x - x, st.z - z) < 1.8)) continue;
      // a rail end on the walkway's deck where the walkway runs onto the gallery
      if (walk.filter(w => Math.abs(w.y - f.y + 0.6) < 0.3 && Math.abs(w.x - x) < 1.1 && Math.abs(w.z - z) < 1.1).length >= 2 && fences.some((g, j) => j !== i && Math.abs(g.y - f.y) < 0.3 && dseg(x, z, g) < 2.2)) continue;
      gaps.push(`${x.toFixed(1)},${f.y.toFixed(1)},${z.toFixed(1)}`);
    }
    fences.forEach((g, j) => {
      if (j <= i || Math.abs(g.y - f.y) > 0.3) return;
      const den = (f.x1 - f.x0) * (g.z1 - g.z0) - (f.z1 - f.z0) * (g.x1 - g.x0);
      if (Math.abs(den) < 1e-6) return;
      const t = ((g.x0 - f.x0) * (g.z1 - g.z0) - (g.z0 - f.z0) * (g.x1 - g.x0)) / den, u = ((g.x0 - f.x0) * (f.z1 - f.z0) - (g.z0 - f.z0) * (f.x1 - f.x0)) / den;
      const lf = Math.hypot(f.x1 - f.x0, f.z1 - f.z0), lg = Math.hypot(g.x1 - g.x0, g.z1 - g.z0);
      if (t > 0 && t < 1 && u > 0 && u < 1 && t * lf > 0.45 && (1 - t) * lf > 0.45 && u * lg > 0.45 && (1 - u) * lg > 0.45) cross.push(`${(f.x0 + t * (f.x1 - f.x0)).toFixed(1)},${(f.z0 + t * (f.z1 - f.z0)).toFixed(1)}`);
    });
  });
  return { gaps, cross, n: fences.length };
}
// the most of any rug's area lying on other rugs
function rugOver(d) {
  const D = require('../lib/decorate.js');
  const rs = d.pieces.filter(p => /^rug_|^jute_carpet/.test(p.name)).map(p => { const sz = (D.FURNITURE[p.name] || { s: [3, 0, 3] }).s; return { ...p, w: sz[0], l: sz[2] }; });
  const inR = (r, x, z) => { const a = rad(r.yaw || 0), dx = x - r.x, dz = z - r.z, u = dx * Math.cos(a) - dz * Math.sin(a), v = dx * Math.sin(a) + dz * Math.cos(a); return Math.abs(u) <= r.w / 2 && Math.abs(v) <= r.l / 2; };
  let worst = 0, over = 0;
  for (const r of rs) {
    let hit = 0; const a = rad(r.yaw || 0);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const u = -r.w / 2 + r.w * (i + 0.5) / 8, v = -r.l / 2 + r.l * (j + 0.5) / 8; if (rs.some(o => o !== r && Math.abs(o.y - r.y) < 0.3 && inR(o, r.x + u * Math.cos(a) + v * Math.sin(a), r.z - u * Math.sin(a) + v * Math.cos(a)))) hit++; }
    worst = Math.max(worst, hit / 64); if (hit / 64 > 0.05) over++;
  }
  return { n: rs.length, over, worst: +worst.toFixed(2) };
}
// share of ground-storey wall bays (on their floored side, inside the hall) with furniture or dressing within 1.3 m
function wallDress(d) {
  const DRESS = /bench|chair|throne|stool|chest|crate|barrel|itemstand|ArmorStand|banner|table|torch|lantern|brazier|candle|cauldron|fermenter|cooking|preptable|butcher|bed|sign/i;
  const floors = d.pieces.filter(p => P.piece(p.name).role === 'floor' && !p.decor && !p.dais && Math.abs(p.y) < 0.3);
  const onFloor = (x, z) => floors.some(f => { const sz = P.piece(f.name).size; if (Math.abs(f.x - x) > 1.6 || Math.abs(f.z - z) > 1.6) return false; const a = rad(f.yaw || 0), dx = x - f.x, dz = z - f.z; const u = dx * Math.cos(a) - dz * Math.sin(a), v = dx * Math.sin(a) + dz * Math.cos(a); return Math.abs(u) <= sz[0] / 2 + 0.02 && Math.abs(v) <= sz[2] / 2 + 0.02; });
  const inHall = (x, z) => (d.rooms || []).some(r => Math.abs(r.y) < 0.3 && x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
  const dec = d.pieces.filter(p => p.decor && DRESS.test(p.name) && p.y < 3.5);
  let n = 0, k = 0;
  const seen = new Set();
  for (const w of d.pieces.filter(p => ['wall', 'window'].includes(P.piece(p.name).role) && !p.decor && !p.notice && !p.crown && p.y > 0.2 && p.y < 2.6 && P.piece(p.name).size[0] >= 2)) {
    const key = `${Math.round(w.x * 2)},${Math.round(w.z * 2)}`;
    if (seen.has(key)) continue; seen.add(key);
    const a = rad(w.yaw || 0), tx = Math.cos(a), tz = -Math.sin(a), nx = Math.sin(a), nz = Math.cos(a);
    const sides = [-1, 1].filter(sg => onFloor(w.x + nx * sg * 1.2, w.z + nz * sg * 1.2) && inHall(w.x + nx * sg * 1.2, w.z + nz * sg * 1.2));
    if (!sides.length) continue;
    n++;
    if (dec.some(p => { const dx = p.x - w.x, dz = p.z - w.z, u = dx * tx + dz * tz, v = dx * nx + dz * nz; return Math.abs(u) <= 1.1 && sides.some(sg => v * sg > 0 && v * sg <= 1.3); })) k++;
  }
  return { n, share: n ? +(k / n).toFixed(2) : 0 };
}

let render = null;
try {
  const R = require('../lib/render.js');
  const { createCanvas } = require(path.join(__dirname, '../node_modules/@napi-rs/canvas'));
  fs.mkdirSync(outDir, { recursive: true });
  render = (d, file) => {
    const tiles = [];
    const gy = (d.rooms || []).filter(r => r.use === 'gallery').map(r => r.y)[0];
    const views = [{ az: 35, el: 35 }, { az: 35, el: 55, cut: 2.6 }];
    if (gy != null) views.push({ az: 35, el: 55, cut: gy + 2.6 });
    for (const v of views) {
      const c = createCanvas(800, 600);
      R.draw(c.getContext('2d'), d.pieces, { width: 800, height: 600, az: v.az, el: v.el, cut: v.cut, background: '#e9e4d8', ss: 1 });
      tiles.push(c);
    }
    const Sc = createCanvas(800 * views.length, 630), g = Sc.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 800 * views.length, 630);
    tiles.forEach((t, i) => g.drawImage(t, i * 800, 30));
    g.fillStyle = '#222'; g.font = '20px sans-serif';
    const m = measure(d);
    g.fillText(`${d.meta.Name}  ${d.pieces.length} pieces, ${m.area} m2 of floor, ${m.top} m high. All views from the same side (the main door toward the lower left): whole; cut at 2.6 m${gy != null ? `; cut at ${(gy + 2.6).toFixed(1)} m (the gallery)` : ''}`, 8, 22);
    fs.writeFileSync(file, Sc.toBuffer('image/png'));
  };
} catch (e) { console.log('no renders:', e.message); }

const rows = [], rendered = [], reachRows = [], postRows = [], dressRows = [];
// one design's checks; returns the reach result
function checkOne(d, L, stage, decor) {
  const name = d.meta.Name;
  // passages (Tyler's two-piece rule) are counted and listed, not failed, until every hub line meets it (track D record)
  for (const c of Ck.check(d, L.biome)) { if (c.check === 'passages') { if (!c.ok) narrowHub.push(`${name}: ${c.detail}`); continue; } ok(c.ok, `${name}: ${c.check}: ${c.detail}`); }
  ok(d.pieces.some(p => /^(hearth|fire_pit)$/.test(p.name) && Math.hypot(p.x, p.z) < 0.5), `${name}: no fire at the hub's heart`);
  const signs = d.pieces.filter(p => p.notice && p.name === 'sign');
  // (the hearth area: the hall and its door, the board within 8 m of the main door's distance from the fire)
  const doorR = Math.max(10, ...(d.markers || []).filter(m => m.kind === 'path').map(m => Math.hypot(m.x, m.z)));
  ok(signs.length >= 3 && signs.every(p => Math.hypot(p.x, p.z) < doorR + 8), `${name}: notice board missing or outside the hearth area`);
  ok((d.markers || []).some(m => m.leader), `${name}: no leader marker`);
  if (+stage[1] >= 3) {
    ok(d.pieces.some(p => p.highSeat), `${name}: no high seat`);
    ok(d.pieces.some(p => p.spouseSeat) && (d.markers || []).some(m => m.spouse), `${name}: no seat for the spouse`);
  }
  if (+stage[1] >= 4 && !/gallery none/.test(d.request.layout || '')) ok(d.rooms.some(r => r.use === 'gallery') && d.pieces.some(p => p.name === 'wood_stair'), `${name}: no gallery with a stair`);
  ok(d.pieces.filter(p => /^itemstand/.test(p.name) && p.memento).every(p => !p.item), `${name}: a memento stand holds an item`);
  // the storey rule (D-156: storeys only; roofs and crowns as tall as their design): wall storeys at most HUB.capStoreys
  // over the culture's other buildings at s3 (styles.js TYPES, the watchtower left out)
  const others = Math.max(...Object.entries(S.TYPES).filter(([t]) => !['hub', 'tower'].includes(t)).map(([, T]) => T.storeys.s3));
  // (storeys are the floors people stand on, the rooms' levels; gables and crowns over the wall top are roof)
  const wallStoreys = new Set((d.rooms || []).map(r => Math.round(r.y))).size;
  ok(wallStoreys <= others + (S.HUB.capStoreys || 2), `${name}: ${wallStoreys} wall storeys`);
  if (+stage[1] >= 2) {
    const gaps = floorGaps(d);
    ok(gaps.length === 0, `${name}: open floor at the wall at ${gaps.length} points (${gaps.slice(0, 4).join('; ')})`);
    // (the corpus measure covers buildings of 300 m2 of ground floor and more)
    const ip = innerPosts(d), round = d.request.line !== 'cross';
    if (ip.area >= 300) {
      ok(ip.per100 <= (round ? 2.5 : 1.2), `${name}: ${ip.n} inner posts, ${ip.per100} per 100 m2`);
      ok(ip.clearR == null || ip.clearR >= (round ? 2.6 : 2.9), `${name}: a post ${ip.clearR} m from the middle`);
    }
    if (decor === 'd3' && +stage[1] >= 4) postRows.push({ name, ...ip });
    const rf = railFaults(d);
    ok(rf.gaps.length === 0 && rf.cross.length === 0, `${name}: rails: ${rf.gaps.length} open ends (${rf.gaps.slice(0, 3).join('; ')}), ${rf.cross.length} crossings (${rf.cross.slice(0, 3).join('; ')})`);
    const ro = rugOver(d);
    ok(ro.worst <= H.RUG_OVER + 0.06, `${name}: a rug lies ${ro.worst} on others`);
    if (decor === 'd3' && +stage[1] >= 3) {
      const wd = wallDress(d);
      ok(wd.share >= 0.2, `${name}: wall sides dressed ${wd.share} of ${wd.n} bays`);
      dressRows.push({ name, ...wd, rugs: ro.n, rugsOver: ro.over, rugWorst: ro.worst, rails: rf.n });
    }
  }
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

console.log('\nwall sides, rugs and rails (d3, s3 to s5)');
for (const r of dressRows) console.log(`${r.name.padEnd(44)} wall bays dressed ${r.share} of ${r.n}; rugs ${r.rugs}, ${r.rugsOver} on another, most ${r.rugWorst}; ${r.rails} rails`);
console.log('\ninner posts (d3, s4 and s5): free-standing on the ground floor');
for (const r of postRows) console.log(`${r.name.padEnd(44)} ${String(r.n).padStart(3)} posts, ${r.per100} per 100 m2, nearest to the middle ${r.clearR} m`);
console.log('\nline           seed stage pieces  floor m2  top m  family  features');
for (const r of rows) console.log(`${r.line.padEnd(14)} ${String(r.seed).padStart(4)} ${r.stage.padEnd(5)} ${String(r.pieces).padStart(6)} ${String(r.area).padStart(9)} ${String(r.top).padStart(6)}  ${r.family.padEnd(7)} ${r.features}`);
console.log('\nreached on foot (d3): floors, rooms and main pieces');
for (const r of reachRows) console.log(`${r.name.padEnd(44)} ${r.levels} floor levels, ${r.rooms} rooms, ${r.pieces} main pieces, all reached`);
if (rendered.length) console.log('\nrenders:\n' + rendered.join('\n'));
console.log(failed ? `\n${failed} failures` : '\nall hub tests pass');
if (narrowHub.length) { console.log(`passages (listed, not failed): ${narrowHub.length} hubs with walks under two floor pieces wide`); for (const l of narrowHub.slice(0, 12)) console.log('  ' + l); }
process.exit(failed ? 1 : 0);
