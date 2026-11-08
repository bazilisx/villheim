// Compare how pieces sit relative to each other in the corpus and in generated designs.
// For each pair (A, B): offset of the nearest B from each A, in A's frame, rounded to 0.25 m.
const fs = require('fs'), BP = require('../lib/blueprint.js');
function yawOf(q) { const [x, y, z, w] = q; return Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + x * x)) * 180 / Math.PI; }
function stats(files, A, B) {
  const c = {};
  for (const f of files) {
    const ps = BP.parse(fs.readFileSync(f, 'utf8')).pieces;
    const as = ps.filter(p => p.name === A), bs = ps.filter(p => p.name === B);
    for (const a of as.slice(0, 200)) {
      let best = null, bd = 9;
      for (const b of bs) { if (b === a) continue; const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z); if (d < bd) { bd = d; best = b; } }
      if (!best) continue;
      const t = -yawOf(a.q) * Math.PI / 180, dx = best.x - a.x, dz = best.z - a.z;
      const lx = dx * Math.cos(t) + dz * Math.sin(t), lz = -dx * Math.sin(t) + dz * Math.cos(t);
      const k = [lx, best.y - a.y, lz].map(v => Math.round(v * 4) / 4).join(',') + ' r' + Math.round(((yawOf(best.q) - yawOf(a.q)) % 360 + 360) % 360);
      c[k] = (c[k] || 0) + 1;
    }
  }
  return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 5);
}
const corpus = process.argv[2].split(','), gen = process.argv[3].split(',');
for (const [A, B] of JSON.parse(process.argv[4])) {
  console.log(A, '->', B); console.log('  corpus', JSON.stringify(stats(corpus, A, B))); console.log('  gen   ', JSON.stringify(stats(gen, A, B)));
}
