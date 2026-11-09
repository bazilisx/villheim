// Furniture built from building pieces, the way skilled players make what the furniture menu lacks: a bar counter
// of half walls topped with beams, barrels behind it and mugs on it (corpus taverns; the "50+ building tips"
// transcript: half walls, beams and 1 x 1 floors make counters and shelves). Runs after the furnishing, only where the
// floor is free, and keeps clear of doors, stairs and the fire.
const NODE_B = typeof module !== 'undefined';
const PB = NODE_B ? require('./pieces.js') : window.VHPieces;
const checksB = () => (NODE_B ? require('./checks.js') : window.VHChecks);
const quatB = yaw => { const a = yaw * Math.PI / 360; return [0, +Math.sin(a).toFixed(6), 0, +Math.cos(a).toFixed(6)]; };
const BIOMES_B = ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains', 'Mistlands', 'Ashlands'];
const can = (biome, name) => BIOMES_B.indexOf(PB.needs(name)) <= BIOMES_B.indexOf(biome);

// A tavern's bar: a 4 m counter of half walls with a beam along the top, 1.5 m out from a long wall of the main room,
// barrels against the wall behind it, a few mugs (horizontal item stands) on it. Returns true when it found room.
function barCounter(b, ctx, zones) {
  const Ck = checksB();
  const room = (b.rooms || []).find(r => r.main && !r.upper);
  if (!room) return false;
  const y = room.y; // floor pivot; a wood floor's top is 0.1 above it
  const half = ctx.K.wallHalf || 'wood_wall_half';
  const sides = [];
  const lx = room.x1 - room.x0, lz = room.z1 - room.z0;
  if (lx >= 8) for (const sz of [1, -1]) sides.push({ along: 'x', wall: sz > 0 ? room.z1 : room.z0, n: -sz, lo: room.x0, hi: room.x1 });
  if (lz >= 8) for (const sx of [1, -1]) sides.push({ along: 'z', wall: sx > 0 ? room.x1 : room.x0, n: -sx, lo: room.z0, hi: room.z1 });
  // tables, seats, chests and the like may give way to the bar (it went in only where the floor was still bare,
  // one tavern in a hundred); the fire, beds, stations and anything built stay
  const movable = p => p.decor && ['table', 'seat', 'storage', 'rug', 'deco', 'clutter', 'light'].includes(PB.piece(p.name).role);
  const solid = b.pieces.filter(p => (!['floor', 'rug', 'roof', 'roofTop', 'roofCorner', 'gable'].includes(PB.piece(p.name).role) || p.decor) && !movable(p)).map(p => ({ p, o: Ck.aabb(p) }));
  for (const s of sides) {
    for (let c = s.lo + 3; c <= s.hi - 3 + 0.01; c += 1) {
      // the counter's line 1.5 m in from the wall, the whole working area from the wall to 1 m in front of it kept free
      const dIn = 1.5, box = s.along === 'x'
        ? { x0: c - 2.3, x1: c + 2.3, z0: Math.min(s.wall, s.wall + s.n * (dIn + 1.2)), z1: Math.max(s.wall, s.wall + s.n * (dIn + 1.2)) }
        : { z0: c - 2.3, z1: c + 2.3, x0: Math.min(s.wall, s.wall + s.n * (dIn + 1.2)), x1: Math.max(s.wall, s.wall + s.n * (dIn + 1.2)) };
      const hit = solid.some(({ p, o }) => o.y1 > y + 0.2 && o.y0 < y + 2.2 && o.x0 < box.x1 && o.x1 > box.x0 && o.z0 < box.z1 && o.z1 > box.z0 && !(PB.piece(p.name).role === 'wall' && !p.decor && (s.along === 'x' ? Math.abs(p.z - s.wall) < 0.3 : Math.abs(p.x - s.wall) < 0.3)))
        || zones.some(z => z.x0 < box.x1 && z.x1 > box.x0 && z.z0 < box.z1 && z.z1 > box.z0 && z.y0 < y + 2 && z.y1 > y);
      if (hit) continue;
      // what stood there goes, with whatever stood on it
      const out = b.pieces.filter(p => { if (!movable(p)) return false; const o = Ck.aabb(p); return o.x0 < box.x1 && o.x1 > box.x0 && o.z0 < box.z1 && o.z1 > box.z0 && o.y0 < y + 2.2; });
      const riders = b.pieces.filter(q => q.decor && !out.includes(q) && out.some(p => { const o = Ck.aabb(p); return q.x > o.x0 && q.x < o.x1 && q.z > o.z0 && q.z < o.z1 && q.y > p.y + 0.2 && q.y < p.y + 1.5; }));
      b.pieces = b.pieces.filter(p => !out.includes(p) && !riders.includes(p));
      const at = (a, d) => (s.along === 'x' ? [a, s.wall + s.n * d] : [s.wall + s.n * d, a]);
      const yaw = s.along === 'x' ? 0 : 90, T = { decor: true, trim: true };
      for (const a of [c - 1, c + 1]) { const [x, z] = at(a, dIn); b.put(half, x, y + 0.5, z, yaw, T); }
      // the top: a beam along each half wall (a 1 x 1 floor here would count as a floor to stand on in the checks)
      for (const a of [c - 1, c + 1]) { const [x, z] = at(a, dIn); b.put(ctx.K.beam || 'wood_beam', x, y + 1.1, z, yaw, T); }
      const barrel = can(ctx.biome, 'piece_chest_barrel') ? 'piece_chest_barrel' : 'piece_chest_wood';
      const thick = /stone|marble|grausten/.test((ctx.C && ctx.C.wallStyle) || '') ? 0.5 : 0; // a stone wall is a metre thick
      for (const a of [c - 1.2, c + 1.2]) { const [x, z] = at(a, 0.5 + thick); b.put(barrel, x, y + 0.1, z, yaw + 180, T); }
      if (can(ctx.biome, 'itemstandh')) for (const a of [c - 1.1, c + 0.4]) { const [x, z] = at(a, dIn); b.put('itemstandh', x, y + 1.35, z, yaw, T); }
      b.notes.push('A bar counter of half walls and planks, barrels behind it.');
      return true;
    }
  }
  return false;
}

// A canopy bed: a 2 m post at each corner of a bed and a rug laid over their tops for the canopy (corpus homes and the
// "posts and a rug" trick; vanilla has no canopy bed). Only where nothing else stands within the posts' reach and the
// ceiling over the bed is at least 2.5 m up.
function canopyBed(b, ctx) {
  const Ck = checksB();
  const canopy = ['jute_carpet', 'rug_deer', 'rug_straw'].find(n => can(ctx.biome, n));
  if (!canopy) return 0;
  const post = ctx.K.pole && /pole2|pole_log$|darkwood_pole$/.test(ctx.K.pole) ? ctx.K.pole : 'wood_pole2';
  let n = 0;
  for (const bed of b.pieces.filter(p => p.name === 'bed' && p.decor)) {
    const a = (bed.yaw || 0) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    const at = (lx, lz) => [bed.x + lx * ca + lz * sa, bed.z - lx * sa + lz * ca]; // local x across, z along the bed
    // posts at the corners of the bed's true footprint
    const bb = Ck.aabb(bed);
    const g = 0.15; // just outside the bed's frame, so the posts stand clear of it
    const inWallPre = ([x, z]) => b.pieces.some(p => !p.decor && ['wall', 'pole', 'window', 'door'].includes(PB.piece(p.name).role) &&
      (() => { const o = Ck.aabb(p); return x > o.x0 - 0.13 && x < o.x1 + 0.13 && z > o.z0 - 0.13 && z < o.z1 + 0.13 && o.y0 < bed.y + 2 && o.y1 > bed.y + 0.2; })());
    const corners = [[bb.x0 - g, bb.z0 - g], [bb.x1 + g, bb.z0 - g], [bb.x0 - g, bb.z1 + g], [bb.x1 + g, bb.z1 + g]];
    void at;
    // the room over the bed: the lowest thing above it that is not the bed itself
    let ceil = Infinity;
    for (const p of b.pieces) {
      if (p === bed) continue;
      const o = Ck.aabb(p), bo = Ck.aabb(bed);
      // structure over the bed's footprint, or furniture at the canopy's height (a torch over the bed's head)
      if (!PB.piece(p.name).structural && !(o.y1 > bed.y + 1.8 && o.y0 < bed.y + 2.3)) continue;
      if (o.y0 > bed.y + 0.5 && o.x0 < bo.x1 - 0.25 && o.x1 > bo.x0 + 0.25 && o.z0 < bo.z1 - 0.25 && o.z1 > bo.z0 + 0.25) ceil = Math.min(ceil, o.y0);
    }
    if (ceil < bed.y + 2.5) continue;
    // nothing else stands where a post goes
    const busy = corners.filter(c => !inWallPre(c)).some(([x, z]) => b.pieces.some(p => {
      if (p === bed || !p.decor || PB.piece(p.name).role === 'rug' || p.y > bed.y + 2.2) return false;
      const o = Ck.aabb(p);
      return x > o.x0 - 0.25 && x < o.x1 + 0.25 && z > o.z0 - 0.25 && z < o.z1 + 0.25; // another bed, a chest, a table
    }));
    // a corner at the wall needs no post: the canopy's head end rests on the wall (a half-tester); two posts at least
    const inWall = ([x, z]) => b.pieces.some(p => !p.decor && ['wall', 'pole', 'window', 'door'].includes(PB.piece(p.name).role) &&
      (() => { const o = Ck.aabb(p); return x > o.x0 - 0.13 && x < o.x1 + 0.13 && z > o.z0 - 0.13 && z < o.z1 + 0.13 && o.y0 < bed.y + 2 && o.y1 > bed.y + 0.2; })());
    const standing = corners.filter(c => !inWall(c));
    // each post on a floor, not over a gap or a step
    const floored = ([x, z]) => b.pieces.some(p => !p.decor && PB.piece(p.name).role === 'floor' && (() => { const o = Ck.aabb(p); return x > o.x0 + 0.1 && x < o.x1 - 0.1 && z > o.z0 + 0.1 && z < o.z1 - 0.1 && Math.abs(o.y1 - bed.y) < 0.2; })());
    if (busy || standing.length < 2 || !standing.every(floored)) continue;
    const T = { decor: true, trim: true };
    // the posts stand on the floor's top (a bed's pivot can sit a little above it)
    const fl = b.pieces.find(p => !p.decor && PB.piece(p.name).role === 'floor' && (() => { const o = Ck.aabb(p); return bed.x > o.x0 - 0.5 && bed.x < o.x1 + 0.5 && bed.z > o.z0 - 0.5 && bed.z < o.z1 + 0.5 && Math.abs(o.y1 - bed.y) < 0.2; })());
    const top = fl ? Ck.aabb(fl).y1 : bed.y;
    for (const [x, z] of standing) b.put(post, x, top + 1, z, 0, T);
    b.put(canopy, bed.x, top + 2.02, bed.z, bed.yaw || 0, T);
    n++;
  }
  if (n) b.notes.push(n > 1 ? `${n} beds with canopies of a rug on four posts.` : 'A bed with a canopy of a rug on four posts.');
  return n;
}

// Stalls along a long wall of a barn: half-wall partitions 2 m deep every 2 m and a gate across the front of each
// (wood_gate is in three fifths of the best-liked builds; none of ours had one). Furnishing standing in the stalls'
// floor goes. Animals come on the village's schedule (D-015); the stalls are their place.
function stalls(b, ctx, zones) {
  const Ck = checksB();
  const room = (b.rooms || []).find(r => r.main && !r.upper);
  if (!room || !can(ctx.biome, 'wood_gate')) return false;
  const y = room.y, half = ctx.K.wallHalf || 'wood_wall_half';
  const sides = [];
  if (room.x1 - room.x0 >= 8) for (const sz of [1, -1]) sides.push({ along: 'x', wall: sz > 0 ? room.z1 : room.z0, n: -sz, lo: room.x0, hi: room.x1 });
  if (room.z1 - room.z0 >= 8) for (const sx of [1, -1]) sides.push({ along: 'z', wall: sx > 0 ? room.x1 : room.x0, n: -sx, lo: room.z0, hi: room.z1 });
  const solid = b.pieces.filter(p => !p.decor && !['floor', 'rug', 'roof', 'roofTop', 'roofCorner', 'gable'].includes(PB.piece(p.name).role)).map(p => ({ p, o: Ck.aabb(p) }));
  const doors = b.pieces.filter(p => PB.piece(p.name).role === 'door' && !p.decor);
  for (const s of sides) {
    const span = Math.floor((s.hi - s.lo - 1) / 2), n = Math.min(4, span);
    if (n < 2) continue;
    const a0 = Math.round((s.lo + s.hi) / 2 - n); // stalls centered on the wall, on the 2 m grid
    const box = s.along === 'x'
      ? { x0: a0 - 0.1, x1: a0 + 2 * n + 0.1, z0: Math.min(s.wall, s.wall + s.n * 3.4), z1: Math.max(s.wall, s.wall + s.n * 3.4) }
      : { z0: a0 - 0.1, z1: a0 + 2 * n + 0.1, x0: Math.min(s.wall, s.wall + s.n * 3.4), x1: Math.max(s.wall, s.wall + s.n * 3.4) };
    const inner = o => o.x0 < box.x1 && o.x1 > box.x0 && o.z0 < box.z1 && o.z1 > box.z0 && o.y1 > y + 0.2 && o.y0 < y + 2.4;
    // the wall itself is fine; anything else built there, a door in that wall, a ladder or stair zone is not
    const onWall = p => (s.along === 'x' ? Math.abs(p.z - s.wall) < 0.6 : Math.abs(p.x - s.wall) < 0.6);
    if (solid.some(({ p, o }) => inner(o) && !(onWall(p) && ['wall', 'window', 'pole'].includes(PB.piece(p.name).role)))) continue;
    if (doors.some(p => inner(Ck.aabb(p)) || (onWall(p) && (s.along === 'x' ? p.x > box.x0 - 1 && p.x < box.x1 + 1 : p.z > box.z0 - 1 && p.z < box.z1 + 1)))) continue;
    if (zones.some(z => z.x0 < box.x1 && z.x1 > box.x0 && z.z0 < box.z1 && z.z1 > box.z0 && z.y0 < y + 2 && z.y1 > y && !z.flue)) continue;
    // clear the stalls' floor of furnishing
    b.pieces = b.pieces.filter(p => !(p.decor && inner(Ck.aabb(p))));
    const at = (a, d) => (s.along === 'x' ? [a, s.wall + s.n * d] : [s.wall + s.n * d, a]);
    const T = { decor: true, trim: true };
    const yawAcross = s.along === 'x' ? 90 : 0, yawAlong = s.along === 'x' ? 0 : 90;
    for (let k = 0; k <= n; k++) { const [x, z] = at(a0 + 2 * k, 1.1); b.put(half, x, y + 0.5, z, yawAcross, T); }
    for (let k = 0; k < n; k++) { const [x, z] = at(a0 + 1 + 2 * k, 2.1); b.put('wood_gate', x, y + 1, z, yawAlong, T); }
    if (can(ctx.biome, 'rug_straw')) for (let k = 0; k < n; k++) { const [x, z] = at(a0 + 1 + 2 * k, 1.1); b.put('rug_straw', x, y + 0.1, z, yawAcross, T); }
    b.notes.push(`${n} stalls with gates along the wall.`);
    return true;
  }
  return false;
}

// A dais for the high seat: the throne the furnishing set against a hall's far wall goes up 0.3 m onto a platform
// 4 m wide and 2.5 m deep (1 m floor pieces on short beams, as the raised wall benches), with its rug and lamps.
// The step up to the high seat of the Viking hall (Hurstwic); "small steps to slightly higher levels".
function dais(b, ctx, zones) {
  const Ck = checksB();
  const throne = b.pieces.find(p => p.decor && p.name === 'piece_throne01');
  if (!throne) return false;
  const room = (b.rooms || []).find(r => !r.upper && throne.x > r.x0 && throne.x < r.x1 && throne.z > r.z0 && throne.z < r.z1 && Math.abs(throne.y - r.y) < 0.6);
  if (!room) return false;
  const f1 = ctx.K.floor1 || 'wood_floor_1x1', b1 = ctx.K.beam1 || 'wood_beam_1';
  // the platform's top 0.3 m over the floor's top (a stone floor's top is its pivot plus half a metre)
  const under = b.pieces.find(p => !p.decor && PB.piece(p.name).role === 'floor' && (() => { const o = Ck.aabb(p); return throne.x > o.x0 && throne.x < o.x1 && throne.z > o.z0 && throne.z < o.z1 && Math.abs(o.y1 - throne.y) < 0.4; })());
  if (!under) return false;
  const lift = 0.3, half1 = Ck.aabb({ name: f1, x: 0, y: 0, z: 0, q: [0, 0, 0, 1] }).y1, y = Ck.aabb(under).y1 + lift - half1;
  // the wall it stands against: the nearest side of its room
  const d = [['x', room.x0, 1], ['x', room.x1, -1], ['z', room.z0, 1], ['z', room.z1, -1]]
    .map(([ax, w, n]) => ({ ax, w, n, dist: Math.abs((ax === 'x' ? throne.x : throne.z) - w) })).sort((a, c) => a.dist - c.dist)[0];
  if (d.dist > 1.6) return false;
  const along = d.ax === 'x' ? throne.z : throne.x, lo = d.ax === 'x' ? room.z0 : room.x0, hi = d.ax === 'x' ? room.z1 : room.x1;
  for (const half of [2, 1.5]) {
    const a0 = Math.max(lo, Math.round(along - half - 0.5) + 0.5), a1 = Math.min(hi, a0 + 2 * half);
    if (a1 - a0 < 2.9) continue;
    const cells = [];
    for (let a = a0 + 0.5; a < a1; a += 1) for (let k = 0; k < 3; k++) {
      const out = d.w + d.n * (0.5 + k);
      cells.push(d.ax === 'x' ? [out, a] : [a, out]);
    }
    const box = { x0: Math.min(...cells.map(c => c[0])) - 0.5, x1: Math.max(...cells.map(c => c[0])) + 0.5, z0: Math.min(...cells.map(c => c[1])) - 0.5, z1: Math.max(...cells.map(c => c[1])) + 0.5 };
    const inBox = o => o.x0 < box.x1 - 0.02 && o.x1 > box.x0 + 0.02 && o.z0 < box.z1 - 0.02 && o.z1 > box.z0 + 0.02;
    const goesUp = p => p.decor && p.y < room.y + 0.6 && inBox(Ck.aabb(p));
    // nothing built in the way (a post, a stair, a doorway, the fire's ring), nothing tall that cannot go up
    const blocked = b.pieces.some(p => {
      const role = PB.piece(p.name).role, o = Ck.aabb(p);
      if (!inBox(o) || o.y1 < room.y + 0.15 || o.y0 > room.y + 2.2) return false;
      if (!p.decor && ['wall', 'window', 'beam', 'floor', 'roof', 'roofTop', 'gable', 'pole'].includes(role)) return false; // the platform goes round posts
      return !goesUp(p) || ['fire', 'stair'].includes(role);
    }) || zones.some(z => z.x0 < box.x1 && z.x1 > box.x0 && z.z0 < box.z1 && z.z1 > box.z0 && z.y0 < room.y + 2 && z.y1 > room.y);
    if (blocked) continue;
    const up = b.pieces.filter(goesUp);
    // and whatever stands on them (dishes on a table)
    const riders = b.pieces.filter(q => q.decor && !up.includes(q) && up.some(p => { const o = Ck.aabb(p); return q.x > o.x0 && q.x < o.x1 && q.z > o.z0 && q.z < o.z1 && q.y > p.y + 0.2 && q.y < p.y + 1.5; }));
    for (const p of [...up, ...riders]) p.y = +(p.y + lift).toFixed(3);
    for (const [x, z] of cells) {
      // a raised wall bench already there at the same height is the dais
      if (b.pieces.some(p => p.name === f1 && Math.abs(p.x - x) < 0.3 && Math.abs(p.z - z) < 0.3 && Math.abs(p.y - y) < 0.05)) continue;
      b.put(f1, x, y, z, 0, { trim: true });
      b.put(b1, x, y - 0.1, z, 90, { trim: true });
    }
    b.notes.push('A dais for the high seat, a step up at the end of the hall.');
    return true;
  }
  return false;
}

function apply(b, ctx, zones) {
  if (ctx.decor !== 'd1' && ['longhouse', 'temple'].includes(ctx.type)) dais(b, ctx, zones || []);
  if (ctx.type === 'barn' && ctx.decor !== 'd1') stalls(b, ctx, zones || []);
  if (ctx.type === 'tavern' && ctx.decor !== 'd1') barCounter(b, ctx, zones || []);
  const X = ctx.profile || {};
  if (X.canopyBed != null ? X.canopyBed : (ctx.decor === 'd3' && ['home', 'longhouse'].includes(ctx.type) && ctx.R() < 0.5)) canopyBed(b, ctx);
}

const apiB = { apply, barCounter, canopyBed, stalls, dais };
if (NODE_B) module.exports = apiB; else window.VHKitbash = apiB;
