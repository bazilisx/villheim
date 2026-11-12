// Pictures of one corpus room for the room study: two views from above at an angle with the walls cut at 2.6 m and a
// plan, of the part of a build round a room, so a person can check what the numbers describe.
//   node lab/rooms_corpus_render.js <compact.jsonl> <builds.jsonl> <file> <cx> <cz> <floor y> <radius m> <out.png> [label]
// cx, cz and the floor height are in the turned frame of lab/rooms_corpus_extract.js (examples.json and the sets carry
// them). The pictures show builders' work: they go to the private repo, never the public one.
const fs = require('fs'), path = require('path'), readline = require('readline');
const lab = path.join(__dirname, '..');
const { createCanvas } = require(path.join(lab, 'node_modules/@napi-rs/canvas'));
const R = require(lab + '/lib/render.js');

const [compact, buildsFile, file, cxS, czS, yS, radS, out, label] = process.argv.slice(2);
if (!out) { console.error('usage: node lab/rooms_corpus_render.js <compact.jsonl> <builds.jsonl> <file> <cx> <cz> <floor y> <radius> <out.png> [label]'); process.exit(1); }
const cx = +cxS, cz = +czS, fy = +yS, rad = +radS;
const quat = yaw => { const a = yaw * Math.PI / 360; return [0, Math.sin(a), 0, Math.cos(a)]; };
(async () => {
  let rot = 0;
  for (const line of fs.readFileSync(buildsFile, 'utf8').split('\n')) { if (line.includes(JSON.stringify(file))) { rot = JSON.parse(line).rot || 0; break; } }
  let b = null;
  for await (const line of readline.createInterface({ input: fs.createReadStream(compact) })) { if (line.includes('"file":' + JSON.stringify(file))) { b = JSON.parse(line); break; } }
  if (!b) { console.error('not found', file); process.exit(1); }
  const a = rot * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  const ps = [];
  for (const [name, x0, y, z0, yaw] of b.p) {
    const x = x0 * ca - z0 * sa, z = x0 * sa + z0 * ca;
    if (Math.abs(x - cx) > rad || Math.abs(z - cz) > rad || y < fy - 1.5 || y > fy + 3.2) continue;
    ps.push({ name, x, y, z, q: quat(yaw - rot) });
  }
  const tiles = [];
  for (const v of [{ az: 35, el: 52 }, { az: 215, el: 52 }]) {
    const c = createCanvas(760, 560);
    R.draw(c.getContext('2d'), ps, { width: 760, height: 560, az: v.az, el: v.el, cut: fy + 2.6, background: '#e9e4d8', ss: 1 });
    tiles.push(c);
  }
  const sz = R.planSize(ps, { ppm: 30 });
  const pc = createCanvas(sz.width, sz.height);
  R.plan(pc.getContext('2d'), ps, { cut: fy + 1.9, ppm: 30, crop: sz.crop, background: '#e9e4d8', ss: 2 });
  const W = Math.max(1520, pc.width), H = 560 + 34 + pc.height;
  const S = createCanvas(W, H), g = S.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  tiles.forEach((t, i) => g.drawImage(t, i * 760, 0));
  g.fillStyle = '#222'; g.font = '18px sans-serif'; g.fillText(`${label || ''} ${file} (${ps.length} pieces)`, 8, 560 + 24);
  g.drawImage(pc, 0, 560 + 34);
  fs.writeFileSync(out, S.toBuffer('image/png'));
  console.log('ok', out, ps.length);
})();
