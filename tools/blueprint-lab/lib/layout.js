// Room layout planner (D-070, docs/ROOM_LAYOUT.md). The big picture of a room: which end sleeps, which wall works,
// where the table and the storage go, which way beds and benches face, and lanes kept open from the doors to the
// fire, the stairs and the beds. The rules are weights and ranges in data/room-layouts.json; nothing is placed every
// time. The decorator (lib/decorate.js) still places each piece with its own tests; the plan adds a score to every
// spot its placers try, so the anchors land where the room's scheme wants them. The interior library and the persona
// pass fill the detail round them, and clearLanes takes out what still blocks a lane at the end.
//
// The hook for the persona pass: the decorate context's `layout` (generate passes req.layout through):
//   { tidy: 0..1,                  near 1 keeps anchors on their zones, near 0 lets the layout wander
//     traits: { tidiness, comfort, display: 0..1, size: people, hobbies: ['crafts', 'food', ...] (the persona pass's names) },
//                                   broad household traits (never a profession), turned into prefs by the JSON
//     prefs: { 'home.side-sleep': 2, 'table.window': 1.5, ... },
//                                   multiplies a scheme's weight ('<role>.<scheme>') or a zone's weight for one kind
//                                   of anchor ('<kind>.<zone>', the zone names of room-layouts.json)
//     village: 12345,              seeds a lean every house of one village shares
//     seed: 7,                     a household's own number: another layout for the same building
//     scheme: { home: 'box-bed' }, forces a scheme by role (the bench and tests)
//     lanes: false }               leaves the last pass out
// layout: false turns the planner off.
const NODE_L = typeof module !== 'undefined';
const PL = NODE_L ? require('./pieces.js') : window.VHPieces;
const checksL = () => (NODE_L ? require('./checks.js') : window.VHChecks);
const decorL = () => (NODE_L ? require('./decorate.js') : window.VHDecorate);
let RULES_L = null;
function rules() {
  if (RULES_L) return RULES_L;
  try { RULES_L = NODE_L ? require('../data/room-layouts.json') : window.VH_LAYOUTS; } catch (e) { RULES_L = null; }
  return RULES_L;
}
function setRules(r) { RULES_L = r; }

function rngL(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const lerp = (r, a, b) => a + (b - a) * r;
const inR = (R, rg) => (Array.isArray(rg) ? lerp(R(), rg[0], rg[1]) : rg);
const PIL = Math.PI;

// ---------------------------------------------------------------- the plan of one room
// A village's lean: each scheme of each role gets a multiplier from the village's own stream, the same for every house
// of the village, so neighbors share habits.
function villageLean(village, role, schemes, range) {
  if (village == null) return schemes.map(() => 1);
  let h = 2166136261;
  for (const ch of `${village}|${role}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const R = rngL(h);
  return schemes.map(() => lerp(R(), range[0], range[1]));
}

// The household's prefs: its broad traits (tidiness, comfort, display, size, hobbies; never a profession) turned into
// multipliers by the JSON's traits table, times the prefs the persona pass gives directly.
function traitPrefs(RU, L) {
  const out = {};
  const mul = (tbl, k) => { for (const [key, m] of Object.entries(tbl || {})) out[key] = (out[key] || 1) * Math.pow(m, k); };
  const T = RU.traits || {}, tr = L.traits || {};
  for (const name of ['comfort', 'display']) if (tr[name] != null) mul(T[name], (tr[name] - 0.5) * 2);
  if (tr.size != null) { if (tr.size >= 5) mul(T.sizeLarge, 1); else if (tr.size <= 2) mul(T.sizeSmall, 1); }
  for (const h of tr.hobbies || []) mul((T.hobbies || {})[h], 1);
  for (const [key, m] of Object.entries(L.prefs || {})) out[key] = (out[key] || 1) * m;
  return out;
}

// room: the decorator's Room (frame, faces, doors, stairs, cells, inside, fire); role: its role; c: the decorate context
// with c.layout (the hook), c.culture and c.layoutR (the plan's own stream).
function plan(room, role, c) {
  const RU = rules();
  if (!RU || c.layout === false) return null;
  const def = RU.roles[role];
  if (!def || !def.schemes || !def.schemes.length || !room.entry) return null;
  const L = c.layout || {};
  const R = c.layoutR || Math.random;
  const prefs = traitPrefs(RU, L);
  const tr = L.traits || {};
  const tidy0 = L.tidy != null ? L.tidy : tr.tidiness != null ? tr.tidiness : (RU.persona && RU.persona.tidyDefault) || 0.6;
  const tidy = Math.max(0, Math.min(1, tidy0));
  const cult = (RU.cultures || {})[c.culture] || {};
  const V = RU.variance || {};
  const lean = villageLean(L.village, role, def.schemes, V.villageLean || [1, 1]);
  // the scheme: forced, or drawn by weight times the culture's lean, the village's lean and the household's prefs
  let scheme = null;
  const forced = L.scheme && L.scheme[role];
  if (forced) scheme = def.schemes.find(s => s.id === forced) || null;
  if (!scheme) {
    const spread = V.schemeSpread || 1;
    const ws = def.schemes.map((s, i) => Math.pow(Math.max(0, s.w * (cult[`${role}.${s.id}`] || 1) * lean[i] * (prefs[`${role}.${s.id}`] != null ? prefs[`${role}.${s.id}`] : 1)), spread));
    let tot = ws.reduce((a, b) => a + b, 0), r = R() * tot;
    scheme = def.schemes[def.schemes.length - 1];
    for (let i = 0; i < ws.length; i++) { r -= ws[i]; if (r <= 0) { scheme = def.schemes[i]; break; } }
  }
  const side = R() < (V.sideFlip != null ? V.sideFlip : 0.5) ? 1 : -1;
  const jitter = inR(R, V.zoneJitter || 0) + (1 - tidy) * 0.15;
  // orientation weights: the general ones, then the scheme's own
  const orient = {};
  for (const [k, o] of Object.entries(RU.orient || {})) orient[k] = { ...o, ...((scheme.orient || {})[k] || {}) };
  // a single bed in a small room or under the eaves stands side to the wall more often than not; a double bed keeps
  // both long sides open (picture study: 8 of 12 single beds, 6 of 6 double beds)
  const ob = orient.bed || {};
  const D0 = decorL()._int;
  const bedW = c.kit && c.kit.bed ? D0.size(c.kit.bed)[0] : 1.2;
  const small = Math.min(room.x1 - room.x0, room.z1 - room.z0) < (ob.smallRoom || 5.5) || (room.upper && ['sleeping', 'guest'].includes(role));
  const bedSideways = bedW < 2 && R() < inR(R, small && ob.sideToWallSmall ? ob.sideToWallSmall : ob.sideToWall || 0);
  const bedGap = scheme.bedGap ? inR(R, scheme.bedGap) : null;
  const bedRow = scheme.row || null;
  const ring = ob.fireRing || {};
  const bedFire = ring[role] != null ? ring[role] : ring.default != null ? ring.default : 2.6;
  // how many dining sets the library may lay on the free floor (a hall with benches along its walls takes fewer)
  const setsR = scheme.sets || def.sets;
  const sets = setsR ? Math.round(inR(R, setsR)) : null;
  const templateFirst = c.forceTemplate ? true : def.templateShare ? R() < inR(R, def.templateShare) : true;
  const fr = room.frame();
  const faces = room.faces.filter(f => !f.edge);
  const maxLen = Math.max(1, ...faces.map(f => f.len));
  const windows = [];
  for (const f of room.faces) for (const run of f.runs) if (run.kind === 'window') { const t = (run.a0 + run.a1) / 2; windows.push([f.px(t) + f.nx * 0.5, f.pz(t) + f.nz * 0.5]); }
  const corners = [];
  for (const f of faces) for (const a of [f.a0, f.a1]) {
    const x = f.px(a), z = f.pz(a);
    if (faces.some(g => g !== f && Math.abs(g.nx * f.nx + g.nz * f.nz) < 0.3 && Math.abs((x - g.px(0)) * g.nx * g.side + (z - g.pz(0)) * g.nz * g.side) < 0.8 + g.ht)) corners.push([x + (f.nx) * 0.5, z + (f.nz) * 0.5]);
  }
  const zoneW = ((RU.weight || {}).zone || 2) * (0.5 + 0.5 * tidy);
  const orientW = (RU.weight || {}).orient || 1;
  const P = {
    role, scheme: scheme.id, side, tidy, bedSideways, bedGap, bedRow, bedFire, templateFirst, story: null, sets, placedSets: [],
    longX: (room.x1 - room.x0) >= (room.z1 - room.z0),
    // the zone a kind of anchor goes to in this scheme
    zoneOf: kind => (scheme.zones || {})[kind] || null,
  };
  const zdefs = { ...(RU.zones || {}), ...(RU.special || {}) };
  // how well a point sits in a zone: 1 inside, falling off over a couple of meters outside
  const inZone = (zd, s) => {
    const x = s.x, z = s.z;
    let miss = 0;
    const v = fr.v(x, z) / Math.max(1, fr.D), u = fr.u(x, z) / Math.max(1, fr.W) * side;
    const out = (val, rg, scale) => { const lo = rg[0] - jitter, hi = rg[1] + jitter; return val < lo ? (lo - val) * scale : val > hi ? (val - hi) * scale : 0; };
    if (zd.v) miss += out(v, zd.v, 2.2);
    if (zd.u) miss += out(u, zd.u, 1.4);
    if (zd.fire) {
      if (!room.fire) miss += 0.4;
      else { const d = Math.hypot(x - room.fire.x, z - room.fire.z); miss += d < zd.fire[0] ? (zd.fire[0] - d) * 0.6 : d > zd.fire[1] ? (d - zd.fire[1]) * 0.35 : 0; }
    }
    if (zd.fireFlank) {
      // beside a long fire, parallel to it: across its long axis 0.5 to 1.5 m past its side and the table's half
      // depth, along it within its length and a little more
      if (!room.fire) miss += 0.5;
      else {
        const f = room.fire, lx = P.longX;
        const across = Math.abs(lx ? z - f.z : x - f.x), along = Math.abs(lx ? x - f.x : z - f.z);
        const half = lx ? f.b.hd : f.b.hw, len = lx ? f.b.hw : f.b.hd;
        const lo = half + 0.6 + zd.fireFlank[0], hi = half + 0.6 + zd.fireFlank[1] + 0.6;
        miss += (across < lo ? (lo - across) * 0.8 : across > hi ? (across - hi) * 0.5 : 0) + Math.max(0, along - len - 1.5) * 0.3;
      }
    }
    if (zd.window) {
      const d = windows.length ? Math.min(...windows.map(([wx, wz]) => Math.hypot(wx - x, wz - z))) : 9;
      miss += s.win ? 0 : Math.max(0, d - zd.window) * 0.35;
    }
    if (zd.longWall) {
      if (s.face) miss += s.face.len >= maxLen * 0.7 ? 0 : 0.8;
      else { const d = Math.min(9, ...faces.filter(f => f.len >= maxLen * 0.7).map(f => Math.abs((x - f.px(0)) * f.nx + (z - f.pz(0)) * f.nz) - f.ht)); miss += Math.max(0, d - 1.5) * 0.4; }
    }
    if (zd.midWall && s.face) miss += Math.abs(s.t - (s.face.a0 + s.face.a1) / 2) / Math.max(1, s.face.len) * 3;
    if (zd.corner) {
      if (s.corner) miss += 0;
      else { const d = corners.length ? Math.min(...corners.map(([cx, cz]) => Math.hypot(cx - x, cz - z))) : 9; miss += Math.min(1, Math.max(0, d - 1) * 0.3); }
    }
    return Math.max(0, 1 - miss);
  };
  // the bias the placers add: the zone this kind goes to in the scheme, and the orientation rules
  P.bias = (kind, s, name) => {
    let v = 0;
    const zn = P.zoneOf(kind);
    if (zn && zdefs[zn]) v += zoneW * inZone(zdefs[zn], s) * (prefs[`${kind}.${zn}`] != null ? prefs[`${kind}.${zn}`] : 1);
    // the household's own lean toward a zone for this kind, whatever the scheme says
    for (const [key, m] of Object.entries(prefs)) {
      const [k2, z2] = key.split('.');
      if (k2 === kind && z2 !== zn && zdefs[z2] && m !== 1) v += zoneW * 0.5 * (m - 1) * inZone(zdefs[z2], s);
    }
    const o = orient[kind];
    if (!o) return v;
    if (kind === 'bed') {
      const D = decorL()._int;
      if (s.face) {
        if (s.face.len >= maxLen * 0.75) v += orientW * o.longWall;
        if (s.face.runs.some(r => r.kind === 'door')) v += orientW * o.doorWall;
      }
      if (s.win) v += orientW * o.underWindow;
      // lined up with a doorway: the door on the bed's long axis, out past its foot
      const a = s.yaw * PIL / 180, fx = Math.sin(a), fz = Math.cos(a), bx = Math.cos(a), bz = -Math.sin(a);
      for (const d of room.doors) {
        const dx = d.x - s.x, dz = d.z - s.z, along = dx * fx + dz * fz, lat = Math.abs(dx * bx + dz * bz);
        if (along > 0.5 && along < 9 && lat < 1.0) v += orientW * o.inDoorLine;
      }
      // a long side open to get in (a bed turned side to the wall keeps its one open side)
      if (name) {
        const [w] = D.size(name);
        const open = [1, -1].filter(sg => room.inside(s.x + bx * sg * (w / 2 + 0.6), s.z + bz * sg * (w / 2 + 0.6))).length;
        v += orientW * o.sideAccess * (open === 0 ? -1 : open === 2 ? 0.5 : 0.2);
      }
      if (room.fire && Math.hypot(s.x - room.fire.x, s.z - room.fire.z) < bedFire + 0.4) v += orientW * o.nearFire;
    } else if (kind === 'table') {
      if (s.mid && s.yaw != null) {
        const longX = (room.x1 - room.x0) >= (room.z1 - room.z0);
        if ((longX && s.yaw % 180 === 0) || (!longX && s.yaw % 180 === 90)) v += orientW * (o.alongLong || 0);
      }
      if (o.window) { const d = windows.length ? Math.min(...windows.map(([wx, wz]) => Math.hypot(wx - s.x, wz - s.z))) : 9; v += orientW * o.window * Math.max(0, 1 - d / 4); }
    } else if (kind === 'station' || kind === 'forge') {
      if (o.light) {
        const dw = windows.length ? Math.min(...windows.map(([wx, wz]) => Math.hypot(wx - s.x, wz - s.z))) : 9;
        v += orientW * o.light * Math.max(0, 1 - Math.min(dw, room.doorDist(s.x, s.z)) / 5);
      }
    } else if (kind === 'storage') {
      if (s.corner) v += orientW * (o.corner || 0);
    } else if (kind === 'bench') {
      if (s.face && s.face.len >= maxLen * 0.7) v += orientW * (o.longWall || 0) * 0.5;
    }
    return v;
  };
  // the story spot: the plain wall at the end of the main lane, in view from the door (the persona pass may claim it)
  let bestS = null, bv = -Infinity;
  for (const f of faces) for (const run of f.runs) {
    if (run.kind !== 'wall' || run.a1 - run.a0 < 1.2) continue;
    const t = (run.a0 + run.a1) / 2, x = f.px(t) + f.nx * (f.ht + 0.4), z = f.pz(t) + f.nz * (f.ht + 0.4);
    const sc = fr.v(x, z) / Math.max(1, fr.D) - Math.abs(fr.u(x, z)) / Math.max(1, fr.W) * 0.5 + R() * 0.3;
    if (sc > bv) { bv = sc; bestS = { x: +x.toFixed(2), z: +z.toFixed(2), nx: f.nx, nz: f.nz }; }
  }
  P.story = bestS;
  return P;
}

// The plan of the decorator's room that holds a room the library reads (lib/kitbash.js), by its middle and floor height.
function planFor(b, m) {
  for (const e of b.layoutPlans || []) if (Math.abs(e.stand - m.stand) < 0.3 && e.inside(m.cx, m.cz)) return e.plan;
  return null;
}
// A score for a free-floor spot of the library (dining sets and work zones): the table's zone and axis from the plan,
// and in a hall or tavern a pull toward the rows the sets laid before it started, so the tables line up along the
// room's long axis with the lanes between them.
function floorScore(plan, an, a, b) {
  if (!plan) return 0;
  const key = a.pieces.find(p => p.key) || a.pieces[0];
  const yaw = ((an.yaw + (key ? key.yaw : 0)) % 360 + 360) % 360;
  if (a.dining) {
    let v = plan.bias('table', { x: an.x, z: an.z, mid: true, yaw });
    if (['hall', 'tavern'].includes(plan.role) && plan.placedSets.length) {
      let best = 0;
      for (const q of plan.placedSets) {
        const across = plan.longX ? Math.abs(q.z - an.z) : Math.abs(q.x - an.x);
        const along = plan.longX ? Math.abs(q.x - an.x) : Math.abs(q.z - an.z);
        if (across < 0.4 && along > 3) best = Math.max(best, 1.5);
      }
      v += best;
    }
    return v;
  }
  if (plan.role === 'smithy') {
    const forge = b.pieces.find(p => p.decor && p.name === 'forge' && Math.abs(p.x - an.x) < 8 && Math.abs(p.z - an.z) < 8);
    // the anvil 1 to 1.8 m in front of the forge (picture study), so the work zone's middle about 2.3 m from it
    if (forge) { const d = Math.hypot(forge.x - an.x, forge.z - an.z); return 2 - Math.abs(d - 2.3) * 0.8; }
  }
  return plan.bias('station', { x: an.x, z: an.z });
}
function noteSet(plan, an) { if (plan) plan.placedSets.push({ x: an.x, z: an.z }); }

// ---------------------------------------------------------------- lanes
// The walking floor of a room on a 0.25 m grid: a point is walkable when nothing at body height comes within 'radius'
// of it (a 1 m wide player passes a gap of about 0.8 to 1.05 m at radius 0.4).
const SUB = 0.25;
const BODY = [0.2, 1.4];
function obstaclesOf(b, m, cache) {
  const Ck = checksL();
  const out = [];
  for (const p of b.pieces) {
    if (p.outside) continue;
    const info = PL.piece(p.name);
    if (!p.decor && !['wall', 'pole', 'fence', 'window'].includes(info.role)) continue;
    if (info.role === 'rug' || info.role === 'door' || info.role === 'stair' || info.role === 'floor') continue;
    if (p.x < m.x0 - 4 || p.x > m.x1 + 4 || p.z < m.z0 - 4 || p.z > m.z1 + 4) continue;
    let o = cache && cache.get(p);
    if (!o) { o = Ck.aabbShapes(p); if (cache) cache.set(p, o); }
    if (o.pass) continue;
    if (o.y1 < m.stand + Math.max(BODY[0], 0.45) || o.y0 > m.stand + BODY[1]) continue;
    if (o.x1 < m.x0 - 0.6 || o.x0 > m.x1 + 0.6 || o.z1 < m.z0 - 0.6 || o.z0 > m.z1 + 0.6) continue;
    out.push({ p, o, decor: !!p.decor, info });
  }
  return out;
}
const boxDist = (o, x, z) => Math.hypot(Math.max(0, o.x0 - x, x - o.x1), Math.max(0, o.z0 - z, z - o.z1));

function grid(m, obs, radius) {
  const pts = [];
  const key = (i, j) => i * 100000 + j;
  const at = new Map();
  // the obstacles filed in 1 m buckets by their box grown by the radius
  const bk = new Map(), K = 1;
  for (const ob of obs) {
    const o = ob.o;
    for (let i = Math.floor((o.x0 - radius) / K); i <= Math.floor((o.x1 + radius) / K); i++) for (let j = Math.floor((o.z0 - radius) / K); j <= Math.floor((o.z1 + radius) / K); j++) {
      const k = i * 100000 + j;
      if (!bk.has(k)) bk.set(k, []);
      bk.get(k).push(ob);
    }
  }
  for (const c of m.cells) for (const dx of [-0.125, 0.125]) for (const dz of [-0.125, 0.125]) {
    const x = c.x + dx, z = c.z + dz, i = Math.round((x - 0.125) / SUB), j = Math.round((z - 0.125) / SUB);
    const pt = { x, z, i, j, block: null, hard: false };
    for (const ob of bk.get(Math.floor(x / K) * 100000 + Math.floor(z / K)) || []) {
      if (boxDist(ob.o, x, z) >= radius) continue;
      if (!ob.decor || ob.keep) { pt.hard = true; break; }
      (pt.block || (pt.block = [])).push(ob);
    }
    at.set(key(i, j), pt);
    pts.push(pt);
  }
  return { pts, at, key, near: (i, j) => at.get(key(i, j)) };
}
const N8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.42], [1, -1, 1.42], [-1, 1, 1.42], [-1, -1, 1.42]];

// The places a lane has to reach: in front of each door, round the fire, beside each stair, along each bed's open side.
function targetsOf(m, b) {
  const T = [];
  for (const d of m.doors) T.push({ kind: 'door', near: [[d.x + d.nx * (d.ht + 0.6), d.z + d.nz * (d.ht + 0.6)]], r: 0.9 });
  const Ck = checksL();
  for (const p of b.pieces) {
    if (!p.decor || p.outside || !m.inside(p.x, p.z) || Math.abs(p.y - m.stand) > 0.8) continue;
    const role = PL.piece(p.name).role;
    if (role === 'fire') { const o = Ck.aabbShapes(p); T.push({ kind: 'fire', box: o, r: 1.2 }); }
    if (role === 'bed') { const o = Ck.aabbShapes(p); T.push({ kind: 'bed', box: o, r: 1.0 }); }
    // a table, a station and a chest or barrel on the floor: a person walks up to each (D-152, Tyler 2026-11-11:
    // "egress and room movement should always allow someone to move into rooms and explore"); a pot or station set
    // on the fire is reached with the fire
    if ((['table', 'craft'].includes(role) || (role === 'storage' && p.y - m.stand < 0.3)) && !/cauldron|cookingstation/.test(p.name)) {
      const o = Ck.aabbShapes(p);
      T.push({ kind: 'piece', box: o, r: 0.9 });
    }
  }
  for (const s of m.stairs || []) {
    const B = s.b, ext = Math.hypot(B.hw, B.hd);
    T.push({ kind: 'stair', near: [[B.x, B.z]], r: ext + 0.9 });
  }
  return T;
}
function targetPts(t, G) {
  if (t.box) return G.pts.filter(pt => boxDist(t.box, pt.x, pt.z) < t.r);
  return G.pts.filter(pt => t.near.some(([x, z]) => Math.hypot(pt.x - x, pt.z - z) < t.r));
}
// cells reached from the start set over walkable cells
function reach(G, starts) {
  const seen = new Set(), st = [];
  for (const s of starts) if (!s.hard && !s.block) { seen.add(s); st.push(s); }
  while (st.length) {
    const a = st.pop();
    for (const [di, dj] of N8) {
      const q = G.near(a.i + di, a.j + dj);
      if (!q || q.hard || q.block || seen.has(q)) continue;
      if (di && dj && (!G.near(a.i + di, a.j) || !G.near(a.i, a.j + dj))) continue;
      seen.add(q); st.push(q);
    }
  }
  return seen;
}
// the cheapest way from the reached cells to a target, through cells only removable furniture blocks
function cheapest(G, from, goal) {
  const dist = new Map(), prev = new Map(), heap = [];
  const push = (d, n) => { heap.push([d, n]); let i = heap.length - 1; while (i > 0) { const pa = (i - 1) >> 1; if (heap[pa][0] <= heap[i][0]) break; [heap[pa], heap[i]] = [heap[i], heap[pa]]; i = pa; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let mm = i; if (l < heap.length && heap[l][0] < heap[mm][0]) mm = l; if (r < heap.length && heap[r][0] < heap[mm][0]) mm = r; if (mm === i) break; [heap[mm], heap[i]] = [heap[i], heap[mm]]; i = mm; } } return top; };
  for (const s of from) { dist.set(s, 0); push(0, s); }
  const done = new Set();
  while (heap.length) {
    const [d, a] = pop();
    if (done.has(a)) continue;
    done.add(a);
    if (goal.has(a)) { const path = []; let c = a; while (c) { path.push(c); c = prev.get(c); } return path; }
    for (const [di, dj, w] of N8) {
      const q = G.near(a.i + di, a.j + dj);
      if (!q || q.hard || done.has(q)) continue;
      if (di && dj && (!G.near(a.i + di, a.j) || !G.near(a.i, a.j + dj))) continue;
      const nd = d + w + (q.block ? 6 * q.block.length : 0);
      if (!dist.has(q) || nd < dist.get(q)) { dist.set(q, nd); prev.set(q, a); push(nd, q); }
    }
  }
  return null;
}

// What may go to open a lane: loose furniture and library assemblies, never a bed, a fire, a station, a table or a
// throne, nor the building's first chest. A library assembly goes whole; what stands on a piece goes with it.
function unitsOf(b) {
  const units = new Map();
  for (const p of b.pieces) {
    if (!p.decor || p.outside) continue;
    const k = p.kb || p;
    if (!units.has(k)) units.set(k, []);
    units.get(k).push(p);
  }
  return units;
}
function removable(unit, firstChest) {
  for (const p of unit) {
    const role = PL.piece(p.name).role;
    if (['bed', 'fire', 'craft', 'table'].includes(role)) return false;
    if (/throne|cartography/.test(p.name)) return false;
    if (p === firstChest) return false;
  }
  return true;
}

// Whether taking these pieces out would leave a room of 8 m2 or more with fewer than two pieces standing in it (the
// decorator's audit bareFloors: rugs left out); the lanes and the ways in keep to that.
function leavesBare(b, m, drop) {
  if (m.area < 8) return false;
  let n = 0;
  for (const q of b.pieces) {
    if (!q.decor || drop.has(q) || q.outside || q.yard || PL.piece(q.name).role === 'rug') continue;
    if (q.y > m.stand - 0.3 && q.y < m.stand + 3 && m.inside(q.x, q.z) && ++n >= 2) return false;
  }
  return true;
}
function roomsOf(b, ctx) {
  const K = NODE_L ? require('./kitbash.js') : window.VHKitbash;
  return K.roomsB(b, ctx);
}

// A group of loose furniture to another spot of its floor, clear of the lane cells given and reached by a person
// (walkMap, spotsFor below); false when it fits nowhere or holds a piece that never moves.
function moveAside(b, list, path) {
  if (!b.rooms || !b.rooms.length) return false;
  const F = decorL().FURNITURE, Ck = checksL();
  if (list.some(p => !p.decor || p.wclip || p.fclip || p.trim || p.outside || p.yard || PL.piece(p.name).role === 'door' || PL.piece(p.name).role === 'fire' || (p.rest && ['wall', 'hang'].includes(p.rest)) || ['mount', 'hang'].includes((F[p.name] || {}).at))) return false;
  // the biggest piece on the floor leads
  const area = p => { const o = Ck.aabb(p); return (o.x1 - o.x0) * (o.z1 - o.z0) - (p.rest === 'on' ? 99 : 0) - p.y; };
  const grp = [...list].sort((a, c) => area(c) - area(a));
  const W = walkMap(b);
  let h = 0;
  for (const p of grp) h = (Math.imul(h ^ Math.round(p.x * 100 + p.z * 7), 16777619) + 1) >>> 0;
  const S = spotsFor(b, W, grp, (path || []).map(c => ({ x: c.x, z: c.z })), h);
  for (const s of S.slice(0, 10)) {
    const u = placeGroup(grp, S.cx, S.cz, s);
    if (meshClear(b, grp)) return true;
    u();
  }
  return false;
}

// Open every room's lanes: from the first door, every door, the fire, each stair and each bed's open side reached by a
// player's width; then the main lanes (door to fire, door to stairs) at the width the rules want, where only loose
// furniture is in the way. Returns how many units went.
function clearLanes(b, ctx, rooms) {
  const RU = rules();
  if (!RU || (ctx.layout && ctx.layout.lanes === false) || ctx.layout === false) return 0;
  const Ck = checksL();
  const firstChest = b.pieces.find(p => p.decor && !p.kb && !p.outside && PL.piece(p.name).role === 'storage' && /chest/.test(p.name)) || null;
  let gone = 0, moved = 0;
  const cache = new Map();
  for (const room of rooms || roomsOf(b, ctx)) {
    const m = room.m;
    const hall = ['hall', 'tavern', 'temple'].includes(room.role);
    const passes = [{ r: (RU.lanes && RU.lanes.radius) || 0.45, all: true }, { r: ((hall ? RU.clearance.hallLane.min : RU.clearance.mainLane.min) / 2), all: false }];
    let budget = Math.max(2, Math.round(m.area / 12));
    for (const pass of passes) {
      for (let round = 0; round < 6 && budget > 0; round++) {
        const units = unitsOf(b);
        const unitOf = new Map();
        for (const [k, list] of units) for (const p of list) unitOf.set(p, k);
        const obs = obstaclesOf(b, m, cache);
        for (const ob of obs) if (ob.decor) { const u = units.get(unitOf.get(ob.p)); ob.unit = unitOf.get(ob.p); ob.keep = !u || !removable(u, firstChest); }
        const G = grid(m, obs, pass.r);
        const T = targetsOf(m, b).filter(t => pass.all || t.kind !== 'bed');
        if (!pass.all && !T.some(t => t.kind === 'fire' || t.kind === 'stair')) break;
        const doors = T.filter(t => t.kind === 'door');
        const start = doors.length ? targetPts(doors[0], G) : T.length ? targetPts(T[0], G) : [];
        if (!start.length) break;
        const seen = reach(G, start);
        const missing = T.filter(t => { const pts = targetPts(t, G); return pts.length && !pts.some(pt => seen.has(pt)); });
        if (!missing.length) break;
        const goal = new Set(targetPts(missing[0], G));
        const from = seen.size ? [...seen] : start.filter(pt => !pt.hard);
        const path = cheapest(G, from, goal);
        if (!path) break;
        const out = new Set();
        for (const pt of path) for (const ob of pt.block || []) out.add(ob.unit);
        if (!out.size) break;
        let any = false;
        for (const u of out) {
          if (budget <= 0) break;
          const list = units.get(u) || [];
          const drop = new Set(list);
          // what stands on these pieces goes too; when it may not go (the room's first chest), neither does what holds
          // it up (a chest was left in the air over a bench taken out of a lane); the set grows as it is walked, so what
          // stands on a rider goes too (a bar counter's beam on its half wall)
          let keep = false;
          for (const p of drop) {
            const o = Ck.aabbShapes(p);
            for (const q of b.pieces) if (q.decor && !drop.has(q) && q.x > o.x0 && q.x < o.x1 && q.z > o.z0 && q.z < o.z1 && q.y > o.y0 + 0.2 && q.y < o.y1 + 0.6) {
              const qu = units.get(unitOf.get(q)) || [q];
              if (!removable(qu, firstChest)) { keep = true; continue; }
              for (const r of qu) drop.add(r);
            }
          }
          if (keep) continue;
          // moved off the lane to a spot of its floor a person reaches, before it is left out (D-148: what does not
          // fit is left out)
          if (moveAside(b, [...drop], path)) { budget--; moved++; any = true; continue; }
          if (leavesBare(b, m, drop)) continue;
          b.pieces = b.pieces.filter(p => !drop.has(p));
          budget--; gone++; any = true;
        }
        if (!any) break;
      }
    }
  }
  if (gone && b.notes) b.notes.push(`${gone} pieces of loose furniture taken out of the walking lanes.`);
  if (moved && b.notes) b.notes.push(`${moved} pieces of loose furniture moved aside from the walking lanes.`);
  return gone;
}

// The entry zone just inside every door of a room: as wide as the opening and 0.3 m more each side, 1.5 m deep (the
// 1.5 m turning circle of the accessibility guides; nine corpus builds in ten leave 1.6 m or more free inside a home's
// door and more in other rooms, docs/INTERIOR_DESIGN.md "A clear way in"). D-152 (Tyler, 2026-11-11): "chests etc
// (othe furniture and objects, not just chests) might not explicitly be in doorways themselves but they can be very
// very close to those entrances in such a way that they halve the amount of space immediately inside for someone to
// enter and explore". Loose furniture standing in a zone between the floor and 1.8 m goes, with what stands on it;
// beds, fires, stations, tables and the house's first chest stay (as removable() reads them) and are counted by
// lab/reach.js.
function clearEntries(b, ctx, rooms) {
  const Ck = checksL();
  const firstChest = b.pieces.find(p => p.decor && !p.kb && !p.outside && PL.piece(p.name).role === 'storage' && /chest/.test(p.name)) || null;
  let gone = 0;
  for (const room of rooms || roomsOf(b, ctx)) {
    const m = room.m;
    for (const d of m.doors || []) {
      const w = (d.w || 1) + 0.6, dep = 1.5, ux = -d.nz, uz = d.nx, cx = d.x + d.nx * ((d.ht || 0) + dep / 2), cz = d.z + d.nz * ((d.ht || 0) + dep / 2);
      const inZone = o => {
        // the box's corners and middle against the zone, in the zone's frame
        const pts = [[o.x0, o.z0], [o.x1, o.z0], [o.x0, o.z1], [o.x1, o.z1], [(o.x0 + o.x1) / 2, (o.z0 + o.z1) / 2]];
        const loc = pts.map(([x, z]) => [(x - cx) * ux + (z - cz) * uz, (x - cx) * d.nx + (z - cz) * d.nz]);
        const a0 = Math.min(...loc.map(q => q[0])), a1 = Math.max(...loc.map(q => q[0])), n0 = Math.min(...loc.map(q => q[1])), n1 = Math.max(...loc.map(q => q[1]));
        return a0 < w / 2 && a1 > -w / 2 && n0 < dep / 2 && n1 > -dep / 2;
      };
      const units = unitsOf(b), out = new Set();
      for (const [, list] of units) {
        if (!list.some(p => {
          const role = PL.piece(p.name).role;
          if (['rug', 'door', 'floor'].includes(role) || p.yard || p.trim) return false;
          const o = Ck.aabbShapes(p);
          return !o.pass && o.y0 < m.stand + 1.8 && o.y1 > m.stand + 0.05 && inZone(o);
        })) continue;
        if (!removable(list, firstChest) || leavesBare(b, m, new Set([...out, ...list]))) continue;
        for (const p of list) out.add(p);
      }
      if (!out.size) continue;
      // what stands on these pieces goes too
      for (const p of [...out]) {
        const o = Ck.aabbShapes(p);
        for (const q of b.pieces) if (q.decor && !out.has(q) && q.x > o.x0 && q.x < o.x1 && q.z > o.z0 && q.z < o.z1 && q.y > o.y0 + 0.2 && q.y < o.y1 + 0.6) out.add(q);
      }
      b.pieces = b.pieces.filter(p => !out.has(p));
      gone += out.size;
    }
  }
  if (gone && b.notes) b.notes.push(`${gone} pieces moved out of the way in at the doors.`);
  return gone;
}

// ---------------------------------------------------------------- measures (stage 3 and the bench)
// Per room: the share of floor a player can walk, the share of that joined to the first door, whether every target is
// reached, and the widest lane (in steps of 0.1 m) from the first door to the fire and the stairs.
function measure(b, ctx, rooms) {
  const out = [];
  const cache = new Map();
  for (const room of rooms || roomsOf(b, ctx)) {
    const m = room.m;
    const obs = obstaclesOf(b, m, cache);
    const G = grid(m, obs, 0.4);
    const walk = G.pts.filter(p => !p.hard && !p.block);
    const T = targetsOf(m, b);
    const doors = T.filter(t => t.kind === 'door');
    const start = doors.length ? targetPts(doors[0], G) : [];
    const seen = start.length ? reach(G, start) : new Set();
    const reached = T.filter(t => { const pts = targetPts(t, G); return !pts.length || pts.some(pt => seen.has(pt)); }).length;
    let width = 0;
    const main = T.filter(t => t.kind === 'fire' || t.kind === 'stair');
    if (start.length && main.length) {
      for (let r = 0.3; r <= 1.2; r += 0.05) {
        const G2 = grid(m, obs, r);
        const s2 = reach(G2, targetsOf(m, b).filter(t => t.kind === 'door').slice(0, 1).flatMap(t => targetPts(t, G2)));
        const ok = main.every(t => targetPts(t, G2).some(pt => s2.has(pt)));
        if (!ok) break;
        width = +(2 * r).toFixed(2);
      }
    }
    // the same with the structure alone, so a plan the building itself splits (an arcade, posts) is told apart
    const Gb = grid(m, obs.filter(o => !o.decor), 0.4);
    const sb = start.length ? reach(Gb, doors.slice(0, 1).flatMap(t => targetPts(t, Gb))) : new Set();
    const reachedBare = T.filter(t => { const pts = targetPts(t, Gb); return !pts.length || pts.some(pt => sb.has(pt)); }).length;
    out.push({ role: room.role, area: m.area, walk: walk.length / Math.max(1, G.pts.length), joined: walk.length ? [...seen].length / walk.length : 0,
      targets: T.length, reached, reachedBare, laneWidth: main.length ? width : null });
  }
  return out;
}

// ---------------------------------------------------------------- ways in and round the whole building (D-152, D-148)
// D-152 (Tyler, 2026-11-11): "egress and room movement should always allow someone to move into rooms and explore".
// D-148 (Tyler, 2026-11-11): "a player or npc must be able to navigate around the table to the bed or vice versa. So if
// .6m is too tight to do so, any furniture or decor that disrupts that expectation should not be placed. Any furniture
// or decor."
// walkMap reads the finished design as lab/reach.js does: a 0.25 m grid over the design's room rects, a cell free when
// no solid between 0.25 and 1.8 m over its floor comes within 0.45 m (a 0.9 m lane), walked from inside every door to
// the outside and over the climbs. What it finds: room rects with no reached cell, beds, tables, stations, chests and
// barrels on a floor with no reached cell within 0.9 m of their box, and furniture in the entry zone just inside a door
// (the opening plus 0.3 m each side, 1.5 m deep). openWays then moves, turns, swaps or leaves out pieces until none is
// left or nothing more helps.
const WS = 0.25, WR = 0.45;
const W_PASS = new Set(['floor', 'rug', 'roof', 'roofTop', 'roofCorner', 'door', 'nature', 'misc']);
const W_MAIN = new Set(['bed', 'table', 'craft', 'storage']);
function wHung(p) { const f = decorL().FURNITURE[p.name]; return !!(p.decor && f && ['mount', 'hang', 'top', 'rug'].includes(f.at)); }
function wSolid(p) {
  const role = PL.piece(p.name).role;
  if (W_PASS.has(role) || role === 'stair' || wHung(p) || p.onTable) return null;
  const o = checksL().aabbShapes(p);
  return o.pass ? null : o;
}
const wDist = (o, x, z) => Math.hypot(Math.max(o.x0 - x, 0, x - o.x1), Math.max(o.z0 - z, 0, z - o.z1));
function walkMap(b) {
  const P = PL, Ck = checksL(), F = decorL().FURNITURE;
  const rooms = (b.rooms || []).filter(r => r.x1 > r.x0 && r.z1 > r.z0);
  const out = { rooms, roomsOut: [], piecesOut: [], entry: [], zones: [], levels: [], grids: new Map(), bad: 0 };
  if (!rooms.length) return out;
  const solids = [];
  for (const p of b.pieces) { const o = wSolid(p); if (o) solids.push({ p, o, decor: !!p.decor }); }
  const levels = [...new Set(rooms.map(r => Math.round(r.y * 4) / 4))].sort((a, c) => a - c);
  out.levels = levels;
  for (const y of levels) {
    const rs = rooms.filter(r => Math.abs(r.y - y) < 0.2);
    const x0 = Math.min(...rs.map(r => r.x0)), x1 = Math.max(...rs.map(r => r.x1)), z0 = Math.min(...rs.map(r => r.z0)), z1 = Math.max(...rs.map(r => r.z1));
    const here = solids.filter(s => s.o.y0 < y + 1.8 && s.o.y1 > y + 0.25);
    // buckets of 1 m over the boxes grown by the lane's radius
    const bk = new Map();
    for (const s of here) for (let i = Math.floor(s.o.x0 - WR); i <= Math.floor(s.o.x1 + WR); i++) for (let j = Math.floor(s.o.z0 - WR); j <= Math.floor(s.o.z1 + WR); j++) {
      const k = i * 4096 + j; if (!bk.has(k)) bk.set(k, []); bk.get(k).push(s);
    }
    const cells = new Map();
    for (let x = x0 + WS / 2; x < x1; x += WS) for (let z = z0 + WS / 2; z < z1; z += WS) {
      if (!rs.some(r => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1)) continue;
      const c = { x, z, i: Math.round(x / WS), j: Math.round(z / WS), hard: false, block: null, seen: false };
      for (const s of bk.get(Math.floor(x) * 4096 + Math.floor(z)) || []) {
        if (wDist(s.o, x, z) >= WR) continue;
        if (!s.decor) { c.hard = true; continue; }
        (c.block || (c.block = [])).push(s.p);
      }
      c.free = !c.hard && !c.block;
      cells.set(`${c.i},${c.j}`, c);
    }
    out.grids.set(y, { y, rs, cells, list: [...cells.values()] });
  }
  const queue = [];
  const seed = (y, c) => { if (c.free && !c.seen) { c.seen = true; queue.push([y, c]); } };
  const near = (g, x, z, rad) => g.list.filter(c => Math.hypot(c.x - x, c.z - z) <= rad);
  for (const p of b.pieces) {
    if (p.decor || P.piece(p.name).role !== 'door') continue;
    const o = P.doorOpening(p);
    const y = levels.find(l => Math.abs(l - o.y) < 0.6);
    if (y == null) continue;
    const g = out.grids.get(y);
    const inRoom = (x, z) => g.rs.some(r => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
    for (const sg of [1, -1]) {
      const ix = o.x + o.nx * sg * 0.8, iz = o.z + o.nz * sg * 0.8, ox = o.x - o.nx * sg * 0.8, oz = o.z - o.nz * sg * 0.8;
      if (!inRoom(ix, iz)) continue;
      if (!inRoom(ox, oz)) for (const c of near(g, o.x + o.nx * sg * 0.6, o.z + o.nz * sg * 0.6, 1.2)) seed(y, c);
      out.zones.push({ y, x: o.x, z: o.z, ux: o.ux, uz: o.uz, nx: o.nx * sg, nz: o.nz * sg, hw: o.w / 2 + 0.3, dep: 1.5 });
    }
  }
  // the entry zones: a box is in one when a point of the zone (0.25 m steps) lies in it
  out.inZone = (o, y) => out.zones.some(zn => {
    if (Math.abs(zn.y - y) > 0.3) return false;
    for (let a = -zn.hw; a <= zn.hw + 1e-6; a += 0.25) for (let dd = 0.15; dd <= zn.dep + 1e-6; dd += 0.25) if (wDist(o, zn.x + zn.ux * a + zn.nx * dd, zn.z + zn.uz * a + zn.nz * dd) < 0.01) return true;
    return false;
  });
  for (const s of solids) {
    if (!s.decor || W_PASS.has(PL.piece(s.p.name).role)) continue;
    const y = levels.find(l => s.o.y0 < l + 1.8 && s.o.y1 > l + 0.05 && s.p.y > l - 0.5 && s.p.y < l + 1.8);
    if (y != null && out.inZone(s.o, y)) out.entry.push(s.p);
  }
  // climbs
  const climbs = [];
  for (const p of b.pieces.filter(q => !q.decor && P.piece(q.name).role === 'stair')) {
    const o = Ck.aabb(p);
    const touch = climbs.filter(c => c.some(q => q.o.x0 < o.x1 + 0.3 && q.o.x1 > o.x0 - 0.3 && q.o.z0 < o.z1 + 0.3 && q.o.z1 > o.z0 - 0.3 && q.o.y0 < o.y1 + 0.3 && q.o.y1 > o.y0 - 0.3));
    const merged = [{ p, o }, ...touch.flat()];
    for (const t of touch) climbs.splice(climbs.indexOf(t), 1);
    climbs.push(merged);
  }
  out.climbs = [];
  const links = [];
  for (const c of climbs) {
    const lo = c.reduce((a, q) => (q.o.y0 < a.o.y0 ? q : a)), hi = c.reduce((a, q) => (q.o.y1 > a.o.y1 ? q : a));
    out.climbs.push(lo.o, hi.o);
    const yl = levels.filter(l => Math.abs(l - lo.o.y0) < 0.7).sort((a, d) => Math.abs(a - lo.o.y0) - Math.abs(d - lo.o.y0))[0];
    const yh = levels.filter(l => Math.abs(l - hi.o.y1) < 0.9 && l !== yl).sort((a, d) => Math.abs(a - hi.o.y1) - Math.abs(d - hi.o.y1))[0];
    if (yl == null || yh == null) continue;
    const A = out.grids.get(yl).list.filter(cc => wDist(lo.o, cc.x, cc.z) <= 1.2), B = out.grids.get(yh).list.filter(cc => wDist(hi.o, cc.x, cc.z) <= 1.2);
    if (A.length && B.length) links.push([yl, A, yh, B]);
  }
  out.links = links;
  if (!queue.length) { const g = out.grids.get(levels[0]); const m = g.rs.find(r => r.main) || g.rs[0]; for (const c of g.list) if (c.free && c.x > m.x0 && c.x < m.x1 && c.z > m.z0 && c.z < m.z1) { seed(levels[0], c); break; } }
  const walk = () => {
    while (queue.length) {
      const [y, c] = queue.pop(), g = out.grids.get(y);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = g.cells.get(`${c.i + di},${c.j + dj}`); if (n) seed(y, n); }
    }
  };
  walk();
  for (let k = 0; k < links.length + 1; k++) {
    let more = false;
    for (const [yl, A, yh, B] of links) {
      if (A.some(c => c.seen && c.free) && !B.some(c => c.seen)) { for (const c of B) seed(yh, c); more = true; }
      if (B.some(c => c.seen && c.free) && !A.some(c => c.seen)) { for (const c of A) seed(yl, c); more = true; }
    }
    walk();
    if (!more) break;
  }
  for (const r of rooms) {
    const g = out.grids.get(levels.find(l => Math.abs(l - r.y) < 0.2));
    if (!g.list.some(c => c.seen && c.x > r.x0 && c.x < r.x1 && c.z > r.z0 && c.z < r.z1)) out.roomsOut.push(r);
  }
  out.mains = [];
  for (const s of solids) {
    const p = s.p, f = F[p.name];
    // a station's extension works by standing near its station and is never used itself (lab/reach.js)
    if (!p.decor || !f || !W_MAIN.has(f.cat) || p.outside || p.yard || /cauldron|cookingstation/.test(p.name) || /_ext(\d|_|$)/.test(p.name)) continue;
    const y = levels.find(l => p.y > l - 0.3 && p.y < l + 0.45);
    if (y == null) continue;
    out.mains.push(p);
    const g = out.grids.get(y);
    if (!g.list.some(c => c.seen && wDist(s.o, c.x, c.z) < 0.9)) out.piecesOut.push(p);
  }
  out.problems = new Set([...out.entry, ...out.piecesOut, ...out.roomsOut]);
  out.bad = out.entry.length + out.piecesOut.length + 3 * out.roomsOut.length;
  out.levelOf = p => levels.find(l => p.y > l - 0.3 && p.y < l + 0.45);
  return out;
}

// The pieces that go with a piece when it moves or goes: what stands on it, and for a table the seats at it.
function groupOf(b, p, part) {
  const Ck = checksL(), F = decorL().FURNITURE;
  const g = new Set([p]);
  const cat = (F[p.name] || {}).cat;
  if (cat === 'table') {
    const o = Ck.aabb(p);
    for (const q of b.pieces) if (q !== p && q.decor && !q.outside && (F[q.name] || {}).cat === 'seat' && Math.abs(q.y - p.y) < 0.5 && wDist(o, q.x, q.z) < 0.9) g.add(q);
  }
  // a library assembly (lib/kitbash.js) moves whole; to leave pieces out, the piece and what stands on it (part)
  if (!part) for (const m of [...g]) if (m.kb) for (const q of b.pieces) if (q.kb === m.kb) g.add(q);
  for (let k = 0; k < 3; k++) for (const m of [...g]) {
    const o = Ck.aabb(m);
    for (const q of b.pieces) {
      if (!q.decor || g.has(q) || (q.rest && ['wall', 'hang'].includes(q.rest)) || (F[q.name] || {}).at === 'mount' || (F[q.name] || {}).at === 'hang') continue;
      // a set piece that says it rests on something (a mug stand on a bench, a plank top half over a chest) goes with
      // the piece it rests on, and only with that piece
      if (q.kb && q.rest === 'on') { if (wRestsOn(q, m)) g.add(q); continue; }
      if (q.x > o.x0 && q.x < o.x1 && q.z > o.z0 && q.z < o.z1 && q.y > o.y0 + 0.2 && q.y < o.y1 + 0.6) g.add(q);
    }
  }
  return [...g];
}
// q rests on m: m's top under q's foot, read as decorate.js audit reads a set piece's rest (kbRests)
function wRestsOn(q, m) {
  if (Math.abs(q.x - m.x) > 3 || Math.abs(q.z - m.z) > 3) return false;
  const SH = SHL(), F = decorL().FURNITURE, y0 = q.y - ((F[q.name] || {}).base || 0);
  let top = null;
  if (SH && SH.lidAt) { top = SH.lidAt(m, q.x, q.z); if (top == null) { const W = SH.world(m); if (W && W.length) top = SH.topAt(W, q.x, q.z); } }
  if (top == null) { const o = checksL().aabb(m); if (q.x > o.x0 && q.x < o.x1 && q.z > o.z0 && q.z < o.z1) top = o.y1; }
  return top != null && top > y0 - 0.15 && top < y0 + 0.12;
}
const W_QUAT = yaw => { const a = yaw * Math.PI / 360; return [0, +Math.sin(a).toFixed(6), 0, +Math.cos(a).toFixed(6)]; };
const wYaw = p => (p.yaw != null ? p.yaw : (() => { const [x, y, z, w] = p.q || [0, 0, 0, 1]; return Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + x * x)) * 180 / Math.PI; })());
// Where a group could stand on its floor: every spot on a 0.25 m grid of the level's room rects and four turns, each
// member's box inside the rects, clear of every other solid, of the entry zones, the climbs and their feet, the fire's
// ring and the cells a lane is to keep ('keep'), best first: near where it stood, backed to a wall, turned least.
function spotsFor(b, W, grp, keep, seedN) {
  const Ck = checksL();
  const a = grp[0], y = W.levelOf(a);
  if (y == null) return [];
  const g = W.grids.get(y);
  const set = new Set(grp);
  const ob = Ck.aabbShapes(a), cx = (ob.x0 + ob.x1) / 2, cz = (ob.z0 + ob.z1) / 2;
  const rel = grp.map(p => { const o = Ck.aabbShapes(p); return { p, x0: o.x0 - cx, x1: o.x1 - cx, z0: o.z0 - cz, z1: o.z1 - cz, y0: o.y0, y1: o.y1, dx: p.x - cx, dz: p.z - cz, floor: p.y < y + 0.45 }; });
  if (!rel[0].floor) return [];
  // a set built of building pieces (a beam shelf over a chest, a half-wall counter) keeps the wall it was built against:
  // a beam moved out into the room is a low beam over the walking floor (lib/checks.js headroom)
  if (grp.some(p => PL.piece(p.name).structural)) return [];
  // the decorator's own reading of furniture against furniture (lib/decorate.js audit overlap), a little stricter
  const DI = decorL()._int, FD = decorL().FURNITURE;
  const skipAt = n => { const f = FD[n] || {}; return ['mount', 'hang', 'top', 'fire', 'rug'].includes(f.at); };
  const itemBox = (n, x, z, yaw, py) => { const [w, h, d] = DI.size(n); const f = FD[n] || {}; const [mx, mz] = DI.middleOf(n, x, z, yaw); const y0 = py - (f.base || 0); return { b: DI.obox(mx, mz, w, d, yaw), y0, y1: y0 + h }; };
  const items = b.pieces.filter(q => q.decor && !set.has(q) && !skipAt(q.name) && !(!FD[q.name] && PL.piece(q.name).structural)).map(q => itemBox(q.name, q.x, q.z, DI.pyaw(q), q.y));
  const mine = rel.filter(r => r.p.decor && !skipAt(r.p.name) && !(!FD[r.p.name] && PL.piece(r.p.name).structural));
  // the decorator's door boxes: 1.2 m deep in front of each side of a door, the door's width (lib/decorate.js audit)
  const doorBoxes = [];
  for (const q of b.pieces) {
    if (set.has(q) || PL.piece(q.name).role !== 'door') continue;
    const [w, h] = PL.piece(q.name).size, d0 = PL.piece(q.name).size[2], yaw = DI.pyaw(q), ar = yaw * Math.PI / 180, nx0 = Math.sin(ar), nz0 = Math.cos(ar);
    if (q.y + h < y || q.y - h > y + 2) continue;
    for (const sg of [1, -1]) doorBoxes.push(DI.obox(q.x + nx0 * sg * (d0 / 2 + 0.6), q.z + nz0 * sg * (d0 / 2 + 0.6), w, 1.2, yaw));
  }
  const others = [];
  for (const q of b.pieces) {
    if (set.has(q)) continue;
    const role = PL.piece(q.name).role;
    if (['floor', 'rug'].includes(role)) continue;
    const o = Ck.aabbShapes(q);
    if (o.pass || o.y1 < y + 0.05 || o.y0 > y + 2.4) continue;
    others.push({ o, struct: !q.decor, fire: role === 'fire' || /fire_pit|hearth|bonfire|brazier/.test(q.name), stair: role === 'stair', door: role === 'door' });
  }
  const turn = (r, k) => {
    // a quarter turn clockwise seen from above, k times: (x, z) to (z, -x)
    let { x0, x1, z0, z1 } = r;
    for (let i = 0; i < k; i++) [x0, x1, z0, z1] = [z0, z1, -x1, -x0];
    return { x0, x1, z0, z1 };
  };
  // floor pieces whose top is this floor: where there are any, a spot stands on them (an upper floor's rect can hold a
  // stair hole or an open side)
  const floors = b.pieces.filter(q => !q.decor && PL.piece(q.name).role === 'floor').map(q => Ck.aabb(q)).filter(o => Math.abs(o.y1 - y) < 0.2);
  const onFloor = (x, z) => !floors.length || floors.some(o => x > o.x0 - 0.05 && x < o.x1 + 0.05 && z > o.z0 - 0.05 && z < o.z1 + 0.05);
  const inRects = (x, z) => g.rs.some(r => x > r.x0 + 0.02 && x < r.x1 - 0.02 && z > r.z0 + 0.02 && z < r.z1 - 0.02) && onFloor(x, z);
  let h = (seedN >>> 0) || 7;
  const R = () => { h ^= h << 13; h >>>= 0; h ^= h >> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
  const out = [];
  for (let k = 0; k < 4; k++) {
    const boxes = rel.map(r => ({ ...turn(r, k), y0: r.y0, y1: r.y1, floor: r.floor }));
    for (const c of g.list) {
      if (c.hard) continue;
      const nx = c.x, nz = c.z;
      let ok = true, wall = 0;
      for (const bx of boxes) {
        const B = { x0: bx.x0 + nx, x1: bx.x1 + nx, z0: bx.z0 + nz, z1: bx.z1 + nz, y0: bx.y0, y1: bx.y1 };
        if (bx.floor && !(inRects(B.x0, B.z0) && inRects(B.x1, B.z0) && inRects(B.x0, B.z1) && inRects(B.x1, B.z1))) { ok = false; break; }
        for (const q of others) {
          const o = q.o;
          const pad = q.fire ? 0.8 : q.stair ? 1.0 : q.door ? 0.3 : 0;
          if (o.x0 > B.x1 + pad || B.x0 > o.x1 + pad || o.z0 > B.z1 + pad || B.z0 > o.z1 + pad) { if (q.struct && bx.floor && o.x0 < B.x1 + 0.15 && B.x0 < o.x1 + 0.15 && o.z0 < B.z1 + 0.15 && B.z0 < o.z1 + 0.15) wall = 1; continue; }
          if (pad) { ok = false; break; }
          if (o.y0 > B.y1 - 0.03 || B.y0 > o.y1 - 0.03) continue;
          if (Ck.blocks({ ...B, y0: B.y0 + 0.05 }, o, -0.03)) { ok = false; break; }
          if (q.struct && bx.floor) wall = 1;
        }
        if (!ok) break;
        if (bx.floor && W.inZone(B, y)) { ok = false; break; }
        if (keep && bx.floor && keep.some(kc => wDist(B, kc.x, kc.z) < WR)) { ok = false; break; }
        for (const cl of W.climbs) if (wDist(cl, (B.x0 + B.x1) / 2, (B.z0 + B.z1) / 2) < 1.2 + Math.max(B.x1 - B.x0, B.z1 - B.z0) / 2 && Math.abs(cl.y0 - y) < 3) { ok = false; break; }
        if (!ok) break;
      }
      if (!ok) continue;
      for (const r of mine) {
        let dx = r.dx, dz = r.dz;
        for (let i = 0; i < k; i++) [dx, dz] = [dz, -dx];
        const A = itemBox(r.p.name, nx + dx, nz + dz, (((DI.pyaw(r.p) + 90 * k) % 360) + 360) % 360, r.p.y);
        if (items.some(c2 => !(A.y0 > c2.y1 - 0.05 || c2.y0 > A.y1 - 0.05) && DI.overlap(A.b, c2.b, -0.02))) { ok = false; break; }
        if (doorBoxes.some(z2 => DI.overlap(z2, A.b, 0.02))) { ok = false; break; }
      }
      if (!ok) continue;
      // a person reaches it there (a reached cell within 0.9 m of its first box that it does not cover itself)
      const B0 = { x0: boxes[0].x0 + nx, x1: boxes[0].x1 + nx, z0: boxes[0].z0 + nz, z1: boxes[0].z1 + nz };
      if (!g.list.some(c2 => c2.seen && Math.abs(c2.x - nx) < 3 && Math.abs(c2.z - nz) < 3 && wDist(B0, c2.x, c2.z) < 0.9 && wDist(B0, c2.x, c2.z) >= WR)) continue;
      const d = Math.hypot(nx - cx, nz - cz);
      if (d < 0.2 && k === 0) continue;
      // the walking floor it would take: reached cells its boxes come within a lane's half width of (a spot backed
      // into a corner or a wall takes least)
      let cover = 0;
      for (const bx of boxes) {
        if (!bx.floor) continue;
        const B = { x0: bx.x0 + nx, x1: bx.x1 + nx, z0: bx.z0 + nz, z1: bx.z1 + nz };
        for (let i = Math.round((B.x0 - WR) / WS); i <= Math.round((B.x1 + WR) / WS); i++) for (let j = Math.round((B.z0 - WR) / WS); j <= Math.round((B.z1 + WR) / WS); j++) {
          const c2 = g.cells.get(`${i},${j}`);
          if (c2 && c2.seen && wDist(B, c2.x, c2.z) < WR) cover++;
        }
      }
      out.push({ x: nx, z: nz, k, v: -0.35 * d + 1.5 * wall - 0.05 * cover - (k % 2 ? 0.3 : k ? 0.2 : 0) + R() * 0.2 });
    }
  }
  out.sort((p, q) => q.v - p.v);
  // spread out: each spot kept is 0.75 m or more from those kept before it, or turned another way
  const kept = [];
  for (const s of out) if (!kept.some(t => t.k % 2 === s.k % 2 && Math.hypot(t.x - s.x, t.z - s.z) < 0.75)) kept.push(s);
  kept.cx = cx; kept.cz = cz;
  return kept;
}
function placeGroup(grp, cx, cz, s) {
  const old = grp.map(p => ({ p, x: p.x, z: p.z, yaw: p.yaw, q: p.q }));
  const dr = 90 * s.k, a = dr * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
  for (const p of grp) {
    const dx = p.x - cx, dz = p.z - cz;
    p.x = +(s.x + dx * c + dz * sn).toFixed(3); p.z = +(s.z - dx * sn + dz * c).toFixed(3);
    if (dr) { const yw = (((wYaw(p) + dr) % 360) + 360) % 360; p.yaw = +yw.toFixed(2); p.q = W_QUAT(p.yaw); }
  }
  return () => { for (const o of old) { o.p.x = o.x; o.p.z = o.z; o.p.yaw = o.yaw; o.p.q = o.q; } };
}
// What shows of a moved piece against what shows of the walls, windows, beams and posts round it (lib/audit.js
// intoWall reads it the same way): a moved bed, table, chest, seat or station keeps within 5 cm of them.
const meshL = () => (NODE_L ? require('./mesh.js') : window.VHMesh);
const SHL = () => (NODE_L ? require('./shapes.js') : window.VHShapes);
const W_STATION = /^(piece_workbench|forge|piece_stonecutter|piece_artisanstation|blackforge|piece_magetable|piece_cauldron)$/;
const W_FURN = ['bed', 'table', 'seat', 'storage', 'craft', 'fire', 'clutter'];
function meshClear(b, grp) {
  const M = meshL(), SH = SHL();
  if (!M || !M.world || !M.deepest) return true;
  const set = new Set(grp);
  // and a station against furniture round it, either way (lib/audit.js onStation)
  for (const p of grp) {
    const rp = PL.piece(p.name).role;
    if (!W_STATION.test(p.name) && !W_FURN.includes(rp)) continue;
    const vis = M.world(p) || [];
    for (const q of b.pieces) {
      if (set.has(q) || !q.decor || Math.abs(q.x - p.x) > 4 || Math.abs(q.z - p.z) > 4 || Math.abs(q.y - p.y) > 3) continue;
      const st = W_STATION.test(p.name) ? W_FURN.includes(PL.piece(q.name).role) && !/_ext\d/.test(q.name) : W_STATION.test(q.name) && !/_ext\d/.test(p.name);
      if (st && M.deepest(vis, M.world(q) || []) > 0.04) return false;
    }
  }
  for (const p of grp) {
    if (!['bed', 'table', 'storage', 'seat', 'craft'].includes(PL.piece(p.name).role)) continue;
    const vis = M.world(p) || [], sol = (SH && SH.world && SH.world(p)) || [];
    for (const q of b.pieces) {
      if (q.decor && !(q.trim && !q.kb)) continue;
      const rq = PL.piece(q.name).role;
      if (!['wall', 'halfwall', 'window', 'beam', 'pole', 'gable', 'door'].includes(rq)) continue;
      if (Math.abs(q.x - p.x) > 4 || Math.abs(q.z - p.z) > 4 || Math.abs(q.y - p.y) > 4) continue;
      const mine = ['wall', 'halfwall', 'gable', 'pole'].includes(rq) ? (sol.length ? sol : vis) : vis;
      if (M.deepest(mine, M.world(q) || []) > 0.05) return false;
    }
  }
  return true;
}

// a change is kept when it leaves fewer problems in all and opens no room or entry zone problem that was not there
// before (a piece it leaves out of reach is put right in its turn, and every change kept lowers the count)
const better = (W, W2) => W2.bad < W.bad && W2.roomsOut.every(x => W.problems.has(x)) && W2.entry.every(x => W.problems.has(x));

// Walk the design and put right what keeps a person out: a piece in an entry zone moves (or turns) to another spot,
// a double bed that fits nowhere becomes a single bed, and what still finds no place is left out; a piece or a room out
// of reach gets its way opened by moving what stands in the cheapest lane to it, then by moving the piece itself,
// then by leaving out what blocks it. Fires, the building's first chest and pieces clipped into walls (D-098) are
// never moved; the first chest and fires are never left out. Returns { moved, swapped, gone, left }.
function openWays(b, ctx) {
  const res = { moved: 0, swapped: 0, gone: 0, left: [] };
  if (!b.rooms || !b.rooms.length || !b.pieces.some(p => p.decor)) return res;
  const F = decorL().FURNITURE;
  const firstChest = b.pieces.find(p => p.decor && !p.kb && !p.outside && PL.piece(p.name).role === 'storage' && /chest/.test(p.name) && !/barrel|crate/.test(p.name)) || null;
  const isFire = p => PL.piece(p.name).role === 'fire' || /fire_pit|hearth|bonfire/.test(p.name);
  // (a set's plank top resting on its chests rides with them: p.kb and rest 'on')
  const fixed = p => !p.decor || isFire(p) || PL.piece(p.name).role === 'door' || p.wclip || p.fclip || (p.trim && !(p.kb && p.rest === 'on')) || p.outside || p.yard || (p.rest && ['wall', 'hang'].includes(p.rest)) || ['mount', 'hang', 'fire'].includes((F[p.name] || {}).at);
  // the building's trim stays, save a trim chest, table or station that closes a way (it counts as furniture to
  // reach); the building pieces of a library set (a kitchen counter of half walls) are furniture here
  const keepAlways = p => !p.decor || isFire(p) || p === firstChest || (p.trim && !p.kb && !W_MAIN.has((F[p.name] || {}).cat)) || p.outside || p.yard;
  let seedN = 0;
  for (const p of b.pieces) seedN = (Math.imul(seedN ^ Math.round(p.x * 100 + p.z * 7), 16777619) + 1) >>> 0;
  const given = new Set();
  let W = walkMap(b);
  const tryMove = (grp, keep, accept) => {
    if (grp.some(fixed)) return false;
    const S = spotsFor(b, W, grp, keep, seedN++);
    for (const s of S.slice(0, 10)) {
      const undo = placeGroup(grp, S.cx, S.cz, s);
      if (!meshClear(b, grp)) { undo(); continue; }
      const W2 = walkMap(b);
      if (accept(W2)) { W = W2; res.moved++; return true; }
      undo();
    }
    return false;
  };
  const drop = (set, accept) => {
    const keepB = b.pieces;
    b.pieces = b.pieces.filter(p => !set.has(p));
    const W2 = walkMap(b);
    if (accept(W2)) { W = W2; res.gone += set.size; return true; }
    b.pieces = keepB;
    return false;
  };
  const swapBed = (p, accept) => {
    if (p.name !== 'piece_bed02') return false;
    const old = p.name;
    p.name = 'bed';
    const grp = groupOf(b, p);
    if (tryMove(grp, null, accept)) { res.swapped++; return true; }
    const W2 = walkMap(b);
    if (accept(W2)) { W = W2; res.swapped++; return true; }
    p.name = old;
    return false;
  };
  for (let it = 0; it < 80; it++) {
    // rooms first (a way into a room reaches what stands in it), then pieces, then the ways in
    const probs = [...W.roomsOut.map(r => ['room', r]), ...W.piecesOut.map(p => ['piece', p]), ...W.entry.map(p => ['entry', p])].filter(([, x]) => !given.has(x));
    if (!probs.length) break;
    const [kind, x] = probs[0];
    const W0 = W, ok0 = W2 => better(W0, W2);
    let ok = false;
    if (kind === 'entry') {
      const grp = groupOf(b, x);
      ok = tryMove(grp, null, W2 => ok0(W2) && !W2.entry.includes(x)) || swapBed(x, W2 => ok0(W2) && !W2.entry.includes(x));
      if (!ok && !keepAlways(x) && (F[x.name] || {}).cat !== 'bed') ok = drop(new Set(grp), ok0);
    } else {
      // the cells next to the piece (or in the room) a person would stand on, and the cheapest lane to them
      const y = kind === 'piece' ? W.levelOf(x) : W.levels.find(l => Math.abs(l - x.y) < 0.2);
      let g = W.grids.get(y);
      const o = kind === 'piece' ? checksL().aabbShapes(x) : null;
      let goal = new Set(g.list.filter(c => !c.hard && (o ? wDist(o, c.x, c.z) < 0.9 && wDist(o, c.x, c.z) >= WR - 0.01 : c.x > x.x0 && c.x < x.x1 && c.z > x.z0 && c.z < x.z1)));
      let from = g.list.filter(c => c.seen);
      let path = null, closed = false;
      const blockers = new Set();
      if (!from.length) {
        // a floor nobody reaches yet: the foot of its climb on a floor that is reached, or the cells at its top
        const seenAt = l => W.grids.get(l).list.some(c => c.seen);
        const lk = W.links.find(([yl, , yh]) => (yh === y && seenAt(yl)) || (yl === y && seenAt(yh)));
        if (!lk) closed = true;
        else {
          const [yl, A, yh, B] = lk, [ys, Sd, Td] = yh === y ? [yl, A, B] : [yh, B, A];
          if (!Sd.some(c => c.seen)) {
            g = W.grids.get(ys); from = g.list.filter(c => c.seen); goal = new Set(Sd.filter(c => !c.hard));
            path = goal.size ? wCheapest(g, from, goal, null) : null;
            closed = !wCheapest(g, from, goal, null, true);
          } else {
            path = Td.filter(c => !c.hard && c.block);
            if (!path.length) closed = true;
          }
        }
      } else {
        path = goal.size ? wCheapest(g, from, goal, kind === 'piece' ? x : null) : null;
        // a room the structure itself closes off (a plan with no way in to it) keeps its furniture and is reported
        // (lab/check_interiors.js reachRoom); a piece in a nook the structure closes moves to a reached floor
        const rect = kind === 'room' ? x : g.rs.find(r => x.x > r.x0 && x.x < r.x1 && x.z > r.z0 && x.z < r.z1);
        if (rect) closed = !wCheapest(g, from, new Set(g.list.filter(c => !c.hard && c.x > rect.x0 && c.x < rect.x1 && c.z > rect.z0 && c.z < rect.z1)), null, true);
      }
      if (path) for (const c of path) for (const q of c.block || []) if (q !== x) blockers.add(q);
      // a long hearth that leaves no lane past it where the structure leaves one becomes a fire pit on the same spot
      // (D-132: "Fires can be swapped"); the lane is then looked for again on the next round
      if (!path && !closed && from.length && goal.size) {
        for (const f of b.pieces.filter(q => q.decor && q.name === 'hearth' && Math.abs(q.y - g.y) < 0.6)) {
          // what hangs over the hearth (a spit, a cauldron) goes over the pit; one only, the rest go with the hearth
          const o0 = checksL().aabb(f);
          const onIt = b.pieces.filter(q => q.decor && (F[q.name] || {}).at === 'fire' && q.x > o0.x0 - 0.1 && q.x < o0.x1 + 0.1 && q.z > o0.z0 - 0.1 && q.z < o0.z1 + 0.1 && Math.abs(q.y - f.y) < 1.2);
          const keepB = b.pieces, was = onIt.map(q => ({ q, x: q.x, z: q.z }));
          f.name = 'fire_pit';
          const o1 = checksL().aabb(f), over = q => q.x > o1.x0 - 0.1 && q.x < o1.x1 + 0.1 && q.z > o1.z0 - 0.1 && q.z < o1.z1 + 0.1;
          const off = onIt.filter(q => !over(q));
          if (off.length && off.length === onIt.length) { off[0].x = +((o1.x0 + o1.x1) / 2).toFixed(3); off[0].z = +((o1.z0 + o1.z1) / 2).toFixed(3); off.shift(); }
          if (off.length) b.pieces = b.pieces.filter(q => !off.includes(q));
          const W2 = walkMap(b);
          if (ok0(W2)) { W = W2; res.swapped++; ok = true; break; }
          f.name = 'hearth'; b.pieces = keepB;
          for (const w of was) { w.q.x = w.x; w.q.z = w.z; }
        }
      }
      const cat = q => (F[q.name] || {}).cat;
      // 1) what stands in the lane moves off it, each group to the best spot clear of the lane; what finds no spot
      // stays, then goes as well when that is what opens the way: loose things first, then chests (never the
      // building's first chest, a fire or a bed)
      if (!ok && path && blockers.size) {
        const keep = path.map(c => ({ x: c.x, z: c.z }));
        const groups = [], stuck = [];
        const seenG = new Set();
        for (const q of [...blockers]) {
          if (!b.pieces.includes(q) || seenG.has(q)) continue;
          const grp = groupOf(b, q);
          for (const r of grp) seenG.add(r);
          const S = grp.some(fixed) ? [] : spotsFor(b, W, grp, keep, seedN++);
          if (!S.length) stuck.push(grp); else groups.push([grp, S]);
        }
        const tiers = [[], stuck.filter(gp => !gp.some(keepAlways) && !gp.some(q => W_MAIN.has(cat(q)))), stuck.filter(gp => !gp.some(keepAlways) && !gp.some(q => ['bed', 'table', 'craft'].includes(cat(q))))];
        // the groups to their first spots, then their second and third
        for (let r = 0; r < (groups.length === 1 ? 10 : 4) && !ok; r++) {
          if (!groups.length && r) break;
          // one after another, each against where the ones before it went
          const undoAll = [];
          for (const [grp, S0] of groups) {
            const S = undoAll.length ? spotsFor(b, W, grp, keep, seedN++) : S0;
            for (let i = Math.max(0, Math.min(r, S.length - 1)); i < S.length && i < r + 6; i++) {
              const u = placeGroup(grp, S.cx, S.cz, S[i]);
              if (meshClear(b, grp)) { undoAll.push(u); break; }
              u();
            }
          }
          for (const t of tiers) {
            if (t !== tiers[0] && !t.length) continue;
            if (!t.length && !groups.length) continue;
            const set = new Set(t.flat());
            if (!set.size) { const W2 = walkMap(b); if (ok0(W2)) { W = W2; ok = true; } }
            else if (drop(set, ok0)) ok = true;
            if (ok) { res.moved += groups.length; break; }
          }
          if (!ok) for (const u of undoAll.reverse()) u();
        }
      }
      // 2) the piece itself to a spot a person reaches
      if (!ok && !closed && kind === 'piece') ok = tryMove(groupOf(b, x), null, W2 => ok0(W2) && !W2.piecesOut.includes(x));
      // a set's piece alone, with what stands on it and the seats at a table, where the whole set finds no spot
      if (!ok && !closed && kind === 'piece' && x.kb) ok = tryMove(groupOf(b, x, true), null, W2 => ok0(W2) && !W2.piecesOut.includes(x));
      if (!ok && !closed && kind === 'piece') ok = swapBed(x, W2 => ok0(W2) && !W2.piecesOut.includes(x));
      // 3) what blocks the lane is left out: loose things first, then chests, then the piece itself, then tables and
      // stations in the lane (D-148: "any furniture or decor that disrupts that expectation should not be placed")
      if (!ok && !closed && path && blockers.size) {
        const loose = [...blockers].filter(q => !keepAlways(q) && !W_MAIN.has(cat(q)));
        const chests = [...blockers].filter(q => !keepAlways(q) && cat(q) === 'storage');
        const big = [...blockers].filter(q => !keepAlways(q) && ['table', 'craft'].includes(cat(q)));
        const set = new Set();
        // one group at a time first, loose pieces before library sets and the smallest first; then the tier's groups
        // together
        for (const tier of [loose, chests]) {
          const gs = [...new Map(tier.map(q => { const gp = groupOf(b, q, true); return [gp[0], gp]; })).values()].sort((g1, g2) => (g1.some(q => q.kb) ? 1 : 0) - (g2.some(q => q.kb) ? 1 : 0) || g1.length - g2.length);
          for (const gp of gs) if (!ok && !gp.some(keepAlways) && drop(new Set(gp), ok0)) ok = true;
          if (ok) break;
          for (const gp of gs) for (const r of gp) set.add(r);
          if (set.size && drop(new Set(set), ok0)) { ok = true; break; }
        }
        if (!ok && kind === 'piece' && !keepAlways(x) && cat(x) !== 'bed') ok = drop(new Set(groupOf(b, x)), ok0);
        if (!ok && big.length) { for (const q of big) for (const r of groupOf(b, q)) set.add(r); ok = drop(new Set(set), ok0); }
      }
      // a chest, table or station that fits nowhere a person reaches is left out (D-148); beds stay and are reported
      if (!ok && !closed && kind === 'piece' && !keepAlways(x) && cat(x) !== 'bed') ok = drop(new Set(groupOf(b, x)), ok0);
    }
    if (!ok) given.add(x); else given.clear();
  }
  res.left = [...W.entry.map(p => `entry ${p.name}`), ...W.piecesOut.map(p => `out ${p.name}`), ...W.roomsOut.map(r => `room ${r.x0},${r.z0} to ${r.x1},${r.z1} at ${r.y}`)];
  if (b.notes && res.moved + res.swapped + res.gone) b.notes.push(`Ways in kept open: ${res.moved} pieces moved, ${res.swapped} swapped for smaller ones, ${res.gone} left out.`);
  return res;
}
// the cheapest way over cells free of the structure from the reached cells to a goal; a cell furniture blocks costs
// more for each piece in it, more again for beds, tables, stations and chests
function wCheapest(g, from, goal, target, structOnly) {
  const F = decorL().FURNITURE;
  const cost = c => (c.block ? c.block.reduce((t, q) => t + (q === target ? 0 : PL.piece(q.name).role === 'fire' || q.wclip ? 40 : ['bed', 'table', 'craft'].includes((F[q.name] || {}).cat) ? 12 : W_MAIN.has((F[q.name] || {}).cat) ? 8 : 4), 0) : 0);
  const dist = new Map(), prev = new Map(), heap = [];
  const push = (d, n) => { heap.push([d, n]); let i = heap.length - 1; while (i > 0) { const pa = (i - 1) >> 1; if (heap[pa][0] <= heap[i][0]) break; [heap[pa], heap[i]] = [heap[i], heap[pa]]; i = pa; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  for (const s of from) { dist.set(s, 0); push(0, s); }
  if (structOnly) { const seen = new Set(from), st = [...from]; while (st.length) { const a = st.pop(); if (goal.has(a)) return [a]; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = g.cells.get(`${a.i + di},${a.j + dj}`); if (q && !q.hard && !seen.has(q)) { seen.add(q); st.push(q); } } } return null; }
  const done = new Set();
  while (heap.length) {
    const [d, a] = pop();
    if (done.has(a)) continue;
    done.add(a);
    if (goal.has(a)) { const path = []; let c = a; while (c) { path.push(c); c = prev.get(c); } return path; }
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const q = g.cells.get(`${a.i + di},${a.j + dj}`);
      if (!q || q.hard || done.has(q) || (q.block && q.block.some(r => r !== target && (PL.piece(r.name).role === 'fire' || /fire_pit|hearth|bonfire/.test(r.name) || r.wclip)))) continue;
      const nd = d + 1 + cost(q);
      if (!dist.has(q) || nd < dist.get(q)) { dist.set(q, nd); prev.set(q, a); push(nd, q); }
    }
  }
  return null;
}

const apiL = { plan, planFor, floorScore, noteSet, clearLanes, clearEntries, openWays, walkMap, measure, rules, setRules, _int: { obstaclesOf, grid, targetsOf, reach }, _ways: { groupOf, spotsFor, placeGroup } };
if (NODE_L) module.exports = apiL; else window.VHLayout = apiL;
