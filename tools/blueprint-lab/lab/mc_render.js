// Side-by-side picture check for the Millenaire study: the original blocks as coloured cubes on the left, our
// Valheim translation on the right, from the same angles.
// Usage: node lab/mc_render.js <base path without extension> <out.png> [title] [panel size in px, default 300]
// Reads <base>.voxels.json and <base>.blueprint written by lab/mc_convert.py.
const fs = require('fs');
const { createCanvas } = require('@napi-rs/canvas');
const R = require('../lib/render.js');
const BP = require('../lib/blueprint.js');
const FIX = require('./mc_pieces_fix.js');

FIX.apply();

function voxelPieces(vox) {
  return vox.map(([x, y, z, hex, h, w, d]) => ({ name: FIX.voxelPiece(hex, h, w, d), x, y, z, q: [0, 0, 0, 1] }));
}

const VIEWS = [
  { az: 35, el: 28, label: 'front left' },
  { az: 215, el: 28, label: 'back right' },
  { az: 35, el: 55, cut: 2.6, label: 'inside, upper part off' },
];

function sideBySide(vox, pieces, out, title, size = 300) {
  const left = voxelPieces(vox);
  const c = createCanvas(size * 2, size * VIEWS.length + 30);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d9d2c3'; ctx.fillRect(0, 0, c.width, c.height);
  VIEWS.forEach((v, i) => {
    [[left, 'Minecraft blocks'], [pieces, 'Valheim pieces']].forEach(([ps, who], j) => {
      const sub = createCanvas(size, size), sctx = sub.getContext('2d');
      // cut at 2.6 m over the ground floor; both use y = 0 at Millenaire's ground level
      R.draw(sctx, ps, { ...v, cut: v.cut != null ? v.cut : null, width: size, height: size, label: `${who}, ${v.label}` });
      ctx.drawImage(sub, j * size, 30 + i * size);
    });
  });
  ctx.fillStyle = '#2b241c'; ctx.font = '15px sans-serif';
  ctx.fillText(title || '', 8, 20);
  fs.writeFileSync(out, c.toBuffer('image/png'));
}

function renderBase(base, out, title, size) {
  const vox = JSON.parse(fs.readFileSync(base + '.voxels.json', 'utf8'));
  const bp = BP.parse(fs.readFileSync(base + '.blueprint', 'utf8'));
  sideBySide(vox, bp.pieces, out, title || bp.meta.Name, size || 300);
}

module.exports = { sideBySide, renderBase, voxelPieces };
if (require.main === module) renderBase(process.argv[2], process.argv[3], process.argv[4], +process.argv[5] || 300);
