// Floorplans: one room furnished by the decorator and shown without walls or roof, so the layout can be judged from
// above. The decorator works in a full temporary room (floor, walls with a door and windows, a ceiling); the plan
// keeps the floor, a low curb where walls stand, a rail where windows are, the door, the ladder, full wall stubs only
// where something hangs, and a post with a sign that carries the plan's ID (FP-001).
//
// floorplan({ shape, w, d, room, biome, culture, decor, seed, id, ladder }) gives { pieces, sign, summary, ... }.
// set(n) lays the first n plans of the catalog out in a grid, IDs FP-001 on, the same IDs as the review sheet's
// Floorplans tab. Shapes: rect, L, octagon (round), long (a hall with two rows of posts).
// Rooms: home, sleeping, hall, tavern, kitchen, smithy, workshop, temple, storage.

const NODE_FP = typeof module !== 'undefined';
const DF = NODE_FP ? require('./decorate.js') : window.VHDecorate;
const SF = NODE_FP ? require('./styles.js') : window.VHStyles;
const BF = NODE_FP ? require('./blueprint.js') : window.VHBlueprint;

const SHAPES = ['rect', 'L', 'octagon', 'long'];
const ROOMS = {
  home: { use: 'home', type: 'home', fire: true },
  sleeping: { use: 'home', type: 'home', role: 'sleeping' },
  hall: { use: 'hall', type: 'longhouse', fire: true },
  tavern: { use: 'hall', type: 'tavern', fire: true },
  kitchen: { use: 'home', type: 'home', role: 'kitchen' },
  smithy: { use: 'smithy', type: 'smithy' },
  workshop: { use: 'workshop', type: 'workshop' },
  temple: { use: 'hall', type: 'temple', role: 'temple' },
  storage: { use: 'storage', type: 'storage' },
};
const BIOME_CODES = { md: 'Meadows', bf: 'Black Forest', sw: 'Swamp', mt: 'Mountain', pl: 'Plains', ml: 'Mistlands', al: 'Ashlands', dn: 'Deep North' };

function rngFP(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const quatFP = yaw => { const a = yaw * Math.PI / 360; return [0, +Math.sin(a).toFixed(6), 0, +Math.cos(a).toFixed(6)]; };

// Floor cells (2 m) of a shape, centered on 0, 0.
function cellsOf(shape, w, d) {
  const W = Math.max(2, Math.round(w / 2)), D = Math.max(2, Math.round(d / 2));
  const out = [];
  for (let i = 0; i < W; i++) for (let j = 0; j < D; j++) {
    const x = -W + 1 + 2 * i, z = -D + 1 + 2 * j;
    if (shape === 'L' && i >= Math.ceil(W / 2) && j >= Math.ceil(D / 2)) continue;
    if (shape === 'octagon') {
      const R = Math.min(W, D);
      if (Math.abs(x) + Math.abs(z) > R * 1.42 - 0.5) continue;
    }
    out.push([x, z]);
  }
  return { cells: out, W, D };
}

// 'vh floorplan template RT-0001 [biome]': one room template laid out as it is, in a plain room of its size (rounded up
// to the 2 m floor), its fire where the template has it, nothing added, so a room scored in the Rooms tab can be walked
// through. The biome defaults to the Deep North, where every piece can be made.
const KIND_ROOM = { home: 'home', sleeping: 'sleeping', hall: 'hall', tavern: 'tavern', kitchen: 'kitchen', smithy: 'smithy', workshop: 'workshop',
  temple: 'temple', storage: 'storage', living: 'home', other: 'home' };
function templatePlan(id, biome) {
  const t = DF.templateById(id);
  if (!t) throw new Error(`no room template ${id}`);
  const w = Math.max(4, 2 * Math.ceil((t.W - 0.1) / 2)), d = Math.max(4, 2 * Math.ceil((t.D - 0.1) / 2));
  return { shape: 'rect', w, d, room: KIND_ROOM[t.kind] || 'home', biome: biome || 'dn', decor: 'd3', seed: 1, id: t.id, template: t };
}

function floorplan(spec) {
  const shape = SHAPES.includes(spec.shape) ? spec.shape : 'rect';
  const roomKind = ROOMS[spec.room] ? spec.room : 'home';
  const R0 = ROOMS[roomKind];
  const biome = BIOME_CODES[String(spec.biome || '').toLowerCase()] || (SF.BIOMES.concat(['Deep North']).includes(spec.biome) ? spec.biome : 'Meadows');
  const seed = +spec.seed || 1;
  const R = rngFP(seed * 7919 + 13);
  const culture = SF.CULTURES[spec.culture] ? spec.culture : SF.cultureFor(biome === 'Deep North' ? 'Mountain' : biome, rngFP(seed * 104729 + 7));
  const decor = ['d1', 'd2', 'd3'].includes(spec.decor) ? spec.decor : 'd2';
  const w = shape === 'long' ? Math.max(spec.w || 20, 2 * (spec.d || 8)) : spec.w || 10, dpt = spec.d || 8;
  const { cells, W, D } = cellsOf(shape, w, dpt);
  const key = new Set(cells.map(([x, z]) => `${x},${z}`));
  const H = 3;
  const shell = [], keep = [];
  const put = (list, name, x, y, z, yaw = 0, extra) => list.push({ name, x: +x.toFixed(3), y: +y.toFixed(3), z: +z.toFixed(3), q: quatFP(yaw), yaw, ...(extra || {}) });
  for (const [x, z] of cells) { put(keep, 'wood_floor', x, 0, z); put(shell, 'wood_floor', x, H, z); }
  // walls on every outside edge; the door on the front edge nearest the middle; windows on every other edge
  const edges = [];
  for (const [x, z] of cells) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (key.has(`${x + 2 * dx},${z + 2 * dz}`)) continue;
    edges.push({ x: x + dx, z: z + dz, yaw: dx ? 90 : 0, out: [dx, dz] });
  }
  const front = edges.filter(e => e.out[1] < 0).sort((a, b) => Math.abs(a.x) - Math.abs(b.x) || a.z - b.z);
  const door = front[0] || edges[0];
  for (const e of edges) {
    e.kind = e === door ? 'door' : (Math.round((e.x + e.z) / 2) % 2 === 0 && Math.hypot(e.x - door.x, e.z - door.z) > 2.5 ? 'window' : 'wall');
    if (e.kind === 'door') { put(keep, 'wood_door', e.x, 1, e.z, e.yaw); put(shell, 'woodwall', e.x, 2.5, e.z, e.yaw); }
    else if (e.kind === 'window') { put(shell, 'wood_wall_half', e.x, 0.5, e.z, e.yaw); put(shell, 'wood_wall_half', e.x, 2.5, e.z, e.yaw); }
    else { put(shell, 'woodwall', e.x, 1, e.z, e.yaw); put(shell, 'wood_wall_half', e.x, 2.5, e.z, e.yaw); }
  }
  // a long hall has two rows of posts, two cells in from the long walls
  if (shape === 'long' && D >= 3) for (let x = -W + 2; x <= W - 2; x += 2) for (const z of [-(D - 2), D - 2]) put(keep, 'wood_pole2', x, 1, z);
  // a ladder in the back corner when asked (it shows the way kept clear to it)
  if (spec.ladder) {
    const corner = cells.slice().sort((a, b) => (b[0] + b[1]) - (a[0] + a[1]))[0];
    put(keep, 'wood_stepladder', corner[0], 0, corner[1] - 0.5, 180);
  }
  const b = { pieces: [...keep, ...shell], rooms: [{ x0: -W, x1: W, z0: -D, z1: D, y: 0, h: H, use: R0.use, upper: false, main: true, door: { x: door.x, z: door.z } }], notes: [] };
  if (shape === 'L') {
    const wx = 2 * Math.ceil(W / 2) - W, dz = 2 * Math.ceil(D / 2) - D;
    b.rooms = [{ ...b.rooms[0], z1: -D + 2 * Math.ceil(D / 2) - 0 }, { ...b.rooms[0], x1: -W + 2 * Math.ceil(W / 2), main: false, door: null }];
    void wx; void dz;
  }
  const tp = spec.template || null;
  const fireAt = tp ? (tp.fire ? { x: Math.round(tp.fire[0] * (2 * W) / tp.W), z: Math.round(tp.fire[1] * (2 * D) / tp.D) } : null) : R0.fire ? (() => { const c = cells.slice().sort((a, b2) => Math.hypot(a[0], a[1]) - Math.hypot(b2[0], b2[1]))[0]; return { x: c[0], z: c[1] }; })() : null;
  DF.decorate(b, { use: R0.use, type: R0.type, role: tp ? (R0.role || roomKind) : R0.role, decor, biome, culture, R, doorX: door.x, fireAt, usedTemplates: spec.used,
    ...(tp ? { forceTemplate: tp.id, templateOnly: true } : {}) });
  const template = (b.decorReport || []).map(r => r.template).filter(Boolean).join(' ');
  const furniture = b.pieces.filter(p => p.decor && !p.outside);
  // keep a full wall wherever something hangs on it, so nothing floats
  const F = DF.FURNITURE;
  const hung = furniture.filter(p => { const f = F[p.name] || {}; return f.at === 'mount' || (p.name === 'itemstandh' && p.y > 0.6 && !furniture.some(t => (F[t.name] || {}).cat === 'table' && Math.hypot(t.x - p.x, t.z - p.z) < 2.2 && Math.abs(t.y + 0.75 - p.y) < 0.2)); });
  const stubs = new Set();
  for (const p of hung) {
    let bestE = null, bd = 1.2;
    for (const e of edges) { const dd = Math.hypot(p.x - e.x, p.z - e.z); if (dd < bd && e.kind !== 'door') { bd = dd; bestE = e; } }
    if (bestE) stubs.add(bestE);
  }
  const out = [...keep];
  for (const e of edges) {
    if (e.kind === 'door') continue;
    if (stubs.has(e)) { put(out, 'woodwall', e.x, 1, e.z, e.yaw); put(out, 'wood_wall_half', e.x, 2.5, e.z, e.yaw); }
    else if (e.kind === 'window') put(out, 'wood_fence', e.x, 0.5, e.z, e.yaw);
    // a low curb where the wall stands: a 2 m beam lying on the floor, 0.2 m high (wood_wall_quarter is a 1 x 1 m piece)
    else put(out, 'wood_beam', e.x, 0.1, e.z, e.yaw);
  }
  // hanging braziers need the ceiling the plan leaves out
  for (const p of furniture) if ((F[p.name] || {}).at !== 'hang') out.push(p);
  // the ID: a post at the front left corner, outside, with two signs back to back so it reads from either side
  const sx = -W - 1, sz = -D - 1;
  put(out, 'wood_pole2', sx, 1, sz);
  put(out, 'sign', sx, 1.5, sz - 0.15, 180, { idSign: true });
  put(out, 'sign', sx, 1.5, sz + 0.15, 0, { idSign: true });
  const counts = {};
  for (const p of furniture) { const n = p.name.replace(/^piece_/, ''); counts[n] = (counts[n] || 0) + 1; }
  const area = cells.length * 4;
  const items = furniture.filter(p => (F[p.name] || {}).at !== 'rug').length;
  const id = spec.id || 'FP-000';
  const bcode = Object.keys(BIOME_CODES).find(k => BIOME_CODES[k] === biome);
  const command = tp ? `vh floorplan template ${tp.id} ${bcode}` : `vh floorplan ${shape} ${w}x${dpt} ${roomKind} ${bcode} ${culture} ${decor} ${seed}${spec.ladder ? ' ladder' : ''}`;
  return {
    id, command, shape, w, d: dpt, room: roomKind, biome, culture, decor, seed, area, template,
    perTenM2: +(items / area * 10).toFixed(2), items,
    summary: Object.entries(counts).sort((a, c) => c[1] - a[1]).map(([n, c]) => `${n} ${c}`).join(', '),
    pieces: out, sign: { text: tp ? `${id} ${tp.kind} ${tp.W}x${tp.D}` : `${id} ${roomKind} ${w}x${dpt} ${decor}` },
  };
}

// The catalog behind 'vh floorplan set': every room, every shape, three decor stages, seven biomes.
const CATALOG = [
  ['rect', 10, 8, 'home', 'md', 'norse', 'd2'], ['rect', 10, 8, 'home', 'md', 'norse', 'd3'],
  ['L', 12, 10, 'home', 'bf', 'norse-forest', 'd2'], ['octagon', 10, 10, 'home', 'sw', 'celtic-crannog', 'd2'],
  ['rect', 8, 6, 'sleeping', 'bf', 'slavic', 'd2'], ['rect', 12, 8, 'sleeping', 'mt', 'norse-highland', 'd3', true],
  ['long', 20, 8, 'hall', 'bf', 'norse-forest', 'd2'], ['long', 24, 10, 'hall', 'sw', 'fen-folk', 'd3'],
  ['rect', 14, 10, 'tavern', 'pl', 'byzantine', 'd2'], ['L', 16, 12, 'tavern', 'md', 'anglo-saxon', 'd3'],
  ['rect', 8, 6, 'kitchen', 'bf', 'celtic', 'd2'], ['rect', 10, 8, 'kitchen', 'mt', 'norse-highland', 'd3'],
  ['rect', 10, 8, 'smithy', 'bf', 'norse-forest', 'd2'], ['octagon', 10, 10, 'smithy', 'pl', 'steppe', 'd3'],
  ['rect', 10, 8, 'workshop', 'md', 'frankish-norman', 'd2'], ['L', 12, 10, 'workshop', 'sw', 'baltic', 'd3'],
  ['rect', 12, 8, 'temple', 'mt', 'norse-highland', 'd2'], ['octagon', 12, 12, 'temple', 'ml', 'byzantine', 'd3'],
  ['rect', 8, 6, 'storage', 'sw', 'fen-folk', 'd2'], ['rect', 10, 8, 'storage', 'pl', 'middle-eastern', 'd3'],
  ['rect', 6, 6, 'home', 'md', 'anglo-saxon', 'd1'], ['octagon', 8, 8, 'home', 'mt', 'saami', 'd2'],
  ['rect', 14, 10, 'home', 'pl', 'middle-eastern', 'd3'], ['rect', 12, 10, 'home', 'ml', 'lamari', 'd3', true],
];
const catalogSpec = i => {
  const [shape, w, d, room, biome, culture, decor, ladder] = CATALOG[i];
  return { shape, w, d, room, biome, culture, decor, ladder: !!ladder, seed: 101 + i, id: 'FP-' + String(i + 1).padStart(3, '0') };
};

// One plan, or several in a grid four to a row, as one blueprint. Each plan sits in its own box (its pieces plus
// half a meter), 2 m from the next. The first row is the front (lowest z), plan 1 at its left; each row is centered
// on x = 0. 'pads' gives each plan's box and middle in the game's centered coordinates, and floorY the height of the
// floors there, so the game can set each plan on the ground under it.
const GAP_FP = 2, MARGIN_FP = 0.5, COLS_FP = 4;
function layout(plans) {
  const pieces = [], signs = [], pads = [];
  const boxes = plans.map(p => {
    const xs = p.pieces.map(q => q.x), zs = p.pieces.map(q => q.z);
    return { x0: Math.min(...xs) - MARGIN_FP, x1: Math.max(...xs) + MARGIN_FP, z0: Math.min(...zs) - MARGIN_FP, z1: Math.max(...zs) + MARGIN_FP };
  });
  let rowZ = 0;
  for (let first = 0; first < plans.length; first += COLS_FP) {
    const row = [...Array(Math.min(COLS_FP, plans.length - first)).keys()].map(k => first + k);
    const width = row.reduce((a, i) => a + boxes[i].x1 - boxes[i].x0, 0) + GAP_FP * (row.length - 1);
    const depth = Math.max(...row.map(i => boxes[i].z1 - boxes[i].z0));
    let x = -width / 2;
    for (const i of row) {
      const p = plans[i], b = boxes[i];
      const ox = x - b.x0, oz = rowZ - b.z0;
      pads.push({ id: p.id, x: ox, z: oz, r: Math.hypot(b.x1 - b.x0, b.z1 - b.z0) / 2, x0: b.x0 + ox, x1: b.x1 + ox, z0: b.z0 + oz, z1: b.z1 + oz });
      for (const q of p.pieces) {
        const c = { ...q, x: +(q.x + ox).toFixed(3), z: +(q.z + oz).toFixed(3) };
        delete c.decor; delete c.idSign; delete c.outside;
        pieces.push(c);
        if (q.idSign) signs.push({ x: c.x, y: c.y, z: c.z, text: p.sign.text, id: p.id });
      }
      x += b.x1 - b.x0 + GAP_FP;
    }
    rowZ += depth + GAP_FP;
  }
  // the game centers a blueprint on the middle of its pieces and its lowest piece: the signs and boxes, the same way
  const xs = pieces.map(p => p.x), zs = pieces.map(p => p.z), ys = pieces.map(p => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2, y0 = Math.min(...ys);
  const r3 = v => +v.toFixed(3);
  for (const s of signs) { s.lx = r3(s.x - cx); s.ly = r3(s.y - y0); s.lz = r3(s.z - cz); }
  for (const p of pads) {
    p.x = r3(p.x - cx); p.z = r3(p.z - cz);
    p.x0 = r3(p.x0 - cx); p.x1 = r3(p.x1 - cx); p.z0 = r3(p.z0 - cz); p.z1 = r3(p.z1 - cz);
  }
  return { pieces, signs, pads, floorY: r3(-y0) };
}

function make(specs, name) {
  // the plans of one set share their templates, so no two plans show the same one
  const used = new Set();
  const plans = specs.map(s => floorplan({ ...s, used }));
  const { pieces, signs, pads, floorY } = layout(plans);
  const blueprint = BF.write({ meta: { Name: name, Creator: 'Villheim floorplan', Category: 'Villheim floorplans', Description: plans.map(p => `${p.id} ${p.command}`).join('; ') }, pieces });
  return {
    name, blueprint, pieces: pieces.length, signs, pads, floorY,
    rows: plans.map(p => ({ id: p.id, command: p.command, shape: p.shape, size: `${p.w}x${p.d}`, room: p.room, biome: p.biome, culture: p.culture, stage: p.decor, seed: p.seed, area: p.area, perTenM2: p.perTenM2, summary: p.summary })),
  };
}

function one(spec) { return make([spec], spec.id || 'floorplan'); }
function template(id, biome) { const sp = templatePlan(id, biome); return make([sp], sp.id); }
function set(n) { const k = Math.max(1, Math.min(CATALOG.length, n | 0)); return make([...Array(k).keys()].map(catalogSpec), `floorplans-${k}`); }

const apiFP = { floorplan, one, set, template, CATALOG, catalogSpec, SHAPES, ROOMS: Object.keys(ROOMS), BIOME_CODES };
if (NODE_FP) module.exports = apiFP; else window.VHFloorplan = apiFP;
