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

const PARTS = {
  door: {
    bases: [
      { type: 'home', biome: 'Black Forest', stage: 's2', decor: 'd2' },
      { type: 'longhouse', biome: 'Meadows', stage: 's3', decor: 'd3' },
      { type: 'tavern', biome: 'Plains', stage: 's3', decor: 'd3' },
      { type: 'home', biome: 'Mountain', stage: 's3', decor: 'd3' }],
    flags: ['doorFrame', 'doorHood', 'doorstep', 'doorLamp'],
    focus: d => { const p = lowest(d, 'door'); return p && faceOn(d, p); },
  },
  window: {
    bases: [
      { type: 'home', biome: 'Black Forest', stage: 's2', decor: 'd2' },
      { type: 'tavern', biome: 'Meadows', stage: 's3', decor: 'd3' },
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
    // the whole building from off the end of its ridge
    focus: d => {
      const tops = d.pieces.filter(p => role(p) === 'roofTop');
      if (!tops.length) return null;
      const [cx, cz] = centre(d);
      const a = yawOf(tops[0]) * Math.PI / 180, ux = Math.cos(a), uz = -Math.sin(a);
      return { az: Math.atan2(ux, -uz) * 180 / Math.PI + 25, el: 14, crop: null, centre: [cx, cz] };
    },
  },
  stack: {
    bases: [
      { type: 'longhouse', biome: 'Black Forest', stage: 's3', decor: 'd3', culture: 'norse-forest' },
      { type: 'home', biome: 'Swamp', stage: 's2', decor: 'd2' },
      { type: 'tavern', biome: 'Mountain', stage: 's3', decor: 'd3' },
      { type: 'smithy', biome: 'Plains', stage: 's3', decor: 'd3' }],
    flags: ['stack', 'stackShoulder', 'stackCrown'],
    // the whole building, three-quarter view from the stack's side
    focus: d => {
      const st = d.pieces.filter(p => /stone_wall_2x1/.test(p.name) && p.trim);
      const [cx, cz] = centre(d);
      const sx = st.length ? Math.sign(st[0].x - cx) : 1;
      return { az: sx > 0 ? 60 : -120, el: 16, crop: null };
    },
  },
  wall: {
    bases: [
      { type: 'longhouse', biome: 'Meadows', stage: 's3', decor: 'd3' },
      { type: 'home', biome: 'Black Forest', stage: 's2', decor: 'd2' },
      { type: 'tavern', biome: 'Meadows', stage: 's3', decor: 'd3', culture: 'anglo-saxon' }],
    flags: ['cornerPosts', 'bands', 'midRail', 'braces', 'windowFrame'],
    focus: () => ({ az: 35, el: 18, crop: null }),
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
      const f = spec.focus(d0);
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
  // the camera is set on the full variant and kept, so every picture of one building is framed the same
  const f0 = spec.focus(G.generate({ ...base, seed, details: Object.fromEntries(spec.flags.map(x => [x, true])) }));
  for (const v of variants(spec, perBase, seed)) {
    const req = { ...base, seed, details: v.details, style: v.style };
    const d = G.generate(req);
    const fails = Ck.check(d, base.biome).filter(c => !c.ok).map(c => c.check + ': ' + c.detail);
    const f = f0;
    const on = Object.entries(v.details).filter(([, x]) => x).map(([k]) => k);
    const label = `${bi}.${rows.filter(r => r.base === bi).length + 1}`;
    const row = { id: label, base: bi, name: d.meta.Name, details: on, style: v.style, pieces: d.pieces.length, fails };
    if (f && f.crop) row.near = d.pieces.filter(p => p.x >= f.crop.x0 && p.x <= f.crop.x1 && p.z >= f.crop.z0 && p.z <= f.crop.z1 && p.y < f.crop.y1).length;
    rows.push(row);
    const c = createCanvas(W, H), cx = c.getContext('2d');
    if (f) R.draw(cx, d.pieces, { az: f.az, el: f.el, crop: f.crop || undefined, width: W, height: H - 34, ss: 2, background: fails.length ? '#e8c9c0' : '#e9e4d8' });
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
