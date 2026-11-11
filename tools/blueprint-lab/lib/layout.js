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

// Open every room's lanes: from the first door, every door, the fire, each stair and each bed's open side reached by a
// player's width; then the main lanes (door to fire, door to stairs) at the width the rules want, where only loose
// furniture is in the way. Returns how many units went.
function clearLanes(b, ctx, rooms) {
  const RU = rules();
  if (!RU || (ctx.layout && ctx.layout.lanes === false) || ctx.layout === false) return 0;
  const Ck = checksL();
  const firstChest = b.pieces.find(p => p.decor && !p.kb && !p.outside && PL.piece(p.name).role === 'storage' && /chest/.test(p.name)) || null;
  let gone = 0;
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
          if (keep || leavesBare(b, m, drop)) continue;
          b.pieces = b.pieces.filter(p => !drop.has(p));
          budget--; gone++; any = true;
        }
        if (!any) break;
      }
    }
  }
  if (gone && b.notes) b.notes.push(`${gone} pieces of loose furniture moved out of the walking lanes.`);
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

const apiL = { plan, planFor, floorScore, noteSet, clearLanes, clearEntries, measure, rules, setRules, _int: { obstaclesOf, grid, targetsOf, reach } };
if (NODE_L) module.exports = apiL; else window.VHLayout = apiL;
