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
// what a village makes: by the piece's materials and, for furniture, by the decorator's table too (the stricter)
const canMake = (biome, name) => {
  if (!can(biome, name)) return false;
  const F = NODE_B ? require('./decorate.js').FURNITURE : (window.VHDecorate && window.VHDecorate.FURNITURE) || {};
  return !F[name] || BIOMES_B.indexOf(F[name].b) <= BIOMES_B.indexOf(biome);
};
const canDecor = (biome, name) => canMake(biome, name) || PB.minor(name);

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

// ---------------------------------------------------------------- placing the library
// The interior library (data/kitbash-interior.json, lab/mine_kitbash.js) and the built-up furniture below are laid in
// every room by the same fitter. Each room's anchors are read from its own walls (any angle: the 135 degree corners of
// an octagon, the 120 degree ones of a hexagon), windows, fire, tables, beds, free posts and stairs. Assemblies are drawn
// by room kind and decor stage from a random stream of their own, so the rest of a design comes out as before. Every
// piece is tested: on this room's floor or against its wall, under its ceiling, out of doorways, climbs, the chimney and
// the fire's ring, clear of windows, resting on what its source rested on, and clipping into walls, furniture and its
// own assembly no deeper than its source builds did (marked p.clip, which lib/checks.js and the audit allow).
const decorB = () => (NODE_B ? require('./decorate.js') : window.VHDecorate);
const shapesB = () => (NODE_B ? require('./shapes.js') : window.VHShapes);
let LIB_B = null;
function library() {
  if (LIB_B) return LIB_B;
  try { LIB_B = NODE_B ? require('../data/kitbash-interior.json') : window.VH_KITBASH; } catch (e) { LIB_B = null; }
  if (!LIB_B) LIB_B = { assemblies: [] };
  return LIB_B;
}
function setLibrary(d) { LIB_B = d; }
// the library as the game and the request page carry it: no sources, no decor table
function lite(d) {
  return { assemblies: d.assemblies.map(a => ({ id: a.id, anchor: a.anchor, angle: a.angle, of: a.of, rooms: a.rooms, score: a.score, once: a.once,
    clips: a.clips, pieces: a.pieces.map(m => { const o = { n: m.n, k: m.k, x: m.x, y: m.y, z: m.z, yaw: m.yaw, rest: m.rest }; if (m.on != null) o.on = m.on; if (m.sink) o.sink = m.sink; return o; }) })) };
}

function rngB(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const normB = a => ((a % 360) + 360) % 360;
// room kinds of the library for each room the decorator furnishes
const ROOM_KINDS = {
  home: ['home'], sleeping: ['home', 'sleeping'], guest: ['home', 'sleeping', 'tavern'], hall: ['hall', 'home'], tavern: ['tavern', 'kitchen', 'hall'],
  temple: ['temple', 'hall'], smithy: ['smithy', 'workshop'], workshop: ['workshop', 'smithy'], storage: ['storage'], farm: ['storage', 'barn'],
  market: ['tavern', 'storage'], guard: ['home'], lookout: [], kitchen: ['kitchen', 'tavern', 'home'],
};
// slots the fitter leaves out: stands that would stand empty until the mod can put an item on them (BLUEPRINT_LAB.md,
// "Items on stands"), seasonal pieces, goblin and ruin pieces, woodpiles (they go outside)
const SKIP_N = /^(itemstand|itemstandh|piece_xmas|piece_gift|piece_mistletoe|piece_jackoturnip|piece_(Celebration|Fairylight)Garland|goblin|Morkhalla|piece_asksvinskeleton|lox_ribs|piece_barber|piece_icecube|Skull|ancient_skull|wood_(fine_|core_)?stack|treasure_pile|Pickable|TreasureChest|loot_chest|piece_chest_private|piece_chest_treasure)/;
// a 1 x 1 floor counts as a floor to stand on in the checks; shelves use beams
const NO_BUILT = ['floor1'];

// Which prefab fills a slot in this village: the source's own when the biome makes it (minor decor goes anywhere),
// else the first of its class that it does. Null leaves the slot out.
function fillSlot(m, biome, ctx) {
  const SH = shapesB(), F = decorB().FURNITURE;
  const okN = n => !SKIP_N.test(n) && (SH.has(n) || F[n]) && canDecor(biome, n);
  if (NO_BUILT.includes(m.k)) return null;
  if (BUILT_SLOTS.includes(m.k)) {
    // building pieces in the village's own kit where it has one of the kind
    const K = ctx.K || {};
    const own = { beam1: K.beam1, beam2: K.beam, half: K.wallHalf, pole2: K.pole && /pole2|pole_log$|darkwood_pole$/.test(K.pole) ? K.pole : null }[m.k];
    if (own && canMake(biome, own) && SH.has(own)) return own;
    return (CLASSES[m.k] || [m.n]).find(n => canMake(biome, n) && SH.has(n)) || null;
  }
  if (m.k === 'feast') return okN(FEAST[biome]) ? FEAST[biome] : null;
  if (m.any && CLASSES[m.k] && ctx._R2) { const l = CLASSES[m.k].filter(okN); if (l.length) return l[Math.floor(ctx._R2() * l.length)]; }
  if (okN(m.n)) return m.n;
  const list = CLASSES[m.k];
  return list ? list.find(okN) || null : null;
}

// A small grid of boxes for the fitter: everything in the building, and what it adds as it goes. Pieces are filed by
// their pivot; a piece's box is worked out the first time a query comes near it (most of a building never is).
function boxIndex(pieces) {
  const Ck = checksB(), cells = new Map(), all = [];
  const key = (i, j) => i * 65536 + j;
  const REACH = 4; // no piece reaches further than this from its pivot (the oak table, 4 m beams, the carvings)
  const add = (p, b) => {
    const rec = { p, _b: b || null };
    Object.defineProperty(rec, 'b', { get() { if (!this._b) this._b = Ck.aabbShapes(this.p); return this._b; } });
    all.push(rec);
    const k = key(Math.floor(p.x / 2), Math.floor(p.z / 2));
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(rec);
    return rec;
  };
  for (const p of pieces) add(p);
  const audit = decorB().auditContext(pieces);
  const near = (b, pad = 0.2) => {
    const out = [];
    const i0 = Math.floor((b.x0 - pad - REACH) / 2), i1 = Math.floor((b.x1 + pad + REACH) / 2), j0 = Math.floor((b.z0 - pad - REACH) / 2), j1 = Math.floor((b.z1 + pad + REACH) / 2);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (const r of cells.get(key(i, j)) || []) {
      const o = r.b;
      if (o.x0 <= b.x1 + pad && o.x1 >= b.x0 - pad && o.z0 <= b.z1 + pad && o.z1 >= b.z0 - pad) out.push(r);
    }
    return out;
  };
  const remove = p => { const l = cells.get(key(Math.floor(p.x / 2), Math.floor(p.z / 2))); if (l) for (let i = l.length - 1; i >= 0; i--) if (l[i].p === p) l.splice(i, 1); const k = all.findIndex(r => r.p === p); if (k >= 0) all.splice(k, 1); audit.remove(p); };
  return { add: (p, b) => { audit.add(p); return add(p, b); }, near, remove, all, audit };
}

// The rooms of a building as the decorator saw them, with their role.
function roomsB(b, ctx) {
  const D = decorB();
  const byY = new Map();
  for (const r of b.rooms || []) { const k = Math.round(r.y * 4) / 4; if (!byY.has(k)) byY.set(k, []); byY.get(k).push(r); }
  const ys = [...byY.keys()].sort((a, c) => a - c);
  const use = (ctx.T && ctx.T.use) || ctx.use || 'home';
  const out = [];
  ys.forEach((y, li) => {
    const rects = byY.get(y);
    const models = D.readLevel(b.pieces, D._int.standGuess(b.pieces, rects, y), rects) || [];
    for (const m of models) {
      if (m.area < 4 || m.covered < 0.5) continue;
      m.upper = li > 0 || rects.every(r => r.upper);
      const role = D._int.roleFor(use, ctx.type, m, 1, rects, ys.length, li);
      if (role) out.push({ m, role, li });
    }
  });
  return out;
}

// The anchors of one room: frames (origin, turn) with what they are.
function anchorsOf(room, b) {
  const m = room.m, Ck = checksB(), out = [];
  const faces = m.faces.filter(f => !f.edge);
  const surf = (f, t) => [f.px(t) + f.nx * f.ht, f.pz(t) + f.nz * f.ht];
  const yawOfN = (nx, nz) => normB(Math.atan2(nx, nz) * 180 / Math.PI);
  for (const f of faces) {
    for (const run of f.runs) {
      if (run.kind === 'wall' && run.a1 - run.a0 >= 0.9) {
        for (let t = run.a0 + 0.5; t <= run.a1 - 0.5 + 0.01; t += 0.5) { const [x, z] = surf(f, t); out.push({ anchor: 'wall', x, z, yaw: yawOfN(f.nx, f.nz), face: f, t }); }
      }
      if (run.kind === 'window' && run.a1 - run.a0 >= 0.7) { const t = (run.a0 + run.a1) / 2, [x, z] = surf(f, t); out.push({ anchor: 'window', x, z, yaw: yawOfN(f.nx, f.nz), face: f, t, w: run.a1 - run.a0 }); }
    }
  }
  // inside corners: two faces whose surfaces meet near an end of each
  for (let i = 0; i < faces.length; i++) for (let j = i + 1; j < faces.length; j++) {
    const f1 = faces[i], f2 = faces[j];
    const cos = f1.nx * f2.nx + f1.nz * f2.nz, ang = Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
    if (ang < 25 || ang > 120) continue;
    // surface lines: n . p = o
    const o1 = f1.px(f1.a0) * f1.nx + f1.pz(f1.a0) * f1.nz + f1.ht, o2 = f2.px(f2.a0) * f2.nx + f2.pz(f2.a0) * f2.nz + f2.ht;
    const det = f1.nx * f2.nz - f1.nz * f2.nx;
    if (Math.abs(det) < 1e-6) continue;
    const Ox = (o1 * f2.nz - o2 * f1.nz) / det, Oz = (f1.nx * o2 - f2.nx * o1) / det;
    const t1 = Ox * f1.ux + Oz * f1.uz, t2 = Ox * f2.ux + Oz * f2.uz;
    const end = (f, t) => Math.min(Math.abs(t - f.a0), Math.abs(t - f.a1)) < 0.8 && t > f.a0 - 0.8 && t < f.a1 + 0.8;
    if (!end(f1, t1) || !end(f2, t2)) continue;
    const bx = f1.nx + f2.nx, bz = f1.nz + f2.nz, l = Math.hypot(bx, bz);
    if (!m.inside(Ox + bx / l * 0.6, Oz + bz / l * 0.6)) continue;
    out.push({ anchor: 'corner', angle: Math.round(180 - ang), x: Ox, z: Oz, yaw: yawOfN(bx, bz), faces: [f1, f2] });
  }
  const inRoom = p => m.inside(p.x, p.z) && Math.abs(p.y - m.stand) < 0.7;
  for (const p of b.pieces) {
    if (!p.decor && !/^(hearth|fire_pit|fire_pit_iron)$/.test(p.name)) {
      const info = PB.piece(p.name);
      // a free post: standing on this floor, away from every wall face
      if (info.role === 'pole' && Math.abs(p.y - 1 - m.stand) < 0.3 && m.inside(p.x + 0.4, p.z) + m.inside(p.x - 0.4, p.z) + m.inside(p.x, p.z + 0.4) + m.inside(p.x, p.z - 0.4) >= 4 &&
        !faces.some(f => Math.abs((p.x - f.px(0)) * f.nx + (p.z - f.pz(0)) * f.nz) < f.ht + 0.6 && (p.x * f.ux + p.z * f.uz) > f.a0 - 0.5 && (p.x * f.ux + p.z * f.uz) < f.a1 + 0.5))
        for (let k = 0; k < 4; k++) out.push({ anchor: 'post', x: p.x, z: p.z, yaw: k * 90, of: p });
      if (info.role === 'stair' && /stair/.test(p.name) && p.y > m.stand + 0.9 && p.y < m.stand + 3.2 && m.inside(p.x, p.z)) out.push({ anchor: 'stair', x: p.x, z: p.z, yaw: normB(p.yaw || 0), of: p });
      continue;
    }
    if (!inRoom(p)) continue;
    const n = p.name;
    if (/^(hearth|fire_pit|fire_pit_iron)$/.test(n)) { const o = Ck.aabb(p); for (let k = 0; k < 4; k++) out.push({ anchor: 'hearth', x: (o.x0 + o.x1) / 2, z: (o.z0 + o.z1) / 2, yaw: normB((p.yaw || 0) + k * 90), of: p, akind: /hearth/.test(n) ? 'hearth' : 'pit' }); }
    else if (/^(piece_table|piece_table_round|piece_table_oak|piece_blackmarble_table|dvergrprops_table)$/.test(n)) out.push({ anchor: 'table', x: p.x, z: p.z, yaw: normB(p.yaw || 0), of: p, akind: /round/.test(n) ? 'round' : /oak|blackmarble/.test(n) ? 'long' : 'table' });
    else if (/^(bed|piece_bed02|ashwood_bed)$/.test(n)) out.push({ anchor: 'bed', x: p.x, z: p.z, yaw: normB(p.yaw || 0), of: p, akind: /bed02/.test(n) ? 'bed2' : 'bed' });
  }
  return out;
}

// Does an anchor take an assembly: the same kind, corners of the same angle, tables and beds of the same kind.
function takes(anc, a) {
  if (anc.anchor !== a.anchor) return false;
  if (a.anchor === 'corner') return Math.abs(anc.angle - a.angle) <= 10;
  if (a.anchor === 'table' || a.anchor === 'bed') return !a.of || a.of === anc.akind || (a.of === 'table' && anc.akind === 'long');
  if (a.anchor === 'hearth') return !a.of || a.of === anc.akind;
  return true;
}

// Fit one assembly at one anchor (mirrored or not). Returns the pieces to add, or null.
function fit(b, ctx, room, idx, zones, anc, a, mirror, fires) {
  const Ck = checksB(), SH = shapesB(), m = room.m;
  const fy = anc.yaw * Math.PI / 180, c = Math.cos(fy), s = Math.sin(fy);
  const clipOf = (u, v) => { let d = 0; for (const cl of a.clips || []) if ((cl[0] === u && cl[1] === v) || (cl[0] === v && cl[1] === u)) d = Math.max(d, cl[2]); return d; };
  const order = a.pieces.map((p, i) => i).sort((i, j) => (a.pieces[i].rest === 'on' ? 1 : 0) - (a.pieces[j].rest === 'on' ? 1 : 0));
  const made = new Array(a.pieces.length).fill(null);
  const displace = a.built ? new Set() : null;
  const needed = new Set(a.pieces.filter(p => p.rest === 'on').map(p => p.on));
  let dropped = 0;
  const picks = {};
  const kb = `${a.id}@${Math.round(anc.x * 10)},${Math.round(anc.z * 10)}`;
  // a quick look first: each piece's spot on this room's floor (or at its wall), out of the keep-clear boxes
  let miss = 0;
  for (let i = 0; i < a.pieces.length; i++) {
    const mm = a.pieces[i];
    let lx = mirror ? -mm.x : mm.x;
    if (a.byWidth && anc.w) lx = Math.sign(lx) * (anc.w / 2 + Math.abs(lx));
    const x = anc.x + lx * c + mm.z * s, z = anc.z - lx * s + mm.z * c, y = m.stand + mm.y;
    const out = !m.nearWall(x, z, 0.5) || (mm.k !== 'rug' && zones.some(zn => x > zn.x0 && x < zn.x1 && z > zn.z0 && z < zn.z1 && y + 0.3 > zn.y0 && y < zn.y1));
    if (out) { if (needed.has(i)) return null; miss++; }
  }
  if (a.pieces.length - miss < Math.max(2, Math.ceil(a.pieces.length * 0.6))) return null;
  for (const i of order) {
    const mm = a.pieces[i];
    const fail = () => { if (needed.has(i)) return true; dropped++; return false; };
    // a random pick (banners) is made once per assembly, so a pair matches
    const name = mm.any ? (picks[mm.k] || (picks[mm.k] = fillSlot(mm, ctx.biome, ctx))) : fillSlot(mm, ctx.biome, ctx);
    if (!name || (mm.rest === 'on' && !made[mm.on])) { if (fail()) return null; continue; }
    let lx = mirror ? -mm.x : mm.x;
    if (a.byWidth && anc.w) lx = Math.sign(lx) * (anc.w / 2 + Math.abs(lx));
    const lz = mm.z, lyaw = mirror ? -mm.yaw : mm.yaw;
    const x = anc.x + lx * c + lz * s, z = anc.z - lx * s + lz * c, yaw = normB(anc.yaw + lyaw);
    const cell = m.cellAt(x, z);
    const stand = cell ? cell.st : m.stand;
    const p = { name, x: +x.toFixed(3), y: +(stand + Math.max(mm.y, -(mm.sink || 0))).toFixed(3), z: +z.toFixed(3), q: quatB(yaw), yaw, decor: true, kb, rest: mm.rest };
    if (BUILT_SLOTS.includes(mm.k)) p.trim = true;
    let bx = Ck.aabbShapes(p);
    // set the piece on what it rests on, so a substitute of another height sits right
    const under = mm.rest === 'on' ? made[mm.on] : mm.rest === 'anchor' ? anc.of : null;
    if (under) {
      const top = (SH.world(under) && SH.topAt(SH.world(under), (bx.x0 + bx.x1) / 2, (bx.z0 + bx.z1) / 2)) ?? Ck.aabbShapes(under).y1;
      p.y = +(p.y + top - bx.y0).toFixed(3); bx = Ck.aabbShapes(p);
      p.rest = 'on';
    } else if (mm.rest === 'floor') {
      if (!bx.pass) { p.y = +(p.y + (stand - (mm.sink || 0)) - bx.y0).toFixed(3); bx = Ck.aabbShapes(p); }
      else p.y = +(stand + 0.02).toFixed(3);
    }
    if (!placeable(p, bx, mm, i, b, ctx, room, idx, zones, made, clipOf, anc, fires, displace)) { LAST_B = `${i} ${p.name}`; if (fail()) return null; continue; }
    made[i] = p;
  }
  const got = made.filter(Boolean);
  if (got.length < 2 || got.length < Math.ceil(a.pieces.length * 0.6) || got.every(p => p.trim)) return null;
  // two of one thing is a pair of chairs, not a corner; only a store room takes those
  if (!a.built && room.role !== 'storage' && new Set(got.map(p => slotOf(p.name))).size < 2) return null;
  if (displace && displace.size > 2) return null;
  // a way past: 0.9 m of this room's floor in front of what stands against a wall or in a corner
  if (['wall', 'corner', 'window'].includes(a.anchor)) {
    const nx = Math.sin(fy), nz = Math.cos(fy), ux = Math.cos(fy), uz = -Math.sin(fy);
    for (const p of got) {
      if (p.rest !== 'floor' || PB.piece(p.name).role === 'rug') continue;
      const o = Ck.aabbShapes(p);
      if (o.pass) continue;
      let far = -Infinity, lo = Infinity, hi = -Infinity;
      for (const [x, z] of [[o.x0, o.z0], [o.x1, o.z0], [o.x0, o.z1], [o.x1, o.z1]]) {
        const v = (x - anc.x) * nx + (z - anc.z) * nz, t = (x - anc.x) * ux + (z - anc.z) * uz;
        far = Math.max(far, v); lo = Math.min(lo, t); hi = Math.max(hi, t);
      }
      for (const t of [lo + 0.1, (lo + hi) / 2, hi - 0.1]) for (const v of [far + 0.45, far + 0.9]) {
        const x = anc.x + ux * t + nx * v, z = anc.z + uz * t + nz * v;
        if (!m.inside(x, z)) return null;
      }
    }
  }
  got.displace = displace ? [...displace] : [];
  return got;
}

// The tests for one piece.
// why the last piece was turned down (for lab/bench.js and tuning)
let WHY_B = 0, LAST_B = '', LASTQ_B = '';
const no = k => { WHY_B = k; return false; };
const MOVABLE = ['storage', 'seat', 'deco', 'clutter', 'light'];
function placeable(p, bx, mm, i, b, ctx, room, idx, zones, made, clipOf, anc, fires, displace) {
  const Ck = checksB(), SH = shapesB(), D = decorB(), m = room.m;
  const cx = (bx.x0 + bx.x1) / 2, cz = (bx.z0 + bx.z1) / 2;
  const info = PB.piece(p.name);
  const flat = info.role === 'rug';
  // on this room's floor, or against its wall
  const pts = [[cx, cz], [bx.x0 + 0.05, bx.z0 + 0.05], [bx.x1 - 0.05, bx.z0 + 0.05], [bx.x0 + 0.05, bx.z1 - 0.05], [bx.x1 - 0.05, bx.z1 - 0.05]];
  if (!m.inside(cx, cz) && !(p.rest === 'wall' && m.nearWall(cx, cz, 0.5))) return no(1);
  if (!pts.every(([x, z]) => m.nearWall(x, z, 0.5))) return no(2);
  // a floor piece stands on this level's floor all round
  if (p.rest === 'floor' && !flat && !pts.slice(1).every(([x, z]) => { const c = m.cellAt(x, z); return !c || Math.abs(c.st - m.stand) < 0.06; })) return no(3);
  // under the ceiling, and no deeper in the floor than its source
  if (bx.y1 > m.ceilAt(cx, cz) - 0.08) return no(4);
  if (bx.y0 < m.stand - (mm.sink || 0) - 0.06) return no(5);
  // out of doorways, climbs, chimneys and the room's keep-clear boxes; out of the fire's ring
  if (!flat) {
    if (zones.some(zn => zn.x0 < bx.x1 && zn.x1 > bx.x0 && zn.z0 < bx.z1 && zn.z1 > bx.z0 && zn.y0 < bx.y1 && zn.y1 > bx.y0)) return no(6);
    for (const f of fires) { const o = f.b; if (o.x0 - 0.35 < bx.x1 && o.x1 + 0.35 > bx.x0 && o.z0 - 0.35 < bx.z1 && o.z1 + 0.35 > bx.z0 && bx.y0 < o.y1 + 1.2) return no(7); }
  }
  // the decorator's own door and stair boxes (the audit's): a door's width 1.2 m deep each side, a stair and 0.6 m round it
  const dz = D._int, yawP = p.yaw;
  // the audit's own box for the piece (the furniture table's size where it has one)
  const it = D.itemOf(p), ob = it.b;
  void yawP;
  for (const r of idx.near(bx, 2.6)) {
    const q = r.p, qi = r.b.info;
    // built gates count (the stalls' gates are furniture made of building pieces)
    if ((q.decor && !q.trim) || !(qi.role === 'door' || qi.role === 'stair')) continue;
    if (qi.role === 'door' && !flat) {
      const s = PB.piece(q.name), qy = dz.pyaw(q), ar = qy * Math.PI / 180, nx = Math.sin(ar), nz = Math.cos(ar);
      const hw = s.size[0] / 2, hd = s.size[2] / 2, y0 = q.y - s.size[1] / 2;
      for (const sg of [1, -1]) if (Math.min(bx.y0, it.y0) < y0 + 1.8 && Math.max(bx.y1, it.y1) > y0 + 0.05 && dz.overlap(dz.obox(q.x + nx * sg * (hd + 0.6), q.z + nz * sg * (hd + 0.6), hw * 2, 1.2, qy), ob, -0.02)) return no(8);
    }
    if (qi.role === 'stair' && !flat) {
      const s = PB.piece(q.name), y0 = q.y - s.size[1] / 2, y1 = q.y + s.size[1] / 2;
      if (Math.min(bx.y0, it.y0) < y1 + 0.3 && Math.max(bx.y1, it.y1) > y0 && dz.overlap(dz.obox(q.x, q.z, s.size[0] + 1.2, s.size[2] + 1.2, dz.pyaw(q)), ob, -0.02)) return no(9);
    }
  }
  // clear of windows: nothing tall in front of one, nothing hung on one
  for (const f of m.faces) {
    if (f.edge) continue;
    const dist = (cx - f.px(0)) * f.nx + (cz - f.pz(0)) * f.nz - f.ht;
    if (dist > 0.9 || dist < -0.6) continue;
    const t0 = Math.min(bx.x0 * f.ux + bx.z0 * f.uz, bx.x1 * f.ux + bx.z1 * f.uz, bx.x0 * f.ux + bx.z1 * f.uz, bx.x1 * f.ux + bx.z0 * f.uz);
    const t1 = Math.max(bx.x0 * f.ux + bx.z0 * f.uz, bx.x1 * f.ux + bx.z1 * f.uz, bx.x0 * f.ux + bx.z1 * f.uz, bx.x1 * f.ux + bx.z0 * f.uz);
    const st = D._int.stretch(f, t0 + 0.05, t1 - 0.05);
    if (st.ks.has('door')) return no(10);
    // under a window only what stays below the sill (as the decorator's wallSpots)
    if (st.ks.has('window') && bx.y1 > m.stand + st.top + 0.15 && !flat) return no(11);
    if (p.rest === 'wall' && dist < 0.5 && (st.ks.has('window') || st.ks.has('open') || st.ks.has('none'))) return no(12);
  }
  // the audit's own tests: what it rests on is there, and plain wall behind a wall piece
  if (!decorB().auditOne(p, idx.audit, made.filter(Boolean))) return no(13);
  if (p.rest === 'wall' && !m.faces.some(f => !f.edge && Math.abs((cx - f.px(0)) * f.nx + (cz - f.pz(0)) * f.nz - f.ht) < 0.6 &&
    (cx * f.ux + cz * f.uz) > f.a0 && (cx * f.ux + cz * f.uz) < f.a1)) return no(14);
  if (p.rest === 'hang' && !idx.near(bx).some(r => !r.p.decor && r.b.info.structural && r.b.x0 < cx && r.b.x1 > cx && r.b.z0 < cz && r.b.z1 > cz && r.b.y0 > bx.y1 - 0.3 && r.b.y0 < bx.y1 + 0.5)) return no(15);
  // clips: into the wall and the anchor no deeper than the source, into anything else not at all
  // small things with no solids (food, candles) keep apart from each other
  if (bx.pass && !flat && idx.near(bx).concat(made.filter(Boolean).map(o => ({ p: o, b: Ck.aabbShapes(o) }))).some(r => r.p !== p && r.b.pass && PB.piece(r.p.name).role !== 'rug' &&
    Math.hypot(r.p.x - p.x, r.p.z - p.z) < 0.22 && Math.abs(r.p.y - p.y) < 0.3)) return no(16);
  if (bx.y0 < m.stand - 0.02 && p.rest === 'floor') p.sink = +(m.stand - bx.y0 + 0.005).toFixed(3);
  if (flat || bx.pass || !bx.sol || !bx.sol.length) return true;
  let deepest = 0;
  for (const r of idx.near(bx)) {
    const q = r.p, qb = r.b;
    if (!qb.sol || !qb.sol.length || qb.pass || q === p) continue;
    if (qb.x0 >= bx.x1 || qb.x1 <= bx.x0 || qb.z0 >= bx.z1 || qb.z1 <= bx.z0 || qb.y0 >= bx.y1 || qb.y1 <= bx.y0) continue;
    const role = qb.info.role;
    if (!q.decor && ['floor', 'roof', 'roofTop', 'roofCorner'].includes(role)) continue; // floors (sinking is tested above) and roofs over it
    if (role === 'rug') continue; // rugs lie under everything
    const d = SH.clipDepth(bx.sol, qb.sol);
    if (d <= 0.01) continue;
    // a built kit may move the decorator's chests, seats and lights out of its way (as the bar counter does)
    if (displace && q.decor && !q.kb && !q.trim && MOVABLE.includes(role) && !/^(bed|piece_bed02|ashwood_bed)$/.test(q.name)) { displace.add(q); continue; }
    let allow = 0;
    if (!q.decor && ['wall', 'window', 'gable', 'beam', 'pole'].includes(role)) allow = clipOf(i, 'w');
    if (anc.of && q === anc.of) allow = Math.max(allow, clipOf(i, 'a'));
    if (d > allow + 0.01) { LASTQ_B = `${q.name}${q.decor ? '*' : ''} ${d.toFixed(2)}`; return no(17); }
    deepest = Math.max(deepest, d);
  }
  made.forEach((o, j) => {
    if (!o || deepest < 0) return;
    const ob2 = Ck.aabbShapes(o);
    if (!ob2.sol || !ob2.sol.length) return;
    const d = SH.clipDepth(bx.sol, ob2.sol);
    if (d <= 0.01) return;
    if (d > Math.max(clipOf(i, j), 0.02) + 0.01) deepest = -1;
    else deepest = Math.max(deepest, d);
  });
  if (deepest < 0) return no(18);
  if (deepest > 0.01) p.clip = +(deepest + 0.005).toFixed(3);
  return true;
}

// How many assemblies a room takes at each decor stage: few at d1, a lived-in room at d3. Floor kept free: at least
// 55 % of the room.
function budget(decor, area) {
  if (decor === 'd1') return area >= 30 ? 1 : 0;
  if (decor === 'd2') return Math.max(1, Math.min(3, Math.round(area / 22)));
  return Math.max(2, Math.min(8, Math.round(area / 12)));
}

function furnishRooms(b, ctx, zones, R2, extra) {
  const Ck = checksB();
  const lib = library().assemblies.concat(extra || []);
  const idx = boxIndex(b.pieces);
  let placed = 0;
  const used = {};
  for (const room of roomsB(b, ctx)) {
    const kinds = ROOM_KINDS[room.role] || [room.role];
    if (!kinds.length) continue;
    const anchors = anchorsOf(room, b);
    if (!anchors.length) continue;
    const fires = b.pieces.filter(p => p.decor && /^(hearth|fire_pit|fire_pit_iron)$/.test(p.name)).map(p => ({ p, b: Ck.aabb(p) }));
    // candidates: assemblies for this room's kind that some anchor here takes, weighted by score and how well the
    // room kind fits; a building's own anchor first (the forge corner, the bed corner, the serving corner)
    // each built kit once in a building (shelves, cabinets and drapes twice), each mined assembly twice
    const cap = a => (a.built ? (['BK-shelf', 'BK-cabinet', 'BK-drapes', 'BK-bedside', 'BK-bedside2'].includes(a.id) ? 2 : 1) : 2);
    const cands = lib.filter(a => (used[a.id] || 0) < cap(a) && (a.rooms || []).some(k => kinds.includes(k) || k === 'any') && anchors.some(an => takes(an, a)) &&
      (!a.types || a.types.includes(ctx.type)) && (!a.decor || a.decor.includes(ctx.decor)))
      .map(a => {
        // more kinds of piece weigh more; a pair of chests is common in the corpus and dull in every room
        const ks = new Set(a.pieces.map(p => p.k).filter(k => !BUILT_SLOTS.includes(k)));
        const store = [...ks].every(k => ['chest', 'barrel', 'crate', 'sign'].includes(k));
        const w = Math.log(1 + a.score) * (kinds.includes((a.rooms || [])[0]) ? 1.5 : 1) * (a.built ? 2.5 : 1) * (1 + 0.35 * (ks.size - 1)) * (store && room.role !== 'storage' ? 0.3 : 1);
        return { a, w, sig: [...ks].sort().join(',') };
      });
    if (!cands.length) continue;
    let want = budget(ctx.decor, room.m.area);
    const floorArea = room.m.area;
    let footprint = 0;
    for (const r of idx.all) if (r.p.decor && room.m.inside(r.p.x, r.p.z) && !r.b.pass && r.b.y0 < room.m.stand + 0.3 && r.b.y1 > room.m.stand + 0.2 && room.m.inside((r.b.x0 + r.b.x1) / 2, (r.b.z0 + r.b.z1) / 2)) footprint += (r.b.x1 - r.b.x0) * (r.b.z1 - r.b.z0);
    const firsts = cands.filter(x => x.a.first && x.a.first.includes(ctx.type));
    let tries = 0;
    const takenAnchors = [];
    let misses = 0;
    while (want > 0 && tries < 30 && misses < 10) {
      tries++;
      let pick;
      if (firsts.length) pick = firsts.shift();
      else {
        let tot = 0;
        const wt = x => x.w / (1 + 2 * (used[x.a.id] || 0)) / (1 + 3 * (used[x.sig] || 0));
        for (const x of cands) tot += wt(x);
        let r = R2() * tot;
        pick = cands[cands.length - 1];
        for (const x of cands) { r -= wt(x); if (r <= 0) { pick = x; break; } }
      }
      const a = pick.a;
      if ((used[a.id] || 0) >= cap(a)) { cands.splice(cands.indexOf(pick), 1); if (!cands.length) break; continue; }
      const ancs = anchors.filter(an => takes(an, a) && !takenAnchors.some(t => Math.hypot(t.x - an.x, t.z - an.z) < 1.2 && t.anchor === an.anchor));
      // shuffled from the room's own stream
      for (let k = ancs.length - 1; k > 0; k--) { const j = Math.floor(R2() * (k + 1)); const t = ancs[k]; ancs[k] = ancs[j]; ancs[j] = t; }
      let done = false;
      for (const an of ancs.slice(0, 10)) {
        for (const mir of R2() < 0.5 ? [false, true] : [true, false]) {
          const got = fit(b, ctx, room, idx, zones, an, a, mir, fires);
          if (!got) continue;
          // floor kept free
          const add = got.reduce((sum, p) => { const o = Ck.aabbShapes(p); return sum + (!o.pass && p.rest === 'floor' && PB.piece(p.name).role !== 'rug' ? (o.x1 - o.x0) * (o.z1 - o.z0) : 0); }, 0);
          if (footprint + add > floorArea * 0.45) continue;
          footprint += add;
          // what the kit moved goes, with whatever stood on it
          if (got.displace.length) {
            const out = new Set(got.displace);
            for (const q of b.pieces) if (q.decor && !q.kb && !out.has(q) && got.displace.some(o => { const ob = Ck.aabbShapes(o); return q.x > ob.x0 && q.x < ob.x1 && q.z > ob.z0 && q.z < ob.z1 && q.y > o.y + 0.2 && q.y < o.y + 1.6; })) out.add(q);
            b.pieces = b.pieces.filter(q => !out.has(q));
            for (const q of out) idx.remove(q);
          }
          for (const p of got) { b.pieces.push(p); idx.add(p); }
          takenAnchors.push(an);
          used[a.id] = (used[a.id] || 0) + 1;
          used[pick.sig] = (used[pick.sig] || 0) + 1;
          placed++; want--; done = true; misses = 0;
          break;
        }
        if (done) break;
      }
      if (!done) misses++;
    }
  }
  return placed;
}

function apply(b, ctx, zones) {
  if (ctx.decor === 'd3' && !['barn', 'storage', 'dock', 'farm'].includes(ctx.type)) vignettes(b, ctx, zones || []);
  if (ctx.decor !== 'd1' && ['longhouse', 'temple'].includes(ctx.type)) dais(b, ctx, zones || []);
  if (ctx.type === 'barn' && ctx.decor !== 'd1') stalls(b, ctx, zones || []);
  if (ctx.type === 'tavern' && ctx.decor !== 'd1') barCounter(b, ctx, zones || []);
  const X = ctx.profile || {};
  if (X.canopyBed != null ? X.canopyBed : (ctx.decor === 'd3' && ['home', 'longhouse'].includes(ctx.type) && ctx.R() < 0.5)) canopyBed(b, ctx);
  // the interior library last, from its own stream (drawn after everything above, so the rest comes out as before)
  if (X.interiorKit !== false) {
    const R2 = rngB(Math.floor(ctx.R() * 4294967296) ^ 0x6b62);
    const n = furnishRooms(b, { ...ctx, _R2: R2 }, zones || [], R2, BUILT_KITS);
    if (n) b.notes.push(`${n} furnished corners and walls from the interior library.`);
  }
}

// ---------------------------------------------------------------- built-up furniture
// Furniture vanilla lacks, made the way skilled builders make it (D-065): in the library's format, placed and tested by
// the same fitter. Frames: a wall's surface with +z into the room; a corner's meeting point with +z along the
// bisector (a 90 degree corner's walls run along (1, 1) and (-1, 1)); a bed's pivot with its head at -z; a table's
// pivot. y is over the floor's top; 'on' is the index of the piece it stands on. clips: [piece, piece, depth] for the
// clips the build means (a chest set into a half wall shows only its front, as a drawer).
const kp = (n, x, y, z, yaw, rest, on, extra) => Object.assign({ n, k: slotOf(n), x, y, z, yaw, rest }, on != null ? { on } : {}, extra || {});
const C45 = 0.7071;
const along1 = (t, d) => [+(t * C45 - d * C45).toFixed(3), +(t * C45 + d * C45).toFixed(3)]; // against the wall running to +x
const along2 = (t, d) => [+(-t * C45 + d * C45).toFixed(3), +(t * C45 + d * C45).toFixed(3)]; // against the wall running to -x
const kit = (id, anchor, rooms, pieces, o) => Object.assign({ id, anchor, rooms, pieces, clips: [], score: 6, built: true }, o || {});
const BUILT_KITS = [
  // a cabinet: a half wall with a chest set into it (its front shows as drawers), a plank top of two ledges, a pot and
  // a candle on it
  kit('BK-cabinet', 'wall', ['home', 'kitchen', 'tavern', 'hall', 'storage', 'workshop'], [
    kp('wood_wall_half', 0, 0.5, 0.55, 0, 'floor'), kp('piece_chest_wood', 0, 0, 0.38, 0, 'floor'),
    kp('wood_ledge', -0.5, 1.0, 0.42, 0, 'on', 0), kp('wood_ledge', 0.5, 1.0, 0.42, 0, 'on', 0),
    kp('piece_pot3', -0.55, 1.05, 0.42, 0, 'on', 2), kp('Candle_resin', 0.6, 1.05, 0.42, 0, 'on', 3), kp('MeadTasty', 0.25, 1.05, 0.45, 30, 'on', 3)],
  { clips: [[1, 0, 0.42]] }),
  // drawers of barrels: two barrels set into a half wall, a ledge top with bread and a candle
  kit('BK-drawers', 'wall', ['home', 'kitchen', 'tavern', 'storage'], [
    kp('wood_wall_half', 0, 0.5, 0.55, 0, 'floor'), kp('piece_chest_barrel', -0.5, 0, 0.4, 0, 'floor'), kp('piece_chest_barrel', 0.5, 0, 0.4, 0, 'floor'),
    kp('wood_ledge', -0.5, 1.0, 0.42, 0, 'on', 0), kp('wood_ledge', 0.5, 1.0, 0.42, 0, 'on', 0),
    kp('Bread', -0.5, 1.05, 0.42, 80, 'on', 3), kp('Candle_resin', 0.55, 1.05, 0.4, 0, 'on', 4)],
  { clips: [[1, 0, 0.42], [2, 0, 0.42]] }),
  // a bedside table: a barrel by the head of the bed with a candle and a mead on it
  kit('BK-bedside', 'bed', ['home', 'sleeping'], [
    kp('piece_chest_barrel', 1.3, 0, -0.95, 0, 'floor'), kp('Candle_resin', 1.2, 0.9, -1.05, 0, 'on', 0), kp('MeadTasty', 1.45, 0.9, -0.85, 40, 'on', 0)],
  { of: 'bed', first: ['home'] }),
  kit('BK-bedside2', 'bed', ['home', 'sleeping'], [
    kp('piece_chest_barrel', 1.85, 0, -1.2, 0, 'floor'), kp('Candle_resin', 1.75, 0.9, -1.3, 0, 'on', 0), kp('MeadTasty', 2.0, 0.9, -1.1, 40, 'on', 0)],
  { of: 'bed2', first: ['home'] }),
  // a stand for the night: a 1 m post with a ledge on it, a candle on that, and a pelt by the bed
  kit('BK-nightstand', 'bed', ['home', 'sleeping'], [
    kp('wood_pole', 1.25, 0.5, -1.0, 0, 'floor'), kp('wood_ledge', 1.25, 1.0, -1.0, 0, 'on', 0), kp('Candle_resin', 1.25, 1.05, -1.0, 0, 'on', 1),
    kp('rug_wolf', 1.35, 0, 0.4, 0, 'floor')], { of: 'bed' }),
  // a couch: a bench against the wall with a pelt over its seat, a torch over its end
  kit('BK-couch', 'wall', ['home', 'hall', 'tavern', 'sleeping'], [
    kp('piece_bench01', 0, 0, 0.45, 0, 'floor'), kp('rug_wolf', 0, 0.46, 0.4, 90, 'on', 0), kp('piece_walltorch', 1.4, 1.55, 0.28, 270, 'wall')]),
  // a living room: the couch, a rug in front, a chest for a low table with mead and a candle, an armchair each side
  kit('BK-living', 'wall', ['home', 'hall', 'tavern'], [
    kp('piece_bench01', 0, 0, 0.45, 0, 'floor'), kp('rug_wolf', 0, 0.46, 0.4, 90, 'on', 0), kp('rug_deer', 0, 0, 1.95, 0, 'floor'),
    kp('piece_chest_wood', 0, 0, 1.75, 0, 'floor'), kp('MeadTasty', -0.4, 0.75, 1.75, 20, 'on', 3), kp('Candle_resin', 0.45, 0.75, 1.7, 0, 'on', 3),
    kp('piece_chair02', 1.75, 0, 1.7, 270, 'floor'), kp('piece_chair02', -1.75, 0, 1.7, 90, 'floor')], { score: 8 }),
  // drapes: a banner each side of a window (hung 2.75 m up, their hems on the floor), a bench under it
  kit('BK-drapes', 'window', ['home', 'hall', 'tavern', 'temple', 'sleeping'], [
    kp('piece_banner01', -0.8, 2.75, 0.2, 90, 'wall', null, { any: true }), kp('piece_banner01', 0.8, 2.75, 0.2, 90, 'wall', null, { any: true }),
    kp('piece_bench01', 0, 0, 0.45, 0, 'floor')], { byWidth: true }),
  // a window seat: a log bench under the window, pots each side
  kit('BK-windowseat', 'window', ['home', 'hall', 'tavern', 'sleeping'], [
    kp('piece_logbench01', 0, 0, 0.4, 0, 'floor'), kp('piece_pot1', -0.45, 0, 0.4, 0, 'floor'), kp('piece_pot2', 0.45, 0, 0.4, 0, 'floor'), kp('rug_straw', 0, 0, 1.4, 0, 'floor')],
  { byWidth: true }),
  // shelves: two ledges on the wall with a pot, a candle, a mead and bread on them, barrels standing under them
  kit('BK-shelf', 'wall', ['home', 'kitchen', 'tavern', 'storage', 'workshop', 'smithy'], [
    kp('wood_ledge', -0.5, 1.35, 0.3, 0, 'wall'), kp('wood_ledge', 0.5, 1.35, 0.3, 0, 'wall'),
    kp('piece_pot3', -0.6, 1.4, 0.32, 0, 'on', 0), kp('Candle_resin', -0.15, 1.4, 0.3, 0, 'on', 0), kp('MeadTasty', 0.25, 1.4, 0.35, 0, 'on', 1), kp('Bread', 0.65, 1.4, 0.3, 80, 'on', 1),
    kp('piece_chest_barrel', -0.45, 0, 0.42, 0, 'floor'), kp('piece_chest_barrel', 0.45, 0, 0.42, 0, 'floor')]),
  // a kitchen wall: a counter of a half wall with a plank top, the spice rack over it, a pot, bread and meat on it;
  // barrels beside it with the pots and pans hung over them
  kit('BK-kitchen', 'wall', ['kitchen', 'tavern', 'home'], [
    kp('wood_wall_half', -1.0, 0.5, 0.55, 0, 'floor'), kp('wood_ledge', -1.5, 1.0, 0.42, 0, 'on', 0), kp('wood_ledge', -0.5, 1.0, 0.42, 0, 'on', 0),
    kp('cauldron_ext1_spice', -1.0, 1.75, 0.12, 0, 'wall'), kp('piece_pot3', -1.55, 1.05, 0.42, 0, 'on', 1), kp('Bread', -0.75, 1.05, 0.42, 80, 'on', 2), kp('CookedMeat', -0.35, 1.05, 0.4, 0, 'on', 2),
    kp('piece_chest_barrel', 0.6, 0, 0.42, 0, 'floor'), kp('piece_chest_barrel', 1.45, 0, 0.42, 0, 'floor'), kp('cauldron_ext4_pots', 1.05, 1.95, 0.02, 0, 'wall')],
  { first: ['tavern'], score: 8 }),
  // a feast table: the village's own feast in the middle, candles at the ends, meads
  kit('BK-feast', 'table', ['hall', 'tavern', 'home', 'kitchen'], [
    kp('FeastMeadows', 0, 0.8, 0, 0, 'anchor'), kp('Candle_resin', -0.9, 0.8, 0.05, 0, 'anchor'), kp('Candle_resin', 0.9, 0.8, -0.05, 0, 'anchor'),
    kp('MeadTasty', -0.55, 0.8, 0.3, 0, 'anchor'), kp('MeadTasty', 0.55, 0.8, -0.3, 180, 'anchor')], { of: 'table', score: 8 }),
  // a kitchen island: a table with a pot, bread and meat on it and a barrel at each end
  kit('BK-island', 'table', ['kitchen', 'tavern', 'home'], [
    kp('piece_pot3', -0.7, 0.8, 0, 0, 'anchor'), kp('Bread', 0.15, 0.8, 0.1, 80, 'anchor'), kp('CookedMeat', 0.6, 0.8, -0.15, 0, 'anchor'),
    kp('piece_chest_barrel', -1.75, 0, 0, 0, 'floor'), kp('piece_chest_barrel', 1.75, 0, 0, 0, 'floor')], { of: 'table' }),
  // the smithy's forge corner: the tool rack on one wall over a chest, a quench barrel in the corner, an armor stand
  // and a torch on the other wall
  kit('BK-forgecorner', 'corner', ['smithy'], [
    kp('forge_ext6', along2(1.6, 0.12)[0], 1.6, along2(1.6, 0.12)[1], 45, 'wall'), kp('piece_chest_barrel', 0, 0, 0.71, 0, 'floor'),
    kp('ArmorStand', along1(1.4, 0.45)[0], 0, along1(1.4, 0.45)[1], 315, 'floor'), kp('piece_chest', along2(1.7, 0.55)[0], 0, along2(1.7, 0.55)[1], 45, 'floor'),
    kp('piece_walltorch', along1(2.5, 0.28)[0], 1.55, along1(2.5, 0.28)[1], 225, 'wall')], { angle: 90, first: ['smithy'], score: 8 }),
  // the tavern's serving corner: barrels stacked in the corner and along the wall behind a counter with meads on it
  kit('BK-serving', 'corner', ['tavern'], [
    kp('piece_chest_barrel', 0, 0, 0.71, 0, 'floor'), kp('piece_chest_barrel', 0, 0.9, 0.71, 0, 'on', 0),
    kp('piece_chest_barrel', along1(1.2, 0.45)[0], 0, along1(1.2, 0.45)[1], 315, 'floor'),
    kp('wood_wall_half', along2(2.2, 1.4)[0], 0.5, along2(2.2, 1.4)[1], 45, 'floor'),
    kp('wood_ledge', along2(1.7, 1.4)[0], 1.0, along2(1.7, 1.4)[1], 45, 'on', 3), kp('wood_ledge', along2(2.7, 1.4)[0], 1.0, along2(2.7, 1.4)[1], 45, 'on', 3),
    kp('MeadTasty', along2(1.6, 1.4)[0], 1.05, along2(1.6, 1.4)[1], 0, 'on', 4), kp('MeadTasty', along2(2.8, 1.35)[0], 1.05, along2(2.8, 1.35)[1], 90, 'on', 5)],
  { angle: 90, first: ['tavern'], score: 8 }),
  // a wash corner: a water barrel in the corner, a tall jar and a basin beside it, a straw mat
  kit('BK-wash', 'corner', ['home', 'sleeping'], [
    kp('piece_chest_barrel', 0, 0, 0.71, 0, 'floor'), kp('piece_pot2', along1(1.1, 0.4)[0], 0, along1(1.1, 0.4)[1], 0, 'floor'),
    kp('piece_pot3', along2(1.1, 0.45)[0], 0, along2(1.1, 0.45)[1], 0, 'floor'), kp('rug_straw', 0, 0, 1.75, 45, 'floor')], { angle: 90 }),
  // a bath corner where the room is big enough: the tub with a mat and a jar
  kit('BK-bath', 'corner', ['home', 'sleeping'], [
    kp('piece_bathtub', 0, 0, 2.35, 45, 'floor'), kp('rug_straw', along1(2.9, 0.9)[0], 0, along1(2.9, 0.9)[1], 45, 'floor'), kp('piece_pot2', 0, 0, 0.6, 0, 'floor')],
  { angle: 90, decor: ['d3'], score: 2 }),
];
const FEAST = { Meadows: 'FeastMeadows', 'Black Forest': 'FeastBlackforest', Swamp: 'FeastSwamps', Mountain: 'FeastMountains', Plains: 'FeastPlains',
  Mistlands: 'FeastMistlands', Ashlands: 'FeastAshlands', 'Deep North': 'FeastMountains' };

// one fit with a fresh index, and why it failed (lab tuning)
function fitDebug(b, ctx, room, anc, a) {
  const idx = boxIndex(b.pieces), Ck = checksB();
  const fires = b.pieces.filter(p => p.decor && /^(hearth|fire_pit|fire_pit_iron)$/.test(p.name)).map(p => ({ p, b: Ck.aabb(p) }));
  WHY_B = 0; LAST_B = '';
  const got = fit(b, ctx, room, idx, ctx.zones || [], anc, a, false, fires);
  return { ok: !!got, why: WHY_B, piece: LAST_B, q: LASTQ_B };
}
const apiB = { why: () => WHY_B, _fitDebug: fitDebug, BUILT: BUILT_KITS, apply, library, setLibrary, lite, furnishRooms, anchorsOf, roomsB, fit, barCounter, canopyBed, stalls, dais, vignettes, CLASSES, SLOT, FOOD, BUILT_SLOTS, slotOf, isDecor, canDecor };
if (NODE_B) module.exports = apiB; else window.VHKitbash = apiB;
