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
const P = NODE ? require('./pieces.js') : window.VHPieces;
const Details = NODE ? require('./details.js') : window.VHDetails;
const Kitbash = NODE ? require('./kitbash.js') : window.VHKitbash;
const Yards = NODE ? require('./yards.js') : window.VHYards;
const Landscape = NODE ? require('./landscape.js') : window.VHLandscape;
const Persona = NODE ? require('./persona.js') : window.VHPersona;
const checksLib = () => (NODE ? require('./checks.js') : window.VHChecks);
const layoutLib = () => (NODE ? require('./layout.js') : window.VHLayout);
const shapesLib = () => (NODE ? require('./shapes.js') : window.VHShapes);
const Program = NODE ? (() => { try { return require('./program.js'); } catch (e) { return null; } })() : (typeof window !== 'undefined' ? window.VHProgram : null);

// Heights (Tyler's in-game review, 2026-11-09). A player is about 1.8 m tall: rooms get walls of 3 m, so doors, beams
// and roofs clear the head; sunken huts, low by nature, get 2.5 m under a steep roof.
const MIN_STOREY = 3, LOW_STOREY = 2.5;
// Tyler's rule (showcase review, 2026-11-11): passages, porches and balconies are at least two wood_floor pieces wide.
const LOGGIA_ROWS = 2, DECK_MIN = 4;
// The wall height of a one-storey building at s3 (corpus eaves, see generate).
const TALL_ONE = 4;

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function quat(yaw) { const a = yaw * Math.PI / 360; return [0, +Math.sin(a).toFixed(6), 0, +Math.cos(a).toFixed(6)]; }
const norm = a => ((a % 360) + 360) % 360;
const reaches = (biome, b) => S.BIOMES.indexOf(biome) >= S.BIOMES.indexOf(b);

class Build {
  constructor() { this.pieces = []; this.rooms = []; this.notes = []; this.keys = new Set(); this.vents = []; }
  put(name, x, y, z, yaw = 0, extra) {
    if (!name) return;
    yaw = norm(yaw);
    // Ashlands timber stands in for wood pieces whose pivots sit elsewhere (measured from the game's snap points,
    // 2026-11-09): the 2 m beam hangs 1 m under its pivot, the 1 m pole under its, the 45 degree beam rises from its
    // foot. The generator places by the wood pieces' pivots, so these move to match.
    // (a motif's pieces come at the pivots corpus builders set, so they keep them)
    if (PIVOT_SHIFT[name] && !(extra && extra.motif)) y += PIVOT_SHIFT[name];
    const key = `${name}|${Math.round(x * 100)}|${Math.round(y * 100)}|${Math.round(z * 100)}|${Math.round(yaw) % 360}`; // rounded so -0.00 and 0.00 match
    if (this.keys.has(key)) return; // the same piece in the same place once only (porch eaves, meeting wings)
    this.keys.add(key);
    this.pieces.push({ name, x: +x.toFixed(3), y: +y.toFixed(3), z: +z.toFixed(3), q: quat(yaw), yaw, ...(extra || {}) });
  }
}

// Wing-local (u along the ridge, v across, local yaw) to world. alpha is the wing's yaw: 0 = ridge along x,
// 270 = ridge along z (Unity's yaw maps local x to (cos a, -sin a)).
// The dark wood beams' colliders stand 0.05 to 0.45 m over their pivot where the wood beam's is centred on it
// (data/piece-models.json): placed as wood beams, a dark wood band rose 0.25 m into a doorway (a 0.35 m kerb at the
// upper doors of the Plains and Mistlands homes) and a bar's top beam hovered 0.15 m over its half walls (showcase 06,
// Tyler: "the darkwood beams are hovering above the woodwall_half").
// The same holds for every stand-in whose snap points stand off the wood piece's (data/piece-models.json snap,
// compared kit by kit: dark wood beams 0.25 m over, the dark 26 degree beam 0.25 m under; poles, 45 degree beams,
// roofs, ridge caps and corners match).
const PIVOT_SHIFT = { ashwood_beam_2m: 1, ashwood_pole_1m: 0.5, ashwood_wall_beam_45: -1, ashwood_wall_beam_45_alt: -1, darkwood_beam: -0.25, darkwood_beam4x4: -0.25, darkwood_beam_26: 0.25 };
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
// Tyler's rule (showcase review, 2026-11-11): "Anything small passageway must be at minimum two wood_floor pieces
// wide. Wider hallways can be 3 or more. But 1 of them is far too narrow for anything besides a small closet or
// hidden passageway." A wing with a gable over it is an odd number of 2 m cells across (the ridge over a cell's
// middle), so a wing is never under three cells (6 m) across: two cells take a different roof, one is a closet.
const WING_MIN = 3;
function wingsFor(plan, W, D, R, o = {}) {
  const odd = n => (n % 2 ? n : n + 1);
  const wD = Math.max(WING_MIN, odd(D - 2)); // side wings are a bay narrower, never under WING_MIN
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

// ---------------------------------------------------------------- massing: a household's building over the stages
//
// A building grows from its own earlier stage (styles.js GROWTH, PLAN_SETS, LADDER): the main wing is set at s1 and
// keeps its place; later stages add wings, a storey and extras. A wing is a spec: at 'end' (one end of the main wing,
// side -1 or 1, toward the front or the back), 'mid' (the middle of the back, or through to the front) or 'inline' (a
// lower annex in line at one end). Wings are narrow (a bay narrower than the main wing, at least 2 m) or full (as deep
// as a 6 m main wing).

const strHash = s => [...String(s)].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);
const oddUp = n => (n % 2 ? n : n + 1);
function wingDepth(spec, D) { return spec.ext || (spec.full && D <= 3) ? D : Math.max(WING_MIN, oddUp(D - 2)); }
function wingsFromSpec(specs, W, D) {
  const out0 = 2 * Math.round(Math.max(2, Math.ceil(D * 0.8)) / 2); // how far a wing sticks out, as wingsFor
  const ws = [{ cx: 0, cz: 0, W, D, alpha: 0, main: true }];
  for (const s of specs) {
    const wD = wingDepth(s, D), out = out0 + (s.long ? 2 : 0);
    if (s.at === 'end') ws.push({ cx: s.side * (W - wD), cz: (s.dir === 'back' ? 1 : -1) * out / 2, W: D + out / 2, D: wD, alpha: 270, spec: s });
    else if (s.at === 'mid') {
      const mid = (W % 2 === wD % 2) ? 0 : 1;
      ws.push(s.dir === 'through' ? { cx: mid, cz: 0, W: D + out, D: wD, alpha: 270, spec: s } : { cx: mid, cz: out / 2, W: D + out / 2, D: wD, alpha: 270, spec: s });
    } else if (s.at === 'inline') ws.push({ cx: s.side * (W + 2), cz: 0, W: 2, D: wD, alpha: 0, spec: s });
  }
  return ws;
}
// The plan's name from its wings, as the rest of the generator knows plans: rect, long, square, nave, L, T, cross, U,
// and joined names for more than one kind of wing (L+T, T+nave).
// An extension (a full-depth bay in line) only makes the hall longer.
function planLabel(specs, W, D) {
  const ext = specs.filter(s => s.ext).length, Wt = W + 2 * ext;
  specs = specs.filter(s => !s.ext);
  if (!specs.length) return Wt === D ? 'square' : Wt >= 2 * D ? 'long' : 'rect';
  const ends = specs.filter(s => s.at === 'end'), mid = specs.find(s => s.at === 'mid'), inl = specs.filter(s => s.at === 'inline');
  const parts = [];
  if (ends.length === 2 && ends.every(s => s.dir === 'front')) parts.push('U');
  else if (ends.length) parts.push(ends.length === 2 ? 'Z' : 'L');
  if (mid) parts.push(mid.dir === 'through' ? 'cross' : 'T');
  if (inl.length) parts.push('nave');
  return parts.join('+');
}
// Wings stand clear of each other outside the main wing: a bay of ground between them, so roofs do not clash.
function wingsClear(ws) {
  const main = ws[0], own = ws.slice(1).map(w => [...cellsOf([w]).values()].filter(([x, z]) => !inside(main, x, z)));
  for (let i = 0; i < own.length; i++) for (let j = i + 1; j < own.length; j++)
    for (const [x, z] of own[i]) if (own[j].some(([u, v]) => Math.abs(u - x) <= 2 && Math.abs(v - z) <= 2)) return false;
  return true;
}

// Wings across the main wing from both its sides line up or stand well apart (Tyler, showcase 09: "If its intended to
// be a cross, its not. Tons of the pieces are misaligned, and one side of the roof is shifted left 5 feet compared to
// the other side"). An end wing out the front and a middle wing out the back, a bay or two apart along the ridge,
// read as one cross gone wrong, and their roofs met the main roof in a tangle of valleys with holes between them.
// Two such wings either share their middle line or leave a full bay of roof between their roofs' edges.
function crossLined(ws) {
  const main = ws[0], across = ws.slice(1).filter(w => w.alpha === 270);
  for (let i = 0; i < across.length; i++) for (let j = i + 1; j < across.length; j++) {
    const a = across[i], c = across[j];
    if (Math.sign(a.cz - main.cz) === Math.sign(c.cz - main.cz) || !(a.cz - main.cz) || !(c.cz - main.cz)) continue;
    const gap = Math.abs(a.cx - c.cx) - (a.D + c.D);
    if (Math.abs(a.cx - c.cx) > 0.01 && gap < 2) return false;
  }
  return true;
}

// The household's whole path, s1 to s3, from its own random stream: nothing here may depend on the stage asked for,
// so every stage of the same household agrees. Returns the state at each stage.
function massingPath(o) {
  const { type, T, C, cultureKey, form, lineage } = o;
  const g = S.growthFor(cultureKey, type);
  if (!g) return null;
  const FR = rng((lineage * 6151 + strHash(type) * 31 + strHash(cultureKey)) >>> 0);
  const fam = { household: null };
  // roof and walls first: they decide which steps a building can take
  const flatOnly = (C.roofs || ROOF_BY_CULTURE[cultureKey] || {}).flat && !(C.roofs || ROOF_BY_CULTURE[cultureKey] || {}).gable;
  fam.roof = C.roof === 'flat' || flatOnly ? 'flat' : pick(FR, C.roofs || ROOF_BY_CULTURE[cultureKey] || { gable: 1 });
  if (T.open === 'sides' && FR() < 0.4) fam.roof = 'shed';
  if (fam.roof === 'conical') fam.roof = 'hip';
  const wAll = { ...(C.walls || WALLS_BY_CULTURE[cultureKey] || WALLS_BY_BIOME[C.biome] || { plank: 1 }) };
  if (C.biome === 'Meadows') { delete wAll.stone; delete wAll['stone-base']; delete wAll.log; }
  const wEarly = { ...wAll }; delete wEarly.stone; delete wEarly['stone-base']; delete wEarly.marble;
  fam.walls = pick(FR, Object.keys(wAll).length ? wAll : { plank: 1 });
  fam.wallsEarly = pick(FR, Object.keys(wEarly).length ? wEarly : { plank: 1 });
  // the main wing
  let W, D;
  if (type === 'home') {
    fam.household = pick(FR, Object.fromEntries(Object.entries(S.HOUSEHOLDS).map(([k, h]) => [k, h.weight])));
    [W, D] = pick(FR, S.HOUSEHOLDS[fam.household].bays).split('x').map(Number);
  } else {
    // between the type's s1 and s2 sizes: a hall built small or built well from the start
    const b1 = (C.bays && C.bays[type] && C.bays[type].s1) || T.bays.s1, b2 = (C.bays && C.bays[type] && C.bays[type].s2) || T.bays.s2;
    [W, D] = b1;
    W = Math.max(W, D) + Math.floor(FR() * (Math.max(1, b2[0] - b1[0]) + 1));
    // a longhouse is laid out long; some are built as deep as a stage 2 hall from the first
    if (type === 'longhouse') { if (FR() < 0.4) D = b2[1]; W = Math.max(W + 2, Math.round(oddUp(D) * 1.6)); }
  }
  if (D % 2 === 0 && fam.roof !== 'flat') D += 1;
  if (fam.roof === 'hip' && W <= D) W = D + 1;
  if (C.stoneWalls && W * D < 12) W += 1; // a metre-thick wall leaves a 6 m house no room for a bed beside the fire
  const side = FR() < 0.5 ? -1 : 1, full = FR() < 0.75;
  fam.growSide = side; // the end the house grows toward (a wall hearth keeps to the other end)
  fam.porchWide = FR() < 0.5;
  fam.stilt2 = !!C.stiltChance && FR() < C.stiltChance;
  fam.podklet = fam.household === 'family' || (type !== 'home' && FR() < 0.5);
  const sMult = { cozy: 0.5, couple: 1, family: 1.5 }[fam.household] || 1;
  const maxW = { home: 8, longhouse: 14, barn: 10, tavern: 9 }[type] || 8;
  // the steps a roof and form allow: one ridge only under a shed roof and on posts; hip roofs keep to L and length
  const allowed = fam.roof === 'shed' || ['raised', 'open'].includes(form) ? ['rect', 'keep', 'long']
    : form === 'svan' ? ['rect', 'keep'] : fam.roof === 'hip' ? ['rect', 'keep', 'long', 'side', 'back', 'L']
      : fam.roof === 'flat' ? ['rect', 'keep', 'long', 'extend', 'side', 'back', 'L', 'T', 'cross', 'U'] : null;
  const states = {};
  let st = { W, D, specs: [], storeys: 1, extras: {} };
  const apply = (step, s, budget, long, i0) => {
    const n = { ...s, specs: s.specs.map(x => ({ ...x })) };
    const ends = n.specs.filter(x => x.at === 'end'), endAt = sd => n.specs.some(x => (x.at === 'end' || x.at === 'inline') && x.side === sd);
    const freeSide = endAt(side) ? (endAt(-side) ? 0 : -side) : side;
    switch (step) {
      case 'rect': case 'keep': return n;
      case 'round': return { ...n, round: true };
      case 'long': if (n.specs.some(x => x.at !== 'mid') || n.W + 2 > maxW) return null; n.W += 2; return n;
      case 'extend': // two bays more at one end under the same roof (the old gable wall comes out)
        if (!freeSide || n.W + 2 > maxW + 2 || n.specs.some(x => x.ext)) return null;
        n.specs.push({ at: 'inline', side: freeSide, ext: true }); break;
      case 'side': case 'back': case 'L': {
        if (!freeSide) return null;
        const dir = step === 'back' ? 'back' : 'front';
        const narrow = step === 'side' || (step === 'back' && i0 === 0) || !full || n.W - n.D < (dir === 'front' ? 2 : 1);
        n.specs.push({ at: 'end', side: freeSide, dir, full: !narrow, long: step !== 'side' && long });
        break;
      }
      case 'T': if (n.specs.some(x => x.at === 'mid')) return null; n.specs.push({ at: 'mid', dir: 'back', full, long }); break;
      case 'cross': {
        const m = n.specs.find(x => x.at === 'mid');
        if (m) { if (m.dir === 'through') return null; m.dir = 'through'; } else n.specs.push({ at: 'mid', dir: 'through', full });
        break;
      }
      case 'U': {
        const f = ends.filter(x => x.dir === 'front');
        if (ends.length > 1 || (ends.length === 1 && !f.length)) return null;
        if (f.length) n.specs.push({ ...f[0], side: -f[0].side });
        else n.specs.push({ at: 'end', side: -1, dir: 'front', full, long: true }, { at: 'end', side: 1, dir: 'front', full, long: true });
        break;
      }
      case 'annex': if (!freeSide) return null; n.specs.push({ at: 'inline', side: freeSide }); break;
      default: return null;
    }
    if (n.specs.length > budget || (fam.household && n.specs.length > S.HOUSEHOLDS[fam.household].wings)) return null;
    if (fam.roof === 'hip' && n.specs.filter(x => x.at === 'end').length > 1) return null; // a hip roof takes one wing (an L) and keeps its roof
    // an end wing must not reach the middle: a front one leaves the door a bay of the main wing's front
    if (n.specs.some(x => x.at === 'end' && n.W - wingDepth(x, n.D) < (x.dir === 'front' ? 2 : 1))) return null;
    const ws = wingsFromSpec(n.specs, n.W, n.D);
    return wingsClear(ws) && crossLined(ws) ? n : null;
  };
  const cStoreys = C.storeys && C.storeys[type];
  ['s1', 's2', 's3'].forEach((stage, i) => {
    const L = S.LADDER[stage];
    // the plan steps (one at s1 and s2, two at s3, where wings branch): each drawn from the odds of the steps this
    // building can take then
    const odds = Object.entries(g[stage] || { keep: 1 }).filter(([k]) => !allowed || allowed.includes(k));
    for (let k = 0; k < (i === 2 ? 2 : 1); k++) {
      const r = FR(), long = FR() < (i === 0 ? 0 : 0.5), tries = odds.map(([q, w]) => [q, w, apply(q, st, L.wings, long, i)]).filter(t => t[2]);
      if (!tries.length) continue;
      let x = r * tries.reduce((a, t) => a + t[1], 0);
      st = (tries.find(t => (x -= t[1]) <= 0) || tries[tries.length - 1])[2];
    }
    // storeys: one more now and then, never fewer than the culture builds at this stage
    const rs = FR(), rt = FR();
    // at s3 homes, taverns and halls reach the corpus share of two storeys by culture (styles.js UPPER_STOREY): the
    // odds here are what is left after the s2 draw, so the share holds over the whole path
    const share = i === 2 && S.UPPER_STOREY.types.includes(type) ? S.UPPER_STOREY.s3[cultureKey] : null;
    if (i > 0 && st.storeys < L.storeys) {
      let p = (g.storey && g.storey[stage] || 0) * sMult;
      if (share != null && st.storeys < 2) {
        const p2 = Math.min(0.95, (g.storey && g.storey.s2) || 0);
        p = Math.min(1, Math.max(0, (share - p2) / (1 - p2)) * sMult);
      }
      if (i === 2 && st.storeys >= 2) { if (st.D >= 5 && rt < ((g.storey && g.storey.third) || 0)) st = { ...st, storeys: 3 }; }
      else if (rs < p) st = { ...st, storeys: st.storeys + 1 };
    }
    if (cStoreys && cStoreys[stage] > st.storeys) st = { ...st, storeys: cStoreys[stage] };
    if (st.round) st = { ...st, storeys: 1 };
    // extras: each may come at this stage, within the stage's budget, and stays
    const ex = { ...st.extras };
    for (const [k, table] of Object.entries(g.extras || {})) {
      const rr = FR();
      if (ex[k] || Object.keys(ex).length >= L.extras) continue;
      let p = table[i] || 0;
      if (k === 'porch') p = C.porch ? Math.min(0.9, p + 0.3 * C.porch) : 0;
      if (k === 'balcony' && st.storeys < 2) p = 0;
      if (k === 'tower' && (st.specs.length || !['frankish-norman', 'castle-medieval', 'slavic', 'norse-highland', 'anglo-saxon'].includes(cultureKey))) p = 0;
      if (rr < p) ex[k] = stage;
    }
    // dormers: the cultures that build them, from s2
    const rd = FR();
    if (i > 0 && !ex.dormers && Object.keys(ex).length < L.extras && ['frankish-norman', 'anglo-saxon', 'castle-medieval', 'slavic', 'norse-highland', 'baltic'].includes(cultureKey) &&
      ['home', 'tavern', 'longhouse', 'storage', 'workshop'].includes(type) && rd < 0.4) ex.dormers = stage;
    st = { ...st, extras: ex };
    states[stage] = { ...st, label: st.round ? 'octagon' : planLabel(st.specs, st.W, st.D) };
  });
  return { fam, states };
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
  // the village hub (the hearth, D-139) has a generator of its own on the same pieces and helpers (lib/hub.js)
  if (req.type === 'hub') return (NODE ? require('./hub.js') : window.VHHub).generate(req, HUB_TOOLS);
  const type = S.TYPES[req.type] ? req.type : 'home';
  const T = { ...S.TYPES[type] };
  const biome = S.BIOMES.includes(req.biome) ? req.biome : 'Meadows';
  const seed = req.seed ?? 1;
  // the household: every stage of a building with the same lineage grows from the one before (massingPath)
  const lineage = req.lineage != null && isFinite(+req.lineage) ? +req.lineage : seed;
  const cultureKey = S.cultureKey(req.culture) || S.cultureFor(biome, rng(lineage * 104729 + type.length * 13 + 7));
  const C = { ...S.CULTURES[cultureKey], biome };
  const stage = ['s1', 's2', 's3'].includes(req.stage) ? req.stage : 's1';
  // Decor grows in stages as the household decorates (D-071): the design is furnished at d3 and each piece is tagged
  // with the stage it goes up in; an asked d1 or d2 keeps the pieces of that stage and those before it
  // (lib/persona.js growth), so d2 holds all of d1 in the same places and d3 all of d2, and the building is the same at
  // every decor stage. req.stages false furnishes at the asked stage alone (the old way, for comparison).
  const decorAsked = ['d1', 'd2', 'd3'].includes(req.decor) ? req.decor : 'd2';
  // (a bare build for ranking seeds takes the same d3 structure, so every decor stage ranks its seeds alike)
  const decor = req.stages === false ? decorAsked : 'd3';
  const R = rng(seed * 7919 + type.length * 31 + stage.charCodeAt(1) * 7 + cultureKey.length);
  const K = S.roofKit(S.kitFor(biome), C, biome);
  const b = new Build();
  const form = req.form || formFor(C, type, stage);
  const info = { type, biome, cultureKey, stage, decor: decorAsked, seed, form, grow: !req.skipDecor && req.stages !== false };
  // the household's path over the stages (massingPath), unless a plan or a fresh plan is asked for, or the culture's
  // form sets its own shape and size per stage
  const M = !req.fresh && !(req.plan && req.plan !== 'auto') && [null, 'svan', 'raised', 'open'].includes(form || null) && S.growthFor(cultureKey, type) && !T.tower
    ? massingPath({ type, T, C, cultureKey, form, lineage }) : null;
  const MS = M && M.states[stage];
  if (MS) info.massing = M.fam.household || 'hall';
  // the household (lib/persona.js), from a random stream of its own: what the furnishing, the yard and the stands lean
  // to. The same lineage keeps the same people; in a home their number fits the house (one, two, three or more).
  let household = Persona.persona({ type, biome, culture: cultureKey, seed: lineage, persona: req.persona });
  if (M && M.fam.household && typeof req.persona !== 'string') {
    const want = { cozy: 1, couple: 2 }[M.fam.household] || Math.max(3, household.size);
    if (want !== household.size && !(req.persona && req.persona.size)) household = Persona.persona({ type, biome, culture: cultureKey, seed: lineage, persona: { ...(req.persona || {}), size: want } });
  }
  info.household = household;
  // the room layout planner (lib/layout.js) reads the same household: its broad traits lean the room schemes, and
  // its own number draws the layout, so the same people keep the same habits at every stage
  const layoutCtx = req.layout === false ? false : {
    traits: { tidiness: household.tidy, comfort: household.comfort, display: household.wealth, size: household.size,
      hobbies: Object.entries(household.hobby || {}).filter(([, v]) => v >= 0.4).map(([k]) => k) },
    // the household's own draw: other people arrange the same house their own way (Interiors tab, 2026-11-10: six
    // households in one house came out with the same rooms but for a rug's angle); one household keeps it every stage
    seed: (household.salt ^ Persona.hash(household.label || '')) % 997,
    ...(req.layout || {}),
  };
  // asked-for storeys, porch and pitch go into the name, so different requests never share a file name
  info.asked = (req.storeys >= 1 && req.storeys <= 3 ? `-${Math.round(req.storeys)}st` : '') + (req.porch === true ? '-porch' : req.porch === false ? '-noporch' : '') + (req.pitch ? `-p${+req.pitch}` : '')
    + (typeof req.persona === 'string' && req.persona ? `-${req.persona.toLowerCase().replace(/[^a-z]+/g, '-')}` : req.persona && typeof req.persona === 'object' ? `-hh${Persona.hash(JSON.stringify(req.persona)) % 1000}` : '');
  // Meadows and Black Forest villages build in wood at first; stone for later stages and for halls from s2 (D-012)
  const early = (biome === 'Meadows' || biome === 'Black Forest') && (stage === 's1' || (stage === 's2' && !['longhouse', 'tavern', 'temple', 'tower'].includes(type)));
  C.early = early;
  const stoneOK = !!K.stoneWall && biome !== 'Meadows' && !early;
  // the hearth's own stone from s2 in every biome (D-131); the Meadows makes no stone, so its hearths take the Black
  // Forest's blocks and floors (marked hearthStone for the materials check, lib/pieces.js hearthStoneOk)
  const KH = +stage[1] >= 2 && !K.stoneWall ? { ...K, stoneWall: 'stone_wall_2x1', stoneBlock: 'stone_wall_1x1', stoneFloor: 'stone_floor_2x2', stoneArch: 'stone_arch' } : K;
  const hearthStoneOK = +stage[1] >= 2 && !!KH.stoneWall;
  // a request may name the storeys (1 to 3) and ask for a porch or none; otherwise the culture and type decide
  const askedStoreys = req.storeys >= 1 && req.storeys <= 3 ? Math.round(req.storeys) : null;
  const storeysOf = () => askedStoreys || (C.storeys && C.storeys[type] && C.storeys[type][stage]) || T.storeys[stage];

  if (T.well) return finish(wellDesign(b, K, biome, stage), info);
  if (T.camp && !form) return finish(campDesign(b, K, biome, stage, R, decor), info);

  let plan = req.plan && req.plan !== 'auto' ? req.plan : null;
  if (MS && MS.round) plan = 'octagon';

  // ---- round forms: round houses, crannogs, goahti, lavvu, yurts, round towers
  if (['round', 'tent', 'yurt'].includes(form) || plan === 'octagon' || (!plan && T.camp)) {
    const kind = form === 'tent' || form === 'yurt' ? form : (T.camp ? 'tent' : 'round');
    const [bx, bz] = T.bays[stage];
    const avg = Math.round((bx + bz) / 2);
    let side = (C.size && C.size[type] && C.size[type][stage]) || (avg >= 7 ? 6 : avg >= 4 ? 4 : 2);
    const storeys = T.tower ? T.storeys[stage] : 1;
    if (storeys > 1 && side < 4) side = 4; // a ladder needs three cells in a row: the foot, the hole and the landing
    // a home or hall has a fire in the middle and at least one bed: a 4.8 m round house has no room for both (T-102)
    if (['home', 'hall'].includes(T.use) && kind !== 'tent' && side < 4) side = 4;
    const r = kind === 'yurt' ? 1 : (C.pitch === 26 && kind === 'round' ? 1 : 2);
    // (one storey at s3 stands taller, as the rest below)
    const SH = stage === 's3' && !T.tower && kind !== 'tent' && storeys === 1 ? TALL_ONE : MIN_STOREY;
    const F = C.stilts ? (C.stiltH || 2) : (T.raised || C.raised ? 1 : 0);
    let wallStyle = req.walls && req.walls !== 'auto' ? req.walls : wallStyleFor(R, C, cultureKey, biome);
    if (T.tower && stoneOK) wallStyle = 'stone';
    if (/stone/.test(wallStyle) && !stoneOK && !reaches(biome, 'Swamp')) wallStyle = 'plank';
    C.wallStyle = wallStyle;
    const Kr = kind === 'tent' && reaches(biome, 'Plains') ? { ...K, ...S.ROOF_SETS.dark } : K;
    C.baseTop = F + 0.6; // stone-base courses on the ground storey only
    if (F > 0.01 && /stone|marble|grausten/.test(C.wallStyle)) { C.wallStyle = 'plank'; wallStyle = 'plank'; } // stone on posts would fall
    octagonDesign(b, Kr, C, { side, F, SH, storeys, r, T, kind, stage, deck: C.stilts ? Math.max(DECK_MIN, C.deck || 2) : 0,
      walk: C.boardwalk ? { s1: 6, s2: 8, s3: 10 }[stage] : 0, fence: !!C.stilts && stage === 's3' });
    info.plan = 'octagon'; info.roof = kind === 'yurt' ? 'crown' : 'conical'; info.walls = kind === 'tent' ? 'none' : wallStyle;
    const ctx = { K: Kr, C, biome, use: T.use, stoneOK, F, SH, storeys, top: F + storeys * SH };
    clearDoorways(b);
    // posts where the game would let the roof fall (a round tower's crown), clear of the fire's place
    propUp(b, Kr, biome, { raisedOk: true, keepOut: (x, z) => !T.tower && Math.hypot(x, z) < 2.2 });
    if (!req.skipDecor) Decor.decorate(b, { use: T.use, decor, biome, type, R, culture: cultureKey, doorX: b.doorX, fireAt: { x: 0, z: 0 }, persona: household, layout: layoutCtx });
    // things on item stands (lib/stands.js; round houses have no interior library pass)
    if (!req.skipDecor) Kitbash.stands(b, { K: Kr, C, T, type, use: T.use, biome, decor, persona: household }, keepClear(b));
    if (!req.skipDecor && Kitbash.budgets) Kitbash.budgets(b, { culture: cultureKey }); // the rooms' light and rug budgets (lib/kitbash.js)
    // corner and wall-face motifs on the eight-sided walls (details.js), after the furnishing
    if (kind === 'round' && !(req.details && req.details.motifs === false)) Details.roundTrim(b, { K: Kr, C, cultureKey, T, type, stage, decor, biome, plan: 'octagon', F, SH, storeys, edges: [], wings: [], seed });
    settle(b, { ...ctx, type, skipDecor: !!req.skipDecor });
    outside(b, req, { K, C, type, stage, biome, cultureKey, decor, seed, household });
    return finish(b, info);
  }

  // ---- a square stone tower alone (Svan)
  if (form === 'tower-svan') {
    C.wallStyle = stoneOK ? 'stone' : 'plank';
    const n = { s1: 4, s2: 5, s3: 6 }[stage];
    towerAt(b, K, C, { cx: 0, cz: 0, n: 3, F: 0, storeys: n, SH: MIN_STOREY, door: 'front', use: 'guard' });
    info.plan = 'square'; info.roof = 'hip'; info.walls = C.wallStyle;
    b.notes.push('Square stone tower with wooden floors, slit windows and a low pyramid roof.');
    clearDoorways(b);
    if (!req.skipDecor) Decor.decorate(b, { use: 'guard', decor, biome, type, R, culture: cultureKey, doorX: b.doorX, persona: household, layout: layoutCtx });
    settle(b, { K, C, biome, use: 'guard', stoneOK, F: 0, SH: MIN_STOREY, storeys: n, top: n * MIN_STOREY, skipDecor: !!req.skipDecor });
    if (!req.skipDecor && Kitbash.budgets) Kitbash.budgets(b, { culture: cultureKey }); // the rooms' light and rug budgets (lib/kitbash.js)
    return finish(b, info);
  }

  // ---- plan and roof
  if (form === 'sunken') Object.assign(C, { eaves: 2, porch: 0, pitch: 45 });
  if (!plan && MS) plan = MS.label;
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
      // a lower, narrower annex in line with the main roof (a byre or store at one end, a second ridge line): the best
      // liked builds have three or four ridge lines where ours had one or two (critic study, 2026-11-09)
      const NAVE = { home: { s2: 1, s3: 1.5 }, longhouse: { s2: 1, s3: 1 }, barn: { s2: 1, s3: 1 }, storage: { s2: 0.6, s3: 0.6 }, smithy: { s3: 0.6 } };
      const canGable = !!(C.roofs || ROOF_BY_CULTURE[cultureKey] || { gable: 1 }).gable && !(form === 'raised' || form === 'open');
      if (canGable && NAVE[type] && NAVE[type][stage] && !(C.plans && C.plans[type])) w.nave = NAVE[type][stage];
      plan = pick(R, Object.keys(w).length ? w : { rect: 1 });
    }
  }
  let roofKind = req.roof && req.roof !== 'auto' ? req.roof : null;
  if (!roofKind) {
    if (plan === 'court') roofKind = 'flat';
    else if (['gables', 'greek', 'nave'].includes(plan) || ['drum', 'stave', 'sunken', 'svan'].includes(form) || (form === 'dome')) roofKind = 'gable';
    else if (form === 'keep') roofKind = stoneOK ? 'flat' : 'hip';
    else if (MS && plan !== 'octagon') roofKind = M.fam.roof;
    else roofKind = plan === 'octagon' ? 'conical' : pick(R, C.roofs || ROOF_BY_CULTURE[cultureKey] || { gable: 1 });
  }
  if (T.open === 'sides' && !req.roof && !MS && R() < 0.4) roofKind = 'shed';
  if (plan === 'octagon' && roofKind !== 'flat') roofKind = 'conical';
  if (plan !== 'octagon' && roofKind === 'conical') roofKind = 'hip';
  if (roofKind === 'shed' && plan !== 'rect' && plan !== 'long' && plan !== 'square') plan = 'rect';
  // T and cross plans keep gables: a hip main wing with gabled wings through it read as a broken roof (r5 review)
  if (roofKind === 'hip' && (['gables', 'court', 'greek', 'nave', 'U', 'T', 'cross'].includes(plan) || plan.includes('+'))) roofKind = 'gable';
  let wallStyle = req.walls && req.walls !== 'auto' ? req.walls
    : MS ? (early && /stone|marble/.test(M.fam.walls) ? M.fam.wallsEarly : M.fam.walls) : wallStyleFor(R, C, cultureKey, biome);
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
    // wings four cells deep round a yard of at least two (Tyler, showcase 08: "exceptionally tight, almost too tight to
    // walk around. It needs to be wider in all areas"; his two-piece rule for the arcade walk round the yard): 20 m
    // square, 24 m for an s3 hall (the corpus one-storey homes are 11.5 to 17 m across at the quartile and median,
    // data/measures-storeys.json; the one middle-eastern home in the corpus is 34 by 38 m)
    // (four cells deep: an arcade walk two cells wide on the yard side and rooms two cells deep behind it)
    Object.assign(wingOpts, { Q: stage === 's3' && type !== 'home' ? 12 : 10, dW: 4 });
    bx = wingOpts.Q; bz = 4;
  } else if (MS) { bx = MS.W; bz = MS.D; if (roofKind === 'hip' && bx < bz) bx = bz; }
  else if (form === 'keep') { bx = bz = { s1: 3, s2: 3, s3: 5 }[stage]; }
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
  let storeys = form === 'open' ? 1 : ['keep'].includes(form) ? { s1: 2, s2: 3, s3: 3 }[stage] : ['stave', 'court', 'dome', 'drum', 'sunken', 'gables'].includes(form) || plan === 'gables' ? 1 : MS && !askedStoreys ? MS.storeys : storeysOf();
  let SH = T.low ? 2 : T.tower ? 3 : (['longhouse', 'tavern', 'temple'].includes(type) || stage === 's3') ? 3 : 2;
  if (form === 'keep' || plan === 'court') SH = 3;
  if (form === 'stave') SH = 4;
  if (plan === 'gables') SH = 2;
  if (form === 'open') SH = 3;
  if (C.storeyH && !T.low) SH = Math.max(SH, C.storeyH);
  SH = Math.max(SH, form === 'sunken' ? LOW_STOREY : MIN_STOREY);
  const flat = roofKind === 'flat';
  const pitch = req.pitch || (T.low || roofKind === 'shed' ? 26 : (C.pitch || 45));
  const r = +pitch === 45 ? 2 : 1;
  const lookout = T.tower && !['keep'].includes(form);

  // ---- foundation height
  let F = 0;
  // a stone footing under timber walls: by culture, and from stage 3 for the cultures that had none (round 2 and 4
  // reviews: buildings standing straight on the grass looked dropped there; D-012 keeps early Meadows and Black
  // Forest buildings in wood)
  const earlyAt = st => (biome === 'Meadows' || biome === 'Black Forest') && (st === 's1' || (st === 's2' && !['longhouse', 'tavern', 'temple', 'tower'].includes(type)));
  const stoneBaseAt = st => !!((C.plinth === 'stone' || (C.plinth === 'byBiome' && biome !== 'Meadows') || C.stoneGround ||
    (C.plinth == null && !C.stilts && !C.raised && !C.podklet && st === 's3' && ['anglo-saxon', 'frankish-norman', 'celtic', 'norse-highland'].includes(cultureKey))) && K.plinth && !earlyAt(st));
  const stoneBase = stoneBaseAt(stage) && !(MS && T.open && !stoneBaseAt('s1'));
  // a household whose house gets a stone course later stands on short timber posts until then, at the same height, so
  // the course goes in under the walls without moving the house (D-012 keeps the early stages in wood)
  // (open-sided sheds stay on the ground: a stair to an open front would run under its beam)
  const postsTillStone = MS && !T.open && !stoneBase && stoneBaseAt('s3');
  const podklet = C.podklet && ['home', 'longhouse', 'tavern'].includes(type) && (MS ? M.fam.podklet : stage !== 's1');
  if (plan === 'gables') F = 0; else if (T.dock) F = 1; else if (C.stilts) F = C.stiltH || 2; else if (podklet) F = 2; else if (form === 'raised') F = C.storeH || 1;
  else if (T.raised || C.raised) F = C.stiltChance && (MS ? M.fam.stilt2 : R() < C.stiltChance) ? 2 : 1; else if (stoneBase) F = C.plinthHigh ? 2 : 1;
  else if (postsTillStone) F = C.plinthHigh ? 2 : 1;
  // a deck all round on stilts: at least two floor pieces wide, as every walk (Tyler's two-piece rule)
  const deck = C.stilts && plan !== 'octagon' ? Math.max(DECK_MIN, 2 * Math.ceil((C.deck || 2) / 2)) : 0;
  // no tower blocks: the eave stays within 1.1 times the short side of the footprint (2026-11-09 review: three storeys
  // on a 6 to 8 m plan read as a tower); towers, keeps and the like keep their height
  // (a second storey counts its walls from the ground floor up, without the footing under them: two 3 m storeys on a
  // 6 m deep plan with a 1 m footing are 9 to 10 m to the ridge, the corpus median for Norse buildings is 9.3 m)
  const eaveOf = n => (n <= 2 && stage === 's3' ? 0 : F) + n * SH;
  if (!T.tower && !form && !req.storeys) while (storeys > 1 && eaveOf(storeys) > 1.1 * 2 * Math.min(W, D) + 0.01) storeys--;
  // a one-storey building at s3 stands taller (Tyler, showcase review 2026-11-11: the steppe tavern's "walls are also a
  // bit short, its underwhelming"; the middle-eastern home "could also be one wall-height higher"). Corpus main
  // buildings of one storey have their eaves 5 m up at the quartile (homes, 78 builds; workshops 6.5, storehouses 6,
  // other 4; data/measures-storeys.json), where ours stood at 3 m.
  if (stage === 's3' && storeys === 1 && !T.low && !T.tower && form !== 'sunken' && form !== 'stave' && plan !== 'gables') SH = Math.max(SH, TALL_ONE);
  info.storeys = storeys; if (MS && MS.storeys !== storeys) info.storeysDrawn = MS.storeys;
  // stone and marble walls take no support from wooden posts or floors in Valheim: on posts the walls are planks
  C.baseTop = F + 0.6; // stone-base courses only at the bottom (F may still become 0.5 for a stone floor)
  const onPosts = F > 0.01 && !podklet && (C.stilts || T.dock || T.raised || C.raised || form === 'raised' || !stoneBase);
  if (onPosts && /stone|marble|grausten/.test(C.wallStyle)) { C.wallStyle = C.logWalls ? 'log' : 'plank'; C.stoneWalls = false; C.parapet = false; info.walls = C.wallStyle; }

  const wings = MS && plan !== 'octagon' ? wingsFromSpec(MS.specs, W, D) : wingsFor(plan, W, D, R, wingOpts);
  W = wings[0].W; // a U plan may widen the main wing
  const cells = cellsOf(wings);
  const edges = edgesOf(cells);
  const verts = vertsOf(edges);
  // half-timber braces go in the bays at the corners only (a brace in every panel read as busy, 2026-11-09 review)
  {
    const yaws = new Map();
    for (const e of edges) { const ux = e.yaw === 0 ? 1 : 0, uz = e.yaw === 0 ? 0 : 1; for (const sg of [-1, 1]) { const k = `${e.x + sg * ux},${e.z + sg * uz}`; yaws.set(k, (yaws.get(k) || 0) | (e.yaw === 0 ? 1 : 2)); } }
    const corner = k => yaws.get(k) === 3;
    // corner bays and every other bay between (a brace in every panel was busy; none between read as plain planks)
    b.braceBay = (x, z, yaw) => { const ux = yaw % 180 === 0 ? 1 : 0, uz = 1 - ux; return corner(`${x - ux},${z - uz}`) || corner(`${x + ux},${z + uz}`) || Math.round((x + z) / 2) % 2 === 0; };
  }

  // a loggia: the ground storey's front row of cells left open under the upper floor, on posts, the front wall and
  // door set back a row (2026-11-09 review: a second mass and depth on the front; an upper storey carried on posts)
  const w0L = wings[0];
  // a home's upper storey at s3 as a loft under the roof on low knee walls (styles.js LOFT.home: the corpus share of
  // beds under a roof slope over its share of two storeys, by culture), drawn from the household's own stream
  const LH = S.LOFT && S.LOFT.home;
  const kneeLoft = !!LH && (req.details && req.details.kneeLoft != null ? req.details.kneeLoft
    : rng((lineage * 7193 + strHash(cultureKey) * 17 + 0x10f7) >>> 0)() < (LH.share[cultureKey] || 0)) &&
    type === 'home' && stage === 's3' && storeys === 2 && roofKind === 'gable' && r === 2 && !form && !['gables', 'court', 'octagon'].includes(plan) && w0L.alpha === 0 &&
    !C.stoneWalls && !(C.eaves > 1) && !T.tower;
  const SHs = s => kneeLoft && s === storeys - 1 ? LH.knee : SH; // each storey's wall height
  if (kneeLoft) info.loft = 'knee';
  const loggia = !kneeLoft && (req.details && req.details.loggia != null ? req.details.loggia
    : ['anglo-saxon', 'frankish-norman', 'castle-medieval', 'slavic', 'norse', 'norse-forest'].includes(cultureKey) && stage === 's3' &&
      ['home', 'tavern', 'storage', 'workshop'].includes(type) && rng(seed * 13 + 5)() < 0.6) &&
    // (two rows of cells deep, as any walk under a roof (Tyler's two-piece rule), and three rows of room left behind it)
    ['rect', 'long'].includes(plan) && wings.length === 1 && w0L.alpha === 0 && w0L.D >= 2 * LOGGIA_ROWS + 3 && storeys >= 2 && F === 0 &&
    !C.stoneWalls && !deck && !podklet && roofKind === 'gable' && !T.tower && !form;
  const zFront = w0L.cz - w0L.D, zBack = zFront + 2 * LOGGIA_ROWS;
  const inLoggia = c => loggia && c[1] < zBack - 0.01;
  let gEdges = edges;
  if (loggia) {
    const inYaw = (edges.find(e => e.out[1] < 0) || {}).inYaw;
    gEdges = edges.filter(e => !inLoggia(e.cell) || e.out[0] !== 0); // the loggia's ends stay walled; its front is open
    for (const [, c] of cells) if (Math.abs(c[1] - (zBack - 1)) < 0.01) gEdges.push({ x: c[0], z: zBack, yaw: 0, out: [0, -1], cell: [c[0], zBack + 1], inYaw });
  }

  // courtyard: cells next to the yard are a gallery; their yard side is an arcade
  const Q = wingOpts.Q;
  const inYard = (x, z) => plan === 'court' && Math.abs(x) < Q && Math.abs(z) < Q && !cells.has(`${x},${z}`);
  const arcade = new Set(edges.filter(e => inYard(e.cell[0] + 2 * e.out[0], e.cell[1] + 2 * e.out[1])));
  // (the walk under the arcade two cells deep: the cells on the yard and the row behind them)
  const gallery = new Set([...arcade].flatMap(e => [`${e.cell[0]},${e.cell[1]}`, `${e.cell[0] - 2 * e.out[0]},${e.cell[1] - 2 * e.out[1]}`]).filter(k => cells.has(k)));

  // footing: stilts and short posts on a grid, a log ground storey, or a stone course round the edge
  if (F > 0) {
    if (podklet) {
      for (const e of edges) for (let y = 0; y < F - 0.01; y += 0.5) b.put('wood_wall_log', e.x, y + 0.25, e.z, e.yaw);
      b.notes.push('Log ground storey (podklet) for storage under the living floor.');
    } else if (C.stilts || T.dock || T.raised || C.raised || form === 'raised' || !stoneBase) {
      const grid = new Map(verts.map(v => [`${v[0]},${v[1]}`, v]));
      if (deck) for (const [, [x, z]] of cells) for (const dx of [-1, 1]) for (const dz of [-1, 1]) for (let k = 0; k <= deck / 2; k++) { const vx = x + dx * (1 + k * 2), vz = z + dz * (1 + k * 2); grid.set(`${vx},${vz}`, [vx, vz]); }
      for (const [, [x, z]] of grid) posts(b, K, x, z, F);
    } else {
      // stone courses down from the floor; a 2 m course stands half in the ground under a 1 m floor
      const ch = P.piece(K.plinth).size[1];
      for (let t = F; t > 0.01; t -= ch) for (const e of edges) b.put(K.plinth, e.x, t - ch / 2, e.z, e.yaw);
    }
  }

  // floors (and a deck all round on stilts)
  const floorPiece = (C.stoneWalls && K.stoneFloor && F === 0) ? K.stoneFloor : K.floor;
  // A 1 m stone floor sits half in the ground: its middle on the ground, the rooms on its top. The game sets a design's
  // lowest pivot on the ground, so this keeps fields, wells and pens on the ground too; the spawner then raises the
  // earth round the stone so only its top edge shows.
  if (thickFloor(floorPiece) && F === 0) F = 0.5;
  const floorY = thickFloor(floorPiece) ? F - 0.5 : F;
  const floorCells = new Map(cells);
  if (deck) for (const [, [x, z]] of cells) for (let dx = -deck; dx <= deck; dx += 2) for (let dz = -deck; dz <= deck; dz += 2) floorCells.set(`${x + dx},${z + dz}`, [x + dx, z + dz]);
  for (const [k, [x, z]] of floorCells) b.put(cells.has(k) ? floorPiece : K.floor, x, cells.has(k) ? floorY : F, z);

  // door: the front edge of the main wing nearest the middle; in a sunken hut, the middle of the left gable end
  let door;
  if (form === 'sunken') door = edges.filter(e => e.out[0] < 0 && inside(wings[0], e.cell[0], e.cell[1])).sort((a, c) => Math.abs(a.z) - Math.abs(c.z))[0];
  if (!door) {
    // not in the inside corner of a wing that comes forward (a household's plan): a bay of wall between them
    const crowded = e => MS && wings.slice(1).some(w => inside(w, e.x - 2, e.z - 1) || inside(w, e.x + 2, e.z - 1)) ? 1 : 0;
    const front = gEdges.filter(e => e.out[1] < 0 && inside(wings[0], e.cell[0], e.cell[1])).sort((a, c) => crowded(a) - crowded(c) || Math.abs(a.x - wings[0].cx) - Math.abs(c.x - wings[0].cx));
    door = front.length ? front[0] : gEdges.filter(e => e.out[1] < 0)[0] || gEdges[0];
  }
  const doorX = door.x, doorZ = door.z;
  const backDoor = C.opposedDoors && !T.tower && form !== 'sunken'
    ? edges.filter(e => e.out[1] > 0 && inside(wings[0], e.cell[0], e.cell[1])).sort((a, c) => Math.abs(a.x - doorX) - Math.abs(c.x - doorX))[0] : null;
  if (backDoor) b.notes.push('Doors in the middle of both long sides.');
  // a wide entrance (ideas gap 10): a second leaf in the bay beside the front door, toward the middle of the wall
  const door2 = wideDoor({ type, stage, T, form, plan, door, gEdges, wing: wings[0], seed, cultureKey, req, F });
  if (door2) b.notes.push('A wide entrance: two doors side by side.');

  // the fire's place: the middle of the main wing's ridge, in line with the door in a house (the smoke hole and chimney
  // go over it), kept free of ladders
  const fireInside = ['hall', 'home', 'smithy', 'temple'].includes(T.use) && !T.tower;
  const lit = ['hall', 'home'].includes(T.use) && !T.tower; // rooms the decorator lays a fire in
  const w0 = wings[0], hipMain = roofKind === 'hip' && w0.W >= w0.D;
  let ventAt = fireInside && !['dome', 'drum'].includes(form) && !flat && roofKind !== 'shed' && !lookout
    ? (w0.alpha === 0 && T.use === 'home' ? { x: doorX, z: w0.cz } : { x: w0.cx, z: w0.cz }) : null;
  if (ventAt && hipMain) ventAt = { x: Math.max(w0.cx - (w0.W - w0.D), Math.min(w0.cx + (w0.W - w0.D), ventAt.x)), z: w0.cz }; // over a hip ridge
  // a home's fire against a wall (hearthPlan): at a gable end under the ridge, half in the gable wall with a stone
  // stack outside, or against the back wall with a shaft out through the roof
  // a middle-fire home that draws the gable stack (D-131, 0.6, the stack's own stream) gets its fire moved to that end,
  // half in the gable wall with the stack over it (D-132: "Fireplaces can move spots"; lead's call, round 6: corpus
  // builders make no stack without a fire under it, and the corpus's 86 middle home fires vent by a gap, a roof hole or
  // nothing). The end is the one the stack would take (stackEndFor); a tower that may come at the +x end keeps it to -x.
  const midStack = type === 'home' && hearthStoneOK && stage !== 's1' && roofKind === 'gable' && plan !== 'gables' && !flat && !T.tower && F < 1.01 &&
    !C.stoneWalls && !/stone|marble|grausten/.test(C.wallStyle || '') && rng((lineage * 4099 + strHash(cultureKey) * 13 + 0x57ac) >>> 0)() < 0.6
    ? stackEndFor(wings, form === 'svan' || stage === 's3' ? { cx: W - 3, n: 3 } : null, { may: true }) : 0;
  const hearth = lit && ventAt ? hearthPlan({ T, C, cultureKey, lineage, roofKind, plan, wings, flat, form, M, stoneOK: hearthStoneOK, F, stage, K: KH, cells,
    doors: [door, backDoor].filter(Boolean), area: cells.size * 4 * storeys, type, storeys, midStack: req.hearth === 'middle' ? 0 : midStack }) : { spot: 'middle' };
  if (req.hearth === 'middle') hearth.spot = 'middle';
  info.hearth = hearth.spot;
  if (hearth.why) info.hearthWhy = hearth.why;
  if (hearth.stackWhy) info.stackWhy = hearth.stackWhy;
  if (hearth.moved) info.hearthMoved = hearth.moved;
  if (hearth.movedHere) b.notes.push('The household moved the fire when the house was reworked at this stage; the roof over its old place is closed.');
  if (hearth.spot === 'end') ventAt = { x: hearth.x, z: hearth.z };
  if (hearth.spot === 'side' || hearth.spot === 'stack') ventAt = null;
  let flue = lit && ventAt ? flueRect(w0, ventAt, hipMain ? w0.W - w0.D : w0.W - 1) : null;
  if (hearth.spot === 'side') flue = cellRect([hearth.x, hearth.z]);
  // the cell in front of a stack hearth stays clear of ladders and stairs (the shaft is outside the house)
  const stackKeep = hearth.spot === 'stack' ? cellRect([hearth.x, hearth.z]) : null;
  // the wall bay behind the hearth: the gable's middle bay for an end or stack hearth, the bay behind a side one
  const hearthBay = e => (hearth.spot === 'end' || hearth.spot === 'stack') ? e.yaw === 90 && Math.abs(e.x - hearth.xW) < 0.01 && Math.abs(e.z - hearth.z) < 0.01
    : hearth.spot === 'side' ? e.yaw === 0 && Math.abs(e.x - hearth.x) < 0.01 && Math.abs(e.z - (hearth.z + hearth.sv)) < 0.01 : false;
  // under a flat roof the fire gets a cell of its own, away from the doors, before the ladders are placed; a chimney
  // goes up from it
  let flatCell = null;
  if (lit && flat && !lookout) {
    const doorEdges = [door, backDoor, door2].filter(Boolean);
    // a courtyard wing has doors to the yard near its middle: its fire goes to the far end
    // and off the outer walls when they are thick (a 1 m stone wall reaches half a metre into the cell beside it)
    const thick = /stone|marble|grausten/.test(C.wallStyle || '');
    // a courtyard's gallery is walled off from the rooms behind it, so it counts as outside here
    const roomCell = (cx, cz) => cells.has(`${cx},${cz}`) && !gallery.has(`${cx},${cz}`);
    const walled = ([x, z]) => [[2, 0], [-2, 0], [0, 2], [0, -2]].some(([dx, dz]) => !roomCell(x + dx, z + dz));
    // a home keeps its fire against a wall most of the time (hearthPlan's odds for the culture, from the household's
    // own stream): a cell along an outer wall, the far corner first
    // (the stage's draw, hearthDraw: the fire may move between stages, D-132). A thick stone wall takes the fire in a
    // niche: it stands half a cell out from the wall, under an opening over its cell and the next (the wall hearth of
    // the stone houses of the Levant and Arabia, a fire niche with a flue in the wall)
    const fd = hearthDraw(lineage, cultureKey, stage, M, cells.size * 4 * storeys, T.use === 'hall', T.use === 'hall' ? strHash(type) : 0, 4 * w0.W * w0.D), homeWall = fd.spot0 !== 'middle';
    { info.hearth = homeWall ? 'wall' : 'middle'; if (!homeWall) info.hearthWhy = 'drawn'; if (fd.moved) info.hearthMoved = fd.moved; if (fd.moved === stage) b.notes.push('The household moved the fire when the house was reworked at this stage; the roof over its old place is closed.'); }
    const score = ([x, z]) => (doorEdges.some(e => Math.hypot(e.x - x, e.z - z) < 2.5) ? 100 : 0) + (thick && !homeWall && walled([x, z]) ? 50 : 0) +
      (homeWall && !walled([x, z]) ? 8 : 0) + (plan === 'court' ? -1 : 1) * Math.hypot(x - doorX, z - w0.cz) * (homeWall && fd.moved ? 0.25 : 1) +
      (homeWall && fd.moved ? fd.sg * (x - w0.cx) * 0.5 : 0) +
      // where the wing opens into the next one people walk through: a wall fire keeps off that cell
      (homeWall && [[2, 0], [-2, 0], [0, 2], [0, -2]].some(([dx, dz]) => roomCell(x + dx, z + dz) && !inside(w0, x + dx, z + dz)) ? 12 : 0) +
      // in a thick-walled corner a long iron spit fits along neither wall: a niche in one wall comes first
      (thick && homeWall && [[2, 0], [-2, 0]].some(([dx]) => !roomCell(x + dx, z)) && [[0, 2], [0, -2]].some(([, dz]) => !roomCell(x, z + dz)) ? 6 : 0);
    flatCell = [...cells.values()].filter(([x, z]) => inside(w0, x, z) && !gallery.has(`${x},${z}`)).sort((a, c) => score(a) - score(c))[0] || null;
    if (flatCell) flue = cellRect(flatCell);
    // beside a thick wall the fire would reach into it: it goes between this cell and the next one away from the
    // wall, under a 4 x 2 m opening over both
    if (flatCell && thick) {
      // a side is walled where the next cell is not the building's (outer walls and a courtyard's alike)
      const [x, z] = flatCell, has = roomCell;
      const sx = !has(x - 2, z) && has(x + 2, z) ? 2 : !has(x + 2, z) && has(x - 2, z) ? -2 : 0;
      const sz = !has(x, z - 2) && has(x, z + 2) ? 2 : !has(x, z + 2) && has(x, z - 2) ? -2 : 0;
      const near = sx || sz ? [1] : [];
      const over = [[x, z], [x + sx, z], [x, z + sz], [x + sx, z + sz]].filter(([cx, cz], i, a) => a.findIndex(([ax, az]) => ax === cx && az === cz) === i);
      if (near.length && over.every(([cx, cz]) => cells.has(`${cx},${cz}`) && !gallery.has(`${cx},${cz}`) && !doorEdges.some(d => Math.hypot(d.x - cx, d.z - cz) < 1.1))) {
        flue = { x0: Math.min(x, x + sx) - 1, x1: Math.max(x, x + sx) + 1, z0: Math.min(z, z + sz) - 1, z1: Math.max(z, z + sz) + 1 };
        flatCell = homeWall ? [x + sx / 4, z + sz / 4] : [x + sx / 2, z + sz / 2];
      } else if (homeWall && !near.length) { info.hearth = 'middle'; info.hearthWhy = 'thick wall, no room'; }
    }
  }
  const doorCell = [door.cell[0], door.cell[1]];
  // (with no back door the second leaf of a wide entrance takes its place in the climbs' keep-offs)
  const backCell = backDoor ? [backDoor.cell[0], backDoor.cell[1]] : door2 ? [door2.cell[0], door2.cell[1]] : null;

  // ladders: one per storey above the ground, each with a clear foot, a hole above it and a landing; a flat roof gets a
  // last one up to a hatch
  const climbsUp = storeys - 1 + (flat && !lookout ? 1 : 0);
  const cellsG = loggia ? new Map([...cells].filter(([, c]) => !inLoggia(c))) : cells; // the ground rooms' cells
  // (a ladder keeps a cell off a wall hearth where it can: the spit on the fire reaches a metre either side)
  const fireRing = ['side', 'end'].includes(hearth.spot) ? cellRect([hearth.x, hearth.z]) : null;
  const ladders = climbsUp > 0 ? ladderPlan(cellsG, climbsUp, { door: doorCell, back: backCell, flue: stackKeep || flue, ring: fireRing, rise: SH }) : [];
  // a straight stair along a wall in place of the first ladder, where a long enough wall has room for it (most of the
  // best-liked builds climb by stairs; bench: req.details.stair true or false)
  const stairWanted = req.details && req.details.stair != null ? req.details.stair
    : climbsUp === 1 && !flat && +stage[1] >= 2 && ['home', 'tavern', 'longhouse', 'storage', 'workshop'].includes(type) && rng(seed * 7 + 3)() < 0.75;
  if (stairWanted && climbsUp === 1 && !flat && Math.abs(SH - Math.round(SH)) < 0.01) {
    const st = stairPlan(cellsG, Math.round(SH), { door: doorCell, back: backCell, flue: stackKeep || flue });
    if (st) { ladders[0] = st; b.notes.push('A stair along the wall up to the floor above.'); }
  }
  // under a knee-wall loft the climb comes up where people can stand: the cells along the ridge
  if (kneeLoft) {
    const strip = new Map([...cellsG].filter(([, [x, z]]) => inside(w0L, x, z) && Math.abs(z - w0L.cz) <= w0L.D - 2.5));
    const lad = ladderPlan(strip, 1, { door: doorCell, back: backCell, flue: stackKeep || flue, ring: fireRing });
    const st = stairWanted && Math.abs(SH - Math.round(SH)) < 0.01 ? stairPlan(strip, Math.round(SH), { door: doorCell, back: backCell, flue: stackKeep || flue }) : null;
    ladders.length = 0; if (st || lad[0]) ladders.push(st || lad[0]);
    if (!st) { const k = b.notes.indexOf('A stair along the wall up to the floor above.'); if (k >= 0) b.notes.splice(k, 1); }
    b.notes.push('A loft under the roof on low knee walls, the climb up to it under the ridge.');
  }
  if (climbsUp > 0 && ladders.length < climbsUp) b.notes.push('No room for a ladder with a clear foot and landing in this plan.');
  // a hall's upper floor at s3 is a loft over one end, open to the hall and its fire, with a rail on its open side
  // (lead's call on the storeys track, D-127: corpus Norse halls have a loft or gallery over part of the hall)
  const loft = kneeLoft ? (wings.length > 1 ? { cells: new Map([...cells].filter(([, [x, z]]) => inside(w0L, x, z))), knee: true } : null) : hallLoft({ type, stage, storeys, flat, roofKind, plan, form, T, w0, cells, cellsG, ladders, flue, stackKeep, doorCell, backCell, side: MS ? M.fam.growSide : 1 });
  if (loft && !loft.knee) { info.loft = 'hall'; b.notes.push('A loft over one end of the hall, open to the hall below, with a rail along its edge.'); }

  // details (lib/details.js): what trim this building gets, drawn from its own random stream so the rest of the
  // design comes out as before
  if (req.style) Object.assign(C, req.style); // the component bench (lab/bench.js) holds the rest fixed and varies one part
  C.windowStyle = req.style && req.style.windowStyle ? req.style.windowStyle : (T.low || ['storage', 'barn'].includes(type) || form === 'sunken' || (stage === 's1' && !['longhouse', 'tavern', 'temple'].includes(type))) ? 'single' : 'twin';
  // the window kit: size and what fills the light, by culture and biome (windowKit); the component bench may set one
  if (!(req.style && req.style.windowStyle)) C.winKit = req.style && req.style.winKit ? req.style.winKit : windowKit(cultureKey, biome, type, seed, SH);
  const dragonsHere = roofKind === 'gable' && plan !== 'gables' && ((C.dragons && ['longhouse', 'temple', 'tavern'].includes(type)) || (C.carved && stage !== 's1'));
  const dctx = { K, C, cultureKey, T, type, stage, decor, biome, plan, F, SH, storeys, edges, verts, cells, door, wings, flat,
    ladders, flue, fireKeep: stackKeep || flue, hearth, dragonsHere, R: rng(seed * 31337 + 7), persona: household };
  dctx.profile = Details.profile(dctx);
  // the building program (lib/program.js, track H, D-167): one feature family per facade, storey and run of windows,
  // a reasoned exception at most per run; the details read it for planters and corners
  if (Program) { try { dctx.program = Program.plan({ cultureKey, type, stage, decor, biome, seed, storeys, persona: household, village: req.village, kit: K }); } catch (e) { dctx.program = null; } }
  // the program's arch: an open light of the window kit becomes an arched one (its motif from the arched corpus windows,
  // lib/details.js motifWindow)
  if (dctx.program && dctx.program.front.features.includes('arch') && C.winKit && C.winKit.fill === 'open' && !(req.style && req.style.winKit)) C.winKit = { ...C.winKit, fill: 'arch' };
  dctx.notes = b.notes;
  // wall dormers: Frankish, English, Slavic and medieval cultures, from stage 2 (bench: req.details.dormers)
  dctx.profile.overhang = req.details && req.details.overhang != null ? req.details.overhang : true;
  dctx.profile.dormers = +stage[1] >= 2 && ['frankish-norman', 'anglo-saxon', 'castle-medieval', 'slavic', 'norse-highland', 'baltic'].includes(cultureKey) &&
    ['home', 'tavern', 'longhouse', 'storage', 'workshop'].includes(type) && dctx.R() < 0.45 && plan !== 'gables'; // (a gable row's long walls meet in valleys)
  dctx.profile.dormerPair = dctx.R() < 0.5;
  // a gate as the front door of work and store buildings (coverage audit: gates on 65 % of the best-liked builds)
  dctx.profile.gateDoor = +stage[1] >= 2 && !T.bigDoor && ['longhouse', 'storage', 'workshop', 'smithy', 'sawmill', 'farm'].includes(type) && SH >= 3 && dctx.R() < 0.6;
  // the household's extras (massingPath): a lean-to, a balcony and dormers stay once built
  if (MS) Object.assign(dctx.profile, { outshut: !!MS.extras.outshut, balcony: !!MS.extras.balcony, dormers: !!MS.extras.dormers });
  if (req.details) Object.assign(dctx.profile, req.details);
  if (loggia) Object.assign(dctx.profile, { svalgang: false, gablePorch: false, doorHood: false });
  if (door2) dctx.profile.gablePorch = false; // the porch's gable stood across the second leaf (Norse Meadows pool, hall s2)
  // a knee-wall loft has no upper wall for the gallery's door (the door went up into the roof: support, stability and
  // doors failed on Norse homes, integration round 4)
  if (kneeLoft) dctx.profile.svalgang = false;
  dctx.wallSegment = wallSegment;

  // the rhythm of a wall line: its bay count (k) and whether every bay takes a window; the front of a formal building
  // counts its bays from the main door
  const lineOf = e => `${e.out[0]},${e.out[1]}@${Math.round((e.x * e.out[0] + e.z * e.out[1]) * 10) / 10}`;
  // (only where the door stands on the middle bay of its wall: else counting from it moves the windows off the corners
  // and mirrors nothing)
  const midDoor = door && (() => { const ux = door.yaw === 0 ? 1 : 0, uz = 1 - ux, at = e => e.x * ux + e.z * uz, l = gEdges.filter(e => lineOf(e) === lineOf(door)).map(at);
    return l.length && Math.abs((Math.min(...l) + Math.max(...l)) / 2 - at(door)) < 0.1; })();
  const formalLine = dctx.program && dctx.program.formal && midDoor ? lineOf(door) : null;
  const rhythm = e => {
    const line = lineOf(e), ux = e.yaw === 0 ? 1 : 0, uz = e.yaw === 0 ? 0 : 1;
    const k = line === formalLine ? Math.round(((e.x - doorX) * ux + (e.z - doorZ) * uz) / 2) : Math.round((e.x + e.z) / 2);
    return { k, every: windowExtra(C, seed, line) };
  };

  // walls, frame and top plates per storey
  const open = T.open || null;
  let top = F;
  for (let s = 0; s < storeys; s++) {
    const y0 = F + s * SH;
    const up = ladders[s - 1], next = ladders[s], SHw = SHs(s), knee = SHw < SH;
    if (s > 0) {
      // (over a flight's foot where the wall stands just past it the floor stays open, so the stairwell runs to the wall:
      // a floor cell there was a 2 m pocket between the well and the wall, a walk one floor piece wide, council tavern
      // Plains byzantine seed 77)
      const footOpen = up && up.run && !cells.has(`${up.stand[0] - 2 * up.dir[0]},${up.stand[1] - 2 * up.dir[1]}`) ? `${up.stand[0]},${up.stand[1]}` : null;
      for (const [k, [x, z]] of cells) if (!onLadder(up, x, z, SH) && k !== footOpen && !(flue && inRect(flue, x, z)) && (!loft || loft.cells.has(k))) b.put(K.floor, x, y0, z);
      if (loft) loftRail(b, K, loft, up, y0, cells);
      if (up && up.run) putStairRun(b, K, up, y0 - SH);
      else if (up) putLadder(b, K, up, y0 - SH, SH);
      else b.notes.push('Upper floor without a ladder.');
    }
    const isTopLookout = lookout && s === storeys - 1;
    for (const e of (s === 0 ? gEdges : edges)) {
      if (isTopLookout) { railing(b, K, e.x, y0, e.z, e.yaw); continue; }
      if (open === 'all') continue;
      if (open === 'front' && e.out[1] < 0) continue;
      if (open === 'sides' && !(e.out[1] > 0)) continue;
      if (arcade.has(e)) continue;
      const isDoor = s === 0 && (e === door || e === backDoor || e === door2);
      // a barn's gates: three bays on the ground, the door bay alone when the floor is raised (one stair up)
      const isGate = (dctx.profile.gateDoor && s === 0 && (e === door || e === door2)) || T.bigDoor && s === 0 && e.out[1] < 0 && Math.abs(e.x - doorX) <= (F >= 0.9 ? 0.01 : 2.01) && Math.abs(e.z - doorZ) < 0.1;
      // the wall's rhythm, chosen per wall line and the same on every storey (lib/program.js, D-167): every other bay,
      // or with 1 m lights every bay on some lines (windowExtra: corpus walls carry 0.56 windows per plain wall bay, the
      // generator had 0.31 with every other bay); on a formal front the bays count from the door, so the windows
      // mirror about it
      const rh = rhythm(e);
      const evenBay = rh.k % 2 === 0;
      let isWindow = !knee && !isDoor && !isGate && (!T.tower || (form === 'keep' && s > 0)) && (evenBay || rh.every) && Math.abs(e.x - doorX) + Math.abs(e.z - doorZ) > 2.5 &&
        !(door2 && Math.abs(e.x - door2.x) + Math.abs(e.z - door2.z) < 2.5);
      if (plan === 'gables' && e.out[1] >= 0) isWindow = false;
      // a gable end gets one window per floor, in its middle bay (2026-11-09 review: windows scattered over gable ends)
      const w0g = wings[0];
      if (isWindow && w0g.alpha === 0 && roofKind === 'gable' && plan !== 'gables' && e.yaw === 90 && Math.abs(Math.abs(e.x - w0g.cx) - w0g.W) < 0.01 && Math.abs(e.z - w0g.cz) > 1.1) isWindow = false;
      if (!isWindow && !isDoor && !isGate && !T.tower && w0g.alpha === 0 && roofKind === 'gable' && plan !== 'gables' && e.yaw === 90 && Math.abs(Math.abs(e.x - w0g.cx) - w0g.W) < 0.01 &&
        Math.abs(e.z - w0g.cz) < 1.1 && Math.abs(e.x - doorX) + Math.abs(e.z - doorZ) > 2.5 && !(open || arcade.has(e))) isWindow = true;
      // a stone wall needs a timber bay over every opening (stone cannot span): half as many windows there, so the
      // wall reads as stone with openings, not timber between stone piers (2026-11-09 review)
      if (isWindow && /^stone$|marble|grausten/.test(C.wallStyle || '') && rh.k % 4 !== 0) isWindow = false;
      // no window behind a wall hearth, on any storey (its hood and shaft stand against that bay)
      if (isWindow && hearthBay(e)) isWindow = false;
      const style = C.frontWood && plan === 'gables' ? (e.out[1] < 0 ? 'plank' : null) : null;
      b.lastLight = null; b.flipDoor = !!door2 && e === door2; // the second leaf turned round, so the pair hangs from the outer posts
      // a 2 m tall light keeps to bays with wall on both sides along the wall (at a corner two of them left the corner
      // with no wall 2.5 m up, which the headroom check refuses)
      if (isWindow && C.winKit) { const ex = e.yaw === 0 ? 2 : 0, ez = e.yaw === 0 ? 0 : 2, es = s === 0 ? gEdges : edges;
        b.lightLow = ![-1, 1].every(sg => es.some(q => q.yaw === e.yaw && Math.abs(q.x - (e.x + ex * sg)) < 0.01 && Math.abs(q.z - (e.z + ez * sg)) < 0.01)); }
      wallSegment(b, K, C, e.x, y0, e.z, e.yaw, SHw, isGate ? 'gate' : isDoor ? 'door' : isWindow ? 'window' : 'wall', style);
      if (isWindow || isDoor || isGate) (b.openings = b.openings || []).push({ e, y0, SH: SHw, storey: s, kind: isGate ? 'gate' : isDoor ? 'door' : 'window', back: e === backDoor, light: isWindow ? b.lastLight : null });
      b.lightLow = false; b.flipDoor = false;
    }
    if (C.frame || open || T.tower || form === 'stave') for (const [x, z] of verts) {
      for (let y = y0; y < y0 + SHw - 0.01;) { const h = (y0 + SHw - y) >= 2 ? 2 : 1; b.put(h === 2 ? framePole(K, C) : K.pole1, x, y + h / 2, z); y += h; }
    }
    for (const e of edges) b.put(K.beam, e.x, y0 + SHw, e.z, e.yaw);
    if (s === 0 && loggia) {
      for (const e of gEdges) if (!edges.includes(e)) b.put(K.beam, e.x, y0 + SH, e.z, e.yaw); // over the set-back wall
      // posts along the open front and down its sides, carrying the upper storey
      for (let x = w0L.cx - w0L.W; x <= w0L.cx + w0L.W + 0.01; x += 2) for (let y = y0; y < y0 + SH - 0.01;) { const h = (y0 + SH - y) >= 2 ? 2 : 1; b.put(h === 2 ? framePole(K, C) : K.pole1, x, y + h / 2, zFront); y += h; }
      b.notes.push('A loggia: the front of the ground floor open under the upper storey, on posts.');
    }
    for (const w of wings) {
      const a = w.alpha === 270;
      const room = { x0: w.cx - (a ? w.D : w.W), x1: w.cx + (a ? w.D : w.W), z0: w.cz - (a ? w.W : w.D) + (loggia && s === 0 && w === w0L ? 2 * LOGGIA_ROWS : 0), z1: w.cz + (a ? w.W : w.D),
        y: y0, h: SHw, use: T.use, upper: s > 0, door: s === 0 && w.main ? { x: doorX, z: doorZ } : null, main: !!w.main, slots: [] };
      // over a hall with a loft the upper room is the loft alone; the rest is open to the roof
      if (loft && s > 0) { if (!w.main) continue; if (!loft.knee) Object.assign(room, { x0: loft.x0, x1: loft.x1, loft: 'hall' }); }
      if (knee) room.loft = 'knee';
      for (const e of (s === 0 ? gEdges : edges)) {
        if (!(e.cell[0] > room.x0 && e.cell[0] < room.x1 && e.cell[1] > room.z0 && e.cell[1] < room.z1)) continue;
        if (s === 0 && Math.abs(e.x - doorX) + Math.abs(e.z - doorZ) < 1.8) continue;
        if (backDoor && s === 0 && Math.abs(e.x - backDoor.x) + Math.abs(e.z - backDoor.z) < 1.8) continue;
        if (door2 && s === 0 && Math.abs(e.x - door2.x) + Math.abs(e.z - door2.z) < 1.8) continue;
        if (open === 'all' || (open === 'front' && e.out[1] < 0) || (open === 'sides' && !(e.out[1] > 0)) || arcade.has(e)) continue;
        if (knee && e.yaw !== (w.alpha === 0 ? 90 : 0)) continue; // in a loft only the gable ends stand full height
        const ux = e.yaw === 0 ? 1 : 0, uz = e.yaw === 0 ? 0 : 1, nx = -e.out[0], nz = -e.out[1];
        for (const t of [-0.5, 0.5]) room.slots.push({ x: e.x + ux * t, z: e.z + uz * t, y: y0, yaw: e.inYaw, nx, nz });
      }
      if (s > 0 && up) room.hole = up.hole;
      // keep the ladders, their feet and landings, and the chimney free of furniture
      room.keep = [];
      if (up && s > 0) room.keep.push(...(up.run || [up.hole]).map(cellRect), cellRect(up.land));
      if (next) room.keep.push(cellRect(next.stand), ...(next.run || [next.hole]).map(cellRect));
      if (flue && s > 0) room.keep.push(flue);
      if (room.slots) room.slots = room.slots.filter(sl => !room.keep.some(k => inRect(k, sl.x, sl.z, 0.6)));
      if (form === 'open') delete room.slots; // no walls: things stand along the edges of the floor
      b.rooms.push(room);
    }
    top = y0 + SHw;
  }
  dctx.wallTop = top; // the top of the walls (a knee-wall loft's are lower than a full storey's)
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
    // the walls between the gallery and the rooms are of planks: the rooms behind a 2 m gallery are 2 m deep, and a
    // 1 m stone wall on each side left them 1 m clear, with no 0.9 m way in or through (D-152; integration round 6)
    for (const e of inner) wallSegment(b, K, C, e.x, F, e.z, e.yaw, SH, doors.has(e) ? 'door' : 'wall', 'plank');
    arcadeAlong(b, K, [...arcade], F, SH);
    // the paved yard is walked through from one gallery to the next: a walk for the lanes (lib/layout.js walkMap,
    // lab/reach.js), never a room to furnish or count; its height is the ground storey's rooms' (set in finish)
    const yq = Q - 2 * wingOpts.dW;
    if (yq > 0) b.walks = [{ x0: -yq, x1: yq, z0: -yq, z1: yq, y: null, yard: true }];
    b.notes.push('Rooms on four sides of a yard, an arcade on the yard side.');
  }

  // a back room in a big house (before the furnishing, so the rooms are read with it)
  dctx.openings = b.openings || [];
  if (!open && plan !== 'court' && !req.skipDecor) Details.partition(b, dctx, wallSegment);

  // inner aisle posts for halls
  if (T.aisles && D >= 3 && plan === 'long') for (let x = -W + 2; x <= W - 2; x += 2) for (const z of [-(D - 2), D - 2])
    for (let y = F; y < top - 0.01; y += 2) b.put(framePole(K, C), x, y + 1, z);

  // ---- roof
  const roofTop = lookout ? F + (storeys - 1) * SH + 3 : top;
  // places where a drum, a dome or a tower stands instead of roof
  const holes = [];
  const domeCfg = form === 'dome' ? { x: 0, z: 0, side: D >= 5 ? 4 : 2 } : form === 'drum' ? { x: 0, z: 0, side: 2 } : null;
  if (domeCfg) { const ap = domeCfg.side / 2 / Math.tan(Math.PI / 8); holes.push({ x0: -ap - 0.6, x1: ap + 0.6, z0: -ap - 0.6, z1: ap + 0.6 }); }
  if (form === 'dome' && plan === 'greek') holes.push({ x0: -D, x1: D, z0: -D, z1: D });
  // a tower at a back corner: the Svan tower, and a timber or stone tower on the big halls of the cultures that built
  // them (the skyline of the best liked builds rises and falls twice as much as ours did)
  const towerCultures = ['frankish-norman', 'castle-medieval', 'slavic', 'norse-highland', 'anglo-saxon'];
  const cornerTower = stage === 's3' && ['tavern', 'temple', 'longhouse', 'home'].includes(type) && towerCultures.includes(cultureKey) &&
    ['rect', 'long'].includes(plan) && !lookout && F < 0.01 && (MS ? !!MS.extras.tower : dctx.R() < (type === 'home' ? 0.25 : 0.4));
  const svanTower = (form === 'svan' && stage !== 's1') || cornerTower ? { cx: W - 3, cz: D + 3, n: 3 } : null;
  if (svanTower) holes.push({ x0: W - 6, x1: W + 0.01, z0: D - 0.01, z1: D + 6 });
  const inHole = p => holes.some(h => p.x > h.x0 && p.x < h.x1 && p.z > h.z0 && p.z < h.z1);
  if (flat && !lookout) flatRoof(b, K, C, cells, edges, top, F, SH, ladders[storeys - 1]);
  else if (roofKind === 'shed') shedRoof(b, K, wings[0], roofTop, r);
  else {
    const parts = [];
    for (const w of wings) {
      const others = wings.filter(o => o !== w);
      // a gable end is built unless it runs into a wing at least as wide (a narrower chancel or porch runs into it)
      const ends = [-1, 1].map(sg => { const [x, z] = toWorld(w, sg * (w.W + 0.5), 0, 0); return !others.some(o => inside(o, x, z) && o.D >= w.D); });
      const kind = roofKind === 'hip' && w.main && w.W >= w.D ? 'hip' : 'gable';
      const vent = w.main && !domeCfg ? ventAt : null;
      parts.push(...(kind === 'hip' ? hipPieces(K, w, roofTop, r, C.eaves, { kick: C.kick, vent }) : gablePieces(K, C, w, roofTop, r, ends, vent, dctx)));
    }
    if (dctx.profile.valleys !== false) valleys(parts, b);
    const caps = [];
    // an overhanging eave over a deck, gallery or walkway floor would hang into the heads of people on it
    const overDeck = p => p.eave && b.pieces.some(q => P.piece(q.name).role === 'floor' && !inside(p.wing, q.x, q.z, 0.1) &&
      Math.abs(q.x - p.x) < 1.6 && Math.abs(q.z - p.z) < 1.6 && q.y < p.y && q.y > p.y - 3.2);
    // the trim under an eave that comes out goes with it (eave motifs, lib/details.js bargeboards; an Ashlands beam left
    // under no roof over a gallery fell, home Ashlands Baltic s2 seed 4 and s3 seed 6)
    const gone = parts.filter(overDeck);
    const underGone = p => p.role === 'trim' && gone.some(e => Math.hypot(e.x - p.x, e.z - p.z) < 1.5 && p.y < e.y + 0.3 && p.y > e.y - 1.6);
    // where wings cross, keep the higher roof so the lower roof runs into the higher one
    const placed = new Set();
    for (const p of parts) {
      const key = `${p.name}|${Math.round(p.x * 100)}|${Math.round(p.y * 100)}|${Math.round(p.z * 100)}|${Math.round(p.yaw) % 360}`;
      if (placed.has(key)) continue; // two wings can lay the same piece where they meet
      placed.add(key);
      if (inHole(p) && p.role !== 'gable') continue;
      if (p.vent) { caps.push(p); continue; }
      // a stone gable course needs stone right under it, or it falls: over a timber bay or a plank wall it is planks
      if (p.role === 'gable' && p.name === K.stoneWall && !stoneUnder(b, p, /2x2/.test(K.stoneWall) ? 2 : 1)) {
        p.name = /2x2/.test(K.stoneWall) ? 'woodwall' : K.wallHalf;
        // where another wing's gable already fills the spot, nothing more is needed
        if (b.pieces.some(q => Math.abs(q.x - p.x) < 0.05 && Math.abs(q.z - p.z) < 0.05 && Math.abs(q.y - p.y) < 0.9 && P.piece(q.name).role === 'wall')) continue;
      }
      if (overDeck(p) || underGone(p)) continue;
      const hidden = wings.some(o => o !== p.wing && inside(o, p.x, p.z, -0.2) && p.surf < surfaceAt(o, p.x, p.z, roofTop, r) - 0.25);
      if (!hidden) b.put(p.name, p.x, p.y, p.z, p.yaw);
    }
    // a wall hearth's shaft: whatever roof stands over its column above the walls comes out too (the rake's cap over
    // an end hearth, the lowest row and the eave over a side one)
    const col = (hearth.spot === 'end' || hearth.spot === 'side') && flue ? flue : null;
    // (and the bargeboards along a rake that lose the roof they lay on)
    // (over an end hearth only the rake's ridge cap, raised with the others; over a side one the row, the eave, and the
    // bargeboards that lay on them)
    const over = (p, m) => (o => o.x0 < col.x1 - 0.05 + m && o.x1 > col.x0 + 0.05 - m && o.z0 < col.z1 - 0.05 + m && o.z1 > col.z0 + 0.05 - m && o.y1 > top - 0.3)(checksLib().catBox(p));
    const extra = !col ? [] : hearth.spot === 'end' ? takeOut(b, p => !p.decor && isCap(p) && over(p, 0))
      : takeOut(b, p => !p.decor && (['roof', 'roofTop', 'roofCorner'].includes(P.piece(p.name).role) ? over(p, 0)
        : P.piece(p.name).role === 'beam' && (p.trim || /_(26|45)$/.test(p.name)) && over(p, /_(26|45)$/.test(p.name) ? 1.2 : 0)));
    // the ridge caps over the fire's place stay out for smoke; the last pass puts them back if no fire is laid
    if (caps.length && hearth.spot === 'end') b.vents.push({ kind: 'ridge', caps: [...caps, ...extra], x: hearth.x, z: hearth.z, y: caps[0].y, rect: flue, from: F + HOOD, hood: true });
    else if (caps.length) b.vents.push({ kind: 'ridge', caps, x: avg(caps.map(c => c.x)), z: avg(caps.map(c => c.z)), y: caps[0].y,
      rect: rectOf(caps), from: storeys > 1 && !(loft && !loft.knee) ? F + SH : caps[0].y });
    if (hearth.spot === 'side') b.vents.push({ kind: 'slope', caps: extra, x: hearth.x, z: hearth.z, rect: flue, from: F + HOOD, hood: true,
      y: (ys => ys.length ? Math.max(...ys) : top + 1)(extra.filter(p => P.piece(p.name).role === 'roof').map(p => checksLib().catBox(p).y1)) });
  }

  // porch at the front door: one or three bays wide, on the grid, never on top of a wing
  // a low roof's eaves already run 2 m past the wall, so only steep roofs get a porch roof of their own
  const porchFits = !flat && roofKind !== 'shed' && !T.dock && !T.tower && !['U', 'cross', 'court', 'gables', 'greek'].includes(plan) && !deck && !podklet && form !== 'sunken' && r === 2 && (C.eaves || 1) < 2;
  if (req.porch === true && !porchFits) b.notes.push('No porch: this plan, roof or form has no front for one.');
  const porchOdds = () => MS && req.porch == null ? !!MS.extras.porch : R() < C.porch + (stage === 's1' ? -0.3 : 0.2) + (wings[0].W >= 6 ? 0.4 : 0);
  if (req.porch === true ? porchFits : req.porch !== false && !flat && roofKind !== 'shed' && !T.dock && !T.tower && C.porch && porchOdds() && porchFits && !dctx.profile.svalgang && !dctx.profile.gablePorch && !dctx.profile.dormerOverDoor && !loggia) {
    const h = (MS ? !M.fam.porchWide : R() < 0.5) ? 0 : 1, zf = doorZ;
    const bays = [];
    for (let k = -h; k <= h; k++) { const x = doorX + 2 * k; if (!cells.has(`${x},${zf - 1}`) && !cells.has(`${x},${zf - 3}`)) bays.push(x); }
    if (bays.length) {
      // posts 2.3 m tall, a beam on them, and a low roof from 2.5 m at the front up to 3.5 m at the wall
      const postAt = new Set();
      for (const x of bays) { b.put(K.floor, x, F, zf - 1); postAt.add(x - 1); postAt.add(x + 1); }
      const taken = new Set(verts.map(([vx, vz]) => `${vx},${vz}`));
      for (const x of postAt) {
        if (taken.has(`${x},${zf - 2}`)) continue; // a wing's corner post already stands here
        if (F > 0.01) posts(b, K, x, zf - 2, F);
        b.put(framePole(K, C), x, F + 1, zf - 2);
        b.put(K.pole1, x, F + 1.8, zf - 2);
      }
      for (const x of bays) { b.put(K.beam, x, F + 2.4, zf - 2, 0); b.put(K.roof26, x, F + 2.5, zf - 1, 180); }
    }
  }

  // a way up to a raised door: a landing and a stair from the ground (2 m up), a stair at the front of a deck, or a
  // stair set half in the ground in front of a door 1 m up
  const porchBuilt = b.pieces.some(p => p.name === K.floor && Math.abs(p.z - (doorZ - 1)) < 0.01 && Math.abs(p.x - doorX) < 0.01 && Math.abs(p.y - F) < 0.01);
  // a stone course is thick: the stair stops at its outer face
  // steps of stone up to a door on a stone footing (Black Forest on, once stone is built)
  if (stoneBase && K.stoneStair && !early && F >= 0.9 && !podklet) b.stairName = K.stoneStair;
  const lip = F >= 0.9 && stoneBase && !podklet && !C.stilts && !T.raised && !C.raised && form !== 'raised' && K.plinth ? P.piece(K.plinth).size[2] / 2 : 0;
  if (F >= 0.9 && door.out[1] < 0 && !T.dock) {
    if (deck && !C.boardwalk) {
      const zEdge = Math.min(...[...floorCells.values()].filter(([x]) => Math.abs(x - doorX) < 0.01).map(([, z]) => z)) - 1;
      stairUp(b, K, doorX, zEdge, F);
    } else if (!C.boardwalk) {
      if (F >= 1.99) {
        if (!porchBuilt) b.put(K.floor, doorX, F, doorZ - 1);
        for (const x of [doorX - 1, doorX + 1]) posts(b, K, x, doorZ - 2, F);
        stairUp(b, K, doorX, doorZ - 2, F);
      } else stairUp(b, K, doorX, porchBuilt ? doorZ - 2 : doorZ - lip, F);
    }
  }
  // the back door of a hall with doors on both long sides
  if (backDoor && F >= 0.9 && F <= 2.01 && !deck) for (let k = 0; k < Math.round(F); k++) b.put(K.stair || 'wood_stair', backDoor.x, F - (k + 1), backDoor.z + 1 + lip + 2 * k, 0);
  // a door in a gable end (sunken huts) on raised ground
  if (F >= 0.9 && F < 1.99 && door.out[0] !== 0) stairUpX(b, K, door.x, doorZ, F, door.out[0]);
  if (C.boardwalk && door.out[1] < 0 && !T.dock) {
    // the walkway starts past any deck in front of the door, so its stair is in the open
    const deckFront = deck ? Math.min(doorZ, ...[...floorCells.entries()].filter(([k, [x]]) => !cells.has(k) && Math.abs(x - doorX) < 2.9).map(([, [, z]]) => z - 1)) : doorZ;
    boardwalk(b, K, doorX, deckFront, Math.max(F, 0), { s1: 4, s2: 6, s3: 8 }[stage]);
    b.notes.push('Timber walkway out from the door; lay it over wet ground or water.');
  }

  // desert houses: a well in the yard of a U plan, a tall stone tower at a back corner of large ones
  if (cultureKey === 'middle-eastern' && !T.tower && plan !== 'court') {
    if (plan === 'U') {
      // pave the yard between the wings
      const zmin = wings[1].cz - wings[1].W;
      const pave = K.stoneFloor || K.floor;
      for (let x = -W + 1; x < W; x += 2) for (let z = zmin + 1; z < -D; z += 2)
        if (!cells.has(`${x},${z}`)) b.put(pave, x, 0, z);
      const yz = Math.round((zmin - D) / 2);
      if (-D - zmin >= 5.9) { // a well only where the yard leaves room in front of the door
        const well = new Build(); wellDesign(well, K, biome, 's1');
        const lift = thickFloor(pave) ? 0.5 : 0; // on top of the paving
        // out of the wings' walls: the barrel by the well goes where it would stand in a wall (a narrow yard put it
        // 0.57 m into the wing, 2026-11-10), the well where any of its own pieces would
        const Ck = checksLib(), walls = b.pieces.filter(q => ['wall', 'window', 'door', 'pole'].includes(P.piece(q.name).role)).map(q => Ck.aabb(q));
        const inWall = p => { const o = Ck.aabb({ ...p, y: p.y + lift, z: p.z + yz }); return walls.some(w => o.x0 < w.x1 - 0.02 && o.x1 > w.x0 + 0.02 && o.z0 < w.z1 - 0.02 && o.z1 > w.z0 + 0.02 && o.y0 < w.y1 && o.y1 > w.y0); };
        const keep = well.pieces.filter(p => !(p.name === 'piece_chest_barrel' && inWall(p)));
        if (!keep.some(inWall)) for (const p of keep) b.put(p.name, p.x, p.y + lift, p.z + yz, p.yaw);
      }
    }
    if ((stage === 's3' && type === 'home') || type === 'temple') {
      stoneTowerAt(b, K, W + 1, D - 1, top + 6, F);
      b.notes.push('Tall stone tower at a back corner, after the desert style.');
    }
  }
  if (plan === 'court') {
    const yard = Q - 2 * wingOpts.dW, pave = K.stoneFloor || K.floor;
    for (let x = -yard + 1; x < yard; x += 2) for (let z = -yard + 1; z < yard; z += 2) b.put(pave, x, 0, z);
    const well = new Build(); wellDesign(well, K, biome, 's1');
    const lift = thickFloor(pave) ? 0.5 : 0; // on top of the paving
    // the well only where it leaves a 0.9 m lane round it to the arcade (D-152: the yard is the way from one gallery
    // to the next; the 3 m well filled a home's 4 m yard to within 0.5 m of its edge, integration round 6)
    const wellHalf = Math.max(...well.pieces.filter(p => p.name !== 'piece_chest_barrel').map(p => Math.max(Math.abs(p.x), Math.abs(p.z)) + 0.5));
    // the barrel by the well only where the yard has room for it (a small yard's walls are a metre thick)
    if (yard - wellHalf >= 0.9) for (const p of well.pieces) if (!(p.name === 'piece_chest_barrel' && yard < 3.1)) b.put(p.name, p.x, p.y + lift, p.z, p.yaw);
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
    skirtRoof(b, K, edges, F + Math.min(3, SH - 1));
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
    towerAt(b, K, C, { cx: svanTower.cx, cz: svanTower.cz, n: 3, F, storeys: cornerTower ? storeys + 2 : stage === 's3' ? 5 : 4, SH: 3, door: 'right', use: 'guard',
      skip: (e, y0, sh) => e.out[1] < 0 && y0 + sh <= houseTop + 0.01 });
    b.notes.push(cornerTower ? 'A tower at a back corner of the hall.' : 'Tall square tower at a back corner of the house.');
  }

  // awnings over the front of each wing, never out over a yard
  // an awning over each outside door only (a row of them along the front stuck out too far, T-102)
  if (C.awnings) for (const e of [door, backDoor].filter(e => e && e.out[1] < 0)) b.put(K.roof26, e.x, F + SH - 0.5, e.z - 1, 180); // 2.5 m up at its edge
  if (T.dock) dockDesign(b, K, W, D, F, stage);
  // the field starts past the walkway and the stairs (each stair takes 2 m for every metre of height)
  const stairRun = F >= 0.9 ? 2 * Math.round(Math.min(F, 2)) : 0;
  if (T.field) fieldDesign(b, K, W, D + (C.boardwalk ? { s1: 4, s2: 6, s3: 8 }[stage] + Math.max(2, stairRun) : stairRun), biome, stage, R, doorX);
  if (T.pen) penDesign(b, K, Math.max(...[...cells.values()].map(c => c[0])) + 1, D, stage); // beside the last wing
  // carved heads on the gable ends, in pairs or none (lib/program.js ornament): each hung on what shows of its gable wall
  // under the ridge (lib/wallhang.js hang); on a ridge beam's end run out past the rake it sat 0.3 to 0.43 m off any
  // wall (track F's measure)
  if (roofKind === 'gable' && plan !== 'gables' && ((C.dragons && ['longhouse', 'temple', 'tavern'].includes(type)) || (C.carved && stage !== 's1'))) {
    const WH = typeof module !== 'undefined' ? require('./wallhang.js') : window.VHWallhang;
    const ridgeY = roofTop + r * (D - 1) / 2, ends = [];
    for (const sx of [-1, 1]) {
      if (hearth.spot === 'stack' && sx === hearth.sg) continue; // the stack stands there
      // (not over a lower annex in line at that end, whose roof meets the main gable below the ridge)
      if (wings.some(w => w.spec && w.spec.at === 'inline' && !w.spec.ext && w.spec.side === sx)) continue;
      // (the outermost gable wall on the ridge line at that end: an extension in line carries the main ridge further out)
      const gx = Math.max(-Infinity, ...b.pieces.filter(p => !p.decor && ['wall', 'gable'].includes(P.piece(p.name).role) && Math.abs(p.z) < 1.2 && p.y > ridgeY - 3 && p.y < ridgeY + 0.5 && sx * p.x > 0).map(p => sx * p.x));
      if (isFinite(gx)) ends.push({ sx, gx });
    }
    // (the pair at one height: the first under the ridge where both ends take one)
    let heads = [];
    const B = WH && ends.length === 2 ? WH.backingOf(b.pieces) : null;
    if (B) for (const dy of [1.4, 1.0, 1.8, 2.2, 0.6, 2.6]) {
      const got = ends.map(({ sx, gx }) => WH.hang('wood_dragon1', { x: sx * gx, z: 0, nx: sx, nz: 0, y: ridgeY - dy }, B, { pieces: b.pieces }));
      if (got.every(Boolean)) { heads = got; break; }
    }
    if (heads.length === 2) for (const h of heads) b.put(h.name, h.x, h.y, h.z, h.yaw, { trim: true, ...(h.wclip ? { wclip: h.wclip } : {}) });
  }

  b.outer = edges;
  // the gable end a stone stack may take (a stack hearth's, or the chimney stack on a hall or workshop with a middle fire,
  // below): the woodshed keeps off it (round 4: the woodshed took the one free end first on every home of 128 forced
  // to a middle fire)
  const stackEnd = hearth.spot === 'stack' ? hearth.sg : hearth.spot === 'middle' ? stackEndFor(wings, svanTower, {
    may: roofKind === 'gable' && plan !== 'gables' && !flat && !T.tower && F < 1.01 && !/stone|marble|grausten/.test(C.wallStyle || '') &&
      stoneOK && stage !== 's1' && ['longhouse', 'tavern', 'smithy', 'temple'].includes(type) }) : 0; // (a home's stack has its fire: midStack)
  if (stackEnd && hearth.spot === 'middle') info.stackEnd = stackEnd;
  if (['home', 'longhouse', 'smithy', 'workshop', 'sawmill', 'barn', 'farm'].includes(type) && stage !== 's1' && roofKind === 'gable' && !flat &&
    F < 0.01 && !T.tower && dctx.R() < 0.5) woodshed(b, K, C, wings, edges, F, SH, svanTower, stackEnd);
  // a lean-to (outshut) along the back: a lower roof against the main mass (bench: req.details.outshut)
  const wantOut = dctx.profile.outshut != null ? dctx.profile.outshut
    : ['home', 'longhouse', 'barn', 'smithy', 'workshop', 'storage', 'farm', 'tavern'].includes(type) && stage !== 's1' && dctx.R() < 0.4;
  if (wantOut && ['gable', 'hip'].includes(roofKind) && !flat && F < 1.01 && !T.tower && !C.stoneWalls) outshut(b, K, C, wings, edges, F, SH, dctx.R, decor);
  // a stone chimney stack against a gable end, from the ground to past the ridge (bench: req.details.stack)
  const wantStack = dctx.profile.stack != null ? dctx.profile.stack
    : stoneOK && stage !== 's1' && ['home', 'longhouse', 'tavern', 'smithy', 'temple'].includes(type) && dctx.R() < 0.6
    // the stack on a middle-fire home is part of its stone hearth (D-131: wood at s1, stone from s2 in the Meadows and
    // later biomes); drawn from a stream of its own so the rest of the house comes out as before
    || (!stoneOK && hearthStoneOK && type === 'home' && rng((lineage * 4099 + strHash(cultureKey) * 13 + 0x57ac) >>> 0)() < 0.6);
  // (a home with a wall hearth has its chimney already: the stack it was rebuilt with, or the hood's shaft)
  const stackFails = hearth.spot === 'stack' && !hearthStack(b, KH, C, w0, hearth, { F, SH, storeys, top: roofTop, notes: b.notes });
  // a stack that cannot stand there leaves an end hearth at the same gable before the middle: a hood over the fire and
  // its shaft up to raised ridge caps
  const endFlue = stackFails ? endFallback(b, hearth, w0, { F, SH, storeys, top }) : null;
  if (endFlue) {
    hearth.spot = 'end'; info.hearth = 'end'; info.hearthWhy = 'stack blocked';
    ventAt = { x: hearth.x, z: hearth.z }; flue = endFlue; dctx.flue = endFlue; dctx.fireKeep = endFlue;
  }
  if (stackFails && !endFlue) {
    // something stands outside that gable (a deck, a lean-to) and the ridge has no cap over the fire's place for an end
    // hearth: the fire goes to the middle, under ridge caps taken out over it, clear of the climbs
    hearth.spot = 'middle'; info.hearth = 'middle'; info.hearthWhy = 'stack blocked';
    const at = { x: Math.max(w0.cx - w0.W + 1, Math.min(w0.cx + w0.W - 1, doorX)), z: w0.cz }, fr = flueRect(w0, at, w0.W - 1);
    const climbs = ladders.flatMap(l => [l.hole, l.land, l.stand, ...(l.run || [])].filter(Boolean));
    if (fr && !climbs.some(c => inRect(fr, c[0], c[1], -0.1))) {
      const caps = takeOut(b, p => !p.decor && isCap(p) && inRect(fr, p.x, p.z) && p.y > top - 0.3);
      if (caps.length) b.vents.push({ kind: 'ridge', caps, x: avg(caps.map(c => c.x)), z: avg(caps.map(c => c.z)), y: caps[0].y, rect: rectOf(caps), from: storeys > 1 && !(loft && !loft.knee) ? F + SH : caps[0].y });
    }
  }
  if (wantStack && type !== 'home' && hearth.spot === 'middle' && roofKind === 'gable' && plan !== 'gables' && !flat && !T.tower && F < 1.01 && !/stone|marble|grausten/.test(C.wallStyle || '')) chimneyStack(b, stoneOK ? K : KH, wings, edges, dctx.profile, dctx.R, { C, SH, F, storeys, hearthStone: !stoneOK, info });
  // a balcony on a gable end, from the upper room (coverage audit: on 46 % of the best-liked builds; bench: req.details.balcony)
  const wantBalc = dctx.profile.balcony != null ? dctx.profile.balcony
    : stage !== 's1' && storeys >= 2 && ['home', 'tavern', 'longhouse', 'workshop'].includes(type) && dctx.R() < 0.5;
  if (wantBalc && !b.gallery && roofKind === 'gable' && plan !== 'gables' && !flat && !T.tower && !loggia) balcony(b, K, C, wings[0], edges, { F, SH, ladders, cells, hearthSg: ['end', 'stack'].includes(hearth.spot) || (hearth.spot === 'side' && hearth.corner) ? hearth.sg : flueEnd(hearth, flue, w0) });
  // a stone front on the wall hearth from s2 (D-131), drawn from a stream of its own (lineage and culture) so the rest of
  // the house comes out as before
  if (['end', 'side'].includes(hearth.spot) && type === 'home' && hearthStoneOK && plan !== 'gables' && !req.skipDecor) {
    const FR = rng((lineage * 7919 + strHash(cultureKey) * 17 + strHash(biome) * 5 + 0x3f7) >>> 0);
    const want = FR() < (/grausten/.test(KH.stoneBlock || '') ? FRONT_SHARE_GRAUSTEN : FRONT_SHARE); // (bench: req.details.hearthFront true or false)
    if ((req.details && req.details.hearthFront != null ? req.details.hearthFront : want) && hearthFront(b, KH, hearth, { F, SH, storeys, R: FR, why: info })) info.hearthFront = true;
  }
  Details.exterior(b, dctx);
  clearDoorways(b);
  // the fire's place for the decorator: under the ridge vent, or a cell of a flat roof (a chimney goes up from it),
  // clear of the ladders
  let fireAt = ventAt && lit && flue ? { x: avg(rectXs(flue)), z: avg(rectZs(flue)) } : null;
  if (hearth.spot === 'side' || hearth.spot === 'stack') fireAt = { x: hearth.x, z: hearth.z }; // a stack's fire moves into its alcove after the furnishing
  if (flatCell) { fireAt = { x: flatCell[0], z: flatCell[1] }; b.vents.push({ kind: 'flat', x: flatCell[0], z: flatCell[1], rect: flue, from: storeys > 1 ? F + SH : top }); }
  // posts where the game would let the roof fall, clear of the fire
  propUp(b, K, biome, { raisedOk: true, keepOut: (x, z) => fireAt && Math.hypot(x - fireAt.x, z - fireAt.z) < 2.2 });
  if (!req.skipDecor) Decor.decorate(b, { use: T.use, decor, biome, type, R, culture: cultureKey, doorX: b.doorX, fireAt, persona: household, layout: layoutCtx });
  settle(b, { K, C, biome, use: T.use, type, stoneOK, F, SH, storeys, top, flat, cells, wing: w0, roofTop, skipDecor: !!req.skipDecor });
  if (!req.skipDecor) tidyFurniture(b);
  if (!req.skipDecor && hearthStoneOK && F < 0.01 && !C.stoneWalls) hearthstone(b, KH);
  if (!req.skipDecor) { const zones = keepClear(b); Details.interior(b, { ...dctx, zones }); Kitbash.apply(b, { ...dctx, decor, layout: layoutCtx }, zones); doorLights(b, { biome, decor, F }); }
  else Details.commitMotifs(b, dctx); // bare builds (ranked before furnishing) carry the same wall trim
  outside(b, req, { K, C, type, stage, biome, cultureKey, decor, seed, household });
  return finish(b, info);
}

// What goes round a finished building outside: a yard round stage 2 and 3 homes and farms (lib/yards.js, D-060), then
// its greenery (lib/landscape.js, D-143).
function outside(b, req, o) {
  const { K, C, type, stage, biome, cultureKey, decor, seed, household } = o;
  if (Yards.wants(req, type, stage)) Yards.add(b, { K, C, type, stage, biome, cultureKey, decor: req.skipDecor ? 'd1' : decor, seed, opts: req.yard, details: req.details, persona: household });
  if (Landscape.wants(req)) Landscape.add(b, { K, C, type, stage, biome, cultureKey, decor, seed, persona: household, opts: req.landscape });
}

// The gable end a middle fire's chimney stands near (within 2.5 m of the gable), or null: the balcony keeps to the other
// end (a fire in line with the door of a short wing put the plank chimney across the balcony's door).
function flueEnd(hearth, flue, w0) {
  if (hearth.spot !== 'middle' || !flue || !w0) return null;
  return [-1, 1].find(sg => Math.abs(w0.cx + sg * w0.W - (sg > 0 ? flue.x1 : flue.x0)) < 2.5) || null;
}

// A balcony on a gable end: the upper storey's middle bay becomes a door onto a 2 m square floor with a hand rail on
// corner posts. Under a 3 m storey it stands on 26 degree brackets from the wall; under a 2 m storey on posts
// from the ground. Gable ends keep their rake overhang well above it; long walls are left alone (the eaves come down
// to about a metre over a balcony there).
function balcony(b, K, C, w, edges, o) {
  if (!w || w.alpha !== 0) return false;
  const { F, SH, ladders, cells } = o, yU = F + SH, Ck = checksLib();
  const L = ladders || [];
  const busyCell = (x, z) => !cells.has(`${x},${z}`) || L.some(l => [l.hole, l.land, l.stand, ...(l.run || [])].some(c => c && c[0] === x && c[1] === z));
  const ends = edges.filter(e => e.yaw === 90 && Math.abs(Math.abs(e.x - w.cx) - w.W) < 0.01 && Math.abs(e.z - w.cz) < w.D)
    .sort((a, c) => Math.abs(a.z - w.cz) - Math.abs(c.z - w.cz) || a.x - c.x);
  // two floor pieces out from the wall and two along it (Tyler, showcase review 2026-11-11: the lookout balcony "is far
  // too narrow at only 1 wood_floor piece wide"), on posts from the ground at its outer corners and middle, a beam
  // under every edge, a rail of posts and a beam at 1 m round its three open sides
  for (const e of ends) {
    const sg = e.out[0], x0 = e.x, z = e.z;
    if (o.hearthSg === sg) continue; // the hearth's hood or stack is at that end
    if (busyCell(x0 - sg, z)) continue;
    // the second piece along the wall on whichever side the gable has room (the wall runs on past it)
    const sz = [1, -1].find(d => Math.abs(z + 2 * d - w.cz) < w.D - 0.5);
    if (sz == null) continue;
    const zA = Math.min(z, z + 2 * sz) - 1, zB = Math.max(z, z + 2 * sz) + 1;
    // nothing out there already: a stack, a woodshed, a porch
    const box = { x0: Math.min(x0 + sg * 0.2, x0 + sg * 4.4), x1: Math.max(x0 + sg * 0.2, x0 + sg * 4.4), z0: zA - 0.4, z1: zB + 0.4 };
    if (b.pieces.some(p => { if (Math.abs(p.x - x0) < 0.35) return false; const a = Ck.aabb(p); return a.x0 < box.x1 && a.x1 > box.x0 && a.z0 < box.z1 && a.z1 > box.z0 && a.y0 < yU + 2.1; })) continue;
    // the upper bay: wall and window out, a door in
    const inBay = p => Math.abs(p.z - z) < 1.01 && Math.abs(p.x - x0) < 0.3 && p.y > yU + 0.05 && p.y < yU + SH - 0.05 &&
      ['wall', 'window', 'door', 'beam'].includes(P.piece(p.name).role) && !p.decor;
    b.pieces = b.pieces.filter(p => !inBay(p));
    b.openings = (b.openings || []).filter(op => !(op.e.x === x0 && op.e.z === z && Math.abs(op.y0 - yU) < 0.01));
    wallSegment(b, K, C, x0, yU, z, e.yaw, SH, 'door', null);
    b.openings.push({ e, y0: yU, SH, storey: 1, kind: 'door', balcony: true });
    const T = { trim: true }, pole = framePole(K, C), pole1 = K.pole1 || 'wood_pole', beam = K.beam || 'wood_beam';
    const xo = x0 + sg * 4;
    for (const dx of [1, 3]) for (const zc of [z, z + 2 * sz]) b.put(K.floor, x0 + sg * dx, yU, zc, 0, T);
    // posts from the ground under the outer edge and the middle of the sides
    for (const [px, pz] of [[xo, zA], [xo, zB], [xo, (zA + zB) / 2], [x0 + sg * 2, zA], [x0 + sg * 2, zB]])
      for (let y = 0; y < yU - 0.01;) { const h = yU - y >= 2 ? 2 : 1; b.put(h === 2 ? pole : pole1, px, y + h / 2, pz, 0, T); y += h; }
    // beams under the outer edge and the sides
    for (const zc of [z, z + 2 * sz]) b.put(beam, xo, yU - 0.15, zc, 90, T);
    for (const dx of [1, 3]) for (const zc of [zA, zB]) b.put(beam, x0 + sg * dx, yU - 0.15, zc, 0, T);
    // the rail: posts at every 2 m, one beam on them at 1 m (two rows read as a crate stuck to the wall, r5 review)
    for (const [px, pz] of [[xo, zA], [xo, zB], [xo, (zA + zB) / 2], [x0 + sg * 2, zA], [x0 + sg * 2, zB]]) b.put(pole1, px, yU + 0.5, pz, 0, T);
    for (const zc of [z, z + 2 * sz]) b.put(beam, xo, yU + 1.05, zc, 90, T);
    for (const dx of [1, 3]) for (const zc of [zA, zB]) b.put(beam, x0 + sg * dx, yU + 1.05, zc, 0, T);
    b.balcony = true;
    b.notes.push('A balcony on a gable end, with a door from the upper room.');
    return true;
  }
  return false;
}

// A door torch against what shows of the wall at its height (lib/wallhang.js: a log wall shows 5 cm past its collider,
// and a torch at the collider's face stood 4 cm off it, showcase 05), or none when the wall does not take it there.
function doorTorchOnWall(b, q, e, ox, oz, half) {
  const WH = typeof module !== 'undefined' ? require('./wallhang.js') : window.VHWallhang;
  if (!WH) return q;
  const t = (q.x - e.x) * (1 - Math.abs(ox)) + (q.z - e.z) * (1 - Math.abs(oz));
  const r = WH.hang(q.name, { x: e.x + ox * half + (1 - Math.abs(ox)) * t, z: e.z + oz * half + (1 - Math.abs(oz)) * t, nx: ox, nz: oz, y: q.y }, WH.backingOf(b.pieces), { pieces: b.pieces });
  return r ? { ...q, x: r.x, z: r.z, yaw: r.yaw, wclip: r.wclip } : null;
}

// Lights by the doors (coverage audit 2026-11-09: wall torches by the door on 47 % of the best-liked builds, 5 % of
// ours). From d2 the front door gets a wall torch on each side on the outside face, from d3 the back door too; where
// the biome has no wall torch yet (Meadows) a standing torch beside a door at ground level. A side that would touch
// trim, a window or a post is left bare; one light alone is fine.
function doorLights(b, o) {
  if (o.decor === 'd1') return 0;
  const Ck = checksLib();
  const name = reaches(o.biome, 'Black Forest') ? 'piece_walltorch' : null, ground = !name && o.F < 0.01 ? 'piece_groundtorch_wood' : null;
  if (!name && !ground) return 0;
  let n = 0;
  const doors = (b.openings || []).filter(op => op.storey === 0 && op.kind !== 'window' && (!op.back || o.decor === 'd3'));
  for (const op of doors) {
    const e = op.e, ox = e.out[0], oz = e.out[1], ux = e.yaw === 0 ? 1 : 0, uz = 1 - ux;
    const wall = b.pieces.find(p => !p.decor && P.piece(p.name).role === 'wall' && Math.abs(p.x - e.x) < 0.3 && Math.abs(p.z - e.z) < 0.3 && p.y > op.y0 && p.y < op.y0 + op.SH + 0.5)
      || b.pieces.find(p => !p.decor && P.piece(p.name).role === 'door' && Math.abs(p.x - e.x) < 0.3 && Math.abs(p.z - e.z) < 0.3);
    if (!wall) continue;
    const wo = Ck.aabb(wall), half = e.yaw === 0 ? (wo.z1 - wo.z0) / 2 : (wo.x1 - wo.x0) / 2;
    const dw = op.kind === 'gate' ? 1.45 : 1.15;
    for (const sg of [-1, 1]) {
      // the bay beside the door holds the light: not when it is a window, another door or a gate
      const nx = e.x + ux * sg * 2, nz = e.z + uz * sg * 2;
      if ((b.openings || []).some(q => q.storey === 0 && Math.abs(q.e.x - nx) < 0.3 && Math.abs(q.e.z - nz) < 0.3)) continue;
      if (name && !b.pieces.some(p => !p.decor && P.piece(p.name).role === 'wall' && Math.abs(p.x - nx) < 0.3 && Math.abs(p.z - nz) < 0.3 && p.y > op.y0 && p.y < op.y0 + 2.5)) continue; // a wall there to hang on
      let put = null;
      for (const t of [dw, dw + 0.2, dw - 0.15]) {
        const yaw = (Math.atan2(ox, oz) * 180 / Math.PI + 270 + 360) % 360;
        const q = name
          ? { name, x: +(e.x + ox * (half + 0.28) + ux * sg * t).toFixed(3), y: +(op.y0 + 1.55).toFixed(3), z: +(e.z + oz * (half + 0.28) + uz * sg * t).toFixed(3), yaw }
          : { name: ground, x: +(e.x + ox * (half + 0.6) + ux * sg * (t + 0.2)).toFixed(3), y: 0.653, z: +(e.z + oz * (half + 0.6) + uz * sg * (t + 0.2)).toFixed(3), yaw: 0 };
        if (!name) { // a standing torch stands on the doorstep or floor under it (lib/wallhang.js settle), else on the
          // ground, its pivot 0.653 m over its foot (data/piece-models.json; at 0.75 it stood 10 cm over the ground)
          const WH = typeof module !== 'undefined' ? require('./wallhang.js') : window.VHWallhang;
          const yy = WH && WH.settle({ ...q, y: 1.2 }, b.pieces, 1.2);
          if (yy != null && yy > 0.653) q.y = yy;
        }
        const qb = Ck.aabb(q), m = 0.04;
        const hit = b.pieces.some(p => {
          const r = P.piece(p.name).role;
          if (r === 'floor' || r === 'rug') return false;
          if (name && Math.abs((p.x - e.x) * ox + (p.z - e.z) * oz) < half + 0.05 && r !== 'door') return false; // the wall it hangs on
          const pb = Ck.aabb(p);
          return pb.x0 < qb.x1 - m && pb.x1 > qb.x0 + m && pb.z0 < qb.z1 - m && pb.z1 > qb.z0 + m && pb.y0 < qb.y1 - m && pb.y1 > qb.y0 + m;
        });
        // a wall torch needs wall behind it
        const back = !name || b.pieces.some(p => { if (p.decor) return false; const r = P.piece(p.name).role; if (!['wall', 'pole', 'beam'].includes(r)) return false; const pb = Ck.aabb(p);
          const bx = q.x - ox * 0.35, bz = q.z - oz * 0.35; return bx > pb.x0 - 0.02 && bx < pb.x1 + 0.02 && bz > pb.z0 - 0.02 && bz < pb.z1 + 0.02 && q.y > pb.y0 && q.y < pb.y1; });
        if (!hit && back) { put = q; break; }
      }
      if (put && name) put = doorTorchOnWall(b, put, e, ox, oz, half);
      if (put) { b.put(put.name, put.x, put.y, put.z, put.yaw, { decor: true, ds: op.back ? 3 : 2, ...(put.wclip ? { wclip: put.wclip } : {}) }); n++; }
    }
  }
  if (n) b.notes.push(`${n} lights by the doors.`);
  return n;
}

// Before furnishing: roof, eave and beam pieces in a doorway or in the 2.3 m a person needs in front of and behind it
// come out (an eave cut back over the door, the way thatch is cut over a door).
function clearDoorways(b) {
  const Ck = checksLib();
  for (let round = 0; round < 2; round++) {
    const boxes = b.pieces.map(Ck.aabb), near = Ck.index(boxes), drop = new Set();
    b.pieces.forEach((p, i) => {
      if (boxes[i].info.role !== 'door') return;
      for (const j of Ck.doorBlockers(P.doorOpening(p), b.pieces, boxes, near, k => k === i)) {
        const role = boxes[j].info.role;
        if (['roof', 'roofTop', 'roofCorner'].includes(role) || (role === 'beam' && boxes[j].info.shape === 'box')) drop.add(j);
      }
    });
    if (!drop.size) break;
    b.pieces = b.pieces.filter((p, i) => !drop.has(i));
    if (round === 0) b.notes.push('Eaves cut back over the door.');
  }
}

// Boxes [x0, x1, y0, y1, z0, z1] that furniture must stay out of: doorways and the metre either side, ladders with
// their feet and landings, chimneys.
function keepClear(b) {
  const zones = [];
  for (const p of b.pieces) {
    const info = P.piece(p.name);
    if (info.role === 'door') {
      const o = P.doorOpening(p), ex = Math.abs(o.ux) * 0.9 + Math.abs(o.nx) * 1.2, ez = Math.abs(o.uz) * 0.9 + Math.abs(o.nz) * 1.2;
      zones.push({ x0: o.x - ex, x1: o.x + ex, y0: o.y - 0.2, y1: o.y + 2.3, z0: o.z - ez, z1: o.z + ez });
    }
    const c = info.role === 'stair' && P.climbSpec(p.name);
    if (c) {
      const a = (p.yaw || 0) * Math.PI / 180, dx = -Math.sin(a), dz = -Math.cos(a);
      // the piece itself and a metre and a half before its foot, a metre wide either side of its line
      const xs = [p.x - dx * 2.5, p.x + dx * 1.2], zs = [p.z - dz * 2.5, p.z + dz * 1.2];
      zones.push({ x0: Math.min(...xs) - (dx ? 0 : 0.8), x1: Math.max(...xs) + (dx ? 0 : 0.8), y0: p.y + c.bottom - 0.1, y1: p.y + c.bottom + c.rise + 1.9,
        z0: Math.min(...zs) - (dz ? 0 : 0.8), z1: Math.max(...zs) + (dz ? 0 : 0.8) });
    }
  }
  for (const room of b.rooms) for (const k of room.keep || []) zones.push({ x0: k.x0, x1: k.x1, y0: room.y - 0.1, y1: room.y + 2.3, z0: k.z0, z1: k.z1 });
  for (const v of b.vents) if (v.rect) zones.push({ x0: v.rect.x0, x1: v.rect.x1, y0: -1, y1: 999, z0: v.rect.z0, z1: v.rect.z1, flue: true });
  return zones;
}
const hits = (bx, z) => bx.x0 < z.x1 && bx.x1 > z.x0 && bx.y0 < z.y1 && bx.y1 > z.y0 && bx.z0 < z.z1 && bx.z1 > z.z0;

// After furnishing: furnishing the biome cannot make comes out; the fire goes under the smoke hole, with a chimney
// over it where the culture builds one (or the ridge closed again when no fire was laid); ceiling braziers hang from
// the ceiling in the middle of their room; woodpiles go outside; nothing stays in a doorway, on a ladder or in a
// chimney.
function settle(b, ctx) {
  const Ck = checksLib(), ord = P.BIOME_ORDER, limit = ord.indexOf(ctx.biome);
  // decor goes in any biome; building pieces the biome and the next (D-065, D-126: lib/pieces.js decorOk, the one rule)
  b.pieces = b.pieces.filter(p => !p.decor || P.decorOk(p.name, ctx.biome));

  const isFire = p => p.decor && /^(fire_pit|hearth)$/.test(p.name);
  const ground = b.rooms.filter(r => !r.upper);
  const mainRoom = ground.find(r => r.main) || ground[0];
  let fire = b.pieces.find(p => isFire(p) && mainRoom && Math.abs(p.y - mainRoom.y - 0.1) < 0.6);
  const ridge = b.vents.find(v => v.kind === 'ridge'), crown = b.vents.find(v => v.kind === 'crown');
  const laysFire = ['home', 'hall'].includes(ctx.use);
  const flatVent = b.vents.find(v => v.kind === 'flat');
  // a wall hearth's vents: a shaft out through the roof's lowest row, or the stone stack the hearth stands in
  const slope = b.vents.find(v => v.kind === 'slope'), stack = b.vents.find(v => v.kind === 'stack');
  if (!fire && laysFire && !ctx.skipDecor && mainRoom && (ridge || crown || flatVent || slope || stack)) {
    // the decorator found no room for the fire: lay it in the fire's place anyway
    const name = ctx.use === 'hall' && ord.indexOf('Black Forest') <= limit ? 'hearth' : 'fire_pit';
    const v = ridge || crown || flatVent || slope || stack;
    b.pieces.push({ name, x: v.x, y: mainRoom.y + 0.1, z: v.z, q: quat(0), yaw: 0, decor: true });
    fire = b.pieces[b.pieces.length - 1];
  }
  const target = ridge || crown || flatVent || slope || stack;
  if (flatVent && !fire) flatVent.rect = null; // no fire, no chimney
  if (fire && target) {
    // a hearth is 3 m across: in a small room, and against a wall, a fire pit takes its place
    // (under a hood the hearth stays: the fit test below falls back to a fire pit where it finds no room; the corpus
    // lays a hearth in 74 % of buildings with a fire, a fire pit in 36 %)
    if (fire.name === 'hearth' && mainRoom && ((mainRoom.x1 - mainRoom.x0) * (mainRoom.z1 - mainRoom.z0) < 40 || target === stack)) fire.name = 'fire_pit';
    const dx = target.x - fire.x, dz = target.z - fire.z, ox = fire.x, oz = fire.z;
    const moving = b.pieces.filter(p => p.decor && (p === fire || (/cookingstation|piece_cauldron/.test(p.name) && Math.hypot(p.x - ox, p.z - oz) < 0.4)));
    for (const p of moving) { p.x = +(p.x + dx).toFixed(3); p.z = +(p.z + dz).toFixed(3); }
    // whatever now stands where the fire went comes out
    const fb = Ck.aabb(fire), pad = 0.4;
    b.pieces = b.pieces.filter(p => {
      if (!p.decor || p === fire || /cookingstation|piece_cauldron/.test(p.name)) return true;
      const o = Ck.aabb(p);
      return !(o.x0 < fb.x1 + pad && o.x1 > fb.x0 - pad && o.z0 < fb.z1 + pad && o.z1 > fb.z0 - pad && Math.abs(p.y - fire.y) < 1);
    });
    // a fire that now reaches into a thick wall (a 1 m stone wall beside the vent cell) slides away from it, up to
    // 0.75 m toward the room's middle; a hearth (4 x 3 m in the game) that still does not fit becomes a fire pit
    const walls = b.pieces.filter(p => !p.decor && ['wall', 'pole', 'stair'].includes(P.piece(p.name).role)).map(p => Ck.aabb(p));
    const clear0 = keepClear(b).filter(z => !(fire.x > z.x0 && fire.x < z.x1 && fire.z > z.z0 && fire.z < z.z1)); // doorways and climbs, not the zone it is in already
    // (the pot or spit on the fire moves with it, and an iron spit is wider than the fire pit: it must clear the walls too)
    const pots = b.pieces.filter(p => p.decor && p !== fire && /cookingstation|piece_cauldron/.test(p.name) && Math.hypot(p.x - fire.x, p.z - fire.z) < 0.4);
    const inWall = o => walls.some(w => w.x0 < o.x1 - 0.05 && w.x1 > o.x0 + 0.05 && w.z0 < o.z1 - 0.05 && w.z1 > o.z0 + 0.05 && w.y0 < o.y1 && w.y1 > o.y0 + 0.05);
    // (the pot clears the doorways and climbs as the fire does: an iron spit 3.6 m long reached the foot of a ladder,
    // tavern Plains s1d1 seed 155)
    const inClear = o => clear0.some(z => hits({ ...o, x0: o.x0 + 0.15, x1: o.x1 - 0.15, z0: o.z0 + 0.15, z1: o.z1 - 0.15 }, z));
    const clips = () => { const o = Ck.aabb(fire); return inWall(o) || pots.some(p => { const q = Ck.aabb({ ...p, x: fire.x, z: fire.z }); return inWall(q) || inClear(q); }) || inClear(o); };
    if (clips()) {
      const rm = mainRoom || { x0: fire.x - 1, x1: fire.x + 1, z0: fire.z - 1, z1: fire.z + 1 };
      const cx = (rm.x0 + rm.x1) / 2, cz = (rm.z0 + rm.z1) / 2, L = Math.hypot(cx - fire.x, cz - fire.z) || 1;
      const x0 = fire.x, z0 = fire.z, sit = b.pieces.filter(p => p.decor && p !== fire && /cookingstation|piece_cauldron/.test(p.name) && Math.hypot(p.x - x0, p.z - z0) < 0.4);
      for (const nm of fire.name === 'hearth' ? ['hearth', 'fire_pit'] : [fire.name]) {
        fire.name = nm;
        let ok = false;
        // the smallest slide that clears every wall, toward the room's middle first
        const tries = [[0, 0]];
        for (const t of [0.25, 0.5, 0.75, 1]) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) tries.push([dx * t, dz * t]);
        tries.sort((p1, p2) => Math.hypot(...p1) - Math.hypot(...p2) || ((p2[0] * (cx - x0) + p2[1] * (cz - z0)) - (p1[0] * (cx - x0) + p1[1] * (cz - z0))));
        const slide = () => {
          for (const [dx, dz] of tries) {
            fire.x = +(x0 + dx).toFixed(3); fire.z = +(z0 + dz).toFixed(3);
            if (!clips()) return true;
          }
          return false;
        };
        ok = slide();
        // a long iron spit by a wall turns along the other wall, or a short wooden spit takes its place, or the fire
        // stays bare
        if (!ok && pots.length) {
          for (const p of pots) { p.yaw = ((p.yaw || 0) + 90) % 360; p.q = quat(p.yaw); }
          ok = slide();
          if (!ok && pots.some(p => p.name === 'piece_cookingstation_iron')) {
            for (const p of pots) if (p.name === 'piece_cookingstation_iron') { p.name = 'piece_cookingstation'; p.yaw = ((p.yaw || 0) + 270) % 360; p.q = quat(p.yaw); }
            ok = slide();
          }
          if (!ok) {
            const gone = new Set(pots);
            b.pieces = b.pieces.filter(p => !gone.has(p));
            pots.length = 0;
            ok = slide();
          }
        }
        if (!ok) { fire.x = x0; fire.z = z0; }
        if (ok) break;
      }
      void L;
      for (const p of sit) { p.x = fire.x; p.z = fire.z; }
    }
    // one pot or spit on the fire (a set laid round the fire may have brought a second)
    const onIt = b.pieces.filter(p => p.decor && /cookingstation|piece_cauldron/.test(p.name) && Math.hypot(p.x - fire.x, p.z - fire.z) < 0.4);
    if (onIt.length > 1) { const keep = onIt.find(p => p.name === 'piece_cauldron') || onIt[0]; b.pieces = b.pieces.filter(p => !onIt.includes(p) || p === keep); }
    // the cauldron's upgrades work within 5 m of it: those left farther away by the move come out
    const pot = b.pieces.find(p => p.decor && p.name === 'piece_cauldron');
    b.pieces = b.pieces.filter(p => !/^cauldron_ext/.test(p.name) || (pot && Math.hypot(p.x - pot.x, p.z - pot.z) < 5));
    if (target.kind === 'crown') b.notes.push('Fire under the open crown of the roof.');
    else if (target !== stack) chimney(b, ctx, target);
  }
  for (const v of [ridge, slope]) if (v && !(fire && target === v)) {
    for (const c of v.caps) b.put(c.name, c.x, c.y, c.z, c.yaw); // no fire: the roof is closed again
    v.rect = null;
  }

  hangBraziers(b, ctx, fire);
  woodpilesOutside(b);

  // the same furnishing twice in one spot once only
  const seen = new Set();
  b.pieces = b.pieces.filter(p => {
    if (!p.decor) return true;
    const k = `${p.name}|${p.x.toFixed(1)}|${p.y.toFixed(1)}|${p.z.toFixed(1)}|${Math.round(p.yaw || 0)}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });

  // nothing in a doorway, on a ladder or its foot, or in a chimney; a rug lies flat, so it stays in a doorway or at a
  // ladder's foot (checks.js doors and ladders pass over rugs, the decorator lays them there, and corpus rugs lie a
  // median 3.45 m from a door: data/interior.json rug_deer) and comes out of a chimney only
  const zones = keepClear(b), gone = [];
  b.pieces = b.pieces.filter(p => {
    if (!p.decor || p === fire || /cookingstation|piece_cauldron/.test(p.name) && fire && Math.hypot(p.x - fire.x, p.z - fire.z) < 0.4) return true;
    const bx = Ck.aabb(p), rug = P.piece(p.name).role === 'rug';
    if (!zones.some(z => (!rug || z.flue) && hits(bx, z))) return true;
    gone.push(bx); return false;
  });
  // and whatever stood on a table or bench that came out
  if (gone.length) b.pieces = b.pieces.filter(p => {
    if (!p.decor) return true;
    const bx = Ck.aabb(p);
    return !gone.some(g => bx.y0 >= g.y0 + 0.3 && bx.y0 <= g.y1 + 0.2 && p.x > g.x0 && p.x < g.x1 && p.z > g.z0 && p.z < g.z1);
  });
  // a bed last, after the clearing above, so a bed that stood in a doorway or a climb is replaced and not lost
  if (!ctx.skipDecor && ['home', 'longhouse'].includes(ctx.type)) bedIfNone(b, ctx, fire, zones);
}

// A chimney over the fire: through any floor above it and out of the roof, of stone where the culture may build in
// stone, else a box of planks with a raised cap on short posts (a smoke louver).
function chimney(b, ctx, v) {
  const { K, stoneOK } = ctx, r = v.rect;
  // always planks: a stone stack would stand on the wooden roof or upper floor, and Valheim's stone takes no support
  // from wood, so it would fall (T-102)
  const stone = false;
  void stoneOK;
  const piece = stone ? K.stoneWall : K.wallHalf, course = stone && /2x2/.test(K.stoneWall) ? 2 : 1;
  const yRoof = v.kind === 'ridge' || v.kind === 'slope' ? v.y : ctx.top; // the ridge, the top of the roof row taken out, or the flat roof
  // under a ridge with no floor to pass through, a smoke louver: the ridge caps raised 0.6 m on short posts over the
  // opening, open at the sides (the Norse ljore), in place of a plank box standing on the ridge
  const louver = v.kind === 'ridge' && v.from >= yRoof - 0.01;
  // a shaft up through an upper floor stops at the ridge inside the roof; above it the same raised caps as a louver
  // (a plank box standing a metre over the ridge read as a doghouse on the roof, 2026-11-09 review)
  const yTop = louver || v.kind === 'ridge' ? yRoof + 0.1 : yRoof + (stone ? 2 : 1);
  // floors above the fire inside the chimney's footprint come out (the upper floors and a flat roof)
  b.pieces = b.pieces.filter(p => !(P.piece(p.name).role === 'floor' && !p.decor && p.y > ctx.F + 0.5 && inRect(r, p.x, p.z)));
  const sides = [];
  for (let x = r.x0 + 1; x < r.x1; x += 2) { sides.push([x, r.z0, 0]); sides.push([x, r.z1, 0]); }
  for (let z = r.z0 + 1; z < r.z1; z += 2) { sides.push([r.x0, z, 90]); sides.push([r.x1, z, 90]); }
  const yBox = v.kind === 'ridge' ? yRoof - 0.9 : yTop; // the shaft's sides end under the ridge, inside the roof
  // (a side where a wall already stands, a tower's stone beside a flat-roof chimney, is that wall)
  const walled = (x, z, y) => b.pieces.some(p => !p.decor && P.piece(p.name).role === 'wall' && Math.abs(p.x - x) < 0.3 && Math.abs(p.z - z) < 0.3 && Math.abs(p.y - y) < 0.9);
  const openSides = sides.filter(([x, z]) => !walled(x, z, v.from - 0.5));
  if (!louver) for (let y = v.from; y < yBox - 0.01; y += course) for (const [x, z, yaw] of sides) if (!walled(x, z, y + course / 2)) b.put(piece, x, y + course / 2, z, yaw);
  // a wall hearth's hood: a beam along the hood's lower edge on each open side, the mantel
  if (v.hood) for (const [x, z, yaw] of openSides) b.put(K.beam || 'wood_beam', x, v.from + 0.1, z, yaw, { trim: true });
  if (!stone) {
    // the cap: short posts at the corners, the ridge caps (or flat roof caps) half a metre over the box
    const cap = v.caps && v.kind !== 'slope' ? v.caps : null;
    for (const [x, z] of [[r.x0, r.z0], [r.x0, r.z1], [r.x1, r.z0], [r.x1, r.z1]]) b.put(K.pole1, x, yTop, z);
    if (cap) for (const c of cap) b.put(c.name, c.x, yTop + 0.5, c.z, c.yaw);
    else for (let x = r.x0 + 1; x < r.x1; x += 2) for (let z = r.z0 + 1; z < r.z1; z += 2) b.put(K.floor, x, yTop + 0.55, z);
  }
  b.notes.push(v.hood ? (v.kind === 'slope' ? 'The fire against the back wall under a hood, its shaft out through the roof with a raised lid.' : 'The fire against the gable wall under a hood, its shaft up to raised ridge caps.')
    : stone ? 'Stone chimney over the fire.' : louver ? 'A smoke louver on the ridge over the fire.' : 'Plank chimney over the fire with a raised cap for the smoke.');
}

// Ceiling braziers hang on their chain (the pivot 1.6 m below what it hangs from) from the lowest roof or ceiling piece
// over the middle of their room, away from the fire; where the room is too low for the bowl to clear a person's head
// they stand as a torch instead. One the decorator hung well (high enough, clear of the walls) stays where it is.
function hangBraziers(b, ctx, fire) {
  const Ck = checksLib();
  const list = b.pieces.filter(p => p.decor && /brazierceiling/.test(p.name));
  if (!list.length) return;
  const structure = b.pieces.filter(p => !p.decor);
  const used = [];
  for (const br of list) {
    const room = b.rooms.filter(r => br.x >= r.x0 - 0.5 && br.x <= r.x1 + 0.5 && br.z >= r.z0 - 0.5 && br.z <= r.z1 + 0.5 && br.y >= r.y - 0.2)
      .sort((a, c) => c.y - a.y)[0];
    if (!room) continue;
    // where it is, it hangs from what is over it (a 4 m room's brazier hung for a 3 m one stood 2.4 m under its roof)
    const ceilAt = (x, z) => { let c = Infinity; for (const p of structure) { let u = Ck.underside(p, x, z); if (u == null) { const bx = Ck.aabb(p); if (['wall', 'beam'].includes(bx.info.role) && x > bx.x0 && x < bx.x1 && z > bx.z0 && z < bx.z1) u = bx.y0; } if (u != null && u > room.y + 0.5 && u < c) c = u; } return c; };
    const c0 = ceilAt(br.x, br.z);
    if (isFinite(c0) && c0 - 1.6 >= room.y + 2.3 && Math.min(br.x - room.x0, room.x1 - br.x, br.z - room.z0, room.z1 - br.z) > 1.4 && !(fire && Math.hypot(fire.x - br.x, fire.z - br.z) < 1.5)) { br.y = +(c0 - 1.6).toFixed(3); used.push([br.x, br.z]); continue; }
    const cx = (room.x0 + room.x1) / 2, cz = (room.z0 + room.z1) / 2, longX = room.x1 - room.x0 >= room.z1 - room.z0;
    const L = longX ? room.x1 - room.x0 : room.z1 - room.z0;
    const spots = [0, -L / 4, L / 4, -L / 8, L / 8].map(t => (longX ? [cx + t, cz] : [cx, cz + t]));
    let placed = false;
    for (const [x, z] of spots) {
      if (used.some(([ux, uz]) => Math.hypot(ux - x, uz - z) < 2)) continue;
      if (fire && Math.hypot(fire.x - x, fire.z - z) < 2) continue;
      if (b.vents.some(v => v.rect && inRect(v.rect, x, z, 0.5))) continue;
      let ceil = Infinity;
      for (const p of structure) {
        let u = Ck.underside(p, x, z);
        if (u == null) {
          // anything else solid right over the spot: the block on top of a dome, a beam
          const bx = Ck.aabb(p);
          if (['wall', 'beam'].includes(bx.info.role) && x > bx.x0 && x < bx.x1 && z > bx.z0 && z < bx.z1) u = bx.y0;
        }
        if (u != null && u > room.y + 0.5 && u < ceil) ceil = u;
      }
      if (!isFinite(ceil) || ceil - 1.6 < room.y + 2.3) continue;
      br.x = +x.toFixed(3); br.z = +z.toFixed(3); br.y = +(ceil - 1.6).toFixed(3); br.yaw = 0; br.q = quat(0);
      used.push([x, z]); placed = true; break;
    }
    if (!placed) { br.name = reaches(ctx.biome, 'Swamp') ? 'piece_groundtorch' : 'piece_groundtorch_wood'; br.y = room.y + 0.85; br.toWall = true; } // a floor torch's pivot is 0.75 m up (set on the floor under it below)
  }
  // standing torches put back against the wall they were hung on, a little out from it
  for (const br of list) if (br.toWall) {
    const room = b.rooms.find(r => br.x >= r.x0 - 0.5 && br.x <= r.x1 + 0.5 && br.z >= r.z0 - 0.5 && br.z <= r.z1 + 0.5);
    if (room) { const cx = (room.x0 + room.x1) / 2, cz = (room.z0 + room.z1) / 2, d = Math.hypot(cx - br.x, cz - br.z) || 1; br.x = +(br.x + (cx - br.x) / d * 0.5).toFixed(3); br.z = +(br.z + (cz - br.z) / d * 0.5).toFixed(3); }
    // on the floor under it (a thick stone floor's top is not the room's height)
    const tops = structure.filter(p => P.piece(p.name).role === 'floor').map(p => Ck.catBox(p)).filter(a => br.x > a.x0 && br.x < a.x1 && br.z > a.z0 && br.z < a.z1 && a.y1 < br.y).map(a => a.y1);
    if (tops.length) br.y = +(Math.max(...tops) + 0.653).toFixed(3); // (the standing torches stand 0.653 m under their pivot, data/piece-models.json)
    delete br.toWall;
  }
}

// Every house and longhouse sleeps someone (Tyler, T-102). When the furnishing left a building without a bed, one
// goes against a wall: the best bed the biome can make, its head to the wall, clear of doors, ladders, the fire and
// everything else. Ground rooms first, then upper ones.
function bedIfNone(b, ctx, fire, zones) {
  const Ck = checksLib(), ord = P.BIOME_ORDER, limit = ord.indexOf(ctx.biome);
  const fits = n => ord.indexOf(P.needs(n)) <= limit;
  if (b.pieces.some(p => P.piece(p.name).role === 'bed' && P.decorOk(p.name, ctx.biome))) return; // any bed counts (D-126)
  // the best bed first, the narrow wooden one where the best does not fit (between a hall's aisle posts); head to the
  // wall, else along the wall (a hall's side benches)
  const names = ['ashwood_bed', 'piece_bed02', 'bed'].filter(n => fits(n) && (n !== 'ashwood_bed' || ctx.biome === 'Ashlands'));
  const doors = b.pieces.filter(p => P.piece(p.name).role === 'door').map(p => P.doorOpening(p));
  // upstairs first where there is an upstairs (beds above the main floor in 77 % of corpus Norse buildings' beds)
  const rooms = [...b.rooms].sort((a, c) => (c.upper ? 1 : 0) - (a.upper ? 1 : 0) || (c.main ? 1 : 0) - (a.main ? 1 : 0));
  // first round: only free floor; second: a table, bench or other furnishing (not the fire or its pot) makes room
  const movable = p => p.decor && !/^(fire_pit|hearth)$|cookingstation|cauldron/.test(p.name);
  for (const pass of [0, 1]) {
  const solid = b.pieces.filter(p => !['floor', 'rug'].includes(P.piece(p.name).role) && !(pass && movable(p))).map(p => Ck.aabb(p));
  for (const name of names.length ? names : ['bed']) for (const along of [false, true]) for (const r of rooms) {
    const [wid, , len] = P.piece(name).size, deep = along ? wid : len;
    const y = r.y + 0.1;
    const sides = [];
    for (let t = r.x0 + 1; t <= r.x1 - 1 + 0.001; t += 0.5) { sides.push([t, r.z0, 0, 1]); sides.push([t, r.z1, 0, -1]); }
    for (let t = r.z0 + 1; t <= r.z1 - 1 + 0.001; t += 0.5) { sides.push([r.x0, t, 1, 0]); sides.push([r.x1, t, -1, 0]); }
    for (const inset of [0.15, 0.55]) for (const [wx, wz, nx, nz] of sides) {
      const x = wx + nx * (inset + deep / 2), z = wz + nz * (inset + deep / 2);
      const yaw = norm(Math.atan2(nx, nz) * 180 / Math.PI + (along ? 90 : 0));
      const cand = { name, x: +x.toFixed(3), y: +y.toFixed(3), z: +z.toFixed(3), yaw, q: quat(yaw), decor: true };
      const cb = Ck.aabb(cand);
      if (cb.x0 < r.x0 || cb.x1 > r.x1 || cb.z0 < r.z0 || cb.z1 > r.z1) continue;
      if (doors.some(o => Math.hypot(o.x - x, o.z - z) < 2 + len / 2 && Math.abs(o.y - r.y) < 1)) continue;
      // the bed's nearest edge at least 1.4 m from the middle of the fire (a fire pit is 1.6 m across)
      if (fire && Math.abs(fire.y - y) < 1 && Math.hypot(Math.max(cb.x0 - fire.x, 0, fire.x - cb.x1), Math.max(cb.z0 - fire.z, 0, fire.z - cb.z1)) < (fire.name === 'hearth' ? 2 : 1.4)) continue;
      if (zones.some(zn => hits(cb, zn))) continue;
      if (solid.some(o => o.x0 < cb.x1 && o.x1 > cb.x0 && o.z0 < cb.z1 && o.z1 > cb.z0 && o.y0 < cb.y1 - 0.05 && o.y1 > cb.y0 + 0.05)) continue;
      // furnishing in the bed's place (and anything standing on it) goes
      if (pass) b.pieces = b.pieces.filter(p => { if (!movable(p)) return true; const o = Ck.aabb(p); return !(o.x0 < cb.x1 + 0.1 && o.x1 > cb.x0 - 0.1 && o.z0 < cb.z1 + 0.1 && o.z1 > cb.z0 - 0.1 && o.y0 < cb.y1 + 1 && o.y1 > cb.y0); });
      b.pieces.push(cand);
      return;
    }
  }
  }
  b.notes.push('No room for a bed: this building needs a larger plan.');
}

// Woodpiles stand outside, against an outside wall away from the doors; where there is no free spot they are left out.
function woodpilesOutside(b) {
  const Ck = checksLib();
  const piles = b.pieces.filter(p => p.decor && /^wood_(fine_|core_)?stack$/.test(p.name));
  if (!piles.length) return;
  const insideAny = p => b.rooms.some(r => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1 && p.y >= r.y - 0.3 && p.y < r.y + (r.h || 3));
  const doors = b.pieces.filter(p => P.piece(p.name).role === 'door').map(p => P.doorOpening(p));
  const ground = b.rooms.filter(r => !r.upper);
  if (!ground.length) return;
  // spots along the outside of the ground rooms, 0.9 m out from the wall, on the ground
  const spots = [];
  if (b.outer) for (const e of b.outer) spots.push({ x: e.x + e.out[0] * 0.9, z: e.z + e.out[1] * 0.9, yaw: e.yaw });
  else for (const r of ground) {
    for (let x = r.x0 + 1; x < r.x1; x += 2) { spots.push({ x, z: r.z0 - 0.9, yaw: 0 }); spots.push({ x, z: r.z1 + 0.9, yaw: 0 }); }
    for (let z = r.z0 + 1; z < r.z1; z += 2) { spots.push({ x: r.x0 - 0.9, z, yaw: 90 }); spots.push({ x: r.x1 + 0.9, z, yaw: 90 }); }
  }
  for (const pile of piles) {
    if (!insideAny(pile)) continue;
    let moved = false;
    for (const s of spots) {
      if (s.taken || doors.some(o => Math.hypot(o.x - s.x, o.z - s.z) < 2.6)) continue;
      const cand = { ...pile, x: +s.x.toFixed(3), y: +((Decor.FURNITURE[pile.name] || {}).base || 0).toFixed(3), z: +s.z.toFixed(3), yaw: s.yaw, q: quat(s.yaw) };
      const cb = Ck.aabb(cand);
      const clash = b.pieces.some(p => p !== pile && P.piece(p.name).role !== 'floor' && hits(cb, Ck.aabb(p)));
      if (clash) continue;
      Object.assign(pile, cand); s.taken = true; moved = true; break;
    }
    if (!moved) pile.gone = true;
  }
  b.pieces = b.pieces.filter(p => !p.gone);
}

// A hearthstone: the wooden floor under a ground-floor fire laid in stone instead (stone floors, flush with the planks
// round them; stone stands on the ground). Half of the best-liked builds use stone floor pieces; the fire is where.
function hearthstone(b, K) {
  const stone = K.stoneFloor;
  if (!stone || !thickFloor(stone)) return;
  const Ck = checksLib();
  for (const fire of b.pieces.filter(p => p.decor && /^(fire_pit|hearth)$/.test(p.name))) {
    const o = Ck.aabb(fire);
    for (const p of b.pieces) {
      if (p.decor || p.name !== K.floor || Math.abs(p.y - fire.y) > 0.4 || p.y > 0.3) continue;
      if (p.x - 1 < o.x1 - 0.1 && p.x + 1 > o.x0 + 0.1 && p.z - 1 < o.z1 - 0.1 && p.z + 1 > o.z0 + 0.1) { p.name = stone; p.y = +(p.y - 0.4).toFixed(3); p.hearth = true; p.hearthStone = true; }
    }
  }
  if (b.pieces.some(p => p.hearth)) b.notes.push('Stone flags under the fire.');
}

// Tidy the furnishing (2026-11-09 interior review): a rug with nothing on it goes, and so does a chair with no table
// to sit at (one chair on a rug facing nothing read as dropped). Benches by walls and seats round a fire stay.
function tidyFurniture(b) {
  const Ck = checksLib(), F = Decor.FURNITURE;
  const deco = b.pieces.filter(p => p.decor && !p.trim);
  const boxes = new Map(deco.map(p => [p, Ck.aabb(p)]));
  const tables = deco.filter(p => (F[p.name] || {}).cat === 'table');
  const anchors = deco.filter(p => ['table', 'bed', 'seat', 'craft', 'storage', 'fire'].includes(P.piece(p.name).role) && P.piece(p.name).role !== 'rug');
  const near = (o, q, m) => { const r = boxes.get(q); return r.x0 < o.x1 + m && r.x1 > o.x0 - m && r.z0 < o.z1 + m && r.z1 > o.z0 - m && Math.abs(r.y0 - o.y0) < 0.6; };
  const gone = new Set();
  // D-149 (Tyler, 2026-11-11): "B. Always mirror what corpus builders do." Corpus (1,739 vanilla builds, pivots only,
  // device script vhrug/rugmine.js, 2026-11-11): 69 % of roofed chairs stand 2.3 m or more from any table and 3 m from
  // any fire, and 99 % of those have a wall, a seat, a stand, a light, a rug, a chest, a window or a station within
  // 1.6 m; 67 % of rugs laid flat have no furniture standing on them. A lone chair stays where something of those kinds
  // is within reach of it (box gap 1.2 m); a bare rug stays while the design's bare rugs are within that share. Neither
  // closes a lane or a way in: lib/layout.js openWays moves or leaves out what does.
  const facing = /itemstand|ArmorStand|chest|barrel|crate|window|crystal|ledge|shelf|bed|sign|banner|workbench|forge|stonecutter|artisan|spinning|magetable|cartography|cauldron|oven|fermenter|chair|bench|stool|throne|torch|lantern|candle|brazier|sconce|rug_|carpet|wall|pole|beam|log/i;
  const near1 = (o, q, m) => { const r = Ck.aabb(q); return r.x0 < o.x1 + m && r.x1 > o.x0 - m && r.z0 < o.z1 + m && r.z1 > o.z0 - m && r.y1 > o.y0 - 0.3 && r.y0 < o.y0 + 2.2; };
  for (const p of deco) {
    if (!/^piece_chair/.test(p.name)) continue;
    const o = boxes.get(p);
    if (tables.some(t => near(o, t, 0.9)) || deco.some(f => /fire_pit|hearth/.test(f.name) && near(o, f, 1.6))) continue;
    if (!b.pieces.some(q => q !== p && facing.test(q.name) && near1(o, q, 1.2))) gone.add(p);
  }
  const RUG_BARE = 0.67;
  const rugs = deco.filter(p => P.piece(p.name).role === 'rug');
  const bare = rugs.filter(p => { const o = boxes.get(p); return !anchors.some(q => !gone.has(q) && q !== p && near(o, q, -0.3)); });
  // the bare rugs over the share go, the last laid first
  const over = Math.max(0, bare.length - Math.floor(RUG_BARE * rugs.length + 1e-9));
  for (const p of bare.slice(bare.length - over)) gone.add(p);
  if (gone.size) b.pieces = b.pieces.filter(p => !gone.has(p));
  // a long table with nobody's seat at it gets a bench along each long side where there is room
  const zones = keepClear(b);
  for (const t of b.pieces.filter(p => p.decor && /^piece_table(_oak)?$/.test(p.name))) {
    const o = Ck.aabb(t);
    if (b.pieces.some(q => q.decor && P.piece(q.name).role === 'seat' && (() => { const r = Ck.aabb(q); return r.x0 < o.x1 + 0.9 && r.x1 > o.x0 - 0.9 && r.z0 < o.z1 + 0.9 && r.z1 > o.z0 - 0.9; })())) continue;
    const a = (t.yaw || 0) * Math.PI / 180, nx = Math.sin(a), nz = Math.cos(a); // across the table
    const depth = (F[t.name] || {}).s ? F[t.name].s[2] : 1.2;
    const bench = 'piece_bench01';
    const len = (F[t.name] || {}).s ? F[t.name].s[0] : 2.4, spots = len > 4 ? [-1.5, 1.5] : [0];
    for (const sg of [1, -1]) for (const along of spots) {
      const ux = Math.cos(a), uz = -Math.sin(a);
      const cand = { name: bench, x: +(t.x + nx * sg * (depth / 2 + 0.45) + ux * along).toFixed(3), y: t.y, z: +(t.z + nz * sg * (depth / 2 + 0.45) + uz * along).toFixed(3), yaw: t.yaw || 0, q: quat(t.yaw || 0) };
      const cb = Ck.aabb(cand);
      const clash = b.pieces.some(q => { if (q === t || ['floor', 'rug'].includes(P.piece(q.name).role)) return false; const r = Ck.aabb(q); return r.x0 < cb.x1 - 0.03 && r.x1 > cb.x0 + 0.03 && r.z0 < cb.z1 - 0.03 && r.z1 > cb.z0 + 0.03 && r.y0 < cb.y1 && r.y1 > cb.y0 + 0.05; })
        || zones.some(z => hits(cb, z));
      // and on the same floor
      const floored = b.pieces.some(q => !q.decor && P.piece(q.name).role === 'floor' && (() => { const r = Ck.aabb(q); return cand.x > r.x0 && cand.x < r.x1 && cand.z > r.z0 && cand.z < r.z1 && Math.abs(r.y1 - cb.y0) < 0.2; })());
      if (!clash && floored) b.pieces.push({ ...cand, decor: true });
    }
  }
}

// Things set on a table (dishes, candles) whose table came out later (a clash, a ladder, the fire's ring) come out too.
function dropOrphans(b) {
  const F = Decor.FURNITURE;
  const tables = b.pieces.filter(p => p.decor && (F[p.name] || {}).cat === 'table');
  const built = b.pieces.filter(p => p.decor && !F[p.name] && P.piece(p.name).structural);
  const Ck = checksLib();
  // read as decorate.js audit reads it: on a table's top (within 5 cm of its box, 15 cm of its top), on a built
  // counter, or hung on a wall as a shelf (a wall within 0.4 m whose height spans it); one a little off its table's
  // top (up to 0.3 m, a top piece left at the height of what stood there before) goes down or up onto it
  const boxD = (o, x, z) => Math.hypot(Math.max(o.x0 - x, 0, x - o.x1), Math.max(o.z0 - z, 0, z - o.z1));
  b.pieces = b.pieces.filter(p => {
    // (a set's piece that says what it rests on is read by its rest, in finish, as the audit reads it)
    if (!p.decor || (F[p.name] || {}).at !== 'top' || (p.kb && p.rest)) return true;
    let near = null;
    for (const t of tables) {
      if (boxD(Ck.aabb(t), p.x, p.z) > 0.05) continue;
      const d = Math.abs(t.y + ((F[t.name] || {}).top || 0.75) - p.y);
      if (d < 0.15) return true;
      if (d < 0.3 && (!near || d < near[1])) near = [t, d];
    }
    if (built.some(t => { const o = Ck.aabb(t); return boxD(o, p.x, p.z) < 0.05 && Math.abs(o.y1 - p.y) < 0.2; })) return true;
    // or hung on a wall as a shelf
    if (b.pieces.some(w => !w.decor && ['wall', 'window'].includes(P.piece(w.name).role) && (o => boxD(o, p.x, p.z) < 0.4 && o.y0 < p.y && o.y1 > p.y)(Ck.aabb(w)))) return true;
    if (near) { p.y = +(near[0].y + ((F[near[0].name] || {}).top || 0.75)).toFixed(3); return true; }
    return false;
  });
}

// Pieces the biome cannot make yet, swapped for the nearest it can, or left out (props the generator sets itself:
// barrels by wells and pens, benches round a camp fire).
const STAND_IN = { piece_chest_barrel: 'piece_chest_wood', piece_logbench01: 'piece_bench01', piece_groundtorch: 'piece_groundtorch_wood',
  piece_chest: 'piece_chest_wood', piece_cookingstation_iron: 'piece_cookingstation', hearth: 'fire_pit' };
function biomeSafe(b, biome) {
  const ord = P.BIOME_ORDER, limit = ord.indexOf(biome) + 1, fits = n => ord.indexOf(P.needs(n)) <= limit;
  const Ck = checksLib(), gone = [];
  b.pieces = b.pieces.filter(p => {
    // decor goes in any biome (D-065, Tyler 2026-11-10), as the furnishing chose it (a log bench of a couch swapped
    // here for a plank bench went into the couch's half wall); building pieces the village's biome and the next
    if (fits(p.name) || P.piece(p.name).structural || (p.decor && P.decorOk(p.name, biome))) return true;
    const alt = STAND_IN[p.name];
    if (alt && fits(alt)) { p.name = alt; return true; }
    if (p.decor) gone.push(Ck.aabb(p));
    return false;
  });
  // and what stood on a table or chest that came out (a dish on a table, T-interior 2026-11-09)
  if (gone.length) b.pieces = b.pieces.filter(p => {
    if (!p.decor) return true;
    const bx = Ck.aabb(p);
    return !gone.some(g => bx.y0 >= g.y0 + 0.3 && bx.y0 <= g.y1 + 0.2 && p.x > g.x0 && p.x < g.x1 && p.z > g.z0 && p.z < g.z1);
  });
}

// Nothing left in the air: a piece set on another (a chest on a bench, a mug on a table) goes when what held it was
// taken out or moved by a later pass (a lane cleared, a set undone), checked the way the interior library checks its
// pieces. Run before the stands are dressed and again after openWays, which moves furniture.
function dropLoose(b) {
  for (let pass = 0; pass < 3; pass++) {
    const ctx = Decor.auditContext(b.pieces);
    // a chest stays up only on another chest (a set's chest left on the decorator's table, 2026-11-10)
    const onChest = p => b.pieces.some(q => q !== p && /chest|barrel|crate/.test(q.name) && Math.abs(q.x - p.x) < 0.6 && Math.abs(q.z - p.z) < 0.6 && q.y < p.y - 0.3 && q.y > p.y - 1.3);
    const onStack = p => b.pieces.some(q => q !== p && /chest|barrel|crate/.test(q.name) && Math.abs(q.x - p.x) < 0.3 && Math.abs(q.z - p.z) < 0.3 && Math.abs(checksLib().aabb(q).y1 - p.y) < 0.12);
    // and a chest the decorator stacked on another (storeStacks) whose lower chest a later pass took out or moved
    const loose = b.pieces.filter(p => p.decor && ((p.rest === 'on' && (!Decor.auditOne(p, ctx, []) || (/chest/.test(p.name) && !onChest(p)))) || (p.stacked && !p.rest && !onStack(p))));
    if (!loose.length) break;
    const out = new Set(loose);
    b.pieces = b.pieces.filter(p => !out.has(p));
  }
}

// Steps down from every outside door to the ground the game puts the design on (D-096). The mod sets a design's
// lowest pivot on the terrain (src/Villheim.Logic/Designs/Blueprints.cs Center), so a stone hearth floor half in the
// ground (-0.4 m) or a bush set into it (-0.49 m) lifts the whole house that much over the terrain. The doorstep beams
// laid 5 cm over the floor (2026-11-09) then stood 0.6 m over the ground outside, a log across the doorway that stopped
// Tyler at the door of a Meadows home (showcase 11, 2026-11-11). Where the floor in a doorway stands more than
// checks.js DOOR_STEP over that ground and nothing lies within a step of it outside, the doorstep beams come out and
// treads of beams go down to the ground, each no more than DOOR_STEP under the one before.
function doorSteps(b) {
  const Ck = checksLib(), step = Ck.DOOR_STEP || 0.3;
  const G = Math.min(0, ...b.pieces.map(p => p.y));
  const beam = 'wood_beam';
  for (const d of b.pieces.filter(p => P.piece(p.name).role === 'door' && !p.decor)) {
    const o = P.doorOpening(d);
    if (o.w < 1.2) continue;
    const top = o.y + 0.1;
    if (top - G <= step + 0.01) continue;
    // the outside: the side with no floor, deck or stair within a step of the door's floor a metre out
    const near = (sg, dist) => b.pieces.some(p => {
      const role = P.piece(p.name).role;
      if (p === d || !['floor', 'stair'].includes(role) && !(role === 'beam' && p.trim)) return false;
      const a = Ck.aabb(p), x = o.x + o.nx * sg * dist, z = o.z + o.nz * sg * dist;
      return x > a.x0 - 0.05 && x < a.x1 + 0.05 && z > a.z0 - 0.05 && z < a.z1 + 0.05 && a.y1 > top - step - 0.05 && a.y1 < top + 0.4;
    });
    const stairOut = sg => b.pieces.some(p => P.piece(p.name).role === 'stair' && Math.abs((p.x - o.x) * o.ux + (p.z - o.z) * o.uz) < 1.2 && (p.x - o.x) * o.nx * sg + (p.z - o.z) * o.nz * sg > 0 && (p.x - o.x) * o.nx * sg + (p.z - o.z) * o.nz * sg < 3);
    for (const sg of [-1, 1]) {
      if (stairOut(sg)) continue;
      if (near(sg, 1.0) && !near(sg, 0.5)) continue;
      // a floor a metre out at the door's height: inside, or a deck
      const floorOut = b.pieces.some(p => P.piece(p.name).role === 'floor' && (() => { const a = Ck.aabb(p), x = o.x + o.nx * sg * 1.2, z = o.z + o.nz * sg * 1.2; return x > a.x0 && x < a.x1 && z > a.z0 && z < a.z1 && Math.abs(a.y1 - top) < 0.25; })());
      if (floorOut) continue;
      // the doorstep beams laid in the lane come out
      const inLane = p => P.piece(p.name).role === 'beam' && !p.decor && (() => { const s = (p.x - o.x) * o.nx * sg + (p.z - o.z) * o.nz * sg, t = (p.x - o.x) * o.ux + (p.z - o.z) * o.uz; return s > 0.1 && s < 1.2 && Math.abs(t) < 0.6 && Math.abs(p.y - (top - 0.15)) < 0.25; })();
      const old = b.pieces.filter(inLane), name = old.length ? old[0].name : beam;
      b.pieces = b.pieces.filter(p => !inLane(p));
      const m = Math.ceil((top - G) / step - 1e-6), h = (top - G) / m;
      for (let k = 1; k < m; k++) {
        const y = top - k * h, s = 0.35 + 0.4 * (k - 1);
        // a tread: one beam along the door, its top at y (the beam's collider is 0.4 m deep and tall)
        b.put(name, o.x + o.nx * sg * s, y - 0.2, o.z + o.nz * sg * s, d.yaw || 0, { trim: true, step: true });
        // and the beams under it to the ground, so it stands on something
        for (let yy = y - 0.6; yy >= G + 0.2 - 1e-6; yy -= 0.4) b.put(name, o.x + o.nx * sg * s, yy, o.z + o.nz * sg * s, d.yaw || 0, { trim: true, step: true });
      }
    }
  }
}
// Posts where the game's support rule (checks.js gameSupport, WearNTear) would let a roof, ridge, tie beam or wall
// up high fall (hubs, round towers' crowns, wide halls). The hubs are the widest roofs the generator makes: on the Meadows s5 cross hall (14 m arms, 6 m walls)
// the ridge caps and valley pieces over the crossing and along the arms held 7 to 9 support where wood needs 10, and the
// game took them down when the hall was put up in one go (2026-11-11). A wood piece loses its material's share of
// support times the distance between pivots at every step, so a 45 degree roof loses about 40 % a row up from the wall
// top; corpus halls carry their ridges on posts. Each round puts a post column under the weakest falling piece of
// each 4 m stretch, from the floor under it up into its underside, in core wood where the biome builds it (hard wood
// loses less per metre), and checks again. A spot on the fire, a stair, a doorway or the opening over the fire is
// skipped. Returns the number of columns.
function propUp(b, K, biome, o = {}) {
  const Ck = checksLib(), Sx = shapesLib(), hard = P.decorOk('wood_pole_log_4', biome);
  const p4 = hard ? 'wood_pole_log_4' : (K.poleLong && /4/.test(K.poleLong) ? K.poleLong : null), p2 = hard ? 'wood_pole_log' : (K.pole || 'wood_pole2'), p1 = K.pole1 || 'wood_pole';
  const ROLES = ['roof', 'roofTop', 'roofCorner', 'beam', 'floor', 'wall', 'gable', 'window'];
  let n = 0;
  for (let round = 0; round < 12; round++) {
    const shell = b.pieces.filter(p => !p.decor);
    const r = Ck.gameSupport(shell);
    // (trim that would fall is the trim's own matter: no post goes up under a bargeboard)
    const fall = r.fall.map(i => shell[i]).filter(p => ROLES.includes(P.piece(p.name).role) && !p.trim);
    if (!fall.length) break;
    fall.sort((a, c) => r.support[shell.indexOf(a)] - r.support[shell.indexOf(c)]);
    const chosen = [];
    for (const p of fall) if (!chosen.some(q => Math.hypot(q.x - p.x, q.z - p.z) < 4)) chosen.push(p);
    let added = 0;
    for (const p of chosen) {
      const W = Sx.world(p);
      // the spot: under the piece, or along its length (a ridge cap's ridge) up to 4 m on, where the post stands on the
      // ground floor clear of galleries and walkways over it
      const a = (p.yaw || 0) * Math.PI / 180, ux = Math.cos(a), uz = -Math.sin(a);
      let spot = null;
      // (the corners 0.9 m out last: a valley's inner corner over the crossing of a cross hall is carried from the
      // crossing's corner, clear of the middle)
      for (const [k, m] of [[0, 0], [2, 0], [-2, 0], [4, 0], [-4, 0], [1, 0], [-1, 0], [3, 0], [-3, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [0.9, 0.9], [-0.9, 0.9], [0.9, -0.9], [-0.9, -0.9]]) {
        const x = p.x + ux * k + uz * m, z = p.z + uz * k - ux * m;
        // posts stand in rows: none within 1.9 m of another, and on the line of one in the same row when near it
        if (b.pieces.some(q => q.prop && Math.hypot(q.x - x, q.z - z) < 1.9)) continue;
        const top = W && W.length ? Sx.undersideAt(W, x, z) : (k === 0 ? p.y : null);
        let under = top;
        if (top == null) {
          // past the piece's own end: the next piece of the same kind in its row (a ridge cap's, a tie beam's neighbor)
          const q = shell.find(f2 => f2 !== p && f2.name === p.name && Math.abs(f2.y - p.y) < 0.3 && Math.hypot(f2.x - x, f2.z - z) < 1.05);
          const Wq = q && Sx.world(q);
          under = Wq && Wq.length ? Sx.undersideAt(Wq, x, z) : null;
        }
        if (under == null) continue;
        let base = 0, raisedFloor = false;
        for (const q of shell) {
          if (P.piece(q.name).role !== 'floor' || q === p) continue;
          const bq = Ck.catBox(q);
          if (x < bq.x0 || x > bq.x1 || z < bq.z0 || z > bq.z1 || bq.y1 > under - 1) continue;
          if (bq.y1 > 0.6 && !o.raisedOk) raisedFloor = true; else base = Math.max(base, bq.y1);
        }
        if (raisedFloor) continue;
        const blocked = b.pieces.some(q => {
          const role = P.piece(q.name).role;
          if (role === 'fire' || q.hearth) return Math.hypot(q.x - x, q.z - z) < 2.2;
          if (role === 'stair') { const bq = Ck.catBox(q); return x > bq.x0 - 0.6 && x < bq.x1 + 0.6 && z > bq.z0 - 0.6 && z < bq.z1 + 0.6; }
          if (role === 'door') { const op = P.doorOpening(q); return Math.abs((x - op.x) * op.ux + (z - op.z) * op.uz) < op.w / 2 + 0.5 && Math.abs((x - op.x) * op.nx + (z - op.z) * op.nz) < 2.5; }
          return false;
        }) || (o.keepOut && o.keepOut(x, z));
        if (blocked) continue;
        spot = { x, z, top: under, base };
        break;
      }
      if (!spot) continue;
      const { x, z, top, base } = spot;
      // the longest pieces first; the last one ends at the underside, reaching down into the one below it (no metre of
      // post poking up through the roof, no short soft-wood piece at the top where the load is)
      // a post over 8 m: wood and iron where the village's biomes allow iron (D-125), else core wood in 2 m pieces (the
      // game takes a tenth of the support per metre of pivot distance plus 0.1 m, so two 2 m logs hold more than one
      // 4 m log); lib/checks.js gameSupport
      let y = base;
      const tall = top - base > 8, iron = tall && P.decorOk('woodiron_pole', biome);
      while (top - y > 0.15) {
        const left = top - y, name = iron ? 'woodiron_pole' : left >= 3.5 && p4 && !tall ? p4 : p2, h = P.piece(name).size[1];
        const y0 = Math.min(y, top - h);
        b.put(name, x, Math.max(base, y0) + h / 2, z, 0, { prop: true });
        y = Math.max(base, y0) + h;
        if (y0 < y - h - 1e-6 || h > left) break;
      }
      added++;
    }
    n += added;
    if (!added) break;
  }
  if (n) b.notes.push(`${n} post${n > 1 ? 's' : ''} up to the roof where it would not hold by itself.`);
  return n;
}

function finish(b, info) {
  dropLoose(b);
  // a table rolled dressed that the passes left bare gets one thing on it (lib/kitbash.js redressTables)
  if (Kitbash.redressTables) Kitbash.redressTables(b, { culture: info.cultureKey });
  // every item stand holds something the household would keep there, or goes (lib/persona.js)
  Persona.dressStands(b, { persona: info.household, biome: info.biome, type: info.type, use: S.TYPES[info.type].use });
  // the decor stage asked for: what the household has put up by then (D-071)
  if (info.grow) Persona.growth(b, info.decor, info.type === 'temple' ? 'temple' : ['tavern', 'longhouse'].includes(info.type));
  biomeSafe(b, info.biome);
  // a person can walk in through every door, into every room and up to every bed, table, station and chest (D-152,
  // D-148; lib/layout.js openWays), after every pass that sets or moves furniture
  if (b.walks && b.rooms && b.rooms.length) { const yl = Math.min(...b.rooms.map(r => r.y)); for (const w of b.walks) if (w.y == null) w.y = yl; }
  { const Lw = layoutLib(); if (Lw && Lw.openWays) { Lw.openWays(b, info); dropLoose(b); } }
  dropOrphans(b);
  // the generator places walls by their middle; the pieces that stand on their pivot go down to their foot
  for (const p of b.pieces) { const pi = P.piece(p.name); if (pi.onPivot && !p.decor && !p.footed) { p.y = +(p.y - pi.size[1] / 2).toFixed(3); p.footed = true; } }
  doorSteps(b);
  const name = `${info.type}_${info.biome.replace(' ', '')}_${info.cultureKey}_${info.plan || 'x'}-${info.roof || 'x'}-${info.walls || 'x'}${info.asked || ''}_${info.stage}${info.decor}_${info.seed}`;
  return {
    ground: 0,
    meta: { Name: name, Creator: 'Villheim generator', Category: 'Villheim generated',
      Description: `${S.TYPES[info.type].label}, ${info.biome}, ${S.CULTURES[info.cultureKey].label}, ${info.plan || ''} plan, ${info.roof || ''} roof, ${info.walls || ''} walls, ${info.stage}${info.decor}, seed ${info.seed}` },
    pieces: b.pieces, rooms: b.rooms, walks: b.walks, notes: [...new Set(b.notes)], request: info,
    // places a resident's own role props could go, left empty for the game (lib/kitbash.js residentSlots)
    slots: b.slots || [],
    // what the greenery pass placed (lib/landscape.js)
    landscape: b.landscape || null,
    // the windows run by run as the details built them (lib/details.js exterior)
    facade: b.facade || null,
  };
}

// ---------------------------------------------------------------- small helpers

const avg = a => a.reduce((t, v) => t + v, 0) / a.length;
// 1 m floors (stone, black marble) pivot in their middle
const thickFloor = n => !!n && P.piece(n).size[1] >= 0.9;
// rectangles are { x0, x1, z0, z1 } in world metres
const rectXs = r => [r.x0, r.x1], rectZs = r => [r.z0, r.z1];
const cellRect = c => ({ x0: c[0] - 1, x1: c[0] + 1, z0: c[1] - 1, z1: c[1] + 1 });
const inRect = (r, x, z, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
// The hood of a wall hearth starts 2.55 m over the floor: clear of a player's head (the headroom check's 2.4 m) and
// low enough to catch the smoke.
const HOOD = 2.55;
// Take pieces out of a build (and out of its key set, so they can be put back in the same place later).
// a ridge cap (the crossed boards on a gable share the catalog's roofTop role; they stay on the bargeboards' line when
// the caps over a fire are lifted for smoke: showcase 09 had them 0.6 m up with the caps)
function isCap(p) { return P.piece(p.name).role === 'roofTop' && !/wall_roof_top/.test(p.name); }
function takeOut(b, test) {
  const out = b.pieces.filter(test);
  if (!out.length) return out;
  const gone = new Set(out);
  b.pieces = b.pieces.filter(p => !gone.has(p));
  for (const p of out) b.keys.delete(`${p.name}|${Math.round(p.x * 100)}|${Math.round(p.y * 100)}|${Math.round(p.z * 100)}|${Math.round(p.yaw || 0) % 360}`);
  return out;
}
function rectOf(caps) {
  return { x0: Math.min(...caps.map(c => c.x)) - 1, x1: Math.max(...caps.map(c => c.x)) + 1, z0: Math.min(...caps.map(c => c.z)) - 1, z1: Math.max(...caps.map(c => c.z)) + 1 };
}
// a stone-like piece whose top meets the bottom of a course of height h centred at p
function stoneUnder(b, p, h) {
  const bottom = p.y - h / 2;
  return b.pieces.some(q => Math.abs(q.x - p.x) < 0.05 && Math.abs(q.z - p.z) < 0.05 && P.supportClass(q.name) !== 'wood' && P.supportClass(q.name) !== 'hardwood' &&
    Math.abs(q.y + P.piece(q.name).size[1] / 2 - bottom) < 0.05);
}
// a world point's place along a wing's ridge
function ridgeU(w, pt) { const a = w.alpha * Math.PI / 180; return (pt.x - w.cx) * Math.cos(a) - (pt.z - w.cz) * Math.sin(a); }
// Where a home keeps its fire (Tyler, 2026-11-10). In the corpus the main fire of 84 % of 291 homes stands against a
// wall, in a corner, in an alcove or half in the wall, and 16 % in the middle of the floor; halls and taverns keep a
// middle fire where people gather (docs/INTERIOR_DESIGN.md, "Hearths"). Weights per culture for a home under a gable
// roof: 'middle' (under the ridge, the old way), 'end' (against a gable end under the ridge: a hood over it and a
// shaft up to raised ridge caps), 'side' (against the back wall, or the front wall by the door for the Slavic stove
// corner: a shaft out through the roof's lowest row). An end hearth is rebuilt in stone, half in the wall with a stack
// outside, once the household's stage may build in stone (D-012), with the 'stack' odds.
const HEARTHS = {
  default: { middle: 0.15, end: 0.5, side: 0.35, stack: 0.5 },
  norse: { middle: 0.35, end: 0.4, side: 0.25, stack: 0.3 },
  'norse-forest': { middle: 0.25, end: 0.45, side: 0.3, stack: 0.35 },
  'norse-highland': { middle: 0.2, end: 0.45, side: 0.35, stack: 0.5 },
  baltic: { middle: 0.3, end: 0.4, side: 0.3, stack: 0.3 },
  'fen-folk': { middle: 0.35, end: 0.4, side: 0.25, stack: 0.2 },
  celtic: { middle: 0.4, end: 0.4, side: 0.2, stack: 0.3 },
  'anglo-saxon': { middle: 0.15, end: 0.5, side: 0.35, stack: 0.5 },
  'frankish-norman': { middle: 0.05, end: 0.55, side: 0.4, stack: 0.7 },
  'castle-medieval': { middle: 0.05, end: 0.5, side: 0.45, stack: 0.7 },
  slavic: { middle: 0, end: 0.15, side: 0.85, stack: 0.3, front: true, corner: 0.9 },
  'east-asian': { middle: 0.5, end: 0.2, side: 0.3, stack: 0.2 },
  byzantine: { middle: 0.2, end: 0.4, side: 0.4, stack: 0 },
  // a Svan house keeps the middle hearth more often (the machub's hearth stood in the room); the stone houses of the
  // Levant and Arabia put the fire in a niche in the thick wall (flat roofs: the wall cell, generate)
  lamari: { middle: 0.35, end: 0.4, side: 0.25, stack: 0 },
  'middle-eastern': { middle: 0.15, end: 0.45, side: 0.4, stack: 0 },
};
// Where the household lays its fire at a stage (D-132, Tyler: "Fireplaces can move spots"). The first fire is drawn at
// s1 from the household's own stream, at the end the house does not grow toward. At each later stage the household
// may rework it and draw again from the culture's odds: 30 % at a stage that changes the house (a wing, more length,
// a storey), 8 % at one that keeps the same shell. Moving a fire means a new hood or shaft and patching the roof over
// the old one, so a household mostly does it while the builders are in anyway; a stage that only furnishes and
// dresses the house seldom does. These rates are a choice (the corpus has no house seen at two stages). There is no
// fixed interval: each stage draws on its own. Returns { spot0, sg, corner, stackDraw, moved, before } where moved names
// the stage the fire last moved at (or null) and before is the draw it moved from.
const HEARTH_MOVE = { grew: 0.3, kept: 0.08 };
// The culture's stack odds scaled to the corpus: a stone stack past the roof over 13 of 443 home wall fires (3 %,
// corpus-hearths-lights.json ventByKind). With stone hearths open to every biome from s2 (D-131) the unscaled odds gave
// 9 % of s2 and s3 wall fires, half of them 3 % (lab/hearths/spotmix.js, 14 seeds).
const STACK_SHARE = 0.5;
// A hall or tavern where people gather: in the corpus 32 % of the fires in halls and taverns over 80 m2 stand in the
// middle, 29 % half in the wall, 16 % against it and 16 % in an alcove (docs/INTERIOR_DESIGN.md). The middle odds are
// set under a third because halls whose wings leave no free wall keep the middle anyway (lab/hearths/hallmix.js: 37 %
// of those over 80 m2 in all). The stone stack odds stay the culture's.
// The middle odds in a home whose main room is under 80 m2: about 2 % of those homes draw the middle (lab/hearths/
// roommix.js), against 3 of 204 in the corpus.
const MID_SMALL_ROOM = 0.05;
// The middle odds in a home whose main wing is 80 m2 or more: the culture's odds times 0.55, in place of the floor-area
// scale, which gave 5 of 39 such homes a middle fire (13 %) against 74 of 325 (23 %) in the corpus. With 0.55:
// 14 of 65 (22 %) over 12 seeds, 11 of 39 (28 %) over 6 (lab/hearths/roommix.js, round 6).
const MID_BIG_ROOM = 0.55;
const HALL_HEARTH = { middle: 0.22, end: 0.4, side: 0.25, front: false, corner: 0.3 };
function hearthDraw(lineage, cultureKey, stage, M, area, hall, salt = 0, room = null) {
  const wt = hall ? { ...(HEARTHS[cultureKey] || HEARTHS.default), ...HALL_HEARTH } : HEARTHS[cultureKey] || HEARTHS.default;
  // the culture's middle odds by the room the fire serves: in the corpus 3 of 204 home fires in rooms under 80 m2 stand
  // in the middle (none of 67 at 35 to 80 m2), 74 of 325 in rooms of 80 m2 or more (corpus-hearths-lights.json
  // homePlaceByServedRoom); over that, a big house's hall gathers round it more often (floor area)
  const mid = hall ? wt.middle : wt.middle * (room != null && room < 80 ? MID_SMALL_ROOM : room != null ? MID_BIG_ROOM : area == null ? 1 : area < 120 ? 0.3 : area < 250 ? 0.6 : 0.9);
  const draw = (R, sgFirst) => {
    const spot0 = pick(R, { middle: mid, end: wt.end, side: wt.side });
    const sgR = R() < 0.5 ? -1 : 1;
    return { spot0, sg: sgFirst || sgR, corner: R() < (wt.corner != null ? wt.corner : 0.5), stackDraw: R(), moved: null };
  };
  let d = draw(rng((lineage * 92821 + strHash(cultureKey) * 7 + 5 + salt) >>> 0), M && M.fam.growSide ? -M.fam.growSide : 0);
  const order = ['s1', 's2', 's3'], upTo = Math.max(0, order.indexOf(stage));
  const sig = st => st ? `${st.W}x${st.D}|${st.specs.length}|${st.storeys}|${st.round ? 1 : 0}` : null;
  for (let i = 1; i <= upTo; i++) {
    const R = rng((lineage * 92821 + strHash(cultureKey) * 7 + 5 + salt + i * 7919) >>> 0);
    const grew = !M || sig(M.states[order[i]]) !== sig(M.states[order[i - 1]]);
    if (R() >= (grew ? HEARTH_MOVE.grew : HEARTH_MOVE.kept)) continue;
    const n = draw(R, 0);
    // a stone rebuild keeps its draw (the stack odds are the household's), and the new place must differ from the old
    if (n.spot0 === d.spot0 && n.sg === d.sg) n.sg = -n.sg;
    d = { ...n, stackDraw: d.stackDraw, moved: order[i], before: d };
  }
  return d;
}

// The plan for the stage comes from hearthDraw. A blocked end falls back to the corner at that end, then to the
// middle. Returns { spot, sg, u, sv, x, z, stack } in world metres for the main wing, or { spot: 'middle', why }.
function hearthPlan(o) {
  const { T, C, cultureKey, lineage, roofKind, plan, wings, flat, form, M, stoneOK, F, doors, stage, K, cells } = o;
  const w0 = wings[0];
  const why = w => ({ spot: 'middle', why: w });
  const hall = T.use === 'hall';
  if (T.use !== 'home' && !hall) return why('not a home');
  if (T.tower) return why('tower');
  if (flat) return why('flat');
  if (!['gable', 'hip'].includes(roofKind)) return why(`roof ${roofKind}`);
  if (form && !['svan', 'gables'].includes(form)) return why(`form ${form}`);
  if (w0.W < 3 || w0.D < 3) return why('small');
  const wt = hall ? { ...(HEARTHS[cultureKey] || HEARTHS.default), ...HALL_HEARTH } : HEARTHS[cultureKey] || HEARTHS.default;
  const hd = hearthDraw(lineage, cultureKey, stage, M, o.area, hall, hall ? strHash(o.type || '') : 0, 4 * w0.W * w0.D);
  const { spot0, corner, stackDraw, moved } = hd;
  let sg = hd.sg;
  // the stage the fire moved at, when the move changes where it stands (a row of gable houses has one wall place)
  const movedHere = hd.moved === stage && hd.before && (plan === 'gables' ? (hd.before.spot0 === 'middle') !== (spot0 === 'middle') : form === 'svan' ? hd.before.spot0 !== spot0 : true);
  if (spot0 === 'middle' && !o.midStack) return { ...why('drawn'), moved, movedHere };
  // a row of gable houses (Icelandic): the fire against the back gable of the main row, under its ridge, the door in
  // the front gable (the hearth in a turf house's own row by the back wall)
  if (plan === 'gables') {
    const ends = [-1, 1].map(s1 => {
      const [x, z] = toWorld(w0, s1 * (w0.W - 1), 0, 0).map(c => Math.round(c) + 0);
      return { s1, x, z };
    }).filter(e => cells.has(`${e.x},${e.z}`) && !doors.some(d => Math.hypot(d.x - e.x, d.z - e.z) < 2.2) && !wings.some(w => w !== w0 && inside(w, e.x, e.z, -0.1)));
    ends.sort((a, c) => c.z - a.z);
    if (!ends.length) return { ...why('gables: no free back end'), moved };
    return { spot: 'end', sg: ends[0].s1, x: ends[0].x, z: ends[0].z, xW: NaN, rot: true, moved, movedHere };
  }
  if (w0.alpha !== 0) return why('turned wing');
  // a Svan house: the tower stands at the back corner of the +x end from s2, so the fire keeps to the other end
  if (form === 'svan') sg = -1;
  const hip = roofKind === 'hip';
  const sv0 = wt.front ? -1 : 1;
  const nearDoor = (x, z, d = 2.4) => doors.some(e => Math.hypot(e.x - x, e.z - z) < d);
  const cell = (x, z) => cells.has(`${x},${z}`) && !wings.some(w => w !== w0 && inside(w, x, z, -0.1));
  // an end is free when nothing joins the gable: no wing past it, and the end cell is the main wing's own
  // (a shaft through an upper floor leaves walks of two floor pieces (4 m) or none beside it: an end hearth's shaft in
  // the middle of a gable 9 m wide left 3.5 m either side, council tavern Plains byzantine seed 77; a side hearth's
  // shaft one bay in from the gable left a 2 m pocket. Upper floors take the end hearth on a gable 10 m wide or more,
  // the side hearth at the corner or 4 m in)
  const upper = (o.storeys || 1) > 1;
  const endAt = (s1, force) => {
    if (upper && w0.D - 1.5 < 3.9) return null; // (the shaft's boards and the wall take 1.5 m of the half depth)
    const xW = w0.cx + s1 * w0.W, x = xW - s1, z = w0.cz;
    if (hip || wings.some(w => w !== w0 && (inside(w, xW + s1 * 1.5, z, 0.3) || inside(w, x, z, 0.3)))) return null;
    if (!cell(x, z) || nearDoor(x, z, 2.2)) return null;
    const stack = stoneOK && !C.stoneWalls && F < 1.01 && stage !== 's1' && K.stoneWall && /2x1/.test(K.stoneWall) && (force || stackDraw < (wt.stack || 0) * STACK_SHARE);
    if (force && !stack) return null;
    return { spot: stack ? 'stack' : 'end', sg: s1, x, z, xW };
  };
  // a middle fire under a gable stack moves to the stack's end (o.midStack, from generate); where that end cell is not
  // free (a door by it, another wing's floor) the fire stays in the middle and no stack is built
  if (spot0 === 'middle') {
    const e = endAt(o.midStack, true);
    return e ? { ...e, moved, movedHere, why: 'middle moved under the stack' } : { ...why('drawn'), moved, movedHere, stackWhy: 'end not free' };
  }
  // a wing that runs the main wing on at the same depth and turn carries its walls and roof on (a nave, an annex)
  const runsOn = w => w.alpha === w0.alpha && Math.abs(w.cz - w0.cz) < 0.01 && Math.abs(w.D - w0.D) < 0.01;
  const sideAt = (u, sv, loose) => {
    if (Math.abs(u) > w0.W - 1) return null;
    if (upper && Math.abs(Math.abs(u) - (w0.W - 1)) > 0.01 && Math.abs(u) > w0.W - 5 + 0.01) return null;
    const x = w0.cx + u, z = w0.cz + sv * (w0.D - 1);
    if (!cell(x, z) || nearDoor(x, z, loose ? 2.2 : 2.4)) return null;
    // nothing joins the wall behind it (a back wing, a cross wing), and the cells beside it are this wing's
    if (wings.some(w => w !== w0 && inside(w, x, z + sv * 2, 0.5))) return null;
    const by = dx => wings.some(w => w !== w0 && !(loose && runsOn(w)) && inside(w, x + dx, z, 0.2));
    // the last pass (loose) takes a wall cell with another wing's floor on one side: the hearth stands at the wall
    // beside the opening into that wing, its shaft out through whatever roof is over its cell; the wall bay next to a
    // door will do (2.2 m, as for an end hearth)
    if (loose ? by(2) && by(-2) : by(2) || by(-2)) return null;
    return { spot: 'side', sg: Math.sign(u) || sg, sv, u, x, z, corner: Math.abs(Math.abs(u) - (w0.W - 1)) < 0.01, loose: !!loose };
  };
  // the household's first choice, then the nearest others: the other wall at the same end, the end itself, and only
  // then the other end (a wing built on later can take the gable a hearth stood against)
  const us = hip ? [sg * (w0.W - 3), sg * (w0.W - 5)] : corner || spot0 === 'end' ? [sg * (w0.W - 1), sg * (w0.W - 3)] : [sg * (w0.W - 3), sg * (w0.W - 1)];
  const tries = spot0 === 'end'
    ? [() => endAt(sg), ...us.map(u => () => sideAt(u, sv0)), ...us.map(u => () => sideAt(u, -sv0)), () => endAt(-sg)]
    : [...us.map(u => () => sideAt(u, sv0)), ...us.map(u => () => sideAt(u, -sv0)), () => endAt(sg), ...us.map(u => () => sideAt(-u, sv0)), () => endAt(-sg)];
  // and last, any bay of the back wall (then the front), nearest the household's end first: wings at both ends (a U)
  // leave the middle of the back wall
  const bays = [];
  for (let u = -w0.W + 1; u <= w0.W - 1; u += 2) bays.push(u);
  bays.sort((a, c) => Math.abs(a - sg * w0.W) - Math.abs(c - sg * w0.W));
  tries.push(...bays.map(u => () => sideAt(u, sv0)), ...bays.map(u => () => sideAt(u, -sv0)));
  // then the same bays beside another wing's floor (s3 cross, T and U plans whose wings take every other wall cell)
  tries.push(...bays.map(u => () => sideAt(u, sv0, true)), ...bays.map(u => () => sideAt(u, -sv0, true)));
  for (const t of tries) { const h = t(); if (h) return { ...h, moved, movedHere }; }
  return { ...why('no free wall'), moved, movedHere };
}

// The chimney's footprint: the ridge caps within a metre of the vent (caps sit every 2 m from -maxU to maxU), the
// width of one cap across the ridge.
function flueRect(w, vent, maxU) {
  const uv = ridgeU(w, vent), us = [];
  for (let u = -maxU; u <= maxU + 0.01; u += 2) if (Math.abs(u - uv) < 1.01) us.push(u);
  if (!us.length) return null;
  const pts = us.map(u => toWorld(w, u, 0, 0)).map(([x, z]) => ({ x, z }));
  return rectOf(pts);
}

// Posts from a metre down in the ground up to height F: a 2 m post standing half in the ground, then 2 m and 1 m
// lengths. The game sets a design's lowest pivot on the ground, so posts set in the ground keep a raised house at the
// height it was drawn.
function posts(b, K, x, z, F, pole) {
  b.put(pole || K.pole, x, 0, z);
  for (let y = 1; y < F - 0.01;) { const h = F - y >= 2 ? 2 : 1; b.put(h === 2 ? (pole || K.pole) : K.pole1, x, y + h / 2, z); y += h; }
}

// A door piece in a 2 m wall bay whose middle is (x, z) at floor height y0, the wall turned 'yaw'. Uses the door's
// measured pivot, its turn against the wall and its side offset (pieces.js DOORS). Returns the opening's height.
function putDoor(b, name, x, y0, z, yaw) {
  const sp = P.doorSpec(name), a = (yaw + (sp.along === 'z' ? 90 : 0)) * Math.PI / 180;
  b.put(name, x - Math.cos(a) * sp.offset, y0 - sp.bottom, z + Math.sin(a) * sp.offset, yaw + (sp.along === 'z' ? 90 : 0));
  return sp.h;
}

// Where ladders go. Each ladder needs three 2 m cells in a row: its foot (clear floor below), the hole it climbs
// through, and a landing above. Cells along an outside wall come first, away from the door and the fire. The ladder
// to the next storey starts from the landing of the one before when it can (round a tower's walls). n ladders; fewer
// when the plan has no room.
function ladderPlan(cells, n, o = {}) {
  const has = (x, z) => cells.has(`${x},${z}`);
  const same = (a, c) => a && c && a[0] === c[0] && a[1] === c[1];
  const near = (a, c, r) => a && c && Math.abs(a[0] - c[0]) <= r && Math.abs(a[1] - c[1]) <= r;
  const all = [];
  for (const [, [x, z]] of cells) for (const [dx, dz] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
    const stand = [x - 2 * dx, z - 2 * dz], land = [x + 2 * dx, z + 2 * dz];
    if (!has(...stand) || !has(...land)) continue;
    // a climb of more than 3 m runs on into the cell before the stand (2 m along for every 2 m up): that cell is floor
    if (o.rise > 3.01 && !has(x - 4 * dx, z - 4 * dz)) continue;
    if (o.flue && [stand, [x, z], land].some(c => inRect(o.flue, c[0], c[1]))) continue;
    const wallSide = !has(x + 2 * dz, z + 2 * dx) || !has(x - 2 * dz, z - 2 * dx);
    all.push({ hole: [x, z], dir: [dx, dz], stand, land, wallSide });
  }
  const out = [];
  for (let k = 0; k < n; k++) {
    const prev = out[k - 1];
    let best = null, bestScore = -Infinity;
    for (const L of all) {
      if (prev && (same(L.hole, prev.hole) || same(L.stand, prev.hole) || same(L.land, prev.hole))) continue;
      if (k === 0 && [o.door, o.back].some(d => d && (near(L.stand, d, 0) || near(L.hole, d, 0)))) continue;
      let score = (L.wallSide ? 10 : 0);
      if (o.ring && [L.stand, L.hole, L.land].some(c => inRect(o.ring, c[0], c[1], 1.1))) score -= 12;
      if (prev && same(L.stand, prev.land)) score += 30;
      if (k === 0 && o.door) score += Math.min(8, Math.hypot(L.hole[0] - o.door[0], L.hole[1] - o.door[1]));
      if (score > bestScore + 1e-9) { best = L; bestScore = score; }
    }
    if (!best) break;
    out.push(best);
  }
  return out;
}

// A hall's loft (styles.js LOFT.hall): over one end of the main wing, open to the hall, its fire and the roof. The
// end is the one the climb already reaches; when the climb lands in the open part, a ladder is planned again inside
// the loft's footprint. Returns { cells, x0, x1, sg, xEdge } or null (the hall keeps its full upper floor).
function hallLoft(o) {
  const L = S.LOFT && S.LOFT.hall;
  const { w0, cells, ladders, flue } = o;
  if (!L || !L.types.includes(o.type) || !L.stages.includes(o.stage) || o.storeys !== 2 || o.flat || o.form || !['gable', 'hip'].includes(o.roofKind) ||
    ['gables', 'court', 'octagon'].includes(o.plan) || w0.alpha !== 0 || w0.W < 5 || !ladders[0]) return null;
  const cols = Math.max(2, Math.round(w0.W * L.part)); // 2 m columns along the hall
  const make = sg => {
    const xEdge = w0.cx + sg * (w0.W - 2 * cols); // the loft's open edge
    const inL = x => sg * (x - xEdge) > 0;
    const lc = new Map([...cells].filter(([, [x, z]]) => inside(w0, x, z) && inL(x)));
    const keep = [flue, o.stackKeep].filter(Boolean);
    if ([...lc.values()].some(([x, z]) => keep.some(r => inRect(r, x, z, 1)))) return null; // the fire stays open to the roof
    return { cells: lc, sg, xEdge, x0: sg > 0 ? xEdge : w0.cx - w0.W, x1: sg > 0 ? w0.cx + w0.W : xEdge };
  };
  const land = ladders[0].land, sgLand = Math.sign(land[0] - w0.cx) || o.side || 1;
  for (const sg of [sgLand, -sgLand]) {
    const lo = make(sg);
    if (!lo) continue;
    if (lo.cells.has(`${land[0]},${land[1]}`)) return lo;
    // a ladder inside the loft's footprint: foot, hole and landing under the loft
    const g = new Map([...o.cellsG].filter(([k]) => lo.cells.has(k)));
    const lad = ladderPlan(g, 1, { door: o.doorCell, back: o.backCell, flue: o.stackKeep || flue });
    if (lad.length) { ladders[0] = lad[0]; return lo; }
  }
  return null;
}
// The rail along a loft's open edges (fence pieces, or half walls in a kit without a fence): wherever a loft cell
// meets a cell of the building with no loft floor, with a gap where the climb comes up.
function loftRail(b, K, lo, up, y0, cells) {
  const climb = up ? (up.run || [up.hole]) : [];
  for (const [, [x, z]] of lo.cells) for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
    const nx = x + dx, nz = z + dz, k = `${nx},${nz}`;
    if (lo.cells.has(k) || !cells.has(k)) continue;
    if (climb.some(c => (c[0] === nx && c[1] === nz) || (c[0] === x && c[1] === z))) continue;
    const ex = x + dx / 2, ez = z + dz / 2, yaw = dx ? 90 : 0;
    railing(b, K, ex, y0, ez, yaw);
  }
}

// A rail along a 2 m edge of a raised floor or a stair well, its middle at (x, z) on the floor at y0, turned yaw (the
// edge along the piece's local x): a 1 m post at each end and a beam on them at 1 m. Corpus builders rail their
// balconies, galleries and towers with posts and beams (the pieces on open edges of floors 1.2 m or more over the
// ground, by builds: wood_beam 747, wood_pole 593, wood_pole2 547, wood_wall_half 537, wood_beam_1 504, wood_fence in
// none of the top 40; lab/shell_mine.js). Tyler (showcase review, 2026-11-11): wood_fence is "really only intended for
// pastures, garden fences, maybe village perimeter fencing. Never for building fences atop towers, etc. and certainly
// never indoors."
function railing(b, K, x, y0, z, yaw, extra) {
  const a = yaw * Math.PI / 180, ux = Math.cos(a), uz = -Math.sin(a), post = K.pole1 || 'wood_pole', beam = K.beam || 'wood_beam';
  // a post stands on the floor: an end past the floor's edge moves in along the rail (lofts of 1 m pieces)
  const Ck = checksLib();
  const onFloor = (px, pz) => b.pieces.some(p => !p.decor && P.piece(p.name).role === 'floor' && (c => px > c.x0 - 0.05 && px < c.x1 + 0.05 && pz > c.z0 - 0.05 && pz < c.z1 + 0.05 && Math.abs(c.y1 - y0) < 0.35)(Ck.catBox(p)));
  let n = 0;
  for (const sg of [-1, 1]) {
    const t = [1, 0.8, 0.6, 0.4].find(k => onFloor(x + ux * sg * k, z + uz * sg * k));
    if (t != null) { b.put(post, x + ux * sg * t, y0 + 0.5, z + uz * sg * t, 0, extra); n++; }
  }
  // (a beam with no post under it would stand on nothing: a post at its middle, or no rail there)
  if (!n && onFloor(x, z)) { b.put(post, x, y0 + 0.5, z, 0, extra); n++; }
  if (n) b.put(beam, x, y0 + 1.0, z, yaw, extra);
}

// Ladder pieces for one plan entry, from the floor at yLow up 'rise' metres. A wood_stepladder climbs 2 m over 2 m
// from its pivot at its foot. The foot stands at the near edge of the hole, so the cell before it is all clear floor;
// for a 3 m storey the climb ends in the middle of the landing cell, whose near half stays open and whose far half
// gets two 1 m floor pieces (cutLanding).
function ladderFoot(rise) { return Math.min(-1, 2 - rise); }
function putLadder(b, K, L, yLow, rise) {
  const [dx, dz] = L.dir, yaw = norm(Math.atan2(-dx, -dz) * 180 / Math.PI), f = ladderFoot(rise);
  const ks = [];
  for (let k = 0; k < rise - 2 + 0.001; k += 2) ks.push(k);
  if (!ks.length || Math.abs(ks[ks.length - 1] - (rise - 2)) > 0.01) ks.push(Math.max(0, rise - 2));
  for (const k of ks) {
    const t = f + 1 + k; // the piece's middle, metres from the hole's middle toward the landing
    b.put(K.ladder, L.hole[0] + dx * t, yLow + k, L.hole[1] + dz * t, yaw);
  }
  if (cutLanding(rise)) {
    // the far half of the landing cell
    const [lx, lz] = L.land, px = -dz, pz = dx;
    for (const s of [-0.5, 0.5]) b.put(K.floor1 || 'wood_floor_1x1', lx + dx * 0.5 + px * s, yLow + rise, lz + dz * 0.5 + pz * s);
  }
}
const cutLanding = rise => ladderFoot(rise) + rise > 1.01;
// cells a floor leaves out for a ladder: the hole, and the landing cell when its near half is open
const onLadder = (L, x, z, rise) => !!L && (L.run ? L.run.some(c => c[0] === x && c[1] === z)
  : ((x === L.hole[0] && z === L.hole[1]) || (cutLanding(rise) && x === L.land[0] && z === L.land[1])));

// Where a straight stair goes: a 2 m wide flight of n wood_stair pieces (each climbs 1 m over 2 m) along a wall, a clear
// cell at its foot and a landing cell at its top; the floor above is open over the whole flight (head room). Returns a
// plan entry like a ladder's, with run: the flight's cells, or null.
function stairPlan(cells, n, o = {}) {
  const has = (x, z) => cells.has(`${x},${z}`);
  const near = (a, c) => a && c && a[0] === c[0] && a[1] === c[1];
  let best = null, bestScore = -Infinity;
  for (const [, [x, z]] of cells) for (const [dx, dz] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
    const stand = [x - 2 * dx, z - 2 * dz], run = [], land = [x + 2 * n * dx, z + 2 * n * dz];
    for (let k = 0; k < n; k++) run.push([x + 2 * k * dx, z + 2 * k * dz]);
    const all = [stand, ...run, land];
    if (!all.every(c => has(...c))) continue;
    if (o.flue && all.some(c => inRect(o.flue, c[0], c[1], 1.6))) continue; // the fire and its ring stay clear of the flight
    if ([o.door, o.back].some(d => d && all.slice(0, -1).some(c => near(c, d)))) continue;
    // a wall along one whole side of the flight
    const side = [1, -1].find(sg => run.every(([cx, cz]) => !has(cx + sg * 2 * dz, cz + sg * 2 * dx)));
    if (side == null) continue;
    // the foot near the door is handy; a flight along the back wall keeps the front room open
    const score = (o.door ? -0.3 * Math.hypot(stand[0] - o.door[0], stand[1] - o.door[1]) : 0) + (o.door && Math.abs(run[0][1] - o.door[1]) > 3 ? 2 : 0);
    if (score > bestScore) { bestScore = score; best = { hole: run[0], run, stand, land, dir: [dx, dz], wallSide: true, stair: true, side }; }
  }
  return best;
}
function putStairRun(b, K, L, yLow) {
  const [dx, dz] = L.dir, yaw = norm(Math.atan2(-dx, -dz) * 180 / Math.PI);
  L.run.forEach(([x, z], k) => b.put(K.stair || 'wood_stair', x, yLow + k, z, yaw));
}

// ---------------------------------------------------------------- wide doors (ideas gap 10)

// 42 % of the corpus's kept door motifs are 4 m wide (two doors or a gate pair; data/motifs.json, 148 uses). Halls,
// taverns and temples take a wide entrance at that share, and homes at s3 with a front of 8 m or more; barns keep
// their own gates (T.bigDoor). The second leaf goes in the bay beside the door toward the middle of the wall, where
// the wall runs on past it.
const WIDE_DOOR = 0.42;
function wideDoor(o) {
  const { type, stage, T, form, plan, door, gEdges, wing, seed, cultureKey, req, F } = o;
  if (req.details && req.details.wideDoor === false) return null;
  if (F > 0.3) return null; // the entry stair or steps of a raised floor serve the main door only
  if (!door || T.bigDoor || T.tower || T.open || form === 'sunken' || ['round', 'tent', 'yurt', 'dome', 'drum', 'court', 'gables'].includes(form || plan)) return null;
  const big = ['longhouse', 'tavern', 'temple'].includes(type) || (type === 'home' && stage === 's3' && wing && wing.alpha === 0 && wing.W >= 4);
  if (!big || door.yaw !== 0) return null;
  let h = 2166136261;
  for (const ch of `${cultureKey}|${type}|${seed}|wide door`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  if (!(req.details && req.details.wideDoor === true) && rng(h >>> 0)() >= WIDE_DOOR) return null;
  const along = (e, d) => gEdges.find(q => q.yaw === e.yaw && q.out[0] === e.out[0] && q.out[1] === e.out[1] && Math.abs(q.x - (e.x + d)) < 0.01 && Math.abs(q.z - e.z) < 0.01);
  const sides = [-2, 2].sort((a, c) => Math.abs(door.x + a - wing.cx) - Math.abs(door.x + c - wing.cx));
  for (const d of sides) { const q = along(door, d); if (q && along(q, d)) return q; }
  return null;
}

// ---------------------------------------------------------------- eaves (ideas gap 7, D-150)

// One draw per building (the same for every wing), from the details' hash so the rest of the design draws as before:
// a deep eave at DEEP_EAVE where its edge clears 2.3 m (26 % of the corpus's kept eave motifs reach 1.75 m past the
// wall, data/motifs.json; about a third of s2 and s3 halls, taverns and homes have walls tall enough, so the draw is
// higher than the share), a
// rake a metre past the gable at RAKE_OUT (corpus gable motifs: 20 % at 1 m, 5 % at 0.5 to 0.75 m, 73 % flush).
const DEEP_EAVE = 0.6, RAKE_OUT = 0.25;
function eaveDraw(dctx) {
  if (dctx.eaveDrawn) return dctx.eaveDrawn;
  const R = rng(((dctx.profile && dctx.profile.hash) || 1) ^ 0x5eaf00d);
  const deep = R() < (dctx.profile && dctx.profile.deepEave != null ? +dctx.profile.deepEave : DEEP_EAVE);
  // a balcony keeps its rake: the balcony and its door are laid out under a rake a metre out (a flush rake left the
  // balcony door blocked, home Black Forest norse-forest s2 seed 15)
  const rake = R() < (dctx.profile && dctx.profile.rakeOut != null ? +dctx.profile.rakeOut : RAKE_OUT) || !!(dctx.profile && dctx.profile.balcony);
  return (dctx.eaveDrawn = { deep, rake });
}

// ---------------------------------------------------------------- window kit (ideas gap 3, D-151)

// What fills a window's light, by culture group: the builds of the group with a light of that kind set in a wall
// (a piece with wall in its plane on both sides and under it), counted on the corpus with the culture members of
// data/culture-corpus/members.json (2026-11-11, docs/handoffs/2026-11-10-design/windows.md). Open is the builds
// with none of these kinds. glass: crystal_wall_1x1; bars: iron_wall_1x1 and 2x2 (and iron_grate); mesh: the Dvergr
// metal wall (piece_dvergr_metal_wall_2x2); arch: stone_arch and darkwood_arch; shutter: wood_window.
// Tyler (2026-11-11, through the lead): "Not mandatory, perhaps only some cultures. Other can use shutters, iron 1x1
// or 2x2 gates as windows, the dveger copper mesh things too, etc etc depending on culture... don't force glass
// windows." D-151: glass is a building piece (D-125), so it comes in from the Swamp on (the Mountain is its neighbor).
const WINDOW_FILL = {
  norse: { n: 112, glass: 26, bars: 49, mesh: 19, arch: 22, shutter: 14, open: 47 },
  'norse-forest': { n: 42, glass: 4, bars: 8, mesh: 4, arch: 6, shutter: 3, open: 29 },
  'norse-highland': { n: 19, glass: 2, bars: 2, mesh: 1, arch: 6, shutter: 1, open: 11 },
  'medieval-timber': { n: 28, glass: 11, bars: 6, mesh: 4, arch: 11, shutter: 3, open: 9 },
  castle: { n: 61, glass: 10, bars: 24, mesh: 7, arch: 16, shutter: 3, open: 27 },
  'fen-folk': { n: 13, glass: 1, bars: 4, mesh: 2, arch: 2, shutter: 3, open: 8 },
  all: { n: 1416, glass: 213, bars: 258, mesh: 124, arch: 177, shutter: 76, open: 867 },
};
// Generator culture to its corpus group (10 builds or more); smaller groups take all builds, with glass only where
// the culture's own builds show it (celtic 0 of 5, saami 0 of 2, steppe and middle-eastern 0 of 1; crannog 1 of 5).
const WINDOW_GROUP = { norse: 'norse', 'anglo-saxon': 'norse', 'norse-forest': 'norse-forest', slavic: 'norse-forest', baltic: 'norse-forest',
  'norse-highland': 'norse-highland', lamari: 'norse-highland', 'frankish-norman': 'medieval-timber', 'castle-medieval': 'castle',
  byzantine: 'castle', 'fen-folk': 'fen-folk' };
const NO_GLASS = ['celtic', 'saami', 'steppe', 'middle-eastern'];
// The light's size, from the kept window motifs of data/motifs.json (2,008 uses): 1 m wide and 1 m tall 83 % (0.5 m
// slits counted here), 2 m wide 5.5 %, 1 x 2 m 4.2 %, 2 x 2 m 5.8 % (1.5 to 4 m wide, 2 m tall).
const WINDOW_SIZE = [['single', 1666], ['twin', 110], ['tall', 84], ['big', 116]];
function windowKit(cultureKey, biome, type, seed, SH) {
  let h = 2166136261;
  for (const ch of `${cultureKey}|${type}|${seed}|windows`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const R = rng(h >>> 0);
  const reach = n => P.BIOME_ORDER.indexOf(P.needs(n)) <= P.BIOME_ORDER.indexOf(P.buildReach(biome || 'Meadows'));
  const g = WINDOW_FILL[WINDOW_GROUP[cultureKey] || 'all'];
  const ok = { glass: reach('crystal_wall_1x1') && !NO_GLASS.includes(cultureKey), bars: reach('iron_wall_1x1'), mesh: reach('piece_dvergr_metal_wall_2x2'), arch: true, shutter: true, open: true };
  const fills = Object.keys(ok).filter(k => ok[k] && g[k] > 0).map(k => [k, g[k]]);
  const pickK = list => { const t = list.reduce((s, x) => s + x[1], 0); let x = R() * t; for (const [k, w] of list) { x -= w; if (x <= 0) return k; } return list[list.length - 1][0]; };
  const fill = pickK(fills);
  let size = pickK(WINDOW_SIZE);
  if (fill === 'mesh') size = 'big'; // the Dvergr metal wall is a 2 x 2 panel
  if (SH < 3 && (size === 'tall' || size === 'big')) size = size === 'big' ? 'twin' : 'single'; // a 2 m light needs a 3 m storey
  if (fill === 'mesh' && size !== 'big') return { size, fill: 'open' };
  return { size, fill };
}
// A wall line whose bays between the window bays take a window too, at this share (WINDOW_EXTRA), drawn per line from
// the building's seed so every storey of the wall keeps one rhythm (D-167), and the walls come nearer the corpus count
// of windows per plain bay (ideas gap 3).
const WINDOW_EXTRA = 0.45;
function windowExtra(C, seed, line) {
  // (only 1 m lights, each with a 1 m wall piece in its bay: 2 m and tall lights side by side left no wall 2.5 m up
  // within 1.6 m, which the headroom check refuses, Norse Meadows pool home s3 seed 101)
  if (!C.winKit || C.winKit.size !== 'single') return false;
  let h = 2166136261;
  for (const ch of `${seed}|${line}|rhythm`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return rng(h >>> 0)() < WINDOW_EXTRA;
}
// the pieces that fill one light: its middle along the wall (x, z), its foot y, width and height, the wall's yaw
function fillLight(b, kit, x, y, z, yaw, w, h) {
  if (!kit || kit.fill === 'open' || kit.fill === 'arch') return;
  const ux = Math.cos(yaw * Math.PI / 180), uz = -Math.sin(yaw * Math.PI / 180);
  const cells = [];
  for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) cells.push([(i - (w - 1) / 2), j]);
  const tag = { winFill: kit.fill };
  if (kit.fill === 'glass') for (const [a, j] of cells) b.put('crystal_wall_1x1', x + ux * a, y + j + 0.5, z + uz * a, yaw, tag);
  else if (kit.fill === 'mesh') { if (w === 2 && h === 2) b.put('piece_dvergr_metal_wall_2x2', x, y + 1, z, yaw, tag); } // a 2 x 2 panel: other lights stay open
  else if (kit.fill === 'bars') {
    if (w === 2 && h === 2) b.put('iron_wall_2x2', x, y + 1, z, yaw, tag);
    else for (const [a, j] of cells) b.put('iron_wall_1x1', x + ux * a, y + j + 0.5, z + uz * a, yaw, tag);
  } else if (kit.fill === 'shutter' && kit.closed) {
    // a closed Wood Shutter in each 1 m cell (its leaf runs 1 m to the -x side of its hinge)
    for (const [a, j] of cells) b.put('wood_window', x + ux * (a + 0.5), y + j + 0.5, z + uz * (a + 0.5), yaw, tag);
  }
}

// ---------------------------------------------------------------- walls

// Dark wood takes tar, so dark frames start in the Plains.
function framePole(K, C) { return C.darkFrame && reaches(C.biome || 'Meadows', 'Plains') ? 'darkwood_pole' : (K.pole || 'wood_pole2'); }

// Door piece: a hanging cloth door where the culture uses one and red jute is in reach (Mountain on), else the wooden
// door. A door must fit the wall: the cloth door and the wooden door fill a 2 m opening; never a gate taller than the
// wall (the dark wood gate is 4 m).
function doorPiece(K, C, SH) {
  const cloth = (C.clothDoor || C.arches) && reaches(C.biome || 'Meadows', 'Mountain') ? 'piece_cloth_hanging_door' : null;
  if (cloth && P.doorSpec(cloth).h <= SH + 0.01) return cloth;
  return P.doorSpec(K.door).h <= SH + 0.01 ? K.door : 'wood_door';
}

// One 2 m wall bay. Wall styles: plank, half-timber (plank with a 45 degree brace across the bay), log,
// stone, stone-base (a metre of stone, then plank), marble, grausten.
function wallSegment(b, K, C, x, y0, z, yaw, SH, kind, styleOverride) {
  const plank = K.floor === 'ashwood_floor_2x2' ? 'ashwood_wall_2x2' : 'woodwall';
  const stonePiece = K.stoneWall || 'stone_wall_2x1';
  // Stone cannot span an opening in Valheim (it loses all its support sideways) and takes no support from wood, so
  // over a door or window in a stone wall, and in that bay all the way up, the wall is of planks (a timber lintel).
  // Black marble and grausten can span one bay and stay.
  const bay = `${Math.round(x * 10)},${Math.round(z * 10)}`;
  b.woodBays = b.woodBays || new Set();
  const noSpan = P.support(stonePiece).h >= 0.99;
  let style = styleOverride || C.wallStyle || 'plank';
  // (and a bay a 2 m course family left in timber, or that has timber under it, stays timber up: masonry takes no
  // support from wood)
  if ((noSpan || /2x2/.test(stonePiece)) && ['stone', 'marble', 'grausten'].includes(style) && b.woodBays.has(bay)) style = 'plank';
  const stoneLike = ['stone', 'marble', 'grausten'].includes(style);
  // over an opening: planks where the stone cannot span it (stone), or where the metre left over would be a stone
  // course (2 m grausten courses leave a 1 m gap); a stone that cannot span also takes the bay above to planks
  const lintel = () => {
    if (!stoneLike) return;
    if (noSpan || stoneCourse === 2) b.woodBays.add(bay);
    if (noSpan || stoneCourse === 2) style = 'plank';
  };
  const stoneCourse = /2x2/.test(stonePiece) ? 2 : 1;
  const pieceFor = y => {
    if (style === 'stone' || style === 'marble' || style === 'grausten') return [stonePiece, stoneCourse];
    // the stone course is the ground storey's footing only; upper storeys are all planks (stone on planks would fall)
    // (a family of 2 m courses lays a 2 m footing course of its own: grausten has no 1 m course, and stone between
    // grausten read wrong, Tyler on showcases 15 and 16: "Stone is chunky and light gray. Grausten is smooth and dark gray
    // and half the width")
    if (style === 'stone-base' && y < y0 + stoneCourse - 0.01 && y0 <= (C.baseTop != null ? C.baseTop : Infinity)) return [stonePiece, stoneCourse];
    if (style === 'log') return ['wood_wall_log', 0.5];
    return [plank, 2];
  };
  const fill = (from, to) => {
    let y = from;
    while (to - y > 0.01) {
      const left = to - y;
      const [main, course] = pieceFor(y);
      if (course <= left + 0.01) { b.put(main, x, y + course / 2, z, yaw); y += course; }
      // a metre left in a wall of 2 m courses is the wall's own timber, never another family's stone: the bay is
      // timber from there up, as over an opening)
      else if (left >= 0.99 && main !== 'wood_wall_log') { if (course !== 1 && main === stonePiece) { b.put(K.wallHalf, x, y + 0.5, z, yaw); b.woodBays.add(bay); } else b.put(course === 1 ? main : K.wallHalf, x, y + 0.5, z, yaw); y += 1; }
      else { if (main === 'wood_wall_log') b.put(main, x, y + 0.25, z, yaw); else b.put(K.wallHalf, x, y + 0.5, z, yaw); y += 0.5; } // a half wall standing on the gap pokes 0.5 m up into the roof
    }
  };
  if (kind === 'door' || kind === 'gate') {
    let name = kind === 'gate' ? (K.gate || K.door) : doorPiece(K, C, SH);
    if (P.doorSpec(name).h > SH + 0.01) name = doorPiece(K, C, SH);
    const h = putDoor(b, name, x, y0, z, b.flipDoor ? yaw + 180 : yaw);
    lintel();
    fill(y0 + h, y0 + SH); return;
  }
  if (kind === 'window' && SH >= 2 && C.winKit) {
    // the window kit (windowKit): a 1 m light on the side toward the middle of the wall with a 1 m wall piece in the
    // other half, a 2 m light, or either of them 2 m tall; the light filled by the kit (fillLight)
    const kit = C.winKit, ux = Math.cos(yaw * Math.PI / 180), uz = -Math.sin(yaw * Math.PI / 180);
    const block = stoneLike ? (/^(stone_wall_1x1|blackmarble_1x1)$/.test(K.stoneBlock || '') ? K.stoneBlock : null) : K.wallQuarter;
    const tall = (kit.size === 'tall' || kit.size === 'big') && SH >= 3 && !b.lightLow && !/stone|marble|grausten/.test(style), // (stone beside a 2 m tall light fell, home Plains byzantine s2 seed 24)
      lw = (kit.size === 'single' || kit.size === 'tall') && block ? 1 : 2, lh = tall ? 2 : 1;
    fill(y0, y0 + 1);
    let lx = x, lz = z;
    if (lw === 1) {
      const side = (x * ux + z * uz) > 0 ? 1 : -1;
      for (let j = 0; j < lh; j++) b.put(block, x + ux * side * 0.5, y0 + 1.5 + j, z + uz * side * 0.5, yaw);
      lx = x - ux * side * 0.5; lz = z - uz * side * 0.5;
    }
    fillLight(b, kit, lx, y0 + 1, lz, yaw, lw, lh);
    b.lastLight = { x: lx, z: lz, w: lw, h: lh, fill: kit.fill === 'mesh' && !(lw === 2 && lh === 2) ? 'open' : kit.fill, block: lw === 1 ? block : null };
    lintel();
    fill(y0 + 1 + lh, y0 + SH); return;
  }
  if (kind === 'window' && SH >= 2) {
    fill(y0, y0 + 1);
    if (K.glass && C.glass) { const dx = Math.cos(yaw * Math.PI / 180) * 0.5, dz = -Math.sin(yaw * Math.PI / 180) * 0.5; b.put(K.glass, x - dx, y0 + 1.5, z - dz, yaw); b.put(K.glass, x + dx, y0 + 1.5, z + dz, yaw); }
    else if (!C.arches && !C.stoneWalls && C.windowStyle === 'single' && K.wallQuarter && !stoneLike) {
      // the light on the side toward the middle of the wall, the 1 m square wall piece in the other half
      const ux = Math.cos(yaw * Math.PI / 180), uz = -Math.sin(yaw * Math.PI / 180), side = (x * ux + z * uz) > 0 ? 1 : -1;
      b.put(K.wallQuarter, x + ux * side * 0.5, y0 + 1.5, z + uz * side * 0.5, yaw);
    }
    lintel();
    fill(y0 + 2, y0 + SH); return;
  }
  fill(y0, y0 + SH);
  if (style === 'half-timber' && SH >= 2 && (!b.braceBay || b.braceBay(x, z, yaw))) {
    const brace = (C.darkFrame && reaches(C.biome || 'Meadows', 'Plains')) || /darkwood/.test(K.beam || '') ? 'darkwood_beam_45' : 'wood_beam_45';
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
// Stone (measured in the corpus): a block, a 2 m pillar on it, an arch of two half-arch pieces between pillars 3 m
// apart, its top level with the pillar tops; the run is centred on its side of the yard.
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
      // the stone arch piece is half an arch (piece models: full height at its local +x end, a thin top across to -x):
      // two of them back to back span a gap, their feet set into the pillar tops
      for (let k = 0; k < n; k++) for (const sd of [-1, 1]) { const [x, z] = at(r, start + 3 * k + 1.5 + sd); b.put(K.stoneArch || 'stone_arch', x, y0 + SH - 0.5, z, ((r.yaw === 0 ? 0 : 270) + (sd < 0 ? 180 : 0)) % 360, { clip: 0.4 }); } // local +x along +t: yaw 0 on x runs, 270 on z runs
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

// Roof valleys (coverage audit: inner corner pieces on 38 % of the best-liked builds, none of ours). Where two wings'
// roof pieces of the same kind fill the same 2 m cell at the same height with their slopes at right angles, the cell is
// on the valley line (the roof there is the higher of the two slopes, highest along the diagonal away from the low
// corner): one inner corner piece takes the place of both. Snap points (data/piece-models.json): the inner corner's low
// corner is at local (+1, +1) with its pivot there, its slopes rise toward local -x and -z; a roof piece rises toward
// its local -z, the 45 degree piece pivoting a metre above its low edge.
const ICORNER = { wood_roof: 'wood_roof_icorner', wood_roof_45: 'wood_roof_icorner_45', darkwood_roof: 'darkwood_roof_icorner', darkwood_roof_45: 'darkwood_roof_icorner_45' };
function valleys(parts, b) {
  const cellsR = new Map();
  for (const p of parts) {
    if (p.role !== 'roof' || p.eave || !ICORNER[p.name]) continue; // eave rows half a cell out cross on the wall lines, not on the valley
    const k = `${Math.round(p.x * 10)},${Math.round(p.z * 10)},${Math.round(p.y * 10)}`;
    if (!cellsR.has(k)) cellsR.set(k, []);
    cellsR.get(k).push(p);
  }
  const up = p => { const a = p.yaw * Math.PI / 180; return [-Math.sin(a), -Math.cos(a)]; };
  let n = 0;
  for (const list of cellsR.values()) {
    if (list.length !== 2) continue;
    const [A, B] = list;
    if (A.wing === B.wing || A.name !== B.name) continue;
    const dA = up(A), dB = up(B);
    if (Math.abs(dA[0] * dB[0] + dA[1] * dB[1]) > 0.1) continue;
    let yaw = null;
    for (const [d1, d2] of [[dA, dB], [dB, dA]]) {
      const y = Math.atan2(-d1[0], -d1[1]), mx = [-Math.cos(y), Math.sin(y)];
      if (Math.abs(mx[0] - d2[0]) < 0.1 && Math.abs(mx[1] - d2[1]) < 0.1) { yaw = ((Math.round(y * 180 / Math.PI) % 360) + 360) % 360; break; }
    }
    if (yaw == null) continue;
    const name = ICORNER[A.name], y = /_45$/.test(A.name) ? A.y - 1 : A.y;
    Object.assign(A, { name, y, yaw, valley: true });
    B.role = 'gone';
    n++;
  }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].role === 'gone') parts.splice(i, 1);
  if (n) b.notes.push(`${n} roof valley pieces where wings meet.`);
  return n;
}

const CAP_GAP = 0.5;
function gablePieces(K, C, w, top, r, ends, vent, dctx) {
  const roof = r === 2 ? K.roof45 : K.roof26, roofTop = r === 2 ? K.roofTop45 : K.roofTop26, gable = r === 2 ? K.gable45 : K.gable26;
  const capY = capOf(w, top, r), low = i => capY - r * (i + 1), pivot = i => low(i) + (r === 2 ? 1 : 0);
  // the last row ends on the wall (Tyler, T-102: roofs stuck out too far); only cultures with eaves 2 (fen houses,
  // sunken huts) carry a row past the wall down toward the ground
  const wallRow = (w.D - 3) / 2, rows = wallRow + ((C.eaves || 1) > 1 ? 1 : 0);
  const out = [], add = (name, u, y, v, yaw, role, surf) => { const [x, z, wy] = toWorld(w, u, v, yaw); out.push({ name, x, y, z, yaw: wy, role, surf, wing: w }); };
  const kick = C.kick && r === 2 && (C.eaves || 1) > 1;
  for (let u = -w.W + 1; u < w.W; u += 2) {
    for (let i = 0; i <= rows; i++) {
      const v = 2 + 2 * i, surf = low(i) + r / 2;
      if (kick && i === rows) { const y = low(i - 1) - 1; add(K.roof26, u, y, -v, 180, 'roof', y + 0.5); add(K.roof26, u, y, v, 0, 'roof', y + 0.5); continue; }
      add(roof, u, pivot(i), -v, 180, 'roof', surf); add(roof, u, pivot(i), v, 0, 'roof', surf);
    }
    add(roofTop, u, capY, 0, 0, 'cap', capY + 0.3);
    if (vent && Math.abs(u - ridgeU(w, vent)) < 1.01) out[out.length - 1].vent = true;
  }
  [-1, 1].forEach((sg, k) => {
    if (!ends[k]) return;
    const u = sg * w.W;
    // a window high in a tall gable lights the loft (a 2 m opening with a post in the middle, 1 m up the gable)
    const gw = dctx && dctx.profile.gableWindow && !C.stoneWalls && capY - top >= 3.9;
    if (gw) {
      // one clear 2 m light (the post in the middle made two slits), a third of the way up a tall gable, framed
      const yw = capY - top >= 5.9 ? top + 2 : top + 1;
      gableFill(K, add, u, top, 0, yw - top, C.stoneWalls);
      for (const yb of [yw - 0.1, yw + 1.1]) add(K.beam || 'wood_beam', u + Math.sign(u) * 0.25, yb, 0, 90, 'trim', yb + 0.1);
      gableFill(K, add, u, yw + 1, 0, capY - yw - 1, C.stoneWalls);
    } else gableFill(K, add, u, top, 0, capY - top, C.stoneWalls);
    // a 1 m square piece on the apex, up into the ridge cap: the cap's underside stands well over its
    // pivot at the ridge (0.86 m at a 45 degree cap's middle), and a gable filled only to the apex left a triangle of sky
    // under every cap (the gaps at the wall tops of showcases 03 and 15); a metre wide, its corners stay in the cap's
    // boards
    add(K.wallQuarter || K.wallHalf, u, capY + 0.2, 0, 90, 'gable', capY + 0.2 + CAP_GAP);
    for (let i = 0; i <= wallRow; i++) for (const sv of [-1, 1]) {
      const v = sv * (2 + 2 * i);
      gableFill(K, add, u, top, v, low(i) - top, C.stoneWalls);
      add(gable, u, low(i), v, sv < 0 ? 270 : 90, 'gable', low(i) + r);
    }
  });
  // overhangs (Tyler, D-059 B, 2026-11-09; T-102 had them off): one more row half a row further out along the long
  // walls, so the eaves stand 1 m past the wall, and one more column at each free gable end, so the rake stands 1 m
  // past the gable. The new pieces overlap the old ones by a metre, the way builders half-snap roofs.
  // D-150 (lead's call A, Tyler no preference): deeper eaves on about a quarter of roofs, a whole row past the wall
  // (the roof's edge 2 m past the wall's middle, 1.75 m past its face, as 26 % of the corpus's kept eave motifs),
  // where that edge stays 2.3 m over the ground; gable rakes mostly flush (73 % of corpus gables, 20 % a metre out)
  const over = dctx && dctx.profile.overhang !== false && !kick && (C.eaves || 1) <= 1;
  const ed = dctx ? eaveDraw(dctx) : { deep: false, rake: true };
  const eaveOK = low(wallRow) - r / 2 >= 2.3, deep = over && ed.deep && low(wallRow) - r >= 2.3;
  if (over) {
    const vE = 2 + 2 * wallRow + 1, yE = pivot(wallRow) - r / 2, surfE = low(wallRow) + r / 2 - r / 2;
    const cols = [];
    for (let u = -w.W + 1; u < w.W; u += 2) cols.push(u);
    const rakeCols = ed.rake ? [-1, 1].filter((sg, k) => ends[k]).map(sg => sg * w.W) : [];
    const n0 = out.length;
    // the eave row only where its edge stays 2.3 m over the ground (r5 review: eaves at 1 to 1.5 m on 2 m walls under
    // a 45 degree roof made houses read as tents)
    // a side whose deep eave would reach toward another wing (an inside corner) keeps the 1 m eave: the deep row over
    // the ground there read as a low room to the headroom check (Norse Meadows pool, home s3 seed 101)
    const open = sv => !(dctx.wings || []).some(o => o !== w && [...cols, ...rakeCols].some(u => { const [x, z] = toWorld(w, u, sv * (w.D + 2.5), 0); return inside(o, x, z, 0.5); }));
    for (const sv of [-1, 1]) {
      const yaw = sv < 0 ? 180 : 0;
      if (deep && open(sv)) { const i = wallRow + 1, v = 2 + 2 * i; for (const u of [...cols, ...rakeCols]) add(roof, u, pivot(i), sv * v, yaw, 'roof', low(i) + r / 2); }
      else if (eaveOK) for (const u of [...cols, ...rakeCols]) add(roof, u, yE, sv * vE, yaw, 'roof', surfE);
      else continue;
      if (deep && !open(sv)) (dctx.eaveShort = dctx.eaveShort || new Set()).add(`${w.cx},${w.cz},${sv}`);
    }
    for (let k = n0; k < out.length; k++) out[k].eave = true;
    for (const u of rakeCols) {
      for (let i = 0; i <= wallRow; i++) { const v = 2 + 2 * i; add(roof, u, pivot(i), -v, 180, 'roof', low(i) + r / 2); add(roof, u, pivot(i), v, 0, 'roof', low(i) + r / 2); }
      add(roofTop, u, capY, 0, 0, 'cap', capY + 0.3);
    }
  }
  if (dctx) { dctx.rake = over && ed.rake ? 1 : 0; dctx.eaveOut = over ? (deep ? 2 : eaveOK ? 1 : 0) : 0; }
  if (deep && dctx.notes && !dctx.notes.includes('Deep eaves: the roof a whole row past the long walls.')) dctx.notes.push('Deep eaves: the roof a whole row past the long walls.');
  if (dctx && !(C.kick && (C.eaves || 1) > 1)) Details.bargeboards(K, C, w, dctx, rows, ends, add, low, pivot, r);
  if (dctx && dctx.profile.dormers && r === 2 && !C.stoneWalls && w === dctx.wings[0]) dormers(K, w, top, add, dctx);
  return out;
}

// Wall dormers (cross gables) on the front slope of a 45 degree roof: a 4 m gable standing on the wall top, its own
// small roof running back into the main roof, which carries on under it (the usual Valheim way: the dormer sits on
// the roof, nothing is cut away). One over the middle of the front, or a pair on a long front.
function dormers(K, w, top, add, dctx) {
  if (w.W < 4 || w.D < 3) return;
  // the front: the long side facing -z in the world
  const sv = toWorld(w, 0, 1, 0)[1] < w.cz ? 1 : -1;
  const grid = [];
  for (let u = -w.W + 2; u <= w.W - 2; u += 2) grid.push(u);
  const mid = grid.reduce((m, u) => (Math.abs(u) < Math.abs(m) ? u : m), grid[0]);
  const pair = w.W >= 8 ? [grid.find(u => u >= -w.W / 2 - 0.01), -grid.find(u => u >= -w.W / 2 - 0.01)] : null;
  const choice = dctx.profile.dormerPair && pair && pair[0] !== pair[1] ? pair : [mid];
  const other = dctx.wings.filter(o => o !== w);
  const gable = K.gable45, roof = K.roof45, cap = K.roofTop45;
  let n = 0;
  for (const u0 of choice) {
    // nothing else joins the wall here (another wing, a tower)
    const [fx, fz] = toWorld(w, u0, sv * (w.D + 1), 0);
    if (other.some(o => inside(o, fx, fz, 0.5))) continue;
    // nor a wall hearth's shaft on this slope
    if (dctx.hearth && dctx.hearth.spot === 'side' && Math.sign(dctx.hearth.z - w.cz) === Math.sign(fz - w.cz) && Math.abs(fx - dctx.hearth.x) < 3.1) continue;
    // nor does another wing's roof cover the patch of this roof it would stand on (a cross wing flush with the front)
    if (other.some(o => [[-2.5, 0.5], [2.5, 0.5], [0, 0.5], [-2.5, 2.5], [2.5, 2.5]].some(([du, dv]) => { const [x, z] = toWorld(w, u0 + du, sv * (w.D - dv), 0); return inside(o, x, z, 0.3); }))) continue;
    // a dormer over the door takes the place of a gable porch there
    // (and of a porch: the porch roof would run into the dormer's foot)
    if (Math.abs(toWorld(w, u0, 0, 0)[0] - dctx.door.x) < 4 && sv * (dctx.door.z - w.cz) > 0) { dctx.profile.gablePorch = false; dctx.profile.dormerOverDoor = true; }
    const v = sv * w.D, vr = sv * (w.D - 1);
    // the front triangle in two halves, each falling away from the middle
    add(gable, u0 - 1, top, v, 0, 'gable', top + 2);
    add(gable, u0 + 1, top, v, 180, 'gable', top + 2);
    // its roof, two 2 m pieces back to where the main roof meets its ridge, and a ridge cap
    add(roof, u0 - 1, top + 1, vr, 270, 'roof', top + 1);
    add(roof, u0 + 1, top + 1, vr, 90, 'roof', top + 1);
    add(cap, u0, top + 2, vr, 90, 'cap', top + 2.3);
    n++;
  }
  if (n) dctx.notes.push(n > 1 ? 'Two wall dormers on the front slope.' : 'A wall dormer over the middle of the front.');
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
    else { add(K.wallHalf, u, y + 0.25, v, 90, 'gable', y + 0.5); y += 0.5; }
  }
}

// Hip roof: rings of rows on all four sides with corner pieces, a ridge along what is left (needs W >= D).
// Corner yaw per corner from the corpus: front-left 180, front-right 90, back-right 0, back-left 270, each on its
// row's low edge (lab/offsets.js: ocorner to roof). eaves 2 adds a ring past the walls (fen and longhouse roofs).
function hipPieces(K, w, top, r, eaves, o = {}) {
  const roof = r === 2 ? K.roof45 : K.roof26, roofTop = r === 2 ? K.roofTop45 : K.roofTop26;
  const corner = r === 2 ? (K.roof45 || '').replace('_45', '_ocorner_45') : (K.roof26 || '') + '_ocorner';
  const capY = capOf(w, top, r), low = i => capY - r * (i + 1), pivot = i => low(i) + (r === 2 ? 1 : 0);
  const Xr = w.W - w.D, rows = (w.D - 3) / 2 + ((eaves || 1) > 1 ? 1 : 0);
  const kick = o.kick && r === 2 && (eaves || 1) > 1;
  const out = [], add = (name, u, y, v, yaw, role, surf) => { const [x, z, wy] = toWorld(w, u, v, yaw); out.push({ name, x, y, z, yaw: wy, role, surf, wing: w }); };
  for (let u = -Xr; u <= Xr + 0.01; u += 2) {
    add(roofTop, u, capY, 0, 0, 'cap', capY + 0.3);
    if (o.vent && Math.abs(u - ridgeU(w, o.vent)) < 1.01) out[out.length - 1].vent = true;
  }
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
  const lowAt = i => top + r * (i - 1); // row 1 starts at the front wall (no row hangs over it)
  for (let u = -w.W + 1; u < w.W; u += 2) for (let i = 1; i < rows; i++) b.put(roof, u, lowAt(i) + (r === 2 ? 1 : 0), -w.D - 1 + 2 * i, 180);
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

function flatRoof(b, K, C, cells, edges, top, F, SH, L) {
  for (const [, [x, z]] of cells) if (!onLadder(L, x, z, SH)) b.put(K.floor, x, top, z);
  // a stone block only stands on stone: over a timber lintel or an open side the parapet is wood
  const stoneUnder = e => b.pieces.some(p => p.name === K.stoneWall && Math.abs(p.x - e.x) < 0.05 && Math.abs(p.z - e.z) < 0.05 && p.y < top && p.y > top - 1.1);
  if (C.parapet) for (const e of edges) {
    if (C.stoneWalls && K.stoneBlock && stoneUnder(e)) {
      const ux = e.yaw === 0 ? 1 : 0, uz = e.yaw === 0 ? 0 : 1;
      b.put(K.stoneBlock, e.x - ux * 0.5, top + 0.5, e.z - uz * 0.5, e.yaw); // a block every other metre
    } else b.put(K.wallHalf, e.x, top + 0.5, e.z, e.yaw); // a 1 m parapet of planks
  }
  // a ladder up to a hatch in the roof
  if (L) putLadder(b, K, L, top - SH, SH);
  void F;
}

// Ring roof over a round plan: each ring 2 m further in and one row higher, pieces turned to rise toward the middle.
// rs: rise per ring (2 for 45 degrees, 1 for 26), the last value repeating. With eave the first ring hangs 2 m past
// the wall; without it the first ring starts at the wall top (drums and domes). gap leaves the first ring open
// either side of the front (a tent's doorway). Returns the height of the top ring's inner edge.
function ringRoof(b, K, ap, top, rs, o = {}) {
  const eave = o.eave !== false;
  // the first ring reaches 'out' metres past the wall (0.75 m; a tent's cone runs 2 m out to the ground), lower by
  // its slope so it still passes over the wall top
  const out = eave ? (o.out != null ? o.out : 0.75) : 0;
  let low = top - rs[0] * out / 2;
  for (let i = 0; ; i++) {
    const rho = ap + out - 1 - 2 * i;
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
    else for (const dx of [-0.5, 0.5]) for (const dz of [-0.5, 0.5]) if (inOct(x + dx, z + dz, deckR, o.deck ? 0.45 : 0.3)) { b.put(K.floor1, x + dx, F, z + dz); zFront = Math.min(zFront, z + dz - 0.5); }
  }
  const stack = (x, z, y1) => posts(b, K, x, z, y1);
  if (F > 0) {
    if (o.deck) { for (const [x, z] of big) if ((((x + z) / 2) % 2 + 2) % 2 === 0) stack(x, z, F); }
    else { for (let i = 0; i < 8; i++) { const a = i * 45 * Math.PI / 180; stack(Math.sin(a) * ap * 0.98, Math.cos(a) * ap * 0.98, F); } stack(0, 0, F); }
  }
  let top = F;
  const slots = [], keep = [];
  b.octo = { verts: [], bays: [] }; // for the trim (details.js roundTrim)
  const sideAt = (i, k) => {
    const a = i * 45, ar = a * Math.PI / 180;
    const nx = Math.sin(ar), nz = Math.cos(ar), tx = Math.cos(ar), tz = -Math.sin(ar);
    const t = -side / 2 + 1 + 2 * k;
    return { a, nx, nz, tx, tz, x: nx * ap + tx * t, z: nz * ap + tz * t };
  };
  if (tent) {
    // lavvu: no walls; a doorway in the front of the first ring, the cone starting at the floor
    top = F + r;
    putDoor(b, doorPiece(K, C, 2), 0, F, -ap, 0);
    for (const x of [-1.1, 1.1]) b.put(K.pole, x, F + 1, -ap);
    for (let i = 0; i < 8; i++) for (let k = 0; k < seg; k++) {
      if (i === 4 && k === Math.floor(seg / 2)) continue;
      const s = sideAt(i, k);
      for (const dt of [-0.5, 0.5]) slots.push({ x: s.x + s.tx * dt - s.nx * 0.6, z: s.z + s.tz * dt - s.nz * 0.6, y: F, yaw: norm(s.a + 180), nx: -s.nx, nz: -s.nz });
    }
  } else {
    const inner = new Map(big.filter(([x, z]) => inOct(x, z, ap, 0.99)).map(c => [`${c[0]},${c[1]}`, c]));
    const ladders = storeys > 1 ? ladderPlan(inner, storeys - 1, { door: [sideAt(4, Math.floor(seg / 2)).x < 0 ? -1 : 1, -ap + 1] }) : [];
    if (storeys > 1 && ladders.length < storeys - 1) b.notes.push('No room for a ladder with a clear foot and landing in this plan.');
    if (ladders[0]) keep.push(cellRect(ladders[0].stand), cellRect(ladders[0].hole));
    for (let s = 0; s < storeys; s++) {
      const y0 = F + s * SH, up = ladders[s - 1];
      if (s > 0) {
        for (const [, [x, z]] of inner) if (!onLadder(up, x, z, SH)) b.put(K.floor, x, y0, z);
        // 1 m pieces out to the walls, as on the ground floor: a floor that stops short of the walls has nothing to
        // hold it up
        for (let x = -Rr + 1; x < Rr; x += 2) for (let z = -Rr + 1; z < Rr; z += 2) {
          if (inner.has(`${x},${z}`)) continue;
          for (const dx of [-0.5, 0.5]) for (const dz of [-0.5, 0.5]) if (inOct(x + dx, z + dz, ap, 0.3)) b.put(K.floor1, x + dx, y0, z + dz);
        }
        if (up) putLadder(b, K, up, y0 - SH, SH);
      }
      for (let i = 0; i < 8; i++) {
        for (let k = 0; k < seg; k++) {
          const sd = sideAt(i, k);
          const isDoor = s === 0 && i === 4 && k === Math.floor(seg / 2);
          const bayKind = isDoor ? 'door' : (k === 0 && i % 2 && !T.tower ? 'window' : 'wall');
          wallSegment(b, K, C, sd.x, y0, sd.z, sd.a, SH, bayKind);
          if (s === 0) b.octo.bays.push({ x: sd.x, z: sd.z, nx: sd.nx, nz: sd.nz, i, k, kind: bayKind });
          if (s === 0 && !isDoor) for (const dt of [-0.5, 0.5]) slots.push({ x: sd.x + sd.tx * dt, z: sd.z + sd.tz * dt, y: y0, yaw: norm(sd.a + 180), nx: -sd.nx, nz: -sd.nz });
          b.put(K.beam, sd.x, y0 + SH, sd.z, sd.a);
        }
        const sd = sideAt(i, 0), vx = sd.nx * ap + sd.tx * side / 2, vz = sd.nz * ap + sd.tz * side / 2;
        if (s === 0) b.octo.verts.push({ x: vx, z: vz });
        for (let y = y0; y < y0 + SH - 0.01;) { const h = (y0 + SH - y) >= 2 ? 2 : 1; b.put(h === 2 ? K.pole : K.pole1, vx, y + h / 2, vz); y += h; }
      }
      top = y0 + SH;
    }
  }
  const dx0 = tent ? 0 : sideAt(4, Math.floor(seg / 2)).x; // the door's 2 m bay is off centre when a side has two bays
  b.rooms.push({ x0: -ap, x1: ap, z0: -ap, z1: ap, y: F, h: tent ? 2 : SH, use: T.use, slots: slots.filter(sl => !keep.some(k => inRect(k, sl.x, sl.z, 0.6))),
    door: { x: dx0, z: -ap }, main: true, keep });
  // the ring roof leaves its crown open over the middle: the smoke hole, with the fire under it
  b.vents.push({ kind: 'crown', x: 0, z: 0 });
  b.doorX = dx0;
  const porch = kind === 'round' && !o.deck && !T.tower && side >= 4;
  if (kind === 'yurt') ringRoof(b, K, ap, top, [r], { eave: false });
  else ringRoof(b, K, ap, top, tent || r === 1 ? [r] : [1, r], { gap: tent ? 26 : porch ? 22 : 0, out: tent ? 2 : 0.75 });
  if (porch) {
    // entrance porch: two short walls and a small gable roof out from the door (Iron Age and early medieval round houses)
    const z = -ap - 1;
    b.put(K.floor, dx0, F, z);
    for (const x of [dx0 - 1, dx0 + 1]) { wallSegment(b, K, C, x, F, z, 90, SH, 'wall', C.wallStyle === 'stone' ? 'stone-base' : null); b.put(K.beam, x, F + SH, z, 90); }
    b.put(K.roof26, dx0 + 1, F + SH, z, 90); b.put(K.roof26, dx0 - 1, F + SH, z, 270);
    b.put(K.roofTop26, dx0, F + SH + 1, z, 90);
    b.notes.push('Porch at the door.');
  }
  // a stair up to a raised door (the walkway brings its own)
  if (F >= 0.9 && !o.walk && !o.deck) stairUp(b, K, dx0, porch ? -ap - 2 : -ap, F);
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
        railing(b, K, nx * Rf + tx * t, F, nz * Rf + tz * t, a); // a deck rail, posts and a beam (no pasture fence on a deck)
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

// A stair from the ground up to a floor whose front edge is at zEdge, climbing toward +z. wood_stair pivots in its
// middle and climbs 2 m over 2 m: for a floor 2 m up it stands on the ground; for one 1 m up it is set half in the
// ground so its top meets the floor.
// A stair climbs 1 m over 2 m from its foot: one per metre of height, each 2 m further out and 1 m lower.
function stairUp(b, K, x, zEdge, F) {
  if (F < 0.9 || F > 2.01) return;
  for (let k = 0; k < Math.round(F); k++) b.put(b.stairName || K.stair || 'wood_stair', x, F - (k + 1), zEdge - 1 - 2 * k, 180);
}
// The same up to a door in a side wall at xEdge; out is -1 for the left side, 1 for the right.
function stairUpX(b, K, xEdge, z, F, out) {
  if (F < 0.9 || F > 2.01) return;
  for (let k = 0; k < Math.round(F); k++) b.put(K.stair || 'wood_stair', xEdge + out * (1 + 2 * k), F - (k + 1), z, out < 0 ? 270 : 90);
}

// Timber trackway out from a door at (x, zDoor), len metres, on short posts.
// Two floor pieces wide (Tyler's rule for anything people walk along).
function boardwalk(b, K, x, zDoor, F, len) {
  const y = Math.max(F, 0);
  let z = zDoor - 1;
  for (let k = 0; k < len / 2; k++, z -= 2) {
    for (const dx of [-1, 1]) b.put(K.floor, x + dx, y, z);
    if (y > 0.01) for (const dx of [-2, 0, 2]) posts(b, K, x + dx, z, y);
  }
  stairUp(b, K, x, z + 1, y);
}

// A 2 x 2 m stone tower up to height h at (tx, tz); open on its -x side at the bottom unless closed.
function stoneTowerAt(b, K, tx, tz, h, F, closed) {
  h = Math.ceil(h - 0.01); // whole courses up to the top floor
  const stone = K.stoneWall || 'stone_wall_2x1';
  for (let y = 0.5; y < h; y += 1) for (const [dx, dz, yaw] of [[0, -1, 0], [0, 1, 0], [-1, 0, 90], [1, 0, 90]])
    if (closed || !(y < F + 2 && dx === -1)) b.put(stone, tx + dx, y, tz + dz, yaw);
  b.put(K.floor, tx, h, tz);
  for (const [dx, dz, yaw] of [[0, -1, 0], [0, 1, 0], [-1, 0, 90], [1, 0, 90]]) b.put(K.stoneBlock || 'stone_wall_1x1', tx + dx * 1.0, h + 0.5, tz + dz * 1.0, yaw);
  // no ladder: a 2 m shaft has no room for one with a clear foot, so the tower is for looks
}

// Square tower of n x n cells centred on (cx, cz): wooden floors, a ladder per storey, slit windows above the ground
// storey, a low pyramid roof. skip(edge, y0, SH) leaves out walls another building already has.
function towerAt(b, K, C, o) {
  const { cx, cz, n, F, storeys, SH } = o;
  const w = { cx, cz, W: n, D: n, alpha: 0 };
  const cells = cellsOf([w]), edges = edgesOf(cells), verts = vertsOf(edges);
  const list = [...cells.values()];
  const door = o.door === 'right'
    ? edges.filter(e => e.out[0] > 0).sort((a, c) => Math.abs(a.z - cz) - Math.abs(c.z - cz))[0]
    : edges.filter(e => e.out[1] < 0).sort((a, c) => Math.abs(a.x - cx) - Math.abs(c.x - cx))[0];
  // on a house's 1 m stone floor (F 0.5) the tower gets the same floor, so its stone walls stand on stone
  const towerFloor = F > 0.01 && thickFloor(K.stoneFloor) && C.stoneWalls ? K.stoneFloor : K.floor;
  for (const [x, z] of list) b.put(towerFloor, x, towerFloor === K.floor ? F : F - 0.5, z);
  // ladders climb round the walls: each one's landing is the next one's foot
  const ladders = ladderPlan(cells, storeys - 1, { door: [door.cell[0], door.cell[1]] });
  let top = F;
  for (let s = 0; s < storeys; s++) {
    const y0 = F + s * SH, up = ladders[s - 1], next = ladders[s];
    if (s > 0) {
      for (const [x, z] of list) if (!onLadder(up, x, z, SH)) b.put(K.floor, x, y0, z);
      if (up) putLadder(b, K, up, y0 - SH, SH);
    }
    for (const e of edges) {
      if (o.skip && o.skip(e, y0, SH)) continue;
      const midSide = e.yaw === 0 ? Math.abs(e.x - cx) < 0.01 : Math.abs(e.z - cz) < 0.01;
      wallSegment(b, K, C, e.x, y0, e.z, e.yaw, SH, s === 0 && e === door ? 'door' : (s > 0 && midSide ? 'window' : 'wall'));
    }
    for (const e of edges) b.put(K.beam, e.x, y0 + SH, e.z, e.yaw);
    const keep = [];
    if (up) keep.push(cellRect(up.hole), cellRect(up.land));
    if (next) keep.push(cellRect(next.stand), cellRect(next.hole));
    b.rooms.push({ x0: cx - n, x1: cx + n, z0: cz - n, z1: cz + n, y: y0, h: SH, use: o.use || 'guard', upper: s > 0, main: s === 0 && !o.skip,
      door: s === 0 ? { x: door.x, z: door.z } : null, hole: s > 0 && up ? up.hole : null, keep });
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
      // planks: the drum stands on the wooden ceiling, and stone or marble on wood falls in Valheim (T-102)
      wallSegment(b, K, C, x, o.y, z, a, o.h, i % 2 === 0 && k === 0 ? 'window' : 'wall', 'plank');
      b.put(K.beam, x, o.y + o.h, z, a);
    }
  }
  const peak = ringRoof(b, K, ap, o.y + o.h, o.cone ? [2] : o.side >= 4 ? [2, 1] : [1], { eave: false, x: o.x, z: o.z });
  void peak; // the top of the dome stays open (a stone block there had nothing under it but the roof)
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

// An open woodshed against a gable end: a 26 degree lean-to roof from the gable wall out over posts 2 m out, with wood
// stacked under it. Only on a free gable end (no wing, tower or annex there) of the main wing.
function woodshed(b, K, C, wings, edges, F, SH, tower, avoid) {
  const w0 = wings[0];
  if (w0.alpha !== 0) return false;
  for (const sg of [1, -1]) {
    const xWall = w0.cx + sg * w0.W;
    const end = edges.filter(e => e.yaw === 90 && Math.abs(e.x - xWall) < 0.01).map(e => e.z).sort((a, c) => a - c);
    if (end.length < 3) continue;
    if (wings.some(o => o !== w0 && inside(o, xWall + sg * 1.5, w0.cz, 0.01))) continue;
    if (tower && Math.abs(tower.cx - xWall) < tower.n + 1) continue;
    if (sg === avoid) continue; // a hearth's stack stands at that end
    const zs = end.length >= 4 ? [end[1], end[2]] : [end[0], end[1]];
    const xr = xWall + sg * 1, xp = xWall + sg * 2, yaw = sg > 0 ? 90 : 270, T2 = { trim: true };
    for (const z of zs) b.put(K.roof26, xr, F + SH - 0.6, z, yaw, T2); // 2.4 m at its outer edge, up against the gable
    const zp = [zs[0] - 1, zs[0] + 1, zs[1] + 1];
    for (const z of zp) { b.put(framePole(K, C), xp, F + 1, z, 0, T2); b.put(K.pole1 || 'wood_pole', xp, F + 1.9, z, 0, T2); }
    for (const z of zs) b.put(K.beam || 'wood_beam', xp, F + 2.35, z, 90, T2);
    // one stack, its long side (2.5 m) along the wall, standing on its bottom (the pivot is 0.57 m up)
    b.put('wood_stack', xWall + sg * 1.0, F + 0.57, (zs[0] + zs[1]) / 2, 90, { decor: true, trim: true });
    b.notes.push('An open woodshed against the gable end.');
    return true;
  }
  return false;
}

// An outshut: a lean-to 2 m deep along the back wall of the main wing, its 26 degree roof from 3.4 m at the wall down
// to 2.4 m at a row of posts, open at the front; firewood, barrels or a bench under it. The second, lower mass the
// best-liked builds have against a main block (Hurstwic farmsteads, corpus barns and smithies). Not over the back
// door's path, not where another wing, a tower, a pen or a woodshed stands.
function outshut(b, K, C, wings, edges, F, SH, R, decor) {
  const w0 = wings[0];
  if (w0.alpha !== 0 || w0.W < 4) return false;
  const zWall = w0.cz + w0.D, xs = [];
  for (let x = w0.cx - w0.W + 1; x < w0.cx + w0.W; x += 2) xs.push(x);
  const Ck = checksLib();
  const free = x => {
    if (wings.some(o => o !== w0 && inside(o, x, zWall + 1.2, 0.3))) return false;
    if (!edges.some(e => Math.abs(e.x - x) < 0.01 && Math.abs(e.z - zWall) < 0.01)) return false;
    return !b.pieces.some(p => {
      if (Math.abs(p.z - zWall) < 0.6 && ['wall', 'window', 'pole', 'gable'].includes(P.piece(p.name).role)) return false; // the wall itself and its footing
      const o = Ck.aabb(p);
      return o.x0 < x + 1.1 && o.x1 > x - 1.1 && o.z0 < zWall + 2.6 && o.z1 > zWall + 0.55 && o.y0 < F + 3.6 && o.y1 > 0.05;
    });
  };
  // the longest run of free bays, at least three, leaving the end bays (corners stay clean)
  let best = [], run = [];
  for (const x of xs.slice(1, -1)) { if (free(x)) { run.push(x); if (run.length > best.length) best = run.slice(); } else run = []; }
  if (best.length < 3) return false;
  const T2 = { trim: true }, roof = K.roof26 || 'wood_roof', pole = framePole(K, C), pole1 = K.pole1 || 'wood_pole', beam = K.beam || 'wood_beam';
  for (const x of best) b.put(roof, x, F + SH - 0.6, zWall + 1, 0, T2); // 2.4 m at its outer edge, against the wall
  const posts = [best[0] - 1, ...best.map(x => x + 1)];
  // posts from the ground (a raised floor's lean-to stands on the ground below it) up to the beam
  for (const x of posts) for (let y = 0; y < F + 2.3 - 0.01;) { const h = F + 2.3 - y >= 1.99 ? 2 : 1; b.put(h === 2 ? pole : pole1, x, y + h / 2, zWall + 2, 0, T2); y += h; }
  for (const x of best) b.put(beam, x, F + 2.35, zWall + 2, 0, T2);
  // what is kept under it
  if (decor !== 'd1') {
    const goods = ['wood_stack', 'piece_chest_barrel', 'wood_stack', 'piece_bench01'];
    // nothing within 0.6 m of a stair or ladder inside the wall, as the decorator's audit reads a climb (a straight stair
    // up the back wall to an s3 upper floor, integration round 4)
    const climbs = b.pieces.filter(q => !q.decor && P.piece(q.name).role === 'stair').map(q => checksLib().aabb(q));
    const byClimb = x => climbs.some(c => x - 1 < c.x1 + 0.6 && x + 1 > c.x0 - 0.6 && zWall + 0.3 < c.z1 + 0.6 && zWall + 1.6 > c.z0 - 0.6 && c.y0 < 1.5);
    best.forEach((x, i) => {
      if (i % 2 || byClimb(x)) return;
      const g = goods[Math.floor(R() * goods.length)];
      if (g === 'wood_stack') b.put('wood_stack', x, 0.57, zWall + 1.05, 0, { decor: true, trim: true, ds: 2 });
      else if (g === 'piece_chest_barrel' && reaches(C.biome || 'Meadows', 'Swamp')) b.put(g, x, 0, zWall + 0.9, 180, { decor: true, trim: true, ds: 2 });
      else if (g === 'piece_bench01' && F < 0.01) b.put(g, x, 0, zWall + 0.75, 180, { decor: true, trim: true, ds: 2 });
    });
  }
  b.notes.push(`A lean-to ${best.length * 2} m long against the back wall.`);
  return true;
}

// A hearth half in the gable wall (hearthPlan 'stack'): the middle bay of the ground storey opened 2 m high under a
// timber lintel, and outside it a stone alcove (two cheeks, a back and a stone floor) that rises as a hollow stack to a
// metre past the ridge. A plank lid on four short posts keeps the rain off the fire and lets the smoke out at the
// sides (Valheim's smoke needs about a metre to pass). Stone stands on the ground the whole way up (stone takes no
// support from wood); over the gable the shaft's house side is planks. Returns false when the end is not free.
function hearthStack(b, K, C, w0, h, o) {
  const Ck = checksLib(), sg = h.sg, xW = h.xW, z = h.z, F = o.F, SH = o.SH;
  const block = K.stoneWall, cube = K.stoneBlock || 'stone_wall_1x1';
  if (!block || !/2x1/.test(block)) return false;
  const role = p => P.piece(p.name).role;
  const inWall = p => Math.abs(p.x - xW) < 0.15 && role(p) === 'wall';
  const face = Math.max(0.1, ...b.pieces.filter(inWall).map(p => { const a = Ck.aabb(p); return sg > 0 ? a.x1 - xW : xW - a.x0; }).filter(v => v < 0.8));
  const xi0 = xW + sg * face, xi1 = xi0 + sg * 2; // the shaft's inside, from the wall's face 2 m out
  const box = { x0: Math.min(xi0, xi1 + sg * 1.05), x1: Math.max(xi0, xi1 + sg * 1.05), z0: z - 2.05, z1: z + 2.05 };
  const hit = (a, y0) => a.x0 < box.x1 - 0.05 && a.x1 > box.x0 + 0.05 && a.z0 < box.z1 - 0.05 && a.z1 > box.z0 + 0.05 && a.y1 > y0;
  // nothing standing out there below the eaves (a deck, a post, a lean-to); roofs and trim over it come out below
  const rakeTrim = p => role(p) === 'beam' && (p.trim || /_(26|45)$/.test(p.name));
  const blocker = b.pieces.find(p => !/roof/.test(role(p)) && role(p) !== 'gable' && Math.abs(p.x - xW) > 0.35 && !rakeTrim(p) && hit(Ck.aabb(p), 0.05) && Ck.aabb(p).y0 < F + SH);
  if (blocker) return false;
  const tops = b.pieces.filter(p => /roof/.test(role(p)) && Math.abs(p.x - xW) < 3);
  if (!tops.length) return false;
  const yTop = Math.ceil(Math.max(...tops.map(p => Ck.aabb(p).y1)) + 0.8);
  // the rake's overhang, its cap and the bargeboards over the stack come out (the roof ends at the gable there)
  takeOut(b, p => !p.decor && (/roof/.test(role(p)) || rakeTrim(p)) && hit(Ck.aabb(p), F + 2));
  // the opening: the ground storey's middle bay out, then a lintel beam at 2 m and planks over it to the wall top
  takeOut(b, p => !p.decor && Math.abs(p.x - xW) < 0.6 && Math.abs(p.z - z) < 0.95 && ['wall', 'window', 'door', 'beam'].includes(role(p)) && (a => a.y1 <= F + SH + 0.02 && a.y1 > F + 0.05)(Ck.aabb(p)));
  const T2 = { trim: true }, TS = { trim: true, hearthStone: true }; // (stone pieces marked for D-131)
  b.put(K.beam || 'wood_beam', xW, F + 1.9, z, 90);
  for (let y = F + 2.2; y < F + SH - 0.01; y += 1) b.put(K.wallHalf, xW, Math.min(y + 0.5, F + SH - 0.5), z, 90);
  // the alcove's floor: 1 m stone floors down to the ground, the top one flush with the house floor
  for (let y = F - 0.4; y + 0.5 > 0.05; y -= 1) b.put(K.stoneFloor || 'stone_floor_2x2', xi0 + sg, y, z, 0, { hearthStone: true });
  // cheeks, back and corners, course by course from the ground; over the opening the cheeks step in a metre a side
  // (the shoulders), so the stack narrows to a flue 1 m wide and 2 m deep
  const shoulder = Math.round(F + 2);
  for (let y = 0; y < yTop - 0.01; y += 1) {
    const zc = y < shoulder ? 1.5 : 1;
    for (const s2 of [-1, 1]) { b.put(block, xi0 + sg, y + 0.5, z + s2 * zc, 0, TS); if (y < shoulder) b.put(cube, xi1 + sg * 0.5, y + 0.5, z + s2 * 1.5, 0, TS); }
    b.put(block, xi1 + sg * 0.5, y + 0.5, z, 90, TS);
  }
  // the house side of the shaft over the gable: planks on the gable's top
  const gableTop = Math.max(F + SH, ...b.pieces.filter(p => Math.abs(p.x - xW) < 0.3 && Math.abs(p.z - z) < 0.9 && ['wall', 'gable'].includes(role(p))).map(p => Ck.aabb(p).y1));
  for (let y = gableTop; y < yTop - 0.01; y += 1) b.put(K.wallHalf, xW, Math.min(y + 0.5, yTop - 0.5), z, 90, T2);
  // the lid on four short posts
  for (const x of [xi0, xi1]) for (const s2 of [-1, 1]) b.put(K.pole1 || 'wood_pole', x, yTop + 0.5, z + s2 * 0.5, 0, T2);
  b.put(K.floor, xi0 + sg, yTop + 1.1, z, 0, T2);
  b.vents.push({ kind: 'stack', x: +(xW + sg * 0.7).toFixed(3), z, rect: null });
  if (o.notes) o.notes.push('The hearth stands half in the gable wall, in a stone alcove that rises as a chimney stack past the ridge.');
  return true;
}

// The gable end chimneyStack tries first on a middle-fire home that may get one (o.may): the first end of the main wing
// with no wing past it and no tower at it, as chimneyStack walks them. 0 when none. The woodshed keeps off it.
function stackEndFor(wings, tower, o) {
  const w0 = wings[0];
  if (!o.may || !w0 || w0.alpha !== 0) return 0;
  for (const sg of [1, -1]) {
    const xWall = w0.cx + sg * w0.W;
    if (wings.some(w => w !== w0 && inside(w, xWall + sg * 1.5, w0.cz, 0.01))) continue;
    if (tower && Math.abs(tower.cx - xWall) < tower.n + 1) continue;
    return sg;
  }
  return 0;
}

// A stack hearth whose stack cannot stand outside the gable (hearthStack false) becomes an end hearth at the same
// gable: the ridge caps over the fire's cell and the rake's cap over it come out for the hood's shaft (as the roof does
// for an end hearth). Returns the flue's rectangle, or null when no ridge cap is over the cell.
function endFallback(b, h, w0, o) {
  const fr = flueRect(w0, { x: h.x, z: h.z }, w0.W - 1);
  if (!fr) return null;
  const Ck = checksLib();
  const caps = takeOut(b, p => !p.decor && isCap(p) && p.y > (o.top != null ? o.top : o.F + o.storeys * o.SH) - 0.3 &&
    (a => a.x0 < fr.x1 - 0.05 && a.x1 > fr.x0 + 0.05 && a.z0 < fr.z1 - 0.05 && a.z1 > fr.z0 + 0.05)(Ck.catBox(p)));
  if (!caps.length) return null;
  b.vents.push({ kind: 'ridge', caps, x: h.x, z: h.z, y: Math.max(...caps.map(c => c.y)), rect: fr, from: o.F + HOOD, hood: true });
  return fr;
}

// A stone front on a home's wall hearth from s2 (D-131: "Wood hearths (s1) and then stone hearths (s2 and s3)
// acceptable in meadows onward"), as corpus builders make one. Corpus (lab/hearths/hood_stats.js, round 4): of 556
// indoor home wall fires, 79 (14 %) have stone 1.3 to 2.9 m over them (basic stone 39, grausten 32, black marble 10);
// over the basic-stone ones a stone_arch across the fire's mouth (19) or a stone lintel (17), a metre in front of the
// fire, with 36 of their stone pieces set into a wall piece (median 1 m). Here: two jambs of 1 m blocks from the ground
// at the sides of the hood's mouth, 1.75 to 2.75 m out from the wall line, and across the mouth from 2 to 3 m either a
// mirrored pair of arches resting on 2 m jambs, or a 2 m block as a lintel between 3 m jambs, its ends set 0.2 m into
// the jambs' top blocks (a clip made on purpose, D-098, marked) and resting on the blocks under them (stone takes no
// support from wood, T-102). The plank hood starts on it at 3 m. Black marble takes the lintel (its arch is 2 m tall). Only where the kit's block is a 1 m cube (not the
// Ashlands grausten, whose blocks are 2 m tall) and the floor is at most 1 m up (the jambs go down to the ground).
const FRONT_SHARE = 0.14, FRONT_ARCH = 19 / 36, FRONT_TOP = 3;
// The Ashlands front in grausten (its blocks are 1 x 2 m and 2 x 2 m slabs, its long wall 4 x 2 m): two 1 x 2 m slabs
// standing as jambs 1.5 m either side of the fire and a 4 x 2 m slab across them as the lintel from 2 to 4 m, its ends
// resting on the jambs. Corpus (lab/hearths/hood_stats.js, round 6 count on the device): in the 56 builds with grausten
// that have indoor home wall fires, 32 of 177 such fires (18 %) have grausten 1.3 to 2.9 m over them, most often a
// 2 x 2 or 4 x 2 m slab whose foot is 2 m over the fire's floor. About half the homes that draw one have no room for
// it (an upper storey under 4 m, a door or climb, a wall in its place: 25 of 48 forced Ashlands wall hearths took one,
// round 6), so it is drawn at 0.35 for about 18 % of wall hearths.
const FRONT_SHARE_GRAUSTEN = 0.35, FRONT_TOP_GRAUSTEN = 4;
function hearthFront(b, K, h, o) {
  const cube = K.stoneBlock, span = K.stoneWall;
  const no = w => { if (o.why) o.why.frontWhy = w; return false; };
  if (!cube || !span || o.F > 1.01) return no('no stone kit or a floor over 1 m');
  const sz = n => P.piece(n).size;
  const gr = /grausten/.test(cube) && !!K.stoneWall4 && sz(cube)[0] === 1 && sz(cube)[1] === 2 && sz(K.stoneWall4)[0] === 4 && sz(K.stoneWall4)[1] === 2;
  const TOP = gr ? FRONT_TOP_GRAUSTEN : FRONT_TOP;
  if (o.storeys > 1 && o.SH < TOP - 0.01) return no(`storey under ${TOP} m`);
  if (!gr && (sz(cube)[0] !== 1 || sz(cube)[1] !== 1 || sz(span)[0] !== 2 || sz(span)[1] !== 1)) return no('blocks not 1 m');
  const arch = !gr && K.stoneArch === 'stone_arch' && o.R() < FRONT_ARCH;
  // the wall line behind the fire, the way out into the room and the way along the wall
  const end = h.spot === 'end';
  const wx = end ? h.xW : h.x, wz = end ? h.z : h.z + h.sv;
  const n = end ? [-h.sg, 0] : [0, -h.sv], t = end ? [0, 1] : [1, 0];
  const at = (out, along) => [+(wx + n[0] * out + t[0] * along).toFixed(3), +(wz + n[1] * out + t[1] * along).toFixed(3)];
  if (!isFinite(wx)) return no('no wall line');
  const Ck = checksLib();
  // the wall's face toward the room (a stone wall is a metre thick: the fire slides off it, and the front moves out
  // with it)
  const wallHere = p => P.piece(p.name).role === 'wall' && Math.abs((p.x - wx) * n[0] + (p.z - wz) * n[1]) < 0.15 && Math.abs((p.x - wx) * t[0] + (p.z - wz) * t[1]) < 1.5;
  const face = Math.max(0.1, ...b.pieces.filter(p => !p.decor && wallHere(p)).map(p => { const a = Ck.aabb(p); return Math.max(...[[a.x0, a.z0], [a.x1, a.z1]].map(([x, z]) => (x - wx) * n[0] + (z - wz) * n[1])); }).filter(v => v < 0.8));
  // (the arch form: two stone_arch pieces side by side, mirrored, their shoulders out over the jambs and their curves
  // meeting over the middle of the mouth, as corpus builders pair them: of 3,828 stone_arch pieces with a parallel
  // neighbor 2 m along at the same height, 2,954 are mirrored with the shoulders out (198 builds), 537 mirrored with
  // the shoulders in, 337 turned the same way; over indoor home wall fires 10 of 25 with arches have two at 1 m either
  // side of the fire. The jambs stand 1.5 m either side, 2 m tall, and the arches rest on them, so the mouth is 2 m.)
  const OUT = gr ? 2.2 + Math.max(0, face - 0.25) : 2.25 + Math.max(0, face - 0.25), JAMB = arch || gr ? 1.5 : 1.3, IN = 0.2;
  const jTop = o.F + FRONT_TOP - (arch ? 1 : 0);
  const yawT = end ? 270 : 0; // a piece's local +x along t (yaw 0 on x runs, 270 on z runs); stone_arch's shoulder is its +x end
  const pieces = [];
  // (on a raised floor the jambs go down through it to the ground, the lowest block set into the ground; pieces are
  // written by their middle, as the generator writes walls)
  if (gr) {
    for (const s of [-1, 1]) for (let y = o.F; y > -1.99; y -= 2) pieces.push({ name: cube, at: at(OUT, s * JAMB), y: y + 1, yaw: yawT });
    pieces.push({ name: K.stoneWall4, at: at(OUT, 0), y: o.F + 3, yaw: yawT });
  } else {
    for (const s of [-1, 1]) for (let y = jTop - 1; y > -0.99; y -= 1) pieces.push({ name: cube, at: at(OUT, s * JAMB), y: y + 0.5, yaw: 0 });
    if (arch) for (const s of [-1, 1]) pieces.push({ name: K.stoneArch, at: at(OUT, s), y: o.F + FRONT_TOP - 0.5, yaw: (yawT + (s < 0 ? 180 : 0)) % 360 });
    else pieces.push({ name: span, at: at(OUT, 0), y: o.F + FRONT_TOP - 0.5, yaw: yawT, clip: IN });
  }
  // the place must be clear: no wall, post, door, window, stair or ladder in it, no doorway or climb over it
  // (a wall that stands on its pivot in the game is still written by its middle here; finish() moves it down)
  const box = p => { const pi = P.piece(p.name); return Ck.aabb(pi.onPivot && !p.footed ? { ...p, y: p.y - pi.size[1] / 2 } : p); };
  const boxes = pieces.map(p => box({ name: p.name, x: p.at[0], y: p.y, z: p.at[1], yaw: p.yaw, q: quat(p.yaw) }));
  const meet = (a, c, m = 0.05) => a.x0 < c.x1 - m && a.x1 > c.x0 + m && a.z0 < c.z1 - m && a.z1 > c.z0 + m && a.y0 < c.y1 - m && a.y1 > c.y0 + m;
  // (a post under a raised floor where a jamb goes down is taken out: the jamb carries the floor there)
  const under = p => P.piece(p.name).role === 'pole' && Ck.aabb(p).y1 <= o.F + 0.15;
  const inWay = b.pieces.find(p => !p.decor && !under(p) && !['floor', 'roof', 'roofTop', 'roofCorner'].includes(P.piece(p.name).role) && (a => boxes.some(c => meet(a, c)))(box(p)));
  if (inWay) return no(`in the way: ${inWay.name}`);
  // (an upper room's floor zone starts 0.1 m under its floor, which rests on the jambs' tops)
  const zones = keepClear(b).filter(z => !z.flue);
  if (zones.some(z => boxes.some(c => hits({ ...c, y1: c.y1 - 0.15 }, z)))) return no('doorway or climb');
  takeOut(b, p => !p.decor && under(p) && (a => boxes.some(c => meet(a, c)))(Ck.aabb(p)));
  for (const p of pieces) {
    const mark = { trim: true, hearthStone: true };
    if (p.clip) Object.assign(mark, { clip: p.clip, wclip: p.clip });
    b.put(p.name, p.at[0], p.y, p.at[1], p.yaw, mark);
  }
  // the hood starts on the front's top
  const v = b.vents.find(x => x.hood);
  if (v) v.from = o.F + TOP;
  if (gr) b.notes.push('A grausten front on the hearth: two slabs as jambs and a long slab across the fire\'s mouth, the plank hood over it.');
  else b.notes.push(arch ? 'A stone front on the hearth: jambs and a pair of arches across the fire\'s mouth, the plank hood over it.'
    : 'A stone front on the hearth: jambs and a stone lintel across the fire\'s mouth, the plank hood over it.');
  return true;
}

// A stone stack built against the outside of a gable wall: two blocks deep for the first 2 m (the shoulder), one block
// deep above it, up to a metre past the ridge, a crown course on top. It stands on the ground, so stone carries it
// (stone takes no support from wood). It goes on a stretch of gable wall with no door or window in it, at the end
// without a woodshed. X.stackShoulder (default true) and X.stackCrown (default true) are bench switches.
function chimneyStack(b, K, wings, edges, X, R, o = {}) {
  const w0 = wings[0];
  if (w0.alpha !== 0 || !K.stoneWall || !/2x1/.test(K.stoneWall)) return false;
  const block = K.stoneWall, cube = K.stoneBlock || 'stone_wall_1x1';
  const opened = new Set((b.openings || []).map(o => `${o.e.x},${o.e.z}`));
  const why = [];
  for (const sg of [1, -1]) {
    const xWall = w0.cx + sg * w0.W;
    if (wings.some(o => o !== w0 && inside(o, xWall + sg * 1.5, w0.cz, 0.01))) { why.push('wing'); continue; }
    if (b.pieces.some(p => p.name === 'wood_stack' && Math.abs(p.x - xWall) < 2)) { why.push('woodshed'); continue; } // the woodshed's end
    const end = edges.filter(e => e.yaw === 90 && Math.abs(e.x - xWall) < 0.01).sort((a, c) => Math.abs(a.z - w0.cz) - Math.abs(c.z - w0.cz));
    // the stack's column must be clear: outside every other wing, no deck, wall, post or stair in it (roof eaves of
    // this gable may run over it; the stack goes up through them)
    const Ck = checksLib();
    // the rake's bargeboards run over the stack's column like the eaves; those in the stack's way come out below
    const rakeTrim = p => P.piece(p.name).role === 'beam' && (p.trim || /_(26|45)$/.test(p.name));
    // the wall's outer face (a stone wall is a metre thick, a log wall less)
    const inWall = p => Math.abs(p.x - xWall) < 0.15 && P.piece(p.name).role === 'wall';
    const face = Math.max(0.1, ...b.pieces.filter(inWall).map(p => { const o = Ck.aabb(p); return sg > 0 ? o.x1 - xWall : xWall - o.x0; }).filter(v => v < 0.8));
    const xs = xWall + sg * (face + 0.5);
    const clearAt = z => {
      const x0 = Math.min(xs - sg * 0.45, xs + sg * 1.5), x1 = Math.max(xs - sg * 0.45, xs + sg * 1.5);
      if (wings.some(o => o !== w0 && (inside(o, xs, z, 0.6) || inside(o, xs + sg, z, 0.6)))) return false;
      // no window anywhere up the wall behind it (a loft window in the gable included)
      if (b.pieces.some(p => (P.piece(p.name).role === 'window' || /window/.test(p.name)) && Math.abs(p.x - xWall) < 0.6 && Math.abs(p.z - z) < 1.6)) return false;
      const hit = b.pieces.find(p => {
        const r = P.piece(p.name).role;
        if (((/roof/.test(r) || rakeTrim(p)) && Math.abs(p.x - xWall) < 1.6) || inWall(p)) return false;
        const o = Ck.aabb(p);
        return o.x0 < x1 - 0.05 && o.x1 > x0 + 0.05 && o.z0 < z + 0.95 && o.z1 > z - 0.95 && o.y1 > 0.05;
      });
      if (hit) o.blockedBy = `${hit.name}${hit.trim ? ' (trim)' : ''} at ${hit.x},${hit.y},${hit.z}`;
      return !hit;
    };
    // the middle bay of the gable only (a stack at a corner cut into the eave, round 4 review); a window there is walled up
    const e = end.find(x => Math.abs(x.z - w0.cz) < 1.1 && clearAt(x.z));
    if (!e) { why.push(`column: ${o.blockedBy || 'no middle bay'}`); continue; }
    if (opened.has(`${e.x},${e.z}`) && o.C) {
      const inBay = p => !p.decor && Math.abs(p.x - e.x) < 0.6 && Math.abs(p.z - e.z) < 1.01 && ['wall', 'window', 'pole', 'beam'].includes(P.piece(p.name).role) && p.y > (o.F || 0) && p.y < (o.F || 0) + o.storeys * o.SH - 0.05;
      b.pieces = b.pieces.filter(p => !inBay(p));
      for (const op of (b.openings || []).filter(op => op.e === e)) wallSegment(b, K, o.C, e.x, op.y0, e.z, e.yaw, o.SH, 'wall');
      b.openings = (b.openings || []).filter(op => op.e !== e);
    }
    // the ridge over this end: the highest roof piece within 3 m of the wall
    const tops = b.pieces.filter(p => /roof/.test(P.piece(p.name).role) && Math.abs(p.x - xWall) < 3);
    if (!tops.length) { why.push('no roof'); continue; }
    const ridge = Math.max(...tops.map(p => Ck.aabb(p).y1)); // the top of the ridge pieces, not their pivots
    const yTop = Math.ceil(ridge + 0.8);
    const T2 = o.hearthStone ? { trim: true, hearthStone: true } : { trim: true }; // (marked for D-131 where the biome builds no stone yet)
    const sx0 = Math.min(xs - sg * 0.5, xs + sg * 1.5), sx1 = Math.max(xs - sg * 0.5, xs + sg * 1.5);
    takeOut(b, p => !p.decor && rakeTrim(p) && Math.abs(p.x - xWall) < 1.6 && (a => a.x0 < sx1 - 0.05 && a.x1 > sx0 + 0.05 && a.z0 < e.z + 0.95 && a.z1 > e.z - 0.95)(Ck.aabb(p)));
    const shoulder = X.stackShoulder ? 2 : 0; // a wider foot only when asked (it read as a stray block, round 4 review)
    for (let y = 0; y < yTop; y++) {
      b.put(block, xs, y + 0.5, e.z, 90, T2);
      if (y < shoulder) b.put(block, xs + sg, y + 0.5, e.z, 90, T2);
    }
    // the crown: a 2 x 2 slab overhanging the stack on every side but the wall's, and a 1 m pot on it
    if (X.stackCrown !== false) {
      b.put(K.stoneFloor || 'stone_floor_2x2', xs + sg * 0.25, yTop + 0.5, e.z, 0, T2);
      b.put(cube, xs, yTop + 1.5, e.z, 0, T2);
    }
    b.notes.push('A stone chimney stack against the gable end.');
    return true;
  }
  if (o.info) o.info.stackWhy = why.join('; ');
  return false;
}

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

function fieldDesign(b, K, W, D, biome, stage, R, doorX = 0) {
  const crops = { 'Meadows': 'RaspberryBush', 'Black Forest': 'Pickable_Carrot', 'Swamp': 'Pickable_Turnip', 'Mountain': 'Pickable_Onion',
    'Plains': 'Pickable_Barley', 'Mistlands': 'Pickable_Barley', 'Ashlands': 'Pickable_Barley' };
  const crop = crops[biome] || 'Pickable_Carrot';
  const fw = stage === 's1' ? 4 : stage === 's2' ? 6 : 8, fd = stage === 's1' ? 3 : 4;
  const z0 = -D - 2 - fd * 2, x0 = -fw;
  for (let x = x0 + 1; x < x0 + fw * 2; x += 2) { b.put(K.fence, x, 0, z0, 0); if (Math.abs(x - doorX) > 1.5) b.put(K.fence, x, 0, -D - 2, 0); }
  for (let z = z0 + 1; z < -D - 2; z += 2) { b.put(K.fence, x0, 0, z, 90); b.put(K.fence, x0 + fw * 2, 0, z, 90); }
  const step = crop === 'RaspberryBush' ? 1.5 : 0.75;
  for (let x = x0 + 1; x < x0 + fw * 2 - 0.5; x += step * 1.5) for (let z = z0 + 1; z < -D - 2.5; z += step) b.put(crop, x, 0, z, Math.floor(R() * 4) * 90);
  if (reaches(biome, 'Swamp')) b.put('ArmorStand', x0 + fw, 0, z0 + fd, 0); // a scarecrow; the stand takes iron
  b.notes.push(`Field of ${crop}; the ground needs cultivating in game for crops to grow back.`);
  void W;
}

function penDesign(b, K, W, D, stage) {
  const pw = stage === 's1' ? 3 : 4, pd = D, x0 = W, x1 = W + pw * 2;
  for (let x = x0 + 1; x < x1; x += 2) { b.put(K.fence, x, 0, -pd, 0); b.put(K.fence, x, 0, pd, 0); }
  for (let z = -pd + 1; z < pd; z += 2) if (Math.abs(z) > 1.5) b.put(K.fence, x1, 0, z, 90);
  b.put('piece_chest_barrel', x1 - 1, 0, pd - 1, 0);
  b.put('wood_stack', x0 + 1.2, 0.57, pd - 1, 0);
  b.notes.push('Pen beside the barn; its gap faces away from the barn.');
}

function wellDesign(b, K, biome, stage) {
  const st = biome === 'Meadows' ? (K.wallHalf || 'wood_wall_half') : (K.stoneBlock || 'stone_wall_1x1');
  for (const [x, z, yaw] of [[0, -1, 0], [0, 1, 0], [-1, 0, 90], [1, 0, 90]]) b.put(st, x, 0.5, z, yaw);
  // posts 3.5 m tall and the roof from 2.5 m up, so nobody walking round the well hits the eaves
  for (const x of [-0.9, 0.9]) { b.put(K.pole, x, 1, 0); b.put(K.pole1, x, 2.5, 0); b.put(K.pole1, x, 3, 0); } // under the beam's ends
  b.put(K.beam || 'wood_beam', 0, 3.5, 0, 0);
  b.put(K.roof26, 0, 2.5, -1, 180); b.put(K.roof26, 0, 2.5, 1, 0);
  b.put('piece_chest_barrel', 1.6, 0, 1.6, 0);
  if (stage !== 's1') { b.put('piece_groundtorch_wood', -1.8, 0.75, -1.8, 0); b.put('piece_bench01', 0, 0, -2.6, 0); }
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
  if (decor !== 'd1') { b.put('wood_stack', 3.5, 0.57, 3, 30, { ds: 2 }); b.put('piece_chest_wood', -3.5, 0, 3, 150, { ds: 2 }); }
  if (decor === 'd3') { b.put('piece_groundtorch_wood', 3.6, 0.75, -2, 0, { ds: 3 }); b.put('rug_deer', 0, 0.02, 4.3, 0, { ds: 3 }); b.put('itemstand', -2, 1.5, 5.3, 180, { ds: 3 }); }
  return b;
}

// what lib/hub.js builds with
const HUB_TOOLS = { Build, quat, doorSteps, propUp, wallSegment, gablePieces, posts, putLadder, column, putDoor, valleys, inside, surfaceAt };

if (NODE) module.exports = { generate, quat, PLAN_BY_TYPE, ROOF_BY_CULTURE, windowKit, propUp, doorSteps };
else window.VHGenerate = { generate, quat, PLAN_BY_TYPE, ROOF_BY_CULTURE };
