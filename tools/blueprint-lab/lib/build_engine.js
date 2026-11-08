// Build the generator bundle the game runs: node lib/build_engine.js [out.js]
// Default out: src/Villheim.Logic/Generator/lab.js, built into Villheim.Logic.dll as a resource and run by Jint
// (src/Villheim.Logic/Generator/LabEngine.cs). The same libraries as the request page, without the drawing, plus the
// rules-lite, scorer and interior-lite data. Run it after every change to the lab; CI runs it too before building the mod.
const fs = require('fs'), path = require('path');
const dir = __dirname;
const out = process.argv[2] || path.join(dir, '../../../src/Villheim.Logic/Generator/lab.js');
const libs = ['pieces.js', 'styles.js', 'blueprint.js', 'checks.js', 'features.js', 'decorate.js', 'generate.js', 'request.js'];
const code = libs.map(f => `// ---- ${f}\n(function () {\n${fs.readFileSync(path.join(dir, f), 'utf8')}\n})();`).join('\n');
const rules = fs.readFileSync(path.join(dir, '../data/rules-lite.json'), 'utf8').trim();
const scorer = fs.readFileSync(path.join(dir, '../data/scorer.json'), 'utf8').trim();
const interior = fs.readFileSync(path.join(dir, '../data/interior-lite.json'), 'utf8').trim();
const text = `// Villheim blueprint lab, bundled for the game. Made by tools/blueprint-lab/lib/build_engine.js; do not edit.
var window = this;
${code}
// ---- data
window.VH_RULES = ${rules};
window.VH_SCORER = ${scorer};
window.VH_INTERIOR = ${interior};
VHDecorate.setRules(VH_RULES);
// ---- entry point for the game: one request, best of 'tries' seeds
function vhMake(type, biome, culture, stage, words, seed, tries) {
  return VHRequest.make({ type: type, biome: biome, culture: culture || undefined, stage: stage, words: words, seed: seed, tries: tries }, VH_SCORER, VH_RULES);
}
function vhRead(words) { return JSON.stringify(VHRequest.read(words)); }
function vhLists() {
  return JSON.stringify({ types: Object.keys(VHStyles.TYPES), cultures: Object.keys(VHStyles.CULTURES), biomes: VHRequest.BIOME_CODES });
}
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
const before = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null;
fs.writeFileSync(out, text);
console.log(out, text.length, before === text ? 'unchanged' : 'changed');
