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
// Height (D-156, Tyler 2026-11-11: "Roofs can be taller depending on the design, and that's okay. It should not be cut
// off"): roofs and crowns as tall as the design calls for, their proportions drawn per village from the corpus spread
// (ROOF_Q); the storey rule (styles.js HUB.capStoreys) counts storeys only.

const NODE_H = typeof module !== 'undefined';
const SH = NODE_H ? require('./styles.js') : window.VHStyles;
const PH = NODE_H ? require('./pieces.js') : window.VHPieces;
const CkH = () => (NODE_H ? require('./checks.js') : window.VHChecks);
const DecH = () => (NODE_H ? require('./decorate.js') : window.VHDecorate);
const BPH = () => (NODE_H ? require('./blueprint.js') : window.VHBlueprint);
const SHH = () => (NODE_H ? require('./shapes.js') : window.VHShapes);
const WHH = () => (NODE_H ? require('./wallhang.js') : window.VHWallhang);
const PSH = () => (NODE_H ? require('./persona.js') : window.VHPersona);
const KBH = () => (NODE_H ? require('./kitbash.js') : window.VHKitbash);
// distance in plan from (x, z) to a piece's turned solids (o.sol, from checks.js gameBox), else to its box
function distSol(o, x, z) {
  if (!o.sol || !o.sol.length) return Math.hypot(Math.max(o.x0 - x, 0, x - o.x1), Math.max(o.z0 - z, 0, z - o.z1));
  let best = Infinity;
  for (const S of o.sol) {
    const dx = x - S.c[0], dz = z - S.c[2];
    let q = 0;
    for (let k = 0; k < 3; k++) { const A = S.a[k]; if (Math.abs(A[1]) > 0.5) continue; const t = dx * A[0] + dz * A[2]; const e = Math.max(Math.abs(t) - S.h[k], 0); q += e * e; }
    best = Math.min(best, Math.sqrt(q));
  }
  return best;
}

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
function exteriorOf(has, stage, line, C, porch) {
  const k = +stage[1];
  if (k < 4) return {};
  // (the porch as the village drew it: a column porch only with 'columns', and then always)
  const list = (EXT[line === 'cross' ? 'cross' : 'round'] || []).filter(f => (f !== 'dragons' || C.dragons) && (f !== 'porch6' || porch === 'columns' || porch == null));
  const pick = (st, min, base) => {
    const out = { ...base };
    for (const f of list) if (has(f, st)) out[f] = true;
    for (const f of list) { if (Object.keys(out).length >= min) break; out[f] = true; }
    if (out.highWindows) out.tiers3 = true;
    return out;
  };
  const s4 = pick('s4', 1, porch === 'columns' ? { porch6: true } : {});
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
// Walking the hall as a person does (D-148, D-152): the same reading as lib/reach.js. A 0.25 m
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
    if (o.pass) return null;
    // (the walk is judged by whole boxes, as lab/test_hub.js reach does; the placer judges turned pieces by their
    // solids)
    return o;
  };
  // (by the whole box, as lib/reach.js reads it)
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
    // the last piece put after test(p) and took(p, true) comes out again
    untake(p) { const o = solidOf(p); if (!o || !L.length) return; mark(o, -1); seen--; },
  };
}

// Rooms, main pieces and doorways' entry zones a person cannot reach (lib/reach.js, the module lab/test_hub.js and
// lab/check_interiors.js read designs with), for the hub's last pass.
const reachH = d => (NODE_H ? require('./reach.js') : window.VHReach)(d);

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
  // boxes that overlap meet only if their turned solids do (a table turned 45 degrees is judged by its own footprint,
  // its whole box is larger)
  const SHP = SHH();
  const hits = (a, c, e = 0.03) => over(a, c, e) && (!a.sol || !a.sol.length || !SHP ? true
    : c.sol && c.sol.length ? a.sol.some(A => c.sol.some(B => SHP.hit(A, B, -e))) : SHP.hitsBox(a.sol, { x0: c.x0 + e, x1: c.x1 - e, y0: c.y0 + e, y1: c.y1 - e, z0: c.z0 + e, z1: c.z1 - e }));
  return {
    keep(x0, x1, z0, z1, y0 = -1, y1 = 100, always = false) { keep.push({ x0, x1, z0, z1, y0, y1, always }); },
    // after pieces came out elsewhere: read the design again
    reset() { walk = null; hard.length = 0; furn.length = 0; seen = 0; },
    // the keep-clear boxes as zones for the shared furnishing (lib/kitbash.js)
    zones: () => keep.map(k => ({ x0: k.x0, x1: k.x1, z0: k.z0, z1: k.z1, y0: k.y0 < 0 ? -1 : k.y0, y1: k.y1 })),
    // a set of pieces fitted elsewhere (lib/kitbash.js) goes in whole when every room, climb and main piece stays reached
    // with all of it in, else none of it (D-148)
    admit(list) {
      refresh();
      if (!walk && b.rooms.length) walk = walker(b);
      const n0 = b.pieces.length;
      for (const p of list) {
        if (walk && !walk.test(p)) { while (b.pieces.length > n0) walk.untake(b.pieces.pop()); seen = Math.min(seen, n0); return false; }
        b.pieces.push(p);
        if (walk) walk.took(p, true);
      }
      return true;
    },
    put(name, x, y, z, yaw, extra = {}, o = {}) {
      refresh();
      // a piece hung on a wall (lib/wallhang.js): yaw is the wall's normal into the room, x, z a point near the wall;
      // it goes up against what shows of the wall at its own height, its back to the wall (a wall torch put up at the
      // yaw alone had its arm along the wall, and a stand put at the stone plinth's face hung 35 cm out from the wood
      // wall over it, showcase 01)
      if (WHH() && WHH().isHung(name) && !o.asIs) {
        const a = normH(yaw) * Math.PI / 180, nx = Math.sin(a), nz = Math.cos(a);
        const hs = [];
        for (let d = 0.1; d <= 0.301; d += 0.1) hs.push(y + d, y - d);
        const r = WHH().hang(name, { x: x - nx * 0.3, z: z - nz * 0.3, nx, nz, y }, WHH().backingOf(b.pieces), { heights: hs.filter(v => v > 0.9 + (o.floor || 0)), pieces: b.pieces });
        if (!r) return false;
        x = r.x; y = r.y; z = r.z; yaw = r.yaw;
        extra = r.wclip ? { ...extra, wclip: r.wclip } : extra;
        o = { ...o, hung: true };
      }
      // a standing torch on what is under its foot (lib/wallhang.js settle): it was put 0.75 m over a level that was the
      // floor's pivot in one place and 0.125 m over it in another, and hovered 10 to 64 cm (showcase 01)
      // a hanging brazier from the beam, floor or roof over it (lib/wallhang.js hangFrom), or not at all
      if (WHH() && name === 'piece_brazierceiling01' && !o.asIs) { const yy = WHH().hangFrom({ name, x, y, z, yaw: normH(yaw) }, b.pieces); if (yy == null) return false; y = yy; }
      if (WHH() && /^piece_groundtorch/.test(name) && !o.asIs) { const yy = WHH().settle({ name, x, y, z, yaw: normH(yaw) }, b.pieces); if (yy == null) return false; y = yy; }
      const p = { name, x, y, z, yaw: normH(yaw), q: T.quat(normH(yaw)) };
      const bx = Ck.gameBox(p);
      if (!o.free) {
        // (a turned table, and what stands or hangs at a wall (o.solid), is judged by its own solids against walls and
        // furniture; everything else by its box)
        const H = name === 'piece_table' || o.solid ? hits : over;
        if (!o.hung && hard.some(h => H(bx, h))) return false;
        if (!o.onFurn && furn.some(h => H(bx, h, 0.01))) return false;
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
// its heading in the game (the mod reads it). Builders tile signs edge to edge, side by side or in a column stepping
// half a meter (docs/ROOM_STUDY.md section 7: neighbors 0.03 m apart, 0.48 m apart in height); the board's posts leave
// 1.96 m, too little for two 1 m signs side by side, so each face carries a column of two, flat on the planks
// (lib/wallhang.js). Three 1 m signs 0.55 m apart on a 2 m board overlapped each other by 45 % (showcase 01 and 02,
// Tyler: "stacked and layered and smushed randomly together").
const NOTICE_HEADS = ['Village notices', 'Work wanted', 'Trades'];
// sign places on a face: along it, up from the board's middle; and the headings of each face of the board
const NOTICE_WALL = [[-0.51, -0.24], [0.51, -0.24], [0, 0.27]];
// (the board's two rows sit 2 cm low on its half wall: the darkwood cap's mesh reaches 2.5 cm under its pivot's box,
// and the cap rests on the posts' tops at 2.0 m)
const NOTICE_BOARD = [[0, 0.235], [0, -0.275]];
// the half wall's back face carries its rail at the middle: a sign lies flat there only over the rail's lower edge
// (0.35 m up the board) or above it (0.7 m up and higher), so that face's column sits lower and higher than the front's
const NOTICE_BOARD_BACK = [[0, 0.36], [0, -0.15]];
function noticeBoard(b, K, x, z, yaw) {
  const ux = Math.cos(rad(yaw)), uz = -Math.sin(rad(yaw)), nx = Math.sin(rad(yaw)), nz = Math.cos(rad(yaw));
  for (const s of [-1.1, 1.1]) b.put(K.pole, x + ux * s, 1, z + uz * s, yaw, { notice: true });
  b.put(K.wallHalf || 'wood_wall_half', x, 1.5, z, yaw, { notice: true });
  // (the cap rests on the half wall's top at 2.0 m: at 2.1 its lower 10 cm sat in the half wall and in the top sign's
  // place, 3 cm into the sign once the biome's thicker darkwood beam took its place, showcase 02)
  b.put(K.beam, x, 2.2, z, yaw, { notice: true });
  noticeSigns(b, x, 1.5, z, ux, uz, nx, nz, NOTICE_BOARD, [0, 1]);
  noticeSigns(b, x, 1.5, z, ux, uz, -nx, -nz, NOTICE_BOARD_BACK, [2, 0]);
}
// Notices on one face of a board or a wall: (x, y, z) the board's middle, n out of that face, the places, the headings.
function noticeSigns(b, x, y, z, ux, uz, nx, nz, layout, heads) {
  const WH = WHH(), B = WH ? WH.backingOf(b.pieces) : null;
  layout.forEach(([s, dy], i) => {
    // (the 2x2 and half walls carry a rail on one face: a sign that meets it goes over it instead, or stays off)
    // (and clear of the board's own beams and posts: a top sign went 3 cm into the beam over it, showcase 02)
    const clear = r => { const sb = WH.modelWorldBox({ name: 'sign', x: r.x, y: r.y, z: r.z, yaw: normH(r.yaw) }, 0); if (!sb) return true;
      return !b.pieces.some(q => q.notice && /beam|pole/.test(q.name) && (() => { const o = WH.modelWorldBox(q, 0); return o && o.x0 < sb.x1 - 0.015 && o.x1 > sb.x0 + 0.015 && o.y0 < sb.y1 - 0.01 && o.y1 > sb.y0 + 0.01 && o.z0 < sb.z1 - 0.015 && o.z1 > sb.z0 + 0.015; })()); };
    let r = null;
    const hs = [y + 0.23, y + dy + 0.1, y + dy - 0.1];
    if (WH) for (const h of [hs, ...hs.map(v => [v]), [y + dy - 0.2]]) { const t = WH.hang('sign', { x: x + ux * s, z: z + uz * s, nx, nz, y: y + dy }, B, { cover: 1, pieces: b.pieces, gapOk: 0, heights: h }); if (t && clear(t)) { r = t; break; } }
    if (r) b.put('sign', r.x, r.y, r.z, r.yaw, { decor: true, notice: true, info: NOTICE_HEADS[heads[i]], ...(r.wclip ? { wclip: r.wclip } : {}) });
  });
}

// Signs on a wall by the door (the notices on an open wall, D-140). wall: { x, z, yaw, nx, nz } of a wall bay, n into
// the room; laid out as on the board.
function noticeWall(b, w, y0) {
  const ux = Math.cos(rad(w.yaw)), uz = -Math.sin(rad(w.yaw));
  noticeSigns(b, w.x, y0 + 1.75, w.z, ux, uz, w.nx, w.nz, NOTICE_WALL, [0, 1, 2]);
}

function campDesign(b, K, T, o) {
  const { R, cultureKey, decor, place } = o;
  b.put('fire_pit', 0, 0, 0, 0, { decor: true, hearth: true });
  b.put('piece_cookingstation', 0, 0.2, 0, 0, { decor: true });
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
  // o.inner { M, a }: the opening is an M-gon of apothem a with 2 m sides (a gallery's): the floor keeps off it by
  // two bands of 1 m pieces turned with its sides, so its edge is straight under the rail
  const In = o.inner, nIn = In ? [...Array(In.M).keys()].map(i => [Math.sin(rad(i * 360 / In.M)), Math.cos(rad(i * 360 / In.M))]) : null;
  const beyond = (x, z) => (In ? Math.max(...nIn.map(([a, c]) => x * a + z * c)) - In.a : Math.hypot(x, z) - rIn);
  const out = (x, z, h) => [[-h, -h], [-h, h], [h, -h], [h, h]].every(([dx, dz]) => beyond(x + dx, z + dz) >= (In ? (h > 0.75 ? 2.05 : 0) : 0)) && (!In || h > 0.75 || beyond(x, z) >= 1.3);
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
  if (In) for (const [d0, i0] of [[0.5, 0], [1.5, 1]]) for (let i = 0; i < In.M; i++) {
    const a = i * 360 / In.M, nx = Math.sin(rad(a)), nz = Math.cos(rad(a)), tx = Math.cos(rad(a)), tz = -Math.sin(rad(a));
    const len = 2 * (In.a + d0) * Math.tan(Math.PI / In.M), n = Math.ceil(len - 0.05);
    for (let q = 0; q < n; q++) {
      const t = -(n - 1) / 2 + q, x = nx * (In.a + d0) + tx * t, z = nz * (In.a + d0) + tz * t;
      if (o.skip && o.skip(2 * Math.round(x / 2), 2 * Math.round(z / 2))) continue;
      if (!ins(x, z, 0.3) || ones.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 0.2)) continue;
      b.put(K.floor1, x, y, z, a, { band: true });
    }
    void i0;
  }
  if (o.band !== false) {
    const L = 2 * ap * Math.tan(Math.PI / N);
    for (let i = 0; i < N; i++) {
      const a = i * 360 / N, nx = Math.sin(rad(a)), nz = Math.cos(rad(a)), tx = Math.cos(rad(a)), tz = -Math.sin(rad(a));
      for (let t = -L / 2 + 0.5; t < L / 2 - 0.01; t += 1) {
        const x = nx * (ap - 0.5) + tx * t, z = nz * (ap - 0.5) + tz * t;
        if (o.skip && o.skip(2 * Math.round(x / 2), 2 * Math.round(z / 2))) continue;
        if (beyond(x, z) < (In ? 1.3 : 0.71)) continue;
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
const WOOD_TOP = 13;
function ringRoofH(b, K, ap, top, rs, o = {}) {
  const out = o.eave === false ? 0 : 0.75;
  let low = top - rs[0] * out / 2;
  const rings = [];
  for (let i = 0; ; i++) {
    const rho = ap + out - 1 - 2 * i;
    if (rho < (o.crown || 1.2) || rho < (o.stop || 0)) break;
    const r = rs[Math.min(i, rs.length - 1)], roof = r === 2 ? K.roof45 : K.roof26, y = low + (r === 2 ? 1 : 0);
    if (o.dry) { rings.push({ rho, low, r }); low += r; continue; }
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
// A rail at the edge between two 2 m cells at floor height y (a gallery or walkway edge): a 1 m post at each end and a
// beam on them at 1 m, as corpus builders rail galleries (lib/generate.js railing). The wood fence it was stood 0.6 m
// over the floor and touched nothing, so the game let it fall (the Meadows hub, 2026-11-11), and Tyler keeps the wood
// fence to pastures and gardens.
function rail(b, K, x, y, z, yaw) {
  const a = yaw * Math.PI / 180, ux = Math.cos(a), uz = -Math.sin(a), post = K.pole1 || 'wood_pole', beam = K.beam || 'wood_beam';
  // a post stands on the floor: an end past the floor's edge (a polygon's corner) moves in along the rail
  const onFloor = (px, pz) => b.pieces.some(p => !p.decor && PH.piece(p.name).role === 'floor' && (() => { const c = CkH().catBox(p); return px > c.x0 - 0.05 && px < c.x1 + 0.05 && pz > c.z0 - 0.05 && pz < c.z1 + 0.05 && Math.abs(c.y1 - y) < 0.35; })());
  for (const sg of [-1, 1]) {
    const t = [1, 0.8, 0.6].find(k => onFloor(x + ux * sg * k, z + uz * sg * k));
    if (t != null) b.put(post, x + ux * sg * t, y + 0.5, z + uz * sg * t, 0);
  }
  b.put(beam, x, y + 1.0, z, yaw);
}
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

// Pieces put while fn runs are marked as the crown (a drum, lantern, raised crown or finial), to tell its height from
// the main roof's (request.mainTop; their proportion follows the corpus spread, ROOF_Q).
// Carved heads hung on gable walls (lib/wallhang.js hang): ends [{ x, z, nx, nz }] on the wall planes, n outward; one
// height for all of them under the ridge at yTop, the first that every end takes, or none (a head on a ridge's end
// past the gable sat 0.3 to 0.43 m off any wall, track F's measure). Returns the number hung.
function hangHeads(b, ends, yTop) {
  const WH = WHH();
  if (!WH) return 0;
  const B = WH.backingOf(b.pieces);
  for (const dy of [1.4, 1.0, 1.8, 2.2, 0.6, 2.6]) {
    const got = ends.map(e => WH.hang('wood_dragon1', { x: e.x, z: e.z, nx: e.nx, nz: e.nz, y: yTop - dy }, B, { pieces: b.pieces }));
    if (!got.every(Boolean)) continue;
    for (const h of got) b.put(h.name, h.x, h.y, h.z, h.yaw, { decor: true, ...(h.wclip ? { wclip: h.wclip } : {}) });
    return got.length;
  }
  return 0;
}
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

// Sides and side length per stage: roundSpec, from the village's draws round the base sizes (round 10, 15, 20, 30 m
// across; octagon sides of 4, 6, 8, 12 m). The part round takes the round's.
// the culture's roof on a round hall: posts (rings of posts, an open crown under a cone), drum (a drum of high windows
// over the fire from s4), flat (a flat roof with a raised lantern over the fire)
const roundStyle = C => (C.roof === 'flat' ? 'flat' : C.roof === 'conical' ? 'posts' : 'drum');

// A post that carries what stands high on it (the game's support rule, lib/checks.js gameSupport): the kit's pole up
// to 8 m; higher, wood and iron where the village's biomes allow iron, else core wood (the log poles, the most a wood
// frame holds: 140 at the ground against 100, a tenth lost per metre up), by the biome rule (D-125, lib/pieces.js
// decorOk)
function tallPole(K, biome, h) {
  if (h <= 8) return K.pole;
  if (PH.decorOk('woodiron_pole', biome)) return 'woodiron_pole';
  if (PH.decorOk('wood_pole_log', biome)) return 'wood_pole_log';
  return K.pole;
}

function roundHall(b, K, C, T, o) {
  const { stage, variant, ext } = o;
  const V = o.V;
  const style = roundStyle(C);
  const k = +stage[1];
  const [N, L] = roundSpec(variant, stage, V), ap = ringPoly(N, L);
  // from s4 two storeys of 3 m with a gallery round the upper walls (at s4 the village may have none, V.gallery)
  const gallery = k >= 4 && V.gallery !== 'none';
  const SHt = gallery ? 3 : style === 'posts' ? 3 : 4, storeys = gallery ? 2 : 1, top = SHt * storeys;
  const doorSide = N / 2, doorK = Math.floor(L / 4);
  const Nd = k === 5 ? 18 : 16, apD = ringPoly(Nd, 2);
  // a timber drum stays within what wood holds in the game: with no iron in the village's biomes (D-125) its low cone
  // starts no higher than WOOD_TOP (the game drops wood roofs higher than that, even on core wood posts from the
  // ground); the outer roof's steep rings give way to low ones until the drum's foot is low enough, and a hall too
  // wide for that keeps the smoke cap of the drum style in place of a drum
  const woodOnly = !PH.decorOk('woodiron_pole', C.biome), crown = 2.4;
  const drumFoot = list => { const rg = ringRoofH(null, K, ap, top, list, { stop: apD, crown, N, dry: true }).rings, last = rg[rg.length - 1]; return last ? Math.floor(last.low + last.r * Math.min(1, (last.rho + 1 - apD) / 2) - 0.2) : top; };
  const nrD = Math.max(1, Math.floor((ap + 0.75 - 1 - Math.max(crown, apD)) / 2) + 1);
  const drum = style === 'drum' && k >= 4 && !(woodOnly && drumFoot(Array(nrD).fill(1)) + 2.2 > WOOD_TOP);
  // (at s4 under a drum the gallery's inner edge is the drum's ring, so one ring of posts carries both)
  const vR0 = ringPoly(k === 5 ? 18 : 16, 2) / Math.cos(Math.PI / (k === 5 ? 18 : 16));
  const drumOnGallery = gallery && k === 4 && drum;
  // (the gallery 3.5 m deep, 4.5 m at s5, or deeper where a 2 m stair cell on the floor grid must fit between its inner
  // edge and the wall)
  let rIn = 0;
  if (gallery && drumOnGallery) rIn = vR0 + 0.1;
  else if (gallery) rIn = Math.min(ap - (k === 5 ? 4.5 : 3.5), 2 * Math.floor((ap - 2) / 2) - 1);
  // (the gallery's opening: an even-sided polygon of 2 m sides as near the gallery ring as can be; the walkway's row
  // 8 m from the fire, or 0.7 of the opening's apothem in a wide hall, out to the first cell over the gallery floor)
  const M = gallery ? 2 * Math.max(4, Math.round(Math.PI / Math.atan(1 / rIn) / 2)) : 0, aIn = gallery ? ringPoly(M, 2) : 0;
  const nM = [...Array(M).keys()].map(i => [Math.sin(rad(i * 360 / M)), Math.cos(rad(i * 360 / M))]);
  const beyondIn = (x, z) => Math.max(...nM.map(([a, c]) => x * a + z * c)) - aIn;
  const zw = aIn < 12 ? 8 : 2 * Math.round(0.7 * aIn / 2);
  // the side rooms' partition (from s4) where the village drew it: the corpus inner wall lines of round builds lie at a
  // share of the radius (SHAPE_Q.round.inner), 3 m or more off the wall
  // (the corpus places run from 0.26 to 1.01 of the radius, quantiles 10 to 90; the hall keeps 7 m round the fire)
  const oddU = v => 2 * Math.ceil((v - 1) / 2) + 1, xmLo = oddU(Math.max(7, 0.42 * ap, drum ? apD + 2 : 0));
  const xmHi = 2 * Math.floor((Math.min(ap - 3, Math.sqrt(Math.max(0, ap * ap - 6.6 * 6.6))) - 1) / 2) + 1;
  const xmP = Math.min(xmHi, Math.max(xmLo, oddU(V.part * ap)));
  // the part round's straight front at z = zc (an odd metre, about 0.4 of the way out; clear of the drum, and at s5
  // behind the walkway along the front)
  let zc = null;
  const frontBays = [];
  if (variant === 'part') {
    let c = Math.max(3, 0.4 * ap);
    if (drum) c = Math.max(c, apD + 1.2);
    if (k === 5 && gallery) c = Math.max(c, zw + 1);
    // (at s4 the front stands clear of the gallery's opening, so the rail round it stays whole)
    if (k === 4 && gallery) c = Math.max(c, ringPoly(2 * Math.max(4, Math.round(Math.PI / Math.atan(1 / rIn) / 2)), 2) + 0.7);
    zc = -(2 * Math.ceil((c - 1) / 2) + 1);
  }
  // the stair to the gallery: a flight of three along the -x wall rising toward the door side; the walkway across the
  // hall at s5 at z = -8 (in front of the fire, clear of the high seat and of the drum)
  // the stair on the side the village drew (V.stairSide), the side rooms on the other
  const sS = V.stairSide, sR = -sS;
  const cxS = sS * 2 * Math.ceil((rIn + 1) / 2);
  // (moved back toward the high seat end where the landing would run into the wall)
  let dzS = 0;
  while (gallery && dzS < 6 && !(polyInside(N, ap)(cxS, -4 + dzS, 0.95) && polyInside(N, ap)(cxS, 4 + dzS, 0.95))) dzS += 2;
  if (dzS >= 6) dzS = 0;
  const St = gallery ? { run: [[cxS, 2 + dzS], [cxS, dzS], [cxS, -2 + dzS]], stand: [cxS, 4 + dzS], land: [cxS, -4 + dzS], dir: [0, -1] } : null;
  // the walkway across the hall at s5 by the village's draw: across the front (z = -8, before the fire), along a side
  // (x = 8 on the rooms' side, clear of the stair), or none
  const wk = k === 5 && gallery ? V.walkway : 'none';
  let XW = 0;
  if (wk !== 'none') while (beyondIn(XW, zw) < 1.2 && XW < 30) XW += 2;
  const span = []; for (let t = -XW; t <= XW; t += 2) span.push(t);
  const bridge = wk === 'front' ? span.map(x => [x, -zw]) : wk === 'side' ? span.map(z => [sR * zw, z]) : [];
  const inCells = (list, x, z, m = 0) => list.some(([cx, cz]) => Math.abs(x - cx) < 1 + m && Math.abs(z - cz) < 1 + m);
  const stairCells = St ? [St.stand, ...St.run, St.land] : [];
  // the floor, the hearth's stone flags under the fire from s2 (D-131)
  polyFloor(b, K, N, ap, 0, { center: () => b.put('stone_floor_2x2', 0, -0.375, 0, 0, { hearthStone: true }) });
  // annexes from s4 (corpus: 33 of the 55 round and polygon builds have floor out past their ring, SHAPE_Q.round.lobes):
  // up to the village's draw, a room 6 m wide and 4 or 6 m deep against the wall square to an axis, with a door from
  // the hall, a gable roof under the hall's eave; on the side rooms' side where the wall is 10 m long or more (clear of
  // the kitchen's back door), and behind the hall where the high seat is not at the far end
  const annexes = [];
  if (k >= 4 && gallery && V.annex > 0) {
    const sideBay = (i, want) => { const ts = [...Array(L / 2).keys()].map(kk => ({ kk, t: -L / 2 + 1 + 2 * kk })).filter(o => Math.abs(o.t) + 3 <= L / 2 + 1e-6); return ts.sort((p, q) => want(q.t) - want(p.t))[0]; };
    const cand = [];
    if (L >= 10) { const i = sR > 0 ? N / 4 : 3 * N / 4, a = i * 360 / N, tz = -Math.sin(rad(a)); const o = sideBay(i, t => t * tz); if (o) cand.push({ i, a, ...o }); }
    if (V.seat !== 'far' && L >= 6) { const o = sideBay(0, t => -Math.abs(t)); if (o) cand.push({ i: 0, a: 0, ...o }); }
    for (const c of cand.slice(0, V.annex)) annexes.push(c);
  }
  // walls; the back door from s3 at the +x side, toward the door side of it (the kitchen's door from s4)
  const bays = [];
  for (let s = 0; s < storeys; s++) {
    const st = s > 0 && /stone/.test(o.wallStyle) ? 'plank' : o.wallStyle;
    bays.push(...polyWalls(b, K, C, T, N, L, ap, s * SHt, SHt, (i, kk) => {
      if (s === 0 && i === doorSide && kk === doorK && zc == null) return 'door';
      if (s === 0 && k >= 3 && i === (sR > 0 ? N / 4 : 3 * N / 4) && kk === (sR > 0 ? L / 2 - 1 : 0)) return 'door';
      if (s === 0 && annexes.some(an => an.i === i && an.kk === kk)) return 'door';
      if (s === storeys - 1 && i % 3 === 1 && kk === 0) return 'window';
      return 'wall';
    }, st));
  }
  let door = bays.find(bb => bb.kind === 'door' && bb.i === doorSide) || { x: 0, z: -ap };
  // outer roof (D-156: as tall as the design calls for): the village's drawn rise against the hall's width
  // (V.rise, corpus spread), the outer rings low (26 degrees) and as many inner rings steep (45) as reach it
  const nr = Math.max(1, Math.floor((ap + 0.75 - 1 - Math.max(crown, drum ? apD : 0)) / 2) + 1);
  // (the eave ring stays low, so the roof's edge stands clear of the doors)
  const steep = Math.max(0, Math.min(nr - 1, Math.round(V.rise * 2 * ap - nr)));
  let rs = [...Array(nr - steep).fill(1), ...Array(steep).fill(2)];
  // (a timber roof: low rings in place of steep ones until the drum's foot is low enough, or the roof's top stays
  // under WOOD_TOP with room for the crown's cap)
  const roofTop = list => ringRoofH(null, K, ap, top, list, { stop: drum ? apD : 0, crown, N, dry: true }).top;
  if (woodOnly && style !== 'flat') for (let st = steep; st > 0 && (drum ? drumFoot(rs) + 2.2 > WOOD_TOP : roofTop(rs) > WOOD_TOP - 1); ) { st--; rs = [...Array(nr - st).fill(1), ...Array(st).fill(2)]; }
  let outer = { rings: [], top }, peak = top;
  if (style === 'flat') {
    // a flat roof, open over the fire, and over the opening a raised lantern: walls at its corners, the middle bays
    // open for the smoke, a flat top, as tall as the village's crown draw
    polyFloor(b, K, N, ap, top, { skip: (x, z) => Math.hypot(x, z) < 3.5 });
    const lh = Math.max(2, Math.min(4, Math.round(V.crown * 3 + 2)));
    {
      // (on four posts from the floor at its corners, as over the cross hall's crossing: on the flat roof alone its
      // flat top dropped its middle in the game)
      asCrown(b, () => { for (const sx of [-3, 3]) for (const sz of [-3, 3]) T.posts(b, K, sx, sz, top, tallPole(K, C.biome, top)); lantern(b, K, C, T, top, lh, { flat: true, windows: !!ext.highWindows }); });
      peak = top + lh + 0.4;
      b.notes.push('A flat roof, open over the fire, with a raised lantern over the opening: walls at its corners, the middle bays open, a flat top.');
    }
  } else {
    outer = ringRoofH(b, K, ap, top, rs, { stop: drum ? apD : 0, crown, N });
    peak = outer.top;
  }
  const roofAt = rho => { if (style === 'flat') return top; let y = top; for (const rg of outer.rings) if (rg.rho - 1 >= rho) y = rg.low + rg.r; else if (rg.rho + 1 > rho) { y = rg.low + rg.r * (rg.rho + 1 - rho) / 2; break; } return y; };
  // the drum's walls as tall as the village's crown draw (2 to 4 m)
  let hd = Math.max(2, Math.min(4, Math.round(2 + V.crown * 4)));
  if (drum && woodOnly) hd = Math.max(2, Math.min(hd, Math.floor(WOOD_TOP - 0.2 - drumFoot(rs))));
  if (drum) asCrown(b, () => {
    const last = outer.rings[outer.rings.length - 1];
    const yd = Math.floor(last.low + last.r * Math.min(1, (last.rho + 1 - apD) / 2) - 0.2);
    const vR = apD / Math.cos(Math.PI / Nd);
    // the drum stands on posts at every second to fourth corner (corpus inner posts, below)
    const every = Nd === 18 ? 3 : variant === 'part' ? 4 : 2;
    for (let i = 0; i < Nd; i += every) { const a = (i + 0.5) * 360 / Nd; T.posts(b, K, Math.sin(rad(a)) * vR, Math.cos(rad(a)) * vR, yd, tallPole(K, C.biome, yd)); }
    for (let i = 0; i < Nd; i++) {
      const a = i * 360 / Nd, x = Math.sin(rad(a)) * apD, z = Math.cos(rad(a)) * apD;
      b.put(K.beam, x, yd + 0.1, z, a);
      T.wallSegment(b, K, C, x, yd + 0.2, z, a, hd, i % 2 === 0 ? 'window' : 'wall', 'plank');
      b.put(K.beam, x, yd + hd + 0.2, z, a);
    }
    const inner = ringRoofH(b, K, apD, yd + hd + 0.2, [1], { eave: false });
    peak = inner.top;
    b.notes.push('A drum of high windows on posts over the fire, the outer roof running up to it and a low cone over it.');
  });
  // post rings: the gallery's (from s4) carrying its inner edge; the cone's rings (posts style) at s2, s3 and s5
  const rings = [];
  if (gallery && !drumOnGallery) rings.push({ r: rIn - 0.1, h: style === 'flat' ? top : SHt });
  if (style === 'posts' && k <= 3) rings.push({ r: ap - 2.2 });
  const postsOf = [];
  const xmD = xmP, roomDoors = V.rooms === 'two' ? [[sR * xmD, -4], [sR * xmD, 4]] : [[sR * xmD, -4]];
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
      // (clear of the side rooms' doors)
      if (k >= 4 && roomDoors.some(([dx, dz]) => Math.hypot(x - dx, z - dz) < 2.2)) continue;
      T.posts(b, K, x, z, h, tallPole(K, C.biome, h));
      postsOf.push({ x, z, h });
    }
  }
  // the gallery round the upper walls (from s4): floor between the gallery ring and the wall, open over the stair; a
  // rail on its inner edge; the stair up from the floor; at s5 the walkway across the hall on posts, railed both sides
  if (gallery) {
    // the opening over the hall: an even-sided polygon of 2 m sides as near the gallery ring as can be, so one 2 m rail
    // piece fits each side and the rail runs round it joined at the corners
    polyFloor(b, K, N, ap, SHt, { rIn, inner: { M, a: aIn }, m: 0.02, skip: (x, z) => inCells(St.run, x, z) || inCells(bridge, x, z) });
    putStair(b, K, St, 0);
    const strip = wk === 'front' ? { x0: -XW - 1.2, x1: XW + 1.2, z0: -zw - 1.2, z1: -zw + 1.2 } : wk === 'side' ? { x0: sR * zw - 1.2, x1: sR * zw + 1.2, z0: -XW - 1.2, z1: XW + 1.2 } : null;
    for (let i = 0; i < M; i++) {
      const a = i * 360 / M, x = Math.sin(rad(a)) * aIn, z = Math.cos(rad(a)) * aIn, tx = Math.cos(rad(a)), tz = -Math.sin(rad(a));
      // (none where the walkway crosses the opening)
      if (strip && [-1, 0, 1].some(t => { const px = x + tx * t, pz = z + tz * t; return px > strip.x0 && px < strip.x1 && pz > strip.z0 && pz < strip.z1; })) continue;
      if (inCells(St.run, x, z, 0.4)) continue;
      rail(b, K, x, SHt, z, a);
    }
    // the stairwell: rails along both sides of the flight and across its low end
    for (const [x, z] of St.run) for (const sx of [-1, 1]) rail(b, K, x + sx, SHt, z, 90);
    rail(b, K, cxS, SHt, St.run[0][1] + 1, 0);
    if (bridge.length) {
      for (const [x, z] of bridge) if (polyInside(N, ap)(x, z, 1)) b.put(K.floor, x, SHt, z);
      // rails along both sides where the walkway runs over the open hall (the front side of a part round's walkway is its wall)
      if (wk === 'front') for (const [x] of bridge) { if (beyondIn(x, -zw + 1.5) < 0) rail(b, K, x, SHt, -zw + 1, 0); if (zc == null && beyondIn(x, -zw - 1.5) < 0) rail(b, K, x, SHt, -zw - 1, 0); }
      else for (const [, z] of bridge) { if (beyondIn(sR * (zw - 1.5), z) < 0) rail(b, K, sR * (zw - 1), SHt, z, 90); if (beyondIn(sR * (zw + 1.5), z) < 0) rail(b, K, sR * (zw + 1), SHt, z, 90); }
      // (the walkway spans from gallery to gallery)
      b.notes.push('A walkway across the hall high up in front of the fire, between the two sides of the gallery.');
    }
    b.notes.push('A gallery round the upper walls at 3 m, a stair up to it from the floor.');
  }
  // the crown: a smoke cap on four short posts (drum style, s2 and s3); over the posts style crown from s4 a raised
  // roof on a ring of posts, open at the sides for the smoke, with a finial post on top; its height the village's crown
  // draw against the main roof (corpus spread, V.crown), none when that is under a metre and a half
  const crownY = outer.top;
  const crownH = V.crown * (outer.top - top);
  let capPieces = [];
  // (a timber roof whose top is over WOOD_TOP less a metre keeps its crown open for the smoke: the cap would fall)
  if (style !== 'flat' && !drum && (style === 'drum' || (k >= 4 && crownH >= 1.5)) && !(woodOnly && crownY > WOOD_TOP - 1)) {
    const big = style === 'posts', rp = big ? 2.6 : 1.4, np = big ? 8 : 4;
    const rr = big && rs[rs.length - 1] === 2 ? 2 : 1, rise = big ? 2 * rr - rr * 0.375 : 0.625;
    const hp = !big ? 1 : Math.max(1, Math.min(3, Math.round(crownH - rise))), finial = big && crownH - rise - hp >= 1;
    if (hp) {
      const capFrom = b.pieces.length;
      asCrown(b, () => {
        for (let i = 0; i < np; i++) { const a = (i + 0.5) * 360 / np; for (let y = crownY - 0.6; y < crownY - 0.6 + hp - 0.01; y += 1) b.put(K.pole1, Math.sin(rad(a)) * rp, y + 0.5, Math.cos(rad(a)) * rp); }
        const cap = ringRoofH(b, K, big ? 3.4 : 1.9, crownY - 0.6 + hp, [rr], { eave: true, crown: 0.4 });
        peak = Math.max(peak, cap.top + (big ? 0 : 0.5));
        if (finial) { for (let y = cap.top - 0.5; y < cap.top + 1.5; y += 1) b.put(K.pole1, 0, y + 0.5, 0); peak = cap.top + 1.5; }
        else if (!big) b.put(K.roofTop26 || 'wood_roof_top', 0, cap.top, 0, 0);
      });
      capPieces = b.pieces.slice(capFrom);
      b.notes.push(big ? `A raised roof on a ring of ${hp} m posts over the open crown${finial ? ', a finial post on top' : ''}.` : 'A smoke cap on four posts over the crown.');
    }
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
    // the front above the wall top, up to the roof: a column of 1 m wall pieces per metre along it, as tall as the roof
    // over the column's middle (whole 2 m bays to a metre under the roof left gaps up to 1.3 m under it, showcase 03)
    // the column's last piece goes up into the roof where the roof is more than WALL_GAP (lib/checks.js wallTops) over it
    if (style !== 'flat') {
      const q1 = K.wallQuarter || 'wood_wall_quarter', cols = [];
      for (let c = -Math.floor(w) + 0.5; c < w; c += 1) {
        const n = Math.max(0, Math.floor(roofAt(Math.hypot(Math.abs(c), zc)) - top));
        for (let j = 0; j < n; j++) b.put(q1, c, top + j + 0.5, zc, 0);
        cols.push({ c, y: top + n });
      }
      for (let round = 0; round < 2; round++) {
        // (as the game has them: the pieces that stand on their pivot at their foot, as lib/generate.js finish sets them)
        const local = b.pieces.filter(p => !p.decor && Math.abs(p.z - zc) < 3.5).map(p => { const pi = PH.piece(p.name); return pi.onPivot && !p.footed ? { ...p, y: p.y - pi.size[1] / 2 } : p; });
        const gaps = CkH().wallTops(local).filter(g => Math.abs(g.z - zc) < 0.3 && g.y >= top - 0.05);
        let more = 0;
        for (const col of cols) if (gaps.some(g => Math.abs(g.x - col.c) < 0.6 && Math.abs(g.y - col.y) < 0.05)) { b.put(q1, col.c, col.y + 0.5, zc, 0); col.y += 1; more++; }
        if (!more) break;
      }
    }
    door = { x: 0, z: zc };
    for (let x = -2 * mm; x <= 2 * mm; x += 2) if (Math.abs(x) >= 3) frontBays.push({ x, z: zc, yaw: 0, nx: 0, nz: 1, kind: 'wall' });
    b.notes.push(`A straight front ${(2 * mm + 2)} m wide with the door, ${(-zc).toFixed(0)} m in front of the fire; the open part of the round in front is the forecourt.`);
  }
  const doors = [door, ...bays.filter(bb => bb.kind === 'door' && bb.i !== doorSide).map(bb => ({ x: bb.x, z: bb.z }))];
  // side rooms from s4 against the wall away from the stair, under the gallery: storage always (D-154: the hub holds the
  // village's storage), and by the village's draw a second room toward the door side (food prep with the back door, or a
  // closet); a partition with a door into each
  const rooms = [];
  if (k >= 4) {
    const xm = xmP, xs = sR * xm, w = Math.sqrt(ap * ap - xm * xm) - 0.2;
    const zMin = zc != null ? zc + 1 : -w, two = V.rooms === 'two';
    for (let z = -2 * Math.floor((w - 1) / 2); z <= w - 1 + 1e-6; z += 2) {
      if (z - 1 < zMin - 0.01) continue;
      T.wallSegment(b, K, C, xs, 0, z, 90, SHt, Math.abs(z) === 4 && (two || z < 0) ? 'door' : 'wall', 'plank');
    }
    const x0 = Math.min(xs, sR * ap), x1 = Math.max(xs, sR * ap);
    if (two) {
      for (let x = xm + 1; x + 1 <= ap - 0.4; x += 2) T.wallSegment(b, K, C, sR * x, 0, 0, 0, SHt, 'wall', 'plank');
      rooms.push({ x0, x1, z0: Math.max(zMin, -w), z1: 0, y: 0, h: SHt, use: V.second === 'food' ? 'kitchen' : 'closet' }, { x0, x1, z0: 0, z1: w, y: 0, h: SHt, use: 'storage' });
      doors.push({ x: xs, z: -4 }, { x: xs, z: 4 });
    } else {
      rooms.push({ x0, x1, z0: Math.max(zMin, -w), z1: w, y: 0, h: SHt, use: 'storage' });
      doors.push({ x: xs, z: -4 });
    }
    b.notes.push(two ? `Two side rooms under the gallery: ${V.second === 'food' ? 'food prep' : 'a closet'} and storage.` : 'A storage room under the gallery.');
  }
  annexes.forEach((an, j) => {
    const nx = Math.sin(rad(an.a)), nz = Math.cos(rad(an.a)), tx = Math.cos(rad(an.a)), tz = -Math.sin(rad(an.a));
    const W = V.annexDeep, at = (u, v) => [nx * (ap + u) + tx * (an.t + v), nz * (ap + u) + tz * (an.t + v)];
    for (let u = 1; u < 2 * W; u += 2) {
      for (const v of [-2, 0, 2]) { const [x, z] = at(u, v); b.put(K.floor, x, 0, z, an.a); }
      for (const v of [-3, 3]) { const [x, z] = at(u, v); T.wallSegment(b, K, C, x, 0, z, an.a + 90, 3, 'wall', o.wallStyle); b.put(K.beam, x, 3, z, an.a + 90); }
    }
    for (const v of [-2, 0, 2]) { const [x, z] = at(2 * W, v); T.wallSegment(b, K, C, x, 0, z, an.a, 3, v === 0 ? 'window' : 'wall', o.wallStyle); b.put(K.beam, x, 3, z, an.a); }
    for (const v of [-3, 3]) { const [x, z] = at(2 * W, v); T.posts(b, K, x, z, 3); }
    const [cx, cz] = at(W, 0);
    for (const q of T.gablePieces(K, C, { cx, cz, W, D: 3, alpha: an.a - 90 }, 3, 1, [false, true], null, null)) b.put(/stone|marble|grausten/i.test(q.name) ? (K.wallHalf || 'wood_wall_half') : q.name, q.x, q.y, q.z, q.yaw);
    const [x0, z0] = at(0, -3), [x1, z1] = at(2 * W, 3);
    const room = { x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y: 0, h: 3, use: j === 0 ? 'storage' : 'closet', annex: true };
    rooms.push(room);
    const [dx, dz] = at(0, 0);
    doors.push({ x: dx, z: dz });
    b.notes.push(`An annex ${2 * W} by 6 m off the hall (${room.use}), with a door from the hall and a gable roof.`);
  });
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
  // the covered entrance at the main door from s4, six posts with the porch draw (none where the village drew none)
  if (k >= 4 && V.porch !== 'none') {
    const wy = Math.min(3, top - 1.6);
    coveredEntrance(b, K, C, T, door.x, door.z, wy, ext.porch6 ? 6 : 4);
    if (ext.dragons) hangHeads(b, [{ x: door.x, z: door.z - (ext.porch6 ? 6 : 4), nx: 0, nz: -1 }], wy + 2.7);
  }
  // (the crown's cap: kept only where the game holds it, checked once the posts are in, lib/hub.js design)
  const cap = capPieces.filter(p => b.pieces.includes(p));
  return { groundBays: [...bays.slice(0, N * L / 2), ...frontBays], ap, N, L, top, peak, door, doors, rings, postsOf, gallery, rIn, St, bridge, drum, apD, SHt, zc, style, roofAt, rooms, cap, sideX: k >= 4 ? Math.abs(sR * (xmP)) : null, sideS: sR, inSide: (x, m = 0) => k >= 4 && sR * x > xmP - m };
}

// ---------------------------------------------------------------- cross hall

// Half sizes per stage (odd metres, crossSpec): the front and back arm along z (Wz), the side arms along x (Wx), the
// arms' half width D, the storey height and storeys; drawn per village from the corpus spreads round the base sizes
// (s2 14 x 14 m with arms 6 m wide; s3 18 x 18 m, arms 10 m; s4 26 x 22 m, two storeys; s5 30 x 26 m, arms 14 m).
function crossHall(b, K, C, T, o) {
  const { stage, ext } = o;
  const V = o.V;
  const k = +stage[1];
  const [Wz, Wx, D, SHt, storeys] = crossSpec(stage, V);
  const top = SHt * storeys, gallery = storeys === 2 && V.gallery !== 'none';
  // the roof's pitch from the village's drawn rise against the arms' width (D-156, corpus spread): 45 degrees gives a
  // rise of about 0.43 of the width, 26 degrees 0.21
  const r = V.rise >= 0.32 ? 2 : 1;
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
  const sR = V.roomSide, sS = V.stairSide;
  const isSideDoor = e => k >= 3 && e.yaw === 90 && Math.abs(e.x - sR * Wx) < 0.01 && Math.abs(e.z) < 0.01;
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
  // side rooms from s4 at the ends of the side arms behind a partition with a door: storage always (D-154), and by the
  // village's draw a second room at the other end (food prep with its own door out, or a closet); the partition where
  // the village drew it (corpus inner wall lines, SHAPE_Q.hall.inner: a share of the plan's length from the end)
  const depth = Math.max(4, Math.min(Wx - D - 2, 2 * Math.round(V.part * 2 * Wx / 2))), p = Wx - depth, rooms = [];
  const sides = k >= 4 ? (V.rooms === 'two' ? [-sR, sR] : [-sR]) : [];
  if (k >= 4) {
    for (const sx of sides) for (let z = -D + 1; z < D; z += 2) T.wallSegment(b, K, C, sx * p, 0, z, 90, SHt, z === 0 ? 'door' : 'wall', 'plank');
    const second = V.second === 'food' ? 'kitchen' : 'closet';
    if (sides.length === 2) rooms.push({ x0: Math.min(sR * p, sR * Wx), x1: Math.max(sR * p, sR * Wx), z0: -D, z1: D, y: 0, h: SHt, use: second });
    rooms.push({ x0: Math.min(-sR * p, -sR * Wx), x1: Math.max(-sR * p, -sR * Wx), z0: -D, z1: D, y: 0, h: SHt, use: 'storage' });
    for (const sx of sides) doors.push({ x: sx * p, z: 0 });
    b.notes.push(sides.length === 2 ? `Side rooms at the ends of the side arms, ${depth} m deep: ${second === 'kitchen' ? 'food prep with its own door out' : 'a closet'} and storage.` : `A storage room ${depth} m deep at the end of one side arm.`);
  }
  const inSide = (x, m = 0) => sides.some(sx => sx * x > p - m);
  // the gallery (from s4) at 3 m. s4: over the front arm's end (over the door) and along its -x wall, a stair up the +x
  // wall. s5: along both walls of every arm, so a railed walkway runs round the hall and crosses the front and back arms
  // and the side arms at the crossing, round an opening over the fire; lofts over the side rooms; two stairs up the
  // back arm's walls toward the high seat end
  const G = new Map(), stairs = [];
  const addG = (x, z) => { if (has(x, z)) G.set(`${x},${z}`, [x, z]); };
  if (gallery && k === 4) {
    // (two cells deep everywhere: Tyler's two-piece rule for anything people walk along)
    for (let x = -D + 1; x < D; x += 2) { addG(x, -Wz + 1); addG(x, -Wz + 3); }
    // (the stair on the side the village drew, the gallery along the other wall)
    for (let z = -Wz + 3; z <= -D - 1; z += 2) { addG(-sS * (D - 1), z); addG(-sS * (D - 3), z); }
    // (the landing joins the row over the door along the stair's wall)
    for (let z = -Wz + 3; z <= -D - 7; z += 2) { addG(sS * (D - 1), z); addG(sS * (D - 3), z); }
    stairs.push({ run: [[sS * (D - 1), -D - 1], [sS * (D - 1), -D - 3], [sS * (D - 1), -D - 5]], stand: [sS * (D - 1), -D + 1], land: [sS * (D - 1), -D - 7], dir: [0, -1] });
    addG(sS * (D - 1), -D - 7);
  } else if (gallery) {
    // s5 by the village's draw (V.gallery): along both walls of every arm (full), of the front and back arms (nave), or
    // round the back arm behind the high seat (back, one stair); lofts over the side rooms
    const loft = (x, z) => V.gallery === 'full' && inTrans(x, z) && inSide(x, -1);
    const near = (x, z) => (inMain(x, z) && Math.abs(x) >= D - 3) || (inTrans(x, z) && Math.abs(z) >= D - 3);
    for (const [, [x, z]] of cells) {
      const g = V.gallery === 'nave' ? inMain(x, z) && (Math.abs(x) >= D - 3 || Math.abs(z) >= Wz - 3) && Math.abs(z) > D - 2
        : V.gallery === 'back' ? inMain(x, z) && z > D - 2 && (Math.abs(x) >= D - 3 || z >= Wz - 3)
          : near(x, z);
      if (g || loft(x, z)) addG(x, z);
    }
    // (the nave's galleries are a U over each end, one stair to each: the back one on the stair side, the front one on
    // the other)
    if (V.gallery === 'nave') for (const [sx, sz] of [[sS, 1], [-sS, -1]]) stairs.push({ run: [[sx * (D - 1), sz * (D + 1)], [sx * (D - 1), sz * (D + 3)], [sx * (D - 1), sz * (D + 5)]], stand: [sx * (D - 1), sz * (D - 1)], land: [sx * (D - 1), sz * (D + 7)], dir: [0, sz] });
    else for (const sx of V.gallery === 'back' ? [sS] : [-1, 1]) stairs.push({ run: [[sx * (D - 1), D + 1], [sx * (D - 1), D + 3], [sx * (D - 1), D + 5]], stand: [sx * (D - 1), D - 1], land: [sx * (D - 1), D + 7], dir: [0, 1] });
    for (const St of stairs) addG(St.land[0], St.land[1]);
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
    b.notes.push(k === 5 ? { full: 'A gallery at 3 m along the walls of every arm, crossing the arms round the opening over the fire, two stairs.', nave: 'A gallery at 3 m along both walls of the front and back arms, two stairs.', back: 'A gallery at 3 m round the back arm behind the high seat, one stair.' }[V.gallery] || 'A gallery at 3 m.' : 'A gallery at 3 m over the door and along one wall of the front arm, a stair up to it.');
  }
  // roof: a gable over each pair of arms; where they cross the valleys join them (generate.js, as for a house's wings)
  const wings = [{ cx: 0, cz: 0, W: Wz, D, alpha: 90, main: true }, { cx: 0, cz: 0, W: Wx, D, alpha: 0 }];
  const parts = [];
  for (const w of wings) parts.push(...T.gablePieces(K, C, w, top, r, [true, true], null, null));
  T.valleys(parts, b);
  const tower = k >= 4 && ext.tiers3 && V.crown * r * (D - 1) / 2 >= 1.5;
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
    const y0 = capY - r, th = Math.max(2, Math.min(4, Math.round(V.crown * r * (D - 1) / 2)));
    asCrown(b, () => {
      for (const sx of [-3, 3]) for (const sz of [-3, 3]) T.posts(b, K, sx, sz, y0);
      lantern(b, K, C, T, y0, th, { r, windows: !!ext.highWindows });
    });
    peak = y0 + th + r + 0.3;
    b.notes.push(`A lantern tower over the crossing, ${ext.highWindows ? 'windows' : 'walls'} at its corners and open bays for the smoke.`);
  }
  // carved heads at the four gable ends (s4 on, or by the draw): each pair hung on its gable walls under the ridge
  if ((C.dragons && k >= 4) || ext.dragons) {
    hangHeads(b, [{ x: 0, z: -Wz, nx: 0, nz: -1 }, { x: 0, z: Wz, nx: 0, nz: 1 }], capY);
    hangHeads(b, [{ x: -Wx, z: 0, nx: -1, nz: 0 }, { x: Wx, z: 0, nx: 1, nz: 0 }], capY);
  }
  // porch: a row of posts 4 m out from the front arm's end, a lean-to roof against it (corpus: 6 or more columns);
  // else from s4 a covered entrance over the main door
  const porch = k >= 4 && !!ext.porch6;
  if (porch) {
    const zp = -Wz - 4, yb = 3;
    for (let x = -D; x <= D; x += 2) T.posts(b, K, x, zp + 0.15, yb);
    for (let x = -D + 1; x <= D - 1; x += 2) { b.put(K.beam, x, yb + 0.1, zp + 0.15, 0); b.put(K.roof26, x, yb + 1, zp + 3, 180); b.put(K.roof26, x, yb, zp + 1, 180); }
    b.notes.push(`Porch of ${D + 1} posts across the front.`);
  } else if (k >= 4 && V.porch !== 'none') coveredEntrance(b, K, C, T, 0, -Wz, 3, 4);
  // tie beams across the arms at the wall top (D-128: tie beams in halls), the chandeliers hang from them
  // (across the arms beyond the crossing: one at the middle of each arm, two in a long arm)
  const tieAt = W => { const len = W - D; return len < 3 ? [] : len >= 8 ? [D + Math.round(len / 3), D + Math.round(2 * len / 3)] : [D + Math.round(len / 2)]; };
  const tie = k < 3 ? { z: [], x: [] } : { z: tieAt(Wz).flatMap(z => [z, -z]), x: tieAt(Wx).flatMap(x => [x, -x]).filter(x => !inSide(x, 0.5)) };
  for (const z of tie.z) for (let x = -D + 1; x < D; x += 2) b.put(K.beam, x, top + 0.1, z, 0);
  for (const x of tie.x) for (let z = -D + 1; z < D; z += 2) b.put(K.beam, x, top + 0.1, z, 90);
  // a post against the wall under each end of a tie beam, as a timber frame carries its ties: a 6 m tie of wood beams
  // on the wall tops alone dropped its middle beam in the game (lib/checks.js gameSupport); core wood where the biome
  // allows it, set in against the wall's inner face
  const tiePole = PH.decorOk('wood_pole_log', C.biome) ? 'wood_pole_log' : K.pole;
  for (const z of tie.z) for (const sx of [-1, 1]) T.posts(b, K, sx * (D - 0.2), z, top, tiePole);
  for (const x of tie.x) for (const sz of [-1, 1]) T.posts(b, K, x, sz * (D - 0.2), top, tiePole);
  const hangs = [...tie.z.map(z => [0, z]), ...tie.x.map(x => [x, 0])].map(([x, z]) => ({ x, z, y: top - 1.97 }));
  // rooms: the two arms, the gallery's cells, the side rooms
  b.rooms.push({ x0: -D, x1: D, z0: -Wz, z1: Wz, y: 0, h: top, use: 'hall', main: true, door: { x: 0, z: -Wz } });
  b.rooms.push({ x0: -Wx, x1: Wx, z0: -D, z1: D, y: 0, h: top, use: 'hall' });
  if (G.size) b.rooms.push(...cellRects([...G.values()], SHt, 'gallery'));
  b.rooms.push(...rooms);
  b.doorX = 0;
  b.notes.push(`Cross hall ${2 * Wx} x ${2 * Wz} m, arms ${2 * D} m wide, round the fire at the crossing.`);
  return { inSide, Wz, Wx, D, top, SHt, capY, peak, doors, door: { x: 0, z: -Wz }, edges, stairs, G, rooms, porch, hangs, sideX: k >= 4 ? p : null, isRun };
}

// ---------------------------------------------------------------- the shared furnishing

// How much of rug p would lie on the rugs among pieces, and they on it (8 x 8 points over each rug's area).
function rugFits(pieces, p) {
  const F = DecH().FURNITURE;
  const sz = n => (F[n] || { s: [3, 0.05, 3] }).s;
  const frame = q => { const [w, , l] = sz(q.name), a = rad(q.yaw || 0); return { q, w, l, c: Math.cos(a), s: Math.sin(a) }; };
  const inR = (r, x, z) => { const dx = x - r.q.x, dz = z - r.q.z, u = dx * r.c - dz * r.s, v = dx * r.s + dz * r.c; return Math.abs(u) <= r.w / 2 && Math.abs(v) <= r.l / 2; };
  const share = (r, others) => { let h = 0; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const u = -r.w / 2 + r.w * (i + 0.5) / 8, v = -r.l / 2 + r.l * (j + 0.5) / 8, x = r.q.x + u * r.c + v * r.s, z = r.q.z - u * r.s + v * r.c; if (others.some(o => inR(o, x, z))) h++; } return h / 64; };
  const me = frame(p);
  const near = pieces.filter(q => q !== p && PH.piece(q.name).role === 'rug' && Math.abs(q.y - p.y) < 0.3 && Math.hypot(q.x - p.x, q.z - p.z) < 6).map(frame);
  if (!near.length) return true;
  if (share(me, near) > RUG_OVER) return false;
  return near.every(r => share(r, [...near.filter(o => o !== r), me]) <= RUG_OVER);
}

// The hub's rooms as the shared pipeline's room kinds (lib/kitbash.js ROOM_KINDS): the hall and the gallery as a hall,
// the storage room, the closet and an annex as storage, food prep as a kitchen.
const HUB_ROLE = { hall: 'hall', gallery: 'hall', storage: 'storage', closet: 'storage', kitchen: 'kitchen' };
// Dressing through the interior library every other building uses (lib/kitbash.js furnishRooms: corner, wall, window,
// table and hearth sets, and dressWalls: ledges, banners, stands, candles and torches, all weighted by the persona,
// lib/persona.js), with the hub's own room kinds. The hall and the gallery keep their open floor: no set that stands on
// the free floor goes there. Every set goes in whole only where the walk still reaches every room, climb and main piece
// (placer admit); the hub's own pieces stay where they are (the sets never move them). Returns the number of sets.
function sharedDress(b, o) {
  const { P, decor, biome, cultureKey, place, R } = o;
  const Kb = KBH(), D = DecH();
  if (!Kb || !D || decor === 'd1') return 0;
  // the rooms as the decorator reads them, each with the kind of the hub room it lies in
  const byY = new Map();
  for (const r of b.rooms) { const y = Math.round(r.y * 4) / 4; if (!byY.has(y)) byY.set(y, []); byY.get(y).push(r); }
  const open = [], closed = [];
  [...byY.keys()].sort((a, c) => a - c).forEach((y, li) => {
    const rects = byY.get(y);
    const models = D.readLevel(b.pieces, D._int.standGuess(b.pieces, rects, y), rects) || [];
    for (const m of models) {
      if (m.area < 4 || m.covered < 0.5) continue;
      m.upper = li > 0;
      const score = r => m.cells.filter(c => c.x > r.x0 && c.x < r.x1 && c.z > r.z0 && c.z < r.z1).length;
      const own = rects.slice().sort((p, q) => score(q) - score(p) || (p.main ? 1 : 0) - (q.main ? 1 : 0))[0];
      const role = HUB_ROLE[own.use] || 'hall';
      (role === 'hall' ? open : closed).push({ m, role, li });
    }
  });
  // the hub's own pieces are not moved by a set
  const mine = b.pieces.filter(p => p.decor && !p.kb);
  for (const p of mine) p.kb = 'hub';
  const zones = place.zones();
  const ctx = { type: 'hub', use: 'hall', biome, culture: cultureKey, cultureKey, decor, persona: P, R };
  const L0 = Kb.library();
  let sets = 0;
  const run = (rooms, lib) => {
    if (!rooms.length) return;
    const n0 = b.pieces.length;
    if (lib) Kb.setLibrary(lib);
    try { Kb.furnishRooms(b, { ...ctx }, zones, rngH((P.salt ^ hashH(rooms.length + '|' + n0)) >>> 0), [], rooms); } finally { if (lib) Kb.setLibrary(L0); }
    // what came in goes back out and in again set by set through the walk test
    const fresh = b.pieces.splice(n0);
    const groups = new Map();
    for (const p of fresh) { const g = p.kb || `${p.name}@${p.x},${p.z}`; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(p); }
    for (const g0 of groups.values()) {
      // (built frames of beams and posts stay out of the hall, which has its own; a rug lies on rugs already down by
      // RUG_OVER of its area or less, as corpus builders lay them, else it stays out of the set)
      if (g0.some(p => ['beam', 'pole'].includes(PH.piece(p.name).role))) continue;
      // (a station's extension without its station stays out: the hub's sets are not workshops)
      const acc = [];
      const g = g0.filter(p => !/_ext\d/.test(p.name) && (PH.piece(p.name).role !== 'rug' || (rugFits([...b.pieces, ...acc], p) && acc.push(p))));
      if (g.length && (!o.wallCap || o.wallCap(g)) && place.admit(g)) sets++;
    }
  };
  // the side rooms take every set; the hall and the gallery none that stands on the free floor
  run(closed, null);
  run(open, { ...L0, assemblies: (L0.assemblies || []).filter(a => !['floor', 'bed', 'post'].includes(a.anchor)) });
  for (const p of mine) if (p.kb === 'hub') delete p.kb;
  // things on the item stands the sets brought, by the persona; the memento and trophy stands stay empty (D-134)
  const PS = PSH();
  if (PS && PS.dressStands) {
    const proxy = { pieces: b.pieces.filter(p => !p.memento) };
    PS.dressStands(proxy, { persona: P, biome, type: 'hub', use: 'hall' });
    const keepSet = new Set(proxy.pieces);
    b.pieces = b.pieces.filter(p => p.memento || keepSet.has(p));
    place.reset();
  }
  if (sets) b.notes.push(`${sets} sets from the interior library on the walls, tables and corners, by the village's persona.`);
  return sets;
}

// ---------------------------------------------------------------- furnishing a hall stage

// Spots along a list of wall bays' inner faces at floor height y: { x, y, z, nx, nz (into the room), yawIn }
const spotOf = (x, z, nx, nz, y) => ({ x, y, z, nx, nz, yawIn: normH(Math.atan2(nx, nz) * 180 / Math.PI) });
function wallSpots(b, o, F, y) {
  const out = [];
  if (o.line === 'cross') {
    for (const e of F.edges) {
      if (F.doors.some(d => Math.hypot(d.x - e.x, d.z - e.z) < 2.5)) continue;
      if (F.inSide(e.x, -0.5)) continue;
      if (e.yaw === 0 && Math.abs(e.z) >= F.Wz - 0.01 && e.z > 0) continue; // the trophy wall behind the high seat
      out.push(spotOf(e.x, e.z, e.nx, e.nz, y));
    }
  } else {
    // a spot at each ground-storey wall bay, facing in (the doors' bays left out)
    for (const bb of F.groundBays) {
      if (bb.kind === 'door' || (F.zc != null && bb.z < F.zc + 1)) continue;
      if (Math.abs(normH(bb.yaw - (F.seatA || 0) + 180) - 180) < 40 && Math.hypot(bb.x, bb.z) > 2) continue; // the trophy wall
      out.push(spotOf(bb.x + bb.nx * 0.15, bb.z + bb.nz * 0.15, bb.nx, bb.nz, y));
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

// The hall floor's top for furniture standing on it: corpus builders stand furniture 0.097 to 0.10 m over the floor
// piece's pivot; at 0.125 m the hub's benches, tables and chests hovered 3 to 4 cm (track F's measure, showcase review)
const HUB_FY = 0.1;
function furnish(b, K, C, T, o, F) {
  const { stage, line, place, has, skipDecor, V } = o;
  const k = +stage[1];
  const ds = n => ({ ds: n });
  // the village's persona (lib/persona.js, village traits, never a trade): what the walls, stands, banners, lights and
  // tables lean to, as in every other building
  const PS = PSH(), P = o.persona, ww = PS.wallWeights(P, 'hall');
  const tilt = (kind, n) => DecH().corpusTilt(o.cultureKey, kind, n);
  const pR = rngH((P.salt ^ 0x5eed) >>> 0);
  const light = PS.pickW(pR, { piece_walltorch: 3 * tilt('light', 'piece_walltorch'), piece_dvergr_lantern: tilt('light', 'piece_dvergr_lantern') * P.likes.lights * (0.5 + P.wealth) });
  const rugK = PS.pickW(pR, Object.fromEntries(['rug_fur', 'rug_deer', 'rug_wolf', 'jute_carpet'].map(n => [n, tilt('rug', n) * (/jute/.test(n) ? 1 : P.likes.rugs)])));
  // (a group's chairs by the culture's corpus seats and the persona: the finer chairs with comfort and wealth)
  const chairK = PS.pickW(pR, Object.fromEntries(['piece_chair', 'piece_chair02', 'piece_chair03'].map(n => [n, tilt('seat', n) * (n === 'piece_chair' ? 1.5 - P.wealth : 0.4 + 0.6 * (P.comfort + P.wealth))])));
  V.light = light; V.rug = rugK; V.chair = chairK;
  V.trophyRows = ww.trophy >= 1 ? 3 : 2;
  // the fire at the heart (stone flags under it from s2, D-131), in the form the village drew (V.hearth): the stone
  // hearth, a fire pit, or a long fire of a hearth between two pits across the hall
  const form = k >= 2 ? V.hearth : 'pit';
  b.put(form === 'pit' ? 'fire_pit' : 'hearth', 0, 0.125, 0, 0, { decor: true, hearth: true, ds: 1 });
  place.keep(-2.4, 2.4, -2, 2, 0, 3);
  // (corpus: a cooking station stands 0.20 over a fire pit, 252 of 256, and 0.583 over a hearth, 116 of 123)
  b.put('piece_cookingstation', 0, 0.125 + (form === 'pit' ? 0.2 : 0.583), 0, 0, { decor: true, ds: 1 });
  const fires = [{ x: 0, z: 0 }];
  if (form === 'long') for (const x of [-2, 2]) {
    b.put('stone_floor_2x2', x, -0.375, 0, 0, { hearthStone: true });
    b.pieces = b.pieces.filter(q => !(q.name === K.floor && Math.abs(q.x - x) < 0.01 && Math.abs(q.z) < 0.01 && Math.abs(q.y) < 0.01));
    b.put('fire_pit', x * 1.4, 0.125, 0, 0, { decor: true, hearth: true, ds: 1 });
    place.keep(x - 1.6, x + 1.6, -1.6, 1.6, 0, 3);
  }
  if (form === 'long') b.notes.push('A long fire: the hearth between two fire pits.');
  // more fires in the big halls (corpus: 3 or more fires in 17 % of the ranked set, 63 % of the top tenth): the cross
  // a second fire in the front arm from s4 and one in the back arm at s5 by the draw; the round hall two at its sides
  // at s5 by the draw. Never under a gallery or walkway.
  const fz = line === 'cross' ? Math.round((F.D + F.Wz) / 2) : 0;
  const extra = line === 'cross' ? (k === 5 && has('fires3', stage) && V.seat !== 'near' ? [[0, -fz], [0, fz]] : k >= 4 ? [[0, -fz]] : [])
    : k === 5 && has('fires3', stage) ? [[-7, 0], [7, 0]].filter(([x]) => !F.inSide || !F.inSide(x, 2)) : [];
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
    // where the village drew it (V.seat): the far end facing the door, at a side facing the fire (round halls), or the
    // near end of the back arm (cross); (in a round hall with a drum, inside the drum's ring of posts)
    let dist = line === 'cross' ? (V.seat === 'near' ? F.D + 1.6 : F.Wz - 1.3) : F.drum ? F.apD - 1.1 : (F.gallery ? F.rIn - 1.3 : F.ap - 2.2);
    const side = line !== 'cross' && V.seat === 'side' && k >= 4 && F.gallery;
    let ux = side ? V.seatSide : 0, uz = side ? 0 : 1, tx = uz, tz = -ux;
    // (a seat at the side stands clear of the side rooms' partition)
    if (side && F.sideX != null) dist = Math.min(dist, F.sideX - 1.8);
    // (a side seat with no room clear of the fires takes the far end)
    let side2 = side;
    if (side && dist < 4.6) { side2 = false; dist = F.drum ? F.apD - 1.1 : (F.gallery ? F.rIn - 1.3 : F.ap - 2.2); ux = 0; uz = 1; tx = 1; tz = 0; }
    const sx = ux * dist, sz = uz * dist, yaw = normH(Math.atan2(-ux, -uz) * 180 / Math.PI);
    F.seatA = normH(Math.atan2(ux, uz) * 180 / Math.PI);
    // raised as the village drew it (V.raise): a dais of two steps, one step, or none (always raised at s5)
    const raise = V.raise;
    let y = 0.125;
    if (raise !== 'none') {
      for (let a = -1.5; a <= 1.5; a += 1) for (let c = 0; c < 3; c++) {
        const x = sx + tx * a + ux * (c - 0.7), z = sz + tz * a + uz * (c - 0.7);
        b.put(K.floor1, x, 0.25, z, 0, { dais: true });
        if (c < 2 && raise === 'dais') b.put(K.floor1, x, 0.5, z, 0, { dais: true });
      }
      y = raise === 'dais' ? 0.625 : 0.375;
      b.notes.push(raise === 'dais' ? 'The high seat on a dais.' : 'The high seat on a step.');
    }
    b.put('piece_throne01', sx, y, sz, yaw, { decor: true, ds: 1, highSeat: true });
    place.keep(Math.min(sx - 1, sx + 1), sx + 1, sz - 1, sz + 1, 0, 3);
    leader = { x: sx, y, z: sz, yaw };
    for (const s of [1.45, -1.45]) if (place.put('piece_chair02', sx + tx * s, y, sz + tz * s, yaw, { ds: 1, spouseSeat: true }, { inKeep: true })) { spouse = { x: sx + tx * s, y, z: sz + tz * s, yaw }; break; }
    // the way from the fire to the high seat
    if (side2) place.keep(Math.min(2 * ux, sx - ux * 0.6), Math.max(2 * ux, sx - ux * 0.6), -1.3, 1.3, 0, 3);
    else place.keep(-1.3, 1.3, 2, sz - 0.6, 0, 3);
    for (const s of [-1, 1]) place.put('piece_groundtorch_wood', sx + tx * s * 2.6 + ux * 0.4, y + 0.75, sz + tz * s * 2.6 + uz * 0.4, 0, ds(2));
  }
  if (skipDecor) { b.leader = leader || { x: 0, y: 0.125, z: 3, yaw: 180 }; b.spouse = spouse; return; }
  // rugs overlap as corpus builds lay them (lab/hub_dress.py, builds with 2 to 12 rugs: half the rugs overlap another,
  // by a median 36 % of the rug and 52 % at the third quartile): a rug goes in only where it overlaps those already down by
  // RUG_OVER of its area or less, and the second of two overlapping rugs only while half or fewer overlap
  const rugs = [];
  const rugSize = n => (DecH().FURNITURE[n] || { s: [3, 0.05, 3] }).s;
  const inRug = (r, x, z) => { const a = rad(r.yaw), dx = x - r.x, dz = z - r.z, u = dx * Math.cos(a) - dz * Math.sin(a), v = dx * Math.sin(a) + dz * Math.cos(a); return Math.abs(u) <= r.w / 2 && Math.abs(v) <= r.l / 2; };
  const putRug = (name, x, y, z, yaw, extra) => {
    const [w, , l] = rugSize(name), a = rad(yaw);
    let hit = 0;
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      const u = -w / 2 + w * (i + 0.5) / 8, v = -l / 2 + l * (j + 0.5) / 8;
      if (rugs.some(r => Math.abs(r.y - y) < 0.3 && inRug(r, x + u * Math.cos(a) + v * Math.sin(a), z - u * Math.sin(a) + v * Math.cos(a)))) hit++;
    }
    const f = hit / 64, nOver = rugs.filter(r => r.over).length;
    if (f > RUG_OVER || (f > 0.05 && nOver + 1 > (rugs.length + 1) / 2)) return false;
    // (nor may it cover a rug already down by more than that)
    const me = { x, y, z, yaw, w, l };
    const cover = r => { let h = 0; const ra = rad(r.yaw); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const u = -r.w / 2 + r.w * (i + 0.5) / 8, v = -r.l / 2 + r.l * (j + 0.5) / 8, px = r.x + u * Math.cos(ra) + v * Math.sin(ra), pz = r.z - u * Math.sin(ra) + v * Math.cos(ra); if ([...rugs, me].some(o => o !== r && Math.abs(o.y - r.y) < 0.3 && inRug(o, px, pz))) h++; } return h / 64; };
    if (rugs.some(r => Math.abs(r.y - y) < 0.3 && Math.hypot(r.x - x, r.z - z) < 4.5 && cover(r) > RUG_OVER)) return false;
    if (!place.put(name, x, y, z, yaw, extra, { onFurn: true, inKeep: true })) return false;
    rugs.push({ x, y, z, yaw, w, l, over: f > 0.05 });
    return true;
  };
  // seats round the fires: benches on three sides at s2 and s3, two from s4 (corpus: rugs by 47 to 51 % of hall fires,
  // seats by a third), rugs by the fires (d2)
  const benches = [];
  for (const f of fires) {
    const ring = f.x === 0 && f.z === 0 ? [0, 90, 270, 180].slice(0, k <= 3 ? 3 : 2) : [90, 270];
    for (const a of ring) {
      const x = f.x + Math.sin(rad(a)) * 3.2, z = f.z + Math.cos(rad(a)) * 3.2;
      if (place.put('piece_bench01', x, HUB_FY, z, a + 180, ds(f === fires[0] ? 1 : 2))) benches.push({ x, z, yaw: normH(a + 180), a, main: f === fires[0] });
    }
    for (const a of [45, 225]) putRug(V.rug, f.x + Math.sin(rad(a)) * 2.6, 0.14, f.z + Math.cos(rad(a)) * 2.6, a, ds(2));
  }
  if (!leader) {
    const bn = benches.find(bb => bb.main && bb.a === 0) || benches[0];
    leader = bn ? { x: bn.x, y: HUB_FY, z: bn.z, yaw: bn.yaw } : { x: 0, y: 0.125, z: 3, yaw: 180 };
  }
  // feast tables with benches: along the arms of a cross, in a ring in a round hall (under the gallery from s4)
  const tryTable = (x, z, yaw, d) => {
    if (!place.put('piece_table', x, HUB_FY, z, yaw, ds(d))) return;
    const nx = Math.sin(rad(yaw)), nz = Math.cos(rad(yaw));
    for (const s of [-1, 1]) place.put('piece_bench01', x + nx * s * 0.95, HUB_FY, z + nz * s * 0.95, yaw + (s > 0 ? 180 : 0), ds(d));
  };
  // a long table: tables end to end along (ux, uz) from (x0, z0) over len metres, a row of benches down each side
  const longRow = (x0, z0, ux, uz, len, d) => {
    const yaw = normH(Math.atan2(-uz, ux) * 180 / Math.PI), n = Math.floor((len + 0.3) / 2.45);
    let put = 0;
    for (let i = 0; i < n; i++) {
      const x = x0 + ux * (1.225 + 2.45 * i), z = z0 + uz * (1.225 + 2.45 * i);
      if (!place.put('piece_table', x, HUB_FY, z, yaw, ds(i < 2 ? d : 2))) continue;
      put++;
      for (const sg of [-1, 1]) place.put('piece_bench01', x - uz * sg * 0.95, HUB_FY, z + ux * sg * 0.95, yaw + (sg > 0 ? 0 : 180), ds(i < 2 ? d : 2));
    }
    return put;
  };
  // how the hall sits (by line and the culture's roof, the culture data in styles.js): long tables down the arms of a
  // cross (the corpus long halls' feast tables); in a round hall under a cone, rings of benches round the fire; under a
  // drum, long tables like spokes between the fire and the gallery; under a flat roof, rugs round the fire and tables
  // along the walls
  // the table plan the village drew (V.tables, V.nTables): long rows down the arms, a U of rows round the back arm and
  // the side arms, spokes from the fire, a ring of benches, rugs round the fire, loose groups of a table and chairs, or
  // a mix of spokes and groups
  const seating = V.tables;
  let nRows = 0, nGroups = 0;
  const noGo = (x, z) => (F.inSide && F.inSide(x, 1.6)) || (F.zc != null && z < F.zc + 1.6);
  // a loose group: a table with chairs at its heads and sides (D-152), turned a little toward the fire
  const group = (x, z, yaw, d) => {
    if (!place.put('piece_table', x, HUB_FY, z, yaw, ds(d))) return false;
    const a = rad(yaw), ex = Math.cos(a), ez = -Math.sin(a), nx = Math.sin(a), nz = Math.cos(a);
    for (const [px, pz, py] of [[ex * 1.6, ez * 1.6, yaw + 90], [-ex * 1.6, -ez * 1.6, yaw - 90], [nx * 0.95 + ex * 0.6, nz * 0.95 + ez * 0.6, yaw + 180], [-nx * 0.95 - ex * 0.6, -nz * 0.95 - ez * 0.6, yaw]])
      place.put(V.chair || 'piece_chair', x + px, HUB_FY, z + pz, py, ds(d));
    nGroups++;
    return true;
  };
  const groups = n => {
    const R2 = rngH(hashH(`${o.lineage}|groups|${stage}`));
    const r0 = 4.4, r1 = line === 'cross' ? Math.max(F.Wz, F.Wx) - 2.5 : (F.gallery ? F.rIn + 2.5 : F.ap - 2);
    for (let t = 0; t < 40 && nGroups < n; t++) {
      const a = R2() * 360, r = r0 + R2() * (r1 - r0), x = Math.sin(rad(a)) * r, z = Math.cos(rad(a)) * r;
      if (noGo(x, z)) continue;
      group(x, z, normH(a + 90 + (R2() - 0.5) * 20), nGroups < 2 ? 1 : 2);
    }
  };
  const spokes = n => {
    // (when the drum stands on the gallery's posts the open middle is small: the spokes run under the gallery)
    const under = F.gallery && F.rIn < 7, r0 = under ? F.rIn + 0.4 : 4.0, r1 = under ? F.ap - 0.8 : F.gallery ? F.rIn - 0.6 : F.ap - 0.8;
    // n spokes evenly round the fire from a drawn start, clear of the door's, the high seat's and the stair's sides;
    // each a long table pointing at the fire with a bench down each side (D-152: a spoke that does not fit is left out)
    const off = rngH(hashH(`${o.lineage}|spokes`))() * 360 / n, avoid = [180, F.seatA || 0, F.St ? (F.St.run[0][0] < 0 ? 270 : 90) : null].filter(v => v != null);
    for (let i = 0; i < n; i++) {
      const a = normH(off + i * 360 / n);
      if (avoid.some(v => Math.abs(normH(a - v + 180) - 180) < 30)) continue;
      const ux = Math.sin(rad(a)), uz = Math.cos(rad(a));
      nRows += longRow(ux * r0, uz * r0, ux, uz, r1 - r0 - (a % 90 && !F.gallery ? 1 : 0), nRows < 3 ? 1 : 2) ? 1 : 0;
    }
  };
  if (seating === 'rows' || seating === 'U') {
    if (k === 2) for (const sx of [-1, 1]) tryTable(sx * 5, 0, 90, 1);
    else {
      // (at s5 the rows start in the crossing's corners, inside the stairs); a U leaves the front arm open
      const v = k === 5 ? F.D - 3.4 : F.D - 2.4, s0 = k === 5 ? F.D - 3 : F.D + 0.5, endX = sx => (F.inSide(sx * (F.Wx - 0.5)) ? F.sideX - 0.6 : F.Wx - 1);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        if (!(seating === 'U' && sz < 0)) nRows += longRow(sx * v, sz * s0, 0, sz, (sz > 0 ? F.Wz - 4.5 : F.Wz - 2.5) - s0, 1) ? 1 : 0;
        nRows += longRow(sx * s0, sz * v, sx, 0, endX(sx) - s0, 2) ? 1 : 0;
      }
    }
  } else if (seating === 'spokes') spokes(Math.min(6, Math.max(3, V.nTables)));
  else if (seating === 'mixed') { spokes(3); groups(Math.max(2, V.nTables - 2)); }
  else if (seating === 'groups') groups(V.nTables);
  else {
    // a ring of log benches round the fire (cone halls), or rugs (flat roof halls), and tables in a ring at the walls
    // (the log benches keep inside the cone's ring of posts at s2 and s3; none in a hall too small for both rings)
    const ringR = F.rings && F.rings.length && !F.gallery ? Math.min(...F.rings.map(r => r.r)) : Infinity;
    const rr = seating === 'ring' ? Math.min(5.4, ringR - 1.4) : 3.6, n = seating === 'ring' ? (rr >= 4.4 ? Math.min(8, V.nTables + 3) : 0) : 6;
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) * 360 / n, x = Math.sin(rad(a)) * rr, z = Math.cos(rad(a)) * rr;
      // (the ring leaves gaps toward the door and the high seat, and a way through between every two benches)
      if (seating === 'ring') { if (Math.abs(normH(a - 180 + 180) - 180) < 35 || Math.abs(normH(a - (F.seatA || 0) + 180) - 180) < 35) continue; place.put('piece_logbench01', x, HUB_FY, z, a + 180, ds(i % 2 ? 2 : 1)); }
      else putRug(i % 2 ? V.rug : 'jute_carpet', x, 0.14, z, a, ds(i % 2 ? 2 : 1));
    }
    if (line !== 'cross') {
      const rr2 = F.gallery ? F.rIn + 1.8 : Math.max(F.ap - 2.8, 4.8);
      const n2 = Math.min(V.nTables + 2, Math.max(3, Math.floor(2 * Math.PI * rr2 / 5)));
      for (let i = 0; i < n2; i++) {
        const a = (i + 0.5) * 360 / n2, x = Math.sin(rad(a)) * rr2, z = Math.cos(rad(a)) * rr2;
        if (noGo(x, z)) continue;
        tryTable(x, z, a, i % 2 ? 2 : 1);
      }
    } else groups(V.nTables);
  }
  if (nGroups) b.notes.push(`${nGroups} loose groups of a table and chairs.`);
  if (nRows) b.notes.push(`${nRows} long tables with benches${seating === 'spokes' || seating === 'mixed' ? ' like spokes round the fire' : seating === 'U' ? ' in a U' : ' down the arms'}.`);
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
  // a chest or bench at the wall keeps a step of clear floor in front of it (D-148: reached, never boxed in behind a
  // bench or table)
  const FRONT = new Set(['bed', 'table', 'seat', 'storage', 'craft', 'fire', 'pole']);
  const frontClear = (sp, d0) => {
    const cx = sp.x + sp.nx * (d0 + 1.0), cz = sp.z + sp.nz * (d0 + 1.0);
    return !b.pieces.some(p => (p.decor || PH.piece(p.name).role === 'pole') && FRONT.has(PH.piece(p.name).role) && p.y < 1.5 && (() => { const g = CkH().gameBox(p); return g.x0 < cx + 0.6 && g.x1 > cx - 0.6 && g.z0 < cz + 0.6 && g.z1 > cz - 0.6; })());
  };
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
    // (behind the high seat, wherever it sits; two or three rows by the village's draw)
    const ys2 = V.trophyRows === 3 && ys.length === 2 ? [ys[0], ys[0] + 0.9, ys[1]] : ys;
    for (const yy of ys2) for (const a0 of [-12, 12, -24, 24, -36, 36, 0]) {
      if (a0 === 0 && yy < 3) continue;
      const a = (F.seatA || 0) + a0;
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
    if (!(F.inSide && F.inSide(sp.x, 0.5)) && frontClear(sp, lowT + 0.42) && place.put('piece_chest_wood', sp.x + sp.nx * (lowT + 0.42), sp.y, sp.z + sp.nz * (lowT + 0.42), sp.yawIn, { ds: nChest < 2 ? 1 : nChest < 4 ? 2 : 3, chest: true })) nChest++;
  }
  // the side rooms: the closet full of chests, the kitchen with its prep table, butcher's table, fermenter and chests
  const inHall = line === 'cross' ? () => true : (x, z) => polyInside(F.N, F.ap)(x, z, 0.7);
  for (const room of F.rooms || []) {
    const spots = roomSpots(room, room.annex ? () => true : inHall);
    const items = room.use === 'storage' ? ['piece_chest', 'piece_chest', 'piece_chest_wood', 'piece_chest_wood', 'piece_chest_barrel', 'piece_chest_wood', 'piece_chest', 'piece_chest_barrel']
      : ['piece_preptable', 'cauldron_ext3_butchertable', 'fermenter', 'piece_chest_wood', 'piece_chest_barrel', 'piece_chest_wood'];
    let i = 0;
    for (const sp of spots) {
      if (i >= items.length) break;
      if (place.put(items[i], sp.x, HUB_FY, sp.z, sp.yaw, { ds: i < 3 ? 1 : 2, chest: /chest/.test(items[i]) })) i++;
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
  // (wall lights about the persona's torch spacing apart, lib/persona.js torchGap, on wall bays of about 2 m)
  let nt = 0;
  const tStep = Math.max(2, Math.round(PS.torchGap(P) / 2));
  for (const [i, sp] of edgeSpots.entries()) {
    if (nt >= 4 + 2 * k) break;
    if (i % tStep !== 1) continue;
    if (place.put(V.light, sp.x + sp.nx * (highT + 0.17), sp.y + WHH().lightY(P), sp.z + sp.nz * (highT + 0.17), sp.yawIn, ds(2), { inKeep: true })) nt++;
  }
  // (banners as the persona likes them, lib/persona.js wallWeights: none to six)
  const nBan = Math.max(0, Math.min(6, Math.round(4 * ww.banner - 1)));
  if (k >= 4) for (const sp of edgeSpots.filter((s, i) => i % 5 === 2).slice(0, nBan)) place.put(V.banner, sp.x + sp.nx * (highT + 0.12), sp.y + (F.top >= 6 ? 5.2 : 2.9), sp.z + sp.nz * (highT + 0.12), sp.yawIn, ds(3), { inKeep: true });
  // a cauldron by the main fire's side and a fermenter in the halls without a kitchen yet
  if (k === 3) {
    const sp = edgeSpots[Math.floor(edgeSpots.length / 3)];
    if (sp) place.put('piece_cauldron', sp.x + sp.nx * (lowT + 0.8), sp.y, sp.z + sp.nz * (lowT + 0.8), sp.yawIn, ds(2));
    const sp2 = edgeSpots[Math.floor(edgeSpots.length / 2)];
    if (sp2) place.put('fermenter', sp2.x + sp2.nx * (lowT + 0.8), sp2.y, sp2.z + sp2.nz * (lowT + 0.8), sp2.yawIn, ds(3));
  }
  // the shared interior library and the persona's wall dressing (lib/kitbash.js, lib/persona.js)
  // (the library's sets dress the wall bays up to the corpus third quartile, lab/hub_dress.py: 0.59 of the ground
  // storey's bays with furniture or dressing within 1.3 m on the hall side; a set that would take the hall past it
  // stays out)
  const DRESS0 = /bench|chair|throne|stool|chest|crate|barrel|itemstand|ArmorStand|banner|table|torch|lantern|brazier|candle|cauldron|fermenter|cooking|preptable|butcher|bed|sign/i;
  const dresses = (p, sp) => p.decor && DRESS0.test(p.name) && Math.abs(p.y - sp.y) < 3.4 && (() => { const dx = p.x - sp.x, dz = p.z - sp.z, u = Math.abs(dx * sp.nz - dz * sp.nx), v = dx * sp.nx + dz * sp.nz; return u <= 1.1 && v > 0 && v <= 1.3; })();
  const nBays = F.groundBays ? F.groundBays.length : edgeSpots.length;
  const done = new Set(edgeSpots.map((sp, i) => (b.pieces.some(p => dresses(p, sp)) ? i : -1)).filter(i => i >= 0));
  const wallCap = g => {
    const add = edgeSpots.map((sp, i) => (!done.has(i) && g.some(p => dresses(p, sp)) ? i : -1)).filter(i => i >= 0);
    if (add.length && (done.size + add.length) / nBays > WALL_Q3) return false;
    for (const i of add) done.add(i);
    return true;
  };
  if (k >= 2) sharedDress(b, { P, decor: o.decor, biome: o.biome, cultureKey: o.cultureKey, place, R: o.R, wallCap });
  // the wall sides: corpus halls and round buildings of 300 m2 or more (lab/hub_dress.py) have furniture or dressing
  // within 1.3 m of 47 % of the ground storey's wall bays in round and polygon buildings and 36 % in halls (medians),
  // mostly lights, chests, seats, stands and stations. Undressed bays get, in turn, a wall torch, a chest, a bench along
  // the wall, an item stand and a barrel until the hall reaches its share (d2 and d3)
  if (k >= 3) {
    const want = line === 'cross' ? 0.36 : 0.47;
    const DRESS = /bench|chair|throne|stool|chest|crate|barrel|itemstand|ArmorStand|banner|table|torch|lantern|brazier|candle|cauldron|fermenter|cooking|preptable|butcher|bed|sign/i;
    const dressed = sp => b.pieces.some(p => p.decor && DRESS.test(p.name) && Math.abs(p.y - sp.y) < 3.4 && (() => { const dx = p.x - sp.x, dz = p.z - sp.z, u = Math.abs(dx * sp.nz - dz * sp.nx), v = dx * sp.nx + dz * sp.nz; return u <= 1.1 && v > 0 && v <= 1.3; })());
    const spots = edgeSpots.filter((sp, i) => i % 2 === 0).concat(edgeSpots.filter((sp, i) => i % 2 === 1));
    let have = edgeSpots.filter(dressed).length, turn = 0;
    const items = [
      sp => place.put(V.light, sp.x + sp.nx * (highT + 0.17), sp.y + WHH().lightY(P), sp.z + sp.nz * (highT + 0.17), sp.yawIn, ds(2), { inKeep: true, solid: true }),
      sp => place.put('piece_chest_wood', sp.x + sp.nx * (lowT + 0.42), sp.y, sp.z + sp.nz * (lowT + 0.42), sp.yawIn, { ds: 2, chest: true }, { solid: true }),
      sp => place.put('piece_bench01', sp.x + sp.nx * (lowT + 0.42), sp.y, sp.z + sp.nz * (lowT + 0.42), sp.yawIn, ds(2), { solid: true }),
      sp => place.put('itemstand', sp.x + sp.nx * (highT + 0.12), sp.y + 1.85, sp.z + sp.nz * (highT + 0.12), sp.yawIn, { ds: 2, memento: true }, { inKeep: true, solid: true }),
      sp => place.put('piece_chest_barrel', sp.x + sp.nx * (lowT + 0.4), sp.y, sp.z + sp.nz * (lowT + 0.4), sp.yawIn, { ds: 3, chest: true }, { solid: true }),
    ];
    for (const sp of spots) {
      // (the share counts every ground-storey bay, the trophy wall's and the side rooms' among them)
      if (have >= want * (F.groundBays ? F.groundBays.length : edgeSpots.length)) break;
      if (dressed(sp)) continue;
      for (let t = 0; t < items.length; t++) { const it = (turn + t) % items.length; if ([1, 2, 4].includes(it) && ((F.inSide && F.inSide(sp.x, 0.5)) || !frontClear(sp, lowT + 0.42))) continue; if (items[it](sp)) { have++; turn = (it + 1) % items.length; break; } }
    }
    b.notes.push(`Wall sides: ${have} of ${edgeSpots.length} wall bays with furniture or dressing.`);
  }
  b.leader = leader;
  b.spouse = spouse;
  void T;
}

// ---------------------------------------------------------------- the design

const topOf = pieces => pieces.reduce((m, p) => { const pi = PH.piece(p.name); return pi.structural ? Math.max(m, p.y + pi.size[1] / 2) : m; }, 0);
// RUG_OVER: the most of a rug's area that may lie on rugs already down (corpus third quartile, lab/hub_dress.py).
const RUG_OVER = 0.52;
// WALL_Q3: the corpus third quartile of wall bays with furniture or dressing beside them (lab/hub_dress.py, 300 m2 set).
const WALL_Q3 = 0.59;
// Roof proportions of the corpus big buildings (lab/hub_roofs.py, the 300 m2 set): roof rise against the short side of
// the ground floor and crown (lantern, cupola, spire) against the main roof, as quantiles at 10, 25, 50, 75 and 90 %.
// A village draws its place in the spread (D-156: a roof is as tall as its design calls for and is never cut off).
const ROOF_Q = { round: { rise: [0.18, 0.22, 0.34, 0.54, 0.82], crown: [0, 0.07, 0.16, 0.32, 0.5] },
  hall: { rise: [0.25, 0.37, 0.49, 0.56, 0.64], crown: [0, 0, 0.21, 0.33, 0.62] } };
function quant(u, q) {
  const at = [0.1, 0.25, 0.5, 0.75, 0.9];
  if (u <= at[0]) return q[0];
  for (let i = 1; i < at.length; i++) if (u <= at[i]) return q[i - 1] + (q[i] - q[i - 1]) * (u - at[i - 1]) / (at[i] - at[i - 1]);
  return q[4];
}

// Plan shapes of the corpus big buildings (lab/hub_shapes.py, the 300 m2 set of lab/hub_roofs.py: 55 round and polygon
// builds, 53 halls), quantiles at 10, 25, 50, 75 and 90 %. area: ground floor in m2; aspect: a hall's long side over its
// short side; arm: a branched hall's commonest run of floor across the plan over its long side; inner: inner wall lines,
// halls as the share of the length from the nearer end, round builds as the distance from the middle over the radius;
// sides: the wall directions of round and polygon builds (counts of builds, 8 sides left to the octagon line); porch:
// builds with no posts outside the floor, 2 to 5, and 6 or more; lobes: builds with no annex, one, two or more.
const SHAPE_Q = {
  round: { area: [363, 432, 568, 696, 1152], inner: [0.26, 0.42, 0.63, 0.87, 1.01], porch: { none: 16, entrance: 13, columns: 26 }, lobes: { 0: 22, 1: 9, 2: 24 } },
  hall: { area: [360, 496, 529, 680, 830], aspect: [1.21, 1.29, 1.74, 1.99, 2.16], arm: [0.21, 0.27, 0.38, 0.47, 0.67], inner: [0.08, 0.16, 0.25, 0.36, 0.45], porch: { none: 17, entrance: 20, columns: 16 } },
  sides: { 10: 2, 12: 9, 14: 2, 16: 18, 18: 1, 20: 1, 22: 1, 24: 1, 28: 1, 32: 3 },
};
// The stage's base size (the round 6 plans): round hall diameters, octagon side lengths, the cross's half sizes
// [Wz, Wx, D] (odd metres), storey height and storeys.
const BASE_DIA = { s2: 10.05, s3: 15.2, s4: 20.1, s5: 30.4 };
const BASE_OCT = { s2: 4, s3: 6, s4: 8, s5: 12 };
const OCT_MAX = 16;
const CSPEC = { s2: [7, 7, 3, 3, 1], s3: [9, 9, 5, 4, 1], s4: [13, 11, 5, 3, 2], s5: [15, 13, 7, 3, 2] };
// A village's place in the corpus size spread, as a scale on the stage's base: the square root of the drawn area over
// the median, the draw kept between the quartile at 25 % and the 90 % one (the stage's band).
const sizeScale = (u, q) => Math.sqrt(quant(0.25 + 0.65 * u, q) / q[2]);
// Sides and side length of a round or octagonal hall at a stage: the diameter the village's scale asks for, the sides
// it drew (octagon: 8) where some even side length comes within 6 % of it, else the corpus side count that comes
// nearest. Side lengths are even (2 m wall bays).
function roundSpec(variant, stage, V) {
  if (variant === 'octagon') {
    const want = BASE_OCT[stage] * (stage === 's4' ? Math.max(1, V.size) : V.size);
    let L = Math.max(4, 2 * Math.round(want / 2));
    if (stage !== 's2') L = Math.max(L, BASE_OCT['s' + (+stage[1] - 1)] * 1 + 2);
    // (14 m sides leave the floor band open at the corners: the nearer of 12 and 16)
    L = Math.min(OCT_MAX, L);
    if (L === 14) L = want >= 14 ? 16 : 12;
    return [8, L];
  }
  const want = BASE_DIA[stage] * (+stage[1] >= 4 ? Math.max(1, V.size) : V.size), cands = [];
  // (sides 16 and more, in fours, so the hall has walls square to its axes for the back door, the side rooms and the
  // annexes; the floor band does not yet close at the corners of the 10 to 14 sided halls)
  for (const N of [V.sides, ...Object.keys(SHAPE_Q.sides).map(Number)].filter(n => n >= 16 && n % 4 === 0)) for (let L = 2; L <= 12; L += 2) {
    const d = 2 * ringPoly(N, L), err = Math.abs(d - want) / want;
    cands.push({ N, L, d, score: err + (N === V.sides ? 0 : 0.06) - 0.002 * Math.log(SHAPE_Q.sides[N] || 1) });
  }
  // (never smaller than the stage before's base, so the floor grows every stage)
  const k = +stage[1], lo = k > 2 ? BASE_DIA['s' + (k - 1)] * 1.05 : 7;
  const ok = cands.filter(c => c.d >= lo && c.d >= want * 0.8);
  const best = (ok.length ? ok : cands).sort((a, c) => a.score - c.score)[0];
  return [best.N, best.L];
}
// The cross's half sizes at a stage: its ground floor the base's times the village's scale squared, its long arm over
// its side arms the drawn aspect, its arms' width over its length the drawn arm share; odd metres, with the room the
// stage's stairs, galleries and side rooms need.
function crossSpec(stage, V) {
  const [Wz0, Wx0, D0, SHt, storeys] = CSPEC[stage], k = +stage[1];
  const area = (4 * D0 * (Wz0 + Wx0) - 4 * D0 * D0) * V.size * V.size, a = V.aspect, w = V.arm;
  const odd = v => 2 * Math.round((v - 1) / 2) + 1;
  let Wz = Math.sqrt(area / (4 * (w * (1 + 1 / a) - w * w)));
  let D = Math.max(3, odd(w * Wz)), Wx = odd(Wz / a);
  Wz = odd(Wz);
  if (k >= 3) D = Math.max(D, 5);
  if (k >= 4) { Wz = Math.max(Wz, D + 8); Wx = Math.max(Wx, D + 6); }
  Wx = Math.max(Wx, D + 2);
  Wz = Math.max(Wz, Wx);
  // (never smaller than the stage before)
  if (k > 2) { const [pz, px] = CSPEC['s' + (k - 1)]; Wz = Math.max(Wz, pz + 2); Wx = Math.max(Wx, px); }
  return [Wz, Wx, D, SHt, storeys];
}

// The village's layout (D-155, Tyler 2026-11-11: "the layout and interior decor, etc should be highly varied and dynamic
// and kitbashed such that even same cultural villages have different interior layouts"): one draw per choice from the
// village's lineage, so each choice moves on its own; weights from the corpus measures (hubs.md, hub-gen.md) and the
// culture data (roof style, pitch). sig: the choices, for lab/test_hub_variance.js.
function drawLayout(lineage, cultureKey, C, line, k) {
  const u = name => rngH(hashH(`${lineage}|${cultureKey}|${name}`))();
  const pick = (name, w) => { const e = Object.entries(w).filter(([, v]) => v > 0), t = e.reduce((a, [, v]) => a + v, 0); let x = u(name) * t; for (const [kk, v] of e) if ((x -= v) <= 0) return kk; return e[0][0]; };
  const round = line !== 'cross', style = round ? roundStyle(C) : 'cross';
  const RQ = ROOF_Q[round ? 'round' : 'hall'];
  const KIT = (DecH().KIT || {});
  const V = {
    // the culture's low pitch keeps it in the lower part of the corpus spread
    rise: quant(C.pitch === 26 ? u('rise') * 0.6 : u('rise'), RQ.rise),
    crown: quant(u('crown'), RQ.crown),
    // the high seat: at the far end facing the door (corpus: 74 % of high seats at an end), or at a side
    seat: pick('seat', round ? { far: 3, side: 1 } : { far: 3, near: 1 }),
    seatSide: u('seatSide') < 0.5 ? -1 : 1,
    // raised on a dais (corpus: 7 % of high seats in the ranked set, 32 % in its top tenth), a step, or none
    raise: pick('raise', { dais: 2, step: 2, none: 3 }),
    hearth: pick('hearth', style === 'posts' ? { pit: 4, hearth: 2, long: 1 } : style === 'flat' ? { hearth: 3, pit: 2, long: 1 } : { hearth: 3, long: 2, pit: 2 }),
    tables: pick('tables', !round ? { rows: 4, U: 3, groups: 2, mixed: 1 } : style === 'drum' ? { spokes: 4, ring: 2, groups: 2, mixed: 2 }
      : style === 'posts' ? { ring: 4, groups: 3, spokes: 1, mixed: 1 } : { rugs: 4, groups: 3, ring: 1 }),
    nTables: 3 + Math.floor(u('nTables') * 4),
    // (s5 in the cross: every arm, the front and back arms, or the back arm; the corpus gives no shares for these, so
    // even weights)
    gallery: k === 4 ? pick('gallery', { full: 3, none: 1 }) : round ? 'full' : pick('gallery5', { full: 1, nave: 1, back: 1 }),
    walkway: pick('walkway', { front: 3, side: 2, none: 2 }),
    stairSide: u('stairSide') < 0.5 ? -1 : 1,
    roomSide: u('roomSide') < 0.5 ? -1 : 1,
    rooms: pick('rooms', { two: 3, one: 2 }),
    second: pick('second', { food: 3, closet: 2 }),
    light: pick('light', { piece_walltorch: 3, piece_dvergr_lantern: 1 }),
    banner: (KIT.banner || ['piece_banner01'])[Math.floor(u('banner') * (KIT.banner || [1]).length)],
    rug: pick('rug', { rug_fur: 3, rug_deer: 2, rug_wolf: 1, jute_carpet: 1 }),
    trophyRows: u('trophyRows') < 0.4 ? 3 : 2,
    // the plan's shape (lab/hub_shapes.py spreads, SHAPE_Q): size in the stage's band, the round hall's sides, the cross's
    // proportions, where the side rooms' wall falls, the porch, annexes
    size: sizeScale(u('size'), SHAPE_Q[round ? 'round' : 'hall'].area),
    sides: +pick('sides', Object.fromEntries(Object.entries(SHAPE_Q.sides).filter(([n]) => n >= 16 && n % 4 === 0))),
    aspect: quant(0.1 + 0.8 * u('aspect'), SHAPE_Q.hall.aspect),
    arm: quant(0.25 + 0.5 * u('arm'), SHAPE_Q.hall.arm),
    part: quant(0.1 + 0.8 * u('part'), SHAPE_Q[round ? 'round' : 'hall'].inner),
    porch: pick('porch', SHAPE_Q[round ? 'round' : 'hall'].porch),
    annex: round ? +pick('annex', SHAPE_Q.round.lobes) : 0,
    annexDeep: u('annexDeep') < 0.5 ? 2 : 3,
  };
  if (k === 5 && V.raise === 'none') V.raise = 'step';
  // (a part round's walkway runs along its straight front, where the gallery's opening meets it)
  if (line === 'part') V.walkway = 'front';
  if (V.seat === 'side' && round) V.seatSide = V.stairSide === V.seatSide ? -V.seatSide : V.seatSide;
  V.sig = [V.seat === 'side' ? `seat side ${V.seatSide}` : `seat ${V.seat}`, V.raise, `hearth ${V.hearth}`, `${V.tables} ${V.nTables}`,
    `gallery ${V.gallery}${round ? ' walkway ' + V.walkway : ''}`, `stair ${V.stairSide}`, `rooms ${round ? -V.stairSide : V.roomSide} ${V.rooms} ${V.second}`,
    `size ${V.size.toFixed(2)}`, round ? (line === 'octagon' ? 'sides 8' : `sides ${V.sides}`) : `aspect ${V.aspect.toFixed(2)} arm ${V.arm.toFixed(2)}`, `part ${V.part.toFixed(2)}`, `porch ${V.porch}`, `annex ${V.annex}`].join(', ');
  return V;
}

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
  // the village's draws (D-155: every major choice by the village's seed, weighted by the corpus and the culture data)
  const V = drawLayout(lineage, cultureKey, C, line, k);
  // the village's persona (lib/persona.js): the same traits the village's other buildings read, from its lineage
  const P = PSH().persona({ type: 'hub', biome, culture: cultureKey, seed: lineage, persona: req.persona });
  info.persona = P.label;
  const ext = exteriorOf(has, stage, line, C, V.porch);
  let b, F = {};
  if (k === 1) {
    b = new T.Build(); b.markers = [];
    campDesign(b, K, T, { R, cultureKey, decor, place: placer(b, T), biome });
  } else {
    b = new T.Build(); b.markers = [];
    F = line === 'cross' ? crossHall(b, Kw, C, T, { stage, ext, wallStyle, has, V })
      : roundHall(b, Kw, C, T, { stage, variant: line, ext, wallStyle, has, cultureKey, V });
    info.plan = line; info.roof = line === 'cross' ? 'gable' : F.style === 'flat' ? 'flat' : F.drum ? 'drum' : 'conical';
    if (line !== 'cross') b.notes.push(`${line === 'octagon' ? 'Octagonal' : line === 'part' ? 'Part round' : 'Round'} hall of ${F.N} sides, ${(2 * F.ap).toFixed(1)} m across round the fire.`);
    // posts under what the game would let fall (before the furnishing, so it keeps clear of them)
    // (clear of the fire and of the high seat's place: the back arm's end in a cross hall, the axis behind the fire
    // in a round one)
    // (and the corpus's clear radius round the middle: 2.9 m in halls, 2.6 m in round buildings, lab/hub_posts.py)
    T.propUp(b, Kw, biome, { keepOut: (x, z) => line === 'cross' ? Math.hypot(x, z) < 3 || (z > F.Wz - 3.5 && Math.abs(x) < 2.5) : Math.hypot(x, z) < 2.7 || (z > 0 && z < 6 && Math.abs(x) < 2.2) });
    // a crown's cap the game would drop is left off: the crown stays open for the smoke (a cap on short posts over the
    // top ring of a tall timber cone, Meadows octagon s3)
    if (F.cap && F.cap.length) {
      const shell = b.pieces.filter(p => !p.decor), r = CkH().gameSupport(shell), capSet = new Set(F.cap);
      if (r.fall.some(i => capSet.has(shell[i]))) {
        b.pieces = b.pieces.filter(p => !capSet.has(p));
        b.notes = b.notes.filter(n => !/over the open crown|smoke cap on four posts/.test(n));
        b.notes.push('The crown left open for the smoke (a cap there would not hold).');
      }
    }
    const place = placer(b, T);
    // the notice board in the hearth area (D-140): freestanding outside the main door, and from s4 signs on a wall by
    // the door inside as well
    const d0 = F.door;
    // (beside a covered entrance, before a porch)
    const nbz = d0.z - (F.porch ? 5.6 : k >= 4 ? 2.5 : 3);
    noticeBoard(b, K, d0.x + (k >= 4 && !F.porch ? 4.6 : 3.6), nbz, 0);
    if (k >= 4) noticeWall(b, { x: d0.x - 3, z: d0.z + 0.2, yaw: 0, nx: 0, nz: 1 }, 0.125);
    b.markers.push({ kind: 'path', x: d0.x, y: 0, z: d0.z - (F.porch ? 5 : 2), yaw: 180 });
    furnish(b, Kw, C, T, { stage, line, place, R, has, skipDecor: req.skipDecor, cultureKey, biome, V, lineage, persona: P, decor }, F);
    // the last pass: anything the walk leaves unreached, or standing in a doorway's entry zone, comes out (D-148, D-152)
    for (let t = 0; t < 4 && !req.skipDecor; t++) {
      const r = reachH({ pieces: b.pieces, rooms: b.rooms });
      const bad = new Set([...r.piecesOut, ...r.entry.map(e => `${e.name} ${e.at}`)]);
      if (!bad.size) break;
      const key = p => `${p.name} at ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`, key2 = p => `${p.name} ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`;
      const n0 = b.pieces.length;
      // (with the rest of its set: a station's extension or what stood on it does not stay behind)
      const goneKb = new Set(b.pieces.filter(p => p.kb && (bad.has(key(p)) || bad.has(key2(p)))).map(p => p.kb));
      b.pieces = b.pieces.filter(p => !(p.decor && !p.highSeat && !p.hearth && (bad.has(key(p)) || bad.has(key2(p)) || (p.kb && goneKb.has(p.kb)))));
      if (b.pieces.length === n0) break;
      b.notes.push(`${n0 - b.pieces.length} pieces left out where they would block the way.`);
    }
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
  // steps down from the doors to the ground the game sets the hall on (lib/generate.js doorSteps)
  if (T.doorSteps) T.doorSteps(b);
  const L = b.leader || { x: 0, y: 0, z: 3, yaw: 180 };
  const mk = (m, extra) => ({ kind: 'seat', x: +m.x.toFixed(3), y: +m.y.toFixed(3), z: +m.z.toFixed(3), yaw: Math.round(m.yaw || 0), ...extra });
  const markers = [...b.markers, mk(L, { leader: true })];
  if (b.spouse && b.pieces.some(p => p.spouseSeat)) markers.push(mk(b.spouse, { spouse: true }));
  // the drawn features this line builds (the rest of GRAND has no form in it yet)
  const USED = k === 5 ? ['fires3', 'dais'] : ['dais'];
  info.features = k === 1 ? [] : [...new Set([...USED.filter(f => has(f, stage)), ...Object.keys(ext)])];
  info.top = +topOf(b.pieces).toFixed(1);
  info.mainTop = +topOf(b.pieces.filter(p => !p.crown)).toFixed(1);
  info.layout = V.sig;
  // the plan as built (lab/test_hub_variance.js): its size, the side-room wall, the porch and the annexes
  if (k >= 2) {
    const nAnnex = (b.rooms || []).filter(r => r.annex).length, porch = k < 4 || V.porch === 'none' ? 'none' : ext.porch6 ? 'columns' : 'entrance';
    const wallAt = F.sideX != null ? `side rooms at ${(+F.sideX).toFixed(0)} m` : 'no side rooms';
    info.shape = [line === 'cross' ? `${2 * F.Wx} x ${2 * F.Wz} m, arms ${2 * F.D} m` : `${F.N} sides of ${F.L} m, ${(2 * F.ap).toFixed(1)} m`, wallAt, `porch ${porch}`, `annexes ${nAnnex}`].join('; ');
  }
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

const apiH = { generate, write, lineFor, featureDraw, drawLayout, GRAND, STAGES, LINES, RUG_OVER, ROOF_Q };
if (NODE_H) module.exports = apiH; else window.VHHub = apiH;
