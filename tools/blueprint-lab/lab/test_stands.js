// Items on stands in the generator's houses, against the corpus. Over homes, longhouses and taverns in six biomes at
// s1d1, s2d2 and s3d3. Stands are read by the corpus miner's own code (lab/mine_stands.js scan), so a stand counts here
// as it counts in the builders' builds, with the miner's place for it and nothing relabeled.
//
// The main measure is where a house's stands are: the share of flat stands (itemstandh) and of wall stands (itemstand)
// at each kind of place, against the corpus's shares (data/stands-corpus.json anchors). Tyler, 2026-11-10: "I rarely
// see stands on rafters. I sometimes see stands on sills. I constantly see stands on tables." The corpus agrees: 20 %
// of its tables carry a stand, 0.4 % of its windows (inst). Also gated: stands and distinct items per house (quartile,
// median, quartile). Reported only: the share of houses with at least one stand at each place (one stand is enough, so
// rare places look common there), the share of tables, fires, benches, chests and windows with a stand, feasts.
//   node lab/test_stands.js [seeds per request] [--gate] [--d3]
// --gate exits 1 when a d3 share or quartile is outside its band (BAND below). --d3 runs the d3 requests only (same
// seeds as a full run).
const G = require('../lib/generate.js'), MS = require('./mine_stands.js'), KB = require('../lib/kitbash.js'), ST = require('../lib/styles.js');
const seeds = +(process.argv[2] || 2), gate = process.argv.includes('--gate'), only3 = process.argv.includes('--d3');
const types = ['home', 'longhouse', 'tavern'];
const biomes = ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains', 'Mistlands'];

// The corpus (lab/mine_stands.js --counts over Tyler's 1,559 vanilla builds; data/stands-corpus.json), stands holding
// something inside. Every target here is read from that file, so a rerun of the miner moves them (D-136: targets come
// from what the corpus shows). Flat stands at the time of writing: of 10,940, floor 2,078, shelf 1,856, table 1,611,
// ledge 1,122, mantel 1,015, on another stand 745, none 594, other 476, counter 360, bench 216, wallside 201, rafter
// 191, sill 187, chest 99 (read at the lid), walltop 84, stair 41, workbench 32, hung 18, bed 14. Wall stands: of
// 4,787, wall 757, beam 648, over a workbench 578, by the hearth 558, rafter 533, free 448, over a chest 333, a table
// 327, a bed 208, by a door 175, a bench 141, furnside 54, ceiling 16, laid 6, chestside 5.
// The shares below are of the stands at the places this generator makes (the groups here). Floor (19 % of flat
// stands, in 140 builds) and the miner's none, other, wallside, stair, hung and bed places are left out of the base and
// reported apart; for wall stands free, furnside, ceiling, laid and chestside are left out the same way. Stands on
// another stand (6.8 % of flat stands, in 71 builds) are reported and gated apart (STACK below).
const CORPUS = require('../data/stands-corpus.json');
const AH = CORPUS.anchors.itemstandh, AW = CORPUS.anchors.itemstand, cnt = (A, ks) => ks.reduce((t, k) => t + (A[k] || 0), 0);
const FLAT = {
  table: { re: /^(table|sidetable)$/, n: cnt(AH, ['table', 'sidetable']) }, shelf: { re: /^(shelf|ledge)$/, n: cnt(AH, ['shelf', 'ledge']) }, mantel: { re: /^mantel$/, n: cnt(AH, ['mantel']) },
  counter: { re: /^(counter|walltop)$/, n: cnt(AH, ['counter', 'walltop']) }, bench: { re: /^(bench|workbench)$/, n: cnt(AH, ['bench', 'workbench']) }, sill: { re: /^sill$/, n: cnt(AH, ['sill']) },
  rafter: { re: /^rafter$/, n: cnt(AH, ['rafter']) }, chest: { re: /^chest$/, n: cnt(AH, ['chest']) },
};
const WALL = {
  wall: { re: /^(wall|beam)$/, n: cnt(AW, ['wall', 'beam']) }, station: { re: /^(wall:workbench|wall:bench)$/, n: cnt(AW, ['wall:workbench', 'wall:bench']) },
  hearth: { re: /^wall:hearth$/, n: cnt(AW, ['wall:hearth']) }, rafter: { re: /^rafter$/, n: cnt(AW, ['rafter']) }, chest: { re: /^wall:chest$/, n: cnt(AW, ['wall:chest']) },
  table: { re: /^wall:table$/, n: cnt(AW, ['wall:table']) }, bed: { re: /^wall:bed$/, n: cnt(AW, ['wall:bed']) }, door: { re: /^wall:door$/, n: cnt(AW, ['wall:door']) },
};
const APART = { floor: { re: /^floor$/, n: AH.floor || 0 }, stand: { re: /^stand$/, n: AH.stand || 0 } };
const FLAT_ALL = Object.values(AH).reduce((a, b) => a + b, 0), WALL_ALL = Object.values(AW).reduce((a, b) => a + b, 0);
const share = G0 => { const t = Object.values(G0).reduce((s, g) => s + g.n, 0); return Object.fromEntries(Object.entries(G0).map(([k, g]) => [k, g.n / t])); };
const CF = share(FLAT), CW = share(WALL);
// stands and distinct items per house-like build with stands: quartile, median, quartile (houses)
const CORPUS_Q = { distinct: CORPUS.houses.distinctItems, stands: CORPUS.houses.stands };
// house shares (reported only): of the house-like builds with stands, the share with at least one at each place
const HOUSES = { table: CORPUS.houses.table, wall: CORPUS.houses.wall, sill: CORPUS.houses.sill, shelf: CORPUS.houses.shelf, hearth: CORPUS.houses.mantel,
  bench: CORPUS.houses.benchOrWorkbench, rafter: CORPUS.houses.rafter, chest: CORPUS.houses.chest, stand: CORPUS.houses.stand, feast: CORPUS.houses.feast };
const HPLACES = {
  table: /^(table|sidetable)$/, wall: /^(wall|wall:.*|beam|free)$/, sill: /^sill$/, shelf: /^(shelf|ledge|counter|walltop)$/,
  hearth: /^(mantel|wall:hearth)$/, bench: /^(bench|workbench|wall:bench|wall:workbench)$/, rafter: /^(rafter|hung|ceiling)$/, chest: /^(chest|wall:chest)$/, stand: /^stand$/,
};
// share of each kind of furniture or opening with a stand on or over it (inst)
const INST = Object.fromEntries(['table', 'fire', 'bed', 'bench', 'chest', 'window'].map(k => [k, CORPUS.inst[k] ? CORPUS.inst[k].share : 0]));
// stands on another stand: their share of all flat stands, and the share of houses with one, each in the same band as
// a place's share (BAND.rate, BAND.pts)
const STACK = { flat: (AH.stand || 0) / FLAT_ALL, houses: CORPUS.houses.stand };

// The gate's band, for d3 houses: each place's share of stands from 0.6 to 1.6 times the corpus share, and never
// tighter than 2 points either side (so a place at 1 to 3 % of stands may sit at 0 to 5 %); flat stands 50 to 80 % of
// all stands (corpus 70 % with floor and stacked stands, the research branch's culture corpus 50 to 72 % by culture);
// each quartile and the median of stands and of distinct items per house from half to 1.5 times the corpus's.
const BAND = { rate: [0.6, 1.6], pts: 0.02, flat: [0.5, 0.8], q: [0.5, 1.5] };
// Places reported and left out of the gate, each held by something outside this pass: flat stands on a sill need a
// window piece in the opening (the miner reads a stand under an open opening as a counter or shelf; most generated
// openings have none); flat and wall stands on rafters need beams over 2.3 m (tie beams, D-128, another track), and the
// pool audit keeps a wall stand's middle at 0.7 to 2.4 m over its floor (lib/audit.js MID) where the corpus's wall
// stands on beams over 2.3 m sit higher.
const UNGATED = { flat: ['sill', 'rafter'], wall: ['rafter'] };
const band = c => [Math.max(0, Math.min(c * BAND.rate[0], c - BAND.pts)), Math.min(1, Math.max(c * BAND.rate[1], c + BAND.pts))];

const acc = {};
const get = k => acc[k] || (acc[k] = { houses: 0, withTable: 0, withWindow: 0, has: {}, distinct: [], stands: [], feast: 0, kinds: {},
  flat: {}, wall: {}, nFlat: 0, nWall: 0, inst: {}, show: [], highShelf: 0, sillAsCounter: 0, sunk: 0, wclip: [], coll: [] });
let n = 0;
for (const type of types) for (const biome of biomes) for (const [stage, decor] of [['s1', 'd1'], ['s2', 'd2'], ['s3', 'd3']]) for (let s = 0; s < seeds; s++) {
  const seed = 11 + s * 977 + n++;
  if (only3 && decor !== 'd3') continue;
  const d = G.generate({ type, biome, stage, decor, seed });
  const S = MS.newStats();
  // the held item as the blueprint writes it (lib/blueprint.js standText)
  d.pieces = d.pieces.map(p => (p.item ? { ...p, info: `${typeof p.item === 'string' ? p.item : p.item.name}:0:1` } : p));
  const recs = MS.scan(d.pieces, `${type}-${biome}-${stage}${decor}`, { cat: type, dls: 0 }, S);
  const r = S.rooms[0];
  const windows = KB.roomsB(d, { type, use: ST.TYPES[type].use }).some(room => KB.anchorsOf(room, d).some(a => a.anchor === 'window'));
  const H = d.request.household || {};
  const lean = (H.clutter || 0) + ((H.hobby && H.hobby.collect) || 0) - (H.tidy || 0) - (H.plain ? 1 : 0);
  for (const k of [decor, `${type}|${decor}`]) {
    const A = get(k);
    A.houses++;
    const an = new Set(recs.map(x => x.anchor));
    if (r && r.tables) A.withTable++;
    if (windows || (r && r.windows)) A.withWindow++;
    for (const [p, re] of Object.entries(HPLACES)) if ([...an].some(a => re.test(a)) && (p !== 'table' || (r && r.tables)) && (p !== 'sill' || windows || (r && r.windows))) A.has[p] = (A.has[p] || 0) + 1;
    if (d.pieces.some(p => /^Feast[A-Z]/.test(p.name))) A.feast++;
    A.distinct.push(new Set(recs.map(x => x.item)).size);
    A.stands.push(recs.length);
    A.show.push([lean, recs.length]);
    for (const x of recs) A.kinds[x.kd] = (A.kinds[x.kd] || 0) + 1;
    for (const x of recs) {
      const flat = x.kind === 'itemstandh';
      if (flat) A.nFlat++; else A.nWall++;
      const T = flat ? A.flat : A.wall;
      T[x.anchor] = (T[x.anchor] || 0) + 1;
      // what the old relabels would have moved: a flat stand on a shelf or ledge over 2.2 m, a sill set read as a counter
      if (flat && x.h >= 2.2 && /^(shelf|ledge|walltop)$/.test(x.anchor)) A.highShelf++;
      if (/^KS-sill/.test(d.pieces[x.i].kb || '') && x.anchor !== 'sill') A.sillAsCounter++;
      if (d.pieces[x.i].sunk) A.sunk++;
      if (!flat) A.wclip.push(d.pieces[x.i].wclip || 0);
    }
    A.coll.push(...((S.clips && S.clips.itemstand) || []));
    for (const v of (S.sinks && S.sinks.h) || []) { A.sinkN = (A.sinkN || 0) + 1; if (v > 0.06) A.sinkDeep = (A.sinkDeep || 0) + 1; }
    for (const [k2, v] of Object.entries(S.inst)) { const o = A.inst[k2] = A.inst[k2] || { n: 0, with: 0 }; o.n += v.n; o.with += v.with; }
  }
}
const qt = (a, f) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * f))] : 0; };
const mq = a => `${qt(a, 0.25)}-${qt(a, 0.5)}-${qt(a, 0.75)}`;
const pct = (a, b) => (b ? Math.round(100 * a / b) : 0);
const p1 = v => (Math.round(v * 1000) / 10).toFixed(1);
const inG = (T, G0) => { const o = {}; let t = 0; for (const [k, g] of Object.entries(G0)) { o[k] = Object.entries(T).filter(([a]) => g.re.test(a)).reduce((s, [, v]) => s + v, 0); t += o[k]; } return { o, t }; };

console.log(`Items on stands, ${seeds} seed(s) per request${only3 ? ', d3 only' : ''}. Share of stands by place (% of the stands at the places listed); corpus and band under each.`);
const table = (name, G0, CS, field) => {
  console.log(`\n${name}`.padEnd(19) + Object.keys(G0).map(c => c.padStart(9)).join('') + '      n');
  for (const k of Object.keys(acc).sort()) {
    if (/\|d1$|^d1$/.test(k)) continue;
    const { o, t } = inG(acc[k][field], G0);
    console.log(k.padEnd(18) + Object.keys(G0).map(c => (t ? p1(o[c] / t) : '-').padStart(9)).join('') + String(t).padStart(7));
  }
  console.log('corpus'.padEnd(18) + Object.keys(G0).map(c => p1(CS[c]).padStart(9)).join(''));
  console.log('band'.padEnd(18) + Object.keys(G0).map(c => band(CS[c]).map(v => Math.round(v * 100)).join('-').padStart(9)).join(''));
};
table('flat stands', FLAT, CF, 'flat');
table('wall stands', WALL, CW, 'wall');

console.log('\nper house'.padEnd(19) + '  flat %   stands q1-med-q3   distinct   sunk %   floor %  on stand %   low/high third by household (stands median)');
for (const k of Object.keys(acc).sort()) {
  const A = acc[k];
  if (!A.nFlat && !A.nWall) continue;
  const sh = A.show.slice().sort((a, b) => a[0] - b[0]), third = Math.max(1, Math.floor(sh.length / 3));
  const lo = qt(sh.slice(0, third).map(x => x[1]), 0.5), hi = qt(sh.slice(-third).map(x => x[1]), 0.5);
  console.log(k.padEnd(18) + String(pct(A.nFlat, A.nFlat + A.nWall)).padStart(8) + mq(A.stands).padStart(19) + mq(A.distinct).padStart(11)
    + String(pct(A.sinkDeep || 0, A.sinkN || 0)).padStart(9) + String(pct(A.flat.floor || 0, A.nFlat)).padStart(10) + String(pct(A.flat.stand || 0, A.nFlat)).padStart(12) + `${lo} / ${hi}`.padStart(16));
}
console.log('corpus'.padEnd(18) + String(pct(FLAT_ALL, FLAT_ALL + WALL_ALL)).padStart(8) + CORPUS_Q.stands.join('-').padStart(19) + CORPUS_Q.distinct.join('-').padStart(11)
  + String(pct(CORPUS.sinks.itemstandh.over6cm, CORPUS.sinks.itemstandh.n)).padStart(9) + p1(APART.floor.n / FLAT_ALL).padStart(10) + p1(APART.stand.n / FLAT_ALL).padStart(12));

const D3 = acc.d3;
console.log('\nhouse share at d3, reported only (one stand at a place is enough):');
console.log('  ' + Object.keys(HPLACES).map(c => `${c} ${pct(D3.has[c] || 0, c === 'table' ? D3.withTable : c === 'sill' ? D3.withWindow : D3.houses)} (${Math.round(HOUSES[c] * 100)})`).join(', ') + `, feast ${pct(D3.feast, D3.houses)} (${Math.round(HOUSES.feast * 100)})`);
console.log('share of each with a stand on or over it at d3 (corpus in brackets): ' + Object.keys(INST).map(k => `${k} ${D3.inst[k] ? p1(D3.inst[k].with / Math.max(1, D3.inst[k].n)) : '-'} (${p1(INST[k])})`).join(', '));
console.log(`kinds held at d3: ${Object.entries(D3.kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
{ const w = D3.wclip.slice().sort((x, y) => x - y), q = f => (w.length ? w[Math.min(w.length - 1, Math.floor(w.length * f))] : 0);
  const c = D3.coll.slice().sort((x, y) => x - y), qc = f => (c.length ? c[Math.min(c.length - 1, Math.floor(c.length * f))] : 0);
  console.log(`wall stands at d3 into what shows of the wall (D-127, marked clips): ${pct(w.filter(v => v > 0.005).length, w.length)} % of ${w.length}, 75th and 90th percentile ${Math.round(q(0.75) * 100)} and ${Math.round(q(0.9) * 100)} cm; into the collider behind, as the miner measures it: 75th and 90th percentile ${Math.round(qc(0.75) * 100)} and ${Math.round(qc(0.9) * 100)} cm, the deepest ${Math.round((c[c.length - 1] || 0) * 100)} (corpus 0 and 4 cm)`); }
console.log(`apart from the places above at d3: flat stands on a shelf or ledge over 2.2 m ${D3.highShelf} (counted as shelf; the miner's rafter is a beam over 2.3 m), sill sets read as counter ${D3.sillAsCounter}`);

const fails = [];
for (const [G0, CS, field, nm] of [[FLAT, CF, 'flat', 'flat'], [WALL, CW, 'wall', 'wall']]) {
  const { o, t } = inG(D3[field], G0);
  for (const c of Object.keys(G0)) { const v = t ? o[c] / t : 0, [lo, hi] = band(CS[c]); if ((v < lo - 1e-9 || v > hi + 1e-9) && !UNGATED[nm].includes(c)) fails.push(`${nm} ${c} ${p1(v)} % outside ${p1(lo)}-${p1(hi)}`); }
}
{ const v = D3.nFlat / Math.max(1, D3.nFlat + D3.nWall); if (v < BAND.flat[0] || v > BAND.flat[1]) fails.push(`flat share ${pct(D3.nFlat, D3.nFlat + D3.nWall)} % outside ${BAND.flat[0] * 100}-${BAND.flat[1] * 100} %`); }
{ const v = (D3.flat.stand || 0) / Math.max(1, D3.nFlat), [lo, hi] = band(STACK.flat); if (v < lo - 1e-9 || v > hi + 1e-9) fails.push(`flat on another stand ${p1(v)} % outside ${p1(lo)}-${p1(hi)}`);
  const h = (D3.has.stand || 0) / Math.max(1, D3.houses), [hl, hh] = band(STACK.houses); if (h < hl - 1e-9 || h > hh + 1e-9) fails.push(`houses with a stand on a stand ${pct(D3.has.stand || 0, D3.houses)} % outside ${p1(hl)}-${p1(hh)}`); }
for (const k of ['distinct', 'stands']) [0.25, 0.5, 0.75].forEach((f, i) => {
  const v = qt(D3[k], f), lo = CORPUS_Q[k][i] * BAND.q[0], hi = CORPUS_Q[k][i] * BAND.q[1];
  if (v < lo || v > hi) fails.push(`${k} ${['q1', 'median', 'q3'][i]} ${v} outside ${lo}-${hi}`);
});
console.log(`not gated: flat ${UNGATED.flat.join(', ')}; wall ${UNGATED.wall.join(', ')} (held outside this pass, see UNGATED)`);
console.log(fails.length ? `outside the band at d3: ${fails.join('; ')}` : 'stands: every gated d3 share and quartile inside its band round the corpus');
if (gate && fails.length) process.exit(1);
