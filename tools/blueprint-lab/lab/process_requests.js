// Makes the designs asked for with 'vh ask' in the game.
//
// node lab/process_requests.js <requests.jsonl> [result dir] [--tries N] [--only R-0003] [--redo]
//
// requests.jsonl is BepInEx/config/Villheim/requests/requests.jsonl, one JSON object per line. For every request
// with status "open" (or the one named with --only; --redo also takes requests already done), this generates the best
// of N seeds with the lab (checks first, then the keep score; N 24 unless --tries), writes <id>.blueprint and a
// four-view <id>.png to the result dir, and marks the line done: status "done", result (the design's name), file,
// done (time), note (failed checks, if any). Every other line stays as it was, byte for byte.
// Result dir: pass PlanBuild's folder in the Valheim install, <Valheim>/BepInEx/config/PlanBuild/blueprints/
// inspiration/generated/requests (D-057: next to the vh gen designs, Villheim tab). Without one it falls back to the
// profile's BepInEx/config/PlanBuild/blueprints/inspiration/generated/requests, found from the requests file's
// place, unless given. In game, 'vh place <id>' then builds it.
const fs = require('fs'), path = require('path');
const Q = require('../lib/request.js'), BP = require('../lib/blueprint.js');
const scorer = require('../data/scorer.json'), rules = require('../data/rules-lite.json');

const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const tries = +flag('--tries') || 24;
const only = flag('--only');
const redo = args.includes('--redo');
const plain = args.filter(a => !a.startsWith('--'));
const file = plain[0];
if (!file || !fs.existsSync(file)) {
  console.error('Usage: node lab/process_requests.js <requests.jsonl> [result dir] [--tries N] [--only R-0003] [--redo]');
  process.exit(2);
}
const results = plain[1] || path.resolve(path.dirname(file), '../../PlanBuild/blueprints/inspiration/generated/requests');
let sheet = null;
try { sheet = require('../lib/sheet.js').sheet; } catch (e) { console.warn('No pictures: @napi-rs/canvas is missing (npm install in tools/blueprint-lab).'); }

const text = fs.readFileSync(file, 'utf8');
const eol = text.includes('\r\n') ? '\r\n' : '\n';
const lines = text.split(/\r?\n/);
let made = 0;
for (let i = 0; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  let r;
  try { r = JSON.parse(lines[i]); } catch (e) { console.warn(`line ${i + 1}: not JSON, left as it is`); continue; }
  if (!r.id || (only && r.id.toUpperCase() !== only.toUpperCase())) continue;
  if (r.status !== 'open' && !(redo || only)) continue;
  // A request without a seed gets one from its number, so running this again makes the same design.
  const seed = +r.seed || (parseInt(String(r.id).replace(/\D/g, ''), 10) * 7919) % 99991 + 1;
  const d = Q.make({ type: r.type, biome: r.biome, culture: r.culture || undefined, stage: r.stage, words: r.request, seed, tries }, scorer, rules);
  if (d.error) {
    r.status = 'failed'; r.note = d.error;
    console.log(`${r.id}: ${d.error}`);
  } else {
    fs.mkdirSync(results, { recursive: true });
    const id = String(r.id).toUpperCase();
    // The design keeps its lab name inside the file; the file is named by the request.
    fs.writeFileSync(path.join(results, id + '.blueprint'), d.blueprint);
    if (sheet) sheet(BP.parse(d.blueprint).pieces, path.join(results, id + '.png'), `${id}: ${d.description} (${d.pieces} pieces)`);
    Object.assign(r, { status: 'done', result: d.name, file: id + '.blueprint', done: new Date().toISOString(),
      note: d.failed.length ? 'failed ' + d.failed.join('; ') : `plan ${d.plan}, roof ${d.roof}, walls ${d.walls}, ${d.pieces} pieces, all checks pass` });
    console.log(`${id}: ${d.name}, ${r.note}`);
  }
  lines[i] = JSON.stringify(r);
  made++;
}
if (made) fs.writeFileSync(file, lines.join(eol));
console.log(`${made} request(s) made; results in ${results}`);
