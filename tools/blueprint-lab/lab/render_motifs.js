// Pictures of exterior motifs for the review sheet's Motifs tab: each motif built as it was in its source build, on
// a plain wall bay, corner or gable, drawn with lib/render.js at a true scale (40 px to the meter) from the front.
//   node lab/render_motifs.js [out dir] [ID ...]        default: the batch data/motif-scores.json lists, else the
//                                                        first 72 of data/motifs.json
// The bare wall, door, roof and gable round the motif are the lab's plain pieces (wood walls, or stone where the
// source wall was stone); the motif's own pieces are drawn with the names the builder used.
const fs = require('fs'), path = require('path');
const lab = path.join(__dirname, '..');
const { createCanvas } = require('@napi-rs/canvas');
const P = require(lab + '/lib/pieces.js'), R = require(lab + '/lib/render.js');

const outDir = process.argv[2] || path.join(lab, '../../docs/motifs');
let ids = process.argv.slice(3);
const M = JSON.parse(fs.readFileSync(process.env.MOTIFS || path.join(lab, 'data/motifs.json'), 'utf8')).motifs;
const byId = new Map(M.map(m => [m.id, m]));
if (!ids.length) {
  const sp = path.join(lab, 'data/motif-scores.json');
  ids = fs.existsSync(sp) && JSON.parse(fs.readFileSync(sp, 'utf8')).batch || M.slice(0, 72).map(m => m.id);
}
fs.mkdirSync(outDir, { recursive: true });

const PPM = 40;
const q = yaw => { const a = yaw * Math.PI / 360; return [0, Math.sin(a), 0, Math.cos(a)]; };
const pc = (name, x, y, z, yaw) => ({ name, x, y, z, yaw, q: q(yaw) });

// 1 m cells covering lo..hi (the last one overlapping when the span is not whole meters)
function cells(lo, hi) {
  if (hi - lo < 0.99) return hi - lo > 0.2 ? [(lo + hi) / 2] : [];
  const out = [];
  let c = lo + 0.5;
  for (; c + 0.5 <= hi + 0.01; c += 1) out.push(c);
  if (out.length && out[out.length - 1] + 0.5 < hi - 0.01) out.push(hi - 0.5);
  return out;
}
const stoneWall = w => /stone|blackmarble|grausten|iron_wall/.test(w || '');
// a wall tile with its middle at (a, h) in the plane o = 0, turned yaw
function tile(stone, a, h, o = 0, yaw = 0) {
  return stone ? pc('stone_wall_1x1', a, h, o, yaw) : pc('wood_wall_quarter', a, h - 0.5, o, yaw);
}
// a flat wall from a0 to a1 and h0 to h1 with a rectangular hole
function wallWithHole(stone, a0, a1, h0, h1, hole) {
  const out = [];
  const cols = [...cells(a0, hole.a0), ...cells(hole.a0, hole.a1), ...cells(hole.a1, a1)];
  for (const a of cols) {
    const inHole = a > hole.a0 && a < hole.a1;
    const rows = inHole ? [...cells(h0, hole.h0), ...cells(hole.h1, h1)] : cells(h0, h1);
    for (const h of rows) out.push(tile(stone, a, h));
  }
  return out;
}

function scene(m) {
  const f = m.fit, base = [];
  let view = { az: 196, el: 14 }, crop;
  const stone = stoneWall(f.wall);
  if (m.kind === 'window') {
    const W = f.w, H = f.h, sill = Math.max(1, f.sill || 1);
    base.push(...wallWithHole(stone, -W / 2 - 2, W / 2 + 2, -sill, H + 1, { a0: -W / 2, a1: W / 2, h0: 0, h1: H }));
    crop = { x0: -W / 2 - 2.6, x1: W / 2 + 2.6, z0: -0.5, z1: 1.5, y0: -Math.min(sill, 1.5) - 0.2, y1: H + 1.5 };
  } else if (m.kind === 'door') {
    const W = f.w, H = f.h, rise = f.rise || 0;
    base.push(...wallWithHole(stone, -W / 2 - 2, W / 2 + 2, -rise, H + 1, { a0: -W / 2, a1: W / 2, h0: -rise - 1, h1: H }));
    const sp = P.doorSpec(f.door), n = Math.max(1, Math.round(W / sp.w));
    for (let i = 0; i < n; i++) {
      const a = -W / 2 + sp.w * (i + 0.5);
      base.push(pc(f.door, a - (sp.along === 'z' ? 0 : 0), -sp.bottom, sp.along === 'z' ? -sp.offset : 0, sp.along === 'z' ? 90 : (i % 2 ? 180 : 0)));
    }
    crop = { x0: -W / 2 - 2.6, x1: W / 2 + 2.6, z0: -0.5, z1: 2.5, y0: -rise - 0.3, y1: H + 1.4 };
  } else if (m.kind === 'corner') {
    // two walls from the corner, the outward diagonal toward the camera
    for (const [dx, dz, yaw] of [[Math.SQRT1_2, -Math.SQRT1_2, 45], [-Math.SQRT1_2, -Math.SQRT1_2, 135]])
      for (const s of [0.5, 1.5, 2.5, 3.5]) for (const h of [0.5, 1.5, 2.5]) base.push(tile(stone, dx * s, h, dz * s, yaw));
    view = { az: 180, el: 14 };
    crop = { x0: -2.9, x1: 2.9, z0: -2.5, z1: 1.5, y0: -0.2, y1: 3.4 };
  } else if (m.kind === 'gable') {
    // a small gabled roof ending at the gable: wing-local u along the ridge (the gable at u = W), v across it
    const r = f.slope === 45 ? 2 : 1, W = 0, ov = Math.max(0, f.overhang || 0);
    const roof = r === 2 ? 'wood_roof_45' : 'wood_roof', cap = r === 2 ? 'wood_roof_top_45' : 'wood_roof_top', gab = r === 2 ? 'wood_wall_roof_45' : 'wood_wall_roof';
    const low = i => -r * (i + 1), pivot = i => low(i) + (r === 2 ? 1 : 0), rows = 2, top = low(rows - 1);
    const add = (name, u, y, v, yaw) => base.push(pc(name, -v, y, u - W, yaw - 90));
    for (const u of [W - 1 + ov, W - 3 + ov, W - 5 + ov]) {
      for (let i = 0; i < rows; i++) { add(roof, u, pivot(i), -(2 + 2 * i), 180); add(roof, u, pivot(i), 2 + 2 * i, 0); }
      add(cap, u, 0, 0, 0);
    }
    const fill = (v, from, to) => { for (const h of cells(from, to)) base.push(tile(stone, -v - 0.5, h, 0, 0), tile(stone, -v + 0.5, h, 0, 0)); };
    fill(0, top - 2, 0);
    for (let i = 0; i < rows; i++) for (const sv of [-1, 1]) {
      const v = sv * (2 + 2 * i);
      fill(v, top - 2, low(i));
      add(gab, W, low(i), v, sv < 0 ? 270 : 90);
    }
    view = { az: 200, el: 12 };
    crop = { x0: -5.6, x1: 5.6, z0: -1, z1: 2, y0: top - 1.2, y1: 1.6 };
  } else if (m.kind === 'eave') {
    const r = f.slope === 45 ? 2 : 1, ov = f.overhang || 0;
    const roof = r === 2 ? 'wood_roof_45' : 'wood_roof';
    for (const a of [-2, 0, 2]) for (let i = 0; i < 3; i++) base.push(pc(roof, a, (r === 2 ? 1 : 0) + r * i, -1 - 2 * i, 0));
    const surf = (r / 2) * ov;
    for (const a of [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5]) for (const h of cells(surf - 3, surf)) base.push(tile(stone, a, h, -ov - 0.15, 0));
    view = { az: 205, el: 6 };
    crop = { x0: -3.4, x1: 3.4, z0: -ov - 0.5, z1: 1.5, y0: surf - 3.2, y1: r + 0.8 };
  }
  const motif = m.p.map(([n, a, o, h, r]) => pc(n, a, h, o, r));
  return { pieces: [...base, ...motif], view, crop };
}

function draw(m, file) {
  const { pieces, view, crop } = scene(m);
  const c = crop;
  // the picture's size from the crop at the true scale
  const az = view.az * Math.PI / 180, el = view.el * Math.PI / 180, ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const X of [c.x0, c.x1]) for (const Z of [c.z0, c.z1]) for (const Y of [c.y0, c.y1]) {
    const z = -Z, xx = X * ca - z * sa, z1 = X * sa + z * ca, yy = Y * ce - z1 * se;
    x0 = Math.min(x0, xx); x1 = Math.max(x1, xx); y0 = Math.min(y0, yy); y1 = Math.max(y1, yy);
  }
  const W = Math.ceil((x1 - x0) * PPM), H = Math.ceil((y1 - y0) * PPM), foot = 20;
  const cv = createCanvas(W, H + foot), ctx = cv.getContext('2d');
  const sub = createCanvas(W, H);
  R.draw(sub.getContext('2d'), pieces, { ...view, crop: c, ppm: PPM, pad: 0, width: W, height: H, background: '#ece8df', ss: 2 });
  ctx.fillStyle = '#ece8df'; ctx.fillRect(0, 0, W, H + foot);
  ctx.drawImage(sub, 0, 0);
  ctx.fillStyle = '#2b241c'; ctx.font = '13px sans-serif';
  const fit = m.kind === 'window' || m.kind === 'door' ? ` ${m.fit.w} x ${m.fit.h} m` : m.kind === 'gable' || m.kind === 'eave' ? ` ${m.fit.slope} deg` : '';
  ctx.fillText(`${m.id} ${m.kind}${fit}`, 6, H + 15);
  // a 1 m scale bar
  ctx.fillRect(W - 6 - PPM, H + 8, PPM, 3); ctx.fillText('1 m', W - 6 - PPM - 28, H + 15);
  fs.writeFileSync(file, cv.toBuffer('image/png'));
}

let n = 0;
for (const id of ids) {
  const m = byId.get(id);
  if (!m) { console.log('no motif', id); continue; }
  draw(m, path.join(outDir, `${id}.png`));
  n++;
}
console.log(n, 'pictures in', outDir);
