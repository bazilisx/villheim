// The room study's numbers (docs/ROOM_STUDY.md) from the rooms lab/rooms_corpus_extract.js reads out of the corpus.
//   node lab/rooms_corpus_stats.js <extract dir> <out dir> [--showcase <showcase extract dir>] [--catalog <pieces.json>]
// Writes kinds.json, sets.json, materials.json, caps.json, space.json, walls.json, pairs.json and examples.json to the
// out dir (data/rooms-corpus). Every file has a 'fields' entry saying what each field holds, and 'sample' with the
// counts behind it.
//
// Rooms: a room of the reader with at least half its floor under a roof, 4 m2 to 400 m2, in a vanilla build (every
// piece a shipped prefab), with no piece from a mod inside it. Floor furniture is a piece of a furniture type
// (rooms_corpus_lib.js FLOOR_T) whose pivot is under 0.5 m over the room's floor, inside the room.
// Weighting: every count is given for all rooms and for rooms in liked builds (the top quarter of vanilla builds by
// votes on valheimians, ties broken by downloads). The corpus has no Tyler verdicts (verdict is empty in compact.json).
const fs = require('fs'), path = require('path'), readline = require('readline');
const lab = path.join(__dirname, '..');
const D = require(lab + '/lib/decorate.js');
const { obox, ptDist, overlap } = D._int;
const L = require('./rooms_corpus_lib.js');
const { P, typeOf, SEATK, LIGHTK, FLOOR_T, familyOf, qs, q, share, top, inc, norm, angDiff } = L;

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const [src, outDir] = args;
if (!src || !outDir) { console.error('usage: node lab/rooms_corpus_stats.js <extract dir> <out dir> [--showcase dir] [--catalog pieces.json]'); process.exit(1); }
L.loadCatalog(opt('--catalog') || '/home/claude/wt/catalog/tools/blueprint-lab/data/catalog/pieces.json');
const showDir = opt('--showcase');
fs.mkdirSync(outDir, { recursive: true });

const G = 0.5, SUB = 0.25;
const r2 = v => Math.round(v * 100) / 100;

// ---------------------------------------------------------------- builds
function readBuilds(file) {
  const out = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) if (line.trim()) out.push(JSON.parse(line));
  return out;
}
const builds = readBuilds(path.join(src, 'builds.jsonl'));
for (const b of builds) {
  const names = Object.keys(b.counts);
  const mod = names.filter(n => !L.isVanilla(n)).reduce((a, n) => a + b.counts[n], 0);
  b.vanilla = mod === 0;
  b.modShare = mod / b.n;
}
const van = builds.filter(b => b.vanilla && b.n >= 20);
const byVotes = [...van].sort((a, b) => (b.votes - a.votes) || (b.dls - a.dls));
const liked = new Set(byVotes.slice(0, Math.ceil(byVotes.length / 4)).map(b => b.b));
const likedVotes = byVotes[Math.ceil(byVotes.length / 4) - 1].votes;
// culture of a build (data/culture-corpus/members.json: high and medium confidence)
const culture = new Map();
try {
  const m = JSON.parse(fs.readFileSync(path.join(lab, 'data/culture-corpus/members.json'), 'utf8')).cultures;
  for (const [c, list] of Object.entries(m)) for (const [k] of list) culture.set(k, c);
} catch (e) { /* none */ }
const cultureOf = file => culture.get(file.replace(/\.blueprint$/, '').split('__')[0]) || null;
// building kind, from category and title
const BKIND = [
  ['tavern', /tavern|\binn\b|pub\b|\bbar\b|brew|mead ?hall|taverna/i], ['smithy', /smith|forge|anvil/i], ['temple', /temple|shrine|church|chapel|altar/i],
  ['longhouse', /longhouse|long ?house|great ?hall|jarl|chieftain|\bhall\b/i], ['storage', /storage|warehouse|store ?room|granary|stash/i],
  ['castle', /castle|fort|keep|citadel/i], ['tower', /tower|lighthouse/i], ['workshop', /workshop|crafting|craft room|workbench/i],
  ['farm', /barn|stable|farm/i], ['home', /house|home|cabin|cottage|\bhut\b|starter|bedroom|dwelling|homestead|interior|base/i]];
const bkindOf = b => { const t = `${b.cat || ''} ${b.title || ''} ${b.file || ''}`; const k = BKIND.find(([, re]) => re.test(t)); return k ? k[0] : 'other'; };
const binfo = new Map(builds.map(b => [b.b, { file: b.file, title: b.title, cat: b.cat, votes: b.votes, dls: b.dls, vanilla: b.vanilla && b.n >= 20, liked: liked.has(b.b), culture: cultureOf(b.file), bkind: bkindOf(b) }]));

// ---------------------------------------------------------------- one room
function cellSet(cells) { const s = new Set(); for (const [i, j] of cells) s.add(i * 65536 + j); return s; }
function sizeOf(name) { return P.piece(name).size; }
function boxOf(it) { const [w, , d] = sizeOf(it.n); return obox(it.x, it.z, Math.max(0.1, w), Math.max(0.1, d), it.yaw); }
const fwd = yaw => [Math.sin(yaw * Math.PI / 180), Math.cos(yaw * Math.PI / 180)];
const yawTo = (dx, dz) => norm(Math.atan2(dx, dz) * 180 / Math.PI);

// room kind from its floor furniture (as lab/mine_room_templates.js classify, with more kinds)
function kindOf(c, bk, area, elong) {
  const beds = c.bed || 0, seats = (c.seat || 0), thr = c.throne || 0, tables = c.table || 0, fire = c.fire || 0;
  const stor = (c.chest || 0) + (c.barrel || 0) + (c.crate || 0);
  const furn = Object.entries(c).filter(([t]) => FLOOR_T.has(t)).reduce((a, [, v]) => a + v, 0);
  if (c.forge) return beds ? 'home' : 'smithy';
  if (beds >= 3 && beds * 2 >= seats + tables) return 'dormitory';
  if (beds && !fire && seats + tables <= Math.max(3, beds * 2)) return 'bedroom';
  if (beds) return 'home';
  if (c.bath && furn <= 6) return 'bath';
  if (thr && area >= 16 && (seats >= 2 || tables || fire || area >= 30)) return 'throne hall';
  if ((c.station || 0) >= 1 && seats < 4 && tables <= 1) return 'workshop';
  if ((c.kitchen || 0) >= 1 && seats <= 4 && tables <= 1 && !thr) return 'kitchen';
  if (stor >= 3 && stor >= 0.5 * furn) return 'storage';
  if (seats + thr >= 8 || tables >= 3) return bk === 'tavern' ? 'tavern hall' : 'feast hall';
  if (tables && seats + thr >= 2) return 'dining';
  if (fire) return 'hearth room';
  if ((c.portal || 0) >= 2) return 'portal room';
  if (bk === 'temple' && ((c.statue || 0) || thr || area >= 20)) return 'shrine';
  if ((c.armorstand || 0) + (c.itemstand || 0) >= 3 && furn <= 3) return 'display';
  if (furn <= 1 && elong) return 'corridor';
  if (seats + tables + thr >= 2) return 'sitting';
  if (furn === 0) return 'empty';
  return 'other';
}
const FOCAL_ORDER = {
  'throne hall': ['throne', 'fire', 'table'], 'feast hall': ['fire', 'table', 'throne'], 'tavern hall': ['fire', 'bar', 'table'], dining: ['table', 'fire'],
  'hearth room': ['fire'], bedroom: ['bed'], dormitory: ['bed'], home: ['fire', 'table', 'bed'], smithy: ['forge', 'station'], workshop: ['station'],
  kitchen: ['kitchen', 'fire'], shrine: ['statue', 'throne', 'fire'], storage: ['chest'], bath: ['bath'], sitting: ['table', 'fire', 'seat'], 'portal room': ['portal'],
};

// ---------------------------------------------------------------- accumulators
const A = {
  rooms: 0, roomsLiked: 0, kinds: {}, // kind -> { n, liked, builds:Set, area:[], W:[], Lg:[], ceil:[], counts:{type:[...]}, ... }
  examples: {}, tableSets: [], beds: [], forges: [], benches: [], bars: [], custom: {}, customEx: {}, cohesion: { seatTable: [], roomFam: [] },
  space: { corridor: [], hall: [], doorDepth: {}, doorNear: {}, through: {}, toFocal: {}, structThrough: {}, stairNear: [], porch: [], gallery: [], wing: [] },
  walls: { items: [], pairs: {}, shelfTops: {}, over: {}, heights: {}, spacing: {}, windowRel: {} },
  roomPairs: { n: 0, item: {}, pair: {} }, roomFamPairs: { n: 0, item: {}, pair: {} },
  roomTypeCounts: {}, // per room counts by name for caps (per room)
  buildIn: new Map(), showIn: new Map(), showNames: new Map(), // per build, indoors: area, counts by name
};
function K(kind) {
  if (!A.kinds[kind]) A.kinds[kind] = { n: 0, liked: 0, builds: new Set(), cultures: {}, bkinds: {}, area: [], W: [], Lg: [], ceil: [], counts: {}, countsLiked: {}, seatK: {}, lightK: {}, focal: {}, faceFocal: [], bedHeadWall: [], chestWall: [], stack: [], furnPer10: [], distinctTypes: [], names: {} };
  return A.kinds[kind];
}
const COUNT_T = ['table', 'seat', 'throne', 'bed', 'chest', 'barrel', 'crate', 'fire', 'forge', 'forge_ext', 'station', 'station_ext', 'kitchen', 'light', 'drape', 'banner', 'rug', 'shelf', 'pot', 'itemstand', 'armorstand', 'sign', 'statue', 'pile', 'plant', 'feast', 'food'];

function processRoom(r, bi) {
  const B = binfo.get(r.b);
  const cs = cellSet(r.cells);
  const inside = (x, z) => cs.has(Math.floor(x / G) * 65536 + Math.floor(z / G));
  const items = r.p.map(([n, x, y, z, yaw]) => ({ n, x, y, z, yaw, t: typeOf(n), in: inside(x, z) }));
  // a piece from a mod inside: the room is left out
  if (items.some(it => !L.isVanilla(it.n) && it.t !== 'build')) return;
  const floor = items.filter(it => it.in && FLOOR_T.has(it.t) && it.y < 0.5 && it.y > -0.4);
  for (const it of floor) it.b = boxOf(it);
  const cnt = {};
  for (const it of items) {
    if (it.t === 'build' || it.t === 'other') continue;
    if (FLOOR_T.has(it.t) && !(it.in && it.y < 0.5 && it.y > -0.4)) { if (it.t !== 'pot') continue; }
    if (!it.in && !['light', 'drape', 'banner', 'shelf', 'itemstand', 'sign', 'armorstand'].includes(it.t)) continue;
    inc(cnt, it.t);
  }
  // drapes hung in doorways count as the room's (the reader takes them as doors)
  for (const d of r.doors) if (/cloth_hanging|fenrirhide_hanging/.test(d[6] || '')) inc(cnt, 'drape');
  // the room's axis: the direction of the most wall length (mod 90)
  const hist = {};
  for (const f of r.faces) { if (f[9]) continue; const a = Math.round(norm(Math.atan2(f[3], f[2]) * 180 / Math.PI) % 90); inc(hist, a, f[7] - f[6]); }
  const ax = +(top(hist, 1)[0] || [0])[0] * Math.PI / 180;
  const ux = Math.cos(ax), uz = Math.sin(ax);
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const [i, j] of r.cells) { const x = (i + 0.5) * G, z = (j + 0.5) * G, u = x * ux + z * uz, v = -x * uz + z * ux; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  const ext1 = u1 - u0 + G, ext2 = v1 - v0 + G;
  const W = Math.min(ext1, ext2), Lg = Math.max(ext1, ext2);
  // structural clear width: the widest square inside the floor
  const struct = clearance(r, cs, []);
  const elong = Lg >= 2.5 * W || (struct.maxW <= 3.1 && Lg >= 6);
  const kind = kindOf(cnt, B.bkind, r.area, elong);
  const k = K(kind);
  k.n++; if (B.liked) k.liked++;
  k.builds.add(r.b); if (B.culture) inc(k.cultures, B.culture); inc(k.bkinds, B.bkind);
  k.area.push(r.area); k.W.push(W); k.Lg.push(Lg); k.ceil.push(r.ceil);
  for (const t of COUNT_T) { (k.counts[t] = k.counts[t] || []).push(cnt[t] || 0); if (B.liked) (k.countsLiked[t] = k.countsLiked[t] || []).push(cnt[t] || 0); }
  const nFurn = floor.length;
  k.furnPer10.push(nFurn / r.area * 10);
  k.distinctTypes.push(new Set(floor.map(it => it.t)).size);
  for (const it of items) if (it.t !== 'build' && (it.in || ['light', 'drape', 'banner', 'shelf', 'itemstand', 'sign'].includes(it.t))) inc(k.names, it.n);
  for (const it of floor) if (it.t === 'seat') inc(k.seatK, SEATK[it.n] || it.n);
  for (const it of items) if (it.t === 'light') inc(k.lightK, LIGHTK(it.n));
  A.rooms++; if (B.liked) A.roomsLiked++;
  // per room counts by name (caps per room)
  const byName = {};
  for (const it of items) if (it.t !== 'build' && it.t !== 'plant' && (it.in || ['light', 'drape', 'banner', 'shelf', 'itemstand', 'sign'].includes(it.t))) inc(byName, it.n);
  addIndoor(A.buildIn, r, items, kind);
  for (const [n, c] of Object.entries(byName)) { const o = A.roomTypeCounts[n] = A.roomTypeCounts[n] || { kinds: {}, all: [] }; o.all.push(c); (o.kinds[kind] = o.kinds[kind] || []).push(c); }
  // examples: the best liked rooms of each kind
  const ex = A.examples[kind] = A.examples[kind] || [];
  ex.push({ file: B.file, title: B.title, votes: B.votes, lvl: r.lvl, cx: r.cx, cz: r.cz, area: r.area, furn: nFurn, liked: B.liked });
  if (ex.length > 60) { ex.sort((a, b) => b.votes - a.votes || b.furn - a.furn); ex.length = 30; }

  // ---------------- focal point and what faces it
  const bars = findBars(r, items, inside);
  let focal = null;
  for (const t of FOCAL_ORDER[kind] || []) {
    if (t === 'bar') { if (bars.length) { focal = { t: 'bar', x: bars[0].x, z: bars[0].z }; break; } continue; }
    const c = floor.filter(it => it.t === t);
    if (c.length) { const big = c.sort((a, b) => sizeOf(b.n)[0] * sizeOf(b.n)[2] - sizeOf(a.n)[0] * sizeOf(a.n)[2])[0]; focal = { t, n: big.n, x: big.x, z: big.z, it: big }; break; }
  }
  inc(k.focal, focal ? (focal.n || focal.t) : 'none');
  // ---------------- table sets
  const tables = floor.filter(it => it.t === 'table');
  const seats = floor.filter(it => it.t === 'seat' || it.t === 'throne');
  const setOf = new Map();
  for (const s of seats) {
    let best = null, bd = 1.25;
    for (const t of tables) { const d = ptDist(t.b, s.x, s.z); if (d < bd) { bd = d; best = t; } }
    if (best) { if (!setOf.has(best)) setOf.set(best, []); setOf.get(best).push({ s, gap: bd }); }
  }
  for (const t of tables) {
    const ss = setOf.get(t) || [];
    const rec = { kind, liked: B.liked, table: t.n, tf: familyOf(t.n), n: ss.length, seats: [], file: B.file, x: t.x, z: t.z, lvl: r.lvl };
    const c = Math.cos(t.yaw * Math.PI / 180), s0 = Math.sin(t.yaw * Math.PI / 180);
    for (const { s, gap } of ss) {
      const dx = s.x - t.x, dz = s.z - t.z, lx = dx * c - dz * s0, lz = dx * s0 + dz * c;
      const head = Math.abs(lx) > t.b.hw && Math.abs(lz) <= t.b.hd + 0.1;
      const corner = Math.abs(lx) > t.b.hw && Math.abs(lz) > t.b.hd + 0.1;
      // turn: the seat's yaw against the direction from the seat to the table's middle line (heads: to the middle)
      const sg = Math.sign(lz) || 1;
      const toT = head || corner ? yawTo(-dx, -dz) : yawTo(-s0 * sg, -c * sg);
      rec.seats.push({ n: s.n, sk: SEATK[s.n] || s.n, f: familyOf(s.n), pos: head ? 'head' : corner ? 'corner' : 'side', gap: r2(gap), lx: r2(lx), lz: r2(lz), rel: Math.round(norm(s.yaw - toT)), long: sizeOf(s.n)[0] > 1.5 });
    }
    A.tableSets.push(rec);
  }
  // seats facing the focal point (seats not at a table)
  if (focal && focal.t !== 'seat') for (const s of seats) {
    if ([...setOf.values()].some(l => l.some(o => o.s === s))) continue;
    if (focal.it === s) continue;
    const d = Math.hypot(focal.x - s.x, focal.z - s.z);
    if (d > 8) continue;
    k.faceFocal.push({ n: s.n, d: r2(d), rel: Math.round(norm(s.yaw - yawTo(focal.x - s.x, focal.z - s.z))) });
  }
  // ---------------- beds: what is beside and at the foot
  const wallD = (x, z) => { let m = Infinity; for (const f of r.faces) { if (f[9]) continue; const t = (x - f[0]) * f[2] + (z - f[1]) * f[3]; if (t < f[6] - 0.3 || t > f[7] + 0.3) continue; const off = (x - f[0]) * f[4] + (z - f[1]) * f[5]; if (off > -0.3) m = Math.min(m, Math.max(0, off - f[8])); } return m; };
  for (const bd of floor.filter(it => it.t === 'bed')) {
    const c = Math.cos(bd.yaw * Math.PI / 180), s0 = Math.sin(bd.yaw * Math.PI / 180);
    const [fx, fz] = fwd(bd.yaw);
    // the head: local -z (docs/INTERIOR_DESIGN.md); how far a wall is behind the head end
    const hx = bd.x - fx * (bd.b.hd + 0.25), hz = bd.z - fz * (bd.b.hd + 0.25);
    const headWall = wallD(hx, hz);
    k.bedHeadWall.push(headWall);
    const near = [];
    for (const o of items) {
      if (o === bd || o.t === 'build' || o.t === 'plant') continue;
      const dx = o.x - bd.x, dz = o.z - bd.z, lx = dx * c - dz * s0, lz = dx * s0 + dz * c;
      if (Math.abs(lx) > bd.b.hw + 1.3 || Math.abs(lz) > bd.b.hd + 1.6) continue;
      const pos = lz < -bd.b.hd + 0.1 && Math.abs(lx) <= bd.b.hw + 0.2 ? 'behind head' : lz > bd.b.hd - 0.1 && Math.abs(lx) <= bd.b.hw + 0.3 ? 'foot' : Math.abs(lx) > bd.b.hw - 0.1 && lz < 0 ? 'beside head' : Math.abs(lx) > bd.b.hw - 0.1 ? 'beside foot' : 'on';
      near.push({ n: o.n, t: o.t, pos, lx: r2(lx), lz: r2(lz), y: r2(o.y), rel: Math.round(norm(o.yaw - bd.yaw)) });
    }
    // building pieces beside the head make a side table (a 1x1 floor, a quarter wall, a beam stack)
    for (const o of items) {
      if (o.t !== 'build' || o.y > 1.2) continue;
      const dx = o.x - bd.x, dz = o.z - bd.z, lx = dx * c - dz * s0, lz = dx * s0 + dz * c;
      if (Math.abs(lx) > bd.b.hw + 1.0 || Math.abs(lx) < bd.b.hw - 0.1 || lz > 0.2 || lz < -bd.b.hd - 0.2) continue;
      near.push({ n: o.n, t: 'build', pos: 'beside head', lx: r2(lx), lz: r2(lz), y: r2(o.y) });
    }
    A.beds.push({ kind, liked: B.liked, n: bd.n, f: familyOf(bd.n), headWall: r2(Math.min(headWall, 9)), near, file: B.file });
  }
  // chests and barrels standing on chests in this room
  const stor = items.filter(it => it.in && (it.t === 'chest' || it.t === 'barrel'));
  const stacked = stor.filter(a => stor.some(c => c !== a && Math.hypot(c.x - a.x, c.z - a.z) < 0.4 && a.y - c.y > 0.45 && a.y - c.y < 1.6)).length;
  k.stack.push([stor.length, stacked]);
  for (const ch of floor.filter(it => it.t === 'chest')) k.chestWall.push(Math.min(9, Math.max(0, wallD(ch.x, ch.z) - Math.min(ch.b.hw, ch.b.hd))));
  // ---------------- work corners: forge and workbench with what stands round them
  for (const st of floor.filter(it => it.t === 'forge' || /^(piece_workbench|piece_artisanstation|piece_stonecutter|piece_magetable|blackforge)$/.test(it.n))) {
    const c = Math.cos(st.yaw * Math.PI / 180), s0 = Math.sin(st.yaw * Math.PI / 180);
    const near = [];
    for (const o of items) {
      if (o === st || !(o.t === 'forge_ext' || o.t === 'station_ext' || o.t === 'forge' || o.t === 'station' || o.t === 'chest' || o.t === 'barrel' || o.t === 'kitchen' || o.t === 'pile' || o.t === 'shelf' || o.t === 'itemstand' || o.t === 'light')) continue;
      const dx = o.x - st.x, dz = o.z - st.z, d = Math.hypot(dx, dz);
      if (d > 4) continue;
      const lx = dx * c - dz * s0, lz = dx * s0 + dz * c;
      near.push({ n: o.n, d: r2(d), lx: r2(lx), lz: r2(lz), y: r2(o.y), rel: Math.round(norm(o.yaw - st.yaw)) });
    }
    A.forges.push({ kind, liked: B.liked, n: st.n, wall: r2(Math.min(9, wallD(st.x, st.z))), near, file: B.file });
  }
  // ---------------- bars
  for (const bar of bars) A.bars.push({ kind, liked: B.liked, file: B.file, ...bar, x: undefined, z: undefined });
  // ---------------- custom furniture: building pieces standing inside the room under 2.4 m
  for (const it of items) {
    if (it.t !== 'build' || !it.in || it.y > 2.4) continue;
    const role = P.piece(it.n).role;
    if (/^(stair|door)$/.test(role)) continue;
    const top = it.y + sizeOf(it.n)[1] / (/(beam|floor)/.test(role) ? 2 : 1);
    const hb = top < 0.25 ? 'floor' : top < 0.7 ? 'seat height' : top < 1.25 ? 'table height' : top < 2.4 ? 'shelf height' : 'high';
    // what furniture is near it
    let nearT = 'none', nd = 1.2;
    for (const o of items) { if (o === it || o.t === 'build' || o.t === 'plant' || o.t === 'other') continue; const d = Math.hypot(o.x - it.x, o.z - it.z); if (d < nd) { nd = d; nearT = o.t; } }
    const key = `${it.n}|${hb}|${nearT}`;
    const o = A.custom[key] = A.custom[key] || { n: 0, rooms: new Set(), builds: new Set(), kinds: {} };
    o.n++; o.rooms.add(bi + ':' + r.lvl + ':' + r.cx); o.builds.add(r.b); inc(o.kinds, kind);
    if (!A.customEx[key] && B.liked) A.customEx[key] = { file: B.file, x: it.x, y: r.lvl + it.y, z: it.z };
  }
  // ---------------- material cohesion
  const famT = floor.filter(it => ['table', 'seat', 'throne', 'bed', 'chest'].includes(it.t) && familyOf(it.n));
  const fams = {};
  for (const it of famT) inc(fams, familyOf(it.n));
  if (famT.length >= 2) A.cohesion.roomFam.push({ kind, liked: B.liked, fams, n: famT.length });
  // ---------------- pairs at room level: furniture and decor names, and families
  const nameSet = new Set(items.filter(it => it.t !== 'build' && it.t !== 'other' && it.t !== 'food' && L.isVanilla(it.n) && (it.in || ['light', 'drape', 'banner', 'shelf', 'itemstand', 'sign'].includes(it.t))).map(it => it.n));
  for (const d of r.doors) if (/cloth_hanging|fenrirhide_hanging/.test(d[6] || '')) nameSet.add(d[6]);
  if (nameSet.size >= 2) addPairs(A.roomPairs, [...nameSet], B.liked);
  const famSet = new Set(famT.map(it => familyOf(it.n)));
  if (famSet.size >= 1 && famT.length >= 2) addPairs(A.roomFamPairs, [...famSet], B.liked);
  // ---------------- walking space
  space(r, kind, k, items, floor, cs, struct, W, Lg, focal, B, bi);
  // ---------------- wall decor
  walls(r, kind, items, floor, B);
}
// per build, indoors: every piece once (a wall piece between two rooms is near both), and the floor area
function addIndoor(map, r, items, kind) {
  const BI = map.get(r.b) || { area: 0, seen: new Set(), counts: {}, rooms: 0, kinds: {} };
  map.set(r.b, BI);
  BI.area += r.area; BI.rooms++; if (kind) inc(BI.kinds, kind);
  for (const it of items) if (it.t !== 'build' && it.t !== 'plant' && (it.in || ['light', 'drape', 'banner', 'shelf', 'itemstand', 'sign'].includes(it.t))) {
    const key = it.n + '@' + it.x + ',' + (it.y + r.lvl).toFixed(2) + ',' + it.z;
    if (BI.seen.has(key)) continue;
    BI.seen.add(key); inc(BI.counts, it.n);
  }
  for (const d of r.doors) if (/cloth_hanging|fenrirhide_hanging/.test(d[6] || '')) { const key = d[6] + '@' + d[0] + ',' + d[1]; if (!BI.seen.has(key)) { BI.seen.add(key); inc(BI.counts, d[6]); } }
}
function addPairs(acc, list, likedB) {
  acc.n++;
  list.sort();
  for (const a of list) inc(acc.item, a);
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) inc(acc.pair, list[i] + '|' + list[j]);
}

// ---------------------------------------------------------------- bars: a run of building pieces inside the room with
// its top at counter height (0.85 to 1.35 m), 2 m long or more, standing clear of the walls
function findBars(r, items, inside) {
  const parts = items.filter(it => it.t === 'build' && it.in && it.y < 1.4).map(it => {
    const sz = sizeOf(it.n), role = P.piece(it.n).role;
    const top = it.y + (/(beam|floor)/.test(role) ? sz[1] / 2 : /wall/.test(role) ? sz[1] / 2 : sz[1] / 2);
    return { it, sz, role, top };
  }).filter(p => p.top > 0.8 && p.top < 1.4 && p.sz[0] >= 0.9 && p.sz[1] <= 1.5 && /(wall|beam|floor)/.test(p.role) && !(p.sz[0] >= 1.9 && p.sz[2] >= 1.9));
  if (parts.length < 2) return [];
  // join parts that touch along the same line
  const used = new Set(), out = [];
  for (const a of parts) {
    if (used.has(a)) continue;
    const grp = [a]; used.add(a);
    for (let i = 0; i < grp.length; i++) for (const b of parts) {
      if (used.has(b)) continue;
      if (Math.hypot(b.it.x - grp[i].it.x, b.it.z - grp[i].it.z) <= Math.max(grp[i].sz[0], b.sz[0]) / 2 + 0.6) { grp.push(b); used.add(b); }
    }
    let xs = grp.map(g => g.it.x), zs = grp.map(g => g.it.z);
    const len = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) + 1;
    if (len < 2) continue;
    const cx = xs.reduce((a2, b) => a2 + b, 0) / xs.length, cz = zs.reduce((a2, b) => a2 + b, 0) / zs.length;
    const alongX = Math.max(...xs) - Math.min(...xs) >= Math.max(...zs) - Math.min(...zs);
    // a counter is a narrow run: across it no more than 1.3 m (a raised floor or a platform is wider)
    const cross = alongX ? Math.max(...zs) - Math.min(...zs) : Math.max(...xs) - Math.min(...xs);
    if (cross > 0.8) continue;
    // the side behind the counter: the side with a wall nearer; clear width there to the wall and to what stands there
    let best = null;
    for (const sgn of [1, -1]) {
      const nx = alongX ? 0 : sgn, nz = alongX ? sgn : 0;
      let wall = null;
      for (let t = 0.25; t < 6; t += 0.25) if (!inside(cx + nx * t, cz + nz * t)) { wall = t; break; }
      if (wall == null) continue;
      const behind = items.filter(o => o.t !== 'build' && o.t !== 'plant' && o.y < 2.2 && FLOOR_T.has(o.t) || o.t === 'shelf' || (o.t === 'light' && o.y < 2.2)).filter(o => {
        const dn = (o.x - cx) * nx + (o.z - cz) * nz, da = alongX ? Math.abs(o.x - cx) : Math.abs(o.z - cz);
        return dn > 0.2 && dn < wall + 0.4 && da < len / 2 + 0.5;
      });
      if (!best || wall < best.wall) best = { wall, behind, nx, nz };
    }
    if (!best || best.wall > 4) continue;
    const furnBehind = best.behind.filter(o => FLOOR_T.has(o.t) && o.y < 0.6);
    let clear = best.wall - 0.1;
    for (const o of furnBehind) { const dn = (o.x - cx) * best.nx + (o.z - cz) * best.nz; const [w, , d] = sizeOf(o.n); const half = Math.min(w, d) / 2; clear = Math.min(clear, dn - half - 0.1); }
    out.push({ x: cx, z: cz, len: r2(len), top: r2(Math.max(...grp.map(g => g.top))), pieces: [...new Set(grp.map(g => g.it.n))], wall: r2(best.wall), clear: r2(Math.max(0, clear)),
      behind: best.behind.map(o => o.n), seatsFront: items.filter(o => (o.t === 'seat') && ((o.x - cx) * best.nx + (o.z - cz) * best.nz) < -0.2 && ((o.x - cx) * best.nx + (o.z - cz) * best.nz) > -1.6).length });
  }
  return out;
}

// ---------------------------------------------------------------- clearance on a 0.25 m grid
function clearance(r, cs, blockers) {
  const sub = new Map();
  for (const [i, j] of r.cells) for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
    const si = i * 2 + a, sj = j * 2 + b, x = (si + 0.5) * SUB, z = (sj + 0.5) * SUB;
    let free = true;
    for (const bx of blockers) if (ptDist(bx, x, z) < 0.01) { free = false; break; }
    sub.set(si * 131072 + sj, { si, sj, x, z, free, d: 0 });
  }
  // local clear width of each free sub cell: the shorter of its free runs along x and along z (the builds are turned
  // square to the axes by lab/rooms_corpus_extract.js), in sub cells
  const runAlong = (c, di, dj) => { let n = 1; for (const sg of [1, -1]) { let k = 1; for (;;) { const o = sub.get((c.si + di * k * sg) * 131072 + c.sj + dj * k * sg); if (!o || !o.free) break; n++; k++; } } return n; };
  let maxD = 0;
  for (const c of sub.values()) { if (!c.free) continue; c.d = Math.min(runAlong(c, 1, 0), runAlong(c, 0, 1)); if (c.d > maxD) maxD = c.d; }
  const ws = [...sub.values()].filter(c => c.free).map(c => c.d).sort((a, b) => a - b);
  return { sub, maxD, maxW: maxD * SUB, medW: ws.length ? ws[Math.floor(ws.length / 2)] * SUB : 0, at: (x, z) => sub.get(Math.floor(x / SUB) * 131072 + Math.floor(z / SUB)) };
}
// the widest way between two places: the largest local width d such that some free sub cell near the start and some
// near the end are joined through cells of width d or more (the places themselves sit at a wall, where the width is low)
function widest(cl, A0, B0) {
  if (!A0.length || !B0.length) return 0;
  const bset = new Set(B0);
  let lo = 0, hi = Math.min(Math.max(...A0.map(c => c.d)), Math.max(...B0.map(c => c.d)));
  const joined = d => {
    const st = A0.filter(c => c.d >= d), seen = new Set(st);
    while (st.length) {
      const c = st.pop();
      if (bset.has(c)) return true;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = cl.sub.get((c.si + di) * 131072 + c.sj + dj); if (n && n.free && n.d >= d && !seen.has(n)) { seen.add(n); st.push(n); } }
    }
    return false;
  };
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (joined(mid)) lo = mid; else hi = mid - 1; }
  return lo;
}
const wOf = d => d * SUB;
function freeNear(cl, x, z, R = 1.0) {
  const out = [];
  for (let dx = -R; dx <= R + 1e-6; dx += SUB) for (let dz = -R; dz <= R + 1e-6; dz += SUB) {
    if (Math.hypot(dx, dz) > R) continue;
    const c = cl.at(x + dx, z + dz);
    if (c && c.free) out.push(c);
  }
  return out;
}

function space(r, kind, k, items, floor, cs, struct, W, Lg, focal, B, bi) {
  const S = A.space;
  if (r.area > 400) return;
  // corridors, wings, porches and galleries: their widths in meters
  const openLen = r.faces.reduce((a, f) => a + f[10].filter(x => x[0] === 'open' || x[0] === 'edge').reduce((s, x) => s + x[2] - x[1], 0), 0);
  const wallLen = r.faces.reduce((a, f) => a + (f[7] - f[6]), 0);
  const openShare = wallLen ? openLen / wallLen : 0;
  const ways = r.doors.length + r.stairs.length;
  if (r.ceil < 1.9) return;
  if (kind === 'corridor' && ways >= 2) S.hall.push({ w: r2(struct.medW), W: r2(W), L: r2(Lg), liked: B.liked, file: B.file, lvl: r.lvl, cx: r.cx, cz: r.cz, doors: ways });
  if (kind === 'corridor') S.corridor.push({ w: r2(struct.medW), wMax: r2(struct.maxW), W: r2(W), L: r2(Lg), liked: B.liked, file: B.file, lvl: r.lvl, cx: r.cx, cz: r.cz });
  if (openShare >= 0.3 && r.cov >= 0.5 && W <= 4.5 && Lg >= 4) (r.lvl > (B.lowest == null ? r.lvl : B.lowest) + 1.5 ? S.gallery : S.porch).push({ w: r2(struct.medW), W: r2(W), L: r2(Lg), open: r2(openShare), liked: B.liked, file: B.file });
  // wings: rooms of other kinds that are long and narrow
  if (kind !== 'corridor' && Lg >= 2.2 * W && W <= 5 && floor.length >= 2) S.wing.push({ kind, w: r2(struct.medW), W: r2(W), L: r2(Lg), liked: B.liked, file: B.file });
  // with the furniture
  const block = floor.filter(it => !['rug'].includes(it.t)).map(it => it.b);
  const cl = clearance(r, cs, block);
  const realDoors = r.doors.filter(d => !d[5]);
  const doorsAll = realDoors.length ? realDoors : r.doors;
  for (const d of doorsAll) {
    const [x, z, nx, nz] = d;
    // depth of the clear zone straight in from the door (to furniture or the far wall), and the nearest furniture
    // from the first floor inside the door (a stone wall is a meter thick), straight in to furniture or the far wall
    let t0 = null;
    for (let t = 0.1; t < 1.3; t += 0.05) { const c = cl.at(x + nx * t, z + nz * t); if (c) { t0 = t; break; } }
    if (t0 == null) continue;
    let depth = 0;
    for (let t = t0; t < t0 + 8; t += SUB) { const c = cl.at(x + nx * t, z + nz * t); if (!c || !c.free) break; depth = t - t0 + SUB; }
    let near = Infinity, nearN = null;
    for (const it of floor) { if (it.t === 'rug') continue; const dd = ptDist(it.b, x, z); if (dd < near) { near = dd; nearN = it.n; } }
    (S.doorDepth[kind] = S.doorDepth[kind] || []).push(r2(depth));
    if (isFinite(near)) (S.doorNear[kind] = S.doorNear[kind] || []).push({ d: r2(near), n: nearN });
  }
  // the main lines: from the main door to every other door and stair (through), and to the focal point
  const main = doorsAll[0];
  if (main) {
    const px = main[0] + main[2] * 0.5, pz = main[1] + main[3] * 0.5;
    const a = freeNear(cl, px, pz), aS = freeNear(struct, px, pz);
    const ends = [...doorsAll.slice(1).map(d => [d[0] + d[2] * 0.5, d[1] + d[3] * 0.5]), ...r.stairs.map(s => [s[1], s[2]])];
    for (const [ex, ez] of ends) {
      if (Math.hypot(ex - px, ez - pz) < 2) continue;
      const b = freeNear(cl, ex, ez), bS = freeNear(struct, ex, ez);
      if (!a.length || !b.length) continue;
      (S.through[kind] = S.through[kind] || []).push(r2(wOf(widest(cl, a, b))));
      if (aS.length && bS.length) (S.structThrough[kind] = S.structThrough[kind] || []).push(r2(wOf(widest(struct, aS, bS))));
    }
    if (focal && focal.it && a.length) {
      const fb = focal.it.b;
      const bF = [...cl.sub.values()].filter(c => c.free && ptDist(fb, c.x, c.z) < 0.75);
      if (bF.length) (S.toFocal[kind] = S.toFocal[kind] || []).push(r2(wOf(widest(cl, a, bF))));
    }
  }
  // stair landings: how far the nearest floor furniture keeps from the foot or head of a stair
  for (const s of r.stairs) {
    let near = Infinity;
    for (const it of floor) { if (it.t === 'rug') continue; near = Math.min(near, ptDist(it.b, s[1], s[2])); }
    if (isFinite(near)) S.stairNear.push({ kind, d: r2(near) });
  }
}

// ---------------------------------------------------------------- wall decor
const WALL_T = new Set(['shelf', 'sign', 'itemstand', 'banner', 'light', 'drape', 'armorstand']);
function walls(r, kind, items, floor, B) {
  const W = A.walls;
  const faces = r.faces.filter(f => !f[9]);
  const on = [];
  for (const it of items) {
    if (!WALL_T.has(it.t) || it.y < 0.3) continue;
    if (it.t === 'light' && !/walltorch|dvergr_lantern$|Candle/.test(it.n)) continue;
    if (it.t === 'armorstand') continue;
    let best = null;
    for (const f of faces) {
      const t = (it.x - f[0]) * f[2] + (it.z - f[1]) * f[3];
      if (t < f[6] - 0.2 || t > f[7] + 0.2) continue;
      const off = (it.x - f[0]) * f[4] + (it.z - f[1]) * f[5] - f[8];
      if (off < -0.35 || off > 0.6) continue;
      if (!best || Math.abs(off) < Math.abs(best.off)) best = { f, t, off };
    }
    if (!best) continue;
    on.push({ it, ...best });
  }
  // per face: spacing, side by side, same height
  const byFace = new Map();
  for (const o of on) { if (!byFace.has(o.f)) byFace.set(o.f, []); byFace.get(o.f).push(o); }
  for (const o of on) {
    const t = o.it.t, n = o.it.n;
    const h = W.heights[n] = W.heights[n] || { y: [], off: [], kinds: {} };
    h.y.push(r2(o.it.y)); h.off.push(r2(o.off)); inc(h.kinds, kind);
    // what stands under it on the floor (within its stretch of wall and 1.6 m out)
    const f = o.f;
    let under = 'nothing';
    for (const fl of floor) {
      const tt = (fl.x - f[0]) * f[2] + (fl.z - f[1]) * f[3], off = (fl.x - f[0]) * f[4] + (fl.z - f[1]) * f[5] - f[8];
      const half = Math.max(fl.b.hw, fl.b.hd);
      if (Math.abs(tt - o.t) <= half + 0.1 && off > -0.2 && off < 1.8) { under = fl.t; break; }
    }
    const ov = W.over[t] = W.over[t] || {};
    inc(ov, under);
    // windows: is it beside a window (within 0.6 m of a window run's ends), centered over one, or away
    let wrel = 'no window on this wall';
    for (const run of f[10]) {
      if (run[0] !== 'window') continue;
      const mid = (run[1] + run[2]) / 2, half = (run[2] - run[1]) / 2;
      const dd = Math.abs(o.t - mid);
      const rel = dd < 0.3 ? 'centered on window' : dd <= half + 0.1 ? 'within window' : dd <= half + 0.9 ? 'beside window' : 'same wall, away';
      const rank = { 'centered on window': 0, 'within window': 1, 'beside window': 2, 'same wall, away': 3 };
      if (wrel === 'no window on this wall' || rank[rel] < rank[wrel]) wrel = rel;
    }
    inc(W.windowRel[t] = W.windowRel[t] || {}, wrel);
  }
  for (const list of byFace.values()) {
    list.sort((a, b) => a.t - b.t);
    for (let i = 0; i + 1 < list.length; i++) {
      const a = list[i], b = list[i + 1];
      const gap = b.t - a.t;
      const key = [a.it.t, b.it.t].sort().join('+');
      const s = W.spacing[key] = W.spacing[key] || { gap: [], dy: [], same: 0, n: 0 };
      s.gap.push(r2(gap)); s.dy.push(r2(Math.abs(a.it.y - b.it.y))); s.n++; if (a.it.n === b.it.n) s.same++;
    }
    // runs of one kind side by side (gap under 1.25 m)
    let run = [list[0]];
    const flush = () => { if (run.length) { const key = run[0].it.t; const o = W.pairs[key] = W.pairs[key] || {}; inc(o, String(Math.min(run.length, 6))); } run = []; };
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1], b = list[i];
      if (b.it.t === a.it.t && b.t - a.t < 1.25) run.push(b); else { flush(); run = [b]; }
    }
    flush();
  }
  // what sits on shelves
  for (const sh of items.filter(it => it.t === 'shelf')) {
    const b = boxOf(sh);
    const tops = items.filter(o => o !== sh && o.t !== 'build' && ptDist(b, o.x, o.z) < 0.05 && o.y - sh.y > -0.05 && o.y - sh.y < 0.8);
    const o = W.shelfTops[sh.n] = W.shelfTops[sh.n] || { n: 0, empty: 0, on: {}, count: [] };
    o.n++; if (!tops.length) o.empty++; o.count.push(tops.length);
    for (const t of tops) inc(o.on, t.n);
  }
}

// ---------------------------------------------------------------- run
async function run() {
  // lowest floor of each build (for galleries)
  let n = 0;
  const lowest = new Map();
  // first pass is cheap: read lvl only
  for await (const line of readline.createInterface({ input: fs.createReadStream(path.join(src, 'rooms.jsonl')) })) {
    const m = /"b":(\d+),"file":".*?","lvl":(-?[\d.]+)/.exec(line.slice(0, 600));
    if (!m) continue;
    const b = +m[1], y = +m[2];
    if (!lowest.has(b) || y < lowest.get(b)) lowest.set(b, y);
  }
  for (const [b, y] of lowest) if (binfo.has(b)) binfo.get(b).lowest = y;
  const rl = readline.createInterface({ input: fs.createReadStream(path.join(src, 'rooms.jsonl')) });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    const B = binfo.get(r.b);
    if (!B || !B.vanilla) continue;
    if (r.cov < 0.5 || r.area < 4 || r.area > 400) continue;
    processRoom(r, r.b);
    if (++n % 5000 === 0) process.stderr.write(`${n} rooms\n`);
  }
  if (showDir && fs.existsSync(path.join(showDir, 'rooms.jsonl'))) {
    A.showNames = new Map(readBuilds(path.join(showDir, 'builds.jsonl')).map(b => [b.b, b.title]));
    for (const line of fs.readFileSync(path.join(showDir, 'rooms.jsonl'), 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const r = JSON.parse(line);
      if (r.cov < 0.5 || r.area < 4 || r.area > 400) continue;
      const cs = cellSet(r.cells), inside = (x, z) => cs.has(Math.floor(x / G) * 65536 + Math.floor(z / G));
      addIndoor(A.showIn, r, r.p.map(([n2, x, y, z, yaw]) => ({ n: n2, x, y, z, yaw, t: typeOf(n2), in: inside(x, z) })), null);
    }
  }
  write();
}

// ---------------------------------------------------------------- output
const pct = (o, tot) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k2, v]) => [k2, +(v / tot).toFixed(3)]));
function countStats(a) { return { has: share(a, v => v > 0), mean: a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : null, p50: q(a, 0.5), p90: q(a, 0.9), max: a.length ? Math.max(...a) : null, p50_when: q(a.filter(v => v > 0), 0.5), p90_when: q(a.filter(v => v > 0), 0.9) }; }
function write() {
  const meta = {
    made: new Date().toISOString().slice(0, 10), source: 'lab/rooms_corpus_extract.js and lab/rooms_corpus_stats.js on compact.json (2,128 builds)',
    builds: builds.length, vanillaBuilds: van.length, likedBuilds: liked.size, likedRule: `top quarter of vanilla builds by votes (votes >= ${likedVotes}), ties by downloads`,
    rooms: A.rooms, roomsLiked: A.roomsLiked, families: L.familySource(),
    roomRule: 'reader room (lib/decorate.js readLevel) with half or more of its floor under a roof, 4 to 400 m2, vanilla build, no mod piece inside; floor furniture: pivot under 0.5 m over the floor',
  };
  // kinds
  const kinds = {};
  for (const [kind, k] of Object.entries(A.kinds).sort((a, b) => b[1].n - a[1].n)) {
    const counts = {}, countsLiked = {};
    for (const t of COUNT_T) { counts[t] = countStats(k.counts[t] || []); countsLiked[t] = countStats(k.countsLiked[t] || []); }
    const faceFocal = k.faceFocal;
    // seats facing the focal: the share whose turn to it is within 30 degrees of the most common turn for that seat
    const relBy = {};
    for (const f of faceFocal) (relBy[f.n] = relBy[f.n] || []).push(f.rel);
    const conv = {};
    for (const [n2, l] of Object.entries(relBy)) { const h = {}; for (const v of l) inc(h, Math.round(v / 30) * 30 % 360); conv[n2] = +(top(h, 1)[0] || [0])[0]; }
    kinds[kind] = {
      rooms: k.n, liked: k.liked, builds: k.builds.size, buildKinds: pct(k.bkinds, k.n), cultures: top(k.cultures, 8),
      area: qs(k.area), shortSide: qs(k.W), longSide: qs(k.Lg), ceiling: qs(k.ceil), furniturePer10m2: qs(k.furnPer10), distinctFurnitureTypes: qs(k.distinctTypes),
      focal: pct(k.focal, k.n), counts, countsLiked, seatKinds: pct(k.seatK, Object.values(k.seatK).reduce((a, b) => a + b, 0) || 1), lightKinds: pct(k.lightK, Object.values(k.lightK).reduce((a, b) => a + b, 0) || 1),
      topPieces: top(k.names, 25).map(([n2, c]) => [n2, c, +(c / k.n).toFixed(2)]),
      seatsFacingFocal: { n: faceFocal.length, distance: qs(faceFocal.map(f => f.d)), facingShare: share(faceFocal, f => { const c = conv[f.n]; return angDiff(f.rel, c) <= 30; }), mostCommonTurn: conv },
      bedHeadToWall: qs(k.bedHeadWall.filter(v => v < 9)), bedHeadAgainstWall: share(k.bedHeadWall, v => v < 0.4),
      stackedChests: { roomsWithStorage: k.stack.filter(x => x[0]).length, roomsWithStack: share(k.stack.filter(x => x[0]), x => x[1] > 0), stackedShare: +(k.stack.reduce((a, x) => a + x[1], 0) / Math.max(1, k.stack.reduce((a, x) => a + x[0], 0))).toFixed(3), perRoomWhen: qs(k.stack.filter(x => x[1]).map(x => x[1])) },
      chestToWall: qs(k.chestWall.filter(v => v < 9)), chestAgainstWall: share(k.chestWall, v => v < 0.35),
    };
  }
  const ex = {};
  for (const [kind, l] of Object.entries(A.examples)) ex[kind] = l.sort((a, b) => (b.liked - a.liked) || b.votes - a.votes || b.furn - a.furn).slice(0, 10);
  fs.writeFileSync(path.join(outDir, 'kinds.json'), JSON.stringify({ meta, fields: {
    rooms: 'rooms of this kind', liked: 'of them in liked builds', builds: 'builds with one or more', buildKinds: 'share of the rooms by the kind of building (category and title words)',
    cultures: 'culture of the build where data/culture-corpus/members.json sorts it, [culture, rooms]', area: 'm2, quantiles (n, p10, p25, p50, p75, p90)', shortSide: 'm, the room box short side along its main wall direction', longSide: 'm',
    ceiling: 'm over the floor', furniturePer10m2: 'floor furniture per 10 m2', distinctFurnitureTypes: 'floor furniture types per room', focal: 'share of rooms by focal piece (the first of the kind\'s focal list found)',
    counts: 'per type: has (share with one or more), mean, p50, p90, max per room, p50_when and p90_when among rooms that have it', countsLiked: 'the same for rooms in liked builds',
    seatKinds: 'share of floor seats by kind', lightKinds: 'share of lights by kind', topPieces: '[name, count, per room]',
    seatsFacingFocal: 'seats not at a table within 8 m of the focal: distance quantiles, and the share turned within 30 degrees of the most common turn for that seat prefab (mostCommonTurn: degrees between the seat yaw and the bearing to the focal, in 30 degree steps)',
    bedHeadToWall: 'm from the head end to the nearest wall face behind it', bedHeadAgainstWall: 'share under 0.4 m', chestToWall: 'm from a chest\'s back (pivot less half its depth) to the nearest wall face', chestAgainstWall: 'share under 0.35 m', stackedChests: 'chests and barrels in the room standing on another (0.4 m across, 0.45 to 1.6 m higher): rooms with storage, share of them with a stack, share of storage pieces stacked, stacked pieces per room when any',
  }, kinds }, null, 1));
  fs.writeFileSync(path.join(outDir, 'examples.json'), JSON.stringify({ meta, fields: { '<kind>': 'rooms in liked builds first, by votes: file, title, votes, floor height (lvl), room middle (cx, cz), area, floor furniture' }, examples: ex }, null, 1));
  writeSets(meta); writeMaterials(meta); writeSpace(meta); writeWalls(meta); writePairs(meta); writeCaps(meta);
  console.log(JSON.stringify(meta, null, 1));
}

function writeSets(meta) {
  const T = A.tableSets;
  const byTable = {};
  for (const s of T) (byTable[s.table] = byTable[s.table] || []).push(s);
  const tableSets = {};
  for (const [tn, l] of Object.entries(byTable).sort((a, b) => b[1].length - a[1].length)) {
    const withSeats = l.filter(s => s.n > 0);
    const seatsAll = l.flatMap(s => s.seats);
    const relBy = {};
    for (const se of seatsAll) { const h = relBy[se.n] = relBy[se.n] || {}; inc(h, Math.round(se.rel / 15) * 15 % 360); }
    const kindsPer = withSeats.map(s => new Set(s.seats.map(x => x.n)).size);
    tableSets[tn] = {
      tables: l.length, withSeats: withSeats.length, seatsPerTable: qs(l.map(s => s.n)), seatsPerSeatedTable: qs(withSeats.map(s => s.n)),
      seatPrefabsPerSet: qs(kindsPer), matchedShare: share(withSeats, s => new Set(s.seats.map(x => x.n)).size === 1),
      matchedFamilyShare: share(withSeats.filter(s => s.tf), s => s.seats.every(x => x.f === s.tf)),
      seats: pct(seatsAll.reduce((o, x) => inc(o, x.n), {}), seatsAll.length || 1),
      position: pct(seatsAll.reduce((o, x) => inc(o, x.pos), {}), seatsAll.length || 1),
      headsUsed: share(withSeats, s => s.seats.some(x => x.pos === 'head')),
      gapSide: qs(seatsAll.filter(x => x.pos === 'side').map(x => x.gap)), gapHead: qs(seatsAll.filter(x => x.pos === 'head').map(x => x.gap)),
      sideOffset: qs(seatsAll.filter(x => x.pos === 'side').map(x => Math.abs(x.lz))),
      turnBySeat: Object.fromEntries(Object.entries(relBy).filter(([, h]) => Object.values(h).reduce((a, b) => a + b, 0) >= 10).map(([n, h]) => [n, top(h, 4).map(([a, c]) => [+a, c])])),
      byKind: pct(l.reduce((o, s) => inc(o, s.kind), {}), l.length),
      combos: top(withSeats.reduce((o, s) => inc(o, s.seats.map(x => x.n).sort().join('+')), {}), 8),
    };
  }
  // tables in a room: how many dining tables per room by kind are in kinds.json; here how far apart tables stand
  // beds
  const B = A.beds;
  const byBed = {};
  for (const b of B) (byBed[b.n] = byBed[b.n] || []).push(b);
  const beds = {};
  for (const [bn, l] of Object.entries(byBed).sort((a, b) => b[1].length - a[1].length)) {
    const nearBy = {};
    for (const b of l) { const seen = new Set(); for (const o of b.near) { const k2 = o.pos + ': ' + (o.t === 'build' ? 'build ' + o.n : o.t); if (seen.has(k2)) continue; seen.add(k2); inc(nearBy, k2); } }
    const namesBy = {};
    for (const b of l) for (const o of b.near) if (o.pos !== 'on') inc(namesBy, o.pos + ': ' + o.n);
    beds[bn] = { beds: l.length, headAgainstWall: share(l, b => b.headWall < 0.4), headToWall: qs(l.map(b => b.headWall)), near: top(nearBy, 20).map(([k2, c]) => [k2, +(c / l.length).toFixed(3)]), names: top(namesBy, 25),
      chestAtFoot: share(l, b => b.near.some(o => o.pos === 'foot' && o.t === 'chest')), sideTable: share(l, b => b.near.some(o => o.pos === 'beside head' && (o.t === 'table' || o.t === 'build' || o.t === 'chest' || o.t === 'barrel' || o.t === 'crate'))),
      lightBeside: share(l, b => b.near.some(o => o.t === 'light' && /beside/.test(o.pos))), rugUnder: share(l, b => b.near.some(o => o.t === 'rug')) };
  }
  // work corners
  const byStation = {};
  for (const f of A.forges) (byStation[f.n] = byStation[f.n] || []).push(f);
  const work = {};
  for (const [sn, l] of Object.entries(byStation).sort((a, b) => b[1].length - a[1].length)) {
    const ext = {}, dist = {}, side = {}, cnt = {};
    for (const f of l) {
      const per = {};
      for (const o of f.near) { inc(per, o.n); (dist[o.n] = dist[o.n] || []).push(o.d); inc(side[o.n] = side[o.n] || {}, Math.abs(o.lx) < 0.6 ? (o.lz > 0 ? 'in front' : 'behind') : 'beside'); }
      for (const [n2, c] of Object.entries(per)) { inc(ext, n2); (cnt[n2] = cnt[n2] || []).push(c); }
    }
    work[sn] = { stations: l.length, backToWall: share(l, f => f.wall < 0.6), near: top(ext, 18).map(([n2, c]) => ({ n: n2, share: +(c / l.length).toFixed(3), perStation: qs(cnt[n2]), distance: qs(dist[n2]), where: pct(side[n2], dist[n2].length) })) };
  }
  // bars
  const bars = A.bars;
  const barOut = { n: bars.length, liked: bars.filter(b => b.liked).length, byKind: pct(bars.reduce((o, b) => inc(o, b.kind), {}), bars.length || 1), length: qs(bars.map(b => b.len)), top: qs(bars.map(b => b.top)),
    wallBehind: qs(bars.map(b => b.wall)), clearBehind: qs(bars.map(b => b.clear)), clearUnder08: share(bars, b => b.clear < 0.8),
    pieces: top(bars.reduce((o, b) => { for (const p of b.pieces) inc(o, p); return o; }, {}), 15), behind: top(bars.reduce((o, b) => { for (const p of new Set(b.behind)) inc(o, p); return o; }, {}), 20),
    seatsInFront: qs(bars.map(b => b.seatsFront)), examples: bars.filter(b => b.liked && (b.kind === 'tavern hall' || b.kind === 'feast hall' || b.kind === 'dining' || b.kind === 'kitchen')).slice(0, 12).map(b => ({ file: b.file, kind: b.kind, len: b.len, clear: b.clear, pieces: b.pieces, behind: b.behind.slice(0, 8) })) };
  // custom furniture
  const custom = Object.entries(A.custom).map(([k2, o]) => { const [n2, h, nearT] = k2.split('|'); return { piece: n2, height: h, near: nearT, pieces: o.n, rooms: o.rooms.size, builds: o.builds.size, kinds: top(o.kinds, 4), example: A.customEx[k2] || null }; })
    .filter(c => c.builds >= 5 && c.height !== 'floor').sort((a, b) => b.builds - a.builds).slice(0, 80);
  fs.writeFileSync(path.join(outDir, 'sets.json'), JSON.stringify({ meta, fields: {
    tableSets: 'per dining table prefab: seats are floor seats and thrones whose pivot is within 1.25 m of the table box (each seat to its nearest table). seatsPerTable over all tables, seatsPerSeatedTable over tables with one or more; seatPrefabsPerSet: distinct seat prefabs at one table; matchedShare: sets whose seats are all one prefab; matchedFamilyShare: sets whose seats all share the table\'s material family; position: head (beyond an end), side, corner; gapSide/gapHead: m from the seat pivot to the table box; sideOffset: m from the table middle line to a side seat pivot; turnBySeat: [turn in 15 degree steps between the seat yaw and the bearing to the table, count] (the most common turn is the facing convention of that prefab); combos: seat prefab sets with counts',
    beds: 'per bed prefab: head is local -z; near: [position: type, share of beds]; positions behind head, beside head, beside foot, foot, on; names: [position: prefab, count]; chestAtFoot, sideTable (a table, chest, barrel, crate or building piece beside the head), lightBeside, rugUnder: shares',
    work: 'per station (forge, smelter, workbench, ...): backToWall share (pivot under 0.6 m from a wall face); near: prefabs within 4 m: share of stations with one or more, count per station, distance quantiles (m), where (in front, behind, beside in the station frame)',
    bars: 'counters: building pieces inside a room with tops 0.8 to 1.4 m over the floor (no 2x2 floors), joined into a run 2 m or longer and at most 0.8 m between part pivots across; wallBehind: m from the counter line to the wall on its nearer side; clearBehind: m from the counter to the wall or to floor furniture standing behind it; behind: prefabs behind the counter (count of bars); seatsInFront: seats within 1.6 m in front',
    custom: 'building pieces standing inside rooms (custom furniture): piece, height band of its top (seat height 0.25-0.7 m, table height 0.7-1.25, shelf height 1.25-2.4), the nearest furniture type within 1.2 m, pieces, rooms, builds, room kinds, one example in a liked build (world x, y, z)',
  }, tableSets, beds, work, bars: barOut, custom }, null, 1));
}

function writeMaterials(meta) {
  const T = A.tableSets.filter(s => s.n > 0 && s.tf);
  const seatTable = {};
  for (const s of T) for (const se of s.seats) { if (!se.f) continue; const o = seatTable[s.tf] = seatTable[s.tf] || {}; inc(o, se.f); }
  const seatTableShare = Object.fromEntries(Object.entries(seatTable).map(([tf, o]) => { const tot = Object.values(o).reduce((a, b) => a + b, 0); return [tf, { seats: tot, same: +((o[tf] || 0) / tot).toFixed(3), with: pct(o, tot) }]; }));
  const roomF = A.cohesion.roomFam;
  const famCount = roomF.map(r => Object.keys(r.fams).length);
  const domShare = roomF.map(r => Math.max(...Object.values(r.fams)) / r.n);
  // family pairs in rooms against chance
  const P2 = A.roomFamPairs;
  const famPairs = Object.entries(P2.pair).map(([k2, c]) => { const [a, b] = k2.split('|'); const ea = P2.item[a] / P2.n, eb = P2.item[b] / P2.n; return { a, b, rooms: c, expected: +(ea * eb * P2.n).toFixed(1), lift: +(c / (ea * eb * P2.n)).toFixed(2) }; })
    .sort((x, y) => y.rooms - x.rooms);
  const neverMix = famPairs.filter(p => p.expected >= 5 && p.lift < 0.5).sort((a, b) => a.lift - b.lift);
  const famRooms = Object.fromEntries(Object.entries(P2.item).sort((a, b) => b[1] - a[1]));
  // family not found in any pair (rooms with a single family) count too
  fs.writeFileSync(path.join(outDir, 'materials.json'), JSON.stringify({ meta, fields: {
    families: 'material family of each prefab used here, from ' + L.familySource(), seatTable: 'per table family: seats at its tables, the share of the same family, and the share of each seat family',
    roomFamilies: 'rooms with two or more family-tagged pieces (tables, seats, thrones, beds, chests): families per room and the share of those pieces in the most common family',
    familyRooms: 'rooms holding each family', familyPairs: 'two families in one room: rooms, expected by chance, lift (observed over expected)', rarelyTogether: 'pairs expected 5 or more times seen under half as often',
  }, families: L.FAMILY_PREFAB, seatTable: seatTableShare,
  roomFamilies: { rooms: roomF.length, familiesPerRoom: qs(famCount), oneFamily: share(famCount, v => v === 1), twoFamilies: share(famCount, v => v === 2), threePlus: share(famCount, v => v >= 3), mainFamilyShare: qs(domShare),
    byKind: Object.fromEntries(Object.entries(roomF.reduce((o, r) => { (o[r.kind] = o[r.kind] || []).push(Object.keys(r.fams).length); return o; }, {})).map(([k2, l]) => [k2, { rooms: l.length, oneFamily: share(l, v => v === 1), p50: q(l, 0.5), p90: q(l, 0.9) }])) },
  familyRooms: famRooms, familyPairs: famPairs, rarelyTogether: neverMix }, null, 1));
}

function writeSpace(meta) {
  const S = A.space;
  const tiles = l => qs(l.map(v => +(v / 2).toFixed(2)));
  const out = {
    corridor: { n: S.corridor.length, clearWidth: qs(S.corridor.map(c => c.w)), clearWidthTiles: tiles(S.corridor.map(c => c.w)), boxShortSide: qs(S.corridor.map(c => c.W)), length: qs(S.corridor.map(c => c.L)),
      under2m: share(S.corridor, c => c.w < 1.9), under2mLiked: share(S.corridor.filter(c => c.liked), c => c.w < 1.9), widthHist: pct(S.corridor.reduce((o, c) => inc(o, String(Math.min(6, Math.round(c.w * 2) / 2))), {}), S.corridor.length || 1) },
    hall: { n: S.hall.length, liked: S.hall.filter(c => c.liked).length, clearWidth: qs(S.hall.map(c => c.w)), clearWidthLiked: qs(S.hall.filter(c => c.liked).map(c => c.w)), clearWidthTiles: tiles(S.hall.map(c => c.w)), length: qs(S.hall.map(c => c.L)),
      under2m: share(S.hall, c => c.w < 1.9), atLeast4m: share(S.hall, c => c.w >= 3.9), widthHist: pct(S.hall.reduce((o, c) => inc(o, String(Math.min(6, Math.round(c.w * 2) / 2))), {}), S.hall.length || 1),
      examples: S.hall.filter(c => c.liked).sort((a, b) => a.w - b.w).filter((c, i, l) => i % Math.max(1, Math.floor(l.length / 10)) === 0).slice(0, 10) },
    wing: { n: S.wing.length, clearWidth: qs(S.wing.map(c => c.w)), boxShortSide: qs(S.wing.map(c => c.W)), byKind: top(S.wing.reduce((o, c) => inc(o, c.kind), {}), 10) },
    porch: { n: S.porch.length, clearWidth: qs(S.porch.map(c => c.w)), boxShortSide: qs(S.porch.map(c => c.W)), length: qs(S.porch.map(c => c.L)) },
    gallery: { n: S.gallery.length, clearWidth: qs(S.gallery.map(c => c.w)), boxShortSide: qs(S.gallery.map(c => c.W)), length: qs(S.gallery.map(c => c.L)) },
    doorClearDepth: Object.fromEntries(Object.entries(S.doorDepth).map(([k2, l]) => [k2, qs(l)])),
    doorNearestFurniture: Object.fromEntries(Object.entries(S.doorNear).map(([k2, l]) => [k2, { d: qs(l.map(o => o.d)), under1m: share(l, o => o.d < 1), what: top(l.filter(o => o.d < 1.2).reduce((o, x) => inc(o, x.n), {}), 6) }])),
    throughWidth: Object.fromEntries(Object.entries(S.through).map(([k2, l]) => [k2, { ...qs(l), under1_2: share(l, v => v < 1.2), structure: qs(S.structThrough[k2] || []) }])),
    toFocalWidth: Object.fromEntries(Object.entries(S.toFocal).map(([k2, l]) => [k2, { ...qs(l), under1_2: share(l, v => v < 1.2) }])),
    stairToFurniture: { all: qs(S.stairNear.map(s => s.d)), under1m: share(S.stairNear, s => s.d < 1) },
    corridorExamples: S.corridor.filter(c => c.liked).sort((a, b) => a.w - b.w).filter((c, i, l) => i % Math.max(1, Math.floor(l.length / 12)) === 0).slice(0, 12),
  };
  fs.writeFileSync(path.join(outDir, 'space.json'), JSON.stringify({ meta, fields: {
    corridor: 'rooms of kind corridor with a ceiling 1.9 m or more (all rooms below too) (at most one floor piece, long: long side 2.5 times the short or clear width 3 m or less and 6 m long): clearWidth, m, the median over its floor of the local clear width (the shorter free run along x and z on a 0.25 m grid, walls and posts blocking); wMax in the examples is the widest; clearWidthTiles: the same in 2 m wood_floor tiles; widthHist: share by clear width rounded to 0.5 m',
    hall: 'corridors (as above) that join two or more doors or stairs, ceiling 1.9 m or more: the walk-through halls',
    wing: 'other rooms long and narrow (long side 2.2 times the short, short side 5 m or less) with two or more floor pieces', porch: 'ground level rooms under a roof with 30 % or more of their edge open, short side 4.5 m or less',
    gallery: 'the same 1.5 m or more over the lowest floor of the build (balconies, galleries)', doorClearDepth: 'm straight in from each door to the first furniture or wall, by room kind',
    doorNearestFurniture: 'm from a door middle to the nearest floor furniture box (rugs left out), share under 1 m, and what stands within 1.2 m', throughWidth: 'm, the narrowest point of the widest way from the main door to each other door or stair with the furniture in place; structure: the same with no furniture',
    toFocalWidth: 'm, the narrowest point of the widest way from the main door to the focal piece', stairToFurniture: 'm from a stair or ladder pivot to the nearest floor furniture box',
  }, ...out }, null, 1));
}

function writeWalls(meta) {
  const W = A.walls;
  const heights = Object.fromEntries(Object.entries(W.heights).filter(([, h]) => h.y.length >= 20).sort((a, b) => b[1].y.length - a[1].y.length).map(([n2, h]) => [n2, { n: h.y.length, height: qs(h.y), offWall: qs(h.off), kinds: top(h.kinds, 5) }]));
  const spacing = Object.fromEntries(Object.entries(W.spacing).filter(([, s]) => s.n >= 30).sort((a, b) => b[1].n - a[1].n).map(([k2, s]) => [k2, { n: s.n, gap: qs(s.gap), heightDiff: qs(s.dy), sameHeight: share(s.dy, v => v < 0.1), samePrefab: +(s.same / s.n).toFixed(3), under1m: share(s.gap, v => v < 1) }]));
  const runs = Object.fromEntries(Object.entries(W.pairs).map(([t, o]) => { const tot = Object.values(o).reduce((a, b) => a + b, 0); return [t, { runs: tot, byLength: pct(o, tot), alone: +((o['1'] || 0) / tot).toFixed(3) }]; }));
  const over = Object.fromEntries(Object.entries(W.over).map(([t, o]) => { const tot = Object.values(o).reduce((a, b) => a + b, 0); return [t, { n: tot, under: pct(o, tot) }]; }));
  const win = Object.fromEntries(Object.entries(W.windowRel).map(([t, o]) => { const tot = Object.values(o).reduce((a, b) => a + b, 0); return [t, { n: tot, rel: pct(o, tot) }]; }));
  const shelves = Object.fromEntries(Object.entries(W.shelfTops).map(([n2, o]) => [n2, { shelves: o.n, empty: +(o.empty / o.n).toFixed(3), itemsPerShelf: qs(o.count), on: top(o.on, 20) }]));
  fs.writeFileSync(path.join(outDir, 'walls.json'), JSON.stringify({ meta, fields: {
    heights: 'wall pieces on a wall face of a room (pivot 0.35 m behind to 0.6 m in front of the face): height of the pivot over the floor (m), distance out from the face, room kinds',
    spacing: 'two wall pieces next to each other on one face, by their types: gap between pivots along the wall (m), height difference, share at the same height (under 0.1 m), share of the same prefab, share under 1 m apart',
    runs: 'pieces of one type in a row on one face with gaps under 1.25 m: share of rows by length (1 = alone)', over: 'what floor furniture type stands under a wall piece (within its stretch of wall, up to 1.8 m out)',
    windows: 'where a wall piece sits against the windows of its own wall', shelves: 'what stands on each shelf prefab (pieces whose pivot is over the shelf, up to 0.8 m above it): share empty, items per shelf, prefabs [name, count]',
  }, heights, spacing, runs, over, windows: win, shelves }, null, 1));
}

function writePairs(meta) {
  // room level
  const lift = (acc, minItem, minPair) => Object.entries(acc.pair).filter(([k2, c]) => { const [a, b] = k2.split('|'); return c >= minPair && acc.item[a] >= minItem && acc.item[b] >= minItem; }).map(([k2, c]) => {
    const [a, b] = k2.split('|'); const e = acc.item[a] * acc.item[b] / acc.n; return [a, b, c, +e.toFixed(1), +(c / e).toFixed(2)]; });
  const room = lift(A.roomPairs, 30, 3);
  // build level: from build counts, items with 20 builds or more, vanilla builds with any furniture
  const bacc = { n: 0, item: {}, pair: {} };
  for (const b of van) {
    const names = Object.keys(b.counts).filter(n2 => { const t = typeOf(n2); return t !== 'build' && t !== 'other' && t !== 'food' && L.isVanilla(n2); });
    if (names.length < 2) continue;
    addPairs(bacc, names);
  }
  const build = lift(bacc, 20, 3);
  // per item: the best and worst partners (room level), for the catalog's 'pairs well with' and 'rarely with'
  const per = {};
  for (const [a, b, c, e, l] of room) for (const [x, y] of [[a, b], [b, a]]) (per[x] = per[x] || []).push([y, c, e, l]);
  const items = {};
  for (const [x, l] of Object.entries(per)) {
    const well = l.filter(p => p[1] >= 8 && p[3] >= 1.5).sort((p, r) => r[3] - p[3] || r[1] - p[1]).slice(0, 15);
    const rare = l.filter(p => p[2] >= 8 && p[3] <= 0.5).sort((p, r) => p[3] - r[3]).slice(0, 15);
    // pairs never seen in one room though expected 8 or more times
    const seen = new Set(l.map(p => p[0]));
    const never = Object.keys(A.roomPairs.item).filter(y => y !== x && A.roomPairs.item[y] >= 30 && !seen.has(y)).map(y => [y, 0, +(A.roomPairs.item[x] * A.roomPairs.item[y] / A.roomPairs.n).toFixed(1), 0]).filter(p => p[2] >= 8).sort((p, r) => r[2] - p[2]).slice(0, 10);
    items[x] = { rooms: A.roomPairs.item[x], type: typeOf(x), family: familyOf(x), pairsWellWith: well, rarelyWith: [...never, ...rare].slice(0, 15) };
  }
  // group level: which kinds of the main groups go together (room level)
  const GROUPS = { light: n2 => typeOf(n2) === 'light' ? LIGHTK(n2) : null, seat: n2 => (typeOf(n2) === 'seat' || typeOf(n2) === 'throne') ? n2 : null, table: n2 => typeOf(n2) === 'table' ? n2 : null,
    bed: n2 => typeOf(n2) === 'bed' ? n2 : null, storage: n2 => ['chest', 'barrel', 'crate'].includes(typeOf(n2)) ? n2 : null, wall: n2 => ['banner', 'drape', 'shelf', 'sign', 'itemstand'].includes(typeOf(n2)) ? n2 : null,
    rug: n2 => typeOf(n2) === 'rug' ? n2 : null, station: n2 => ['station', 'forge', 'kitchen'].includes(typeOf(n2)) ? n2 : null };
  const groups = {};
  for (const [ga, fa] of Object.entries(GROUPS)) for (const [gb, fb] of Object.entries(GROUPS)) {
    if (ga >= gb && ga !== gb) continue;
    const rows = [];
    for (const [a, b, c, e, l] of room) {
      const xa = fa(a), yb = fb(b), xb = fa(b), ya = fb(a);
      if (xa && yb && !(ga === gb && !(xa && fb(b)))) rows.push([xa, yb, a, b, c, e, l]);
      else if (xb && ya) rows.push([xb, ya, b, a, c, e, l]);
    }
    if (rows.length) groups[ga + '~' + gb] = rows.sort((p, r) => r[4] - p[4]).slice(0, 40).map(([, , a, b, c, e, l]) => [a, b, c, e, l]);
  }
  fs.writeFileSync(path.join(outDir, 'pairs.json'), JSON.stringify({ meta: { ...meta, roomSets: A.roomPairs.n, buildSets: bacc.n }, fields: {
    room: '[a, b, rooms with both, expected by chance, lift] for every pair of vanilla furniture and decor prefabs seen together in 3 rooms or more (prefabs in 30 rooms or more); pairs never seen together are in items rarelyWith; a room\'s set is its floor furniture, wall pieces, lights, rugs and plants, and drapes in its doorways',
    build: 'the same at build level (prefabs in 20 builds or more, pairs in 3 builds or more, vanilla builds)', items: 'per prefab (room level): rooms, type, family, pairsWellWith [prefab, rooms, expected, lift] (8 rooms or more and lift 1.5 or more, best first), rarelyWith (never together though expected 8 or more times, then lift 0.5 or less with 8 or more expected)',
    groups: 'room level, by group pair (light~seat, light~table, seat~table, table~rug and so on), most rooms first: [a, b, rooms, expected, lift]; lights are by light prefab', families: 'material family pairs are in materials.json familyPairs',
    lift: 'observed over expected: 1 is chance, above 1 they go together more often than chance, under 1 less often. Lift is high for rare pairs by chance; read it with the room count',
  }, items, groups, room: room.sort((p, r) => r[2] - p[2]), build: build.sort((p, r) => r[2] - p[2]) }));
}

function writeCaps(meta) {
  // per build: counts of the named pieces and types in furnished vanilla builds (one or more room furniture pieces)
  const furnished = van.filter(b => Object.keys(b.counts).some(n2 => ['table', 'bed', 'seat', 'chest', 'fire'].includes(typeOf(n2))));
  const NAMED = ['piece_walltorch', 'piece_groundtorch', 'piece_groundtorch_wood', 'piece_brazierceiling01', 'piece_dvergr_lantern', 'Candle_resin', 'piece_cloth_hanging_door', 'piece_cloth_hanging_door_blue', 'piece_cloth_hanging_door_blue2',
    'piece_logbench01', 'piece_bench01', 'piece_chair', 'piece_chair02', 'piece_chair03', 'piece_chest_wood', 'piece_chest', 'piece_chest_private', 'piece_chest_blackmetal', 'piece_chest_barrel', 'wood_ledge', 'piece_pot1', 'piece_pot2', 'piece_pot3',
    'itemstand', 'itemstandh', 'sign', 'piece_banner01', 'rug_deer', 'rug_fur', 'rug_wolf', 'jute_carpet', 'ArmorStand', 'piece_table', 'piece_table_round', 'piece_table_oak', 'bed', 'piece_bed02', 'hearth', 'fire_pit', 'piece_throne01', 'piece_blackmarble_bench', 'piece_blackmarble_table', 'vines'];
  const TYPES = ['light', 'chest', 'barrel', 'seat', 'table', 'bed', 'drape', 'banner', 'rug', 'shelf', 'pot', 'itemstand', 'sign', 'plant'];
  const show = showDir && fs.existsSync(path.join(showDir, 'builds.jsonl')) ? readBuilds(path.join(showDir, 'builds.jsonl')) : [];
  const stat = (list, f) => { const a = list.map(f); return { has: share(a, v => v > 0), p50: q(a, 0.5), p90: q(a, 0.9), p50_when: q(a.filter(v => v > 0), 0.5), p90_when: q(a.filter(v => v > 0), 0.9), max: Math.max(0, ...a) }; };
  const typeCount = (b, t) => Object.entries(b.counts).filter(([n2]) => typeOf(n2) === t).reduce((a, [, c]) => a + c, 0);
  const lightKinds = b => new Set(Object.keys(b.counts).filter(n2 => typeOf(n2) === 'light').map(LIGHTK)).size;
  const lightPrefabs = b => Object.keys(b.counts).filter(n2 => typeOf(n2) === 'light').length;
  // stacked chests: a chest with another chest's pivot right over it
  const perBuild = {}, perBuildLiked = {}, showcase = {};
  const likedF = furnished.filter(b => liked.has(b.b));
  for (const n2 of NAMED) { perBuild[n2] = stat(furnished, b => b.counts[n2] || 0); perBuildLiked[n2] = stat(likedF, b => b.counts[n2] || 0); }
  for (const t of TYPES) { perBuild['type:' + t] = stat(furnished, b => typeCount(b, t)); perBuildLiked['type:' + t] = stat(likedF, b => typeCount(b, t)); }
  perBuild['light kinds'] = stat(furnished, lightKinds); perBuildLiked['light kinds'] = stat(likedF, lightKinds);
  perBuild['light prefabs'] = stat(furnished, lightPrefabs); perBuildLiked['light prefabs'] = stat(likedF, lightPrefabs);
  // the most used light prefab's share of all lights in a build
  const mainLight = b => { const l = Object.entries(b.counts).filter(([n2]) => typeOf(n2) === 'light'); const tot = l.reduce((a, [, c]) => a + c, 0); return tot ? Math.max(...l.map(([, c]) => c)) / tot : 0; };
  perBuild['main light share'] = stat(furnished.filter(b => lightPrefabs(b)), mainLight);
  for (const s of show) {
    const o = {};
    for (const n2 of NAMED) o[n2] = s.counts[n2] || 0;
    for (const t of TYPES) o['type:' + t] = typeCount(s, t);
    o['light kinds'] = lightKinds(s); o['light prefabs'] = lightPrefabs(s); o['main light share'] = +mainLight(s).toFixed(2);
    showcase[s.title] = o;
  }
  // which showcase counts are over the corpus p90 (per build, over builds that use it)
  const over = {};
  for (const [name, o] of Object.entries(showcase)) for (const [k2, v] of Object.entries(o)) {
    const ref = perBuild[k2]; if (!ref || ref.p90_when == null) continue;
    if (k2 === 'main light share' ? v > ref.p90 : v > ref.p90_when) (over[k2] = over[k2] || []).push([name.replace(/^showcase-/, ''), v]);
  }
  // per room (rooms of the study)
  const perRoom = {};
  for (const n2 of NAMED) { const o = A.roomTypeCounts[n2]; if (!o) continue; perRoom[n2] = { rooms: o.all.length, p50: q(o.all, 0.5), p90: q(o.all, 0.9), max: Math.max(...o.all), byKind: Object.fromEntries(Object.entries(o.kinds).filter(([, l]) => l.length >= 15).map(([k2, l]) => [k2, { rooms: l.length, p50: q(l, 0.5), p90: q(l, 0.9) }])) }; }
  // indoors, per build (the study rooms of the build together), for buildings of house to hall size (30 to 400 m2 of
  // indoor floor): counts and counts per 100 m2
  const inB = [...A.buildIn.entries()].filter(([, o]) => o.area >= 30 && o.area <= 400).map(([b, o]) => ({ b, ...o, liked: liked.has(b) }));
  const inStat = (list, f) => { const a = list.map(f), w = list.map(o => f(o) / o.area * 100); return { has: share(a, v => v > 0), p50: q(a, 0.5), p90: q(a, 0.9), p50_when: q(a.filter(v => v > 0), 0.5), p90_when: q(a.filter(v => v > 0), 0.9), per100m2_p50_when: q(w.filter(v => v > 0), 0.5), per100m2_p90_when: q(w.filter(v => v > 0), 0.9) }; };
  const tc = (o, t) => Object.entries(o.counts).filter(([n2]) => typeOf(n2) === t).reduce((a, [, c]) => a + c, 0);
  const lk = o => new Set(Object.keys(o.counts).filter(n2 => typeOf(n2) === 'light').map(LIGHTK)).size;
  const lp = o => Object.keys(o.counts).filter(n2 => typeOf(n2) === 'light').length;
  const ml = o => { const l = Object.entries(o.counts).filter(([n2]) => typeOf(n2) === 'light'); const tot = l.reduce((a, [, c]) => a + c, 0); return tot ? Math.max(...l.map(([, c]) => c)) / tot : 0; };
  const indoor = { builds: inB.length, liked: inB.filter(o => o.liked).length, area: qs(inB.map(o => o.area)), all: {}, liked_: {} };
  const allNames = new Set(); for (const o of inB) for (const n2 of Object.keys(o.counts)) allNames.add(n2);
  const ranked = [...allNames].map(n2 => [n2, inB.filter(o => o.counts[n2]).length]).filter(([, c]) => c >= 15).sort((a, b) => b[1] - a[1]).map(([n2]) => n2);
  for (const n2 of ranked) { indoor.all[n2] = inStat(inB, o => o.counts[n2] || 0); indoor.liked_[n2] = inStat(inB.filter(o => o.liked), o => o.counts[n2] || 0); }
  for (const t of TYPES) { indoor.all['type:' + t] = inStat(inB, o => tc(o, t)); indoor.liked_['type:' + t] = inStat(inB.filter(o => o.liked), o => tc(o, t)); }
  indoor.all['light kinds'] = inStat(inB, lk); indoor.all['light prefabs'] = inStat(inB, lp); indoor.all['main light share'] = inStat(inB.filter(o => lp(o)), ml);
  const showIn = {};
  for (const [b, o] of A.showIn) {
    const row = { area: Math.round(o.area) };
    for (const n2 of NAMED) if (o.counts[n2]) row[n2] = o.counts[n2];
    for (const t of TYPES) row['type:' + t] = tc(o, t);
    row['light kinds'] = lk(o); row['light prefabs'] = lp(o); row['main light share'] = +ml(o).toFixed(2);
    showIn[A.showNames.get(b) || b] = row;
  }
  const overIn = {};
  for (const [name, row] of Object.entries(showIn)) for (const [k2, v] of Object.entries(row)) {
    const ref = indoor.all[k2]; if (!ref || k2 === 'area') continue;
    if (k2 === 'main light share' ? v > ref.p90_when : (ref.p90_when != null && v > ref.p90_when) || (ref.per100m2_p90_when != null && v / row.area * 100 > ref.per100m2_p90_when * 1.0 && v > (ref.p50_when || 0))) (overIn[k2] = overIn[k2] || []).push([name.replace(/^showcase-/, ''), v, +(v / row.area * 100).toFixed(1)]);
  }
  // stacked chests per build, from the extracted rooms (chests whose pivot is over another chest within 0.4 m)
  fs.writeFileSync(path.join(outDir, 'caps.json'), JSON.stringify({ meta: { ...meta, furnishedBuilds: furnished.length, likedFurnished: likedF.length, showcase: show.length }, fields: {
    perBuild: 'whole build, outdoors included: per prefab or type over furnished vanilla builds (a table, bed, seat, chest or fire anywhere): has (share of builds), p50 and p90 over all, p50_when and p90_when over builds that have it, max',
    perBuildLiked: 'the same over liked builds', 'light kinds': 'distinct light kinds (rooms_corpus_lib.js LIGHTK) per build', 'light prefabs': 'distinct light prefabs per build', 'main light share': 'the most used light prefab\'s share of all lights in the build',
    perRoom: 'per prefab over the study rooms that have it: p50, p90, max per room, and by room kind (15 rooms or more)', showcase: 'the same counts in the 16 showcase designs (lab/rooms_corpus_showcase.js)', showcaseOverP90: 'showcase counts over the corpus p90_when (main light share: over p90)',
    stacked: 'chests standing on chests (pivot 0.4 m or less apart across, 0.5 to 1.6 m higher): builds with any, and per build when any',
    indoor: 'indoors only (the pieces of a build\'s study rooms, each piece once), builds with 30 to 400 m2 of indoor floor: per prefab in 15 or more of them, and per type: has, p50, p90, p50_when, p90_when, and per 100 m2 of indoor floor among builds that have it (per100m2_p50_when, per100m2_p90_when); all = every such build, liked_ = liked ones',
    showcaseIndoor: 'the same indoor counts for the showcase designs (area: indoor floor, m2)', showcaseIndoorOver: '[design, count, per 100 m2] where a showcase count is over the indoor p90_when, or over the per 100 m2 p90_when and the p50_when',
  }, indoor, showcaseIndoor: showIn, showcaseIndoorOver: overIn, perBuild, perBuildLiked, perRoom, showcase, showcaseOverP90: over, stacked: stackedChests(furnished, show) }, null, 1));
}
function stackedChests(furnished, show) {
  // needs positions: read from the compact lines for the furnished builds
  return STACK;
}
let STACK = null;
async function loadStack() {
  // one pass over compact.jsonl for chest stacks (positions are not in builds.jsonl)
  const file = opt('--compact');
  if (!file || !fs.existsSync(file)) return;
  const per = [], perShow = {};
  const scan = (p, file2, b) => {
    const ch = p.filter(x => typeOf(x[0]) === 'chest' || typeOf(x[0]) === 'barrel');
    let s = 0;
    for (const a of ch) if (ch.some(c => c !== a && Math.hypot(c[1] - a[1], c[3] - a[3]) < 0.4 && a[2] - c[2] > 0.45 && a[2] - c[2] < 1.6)) s++;
    return s;
  };
  let bi = -1;
  for await (const line of readline.createInterface({ input: fs.createReadStream(file) })) {
    if (!line.trim()) continue;
    bi++;
    const B = binfo.get(bi);
    if (!B || !B.vanilla) continue;
    const b = JSON.parse(line);
    const chests = b.p.filter(x => typeOf(x[0]) === 'chest' || typeOf(x[0]) === 'barrel').length;
    if (!chests) continue;
    per.push({ s: scan(b.p), chests, liked: B.liked });
  }
  if (showDir) {
    const sf = path.join(path.dirname(showDir), 'showcase.jsonl');
    if (fs.existsSync(sf)) for (const line of fs.readFileSync(sf, 'utf8').split('\n')) { if (!line.trim()) continue; const b = JSON.parse(line); perShow[b.title] = { stacked: scan(b.p), chests: b.p.filter(x => typeOf(x[0]) === 'chest' || typeOf(x[0]) === 'barrel').length }; }
  }
  STACK = { buildsWithChests: per.length, withStack: share(per, o => o.s > 0), stackedWhen: qs(per.filter(o => o.s > 0).map(o => o.s)), stackedShareOfChests: +(per.reduce((a, o) => a + o.s, 0) / per.reduce((a, o) => a + o.chests, 0)).toFixed(3), chestsPerBuild: qs(per.map(o => o.chests)), showcase: perShow };
}
loadStack().then(run);
