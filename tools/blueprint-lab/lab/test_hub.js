// The village hub (lib/hub.js): node lab/test_hub.js [render-dir] [seeds]
// For each line (Norse long, Norse round, Celtic round, Middle Eastern court), every stage s1 to s5 at d1 and d3:
// every check in lib/checks.js passes; the shape family measured from the walls and roofs holds from s2 to s5 (D-132);
// the fire is at the hub's heart and the notice board in the hearth area at every stage (D-140); the leader's marker is
// there (D-141); item stands for mementos stay empty (D-134); the s1 camp lies inside the s5 plot (D-083); s5 has the
// most floor of any building in its culture's set (every other type at s3, the lab's last stage for them).
// Renders each line s1 to s5 into the render dir (default /tmp/hub-renders). Exits 1 on a failure.
const path = require('path'), fs = require('fs');
const G = require('../lib/generate.js'), Ck = require('../lib/checks.js'), P = require('../lib/pieces.js');
const S = require('../lib/styles.js'), H = require('../lib/hub.js');
const outDir = process.argv[2] || '/tmp/hub-renders';
const seeds = +(process.argv[3] || 2);
let failed = 0;
const ok = (cond, what) => { if (!cond) { failed++; console.log('FAIL', what); } };

const LINES = [
  { id: 'norse-long', culture: 'norse', biome: 'Meadows', line: 'long' },
  { id: 'norse-round', culture: 'norse', biome: 'Meadows', line: 'round' },
  { id: 'celtic-round', culture: 'celtic', biome: 'Black Forest', line: 'round' },
  { id: 'court', culture: 'middle-eastern', biome: 'Plains', line: 'court' },
];

// Shape family from the pieces: wall turns (a round plan has many), the plan's aspect, and whether the fire is under
// a roof (a court's fire is in the open yard).
function family(d) {
  const walls = d.pieces.filter(p => ['wall', 'door', 'window'].includes(P.piece(p.name).role) && !p.notice && !p.decor && p.y < 3);
  if (!walls.length) return 'camp';
  const yaws = new Set(walls.map(p => Math.round((((p.yaw % 180) + 180) % 180) / 5)));
  if (yaws.size >= 6) return 'round';
  const xs = walls.map(p => p.x), zs = walls.map(p => p.z);
  const w = Math.max(...xs) - Math.min(...xs), dd = Math.max(...zs) - Math.min(...zs);
  const roofed = d.pieces.some(p => ['roof', 'roofTop', 'floor'].includes(P.piece(p.name).role) && p.y > 2 && Math.abs(p.x) < 1.01 && Math.abs(p.z) < 1.01);
  if (!roofed) return 'court';
  return Math.max(w, dd) / Math.max(1, Math.min(w, dd)) >= 1.5 ? 'long' : 'square';
}
// Floor on every level, m2, and the height
function measure(d) {
  let area = 0, top = 0;
  for (const p of d.pieces) {
    const pi = P.piece(p.name);
    if (pi.role === 'floor' && !p.yard && !p.dais) area += pi.size[0] * pi.size[2];
    if (pi.structural) top = Math.max(top, p.y + pi.size[1] / 2);
  }
  return { area: Math.round(area), top: +top.toFixed(1) };
}
const box = ps => { const xs = ps.map(p => p.x), zs = ps.map(p => p.z); return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }; };

let render = null;
try {
  const R = require('../lib/render.js');
  const { createCanvas } = require(path.join(__dirname, '../node_modules/@napi-rs/canvas'));
  fs.mkdirSync(outDir, { recursive: true });
  render = (d, file) => {
    const tiles = [];
    for (const v of [{ az: 35, el: 35 }, { az: 215, el: 55, cut: 2.6 }]) {
      const c = createCanvas(800, 600);
      R.draw(c.getContext('2d'), d.pieces, { width: 800, height: 600, az: v.az, el: v.el, cut: v.cut, background: '#e9e4d8', ss: 1 });
      tiles.push(c);
    }
    const Sc = createCanvas(1600, 630), g = Sc.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 1600, 630);
    tiles.forEach((t, i) => g.drawImage(t, i * 800, 30));
    g.fillStyle = '#222'; g.font = '20px sans-serif';
    const m = measure(d);
    g.fillText(`${d.meta.Name}  ${d.pieces.length} pieces, ${m.area} m2 of floor, ${m.top} m high (left: whole; right: cut at 2.6 m)`, 8, 22);
    fs.writeFileSync(file, Sc.toBuffer('image/png'));
  };
} catch (e) { console.log('no renders:', e.message); }

const rows = [], rendered = [];
for (const L of LINES) for (let seed = 1; seed <= seeds; seed++) {
  const fams = {}, ds = {};
  for (const stage of H.STAGES) for (const decor of ['d1', 'd3']) {
    const d = G.generate({ type: 'hub', biome: L.biome, culture: L.culture, line: L.line, stage, decor, seed });
    const name = d.meta.Name;
    for (const c of Ck.check(d, L.biome)) ok(c.ok, `${name}: ${c.check}: ${c.detail}`);
    const fire = d.pieces.find(p => /^(hearth|fire_pit)$/.test(p.name) && Math.hypot(p.x, p.z) < 0.5);
    ok(fire, `${name}: no fire at the hub's heart`);
    const signs = d.pieces.filter(p => p.notice && p.name === 'sign');
    ok(signs.length >= 3, `${name}: notice board missing (${signs.length} notices)`);
    ok(signs.every(p => Math.hypot(p.x, p.z) < 22), `${name}: a notice stands outside the hearth area`);
    const lead = (d.markers || []).find(m => m.leader);
    ok(lead, `${name}: no leader marker`);
    if (+stage[1] >= 3) ok(d.pieces.some(p => p.highSeat), `${name}: no high seat`);
    ok(d.pieces.filter(p => /^itemstand/.test(p.name) && p.memento).every(p => !p.item), `${name}: a memento stand holds an item`);
    ok(d.request.line === L.line, `${name}: line ${d.request.line}`);
    ok((d.markers || []).some(m => m.kind === 'path'), `${name}: no path marker`);
    const text = H.write(d);
    ok(/#VillheimLeader\nseat;/.test(text) && /#VillheimPaths\npath;/.test(text), `${name}: markers not written`);
    if (decor === 'd3') {
      fams[stage] = family(d);
      ds[stage] = d;
      const m = measure(d);
      rows.push({ line: L.id, seed, stage, pieces: d.pieces.length, area: m.area, top: m.top, family: fams[stage], features: (d.request.features || []).join(' ') });
      if (render && seed === 1) { const f = path.join(outDir, `${L.id}_${stage}.png`); render(d, f); rendered.push(f); }
    }
  }
  const fam = fams.s2;
  ok(fam === (L.line === 'long' ? 'long' : L.line), `${L.id} seed ${seed}: s2 family ${fam}`);
  for (const st of ['s3', 's4', 's5']) ok(fams[st] === fam, `${L.id} seed ${seed}: ${st} family ${fams[st]}, s2 ${fam} (D-132)`);
  // the camp lies inside the last stage's plot (D-083), a metre of slack for the lean-to eaves
  const p5 = box(ds.s5.pieces.filter(p => P.piece(p.name).structural)), p1 = box(ds.s1.pieces.filter(p => P.piece(p.name).structural));
  ok(p1.x0 >= p5.x0 - 1 && p1.x1 <= p5.x1 + 1 && p1.z0 >= p5.z0 - 4 && p1.z1 <= p5.z1 + 1, `${L.id} seed ${seed}: s1 camp outside the s5 plot`);
  // each stage larger than the one before
  const areas = H.STAGES.slice(1).map(st => measure(ds[st]).area);
  ok(areas.every((a, i) => i === 0 || a > areas[i - 1]), `${L.id} seed ${seed}: floor does not grow every stage (${areas.join(', ')})`);
}

// s5 is the largest building in its culture's set
for (const L of LINES) {
  const hub = measure(G.generate({ type: 'hub', biome: L.biome, culture: L.culture, line: L.line, stage: 's5', decor: 'd1', seed: 1 }));
  let best = null;
  for (const type of Object.keys(S.TYPES)) {
    if (type === 'hub') continue;
    for (let seed = 1; seed <= 3; seed++) {
      const m = measure(G.generate({ type, biome: L.biome, culture: L.culture, stage: 's3', decor: 'd1', seed, skipDecor: true, yard: false }));
      if (!best || m.area > best.area) best = { ...m, type, seed };
    }
  }
  ok(hub.area > best.area, `${L.id}: s5 hub ${hub.area} m2 is not larger than ${best.type} s3 (${best.area} m2)`);
  console.log(`${L.id}: s5 ${hub.area} m2, ${hub.top} m; largest other building ${best.type} s3 seed ${best.seed}: ${best.area} m2, ${best.top} m`);
}

console.log('\nline           seed stage pieces  floor m2  top m  family  features');
for (const r of rows) console.log(`${r.line.padEnd(14)} ${String(r.seed).padStart(4)} ${r.stage.padEnd(5)} ${String(r.pieces).padStart(6)} ${String(r.area).padStart(9)} ${String(r.top).padStart(6)}  ${r.family.padEnd(7)} ${r.features}`);
if (rendered.length) console.log('\nrenders:\n' + rendered.join('\n'));
console.log(failed ? `\n${failed} failures` : '\nall hub tests pass');
process.exit(failed ? 1 : 0);
