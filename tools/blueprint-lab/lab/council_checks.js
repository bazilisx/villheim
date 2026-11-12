// The catalog (track A) and outside-study (track C) council checks that can be measured from a blueprint
// (docs/handoffs/2026-11-12-showcase-review/criteria/catalog.md and outside-study.md). Items judged by eye on the
// renders are listed as such and left out of the measured points; the pass mark is the criteria file's share of the
// measured weight. Track B's own list runs in lab/rooms_corpus_audit.js.
//   node lab/council_checks.js <design.blueprint> [--json out.json] [--intent intent.json] [--type tower]
const fs = require('fs'), path = require('path');
const lab = path.join(__dirname, '..');
const BP = require(lab + '/lib/blueprint.js'), P = require(lab + '/lib/pieces.js'), D = require(lab + '/lib/decorate.js');
const C = require(lab + '/lib/catalog.js'), RI = require(lab + '/lib/rooms_intent.js');
const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const file = args.find(a => a.endsWith('.blueprint'));
if (!file) { console.error('usage: node lab/council_checks.js <design.blueprint> [--json out.json] [--intent intent.json] [--type t]'); process.exit(1); }
const intent = opt('--intent') && fs.existsSync(opt('--intent')) ? JSON.parse(fs.readFileSync(opt('--intent'), 'utf8')) : null;
const type = opt('--type') || (intent && intent.request && intent.request.type) || '';
const pieces = BP.parse(fs.readFileSync(file, 'utf8')).pieces;
const yq = p => { const [x, y, z, w] = p.q || [0, 0, 0, 1]; return Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + x * x)) * 180 / Math.PI; };
for (const p of pieces) p.yaw = ((yq(p) % 360) + 360) % 360;
const role = n => P.piece(n).role, kindC = n => (C.get(n) || {}).kind, fam = n => C.family(n);
const FURN = new Set(['seat', 'table', 'bed', 'storage', 'light', 'rug', 'fire', 'station', 'station-addon', 'display-stand', 'hanging-cloth', 'container-decor', 'carving', 'sign', 'decor', 'statue']);
const furn = pieces.filter(p => FURN.has(kindC(p.name)));

// ---------------- geometry
const WALLR = new Set(['wall', 'gable', 'door', 'window']);
const walls = pieces.filter(p => WALLR.has(role(p.name)));
const OVER = new Set(['floor', 'roof', 'roofTop', 'roofCorner']);
const over = pieces.filter(p => OVER.has(role(p.name)));
function inBox(o, x, z, pad = 0) {
  const s = P.piece(o.name).size, a = o.yaw * Math.PI / 180, dx = x - o.x, dz = z - o.z;
  const u = dx * Math.cos(a) - dz * Math.sin(a), v = dx * Math.sin(a) + dz * Math.cos(a);
  return Math.abs(u) <= s[0] / 2 + pad && Math.abs(v) <= s[2] / 2 + pad;
}
const covered = p => over.some(o => o.y > p.y + 0.4 && o.y < p.y + 14 && inBox(o, p.x, p.z));
const floorUnder = p => { let best = null; for (const o of pieces) if (role(o.name) === 'floor' && o.y <= p.y + 0.3 && o.y > p.y - 3 && inBox(o, p.x, p.z, 0.1)) best = best == null ? o.y : Math.max(best, o.y); return best; };
// the nearest wall's closest point (as data/catalog/tools/facing_check.js reads it)
function nearWall(p) {
  let best = 9, bdx = 0, bdz = 0;
  for (const o of walls) {
    const oc = P.piece(o.name), a = o.yaw * Math.PI / 180, ux = Math.cos(a), uz = -Math.sin(a);
    const lo = oc.onPivot ? o.y - 0.3 : o.y - oc.size[1] / 2 - 0.3, hi = oc.onPivot ? o.y + oc.size[1] + 0.3 : o.y + oc.size[1] / 2 + 0.3;
    if (p.y < lo || p.y > hi) continue;
    let t = (p.x - o.x) * ux + (p.z - o.z) * uz; const hl = oc.size[0] / 2; t = Math.max(-hl, Math.min(hl, t));
    const px = o.x + ux * t, pz = o.z + uz * t, d = Math.hypot(p.x - px, p.z - pz);
    if (d < best) { best = d; bdx = px - p.x; bdz = pz - p.z; }
  }
  return { d: best, dx: bdx, dz: bdz };
}
function sideTo(p, dx, dz) {
  const a = p.yaw * Math.PI / 180, u = dx * Math.cos(a) - dz * Math.sin(a), v = dx * Math.sin(a) + dz * Math.cos(a);
  return Math.abs(u) > Math.abs(v) ? (u > 0 ? '+x' : '-x') : (v > 0 ? '+z' : '-z');
}

// ---------------- rooms, as the decorator reads them
const rooms = [];
for (const y of D._int.floorLevels(pieces)) for (const m of D.readLevel(pieces, y, null) || []) if (m.area >= 4 && m.covered >= 0.5) rooms.push({ y, m, items: [] });
const cellKey = (x, z) => `${Math.round(x * 2)},${Math.round(z * 2)}`;
for (const r of rooms) r.keys = new Set(r.m.cells.map(c => cellKey(c.x, c.z)));
for (const p of furn) {
  const r = rooms.find(rr => p.y > rr.y - 0.4 && p.y < rr.y + 2.6 && [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]].some(([a, b]) => rr.keys.has(cellKey(p.x + a, p.z + b))));
  if (r) { r.items.push(p); p.room = r; }
}

const hard = [], items = [];
const H = (group, id, fail, detail) => hard.push({ group, id, fail: !!fail, detail: detail || [] });
const S = (group, id, weight, ok, half, value, detail, byEye) => items.push({ group, id, weight, points: byEye ? null : ok ? weight : half ? weight / 2 : 0, value, detail: detail || [], byEye: !!byEye });

// ================= catalog (track A)
// H1 outdoor-only pieces indoors. D-164 (Tyler, 2026-11-12): wood_fence never indoors or on towers, porches and lofts
// included; the darkwood carvings and stakes not under cover at floor level.
const OUTDOOR = /^(darkwood_raven|darkwood_wolf|wood_dragon1|piece_sharpstakes|stake_wall)$/;
const h1 = [];
for (const p of pieces) {
  if (p.name === 'wood_fence' && (covered(p) || type === 'tower')) h1.push(`wood_fence at (${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)})${type === 'tower' ? ' on a tower' : ' under cover'}`);
  else if (OUTDOOR.test(p.name) && covered(p)) { const f = floorUnder(p); if (f != null && p.y - f < 1.5) h1.push(`${p.name} indoors at floor level`); }
}
H('catalog', 'H1 outdoor-only piece indoors', h1.length, h1);
// H2 wardrobes, beds and thrones within 2.5 m of a wall have their back to it
const h2 = [];
for (const p of furn.filter(q => /^(piece_chest_warderobe|bed|piece_bed02|ashwood_bed|piece_throne01|piece_throne02|piece_blackmarble_throne)$/.test(q.name))) {
  const w = nearWall(p); if (w.d > 2.5) continue;
  const fc = C.facing(p.name), back = /bed/.test(p.name) ? '-z' : fc && fc.back;
  if (!back) continue;
  const s = sideTo(p, w.dx, w.dz), front = { '+z': '-z', '-z': '+z', '+x': '-x', '-x': '+x' }[back];
  if (s === front) h2.push(`${p.name} at (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) has its front to the wall ${w.d.toFixed(2)} m away`);
}
H('catalog', 'H2 large furniture faces the room', h2.length, h2);
// H3 wall-hung pieces with their back on a wall
const h3 = [];
for (const p of furn) {
  const fc = C.facing(p.name), b = C.belongs(p.name);
  if (!fc || !fc.back || !['high', 'medium'].includes(fc.sure) || !b || b.mount !== 'wall-hung') continue;
  const w = nearWall(p);
  if (w.d > 0.9) { h3.push(`${p.name} ${w.d.toFixed(2)} m from any wall`); continue; }
  if (sideTo(p, w.dx, w.dz) !== fc.back) h3.push(`${p.name} at (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) turned with its ${sideTo(p, w.dx, w.dz)} side to the wall`);
}
H('catalog', 'H3 wall-hung pieces back to the wall', h3.length, h3);

// 1 seats match their table's family
const tables = furn.filter(p => kindC(p.name) === 'table' && p.name !== 'piece_cartographytable'), seats = furn.filter(p => kindC(p.name) === 'seat');
const seatOf = s => { let b = null, bd = 2.5; for (const t of tables) { const d = Math.hypot(s.x - t.x, s.z - t.z); if (Math.abs(s.y - t.y) < 0.6 && d < bd) { bd = d; b = t; } } return b; };
const pairOk = (t, s) => fam(t) === fam(s) || ((C.pairsWith(t) || {}).room || []).some(x => x.id === s) || ((C.pairsWith(t) || {}).area || []).some(x => (x.id || x[0]) === s);
const atT = seats.map(s => [s, seatOf(s)]).filter(([, t]) => t);
const m1 = atT.length ? atT.filter(([s, t]) => pairOk(t.name, s.name)).length / atT.length : 1;
S('catalog', 1, 10, m1 >= 0.8, m1 >= 0.6, +m1.toFixed(2), atT.filter(([s, t]) => !pairOk(t.name, s.name)).map(([s, t]) => `${s.name} at ${t.name}`));
// 2 one furniture family leads each room
const FAMK = new Set(['seat', 'table', 'bed', 'storage']);
const off2 = rooms.filter(r => { const f = r.items.filter(p => FAMK.has(kindC(p.name))).map(p => fam(p.name)).filter(Boolean); if (f.length < 3) return false; const c = {}; for (const x of f) c[x] = (c[x] || 0) + 1; const v = Object.values(c).sort((a, b) => b - a); return v[0] / f.length < 0.6 || v.length > 3; });
S('catalog', 2, 8, !off2.length, off2.length <= 1, off2.length, off2.map(r => `room ${Math.round(r.m.area)} m2 at ${r.y}: ${[...new Set(r.items.filter(p => FAMK.has(kindC(p.name))).map(p => fam(p.name)))].join(', ')}`));
// 3 rarely-with pairs in one room
const rare3 = [];
for (const r of rooms) { const names = [...new Set(r.items.map(p => p.name))]; for (const a of names) { const pw = C.pairsWith(a) || {}; for (const x of (pw.roomRarely || [])) if (names.includes(x.id) && x.lift < 0.5) rare3.push(`${a} with ${x.id} (lift ${x.lift})`); } }
S('catalog', 3, 8, !rare3.length, rare3.length <= 2, rare3.length, [...new Set(rare3)]);
// 4 per-piece counts within the corpus (lib/rooms_intent.js capOf, the same numbers the generator holds to)
const floorM2 = rooms.reduce((a, r) => a + r.m.area, 0), plan = { floor: floorM2, used: {} };
const cnt = {}; for (const p of furn) cnt[p.name] = (cnt[p.name] || 0) + 1;
const over4 = Object.entries(cnt).filter(([n, c]) => c > RI.capOf(plan, n) && !/^(wood_floor|wood_beam)/.test(n));
S('catalog', 4, 8, !over4.length, over4.length <= 2, over4.length, over4.map(([n, c]) => `${n} ${c} (cap ${RI.capOf(plan, n)})`));
S('catalog', 5, 7, null, null, 'across the approved buildings', ['measured over the council set, not one building'], true);
// 6 hearth before campfire in homes, halls and taverns
const fires = furn.filter(p => kindC(p.name) === 'fire');
const big6 = ['longhouse', 'tavern', 'hub'].includes(type) || (type === 'home' && floorM2 > 80);
const ok6 = !fires.length || !big6 || fires.some(f => f.name === 'hearth') || pieces.some(p => /stone_wall|grausten/.test(p.name) && fires.some(f => Math.hypot(p.x - f.x, p.z - f.z) < 1.6));
S('catalog', 6, 7, ok6, false, fires.map(f => f.name).join(', ') || 'no fire', ok6 ? [] : ['the main fire of a large home, hall or tavern is a lone fire pit']);
// 7 rare pieces stay rare (D-166: hidden-menu pieces have no corpus cap, each needs a use)
const rareK = Object.keys(cnt).filter(n => { const u = C.reuse(n); return u && /rare/.test(u.tier) && C.get(n).buildable !== false && !(C.get(n).tags || []).includes('not-buildable'); });
const ledges = cnt.wood_ledge || 0;
S('catalog', 7, 6, rareK.length <= 2, rareK.length <= 3, `${rareK.length} rare kinds, ${ledges} wood_ledge`, rareK);
// 8 roof decor on the roof
const roof8 = pieces.filter(p => /^(darkwood_raven|darkwood_wolf|wood_dragon1)$/.test(p.name));
const bad8 = roof8.filter(p => p.y < 4 || covered(p));
S('catalog', 8, 6, !bad8.length && (roof8.length <= 2 || ['longhouse', 'hub'].includes(type)), !bad8.length, `${roof8.length} carvings`, bad8.map(p => `${p.name} at ${p.y.toFixed(1)} m${covered(p) ? ' under cover' : ''}`));
S('catalog', 9, 6, null, null, 'shell materials', ['judged by the shell member (track D) and the views'], true);
// 10 light and dark balance: rooms whose large pieces are all very dark or all very light
const val = n => (C.look(n) || {}).value;
const off10 = rooms.filter(r => { const v = r.items.filter(p => FAMK.has(kindC(p.name))).map(p => val(p.name)).filter(Boolean); return v.length >= 3 && (v.every(x => x === 'very dark') || v.every(x => x === 'very light')); });
S('catalog', 10, 6, !off10.length, off10.length <= 1, off10.length, off10.map(r => `room ${Math.round(r.m.area)} m2`));
// 11 glowing pieces fit the room: a cold or colored glow not in a room with a bed
const COLDG = /mist|blue|green|magetable|eitr|_cracked/;
const off11 = rooms.filter(r => r.items.some(p => /bed/.test(kindC(p.name) || '')) && r.items.some(p => COLDG.test(p.name))).map(r => r.items.filter(p => COLDG.test(p.name)).map(p => p.name).join(', ') + ' in a room with a bed');
S('catalog', 11, 5, !off11.length, off11.length <= 1, off11.length, off11);
// 12 containers in sets: pots of one family within 2 m of each other
const pots = furn.filter(p => /^piece_pot/.test(p.name));
const potMix = pots.filter(p => pots.some(q => q !== p && Math.hypot(q.x - p.x, q.z - p.z) < 2 && /cracked/.test(q.name) !== /cracked/.test(p.name)));
S('catalog', 12, 5, !potMix.length, potMix.length <= 2, `${pots.length} pots, ${potMix.length} mixed`, potMix.map(p => p.name));
// 13 wall-hung pieces at corpus heights (catalog placement.height_m p10 to p90, over the floor under them)
const hung = furn.filter(p => { const b = C.belongs(p.name); return b && b.mount === 'wall-hung' && b.height; });
const off13 = hung.filter(p => { const f = floorUnder(p); if (f == null) return false; const h = p.y - f, b = C.belongs(p.name).height; return h < b.p10 - 0.2 || h > b.p90 + 0.2; });
const s13 = hung.length ? 1 - off13.length / hung.length : 1;
S('catalog', 13, 5, s13 >= 0.9, s13 >= 0.75, +s13.toFixed(2), off13.slice(0, 6).map(p => `${p.name} ${(p.y - floorUnder(p)).toFixed(2)} m up`));
// 14 indoor pieces indoors
const ind = furn.filter(p => { const b = C.belongs(p.name); return b && b.covered >= 0.75 && !/^(piece_bench01|piece_table)$/.test(p.name); });
const s14 = ind.length ? ind.filter(covered).length / ind.length : 1;
S('catalog', 14, 4, s14 >= 0.95, s14 >= 0.85, +s14.toFixed(2), ind.filter(p => !covered(p)).slice(0, 6).map(p => p.name));
// 15 fences where builders put them (D-164)
const fences = pieces.filter(p => p.name === 'wood_fence');
S('catalog', 15, 4, !h1.some(x => /wood_fence/.test(x)), false, `${fences.length} wood_fence`, []);
S('catalog', 16, 5, null, null, 'room descriptions', ['reviewer reads the room list (intent.json) against the plan view'], true);

// ================= outside study (track C)
// H4 a black marble seat at a table of another material
const h4 = atT.filter(([s, t]) => /blackmarble/.test(s.name) && !/blackmarble/.test(t.name)).map(([s, t]) => `${s.name} at ${t.name}`);
H('outside-study', 'H4 black marble seat at another table', h4.length, h4);
H('outside-study', 'H5 outdoor-only pieces indoors', h1.length, h1);
// 4 zones: no two eating tables within 3 m in a home
const off4c = [];
for (const r of rooms) { const t = r.items.filter(p => kindC(p.name) === 'table' && p.name !== 'piece_cartographytable'); if (type !== 'home') continue; for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) if (Math.hypot(t[i].x - t[j].x, t[i].z - t[j].z) < 4) off4c.push(`${t[i].name} and ${t[j].name} ${Math.hypot(t[i].x - t[j].x, t[i].z - t[j].z).toFixed(1)} m apart`); }
S('outside-study', 4, 6, !off4c.length, off4c.length <= 1, off4c.length, off4c);
// 5 one seat kind per table
const byT = new Map(); for (const [s, t] of atT) { if (!byT.has(t)) byT.set(t, new Set()); if (!/throne/.test(s.name)) byT.get(t).add(s.name); }
const one5 = byT.size ? [...byT.values()].filter(v => v.size <= 1).length / byT.size : 1;
S('outside-study', 5, 6, one5 >= 0.9, one5 >= 0.75, +one5.toFixed(2), [...byT.entries()].filter(([, v]) => v.size > 1).map(([t, v]) => `${t.name}: ${[...v].join(', ')}`));
// 8 woods: at most two furniture families per room
const off8 = rooms.filter(r => new Set(r.items.filter(p => FAMK.has(kindC(p.name)) && kindC(p.name) !== 'storage').map(p => fam(p.name)).filter(Boolean)).size > 2);
S('outside-study', 8, 5, !off8.length, off8.length <= 1, off8.length, off8.map(r => [...new Set(r.items.filter(p => FAMK.has(kindC(p.name)) && kindC(p.name) !== 'storage').map(p => fam(p.name)))].join(', ')));
// 9 cold glow at most once per room
const off9 = rooms.filter(r => r.items.filter(p => COLDG.test(p.name)).length > 1);
S('outside-study', 9, 4, !off9.length, off9.length <= 1, off9.length, off9.map(r => r.items.filter(p => COLDG.test(p.name)).map(p => p.name).join(', ')));
// 12 light variety: the lead light kind 50 to 91 % of the lights
const lights = furn.filter(p => kindC(p.name) === 'light'), lc = {}; for (const p of lights) lc[p.name] = (lc[p.name] || 0) + 1;
const lead = Math.max(0, ...Object.values(lc)) / Math.max(1, lights.length);
S('outside-study', 12, 3, !lights.length || (lead >= 0.5 && lead <= 0.91) || lights.length < 4, lead >= 0.4, `${Object.keys(lc).length} kinds, lead ${lead.toFixed(2)}`, Object.entries(lc).map(([n, c]) => `${n} ${c}`));
// 14 floor stands at a wall or a seat
const floorStands = furn.filter(p => p.name === 'itemstandh' && (() => { const f = floorUnder(p); return f != null && p.y - f < 0.3; })());
const s14c = floorStands.length ? floorStands.filter(p => nearWall(p).d < 0.5 || seats.some(s => Math.hypot(s.x - p.x, s.z - p.z) < 0.8)).length / floorStands.length : 1;
S('outside-study', 14, 3, s14c >= 0.9, s14c >= 0.75, +s14c.toFixed(2), []);
// 18 repeats capped: log benches at most three, stacked chests only in store rooms, no extension twice at one station
const logb = cnt.piece_logbench01 || 0;
const extTwice = Object.entries(cnt).filter(([n, c]) => /_ext\d/.test(n) && c > 1 && !['storage', 'smithy', 'workshop'].includes(type)).map(([n, c]) => `${n} ${c}`);
const extTwiceS = ['smithy', 'workshop'].includes(type) ? Object.entries(cnt).filter(([n, c]) => /_ext\d/.test(n) && c > 1).map(([n, c]) => `${n} ${c}`) : [];
const b18 = (logb > 3 ? 1 : 0) + extTwice.length + extTwiceS.length;
S('outside-study', 18, 4, !b18, b18 <= 1, b18, [logb > 3 ? `${logb} log benches` : null, ...extTwice, ...extTwiceS].filter(Boolean));
// 23 imperfect placement: share of seats turned more than 10 degrees off the axes
const turned = seats.filter(s => { const r = s.yaw % 90; return Math.min(r, 90 - r) > 10; }).length / Math.max(1, seats.length);
S('outside-study', 23, 1, !seats.length || (turned >= 0.25 && turned <= 0.6), turned >= 0.15 && turned <= 0.7, +turned.toFixed(2), []);
for (const [id, w, what] of [[1, 7, 'core set per room kind'], [2, 6, 'focal point from the door'], [3, 4, 'command position'], [6, 6, 'walking lines (corpus-rooms H3, item 14)'], [7, 2, 'pull-back and bed sides'], [10, 2, 'two fabric colors'], [11, 6, 'light layers'], [13, 6, 'clutter near its use'], [15, 5, 'hot spots'], [16, 3, 'layers'], [17, 2, 'density band'], [19, 6, 'mid-task scenes'], [20, 6, 'who lives here'], [21, 4, 'one story'], [22, 3, 'clue at the focal point']])
  S('outside-study', id, w, null, null, what, ['judged on the views and intent.json'], true);

// ---------------- totals per group
const out = {};
for (const g of ['catalog', 'outside-study']) {
  const it = items.filter(x => x.group === g), meas = it.filter(x => !x.byEye);
  const wt = meas.reduce((a, x) => a + x.weight, 0), pts = meas.reduce((a, x) => a + x.points, 0);
  const hf = hard.filter(h => h.group === g && h.fail).map(h => h.id);
  const mark = g === 'catalog' ? 0.8 : 0.75;
  out[g] = { pass: !hf.length && pts >= mark * wt, points: +pts.toFixed(1), of: wt, mark: `${Math.round(mark * 100)} % of the measured weight`, hardFails: hf, hard: hard.filter(h => h.group === g), items: it };
}
if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify(out, null, 1));
for (const [g, v] of Object.entries(out)) {
  console.log(`${path.basename(file)} ${g}: ${v.pass ? 'PASS' : 'FAIL'} ${v.points} of ${v.of} measured, hard fails ${v.hardFails.length}`);
  for (const h of v.hard) console.log(`  ${h.fail ? 'FAIL' : 'ok  '} ${h.id}${h.fail ? ': ' + h.detail.slice(0, 4).join('; ') : ''}`);
  for (const x of v.items.filter(i => !i.byEye)) console.log(`  ${String(x.points).padStart(4)}/${x.weight} item ${x.id}: ${x.value}${x.points < x.weight && x.detail.length ? ': ' + x.detail.slice(0, 3).join('; ') : ''}`);
}
