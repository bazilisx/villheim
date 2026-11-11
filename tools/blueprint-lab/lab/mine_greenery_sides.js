// Which side of a house its greenery stands on: the door's side (front), the far side (back) or the two ends, and how
// lopsided one build's greenery is, so lib/landscape.js can spread its groups the way corpus builders do.
//   node --max-old-space-size=3000 lab/mine_greenery_sides.js [compact.json] [out json]
//
// Builds: the vanilla builds of the compact corpus (no modded pieces, 80 to 6,000 pieces, as lab/mine_yards.js), turned
// to their main axis, that read as a house (four or more roof pieces over 12 to 700 m2) and have a ground-floor door.
// The house is the ground under its roof pieces (0.5 m grid). Greenery on the ground: a plant whose foot is within
// 1.2 m of the ground (the foot of the lowest door) or up to 1.5 m under it, off the roofed ground and within 15 m of it. Vines: within 1.2 m of the box round the roofed
// ground, at any height. The side of a piece is the side of that box it lies off (scaled to the box, as
// lib/yards.js's miner does); the front is the side most ground-floor doors face.
// Groups: plants of one class within 2 m of each other (as data/landscape/corpus-greenery.json).
const fs = require('fs'), path = require('path');
const lab = path.join(__dirname, '..');
const P = require(lab + '/lib/pieces.js');
const MODELS = require(lab + '/data/piece-models.json').pieces;
const compactPath = process.argv[2] || '/home/claude/study/compact.json';
const outPath = process.argv[3] || path.join(lab, 'data/landscape/corpus-sides.json');
const MOD = /^(kg_|GB_|CastleKit|MB|mm_|BBH|rk_|Piece_vf|OdinsKingdom|h_|\$|Hayze|rae_|teq_|tkd_|rkc_)/;
const GATE = /^(wood_gate|wood_fence_gate|darkwood_gate|flametal_gate|MountainKit_wood_gate)$/;
const deg = Math.PI / 180;
const fold = a => { const r = ((a % 90) + 90) % 90; return r > 45 ? r - 90 : r; };
function classOf(n) {
  if (/^(vines|VineAsh|VineGreen)$/.test(n)) return 'vine';
  if (/^(Beech|Birch|Oak1|Pinetree|FirTree|SwampTree|YggaShoot)/.test(n)) return 'tree';
  if (/Bush|shrub/.test(n)) return 'bush';
  if (/^Pickable_(Dandelion|Thistle|Fiddlehead)$|^Fiddleheadfern$|^FernAshlands$/.test(n)) return 'flower';
  if (/^Pickable_Mushroom|^GlowingMushroom$/.test(n)) return 'mushroom';
  if (/^Pickable_(Carrot|Turnip|Onion|Barley|Flax|Seed)/.test(n)) return 'crop';
  if (/^piece_pot\d|^ashland_pot/.test(n)) return 'pot';
  return null;
}
function bounds(n) {
  const m = MODELS[n];
  if (m && m.collider) return m.collider;
  if (m && m.bounds) return m.bounds;
  const s = P.piece(n).size, prop = P.piece(n).shape === 'prop';
  return { min: [-s[0] / 2, prop ? 0 : -s[1] / 2, -s[2] / 2], max: [s[0] / 2, prop ? s[1] : s[1] / 2, s[2] / 2] };
}
const q = (a, t) => { if (!a.length) return null; const v = a.slice().sort((x, y) => x - y); return +v[Math.min(v.length - 1, Math.floor(v.length * t))].toFixed(3); };
const stats = a => ({ n: a.length, p10: q(a, 0.1), p25: q(a, 0.25), median: q(a, 0.5), p75: q(a, 0.75), p90: q(a, 0.9) });

const D = JSON.parse(fs.readFileSync(compactPath, 'utf8'));
const builds = D.filter(d => d.p.length >= 80 && d.p.length <= 6000 && !d.p.some(p => MOD.test(p[0])));
const SIDES = ['front', 'back', 'end'];
const pieces = {}, groups = {}, planters = {}, lop = { groupsTop: [], sidesUsed: [], oneSide: 0, n: 0 }, perClassTop = {};
let houses = 0, withGreen = 0;
for (const d of builds) {
  const ps = d.p.map(p => ({ name: p[0], x: p[1], y: p[2], z: p[3], yaw: p[4] || 0 }));
  if (!ps.some(p => classOf(p.name))) continue;
  const roofs = ps.filter(p => /roof/.test(P.piece(p.name).role));
  if (roofs.length < 4) continue;
  const hist = {};
  for (const p of ps) if (P.piece(p.name).role === 'wall') { const k = Math.round(fold(p.yaw)); hist[k] = (hist[k] || 0) + 1; }
  const ax = +(Object.entries(hist).sort((a, b) => b[1] - a[1])[0] || [0])[0];
  const c = Math.cos(-ax * deg), s = Math.sin(-ax * deg);
  for (const p of ps) { const x = p.x * c + p.z * s, z = -p.x * s + p.z * c; p.x = x; p.z = z; p.yaw -= ax; }
  const foot = p => p.y + bounds(p.name).min[1];
  const cover = new Set(), cells = [];
  for (const r of roofs) {
    const b = bounds(r.name), cy = Math.cos(r.yaw * deg), sy = Math.sin(r.yaw * deg);
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const x of [b.min[0], b.max[0]]) for (const z of [b.min[2], b.max[2]]) { const wx = r.x + x * cy + z * sy, wz = r.z - x * sy + z * cy; x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); z0 = Math.min(z0, wz); z1 = Math.max(z1, wz); }
    for (let x = Math.floor(x0 * 2); x <= Math.ceil(x1 * 2); x++) for (let z = Math.floor(z0 * 2); z <= Math.ceil(z1 * 2); z++) { const k = x + ',' + z; if (!cover.has(k)) { cover.add(k); cells.push([x / 2, z / 2]); } }
  }
  const area = cover.size / 4;
  if (area < 12 || area > 700) continue;
  const cx0 = Math.min(...cells.map(v => v[0])), cx1 = Math.max(...cells.map(v => v[0])), cz0 = Math.min(...cells.map(v => v[1])), cz1 = Math.max(...cells.map(v => v[1]));
  const mid = [(cx0 + cx1) / 2, (cz0 + cz1) / 2], hx = (cx1 - cx0) / 2 || 1, hz = (cz1 - cz0) / 2 || 1;
  const sideOf = (x, z) => { const dx = x - mid[0], dz = z - mid[1]; return Math.abs(dx) / hx > Math.abs(dz) / hz ? (dx > 0 ? '+x' : '-x') : (dz > 0 ? '+z' : '-z'); };
  // the ground-floor doors: within 1.2 m of the lowest door (a 5th-percentile ground falls far under some builds'
  // footings), and that door's foot is the ground the plants are measured from
  const allDoors = ps.filter(p => P.piece(p.name).role === 'door' && !GATE.test(p.name));
  if (!allDoors.length) continue;
  const g0 = Math.min(...allDoors.map(foot));
  const doors = allDoors.filter(p => foot(p) < g0 + 1.2);
  houses++;
  const dc = {};
  for (const p of doors) { const k = sideOf(p.x, p.z); dc[k] = (dc[k] || 0) + 1; }
  const front = Object.entries(dc).sort((a, b) => b[1] - a[1])[0][0];
  const back = { '+x': '-x', '-x': '+x', '+z': '-z', '-z': '+z' }[front];
  const label = sd => (sd === front ? 'front' : sd === back ? 'back' : 'end');
  const under = p => cover.has(Math.round(p.x * 2) + ',' + Math.round(p.z * 2));
  const distTo = (x, z) => { let m = Infinity; for (const [x2, z2] of cells) { const dd = Math.hypot(x2 - x, z2 - z); if (dd < m) m = dd; } return m; };
  const out = [];
  for (const p of ps) {
    const k = classOf(p.name);
    if (!k) continue;
    if (k === 'vine') {
      if (p.x < cx0 - 1.2 || p.x > cx1 + 1.2 || p.z < cz0 - 1.2 || p.z > cz1 + 1.2) continue;
      if (p.x > cx0 + 1.2 && p.x < cx1 - 1.2 && p.z > cz0 + 1.2 && p.z < cz1 - 1.2) continue; // inside
    } else {
      if (under(p) || foot(p) > g0 + 1.2 || foot(p) < g0 - 1.5) continue;
      if (distTo(p.x, p.z) > 15) continue;
    }
    out.push({ p, k, sd: sideOf(p.x, p.z) });
  }
  if (!out.length) continue;
  withGreen++;
  for (const o of out) { const L = label(o.sd); (pieces[o.k] = pieces[o.k] || { front: 0, back: 0, end: 0 })[L]++; }
  // groups: one class within 2 m, linked
  const gs = [];
  for (const k of new Set(out.map(o => o.k))) {
    const list = out.filter(o => o.k === k), seen = new Set();
    for (const o of list) {
      if (seen.has(o)) continue;
      const grp = [o]; seen.add(o);
      for (let i = 0; i < grp.length; i++) for (const t of list) if (!seen.has(t) && Math.hypot(t.p.x - grp[i].p.x, t.p.z - grp[i].p.z) < 2) { seen.add(t); grp.push(t); }
      // a planter or bordered bed: two or more low building pieces (beams, logs, floors, walls up to 0.8 m over the
      // ground) off the house, within 0.7 m of the group's box; raised when the plants stand on one of them
      if (k !== 'vine') {
        const bx = { x0: Math.min(...grp.map(t => t.p.x)) - 0.7, x1: Math.max(...grp.map(t => t.p.x)) + 0.7, z0: Math.min(...grp.map(t => t.p.z)) - 0.7, z1: Math.max(...grp.map(t => t.p.z)) + 0.7 };
        const border = ps.filter(b2 => { const r = P.piece(b2.name); return r.structural && ['beam', 'floor', 'wall', 'pole'].includes(r.role) && !under(b2) && b2.x > bx.x0 && b2.x < bx.x1 && b2.z > bx.z0 && b2.z < bx.z1 && foot(b2) < g0 + 0.8 && foot(b2) > g0 - 1.5 && b2.y + bounds(b2.name).max[1] < g0 + 1.0; });
        const raised = grp.filter(t => foot(t.p) > g0 + 0.15).length / grp.length > 0.5;
        const P2 = planters[k] = planters[k] || { groups: 0, bordered: 0, multi: 0, multiBordered: 0, raised: 0, names: {}, size: [], margin: [], top: [] };
        P2.groups++; if (grp.length > 1) P2.multi++;
        if (border.length >= 2) {
          P2.bordered++; if (grp.length > 1) P2.multiBordered++; if (raised) P2.raised++;
          for (const b2 of border) P2.names[b2.name] = (P2.names[b2.name] || 0) + 1;
          P2.size.push(grp.length);
          const gx0 = Math.min(...grp.map(t => t.p.x)), gx1 = Math.max(...grp.map(t => t.p.x)), gz0 = Math.min(...grp.map(t => t.p.z)), gz1 = Math.max(...grp.map(t => t.p.z));
          for (const b2 of border) { const dx = Math.max(gx0 - b2.x, 0, b2.x - gx1), dz = Math.max(gz0 - b2.z, 0, b2.z - gz1); P2.margin.push(Math.hypot(dx, dz)); P2.top.push(b2.y + bounds(b2.name).max[1] - g0); }
        }
      }
      const sc = {};
      for (const t of grp) sc[t.sd] = (sc[t.sd] || 0) + 1;
      const sd = Object.entries(sc).sort((a, b) => b[1] - a[1])[0][0];
      gs.push({ k, sd });
      (groups[k] = groups[k] || { front: 0, back: 0, end: 0 })[label(sd)]++;
    }
  }
  // how lopsided: the share of the build's ground groups on its busiest side, and how many of the four sides have any
  const ground = gs.filter(x => x.k !== 'vine');
  if (ground.length >= 3) {
    const sc = {};
    for (const x of ground) sc[x.sd] = (sc[x.sd] || 0) + 1;
    const top = Math.max(...Object.values(sc)) / ground.length;
    lop.groupsTop.push(top); lop.sidesUsed.push(Object.keys(sc).length); lop.n++;
    if (Object.keys(sc).length === 1) lop.oneSide++;
    // and how often the busiest side is the front, the back or an end
    const topSide = Object.entries(sc).sort((a, b) => b[1] - a[1])[0][0];
    perClassTop[label(topSide)] = (perClassTop[label(topSide)] || 0) + 1;
  }
}
const share = o => { const t = SIDES.reduce((a, k) => a + (o[k] || 0), 0); return Object.fromEntries(SIDES.map(k => [k, +((o[k] || 0) / (t || 1)).toFixed(3)])); };
const groundAll = { front: 0, back: 0, end: 0 };
for (const [k, o] of Object.entries(groups)) if (k !== 'vine') for (const sd of SIDES) groundAll[sd] += o[sd];
const res = {
  about: 'Which side of a house its greenery stands on (lab/mine_greenery_sides.js, the compact corpus /home/claude/study/compact.json, vanilla builds). front: the side most ground-floor doors face; back: the far side; end: either of the other two (both together). Groups: one class within 2 m. planters: groups with two or more low building pieces (top under 1 m over the ground) off the house within 0.7 m of the box round the group; raised: most of its plants stand 0.15 m or more over the ground. lopsided: builds with three or more ground groups; top = the share of their ground groups on the busiest of the four sides.',
  version: '2026-11-11',
  houses, with_greenery: withGreen,
  pieces_by_side: Object.fromEntries(Object.entries(pieces).map(([k, o]) => [k, { n: SIDES.reduce((a, s) => a + o[s], 0), ...share(o) }])),
  groups_by_side: Object.fromEntries(Object.entries(groups).map(([k, o]) => [k, { n: SIDES.reduce((a, s) => a + o[s], 0), ...share(o) }])),
  ground_groups_by_side: { n: SIDES.reduce((a, s) => a + groundAll[s], 0), ...share(groundAll) },
  planters: Object.fromEntries(Object.entries(planters).map(([k, o]) => [k, { groups: o.groups, bordered: o.bordered, multi: o.multi, multi_bordered: o.multiBordered, raised: o.raised,
    border_pieces: Object.fromEntries(Object.entries(o.names).sort((a, b) => b[1] - a[1]).slice(0, 8)), plants: stats(o.size), margin_m: stats(o.margin), border_top_m: stats(o.top) }])),
  lopsided: { builds: lop.n, top_share: stats(lop.groupsTop), sides_used: stats(lop.sidesUsed), one_side_share: +(lop.oneSide / (lop.n || 1)).toFixed(3), busiest_side: share(perClassTop) },
};
fs.writeFileSync(outPath, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
