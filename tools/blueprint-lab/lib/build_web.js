// Build the one-file request page: node lib/build_web.js <out.html> [--meshes villheim-meshes.js]
// Each library goes in its own function scope; they publish themselves on window.
const fs = require('fs'), path = require('path');
const dir = __dirname;
const libs = ['pieces.js', 'shapes.js', 'mesh.js', 'styles.js', 'persona.js', 'render.js', 'blueprint.js', 'checks.js', 'features.js', 'decorate.js', 'motifs.js', 'details.js', 'kitbash.js', 'stands.js', 'layout.js', 'yards.js', 'landscape.js', 'reach.js', 'hub.js', 'generate.js', 'critic.js', 'request.js', 'repair.js', 'floorplan.js', 'audit.js'];
const interior = fs.readFileSync(path.join(dir, '../data/interior-lite.json'), 'utf8').trim();
// piece models for the renderer: the bounds only (the page has no use for colliders); the parts come from VH_MESH and
// VH_MESH_FINE through lib/mesh.js
const models = JSON.parse(fs.readFileSync(path.join(dir, '../data/piece-models.json'), 'utf8')).pieces;
const lite = {};
for (const [n, m] of Object.entries(models)) if (m.k) lite[n] = { bounds: m.bounds };
// the items the stands hold, for the renderer (lib/render.js standItems)
const itemModels = fs.readFileSync(path.join(dir, '../data/item-models.json'), 'utf8').trim();
const critic = fs.readFileSync(path.join(dir, '../data/critic.json'), 'utf8').trim();
const solids = fs.readFileSync(path.join(dir, '../data/piece-solids.json'), 'utf8').trim();
// exterior motifs the generator can use, and their weights (lib/motifs.js)
const Mo = require('./motifs.js');
const motifScores = path.join(dir, '../data/motif-scores.json');
const motifLite = Mo.lite(JSON.parse(fs.readFileSync(path.join(dir, '../data/motifs.json'), 'utf8')), fs.existsSync(motifScores) ? JSON.parse(fs.readFileSync(motifScores, 'utf8')).weights : null);
// the interior library (lib/kitbash.js), without sources and the decor table
const kitbash = JSON.stringify(require('./kitbash.js').lite(JSON.parse(fs.readFileSync(path.join(dir, '../data/kitbash-interior.json'), 'utf8'))));
// what shows of each piece (lib/mesh.js): the coarse parts of every piece (the page draws them all), the fine parts
// per piece kind as JSON text, read the first time a piece of that kind is drawn or tested
const meshLiteObj = require('./mesh.js').lite(JSON.parse(fs.readFileSync(path.join(dir, '../data/piece-models.json'), 'utf8')), { draw: true });
const meshLite = JSON.stringify(meshLiteObj);
const meshFine = require('./mesh_fine.js').byKind(meshLiteObj, JSON.parse(fs.readFileSync(path.join(dir, '../data/piece-fine.json'), 'utf8')).pieces);
const layouts = JSON.stringify(JSON.parse(fs.readFileSync(path.join(dir, '../data/room-layouts.json'), 'utf8')));
// room templates and their weights, and the corpus's stand heights (audit.js STAND_HI), as lib/build_engine.js gives
// the game, so the page builds what node builds
const rooms = JSON.parse(fs.readFileSync(path.join(dir, '../data/room-templates.json'), 'utf8'));
const roomsLite = JSON.stringify({ templates: rooms.templates.map(t => { const o = { ...t }; delete o.src; delete o.pop; delete o.area; delete o.key; delete o.ceil; delete o.doorW; return o; }) });
const scoresPath = path.join(dir, '../data/room-scores.json');
const roomWeights = fs.existsSync(scoresPath) ? JSON.stringify(JSON.parse(fs.readFileSync(scoresPath, 'utf8')).weights) : '{}';
const standsPath = path.join(dir, '../data/stands-corpus.json');
const stands = JSON.stringify({ heights: fs.existsSync(standsPath) ? JSON.parse(fs.readFileSync(standsPath, 'utf8')).heights : null });
const code = `window.VH_INTERIOR = ${interior};\nwindow.VH_KITBASH = ${kitbash};\nwindow.VH_LAYOUTS = ${layouts};\nwindow.VH_ROOMS = ${roomsLite};\nwindow.VH_ROOM_WEIGHTS = ${roomWeights};\nwindow.VH_STANDS = ${stands};\nwindow.VH_MOTIFS = ${JSON.stringify({ motifs: motifLite.motifs })};\nwindow.VH_MOTIF_WEIGHTS = ${JSON.stringify(motifLite.weights)};\nwindow.VH_CRITIC = ${critic};\nwindow.VH_SOLIDS = ${solids};\nwindow.VH_MESH = ${meshLite};\nwindow.VH_MESH_FINE = ${meshFine};\nwindow.VHModels = ${JSON.stringify({ pieces: lite })};\nwindow.VHItemModels = ${itemModels};\n` + libs.map(f => `// ---- ${f}\n(function () {\n${fs.readFileSync(path.join(dir, f), 'utf8')}\n})();`).join('\n');
const rules = fs.readFileSync(path.join(dir, '../data/rules-lite.json'), 'utf8');
const scorer = fs.readFileSync(path.join(dir, '../data/scorer.json'), 'utf8');
let html = fs.readFileSync(path.join(dir, '../web/app.html'), 'utf8');
html = html.replace('/*LIBS*/', () => code).replace('/*RULES*/', () => rules).replace('/*SCORER*/', () => scorer);
// --meshes <file.js>: the offline copy on Tyler's PC loads a local pack of decimated game meshes from beside the page
// when the file is there (made by lab/extract_models.py meshpack; never committed or published)
const mi = process.argv.indexOf('--meshes');
if (mi > 0 && process.argv[mi + 1]) {
  const src = process.argv[mi + 1].replace(/[^\w.\-]/g, '');
  html = html.replace('<script>', () => `<script src="${src}"></script>\n<script>`);
}
fs.writeFileSync(process.argv[2], html);
console.log(process.argv[2], html.length);
