// Furniture assemblies in the corpus (track G, showcase review 2026-11-12): the clusters of building pieces, furniture,
// stations, stands and decor that corpus builders set together against a wall or round a bed or a station so they read
// as one piece of furniture: a kitchen stove with its pans and prep counter, a shelving unit of beams and 1 x 1 floors
// with stands on it, a bar counter with kegs, a cabinet of chests framed by half walls, a canopy bed, a forge corner, an
// armor display. Each cluster is written in the frame of the wall it backs onto (x along the wall, z into the room, y
// over the floor), so lib/assemblies.js can place it at any spot and facing.
//   node --max-old-space-size=3000 lab/mine_assemblies.js <folder of .blueprint> [out.json]
// Reads one build at a time (index.json beside the builds gives title, maker, downloads, votes). Writes every cluster
// with its type, members and source build; lab/select_assemblies.js picks the recipes from it.
const fs = require('fs'), path = require('path');
const BP = require('../lib/blueprint.js'), Ck = require('../lib/checks.js');

const dir = process.argv[2] || '/work/bp', out = process.argv[3] || '/tmp/assemblies-work/clusters.json';
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) { if (!/^_/.test(e.name)) walk(path.join(d, e.name)); } else if (/\.blueprint$/.test(e.name) && !/^hs_|biomeblueprint|overdrive/i.test(e.name)) files.push(path.join(d, e.name)); } })(dir);
const idxF = path.join(dir, 'index.json');
const index = fs.existsSync(idxF) ? new Map(JSON.parse(fs.readFileSync(idxF, 'utf8')).map(r => [r.slug, r])) : new Map();
const MOD = /^(kg_|GB_|CastleKit|MB|mm_|BBH|rk_|Piece_vf|OdinsKingdom|h_|\$|Hayze|rae_|teq_|tkd_|rkc_)/;

// seeds: the piece a cluster grows from, by type
const SEED = [
  ['stove', /^(piece_cauldron|piece_cookingstation|piece_cookingstation_iron|piece_oven|piece_preptable|cauldron_ext3_butchertable|piece_MeadCauldron)$/],
  ['brew', /^(fermenter|barrell)$/],
  ['forge', /^(forge|blackforge)$/],
  ['work', /^(piece_workbench|piece_artisanstation|piece_stonecutter|piece_spinningwheel)$/],
  ['mage', /^(piece_magetable|piece_magetable_ext|piece_magetable_ext2)$/],
  ['bed', /^(bed|piece_bed02|ashwood_bed|dvergrprops_bed)$/],
  ['armor', /^ArmorStand$/],
  ['wardrobe', /^piece_chest_warderobe$/],
  ['stands', /^itemstandh$/],
  ['chest', /^(piece_chest_wood|piece_chest|piece_chest_blackmetal|piece_chest_barrel|dvergrprops_crate|dvergrprops_barrel|dvergrprops_crate_long)$/],
];
const seedOf = n => { for (const [t, re] of SEED) if (re.test(n)) return t; return null; };
// small building pieces that builders use as furniture parts (lab/mine_creative.js BUILT_EXTRA and the counters,
// shelves and plinths of docs/ROOM_STUDY.md "Custom furniture")
const BUILT = /^(wood|darkwood|ashwood|woodiron|stone|blackmarble|grausten|crystal|Piece_grausten|piece_grausten)_(beam|beam_1|beam_26|beam_45|beam_2m|beam_1m|pole|pole2|pole_1m|pole_2m|wall_half|wall_quarter|halfwall_1x2|quarterwall_1x1|ledge|floor_1x1|floor_2x2|fence|log|arch|wall_1x1|wall_2x1|2x1x1|1x1|stair|decowall|decowall_divider|beam4x4|roof_top|roof_icorner)$|^wood_ledge$|^wood_(log_\d+|pole_log|pole_log_4)$|^(blackmarble_1x1|blackmarble_2x1x1|stone_wall_1x1|stone_wall_2x1|stone_floor_1x1|wood_floor_1x1|wood_window|darkwood_decowall|darkwood_arch|stone_arch|blackmarble_arch|wood_wall_roof_top|piece_dvergr_wood_wall|dvergrprops_wood_beam|dvergrprops_wood_pole|dvergrprops_wood_wall|dvergrprops_shelf|dvergrprops_stool|wood_wall_log|wood_wall_log_4x0\.5|wood_dragon1|iron_floor_1x1|iron_wall_1x1|Piece_grausten_floor_1x1|Piece_grausten_wall_1x2|Piece_grausten_wall_2x2|ashwood_wall_arch|ashwood_halfwall_1x2|ashwood_quarterwall_1x1|ashwood_decowall_divider)$/;
const FURN_ROLES = new Set(['table', 'seat', 'storage', 'bed', 'craft', 'deco', 'light', 'rug', 'misc', 'clutter', 'fire']);
const SKIP = /^(portal|Cart|piece_beehive|piece_sapcollector|guard_stone|piece_shieldgenerator|piece_turret|smelter|blastfurnace|charcoal_kiln|windmill|piece_spinningwheel_x|eitrrefinery|bonfire|TreasureChest|Pickable|LocationProxy|vfx_|sfx_|fx_)/;
const OVER = new Set(['roof', 'roofTop', 'roofCorner', 'floor']);
const rotq = (q, v) => { const [x, y, z, w] = q, ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x]; };
const yawOf = q => ((Math.atan2(2 * (q[3] * q[1] + q[0] * q[2]), 1 - 2 * (q[1] * q[1] + q[0] * q[0])) * 180 / Math.PI) % 360 + 360) % 360;
const r2 = v => Math.round(v * 100) / 100;

const clusters = [];
let builds = 0, done = 0;
for (const f of files) {
  let d;
  try { d = BP.parse(fs.readFileSync(f, 'utf8')); } catch (e) { continue; }
  if (!d.pieces.length || d.pieces.some(p => MOD.test(p.name))) continue;
  builds++;
  const base = path.basename(f, '.blueprint'), slug = base.split('__')[0], meta = index.get(slug) || {};
  const ps = d.pieces;
  const bx = ps.map(p => Ck.aabb(p));
  const near = Ck.index(bx);
  const role = i => bx[i].info.role;
  const around = (x, z, r, y0, y1) => [...near({ x0: x - r, x1: x + r, z0: z - r, z1: z + r }, 0)].filter(j => bx[j].y1 > y0 && bx[j].y0 < y1);
  const covers = (j, x, z) => bx[j].x0 <= x && bx[j].x1 >= x && bx[j].z0 <= z && bx[j].z1 >= z;
  const cx = i => (bx[i].x0 + bx[i].x1) / 2, cz = i => (bx[i].z0 + bx[i].z1) / 2;
  const floorTop = (x, z, y) => { let t = null; for (const j of around(x, z, 0.05, y - 3, y + 0.3)) if (role(j) === 'floor' && covers(j, x, z) && bx[j].y1 <= y + 0.25 && (t == null || bx[j].y1 > t)) t = bx[j].y1; return t; };
  const roofed = (x, z, y) => around(x, z, 0.05, y + 0.3, y + 15).some(j => OVER.has(role(j)) && covers(j, x, z) && bx[j].y0 > y + 0.3);
  // the room floor under a point: the lowest floor top within 2.5 m under it, taken 0.8 m round (a 1 x 1 floor set up
  // as a shelf is no floor)
  const roomFloor = (x, z, y) => { let lo = floorTop(x, z, y); if (lo == null) return null; for (const [dx, dz] of [[0.9, 0], [-0.9, 0], [0, 0.9], [0, -0.9]]) { const t = floorTop(x + dx, z + dz, y); if (t != null && t < lo && t > y - 2.5) lo = t; } return lo; };
  const isWall = j => (role(j) === 'wall' || role(j) === 'window' || role(j) === 'door') && bx[j].y1 - bx[j].y0 >= 1.6;
  const used = new Set();
  const order = ps.map((p, i) => [i, seedOf(p.name)]).filter(x => x[1]).sort((a, b) => SEED.findIndex(s => s[0] === a[1]) - SEED.findIndex(s => s[0] === b[1]));
  for (const [s, type] of order) {
    if (used.has(s)) continue;
    const p = ps[s];
    const ft = roomFloor(cx(s), cz(s), bx[s].y0 + 0.1);
    if (ft == null || !roofed(cx(s), cz(s), Math.max(bx[s].y0, ft + 1.2))) continue;
    // grow: pieces touching the cluster (0.2 m gap), from the floor to 2.9 m over it, within 2.2 m of the seed
    const mem = [s], inC = new Set([s]);
    for (let k = 0; k < mem.length && mem.length < 60; k++) {
      const m = bx[mem[k]];
      for (const j of near({ x0: m.x0 - 0.2, x1: m.x1 + 0.2, z0: m.z0 - 0.2, z1: m.z1 + 0.2 }, 0)) {
        if (inC.has(j) || used.has(j)) continue;
        const b = bx[j], n = ps[j].name, r = role(j);
        if (SKIP.test(n)) continue;
        if (b.y0 > m.y1 + 0.2 || b.y1 < m.y0 - 0.2) continue;
        if (b.y0 < ft - 0.15 || b.y1 > ft + 2.9) continue;
        if (Math.hypot(cx(j) - cx(s), cz(j) - cz(s)) > 2.2) continue;
        const built = BUILT.test(n);
        if (!built && (OVER.has(r) || r === 'wall' || r === 'window' || r === 'door' || r === 'stair' || r === 'beam' || r === 'pole' || r === 'fence' || r === 'gable')) continue;
        if (!built && !FURN_ROLES.has(r)) continue;
        // a 2 x 2 floor at the room's floor is the floor
        if (r === 'floor' && b.y1 < ft + 0.15) continue;
        // a built piece the full height of the room is structure
        if (built && b.y1 - b.y0 > 2.2) continue;
        inC.add(j); mem.push(j);
      }
    }
    if (mem.length < 3) continue;
    // the wall it backs onto: the nearest full-height wall face within 0.9 m of the cluster's box
    const cb = { x0: Math.min(...mem.map(i => bx[i].x0)), x1: Math.max(...mem.map(i => bx[i].x1)), z0: Math.min(...mem.map(i => bx[i].z0)), z1: Math.max(...mem.map(i => bx[i].z1)) };
    if (cb.x1 - cb.x0 > 5 || cb.z1 - cb.z0 > 5) continue;
    const mx = (cb.x0 + cb.x1) / 2, mz = (cb.z0 + cb.z1) / 2;
    let wall = null, wd = Infinity, walls = [];
    for (const j of near({ x0: cb.x0 - 0.9, x1: cb.x1 + 0.9, z0: cb.z0 - 0.9, z1: cb.z1 + 0.9 }, 0)) {
      if (!isWall(j) || bx[j].y0 > ft + 1.0 || bx[j].y1 < ft + 1.2) continue;
      const nrm = rotq(ps[j].q, [0, 0, 1]);
      if (Math.abs(nrm[1]) > 0.3) continue;
      const nl = Math.hypot(nrm[0], nrm[2]), nx = nrm[0] / nl, nz = nrm[2] / nl;
      // distance from the cluster's middle to the wall's plane, and which side the cluster is on
      const dd = (mx - ps[j].x) * nx + (mz - ps[j].z) * nz;
      // the wall's face nearest the cluster: the cluster box's side towards the wall
      const half = Math.abs(nx) * (cb.x1 - cb.x0) / 2 + Math.abs(nz) * (cb.z1 - cb.z0) / 2;
      const gap = Math.abs(dd) - half;
      if (gap > 0.9 || gap < -0.6) continue;
      walls.push({ j, nx: dd >= 0 ? nx : -nx, nz: dd >= 0 ? nz : -nz, gap, plane: ps[j].x * nx + ps[j].z * nz, n: [nx, nz] });
      if (gap < wd) { wd = gap; wall = walls[walls.length - 1]; }
    }
    // the frame: z into the room from the wall, or the seed's own facing when it stands free
    let ez, F, ox, oz;
    if (wall) {
      ez = [wall.nx, wall.nz];
      // the wall's face: its plane moved half its thickness towards the room
      const th = Math.min(bx[wall.j].x1 - bx[wall.j].x0, bx[wall.j].z1 - bx[wall.j].z0) / 2;
      const dPlane = (mx - ps[wall.j].x) * ez[0] + (mz - ps[wall.j].z) * ez[1];
      const face = Math.min(th, 0.15);
      ox = mx - ez[0] * (dPlane - face); oz = mz - ez[1] * (dPlane - face);
    } else {
      const f = rotq(p.q, [0, 0, 1]); const l = Math.hypot(f[0], f[2]) || 1;
      ez = [f[0] / l, f[2] / l];
      ox = mx; oz = mz;
    }
    F = Math.atan2(ez[0], ez[1]) * 180 / Math.PI;
    const ex = [Math.cos(F * Math.PI / 180), -Math.sin(F * Math.PI / 180)];
    // a second wall at right angles: a corner piece
    const corner = wall && walls.some(w => w !== wall && Math.abs(w.nx * wall.nx + w.nz * wall.nz) < 0.2);
    const members = mem.map(i => {
      const q = ps[i];
      const dx = q.x - ox, dz = q.z - oz;
      const up = rotq(q.q, [0, 1, 0]);
      const m = [q.name, r2(dx * ex[0] + dz * ex[1]), r2(q.y - ft), r2(dx * ez[0] + dz * ez[1]), Math.round(((yawOf(q.q) - F) % 360 + 360) % 360)];
      // turned off the vertical: keep its quaternion in the frame (the frame's turn taken off: qYaw(-F) * q)
      if (up[1] < 0.98) { const h = -F * Math.PI / 360, a = [0, Math.sin(h), 0, Math.cos(h)], b = q.q;
        m.push([a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]].map(v => +v.toFixed(4))); }
      const t = String(q.info || '').replace(/^"|"$/g, '');
      if (t && /^(itemstand|ArmorStand|sign)/.test(q.name)) m.push({ info: t });
      return m;
    });
    const xs = mem.map(i => bx[i]);
    // the box in the frame (from the members' boxes' corners)
    const loc = (x, z) => [(x - ox) * ex[0] + (z - oz) * ex[1], (x - ox) * ez[0] + (z - oz) * ez[1]];
    let lx0 = Infinity, lx1 = -Infinity, lz0 = Infinity, lz1 = -Infinity;
    for (const b of xs) for (const [x, z] of [[b.x0, b.z0], [b.x0, b.z1], [b.x1, b.z0], [b.x1, b.z1]]) { const [a, c] = loc(x, z); lx0 = Math.min(lx0, a); lx1 = Math.max(lx1, a); lz0 = Math.min(lz0, c); lz1 = Math.max(lz1, c); }
    const h = Math.max(...xs.map(b => b.y1)) - ft;
    for (const i of mem) used.add(i);
    clusters.push({ type, seed: p.name, wall: wall ? (corner ? 'corner' : 'back') : 'none', foot: [r2(lx0), r2(lx1), r2(lz0), r2(lz1)], h: r2(h), members,
      src: { file: path.relative(dir, f), title: meta.title || d.meta.Name || slug, by: meta.by || d.meta.Creator || '', cat: path.basename(path.dirname(f)), dls: +meta.dls || 0, votes: +meta.votes || 0 } });
  }
  if (++done % 200 === 0) process.stderr.write(`${done} builds, ${clusters.length} clusters\n`);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ builds, clusters }));
console.log(`${builds} vanilla builds, ${clusters.length} clusters -> ${out}`);
