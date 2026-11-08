// Node: render a blueprint to one PNG holding four views.
const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');
const R = require('./render.js');

function groundOf(pieces) {
  const ys = pieces.map(p => p.y).sort((a, b) => a - b);
  return ys.length ? ys[Math.floor(ys.length * 0.05)] : 0;
}

function sheet(pieces, out, title, size = 520) {
  const c = createCanvas(size * 2, size * 2 + 34);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d9d2c3'; ctx.fillRect(0, 0, c.width, c.height);
  const g = groundOf(pieces);
  R.VIEWS.forEach((v, i) => {
    const sub = createCanvas(size, size), sctx = sub.getContext('2d');
    R.draw(sctx, pieces, { ...v, cut: v.cut != null ? g + v.cut : null, width: size, height: size, label: v.label });
    ctx.drawImage(sub, (i % 2) * size, 34 + Math.floor(i / 2) * size);
  });
  ctx.fillStyle = '#2b241c'; ctx.font = '20px sans-serif';
  ctx.fillText(title || '', 10, 24);
  fs.writeFileSync(out, c.toBuffer('image/png'));
}

module.exports = { sheet, groundOf };
if (require.main === module) {
  const BP = require('./blueprint.js');
  const bp = BP.parse(fs.readFileSync(process.argv[2], 'utf8'));
  sheet(bp.pieces, process.argv[3], `${bp.meta.Name} (${bp.pieces.length} pieces)`);
}
