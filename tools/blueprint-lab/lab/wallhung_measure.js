// How the things hung on walls sit in a set of designs (lib/wallhang.js): gap from each one's back to what shows of the
// wall behind it, how much of its back meets the wall, facing, and pieces over one another on a wall.
// Usage, from tools/blueprint-lab: node lab/wallhung_measure.js <dir or .blueprint files...> [--json out.json] [--list]
const fs = require('fs'), path = require('path');
const BP = require('../lib/blueprint.js'), WH = require('../lib/wallhang.js'), P = require('../lib/pieces.js');

const args = process.argv.slice(2);
const jsonAt = args.indexOf('--json') >= 0 ? args[args.indexOf('--json') + 1] : null;
const list = args.includes('--list');
const files = [];
for (const a of args) {
  if (a.startsWith('--') || a === jsonAt) continue;
  if (fs.statSync(a).isDirectory()) for (const f of fs.readdirSync(a).sort()) { if (f.endsWith('.blueprint')) files.push(path.join(a, f)); }
  else files.push(a);
}

// the floor under a point: the highest floor or stair top at most 0.3 m over the point's own height minus a meter
function floorUnder(pieces, p) {
  let best = -Infinity;
  for (const q of pieces) {
    if (q.decor) continue;
    const r = P.piece(q.name).role;
    if (r !== 'floor') continue;
    if (Math.abs(q.x - p.x) > 1.05 || Math.abs(q.z - p.z) > 1.05) continue;
    if (q.y <= p.y + 0.05 && q.y > best) best = q.y;
  }
  return best;
}

const TOL = 0.03;
const rows = [], designs = [];
for (const f of files) {
  const d = BP.parse(fs.readFileSync(f, 'utf8'));
  const pieces = d.pieces;
  const B = WH.backing(pieces), A = WH.backing(pieces, { any: true, floors: true });
  const st = { file: path.basename(f), hung: 0, flush: 0, off: 0, air: 0, clip: 0, half: 0, wrong: 0, stacks: 0, overlaps: 0, byKind: {} };
  pieces.forEach((p, i) => {
    if (!WH.isHung(p.name)) return;
    // a wood ledge that is part of the outside trim (lib/motifs.js) or holds things up counts as well
    const m = WH.measure(p, B);
    const fl = floorUnder(pieces, p);
    // standing on a floor or furniture, or mounted on something that is no wall: not a wall's (counted apart)
    const wallOk = isFinite(m.gap) && m.gap <= TOL && m.gap >= -Math.max(TOL, (p.wclip || 0) + 0.01) && m.cover >= 0.67 && m.facing;
    const rest = wallOk ? null : WH.restsOn(p, A);
    if (rest) { st.rests = (st.rests || 0) + 1; rows.push({ file: st.file, i, name: p.name, rest: rest.how, on: rest.on.name }); return; }
    const r = { file: st.file, i, name: p.name, kind: m.kind, x: p.x, y: p.y, z: p.z, gap: isFinite(m.gap) ? +m.gap.toFixed(3) : null, front: isFinite(m.front) ? +m.front.toFixed(3) : null,
      cover: +m.cover.toFixed(2), facing: m.facing, wall: m.wall ? m.wall.name : null, h: isFinite(fl) ? +(p.y - fl).toFixed(2) : null, clipMark: p.wclip || 0 };
    rows.push(r);
    st.hung++;
    const k = st.byKind[r.kind] || (st.byKind[r.kind] = { n: 0, flush: 0, off: 0, air: 0, clip: 0, wrong: 0, half: 0 });
    k.n++;
    if (r.gap == null) { st.air++; k.air++; }
    else if (r.gap > TOL) { st.off++; k.off++; }
    else if (r.gap < -Math.max(TOL, r.clipMark + 0.01)) { st.clip++; k.clip++; }
    else { st.flush++; k.flush++; }
    if (r.gap != null && r.cover < 0.67) { st.half++; k.half++; }
    if (!r.facing) { st.wrong++; k.wrong++; }
  });
  const restIdx = new Set(rows.filter(r => r.file === st.file && r.rest).map(r => r.i));
  const ov = WH.overlaps(pieces).filter(o => !restIdx.has(o.i) && !restIdx.has(o.j));
  for (const o of ov) { if (o.share >= 0.33 && o.depth >= 0.03) st.stacks++; else if (o.share >= 0.1) st.overlaps++; }
  st.pairs = ov.filter(o => o.share >= 0.1).map(o => ({ a: o.names[0] + '#' + o.i, b: o.names[1] + '#' + o.j, share: +o.share.toFixed(2), depth: +o.depth.toFixed(2) }));
  designs.push(st);
}

const pct = (a, b) => (b ? (100 * a / b).toFixed(0) + '%' : '-');
console.log('design'.padEnd(52), 'hung flush  off  air clip half wrong stacks overl rests');
for (const s of designs) console.log(s.file.padEnd(52), String(s.hung).padStart(4), String(s.flush).padStart(5), String(s.off).padStart(4), String(s.air).padStart(4), String(s.clip).padStart(4), String(s.half).padStart(4), String(s.wrong).padStart(5), String(s.stacks).padStart(6), String(s.overlaps).padStart(5), String(s.rests || 0).padStart(5));
const T = designs.reduce((a, s) => { for (const k of ['hung', 'flush', 'off', 'air', 'clip', 'half', 'wrong', 'stacks', 'overlaps']) a[k] = (a[k] || 0) + s[k]; return a; }, {});
console.log('total'.padEnd(52), String(T.hung).padStart(4), String(T.flush).padStart(5), String(T.off).padStart(4), String(T.air).padStart(4), String(T.clip).padStart(4), String(T.half).padStart(4), String(T.wrong).padStart(5), String(T.stacks).padStart(6), String(T.overlaps).padStart(5));
const kinds = {};
for (const r of rows) {
  if (r.rest) continue;
  const k = kinds[r.name] || (kinds[r.name] = { n: 0, gaps: [], off: 0, air: 0, clip: 0, wrong: 0, half: 0 });
  k.n++; if (r.gap == null) k.air++; else { k.gaps.push(r.gap); if (r.gap > TOL) k.off++; if (r.gap < -Math.max(TOL, r.clipMark + 0.01)) k.clip++; if (r.cover < 0.67) k.half++; }
  if (!r.facing) k.wrong++;
}
const q = (a, f) => { if (!a.length) return '-'; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))].toFixed(2); };
console.log('\nprefab'.padEnd(24), '   n  p10  p50  p90  off>3cm  air  clip  half  wrong');
for (const [n, k] of Object.entries(kinds).sort((a, b) => b[1].n - a[1].n))
  console.log(n.padEnd(23), String(k.n).padStart(4), q(k.gaps, 0.1).padStart(5), q(k.gaps, 0.5).padStart(5), q(k.gaps, 0.9).padStart(5), pct(k.off, k.n).padStart(8), String(k.air).padStart(4), String(k.clip).padStart(5), String(k.half).padStart(5), String(k.wrong).padStart(6));
if (list) for (const r of rows) if (r.rest) console.log(JSON.stringify(r)); else if (r.gap == null || r.gap > TOL || !r.facing || r.cover < 0.67) console.log(JSON.stringify(r));
if (jsonAt) fs.writeFileSync(jsonAt, JSON.stringify({ designs, rows }, null, 0));
