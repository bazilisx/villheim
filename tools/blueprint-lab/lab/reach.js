// Can a person walk in and round a design? (D-152, Tyler 2026-11-11: "egress and room movement should always allow
// someone to move into rooms and explore.") Used by lab/check_interiors.js.
//
// - Floor: a 0.25 m grid over the design's room rects (design.rooms), one grid per floor height.
// - Free cell: 0.45 m or more from every solid between 0.25 and 1.8 m over that floor (a lane 0.9 m wide, the radius
//   lib/layout.js clearLanes walks with, data rules lanes.radius). Doors, floors, roofs, rugs and things hung on walls
//   or set on tables are no obstacle; every piece is read by the box round its solids (lib/checks.js aabbShapes), as
//   lib/layout.js clearLanes reads it.
// - Start: the free cells within 1.2 m of the inside of every door whose other side is outside every room rect.
// - Climbs: stair and ladder pieces that touch make one climb; the free cells within 1.2 m of its lowest piece on the
//   floor at its foot and of its highest piece on the floor at its top are joined.
// - Counted: rooms (room rects) with no reached cell; main pieces on a floor (beds, tables, stations, chests and
//   barrels that stand on the floor) with no reached cell within 0.9 m of their box (a person within 0.45 m of it).
// - Entry zones: just inside every door, a box as wide as the opening plus 0.3 m each side and 1.5 m deep (the 1.5 m
//   turning circle of the accessibility guides; nine corpus builds in ten leave 1.6 m or more free inside a home's door
//   and more in other rooms, docs/INTERIOR_DESIGN.md "A clear way in"). Counted: furniture and objects standing in it
//   between the floor and 1.8 m (rugs, things hung on walls and things on tables left out).
const path = require('path');
module.exports = function reach(design, libDir) {
  const lib = libDir || path.join(__dirname, '../lib');
  const P = require(path.join(lib, 'pieces.js')), Ck = require(path.join(lib, 'checks.js')), D = require(path.join(lib, 'decorate.js'));
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
};
