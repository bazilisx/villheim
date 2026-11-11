// Four villages of one culture side by side at one hub stage (D-155: same-culture villages get different hubs):
// node lab/hub_villages.js <out dir> [stage] [lineages]. One png per line: Norse cross, Celtic round, Anglo-Saxon
// octagon; a column per village (lineage 1 to 4), rows: whole, cut at 2.6 m, cut 2.6 m over the gallery floor. All
// views from the same side (the main door toward the lower left). Each column is labeled with the plan as built and the
// layout draws.
const fs = require('fs'), path = require('path');
const G = require('../lib/generate.js'), R = require('../lib/render.js');
const { createCanvas } = require(path.join(__dirname, '../node_modules/@napi-rs/canvas'));
const out = process.argv[2] || '/tmp/hub-villages', stage = process.argv[3] || 's5', n = +(process.argv[4] || 4);
fs.mkdirSync(out, { recursive: true });
const LINES = [
  { id: 'norse-cross', culture: 'norse', biome: 'Meadows', line: 'cross' },
  { id: 'celtic-round', culture: 'celtic', biome: 'Black Forest', line: 'round' },
  { id: 'anglo-saxon-octagon', culture: 'anglo-saxon', biome: 'Meadows', line: 'octagon' },
];
const W = 640, H = 480, HEAD = 96;
for (const L of LINES) {
  const ds = [];
  for (let lineage = 1; lineage <= n; lineage++) ds.push(G.generate({ type: 'hub', biome: L.biome, culture: L.culture, line: L.line, stage, decor: 'd3', seed: lineage, lineage }));
  const c = createCanvas(W * n, HEAD + 3 * H), g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W * n, HEAD + 3 * H);
  ds.forEach((d, i) => {
    const gy = (d.rooms || []).filter(r => r.use === 'gallery').map(r => r.y)[0];
    const views = [{ az: 35, el: 35 }, { az: 35, el: 55, cut: 2.6 }, { az: 35, el: 55, cut: (gy != null ? gy : 3) + 2.6 }];
    views.forEach((v, j) => {
      const t = createCanvas(W, H);
      R.draw(t.getContext('2d'), d.pieces, { width: W, height: H, az: v.az, el: v.el, cut: v.cut, background: '#e9e4d8', ss: 1 });
      g.drawImage(t, i * W, HEAD + j * H);
    });
    g.fillStyle = '#222'; g.font = 'bold 15px sans-serif';
    g.fillText(`Village ${i + 1}: ${d.request.shape}`, i * W + 8, 20);
    g.font = '13px sans-serif';
    const lay = d.request.layout.split(', ');
    g.fillText(lay.slice(0, 4).join(', '), i * W + 8, 40);
    g.fillText(lay.slice(4, 7).join(', '), i * W + 8, 58);
    g.fillText(`persona: ${d.request.persona}; top ${d.request.top} m; ${d.pieces.length} pieces`, i * W + 8, 76);
  });
  g.fillStyle = '#555'; g.font = '12px sans-serif';
  g.fillText(`${L.id} ${stage}d3. Rows: whole; cut at 2.6 m; cut 2.6 m over the gallery floor. Same side for every view.`, 8, HEAD - 4);
  const f = path.join(out, `${L.id}_${stage}_four-villages.png`);
  fs.writeFileSync(f, c.toBuffer('image/png'));
  console.log(f);
}
