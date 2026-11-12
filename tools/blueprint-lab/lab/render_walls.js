// Views straight at the walls that carry the most hung pieces (lib/wallhang.js), each wall with only what stands within
// 1.3 m in front of it, so signs, stands, torches and shelves show as a visitor sees them on the wall, with a side view
// beside it that shows how far each stands off the wall.
// Usage, from tools/blueprint-lab: node lab/render_walls.js <lib> <type> <biome> <stage> <decor> <seed> <out.png> [culture] [walls]
// With VH_CLOSE=n: close-ups of n hung pieces instead, the ones standing furthest off their wall first (side view, then
// front view, the 3 m round each).
const path = require('path');
const L = path.resolve(process.argv[2]) + '/';
const G = require(L + 'generate.js'), R = require(L + 'render.js'), P = require(L + 'pieces.js');
const WH = require(path.join(__dirname, '../lib/wallhang.js'));
const { createCanvas } = require(path.join(__dirname, '../node_modules/@napi-rs/canvas'));
const [, , , type, biome, stage, decor, seed, out, culture, nWalls] = process.argv;
const d = G.generate({ type, biome, stage, decor, seed: +seed, culture: culture || undefined, yard: false });
const pieces = d.pieces;
// the walls: hung pieces grouped by the way their back faces, the plane of their back and the floor they hang over
const groups = new Map();
for (const p of pieces) {
  if (!WH.isHung(p.name) || p.y > 12) continue;
  const u = WH.backDir(p), nx = -u[0], nz = -u[2];
  const yawN = Math.round(((Math.atan2(nx, nz) * 180 / Math.PI) + 360) % 360 / 45) * 45 % 360;
  const off = Math.round((p.x * nx + p.z * nz) / 0.6);
  const lvl = Math.floor((p.y + 0.5) / 3);
  const k = `${yawN}|${off}|${lvl}`;
  if (!groups.has(k)) groups.set(k, { yawN, nx, nz, list: [] });
  groups.get(k).list.push(p);
}
if (process.env.VH_CLOSE) {
  const B = WH.backing(pieces);
  const Aall = WH.backing(pieces, { any: true, floors: true });
  const hung = pieces.filter(p => WH.isHung(p.name) && p.y < 12).map(p => ({ p, m: WH.measure(p, B) })).filter(h => (isFinite(h.m.gap) && Math.abs(h.m.gap) <= 0.03) || !WH.restsOn(h.p, Aall))
    .sort((a, b) => (isFinite(b.m.gap) ? b.m.gap : 9) - (isFinite(a.m.gap) ? a.m.gap : 9)).slice(0, +process.env.VH_CLOSE);
  const S = 230, cols = 4;
  const sh = createCanvas(cols * 2 * S, Math.ceil(hung.length / cols) * (S + 22) + 30), gg = sh.getContext('2d');
  gg.fillStyle = '#fff'; gg.fillRect(0, 0, sh.width, sh.height);
  gg.fillStyle = '#222'; gg.font = '16px sans-serif'; gg.fillText(`${d.meta.Name}: hung pieces furthest off their wall first (side view, front view)`, 8, 20);
  hung.forEach(({ p, m }, i) => {
    const u = WH.backDir(p), yawN = (Math.atan2(-u[0], -u[2]) * 180 / Math.PI + 360) % 360;
    const keep = pieces.filter(q => Math.abs(q.x - p.x) < 1.5 && Math.abs(q.z - p.z) < 1.5 && q.y > p.y - 1.6 && q.y < p.y + 1.6 && !['roof', 'roofTop', 'roofCorner', 'floor'].includes(P.piece(q.name).role));
    const x = (i % cols) * 2 * S, y = 30 + Math.floor(i / cols) * (S + 22);
    for (const [k, az] of [[0, (yawN + 90) % 360], [1, (yawN + 180) % 360]]) {
      const c = createCanvas(S, S);
      // the side view: only what is within 0.6 m along the wall, so the wall's edge does not hide the gap
      const ux = Math.cos(yawN * Math.PI / 180), uz = -Math.sin(yawN * Math.PI / 180);
      const list = k === 0 ? keep.filter(q => Math.abs((q.x - p.x) * ux + (q.z - p.z) * uz) < 0.6) : keep;
      R.draw(c.getContext('2d'), list, { width: S, height: S, az, el: 0, ss: 2 });
      gg.drawImage(c, x + k * S, y + 18);
    }
    gg.fillStyle = '#222'; gg.font = '12px sans-serif';
    gg.fillText(`${p.name} ${isFinite(m.gap) ? (m.gap * 100).toFixed(0) + ' cm' : 'no wall'}${m.facing ? '' : ', turned'}`, x + 4, y + 14);
  });
  require('fs').writeFileSync(out, sh.toBuffer('image/png'));
  console.log('ok', d.meta.Name, hung.length);
  process.exit(0);
}
const walls = [...groups.values()].sort((a, b) => b.list.length - a.list.length).slice(0, +(nWalls || 6));
const TW = 640, TH = 380, SW = 200;
const sheet = createCanvas(TW + SW, (TH + 24) * walls.length + 30);
const g = sheet.getContext('2d');
g.fillStyle = '#fff'; g.fillRect(0, 0, sheet.width, sheet.height);
g.fillStyle = '#222'; g.font = '18px sans-serif'; g.fillText(`${d.meta.Name}: the ${walls.length} walls with the most hung pieces`, 8, 20);
walls.forEach((w, i) => {
  const a = Math.atan2(w.nx, w.nz), ux = Math.cos(a), uz = -Math.sin(a);
  const ts = w.list.map(p => p.x * ux + p.z * uz), t0 = Math.min(...ts) - 1.6, t1 = Math.max(...ts) + 1.6;
  const plane = Math.min(...w.list.map(p => p.x * w.nx + p.z * w.nz));
  const ys = w.list.map(p => p.y), y0 = Math.min(...ys) - 2.2, y1 = Math.max(...ys) + 2;
  const keep = pieces.filter(q => {
    const t = q.x * ux + q.z * uz, n = q.x * w.nx + q.z * w.nz - plane;
    const role = P.piece(q.name).role;
    if (['roof', 'roofTop', 'roofCorner'].includes(role)) return false;
    return t > t0 && t < t1 && n > -1.3 && n < 1.3 && q.y > y0 && q.y < y1;
  });
  const top = 30 + i * (TH + 24);
  const c = createCanvas(TW, TH);
  R.draw(c.getContext('2d'), keep, { width: TW, height: TH, az: (w.yawN + 180) % 360, el: 6, ss: 2 });
  g.drawImage(c, 0, top + 20);
  const s = createCanvas(SW, TH);
  R.draw(s.getContext('2d'), keep.filter(q => Math.abs(q.x * ux + q.z * uz - (t0 + t1) / 2) < (t1 - t0) / 2), { width: SW, height: TH, az: (w.yawN + 90) % 360, el: 4, ss: 2 });
  g.drawImage(s, TW, top + 20);
  g.fillStyle = '#222'; g.font = '15px sans-serif';
  const names = {};
  for (const p of w.list) names[p.name] = (names[p.name] || 0) + 1;
  g.fillText(`wall ${i + 1}: ${Object.entries(names).map(([n, k]) => `${k} ${n}`).join(', ')}  (front, and from the side)`, 8, top + 15);
});
require('fs').writeFileSync(out, sheet.toBuffer('image/png'));
console.log('ok', d.meta.Name, walls.length);
