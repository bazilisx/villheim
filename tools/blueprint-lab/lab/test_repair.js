// How well does the repair find pieces that were taken out? node lab/test_repair.js <blueprint files...>
// For each design: take out 3 % of its structural pieces at random, repair, and count how many come back (recall)
// and how many of the added pieces were really missing (precision). Generated designs are scored the same way.
const fs = require('fs'), BP = require('../lib/blueprint.js'), Rp = require('../lib/repair.js');
let tr = 0, tf = 0, ta = 0, tc = 0, n = 0;
const near = (a, b) => a.name === b.name && Math.abs(a.x - b.x) < 0.2 && Math.abs(a.y - b.y) < 0.2 && Math.abs(a.z - b.z) < 0.2;
for (const f of process.argv.slice(2)) {
  const bp = BP.parse(fs.readFileSync(f, 'utf8'));
  if (bp.pieces.length < 40 || bp.pieces.length > 6000) continue;
  const { kept, removed } = Rp.damage(bp.pieces, 0.03, n + 7);
  if (!removed.length) continue;
  const res = Rp.repair(kept);
  const back = removed.filter(r => res.added.some(a => near(a, r))).length;
  const correct = res.added.filter(a => removed.some(r => near(a, r)) || bp.pieces.some(r => near(a, r))).length;
  tr += removed.length; tf += back; ta += res.added.length; tc += correct; n++;
}
console.log(`${n} designs: found again ${tf} of ${tr} taken out (${(100 * tf / tr).toFixed(0)} %), ` +
  `${tc} of ${ta} added pieces were right (${(100 * tc / Math.max(1, ta)).toFixed(0)} %)`);
