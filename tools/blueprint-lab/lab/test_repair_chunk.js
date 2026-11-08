// Cut a slice off one side of each design (everything structural beyond 30 % of its width from one end) and see how
// much of it the repair puts back. node lab/test_repair_chunk.js <files...>
const fs = require('fs'), BP = require('../lib/blueprint.js'), Rp = require('../lib/repair.js'), PR = require('../lib/pieces.js');
const near = (a, b) => a.name === b.name && Math.abs(a.x - b.x) < 0.25 && Math.abs(a.y - b.y) < 0.25 && Math.abs(a.z - b.z) < 0.25;
let tr = 0, tf = 0, ta = 0, tc = 0, n = 0, sym = 0;
for (const f of process.argv.slice(2)) {
  const bp = BP.parse(fs.readFileSync(f, 'utf8'));
  const st = bp.pieces.filter(p => PR.piece(p.name).structural);
  if (st.length < 40 || bp.pieces.length > 5000) continue;
  const xs = st.map(p => p.x).sort((a, b) => a - b), x0 = xs[0], x1 = xs[xs.length - 1];
  const cut = x1 - (x1 - x0) * 0.3;
  const removed = bp.pieces.filter(p => PR.piece(p.name).structural && p.x > cut), kept = bp.pieces.filter(p => !removed.includes(p));
  if (removed.length < 5) continue;
  const res = Rp.repair(kept);
  if (res.mirror && res.mirror.score >= 0.8) sym++;
  const back = removed.filter(r => res.added.some(a => near(a, r))).length;
  const right = res.added.filter(a => bp.pieces.some(r => near(a, r))).length;
  tr += removed.length; tf += back; ta += res.added.length; tc += right; n++;
}
console.log(`${n} designs (${sym} read as mirrored after the cut): put back ${tf} of ${tr} cut pieces (${(100 * tf / tr).toFixed(0)} %), ${tc} of ${ta} added were right (${(100 * tc / Math.max(1, ta)).toFixed(0)} %)`);
