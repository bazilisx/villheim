// The village hub: the central hearth (D-139, Tyler 2026-11-11: "The hub is the hearth. Synonymous. ... It's its own
// building plot ... the hearth must 1000% grow and evolve and become a grand central building across stages and decor
// too"). Five stages on one plot (D-138; D-083 the plot is sized for s5), built round the village hearth fire at the
// plot's middle (0, 0). The main door faces -z, as in lib/generate.js.
//
// Lines (shape family kept from s2 on, D-132):
//   long   a long hall round the fire: small hall, aisled longhouse with a high seat, great hall with a loft and a
//          porch, a mead hall with a gallery over both aisles and an end loft (corpus Norse hall median 20 x 36 m,
//          11 m, 3 storeys; docs/handoffs/2026-11-10-design/hubs.md section 2)
//   round  a round hall: a ring of walls round the fire under a ring roof, growing from 10 m to 30 m across; the
//          Norse round line (Tyler's hub1 mock-up, D-140: a guide only) has a drum of high windows and an inner cone
//          from s4; the Celtic line has rings of posts and one cone with an open crown (Navan Fort)
//   court  rooms round an open yard with the fire in the middle of the yard: one wing with an arcade, then three,
//          then four with an iwan facing the yard and a tower, then two storeys and four corner towers
// s1 in every line is the camp: a fire pit with a cooking station, log benches about 3 m out, lean-tos 5 to 9 m out
// opening to the fire, the notice board and chests at the edge (hub1 s1 measures as a guide, D-140).
//
// The notice board stands in the hearth area at every stage (D-140); from s4 the hall also carries the notices as
// signs on a wall by the door. The leader's place is written as a marker (D-141 C): section '#VillheimLeader' in the
// blueprint, line 'seat;x;y;z;yaw' (the high seat or, before there is one, the seat the leader takes by the fire).
// Empty item stands wait for the village's bigger mementos (D-134); the generator leaves them empty.

const NODE_H = typeof module !== 'undefined';
const SH = NODE_H ? require('./styles.js') : window.VHStyles;
const PH = NODE_H ? require('./pieces.js') : window.VHPieces;
const CkH = () => (NODE_H ? require('./checks.js') : window.VHChecks);
const BPH = () => (NODE_H ? require('./blueprint.js') : window.VHBlueprint);

const STAGES = ['s1', 's2', 's3', 's4', 's5'];

// Grand building features in the corpus (hubs.md "Grand buildings for s5", 181 ranked vanilla builds): share of builds
// with the feature in the rest of the set and in the top tenth. s5 draws each with the top tenth's share, s4 with the
// rest's, from one number per village and feature, so a feature an s4 hub has stays at s5.
const GRAND = {
  fires3: [0.17, 0.63], aisle8: [0.36, 0.89], porch6: [0.17, 0.47], dais: [0.07, 0.32],
  highWindows: [0.04, 0.21], towers2: [0.04, 0.16], anyTower: [0.36, 0.37], gallery: [0.09, 0.11],
};

function rngH(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const hashH = s => [...String(s)].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);
const normH = a => ((a % 360) + 360) % 360;
const rad = d => d * Math.PI / 180;

// The line for a culture (styles.js HUB): Norse picks long or round per village while D-137 is open (value in use B).
function lineFor(cultureKey, lineage, asked) {
  if (asked && ['long', 'round', 'court'].includes(asked)) return asked;
  const H = SH.HUB || {};
  const own = (H.lines || {})[cultureKey];
  if (cultureKey === 'norse') {
    const d = H.d137 || 'B';
    if (d === 'A') return 'round';
    if (d === 'C') return 'long';
    return rngH(lineage * 7349 + 11)() < 0.5 ? 'long' : 'round';
  }
  return own || 'long';
}

// Feature draw for a village: has(feature, stage)
function featureDraw(lineage, cultureKey) {
  return (f, stage) => {
    const u = rngH(hashH(`${lineage}|${cultureKey}|${f}`))();
    const k = +stage[1];
    if (k < 4) return false;
    return u < GRAND[f][k === 5 ? 1 : 0];
  };
}

// ---------------------------------------------------------------- placing with room to walk

// Furniture and decor go in only where they clip nothing hard (walls, doors, posts, stairs, other furniture) and leave
// the keep-clear zones open (doorways, ladders, the way from the door to the fire and the high seat). D-148: a piece
// that would block the way is not placed.
function placer(b, T) {
  const Ck = CkH();
  const HARD = ['wall', 'door', 'window', 'pole', 'stair', 'gable', 'fence'];
  const FURN = ['bed', 'table', 'seat', 'storage', 'craft', 'fire', 'clutter', 'light'];
  const hard = [], furn = [];
  let seen = 0;
  const refresh = () => {
    for (; seen < b.pieces.length; seen++) {
      const p = b.pieces[seen], info = PH.piece(p.name), bx = Ck.gameBox(p);
      if (HARD.includes(info.role)) hard.push(bx); else if (FURN.includes(info.role)) furn.push(bx);
    }
  };
  const keep = [];
  const over = (a, c, e = 0.03) => a.x0 < c.x1 - e && a.x1 > c.x0 + e && a.z0 < c.z1 - e && a.z1 > c.z0 + e && a.y0 < c.y1 - e && a.y1 > c.y0 + e;
  return {
    keep(x0, x1, z0, z1, y0 = -1, y1 = 100, always = false) { keep.push({ x0, x1, z0, z1, y0, y1, always }); },
    put(name, x, y, z, yaw, extra = {}, o = {}) {
      refresh();
      const p = { name, x, y, z, yaw: normH(yaw), q: T.quat(normH(yaw)) };
      const bx = Ck.gameBox(p);
      if (!o.free) {
        if (hard.some(h => over(bx, h))) return false;
        if (!o.onFurn && furn.some(h => over(bx, h, 0.01))) return false;
        if (keep.some(k => (k.always || !o.inKeep) && over(bx, k, 0))) return false;
      }
      b.put(name, x, y, z, yaw, { decor: true, ...extra });
      return true;
    },
  };
}

// ---------------------------------------------------------------- the s1 camp (also the fire ring of later stages)

// A lean-to whose open side faces the fire: two 2 m posts at the front, a beam, two rows of 26 degree roof down to the
// ground behind (hub1 s1: 4 m wide, 4 m deep, 2 m high at the front). bearing: degrees from +z, d0: distance of the
// front from the fire.
function leanTo(b, K, bearing, d0) {
  const n = [Math.sin(rad(bearing)), Math.cos(rad(bearing))], t = [Math.cos(rad(bearing)), -Math.sin(rad(bearing))];
  const at = (r, s) => [n[0] * r + t[0] * s, n[1] * r + t[1] * s];
  for (const s of [-1.9, 1.9]) { const [x, z] = at(d0, s); b.put(K.pole, x, 1, z, bearing); }
  for (const s of [-1, 1]) {
    const [bx, bz] = at(d0, s); b.put(K.beam, bx, 2.1, bz, bearing);
    const [x1, z1] = at(d0 + 1, s); b.put(K.roof26, x1, 1, z1, bearing);
    const [x2, z2] = at(d0 + 3, s); b.put(K.roof26, x2, 0, z2, bearing);
  }
  return { bearing, d0, at };
}

// The notice board (D-140): two posts, a board of planks, a cap, and notices as signs on both faces. A sign's info is
// its heading in the game (the mod reads it).
function noticeBoard(b, K, x, z, yaw) {
  const ux = Math.cos(rad(yaw)), uz = -Math.sin(rad(yaw)), nx = Math.sin(rad(yaw)), nz = Math.cos(rad(yaw));
  for (const s of [-1.1, 1.1]) b.put(K.pole, x + ux * s, 1, z + uz * s, yaw, { notice: true });
  b.put(K.wallHalf || 'wood_wall_half', x, 1.5, z, yaw, { notice: true });
  b.put(K.beam, x, 2.1, z, yaw, { notice: true });
  const heads = ['Village notices', 'Work wanted', 'Trades'];
  [-0.55, 0, 0.55].forEach((s, i) => { for (const f of [-1, 1]) b.put('sign', x + ux * s + nx * f * 0.16, 1.55 + (i === 1 ? 0.2 : 0), z + uz * s + nz * f * 0.16, f > 0 ? yaw : yaw + 180, { decor: true, notice: true, info: heads[i] }); });
}

// Signs on a wall by the door (the notices on an open wall, D-140). wall: { x, z, yaw, nx, nz } of a wall bay, n into
// the room.
function noticeWall(b, w, y0) {
  const ux = Math.cos(rad(w.yaw)), uz = -Math.sin(rad(w.yaw));
  const yawIn = normH(Math.atan2(w.nx, w.nz) * 180 / Math.PI);
  [-0.6, 0, 0.6].forEach((s, i) => b.put('sign', w.x + ux * s + w.nx * 0.15, y0 + 1.5 + (i % 2) * 0.35, w.z + uz * s + w.nz * 0.15, yawIn, { decor: true, notice: true, info: ['Village notices', 'Work wanted', 'Trades'][i] }));
}

function campDesign(b, K, T, o) {
  const { R, cultureKey, decor, place } = o;
  b.put('fire_pit', 0, 0, 0, 0, { decor: true, hearth: true });
  b.put('piece_cookingstation', 0, 0.4, 0, 0, { decor: true });
  // lean-tos: three most often, two or four (hub1 s1: three, 113 to 134 degrees apart, 5.4 to 8.8 m out); never on the
  // door side (the roads come in at -z)
  const n = R() < 0.6 ? 3 : R() < 0.5 ? 2 : 4;
  const start = 60 + R() * 20, step = (360 - 2 * start) / Math.max(1, n - 1);
  const shelters = [];
  for (let i = 0; i < n; i++) {
    const bearing = n === 1 ? 0 : -180 + start + step * i + (R() - 0.5) * 10;
    shelters.push(leanTo(b, K, bearing, 5.4 + R() * 0.8));
  }
  // log benches 3 m out, each in line with a lean-to
  const bench = SH.BIOMES.indexOf(o.biome) >= 1 ? 'piece_logbench01' : 'piece_logbench01';
  let leader = null;
  for (const s of shelters) {
    const x = Math.sin(rad(s.bearing)) * 3, z = Math.cos(rad(s.bearing)) * 3;
    if (place.put(bench, x, 0, z, s.bearing + 180, { ds: 1 })) if (!leader || Math.abs(s.bearing) < Math.abs(leader.bearing)) leader = { x, y: 0, z, yaw: normH(s.bearing + 180), bearing: s.bearing };
  }
  // the notice board at about 9 m between the door side and the first lean-to, chests beside it
  const nb = -180 + start / 2;
  const bx = Math.sin(rad(nb)) * 8.6, bz = Math.cos(rad(nb)) * 8.6;
  noticeBoard(b, K, bx, bz, normH(nb + 180));
  const tx = Math.cos(rad(nb)), tz = -Math.sin(rad(nb));
  const chests = { d1: 2, d2: 3, d3: 5 }[decor] || 2;
  for (let i = 0; i < 5; i++) {
    const s = 2.2 + 1.2 * Math.floor(i / 2), sg = i % 2 ? -1 : 1;
    place.put('piece_chest_wood', bx + tx * sg * s, 0, bz + tz * sg * s, nb + 180, { ds: i < 2 ? 1 : i < 3 ? 2 : 3, chest: true });
  }
  void chests;
  // d2: rugs under the lean-tos and a wood stack outside; d3: torches, a second cooking spot, berries and flowers
  for (const s of shelters) {
    const [x, z] = s.at(s.d0 + 1.6, 0);
    place.put('rug_deer', x, 0.02, z, s.bearing, { ds: 2 }, { onFurn: true });
    const [tx2, tz2] = s.at(s.d0 - 0.4, 2.6);
    place.put('piece_groundtorch_wood', tx2, 0.75, tz2, 0, { ds: 3 });
  }
  const ws = shelters[shelters.length - 1];
  const [wx, wz] = ws.at(ws.d0 + 2, 3.6);
  place.put('wood_stack', wx, 0.57, wz, ws.bearing + 90, { ds: 2 });
  for (let i = 0; i < 8; i++) {
    const a = R() * 360, r = 9 + R() * 1.4, x = Math.sin(rad(a)) * r, z = Math.cos(rad(a)) * r;
    place.put(i % 3 ? 'RaspberryBush' : 'Pickable_Dandelion', x, 0, z, R() * 360, { ds: 3 });
  }
  b.markers.push({ kind: 'path', x: 0, y: 0, z: -10, yaw: 180 });
  for (const s of shelters) { const [x, z] = s.at(-0.2, 0); void x; void z; }
  b.leader = leader || { x: 0, y: 0, z: 3, yaw: 180 };
  b.notes.push(`Camp: a fire pit with a cooking station, ${n} lean-tos open to the fire, log benches, the notice board and chests.`);
  b.family = 'camp';
  void T; void cultureKey;
}

// ---------------------------------------------------------------- long hall

// A rectangular hall W x D half-sizes in metres (both odd, so a 2 m floor cell sits on the fire at the middle), walls of
// 'storeys' storeys of SHt metres. Returns the hall's frame for the furnishing.
function longHall(b, K, C, T, o) {
  const { W, D, SHt, storeys, stage, has, R } = o;
  const top = SHt * storeys;
  const big = +stage[1] >= 4;
  // ground floor
  for (let x = -W + 1; x < W; x += 2) for (let z = -D + 1; z < D; z += 2) {
    if (x === 0 && z === 0 && +stage[1] >= 2) { b.put('stone_floor_2x2', 0, -0.375, 0, 0, { hearthStone: true }); continue; }
    b.put(K.floor, x, 0, z);
  }
  // aisle posts (from s3): log poles where the biome has them, at every other cell line
  const aisle = +stage[1] >= 3 ? D - 2 - (D >= 9 ? 2 : 0) : 0;
  const postXs = [];
  if (aisle) for (let x = -W + 2 + ((W - 1) % 4 === 0 ? 0 : 0); x <= W - 2; x += 2) if (Math.abs(x) % 4 === 1) postXs.push(x);
  // upper floors: a loft at the -x end from s4, the gallery over both aisles at s5
  const gallery = stage === 's5';
  const loftY = stage === 's5' ? SHt * 2 : SHt;
  const loft = big ? { x: [-W + 1, -W + 3, -W + 5], v: stage === 's5' ? [-4, -2, 0, 2, 4] : [-2, 0, 2] } : null;
  // doors: the main door in the middle of the -z side; from s3 a back door on +z (Anglo-Saxon halls face both ways)
  const doors = [{ x: 0, z: -D, yaw: 0, main: true }];
  if (+stage[1] >= 3 || C.opposedDoors) doors.push({ x: C.opposedDoors ? 0 : -W + 5, z: D, yaw: 0 });
  const isDoor = (x, z) => doors.find(d => Math.abs(d.x - x) < 0.01 && Math.abs(d.z - z) < 0.01);
  const porch = has('porch6', stage);
  // walls
  const edges = [];
  for (let x = -W + 1; x < W; x += 2) for (const z of [-D, D]) edges.push({ x, z, yaw: 0, nx: 0, nz: z < 0 ? 1 : -1 });
  for (let z = -D + 1; z < D; z += 2) for (const x of [-W, W]) edges.push({ x, z, yaw: 90, nx: x < 0 ? 1 : -1, nz: 0 });
  const style = o.wallStyle;
  for (const e of edges) {
    for (let s = 0; s < storeys; s++) {
      const y0 = s * SHt;
      const door = s === 0 && isDoor(e.x, e.z);
      let kind = door ? (big && door.main ? 'gate' : 'door') : 'wall';
      // windows: in the long walls every third bay, in the upper storey every other bay (high windows, s5)
      if (!door && e.yaw === 0 && !(porch && e.z < 0 && s === 0 && Math.abs(e.x) < 10)) {
        if (s === storeys - 1 && storeys > 1 && Math.abs(e.x) % 4 === 2) kind = 'window';
        else if (s === 0 && Math.abs(e.x) % 6 === 4 && !(aisle && Math.abs(e.x) > W - 3)) kind = 'window';
      }
      const st = style;
      T.wallSegment(b, K, C, e.x, y0, e.z, e.yaw, SHt, kind, st);
      b.put(K.beam, e.x, y0 + SHt, e.z, e.yaw);
    }
  }
  // corner and bay posts outside the wall line, every 4 m (timber frame)
  for (let x = -W; x <= W; x += 2) for (const z of [-D, D]) if (C.frame && (x + W) % 4 === 0) T.posts(b, K, x, z + Math.sign(z) * 0.2, top);
  // aisle posts, a beam along each row at the gallery height or the wall top
  const postTop = gallery ? SHt * 2 : top;
  for (const x of postXs) for (const v of [-aisle, aisle]) { T.posts(b, K, x, v, postTop, K.poleLong && /log/.test(K.poleLong) ? null : null); }
  if (aisle) for (const v of [-aisle, aisle]) for (let x = postXs[0] + 1; x < postXs[postXs.length - 1]; x += 2) b.put(K.beam, x, (gallery ? SHt : postTop) + 0.1, v, 0);
  // gallery floors over the aisles (s5), with a rail on the open side
  const ladders = [];
  if (gallery) {
    const gv = [];
    for (let z = aisle + 1; z < D; z += 2) gv.push(z, -z);
    const L1 = { hole: [-W + 3, aisle + 1], dir: [-1, 0], stand: [-W + 5, aisle + 1], land: [-W + 1, aisle + 1] };
    for (let x = -W + 1; x < W; x += 2) for (const v of gv) {
      if ((x === L1.hole[0] && v === L1.hole[1]) || (x === L1.land[0] && v === L1.land[1])) continue;
      b.put(K.floor, x, SHt, v);
    }
    T.putLadder(b, K, L1, 0, SHt);
    ladders.push(L1);
    // (none where the ladder to the loft climbs past the rail)
    for (const v of [-aisle, aisle]) for (let x = -W + 1; x < W; x += 2) if (!(v > 0 && x === -W + 5)) b.put(K.fence, x, SHt + 0.6, v, 0);
  }
  // the loft at the -x end, a ladder up to it
  if (loft) {
    const yL = loftY;
    let L;
    if (gallery) L = { hole: [-W + 5, aisle + 1], dir: [0, -1], stand: [-W + 5, aisle + 3], land: [-W + 5, aisle - 1] };
    else L = { hole: [-W + 7, 2], dir: [-1, 0], stand: [-W + 9, 2], land: [-W + 5, 2] };
    for (const x of loft.x) for (const v of loft.v) {
      if ((x === L.hole[0] && v === L.hole[1]) || (x === L.land[0] && v === L.land[1])) continue;
      b.put(K.floor, x, yL, v);
    }
    T.putLadder(b, K, L, yL - SHt, SHt);
    ladders.push(L);
    // a rail along the loft's open edge
    const xe = loft.x[loft.x.length - 1] + 1;
    for (const v of loft.v) if (!(v === L.hole[1] && Math.abs(xe - L.hole[0]) < 1.1)) b.put(K.fence, xe, yL + 0.6, v, 90);
  }
  // roof: a gable over the whole hall (lib/generate.js gablePieces)
  const r = (C.pitch || 45) === 45 ? 2 : 1;
  const w = { cx: 0, cz: 0, W, D, alpha: 0, main: true };
  const parts = T.gablePieces(K, C, w, top, r, [true, true], null, null);
  for (const p of parts) b.put(p.name, p.x, p.y, p.z, p.yaw);
  const capY = top + r * (D - 1) / 2;
  if (C.dragons && +stage[1] >= 4) for (const sg of [-1, 1]) b.put('wood_dragon1', sg * (W + 0.6), capY - 0.7, 0, sg > 0 ? 90 : 270, { decor: true });
  // porch: a row of posts 4 m out from the front, a lean-to roof against the wall (corpus: 6 or more columns)
  if (porch) {
    const zp = -D - 4, yb = Math.min(3, top - 2);
    const xs = []; for (let x = -9; x <= 9; x += 2) xs.push(x);
    for (const x of xs) T.posts(b, K, x, zp + 0.15, yb);
    for (let x = -8; x <= 8; x += 2) b.put(K.beam, x, yb + 0.1, zp + 0.15, 0);
    for (let x = -8; x <= 8; x += 2) { b.put(K.roof26, x, yb + 1, zp + 3, 180); b.put(K.roof26, x, yb, zp + 1, 180); }
    b.notes.push(`Porch of ${xs.length} posts along the front.`);
  }
  // stair or step at a door that is off the ground: none (the hall stands on the ground)
  b.rooms.push({ x0: -W, x1: W, z0: -D, z1: D, y: 0, h: SHt * storeys, use: 'hall', main: true, door: { x: 0, z: -D } });
  b.doorX = 0;
  return { W, D, top, capY, aisle, postXs, doors, loft, gallery, ladders, loftY, porch };
}

// ---------------------------------------------------------------- round hall

function ringPoly(N, L) { return L / (2 * Math.tan(Math.PI / N)); }
function polyInside(N, ap) {
  const ns = []; for (let k = 0; k < N / 2; k++) ns.push([Math.sin(rad(k * 360 / N)), Math.cos(rad(k * 360 / N))]);
  return (x, z, m = 0) => ns.every(([a, c]) => Math.abs(x * a + z * c) <= ap - m);
}
// Grid floor inside an N-gon of apothem ap at height y, outside radius rIn (a ring), 2 m cells centred on even
// coordinates and 1 m pieces out to the edge. skip(x, z) leaves a cell out.
function polyFloor(b, K, N, ap, y, o = {}) {
  const ins = polyInside(N, ap), Rr = Math.ceil(ap) + 1, rIn = o.rIn || 0;
  const out = (x, z, h) => [[-h, -h], [-h, h], [h, -h], [h, h]].every(([dx, dz]) => Math.hypot(x + dx, z + dz) >= rIn);
  const cells = [];
  for (let x = -2 * Math.ceil(Rr / 2); x <= Rr; x += 2) for (let z = -2 * Math.ceil(Rr / 2); z <= Rr; z += 2) {
    if (o.skip && o.skip(x, z)) continue;
    if ([[-1, -1], [-1, 1], [1, -1], [1, 1]].every(([dx, dz]) => ins(x + dx, z + dz, o.m != null ? o.m : 0.05)) && out(x, z, 1)) {
      if (o.center && x === 0 && z === 0) o.center(); else b.put(K.floor, x, y, z);
      cells.push([x, z]);
    } else for (const dx of [-0.5, 0.5]) for (const dz of [-0.5, 0.5]) {
      const cx = x + dx, cz = z + dz;
      if ([[-0.5, -0.5], [-0.5, 0.5], [0.5, -0.5], [0.5, 0.5]].every(([ex, ez]) => ins(cx + ex, cz + ez, o.m != null ? o.m : 0.05)) && out(cx, cz, 0.5)) b.put(K.floor1, cx, y, cz);
    }
  }
  return cells;
}
// Ring roof from apothem ap at height top inward, rise per ring rs (1: 26 degrees, 2: 45), stopping when a ring's
// inner edge would pass inside 'stop' (a drum) or the crown (1.2 m, the smoke hole over the fire). Returns the rings.
function ringRoofH(b, K, ap, top, rs, o = {}) {
  const out = o.eave === false ? 0 : 0.75;
  let low = top - rs[0] * out / 2;
  const rings = [];
  for (let i = 0; ; i++) {
    const rho = ap + out - 1 - 2 * i;
    if (rho < (o.crown || 1.2) || rho < (o.stop || 0)) break;
    const r = rs[Math.min(i, rs.length - 1)], roof = r === 2 ? K.roof45 : K.roof26;
    const n = Math.max(4, Math.ceil(2 * Math.PI * rho / 1.7));
    for (let k = 0; k < n; k++) {
      const phi = k * 360 / n;
      if (o.gap && i === 0 && Math.abs(phi - 180) < o.gap) continue;
      b.put(roof, Math.sin(rad(phi)) * rho, low + (r === 2 ? 1 : 0), Math.cos(rad(phi)) * rho, phi);
    }
    rings.push({ rho, low, r });
    low += r;
  }
  return { rings, top: low };
}
// Walls of an N-gon (sides L m, 2 m bays) from y0, SHt tall, with poles at the corners and beams on top. kind(i, k)
// gives 'door', 'window' or 'wall'. Returns the bays.
function polyWalls(b, K, C, T, N, L, ap, y0, SHt, kind, style) {
  const bays = [];
  for (let i = 0; i < N; i++) {
    const a = i * 360 / N, nx = Math.sin(rad(a)), nz = Math.cos(rad(a)), tx = Math.cos(rad(a)), tz = -Math.sin(rad(a));
    for (let k = 0; k < L / 2; k++) {
      const t = -L / 2 + 1 + 2 * k, x = nx * ap + tx * t, z = nz * ap + tz * t;
      const kd = kind(i, k);
      T.wallSegment(b, K, C, x, y0, z, a, SHt, kd, style);
      b.put(K.beam, x, y0 + SHt, z, a);
      bays.push({ i, k, x, z, yaw: a, nx: -nx, nz: -nz, kind: kd });
    }
    const vx = nx * ap + tx * L / 2, vz = nz * ap + tz * L / 2;
    for (let y = y0; y < y0 + SHt - 0.01;) { const h = (y0 + SHt - y) >= 2 ? 2 : 1; b.put(h === 2 ? K.pole : K.pole1, vx, y + h / 2, vz); y += h; }
  }
  return bays;
}

function roundHall(b, K, C, T, o) {
  const { stage, line, has } = o;
  const k = +stage[1];
  // sizes: 10, 15, 20 and 30 m across (Celtic table in hubs.md: 9.7, 14.5, about 20, about 30; hub1 s4 20 m)
  const spec = { s2: { N: 16, L: 2 }, s3: { N: 24, L: 2 }, s4: { N: 16, L: 4 }, s5: { N: 24, L: 4 } }[stage];
  const { N, L } = spec, ap = ringPoly(N, L);
  const SHt = k === 4 ? 4 : 3, storeys = k === 5 ? 2 : 1, top = SHt * storeys;
  const doorSide = N / 2, doorK = L === 4 ? 1 : 0;
  // the floor, the hearth's stone flags under the fire from s2 (D-131)
  polyFloor(b, K, N, ap, 0, { center: () => b.put('stone_floor_2x2', 0, -0.375, 0, 0, { hearthStone: true }) });
  const backSide = 0;
  const bays = [];
  for (let s = 0; s < storeys; s++) {
    const st = s > 0 && /stone/.test(o.wallStyle) ? 'plank' : o.wallStyle;
    bays.push(...polyWalls(b, K, C, T, N, L, ap, s * SHt, SHt, (i, kk) => {
      if (s === 0 && i === doorSide && kk === doorK) return k >= 4 ? 'gate' : 'door';
      if (s === 0 && k >= 3 && i === backSide && kk === 0) return 'door';
      if (s === storeys - 1 && i % 3 === 1 && kk === 0) return 'window';
      return 'wall';
    }, st));
  }
  const door = bays.find(bb => (bb.kind === 'door' || bb.kind === 'gate') && bb.i === doorSide);
  const doors = bays.filter(bb => bb.kind === 'door' || bb.kind === 'gate').map(bb => ({ x: bb.x, z: bb.z }));
  // post rings: Norse round from s4 a ring carrying the drum; Celtic from s4 one ring, at s5 two (Navan Fort)
  const drum = line === 'round' && o.cultureKey === 'norse' && k >= 4;
  const rings = [];
  if (k === 5) rings.push(ap - 4.5);
  if (k >= 4 && !drum) rings.push(k === 5 ? 6.5 : 6.3);
  const gallery = k === 5;
  // drum: an inner ring of walls with high windows on posts, an outer ring roof up to it and an inner cone over it
  let roofTop, peak, drumR = 0;
  const Nd = k === 5 ? 18 : 16, apD = ringPoly(Nd, 2);
  if (drum) drumR = apD;
  // outer roof
  const rsOut = drum ? [1] : k === 5 ? [1, 1, 1, 2] : k === 4 ? [1, 2] : [1, 2];
  // the crown left open over the fire: the smoke hole (a ring of five pieces there reads as spikes)
  const outer = ringRoofH(b, K, ap, top, rsOut, { stop: drum ? apD : 0, gap: 0, crown: 2.4 });
  roofTop = outer.top; peak = outer.top;
  if (drum) {
    // the roof's height where it meets the drum
    const last = outer.rings[outer.rings.length - 1];
    const yd = Math.floor(last.low + last.r * Math.min(1, (last.rho + 1 - apD) / 2) - 0.2);
    const vR = apD / Math.cos(Math.PI / Nd);
    for (let i = 0; i < Nd; i++) {
      const a = (i + 0.5) * 360 / Nd;
      T.posts(b, K, Math.sin(rad(a)) * vR, Math.cos(rad(a)) * vR, yd);
    }
    for (let i = 0; i < Nd; i++) {
      const a = i * 360 / Nd, x = Math.sin(rad(a)) * apD, z = Math.cos(rad(a)) * apD;
      b.put(K.beam, x, yd + 0.1, z, a);
      T.wallSegment(b, K, C, x, yd + 0.2, z, a, 3, i % 2 === 0 ? 'window' : 'wall', 'plank');
      b.put(K.beam, x, yd + 3.2, z, a);
    }
    const inner = ringRoofH(b, K, apD, yd + 3.2, [1], { eave: false });
    peak = inner.top;
    b.notes.push('A drum of high windows on a ring of posts over the fire, the outer roof running up to it and a low cone over it.');
  }
  // post rings, from the floor to the roof's underside (rounded down to the metre)
  const roofAt = rho => { let y = top; for (const rg of outer.rings) if (rg.rho - 1 >= rho) y = rg.low + rg.r; else if (rg.rho + 1 > rho) { y = rg.low + rg.r * (rg.rho + 1 - rho) / 2; break; } return y; };
  const postsOf = [];
  for (const rr of rings) {
    const n = Math.max(8, Math.round(2 * Math.PI * rr / 4 / 2) * 2);
    const h = gallery && rr > 8 ? SHt : Math.max(2, Math.floor(roofAt(rr) - 0.6));
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) * 360 / n, x = Math.sin(rad(a)) * rr, z = Math.cos(rad(a)) * rr;
      if (Math.hypot(x - (door ? door.x : 0), z - (door ? door.z : -ap)) < 2.4) continue;
      T.posts(b, K, x, z, h);
      postsOf.push({ x, z, h });
    }
  }
  // a gallery ring at the first storey between the outer post ring and the wall (s5), a ladder up from the floor
  const ladders = [];
  if (gallery) {
    const rIn = ap - 4.5;
    // up from the floor inside the ring, the landing the first gallery cell out at the -x side
    const hx = 2 * Math.round((-(ap - 2.2)) / 2);
    const L1 = { land: [hx, 0], hole: [hx + 2, 0], stand: [hx + 4, 0], dir: [-1, 0] };
    polyFloor(b, K, N, ap, SHt, { rIn, m: 0.02, skip: (x, z) => (x === L1.hole[0] && z === L1.hole[1]) || (x === L1.land[0] && z === L1.land[1]) });
    T.putLadder(b, K, L1, 0, SHt);
    ladders.push(L1);
    // a rail on the inner edge of the gallery
    const nr = Math.round(2 * Math.PI * rIn / 2);
    for (let i = 0; i < nr; i++) {
      const a = (i + 0.5) * 360 / nr, x = Math.sin(rad(a)) * (rIn - 0.1), z = Math.cos(rad(a)) * (rIn - 0.1);
      if (Math.abs(x - L1.hole[0]) < 2.4 && Math.abs(z) < 2.2) continue;
      b.put(K.fence, x, SHt + 0.6, z, normH(a + 90));
    }
    b.notes.push('A gallery round the hall at the first storey, a ladder up from the floor.');
  }
  b.rooms.push({ x0: -ap, x1: ap, z0: -ap, z1: ap, y: 0, h: top, use: 'hall', main: true, door: { x: door.x, z: door.z } });
  b.doorX = door.x;
  void roofTop; void has;
  return { ap, N, L, top, peak, door, doors, rings, postsOf, gallery, ladders, drum, drumR, SHt };
}

// ---------------------------------------------------------------- court

// Rooms round an open yard, flat roofs with a parapet, stone walls (Plains), the fire in the middle of the yard.
// Q: the yard's half size (7: a 14 m yard), wings 6 m deep.
function courtDesign(b, K, C, T, o) {
  const { stage, has } = o;
  const k = +stage[1];
  const Q = 7, Dw = 6, O = Q + Dw;
  const SHt = 3, storeys = k === 5 ? 2 : 1, top = SHt * storeys;
  // which wings stand: back (+z) from s2, the sides from s3, the front from s4
  const wing = { back: true, left: k >= 3, right: k >= 3, front: k >= 4 };
  const cells = new Map();
  const add = (x, z) => cells.set(`${x},${z}`, [x, z]);
  const zs = [Q + 1, Q + 3, Q + 5];
  for (let x = -O + 1; x < O; x += 2) for (const z of zs) { if (wing.back) add(x, z); if (wing.front) add(x, -z); }
  for (let z = (wing.front ? -O + 1 : -Q + 1); z < O; z += 2) for (const x of zs) { if (wing.left) add(-x, z); if (wing.right) add(x, z); }
  const has_ = (x, z) => cells.has(`${x},${z}`);
  // corner towers: one at the back right from s4, all four at s5 (the corpus draw adds a second at s4)
  const corners = [];
  if (k >= 4) corners.push([1, 1]);
  if (k === 4 && has('towers2', stage)) corners.push([-1, 1]);
  if (k === 5) corners.push([-1, 1], [1, -1], [-1, -1]);
  const inTower = (x, z) => corners.find(([sx, sz]) => x * sx > Q && z * sz > Q);
  // the iwan: the back wing's middle three cells, open to the yard, its roof a storey higher than the wings
  const iwan = k >= 4 ? { x0: -3, x1: 3, z0: Q, z1: O } : null;
  const inIwan = (x, z) => iwan && x > iwan.x0 && x < iwan.x1 && z > iwan.z0 && z < iwan.z1;
  const iwanTop = iwan ? top + SHt : 0;
  const towerTop = SHt * 3;
  // floors
  for (const [, [x, z]] of cells) b.put(K.floor, x, 0, z);
  // the yard: paving where no arcade stands over it, the fire's flags in the middle
  const arcade = [];
  for (let x = -Q + 1; x < Q; x += 2) for (let z = -Q + 1; z < Q; z += 2) {
    const under = (wing.back && z === Q - 1) || (wing.front && z === -Q + 1) || (wing.left && x === -Q + 1) || (wing.right && x === Q - 1);
    if (under && k >= 2 && !(iwan && z === Q - 1 && Math.abs(x) < 3)) { arcade.push([x, z]); continue; }
    if (K.stoneFloor && SH.BIOMES.indexOf(o.biome) >= SH.BIOMES.indexOf('Swamp')) b.put(K.stoneFloor, x, -0.5, z, 0, { yard: true });
  }
  // walls on every edge of the wing cells; doors to the yard; the gate through the front wing
  const edges = [];
  for (const [, [x, z]] of cells) for (const [dx, dz, yaw] of [[0, -2, 0], [0, 2, 0], [-2, 0, 90], [2, 0, 90]]) {
    if (has_(x + dx, z + dz)) continue;
    edges.push({ x: x + dx / 2, z: z + dz / 2, yaw, out: [dx / 2, dz / 2], cell: [x, z], nx: -dx / 2, nz: -dz / 2 });
  }
  // inner walls of towers and of the iwan's sides
  const inner = [];
  for (const [, [x, z]] of cells) for (const [dx, dz, yaw] of [[2, 0, 90], [0, 2, 0]]) {
    const a = [x, z], c = [x + dx, z + dz];
    if (!has_(...c)) continue;
    const ta = inTower(...a), tc = inTower(...c);
    const ia = inIwan(...a), ic = inIwan(...c);
    if ((!!ta !== !!tc) || (ia !== ic)) inner.push({ x: x + dx / 2, z: z + dz / 2, yaw, cell: a, other: c, tower: ta || tc, iwan: ia || ic });
  }
  const yardSide = e => Math.abs(e.x + e.out[0]) < Q && Math.abs(e.z + e.out[1]) < Q;
  const doorAt = new Set();
  // a door to the yard in each wing, at its middle (the back wing's door is the iwan when there is one)
  for (const [nm, on] of Object.entries(wing)) {
    if (!on) continue;
    const pick = { back: e => e.yaw === 0 && Math.abs(e.z - Q) < 0.01 && Math.abs(e.x - (iwan ? 5 : 0)) < 0.01,
      front: e => e.yaw === 0 && Math.abs(e.z + Q) < 0.01 && Math.abs(e.x) < 0.01,
      left: e => e.yaw === 90 && Math.abs(e.x + Q) < 0.01 && Math.abs(e.z) < 0.01,
      right: e => e.yaw === 90 && Math.abs(e.x - Q) < 0.01 && Math.abs(e.z) < 0.01 }[nm];
    const e = edges.find(pick);
    if (e) doorAt.add(e);
  }
  // the way in from outside: through the front wing's middle (s4, s5), else the open front of the yard
  const gate = wing.front ? edges.find(e => e.yaw === 0 && Math.abs(e.z + O) < 0.01 && Math.abs(e.x) < 0.01) : null;
  if (gate) doorAt.add(gate);
  const lad = [], doorList = [];
  for (let s = 0; s < storeys; s++) {
    const y0 = s * SHt;
    for (const e of edges) {
      if (inIwan(...e.cell) && yardSide(e)) continue; // the iwan's open front
      const kind = s === 0 && doorAt.has(e) ? (e === gate ? 'gate' : 'door') : (!yardSide(e) && s === storeys - 1 && (Math.abs(e.x) + Math.abs(e.z)) % 8 === 0 ? 'window' : 'wall');
      T.wallSegment(b, K, C, e.x, y0, e.z, e.yaw, SHt, kind, o.wallStyle);
      if (kind === 'door' || kind === 'gate') doorList.push({ x: e.x, z: e.z });
    }
    for (const e of inner) {
      const kind = Math.abs((e.yaw === 0 ? e.x : e.z)) % 4 > 1 && (s === 0 || !e.iwan) ? 'door' : 'wall';
      T.wallSegment(b, K, C, e.x, y0, e.z, e.yaw, SHt, kind, o.wallStyle);
      if (kind === 'door') doorList.push({ x: e.x, z: e.z, y: y0 });
    }
  }
  // inner walls of the towers and the iwan need doors that line up: one per wall run, at its middle bay
  // (the loop above made every other bay a door; that keeps each run passable)
  // upper floor at s5 with a ladder from the front wing; rooms over the wings, not over the iwan
  if (storeys > 1) {
    const L = { hole: [-4, -Q - 3], dir: [-1, 0], stand: [-2, -Q - 3], land: [-6, -Q - 3] };
    for (const [, [x, z]] of cells) {
      if (inIwan(x, z)) continue;
      if ((x === L.hole[0] && z === L.hole[1]) || (x === L.land[0] && z === L.land[1])) continue;
      b.put(K.floor, x, SHt, z);
    }
    T.putLadder(b, K, L, 0, SHt);
    lad.push(L);
  }
  // roofs: flat, at the wing top; the iwan and the towers higher
  const roofCells = [], iwanCells = [], towerCells = [];
  for (const [, c] of cells) (inIwan(...c) ? iwanCells : inTower(...c) ? towerCells : roofCells).push(c);
  for (const [x, z] of roofCells) b.put(K.floor, x, top, z);
  // iwan: side and back walls a storey higher
  if (iwan) {
    for (const e of edges.concat(inner)) {
      const c = e.cell, oc = e.other;
      const isI = inIwan(...c) || (oc && inIwan(...oc));
      if (!isI || (e.out && yardSide(e))) continue;
      T.wallSegment(b, K, C, e.x, top, e.z, e.yaw, SHt, 'wall', o.wallStyle);
    }
    for (const [x, z] of iwanCells) b.put(K.floor, x, iwanTop, z);
    // a stone arch over the iwan's open front would have nothing to stand on: a timber lintel instead
    for (let x = -2; x <= 2; x += 2) b.put(K.beamLong || K.beam, x, iwanTop - 0.3, Q, 0);
  }
  // towers: walls up to three storeys, floors and ladders
  for (const [sx, sz] of corners) {
    const tc = towerCells.filter(([x, z]) => x * sx > Q && z * sz > Q);
    const tEdges = edges.concat(inner).filter(e => (inTower(...e.cell) && inTower(...e.cell)[0] === sx && inTower(...e.cell)[1] === sz) || (e.other && inTower(...e.other) && inTower(...e.other)[0] === sx && inTower(...e.other)[1] === sz));
    for (let s = storeys; s < 3; s++) for (const e of tEdges) T.wallSegment(b, K, C, e.x, s * SHt, e.z, e.yaw, SHt, s === 2 && (Math.abs(e.yaw === 0 ? e.x : e.z) % 4 === 2) ? 'window' : 'wall', o.wallStyle);
    // ladders in the tower: a ladder per storey up from the wing's top floor, round the tower's walls
    const cx = sx * (Q + 3), cz = sz * (Q + 3);
    // up the outer column of cells, then along the inner row from that landing
    const Ls = [
      { stand: [cx + 2 * sx, cz + 2 * sz], hole: [cx + 2 * sx, cz], land: [cx + 2 * sx, cz - 2 * sz], dir: [0, -sz] },
      { stand: [cx + 2 * sx, cz - 2 * sz], hole: [cx, cz - 2 * sz], land: [cx - 2 * sx, cz - 2 * sz], dir: [-sx, 0] },
    ];
    for (let s = storeys; s < 3; s++) {
      const y = s * SHt, L = Ls[(s - storeys) % 2];
      // one ladder per storey: from the floor below to this one
      for (const [x, z] of tc) if (!((x === L.hole[0] && z === L.hole[1]) || (x === L.land[0] && z === L.land[1]))) b.put(K.floor, x, y, z);
      if (s > 0) T.putLadder(b, K, L, y - SHt, SHt);
      if (s === 0) for (const [x, z] of tc) b.put(K.floor, x, y, z);
    }
    for (const [x, z] of tc) b.put(K.floor, x, towerTop, z);
    lad.push(...Ls);
  }
  // parapets: stone blocks on stone walls, planks elsewhere
  const parapet = (list, y) => {
    for (const e of list) {
      const ux = e.yaw === 0 ? 1 : 0, uz = e.yaw === 0 ? 0 : 1;
      const stoneBelow = b.pieces.some(p => p.name === (K.stoneWall || 'stone_wall_2x1') && Math.abs(p.x - e.x) < 0.05 && Math.abs(p.z - e.z) < 0.05 && p.y < y && p.y > y - 1.1);
      if (stoneBelow && K.stoneBlock) b.put(K.stoneBlock, e.x - ux * 0.5, y + 0.5, e.z - uz * 0.5, e.yaw);
      else b.put(K.wallHalf, e.x, y + 0.5, e.z, e.yaw);
    }
  };
  parapet(edges.filter(e => !inIwan(...e.cell) && !inTower(...e.cell)), top);
  if (iwan) parapet(edges.filter(e => inIwan(...e.cell) && !yardSide(e)), iwanTop);
  for (const [sx, sz] of corners) parapet(edges.filter(e => { const t = inTower(...e.cell); return t && t[0] === sx && t[1] === sz; }), towerTop);
  // the arcade round the yard: posts and a flat roof 2 m deep against the wings
  for (const [x, z] of arcade) b.put(K.floor, x, SHt, z);
  const colPts = new Map();
  for (const [x, z] of arcade) {
    const sides = [];
    if (wing.back && z === Q - 1) sides.push([0, -1]);
    if (wing.front && z === -Q + 1) sides.push([0, 1]);
    if (wing.left && x === -Q + 1) sides.push([1, 0]);
    if (wing.right && x === Q - 1) sides.push([-1, 0]);
    for (const [dx, dz] of sides) for (const s of [-1, 1]) {
      const px = x + dx + (dz !== 0 ? s : 0), pz = z + dz + (dx !== 0 ? s : 0);
      if (Math.abs(px) < 2.2 && Math.abs(pz) < 2.2) continue;
      colPts.set(`${px},${pz}`, [px, pz]);
    }
  }
  for (const [, [x, z]] of colPts) { if (K.stonePillar) T.column(b, K, x, z, 0, SHt); else T.posts(b, K, x, z, SHt); }
  const wellOn = k >= 3;
  b.rooms.push({ x0: -O, x1: O, z0: -O, z1: O, y: 0, h: top, use: 'hall', main: true, door: gate ? { x: 0, z: -O } : { x: 0, z: -Q } });
  b.doorX = 0;
  return { doors: doorList, Q, O, top, SHt, iwan, iwanTop, corners, cells, edges, wing, gate, ladders: lad, wellOn, towerTop };
}

// ---------------------------------------------------------------- furnishing a hall stage

function furnish(b, K, C, T, o, F) {
  const { stage, line, place, R, has, skipDecor } = o;
  const k = +stage[1];
  const ds = n => ({ ds: n });
  // the fire at the heart: a hearth from s2 (stone flags under it, D-131)
  const fireName = k >= 2 ? 'hearth' : 'fire_pit';
  b.put(fireName, 0, 0.125, 0, line === 'long' ? 0 : 0, { decor: true, hearth: true, ds: 1 });
  place.keep(-2.4, 2.4, -2, 2, 0, 3);
  b.put('piece_cookingstation', line === 'long' ? 1.2 : 0, 0.55, 0, 0, { decor: true, ds: 1 });
  const fires = [{ x: 0, z: 0 }];
  // more fires in the big halls: a second fire in the long hall from s4 and a third at s5 when the village draws it
  // (corpus: 3 or more fires in 17 % of the ranked set, 63 % of the top tenth); the round hall's at s5 by the same draw
  const extra = (line === 'long' ? (k === 5 && has('fires3', stage) ? [-9, 9] : k >= 4 ? [-8] : []).map(x => [x, 0])
    : line === 'round' && k === 5 && has('fires3', stage) ? [[6, -6], [-6, -6]] : []);
  for (const [x, ez] of extra) {
    b.put('stone_floor_2x2', x, -0.375, ez, 0, { hearthStone: true });
    b.pieces = b.pieces.filter(p => !(p.name === K.floor && Math.abs(p.x - x) < 0.01 && Math.abs(p.z - ez) < 0.01 && Math.abs(p.y) < 0.01));
    b.put('fire_pit', x, 0.125, ez, 0, { decor: true, hearth: true, ds: 1 });
    place.keep(x - 1.6, x + 1.6, ez - 1.6, ez + 1.6, 0, 3);
    fires.push({ x, z: ez });
  }
  // doors and ladders stay clear: 2.2 m wide, 2 m in front and behind
  for (const d of (F.doors || [])) place.keep(d.x - 1.6, d.x + 1.6, d.z - 1.6, d.z + 1.6, 0, 3, true);
  if (F.door) place.keep(F.door.x - 1.3, F.door.x + 1.3, F.door.z - 0.5, F.door.z + 3, 0, 3);
  for (const L of F.ladders || []) for (const c of [L.stand, L.hole]) place.keep(c[0] - 1.1, c[0] + 1.1, c[1] - 1.1, c[1] + 1.1, -1, 100);
  // the way from the door to the fire
  if (line === 'long') place.keep(-1.3, 1.3, -F.D, 0, 0, 3);
  else if (line === 'round') place.keep(F.door.x - 1.3, F.door.x + 1.3, F.door.z, 0, 0, 3);
  let leader = null;
  // the high seat (from s3): at the +x end of a long hall facing down the hall, opposite the door in a round hall,
  // in the main iwan of a court; on a dais of two steps when the village has one (corpus: dais under 7 % of high
  // seats in the set, 32 % in the top tenth), always from s5 in a court
  if (k >= 3) {
    let sx, sz, yaw, dx, dz;
    if (line === 'long') { sx = F.W - 1.3; sz = 0; yaw = 270; dx = -1; dz = 0; }
    else if (line === 'round') { sx = 0; sz = F.gallery ? F.ap - 5.8 : F.ap - 2.2; yaw = 180; dx = 0; dz = -1; }
    else { sx = 0; sz = F.O - 1.5; yaw = 180; dx = 0; dz = -1; }
    const dais = has('dais', stage) || (line === 'court' && k >= 5) || (line === 'long' && k === 5);
    let y = 0.125;
    if (dais) {
      // a dais of 1 m floor pieces, two layers, 4 x 3 m, a step at its front
      const ux = Math.abs(dz), uz = Math.abs(dx);
      for (let a = -1.5; a <= 1.5; a += 1) for (let c = 0; c < 3; c++) {
        const x = sx - dx * (c - 0.7) + ux * a, z = sz - dz * (c - 0.7) + uz * a;
        b.put(K.floor1, x, 0.25, z, 0, { dais: true });
        if (c < 2) b.put(K.floor1, x, 0.5, z, 0, { dais: true });
      }
      y = 0.625;
      b.notes.push('The high seat on a dais.');
    }
    b.put('piece_throne01', sx, y, sz, yaw, { decor: true, ds: 1, highSeat: true });
    place.keep(sx - 1, sx + 1, sz - 1, sz + 1, 0, 3);
    leader = { x: sx, y, z: sz, yaw };
    // the way from the fire to the high seat
    if (line === 'long') place.keep(2.4, sx - 0.6, -1.3, 1.3, 0, 3);
    else place.keep(-1.3, 1.3, 2, sz - 0.6, 0, 3);
    // banners either side (d2)
    for (const s of [-1, 1]) place.put('piece_groundtorch_wood', sx + Math.abs(dz) * s * 1.6 + dx * 0.4, y + 0.75, sz + Math.abs(dx) * s * 1.6 + dz * 0.4, 0, ds(2));
  }
  if (skipDecor) { b.leader = leader || { x: 0, y: 0.125, z: 3, yaw: 180 }; return; }
  // seats round the fire: benches at 3 m (s2), rugs by the fire (corpus: rugs by 47 to 51 % of hall fires, seats by a
  // third), tables with benches along the aisles of long halls
  const benches = [];
  if (line !== 'court') {
    const ring = [0, 90, 270, 180].slice(0, k <= 3 ? 3 : 2);
    for (const a of ring) {
      const x = Math.sin(rad(a)) * 3.2, z = Math.cos(rad(a)) * 3.2;
      if (place.put('piece_bench01', x, 0.125, z, a + 180, ds(1))) benches.push({ x, z, yaw: normH(a + 180), a });
    }
  }
  for (const f of fires) for (const a of [45, 225]) place.put('rug_fur', f.x + Math.sin(rad(a)) * 2.6, 0.14, f.z + Math.cos(rad(a)) * 2.6, a, ds(2), { onFurn: true, inKeep: true });
  if (!leader) {
    const bn = benches.find(bb => bb.a === 0) || benches[0];
    leader = bn ? { x: bn.x, y: 0.125, z: bn.z, yaw: bn.yaw } : { x: 0, y: 0.125, z: 3, yaw: 180 };
  }
  // feast tables
  const tables = [];
  const tryTable = (x, z, yaw, d) => {
    if (!place.put('piece_table', x, 0.125, z, yaw, ds(d))) return;
    tables.push([x, z]);
    const nx = Math.sin(rad(yaw)), nz = Math.cos(rad(yaw));
    for (const s of [-1, 1]) place.put('piece_bench01', x + nx * s * 0.95, 0.125, z + nz * s * 0.95, yaw + (s > 0 ? 180 : 0), ds(d));
  };
  if (line === 'long') {
    const v = F.aisle ? F.aisle - 2 : F.D - 2.2;
    for (let x = -F.W + 3.5; x <= F.W - 4; x += 3.2) for (const s of [-1, 1]) if (Math.abs(x) > 3.5) tryTable(x, s * v, 0, Math.abs(x) < 8 ? 1 : 2);
  } else if (line === 'round') {
    const rr = Math.max(F.ap - 2.8, 4.8);
    const n = Math.max(3, Math.floor(2 * Math.PI * rr / 5));
    for (let i = 0; i < n; i++) { const a = (i + 0.5) * 360 / n; tryTable(Math.sin(rad(a)) * rr, Math.cos(rad(a)) * rr, a, i % 2 ? 2 : 1); }
  } else {
    // court: tables in the wings
    for (const x of [-10, 10]) for (const z of [-2, 2, 6]) if (F.wing.left || F.wing.right) tryTable(x, z, 90, 2);
    for (const x of [-10, -6, 6, 10]) tryTable(x, F.Q + 3, 0, 1);
    // cushions round the fire in the yard: rugs (middle-eastern rugs, CULTURES rugs: 2)
    for (const a of [0, 60, 120, 180, 240, 300]) place.put(a % 120 ? 'rug_deer' : 'rug_wolf', Math.sin(rad(a)) * 3.4, 0.02, Math.cos(rad(a)) * 3.4, a, ds(a % 120 ? 2 : 1), { onFurn: true, inKeep: true });
    for (const a of [30, 150, 270]) place.put('piece_bench01', Math.sin(rad(a)) * 3.6, 0.0, Math.cos(rad(a)) * 3.6, a + 180, ds(1));
  }
  // the village's main chest and storage at the edge (CLAUDE.md "Village chest": one main chest by the hearth)
  const edgeSpots = wallSpots(b, o, F, 0.125);
  // the walls' inner faces: a stone course is 1 m thick at the floor, planks and logs 0.3 to 0.5 m (game colliders)
  const lowT = /stone|marble/.test(C.wallStyle || '') ? 0.5 : C.wallStyle === 'log' ? 0.25 : 0.15;
  const highT = C.wallStyle === 'stone' || C.wallStyle === 'marble' ? 0.5 : C.wallStyle === 'log' ? 0.25 : 0.15;
  let nChest = 0;
  for (const sp of edgeSpots) {
    if (nChest >= { s2: 3, s3: 4, s4: 6, s5: 8 }[stage]) break;
    if (place.put('piece_chest_wood', sp.x + sp.nx * (lowT + 0.42), sp.y, sp.z + sp.nz * (lowT + 0.42), sp.yawIn, { ds: nChest < 2 ? 1 : nChest < 4 ? 2 : 3, chest: true })) nChest++;
  }
  // mementos (D-134): empty item stands on the walls, more each stage, for the village's bigger mementos
  const nStands = { s2: 2, s3: 4, s4: 6, s5: 10 }[stage];
  let st = 0;
  for (const sp of edgeSpots.slice().reverse()) {
    if (st >= nStands) break;
    if (place.put('itemstand', sp.x + sp.nx * (highT + 0.12), sp.y + 1.85, sp.z + sp.nz * (highT + 0.12), sp.yawIn, { ds: 1, memento: true }, { inKeep: true })) st++;
  }
  // light: wall torches (d2), standing torches by the doors (d3), banners in the big halls (d3)
  let nt = 0;
  for (const [i, sp] of edgeSpots.entries()) {
    if (nt >= 4 + 2 * k) break;
    if (i % 3 !== 1) continue;
    if (place.put('piece_walltorch', sp.x + sp.nx * (highT + 0.17), sp.y + 1.6, sp.z + sp.nz * (highT + 0.17), sp.yawIn, ds(2), { inKeep: true })) nt++;
  }
  if (k >= 4) for (const sp of edgeSpots.filter((s, i) => i % 5 === 2).slice(0, 6)) place.put('piece_banner01', sp.x + sp.nx * (highT + 0.12), sp.y + 2.9, sp.z + sp.nz * (highT + 0.12), sp.yawIn, ds(3), { inKeep: true });
  // a cauldron and a fermenter in the bigger halls (the corpus halls keep food and drink by the fire)
  if (k >= 3) {
    const sp = edgeSpots[Math.floor(edgeSpots.length / 3)];
    if (sp) place.put('piece_cauldron', sp.x + sp.nx * (lowT + 0.8), sp.y, sp.z + sp.nz * (lowT + 0.8), sp.yawIn, ds(2));
    const sp2 = edgeSpots[Math.floor(edgeSpots.length / 2)];
    if (sp2) place.put('fermenter', sp2.x + sp2.nx * (lowT + 0.8), sp2.y, sp2.z + sp2.nz * (lowT + 0.8), sp2.yawIn, ds(3));
  }
  // the loft and gallery: chests, a bed for a guest, stands
  for (const L of [F.loft].filter(Boolean)) {
    const y = F.loftY + 0.125;
    place.put('piece_chest_wood', -F.W + 0.6, y, -1.6, 90, ds(2));
    place.put('bed', -F.W + 1.2, y, 1.4, 90, ds(2));
    void L;
  }
  b.leader = leader;
  void C; void R; void K; void T;
}

// Spots along the inside of the walls at floor height y: { x, y, z, nx, nz (into the room), yawIn }
function wallSpots(b, o, F, y) {
  const out = [];
  if (o.line === 'long') {
    for (let x = -F.W + 3; x <= F.W - 3; x += 2) for (const z of [-F.D, F.D]) out.push({ x, y, z, nx: 0, nz: z < 0 ? 1 : -1, yawIn: z < 0 ? 0 : 180 });
    for (let z = -F.D + 3; z <= F.D - 3; z += 2) out.push({ x: -F.W, y, z, nx: 1, nz: 0, yawIn: 90 });
  } else if (o.line === 'round') {
    const n = Math.round(2 * Math.PI * F.ap / 2.2);
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) * 360 / n, rr = F.ap * Math.cos(Math.PI / F.N) - 0.15;
      out.push({ x: Math.sin(rad(a)) * rr, y, z: Math.cos(rad(a)) * rr, nx: -Math.sin(rad(a)), nz: -Math.cos(rad(a)), yawIn: normH(a + 180) });
    }
  } else {
    const O = F.O;
    for (let x = -O + 3; x <= O - 3; x += 2) for (const z of F.wing.front ? [-O, O] : [O]) out.push({ x, y, z, nx: 0, nz: z < 0 ? 1 : -1, yawIn: z < 0 ? 0 : 180 });
    for (let z = -O + 3; z <= O - 3; z += 2) for (const x of [-O, O]) if (F.wing.left) out.push({ x, y, z, nx: x < 0 ? 1 : -1, nz: 0, yawIn: x < 0 ? 90 : 270 });
  }
  return out.sort((a, c) => Math.atan2(a.x, a.z) - Math.atan2(c.x, c.z));
}

// ---------------------------------------------------------------- the design

function generate(req, T) {
  const biome = SH.BIOMES.includes(req.biome) ? req.biome : 'Meadows';
  const seed = req.seed ?? 1;
  const lineage = req.lineage != null && isFinite(+req.lineage) ? +req.lineage : seed;
  const cultureKey = SH.cultureKey(req.culture) || SH.cultureFor(biome, rngH(lineage * 104729 + 3 * 13 + 7));
  const C = { ...SH.CULTURES[cultureKey], biome };
  const stage = STAGES.includes(req.stage) ? req.stage : 's1';
  const k = +stage[1];
  const decor = ['d1', 'd2', 'd3'].includes(req.decor) ? req.decor : 'd2';
  const line = lineFor(cultureKey, lineage, req.line);
  const R = rngH(seed * 7919 + k * 31 + cultureKey.length);
  const K = SH.roofKit(SH.kitFor(biome), C, biome);
  const b = new T.Build();
  b.markers = [];
  const has = featureDraw(lineage, cultureKey);
  const place = placer(b, T);
  // walls by the biome rule (D-125, D-012): wood at s1 to s3 in the Meadows and the Black Forest, a stone course under
  // the walls from s4 (the hub is the village's advanced building, D-012); stone in the later biomes
  const early = biome === 'Meadows' || biome === 'Black Forest';
  let wallStyle;
  if (line === 'court') wallStyle = K.stoneWall && !early ? 'stone' : 'plank';
  else if (early) wallStyle = k >= +String((SH.HUB || {}).stoneFrom || 's4').slice(1) ? 'stone-base' : (C.logWalls && biome !== 'Meadows' ? 'log' : 'plank');
  else wallStyle = C.stoneWalls ? 'stone' : k >= 4 ? 'stone-base' : (C.logWalls ? 'log' : 'plank');
  // the Meadows kit has no stone pieces: the stone course takes the Black Forest's (the next biome, lib/pieces.js
  // buildReach)
  const Kw = wallStyle === 'stone-base' && !K.stoneWall ? { ...K, stoneWall: 'stone_wall_2x1', stoneBlock: 'stone_wall_1x1' } : K;
  C.wallStyle = wallStyle;
  C.baseTop = 0.6;
  const info = { type: 'hub', biome, cultureKey, stage, decor, seed, line, family: k === 1 ? 'camp' : line, walls: k === 1 ? 'none' : wallStyle };
  let F = {};
  if (k === 1) campDesign(b, K, T, { R, cultureKey, decor, place, biome });
  else {
    if (line === 'long') {
      const sz = { s2: [9, 5, 3, 1], s3: [11, 7, 4, 1], s4: [15, 7, 4, 1], s5: [17, 9, 3, 2] }[stage];
      F = longHall(b, Kw, C, T, { W: sz[0], D: sz[1], SHt: sz[2], storeys: sz[3], stage, has, R, wallStyle });
      F.door = { x: 0, z: -F.D };
      info.plan = 'long'; info.roof = 'gable';
      b.notes.push(`Long hall ${2 * F.W} x ${2 * F.D} m round the fire${F.aisle ? `, ${F.postXs.length * 2} aisle posts` : ''}${F.loft ? ', a loft at one end' : ''}${F.gallery ? ', a gallery over both aisles' : ''}.`);
    } else if (line === 'round') {
      F = roundHall(b, Kw, C, T, { stage, line, has, cultureKey, wallStyle });
      info.plan = 'round'; info.roof = F.drum ? 'drum' : 'conical';
      b.notes.push(`Round hall of ${F.N} sides, ${(2 * F.ap).toFixed(1)} m across round the fire${F.rings.length ? `, ${F.rings.length} ring${F.rings.length > 1 ? 's' : ''} of posts` : ''}.`);
    } else {
      F = courtDesign(b, Kw, C, T, { stage, has, biome, wallStyle });
      F.door = F.gate ? { x: 0, z: -F.O } : { x: 0, z: -F.Q };
      info.plan = 'court'; info.roof = 'flat';
      b.notes.push(`Court: ${Object.values(F.wing).filter(Boolean).length} wings round a ${2 * F.Q} m yard with the fire in the middle${F.iwan ? ', an iwan facing the yard' : ''}${F.corners.length ? `, ${F.corners.length} tower${F.corners.length > 1 ? 's' : ''}` : ''}.`);
    }
    // the notice board in the hearth area (D-140): freestanding outside the main door, and from s4 signs on a wall by
    // the door inside as well
    const d0 = F.door || { x: 0, z: -F.D };
    const nbz = line === 'court' && !F.gate ? -F.Q + 2.5 : d0.z - (line === 'long' && F.porch ? 6 : 3);
    noticeBoard(b, K, d0.x + (line === 'court' && !F.gate ? 3.5 : 3.6), nbz, 0);
    if (k >= 4) {
      const wx = d0.x - 3, wz = d0.z;
      if (line !== 'court') noticeWall(b, { x: wx, z: wz + (line === 'round' ? 0.2 : 0.1), yaw: 0, nx: 0, nz: 1 }, 0.125);
      else noticeWall(b, { x: -3, z: -F.Q - 0.1, yaw: 0, nx: 0, nz: -1 }, 0);
    }
    b.markers.push({ kind: 'path', x: d0.x, y: 0, z: d0.z - (line === 'long' && F.porch ? 5 : 2), yaw: 180 });
    furnish(b, Kw, C, T, { stage, line, place, R, has, skipDecor: req.skipDecor, cultureKey, biome }, F);
    // the fire's place in the court is the open yard
    if (line === 'court') b.notes.push('The fire in the open yard; the high seat in the main iwan from s4.');
    // outside: a wood stack and a stone pile by the hall (Amenities.cs puts the same by the hearth)
    if (!req.skipDecor) {
      const ox = line === 'long' ? F.W + 2 : line === 'round' ? F.ap + 1.8 : F.O + 1.8;
      place.put('wood_stack', ox, 0.57, -3, 90, { ds: 2 });
      place.put('stone_pile', ox, 0, 3, 90, { ds: 3 });
    }
  }
  // the decor stage asked for (D-071): pieces tagged ds 2 or 3 go in at that stage
  const kd = { d1: 1, d2: 2, d3: 3 }[decor];
  if (!req.skipDecor) b.pieces = b.pieces.filter(p => p.ds == null || p.ds <= kd);
  else b.pieces = b.pieces.filter(p => !p.decor || p.hearth || p.notice || p.highSeat);
  // pieces that stand on their pivot in the game go down to their foot (as lib/generate.js finish)
  for (const p of b.pieces) { const pi = PH.piece(p.name); if (pi.onPivot && !p.decor && !p.footed) { p.y = +(p.y - pi.size[1] / 2).toFixed(3); p.footed = true; } }
  const L = b.leader || { x: 0, y: 0, z: 3, yaw: 180 };
  const markers = [...b.markers, { kind: 'seat', x: +L.x.toFixed(3), y: +L.y.toFixed(3), z: +L.z.toFixed(3), yaw: Math.round(L.yaw || 0), leader: true }];
  // the drawn features this line builds (the rest of GRAND has no form in it yet)
  const USED = { long: ['fires3', 'porch6', 'dais'], round: ['fires3', 'dais'], court: ['towers2', 'dais'] };
  info.features = k === 1 ? [] : (USED[line] || []).filter(f => has(f, stage));
  const name = `hub_${biome.replace(' ', '')}_${cultureKey}_${line}_${stage}${decor}_${seed}`;
  return {
    ground: 0,
    meta: { Name: name, Creator: 'Villheim generator', Category: 'Villheim generated',
      Description: `Village hub (hearth), ${biome}, ${SH.CULTURES[cultureKey].label}, ${line} line, ${stage}${decor}, seed ${seed}` },
    pieces: b.pieces, rooms: b.rooms, notes: [...new Set(b.notes)], request: info, slots: [], markers,
  };
}

// The blueprint with the hub's markers: '#VillheimPaths' (path;x;y;z;yaw, where roads join, as the board writes them,
// src/Villheim.Logic/Village/DesignBoard.cs) and '#VillheimLeader' (seat;x;y;z;yaw, the leader's place, D-141).
function write(d) {
  const text = BPH().write(d);
  const f = v => (Math.abs(v) < 1e-6 ? 0 : +(+v).toFixed(4)).toString();
  const paths = (d.markers || []).filter(m => m.kind === 'path').map(m => ['path', f(m.x), f(m.y), f(m.z), f(m.yaw)].join(';'));
  const lead = (d.markers || []).filter(m => m.leader).map(m => ['seat', f(m.x), f(m.y), f(m.z), f(m.yaw)].join(';'));
  const extra = [];
  if (paths.length) extra.push('#VillheimPaths', ...paths);
  if (lead.length) extra.push('#VillheimLeader', ...lead);
  return extra.length ? text.replace('#Pieces\n', extra.join('\n') + '\n#Pieces\n') : text;
}

const apiH = { generate, write, lineFor, featureDraw, GRAND, STAGES };
if (NODE_H) module.exports = apiH; else window.VHHub = apiH;
