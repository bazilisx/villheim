// Pictures of the rooms the templates come from, for scoring in the review sheet's Rooms tab.
// node lab/room_pictures.js <room-geo.json> <out dir> [ID ...]
//
// room-geo.json is the side file lab/mine_room_templates.js writes with GEO=<file>: each room as built in its
// source, turned so its main way in is at the bottom. One picture per room, RT-0001.png: the plan from above at 50 px
// to the meter (at most 900 px across): floor, walls, doors with their swing, windows (blue), every piece of furniture
// at its true size (the decorator's measured sizes), colored by use and labelled where the label fits, a 1 m grid.
// Pieces the template leaves out are dashed. Wall pieces are ticks on the wall with a letter.
// RENDER=lab draws the room with lib/render.js instead (a straight-down view with the roof cut off), for when the
// renderer has its true-size top-down mode.
const fs = require('fs'), path = require('path');
const lab = path.join(__dirname, '..');
const { createCanvas } = require('@napi-rs/canvas');
const P = require(lab + '/lib/pieces.js'), D = require(lab + '/lib/decorate.js'), Rn = require(lab + '/lib/render.js');
const F = D.FURNITURE;

const geoPath = process.argv[2] || '/tmp/int/room-geo.json';
const outDir = process.argv[3] || path.join(lab, '../../docs/rooms');
const only = process.argv.slice(4);
const geo = JSON.parse(fs.readFileSync(geoPath, 'utf8'));
const TPL = JSON.parse(fs.readFileSync(process.env.TEMPLATES || path.join(lab, 'data/room-templates.json'), 'utf8')).templates;
const byId = new Map(TPL.map(t => [t.id, t]));
fs.mkdirSync(outDir, { recursive: true });

const COLOR = { bed: '#c7705b', seat: '#d9a441', table: '#9c6b3a', storage: '#6f8f45', fire: '#e0532b', craft: '#5f6b8f',
  light: '#e8c547', deco: '#9566ad', rug: '#e9cfa6' };
const LEGEND = [['bed', 'bed'], ['seat', 'seat'], ['table', 'table'], ['storage', 'storage'], ['fire', 'fire'], ['craft', 'station'],
  ['light', 'light'], ['deco', 'decor'], ['rug', 'rug']];
const SHORT = {
  bed: 'bed', piece_bed02: 'dragon bed', ashwood_bed: 'bed', piece_chest_wood: 'chest', piece_chest: 'chest', piece_chest_blackmetal: 'chest',
  piece_chest_barrel: 'barrel', dvergrprops_barrel: 'barrel', dvergrprops_crate: 'crate', piece_table: 'table', piece_table_round: 'round table',
  piece_table_oak: 'long table', piece_chair: 'stool', piece_chair02: 'chair', piece_chair03: 'chair', piece_bench01: 'bench',
  piece_logbench01: 'log bench', piece_throne01: 'throne', fire_pit: 'fire', hearth: 'hearth', piece_cookingstation: 'spit',
  piece_cookingstation_iron: 'spit', piece_cauldron: 'cauldron', fermenter: 'fermenter', piece_workbench: 'workbench',
  piece_workbench_ext1: 'block', piece_workbench_ext2: 'rack', piece_workbench_ext3: 'horse', piece_workbench_ext4: 'vise',
  forge: 'forge', forge_ext1: 'bellows', forge_ext2: 'anvil', forge_ext3: 'grind', forge_ext4: 'cooler', forge_ext5: 'tools', forge_ext6: 'anvil',
  piece_stonecutter: 'stonecutter', piece_artisanstation: 'artisan', piece_spinningwheel: 'wheel', piece_cartographytable: 'map table',
  ArmorStand: 'armor', piece_groundtorch_wood: 'torch', piece_groundtorch: 'torch', piece_groundtorch_green: 'torch', piece_groundtorch_mist: 'lamp',
  rug_deer: 'rug', rug_wolf: 'rug', jute_carpet: 'carpet', rug_fur: 'rug', rug_straw: 'rug', rug_hare: 'rug', jute_carpet_blue: 'carpet', rug_asksvin: 'rug',
};
// wall pieces: a letter on a tick
const MOUNT = { itemstand: 'I', sign: 'S', piece_walltorch: 'T', piece_dvergr_lantern: 'L', wood_dragon1: 'C', darkwood_raven: 'C', darkwood_wolf: 'C' };
const mountLetter = n => MOUNT[n] || (/banner/.test(n) ? 'B' : '?');

const yawQ = q => Math.atan2(2 * (q[3] * q[1] + q[0] * q[2]), 1 - 2 * (q[1] * q[1] + q[0] * q[0])) * 180 / Math.PI;

const PPM = 50, MAXPX = 900, MINW = 520;
function frameBox(g) {
  const u0 = -g.W / 2 - 0.7, u1 = g.W / 2 + 0.7, v0 = -0.9, v1 = g.D + 0.7;
  const s = Math.min(PPM, MAXPX / (u1 - u0), MAXPX / (v1 - v0));
  return { u0, u1, v0, v1, s, Wpx: Math.max(MINW, Math.ceil(s * (u1 - u0) + 20)), Hpl: Math.ceil(s * (v1 - v0)) };
}
function plan(id, g, t, file) {
  const { u0, u1, v0, v1, s, Wpx, Hpl } = frameBox(g);
  const foot = 92, Hpx = Hpl + 34 + foot;
  const cv = createCanvas(Wpx, Hpx), x = cv.getContext('2d');
  x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, Wpx, Hpx);
  const ox = Wpx / 2 - s * (u0 + u1) / 2, oy = 30 + Hpl / 2 + s * (v0 + v1) / 2;
  const X = u => ox + s * u, Y = v => oy - s * v; // v grows up the picture, the way in is at the bottom
  // the box of a footprint, in pixels
  const poly = (u, v, w, d, yaw) => {
    const a = yaw * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => { const lx = i * w / 2, lz = j * d / 2; return [X(u + lx * c + lz * sn), Y(v - lx * sn + lz * c)]; });
  };
  const path2 = pts => { x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); };
  // everything of the room stays in the plan's box, clear of the title and the legend
  x.save(); x.beginPath(); x.rect(0, 28, Wpx, Hpl + 4); x.clip();
  // floor
  x.fillStyle = '#e3d6bd';
  for (const [u, v] of g.cells) x.fillRect(X(u - 0.25) - 0.5, Y(v + 0.25) - 0.5, s * 0.5 + 1, s * 0.5 + 1);
  // a 1 m grid on the floor
  x.strokeStyle = 'rgba(120,100,70,0.12)'; x.lineWidth = 1;
  for (let u = Math.ceil(u0); u <= u1; u++) { x.beginPath(); x.moveTo(X(u), Y(v0)); x.lineTo(X(u), Y(v1)); x.stroke(); }
  for (let v = Math.ceil(v0); v <= v1; v++) { x.beginPath(); x.moveTo(X(u0), Y(v)); x.lineTo(X(u1), Y(v)); x.stroke(); }
  // structure at walking height
  const furn = [];
  for (const pc of g.pcs) {
    const [name, u, y, v, q, flag, cn] = pc;
    if (flag) { furn.push(pc); continue; }
    const info = P.piece(name);
    const [w, h, d] = info.size;
    const prop = info.shape === 'prop';
    const yb = prop ? y : y - h / 2, yt = prop ? y + h : y + h / 2;
    if (yt < 0.3 || yb > 1.8) continue;
    const role = info.role;
    if (!['wall', 'door', 'window', 'fence', 'pole', 'stair', 'beam'].includes(role)) continue;
    if (Math.abs(q[0]) > 0.2 || Math.abs(q[2]) > 0.2) continue;
    const yaw = yawQ(q);
    const glass = /glass|window|crystal/i.test(name) || role === 'window';
    x.fillStyle = role === 'door' ? '#8a5a2b' : glass ? '#9cc7e0' : role === 'stair' ? '#b9b2a4' : role === 'fence' ? '#8c7a62' : '#4a4038';
    path2(poly(u, v, Math.max(w, 0.12), Math.max(d, 0.12), yaw)); x.fill();
    if (role === 'door' && w >= 0.8 && w <= 3) {
      // the swing, on the room's side: a quarter circle from one jamb
      const a = yaw * Math.PI / 180, ax = Math.cos(a), az = -Math.sin(a);
      let nx = Math.sin(a), nz = Math.cos(a);
      if ((0 - u) * nx + (g.D / 2 - v) * nz < 0) { nx = -nx; nz = -nz; }
      const hu = u - ax * w / 2, hv = v - az * w / 2;
      x.strokeStyle = 'rgba(138,90,43,0.8)'; x.lineWidth = 1.2; x.setLineDash([4, 3]);
      x.beginPath(); x.moveTo(X(hu + ax * w), Y(hv + az * w));
      for (let k = 1; k <= 12; k++) { const t2 = k / 12 * Math.PI / 2, cx2 = Math.cos(t2), sx2 = Math.sin(t2); x.lineTo(X(hu + (ax * cx2 + nx * sx2) * w), Y(hv + (az * cx2 + nz * sx2) * w)); }
      x.lineTo(X(hu), Y(hv)); x.stroke(); x.setLineDash([]);
    }
    if (role === 'stair') { x.strokeStyle = '#6e675b'; x.stroke(); }
    void cn;
  }
  // the way in
  const du = t ? t.doorU : 0;
  x.fillStyle = '#8a5a2b'; x.font = 'bold 13px sans-serif'; x.textAlign = 'center';
  x.beginPath(); x.moveTo(X(du), Y(0.05)); x.lineTo(X(du) - 7, Y(-0.55)); x.lineTo(X(du) + 7, Y(-0.55)); x.closePath(); x.fill();
  x.fillText('way in', X(du), Y(-0.55) + 14);
  // furniture: rugs, then the floor, then what stands on things, then the walls
  const cat = n => (F[n] || {}).cat || 'deco';
  const order = it => { const f = F[it[6]] || {}; return f.at === 'rug' ? 0 : f.at === 'top' || f.at === 'fire' ? 2 : f.at === 'mount' || f.at === 'hang' ? 3 : 1; };
  furn.sort((a, b) => order(a) - order(b));
  const counts = {}, mounts = {};
  for (const [name, u, y, v, q, flag, cn] of furn) {
    const f = F[cn] || {};
    const [w, , d] = F[cn] ? F[cn].s : P.piece(name).size;
    const yaw = yawQ(q), c = cat(cn), col = COLOR[c] || '#888';
    const dashed = flag === 2;
    counts[cn] = (counts[cn] || 0) + 1;
    x.setLineDash(dashed ? [4, 3] : []);
    if (f.at === 'mount') {
      mounts[mountLetter(cn)] = true;
      const pts = poly(u, v, Math.max(w, 0.35), 0.3, yaw);
      path2(pts); x.fillStyle = dashed ? 'rgba(0,0,0,0)' : col; x.fill(); x.strokeStyle = '#2b241c'; x.lineWidth = 1; x.stroke();
      x.fillStyle = '#1d1712'; x.font = 'bold 11px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(mountLetter(cn), X(u), Y(v));
      continue;
    }
    if (f.at === 'hang') {
      x.beginPath(); x.arc(X(u), Y(v), Math.max(5, s * 0.35), 0, Math.PI * 2); x.setLineDash([3, 3]); x.strokeStyle = '#b8902a'; x.lineWidth = 2; x.stroke();
      continue;
    }
    const pts = poly(u, v, w, d, yaw);
    path2(pts);
    if (f.at === 'rug') { x.fillStyle = dashed ? 'rgba(0,0,0,0)' : 'rgba(233,207,166,0.85)'; x.fill(); x.strokeStyle = '#b39364'; x.lineWidth = 1; x.stroke(); }
    else if (f.at === 'top') { x.fillStyle = dashed ? 'rgba(0,0,0,0)' : (c === 'light' ? COLOR.light : '#d8c8a8'); x.fill(); x.strokeStyle = '#3a3026'; x.lineWidth = 1; x.stroke(); continue; }
    else { x.fillStyle = dashed ? 'rgba(255,255,255,0.4)' : col; x.fill(); x.strokeStyle = '#2b241c'; x.lineWidth = 1.2; x.stroke(); }
    if (c === 'light' && f.at !== 'rug') { x.beginPath(); x.arc(X(u), Y(v), 3, 0, Math.PI * 2); x.fillStyle = '#7a5a00'; x.fill(); }
    // the front of seats, beds and stations: a short line on the side they face
    if (['bed', 'seat', 'craft', 'storage'].includes(c) && f.at !== 'fire') {
      const a = yaw * Math.PI / 180;
      // local +z is the front (beds: the foot)
      const fx = Math.sin(a), fz = Math.cos(a);
      x.setLineDash([]); x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 2;
      const cx0 = u + fx * d / 2 * 0.8, cz0 = v + fz * d / 2 * 0.8, ex = Math.cos(a) * w / 2 * 0.6, ez = -Math.sin(a) * w / 2 * 0.6;
      x.beginPath(); x.moveTo(X(cx0 - ex), Y(cz0 - ez)); x.lineTo(X(cx0 + ex), Y(cz0 + ez)); x.stroke();
    }
    // a label where it fits
    const lab2 = SHORT[cn] || cn.replace(/^piece_/, '');
    if (f.at !== 'rug' || w * s > 60) {
      x.font = '11px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      const tw = x.measureText(lab2).width;
      const a = ((yaw % 180) + 180) % 180, along = a < 45 || a > 135 ? w : d, across = a < 45 || a > 135 ? d : w;
      if (tw + 4 < along * s && across * s > 11) { x.fillStyle = f.at === 'rug' ? '#7a5d33' : '#1d1712'; x.fillText(lab2, X(u), Y(v)); }
      else if (tw + 4 < across * s && along * s > 11) { x.save(); x.translate(X(u), Y(v)); x.rotate(-Math.PI / 2); x.fillStyle = '#1d1712'; x.fillText(lab2, 0, 0); x.restore(); }
    }
  }
  x.setLineDash([]);
  x.restore();
  // title
  x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.fillStyle = '#2b241c'; x.font = 'bold 16px sans-serif';
  x.fillText(`${id}  ${t ? t.kind : ''}  ${g.W.toFixed(1)} x ${g.D.toFixed(1)} m`, 10, 20);
  x.font = '12px sans-serif'; x.textAlign = 'right';
  x.fillText(`1 m grid, ${g.area || Math.round(g.cells.length / 4)} m2 of floor`, Wpx - 10, 20);
  // legend
  let lx = 10, ly = Hpx - foot + 14;
  x.textAlign = 'left'; x.textBaseline = 'middle'; x.font = '12px sans-serif';
  for (const [k, l] of LEGEND) {
    const wq = x.measureText(l).width + 26;
    if (lx + wq > Wpx - 10) { lx = 10; ly += 18; }
    x.fillStyle = COLOR[k]; x.fillRect(lx, ly - 6, 13, 12); x.strokeStyle = '#2b241c'; x.strokeRect(lx, ly - 6, 13, 12);
    x.fillStyle = '#2b241c'; x.fillText(l, lx + 17, ly); lx += wq;
  }
  ly += 18; lx = 10;
  const keys = [['#4a4038', 'wall'], ['#9cc7e0', 'window'], ['#8a5a2b', 'door']];
  for (const [c2, l] of keys) { x.fillStyle = c2; x.fillRect(lx, ly - 6, 13, 12); x.fillStyle = '#2b241c'; x.fillText(l, lx + 17, ly); lx += x.measureText(l).width + 30; }
  const ml = { I: 'item stand', S: 'sign', T: 'torch', L: 'lantern', B: 'banner', C: 'carving' };
  const mk = Object.keys(mounts).filter(k => ml[k]).map(k => `${k} ${ml[k]}`).join(', ');
  x.fillText(`on walls: ${mk || 'none'}`, lx, ly);
  ly += 18;
  x.fillText('dashed: left out of the template; dark line: the side it faces', 10, ly);
  fs.writeFileSync(file, cv.toBuffer('image/png'));
  return counts;
}

// the room through lib/render.js (RENDER_LIB=<other lib dir> to try another renderer): its true-size top-down plan
// cut at 1.8 m (walls, doors and windows in section), with this script's labels, way in and legend laid over it
function labPlan(id, g, t, file) {
  const R2 = process.env.RENDER_LIB ? require(path.resolve(process.env.RENDER_LIB, 'render.js')) : Rn;
  if (!R2.plan) throw new Error('this render.js has no top-down plan (plan, planSize)');
  const ps = g.pcs.map(([name, u, y, v, q]) => ({ name, x: u, y, z: v, q }));
  const margin = 0.4, crop = { x0: -g.W / 2 - 0.6, x1: g.W / 2 + 0.6, z0: -0.8, z1: g.D + 0.6 };
  const ppm = Math.min(PPM, MAXPX / (crop.x1 - crop.x0 + 2 * margin), MAXPX / (crop.z1 - crop.z0 + 2 * margin));
  const sz = R2.planSize(ps, { crop, ppm, margin });
  const head = 30, foot = 46, Wpx = Math.max(MINW + 40, sz.width);
  const cv = createCanvas(Wpx, sz.height + head + foot), x = cv.getContext('2d');
  x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, Wpx, sz.height + head + foot);
  const pc = createCanvas(sz.width, sz.height);
  R2.plan(pc.getContext('2d'), ps, { cut: Math.min(1.8, g.ceil - 0.2), crop, ppm, margin, grid: true, scale: true });
  const ox = (Wpx - sz.width) / 2;
  x.drawImage(pc, ox, head);
  // world to picture, as the renderer frames it: x right, z up, the crop box plus the margin
  const X = u => ox + (u - crop.x0 + margin) * ppm, Y = v => head + (crop.z1 + margin - v) * ppm;
  // labels on the furniture where they fit
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 11px sans-serif';
  for (const [name, u, y, v, q, flag, cn] of g.pcs) {
    if (!flag || !F[cn]) continue;
    const f = F[cn];
    if (f.at === 'top' || f.at === 'fire') continue;
    const lab2 = f.at === 'mount' ? mountLetter(cn) : (SHORT[cn] || cn.replace(/^piece_/, ''));
    const [w, , d] = f.s, yaw = yawQ(q), a = ((yaw % 180) + 180) % 180, along = a < 45 || a > 135 ? w : d, across = a < 45 || a > 135 ? d : w;
    const tw = x.measureText(lab2).width;
    if (f.at !== 'mount' && (tw + 4 > Math.max(along, across) * ppm || Math.min(along, across) * ppm < 11)) continue;
    x.lineWidth = 3; x.strokeStyle = 'rgba(255,255,255,0.85)'; x.fillStyle = flag === 2 ? '#8a7f70' : '#1d1712';
    x.strokeText(lab2, X(u), Y(v)); x.fillText(lab2, X(u), Y(v));
  }
  const du = t ? t.doorU : 0;
  x.fillStyle = '#8a5a2b'; x.beginPath(); x.moveTo(X(du), Y(-0.05)); x.lineTo(X(du) - 7, Y(-0.6)); x.lineTo(X(du) + 7, Y(-0.6)); x.closePath(); x.fill();
  x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.fillStyle = '#2b241c'; x.font = 'bold 16px sans-serif';
  x.fillText(`${id}  ${t ? t.kind : ''}  ${g.W.toFixed(1)} x ${g.D.toFixed(1)} m, ${g.area || ''} m2`, 10, 20);
  x.font = '12px sans-serif';
  x.fillText('Way in: the arrow at the bottom. Cut at 1.8 m, 1 m grid. Gray labels: left out of the template.', 10, head + sz.height + 18);
  x.fillText('Wall letters: I item stand, S sign, T torch, L lantern, B banner, C carving.', 10, head + sz.height + 35);
  fs.writeFileSync(file, cv.toBuffer('image/png'));
}

const ids = only.length ? only : Object.keys(geo);
let n = 0;
for (const id of ids) {
  const g = geo[id];
  if (!g) { console.error('no room for', id); continue; }
  if (process.env.RENDER === 'lab') labPlan(id, g, byId.get(id), path.join(outDir, id + '.png'));
  else plan(id, g, byId.get(id), path.join(outDir, id + '.png'));
  n++;
}
console.log(n, 'rooms drawn to', outDir);
