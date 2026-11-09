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
// minor decor goes in any biome (D-066): it costs nothing or is paid in the village's own materials
const canDecor = (biome, name) => can(biome, name) || PB.minor(name);

// ---------------------------------------------------------------- the interior library (data/kitbash-interior.json)
// The slot each piece fills in an assembly. The miner (lab/mine_kitbash.js) matches the corpus by slot, so a wood chest
// and an iron chest in the same place count as one assembly; the placer fills each slot with what the village's biome
// makes. Pieces with no class here are their own slot. Small building pieces count when they carry something (a beam
// shelf, a half-wall counter).
const CLASSES = {
  chest: ['piece_chest_wood', 'piece_chest', 'piece_chest_blackmetal', 'piece_chest_private'],
  barrel: ['piece_chest_barrel'],
  crate: ['dvergrprops_crate', 'dvergrprops_crate_long'],
  chair: ['piece_chair', 'piece_chair02', 'piece_chair03', 'dvergrprops_stool', 'dvergrprops_chair', 'piece_chair_runed'],
  bench: ['piece_bench01', 'piece_logbench01', 'piece_blackwood_bench01', 'piece_blackmarble_bench', 'piece_bench_runed'],
  rug: ['rug_deer', 'rug_straw', 'rug_wolf', 'jute_carpet', 'rug_fur', 'rug_hare', 'jute_carpet_blue', 'rug_asksvin', 'rug_bogwitch_deer', 'rug_moose', 'rug_seal', 'rug_Bjorn'],
  banner: ['piece_banner01', 'piece_banner02', 'piece_banner03', 'piece_banner04', 'piece_banner05', 'piece_banner06', 'piece_banner07',
    'piece_banner08', 'piece_banner09', 'piece_banner10', 'piece_banner11'],
  walllight: ['piece_walltorch', 'piece_dvergr_lantern'],
  floorlight: ['piece_groundtorch_wood', 'piece_groundtorch', 'piece_groundtorch_green', 'piece_groundtorch_mist', 'piece_groundtorch_blue'],
  candle: ['Candle_resin', 'Candle_resin_bogwitch'],
  pot: ['piece_pot1', 'piece_pot2', 'piece_pot3', 'piece_pot2_red', 'ashland_pot2_red', 'piece_pot1_cracked', 'piece_pot2_cracked'],
  gift: ['piece_gift1', 'piece_gift2', 'piece_gift3'],
  carving: ['wood_dragon1', 'darkwood_raven', 'darkwood_wolf'],
  feast: ['FeastMeadows', 'FeastBlackforest', 'FeastSwamps', 'FeastMountains', 'FeastOceans', 'FeastPlains', 'FeastMistlands', 'FeastAshlands'],
  beam1: ['wood_beam_1', 'darkwood_beam_1', 'ashwood_beam_1m'], beam2: ['wood_beam', 'darkwood_beam', 'woodiron_beam', 'ashwood_beam_2m'],
  floor1: ['wood_floor_1x1'], half: ['wood_wall_half', 'darkwood_wall_half'], quarter: ['wood_wall_quarter'],
  pole1: ['wood_pole', 'ashwood_pole_1m'], pole2: ['wood_pole2', 'darkwood_pole', 'ashwood_pole_2m'], ledge: ['wood_ledge'],
};
const SLOT = {};
for (const [k, list] of Object.entries(CLASSES)) for (const n of list) SLOT[n] = k;
// placed food: every dish and drink that stands on a table or a shelf
const FOOD = /^(Mead[A-Z]\w*|BarleyWine|Bread|CookedMeat|Sausages|Honey|HoneyGlazedChicken|MeatPlatter|LoxPie|PiquantPie|RoastedCrustPie|SerpentStew|MashedMeat|MarinatedGreens|MisthareSupreme|QueensJam|Salad|Eyescream|ShocklateSmoothie|SparklingShroomshake|SizzlingBerryBroth|ScorchingMedley|SpicyMarmalade|Blueberries|Raspberry|Cloudberry|Carrot|Onion|Turnip|Pukeberries|RoyalJelly|Fish\d+)$/;
// building pieces that join an assembly only when they carry or frame furniture
const BUILT_SLOTS = ['beam1', 'beam2', 'floor1', 'half', 'quarter', 'pole1', 'pole2', 'ledge'];
function slotOf(name) { return SLOT[name] || (FOOD.test(name) ? 'food' : name); }
// what counts as furnishing or decor in a build: every prefab that is not structure, ground or a plant, less what
// stands outside or is a building block of its own (portals, mills, carts, kilns, black marble trim)
const NOT_DECOR = /^(portal|windmill|Cart|bonfire|blastfurnace|smelter|charcoal_kiln|eitrrefinery|piece_beehive|piece_sapcollector|guard_stone|piece_shieldgenerator|piece_turret|piece_trap_troll|incinerator|LocationProxy|blackmarble_(base|out|tip|slope|2x2|basecorner|outcorner|post)|iron_grate|Ashlands_|dverger_demister|dvergrtown_|giant_|tarlump|highstone|widestone|metalbar|flying_core|Seeker|YggaShoot|Greydwarf_Root|HugeRoot|CreepProp|Charred_|Morkhalla_Eye|wood_(fine_|core_|yggdrasil_)?stack|stone_pile|coal_pile|flint_pile|grausten_pile|blackmarble_pile|blackwood_stack|mudpile|goblin_(trash|straw)pile|volture_strawpile|bone_stack)/;
function isDecor(name) {
  if (NOT_DECOR.test(name)) return false;
  const r = PB.piece(name).role;
  if (['bed', 'table', 'seat', 'storage', 'fire', 'craft', 'deco', 'light', 'rug', 'clutter'].includes(r)) return true;
  return r === 'misc' && (FOOD.test(name) || SLOT[name] != null || /^(piece_pot|piece_gift|piece_mistletoe|Skull|ancient_skull|cloth_hanging_long|fenrirhide_hanging|dvergrprops_|piece_barber|piece_asksvinskeleton|piece_icecube|lox_ribs|Feast)/.test(name));
}

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
    if (can(ctx.biome, 'rug_straw')) for (let k = 0; k < n; k++) { const [x, z] = at(a0 + 1 + 2 * k, 1.1); b.put('rug_straw', x, y + 0.1, z, yawAcross, { decor: true }); } // the straw counts as the stalls' furnishing
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

// Vignettes on bare walls (2026-11-09 interior review: "no bare wall run over 4 m"): in a ground room's plain wall
// bays with nothing within 1.4 m in front, one of a bench under a wall torch, a chest beside a barrel, or an armor
// stand, by what the biome makes; one bay in three at most, never by a door, a window or a stair.
function vignettes(b, ctx, zones) {
  const Ck = checksB();
  const edges = b.outer || [];
  const open = new Set((b.openings || []).map(o => `${o.e.x},${o.e.z},${Math.round(o.y0 * 10)}`));
  let placed = 0, k = 0;
  const kinds = [];
  if (can(ctx.biome, 'piece_walltorch')) kinds.push('bench');
  if (can(ctx.biome, 'piece_chest_barrel')) kinds.push('store');
  if (can(ctx.biome, 'ArmorStand') && ['home', 'longhouse', 'tavern', 'temple'].includes(ctx.type)) kinds.push('armor');
  if (!kinds.length) return 0;
  for (const room of (b.rooms || []).filter(r => !r.upper)) {
    const mine = edges.filter(e => e.cell[0] > room.x0 && e.cell[0] < room.x1 && e.cell[1] > room.z0 && e.cell[1] < room.z1);
    const budget = Math.floor(mine.length / 3);
    let used = 0;
    for (const e of mine) {
      if (used >= budget) break;
      if (open.has(`${e.x},${e.z},${Math.round(room.y * 10)}`)) continue;
      // neighbours with a door are too busy
      if ((b.openings || []).some(o => o.kind !== 'window' && Math.hypot(o.e.x - e.x, o.e.z - e.z) < 2.5)) continue;
      const nx = -e.out[0], nz = -e.out[1], ux = e.yaw === 0 ? 1 : 0, uz = 1 - ux;
      const wall = b.pieces.find(p => !p.decor && PB.piece(p.name).role === 'wall' && Math.abs(p.x - e.x) < 0.3 && Math.abs(p.z - e.z) < 0.3 && p.y > room.y && p.y < room.y + 2.5);
      if (!wall) continue;
      const wo = Ck.aabb(wall), half = e.yaw === 0 ? (wo.z1 - wo.z0) / 2 : (wo.x1 - wo.x0) / 2;
      const box = { x0: e.x + Math.min(0, nx * 1.6) - (ux ? 1.3 : 0.05) + nx * half, x1: e.x + Math.max(0, nx * 1.6) + (ux ? 1.3 : 0.05) + nx * half,
        z0: e.z + Math.min(0, nz * 1.6) - (uz ? 1.3 : 0.05) + nz * half, z1: e.z + Math.max(0, nz * 1.6) + (uz ? 1.3 : 0.05) + nz * half };
      const inPlane = p => !p.decor && Math.abs((p.x - e.x) * nx + (p.z - e.z) * nz) < half + 0.35; // the wall's own posts, trim and courses
      const busy = b.pieces.some(p => { if (p === wall || inPlane(p) || ['floor', 'rug'].includes(PB.piece(p.name).role)) return false; const o = Ck.aabb(p); return o.x0 < box.x1 && o.x1 > box.x0 && o.z0 < box.z1 && o.z1 > box.z0 && o.y0 < room.y + 2.2 && o.y1 > room.y + 0.15; })
        || zones.some(z => z.x0 < box.x1 && z.x1 > box.x0 && z.z0 < box.z1 && z.z1 > box.z0 && z.y0 < room.y + 2 && z.y1 > room.y);
      if (busy) continue;
      const fl = b.pieces.find(p => !p.decor && PB.piece(p.name).role === 'floor' && (() => { const o = Ck.aabb(p); const cx = e.x + nx * (half + 0.5), cz = e.z + nz * (half + 0.5); return cx > o.x0 && cx < o.x1 && cz > o.z0 && cz < o.z1 && Math.abs(o.y1 - (room.y + 0.1)) < 0.6; })());
      if (!fl) continue;
      const top = Ck.aabb(fl).y1, T = { decor: true };
      const at = (d, t = 0) => [+(e.x + nx * (half + d) + ux * t).toFixed(3), +(e.z + nz * (half + d) + uz * t).toFixed(3)];
      const kind = kinds[(k++) % kinds.length], yaw = e.inYaw;
      if (kind === 'bench') {
        const [x, z] = at(0.4); b.put('piece_bench01', x, top, z, yaw, T);
        const [tx, tz] = at(0.28); b.put('piece_walltorch', tx, top + 1.55, tz, (Math.atan2(nx, nz) * 180 / Math.PI + 270 + 360) % 360, { decor: true });
      } else if (kind === 'store') {
        const [x, z] = at(0.42, -0.45); b.put('piece_chest_wood', x, top, z, yaw, T);
        const [x2, z2] = at(0.4, 0.75); b.put('piece_chest_barrel', x2, top, z2, yaw, T);
      } else {
        const [x, z] = at(0.35); b.put('ArmorStand', x, top, z, yaw, T);
      }
      used++; placed++;
    }
  }
  if (placed) b.notes.push(`${placed} corners dressed along bare walls.`);
  return placed;
}

function apply(b, ctx, zones) {
  if (ctx.decor === 'd3' && !['barn', 'storage', 'dock', 'farm'].includes(ctx.type)) vignettes(b, ctx, zones || []);
  if (ctx.decor !== 'd1' && ['longhouse', 'temple'].includes(ctx.type)) dais(b, ctx, zones || []);
  if (ctx.type === 'barn' && ctx.decor !== 'd1') stalls(b, ctx, zones || []);
  if (ctx.type === 'tavern' && ctx.decor !== 'd1') barCounter(b, ctx, zones || []);
  const X = ctx.profile || {};
  if (X.canopyBed != null ? X.canopyBed : (ctx.decor === 'd3' && ['home', 'longhouse'].includes(ctx.type) && ctx.R() < 0.5)) canopyBed(b, ctx);
}

const apiB = { apply, barCounter, canopyBed, stalls, dais, vignettes, CLASSES, SLOT, FOOD, BUILT_SLOTS, slotOf, isDecor, canDecor };
if (NODE_B) module.exports = apiB; else window.VHKitbash = apiB;
