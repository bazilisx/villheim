// Room intent: every room gets a purpose, a focal point, zones and sets that belong together before a piece is placed
// (showcase review 2026-11-12, track E; Tyler: "Interior design feels extremely random, and not intentional... It feels
// like just throwing things down hodgepodge"). The rules come from three studies:
//   - docs/PIECE_CATALOG.md (track A): what each piece looks like, its family, where builders put it, how often they
//     repeat it, which side is its front;
//   - docs/ROOM_STUDY.md (track B): counts per room kind, table sets, beds, work corners, caps per building;
//   - docs/INTERIOR_DESIGN.md "Room intent: outside study" (track C): the intent template, room kinds and vignettes.
// Their numbers are in data/intent.json (lab/build_intent_data.js). D-136: the numbers come from the corpus; D-127:
// what corpus builders do is allowed. Household and culture traits drive the variety (lib/persona.js), never a
// profession.
//
// One building plan per building (planBuilding): the furniture suite (one table, its seat, the bed and the chest that
// go with it by the corpus and by color), the lead light and the one or two others, the rugs and the household color.
// Then each room (furnishRoom): its intent record (kind, purpose, focal piece, zones, counts) and the placing, through
// the decorator's own placers (lib/decorate.js passes them in as H), so walls, doors, stairs and lanes are kept as
// before. Last, capBuilding holds every piece to its corpus count for the building.

const NODE_I = typeof module !== 'undefined';
let DATA_I;
function data() {
  if (DATA_I !== undefined) return DATA_I;
  DATA_I = null;
  try {
    if (typeof window !== 'undefined' && window.VH_INTENT) DATA_I = window.VH_INTENT;
    else if (NODE_I) DATA_I = require('../data/intent.json');
  } catch (e) { DATA_I = null; }
  return DATA_I;
}
const PI_I = Math.PI;
function rngI(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function hashI(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; }
function pickI(R, list) {
  const l = list.filter(([, w]) => w > 0), tot = l.reduce((a, [, w]) => a + w, 0);
  if (!l.length) return null;
  let r = R() * tot;
  for (const [v, w] of l) { r -= w; if (r <= 0) return v; }
  return l[l.length - 1][0];
}
const pc = id => (data() && data().pieces[id]) || null;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- color
function hexLab(hex) {
  if (!hex) return null;
  const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92));
  const X = (v[0] * 0.4124 + v[1] * 0.3576 + v[2] * 0.1805) / 0.95047, Y = v[0] * 0.2126 + v[1] * 0.7152 + v[2] * 0.0722, Z = (v[0] * 0.0193 + v[1] * 0.1192 + v[2] * 0.9505) / 1.08883;
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
/** Color difference (CIE76) between two pieces' mean albedo; 20 when either is unknown. */
function dE(a, b) {
  const A = hexLab((pc(a) || {}).c), B = hexLab((pc(b) || {}).c);
  if (!A || !B) return 20;
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}
// Families the corpus keeps apart in a room (materials.json rarelyTogether, lift under 0.5)
function clashes(a, b) {
  const fa = (pc(a) || {}).f, fb = (pc(b) || {}).f;
  if (!fa || !fb || fa === fb) return false;
  return (data().rarely || []).some(([x, y, l]) => l < 0.5 && ((x === fa && y === fb) || (x === fb && y === fa)));
}
// Cold glow (blue, green, purple): an accent with a reason, never a home's main light (Tyler on the rune table)
const COLD = /mist|blue|green|magetable|eitr|wisp/;
const coldGlow = id => COLD.test(id);

// ---------------------------------------------------------------- culture tilt
// The culture groups track B measured (caps.json byCulture: norse, norse-forest, castle, ashlands): the share of
// their builds with each prefab, against the corpus share. Other cultures take the corpus as it is.
const CULT_I = { norse: 'norse', 'norse-highland': 'norse', 'norse-forest': 'norse-forest', 'black-forest': 'norse-forest', 'castle-medieval': 'castle',
  'frankish-norman': 'castle', 'anglo-saxon': 'castle', lamari: 'ashlands', dwarven: 'ashlands' };
function tilt(culture, list, id) {
  const g = data().byCulture[CULT_I[culture]];
  if (!g || !g[list]) return 1;
  const e = g[list].find(([n]) => n === id);
  const base = (data().caps[id] || [])[0] || (pc(id) || {}).sh || 0.05;
  if (!e) return 0.7;
  return clamp(0.4 + e[1] / Math.max(0.02, base), 0.5, 3);
}

// ---------------------------------------------------------------- building plan
// Tables builders seat (sets.json tableSets), by the corpus share of builds with each, the household's wealth against
// the table's formality and the culture group's own share. A Dvergr or carved set stays possible at its small share
// (D-166: pieces hidden from the build menu are fine where they have a use).
const SUITE_TABLES = ['piece_table', 'piece_table_round', 'piece_table_oak', 'piece_blackmarble_table', 'dvergrprops_table', 'piece_table_runed', 'piece_table_runed_small'];
const BEDS_I = ['bed', 'piece_bed02', 'ashwood_bed'];
const CHESTS_I = ['piece_chest_wood', 'piece_chest', 'piece_chest_blackmetal'];
// Light prefabs as the lead light of a building: the share of corpus buildings that light their rooms with each
// (caps.json indoor has); a candle or a cold glow never leads (it is a task or accent light).
const LEADS = ['piece_walltorch', 'piece_dvergr_lantern', 'piece_groundtorch_wood', 'piece_brazierceiling01', 'piece_groundtorch', 'piece_Lavalantern'];
const RUGS_I = ['rug_deer', 'rug_fur', 'rug_wolf', 'jute_carpet', 'rug_hare', 'jute_carpet_blue', 'rug_straw', 'rug_asksvin', 'rug_Bjorn', 'rug_moose'];
const BANNERS_I = ['piece_banner01', 'piece_banner02', 'piece_banner03', 'piece_banner04', 'piece_banner05', 'piece_banner06', 'piece_banner07', 'piece_banner08', 'piece_banner09', 'piece_banner10', 'piece_banner11'];
const BIOME_I = ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains', 'Mistlands', 'Ashlands', 'Deep North'];
const biomeIx = b => Math.max(0, BIOME_I.indexOf(b));

function planBuilding(ctx) {
  const D = data();
  if (!D) return null;
  const P = ctx.persona || { wealth: 0.5, comfort: 0.5, tidy: 0.5, clutter: 0.5, size: 2, hobby: {}, likes: {}, salt: 1 };
  const R = rngI((hashI(`intent|${ctx.type}|${ctx.culture}|${ctx.biome}`) ^ Math.imul((P.salt || 1) >>> 0, 2654435761)) >>> 0);
  for (let i = 0; i < 3; i++) R();
  const wealth = P.wealth != null ? P.wealth : 0.5, comfort = P.comfort != null ? P.comfort : 0.5;
  const fit = id => {
    // formality 1 rustic, 2 fine, 3 grand: the household's wealth leans to its level (a lean; the corpus share leads)
    const fo = (pc(id) || {}).fo || 1, want = 1 + 2 * wealth;
    return Math.exp(-Math.abs(fo - want) * 0.5);
  };
  const flavor = id => { const b = (pc(id) || {}).b; const d = b ? biomeIx(b) - biomeIx(ctx.biome) : 0; return d <= 1 ? 1 : 1 / (1 + 0.8 * (d - 1)); };
  // the suite: a table, the seat builders put at it, a bench for a bigger household where builders bench that table
  // (by the tables builders seat in the corpus, sets.json: piece_table 640, round 358, oak 126, black marble 121, ...)
  const table = pickI(R, SUITE_TABLES.filter(t => D.tables[t] && pc(t)).map(t => [t, D.tables[t].n * fit(t) * flavor(t) * tilt(ctx.culture, 'tables', t)]));
  const ts = D.tables[table] || { seats: {} };
  const seatsAt = Object.entries(ts.seats).filter(([n]) => !/throne/.test(n) && pc(n));
  // (a bench only where builders bench that table: 10 % of its seats or more, bench01 17 % at piece_table, 6 % at the
  // oak table)
  const chairs = seatsAt.filter(([n]) => !/bench/.test(n)), benches = seatsAt.filter(([n, sh]) => /bench/.test(n) && n !== 'piece_logbench01' && sh >= 0.1);
  // how many seats the building needs against how many builders put up of each seat (caps.json p90 per build when
  // used: chair02 3, chair03 8, stool 9.6, bench01 4 benches): a hall seats a dozen on chairs or benches that come
  // in numbers
  const need = { longhouse: 12, tavern: 12, hub: 12, temple: 8 }[ctx.type] || 4;
  const room4 = (n, per) => Math.pow(clamp(((D.caps[n] || [])[2] || (pc(n).p90 || 4)) * per / need, 0.1, 1), 2);
  const seat = pickI(R, chairs.map(([n, s]) => [n, s * tilt(ctx.culture, 'seats', n) * room4(n, 1)])) || 'piece_chair';
  const bench = benches.length ? pickI(R, benches.map(([n, s]) => [n, s * room4(n, 2.5)])) : null;
  // a bigger household sits on the bench where builders bench that table (bench01 17 % of piece_table seats)
  const benchShare = benches.reduce((a, [, s]) => a + s, 0);
  const useBench = !!bench && R() < clamp(benchShare * (0.6 + 0.35 * (P.size || 2)) * (need > 4 ? 2.5 : 1), 0, 0.85);
  const throne = pickI(R, Object.entries(ts.seats).filter(([n]) => /throne/.test(n) && pc(n)).map(([n, s]) => [n, s])) || 'piece_throne01';
  // bed, chest: by the corpus share, near the suite's color, never a family the corpus keeps away from it
  // (a lean by color: beds and chests mostly stand in other zones than the table, so the corpus share leads)
  const near = (id, to, k) => Math.exp(-dE(id, to) / k) * (clashes(id, to) ? 0.15 : 1);
  const bed = pickI(R, BEDS_I.map(n => [n, Math.max(0.02, pc(n).sh) * near(n, table, 30) * (pc(n).f === pc(table).f ? 2 : 1) * tilt(ctx.culture, 'beds', n) * flavor(n) * flavor(n) * (n === 'piece_bed02' ? 0.6 + comfort : 1)]));
  // (chests in the table's tone: corpus luma spread per room p50 0, p75 43; the same family first)
  const chest = pickI(R, CHESTS_I.map(n => [n, ((D.caps[n] || [])[0] || pc(n).sh) * near(n, table, 15) * (pc(n).f === pc(table).f ? 2 : 1) * tilt(ctx.culture, 'chests', n) * flavor(n)]));
  // lights: how many kinds (corpus: one kind in the median build, two or three in the busier half), the lead first
  // (a light the suite's pieces rarely share a room with weighs less: catalog room_pairs rarely_with, track B pairs.json)
  const avoid = n => { const rw = (pc(n).rw || []).filter(([id]) => [table, seat, bed].includes(id)); return rw.length ? Math.max(0.1, Math.min(...rw.map(([, l]) => l))) : 1; };
  const leadW = LEADS.map(n => [n, ((D.caps[n] || [])[0] || pc(n).sh * 0.5) * tilt(ctx.culture, 'lights', n) * flavor(n) * flavor(n) * avoid(n)]);
  const lead = pickI(R, leadW);
  const nKinds = R() < 0.5 ? 1 : R() < 0.7 ? 2 : 3;
  const lights = [lead];
  while (lights.length < nKinds) { const n = pickI(R, leadW.filter(([x]) => !lights.includes(x))); if (!n) break; lights.push(n); }
  // the Mistlands light their rooms with Dvergr and wisp light (corpus mistlands group: wisp torches lead)
  if (ctx.biome === 'Mistlands' && R() < 0.5 && !lights.includes('piece_groundtorch_mist')) lights.push('piece_groundtorch_mist');
  // candles: a task light on tables, altars and bed heads, in one build in twenty in the corpus (caps.json 5.4 %), more
  // with comfort; a temple always has them at the altar
  let candles = ctx.type === 'temple' || R() < 0.054 * (0.5 + 1.5 * comfort) * 2;
  // (not with a light the corpus keeps them apart from: wooden standing torches and candles, lift 0.23)
  if (lights.some(n => (pc(n).rw || []).some(([id, l]) => id === 'Candle_resin' && l < 0.5)) && ctx.type !== 'temple') candles = false;
  // rugs: one or two kinds for the house, hides with comfort, woven ones with wealth
  const rugW = RUGS_I.filter(pc).map(n => [n, Math.max(0.01, pc(n).sh) * (pc(n).f === 'hide' ? 0.6 + comfort : 0.5 + wealth) * flavor(n)]);
  const rug = pickI(R, rugW), rug2 = R() < 0.4 ? pickI(R, rugW.filter(([n]) => n !== rug)) : null;
  const rugsOn = R() < 0.68 * (0.6 + 0.6 * comfort); // corpus: 68 % of furnished buildings have rugs (RUG_RATE all)
  // the household's color: one banner prefab, by its share
  const banner = pickI(R, BANNERS_I.filter(pc).map(n => [n, pc(n).sh]));
  const plan = {
    suite: { table, seat: useBench ? bench : seat, chair: seat, bench, throne, bed, chest },
    lights, lead, candles, rugs: rugsOn ? [rug, rug2].filter(Boolean) : [], banner,
    R, persona: P, culture: ctx.culture, biome: ctx.biome, type: ctx.type,
    used: {}, floor: 0, why: [],
  };
  plan.why.push(`Suite: ${pc(table).n}, seats ${pc(plan.suite.seat).n}, ${pc(bed).n}, ${pc(chest).n}; lead light ${pc(lead).n}${lights.length > 1 ? ' with ' + lights.slice(1).map(n => pc(n).n).join(', ') : ''}.`);
  return plan;
}

// The decorator's kit for a room from the building plan: the same suite in every room (corpus: one tone per room p50,
// one seat prefab per table in 76 to 99 % of sets). The wall light and the floor light are the building's lights.
const WALL_L = /^(piece_walltorch|piece_dvergr_lantern)$/;
function kitFor(plan, base, role) {
  const s = plan.suite, wall = plan.lights.find(n => WALL_L.test(n)) || null, floor = plan.lights.find(n => /groundtorch/.test(n)) || null;
  return { ...base, table: s.table, chair: s.chair, bench: s.bench || null, seat: s.seat, bed: s.bed, chest: s.chest,
    rug: plan.rugs[0] || null, wallLight: wall, floorLight: floor, banner: plan.banner, carving: null, intent: true };
}

// ---------------------------------------------------------------- caps per building
// The count a building may hold of one prefab: the corpus p90 among builds that use it (caps.json indoor, builds of 30
// to 400 m2), or by floor area (per 100 m2 p90) where the building is larger; the catalog's own numbers for pieces
// track B did not count. D-166: a piece hidden from the build menu has no corpus cap, only a use.
function capOf(plan, id) {
  const D = data(), c = D.caps[id], p = pc(id);
  // wall ledges: hidden from the build menu (D-166), so their corpus share is no cap; each needs a use, and the room
  // study counts 2 per house that has any (caps.json shelves p50 2): the shelf sets over a store, a cooking corner or
  // a bench, two per building
  if (id === 'wood_ledge') return 2;
  if (p && p.menu === false) return 8;
  if (c) {
    const byArea = c[3] && plan.floor ? Math.round(c[3] * plan.floor / 100) : 0;
    return Math.max(1, c[1] || 1, Math.min(Math.max(c[2], byArea), c[2] * 2));
  }
  if (p && p.p90) return Math.max(1, p.p50 || 1, p.p90);
  return Infinity;
}
const used = (plan, id) => plan.used[id] || 0;
function canUse(plan, id, n = 1) { return !plan || used(plan, id) + n <= capOf(plan, id); }
function note(plan, id, n = 1) { if (plan) plan.used[id] = used(plan, id) + n; }

// ---------------------------------------------------------------- room kinds
// The room's kind in the corpus's words (ROOM_STUDY section 1), from the decorator's role and the room itself.
function kindOf(room, role, c) {
  if (role === 'sleeping' || role === 'guest') return (room.area >= 60 && role === 'guest') ? 'dormitory' : 'bedroom';
  if (role === 'hall') return c.type === 'longhouse' ? 'feast hall' : 'throne hall';
  if (role === 'tavern') return 'tavern hall';
  if (role === 'temple') return 'shrine';
  if (role === 'guard') return 'bedroom';
  if (role === 'farm') return 'storage';
  return { home: 'home', smithy: 'smithy', workshop: 'workshop', storage: 'storage', kitchen: 'kitchen', lookout: 'other', market: 'other' }[role] || 'other';
}
// A count for the room: the corpus median when present, scaled by the room's size against the kind's median room, up
// to the p90 when present (kinds.json counts [has, p50_when, p90_when]).
function countFor(kind, type, room, scale = 1) {
  const K = data().kinds[kind];
  if (!K || !K.counts[type]) return 0;
  const [, p50, p90] = K.counts[type];
  if (p50 == null) return 0;
  const a = K.area ? K.area[1] : 40;
  const v = p50 * clamp(Math.sqrt(room.area / a), 0.6, 1.8) * scale;
  return Math.round(clamp(v, 1, p90 || p50));
}
const hasShare = (kind, type) => { const K = data().kinds[kind]; return K && K.counts[type] ? K.counts[type][0] || 0 : 0; };

// The intent record (docs/INTERIOR_DESIGN.md "Room intent template").
function intentOf(room, role, c) {
  const kind = kindOf(room, role, c);
  const PURPOSE = {
    home: 'the household\'s daily room: cooking, eating and sitting by the fire', bedroom: 'sleep, and the sleeper\'s things',
    dormitory: 'beds for guests or the household', 'feast hall': 'the household and its guests at the long fire and the high seat',
    'throne hall': 'the hall round the high seat', 'tavern hall': 'the common room round the fire, with the bar', shrine: 'the altar and the seats facing it',
    smithy: 'the forge and its work corner', workshop: 'the workbench and its tools', storage: 'the village\'s stores', kitchen: 'the cooking corner', other: 'a small room kept plain',
  };
  const FOCAL = { home: 'fire', bedroom: 'bed', dormitory: 'bed', 'feast hall': 'high seat', 'throne hall': 'high seat', 'tavern hall': 'fire', shrine: 'altar', smithy: 'forge', workshop: 'workbench', storage: 'store wall', kitchen: 'fire', other: null };
  return { kind, purpose: PURPOSE[kind] || PURPOSE.other, focal: FOCAL[kind] || null, zones: [], placed: {}, story: [] };
}

// ---------------------------------------------------------------- placing
// H: the decorator's placers (lib/decorate.js): F, size, ok, wallSpots, best, mountSpots, putMount, placeFire, onFire,
// planPaths, placeBeds, placeTable, placeRug, placeStorageRow, placeStation, placeLights, placeMounts, placeAgainst,
// placeOnTable, dressTable, cookCorner, kitchenExtras, storeLabels, storeStacks, lightCount, obox, overlap, ptDist,
// yawOfDir, norm, stretch, roomU.
// The narrow parts of a room are passages: a cell whose free run across is under 3 m where the run along is 4 m or
// more (a wing or a hall one or one and a half floor pieces wide) is kept clear of furniture, so nothing stands where
// people walk through (Tyler: passages at least two wood_floor pieces wide; D-148, D-152; the showcase review's
// chests and seats in the wings of 05, 10 and 16). Runs of such cells along a row become one keep-clear box.
function passageZones(room, H) {
  const set = room.set, G = 0.5, out = [];
  const run = (c, di, dj) => { let n = 1; for (const sg of [1, -1]) { let i = c.i + di * sg, j = c.j + dj * sg; while (set.get(i * 65536 + j)) { n++; i += di * sg; j += dj * sg; } } return n * G; };
  const narrow = new Set();
  for (const c of room.cells) {
    const rx = run(c, 1, 0), rz = run(c, 0, 1);
    if (Math.min(rx, rz) < 3 && Math.max(rx, rz) >= 4) narrow.add(c);
  }
  if (!narrow.size || narrow.size > room.cells.length * 0.8) return 0;
  for (const c of narrow) out.push(H.obox(c.x, c.z, G, G, 0));
  for (const b of out) room.zones.push({ b, why: 'passage' });
  return out.length;
}

function furnishRoom(room, role, c, H) {
  const plan = c.intentPlan;
  const I = intentOf(room, role, c);
  room.intent = I;
  if (room.set) I.passage = passageZones(room, H);
  const d = c.decor === 'd1' ? 1 : c.decor === 'd2' ? 2 : 3;
  const k = c.kit;
  const P = plan.persona;
  const R = room.R;
  const fr = () => room.frame();
  const counted = rec => { if (rec && rec.name) note(plan, rec.name); return rec; };
  const zone = (purpose, recs) => { const list = (Array.isArray(recs) ? recs : [recs]).filter(Boolean); if (list.length) I.zones.push({ purpose, pieces: list.map(r => r.name) }); return list; };
  // pieces placed in this room since a mark, counted against the building's caps
  const mark = () => room.placed.length;
  const tally = m => { for (const q of room.placed.slice(m)) note(plan, q.name); };
  const capBed = n => Math.max(0, Math.min(n, c.bedCap - c.counts.bed));
  const beds = (n, row) => { const m = mark(); const r = H.placeBeds(room, k, capBed(n), d, row); c.counts.bed += r.length; tally(m); return r; };
  const lightsN = n => { if (d < 2) return 0; const m = mark(); const got = H.placeLights(room, k, n, { hang: plan.lights.includes('piece_brazierceiling01') ? 0.6 : 0 }); tally(m); return got; };
  const lightN = mult => Math.max(0, Math.round(countFor(I.kind, 'light', room) * mult) - (room.fire ? 1 : 0));
  const tableSet = o => {
    if (!k.table || c.counts.table >= c.tableCap || !canUse(plan, o.table || k.table)) return null;
    const ts = data().tables[o.table || k.table] || { per: [2, 3] };
    const want = o.seats != null ? o.seats : Math.round(clamp(ts.per[0] * (0.7 + 0.25 * (P.size || 2)), 1, ts.per[1]));
    const m = mark();
    const t = H.placeTable(room, k, { ...o, seats: want, exact: true });
    if (t) { c.counts.table++; tally(m); tagSet(plan, room.placed.slice(m), 'table'); }
    return t;
  };
  const rugAt = (near, mode) => {
    if (d < 2 || !plan.rugs.length) return null;
    const rug = plan.rugs[(I.zones.length + (mode === 'beside' ? 1 : 0)) % plan.rugs.length];
    if (!canUse(plan, rug)) return null;
    return counted(H.placeRug(room, { ...k, rug }, near, { mode, rug }));
  };
  const against = (name, score, o) => (H.ok(name, room.biome) && canUse(plan, name) ? counted(H.placeAgainst(room, name, score, o)) : null);
  const isFire = ['home', 'hall', 'tavern', 'kitchen'].includes(role) && !room.upper;
  // the main fire: the stone hearth in halls and taverns (corpus: hearth in 74 % of buildings with a fire; Tyler on
  // the tavern's fire pit), a fire pit with its cooking in a home (the decorator lays a kerb of beams round it,
  // lib/details.js), a hearth in a large home as often as the corpus
  const fireKind = () => {
    if (role === 'tavern' || role === 'hall') return 'hearth';
    if (role === 'home' && room.area >= 60 && R() < 0.74) return 'hearth';
    return 'fire_pit';
  };
  const fire = () => {
    if (!isFire) return null;
    let f = H.placeFire(room, c, fireKind());
    if (!f) f = H.placeFire(room, c, 'fire_pit');
    if (f) { note(plan, f.name); zone('fire', f); }
    return f;
  };

  if (I.kind === 'home') {
    fire();
    if (room.fire && room.fire.name === 'fire_pit') counted(H.onFire(room, d >= 2 && P.hobby && (P.hobby.food || 0) > 0.5 ? 'piece_cauldron' : 'piece_cookingstation', { later: true }));
    // beds where the house has no sleeping floor of its own
    const nb = c.levels > 1 ? (d === 1 ? 1 : 0) : clamp(Math.min(c.bedsWanted, countFor('home', 'bed', room)), 1, 3);
    const bs = beds(nb, 0.4);
    if (bs.length) zone('sleeping', bs);
    H.planPaths(room);
    // the table set: one table, one seat prefab (Tyler 05: "Why ... would this family need one table ... and 5 feet
    // away ... another"); a second table only in a big open room, as a side table (corpus home p90 2)
    // (sure: where the suite's table finds no floor, the smaller tables of the village are tried, lib/decorate.js
    // tableSure; corpus: a table in 74 % of home rooms)
    const t = d >= 2 || !bs.length ? tableSet({ sure: true }) : null;
    if (t) zone('eating', t);
    if (room.potLater) { H.kitchenExtras(room, room.potLater); room.potLater = null; }
    if (d >= 2) { const m = mark(); H.cookCorner(room, role, c); tally(m); }
    // storage: one chest by the beds or at a wall (corpus home chests p50 2)
    const m0 = mark();
    H.placeStorageRow(room, k, d >= 2 ? Math.min(2, countFor('home', 'chest', room)) : 1, { side: k.side });
    tally(m0);
    if (d >= 2) {
      if (t) rugAt(t, 'under');
      if (room.fire) rugAt(room.fire, 'fire');
      for (const bd of bs.slice(0, 1)) rugAt(bd, 'beside');
      bedsides(room, bs, plan, H, d);
      if (d >= 3) headChair(room, plan, H, k);
      supportZones(room, I, plan, H, c, k);
      lightsN(lightN(d >= 3 ? 1 : 0.7));
      if (d >= 3) {
        // the household's habits: brewing by a cluttered or food-loving household, a gear corner by the bed
        wallBay(room, plan, H, I, d);
        vignettes(room, plan, H, I, c, { table: t });
      }
    }
    return I;
  }
  if (I.kind === 'bedroom' || I.kind === 'dormitory') {
    // one bed per sleeper on this floor (D-077); a bedroom has one (p90 two), a dormitory four (p90 seven)
    const per = I.kind === 'dormitory' ? countFor('dormitory', 'bed', room) : Math.max(1, Math.round(room.area / 18));
    const bs = beds(Math.min(per, Math.max(1, c.bedsWanted - c.counts.bed + (role === 'guest' || role === 'guard' ? per : 0))), role === 'guest' ? 1.5 : 0.4);
    zone('sleeping', bs);
    H.planPaths(room);
    // a guard's room where no bed fits is a watch room: a small table with two seats and the guards' gear
    if (!bs.length && role === 'guard' && d >= 2) {
      I.kind = 'watch room'; I.purpose = 'the guards\' table and gear'; I.focal = 'table';
      const t = tableSet({ seats: 2, depth: 0.5, sure: true });
      if (t) zone('table', t);
      const g = ZONE_FN.gear(room, plan, H, k, () => 0);
      if (g) { zone('gear', g); tagSet(plan, g, 'gear'); }
      lightsN(Math.max(1, lightN(0.7)));
      return I;
    }
    if (!bs.length) { const m = mark(); H.placeStorageRow(room, k, 1); tally(m); }
    if (d >= 2) {
      bedsides(room, bs, plan, H, d);
      for (const bd of bs.slice(0, 2)) rugAt(bd, 'beside');
      supportZones(room, I, plan, H, c, k);
      lightsN(lightN(d >= 3 ? 1 : 0.7));
      if (d >= 3) wallBay(room, plan, H, I, d);
    }
    return I;
  }
  if (I.kind === 'feast hall' || I.kind === 'throne hall' || I.kind === 'tavern hall') {
    const tavern = I.kind === 'tavern hall';
    fire();
    if (room.fire && room.fire.name === 'fire_pit') counted(H.onFire(room, 'piece_cookingstation'));
    H.planPaths(room);
    if (tavern) { const m = mark(); H.cookCorner(room, role, c); tally(m); }
    // the high seat at the far end, facing the way in (Hurstwic; great hall dais; corpus throne halls)
    let throne = null;
    if (!tavern && d >= 2 && H.ok(plan.suite.throne, room.biome) && !(I.kind === 'feast hall' && countFor(I.kind, 'table', room) >= 2)) {
      const fr0 = fr();
      throne = counted(H.best(room, plan.suite.throne, H.wallSpots(room, plan.suite.throne), s => fr0.v(s.x, s.z) / fr0.D * 3 - Math.abs(fr0.u(s.x, s.z)) * 0.8 - (s.win ? 2 : 0), { noise: 0.1 }));
      if (throne) { zone('high seat', throne); rugAt(throne, 'front'); }
    }
    // tables: the corpus count for the kind by the room's size (feast hall 3, p90 5; tavern hall 2, p90 5), all of the
    // building's table with its one seat
    const nt = d === 1 ? 1 : countFor(I.kind, 'table', room);
    const tables = [];
    // a feast hall eats at one long table; a tavern at small tables round the room
    const lt = !tavern && d >= 2 && nt >= 2 ? longTable(room, plan, H, k, c, nt) : null;
    if (lt) { tables.push(...lt.run); if (lt.head) { throne = throne || lt.head; zone('high seat', lt.head); } }
    for (let i = tables.length ? nt : 0; i < nt; i++) {
      const t = tableSet({ head: !tavern && d >= 3 && i === 0, headSeat: plan.suite.seat === plan.suite.chair ? plan.suite.chair : plan.suite.throne, depth: tavern ? 0.5 : 0.55, nearFire: tavern ? 0.5 : 0, sideBias: 0.3, wallBias: tavern ? 0.6 : -0.3, spread: tavern ? 4.5 : 6, axis: tavern ? 0.4 : 1.5 });
      if (!t) break;
      tables.push(t);
    }
    zone('tables', tables);
    const m1 = mark();
    H.placeStorageRow(room, k, d >= 2 ? 2 : 1, { sign: d >= 2 });
    tally(m1);
    if (tavern && d >= 2) {
      // the brewing corner (vignette 7): a fermenter with barrels in a row beside it
      const fm = against('fermenter', s => (s.corner ? 1 : 0) + fr().v(s.x, s.z) / fr().D, { kind: 'fermenter' });
      if (fm && H.ok('piece_chest_barrel', room.biome)) { const m = mark(); H.placeStorageRow(room, k, 2, { chest: 'piece_chest_barrel', near: fm }); tally(m); zone('brewing', [fm]); }
    }
    if (d >= 2) {
      supportZones(room, I, plan, H, c, k);
      lightsN(lightN(d >= 3 ? 1 : 0.7));
      if (tables[0] && d >= 3) rugAt(tables[0], 'under');
      wallBay(room, plan, H, I, d);
      if (d >= 3) vignettes(room, plan, H, I, c, { table: tables[0], tables, throne });
    }
    return I;
  }
  if (I.kind === 'shrine') {
    H.planPaths(room);
    const fr0 = fr();
    const altarName = H.F[plan.suite.table] && !(H.F[plan.suite.table] || {}).round ? plan.suite.table : 'piece_table';
    let altar = H.best(room, altarName, H.wallSpots(room, altarName, { gap: 0.3 }), s => fr0.v(s.x, s.z) / fr0.D * 4 - Math.abs(s.t - (s.face.a0 + s.face.a1) / 2) * 1.5 - (s.win ? 1 : 0), { noise: 0.05 });
    if (altar) {
      counted(altar);
      zone('altar', altar);
      // offering at the altar (vignette 15): candles in a group, an offering between them
      H.placeOnTable(room, altar, plan.candles ? ['Candle_resin', 'itemstandh', 'Candle_resin'] : ['itemstandh']);
      if (d >= 2) { const m = mark(); H.placeLights(room, { ...k, wallLight: null }, 2, { flank: [altar] }); tally(m); }
      if (d >= 2) pews(room, altar, plan, H, k);
    }
    if (d >= 2) { lightsN(lightN(0.6)); wallBay(room, plan, H, I, d); }
    return I;
  }
  if (I.kind === 'smithy') {
    H.planPaths(room);
    // the forge with one of each extension builders keep beside it, by their corpus share (sets.json work): never two
    // of one, never in front of the forge (Tyler 13)
    const exts = d === 1 ? [] : workExts('forge', R, d);
    const fg = counted(H.placeStation(room, k, 'forge', exts, { back: 1 }));
    if (fg) { for (const e of exts) note(plan, e); zone('forge', fg); }
    if (d >= 2) {
      const wexts = workExts('piece_workbench', R, Math.min(d, 2));
      const wb = counted(H.placeStation(room, k, 'piece_workbench', wexts, { side: -k.side }));
      if (wb) { for (const e of wexts) note(plan, e); zone('bench', wb); }
    }
    const m = mark();
    H.placeStorageRow(room, k, d >= 2 ? 2 : 1, { sign: d >= 3 });
    tally(m);
    if (d >= 2) {
      supportZones(room, I, plan, H, c, k);
      lightsN(lightN(d >= 3 ? 1 : 0.7));
      if (d >= 3) wallBay(room, plan, H, I, d);
    }
    return I;
  }
  if (I.kind === 'workshop') {
    H.planPaths(room);
    const exts = d === 1 ? [] : workExts('piece_workbench', R, d);
    const wb = counted(H.placeStation(room, k, 'piece_workbench', exts, { back: 1 }));
    if (wb) { for (const e of exts) note(plan, e); zone('bench', wb); }
    const m = mark();
    H.placeStorageRow(room, k, d >= 2 ? 2 : 1, { sign: d >= 3 });
    tally(m);
    if (d >= 2) {
      // one second station by the household's habit, against a wall away from the door (Tyler 15: not the spinning
      // wheel by the door)
      const second = P.hobby && (P.hobby.crafts || 0) > 0.5 ? (R() < 0.5 ? 'piece_spinningwheel' : 'piece_stonecutter') : (R() < 0.4 ? 'piece_artisanstation' : null);
      if (second && H.ok(second, room.biome)) { const st = counted(H.placeStation(room, k, second, [], { side: k.side, back: 1 })); if (st) zone('second station', st); }
      supportZones(room, I, plan, H, c, k);
      lightsN(lightN(d >= 3 ? 1 : 0.7));
      if (d >= 3) wallBay(room, plan, H, I, d);
    }
    return I;
  }
  if (I.kind === 'storage') {
    H.planPaths(room);
    const n = Math.max(1, Math.min(countFor('storage', 'chest', room, 1.2), d === 1 ? 2 : 12));
    const rows = Math.max(1, Math.ceil(n / 4));
    const m = mark();
    for (let r = 0; r < rows && room.count < n; r++) H.placeStorageRow(room, k, Math.min(4, Math.ceil(n - room.count)), { sign: d >= 2 });
    if (d >= 2 && H.ok('piece_chest_barrel', room.biome)) H.placeStorageRow(room, k, d >= 3 ? 2 : 1, { chest: 'piece_chest_barrel' });
    tally(m);
    zone('store walls', room.placed.filter(q => (H.F[q.name] || {}).cat === 'storage'));
    if (d >= 3) { const got = builtZone(room, plan, H, I); if (got) I.zones.push({ purpose: 'built ' + got[0].p.asm, pieces: [got[0].p.asm] }); }
    if (d >= 2) lightsN(Math.max(1, lightN(0.6)));
    return I;
  }
  if (role === 'lookout') {
    if (d >= 2) { const m = mark(); H.placeStorageRow(room, k, 1); tally(m); }
    return I;
  }
  if (I.kind === 'kitchen') {
    fire();
    if (room.fire) counted(H.onFire(room, H.ok('piece_cauldron', room.biome) && R() < 0.6 ? 'piece_cauldron' : 'piece_cookingstation'));
    H.planPaths(room);
    const m = mark();
    H.cookCorner(room, 'home', { ...c, decor: 'd3' });
    H.placeStorageRow(room, k, 1, { chest: H.ok('piece_chest_barrel', room.biome) ? 'piece_chest_barrel' : k.chest });
    tally(m);
    if (d >= 2) lightsN(lightN(0.7));
    return I;
  }
  // market stall, other small rooms: one chest at a wall
  H.planPaths(room);
  const m = mark();
  H.placeStorageRow(room, k, 1);
  if (role === 'market' && d >= 2) { const t = tableSet({ seats: 0, wallBias: 0, depth: 0.3 }); if (t) zone('counter', t); }
  tally(m);
  if (d >= 2) lightsN(1);
  return I;
}

// A long feast table (feast hall): the building's tables end to end down the room's long axis, the suite's seats on
// both sides, the high seat at the head (Hurstwic: benches along the long fire, the high seat in the middle of the
// upper side; great hall: the high table at the far end; corpus feast halls 3 tables p50, 10 seats p50, p90 21).
function longTable(room, plan, H, k, c, n) {
  const t = plan.suite.table;
  if (!H.F[t] || H.F[t].round) return null;
  const [tw, , td] = H.size(t);
  // every line of n tables end to end along the long axis that fits with room for a seat on both sides, scored: away
  // from the door end, off the walking lines (fits keeps them), near the middle of the room across
  const longX = (room.x1 - room.x0) >= (room.z1 - room.z0), yaw = longX ? 0 : 90;
  const a = yaw * PI_I / 180, ax = Math.sin(a), az = Math.cos(a), bx = Math.cos(a), bz = -Math.sin(a);
  const seat = plan.suite.seat, [, , sd] = H.size(seat), dist = td / 2 + sd / 2 + 0.2;
  const fr = room.frame();
  const cx = (room.x0 + room.x1) / 2, cz = (room.z0 + room.z1) / 2, across = longX ? (room.z1 - room.z0) / 2 : (room.x1 - room.x0) / 2;
  let bestL = null;
  for (let m = n; m >= 2 && !bestL; m--) {
    for (const c0 of room.cells) {
      const line = [];
      // (end to end, a few centimeters apart so the placer's overlap test passes them)
      for (let i = 0; i < m; i++) line.push([c0.x + bx * (tw + 0.06) * i, c0.z + bz * (tw + 0.06) * i]);
      if (!line.every(([x, z]) => room.fits(t, x, z, yaw, { tight: true }))) continue;
      // a seat fits on each side of the middle table
      const [mx, mz] = line[Math.floor(m / 2)];
      if (![1, -1].every(sg => room.fits(seat, mx + ax * sg * dist, mz + az * sg * dist, yaw, { tight: true }))) continue;
      const lx = line.reduce((v, p) => v + p[0], 0) / m, lz = line.reduce((v, p) => v + p[1], 0) / m;
      const off = longX ? Math.abs(lz - cz) : Math.abs(lx - cx);
      const v = -off / Math.max(1, across) * 2 + (fr.v(lx, lz) / fr.D) * 0.5 + room.R() * 0.2;
      if (!bestL || v > bestL.v) bestL = { line, v };
    }
  }
  if (typeof process !== 'undefined' && process.env && process.env.VH_DEBUG_LONG) {
    let f1 = 0, f2 = 0; for (const c0 of room.cells) { if (room.fits(t, c0.x, c0.z, yaw, { tight: true })) { f1++; if (room.fits(t, c0.x + bx * tw, c0.z + bz * tw, yaw, { tight: true })) f2++; } }
    console.log('longTable', t, 'n', n, 'cells', room.cells.length, 'one fits', f1, 'two fit', f2, 'paths', room.paths.length, 'best', bestL && bestL.line.length);
  }
  if (!bestL) return null;
  const run = [];
  for (const [x, z] of bestL.line) { const r = room.put(t, x, z, yaw, { tight: true }); if (r) run.push(r); }
  if (!run.length) return null;
  const first = run[0];
  c.counts.table += run.length;
  note(plan, t, run.length);
  // seats: the suite's seat on both long sides, one bench or a chair a meter along each table
  const [sw] = H.size(seat), long = (H.F[seat] || {}).long;
  let ns = 0;
  for (const q of run) for (const sg of [1, -1]) {
    const per = long ? Math.max(1, Math.floor(tw / sw + 0.2)) : Math.max(1, Math.floor(tw / 1.0));
    for (let i = 0; i < per; i++) {
      if (!canUse(plan, seat)) break;
      const off = (i - (per - 1) / 2) * (long ? sw : 1.0);
      const x = q.x + ax * sg * dist + bx * off, z = q.z + az * sg * dist + bz * off;
      if (room.put(seat, x, z, H.norm(H.yawOfDir(-ax * sg, -az * sg)), { tight: true })) { ns++; note(plan, seat); }
    }
  }
  // the head: the high seat at the end away from the main door, else the suite's chair
  const ends = run.map(q => (q.x - first.x) * bx + (q.z - first.z) * bz);
  const lo = Math.min(...ends), hi = Math.max(...ends);
  const e = room.entry;
  const endPt = sg => [first.x + bx * ((sg > 0 ? hi : lo) + sg * (tw / 2 + 0.75)), first.z + bz * ((sg > 0 ? hi : lo) + sg * (tw / 2 + 0.75))];
  const order = [1, -1].sort((p, q) => { const [px, pz] = endPt(p), [qx, qz] = endPt(q); return e ? Math.hypot(qx - e.x, qz - e.z) - Math.hypot(px - e.x, pz - e.z) : 0; });
  let head = null;
  for (const sg of order) {
    const [x, z] = endPt(sg);
    // (the high seat, or the suite's own seat where it is a chair: never a second seat kind at the table)
    for (const name of [plan.suite.throne, plan.suite.seat === plan.suite.chair ? plan.suite.chair : null].filter(Boolean)) {
      if (!H.F[name] || !canUse(plan, name)) continue;
      head = room.put(name, x, z, H.norm(H.yawOfDir(-bx * sg, -bz * sg)), { tight: true });
      if (head) { note(plan, name); break; }
    }
    if (head) break;
  }
  tagSet(plan, room.placed.filter(q => run.includes(q) || (q !== first && !q.rug && !q.mount && (H.F[q.name] || {}).cat === 'seat' && run.some(t2 => Math.hypot(q.x - t2.x, q.z - t2.z) < tw))), 'feast');
  return { run, seats: ns, head };
}

// Supporting zones (docs/INTERIOR_DESIGN.md "Zones and groupings"; WoW: each group its own spot with plain floor
// between): after the core set, the room takes zones the household's traits ask for until it holds the corpus's
// furniture per 10 m2 for its kind (kinds.json furniturePer10m2: the median at d2, the upper quartile at d3, the
// household's clutter between). Each zone is a small set placed whole at a wall, away from the other zones.
const ASM_KINDS_Z = { home: 1, bedroom: 1, dormitory: 1, 'tavern hall': 1, 'feast hall': 1, 'throne hall': 1, smithy: 1, workshop: 1, storage: 1, kitchen: 1, shrine: 1 };
const ZONES = {
  sitting: { kinds: ['home', 'bedroom', 'feast hall', 'throne hall', 'tavern hall'], w: P => 0.6 + (P.comfort || 0) },
  gear: { kinds: ['home', 'bedroom', 'dormitory', 'smithy', 'feast hall'], w: P => 0.5 + 0.5 * (P.hobby.collect || 0) },
  store: { kinds: ['home', 'bedroom', 'dormitory', 'smithy', 'workshop', 'kitchen', 'tavern hall', 'feast hall'], w: P => 0.4 + 0.6 * (P.clutter || 0) },
  brewing: { kinds: ['home', 'tavern hall', 'feast hall', 'kitchen'], w: P => 0.2 + 0.9 * (P.hobby.food || 0) },
  craft: { kinds: ['home', 'workshop'], w: P => 0.1 + 0.9 * (P.hobby.crafts || 0) },
  maps: { kinds: ['home', 'feast hall', 'throne hall', 'bedroom'], w: P => 0.05 + 0.8 * (P.hobby.maps || 0) },
  games: { kinds: ['home', 'tavern hall', 'feast hall'], w: P => 0.05 + 0.6 * (P.hobby.games || 0) },
  // built furniture for the room's program (lib/assemblies.js)
  built: { kinds: Object.keys(ASM_KINDS_Z), w: P => 1.2 + 0.4 * (P.hobby.crafts || 0) },
};
// Furniture built from pieces for the room's program (track G, lib/assemblies.js; criteria/assemblies.md item 7):
// the kinds that suit each room kind, placed against a plain stretch of wall in the suite's family.
const ASM_KINDS = {
  home: ['kitchen-hutch', 'pantry-shelf', 'cabinet', 'drink-shelf', 'herb-shelf', 'shelving', 'chest-shelf'],
  bedroom: ['dresser', 'wardrobe-nook', 'armor-alcove', 'chest-shelf', 'herb-shelf'], dormitory: ['chest-shelf', 'armor-row', 'shelving'],
  'tavern hall': ['bar-counter', 'keg-rack', 'drink-shelf'], 'feast hall': ['weapon-rack', 'armor-row', 'display-shelf', 'keg-rack'],
  'throne hall': ['weapon-rack', 'armor-row', 'display-shelf'], smithy: ['tool-shelf', 'weapon-rack', 'armor-row'],
  workshop: ['tool-shelf', 'drying-rack', 'shelving'], storage: ['labeled-storage', 'shelving', 'chest-shelf'], kitchen: ['kitchen-hutch', 'pantry-shelf', 'prep-counter', 'herb-shelf'],
  shrine: ['display-plinth', 'display-shelf'], 'watch room': ['weapon-rack', 'armor-row'],
};
const ROOM_ASM = { home: 'home', bedroom: 'bedroom', dormitory: 'bedroom', 'tavern hall': 'tavern', 'feast hall': 'hall', 'throne hall': 'hall', smithy: 'smithy', workshop: 'workshop', storage: 'storage', kitchen: 'kitchen', shrine: 'study', 'watch room': 'armory' };
const ASM_SKIP = /^(bed|piece_bed02|ashwood_bed|piece_chair|piece_chair0\d|piece_bench01|piece_table|piece_table_round|piece_table_oak|piece_throne)/;
const DBG_ASM = typeof process !== 'undefined' && process.env && process.env.VH_DEBUG_ASM ? {} : null;
if (DBG_ASM) process.on('exit', () => console.log(JSON.stringify(DBG_ASM)));
const ASM_P = () => { try { return NODE_I ? require('./assemblies.js') : window.VHAssemblies; } catch (e) { return null; } };
function builtZone(room, plan, H, I) {
  const AS = ASM_P();
  if (!AS || !AS.find) return null;
  const kinds = ASM_KINDS[I.kind];
  if (!kinds) return null;
  plan.asm = plan.asm || { used: {}, R: room.R };
  // (narrow ones first: generated walls have a window every bay or two, so a plain stretch is rarely over 3 m)
  const list = AS.find({ kinds, room: ROOM_ASM[I.kind], wall: 'back', maxW: 4.2, maxD: 2, culture: plan.culture }).sort((a, b) => (a.foot.x[1] - a.foot.x[0]) - (b.foot.x[1] - b.foot.x[0]))
    // (no beam overhead out in the room: headroom 2.4 m, lab/test_structure.js)
    .filter(r => !r.pieces.some(p => ASM_SKIP.test(p.n) || (/beam|floor/.test(p.n) && p.y > 1.2 && p.y < 2.6 && (p.z > 0.7 || p.y >= 1.9))) && !plan.asm.used[r.id]);
  if (!list.length) return null;
  const P = (H.PIECES || null);
  const anchors = room.placed.filter(r => !r.rug && !r.mount && !r.onTable);
  for (const r of list.slice(0, 8)) {
    const w = r.foot.x[1] - r.foot.x[0], d = Math.max(0.3, r.foot.z[1] - Math.max(0, r.foot.z[0]));
    // plain wall stretches the recipe's width, away from what stands already
    const spots = [];
    for (const face of room.faces) for (let t = face.a0 + w / 2; t <= face.a1 - w / 2 + 0.01; t += 0.5) {
      const st = H.stretch(face, t - w / 2 - 0.1, t + w / 2 + 0.1);
      // plain wall, or under a window where the piece stays below the sill
      if (st.ks.has('door') || st.ks.has('open') || st.ks.has('none') || (st.ks.has('window') && r.foot.h > st.top - 0.1)) continue;
      const x0 = face.px(t) + face.nx * (face.ht + 0.02), z0 = face.pz(t) + face.nz * (face.ht + 0.02);
      const cx = x0 + face.nx * d / 2, cz = z0 + face.nz * d / 2, yaw = H.yawOfDir(face.nx, face.nz);
      const box = H.obox(cx, cz, w, d, yaw);
      let ok = true;
      for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1]]) { const a = yaw * PI_I / 180, px = cx + u * (w / 2 - 0.1) * Math.cos(a) + v * (d / 2 - 0.1) * Math.sin(a), pz = cz - u * (w / 2 - 0.1) * Math.sin(a) + v * (d / 2 - 0.1) * Math.cos(a); if (!room.inside(px, pz)) ok = false; }
      const dbg = DBG_ASM ? (DBG_ASM[r.id] = DBG_ASM[r.id] || { inside: 0, zone: 0, placed: 0, path: 0, ok: 0 }) : null;
      if (!ok) { if (dbg) dbg.inside++; continue; }
      // (a vent's keep-clear strip runs the whole ridge; against a wall it matters only near the fire)
      const zh = room.zones.find(zn => H.overlap(zn.b, box, 0) && !(zn.why === 'flue' && !(room.fire && Math.hypot(room.fire.x - cx, room.fire.z - cz) < 3)));
      if (zh) { if (dbg) { dbg.zone++; dbg[zh.why] = (dbg[zh.why] || 0) + 1; } continue; }
      if (room.placed.some(q => !q.rug && H.overlap(q.b, box, 0.1))) { if (dbg) dbg.placed++; continue; }
      if (room.paths.some(([px, pz]) => H.ptDist(box, px, pz) < 0.6)) { if (dbg) dbg.path++; continue; }
      if (dbg) dbg.ok++;
      let m = 6; for (const a2 of anchors) m = Math.min(m, Math.hypot(a2.x - cx, a2.z - cz));
      spots.push({ x0, z0, yaw, v: Math.min(m, 4) + room.R() * 0.5 });
    }
    spots.sort((a, b) => b.v - a.v);
    const s = spots[0];
    if (!s) continue;
    const got = AS.place(r, { x: s.x0, y: room.stand, z: s.z0, facing: s.yaw }, { family: plan.suite.table ? (pc(plan.suite.table) || {}).f : null });
    if (!got) continue;
    plan.asm.used[r.id] = 1;
    const recs = [];
    for (const p of got.pieces) {
      const rec = room.add(p.name, p.x, p.y, p.z, p.yaw, {});
      if (!rec) continue;
      if (p.q) rec.p.q = p.q;
      rec.p.x = p.x; rec.p.z = p.z; rec.p.asm = got.id;
      if (p.want) rec.p.want = p.want;
      if (p.info) rec.p.info = p.info;
      if (P && P.piece(p.name).structural) rec.p.trim = true;
      note(plan, p.name);
      recs.push(rec);
    }
    for (const rec of recs) rec.p.kb = `RI-asm-${got.id}-${(plan.sets = (plan.sets || 0) + 1)}`;
    const kb = recs.length ? recs[0].p.kb : null;
    for (const rec of recs) rec.p.kb = kb;
    return recs;
  }
  return null;
}

const floorCount = room => room.placed.filter(q => !q.rug && !q.mount && !q.onTable && !q.stacked && !q.onFire).length;
function supportZones(room, I, plan, H, c, k) {
  const K = data().kinds[I.kind];
  if (!K || !K.per10) return 0;
  const P = plan.persona, d = c.decor === 'd3' ? 3 : 2;
  const q = d === 3 ? K.per10[1] + (K.per10[2] - K.per10[1]) * (0.3 + 0.7 * (P.clutter || 0.5)) : K.per10[0] + (K.per10[1] - K.per10[0]) * (0.5 + 0.5 * (P.clutter || 0.5));
  const target = Math.round(q * room.area / 10);
  const R = room.R;
  const anchors = () => room.placed.filter(r => !r.rug && !r.mount && !r.onTable && (H.F[r.name] || {}).cat !== 'light');
  // a spot away from what stands already (hot spots with plain floor between), into a corner where the zone likes one
  const away = (s, corner) => { let m = 6; for (const r of anchors()) m = Math.min(m, Math.hypot(r.x - s.x, r.z - s.z)); return Math.min(m, 4) * 0.8 + (corner && s.corner ? 1 : 0); };
  const tried = new Set();
  let n = 0;
  // built furniture for the room's program first, where the room kind has one (criteria/assemblies.md item 7)
  if (ASM_KINDS[I.kind] && d === 3) { tried.add('built'); const got = builtZone(room, plan, H, I); if (got && got.length) { I.zones.push({ purpose: 'built ' + got[0].p.asm, pieces: [got[0].p.asm] }); n++; } }
  for (let guard = 0; guard < 6 && floorCount(room) < target; guard++) {
    const cand = Object.entries(ZONES).filter(([z, Z]) => Z.kinds.includes(I.kind) && !tried.has(z)).map(([z, Z]) => [z, Z.w(P)]);
    const z = pickI(R, cand);
    if (!z) break;
    tried.add(z);
    const got = ZONE_FN[z](room, plan, H, k, away);
    if (got && got.length) { I.zones.push({ purpose: z, pieces: got.map(r => r.name) }); tagSet(plan, got, z); n++; }
  }
  return n;
}
const putAgainst = (room, plan, H, name, score, o) => {
  if (!H.F[name] || !canUse(plan, name)) return null;
  const r = H.placeAgainst(room, name, score, o);
  if (r) note(plan, name);
  return r;
};
// beside an anchor on the same wall: the next free stretch either way
function beside(room, plan, H, anchor, name, gap = 0.15) {
  if (!anchor || !anchor.spot || !H.F[name] || !canUse(plan, name)) return null;
  const [w] = H.size(anchor.name), [ew] = H.size(name);
  for (const sg of [1, -1]) for (let g = gap; g < gap + 1.2; g += 0.25) {
    const t = anchor.spot.t + sg * (w / 2 + g + ew / 2);
    const sp = H.wallSpots(room, name, { face: anchor.spot.face }).filter(s => Math.abs(s.t - t) < 0.13);
    for (const s of sp) { const r = room.put(name, s.x, s.z, s.yaw); if (r) { r.spot = s; note(plan, name); return r; } }
  }
  return null;
}
const ZONE_FN = {
  built(room, plan, H, k, away) { return builtZone(room, plan, H, room.intent); },
  // a reading or sitting nook: a chair of the suite turned to the room, a barrel beside it as a side table, a rug
  // before it (vignette 6)
  sitting(room, plan, H, k, away) {
    const chair = /bench/.test(plan.suite.chair) ? 'piece_chair02' : plan.suite.chair;
    const tables = room.placed.filter(q => (H.F[q.name] || {}).cat === 'table');
    const ch = putAgainst(room, plan, H, chair, s => away(s, true) - (tables.some(t => Math.hypot(t.x - s.x, t.z - s.z) < 3.2) ? 4 : 0), { gap: 0.25 });
    if (!ch) return null;
    ch.p.yaw = H.norm(ch.p.yaw + (R0(room) < 0.5 ? -1 : 1) * 20); ch.p.q = quat(ch.p.yaw);
    const side = beside(room, plan, H, ch, 'piece_chest_barrel', 0.1);
    if (side) { const it = onTop(room, side, 'itemstandh', H); if (it) { it.p.want = 'drink'; note(plan, 'itemstandh'); } }
    return [ch, side].filter(Boolean);
  },
  // the sleeper's gear: an armor stand with a chest beside it (vignette 5, mending corner)
  gear(room, plan, H, k, away) {
    const st = putAgainst(room, plan, H, 'ArmorStand', s => away(s, false));
    if (!st) return null;
    const ch = beside(room, plan, H, st, plan.suite.chest, 0.2);
    return [st, ch].filter(Boolean);
  },
  // a store corner at a turn: a chest and a barrel of different heights side by side (vignette 18), never stacked in
  // a living room (Tyler 10: stacked chests in every corner)
  store(room, plan, H, k, away) {
    const ch = putAgainst(room, plan, H, plan.suite.chest, s => away(s, true));
    if (!ch) return null;
    const b2 = beside(room, plan, H, ch, 'piece_chest_barrel', 0.1);
    return [ch, b2].filter(Boolean);
  },
  // brewing (vignette 7): a fermenter with a barrel beside it
  brewing(room, plan, H, k, away) {
    const fm = putAgainst(room, plan, H, 'fermenter', s => away(s, true), { kind: 'fermenter' });
    if (!fm) return null;
    const b2 = beside(room, plan, H, fm, 'piece_chest_barrel', 0.1);
    return [fm, b2].filter(Boolean);
  },
  // the household's handwork: a spinning wheel with a stool, or a workbench with its chopping block
  craft(room, plan, H, k, away) {
    const name = R0(room) < 0.5 && H.F.piece_spinningwheel ? 'piece_spinningwheel' : 'piece_workbench';
    const st = putAgainst(room, plan, H, name, s => away(s, false) - (room.doorDist(s.x, s.z) < 3 ? 3 : 0));
    if (!st) return null;
    const ex = name === 'piece_workbench' ? beside(room, plan, H, st, 'piece_workbench_ext1', 0.3) : null;
    return [st, ex].filter(Boolean);
  },
  // maps: the map table at a wall with a chair pushed back
  maps(room, plan, H, k, away) {
    if (room.area < 30) return null;
    const t = putAgainst(room, plan, H, 'piece_cartographytable', s => away(s, false), { gap: 0.2 });
    return t ? [t] : null;
  },
  // games: a small second table at the side with two seats (a second purpose, never a second dining table)
  games(room, plan, H, k, away) {
    if (room.area < 50 || !H.F.piece_table_round) return null;
    const near = room.placed.filter(q => (H.F[q.name] || {}).cat === 'table');
    if (!canUse(plan, plan.suite.table)) return null;
    const chair = /bench/.test(plan.suite.chair) ? 'piece_chair02' : plan.suite.chair;
    const m = room.placed.length;
    const t = H.placeTable(room, { ...k, table: plan.suite.table, seat: chair }, { table: plan.suite.table, seat: chair, seats: 2, exact: true, wallBias: 1.5, depth: 0.8, spread: 6 });
    if (!t) return null;
    void near;
    const got = room.placed.slice(m);
    for (const q of got) note(plan, q.name);
    return got;
  },
};
const R0 = room => room.R();

// The extensions builders keep at a station, one of each, each by its corpus share (sets.json work): forge cooler 68 %,
// ext5 61 %, ext2 60 %, ext1 58 %, ext4 50 %, ext3 47 %; workbench chopping block 43 %, tool shelf 40 %, tanning rack
// 36 %, adze 22 %. At d2 the two most common, at d3 each by its share.
function workExts(station, R, d) {
  const W = (data().work[station] || {}).near || [];
  const exts = W.filter(x => /_ext\d/.test(x.n) && x.n.startsWith(station === 'forge' ? 'forge_ext' : 'piece_workbench_ext')).sort((a, b) => b.sh - a.sh);
  if (d <= 2) return exts.slice(0, 2).map(x => x.n);
  return exts.filter(x => R() < x.sh * 1.2).map(x => x.n);
}

// Beside each bed (sets.json beds): a stool or a building piece as a nightstand at 23 to 25 % of beds, a light beside
// the head at 20 %, a chest at the foot 15 to 18 % (placeBeds lays it by the household's clutter). The nightstand takes
// the side of the head away from the nearest wall.
function bedsides(room, beds, plan, H, d) {
  if (d < 2) return;
  const B = data().beds;
  for (const bd of beds) {
    const nb = (B[bd.name] || B.bed || { near: {} }).near;
    const ax = Math.sin(bd.yaw * PI_I / 180), az = Math.cos(bd.yaw * PI_I / 180), bx = Math.cos(bd.yaw * PI_I / 180), bz = -Math.sin(bd.yaw * PI_I / 180);
    const [w, , dd] = H.size(bd.name);
    // the head end is local -z (sets.json beds: "head is local -z")
    const headX = bd.x - ax * (dd / 2 - 0.45), headZ = bd.z - az * (dd / 2 - 0.45);
    const roll = H.roomU(room, 'bedside', Math.round(bd.x * 10 + bd.z * 7));
    const stool = plan.suite.chair === 'piece_chair' || plan.suite.chair === 'dvergrprops_stool' ? plan.suite.chair : 'piece_chair';
    const pick = roll < (nb['beside head: seat'] || 0.23) ? stool : roll < (nb['beside head: seat'] || 0.23) + (nb['beside head: chest'] || 0.12) ? 'piece_chest_barrel' : null;
    if (!pick || !canUse(plan, pick)) continue;
    for (const sg of [1, -1]) {
      const off = w / 2 + 0.45;
      const rec = room.put(pick, headX + bx * sg * off, headZ + bz * sg * off, bd.yaw, { tight: true });
      if (rec) {
        note(plan, pick);
        tagSet(plan, [bd, rec], 'bedside');
        // a candle on the nightstand where the household keeps candles (light beside the head, 20 %)
        if (plan.candles && pick === 'piece_chest_barrel' && H.F.Candle_resin && canUse(plan, 'Candle_resin') && onTop(room, rec, 'Candle_resin', H)) note(plan, 'Candle_resin');
        break;
      }
    }
  }
}

// The head's chair by the fire (vignette 3): one chair of the suite facing the fire from 2 m or more, a barrel beside it
// as a side table, with a drink on it (the stand pass dresses the horizontal stand).
function headChair(room, plan, H, k) {
  const f = room.fire;
  if (!f || room.area < 24) return null;
  const chair = plan.suite.chair && !/bench/.test(plan.suite.chair) ? plan.suite.chair : 'piece_chair02';
  if (!H.F[chair] || !canUse(plan, chair)) return null;
  const e = room.entry || { nx: 0, nz: 1 };
  const dirs = [[-e.nz, e.nx], [e.nz, -e.nx], [e.nx, e.nz]];
  for (const [dx, dz] of dirs) for (const dist of [Math.max(f.b.hw, f.b.hd) + 1.6, Math.max(f.b.hw, f.b.hd) + 2.1]) {
    const x = f.x + dx * dist, z = f.z + dz * dist;
    const yaw = H.norm(H.yawOfDir(-dx, -dz) + (H.roomU(room, 'headTurn', 0) - 0.5) * 30);
    const rec = room.put(chair, x, z, yaw, { ignore: ['fire'] });
    if (!rec) continue;
    note(plan, chair);
    rec.p.vignette = 'head-chair';
    // the side barrel with a mug on it
    const bx = Math.cos(yaw * PI_I / 180), bz = -Math.sin(yaw * PI_I / 180);
    for (const sg of [1, -1]) {
      if (!canUse(plan, 'piece_chest_barrel')) break;
      const b2 = room.put('piece_chest_barrel', x + bx * sg * 0.85, z + bz * sg * 0.85, yaw, { tight: true });
      if (b2) { note(plan, 'piece_chest_barrel'); b2.p.vignette = 'head-chair'; tagSet(plan, [rec, b2], 'headchair'); const it = onTop(room, b2, 'itemstandh', H); if (it) { it.p.want = 'drink'; note(plan, 'itemstandh'); } break; }
    }
    return rec;
  }
  return null;
}

// Benches in two rows facing the altar, with an aisle between (the existing temple rule), the suite's bench or seat.
function pews(room, altar, plan, H, k) {
  const seat = plan.suite.bench || (H.F.piece_bench01 ? 'piece_bench01' : plan.suite.seat);
  const yawIn = altar.yaw;
  const ax = Math.sin(yawIn * PI_I / 180), az = Math.cos(yawIn * PI_I / 180), bx = Math.cos(yawIn * PI_I / 180), bz = -Math.sin(yawIn * PI_I / 180);
  const half = H.size(seat)[0] / 2 + 1.1;
  let n = 0;
  for (let row = 0; row < 8; row++) for (const sg of [1, -1]) {
    if (!canUse(plan, seat, 1) && n >= 4) return n;
    const dist = 2.4 + row * 1.3;
    for (const lat of [half, half + 0.25, half - 0.15, half + 0.5]) {
      if (room.put(seat, altar.x + ax * dist + bx * sg * lat, altar.z + az * dist + bz * sg * lat, H.norm(yawIn + 180))) { n++; note(plan, seat); break; }
    }
  }
  return n;
}

// The wall layer, in bays (WoW: walls dressed in bays, one theme per bay): the focal wall gets the household's banner
// pair (banners in pairs at one height, walls.json) where the ceiling is high; item stands in one row of one prefab over
// a chest or a bed (item stands sit in rows, 91 % one prefab); the rest of the walls stay plain.
function wallBay(room, plan, H, I, d) {
  if (d < 3) return;
  const high = (room.ceiling || 0) - room.stand >= 3.4;
  const big = ['feast hall', 'throne hall', 'tavern hall', 'shrine', 'home'].includes(I.kind);
  if (high && big && plan.banner && H.F[plan.banner] && canUse(plan, plan.banner, 2)) {
    const n = H.placeMounts(room, [plan.banner, plan.banner], { share: true });
    note(plan, plan.banner, n);
  }
  // one row of wall item stands over the room's chest or bed, as the corpus hangs them (behind the head of 206 dragon
  // beds; over 8 % of chests)
  const over = room.placed.find(q => !q.mount && ['bed', 'storage'].includes((H.F[q.name] || {}).cat) && !q.stacked);
  if (over && H.F.itemstand && canUse(plan, 'itemstand', 2)) {
    const spots = H.mountSpots(room, 'itemstand', { pairs: true, y: 1.7 }).filter(s => Math.hypot(s.x0 - over.x, s.z0 - over.z) < 2.2)
      .sort((a, b) => Math.hypot(a.x0 - over.x, a.z0 - over.z) - Math.hypot(b.x0 - over.x, b.z0 - over.z));
    let n = 0;
    for (const s of spots) { if (n >= 2) break; if (H.putMount(room, 'itemstand', s)) n++; }
    note(plan, 'itemstand', n);
  }
}

// Mid-task scenes (docs/INTERIOR_DESIGN.md "Vignettes"), whole or not at all, one or two in a home, two to four in a
// hall or tavern: supper left mid-meal (a dressed table, one seat turned out), the high seat's table, drinks at the
// tavern tables. What lies on the stands is the household's (lib/persona.js dressStands).
function vignettes(room, plan, H, I, c, o) {
  const R = room.R, P = plan.persona;
  const n = I.kind === 'home' ? 1 + (R() < 0.4 + 0.4 * (P.clutter || 0) ? 1 : 0) : 2 + Math.floor(R() * 3);
  let done = 0;
  // 1. supper left mid-meal: the main table dressed, one seat pushed back and turned 10 to 30 degrees
  if (o.table && done < n) {
    const t = o.table;
    if (!t.topped) { const got = H.placeOnTable(room, t, plan.candles ? ['itemstandh', 'Candle_resin', 'itemstandh'] : ['itemstandh', 'itemstandh']); if (got) { note(plan, 'itemstandh', 2); if (plan.candles) note(plan, 'Candle_resin'); } }
    t.p.td = true;
    // (a chair pushed back; a bench stays square, corpus bench01 at 0 degrees in 119 of 130 seats)
    const seats = room.placed.filter(q => (H.F[q.name] || {}).cat === 'seat' && !(H.F[q.name] || {}).long && !q.mount && Math.hypot(q.x - t.x, q.z - t.z) < 2.6);
    const s = seats[Math.floor(R() * seats.length)];
    if (s && s.p) { const turn = (R() < 0.5 ? -1 : 1) * (10 + 20 * R()); s.p.yaw = H.norm(s.p.yaw + turn); s.p.q = quat(s.p.yaw); s.p.vignette = 'mid-meal'; }
    I.story.push('supper left mid-meal');
    done++;
  }
  // 2. drinks at the other tables of a hall or tavern
  for (const t of (o.tables || []).slice(1)) {
    if (done >= n) break;
    if (t.topped) continue;
    if (H.placeOnTable(room, t, ['itemstandh'])) { note(plan, 'itemstandh'); t.p.td = true; I.story.push('drinks set out'); done++; }
  }
}
// One small thing on top of a chest, barrel or stool (its top is the piece's own height, lib/decorate.js sizes)
function onTop(room, rec, name, H) {
  if (!rec || !H.F[name]) return null;
  return room.add(name, rec.x, rec.y1, rec.z, rec.yaw, { onTable: rec });
}
// A set's pieces carry one key (p.kb, as the interior library's assemblies do), so the passes that move furniture to
// open the walking lines (lib/layout.js openWays groupOf) move a table with its seats and a bed with its nightstand
// whole, never one seat turned away from its table
function tagSet(plan, recs, what) {
  const list = (recs || []).filter(r => r && r.p);
  if (list.length < 2) return;
  plan.sets = (plan.sets || 0) + 1;
  for (const r of list) if (!r.p.kb) r.p.kb = `RI-${what}-${plan.sets}`;
}
const quat = yaw => { const a = yaw * PI_I / 360; return [0, +Math.sin(a).toFixed(6), 0, +Math.cos(a).toFixed(6)]; };

// ---------------------------------------------------------------- the whole building, last
// After every pass that adds furnishing (the decorator, the interior library's bar and dais, the stand pass), each
// prefab is held to its corpus count for the building (capOf), the light kinds to the plan's, and pieces that belong
// outdoors or on roofs leave the rooms (catalog zone: covered share under 0.3; D-164 wood_fence never indoors).
// What goes: the last placed first, never an essential (beds, the main chest, the fire, the stations).
const KEEP_I = /^(bed|piece_bed02|ashwood_bed|hearth|fire_pit|forge|piece_workbench|piece_cookingstation|piece_cookingstation_iron|piece_cauldron|smelter|portal_wood|fermenter)$/;
function capBuilding(b, plan, o = {}) {
  if (!plan) return 0;
  const decor = b.pieces.filter(p => p.decor && !p.outside && !p.yard && !p.hub);
  const counts = {};
  const gone = new Set();
  // the floor area for the per-area caps
  plan.floor = o.floor || plan.floor || 0;
  for (const p of decor) {
    counts[p.name] = (counts[p.name] || 0) + 1;
    if (KEEP_I.test(p.name)) continue;
    if (counts[p.name] > capOf(plan, p.name)) gone.add(p);
  }
  // lights of a kind the building does not use (the interior library's and the stand pass's), when the building has
  // its own lights to stand for them
  const lit = new Set(plan.lights.concat(plan.candles ? ['Candle_resin'] : []));
  const LIGHT = /torch|lantern|brazier|Candle/;
  const own = decor.filter(p => LIGHT.test(p.name) && lit.has(p.name)).length;
  if (own) for (const p of decor) if (LIGHT.test(p.name) && !lit.has(p.name) && !p.hearth) gone.add(p);
  if (!gone.size) return 0;
  // anything that stood on what goes, goes with it
  const on = p => decor.filter(q => q !== p && Math.abs(q.x - p.x) < 0.7 && Math.abs(q.z - p.z) < 0.7 && q.y > p.y + 0.2 && q.y < p.y + 1.6);
  for (const p of [...gone]) for (const q of on(p)) gone.add(q);
  b.pieces = b.pieces.filter(p => !gone.has(p));
  (b.notes || (b.notes = [])).push(`${gone.size} pieces over the building's corpus counts or outside its light kinds left out (lib/rooms_intent.js capBuilding).`);
  return gone.size;
}

const apiI = { data, planBuilding, kitFor, furnishRoom, capBuilding, capOf, canUse, note, intentOf, kindOf, countFor, dE, clashes, coldGlow, workExts };
if (NODE_I) module.exports = apiI; else window.VHIntent = apiI;
