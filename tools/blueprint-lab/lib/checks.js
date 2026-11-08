// Checks on a design: every piece supported, no doubled or crushed pieces, doors you can walk through,
// materials the biome has, and room left to move inside. Rough, from piece boxes; good for catching mistakes.

const NODE_C = typeof module !== 'undefined';
const PC = NODE_C ? require('./pieces.js') : window.VHPieces;

function yawOf(q) { const [x, y, z, w] = q || [0, 0, 0, 1]; return Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + x * x)) * 180 / Math.PI; }
function tilted(q) { return q && (Math.abs(q[0]) > 0.02 || Math.abs(q[2]) > 0.02); }

function aabb(p) {
  const info = PC.piece(p.name);
  let [w, h, d] = info.size;
  const s = p.s || [1, 1, 1];
  w *= s[0]; h *= s[1]; d *= s[2];
  const a = yawOf(p.q) * Math.PI / 180, c = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a));
  const ex = (w * c + d * sn) / 2, ez = (w * sn + d * c) / 2;
  const prop = info.shape === 'prop' || info.shape === 'cap' || info.shape === 'tri' || info.shape === 'triInv';
  let y0 = prop ? p.y : p.y - h / 2, y1 = prop ? p.y + h : p.y + h / 2;
  if (info.shape === 'slope26') { y0 = p.y - 0.15; y1 = p.y + h; }
  if (tilted(p.q)) { const m = Math.max(w, h, d) / 2; return { x0: p.x - m, x1: p.x + m, y0: p.y - m, y1: p.y + m, z0: p.z - m, z1: p.z + m, info }; }
  return { x0: p.x - ex, x1: p.x + ex, y0, y1, z0: p.z - ez, z1: p.z + ez, info };
}
const touch = (a, b, e) => a.x0 <= b.x1 + e && b.x0 <= a.x1 + e && a.y0 <= b.y1 + e && b.y0 <= a.y1 + e && a.z0 <= b.z1 + e && b.z0 <= a.z1 + e;
const vol = a => Math.max(0, a.x1 - a.x0) * Math.max(0, a.y1 - a.y0) * Math.max(0, a.z1 - a.z0);
function inter(a, b) {
  const v = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));
  return v;
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

function check(design, biome) {
  const pieces = design.pieces;
  const boxes = pieces.map(aabb);
  const near = index(boxes);
  const ys = boxes.filter(b => b.info.structural).map(b => b.y0).sort((a, b) => a - b);
  const ground = ys.length ? ys[Math.floor(ys.length * 0.02)] : 0;
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
    if (!b.info.structural || ['roof', 'roofTop', 'roofCorner', 'gable', 'beam', 'pole'].includes(b.info.role)) return;
    for (const j of near(b)) {
      if (j <= i) continue;
      const o = boxes[j];
      if (o.info.role !== b.info.role || !o.info.structural) continue;
      const v = inter(b, o), m = Math.min(vol(b), vol(o));
      if (m > 0.05 && v / m > 0.6 && pieces[j].name !== p.name) crushed++;
    }
  });
  results.push({ check: 'overlap', ok: doubles === 0 && crushed <= 2, detail: `${doubles} doubled, ${crushed} pieces inside another of the same kind` });

  // doors: a free spot one metre in front and behind
  const doors = pieces.map((p, i) => [p, boxes[i]]).filter(([, b]) => b.info.role === 'door');
  let blocked = 0;
  for (const [p] of doors) {
    const a = yawOf(p.q) * Math.PI / 180, nx = Math.sin(a), nz = Math.cos(a);
    for (const sg of [-1, 1]) {
      const pt = { x0: p.x + sg * nx * 1.1 - 0.2, x1: p.x + sg * nx * 1.1 + 0.2, y0: p.y - 0.3, y1: p.y + 0.6, z0: p.z + sg * nz * 1.1 - 0.2, z1: p.z + sg * nz * 1.1 + 0.2 };
      for (const j of near(pt)) {
        const o = boxes[j];
        if (['floor', 'rug', 'roof', 'roofTop', 'beam'].includes(o.info.role) || o.info.role === 'door') continue;
        if (touch(pt, o, 0)) { blocked++; break; }
      }
    }
  }
  results.push({ check: 'doors', ok: doors.length > 0 ? blocked === 0 : true, detail: doors.length ? `${doors.length} doors, ${blocked} sides blocked` : 'no doors (open building)' });

  // materials for the biome
  if (biome) {
    const ord = PC.BIOME_ORDER, limit = ord.indexOf(biome);
    const over = [...new Set(pieces.filter(p => PC.piece(p.name).structural && ord.indexOf(PC.needs(p.name)) > limit).map(p => p.name))];
    results.push({ check: 'materials', ok: over.length === 0, detail: over.length ? `needs later biomes: ${over.slice(0, 5).join(', ')}` : `all building pieces available in ${biome}` });
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

if (NODE_C) module.exports = { check, aabb }; else window.VHChecks = { check, aabb };
