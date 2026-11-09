// Plan mix, size and growth of generated buildings, per culture and stage.
//   node lab/massing.js [lib dir] [--seeds n] [--json out.json]
// Plan mix: every village culture, the types a village builds, three stages, n seeds (bare builds, one try each).
// Growth: for the same seed, the share of a stage's shell (walls, floors, posts, beams, doors, windows; roofs left
// out, since a storey or a wing replaces them) found again at the next stage, piece for piece by role, material, place
// and turn.
// The lib dir is the generator to measure (default ../lib), so an older copy can be measured the same way.
const path = require('path');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const libDir = path.resolve(args[0] && !args[0].startsWith('--') ? args[0] : path.join(__dirname, '../lib'));
const G = require(path.join(libDir, 'generate.js')), S = require(path.join(libDir, 'styles.js'));
const P = require('../lib/pieces.js');
const seeds = +opt('--seeds', 8);
const stages = ['s1', 's2', 's3'];
const TYPES = ['home', 'longhouse', 'tavern', 'smithy', 'workshop', 'storage', 'barn', 'temple'];

// plan as seen from outside: the culture's form when it has one, else the plan
const planOf = d => { const r = d.request; return ['round', 'tent', 'yurt'].includes(r.form) ? 'round' : r.plan || r.form || '?'; };
function measure(d) {
  const ground = d.rooms.filter(r => !r.upper);
  const cells = new Set();
  for (const r of ground) for (let x = Math.ceil(r.x0); x < r.x1; x++) for (let z = Math.ceil(r.z0); z < r.z1; z++) cells.add(`${x},${z}`);
  let top = 0;
  for (const p of d.pieces) if (P.piece(p.name).structural) top = Math.max(top, p.y + P.piece(p.name).size[1] / 2);
  const storeys = new Set(d.rooms.map(r => Math.round(r.y * 10))).size;
  return { area: cells.size, height: top, storeys };
}
const SHELL = new Set(['wall', 'floor', 'pole', 'beam', 'door', 'window']);
function shell(d) {
  const m = new Set();
  for (const p of d.pieces) {
    const pi = P.piece(p.name);
    if (!SHELL.has(pi.role) || p.decor || p.trim) continue;
    m.add(`${pi.role}|${pi.mat}|${Math.round(p.x * 10)}|${Math.round(p.y * 10)}|${Math.round(p.z * 10)}|${Math.round(p.yaw) % 180}`);
  }
  return m;
}
const kept = (a, b) => { let k = 0; for (const x of a) if (b.has(x)) k++; return a.size ? k / a.size : 1; };
const pct = (a, n) => `${Math.round(100 * a / n)}`;
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

// ---- plan mix per culture and stage
const mix = {}, all = {}, sizes = {};
const bump = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
for (const [ck, C] of Object.entries(S.CULTURES)) {
  if (!C.village) continue;
  for (const stage of stages) for (const type of TYPES) for (let s = 0; s < seeds; s++) {
    const d = G.generate({ type, biome: C.biomes[0], culture: ck, stage, decor: 'd1', seed: 1 + s * 211, skipDecor: true });
    const p = planOf(d), m = measure(d);
    const key = `${ck}|${stage}`;
    bump(mix[key] = mix[key] || {}, p);
    bump(all[stage] = all[stage] || {}, p);
    bump(all.all = all.all || {}, p);
    const z = sizes[stage] = sizes[stage] || { area: [], height: [], storeys: [] };
    z.area.push(m.area); z.height.push(m.height); z.storeys.push(m.storeys);
    if (type === 'home') { const h = sizes[`home ${stage}`] = sizes[`home ${stage}`] || { area: [], height: [], storeys: [] }; h.area.push(m.area); h.height.push(m.height); h.storeys.push(m.storeys); }
  }
}
const fmt = o => { const n = Object.values(o).reduce((a, b) => a + b, 0); return Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v, n)}`).join(', '); };
console.log('## Plan mix (percent of buildings)');
for (const k of ['all', ...stages]) console.log(`${k.padEnd(4)} ${fmt(all[k])}`);
console.log('\n## Plan mix per culture');
for (const [ck, C] of Object.entries(S.CULTURES)) if (C.village) console.log(`${ck.padEnd(16)} ${stages.map(st => `${st}: ${fmt(mix[`${ck}|${st}`])}`).join(' | ')}`);
console.log('\n## Size (median; share with 2 storeys or more; 3 or more)');
for (const [k, z] of Object.entries(sizes)) console.log(`${k.padEnd(8)} area ${med(z.area)} m2, height ${med(z.height).toFixed(1)} m, 2+ storeys ${pct(z.storeys.filter(n => n >= 2).length, z.storeys.length)} %, 3+ ${pct(z.storeys.filter(n => n >= 3).length, z.storeys.length)} %`);

// ---- growth: the same seed at s1, s2 and s3
console.log('\n## Growth (share of the shell kept at the next stage; "most" = half or more)');
const gtypes = ['home', 'tavern', 'smithy', 'workshop', 'storage', 'longhouse'];
const gbiomes = ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains', 'Mistlands'];
const gr = {};
for (const type of gtypes) for (const biome of gbiomes) for (let s = 0; s < Math.max(3, seeds / 2); s++) {
  const seed = 1 + s * 211;
  const ds = stages.map(stage => G.generate({ type, biome, stage, decor: 'd1', seed, skipDecor: true }));
  const sh = ds.map(shell);
  for (const [i, lab] of [[0, 's1>s2'], [1, 's2>s3']]) {
    const k = kept(sh[i], sh[i + 1]);
    for (const key of [lab, `${lab} ${type}`, `${lab} core`].filter(x => x !== `${lab} core` || (['home', 'tavern', 'smithy'].includes(type) && ['Meadows', 'Black Forest', 'Swamp'].includes(biome) && s < 3))) {
      const g = gr[key] = gr[key] || { n: 0, most: 0, sum: 0 };
      g.n++; g.sum += k; if (k >= 0.5) g.most++;
    }
  }
}
for (const [k, g] of Object.entries(gr)) console.log(`${k.padEnd(18)} most kept ${g.most} of ${g.n}, mean kept ${pct(g.sum, g.n)} %`);
if (opt('--json')) require('fs').writeFileSync(opt('--json'), JSON.stringify({ mix, all, sizes: Object.fromEntries(Object.entries(sizes).map(([k, z]) => [k, { area: med(z.area), height: med(z.height) }])), growth: gr }, null, 1));
