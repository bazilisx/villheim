// Yards from the best-liked builds: what stands outside the walls (fences, gates, paths, gardens, piles, carts,
// benches, lamps), how far out, how high, and how the fences turn, so lib/yards.js can lay out yards the same way.
//   node lab/mine_yards.js [compact.json] [out json]
//
// Builds kept: no modded pieces (the pattern lab/learn_critic.js uses), downloads known, 80 to 6,000 pieces, the top
// quarter of those by downloads ("well-liked"), and of those the ones that read as a building: four or more roof
// pieces over 12 to 700 square metres.
//
// Each build is turned to its main axis (the most common wall yaw, folded to 0 to 90 degrees). The building is the
// ground under its roof pieces, on a 0.5 m grid. The ground is the 5th percentile of the bottoms of the building
// pieces. A piece is outside when its middle is off that grid and its foot is within 1.2 m of the ground (things
// standing on the ground, not a balcony) and within 15 m of the building. Its distance from the building is the
// distance to the nearest roofed cell.
const fs = require('fs'), path = require('path');
const lab = path.join(__dirname, '..');
const P = require(lab + '/lib/pieces.js');
// VH_SHAPES=collider|coarse|fine: how deep a prop visibly sits in the ground, how high a fence, post or gate shows and how far props clip
// into each other are read from those shapes (lab/shape_mode.js); unset: the collider boxes as the committed yards.json was made
const SM = require('./shape_mode.js'), SHP = require(lab + '/lib/shapes.js');
const MODELS = require(lab + '/data/piece-models.json').pieces;

const compactPath = process.argv[2] || '/home/claude/study/compact.json';
const outPath = process.argv[3] || path.join(lab, 'data/yards.json');
const MOD = /^(kg_|GB_|CastleKit|MB|mm_|BBH|rk_|Piece_vf|OdinsKingdom|h_|\$|Hayze|rae_|teq_|tkd_|rkc_)/;
const deg = Math.PI / 180;
const ORD = P.BIOME_ORDER;

// ---------------------------------------------------------------- what a piece is in a yard

const FENCE = /^(wood_fence|stake_wall|stone_fence|goblin_fence|piece_stakewall_blackwood|piece_dvergr_stake_wall)$/;
const GATE = /^(wood_gate|wood_fence_gate|darkwood_gate|flametal_gate|MountainKit_wood_gate)$/;
const DEFENCE = /sharpstakes|stake_wall|stakewall|stake_wall/;
function kindOf(n) {
  const r = P.piece(n).role;
  if (GATE.test(n)) return 'gate';
  if (FENCE.test(n)) return 'fence';
  if (/sharpstakes/.test(n)) return 'stakes';
  if (n === 'Cart' || /wagon/.test(n)) return 'cart';
  if (n === 'piece_beehive') return 'hive';
  if (/^(piece_maypole|piece_xmastree)$/.test(n)) return 'seasonal';
  if (/^piece_pot\d|^ashland_pot/.test(n)) return 'pot';
  if (/^ArmorStand/.test(n)) return 'stand';
  if (r === 'fire' || /^(bonfire|fire_pit)/.test(n)) return 'fire';
  // vines climb walls; they are wall greenery, kept apart from the beds
  if (/^(vines|VineAsh|VineGreen)$/.test(n)) return 'vine';
  if (/^Pickable_(Carrot|Turnip|Onion|Barley|Flax|SeedCarrot|SeedTurnip|SeedOnion)/.test(n) || /^sapling_/.test(n)) return 'crop';
  if (/Bush|shrub|Beech|Birch|Oak1|Pinetree|FirTree|SwampTree|Pickable_Dandelion|Pickable_Thistle|Pickable_Mushroom|Fern|fern|_RtD$|decowall_tree/.test(n)) return 'green';
  if (/^Pickable_(Stone|Flint|Branch)$|^Placeable_|^Rock|^rock/.test(n)) return 'loose';
  if (/_stack$|_pile$|^wood_stack/.test(n)) return 'pile';
  if (r === 'seat') return 'seat';
  if (r === 'light') return 'lamp';
  if (r === 'storage') return 'storage';
  if (r === 'craft' || r === 'table') return 'work';
  if (/^sign|itemstand|ArmorStand/.test(n)) return 'sign';
  if (r === 'floor') return 'floor';
  if (r === 'stair') return 'step';
  if (r === 'pole') return 'post';
  if (r === 'beam') return 'rail';
  if (r === 'wall') return 'wall';
  if (r === 'fire') return 'fire';
  return 'other';
}

// a piece's box in its own frame: the solid collider where there is one, the meshes otherwise, the catalog last
function bounds(n) {
  const m = MODELS[n];
  if (m && m.collider) return m.collider;
  if (m && m.bounds) return m.bounds;
  const s = P.piece(n).size, prop = P.piece(n).shape === 'prop';
  return { min: [-s[0] / 2, prop ? 0 : -s[1] / 2, -s[2] / 2], max: [s[0] / 2, prop ? s[1] : s[1] / 2, s[2] / 2] };
}
function worldBox(p) {
  const b = bounds(p.name), c = Math.cos(p.yaw * deg), s = Math.sin(p.yaw * deg);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const x of [b.min[0], b.max[0]]) for (const z of [b.min[2], b.max[2]]) {
    const wx = p.x + x * c + z * s, wz = p.z - x * s + z * c;
    x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); z0 = Math.min(z0, wz); z1 = Math.max(z1, wz);
  }
  return { x0, x1, z0, z1, y0: p.y + b.min[1], y1: p.y + b.max[1] };
}
// the piece's lowest and highest point in the shapes VH_SHAPES names (its collider box when unset or when it has no shapes)
function vspan(o) {
  if (!SM.MODE) return o.b;
  if (!o.vs) { const W = SM.parts({ name: o.p.name, x: o.p.x, y: o.p.y, z: o.p.z, yaw: o.p.yaw }); o.vs = W && W.length ? { y0: Math.min(...W.map(w => w.y0)), y1: Math.max(...W.map(w => w.y1)) } : o.b; }
  return o.vs;
}
// a fence-like piece's two ends along its local x (the snap points where the model has them)
function ends(p) {
  const m = MODELS[p.name], b = bounds(p.name);
  let a0 = b.min[0], a1 = b.max[0];
  if (m && m.snap && m.snap.length) { const xs = m.snap.map(s => s[0]); a0 = Math.min(...xs); a1 = Math.max(...xs); }
  const c = Math.cos(p.yaw * deg), s = Math.sin(p.yaw * deg);
  return [[p.x + a0 * c, p.z - a0 * s], [p.x + a1 * c, p.z - a1 * s]];
}

const q = (a, t) => { if (!a.length) return null; const v = a.slice().sort((x, y) => x - y); return +v[Math.min(v.length - 1, Math.floor(v.length * t))].toFixed(2); };
const stats = a => ({ n: a.length, p10: q(a, 0.1), p25: q(a, 0.25), median: q(a, 0.5), p75: q(a, 0.75), p90: q(a, 0.9) });
const needsOf = names => names.reduce((m, n) => Math.max(m, ORD.indexOf(P.needs(n))), 0);
const fold = a => { const r = ((a % 90) + 90) % 90; return r > 45 ? r - 90 : r; };

// ---------------------------------------------------------------- the builds

const D = JSON.parse(fs.readFileSync(compactPath, 'utf8'));
const vanillaAll = D.filter(d => d.p.length >= 80 && d.p.length <= 6000 && !d.p.some(p => MOD.test(p[0])));
vanillaAll.sort((a, b) => (b.dls || 0) - (a.dls || 0));
const vanilla = vanillaAll.filter(d => d.dls > 0);
const top = vanilla.slice(0, Math.ceil(vanilla.length / 4));

// an offset from a feature to a piece in the feature's own frame (a along its local x, o along its local z)
const rel = (p, o, g) => { const a = -o.yaw * deg, dx = p.x - o.x, dz = p.z - o.z; return [p.name, +(dx * Math.cos(a) + dz * Math.sin(a)).toFixed(2), +(p.y - g).toFixed(2), +(-dx * Math.sin(a) + dz * Math.cos(a)).toFixed(2), Math.round(((p.yaw - o.yaw) % 360 + 360) % 360)]; };

function mine(top) {
const perBuild = [], seenKinds = {}, assemblies = { gate: [], fenceRun: [], corner: [], path: [], bed: [], pile: [], cart: [], seat: [], lamp: [], hive: [], pot: [], signpost: [], scarecrow: [] };
const M = { dist: {}, fenceTop: [], fenceGapWidth: [], fenceRunLength: [], fenceTurn: [], fenceOffAxis: [], fenceSegment: [], yardDepth: [], yardDepthFront: [],
  gateToDoor: [], gateTop: [], gateOnDoorSide: 0, gates: 0, gatePosts: [], gateFence: {}, pathWidth: [], pathPieces: {}, pathDoorToGate: 0, fenceKinds: {}, postTop: [], railHeight: [],
  againstWall: {}, greenNames: {}, cropNames: {}, bedSize: [], fenceClosed: 0, fenceLines: 0, wrapSides: [], lowWallTop: [], fenceByName: {}, sink: {}, clipDepth: [], names: {}, turnFine: [] };
let houses = 0;
for (const d of top) {
  const ps = d.p.map(p => ({ name: p[0], x: p[1], y: p[2], z: p[3], yaw: p[4] || 0 }));
  const roofs = ps.filter(p => /roof/.test(P.piece(p.name).role));
  if (roofs.length < 4) continue;
  // main axis: the most common wall yaw folded to [-45, 45)
  const hist = {};
  for (const p of ps) if (P.piece(p.name).role === 'wall') { const k = Math.round(fold(p.yaw)); hist[k] = (hist[k] || 0) + 1; }
  const ax = +(Object.entries(hist).sort((a, b) => b[1] - a[1])[0] || [0])[0];
  const c = Math.cos(-ax * deg), s = Math.sin(-ax * deg);
  for (const p of ps) { const x = p.x * c + p.z * s, z = -p.x * s + p.z * c; p.x = x; p.z = z; p.yaw -= ax; }
  const boxes = ps.map(worldBox);
  const struct = ps.map((p, i) => i).filter(i => P.piece(ps[i].name).structural);
  const ys = struct.map(i => boxes[i].y0).sort((a, b) => a - b);
  const g = ys[Math.floor(ys.length * 0.05)];
  // roofed cells
  const cover = new Set(), cells = [];
  for (const i of ps.map((p, i) => i).filter(i => /roof/.test(P.piece(ps[i].name).role))) {
    const b = boxes[i];
    for (let x = Math.floor(b.x0 * 2); x <= Math.ceil(b.x1 * 2); x++) for (let z = Math.floor(b.z0 * 2); z <= Math.ceil(b.z1 * 2); z++) {
      const k = x + ',' + z; if (!cover.has(k)) { cover.add(k); cells.push([x / 2, z / 2]); }
    }
  }
  const area = cover.size / 4;
  if (area < 12 || area > 700) continue;
  houses++;
  const under = p => cover.has(Math.round(p.x * 2) + ',' + Math.round(p.z * 2));
  const distTo = (x, z) => { let m = Infinity; for (const [cx, cz] of cells) { const dd = Math.hypot(cx - x, cz - z); if (dd < m) m = dd; } return Math.max(0, m - 0.25); };
  const cx0 = Math.min(...cells.map(v => v[0])), cx1 = Math.max(...cells.map(v => v[0])), cz0 = Math.min(...cells.map(v => v[1])), cz1 = Math.max(...cells.map(v => v[1]));
  const mid = [(cx0 + cx1) / 2, (cz0 + cz1) / 2];
  // ground-floor doors (not gates), and the side of the building they face
  const doors = ps.filter((p, i) => P.piece(p.name).role === 'door' && !GATE.test(p.name) && boxes[i].y0 < g + 1.2);
  const sideOf = (x, z) => { const dx = x - mid[0], dz = z - mid[1], hx = (cx1 - cx0) / 2 || 1, hz = (cz1 - cz0) / 2 || 1; return Math.abs(dx) / hx > Math.abs(dz) / hz ? (dx > 0 ? '+x' : '-x') : (dz > 0 ? '+z' : '-z'); };
  const doorSides = new Set(doors.map(p => sideOf(p.x, p.z)));
  const out = [];
  ps.forEach((p, i) => {
    const b = boxes[i];
    if (under(p) || b.y0 > g + 1.2 || b.y1 < g - 0.8) return;
    const k = kindOf(p.name);
    if (['other'].includes(k)) return;
    const dd = distTo(p.x, p.z);
    if (dd > 15) return; // a yard is the ground near the building, not a plaza or a town
    out.push({ p, b, k, d: dd, side: sideOf(p.x, p.z) });
  });
  if (!out.length) { perBuild.push({ id: d.id, dls: d.dls, area, outside: 0 }); continue; }
  const kinds = {};
  for (const o of out) {
    kinds[o.k] = (kinds[o.k] || 0) + 1;
    (M.dist[o.k] = M.dist[o.k] || []).push(+o.d.toFixed(2));
    if (o.d < 1.3) M.againstWall[o.k] = (M.againstWall[o.k] || 0) + 1;
    if (o.k === 'green') M.greenNames[o.p.name] = (M.greenNames[o.p.name] || 0) + 1;
    if (o.k === 'crop') M.cropNames[o.p.name] = (M.cropNames[o.p.name] || 0) + 1;
  }
  for (const k of Object.keys(kinds)) seenKinds[k] = (seenKinds[k] || 0) + 1;

  // fence lines: fences, low walls (top 1.6 m or less over the ground) and rails 0.3 to 1.6 m up, joined end to end
  const lineish = out.filter(o => o.k === 'fence' || (o.k === 'wall' && o.b.y1 < g + 1.7 && o.d > 0.4) || (o.k === 'rail' && o.b.y0 > g + 0.2 && o.b.y1 < g + 1.8 && o.d > 0.4 && P.piece(o.p.name).shape === 'box'));
  for (const o of lineish) {
    if (o.k === 'fence') {
      M.fenceKinds[o.p.name] = (M.fenceKinds[o.p.name] || 0) + 1; M.fenceTop.push(+(vspan(o).y1 - g).toFixed(2));
      const f = M.fenceByName[o.p.name] || (M.fenceByName[o.p.name] = { top: [], foot: [] });
      f.top.push(+(vspan(o).y1 - g).toFixed(2)); f.foot.push(+(vspan(o).y0 - g).toFixed(2));
    }
    if (o.k === 'wall') { M.fenceKinds['low ' + o.p.name] = (M.fenceKinds['low ' + o.p.name] || 0) + 1; M.lowWallTop.push(+(vspan(o).y1 - g).toFixed(2)); }
    if (o.k === 'rail') M.railHeight.push(+(o.p.y - g).toFixed(2));
    M.fenceOffAxis.push(Math.abs(Math.round(fold(o.p.yaw))));
  }
  for (const o of out.filter(o => o.k === 'post' && o.d > 0.4 && o.b.y0 < g + 0.4)) M.postTop.push(+(vspan(o).y1 - g).toFixed(2));
  // chains: pieces whose ends meet (0.45 m) at the same height band
  const segs = lineish.filter(o => o.k !== 'rail' || !lineish.some(f => f.k === 'fence' && Math.hypot(f.p.x - o.p.x, f.p.z - o.p.z) < 1)).map(o => ({ o, e: ends(o.p), used: false }));
  const near = (a, b2, r) => Math.hypot(a[0] - b2[0], a[1] - b2[1]) < r;
  const lines = [];
  for (const sg of segs) {
    if (sg.used) continue;
    sg.used = true;
    const line = [sg];
    let grow = true;
    while (grow) {
      grow = false;
      for (const t of segs) {
        if (t.used) continue;
        const a = line[0].e, z = line[line.length - 1].e;
        if (t.e.some(e => near(e, z[0], 0.45) || near(e, z[1], 0.45))) { line.push(t); t.used = true; grow = true; }
        else if (t.e.some(e => near(e, a[0], 0.45) || near(e, a[1], 0.45))) { line.unshift(t); t.used = true; grow = true; }
      }
    }
    lines.push(line);
  }
  for (const line of lines) {
    if (line.length < 2) continue;
    M.fenceLines++;
    let len = 0;
    for (const sg of line) { const L = Math.hypot(sg.e[0][0] - sg.e[1][0], sg.e[0][1] - sg.e[1][1]); len += L; M.fenceSegment.push(+L.toFixed(2)); }
    M.fenceRunLength.push(+len.toFixed(1));
    for (let i = 1; i < line.length; i++) {
      const t = Math.abs((((line[i].o.p.yaw - line[i - 1].o.p.yaw) % 180) + 180) % 180);
      M.fenceTurn.push(Math.round(Math.min(t, 180 - t)));
      if (line.length >= 4) M.turnFine.push(Math.round(Math.min(t, 180 - t)));
    }
    const a = line[0].e, z = line[line.length - 1].e;
    if (line.length > 3 && (a.some(e => z.some(f => near(e, f, 0.45))))) M.fenceClosed++;
    M.wrapSides.push(new Set(line.map(sg => sg.o.side)).size);
    if (assemblies.fenceRun.length < 40 && line.length >= 3) {
      const o0 = line[0].o.p;
      assemblies.fenceRun.push({ src: d.id, title: d.title, dls: d.dls, n: line.length, length: +len.toFixed(1), pieces: line.slice(0, 12).map(sg => [sg.o.p.name, +(sg.o.p.x - o0.x).toFixed(2), +(sg.o.p.y - g).toFixed(2), +(sg.o.p.z - o0.z).toFixed(2), Math.round(sg.o.p.yaw)]) });
    }
    // corners: two segments meeting at a turn of 20 degrees or more
    for (let i = 1; i < line.length && assemblies.corner.length < 60; i++) {
      const t = Math.abs((((line[i].o.p.yaw - line[i - 1].o.p.yaw) % 180) + 180) % 180), turn = Math.min(t, 180 - t);
      if (turn < 20) continue;
      const p0 = line[i - 1].o.p, p1 = line[i].o.p;
      const posts = out.filter(o => o.k === 'post' && line[i].e.some(e => near(e, [o.p.x, o.p.z], 0.5)) && line[i - 1].e.some(e => near(e, [o.p.x, o.p.z], 0.5)));
      assemblies.corner.push({ src: d.id, turn: Math.round(turn), pieces: [p0, p1, ...posts.map(o => o.p)].map(p => rel(p, p1, g)) });
    }
    // openings along a line: two segments in line with a gap of 0.5 to 3 m between their ends
  }
  // openings: two segments in one line (same yaw, the gap along their axis) with 0.6 to 3.2 m between their ends
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const A = segs[i], B = segs[j];
    if (Math.abs(fold(A.o.p.yaw - B.o.p.yaw)) > 5) continue;
    let best = Infinity, pair = null;
    for (const e of A.e) for (const f of B.e) { const d2 = Math.hypot(e[0] - f[0], e[1] - f[1]); if (d2 < best) { best = d2; pair = [e, f]; } }
    if (!(best > 0.6 && best < 3.2)) continue;
    const ax = [A.e[1][0] - A.e[0][0], A.e[1][1] - A.e[0][1]], L = Math.hypot(ax[0], ax[1]) || 1;
    const off = Math.abs(((pair[1][0] - pair[0][0]) * ax[1] - (pair[1][1] - pair[0][1]) * ax[0]) / L);
    if (off < 0.3 && Math.abs(A.o.b.y0 - B.o.b.y0) < 0.4) M.fenceGapWidth.push(+best.toFixed(2));
  }
  // how deep pieces sit in the ground: fences, posts, path floors and props (their foot under the ground)
  for (const o of out) {
    const sink = +(g - vspan(o).y0).toFixed(2);
    const k = ['fence', 'post', 'gate'].includes(o.k) ? 'fence' : o.k === 'floor' ? 'floor' : ['green', 'crop', 'pile', 'seat', 'work', 'storage', 'lamp', 'sign', 'cart', 'pot', 'loose'].includes(o.k) ? 'prop' : null;
    if (k && sink > -0.3 && sink < 1.2) (M.sink[k] = M.sink[k] || []).push(sink);
  }
  // deliberate clips outside: a prop's solid box reaching into a fence, post, wall or another prop, as the depth of the
  // shallowest axis of the two boxes' overlap
  const solid = out.filter(o => !['green', 'crop', 'vine', 'floor', 'step', 'rail'].includes(o.k));
  for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
    const A = solid[i].b, B = solid[j].b;
    const slack = SM.MODE ? 0.5 : 0; // shown parts can stand past the collider box
    const dx = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0), dz = Math.min(A.z1, B.z1) - Math.max(A.z0, B.z0), dy = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
    if (dx <= 0.02 - slack || dz <= 0.02 - slack || dy <= 0.02 - slack) continue;
    const propA = !['fence', 'post', 'wall', 'gate'].includes(solid[i].k), propB = !['fence', 'post', 'wall', 'gate'].includes(solid[j].k);
    if (!propA && !propB) continue; // fence into post is how fences join, not a clip
    if (SM.MODE) {
      // VH_SHAPES: the depth the two pieces' shapes reach into each other (lib/shapes.js clipDepth, the least overlap over the separating axes)
      const parts = o => o.sh || (o.sh = SM.parts({ name: o.p.name, x: o.p.x, y: o.p.y, z: o.p.z, yaw: o.p.yaw }));
      const dd = SHP.clipDepth(parts(solid[i]), parts(solid[j]));
      if (dd > 0.02) M.clipDepth.push(+dd.toFixed(2));
      continue;
    }
    M.clipDepth.push(+Math.min(dx, dz).toFixed(2));
  }
  // signposts (a sign within 0.4 m of a post) and scarecrows (an armor stand within 4 m of crops or greenery)
  for (const o of out.filter(o => o.p.name === 'sign' || o.p.name === 'sign_notext')) {
    const post = out.find(f => f.k === 'post' && Math.hypot(f.p.x - o.p.x, f.p.z - o.p.z) < 0.4);
    if (post && assemblies.signpost.length < 20) assemblies.signpost.push({ src: d.id, title: d.title, dls: d.dls, d: +o.d.toFixed(2), pieces: [post.p, o.p].map(p => rel(p, post.p, g)) });
  }
  for (const o of out.filter(o => o.k === 'stand')) {
    if (out.some(f => (f.k === 'crop' || f.k === 'green') && Math.hypot(f.p.x - o.p.x, f.p.z - o.p.z) < 4) && assemblies.scarecrow.length < 20)
      assemblies.scarecrow.push({ src: d.id, title: d.title, dls: d.dls, d: +o.d.toFixed(2), pieces: [rel(o.p, o.p, g)] });
  }
  for (const o of out) { const t = M.names[o.k] || (M.names[o.k] = {}); t[o.p.name] = (t[o.p.name] || 0) + 1; }
  // yard depth: how far out the farthest fence piece stands, per build and on the door side
  const fd = lineish.filter(o => o.k !== 'rail').map(o => o.d);
  if (fd.length >= 3) M.yardDepth.push(q(fd, 0.9));
  const fdFront = lineish.filter(o => o.k !== 'rail' && doorSides.has(o.side)).map(o => o.d);
  if (fdFront.length >= 2) M.yardDepthFront.push(q(fdFront, 0.9));

  // gates: where they stand against the doors, what they sit in, and their posts
  for (const o of out.filter(o => o.k === 'gate')) {
    M.gates++;
    M.gateTop.push(+(vspan(o).y1 - g).toFixed(2));
    if (doorSides.has(o.side)) M.gateOnDoorSide++;
    if (doors.length) M.gateToDoor.push(+Math.min(...doors.map(p => Math.hypot(p.x - o.p.x, p.z - o.p.z))).toFixed(2));
    const e = ends(o.p);
    const posts = out.filter(f => f.k === 'post' && e.some(x => near(x, [f.p.x, f.p.z], 0.6)));
    M.gatePosts.push(posts.length);
    const nextTo = lineish.filter(f => e.some(x => ends(f.p).some(y => near(x, y, 0.8))));
    const what = nextTo.length ? nextTo[0].p.name : 'none';
    M.gateFence[o.p.name + ' in ' + what] = (M.gateFence[o.p.name + ' in ' + what] || 0) + 1;
    if (assemblies.gate.length < 40) {
      const parts = [o.p, ...posts.map(f => f.p), ...nextTo.slice(0, 2).map(f => f.p), ...out.filter(f => (f.k === 'rail' || f.k === 'lamp') && Math.hypot(f.p.x - o.p.x, f.p.z - o.p.z) < 2).map(f => f.p)];
      assemblies.gate.push({ src: d.id, title: d.title, dls: d.dls, d: +o.d.toFixed(2), pieces: [...new Set(parts)].map(p => rel(p, o.p, g)) });
    }
  }
  // paths: floor pieces on the ground outside, in runs
  const floors = out.filter(o => o.k === 'floor' && o.b.y1 < g + 0.6 && o.b.y1 > g - 0.6);
  for (const o of floors) M.pathPieces[o.p.name] = (M.pathPieces[o.p.name] || 0) + 1;
  if (floors.length >= 2) {
    // the path's width: across the line from the building's middle, the spread of the floor pieces near the door
    for (const dr of doors.slice(0, 2)) {
      const near2 = floors.filter(o => Math.hypot(o.p.x - dr.x, o.p.z - dr.z) < 4);
      if (near2.length >= 2) {
        const ws = [Math.max(...near2.map(o => o.b.x1)) - Math.min(...near2.map(o => o.b.x0)), Math.max(...near2.map(o => o.b.z1)) - Math.min(...near2.map(o => o.b.z0))];
        M.pathWidth.push(+Math.min(...ws).toFixed(2));
      }
    }
    const gates = out.filter(o => o.k === 'gate');
    if (gates.length && doors.length && floors.some(o => gates.some(gt => Math.hypot(gt.p.x - o.p.x, gt.p.z - o.p.z) < 2.5)) && floors.some(o => doors.some(dr => Math.hypot(dr.x - o.p.x, dr.z - o.p.z) < 2.5))) M.pathDoorToGate++;
    if (assemblies.path.length < 30) {
      const o0 = floors[0].p;
      assemblies.path.push({ src: d.id, title: d.title, dls: d.dls, n: floors.length, pieces: floors.slice(0, 16).map(o => [o.p.name, +(o.p.x - o0.x).toFixed(2), +(o.p.y - g).toFixed(2), +(o.p.z - o0.z).toFixed(2), Math.round(o.p.yaw)]) });
    }
  }
  // garden beds: crops and greenery in clusters of three or more within 1.5 m of each other
  const greens = out.filter(o => o.k === 'crop' || o.k === 'green');
  const used = new Set();
  for (const o of greens) {
    if (used.has(o)) continue;
    const cl = [o]; used.add(o);
    for (let i = 0; i < cl.length; i++) for (const t of greens) if (!used.has(t) && Math.hypot(t.p.x - cl[i].p.x, t.p.z - cl[i].p.z) < 1.5) { cl.push(t); used.add(t); }
    if (cl.length < 3) continue;
    const w = Math.max(...cl.map(t => t.p.x)) - Math.min(...cl.map(t => t.p.x)), dd = Math.max(...cl.map(t => t.p.z)) - Math.min(...cl.map(t => t.p.z));
    M.bedSize.push([+Math.max(w, dd).toFixed(1), +Math.min(w, dd).toFixed(1)]);
    // the border round a bed: wall, fence, rail or floor pieces within 0.8 m of the cluster's box
    const bx = { x0: Math.min(...cl.map(t => t.p.x)) - 0.8, x1: Math.max(...cl.map(t => t.p.x)) + 0.8, z0: Math.min(...cl.map(t => t.p.z)) - 0.8, z1: Math.max(...cl.map(t => t.p.z)) + 0.8 };
    const border = out.filter(f => ['wall', 'rail', 'fence', 'floor', 'pot'].includes(f.k) && f.p.x > bx.x0 && f.p.x < bx.x1 && f.p.z > bx.z0 && f.p.z < bx.z1);
    if (assemblies.bed.length < 40) {
      const o0 = cl[0].p;
      assemblies.bed.push({ src: d.id, title: d.title, dls: d.dls, d: +Math.min(...cl.map(t => t.d)).toFixed(2), size: [+w.toFixed(1), +dd.toFixed(1)], n: cl.length,
        border: [...new Set(border.map(f => f.p.name))], pieces: [...cl, ...border].slice(0, 24).map(t => [t.p.name, +(t.p.x - o0.x).toFixed(2), +(t.p.y - g).toFixed(2), +(t.p.z - o0.z).toFixed(2), Math.round(t.p.yaw)]) });
    }
  }
  // single features with what stands within 2 m of them
  for (const [k, key] of [['pile', 'pile'], ['cart', 'cart'], ['seat', 'seat'], ['lamp', 'lamp'], ['hive', 'hive'], ['pot', 'pot']]) {
    for (const o of out.filter(o => o.k === k)) {
      if (assemblies[key].length >= 30) break;
      const by = out.filter(f => f !== o && Math.hypot(f.p.x - o.p.x, f.p.z - o.p.z) < 2 && !['floor', 'rail', 'post', 'wall', 'fence'].includes(f.k));
      assemblies[key].push({ src: d.id, title: d.title, dls: d.dls, d: +o.d.toFixed(2), with: by.map(f => f.k), pieces: [o, ...by].slice(0, 8).map(t => rel(t.p, o.p, g)) });
    }
  }
  perBuild.push({ id: d.id, title: d.title, dls: d.dls, area, outside: out.length, kinds, gates: out.filter(o => o.k === 'gate').length, doorSides: [...doorSides] });
}

// ---------------------------------------------------------------- summary

const share = k => +(seenKinds[k] / houses).toFixed(2);
const top5 = perBuild.slice().sort((a, b) => b.dls - a.dls).slice(0, 5);
const result = {
  about: 'Mined by lab/mine_yards.js from the top quarter by downloads of vanilla-only builds with known downloads (80 to 6,000 pieces), those with four or more roof pieces over 12 to 700 square metres. Distances in metres from the nearest roofed ground (0.5 m grid), heights from the ground (5th percentile of piece bottoms). Pieces given as [name, dx, y over ground, dz, yaw] from the first piece or the feature, in the build turned to its main axis.',
  builds: houses,
  topFive: top5.map(b => ({ id: b.id, title: b.title, dls: b.dls, gates: b.gates, kinds: b.kinds })),
  share: Object.fromEntries(Object.keys(seenKinds).sort((a, b) => seenKinds[b] - seenKinds[a]).map(k => [k, share(k)])),
  distance: Object.fromEntries(Object.entries(M.dist).filter(([, v]) => v.length >= 10).map(([k, v]) => [k, stats(v)])),
  againstWall: Object.fromEntries(Object.entries(M.againstWall).filter(([k]) => (M.dist[k] || []).length >= 10).map(([k, v]) => [k, +(v / M.dist[k].length).toFixed(2)])),
  fence: {
    kinds: M.fenceKinds, top: stats(M.fenceTop), byName: Object.fromEntries(Object.entries(M.fenceByName).map(([k, v]) => [k, { top: stats(v.top), foot: stats(v.foot) }])), lowWallTop: stats(M.lowWallTop), railHeight: stats(M.railHeight), postTop: stats(M.postTop),
    lines: M.fenceLines, closed: M.fenceClosed, runLength: stats(M.fenceRunLength), segment: stats(M.fenceSegment), sidesPerLine: stats(M.wrapSides),
    turnAtJoint: (() => { const h = {}; for (const t of M.fenceTurn) { const k = t < 3 ? 'straight' : t < 20 ? 'under 20' : t < 40 ? '20-40' : t < 60 ? '40-60' : t < 80 ? '60-80' : 'square'; h[k] = (h[k] || 0) + 1; } return h; })(),
    offAxis: (() => { const h = {}; for (const t of M.fenceOffAxis) { const k = t < 3 ? 'on the axis' : t < 15 ? 'under 15' : t < 30 ? '15-30' : '30-45'; h[k] = (h[k] || 0) + 1; } return h; })(),
    gapWidth: stats(M.fenceGapWidth),
  },
  yard: { depth: stats(M.yardDepth), depthDoorSide: stats(M.yardDepthFront) },
  gate: { n: M.gates, onDoorSide: M.gates ? +(M.gateOnDoorSide / M.gates).toFixed(2) : 0, toDoor: stats(M.gateToDoor), top: stats(M.gateTop), posts: stats(M.gatePosts), sitsIn: M.gateFence },
  path: { pieces: M.pathPieces, width: stats(M.pathWidth), doorToGate: M.pathDoorToGate },
  garden: { greens: M.greenNames, crops: M.cropNames, bedLong: stats(M.bedSize.map(v => v[0])), bedShort: stats(M.bedSize.map(v => v[1])) },
  // how deep pieces outside sit in the ground (metres under it; negative is above it), and how deep props clip
  sink: Object.fromEntries(Object.entries(M.sink).map(([k, v]) => [k, stats(v)])),
  clipDepth: stats(M.clipDepth),
  // turns at the joints of lines of four or more segments, in 5 degree steps: how winding fences are laid
  turnSteps: (() => { const h = {}; for (const t of M.turnFine) { const k = 5 * Math.round(t / 5); h[k] = (h[k] || 0) + 1; } return h; })(),
  // the most used pieces of each kind outside the walls
  names: Object.fromEntries(Object.entries(M.names).map(([k, t]) => [k, Object.fromEntries(Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 12))])),
  assemblies,
};
// the earliest biome each assembly can be built in (the hardest material among its pieces, lib/pieces.js needs)
for (const list of Object.values(assemblies)) for (const a of list) a.biome = ORD[needsOf(a.pieces.map(p => p[0]))];
return result;
}

// the well-liked builds, and every vanilla build for the measures the well-liked ones are too few to give (gates,
// garden beds, fence corners); the assemblies come from the second, most downloaded first
const liked = mine(top), all = mine(vanillaAll);
const outJson = { about: liked.about, wellLiked: { ...liked, assemblies: undefined }, allVanilla: { ...all, assemblies: undefined }, assemblies: all.assemblies };
delete outJson.wellLiked.about; delete outJson.allVanilla.about;
fs.writeFileSync(outPath, JSON.stringify(outJson, null, 1));
console.log(JSON.stringify({ wellLiked: outJson.wellLiked }).slice(0, 3000));
console.log(Object.fromEntries(Object.entries(all.assemblies).map(([k, v]) => [k, v.length])));
