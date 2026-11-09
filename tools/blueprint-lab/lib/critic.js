// The design critic: how close a design comes to the best-liked community builds in the things that set them apart
// from the rest (lab/learn_critic.js measures them on the corpus into data/critic.json). Used to rank the seeds of a
// request (lib/request.js). Every number here is measured the same way on the corpus and on generated designs.
//
// What the best-liked builds have more of than the rest and than our designs (2026-11-09, 48 top and 49 bottom
// quarter house-like builds by downloads, 96 generated): ridge lines (4, against 1 and 2), the rise and fall of the
// skyline, the number of different structural pieces (26 against 14), materials (4 against 3), height.
const NODE_K = typeof module !== 'undefined';
const PK = NODE_K ? require('./pieces.js') : window.VHPieces;
const TRIM_K = /beam|pole|log_|decowall|divider|wall_roof_top|dragon|raven|wolf|arch|fence|window|itemstand|banner|walltorch|lantern|sconce/;
const yawK = p => p.yaw != null ? p.yaw : Math.atan2(2 * (p.q[3] * p.q[1] + p.q[0] * p.q[2]), 1 - 2 * (p.q[1] * p.q[1] + p.q[0] * p.q[0])) * 180 / Math.PI;

function measure(pieces) {
  const role = p => PK.piece(p.name).role;
  const st = pieces.filter(p => PK.piece(p.name).structural && !p.decor);
  if (!st.length) return null;
  const walls = st.filter(p => ['wall', 'gable'].includes(role(p)));
  const roofs = st.filter(p => ['roof', 'roofTop', 'roofCorner'].includes(role(p)));
  const trim = st.filter(p => TRIM_K.test(p.name) && !['roof', 'floor', 'stair', 'door'].includes(role(p)));
  const mats = new Set(st.map(p => PK.piece(p.name).mat));
  let minY = Infinity; for (const p of st) minY = Math.min(minY, p.y);
  const cell = new Map();
  for (const p of st) { const k = Math.round(p.x) + ',' + Math.round(p.z); cell.set(k, Math.max(cell.get(k) ?? -1e9, p.y - minY)); }
  const hs = [...cell.values()], mean = hs.reduce((a, b) => a + b, 0) / hs.length;
  const sd = Math.sqrt(hs.reduce((a, b) => a + (b - mean) ** 2, 0) / hs.length);
  // ridge lines: ridge caps grouped by height and direction, each group a line
  const ridges = new Set(roofs.filter(p => role(p) === 'roofTop').map(p => Math.round(p.y) + '|' + (Math.round(yawK(p) / 90) % 2)));
  const wallArea = walls.reduce((s, p) => { const z = PK.piece(p.name).size; return s + z[0] * z[1]; }, 0) || 1;
  return {
    ridges: ridges.size, skyline: sd / Math.sqrt(cell.size), kinds: new Set(st.map(p => p.name)).size, mats: mats.size,
    trim: trim.length / wallArea, height: Math.max(...hs) / Math.sqrt(cell.size),
  };
}

// 0 to 1: the share of the best builds' level reached on each measure (more is better up to their median), less a
// penalty for trim busier than nine in ten of them. Stage s1 asks for less.
function score(model, pieces, stage) {
  const m = measure(pieces);
  if (!m || !model) return 0;
  const k = stage === 's1' ? 0.5 : stage === 's2' ? 0.8 : 1;
  let s = 0, n = 0;
  for (const f of ['ridges', 'skyline', 'kinds', 'mats', 'height']) {
    const t = model.top[f] * k;
    s += Math.min(1, t > 0 ? m[f] / t : 1); n++;
  }
  const busy = m.trim > model.p90.trim ? Math.min(1, (m.trim - model.p90.trim) / model.p90.trim) : 0;
  return Math.max(0, s / n - 0.5 * busy);
}

const apiK = { measure, score };
if (NODE_K) module.exports = apiK; else window.VHCritic = apiK;
