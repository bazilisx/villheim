// The room intent planner's numbers (lib/rooms_intent.js), slimmed from track A's catalog (data/catalog/pieces.json)
// and track B's room study (data/rooms-corpus/*.json) into one file the game bundle can carry: data/intent.json.
//   node lab/build_intent_data.js
// Nothing here is chosen by hand: every number is a corpus number copied from those files (D-136).
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '../data');
const J = f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const cat = J('catalog/pieces.json'), kinds = J('rooms-corpus/kinds.json').kinds, sets = J('rooms-corpus/sets.json');
const caps = J('rooms-corpus/caps.json'), space = J('rooms-corpus/space.json'), mats = J('rooms-corpus/materials.json');

// pieces the furnishing can choose: furniture and decor kinds
const KINDS = new Set(['seat', 'table', 'bed', 'storage', 'light', 'rug', 'fire', 'station', 'station-addon', 'display-stand', 'hanging-cloth', 'container-decor', 'carving', 'sign', 'decor', 'seasonal-decor', 'resource-stack', 'statue']);
const pieces = {};
for (const [id, r] of Object.entries(cat.pieces)) {
  if (!KINDS.has(r.kind) && r.family !== 'statue') continue;
  const u = r.reuse || {}, pb = u.per_build || {}, pa = u.per_100m2_floor || {}, pl = r.placement || {}, f = r.facing || {};
  pieces[id] = {
    n: r.name, k: r.kind, f: r.family, mat: r.material, c: r.look ? r.look.mean : null, L: r.look ? r.look.L : null,
    v: r.look ? r.look.value : null, z: r.zone, m: r.mount, cov: pl.covered != null ? pl.covered : null,
    sh: u.share != null ? u.share : 0, p50: pb.p50 || null, p90: pb.p90 || null, a90: pa.p90 != null ? pa.p90 : null,
    fr: f.front || null, sure: f.sure || null, gl: r.glow ? (r.glow.color || r.glow.emission || true) : null, fo: r.formality,
    b: r.tier_biome || null, menu: r.buildable !== false && !(r.tags || []).includes('not-buildable'), sz: r.size_class || null,
    pw: r.room_pairs ? (r.room_pairs.pairs_well_with || []).slice(0, 12).map(x => [x.id, x.lift]) : [],
    rw: r.room_pairs ? (r.room_pairs.rarely_with || []).slice(0, 12).map(x => [x.id, x.lift]) : [],
  };
}

// room kinds: counts (has, p50_when, p90_when), focal shares, seat and light kinds, area and furniture density
const kOut = {};
for (const [k, v] of Object.entries(kinds)) {
  const counts = {};
  for (const [t, c] of Object.entries(v.counts || {})) counts[t] = [c.has, c.p50_when, c.p90_when];
  kOut[k] = { rooms: v.rooms, area: v.area ? [v.area.p25, v.area.p50, v.area.p75] : null, focal: v.focal || {}, counts,
    seatKinds: v.seatKinds || {}, lightKinds: v.lightKinds || {}, per10: v.furniturePer10m2 ? [v.furniturePer10m2.p25, v.furniturePer10m2.p50, v.furniturePer10m2.p75] : null,
    types: v.distinctFurnitureTypes ? [v.distinctFurnitureTypes.p25, v.distinctFurnitureTypes.p50, v.distinctFurnitureTypes.p75] : null,
    stacked: v.stackedChests || null, bedHeadWall: v.bedHeadAgainstWall != null ? v.bedHeadAgainstWall : null };
}

// table sets: seat prefab shares, seats when seated, side offset, head gap, heads used
const tables = {};
for (const [t, v] of Object.entries(sets.tableSets)) {
  tables[t] = { n: v.tables, seated: v.tables ? +(v.withSeats / v.tables).toFixed(3) : 0, seats: v.seats || {},
    per: v.seatsPerSeatedTable ? [v.seatsPerSeatedTable.p50, v.seatsPerSeatedTable.p90] : [2, 4],
    side: v.sideOffset ? v.sideOffset.p50 : null, gapSide: v.gapSide ? v.gapSide.p50 : null, gapHead: v.gapHead ? v.gapHead.p50 : null,
    heads: v.headsUsed != null ? v.headsUsed : 0, matched: v.matchedShare, combos: (v.combos || []).slice(0, 8) };
}
// beds: what stands round them, by position
const beds = {};
for (const [t, v] of Object.entries(sets.beds)) beds[t] = { n: v.beds, headWall: v.headAgainstWall, near: Object.fromEntries((v.near || []).map(([k2, s]) => [k2, s])) };
// work corners: per station the extensions with their share, distance p50 and where they stand
const work = {};
for (const [t, v] of Object.entries(sets.work)) work[t] = { n: v.stations, back: v.backToWall, near: (v.near || []).map(x => ({ n: x.n, sh: x.share, d: x.distance ? x.distance.p50 : null, where: x.where })) };

// repetition caps indoors per build (builds of 30 to 400 m2 of indoor floor)
const ind = caps.indoor.all, capOut = {};
for (const [k, v] of Object.entries(ind)) if (v && v.has != null) capOut[k] = [v.has, v.p50_when, v.p90_when, v.per100m2_p90_when || null];
const byCulture = {};
for (const [cu, v] of Object.entries(caps.byCulture || {})) byCulture[cu] = v;

const out = {
  about: 'Room intent numbers, made by lab/build_intent_data.js from data/catalog/pieces.json (track A) and data/rooms-corpus (track B). Do not edit by hand.',
  catalogVersion: cat.version, families: Object.fromEntries(Object.entries(cat.families).map(([k, v]) => [k, { mat: v.material, fo: v.formality, b: v.biome }])),
  pieces, kinds: kOut, tables, beds, work, caps: capOut, byCulture,
  doorDepth: Object.fromEntries(Object.entries(space.doorClearDepth || {}).map(([k, v]) => [k, v.p50])),
  rarely: (mats.rarelyTogether || []).map(x => [x.a, x.b, x.lift]),
};
fs.writeFileSync(path.join(dir, 'intent.json'), JSON.stringify(out));
console.log('data/intent.json', (JSON.stringify(out).length / 1024).toFixed(0), 'KB,', Object.keys(pieces).length, 'pieces,', Object.keys(kOut).length, 'room kinds');
