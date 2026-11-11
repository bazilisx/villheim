// Renders buildings with and without their greenery (lib/landscape.js), and the road kit sets
// (data/landscape/road-kit.json) on their own.
//   node lab/render_landscape.js <out dir> [type:biome:culture:stage:seed ...]   (from tools/blueprint-lab)
//   node lab/render_landscape.js <out dir> --kit
// Each building sheet: a three-quarter view and a top view, without greenery on the left and with it on the right.
const path = require('path'), fs = require('fs');
const G = require('../lib/generate.js'), R = require('../lib/render.js'), L = require('../lib/landscape.js');
const { createCanvas } = require(path.join(__dirname, '../node_modules/@napi-rs/canvas'));
const out = path.resolve(process.argv[2] || '/tmp/landscape-renders');
fs.mkdirSync(out, { recursive: true });
const args = process.argv.slice(3);
const W = 760, H = 560;
function view(pieces, az, el, label) {
  const c = createCanvas(W, H);
  R.draw(c.getContext('2d'), pieces, { width: W, height: H, az, el, background: '#e9e4d8', ss: 1, label });
  return c;
}
function sheet(rows, title, file) {
  const S = createCanvas(W * 2, H * rows.length + 34), g = S.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, S.width, S.height);
  rows.forEach((r, i) => r.forEach((c, j) => g.drawImage(c, j * W, 34 + i * H)));
  g.fillStyle = '#222'; g.font = '20px sans-serif'; g.fillText(title, 8, 24);
  fs.writeFileSync(file, S.toBuffer('image/png'));
}

if (args.includes('--kit')) {
  const kit = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/landscape/road-kit.json'), 'utf8'));
  for (const set of kit.sets) for (const biome of set.render_biomes || ['Meadows']) {
    const pieces = L.kitPieces(set, biome);
    // the road itself as a gray strip of floor pieces, drawn for reference only
    const road = (set.road || []).map(([x, z, yaw]) => ({ name: 'stone_floor_2x2', x, y: -0.45, z, yaw, q: [0, Math.sin(yaw * Math.PI / 360), 0, Math.cos(yaw * Math.PI / 360)] }));
    const all = [...road, ...pieces];
    sheet([[view(all, 35, 45, `${set.id} ${biome}`), view(all, 0, 90, 'top')]], `${set.id} (${set.label}), ${biome}: ${pieces.length} pieces`, path.join(out, `kit-${set.id}-${biome.replace(' ', '')}.png`));
    console.log('kit', set.id, biome, pieces.length);
  }
  process.exit(0);
}

const cases = args.length ? args.map(a => a.split(':')) : [
  ['home', 'Meadows', 'norse', 's3', '1'], ['home', 'Meadows', 'anglo-saxon', 's2', '2'], ['home', 'Black Forest', 'norse-forest', 's3', '3'],
  ['home', 'Black Forest', 'slavic', 's2', '1'], ['home', 'Swamp', 'fen-folk', 's3', '2'], ['home', 'Mountain', 'norse-highland', 's3', '1'],
  ['home', 'Plains', 'byzantine', 's3', '1'], ['home', 'Plains', 'middle-eastern', 's3', '2'], ['tavern', 'Meadows', 'frankish-norman', 's3', '1'],
  ['home', 'Mistlands', 'byzantine', 's2', '3'], ['home', 'Ashlands', 'castle-medieval', 's3', '1'], ['longhouse', 'Black Forest', 'celtic', 's3', '2'],
];
for (const [type, biome, culture, stage, seed] of cases) {
  const req = { type, biome, culture, stage, decor: 'd' + stage[1], seed: +seed };
  const bare = G.generate({ ...req, landscape: false }), green = G.generate(req);
  const n = green.pieces.filter(p => p.green).length;
  const what = green.landscape ? Object.entries(green.landscape.placed).map(([k, v]) => `${v} ${k}`).join(', ') : 'none';
  sheet([[view(bare.pieces, 35, 40, 'without'), view(green.pieces, 35, 40, 'with')], [view(bare.pieces, 0, 90, 'without, top'), view(green.pieces, 0, 90, 'with, top')]],
    `${green.meta.Name}: ${n} green pieces (${what})`, path.join(out, `${green.meta.Name}.png`));
  console.log(green.meta.Name, n, what);
}
