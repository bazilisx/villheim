// Repair a blueprint: find pieces that are missing from an otherwise regular structure and put them back.
// Only structural pieces are repaired (walls, floors, roofs, beams, posts, gables, stairs, fences); furniture is
// left alone. Every repair is a guess from the rest of the build, so each one carries a reason and a confidence.
//
// What it looks for, after turning the build so its main walls run along the axes:
//  1. Gaps in a row: the same piece, same turn, same height, on one line, with a gap of up to 3 pieces between
//     two that are there (walls, beams, roof rows, fences).
//  2. Gaps in a stack: the same piece at the same spot with a missing course between two that are there.
//  3. Holes in a floor: an empty cell with floor of the same kind on at least 3 of its 4 sides.
//  4. Mirror halves: when most of the build mirrors across a line (x or z), a piece whose mirror is missing and
//     whose mirror spot is empty is added. Pieces that only come in one hand (gable pieces, sloped beams, hip
//     corners) are turned the way the corpus turns their mirror images.

const NODE_R = typeof module !== 'undefined';
const PR = NODE_R ? require('./pieces.js') : window.VHPieces;

const R2D = 180 / Math.PI;
function yawOf(q) { const [x, y, z, w] = q || [0, 0, 0, 1]; return Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + x * x)) * R2D; }
function tilted(q) { return q && (Math.abs(q[0]) > 0.02 || Math.abs(q[2]) > 0.02); }
function quat(yaw) { const a = yaw * Math.PI / 360; return [0, +Math.sin(a).toFixed(6), 0, +Math.cos(a).toFixed(6)]; }
const n360 = a => ((a % 360) + 360) % 360;
const r2 = v => Math.round(v * 2) / 2;

// The angle the main walls run at, so the work can be done on a clean grid.
function mainAngle(pieces) {
  const c = new Map();
  for (const p of pieces) {
    const i = PR.piece(p.name);
    if (!i.structural || tilted(p.q)) continue;
    const a = Math.round(n360(yawOf(p.q)) % 90);
    c.set(a, (c.get(a) || 0) + 1);
  }
  let best = 0, n = -1;
  for (const [a, k] of c) if (k > n) { n = k; best = a; }
  return best;
}
function rot(x, z, a) { const t = a * Math.PI / 180; return [x * Math.cos(t) - z * Math.sin(t), x * Math.sin(t) + z * Math.cos(t)]; }

function repair(input, opts = {}) {
  const minConf = opts.minConfidence ?? 0.6;
  const a0 = mainAngle(input);
  // aligned copies: Unity's yaw a maps local (x, z) to (x cos a + z sin a, -x sin a + z cos a); undo a0 the same way
  const P = input.map((p, idx) => {
    const [x, z] = rot(p.x, p.z, a0);
    const info = PR.piece(p.name);
    return { idx, name: p.name, x, y: p.y, z, yaw: n360(Math.round(yawOf(p.q) - a0)), info, tilt: tilted(p.q), s: p.s };
  });
  const S = P.filter(p => p.info.structural && !p.tilt);
  const key = (name, x, y, z) => `${name}|${r2(x)}|${Math.round(y * 4) / 4}|${r2(z)}`;
  const have = new Set(S.map(p => key(p.name, p.x, p.y, p.z)));
  const occupied = (name, x, y, z) => have.has(key(name, x, y, z));
  // any structural piece of the same role close to a spot (to avoid putting a wall where a door or window stands)
  const byCell = new Map();
  for (const p of S) { const k = `${Math.round(p.x)}|${Math.round(p.z)}`; if (!byCell.has(k)) byCell.set(k, []); byCell.get(k).push(p); }
  const blocked = (role, x, y, z, rad = 0.6) => {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const o of byCell.get(`${Math.round(x) + dx}|${Math.round(z) + dz}`) || []) {
      const sameKind = o.info.role === role || (['wall', 'door', 'window', 'gable'].includes(o.info.role) && ['wall', 'door', 'window', 'gable'].includes(role));
      if (sameKind && Math.abs(o.x - x) < rad && Math.abs(o.z - z) < rad && Math.abs(o.y - y) < Math.max(0.4, o.info.size[1] / 2)) return true;
    }
    return false;
  };
  // how many existing structural pieces touch a box of this piece's size at this spot
  const neighbours = (x, y, z, info) => {
    const hx = info.size[0] / 2 + 0.3, hy = info.size[1] / 2 + 0.3, hz = Math.max(info.size[0], info.size[2]) / 2 + 0.3;
    let n = 0;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (const o of byCell.get(`${Math.round(x) + dx}|${Math.round(z) + dz}`) || [])
      if (Math.abs(o.x - x) < hx + o.info.size[0] / 2 && Math.abs(o.z - z) < hz + o.info.size[0] / 2 && Math.abs(o.y - y) < hy + o.info.size[1] / 2) n++;
    return n;
  };
  const found = new Map();
  const add = (name, x, y, z, yaw, reason, conf) => {
    const k = key(name, x, y, z);
    if (have.has(k)) return;
    const info = PR.piece(name);
    if (blocked(info.role, x, y, z)) return;
    const prev = found.get(k);
    if (!prev || prev.conf < conf) found.set(k, { name, x, y, z, yaw: n360(yaw), reason, conf });
  };

  // 1. gaps in rows: group by name, turn, height and the line across the piece's long axis
  const rows = new Map();
  for (const p of S) {
    if (!['wall', 'beam', 'roof', 'roofTop', 'fence', 'gable', 'floor'].includes(p.info.role)) continue;
    const along = (p.yaw % 180 === 0) ? 'x' : (p.yaw % 180 === 90 ? 'z' : null);
    if (!along) continue;
    const t = along === 'x' ? p.x : p.z, line = along === 'x' ? p.z : p.x;
    const k = `${p.name}|${p.yaw}|${Math.round(p.y * 4)}|${along}|${r2(line)}`;
    if (!rows.has(k)) rows.set(k, { along, line, y: p.y, yaw: p.yaw, name: p.name, ts: [] });
    rows.get(k).ts.push(t);
  }
  for (const r of rows.values()) {
    if (r.ts.length < 2) continue;
    const w = PR.piece(r.name).size[0];
    const step = w >= 3.9 ? 4 : w >= 1.9 ? 2 : (w >= 0.9 ? 1 : 0.5);
    const ts = [...new Set(r.ts.map(t => Math.round(t / step * 2) / 2 * step))].sort((a, b) => a - b);
    for (let i = 0; i + 1 < ts.length; i++) {
      const gap = ts[i + 1] - ts[i];
      const missing = Math.round(gap / step) - 1;
      if (missing < 1 || missing > 3 || Math.abs(gap - (missing + 1) * step) > 0.1) continue;
      if (missing > 1) continue; // wider gaps are doorways, windows and open bays far more often than damage
      const t = ts[i] + step;
      const [x, z] = r.along === 'x' ? [t, r.line] : [r.line, t];
      const role = PR.piece(r.name).role, h = PR.piece(r.name).size[1];
      let evidence = 0;
      if (role === 'roof') {
        // the rows up and down the slope at this spot (2 m along the facing, one rise up or down)
        const f = r.yaw * Math.PI / 180, fx = Math.sin(f) * 2, fz = Math.cos(f) * 2, rise = h;
        if (occupied(r.name, x - fx, r.y + rise, z - fz)) evidence++;
        if (occupied(r.name, x + fx, r.y - rise, z + fz)) evidence++;
      } else {
        if (occupied(r.name, x, r.y + h, z)) evidence++;
        if (occupied(r.name, x, r.y - h, z)) evidence++;
      }
      if (evidence >= 1) add(r.name, x, r.y, z, r.yaw, `gap in a row of ${r.name}`, evidence === 2 ? 0.92 : 0.8);
    }
  }

  // 2. gaps in stacks
  const stacks = new Map();
  for (const p of S) {
    if (!['wall', 'pole', 'gable'].includes(p.info.role)) continue;
    const k = `${p.name}|${p.yaw % 180}|${r2(p.x)}|${r2(p.z)}`;
    if (!stacks.has(k)) stacks.set(k, { name: p.name, x: p.x, z: p.z, yaw: p.yaw, ys: [] });
    stacks.get(k).ys.push(p.y);
  }
  for (const st of stacks.values()) {
    if (st.ys.length < 2) continue;
    const h = PR.piece(st.name).size[1];
    const ys = [...new Set(st.ys.map(y => Math.round(y * 4) / 4))].sort((a, b) => a - b);
    for (let i = 0; i + 1 < ys.length; i++) {
      const gap = ys[i + 1] - ys[i], missing = Math.round(gap / h) - 1;
      if (missing !== 1 || Math.abs(gap - 2 * h) > 0.1) continue;
      const y = ys[i] + h, w = PR.piece(st.name).size[0];
      const a = st.yaw * Math.PI / 180, ux = Math.cos(a) * w, uz = -Math.sin(a) * w;
      const sides = (occupied(st.name, st.x + ux, y, st.z + uz) ? 1 : 0) + (occupied(st.name, st.x - ux, y, st.z - uz) ? 1 : 0);
      if (PR.piece(st.name).role === 'pole' || sides >= 1) add(st.name, st.x, y, st.z, st.yaw, `gap in a stack of ${st.name}`, sides === 2 || PR.piece(st.name).role === 'pole' ? 0.9 : 0.75);
    }
  }

  // 3. holes in floors (2 m grid per level and kind)
  const levels = new Map();
  for (const p of S) {
    if (p.info.role !== 'floor' || p.info.size[0] < 1.9) continue;
    const k = `${Math.round(p.y * 4)}`;
    if (!levels.has(k)) levels.set(k, { y: p.y, cells: new Map() });
    levels.get(k).cells.set(`${r2(p.x)}|${r2(p.z)}`, p);
  }
  for (const lv of levels.values()) {
    const cand = new Map();
    for (const p of lv.cells.values()) for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
      const x = r2(p.x + dx), z = r2(p.z + dz), k = `${x}|${z}`;
      if (lv.cells.has(k)) continue;
      if (!cand.has(k)) cand.set(k, { x, z, n: [] });
      cand.get(k).n.push(p);
    }
    for (const c of cand.values()) {
      if (c.n.length < 3) continue;
      const names = new Map(); for (const p of c.n) names.set(p.name, (names.get(p.name) || 0) + 1);
      const name = [...names.entries()].sort((a, b) => b[1] - a[1])[0][0];
      add(name, c.x, lv.y, c.z, c.n[0].yaw, 'hole in a floor', c.n.length === 4 ? 0.95 : 0.55);
    }
  }

  // 4. mirror halves
  const mirror = findMirror(S);
  if (mirror && mirror.score >= 0.86) {
    // mirrored pieces can stand on one another inside a missing part, so count them as neighbours too
    const M = [];
    for (const p of S) {
      const m = mirrorOf(p, mirror);
      if (occupied(p.name, m.x, p.y, m.z)) continue;
      M.push({ p, m, info: p.info, x: m.x, y: p.y, z: m.z });
    }
    for (const c of M) { const k = `${Math.round(c.x)}|${Math.round(c.z)}`; if (!byCell.has(k)) byCell.set(k, []); }
    const extra = new Map();
    for (const c of M) { const k = `${Math.round(c.x)}|${Math.round(c.z)}`; if (!extra.has(k)) extra.set(k, []); extra.get(k).push(c); }
    for (const c of M) {
      let touching = neighbours(c.x, c.y, c.z, c.info);
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (const o of extra.get(`${Math.round(c.x) + dx}|${Math.round(c.z) + dz}`) || [])
        if (o !== c && Math.abs(o.x - c.x) < 2.3 && Math.abs(o.z - c.z) < 2.3 && Math.abs(o.y - c.y) < 2.3) touching++;
      if (touching < 3) continue; // a lone mirror piece out in the open is more often a real difference
      add(c.p.name, c.x, c.y, c.z, c.m.yaw, `mirror of the other half across ${mirror.axis} = ${mirror.c}`, Math.min(0.9, mirror.score) * (touching >= 5 ? 1 : 0.85));
    }
  }

  // 5. patterns from the build itself: for every kind of piece, which neighbour it nearly always has and where
  //    (offset and turn in its own frame). Where several pieces expect the same neighbour at the same spot and
  //    nothing is there, that neighbour is missing.
  patternVotes(S, occupied, blocked).forEach(v => add(v.name, v.x, v.y, v.z, v.yaw, `pattern of the build (${v.voters} pieces expect it)`, v.conf));

  const ruleOf = r => /^gap in a row/.test(r) ? 'rows' : /^gap in a stack/.test(r) ? 'stacks' : /^hole/.test(r) ? 'floors' : /^mirror/.test(r) ? 'mirror' : 'pattern';
  const on = opts.rules || { rows: true, stacks: true, floors: true, mirror: true, pattern: true };
  const repairs = [...found.values()].filter(r => r.conf >= minConf && on[ruleOf(r.reason)]);
  // back to the build's own angle
  const added = repairs.map(r => {
    const [x, z] = rot(r.x, r.z, -a0);
    const yaw = n360(r.yaw + a0);
    return { name: r.name, cat: 'Building', x: +x.toFixed(3), y: +r.y.toFixed(3), z: +z.toFixed(3), q: quat(yaw), yaw, repaired: true, reason: r.reason, confidence: +r.conf.toFixed(2) };
  });
  const byReason = {};
  for (const r of added) { const k = r.reason.replace(/ of [A-Za-z0-9_]+$/, '').replace(/ = .*/, ''); byReason[k] = (byReason[k] || 0) + 1; }
  return { pieces: [...input, ...added], added, mirror, angle: a0, summary: byReason };
}

function patternVotes(S, occupied, blocked) {
  const q4 = v => Math.round(v * 4) / 4;
  const cls = p => `${p.name}|${p.yaw % 90}`; // same piece, same turn up to quarter turns
  const grid = new Map();
  for (const p of S) { const k = `${Math.floor(p.x / 3)}|${Math.floor(p.z / 3)}`; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(p); }
  const near = p => { const out = []; const gx = Math.floor(p.x / 3), gz = Math.floor(p.z / 3);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const o of grid.get(`${gx + dx}|${gz + dz}`) || [])
      if (o !== p && Math.abs(o.x - p.x) <= 2.6 && Math.abs(o.z - p.z) <= 2.6 && Math.abs(o.y - p.y) <= 2.6) out.push(o);
    return out; };
  const local = (a, o) => { const t = -a.yaw * Math.PI / 180, dx = o.x - a.x, dz = o.z - a.z;
    return [q4(dx * Math.cos(t) + dz * Math.sin(t)), q4(o.y - a.y), q4(-dx * Math.sin(t) + dz * Math.cos(t)), ((o.yaw - a.yaw) % 360 + 360) % 360]; };
  const toWorld = (a, lx, ly, lz, ry) => { const t = a.yaw * Math.PI / 180;
    return [a.x + lx * Math.cos(t) + lz * Math.sin(t), a.y + ly, a.z - lx * Math.sin(t) + lz * Math.cos(t), (a.yaw + ry) % 360]; };
  // count rules
  const total = new Map(), rules = new Map();
  for (const a of S) {
    const ca = cls(a); total.set(ca, (total.get(ca) || 0) + 1);
    const seen = new Set();
    for (const o of near(a)) {
      const [lx, ly, lz, ry] = local(a, o), k = `${ca}>${o.name}|${lx}|${ly}|${lz}|${ry}`;
      if (seen.has(k)) continue; seen.add(k);
      rules.set(k, (rules.get(k) || 0) + 1);
    }
  }
  // strong rules: seen with at least 5 pieces and for at least 85 % of the pieces of that kind
  const strong = new Map();
  for (const [k, n] of rules) {
    const ca = k.split('>')[0], tot = total.get(ca);
    if (n >= 5 && n / tot >= 0.85) { if (!strong.has(ca)) strong.set(ca, []); strong.get(ca).push({ k, conf: n / tot }); }
  }
  // votes
  const votes = new Map();
  for (const a of S) {
    for (const r of strong.get(cls(a)) || []) {
      const [, tgt] = r.k.split('>'); const [name, lx, ly, lz, ry] = tgt.split('|');
      const [x, y, z, yaw] = toWorld(a, +lx, +ly, +lz, +ry);
      if (occupied(name, x, y, z)) continue;
      const vk = `${name}|${Math.round(x * 2)}|${Math.round(y * 4)}|${Math.round(z * 2)}`;
      if (!votes.has(vk)) votes.set(vk, { name, x, y, z, yaw, voters: 0, conf: 0, from: new Set() });
      const v = votes.get(vk);
      if (!v.from.has(a)) { v.from.add(a); v.voters++; v.conf = Math.max(v.conf, r.conf); }
    }
  }
  const out = [];
  for (const v of votes.values()) {
    if (v.voters < 2) continue;
    if (blocked(PR.piece(v.name).role, v.x, v.y, v.z)) continue;
    out.push({ ...v, conf: Math.min(0.95, v.conf * (v.voters >= 4 ? 1 : v.voters === 3 ? 0.95 : 0.85)) });
  }
  return out;
}

// Pieces that come in one hand: how their turn changes in a mirror (see docs/BLUEPRINT_LAB.md, measured conventions).
function mirrorYaw(p, axis) {
  const s = p.info.shape, y = p.yaw;
  const alongX = s === 'tri' || s === 'triInv' || /^beam\d/.test(s); // rise along local +x
  const corner = /^hipcorner/.test(s);
  if (axis === 'x') return corner ? 270 - y : alongX ? 180 - y : -y;
  return corner ? 90 - y : alongX ? -y : 180 - y;
}
function mirrorOf(p, m) {
  return m.axis === 'x' ? { x: 2 * m.c - p.x, z: p.z, yaw: n360(mirrorYaw(p, 'x')) } : { x: p.x, z: 2 * m.c - p.z, yaw: n360(mirrorYaw(p, 'z')) };
}
// Try every mirror line on a half-metre grid across the build, on both axes. A line is scored on the pieces whose
// mirror spot lies inside the part of the build that is still there (the rest may be the missing part): the share
// of those that do have their mirror. Lines with too few such pieces are skipped. Works when a whole side is gone.
function findMirror(S) {
  if (S.length < 20) return null;
  const set = new Set(S.map(p => `${p.name}|${r2(p.x)}|${Math.round(p.y * 4)}|${r2(p.z)}`));
  let best = null;
  for (const axis of ['x', 'z']) {
    const vs = S.map(p => axis === 'x' ? p.x : p.z).sort((a, b) => a - b);
    const lo = vs[Math.floor(vs.length * 0.01)], hi = vs[Math.floor(vs.length * 0.99)];
    for (let c = Math.round(lo * 2) / 2; c <= hi; c += 0.5) {
      let hit = 0, checkable = 0;
      for (const p of S) {
        const m = mirrorOf(p, { axis, c });
        const v = axis === 'x' ? m.x : m.z;
        if (v < lo - 0.5 || v > hi + 0.5) continue;
        checkable++;
        if (set.has(`${p.name}|${r2(m.x)}|${Math.round(p.y * 4)}|${r2(m.z)}`)) hit++;
      }
      if (checkable < Math.max(20, S.length * 0.5)) continue;
      const score = hit / checkable;
      const rank = score + 0.1 * (checkable / S.length); // prefer lines that explain more of the build
      if (!best || rank > best.rank) best = { axis, c, score: +score.toFixed(3), rank, checkable };
    }
  }
  return best;
}

// Take out some structural pieces at random (for testing how much the repair finds again).
function damage(pieces, share, seed = 1) {
  let s = seed >>> 0 || 1;
  const R = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const kept = [], removed = [];
  for (const p of pieces) {
    const i = PR.piece(p.name);
    if (i.structural && !tilted(p.q) && R() < share) removed.push(p); else kept.push(p);
  }
  return { kept, removed };
}

const apiR = { repair, damage, findMirror };
if (NODE_R) module.exports = apiR; else window.VHRepair = apiR;
