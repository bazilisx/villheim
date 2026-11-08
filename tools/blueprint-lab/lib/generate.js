// Villheim building generator. Builds a design from a request (type, biome, culture, stage, decor, seed)
// with a kit of real Valheim pieces, the proportions learned from the corpus, and the building conventions the
// corpus shows (posts at every bay, top plates, gables filled with roof wall pieces, eaves past the walls,
// a vent left in the ridge over an indoor fire). Coordinates: building centred on the origin, long side along x,
// the door on the -z side, ground at y = 0. Grid 2 m.

const NODE = typeof module !== 'undefined';
const S = NODE ? require('./styles.js') : window.VHStyles;
const Decor = NODE ? require('./decorate.js') : window.VHDecorate;

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function quat(yaw) { const a = yaw * Math.PI / 360; return [0, +Math.sin(a).toFixed(6), 0, +Math.cos(a).toFixed(6)]; }

class Build {
  constructor() { this.pieces = []; this.rooms = []; this.notes = []; this.vents = []; }
  put(name, x, y, z, yaw = 0, extra) {
    if (!name) return;
    this.pieces.push({ name, x: +x.toFixed(3), y: +y.toFixed(3), z: +z.toFixed(3), q: quat(yaw), yaw, ...(extra || {}) });
  }
}

function generate(req) {
  const type = S.TYPES[req.type] ? req.type : 'home';
  const T = S.TYPES[type];
  const biome = S.BIOMES.includes(req.biome) ? req.biome : 'Meadows';
  const cultureKey = S.CULTURES[req.culture] ? req.culture : S.BIOME_CULTURE[biome];
  const C = S.CULTURES[cultureKey];
  const stage = ['s1', 's2', 's3'].includes(req.stage) ? req.stage : 's1';
  const decor = ['d1', 'd2', 'd3'].includes(req.decor) ? req.decor : 'd2';
  const seed = req.seed ?? 1;
  const R = rng(seed * 7919 + type.length * 31 + stage.charCodeAt(1));
  const K = S.kitFor(biome);
  const b = new Build();

  // ---- size: bays from the type table, nudged by the seed so no two are alike
  let [bx, bz] = T.bays[stage];
  if (!T.tower && !T.well && R() < 0.5) bx += 1;
  if (!T.tower && !T.well && stage !== 's1' && R() < 0.3) bz += 1;
  if (!T.tower && !T.well && bz % 2 === 0 && (S.CULTURES[req.culture] || S.CULTURES[S.BIOME_CULTURE[req.biome] || 'norse'] || {}).roof !== 'flat') bz += 1; // ridge over a bay centre
  const W = bx, D = bz; // half length and half depth in metres (bays are 2 m)
  const storeys = T.storeys[stage];
  const tall = (T.tall || 0) + (C.label === 'Mountain lodge' ? 0 : 0);
  const SH = T.low ? 2 : (T.tower ? 3 : (type === 'longhouse' || type === 'tavern' || type === 'temple' || stage === 's3' ? 3 : 2)) + (T.tall && stage !== 's1' ? 1 : 0) * 0 + tall * 0;
  const flat = C.roof === 'flat';
  const pitch = req.pitch || (T.low ? 26 : (C.pitch || 45));
  const r = pitch === 45 ? 2 : 1; // rise per roof piece

  // ---- foundation and floor height
  let F = 0;
  const stoneBase = (C.plinth === 'stone' || (C.plinth === 'byBiome' && biome !== 'Meadows') || C.stoneGround) && K.plinth;
  if (T.dock) F = 1;
  else if (C.stilts) F = 2;
  else if (T.raised || C.raised) F = 1;
  else if (stoneBase) F = C.plinthHigh ? 2 : 1;
  const deck = C.stilts ? 2 : 0; // a deck all round on stilts

  // stilts or footing
  if (F > 0 && !T.camp && !T.well && !T.field) {
    if (C.stilts || T.dock || T.raised || C.raised || !stoneBase) {
      const pole = F >= 2 ? (K.poleLong && F >= 4 ? K.poleLong : K.pole) : K.pole1;
      for (let x = -W - deck; x <= W + deck + 0.01; x += 2)
        for (let z = -D - deck; z <= D + deck + 0.01; z += 2)
          for (let y = 0; y < F - 0.01; y += (F >= 2 ? 2 : 1)) b.put(F >= 2 ? K.pole : K.pole1, x, y + (F >= 2 ? 1 : 0.5), z);
      void pole;
    } else {
      for (let y = 0.5; y < F; y += 1) ring(b, W, D, (x, z, yaw) => b.put(K.plinth, x, y, z, yaw));
    }
  }

  // ---- special types first
  if (T.well) return finish(wellDesign(b, K, biome, stage, R), req, { type, biome, cultureKey, stage, decor, seed });
  if (T.camp) return finish(campDesign(b, K, biome, stage, R, decor), req, { type, biome, cultureKey, stage, decor, seed });

  // ---- floors
  const floorPiece = (C.stoneWalls && K.stoneFloor && F === 0) ? K.stoneFloor : K.floor;
  const floorY = floorPiece === K.stoneFloor && floorPiece === 'stone_floor_2x2' ? F - 0.5 : F;
  for (let x = -W + 1 - deck; x < W + deck; x += 2)
    for (let z = -D + 1 - deck; z < D + deck; z += 2) b.put(x < -W || x > W || z < -D || z > D ? K.floor : floorPiece, x, floorY, z);

  // ---- walls, frame and openings per storey
  const open = T.open || null;
  let top = F;
  const doorX = (bx % 2 ? 0 : -1) + (R() < 0.5 ? 0 : (bx > 3 ? 2 * Math.round(R() * 2 - 1) : 0));
  for (let s = 0; s < storeys; s++) {
    const y0 = F + s * SH;
    if (s > 0) {
      // upper floor with a ladder hole in one back corner
      for (let x = -W + 1; x < W; x += 2) for (let z = -D + 1; z < D; z += 2) {
        if (x === W - 1 && z === D - 1) continue;
        b.put(K.floor, x, y0, z);
      }
      b.put(K.ladder, W - 1, y0 - SH / 2, D - 1, 180);
      b.rooms.push({ x0: -W, x1: W, z0: -D, z1: D, y: y0, h: SH, use: T.use, upper: true, hole: [W - 1, D - 1] });
    } else {
      b.rooms.push({ x0: -W, x1: W, z0: -D, z1: D, y: y0, h: SH, use: T.use, door: { x: doorX, z: -D } });
    }
    const side = (edge) => {
      if (!open) return true;
      if (open === 'all') return false;
      if (open === 'front') return edge !== 'front';
      if (open === 'sides') return edge === 'back';
      return true;
    };
    edges(W, D, (edge, x, z, yaw, i, n) => {
      if (!side(edge) && !(T.tower && s < storeys - 1)) return;
      if (T.tower && s === storeys - 1) return; // open lookout at the top
      const isDoor = s === 0 && edge === 'front' && Math.abs(x - doorX) < 0.01;
      const isBigDoor = T.bigDoor && s === 0 && edge === 'front' && Math.abs(x - doorX) <= 2.01;
      const isWindow = !isDoor && edge !== 'front' && (i % 2 === 1) && i < n - 1 && !T.tower;
      const isWindowFront = !isDoor && edge === 'front' && Math.abs(x - doorX) > 2.5 && (i % 2 === 0);
      wallSegment(b, K, C, x, y0, z, yaw, SH, isBigDoor ? 'gate' : isDoor ? 'door' : (isWindow || isWindowFront) ? 'window' : 'wall', biome);
    });
    // frame posts at every perimeter point, top plate beams
    if (C.frame || open || T.tower) {
      corners(W, D, (x, z) => {
        for (let y = y0; y < y0 + SH - 0.01;) {
          const h = (y0 + SH - y) >= 2 ? 2 : 1;
          b.put(h === 2 ? framePole(K, C) : K.pole1, x, y + h / 2, z);
          y += h;
        }
      });
    }
    edges(W, D, (edge, x, z, yaw) => b.put(C.darkFrame && K.beam ? K.beam : K.beam, x, y0 + SH, z, yaw));
    top = y0 + SH;
  }

  // inner aisle posts for halls
  if (T.aisles && D >= 3) {
    for (let x = -W + 2; x <= W - 2; x += 2) for (const z of [-(D - 2), D - 2])
      for (let y = F; y < top - 0.01; y += 2) b.put(framePole(K, C), x, y + 1, z);
  }

  // ---- roof
  const fireInside = ['hall', 'home', 'smithy', 'temple'].includes(T.use) && !T.tower;
  if (T.tower) {
    // lookout: fence round the top floor, a roof on posts above it
    const yTop = F + (storeys - 1) * SH;
    edges(W, D, (edge, x, z, yaw) => b.put(K.fence || K.wallQuarter, x, yTop + 0.5, z, yaw));
    gableRoof(b, K, C, W, D, yTop + 3, r, { gables: false });
  } else if (flat) {
    for (let x = -W + 1; x < W; x += 2) for (let z = -D + 1; z < D; z += 2) b.put(K.floor, x, top, z);
    if (C.parapet) edges(W, D, (edge, x, z, yaw) => {
      const p = K.stoneBlock && C.stoneWalls ? K.stoneBlock : K.wallQuarter;
      if (p === K.stoneBlock) { b.put(p, x - 0.5 * Math.cos(yaw * Math.PI / 180), top + 0.5, z + 0.5 * Math.sin(yaw * Math.PI / 180), yaw); }
      else b.put(p, x, top + 0.25, z, yaw);
    });
    if (C.awnings && !T.tower) lean(b, K, -W + 1, W - 1, -D, F + SH - 0.4, biome, 1, 'front');
    b.put(K.ladder, W - 1, top - SH / 2, -D + 1, 0);
  } else {
    gableRoof(b, K, C, W, D, top, r, { vent: fireInside && T.use !== 'home' ? 0 : (fireInside ? doorX : null), eaves: C.eaves || 1, gables: true });
  }

  // porch or deck roof at the front
  if (!flat && !T.dock && !T.tower && C.porch && R() < C.porch + (stage === 's1' ? -0.3 : 0.2)) {
    const len = Math.max(2, Math.min(W * 2, 2 * Math.round((W * 2 * (0.5 + R() * 0.5)) / 2)));
    const x0 = Math.max(-W, doorX - len / 2), x1 = Math.min(W, x0 + len);
    if (!deck) for (let x = x0 + 1; x < x1; x += 2) b.put(K.floor, x, F, -D - 1);
    for (let x = x0; x <= x1 + 0.01; x += 2) {
      for (let y = 0; y < F - 0.01; y += 1) if (!deck) b.put(K.pole1, x, y + 0.5, -D - 2); // posts under a raised porch
      b.put(framePole(K, C), x, F + 1, -D - 2);
    }
    lean(b, K, x0 + 1, x1 - 1, -D, F + 2.0 + (SH > 2 ? 0.5 : 0), biome, 1, 'front');
  }

  // ---- extras by type
  if (T.dock) dockDesign(b, K, C, W, D, F, stage);
  if (T.field) fieldDesign(b, K, W, D, biome, stage, R);
  if (T.pen) penDesign(b, K, W, D, stage);
  if ((C.dragons && (type === 'longhouse' || type === 'temple' || type === 'tavern')) || (C.carved && stage !== 's1')) {
    const ridgeY = top + r * (D) / 2;
    for (const sx of [-1, 1]) b.put('wood_dragon1', sx * (W + 1.4), ridgeY + 0.3, 0, sx > 0 ? 90 : 270);
  }

  // ---- decorate
  Decor.decorate(b, { use: T.use, decor, biome, type, R, culture: cultureKey, F, W, D, SH, storeys, fireInside });
  return finish(b, req, { type, biome, cultureKey, stage, decor, seed });
}

function finish(b, req, info) {
  const name = `${info.type}_${info.biome.replace(' ', '')}_${info.cultureKey}_${info.stage}${info.decor}_${info.seed}`;
  return {
    meta: { Name: name, Creator: 'Villheim generator', Category: 'Villheim generated',
      Description: `${S.TYPES[info.type].label}, ${info.biome}, ${S.CULTURES[info.cultureKey].label}, ${info.stage}${info.decor}, seed ${info.seed}` },
    pieces: b.pieces, rooms: b.rooms, notes: b.notes, request: info,
  };
}

// ---------------------------------------------------------------- helpers

function framePole(K, C) { return C.darkFrame && K.ironPole ? 'darkwood_pole' : (K.pole || 'wood_pole2'); }

// Perimeter wall segments: 2 m each, centred on the segment. yaw 0 runs along x, 90 along z.
function edges(W, D, fn) {
  const nF = W; let i = 0;
  for (let x = -W + 1; x < W; x += 2, i++) fn('front', x, -D, 0, i, nF);
  i = 0; for (let x = -W + 1; x < W; x += 2, i++) fn('back', x, D, 0, i, nF);
  i = 0; for (let z = -D + 1; z < D; z += 2, i++) fn('left', -W, z, 90, i, D);
  i = 0; for (let z = -D + 1; z < D; z += 2, i++) fn('right', W, z, 90, i, D);
}
function corners(W, D, fn) {
  for (let x = -W; x <= W + 0.01; x += 2) { fn(x, -D); fn(x, D); }
  for (let z = -D + 2; z <= D - 1.99; z += 2) { fn(-W, z); fn(W, z); }
}
function ring(b, W, D, fn) { edges(W, D, (e, x, z, yaw) => fn(x, z, yaw)); }

function wallSegment(b, K, C, x, y0, z, yaw, SH, kind, biome) {
  const stone = C.stoneWalls && K.stoneWall;
  const log = (C.logWalls || K.wallLog) && K.wall === 'wood_wall_log' && !stone;
  const main = stone ? K.stoneWall : (log ? 'wood_wall_log' : K.wall);
  const course = stone ? 1 : (log ? 0.5 : 2); // course height of the main piece
  const fill = (from, to) => {
    let y = from;
    while (to - y > 0.01) {
      const left = to - y;
      if (course <= left + 0.01) { b.put(main, x, y + course / 2, z, yaw); y += course; }
      else if (left >= 0.99 && !log) { b.put(stone ? K.stoneWall : K.wallHalf, x, y + 0.5, z, yaw); y += 1; }
      else { b.put(log ? 'wood_wall_log' : K.wallQuarter, x, y + Math.min(0.5, left) / 2, z, yaw); y += 0.5; }
    }
  };
  if (kind === 'door' || kind === 'gate') {
    const door = kind === 'gate' ? (K.gate || K.door) : (C.arches ? 'piece_cloth_hanging_door' : K.door);
    b.put(door, x, y0 + 1, z, yaw);
    fill(y0 + 2, y0 + SH);
    return;
  }
  if (kind === 'window') {
    fill(y0, y0 + 1);
    if (K.glass && C.glass) { const dx = Math.cos(yaw * Math.PI / 180) * 0.5, dz = -Math.sin(yaw * Math.PI / 180) * 0.5; b.put(K.glass, x - dx, y0 + 1.5, z - dz, yaw); b.put(K.glass, x + dx, y0 + 1.5, z + dz, yaw); }
    else if (C.arches && K.stoneArch) { /* open arch window: leave the gap */ }
    else b.put(K.wallQuarter, x, y0 + 1.75, z, yaw); // a 0.5 m opening under a quarter wall
    fill(y0 + 2, y0 + SH);
    return;
  }
  fill(y0, y0 + SH);
}

// Gable roof along x, laid out as the corpus does it (lab/offsets.js): a 2 m ridge cap on the ridge, roof rows
// centred 2, 4, 6 m out from the ridge, each row's low edge resting on the beam at its outer edge; gable pieces sit
// under each row with their pivot on the row's low edge, plain walls fill below them. A 26 degree roof piece has its
// pivot on its low edge, a 45 degree piece in its middle. D must be odd so rows line up with the wall bays.
// top = height of the wall tops (the top plate beams). r = rise per row (1 for 26 degrees, 2 for 45).
function gableRoof(b, K, C, W, D, top, r, o = {}) {
  const roof = r === 2 ? K.roof45 : K.roof26, roofTop = r === 2 ? K.roofTop45 : K.roofTop26;
  const gable = r === 2 ? K.gable45 : K.gable26;
  const eaves = o.eaves || 1;
  const capY = top + r * (D - 1) / 2;
  const low = i => capY - r * (i + 1);                 // low edge height of row i
  const pivot = i => low(i) + (r === 2 ? 1 : 0);
  const wallRow = (D - 3) / 2;                          // the row whose outer edge is on the wall line
  // one row of eaves past the wall for 26 degrees; a 45 degree row would hang 2 m down in front of the door
  const rows = wallRow + (r === 1 ? 1 : 0) + (eaves > 1 ? 1 : 0);
  const xs = [];
  for (let x = -W + 1; x < W; x += 2) xs.push(x);
  if (eaves > 1 || o.overhang) { xs.unshift(-W - 1); xs.push(W + 1); }
  for (const x of xs) {
    for (let i = 0; i <= rows; i++) {
      const zc = 2 + 2 * i;
      b.put(roof, x, pivot(i), -zc, 180);
      b.put(roof, x, pivot(i), zc, 0);
    }
    if (o.vent == null || Math.abs(x - o.vent) > 1.01) b.put(roofTop, x, capY, 0, 0);
  }
  if (o.vent != null) b.notes.push('Ridge cap left open over the fire for smoke.');
  if (!o.gables) return;
  for (const sx of [-W, W]) {
    fillGable(b, K, sx, top, 0, capY - top); // middle column under the cap
    for (let i = 0; i <= wallRow; i++) {
      for (const sg of [-1, 1]) {
        const z = sg * (2 + 2 * i);
        fillGable(b, K, sx, top, z, low(i) - top);
        b.put(gable, sx, low(i), z, sg < 0 ? 270 : 90);
      }
    }
  }
}
function fillGable(b, K, x, from, z, h) {
  let y = from;
  while (h - (y - from) > 0.01) {
    const left = h - (y - from);
    if (left >= 2) { b.put(K.wall === 'wood_wall_log' ? 'woodwall' : (K.wall.startsWith('blackmarble') || K.wall.startsWith('stone') ? 'woodwall' : K.wall), x, y + 1, z, 90); y += 2; }
    else if (left >= 1) { b.put(K.wallHalf, x, y + 0.5, z, 90); y += 1; }
    else { b.put(K.wallQuarter, x, y + 0.25, z, 90); y += 0.5; }
  }
}

// One-row lean-to roof (porch, awning) from x0 to x1 against the front wall at z = zWall, eave height y.
function lean(b, K, x0, x1, zWall, y, biome, rows, side) {
  const roof = (biome === 'Meadows' || biome === 'Black Forest') ? K.roof26 : 'darkwood_roof';
  // one 26 degree row: high edge against the wall at y + 1, low edge 2 m out at y (pivot on the low edge)
  for (let x = x0; x <= x1 + 0.01; x += 2) b.put(roof, x, y, zWall - 1, 180);
  void rows; void side;
}

function dockDesign(b, K, C, W, D, F, stage) {
  const len = stage === 's1' ? 3 : stage === 's2' ? 5 : 7; // bays of pier out over the water (-z)
  for (let i = 0; i < len; i++) {
    const z = -D - 1 - 2 * i;
    for (const x of [-1, 1]) b.put(K.floor, x, F, z);
    for (const x of [-2, 2]) { b.put(K.pole, x, F - 1, z - 1); b.put(K.pole, x, F - 3, z - 1); }
  }
  b.put(K.pole, -2, F + 1, -D - 2 * len, 0); b.put(K.pole, 2, F + 1, -D - 2 * len, 0);
  b.notes.push('Pier runs out on the door side; place it over water.');
  void C; void W;
}

function fieldDesign(b, K, W, D, biome, stage, R) {
  const crops = { 'Meadows': 'RaspberryBush', 'Black Forest': 'Pickable_Carrot', 'Swamp': 'Pickable_Turnip',
    'Mountain': 'Pickable_Onion', 'Plains': 'Pickable_Barley', 'Mistlands': 'Pickable_Barley', 'Ashlands': 'Pickable_Barley' };
  const crop = crops[biome] || 'Pickable_Carrot';
  const fw = stage === 's1' ? 4 : stage === 's2' ? 6 : 8, fd = stage === 's1' ? 3 : 4;
  const z0 = -D - 2 - fd * 2, x0 = -fw;
  // fence round the field with a gap at the shed
  for (let x = x0 + 1; x < x0 + fw * 2; x += 2) { b.put(K.fence, x, 0.5, z0, 0); if (Math.abs(x) > 1.5) b.put(K.fence, x, 0.5, -D - 2, 0); }
  for (let z = z0 + 1; z < -D - 2; z += 2) { b.put(K.fence, x0, 0.5, z, 90); b.put(K.fence, x0 + fw * 2, 0.5, z, 90); }
  const step = crop === 'RaspberryBush' ? 1.5 : 0.75;
  for (let x = x0 + 1; x < x0 + fw * 2 - 0.5; x += step * 1.5)
    for (let z = z0 + 1; z < -D - 2.5; z += step) b.put(crop, x, 0, z, Math.floor(R() * 4) * 90);
  b.put('ArmorStand', x0 + fw, 0, z0 + fd, 0); // scarecrow
  b.notes.push(`Field of ${crop}; the ground needs cultivating in game for crops to grow back.`);
}

function penDesign(b, K, W, D, stage) {
  const pw = stage === 's1' ? 3 : 4, pd = D;
  const x0 = W, x1 = W + pw * 2;
  for (let x = x0 + 1; x < x1; x += 2) { b.put(K.fence, x, 0.5, -pd, 0); b.put(K.fence, x, 0.5, pd, 0); }
  for (let z = -pd + 1; z < pd; z += 2) if (Math.abs(z) > 1.5) b.put(K.fence, x1, 0.5, z, 90);
  b.put('wood_fence_gate' in {} ? 'wood_fence_gate' : K.fence, x1, 0.5, 1, 90);
  b.put('piece_chest_barrel', x1 - 1, 0, pd - 1, 0);
  b.put('wood_stack', x0 + 1.2, 0, pd - 1, 0);
  b.notes.push('Pen beside the barn; the open side faces the barn door.');
}

function wellDesign(b, K, biome, stage, R) {
  const stone = K.stoneBlock || 'stone_wall_1x1';
  const st = biome === 'Meadows' ? 'wood_wall_quarter' : stone;
  for (const [x, z, yaw] of [[0, -1, 0], [0, 1, 0], [-1, 0, 90], [1, 0, 90]]) b.put(st, x, 0.5, z, yaw);
  for (const x of [-1.2, 1.2]) { b.put(K.pole, x, 1, 0); b.put(K.pole1, x, 2.5, 0); }
  b.put(K.beam || 'wood_beam', 0, 3, 0, 0);
  const roof = K.roof26; // low edges at 2 m, meeting on the beam at 3 m
  b.put(roof, 0, 2, -1, 180); b.put(roof, 0, 2, 1, 0);
  b.put('piece_chest_barrel', 1.6, 0, 1.6, 0);
  if (stage !== 's1') { b.put('piece_groundtorch_wood', -1.8, 0, -1.8, 0); b.put('piece_bench01', 0, 0, -2.6, 0); }
  b.notes.push('Well; Valheim has no water source piece, so the shaft is for looks.');
  void R;
  return b;
}

function campDesign(b, K, biome, stage, R, decor) {
  b.put('fire_pit', 0, 0, 0, 0);
  b.put('piece_cookingstation', 0, 0.4, 0, 0);
  const n = stage === 's1' ? 2 : 3;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI + R() * 0.4;
    b.put('piece_logbench01', Math.sin(a) * 2.6, 0, Math.cos(a) * 2.6, (a * 180 / Math.PI + 180) % 360);
  }
  // lean-to shelter
  const roof = K.roof45;
  for (const x of [-1, 1]) { b.put(K.pole, x * 2, 1, 5, 0); b.put(roof, x, 1.2, 4.6, 0); }
  b.put('bed', 0, 0, 5, 90);
  if (decor !== 'd1') { b.put('wood_stack', 3.5, 0, 3, 30); b.put('piece_chest_wood', -3.5, 0, 3, 150); }
  if (decor === 'd3') { b.put('piece_groundtorch_wood', 3.6, 0, -2, 0); b.put('rug_deer', 0, 0.02, 4.3, 0); b.put('itemstand', -2, 1.5, 5.3, 180); }
  return b;
}

if (NODE) module.exports = { generate, quat };
else window.VHGenerate = { generate, quat };
