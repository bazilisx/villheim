// The pool audit (lab/audit_pool.js and 'vh testpool make'): turns the defects found in game tests into numbers for a
// set of designs, and a gate that refuses a pool showing any of them. Reads designs only; changes nothing. Works in
// Node and in the game's bundle (Jint), so the lab and the game judge a pool the same way.
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
//   mountClip things hung on a wall (signs, item stands, banners, shields, trophies) whose visible parts reach more
//             than 1.5 cm (a banner's cloth 3 cm) into a wall, beam, post or roof's visible parts (the 2x2 wood wall's
//             cross bars, T-606, T-612)
//   hang      banners whose cloth goes into the floor or up into the roof, or whose foot hangs more than 1 m over the
//             floor or ground under it (T-606 "banners too high"); signs and wall item stands outside a sensible height
//   loose     food and drink set down loose (not on an item stand): the game drops them and a player picks them up
//             by walking past (T-626)
//   doorway   anything solid in the middle 0.9 m of a door's way, 0.35 to 1.95 m over its floor, 0.7 m either side of
//             the wall (a beam across the foot of a door, T-606)
//   onStation furniture standing on or in a crafting station (a table on a workbench, T-606); its own extensions aside
//   intoWall  furniture more than 15 cm into a wall, window, beam or post (a bed through a post or a window, T-606):
//             against a flat wall or a post by the furniture's frame and the wall's visible parts, against the rest by what
//             shows of both; 5 to 15 cm is counted as intoWallSoft and watched, not gated yet
//   storage   storehouse lines: chests, chests along a wall (within 1.2 m of a wall piece), chests stacked, signs
//   beds      beds at d1 (beds come first)
//   marks     a file's '#VillheimClips' section (lib/blueprint.js) lists pieces of the interior library's sets that go
//             into a wall's visible parts (mountClip, intoWall) or into their own set's furniture (furnClip) as deep as
//             the source builds put them; those pass up to their mark (clips made on purpose, D-098)
//   same      how alike the home lines are (likeness: furniture list and arrangement); homeAlike counts pairs above 0.7
//             at d2 and d3 (no cookie cutter; d1 is beds and a chest everywhere)
const NODE_A = typeof module !== 'undefined';
const PC = NODE_A ? require('./pieces.js') : window.VHPieces;
const C = NODE_A ? require('./checks.js') : window.VHChecks;
const D = NODE_A ? require('./decorate.js') : window.VHDecorate;
const M = NODE_A ? require('./mesh.js') : window.VHMesh;
const SH = NODE_A ? require('./shapes.js') : window.VHShapes;
// The gated measures: a pool fails when any of them is above zero.
// Floors for the richness measures (pool below): a little under what the generator reaches on the Norse Meadows pool
// and the second sample (lab/make_testpool.js --sample: Norse Meadows 12.2, 0.443, 1.07; norse-forest Black Forest 14,
// 0.455, 1.78; middle-eastern Plains 13.4, 0.397, 1.08 on 2026-11-10), so they guard against slipping back. Gated on
// pools of six lines or more: a single line ranges widely (a barn holds no corpus set, a smithy six prefabs).
const RICH_FLOOR = { prefabsPerD3: 11, setShare: 0.36, corpusSetsPerD3: 0.9 }, RICH_LINES = 6;
const GATE = ['richness', 'homeAlike', 'nestBroken', 'furnClip', 'stacked', 'overWin', 'stairFoot', 'stations', 'mountClip', 'hang', 'loose', 'doorway', 'onStation', 'intoWall'];
// Watched only: printed with the totals; to be gated once the generator clears them.
const WATCH = ['outside', 'intoWallSoft'];
const MOUNT = /^(piece_banner\d+|sign|sign_notext|itemstand|piece_shieldgeneric|cloth_hanging_|fenrirhide_hanging|Trophy|wood_dragon)/;
const BANNER = /^piece_banner\d+$/;
// Heights of the middle of a sign or a wall item stand over the floor under it (m): read at eye height, reached by hand.
const MID = { sign: [1.0, 2.3], sign_notext: [1.0, 2.3], itemstand: [0.7, 2.4] };
const STRUCT_VIS = ['wall', 'halfwall', 'window', 'beam', 'pole', 'gable', 'door'];
const FLAT = ['wall', 'halfwall', 'gable', 'pole'];
const OVERHEAD = ['roof', 'roofTop', 'roofCorner', 'floor', 'beam'];
const isLooseItem = n => M.source(n) === 'Items' && !/^(Pickable_|Placeable_|TreasureChest|loot_chest)/.test(n);
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

// shell: keys of the building's own pieces (its d1 file at the same stage); built furniture added at d2 and d3 (a
// cabinet whose back is a half wall, shelves on posts) is part of its set and is left out of the wall measures.
function audit(pieces, shell) {
  const boxes = pieces.map(p => C.catBox(p));
  const r = { pieces: pieces.length, furnClip: [], stacked: [], overWin: [], outside: [], stairFoot: [], stations: [],
    mountClip: [], hang: [], loose: [], doorway: [], onStation: [], intoWall: [], intoWallSoft: [] };
  const vis = pieces.map(p => M.world(p) || []), visBox = vis.map(M.aabbOf);
  const sol = pieces.map(p => SH.world(p) || []), solBox = pieces.map(p => SH.aabb(p));
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
    // a pair a kit set stands as its source builds stood it (D-098), up to the mark the file carries
    const fmark = Math.max(pa.fclip || 0, pb.fclip || 0);
    if (fmark && Math.min(ox, oz) <= fmark + 0.005) continue;
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

  // things hung on walls: into the wall's visible parts, and how they hang
  const structVis = pieces.map((p, i) => i).filter(i => STRUCT_VIS.includes(role(pieces[i])) && (!shell || shell.has(key(pieces[i]))));
  const floorIdx = pieces.map((p, i) => i).filter(i => role(pieces[i]) === 'floor');
  const overIdx = pieces.map((p, i) => i).filter(i => OVERHEAD.includes(role(pieces[i])));
  const floorUnder = (x, z, below) => { // the highest floor top under (x, z) at or below 'below'; the ground (0) if none
    let f = 0;
    for (const j of floorIdx) { const t = SH.topAt(sol[j], x, z); if (t != null && t <= below + 0.05 && t > f) f = t; }
    return f;
  };
  const ceilingOver = (x, z, above) => { // the lowest underside over (x, z) above 'above', or null
    let c = null;
    for (const j of overIdx) { const u = SH.undersideAt(sol[j], x, z, above); if (u != null && (c == null || u < c)) c = u; }
    return c;
  };
  const roofIdx = pieces.map((p, i) => i).filter(i => ['roof', 'roofCorner', 'roofTop'].includes(role(pieces[i])) && (!shell || shell.has(key(pieces[i]))));
  pieces.forEach((p, i) => {
    if (!MOUNT.test(p.name) || !visBox[i]) return;
    let deep = 0, what = '';
    for (const j of structVis.concat(roofIdx)) { const d = M.deepest(vis[i], vis[j]); if (d > deep) { deep = d; what = pieces[j].name; } }
    // a piece marked with a clip made on purpose (D-098, p.wclip from the file's '#VillheimClips') passes up to its mark
    if (deep > Math.max(BANNER.test(p.name) ? 0.03 : 0.015, (p.wclip || 0) + 0.005)) r.mountClip.push(`${p.name} ${Math.round(deep * 100)} cm into ${what} at ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`);
    const b = visBox[i], mid = (b.y0 + b.y1) / 2;
    const floor = floorUnder(p.x, p.z, b.y0 + 0.05);
    if (BANNER.test(p.name)) {
      const ceil = ceilingOver(p.x, p.z, mid);
      if (b.y0 < floor - 0.03) r.hang.push(`${p.name} ${Math.round((floor - b.y0) * 100)} cm into the floor`);
      else if (b.y0 > floor + 1.0) r.hang.push(`${p.name} foot ${(b.y0 - floor).toFixed(1)} m over the floor`);
      if (ceil != null && b.y1 > ceil + 0.03) r.hang.push(`${p.name} ${Math.round((b.y1 - ceil) * 100)} cm into the roof`);
    } else if (MID[p.name] && role(p) !== 'floor') {
      const h = mid - floor, [lo, hi] = MID[p.name];
      // a horizontal stand (itemstandh) is a table piece and has no entry here
      if (h < lo || h > hi) r.hang.push(`${p.name} middle ${h.toFixed(1)} m over the floor`);
    }
  });
  // food and drink set down loose
  for (const p of pieces) if (isLooseItem(p.name)) r.loose.push(p.name);
  // door ways
  pieces.forEach((p, i) => {
    if (role(p) !== 'door') return;
    const o = PC.doorOpening(p);
    for (let j = 0; j < pieces.length; j++) {
      if (j === i || !sol[j].length) continue;
      let blocked = false;
      for (let a = -0.45; a <= 0.4501 && !blocked; a += 0.15) for (let n = -0.7; n <= 0.7001 && !blocked; n += 0.35) for (let y = 0.35; y <= 1.9501 && !blocked; y += 0.2) {
        const x = o.x + o.ux * a + o.nx * n, z = o.z + o.uz * a + o.nz * n;
        if (sol[j].some(s => SH.inside(s, x, o.y + y, z))) blocked = true;
      }
      if (blocked) r.doorway.push(`${pieces[j].name} in the way of ${p.name} at ${o.x.toFixed(1)},${o.y.toFixed(1)},${o.z.toFixed(1)}`);
    }
  });
  // furniture on or in a crafting station
  pieces.forEach((p, i) => {
    if (!STATION.test(p.name) || !solBox[i]) return;
    const sb = solBox[i];
    pieces.forEach((q, j) => {
      if (j === i || !FURN.includes(role(q)) || /_ext\d/.test(q.name) || STATION.test(q.name) && q === p) return;
      const b = visBox[j] || solBox[j];
      if (!b) return;
      const ox = Math.min(b.x1, sb.x1) - Math.max(b.x0, sb.x0), oz = Math.min(b.z1, sb.z1) - Math.max(b.z0, sb.z0);
      if (ox > 0.1 && oz > 0.1 && b.y0 > sb.y0 + 0.3 && b.y0 < sb.y1 + 0.5) r.onStation.push(`${q.name} on ${p.name}`);
      else if (M.deepest(vis[i], vis[j]) > 0.05) r.onStation.push(`${q.name} in ${p.name}`);
    });
  });
  // furniture into walls, windows, beams and posts: against a flat wall or a wall post the furniture's own frame (its
  // solids; a bed's fur tucks against them as in the game), against a brace, a window or a door what shows of both
  for (const i of furn) {
    if (!['bed', 'table', 'storage', 'seat', 'craft'].includes(role(pieces[i]))) continue;
    let deep = 0, what = '';
    for (const j of structVis) {
      const rj = role(pieces[j]), mine = FLAT.includes(rj) ? (sol[i].length ? sol[i] : vis[i]) : vis[i];
      const d = M.deepest(mine, vis[j]);
      if (d > deep) { deep = d; what = pieces[j].name; }
    }
    const msg = `${pieces[i].name} ${Math.round(deep * 100)} cm into ${what}`;
    if (deep > Math.max(0.15, (pieces[i].wclip || 0) + 0.005)) r.intoWall.push(msg); else if (deep > 0.05) r.intoWallSoft.push(msg);
  }
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


/**
 * Audit a set of designs. designs: { line: { stage: pieces } } where stage is 's1d1' to 's3d3' for a test pool's
 * lines, or 'one' for a design on its own. Gives the report: per line its nesting, shell kept per stage step, issues,
 * beds and storage; likeness of the home lines; totals; and the gate (measures above zero that fail the pool).
 */
function pool(input, name) {
  const designs = {};
  for (const [line, stages] of Object.entries(input)) {
    const keysOf = st => stages[st] ? new Set(stages[st].map(key)) : null;
    for (const [stage, pieces] of Object.entries(stages)) {
      const shell = /^s\dd[23]$/.test(stage) ? keysOf(stage.slice(0, 2) + 'd1') : null;
      (designs[line] = designs[line] || {})[stage] = { pieces, keys: new Set(pieces.map(key)), a: audit(pieces, shell) };
    }
  }
  const dir = name || '';
  const report = { pool: dir, designs: Object.values(designs).reduce((s, d) => s + Object.keys(d).length, 0), lines: {}, totals: {} };
  const MEASURES = ['furnClip', 'stacked', 'overWin', 'outside', 'stairFoot', 'stations', 'mountClip', 'hang', 'loose', 'doorway', 'onStation', 'intoWall', 'intoWallSoft'];
  const tot = Object.fromEntries([...MEASURES, 'nestBroken'].map(k => [k, 0]));
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
      for (const k of MEASURES) if (a[k].length) { found.push(`${k}: ${[...new Set(a[k])].slice(0, 4).join('; ')}${a[k].length > 4 ? ` (+${a[k].length - 4})` : ''}`); tot[k] += a[k].length; }
      if (found.length) L.issues[stage] = found;
    }
    L.beds = Object.fromEntries(['s1d1', 's2d1', 's3d1'].filter(s => d[s]).map(s => [s, d[s].a.beds]));
    if (/store|storage/.test(line)) L.storage = Object.fromEntries(Object.entries(d).map(([s, v]) => [s, `${v.a.chests} chests, ${v.a.chestsByWall} by a wall, ${v.a.chestsStacked} stacked, ${v.a.signs} signs`]));
  }
  report.totals = tot;
  // likeness of the home lines (furniture and arrangement); at d2 and d3 no two above 0.7 (d1 is beds and a chest in
  // every home by design)
  const homes = Object.keys(designs).filter(l => /home/.test(l));
  report.same = {};
  tot.homeAlike = 0;
  for (let i = 0; i < homes.length; i++) for (let j = i + 1; j < homes.length; j++) for (const st of ['s1d1', 's2d2', 's3d3']) {
    const A = designs[homes[i]][st], Bd = designs[homes[j]][st];
    if (!A || !Bd) continue;
    const v = likeness(A.pieces, Bd.pieces);
    report.same[`${homes[i]} and ${homes[j]} ${st}`] = v;
    if (st !== 's1d1' && v > 0.7) tot.homeAlike++;
  }

  // Richness (2026-11-10, lab/richness.js): how much of the corpus and the interior library reaches the pool, from the
  // files' '#VillheimSets' sections (lib/blueprint.js); pools written before them carry none and are not measured.
  // Per design, so a pool of a few lines or of another biome is judged the same way: distinct decor prefabs in each
  // d3 design, the share of d2 and d3 decor pieces that came in a set, and the corpus sets (mined and creative) in each
  // d3 design. Each has a floor a little under what the generator reaches; a pool under a floor fails.
  const rich = { d3: 0, prefabs: 0, decor: 0, fromSets: 0, corpusSets: 0 };
  for (const d of Object.values(designs)) for (const [stage, v] of Object.entries(d)) {
    if (!v.pieces.sets || !/d[23]$/.test(stage)) continue;
    const decor = v.pieces.filter(p => !structural(p) && !/^(Pickable|Placeable)_/.test(p.name));
    rich.decor += decor.length;
    rich.fromSets += Object.values(v.pieces.sets).reduce((a, b) => a + b, 0);
    if (/d3$/.test(stage)) {
      rich.d3++;
      rich.prefabs += new Set(decor.map(p => p.name)).size;
      rich.corpusSets += Object.keys(v.pieces.sets).filter(id => /^K[BC]-/.test(id)).length;
    }
  }
  tot.richness = 0;
  if (rich.d3) {
    report.rich = { prefabsPerD3: +(rich.prefabs / rich.d3).toFixed(1), setShare: +(rich.fromSets / Math.max(1, rich.decor)).toFixed(3), corpusSetsPerD3: +(rich.corpusSets / rich.d3).toFixed(2) };
    report.richLow = Object.entries(RICH_FLOOR).filter(([k, f]) => report.rich[k] < f).map(([k, f]) => `${k} ${report.rich[k]} under ${f}`);
    tot.richness = Object.keys(designs).length >= RICH_LINES ? report.richLow.length : 0;
  }
  report.failed = GATE.filter(k => tot[k] > 0);
  report.gate = report.failed.length ? 'fail' : 'pass';
  report.watch = Object.fromEntries(WATCH.map(k => [k, tot[k]]));
  return report;
}

// How alike two furnished designs are (1 = the same): the mean of their furniture lists (shared share of the piece
// counts) and their arrangement (each piece's kind, its place in thirds of the building's footprint and its facing in
// quarters). Two homes with the same kinds of furniture laid out differently score about half.
const ARR = ['bed', 'table', 'seat', 'storage', 'craft', 'fire', 'rug', 'light', 'deco', 'clutter'];
function signature(pieces) {
  const furn = {}, arr = {};
  const shell = pieces.filter(p => PC.piece(p.name).structural);
  const xs = shell.map(p => p.x), zs = shell.map(p => p.z);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  for (const p of pieces) {
    const r = role(p);
    if (!ARR.includes(r) || PC.piece(p.name).structural) continue;
    furn[p.name] = (furn[p.name] || 0) + 1;
    const q = p.q || [0, 0, 0, 1], yaw = Math.atan2(2 * (q[3] * q[1] + q[0] * q[2]), 1 - 2 * (q[1] * q[1] + q[0] * q[0])) * 180 / Math.PI;
    const k = `${r}|${Math.min(2, Math.floor(3 * (p.x - x0) / Math.max(0.1, x1 - x0)))}|${Math.min(2, Math.floor(3 * (p.z - z0) / Math.max(0.1, z1 - z0)))}|${Math.floor(p.y / 2.5)}|${((Math.round(yaw / 90) % 4) + 4) % 4}`;
    arr[k] = (arr[k] || 0) + 1;
  }
  return { furn, arr };
}
function jac(A, B) {
  let i = 0, u = 0;
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) { const a = A[k] || 0, b = B[k] || 0; i += Math.min(a, b); u += Math.max(a, b); }
  return u ? i / u : 1;
}
function likeness(a, b) {
  const A = a.furn ? a : signature(a), B = b.furn ? b : signature(b);
  return +((jac(A.furn, B.furn) + jac(A.arr, B.arr)) / 2).toFixed(2);
}

/** A short text of a report for the game's console: the gate, the totals and the first few issues of each failing measure. */
function summary(report, n = 3) {
  const t = report.totals, out = [];
  out.push(report.gate === 'pass' ? `pool audit: pass (${report.designs} designs)` : `pool audit: FAIL (${report.failed.map(k => `${k} ${t[k]}`).join(', ')})`);
  for (const k of report.failed) {
    const seen = [];
    for (const [line, L] of Object.entries(report.lines)) for (const [stage, list] of Object.entries(L.issues)) for (const x of list)
      if (x.startsWith(k + ':') && seen.length < n) seen.push(`${line} ${stage} ${x}`);
    for (const x of seen) out.push('  ' + x);
  }
  if (report.richLow && report.richLow.length) out.push(`  richness: ${report.richLow.join('; ')}`);
  if (report.rich) out.push(`richness: ${Object.entries(report.rich).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  out.push(`watched: ${Object.entries(report.watch).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  return out.join('\n');
}

/** Group blueprint files by name into the pool's lines: { fileName: text } to { line: { stage: pieces } }. */
function group(files, parse) {
  const out = {};
  for (const [f, text] of Object.entries(files)) {
    const m = f.match(/^(.*)_s(\d)d(\d)(\.blueprint)?$/);
    const [line, stage] = m ? [m[1], `s${m[2]}d${m[3]}`] : [f.replace(/\.blueprint$/, ''), 'one'];
    (out[line] = out[line] || {})[stage] = parse(text).pieces;
  }
  return out;
}

const apiA = { audit, pool, summary, group, likeness, signature, GATE, WATCH };
if (NODE_A) module.exports = apiA; else window.VHAudit = apiA;
