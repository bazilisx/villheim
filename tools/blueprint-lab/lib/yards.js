// Yards: a fence round the ground in front of or around a finished building, a gate on the way to the door, a path
// from the gate to the door, and what a household keeps in its yard (garden beds, firewood, a bench by the door, a
// lamp at the gate, bushes and flowers, a cart). Stage 2 and 3 homes and farms get one by default (D-060 B), inside
// the plot the village gives: the fence stands 2 to 4 m out from the walls.
//
// Numbers from the corpus (lab/mine_yards.js, data/yards.json; 733 vanilla builds, 115 of them well-liked):
//   fence segments are 2 m; lines run straight, and where they bend they turn 22.5 or 45 degrees at a joint (a
//     square corner is the next most common), so a winding fence is chords of 2 m at multiples of 22.5 degrees
//   openings in a fence line are 2 m (the gate); gates rarely have their own posts (median none, a quarter two)
//   the yard on the door side runs a median 4.6 m out from the walls (D-060 keeps it to 4)
//   garden beds are about 2.2 by 1 m; paths are laid in floor pieces flush with the ground
//   pieces outside stand on the ground or go into it up to 0.2 m (fences, props); props clip into each other or into
//     a fence or wall by a median 0.36 m, which is the most a marked clip (p.clip) may go in the checks
//
// Everything stands on the ground (y = 0, the design's lowest pivot, so the game sets it on the terrain). Nothing goes
// in a doorway or the 2 m in front of a door, at the foot of a stair, or in front of the woodshed. Pieces made by the
// generator's kit follow the biome's materials; props (bushes, crops, flowers, decor) go in any biome (D-065), and
// every piece passes the materials check for the biome.
const NODE_Y = typeof module !== 'undefined';
const PY = NODE_Y ? require('./pieces.js') : window.VHPieces;
const checksY = () => (NODE_Y ? require('./checks.js') : window.VHChecks);
const BIOMES_Y = ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains', 'Mistlands', 'Ashlands'];
const reachesY = (biome, b) => BIOMES_Y.indexOf(biome) >= BIOMES_Y.indexOf(b);
const canY = (biome, name) => BIOMES_Y.indexOf(PY.needs(name)) <= BIOMES_Y.indexOf(biome);
const quatY = yaw => { const a = yaw * Math.PI / 360; return [0, +Math.sin(a).toFixed(6), 0, +Math.cos(a).toFixed(6)]; };
const normY = a => ((a % 360) + 360) % 360;
function rngY(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// From the corpus (see the top of this file).
const MEASURED = { segment: 2, turn: 22.5, gate: 2, doorSide: 4.6, bed: [2.2, 1.0], sink: 0.2, clip: 0.36 };
// D-060: a yard widens the plot by about 2 to 4 m.
const MARGIN = { min: 2, max: 4 };
const MAX_CLIP = MEASURED.clip;

// Fence kinds: a wood fence (wattle and board), a dry stone fence, or posts and rails.
// Cultures pick one (docs/CULTURE_STYLES.md): log-building cultures fence with posts and rails, the turf and stone
// cultures with stone where the stage allows stone (D-012), the rest with wood.
const FENCE_BY_CULTURE = {
  'norse': { wood: 1 }, 'anglo-saxon': { wood: 1 }, 'frankish-norman': { wood: 2, rail: 1 },
  'norse-forest': { rail: 2, wood: 1 }, 'slavic': { rail: 1 }, 'baltic': { rail: 1, wood: 1 }, 'fen-folk': { wood: 1 },
  'celtic': { stone: 2, wood: 1 }, 'norse-highland': { stone: 1 }, 'saami': { rail: 1 }, 'steppe': { rail: 1 },
  'byzantine': { stone: 2, wood: 1 }, 'middle-eastern': { stone: 1 }, 'lamari': { stone: 1 },
};
// Shapes: 'front' (a fence from the side walls round the front), 'L' (the front and one side), 'wrap' (all round),
// 'side' (along one gable end). A shape that would run through something already there (a field, a pen, a woodshed)
// gives way to the next. Farms keep their field in front, so they mostly get a side yard.
const SHAPES = { home: { front: 4, L: 2, wrap: 2, side: 1 }, farm: { side: 3, wrap: 1, front: 1, L: 1 },
  // working yards (D-067): beside or round the work
  smithy: { side: 3, L: 1, front: 1 }, tavern: { front: 3, L: 2, side: 1 }, workshop: { side: 3, L: 1, wrap: 1 }, sawmill: { side: 3, wrap: 1, L: 1 }, dock: { side: 2, front: 1 } };
// Building types that get a working yard at stage 2 and 3 (D-067); docks stand over water and get none. Base crafting stations (workbench, forge, black forge,
// artisan table, galdr table) never stand outside without a roof: players would try to use them. Their extensions and
// upgrades may, as decor (the chopping block, the tanning rack, the forge's cooler, anvils and tool rack).
const WORK_TYPES = ['smithy', 'tavern', 'workshop', 'sawmill'];
const CULTURE_YARD = { 'norse-highland': 'stones', 'celtic': 'stones', 'saami': 'stones', 'norse-forest': 'logs', 'slavic': 'logs', 'baltic': 'logs',
  'frankish-norman': 'bed', 'anglo-saxon': 'bed', 'byzantine': 'bed', 'steppe': 'cart' };
const CROP = [['Ashlands', 'Pickable_Barley'], ['Plains', 'Pickable_Barley'], ['Mountain', 'Pickable_Onion'], ['Swamp', 'Pickable_Turnip'], ['Black Forest', 'Pickable_Carrot']];
// bushes that stay within about 1.5 m across (shrub_2 spreads 3.6 m and swallows a fence)
const BUSHES = { 'Meadows': ['Bush01', 'RaspberryBush'], 'Black Forest': ['BlueberryBush', 'Bush02_en'], 'Swamp': ['Bush02_en'],
  'Mountain': ['Bush01_heath'], 'Plains': ['CloudberryBush', 'Bush01_heath'], 'Mistlands': ['Bush02_en'], 'Ashlands': ['AshlandsBush1', 'AshlandsBush2'] };
const FLOWERS = ['Pickable_Dandelion', 'Pickable_Dandelion', 'Pickable_Mushroom', 'Pickable_Thistle', 'Pickable_Mushroom_yellow', 'Pickable_Fiddlehead', 'Pickable_Mushroom_blue'];

function pickW(R, w) {
  const e = Object.entries(w).filter(([, v]) => v > 0), t = e.reduce((s, [, v]) => s + v, 0);
  let x = R() * t;
  for (const [k, v] of e) if ((x -= v) <= 0) return k;
  return e.length ? e[0][0] : null;
}

/** Does this request get a yard? req.yard true or false decides; otherwise stage 2 and 3 homes and farms. */
function wants(req, type, stage) {
  if (req && req.yard != null) return !!req.yard;
  return ['home', 'farm', ...WORK_TYPES].includes(type) && (stage === 's2' || stage === 's3');
}

// The plot the game gives a design (src/Villheim.Logic/Designs/Blueprints.cs, Center): the farthest piece pivot from
// the middle of the box round the pivots, plus 2 m, at least 4 m.
function plotRadius(pieces) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of pieces) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.z < z0) z0 = p.z; if (p.z > z1) z1 = p.z; }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  let r = 0;
  for (const p of pieces) r = Math.max(r, Math.hypot(p.x - cx, p.z - cz));
  return Math.max(4, r + 2);
}

// ---------------------------------------------------------------- what is already there

const dbg = m => { if (typeof global !== 'undefined' && global.YDBG) global.YDBG.push(m); };
const hitBox = (a, z, pad = 0) => a.x0 < z.x1 + pad && a.x1 > z.x0 - pad && a.z0 < z.z1 + pad && a.z1 > z.z0 - pad && a.y0 < z.y1 && a.y1 > z.y0;

// The building's walls on the ground (their outer faces), everything that stands on the ground or low over it, and
// the places to keep clear: doorways and the 2.2 m in front of each, the foot of each stair, the woodshed's front.
function survey(b) {
  const Ck = checksY();
  const boxes = b.pieces.map(p => ({ p, o: Ck.aabb(p), info: PY.piece(p.name) }));
  const walls = boxes.filter(x => !x.p.decor && !x.p.trim && ['wall', 'door', 'window'].includes(x.info.role) && x.o.y0 < 1.6);
  if (walls.length < 3) { dbg('walls'); return null; }
  const W = { x0: Math.min(...walls.map(x => x.o.x0)), x1: Math.max(...walls.map(x => x.o.x1)), z0: Math.min(...walls.map(x => x.o.z0)), z1: Math.max(...walls.map(x => x.o.z1)) };
  // low things a fence or a prop could run into: anything starting under 2.2 m, roofs and gables aside
  const solid = boxes.filter(x => x.o.y0 < 2.2 && !['roof', 'roofTop', 'roofCorner', 'gable'].includes(x.info.role)).map(x => x.o);
  const all = boxes.map(x => x.o);
  const zones = [];
  const doors = [];
  for (const x of boxes) {
    if (x.info.role === 'door') {
      const o = PY.doorOpening(x.p);
      if (o.y > 2) continue;
      doors.push(o);
      for (const s of [-1, 1]) {
        const ax = o.x + o.nx * s * 1.15, az = o.z + o.nz * s * 1.15;
        const ex = Math.abs(o.ux) * 1.1 + Math.abs(o.nx) * 1.15, ez = Math.abs(o.uz) * 1.1 + Math.abs(o.nz) * 1.15;
        zones.push({ x0: ax - ex, x1: ax + ex, y0: -1, y1: 3, z0: az - ez, z1: az + ez, door: true });
      }
    }
    const c = x.info.role === 'stair' && PY.climbSpec(x.p.name);
    if (c && x.o.y0 < 0.6) {
      const a = (x.p.yaw || 0) * Math.PI / 180, dx = -Math.sin(a), dz = -Math.cos(a);
      const fx = x.p.x - dx * c.run / 2, fz = x.p.z - dz * c.run / 2; // the foot
      const xs = [fx, fx - dx * 1.6], zs = [fz, fz - dz * 1.6];
      zones.push({ x0: Math.min(...xs) - 0.9, x1: Math.max(...xs) + 0.9, y0: -1, y1: 3, z0: Math.min(...zs) - 0.9, z1: Math.max(...zs) + 0.9, tag: ' stair' });
    }
    // a woodpile outside (the woodshed, the lean-to) keeps a metre in front of it free to reach it
    if (/^wood_(fine_|core_)?stack$/.test(x.p.name) && x.o.y0 < 0.5) zones.push({ x0: x.o.x0 - 1, x1: x.o.x1 + 1, y0: -1, y1: 3, z0: x.o.z0 - 1, z1: x.o.z1 + 1, tag: ' woodpile' });
  }
  const B = { x0: Math.min(...all.map(o => o.x0)), x1: Math.max(...all.map(o => o.x1)), z0: Math.min(...all.map(o => o.z0)), z1: Math.max(...all.map(o => o.z1)) };
  // what a fence's end may meet: the walls and what lies in them (posts, braces), and the ground floor under them
  const inShell = o => o.x0 > W.x0 - 0.35 && o.x1 < W.x1 + 0.35 && o.z0 > W.z0 - 0.35 && o.z1 < W.z1 + 0.35;
  const wallBoxes = boxes.filter(x => !x.p.decor && ['wall', 'window', 'beam', 'pole', 'floor'].includes(x.info.role) && x.o.y0 < 1.6 && inShell(x.o) && (x.info.role !== 'floor' || x.o.y1 < 1.2)).map(x => x.o);
  // where the walls stand on each face of the box round them: an L or T has wings out front, so a fence meets the
  // side walls where they are
  const on = (k, v) => walls.filter(x => Math.abs((k === 'x' ? (v < 0 ? x.o.x0 - W.x0 : x.o.x1 - W.x1) : (v < 0 ? x.o.z0 - W.z0 : x.o.z1 - W.z1))) < 0.6).map(x => x.o);
  const span = (list, a, c) => list.length ? [Math.min(...list.map(o => o[a])), Math.max(...list.map(o => o[c]))] : null;
  W.left = span(on('x', -1), 'z0', 'z1'); W.right = span(on('x', 1), 'z0', 'z1'); W.back = span(on('z', 1), 'x0', 'x1'); W.front = span(on('z', -1), 'x0', 'x1');
  // an open side (a smithy's open front, a woodworker's open sides) is the box's edge, and the way in when there is
  // no door
  const open = [];
  if (!W.front) { W.front = [W.x0, W.x1]; open.push({ x: (W.x0 + W.x1) / 2, z: W.z0, nx: 0, nz: -1, ux: 1, uz: 0, y: 0 }); }
  if (!W.back) { W.back = [W.x0, W.x1]; open.push({ x: (W.x0 + W.x1) / 2, z: W.z1, nx: 0, nz: 1, ux: 1, uz: 0, y: 0 }); }
  if (!W.left) { W.left = [W.z0, W.z1]; open.push({ x: W.x0, z: (W.z0 + W.z1) / 2, nx: -1, nz: 0, ux: 0, uz: 1, y: 0 }); }
  if (!W.right) { W.right = [W.z0, W.z1]; open.push({ x: W.x1, z: (W.z0 + W.z1) / 2, nx: 1, nz: 0, ux: 0, uz: 1, y: 0 }); }
  if (open.length > 2) { dbg('open ' + open.length); return null; }
  // a building open on a side that still has its corner posts: the middle of its front is the way in
  if (!doors.length && !open.length) open.push({ x: (W.x0 + W.x1) / 2, z: W.z0, nx: 0, nz: -1, ux: 1, uz: 0, y: 0 });
  const noDoor = !doors.length;
  for (const o of open) {
    if (noDoor) doors.push(o);
    // the open side's 2.2 m kept clear, as a door's
    const ex = Math.abs(o.ux) * 2 + Math.abs(o.nx) * 1.15, ez = Math.abs(o.uz) * 2 + Math.abs(o.nz) * 1.15;
    zones.push({ x0: o.x + o.nx * 1.15 - ex, x1: o.x + o.nx * 1.15 + ex, y0: -1, y1: 3, z0: o.z + o.nz * 1.15 - ez, z1: o.z + o.nz * 1.15 + ez, door: true });
  }
  return { W, B, solid, wallBoxes, zones, doors, minY: Math.min(...b.pieces.map(p => p.y)) };
}

// ---------------------------------------------------------------- the outline

// Rect corners in order with the open (house) side: each shape is a polyline of points [x, z], each corner flagged
// when it is an outer corner a winding fence may round.
function outline(shape, W, m, side, back = 1) {
  const { f, s, r, k } = m; // front, left side, right side, back margins
  const P = (x, z, corner) => ({ x, z, corner: !!corner });
  const tidy = a => a.filter((p, i) => i === 0 || Math.hypot(p.x - a[i - 1].x, p.z - a[i - 1].z) > 0.05);
  // the fence meets a side wall 'back' metres back from that wall's front end
  const zL = Math.min(W.left[0] + back, W.left[1] - 0.5), zR = Math.min(W.right[0] + back, W.right[1] - 0.5);
  if (shape === 'front') return tidy([P(W.x0, zL), P(W.x0 - s, zL), P(W.x0 - s, W.z0 - f, 1), P(W.x1 + r, W.z0 - f, 1), P(W.x1 + r, zR), P(W.x1, zR)]);
  if (shape === 'L') {
    // the front and one side, meeting the back wall a metre in from its end
    if (side > 0) return tidy([P(W.x0, zL), P(W.x0 - s, zL), P(W.x0 - s, W.z0 - f, 1), P(W.x1 + r, W.z0 - f, 1), P(W.x1 + r, W.z1 + k, 1), P(W.back[1] - 1, W.z1 + k), P(W.back[1] - 1, W.z1)]);
    return tidy([P(W.x1, zR), P(W.x1 + r, zR), P(W.x1 + r, W.z0 - f, 1), P(W.x0 - s, W.z0 - f, 1), P(W.x0 - s, W.z1 + k, 1), P(W.back[0] + 1, W.z1 + k), P(W.back[0] + 1, W.z1)]);
  }
  if (shape === 'side') {
    // along one end wall, from its front end to its back end
    if (side > 0) return [P(W.x1, W.right[0]), P(W.x1 + r, W.right[0]), P(W.x1 + r, W.right[1], 1), P(W.x1, W.right[1])];
    return [P(W.x0, W.left[0]), P(W.x0 - s, W.left[0]), P(W.x0 - s, W.left[1], 1), P(W.x0, W.left[1])];
  }
  // wrap: closed, starting in the middle of the back so the seam is out of sight
  const xm = (W.x0 + W.x1) / 2;
  return [P(xm, W.z1 + k), P(W.x0 - s, W.z1 + k, 1), P(W.x0 - s, W.z0 - f, 1), P(W.x1 + r, W.z0 - f, 1), P(W.x1 + r, W.z1 + k, 1), P(xm, W.z1 + k)];
}

// Runs (straight stretches) from the points; an outer corner may be cut with one 2 m chord at 45 degrees ('chamfer')
// or rounded with two chords at 22.5 and 67.5 degrees ('round'), the turns the corpus fences make.
const CUT = { chamfer: { inset: Math.SQRT2, chords: [45] }, round: { inset: 2 * (Math.cos(Math.PI / 8) + Math.sin(Math.PI / 8)), chords: [22.5, 67.5] } };
function runsOf(pts, cuts) {
  const runs = [];
  let cur = { x: pts[0].x, z: pts[0].z };
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i], q = pts[i + 1];
    const cut = p.corner && q && cuts[i] ? CUT[cuts[i]] : null;
    if (!cut) { runs.push({ a: cur, b: { x: p.x, z: p.z } }); cur = { x: p.x, z: p.z }; continue; }
    const L1 = Math.hypot(p.x - cur.x, p.z - cur.z), L2 = Math.hypot(q.x - p.x, q.z - p.z);
    const a = [(p.x - cur.x) / L1, (p.z - cur.z) / L1], c = [(q.x - p.x) / L2, (q.z - p.z) / L2];
    const start = { x: p.x - a[0] * cut.inset, z: p.z - a[1] * cut.inset };
    runs.push({ a: cur, b: start });
    let at = start;
    for (const deg of cut.chords) {
      const t = deg * Math.PI / 180, d = [a[0] * Math.cos(t) + c[0] * Math.sin(t), a[1] * Math.cos(t) + c[1] * Math.sin(t)];
      const nx = { x: at.x + d[0] * 2, z: at.z + d[1] * 2 };
      runs.push({ a: at, b: nx, chord: true });
      at = nx;
    }
    cur = at;
  }
  return runs.map(r => { const L = Math.hypot(r.b.x - r.a.x, r.b.z - r.a.z); return { ...r, L, u: [(r.b.x - r.a.x) / (L || 1), (r.b.z - r.a.z) / (L || 1)] }; }).filter(r => r.L > 0.05);
}

// ---------------------------------------------------------------- fence pieces

const yawAlong = u => normY(Math.atan2(-u[1], u[0]) * 180 / Math.PI); // a piece's local x along u

// A fence piece over [s, s + 2] along a run: wood fence pivots 0.1 m past its middle, stone fence in its middle.
function segment(kit, run, s, extra) {
  const u = run.u, mx = run.a.x + u[0] * (s + 1), mz = run.a.z + u[1] * (s + 1), yaw = yawAlong(u);
  const off = kit.fence === 'wood_fence' ? 0.1 : 0;
  return { name: kit.fence, x: mx + u[0] * off, y: 0, z: mz + u[1] * off, yaw, ...(extra || {}) };
}

// The pieces along one run from t0 to t1 (metres along it). Wood and stone: 2 m segments from t0, the last one ending
// at t1 and overlapping the one before it (a clip along the line, as players lap fence panels). Posts and rails: a
// post at each end and every 2 m, a rail between each pair.
function fill(kit, run, t0, t1, out, anchor) {
  const L = t1 - t0;
  if (L < 0.3) return true;
  if (kit.kind === 'rail') {
    const n = Math.max(1, Math.ceil(L / 2 - 0.02)), step = L / n;
    for (let i = 0; i <= n; i++) {
      const t = t0 + step * i;
      out.push({ name: kit.post, x: run.a.x + run.u[0] * t, y: 0.5, z: run.a.z + run.u[1] * t, yaw: 0, post: true });
    }
    for (let i = 0; i < n; i++) {
      const t = t0 + step * (i + 0.5), long = step > 1.4;
      out.push({ name: long ? kit.rail : kit.rail1, x: run.a.x + run.u[0] * t, y: 0.8, z: run.a.z + run.u[1] * t, yaw: yawAlong(run.u), clip: +Math.max(0, ((long ? 2 : 1) - step) / 2).toFixed(2) });
    }
    return true;
  }
  if (L < 1.5) return false; // no piece shorter than 2 m in a wood or stone fence
  // one piece, square to the gate (anchor) and lapping past the other end
  if (L < 1.95) { out.push(segment(kit, run, anchor === 'end' ? t1 - 2 : anchor === 'start' ? t0 : t0 - (2 - L) / 2, { clip: +(2 - L).toFixed(2) })); return true; }
  const n = Math.max(1, Math.ceil(L / 2 - 0.12)); // a run a few cm over 2 m takes one piece (a second would lap it almost whole)
  for (let i = 0; i < n; i++) {
    const s = i < n - 1 ? t0 + 2 * i : t1 - 2;
    const lap = i === n - 1 && n > 1 ? +(2 * n - L).toFixed(2) : 0;
    out.push(segment(kit, run, s, lap > 0.02 ? { clip: lap } : null));
  }
  return true;
}

function kitFor(ctx, R) {
  const { K, biome, cultureKey, stage } = ctx;
  // stone where the building may use stone: not in the Meadows, not at the early stages of a forest village (D-012)
  const early = (biome === 'Meadows' || biome === 'Black Forest') && stage !== 's3';
  const stoneOK = reachesY(biome, 'Black Forest') && !early && canY(biome, 'stone_fence');
  const w = { ...(FENCE_BY_CULTURE[cultureKey] || { wood: 3, rail: 1, stone: reachesY(biome, 'Mountain') ? 1 : 0 }) };
  if (!stoneOK) delete w.stone;
  const want = ctx.fence || pickW(R, w) || 'wood';
  const kind = want === 'stone' && !stoneOK ? 'wood' : want;
  return {
    kind,
    fence: kind === 'stone' ? 'stone_fence' : 'wood_fence',
    post: K.pole1 || 'wood_pole', rail: K.beam || 'wood_beam', rail1: K.beam1 || 'wood_beam_1',
    gatePost: K.pole || 'wood_pole2', gate: 'wood_fence_gate',
    floor: K.floor1 || 'wood_floor_1x1',
  };
}

// ---------------------------------------------------------------- placing

/**
 * Adds a yard to a finished design b (generator Build: b.pieces, b.notes). ctx: { K, C, type, stage, biome,
 * cultureKey, decor, seed }, options in ctx.opts (req.yard as an object) and ctx.details (req.details, the bench's
 * switches yardOrganic, yardBeds, yardProps, yardPath, yardLamp). Returns a summary, or null when no yard fits.
 */
function add(b, ctx) {
  const Ck = checksY();
  const opts = typeof ctx.opts === 'object' && ctx.opts ? ctx.opts : {};
  const X = { ...(ctx.details || {}), ...opts };
  const C = ctx.C || {};
  // no yard for buildings on stilts over water, or with a boardwalk (crannogs)
  if (C.stilts || C.boardwalk) return null;
  const R = rngY((ctx.seed || 1) * 7121 + 404);
  // a woodpile the furnishing set against an outside wall (not the woodshed's or the lean-to's) moves into the yard
  const loose = b.pieces.filter(p => p.decor && !p.trim && /^wood_(fine_|core_)?stack$/.test(p.name) && p.y < 1);
  const kept = b.pieces;
  b.pieces = b.pieces.filter(p => !loose.includes(p));
  const S = survey(b);
  if (!S) { dbg('survey'); b.pieces = kept; return null; }
  // the game sets the design's lowest pivot on the terrain: that is the yard's ground (0, or a sunk stone floor's
  // middle, -0.4 in the turf houses)
  const G0 = S.minY;
  if (G0 < -0.6 || G0 > 0.01) { dbg('ground ' + G0); b.pieces = kept; return null; }
  const kit = kitFor({ ...ctx, fence: opts.fence || C.yardFence }, R);
  const decor = ctx.decor || 'd2';
  const big = ctx.stage === 's3';

  // the main door: the ground door nearest the front (-z)
  const front = S.doors.filter(o => Math.abs(o.nz) > 0.9).sort((a, c) => a.z - c.z)[0] || S.doors[0];
  if (!front) { dbg('front'); b.pieces = kept; return null; }

  // shapes to try, the chosen one first, then the others by weight; margins in the measured range
  const weights = { ...(SHAPES[ctx.type] || SHAPES.home) };
  const first = opts.shape || C.yardShape || pickW(R, weights);
  const order = [first, ...Object.keys(weights).filter(k => k !== first).sort((a, c) => weights[c] - weights[a])];
  const organic = X.yardOrganic != null ? !!X.yardOrganic : R() < 0.45;
  const side0 = R() < 0.5 ? 1 : -1;
  const pickM = (lo, hi) => Math.round((lo + R() * (hi - lo)) * 2) / 2;
  const base = { f: pickM(big ? 3.5 : 3, MARGIN.max), s: pickM(2.5, big ? 3.5 : 3), r: pickM(2.5, big ? 3.5 : 3), k: pickM(2.5, 3) };

  const placed = [];
  const clear = (p, pad = 0.1, more) => {
    const o0 = Ck.aabb({ ...p, y: p.y + G0 });
    // a fence's post tips may pass under an eave brace (a brace starts about 1.8 m up, 1 m out from the wall)
    const o = p.name === kit.fence || p.post ? { ...o0, y1: Math.min(o0.y1, 1.65) } : o0;
    // a fence's end piece meets the wall: it may go into it as far as a marked clip goes
    const skipWall = z => p.attach && S.wallBoxes.includes(z) && Math.min(o.x1, z.x1) - Math.max(o.x0, z.x0) <= MAX_CLIP + 0.3 && Math.min(o.z1, z.z1) - Math.max(o.z0, z.z0) <= MAX_CLIP + 0.3;
    const by = S.solid.find(z => hitBox(o, z, pad) && !skipWall(z));
    if (by) { clear.by = by; return false; }
    if (more && more.some(z => hitBox(o, z, pad))) return false;
    return true;
  };

  const radius0 = plotRadius(b.pieces);
  let plan = null;
  search: for (const shape of order) {
    for (const side of ['L', 'side'].includes(shape) ? [side0, -side0] : [side0]) {
      for (const [grow, back] of [[0, 1], [0.5, 1], [1, 1], [0, 3], [1, 3], [0, 5], [1, 5]]) {
        const m = { f: Math.min(MARGIN.max, base.f + grow), s: Math.min(MARGIN.max, base.s + grow), r: Math.min(MARGIN.max, base.r + grow), k: Math.min(MARGIN.max, base.k + grow) };
        // a side yard's gate fills its front run, or takes half of it: 2 or 4 m out
        if (shape === 'side') { if (side > 0) m.r = m.r >= 3 ? 4 : 2.25; else m.s = m.s >= 3 ? 4 : 2.25; }
        const pts = outline(shape, S.W, m, side, back);
        // corner cuts where the runs on both sides keep 2 m of straight fence (or none) after every cut
        const cuts = {};
        if (organic) {
          const left = pts.map((p, i) => (i ? Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) : 0));
          pts.forEach((p, i) => {
            if (!p.corner || i === 0 || i === pts.length - 1) return;
            const k = R() < 0.55 ? 'round' : 'chamfer';
            for (const c of [k, 'chamfer']) {
              const a = left[i] - CUT[c].inset, d = left[i + 1] - CUT[c].inset;
              if (a >= 2 && d >= 2) { cuts[i] = c; left[i] = a; left[i + 1] = d; break; }
            }
          });
        }
        const runs = runsOf(pts, cuts);
        // an open shape's ends meet the house walls
        // (its first and last pieces stop at the wall's face: a wood fence's rail runs 0.25 m past its snap point)
        if (shape !== 'wrap') {
          const r0 = runs[0], r1 = runs[runs.length - 1], cut = kit.kind === 'rail' ? 0.35 : 0.25; // a post is 0.4 m across
          r0.attach = 'start'; r1.attach = 'end';
          r0.a = { x: r0.a.x + r0.u[0] * cut, z: r0.a.z + r0.u[1] * cut }; r0.L -= cut;
          r1.b = { x: r1.b.x - r1.u[0] * cut, z: r1.b.z - r1.u[1] * cut }; r1.L -= cut;
        }
        const found = tryPlan(runs, kit, S, front, clear);
        // D-060: the plot the village gives (Blueprints.cs: the farthest pivot from the middle of the pivots' box,
        // plus 2 m) grows by 4 m at most
        if (found && plotRadius([...b.pieces, ...found.fence, found.gate]) - radius0 > MARGIN.max + 0.01) { dbg('radius'); continue; }
        if (found) { plan = { ...found, shape, m, organic: Object.keys(cuts).length > 0, side }; break search; }
      }
    }
  }
  if (!plan) { b.pieces = kept; return null; }

  // the fence, the gate (and its posts), the path
  // through the Build's put where there is one (pivot shifts of the Ashlands timber, one piece per spot)
  const put = (p, extra) => {
    const yaw = normY(p.yaw || 0), more = { yard: true, ...(extra || {}) };
    for (const k of ['clip', 'attach']) if (p[k]) more[k] = p[k];
    if (more.attach) more.clip = Math.max(more.clip || 0, 0.25);
    delete more.attach;
    const n0 = b.pieces.length, y = p.y + G0;
    if (typeof b.put === 'function') b.put(p.name, p.x, y, p.z, yaw, more);
    else b.pieces.push({ name: p.name, x: +p.x.toFixed(3), y: +y.toFixed(3), z: +p.z.toFixed(3), yaw, q: quatY(yaw), ...more });
    if (b.pieces.length > n0) placed.push(b.pieces[b.pieces.length - 1]);
  };
  for (const p of plan.fence) put(p);
  put(plan.gate);
  if (plan.gatePosts && (big || R() < 0.25)) for (const p of plan.gatePosts) put(p);
  const keep = [...S.zones, ...plan.keep];
  const solidNow = () => [...S.solid, ...placed.map(p => Ck.aabb(p))];
  // under the eaves (they reach 1 m past the walls, with braces under them) only low things: beds, benches, flowers
  const eave = o => o.y1 > G0 + 1.05 && o.x0 < S.W.x1 + 1.2 && o.x1 > S.W.x0 - 1.2 && o.z0 < S.W.z1 + 1.2 && o.z1 > S.W.z0 - 1.2;
  const soft = p => { const o = Ck.aabb({ ...p, y: p.y + G0 }), c = { ...o, x0: o.x0 + 0.3, x1: o.x1 - 0.3, z0: o.z0 + 0.3, z1: o.z1 - 0.3 }; return !keep.some(z => hitBox(c, z, 0)) && inYard(c) && !placed.some(q => q.name === p.name && Math.hypot(q.x - p.x, q.z - p.z) < 0.35); };
  const free = (p, pad = 0.1) => {
    const o = Ck.aabb({ ...p, y: p.y + G0 });
    const why = solidNow().some(z => hitBox(o, z, pad)) ? 'solid' : keep.some(z => hitBox(o, z, 0)) ? 'keep' : !inYard(o) ? 'out' : eave(o) ? 'eave' : null;
    if (why) dbg('free ' + p.name + ' ' + why + (why === 'solid' && typeof global !== 'undefined' && global.YV ? ' ' + ((solidNow().find(z => hitBox(o, z, pad)).info || {}).name) : ''));
    return !why;
  };
  // inside the yard: every corner of the piece's box inside the fence line (an open shape closes through the house)
  const yb = plan.box, poly = plan.poly;
  const inPoly = (x, z) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], d = poly[j]; if ((a[1] > z) !== (d[1] > z) && x < (d[0] - a[0]) * (z - a[1]) / (d[1] - a[1]) + a[0]) c = !c; } return c; };
  const inYard = o => [[o.x0, o.z0], [o.x0, o.z1], [o.x1, o.z0], [o.x1, o.z1]].every(([x, z]) => inPoly(x, z));

  // paving: where the house stands on 1 m stone floors (half in the ground), the ground in front of the door is laid
  // in the same stone, level with the floor inside (outside stone floors are on 39 % of the corpus builds)
  let paved = 0;
  const gateWay = (() => { const g = Ck.aabb(plan.gate); return g ? { x0: g.x0 - 0.75, x1: g.x1 + 0.75, z0: g.z0 - 0.75, z1: g.z1 + 0.75, y0: g.y0, y1: g.y0 + 2 } : null; })();
  const stoneIn = b.pieces.find(p => !p.yard && /^(stone_floor_2x2|blackmarble_floor|Piece_grausten_floor_2x2)$/.test(p.name) && Math.abs(p.x - front.x) < 2.1 && Math.abs(p.z - front.z) < 2.1);
  if (stoneIn && X.yardPave !== false) {
    const nOut = front.z <= (S.W.z0 + S.W.z1) / 2 ? -1 : 1;
    const rows = big ? [1, 3] : [1];
    for (const dz of rows) for (const dx of [0, -2, 2]) {
      const p = { name: stoneIn.name, x: stoneIn.x + 2 * Math.round((front.x - stoneIn.x) / 2) + dx, y: stoneIn.y - G0, z: front.z + nOut * dz, yaw: 0 };
      const o = Ck.aabb({ ...p, y: p.y + G0 });
      const c = { ...o, x0: o.x0 + 0.05, x1: o.x1 - 0.05, z0: o.z0 + 0.05, z1: o.z1 - 0.05 };
      if (S.solid.some(z => hitBox(c, z, 0)) || placed.some(q => hitBox(c, Ck.aabb(q), 0)) || !inYard(c)) continue;
      // and out of the gate's way: a stone floor laid level with the floor inside stands half a metre proud of the
      // ground the gate swings over (the pool audit's doorway test, middle-eastern homes, 2026-11-10)
      if (gateWay && hitBox(c, gateWay, 0) && c.y1 > gateWay.y0 + 0.3) continue;
      put(p); paved++;
    }
  }
  let path = 0;
  if (X.yardPath !== false) {
    // the path goes round anything there (a floor or step already there is path enough) and under the gate
    const there = [...S.solid, ...placed.filter(q => q.name !== kit.gate).map(q => Ck.aabb(q))];
    // no plank under a low roof or eave (a lean-to's): the headroom check would read it as a floor too low to stand on
    const low = b.pieces.filter(q => ['roof', 'roofTop', 'roofCorner', 'beam', 'gable', 'floor', 'stair'].includes(PY.piece(q.name).role)).map(q => Ck.aabb(q)).filter(o => o.y0 < G0 + 2.6 && o.y0 > G0 + 0.4);
    for (const c of plan.path) {
      const p = { name: kit.floor, x: c[0], y: 0, z: c[1], yaw: 0 };
      const o = Ck.aabb({ ...p, y: G0 });
      if (there.some(z => hitBox(o, z, -0.02)) || placed.some(q => q.name === kit.floor && Math.hypot(q.x - c[0], q.z - c[1]) < 0.7)) continue;
      if (low.some(z => z.x0 < o.x1 - 0.05 && z.x1 > o.x0 + 0.05 && z.z0 < o.z1 - 0.05 && z.z1 > o.z0 + 0.05)) continue;
      put(p); path++;
    }
  }
  // the path stays free of props
  for (const c of plan.path) keep.push({ x0: c[0] - 0.75, x1: c[0] + 0.75, y0: -1, y1: 3, z0: c[1] - 0.75, z1: c[1] + 0.75 });

  // ---- what is in the yard
  const got = [];
  const D = { ...(ctx.details || {}) };
  const decorOn = (flag, lvl) => G0 > -0.01 && (D[flag] != null ? !!D[flag] : decor >= lvl);
  const insideRuns = plan.runs.filter(r => !r.chord && r.L >= 2.4);
  const mid = [(S.W.x0 + S.W.x1) / 2, (S.W.z0 + S.W.z1) / 2];
  const inward = r => { const n = [-r.u[1], r.u[0]], mx = (r.a.x + r.b.x) / 2, mz = (r.a.z + r.b.z) / 2; return Math.hypot(mx + n[0] - mid[0], mz + n[1] - mid[1]) < Math.hypot(mx - n[0] - mid[0], mz - n[1] - mid[1]) ? n : [-n[0], -n[1]]; };
  // spots along the fence, d metres in from it, every 0.5 m, facing the yard
  const fenceSpots = d => {
    const out = [];
    for (const r of insideRuns) {
      const n = inward(r);
      for (let t = 1.2; t <= r.L - 1.2 + 0.01; t += 0.5) out.push({ x: r.a.x + r.u[0] * t + n[0] * d, z: r.a.z + r.u[1] * t + n[1] * d, yaw: yawAlong(r.u), n, run: r, t });
    }
    return out;
  };
  // spots along the outside of the walls, d metres out
  const wallSpots = d => {
    const out = [], W = S.W;
    for (let x = W.x0 + 1; x <= W.x1 - 1 + 0.01; x += 0.5) { out.push({ x, z: W.z0 - d, yaw: 0, n: [0, -1] }); out.push({ x, z: W.z1 + d, yaw: 180, n: [0, 1] }); }
    for (let z = W.z0 + 1; z <= W.z1 - 1 + 0.01; z += 0.5) { out.push({ x: W.x0 - d, z, yaw: 270, n: [-1, 0] }); out.push({ x: W.x1 + d, z, yaw: 90, n: [1, 0] }); }
    return out;
  };
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  // the decor stage what goes up now belongs to (D-071): set before each kind of thing below
  let dsNow = 2;
  const tryAt = (spots, make, n = 1) => {
    let k = 0;
    for (const s of shuffle(spots.slice())) {
      if (k >= n) break;
      const group = make(s);
      if (!group || !group.length) continue;
      if (!group.every(p => (p.soft ? soft(p) : free(p, p.pad != null ? p.pad : 0.1)))) continue;
      // plants are part of the build, as a field's crops are; the rest is furnishing (stripped at d1)
      for (const p of group) { const q = { ...p }; delete q.soft; delete q.pad; put(q, PY.piece(q.name).role === 'nature' ? { garden: true, ds: dsNow } : { decor: true, trim: true, ds: dsNow }); }
      k++;
    }
    return k;
  };

  // garden beds: a raised bed of beams on the ground (2 m by 1 m, as the corpus's 2.2 by 1), a row of crops in it;
  // in the Meadows (no seeds yet) dandelions and mushrooms
  const crop = (CROP.find(([bm]) => reachesY(ctx.biome, bm)) || [null, null])[1];
  const bedOf = s => {
    const u = [Math.cos(s.yaw * Math.PI / 180), -Math.sin(s.yaw * Math.PI / 180)], n = s.n;
    const at = (a, c) => [s.x + u[0] * a + n[0] * c, s.z + u[1] * a + n[1] * c];
    const g = [];
    const beam = kit.rail, beam1 = kit.rail1;
    for (const c of [-0.5, 0.5]) { const [x, z] = at(0, c); g.push({ name: beam, x, y: 0.2, z, yaw: s.yaw }); }
    for (const a of [-1, 1]) { const [x, z] = at(a, 0); g.push({ name: beam1, x, y: 0.2, z, yaw: s.yaw + 90, clip: 0.2 }); }
    for (const a of [-0.55, 0, 0.55]) {
      const [x, z] = at(a, 0);
      const nm = crop || FLOWERS[Math.floor(R() * FLOWERS.length)];
      g.push({ name: nm, x, y: 0.05, z, yaw: Math.floor(R() * 4) * 90, soft: true });
    }
    return g;
  };
  // the household's yard (lib/persona.js yard): a tended garden takes a bed more, a work yard or a plain one none
  const H = ctx.persona, kind = WORK_TYPES.includes(ctx.type) ? 'work' : ctx.type === 'home' && H ? H.yard : 'garden';
  if (decorOn('yardBeds', 'd2') && kind !== 'plain' && (kind !== 'work' || ctx.type === 'farm')) {
    const n = ctx.type === 'farm' ? (big ? 3 : 2) : (big || plan.shape === 'wrap' ? 2 : 1) + (kind === 'garden' && H && H.hobby.plants > 0.5 ? 1 : 0);
    got.push(['bed', tryAt([...fenceSpots(1.0), ...wallSpots(1.3)], bedOf, n)]);
  }
  // firewood against the fence when there is no woodshed or lean-to stack already
  // (one firewood stack outside is enough: the woodshed's or the lean-to's counts)
  const outside = p => p.x < S.W.x0 || p.x > S.W.x1 || p.z < S.W.z0 || p.z > S.W.z1;
  if ((decorOn('yardProps', 'd2') || loose.length) && !b.pieces.some(p => /^wood_(fine_|core_)?stack$/.test(p.name) && !p.yard && p.y < 1 && outside(p))) {
    const name = loose.length ? loose[0].name : 'wood_stack';
    // a stack is 2.4 m square: its middle 1.5 m in from the fence
    got.push(['woodpile', tryAt(fenceSpots(1.5), s => [{ name, x: s.x, y: name === 'wood_stack' ? 0.57 : 0, z: s.z, yaw: s.yaw }])]);
  }
  // a bench against the front wall beside the door, facing out
  if (decorOn('yardProps', 'd2') && ctx.type === 'home') {
    const bench = canY(ctx.biome, 'piece_logbench01') && R() < 0.5 ? 'piece_logbench01' : 'piece_bench01';
    const spots = [];
    // the wall's outer face beside the door
    const face = Math.min(front.z - 0.1, ...S.wallBoxes.filter(o => Math.abs(o.z0 + o.z1 - 2 * front.z) < 1.2 && Math.abs((o.x0 + o.x1) / 2 - front.x) < 4 && o.x1 - o.x0 > 0.9).map(o => o.z0));
    for (const sg of [-1, 1]) for (const dx of [2.4, 2.9, 3.4, 3.9]) spots.push({ x: front.x + sg * dx, z: face - 0.5, yaw: 0 });
    got.push(['bench', tryAt(spots, s => [{ name: bench, x: s.x, y: 0, z: s.z, yaw: s.yaw, pad: 0.04 }])]);
  }
  // a lamp inside the gate, to one side of it
  dsNow = 3;
  if (decorOn('yardLamp', 'd3')) {
    const torch = 'piece_groundtorch_wood', g0 = plan.gateAt;
    const spots = [-1.8, 1.8, -2.3, 2.3, -2.8, 2.8].map(a => ({ x: g0.x + g0.u[0] * a + g0.n[0] * 0.45, z: g0.z + g0.u[1] * a + g0.n[1] * 0.45 }));
    got.push(['lamp', tryAt(spots, s => [{ name: torch, x: s.x, y: 0.66, z: s.z, yaw: 0 }])]);
  }
  // bushes in the outer corners and along the fence, flowers along the walls
  if (decorOn('yardProps', 'd3')) {
    const bushes = BUSHES[ctx.biome] || BUSHES.Meadows;
    // a bush spreads about 3 m: 1.4 m in from the fence and 3 m from the next one
    const apart = s => !placed.some(q => bushes.includes(q.name) && Math.hypot(q.x - s.x, q.z - s.z) < 3);
    got.push(['bush', tryAt(fenceSpots(1.4).filter(apart), s => (apart(s) ? [{ name: bushes[Math.floor(R() * bushes.length)], x: s.x, y: 0, z: s.z, yaw: Math.floor(R() * 16) * 22.5, pad: 0.05 }] : null), big ? 3 : 2)]);
    got.push(['flowers', tryAt(wallSpots(0.45), s => [0, 0.45, -0.45].map(a => ({ name: FLOWERS[Math.abs(Math.round(s.x * 7 + s.z * 13 + a * 11)) % FLOWERS.length], x: s.x + (s.n[1] ? a : 0), y: 0, z: s.z + (s.n[0] ? a : 0), yaw: Math.floor(R() * 4) * 90, soft: true, pad: 0 })), big ? 2 : 1)]);
  }
  // what the culture keeps in its yard (docs/CULTURE_STYLES.md): stone builders a pile of field stone, log builders a
  // second stack of logs, kitchen-garden cultures a second bed, the steppe a cart
  const extra = CULTURE_YARD[ctx.cultureKey];
  dsNow = 2;
  if (extra && decorOn('yardProps', 'd2')) {
    if (extra === 'stones' && canY(ctx.biome, 'stone_pile')) got.push(['stones', tryAt(fenceSpots(0.9), s => [{ name: 'stone_pile', x: s.x, y: 0, z: s.z, yaw: s.yaw }])]);
    if (extra === 'logs' && canY(ctx.biome, 'wood_core_stack')) got.push(['logs', tryAt(fenceSpots(0.75), s => [{ name: 'wood_core_stack', x: s.x, y: 0, z: s.z, yaw: s.yaw }])]);
    if (extra === 'bed') got.push(['bed', tryAt([...fenceSpots(1.0), ...wallSpots(1.3)], bedOf, 1)]);
    if (extra === 'cart' && ctx.type !== 'farm' && canY(ctx.biome, 'Cart')) got.push(['cart', tryAt(fenceSpots(1.4), s => [{ name: 'Cart', x: s.x, y: 0, z: s.z, yaw: normY(s.yaw + 90) }])]);
  }
  // a farm's cart in the yard (it takes bronze nails: the Black Forest on)
  if (decorOn('yardProps', 'd2') && ctx.type === 'farm' && canY(ctx.biome, 'Cart')) {
    got.push(['cart', tryAt(fenceSpots(1.4), s => [{ name: 'Cart', x: s.x, y: 0, z: s.z, yaw: normY(s.yaw + 90) }])]);
  }
  // a working yard, or a household's yard of materials and work leftovers (D-067, D-068): what the work leaves about,
  // against the fence, never a base station
  dsNow = 2;
  if (decorOn('yardProps', 'd2') && kind === 'work') {
    const F = (NODE_Y ? require('./decorate.js') : window.VHDecorate).FURNITURE;
    const okW = n => PY.decorOk(n, ctx.biome); // decor in any biome, building pieces the village's and the next (D-065)
    const along = (spots, list) => tryAt(spots, s => list.filter(([n]) => okW(n)).map(([n, a, d, turn, y]) => ({ name: n, x: s.x + Math.cos(s.yaw * Math.PI / 180) * a + s.n[0] * d,
      y: y || 0, z: s.z - Math.sin(s.yaw * Math.PI / 180) * a + s.n[1] * d, yaw: normY(s.yaw + (turn || 0)), pad: 0.05 })));
    const W = fenceSpots(0.8);
    if (ctx.type === 'smithy') {
      // the forge yard: the cooler and the tool rack against the fence, an anvil and the grinding wheel, coal
      got.push(['forgeyard', along(W, [['forge_ext5', 0, 0, 180], ['forge_ext6', 2.3, 0.1, 180]])]);
      got.push(['anvil', along(fenceSpots(1.4), [['forge_ext4', 0, 0, 180], ['forge_ext2', 1.4, 0, 200]])]);
      got.push(['coal', along(fenceSpots(1.2), [['coal_pile', 0, 0, 0]])]);
    } else if (ctx.type === 'tavern') {
      // tables and benches out front
      const set = [['piece_table', 0, 0, 0], ['piece_bench01', 0, -0.95, 0], ['piece_bench01', 0, 0.95, 180]];
      got.push(['tables', tryAt(fenceSpots(2.0), s => set.map(([n, a, d, turn]) => ({ name: n, x: s.x + s.n[0] * d, y: 0, z: s.z + s.n[1] * d, yaw: normY(s.yaw + turn), pad: 0.05 }))
        .map(q => ({ ...q, x: q.x, z: q.z })).filter(q => okW(q.name)), big ? 2 : 1)]);
      got.push(['barrels', along(W, [['piece_chest_barrel', 0, 0, 0], ['piece_chest_barrel', 1.05, 0.05, 30]])]);
    } else if (ctx.type === 'dock') {
      got.push(['crates', along(W, [['dvergrprops_crate', 0, 0, 0], ['piece_chest_barrel', 1.2, 0, 15], ['dvergrprops_crate', 0.4, 0, 12, 1.02]])]);
    } else {
      // the woodworker's log yard, or a household's materials: logs and firewood, the chopping block, offcuts in a crate
      got.push(['logs', along(fenceSpots(0.9), [['wood_core_stack', 0, 0, 0]])]);
      got.push(['chopping', along(fenceSpots(1.0), [['piece_workbench_ext1', 0, 0, 180], ['dvergrprops_crate', 1.2, 0.1, 8]])]);
      if (ctx.type !== 'home' || (H && H.hobby.crafts > 0.5)) got.push(['tanning', along(W, [['piece_workbench_ext2', 0, 0, 180]])]);
      if (ctx.type === 'home') got.push(['stones', along(fenceSpots(0.9), [['stone_pile', 0, 0, 0]])]);
    }
  }
  dsNow = 3;
  // a scarecrow by the beds (an armor stand; it takes iron, so the Swamp on)
  dsNow = 3;
  if (decorOn('yardProps', 'd3') && ctx.type === 'farm' && canY(ctx.biome, 'ArmorStand')) {
    const farFromDoors = s => Math.hypot(s.x - plan.gateAt.x, s.z - plan.gateAt.z) > 3 && S.doors.every(o => Math.hypot(s.x - o.x, s.z - o.z) > 3);
    got.push(['scarecrow', tryAt(fenceSpots(1.8).filter(farFromDoors), s => [{ name: 'ArmorStand', x: s.x, y: 0, z: s.z, yaw: s.yaw }])]);
  }

  const grow = Math.max(S.B.x0 - yb.x0, yb.x1 - S.B.x1, S.B.z0 - yb.z0, yb.z1 - S.B.z1, 0);
  const summary = { radius: [+radius0.toFixed(2), +plotRadius(b.pieces).toFixed(2)], shape: plan.shape, fence: kit.kind, organic: plan.organic, margins: plan.m, grows: +grow.toFixed(2), path, paved, pieces: placed.length, contents: got.filter(([, n]) => n).reduce((o, [k, n]) => { o[k] = n; return o; }, {}) };
  b.yard = summary;
  b.notes.push(`A ${plan.organic ? 'winding ' : ''}${{ wood: 'wood', stone: 'dry stone', rail: 'post and rail' }[kit.kind]} fence round the ${{ front: 'front yard', L: 'front and side yard', wrap: 'yard', side: 'side yard' }[plan.shape]}, a gate on the path to the door.`);
  return summary;
}

// The fence along the runs with a gate on the run that faces the door, and the path from the door to the gate.
// Null when any fence piece, the gate or the gate's clear space runs into something already there or a kept-clear
// place, or no run can take the gate.
function tryPlan(runs, kit, S, door, clear) {
  const Ck = checksY();
  // the run for the gate: the straight run nearest the point 1.5 m out from the door, with room for the gate
  const nOut = door.z <= (S.W.z0 + S.W.z1) / 2 ? -1 : 1; // the door's outside, along z
  const zLane = door.z + nOut * 1.5;
  const cands = [];
  for (const r of runs) {
    if (r.chord || r.L < 2) continue;
    // gate positions along the run that leave 0 or at least 2 m of fence either side (rails may take any length)
    const ts = [];
    for (let t = 1; t <= r.L - 1 + 0.001; t += 0.5) {
      const left = t - 1, right = r.L - t - 1;
      const ok = v => v < 0.3 || v >= 1.5 || kit.kind === 'rail';
      if (ok(left) && ok(right)) ts.push(t);
    }
    if (r.L >= 2 && r.L < 2.05) ts.push(r.L / 2);
    for (const t of ts) {
      const x = r.a.x + r.u[0] * t, z = r.a.z + r.u[1] * t;
      cands.push({ r, t, x, z, d: Math.hypot(x - door.x, z - zLane) + (Math.abs(r.u[0]) > 0.9 ? 0 : 1.5) });
    }
  }
  cands.sort((a, c) => a.d - c.d);
  for (const g of cands.slice(0, 16)) {
    const fence = [];
    let ok = true;
    for (const r of runs) {
      const n0 = fence.length;
      if (r === g.r) { ok = fill(kit, r, 0, g.t - 1, fence, 'end') && fill(kit, r, g.t + 1, r.L, fence, 'start'); }
      else ok = fill(kit, r, 0, r.L, fence);
      if (!ok) break;
      // the piece that meets the house wall
      if (r.attach === 'start' && fence.length > n0) fence[n0].attach = true;
      if (r.attach === 'end' && fence.length > n0) fence[fence.length - 1].attach = true;
      if (kit.kind === 'rail' && r.attach) for (let i = n0; i < fence.length; i++) if (!fence[i].post) { if (r.attach === 'start') { fence[i].attach = true; break; } }
    }
    if (!ok) { dbg('fill'); continue; }
    // corners of a rail fence share their posts once
    const seen = new Set();
    const dedup = fence.filter(p => { if (!p.post) return true; const k = `${p.x.toFixed(1)},${p.z.toFixed(1)}`; if (seen.has(k)) return false; seen.add(k); return true; });
    const u = g.r.u, yaw = yawAlong(u);
    // the gate's opening is 0.2 m to the -x side of its pivot (snap points at -1.2 and 0.8); its pivot is 1 m up
    const gate = { name: kit.gate, x: g.x + u[0] * 0.2, y: 1, z: g.z + u[1] * 0.2, yaw };
    // the gate swings both ways: the 1.2 m either side of it stays clear, as a door's
    const n = [-u[1], u[0]];
    const gz = { x0: Math.min(g.x - n[0] * 1.2, g.x + n[0] * 1.2) - Math.abs(u[0]) * 1.0 - 0.05, x1: Math.max(g.x - n[0] * 1.2, g.x + n[0] * 1.2) + Math.abs(u[0]) * 1.0 + 0.05, y0: -1, y1: 3,
      z0: Math.min(g.z - n[1] * 1.2, g.z + n[1] * 1.2) - Math.abs(u[1]) * 1.0 - 0.05, z1: Math.max(g.z - n[1] * 1.2, g.z + n[1] * 1.2) + Math.abs(u[1]) * 1.0 + 0.05 };
    if (S.solid.some(o => hitBox(o, { ...gz, x0: gz.x0 + 0.1, x1: gz.x1 - 0.1, z0: gz.z0 + 0.1, z1: gz.z1 - 0.1 }, 0) && o.y0 < 2.3)) { dbg('gatezone ' + S.solid.find(o => hitBox(o, { ...gz, x0: gz.x0 + 0.1, x1: gz.x1 - 0.1, z0: gz.z0 + 0.1, z1: gz.z1 - 0.1 }, 0) && o.y0 < 2.3).info.name); continue; }
    // and clear of the fence's own other runs (a run close beside the gate on an open-sided building)
    const gzIn = { ...gz, x0: gz.x0 + 0.15, x1: gz.x1 - 0.15, z0: gz.z0 + 0.15, z1: gz.z1 - 0.15 };
    if (dedup.some(p => { const o = Ck.aabb(p); return hitBox(o, gzIn, 0) && Math.hypot(p.x - g.x, p.z - g.z) > 1.05 && Math.abs((p.x - g.x) * -u[1] + (p.z - g.z) * u[0]) > 0.3; })) { dbg('gate fence'); continue; }
    // every fence piece clear of what is there and of the doorways, stairs and woodpiles
    const bad = dedup.find(p => !clear(p, 0.08, S.zones));
    if (bad) { const o = Ck.aabb(bad); const by = clear.by; clear.by = null; const zz = S.zones.find(z => hitBox(o, z, 0.08)); dbg('fence ' + (bad.attach ? 'attach ' : '') + (by ? by.info.name : zz ? 'zone' + (zz.door ? ' door' : zz.tag || '') : '?') + (global.YV && by ? ' ' + JSON.stringify([bad.x, bad.z, bad.yaw, [o.x0, o.x1, o.z0, o.z1].map(v => +v.toFixed(2)), [by.x0, by.x1, by.y0, by.y1, by.z0, by.z1].map(v => +v.toFixed(2))]) : '')); continue; }
    void Ck;
    if (!clear(gate, 0.05, S.zones.filter(z => !z.door))) { dbg('gate'); continue; }
    if (S.zones.some(z => z.door && hitBox(Ck.aabb(gate), z, -0.1))) continue;
    // gate posts just outside the opening
    const gatePosts = [-1.15, 1.15].map(a => ({ name: kit.gatePost, x: g.x + u[0] * a, y: 1, z: g.z + u[1] * a, yaw: 0 }));
    const postsOK = gatePosts.every(p => clear(p, 0.02, S.zones));
    // the path: out from the door to a lane 1.5 m in front of it, along the lane to the gate's line, then to the
    // gate and through it (1 m planks on a 0.5 m grid)
    const path = [];
    const step = (x, z) => { const k = [Math.round(x * 2) / 2, Math.round(z * 2) / 2]; if (!path.some(c => Math.hypot(c[0] - k[0], c[1] - k[1]) < 0.6)) path.push(k); };
    // a door up a stair: the path starts at the stair's foot (r5 review: paths ran along the wall past the stair)
    const stairs = S.solid.filter(o => o.info && o.info.role === 'stair' && Math.hypot((o.x0 + o.x1) / 2 - door.x, (o.z0 + o.z1) / 2 - door.z) < 6 &&
      ((o.z0 + o.z1) / 2 - door.z) * nOut > -0.5);
    let sx = door.x, lane = zLane;
    if (stairs.length) {
      const lo = stairs.reduce((m, o) => (o.y0 < m.y0 ? o : m)), cx = (lo.x0 + lo.x1) / 2, cz = (lo.z0 + lo.z1) / 2, dx = cx - door.x, dz = cz - door.z;
      const foot = Math.abs(dx) > Math.abs(dz) ? [cx + Math.sign(dx) * ((lo.x1 - lo.x0) / 2 + 0.6), cz] : [cx, cz + nOut * ((lo.z1 - lo.z0) / 2 + 0.6)];
      sx = foot[0]; lane = nOut > 0 ? Math.max(zLane, foot[1]) : Math.min(zLane, foot[1]);
      const zs0 = [foot[1], lane].sort((a, c) => a - c);
      for (let z = zs0[0]; z <= zs0[1] + 0.01; z += 1) step(sx, z);
    } else for (let t = 1; t < 1.5 - 0.01; t += 1) step(door.x, door.z + nOut * t);
    step(sx, lane);
    const xs = [sx, g.x].sort((a, c) => a - c);
    for (let x = xs[0]; x <= xs[1] + 0.01; x += 1) step(x, lane);
    step(g.x, lane);
    const zs = [lane, g.z].sort((a, c) => a - c);
    for (let z = zs[0]; z <= zs[1] + 0.01; z += 1) step(g.x, z);
    step(g.x, g.z);
    // one plank past the gate on its far side, when the far side is outside the yard
    const box = { x0: Math.min(...runs.flatMap(r => [r.a.x, r.b.x])), x1: Math.max(...runs.flatMap(r => [r.a.x, r.b.x])), z0: Math.min(...runs.flatMap(r => [r.a.z, r.b.z])), z1: Math.max(...runs.flatMap(r => [r.a.z, r.b.z])) };
    // for a yard that wraps the house's own side, the house walls bound it too
    box.x0 = Math.min(box.x0, S.W.x0); box.x1 = Math.max(box.x1, S.W.x1); box.z0 = Math.min(box.z0, S.W.z0); box.z1 = Math.max(box.z1, S.W.z1);
    // the gate's clear space and the planks under it are kept free of props
    const keep = [gz];
    const poly = [[runs[0].a.x, runs[0].a.z], ...runs.map(r => [r.b.x, r.b.z])];
    return { runs, fence: dedup, gate, gatePosts: postsOK ? gatePosts : null, path, keep, box, poly, gateAt: { x: g.x, z: g.z, u, n: inwardOf(g.r, S) } };
  }
  return null;
}
function inwardOf(r, S) {
  const n = [-r.u[1], r.u[0]], mid = [(S.W.x0 + S.W.x1) / 2, (S.W.z0 + S.W.z1) / 2], mx = (r.a.x + r.b.x) / 2, mz = (r.a.z + r.b.z) / 2;
  return Math.hypot(mx + n[0] - mid[0], mz + n[1] - mid[1]) < Math.hypot(mx - n[0] - mid[0], mz - n[1] - mid[1]) ? n : [-n[0], -n[1]];
}

const apiY = { add, wants, plotRadius, MEASURED, MARGIN, MAX_CLIP, FENCE_BY_CULTURE, SHAPES };
if (NODE_Y) module.exports = apiY; else window.VHYards = apiY;
