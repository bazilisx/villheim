// node lib/batch.js <out dir> [matrix name]: generate a set of designs, one sheet each, and an overview image.
const fs = require('fs'), path = require('path');
const { createCanvas } = require('@napi-rs/canvas');
const G = require('./generate.js'), BP = require('./blueprint.js'), Sh = require('./sheet.js'), R = require('./render.js');
const out = process.argv[2] || 'out/batch';
const set = process.argv[3] || 'review';
fs.mkdirSync(out, { recursive: true });
const S = require('./styles.js');
let reqs = [];
if (set === 'review') {
  const pairs = [['home', 'Meadows', 'norse'], ['home', 'Black Forest', 'black-forest'], ['home', 'Swamp', 'swamp'], ['home', 'Mountain', 'mountain'],
    ['home', 'Black Forest', 'middle-eastern'], ['home', 'Swamp', 'east-asian'], ['home', 'Plains', 'castle-medieval'], ['home', 'Black Forest', 'slavic'],
    ['longhouse', 'Meadows', 'norse'], ['tavern', 'Swamp', 'norse'], ['smithy', 'Black Forest', 'black-forest'], ['sawmill', 'Meadows', 'norse'],
    ['barn', 'Black Forest', 'norse'], ['farm', 'Black Forest', 'black-forest'], ['storage', 'Swamp', 'swamp'], ['tower', 'Black Forest', 'black-forest'],
    ['dock', 'Meadows', 'norse'], ['stall', 'Plains', 'middle-eastern'], ['temple', 'Mountain', 'norse'], ['well', 'Black Forest', 'norse'],
    ['camp', 'Meadows', 'norse'], ['home', 'Mistlands', 'dwarven'], ['workshop', 'Plains', 'norse'], ['home', 'Meadows', 'norse']];
  reqs = pairs.map(([type, biome, culture], i) => ({ type, biome, culture, stage: ['s1', 's2', 's3'][i % 3], decor: ['d2', 'd3', 'd1'][i % 3], seed: i + 1 }));
} else if (set === 'stages') {
  for (const st of ['s1', 's2', 's3']) for (const dc of ['d1', 'd2', 'd3']) reqs.push({ type: process.argv[4] || 'home', biome: process.argv[5] || 'Meadows', culture: process.argv[6], stage: st, decor: dc, seed: 3 });
}
const cell = 340, cols = 4, rows = Math.ceil(reqs.length / cols);
const ov = createCanvas(cols * cell, rows * (cell + 22)), octx = ov.getContext('2d');
octx.fillStyle = '#d9d2c3'; octx.fillRect(0, 0, ov.width, ov.height);
reqs.forEach((q, i) => {
  const d = G.generate(q);
  const base = path.join(out, d.meta.Name);
  fs.writeFileSync(base + '.blueprint', BP.write(d));
  Sh.sheet(d.pieces, base + '.png', `${d.meta.Description} (${d.pieces.length} pieces)`);
  const c = createCanvas(cell, cell), ctx = c.getContext('2d');
  R.draw(ctx, d.pieces, { az: 35, el: 28, width: cell, height: cell });
  const x = (i % cols) * cell, y = Math.floor(i / cols) * (cell + 22);
  octx.drawImage(c, x, y + 22);
  octx.fillStyle = '#2b241c'; octx.font = '13px sans-serif';
  octx.fillText(`${S.TYPES[q.type].label}, ${q.biome}, ${S.CULTURES[d.request.cultureKey].label}, ${q.stage}${q.decor}`, x + 6, y + 16);
});
fs.writeFileSync(path.join(out, 'overview.png'), ov.toBuffer('image/png'));
console.log('done', reqs.length);
