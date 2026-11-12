// Contact sheets of furniture assembly recipes (lib/assemblies.js), each placed against a plank wall on a plank floor
// and drawn from the room at 35 degrees, so a person can judge which ones read as furniture.
//   node lab/render_assemblies.js <out dir> [id prefix ...] [--cols 5 --rows 4 --size 300 --from corpus]
// Corpus recipes are builders' work: their sheets go to the private repo only.
const fs = require('fs'), path = require('path');
const { createCanvas } = require('@napi-rs/canvas');
const R = require('../lib/render.js'), AS = require('../lib/assemblies.js');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const out = args[0] || '/tmp/assemblies-renders';
const pre = args.slice(1).filter((a, i, A) => !a.startsWith('--') && !(i > 0 && A[i - 1].startsWith('--')));
const cols = +opt('cols', 5), rows = +opt('rows', 4), S = +opt('size', 300), from = opt('from', null), fam = opt('family', null);
fs.mkdirSync(out, { recursive: true });
let list = AS.all().filter(r => (!pre.length || pre.some(p => r.id.startsWith(p))) && (!from || r.from === from));
const per = cols * rows;
for (let sheet = 0; sheet * per < list.length; sheet++) {
  const c = createCanvas(cols * S, rows * (S + 22)), ctx = c.getContext('2d');
  ctx.fillStyle = '#d9d2c3'; ctx.fillRect(0, 0, c.width, c.height);
  list.slice(sheet * per, sheet * per + per).forEach((r, k) => {
    const pl = AS.place(r, { x: 0, y: 0, z: 0, facing: 0 }, fam ? { family: fam } : {});
    const x0 = Math.min(-1, r.foot.x[0]) - 0.5, x1 = Math.max(1, r.foot.x[1]) + 0.5, z1 = Math.max(1.5, r.foot.z[1]) + 0.6;
    const scene = [...pl.pieces];
    // the wall behind (for wall-backed recipes) and a floor
    for (let x = Math.floor(x0 / 2) * 2 + 1; x < x1; x += 2) {
      if (r.wall !== 'none') { scene.push({ name: 'wood_wall', x, y: 1, z: -0.15, yaw: 0, q: [0, 0, 0, 1] }); scene.push({ name: 'wood_wall', x, y: 3, z: -0.15, yaw: 0, q: [0, 0, 0, 1] }); }
      for (let z = Math.min(-1, Math.floor(r.foot.z[0] / 2) * 2) + 1; z < z1; z += 2) scene.push({ name: 'wood_floor', x, y: -0.1, z, yaw: 0, q: [0, 0, 0, 1] });
    }
    const sub = createCanvas(S, S), sctx = sub.getContext('2d');
    try { R.draw(sctx, scene, { az: 200, el: 28, cut: 3.4, width: S, height: S, crop: { x0, x1, z0: Math.min(-0.6, r.foot.z[0] - 0.3), z1 } }); } catch (e) { sctx.fillText(String(e.message).slice(0, 40), 5, 20); }
    const cx = (k % cols) * S, cy = Math.floor(k / cols) * (S + 22);
    ctx.drawImage(sub, cx, cy + 22);
    ctx.fillStyle = '#2b241c'; ctx.font = '12px sans-serif';
    ctx.fillText(`${r.id} ${r.wall} ${(r.foot.x[1] - r.foot.x[0]).toFixed(1)}x${(r.foot.z[1] - r.foot.z[0]).toFixed(1)} b${r.builds || ''}`, cx + 4, cy + 15);
  });
  const file = path.join(out, `sheet-${String(sheet + 1).padStart(2, '0')}.png`);
  fs.writeFileSync(file, c.toBuffer('image/png'));
  console.log(file);
}
