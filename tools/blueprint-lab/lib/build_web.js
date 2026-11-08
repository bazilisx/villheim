// Build the one-file request page: node lib/build_web.js <out.html>
// Each library goes in its own function scope; they publish themselves on window.
const fs = require('fs'), path = require('path');
const dir = __dirname;
const libs = ['pieces.js', 'styles.js', 'render.js', 'blueprint.js', 'checks.js', 'features.js', 'decorate.js', 'generate.js', 'repair.js'];
const code = libs.map(f => `// ---- ${f}\n(function () {\n${fs.readFileSync(path.join(dir, f), 'utf8')}\n})();`).join('\n');
const rules = fs.readFileSync(path.join(dir, '../data/rules-lite.json'), 'utf8');
const scorer = fs.readFileSync(path.join(dir, '../data/scorer.json'), 'utf8');
let html = fs.readFileSync(path.join(dir, '../web/app.html'), 'utf8');
html = html.replace('/*LIBS*/', () => code).replace('/*RULES*/', () => rules).replace('/*SCORER*/', () => scorer);
fs.writeFileSync(process.argv[2], html);
console.log(process.argv[2], html.length);
