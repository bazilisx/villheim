// Interior kitbash assemblies from the corpus: the small groups of furniture and decor that skilled builders set
// against a wall, in a corner, by a window, round the fire, on and round a table, beside a bed, under the stairs or
// round a post.
//   node --max-old-space-size=8000 lab/mine_kitbash.js [compact.json] [out.json]
// compact.json: [{ file, title, cat, dls, p: [[name, x, y, z, yaw], ...] }] (see lab/learn_critic.js).
//
// For every vanilla build, each decor piece inside a building (a floor under it and a roof or floor over it) is given
// the anchor it belongs to, in this order: a table, a bed, the fire, the underside of a stair, an inside corner (two
// wall faces at any angle: 90 degrees, 135 in an octagon, 120 in a hexagon), a window, a wall run, a free post. Decor is
// any shipped prefab that is not structure, ground or a plant (lib/kitbash.js isDecor): stations, stands, food, feasts,
// pots, Dvergr props and trader goods count. The pieces of one anchor make an assembly (2 to 10 pieces; a long wall run
// is cut where there is a gap). Beams, 1 x 1 floors, half walls, poles and ledges join when something stands on them.
// Each assembly is put in its anchor's frame (metres across and out from the anchor, height over the floor's top, turn
// relative to it), with what each piece rests on, how deep it clips into the others and into the wall, and how far it
// sinks below the floor. Assemblies with the same anchor and the same slots (lib/kitbash.js slotOf) are matched piece to
// piece, mirrored where that fits better; those within 0.35 m on average are one assembly. Each is scored by the
// well-liked builds it shows in (the top quarter by downloads among vanilla builds) and a quarter point for each other
// build; a build counts once. Groups of three or more seen once in a well-liked build are kept too ('once').
const fs = require('fs'), path = require('path');
const P = require('../lib/pieces.js'), SHP = require('../lib/shapes.js'), Ck = require('../lib/checks.js'), KB = require('../lib/kitbash.js');

const src = process.argv[2] || '/home/claude/study/compact.json';
const out = process.argv[3] || path.join(__dirname, '../data/kitbash-interior.json');
const MOD = /^(kg_|GB_|CastleKit|MB|mm_|BBH|rk_|Piece_vf|OdinsKingdom|h_|\$|Hayze|rae_|teq_|tkd_|rkc_)/;
const BIOMES = P.BIOME_ORDER;

const all = JSON.parse(fs.readFileSync(src, 'utf8'));
const vanilla = all.filter(d => d.p && d.p.length >= 20 && !d.p.some(p => MOD.test(p[0]))).slice(0, +(process.env.KB_LIMIT || 1e9));
const ranked = vanilla.filter(d => d.dls > 0).sort((a, b) => b.dls - a.dls);
const liked = new Set(ranked.slice(0, Math.ceil(ranked.length / 4)).map(d => d.file));
console.log(`${vanilla.length} vanilla builds, ${liked.size} well-liked`);

// what kind of building a build is, from its title, file and category
const KINDS = [
  ['tavern', /tavern|\binn\b|pub\b|\bbar\b|brew|mead ?hall/i], ['smithy', /smith|forge|anvil/i], ['temple', /temple|shrine|church|chapel|altar/i],
  ['hall', /longhouse|long ?house|great ?hall|jarl|chieftain|\bhall\b/i], ['storage', /storage|warehouse|store ?room|granary|stash/i],
  ['workshop', /workshop|crafting|craft room|workbench/i], ['barn', /barn|stable|farm/i], ['kitchen', /kitchen|bakery|cook/i],
  ['home', /house|home|cabin|cottage|\bhut\b|starter|bedroom|dwelling|homestead|interior/i]];
const kindOf = d => { const t = `${d.title || ''} ${d.file || ''} ${d.cat || ''}`; const k = KINDS.find(([, re]) => re.test(t)); return k ? k[0] : 'any'; };

const quat = yaw => { const a = yaw * Math.PI / 360; return [0, +Math.sin(a).toFixed(6), 0, +Math.cos(a).toFixed(6)]; };
const norm = a => ((a % 360) + 360) % 360;
const TABLE = /^(piece_table|piece_table_round|piece_table_oak|piece_blackmarble_table|dvergrprops_table|piece_table_runed|piece_table_runed_small|mountainkit_table)$/;
const BED = /^(bed|piece_bed02|ashwood_bed|dvergrprops_bed)$/;
const FIRE = /^(hearth|fire_pit|fire_pit_iron|fire_pit_hildir)$/;
const OVER = new Set(['roof', 'roofTop', 'roofCorner', 'floor']);
const akind = n => (/round/.test(n) ? 'round' : /oak|blackmarble_table/.test(n) ? 'long' : TABLE.test(n) ? 'table' : /bed02|dvergrprops_bed/.test(n) ? 'bed2' : BED.test(n) ? 'bed' : /hearth/.test(n) ? 'hearth' : /stair/.test(n) ? 'stair' : /fire/.test(n) ? 'pit' : 'post');
const isBuilt = name => KB.BUILT_SLOTS.includes(KB.slotOf(name));

// a piece's solids in its own frame: x from x0 to x1, z from z0 to z1 (walls run along x and are z thick)
const LOC = new Map();
function extent(name) {
  if (LOC.has(name)) return LOC.get(name);
  const L = SHP.local(name);
  let e;
  if (L && L.length) {
    e = [Infinity, -Infinity, Infinity, -Infinity];
    for (const o of L) for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const x = o.c[0] + sx * o.a[0][0] * o.h[0] + sy * o.a[1][0] * o.h[1] + sz * o.a[2][0] * o.h[2];
      const z = o.c[2] + sx * o.a[0][2] * o.h[0] + sy * o.a[1][2] * o.h[1] + sz * o.a[2][2] * o.h[2];
      e[0] = Math.min(e[0], x); e[1] = Math.max(e[1], x); e[2] = Math.min(e[2], z); e[3] = Math.max(e[3], z);
    }
  } else { const s = P.piece(name).size; e = [-s[0] / 2, s[0] / 2, -s[2] / 2, s[2] / 2]; }
  LOC.set(name, e);
  return e;
}

// what each decor prefab is used for: builds, well-liked builds, pieces, anchors and rests
const USE = new Map();
const use = n => { if (!USE.has(n)) USE.set(n, { builds: new Set(), liked: 0, n: 0, anchors: {}, rests: {}, clips: [], sinks: [] }); return USE.get(n); };

function mine(d) {
  const ps = d.p.map(([name, x, y, z, yaw]) => ({ name, x, y, z, yaw: norm(yaw || 0), q: quat(yaw || 0) }));
  const bx = ps.map(p => Ck.aabb(p));
  const near = Ck.index(bx);
  const role = i => bx[i].info.role;
  const around = (x, z, r, y0, y1) => [...near({ x0: x - r, x1: x + r, z0: z - r, z1: z + r }, 0)].filter(j => bx[j].y1 > y0 && bx[j].y0 < y1);
  const cx = i => (bx[i].x0 + bx[i].x1) / 2, cz = i => (bx[i].z0 + bx[i].z1) / 2;
  const covers = (j, x, z, e = 0) => bx[j].x0 - e <= x && bx[j].x1 + e >= x && bx[j].z0 - e <= z && bx[j].z1 + e >= z;
  // the top of the floor under a point at this height (null: no floor)
  const floorTop = (x, z, y) => {
    let t = null;
    for (const j of around(x, z, 0.05, y - 4, y + 0.6)) if (role(j) === 'floor' && covers(j, x, z) && bx[j].y1 <= y + 0.5 && (t == null || bx[j].y1 > t)) t = bx[j].y1;
    return t;
  };
  const roofed = (x, z, ft) => around(x, z, 0.05, ft + 1.5, ft + 15).some(j => OVER.has(role(j)) && covers(j, x, z) && bx[j].y0 > ft + 1.5);
  const isWall = j => ['wall', 'window', 'door'].includes(role(j)) && bx[j].y1 - bx[j].y0 > 0.9;
  // wall faces within reach of a point: inward normal N, plane N . p = o, and the pieces in it
  const faces = (x, z, ft, reach) => {
    const F = new Map();
    for (const j of around(x, z, reach + 2.2, ft + 0.5, ft + 1.6)) {
      if (!isWall(j)) continue;
      const p = ps[j], a = p.yaw * Math.PI / 180, ux = Math.cos(a), uz = -Math.sin(a), nx = Math.sin(a), nz = Math.cos(a);
      const e = extent(p.name), lx = (x - p.x) * ux + (z - p.z) * uz, lz = (x - p.x) * nx + (z - p.z) * nz;
      if (lx < e[0] - 0.5 || lx > e[1] + 0.5) continue;
      const side = lz >= 0 ? 1 : -1, face = side > 0 ? e[3] : -e[2], dist = Math.abs(lz) - face;
      if (dist < -0.3 || dist > reach) continue;
      const N = [nx * side, nz * side], o = p.x * N[0] + p.z * N[1] + face;
      const key = `${Math.round(norm(Math.atan2(N[0], N[1]) * 180 / Math.PI) / 3)}|${Math.round(o * 5)}`;
      if (!F.has(key)) F.set(key, { N, o, walls: [], key });
      F.get(key).walls.push(j);
    }
    return [...F.values()].map(f => ({ ...f, dist: x * f.N[0] + z * f.N[1] - f.o }));
  };
  // an opening in a face at window height over a stretch: a window piece, or wall below and above with none between
  const windowIn = (f, lo, hi, ft) => {
    const ux = -f.N[1], uz = f.N[0];
    for (let t = lo; t <= hi + 0.01; t += 0.5) {
      const x = ux * t + f.N[0] * (f.o - 0.15), z = uz * t + f.N[1] * (f.o - 0.15);
      const here = around(x, z, 0.2, ft - 0.2, ft + 3).filter(j => covers(j, x, z, 0.12));
      if (here.some(j => role(j) === 'window' || /crystal|glass|window/.test(ps[j].name))) return true;
      const at = h => here.some(j => ['wall', 'window'].includes(role(j)) && bx[j].y0 <= ft + h && bx[j].y1 >= ft + h);
      if (at(0.4) && !at(1.5) && at(2.4)) return true;
    }
    return false;
  };
  const tables = [], beds = [], fires = [], stairs = [], poles = [];
  ps.forEach((p, i) => {
    if (TABLE.test(p.name)) tables.push(i); else if (BED.test(p.name)) beds.push(i); else if (FIRE.test(p.name)) fires.push(i);
    else if (role(i) === 'stair' && /stair/i.test(p.name) && !/spiral|ladder/i.test(p.name)) stairs.push(i);
    else if (role(i) === 'pole' && bx[i].y1 - bx[i].y0 >= 1.8 && bx[i].x1 - bx[i].x0 < 0.6 && bx[i].z1 - bx[i].z0 < 0.6) poles.push(i);
  });
  const groups = new Map();
  const add = (key, info, i) => { if (!groups.has(key)) groups.set(key, { ...info, items: [] }); groups.get(key).items.push(i); };
  ps.forEach((p, i) => {
    if (!KB.isDecor(p.name)) return;
    if (TABLE.test(p.name) || BED.test(p.name) || FIRE.test(p.name)) return; // anchors themselves
    const x = cx(i), z = cz(i);
    const ft = floorTop(x, z, bx[i].y0 + 0.05);
    if (ft == null || bx[i].y0 > ft + 3 || !roofed(x, z, ft)) return;
    const level = Math.round(ft * 4);
    const inBox = (j, e) => covers(j, x, z, e) && bx[j].y0 < ft + 0.5 && bx[j].y0 > ft - 0.4 && bx[i].y0 < bx[j].y1 + 0.6;
    let j = tables.find(t => inBox(t, 0.9));
    if (j != null) return add(`t${j}`, { anchor: 'table', at: j, ft }, i);
    j = beds.find(t => inBox(t, 0.8));
    if (j != null) return add(`b${j}`, { anchor: 'bed', at: j, ft }, i);
    j = fires.find(t => Math.hypot(cx(t) - x, cz(t) - z) <= Math.max(bx[t].x1 - bx[t].x0, bx[t].z1 - bx[t].z0) / 2 + 1.8 && Math.abs(bx[t].y0 - ft) < 0.6);
    if (j != null) return add(`f${j}`, { anchor: 'hearth', at: j, ft }, i);
    j = stairs.find(s => covers(s, x, z, -0.1) && bx[s].y0 >= bx[i].y1 - 0.05 && bx[s].y0 < ft + 3.5 && bx[s].y0 > ft + 0.5);
    if (j != null) return add(`s${j}`, { anchor: 'stair', at: j, ft }, i);
    const fs0 = faces(x, z, ft, 1.6).sort((a, b) => a.dist - b.dist);
    if (fs0.length) {
      const f1 = fs0[0];
      for (const f2 of fs0.slice(1)) {
        const cos = f1.N[0] * f2.N[0] + f1.N[1] * f2.N[1], ang = Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
        if (ang < 25 || ang > 120) continue;
        const det = f1.N[0] * f2.N[1] - f1.N[1] * f2.N[0];
        const Ox = (f1.o * f2.N[1] - f2.o * f1.N[1]) / det, Oz = (f1.N[0] * f2.o - f2.N[0] * f1.o) / det;
        if (Math.hypot(Ox - x, Oz - z) > 2.2) continue;
        const k = [f1.key, f2.key].sort().join('/');
        return add(`c${k}|${level}`, { anchor: 'corner', faces: [f1, f2], O: [Ox, Oz], angle: Math.round(180 - ang), ft }, i);
      }
      if (f1.dist <= 1.3) return add(`w${f1.key}|${level}`, { anchor: 'wall', faces: [f1], ft }, i);
    }
    j = poles.find(t => Math.hypot(cx(t) - x, cz(t) - z) < 1.0 && bx[t].y0 < ft + 0.3 && bx[t].y0 > ft - 1.2 &&
      !around(cx(t), cz(t), 0.3, ft + 0.5, ft + 1.5).some(w => isWall(w) && covers(w, cx(t), cz(t), 0.25)));
    if (j != null) return add(`p${j}`, { anchor: 'post', at: j, ft }, i);
  });
  // a wall run is cut where there is a gap of 0.8 m or more along it, and no assembly is longer than 3 m
  const list = [];
  for (const g of groups.values()) {
    if (g.anchor !== 'wall') { list.push(g); continue; }
    const f = g.faces[0], ux = -f.N[1], uz = f.N[0];
    const span = i => { const s = [bx[i].x0 * ux, bx[i].x1 * ux].sort((a, b) => a - b), t = [bx[i].z0 * uz, bx[i].z1 * uz].sort((a, b) => a - b); return [s[0] + t[0], s[1] + t[1]]; };
    const its = g.items.map(i => ({ i, s: span(i) })).sort((a, b) => a.s[0] - b.s[0]);
    let cur = null;
    for (const it of its) {
      if (cur && it.s[0] < cur.hi + 0.8 && it.s[1] - cur.lo <= 3) { cur.items.push(it.i); cur.hi = Math.max(cur.hi, it.s[1]); continue; }
      cur = { ...g, items: [it.i], lo: it.s[0], hi: it.s[1] };
      list.push(cur);
    }
  }
  const res = [];
  for (const g of list) {
    let items = g.items.slice();
    // the frame: origin and turn (local +z points out of the wall, or the anchor's own +z)
    let ox, oz, fyaw;
    const extra = {};
    if (g.anchor === 'wall') {
      const f = g.faces[0], ux = -f.N[1], uz = f.N[0];
      const along = items.map(i => cx(i) * ux + cz(i) * uz), mid = (Math.min(...along) + Math.max(...along)) / 2;
      ox = ux * mid + f.N[0] * f.o; oz = uz * mid + f.N[1] * f.o; fyaw = Math.atan2(f.N[0], f.N[1]) * 180 / Math.PI;
      if (windowIn(f, g.lo - 0.3, g.hi + 0.3, g.ft)) g.anchor = 'window';
    } else if (g.anchor === 'corner') {
      const [f1, f2] = g.faces, bxv = f1.N[0] + f2.N[0], bzv = f1.N[1] + f2.N[1];
      [ox, oz] = g.O; fyaw = Math.atan2(bxv, bzv) * 180 / Math.PI;
      extra.angle = g.angle;
    } else if (g.anchor === 'hearth' || g.anchor === 'post') {
      ox = cx(g.at); oz = cz(g.at);
      const mx = items.reduce((s, i) => s + cx(i), 0) / items.length - ox, mz = items.reduce((s, i) => s + cz(i), 0) / items.length - oz;
      fyaw = Math.hypot(mx, mz) > 0.2 ? Math.atan2(mx, mz) * 180 / Math.PI : ps[g.at].yaw;
    } else { ox = ps[g.at].x; oz = ps[g.at].z; fyaw = ps[g.at].yaw; }
    if (g.at != null) extra.of = ps[g.at].name;
    const a = fyaw * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const loc = p => { const dx = p.x - ox, dz = p.z - oz; return [dx * c - dz * s, dx * s + dz * c]; };
    // what each piece rests on; building pieces that carry one join the assembly
    const rests = new Map();
    const restOf = i => {
      const b = bx[i];
      if (Math.abs(b.y0 - g.ft) < 0.12 || (b.pass && Math.abs(ps[i].y - g.ft) < 0.12)) return { rest: 'floor' };
      if (b.y0 < g.ft - 0.02 && b.y1 > g.ft + 0.05 && b.y0 > g.ft - 0.8) return { rest: 'floor' }; // sunk into the floor
      const x = cx(i), z = cz(i);
      if (g.at != null && g.anchor !== 'hearth' && g.anchor !== 'post' && covers(g.at, x, z) && Math.abs(b.y0 - bx[g.at].y1) < 0.15) return { rest: 'anchor' };
      for (const j of items) if (j !== i && covers(j, x, z) && Math.abs(b.y0 - bx[j].y1) < 0.12 && bx[j].y1 - bx[j].y0 > 0.04) return { rest: 'on', on: j };
      for (const j of around(x, z, 0.05, b.y0 - 0.3, b.y0 + 0.1)) {
        if (j === i || !isBuilt(ps[j].name) || !covers(j, x, z) || Math.abs(b.y0 - bx[j].y1) > 0.12 || bx[j].y1 < g.ft + 0.3) continue;
        if (!items.includes(j)) items.push(j);
        return { rest: 'on', on: j };
      }
      // against a wall at its height (hung on it, or a shelf beam clipped into it)
      for (const j of around(x, z, 1.2, b.y0 - 0.1, b.y1 + 0.1)) if (isWall(j) && b.x0 <= bx[j].x1 + 0.3 && bx[j].x0 <= b.x1 + 0.3 && b.z0 <= bx[j].z1 + 0.3 && bx[j].z0 <= b.z1 + 0.3) return { rest: 'wall' };
      for (const j of around(x, z, 0.3, b.y1 - 0.05, b.y1 + 0.4)) if (j !== i && P.piece(ps[j].name).structural && covers(j, x, z, 0.1) && bx[j].y0 >= b.y1 - 0.1) return { rest: 'hang' };
      return null;
    };
    for (let k = 0; k < items.length; k++) { const r = restOf(items[k]); if (r) rests.set(items[k], r); }
    // a built piece joins only when something rests on it; it rests on the floor, the wall or another piece
    for (const i of items) if (isBuilt(ps[i].name) && !rests.has(i)) rests.set(i, { rest: Math.abs(bx[i].y0 - g.ft) < 0.3 ? 'floor' : 'wall' });
    items = items.filter(i => rests.has(i));
    if (items.length < 2 || items.length > 10) continue;
    // a built piece alone with what stands on it is a shelf; the rest must hold furniture or decor too
    if (items.every(i => isBuilt(ps[i].name))) continue;
    const members = items.map(i => {
      const p = ps[i], [lx, lz] = loc(p), r = rests.get(i);
      const m = { n: p.name, k: KB.slotOf(p.name), x: +lx.toFixed(3), y: +(p.y - g.ft).toFixed(3), z: +lz.toFixed(3), yaw: Math.round(norm(p.yaw - fyaw)), rest: r.rest };
      if (r.rest === 'on') m.on = items.indexOf(r.on);
      const sink = g.ft - bx[i].y0;
      if (sink > 0.02 && r.rest === 'floor') m.sink = +sink.toFixed(3);
      return m;
    });
    if (members.some(m => m.rest === 'on' && m.on < 0)) continue;
    // clips: how deep each piece reaches into the others, the anchor and the wall
    const clips = [];
    for (let u = 0; u < items.length; u++) {
      for (let v = u + 1; v < items.length; v++) { const dd = SHP.clipDepth(bx[items[u]].sol, bx[items[v]].sol); if (dd > 0.01) clips.push([u, v, +dd.toFixed(3)]); }
      if (g.at != null) { const dd = SHP.clipDepth(bx[items[u]].sol, bx[g.at].sol); if (dd > 0.01) clips.push([u, 'a', +dd.toFixed(3)]); }
      let dw = 0;
      const ws = new Set();
      for (const f of g.faces || []) for (const w of f.walls) ws.add(w);
      for (const w of around(cx(items[u]), cz(items[u]), 1.5, bx[items[u]].y0, bx[items[u]].y1)) if (isWall(w)) ws.add(w);
      for (const w of ws) dw = Math.max(dw, SHP.clipDepth(bx[items[u]].sol, bx[w].sol));
      if (dw > 0.01) clips.push([u, 'w', +dw.toFixed(3)]);
    }
    const r = { anchor: g.anchor, members, clips, ...extra };
    if (g.at != null) r.akind = akind(ps[g.at].name);
    res.push(r);
  }
  return res;
}

// ---------------------------------------------------------------- matching
const angleBucket = a => [90, 120, 135].find(t => Math.abs(a - t) <= 8) || Math.round(a / 15) * 15;
const sig = r => `${r.anchor}|${r.anchor === 'corner' ? angleBucket(r.angle) : ''}|${r.akind || ''}|${r.members.map(m => m.k).sort().join(',')}`;
// the frame's symmetries: a mirror across the frame's z axis for every anchor, across x too for tables, turns of 90
// degrees round a round table
const mir = (ms, sx, sz, turn = 0) => ms.map(m => {
  let x = m.x * sx, z = m.z * sz, yaw = m.yaw;
  if (sx < 0) yaw = -yaw;
  if (sz < 0) yaw = 180 - yaw;
  for (let t = 0; t < turn; t++) { const x2 = z, z2 = -x; x = x2; z = z2; yaw += 90; }
  return { ...m, x, z, yaw: norm(yaw) };
});
function variants(r) {
  const v = [r.members, mir(r.members, -1, 1)];
  if (r.anchor === 'table') { v.push(mir(r.members, 1, -1), mir(r.members, -1, -1)); if (r.akind === 'round') for (let t = 1; t < 4; t++) v.push(mir(r.members, 1, 1, t)); }
  return v;
}
function distance(A, B) {
  const used = new Set();
  let sum = 0, max = 0;
  for (const a of A) {
    let best = null, bd = Infinity;
    B.forEach((b, j) => {
      if (used.has(j) || b.k !== a.k) return;
      const dy = Math.abs(norm(a.yaw - b.yaw + 180) - 180);
      const dd = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) + (a.k === 'rug' ? Math.min(dy, 180 - dy) : dy) * 0.002;
      if (dd < bd) { bd = dd; best = j; }
    });
    if (best == null) return Infinity;
    used.add(best); sum += bd; max = Math.max(max, bd);
  }
  return max > 0.7 ? Infinity : sum / A.length;
}

const t0 = Date.now();
const bySig = new Map();
let nInst = 0, nb = 0;
const anchorsSeen = {};
const order = vanilla.slice().sort((a, b) => (liked.has(b.file) ? 1 : 0) - (liked.has(a.file) ? 1 : 0) || (b.dls || 0) - (a.dls || 0));
for (const d of order) {
  nb++;
  if (d.p.length > 12000) continue;
  let res;
  try { res = mine(d); } catch (e) { console.error(d.file, e.message); continue; }
  const kind = kindOf(d), isLiked = liked.has(d.file);
  for (const r of res) {
    nInst++;
    const bk = r.anchor === 'corner' ? `corner ${[90, 120, 135].find(t => Math.abs(r.angle - t) <= 8) || 'other'}` : r.anchor;
    anchorsSeen[bk] = (anchorsSeen[bk] || 0) + 1;
    r.members.forEach((m, mi) => {
      const u = use(m.n);
      if (!u.builds.has(d.file)) { u.builds.add(d.file); if (isLiked) u.liked++; }
      u.n++;
      u.anchors[r.anchor] = (u.anchors[r.anchor] || 0) + 1;
      u.rests[m.rest] = (u.rests[m.rest] || 0) + 1;
      if (m.sink) u.sinks.push(m.sink);
      for (const c of r.clips) if (c[0] === mi || c[1] === mi) u.clips.push(c[2]);
    });
    const key = sig(r);
    if (!bySig.has(key)) bySig.set(key, []);
    const cl = bySig.get(key);
    let home = null;
    for (const c of cl) if (variants(r).some(v => distance(c.lead.members, v) <= 0.35)) { home = c; break; }
    if (!home) { home = { lead: r, leadFile: d.file, builds: new Set(), liked: new Set(), kinds: {}, n: 0 }; cl.push(home); }
    home.n++;
    if (!home.builds.has(d.file)) { home.builds.add(d.file); home.kinds[kind] = (home.kinds[kind] || 0) + 1; }
    if (isLiked) home.liked.add(d.file);
  }
  if (nb % 200 === 0) console.log(`${nb} builds, ${nInst} assemblies, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

// ---------------------------------------------------------------- the library
// the earliest biome a piece's own materials allow; minor decor goes anywhere (D-066)
const fb = n => (P.minor(n) ? 0 : Math.max(0, BIOMES.indexOf(P.needs(n))));
// room kinds from what an assembly holds, besides the builds it came from
const CONTENT = { fermenter: ['tavern', 'kitchen', 'storage'], ArmorStand: ['home', 'hall', 'smithy'], crate: ['storage', 'workshop', 'tavern', 'kitchen'],
  barrel: ['storage', 'tavern', 'kitchen', 'smithy', 'workshop'], food: ['tavern', 'kitchen', 'hall', 'home'], feast: ['hall', 'tavern', 'kitchen'],
  piece_cauldron: ['kitchen', 'home', 'tavern'], forge: ['smithy'], piece_workbench: ['workshop', 'smithy'], pot: ['kitchen', 'home', 'tavern'] };
const med = v => { if (!v.length) return 0; const s = v.slice().sort((a, b) => a - b); return +s[Math.floor(s.length / 2)].toFixed(3); };
const q90 = v => { if (!v.length) return 0; const s = v.slice().sort((a, b) => a - b); return +s[Math.min(s.length - 1, Math.floor(s.length * 0.9))].toFixed(3); };
const lib = [];
for (const [key, cl] of bySig) for (const c of cl) {
  const nb2 = c.builds.size, nl = c.liked.size;
  const r = c.lead;
  // repeated in two builds or more; or, from a well-liked build, a group of three or more seen once (the compositions
  // the best builders make for one room rarely repeat exactly)
  // (three kinds or more, none over half the group: a stack of chairs or a heap of skulls is trim, not a composition)
  const kinds = {};
  for (const m of r.members) kinds[m.k] = (kinds[m.k] || 0) + 1;
  const once = nb2 === 1 && nl === 1 && r.members.length >= 3 && Object.keys(kinds).length >= 3 && Math.max(...Object.values(kinds)) <= r.members.length / 2;
  if (!once && (nb2 < 2 || (nl < 1 && nb2 < 3))) continue;
  const rooms = Object.entries(c.kinds).sort((a, b) => b[1] - a[1]).map(([k]) => k).filter(k => k !== 'any');
  for (const m of r.members) for (const k of CONTENT[m.k] || CONTENT[m.n] || []) if (!rooms.includes(k)) rooms.push(k);
  if (r.anchor === 'bed') for (const k of ['home', 'sleeping']) if (!rooms.includes(k)) rooms.push(k);
  if (!rooms.length) rooms.push('any');
  const maxClip = r.clips.reduce((m, cl2) => Math.max(m, cl2[2]), 0);
  lib.push({
    key, anchor: r.anchor, angle: r.angle, of: r.akind, slots: r.members.map(m => m.k),
    pieces: r.members, clips: r.clips, maxClip: +maxClip.toFixed(3),
    biome: BIOMES[Math.max(...r.members.map(m => fb(m.n)))], rooms,
    builds: nb2, liked: nl, seen: c.n, score: +(once ? 0.4 + 0.02 * r.members.length : nl + 0.25 * (nb2 - nl)).toFixed(2), ...(once ? { once: true } : {}), src: [c.leadFile, ...[...c.builds].filter(f => f !== c.leadFile).slice(0, 4)],
  });
}
lib.sort((a, b) => b.score - a.score);
// keep the best of each anchor (corners by angle), so one kind cannot crowd out the rest
const bucket = a => (a.anchor === 'corner' ? `corner ${[90, 120, 135].find(t => Math.abs(a.angle - t) <= 8) || 'other'}` : a.anchor);
const counts = {}, kept = [];
for (const a of lib) {
  const k = bucket(a);
  if ((counts[k] || 0) >= 100) continue;
  counts[k] = (counts[k] || 0) + 1;
  kept.push(a);
}
kept.forEach((a, i) => { a.id = `KB-${String(i + 1).padStart(3, '0')}`; delete a.key; });
// the decor table: every decor prefab, how often and where builders use it, and how deep they clip or sink it
const decor = [...USE.entries()].map(([n, u]) => ({ n, role: P.piece(n).role, slot: KB.slotOf(n), builds: u.builds.size, liked: u.liked, pieces: u.n,
  anchors: u.anchors, rests: u.rests, clip: med(u.clips), clip90: q90(u.clips), sink: med(u.sinks), sink90: q90(u.sinks), minor: P.minor(n) }))
  .filter(x => x.builds >= 2).sort((a, b) => b.builds - a.builds);
const doc = {
  about: 'Interior assemblies mined from the corpus by lab/mine_kitbash.js: pieces in the anchor\'s frame (x across, z out from the wall or anchor, y over the floor\'s top, yaw relative), what each rests on (floor, anchor, on: another piece, wall, hang), how far it sinks below the floor, clips [piece, piece or a (anchor) or w (wall), depth in metres], earliest biome by materials (minor decor anywhere), room kinds, builds and well-liked builds it shows in. decor: each decor prefab with its builds, anchors, rests and clip and sink depths (median and 90th percentile).',
  builds: vanilla.length, liked: liked.size, instances: nInst, anchors: anchorsSeen, counts, assemblies: kept, decor,
};
fs.writeFileSync(out, JSON.stringify(doc, null, 0).replace(/\{"id"/g, '\n{"id"').replace(/\{"n":"([^"]+)","role"/g, '\n{"n":"$1","role"'));
console.log(`${nInst} assemblies in ${vanilla.length} builds -> ${lib.length} repeated, ${kept.length} kept`, counts, anchorsSeen, `${decor.length} decor prefabs`, `${((Date.now() - t0) / 1000).toFixed(0)} s`);
