// The corpus counts the decorator weighs its essentials by, per culture group, as one line of JSON for
// lib/decorate.js CORPUS_CULT (kept in the file so the web and engine bundles need no new data file).
// Usage: git show origin/design/wip-research:tools/blueprint-lab/data/culture-corpus/summary.json > /tmp/summary.json
//        node lab/culture_kinds.js /tmp/summary.json
// Per group: n furnished buildings; k: the top prefabs per kind with their uses (bed, table, seat, rug, storage,
// light); t: what lies on tables; r: relations in percent (rel and relx, pieces share): sa seats at tables, sf seats by
// fire, rl rugs layered, td tables dressed, cs chests stacked, sw seats by wall, so seats turned, to tables turned,
// ro rugs turned. Mod prefabs (prefixes and names not in vanilla) are dropped.
const s = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));
const MOD = /^(\$|GB_|kg_|VC_|MWL_|IG_|CastleKit_|mountainkit_|rae_|Pickable_|pressurePlate_)|piece_drawer|piece_bed03_bal|_Rotten_TW/;
const out = {};
const add = (k, c) => {
  if (!c.furnished) return;
  const e = { n: c.furnished, k: {}, t: (c.onTable || []).filter(([p]) => !MOD.test(p)), r: {} };
  for (const kind of ['bed', 'table', 'seat', 'rug', 'storage', 'light']) if (c.kinds && c.kinds[kind]) e.k[kind] = c.kinds[kind].top.filter(([p]) => !MOD.test(p));
  const rel = c.rel || {}, rx = c.relx || {};
  const R = { sa: rel.seatsAtTables, sf: rel.seatsByFire, rl: rel.rugsLayered, td: rel.tablesDressed, cs: (rx.chestsStacked || [])[0], sw: (rx.seatsByWall || [])[0], so: (rx.seatsOffAxis || [])[0], to: (rx.tablesOffAxis || [])[0], ro: (rx.rugsOffAxis || [])[0] };
  for (const [kk, v] of Object.entries(R)) if (v != null) e.r[kk] = v;
  out[k] = e;
};
for (const [k, c] of Object.entries(s.cultures)) add(k, c);
// all groups together: the top lists summed, the relations weighed by furnished buildings
const all = { n: 0, k: {}, t: [], r: {} }, sums = {}, rs = {};
for (const e of Object.values(out)) {
  all.n += e.n;
  for (const [kind, list] of Object.entries(e.k)) for (const [p, c] of list) { const m = sums[kind] || (sums[kind] = {}); m[p] = (m[p] || 0) + c; }
  for (const [p, c] of e.t) { const m = sums.t || (sums.t = {}); m[p] = (m[p] || 0) + c; }
  for (const [kk, v] of Object.entries(e.r)) { const x = rs[kk] || (rs[kk] = [0, 0]); x[0] += v * e.n; x[1] += e.n; }
}
for (const [kind, m] of Object.entries(sums)) { const l = Object.entries(m).sort((a, b) => b[1] - a[1]); if (kind === 't') all.t = l.slice(0, 8); else all.k[kind] = l.slice(0, 8); }
for (const [kk, [a, b]] of Object.entries(rs)) all.r[kk] = Math.round(a / b);
out.all = all;
console.log(JSON.stringify(out));
