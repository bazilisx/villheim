// Corpus clip depths read from three sets of shapes: the colliders (lib/shapes.js), the coarse parts and the fine parts
// of lib/mesh.js. For each piece inside a building (a floor under it and a roof or floor over it) in the vanilla builds,
// how far it reaches into the structure round it (walls, poles, beams, windows, doors) and into furniture. The classes
// are the wood_ledge (the shelf the stand sets use) and furniture (tables, seats, storage, beds, craft stations).
// This is the corpus side of the clip depths the stand and kit sets are held to (D-127, D-098).
//   node --max-old-space-size=3000 lab/recount_clips.js <corpus dir> <out.json> [i/n]   one chunk: files with index % n == i
//   node lab/recount_clips.js --merge <out.json> <chunk.json>...                          sum the chunks, print the table
// Same builds and filters as lab/mine_stands.js (vanilla: no mod piece, 20 pieces or more; hs_ and OverDrive skipped).
const fs = require('fs'), path = require('path');
const MODES = ['collider', 'coarse', 'fine'];
const CLASSES = ['ledge>structure', 'ledge>furniture', 'furniture>structure', 'furniture>furniture'];
const q = (a, f) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };

if (process.argv[2] === '--merge') {
  const out = process.argv[3], T = {};
  for (const f of process.argv.slice(4)) {
    const c = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const k of CLASSES) { T[k] = T[k] || { n: 0, d: { collider: [], coarse: [], fine: [] } }; T[k].n += c[k].n; for (const m of MODES) T[k].d[m].push(...c[k].d[m]); }
  }
  const R = {};
  for (const k of CLASSES) {
    R[k] = { n: T[k].n };
    for (const m of MODES) {
      const d = T[k].d[m], over = d.filter(v => v >= 10);
      // pieces reaching 1 cm or more into the class, and the depth (cm) at the 50th, 75th, 90th and 99th percentile of those
      R[k][m] = { over1cm: over.length, share: +(over.length / Math.max(1, T[k].n)).toFixed(4), p50: over.length ? q(over, 0.5) / 10 : null, p75: over.length ? q(over, 0.75) / 10 : null,
        p90: over.length ? q(over, 0.9) / 10 : null, p99: over.length ? q(over, 0.99) / 10 : null, max: over.length ? Math.max(...over) / 10 : null,
        over4cm: d.filter(v => v >= 40).length, over12cm: d.filter(v => v >= 120).length };
    }
  }
  fs.writeFileSync(out, JSON.stringify(R));
  for (const k of CLASSES) { console.log(`${k}: ${R[k].n} pieces`); for (const m of MODES) console.log(`  ${m.padEnd(8)} ${JSON.stringify(R[k][m])}`); }
  process.exit(0);
}

const P = require('../lib/pieces.js'), SH = require('../lib/shapes.js'), Ck = require('../lib/checks.js'), BP = require('../lib/blueprint.js'), ME = require('../lib/mesh.js');
const dir = process.argv[2], out = process.argv[3] || '/tmp/recount-clips.json';
const [ci, cn] = (process.argv[4] || '0/1').split('/').map(Number);
const MOD = /^(kg_|GB_|CastleKit|MB|mm_|BBH|rk_|Piece_vf|OdinsKingdom|h_|\$|Hayze|rae_|teq_|tkd_|rkc_)/;
const SKIP = /^hs_|biomeblueprint|overdrive/i;
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) { if (!/^_/.test(e.name)) walk(path.join(d, e.name)); } else if (/\.blueprint$/.test(e.name) && !SKIP.test(e.name) && !SKIP.test(d)) files.push(path.join(d, e.name)); } })(dir);
files.sort();
const STRUCT = new Set(['wall', 'pole', 'beam', 'window', 'door', 'gable']), FURN = new Set(['table', 'seat', 'storage', 'bed', 'craft']), OVER = new Set(['roof', 'roofTop', 'roofCorner', 'floor']);
const R = Object.fromEntries(CLASSES.map(k => [k, { n: 0, d: { collider: [], coarse: [], fine: [] } }]));
const shapesOf = (p, m) => (m === 'collider' ? SH.world(p) : m === 'coarse' ? ME.world(p) : (ME.worldFine(p) || ME.world(p)));
const WORK = /^(piece_workbench|forge|piece_artisanstation|blackforge|piece_magetable|piece_stonecutter|piece_cartographytable|piece_preptable|piece_MeadCauldron|piece_cauldron|piece_butcher|piece_spinningwheel|piece_cookingstation|piece_oven|fermenter|piece_alchemy)/i;

files.forEach((f, fi) => {
  if (fi % cn !== ci) return;
  let bp;
  try { bp = BP.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return; }
  const ps = bp.pieces;
  if (ps.length < 20 || ps.some(p => MOD.test(p.name))) return;
  const bx = ps.map(p => Ck.aabb(p)), near = Ck.index(bx), role = i => bx[i].info.role;
  const around = (x, z, r, y0, y1) => [...near({ x0: x - r, x1: x + r, z0: z - r, z1: z + r }, 0)].filter(j => bx[j].y1 > y0 && bx[j].y0 < y1);
  const covers = (j, x, z) => bx[j].x0 <= x && bx[j].x1 >= x && bx[j].z0 <= z && bx[j].z1 >= z;
  const floorTop = (x, z, y) => { let t = null; for (const j of around(x, z, 0.05, y - 4, y + 0.3)) if (role(j) === 'floor' && covers(j, x, z) && bx[j].y1 <= y + 0.25 && (t == null || bx[j].y1 > t)) t = bx[j].y1; return t; };
  const roofed = (x, z, y) => around(x, z, 0.05, y + 0.3, y + 15).some(j => OVER.has(role(j)) && covers(j, x, z) && bx[j].y0 > y + 0.3);
  const inside = (x, z, y) => { const ft = floorTop(x, z, y); return ft != null && roofed(x, z, Math.max(y, ft + 1.2)); };
  const cache = {};
  const shp = (j, m) => { const k = j + m; return cache[k] || (cache[k] = shapesOf(ps[j], m)); };
  ps.forEach((p, i) => {
    const r = role(i), isLedge = /^wood_ledge/.test(p.name), isFurn = FURN.has(r) || WORK.test(p.name);
    if (!isLedge && !isFurn) return;
    if (bx[i].pass) return;
    const cx = (bx[i].x0 + bx[i].x1) / 2, cz = (bx[i].z0 + bx[i].z1) / 2;
    if (!inside(cx, cz, bx[i].y0 + 0.1)) return;
    const best = {};
    for (const j of near({ x0: bx[i].x0 - 0.1, x1: bx[i].x1 + 0.1, z0: bx[i].z0 - 0.1, z1: bx[i].z1 + 0.1 }, 0)) {
      if (j === i || bx[j].pass) continue;
      const B = bx[i], C = bx[j];
      if (B.x0 > C.x1 + 0.1 || C.x0 > B.x1 + 0.1 || B.y0 > C.y1 + 0.1 || C.y0 > B.y1 + 0.1 || B.z0 > C.z1 + 0.1 || C.z0 > B.z1 + 0.1) continue;
      const rj = role(j), jl = /^wood_ledge/.test(ps[j].name), jf = FURN.has(rj) || WORK.test(ps[j].name);
      const cls = STRUCT.has(rj) ? (isLedge ? 'ledge>structure' : 'furniture>structure') : (jf || jl) && !(isLedge && jl) && !(isFurn && jl) ? (isLedge ? 'ledge>furniture' : 'furniture>furniture') : null;
      if (!cls) continue;
      // a pair of furniture is counted once, from the lower index
      if (cls === 'furniture>furniture' && j < i) continue;
      const o = best[cls] = best[cls] || { collider: 0, coarse: 0, fine: 0 };
      for (const m of MODES) { const d = SH.clipDepth(shp(i, m), shp(j, m)); if (d > o[m]) o[m] = d; }
    }
    // a piece counts in a class when it has a neighbor there (touching within 10 cm in any set of shapes)
    for (const cls of CLASSES) {
      const kind = cls.split('>')[0];
      if ((kind === 'ledge') !== isLedge || (kind === 'furniture') !== (isFurn && !isLedge)) continue;
      R[cls].n++;
      const o = best[cls] || { collider: 0, coarse: 0, fine: 0 };
      for (const m of MODES) if (o[m] > 0.001) R[cls].d[m].push(Math.round(o[m] * 1000) / 1);
    }
  });
});
// depths kept in millimeters; the merge reads 10 as 1 cm
for (const k of CLASSES) for (const m of MODES) R[k].d[m] = R[k].d[m].map(v => Math.round(v / 1));
fs.writeFileSync(out, JSON.stringify(R));
console.log(`chunk ${ci}/${cn}: ${CLASSES.map(k => `${k} ${R[k].n}`).join(', ')}`);
