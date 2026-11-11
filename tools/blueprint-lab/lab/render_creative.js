// Pictures of creative sets (KC-) as the generator places them: each set found in a generated design is drawn in its
// room, cut at 2.6 m, from the room side looking at the set (and from above), with the set's pieces only and the
// building round them, so stacked and clipped pieces can be judged.
//   node lab/render_creative.js <out dir> [KC-001 ...]
// Each set is drawn alone from the library (the built kits set aside too), so it shows where it fits; in a full run it
// competes with every other set.
// Designs: every type in the set's own biome and the Mistlands at s3d3, seeds 1 to 6, until the set shows up.
const fs = require('fs'), path = require('path');
const { createCanvas } = require('@napi-rs/canvas');
const G = require('../lib/generate.js'), KB = require('../lib/kitbash.js'), R = require('../lib/render.js'), Ck = require('../lib/checks.js');
const out = process.argv[2] || '/tmp/creative-renders';
fs.mkdirSync(out, { recursive: true });
const only = process.argv.slice(3);
const TYPES = { home: 'home', sleeping: 'home', kitchen: 'tavern', tavern: 'tavern', hall: 'longhouse', temple: 'temple', smithy: 'smithy', workshop: 'workshop', storage: 'storage', barn: 'barn' };
const all = KB.library();
const lib = all.assemblies.filter(a => a.creative && (!only.length || only.includes(a.id)));
// each set alone in the library (the built kits set aside), so every one gets its picture
const built = KB.BUILT.splice(0);
for (const a of lib) {
  KB.setLibrary({ assemblies: [a] });
  let found = null;
  const types = [...new Set(a.rooms.map(r => TYPES[r]).filter(Boolean))];
  search: for (let s = 1; s <= 6; s++) for (const type of types) for (const biome of [...new Set([a.biome, 'Mistlands'])]) {
    const d = G.generate({ type, biome, stage: 's3', decor: 'd3', seed: s * 53 });
    const first = d.pieces.find(p => p.kb && p.kb.startsWith(a.id + '@'));
    const mine = first ? d.pieces.filter(p => p.kb === first.kb) : [];
    if (mine.length) { found = { d, mine, type, biome, seed: s * 53 }; break search; }
  }
  if (!found) { console.log(a.id, a.name, 'not placed in the sample'); continue; }
  const { d, mine } = found;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity;
  for (const p of mine) { const b = Ck.aabb(p); x0 = Math.min(x0, b.x0); x1 = Math.max(x1, b.x1); z0 = Math.min(z0, b.z0); z1 = Math.max(z1, b.z1); y0 = Math.min(y0, b.y0); }
  const pad = 0.9, crop = { x0: x0 - pad, x1: x1 + pad, z0: z0 - pad, z1: z1 + pad };
  // the room round the set: what stands in the crop, cut at 2.6 m over the set's floor
  const near = d.pieces.filter(p => p.x > crop.x0 - 1 && p.x < crop.x1 + 1 && p.z > crop.z0 - 1 && p.z < crop.z1 + 1 && p.y < y0 + 3.2);
  const others = near.filter(p => !mine.includes(p) && p.decor);
  const c = createCanvas(1500, 540), ctx = c.getContext('2d');
  ctx.fillStyle = '#d9d2c3'; ctx.fillRect(0, 0, 1500, 540);
  // the view from the room: the set's own yaw points out of its wall, so look along it
  const anc = mine[0].kb.split('@')[1];
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  // the set's facing: its first piece's turn less the turn it has in the set
  const m0 = a.pieces[0], fy = ((mine[0].yaw || 0) - m0.yaw + 360) % 360;
  const views = [{ az: fy - 35, el: 30 }, { az: fy + 35, el: 30 }, { az: 0, el: 90 }];
  views.forEach((v, i) => {
    const sub = createCanvas(500, 500), sctx = sub.getContext('2d');
    R.draw(sctx, near, { ...v, cut: y0 + 2.6, width: 500, height: 500, crop });
    ctx.drawImage(sub, i * 500, 30);
  });
  ctx.fillStyle = '#2b241c'; ctx.font = '15px sans-serif';
  ctx.fillText(`${a.id} ${a.name} (${a.anchor}; ${found.type} ${found.biome} seed ${found.seed}; ${mine.length} of ${a.pieces.length} pieces; other decor ${others.length})`, 8, 20);
  const file = path.join(out, `${a.id}.png`);
  fs.writeFileSync(file, c.toBuffer('image/png'));
  console.log(a.id, a.name, '->', file, mine.map(p => p.name).join(', '), `at ${cx.toFixed(1)},${cz.toFixed(1)} anchor ${anc}`);
}
KB.BUILT.push(...built);
KB.setLibrary(all);
