// Node: render a blueprint to one PNG holding four views, or a top-down plan of a room.
const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');
const R = require('./render.js');

function groundOf(pieces) {
  const ys = pieces.map(p => p.y).sort((a, b) => a - b);
  return ys.length ? ys[Math.floor(ys.length * 0.05)] : 0;
}

// size: a number for square views of that many pixels (old callers), or {width, height} of one view.
// Default 800 x 500 per view, so the sheet is 1600 x 1000 plus the title.
function sheet(pieces, out, title, size = { width: 800, height: 500 }, opts = {}) {
  const w = typeof size === 'number' ? size : size.width, h = typeof size === 'number' ? size : size.height;
  const c = createCanvas(w * 2, h * 2 + 34);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d9d2c3'; ctx.fillRect(0, 0, c.width, c.height);
  const g = groundOf(pieces);
  R.VIEWS.forEach((v, i) => {
    const sub = createCanvas(w, h), sctx = sub.getContext('2d');
    R.draw(sctx, pieces, { ...opts, ...v, cut: v.cut != null ? g + v.cut : null, width: w, height: h, label: v.label });
    ctx.drawImage(sub, (i % 2) * w, 34 + Math.floor(i / 2) * h);
  });
  ctx.fillStyle = '#2b241c'; ctx.font = '20px sans-serif';
  ctx.fillText(title || '', 10, 24);
  fs.writeFileSync(out, c.toBuffer('image/png'));
}

/**
 * Top-down plan to a PNG: straight down at a true scale, everything structural above 'cut' cut away, 1 m grid and a
 * scale bar. opts: crop {x0, x1, z0, z1} (world metres; default the whole design), cut (default ground + 1.8),
 * ppm (pixels per metre, default 50), margin (default 0.4), title.
 */
function plan(pieces, out, opts = {}) {
  const cut = opts.cut != null ? opts.cut : groundOf(pieces) + 1.8;
  const sz = R.planSize(pieces, opts);
  const top = opts.title ? 30 : 0;
  const c = createCanvas(sz.width, sz.height + top), ctx = c.getContext('2d');
  const sub = createCanvas(sz.width, sz.height);
  const res = R.plan(sub.getContext('2d'), pieces, { ...opts, cut });
  ctx.fillStyle = '#d9d2c3'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(sub, 0, top);
  if (opts.title) { ctx.fillStyle = '#2b241c'; ctx.font = '16px sans-serif'; ctx.fillText(opts.title, 8, 21); }
  fs.writeFileSync(out, c.toBuffer('image/png'));
  return res;
}

module.exports = { sheet, plan, groundOf };
if (require.main === module) {
  const BP = require('./blueprint.js');
  const bp = BP.parse(fs.readFileSync(process.argv[2], 'utf8'));
  sheet(bp.pieces, process.argv[3], `${bp.meta.Name} (${bp.pieces.length} pieces)`);
}
