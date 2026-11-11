// Items on stands in the generator's houses, against the corpus (Tyler, 2026-11-10): over homes, longhouses and
// taverns in six biomes at s1d1, s2d2 and s3d3, the share of houses and of rooms with something on a stand on a table,
// on a wall, on a sill, on a shelf, at the hearth, on or over a bench or workbench, hung from a rafter or beam, and on
// a chest; the feasts; and the distinct items each house shows. Stands are read by the corpus miner's own code
// (lab/mine_stands.js scan), so a stand counts here as it counts in the builders' builds.
//   node lab/test_stands.js [seeds per request] [--gate]
// --gate exits 1 when a d3 house rate is under its target.
const G = require('../lib/generate.js'), MS = require('./mine_stands.js'), KB = require('../lib/kitbash.js'), ST = require('../lib/styles.js');
const seeds = +(process.argv[2] || 2), gate = process.argv.includes('--gate');
const types = ['home', 'longhouse', 'tavern'];
const biomes = ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains', 'Mistlands'];
// what counts as each place (the miner's anchors)
const PLACES = {
  table: /^(table|sidetable)$/, wall: /^(wall|wall:.*|beam|free)$/, sill: /^sill$/, shelf: /^(shelf|ledge|counter|walltop)$/,
  hearth: /^(mantel|wall:hearth)$/, bench: /^(bench|workbench|wall:bench|wall:workbench)$/, rafter: /^(rafter|hung|ceiling)$/, chest: /^(chest|wall:chest)$/,
};
// The corpus (lab/mine_stands.js over Tyler's 1,559 vanilla builds, 2026-11-10): of the 211 house-like builds that put
// items on stands inside, the share with each (table: of those with a table; sill: of those with a window), the
// feasts, and the distinct items (median). Targets for d3 houses sit at the corpus rate, a little under where a small
// house has fewer places than a corpus base; sills and feasts are occasional in the corpus and stay so.
const CORPUS = { table: 0.52, wall: 0.79, sill: 0.14, shelf: 0.51, hearth: 0.38, bench: 0.51, rafter: 0.38, chest: 0.33, feast: 0.21, distinct: 7 };
const TARGET = { table: 0.5, wall: 0.75, sill: 0.1, shelf: 0.45, hearth: 0.3, bench: 0.35, rafter: 0.25, chest: 0.2, feast: 0.1, distinct: 6 };
const acc = {};
const get = k => acc[k] || (acc[k] = { houses: 0, withTable: 0, withWindow: 0, rooms: 0, roomsTable: 0, has: {}, roomHas: {}, distinct: [], stands: [], feast: 0, kinds: {} });
let n = 0;
for (const type of types) for (const biome of biomes) for (const [stage, decor] of [['s1', 'd1'], ['s2', 'd2'], ['s3', 'd3']]) for (let s = 0; s < seeds; s++) {
  const d = G.generate({ type, biome, stage, decor, seed: 11 + s * 977 + n++ });
  const S = MS.newStats();
  // the held item as the blueprint writes it (lib/blueprint.js standText)
  d.pieces = d.pieces.map(p => (p.item ? { ...p, info: `${typeof p.item === 'string' ? p.item : p.item.name}:0:1` } : p));
  const recs = MS.scan(d.pieces, `${type}-${biome}-${stage}${decor}`, { cat: type, dls: 0 }, S);
  const r = S.rooms[0];
  // a stand on the sill of an opening with no window piece in it reads as a counter to the miner: it is a sill
  for (const x of recs) if (/^KS-sill/.test(d.pieces[x.i].kb || '')) x.anchor = 'sill';
  // up in the rafters: anything on a shelf or a beam over 2.2 m (most houses here have no tie beam across a room)
  for (const x of recs) if (x.kind === 'itemstandh' && x.h >= 2.2 && /^(shelf|ledge|walltop|rafter)$/.test(x.anchor)) x.anchor = 'rafter';
  const windows = KB.roomsB(d, { type, use: ST.TYPES[type].use }).some(room => KB.anchorsOf(room, d).some(a => a.anchor === 'window'));
  for (const k of [decor, `${type}|${decor}`]) {
    const A = get(k);
    A.houses++;
    const an = new Set(recs.map(x => x.anchor));
    if (r && r.tables) A.withTable++;
    if (windows || (r && r.windows)) A.withWindow++;
    for (const [p, re] of Object.entries(PLACES)) if ([...an].some(a => re.test(a)) && (p !== 'table' || (r && r.tables)) && (p !== 'sill' || windows || (r && r.windows))) A.has[p] = (A.has[p] || 0) + 1;
    if (d.pieces.some(p => /^Feast[A-Z]/.test(p.name))) A.feast++;
    A.distinct.push(new Set(recs.map(x => x.item)).size);
    A.stands.push(recs.length);
    for (const x of recs) A.kinds[x.kd] = (A.kinds[x.kd] || 0) + 1;
    // by room: the design's room rectangles
    for (const room of d.rooms || []) {
      if ((room.x1 - room.x0) * (room.z1 - room.z0) < 6) continue;
      A.rooms++;
      const inR = p => p.x > room.x0 - 0.2 && p.x < room.x1 + 0.2 && p.z > room.z0 - 0.2 && p.z < room.z1 + 0.2 && p.y > room.y - 0.3 && p.y < room.y + (room.h || 3) + 0.5;
      const here = recs.filter(x => inR(d.pieces[x.i]));
      const tables = d.pieces.some(p => p.decor && inR(p) && /^(piece_table|piece_table_round|piece_table_oak|piece_blackmarble_table|dvergrprops_table|piece_table_runed)/.test(p.name));
      if (tables) A.roomsTable++;
      for (const [p, re] of Object.entries(PLACES)) if (here.some(x => re.test(x.anchor)) && (p !== 'table' || tables)) A.roomHas[p] = (A.roomHas[p] || 0) + 1;
      if (here.length) A.roomHas.any = (A.roomHas.any || 0) + 1;
    }
  }
}
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const pct = (a, b) => (b ? Math.round(100 * a / b) : 0);
const cols = Object.keys(PLACES);
console.log(`Items on stands, ${seeds} seed(s) per request; house share (room share in brackets); table of houses or rooms with a table, sill of houses with a window`);
console.log('set'.padEnd(18) + cols.map(c => c.padStart(10)).join('') + '   feast  distinct stands');
const line = (k, A) => k.padEnd(18) + cols.map(c => {
  const h = pct(A.has[c] || 0, c === 'table' ? A.withTable : c === 'sill' ? A.withWindow : A.houses), rm = pct(A.roomHas[c] || 0, c === 'table' ? A.roomsTable : A.rooms);
  return `${h}(${rm})`.padStart(10);
}).join('') + `${String(pct(A.feast, A.houses)).padStart(8)}${String(med(A.distinct)).padStart(10)}${String(med(A.stands)).padStart(7)}`;
for (const k of Object.keys(acc).sort()) console.log(line(k, acc[k]));
console.log('corpus'.padEnd(18) + cols.map(c => String(Math.round(CORPUS[c] * 100)).padStart(10)).join('') + `${String(Math.round(CORPUS.feast * 100)).padStart(8)}${String(CORPUS.distinct).padStart(10)}`);
console.log('target d3'.padEnd(18) + cols.map(c => String(Math.round(TARGET[c] * 100)).padStart(10)).join('') + `${String(Math.round(TARGET.feast * 100)).padStart(8)}${String(TARGET.distinct).padStart(10)}`);
const D3 = acc.d3;
console.log('kinds held at d3:', Object.entries(D3.kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
const fails = [];
for (const c of cols) { const v = (D3.has[c] || 0) / Math.max(1, c === 'table' ? D3.withTable : c === 'sill' ? D3.withWindow : D3.houses); if (v < TARGET[c]) fails.push(`${c} ${Math.round(v * 100)} % < ${Math.round(TARGET[c] * 100)} %`); }
if (D3.feast / D3.houses < TARGET.feast) fails.push(`feast ${pct(D3.feast, D3.houses)} % < ${TARGET.feast * 100} %`);
if (med(D3.distinct) < TARGET.distinct) fails.push(`distinct ${med(D3.distinct)} < ${TARGET.distinct}`);
console.log(fails.length ? `under target at d3: ${fails.join('; ')}` : 'stands: every d3 rate at or over its target');
if (gate && fails.length) process.exit(1);
