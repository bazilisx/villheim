// Build the one-file request page: node lib/build_web.js <out.html> [--meshes villheim-meshes.js]
// Each library goes in its own function scope; they publish themselves on window.
const fs = require('fs'), path = require('path');
const dir = __dirname;
const libs = ['pieces.js', 'shapes.js', 'styles.js', 'persona.js', 'render.js', 'blueprint.js', 'checks.js', 'features.js', 'decorate.js', 'motifs.js', 'details.js', 'kitbash.js', 'layout.js', 'yards.js', 'generate.js', 'critic.js', 'request.js', 'repair.js', 'floorplan.js'];
const interior = fs.readFileSync(path.join(dir, '../data/interior-lite.json'), 'utf8').trim();
// piece models for the renderer: the proxy parts and bounds only (the page has no use for colliders)
const models = JSON.parse(fs.readFileSync(path.join(dir, '../data/piece-models.json'), 'utf8')).pieces;
const lite = {};
for (const [n, m] of Object.entries(models)) if (m.parts) lite[n] = { bounds: m.bounds, parts: m.parts };
const critic = fs.readFileSync(path.join(dir, '../data/critic.json'), 'utf8').trim();
const solids = fs.readFileSync(path.join(dir, '../data/piece-solids.json'), 'utf8').trim();
// exterior motifs the generator can use, and their weights (lib/motifs.js)
const Mo = require('./motifs.js');
const motifScores = path.join(dir, '../data/motif-scores.json');
const motifLite = Mo.lite(JSON.parse(fs.readFileSync(path.join(dir, '../data/motifs.json'), 'utf8')), fs.existsSync(motifScores) ? JSON.parse(fs.readFileSync(motifScores, 'utf8')).weights : null);
// the interior library (lib/kitbash.js), without sources and the decor table
const kitbash = JSON.stringify(require('./kitbash.js').lite(JSON.parse(fs.readFileSync(path.join(dir, '../data/kitbash-interior.json'), 'utf8'))));
const layouts = JSON.stringify(JSON.parse(fs.readFileSync(path.join(dir, '../data/room-layouts.json'), 'utf8')));
const code = `window.VH_INTERIOR = ${interior};\nwindow.VH_KITBASH = ${kitbash};\nwindow.VH_LAYOUTS = ${layouts};\nwindow.VH_MOTIFS = ${JSON.stringify({ motifs: motifLite.motifs })};\nwindow.VH_MOTIF_WEIGHTS = ${JSON.stringify(motifLite.weights)};\nwindow.VH_CRITIC = ${critic};\nwindow.VH_SOLIDS = ${solids};\nwindow.VHModels = ${JSON.stringify({ pieces: lite })};\n` + libs.map(f => `// ---- ${f}\n(function () {\n${fs.readFileSync(path.join(dir, f), 'utf8')}\n})();`).join('\n');
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
