// What goes on item stands, shelves, tables and armor stands, with meaning (track G, showcase review 2026-11-12;
// docs/FURNITURE_ASSEMBLIES.md "Stand items"). Tyler, 2026-11-12: items on stands were "both random and meaningless (a
// carrot and a fire pot and then another stand with three candles below it) and ... repeative ... 800 lox pies ... on
// every single damn shelf ... The same raspberry + poison pot 5x in the same house. Literally 3 of the yellow dripping
// axes next to each other ... an axe sticking straight up on its head. A saddle halfway off a table." and "there is
// nothing currently hanging on any of the armorstands."
//
// What it does, from the corpus (data/stand-items/corpus.json, lab/mine_stand_items.js) and the rules
// (data/stand-items/rules.json):
//   - a building keeps one ledger (ledger()): the household's themes, what is already on show and where;
//   - each stand asks pick() for one item: the kind fits the place (table, shelf, counter, wall over a forge ...), the
//     room and the household; one surface holds one theme; one item comes again only as far as the corpus repeats it
//     (weapons, shields and trophies once in a home, drink and food in short rows); a long weapon or tool on a flat
//     stand lies on its side; nothing hangs over the edge of what it stands on;
//   - each armor stand asks armor() for an outfit as the mod reads it ("Prefab:variant", comma separated);
//   - check() audits a design's stands for the council (hard fails and counts).
// Works in node (data read from data/stand-items/) and in the browser or game bundle (window.VHStandItemsData =
// { items, rules, corpus } set before this script).

const NODE_SI = typeof module !== 'undefined' && typeof require === 'function';
let D_SI;
function data() {
  if (D_SI) return D_SI;
  if (typeof window !== 'undefined' && window.VHStandItemsData) D_SI = window.VHStandItemsData;
  else if (NODE_SI) {
    const path = require('path'), dir = path.join(__dirname, '../data/stand-items');
    D_SI = { items: require(path.join(dir, 'items.json')).items, rules: require(path.join(dir, 'rules.json')), corpus: require(path.join(dir, 'corpus.json')) };
  }
  return D_SI;
}
function setData(d) { D_SI = d; }

function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function hashStr(t) { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function pickW(R, w) { let t = 0; for (const k in w) t += Math.max(0, w[k]); if (t <= 0) return null; let r = R() * t; for (const k in w) { r -= Math.max(0, w[k]); if (r <= 0) return k; } return Object.keys(w).pop(); }

const BIOMES = ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains', 'Mistlands', 'Ashlands', 'Deep North'];
const tierOf = b => Math.max(0, typeof b === 'number' ? b : BIOMES.indexOf(b || 'Meadows'));
const SHOW = new Set(['trophy', 'boss', 'shield', 'sword', 'axe', 'axe-tool', 'blunt', 'polearm', 'bow', 'staff', 'tool', 'farm', 'curio', 'hat', 'helmet', 'valuable', 'knife']);
const FLAT_ONLY = new Set(['tankard', 'mead', 'food', 'produce', 'herbs', 'hat', 'feast']);

/** The household's themes from lib/persona.js hobby weights (P.hobby: crafts, collect, plants, food, games, maps). */
function themesFrom(P) {
  const R_ = data().rules.personaThemes, out = {};
  const H = (P && P.hobby) || { food: 0.5, collect: 0.3, crafts: 0.3, plants: 0.3, games: 0.2, maps: 0.1 };
  for (const [h, v] of Object.entries(H)) for (const [t, w] of Object.entries(R_[h] || {})) out[t] = (out[t] || 0) + v * w;
  // keep the two or three strongest: one story per house (docs/INTERIOR_DESIGN.md "Environmental storytelling")
  const top = Object.entries(out).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return Object.fromEntries(top.map(([k, v]) => [k, +v.toFixed(2)]));
}

/**
 * One ledger per building. o: { biome, stage (village stage 1 to 5), tier (overrides biome), kind ('home', 'tavern',
 * 'hall', 'smithy', 'workshop', 'storage', 'temple', 'hub', ...), floorM2, themes ({hunter: 1, cook: 0.6}) or persona
 * (lib/persona.js P), seed }.
 */
function ledger(o) {
  o = o || {};
  const large = /hall|tavern|hub|longhouse|temple|storage/.test(o.kind || '') || (o.floorM2 || 0) > 140;
  return {
    tier: o.tier != null ? o.tier : tierOf(o.biome), stage: o.stage || 3, kind: o.kind || 'home', large,
    themes: o.themes || themesFrom(o.persona), R: rng(o.seed != null ? o.seed : hashStr(JSON.stringify([o.biome, o.kind, o.floorM2]))),
    count: {}, placed: [], armor: [],
  };
}

// a quaternion for a yaw (lab convention, lib/kitbash.js quatB) times a turn about the stand's own x axis
function quat(yaw, tiltX) {
  const a = yaw * Math.PI / 360, b = (tiltX || 0) * Math.PI / 360;
  const qy = [0, Math.sin(a), 0, Math.cos(a)], qx = [Math.sin(b), 0, 0, Math.cos(b)];
  const [x1, y1, z1, w1] = qy, [x2, y2, z2, w2] = qx;
  return [w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2, w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2, w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2, w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2].map(v => +v.toFixed(6));
}

/**
 * How an item rests on a stand. stand 'itemstandh' (flat) or 'itemstand' (wall); yaw of the stand; top: the height of
 * what a flat stand stands on. Returns { tilt: 0 or -90 (turn about the stand's x axis), q, y (the stand's pivot), box:
 * the item's reach in the stand's turned frame { x: [a, b], z: [a, b] }, h: its top over the surface } or null when the
 * item has no measured model. A flat stand's long weapon or tool is turned on its side so it lies on the surface
 * (rules.pose); everything else stands as the game shows it.
 */
function pose(item, stand, yaw, top) {
  const D = data(), it = D.items[item];
  yaw = yaw || 0;
  if (stand !== 'itemstandh' || !it || !it.flat) return { tilt: 0, q: quat(yaw, 0), y: top, box: null, h: null };
  const f = it.flat, low = f.low != null ? f.low : 0;
  const lie = it.tall && D.rules.pose.tallKinds.includes(it.kind);
  if (!lie) return { tilt: 0, q: quat(yaw, 0), y: top - Math.min(0, low), box: { x: f.x, z: f.z }, h: f.top - Math.min(0, low) };
  // turned +90 about x (the corpus's usual turn, local z pointing down: 475 of 715 turned weapon stands): y' = -z,
  // z' = y, the item lies along the stand's +z; turned -90: y' = z, z' = -y. The turn that lifts the stand least wins.
  const up = f.z[1], down = -f.z[0];
  if (up <= down + 0.1) return { tilt: 90, q: quat(yaw, 90), y: +(top + up).toFixed(3), box: { x: f.x, z: [low, f.top] }, h: +(f.z[1] - f.z[0]).toFixed(2), side: true };
  return { tilt: -90, q: quat(yaw, -90), y: +(top + down).toFixed(3), box: { x: f.x, z: [-f.top, -low] }, h: +(f.z[1] - f.z[0]).toFixed(2), side: true };
}

/** How far (m) an item on a stand at (x, z) turned yaw reaches past a top box {x0, x1, z0, z1}; 0 when it fits. */
function overhang(box, x, z, yaw, top) {
  if (!box || !top) return 0;
  const a = yaw * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  let o = 0;
  for (const bx of box.x) for (const bz of box.z) {
    // local x -> (cos a, -sin a), local z -> (sin a, cos a) (lib/pieces.js)
    const wx = x + bx * c + bz * s, wz = z - bx * s + bz * c;
    o = Math.max(o, top.x0 - wx, wx - top.x1, top.z0 - wz, wz - top.z1);
  }
  return Math.max(0, +o.toFixed(3));
}

// the kind weights for a place: the corpus counts of kinds held there (corpus.placeKind)
function placeWeights(stand, place, near) {
  const C = data().corpus.placeKind;
  let key = stand === 'itemstand' ? 'wall:' + (near || 'none') : place || 'other';
  if (stand === 'itemstandh' && /^(shelf|ledge|mantel|sill|rafter)$/.test(key)) key = 'shelf';
  if (stand === 'itemstandh' && key === 'floor') key = 'floor-or-shelf';
  if (stand === 'itemstandh' && /^(bench|seat)$/.test(key)) key = 'seat';
  if (stand === 'itemstandh' && key === 'workbench') key = 'station';
  const w = C[key] || C[stand === 'itemstand' ? 'wall:none' : 'other'];
  const t = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v / t]));
}

function groupOfKind(kind) {
  const G = data().rules.groups;
  for (const g of ['meal', 'drink', 'pantry', 'apothecary', 'arms', 'work', 'trophies', 'curios']) if (G[g].includes(kind)) return g;
  return null;
}

/**
 * The item for one stand. q: { stand: 'itemstandh' | 'itemstand', place ('table', 'shelf', 'counter', 'chest',
 * 'mantel', 'sill', 'bench', 'stand', 'floor', 'rafter', 'workbench' for a flat stand; ignored for a wall stand), near
 * (the use piece nearest within 3 m: 'kitchen', 'brew', 'smith', 'craft', 'magic', 'sleep', 'throne', 'dine', 'hearth',
 * 'armor', or none), room ('kitchen', 'dining', 'hearth', 'bedroom', 'smithy', 'workshop', 'brewery', 'study',
 * 'armory', 'hall', 'tavern', 'storage', 'temple', 'entry', 'home'), x, y, z, yaw, top ({x0, x1, z0, z1, y}: the top a
 * flat stand stands on), want (a kind or a theme a set asks for), row (true when the set lays a row of one thing) }.
 * Returns { item, text ('Item:0:1'), kind, group, yaw, q, y, tilt, why } or null (leave the stand out).
 */
function pick(L, q) {
  const D = data(), RU = D.rules;
  const stand = q.stand === 'itemstand' ? 'itemstand' : 'itemstandh';
  const R = L.R;
  // the group this stand joins: stands already placed within 0.9 m and 0.4 m of height
  const mates = L.placed.filter(p => Math.hypot(p.x - (q.x || 0), p.z - (q.z || 0)) < 0.9 && Math.abs(p.y - (q.y || 0)) < 0.4 && p.stand === stand);
  const group = mates.length ? mates[0].group : null;
  let kw = placeWeights(stand, q.place, q.near);
  const room = RU.rooms[q.room] || null;
  const themes = L.themes || {};
  const w = {};
  for (const [k, v] of Object.entries(kw)) {
    if (k === 'other' || k === 'empty' || k === 'armor' || k === 'feast') continue;
    if (stand === 'itemstand' && FLAT_ONLY.has(k)) continue;
    let x = v;
    if (room) { if (!room[k]) continue; x *= room[k]; }
    let tw = 0.25;
    for (const [t, tv] of Object.entries(themes)) tw += tv * ((RU.themes[t] && RU.themes[t].kinds[k]) || 0);
    x *= tw;
    if (group && !RU.groups[group].includes(k)) continue;
    if (q.want) { if (q.want === k) x *= 6; else if (RU.kindGroups[q.want] && RU.kindGroups[q.want].includes(k)) x *= 3; else if (RU.themes[q.want] && RU.themes[q.want].kinds[k]) x *= 3; else x *= 0.15; }
    // a big trophy goes only at the hub's or the hall's central place (D-134 in lib/persona.js)
    if (k === 'boss' && !(L.large && (q.room === 'hall' || q.room === 'hearth' || q.room === 'temple'))) continue;
    if (x > 0) w[k] = x;
  }
  for (let tries = 0; tries < 6; tries++) {
    const k = pickW(R, w);
    if (!k) return null;
    const got = itemOf(L, k, stand, q, group);
    if (got) return got;
    delete w[k];
  }
  return null;
}

function itemOf(L, kind, stand, q, group) {
  const D = data(), RU = D.rules, caps = L.large ? RU.caps.perItemLarge : RU.caps.perItem;
  const cap = caps[kind] != null ? caps[kind] : 1;
  const prefer = new Set();
  for (const t of Object.keys(L.themes || {})) for (const n of (RU.themes[t] && RU.themes[t].prefer) || []) prefer.add(n);
  const w = {};
  for (const [n, it] of Object.entries(D.items)) {
    if (it.kind !== kind) continue;
    if (it.fits && !(stand === 'itemstand' ? it.fits.wall : it.fits.flat)) continue;
    if (!it.fits && !it.corpus) continue;
    // the village has it: its own tier and those before weigh most; one tier on is a rare trade good; later never
    const tr = it.tier == null ? L.tier : it.tier;
    if (tr > L.tier + 1) continue;
    let x = (it.corpus ? Math.log(1 + it.corpus.builds) + 0.5 : 0.4) * (tr === L.tier ? 1 : tr < L.tier ? 0.7 : 0.12);
    if (prefer.has(n)) x *= 3;
    const used = L.count[n] || 0;
    if (used >= cap) continue;
    // repeats: a row of one drink or food is how builders show it (q.row or a run already started next to it); a show
    // item repeats only spread over the room, never side by side
    const near = L.placed.filter(p => p.item === n && Math.hypot(p.x - (q.x || 0), p.z - (q.z || 0)) < 0.6 && Math.abs(p.y - (q.y || 0)) < 0.6);
    const run = RU.caps.run[kind] || 1;
    if (near.length) { if (SHOW.has(kind) || near.length + 1 > run) continue; x *= q.row ? 8 : 2.5; }
    else if (used) {
      if (SHOW.has(kind) && L.placed.some(p => p.item === n && Math.hypot(p.x - (q.x || 0), p.z - (q.z || 0)) < RU.caps.spread)) continue;
      x *= SHOW.has(kind) ? 0.2 : 0.9;
    }
    w[n] = x;
  }
  // try items until one rests right (pose and edge)
  for (let tries = 0; tries < 8; tries++) {
    const n = pickW(L.R, w);
    if (!n) return null;
    let yaw = q.yaw || 0, ps = pose(n, stand, yaw, q.top ? q.top.y : q.y), ok = true;
    if (stand === 'itemstandh' && q.top && ps.box) {
      ok = false;
      for (const dy of [0, 90, 180, 270]) {
        const p2 = pose(n, stand, yaw + dy, q.top.y);
        if (overhang(p2.box, q.x, q.z, yaw + dy, q.top) <= RU.pose.overhang) { ps = p2; yaw = yaw + dy; ok = true; break; }
      }
    }
    // a tall weapon or tool on a flat stand on the floor would lie on the floor: leave it for a wall stand
    if (ok && ps.side && q.place === 'floor') ok = false;
    if (!ok) { delete w[n]; continue; }
    const it = D.items[n];
    const g = group || groupOfKind(kind);
    L.count[n] = (L.count[n] || 0) + 1;
    L.placed.push({ item: n, kind, group: g, stand, x: q.x || 0, y: q.y || 0, z: q.z || 0 });
    return { item: n, text: `${n}:0:1`, kind, group: g, yaw: ((yaw % 360) + 360) % 360, q: ps.q, y: ps.y, tilt: ps.tilt, why: `${kind} at ${stand === 'itemstand' ? 'wall:' + (q.near || 'none') : q.place || 'other'}${q.room ? ' in ' + q.room : ''}${it && it.tier != null ? ', tier ' + it.tier : ''}` };
  }
  return null;
}

/**
 * An armor stand's outfit. q: { room ('entry', 'bedroom', 'hall', 'armory', 'smithy', 'workshop', 'home'), look
 * ('warrior', 'hunter', 'lore', 'worker'; from the household themes when left out), tier (overrides the ledger's) }.
 * Returns { text: 'ArmorBronzeChest:0,ArmorBronzeLegs:0,HelmetBronze:0,CapeDeerHide:0', items, pattern, set }. Every
 * stand gets something (Tyler, 2026-11-12). The same outfit comes again in a building only after every other choice
 * (corpus: median 1 per build).
 */
function armor(L, q) {
  q = q || {};
  const A = data().rules.armor, R = L.R;
  const tier = Math.min(6, q.tier != null ? q.tier : Math.max(0, L.tier - (L.stage <= 1 ? 1 : 0)));
  const th = L.themes || {};
  const look = q.look || pickW(R, { warrior: 0.4 + (th.warrior || 0) + 0.3 * (th.smith || 0), hunter: 0.3 + (th.hunter || 0) + 0.3 * (th.fisher || 0), lore: 0.05 + (th.lore || 0) * (tier >= 5 ? 1 : 0.2) + 0.3 * (th.healer || 0) * (tier >= 5 ? 1 : 0), worker: 0.25 + (th.farmer || 0) + (th.woodworker || 0) + 0.5 * (th.cook || 0) });
  const pats = (A.rooms[q.room] || A.rooms.home).filter(Boolean);
  const pw = {};
  for (const p of pats) pw[p] = (A.patterns[p] || 5) * (look === 'worker' && /S|W/.test(p) ? 0.3 : 1) * (look === 'warrior' && /S/.test(p) ? 1.5 : 1);
  for (let tries = 0; tries < 12; tries++) {
    const pat = pickW(R, pw);
    // sets the village has: its tier and the one before, the look's sets first
    const sw = {};
    for (const [k, s] of Object.entries(A.sets)) {
      if (s.tier > tier || s.tier < tier - 2) continue;
      sw[k] = (s.corpus || 10) * (s.look === look ? 3 : 1) * (s.tier === tier ? 1.5 : 1);
    }
    const sk = pickW(R, sw) || 'leather', S = A.sets[sk];
    const items = [];
    const cape = () => { const list = A.capes[String(Math.min(6, Math.max(S.tier, tier - 1)))] || A.capes['0']; return S.c && R() < 0.6 ? S.c : list[Math.floor(R() * list.length)]; };
    for (const ch of pat) {
      if (ch === 'C') items.push(sk === 'tunic' ? A.tunics[Math.floor(R() * A.tunics.length)] : S.C);
      else if (ch === 'L' && S.L) items.push(S.L);
      else if (ch === 'L' && !S.L) items.push((A.sets[tier >= 3 ? 'wolf' : 'leather']).L);
      else if (ch === 'H') items.push(pat === 'H' && R() < 0.5 ? (tier >= 5 ? 'HelmetDverger' : A.hats['0'][Math.floor(R() * A.hats['0'].length)]) : (S.H || 'HelmetLeather'));
      else if (ch === 'c') items.push(cape());
      else if (ch === 'S') { const l = A.leftHand[String(Math.min(6, tier))] || A.leftHand['0']; items.push(l[Math.floor(R() * l.length)]); }
      else if (ch === 'W') { const byLook = A.rightHand[look] || A.rightHand.warrior; let t = Math.min(6, tier); while (t > 0 && !byLook[String(t)]) t--; const l = byLook[String(t)] || A.rightHand.warrior['0']; items.push(l[Math.floor(R() * l.length)]); }
    }
    if (!items.length) continue;
    const key = [...items].sort().join(',');
    // the same outfit again only when nothing new came up in 12 tries
    if (L.armor.includes(key) && tries < 11) continue;
    L.armor.push(key);
    return { text: items.map(n => `${n}:0`).join(','), items, pattern: pat, set: sk, look };
  }
  return null;
}

// ---------------------------------------------------------------- audit (council criteria, docs/handoffs/2026-11-12-showcase-review/criteria/assemblies.md)
/**
 * Audits the stands of a design. pieces: [{ name, x, y, z, yaw | q, info | item }]. o: { floorM2, kind, roomOf(p) ->
 * room kind, gearRooms: room kinds where an armor stand must be dressed (default all) }. Returns { fails: [{ code, msg,
 * at }], counts }. Codes (hard fails): repeat (one item over its cap), run (the same show item side by side, or a
 * drink or food row over its run), mixed (a surface mixing themes), head (a long weapon or tool upright on a flat
 * stand), edge (an item over the edge of its top), empty-armor (an armor stand with nothing on it).
 */
function check(pieces, o) {
  o = o || {};
  const D = data(), RU = D.rules;
  const large = /hall|tavern|hub|longhouse|temple|storage/.test(o.kind || '') || (o.floorM2 || 0) > 140;
  const caps = large ? RU.caps.perItemLarge : RU.caps.perItem;
  const fails = [], counts = { stands: 0, dressed: 0, items: {}, armor: 0, armorDressed: 0, outfits: {} };
  const itemOfP = p => { const t = p.item ? (typeof p.item === 'string' ? p.item : p.item.name) : String(p.info || '').replace(/^"|"$/g, '').split(':')[0]; return t || null; };
  const upOf = p => { const qq = p.q; if (!qq) return 1; const [x, , z] = qq; return 1 - 2 * (x * x + z * z); };
  const st = [];
  for (const p of pieces) {
    if (p.name === 'ArmorStand') {
      counts.armor++;
      const t = String(p.info || '').replace(/^"|"$/g, '');
      if (!t || !/[A-Za-z]/.test(t)) fails.push({ code: 'empty-armor', msg: 'armor stand with nothing on it', at: [p.x, p.y, p.z] });
      else { counts.armorDressed++; counts.outfits[t] = (counts.outfits[t] || 0) + 1; }
      continue;
    }
    if (!/^itemstandh?$/.test(p.name)) continue;
    counts.stands++;
    const n = itemOfP(p);
    if (!n) continue;
    counts.dressed++;
    counts.items[n] = (counts.items[n] || 0) + 1;
    const it = D.items[n] || { kind: 'other' };
    st.push({ p, n, it });
    if (p.name === 'itemstandh' && it.tall && RU.pose.tallKinds.includes(it.kind) && upOf(p) > 0.9) fails.push({ code: 'head', msg: `${n} upright on a flat stand (stands on its head or end)`, at: [p.x, p.y, p.z] });
  }
  for (const [n, c] of Object.entries(counts.items)) {
    const k = (D.items[n] || { kind: 'other' }).kind, cap = caps[k] != null ? caps[k] : 1;
    if (c > cap) fails.push({ code: 'repeat', msg: `${n} ${c} times (cap ${cap} for ${k} in a ${large ? 'large building' : 'home'})` });
  }
  // runs and mixed surfaces
  for (let i = 0; i < st.length; i++) {
    const A = st[i];
    const same = st.filter((B, j) => j !== i && B.n === A.n && Math.hypot(B.p.x - A.p.x, B.p.z - A.p.z) < 0.6 && Math.abs(B.p.y - A.p.y) < 0.6);
    if (same.length && SHOW.has(A.it.kind) && same.some(B => st.indexOf(B) > i)) fails.push({ code: 'run', msg: `${A.n} side by side with the same item`, at: [A.p.x, A.p.y, A.p.z] });
    const mates = st.filter((B, j) => j > i && B.p.name === A.p.name && Math.hypot(B.p.x - A.p.x, B.p.z - A.p.z) < 0.9 && Math.abs(B.p.y - A.p.y) < 0.4);
    for (const B of mates) {
      const ga = Object.keys(RU.groups).filter(g => g[0] !== '_' && RU.groups[g].includes(A.it.kind)), gb = Object.keys(RU.groups).filter(g => g[0] !== '_' && RU.groups[g].includes(B.it.kind));
      if (!ga.some(g => gb.includes(g))) fails.push({ code: 'mixed', msg: `${A.n} (${A.it.kind}) and ${B.n} (${B.it.kind}) on one surface share no theme`, at: [A.p.x, A.p.y, A.p.z] });
    }
  }
  // rows of one drink or food over their run
  const seen = new Set();
  for (const A of st) {
    if (seen.has(A) || SHOW.has(A.it.kind)) continue;
    const row = [A]; seen.add(A);
    for (let k = 0; k < row.length; k++) for (const B of st) if (!seen.has(B) && B.n === A.n && Math.hypot(B.p.x - row[k].p.x, B.p.z - row[k].p.z) < 0.6 && Math.abs(B.p.y - row[k].p.y) < 0.6) { seen.add(B); row.push(B); }
    const run = RU.caps.run[A.it.kind] || 1;
    if (row.length > run) fails.push({ code: 'run', msg: `${row.length} ${A.n} in one row (run ${run})`, at: [A.p.x, A.p.y, A.p.z] });
  }
  // edges, when the caller gives the top each flat stand stands on (o.topOf(p) -> {x0, x1, z0, z1, y})
  if (o.topOf) for (const A of st) {
    if (A.p.name !== 'itemstandh') continue;
    const top = o.topOf(A.p);
    if (!top) continue;
    const yaw = A.p.yaw != null ? A.p.yaw : (A.p.q ? Math.atan2(2 * (A.p.q[3] * A.p.q[1] + A.p.q[0] * A.p.q[2]), 1 - 2 * (A.p.q[1] ** 2 + A.p.q[0] ** 2)) * 180 / Math.PI : 0);
    const side = upOf(A.p) < 0.3;
    const ps = side ? pose(A.n, 'itemstandh', yaw, top.y) : { box: A.it.flat ? { x: A.it.flat.x, z: A.it.flat.z } : null };
    const oh = overhang(ps.box, A.p.x, A.p.z, yaw, top);
    if (oh > RU.pose.overhang) fails.push({ code: 'edge', msg: `${A.n} reaches ${oh} m past the edge of what it stands on`, at: [A.p.x, A.p.y, A.p.z] });
  }
  const distinct = Object.keys(counts.items).length;
  counts.distinctShare = counts.dressed ? +(distinct / counts.dressed).toFixed(2) : null;
  return { fails, counts };
}

const apiSI = { data, setData, ledger, themesFrom, pick, armor, pose, overhang, check, quat, BIOMES };
if (typeof module !== 'undefined') module.exports = apiSI;
else window.VHStandItems = apiSI;
