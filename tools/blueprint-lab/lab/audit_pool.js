// Audits a test pool folder (81 files, <culture>-<line>_s#d#.blueprint) against the defects found in game tests, so each
// one is a number that can be watched instead of a screenshot. Reads the files only; changes nothing.
//
// Usage, from tools/blueprint-lab: node lab/audit_pool.js <pool folder> [--json out.json] [--list]
//
// What it measures, per design and per line:
//   nest      decor stages nest: every piece of d1 is in d2, every piece of d2 in d3 (D-070)
//   lineage   share of a stage's shell (structural pieces) still standing in the next stage (D-069)
//   furnClip  pairs of furniture pieces whose boxes overlap by more than 12 cm on every axis (chests in chests,
//             benches in tables: T-6xx "chests clipping each other")
//   stacked   furniture standing on furniture that is not a chest stack or a table setting
//   overWin   wall hangings (banners, signs, item stands, trophies) whose box overlaps a window or door opening
//   outside   furniture and beds with no wall line between them and open air on some side at their height (a bed
//             showing through a wall gap), judged by the design's own footprint: the piece's middle lies outside
//             the convex footprint of the floor pieces
//   stairFoot stairs whose lowest end has neither ground (y near 0) nor a floor piece under it
//   stations  base crafting stations with no roof piece above them (D-067)
//   storage   storehouse lines: chests, chests along a wall (within 1.2 m of a wall piece), chests stacked, signs
//   beds      beds at d1 (beds come first)
//   same      how alike the furniture of the three home lines is at s2d2 (Jaccard on piece counts; no cookie cutter)
const fs = require('fs'), path = require('path');
const B = require('../lib/blueprint.js'), PC = require('../lib/pieces.js'), C = require('../lib/checks.js');
const D = require('../lib/decorate.js');
// Furniture is measured with the decorator's own sizes (the game's, turned with the piece) where it has them: the
// catalog's boxes are rough for props and called a chest beside a chopping block a clip.
function obbGap(a, b) { // how far apart two turned boxes are on their best separating axis (below 0: they overlap that deep)
  let best = -Infinity;
  for (const [o, p] of [[a, b], [b, a]]) for (const [ax, az, h] of [[o.c, -o.s, o.hw], [o.s, o.c, o.hd]]) {
    const d = Math.abs((p.x - o.x) * ax + (p.z - o.z) * az);
    const r = Math.abs((p.c * ax + -p.s * az)) * p.hw + Math.abs((p.s * ax + p.c * az)) * p.hd;
    best = Math.max(best, d - h - r);
  }
  return best;
}

const dir = process.argv[2];
if (!dir) { console.error('usage: node lab/audit_pool.js <pool folder> [--json out.json] [--list]'); process.exit(1); }
const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
const list = process.argv.includes('--list');

const FURN = ['bed', 'table', 'seat', 'storage', 'craft', 'fire', 'clutter'];
const STATION = /^(piece_workbench|forge|piece_stonecutter|piece_artisanstation|blackforge|piece_magetable|piece_cauldron)$/;
const HANG = /^(piece_banner\d+|sign|sign_notext|itemstand|cloth_hanging_|fenrirhide_hanging|Trophy)/;
const key = p => `${p.name}@${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}@${p.q.map(v => v.toFixed(2)).join(',')}`;
const role = p => PC.piece(p.name).role;
const structural = p => PC.piece(p.name).structural;
const ov = (a, b, ax) => Math.min(a[ax + '1'], b[ax + '1']) - Math.max(a[ax + '0'], b[ax + '0']);

function hull(points) { // convex hull, monotone chain
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of pts.reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function inHull(h, x, z, pad) {
  if (h.length < 3) return true;
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    if (((b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0])) / len < -pad) return false;
  }
  return true;
}

function audit(pieces) {
  const boxes = pieces.map(p => C.catBox(p));
  const r = { pieces: pieces.length, furnClip: [], stacked: [], overWin: [], outside: [], stairFoot: [], stations: [] };
  const furn = pieces.map((p, i) => i).filter(i => FURN.includes(role(pieces[i])));
  // furniture boxes inside each other
  for (let a = 0; a < furn.length; a++) for (let b = a + 1; b < furn.length; b++) {
    const A = boxes[furn[a]], Bx = boxes[furn[b]];
    let ox = ov(A, Bx, 'x'), oy = ov(A, Bx, 'y'), oz = ov(A, Bx, 'z');
    const pa = pieces[furn[a]], pb = pieces[furn[b]];
    if (D.FURNITURE[pa.name] && D.FURNITURE[pb.name]) {
      const ia = D.itemOf(pa), ib = D.itemOf(pb), deep = -obbGap(ia.b, ib.b);
      oy = Math.min(ia.y1, ib.y1) - Math.max(ia.y0, ib.y0);
      ox = oz = deep;
    }
    const fireSet = [pieces[furn[a]].name, pieces[furn[b]].name].some(n => /^(fire_pit|hearth|piece_cookingstation|piece_cauldron|piece_cookingstation_iron)$/.test(n)) && [pieces[furn[a]].name, pieces[furn[b]].name].some(n => /^(fire_pit|hearth|bonfire)$/.test(n));
    if (fireSet) continue; // a spit or a pot over its fire
    if (ox > 0.12 && oy > 0.12 && oz > 0.12) r.furnClip.push(`${pieces[furn[a]].name} in ${pieces[furn[b]].name} (${ox.toFixed(2)} x ${oy.toFixed(2)} x ${oz.toFixed(2)} m)`);
    else if (ox > 0.2 && oz > 0.2 && Math.abs(Bx.y0 - A.y1) < 0.15 && A.y0 < Bx.y0 || ox > 0.2 && oz > 0.2 && Math.abs(A.y0 - Bx.y1) < 0.15 && Bx.y0 < A.y0) {
      const lower = A.y0 < Bx.y0 ? pieces[furn[a]] : pieces[furn[b]], upper = A.y0 < Bx.y0 ? pieces[furn[b]] : pieces[furn[a]];
      const fine = (role(lower) === 'storage' && role(upper) === 'storage') || (role(lower) === 'table' && role(upper) === 'clutter');
      if (!fine) r.stacked.push(`${upper.name} on ${lower.name}`);
    }
  }
  // hangings over openings
  const open = pieces.map((p, i) => i).filter(i => ['window', 'door'].includes(role(pieces[i])));
  pieces.forEach((p, i) => {
    if (!HANG.test(p.name)) return;
    for (const j of open) {
      const A = boxes[i], Bx = boxes[j];
      if (ov(A, Bx, 'x') > -0.15 && ov(A, Bx, 'z') > -0.15 && ov(A, Bx, 'y') > 0.2 &&
          Math.max(ov(A, Bx, 'x'), ov(A, Bx, 'z')) > 0.25) { r.overWin.push(`${p.name} over ${pieces[j].name}`); break; }
    }
  });
  // furniture outside the floor's footprint
  const floorPts = [];
  pieces.forEach((p, i) => { if (role(p) === 'floor') { const b = boxes[i]; floorPts.push([b.x0, b.z0], [b.x0, b.z1], [b.x1, b.z0], [b.x1, b.z1]); } });
  const h = hull(floorPts);
  for (const i of furn) {
    const p = pieces[i];
    if (!p.yard && !inHull(h, p.x, p.z, 0.3) && ['bed', 'storage', 'table', 'seat'].includes(role(p))) r.outside.push(p.name);
  }
  // stair feet
  pieces.forEach((p, i) => {
    if (role(p) !== 'stair') return;
    const b = boxes[i];
    if (b.y0 < 0.35) return;
    const held = boxes.some((o, j) => j !== i && ['floor', 'stair', 'beam', 'wall', 'pole', 'post'].includes(o.info.role) &&
      // a flight's lower step touches it from the side; anything else must be under it
      (o.info.role === 'stair' ? ov(b, o, 'x') > -0.15 && ov(b, o, 'z') > -0.15 && o.y0 < b.y0 && o.y1 >= b.y0 - 0.2
        : ov(b, o, 'x') > 0.2 && ov(b, o, 'z') > 0.2 && o.y1 <= b.y0 + 0.3 && o.y1 >= b.y0 - 0.6));
    if (!held) r.stairFoot.push(`${p.name} at y ${b.y0.toFixed(2)}`);
  });
  // stations under a roof
  pieces.forEach((p, i) => {
    if (!STATION.test(p.name)) return;
    const b = boxes[i];
    const roofed = boxes.some(o => /roof|floor/i.test(o.info.role) && o.y0 > b.y1 - 0.2 && o.x0 <= p.x + 0.5 && o.x1 >= p.x - 0.5 && o.z0 <= p.z + 0.5 && o.z1 >= p.z - 0.5);
    if (!roofed) r.stations.push(p.name);
  });
  // storage
  const chests = furn.filter(i => role(pieces[i]) === 'storage');
  const walls = boxes.filter(b => ['wall', 'halfwall'].includes(b.info.role));
  const near = (b, o, d) => ov(b, o, 'x') > -d && ov(b, o, 'z') > -d && ov(b, o, 'y') > 0;
  r.chests = chests.length;
  r.chestsByWall = chests.filter(i => walls.some(w => near(boxes[i], w, 1.2 - 0.6))).length;
  r.chestsStacked = chests.filter(i => chests.some(j => j !== i && ov(boxes[i], boxes[j], 'x') > 0.3 && ov(boxes[i], boxes[j], 'z') > 0.3 && Math.abs(boxes[i].y0 - boxes[j].y1) < 0.2)).length;
  r.signs = pieces.filter(p => /^sign/.test(p.name)).length;
  r.beds = pieces.filter(p => role(p) === 'bed').length;
  r.furn = {};
  for (const i of furn) r.furn[pieces[i].name] = (r.furn[pieces[i].name] || 0) + 1;
  return r;
}

const files = fs.readdirSync(dir).filter(f => /_s\dd\d\.blueprint$/.test(f)).sort();
const designs = {};
for (const f of files) {
  const m = f.match(/^(.*)_s(\d)d(\d)\.blueprint$/);
  const pieces = B.parse(fs.readFileSync(path.join(dir, f), 'utf8')).pieces;
  (designs[m[1]] = designs[m[1]] || {})[`s${m[2]}d${m[3]}`] = { pieces, keys: new Set(pieces.map(key)), a: audit(pieces) };
}

const report = { pool: dir, designs: files.length, lines: {}, totals: {} };
const tot = { furnClip: 0, stacked: 0, overWin: 0, outside: 0, stairFoot: 0, stations: 0, nestBroken: 0 };
for (const [line, d] of Object.entries(designs)) {
  const L = report.lines[line] = { nest: {}, lineage: {}, issues: {} };
  for (let s = 1; s <= 3; s++) {
    for (const [a, b] of [[1, 2], [2, 3]]) {
      const A = d[`s${s}d${a}`], Bd = d[`s${s}d${b}`];
      if (!A || !Bd) continue;
      const missing = [...A.keys].filter(k => !Bd.keys.has(k)).length;
      L.nest[`s${s} d${a} in d${b}`] = missing === 0 ? 'ok' : `${missing} of ${A.keys.size} pieces missing`;
      if (missing) tot.nestBroken++;
    }
    const cur = d[`s${s}d1`], next = d[`s${s + 1}d1`];
    if (cur && next) {
      const shell = cur.pieces.filter(structural);
      L.lineage[`s${s} to s${s + 1}`] = Math.round(100 * shell.filter(p => next.keys.has(key(p))).length / Math.max(1, shell.length)) + ' % of the shell kept';
    }
  }
  for (const [stage, v] of Object.entries(d)) {
    const a = v.a, found = [];
    for (const k of ['furnClip', 'stacked', 'overWin', 'outside', 'stairFoot', 'stations']) if (a[k].length) { found.push(`${k}: ${[...new Set(a[k])].slice(0, 4).join('; ')}${a[k].length > 4 ? ` (+${a[k].length - 4})` : ''}`); tot[k] += a[k].length; }
    if (found.length) L.issues[stage] = found;
  }
  L.beds = Object.fromEntries(['s1d1', 's2d1', 's3d1'].filter(s => d[s]).map(s => [s, d[s].a.beds]));
  if (/store|storage/.test(line)) L.storage = Object.fromEntries(Object.entries(d).map(([s, v]) => [s, `${v.a.chests} chests, ${v.a.chestsByWall} by a wall, ${v.a.chestsStacked} stacked, ${v.a.signs} signs`]));
}
report.totals = tot;
// likeness of the home lines
const homes = Object.keys(designs).filter(l => /home/.test(l));
report.same = {};
for (let i = 0; i < homes.length; i++) for (let j = i + 1; j < homes.length; j++) for (const st of ['s1d1', 's2d2', 's3d3']) {
  const A = designs[homes[i]][st], Bd = designs[homes[j]][st];
  if (!A || !Bd) continue;
  const names = new Set([...Object.keys(A.a.furn), ...Object.keys(Bd.a.furn)]);
  let inter = 0, union = 0;
  for (const n of names) { const x = A.a.furn[n] || 0, y = Bd.a.furn[n] || 0; inter += Math.min(x, y); union += Math.max(x, y); }
  report.same[`${homes[i]} and ${homes[j]} ${st}`] = union ? +(inter / union).toFixed(2) : 0;
}

if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(report, null, 1));
console.log(`${files.length} designs in ${Object.keys(designs).length} lines`);
console.log('totals:', JSON.stringify(tot));
for (const [line, L] of Object.entries(report.lines)) {
  console.log(`\n${line}`);
  console.log('  lineage:', Object.entries(L.lineage).map(([k, v]) => `${k} ${v}`).join(', '));
  const broken = Object.entries(L.nest).filter(([, v]) => v !== 'ok');
  console.log('  decor nesting:', broken.length ? broken.map(([k, v]) => `${k}: ${v}`).join('; ') : 'ok at every stage');
  console.log('  beds at d1:', JSON.stringify(L.beds));
  if (L.storage) for (const [s, v] of Object.entries(L.storage)) if (list || /d3$/.test(s)) console.log(`  storage ${s}: ${v}`);
  for (const [s, f] of Object.entries(L.issues)) if (list || /d3$/.test(s) || /s1d1/.test(s)) for (const x of f) console.log(`  ${s} ${x}`);
}
console.log('\nfurniture likeness between home lines (1 = same list):', JSON.stringify(report.same));
