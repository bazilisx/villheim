// Corpus recount with fine models: sets the counts files of lab/mine_stands.js (one per shapes setting) side by side
// and flags every target or band that moves by more than its own tolerance.
//   node lab/recount_compare.js out.json label=counts.json [label=counts.json ...]
// The first label is the base (the committed counts, colliders). Tolerances are the ones lab/test_stands.js gates with:
// a place's share of stands from 0.6 to 1.6 times the base share and never tighter than 2 points; flat stands 50 to 80 %
// of all stands; each quartile of stands and distinct items per house from 0.5 to 1.5 times; shares of furniture with a
// stand (inst) the same as a place; depths and heights in cm: 1 cm.
const fs = require('fs');
const [out, ...specs] = process.argv.slice(2);
const R = specs.map(s => { const i = s.indexOf('='); return { label: s.slice(0, i), c: JSON.parse(fs.readFileSync(s.slice(i + 1), 'utf8')) }; });
const base = R[0];
const BAND = { rate: [0.6, 1.6], pts: 0.02, flat: [0.5, 0.8], q: [0.5, 1.5] };
const band = c => [Math.max(0, Math.min(c * BAND.rate[0], c - BAND.pts)), Math.min(1, Math.max(c * BAND.rate[1], c + BAND.pts))];
const cnt = (A, ks) => ks.reduce((t, k) => t + (A[k] || 0), 0);
const FLAT = { table: ['table', 'sidetable'], shelf: ['shelf', 'ledge'], mantel: ['mantel'], counter: ['counter', 'walltop'], bench: ['bench', 'workbench'], sill: ['sill'], rafter: ['rafter'], chest: ['chest'] };
const WALL = { wall: ['wall', 'beam'], station: ['wall:workbench', 'wall:bench'], hearth: ['wall:hearth'], rafter: ['rafter'], chest: ['wall:chest'], table: ['wall:table'], bed: ['wall:bed'], door: ['wall:door'] };
const shares = (A, G) => { const n = Object.fromEntries(Object.entries(G).map(([k, v]) => [k, cnt(A, v)])), t = Object.values(n).reduce((a, b) => a + b, 0); return { n, t, s: Object.fromEntries(Object.entries(n).map(([k, v]) => [k, v / t])) }; };
const pc = v => (v == null ? '-' : (100 * v).toFixed(1) + ' %');
const rows = [], data = { runs: R.map(r => r.label), measures: {} };
function add(group, name, vals, kind, feeds, tol) {
  // vals: one number per run; kind: share | cm | count; tol: [lo, hi] band round the base (shares) or a width (cm)
  const b = vals[0];
  const flags = vals.map((v, i) => {
    if (i === 0 || v == null || b == null) return false;
    if (kind === 'share' || kind === 'rate') return v < tol[0] - 1e-9 || v > tol[1] + 1e-9;
    if (kind === 'cm') return Math.abs(v - b) > tol;
    return false;
  });
  data.measures[`${group}|${name}`] = { values: vals, flags, feeds, tol };
  rows.push({ group, name, vals, flags, kind, feeds, tol });
}
// place shares of stands, flat and wall
for (const [grp, G, key, feeds] of [['flat', FLAT, 'itemstandh', 'test_stands FLAT band'], ['wall', WALL, 'itemstand', 'test_stands WALL band']]) {
  const S = R.map(r => shares(r.c.anchors[key], G));
  for (const k of Object.keys(G)) {
    const b = S[0].s[k];
    add(grp, k, S.map(s => s.s[k]), 'share', feeds, band(b));
  }
}
// flat share of all stands in the gated places (test_stands BAND.flat)
{ const v = R.map(r => { const f = shares(r.c.anchors.itemstandh, FLAT).t, w = shares(r.c.anchors.itemstand, WALL).t; return f / (f + w); });
  add('all', 'flat share of stands', v, 'share', 'test_stands BAND.flat (50 to 80 %)', BAND.flat); }
// stacked
{ const v = R.map(r => (r.c.anchors.itemstandh.stand || 0) / Object.values(r.c.anchors.itemstandh).reduce((a, b) => a + b, 0)); add('stack', 'flat on another stand', v, 'share', 'test_stands STACK.flat', band(v[0])); }
{ const v = R.map(r => r.c.houses.stand); add('stack', 'houses with a stand on a stand', v, 'share', 'test_stands STACK.houses', band(v[0])); }
// shares of furniture with a stand
for (const k of ['table', 'fire', 'bed', 'bench', 'chest', 'window']) { const v = R.map(r => r.c.inst[k] ? r.c.inst[k].share : null); add('inst', k, v, 'share', 'test_stands INST (reported)', band(v[0])); }
// house shares
for (const k of ['table', 'wall', 'sill', 'shelf', 'mantel', 'benchOrWorkbench', 'rafter', 'chest', 'stand', 'feast']) { const v = R.map(r => r.c.houses[k]); add('houses', k, v, 'share', 'test_stands HOUSES (reported)', band(v[0])); }
// quartiles of stands and distinct items per house
for (const k of ['stands', 'distinctItems']) [0, 1, 2].forEach(i => { const v = R.map(r => r.c.houses[k][i]); add('houses', `${k} ${['q1', 'median', 'q3'][i]}`, v, 'rate', 'test_stands CORPUS_Q band (0.5 to 1.5 times)', [v[0] * BAND.q[0], v[0] * BAND.q[1]]); });
// depths: wall stand into what is behind it (clips), cm; and sinks of flat stands; heights (median), cm
for (const k of Object.keys(base.c.clips || {})) [['p25', 1], ['p50', 2], ['p75', 3], ['p90', 4]].forEach(([nm, i]) => {
  const v = R.map(r => (r.c.clips[k] ? Math.round(r.c.clips[k][i] * 1000) / 10 : null));
  add('clip', `${k} ${nm}`, v, 'cm', 'stands.js WALL_COLL 4 cm and WALL_SHOW 12 cm, test_stands wall clip line', 1);
});
for (const k of Object.keys(base.c.sinks || {})) [['p50', 2], ['p75', 3], ['p90', 4]].forEach(([nm, i]) => {
  const v = R.map(r => (r.c.sinks[k] && r.c.sinks[k].percentiles ? Math.round(r.c.sinks[k].percentiles[i] * 1000) / 10 : null));
  add('sink', `${k} ${nm}`, v, 'cm', 'stands.js flat stand sink into its support', 1);
});
for (const k of Object.keys(base.c.heights)) { const n = base.c.heights[k][5]; if (n < 30) continue;
  const v = R.map(r => (r.c.heights[k] ? Math.round(r.c.heights[k][2] * 1000) / 10 : null));
  add('height', `${k} median`, v, 'cm', 'stands.js stand heights over the floor', 1); }
{ const v = R.map(r => (r.c.stacks.rise ? Math.round(r.c.stacks.rise[2] * 1000) / 10 : null)); add('stack', 'rise median', v, 'cm', 'stands.js stacks', 1); }
data.counts = Object.fromEntries(R.map(r => [r.label, { anchors: r.c.anchors, perBuild: r.c.perBuild.n }]));
fs.writeFileSync(out, JSON.stringify(data));
const f = (r, v) => (v == null ? '-' : r.kind === 'cm' ? v.toFixed(1) : r.kind === 'rate' ? String(v) : pc(v));
console.log('| Measure | ' + R.map(r => r.label).join(' | ') + ' | Moved past tolerance | Feeds |');
console.log('|---|' + R.map(() => '---|').join('') + '---|---|');
for (const r of rows) {
  const moved = r.flags.map((x, i) => (x ? R[i].label : null)).filter(Boolean).join(', ');
  const changed = r.vals.some((v, i) => i && v !== r.vals[0]);
  if (!changed) continue;
  console.log(`| ${r.group} ${r.name} | ${r.vals.map(v => f(r, v)).join(' | ')} | ${moved || '-'} | ${r.feeds} |`);
}
console.log(`\nunchanged rows: ${rows.filter(r => r.vals.every(v => v === r.vals[0])).length} of ${rows.length}`);
console.log('flagged: ' + rows.filter(r => r.flags.some(Boolean)).map(r => `${r.group} ${r.name}`).join('; '));
