// Sums the chunks of lab/measure_corpus.js into data/measures-trim.json, data/measures-decks.json and
// data/measures-storeys.json, and writes the doc tables as markdown.
//   node lab/measure_merge.js <outdir> <chunk.json>...      writes <outdir>/measures-*.json and <outdir>/measures.md
const fs = require('fs'), path = require('path');
const outDir = process.argv[2], chunks = process.argv.slice(3);
const all = [];
let files = 0;
for (const c of chunks) { const d = JSON.parse(fs.readFileSync(c, 'utf8')); files += d.files; all.push(...d.records); }
const skips = {}, errors = all.filter(r => r.error).length;
for (const r of all) if (r.skip) skips[r.skip] = (skips[r.skip] || 0) + 1;
const B = all.filter(r => r.trim); // builds read
const r2 = v => v == null ? null : +v.toFixed(2);
const qt = (a, t) => { if (!a.length) return null; const v = a.slice().sort((x, y) => x - y); return v[Math.min(v.length - 1, Math.floor(v.length * t))]; };
const Q = a => a.length ? { n: a.length, p25: r2(qt(a, 0.25)), median: r2(qt(a, 0.5)), p75: r2(qt(a, 0.75)), min: r2(a.reduce((x, y) => Math.min(x, y), Infinity)), max: r2(a.reduce((x, y) => Math.max(x, y), -Infinity)) } : { n: 0 };
const pct = (a, b) => b ? +(100 * a / b).toFixed(0) : null;
const sum = (o, k, v) => { o[k] = (o[k] || 0) + v; };
const share = (m, keys) => { const t = keys.reduce((s, k) => s + (m[k] || 0), 0); return Object.fromEntries(keys.map(k => [k, pct(m[k] || 0, t)])); };
const MIN = 10; // groups smaller than this are listed as counts only

const md = [];
const table = (head, rows) => { md.push('| ' + head.join(' | ') + ' |', '|' + head.map(() => '---').join('|') + '|'); for (const r of rows) md.push('| ' + r.map(v => v == null ? '' : v).join(' | ') + ' |'); md.push(''); };
const qs = x => x && x.n ? `${x.p25} / ${x.median} / ${x.p75}` : '';

// ================================================================ trim
const pitched = r => Object.entries(r.trim.pitch).filter(([k]) => !k.startsWith('slopeBeam') && !k.endsWith('|00-03')).reduce((s, [, v]) => s + v, 0);
const T = { builds: B.length, files, skipped: skips, errors };
const freeOf = r => (r.trim.kinds.beam || 0) + (r.trim.kinds.pole || 0), slopeOf = r => r.trim.kinds.slopeBeam || 0;
T.shareBuilds = {
  anyTrim: pct(B.filter(r => r.trim.trimAll > 0).length, B.length),
  anyTilted: pct(B.filter(r => r.trim.tilted > 0).length, B.length),
  anySlopeBeam: pct(B.filter(r => slopeOf(r) > 0).length, B.length),
  anyFreeTilt: pct(B.filter(r => freeOf(r) > 0).length, B.length),
  anyPitchedFree: pct(B.filter(r => pitched(r) > 0).length, B.length),
  anyTiltedBeam: pct(B.filter(r => r.trim.kinds.beam > 0).length, B.length),
  anyLeaningPole: pct(B.filter(r => r.trim.kinds.pole > 0).length, B.length),
  anyBrace: pct(B.filter(r => r.trim.place.brace > 0).length, B.length),
  anyGableCross: pct(B.filter(r => r.trim.place.gableCross > 0).length, B.length),
  anyXBrace: pct(B.filter(r => r.trim.place.xBrace > 0).length, B.length),
  anyRoofSlope: pct(B.filter(r => r.trim.place.roofSlope > 0).length, B.length),
  anyLoose: pct(B.filter(r => r.trim.place.loose > 0).length, B.length),
};
const withTilt = B.filter(r => r.trim.tilted > 0), withFree = B.filter(r => freeOf(r) > 0);
T.countPerBuild = { tiltedAll_builds_with_any: Q(withTilt.map(r => r.trim.tilted)), freeTilt_builds_with_any: Q(withFree.map(r => freeOf(r))), pitchedFree_builds_with_any: Q(B.filter(r => pitched(r) > 0).map(pitched)), slopeBeam_builds_with_any: Q(B.filter(r => slopeOf(r) > 0).map(slopeOf)),
  tiltedAll_every_build: Q(B.map(r => r.trim.tilted)), freeShareOfTrim_pct_builds_with_any: Q(withFree.map(r => 100 * freeOf(r) / r.trim.trimAll)) };
const sumMaps = (rs, key) => { const m = {}; for (const r of rs) for (const [k, v] of Object.entries(r.trim[key])) sum(m, k, v); return m; };
const PB = ['00-03', '03-10', '10-20', '20-35', '35-55', '55-75', '75-90'], YB = ['00-03', '03-10', '10-25', '25-40', '40-45'];
T.pitchBins = {}; T.yawBins = {};
for (const k of ['beam', 'slopeBeam', 'pole']) {
  const pm = sumMaps(B, 'pitch'), ym = sumMaps(B, 'yaw');
  const pa = Object.fromEntries(PB.map(b => [b, pm[k + '|' + b] || 0])), ya = Object.fromEntries(YB.map(b => [b, ym[k + '|' + b] || 0]));
  T.pitchBins[k] = { n: Object.values(pa).reduce((a, b) => a + b, 0), counts: pa, pct: share(pa, PB) };
  T.yawBins[k] = { n: Object.values(ya).reduce((a, b) => a + b, 0), counts: ya, pct: share(ya, YB) };
}
const PL = ['roofSlope', 'roofOther', 'brace', 'gableCross', 'xBrace', 'loose'];
const placeBlock = rs => {
  const m = sumMaps(rs, 'place'), kp = sumMaps(rs, 'kindPlace');
  const o = { n: Object.values(m).reduce((a, b) => a + b, 0), counts: m, pct: share(m, PL), buildsWith: Object.fromEntries(PL.map(p => [p, pct(rs.filter(r => r.trim.place[p] > 0).length, rs.length)])), byKind: {} };
  for (const k of ['beam', 'slopeBeam', 'pole']) { const x = Object.fromEntries(PL.map(p => [p, kp[k + '|' + p] || 0])); o.byKind[k] = { n: Object.values(x).reduce((a, b) => a + b, 0), pct: share(x, PL) }; }
  return o;
};
T.places = placeBlock(B);
T.yawReference = { wall: B.reduce((s, r) => s + r.trim.yawRef.wall, 0), axis: B.reduce((s, r) => s + r.trim.yawRef.axis, 0) };
T.lengths = Q(withTilt.flatMap(r => r.trim.len));
const groupBy = (rs, f) => { const g = {}; for (const r of rs) (g[f(r)] = g[f(r)] || []).push(r); return g; };
const trimGroup = rs => ({ builds: rs.length, anyTilted: pct(rs.filter(r => r.trim.tilted > 0).length, rs.length), anyFreeTilt: pct(rs.filter(r => freeOf(r) > 0).length, rs.length), anySlopeBeam: pct(rs.filter(r => slopeOf(r) > 0).length, rs.length),
  freePerBuild: Q(rs.filter(r => freeOf(r) > 0).map(freeOf)), slopePerBuild: Q(rs.filter(r => slopeOf(r) > 0).map(slopeOf)), places: placeBlock(rs).pct });
T.byCulture = {}; T.byBiome = {}; T.byType = {};
for (const [k, rs] of Object.entries(groupBy(B, r => r.culture))) T.byCulture[k] = trimGroup(rs);
for (const [k, rs] of Object.entries(groupBy(B, r => r.biome))) T.byBiome[k] = trimGroup(rs);
for (const [k, rs] of Object.entries(groupBy(B, r => r.type))) T.byType[k] = trimGroup(rs);

md.push('### Tilted trim', '');
md.push(`Builds read: ${B.length} of ${files} files (skipped: ${Object.entries(skips).map(([k, v]) => k + ' ' + v).join(', ')}).`, '');
table(['Share of builds with', '%'], Object.entries(T.shareBuilds).map(([k, v]) => [k, v]));
table(['Count per build (builds that have any)', 'n builds', '25th / median / 75th', 'max'],
  Object.entries(T.countPerBuild).map(([k, v]) => [k, v.n, qs(v), v.max]));
table(['Piece kind', 'n pieces', ...PB.map(b => 'pitch ' + b), ...YB.map(b => 'yaw ' + b)],
  ['beam', 'slopeBeam', 'pole'].map(k => [k, T.pitchBins[k].n, ...PB.map(b => T.pitchBins[k].pct[b] + '%'), ...YB.map(b => T.yawBins[k].pct[b] + '%')]));
table(['Place', 'n pieces', '% of pieces', '% of builds having one', '% of beam', '% of slopeBeam', '% of pole'],
  PL.map(p => [p, T.places.counts[p] || 0, T.places.pct[p], T.places.buildsWith[p], T.places.byKind.beam.pct[p], T.places.byKind.slopeBeam.pct[p], T.places.byKind.pole.pct[p]]));
const grpRows = g => Object.entries(g).sort((a, b) => b[1].builds - a[1].builds).filter(([, v]) => v.builds >= MIN).map(([k, v]) => [k, v.builds, v.anyTilted, v.anyFreeTilt, v.anySlopeBeam, qs(v.freePerBuild), qs(v.slopePerBuild), ...PL.map(p => v.places[p])]);
const tHead = g => [g, 'builds', '% any tilted', '% free tilt', '% slope beam', 'free tilt / build', 'slope beam / build', ...PL.map(p => '% ' + p)];
md.push('By culture (groups of ' + MIN + ' builds or more; unsorted is the rest):', ''); table(tHead('Culture'), grpRows(T.byCulture));
md.push('By biome:', ''); table(tHead('Biome'), grpRows(T.byBiome));

// ================================================================ decks and low walls
const DB = B.filter(r => r.decks && r.decks.enclosed);
const Dd = { builds: B.length, withEnclosure: DB.length, singleBuilding: DB.filter(r => r.single).length };
const comps = rs => rs.flatMap(r => r.decks.decks);
const raised = r => r.decks.decks.some(d => d.band !== 'ground');
const hasCls = (r, c) => r.decks.runs.some(x => x.cls === c);
Dd.shareBuilds = {
  anyFloorOutside: pct(DB.filter(r => r.decks.decks.length).length, DB.length),
  groundTerrace: pct(DB.filter(r => r.decks.decks.some(d => d.band === 'ground')).length, DB.length),
  lowDeck: pct(DB.filter(r => r.decks.decks.some(d => d.band === 'low')).length, DB.length),
  highDeckOrBalcony: pct(DB.filter(r => r.decks.decks.some(d => d.band === 'high')).length, DB.length),
  raisedDeckAny: pct(DB.filter(raised).length, DB.length),
  deckTouchingWalls: pct(DB.filter(r => r.decks.decks.some(d => d.touch && d.band !== 'ground')).length, DB.length),
  freestandingPlatform: pct(DB.filter(r => r.decks.decks.some(d => !d.touch && d.band !== 'ground')).length, DB.length),
  fence: pct(DB.filter(r => hasCls(r, 'fence')).length, DB.length),
  lowWallInYard: pct(DB.filter(r => hasCls(r, 'lowWall')).length, DB.length),
  lowWallOnDeck: pct(DB.filter(r => hasCls(r, 'deckWall')).length, DB.length),
  railOnDeck: pct(DB.filter(r => hasCls(r, 'deckRail')).length, DB.length),
  railInYard: pct(DB.filter(r => hasCls(r, 'yardRail')).length, DB.length),
  anyLowWallOrRailOrFence: pct(DB.filter(r => r.decks.runs.length).length, DB.length),
};
Dd.deckSize = {}; Dd.where = {}; Dd.piecesByBand = {};
for (const band of ['ground', 'low', 'high']) {
  const cs = comps(DB).filter(d => d.band === band);
  Dd.deckSize[band] = { components: cs.length, areaM2: Q(cs.map(d => d.area)), heightM: Q(cs.map(d => d.top)), perBuildWithAny: Q(DB.map(r => r.decks.decks.filter(d => d.band === band).length).filter(v => v > 0)) };
  const w = {}; for (const d of cs) sum(w, d.where, 1);
  Dd.where[band] = { n: cs.length, counts: w, pct: share(w, Object.keys(w)) };
  const nm = {}; for (const d of cs) for (const [k, v] of Object.entries(d.names)) sum(nm, k, v);
  const t = Object.values(nm).reduce((a, b) => a + b, 0);
  Dd.piecesByBand[band] = Object.entries(nm).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => [k, pct(v, t)]);
}
// where, for builds with one door side known (a front)
const withFront = DB.filter(r => r.single && r.frontSide !== 'none');
Dd.whereWithFront = {};
for (const band of ['low', 'high']) { const w = {}; for (const r of withFront) for (const d of r.decks.decks.filter(d => d.band === band)) sum(w, d.where, 1); Dd.whereWithFront[band] = { builds: withFront.length, n: Object.values(w).reduce((a, b) => a + b, 0), pct: share(w, Object.keys(w)) }; }
Dd.runs = {};
for (const c of ['fence', 'lowWall', 'deckWall', 'deckRail', 'yardRail']) {
  const rn = DB.flatMap(r => r.decks.runs.filter(x => x.cls === c));
  const w = {}; for (const x of rn) sum(w, x.where, 1);
  const nm = {}; for (const x of rn) for (const [k, v] of Object.entries(x.names)) sum(nm, k, v);
  const t = Object.values(nm).reduce((a, b) => a + b, 0);
  Dd.runs[c] = { runs: rn.length, lengthM: Q(rn.map(x => x.len)), heightM: Q(rn.map(x => x.top)), piecesPerRun: Q(rn.map(x => x.n)), runsPerBuildWithAny: Q(DB.map(r => r.decks.runs.filter(x => x.cls === c).length).filter(v => v > 0)),
    totalLengthPerBuildM: Q(DB.map(r => r.decks.runs.filter(x => x.cls === c).reduce((s, x) => s + x.len, 0)).filter(v => v > 0)), wherePct: share(w, Object.keys(w)), pieces: Object.entries(nm).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => [k, pct(v, t)]) };
}
const dGroup = rs => ({ builds: rs.length, raisedDeck: pct(rs.filter(raised).length, rs.length), lowDeck: pct(rs.filter(r => r.decks.decks.some(d => d.band === 'low')).length, rs.length), highDeck: pct(rs.filter(r => r.decks.decks.some(d => d.band === 'high')).length, rs.length),
  groundTerrace: pct(rs.filter(r => r.decks.decks.some(d => d.band === 'ground')).length, rs.length),
  fence: pct(rs.filter(r => hasCls(r, 'fence')).length, rs.length), lowWall: pct(rs.filter(r => hasCls(r, 'lowWall') || hasCls(r, 'deckWall')).length, rs.length),
  rail: pct(rs.filter(r => hasCls(r, 'deckRail') || hasCls(r, 'yardRail')).length, rs.length),
  deckAreaM2: Q(rs.flatMap(r => r.decks.decks.filter(d => d.band !== 'ground').map(d => d.area))) });
Dd.byCulture = {}; Dd.byBiome = {}; Dd.byType = {};
for (const [k, rs] of Object.entries(groupBy(DB, r => r.culture))) Dd.byCulture[k] = dGroup(rs);
for (const [k, rs] of Object.entries(groupBy(DB, r => r.biome))) Dd.byBiome[k] = dGroup(rs);
for (const [k, rs] of Object.entries(groupBy(DB, r => r.type))) Dd.byType[k] = dGroup(rs);

md.push('### Decks, low walls and railings', '');
md.push(`Builds with a walled room (full-height walls enclosing 6 m2 or more): ${DB.length} of ${B.length}; ${Dd.singleBuilding} of them hold one main building.`, '');
table(['Share of builds with', '%'], Object.entries(Dd.shareBuilds).map(([k, v]) => [k, v]));
table(['Floor outside the walls', 'components', 'area m2 (25th / median / 75th)', 'top over ground m (25th / median / 75th)', 'per build (25th / median / 75th)', 'where %: front / back / side / round / longSide / endSide / noDoor'],
  ['ground', 'low', 'high'].map(b => [b, Dd.deckSize[b].components, qs(Dd.deckSize[b].areaM2), qs(Dd.deckSize[b].heightM), qs(Dd.deckSize[b].perBuildWithAny), ['front', 'back', 'side', 'round', 'longSide', 'endSide', 'noDoor'].map(w => Dd.where[b].pct[w] || 0).join(' / ') + ' %']));
table(['Band', 'top floor pieces (% of floor cells)'], ['ground', 'low', 'high'].map(b => [b, Dd.piecesByBand[b].map(([k, v]) => k + ' ' + v).join(', ')]));
table(['Run', 'runs', 'length m (25th / median / 75th)', 'height m (25th / median / 75th)', 'pieces per run', 'runs per build', 'total m per build', 'where %', 'top pieces %'],
  Object.entries(Dd.runs).map(([c, v]) => [c, v.runs, qs(v.lengthM), qs(v.heightM), qs(v.piecesPerRun), qs(v.runsPerBuildWithAny), qs(v.totalLengthPerBuildM), Object.entries(v.wherePct).map(([k, p]) => k + ' ' + p).join(', '), v.pieces.map(([k, p]) => k + ' ' + p).join(', ')]));
const dRows = g => Object.entries(g).sort((a, b) => b[1].builds - a[1].builds).filter(([, v]) => v.builds >= MIN).map(([k, v]) => [k, v.builds, v.raisedDeck, v.lowDeck, v.highDeck, v.groundTerrace, v.fence, v.lowWall, v.rail, qs(v.deckAreaM2)]);
const dHead = g => [g, 'builds', '% raised deck', '% low deck', '% high deck/balcony', '% ground terrace', '% fence', '% low wall', '% rail', 'raised deck area m2'];
md.push('By biome:', ''); table(dHead('Biome'), dRows(Dd.byBiome));
md.push('By culture:', ''); table(dHead('Culture'), dRows(Dd.byCulture));
md.push('By building type:', ''); table(dHead('Type'), dRows(Dd.byType));

// ================================================================ storeys and density
const SB = B.filter(r => r.st && r.st.buildings.length);
const S = { builds: SB.length };
const stBin = n => n >= 4 ? '4+' : String(n);
const TYPES = ['home', 'hall', 'tavern', 'workshop', 'tower', 'storehouse', 'temple', 'other'];
const mains = SB.map(r => ({ r, b: r.st.buildings[0] }));
const stBlock = (list, full = true) => {
  const c = {}; for (const b of list) sum(c, stBin(b.storeys), 1);
  const fp = {};
  if (full) for (const k of ['1', '2', '3', '4+']) { const l = list.filter(b => stBin(b.storeys) === k); fp[k] = { n: l.length, roofAreaM2: Q(l.map(b => b.area)), eaveM: Q(l.map(b => b.eave).filter(v => v != null)), widthM: Q(l.map(b => Math.min(b.w, b.l))), lengthM: Q(l.map(b => Math.max(b.w, b.l))) }; }
  return { n: list.length, counts: c, pct: share(c, ['1', '2', '3', '4+']), footprintByStoreys: fp, roofAreaM2: Q(list.map(b => b.area)), storeysMean: r2(list.reduce((s, b) => s + b.storeys, 0) / Math.max(1, list.length)) };
};
S.mainBuildingByType = {};
for (const t of TYPES) S.mainBuildingByType[t] = stBlock(mains.filter(m => m.r.type === t).map(m => m.b));
S.mainBuildingAll = stBlock(mains.map(m => m.b));
S.allBuildingsInFiles = stBlock(SB.flatMap(r => r.st.buildings), false);
S.outbuildings = stBlock(SB.flatMap(r => r.st.buildings.slice(1)), false);
S.mainBuildingByBiome = {}; S.homesByCulture = {};
for (const [k, l] of Object.entries(groupBy(mains.filter(m => m.r.type === 'home'), m => m.r.biome))) S.mainBuildingByBiome[k] = stBlock(l.map(m => m.b), false);
for (const [k, l] of Object.entries(groupBy(mains.filter(m => m.r.type === 'home'), m => m.r.culture))) S.homesByCulture[k] = stBlock(l.map(m => m.b), false);
// density: files with two or more buildings
const MB = SB.filter(r => r.st.buildings.length >= 2);
const gapOf = b => b.gap;
const gapBin = g => g < 1 ? '0-1' : g < 2 ? '1-2' : g < 4 ? '2-4' : g < 8 ? '4-8' : '8+';
const GB = ['0-1', '1-2', '2-4', '4-8', '8+'];
const gapBlock = rs => {
  const gaps = rs.flatMap(r => r.st.buildings.map(gapOf)).filter(g => g != null);
  const c = {}; for (const g of gaps) sum(c, gapBin(g), 1);
  return { files: rs.length, buildings: rs.reduce((s, r) => s + r.st.buildings.length, 0), buildingsPerFile: Q(rs.map(r => r.st.buildings.length)), nearestGapM: Q(gaps), gapPct: share(c, GB),
    roofAreaPerBuildingM2: Q(rs.flatMap(r => r.st.buildings.map(b => b.area))), storeysMean: r2(rs.flatMap(r => r.st.buildings).reduce((s, b) => s + b.storeys, 0) / Math.max(1, rs.reduce((s, r) => s + r.st.buildings.length, 0))) };
};
const folderGroup = r => r.folder === 'village' ? 'village' : r.folder === 'castle' ? 'castle' : ['starter-home', 'longhouse', 'tavern', 'blacksmith', 'storage', 'tower', 'temple'].includes(r.folder) ? 'type folders' : 'other folders';
S.density = { all: gapBlock(MB), byFolderGroup: {}, bySize: {}, byBiome: {} };
for (const [k, rs] of Object.entries(groupBy(MB, folderGroup))) S.density.byFolderGroup[k] = gapBlock(rs);
for (const [k, rs] of Object.entries(groupBy(MB, r => r.st.buildings.length >= 10 ? '10+ buildings' : r.st.buildings.length >= 4 ? '4-9 buildings' : '2-3 buildings'))) S.density.bySize[k] = gapBlock(rs);
for (const [k, rs] of Object.entries(groupBy(MB, r => r.biome))) S.density.byBiome[k] = gapBlock(rs);
// do tall buildings sit tighter? gap by storeys of the building
const gs = {}; for (const r of MB) for (const b of r.st.buildings) if (b.gap != null) (gs[stBin(b.storeys)] = gs[stBin(b.storeys)] || []).push(b.gap);
S.gapByStoreys = Object.fromEntries(Object.entries(gs).map(([k, v]) => [k, Q(v)]));
// storeys in dense files (median nearest gap under 4 m) against sparse ones
const denseF = MB.filter(r => qt(r.st.buildings.map(gapOf).filter(g => g != null), 0.5) < 4), sparseF = MB.filter(r => !(qt(r.st.buildings.map(gapOf).filter(g => g != null), 0.5) < 4));
S.denseVsSparse = { dense_median_gap_under_4m: stBlock(denseF.flatMap(r => r.st.buildings), false), sparse: stBlock(sparseF.flatMap(r => r.st.buildings), false), denseFiles: denseF.length, sparseFiles: sparseF.length };

md.push('### Storeys and density', '');
md.push(`Builds with a roofed building (10 m2 of roof or more): ${SB.length}. A storey is a floor level 2.4 m or more above the one below with 6 m2 of floor or more, plus the ground level. The main building is the largest roofed cluster of a file; it takes the type of the file (folder, or words in the title for the general folders).`, '');
table(['Type (main building)', 'n', '1 storey %', '2 %', '3 %', '4+ %', 'mean', 'roof area m2 (25th / median / 75th)', 'eave height m'],
  [...TYPES.map(t => [t, S.mainBuildingByType[t]]), ['all main buildings', S.mainBuildingAll], ['outbuildings in the same files', S.outbuildings]].map(([t, v]) => [t, v.n, v.pct['1'], v.pct['2'], v.pct['3'], v.pct['4+'], v.storeysMean, qs(v.roofAreaM2), qs(Q(mains.filter(m => t === 'all main buildings' || m.r.type === t).map(m => m.b.eave).filter(x => x != null)))]));
md.push('Footprint by storey count (roof area m2, 25th / median / 75th, and n):', '');
table(['Type', '1 storey', '2 storeys', '3 storeys', '4+ storeys'],
  [...TYPES.map(t => [t, S.mainBuildingByType[t]]), ['all main buildings', S.mainBuildingAll]].map(([t, v]) => [t, ...['1', '2', '3', '4+'].map(k => v.footprintByStoreys[k].n >= 3 ? `${qs(v.footprintByStoreys[k].roofAreaM2)} (${v.footprintByStoreys[k].n})` : `(${v.footprintByStoreys[k].n})`)]));
md.push('Homes by biome:', '');
table(['Biome', 'n', '1 %', '2 %', '3 %', '4+ %'], Object.entries(S.mainBuildingByBiome).filter(([, v]) => v.n >= MIN).map(([k, v]) => [k, v.n, v.pct['1'], v.pct['2'], v.pct['3'], v.pct['4+']]));
md.push('Homes by culture:', '');
table(['Culture', 'n', '1 %', '2 %', '3 %', '4+ %'], Object.entries(S.homesByCulture).filter(([, v]) => v.n >= MIN).map(([k, v]) => [k, v.n, v.pct['1'], v.pct['2'], v.pct['3'], v.pct['4+']]));
md.push('Gap to the nearest other building (roof edge to roof edge, files with two or more buildings):', '');
const gRows = o => Object.entries(o).map(([k, v]) => [k, v.files, v.buildings, qs(v.buildingsPerFile), qs(v.nearestGapM), ...GB.map(b => v.gapPct[b]), v.storeysMean]);
const gHead = g => [g, 'files', 'buildings', 'buildings per file', 'gap m (25th / median / 75th)', ...GB.map(b => '% ' + b + ' m'), 'mean storeys'];
table(gHead('Group'), [['all', S.density.all], ...Object.entries(S.density.byFolderGroup), ...Object.entries(S.density.bySize)].map(([k, v]) => [k, v.files, v.buildings, qs(v.buildingsPerFile), qs(v.nearestGapM), ...GB.map(b => v.gapPct[b]), v.storeysMean]));
table(gHead('Biome'), Object.entries(S.density.byBiome).filter(([, v]) => v.files >= MIN).map(([k, v]) => [k, v.files, v.buildings, qs(v.buildingsPerFile), qs(v.nearestGapM), ...GB.map(b => v.gapPct[b]), v.storeysMean]));
table(['Storeys of the building', 'n gaps', 'gap m (25th / median / 75th)'], Object.entries(S.gapByStoreys).sort().map(([k, v]) => [k, v.n, qs(v)]));
table(['Files', 'n files', 'buildings', '1 %', '2 %', '3 %', '4+ %'], [['dense (median gap under 4 m)', S.denseVsSparse.denseFiles, S.denseVsSparse.dense_median_gap_under_4m], ['sparse', S.denseVsSparse.sparseFiles, S.denseVsSparse.sparse]].map(([k, n, v]) => [k, n, v.n, v.pct['1'], v.pct['2'], v.pct['3'], v.pct['4+']]));

const meta = { made: '2026-11-11', source: 'C:/Users/tyler/Downloads/Villheim-blueprints (read only); method in docs/BLUEPRINT_LAB.md "Corpus measures for trim, decks and storeys"; script lab/measure_corpus.js, lab/measure_merge.js', filesRead: files };
fs.writeFileSync(path.join(outDir, 'measures-trim.json'), JSON.stringify({ ...meta, ...T }));
fs.writeFileSync(path.join(outDir, 'measures-decks.json'), JSON.stringify({ ...meta, ...Dd }));
fs.writeFileSync(path.join(outDir, 'measures-storeys.json'), JSON.stringify({ ...meta, ...S }));
fs.writeFileSync(path.join(outDir, 'measures.md'), md.join('\n'));
console.log(md.join('\n'));
