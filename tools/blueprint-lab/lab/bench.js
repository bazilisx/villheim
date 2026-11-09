// Component bench: vary one part of a building (door surround, window, gable end, wall trim, chimney, bar counter)
// while everything else stays the same, check every variant and draw a close-up of the part for each one on a contact
// sheet. Fast rounds of part-sized changes, reviewed and refined, before a part goes into the whole-building generator.
//
// node lab/bench.js <part> [out dir] [variants per base]
// Writes <out>/<part>.png (contact sheet) and <out>/<part>.json (variant flags, checks, piece counts near the part).
const fs = require('fs'), path = require('path');
const { createCanvas } = require('@napi-rs/canvas');
const G = require('../lib/generate.js'), Ck = require('../lib/checks.js'), P = require('../lib/pieces.js'), R = require('../lib/render.js');

const part = process.argv[2] || 'door';
const outDir = process.argv[3] || '/tmp/bench';
const perBase = +(process.argv[4] || 8);
fs.mkdirSync(outDir, { recursive: true });

const role = p => P.piece(p.name).role;
const yawOf = p => { const q = p.q || [0, 0, 0, 1]; return Math.atan2(2 * (q[3] * q[1] + q[0] * q[2]), 1 - 2 * (q[1] * q[1] + q[2] * q[2])) * 180 / Math.PI; };
const centre = d => { const s = d.pieces.filter(p => role(p) === 'wall'); return [s.reduce((a, p) => a + p.x, 0) / s.length, s.reduce((a, p) => a + p.z, 0) / s.length]; };
// a camera facing a wall piece from outside: the side of the piece away from the building's middle
function faceOn(d, p, r = 2.6, up = 3.4, el = 12) {
  // of the four directions square to the piece, the one with the least built in front of it within 3 m
  const a = yawOf(p) * Math.PI / 180;
  let best = null;
  for (let k = 0; k < 4; k++) {
    const nx = +Math.sin(a + k * Math.PI / 2).toFixed(6), nz = +Math.cos(a + k * Math.PI / 2).toFixed(6);
    let n = 0;
    for (const q of d.pieces) {
      const dx = q.x - p.x, dz = q.z - p.z, out = dx * nx + dz * nz, side = Math.abs(dx * nz - dz * nx);
      if (out > 0.5 && out < 3.5 && side < 1.2 && q.y > p.y - 1.5 && q.y < p.y + 2.5) n++;
    }
    const [cx, cz] = centre(d);
    if (nx * (p.x - cx) + nz * (p.z - cz) < 0) n += 1000; // facing into the building
    if (!best || n < best.n) best = { n, nx, nz };
  }
  const { nx, nz } = best;
  const y0 = Math.floor(p.y - 1.2);
  return { az: Math.atan2(nx, -nz) * 180 / Math.PI + 10, el, crop: { x0: p.x - r, x1: p.x + r, z0: p.z - r, z1: p.z + r, y0, y1: y0 + up + 0.8 } };
}
// the ground-floor piece of a role farthest out from the building's middle (an outside door, not an inner one)
const lowest = (d, rl) => {
  const all = d.pieces.filter(p => role(p) === rl); if (!all.length) return null;
  const y = Math.min(...all.map(p => p.y)), [cx, cz] = centre(d);
  return all.filter(p => p.y < y + 0.6).sort((a, b) => Math.hypot(b.x - cx, b.z - cz) - Math.hypot(a.x - cx, a.z - cz))[0];
};

function autoFocus(full, bare) {
  const key = p => `${p.name}@${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`;
  const s0 = new Set(bare.pieces.map(key));
  let add = full.pieces.filter(p => !s0.has(key(p)));
  if (!add.length) return { az: 35, el: 18, crop: null };
  // the biggest cluster of added pieces (a part repeated on every window would otherwise frame the whole house)
  const seed = add.reduce((m, p) => (add.filter(q => Math.hypot(q.x - p.x, q.z - p.z) < 3).length > add.filter(q => Math.hypot(q.x - m.x, q.z - m.z) < 3).length ? p : m), add[0]);
  add = add.filter(q => Math.hypot(q.x - seed.x, q.z - seed.z) < 3.5);
  const [cx, cz] = centre(full);
  const mx = add.reduce((a, p) => a + p.x, 0) / add.length, mz = add.reduce((a, p) => a + p.z, 0) / add.length;
  let dx = mx - cx, dz = mz - cz; const L = Math.hypot(dx, dz);
  if (L < 0.5) { dx = 1; dz = -1; }
  const x0 = Math.min(...add.map(p => p.x)) - 1.8, x1 = Math.max(...add.map(p => p.x)) + 1.8;
  const z0 = Math.min(...add.map(p => p.z)) - 1.8, z1 = Math.max(...add.map(p => p.z)) + 1.8;
  const y0 = Math.min(...add.map(p => p.y)) - 1.5, y1 = Math.max(...add.map(p => p.y)) + 2.5;
  return { az: Math.atan2(dx, -dz) * 180 / Math.PI + 20, el: 14, crop: { x0, x1, z0, z1, y0, y1 }, floor: Math.min(...add.map(p => p.y)) };
}

const PARTS = {
  door: {
    bases: [
      { type: 'home', biome: 'Black Forest', stage: 's2', decor: 'd2' },
      { type: 'longhouse', biome: 'Meadows', stage: 's3', decor: 'd3' },
      { type: 'tavern', biome: 'Plains', stage: 's3', decor: 'd3' },
      { type: 'home', biome: 'Mountain', stage: 's3', decor: 'd3' }],
    flags: ['doorFrame', 'doorHood', 'doorstep', 'doorLamp'],
    focus: 'auto',
  },
  window: {
    bases: [
      { type: 'home', biome: 'Black Forest', stage: 's2', decor: 'd2' },
      { type: 'tavern', biome: 'Black Forest', stage: 's3', decor: 'd3' },
      { type: 'longhouse', biome: 'Swamp', stage: 's3', decor: 'd3' }],
    flags: ['windowFrame', 'mullion', 'shutters'],
    style: { windowStyle: ['single', 'twin'] },
    focus: d => { const p = lowest(d, 'window'); return p && faceOn(d, p, 2.4, 3.2, 8); },
  },
  gable: {
    bases: [
      { type: 'longhouse', biome: 'Meadows', stage: 's3', decor: 'd3', culture: 'norse' },
      { type: 'home', biome: 'Black Forest', stage: 's2', decor: 'd2', culture: 'norse-forest' },
      { type: 'tavern', biome: 'Mountain', stage: 's3', decor: 'd3', culture: 'norse-highland' }],
    flags: ['bargeboards', 'crossed', 'gableWindow', 'gableTruss', 'purlinEnds', 'rafterTails'],
    focus: 'auto',
    oldFocus: d => {
      const tops = d.pieces.filter(p => role(p) === 'roofTop');
      if (!tops.length) return null;
      // the end of the main ridge: along the ridge's axis, the roof-top piece farthest out; the frame is that gable
      const [cx, cz] = centre(d);
      const hi = Math.max(...tops.map(p => p.y)), main = tops.filter(p => p.y > hi - 0.3);
      // the ridge's axis: the line through the two main ridge pieces farthest apart
      let A = main[0], B = main[0];
      for (const p of main) for (const q of main) if (Math.hypot(p.x - q.x, p.z - q.z) > Math.hypot(A.x - B.x, A.z - B.z)) { A = p; B = q; }
      const L = Math.hypot(A.x - B.x, A.z - B.z) || 1;
      let ux = (A.x - B.x) / L, uz = (A.z - B.z) / L;
      const along = p => (p.x - cx) * ux + (p.z - cz) * uz;
      let end = main.reduce((m, p) => (along(p) > along(m) ? p : m), main[0]);
      if (along(end) < 0) { ux = -ux; uz = -uz; }
      end = main.reduce((m, p) => (along(p) > along(m) ? p : m), main[0]);
      const half = 5;
      return { az: Math.atan2(ux, -uz) * 180 / Math.PI + 22, el: 10,
        crop: { x0: end.x - half, x1: end.x + half, z0: end.z - half, z1: end.z + half, y0: end.y - 5.5, y1: end.y + 1.5 } };
    },
  },
  stack: {
    bases: [
      { type: 'longhouse', biome: 'Black Forest', stage: 's3', decor: 'd3', culture: 'norse-forest' },
      { type: 'home', biome: 'Swamp', stage: 's2', decor: 'd2' },
      { type: 'tavern', biome: 'Swamp', stage: 's3', decor: 'd3' },
      { type: 'smithy', biome: 'Plains', stage: 's3', decor: 'd3' }],
    flags: ['stack', 'stackShoulder', 'stackCrown'],
    requires: { stackShoulder: 'stack', stackCrown: 'stack' },
    // the whole building, three-quarter view from the stack's side
    focus: d => {
      const st = d.pieces.filter(p => /stone_wall_2x1/.test(p.name) && p.trim);
      const [cx, cz] = centre(d);
      const sx = st.length ? Math.sign(st[0].x - cx) : 1;
      return { az: sx > 0 ? 60 : -120, el: 16, crop: null };
    },
  },
  bed: {
    bases: [
      { type: 'home', biome: 'Meadows', stage: 's3', decor: 'd3' },
      { type: 'longhouse', biome: 'Black Forest', stage: 's3', decor: 'd3' },
      { type: 'home', biome: 'Plains', stage: 's3', decor: 'd3' }],
    flags: ['canopyBed'],
    focus: 'auto', inside: true,
  },
  stair: {
    bases: [
      { type: 'home', biome: 'Meadows', stage: 's3', decor: 'd3' },
      { type: 'tavern', biome: 'Black Forest', stage: 's3', decor: 'd3' },
      { type: 'longhouse', biome: 'Swamp', stage: 's3', decor: 'd3' }],
    flags: ['stair'],
    focus: 'auto', inside: true, cutAt: 2.6,
  },
  outshut: {
    bases: [
      { type: 'home', biome: 'Meadows', stage: 's3', decor: 'd3' },
      { type: 'smithy', biome: 'Black Forest', stage: 's3', decor: 'd3' },
      { type: 'longhouse', biome: 'Meadows', stage: 's3', decor: 'd3' }],
    flags: ['outshut'],
    focus: d => { const [cx, cz] = centre(d); return { az: 200, el: 18, crop: null, centre: [cx, cz] }; },
  },
  dormer: {
    bases: [
      { type: 'home', biome: 'Meadows', stage: 's3', decor: 'd3', culture: 'anglo-saxon', roof: 'gable' },
      { type: 'tavern', biome: 'Black Forest', stage: 's3', decor: 'd3', culture: 'frankish-norman', roof: 'gable' },
      { type: 'longhouse', biome: 'Black Forest', stage: 's3', decor: 'd3', culture: 'slavic', roof: 'gable' }],
    flags: ['dormers', 'dormerPair'],
    requires: { dormerPair: 'dormers' },
    focus: () => ({ az: 20, el: 18, crop: null }),
  },
  // motif parts (lib/motifs.js): outside and inside corners, the door and its entry, eaves under the overhang, things
  // hung on plain walls, the foot of the walls
  corner: {
    bases: [
      { type: 'home', biome: 'Meadows', stage: 's3', decor: 'd3', culture: 'norse', plan: 'L' },
      { type: 'tavern', biome: 'Black Forest', stage: 's3', decor: 'd3', culture: 'norse-forest', plan: 'T' },
      { type: 'home', biome: 'Swamp', stage: 's2', decor: 'd2', plan: 'cross' },
      { type: 'home', biome: 'Meadows', stage: 's3', decor: 'd3', culture: 'celtic' }],
    flags: ['motifCorners', 'motifIcorners', 'cornerPosts'],
    focus: 'auto',
  },
  entry: {
    bases: [
      { type: 'home', biome: 'Meadows', stage: 's3', decor: 'd3', culture: 'norse' },
      { type: 'longhouse', biome: 'Black Forest', stage: 's3', decor: 'd3' },
      { type: 'tavern', biome: 'Plains', stage: 's3', decor: 'd3' },
      { type: 'home', biome: 'Mountain', stage: 's2', decor: 'd2' }],
    flags: ['motifs', 'doorHood', 'gablePorch', 'doorLamp'],
    focus: d => { const p = lowest(d, 'door'); return p && faceOn(d, p, 3.4, 4.2, 12); },
  },
  eave: {
    bases: [
      { type: 'home', biome: 'Meadows', stage: 's3', decor: 'd3', culture: 'norse' },
      { type: 'longhouse', biome: 'Black Forest', stage: 's3', decor: 'd3', culture: 'norse-forest' },
      { type: 'storage', biome: 'Swamp', stage: 's2', decor: 'd2' }],
    flags: ['eaveMotifs'],
    focus: 'auto', view: { el: 2, az: -35, pad: 1.5 },
  },
  face: {
    bases: [
      { type: 'home', biome: 'Meadows', stage: 's3', decor: 'd3' },
      { type: 'tavern', biome: 'Black Forest', stage: 's3', decor: 'd3' },
      { type: 'longhouse', biome: 'Plains', stage: 's2', decor: 'd2' },
      { type: 'home', biome: 'Mistlands', stage: 's3', decor: 'd3' }],
    flags: ['motifFaces'],
    // face on to the first bay that carries a wall-face motif
    focus: d => { const p = d.pieces.find(q => q.motif && /^MA-/.test(q.motif) && /torch|lantern|banner|itemstand|sign|dragon|raven|wolf|chain|cloth/.test(q.name)); return p && faceOn({ pieces: d.pieces }, p, 2.6, 4, 10); },
  },
  base: {
    bases: [
      { type: 'home', biome: 'Meadows', stage: 's3', decor: 'd3' },
      { type: 'longhouse', biome: 'Black Forest', stage: 's2', decor: 'd2' },
      { type: 'workshop', biome: 'Swamp', stage: 's3', decor: 'd3' }],
    flags: ['motifBase', 'bands'],
    focus: 'auto',
  },
  // the yard (lib/yards.js): a winding or square fence, the beds, the props and the lamp at the gate, seen from above
  // the front corner so the fence line, the gate and the path show
  yard: {
    bases: [
      { type: 'home', biome: 'Meadows', stage: 's2', decor: 'd2' },
      { type: 'home', biome: 'Black Forest', stage: 's3', decor: 'd3' },
      { type: 'farm', biome: 'Meadows', stage: 's3', decor: 'd3' },
      { type: 'home', biome: 'Plains', stage: 's3', decor: 'd3' }],
    flags: ['yardOrganic', 'yardBeds', 'yardProps', 'yardLamp'],
    focus: () => ({ az: 28, el: 38, crop: null }),
  },
  wall: {
    bases: [
      { type: 'longhouse', biome: 'Meadows', stage: 's3', decor: 'd3' },
      { type: 'home', biome: 'Black Forest', stage: 's2', decor: 'd2' },
      { type: 'tavern', biome: 'Meadows', stage: 's3', decor: 'd3', culture: 'anglo-saxon' }],
    flags: ['cornerPosts', 'bands', 'midRail', 'braces', 'windowFrame'],
    focus: 'auto',
  },
};

// pick test buildings where the part shows: scan seeds and keep those where most flags each add pieces near the part
function fixtures(spec, want) {
  const out = [];
  for (const base of spec.bases) {
    let best = null;
    for (let seed = 1; seed <= 60 && !(best && best.hits === spec.flags.length); seed++) {
      // ablation from the full set: a flag shows when turning it off alone changes pieces near the part
      const off = Object.fromEntries(spec.flags.map(f => [f, true]));
      const d0 = G.generate({ ...base, seed, details: off });
      const f = typeof spec.focus === 'function' ? spec.focus(d0) : { crop: null };
      if (!f) continue;
      const key = p => `${p.name}@${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`;
      const s0 = new Set(d0.pieces.map(key));
      const inBox = p => !f.crop || (p.x >= f.crop.x0 && p.x <= f.crop.x1 && p.z >= f.crop.z0 && p.z <= f.crop.z1);
      let hits = 0;
      for (const fl of spec.flags) { const d1 = G.generate({ ...base, seed, details: { ...off, [fl]: false } }); const s1 = new Set(d1.pieces.map(key)); if (d0.pieces.some(p => !s1.has(key(p)) && inBox(p))) hits++; }
      if (!best || hits > best.hits) best = { seed, hits };
    }
    if (best) out.push({ base, seed: best.seed, hits: best.hits });
  }
  return out.slice(0, want);
}

const spec = PARTS[part];
if (!spec) { console.error('parts:', Object.keys(PARTS).join(', ')); process.exit(1); }

// every combination of the flags (and style choices), or a fixed sample of them when there are too many
function variants(spec, n, seed) {
  const all = [];
  const nf = spec.flags.length;
  const styles = Object.entries(spec.style || {});
  const nStyle = styles.reduce((a, [, v]) => a * v.length, 1);
  for (let m = 0; m < (1 << nf); m++) for (let s = 0; s < nStyle; s++) {
    const details = {}; spec.flags.forEach((f, i) => { details[f] = !!(m & (1 << i)); });
    const style = {}; let k = s; for (const [key, vals] of styles) { style[key] = vals[k % vals.length]; k = Math.floor(k / vals.length); }
    all.push({ details, style });
  }
  // drop combinations where a flag is on without the flag it depends on (they repeat the bare variant)
  const req = spec.requires || {};
  for (let i = all.length - 1; i >= 0; i--) if (Object.entries(req).some(([f, need]) => all[i].details[f] && !all[i].details[need])) all.splice(i, 1);
  if (all.length <= n) return all;
  // keep the bare one and the full one, the rest a seeded sample
  let x = seed * 9301 + 49297;
  const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  const pick = [all[0], all[all.length - 1]];
  const rest = all.slice(1, -1);
  while (pick.length < n && rest.length) pick.push(rest.splice(Math.floor(rnd() * rest.length), 1)[0]);
  return pick;
}

const tiles = [], rows = [];
const W = 300, H = 250;
let bi = 0;
const fx = fixtures(spec, 6);
console.log('test buildings:', fx.map(f => `${f.base.type} ${f.base.biome} seed ${f.seed} (${f.hits}/${spec.flags.length} flags show)`).join('; '));
for (const { base, seed } of fx) {
  bi++;
  // the camera is set once per building, so every picture of it is framed the same: on the pieces the part adds
  // (full variant against bare variant), looking at them from outside the building
  const full = G.generate({ ...base, seed, details: Object.fromEntries(spec.flags.map(x => [x, true])) });
  let f0 = spec.focus === 'auto' || !spec.focus ? autoFocus(full, G.generate({ ...base, seed, details: Object.fromEntries(spec.flags.map(x => [x, false])) })) : spec.focus(full);
  // a part seen from low down (eaves from under them)
  if (spec.view && f0) { f0.el = spec.view.el; f0.az += spec.view.az || 0; if (f0.crop && spec.view.pad) { f0.crop.y0 -= spec.view.pad; } }
  for (const v of variants(spec, perBase, seed)) {
    const req = { ...base, seed, details: v.details, style: v.style };
    const d = G.generate(req);
    const fails = Ck.check(d, base.biome).filter(c => !c.ok).map(c => c.check + ': ' + c.detail);
    const f = f0;
    if (spec.inside && f.crop && !f.cut) { f.cut = f.floor + (spec.cutAt || 1.3); f.el = 50; f.crop.y1 = f.cut; f.az += 160; }
    const on = Object.entries(v.details).filter(([, x]) => x).map(([k]) => k);
    const label = `${bi}.${rows.filter(r => r.base === bi).length + 1}`;
    const row = { id: label, base: bi, name: d.meta.Name, details: on, style: v.style, pieces: d.pieces.length, fails };
    if (f && f.crop) row.near = d.pieces.filter(p => p.x >= f.crop.x0 && p.x <= f.crop.x1 && p.z >= f.crop.z0 && p.z <= f.crop.z1 && p.y < f.crop.y1).length;
    rows.push(row);
    const c = createCanvas(W, H), cx = c.getContext('2d');
    if (f) R.draw(cx, d.pieces, { az: f.az, el: f.el, crop: f.crop || undefined, cut: f.cut, width: W, height: H - 34, ss: 2, background: fails.length ? '#e8c9c0' : '#e9e4d8' });
    cx.fillStyle = '#d9d2c3'; cx.fillRect(0, H - 34, W, 34);
    cx.fillStyle = fails.length ? '#a02010' : '#2b241c'; cx.font = 'bold 13px sans-serif';
    cx.fillText(`${label}${fails.length ? '  FAILS' : ''}  ${Object.values(v.style).join(' ')}`, 5, H - 20);
    cx.font = '10px sans-serif'; cx.fillStyle = '#2b241c';
    cx.fillText(on.join(' ') || '(none)', 5, H - 6);
    tiles.push(c);
  }
}
const cols = Math.min(6, tiles.length), sheetRows = Math.ceil(tiles.length / cols);
const sheet = createCanvas(cols * W, sheetRows * H + 30), sx = sheet.getContext('2d');
sx.fillStyle = '#d9d2c3'; sx.fillRect(0, 0, sheet.width, sheet.height);
sx.fillStyle = '#2b241c'; sx.font = 'bold 18px sans-serif';
sx.fillText(`${part}: ${spec.bases.map((b, i) => `${i + 1} ${b.type} ${b.biome} ${b.stage}${b.culture ? ' ' + b.culture : ''}`).join(' | ')}`, 8, 21);
tiles.forEach((t, i) => sx.drawImage(t, (i % cols) * W, 30 + Math.floor(i / cols) * H));
fs.writeFileSync(path.join(outDir, part + '.png'), sheet.toBuffer('image/png'));
fs.writeFileSync(path.join(outDir, part + '.json'), JSON.stringify(rows, null, 1));
const bad = rows.filter(r => r.fails.length);
console.log(`${part}: ${rows.length} variants, ${bad.length} fail checks -> ${path.join(outDir, part + '.png')}`);
for (const r of bad.slice(0, 12)) console.log(' ', r.id, r.details.join(','), '|', r.fails.join(' | '));
