// Checks on a design: every piece supported, no doubled or crushed pieces, doors you can walk through, headroom
// under roofs and ceilings, ladders and stairs you can climb, materials the biome has, and room left to move inside.
// Rough, from piece boxes and the measured shapes of roofs, doors and ladders; good for catching mistakes.

const NODE_C = typeof module !== 'undefined';
const PC = NODE_C ? require('./pieces.js') : window.VHPieces;

// A player is about 1.8 m tall. Walkable rooms need 2.4 m clear under every roof and ceiling piece; a doorway needs its
// own height, and 2.3 m in front of it and behind it, for a metre each way.
const HEADROOM = 2.4, DOOR_CLEAR = 2.3, CORRIDOR = 1.0, WALL_MIN = 2.5;

function yawOf(q) { const [x, y, z, w] = q || [0, 0, 0, 1]; return Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + x * x)) * 180 / Math.PI; }
function tilted(q) { return q && (Math.abs(q[0]) > 0.02 || Math.abs(q[2]) > 0.02); }
function yawDeg(p) { return p.yaw != null ? p.yaw : yawOf(p.q); }

// A point in a piece's own frame: u along its local x, v along its local z.
function localOf(p, x, z) {
  const a = yawDeg(p) * Math.PI / 180, dx = x - p.x, dz = z - p.z;
  return [dx * Math.cos(a) - dz * Math.sin(a), dx * Math.sin(a) + dz * Math.cos(a)];
}

function aabb(p) {
  const info = PC.piece(p.name);
  let [w, h, d] = info.size;
  const s = p.s || [1, 1, 1];
  w *= s[0]; h *= s[1]; d *= s[2];
  if (info.role === 'door' && !tilted(p.q)) {
    const o = PC.doorOpening(p), hw = o.w / 2, ex = Math.abs(o.ux) * hw + Math.abs(o.nx) * 0.1, ez = Math.abs(o.uz) * hw + Math.abs(o.nz) * 0.1;
    return { x0: o.x - ex, x1: o.x + ex, y0: o.y, y1: o.y + o.h, z0: o.z - ez, z1: o.z + ez, info };
  }
  const a = yawDeg(p) * Math.PI / 180, c = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a));
  const ex = (w * c + d * sn) / 2, ez = (w * sn + d * c) / 2;
  const prop = info.shape === 'prop' || info.shape === 'cap' || info.shape === 'tri' || info.shape === 'triInv';
  let y0 = prop ? p.y : p.y - h / 2, y1 = prop ? p.y + h : p.y + h / 2;
  if (info.shape === 'slope26') { y0 = p.y - 0.15; y1 = p.y + h; }
  const climb = info.role === 'stair' && PC.climbSpec(p.name);
  if (climb && (info.shape === 'stair' || info.shape === 'ladder')) { y0 = p.y + climb.bottom; y1 = y0 + climb.rise; }
  if (tilted(p.q)) { const m = Math.max(w, h, d) / 2; return { x0: p.x - m, x1: p.x + m, y0: p.y - m, y1: p.y + m, z0: p.z - m, z1: p.z + m, info }; }
  return { x0: p.x - ex, x1: p.x + ex, y0, y1, z0: p.z - ez, z1: p.z + ez, info };
}

// Height of the underside of a roof or ceiling piece over a world point, or null when the piece is not over it.
// Roof pieces run 2 m along their local z and rise toward local -z; a 26 degree piece pivots on its low edge, a 45
// degree one in its middle (BLUEPRINT_LAB.md). Hip corners are taken at their low edge, ridge caps 0.3 m below
// their pivot, floors and level beams at the bottom of their box.
function underside(p, x, z, info) {
  info = info || PC.piece(p.name);
  if (tilted(p.q)) return null;
  const sh = info.shape, s = p.s || [1, 1, 1];
  const w = info.size[0] * s[0], h = info.size[1] * s[1], d = info.size[2] * s[2];
  const roofish = ['roof', 'roofTop', 'roofCorner'].includes(info.role);
  const level = info.role === 'floor' || (info.role === 'beam' && sh === 'box');
  if (!roofish && !level) return null;
  const [u, v] = localOf(p, x, z);
  if (Math.abs(u) > w / 2 + 0.01 || Math.abs(v) > d / 2 + 0.01) return null;
  if (level) return p.y - h / 2;
  if (sh === 'cap') return p.y - 0.3;
  if (sh === 'hipcorner26' || sh === 'hipcorner45') return p.y - 0.1;
  if (sh === 'slope26') return p.y + h * (d / 2 - v) / d - 0.1;
  if (sh === 'slope45' || sh === 'slope67') return p.y - h * v / d - 0.1;
  return p.y - 0.1;
}

// Grid of boxes for fast neighbour search.
function index(boxes) {
  const g = new Map(), k = (i, j) => i * 100003 + j;
  boxes.forEach((b, n) => {
    for (let i = Math.floor(b.x0 / 2); i <= Math.floor(b.x1 / 2); i++) for (let j = Math.floor(b.z0 / 2); j <= Math.floor(b.z1 / 2); j++) {
      const key = k(i, j); if (!g.has(key)) g.set(key, []); g.get(key).push(n);
    }
  });
  return b => {
    const out = new Set();
    for (let i = Math.floor(b.x0 / 2) - 1; i <= Math.floor(b.x1 / 2) + 1; i++) for (let j = Math.floor(b.z0 / 2) - 1; j <= Math.floor(b.z1 / 2) + 1; j++) for (const n of g.get(k(i, j)) || []) out.add(n);
    return out;
  };
}
const touch = (a, b, e) => a.x0 <= b.x1 + e && b.x0 <= a.x1 + e && a.y0 <= b.y1 + e && b.y0 <= a.y1 + e && a.z0 <= b.z1 + e && b.z0 <= a.z1 + e;
const vol = a => Math.max(0, a.x1 - a.x0) * Math.max(0, a.y1 - a.y0) * Math.max(0, a.z1 - a.z0);
function inter(a, b) {
  return Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));
}
const ptBox = (x, y0, y1, z, r = 0.05) => ({ x0: x - r, x1: x + r, y0, y1, z0: z - r, z1: z + r });

// Walls on a 0.25 m grid, for "is this point inside walls" and "is it right against a wall".
const WALLISH = ['wall', 'door', 'window', 'gable'];
function wallGrid(pieces, boxes) {
  const g = new Map(), key = (i, j) => i * 100003 + j;
  pieces.forEach((p, n) => {
    const b = boxes[n];
    if (!WALLISH.includes(b.info.role) || tilted(p.q)) return;
    const s = p.s || [1, 1, 1], w = b.info.size[0] * s[0], d = Math.max(0.2, b.info.size[2] * s[2]);
    for (let i = Math.round(b.x0 * 4); i <= Math.round(b.x1 * 4); i++) for (let j = Math.round(b.z0 * 4); j <= Math.round(b.z1 * 4); j++) {
      const [u, v] = localOf(p, i / 4, j / 4);
      if (b.info.role !== 'door' && (Math.abs(u) > w / 2 + 0.13 || Math.abs(v) > d / 2 + 0.13)) continue;
      const k = key(i, j);
      if (!g.has(k)) g.set(k, []);
      g.get(k).push([b.y0, b.y1, w]);
    }
  });
  const at = (x, z, y, minW = 0) => (g.get(key(Math.round(x * 4), Math.round(z * 4))) || []).some(([a, c, w]) => a <= y && y <= c && w >= minW);
  return {
    at,
    // walls on all four sides within 14 m
    inside(x, y, z) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        let hit = false;
        // at knee and chest height, so a window opening does not count as a way out
        for (let t = 0.25; t <= 14; t += 0.25) if (at(x + dx * t, z + dz * t, y + 0.6) || at(x + dx * t, z + dz * t, y + 1.2)) { hit = true; break; }
        if (!hit) return false;
      }
      return true;
    },
    near(x, y, z, r, h = 1.2, minW = 0) {
      for (let dx = -r; dx <= r + 0.001; dx += 0.25) for (let dz = -r; dz <= r + 0.001; dz += 0.25) if (at(x + dx, z + dz, y + h, minW)) return true;
      return false;
    },
  };
}

// Floor points a person walks on: 0.5 m apart on top of every floor piece (and stair landing), with the floor's top.
function floorPoints(pieces, boxes) {
  const pts = [];
  pieces.forEach((p, n) => {
    const b = boxes[n];
    if (b.info.role !== 'floor' || tilted(p.q)) return;
    const s = p.s || [1, 1, 1], w = b.info.size[0] * s[0], d = b.info.size[2] * s[2];
    const a = yawDeg(p) * Math.PI / 180, lx = [Math.cos(a), -Math.sin(a)], lz = [Math.sin(a), Math.cos(a)];
    for (let u = -w / 2 + 0.25; u < w / 2; u += 0.5) for (let v = -d / 2 + 0.25; v < d / 2; v += 0.5)
      pts.push({ x: p.x + lx[0] * u + lz[0] * v, z: p.z + lx[1] * u + lz[1] * v, y: b.y1, floor: n });
  });
  return pts;
}

// The space a person needs to walk through a door: its opening, then 2.3 m up for a metre in front and behind.
// Returns the pieces in the way (indices).
function doorBlockers(o, pieces, boxes, near, skip) {
  const out = new Set();
  const hw = 0.45;
  for (let s = -CORRIDOR; s <= CORRIDOR + 0.001; s += 0.2) {
    const inPlane = Math.abs(s) < 0.55;
    const yLo = o.y + 0.25, yHi = o.y + (inPlane ? Math.min(o.h, DOOR_CLEAR) - 0.05 : DOOR_CLEAR);
    for (let t = -hw; t <= hw + 0.001; t += hw / 2) {
      const x = o.x + o.nx * s + o.ux * t, z = o.z + o.nz * s + o.uz * t;
      const col = ptBox(x, yLo, yHi, z);
      for (const j of near(col)) {
        if (skip && skip(j)) continue;
        const b = boxes[j], role = b.info.role;
        if (['floor', 'rug', 'door', 'stair', 'nature', 'misc'].includes(role)) continue;
        const u = underside(pieces[j], x, z, b.info);
        if (u != null) { if (u > yLo && u < yHi) out.add(j); continue; }
        if (role === 'beam' && b.info.shape !== 'box') continue; // braces lie in the wall beside the door
        if (touch(col, b, -0.02)) {
          // walls and gables over the opening, in its own wall, are its lintel
          if (inPlane && WALLISH.includes(role) && b.y0 >= o.y + o.h - 0.06) continue;
          out.add(j);
        }
      }
    }
  }
  return [...out];
}

// Ladder and stair pieces as lines: bottom and top points and the climbing direction.
function climbs(pieces) {
  const out = [];
  pieces.forEach((p, n) => {
    const info = PC.piece(p.name);
    if (info.role !== 'stair') return;
    const c = PC.climbSpec(p.name);
    if (!c || /spiral/.test(p.name)) return;
    const a = yawDeg(p) * Math.PI / 180, dx = -Math.sin(a), dz = -Math.cos(a), half = c.run / 2;
    const y0 = p.y + c.bottom;
    out.push({ n, p, dx, dz, bx: p.x - dx * half, bz: p.z - dz * half, by: y0, tx: p.x + dx * half, tz: p.z + dz * half, ty: y0 + c.rise, run: c.run, rise: c.rise });
  });
  // a piece continues another when its end lies on the other's line (stacked ladders, long stairs)
  const onLine = (L, x, y, z, lo, hi) => {
    const t = (x - L.bx) * L.dx + (z - L.bz) * L.dz, px = L.bx + L.dx * t, pz = L.bz + L.dz * t;
    return t > lo && t < hi && Math.hypot(px - x, pz - z) < 0.3 && Math.abs(L.by + t * L.rise / L.run - y) < 0.3;
  };
  for (const L of out) {
    const par = out.filter(M => M !== L && M.dx * L.dx + M.dz * L.dz > 0.9);
    L.continuesBelow = par.some(M => onLine(M, L.bx, L.by, L.bz, 0.05, M.run + 0.05));
    L.continuesAbove = par.some(M => onLine(M, L.tx, L.ty, L.tz, -0.05, M.run - 0.05));
  }
  return out;
}

function check(design, biome) {
  const pieces = design.pieces;
  const boxes = pieces.map(aabb);
  const near = index(boxes);
  const ys = boxes.filter(b => b.info.structural).map(b => b.y0).sort((a, b) => a - b);
  const ground = design.ground != null ? design.ground : ys.length ? ys[Math.floor(ys.length * 0.02)] : 0;
  const results = [];

  // support: Valheim holds a piece up through any touching piece that is itself held up, back to the ground.
  // Walk outward from everything that stands on the ground; whatever is never reached floats.
  const held = new Array(boxes.length).fill(false), queue = [];
  boxes.forEach((b, i) => { if (b.y0 <= ground + 0.35) { held[i] = true; queue.push(i); } });
  while (queue.length) {
    const i = queue.pop(), b = boxes[i];
    for (const j of near(b)) {
      if (held[j]) continue;
      const o = boxes[j];
      if (touch(b, o, 0.16) && (b.info.structural || o.info.role === 'craft' || o.info.role === 'deco' || o.info.role === 'light')) { held[j] = true; queue.push(j); }
    }
  }
  const unsupported = pieces.filter((p, i) => !held[i] && (boxes[i].info.structural || ['craft', 'storage', 'bed', 'table', 'seat', 'fire'].includes(boxes[i].info.role))).map(p => p.name);
  results.push({ check: 'support', ok: unsupported.length === 0, detail: unsupported.length ? `${unsupported.length} pieces not connected to the ground (${[...new Set(unsupported)].slice(0, 4).join(', ')})` : 'every piece connects to the ground' });

  // doubles and crushed pieces
  let doubles = 0, crushed = 0;
  const seen = new Map();
  pieces.forEach((p, i) => {
    const key = `${p.name}|${p.x.toFixed(1)}|${p.y.toFixed(1)}|${p.z.toFixed(1)}|${Math.round(yawOf(p.q))}`;
    if (seen.has(key)) doubles++; else seen.set(key, i);
    const b = boxes[i];
    if (!b.info.structural || ['roof', 'roofTop', 'roofCorner', 'gable', 'beam', 'pole', 'stair'].includes(b.info.role)) return;
    for (const j of near(b)) {
      if (j <= i) continue;
      const o = boxes[j];
      if (o.info.role !== b.info.role || !o.info.structural) continue;
      const v = inter(b, o), m = Math.min(vol(b), vol(o));
      if (m > 0.05 && v / m > 0.6 && pieces[j].name !== p.name) crushed++;
    }
  });
  results.push({ check: 'overlap', ok: doubles === 0 && crushed <= 2, detail: `${doubles} doubled, ${crushed} pieces inside another of the same kind` });

  // doors: nothing in the doorway or in the metre in front and behind it up to 2.3 m, and something to step on
  const doors = pieces.map((p, i) => i).filter(i => boxes[i].info.role === 'door');
  const blockedBy = new Set();
  let blocked = 0, noStep = 0;
  const pts = floorPoints(pieces, boxes);
  const standAt = (x, y, z) => {
    if (y <= ground + 0.6) return true;
    const col = ptBox(x, y - 0.7, y + 0.3, z, 0.3);
    for (const j of near(col)) {
      const b = boxes[j];
      if (!['floor', 'stair'].includes(b.info.role) && !(b.info.role === 'wall' && b.y1 <= y + 0.05)) continue;
      if (touch(col, b, 0)) return true;
    }
    return false;
  };
  for (const i of doors) {
    const o = PC.doorOpening(pieces[i]);
    const hit = doorBlockers(o, pieces, boxes, near, j => j === i);
    if (hit.length) { blocked++; hit.forEach(j => blockedBy.add(pieces[j].name)); }
    for (const sg of [-1, 1]) if (!standAt(o.x + o.nx * sg * 0.9, o.y, o.z + o.nz * sg * 0.9)) noStep++;
  }
  results.push({ check: 'doors', ok: blocked === 0 && noStep === 0,
    detail: doors.length ? `${doors.length} doors, ${blocked} blocked${blockedBy.size ? ` (${[...blockedBy].slice(0, 4).join(', ')})` : ''}, ${noStep} sides with nothing to step on` : 'no doors (open building)' });

  // headroom: every floor point inside walls has 2.4 m clear under roofs, ceilings and beams; points right against a
  // wall are left out (nobody stands in the wall)
  const walls = wallGrid(pieces, boxes);
  let low = 0, inside = 0;
  const lowBy = new Set(), where = [];
  for (const pt of pts) {
    if (!walls.inside(pt.x, pt.y, pt.z) || walls.near(pt.x, pt.y, pt.z, 0.45)) continue;
    // the lowest roof or ceiling over the point; a floor open to the sky (a roof terrace, a yard) is left out
    const col = ptBox(pt.x, pt.y + 0.05, pt.y + 30, pt.z);
    let lowest = Infinity, by = null;
    for (const j of near(col)) {
      if (j === pt.floor) continue;
      const u = underside(pieces[j], pt.x, pt.z, boxes[j].info);
      if (u != null && u > pt.y + 0.05 && u < lowest) { lowest = u; by = pieces[j].name; }
    }
    if (!isFinite(lowest)) continue;
    inside++;
    let bad = lowest < pt.y + HEADROOM - 0.01 ? by : null;
    // walls at least 2.5 m tall: a point beside a wall needs wall at that height too (from the floor piece's middle)
    if (!bad && walls.near(pt.x, pt.y, pt.z, 1.0, 0.6, 1.9) && !walls.near(pt.x, pt.y - 0.15, pt.z, 1.6, WALL_MIN - 0.05)) bad = 'walls under 2.5 m';
    if (bad) { low++; lowBy.add(bad); if (where.length < 6) where.push({ x: +pt.x.toFixed(2), y: +pt.y.toFixed(2), z: +pt.z.toFixed(2), under: bad }); }
  }
  results.push({ check: 'headroom', ok: low === 0, where,
    detail: low ? `${low} of ${inside} floor points under ${HEADROOM} m or by low walls (${[...lowBy].slice(0, 4).join(', ')})` : `${inside} floor points inside, all with ${HEADROOM} m or more and walls of ${WALL_MIN} m or more` });

  // ladders and stairs: room to stand at the foot, a floor to step onto at the top, and the climb itself clear
  const ls = climbs(pieces);
  const climbIdx = new Set(ls.map(L => L.n));
  const problems = [];
  for (const L of ls) {
    const name = L.p.name;
    if (!L.continuesBelow) {
      // a metre of clear floor (or ground) in front of the foot
      let clear = true;
      for (let t = 0.2; t <= 1.0 + 0.001; t += 0.4) {
        const x = L.bx - L.dx * t, z = L.bz - L.dz * t;
        if (!standAt(x, L.by + 0.05, z)) clear = false;
        const col = ptBox(x, L.by + 0.3, L.by + 1.8, z, 0.3);
        for (const j of near(col)) {
          if (climbIdx.has(j)) continue;
          const b = boxes[j];
          if (['floor', 'rug', 'nature', 'misc'].includes(b.info.role)) continue;
          const u = underside(pieces[j], x, z, b.info);
          if (u != null ? u > col.y0 && u < col.y1 : touch(col, b, -0.02)) { clear = false; break; }
        }
      }
      if (!clear) problems.push(`${name}: no room at the foot`);
    }
    if (!L.continuesAbove) {
      const x = L.tx + L.dx * 0.5, z = L.tz + L.dz * 0.5;
      if (!standAt(x, L.ty + 0.1, z)) problems.push(`${name}: nothing to step onto at the top`);
    }
    // head room along the climb: nothing over the steps lower than 1.9 m above them
    let hit = null;
    for (let t = 0.25; t <= L.run - 0.25 + 0.001 && !hit; t += 0.25) {
      const x = L.bx + L.dx * t, z = L.bz + L.dz * t, y = L.by + t * L.rise / L.run;
      const col = ptBox(x, y + 0.3, y + 1.9, z, 0.23);
      for (const j of near(col)) {
        if (climbIdx.has(j)) continue;
        const b = boxes[j];
        if (!b.info.structural || ['door', 'stair'].includes(b.info.role)) continue;
        if (b.info.role === 'floor' && b.y1 <= y + 0.35) continue; // the landing at the top
        const u = underside(pieces[j], x, z, b.info);
        if (u != null ? u > col.y0 && u < col.y1 : touch(col, b, -0.02)) { hit = pieces[j].name; break; }
      }
    }
    if (hit) problems.push(`${name}: ${hit} over the climb`);
  }
  results.push({ check: 'ladders', ok: problems.length === 0,
    detail: ls.length ? (problems.length ? `${problems.length} problems: ${[...new Set(problems)].slice(0, 3).join('; ')}` : `${ls.length} ladder and stair pieces, all climbable`) : 'no ladders or stairs' });

  // woodpiles stand outside: none under a roof inside walls
  const piles = pieces.filter((p, i) => /^wood_(fine_|core_)?stack$/.test(p.name) && walls.inside(p.x, p.y, p.z) &&
    [...near(ptBox(p.x, p.y + 0.5, p.y + 30, p.z))].some(j => j !== i && (underside(pieces[j], p.x, p.z, boxes[j].info) ?? -1) > p.y + 0.5));
  results.push({ check: 'woodpiles', ok: piles.length === 0, detail: piles.length ? `${piles.length} woodpiles indoors` : 'no woodpiles indoors' });

  // materials for the biome, building pieces and furnishing alike
  if (biome) {
    const ord = PC.BIOME_ORDER, limit = ord.indexOf(biome);
    const over = [...new Set(pieces.filter(p => ord.indexOf(PC.needs(p.name)) > limit).map(p => p.name))];
    results.push({ check: 'materials', ok: over.length === 0, detail: over.length ? `needs later biomes: ${over.slice(0, 5).join(', ')}` : `all pieces available in ${biome}` });
  }

  // room to move: share of floor not covered by furniture
  const floors = boxes.filter(b => b.info.role === 'floor');
  const furn = boxes.filter(b => ['bed', 'table', 'seat', 'storage', 'craft', 'fire', 'clutter', 'deco'].includes(b.info.role) && b.y0 < b.y1);
  let area = 0, used = 0;
  for (const f of floors) {
    const fa = (f.x1 - f.x0) * (f.z1 - f.z0); area += fa;
    for (const u of furn) if (u.y0 >= f.y1 - 0.3 && u.y0 <= f.y1 + 0.5) used += Math.max(0, Math.min(f.x1, u.x1) - Math.max(f.x0, u.x0)) * Math.max(0, Math.min(f.z1, u.z1) - Math.max(f.z0, u.z0));
  }
  const free = area ? 1 - used / area : 1;
  results.push({ check: 'space', ok: free >= 0.45, detail: `${Math.round(free * 100)} % of the floor is free to walk` });
  return results;
}

const apiC = { check, aabb, underside, localOf, doorBlockers, index, HEADROOM, DOOR_CLEAR, CORRIDOR };
if (NODE_C) module.exports = apiC; else window.VHChecks = apiC;
