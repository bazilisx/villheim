// Furniture built from building pieces, the way skilled players make what the furniture menu lacks: a bar counter
// of half walls topped with beams, barrels behind it and mugs on it (corpus taverns; the "50+ building tips"
// transcript: half walls, beams and 1 x 1 floors make counters and shelves). Runs after the furnishing, only where the
// floor is free, and keeps clear of doors, stairs and the fire.
const NODE_B = typeof module !== 'undefined';
const PB = NODE_B ? require('./pieces.js') : window.VHPieces;
const checksB = () => (NODE_B ? require('./checks.js') : window.VHChecks);
const personaB = () => (NODE_B ? require('./persona.js') : window.VHPersona);
const quatB = yaw => { const a = yaw * Math.PI / 360; return [0, +Math.sin(a).toFixed(6), 0, +Math.cos(a).toFixed(6)]; };
const BIOMES_B = ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains', 'Mistlands', 'Ashlands'];
// in reach of the village (D-080): its own biome for stations, one further for furniture and decor (lib/pieces.js)
const can = (biome, name) => PB.decorOk(name, biome);
// minor decor goes in any biome (D-066): it costs nothing or is paid in the village's own materials
// what a village makes: by the piece's materials and, for furniture, by the decorator's table too (the stricter)
const canMake = (biome, name) => {
  if (!can(biome, name)) return false;
  const F = NODE_B ? require('./decorate.js').FURNITURE : (window.VHDecorate && window.VHDecorate.FURNITURE) || {};
  // furniture one biome further than the village's, stations and fires none (D-080, as decorate.js)
  return !F[name] || BIOMES_B.indexOf(F[name].b) <= BIOMES_B.indexOf(biome) + (['craft', 'fire', 'storage'].includes(F[name].cat) ? 0 : 1);
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
      // a seat or table the furnishing left touching the new counter goes too
      const counter = b.pieces.slice(-8).filter(p => p.trim && p.decor).map(p => Ck.aabb(p));
      b.pieces = b.pieces.filter(p => !(movable(p) && !p.trim && (o => counter.some(k => o.x0 < k.x1 - 0.03 && o.x1 > k.x0 + 0.03 && o.z0 < k.z1 - 0.03 && o.z1 > k.z0 + 0.03 && o.y0 < k.y1 && o.y1 > k.y0 + 0.05))(Ck.aabb(p))));
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
    for (const [x, z] of standing) b.put(post, x, top + 1, z, 0, { ...T, ds: 3 });
    b.put(canopy, bed.x, top + 2.02, bed.z, bed.yaw || 0, { ...T, ds: 3 });
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
    // a piece goes up with the dais only when it stands wholly on it; one across its edge keeps the dais out
    const within = o => o.x0 > box.x0 - 0.15 && o.x1 < box.x1 + 0.15 && o.z0 > box.z0 - 0.15 && o.z1 < box.z1 + 0.15;
    // what already stands on a raised wall bench at the dais's height stays where it is
    const footOf = p => p.y - ((decorB().FURNITURE[p.name] || {}).base || 0);
    const raised = p => p.decor && Math.abs(footOf(p) - (room.y + 0.1 + lift)) < 0.08 && inBox(Ck.aabb(p));
    const goesUp = p => p.decor && !raised(p) && p.y < room.y + 0.6 && inBox(Ck.aabb(p)) && (PB.piece(p.name).role === 'rug' || within(Ck.aabb(p)));
    // nothing built in the way (a post, a stair, a doorway, the fire's ring), nothing tall that cannot go up
    const blocked = b.pieces.some(p => {
      const role = PB.piece(p.name).role, o = Ck.aabb(p);
      if (!inBox(o) || o.y1 < room.y + 0.15 || o.y0 > room.y + 2.2) return false;
      if (!p.decor && ['wall', 'window', 'beam', 'floor', 'roof', 'roofTop', 'gable', 'pole'].includes(role)) return false; // the platform goes round posts
      return (!goesUp(p) && !raised(p)) || ['fire', 'stair'].includes(role);
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
  let placed = 0;
  // which corner a household dresses, by its traits (lib/persona.js): a bench under a torch, storage, an armor stand
  const P = ctx.persona, RV = rngB(((P ? P.salt : 1) ^ 0x7167) >>> 0);
  const kw = {};
  if (can(ctx.biome, 'piece_walltorch')) kw.bench = P ? 0.5 + P.size * 0.12 + P.likes.lights * 0.2 : 1;
  if (can(ctx.biome, 'piece_chest_barrel')) kw.store = P ? 0.3 + P.clutter + P.busy * 0.5 : 1;
  if (can(ctx.biome, 'ArmorStand') && ['home', 'longhouse', 'tavern', 'temple'].includes(ctx.type)) kw.armor = P ? 0.15 + 0.9 * P.hobby.collect + 0.5 * P.wealth : 1;
  if (!Object.keys(kw).length) return 0;
  for (const room of (b.rooms || []).filter(r => !r.upper)) {
    const mine = edges.filter(e => e.cell[0] > room.x0 && e.cell[0] < room.x1 && e.cell[1] > room.z0 && e.cell[1] < room.z1);
    const budget = Math.floor(mine.length / 3 * (P ? 0.45 + 0.55 * P.clutter : 1));
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
      const kind = personaB().pickW(RV, kw), yaw = e.inYaw;
      const n0 = b.pieces.length;
      if (kind === 'bench') {
        const [x, z] = at(0.4); b.put('piece_bench01', x, top, z, yaw, T);
        const [tx, tz] = at(0.28); b.put('piece_walltorch', tx, top + 1.55, tz, (Math.atan2(nx, nz) * 180 / Math.PI + 270 + 360) % 360, { decor: true });
      } else if (kind === 'store') {
        const [x, z] = at(0.42, -0.45); b.put('piece_chest_wood', x, top, z, yaw, T);
        const [x2, z2] = at(0.4, 0.75); b.put('piece_chest_barrel', x2, top, z2, yaw, T);
      } else {
        const [x, z] = at(0.35); b.put('ArmorStand', x, top, z, yaw, T);
      }
      for (let i = n0; i < b.pieces.length; i++) b.pieces[i].ds = 3; // a d3 touch (D-071)
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
const meshB = () => (NODE_B ? require('./mesh.js') : window.VHMesh);
// an item (food, drink) rather than a piece: what the game drops when it is placed loose
function looseItem(name) {
  const Me = meshB();
  return !!Me && Me.source(name) === 'Items' && !/^(Pickable_|Placeable_|TreasureChest|loot_chest)/.test(name);
}
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
  // creative sets (lab/creative_sets.js) also carry their decor stages, household traits, least pieces, core pieces
  // and what their stands hold
  return { assemblies: d.assemblies.map(a => ({ id: a.id, anchor: a.anchor, angle: a.angle, of: a.of, rooms: a.rooms, score: a.score, once: a.once,
    decor: a.decor, traits: a.traits, min: a.min, creative: a.creative, from: a.from,
    clips: a.clips, pieces: a.pieces.map(m => { const o = { n: m.n, k: m.k, x: m.x, y: m.y, z: m.z, yaw: m.yaw, rest: m.rest }; if (m.on != null) o.on = m.on; if (m.sink) o.sink = m.sink; if (m.key) o.key = true; if (m.want) o.want = m.want; return o; }) })) };
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
// slots the fitter leaves out: seasonal pieces, goblin and ruin pieces, woodpiles (they go outside). Item stands go in:
// lib/persona.js puts an item on each by the household and the room (BLUEPRINT_LAB.md, "Items on stands").
const SKIP_N = /^(piece_xmas|piece_gift|piece_mistletoe|piece_jackoturnip|piece_(Celebration|Fairylight)Garland|goblin|Morkhalla|piece_asksvinskeleton|lox_ribs|piece_barber|piece_icecube|Skull|ancient_skull|wood_(fine_|core_)?stack|treasure_pile|treasure_stack|Pickable|TreasureChest|loot_chest|piece_chest_private|piece_chest_treasure)/;
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

// A small grid of boxes for the fitter: everything in the building, and what it adds as it goes. A piece is filed in
// every 2 m cell its reach from its pivot can touch (its solids, or its catalog size, by prefab); its box is worked out
// the first time a query comes near it (most of a building never is).
const REACH_B = new Map();
function reachOf(name) {
  if (REACH_B.has(name)) return REACH_B.get(name);
  const L = shapesB().local(name), sz = PB.piece(name).size;
  let r = Math.hypot(sz[0], sz[2]) / 2;
  if (L && L.length) for (const o of L) for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz2 of [-1, 1]) {
    const x = o.c[0] + sx * o.a[0][0] * o.h[0] + sy * o.a[1][0] * o.h[1] + sz2 * o.a[2][0] * o.h[2];
    const z = o.c[2] + sx * o.a[0][2] * o.h[0] + sy * o.a[1][2] * o.h[1] + sz2 * o.a[2][2] * o.h[2];
    r = Math.max(r, Math.hypot(x, z));
  }
  r += 0.3;
  REACH_B.set(name, r);
  return r;
}
function boxIndex(pieces) {
  const Ck = checksB(), cells = new Map(), all = [];
  const key = (i, j) => i * 65536 + j;
  const add = (p, b) => {
    const rec = { p, _b: b || null, cells: [] };
    Object.defineProperty(rec, 'b', { get() { if (!this._b) this._b = Ck.aabbShapes(decorB().asBuilt(this.p)); return this._b; } });
    all.push(rec);
    const r = reachOf(p.name);
    for (let i = Math.floor((p.x - r) / 2); i <= Math.floor((p.x + r) / 2); i++) for (let j = Math.floor((p.z - r) / 2); j <= Math.floor((p.z + r) / 2); j++) {
      const k = key(i, j);
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k).push(rec);
      rec.cells.push(k);
    }
    return rec;
  };
  for (const p of pieces) add(p);
  const audit = decorB().auditContext(pieces);
  // doors and stairs, few in a building, kept apart for the door and stair tests
  const passages = all.filter(r => ['door', 'stair'].includes(PB.piece(r.p.name).role) && (!r.p.decor || r.p.trim));
  let stamp = 0;
  const near = (b, pad = 0.2) => {
    const out = [];
    stamp++;
    for (let i = Math.floor((b.x0 - pad) / 2); i <= Math.floor((b.x1 + pad) / 2); i++) for (let j = Math.floor((b.z0 - pad) / 2); j <= Math.floor((b.z1 + pad) / 2); j++) for (const r of cells.get(key(i, j)) || []) {
      if (r.seen === stamp) continue;
      r.seen = stamp;
      const o = r.b;
      if (o.x0 <= b.x1 + pad && o.x1 >= b.x0 - pad && o.z0 <= b.z1 + pad && o.z1 >= b.z0 - pad) out.push(r);
    }
    return out;
  };
  const remove = p => {
    const k0 = all.findIndex(r => r.p === p);
    if (k0 < 0) return;
    const rec = all[k0];
    for (const k of rec.cells) { const l = cells.get(k); const i = l ? l.indexOf(rec) : -1; if (i >= 0) l.splice(i, 1); }
    all.splice(k0, 1);
    audit.remove(p);
  };
  return { add: (p, b) => { audit.add(p); const r = add(p, b); if (['door', 'stair'].includes(PB.piece(p.name).role) && (!p.decor || p.trim)) passages.push(r); return r; }, near, remove, all, audit, passages };
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
  // the free floor: points a metre apart with this room's floor 2.2 m all round, turned along the longest wall and across
  const long = faces.slice().sort((f, g) => g.len - f.len)[0];
  const along = long ? normB(Math.atan2(long.ux, long.uz) * 180 / Math.PI) : 0;
  for (const c of m.cells) {
    if (c.i % 2 || c.j % 2) continue;
    let clear = true;
    for (let k = 0; k < 8 && clear; k++) { const t = k * Math.PI / 4; if (!m.inside(c.x + 2.2 * Math.sin(t), c.z + 2.2 * Math.cos(t))) clear = false; }
    if (clear) for (const turn of [0, 90]) out.push({ anchor: 'floor', x: c.x, z: c.z, yaw: normB(along + turn) });
  }
  for (const p of b.pieces) {
    if (!p.decor && !/^(hearth|fire_pit|fire_pit_iron)$/.test(p.name)) {
      const info = PB.piece(p.name);
      // a free post: standing on this floor, away from every wall face
      if (info.role === 'pole' && Math.abs(p.y - 1 - m.stand) < 0.3 && m.inside(p.x + 0.4, p.z) + m.inside(p.x - 0.4, p.z) + m.inside(p.x, p.z + 0.4) + m.inside(p.x, p.z - 0.4) >= 4 &&
        !faces.some(f => Math.abs((p.x - f.px(0)) * f.nx + (p.z - f.pz(0)) * f.nz) < f.ht + 0.6 && (p.x * f.ux + p.z * f.uz) > f.a0 - 0.5 && (p.x * f.ux + p.z * f.uz) < f.a1 + 0.5))
        for (let k = 0; k < 4; k++) out.push({ anchor: 'post', x: p.x, z: p.z, yaw: k * 90, of: p });
      if (info.role === 'stair' && /stair/.test(p.name) && p.y > m.stand + 1.4 && p.y < m.stand + 3.2 && m.cells.some(c => Math.abs(c.x - p.x) < 1.4 && Math.abs(c.z - p.z) < 1.4)) out.push({ anchor: 'stair', x: p.x, z: p.z, yaw: normB(p.yaw || 0), of: p });
      continue;
    }
    if (!inRoom(p)) continue;
    const n = p.name;
    if (/^(hearth|fire_pit|fire_pit_iron)$/.test(n)) { const o = Ck.aabb(p); for (let k = 0; k < 4; k++) out.push({ anchor: 'hearth', x: (o.x0 + o.x1) / 2, z: (o.z0 + o.z1) / 2, yaw: normB((p.yaw || 0) + k * 90), of: p, akind: /hearth/.test(n) ? 'hearth' : 'pit' }); }
    else if (/^(piece_table|piece_table_round|piece_table_oak|piece_blackmarble_table|dvergrprops_table)$/.test(n)) out.push({ anchor: 'table', x: p.x, z: p.z, yaw: normB(p.yaw || 0), of: p, akind: /round/.test(n) ? 'round' : /oak|blackmarble/.test(n) ? 'long' : 'table' });
    else if (n === 'forge') out.push({ anchor: 'forge', x: p.x, z: p.z, yaw: normB(p.yaw || 0), of: p });
    else if (n === 'piece_workbench') out.push({ anchor: 'workbench', x: p.x, z: p.z, yaw: normB(p.yaw || 0), of: p });
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
  // under a flight the generator's keep-clear rectangle over the stair does not apply (the climb's own zone does)
  if (anc.anchor === 'stair') {
    const keeps = [];
    for (const r of b.rooms || []) for (const k of r.keep || []) keeps.push(k);
    zones = zones.filter(zn => !keeps.some(k => Math.abs(k.x0 - zn.x0) < 0.01 && Math.abs(k.x1 - zn.x1) < 0.01 && Math.abs(k.z0 - zn.z0) < 0.01 && Math.abs(k.z1 - zn.z1) < 0.01));
  }
  const Ck = checksB(), SH = shapesB(), m = room.m;
  const fy = anc.yaw * Math.PI / 180, c = Math.cos(fy), s = Math.sin(fy);
  const clipOf = (u, v) => { let d = 0; for (const cl of a.clips || []) if ((cl[0] === u && cl[1] === v) || (cl[0] === v && cl[1] === u)) d = Math.max(d, cl[2]); return d; };
  const order = a.pieces.map((p, i) => i).sort((i, j) => (a.pieces[i].rest === 'on' ? 1 : 0) - (a.pieces[j].rest === 'on' ? 1 : 0));
  const made = new Array(a.pieces.length).fill(null);
  // what the set moves out of its way: the decorator's extras for any set (the library comes first, the rule-based
  // extras only top up, lib/decorate.js extras), and for a built kit also the decorator's chests, seats and lights
  const displace = new Set();
  const needed = new Set(a.pieces.filter(p => p.rest === 'on').map(p => p.on));
  a.pieces.forEach((p, i) => { if (p.key) needed.add(i); });
  let dropped = 0, slide = 0;
  const picks = {};
  const kb = `${a.id}@${Math.round(anc.x * 10)},${Math.round(anc.z * 10)}`;
  // a set against a wall stands clear of the wall's own relief (the 2x2 wood wall's cross bars stand 13 cm proud of
  // its collider on one face): the whole set moves out by that much, so what hangs and what stands keep together
  // (what stands on the floor only: what hangs on the wall keeps its collider against the wall's, which holds it up in
  // the game, and goes back to the wall below)
  let push = 0;
  if (['wall', 'corner', 'window'].includes(anc.anchor) && anc.face && anc.face.proud && anc.t != null) {
    let lo = Infinity, hi = -Infinity, top = 0;
    for (const mm of a.pieces) {
      if (mm.rest === 'wall' || mm.rest === 'hang') continue;
      const lx = mirror ? -mm.x : mm.x;
      lo = Math.min(lo, lx - 0.4); hi = Math.max(hi, lx + 0.4); top = Math.max(top, mm.y + 1);
    }
    if (!isFinite(lo)) { lo = 0; hi = 0; top = 0; }
    // along the face, the set's local x runs the face's way or against it, so take the span both ways round
    const span = Math.max(Math.abs(lo), Math.abs(hi));
    push = anc.face.proud(anc.t - span, anc.t + span, m.stand + 0.05, m.stand + top);
    if (push < 0.015) push = 0; else if (push > 0.2) { WHY_B = 24; return null; } else push += 0.01;
  }
  // a quick look first: each piece's spot on this room's floor (or at its wall), out of the keep-clear boxes
  let miss = 0;
  for (let i = 0; i < a.pieces.length; i++) {
    const mm = a.pieces[i];
    let lx = mirror ? -mm.x : mm.x;
    if (a.byWidth && anc.w) lx = Math.sign(lx) * (anc.w / 2 + Math.abs(lx));
    const x = anc.x + lx * c + (mm.z + push) * s, z = anc.z - lx * s + (mm.z + push) * c, y = m.stand + mm.y;
    const out = (anc.anchor !== 'stair' && !m.nearWall(x, z, 0.5)) || (mm.k !== 'rug' && zones.some(zn => x > zn.x0 && x < zn.x1 && z > zn.z0 && z < zn.z1 && y + 0.3 > zn.y0 && y < zn.y1));
    if (out) { if (needed.has(i)) { WHY_B = 25; return null; } miss++; }
  }
  if (a.pieces.length - miss < Math.max(a.min || 2, Math.ceil(a.pieces.length * 0.6))) { WHY_B = 20; return null; }
  for (const i of order) {
    const mm = a.pieces[i];
    const fail = () => { if (needed.has(i)) return true; dropped++; return false; };
    // a random pick (banners) is made once per assembly, so a pair matches
    let name = mm.any ? (picks[mm.k] || (picks[mm.k] = fillSlot(mm, ctx.biome, ctx))) : fillSlot(mm, ctx.biome, ctx);
    // a creative set's piece the village does not make itself is left out: the last pass (generate.js biomeSafe) would
    // swap it for a stand-in of another size (a barrel of a stack turned into a chest)
    if (name && a.creative && !PB.minor(name) && PB.BIOME_ORDER.indexOf(PB.needs(name)) > PB.BIOME_ORDER.indexOf(ctx.biome)) name = null;
    if (!name || (mm.rest === 'on' && !made[mm.on])) { if (!name) WHY_B = 30; if (fail()) return null; continue; }
    let lx = mirror ? -mm.x : mm.x;
    if (a.byWidth && anc.w) lx = Math.sign(lx) * (anc.w / 2 + Math.abs(lx));
    const lz = mm.z + push, lyaw = mirror ? -mm.yaw : mm.yaw;
    const x = anc.x + lx * c + lz * s, z = anc.z - lx * s + lz * c, yaw = normB(anc.yaw + lyaw);
    const cell = m.cellAt(x, z);
    const stand = cell ? cell.st : m.stand;
    const p = { name, x: +x.toFixed(3), y: +(stand + Math.max(mm.y, -(mm.sink || 0))).toFixed(3), z: +z.toFixed(3), q: quatB(yaw), yaw, decor: true, kb, rest: mm.rest };
    if (mm.want) p.want = mm.want; // what an item stand should hold (lib/persona.js)
    // food and drink from a source build go on a flat item stand: an item set down loose is dropped in the game and
    // picked up by whoever walks past (T-626). What the stand holds is the household's pick of that kind
    // (lib/persona.js), so one set of mugs and a candle is ale in one house and mead or jam in the next.
    if (looseItem(name)) { p.name = 'itemstandh'; p.want = /^(Mead|BarleyWine|Tankard)/.test(name) ? 'drink' : 'food'; }
    if (BUILT_SLOTS.includes(mm.k)) p.trim = true;
    // a banner's cloth hangs 2.9 m under its rod, most of it with no collider: the rod goes where the cloth's foot
    // clears the floor by 10 cm (the corpus sets hung them at 2.35 m, the cloth 48 cm into the floor, T-606), and the
    // set is out when that puts the rod into the ceiling
    if (/^piece_banner\d+$/.test(p.name) && meshB()) {
      const V = meshB().aabbOf(meshB().world(p));
      if (V) {
        p.y = +(p.y + (stand + 0.1) - V.y0).toFixed(3);
        // the lowest roof, floor or beam over the rod (a sloped roof is lower at the wall than over the room's middle)
        const rodTop = p.y + (V.y1 - V.y0) - 2.9;
        let ceil = m.ceilAt(x, z);
        for (const q of b.pieces) {
          if (q.decor || Math.abs(q.x - x) > 3 || Math.abs(q.z - z) > 3 || !['roof', 'roofTop', 'roofCorner', 'floor', 'beam'].includes(PB.piece(q.name).role)) continue;
          for (const [dx, dz] of [[0, 0], [0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]]) {
            const u = SH.undersideAt(SH.world(q) || [], x + dx, z + dz, stand + 1);
            if (u != null && u < ceil) ceil = u;
          }
        }
        if (rodTop > ceil - 0.05) { WHY_B = 32; if (fail()) return null; continue; }
      }
    }
    // what hangs on the wall goes back to it: its solid back against the nearest wall face's collider (what holds it up
    // in the game), whatever depth the source build gave a piece of another size (a tool shelf stood 0.25 m off)
    if (mm.rest === 'wall' && m.faces) {
      const V = SH.world(p);
      if (V && V.length) {
        let best = null;
        for (const f of m.faces) {
          if (f.edge) continue;
          const t = p.x * f.ux + p.z * f.uz;
          if (t < f.a0 - 0.3 || t > f.a1 + 0.3) continue;
          let back = Infinity;
          for (const o of V) {
            const e = o.h[0] * Math.abs(o.a[0][0] * f.nx + o.a[0][2] * f.nz) + o.h[1] * Math.abs(o.a[1][0] * f.nx + o.a[1][2] * f.nz) + o.h[2] * Math.abs(o.a[2][0] * f.nx + o.a[2][2] * f.nz);
            back = Math.min(back, (o.c[0] - f.px(t)) * f.nx + (o.c[2] - f.pz(t)) * f.nz - e - f.ht);
          }
          if (back > -0.3 && back < 0.6 && (!best || Math.abs(back) < Math.abs(best.back))) best = { f, back };
        }
        if (best && Math.abs(best.back) > 0.02) { p.x = +(p.x - best.f.nx * best.back).toFixed(3); p.z = +(p.z - best.f.nz * best.back).toFixed(3); }
      }
    }
    let bx = Ck.aabbShapes(p);
    // set the piece on what it rests on, so a substitute of another height sits right
    const under = mm.rest === 'on' ? made[mm.on] : mm.rest === 'anchor' ? anc.of : null;
    if (under) {
      const top = SH.lidAt(under, (bx.x0 + bx.x1) / 2, (bx.z0 + bx.z1) / 2) ?? (SH.world(under) && SH.topAt(SH.world(under), (bx.x0 + bx.x1) / 2, (bx.z0 + bx.z1) / 2)) ?? Ck.aabbShapes(under).y1;
      p.y = +(p.y + top - bx.y0).toFixed(3); bx = Ck.aabbShapes(p);
      p.rest = 'on';
    } else if (mm.rest === 'floor') {
      if (!bx.pass) { p.y = +(p.y + (stand - (mm.sink || 0)) - bx.y0).toFixed(3); bx = Ck.aabbShapes(p); }
      else p.y = +(stand + 0.02).toFixed(3);
    }
    let okP = placeable(p, bx, mm, i, b, ctx, room, idx, zones, made, clipOf, anc, fires, displace, a);
    // a hung piece that meets the ceiling or the wall's own relief (the bars of a 2x2 wall) slides up or down the
    // wall, as the decorator's wall pieces do (building pieces stay where the set holds them up): the set's last slide first, so a pair stays level; never
    // under 0.9 m (what stands on it moves with it)
    if (!okP && mm.rest === 'wall' && [4, 13].includes(WHY_B) && !PB.piece(p.name).structural) {
      const y0 = p.y, top = bx.y1, why0 = WHY_B;
      const ceil = Math.min(...[[0, 0], [-0.3, 0], [0.3, 0]].map(([u, v]) => m.ceilAt(p.x + u * c + v * s, p.z - u * s + v * c)));
      const tries = [slide, why0 === 4 ? ceil - 0.1 - top : null, -0.1, 0.1, -0.2, 0.2, -0.3, 0.3, -0.4, 0.4].filter((d, k, l) => d != null && d !== 0 && l.indexOf(d) === k);
      for (const d of tries) {
        p.y = +(y0 + d).toFixed(3);
        bx = Ck.aabbShapes(p);
        if (bx.y0 < stand + 0.9 || bx.y1 > ceil - 0.08) continue;
        if (placeable(p, bx, mm, i, b, ctx, room, idx, zones, made, clipOf, anc, fires, displace, a)) { okP = true; slide = d; break; }
      }
      if (!okP) { p.y = y0; bx = Ck.aabbShapes(p); WHY_B = why0; }
    }
    if (!okP) { LAST_B = `${i} ${p.name}`; if (fail()) return null; continue; }
    if (p.rest === 'floor' && made.lvl != null && made.level == null) made.level = made.lvl;
    made[i] = p;
  }
  const got = made.filter(Boolean);
  if (got.length < (a.min || 2) || got.length < Math.ceil(a.pieces.length * 0.6) || got.every(p => p.trim)) { WHY_B = WHY_B || 21; return null; }
  // a dining set keeps 0.7 m clear round it, the way round a table
  // two of one thing is a pair of chairs, not a corner; only a store room takes those
  if (!a.built && room.role !== 'storage' && new Set(got.map(p => slotOf(p.name))).size < 2) { WHY_B = 26; return null; }
  if (a.anchor === 'floor') {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const p of got) { const o = Ck.aabbShapes(p); if (o.pass || PB.piece(p.name).role === 'rug') continue; x0 = Math.min(x0, o.x0); x1 = Math.max(x1, o.x1); z0 = Math.min(z0, o.z0); z1 = Math.max(z1, o.z1); }
    const g = { x0: x0 - 0.7, x1: x1 + 0.7, z0: z0 - 0.7, z1: z1 + 0.7 };
    // its whole footprint 0.6 m inside the room's walls
    for (const [x, z] of [[x0 - 0.6, z0 - 0.6], [x1 + 0.6, z0 - 0.6], [x0 - 0.6, z1 + 0.6], [x1 + 0.6, z1 + 0.6], [(x0 + x1) / 2, z0 - 0.6], [(x0 + x1) / 2, z1 + 0.6], [x0 - 0.6, (z0 + z1) / 2], [x1 + 0.6, (z0 + z1) / 2]])
      if (!m.inside(x, z)) { WHY_B = 27; return null; }
    // and clear of where a stair or ladder lands on this floor
    for (const r of idx.passages) {
      if (r.b.info.role !== 'stair') continue;
      const top = r.b.y1;
      if (Math.abs(top - m.stand) > 0.6) continue;
      if (r.b.x0 - 1.8 < x1 && r.b.x1 + 1.8 > x0 && r.b.z0 - 1.8 < z1 && r.b.z1 + 1.8 > z0) { WHY_B = 28; return null; }
    }
    for (const r of idx.near(g, 0)) {
      if (!r.p.decor || got.includes(r.p) || (displace && displace.has(r.p)) || r.b.pass || PB.piece(r.p.name).role === 'rug') continue;
      if (r.b.y0 > m.stand + 1.8 || r.b.y1 < m.stand + 0.1) continue;
      if (!(r.b.x0 < g.x1 && r.b.x1 > g.x0 && r.b.z0 < g.z1 && r.b.z1 > g.z0)) continue;
      // the decorator's tables and seats round it make way too; anything else keeps the set out
      const role = PB.piece(r.p.name).role;
      if (!r.p.kb && !r.p.trim && r.p !== anc.of && (r.p.extra || (a.built && ['table', 'seat', 'storage', 'light', 'deco'].includes(role) && !/cartography|workbench|butcher|preptable|magetable|throne/.test(r.p.name)))) { displace.add(r.p); continue; }
      WHY_B = 29; return null;
    }
  }
  let moved = 0, extras = 0;
  for (const q of displace) if (q.extra) extras++; else moved++;
  if (moved > (a.dining ? 14 : 2) || extras > (a.dining ? 14 : 6)) { WHY_B = 23; return null; }
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
        if (!m.inside(x, z)) { WHY_B = 22; return null; }
      }
    }
  }
  got.displace = displace ? [...displace] : [];
  return got;
}

// The tests for one piece.
// why the last piece was turned down (for lab/bench.js and tuning)
let WHY_B = 0, LAST_B = '', LASTQ_B = '', STATS_B = null;
const no = k => { WHY_B = k; return false; };
const MOVABLE = ['storage', 'seat', 'deco', 'clutter', 'light'];
function placeable(p, bx, mm, i, b, ctx, room, idx, zones, made, clipOf, anc, fires, displace, a) {
  const Ck = checksB(), SH = shapesB(), D = decorB(), m = room.m;
  const cx = (bx.x0 + bx.x1) / 2, cz = (bx.z0 + bx.z1) / 2;
  const info = PB.piece(p.name);
  const flat = info.role === 'rug';
  // on this room's floor, or against its wall
  const pts = [[cx, cz], [bx.x0 + 0.05, bx.z0 + 0.05], [bx.x1 - 0.05, bx.z0 + 0.05], [bx.x0 + 0.05, bx.z1 - 0.05], [bx.x1 - 0.05, bx.z1 - 0.05]];
  if (anc.anchor === 'stair') {
    // under a flight the room's cells are blocked: a floor of this level under each corner instead
    if (!pts.every(([x, z]) => idx.near({ x0: x, x1: x, z0: z, z1: z }, 0).some(r => !r.p.decor && r.b.info.role === 'floor' && r.b.x0 < x && r.b.x1 > x && r.b.z0 < z && r.b.z1 > z && Math.abs(r.b.y1 - m.stand) < 0.2))) return no(1);
    // and under the flight's own underside
    if (bx.y1 > anc.of.y - 0.55) return no(2);
  } else {
  if (!m.inside(cx, cz) && !(p.rest === 'wall' && m.nearWall(cx, cz, 0.5))) return no(1);
  if (!pts.every(([x, z]) => m.nearWall(x, z, 0.5))) return no(2);
  }
  // a floor piece stands on this level's floor all round
  // (or wholly on one raised section, the benches that line the walls of Norse homes: a set stands on its own level,
  // all its floor pieces on the same one)
  if (p.rest === 'floor' && !flat && anc.anchor !== 'stair') {
    const c0 = m.cellAt(cx, cz), lv = c0 ? c0.st : m.stand;
    if (!pts.slice(1).every(([x, z]) => { const c = m.cellAt(x, z); return !c || Math.abs(c.st - lv) < 0.06; })) return no(3);
    if (made.level != null && Math.abs(made.level - lv) > 0.06) return no(3);
    made.lvl = lv;
  }
  // under the ceiling, and no deeper in the floor than its source
  if (bx.y1 > m.ceilAt(cx, cz) - 0.08) { if (STATS_B) { const H = STATS_B.ceil || (STATS_B.ceil = []); H.push({ n: p.name, top: +(bx.y1 - m.stand).toFixed(2), ceil: +(m.ceilAt(cx, cz) - m.stand).toFixed(2), li: room.li, a: anc.anchor, id: a.id, type: ctx.type, role: room.role }); } return no(4); }
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
  for (const r of idx.passages) {
    if (Math.abs(r.p.x - cx) > 4 || Math.abs(r.p.z - cz) > 4) continue;
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
    // a curtain rod (a built beam over the window's head) passes
    const rod = p.trim && bx.y0 > m.stand + 2.15 && !st.ks.has('open') && !st.ks.has('none');
    if (st.ks.has('window') && bx.y1 > m.stand + st.top + 0.15 && !flat && !rod) return no(11);
    if (p.rest === 'wall' && dist < 0.5 && !rod && (st.ks.has('window') || st.ks.has('open') || st.ks.has('none'))) return no(12);
  }
  // plain wall behind a wall piece, structure over a hung one
  if (p.rest === 'wall' && !m.faces.some(f => !f.edge && Math.abs((cx - f.px(0)) * f.nx + (cz - f.pz(0)) * f.nz - f.ht) < 0.6 &&
    (cx * f.ux + cz * f.uz) > f.a0 && (cx * f.ux + cz * f.uz) < f.a1)) return no(14);
  if (p.rest === 'hang' && !idx.near(bx).some(r => !r.p.decor && r.b.info.structural && r.b.x0 < cx && r.b.x1 > cx && r.b.z0 < cz && r.b.z1 > cz && r.b.y0 > bx.y1 - 0.3 && r.b.y0 < bx.y1 + 0.5)) return no(15);
  // a building piece of a set (a beam shelf, a half-wall counter) touches the structure that holds it, as the checks'
  // stability test sees it (a beam shelf hung off a stone wall's box fell there, 2026-11-10)
  if (info.structural) {
    const tch = o => o.x0 <= bx.x1 + 0.02 && bx.x0 <= o.x1 + 0.02 && o.y0 <= bx.y1 + 0.02 && bx.y0 <= o.y1 + 0.02 && o.z0 <= bx.z1 + 0.02 && bx.z0 <= o.z1 + 0.02;
    if (!idx.near(bx, 0.05).some(r => r.p !== p && (!r.p.decor || r.p.trim) && r.b.info.structural && tch(r.b)) &&
      !made.some(o => o && PB.piece(o.name).structural && tch(Ck.aabbShapes(o)))) return no(15);
  }
  // clips: into the wall and the anchor no deeper than the source, into anything else not at all
  // never the same piece twice in one place (a rug laid on the decorator's own rug)
  if (idx.near(bx, 0.1).some(r => r.p.name === p.name && Math.abs(r.p.x - p.x) < 0.1 && Math.abs(r.p.y - p.y) < 0.1 && Math.abs(r.p.z - p.z) < 0.1)) return no(19);
  // small things with no solids (food, candles) keep apart from each other
  if (bx.pass && !flat && idx.near(bx).concat(made.filter(Boolean).map(o => ({ p: o, b: Ck.aabbShapes(o) }))).some(r => r.p !== p && r.b.pass && PB.piece(r.p.name).role !== 'rug' &&
    Math.hypot(r.p.x - p.x, r.p.z - p.z) < 0.22 && Math.abs(r.p.y - p.y) < 0.3)) return no(16);
  if (bx.y0 < m.stand - 0.02 && p.rest === 'floor') p.sink = +(m.stand - bx.y0 + 0.005).toFixed(3);
  // any set moves the decorator's extras out of its way; a built kit also its chests, seats and lights (as the bar
  // counter does), a dining set its tables. Kept aside until the piece passes, so a piece left out moves nothing.
  const movable = q => q.decor && !q.kb && !q.trim && q !== anc.of && !/^(bed|piece_bed02|ashwood_bed)$/.test(q.name) &&
    (q.extra || (a.built && (MOVABLE.includes(PB.piece(q.name).role) || (a.dining && PB.piece(q.name).role === 'table' && !/cartography|workbench|butcher|preptable/.test(q.name)))));
  // out of the furniture boxes as the pool audit measures them (furnClip): the decorator's extras move aside, anything
  // else keeps the piece out
  // (two of the set's own pieces, each its source's prefab, stand as their source builds stood them: a chair pushed
  // under its table; marked so the pool audit lets that depth pass, D-098)
  const mine = [], ownP = !mm.n || mm.n === p.name;
  let fdeep = 0;
  for (const [q, deep] of D.furnClash(p, idx.near(bx, 0.3).map(r => r.p).filter(q => q.decor && !displace.has(q)).concat(made.filter(Boolean)))) {
    const j = made.indexOf(q);
    if (j >= 0 && ownP && (!a.pieces[j].n || a.pieces[j].n === q.name)) { fdeep = Math.max(fdeep, deep); continue; }
    if (movable(q)) { mine.push(q); continue; }
    return no(31);
  }
  if (fdeep) p.fclip = +(fdeep + 0.005).toFixed(3); else delete p.fclip;
  // the audit's own tests (what it rests on is there, plain wall behind, out of what shows of the walls) come last,
  // as the dearest
  const audited = () => {
    // a set's own piece may go into what shows of the walls as deep as its source builds put it (D-098: clips made on
    // purpose); a piece put in its place gets nothing
    if (decorB().auditOne(p, idx.audit, made.filter(Boolean), ownP ? clipOf(i, 'w') : 0)) return true;
    if (STATS_B) { const H = STATS_B.audit || (STATS_B.audit = {}); const k = decorB().oneWhy() + ' ' + p.name; H[k] = (H[k] || 0) + 1; }
    return no(13);
  };
  if (flat || bx.pass || !bx.sol || !bx.sol.length) { if (!audited()) return false; for (const q of mine) displace.add(q); return true; }
  let deepest = 0;
  for (const r of idx.near(bx)) {
    const q = r.p, qb = r.b;
    if (!qb.sol || !qb.sol.length || qb.pass || q === p) continue;
    if (qb.x0 >= bx.x1 || qb.x1 <= bx.x0 || qb.z0 >= bx.z1 || qb.z1 <= bx.z0 || qb.y0 >= bx.y1 || qb.y1 <= bx.y0) continue;
    const role = qb.info.role;
    if (!q.decor && ['floor', 'roof', 'roofTop', 'roofCorner'].includes(role)) continue; // floors (sinking is tested above) and roofs over it
    if (role === 'rug') continue; // rugs lie under everything
    if (anc.anchor === 'stair' && role === 'stair' && qb.y0 >= bx.y1 - 0.05) continue;
    const d = SH.clipDepth(bx.sol, qb.sol);
    if (d <= 0.01) continue;
    if (movable(q)) { mine.push(q); continue; }
    let allow = 0;
    if (!q.decor && ['wall', 'window', 'gable', 'beam', 'pole'].includes(role)) allow = clipOf(i, 'w');
    if (anc.of && q === anc.of) allow = Math.max(allow, clipOf(i, 'a'));
    if (d > allow + 0.01) { LASTQ_B = `${q.name}${q.decor ? '*' : ''} ${d.toFixed(2)}`; if (STATS_B) { const H = STATS_B.clip || (STATS_B.clip = {}); const k = `${q.decor ? (q.kb ? (/^KB-/.test(q.kb) ? 'mined' : 'kit') : 'decorator') : 'building'} ${PB.piece(q.name).role}`; H[k] = (H[k] || 0) + 1; } return no(17); }
    deepest = Math.max(deepest, d);
  }
  made.forEach((o, j) => {
    if (!o || deepest < 0) return;
    const ob2 = Ck.aabbShapes(o);
    if (!ob2.sol || !ob2.sol.length) return;
    const d = SH.clipDepth(bx.sol, ob2.sol);
    if (d <= 0.01) return;
    // the source build's own clip holds only for its own pieces: a piece put in its place (a 6.45 m oak table for a
    // 2.45 m table) gets no more than 2 cm (a torch went 0.59 m into the oak table)
    const own = name => (a.pieces[i].n === name || !a.pieces[i].n);
    const allowIJ = own(p.name) && (!a.pieces[j].n || a.pieces[j].n === o.name) ? clipOf(i, j) : 0;
    if (d > Math.max(allowIJ, 0.02) + 0.01) deepest = -1;
    else deepest = Math.max(deepest, d);
  });
  if (deepest < 0) return no(18);
  if (!audited()) return false;
  if (deepest > 0.01) p.clip = +(deepest + 0.005).toFixed(3);
  for (const q of mine) displace.add(q);
  return true;
}

// What a set mostly is, for the room's layout plan (lib/layout.js zones): storage, a bench, a work station, a table.
function setKind(a) {
  if (a._kind !== undefined) return a._kind;
  const n = { storage: 0, bench: 0, station: 0, table: 0 };
  for (const m of a.pieces) {
    if (['chest', 'barrel', 'crate'].includes(m.k)) n.storage++;
    else if (m.k === 'bench') n.bench++;
    else if (/^(piece_workbench|forge|piece_artisanstation|piece_stonecutter|piece_cauldron|piece_spinningwheel|blackforge|piece_magetable)/.test(m.n || '')) n.station += 2;
    else if (/table/.test(m.n || '')) n.table++;
  }
  const best = Object.entries(n).sort((x, y) => y[1] - x[1])[0];
  a._kind = best[1] ? best[0] : null;
  return a._kind;
}

// How many assemblies a room takes at each decor stage: few at d1, a lived-in room at d3. Floor kept free: at least
// 55 % of the room.
function budget(decor, area) {
  if (decor === 'd1') return area >= 30 ? 1 : 0;
  if (decor === 'd2') return Math.max(1, Math.min(3, Math.round(area / 22)));
  return Math.max(2, Math.min(8, Math.round(area / 12)));
}

// What a household keeps under its stairs (lib/persona.js underStair): one choice per building, from the household's
// own stream; 'none' leaves the space open.
const UNDER = { chest: 'BK-understair', barrels: 'BK-understair2', crates: 'BK-understair3', stacked: 'BK-understair4' };
function underChoice(P) {
  if (!P) return 'chest';
  return personaB().pickW(rngB((P.salt ^ 0x5717) >>> 0), personaB().underStair(P));
}

function furnishRooms(b, ctx, zones, R2, extra, rooms) {
  const Ck = checksB();
  const P = ctx.persona, PS = personaB();
  const under = underChoice(P);
  const lib = library().assemblies.concat(extra || []).filter(a => !/^BK-understair/.test(a.id) || a.id === UNDER[under]);
  const idx = boxIndex(b.pieces);
  let placed = 0;
  const used = {};
  for (const room of rooms || roomsB(b, ctx)) {
    const kinds = ROOM_KINDS[room.role] || [room.role];
    if (!kinds.length) continue;
    const anchors = anchorsOf(room, b);
    if (!anchors.length) continue;
    const fires = b.pieces.filter(p => p.decor && /^(hearth|fire_pit|fire_pit_iron)$/.test(p.name)).map(p => ({ p, b: Ck.aabb(p) }));
    // candidates: assemblies for this room's kind that some anchor here takes, weighted by score and how well the
    // room kind fits; a building's own anchor first (the forge corner, the bed corner, the serving corner)
    // each built kit once in a building (shelves, cabinets and drapes twice), each mined assembly twice
    // each built kit once in a building (shelves, cabinets, drapes, bedsides, alcoves twice), each mined assembly
    // twice; dining sets one to a room, a grid of them in a tavern's or a hall's main room (one per 25 m2)
    const many = ['BK-shelf', 'BK-cabinet', 'BK-drapes', 'BK-bedside', 'BK-bedside2', 'BK-alcove', 'BK-alcove2', 'BK-understair', 'BK-understair2'];
    let sets = ['tavern', 'hall', 'temple'].includes(room.role) ? Math.max(1, Math.min(6, Math.floor(room.m.area / 16)))
      : ['smithy', 'workshop'].includes(room.role) ? Math.max(1, Math.min(3, Math.floor(room.m.area / 24))) : 1;
    // the room's layout plan (lib/layout.js): how many sets its scheme takes, and where the floor spots rank
    const Lay = NODE_B ? require('./layout.js') : window.VHLayout;
    const plan = Lay ? Lay.planFor(b, room.m) : null;
    if (plan && plan.sets != null) sets = Math.max(1, Math.min(sets, plan.sets));
    let setsHere = 0;
    const cap = a => (a.dining ? (setsHere < sets ? 9 : 0) : a.built ? (many.includes(a.id) ? 2 : 1) : 2);
    const cands = lib.filter(a => (used[a.id] || 0) < cap(a) && (a.rooms || []).some(k => kinds.includes(k) || k === 'any') && anchors.some(an => takes(an, a)) &&
      (!a.types || a.types.includes(ctx.type)) && (!a.roles || a.roles.includes(room.role)) && (!a.decor || a.decor.includes(ctx.decor)) &&
      // a creative set only where the village makes its core pieces itself (the rest are left out where it does not,
      // in fit: the last pass, generate.js biomeSafe, would swap them for stand-ins of another size)
      (!a.creative || PB.BIOME_ORDER.indexOf(a.from) <= PB.BIOME_ORDER.indexOf(ctx.biome)))
      .map(a => {
        // more kinds of piece weigh more; a pair of chests is common in the corpus and dull in every room
        const ks = new Set(a.pieces.map(p => p.k).filter(k => !BUILT_SLOTS.includes(k)));
        const store = [...ks].every(k => ['chest', 'barrel', 'crate', 'sign'].includes(k));
        const w = Math.log(1 + a.score) * (kinds.includes((a.rooms || [])[0]) ? 1.5 : 1) * (a.built ? 2.5 : 1) * (1 + 0.35 * (ks.size - 1)) * (store && room.role !== 'storage' ? 0.3 : 1)
          * Math.pow(PS.kitWeight(P, a), 2); // the household's taste, squared so it shows (six households in one house
          // came out with the same rooms, lab/test_variance.js)
        return { a, w, sig: [...ks].sort().join(',') };
      });
    if (!cands.length) continue;
    let want = Math.round(budget(ctx.decor, room.m.area) * (ctx.decor === 'd1' ? 1 : PS.kitBudget(P))) + (ctx.decor === 'd1' ? 0 : sets);
    // past the d2 budget, assemblies wait for the third stage (D-071)
    const want2 = ctx.decor === 'd3' ? Math.round(budget('d2', room.m.area) * PS.kitBudget(P)) : Infinity;
    let plain = 0;
    const floorArea = room.m.area;
    let footprint = 0;
    for (const r of idx.all) if (r.p.decor && room.m.inside(r.p.x, r.p.z) && !r.b.pass && r.b.y0 < room.m.stand + 0.3 && r.b.y1 > room.m.stand + 0.2 && room.m.inside((r.b.x0 + r.b.x1) / 2, (r.b.z0 + r.b.z1) / 2)) footprint += (r.b.x1 - r.b.x0) * (r.b.z1 - r.b.z0);
    // a building's own kits first, and what the household keeps under the stairs where a room has a stair
    const firsts = cands.filter(x => (x.a.first && x.a.first.includes(ctx.type)) || (x.a.id === UNDER[under] && anchors.some(an => an.anchor === 'stair')));
    // the story spot (lib/layout.js): the wall in view from the door goes to what the household cares about most, from
    // d2 on, in the rooms people live in (a crafter's half-done project, a collector's trophies, pots and herbs, a
    // kitchen, a couch by the fire)
    const storyIds = ctx.decor !== 'd1' && ['home', 'sleeping', 'kitchen'].includes(room.role) && ctx.type === 'home' && PS.storyKits ? PS.storyKits(P) : [];
    const story = storyIds.map(id => cands.find(x => x.a.id === id)).filter(Boolean).map(x => ({ ...x, story: true })).slice(0, 2);
    // a dining set first in every room that takes one (from d2), drawn by weight
    const dining = cands.filter(x => x.a.dining);
    let diningTries = ctx.decor === 'd1' ? 0 : sets * 2 + 1;
    let tries = 0;
    const takenAnchors = [];
    let misses = 0;
    while ((want > 0 || story.length) && tries < 40 && misses < 12) {
      tries++;
      let pick;
      if (firsts.length) pick = firsts.shift();
      else if (story.length) pick = story.shift();
      else if (diningTries > 0 && setsHere < sets && dining.length) {
        diningTries--;
        let tot = 0;
        for (const x of dining) tot += x.w;
        let r = R2() * tot;
        pick = dining[dining.length - 1];
        for (const x of dining) { r -= x.w; if (r <= 0) { pick = x; break; } }
      } else {
        let tot = 0;
        const wt = x => x.w / (1 + 2 * (used[x.a.id] || 0)) / (1 + 3 * (used[x.sig] || 0));
        for (const x of cands) tot += wt(x);
        let r = R2() * tot;
        pick = cands[cands.length - 1];
        for (const x of cands) { r -= wt(x); if (r <= 0) { pick = x; break; } }
      }
      const a = pick.a;
      if ((used[a.id] || 0) >= cap(a)) { cands.splice(cands.indexOf(pick), 1); if (!cands.length) break; continue; }
      // a free-floor spot with something fixed on it (a bed, a station, the fire, built furniture, another set) is passed by
      const fixed = an => idx.near({ x0: an.x - 1.2, x1: an.x + 1.2, z0: an.z - 1.2, z1: an.z + 1.2 }, 0).some(r => r.p.decor && !r.b.pass &&
        r.b.y0 < room.m.stand + 1.5 && r.b.y1 > room.m.stand + 0.1 && !r.p.extra && (r.p.kb || r.p.trim || !['storage', 'seat', 'deco', 'clutter', 'light', 'table', 'rug'].includes(PB.piece(r.p.name).role)));
      const ancs = anchors.filter(an => takes(an, a) && !takenAnchors.some(t => Math.hypot(t.x - an.x, t.z - an.z) < 1.2 && t.anchor === an.anchor) && (an.anchor !== 'floor' || !fixed(an)));
      // shuffled from the room's own stream; free-floor spots ranked by the layout plan, with the stream's noise
      for (let k = ancs.length - 1; k > 0; k--) { const j = Math.floor(R2() * (k + 1)); const t = ancs[k]; ancs[k] = ancs[j]; ancs[j] = t; }
      if (pick.story && plan && plan.story) { const st = plan.story; ancs.sort((p, q) => Math.hypot(p.x - st.x, p.z - st.z) - Math.hypot(q.x - st.x, q.z - st.z)); }
      if (plan && a.anchor === 'floor') {
        const sc = new Map(ancs.map(an => [an, Lay.floorScore(plan, an, a, b) + R2() * 1.2]));
        ancs.sort((p, q) => sc.get(q) - sc.get(p));
      } else if (plan && !pick.story && ['wall', 'corner', 'window'].includes(a.anchor) && setKind(a)) {
        // the zone the room's scheme keeps for what the set mostly is (storage by the door or in the corners, a bench
        // along the long wall, a work set where the light is), with the stream's noise
        const kind = setKind(a);
        const sc = new Map(ancs.map(an => [an, plan.bias(kind, { x: an.x, z: an.z, face: an.face || (an.faces && an.faces[0]), t: an.t, corner: an.anchor === 'corner', win: an.anchor === 'window', yaw: an.yaw }) + R2() * 1.5]));
        ancs.sort((p, q) => sc.get(q) - sc.get(p));
      }
      let done = false, lastWhy = ancs.length ? 0 : 'anchor';
      for (const an of ancs.slice(0, a.anchor === 'floor' ? 16 : 10)) {
        for (const mir of a.anchor === 'floor' ? [false] : R2() < 0.5 ? [false, true] : [true, false]) {
          WHY_B = 0;
          const got = fit(b, ctx, room, idx, zones, an, a, mir, fires);
          if (!got) { lastWhy = WHY_B || 0; continue; }
          // floor kept free
          const add = got.reduce((sum, p) => { const o = Ck.aabbShapes(p); return sum + (!o.pass && p.rest === 'floor' && PB.piece(p.name).role !== 'rug' ? (o.x1 - o.x0) * (o.z1 - o.z0) : 0); }, 0);
          // what the set moves out of the way frees its floor
          const freed = got.displace.reduce((sum, q) => { const o = Ck.aabbShapes(q); return sum + (!o.pass && o.y0 < room.m.stand + 0.3 && PB.piece(q.name).role !== 'rug' ? (o.x1 - o.x0) * (o.z1 - o.z0) : 0); }, 0);
          if (footprint + add - freed > floorArea * 0.5) { lastWhy = 'area'; continue; }
          footprint += add - freed;
          // what the kit moved goes, with whatever stood on it
          if (got.displace.length) {
            const out = new Set(got.displace);
            for (const q of b.pieces) if (q.decor && !q.kb && !out.has(q) && got.displace.some(o => { const ob = Ck.aabbShapes(o); return q.x > ob.x0 && q.x < ob.x1 && q.z > ob.z0 && q.z < ob.z1 && q.y > o.y + 0.2 && q.y < o.y + 1.6; })) out.add(q);
            b.pieces = b.pieces.filter(q => !out.has(q));
            for (const q of out) idx.remove(q);
          }
          const ds = a.decor && !a.decor.includes('d2') ? 3 : a.dining || (a.first && a.first.includes(ctx.type)) || a.id === UNDER[under] || plain++ < want2 ? 2 : 3;
          for (const p of got) { p.ds = ds; b.pieces.push(p); idx.add(p); }
          takenAnchors.push(an);
          used[a.id] = (used[a.id] || 0) + 1;
          used[pick.sig] = (used[pick.sig] || 0) + 1;
          if (a.dining) { setsHere++; if (plan) Lay.noteSet(plan, an); }
          placed++; want--; done = true; misses = 0;
          break;
        }
        if (done) break;
      }
      if (!done) misses++;
      // lab/richness.js: what was placed and why the rest was turned down
      if (STATS_B) {
        const kind = /^KB-/.test(a.id) ? 'mined' : /^KC-/.test(a.id) ? 'creative' : 'built';
        const S = STATS_B[kind] || (STATS_B[kind] = { placed: 0, refused: 0, why: {}, ids: {} });
        if (done) { S.placed++; S.ids[a.id] = (S.ids[a.id] || 0) + 1; } else { S.refused++; S.why[lastWhy] = (S.why[lastWhy] || 0) + 1; }
      }
    }
    if (ctx.decor !== 'd1') placed += dressWalls(b, ctx, room, idx, zones, anchors, fires, R2, used);
    residentSlots(b, ctx, room, idx, zones, anchors, fires);
  }
  return placed;
}

// Places a resident's own things could go, left empty (Tyler, 2026-11-09, D-074): the villager who lives in a house is
// chosen in the game and can change, and when that villager decorates the mod adds one or two touches from their role
// as a role display (ROLE_DISPLAYS below) fitted to one of these spots. In each home, sleeping, guest, hall and kitchen
// room: wall bays by the bed, by the hearth and by the way in, a shelf spot, and table tops. Each wall spot is tested as
// a wall item stand would be and carries its free space: the plain wall either side at 1.0 to 2.4 m (width), the clear
// floor in front of it (depth), the clear height. A table spot carries the free part of the top. They go to
// design.slots; nothing is placed there.
let SLOT_KITS = null;
const slotKits = () => SLOT_KITS || (SLOT_KITS = { wall: kit('BK-slot', 'wall', [], [kp('itemstand', 0, 1.6, 0.045, 0, 'wall')], { min: 1 }) });
function residentSlots(b, ctx, room, idx, zones, anchors, fires) {
  if (!['home', 'sleeping', 'guest', 'hall', 'kitchen'].includes(room.role)) return 0;
  const m = room.m, Ck = checksB(), walls = anchors.filter(a => a.anchor === 'wall');
  const inRoom = r => m.inside(r.p.x, r.p.z) && Math.abs(r.p.y - m.stand) < 1.2;
  const beds = idx.all.filter(r => r.p.decor && /^(bed|piece_bed02|ashwood_bed)$/.test(r.p.name) && inRoom(r)).map(r => r.p);
  const hearths = idx.all.filter(r => r.p.decor && /^(hearth|fire_pit|fire_pit_iron)$/.test(r.p.name) && inRoom(r)).map(r => r.p);
  const doors = (m.doors || []).filter(d => !d.open);
  const out = b.slots = b.slots || [];
  const taken = out.filter(sl => Math.abs(sl.y - m.stand) < 3);
  // something in a box (decor, or structure other than this wall and the floor)
  const busy = (bx, wallAn) => idx.near(bx, 0).some(r => {
    const role = PB.piece(r.p.name).role;
    if (role === 'rug' || (!r.p.decor && role === 'floor')) return false;
    if (!r.p.decor && wallAn && ['wall', 'beam', 'pole'].includes(role) && Math.abs((r.p.x - wallAn.x) * wallAn.face.nx + (r.p.z - wallAn.z) * wallAn.face.nz) < 0.35) return false;
    return r.b.x0 < bx.x1 && r.b.x1 > bx.x0 && r.b.z0 < bx.z1 && r.b.z1 > bx.z0 && r.b.y0 < bx.y1 && r.b.y1 > bx.y0;
  });
  const freeAt = an => {
    const f = an.face, probe = (t, d0, d1, y0, y1) => { const x = an.x + f.ux * t, z = an.z + f.uz * t, xa = x + f.nx * d0, za = z + f.nz * d0, xb = x + f.nx * d1, zb = z + f.nz * d1;
      return { x0: Math.min(xa, xb) - 0.12, x1: Math.max(xa, xb) + 0.12, z0: Math.min(za, zb) - 0.12, z1: Math.max(za, zb) + 0.12, y0: m.stand + y0, y1: m.stand + y1 }; };
    const onWall = t => walls.some(w => w.face === f && Math.abs(w.t - (an.t + t)) < 0.26);
    let w = 0.25;
    for (const sg of [-1, 1]) for (let d = 0.25; d <= 1.5 + 0.01; d += 0.25) { if (!onWall(sg * d) || busy(probe(sg * d, 0.05, 0.45, 1.0, 2.4), an)) break; w += 0.25; }
    let depth = 0;
    for (let d = 0.3; d <= 1.5 + 0.01; d += 0.3) { if (!m.inside(an.x + f.nx * d, an.z + f.nz * d) || busy(probe(0, Math.max(0.12, d - 0.3), d, 0.15, 1.8), an)) break; depth = d; }
    return { width: +w.toFixed(2), depth: +depth.toFixed(2), height: +Math.min(2.4, m.ceilAt(an.x + f.nx * 0.3, an.z + f.nz * 0.3) - m.stand - 0.1).toFixed(2) };
  };
  const near = (list, a) => (list.length ? Math.min(...list.map(q => Math.hypot(q.x - a.x, q.z - a.z))) : 99);
  const kinds = [['bed', a => near(beds, a), d => d < 2.4], ['hearth', a => near(hearths, a), d => d < 3.5],
    ['door', a => (doors.length ? Math.min(...doors.map(q => Math.abs(Math.hypot(q.x - a.x, q.z - a.z) - 1.8))) : 99), d => d < 1.2],
    ['shelf', a => -Math.min(4, ...taken.map(t => Math.hypot(t.x - a.x, t.z - a.z)), 4), () => true]];
  let n = 0;
  for (const [kind, score, okD] of kinds) {
    const list = walls.map(a => ({ a, d: score(a) })).filter(x => okD(x.d) && !taken.some(t => Math.hypot(t.x - x.a.x, t.z - x.a.z) < 1.2)).sort((x, y) => x.d - y.d);
    for (const { a } of list.slice(0, 12)) {
      if (!fit(b, ctx, room, idx, zones, a, slotKits().wall, false, fires)) continue;
      const sl = { kind, role: room.role, x: +a.x.toFixed(3), y: +(m.stand + 1.6).toFixed(3), z: +a.z.toFixed(3), yaw: Math.round(a.yaw), free: freeAt(a) };
      out.push(sl); taken.push(sl); n++;
      break;
    }
  }
  // table tops: the part of each table's top with nothing on it (three tables a room at most)
  let tables = 0;
  for (const r of idx.all) {
    if (tables >= 3) break;
    if (!r.p.decor || !inRoom(r) || !/^(piece_table|piece_table_round|piece_table_oak|piece_blackmarble_table|dvergrprops_table)$/.test(r.p.name)) continue;
    const t = r.p, o = Ck.aabb(t), top = o.y1;
    let free = 0, all = 0;
    for (let x = o.x0 + 0.15; x < o.x1 - 0.1; x += 0.25) for (let z = o.z0 + 0.15; z < o.z1 - 0.1; z += 0.25) {
      all++;
      if (!idx.near({ x0: x - 0.12, x1: x + 0.12, z0: z - 0.12, z1: z + 0.12 }, 0).some(q => q.p !== t && q.p.decor && q.p.y > top - 0.2 && q.p.y < top + 0.6 && Math.abs(q.p.x - x) < 0.2 && Math.abs(q.p.z - z) < 0.2)) free++;
    }
    tables++;
    out.push({ kind: 'table', role: room.role, x: t.x, y: +top.toFixed(3), z: t.z, yaw: Math.round(t.yaw || 0), free: { area: +(free * 0.0625).toFixed(2), share: all ? +(free / all).toFixed(2) : 0 } });
    n++;
  }
  return n;
}

// Walls between the furniture (review 2026-11-09: walls bare above 1 m), as the household dresses them (D-068: no fixed
// intervals). Three passes along each plain wall: things hung between 1.3 and 2.4 m where nothing hangs within 0.9 m
// either side; a second shelf near 2.2 m in some households at d3; and a wall torch where no light is within 2 m. The
// gap to the next piece is a base (2.5 m at d3, 3.2 m at d2) times the household's spacing (neat households hang
// less), drawn anew after each piece (0.7 to 1.5 times), a neat household leaves some spots bare, and what goes up is
// drawn by its weights: shelves, banners, trophies, weapons, tools or candles (lib/persona.js wallWeights). Torches
// are spaced by wealth and the liking for light.
function dressWalls(b, ctx, room, idx, zones, anchors, fires, R2, used) {
  const m = room.m, P = ctx.persona, PS = personaB();
  const byFace = new Map();
  for (const an of anchors) if (an.anchor === 'wall') { if (!byFace.has(an.face)) byFace.set(an.face, []); byFace.get(an.face).push(an); }
  const d3 = ctx.decor === 'd3';
  const gap = PS.wallGap(P), skip = PS.wallSkip(P);
  const ww = PS.wallWeights(P, room.role);
  const kinds = Object.keys(WALL_KITS).filter(k => ww[k] > 0);
  const passes = [{ main: true, step: (d3 ? 2.5 : 3.2) * gap, y0: 1.3, y1: 2.4, reach: 0.9 }];
  if (d3 && (!P || R2() < 0.2 + 0.5 * P.clutter * P.likes.shelves)) passes.push({ kits: [WALL_HIGH], step: 3 * gap, y0: 2.0, y1: 2.7, reach: 0.9 });
  passes.push({ kits: [WALL_LIGHT], step: PS.torchGap(P), y0: 0, y1: 4, reach: 2, light: true });
  let n = 0;
  for (const pass of passes) for (const list of byFace.values()) {
    list.sort((p, q) => p.t - q.t);
    let next = -Infinity, kc = 0;
    for (const an of list) {
      if (an.t < next) continue;
      const f = an.face, ux = f.ux, uz = f.uz, R = pass.reach;
      const box = { x0: Math.min(an.x - ux * R, an.x + ux * R, an.x + f.nx * 0.7) - 0.05, x1: Math.max(an.x - ux * R, an.x + ux * R, an.x + f.nx * 0.7) + 0.05,
        z0: Math.min(an.z - uz * R, an.z + uz * R, an.z + f.nz * 0.7) - 0.05, z1: Math.max(an.z - uz * R, an.z + uz * R, an.z + f.nz * 0.7) + 0.05 };
      const busy = idx.near(box, 0).some(r => r.p.decor && PB.piece(r.p.name).role !== 'rug' && (!pass.light || PB.piece(r.p.name).role === 'light') &&
        r.b.y1 > m.stand + pass.y0 && r.b.y0 < m.stand + pass.y1 && r.b.x0 < box.x1 && r.b.x1 > box.x0 && r.b.z0 < box.z1 && r.b.z1 > box.z0);
      const jit = 0.7 + 0.8 * R2();
      if (busy) { next = an.t + pass.step * 0.6 * jit; continue; }
      // a neat household leaves some of the wall bare
      if (!pass.light && R2() < skip) { next = an.t + pass.step * 0.5 * jit; continue; }
      let kits = pass.kits;
      if (pass.main) {
        // the kind drawn by the household's weights first, the others after it by weight
        const first = PS.pickW(R2, Object.fromEntries(kinds.map(k => [k, ww[k]])));
        kits = [first, ...kinds.filter(k => k !== first).sort((a, c) => ww[c] - ww[a])].flatMap(k => WALL_KITS[k]);
      }
      for (const k of kits) {
        const got = fit(b, ctx, room, idx, zones, an, k, false, fires);
        if (!got) continue;
        // every other piece on a wall goes up at the third stage, and the high shelf (D-071)
        const ds = pass.light ? 2 : pass.main ? (kc++ % 2 ? 3 : 2) : 3;
        for (const p of got) { p.ds = ds; b.pieces.push(p); idx.add(p); }
        used[k.id] = (used[k.id] || 0) + 1;
        next = an.t + pass.step * jit; n++;
        break;
      }
    }
  }
  return n;
}

// Long rows of chests and barrels the furnishing set along a wall (review 2026-11-09: four chests in a line): in a row
// of four or more, every third goes, so they stand in twos with room between.
function groupStorage(b) {
  const I = decorB()._int;
  const st = b.pieces.filter(p => p.decor && !p.kb && PB.piece(p.name).role === 'storage');
  const out = new Set();
  const used = new Set();
  for (const p of st) {
    if (used.has(p)) continue;
    const yaw = Math.round(I.pyaw(p)) % 180, a = yaw * Math.PI / 180, ux = Math.cos(a), uz = -Math.sin(a), nx = Math.sin(a), nz = Math.cos(a);
    const off = p.x * nx + p.z * nz;
    const row = st.filter(q => !used.has(q) && Math.round(I.pyaw(q)) % 180 === yaw && Math.abs(q.x * nx + q.z * nz - off) < 0.15 && Math.abs(q.y - p.y) < 0.2)
      .sort((q, r) => (q.x * ux + q.z * uz) - (r.x * ux + r.z * uz));
    // runs with gaps of 1.3 m or less between neighbours
    let run = [];
    const flush = () => { if (run.length >= 4) run.forEach((q, i) => { if (i % 3 === 2) out.add(q); }); run = []; };
    for (const q of row) {
      used.add(q);
      if (run.length && (q.x * ux + q.z * uz) - (run[run.length - 1].x * ux + run[run.length - 1].z * uz) > 1.9) flush();
      run.push(q);
    }
    flush();
  }
  if (out.size) b.pieces = b.pieces.filter(p => !out.has(p));
  return out.size;
}

// Rugs the furnishing laid with nothing standing on them (review 2026-11-09: a rug alone, a chest on a rug): each goes
// under the nearest table, bed or bench within 2.5 m on its floor, its long side along theirs, or out when that piece
// has a rug already or there is none.
function seatRugs(b) {
  const D = decorB(), I = D._int, F = D.FURNITURE;
  const box = p => { const [w, , d] = I.size(p.name); return I.obox(p.x, p.z, w, d, I.pyaw(p)); };
  const holders = b.pieces.filter(p => p.decor && ['table', 'bed', 'seat'].includes(PB.piece(p.name).role) && !/^piece_chair/.test(p.name));
  const rugs = b.pieces.filter(p => p.decor && !p.kb && PB.piece(p.name).role === 'rug');
  const out = new Set();
  let moved = 0;
  for (const r of rugs) {
    const rb = box(r);
    // standing on it: four of the piece's five footprint points (its middle and corners) on the rug
    const onRug = h => { const hb = box(h); return [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]].filter(([u, v]) => {
      const x = hb.x + u * hb.hw * hb.c + v * hb.hd * hb.s, z = hb.z - u * hb.hw * hb.s + v * hb.hd * hb.c; return I.ptDist(rb, x, z) < 0.01; }).length >= 4; };
    const on = holders.some(h => Math.abs(h.y - r.y) < 0.5 && onRug(h));
    if (on) continue;
    const near = holders.filter(h => Math.abs(h.y - r.y) < 0.5 && Math.hypot(h.x - r.x, h.z - r.z) < 2.5).sort((p, q) => Math.hypot(p.x - r.x, p.z - r.z) - Math.hypot(q.x - r.x, q.z - r.z))[0];
    const taken = near && rugs.concat(b.pieces.filter(p => p.kb && PB.piece(p.name).role === 'rug')).some(o => o !== r && !out.has(o) && Math.abs(o.y - r.y) < 0.3 && I.ptDist(box(o), near.x, near.z) < 0.01);
    if (!near || taken) { out.add(r); continue; }
    const [rw, , rd] = I.size(r.name), [hw, , hd] = I.size(near.name);
    const yaw = normB(I.pyaw(near) + ((rw >= rd) === (hw >= hd) ? 0 : 90));
    r.x = near.x; r.z = near.z; r.yaw = yaw; r.q = quatB(yaw);
    moved++;
    void F;
  }
  if (out.size) b.pieces = b.pieces.filter(p => !out.has(p));
  return moved + out.size;
}

// Beds packed edge to edge (review 2026-11-09: tavern beds read as barracks): a bed whose footprint comes within
// 0.35 m of another kept bed, or within 1.2 m of a stair or ladder, goes with the chest at its foot; a house keeps one.
function spaceBeds(b, ctx) {
  const D = decorB(), I = D._int;
  const isBed = p => p.decor && !p.kb && /^(bed|piece_bed02|ashwood_bed)$/.test(p.name);
  const box = p => { const [w, , d] = I.size(p.name); return I.obox(p.x, p.z, w, d, I.pyaw(p)); };
  const stairs = b.pieces.filter(p => !p.decor && PB.piece(p.name).role === 'stair').map(p => ({ p, b: box(p) }));
  const beds = b.pieces.filter(isBed), kept = [], out = new Set();
  for (const bed of beds) {
    const bb = box(bed);
    const close = kept.some(k => Math.abs(k.y - bed.y) < 0.5 && I.overlap(box(k), bb, 0.35)) ||
      stairs.some(s => Math.abs(s.p.y - bed.y) < 2.5 && I.overlap(s.b, bb, 1.2));
    if (close && kept.length + beds.length - out.size - kept.length > 1 - 0) {
      if (beds.length - out.size <= 1) { kept.push(bed); continue; }
      out.add(bed);
      // its foot chest: a chest within 2.2 m along its length, in line with it
      const a = I.pyaw(bed) * Math.PI / 180, ax = Math.sin(a), az = Math.cos(a);
      for (const q of b.pieces) if (q.decor && !q.kb && PB.piece(q.name).role === 'storage' && Math.abs(q.y - bed.y) < 0.4) {
        const along = (q.x - bed.x) * ax + (q.z - bed.z) * az, side = Math.abs((q.x - bed.x) * az - (q.z - bed.z) * ax);
        if (along > 1 && along < 2.4 && side < 0.5) out.add(q);
      }
      continue;
    }
    kept.push(bed);
  }
  if (out.size) b.pieces = b.pieces.filter(p => !out.has(p));
  return out.size;
}

// Rooms where the furnishing set two tables or more (a house's tables bunched in one wing): the one nearest the
// room's middle stays with its seats, the rest go with theirs and what stood on them, so each room has one dining
// place and the library can lay one in a room without. Only in homes and their rooms; halls, taverns, temples and
// towers keep theirs.
function spreadTables(b, ctx, rooms) {
  const Ck = checksB();
  const isTable = p => p.decor && !p.kb && PB.piece(p.name).role === 'table' && !/cartography|workbench|butcher|preptable|magetable/.test(p.name);
  let gone = 0;
  for (const room of rooms || roomsB(b, ctx)) {
    const hall = ['tavern', 'hall', 'temple'].includes(room.role);
    if (!hall && !['home', 'sleeping', 'guest', 'kitchen'].includes(room.role)) continue;
    const m = room.m;
    const tables = b.pieces.filter(p => isTable(p) && m.inside(p.x, p.z) && Math.abs(p.y - m.stand) < 0.4);
    // a hall with free floor for two sets or more: its tables all go, and the library lays its sets in a grid
    const free = hall && m.area >= 40 ? m.cells.filter(c => c.i % 2 === 0 && c.j % 2 === 0 && [0, 1, 2, 3, 4, 5, 6, 7].every(k => m.inside(c.x + 2.2 * Math.sin(k * Math.PI / 4), c.z + 2.2 * Math.cos(k * Math.PI / 4)))).length : 0;
    void free;
    const keep = hall ? tables.length : 1;
    if (tables.length <= keep) continue;
    tables.sort((p, q) => Math.hypot(p.x - m.cx, p.z - m.cz) - Math.hypot(q.x - m.cx, q.z - m.cz));
    const out = new Set();
    for (const t of tables.slice(keep)) {
      const o = Ck.aabbShapes(t);
      out.add(t);
      for (const q of b.pieces) {
        if (!q.decor || q.kb || out.has(q)) continue;
        const role = PB.piece(q.name).role;
        // its seats, and what stood on it
        if (role === 'seat' && q.x > o.x0 - 1.2 && q.x < o.x1 + 1.2 && q.z > o.z0 - 1.2 && q.z < o.z1 + 1.2 && Math.abs(q.y - t.y) < 0.4) out.add(q);
        else if (q.x > o.x0 && q.x < o.x1 && q.z > o.z0 && q.z < o.z1 && q.y > t.y + 0.3 && q.y < t.y + 1.6) out.add(q);
      }
    }
    b.pieces = b.pieces.filter(q => !out.has(q));
    gone += tables.length - keep;
  }
  return gone;
}

// ---------------------------------------------------------------- lived in (D-068)
// Movable things are rarely square in a lived-in house: rugs a little turned, chairs pulled out, benches off true,
// barrels and pots turned any way, dishes and candles scattered on a table. How far each moves follows the household
// (lib/persona.js clutter: an untidy, busy house the most; a tidy one keeps most things square). Beds, doors, stations,
// tables, chests, anything hung or built, and anything with something standing on it stay as they are. Each piece
// draws from a stream seeded by its own place, so it moves the same way at every decor stage. A move stands only when
// it makes no new problem: no clip past the marks, no overlap the audit would see, nothing in a doorway, a stair's
// way, a kept-clear place, off its floor or table, or out of its room.
const JITTER = [
  [/^(rug_|jute_carpet)/, { rot: 9, off: 0.14, rug: true }],
  [/^(piece_chair|dvergrprops_stool|dvergrprops_chair)/, { rot: 24, off: 0.12 }],
  [/^(piece_bench01|piece_logbench01|piece_blackwood_bench01|piece_bench_runed)$/, { rot: 5, off: 0.07 }],
  [/^piece_chest_barrel$/, { rot: 50, off: 0.05 }],
  [/^(piece_pot\d|ashland_pot|piece_pot\d_)/, { rot: 180, off: 0.05 }],
  [/^dvergrprops_crate/, { rot: 10, off: 0.06 }],
  [/^(itemstandh|Candle_resin)$/, { rot: 40, off: 0.06, top: true }],
];
function jitterSpec(p) {
  if (FOOD.test(p.name)) return { rot: 45, off: 0.07, top: true };
  for (const [re, sp] of JITTER) if (re.test(p.name)) return sp;
  return null;
}
function liveIn(b, ctx, zones) {
  const P = ctx.persona;
  if (!P) return 0;
  const Ck = checksB(), SH = shapesB(), D = decorB(), I = D._int, F = D.FURNITURE;
  const idx = boxIndex(b.pieces);
  const ids = new Map();
  const id = q => { if (!ids.has(q)) ids.set(q, ids.size); return ids.get(q); };
  const rooms = b.rooms || [];
  const roomOf = (x, z, y) => rooms.findIndex(r => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1 && Math.abs(y - r.y) < 1.6);
  const doors = b.pieces.filter(q => !q.decor && PB.piece(q.name).role === 'door');
  const stairs = b.pieces.filter(q => !q.decor && PB.piece(q.name).role === 'stair');
  const tables = b.pieces.filter(q => q.decor && (F[q.name] || {}).cat === 'table');
  // the problems one piece has where it stands, as keys
  const problems = p => {
    const out = new Set(), bx = Ck.aabbShapes(p), it = D.itemOf(p), sp = p._sp;
    const flat = !!sp.rug;
    if (!flat) for (const z of zones) if (z.x0 < bx.x1 && z.x1 > bx.x0 && z.z0 < bx.z1 && z.z1 > bx.z0 && z.y0 < bx.y1 && z.y1 > bx.y0) out.add('z' + zones.indexOf(z));
    for (const r of idx.near(bx, 0.1)) {
      const q = r.p;
      if (q === p) continue;
      const role = PB.piece(q.name).role;
      if (flat) { if (!q.decor && ['wall', 'pole', 'door', 'window', 'stair'].includes(role) && r.b.y0 < p.y + 0.3 && r.b.y1 > p.y && I.overlap(it.b, I.obox((r.b.x0 + r.b.x1) / 2, (r.b.z0 + r.b.z1) / 2, r.b.x1 - r.b.x0, r.b.z1 - r.b.z0, 0), -0.08)) out.add('w' + id(q)); continue; }
      if (role === 'rug' || (!q.decor && ['floor', 'roof', 'roofTop', 'roofCorner'].includes(role))) continue;
      if (bx.sol && bx.sol.length && r.b.sol && r.b.sol.length && !r.b.pass) {
        const d = SH.clipDepth(bx.sol, r.b.sol);
        if (d > Math.max(p.clip || 0, q.clip || 0) + 0.015) out.add('c' + id(q));
      }
      // the audit's own overlap for furniture it sizes (both pieces placed by the decorator)
      const fq = F[q.name], fp = F[p.name];
      if (q.decor && fq && fp && !p.kb && !q.kb && !['mount', 'hang', 'top', 'fire', 'rug'].includes(fq.at) && !['mount', 'hang', 'top', 'fire', 'rug'].includes(fp.at)) {
        const iq = D.itemOf(q);
        if (!(it.y0 > iq.y1 - 0.05 || iq.y0 > it.y1 - 0.05) && I.overlap(it.b, iq.b, -0.06)) out.add('a' + id(q));
      }
    }
    if (!flat) {
      for (const q of doors) {
        if (Math.abs(q.x - p.x) > 4 || Math.abs(q.z - p.z) > 4) continue;
        const s = PB.piece(q.name), qy = I.pyaw(q), ar = qy * Math.PI / 180, nx = Math.sin(ar), nz = Math.cos(ar), y0 = q.y - s.size[1] / 2;
        for (const sg of [1, -1]) if (it.y0 < y0 + 1.8 && it.y1 > y0 + 0.05 && I.overlap(I.obox(q.x + nx * sg * (s.size[2] / 2 + 0.6), q.z + nz * sg * (s.size[2] / 2 + 0.6), s.size[0], 1.2, qy), it.b, -0.02)) out.add('d' + id(q));
      }
      for (const q of stairs) {
        if (Math.abs(q.x - p.x) > 5 || Math.abs(q.z - p.z) > 5) continue;
        const s = PB.piece(q.name), y0 = q.y - s.size[1] / 2, y1 = q.y + s.size[1] / 2;
        if (it.y0 < y1 + 0.3 && it.y1 > y0 && I.overlap(I.obox(q.x, q.z, s.size[0] + 1.2, s.size[2] + 1.2, I.pyaw(q)), it.b, -0.02)) out.add('s' + id(q));
      }
    }
    // furniture in furniture as the pool audit measures it
    if (!flat) for (const [q] of D.furnClash(p, idx.near(bx, 0.3).map(r => r.p))) out.add('b' + id(q));
    // on what it stood on
    if (p.kb && p.rest) { if (!D.auditOne(p, idx.audit, [])) out.add('f'); }
    else if (sp.top) { if (!tables.some(t => I.ptDist(D.itemOf(t).b, p.x, p.z) < 0.05 && Math.abs(t.y + ((F[t.name] || {}).top || 0.75) - p.y) < 0.15) && !idx.near({ x0: p.x, x1: p.x, z0: p.z, z1: p.z }, 0).some(r => r.p !== p && r.b.x0 < p.x - 0.04 && r.b.x1 > p.x + 0.04 && r.b.z0 < p.z - 0.04 && r.b.z1 > p.z + 0.04 && Math.abs(r.b.y1 - (p.y - 0.0)) < 0.15)) out.add('f'); }
    // in its room: every corner of its footprint (a rug's too)
    const k = roomOf(p.x, p.z, p.y);
    const hw = it.b.hw * 0.92, hd = it.b.hd * 0.92;
    for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = it.b.x + u * hw * it.b.c + v * hd * it.b.s, z = it.b.z - u * hw * it.b.s + v * hd * it.b.c;
      if (roomOf(x, z, p.y) < 0) { out.add('r'); break; }
    }
    if (k < 0) out.add('r');
    return out;
  };
  // what bears something: a piece with another's pivot over its footprint, just over its top
  const bears = p => { const o = Ck.aabb(p); return b.pieces.some(q => q !== p && q.decor && q.x > o.x0 && q.x < o.x1 && q.z > o.z0 && q.z < o.z1 && q.y > p.y + 0.15 && q.y < o.y1 + 0.3); };
  const amp = 0.12 + 0.88 * P.clutter;
  let moved = 0;
  for (const p of b.pieces.slice()) {
    // a piece standing as its source build stood it, marked for the pool audit (D-098), stays put
    if (!p.decor || p.trim || p.yard || p.outside || (p.rest && ['wall', 'hang'].includes(p.rest)) || p.fclip || p.wclip) continue;
    const sp = jitterSpec(p);
    if (!sp) continue;
    const R = rngB((P.salt ^ Math.imul(Math.round(p.x * 20) + 8192, 73856093) ^ Math.imul(Math.round(p.y * 20) + 8192, 19349663) ^ Math.imul(Math.round(p.z * 20) + 8192, 83492791) ^ personaB().hash(p.name)) >>> 0);
    R(); R();
    // a tidy house leaves most things square
    if (R() > 0.3 + 0.7 * P.clutter) continue;
    if (!sp.rug && bears(p)) continue;
    p._sp = sp;
    const before = problems(p);
    const old = { x: p.x, z: p.z, yaw: p.yaw, q: p.q };
    const dr = (R() * 2 - 1) * sp.rot * amp, dx = (R() * 2 - 1) * sp.off * amp, dz = (R() * 2 - 1) * sp.off * amp;
    let ok = false;
    for (const f of [1, 0.5]) {
      const yaw = normB((old.yaw != null ? old.yaw : I.pyaw(p)) + dr * f);
      idx.remove(p);
      p.x = +(old.x + dx * f).toFixed(3); p.z = +(old.z + dz * f).toFixed(3); p.yaw = +yaw.toFixed(2); p.q = quatB(p.yaw);
      idx.add(p);
      const after = problems(p);
      if ([...after].every(k => before.has(k))) { ok = true; break; }
      idx.remove(p);
      Object.assign(p, old);
      idx.add(p);
    }
    delete p._sp;
    if (ok) moved++;
  }
  return moved;
}

function apply(b, ctx, zones) {
  if (ctx.decor === 'd3' && !['barn', 'storage', 'dock', 'farm'].includes(ctx.type)) vignettes(b, ctx, zones || []);
  if (ctx.decor !== 'd1' && ['longhouse', 'temple'].includes(ctx.type)) dais(b, ctx, zones || []);
  if (ctx.type === 'barn' && ctx.decor !== 'd1') stalls(b, ctx, zones || []);
  if (ctx.type === 'tavern' && ctx.decor !== 'd1') barCounter(b, ctx, zones || []);
  const X = ctx.profile || {};
  if (X.canopyBed != null ? X.canopyBed : (ctx.decor === 'd3' && ['home', 'longhouse'].includes(ctx.type) && ctx.R() < (ctx.persona ? 0.15 + 0.7 * ctx.persona.wealth : 0.5))) canopyBed(b, ctx);
  // the interior library last, from its own stream (drawn after everything above, so the rest comes out as before)
  if (X.interiorKit !== false) {
    const R2 = rngB(Math.floor(ctx.R() * 4294967296) ^ 0x6b62);
    // the rooms are read from the structure alone, so one reading serves both passes
    const rooms = roomsB(b, ctx);
    if (ctx.decor !== 'd1') { spreadTables(b, ctx, rooms); spaceBeds(b, ctx); seatRugs(b); groupStorage(b); }
    const n = furnishRooms(b, { ...ctx, _R2: R2 }, zones || [], R2, BUILT_KITS, rooms);
    if (n) b.notes.push(`${n} furnished corners and walls from the interior library.`);
    // the walking lanes last: what still stands in the way from a door to the fire, a stair or a bed goes (lib/layout.js)
    const Lay = NODE_B ? require('./layout.js') : window.VHLayout;
    if (Lay) Lay.clearLanes(b, ctx, rooms);
  }
  // lived in: movable things a little off square, by the household (lib/persona.js)
  if (X.lived !== false && ctx.decor !== 'd1') {
    const m = liveIn(b, ctx, zones || []);
    if (m) b.notes.push(`${m} movable things set a little off square, as a household leaves them.`);
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
// a wall item stand; want says what it should hold (lib/persona.js dressStands)
const stand = (x, y, want) => kp('itemstand', x, y, 0.045, 0, 'wall', null, { want });
const BUILT_KITS = [
  // a cabinet: a half wall with a chest set into it (its front shows as drawers), a plank top of two ledges, a candle,
  // a mead and a jug on it
  kit('BK-cabinet', 'wall', ['home', 'kitchen', 'tavern', 'hall', 'storage', 'workshop'], [
    kp('wood_wall_half', 0, 0.5, 0.55, 0, 'floor', null, { key: true }), kp('piece_chest_wood', 0, 0, 0.38, 0, 'floor', null, { key: true }),
    kp('wood_ledge', -0.5, 1.0, 0.42, 0, 'on', 0), kp('wood_ledge', 0.5, 1.0, 0.42, 0, 'on', 0),
    kp('BarleyWine', -0.55, 1.05, 0.42, 0, 'on', 2), kp('Candle_resin', 0.6, 1.05, 0.42, 0, 'on', 3), kp('MeadTasty', 0.25, 1.05, 0.45, 30, 'on', 3)],
  { clips: [[1, 0, 0.42]] }),
  // a chest of drawers: two chests stacked against the wall with a plank top, a candle and a jar of jam on it
  kit('BK-drawers', 'wall', ['home', 'kitchen', 'tavern', 'storage', 'sleeping'], [
    kp('piece_chest_wood', 0, 0, 0.42, 0, 'floor', null, { key: true }), kp('piece_chest_wood', 0, 0.75, 0.42, 0, 'on', 0, { key: true }),
    kp('wood_ledge', -0.5, 1.5, 0.36, 0, 'on', 1), kp('wood_ledge', 0.5, 1.5, 0.36, 0, 'on', 1),
    kp('QueensJam', -0.45, 1.55, 0.4, 0, 'on', 2), kp('Candle_resin', 0.5, 1.55, 0.4, 0, 'on', 3)]),
  // a bedside table: a barrel by the head of the bed with a candle and a mead on it
  kit('BK-bedside', 'bed', ['home', 'sleeping'], [
    kp('piece_chest_barrel', 1.3, 0, -0.95, 0, 'floor'), kp('Candle_resin', 1.2, 0.9, -1.05, 0, 'on', 0), kp('MeadTasty', 1.45, 0.9, -0.85, 40, 'on', 0)],
  { of: 'bed', first: ['home'] }),
  kit('BK-bedside2', 'bed', ['home', 'sleeping'], [
    kp('piece_chest_barrel', 1.85, 0, -1.2, 0, 'floor'), kp('Candle_resin', 1.75, 0.9, -1.3, 0, 'on', 0), kp('MeadTasty', 2.0, 0.9, -1.1, 40, 'on', 0)],
  { of: 'bed2', first: ['home'] }),
  // a nightstand: a barrel with a plank top, a candle on it
  kit('BK-nightstand', 'bed', ['home', 'sleeping'], [
    kp('piece_chest_barrel', 1.3, 0, -0.95, 0, 'floor'), kp('wood_ledge', 1.3, 0.9, -0.95, 0, 'on', 0), kp('Candle_resin', 1.3, 0.95, -0.95, 0, 'on', 1)],
  { of: 'bed' }),
  // a sleeping alcove: a half wall along the bed's open side, a bedside barrel with a candle on the other
  kit('BK-alcove', 'bed', ['home', 'sleeping', 'hall'], [
    kp('wood_wall_half', 1.2, 0.5, 0.3, 90, 'floor', null, { key: true }), kp('piece_chest_barrel', -1.3, 0, -0.95, 0, 'floor'), kp('Candle_resin', -1.3, 0.9, -0.95, 0, 'on', 1),
    kp('wood_pole2', 1.2, 1.0, 1.42, 0, 'floor'), kp('wood_pole2', 1.2, 1.0, -0.82, 0, 'floor')],
  { of: 'bed', score: 7 }),
  kit('BK-alcove2', 'bed', ['home', 'sleeping', 'hall'], [
    kp('wood_wall_half', 1.7, 0.5, 0.4, 90, 'floor', null, { key: true }), kp('piece_chest_barrel', -1.85, 0, -1.2, 0, 'floor'), kp('Candle_resin', -1.85, 0.9, -1.2, 0, 'on', 1),
    kp('wood_pole2', 1.7, 1.0, 1.52, 0, 'floor'), kp('wood_pole2', 1.7, 1.0, -0.72, 0, 'floor')],
  { of: 'bed2', score: 7 }),
  // a couch: a log bench against a half wall for its back, a post at each end for arms, a pelt in front, a torch over
  // its end
  kit('BK-couch', 'wall', ['home', 'hall', 'tavern', 'sleeping'], [
    kp('wood_wall_half', 0, 0.5, 0.16, 0, 'floor', null, { key: true }), kp('piece_logbench01', 0, 0, 0.6, 0, 'floor', null, { key: true }),
    kp('wood_pole', -1.35, 0.2, 0.55, 0, 'floor', null, { sink: 0.32 }), kp('wood_pole', 1.35, 0.2, 0.55, 0, 'floor', null, { sink: 0.32 }),
    kp('rug_wolf', 0, 0, 1.4, 90, 'floor'), kp('piece_walltorch', 1.6, 1.55, 0.28, 270, 'wall')]),
  // a living room: the couch, a rug in front, a chest for a low table with mead and a candle, an armchair each side
  kit('BK-living', 'wall', ['home', 'hall', 'tavern'], [
    kp('wood_wall_half', 0, 0.5, 0.16, 0, 'floor', null, { key: true }), kp('piece_logbench01', 0, 0, 0.6, 0, 'floor', null, { key: true }), kp('rug_deer', 0, 0, 1.9, 0, 'floor'),
    kp('wood_beam_1', -0.18, 0.2, 1.8, 90, 'floor', null, { key: true }), kp('wood_beam_1', 0.18, 0.2, 1.8, 90, 'floor', null, { key: true }), kp('wood_ledge', 0, 0.4, 1.8, 0, 'on', 3),
    kp('MeadTasty', -0.25, 0.45, 1.8, 20, 'on', 5), kp('Candle_resin', 0.25, 0.45, 1.75, 0, 'on', 5),
    kp('piece_chair', 1.5, 0, 1.8, 270, 'floor'), kp('piece_chair', -1.5, 0, 1.8, 90, 'floor')], { score: 8 }),
  // drapes: a banner each side of a window, its hem on the floor, a bench under it
  kit('BK-drapes', 'window', ['home', 'hall', 'tavern', 'temple', 'sleeping'], [
    kp('piece_banner01', -0.8, 2.35, 0.2, 90, 'wall', null, { any: true, key: true }), kp('piece_banner01', 0.8, 2.35, 0.2, 90, 'wall', null, { any: true, key: true }),
    kp('wood_beam', -0.5, 2.6, 0.2, 0, 'wall', null, { key: true }), kp('wood_beam', 0.5, 2.6, 0.2, 0, 'wall', null, { key: true }),
    kp('piece_bench01', 0, 0, 0.45, 0, 'floor')], { byWidth: true, score: 8 }),
  // shelves: two ledges on the wall with candles, meads and a jug, barrels standing under them
  kit('BK-shelf', 'wall', ['home', 'kitchen', 'tavern', 'storage', 'workshop', 'smithy'], [
    kp('wood_ledge', -0.5, 1.35, 0.3, 0, 'wall'), kp('wood_ledge', 0.5, 1.35, 0.3, 0, 'wall'),
    kp('BarleyWine', -0.65, 1.4, 0.32, 0, 'on', 0), kp('Candle_resin', -0.15, 1.4, 0.3, 0, 'on', 0), kp('MeadTasty', 0.25, 1.4, 0.35, 0, 'on', 1), kp('QueensJam', 0.65, 1.4, 0.3, 0, 'on', 1),
    kp('piece_chest_barrel', -0.45, 0, 0.42, 0, 'floor'), kp('piece_chest_barrel', 0.45, 0, 0.42, 0, 'floor')]),
  // a kitchen wall: a counter of a half wall with a plank top, the spice rack over it, sausages and carrots on it;
  // barrels beside it with the pots and pans hung over them
  kit('BK-kitchen', 'wall', ['kitchen', 'tavern', 'home'], [
    kp('wood_wall_half', -1.0, 0.5, 0.55, 0, 'floor', null, { key: true }), kp('wood_ledge', -1.5, 1.0, 0.42, 0, 'on', 0), kp('wood_ledge', -0.5, 1.0, 0.42, 0, 'on', 0),
    kp('cauldron_ext1_spice', -1.0, 1.75, 0.12, 0, 'wall'), kp('Sausages', -1.5, 1.05, 0.42, 0, 'on', 1), kp('Carrot', -0.7, 1.05, 0.42, 80, 'on', 2), kp('BarleyWine', -0.3, 1.05, 0.4, 0, 'on', 2),
    kp('piece_chest_barrel', 0.6, 0, 0.42, 0, 'floor'), kp('piece_chest_barrel', 1.45, 0, 0.42, 0, 'floor'), kp('cauldron_ext4_pots', 1.05, 1.95, 0.02, 0, 'wall')],
  { first: ['tavern'], score: 8 }),
  // a feast table: the village's own feast in the middle, candles at the ends, meads
  kit('BK-feast', 'table', ['hall', 'tavern', 'home', 'kitchen'], [
    kp('FeastMeadows', 0, 0.8, 0, 0, 'anchor'), kp('Candle_resin', -0.9, 0.8, 0.05, 0, 'anchor'), kp('Candle_resin', 0.9, 0.8, -0.05, 0, 'anchor'),
    kp('MeadTasty', -0.55, 0.8, 0.3, 0, 'anchor'), kp('MeadTasty', 0.55, 0.8, -0.3, 180, 'anchor'),
    kp('piece_bench01', 0, 0, -1.0, 0, 'floor'), kp('piece_bench01', 0, 0, 1.0, 180, 'floor')], { of: 'table', score: 8 }),
  // a kitchen island: a table with sausages, carrots and a jug on it and a barrel at each end
  kit('BK-island', 'table', ['kitchen', 'tavern', 'home'], [
    kp('Sausages', -0.6, 0.8, 0, 0, 'anchor'), kp('Carrot', 0.15, 0.8, 0.1, 80, 'anchor'), kp('BarleyWine', 0.7, 0.8, -0.15, 0, 'anchor'),
    kp('piece_chest_barrel', -1.75, 0, 0, 0, 'floor'), kp('piece_chest_barrel', 1.75, 0, 0, 0, 'floor')], { of: 'table' }),
  // the smithy's forge dressed: an anvil and the grinding wheel beside it, the tool rack on the wall behind, a quench
  // barrel and an armor stand at the ends (frame: the forge's pivot, its front at +z, its back to the wall)
  kit('BK-forge', 'forge', ['smithy', 'workshop'], [
    kp('forge_ext4', -1.55, 0, 0.1, 0, 'floor'), kp('forge_ext2', 1.5, 0, 0, 0, 'floor'), kp('piece_chest_barrel', 2.4, 0, 0, 0, 'floor')], { first: ['smithy'], score: 9 }),
  // the workbench dressed: the chopping block and the tool shelf beside it, a barrel at the end
  kit('BK-bench', 'workbench', ['workshop', 'smithy'], [
    kp('piece_workbench_ext1', -2.0, 0, 0, 0, 'floor'), kp('piece_chest_barrel', 2.1, 0, -0.1, 0, 'floor'), kp('piece_chest_wood', 3.3, 0, -0.15, 0, 'floor')],
  { first: ['workshop'], score: 9 }),
  // a smith's work zone on the free floor: an anvil, the grinding wheel, a quench barrel and a crate of stock
  kit('BK-smithzone', 'floor', ['smithy'], [
    kp('forge_ext4', 0, 0, 0, 0, 'floor', null, { key: true }), kp('forge_ext2', 1.5, 0, 0.1, 0, 'floor'), kp('piece_chest_barrel', -1.3, 0, 0.2, 0, 'floor'),
    kp('rug_straw', 0, 0, 0.1, 90, 'floor')], { score: 9, dining: true, roles: ['smithy'] }),
  // a joiner's work zone: a workbench on the free floor with the chopping block, a crate and a barrel
  kit('BK-workzone', 'floor', ['workshop'], [
    kp('piece_workbench', 0, 0, 0, 0, 'floor', null, { key: true }), kp('piece_workbench_ext1', 2.1, 0, 0.2, 0, 'floor'), kp('piece_chest_barrel', -2.1, 0, 0.1, 0, 'floor'),
    kp('piece_chest_wood', 0, 0, 1.35, 180, 'floor')], { score: 9, dining: true, roles: ['workshop'] }),
  // the tavern's serving corner: barrels stacked in the corner and along the wall behind a counter with meads on it
  // (corner frame: walls run along (1, 1) and (-1, 1); pieces square to them turn 45 or 315)
  kit('BK-serving', 'corner', ['tavern'], [
    kp('piece_chest_barrel', 0, 0, 0.65, 45, 'floor'), kp('piece_chest_barrel', 0, 0.9, 0.65, 45, 'on', 0),
    kp('piece_chest_barrel', along1(1.2, 0.45)[0], 0, along1(1.2, 0.45)[1], 315, 'floor'),
    kp('wood_wall_half', along2(2.2, 1.4)[0], 0.5, along2(2.2, 1.4)[1], 45, 'floor', null, { key: true }),
    kp('wood_ledge', along2(1.7, 1.4)[0], 1.0, along2(1.7, 1.4)[1], 45, 'on', 3), kp('wood_ledge', along2(2.7, 1.4)[0], 1.0, along2(2.7, 1.4)[1], 45, 'on', 3),
    kp('MeadTasty', along2(1.6, 1.4)[0], 1.05, along2(1.6, 1.4)[1], 0, 'on', 4), kp('BarleyWine', along2(2.8, 1.35)[0], 1.05, along2(2.8, 1.35)[1], 90, 'on', 5)],
  { angle: 90, first: ['tavern'], score: 8 }),
  // a bath corner where the room is big enough: the tub with a mat
  kit('BK-bath', 'corner', ['home', 'sleeping'], [
    kp('piece_bathtub', 0, 0, 2.35, 45, 'floor', null, { key: true }), kp('rug_straw', along1(2.9, 0.9)[0], 0, along1(2.9, 0.9)[1], 45, 'floor')],
  { angle: 90, decor: ['d3'], score: 2 }),
  // storage under the stairs: a chest under the highest flight, or two barrels where the village makes them
  // (one of these per building, by what the household keeps there: lib/persona.js underStair)
  kit('BK-understair', 'stair', ['home', 'tavern', 'hall', 'storage', 'workshop', 'sleeping'], [
    kp('piece_chest_wood', 0, 0, -0.35, 0, 'floor', null, { key: true })], { score: 8, min: 1 }),
  kit('BK-understair2', 'stair', ['home', 'tavern', 'hall', 'storage', 'workshop', 'sleeping'], [
    kp('piece_chest_barrel', -0.45, 0, -0.35, 0, 'floor'), kp('piece_chest_barrel', 0.45, 0, -0.35, 0, 'floor')], { score: 8 }),
  // crates, one turned a little, the way they get pushed in
  kit('BK-understair3', 'stair', ['home', 'tavern', 'hall', 'storage', 'workshop', 'sleeping'], [
    kp('dvergrprops_crate', -0.4, 0, -0.3, 0, 'floor', null, { key: true }), kp('dvergrprops_crate', 0.75, 0, -0.25, 12, 'floor')], { score: 7, min: 1 }),
  // a chest with a barrel beside it and a pot in front
  kit('BK-understair4', 'stair', ['home', 'tavern', 'hall', 'storage', 'workshop', 'sleeping'], [
    kp('piece_chest_wood', -0.35, 0, -0.35, 0, 'floor', null, { key: true }), kp('piece_chest_barrel', 0.85, 0, -0.3, 0, 'floor'), kp('piece_pot2', 0.2, 0, 0.45, 30, 'floor')], { score: 7, min: 1 }),
  // what lies about by the household's hobbies and habits (D-068; lib/persona.js kitWeight weighs them):
  // pots by a window, for a household that grows things
  kit('BK-sill', 'window', ['home', 'sleeping', 'kitchen', 'tavern', 'hall'], [
    kp('piece_pot2', -0.5, 0, 0.5, 20, 'floor'), kp('piece_pot3', 0.5, 0, 0.5, 70, 'floor')], { byWidth: true, score: 5, min: 1 }),
  // a cluster of pots in a corner
  kit('BK-pots', 'corner', ['home', 'kitchen', 'sleeping', 'storage'], [
    kp('piece_pot2', 0, 0, 0.8, 15, 'floor', null, { key: true }), kp('piece_pot1', along1(1.55, 0.48)[0], 0, along1(1.55, 0.48)[1], 80, 'floor'), kp('piece_pot3', along2(1.5, 0.45)[0], 0, along2(1.5, 0.45)[1], 200, 'floor')],
  { angle: 90, score: 4, min: 2 }),
  // a half-done project: the chopping block with timber lying by it, a crate of offcuts, a tool on the wall over it
  // a collector's wall: trophies on stands at eye height, between the 2x2 wood wall's bars, a bench under them
  kit('BK-trophies', 'wall', ['home', 'hall', 'sleeping', 'tavern'], [
    stand(-0.85, 1.15, 'trophy'), stand(0, 1.3, 'trophy'), stand(0.85, 1.15, 'trophy'),
    kp('piece_bench01', 0, 0, 0.45, 0, 'floor')], { score: 5, min: 2 }),
  kit('BK-project', 'wall', ['home', 'workshop', 'storage', 'sleeping'], [
    kp('piece_workbench_ext1', -0.5, 0, 0.45, 0, 'floor', null, { key: true }), kp('dvergrprops_crate', 0.75, 0, 0.55, 8, 'floor'),
    kp('wood_beam_1', 0.1, 0.1, 1.25, 63, 'floor'), stand(-0.45, 1.65, 'tool')], { score: 5, min: 2 }),
  // a tanning rack against the wall, a hide on the floor before it
  kit('BK-tanning', 'wall', ['home', 'workshop', 'storage'], [
    kp('piece_workbench_ext2', 0, 0, 0.32, 0, 'floor', null, { key: true }), kp('rug_deer', 0.3, 0, 1.75, 17, 'floor')], { score: 4, min: 1 }),
  // a pelt beside the bed, half under it
  kit('BK-bedpelt', 'bed', ['home', 'sleeping', 'guest'], [kp('rug_wolf', 1.05, 0, 0.25, 16, 'floor', null, { key: true })], { score: 4, min: 1 }),
  // a table left as it was used: dishes, a jug, a mug and a candle scattered, things turned every way
  kit('BK-tablemess', 'table', ['home', 'kitchen', 'tavern', 'hall', 'guest'], [
    kp('MeadTasty', -0.75, 0.8, 0.28, 35, 'anchor'), kp('Raspberry', -0.2, 0.8, -0.3, 0, 'anchor'), kp('itemstandh', 0.45, 0.8, -0.2, 62, 'anchor', null, { want: 'drink' }),
    kp('Carrot', 0.15, 0.8, 0.32, 118, 'anchor'), kp('Candle_resin', 0.92, 0.8, 0.3, 0, 'anchor')], { of: 'table', score: 5, min: 3 }),
  // a table kept clear: a candle in the middle and a jug beside it
  kit('BK-tableneat', 'table', ['home', 'kitchen', 'hall', 'guest', 'sleeping'], [
    kp('Candle_resin', 0, 0.8, 0, 0, 'anchor', null, { key: true }), kp('BarleyWine', 0.4, 0.8, 0, 0, 'anchor')], { of: 'table', score: 4, min: 2 }),
  // a busy corner: a barrel, a crate pushed in askew and a pot
  kit('BK-clutter', 'corner', ['home', 'storage', 'workshop', 'kitchen', 'sleeping', 'smithy'], [
    kp('dvergrprops_crate', 0, 0, 1.15, 57, 'floor', null, { key: true }), kp('piece_chest_barrel', along2(1.95, 0.5)[0], 0, along2(1.95, 0.5)[1], 30, 'floor'),
    kp('piece_pot1', along1(2.0, 0.48)[0], 0, along1(2.0, 0.48)[1], 0, 'floor')], { angle: 90, score: 4, min: 2 }),
  // dining sets on the free floor: a table with a bench each side facing it, a rug under them reaching past, a
  // candle and a mead on the table
  kit('BK-dining', 'floor', ['home', 'hall', 'tavern', 'kitchen', 'guest'], [
    kp('rug_fur', 0, 0, 0, 90, 'floor'), kp('piece_table', 0, 0, 0, 0, 'floor', null, { key: true }),
    kp('piece_bench01', 0, 0, -1.0, 0, 'floor'), kp('piece_bench01', 0, 0, 1.0, 180, 'floor'),
    kp('Candle_resin', -0.5, 0.82, 0, 0, 'on', 1), kp('MeadTasty', 0.4, 0.82, 0.15, 0, 'on', 1)], { score: 9, dining: true }),
  // a round table with four chairs facing it on a deer rug
  kit('BK-dining-round', 'floor', ['home', 'tavern', 'hall', 'guest'], [
    kp('rug_deer', 0, 0, 0, 0, 'floor'), kp('piece_table_round', 0, 0, 0, 0, 'floor', null, { key: true }),
    kp('piece_chair', 0, 0, -1.6, 0, 'floor'), kp('piece_chair', 0, 0, 1.6, 180, 'floor'), kp('piece_chair', -1.6, 0, 0, 90, 'floor'), kp('piece_chair', 1.6, 0, 0, 270, 'floor'),
    kp('Candle_resin', 0, 0.86, 0, 0, 'on', 1)], { score: 6, dining: true }),
  // a long oak table with two benches each side, for halls and taverns
  kit('BK-dining-long', 'floor', ['hall', 'tavern'], [
    kp('jute_carpet', -1.6, 0, 0, 0, 'floor'), kp('jute_carpet', 1.6, 0, 0, 0, 'floor'), kp('piece_table_oak', 0, 0, 0, 0, 'floor', null, { key: true }),
    kp('piece_bench01', -1.55, 0, -1.3, 0, 'floor'), kp('piece_bench01', 1.55, 0, -1.3, 0, 'floor'), kp('piece_bench01', -1.55, 0, 1.3, 180, 'floor'), kp('piece_bench01', 1.55, 0, 1.3, 180, 'floor'),
    kp('Candle_resin', -2, 0.8, 0, 0, 'on', 2), kp('MeadTasty', 0.3, 0.8, 0.2, 0, 'on', 2), kp('Candle_resin', 2, 0.8, 0, 0, 'on', 2)], { score: 8, dining: true }),
  // a Dvergr table with stools, where the village makes them
  kit('BK-dining-dvergr', 'floor', ['home', 'tavern', 'hall', 'workshop'], [
    kp('rug_hare', 0, 0, 0, 90, 'floor'), kp('dvergrprops_table', 0, 0, 0, 0, 'floor', null, { key: true }),
    kp('dvergrprops_stool', -0.45, 0, -1.05, 0, 'floor'), kp('dvergrprops_stool', 0.45, 0, -1.05, 0, 'floor'), kp('dvergrprops_stool', -0.45, 0, 1.05, 180, 'floor'), kp('dvergrprops_stool', 0.45, 0, 1.05, 180, 'floor'),
    kp('Candle_resin', 0, 0.78, 0, 0, 'on', 1)], { score: 7, dining: true }),
];
// small things for the walls between the furniture: a ledge with a candle and a mead, or a banner
const WALL_DRESS = [
  kit('BK-wledge', 'wall', [], [kp('wood_ledge', 0, 1.6, 0.3, 0, 'wall'), kp('Candle_resin', -0.25, 1.65, 0.3, 0, 'on', 0), kp('MeadTasty', 0.25, 1.65, 0.32, 0, 'on', 0)]),
  kit('BK-wbanner', 'wall', [], [kp('piece_banner01', 0, 2.35, 0.2, 90, 'wall', null, { any: true })], { min: 1 }),
];
// what households hang on a plain wall, by kind (lib/persona.js wallWeights); item stands get their item from
// lib/persona.js dressStands, by what the kit asks for (want)
const WALL_KITS = {
  ledge: [WALL_DRESS[0], kit('BK-wledge-b', 'wall', [], [kp('wood_ledge', 0, 1.55, 0.3, 0, 'wall'), kp('QueensJam', -0.3, 1.6, 0.3, 0, 'on', 0), kp('BarleyWine', 0.1, 1.6, 0.33, 0, 'on', 0)])],
  banner: [WALL_DRESS[1]],
  trophy: [kit('BK-wtrophy', 'wall', [], [stand(0, 1.9, 'trophy')], { min: 1 }), kit('BK-wtrophy2', 'wall', [], [stand(-0.45, 1.85, 'trophy'), stand(0.5, 1.95, 'trophy')], { min: 1 })],
  weapons: [kit('BK-wweapons', 'wall', [], [stand(-0.4, 1.6, 'shield'), stand(0.45, 1.7, 'weapon')], { min: 1 }), kit('BK-wshield', 'wall', [], [stand(0, 1.65, 'shield')], { min: 1 })],
  tools: [kit('BK-wtools', 'wall', [], [stand(-0.55, 1.5, 'tool'), stand(0.02, 1.58, 'tool'), stand(0.6, 1.5, 'tool')], { min: 2 })],
  candles: [kit('BK-wcandles', 'wall', [], [kp('wood_ledge', 0, 1.45, 0.3, 0, 'wall'), kp('Candle_resin', -0.3, 1.5, 0.3, 0, 'on', 0), kp('Candle_resin', 0.25, 1.5, 0.28, 0, 'on', 0)])],
};
// a second tier near 2.2 m: a ledge with a jug and a jar of jam
const WALL_HIGH = kit('BK-wledge2', 'wall', [], [kp('wood_ledge', 0, 2.2, 0.3, 0, 'wall'), kp('BarleyWine', -0.25, 2.25, 0.3, 0, 'on', 0), kp('QueensJam', 0.25, 2.25, 0.3, 0, 'on', 0)]);
// a wall torch where none is within 4 m
const WALL_LIGHT = kit('BK-wtorch', 'wall', [], [kp('piece_walltorch', 0, 1.55, 0.28, 270, 'wall')], { min: 1 });
// Role displays (D-074): small assemblies a resident adds from their own role when they decorate in the game. Data
// only: the generator never places them. Each is in the library's format (frames as BUILT_KITS) with what it needs
// from a slot (need: wall width, floor depth, table area) and the roles it suits; the mod picks one that fits a slot of
// design.slots and runs the same fit tests (clips, rests, doorways) before placing it piece by piece.
const ROLE_DISPLAYS = [
  kit('RD-arms', 'wall', [], [stand(-0.45, 1.65, 'shield'), stand(0.45, 1.7, 'weapon')], { roles: ['guard', 'warrior', 'hunter'], need: { width: 1.5 }, min: 2 }),
  kit('RD-trophies', 'wall', [], [stand(-0.5, 1.9, 'trophy'), stand(0.5, 1.95, 'trophy')], { roles: ['hunter'], need: { width: 1.5 }, min: 2 }),
  kit('RD-tools', 'wall', [], [stand(-0.55, 1.5, 'tool'), stand(0, 1.58, 'tool'), stand(0.55, 1.5, 'tool')], { roles: ['builder', 'woodcutter', 'miner', 'smith'], need: { width: 1.75 }, min: 2 }),
  kit('RD-farm', 'wall', [], [stand(-0.35, 1.55, 'farm'), stand(0.35, 1.55, 'farm')], { roles: ['farmer', 'gatherer'], need: { width: 1.0 }, min: 1 }),
  kit('RD-pots', 'wall', [], [kp('wood_ledge', 0, 1.45, 0.3, 0, 'wall'), kp('itemstandh', -0.3, 1.5, 0.3, 20, 'on', 0, { want: 'herbs' }), kp('itemstandh', 0.3, 1.5, 0.3, 340, 'on', 0, { want: 'food' }),
    kp('piece_pot1', 0.55, 0, 0.45, 30, 'floor')], { roles: ['cook'], need: { width: 1.25, depth: 0.6 }, min: 2 }),
  kit('RD-kitchen', 'wall', [], [kp('cauldron_ext1_spice', 0, 1.75, 0.12, 0, 'wall'), kp('cauldron_ext4_pots', 0.95, 1.95, 0.02, 0, 'wall')], { roles: ['cook'], need: { width: 2.0 }, min: 1 }),
  kit('RD-table-tools', 'table', [], [kp('itemstandh', -0.7, 0.8, 0.25, 15, 'anchor', null, { want: 'tool' }), kp('itemstandh', -0.35, 0.8, -0.2, 300, 'anchor', null, { want: 'tool' })],
    { roles: ['builder', 'smith', 'woodcutter'], need: { area: 0.5 }, min: 1 }),
  kit('RD-table-meal', 'table', [], [kp('itemstandh', 0.6, 0.8, 0.2, 40, 'anchor', null, { want: 'food' }), kp('itemstandh', 0.2, 0.8, -0.25, 0, 'anchor', null, { want: 'drink' }), kp('Candle_resin', 0.85, 0.8, -0.25, 0, 'anchor')],
    { roles: ['cook', 'innkeeper'], need: { area: 0.5 }, min: 2 }),
  kit('RD-fishing', 'wall', [], [stand(0, 1.7, 'fishing'), kp('itemstandh', 0, 1.25, 0.25, 0, 'wall', null, { want: 'fish' })], { roles: ['fisher'], need: { width: 1.0 }, min: 1 }),
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
const apiB = { setStats: s => { STATS_B = s; }, liveIn, jitterSpec, WALL_DRESS, WALL_KITS, UNDER, underChoice, residentSlots, slotKits, ROLE_DISPLAYS, groupStorage, spreadTables, spaceBeds, seatRugs, dressWalls, why: () => WHY_B, _fitDebug: fitDebug, BUILT: BUILT_KITS, apply, library, setLibrary, lite, furnishRooms, anchorsOf, roomsB, fit, barCounter, canopyBed, stalls, dais, vignettes, CLASSES, SLOT, FOOD, BUILT_SLOTS, slotOf, isDecor, canDecor };
if (NODE_B) module.exports = apiB; else window.VHKitbash = apiB;
