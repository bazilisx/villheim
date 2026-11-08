// Numbers that describe a design, used by the scorer. The same code runs on the corpus (for training) and on
// generated designs (for ranking), so both are measured the same way.
const NODE_F = typeof module !== 'undefined';
const PF = NODE_F ? require('./pieces.js') : window.VHPieces;
const NAMES = ['log_pieces', 'log_kinds', 'wall', 'floor', 'roof', 'beam', 'pole', 'openings', 'furniture', 'deco', 'light',
  'nature', 'misc', 'mat_entropy', 'decor_density', 'height_ratio', 'log_area', 'levels', 'diag', 'roof_cover', 'top_mat_share'];
function yawOf(q) { const [x, y, z, w] = q || [0, 0, 0, 1]; return Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + x * x)) * 180 / Math.PI; }
function features(pieces) {
  const n = pieces.length || 1, roles = {}, mats = {}, kinds = new Set();
  let st = [];
  for (const p of pieces) {
    const i = PF.piece(p.name); roles[i.role] = (roles[i.role] || 0) + 1; kinds.add(p.name);
    if (i.structural) { st.push(p); mats[i.mat] = (mats[i.mat] || 0) + 1; }
  }
  if (!st.length) st = pieces;
  const q = (a, t) => a[Math.min(a.length - 1, Math.floor(a.length * t))];
  const xs = st.map(p => p.x).sort((a, b) => a - b), zs = st.map(p => p.z).sort((a, b) => a - b), ys = st.map(p => p.y).sort((a, b) => a - b);
  const w = Math.max(1, q(xs, 0.97) - q(xs, 0.03)), l = Math.max(1, q(zs, 0.97) - q(zs, 0.03)), h = Math.max(0.5, q(ys, 0.98) - q(ys, 0.05));
  const floors = pieces.filter(p => PF.piece(p.name).role === 'floor');
  const floorArea = floors.reduce((s, p) => s + PF.piece(p.name).size[0] * PF.piece(p.name).size[2], 0) || w * l;
  const roofArea = pieces.filter(p => ['roof', 'roofCorner'].includes(PF.piece(p.name).role)).length * 4;
  const lv = {}; for (const f of floors) { const k = Math.round(f.y * 2); lv[k] = (lv[k] || 0) + 1; }
  const tot = Object.values(mats).reduce((a, b) => a + b, 0) || 1;
  const ent = -Object.values(mats).reduce((s, c) => s + c / tot * Math.log(c / tot), 0);
  const r = k => (roles[k] || 0) / n;
  const furn = ['bed', 'table', 'seat', 'storage', 'fire', 'craft'].reduce((s, k) => s + (roles[k] || 0), 0);
  const deco = (roles.deco || 0) + (roles.rug || 0) + (roles.clutter || 0);
  return {
    log_pieces: Math.log(n), log_kinds: Math.log(kinds.size), wall: r('wall'), floor: r('floor'),
    roof: r('roof') + r('roofTop') + r('roofCorner') + r('gable'), beam: r('beam'), pole: r('pole'),
    openings: r('door') + r('window'), furniture: furn / n, deco: deco / n, light: r('light'), nature: r('nature'), misc: r('misc'),
    mat_entropy: ent, decor_density: (furn + deco + (roles.light || 0)) / floorArea, height_ratio: h / Math.sqrt(w * l),
    log_area: Math.log(w * l), levels: Object.values(lv).filter(c => c >= 4).length,
    diag: st.filter(p => { const a = ((yawOf(p.q) % 90) + 90) % 90; return Math.abs(a - 45) < 30; }).length / st.length,
    roof_cover: Math.min(3, roofArea / Math.max(1, floorArea)), top_mat_share: Math.max(...Object.values(mats), 0) / tot,
  };
}
function score(model, pieces) {
  const f = features(pieces);
  let z = model.bias;
  NAMES.forEach((k, i) => { z += model.w[i] * ((f[k] - model.mean[i]) / (model.std[i] || 1)); });
  return 1 / (1 + Math.exp(-z));
}
if (NODE_F) module.exports = { features, score, NAMES }; else window.VHFeatures = { features, score, NAMES };
