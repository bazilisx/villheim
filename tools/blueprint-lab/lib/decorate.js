// Decorator: furnishes rooms at decor stage d1 (bare needs), d2 (lived in) or d3 (rich), or strips a design down.
// Works on generated buildings (rooms known) and on any existing blueprint (rooms found from floors and walls).
// What goes where follows the corpus (rules.json "decor", "placement", "groups"): chests and stations stand against
// walls facing in, tables and hearths stand in the middle with seats round them, banners and item stands hang
// high on walls, the cooking station sits on the fire.

const NODE_D = typeof module !== 'undefined';
const P = NODE_D ? require('./pieces.js') : window.VHPieces;
let RULES = null;
function setRules(r) { RULES = r; }
if (NODE_D) { try { RULES = require('../data/rules.json'); } catch (e) { RULES = null; } }

// Biome where each item first becomes buildable (its hardest material).
const ITEM_BIOME = {
  bed: 'Meadows', piece_bed02: 'Swamp', piece_chest_wood: 'Meadows', piece_chest: 'Swamp', piece_chest_barrel: 'Swamp',
  piece_chest_blackmetal: 'Plains', piece_table: 'Meadows', piece_table_round: 'Meadows', piece_table_oak: 'Swamp',
  piece_chair: 'Meadows', piece_chair02: 'Meadows', piece_chair03: 'Swamp', piece_bench01: 'Meadows', piece_logbench01: 'Black Forest',
  piece_throne01: 'Black Forest', fire_pit: 'Meadows', hearth: 'Black Forest', piece_cookingstation: 'Meadows',
  piece_cookingstation_iron: 'Swamp', piece_cauldron: 'Black Forest', fermenter: 'Swamp', piece_oven: 'Mistlands',
  piece_workbench: 'Meadows', piece_workbench_ext1: 'Meadows', piece_workbench_ext2: 'Black Forest', piece_workbench_ext3: 'Black Forest',
  forge: 'Black Forest', forge_ext1: 'Black Forest', forge_ext2: 'Black Forest', forge_ext3: 'Swamp', smelter: 'Black Forest',
  charcoal_kiln: 'Black Forest', piece_stonecutter: 'Black Forest', piece_spinningwheel: 'Plains', piece_artisanstation: 'Mountain',
  rug_deer: 'Meadows', rug_wolf: 'Mountain', rug_fur: 'Plains', rug_hare: 'Mistlands', rug_straw: 'Meadows', jute_carpet: 'Mistlands',
  itemstand: 'Meadows', itemstandh: 'Meadows', ArmorStand: 'Swamp', sign: 'Meadows', piece_banner01: 'Plains', piece_banner02: 'Plains',
  piece_banner05: 'Plains', piece_groundtorch_wood: 'Meadows', piece_groundtorch: 'Swamp', piece_walltorch: 'Black Forest',
  piece_brazierceiling01: 'Black Forest', piece_dvergr_lantern: 'Mistlands', Candle_resin: 'Black Forest', wood_stack: 'Meadows',
  wood_fine_stack: 'Meadows', wood_core_stack: 'Black Forest', stone_pile: 'Meadows', coal_pile: 'Black Forest',
  wood_dragon1: 'Meadows', darkwood_raven: 'Swamp', darkwood_wolf: 'Swamp', piece_jackoturnip: 'Swamp', piece_xmastree: 'Meadows',
  piece_beehive: 'Meadows', piece_bathtub: 'Black Forest', guard_stone: 'Black Forest',
};
const ORDER = ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains', 'Mistlands', 'Ashlands'];
const ok = (name, biome) => ORDER.indexOf(ITEM_BIOME[name] || 'Meadows') <= ORDER.indexOf(biome);
// best available of a list for the biome (lists are worst to best)
const best = (list, biome) => list.filter(n => ok(n, biome)).pop() || list[0];

// Plans per room use and stage. Each entry: [place, items (worst to best), count or [min,max] per 20 m2]
// place: wall, mount, centre, fire, bed. Counts come from the corpus per-100 m2 rates, rounded for one room.
const PLANS = {
  home: {
    d1: [['bed', ['bed', 'piece_bed02'], 1], ['wall', ['piece_chest_wood', 'piece_chest'], 1], ['fire', ['fire_pit'], 1]],
    d2: [['table', ['piece_table', 'piece_table_oak'], 1], ['rug', ['rug_deer', 'rug_wolf', 'rug_fur'], 1], ['wall', ['piece_chest_wood', 'piece_chest_barrel'], 1],
      ['light', ['piece_groundtorch_wood', 'piece_groundtorch'], 1], ['mount', ['itemstand'], 1], ['wall', ['wood_stack'], 0.5]],
    d3: [['mount', ['itemstand', 'itemstandh'], 2], ['wall', ['piece_cauldron'], 0.6], ['wall', ['ArmorStand'], 0.5], ['mount', ['piece_banner01', 'piece_banner02'], 1],
      ['rug', ['rug_deer', 'rug_wolf', 'rug_fur'], 1], ['wall', ['piece_chest_barrel', 'fermenter'], 0.6], ['mount', ['sign'], 0.4], ['wall', ['wood_fine_stack'], 0.5]],
  },
  hall: {
    d1: [['fire', ['fire_pit', 'hearth'], 1], ['table', ['piece_table', 'piece_table_oak'], 1], ['wall', ['piece_chest_wood', 'piece_chest'], 1]],
    d2: [['table', ['piece_table', 'piece_table_oak'], 1], ['wall', ['piece_cauldron', 'fermenter'], 1], ['light', ['piece_groundtorch_wood', 'piece_groundtorch', 'piece_brazierceiling01'], 2],
      ['rug', ['rug_deer', 'rug_wolf', 'rug_fur'], 1], ['end', ['piece_throne01'], 1], ['wall', ['piece_chest_barrel'], 1]],
    d3: [['mount', ['piece_banner01', 'piece_banner02', 'piece_banner05'], 3], ['mount', ['itemstand', 'itemstandh'], 3], ['wall', ['ArmorStand'], 1],
      ['wall', ['darkwood_raven', 'darkwood_wolf'], 1], ['rug', ['rug_wolf', 'rug_fur'], 2], ['wall', ['fermenter'], 1], ['mount', ['sign'], 0.5]],
  },
  smithy: {
    d1: [['wall', ['forge'], 1], ['wall', ['piece_workbench'], 1], ['wall', ['piece_chest_wood', 'piece_chest'], 1]],
    d2: [['wall', ['forge_ext1', 'forge_ext2'], 1], ['wall', ['smelter'], 1], ['wall', ['charcoal_kiln'], 0.6], ['wall', ['piece_workbench_ext1'], 1], ['light', ['piece_groundtorch_wood', 'piece_groundtorch'], 1]],
    d3: [['wall', ['ArmorStand'], 1], ['mount', ['itemstand', 'itemstandh'], 2], ['wall', ['coal_pile', 'wood_core_stack'], 1], ['rug', ['rug_deer'], 0.5], ['mount', ['sign'], 0.5], ['wall', ['forge_ext3'], 0.5]],
  },
  workshop: {
    d1: [['wall', ['piece_workbench'], 1], ['wall', ['piece_chest_wood'], 1], ['wall', ['wood_stack'], 1]],
    d2: [['wall', ['piece_workbench_ext1', 'piece_workbench_ext2'], 1], ['wall', ['wood_fine_stack', 'wood_core_stack'], 1], ['wall', ['piece_stonecutter'], 0.5], ['light', ['piece_groundtorch_wood'], 1], ['seat', ['piece_logbench01', 'piece_bench01'], 0.6]],
    d3: [['wall', ['piece_workbench_ext3'], 0.6], ['mount', ['itemstand', 'itemstandh'], 2], ['wall', ['wood_stack', 'wood_core_stack'], 1], ['mount', ['sign'], 0.5], ['wall', ['piece_chest_barrel'], 0.6]],
  },
  farm: {
    d1: [['wall', ['piece_chest_wood'], 1]],
    d2: [['wall', ['piece_chest_barrel', 'piece_chest_wood'], 1], ['wall', ['wood_stack'], 0.6], ['light', ['piece_groundtorch_wood'], 0.5], ['wall', ['fermenter'], 0.4]],
    d3: [['mount', ['itemstand'], 1], ['wall', ['piece_cauldron'], 0.5], ['mount', ['sign'], 0.5], ['seat', ['piece_bench01'], 0.6], ['rug', ['rug_straw', 'rug_deer'], 0.5]],
  },
  storage: {
    d1: [['wall', ['piece_chest_wood', 'piece_chest'], 3]],
    d2: [['wall', ['piece_chest_barrel', 'piece_chest_wood'], 2], ['wall', ['wood_stack', 'wood_fine_stack'], 1], ['light', ['piece_groundtorch_wood'], 0.5]],
    d3: [['wall', ['piece_chest', 'piece_chest_blackmetal'], 2], ['mount', ['sign'], 1], ['wall', ['coal_pile', 'stone_pile'], 0.6]],
  },
  guard: {
    d1: [['wall', ['piece_chest_wood'], 1], ['light', ['piece_groundtorch_wood'], 0.6]],
    d2: [['bed', ['bed', 'piece_bed02'], 1], ['mount', ['itemstand'], 1], ['light', ['piece_brazierceiling01', 'piece_groundtorch'], 0.5]],
    d3: [['wall', ['ArmorStand'], 1], ['mount', ['piece_banner01', 'piece_banner02'], 1], ['mount', ['itemstandh'], 1]],
  },
  market: {
    d1: [['table', ['piece_table'], 1], ['wall', ['piece_chest_wood'], 1]],
    d2: [['wall', ['piece_chest_barrel'], 1], ['mount', ['sign'], 1], ['wall', ['wood_stack', 'stone_pile'], 0.6]],
    d3: [['mount', ['piece_banner01', 'piece_banner05'], 1], ['light', ['piece_groundtorch_wood'], 1], ['mount', ['itemstand'], 1]],
  },
  temple: {
    d1: [['end', ['piece_table', 'piece_table_oak'], 1], ['light', ['piece_groundtorch_wood', 'piece_brazierceiling01'], 2]],
    d2: [['seat', ['piece_bench01'], 2], ['mount', ['piece_banner01', 'piece_banner02'], 2], ['end', ['Candle_resin'], 1]],
    d3: [['wall', ['darkwood_raven', 'darkwood_wolf'], 2], ['mount', ['itemstand', 'itemstandh'], 2], ['rug', ['rug_wolf', 'rug_fur'], 1]],
  },
  yard: { d1: [], d2: [], d3: [] },
};

const ESSENTIAL = /^(bed|piece_bed02|ashwood_bed|piece_chest_wood|piece_chest|hearth|fire_pit|forge|piece_workbench|piece_cookingstation|smelter|portal_wood)$/;

function quatY(yaw) { const a = yaw * Math.PI / 360; return [0, +Math.sin(a).toFixed(6), 0, +Math.cos(a).toFixed(6)]; }
function yawOf(q) { const [x, y, z, w] = q; return Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + x * x)) * 180 / Math.PI; }
function rel(name) { return (RULES && RULES.placement && RULES.placement[name] && RULES.placement[name].rel) || 0; }
function lift(name, def) {
  const l = RULES && RULES.placement && RULES.placement[name] && RULES.placement[name].lift;
  return l != null && l > 0.9 && l < 3 ? l : def;
}

// Occupancy on a 0.5 m grid per floor level.
class Occ {
  constructor() { this.s = new Set(); }
  key(x, z, y) { return `${Math.round(x * 2)},${Math.round(z * 2)},${Math.round(y)}`; }
  fits(x, z, y, w, d, yaw) {
    for (const [cx, cz] of this.cells(x, z, w, d, yaw)) if (this.s.has(this.key(cx, cz, y))) return false;
    return true;
  }
  add(x, z, y, w, d, yaw) { for (const [cx, cz] of this.cells(x, z, w, d, yaw)) this.s.add(this.key(cx, cz, y)); }
  cells(x, z, w, d, yaw) {
    const out = [], a = yaw * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
    const ex = (w * c + d * s) / 2, ez = (w * s + d * c) / 2;
    for (let i = x - ex + 0.25; i < x + ex; i += 0.5) for (let j = z - ez + 0.25; j < z + ez; j += 0.5) out.push([i, j]);
    if (!out.length) out.push([x, z]);
    return out;
  }
}

// Rooms of a generated building are rectangles; slots run along each wall, inset by the item's depth.
function slotsForRect(room) {
  const slots = [];
  const { x0, x1, z0, z1, y } = room;
  const door = room.door;
  const along = (a0, a1, fixed, axis, inwardYaw) => {
    for (let a = a0 + 0.8; a <= a1 - 0.8 + 0.01; a += 1) {
      const x = axis === 'x' ? a : fixed, z = axis === 'x' ? fixed : a;
      if (door && Math.abs(z - door.z) < 0.1 && Math.abs(x - door.x) < 1.7) continue;
      if (room.hole && Math.abs(x - room.hole[0]) < 1.6 && Math.abs(z - room.hole[1]) < 1.6) continue;
      slots.push({ x, z, y, yaw: inwardYaw, nx: Math.sin(inwardYaw * Math.PI / 180), nz: Math.cos(inwardYaw * Math.PI / 180) });
    }
  };
  along(x0, x1, z0, 'x', 0); along(x0, x1, z1, 'x', 180); along(z0, z1, x0, 'z', 90); along(z0, z1, x1, 'z', 270);
  return slots;
}

function decorate(b, ctx) {
  const R = ctx.R || Math.random;
  const occ = new Occ();
  // structure blocks the grid where posts stand inside rooms
  for (const p of b.pieces) {
    const info = P.piece(p.name);
    if (info.role === 'pole') occ.add(p.x, p.z, Math.round(p.y - 1), 0.4, 0.4, 0);
  }
  for (const room of b.rooms) {
    if (room.door) occ.add(room.door.x, room.door.z + 1.2, room.y, 1.8, 2.4, 0); // keep the way in clear
    if (room.upper && ctx.use === 'hall') continue;
    furnishRoom(b, room, room.upper ? (ctx.use === 'home' ? 'home' : ctx.use) : ctx.use, ctx.decor, ctx.biome, R, occ, ctx, room.upper);
  }
  return b;
}

function furnishRoom(b, room, use, decor, biome, R, occ, ctx, upper) {
  const plan = PLANS[use] || PLANS.home;
  const stages = decor === 'd1' ? ['d1'] : decor === 'd2' ? ['d1', 'd2'] : ['d1', 'd2', 'd3'];
  const area = (room.x1 - room.x0) * (room.z1 - room.z0);
  const scale = Math.max(1, area / 20);
  const slots = room.slots || slotsForRect(room);
  // shuffle slots by seed, but keep back-wall slots first for stations
  slots.sort((a, b2) => (b2.z - a.z) * 0.3 + (R() - 0.5));
  const y = room.y;
  const cx = (room.x0 + room.x1) / 2, cz = (room.z0 + room.z1) / 2;
  const place = (name, x, yy, z, yaw) => {
    b.pieces.push({ name, x: +x.toFixed(3), y: +yy.toFixed(3), z: +z.toFixed(3), q: quatY(yaw), yaw, decor: true });
  };
  const putWall = (name, mount) => {
    const info = P.piece(name);
    const [w, h, d] = info.size;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (s.used && !mount) continue;
      if (mount && s.mounted) continue;
      const inset = mount ? 0.15 : d / 2 + 0.15;
      const x = s.x + s.nx * inset, z = s.z + s.nz * inset;
      const yaw = (s.yaw + rel(name) + 360) % 360;
      if (!mount && !occ.fits(x, z, y, w, Math.max(d, 0.5), yaw)) continue;
      if (mount) { s.mounted = true; place(name, x, y + Math.min(lift(name, 1.7), (room.h || 2.4) - 0.5), z, yaw); return true; }
      s.used = true; occ.add(x, z, y, w, Math.max(d, 0.5), yaw); place(name, x, y + 0.1, z, yaw);
      return true;
    }
    return false;
  };
  const putCentre = (name, x, z, yaw) => {
    const info = P.piece(name), [w, , d] = info.size;
    if (!occ.fits(x, z, y, w, d, yaw)) return false;
    occ.add(x, z, y, w, d, yaw); place(name, x, y + (info.role === 'rug' ? 0.05 : 0.1), z, yaw); return true;
  };
  const longX = (room.x1 - room.x0) >= (room.z1 - room.z0);
  for (const st of stages) {
    for (const [kind, list, per] of plan[st] || []) {
      const name = best(list, biome);
      if (!ok(name, biome) && kind !== 'fire') continue;
      let n = per * (kind === 'wall' || kind === 'mount' ? scale : 1);
      n = Math.floor(n) + (R() < n - Math.floor(n) ? 1 : 0);
      if (kind === 'bed') n = Math.max(1, Math.round(scale * 0.6));
      for (let k = 0; k < n; k++) {
        if (kind === 'wall') putWall(name, false);
        else if (kind === 'mount' || kind === 'light' && /brazierceiling|walltorch/.test(name)) putWall(name, true);
        else if (kind === 'bed') putWall(name, false);
        else if (kind === 'fire') {
          if (upper) break;
          const fx = use === 'home' ? (ctx.doorX ?? 0) : cx, fz = use === 'home' ? cz + 0.5 : cz;
          const fire = use === 'hall' && ok('hearth', biome) ? 'hearth' : name;
          if (putCentre(fire, fx, fz, 0)) {
            if (decor !== 'd1' || use === 'hall') place(ok('piece_cookingstation_iron', biome) && use === 'hall' ? 'piece_cookingstation_iron' : 'piece_cookingstation', fx, y + 0.5, fz, 0);
            occ.add(fx, fz, y, 3.5, 3.5, 0);
          }
        } else if (kind === 'table') {
          // table group: along the long axis, seats on both long sides (corpus groups: chairs 0.9 to 1 m out)
          const tx = longX ? cx + (use === 'hall' ? 0 : (R() - 0.5) * 2) : cx, tz = longX ? cz + (use === 'hall' ? (k % 2 ? 2.2 : -2.2) : -0.6) : cz;
          const yaw = longX ? 0 : 90;
          if (use === 'hall' && k === 0 && b.rooms[0] === room) { /* fire in the middle: tables beside it */ }
          if (!putCentre(name, use === 'hall' ? tx + (k ? 0 : 0) : tx, use === 'hall' ? cz + (k % 2 ? 2.4 : -2.4) : tz, yaw)) continue;
          const tzz = use === 'hall' ? cz + (k % 2 ? 2.4 : -2.4) : tz;
          const seat = use === 'hall' ? best(['piece_bench01'], biome) : best(['piece_chair', 'piece_chair03'], biome);
          const off = use === 'hall' ? 0.9 : 0.95;
          for (const sgn of [-1, 1]) {
            const sx = longX ? tx : tx + sgn * off, sz = longX ? tzz + sgn * off : tzz;
            const syaw = longX ? (sgn < 0 ? 0 : 180) : (sgn < 0 ? 90 : 270);
            putCentre(seat, sx, sz, (syaw + rel(seat)) % 360);
          }
        } else if (kind === 'rug') {
          const rx = cx + (R() - 0.5) * (room.x1 - room.x0) * 0.4, rz = cz + (R() - 0.5) * (room.z1 - room.z0) * 0.3;
          place(name, rx, y + 0.02, rz, longX ? 0 : 90);
        } else if (kind === 'light') {
          const a = R() * 2 * Math.PI;
          putCentre(name, cx + Math.cos(a) * (room.x1 - room.x0) * 0.35, cz + Math.sin(a) * (room.z1 - room.z0) * 0.35, 0) || putWall(name, false);
        } else if (kind === 'seat') {
          putWall(name, false);
        } else if (kind === 'end') {
          // far end of the long axis, facing the door
          const ex = longX ? room.x1 - 1.4 : cx, ez = longX ? cz : room.z1 - 1.4;
          putCentre(name, ex, ez, longX ? 270 : 180);
        }
      }
    }
  }
}

// ---------------------------------------------------------------- existing blueprints

// Strip a design to d1: keep structure and the essentials (first bed per 25 m2, one chest, fires and main stations).
function strip(pieces) {
  const keep = [], counts = {};
  for (const p of pieces) {
    const info = P.piece(p.name);
    if (info.structural || info.role === 'nature' || info.role === 'misc') { keep.push(p); continue; }
    if (ESSENTIAL.test(p.name)) {
      const k = /bed/.test(p.name) ? 'bed' : /chest/.test(p.name) ? 'chest' : p.name;
      counts[k] = (counts[k] || 0) + 1;
      if (k === 'chest' && counts[k] > 2) continue;
      keep.push(p);
    }
  }
  return keep;
}

// Find rooms in any blueprint: floor levels, wall slots along real walls, free floor in the middle.
function findRooms(pieces) {
  const floors = pieces.filter(p => P.piece(p.name).role === 'floor');
  const walls = pieces.filter(p => ['wall', 'door', 'window'].includes(P.piece(p.name).role));
  const levels = {};
  for (const f of floors) { const k = Math.round(f.y * 2) / 2; (levels[k] = levels[k] || []).push(f); }
  const rooms = [];
  for (const [ky, fl] of Object.entries(levels)) {
    if (fl.length < 4) continue;
    const y = +ky;
    const xs = fl.map(f => f.x).sort((a, b) => a - b), zs = fl.map(f => f.z).sort((a, b) => a - b);
    const q = (a, t) => a[Math.min(a.length - 1, Math.floor(a.length * t))];
    const room = { x0: q(xs, 0.03) - 1, x1: q(xs, 0.97) + 1, z0: q(zs, 0.03) - 1, z1: q(zs, 0.97) + 1, y: y + 0.1, slots: [] };
    const cx = (room.x0 + room.x1) / 2, cz = (room.z0 + room.z1) / 2;
    const covered = (x, z) => fl.some(f => Math.abs(f.x - x) <= 1.05 && Math.abs(f.z - z) <= 1.05);
    for (const w of walls) {
      if (w.y < y || w.y > y + 2.6) continue;
      const yaw = yawOf(w.q || [0, 0, 0, 1]);
      const a = yaw * Math.PI / 180, ux = Math.cos(a), uz = -Math.sin(a);
      const half = P.piece(w.name).size[0] / 2;
      for (let t = -half + 0.5; t <= half - 0.5 + 0.01; t += 1) {
        const px = w.x + ux * t, pz = w.z + uz * t;
        // inward normal: the side of the wall facing the room centre
        let nx = -uz, nz = ux;
        if ((cx - px) * nx + (cz - pz) * nz < 0) { nx = -nx; nz = -nz; }
        const sx = px + nx * 0.6, sz = pz + nz * 0.6;
        if (!covered(sx, sz)) continue;
        room.slots.push({ x: px, z: pz, y: room.y, yaw: Math.atan2(nx, nz) * 180 / Math.PI, nx, nz });
      }
    }
    if (room.slots.length >= 4) rooms.push(room);
  }
  rooms.sort((a, b) => a.y - b.y);
  return rooms;
}

// Decorate an existing design to d2 or d3. Existing decor stays; new pieces fill free wall slots and floor.
function decorateExisting(pieces, { use = 'home', decor = 'd2', biome = 'Meadows', seed = 1 } = {}) {
  let s = seed >>> 0 || 1;
  const R = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const b = { pieces: pieces.map(p => ({ ...p })), rooms: findRooms(pieces) };
  const occ = new Occ();
  for (const p of pieces) {
    const info = P.piece(p.name);
    if (info.structural && info.role !== 'floor' && info.role !== 'roof' && info.role !== 'beam') occ.add(p.x, p.z, Math.round(p.y - 1), Math.min(info.size[0], 2), Math.min(info.size[2], 2), yawOf(p.q || [0, 0, 0, 1]));
    if (!info.structural) occ.add(p.x, p.z, Math.round(p.y), info.size[0], info.size[2], yawOf(p.q || [0, 0, 0, 1]));
  }
  b.rooms.forEach((room, i) => furnishRoom(b, room, i === 0 ? use : (use === 'hall' ? 'home' : use), decor, biome, R, occ, {}, i > 0));
  return b.pieces;
}

const api = { decorate, strip, findRooms, decorateExisting, setRules, PLANS, ITEM_BIOME };
if (NODE_D) module.exports = api; else window.VHDecorate = api;
