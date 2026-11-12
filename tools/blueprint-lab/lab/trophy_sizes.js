// Trophies on stands in the corpus by build kind (houses, halls, other): item model length per stand (data/item-models.json
// bounds), for lib/persona.js BIG_ITEM_M (D-134, round 7c)
//   node lab/trophy_sizes.js <corpus folder>  (the corpus is not in this repo; the private corpus repo's blueprints, D-157)
const fs = require('fs'), path = require('path');
const LAB = path.join(__dirname, '..'), dir = path.resolve(process.argv[2]);
const MS = require(path.join(LAB, 'lab/mine_stands.js')), BP = require(path.join(LAB, 'lib/blueprint.js'));
const IM = require(path.join(LAB, 'data/item-models.json'));
const idx = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
const bySlug = new Map(idx.map(d => [d.slug, d]));
const MOD = /^(kg_|GB_|CastleKit|MB|mm_|BBH|rk_|Piece_vf|OdinsKingdom|h_|\$|Hayze|rae_|teq_|tkd_|rkc_)/, SKIP = /^hs_|biomeblueprint|overdrive/i;
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) { if (!/^_/.test(e.name)) walk(path.join(d, e.name)); } else if (/\.blueprint$/.test(e.name) && !SKIP.test(e.name) && !SKIP.test(d)) files.push(path.join(d, e.name)); } })(dir);
const sz = n => { const m = IM.items[n]; return m && m.b ? Math.max(...[0, 1, 2].map(i => m.b.max[i] - m.b.min[i])) : null; };
const HOUSE = /^(starter[- ]home|building|advanced[- ]base|tree[- ]house|interior[- ]design)/i, HALL = /^(longhouse|tavern|village|castle|tower|blacksmith|temple)/i;
const out = { house: [], hall: [], other: [] }, seen = new Set(), builds = { house: new Set(), hall: new Set(), other: new Set() };
for (const f of files) {
  let bp; try { bp = BP.parse(fs.readFileSync(f, 'utf8')); } catch (e) { continue; }
  if (bp.pieces.length < 20 || bp.pieces.some(p => MOD.test(p.name))) continue;
  const b = path.basename(f, '.blueprint'), s = b.split('__')[0];
  const sig = bp.pieces.length + '|' + bp.pieces.slice(0, 50).map(p => p.name + Math.round(p.x) + ',' + Math.round(p.z)).join(';');
  if (seen.has(sig)) continue; seen.add(sig);
  const meta = bySlug.get(s) || { slug: s, title: s, cat: path.basename(path.dirname(f)), dls: 0 };
  const cat = String(meta.cat || path.basename(path.dirname(f)));
  const k = HOUSE.test(cat) ? 'house' : HALL.test(cat) ? 'hall' : 'other';
  const S = MS.newStats();
  const recs = MS.scan(bp.pieces, b, meta, S) || [];
  for (const r of recs) if (/^Trophy/.test(r.item || '')) { const v = sz(r.item); if (v != null) { out[k].push([v, r.item, r.kind]); builds[k].add(b); } }
}
const q = (v, p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
for (const k of Object.keys(out)) {
  const v = out[k].sort((a, c) => a[0] - c[0]);
  if (!v.length) continue;
  console.log(k, 'trophy stands', v.length, 'builds', builds[k].size, 'p50/p75/p90/p95', [0.5, 0.75, 0.9, 0.95].map(p => q(v, p)[0].toFixed(3) + ' ' + q(v, p)[1]).join(' / '), 'max', v[v.length - 1][0].toFixed(2), v[v.length - 1][1]);
  const big = {}; for (const [s2, n] of v) if (s2 > 1.9) big[n] = (big[n] || 0) + 1;
  console.log('  over 1.9 m:', JSON.stringify(big));
}
