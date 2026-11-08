// Villheim building generator. Builds a design from a request (type, biome, culture, plan, roof, stage, decor,
// seed) with a kit of real Valheim pieces, proportions learned from the corpus, and the building conventions the
// corpus shows. Coordinates: building centred near the origin, the main door on the -z side, ground at y = 0,
// grid 2 m.
//
// Plans (lab/shapes.py counts in the corpus, after turning each build to its main axis): rectangle, long, square,
// L, T, U or courtyard, cross, octagon. A plan is a set of wings (rectangles), each with its own roof axis.
// Roofs: gable, cross-gable (a gable per wing, the lower wing's roof running into the main roof), hip (corner
// pieces at each ring, measured with lab/offsets.js), shed, flat with parapet, conical over an octagon.
// Roof layout measured in the corpus: a 2 m ridge cap on the ridge, rows centred 2, 4, 6 m out from it, each row's
// low edge on the beam at its outer edge, 26 degree pieces pivoting on the low edge and 45 degree pieces in the
// middle, gable pieces under each row pivoting on the row's low edge, hip corners at the row's low edge.
//
// Culture forms (styles.js "forms", shapes and sizes in docs/CULTURE_STYLES.md):
//   round   round house of eight walls under a ring roof; on stilts with a deck and a walkway for crannogs
//   tent    lavvu: a cone of roof rings from the ground, no walls
//   yurt    low lattice wall (braced plank) under a low cone with an open crown
//   gables  Icelandic turf farm: narrow houses side by side, wooden gable fronts, stone side and back walls
//   court   rooms on four sides of a yard, an arcade on the yard side, flat roofs
//   keep    square keep: stone with buttresses and a parapet, or timber with a pyramid roof in the Meadows
//   svan    stone house with a tall square tower at a back corner (s2 and s3)
//   tower-svan  the tower alone
//   dome    cross-in-square church: equal arms, four columns, a drum and a stepped dome over the crossing
//   drum    hall church with a drum and a cone over the middle
//   stave   tall plank walls on log posts, a low gallery roof all round
//   sunken  small hut with the roof down to the ground and the door in the gable end
//   open    posts and a roof, no walls
//   raised  storehouse on posts

const NODE = typeof module !== 'undefined';
const S = NODE ? require('./styles.js') : window.VHStyles;
const Decor = NODE ? require('./decorate.js') : window.VHDecorate;

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function quat(yaw) { const a = yaw * Math.PI / 360; return [0, +Math.sin(a).toFixed(6), 0, +Math.cos(a).toFixed(6)]; }
const norm = a => ((a % 360) + 360) % 360;
const reaches = (biome, b) => S.BIOMES.indexOf(biome) >= S.BIOMES.indexOf(b);

class Build {
  constructor() { this.pieces = []; this.rooms = []; this.notes = []; this.keys = new Set(); }
  put(name, x, y, z, yaw = 0, extra) {
    if (!name) return;
    yaw = norm(yaw);
    const key = `${name}|${Math.round(x * 100)}|${Math.round(y * 100)}|${Math.round(z * 100)}|${Math.round(yaw) % 360}`; // rounded so -0.00 and 0.00 match
    if (this.keys.has(key)) return; // the same piece in the same place once only (porch eaves, meeting wings)
    this.keys.add(key);
    this.pieces.push({ name, x: +x.toFixed(3), y: +y.toFixed(3), z: +z.toFixed(3), q: quat(yaw), yaw, ...(extra || {}) });
  }
}

// Wing-local (u along the ridge, v across, local yaw) to world. alpha is the wing's yaw: 0 = ridge along x,
// 270 = ridge along z (Unity's yaw maps local x to (cos a, -sin a)).
function toWorld(w, u, v, yaw) {
  const a = w.alpha * Math.PI / 180;
  return [w.cx + u * Math.cos(a) + v * Math.sin(a), w.cz - u * Math.sin(a) + v * Math.cos(a), norm(yaw + w.alpha)];
}
function inside(w, x, z, pad = 0) {
  const a = w.alpha * Math.PI / 180, dx = x - w.cx, dz = z - w.cz;
  const u = dx * Math.cos(a) - dz * Math.sin(a), v = dx * Math.sin(a) + dz * Math.cos(a);
  return Math.abs(u) < w.W + pad && Math.abs(v) < w.D + pad;
}

// ---------------------------------------------------------------- plan choice

const PLAN_BY_TYPE = {
  // weights per stage, from the corpus counts per category (category x plan), favouring Tyler's keepers
  home: { s1: { rect: 6, square: 3 }, s2: { rect: 5, L: 3, T: 2, square: 2, octagon: 0.6 }, s3: { T: 3, L: 3, rect: 2, cross: 1, octagon: 0.6 } },
  longhouse: { s1: { long: 1 }, s2: { long: 3, T: 1 }, s3: { long: 2, T: 2, cross: 1 } },
  tavern: { s1: { rect: 1 }, s2: { L: 2, T: 2, rect: 1 }, s3: { T: 2, cross: 1, U: 1 } },
  smithy: { s1: { rect: 2, square: 1 }, s2: { rect: 2, L: 1, T: 1 }, s3: { L: 2, T: 2, U: 1 } },
  sawmill: { s1: { rect: 1 }, s2: { rect: 2, L: 1 }, s3: { L: 1, rect: 1 } },
  workshop: { s1: { rect: 1 }, s2: { rect: 2, L: 1 }, s3: { L: 2, T: 1 } },
  barn: { s1: { rect: 1 }, s2: { rect: 2, long: 1 }, s3: { long: 1, L: 1 } },
  farm: { s1: { rect: 1 }, s2: { rect: 1 }, s3: { rect: 1, L: 1 } },
  storage: { s1: { rect: 1, square: 1 }, s2: { rect: 2, L: 1 }, s3: { L: 1, T: 1 } },
  tower: { s1: { square: 2, octagon: 1 }, s2: { square: 2, octagon: 1 }, s3: { square: 1, octagon: 1 } },
  dock: { s1: { rect: 1 }, s2: { rect: 1 }, s3: { rect: 1, L: 1 } },
  stall: { s1: { rect: 1 }, s2: { rect: 1 }, s3: { rect: 1, L: 1 } },
  temple: { s1: { rect: 1 }, s2: { rect: 1, cross: 1, octagon: 1 }, s3: { cross: 2, octagon: 1 } },
};
const ROOF_BY_CULTURE = {
  'norse': { gable: 6, hip: 2 }, 'black-forest': { gable: 5, hip: 2 }, 'swamp': { gable: 4, hip: 3 },
  'mountain': { gable: 6, hip: 1 }, 'middle-eastern': { flat: 1 }, 'east-asian': { hip: 4, gable: 1 },
  'castle-medieval': { gable: 5, hip: 2 }, 'dwarven': { flat: 2, hip: 1 }, 'slavic': { gable: 5, hip: 1 }, 'celtic': { gable: 1 },
  'celtic-crannog': { gable: 1 }, 'saami': { gable: 1 }, 'steppe': { gable: 1, hip: 1 },
};
// Wall styles per biome: counts of the main wall style in the corpus by material palette (lab/shapes.py).
const WALLS_BY_BIOME = {
  'Meadows': { 'half-timber': 144, plank: 110 },
  'Black Forest': { stone: 151, 'stone-base': 41, log: 34, plank: 15, 'half-timber': 10 },
  'Swamp': { stone: 36, 'stone-base': 33, 'half-timber': 27, plank: 25, log: 11 },
  'Mountain': { 'stone-base': 8, stone: 7, plank: 4, 'half-timber': 3 },
  'Plains': { 'stone-base': 10, 'half-timber': 10, plank: 8, stone: 6 },
  'Mistlands': { marble: 36, stone: 11, plank: 10 },
  'Ashlands': { grausten: 77, plank: 61, 'stone-base': 61, 'half-timber': 61, stone: 41 },
};
const WALLS_BY_CULTURE = {
  'black-forest': { log: 3, 'stone-base': 2, stone: 1 }, 'slavic': { log: 1 }, 'middle-eastern': { stone: 1 },
  'dwarven': { stone: 1 }, 'castle-medieval': { 'stone-base': 3, stone: 1 }, 'east-asian': { 'half-timber': 1 },
  'mountain': { 'stone-base': 2, stone: 1 },
};
function wallStyleFor(R, C, cultureKey, biome) {
  const w = { ...(C.walls || WALLS_BY_CULTURE[cultureKey] || WALLS_BY_BIOME[biome] || { plank: 1 }) };
  if (biome === 'Meadows') { delete w.stone; delete w['stone-base']; delete w.log; } // no stone or core wood yet
  if (C.early) { delete w.stone; delete w['stone-base']; delete w.marble; } // wood first (D-012)
  if (!Object.keys(w).length) w.plank = 1;
  return pick(R, w);
}

function pick(R, weights) {
  const e = Object.entries(weights), tot = e.reduce((s, [, w]) => s + w, 0);
  let x = R() * tot;
  for (const [k, w] of e) { if ((x -= w) <= 0) return k; }
  return e[0][0];
}

function formFor(C, type, stage) {
  const f = C.forms && C.forms[type];
  if (!f) return null;
  return typeof f === 'string' ? f : (f[stage] || null);
}

// Wings for a plan, from the main wing's half sizes W (along x) and D (across, odd). Every wing's cells must fall on
// the main wing's 2 m grid, so a side wing runs through the main wing's whole depth and out the other side: its half
// length is D plus the part that sticks out, and its centre sits on the right parity.
function wingsFor(plan, W, D, R, o = {}) {
  const odd = n => (n % 2 ? n : n + 1);
  const wD = Math.max(1, odd(D - 2)); // side wings are a bay narrower
  const ext = Math.max(2, Math.ceil(D * 0.8)); // how far a wing sticks out, metres in 2 m steps below
  const out = 2 * Math.round(ext / 2);
  const main = { cx: 0, cz: 0, W, D, alpha: 0, main: true };
  const mid = (W % 2 === wD % 2) ? 0 : 1; // centre x for a wing in the middle, on the grid
  switch (plan) {
    case 'L': {
      const side = R() < 0.5 ? -1 : 1;
      return [main, { cx: side * (W - wD), cz: -out / 2, W: D + out / 2, D: wD, alpha: 270 }];
    }
    case 'T':
      return [main, { cx: mid, cz: out / 2, W: D + out / 2, D: wD, alpha: 270 }];
    case 'cross':
      return [main, { cx: mid, cz: 0, W: D + out, D: wD, alpha: 270 }];
    case 'greek':
      // equal arms of the same width crossing in the middle (cross-in-square church)
      return [main, { cx: 0, cz: 0, W, D, alpha: 270 }];
    case 'nave': {
      // a narrower chancel in line at the +x end (2 cells long, a bay narrower)
      return [main, { cx: W + 2, cz: 0, W: 2, D: wD, alpha: 0 }];
    }
    case 'U': {
      // wings at both ends with a yard of at least 4 m between them (the main wing is widened when it is too short)
      const uD = Math.min(wD, 3), Wu = Math.max(W, 2 * uD + 3);
      main.W = Wu;
      return [main, { cx: -(Wu - uD), cz: -out / 2 - 1, W: D + out / 2 + 1, D: uD, alpha: 270 },
        { cx: Wu - uD, cz: -out / 2 - 1, W: D + out / 2 + 1, D: uD, alpha: 270 }];
    }
    case 'court': {
      // four wings dW cells deep round a yard; the outer square is 2Q metres; the front wing holds the gate
      const { Q, dW } = o;
      return [{ cx: 0, cz: -(Q - dW), W: Q, D: dW, alpha: 0, main: true }, { cx: 0, cz: Q - dW, W: Q, D: dW, alpha: 0 },
        { cx: -(Q - dW), cz: 0, W: Q - 2 * dW, D: dW, alpha: 270 }, { cx: Q - dW, cz: 0, W: Q - 2 * dW, D: dW, alpha: 270 }];
    }
    case 'gables': {
      // n narrow houses side by side, ridges front to back, fronts in one line; the middle one may run deeper
      const { n, deeper } = o, ws = [];
      for (let k = 0; k < n; k++) {
        const middle = n % 2 === 1 && k === (n - 1) / 2, Wk = W + (middle && deeper ? 1 : 0);
        ws.push({ cx: (k - (n - 1) / 2) * 2 * D, cz: Wk - W, W: Wk, D, alpha: 270, main: middle || (n % 2 === 0 && k === 0) });
      }
      return ws.sort((a, c) => (c.main ? 1 : 0) - (a.main ? 1 : 0));
    }
    default:
      return [main];
  }
}

// Floor cells (2 m, keyed by centre) and the outside edges of their union.
function cellsOf(wings) {
  const cells = new Map();
  for (const w of wings) {
    const a = w.alpha === 270 || w.alpha === 90;
    const hx = a ? w.D : w.W, hz = a ? w.W : w.D;
    for (let x = w.cx - hx + 1; x < w.cx + hx; x += 2) for (let z = w.cz - hz + 1; z < w.cz + hz; z += 2) cells.set(`${x},${z}`, [x, z]);
  }
  return cells;
}
function edgesOf(cells) {
  const out = [];
  for (const [, [x, z]] of cells) {
    for (const [dx, dz, yaw, inYaw] of [[0, -2, 0, 0], [0, 2, 0, 180], [-2, 0, 90, 90], [2, 0, 90, 270]]) {
      if (cells.has(`${x + dx},${z + dz}`)) continue;
      out.push({ x: x + dx / 2, z: z + dz / 2, yaw, inYaw, out: [dx / 2, dz / 2], cell: [x, z] });
    }
  }
  return out;
}
function vertsOf(edges) {
  const m = new Map();
  for (const e of edges) {
    const ux = e.yaw === 0 ? 1 : 0, uz = e.yaw === 0 ? 0 : 1;
    for (const s of [-1, 1]) { const x = e.x + s * ux, z = e.z + s * uz; m.set(`${x},${z}`, [x, z]); }
  }
  return [...m.values()];
}
// yaw of a slope piece whose low edge faces out (rises toward the building), from the edge's outward direction
function slopeYaw(out) { return out[1] < 0 ? 180 : out[1] > 0 ? 0 : out[0] < 0 ? 270 : 90; }

// ---------------------------------------------------------------- generator

function generate(req) {
  const type = S.TYPES[req.type] ? req.type : 'home';
  const T = { ...S.TYPES[type] };
  const biome = S.BIOMES.includes(req.biome) ? req.biome : 'Meadows';
  const seed = req.seed ?? 1;
  const cultureKey = S.CULTURES[req.culture] ? req.culture : S.cultureFor(biome, rng(seed * 104729 + type.length * 13 + 7));
  const C = { ...S.CULTURES[cultureKey], biome };
  const stage = ['s1', 's2', 's3'].includes(req.stage) ? req.stage : 's1';
  const decor = ['d1', 'd2', 'd3'].includes(req.decor) ? req.decor : 'd2';
  const R = rng(seed * 7919 + type.length * 31 + stage.charCodeAt(1) * 7 + cultureKey.length);
  const K = S.roofKit(S.kitFor(biome), C, biome);
  const b = new Build();
  const form = req.form || formFor(C, type, stage);
  const info = { type, biome, cultureKey, stage, decor, seed, form };
  // Meadows and Black Forest villages build in wood at first; stone for later stages and for halls from s2 (D-012)
  const early = (biome === 'Meadows' || biome === 'Black Forest') && (stage === 's1' || (stage === 's2' && !['longhouse', 'tavern', 'temple', 'tower'].includes(type)));
  C.early = early;
  const stoneOK = !!K.stoneWall && biome !== 'Meadows' && !early;
  const storeysOf = () => (C.storeys && C.storeys[type] && C.storeys[type][stage]) || T.storeys[stage];

  if (T.well) return finish(wellDesign(b, K, biome, stage), info);
  if (T.camp && !form) return finish(campDesign(b, K, biome, stage, R, decor), info);

  let plan = req.plan && req.plan !== 'auto' ? req.plan : null;

  // ---- round forms: round houses, crannogs, goahti, lavvu, yurts, round towers
  if (['round', 'tent', 'yurt'].includes(form) || plan === 'octagon' || (!plan && T.camp)) {
    const kind = form === 'tent' || form === 'yurt' ? form : (T.camp ? 'tent' : 'round');
    const [bx, bz] = T.bays[stage];
    const avg = Math.round((bx + bz) / 2);
    const side = (C.size && C.size[type] && C.size[type][stage]) || (avg >= 7 ? 6 : avg >= 4 ? 4 : 2);
    const storeys = T.tower ? T.storeys[stage] : 1;
    const r = kind === 'yurt' ? 1 : (C.pitch === 26 && kind === 'round' ? 1 : 2);
    const SH = T.tower ? 3 : 2;
    const F = C.stilts ? (C.stiltH || 2) : (T.raised || C.raised ? 1 : 0);
    let wallStyle = req.walls && req.walls !== 'auto' ? req.walls : wallStyleFor(R, C, cultureKey, biome);
    if (T.tower && stoneOK) wallStyle = 'stone';
    if (/stone/.test(wallStyle) && !stoneOK && !reaches(biome, 'Swamp')) wallStyle = 'plank';
    C.wallStyle = wallStyle;
    const Kr = kind === 'tent' && reaches(biome, 'Swamp') ? { ...K, ...S.ROOF_SETS.dark } : K;
    octagonDesign(b, Kr, C, { side, F, SH, storeys, r, T, kind, stage, deck: C.stilts ? (C.deck || 2) : 0,
      walk: C.boardwalk ? { s1: 6, s2: 8, s3: 10 }[stage] : 0, fence: !!C.stilts && stage === 's3' });
    info.plan = 'octagon'; info.roof = kind === 'yurt' ? 'crown' : 'conical'; info.walls = kind === 'tent' ? 'none' : wallStyle;
    Decor.decorate(b, { use: T.use, decor, biome, type, R, culture: cultureKey, doorX: b.doorX });
    clearDoors(b);
    return finish(b, info);
  }

  // ---- a square stone tower alone (Svan)
  if (form === 'tower-svan') {
    C.wallStyle = stoneOK ? 'stone' : 'plank';
    towerAt(b, K, C, { cx: 0, cz: 0, n: 3, F: 0, storeys: { s1: 4, s2: 5, s3: 6 }[stage], SH: 3, door: 'front', use: 'guard' });
    info.plan = 'square'; info.roof = 'hip'; info.walls = C.wallStyle;
    b.notes.push('Square stone tower with wooden floors, slit windows and a low pyramid roof.');
    Decor.decorate(b, { use: 'guard', decor, biome, type, R, culture: cultureKey, doorX: b.doorX });
    clearDoors(b);
    return finish(b, info);
  }

  // ---- plan and roof
  if (form === 'sunken') Object.assign(C, { eaves: 2, porch: 0, pitch: 45 });
  if (!plan) {
    const fixed = { gables: 'gables', court: 'court', keep: 'square', svan: 'rect', drum: 'rect', stave: 'rect', sunken: 'rect' }[form];
    if (fixed) plan = fixed;
    else if (form === 'dome') plan = stage === 's1' ? 'square' : 'greek';
    else if (C.courtyard && stage === 's3' && !T.tower && type === 'home') plan = 'U';
    else {
      const w = { ...((C.plans && C.plans[type] && C.plans[type][stage]) || (PLAN_BY_TYPE[type] || PLAN_BY_TYPE.home)[stage]) };
      // round plans belong to Norse, Celtic, Black Forest and Mountain building in the corpus; flat-roofed styles never
      if (!['norse', 'black-forest', 'mountain', 'swamp', 'norse-forest'].includes(cultureKey) && type !== 'tower') delete w.octagon;
      if (!['home', 'tavern', 'smithy'].includes(type)) delete w.U;
      if (form === 'raised' || form === 'open') { delete w.L; delete w.T; delete w.U; delete w.cross; delete w.octagon; }
      plan = pick(R, Object.keys(w).length ? w : { rect: 1 });
    }
  }
  let roofKind = req.roof && req.roof !== 'auto' ? req.roof : null;
  if (!roofKind) {
    if (plan === 'court') roofKind = 'flat';
    else if (['gables', 'greek', 'nave'].includes(plan) || ['drum', 'stave', 'sunken', 'svan'].includes(form) || (form === 'dome')) roofKind = 'gable';
    else if (form === 'keep') roofKind = stoneOK ? 'flat' : 'hip';
    else roofKind = plan === 'octagon' ? 'conical' : pick(R, C.roofs || ROOF_BY_CULTURE[cultureKey] || { gable: 1 });
  }
  if (T.open === 'sides' && !req.roof && R() < 0.4) roofKind = 'shed';
  if (plan === 'octagon' && roofKind !== 'flat') roofKind = 'conical';
  if (plan !== 'octagon' && roofKind === 'conical') roofKind = 'hip';
  if (roofKind === 'shed' && plan !== 'rect' && plan !== 'long' && plan !== 'square') plan = 'rect';
  if (roofKind === 'hip' && ['gables', 'court', 'greek', 'nave', 'U'].includes(plan)) roofKind = 'gable';
  let wallStyle = req.walls && req.walls !== 'auto' ? req.walls : wallStyleFor(R, C, cultureKey, biome);
  if (form === 'keep') wallStyle = stoneOK ? 'stone' : (biome === 'Meadows' ? 'half-timber' : wallStyle);
  if (form === 'stave') wallStyle = 'plank';
  if (C.typeWalls && C.typeWalls[type] && !req.walls) wallStyle = C.typeWalls[type];
  if (plan === 'gables') wallStyle = stoneOK ? 'stone' : 'plank';
  C.wallStyle = wallStyle;
  if (form === 'keep' && stoneOK) Object.assign(C, { stoneWalls: true, parapet: true });
  if (form === 'open') T.open = 'all';
  info.plan = plan; info.roof = roofKind; info.walls = wallStyle;

  // ---- size
  let [bx, bz] = (C.bays && C.bays[type] && C.bays[type][stage]) || T.bays[stage];
  const wingOpts = {};
  if (plan === 'gables') {
    const n = { home: [1, 2, 3], longhouse: [2, 3, 3], tavern: [2, 3, 3], temple: [1, 1, 2] }[type] || [1, 1, 2];
    const depth = { home: [4, 4, 5], longhouse: [5, 5, 6], tavern: [5, 5, 6], temple: [4, 5, 5] }[type] || [3, 3, 4];
    const i = +stage[1] - 1;
    Object.assign(wingOpts, { n: n[i], deeper: ['home', 'longhouse', 'tavern'].includes(type) && stage === 's3' });
    bx = depth[i]; bz = 3;
  } else if (plan === 'court') {
    Object.assign(wingOpts, { Q: stage === 's3' && type !== 'home' ? 8 : 6, dW: 2 });
    bx = wingOpts.Q; bz = 2;
  } else if (form === 'keep') { bx = bz = { s1: 3, s2: 3, s3: 5 }[stage]; }
  else if (form === 'dome') { bx = { s1: 3, s2: 5, s3: 7 }[stage]; bz = { s1: 3, s2: 3, s3: 5 }[stage]; }
  else if (form === 'stave' || form === 'drum') { bx = { s1: 3, s2: 4, s3: 5 }[stage]; bz = 3; }
  else if (form === 'sunken') { bx = { s1: 2, s2: 3, s3: 4 }[stage]; bz = 3; }
  else {
    if (plan === 'long') bx = Math.max(bx + 2, Math.round(bz * 2.4));
    if (!T.tower && R() < 0.5 && plan !== 'square') bx += 1;
    if (!T.tower && stage !== 's1' && R() < 0.3 && plan !== 'square') bz += 1;
    if (bz % 2 === 0 && roofKind !== 'flat') bz += 1; // a ridge over a bay centre
    if (plan === 'square') bx = bz = Math.max(bx, bz) % 2 ? Math.max(bx, bz) : Math.max(bx, bz) + 1;
    if (roofKind === 'hip' && bx < bz) bx = bz;
  }
  let W = bx; const D = bz;
  const storeys = form === 'open' ? 1 : ['keep'].includes(form) ? { s1: 2, s2: 3, s3: 3 }[stage] : ['stave', 'court', 'dome', 'drum', 'sunken', 'gables'].includes(form) || plan === 'gables' ? 1 : storeysOf();
  let SH = T.low ? 2 : T.tower ? 3 : (['longhouse', 'tavern', 'temple'].includes(type) || stage === 's3') ? 3 : 2;
  if (form === 'keep' || plan === 'court') SH = 3;
  if (form === 'stave') SH = 4;
  if (plan === 'gables' || form === 'sunken') SH = 2;
  if (form === 'open') SH = 3;
  if (C.storeyH && !T.low) SH = Math.max(SH, C.storeyH);
  const flat = roofKind === 'flat';
  const pitch = req.pitch || (T.low || roofKind === 'shed' ? 26 : (C.pitch || 45));
  const r = +pitch === 45 ? 2 : 1;
  const lookout = T.tower && !['keep'].includes(form);

  // ---- foundation height
  let F = 0;
  const stoneBase = (C.plinth === 'stone' || (C.plinth === 'byBiome' && biome !== 'Meadows') || C.stoneGround) && K.plinth && !early;
  const podklet = C.podklet && stage !== 's1' && ['home', 'longhouse', 'tavern'].includes(type);
  if (plan === 'gables') F = 0; else if (T.dock) F = 1; else if (C.stilts) F = C.stiltH || 2; else if (podklet) F = 2; else if (form === 'raised') F = C.storeH || 1;
  else if (T.raised || C.raised) F = C.stiltChance && R() < C.stiltChance ? 2 : 1; else if (stoneBase) F = C.plinthHigh ? 2 : 1;
  const deck = C.stilts && plan !== 'octagon' ? (C.deck || 2) : 0;

  const wings = wingsFor(plan, W, D, R, wingOpts);
  W = wings[0].W; // a U plan may widen the main wing
  const cells = cellsOf(wings);
  const edges = edgesOf(cells);
  const verts = vertsOf(edges);

  // courtyard: cells next to the yard are a gallery; their yard side is an arcade
  const Q = wingOpts.Q;
  const inYard = (x, z) => plan === 'court' && Math.abs(x) < Q && Math.abs(z) < Q && !cells.has(`${x},${z}`);
  const arcade = new Set(edges.filter(e => inYard(e.cell[0] + 2 * e.out[0], e.cell[1] + 2 * e.out[1])));
  const gallery = new Set([...arcade].map(e => `${e.cell[0]},${e.cell[1]}`));

  // footing: stilts and short posts on a grid, a log ground storey, or a stone course round the edge
  if (F > 0) {
    if (podklet) {
      for (const e of edges) for (let y = 0; y < F - 0.01; y += 0.5) b.put('wood_wall_log', e.x, y + 0.25, e.z, e.yaw);
      b.notes.push('Log ground storey (podklet) for storage under the living floor.');
    } else if (C.stilts || T.dock || T.raised || C.raised || form === 'raised' || !stoneBase) {
      const grid = new Map(verts.map(v => [`${v[0]},${v[1]}`, v]));
      if (deck) for (const [, [x, z]] of cells) for (const dx of [-1, 1]) for (const dz of [-1, 1]) for (let k = 0; k <= 1; k++) { const vx = x + dx * (1 + k * 2), vz = z + dz * (1 + k * 2); grid.set(`${vx},${vz}`, [vx, vz]); }
      for (const [, [x, z]] of grid) for (let y = 0; y < F - 0.01; y += (F >= 2 ? 2 : 1)) b.put(F >= 2 ? K.pole : K.pole1, x, y + (F >= 2 ? 1 : 0.5), z);
    } else {
      for (let y = 0.5; y < F; y += 1) for (const e of edges) b.put(K.plinth, e.x, y, e.z, e.yaw);
    }
  }

  // floors (and a deck all round on stilts)
  const floorPiece = (C.stoneWalls && K.stoneFloor && F === 0) ? K.stoneFloor : K.floor;
  const floorY = floorPiece === 'stone_floor_2x2' ? F - 0.5 : F;
  const floorCells = new Map(cells);
  if (deck) for (const [, [x, z]] of cells) for (let dx = -deck; dx <= deck; dx += 2) for (let dz = -deck; dz <= deck; dz += 2) floorCells.set(`${x + dx},${z + dz}`, [x + dx, z + dz]);
  for (const [k, [x, z]] of floorCells) b.put(cells.has(k) ? floorPiece : K.floor, x, cells.has(k) ? floorY : F, z);

  // door: the front edge of the main wing nearest the middle; in a sunken hut, the middle of the left gable end
  let door;
  if (form === 'sunken') door = edges.filter(e => e.out[0] < 0 && inside(wings[0], e.cell[0], e.cell[1])).sort((a, c) => Math.abs(a.z) - Math.abs(c.z))[0];
  if (!door) {
    const front = edges.filter(e => e.out[1] < 0 && inside(wings[0], e.cell[0], e.cell[1])).sort((a, c) => Math.abs(a.x - wings[0].cx) - Math.abs(c.x - wings[0].cx));
    door = front.length ? front[0] : edges.filter(e => e.out[1] < 0)[0] || edges[0];
  }
  const doorX = door.x, doorZ = door.z;
  const backDoor = C.opposedDoors && !T.tower && form !== 'sunken'
    ? edges.filter(e => e.out[1] > 0 && inside(wings[0], e.cell[0], e.cell[1])).sort((a, c) => Math.abs(a.x - doorX) - Math.abs(c.x - doorX))[0] : null;
  if (backDoor) b.notes.push('Doors in the middle of both long sides.');

  // walls, frame and top plates per storey
  const open = T.open || null;
  let top = F;
  const hole = [...cells.values()].sort((a, c) => (c[0] + c[1]) - (a[0] + a[1]))[0];
  for (let s = 0; s < storeys; s++) {
    const y0 = F + s * SH;
    if (s > 0) {
      for (const [, [x, z]] of cells) if (!(x === hole[0] && z === hole[1])) b.put(K.floor, x, y0, z);
      b.put(K.ladder, hole[0], y0 - SH / 2, hole[1], 180);
    }
    const isTopLookout = lookout && s === storeys - 1;
    for (const e of edges) {
      if (isTopLookout) { b.put(K.fence || K.wallQuarter, e.x, y0 + 0.5, e.z, e.yaw); continue; }
      if (open === 'all') continue;
      if (open === 'front' && e.out[1] < 0) continue;
      if (open === 'sides' && !(e.out[1] > 0)) continue;
      if (arcade.has(e)) continue;
      const isDoor = s === 0 && (e === door || e === backDoor);
      const isGate = T.bigDoor && s === 0 && e.out[1] < 0 && Math.abs(e.x - doorX) <= 2.01 && Math.abs(e.z - doorZ) < 0.1;
      let isWindow = !isDoor && !isGate && (!T.tower || (form === 'keep' && s > 0)) && (Math.round((e.x + e.z) / 2) % 2 === 0) && Math.abs(e.x - doorX) + Math.abs(e.z - doorZ) > 2.5;
      if (plan === 'gables' && e.out[1] >= 0) isWindow = false;
      const style = C.frontWood && plan === 'gables' ? (e.out[1] < 0 ? 'plank' : null) : null;
      wallSegment(b, K, C, e.x, y0, e.z, e.yaw, SH, isGate ? 'gate' : isDoor ? 'door' : isWindow ? 'window' : 'wall', style);
    }
    if (C.frame || open || T.tower || form === 'stave') for (const [x, z] of verts) {
      for (let y = y0; y < y0 + SH - 0.01;) { const h = (y0 + SH - y) >= 2 ? 2 : 1; b.put(h === 2 ? framePole(K, C) : K.pole1, x, y + h / 2, z); y += h; }
    }
    for (const e of edges) b.put(K.beam, e.x, y0 + SH, e.z, e.yaw);
    for (const w of wings) {
      const a = w.alpha === 270;
      const room = { x0: w.cx - (a ? w.D : w.W), x1: w.cx + (a ? w.D : w.W), z0: w.cz - (a ? w.W : w.D), z1: w.cz + (a ? w.W : w.D),
        y: y0, h: SH, use: T.use, upper: s > 0, door: s === 0 && w.main ? { x: doorX, z: doorZ } : null, main: !!w.main, slots: [] };
      for (const e of edges) {
        if (!(e.cell[0] > room.x0 && e.cell[0] < room.x1 && e.cell[1] > room.z0 && e.cell[1] < room.z1)) continue;
        if (s === 0 && Math.abs(e.x - doorX) + Math.abs(e.z - doorZ) < 1.8) continue;
        if (backDoor && s === 0 && Math.abs(e.x - backDoor.x) + Math.abs(e.z - backDoor.z) < 1.8) continue;
        if (open === 'all' || (open === 'front' && e.out[1] < 0) || (open === 'sides' && !(e.out[1] > 0)) || arcade.has(e)) continue;
        const ux = e.yaw === 0 ? 1 : 0, uz = e.yaw === 0 ? 0 : 1, nx = -e.out[0], nz = -e.out[1];
        for (const t of [-0.5, 0.5]) room.slots.push({ x: e.x + ux * t, z: e.z + uz * t, y: y0, yaw: e.inYaw, nx, nz });
      }
      if (s > 0) room.hole = hole;
      if (form === 'open') delete room.slots; // no walls: things stand along the edges of the floor
      b.rooms.push(room);
    }
    top = y0 + SH;
  }
  b.doorX = doorX;

  // courtyard: walls between the gallery and the rooms behind it, one door per wing, the arcade on the yard side
  if (plan === 'court') {
    const inner = [];
    for (const k of gallery) {
      const [x, z] = k.split(',').map(Number);
      for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
        const nk = `${x + dx},${z + dz}`;
        if (cells.has(nk) && !gallery.has(nk)) inner.push({ x: x + dx / 2, z: z + dz / 2, yaw: dx ? 90 : 0 });
      }
    }
    const doors = new Set();
    wings.forEach((w, i) => {
      const own = inner.filter(e => inside(w, e.x, e.z, 0.01));
      const target = i === 0 ? [doorX, w.cz] : [w.cx, w.cz];
      own.sort((a, c) => Math.hypot(a.x - target[0], a.z - target[1]) - Math.hypot(c.x - target[0], c.z - target[1]));
      if (own[0]) doors.add(own[0]);
    });
    for (const e of inner) wallSegment(b, K, C, e.x, F, e.z, e.yaw, SH, doors.has(e) ? 'door' : 'wall');
    arcadeAlong(b, K, [...arcade], F, SH);
    b.notes.push('Rooms on four sides of a yard, an arcade on the yard side.');
  }

  // inner aisle posts for halls
  if (T.aisles && D >= 3 && plan === 'long') for (let x = -W + 2; x <= W - 2; x += 2) for (const z of [-(D - 2), D - 2])
    for (let y = F; y < top - 0.01; y += 2) b.put(framePole(K, C), x, y + 1, z);

  // ---- roof
  const fireInside = ['hall', 'home', 'smithy', 'temple'].includes(T.use) && !T.tower;
  const roofTop = lookout ? F + (storeys - 1) * SH + 3 : top;
  // places where a drum, a dome or a tower stands instead of roof
  const holes = [];
  const domeCfg = form === 'dome' ? { x: 0, z: 0, side: D >= 5 ? 4 : 2 } : form === 'drum' ? { x: 0, z: 0, side: 2 } : null;
  if (domeCfg) { const ap = domeCfg.side / 2 / Math.tan(Math.PI / 8); holes.push({ x0: -ap - 0.6, x1: ap + 0.6, z0: -ap - 0.6, z1: ap + 0.6 }); }
  if (form === 'dome' && plan === 'greek') holes.push({ x0: -D, x1: D, z0: -D, z1: D });
  const svanTower = form === 'svan' && stage !== 's1' ? { cx: W - 3, cz: D + 3, n: 3 } : null;
  if (svanTower) holes.push({ x0: W - 6, x1: W + 0.01, z0: D - 0.01, z1: D + 6 });
  const inHole = p => holes.some(h => p.x > h.x0 && p.x < h.x1 && p.z > h.z0 && p.z < h.z1);
  if (flat && !lookout) flatRoof(b, K, C, cells, edges, top, F, SH, biome);
  else if (roofKind === 'shed') shedRoof(b, K, wings[0], roofTop, r);
  else {
    const parts = [];
    for (const w of wings) {
      const others = wings.filter(o => o !== w);
      // a gable end is built unless it runs into a wing at least as wide (a narrower chancel or porch runs into it)
      const ends = [-1, 1].map(sg => { const [x, z] = toWorld(w, sg * (w.W + 0.5), 0, 0); return !others.some(o => inside(o, x, z) && o.D >= w.D); });
      const kind = roofKind === 'hip' && w.main && w.W >= w.D ? 'hip' : 'gable';
      const vent = fireInside && w.main && !domeCfg ? (T.use === 'home' ? doorX : 0) : null;
      parts.push(...(kind === 'hip' ? hipPieces(K, w, roofTop, r, C.eaves, { kick: C.kick }) : gablePieces(K, C, w, roofTop, r, ends, vent)));
    }
    // where wings cross, keep the higher roof so the lower roof runs into the higher one
    const placed = new Set();
    for (const p of parts) {
      const key = `${p.name}|${Math.round(p.x * 100)}|${Math.round(p.y * 100)}|${Math.round(p.z * 100)}|${Math.round(p.yaw) % 360}`;
      if (placed.has(key)) continue; // two wings can lay the same piece where they meet
      placed.add(key);
      if (inHole(p) && p.role !== 'gable') continue;
      const hidden = wings.some(o => o !== p.wing && inside(o, p.x, p.z, -0.2) && p.surf < surfaceAt(o, p.x, p.z, roofTop, r) - 0.25);
      if (!hidden) b.put(p.name, p.x, p.y, p.z, p.yaw);
    }
    if (fireInside && !domeCfg) b.notes.push('Ridge cap left open over the fire for smoke.');
  }

  // porch at the front door: one or three bays wide, on the grid, never on top of a wing
  if (!flat && roofKind !== 'shed' && !T.dock && !T.tower && C.porch && R() < C.porch + (stage === 's1' ? -0.3 : 0.2) && !['U', 'cross', 'court', 'gables', 'greek'].includes(plan) && !deck && !podklet && form !== 'sunken') {
    const h = R() < 0.5 ? 0 : 1, zf = doorZ;
    const bays = [];
    for (let k = -h; k <= h; k++) { const x = doorX + 2 * k; if (!cells.has(`${x},${zf - 1}`) && !cells.has(`${x},${zf - 3}`)) bays.push(x); }
    if (bays.length) {
      const posts = new Set();
      for (const x of bays) { b.put(K.floor, x, F, zf - 1); posts.add(x - 1); posts.add(x + 1); }
      const taken = new Set(verts.map(([vx, vz]) => `${vx},${vz}`));
      for (const x of posts) {
        if (taken.has(`${x},${zf - 2}`)) continue; // a wing's corner post already stands here
        for (let y = 0; y < F - 0.01; y += 1) b.put(K.pole1, x, y + 0.5, zf - 2);
        b.put(framePole(K, C), x, F + 1, zf - 2);
      }
      for (const x of bays) b.put((biome === 'Meadows' || biome === 'Black Forest') ? K.roof26 : 'darkwood_roof', x, F + 2, zf - 1, 180);
    }
  }

  // a way up to a raised door: a landing and a stair from the ground (2 m up), or a stair at the front of a deck
  if (F >= 1.99 && door.out[1] < 0 && !T.tower) {
    if (deck) {
      const zEdge = Math.min(...[...floorCells.values()].map(([, z]) => z)) - 1;
      stairUp(b, K, doorX, zEdge, F);
    } else if (!C.boardwalk) {
      b.put(K.floor, doorX, F, doorZ - 1);
      for (const x of [doorX - 1, doorX + 1]) for (let y = 0; y < F - 0.01; y += 1) b.put(K.pole1, x, y + 0.5, doorZ - 2);
      stairUp(b, K, doorX, doorZ - 2, F);
    }
  }
  if (C.boardwalk && door.out[1] < 0 && !T.tower) {
    boardwalk(b, K, doorX, doorZ, Math.max(F, 0), { s1: 4, s2: 6, s3: 8 }[stage]);
    b.notes.push('Timber walkway out from the door; lay it over wet ground or water.');
  }

  // desert houses: a well in the yard of a U plan, a tall stone tower at a back corner of large ones
  if (cultureKey === 'middle-eastern' && !T.tower && plan !== 'court') {
    if (plan === 'U') {
      // pave the yard between the wings
      const zmin = wings[1].cz - wings[1].W;
      const pave = K.stoneFloor || K.floor;
      for (let x = -W + 1; x < W; x += 2) for (let z = zmin + 1; z < -D; z += 2)
        if (!cells.has(`${x},${z}`)) b.put(pave, x, pave === 'stone_floor_2x2' ? -0.5 : 0, z);
      const yz = Math.round((zmin - D) / 2);
      const well = new Build(); wellDesign(well, K, biome, 's1');
      for (const p of well.pieces) b.put(p.name, p.x, p.y, p.z + yz, p.yaw);
    }
    if ((stage === 's3' && type === 'home') || type === 'temple') {
      stoneTowerAt(b, K, W + 1, D - 1, top + 6, F);
      b.notes.push('Tall stone tower at a back corner, after the desert style.');
    }
  }
  if (plan === 'court') {
    const yard = Q - 2 * wingOpts.dW, pave = K.stoneFloor || K.floor;
    for (let x = -yard + 1; x < yard; x += 2) for (let z = -yard + 1; z < yard; z += 2) b.put(pave, x, pave === 'stone_floor_2x2' ? -0.5 : 0, z);
    const well = new Build(); wellDesign(well, K, biome, 's1');
    for (const p of well.pieces) b.put(p.name, p.x, p.y, p.z, p.yaw);
    if (stage === 's3' && type !== 'home') {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) stoneTowerAt(b, K, sx * (Q + 1), sz * (Q + 1), top + 2, 0, true);
      b.notes.push('Corner towers, after the caravanserais.');
    }
  }

  // forms that add to the shell
  if (domeCfg) {
    const ap = domeCfg.side / 2 / Math.tan(Math.PI / 8);
    if (form === 'dome') {
      // four columns at the corners of the middle bay carry the ceiling the drum stands on
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) column(b, K, sx * 2, sz * 2, F, top);
    }
    const ceiling = [...cells.values()].filter(([x, z]) => Math.abs(x) < ap + 1 && Math.abs(z) < ap + 1 && !(Math.abs(x) < 1.01 && Math.abs(z) < 1.01));
    const capY = capOf(wings[0], top, r);
    const h = Math.max(2, Math.ceil(capY - top) + (form === 'drum' ? 3 : 2));
    domeOn(b, K, C, { x: 0, z: 0, side: domeCfg.side, y: top, h, ceiling, cone: form === 'drum' });
    b.notes.push(form === 'dome' ? 'Dome on a drum over the crossing, stepped from vanilla roof rings.' : 'Drum with a cone over the middle of the hall.');
  }
  if (form === 'stave') {
    skirtRoof(b, K, edges, F + 2);
    b.notes.push('Low gallery roof all round on posts, after the stave churches.');
  }
  if (form === 'keep' && stoneOK) {
    // flat buttresses at the middle of each side, the full height of the walls
    for (const e of edges) {
      const mid = e.yaw === 0 ? Math.abs(e.x) < 1.01 : Math.abs(e.z) < 1.01;
      if (!mid || e === door) continue;
      for (let y = 0.5; y < top; y += 1) b.put(K.stoneBlock || 'stone_wall_1x1', e.x + e.out[0], y, e.z + e.out[1], e.yaw);
    }
    b.notes.push('Stone keep with flat buttresses and a parapet; Norman keeps often had their door on the first floor.');
  }
  if (svanTower) {
    const houseTop = top;
    towerAt(b, K, C, { cx: svanTower.cx, cz: svanTower.cz, n: 3, F, storeys: stage === 's3' ? 5 : 4, SH: 3, door: 'right', use: 'guard',
      skip: (e, y0, sh) => e.out[1] < 0 && y0 + sh <= houseTop + 0.01 });
    b.notes.push('Tall square tower at a back corner of the house.');
  }

  if (T.dock) dockDesign(b, K, W, D, F, stage);
  if (T.field) fieldDesign(b, K, W, D, biome, stage, R);
  if (T.pen) penDesign(b, K, W, D, stage);
  if (roofKind === 'gable' && plan !== 'gables' && ((C.dragons && ['longhouse', 'temple', 'tavern'].includes(type)) || (C.carved && stage !== 's1')))
    for (const sx of [-1, 1]) b.put('wood_dragon1', sx * (W + 0.6), roofTop + r * (D - 1) / 2 + 0.3, 0, sx > 0 ? 90 : 270);

  Decor.decorate(b, { use: T.use, decor, biome, type, R, culture: cultureKey, doorX: b.doorX });
  clearDoors(b);
  return finish(b, info);
}

// Last pass: take out any furniture standing in a doorway, inside or out.
function clearDoors(b) {
  const Ck = NODE ? require('./checks.js') : window.VHChecks;
  const doors = b.pieces.filter(p => /door|gate/.test(p.name));
  b.pieces = b.pieces.filter(p => {
    if (!p.decor) return true;
    const bx = Ck.aabb(p);
    return !doors.some(d => [-1, 1].some(sg => {
      const a = (d.yaw || 0) * Math.PI / 180, px = d.x + sg * Math.sin(a) * 1.1, pz = d.z + sg * Math.cos(a) * 1.1;
      return bx.x0 <= px + 0.3 && bx.x1 >= px - 0.3 && bx.z0 <= pz + 0.3 && bx.z1 >= pz - 0.3 && bx.y0 <= d.y + 0.6 && bx.y1 >= d.y - 1.1;
    }));
  });
}

function finish(b, info) {
  const name = `${info.type}_${info.biome.replace(' ', '')}_${info.cultureKey}_${info.plan || 'x'}-${info.roof || 'x'}-${info.walls || 'x'}_${info.stage}${info.decor}_${info.seed}`;
  return {
    meta: { Name: name, Creator: 'Villheim generator', Category: 'Villheim generated',
      Description: `${S.TYPES[info.type].label}, ${info.biome}, ${S.CULTURES[info.cultureKey].label}, ${info.plan || ''} plan, ${info.roof || ''} roof, ${info.walls || ''} walls, ${info.stage}${info.decor}, seed ${info.seed}` },
    pieces: b.pieces, rooms: b.rooms, notes: [...new Set(b.notes)], request: info,
  };
}

// ---------------------------------------------------------------- walls

function framePole(K, C) { return C.darkFrame ? 'darkwood_pole' : (K.pole || 'wood_pole2'); }

// Door piece: a hanging cloth door where the culture uses one and red jute is in reach (Mountain on), else wood.
function doorPiece(K, C) {
  return (C.clothDoor || C.arches) && reaches(C.biome || 'Meadows', 'Mountain') ? 'piece_cloth_hanging_door' : K.door;
}

// One 2 m wall bay. Wall styles: plank, half-timber (plank with a 45 degree brace across the bay), log,
// stone, stone-base (a metre of stone, then plank), marble, grausten.
function wallSegment(b, K, C, x, y0, z, yaw, SH, kind, styleOverride) {
  const style = styleOverride || C.wallStyle || 'plank';
  const plank = K.floor === 'ashwood_floor_2x2' ? 'ashwood_wall_2x2' : 'woodwall';
  const stonePiece = K.stoneWall || 'stone_wall_2x1';
  const stoneCourse = /2x2/.test(stonePiece) ? 2 : 1;
  const pieceFor = y => {
    if (style === 'stone' || style === 'marble' || style === 'grausten') return [stonePiece, stoneCourse];
    if (style === 'stone-base' && y < y0 + 0.99) return [stoneCourse === 1 ? stonePiece : 'stone_wall_2x1', 1];
    if (style === 'log') return ['wood_wall_log', 0.5];
    return [plank, 2];
  };
  const fill = (from, to) => {
    let y = from;
    while (to - y > 0.01) {
      const left = to - y;
      const [main, course] = pieceFor(y);
      if (course <= left + 0.01) { b.put(main, x, y + course / 2, z, yaw); y += course; }
      else if (left >= 0.99 && main !== 'wood_wall_log') { b.put(course === 1 ? main : K.wallHalf, x, y + 0.5, z, yaw); y += 1; }
      else { b.put(main === 'wood_wall_log' ? main : K.wallQuarter, x, y + Math.min(0.5, left) / 2, z, yaw); y += 0.5; }
    }
  };
  if (kind === 'door' || kind === 'gate') {
    b.put(kind === 'gate' ? (K.gate || K.door) : doorPiece(K, C), x, y0 + 1, z, yaw);
    fill(y0 + 2, y0 + SH); return;
  }
  if (kind === 'window' && SH >= 2) {
    fill(y0, y0 + 1);
    if (K.glass && C.glass) { const dx = Math.cos(yaw * Math.PI / 180) * 0.5, dz = -Math.sin(yaw * Math.PI / 180) * 0.5; b.put(K.glass, x - dx, y0 + 1.5, z - dz, yaw); b.put(K.glass, x + dx, y0 + 1.5, z + dz, yaw); }
    else if (!C.arches && !C.stoneWalls) b.put(K.wallQuarter, x, y0 + 1.75, z, yaw);
    fill(y0 + 2, y0 + SH); return;
  }
  fill(y0, y0 + SH);
  if (style === 'half-timber' && SH >= 2) {
    const brace = C.darkFrame || /darkwood/.test(K.beam || '') ? 'darkwood_beam_45' : 'wood_beam_45';
    const flip = Math.round(x + z) % 4 === 0 ? 180 : 0; // braces lean both ways along a wall
    b.put(brace, x, y0 + 1, z, yaw + flip);
  }
}

// A column from the floor to a ceiling: a stone block, then 2 m stone pillars (measured: the pillar stands on a 1 m
// block, its centre 1.5 m above the block's); black marble columns are 1 m tall and stack.
function column(b, K, x, z, y0, y1) {
  if (/blackmarble/.test(K.stoneWall || '')) { for (let y = y0; y < y1 - 0.01; y += 1) b.put('blackmarble_column_1', x, y + 0.5, z); return; }
  let y = y0;
  if ((y1 - y0) % 2 === 1) { b.put(K.stoneBlock || 'stone_wall_1x1', x, y + 0.5, z); y += 1; }
  for (; y < y1 - 0.01; y += 2) b.put(K.stonePillar || 'stone_pillar', x, y + 1, z);
}

// Arcade along the yard edges of a courtyard. Black marble: a column at every 2 m and an arch over each bay.
// Stone (measured in the corpus): a block, a 2 m pillar on it, a 2 m arch between pillars 3 m apart, its top level
// with the pillar tops; the run is centred on its side of the yard.
function arcadeAlong(b, K, edges, y0, SH) {
  const marble = /blackmarble/.test(K.stoneWall || '');
  const runs = new Map();
  for (const e of edges) {
    const key = e.yaw === 0 ? `z${e.z}` : `x${e.x}`;
    if (!runs.has(key)) runs.set(key, { yaw: e.yaw, fixed: e.yaw === 0 ? e.z : e.x, lo: Infinity, hi: -Infinity });
    const r = runs.get(key), t = e.yaw === 0 ? e.x : e.z;
    r.lo = Math.min(r.lo, t - 1); r.hi = Math.max(r.hi, t + 1);
  }
  const at = (r, t) => (r.yaw === 0 ? [t, r.fixed] : [r.fixed, t]);
  for (const r of runs.values()) {
    if (marble) {
      for (let t = r.lo; t <= r.hi + 0.01; t += 2) { const [x, z] = at(r, t); column(b, K, x, z, y0, y0 + SH - 2); }
      for (let t = r.lo + 1; t < r.hi; t += 2) { const [x, z] = at(r, t); b.put('blackmarble_arch', x, y0 + SH - 1, z, r.yaw); }
    } else if (K.stonePillar) {
      const n = Math.max(1, Math.floor((r.hi - r.lo) / 3)), mid = (r.lo + r.hi) / 2, start = mid - n * 1.5;
      for (let k = 0; k <= n; k++) { const [x, z] = at(r, start + 3 * k); column(b, K, x, z, y0, y0 + SH); }
      for (let k = 0; k < n; k++) { const [x, z] = at(r, start + 3 * k + 1.5); b.put(K.stoneArch || 'stone_arch', x, y0 + SH - 0.5, z, r.yaw); }
    } else {
      for (let t = r.lo; t <= r.hi + 0.01; t += 2) { const [x, z] = at(r, t); for (let y = y0; y < y0 + SH - 0.01; y += 1) b.put(K.pole1, x, y + 0.5, z); }
    }
  }
}

// ---------------------------------------------------------------- roofs

function capOf(w, top, r) { return top + r * (w.D - 1) / 2; }
// height of a wing's roof surface over a world point (for crossing wings)
function surfaceAt(w, x, z, top, r) {
  const a = w.alpha * Math.PI / 180, dx = x - w.cx, dz = z - w.cz;
  const v = Math.abs(dx * Math.sin(a) + dz * Math.cos(a));
  return capOf(w, top, r) - (r / 2) * Math.max(0, v - 1);
}

function gablePieces(K, C, w, top, r, ends, vent) {
  const roof = r === 2 ? K.roof45 : K.roof26, roofTop = r === 2 ? K.roofTop45 : K.roofTop26, gable = r === 2 ? K.gable45 : K.gable26;
  const capY = capOf(w, top, r), low = i => capY - r * (i + 1), pivot = i => low(i) + (r === 2 ? 1 : 0);
  const wallRow = (w.D - 3) / 2, rows = wallRow + (r === 1 ? 1 : 0) + ((C.eaves || 1) > 1 ? 1 : 0);
  const out = [], add = (name, u, y, v, yaw, role, surf) => { const [x, z, wy] = toWorld(w, u, v, yaw); out.push({ name, x, y, z, yaw: wy, role, surf, wing: w }); };
  const kick = C.kick && r === 2 && (C.eaves || 1) > 1;
  for (let u = -w.W + 1; u < w.W; u += 2) {
    for (let i = 0; i <= rows; i++) {
      const v = 2 + 2 * i, surf = low(i) + r / 2;
      if (kick && i === rows) { const y = low(i - 1) - 1; add(K.roof26, u, y, -v, 180, 'roof', y + 0.5); add(K.roof26, u, y, v, 0, 'roof', y + 0.5); continue; }
      add(roof, u, pivot(i), -v, 180, 'roof', surf); add(roof, u, pivot(i), v, 0, 'roof', surf);
    }
    const [vx] = toWorld(w, u, 0, 0);
    if (vent == null || Math.abs(vx - vent) > 1.01) add(roofTop, u, capY, 0, 0, 'cap', capY + 0.3);
  }
  [-1, 1].forEach((sg, k) => {
    if (!ends[k]) return;
    const u = sg * w.W;
    gableFill(K, add, u, top, 0, capY - top, C.stoneWalls);
    for (let i = 0; i <= wallRow; i++) for (const sv of [-1, 1]) {
      const v = sv * (2 + 2 * i);
      gableFill(K, add, u, top, v, low(i) - top, C.stoneWalls);
      add(gable, u, low(i), v, sv < 0 ? 270 : 90, 'gable', low(i) + r);
    }
  });
  return out;
}
function gableFill(K, add, u, from, v, h, stone) {
  const wall = /^(wood_wall_log|blackmarble|stone|Piece_grausten)/.test(K.wall) ? 'woodwall' : K.wall;
  const course = stone && K.stoneWall ? (/2x2/.test(K.stoneWall) ? 2 : 1) : 0;
  let y = from;
  while (h - (y - from) > 0.01) {
    const left = h - (y - from);
    if (course && left >= course - 0.01) { add(K.stoneWall, u, y + course / 2, v, 90, 'gable', y + course); y += course; continue; } // masonry gable in courses
    if (left >= 2) { add(wall, u, y + 1, v, 90, 'gable', y + 2); y += 2; }
    else if (left >= 1) { add(K.wallHalf, u, y + 0.5, v, 90, 'gable', y + 1); y += 1; }
    else { add(K.wallQuarter, u, y + 0.25, v, 90, 'gable', y + 0.5); y += 0.5; }
  }
}

// Hip roof: rings of rows on all four sides with corner pieces, a ridge along what is left (needs W >= D).
// Corner yaw per corner from the corpus: front-left 180, front-right 90, back-right 0, back-left 270, each on its
// row's low edge (lab/offsets.js: ocorner to roof). eaves 2 adds a ring past the walls (fen and longhouse roofs).
function hipPieces(K, w, top, r, eaves, o = {}) {
  const roof = r === 2 ? K.roof45 : K.roof26, roofTop = r === 2 ? K.roofTop45 : K.roofTop26;
  const corner = r === 2 ? (K.roof45 || '').replace('_45', '_ocorner_45') : (K.roof26 || '') + '_ocorner';
  const capY = capOf(w, top, r), low = i => capY - r * (i + 1), pivot = i => low(i) + (r === 2 ? 1 : 0);
  const Xr = w.W - w.D, rows = (w.D - 3) / 2 + (r === 1 && !o.tight ? 1 : 0) + ((eaves || 1) > 1 ? 1 : 0);
  const kick = o.kick && r === 2 && (eaves || 1) > 1;
  const out = [], add = (name, u, y, v, yaw, role, surf) => { const [x, z, wy] = toWorld(w, u, v, yaw); out.push({ name, x, y, z, yaw: wy, role, surf, wing: w }); };
  for (let u = -Xr; u <= Xr + 0.01; u += 2) add(roofTop, u, capY, 0, 0, 'cap', capY + 0.3);
  for (let i = 0; i <= rows; i++) {
    const d = 2 + 2 * i, k = kick && i === rows;
    // a kicked eave ring is a 26 degree ring hanging from the 45 degree ring above it
    const pc = k ? K.roof26 : roof, cn = k ? (K.roof26 || '') + '_ocorner' : corner, ly = k ? low(i - 1) - 1 : low(i), py = k ? ly : pivot(i);
    const surf = k ? ly + 0.5 : low(i) + r / 2;
    for (let u = -(Xr + 2 * i); u <= Xr + 2 * i + 0.01; u += 2) { add(pc, u, py, -d, 180, 'roof', surf); add(pc, u, py, d, 0, 'roof', surf); }
    for (let v = -2 * i; v <= 2 * i + 0.01; v += 2) { add(pc, -(Xr + d), py, v, 270, 'roof', surf); add(pc, Xr + d, py, v, 90, 'roof', surf); }
    add(cn, -(Xr + d), ly, -d, 180, 'roof', surf); add(cn, Xr + d, ly, -d, 90, 'roof', surf);
    add(cn, Xr + d, ly, d, 0, 'roof', surf); add(cn, -(Xr + d), ly, d, 270, 'roof', surf);
  }
  return out;
}

// Shed roof: one slope rising toward the back wall, side and back walls built up under it.
function shedRoof(b, K, w, top, r) {
  const roof = r === 2 ? K.roof45 : K.roof26, gable = r === 2 ? K.gable45 : K.gable26;
  const rows = w.D + 1;
  const lowAt = i => top + r * (i - 1); // row 0 hangs over the front wall, row 1 starts at it
  for (let u = -w.W + 1; u < w.W; u += 2) for (let i = 0; i < rows; i++) b.put(roof, u, lowAt(i) + (r === 2 ? 1 : 0), -w.D - 1 + 2 * i, 180);
  for (const sx of [-w.W, w.W]) for (let i = 1; i < rows; i++) {
    const v = -w.D - 1 + 2 * i;
    if (Math.abs(v) >= w.D) continue;
    for (let y = top; y < lowAt(i) - 0.01; y += 1) b.put(K.wallHalf, sx, y + 0.5, v, 90);
    b.put(gable, sx, lowAt(i), v, 270);
  }
  const backY = lowAt(rows - 1);
  for (let u = -w.W + 1; u < w.W; u += 2) for (let y = top; y < backY - 0.01; y += 1) b.put(K.wallHalf, u, y + 0.5, w.D, 0);
  b.notes.push('Shed roof rising to the back.');
}

function flatRoof(b, K, C, cells, edges, top, F, SH, biome) {
  for (const [, [x, z]] of cells) b.put(K.floor, x, top, z);
  if (C.parapet) for (const e of edges) {
    if (C.stoneWalls && K.stoneBlock) {
      const ux = e.yaw === 0 ? 1 : 0, uz = e.yaw === 0 ? 0 : 1;
      b.put(K.stoneBlock, e.x - ux * 0.5, top + 0.5, e.z - uz * 0.5, e.yaw); // a block every other metre
    } else b.put(K.wallQuarter, e.x, top + 0.25, e.z, e.yaw);
  }
  if (C.awnings) for (const e of edges.filter(e => e.out[1] < 0)) b.put((biome === 'Meadows' || biome === 'Black Forest') ? K.roof26 : 'darkwood_roof', e.x, F + SH - 1, e.z - 1, 180);
  const last = [...cells.values()].pop();
  b.put(K.ladder, last[0], top - SH / 2, last[1], 0);
}

// Ring roof over a round plan: each ring 2 m further in and one row higher, pieces turned to rise toward the middle.
// rs: rise per ring (2 for 45 degrees, 1 for 26), the last value repeating. With eave the first ring hangs 2 m past
// the wall; without it the first ring starts at the wall top (drums and domes). gap leaves the first ring open
// either side of the front (a tent's doorway). Returns the height of the top ring's inner edge.
function ringRoof(b, K, ap, top, rs, o = {}) {
  const eave = o.eave !== false;
  let low = eave ? top - rs[0] : top;
  for (let i = 0; ; i++) {
    const rho = (eave ? ap + 1 : ap - 1) - 2 * i;
    if (rho < 1.2) break;
    const r = rs[Math.min(i, rs.length - 1)], roof = r === 2 ? K.roof45 : K.roof26;
    const n = Math.max(4, Math.ceil(2 * Math.PI * rho / 1.7)); // a little overlap so the ring has no gaps
    for (let k = 0; k < n; k++) {
      const phi = k * 360 / n, pr = phi * Math.PI / 180;
      if (o.gap && i === 0 && Math.abs(phi - 180) < o.gap) continue;
      b.put(roof, (o.x || 0) + Math.sin(pr) * rho, low + (r === 2 ? 1 : 0), (o.z || 0) + Math.cos(pr) * rho, phi);
    }
    low += r;
  }
  return low;
}

// ---------------------------------------------------------------- octagon (round houses, crannogs, tents, yurts, round towers)

function octagonDesign(b, K, C, o) {
  const { F, SH, storeys, r, T, kind } = o;
  const side = o.side;                                // wall length per side (2, 4 or 6 m)
  const ap = side / 2 / Math.tan(Math.PI / 8);        // apothem
  const seg = side / 2;                               // 2 m walls per side
  const tent = kind === 'tent';
  const deckR = ap + (o.deck || 0);
  const inOct = (x, z, Rr, m = 0) => [0, 45, 90, 135].every(a => Math.abs(x * Math.sin(a * Math.PI / 180) + z * Math.cos(a * Math.PI / 180)) <= Rr - m);
  const Rr = Math.ceil(deckR);
  const big = [];
  let zFront = 0;
  for (let x = -Rr + 1; x < Rr; x += 2) for (let z = -Rr + 1; z < Rr; z += 2) {
    if (inOct(x, z, deckR, 0.99)) { b.put(K.floor, x, F, z); big.push([x, z]); zFront = Math.min(zFront, z - 1); }
    else for (const dx of [-0.5, 0.5]) for (const dz of [-0.5, 0.5]) if (inOct(x + dx, z + dz, deckR, 0.45)) { b.put(K.floor1, x + dx, F, z + dz); zFront = Math.min(zFront, z + dz - 0.5); }
  }
  const stack = (x, z, y1) => { for (let y = 0; y < y1 - 0.01;) { const h = y1 - y >= 2 ? 2 : 1; b.put(h === 2 ? K.pole : K.pole1, x, y + h / 2, z); y += h; } };
  if (F > 0) {
    if (o.deck) { for (const [x, z] of big) if ((((x + z) / 2) % 2 + 2) % 2 === 0) stack(x, z, F); }
    else { for (let i = 0; i < 8; i++) { const a = i * 45 * Math.PI / 180; stack(Math.sin(a) * ap * 0.98, Math.cos(a) * ap * 0.98, F); } stack(0, 0, F); }
  }
  let top = F;
  const slots = [];
  const sideAt = (i, k) => {
    const a = i * 45, ar = a * Math.PI / 180;
    const nx = Math.sin(ar), nz = Math.cos(ar), tx = Math.cos(ar), tz = -Math.sin(ar);
    const t = -side / 2 + 1 + 2 * k;
    return { a, nx, nz, tx, tz, x: nx * ap + tx * t, z: nz * ap + tz * t };
  };
  if (tent) {
    // lavvu: no walls; a doorway in the front of the first ring, the cone starting at the floor
    top = F + r;
    b.put(doorPiece(K, C), 0, F + 1, -ap, 0);
    for (const x of [-1.1, 1.1]) b.put(K.pole, x, F + 1, -ap);
    for (let i = 0; i < 8; i++) for (let k = 0; k < seg; k++) {
      if (i === 4 && k === Math.floor(seg / 2)) continue;
      const s = sideAt(i, k);
      for (const dt of [-0.5, 0.5]) slots.push({ x: s.x + s.tx * dt - s.nx * 0.6, z: s.z + s.tz * dt - s.nz * 0.6, y: F, yaw: norm(s.a + 180), nx: -s.nx, nz: -s.nz });
    }
  } else {
    const hole = big.filter(([x, z]) => x > 0 && z > 0 && inOct(x, z, ap, 0.99)).sort((p, q) => (p[0] + p[1]) - (q[0] + q[1]))[0];
    for (let s = 0; s < storeys; s++) {
      const y0 = F + s * SH;
      if (s > 0) {
        for (const [x, z] of big) if (inOct(x, z, ap, 0.99) && !(hole && x === hole[0] && z === hole[1])) b.put(K.floor, x, y0, z);
        if (hole) b.put(K.ladder, hole[0], y0 - SH / 2, hole[1], 180);
      }
      for (let i = 0; i < 8; i++) {
        for (let k = 0; k < seg; k++) {
          const sd = sideAt(i, k);
          const isDoor = s === 0 && i === 4 && k === Math.floor(seg / 2);
          wallSegment(b, K, C, sd.x, y0, sd.z, sd.a, SH, isDoor ? 'door' : (k === 0 && i % 2 && !T.tower ? 'window' : 'wall'));
          if (s === 0 && !isDoor) for (const dt of [-0.5, 0.5]) slots.push({ x: sd.x + sd.tx * dt, z: sd.z + sd.tz * dt, y: y0, yaw: norm(sd.a + 180), nx: -sd.nx, nz: -sd.nz });
          b.put(K.beam, sd.x, y0 + SH, sd.z, sd.a);
        }
        const sd = sideAt(i, 0), vx = sd.nx * ap + sd.tx * side / 2, vz = sd.nz * ap + sd.tz * side / 2;
        for (let y = y0; y < y0 + SH - 0.01;) { const h = (y0 + SH - y) >= 2 ? 2 : 1; b.put(h === 2 ? K.pole : K.pole1, vx, y + h / 2, vz); y += h; }
      }
      top = y0 + SH;
    }
  }
  const dx0 = tent ? 0 : sideAt(4, Math.floor(seg / 2)).x; // the door's 2 m bay is off centre when a side has two bays
  b.rooms.push({ x0: -ap, x1: ap, z0: -ap, z1: ap, y: F, h: tent ? 2 : SH, use: T.use, slots, door: { x: dx0, z: -ap }, main: true });
  b.doorX = dx0;
  const porch = kind === 'round' && !o.deck && !T.tower && side >= 4;
  if (kind === 'yurt') ringRoof(b, K, ap, top, [r], { eave: false });
  else ringRoof(b, K, ap, top, tent || r === 1 ? [r] : [1, r], { gap: tent ? 26 : porch ? 22 : 0 });
  if (porch) {
    // entrance porch: two short walls and a small gable roof out from the door (Iron Age and early medieval round houses)
    const z = -ap - 1;
    b.put(K.floor, dx0, F, z);
    for (const x of [dx0 - 1, dx0 + 1]) { wallSegment(b, K, C, x, F, z, 90, SH, 'wall', C.wallStyle === 'stone' ? 'stone-base' : null); b.put(K.beam, x, F + SH, z, 90); }
    b.put(K.roof26, dx0 + 1, F + SH, z, 90); b.put(K.roof26, dx0 - 1, F + SH, z, 270);
    b.put(K.roofTop26, dx0, F + SH + 1, z, 90);
    b.notes.push('Porch at the door.');
  }
  if (kind === 'yurt') b.notes.push('Round tent on a lattice wall, low cone with an open crown.');
  else if (tent) b.notes.push('Cone tent from the ground, smoke hole at the top.');
  else b.notes.push('Round plan: eight walls and a ring roof, each ring turned toward the middle.');
  // crannog: a fence round the deck, a walkway to the shore with a stair down at its end
  if (o.fence) {
    const Rf = deckR - 0.5, L = 2 * Rf * Math.tan(Math.PI / 8), n = Math.max(1, Math.floor(L / 2));
    for (let i = 0; i < 8; i++) {
      const a = i * 45, ar = a * Math.PI / 180, nx = Math.sin(ar), nz = Math.cos(ar), tx = Math.cos(ar), tz = -Math.sin(ar);
      for (let k = 0; k < n; k++) {
        const t = -(n - 1) + 2 * k;
        if (i === 4 && Math.abs(t) < 1.5) continue;
        b.put(K.fence, nx * Rf + tx * t, F + 0.5, nz * Rf + tz * t, a);
      }
    }
  }
  if (o.walk) {
    let z = zFront - 1;
    for (let k = 0; k < o.walk / 2; k++, z -= 2) { b.put(K.floor, 0, F, z); stack(0, z, F); }
    stairUp(b, K, 0, z + 1, F);
    b.notes.push('Platform on stilts with a deck round the house and a walkway to the shore; place it over water.');
  }
}

// ---------------------------------------------------------------- additions to a shell

// A stair from the ground up to a floor whose front edge is at zEdge (2 m up), climbing toward +z.
function stairUp(b, K, x, zEdge, F) {
  if (Math.abs(F - 2) > 0.01) return;
  b.put(K.stair || 'wood_stair', x, F / 2, zEdge - 1, 180);
}

// Timber trackway out from a door at (x, zDoor), len metres, on short posts.
function boardwalk(b, K, x, zDoor, F, len) {
  const y = Math.max(F, 0);
  let z = zDoor - 1;
  for (let k = 0; k < len / 2; k++, z -= 2) {
    b.put(K.floor, x, y, z);
    for (const dx of [-1, 1]) for (let yy = 0; yy < y - 0.01; yy += 1) b.put(K.pole1, x + dx, yy + 0.5, z);
  }
  stairUp(b, K, x, z + 1, y);
}

// A 2 x 2 m stone tower up to height h at (tx, tz); open on its -x side at the bottom unless closed.
function stoneTowerAt(b, K, tx, tz, h, F, closed) {
  const stone = K.stoneWall || 'stone_wall_2x1';
  for (let y = 0.5; y < h; y += 1) for (const [dx, dz, yaw] of [[0, -1, 0], [0, 1, 0], [-1, 0, 90], [1, 0, 90]])
    if (closed || !(y < F + 2 && dx === -1)) b.put(stone, tx + dx, y, tz + dz, yaw);
  b.put(K.floor, tx, h, tz);
  for (const [dx, dz, yaw] of [[0, -1, 0], [0, 1, 0], [-1, 0, 90], [1, 0, 90]]) b.put(K.stoneBlock || 'stone_wall_1x1', tx + dx * 1.0, h + 0.5, tz + dz * 1.0, yaw);
  if (!closed) b.put(K.ladder, tx, h - 1, tz, 0);
}

// Square tower of n x n cells centred on (cx, cz): wooden floors, a ladder per storey, slit windows above the ground
// storey, a low pyramid roof. skip(edge, y0, SH) leaves out walls another building already has.
function towerAt(b, K, C, o) {
  const { cx, cz, n, F, storeys, SH } = o;
  const w = { cx, cz, W: n, D: n, alpha: 0 };
  const cells = cellsOf([w]), edges = edgesOf(cells), verts = vertsOf(edges);
  const list = [...cells.values()];
  const hole = list.sort((a, c) => (c[0] - c[1]) - (a[0] - a[1]))[0];
  const door = o.door === 'right'
    ? edges.filter(e => e.out[0] > 0).sort((a, c) => Math.abs(a.z - cz) - Math.abs(c.z - cz))[0]
    : edges.filter(e => e.out[1] < 0).sort((a, c) => Math.abs(a.x - cx) - Math.abs(c.x - cx))[0];
  for (const [x, z] of list) b.put(K.floor, x, F, z);
  let top = F;
  for (let s = 0; s < storeys; s++) {
    const y0 = F + s * SH;
    if (s > 0) {
      for (const [x, z] of list) if (!(x === hole[0] && z === hole[1])) b.put(K.floor, x, y0, z);
      b.put(K.ladder, hole[0], y0 - SH / 2, hole[1], 180);
    }
    for (const e of edges) {
      if (o.skip && o.skip(e, y0, SH)) continue;
      const midSide = e.yaw === 0 ? Math.abs(e.x - cx) < 0.01 : Math.abs(e.z - cz) < 0.01;
      wallSegment(b, K, C, e.x, y0, e.z, e.yaw, SH, s === 0 && e === door ? 'door' : (s > 0 && midSide ? 'window' : 'wall'));
    }
    for (const e of edges) b.put(K.beam, e.x, y0 + SH, e.z, e.yaw);
    b.rooms.push({ x0: cx - n, x1: cx + n, z0: cz - n, z1: cz + n, y: y0, h: SH, use: o.use || 'guard', upper: s > 0, main: s === 0 && !o.skip,
      door: s === 0 ? { x: door.x, z: door.z } : null, hole: s > 0 ? hole : null });
    top = y0 + SH;
  }
  for (const p of hipPieces(K, w, top, 1, 1, { tight: true })) b.put(p.name, p.x, p.y, p.z, p.yaw);
  if (b.doorX == null) b.doorX = door.x;
  void verts;
  return top;
}

// Drum on a ceiling, then a stepped dome (45 then 26 degree rings) or a cone (45 degree rings), a block on top.
function domeOn(b, K, C, o) {
  const ap = o.side / 2 / Math.tan(Math.PI / 8), seg = o.side / 2;
  for (const [x, z] of o.ceiling) b.put(K.floor, x, o.y, z);
  for (let i = 0; i < 8; i++) {
    const a = i * 45, ar = a * Math.PI / 180, nx = Math.sin(ar), nz = Math.cos(ar), tx = Math.cos(ar), tz = -Math.sin(ar);
    for (let k = 0; k < seg; k++) {
      const t = -o.side / 2 + 1 + 2 * k, x = o.x + nx * ap + tx * t, z = o.z + nz * ap + tz * t;
      wallSegment(b, K, C, x, o.y, z, a, o.h, i % 2 === 0 && k === 0 ? 'window' : 'wall');
      b.put(K.beam, x, o.y + o.h, z, a);
    }
  }
  const peak = ringRoof(b, K, ap, o.y + o.h, o.cone ? [2] : o.side >= 4 ? [2, 1] : [1], { eave: false, x: o.x, z: o.z });
  b.put(K.stoneBlock || 'stone_wall_1x1', o.x, peak, o.z);
}

// Low gallery roof all round a building at height yS: a 26 degree lean-to 2 m deep against the walls, corner pieces,
// posts and beams along its outer edge.
function skirtRoof(b, K, edges, yS) {
  const roof = K.roof26, corner = K.roof26 + '_ocorner';
  const post = (x, z) => { for (let y = 0; y < yS - 0.01;) { const h = yS - y >= 2 ? 2 : 1; b.put(h === 2 ? K.pole : K.pole1, x, y + h / 2, z); y += h; } };
  const outs = new Map();
  for (const e of edges) {
    const [ox, oz] = e.out, ux = e.yaw === 0 ? 1 : 0, uz = e.yaw === 0 ? 0 : 1;
    b.put(roof, e.x + ox, yS, e.z + oz, slopeYaw(e.out));
    b.put(K.beam, e.x + 2 * ox, yS, e.z + 2 * oz, e.yaw);
    for (const s of [-1, 1]) {
      const vx = e.x + s * ux, vz = e.z + s * uz, k = `${vx},${vz}`;
      post(vx + 2 * ox, vz + 2 * oz);
      if (!outs.has(k)) outs.set(k, []);
      outs.get(k).push([ox, oz]);
    }
  }
  for (const [k, os] of outs) {
    const ax = os.find(o => o[0] !== 0), az = os.find(o => o[1] !== 0);
    if (!ax || !az || os.length !== 2) continue; // only outside corners
    const [vx, vz] = k.split(',').map(Number), sx = ax[0], sz = az[1];
    const yaw = sx < 0 && sz < 0 ? 180 : sx > 0 && sz < 0 ? 90 : sx > 0 ? 0 : 270;
    b.put(corner, vx + sx, yS, vz + sz, yaw);
    post(vx + 2 * sx, vz + 2 * sz);
    b.put(K.beam, vx + 2 * sx, yS, vz + sz, 90);
    b.put(K.beam, vx + sx, yS, vz + 2 * sz, 0);
  }
}

// ---------------------------------------------------------------- extras

function dockDesign(b, K, W, D, F, stage) {
  const len = stage === 's1' ? 3 : stage === 's2' ? 5 : 7;
  for (let i = 0; i < len; i++) {
    const z = -D - 1 - 2 * i;
    for (const x of [-1, 1]) b.put(K.floor, x, F, z);
    for (const x of [-2, 2]) { b.put(K.pole, x, F - 1, z - 1); b.put(K.pole, x, F - 3, z - 1); }
  }
  b.put(K.pole, -2, F + 1, -D - 2 * len, 0); b.put(K.pole, 2, F + 1, -D - 2 * len, 0);
  b.notes.push('Pier runs out on the door side; place it over water.');
  void W;
}

function fieldDesign(b, K, W, D, biome, stage, R) {
  const crops = { 'Meadows': 'RaspberryBush', 'Black Forest': 'Pickable_Carrot', 'Swamp': 'Pickable_Turnip', 'Mountain': 'Pickable_Onion',
    'Plains': 'Pickable_Barley', 'Mistlands': 'Pickable_Barley', 'Ashlands': 'Pickable_Barley' };
  const crop = crops[biome] || 'Pickable_Carrot';
  const fw = stage === 's1' ? 4 : stage === 's2' ? 6 : 8, fd = stage === 's1' ? 3 : 4;
  const z0 = -D - 2 - fd * 2, x0 = -fw;
  for (let x = x0 + 1; x < x0 + fw * 2; x += 2) { b.put(K.fence, x, 0.5, z0, 0); if (Math.abs(x) > 1.5) b.put(K.fence, x, 0.5, -D - 2, 0); }
  for (let z = z0 + 1; z < -D - 2; z += 2) { b.put(K.fence, x0, 0.5, z, 90); b.put(K.fence, x0 + fw * 2, 0.5, z, 90); }
  const step = crop === 'RaspberryBush' ? 1.5 : 0.75;
  for (let x = x0 + 1; x < x0 + fw * 2 - 0.5; x += step * 1.5) for (let z = z0 + 1; z < -D - 2.5; z += step) b.put(crop, x, 0, z, Math.floor(R() * 4) * 90);
  b.put('ArmorStand', x0 + fw, 0, z0 + fd, 0);
  b.notes.push(`Field of ${crop}; the ground needs cultivating in game for crops to grow back.`);
  void W;
}

function penDesign(b, K, W, D, stage) {
  const pw = stage === 's1' ? 3 : 4, pd = D, x0 = W, x1 = W + pw * 2;
  for (let x = x0 + 1; x < x1; x += 2) { b.put(K.fence, x, 0.5, -pd, 0); b.put(K.fence, x, 0.5, pd, 0); }
  for (let z = -pd + 1; z < pd; z += 2) if (Math.abs(z) > 1.5) b.put(K.fence, x1, 0.5, z, 90);
  b.put('piece_chest_barrel', x1 - 1, 0, pd - 1, 0);
  b.put('wood_stack', x0 + 1.2, 0, pd - 1, 0);
  b.notes.push('Pen beside the barn; its gap faces away from the barn.');
}

function wellDesign(b, K, biome, stage) {
  const st = biome === 'Meadows' ? 'wood_wall_quarter' : (K.stoneBlock || 'stone_wall_1x1');
  for (const [x, z, yaw] of [[0, -1, 0], [0, 1, 0], [-1, 0, 90], [1, 0, 90]]) b.put(st, x, 0.5, z, yaw);
  for (const x of [-1.2, 1.2]) { b.put(K.pole, x, 1, 0); b.put(K.pole1, x, 2.5, 0); }
  b.put(K.beam || 'wood_beam', 0, 3, 0, 0);
  b.put(K.roof26, 0, 2, -1, 180); b.put(K.roof26, 0, 2, 1, 0);
  b.put('piece_chest_barrel', 1.6, 0, 1.6, 0);
  if (stage !== 's1') { b.put('piece_groundtorch_wood', -1.8, 0, -1.8, 0); b.put('piece_bench01', 0, 0, -2.6, 0); }
  b.notes.push('Well; Valheim has no water source piece, so the shaft is for looks.');
  return b;
}

function campDesign(b, K, biome, stage, R, decor) {
  b.put('fire_pit', 0, 0, 0, 0);
  b.put('piece_cookingstation', 0, 0.4, 0, 0);
  const n = stage === 's1' ? 2 : 3;
  for (let i = 0; i < n; i++) { const a = (i / n) * 2 * Math.PI + R() * 0.4; b.put('piece_logbench01', Math.sin(a) * 2.6, 0, Math.cos(a) * 2.6, (a * 180 / Math.PI + 180) % 360); }
  for (const x of [-1, 1]) { b.put(K.pole, x * 2, 1, 5, 0); b.put(K.roof45, x, 1.2, 4.6, 0); }
  b.put('bed', 0, 0, 5, 90);
  if (decor !== 'd1') { b.put('wood_stack', 3.5, 0, 3, 30); b.put('piece_chest_wood', -3.5, 0, 3, 150); }
  if (decor === 'd3') { b.put('piece_groundtorch_wood', 3.6, 0, -2, 0); b.put('rug_deer', 0, 0.02, 4.3, 0); b.put('itemstand', -2, 1.5, 5.3, 180); }
  return b;
}

if (NODE) module.exports = { generate, quat, PLAN_BY_TYPE, ROOF_BY_CULTURE };
else window.VHGenerate = { generate, quat, PLAN_BY_TYPE, ROOF_BY_CULTURE };
