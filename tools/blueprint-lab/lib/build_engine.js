// Build the generator bundle the game runs: node lib/build_engine.js [out.js]
// Default out: src/Villheim.Logic/Generator/lab.js, built into Villheim.Logic.dll as a resource and run by Jint
// (src/Villheim.Logic/Generator/LabEngine.cs). The same libraries as the request page, without the drawing, plus the
// rules-lite, scorer, interior-lite, interior library and piece-solids data. Run it after every change to the lab; CI runs it too before building the mod.
const fs = require('fs'), path = require('path');
const dir = __dirname;
const out = process.argv[2] || path.join(dir, '../../../src/Villheim.Logic/Generator/lab.js');
const libs = ['pieces.js', 'shapes.js', 'mesh.js', 'wallhang.js', 'styles.js', 'persona.js', 'blueprint.js', 'checks.js', 'features.js', 'decorate.js', 'motifs.js', 'program.js', 'details.js', 'kitbash.js', 'stands.js', 'layout.js', 'yards.js', 'landscape.js', 'reach.js', 'hub.js', 'generate.js', 'critic.js', 'request.js', 'floorplan.js', 'audit.js'];
const code = libs.map(f => `// ---- ${f}\n(function () {\n${fs.readFileSync(path.join(dir, f), 'utf8')}\n})();`).join('\n');
const rules = fs.readFileSync(path.join(dir, '../data/rules-lite.json'), 'utf8').trim();
const scorer = fs.readFileSync(path.join(dir, '../data/scorer.json'), 'utf8').trim();
const interior = fs.readFileSync(path.join(dir, '../data/interior-lite.json'), 'utf8').trim();
const critic = fs.readFileSync(path.join(dir, '../data/critic.json'), 'utf8').trim();
// the building program's rules (lib/program.js, data/architecture/rules.json)
const arch = fs.readFileSync(path.join(dir, '../data/architecture/rules.json'), 'utf8').trim();
// the game's solid colliders per piece (lib/shapes.js), for the checks and the furniture sizes
const solids = fs.readFileSync(path.join(dir, '../data/piece-solids.json'), 'utf8').trim();
// room templates (D-058) without what only the lab reads (source, popularity, area, the ID key), and Tyler's weights
const rooms = JSON.parse(fs.readFileSync(path.join(dir, '../data/room-templates.json'), 'utf8'));
const roomsLite = JSON.stringify({ templates: rooms.templates.map(t => { const o = { ...t }; delete o.src; delete o.pop; delete o.area; delete o.key; delete o.ceil; delete o.doorW; return o; }) });
const scoresPath = path.join(dir, '../data/room-scores.json');
const roomWeights = fs.existsSync(scoresPath) ? JSON.stringify(JSON.parse(fs.readFileSync(scoresPath, 'utf8')).weights) : '{}';
// exterior motifs (lib/motifs.js): the ones the generator can use, and their weights from the Motifs tab
const Mo = require('./motifs.js');
const motifScores = path.join(dir, '../data/motif-scores.json');
const motifLite = Mo.lite(JSON.parse(fs.readFileSync(path.join(dir, '../data/motifs.json'), 'utf8')), fs.existsSync(motifScores) ? JSON.parse(fs.readFileSync(motifScores, 'utf8')).weights : null);
// the interior library (lib/kitbash.js), without sources and the decor table
const kitbash = JSON.stringify(require('./kitbash.js').lite(JSON.parse(fs.readFileSync(path.join(dir, '../data/kitbash-interior.json'), 'utf8'))));
// what shows of each piece (lib/mesh.js): the model's coarse parts where they stand proud of its collider, and its
// prefab folder; the fine parts of those pieces per piece kind as JSON text, read the first time one is needed
const meshLiteObj = require('./mesh.js').lite(JSON.parse(fs.readFileSync(path.join(dir, '../data/piece-models.json'), 'utf8')));
const meshLite = JSON.stringify(meshLiteObj);
const meshFine = require('./mesh_fine.js').byKind(meshLiteObj, JSON.parse(fs.readFileSync(path.join(dir, '../data/piece-fine.json'), 'utf8')).pieces);
// the room layout rules (lib/layout.js)
const layouts = JSON.stringify(JSON.parse(fs.readFileSync(path.join(dir, '../data/room-layouts.json'), 'utf8')));
// the corpus's stand heights (lib/audit.js STAND_HI reads them when it loads, so they go before the libraries)
const standsPath = path.join(dir, '../data/stands-corpus.json');
const stands = JSON.stringify({ heights: fs.existsSync(standsPath) ? JSON.parse(fs.readFileSync(standsPath, 'utf8')).heights : null });
const text = `// Villheim blueprint lab, bundled for the game. Made by tools/blueprint-lab/lib/build_engine.js; do not edit.
var window = this;
window.VH_STANDS = ${stands};
${code}
// ---- data
window.VH_RULES = ${rules};
window.VH_SCORER = ${scorer};
window.VH_INTERIOR = ${interior};
window.VH_KITBASH = ${kitbash};
window.VH_LAYOUTS = ${layouts};
window.VH_CRITIC = ${critic};
window.VH_SOLIDS = ${solids};
window.VH_MESH = ${meshLite};
window.VH_MESH_FINE = ${meshFine};
window.VH_ROOMS = ${roomsLite};
window.VH_ROOM_WEIGHTS = ${roomWeights};
window.VH_MOTIFS = ${JSON.stringify({ motifs: motifLite.motifs })};
window.VH_MOTIF_WEIGHTS = ${JSON.stringify(motifLite.weights)};
window.VH_ARCH = ${arch};
VHDecorate.setRules(VH_RULES);
// ---- entry point for the game: one request, best of 'tries' seeds
function vhMake(type, biome, culture, stage, words, seed, tries) {
  return VHRequest.make({ type: type, biome: biome, culture: culture || undefined, stage: stage, words: words, seed: seed, tries: tries }, VH_SCORER, VH_RULES);
}
function vhRead(words) { return JSON.stringify(VHRequest.read(words)); }
// the pool audit ('vh testpool make'): files as JSON { fileName: blueprint text }, gives { gate, failed, totals, text }
function vhAudit(filesJson) {
  try {
    const r = VHAudit.pool(VHAudit.group(JSON.parse(filesJson), VHBlueprint.parse));
    return JSON.stringify({ gate: r.gate, failed: r.failed, totals: r.totals, watch: r.watch, text: VHAudit.summary(r, 3) });
  } catch (e) { return JSON.stringify({ error: String(e && e.message || e) }); }
}
// floorplans ('vh floorplan'): one plan or the first n of the catalog, as JSON { name, blueprint, signs, rows }
function vhFloorplan(shape, w, d, room, biome, culture, decor, seed, id, ladder) {
  try { return JSON.stringify(VHFloorplan.one({ shape: shape, w: w, d: d, room: room, biome: biome, culture: culture || undefined, decor: decor, seed: seed, id: id, ladder: !!ladder })); }
  catch (e) { return JSON.stringify({ error: String(e && e.message || e) }); }
}
function vhFloorplanSet(n) {
  try { return JSON.stringify(VHFloorplan.set(n)); } catch (e) { return JSON.stringify({ error: String(e && e.message || e) }); }
}
// 'vh floorplan template RT-0001 [biome]': one room template laid out as it is, for walking through a scored room
function vhFloorplanTemplate(id, biome) {
  try { return JSON.stringify(VHFloorplan.template(id, biome || undefined)); } catch (e) { return JSON.stringify({ error: String(e && e.message || e) }); }
}
function vhFloorplanLists() { return JSON.stringify({ shapes: VHFloorplan.SHAPES, rooms: VHFloorplan.ROOMS, catalog: VHFloorplan.CATALOG.length }); }
function vhLists() {
  return JSON.stringify({ types: Object.keys(VHStyles.TYPES), cultures: Object.keys(VHStyles.CULTURES), biomes: VHRequest.BIOME_CODES });
}
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
const before = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null;
fs.writeFileSync(out, text);
console.log(out, text.length, before === text ? 'unchanged' : 'changed');
