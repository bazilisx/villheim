// The village hub: the central hearth (D-139, Tyler 2026-11-11: "The hub is the hearth. Synonymous. ... It's its own
// building plot ... the hearth must 1000% grow and evolve and become a grand central building across stages and decor
// too"). Five stages on one plot (D-138; D-083 the plot is sized for s5), built round the village hearth fire at the
// plot's middle (0, 0). The main door faces -z, as in lib/generate.js. D-154 (Tyler): "The hearth IS the central hub,
// the townhall, the primary resource. It holds storage ... It shows off decor, wealth, status, enemies slain and
// trophies collected. It's where the leader and their spouse spend time. It's where people gather".
//
// Lines (D-137, Tyler: "Strongly leanign toward circular/octagonal or partial variants thereof for most, and
// cross-shape for those that are more strongly rectangular or l-shaped sturectures"; per culture in styles.js HUB.lines,
// measured by lab/hub_lines.js). The shape family stays from s2 on (D-132); a village keeps its line at every stage.
//   cross    four arms round the fire at the crossing: the door at the end of the front arm, the high seat at the end
//            of the back arm, side rooms at the ends of the side arms from s4, a lantern tower over the crossing
//   round    a ring of walls round the fire under a ring roof, 10 to 30 m across
//   octagon  eight straight sides, 10 to 29 m across
//   part     the round hall with a flat front: the ring is cut by a straight wall with the door (about a quarter of
//            the circle left open in front as a forecourt; Tyler: "half or 3/4 circle with open chunk on one side")
// Round halls take the culture's roof: rings of posts and an open crown under a cone (conical roofs), a drum of high
// windows over the fire (gable and hip cultures), or a flat roof with a raised lantern (flat roof cultures).
// From s4 every line has a gallery along the upper inner walls at 3 m, railed and reached by a stair; at s5 walkways
// cross the hall high up (Tyler, 2026-11-11: "raised platforms along higher inner walls or across ceilings for folks to
// walk and look down"), never over a fire.
// s1 in every line is the camp: a fire pit with a cooking station, log benches about 3 m out, lean-tos 5 to 9 m out
// opening to the fire, the notice board and chests at the edge (hub1 s1 measures as a guide, D-140).
//
// The notice board stands in the hearth area at every stage (D-140); from s4 the hall also carries the notices as
// signs on a wall by the door. The leader's place is written as a marker (D-141 C): section '#VillheimLeader' in the
// blueprint, line 'seat;x;y;z;yaw' (the high seat or, before there is one, the seat the leader takes by the fire), and
// from s3 a line 'spouse;x;y;z;yaw' for the seat beside it. Empty item stands wait for the village's mementos and
// trophies (D-134); the generator leaves them empty.
// Height: the hub stands at most HUB.capStoreys storeys over the culture's tallest other building (styles.js HUB.capH);
// a hub that would stand taller is built again a step plainer (see TIERS).

const NODE_H = typeof module !== 'undefined';
const SH = NODE_H ? require('./styles.js') : window.VHStyles;
const PH = NODE_H ? require('./pieces.js') : window.VHPieces;
const CkH = () => (NODE_H ? require('./checks.js') : window.VHChecks);
const DecH = () => (NODE_H ? require('./decorate.js') : window.VHDecorate);
const BPH = () => (NODE_H ? require('./blueprint.js') : window.VHBlueprint);

const STAGES = ['s1', 's2', 's3', 's4', 's5'];

// Grand building features in the corpus (hubs.md "Grand buildings for s5", 181 ranked vanilla builds): share of builds
// with the feature in the rest of the set and in the top tenth. s5 draws each with the top tenth's share, s4 with the
// rest's, from one number per village and feature, so a feature an s4 hub has stays at s5.
const GRAND = {
  fires3: [0.17, 0.63], aisle8: [0.36, 0.89], porch6: [0.17, 0.47], dais: [0.07, 0.32],
  highWindows: [0.04, 0.21], towers2: [0.04, 0.16], anyTower: [0.36, 0.37], gallery: [0.09, 0.11],
  tiers3: [0.62, 0.68], dragons: [0.19, 0.26],
};

// The outside of a big hub (s4, s5): features by the village's draw, in the order of their share in the top tenth.
// So the hub reads as the grandest building from outside, s5 has at least three of them and s4 at least one; s5 keeps
// all that s4 had. tiers3: roofs in tiers (the cross's lantern tower over the crossing, the round hall's drum or raised
// crown); porch6: a porch of six or more posts; dragons: carved heads at the gables; highWindows: windows in the
// lantern tower.
const EXT = { cross: ['tiers3', 'porch6', 'dragons', 'highWindows'], round: ['tiers3', 'porch6', 'dragons'] };
function exteriorOf(has, stage, line, C) {
  const k = +stage[1];
  if (k < 4) return {};
  const list = (EXT[line === 'cross' ? 'cross' : 'round'] || []).filter(f => f !== 'dragons' || C.dragons);
  const pick = (st, min, base) => {
    const out = { ...base };
    for (const f of list) if (has(f, st)) out[f] = true;
    for (const f of list) { if (Object.keys(out).length >= min) break; out[f] = true; }
    if (out.highWindows) out.tiers3 = true;
    return out;
  };
  const s4 = pick('s4', 1, {});
  return k === 4 ? s4 : pick('s5', 3, s4);
}

function rngH(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const hashH = s => [...String(s)].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);
const normH = a => ((a % 360) + 360) % 360;
const rad = d => d * Math.PI / 180;

// The line for a culture (styles.js HUB.lines, weights per village, picked from the village's lineage).
const LINES = ['cross', 'round', 'octagon', 'part'];
function lineFor(cultureKey, lineage, asked) {
  if (asked && LINES.includes(asked)) return asked;
  const w = ((SH.HUB || {}).lines || {})[cultureKey] || { octagon: 1 };
  const e = Object.entries(w), tot = e.reduce((a, [, v]) => a + v, 0);
  let x = rngH(lineage * 7349 + 11)() * tot;
  for (const [kk, v] of e) if ((x -= v) <= 0) return kk;
  return e[0][0];
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
// Walking the hall as a person does (D-148, D-152): the same reading as lab/reach.js on design/integration2. A 0.25 m
// grid over the room rects on each floor; a cell is free when it is 0.45 m or more from every solid between 0.25 and
// 1.8 m over that floor (floors, roofs, rugs, doors and things hung on walls are no obstacle). People come in at every
// door to the outside and climb every stair and ladder (its foot cells to its top cells). test(p) says whether a
// piece can go in with every room, every climb and every bed, table, station and chest placed so far still reached,
// the piece itself included.
function walker(b) {
  const Ck = CkH(), Fu = DecH().FURNITURE;
  const S = 0.25, RR = 0.45;
  const PASS = new Set(['floor', 'rug', 'roof', 'roofTop', 'roofCorner', 'door', 'nature', 'misc']);
  const MAIN = new Set(['bed', 'table', 'craft', 'storage']);
  const rooms = b.rooms.filter(r => r.x1 > r.x0 && r.z1 > r.z0);
  const levels = [...new Set(rooms.map(r => Math.round(r.y * 4) / 4))].sort((a, c) => a - c);
  const L = levels.map(y => {
    const rs = rooms.filter(r => Math.abs(r.y - y) < 0.2);
    const x0 = Math.min(...rs.map(r => r.x0)), x1 = Math.max(...rs.map(r => r.x1)), z0 = Math.min(...rs.map(r => r.z0)), z1 = Math.max(...rs.map(r => r.z1));
    const nx = Math.max(0, Math.ceil((x1 - x0) / S - 1e-9)), nz = Math.max(0, Math.ceil((z1 - z0) / S - 1e-9));
    const inR = new Uint8Array(nx * nz), blk = new Int16Array(nx * nz);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x = x0 + S / 2 + i * S, z = z0 + S / 2 + j * S;
      if (x < x1 && z < z1 && rs.some(r => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1)) inR[i * nz + j] = 1;
    }
    return { y, rs, x0, z0, nx, nz, inR, blk };
  });
  const cx = (g, i) => g.x0 + S / 2 + i * S, cz = (g, j) => g.z0 + S / 2 + j * S;
  const solidOf = p => {
    const role = PH.piece(p.name).role, f = Fu[p.name];
    if (PASS.has(role) || role === 'stair' || p.onTable) return null;
    if (p.decor && f && ['mount', 'hang', 'top', 'rug'].includes(f.at)) return null;
    const o = Ck.aabbShapes(p);
    return o.pass ? null : o;
  };
  const dist = (o, x, z) => Math.hypot(Math.max(o.x0 - x, 0, x - o.x1), Math.max(o.z0 - z, 0, z - o.z1));
  // cells of each level within 'r' of box o: [level index, cell index]
  const cellsNear = (o, r, onlyBand) => {
    const out = [];
    L.forEach((g, li) => {
      if (onlyBand && !(o.y0 < g.y + 1.8 && o.y1 > g.y + 0.25)) return;
      const i0 = Math.max(0, Math.floor((o.x0 - r - g.x0) / S) - 1), i1 = Math.min(g.nx - 1, Math.ceil((o.x1 + r - g.x0) / S) + 1);
      const j0 = Math.max(0, Math.floor((o.z0 - r - g.z0) / S) - 1), j1 = Math.min(g.nz - 1, Math.ceil((o.z1 + r - g.z0) / S) + 1);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (g.inR[i * g.nz + j] && dist(o, cx(g, i), cz(g, j)) < r) out.push([li, i * g.nz + j]);
    });
    return out;
  };
  const mark = (o, d) => { for (const [li, c] of cellsNear(o, RR, true)) L[li].blk[c] += d; };
  let seen = 0;
  const cutAt = () => { for (; seen < b.pieces.length; seen++) { const o = solidOf(b.pieces[seen]); if (o) mark(o, 1); } };
  cutAt();
  // entry cells and climbs, from the structure
  const levelAt = (y, tol) => L.findIndex(g => Math.abs(g.y - y) < tol);
  const entries = [];
  for (const p of b.pieces.filter(q => !q.decor && PH.piece(q.name).role === 'door')) {
    const o = PH.doorOpening(p), li = levelAt(o.y, 0.6);
    if (li < 0) continue;
    const g = L[li], inRoom = (x, z) => g.rs.some(r => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
    for (const sg of [1, -1]) {
      if (inRoom(o.x + o.nx * sg * 0.8, o.z + o.nz * sg * 0.8) && !inRoom(o.x - o.nx * sg * 0.8, o.z - o.nz * sg * 0.8)) {
        const px = o.x + o.nx * sg * 0.6, pz = o.z + o.nz * sg * 0.6;
        for (const [l2, c] of cellsNear({ x0: px, x1: px, z0: pz, z1: pz }, 1.2, false)) if (l2 === li) entries.push([li, c]);
      }
    }
  }
  const climbs = [];
  for (const p of b.pieces.filter(q => !q.decor && PH.piece(q.name).role === 'stair')) {
    const o = Ck.aabb(p);
    const touch = climbs.filter(c => c.some(q => q.x0 < o.x1 + 0.3 && q.x1 > o.x0 - 0.3 && q.z0 < o.z1 + 0.3 && q.z1 > o.z0 - 0.3 && q.y0 < o.y1 + 0.3 && q.y1 > o.y0 - 0.3));
    const merged = [o, ...touch.flat()];
    for (const t of touch) climbs.splice(climbs.indexOf(t), 1);
    climbs.push(merged);
  }
  const links = [];
  for (const c of climbs) {
    const lo = c.reduce((a, q) => (q.y0 < a.y0 ? q : a)), hi = c.reduce((a, q) => (q.y1 > a.y1 ? q : a));
    const yl = levels.filter(l => Math.abs(l - lo.y0) < 0.7).sort((a, d) => Math.abs(a - lo.y0) - Math.abs(d - lo.y0))[0];
    const yh = levels.filter(l => Math.abs(l - hi.y1) < 0.9 && l !== yl).sort((a, d) => Math.abs(a - hi.y1) - Math.abs(d - hi.y1))[0];
    if (yl == null || yh == null) continue;
    const la = levels.indexOf(yl), lb = levels.indexOf(yh);
    links.push([cellsNear(lo, 1.2, false).filter(([l]) => l === la), cellsNear(hi, 1.2, false).filter(([l]) => l === lb)]);
  }
  const flood = () => {
    const seenA = L.map(g => new Uint8Array(g.nx * g.nz));
    const q = [];
    const add = ([li, c]) => { if (!seenA[li][c] && !L[li].blk[c]) { seenA[li][c] = 1; q.push([li, c]); } };
    entries.forEach(add);
    if (!q.length && L.length) {
      const g = L[0];
      for (let c = 0; c < g.nx * g.nz; c++) if (g.inR[c] && !g.blk[c]) { add([0, c]); break; }
    }
    const walk = () => {
      while (q.length) {
        const [li, c] = q.pop(), g = L[li], i = Math.floor(c / g.nz), j = c % g.nz;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const i2 = i + di, j2 = j + dj;
          if (i2 < 0 || j2 < 0 || i2 >= g.nx || j2 >= g.nz) continue;
          const c2 = i2 * g.nz + j2;
          if (g.inR[c2]) add([li, c2]);
        }
      }
    };
    walk();
    for (let k = 0; k <= links.length; k++) {
      let more = false;
      for (const [a, c] of links) {
        const sa = a.some(([l, x]) => seenA[l][x]), sc = c.some(([l, x]) => seenA[l][x]);
        if (sa && !sc) { c.forEach(add); more = true; }
        if (sc && !sa) { a.forEach(add); more = true; }
      }
      walk();
      if (!more) break;
    }
    return seenA;
  };
  const roomCells = rooms.map(r => { const li = levelAt(r.y, 0.2); return cellsNear({ x0: (r.x0 + r.x1) / 2, x1: (r.x0 + r.x1) / 2, z0: (r.z0 + r.z1) / 2, z1: (r.z0 + r.z1) / 2 }, Math.hypot(r.x1 - r.x0, r.z1 - r.z0), false).filter(([l, c]) => { if (l !== li) return false; const g = L[l], x = cx(g, Math.floor(c / g.nz)), z = cz(g, c % g.nz); return x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1; }); });
  const targets = [];
  const reached = (sa, cells) => cells.some(([l, c]) => sa[l][c]);
  const base = flood();
  roomCells.forEach(cs => { if (reached(base, cs)) targets.push(cs); });
  links.forEach(([a, c]) => { if (reached(base, a)) targets.push(a); if (reached(base, c)) targets.push(c); });
  const mainNear = (p, o) => {
    const f = Fu[p.name];
    if (!p.decor || !f || !MAIN.has(f.cat) || p.outside || p.yard || /cauldron|cookingstation/.test(p.name)) return null;
    const li = L.findIndex(g => p.y > g.y - 0.3 && p.y < g.y + 0.45);
    return li < 0 ? null : cellsNear(o, 0.9, false).filter(([l]) => l === li);
  };
  return {
    rooms: rooms.length,
    // whether p can go in; when it can, it stays marked and, if it is a main piece, becomes a target
    test(p) {
      cutAt();
      const o = solidOf(p);
      if (!o || !L.length) return true;
      mark(o, 1);
      const sa = flood();
      const own = mainNear(p, o);
      const good = targets.every(cs => reached(sa, cs)) && (!own || reached(sa, own));
      if (!good) { mark(o, -1); return false; }
      if (own) targets.push(own);
      return true;
    },
    // after test(p) said yes: the piece went in (already marked) or did not (b.put keeps one piece per place)
    took(p, inSet) { const o = solidOf(p); if (!o || !L.length) return; if (inSet) seen++; else mark(o, -1); },
  };
}

function placer(b, T) {
  const Ck = CkH();
  let walk = null;
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
      // the way through the hall stays open (D-148): built once the hall's rooms are known
      if (!walk && b.rooms.length) walk = walker(b);
      const q = { ...p, decor: true, ...extra };
      if (walk && !o.free && !walk.test(q)) return false;
      const n0 = b.pieces.length;
      b.put(name, x, y, z, yaw, { decor: true, ...extra });
      if (walk && !o.free) walk.took(q, b.pieces.length > n0);
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

// A covered entrance over a door in a wall facing -z at (x0, z0): posts 'len' metres out at the front corners and every
// 2 m along the sides, beams, a small gable roof running out from the wall with its gable to the front. 'wy': the
// beams' height. Six posts or more make it the column porch (corpus: 6 or more columns, hubs.md).
function coveredEntrance(b, K, C, T, x0, z0, wy, len) {
  const zs = []; for (let d = 2; d <= len + 0.01; d += 2) zs.push(z0 - d);
  for (const z of zs) for (const sx of [-1.9, 1.9]) T.posts(b, K, x0 + sx, z + 0.1, wy);
  for (const sx of [-1.9, 1.9]) for (let d = 1; d < len; d += 2) b.put(K.beam, x0 + sx, wy + 0.1, z0 - d, 90);
  for (const x of [x0 - 1, x0 + 1]) b.put(K.beam, x, wy + 0.1, z0 - len + 0.1, 0);
  const parts = T.gablePieces(K, C, { cx: x0, cz: z0 - len / 2, W: len / 2, D: 3, alpha: 90 }, wy + 0.2, 1, [false, true], null, null);
  // the gable over posts is of planks (a stone course needs stone under it, as lib/generate.js does for gables)
  for (const p of parts) b.put(p.name === K.stoneWall ? (K.wallHalf || 'wood_wall_half') : p.name, p.x, p.y, p.z, p.yaw);
  b.notes.push(`A covered entrance on ${zs.length * 2} posts at the main door.`);
}

// A straight flight of wood_stair pieces (each climbs 1 m over a 2 m cell) up the cells in St.run from the floor at
// yLow toward St.dir, as lib/generate.js putStairRun.
function putStair(b, K, St, yLow) {
  const [dx, dz] = St.dir, yaw = normH(Math.atan2(-dx, -dz) * 180 / Math.PI);
  St.run.forEach(([x, z], k) => b.put(K.stair || 'wood_stair', x, yLow + k, z, yaw));
}

// ---------------------------------------------------------------- round hall

function ringPoly(N, L) { return L / (2 * Math.tan(Math.PI / N)); }
function polyInside(N, ap) {
  const ns = []; for (let k = 0; k < N / 2; k++) ns.push([Math.sin(rad(k * 360 / N)), Math.cos(rad(k * 360 / N))]);
  return (x, z, m = 0) => ns.every(([a, c]) => Math.abs(x * a + z * c) <= ap - m);
}
// Grid floor inside an N-gon of apothem ap at height y, outside radius rIn (a ring): 2 m cells centred on even
// coordinates where the whole cell is inside, 1 m pieces where their middle is 0.3 m or more inside (their corners run
// under the wall line, as builders lay floors), and a band of 1 m pieces turned with each wall side along its inner
// face, so the floor meets the wall all the way round. skip(x, z) leaves a 2 m cell out (and its band pieces).
function polyFloor(b, K, N, ap, y, o = {}) {
  const ins = polyInside(N, ap), Rr = Math.ceil(ap) + 1, rIn = o.rIn || 0;
  const out = (x, z, h) => [[-h, -h], [-h, h], [h, -h], [h, h]].every(([dx, dz]) => Math.hypot(x + dx, z + dz) >= rIn);
  const cells = [], ones = [];
  for (let x = -2 * Math.ceil(Rr / 2); x <= Rr; x += 2) for (let z = -2 * Math.ceil(Rr / 2); z <= Rr; z += 2) {
    if (o.skip && o.skip(x, z)) continue;
    // (2 m cells keep 0.9 m off the walls: the band lies there)
    if ([[-1, -1], [-1, 1], [1, -1], [1, 1]].every(([dx, dz]) => ins(x + dx, z + dz, o.band === false ? (o.m != null ? o.m : 0.05) : 0.9)) && out(x, z, 1)) {
      if (o.center && x === 0 && z === 0) o.center(); else b.put(K.floor, x, y, z);
      cells.push([x, z]);
    } else for (const dx of [-0.5, 0.5]) for (const dz of [-0.5, 0.5]) {
      const cx = x + dx, cz = z + dz;
      if (ins(cx, cz, 0.3) && out(cx, cz, 0.5)) { b.put(K.floor1, cx, y, cz); ones.push([cx, cz]); }
    }
  }
  if (o.band !== false) {
    const L = 2 * ap * Math.tan(Math.PI / N);
    for (let i = 0; i < N; i++) {
      const a = i * 360 / N, nx = Math.sin(rad(a)), nz = Math.cos(rad(a)), tx = Math.cos(rad(a)), tz = -Math.sin(rad(a));
      for (let t = -L / 2 + 0.5; t < L / 2 - 0.01; t += 1) {
        const x = nx * (ap - 0.5) + tx * t, z = nz * (ap - 0.5) + tz * t;
        if (o.skip && o.skip(2 * Math.round(x / 2), 2 * Math.round(z / 2))) continue;
        if (Math.hypot(x, z) - 0.71 < rIn) continue;
        if (cells.some(([cx, cz]) => Math.abs(x - cx) < 0.75 && Math.abs(z - cz) < 0.75) || ones.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 0.2)) continue;
        b.put(K.floor1, x, y, z, a, { band: true });
      }
    }
  }
  return cells;
}
// Ring roof from apothem ap at height top inward, rise per ring rs (1: 26 degrees, 2: 45), stopping when a ring's
// inner edge would pass inside 'stop' (a drum) or the crown (the smoke hole over the fire). Rings of pieces on a
// circle; with o.N of 12 or fewer (an octagon) rows of pieces along each straight side and a piece along each hip.
// Returns the rings.
function ringRoofH(b, K, ap, top, rs, o = {}) {
  const out = o.eave === false ? 0 : 0.75;
  let low = top - rs[0] * out / 2;
  const rings = [];
  for (let i = 0; ; i++) {
    const rho = ap + out - 1 - 2 * i;
    if (rho < (o.crown || 1.2) || rho < (o.stop || 0)) break;
    const r = rs[Math.min(i, rs.length - 1)], roof = r === 2 ? K.roof45 : K.roof26, y = low + (r === 2 ? 1 : 0);
    if (o.N && o.N <= 12) {
      // each side's row stops inside its hips (a piece past a hip stands up over the next side); a piece turned along
      // each hip and set a little lower closes the wedge between two rows, a hip line like a ridge
      const tn = Math.tan(Math.PI / o.N), m = Math.max(1, Math.floor(rho * tn + 0.05));
      for (let j = 0; j < o.N; j++) {
        const a = j * 360 / o.N, nx = Math.sin(rad(a)), nz = Math.cos(rad(a)), tx = Math.cos(rad(a)), tz = -Math.sin(rad(a));
        for (let q = 0; q < m; q++) { const t = -(m - 1) + 2 * q; b.put(roof, nx * rho + tx * t, y, nz * rho + tz * t, a); }
        const ah = (j + 0.5) * 360 / o.N, rh = rho / Math.cos(Math.PI / o.N);
        b.put(roof, Math.sin(rad(ah)) * rh, y - 0.12, Math.cos(rad(ah)) * rh, ah, { hip: true });
      }
    } else {
      const n = Math.max(4, Math.ceil(2 * Math.PI * rho / 1.7));
      for (let kk = 0; kk < n; kk++) { const phi = kk * 360 / n; b.put(roof, Math.sin(rad(phi)) * rho, y, Math.cos(rad(phi)) * rho, phi); }
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
// A wood fence as a rail at the edge between two 2 m cells at floor height y (a gallery or walkway edge).
function rail(b, K, x, y, z, yaw) { b.put(K.fence, x, y + 0.6, z, yaw); }
// Cells within a rect (x, z on the 2 m grid, even), and rects merged from cells row by row: rooms for the walk test.
function cellRects(cells, y, use) {
  const rows = new Map();
  for (const [x, z] of cells) { if (!rows.has(z)) rows.set(z, []); rows.get(z).push(x); }
  const out = [];
  for (const [z, xs] of rows) {
    xs.sort((a, c) => a - c);
    let s = xs[0], p = xs[0];
    for (const x of [...xs.slice(1), null]) {
      if (x !== null && x === p + 2) { p = x; continue; }
      out.push({ x0: s - 1, x1: p + 1, z0: z - 1, z1: z + 1, y, h: 3, use });
      if (x !== null) { s = x; p = x; }
    }
  }
  return out;
}

// Pieces put while fn runs are marked as the crown (a drum, lantern, raised crown or finial): the height cap applies to
// the main roof, and the crown may rise CROWN_OVER over it (generate's tier loop).
function asCrown(b, fn) {
  b.put = function (n, x, y, z, yaw, extra) { return Object.getPrototypeOf(b).put.call(b, n, x, y, z, yaw, { ...(extra || {}), crown: true }); };
  try { fn(); } finally { delete b.put; }
}
// A square lantern 6 m across over the fire at height y0, h tall: posts at its corners up to its top, beams round it,
// walls (or windows) in the corner bays, the middle bay of each side open for the smoke, and a small gable roof of
// pitch o.r over it (o.flat: a flat top of floor pieces).
function lantern(b, K, C, T, y0, h, o = {}) {
  for (const sx of [-3, 3]) for (const sz of [-3, 3]) for (let y = y0; y < y0 + h - 0.01;) { const hh = y0 + h - y >= 2 ? 2 : 1; b.put(hh === 2 ? K.pole : K.pole1, sx, y + hh / 2, sz); y += hh; }
  for (const t of [-2, 0, 2]) for (const sg of [-3, 3]) {
    b.put(K.beam, t, y0, sg, 0); b.put(K.beam, sg, y0, t, 90);
    if (t !== 0) { const kd = o.windows && h >= 3 ? 'window' : 'wall'; T.wallSegment(b, K, C, t, y0, sg, 0, h, kd, 'plank'); T.wallSegment(b, K, C, sg, y0, t, 90, h, kd, 'plank'); }
    b.put(K.beam, t, y0 + h, sg, 0); b.put(K.beam, sg, y0 + h, t, 90);
  }
  if (o.flat) for (const x of [-2, 0, 2]) for (const z of [-2, 0, 2]) b.put(K.floor, x, y0 + h, z);
  else for (const q of T.gablePieces(K, C, { cx: 0, cz: 0, W: 3, D: 3, alpha: 0 }, y0 + h, o.r || 1, [true, true], null, null)) b.put(/stone|marble|grausten/i.test(q.name) ? (PH.piece(q.name).size[1] >= 2 ? 'woodwall' : (K.wallHalf || 'wood_wall_half')) : q.name, q.x, q.y, q.z, q.yaw);
}

// ---------------------------------------------------------------- round halls (round, octagon, part)

// Sides and side length per stage: round 16 sides of 2 m (10 m across), 24 of 2 m (15 m), 16 of 4 m (20 m), 24 of
// 4 m (30 m); octagon 8 sides of 4, 6, 8 and 12 m (10, 14.5, 19 and 29 m). The part round takes the round's.
const RSPEC = { round: { s2: [16, 2], s3: [24, 2], s4: [16, 4], s5: [24, 4] }, octagon: { s2: [8, 4], s3: [8, 6], s4: [8, 8], s5: [8, 12] } };
// the culture's roof on a round hall: posts (rings of posts, an open crown under a cone), drum (a drum of high windows
// over the fire from s4), flat (a flat roof with a raised lantern over the fire)
const roundStyle = C => (C.roof === 'flat' ? 'flat' : C.roof === 'conical' ? 'posts' : 'drum');

function roundHall(b, K, C, T, o) {
  const { stage, variant, tier, ext } = o;
  const style = roundStyle(C);
  const k = +stage[1];
  const [N, L] = RSPEC[variant === 'octagon' ? 'octagon' : 'round'][stage], ap = ringPoly(N, L);
  // from s4 two storeys of 3 m with a gallery round the upper walls (tier 4: one storey, no gallery)
  const gallery = k >= 4 && tier < 4;
  const SHt = gallery ? 3 : style === 'posts' ? 3 : 4, storeys = gallery ? 2 : 1, top = SHt * storeys;
  const doorSide = N / 2, doorK = Math.floor(L / 4);
  const drum = style === 'drum' && k >= 4 && tier < 2;
  const Nd = k === 5 ? 18 : 16, apD = ringPoly(Nd, 2);
  // (at s4 under a drum the gallery's inner edge is the drum's ring, so one ring of posts carries both)
  const vR0 = ringPoly(k === 5 ? 18 : 16, 2) / Math.cos(Math.PI / (k === 5 ? 18 : 16));
  const drumOnGallery = gallery && k === 4 && style === 'drum' && tier < 2;
  const rIn = gallery ? (drumOnGallery ? vR0 + 0.1 : ap - (k === 5 ? 4.5 : 3.5)) : 0;
  // the part round's straight front at z = zc (an odd metre, about 0.4 of the way out; clear of the drum, and at s5
  // behind the walkway along the front)
  let zc = null;
  if (variant === 'part') {
    let c = Math.max(3, 0.4 * ap);
    if (drum) c = Math.max(c, apD + 1.2);
    if (k === 5 && gallery) c = Math.max(c, 9);
    zc = -(2 * Math.ceil((c - 1) / 2) + 1);
  }
  // the stair to the gallery: a flight of three along the -x wall rising toward the door side; the walkway across the
  // hall at s5 at z = -8 (in front of the fire, clear of the high seat and of the drum)
  const cxS = -2 * Math.ceil((rIn + 1) / 2);
  const St = gallery ? { run: [[cxS, 2], [cxS, 0], [cxS, -2]], stand: [cxS, 4], land: [cxS, -4], dir: [0, -1] } : null;
  const bridge = k === 5 && gallery ? [-8, -6, -4, -2, 0, 2, 4, 6, 8].map(x => [x, -8]) : [];
  const inCells = (list, x, z, m = 0) => list.some(([cx, cz]) => Math.abs(x - cx) < 1 + m && Math.abs(z - cz) < 1 + m);
  const stairCells = St ? [St.stand, ...St.run, St.land] : [];
  // the floor, the hearth's stone flags under the fire from s2 (D-131)
  polyFloor(b, K, N, ap, 0, { center: () => b.put('stone_floor_2x2', 0, -0.375, 0, 0, { hearthStone: true }) });
  // walls; the back door from s3 at the +x side, toward the door side of it (the kitchen's door from s4)
  const bays = [];
  for (let s = 0; s < storeys; s++) {
    const st = s > 0 && /stone/.test(o.wallStyle) ? 'plank' : o.wallStyle;
    bays.push(...polyWalls(b, K, C, T, N, L, ap, s * SHt, SHt, (i, kk) => {
      if (s === 0 && i === doorSide && kk === doorK && zc == null) return 'door';
      if (s === 0 && k >= 3 && i === N / 4 && kk === L / 2 - 1) return 'door';
      if (s === storeys - 1 && i % 3 === 1 && kk === 0) return 'window';
      return 'wall';
    }, st));
  }
  let door = bays.find(bb => bb.kind === 'door' && bb.i === doorSide) || { x: 0, z: -ap };
  // outer roof: two low rings then steeper (the culture's 26 degree pitch, or tier 1 on, keeps every ring low)
  let rs = drum ? [1] : style === 'posts' ? (k === 5 ? [1, 1, 2] : [1, 2]) : k === 5 ? [1, 1, 1, 2] : [1, 1, 2];
  if (C.pitch === 26 || tier >= 1) rs = rs.map(() => 1);
  const crown = tier >= 3 ? 4.4 : 2.4;
  let outer = { rings: [], top }, peak = top;
  if (style === 'flat') {
    // a flat roof, open over the fire, and over the opening a raised lantern: walls at its corners, the middle bays
    // open for the smoke, a flat top (tiers 0 and 1)
    polyFloor(b, K, N, ap, top, { skip: (x, z) => Math.hypot(x, z) < 3.5 });
    if (tier < 2) {
      asCrown(b, () => lantern(b, K, C, T, top, 2, { flat: true, windows: !!ext.highWindows }));
      peak = top + 2.4;
      b.notes.push('A flat roof, open over the fire, with a raised lantern over the opening: walls at its corners, the middle bays open, a flat top.');
    } else { peak = top + 0.2; b.notes.push('A flat roof, open over the fire.'); }
  } else {
    outer = ringRoofH(b, K, ap, top, rs, { stop: drum ? apD : 0, crown, N });
    peak = outer.top;
  }
  const roofAt = rho => { if (style === 'flat') return top; let y = top; for (const rg of outer.rings) if (rg.rho - 1 >= rho) y = rg.low + rg.r; else if (rg.rho + 1 > rho) { y = rg.low + rg.r * (rg.rho + 1 - rho) / 2; break; } return y; };
  if (drum) asCrown(b, () => {
    const last = outer.rings[outer.rings.length - 1];
    const yd = Math.floor(last.low + last.r * Math.min(1, (last.rho + 1 - apD) / 2) - 0.2);
    const vR = apD / Math.cos(Math.PI / Nd);
    // the drum stands on posts at every second to fourth corner (corpus inner posts, below)
    const every = Nd === 18 ? 3 : variant === 'part' ? 4 : 2;
    for (let i = 0; i < Nd; i += every) { const a = (i + 0.5) * 360 / Nd; T.posts(b, K, Math.sin(rad(a)) * vR, Math.cos(rad(a)) * vR, yd); }
    for (let i = 0; i < Nd; i++) {
      const a = i * 360 / Nd, x = Math.sin(rad(a)) * apD, z = Math.cos(rad(a)) * apD;
      b.put(K.beam, x, yd + 0.1, z, a);
      T.wallSegment(b, K, C, x, yd + 0.2, z, a, 3, i % 2 === 0 ? 'window' : 'wall', 'plank');
      b.put(K.beam, x, yd + 3.2, z, a);
    }
    const inner = ringRoofH(b, K, apD, yd + 3.2, [1], { eave: false });
    peak = inner.top;
    b.notes.push('A drum of high windows on posts over the fire, the outer roof running up to it and a low cone over it.');
  });
  // post rings: the gallery's (from s4) carrying its inner edge; the cone's rings (posts style) at s2, s3 and s5
  const rings = [];
  if (gallery && !drumOnGallery) rings.push({ r: rIn - 0.1, h: style === 'flat' ? top : SHt });
  if (style === 'posts' && k <= 3) rings.push({ r: ap - 2.2 });
  const postsOf = [];
  for (const rr of rings) {
    // posts 5.5 m or more apart round the ring (corpus round and polygon buildings over 300 m2: 7.5 free-standing inner
    // posts in the median, 1.45 per 100 m2, clear radius round the middle 6 m, nearest post 2 to 4 m; lab/hub_posts.py)
    const n = Math.max(6, Math.floor(2 * Math.PI * rr.r / 5.5 / 2) * 2);
    const h = rr.h || Math.max(2, Math.floor(roofAt(rr.r) - 0.6));
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) * 360 / n, x = Math.sin(rad(a)) * rr.r, z = Math.cos(rad(a)) * rr.r;
      if (Math.hypot(x - (zc != null ? 0 : door.x), z - (zc != null ? zc : door.z)) < 2.4) continue;
      if (zc != null && z < zc + 0.5) continue;
      if (inCells(stairCells, x, z, 0.3) || inCells(bridge, x, z, 0.3)) continue;
      T.posts(b, K, x, z, h);
      postsOf.push({ x, z, h });
    }
  }
  // the gallery round the upper walls (from s4): floor between the gallery ring and the wall, open over the stair; a
  // rail on its inner edge; the stair up from the floor; at s5 the walkway across the hall on posts, railed both sides
  if (gallery) {
    polyFloor(b, K, N, ap, SHt, { rIn, m: 0.02, skip: (x, z) => inCells(St.run, x, z) || inCells(bridge, x, z) });
    putStair(b, K, St, 0);
    const nr = Math.round(2 * Math.PI * rIn / 2);
    for (let i = 0; i < nr; i++) {
      const a = (i + 0.5) * 360 / nr, x = Math.sin(rad(a)) * (rIn - 0.1), z = Math.cos(rad(a)) * (rIn - 0.1);
      if (inCells(bridge, x, z, 0.4) || inCells(St.run, x, z, 0.4)) continue;
      rail(b, K, x, SHt, z, normH(a + 90));
    }
    // the stairwell: rails along both sides of the flight and across its low end
    for (const [x, z] of St.run) for (const sx of [-1, 1]) rail(b, K, x + sx, SHt, z, 90);
    rail(b, K, cxS, SHt, St.run[0][1] + 1, 0);
    if (bridge.length) {
      for (const [x, z] of bridge) if (polyInside(N, ap)(x, z, 1)) b.put(K.floor, x, SHt, z);
      for (const [x] of bridge) { rail(b, K, x, SHt, -7, 0); if (zc == null && Math.abs(x) <= 6) rail(b, K, x, SHt, -9, 0); }
      // (the walkway spans from gallery to gallery)
      b.notes.push('A walkway across the hall high up in front of the fire, between the two sides of the gallery.');
    }
    b.notes.push('A gallery round the upper walls at 3 m, a stair up to it from the floor.');
  }
  // the crown: a smoke cap on four short posts (drum style, s2 and s3); over the posts style crown from s4 a raised
  // roof on a ring of posts, open at the sides for the smoke, with a finial post on top (tier 0)
  const crownY = outer.top;
  if (style !== 'flat' && !drum && (style === 'drum' || (k >= 4 && tier < 2)) && tier < 3) {
    const big = style === 'posts', rp = big ? 2.6 : 1.4, hp = big ? 2 : 1, np = big ? 8 : 4;
    asCrown(b, () => {
    for (let i = 0; i < np; i++) { const a = (i + 0.5) * 360 / np; for (let y = crownY - 0.6; y < crownY - 0.6 + hp - 0.01; y += 1) b.put(K.pole1, Math.sin(rad(a)) * rp, y + 0.5, Math.cos(rad(a)) * rp); }
    const cap = ringRoofH(b, K, big ? 3.4 : 1.9, crownY - 0.6 + hp, big && tier < 1 && C.pitch !== 26 ? [2] : [1], { eave: true, crown: 0.4 });
    peak = Math.max(peak, cap.top + (big ? 0 : 0.5));
    if (big) { for (let y = cap.top - 0.5; y < cap.top + 1.5; y += 1) b.put(K.pole1, 0, y + 0.5, 0); peak = cap.top + 1.5; }
    else b.put(K.roofTop26 || 'wood_roof_top', 0, cap.top, 0, 0);
    });
    b.notes.push(big ? 'A raised roof on a ring of posts over the open crown, a finial post on top.' : 'A smoke cap on four posts over the crown.');
  }
  // the part round: everything in front of the straight wall comes out; the wall goes up with the door in its middle,
  // filled to the roof above (a tall flat front)
  if (zc != null) {
    const m0 = p => { const role = PH.piece(p.name).role; return ['roof', 'roofTop', 'roofCorner'].includes(role) ? 0.8 : role === 'floor' ? 0 : 0.3; };
    b.pieces = b.pieces.filter(p => p.decor || p.z >= zc - m0(p));
    const w = Math.sqrt(ap * ap - zc * zc), mm = Math.floor((w - 1) / 2);
    for (let s = 0; s < storeys; s++) {
      const st = s > 0 && /stone/.test(o.wallStyle) ? 'plank' : o.wallStyle;
      for (let x = -2 * mm; x <= 2 * mm; x += 2) {
        const kind = s === 0 && x === 0 ? 'door' : s === storeys - 1 && Math.abs(x) % 4 === 2 && Math.abs(x) > 2 ? 'window' : 'wall';
        T.wallSegment(b, K, C, x, s * SHt, zc, 0, SHt, kind, st);
        b.put(K.beam, x, s * SHt + SHt, zc, 0);
      }
    }
    // a row of 1 m floor pieces along the front's inside out to the ring's wall, where the grid stopped short
    const insP = polyInside(N, ap);
    for (const yy of gallery ? [0, SHt] : [0]) for (let x = -Math.floor(w) + 0.5; x < w; x += 1) {
      if (!insP(x, zc + 0.5, -0.3)) continue;
      if (b.pieces.some(p => PH.piece(p.name).role === 'floor' && Math.abs(p.y - yy) < 0.2 && Math.abs(p.x - x) < 0.6 && Math.abs(p.z - zc - 0.5) < 0.6)) continue;
      if (yy > 0 && (Math.hypot(x, zc + 0.5) < rIn + 0.5 || inCells(bridge, x, zc + 0.5))) continue;
      b.put(K.floor1, x, yy, zc + 0.5);
    }
    // the last metre or so to the ring's wall in 1 m pieces, so the front closes against the ring
    for (const sx of [-1, 1]) for (let x = 2 * mm + 1.5; x + 0.5 <= w + 0.3; x += 1) for (let yy = 0; yy < top - 0.01; yy += 1) {
      if (b.pieces.some(p => !p.decor && ['wall', 'door', 'window'].includes(PH.piece(p.name).role) && Math.hypot(p.x - sx * x, p.z - zc) < 0.8 && Math.abs(p.y - yy - 0.5) < 0.9)) continue;
      const stone = yy < SHt && /stone/.test(o.wallStyle) && K.stoneBlock && !(o.wallStyle === 'stone-base' && yy >= 1);
      b.put(stone ? K.stoneBlock : (K.wallQuarter || 'wood_wall_quarter'), sx * x, yy + 0.5, zc, 0);
    }
    for (const sx of [-1, 1]) T.posts(b, K, sx * (2 * mm + 1), zc, top);
    if (style !== 'flat') for (let x = -2 * mm; x <= 2 * mm; x += 2) {
      const h = Math.floor(roofAt(Math.hypot(Math.abs(x) + 1, zc)) - top - 0.3);
      if (h >= 1) T.wallSegment(b, K, C, x, top, zc, 0, h, 'wall', 'plank');
    }
    door = { x: 0, z: zc };
    b.notes.push(`A straight front ${(2 * mm + 2)} m wide with the door, ${(-zc).toFixed(0)} m in front of the fire; the open part of the round in front is the forecourt.`);
  }
  const doors = [door, ...bays.filter(bb => bb.kind === 'door' && bb.i !== doorSide).map(bb => ({ x: bb.x, z: bb.z }))];
  // side rooms from s4 against the +x wall, under the gallery: a kitchen toward the door side (with the back door), a
  // storage closet behind it, a partition with a door into each and a wall between them
  const rooms = [];
  if (k >= 4) {
    const xs = 2 * Math.ceil(((gallery ? rIn : ap - 3.5) - 1) / 2) + 1, w = Math.sqrt(ap * ap - xs * xs) - 0.2;
    const zMin = zc != null ? zc + 1 : -w;
    for (let z = -2 * Math.floor((w - 1) / 2); z <= w - 1 + 1e-6; z += 2) {
      if (z - 1 < zMin - 0.01) continue;
      T.wallSegment(b, K, C, xs, 0, z, 90, SHt, Math.abs(z) === 4 ? 'door' : 'wall', 'plank');
    }
    for (let x = xs + 1; x + 1 <= Math.sqrt(ap * ap) - 0.4; x += 2) T.wallSegment(b, K, C, x, 0, 0, 0, SHt, 'wall', 'plank');
    rooms.push({ x0: xs, x1: ap, z0: Math.max(zMin, -w), z1: 0, y: 0, h: SHt, use: 'kitchen' }, { x0: xs, x1: ap, z0: 0, z1: w, y: 0, h: SHt, use: 'storage' });
    doors.push({ x: xs, z: -4 }, { x: xs, z: 4 });
    b.notes.push('Two side rooms under the gallery: a kitchen and a storage closet.');
  }
  // the hall, the gallery (its rail closes it off from the open middle), the walkway, the side rooms
  b.rooms.push({ x0: -ap, x1: ap, z0: zc != null ? zc : -ap, z1: ap, y: 0, h: top, use: 'hall', main: true, door: { x: door.x, z: door.z } });
  if (gallery) b.rooms.push({ x0: -ap, x1: ap, z0: zc != null ? zc : -ap, z1: ap, y: SHt, h: SHt, use: 'gallery' });
  b.rooms.push(...rooms);
  b.doorX = door.x;
  // s2 stands inside the camp's ring of lean-tos, which come down as the hall rises (D-132); one stands on behind the
  // hall as a woodshed, clear of the eaves
  if (k === 2) {
    const sh = leanTo(b, K, 0, ap + 1.8);
    const [wx, wz] = sh.at(ap + 3.4, 0);
    b.put('wood_stack', wx, 0.57, wz, 90, { decor: true, ds: 2 });
    b.notes.push('The camp\'s lean-tos give way to the hall; one stands on behind it as a woodshed.');
  }
  // the covered entrance at the main door from s4, six posts with the porch draw
  if (k >= 4) {
    const wy = Math.min(3, top - 1.6);
    coveredEntrance(b, K, C, T, door.x, door.z, wy, ext.porch6 ? 6 : 4);
    if (ext.dragons) b.put('wood_dragon1', door.x, wy + 1.3, door.z - (ext.porch6 ? 6 : 4) - 0.6, 180, { decor: true });
  }
  return { ap, N, L, top, peak, door, doors, rings, postsOf, gallery, rIn, St, bridge, drum, apD, SHt, zc, style, roofAt, rooms, sideX: k >= 4 ? rooms[0].x0 : null };
}

// ---------------------------------------------------------------- cross hall

// Half sizes per stage (odd metres): the front and back arm along z (Wz), the side arms along x (Wx), the arms' half
// width D, the storey height and storeys. s2 14 x 14 m with arms 6 m wide; s3 18 x 18 m, arms 10 m; s4 26 x 22 m, two
// storeys; s5 30 x 26 m, arms 14 m.
const CSPEC = { s2: [7, 7, 3, 3, 1], s3: [9, 9, 5, 4, 1], s4: [13, 11, 5, 3, 2], s5: [15, 13, 7, 3, 2] };
function crossHall(b, K, C, T, o) {
  const { stage, tier, ext } = o;
  const k = +stage[1];
  let [Wz, Wx, D, SHt, storeys] = CSPEC[stage];
  if (tier >= 4 && storeys === 2) { SHt = 4; storeys = 1; }
  const top = SHt * storeys, gallery = storeys === 2;
  const r = tier >= 1 || C.pitch === 26 ? 1 : 2;
  const inMain = (x, z) => Math.abs(x) < D && Math.abs(z) < Wz, inTrans = (x, z) => Math.abs(x) < Wx && Math.abs(z) < D;
  const cells = new Map();
  for (let x = -Wx + 1; x < Wx; x += 2) for (let z = -Wz + 1; z < Wz; z += 2) if (inMain(x, z) || inTrans(x, z)) cells.set(`${x},${z}`, [x, z]);
  const has = (x, z) => cells.has(`${x},${z}`);
  // floor; the hearth's stone flags at the crossing
  for (const [, [x, z]] of cells) {
    if (x === 0 && z === 0) { b.put('stone_floor_2x2', 0, -0.375, 0, 0, { hearthStone: true }); continue; }
    b.put(K.floor, x, 0, z);
  }
  // walls on every outer edge: the main door at the front arm's end, from s3 a door at the +x arm's end (the kitchen's
  // from s4); windows in the long walls below, every other bay above
  const edges = [];
  for (const [, [x, z]] of cells) for (const [dx, dz, yaw] of [[0, -2, 0], [0, 2, 0], [-2, 0, 90], [2, 0, 90]]) {
    if (has(x + dx, z + dz)) continue;
    edges.push({ x: x + dx / 2, z: z + dz / 2, yaw, nx: -dx / 2, nz: -dz / 2 });
  }
  const isMainDoor = e => e.yaw === 0 && Math.abs(e.z + Wz) < 0.01 && Math.abs(e.x) < 0.01;
  const isSideDoor = e => k >= 3 && e.yaw === 90 && Math.abs(e.x - Wx) < 0.01 && Math.abs(e.z) < 0.01;
  const endWall = e => (e.yaw === 0 && Math.abs(Math.abs(e.z) - Wz) < 0.01) || (e.yaw === 90 && Math.abs(Math.abs(e.x) - Wx) < 0.01);
  const doors = [];
  for (const e of edges) for (let s = 0; s < storeys; s++) {
    const st = s > 0 && /stone/.test(o.wallStyle) ? 'plank' : o.wallStyle;
    const along = e.yaw === 0 ? e.x : e.z;
    let kind = 'wall';
    if (s === 0 && (isMainDoor(e) || isSideDoor(e))) kind = 'door';
    else if (!endWall(e) && s === storeys - 1 && storeys > 1 && Math.abs(along) % 4 === 2) kind = 'window';
    else if (!endWall(e) && s === 0 && Math.abs(along) % 6 === 4) kind = 'window';
    T.wallSegment(b, K, C, e.x, s * SHt, e.z, e.yaw, SHt, kind, st);
    b.put(K.beam, e.x, s * SHt + SHt, e.z, e.yaw);
    if (kind === 'door') doors.push({ x: e.x, z: e.z });
  }
  // side rooms from s4 at the ends of the side arms: a storage closet (-x) and a kitchen (+x), each behind a partition
  // with a door
  const p = Wx - 4, rooms = [];
  if (k >= 4) {
    for (const sx of [-1, 1]) for (let z = -D + 1; z < D; z += 2) T.wallSegment(b, K, C, sx * p, 0, z, 90, SHt, z === 0 ? 'door' : 'wall', 'plank');
    rooms.push({ x0: p, x1: Wx, z0: -D, z1: D, y: 0, h: SHt, use: 'kitchen' }, { x0: -Wx, x1: -p, z0: -D, z1: D, y: 0, h: SHt, use: 'storage' });
    doors.push({ x: p, z: 0 }, { x: -p, z: 0 });
    b.notes.push('Side rooms at the ends of the side arms: a kitchen with its own door out, and a storage closet.');
  }
  // the gallery (from s4) at 3 m. s4: over the front arm's end (over the door) and along its -x wall, a stair up the +x
  // wall. s5: along both walls of every arm, so a railed walkway runs round the hall and crosses the front and back arms
  // and the side arms at the crossing, round an opening over the fire; lofts over the side rooms; two stairs up the
  // back arm's walls toward the high seat end
  const G = new Map(), stairs = [];
  const addG = (x, z) => { if (has(x, z)) G.set(`${x},${z}`, [x, z]); };
  if (gallery && k === 4) {
    for (let x = -D + 1; x < D; x += 2) addG(x, -Wz + 1);
    for (let z = -Wz + 3; z <= -D - 1; z += 2) addG(-D + 1, z);
    stairs.push({ run: [[D - 1, -D - 1], [D - 1, -D - 3], [D - 1, -D - 5]], stand: [D - 1, -D + 1], land: [D - 1, -D - 7], dir: [0, -1] });
    addG(D - 1, -D - 7);
  } else if (gallery) {
    for (const [, [x, z]] of cells) if ((inMain(x, z) && Math.abs(x) >= 4) || (inTrans(x, z) && Math.abs(z) >= 4) || (inTrans(x, z) && Math.abs(x) >= p + 1)) addG(x, z);
    for (const sx of [-1, 1]) stairs.push({ run: [[sx * 6, 8], [sx * 6, 10], [sx * 6, 12]], stand: [sx * 6, 6], land: [sx * 6, 14], dir: [0, 1] });
  }
  const isRun = (x, z) => stairs.some(St => St.run.some(c => c[0] === x && c[1] === z));
  for (const St of stairs) for (const [x, z] of St.run) G.delete(`${x},${z}`);
  if (G.size) {
    for (const [, [x, z]] of G) b.put(K.floor, x, SHt, z);
    for (const St of stairs) putStair(b, K, St, 0);
    // rails wherever a gallery cell meets the open hall, except the step from a landing onto its stair
    for (const [, [x, z]] of G) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + 2 * dx, nz = z + 2 * dz;
      if (!has(nx, nz) || G.has(`${nx},${nz}`)) continue;
      if (stairs.some(St => St.land[0] === x && St.land[1] === z && St.run[St.run.length - 1][0] === nx && St.run[St.run.length - 1][1] === nz)) continue;
      rail(b, K, x + dx, SHt, z + dz, dx ? 90 : 0);
    }
    b.notes.push(k === 5 ? 'A gallery at 3 m along the walls of every arm, crossing the arms round the opening over the fire, lofts over the side rooms, two stairs.' : 'A gallery at 3 m over the door and along one wall of the front arm, a stair up to it.');
  }
  // roof: a gable over each pair of arms; where they cross the valleys join them (generate.js, as for a house's wings)
  const wings = [{ cx: 0, cz: 0, W: Wz, D, alpha: 90, main: true }, { cx: 0, cz: 0, W: Wx, D, alpha: 0 }];
  const parts = [];
  for (const w of wings) parts.push(...T.gablePieces(K, C, w, top, r, [true, true], null, null));
  T.valleys(parts, b);
  const tower = k >= 4 && tier < 2 && ext.tiers3;
  const capY = top + r * (D - 1) / 2;
  const placed = new Set();
  for (const q of parts) {
    if (q.role === 'gone') continue;
    const key = `${q.name}|${Math.round(q.x * 100)}|${Math.round(q.y * 100)}|${Math.round(q.z * 100)}|${Math.round(q.yaw) % 360}`;
    if (placed.has(key)) continue;
    placed.add(key);
    // the opening into the lantern tower over the crossing; without one the ridge caps there stay out for smoke
    if (tower && q.role !== 'gable' && Math.abs(q.x) < 3 && Math.abs(q.z) < 3) continue;
    if (!tower && q.role === 'cap' && Math.abs(q.x) < 2.5 && Math.abs(q.z) < 2.5) continue;
    const hidden = wings.some(w2 => w2 !== q.wing && T.inside(w2, q.x, q.z, -0.2) && q.surf < T.surfaceAt(w2, q.x, q.z, top, r) - 0.25);
    // a stone gable course needs stone right under it (lib/generate.js): over the plank upper storey it is planks
    const nm = /stone|marble|grausten/i.test(q.name) && (storeys > 1 || o.wallStyle !== 'stone') ? (PH.piece(q.name).size[1] >= 2 ? 'woodwall' : (K.wallHalf || 'wood_wall_half')) : q.name;
    if (!hidden) b.put(nm, q.x, q.y, q.z, q.yaw);
  }
  let peak = capY + 0.3;
  // the lantern tower: four posts at the crossing's inner corners up to the roofs, a ring of walls with windows at the
  // corners and the middle bays open for the smoke, a small gable roof over it
  if (tower) {
    const y0 = capY - r;
    asCrown(b, () => {
      for (const sx of [-3, 3]) for (const sz of [-3, 3]) T.posts(b, K, sx, sz, y0);
      lantern(b, K, C, T, y0, 3, { r, windows: !!ext.highWindows });
    });
    peak = y0 + 3 + r + 0.3;
    b.notes.push(`A lantern tower over the crossing, ${ext.highWindows ? 'windows' : 'walls'} at its corners and open bays for the smoke.`);
  }
  // carved heads at the four gable ends (s4 on, or by the draw)
  if ((C.dragons && k >= 4) || ext.dragons) {
    for (const sg of [-1, 1]) {
      b.put('wood_dragon1', 0, capY - 0.7, sg * (Wz + 0.6), sg > 0 ? 0 : 180, { decor: true });
      b.put('wood_dragon1', sg * (Wx + 0.6), capY - 0.7, 0, sg > 0 ? 90 : 270, { decor: true });
    }
  }
  // porch: a row of posts 4 m out from the front arm's end, a lean-to roof against it (corpus: 6 or more columns);
  // else from s4 a covered entrance over the main door
  const porch = k >= 4 && !!ext.porch6;
  if (porch) {
    const zp = -Wz - 4, yb = 3;
    for (let x = -D; x <= D; x += 2) T.posts(b, K, x, zp + 0.15, yb);
    for (let x = -D + 1; x <= D - 1; x += 2) { b.put(K.beam, x, yb + 0.1, zp + 0.15, 0); b.put(K.roof26, x, yb + 1, zp + 3, 180); b.put(K.roof26, x, yb, zp + 1, 180); }
    b.notes.push(`Porch of ${D + 1} posts across the front.`);
  } else if (k >= 4) coveredEntrance(b, K, C, T, 0, -Wz, 3, 4);
  // tie beams across the arms at the wall top (D-128: tie beams in halls), the chandeliers hang from them
  const tie = { s3: { z: [7, -7], x: [7, -7] }, s4: { z: [7, 11, -7, -11], x: [6, -6] }, s5: { z: [12.5, -12.5], x: [8, -8] } }[stage] || { z: [], x: [] };
  for (const z of tie.z) for (let x = -D + 1; x < D; x += 2) b.put(K.beam, x, top + 0.1, z, 0);
  for (const x of tie.x) for (let z = -D + 1; z < D; z += 2) b.put(K.beam, x, top + 0.1, z, 90);
  const hangs = [...tie.z.map(z => [0, z]), ...tie.x.map(x => [x, 0])].map(([x, z]) => ({ x, z, y: top - 1.97 }));
  // rooms: the two arms, the gallery's cells, the side rooms
  b.rooms.push({ x0: -D, x1: D, z0: -Wz, z1: Wz, y: 0, h: top, use: 'hall', main: true, door: { x: 0, z: -Wz } });
  b.rooms.push({ x0: -Wx, x1: Wx, z0: -D, z1: D, y: 0, h: top, use: 'hall' });
  if (G.size) b.rooms.push(...cellRects([...G.values()], SHt, 'gallery'));
  b.rooms.push(...rooms);
  b.doorX = 0;
  b.notes.push(`Cross hall ${2 * Wx} x ${2 * Wz} m, arms ${2 * D} m wide, round the fire at the crossing.`);
  return { Wz, Wx, D, top, SHt, capY, peak, doors, door: { x: 0, z: -Wz }, edges, stairs, G, rooms, porch, hangs, sideX: k >= 4 ? p : null, isRun };
}

// ---------------------------------------------------------------- furnishing a hall stage

// Spots along a list of wall bays' inner faces at floor height y: { x, y, z, nx, nz (into the room), yawIn }
const spotOf = (x, z, nx, nz, y) => ({ x, y, z, nx, nz, yawIn: normH(Math.atan2(nx, nz) * 180 / Math.PI) });
function wallSpots(b, o, F, y) {
  const out = [];
  if (o.line === 'cross') {
    for (const e of F.edges) {
      if (F.doors.some(d => Math.hypot(d.x - e.x, d.z - e.z) < 2.5)) continue;
      if (F.sideX != null && Math.abs(e.x) > F.sideX + 0.5) continue;
      if (e.yaw === 0 && Math.abs(e.z) >= F.Wz - 0.01 && e.z > 0) continue; // the trophy wall behind the high seat
      out.push(spotOf(e.x, e.z, e.nx, e.nz, y));
    }
  } else {
    const n = Math.round(2 * Math.PI * F.ap / 2.2);
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) * 360 / n, rr = F.ap * Math.cos(Math.PI / F.N) - 0.15;
      const x = Math.sin(rad(a)) * rr, z = Math.cos(rad(a)) * rr;
      if (F.zc != null && z < F.zc + 1) continue;
      if (F.sideX != null && x > F.sideX - 0.5) continue;
      if (Math.abs(normH(a + 180) - 180) < 40) continue; // the trophy wall
      out.push(spotOf(x, z, -Math.sin(rad(a)), -Math.cos(rad(a)), y));
    }
  }
  return out.sort((a, c) => Math.atan2(a.x, a.z) - Math.atan2(c.x, c.z));
}
// Spots round the inside of a side room's rect, 0.9 m in from its edges, facing in; inside the hall's walls.
function roomSpots(room, ok) {
  const out = [], cx = (room.x0 + room.x1) / 2, cz = (room.z0 + room.z1) / 2;
  for (let x = room.x0 + 0.9; x <= room.x1 - 0.9 + 1e-6; x += 0.8) for (let z = room.z0 + 0.9; z <= room.z1 - 0.9 + 1e-6; z += 0.8) {
    const edge = Math.min(x - room.x0, room.x1 - x, z - room.z0, room.z1 - z);
    if (edge > 1.0 || !ok(x, z)) continue;
    // face away from the nearest edge
    const d = [[x - room.x0, 1, 0], [room.x1 - x, -1, 0], [z - room.z0, 0, 1], [room.z1 - z, 0, -1]].sort((a, c) => a[0] - c[0])[0];
    out.push({ x, z, yaw: normH(Math.atan2(d[1], d[2]) * 180 / Math.PI), a: Math.atan2(x - cx, z - cz) });
  }
  return out.sort((a, c) => a.a - c.a);
}

function furnish(b, K, C, T, o, F) {
  const { stage, line, place, has, skipDecor } = o;
  const k = +stage[1];
  const ds = n => ({ ds: n });
  // the fire at the heart: a hearth from s2 (stone flags under it, D-131)
  b.put(k >= 2 ? 'hearth' : 'fire_pit', 0, 0.125, 0, 0, { decor: true, hearth: true, ds: 1 });
  place.keep(-2.4, 2.4, -2, 2, 0, 3);
  b.put('piece_cookingstation', 0, 0.55, 0, 0, { decor: true, ds: 1 });
  const fires = [{ x: 0, z: 0 }];
  // more fires in the big halls (corpus: 3 or more fires in 17 % of the ranked set, 63 % of the top tenth): the cross
  // a second fire in the front arm from s4 and one in the back arm at s5 by the draw; the round hall two at its sides
  // at s5 by the draw. Never under a gallery or walkway.
  const extra = line === 'cross' ? (k === 5 && has('fires3', stage) ? [[0, -9], [0, 9]] : k >= 4 ? [[0, -9]] : [])
    : k === 5 && has('fires3', stage) ? [[-7, 0], [7, 0]].filter(([x]) => F.sideX == null || x < F.sideX - 2) : [];
  for (const [x, ez] of extra) {
    b.put('stone_floor_2x2', x, -0.375, ez, 0, { hearthStone: true });
    b.pieces = b.pieces.filter(q => !(q.name === K.floor && Math.abs(q.x - x) < 0.01 && Math.abs(q.z - ez) < 0.01 && Math.abs(q.y) < 0.01));
    b.put('fire_pit', x, 0.125, ez, 0, { decor: true, hearth: true, ds: 1 });
    place.keep(x - 1.6, x + 1.6, ez - 1.6, ez + 1.6, 0, 3);
    fires.push({ x, z: ez });
  }
  // doors, stairs: 2.2 m wide, 2 m in front and behind
  for (const d of (F.doors || [])) place.keep(d.x - 1.6, d.x + 1.6, d.z - 1.6, d.z + 1.6, 0, 3, true);
  if (F.door) place.keep(F.door.x - 1.3, F.door.x + 1.3, F.door.z - 0.5, F.door.z + 3, 0, 3);
  for (const St of [...(F.stairs || []), ...(F.St ? [F.St] : [])]) for (const c of [St.stand, ...St.run, St.land]) place.keep(c[0] - 1.1, c[0] + 1.1, c[1] - 1.1, c[1] + 1.1, -1, 100, true);
  // the way from the door to the fire
  place.keep(F.door.x - 1.3, F.door.x + 1.3, F.door.z, 0, 0, 3);
  let leader = null, spouse = null;
  // the high seat (from s3) at the back facing the fire: the back arm's end in a cross, opposite the door in a round
  // hall (inside the gallery's ring); on a dais when the village has one (corpus: under 7 % of high seats in the set,
  // 32 % in the top tenth), always at s5. A seat for the spouse beside it (D-154).
  if (k >= 3) {
    // (in a round hall with a drum, inside the drum's ring of posts)
    const sx = 0, sz = line === 'cross' ? F.Wz - 1.3 : F.drum ? F.apD - 1.1 : (F.gallery ? F.rIn - 1.3 : F.ap - 2.2), yaw = 180;
    const dais = has('dais', stage) || k === 5;
    let y = 0.125;
    if (dais) {
      for (let a = -1.5; a <= 1.5; a += 1) for (let c = 0; c < 3; c++) {
        const x = sx + a, z = sz + (c - 0.7);
        b.put(K.floor1, x, 0.25, z, 0, { dais: true });
        if (c < 2) b.put(K.floor1, x, 0.5, z, 0, { dais: true });
      }
      y = 0.625;
      b.notes.push('The high seat on a dais.');
    }
    b.put('piece_throne01', sx, y, sz, yaw, { decor: true, ds: 1, highSeat: true });
    place.keep(sx - 1, sx + 1, sz - 1, sz + 1, 0, 3);
    leader = { x: sx, y, z: sz, yaw };
    for (const s of [1.45, -1.45]) if (place.put('piece_chair02', sx + s, y, sz, yaw, { ds: 1, spouseSeat: true }, { inKeep: true })) { spouse = { x: sx + s, y, z: sz, yaw }; break; }
    place.keep(-1.3, 1.3, 2, sz - 0.6, 0, 3);
    for (const s of [-1, 1]) place.put('piece_groundtorch_wood', sx + s * 2.6, y + 0.75, sz + 0.4, 0, ds(2));
  }
  if (skipDecor) { b.leader = leader || { x: 0, y: 0.125, z: 3, yaw: 180 }; b.spouse = spouse; return; }
  // seats round the fires: benches on three sides at s2 and s3, two from s4 (corpus: rugs by 47 to 51 % of hall fires,
  // seats by a third), rugs by the fires (d2)
  const benches = [];
  for (const f of fires) {
    const ring = f.x === 0 && f.z === 0 ? [0, 90, 270, 180].slice(0, k <= 3 ? 3 : 2) : [90, 270];
    for (const a of ring) {
      const x = f.x + Math.sin(rad(a)) * 3.2, z = f.z + Math.cos(rad(a)) * 3.2;
      if (place.put('piece_bench01', x, 0.125, z, a + 180, ds(f === fires[0] ? 1 : 2))) benches.push({ x, z, yaw: normH(a + 180), a, main: f === fires[0] });
    }
    for (const a of [45, 225]) place.put('rug_fur', f.x + Math.sin(rad(a)) * 2.6, 0.14, f.z + Math.cos(rad(a)) * 2.6, a, ds(2), { onFurn: true, inKeep: true });
  }
  if (!leader) {
    const bn = benches.find(bb => bb.main && bb.a === 0) || benches[0];
    leader = bn ? { x: bn.x, y: 0.125, z: bn.z, yaw: bn.yaw } : { x: 0, y: 0.125, z: 3, yaw: 180 };
  }
  // feast tables with benches: along the arms of a cross, in a ring in a round hall (under the gallery from s4)
  const tryTable = (x, z, yaw, d) => {
    if (!place.put('piece_table', x, 0.125, z, yaw, ds(d))) return;
    const nx = Math.sin(rad(yaw)), nz = Math.cos(rad(yaw));
    for (const s of [-1, 1]) place.put('piece_bench01', x + nx * s * 0.95, 0.125, z + nz * s * 0.95, yaw + (s > 0 ? 180 : 0), ds(d));
  };
  // a long table: tables end to end along (ux, uz) from (x0, z0) over len metres, a row of benches down each side
  const longRow = (x0, z0, ux, uz, len, d) => {
    const yaw = normH(Math.atan2(-uz, ux) * 180 / Math.PI), n = Math.floor((len + 0.3) / 2.45);
    let put = 0;
    for (let i = 0; i < n; i++) {
      const x = x0 + ux * (1.225 + 2.45 * i), z = z0 + uz * (1.225 + 2.45 * i);
      if (!place.put('piece_table', x, 0.125, z, yaw, ds(i < 2 ? d : 2))) continue;
      put++;
      for (const sg of [-1, 1]) place.put('piece_bench01', x - uz * sg * 0.95, 0.125, z + ux * sg * 0.95, yaw + (sg > 0 ? 0 : 180), ds(i < 2 ? d : 2));
    }
    return put;
  };
  // how the hall sits (by line and the culture's roof, the culture data in styles.js): long tables down the arms of a
  // cross (the corpus long halls' feast tables); in a round hall under a cone, rings of benches round the fire; under a
  // drum, long tables like spokes between the fire and the gallery; under a flat roof, rugs round the fire and tables
  // along the walls
  const seating = line === 'cross' ? 'rows' : F.style === 'posts' ? 'ring' : F.style === 'flat' ? 'rugs' : 'spokes';
  let nRows = 0;
  if (seating === 'rows') {
    if (k === 2) for (const sx of [-1, 1]) tryTable(sx * 5, 0, 90, 1);
    else {
      // (at s5 the rows start in the crossing's corners, inside the stairs)
      const v = k === 5 ? 3.6 : F.D - 2.4, s0 = k === 5 ? 4 : F.D + 0.5, endX = F.sideX != null ? F.sideX - 0.6 : F.Wx - 1;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        nRows += longRow(sx * v, sz * s0, 0, sz, (sz > 0 ? F.Wz - 4.5 : F.Wz - 2.5) - s0, 1) ? 1 : 0;
        nRows += longRow(sx * s0, sz * v, sx, 0, endX - s0, 2) ? 1 : 0;
      }
    }
  } else if (seating === 'spokes') {
    const r0 = 4.0, r1 = F.gallery ? F.rIn - 0.6 : F.ap - 0.8;
    // up to five spokes, tried every 22.5 degrees clear of the high seat's, the door's and the stair's sides
    // (a turned piece takes its whole box: spokes off the square stop a metre shorter)
    for (const a of [45, 135, 225, 315, 90, ...(F.St ? [] : [270]), 67.5, 112.5, 247.5, 292.5, 22.5, 337.5, 157.5, 202.5]) {
      if (nRows >= 5) break;
      const ux = Math.sin(rad(a)), uz = Math.cos(rad(a));
      nRows += longRow(ux * r0, uz * r0, ux, uz, r1 - r0 - (a % 90 && !F.gallery ? 1 : 0), nRows < 3 ? 1 : 2) ? 1 : 0;
    }
  } else {
    // a ring of log benches round the fire (cone halls), or rugs (flat roof halls), and a few tables at the walls
    const rr = seating === 'ring' ? 5.4 : 3.6, n = seating === 'ring' ? 8 : 6;
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) * 360 / n, x = Math.sin(rad(a)) * rr, z = Math.cos(rad(a)) * rr;
      if (seating === 'ring') place.put('piece_logbench01', x, 0.125, z, a + 180, ds(i % 2 ? 2 : 1));
      else place.put(i % 2 ? 'rug_deer' : 'jute_carpet', x, 0.14, z, a, ds(i % 2 ? 2 : 1), { onFurn: true, inKeep: true });
    }
  }
  if (line !== 'cross') {
    const rr = F.gallery ? F.rIn + 1.8 : Math.max(F.ap - 2.8, 4.8);
    const n = Math.max(3, Math.floor(2 * Math.PI * rr / (seating === 'spokes' ? 8 : 5)));
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) * 360 / n, x = Math.sin(rad(a)) * rr, z = Math.cos(rad(a)) * rr;
      if ((F.sideX != null && x > F.sideX - 1.6) || (F.zc != null && z < F.zc + 1.6)) continue;
      tryTable(x, z, a, i % 2 ? 2 : 1);
    }
  }
  if (nRows) b.notes.push(`${nRows} long tables with benches${seating === 'spokes' ? ' like spokes round the fire' : ' down the arms'}.`);
  if (seating === 'ring') b.notes.push('A ring of log benches round the fire.');
  if (seating === 'rugs') b.notes.push('Rugs and carpets round the fire.');
  // lights on the gallery and the walkway: standing torches by the rail (d2)
  if (F.gallery || (F.G && F.G.size)) {
    const yG = F.SHt + 0.125;
    const spots = line === 'cross' ? [...F.G.values()].filter((c, i) => i % 4 === 1).map(([x, z]) => [x, z])
      : [...Array(12).keys()].map(i => { const a = (i + 0.5) * 30; return [Math.sin(rad(a)) * (F.rIn + 0.7), Math.cos(rad(a)) * (F.rIn + 0.7)]; });
    let nl = 0;
    for (const [x, z] of spots) if (place.put('piece_groundtorch_wood', x, yG + 0.75, z, 0, ds(2))) nl++;
    if (nl) b.notes.push(`${nl} standing torches along the gallery.`);
  }
  // the walls' inner faces: a stone course is 1 m thick at the floor, planks and logs 0.3 to 0.5 m (game colliders)
  const lowT = /stone|marble/.test(C.wallStyle || '') ? 0.5 : C.wallStyle === 'log' ? 0.25 : 0.15;
  const highT = C.wallStyle === 'stone' || C.wallStyle === 'marble' ? 0.5 : C.wallStyle === 'log' ? 0.25 : 0.15;
  const edgeSpots = wallSpots(b, o, F, 0.125);
  // the trophy wall behind the high seat (D-134: the bigger mementos go to the central hearth; D-154: it shows enemies
  // slain and trophies collected): empty item stands in two or three rows, more each stage
  const nTrophy = { s3: 4, s4: 8, s5: 12 }[stage] || 0;
  const tSpots = [];
  if (line === 'cross') {
    const zw = F.Wz - (highT + 0.12);
    for (const x of [-2, 2, -3.5, 3.5, -5, 5]) if (Math.abs(x) < F.D - 0.8) tSpots.push({ x, y: 1.85, z: zw, yaw: 180 });
    for (const x of [-1.2, 1.2, -2.6, 2.6]) tSpots.push({ x, y: 3.3, z: zw, yaw: 180 });
    if (F.top >= 6) for (const x of [-5, 5, -2, 2]) if (Math.abs(x) < F.D - 0.8) tSpots.push({ x, y: (Math.abs(x) >= 3 ? F.SHt : 3.3) + 1.6, z: zw, yaw: 180 });
  } else {
    const rr = F.ap * Math.cos(Math.PI / F.N) - (highT + 0.12);
    const ys = [1.85, F.gallery ? F.SHt + 1.6 : F.top >= 4 ? 3.1 : null].filter(v => v != null);
    for (const yy of ys) for (const a of [-12, 12, -24, 24, -36, 36, 0]) {
      if (a === 0 && yy < 3) continue;
      tSpots.push({ x: Math.sin(rad(a)) * rr, y: yy, z: Math.cos(rad(a)) * rr, yaw: normH(a + 180) });
    }
  }
  let nt0 = 0;
  for (const t of tSpots) { if (nt0 >= nTrophy) break; if (place.put('itemstand', t.x, t.y, t.z, t.yaw, { ds: 1, memento: true, trophy: true }, { inKeep: true })) nt0++; }
  if (nt0) b.notes.push(`A trophy wall of ${nt0} empty item stands behind the high seat.`);
  // the village's storage until its storehouses can take it (D-154): chests along the hall's walls, more each stage
  let nChest = 0;
  for (const sp of edgeSpots) {
    if (nChest >= { s2: 3, s3: 6, s4: 6, s5: 8 }[stage]) break;
    if (place.put('piece_chest_wood', sp.x + sp.nx * (lowT + 0.42), sp.y, sp.z + sp.nz * (lowT + 0.42), sp.yawIn, { ds: nChest < 2 ? 1 : nChest < 4 ? 2 : 3, chest: true })) nChest++;
  }
  // the side rooms: the closet full of chests, the kitchen with its prep table, butcher's table, fermenter and chests
  const inHall = line === 'cross' ? () => true : (x, z) => polyInside(F.N, F.ap)(x, z, 0.7);
  for (const room of F.rooms || []) {
    const spots = roomSpots(room, inHall);
    const items = room.use === 'storage' ? ['piece_chest', 'piece_chest', 'piece_chest_wood', 'piece_chest_wood', 'piece_chest_barrel', 'piece_chest_wood', 'piece_chest', 'piece_chest_barrel']
      : ['piece_preptable', 'cauldron_ext3_butchertable', 'fermenter', 'piece_chest_wood', 'piece_chest_barrel', 'piece_chest_wood'];
    let i = 0;
    for (const sp of spots) {
      if (i >= items.length) break;
      if (place.put(items[i], sp.x, 0.125, sp.z, sp.yaw, { ds: i < 3 ? 1 : 2, chest: /chest/.test(items[i]) })) i++;
    }
  }
  // mementos (D-134): more empty item stands along the walls
  const nStands = { s2: 2, s3: 2, s4: 2, s5: 4 }[stage];
  let st = 0;
  for (const sp of edgeSpots.slice().reverse()) {
    if (st >= nStands) break;
    if (place.put('itemstand', sp.x + sp.nx * (highT + 0.12), sp.y + 1.85, sp.z + sp.nz * (highT + 0.12), sp.yawIn, { ds: 1, memento: true }, { inKeep: true })) st++;
  }
  // light: hanging braziers as chandeliers from the tie beams (cross) or the roof (round), from s3, never over a fire's
  // smoke; wall torches (d2); banners in the big halls (d3)
  if (k >= 3) {
    let hangs = F.hangs || [];
    if (line !== 'cross') {
      let rc = F.gallery ? F.rIn - 1.2 : F.ap * 0.5;
      if (F.drum && rc < F.apD + 0.8) rc = F.gallery && F.rIn < F.apD + 1 ? F.apD - 1.4 : F.apD + 0.8;
      hangs = [45, 135, 225, 315].map(a => { const x = Math.sin(rad(a)) * rc, z = Math.cos(rad(a)) * rc; return { x, z, y: F.roofAt(rc) - 0.5 - 1.97 }; });
    }
    let nc = 0;
    for (const hg of hangs) {
      if (fires.some(f => Math.hypot(f.x - hg.x, f.z - hg.z) < 2.5) || hg.y < 2.3) continue;
      if (place.put('piece_brazierceiling01', hg.x, hg.y, hg.z, 0, ds(1), { inKeep: true })) nc++;
    }
    if (nc) b.notes.push(`${nc} hanging braziers as chandeliers.`);
  }
  let nt = 0;
  for (const [i, sp] of edgeSpots.entries()) {
    if (nt >= 4 + 2 * k) break;
    if (i % 3 !== 1) continue;
    if (place.put('piece_walltorch', sp.x + sp.nx * (highT + 0.17), sp.y + 1.6, sp.z + sp.nz * (highT + 0.17), sp.yawIn, ds(2), { inKeep: true })) nt++;
  }
  if (k >= 4) for (const sp of edgeSpots.filter((s, i) => i % 5 === 2).slice(0, 6)) place.put('piece_banner01', sp.x + sp.nx * (highT + 0.12), sp.y + (F.top >= 6 ? 5.2 : 2.9), sp.z + sp.nz * (highT + 0.12), sp.yawIn, ds(3), { inKeep: true });
  // a cauldron by the main fire's side and a fermenter in the halls without a kitchen yet
  if (k === 3) {
    const sp = edgeSpots[Math.floor(edgeSpots.length / 3)];
    if (sp) place.put('piece_cauldron', sp.x + sp.nx * (lowT + 0.8), sp.y, sp.z + sp.nz * (lowT + 0.8), sp.yawIn, ds(2));
    const sp2 = edgeSpots[Math.floor(edgeSpots.length / 2)];
    if (sp2) place.put('fermenter', sp2.x + sp2.nx * (lowT + 0.8), sp2.y, sp2.z + sp2.nz * (lowT + 0.8), sp2.yawIn, ds(3));
  }
  b.leader = leader;
  b.spouse = spouse;
  void T;
}

// ---------------------------------------------------------------- the design

// The height a hub may reach: the culture's tallest other building (styles.js HUB.capH) and HUB.capStoreys storeys.
function capFor(cultureKey) {
  const H = SH.HUB || {}, c = (H.capH || {})[cultureKey];
  return c == null ? Infinity : c + (H.capStoreys != null ? H.capStoreys : 2) * (H.storeyH || 3);
}
const topOf = pieces => pieces.reduce((m, p) => { const pi = PH.piece(p.name); return pi.structural ? Math.max(m, p.y + pi.size[1] / 2) : m; }, 0);
// The steps a hub takes down when its main roof would stand over the cap or its crown more than CROWN_OVER over that:
// 0 as designed; 1 with low (26 degree) roofs; 2 without the lantern tower, drum or raised crown; 3 with a wide open
// crown on a round hall; 4 one storey without a gallery.
// CROWN_OVER: how far a crown, lantern or finial may rise over the cap (the lead's call, 2026-11-11: up to one storey).
const CROWN_OVER = 3;
const TIERS = 5;

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
  const has = featureDraw(lineage, cultureKey);
  // walls by the biome rule (D-125, D-012): wood at s1 to s3 in the Meadows and the Black Forest, a stone course under
  // the walls from s4 (the hub is the village's advanced building, D-012); stone in the later biomes
  const early = biome === 'Meadows' || biome === 'Black Forest';
  let wallStyle;
  if (early) wallStyle = k >= +String((SH.HUB || {}).stoneFrom || 's4').slice(1) ? 'stone-base' : ((C.logWalls || (line !== 'cross' && roundStyle(C) === 'posts' && K.wallLog)) && biome !== 'Meadows' ? 'log' : 'plank');
  else wallStyle = C.stoneWalls ? 'stone' : k >= 4 ? 'stone-base' : (C.logWalls ? 'log' : 'plank');
  // the Meadows kit has no stone pieces: the stone course takes the Black Forest's (the next biome, lib/pieces.js
  // buildReach)
  const Kw = wallStyle === 'stone-base' && !K.stoneWall ? { ...K, stoneWall: 'stone_wall_2x1', stoneBlock: 'stone_wall_1x1' } : K;
  C.wallStyle = wallStyle;
  C.baseTop = 0.6;
  const info = { type: 'hub', biome, cultureKey, stage, decor, seed, line, family: k === 1 ? 'camp' : line === 'cross' ? 'cross' : 'round', walls: k === 1 ? 'none' : wallStyle };
  const ext = exteriorOf(has, stage, line, C);
  let b, F = {}, tier = 0;
  const cap = capFor(cultureKey);
  if (k === 1) {
    b = new T.Build(); b.markers = [];
    campDesign(b, K, T, { R, cultureKey, decor, place: placer(b, T), biome });
  } else {
    // the hall, built again a step plainer while it stands over the height the village allows
    // (req.minTier: start further down, for the lab)
    for (tier = Math.max(0, Math.min(TIERS - 1, +req.minTier || 0)); tier < TIERS; tier++) {
      b = new T.Build(); b.markers = [];
      F = line === 'cross' ? crossHall(b, Kw, C, T, { stage, tier, ext, wallStyle, has })
        : roundHall(b, Kw, C, T, { stage, variant: line, tier, ext, wallStyle, has, cultureKey });
      if (topOf(b.pieces.filter(p => !p.crown)) <= cap + 0.01 && topOf(b.pieces) <= cap + CROWN_OVER + 0.01) break;
    }
    if (tier >= TIERS) tier = TIERS - 1;
    if (tier) b.notes.push(`Built ${tier} step${tier > 1 ? 's' : ''} plainer to stay within ${cap.toFixed(1)} m (the culture's tallest other building and ${(SH.HUB || {}).capStoreys} storeys).`);
    info.plan = line; info.roof = line === 'cross' ? 'gable' : F.style === 'flat' ? 'flat' : F.drum ? 'drum' : 'conical'; info.tier = tier;
    if (line !== 'cross') b.notes.push(`${line === 'octagon' ? 'Octagonal' : line === 'part' ? 'Part round' : 'Round'} hall of ${F.N} sides, ${(2 * F.ap).toFixed(1)} m across round the fire.`);
    const place = placer(b, T);
    // the notice board in the hearth area (D-140): freestanding outside the main door, and from s4 signs on a wall by
    // the door inside as well
    const d0 = F.door;
    // (beside a covered entrance, before a porch)
    const nbz = d0.z - (F.porch ? 5.6 : k >= 4 ? 2.5 : 3);
    noticeBoard(b, K, d0.x + (k >= 4 && !F.porch ? 4.6 : 3.6), nbz, 0);
    if (k >= 4) noticeWall(b, { x: d0.x - 3, z: d0.z + 0.2, yaw: 0, nx: 0, nz: 1 }, 0.125);
    b.markers.push({ kind: 'path', x: d0.x, y: 0, z: d0.z - (F.porch ? 5 : 2), yaw: 180 });
    furnish(b, Kw, C, T, { stage, line, place, R, has, skipDecor: req.skipDecor, cultureKey, biome }, F);
    // outside: a wood stack and a stone pile by the hall (Amenities.cs puts the same by the hearth)
    if (!req.skipDecor) {
      const ox = line === 'cross' ? F.Wx + 2 : F.ap + 1.8;
      place.put('wood_stack', ox, 0.57, line === 'cross' ? -F.D - 3 : -3, 90, { ds: 2 });
      place.put('stone_pile', ox, 0, line === 'cross' ? F.D + 3 : 3, 90, { ds: 3 });
    }
  }
  // the decor stage asked for (D-071): pieces tagged ds 2 or 3 go in at that stage
  const kd = { d1: 1, d2: 2, d3: 3 }[decor];
  if (!req.skipDecor) b.pieces = b.pieces.filter(p => p.ds == null || p.ds <= kd);
  else b.pieces = b.pieces.filter(p => !p.decor || p.hearth || p.notice || p.highSeat || p.spouseSeat);
  // pieces that stand on their pivot in the game go down to their foot (as lib/generate.js finish)
  for (const p of b.pieces) { const pi = PH.piece(p.name); if (pi.onPivot && !p.decor && !p.footed) { p.y = +(p.y - pi.size[1] / 2).toFixed(3); p.footed = true; } }
  const L = b.leader || { x: 0, y: 0, z: 3, yaw: 180 };
  const mk = (m, extra) => ({ kind: 'seat', x: +m.x.toFixed(3), y: +m.y.toFixed(3), z: +m.z.toFixed(3), yaw: Math.round(m.yaw || 0), ...extra });
  const markers = [...b.markers, mk(L, { leader: true })];
  if (b.spouse && b.pieces.some(p => p.spouseSeat)) markers.push(mk(b.spouse, { spouse: true }));
  // the drawn features this line builds (the rest of GRAND has no form in it yet)
  const USED = k === 5 ? ['fires3', 'dais'] : ['dais'];
  // (a hub built plainer to keep its height leaves out its tiers)
  info.features = k === 1 ? [] : [...new Set([...USED.filter(f => has(f, stage)), ...Object.keys(ext)])].filter(f => !(f === 'tiers3' && tier >= 2));
  info.top = +topOf(b.pieces).toFixed(1);
  info.mainTop = +topOf(b.pieces.filter(p => !p.crown)).toFixed(1);
  info.crownOver = CROWN_OVER;
  info.cap = isFinite(cap) ? +cap.toFixed(1) : null;
  const name = `hub_${biome.replace(' ', '')}_${cultureKey}_${line}_${stage}${decor}_${seed}`;
  return {
    ground: 0,
    meta: { Name: name, Creator: 'Villheim generator', Category: 'Villheim generated',
      Description: `Village hub (hearth), ${biome}, ${SH.CULTURES[cultureKey].label}, ${line} line, ${stage}${decor}, seed ${seed}` },
    pieces: b.pieces, rooms: b.rooms, notes: [...new Set(b.notes)], request: info, slots: [], markers,
  };
}

// The blueprint with the hub's markers: '#VillheimPaths' (path;x;y;z;yaw, where roads join, as the board writes them,
// src/Villheim.Logic/Village/DesignBoard.cs) and '#VillheimLeader' (seat;x;y;z;yaw, the leader's place, D-141; and
// spouse;x;y;z;yaw, the seat beside the high seat, D-154).
function write(d) {
  const text = BPH().write(d);
  const f = v => (Math.abs(v) < 1e-6 ? 0 : +(+v).toFixed(4)).toString();
  const paths = (d.markers || []).filter(m => m.kind === 'path').map(m => ['path', f(m.x), f(m.y), f(m.z), f(m.yaw)].join(';'));
  const lead = (d.markers || []).filter(m => m.leader || m.spouse).map(m => [m.leader ? 'seat' : 'spouse', f(m.x), f(m.y), f(m.z), f(m.yaw)].join(';'));
  const extra = [];
  if (paths.length) extra.push('#VillheimPaths', ...paths);
  if (lead.length) extra.push('#VillheimLeader', ...lead);
  return extra.length ? text.replace('#Pieces\n', extra.join('\n') + '\n#Pieces\n') : text;
}

const apiH = { generate, write, lineFor, featureDraw, capFor, GRAND, STAGES, LINES, CROWN_OVER };
if (NODE_H) module.exports = apiH; else window.VHHub = apiH;
