// Sample set per village culture: node lib/gen_cultures.js <out dir> [tries] [overview dir] [culture,...]
// For each culture (styles.js, village: true), in its first home biome: the types in its "sample" list at s1d1, s2d2
// and s3d3, each the best of several seeds (most checks passed, then the highest keep score). Writes the blueprint,
// a four-view sheet and a small picture of each, a summary, and one overview image per culture (types down, stages
// across) to <out dir>/<culture>/overview.png and, when given, to <overview dir>/<culture>.png.
const fs = require('fs'), path = require('path');
const { createCanvas } = require('@napi-rs/canvas');
const G = require('./generate.js'), BP = require('./blueprint.js'), Sh = require('./sheet.js'), R = require('./render.js');
const Ch = require('./checks.js'), F = require('./features.js'), S = require('./styles.js');
const scorer = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/scorer.json'), 'utf8'));
const out = process.argv[2] || 'out/cultures', tries = +(process.argv[3] || 6), docs = process.argv[4] && process.argv[4] !== '-' ? process.argv[4] : null;
const only = process.argv[5] ? process.argv[5].split(',') : null;
const stages = [['s1', 'd1'], ['s2', 'd2'], ['s3', 'd3']];
const rows = [];
const TILE = 210, HEAD = 46, LABEL = 130;

for (const [key, C] of Object.entries(S.CULTURES)) {
  if (!C.village || (only && !only.includes(key))) continue;
  const biome = C.biomes[0], types = C.sample || ['home', 'longhouse', 'workshop'];
  const dir = path.join(out, key);
  fs.mkdirSync(dir, { recursive: true });
  const grid = [];
  // a sample entry is a type, or type@Biome to show the culture in another of its biomes
  types.forEach((entry, ti) => stages.forEach(([stage, decor], si) => {
    const [type, where] = entry.split('@'), bm = where || biome;
    let best = null;
    for (let i = 0; i < tries; i++) {
      const d = G.generate({ type, biome: bm, culture: key, stage, decor, seed: 1 + i * 37 + ti * 1009 + si * 101 });
      const checks = Ch.check(d, bm), pass = checks.filter(c => c.ok).length, score = F.score(scorer, d.pieces);
      if (!best || pass * 10 + score > best.key) best = { d, checks, pass, score, key: pass * 10 + score };
    }
    const d = best.d, base = path.join(dir, `${type}${where ? '-' + bm.replace(' ', '') : ''}_${stage}${decor}`);
    fs.writeFileSync(base + '.blueprint', BP.write(d));
    Sh.sheet(d.pieces, base + '-views.png', `${d.meta.Description} (${d.pieces.length} pieces)`, 360);
    const c = createCanvas(256, 256); R.draw(c.getContext('2d'), d.pieces, { az: 35, el: 28, width: 256, height: 256 });
    fs.writeFileSync(base + '.png', c.toBuffer('image/png'));
    const failed = best.checks.filter(x => !x.ok).map(x => `${x.check}: ${x.detail}`);
    rows.push({ culture: key, biome: bm, type, stage, decor, name: d.meta.Name, plan: d.request.plan, roof: d.request.roof, walls: d.request.walls,
      pieces: d.pieces.length, score: +best.score.toFixed(3), checks: `${best.pass}/${best.checks.length}`, failed, notes: d.notes.join(' ') });
    grid.push({ ti, si, d });
    console.log(key, type, stage, d.pieces.length, `${best.pass}/${best.checks.length}`, failed.join('; '));
  }));
  // overview: one row per type, one column per stage
  const W = LABEL + TILE * 3, H = HEAD + TILE * types.length;
  const ov = createCanvas(W, H), ctx = ov.getContext('2d');
  ctx.fillStyle = '#e9e4d8'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#2b241c'; ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`${C.label} (${key}), ${C.biomes.join(', ')}`, 8, 18);
  ctx.font = '13px sans-serif';
  stages.forEach(([s, dd], si) => ctx.fillText(`${s}${dd}`, LABEL + si * TILE + TILE / 2 - 14, 38));
  for (const { ti, si, d } of grid) {
    const t = createCanvas(TILE, TILE);
    R.draw(t.getContext('2d'), d.pieces, { az: 35, el: 28, width: TILE, height: TILE });
    ctx.drawImage(t, LABEL + si * TILE, HEAD + ti * TILE);
  }
  types.forEach((entry, ti) => {
    const [type, where] = entry.split('@');
    ctx.fillStyle = '#2b241c'; ctx.fillText(S.TYPES[type].label, 8, HEAD + ti * TILE + TILE / 2);
    if (where) ctx.fillText(`(${where})`, 8, HEAD + ti * TILE + TILE / 2 + 16);
  });
  const png = ov.toBuffer('image/png');
  fs.writeFileSync(path.join(dir, 'overview.png'), png);
  if (docs) { fs.mkdirSync(docs, { recursive: true }); fs.writeFileSync(path.join(docs, `${key}.png`), png); }
}
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(rows, null, 1));
const ok = rows.filter(r => r.failed.length === 0).length;
console.log('done', rows.length, 'designs; all checks passed:', ok);
