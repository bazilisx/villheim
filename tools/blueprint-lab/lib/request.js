// Requests in plain words, and the best of several seeds. One copy for every place that makes designs: the request
// page (web/app.html), the game's 'vh gen' (the engine bundle, lib/build_engine.js), and lab/process_requests.js.
// A request is { type, biome, culture, plan, roof, walls, pitch, storeys, porch, stage, decor, seed }.

const NODE_Q = typeof module !== 'undefined';
const GQ = NODE_Q ? require('./generate.js') : window.VHGenerate;
const SQ = NODE_Q ? require('./styles.js') : window.VHStyles;
const CQ = NODE_Q ? require('./checks.js') : window.VHChecks;
const FQ = NODE_Q ? require('./features.js') : window.VHFeatures;
const BQ = NODE_Q ? require('./blueprint.js') : window.VHBlueprint;
const DQ = NODE_Q ? require('./decorate.js') : window.VHDecorate;
const KQ = NODE_Q ? require('./critic.js') : window.VHCritic;
// the critic's targets (data/critic.json, from lab/learn_critic.js); in the bundle and the page they are inlined
function criticModel() {
  if (NODE_Q) { try { return require('../data/critic.json'); } catch (e) { return null; } }
  return (typeof window !== 'undefined' && window.VH_CRITIC) || null;
}
// A seed's rank: the keep scorer (Tyler's review) and the critic (how close to the best-liked builds), 40 and 60 parts
function rank(scorer, pieces, stage) {
  const k = KQ ? KQ.score(criticModel(), pieces, stage) : 0;
  return 0.4 * (scorer ? FQ.score(scorer, pieces) : 0) + 0.6 * k;
}

// Words to choices. The first match per field wins, so the more specific words come first.
const WORDS = [
  ['type', 'longhouse', /long ?house|great hall|mead ?hall|jarl/], ['type', 'tavern', /tavern|\binn\b|\bpub\b|feast/],
  ['type', 'smithy', /smith|forge|\bmine\b|mining|metal/], ['type', 'sawmill', /saw ?mill|wood ?work|lumber|carpent|woodcutter/],
  ['type', 'barn', /barn|stable|animal|\bpen\b|\bboar|\blox\b|chicken|coop/], ['type', 'farm', /farm|field|crop|garden/],
  ['type', 'storage', /storage|store ?house|granary|\bshed\b|warehouse/], ['type', 'tower', /tower|lookout|watch/],
  ['type', 'dock', /dock|pier|boat|harbou?r|shipyard/], ['type', 'stall', /stall|market|shop|bazaar/],
  ['type', 'temple', /temple|shrine|church|altar/], ['type', 'well', /\ba well\b|\bwell house|\bwater well/], ['type', 'camp', /camp\b|campfire|tent/],
  ['type', 'workshop', /workshop|workbench|craft/], ['type', 'home', /house|home|cottage|cabin|hut|hovel/],
  ['biome', 'Black Forest', /black ?forest/], ['biome', 'Swamp', /swamp|bog|marsh/], ['biome', 'Mountain', /mountain|snow/],
  ['biome', 'Plains', /plains/], ['biome', 'Mistlands', /mist/], ['biome', 'Ashlands', /ash ?lands/], ['biome', 'Meadows', /meadow/],
  ['culture', 'middle-eastern', /desert|arab|middle ?east|persian|moor|oasis|caravanserai|courtyard house/], ['culture', 'east-asian', /japan|asian|pagoda|chinese/],
  ['culture', 'byzantine', /byzantin|greek|domed? church/], ['culture', 'steppe', /steppe|yurt|khazar|turkic|nomad/],
  ['culture', SQ.ID.lamari, /lamari|svan|georgian|armenian|caucas|tower house/], ['culture', 'saami', /s[aá]a?mi|lavvu|goahti|kota/],
  ['culture', 'norse-highland', /iceland|turf/], ['culture', 'celtic-crannog', /crannog|lake ?dwell/], ['culture', 'baltic', /baltic|latvia|lithuan|prussia|curonian/],
  ['culture', 'fen-folk', /\bfen|frisian|terp/], ['culture', 'anglo-saxon', /anglo|saxon/], ['culture', 'frankish-norman', /norman|frank|motte|keep/],
  ['culture', 'norse-forest', /stave|log cabin|log house/], ['culture', 'castle-medieval', /medieval|castle|tudor|knight/], ['culture', 'dwarven', /dwar/],
  ['culture', 'slavic', /slav|russian|izba|\brus\b/], ['culture', 'celtic', /celtic|irish|scots|welsh|druid|round ?house/], ['culture', 'swamp', /stilt/],
  ['culture', 'mountain', /lodge/], ['culture', 'norse', /viking|norse|nordic/],
  ['plan', 'L', /\bl[- ]?shaped|\bl plan/], ['plan', 'T', /\bt[- ]?shaped|\bt plan/], ['plan', 'cross', /cross/], ['plan', 'U', /courtyard|u[- ]?shaped/],
  ['plan', 'octagon', /octagon|round\b|circular/], ['plan', 'long', /\blong\b/], ['plan', 'square', /square/],
  ['roof', 'hip', /hip/], ['roof', 'flat', /flat/], ['roof', 'shed', /shed roof|lean[- ]?to/], ['roof', 'gable', /gable/],
  ['stage', 's1', /small|tiny|little|starter/], ['stage', 's3', /large|big|grand|huge/], ['stage', 's2', /medium|middle/],
  ['decor', 'd1', /bare|empty|plain|stripped/], ['decor', 'd3', /rich|lavish|clutter|full of|well furnished|decorated|lots of decor/], ['decor', 'd2', /cosy|cozy|furnished|lived/],
  ['walls', 'half-timber', /half[- ]?timber|timber ?frame/], ['walls', 'log', /\blog\b/], ['walls', 'stone', /\bstone\b/], ['walls', 'stone-base', /stone base|stone footing/],
  ['pitch', '45', /steep/], ['pitch', '26', /low roof|shallow/],
  ['storeys', 3, /\b(three|3)[- ]?(stor(e?y|ies|eys)|floors?|levels?)\b/], ['storeys', 2, /\b(two|2)[- ]?(stor(e?y|ies|eys)|floors?|levels?)\b|upstairs|upper floor|loft/],
  ['storeys', 1, /\b(one|1|single)[- ]?(stor(e?y|ies|eys)|floors?|levels?)\b|bungalow/],
  ['porch', false, /\bno porch|without (a )?porch/], ['porch', true, /porch|veranda|stoop/],
];

// The fields a text names, e.g. "two storeys with a porch" gives { storeys: 2, porch: true }.
function read(text) {
  const t = String(text || '').toLowerCase(), out = {};
  for (const [k, v, re] of WORDS) if (!(k in out) && re.test(t)) out[k] = v;
  return out;
}

// Short codes for the game's console.
const BIOME_CODES = { md: 'Meadows', bf: 'Black Forest', sw: 'Swamp', mt: 'Mountain', pl: 'Plains', ml: 'Mistlands', al: 'Ashlands', dn: 'Deep North' };
// The lab has no Deep North kit yet; Deep North requests use the Mountain kit, the nearest one.
const BIOME_STAND_IN = { 'Deep North': 'Mountain' };
const TYPE_WORDS = { house: 'home', hall: 'longhouse', greathall: 'longhouse', inn: 'tavern', forge: 'smithy', woodworker: 'sawmill',
  storehouse: 'storage', watchtower: 'tower', market: 'stall', shrine: 'temple', church: 'temple', boathouse: 'dock' };

function evaluate(d, biome, scorer) {
  const checks = CQ.check(d, biome);
  const score = rank(scorer, d.pieces, d.request && d.request.stage);
  return { checks, score, pass: checks.filter(c => c.ok).length };
}

// Builds n seeds (seed, seed + 101, ...) and keeps the one that passes the most checks, then scores highest.
// Furnishing and the checks are the slow parts (most of a few seconds a design in the game), so the seeds are built
// bare and ranked on their keep score alone; then the best are furnished and checked in that order until one passes
// every check (at most four; else the best of those). Bare and furnished builds of a seed share the same structure.
// Every seed tried is the same household (lineage: the asked seed unless the request names one), so a building's
// stages agree whatever the tries (generate.js massingPath).
function best(req, n, scorer) {
  const base = +req.seed || 1;
  req = { ...req, lineage: req.lineage != null ? req.lineage : base };
  const bare = [];
  for (let i = 0; i < Math.max(1, n | 0); i++) {
    const seed = base + i * 101;
    const d = GQ.generate({ ...req, seed, skipDecor: true });
    bare.push({ seed, key: rank(scorer, d.pieces, req.stage) });
  }
  bare.sort((a, c) => c.key - a.key || a.seed - c.seed);
  // decor grows in stages (D-071): the seed is chosen on the full d3 design, so d1, d2 and d3 of one request take the
  // same seed and each holds the one before it; the asked stage is then cut from that seed
  const grow = req.stages !== false && req.decor && req.decor !== 'd3';
  let top = null;
  for (const c of bare.slice(0, 4)) {
    const d = GQ.generate({ ...req, seed: c.seed, decor: grow ? 'd3' : req.decor });
    const ev = evaluate(d, req.biome, scorer);
    const key = ev.pass * 10 + ev.score;
    if (!top || key > top.key) top = { d, ev, key, seed: c.seed };
    if (ev.pass === ev.checks.length) break;
  }
  if (grow && top) { const d = GQ.generate({ ...req, seed: top.seed }); top = { d, ev: evaluate(d, req.biome, scorer), key: top.key, seed: top.seed }; }
  return top;
}

// One request as the game and the request processor make it. o: { type, biome (name or code), culture, stage
// ('s1d3' or 's1'), decor, words, seed, tries }. Fields named in o win over the words. Returns plain data.
function make(o, scorer, rules) {
  if (rules) DQ.setRules(rules);
  const words = read(o.words);
  const notes = [];
  let biome = BIOME_CODES[String(o.biome || '').toLowerCase()] || o.biome || words.biome || 'Meadows';
  const asked = biome;
  if (BIOME_STAND_IN[biome]) { biome = BIOME_STAND_IN[biome]; notes.push(`The lab has no ${asked} kit yet; built with the ${biome} kit.`); }
  let type = String(o.type || words.type || 'home').toLowerCase();
  type = TYPE_WORDS[type] || type;
  if (type === 'hub' || type === 'hearth') return { error: 'the lab has no hub or hearth design yet. Types: ' + Object.keys(SQ.TYPES).join(', ') };
  if (!SQ.TYPES[type]) return { error: `unknown type '${o.type}'. Types: ${Object.keys(SQ.TYPES).join(', ')}` };
  if (!SQ.BIOMES.includes(biome)) return { error: `unknown biome '${o.biome}'. Codes: ${Object.keys(BIOME_CODES).join(', ')}` };
  let stage = o.stage, decor = o.decor;
  const sd = /^(s[123])(d[123])?$/i.exec(String(stage || ''));
  if (sd) { stage = sd[1].toLowerCase(); decor = decor || (sd[2] && sd[2].toLowerCase()); }
  stage = stage || words.stage || 's2';
  decor = decor || words.decor || 'd2';
  // a culture key written among the words ("middle-eastern courtyard") counts as the culture
  const keyWord = String(o.words || '').toLowerCase().split(/[\s,;]+/).find(w => SQ.cultureKey(w));
  const culture = SQ.cultureKey(o.culture || keyWord || words.culture) || o.culture || keyWord || words.culture;
  if (culture && !SQ.CULTURES[culture]) return { error: `unknown culture '${culture}'. Cultures: ${Object.keys(SQ.CULTURES).join(', ')}` };
  const req = { type, biome, culture, stage, decor, seed: +o.seed || 1 };
  for (const k of ['plan', 'roof', 'walls', 'pitch', 'storeys', 'porch']) if (words[k] !== undefined) req[k] = words[k];
  if (req.pitch) req.pitch = +req.pitch;
  const top = best(req, o.tries || 8, scorer);
  const d = top.d, info = d.request;
  const failed = top.ev.checks.filter(c => !c.ok).map(c => `${c.check}: ${c.detail}`);
  return {
    name: d.meta.Name, description: d.meta.Description, blueprint: BQ.write(d), pieces: d.pieces.length,
    type: info.type, biome: info.biome, culture: info.cultureKey, plan: info.plan || '', roof: info.roof || '', walls: info.walls || '',
    stage: info.stage, decor: info.decor, seed: info.seed, score: top.ev.score, passed: top.ev.pass, checks: top.ev.checks.length,
    failed, notes: notes.concat(d.notes || []), read: words, request: req,
  };
}

const apiQ = { WORDS, read, best, evaluate, make, BIOME_CODES, BIOME_STAND_IN, TYPE_WORDS };
if (NODE_Q) module.exports = apiQ; else window.VHRequest = apiQ;
