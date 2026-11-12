// How every decor piece meets what holds it (lib/wallhang.js): the things hung on walls (lab/wallhung_measure.js does
// those in full), and for the rest whether it stands on something (a floor, a table, a shelf, a chest) or hangs from
// something over it (a ceiling, a beam). A piece doing neither within 3 cm floats.
// Usage, from tools/blueprint-lab: node lab/attach_measure.js <dir or .blueprint files...> [--list]
const fs = require('fs'), path = require('path');
const BP = require('../lib/blueprint.js'), WH = require('../lib/wallhang.js'), P = require('../lib/pieces.js');
const args = process.argv.slice(2), list = args.includes('--list');
const files = [];
for (const a of args) { if (a.startsWith('--')) continue; if (fs.statSync(a).isDirectory()) { for (const f of fs.readdirSync(a).sort()) if (f.endsWith('.blueprint')) files.push(path.join(a, f)); } else files.push(a); }
const TOL = 0.03;
// pieces that hang from what is over them, and pieces nothing holds in the game (plants, fire, rugs lie flat)
const HANGS = /^(piece_brazierceiling01|piece_dvergr_lantern_pole|piece_chain|cloth_hanging_|piece_cloth_hanging|fenrirhide_hanging|piece_banner)/;
const by = {}, tot = { n: 0, ok: 0, floats: 0, sunk: 0 };
for (const f of files) {
  const d = BP.parse(fs.readFileSync(f, 'utf8'));
  const A = WH.backing(d.pieces, { any: true, floors: true }), AR = WH.backing(d.pieces, { any: true, floors: true, roofs: true });
  for (const p of d.pieces) {
    const info = P.piece(p.name);
    if (WH.isHung(p.name) || info.structural || ['plant', 'rug'].includes(info.role) || p.green) continue;
    if (!/decor|deco|light|storage|seat|table|bed|craft|clutter|fire|misc/.test(info.role) && !p.decor) continue;
    const hang = HANGS.test(p.name);
    const m = WH.attach(p, hang ? AR : A);
    const gap = hang ? Math.min(m.above, m.below) : m.below;
    // standing on the ground outside (the lowest pivot is the ground, lib/yards.js)
    const ground = !hang && p.y - (WH.modelWorldBox(p, 0).y1 - WH.modelWorldBox(p, 0).y0) < 0.2 && m.below === Infinity && p.y < 1.2;
    const k = by[p.name] || (by[p.name] = { n: 0, floats: 0, gaps: [], worst: null });
    k.n++; tot.n++;
    if (ground || gap <= TOL) { tot.ok++; continue; }
    k.floats++; tot.floats++; k.gaps.push(gap);
    if (!k.worst || gap > k.worst.gap) k.worst = { gap, file: path.basename(f), at: [p.x, p.y, p.z].map(v => (+v).toFixed(2)).join(',') };
    if (list) console.log(JSON.stringify({ file: path.basename(f), name: p.name, gap: isFinite(gap) ? +gap.toFixed(3) : null, at: [p.x, p.y, p.z], kb: p.kb }));
  }
}
console.log(`pieces ${tot.n}, held ${tot.ok}, floating more than 3 cm ${tot.floats}`);
for (const [n, k] of Object.entries(by).filter(([, k]) => k.floats).sort((a, b) => b[1].floats - a[1].floats))
  console.log(n.padEnd(28), String(k.floats).padStart(4), 'of', String(k.n).padStart(4), ' worst', k.worst.gap === Infinity ? 'nothing within 1.5 m' : (k.worst.gap * 100).toFixed(0) + ' cm', k.worst.file, k.worst.at);
