// Pictures of the item stands in generated houses: each room cut at 2.6 m, from above and from two sides, with what
// each stand holds drawn as a stand-in (the renderer has no item models): a mead or a jar for drink, the dish's own
// model where there is one, a mushroom for herbs, a disc for a shield, a stick for a weapon or a tool, a block for a
// trophy, colored by kind. The stand sets of lib/stands.js are listed under the picture.
//   node lab/render_stands.js <out dir> [type:biome:seed ...]     (default: a home, a longhouse and a tavern)
const fs = require('fs'), path = require('path');
const { createCanvas } = require('@napi-rs/canvas');
const G = require('../lib/generate.js'), KB = require('../lib/kitbash.js'), R = require('../lib/render.js'), Ck = require('../lib/checks.js'), ST = require('../lib/styles.js');
const MS = require('./mine_stands.js'), MODELS = require('../data/piece-models.json').pieces;
const out = process.argv[2] || '/tmp/stands-renders';
fs.mkdirSync(out, { recursive: true });
const reqs = process.argv.slice(3).length ? process.argv.slice(3) : ['home:Meadows:11', 'longhouse:Swamp:30', 'tavern:Plains:50'];
const COLOR = { drink: '#c08a2a', food: '#6f9a3a', herbs: '#9fc25a', trophy: '#7a4b2a', boss: '#4a2a1a', shield: '#3f6fb0', weapon: '#7d7d86', tool: '#c0602a', farm: '#a07a30', fish: '#4aa0a8', rare: '#8a3fb0', hat: '#c0a0d0', other: '#999' };
// a stand-in piece for what a stand holds
function proxy(p) {
  const name = p.item && p.item.name;
  if (!name) return null;
  const kd = MS.kindOf(name), q = p.q, flat = p.name === 'itemstandh';
  const at = (n, dy, s) => ({ name: n, x: p.x, y: p.y + dy, z: p.z, q, s: s || [1, 1, 1], decor: true, _kd: kd });
  if (flat) {
    if (MODELS[name]) return at(name, 0.03);
    if (kd === 'drink') return at('MeadTasty', 0.03);
    if (kd === 'food') return at('QueensJam', 0.03);
    if (kd === 'herbs') return at('MushroomYellow', 0.04);
    if (kd === 'fish') return at('Fish3', 0.05, [0.5, 0.5, 0.5]);
    if (kd === 'shield') return at('woodwall', 0.05, [0.25, 0.04, 0.25]);
    if (['weapon', 'tool', 'farm'].includes(kd)) return at('wood_pole', 0.06, [0.15, 0.1, 2.0]);
    return at('wood_pole', 0.12, [0.7, 0.25, 0.7]);
  }
  // on the wall: in front of the stand's plate
  const f = [2 * (q[0] * q[2] + q[3] * q[1]), 0, 1 - 2 * (q[0] * q[0] + q[1] * q[1])];
  const off = (n, d, s, dy = 0) => ({ name: n, x: p.x + f[0] * d, y: p.y + dy, z: p.z + f[2] * d, q, s, decor: true, _kd: kd });
  if (kd === 'shield') return off('woodwall', 0.12, [0.3, 0.3, 0.2]);
  if (['weapon', 'tool', 'farm'].includes(kd)) return off('wood_pole', 0.1, [0.15, 0.9, 0.15]);
  if (kd === 'fish') return off('Fish3', 0.15, [0.5, 0.5, 0.5]);
  return off('wood_pole', 0.2, [0.9, 0.45, 0.9]);
}
// a close look at each stand set: its pieces and the room round it, 1.2 m all round, from the room's side
function closeups(d, label, prefix) {
  const byKb = new Map();
  for (const p of d.pieces) if (/^(KS-|BK-|KC-)/.test(p.kb || '') && d.pieces.some(q => q.kb === p.kb && /^itemstand/.test(q.name))) { if (!byKb.has(p.kb)) byKb.set(p.kb, []); byKb.get(p.kb).push(p); }
  const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
  const pick = [...byKb.entries()].filter(([k]) => /^KS-/.test(k) && (!only || only.test(k))).slice(0, +(process.env.CLOSE || 8));
  pick.forEach(([kb, mine], i) => {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity;
    for (const p of mine) { const b = Ck.aabb(p); x0 = Math.min(x0, b.x0); x1 = Math.max(x1, b.x1); z0 = Math.min(z0, b.z0); z1 = Math.max(z1, b.z1); y0 = Math.min(y0, b.y0); }
    const pad = 0.8, crop = { x0: x0 - pad, x1: x1 + pad, z0: z0 - pad, z1: z1 + pad };
    const floor = Math.min(y0, ...mine.map(p => p.y)) - (y0 > 1.5 ? 2.2 : y0 > 0.4 ? 0.8 : 0.1);
    const P = require('../lib/pieces.js');
    const near = d.pieces.filter(p => p.x > crop.x0 - 0.6 && p.x < crop.x1 + 0.6 && p.z > crop.z0 - 0.6 && p.z < crop.z1 + 0.6 && p.y > floor - 0.6 && p.y < floor + 3.4 &&
      !(['roof', 'roofTop', 'roofCorner', 'floor', 'gable'].includes(P.piece(p.name).role) && p.y > floor + 1.2));
    const items = near.filter(p => /^itemstandh?$/.test(p.name)).map(proxy).filter(Boolean);
    const fy = (mine[0].yaw || 0);
    const c = createCanvas(1500, 540), ctx = c.getContext('2d');
    ctx.fillStyle = '#d9d2c3'; ctx.fillRect(0, 0, 1500, 540);
    const hung = mine.some(p => p.name === 'itemstand' || p.y > floor + 1.3);
    [{ az: fy + 180 - 30, el: 38 }, { az: fy + 180 + 30, el: 38 }, { az: 0, el: 90 }].forEach((v, k) => {
      const sub = createCanvas(500, 500), sctx = sub.getContext('2d');
      R.draw(sctx, near.concat(items), { ...v, cut: floor + (hung && k < 2 ? 2.9 : 1.6), width: 500, height: 500, crop });
      ctx.drawImage(sub, k * 500, 30);
    });
    const held = mine.filter(p => p.item).map(p => p.item.name);
    ctx.fillStyle = '#2b241c'; ctx.font = '15px sans-serif';
    ctx.fillText(`${label}: ${kb.split('@')[0]}, stage ${mine[0].ds}: ${mine.map(p => p.name).join(', ')}; holds ${held.join(', ')}`, 8, 20);
    const file = path.join(out, `${prefix}-set${i}-${kb.split('@')[0]}.png`);
    fs.writeFileSync(file, c.toBuffer('image/png'));
    console.log(file);
  });
}
for (const r of reqs) {
  const [type, biome, seed, persona] = r.split(':');
  const d = G.generate({ type, biome, stage: 's3', decor: 'd3', seed: +seed, persona });
  const hh = d.request.household;
  closeups(d, `${type} ${biome} ${seed} (${hh.label})`, `${type}-${biome.replace(/ /g, '')}-${seed}`);
  if (process.env.CLOSE_ONLY) continue;
  const rooms = KB.roomsB(d, { type, use: ST.TYPES[type].use });
  rooms.forEach((room, ri) => {
    const m = room.m;
    if (m.area < 6) return;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const c of m.cells) { x0 = Math.min(x0, c.x - 0.5); x1 = Math.max(x1, c.x + 0.5); z0 = Math.min(z0, c.z - 0.5); z1 = Math.max(z1, c.z + 0.5); }
    const crop = { x0: x0 - 0.6, x1: x1 + 0.6, z0: z0 - 0.6, z1: z1 + 0.6 };
    const near = d.pieces.filter(p => p.x > crop.x0 - 0.5 && p.x < crop.x1 + 0.5 && p.z > crop.z0 - 0.5 && p.z < crop.z1 + 0.5 && p.y > m.stand - 0.6 && p.y < m.stand + 3.4);
    const items = near.filter(p => /^itemstandh?$/.test(p.name)).map(proxy).filter(Boolean);
    const all = near.concat(items);
    const c = createCanvas(1800, 660), ctx = c.getContext('2d');
    ctx.fillStyle = '#d9d2c3'; ctx.fillRect(0, 0, 1800, 660);
    [{ az: 30, el: 35 }, { az: 210, el: 35 }, { az: 0, el: 90 }].forEach((v, i) => {
      const sub = createCanvas(600, 600), sctx = sub.getContext('2d');
      R.draw(sctx, all, { ...v, cut: m.stand + 2.6, width: 600, height: 600, crop });
      ctx.drawImage(sub, i * 600, 30);
    });
    const sets = {};
    for (const p of near) if (/^KS-/.test(p.kb || '')) sets[p.kb.split('@')[0]] = (sets[p.kb.split('@')[0]] || 0) + 1;
    const held = {};
    for (const p of items) held[p._kd] = (held[p._kd] || 0) + 1;
    ctx.fillStyle = '#2b241c'; ctx.font = '15px sans-serif';
    ctx.fillText(`${type} ${biome} seed ${seed}, room ${ri} ${room.role} ${m.area.toFixed(0)} m2; ${hh.label}`, 8, 20);
    ctx.fillText(`stands: ${items.length} (${Object.entries(held).map(([k, v]) => `${k} ${v}`).join(', ')}); stand sets: ${Object.keys(sets).join(', ') || 'none'}`, 8, 652);
    const file = path.join(out, `${type}-${biome.replace(/ /g, '')}-${seed}-r${ri}.png`);
    fs.writeFileSync(file, c.toBuffer('image/png'));
    console.log(file, items.length, 'stands');
  });
}
