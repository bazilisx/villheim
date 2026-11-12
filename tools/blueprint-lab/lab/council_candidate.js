// A council candidate (docs/handoffs/2026-11-12-showcase-review/README.md, "Council"): one s3d3 building made as the
// game makes it (lib/request.js make, one try of the seed, the game's rules-lite), its blueprint, the standard views,
// and every audit the members have written, in one scorecard.
//   node lab/council_candidate.js [--type t] [--biome md|bf|...] [--culture c] [--stage s3d3] [--seed n] [--pick n]
//                                 [--showcase 1-16|all] [--out dir] [--no-render] [--no-audit]
// Without type, culture, biome or seed, the missing ones are drawn (from --pick, else the clock), from the building
// kinds that have rooms to furnish. --showcase N makes the Nth of the 16 showcase designs (TYLER_NOTES.md, same seeds).
// Output in <out>/<name>/: <name>.blueprint, views.png (four cut views and the ground plan), floor-<i>.png (a plan and a
// cut view of each upper floor), intent.json (the building plan and each room's intent record), scorecard.json and
// scorecard.md.
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const lab = path.join(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const flag = k => args.includes(k);
const Q = require(lab + '/lib/request.js'), BP = require(lab + '/lib/blueprint.js'), S = require(lab + '/lib/styles.js');
const D = require(lab + '/lib/decorate.js'), PC = require(lab + '/lib/pieces.js');
const scorer = require(lab + '/data/scorer.json'), rules = require(lab + '/data/rules-lite.json');

const SHOWCASE = [
  ['hub', 'md', 'norse', 's5d3', 2], ['hub', 'pl', 'byzantine', 's5d3', 1], ['hub', 'bf', 'celtic', 's4d3', 2], ['temple', 'ml', 'byzantine', 's3d3', 1],
  ['longhouse', 'bf', 'norse-forest', 's3d3', 3], ['tavern', 'pl', 'byzantine', 's3d3', 1], ['tavern', 'pl', 'steppe', 's3d3', 2], ['home', 'pl', 'middle-eastern', 's3d3', 1],
  ['home', 'sw', 'baltic', 's3d3', 2], ['home', 'bf', 'slavic', 's3d3', 3], ['home', 'md', 'anglo-saxon', 's2d3', 2], ['home', 'ml', 'lamari', 's2d3', 2],
  ['smithy', 'mt', 'norse-highland', 's2d3', 1], ['tower', 'mt', 'norse-highland', 's3d3', 1], ['workshop', 'al', 'castle-medieval', 's2d3', 3], ['home', 'al', 'castle-medieval', 's3d3', 1],
];
// building kinds with rooms to furnish (the council's candidates)
const KINDS = ['home', 'home', 'home', 'longhouse', 'tavern', 'smithy', 'workshop', 'temple', 'tower', 'storage', 'sawmill'];
const BIOMES = ['md', 'bf', 'sw', 'mt', 'pl', 'ml', 'al'];

function requests() {
  const sc = opt('--showcase');
  if (sc) return (sc === 'all' ? SHOWCASE.map((_, i) => i + 1) : sc.split(',').map(Number)).map(i => {
    const [type, biome, culture, stage, seed] = SHOWCASE[i - 1];
    return { type, biome, culture, stage, seed, name: `showcase-${String(i).padStart(2, '0')}-${type}-${biome}-${culture}-${stage}-${seed}` };
  });
  let s = (+opt('--pick', 0) || (Date.now() % 1000003)) >>> 0;
  const R = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  for (let i = 0; i < 5; i++) R();
  const type = opt('--type') || KINDS[Math.floor(R() * KINDS.length)];
  const biome = opt('--biome') || BIOMES[Math.floor(R() * BIOMES.length)];
  // (a culture the biome's villages use, by the culture map's weights, D-001: lib/styles.js BIOME_CULTURE)
  const culture = opt('--culture') || S.cultureFor(Q.BIOME_CODES[biome] || biome, R);
  const seed = +opt('--seed', 0) || 1 + Math.floor(R() * 999);
  const stage = opt('--stage', 's3d3');
  return [{ type, biome, culture, stage, seed, name: `council-${type}-${biome}-${culture}-${stage}-${seed}` }];
}

// the decorator's own record of the building plan and each room's intent, kept as the request is made
let lastIntent = null;
// the generated design and its building program, by design name, for track D's shell list and track H's program
// hard fails (the checks read the design itself: the blueprint keeps neither the program nor what each window carries)
const G = require(lab + '/lib/generate.js'), Det = require(lab + '/lib/details.js'), Ck = require(lab + '/lib/checks.js'), Pr = require(lab + '/lib/program.js');
const made = new Map();
let archNow = null;
{
  const gen0 = G.generate, ext0 = Det.exterior;
  Det.exterior = function (b, ctx) { const r = ext0.call(this, b, ctx); archNow = { prog: ctx && ctx.program, openings: b.openings || [] }; return r; };
  G.generate = function (...a) { archNow = null; const d = gen0.apply(this, a); if (d && d.meta) made.set(d.meta.Name, { d, req: a[0], arch: archNow }); return d; };
}
// track D's shell criteria (criteria/shell.md): hard fails H1 to H5 and the measured weighted items, from lib/checks.js
function shellList(m) {
  const res = Ck.check(m.d, (m.req && m.req.biome) || 'Meadows');
  const by = Object.fromEntries(res.map(x => [x.check, x]));
  const H = [['H1 every piece holds by the game\'s rule', 'game support'], ['H2 no walk under two floor pieces wide', 'passages'], ['H3 every doorway clear and stepped', 'doorways'],
    ['H4 no pasture fence raised or indoors', 'railings'], ['H5 one masonry family', 'masonry']];
  const hard = H.map(([id, c]) => ({ id, fail: !!by[c] && !by[c].ok, detail: by[c] && !by[c].ok ? [by[c].detail] : [] }));
  // measured items (the rest are read from the views): 1 wall tops 10, 2 roof holes 8, 4 crossed boards 4, 5 plants held 6
  const M = [[1, 10, 'wall tops'], [2, 8, 'roof holes'], [4, 4, 'crossed boards'], [5, 6, 'plants held']];
  const items = M.map(([id, weight, c]) => ({ id, weight, points: by[c] && by[c].ok ? weight : 0, detail: by[c] && !by[c].ok ? [by[c].detail] : [] }));
  const of = M.reduce((a, x) => a + x[1], 0), points = items.reduce((a, x) => a + x.points, 0);
  return { pass: !hard.some(h => h.fail) && points >= 0.75 * of, points, of, mark: '75 % of the measured weight', hardFails: hard.filter(h => h.fail).map(h => h.id), hard, items };
}
// track H's architecture hard fails (criteria/architecture.md H1 to H3), read from the program record: lone features
// without a reason, mixed treatments in a run, planters past the household rule
function archList(m) {
  const A = m.arch;
  if (!A || !A.prog) return { pass: true, points: null, of: null, hardFails: [], hard: [], items: [], note: 'no program record' };
  const ws = A.openings.filter(o => o.kind === 'window' && o.run).map(o => ({ side: o.run.side, line: o.run.line, storey: o.run.storey, byDoor: o.run.byDoor,
    features: (o.features || []).filter(f => !f.startsWith('fill:')), fill: ((o.features || []).find(f => f.startsWith('fill:')) || 'fill:open').slice(5) }));
  const faults = Pr.check(A.prog, ws);
  const lone = faults.filter(f => f.kind === 'lone feature without a reason'), mixed = faults.filter(f => f.kind === 'mixed treatments in one run' || f.kind === 'more than one exception in a run');
  const runsP = new Set(ws.filter(w => w.features.includes('planter')).map(w => `${w.side}|${w.line}|${w.storey}`));
  const planterBad = (runsP.size > 0 && !A.prog.planters) || runsP.size > 2;
  const hard = [{ id: 'H1 lone feature without a reason', fail: lone.length > 0, detail: lone.map(f => f.run) },
    { id: 'H2 mixed treatments in one run', fail: mixed.length > 0, detail: mixed.map(f => `${f.kind}: ${f.run}`) },
    { id: 'H3 planters past the household rule', fail: planterBad, detail: planterBad ? [`${runsP.size} runs with planters, household planters ${!!A.prog.planters}`] : [] }];
  return { pass: !hard.some(h => h.fail), points: null, of: null, hardFails: hard.filter(h => h.fail).map(h => h.id), hard, items: [], windows: ws.length, runs: new Set(ws.map(w => `${w.side}|${w.line}|${w.storey}`)).size };
}
{
  const dec0 = D.decorate;
  D.decorate = function (b, ctx) {
    const r = dec0.call(this, b, ctx);
    const plan = b.intentPlan;
    lastIntent = { plan: plan ? { suite: plan.suite, lights: plan.lights, candles: plan.candles, rugs: plan.rugs, banner: plan.banner, why: plan.why } : null,
      rooms: (b.decorReport || []).map(x => ({ level: x.level, role: x.role, area: x.area, items: x.items, intent: x.intent })) };
    return r;
  };
  // generate.js holds its own reference to the decorator's api object, so the wrap is seen there too
}

function render(pieces, dir, title) {
  const R = require(lab + '/lib/render.js');
  let createCanvas;
  try { ({ createCanvas } = require(path.join(lab, 'node_modules/@napi-rs/canvas'))); } catch (e) { ({ createCanvas } = require('@napi-rs/canvas')); }
  const levels = D._int.floorLevels(pieces);
  const f0 = levels.length ? levels[0] : 0;
  const tiles = [];
  for (const v of [{ az: 35, el: 55 }, { az: 215, el: 55 }, { az: 125, el: 40 }, { az: 305, el: 40 }]) {
    const c = createCanvas(700, 520); R.draw(c.getContext('2d'), pieces, { width: 700, height: 520, az: v.az, el: v.el, cut: f0 + 2.6, background: '#e9e4d8', ss: 1 }); tiles.push(c);
  }
  const shell = pieces.filter(p => PC.piece(p.name).structural);
  const sz = R.planSize(shell, { ppm: 34 });
  const plan = lv => { const pc = createCanvas(sz.width, sz.height); R.plan(pc.getContext('2d'), pieces, { cut: lv + 1.9, ppm: 34, crop: sz.crop, background: '#e9e4d8', ss: 2 }); return pc; };
  const p0 = plan(f0);
  const W = Math.max(1400, p0.width), H = 1040 + p0.height + 30, Sh = createCanvas(W, H), g = Sh.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  tiles.forEach((t, i) => g.drawImage(t, (i % 2) * 700, Math.floor(i / 2) * 520)); g.drawImage(p0, 0, 1070);
  g.fillStyle = '#222'; g.font = '20px sans-serif'; g.fillText(`${title} (${pieces.filter(p => p.decor).length} decor) ground floor ${f0}`, 8, 1062);
  fs.writeFileSync(path.join(dir, 'views.png'), Sh.toBuffer('image/png'));
  const out = ['views.png'];
  // each upper floor: its plan and two cut views at its own height
  levels.slice(1).forEach((lv, i) => {
    if (lv - f0 < 1.5) return;
    const pl = plan(lv), vs = [{ az: 35, el: 55 }, { az: 215, el: 55 }].map(v => { const c = createCanvas(700, 520); R.draw(c.getContext('2d'), pieces, { width: 700, height: 520, az: v.az, el: v.el, cut: lv + 2.6, background: '#e9e4d8', ss: 1 }); return c; });
    const W2 = Math.max(1400, pl.width), H2 = 520 + pl.height + 30, C2 = createCanvas(W2, H2), g2 = C2.getContext('2d');
    g2.fillStyle = '#fff'; g2.fillRect(0, 0, W2, H2); vs.forEach((t, j) => g2.drawImage(t, j * 700, 0)); g2.drawImage(pl, 0, 550);
    g2.fillStyle = '#222'; g2.font = '20px sans-serif'; g2.fillText(`${title} floor at ${lv} m`, 8, 542);
    const f = `floor-${i + 1}.png`; fs.writeFileSync(path.join(dir, f), C2.toBuffer('image/png')); out.push(f);
  });
  return out;
}

// every audit the council has: track B's corpus-rooms script, the catalog and outside-study checks (lab/council_checks.js)
function audits(file, dir, kindOf) {
  const out = {};
  const run = (script, a) => { const r = spawnSync(process.execPath, ['--max-old-space-size=2500', path.join(__dirname, script), ...a], { encoding: 'utf8', env: process.env }); return r; };
  if (fs.existsSync(path.join(__dirname, 'rooms_corpus_audit.js'))) {
    const j = path.join(dir, 'audit-corpus-rooms.json');
    const r = run('rooms_corpus_audit.js', [file, '--json', j]);
    out['corpus-rooms'] = fs.existsSync(j) ? JSON.parse(fs.readFileSync(j, 'utf8')) : { error: (r.stderr || '').slice(0, 400) };
    if (out['corpus-rooms'].work) { try { fs.rmSync(out['corpus-rooms'].work, { recursive: true, force: true }); } catch (e) { /* scratch */ } delete out['corpus-rooms'].work; }
  }
  // track G's stand item check (criteria/assemblies.md hard fails H1 to H6)
  if (fs.existsSync(path.join(__dirname, 'audit_stand_items.js'))) {
    const r = run('audit_stand_items.js', ['--file', file, kindOf]);
    try {
      const j = JSON.parse((r.stdout || '').split('\n')[0]);
      const H = { repeat: 'H1 repeat', run: 'H2 run', head: 'H3 head', edge: 'H4 edge', mixed: 'H5 mixed', 'empty-armor': 'H6 empty armor' };
      const hard = Object.entries(H).map(([code, id]) => ({ id, fail: (j.fails[code] || 0) > 0, detail: (r.stdout || '').split('\n').slice(1).filter(l => l.trim().startsWith(code + ' ')).slice(0, 4) }));
      out.assemblies = { pass: !hard.some(h => h.fail), points: null, of: null, hardFails: hard.filter(h => h.fail).map(h => h.id), hard, counts: j.counts, items: [] };
    } catch (e) { out.assemblies = { error: (r.stderr || r.stdout || '').slice(0, 300) }; }
  }
  // track F's wall-hung checks (criteria/wallhung.md hard fails), read from the pool audit on this design alone
  if (fs.existsSync(path.join(__dirname, 'audit_pool.js'))) {
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cand-pool-'));
    fs.copyFileSync(file, path.join(tmp, path.basename(file)));
    const r = run('audit_pool.js', [tmp, '--list']);
    try {
      const t = JSON.parse(((r.stdout || '').match(/totals: (\{.*\})/) || [])[1]);
      const H = { wallOff: 'H1/H2 off or away from its wall', wallTurn: 'H3 turned wrong', wallStack: 'H4 over one another', mountClip: 'H5 sunk too deep', floats: 'H6 floats' };
      const lines = (r.stdout || '').split('\n');
      const hard = Object.entries(H).map(([k, id]) => ({ id, fail: (t[k] || 0) > 0, detail: lines.filter(l => l.includes(' ' + k + ':')).slice(0, 4).map(l => l.trim()) }));
      out.wallhung = { pass: !hard.some(h => h.fail), points: null, of: null, hardFails: hard.filter(h => h.fail).map(h => h.id), hard, counts: t, items: [] };
    } catch (e) { out.wallhung = { error: (r.stderr || r.stdout || '').slice(0, 300) }; }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
  if (fs.existsSync(path.join(__dirname, 'council_checks.js'))) {
    const j = path.join(dir, 'audit-checks.json');
    const r = run('council_checks.js', [file, '--json', j, '--intent', path.join(dir, 'intent.json')]);
    if (fs.existsSync(j)) Object.assign(out, JSON.parse(fs.readFileSync(j, 'utf8')));
    else out.checks = { error: (r.stderr || '').slice(0, 400) };
  }
  return out;
}

const outRoot = opt('--out', '/tmp/council');
const cards = [];
for (const q of requests()) {
  const t0 = Date.now();
  lastIntent = null;
  const r = Q.make({ type: q.type, biome: q.biome, culture: q.culture, stage: q.stage, seed: q.seed, tries: 1 }, scorer, rules);
  if (r.error) { console.log(q.name, 'ERROR', r.error); continue; }
  const dir = path.join(outRoot, q.name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, q.name + '.blueprint');
  fs.writeFileSync(file, r.blueprint);
  fs.writeFileSync(path.join(dir, 'intent.json'), JSON.stringify({ request: q, design: r.name, checksFailed: r.failed, notes: r.notes, ...lastIntent }, null, 1));
  const pieces = BP.parse(r.blueprint).pieces;
  // the parsed pieces carry no decor flag; furniture is what lib/decorate.js knows
  for (const p of pieces) if (D.FURNITURE[p.name] || /^(itemstand|Candle|wood_ledge|piece_pot)/.test(p.name)) p.decor = true;
  const views = flag('--no-render') ? [] : render(pieces, dir, q.name);
  const A = flag('--no-audit') ? {} : audits(file, dir, q.type);
  const mm = made.get(r.name);
  if (!flag('--no-audit') && mm) { try { A.shell = shellList(mm); } catch (e) { A.shell = { error: String(e.message || e).slice(0, 300) }; } try { A.architecture = archList(mm); } catch (e) { A.architecture = { error: String(e.message || e).slice(0, 300) }; } }
  made.clear();
  const card = { name: q.name, request: q, design: r.name, pieces: r.pieces, generatorChecks: { passed: r.passed, of: r.checks, failed: r.failed }, views, audits: {} };
  for (const [k, v] of Object.entries(A)) card.audits[k] = { pass: v.pass, points: v.points, of: v.of || 100, mark: v.mark, hardFails: v.hardFails || [], items: v.items, hard: v.hard, error: v.error, ...(v.windows != null ? { windows: v.windows, runs: v.runs } : {}), ...(v.note ? { note: v.note } : {}) };
  fs.writeFileSync(path.join(dir, 'scorecard.json'), JSON.stringify(card, null, 1));
  const md = [`# ${q.name}`, '', `Request: ${q.type} ${q.biome} ${q.culture} ${q.stage} seed ${q.seed}. Design: ${r.name}, ${r.pieces} pieces.`,
    `Generator checks: ${r.passed} of ${r.checks}${r.failed.length ? ' (failed: ' + r.failed.join('; ') + ')' : ''}.`, '', '| Audit | Pass | Points | Hard fails |', '|---|---|---|---|',
    ...Object.entries(card.audits).map(([k, v]) => `| ${k} | ${v.error ? 'error' : v.pass ? 'yes' : 'no'} | ${v.points != null ? v.points : '-'} of ${v.of} | ${(v.hardFails || []).join(', ') || '-'} |`), '',
    '## Rooms', '', ...((lastIntent && lastIntent.rooms) || []).map(x => `- floor ${x.level} ${x.role} ${Math.round(x.area)} m2: ${x.intent ? `${x.intent.kind}, focal ${x.intent.focal || '-'}, zones ${x.intent.zones.map(z => z.purpose).join(', ') || '-'}${x.intent.story.length ? ', story: ' + x.intent.story.join(', ') : ''}` : 'no intent record'}`),
    '', (lastIntent && lastIntent.plan ? lastIntent.plan.why.join(' ') : '')];
  fs.writeFileSync(path.join(dir, 'scorecard.md'), md.join('\n') + '\n');
  cards.push(card);
  console.log(`${q.name}: ${r.pieces} pieces, ${((Date.now() - t0) / 1000).toFixed(1)} s; ` + Object.entries(card.audits).map(([k, v]) => `${k} ${v.error ? 'ERR' : (v.pass ? 'PASS' : 'fail')} ${v.points != null ? v.points : ''}${(v.hardFails || []).length ? ' [' + v.hardFails.map(h => h.split(' ')[0]).join(',') + ']' : ''}`).join('; '));
}
if (cards.length > 1) fs.writeFileSync(path.join(outRoot, 'summary.json'), JSON.stringify(cards.map(c => ({ name: c.name, audits: Object.fromEntries(Object.entries(c.audits).map(([k, v]) => [k, { pass: v.pass, points: v.points, hardFails: v.hardFails }])) })), null, 1));
