// The council's corpus-rooms check of one design (docs/handoffs/2026-11-12-showcase-review/criteria/corpus-rooms.md):
// reads the design with the room study's own scripts and prints every hard fail and scored item with its value, its
// target and its points.
//   node lab/rooms_corpus_audit.js <design.blueprint> [--json out.json] [--keep dir]
// Targets come from data/rooms-corpus (the corpus numbers) and Tyler's rules as the criteria file states them.
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const lab = path.join(__dirname, '..');
const BP = require(lab + '/lib/blueprint.js');
const L = require('./rooms_corpus_lib.js');
const { typeOf, LIGHTK, colorDiff, q } = L;

const args = process.argv.slice(2);
// a .blueprint file, or a .jsonl whose first line is a compact build (a corpus build, for calibration)
const file = args.find(a => a.endsWith('.blueprint') || a.endsWith('.jsonl'));
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
if (!file) { console.error('usage: node lab/rooms_corpus_audit.js <design.blueprint | build.jsonl> [--json out.json] [--keep dir]'); process.exit(1); }
const work = opt('--keep') || fs.mkdtempSync(path.join(os.tmpdir(), 'rooms-audit-'));
fs.mkdirSync(work, { recursive: true });
const catalog = '/home/claude/wt/catalog/tools/blueprint-lab/data/catalog/pieces.json';
L.loadCatalog(catalog);

// the design as one compact line, read like a corpus build
const yawOf = qq => Math.atan2(2 * (qq[3] * qq[1] + qq[0] * qq[2]), 1 - 2 * (qq[1] * qq[1] + qq[0] * qq[0])) * 180 / Math.PI;
let line;
if (file.endsWith('.jsonl')) line = fs.readFileSync(file, 'utf8').split('\n')[0];
else {
  const d = BP.parse(fs.readFileSync(file, 'utf8'));
  line = JSON.stringify({ file: path.basename(file), title: path.basename(file, '.blueprint'), cat: 'design', dls: 0, votes: 0, verdict: '',
    p: d.pieces.map(p => [p.name, +p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3), +yawOf(p.q).toFixed(1)]) });
}
const jsonl = path.join(work, 'design.jsonl');
fs.writeFileSync(jsonl, line + '\n');
const run = (script, a) => { const r = spawnSync(process.execPath, ['--max-old-space-size=2500', path.join(__dirname, script), ...a], { encoding: 'utf8', env: process.env }); if (r.status) { console.error(r.stderr); process.exit(1); } };
run('rooms_corpus_extract.js', [jsonl, path.join(work, 'ex')]);
run('rooms_corpus_stats.js', [path.join(work, 'ex'), path.join(work, 'out'), '--showcase', path.join(work, 'ex'), '--compact', jsonl, '--audit', '--catalog', catalog]);
run('rooms_corpus_gardens.js', [jsonl, path.join(work, 'ex'), path.join(work, 'out/gardens.json')]);
const R = n => JSON.parse(fs.readFileSync(path.join(work, 'out', n), 'utf8'));
const C = n => JSON.parse(fs.readFileSync(path.join(lab, 'data/rooms-corpus', n), 'utf8'));
const raw = R('raw.json'), caps = R('caps.json'), gard = R('gardens.json');
const ck = C('kinds.json').kinds, cs = C('sets.json'), cm = C('materials.json'), csp = C('space.json');
const indoor = Object.values(caps.showcaseIndoor)[0] || {};

const hard = [], items = [];
const H = (id, fail, detail) => hard.push({ id, fail: !!fail, detail });
// points: full when ok, half when within a quarter of the target (or 10 points of a share), else none
const S = (id, weight, value, target, ok, near, detail) => items.push({ id, weight, value, target, points: ok ? weight : near ? weight / 2 : 0, detail });

// ---------------- hard fails
const halls = raw.halls.filter(h => h.fill >= 0.8 && h.L >= 3);
const narrow = halls.filter(h => h.W < 3.9 && h.ways >= 2);
const wings = raw.wings || [];
H('H1 passage two wood_floor wide', narrow.length + wings.length, [...narrow.map(h => `hall ${h.W} m wide, ${h.L} m long at floor ${h.lvl} (${h.cx}, ${h.cz})`), ...wings.map(w => `${w.kind}: a wing ${w.w} m wide, ${w.L} m long, ${w.area} m2 at floor ${w.lvl} (${w.cx}, ${w.cz})`)]);
// real doors only: an open side of an alcove or a nook is no doorway
const doorBad = raw.doors.filter(x => !x.open && ((x.near != null && x.near < 1.0) || x.depth < 1.0));
H('H2 doorway crowded', doorBad.length, doorBad.map(x => `${x.kind} door at (${x.x}, ${x.z}) floor ${x.lvl}: clear depth ${x.depth} m, nearest ${x.nearN || '-'} ${x.near} m`));
const blocked = raw.ways.filter(w => !w.open && w.w < 0.75);
H('H3 room or focal unreachable', blocked.length, blocked.map(w => `${w.kind}: way to ${w.to} ${w.w} m`));
const extFront = raw.work.flatMap(st => st.near.filter(o => /(_ext|ext\d)/.test(o.n) && Math.abs(o.lx) < 0.6 && o.lz > 0 && o.d < 1.5).map(o => `${o.n} in front of ${st.n} at ${o.d} m`));
H('H4 station blocked by its extension', extFront.length, extFront);
const outdoor = raw.rooms.flatMap(r => (r.outdoor || []).filter(n => n === 'wood_fence').map(n => `${n} in a ${r.kind}`));
H('H5 fence indoors', outdoor.length, outdoor);

// ---------------- scored items
const furnished = raw.rooms.filter(r => r.nFurn >= 2);
const FOCAL = { bedroom: ['bed'], dormitory: ['bed'], home: ['fire', 'table', 'bed'], dining: ['table'], 'feast hall': ['table', 'fire', 'throne'], 'tavern hall': ['bar', 'fire', 'table'], 'throne hall': ['throne', 'fire', 'table'], 'hearth room': ['fire'], kitchen: ['kitchen', 'fire'], smithy: ['forge', 'station'], workshop: ['station'], storage: ['chest'], bath: ['bath'], shrine: ['statue', 'throne', 'fire'], sitting: ['table', 'fire', 'seat'], 'portal room': ['portal'] };
const withPurpose = furnished.filter(r => !['other', 'empty', 'corridor', 'display'].includes(r.kind) && r.focal);
const s1 = furnished.length ? withPurpose.length / furnished.length : 1;
S(1, 8, +s1.toFixed(2), '1.0 (none under 0.7)', s1 >= 0.999, s1 >= 0.7, furnished.filter(r => !withPurpose.includes(r)).map(r => `${r.kind} room ${r.area} m2 at (${r.cx}, ${r.cz}): ${r.names.join(', ')}`));
const sets = raw.tableSets.filter(t => t.n > 0);
const matched = sets.length ? sets.filter(t => new Set(t.seats.filter(x => !/throne/.test(x.n)).map(x => x.n)).size <= 1).length / sets.length : 1;
S(2, 6, +matched.toFixed(2), '0.85', matched >= 0.85, matched >= 0.75, sets.filter(t => new Set(t.seats.map(x => x.n)).size > 1).map(t => `${t.table}: ${t.seats.map(x => x.n).join(', ')}`));
const P90 = { piece_table: 3, piece_table_round: 5, piece_table_oak: 10, piece_blackmarble_table: 4, dvergrprops_table: 4 };
const over3 = raw.tableSets.filter(t => t.n > (P90[t.table] || 4));
const loose = (raw.loose || []).filter(x => x.wall > 1.0);
S(3, 5, over3.length + loose.length, '0 tables over their p90 seats, at most 1 loose seat', !over3.length && loose.length <= 1, over3.length + loose.length <= 3, [...over3.map(t => `${t.table} with ${t.n} seats`), ...loose.map(x => `${x.n} loose in a ${x.kind}, ${x.wall} m from a wall`)]);
const allSeats = sets.flatMap(t => t.seats.map(x => ({ ...x, table: t.table })));
const facing = allSeats.length ? allSeats.filter(x => L.angDiff(x.rel, 0) <= 45 || /^(piece_chair|dvergrprops_stool)$/.test(x.n)).length / allSeats.length : 1;
const away = allSeats.filter(x => L.angDiff(x.rel, 0) > 90 && !/^(piece_chair|dvergrprops_stool)$/.test(x.n));
S(4, 5, +facing.toFixed(2), '0.8 and none turned away', facing >= 0.8 && !away.length, facing >= 0.7, away.map(x => `${x.n} at ${x.table} turned ${x.rel}`));
const dEs = allSeats.map(x => colorDiff(x.table, x.n)).filter(Boolean).map(c => c.dE);
const dE50 = dEs.length ? q(dEs, 0.5) : 0, dEmax = dEs.length ? Math.max(...dEs) : 0;
S(5, 6, `p50 ${dE50}, max ${dEmax.toFixed(1)}`, 'p50 10 or less, none over 25', dE50 <= 10 && dEmax <= 25, dE50 <= 12.5, allSeats.filter(x => { const c = colorDiff(x.table, x.n); return c && c.dE > 25; }).map(x => `${x.n} at ${x.table}`));
const luma = n => { const h = L.COLOR.get(n); if (!h) return null; const v = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const spreads = raw.rooms.map(r => (r.tone || []).map(luma).filter(v => v != null)).filter(l => l.length >= 2).map(l => Math.max(...l) - Math.min(...l));
const sp50 = spreads.length ? q(spreads, 0.5) : 0;
S(6, 4, sp50, '43 or less', sp50 <= 43, sp50 <= 54, []);
const AVOID = [['marble_furniture', 'rustic_furniture'], ['bone', 'rustic_furniture'], ['ashwood', 'hide'], ['iron_props', 'log'], ['runed_furniture', 'rustic_furniture']];
const avoidHits = raw.rooms.filter(r => AVOID.some(([a, b]) => (r.fams || []).includes(a) && (r.fams || []).includes(b))).map(r => `${r.kind} at (${r.cx}, ${r.cz}): ${r.fams.join(', ')}`);
S(7, 5, avoidHits.length, '0 rooms', !avoidHits.length, avoidHits.length <= 1, avoidHits);
const overK = [];
for (const r of raw.rooms) { const t = ck[r.kind]; if (!t) continue; for (const ty of ['table', 'seat', 'bed', 'chest', 'light', 'rug']) { const c = r.counts[ty] || 0, cap = t.counts[ty] && t.counts[ty].p90_when; if (cap != null && c > Math.ceil(cap)) overK.push(`${r.kind} at (${r.cx}, ${r.cz}): ${c} ${ty} (p90 ${cap})`); } }
S(8, 8, overK.length, 'at most 1 count over the kind p90', overK.length <= 1, overK.length <= 3, overK);
const lk = indoor['light kinds'] || 0, ml = indoor['main light share'] || 1;
S(9, 6, `${lk} kinds, main ${ml}`, '3 or fewer, main 0.5 or more', lk <= 3 && ml >= 0.5, lk <= 4, []);
const CAPS = { piece_walltorch: 10, piece_groundtorch_wood: 10, Candle_resin: 13, 'type:drape': 8, piece_logbench01: 3, piece_bench01: 4, 'type:chest': 39, itemstandh: 55, 'type:pot': 10, wood_ledge: 2 };
const capHits = Object.entries(CAPS).filter(([k, v]) => (indoor[k] || 0) > v).map(([k, v]) => `${k} ${indoor[k]} (cap ${v})`);
S(10, 8, capHits.length, '0 over the caps', !capHits.length, capHits.length <= 2, capHits);
const stackBad = raw.rooms.filter(r => r.stacked && !['storage', 'smithy', 'workshop', 'kitchen'].includes(r.kind) && r.stacked > 2).map(r => `${r.kind}: ${r.stacked} stacked`);
S(11, 4, stackBad.length, '0 rooms', !stackBad.length, stackBad.length <= 1, stackBad);
const beds = raw.beds;
const bedOk = beds.filter(b => b.headWall < 0.4 && !b.near.some(o => o.pos === 'foot' && Math.abs(o.lz) - 1.4 < 0.6 && !['chest', 'rug', 'seat', 'light', 'build'].includes(o.t)));
const sb = beds.length ? bedOk.length / beds.length : 1;
S(12, 5, +sb.toFixed(2), '0.75 or more', sb >= 0.75, sb >= 0.5, beds.filter(b => !bedOk.includes(b)).map(b => `${b.n} head ${b.headWall} m from a wall`));
const exts = raw.work.flatMap(st => st.near.filter(o => /(_ext|ext\d)/.test(o.n)));
const besideShare = exts.length ? exts.filter(o => !(Math.abs(o.lx) < 0.6 && o.lz > 0)).length / exts.length : 1;
const backOk = raw.work.length ? raw.work.filter(st => st.wall < 0.6).length / raw.work.length : 1;
S(13, 5, `beside ${besideShare.toFixed(2)}, back to wall ${backOk.toFixed(2)}`, 'beside 0.9, back 0.65', besideShare >= 0.9 && backOk >= 0.65, besideShare >= 0.8, raw.work.filter(st => st.wall >= 0.6).map(st => `${st.n} back ${st.wall} m off the wall`));
const thr = raw.ways.filter(w => !w.open && w.to === 'door or stair'), foc = raw.ways.filter(w => !w.open && w.to !== 'door or stair');
const wBad = [...thr.filter(w => w.w < 1.5), ...foc.filter(w => w.w < 1.2)];
const wAll = thr.length + foc.length, wOk = wAll ? 1 - wBad.length / wAll : 1, wLow = [...thr, ...foc].filter(w => w.w < 1.0);
S(14, 6, +wOk.toFixed(2), '0.75 of ways 1.5 m or more (1.2 m to a focal), none under 1.0 m', wOk >= 0.75 && !wLow.length, wOk >= 0.5, wBad.map(w => `${w.kind}: ${w.to} ${w.w} m`));
const DEP = { bedroom: 2.5, home: 1.75, dining: 2.0, 'throne hall': 3.5, 'feast hall': 2.9, workshop: 2.25, 'tavern hall': 3.0, smithy: 2.0, kitchen: 1.5 };
const dRooms = raw.doors.filter(x => !x.open && DEP[x.kind]), dBad = dRooms.filter(x => x.depth < DEP[x.kind]);
const dOk = dRooms.length ? 1 - dBad.length / dRooms.length : 1;
S(15, 4, +dOk.toFixed(2), '0.5 of doors at or over the kind p50 depth', dOk >= 0.5, dOk >= 0.25, dBad.map(x => `${x.kind} door: ${x.depth} m (p50 ${DEP[x.kind]})`));
const hung = raw.walls.filter(w => !/Candle/.test(w.n)), wallBad = hung.filter(w => w.off > 0.5 || w.off < -0.25);
const hOk = hung.length ? 1 - wallBad.length / hung.length : 1;
S(16, 6, +hOk.toFixed(2), '0.9 of hung pieces within the corpus p10 to p90 of their wall offset (-0.25 to 0.5 m from the face, pivot)', hOk >= 0.9, hOk >= 0.8, wallBad.map(w => `${w.n} ${w.off} m off the wall at ${w.y} m`));
const pl = gard.planters || {}, wn = gard.windows || {};
const plShare = wn.planterShare || 0, offC = pl.offCenter ? pl.offCenter.p90 : 0;
S(17, 3, `planters on ${plShare} of windows, off center p90 ${offC}`, '0.10 or less, centered within 0.6 m', plShare <= 0.1 && (offC == null || offC <= 0.6), plShare <= 0.15, []);
const cl = gard.clusters || {};
const one = cl.oneSpecies == null ? 1 : cl.oneSpecies;
S(18, 4, `one species ${one}`, '0.6 or more', one >= 0.6, one >= 0.5, []);
const ga = gard.gardens || {};
const atWall = ga.atWall == null ? 1 : ga.atWall;
S(19, 2, `gardens at a wall ${atWall}`, '1.0', atWall >= 0.999, atWall >= 0.5, []);

const total = items.reduce((a, x) => a + x.points, 0), hardFails = hard.filter(h => h.fail);
const pass = total >= 80 && !hardFails.length;
const out = { design: path.basename(file), pass, points: total, hardFails: hardFails.map(h => h.id), hard, items, work };
if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify(out, null, 1));
console.log(`${path.basename(file)}: ${pass ? 'PASS' : 'FAIL'} ${total} of 100, hard fails ${hardFails.length}`);
for (const h of hard) console.log(`  ${h.fail ? 'FAIL' : 'ok  '} ${h.id}${h.fail ? ': ' + h.detail.slice(0, 4).join('; ') : ''}`);
for (const x of items) console.log(`  ${String(x.points).padStart(3)}/${x.weight} item ${x.id}: ${x.value} (target ${x.target})${x.points < x.weight && x.detail.length ? ': ' + x.detail.slice(0, 3).join('; ') : ''}`);
