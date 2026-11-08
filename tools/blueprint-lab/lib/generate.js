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

const NODE = typeof module !== 'undefined';
const S = NODE ? require('./styles.js') : window.VHStyles;
const Decor = NODE ? require('./decorate.js') : window.VHDecorate;

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function quat(yaw) { const a = yaw * Math.PI / 360; return [0, +Math.sin(a).toFixed(6), 0, +Math.cos(a).toFixed(6)]; }
const norm = a => ((a % 360) + 360) % 360;

class Build {
  constructor() { this.pieces = []; this.rooms = []; this.notes = []; }
  put(name, x, y, z, yaw = 0, extra) {
    if (!name) return;
    yaw = norm(yaw);
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
  home: { s1: { rect: 6, square: 2 }, s2: { rect: 4, L: 3, T: 1 }, s3: { L: 3, T: 3, rect: 2, cross: 1 } },
  longhouse: { s1: { long: 1 }, s2: { long: 3, T: 1 }, s3: { long: 2, T: 2, cross: 1 } },
  tavern: { s1: { rect: 1 }, s2: { L: 2, T: 2, rect: 1 }, s3: { T: 2, cross: 1, U: 1 } },
  smithy: { s1: { rect: 1 }, s2: { rect: 2, L: 1 }, s3: { L: 2, T: 1 } },
  sawmill: { s1: { rect: 1 }, s2: { rect: 2, L: 1 }, s3: { L: 1, rect: 1 } },
  workshop: { s1: { rect: 1 }, s2: { rect: 2, L: 1 }, s3: { L: 2, T: 1 } },
  barn: { s1: { rect: 1 }, s2: { rect: 2, long: 1 }, s3: { long: 1, L: 1 } },
  farm: { s1: { rect: 1 }, s2: { rect: 1 }, s3: { rect: 1, L: 1 } },
  storage: { s1: { rect: 1, square: 1 }, s2: { rect: 2, L: 1 }, s3: { L: 1, T: 1 } },
  tower: { s1: { square: 1 }, s2: { square: 1 }, s3: { square: 3, octagon: 1 } },
  dock: { s1: { rect: 1 }, s2: { rect: 1 }, s3: { rect: 1, L: 1 } },
  stall: { s1: { rect: 1 }, s2: { rect: 1 }, s3: { rect: 1, L: 1 } },
  temple: { s1: { rect: 1 }, s2: { rect: 1, cross: 1, octagon: 1 }, s3: { cross: 2, octagon: 1 } },
};
const ROOF_BY_CULTURE = {
  'norse': { gable: 6, hip: 1 }, 'black-forest': { gable: 5, hip: 2 }, 'swamp': { gable: 4, hip: 3 },
  'mountain': { gable: 6, hip: 1 }, 'middle-eastern': { flat: 1 }, 'east-asian': { hip: 4, gable: 1 },
  'castle-medieval': { gable: 5, hip: 2 }, 'dwarven': { flat: 2, hip: 1 }, 'slavic': { gable: 5, hip: 1 }, 'celtic': { conical: 1 },
};
function pick(R, weights) {
  const e = Object.entries(weights), tot = e.reduce((s, [, w]) => s + w, 0);
  let x = R() * tot;
  for (const [k, w] of e) { if ((x -= w) <= 0) return k; }
  return e[0][0];
}

// Wings for a plan, from the main wing's half sizes W (along x) and D (across, odd).
function wingsFor(plan, W, D, R) {
  const odd = n => (n % 2 ? n : n + 1);
  const wD = Math.max(1, odd(D - 2)); // side wings are a bay narrower
  switch (plan) {
    case 'L': {
      const side = R() < 0.5 ? -1 : 1, len = odd(Math.max(2, D + 1));
      // side wing runs toward the front (-z) from one end of the main wing
      return [{ cx: 0, cz: 0, W, D, alpha: 0, main: true }, { cx: side * (W - wD), cz: -len, W: len, D: wD, alpha: 270 }];
    }
    case 'T': {
      const len = Math.max(2, D + 1);
      return [{ cx: 0, cz: 0, W, D, alpha: 0, main: true }, { cx: 0, cz: len, W: len, D: wD, alpha: 270 }];
    }
    case 'cross': {
      const len = Math.max(2, D);
      return [{ cx: 0, cz: 0, W, D, alpha: 0, main: true }, { cx: 0, cz: len, W: len, D: wD, alpha: 270 }, { cx: 0, cz: -len, W: len, D: wD, alpha: 270 }];
    }
    case 'U': {
      const len = D + 2 + (D % 2 ? 0 : 1);
      return [{ cx: 0, cz: D, W, D, alpha: 0, main: true },
        { cx: -(W - wD), cz: D - len + 1, W: len, D: wD, alpha: 270 }, { cx: W - wD, cz: D - len + 1, W: len, D: wD, alpha: 270 }];
    }
    default:
      return [{ cx: 0, cz: 0, W, D, alpha: 0, main: true }];
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

// ---------------------------------------------------------------- generator

function generate(req) {
  const type = S.TYPES[req.type] ? req.type : 'home';
  const T = S.TYPES[type];
  const biome = S.BIOMES.includes(req.biome) ? req.biome : 'Meadows';
  const cultureKey = S.CULTURES[req.culture] ? req.culture : S.BIOME_CULTURE[biome];
  const C = S.CULTURES[cultureKey];
  const stage = ['s1', 's2', 's3'].includes(req.stage) ? req.stage : 's1';
  const decor = ['d1', 'd2', 'd3'].includes(req.decor) ? req.decor : 'd2';
  const seed = req.seed ?? 1;
  const R = rng(seed * 7919 + type.length * 31 + stage.charCodeAt(1) * 7 + cultureKey.length);
  const K = S.kitFor(biome);
  const b = new Build();
  const info = { type, biome, cultureKey, stage, decor, seed };

  if (T.well) return finish(wellDesign(b, K, biome, stage), info);
  if (T.camp) return finish(campDesign(b, K, biome, stage, R, decor), info);

  // ---- plan and roof
  let plan = req.plan && req.plan !== 'auto' ? req.plan : null;
  if (!plan) {
    if (C.round) plan = 'octagon';
    else if (C.courtyard && stage === 's3' && !T.tower) plan = 'U';
    else plan = pick(R, (PLAN_BY_TYPE[type] || PLAN_BY_TYPE.home)[stage]);
  }
  let roofKind = req.roof && req.roof !== 'auto' ? req.roof : null;
  if (!roofKind) roofKind = plan === 'octagon' ? 'conical' : pick(R, ROOF_BY_CULTURE[cultureKey] || { gable: 1 });
  if (T.open === 'sides' && !req.roof && R() < 0.4) roofKind = 'shed';
  if (plan === 'octagon' && roofKind !== 'flat') roofKind = 'conical';
  if (plan !== 'octagon' && roofKind === 'conical') roofKind = 'hip';
  if (roofKind === 'shed' && plan !== 'rect' && plan !== 'long' && plan !== 'square') plan = 'rect';
  info.plan = plan; info.roof = roofKind;

  // ---- size
  let [bx, bz] = T.bays[stage];
  if (plan === 'long') bx = Math.max(bx + 2, Math.round(bz * 2.4));
  if (!T.tower && R() < 0.5 && plan !== 'square') bx += 1;
  if (!T.tower && stage !== 's1' && R() < 0.3 && plan !== 'square') bz += 1;
  if (bz % 2 === 0 && roofKind !== 'flat') bz += 1; // a ridge over a bay centre
  if (plan === 'square') bx = bz = Math.max(bx, bz) % 2 ? Math.max(bx, bz) : Math.max(bx, bz) + 1;
  if (roofKind === 'hip' && bx < bz) bx = bz;
  const W = bx, D = bz;
  const storeys = T.storeys[stage];
  const SH = T.low ? 2 : T.tower ? 3 : (['longhouse', 'tavern', 'temple'].includes(type) || stage === 's3') ? 3 : 2;
  const flat = roofKind === 'flat';
  const pitch = req.pitch || (T.low || roofKind === 'shed' ? 26 : (C.pitch || 45));
  const r = +pitch === 45 ? 2 : 1;

  // ---- foundation height
  let F = 0;
  const stoneBase = (C.plinth === 'stone' || (C.plinth === 'byBiome' && biome !== 'Meadows') || C.stoneGround) && K.plinth;
  if (T.dock) F = 1; else if (C.stilts) F = 2; else if (T.raised || C.raised) F = 1; else if (stoneBase) F = C.plinthHigh ? 2 : 1;
  const deck = C.stilts && plan !== 'octagon' ? 2 : 0;

  if (plan === 'octagon') {
    octagonDesign(b, K, C, { W: Math.max(3, Math.round((W + D) / 2)), F, SH, storeys, r, T, biome, stoneBase });
  } else {
    const wings = wingsFor(plan, W, D, R);
    const cells = cellsOf(wings);
    const edges = edgesOf(cells);
    const verts = vertsOf(edges);

    // footing: stilts and short posts on a grid, or a stone course round the edge
    if (F > 0 && !T.field) {
      if (C.stilts || T.dock || T.raised || C.raised || !stoneBase) {
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
    for (const [k, [x, z]] of floorCells) b.put(cells.has(k) ? floorPiece : K.floor, x, floorY, z);

    // door: the front edge of the main wing nearest the middle
    const front = edges.filter(e => e.out[1] < 0 && inside(wings[0], e.cell[0], e.cell[1])).sort((a, c) => Math.abs(a.x) - Math.abs(c.x));
    const door = front.length ? front[0] : edges.filter(e => e.out[1] < 0)[0] || edges[0];
    const doorX = door.x, doorZ = door.z;

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
      const isTopLookout = T.tower && s === storeys - 1;
      for (const e of edges) {
        if (isTopLookout) { b.put(K.fence || K.wallQuarter, e.x, y0 + 0.5, e.z, e.yaw); continue; }
        if (open === 'all') continue;
        if (open === 'front' && e.out[1] < 0) continue;
        if (open === 'sides' && !(e.out[1] > 0)) continue;
        const isDoor = s === 0 && e === door;
        const isGate = T.bigDoor && s === 0 && e.out[1] < 0 && Math.abs(e.x - doorX) <= 2.01 && Math.abs(e.z - doorZ) < 0.1;
        const isWindow = !isDoor && !isGate && !T.tower && (Math.round((e.x + e.z) / 2) % 2 === 0) && Math.abs(e.x - doorX) + Math.abs(e.z - doorZ) > 2.5;
        wallSegment(b, K, C, e.x, y0, e.z, e.yaw, SH, isGate ? 'gate' : isDoor ? 'door' : isWindow ? 'window' : 'wall');
      }
      if (C.frame || open || T.tower) for (const [x, z] of verts) {
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
          if (open === 'all' || (open === 'front' && e.out[1] < 0) || (open === 'sides' && !(e.out[1] > 0))) continue;
          const ux = e.yaw === 0 ? 1 : 0, uz = e.yaw === 0 ? 0 : 1, nx = -e.out[0], nz = -e.out[1];
          for (const t of [-0.5, 0.5]) room.slots.push({ x: e.x + ux * t, z: e.z + uz * t, y: y0, yaw: e.inYaw, nx, nz });
        }
        if (s > 0) room.hole = hole;
        b.rooms.push(room);
      }
      top = y0 + SH;
    }
    b.doorX = doorX;

    // inner aisle posts for halls
    if (T.aisles && D >= 3 && plan === 'long') for (let x = -W + 2; x <= W - 2; x += 2) for (const z of [-(D - 2), D - 2])
      for (let y = F; y < top - 0.01; y += 2) b.put(framePole(K, C), x, y + 1, z);

    // ---- roof
    const fireInside = ['hall', 'home', 'smithy', 'temple'].includes(T.use) && !T.tower;
    const roofTop = T.tower ? F + (storeys - 1) * SH + 3 : top;
    if (flat && !T.tower) flatRoof(b, K, C, cells, edges, top, F, SH, biome);
    else if (roofKind === 'shed') shedRoof(b, K, wings[0], roofTop, r);
    else {
      const parts = [];
      for (const w of wings) {
        const others = wings.filter(o => o !== w);
        const ends = [-1, 1].map(sg => { const [x, z] = toWorld(w, sg * (w.W + 0.5), 0, 0); return !others.some(o => inside(o, x, z)); });
        const kind = roofKind === 'hip' && w.main && w.W >= w.D ? 'hip' : 'gable';
        const vent = fireInside && w.main ? (T.use === 'home' ? doorX : 0) : null;
        parts.push(...(kind === 'hip' ? hipPieces(K, w, roofTop, r) : gablePieces(K, C, w, roofTop, r, ends, vent)));
      }
      // where wings cross, keep the higher roof so the lower roof runs into the higher one
      for (const p of parts) {
        const hidden = wings.some(o => o !== p.wing && inside(o, p.x, p.z, -0.2) && p.surf < surfaceAt(o, p.x, p.z, roofTop, r) - 0.25);
        if (!hidden) b.put(p.name, p.x, p.y, p.z, p.yaw);
      }
      if (fireInside) b.notes.push('Ridge cap left open over the fire for smoke.');
    }

    // porch at the front door
    if (!flat && roofKind !== 'shed' && !T.dock && !T.tower && C.porch && R() < C.porch + (stage === 's1' ? -0.3 : 0.2) && plan !== 'U' && plan !== 'cross' && !deck) {
      const len = 4 + 2 * Math.floor(R() * 2), x0 = doorX - len / 2, x1 = x0 + len, zf = doorZ;
      for (let x = x0 + 1; x < x1; x += 2) b.put(K.floor, x, F, zf - 1);
      for (let x = x0; x <= x1 + 0.01; x += 2) {
        for (let y = 0; y < F - 0.01; y += 1) b.put(K.pole1, x, y + 0.5, zf - 2);
        b.put(framePole(K, C), x, F + 1, zf - 2);
      }
      for (let x = x0 + 1; x < x1; x += 2) b.put((biome === 'Meadows' || biome === 'Black Forest') ? K.roof26 : 'darkwood_roof', x, F + 2, zf - 1, 180);
    }
    if (T.dock) dockDesign(b, K, W, D, F, stage);
    if (T.field) fieldDesign(b, K, W, D, biome, stage, R);
    if (T.pen) penDesign(b, K, W, D, stage);
    if (roofKind === 'gable' && ((C.dragons && ['longhouse', 'temple', 'tavern'].includes(type)) || (C.carved && stage !== 's1')))
      for (const sx of [-1, 1]) b.put('wood_dragon1', sx * (W + 0.6), roofTop + r * (D - 1) / 2 + 0.3, 0, sx > 0 ? 90 : 270);
  }

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
  const name = `${info.type}_${info.biome.replace(' ', '')}_${info.cultureKey}_${info.plan || 'x'}-${info.roof || 'x'}_${info.stage}${info.decor}_${info.seed}`;
  return {
    meta: { Name: name, Creator: 'Villheim generator', Category: 'Villheim generated',
      Description: `${S.TYPES[info.type].label}, ${info.biome}, ${S.CULTURES[info.cultureKey].label}, ${info.plan || ''} plan, ${info.roof || ''} roof, ${info.stage}${info.decor}, seed ${info.seed}` },
    pieces: b.pieces, rooms: b.rooms, notes: [...new Set(b.notes)], request: info,
  };
}

// ---------------------------------------------------------------- walls

function framePole(K, C) { return C.darkFrame ? 'darkwood_pole' : (K.pole || 'wood_pole2'); }

function wallSegment(b, K, C, x, y0, z, yaw, SH, kind) {
  const stone = C.stoneWalls && K.stoneWall;
  const log = (C.logWalls || K.wallLog) && K.wall === 'wood_wall_log' && !stone;
  const main = stone ? K.stoneWall : (log ? 'wood_wall_log' : K.wall);
  const course = stone ? (/2x2/.test(K.stoneWall) ? 2 : 1) : (log ? 0.5 : 2);
  const fill = (from, to) => {
    let y = from;
    while (to - y > 0.01) {
      const left = to - y;
      if (course <= left + 0.01) { b.put(main, x, y + course / 2, z, yaw); y += course; }
      else if (left >= 0.99 && !log) { b.put(stone && course === 1 ? K.stoneWall : K.wallHalf, x, y + 0.5, z, yaw); y += 1; }
      else { b.put(log ? 'wood_wall_log' : K.wallQuarter, x, y + Math.min(0.5, left) / 2, z, yaw); y += 0.5; }
    }
  };
  if (kind === 'door' || kind === 'gate') {
    b.put(kind === 'gate' ? (K.gate || K.door) : (C.arches ? 'piece_cloth_hanging_door' : K.door), x, y0 + 1, z, yaw);
    fill(y0 + 2, y0 + SH); return;
  }
  if (kind === 'window') {
    fill(y0, y0 + 1);
    if (K.glass && C.glass) { const dx = Math.cos(yaw * Math.PI / 180) * 0.5, dz = -Math.sin(yaw * Math.PI / 180) * 0.5; b.put(K.glass, x - dx, y0 + 1.5, z - dz, yaw); b.put(K.glass, x + dx, y0 + 1.5, z + dz, yaw); }
    else if (!C.arches) b.put(K.wallQuarter, x, y0 + 1.75, z, yaw);
    fill(y0 + 2, y0 + SH); return;
  }
  fill(y0, y0 + SH);
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
  for (let u = -w.W + 1; u < w.W; u += 2) {
    for (let i = 0; i <= rows; i++) {
      const v = 2 + 2 * i, surf = low(i) + r / 2;
      add(roof, u, pivot(i), -v, 180, 'roof', surf); add(roof, u, pivot(i), v, 0, 'roof', surf);
    }
    const [vx] = toWorld(w, u, 0, 0);
    if (vent == null || Math.abs(vx - vent) > 1.01) add(roofTop, u, capY, 0, 0, 'cap', capY + 0.3);
  }
  [-1, 1].forEach((sg, k) => {
    if (!ends[k]) return;
    const u = sg * w.W;
    gableFill(K, add, u, top, 0, capY - top);
    for (let i = 0; i <= wallRow; i++) for (const sv of [-1, 1]) {
      const v = sv * (2 + 2 * i);
      gableFill(K, add, u, top, v, low(i) - top);
      add(gable, u, low(i), v, sv < 0 ? 270 : 90, 'gable', low(i) + r);
    }
  });
  return out;
}
function gableFill(K, add, u, from, v, h) {
  const wall = /^(wood_wall_log|blackmarble|stone|Piece_grausten)/.test(K.wall) ? 'woodwall' : K.wall;
  let y = from;
  while (h - (y - from) > 0.01) {
    const left = h - (y - from);
    if (left >= 2) { add(wall, u, y + 1, v, 90, 'gable', y + 2); y += 2; }
    else if (left >= 1) { add(K.wallHalf, u, y + 0.5, v, 90, 'gable', y + 1); y += 1; }
    else { add(K.wallQuarter, u, y + 0.25, v, 90, 'gable', y + 0.5); y += 0.5; }
  }
}

// Hip roof: rings of rows on all four sides with corner pieces, a ridge along what is left (needs W >= D).
// Corner yaw per corner from the corpus: front-left 180, front-right 90, back-right 0, back-left 270, each on its
// row's low edge (lab/offsets.js: ocorner to roof).
function hipPieces(K, w, top, r) {
  const roof = r === 2 ? K.roof45 : K.roof26, roofTop = r === 2 ? K.roofTop45 : K.roofTop26;
  const corner = r === 2 ? (K.roof45 || '').replace('_45', '_ocorner_45') : (K.roof26 || '') + '_ocorner';
  const capY = capOf(w, top, r), low = i => capY - r * (i + 1), pivot = i => low(i) + (r === 2 ? 1 : 0);
  const Xr = w.W - w.D, rows = (w.D - 3) / 2 + (r === 1 ? 1 : 0);
  const out = [], add = (name, u, y, v, yaw, role, surf) => { const [x, z, wy] = toWorld(w, u, v, yaw); out.push({ name, x, y, z, yaw: wy, role, surf, wing: w }); };
  for (let u = -Xr; u <= Xr + 0.01; u += 2) add(roofTop, u, capY, 0, 0, 'cap', capY + 0.3);
  for (let i = 0; i <= rows; i++) {
    const d = 2 + 2 * i, surf = low(i) + r / 2;
    for (let u = -(Xr + 2 * i); u <= Xr + 2 * i + 0.01; u += 2) { add(roof, u, pivot(i), -d, 180, 'roof', surf); add(roof, u, pivot(i), d, 0, 'roof', surf); }
    for (let v = -2 * i; v <= 2 * i + 0.01; v += 2) { add(roof, -(Xr + d), pivot(i), v, 270, 'roof', surf); add(roof, Xr + d, pivot(i), v, 90, 'roof', surf); }
    add(corner, -(Xr + d), low(i), -d, 180, 'roof', surf); add(corner, Xr + d, low(i), -d, 90, 'roof', surf);
    add(corner, Xr + d, low(i), d, 0, 'roof', surf); add(corner, -(Xr + d), low(i), d, 270, 'roof', surf);
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

// ---------------------------------------------------------------- octagon (round houses, round towers)

function octagonDesign(b, K, C, o) {
  const { F, SH, storeys, r, T } = o;
  const side = o.W >= 4 ? 4 : 2;                     // wall length per side
  const ap = side / 2 / Math.tan(Math.PI / 8);        // apothem
  const seg = side / 2;                               // 2 m walls per side
  const inOct = (x, z, m = 0) => [0, 45, 90, 135].every(a => Math.abs(x * Math.sin(a * Math.PI / 180) + z * Math.cos(a * Math.PI / 180)) <= ap - m);
  const Rr = Math.ceil(ap);
  for (let x = -Rr + 1; x < Rr; x += 2) for (let z = -Rr + 1; z < Rr; z += 2) {
    if (inOct(x, z, 0.99)) b.put(K.floor, x, F, z);
    else for (const dx of [-0.5, 0.5]) for (const dz of [-0.5, 0.5]) if (inOct(x + dx, z + dz, 0.45)) b.put(K.floor1, x + dx, F, z + dz);
  }
  if (F > 0) { for (let i = 0; i < 8; i++) { const a = i * 45 * Math.PI / 180; for (let y = 0; y < F - 0.01; y += 1) b.put(K.pole1, Math.sin(a) * ap * 0.98, y + 0.5, Math.cos(a) * ap * 0.98); } for (let y = 0; y < F - 0.01; y += 1) b.put(K.pole1, 0, y + 0.5, 0); }
  let top = F;
  const slots = [];
  for (let s = 0; s < storeys; s++) {
    const y0 = F + s * SH;
    for (let i = 0; i < 8; i++) {
      const a = i * 45, ar = a * Math.PI / 180;
      const nx = Math.sin(ar), nz = Math.cos(ar);       // outward normal of this side
      const tx = Math.cos(ar), tz = -Math.sin(ar);      // along the side (local x of a piece with yaw a)
      for (let k = 0; k < seg; k++) {
        const t = -side / 2 + 1 + 2 * k, x = nx * ap + tx * t, z = nz * ap + tz * t;
        const isDoor = s === 0 && i === 4 && k === Math.floor(seg / 2);
        wallSegment(b, K, C, x, y0, z, a, SH, isDoor ? 'door' : (k === 0 && i % 2 ? 'window' : 'wall'));
        if (s === 0 && !isDoor) for (const dt of [-0.5, 0.5]) slots.push({ x: x + tx * dt, z: z + tz * dt, y: y0, yaw: norm(a + 180), nx: -nx, nz: -nz });
        b.put(K.beam, x, y0 + SH, z, a);
      }
      const vx = nx * ap + tx * side / 2, vz = nz * ap + tz * side / 2;
      for (let y = y0; y < y0 + SH - 0.01;) { const h = (y0 + SH - y) >= 2 ? 2 : 1; b.put(h === 2 ? K.pole : K.pole1, vx, y + h / 2, vz); y += h; }
    }
    top = y0 + SH;
  }
  b.rooms.push({ x0: -ap, x1: ap, z0: -ap, z1: ap, y: F, h: SH, use: T.use, slots, door: { x: 0, z: -ap }, main: true });
  b.doorX = 0;
  // ring roof: each ring 2 m further in and one row higher, pieces turned to rise toward the middle
  const roof = r === 2 ? K.roof45 : K.roof26;
  for (let i = 0; ; i++) {
    const rho = ap - 1 - 2 * i + 2; // first ring centred 1 m outside the wall line
    if (rho < 1.2) break;
    const lowY = top + r * (i - 1);
    const n = Math.max(4, Math.ceil(2 * Math.PI * rho / 1.7)); // a little overlap so the ring has no gaps
    for (let k = 0; k < n; k++) {
      const phi = k * 360 / n, pr = phi * Math.PI / 180;
      b.put(roof, Math.sin(pr) * rho, lowY + (r === 2 ? 1 : 0), Math.cos(pr) * rho, phi);
    }
  }
  b.notes.push('Round plan: eight walls and a ring roof, each ring turned toward the middle.');
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
