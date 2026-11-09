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
  const solid = b.pieces.filter(p => !['floor', 'rug', 'roof', 'roofTop', 'roofCorner', 'gable'].includes(PB.piece(p.name).role) || p.decor).map(p => ({ p, o: Ck.aabb(p) }));
  for (const s of sides) {
    for (let c = s.lo + 3; c <= s.hi - 3 + 0.01; c += 1) {
      // the counter's line 1.5 m in from the wall, the whole working area from the wall to 1 m in front of it kept free
      const dIn = 1.5, box = s.along === 'x'
        ? { x0: c - 2.3, x1: c + 2.3, z0: Math.min(s.wall, s.wall + s.n * (dIn + 1.2)), z1: Math.max(s.wall, s.wall + s.n * (dIn + 1.2)) }
        : { z0: c - 2.3, z1: c + 2.3, x0: Math.min(s.wall, s.wall + s.n * (dIn + 1.2)), x1: Math.max(s.wall, s.wall + s.n * (dIn + 1.2)) };
      const hit = solid.some(({ p, o }) => o.y1 > y + 0.2 && o.y0 < y + 2.2 && o.x0 < box.x1 && o.x1 > box.x0 && o.z0 < box.z1 && o.z1 > box.z0 && !(PB.piece(p.name).role === 'wall' && !p.decor && (s.along === 'x' ? Math.abs(p.z - s.wall) < 0.3 : Math.abs(p.x - s.wall) < 0.3)))
        || zones.some(z => z.x0 < box.x1 && z.x1 > box.x0 && z.z0 < box.z1 && z.z1 > box.z0 && z.y0 < y + 2 && z.y1 > y);
      if (hit) continue;
      const at = (a, d) => (s.along === 'x' ? [a, s.wall + s.n * d] : [s.wall + s.n * d, a]);
      const yaw = s.along === 'x' ? 0 : 90, T = { decor: true, trim: true };
      for (const a of [c - 1, c + 1]) { const [x, z] = at(a, dIn); b.put(half, x, y + 0.5, z, yaw, T); }
      // the top: a beam along each half wall (a 1 x 1 floor here would count as a floor to stand on in the checks)
      for (const a of [c - 1, c + 1]) { const [x, z] = at(a, dIn); b.put(ctx.K.beam || 'wood_beam', x, y + 1.1, z, yaw, T); }
      const barrel = can(ctx.biome, 'piece_chest_barrel') ? 'piece_chest_barrel' : 'piece_chest_wood';
      for (const a of [c - 1.2, c + 1.2]) { const [x, z] = at(a, 0.5); b.put(barrel, x, y + 0.1, z, yaw + 180, T); }
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
    // posts at the corners of the bed's true footprint, a little in
    const bb = Ck.aabb(bed);
    const corners = [[bb.x0 + 0.12, bb.z0 + 0.12], [bb.x1 - 0.12, bb.z0 + 0.12], [bb.x0 + 0.12, bb.z1 - 0.12], [bb.x1 - 0.12, bb.z1 - 0.12]];
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
    const busy = corners.some(([x, z]) => b.pieces.some(p => {
      if (p === bed || !p.decor || PB.piece(p.name).role === 'rug' || p.y > bed.y + 2.2) return false;
      const o = Ck.aabb(p);
      return x > o.x0 - 0.25 && x < o.x1 + 0.25 && z > o.z0 - 0.25 && z < o.z1 + 0.25; // another bed, a chest, a table
    }));
    if (busy) continue;
    const T = { decor: true, trim: true };
    for (const [x, z] of corners) b.put(post, x, bed.y + 1, z, 0, T);
    b.put(canopy, bed.x, bed.y + 2.02, bed.z, bed.yaw || 0, T);
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

function apply(b, ctx, zones) {
  if (ctx.type === 'barn' && ctx.decor !== 'd1') stalls(b, ctx, zones || []);
  if (ctx.type === 'tavern' && ctx.decor !== 'd1') barCounter(b, ctx, zones || []);
  const X = ctx.profile || {};
  if (X.canopyBed != null ? X.canopyBed : (ctx.decor === 'd3' && ['home', 'longhouse'].includes(ctx.type) && ctx.R() < 0.5)) canopyBed(b, ctx);
}

const apiB = { apply, barCounter, canopyBed, stalls };
if (NODE_B) module.exports = apiB; else window.VHKitbash = apiB;
