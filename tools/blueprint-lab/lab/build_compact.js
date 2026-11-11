// compact.json for the corpus miners from a folder of .blueprint files (the valheimians downloads folder with its index.json):
//   node lab/build_compact.js <corpus folder> <out compact.json>
// One row per build: { file, title, cat, dls, votes, verdict, p: [[name, x, y, z, yaw], ...] }, the shape lab/learn_critic.js,
// lab/mine_kitbash.js, lab/mine_yards.js, lab/mine_motifs.js and lab/coverage.js read. Folders starting with _ and files of
// the OverDrive BiomeBlueprints pack are left out; the same build saved twice counts once (first 300 pieces, relative to
// the first piece). The Review tab is not read, so verdict is empty (lab/build_corpus.py read it from review.json).
// The output holds blueprint content: keep it out of the repo.
const fs = require('fs'), path = require('path');
const BP = require('../lib/blueprint.js');
const [src, out] = process.argv.slice(2);
if (!src || !out) { console.error('usage: node lab/build_compact.js <corpus folder> <out compact.json>'); process.exit(1); }
const SKIP = /^hs_|biomeblueprint|overdrive/i;
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  if (e.isDirectory()) { if (!e.name.startsWith('_')) walk(path.join(d, e.name)); }
  else if (e.name.endsWith('.blueprint') && !SKIP.test(e.name) && !SKIP.test(d)) files.push(path.join(d, e.name));
} })(src);
files.sort();
const idxFile = path.join(src, 'index.json');
const index = new Map(fs.existsSync(idxFile) ? JSON.parse(fs.readFileSync(idxFile, 'utf8')).map(r => [r.slug, r]) : []);
const yawOf = q => Math.atan2(2 * (q[3] * q[1] + q[0] * q[2]), 1 - 2 * (q[1] * q[1] + q[0] * q[0])) * 180 / Math.PI;
const seen = new Set();
const rows = [];
let dups = 0, empty = 0;
for (const f of files) {
  let d;
  try { d = BP.parse(fs.readFileSync(f, 'utf8')); } catch (e) { empty++; continue; }
  if (!d.pieces.length) { empty++; continue; }
  const p0 = d.pieces[0];
  const sig = d.pieces.length + '|' + d.pieces.slice(0, 300).map(p => `${p.name},${Math.round(p.x - p0.x)},${Math.round(p.y - p0.y)},${Math.round(p.z - p0.z)}`).sort().join(';');
  if (seen.has(sig)) { dups++; continue; }
  seen.add(sig);
  const base = path.basename(f, '.blueprint'), slug = base.split('__')[0], r = index.get(slug);
  rows.push({ file: path.relative(src, f), title: (r && r.title) || d.meta.Name || base, cat: (r && r.cat) || path.basename(path.dirname(f)), dls: r ? +r.dls || 0 : 0,
    votes: r ? +r.votes || 0 : 0, verdict: '', p: d.pieces.map(p => [p.name, +p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3), +yawOf(p.q).toFixed(1)]) });
}
fs.writeFileSync(out, JSON.stringify(rows));
console.log(`${files.length} files, ${rows.length} builds, ${dups} duplicates, ${empty} empty or unreadable, ${rows.reduce((a, r) => a + r.p.length, 0)} pieces`);
