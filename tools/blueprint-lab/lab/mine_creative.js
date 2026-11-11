// Combined and clipped objects from the corpus: the small groups of pieces builders set into, onto or against each
// other inside a room so they read as one thing (a chest set into a half wall as a cabinet, a pot on a beam shelf, a
// helmet stand on a chair, two chests stacked into a dresser, a sign hung on a chest as its label).
//   node --max-old-space-size=8000 lab/mine_creative.js <compact.json | folder of .blueprint> [out.json]
// compact.json: [{ file, title, cat, dls, p: [[name, x, y, z, yaw], ...] }] (lab/learn_critic.js). A folder is read
// with lib/blueprint.js; pieces turned off the vertical axis are left out (the fitter only turns pieces round y).
//
// lab/mine_kitbash.js groups the pieces round one anchor by slot (any chest, any bench) and keeps what repeats. This
// one keeps each piece's own prefab and looks for contact instead: decor pieces and small building pieces inside a
// room (a floor under them, a roof or floor over them) are joined when their solids touch or clip (lib/shapes.js), and
// a group counts as one object when something in it rests on another member, two members clip 3 cm or more into each
// other, or a building piece carries or frames the rest. Rugs join only other rugs (a layered rug), so a rug under a
// table does not tie the whole room together. A table, bed or fire in a group is its anchor; otherwise the group gets
// the anchor its middle is nearest (stair underside, corner, window, wall, post, or the free floor). Each member is
// put in the anchor's frame with its exact prefab (k is the prefab itself), what it rests on, its sink and its clip
// depth into every other member and into the wall. Groups with the same anchor and the same prefabs within 0.35 m are
// one; each keeps its source builds for credit.
const fs = require('fs'), path = require('path');
const P = require('../lib/pieces.js'), SHP = require('../lib/shapes.js'), Ck = require('../lib/checks.js'), KB = require('../lib/kitbash.js');
const BP = require('../lib/blueprint.js');
// VH_SHAPES=coarse|fine: contact and clip depths are read from what shows (lab/shape_mode.js); unset, from the colliders as before
const SM = require('./shape_mode.js');

const MOD = /^(kg_|GB_|CastleKit|MB|mm_|BBH|rk_|Piece_vf|OdinsKingdom|h_|\$|Hayze|rae_|teq_|tkd_|rkc_)/;
// small building pieces that may stand in as furniture (D-065): beams as shelves, half walls as cabinet backs, poles
// as posts, ledges, 1 x 1 floors as tops, fences as rails, short roof pieces as awnings and hoods, stair pieces as steps
const BUILT_EXTRA = /^(wood|darkwood|ashwood|woodiron|stone|blackmarble|grausten|crystal)_(beam|beam_1|beam_26|beam_45|beam_2m|beam_1m|pole|pole2|pole_1m|pole_2m|wall_half|wall_quarter|ledge|floor_1x1|fence|roof|roof_45|stair|log|arch|wall_1x1)$|^wood_ledge$|^piece_(sharpstakes|stakewall)$|^wood_(log_\d+|pole_log|pole_log_4)$/;

const yawOf = q => { const [x, y, z, w] = q; return ((Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + x * x)) * 180 / Math.PI) % 360 + 360) % 360; };
const tilted = q => Math.hypot(q[0], q[2]) > 0.02;
const norm = a => ((a % 360) + 360) % 360;
const quat = yaw => { const a = yaw * Math.PI / 360; return [0, +Math.sin(a).toFixed(6), 0, +Math.cos(a).toFixed(6)]; };

// A folder is read with its subfolders (folders starting with _ left out). An index.json beside the builds (the
// valheimians download index: slug, title, by, dls) gives each build its title, maker and downloads by the file name's
// slug (the part before '__'); without one every build counts as liked (Tyler's board). The same build saved twice
// counts once.
function load(src) {
  if (fs.statSync(src).isDirectory()) {
    const files = [];
    const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) { if (!e.name.startsWith('_')) walk(path.join(d, e.name)); } else if (e.name.endsWith('.blueprint')) files.push(path.join(d, e.name));
    } };
    walk(src);
    const idxFile = path.join(src, 'index.json');
    const index = fs.existsSync(idxFile) ? new Map(JSON.parse(fs.readFileSync(idxFile, 'utf8')).map(r => [r.slug, r])) : null;
    // read one build at a time (the corpus is about 440 MB of text)
    const one = f => {
      let d;
      try { d = BP.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; }
      if (!d.pieces.length) return null;
      const base = path.basename(f, '.blueprint'), slug = base.split('__')[0], r = index && index.get(slug);
      return { file: path.relative(src, f), title: (r && r.title) || d.meta.Name || base, by: r ? r.by : d.meta.Creator || '', slug, cat: (r && r.cat) || d.meta.Category || '',
        dls: r ? +r.dls || 0 : 0, board: !index, n: d.pieces.length, p: d.pieces.map(p => [p.name, p.x, p.y, p.z, yawOf(p.q), tilted(p.q) ? 1 : 0]) };
    };
    return { lazy: true, files: files.sort(), one };
  }
  return JSON.parse(fs.readFileSync(src, 'utf8'));
}

const isBuilt = n => KB.BUILT_SLOTS.includes(KB.slotOf(n)) || BUILT_EXTRA.test(n);
const TABLE = /^(piece_table|piece_table_round|piece_table_oak|piece_blackmarble_table|dvergrprops_table|piece_table_runed|piece_table_runed_small|mountainkit_table)$/;
const BED = /^(bed|piece_bed02|ashwood_bed|dvergrprops_bed)$/;
const FIRE = /^(hearth|fire_pit|fire_pit_iron|fire_pit_hildir)$/;
const OVER = new Set(['roof', 'roofTop', 'roofCorner', 'floor']);
const akind = n => (/round/.test(n) ? 'round' : /oak|blackmarble_table/.test(n) ? 'long' : TABLE.test(n) ? 'table' : /bed02|dvergrprops_bed/.test(n) ? 'bed2' : BED.test(n) ? 'bed' : /hearth/.test(n) ? 'hearth' : /fire/.test(n) ? 'pit' : 'post');

function mine(d) {
  const ps = d.p.map(([name, x, y, z, yaw, tl]) => ({ name, x, y, z, yaw: norm(yaw || 0), q: quat(yaw || 0), tl: !!tl }));
  const bx = ps.map(p => Ck.aabb(p));
  const shown = i => (SM.MODE && bx[i].sol ? SM.parts(ps[i]) : bx[i].sol);
  const near = Ck.index(bx);
  const role = i => bx[i].info.role;
  const around = (x, z, r, y0, y1) => [...near({ x0: x - r, x1: x + r, z0: z - r, z1: z + r }, 0)].filter(j => bx[j].y1 > y0 && bx[j].y0 < y1);
  const cx = i => (bx[i].x0 + bx[i].x1) / 2, cz = i => (bx[i].z0 + bx[i].z1) / 2;
  const covers = (j, x, z, e = 0) => bx[j].x0 - e <= x && bx[j].x1 + e >= x && bx[j].z0 - e <= z && bx[j].z1 + e >= z;
  const floorTop = (x, z, y) => {
    let t = null;
    for (const j of around(x, z, 0.05, y - 4, y + 0.6)) if (role(j) === 'floor' && covers(j, x, z) && bx[j].y1 <= y + 0.5 && (t == null || bx[j].y1 > t)) t = bx[j].y1;
    return t;
  };
  const roofed = (x, z, ft) => around(x, z, 0.05, ft + 1.5, ft + 15).some(j => OVER.has(role(j)) && covers(j, x, z) && bx[j].y0 > ft + 1.5);
  const isWall = j => ['wall', 'window', 'door'].includes(role(j)) && bx[j].y1 - bx[j].y0 > 1.5;
  const extent = name => { const L = SHP.local(name); if (!L || !L.length) { const s = P.piece(name).size; return [-s[0] / 2, s[0] / 2, -s[2] / 2, s[2] / 2]; }
    let e = [Infinity, -Infinity, Infinity, -Infinity];
    for (const o of L) for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const x = o.c[0] + sx * o.a[0][0] * o.h[0] + sy * o.a[1][0] * o.h[1] + sz * o.a[2][0] * o.h[2], z = o.c[2] + sx * o.a[0][2] * o.h[0] + sy * o.a[1][2] * o.h[1] + sz * o.a[2][2] * o.h[2];
      e = [Math.min(e[0], x), Math.max(e[1], x), Math.min(e[2], z), Math.max(e[3], z)];
    }
    return e; };
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
  const windowIn = (f, t0, t1, ft) => {
    const ux = -f.N[1], uz = f.N[0];
    for (let t = t0; t <= t1 + 0.01; t += 0.5) {
      const x = ux * t + f.N[0] * (f.o - 0.15), z = uz * t + f.N[1] * (f.o - 0.15);
      const here = around(x, z, 0.2, ft - 0.2, ft + 3).filter(j => covers(j, x, z, 0.12));
      if (here.some(j => role(j) === 'window' || /crystal|glass|window/.test(ps[j].name))) return true;
      const at = h => here.some(j => ['wall', 'window'].includes(role(j)) && bx[j].y0 <= ft + h && bx[j].y1 >= ft + h);
      if (at(0.4) && !at(1.5) && at(2.4)) return true;
    }
    return false;
  };
  // members: decor and small building pieces in a room, upright
  const info = new Map();
  ps.forEach((p, i) => {
    if (p.tl || MOD.test(p.name)) return;
    const dec = KB.isDecor(p.name), built = !dec && isBuilt(p.name);
    if (!dec && !built) return;
    const x = cx(i), z = cz(i), ft = floorTop(x, z, bx[i].y0 + 0.05);
    if (ft == null || bx[i].y0 > ft + 2.8 || bx[i].y1 < ft + 0.02 || !roofed(x, z, ft)) return;
    // a building piece longer than 2.2 m or taller than 2.2 m is the house itself
    if (built && (Math.max(bx[i].x1 - bx[i].x0, bx[i].z1 - bx[i].z0) > 2.3 || bx[i].y1 - bx[i].y0 > 2.2)) return;
    info.set(i, { ft, dec, built });
  });
  // contact: solids touching (2 cm) or clipping, or for pieces with no solids (rugs, food) their boxes overlapping
  const ids = [...info.keys()], parent = new Map(ids.map(i => [i, i]));
  const find = i => { while (parent.get(i) !== i) { parent.set(i, parent.get(parent.get(i))); i = parent.get(i); } return i; };
  const isRug = i => role(i) === 'rug';
  const touch = (i, j) => {
    const A = bx[i], B = bx[j], g = 0.02;
    const near2 = e => !(A.x0 > B.x1 + e || B.x0 > A.x1 + e || A.y0 > B.y1 + e || B.y0 > A.y1 + e || A.z0 > B.z1 + e || B.z0 > A.z1 + e);
    if (!near2(g)) {
      // a piece's shown parts can stand past its collider box, so with VH_SHAPES solid pieces get a wider box test before the parts
      if (!(SM.MODE && !(A.pass || B.pass || !A.sol || !B.sol) && near2(0.5))) return false;
    }
    if (A.pass || B.pass || !A.sol || !B.sol) return true;
    const SA = shown(i), SB = shown(j);
    for (const a of SA) for (const b of SB) if (SHP.hit(a, b, g)) return true;
    return false;
  };
  for (const i of ids) {
    const b = bx[i];
    for (const j of around(cx(i), cz(i), Math.max(b.x1 - b.x0, b.z1 - b.z0) / 2 + 1.2, b.y0 - 0.05, b.y1 + 0.05)) {
      if (j <= i || !info.has(j) || Math.abs(info.get(j).ft - info.get(i).ft) > 0.3) continue;
      if (isRug(i) !== isRug(j)) continue;
      if (info.get(i).built && info.get(j).built) continue; // two building pieces alone make structure
      if (touch(i, j)) parent.set(find(i), find(j));
    }
  }
  const groups = new Map();
  for (const i of ids) { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); }
  const out = [];
  for (let items of groups.values()) {
    if (items.length < 2 || items.length > 14) continue;
    if (!items.some(i => info.get(i).dec)) continue;
    const ft = info.get(items[0]).ft;
    // a table, bed or fire in the group is its anchor
    let at = items.find(i => TABLE.test(ps[i].name)) ?? items.find(i => BED.test(ps[i].name)) ?? items.find(i => FIRE.test(ps[i].name));
    if (at != null) items = items.filter(i => i !== at);
    if (items.length < 2 && at == null) continue;
    if (!items.length) continue;
    const gx = items.reduce((s, i) => s + cx(i), 0) / items.length, gz = items.reduce((s, i) => s + cz(i), 0) / items.length;
    let anchor, ox, oz, fyaw, angle, fcs = [];
    if (at != null) { anchor = TABLE.test(ps[at].name) ? 'table' : BED.test(ps[at].name) ? 'bed' : 'hearth'; }
    else {
      const fs0 = faces(gx, gz, ft, 1.4).sort((a, b) => a.dist - b.dist);
      if (fs0.length) {
        const f1 = fs0[0];
        for (const f2 of fs0.slice(1)) {
          const cos = f1.N[0] * f2.N[0] + f1.N[1] * f2.N[1], ang = Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
          if (ang < 25 || ang > 120) continue;
          const det = f1.N[0] * f2.N[1] - f1.N[1] * f2.N[0];
          const Ox = (f1.o * f2.N[1] - f2.o * f1.N[1]) / det, Oz = (f1.N[0] * f2.o - f2.N[0] * f1.o) / det;
          if (Math.hypot(Ox - gx, Oz - gz) > 2.2) continue;
          anchor = 'corner'; fcs = [f1, f2]; ox = Ox; oz = Oz; fyaw = Math.atan2(f1.N[0] + f2.N[0], f1.N[1] + f2.N[1]) * 180 / Math.PI; angle = Math.round(180 - ang);
          break;
        }
        if (!anchor && f1.dist <= 1.1) {
          anchor = 'wall'; fcs = [f1];
          const ux = -f1.N[1], uz = f1.N[0], t = gx * ux + gz * uz;
          ox = ux * t + f1.N[0] * f1.o; oz = uz * t + f1.N[1] * f1.o; fyaw = Math.atan2(f1.N[0], f1.N[1]) * 180 / Math.PI;
          const along = items.map(i => cx(i) * ux + cz(i) * uz);
          if (windowIn(f1, Math.min(...along) - 0.5, Math.max(...along) + 0.5, ft)) anchor = 'window';
        }
      }
      if (!anchor) { anchor = 'floor'; ox = gx; oz = gz; const big = items.slice().sort((a, b) => (bx[b].x1 - bx[b].x0) * (bx[b].z1 - bx[b].z0) - (bx[a].x1 - bx[a].x0) * (bx[a].z1 - bx[a].z0))[0]; fyaw = ps[big].yaw; }
    }
    if (at != null) { ox = ps[at].x; oz = ps[at].z; fyaw = ps[at].yaw; }
    const a = fyaw * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const loc = p => { const dx = p.x - ox, dz = p.z - oz; return [dx * c - dz * s, dx * s + dz * c]; };
    // what each rests on
    const restOf = i => {
      const b = bx[i];
      if (Math.abs(b.y0 - ft) < 0.12 || (b.pass && Math.abs(ps[i].y - ft) < 0.12)) return { rest: 'floor' };
      if (b.y0 < ft - 0.02 && b.y1 > ft + 0.05 && b.y0 > ft - 0.8) return { rest: 'floor' };
      const x = cx(i), z = cz(i);
      if (at != null && covers(at, x, z) && Math.abs(b.y0 - bx[at].y1) < 0.15) return { rest: 'anchor' };
      let best = null;
      for (const j of items) if (j !== i && covers(j, x, z, 0.05) && b.y0 > bx[j].y0 + 0.05 && Math.abs(b.y0 - bx[j].y1) < 0.15 && (!best || bx[j].y1 > bx[best].y1)) best = j;
      if (best != null) return { rest: 'on', on: best };
      for (const w of around(x, z, 1.2, b.y0 - 0.1, b.y1 + 0.1)) if (isWall(w) && b.x0 <= bx[w].x1 + 0.3 && bx[w].x0 <= b.x1 + 0.3 && b.z0 <= bx[w].z1 + 0.3 && bx[w].z0 <= b.z1 + 0.3) return { rest: 'wall' };
      for (const j of around(x, z, 0.3, b.y1 - 0.05, b.y1 + 0.4)) if (j !== i && P.piece(ps[j].name).structural && covers(j, x, z, 0.1) && bx[j].y0 >= b.y1 - 0.1) return { rest: 'hang' };
      return null;
    };
    const rests = new Map();
    for (const i of items) { const r = restOf(i); if (r) rests.set(i, r); }
    items = items.filter(i => rests.has(i));
    // what rests on a piece left out goes too
    for (let k = 0; k < 3; k++) items = items.filter(i => rests.get(i).rest !== 'on' || items.includes(rests.get(i).on));
    if (items.length + (at != null ? 1 : 0) < 2 || !items.some(i => info.get(i).dec)) continue;
    const clips = [];
    let deep = 0;
    for (let u = 0; u < items.length; u++) {
      for (let v = u + 1; v < items.length; v++) { const dd = SHP.clipDepth(shown(items[u]), shown(items[v])); if (dd > 0.01) { clips.push([u, v, +dd.toFixed(3)]); deep = Math.max(deep, dd); } }
      if (at != null) { const dd = SHP.clipDepth(shown(items[u]), shown(at)); if (dd > 0.01) { clips.push([u, 'a', +dd.toFixed(3)]); deep = Math.max(deep, dd); } }
      let dw = 0;
      const ws = new Set();
      for (const f of fcs) for (const w of f.walls) ws.add(w);
      for (const w of around(cx(items[u]), cz(items[u]), 1.5, bx[items[u]].y0, bx[items[u]].y1)) if (isWall(w)) ws.add(w);
      for (const w of ws) dw = Math.max(dw, SHP.clipDepth(shown(items[u]), shown(w)));
      if (dw > 0.01) clips.push([u, 'w', +dw.toFixed(3)]);
    }
    // one object on purpose: a member on another, a clip of 3 cm or more between members, or a building piece used
    const stacked = items.some(i => rests.get(i).rest === 'on' || rests.get(i).rest === 'anchor');
    const builtUse = items.some(i => info.get(i).built) && items.some(i => info.get(i).dec);
    if (!stacked && deep < 0.03 && !builtUse && !items.every(isRug)) continue;
    const members = items.map(i => {
      const p = ps[i], [lx, lz] = loc(p), r = rests.get(i);
      const m = { n: p.name, k: p.name, x: +lx.toFixed(3), y: +(p.y - ft).toFixed(3), z: +lz.toFixed(3), yaw: Math.round(norm(p.yaw - fyaw)), rest: r.rest };
      if (r.rest === 'on') m.on = items.indexOf(r.on);
      const sink = ft - bx[i].y0;
      if (sink > 0.02 && r.rest === 'floor') m.sink = +sink.toFixed(3);
      return m;
    });
    // footprint and height in the frame
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, top = 0;
    for (const i of items) {
      const b = bx[i];
      for (const [px, pz] of [[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1]]) { const dx = px - ox, dz = pz - oz, lx = dx * c - dz * s, lz = dx * s + dz * c; x0 = Math.min(x0, lx); x1 = Math.max(x1, lx); z0 = Math.min(z0, lz); z1 = Math.max(z1, lz); }
      top = Math.max(top, b.y1 - ft);
    }
    const r = { anchor, members, clips, foot: [+(x1 - x0).toFixed(2), +(z1 - z0).toFixed(2)], h: +top.toFixed(2) };
    if (anchor === 'corner') r.angle = angle;
    if (at != null) { r.of = akind(ps[at].name); r.anchorPiece = ps[at].name; }
    out.push(r);
  }
  return out;
}

// ---------------------------------------------------------------- matching: same anchor, same prefabs, within 0.35 m
const sig = r => `${r.anchor}|${r.anchor === 'corner' ? [90, 120, 135].find(t => Math.abs(r.angle - t) <= 8) || 'x' : ''}|${r.of || ''}|${r.members.map(m => m.n).sort().join(',')}`;
const mir = ms => ms.map(m => ({ ...m, x: -m.x, yaw: norm(-m.yaw) }));
function distance(A, B) {
  const used = new Set();
  let sum = 0;
  for (const a of A) {
    let best = null, bd = Infinity;
    B.forEach((b, j) => { if (used.has(j) || b.n !== a.n) return; const dd = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); if (dd < bd) { bd = dd; best = j; } });
    if (best == null || bd > 0.7) return Infinity;
    used.add(best); sum += bd;
  }
  return sum / A.length;
}

function run(src, likedSet) {
  const all = load(src);
  // the builds in order, read lazily from a folder; the same build saved twice counts once
  const seen = new Set();
  const builds = [];
  const each = function* () {
    if (!all.lazy) { for (const d of all) yield d; return; }
    for (const f of all.files) {
      const d = all.one(f);
      if (!d) continue;
      const p0 = d.p[0];
      const sig = d.p.length + '|' + d.p.slice(0, 200).map(p => `${p[0]}${Math.round(p[1] - p0[1])},${Math.round(p[2] - p0[2])},${Math.round(p[3] - p0[3])}`).sort().join(';');
      if (seen.has(sig)) continue;
      seen.add(sig);
      yield d;
    }
  };
  // well-liked: the top quarter by downloads among the vanilla builds (as lab/mine_kitbash.js), or every board build
  const bySig = new Map();
  let n = 0, nb = 0, nv = 0;
  const pending = [];
  for (const d of each()) {
    if (++nb % 100 === 0) console.error(`${nb} builds read, ${nv} vanilla, ${n} objects`);
    if (!d.p || d.p.length < 20 || d.p.some(p => MOD.test(p[0])) || d.p.length > 15000) continue;
    nv++;
    let res;
    try { res = mine(d); } catch (e) { console.error(d.file, e.message); continue; }
    const meta = { file: d.file, title: d.title, by: d.by, dls: d.dls, board: d.board };
    builds.push(meta);
    pending.push([meta, res]);
  }
  const ranked = builds.filter(d => d.dls > 0).sort((a, b) => b.dls - a.dls);
  const liked = likedSet || new Set(ranked.slice(0, Math.ceil(ranked.length / 4)).map(d => d.file));
  for (const [d, res] of pending) {
    for (const r of res) {
      n++;
      const k = sig(r);
      if (!bySig.has(k)) bySig.set(k, []);
      const cl = bySig.get(k);
      let home = cl.find(c => distance(c.lead.members, r.members) <= 0.35 || distance(c.lead.members, mir(r.members)) <= 0.35);
      if (!home) { home = { lead: r, src: d, builds: new Set(), liked: new Set() }; cl.push(home); }
      const who = `${d.title || d.file}${d.by ? ' (' + d.by + ')' : ''}`;
      home.builds.add(who);
      if (liked.has(d.file) || d.board) home.liked.add(who);
    }
  }
  const objs = [];
  for (const cl of bySig.values()) for (const c of cl) objs.push({ ...c.lead, builds: c.builds.size, liked: c.liked.size, src: [...c.liked, ...[...c.builds].filter(b => !c.liked.has(b))].slice(0, 5) });
  objs.sort((a, b) => b.liked - a.liked || b.builds - a.builds || b.members.length - a.members.length);
  return { builds: builds.length, liked: liked.size, found: n, objects: objs };
}

if (require.main === module) {
  const src = process.argv[2] || '/home/claude/study/compact.json';
  const out = process.argv[3] || '/tmp/creative-mined.json';
  const r = run(src);
  fs.writeFileSync(out, JSON.stringify(r, null, 1));
  const pre = new Set();
  for (const o of r.objects) for (const m of o.members) pre.add(m.n);
  console.log(`${r.builds} builds, ${r.found} combined objects, ${r.objects.length} distinct, ${pre.size} prefabs -> ${out}`);
}
module.exports = { mine, run, load };
