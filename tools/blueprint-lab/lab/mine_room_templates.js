// Room templates from the best-liked builds: every clean furnished room as a layout the decorator can fit to its own
// rooms (D-058). node lab/mine_room_templates.js <corpus dir> <chosen.csv> [out json]
//
// chosen.csv is the list lab/learn_interior.py writes with --list (the top half of the valheimians builds by
// popularity and every design Tyler marked Yes, kept when they have an interior). Rooms are read with the decorator's
// own reader (readLevel), so a template is in the same terms as the rooms it is fitted to. For each room: its kind,
// size in the frame of its main door (u across, v into the room), its doors and windows, and every piece of furniture
// with its place tied to the walls (against the left wall, 1 m off the far wall, in the middle) or to the piece it
// belongs with (seats round a table, a chest at the foot of a bed, a pot on the fire).
// Rooms are kept only when clean: nothing through anything, the doors clear, every piece on the floor, a sensible
// number of pieces for the size, few pieces the decorator does not know. Near copies are dropped.
const fs = require('fs'), path = require('path');
const lab = path.join(__dirname, '..');
const P = require(lab + '/lib/pieces.js'), D = require(lab + '/lib/decorate.js'), B = require(lab + '/lib/blueprint.js');
const { floorLevels, size, obox, overlap, ptDist, pyaw, norm } = D._int;
const F = D.FURNITURE;

const root = process.argv[2] || '/home/claude/corpus';
const chosenPath = process.argv[3] || '/tmp/int/chosen.csv';
const outPath = process.argv[4] || path.join(lab, 'data/room-templates.json');
// the rooms as built go to a side file for the pictures (not committed): GEO=/tmp/int/room-geo.json
const geoPath = process.env.GEO || null;
const geo = {};

// ---------------------------------------------------------------- names the decorator knows
// Vanilla pieces outside the decorator's table stand in as the nearest piece of the same use and size.
const ALIAS = {
  piece_chest_private: 'piece_chest', piece_chest_treasure: 'piece_chest', piece_chest_warderobe: 'piece_chest',
  piece_chest_grausten: 'piece_chest_blackmetal', TreasureChest_mountaincave: 'piece_chest', TreasureChest_forestcrypt: 'piece_chest_wood',
  TreasureChest_dvergrtower: 'piece_chest', TreasureChest_meadows: 'piece_chest_wood', TreasureChest_blackforest: 'piece_chest_wood',
  sign_notext: 'sign', fire_pit_iron: 'fire_pit', piece_blackmarble_bench: 'piece_bench01', piece_blackwood_bench01: 'piece_bench01',
  piece_blackmarble_throne: 'piece_throne01', piece_throne02: 'piece_throne01', dvergrprops_bed: 'bed', dvergrprops_table: 'piece_table',
  piece_blackmarble_table: 'piece_table', piece_groundtorch_blue: 'piece_groundtorch_mist', dvergrprops_lantern_standing: 'piece_groundtorch_mist',
  dvergrprops_chair: 'piece_chair02', dvergrprops_stool: 'piece_chair', piece_stool: 'piece_chair',
  rug_Bjorn: 'rug_fur', rug_moose: 'rug_deer', piece_drawer: 'piece_chest_wood', piece_chair_runed: 'piece_chair02', piece_bone_throne: 'piece_throne01',
  barrell: 'piece_chest_barrel', corewood_crate_bal: 'dvergrprops_crate',
};
// decoration the templates cannot carry (statues, trophies, a portal, piles of coin): left out of the template without
// counting against the room
const IGNORE = /^(goblinking_totemholder|portal_wood|portal|blackmarble_head0\d|treasure_pile|piece_xmastree|guard_stone|piece_jackoturnip|piece_Lavalantern|piece_wisplure|cauldron_ext\d_.*|piece_magetable_ext\d?|piece_beehive|bone_stack|wood_yggdrasil_stack|blackmarble_pile|MS_.*|piece_shieldgenerator|piece_bathtub|trophy.*|piece_cookingstation_.*)$/;
function canon(n) {
  if (F[n]) return n;
  if (ALIAS[n]) return ALIAS[n];
  const m = /^piece_banner(\d+)$/.exec(n);
  if (m) return 'piece_banner0' + (((+m[1] - 1) % 5) + 1);
  return null;
}
// pieces that are not vanilla: a room holding any of them is skipped
const MODDED = /^(kg_|GB_|CastleKit|MB|mm_|h_chain|Heavy|BBH|OdinsKingdom|rk_|Piece_vf)/;

// roles for telling a room's kind, as lab/learn_interior.py does
const ROLE = [
  [/rug|carpet/, 'rug'], [/bed/, 'bed'], [/table|piece_workbench$/, 'table'], [/bench|throne|chair|stool/, 'seat'],
  [/chest|barrel|drawer|crate/, 'storage'], [/hearth|fire_pit/, 'fire'],
  [/cookingstation|cauldron|oven|forge|smelter|kiln|blastfurnace|anvil|grindstone|tanning|spinning|stonecutter|artisan|magetable|ext\d|workbench|windmill|refinery|fermenter|beehive|bathtub|cart|portal|press|preptable/, 'craft'],
  [/torch|lantern|brazier|candle|Candle|wisplure|lamp/, 'light'],
  [/itemstand|ArmorStand|sign|banner|trophy|raven|wolf|dragon|xmas|garland|jackoturnip|totem|statue|head|guard_stone/, 'deco'],
];
const roleOf = n => { for (const [re, r] of ROLE) if (re.test(n)) return r; return 'misc'; };
function classify(names, cat, area) {
  const all = names.join(' ');
  const rc = {};
  for (const n of names) { const r = roleOf(n); rc[r] = (rc[r] || 0) + 1; }
  const beds = rc.bed || 0, seats = rc.seat || 0, tables = rc.table || 0, fire = rc.fire || 0, stor = rc.storage || 0;
  let k;
  if (/forge|smelter|blastfurnace|charcoal_kiln/.test(all) && !beds) k = 'smithy';
  else if (/workbench|stonecutter|artisan|spinningwheel|magetable/.test(all) && !beds && tables <= 2 && seats < 4) k = 'workshop';
  else if (beds && seats + tables <= Math.max(3, beds * 2) && !fire) k = 'sleeping';
  else if (beds) k = 'home';
  else if (stor >= 3 && stor >= 0.5 * Math.max(1, names.length - (rc.rug || 0) - (rc.light || 0))) k = 'storage';
  else if (seats >= 8 || tables >= 3) k = 'tavern';
  else if (/cauldron|oven|preptable|cookingstation/.test(all) && seats <= 4) k = 'kitchen';
  else if (fire || /throne/.test(all)) k = 'hall';
  else if (seats + tables >= 2) k = 'living';
  else k = 'other';
  if (cat === 'temple' && ['hall', 'living', 'tavern', 'other'].includes(k) && area >= 20 && seats >= 2) k = 'temple';
  return k;
}

// ---------------------------------------------------------------- reading the corpus
const files = new Map();
for (const sub of ['vh', 'pb', 'hs']) (function walk(d) {
  if (!fs.existsSync(d)) return;
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p); else if (f.name.endsWith('.blueprint')) files.set(f.name.slice(0, -10), p);
  }
})(path.join(root, sub));
const lines = fs.readFileSync(chosenPath, 'utf8').trim().split(/\r?\n/);
const head = lines[0].split(',');
const chosen = lines.slice(1).map(l => { const v = l.split(','); const o = {}; head.forEach((h, i) => { o[h] = v[i]; }); return o; });

const r2 = v => Math.round(v * 100) / 100;
const q4 = v => Math.round(v * 4) / 4;
const stats = { builds: 0, rooms: 0, kept: 0, why: {}, unk: {}, byKindWhy: {} };
let curKind = '';
const why = k => { stats.why[k] = (stats.why[k] || 0) + 1; const kk = curKind + ' ' + k; stats.byKindWhy[kk] = (stats.byKindWhy[kk] || 0) + 1; };
const templates = [];

function loadBuild(file) {
  const bp = B.parse(fs.readFileSync(file, 'utf8'));
  const ps = [];
  for (const q of bp.pieces) {
    const tilt = Math.abs(q.q[0]) > 0.05 || Math.abs(q.q[2]) > 0.05;
    const scaled = q.s.some(v => Math.abs(v - 1) > 0.05);
    const info = P.piece(q.name);
    const furn = !info.structural && info.role !== 'nature' && info.role !== 'misc';
    if (furn && (tilt || scaled)) continue;
    // a scaled roof still keeps the rain off: kept for the reader's ceiling (at its unscaled size); other scaled
    // structure is left out
    if (!furn && scaled && !/^(roof|roofTop|roofCorner|gable)$/.test(info.role)) continue;
    ps.push({ name: q.name, x: q.x, y: q.y, z: q.z, q: q.q, yaw: pyaw({ q: q.q }), decor: furn || !!canon(q.name), tilt });
  }
  // turn the build so its walls run along the axes
  const hist = new Map();
  for (const p of ps) if (!p.decor && !p.tilt && D._int.WALLISH.has(P.piece(p.name).role)) { const a = Math.round(norm(p.yaw) % 90); hist.set(a, (hist.get(a) || 0) + 1); }
  let rot = [...hist.entries()].sort((a, b) => b[1] - a[1])[0];
  rot = rot ? rot[0] : 0;
  if (rot > 45) rot -= 90;
  if (Math.abs(rot) > 0.5) {
    const a = rot * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    for (const p of ps) {
      // a yaw of -rot about y: world (x, z) turns so that yaw - rot lines up
      const x = p.x, z = p.z;
      p.x = x * ca - z * sa; p.z = x * sa + z * ca;
      p.yaw = norm(p.yaw - rot);
      const h = p.yaw * Math.PI / 360;
      p.q = [0, Math.sin(h), 0, Math.cos(h)];
    }
  }
  return ps;
}

// ---------------------------------------------------------------- one room as a template
function frameOf(room, door) {
  const nx = Math.abs(door.nx) > Math.abs(door.nz) ? Math.sign(door.nx) : 0, nz = nx ? 0 : Math.sign(door.nz);
  const ux = nz, uz = -nx; // the frame is the world turned to the door's yaw: u is the door's local +x
  const u = (x, z) => (x - door.x) * ux + (z - door.z) * uz, v = (x, z) => (x - door.x) * nx + (z - door.z) * nz;
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const c of room.cells) { const a = u(c.x, c.z), b = v(c.x, c.z); u0 = Math.min(u0, a); u1 = Math.max(u1, a); v0 = Math.min(v0, b); v1 = Math.max(v1, b); }
  u0 -= 0.25; u1 += 0.25; v0 -= 0.25; v1 += 0.25;
  const uc = (u0 + u1) / 2;
  return { nx, nz, ux, uz, u, v, u0, u1, v0, v1, uc, W: u1 - u0, D: v1 - v0, yawOf: yaw => norm(yaw - norm(Math.atan2(nx, nz) * 180 / Math.PI)) };
}
// extents of a footprint along the frame's axes, for a yaw in the frame
function ext(name, fyaw) {
  const [w, , d] = size(name), a = fyaw * Math.PI / 180;
  return [Math.abs(Math.cos(a)) * w / 2 + Math.abs(Math.sin(a)) * d / 2, Math.abs(Math.sin(a)) * w / 2 + Math.abs(Math.cos(a)) * d / 2];
}
// where a piece sits along one axis: against a wall (gap), a little off it, in the middle, or a share of the way
function anchor(c, e, lo, hi, loK, hiK) {
  const gLo = c - e - lo, gHi = hi - (c + e), mid = (lo + hi) / 2, len = hi - lo;
  if (Math.min(gLo, gHi) < 1.2) return gLo <= gHi ? loK + r2(Math.max(0, gLo)) : hiK + r2(Math.max(0, gHi));
  if (Math.abs(c - mid) < 0.35) return 'C' + r2(c - mid);
  return 'P' + r2((c - mid) / len);
}

function mineRoom(build, m, all) {
  stats.rooms++;
  if (m.area < 5 || m.area > 180) return null;
  // furniture of this room
  const items = [];
  let unknown = 0, modded = 0;
  for (const p of all) {
    if (!p.decor) continue;
    const cn = canon(p.name);
    const f = cn ? F[cn] : null;
    const at = f ? f.at : null;
    const lift = p.y - (f && f.base || 0) - m.stand;
    if (lift < -0.25 || lift > 4.2) continue;
    const inside = m.inside(p.x, p.z);
    let near = inside;
    if (!near) for (const [dx, dz] of [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]) if (m.inside(p.x + dx, p.z + dz)) near = true;
    if (!near) continue;
    if (MODDED.test(p.name)) { modded++; continue; }
    if (!f) { if (lift < 0.5 && inside && !IGNORE.test(p.name) && !/^(wood_ledge|raise|paved_road|mud_road|iron_grate)$/.test(p.name)) { unknown++; stats.unk[p.name] = (stats.unk[p.name] || 0) + 1; } continue; }
    if (at === 'out') { if (inside) unknown++; continue; }
    items.push({ p, n: cn, f, at, lift, inside });
  }
  if (items.filter(it => it.at !== 'rug' && it.inside).length < 3) return null;
  stats.furnished = (stats.furnished || 0) + 1;
  const kind0 = classify(items.filter(it => it.inside && it.lift < 0.3).map(it => it.p.name), build.cat, m.area);
  curKind = kind0;
  if (modded) return why('modded');
  if (m.covered < 0.5) {
    if (process.env.DBG) { const ab = {}; for (const p of all) if (p.y > m.stand + 1.2 && p.y < m.stand + 12 && m.inside(p.x, p.z)) { const r = P.piece(p.name).role; ab[p.name + '/' + r] = (ab[p.name + '/' + r] || 0) + 1; } console.error('opendbg', curKind, m.area, m.covered.toFixed(2), Object.entries(ab).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x.join(':')).join(' ')); }
    return why('open');
  }
  // the doors clear: a box the door's width and 1.2 m deep inside each door
  const floorNow = items.filter(it => ['floor', 'wall'].includes(it.at) && it.lift < 0.3 && it.inside)
    .map(it => obox(it.p.x, it.p.z, size(it.n)[0], size(it.n)[2], pyaw(it.p)));
  const clear = d => {
    const zb = obox(d.x + d.nx * (d.ht + 0.6), d.z + d.nz * (d.ht + 0.6), Math.max(0.8, d.w - 0.2), 1.2, Math.atan2(d.nx, d.nz) * 180 / Math.PI);
    return !floorNow.some(b => overlap(zb, b, -0.02));
  };
  const real = m.doors.filter(d => !d.open);
  if (real.some(d => !clear(d))) return why('door blocked');
  // the main way in: a door, else a clear opening in the walls
  let doors = real.length ? real : m.doors.filter(d => d.w >= 1 && clear(d));
  // the reader puts an open way in at the middle of the open stretch; a person walks in wherever it is clear, so slide
  // a 1 m way along every open stretch in the walls (an arch, a doorway with no door) and keep the clear place nearest
  // its middle
  const slide = kinds => {
    const out = [];
    for (const face of m.faces) for (const run of face.runs) {
      if (!kinds.includes(run.kind) || run.a1 - run.a0 < 1.0) continue;
      const mid = (run.a0 + run.a1) / 2;
      const ts = [];
      for (let t = run.a0 + 0.5; t <= run.a1 - 0.5 + 1e-6; t += 0.25) ts.push(t);
      ts.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
      for (const t of ts) {
        const d = { x: face.px(t), z: face.pz(t), nx: face.nx, nz: face.nz, w: 1, ht: face.ht, open: true, run: run.a1 - run.a0 };
        if (clear(d)) { out.push(d); break; }
      }
    }
    return out.sort((a, b) => b.run - a.run);
  };
  if (!doors.length) doors = slide(['open']).filter(d => d.ht > 0);
  if (!doors.length && m.stairs.length) {
    // a loft: the way in is the top of the stairs or ladder, facing the middle of the room
    const st = m.stairs[0];
    const dx = m.cx - st.b.x, dz = m.cz - st.b.z;
    const ax = Math.abs(dx) > Math.abs(dz);
    const fp = floorNow.some(b => overlap({ ...st.b, hw: st.b.hw + 0.5, hd: st.b.hd + 0.5 }, b, -0.02));
    if (!fp) doors = [{ x: st.b.x, z: st.b.z, nx: ax ? Math.sign(dx) : 0, nz: ax ? 0 : Math.sign(dz), w: 1, ht: 0, stair: true }];
  }
  // an open side with no wall at all (an open shed, a tent): the clear stretch of the longest
  if (!doors.length) doors = slide(['open', 'edge']).slice(0, 1);
  if (!doors.length) {
    if (process.env.DBG) { const ds = all.filter(p => P.piece(p.name).role === 'door' && Math.abs(p.y - m.stand) < 3 && m.cells.some(c => Math.hypot(c.x - p.x, c.z - p.z) < 1.2)); console.error('noway', build.id, m.area, m.doors.length, m.doors.map(d => (d.open ? 'o' : 'r') + d.w.toFixed(1) + (clear(d) ? 'c' : 'x') + (d.ht ? 'w' : 'e')).join(' '), 'stairs', m.stairs.length, 'cov', m.covered.toFixed(2), 'doorpieces', ds.map(p => p.name + '@' + (p.y - m.stand).toFixed(2) + '/' + P.piece(p.name).size.join('x') + '/' + P.piece(p.name).shape).join(' ')); }
    return why('no way in');
  }
  const floorish = items.filter(it => ['floor', 'wall', 'rug'].includes(it.at) && it.lift < 0.3 && it.inside);
  if (unknown > Math.max(1, 0.2 * (floorish.length + unknown))) return why('unknown pieces');
  // frame: the door with the most room in front of it
  const fr0 = doors.map(d => ({ d, fr: frameOf(m, d) })).sort((a, b) => b.fr.D - a.fr.D)[0];
  const { d: door, fr } = fr0;
  const W = fr.W, Dp = fr.D;
  if (W < 2 || Dp < 2) return why('thin');
  // walls at an odd angle to the frame (a wing turned 30 degrees off the rest of the build): the frame's anchors would
  // be wrong. Walls square to the frame or at 45 degrees (an eight-sided room) are fine.
  let sqLen = 0, oddLen = 0;
  for (const fc of m.faces) {
    if (fc.edge) continue;
    const a = ((Math.atan2(fc.uz, fc.ux) * 180 / Math.PI) % 90 + 90) % 90;
    if (Math.min(a, 90 - a) < 8 || Math.abs(a - 45) < 8) sqLen += fc.len; else oddLen += fc.len;
  }
  if (oddLen > 0.4 * (sqLen + oddLen)) return why('turned walls');
  // place every piece in the frame
  const recs = [];
  for (const it of items) {
    const { p, n, f, at } = it;
    const fy = fr.yawOf(pyaw(p));
    const u = fr.u(p.x, p.z) - fr.uc, v = fr.v(p.x, p.z) - fr.v0;
    const rec = { n, f, u, v, yaw: fy, lift: it.lift, at, p, it, b: obox(p.x, p.z, size(n)[0], size(n)[2], pyaw(p)) };
    if (at === 'floor' || at === 'wall' || at === 'rug') {
      if (it.lift > 0.3 || !it.inside) continue;
      rec.kind = 'floor';
    } else if (at === 'fire') rec.kind = 'fire';
    else if (at === 'top') rec.kind = 'top';
    else if (at === 'mount') { if (it.lift < 0.5) continue; rec.kind = 'mount'; }
    else if (at === 'hang') { if (it.lift < 1.5) continue; rec.kind = 'hang'; }
    else continue;
    recs.push(rec);
  }
  const floor = recs.filter(r => r.kind === 'floor' && r.at !== 'rug');
  // clean: nothing through anything (seats tucked under a table excepted). Pieces of one kind set in a row (chests side
  // by side, two tables end to end) may touch a little more, since the sizes are the decorator's and run a little large.
  // One or two pieces through another are left out (the smaller of each pair); more and the room is skipped.
  const clips = [];
  for (let i = 0; i < floor.length; i++) for (let j = i + 1; j < floor.length; j++) {
    const a = floor[i], b = floor[j];
    const seatTable = (a.f.cat === 'seat' && b.f.cat === 'table') || (b.f.cat === 'seat' && a.f.cat === 'table');
    const same = a.f.cat === b.f.cat;
    if (overlap(a.b, b.b, seatTable ? -0.4 : same ? -0.3 : -0.15)) clips.push([a, b]);
  }
  if (clips.length > 2) { if (process.env.DBG) console.error('clipdbg', curKind, clips[0][0].n, clips[0][1].n); return why('clipping'); }
  for (const [a, b] of clips) {
    if (a.drop || b.drop) continue;
    const sm = size(a.n)[0] * size(a.n)[2] < size(b.n)[0] * size(b.n)[2] ? a : b;
    sm.drop = true; floor.splice(floor.indexOf(sm), 1);
  }
  for (const a of floor) for (const s of m.near(a.p.x, a.p.z, a.b.r + 0.2)) {
    if (s.role === 'floor' || s.role === 'rug' || s.role === 'nature' || s.role === 'beam' || s.role === 'misc' || s.role === 'roof') continue;
    if (s.y1 < m.stand + 0.2 || s.y0 > m.stand + 1.0) continue;
    if (overlap(s.b, a.b, -0.2)) { a.intoWall = true; break; }
  }
  if (floor.filter(a => a.intoWall).length > 2) return why('into walls');
  for (const a of floor.filter(a2 => a2.intoWall)) { a.drop = true; floor.splice(floor.indexOf(a), 1); }
  // big pieces square to the walls (round tables, seats and rugs may sit at an angle)
  const sq = y => { const k = Math.round(y / 90) * 90; return Math.abs(norm(y - k + 180) - 180) < 8; };
  // seats in a ring round a fire or a round table face the middle at any angle, and a torch has no front: these are
  // never askew
  // A chair pulled out from a table stands at an angle too, and in a round or eight-sided room a chest stands square to
  // its own wall, which is at an angle to the room's frame.
  const sq90 = (a, b) => { const d = norm(a - b) % 90; return d < 8 || d > 82; };
  const wallSquare = r => m.faces.some(fc => {
    if (fc.edge) return false;
    const t = r.p.x * fc.ux + r.p.z * fc.uz;
    if (t < fc.a0 - 0.3 || t > fc.a1 + 0.3) return false;
    const off = (r.p.x - fc.px(t)) * fc.nx + (r.p.z - fc.pz(t)) * fc.nz;
    return off > 0 && off < fc.ht + Math.max(size(r.n)[0], size(r.n)[2]) / 2 + 0.6 && sq90(pyaw(r.p), Math.atan2(fc.nx, fc.nz) * 180 / Math.PI);
  });
  const ringed = r => r.f.cat === 'light' || wallSquare(r) || (r.f.cat === 'seat' && floor.some(o => (o.f.cat === 'fire' && ptDist(o.b, r.p.x, r.p.z) < 3) || (o.f.cat === 'table' && ptDist(o.b, r.p.x, r.p.z) < (o.f.round ? 1.3 : 1.0))));
  const askew = floor.filter(r => (['bed', 'storage', 'craft'].includes(r.f.cat) || (r.f.cat === 'table' && !r.f.round) || r.f.long) && !sq(r.yaw) && !ringed(r));
  if (process.env.DBG && !floor.every(r => sq(r.yaw))) console.error('askewdbg', build.id, m.area, 'floor', floor.length, 'big', askew.map(r => r.n + '@' + Math.round(r.yaw)).join(' '), 'other', floor.filter(r => !sq(r.yaw) && !askew.includes(r)).map(r => r.n + '@' + Math.round(r.yaw)).join(' '));
  if (askew.length > 2 || (askew.length === 2 && floor.length < 6)) { if (process.env.DBG) console.error('askewskip', curKind, 'big', askew.map(r => r.n + '@' + Math.round(r.yaw)).join(' ')); return why('askew'); }
  // a room laid out mostly at an angle reads as scattered (seats and rugs set at an angle are a person's choice, and
  // the template keeps their angle)
  const fixed = floor.filter(r => r.f.cat !== 'seat' && !r.f.round && !ringed(r));
  if (fixed.filter(r => !sq(r.yaw)).length > Math.max(1, 0.3 * fixed.length)) { if (process.env.DBG) console.error('askewskip2', curKind, fixed.filter(r => !sq(r.yaw)).map(r => r.n + '@' + Math.round(r.yaw)).join(' ')); return why('askew'); }
  // one askew piece is left out, with what belongs to it
  for (const r of askew) { r.drop = true; floor.splice(floor.indexOf(r), 1); }
  // tops on a table, pots on a fire; otherwise left out
  const tables = floor.filter(r => r.f.cat === 'table');
  const fires = floor.filter(r => r.f.cat === 'fire');
  for (const r of recs) {
    if (r.kind === 'top') {
      const t = tables.find(t2 => ptDist(t2.b, r.p.x, r.p.z) < 0.05 && Math.abs(t2.lift + (t2.f.top || 0.75) - r.lift) < 0.2);
      if (t) r.parent = t; else r.drop = true;
    }
    if (r.kind === 'fire') { const fi = fires.find(f2 => ptDist(f2.b, r.p.x, r.p.z) < 0.2); if (fi) r.parent = fi; else r.drop = true; }
  }
  // wall pieces: on a face of this room, behind them plain wall; the side of the room it is on
  for (const r of recs) if (r.kind === 'mount') {
    let best = null;
    for (const face of m.faces) {
      if (face.edge) continue;
      const t = r.p.x * face.ux + r.p.z * face.uz;
      if (t < face.a0 - 0.1 || t > face.a1 + 0.1) continue;
      const off = (r.p.x - face.px(t)) * face.nx + (r.p.z - face.pz(t)) * face.nz;
      if (off < -0.3 || off > 0.8) continue;
      if (!best || Math.abs(off) < best.off) best = { face, off: Math.abs(off), t };
    }
    if (!best) { r.drop = true; continue; }
    r.face = best.face;
  }
  const kept = recs.filter(r => !r.drop);
  const names = kept.filter(r => r.kind !== 'top' || r.n !== 'itemstandh').map(r => r.n);
  const nonRug = kept.filter(r => r.at !== 'rug');
  const nFloor = floor.length;
  if (nFloor < 2 || nonRug.length < 3) return why('too few');
  const dens = nonRug.filter(r => r.kind !== 'top').length / m.area * 10;
  const kind = classify(kept.filter(r => r.kind === 'floor').map(r => r.p.name), build.cat, m.area);
  if (dens > (kind === 'storage' ? 12 : 7)) return why('too dense');
  if (dens < 0.8) return why('too sparse');
  // a lot of one little thing (forty item stands) is a collection more than a room
  const cnt = {};
  for (const n of names) cnt[n] = (cnt[n] || 0) + 1;
  if (Object.values(cnt).some(c => c > 12)) return why('one thing many times');

  // ---------------- write it
  const side = r => {
    // which wall a mounted piece is on, in the frame: F (door wall), B (far), L, R
    const f = r.face;
    const a = f.nx * fr.nx + f.nz * fr.nz, b = f.nx * fr.ux + f.nz * fr.uz;
    return a > 0.7 ? 'F' : a < -0.7 ? 'B' : b > 0.7 ? 'L' : 'R';
  };
  // parents: what belongs with what
  const anchors = floor.filter(r => ['bed', 'table', 'fire'].includes(r.f.cat) || /^(piece_workbench|forge|piece_throne01)$/.test(r.n));
  const localOf = (par, r) => {
    const a = par.yaw * Math.PI / 180;
    const du = r.u - par.u, dv = r.v - par.v;
    // parent's local +x in the frame is (cos, -sin) in (u, v), +z is (sin, cos)
    return [r2(du * Math.cos(a) - dv * Math.sin(a)), r2(du * Math.sin(a) + dv * Math.cos(a)), Math.round(norm(r.yaw - par.yaw))];
  };
  for (const r of kept) {
    if (r.parent || r.kind !== 'floor' || anchors.includes(r)) continue;
    const c = r.f.cat;
    let best = null, bd = Infinity;
    for (const a of anchors) {
      const dd = ptDist(a.b, r.p.x, r.p.z);
      let okp = false;
      if (c === 'seat' && a.f.cat === 'table' && dd < 1.3) okp = true;
      else if (c === 'seat' && a.f.cat === 'fire' && dd < 2.4) okp = true;
      else if (r.at === 'rug' && dd < 0.6) okp = true;
      else if (c === 'storage' && a.f.cat === 'bed' && dd < 0.5) okp = true;
      else if (/ext\d/.test(r.n) && /^(piece_workbench|forge)$/.test(a.n) && dd < 2.5 && r.n.startsWith(a.n === 'forge' ? 'forge' : 'piece_workbench')) okp = true;
      else if (c === 'light' && a.f.cat === 'bed' && dd < 0.6) okp = true;
      if (okp && dd < bd) { bd = dd; best = a; }
    }
    if (best) r.parent = best;
  }
  // seats with no table or fire to sit at (beyond a couple by the walls), a floor of rugs, a tavern with no table
  const loose = kept.filter(r => r.kind === 'floor' && r.f.cat === 'seat' && !r.f.long && !r.parent && !/throne/.test(r.n)).length;
  if (loose > 3) return why('loose seats');
  const rugs = kept.filter(r => r.at === 'rug').length;
  if (rugs > Math.max(4, nonRug.length * 0.5)) return why('rugs');
  if ((kind === 'tavern' || kind === 'living') && !tables.length) return why('no table');
  // order: anchors, the rest of the floor, children, wall pieces
  const order = [...kept.filter(r => anchors.includes(r)), ...kept.filter(r => r.kind === 'floor' && !anchors.includes(r) && !r.parent),
    ...kept.filter(r => r.kind === 'floor' && r.parent), ...kept.filter(r => r.kind !== 'floor')];
  const idx = new Map(order.map((r, i) => [r, i]));
  const yq = y => { const s = Math.round(y / 90) * 90; return Math.abs(norm(y - s + 180) - 180) < 8 ? norm(s) : Math.round(norm(y)); };
  const out = [];
  for (const r of order) {
    r.yaw = yq(r.yaw);
    if (r.parent && idx.has(r.parent)) {
      const [lx, lz, ly] = localOf(r.parent, r);
      out.push(['c', r.n, idx.get(r.parent), lx, lz, ly, r2(r.lift - r.parent.lift)]);
      continue;
    }
    if (r.kind === 'mount') {
      const s2 = side(r), w = size(r.n)[0] / 2;
      const ua = s2 === 'L' || s2 === 'R' ? s2 + '0' : anchor(r.u, w, -W / 2, W / 2, 'L', 'R');
      const va = s2 === 'F' || s2 === 'B' ? s2 + '0' : anchor(r.v, w, 0, Dp, 'F', 'B');
      out.push(['m', r.n, ua, va, r2(r.lift)]);
      continue;
    }
    const [eu, ev] = ext(r.n, r.yaw);
    out.push([r.kind === 'hang' ? 'h' : 'f', r.n, anchor(r.u, eu, -W / 2, W / 2, 'L', 'R'), anchor(r.v, ev, 0, Dp, 'F', 'B'), r.yaw, ...(r.kind === 'hang' ? [r2(r.lift)] : [])]);
  }
  // doors and windows on the walls, in the frame
  const openings = [];
  for (const face of m.faces) {
    if (face.edge) continue;
    const a = face.nx * fr.nx + face.nz * fr.nz, b = face.nx * fr.ux + face.nz * fr.uz;
    const s = a > 0.7 ? 'F' : a < -0.7 ? 'B' : b > 0.7 ? 'L' : 'R';
    for (const run of face.runs) {
      if (run.kind !== 'door' && run.kind !== 'window') continue;
      const t = (run.a0 + run.a1) / 2, x = face.px(t), z = face.pz(t);
      const u = fr.u(x, z) - fr.uc, v = fr.v(x, z) - fr.v0;
      // the middle of the opening along its wall, from the middle of that wall
      const along = s === 'F' || s === 'B' ? u : v - Dp / 2;
      openings.push([run.kind === 'door' ? 'd' : 'w', s, r2(along), r2(run.a1 - run.a0)]);
    }
  }
  const doorU = fr.u(door.x, door.z) - fr.uc; // the main door is at v 0
  const fireAt = fires[0] ? [r2(fires[0].u), r2(fires[0].v - Dp / 2)] : null;
  const ceil = r2(m.ceiling - m.stand);
  // shape: how much of the bounding box is floor
  const fill = r2(m.area / (W * Dp));
  const t = {
    kind, src: build.id, pop: +build.pop, W: r2(W), D: r2(Dp), area: m.area, fill, ceil, doorU: r2(doorU), doorW: r2(door.w),
    fire: fireAt, dens: r2(dens), open: openings, p: out, ...(door.stair ? { stair: 1 } : {}),
  };
  // the signature for near copies: kind, size to the meter, pieces by name and place to the half meter
  t.key = `${build.id}@${Math.round(m.cx * 2) / 2},${Math.round(m.stand * 2) / 2},${Math.round(m.cz * 2) / 2}`;
  t.sig = `${kind}|${Math.round(W)}x${Math.round(Dp)}|` + order.map(r => `${r.n}@${Math.round(r.u * 2)},${Math.round(r.v * 2)}`).sort().join(';');
  // the room as built, in the frame, for the pictures in the review sheet (lab/room_pictures.js): floor cells, every
  // piece within reach of the room from the floor to the ceiling, and which furniture the template keeps
  if (geoPath) {
    const yawN = norm(Math.atan2(fr.nx, fr.nz) * 180 / Math.PI);
    const rq = [0, Math.sin(-yawN * Math.PI / 360), 0, Math.cos(-yawN * Math.PI / 360)];
    const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
      a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
    const keptP = new Set(kept.map(r => r.p)), itemP = new Map(items.map(it => [it.p, it]));
    const pcs = [];
    for (const p of all) {
      const u = fr.u(p.x, p.z) - fr.uc, v = fr.v(p.x, p.z) - fr.v0;
      if (u < -W / 2 - 1.2 || u > W / 2 + 1.2 || v < -1.2 || v > Dp + 1.2) continue;
      if (p.y < m.stand - 0.6 || p.y > m.ceiling + 0.3) continue;
      const it = itemP.get(p);
      if (p.decor && !it) continue;
      pcs.push([p.name, r2(u), r2(p.y - m.stand), r2(v), qmul(rq, p.q || [0, 0, 0, 1]).map(x => Math.round(x * 1e4) / 1e4), it ? (keptP.has(p) ? 1 : 2) : 0, it ? it.n : 0]);
    }
    t._geo = { area: m.area, cells: m.cells.map(c => [r2(fr.u(c.x, c.z) - fr.uc), r2(fr.v(c.x, c.z) - fr.v0)]), pcs, W: r2(W), D: r2(Dp), doorU: r2(doorU), ceil };
  }
  stats.kept++;
  templates.push(t);
  return null;
}

let n = 0;
for (const b of chosen) {
  const file = files.get(b.id);
  if (!file) continue;
  let ps;
  try { ps = loadBuild(file); } catch (e) { continue; }
  stats.builds++;
  const bare = ps.filter(p => !p.decor);
  for (const y of floorLevels(bare)) {
    let models;
    try { models = D.readLevel(ps, y, null) || []; } catch (e) { continue; }
    for (const m of models) mineRoom(b, m, ps);
  }
  if (++n % 50 === 0) process.stderr.write(`${n} builds, ${stats.rooms} rooms, ${templates.length} templates\n`);
}

// near copies: the same signature, or the same kind and size with 85 % of the same pieces in the same places
const bySig = new Map();
for (const t of templates) { const o = bySig.get(t.sig); if (!o || t.pop > o.pop) bySig.set(t.sig, t); }
let list = [...bySig.values()].sort((a, b) => b.pop - a.pop);
const keep = [];
const setOf = t => new Set(t.sig.split('|')[2].split(';'));
for (const t of list) {
  const s = setOf(t);
  const dup = keep.find(k => k.kind === t.kind && Math.abs(k.W - t.W) < 1.1 && Math.abs(k.D - t.D) < 1.1 && (() => {
    const s2 = k._s; let inter = 0; for (const x of s) if (s2.has(x)) inter++;
    return inter / Math.max(s.size, s2.size) > 0.85;
  })());
  if (dup) continue;
  // at most four of one kind from one build (an inn's guest rooms are much alike)
  if (keep.filter(k => k.src === t.src && k.kind === t.kind).length >= 4) continue;
  t._s = s;
  keep.push(t);
}
// IDs stay with their room from one run to the next (Tyler's scores are by ID): a room mined before keeps its ID, a new
// one takes the next free number
const oldIds = new Map();
let nextId = 1;
try {
  for (const t of JSON.parse(fs.readFileSync(outPath, 'utf8')).templates) {
    if (t.key) oldIds.set(t.key, t.id);
    nextId = Math.max(nextId, +t.id.slice(3) + 1);
  }
} catch (e) { /* first run */ }
if (!oldIds.size) nextId = 1;
const taken = new Set();
keep.forEach(t => { const o = oldIds.get(t.key); if (o && !taken.has(o)) { t.id = o; taken.add(o); } });
keep.forEach(t => { if (!t.id) t.id = 'RT-' + String(nextId++).padStart(4, '0'); });
keep.sort((a, b) => (a.id < b.id ? -1 : 1));
keep.forEach(t => { delete t.sig; delete t._s; if (t._geo) geo[t.id] = t._geo; delete t._geo; });
if (geoPath) fs.writeFileSync(geoPath, JSON.stringify(geo));
const byKind = {};
for (const t of keep) byKind[t.kind] = (byKind[t.kind] || 0) + 1;
const meta = { builds: stats.builds, rooms: stats.rooms, furnished: stats.furnished, clean: stats.kept, templates: keep.length, byKind, skipped: stats.why,
  frame: 'u across the main door (its local +x), v into the room; W across, D deep. Anchors: L/R/F/B and a gap to that wall (F is the door wall), C and an offset from the middle, P and a share of the size from the middle',
  pieces: 'f floor piece: name, u anchor, v anchor, yaw in the frame | m wall piece: name, u anchor, v anchor, height | h hung: name, u, v, yaw, height | c with a parent: name, parent index, local x, local z, turn, rise',
  open: 'd door or w window, wall, middle along the wall from the wall middle, width' };
const json = '{"meta":' + JSON.stringify(meta) + ',\n"templates":[\n' + keep.map(t => JSON.stringify(t)).join(',\n') + '\n]}\n';
fs.writeFileSync(outPath, json);
console.log(JSON.stringify(meta, null, 1));
if (process.env.DBG) console.error('bykind', JSON.stringify(Object.entries(stats.byKindWhy).filter(x => /^(home|hall|tavern|kitchen|living) /.test(x[0])).sort().map(x => x.join(':'))));
if (process.env.DBG) console.error('unknown', Object.entries(stats.unk).sort((a, b) => b[1] - a[1]).slice(0, 40).map(x => x.join(':')).join(' '));
console.log(outPath, (json.length / 1024).toFixed(0), 'KB');
