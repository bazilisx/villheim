// The design grammar of whole buildings in the corpus (docs/ARCHITECTURE_STUDY.md, track H of the showcase review).
//   node lab/arch_grammar.js <compact.jsonl> <builds.jsonl from lab/rooms_corpus_extract.js> <out json> [--limit N]
// Per vanilla build, turned square to its walls (builds.jsonl rot), and per building inside it (walls and roofs joined
// at 2.5 m or less; a build with three or more buildings is read as a village):
//   materials  wall material families and where one gives way to another (a plinth, a floor line, elsewhere); heavy
//              under light; whether a stone base runs round every side
//   roofs      roof slope families (26, 45, 67 degrees, flat) and roof materials per building
//   bays       posts in a line (same base, same wall line): are the gaps between them equal, and how wide
//   symmetry   share of walls, roofs, posts, doors and windows with a mirror partner across the building's middle
//              (the better of its two axes); doors on that axis
//   ornament   carved heads on roofs (dragon, raven, wolf): high up, in mirrored pairs
//   doors      outer doors: is one door dressed more than the others (posts, lintel, hood, lights, banners round it)
//   village    in builds of three or more buildings, how many share the lead wall material, roof material and slope
// Counts and shares only: no file names.
const fs = require('fs'), readline = require('readline');
const L = require('./rooms_corpus_lib.js');
const { P, qs, inc } = L;
const args = process.argv.slice(2);
const [compact, buildsFile, outFile] = args;
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const LIMIT = +(opt('--limit') || 1e9), LABEL = opt('--label') || 'corpus';
if (!compact || !buildsFile || !outFile) { console.error('usage: node lab/arch_grammar.js <compact.jsonl> <builds.jsonl> <out json>'); process.exit(1); }
const r3 = v => Math.round(v * 1000) / 1000;
const sh = (a, b) => (b ? r3(a / b) : null);

const wallMat = n => {
  if (/crystal|glass|iron_wall|iron_grate|metal_wall|window/.test(n)) return null;
  if (/^wood_wall_log/.test(n)) return 'log';
  if (/^(stone_|stone_wall)/.test(n)) return 'stone';
  if (/blackmarble/.test(n)) return 'marble';
  if (/grausten/i.test(n)) return 'grausten';
  if (/^darkwood/.test(n)) return 'darkwood';
  if (/^ashwood/.test(n)) return 'ashwood';
  if (/dvergr/.test(n)) return 'dvergr';
  if (/^(woodwall|wood_wall|wood_)/.test(n)) return 'wood';
  return 'other';
};
const HEAVY = new Set(['stone', 'marble', 'grausten']);
const roofMat = n => /^wood_roof|^wood_wall_roof_top/.test(n) ? 'thatch' : /^darkwood_roof/.test(n) ? 'darkwood' : /grausten/i.test(n) ? 'grausten' : /turf/.test(n) ? 'turf' : /copper/.test(n) ? 'copper' : /ashwood|ashlands/i.test(n) ? 'ash' : 'other';
const roofSlope = n => /_67/.test(n) ? '67' : /_45/.test(n) ? '45' : /flat/.test(n) ? 'flat' : /^(wood_roof|darkwood_roof|wood_roof_top|darkwood_roof_top|wood_roof_ocorner|wood_roof_icorner|darkwood_roof_ocorner|darkwood_roof_icorner|turf_roof|copper_roof)/.test(n) ? '26' : 'other';
const ORN = /^(wood_dragon1|darkwood_raven|darkwood_wolf|dragon_head.*)$/;

const A = {
  builds: 0, buildings: 0,
  mats: { buildings: 0, nMain: [], two: 0, heavyUnder: 0, heavyOver: 0, change: {}, baseAllSides: 0, baseSidesRead: 0, mainCombos: {} },
  roofs: { buildings: 0, oneSlope: 0, oneMat: 0, slopes: {}, mats: {}, nSlopes: [] },
  bays: { lines: 0, even: 0, gaps: {}, buildings: 0, buildingsEven: 0 },
  sym: { buildings: 0, score: [], doorOnAxis: 0, doorRead: 0, byKind: {} },
  orn: { builds: 0, pieces: 0, high: 0, paired: 0, counts: {} },
  doors: { buildings: 0, oneMain: 0, allSame: 0, mainOnLong: 0, mainRead: 0, scoreGap: [] },
  village: { builds: 0, buildings: 0, wallLead: [], roofLead: [], slopeLead: [], allThree: [] },
};

function clusters(ps) {
  // walls and roofs joined at 2.5 m or less on a 2.5 m grid
  const S = ps.filter(p => p.cm);
  const parent = S.map((_, i) => i), find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const grid = new Map(), K = (i, j) => i * 100003 + j;
  S.forEach((p, i) => { const k = K(Math.floor(p.x / 2.5), Math.floor(p.z / 2.5)); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); });
  S.forEach((p, i) => {
    const gi = Math.floor(p.x / 2.5), gj = Math.floor(p.z / 2.5);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const j of grid.get(K(gi + a, gj + b)) || []) {
      if (j <= i) continue;
      const q = S[j];
      if (Math.hypot(p.x - q.x, p.z - q.z) <= 2.5 && Math.abs(p.y - q.y) < 6) { const ri = find(i), rj = find(j); if (ri !== rj) parent[ri] = rj; }
    }
  });
  const m = new Map();
  S.forEach((p, i) => { const r = find(i); if (!m.has(r)) m.set(r, []); m.get(r).push(p); });
  return [...m.values()].filter(l => l.filter(p => p.role === 'wall').length >= 12 && l.some(p => /^(roof|roofTop|roofCorner)$/.test(p.role)));
}

function building(bl, all, kind) {
  A.buildings++;
  const walls = bl.filter(p => p.role === 'wall' && p.wm);
  if (walls.length < 12) return null;
  const xs = walls.map(p => p.x), zs = walls.map(p => p.z);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const ground = Math.min(...walls.map(p => p.y - p.h / 2));
  const inBox = p => p.x > x0 - 1.5 && p.x < x1 + 1.5 && p.z > z0 - 1.5 && p.z < z1 + 1.5;
  const near = all.filter(inBox);
  // ---- materials
  const cnt = {};
  for (const p of walls) inc(cnt, p.wm);
  const main = Object.entries(cnt).filter(([, c]) => c >= walls.length * 0.1).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  A.mats.buildings++; A.mats.nMain.push(main.length);
  inc(A.mats.mainCombos, [...main].sort().join('+'));
  const heavy = main.filter(m => HEAVY.has(m)), light = main.filter(m => !HEAVY.has(m));
  if (heavy.length && light.length) {
    A.mats.two++;
    const my = ms => { const l = walls.filter(p => ms.includes(p.wm)); return l.reduce((t, p) => t + p.y, 0) / l.length; };
    if (my(heavy) < my(light) - 0.3) A.mats.heavyUnder++; else if (my(heavy) > my(light) + 0.3) A.mats.heavyOver++;
    // where the heavy wall gives way: the top of the heavy walls that have light walls standing on them
    const tops = [];
    for (const p of walls) {
      if (!HEAVY.has(p.wm)) continue;
      const t = p.y + p.h / 2;
      if (walls.some(q => !HEAVY.has(q.wm) && Math.abs(q.x - p.x) < 0.6 && Math.abs(q.z - p.z) < 0.6 && Math.abs(q.y - q.h / 2 - t) < 0.15)) tops.push(t);
    }
    if (tops.length) {
      const c = {};
      for (const t of tops) inc(c, Math.round(t * 2) / 2);
      const t = +Object.entries(c).sort((a, b) => b[1] - a[1])[0][0];
      const floors = new Map();
      for (const p of near) if (p.role === 'floor') { const k = Math.round(p.y * 4) / 4; floors.set(k, (floors.get(k) || 0) + 1); }
      const lines = [...floors.entries()].filter(([, n]) => n >= 6).map(([y]) => y).filter(y => y > ground + 1.2);
      const where = t - ground <= 1.6 ? 'plinth (1.5 m or less)' : lines.some(y => Math.abs(y - t) < 0.4) ? 'floor line' : 'elsewhere';
      inc(A.mats.change, where);
      if (where.startsWith('plinth')) {
        // does the base run round every side: heavy walls at the foot near each of the four sides
        const sides = [['x0', p => Math.abs(p.x - x0) < 1.2], ['x1', p => Math.abs(p.x - x1) < 1.2], ['z0', p => Math.abs(p.z - z0) < 1.2], ['z1', p => Math.abs(p.z - z1) < 1.2]];
        const foot = walls.filter(p => p.y - p.h / 2 < ground + 0.6);
        const read = sides.filter(([, f]) => foot.some(f));
        if (read.length === 4) { A.mats.baseSidesRead++; if (read.every(([, f]) => foot.filter(f).some(p => HEAVY.has(p.wm)))) A.mats.baseAllSides++; }
      }
    }
  }
  // ---- roofs
  const roofs = bl.filter(p => /^(roof|roofTop|roofCorner)$/.test(p.role));
  if (roofs.length >= 6) {
    A.roofs.buildings++;
    const s = {}, m = {};
    for (const p of roofs) { inc(s, roofSlope(p.name)); inc(m, roofMat(p.name)); }
    const ls = Object.entries(s).sort((a, b) => b[1] - a[1]), lm = Object.entries(m).sort((a, b) => b[1] - a[1]);
    if (ls[0][1] >= roofs.length * 0.9) A.roofs.oneSlope++;
    if (lm[0][1] >= roofs.length * 0.9) A.roofs.oneMat++;
    inc(A.roofs.slopes, ls[0][0]); inc(A.roofs.mats, lm[0][0]);
    A.roofs.nSlopes.push(ls.filter(([, c]) => c >= roofs.length * 0.1).length);
    // two slope families: is the minor one lower down (porches, lean-tos, aisles under the main roof)
    const fam = ls.filter(([, c]) => c >= roofs.length * 0.1);
    if (fam.length === 2) {
      const my = k => { const l = roofs.filter(p => roofSlope(p.name) === k); return l.reduce((t, p) => t + p.y, 0) / l.length; };
      A.roofs.two = (A.roofs.two || 0) + 1;
      if (my(fam[1][0]) < my(fam[0][0]) - 0.5) A.roofs.minorLower = (A.roofs.minorLower || 0) + 1;
      if (+fam[0][0] > +fam[1][0]) A.roofs.mainSteeper = (A.roofs.mainSteeper || 0) + 1;
    }
  }
  // ---- bays: posts on one line, same foot
  const poles = near.filter(p => p.role === 'pole' && p.h >= 0.9);
  const lines = new Map();
  for (const p of poles) {
    const foot = Math.round((p.y - p.h / 2) * 2) / 2;
    for (const [ax, other] of [['x', 'z'], ['z', 'x']]) { const k = `${ax}|${Math.round(p[other] * 4) / 4}|${foot}`; if (!lines.has(k)) lines.set(k, []); lines.get(k).push(p[ax]); }
  }
  let bl3 = 0, ev = 0;
  for (const l of lines.values()) {
    const u = [...new Set(l.map(v => Math.round(v * 10) / 10))].sort((a, b) => a - b);
    if (u.length < 3) continue;
    const gaps = u.slice(1).map((v, i) => r3(v - u[i]));
    if (gaps.some(g => g > 6.1)) continue; // a line broken by a long gap is two lines
    A.bays.lines++; bl3++;
    const even = gaps.every(g => Math.abs(g - gaps[0]) < 0.15);
    if (even) { A.bays.even++; ev++; inc(A.bays.gaps, String(Math.round(gaps[0] * 2) / 2)); }
  }
  if (bl3 >= 2) { A.bays.buildings++; if (ev / bl3 >= 0.75) A.bays.buildingsEven++; }
  // ---- symmetry about the middle, x or z axis
  const S = near.filter(p => /^(wall|roof|roofTop|roofCorner|pole|door|window|gable)$/.test(p.role) && p.y > ground - 0.6);
  const key = (n, x, y, z) => `${n}|${Math.round(x * 4)}|${Math.round(y * 4)}|${Math.round(z * 4)}`;
  const set = new Set(S.map(p => key(p.name, p.x, p.y, p.z)));
  const mirrored = (mx, mz) => S.filter(p => { const x = mx ? 2 * cx - p.x : p.x, z = mz ? 2 * cz - p.z : p.z; for (const dx of [0, 0.25, -0.25]) for (const dz of [0, 0.25, -0.25]) if (set.has(key(p.name, x + dx, p.y, z + dz))) return true; return false; }).length / S.length;
  const sx = mirrored(true, false), sz = mirrored(false, true);
  const score = Math.max(sx, sz);
  A.sym.buildings++; A.sym.score.push(score);
  const kk = A.sym.byKind[kind] = A.sym.byKind[kind] || [];
  kk.push(score);
  const doors = near.filter(p => p.role === 'door');
  if (doors.length && score >= 0.6) {
    A.sym.doorRead++;
    // the axis across which the halves mirror: x = cx when mirrored in x
    if (doors.some(d => (sx >= sz ? Math.abs(d.x - cx) : Math.abs(d.z - cz)) < 1.1)) A.sym.doorOnAxis++;
  }
  // ---- doors: the dressing round each outer door
  const outer = doors.filter(d => Math.abs(d.x - x0) < 1.2 || Math.abs(d.x - x1) < 1.2 || Math.abs(d.z - z0) < 1.2 || Math.abs(d.z - z1) < 1.2);
  if (outer.length >= 2) {
    A.doors.buildings++;
    const sc = outer.map(d => {
      let s = 0;
      for (const p of all) {
        const dx = p.x - d.x, dz = p.z - d.z, dy = p.y - d.y, r = Math.hypot(dx, dz);
        if (r > 3 || dy < -1.5 || dy > 4) continue;
        if (p.role === 'pole' && r < 1.6) s += 1; else if (p.role === 'beam' && r < 1.6 && dy > 0.5) s += 1;
        else if (/^(roof|roofTop)$/.test(p.role) && r < 2.5 && dy > 1) s += 2; else if (p.role === 'light') s += 2;
        else if (/^piece_banner/.test(p.name)) s += 2; else if (p.role === 'stair' && r < 2.5) s += 1;
      }
      return s + (/gate/.test(d.name) ? 2 : 0);
    });
    const mx = Math.max(...sc), top2 = [...sc].sort((a, b) => b - a);
    if (sc.filter(v => v === mx).length === 1 && mx >= top2[1] + 2) A.doors.oneMain++;
    if (sc.every(v => v === sc[0])) A.doors.allSame++;
    A.doors.scoreGap.push(top2[0] - top2[1]);
    const md = outer[sc.indexOf(mx)];
    const longX = x1 - x0 >= z1 - z0;
    A.doors.mainRead++;
    const onLong = longX ? (Math.abs(md.z - z0) < 1.2 || Math.abs(md.z - z1) < 1.2) : (Math.abs(md.x - x0) < 1.2 || Math.abs(md.x - x1) < 1.2);
    if (onLong) A.doors.mainOnLong++;
  }
  return { wall: main[0], roofMat: roofs.length ? Object.entries(roofs.reduce((o, p) => inc(o, roofMat(p.name)), {})).sort((a, b) => b[1] - a[1])[0][0] : null,
    slope: roofs.length ? Object.entries(roofs.reduce((o, p) => inc(o, roofSlope(p.name)), {})).sort((a, b) => b[1] - a[1])[0][0] : null };
}

async function main() {
  const rot = new Map();
  for (const line of fs.readFileSync(buildsFile, 'utf8').split('\n')) { if (!line) continue; const b = JSON.parse(line); rot.set(b.b, b.rot || 0); }
  let bi = -1;
  const t0 = Date.now();
  for await (const line of readline.createInterface({ input: fs.createReadStream(compact) })) {
    if (!line.trim()) continue;
    bi++;
    if (bi >= LIMIT) break;
    const b = JSON.parse(line);
    if (b.p.some(p => !L.isVanilla(p[0]))) continue;
    const a = rot.get(bi) || 0, ca = Math.cos(a * Math.PI / 180), sa = Math.sin(a * Math.PI / 180);
    const ps = b.p.map(([name, x, y, z, yaw]) => { const i = P.piece(name); return { name, x: x * ca - z * sa, y, z: x * sa + z * ca, yaw: yaw - a, role: i.role, h: i.size[1] || 0.2, wm: i.role === 'wall' ? wallMat(name) : null }; });
    for (const p of ps) p.cm = (p.role === 'wall' && p.wm) || /^(roof|roofTop|roofCorner)$/.test(p.role);
    A.builds++;
    const tt = (b.title || '') + ' ' + (b.cat || '');
    const kind = /tavern|inn\b/i.test(tt) ? 'tavern' : /castle|fort|keep/i.test(tt) ? 'castle' : /tower/i.test(tt) ? 'tower' : /temple|church/i.test(tt) ? 'temple' : /longhouse|hall/i.test(tt) ? 'longhouse' : /farm|barn/i.test(tt) ? 'farm' : /house|home|cabin|starter|cottage/i.test(tt) ? 'home' : 'other';
    let bs = [];
    try { bs = clusters(ps); } catch (e) { continue; }
    const recs = [];
    for (const c of bs) { try { const r = building(c, ps, kind); if (r) recs.push(r); } catch (e) { process.stderr.write(`build ${bi}: ${e.message}\n`); } }
    // carved heads on roofs
    const orn = ps.filter(p => ORN.test(p.name));
    if (orn.length) {
      A.orn.builds++; A.orn.pieces += orn.length; inc(A.orn.counts, orn.length >= 6 ? '6+' : String(orn.length));
      const roofTop = Math.max(...ps.filter(p => /^(roof|roofTop)$/.test(p.role)).map(p => p.y), -1e9);
      for (const o of orn) {
        const local = ps.filter(p => /^(roof|roofTop)$/.test(p.role) && Math.hypot(p.x - o.x, p.z - o.z) < 8).map(p => p.y);
        if (local.length && o.y > Math.max(...local) - 2.5) A.orn.high++;
        if (local.length) A.orn.onRoof = (A.orn.onRoof || 0) + 1;
        if (orn.some(q => q !== o && q.name === o.name && Math.abs(q.y - o.y) < 0.3 && (Math.abs(q.x - o.x) < 0.3 || Math.abs(q.z - o.z) < 0.3))) A.orn.paired++;
      }
    }
    if (recs.length >= 3) {
      A.village.builds++; A.village.buildings += recs.length;
      const lead = k => { const c = {}; for (const r of recs) if (r[k]) inc(c, r[k]); const e = Object.entries(c).sort((x, y) => y[1] - x[1])[0]; return e ? [e[0], e[1] / recs.length] : [null, 0]; };
      const [w, ws] = lead('wall'), [m, ms] = lead('roofMat'), [s, ss] = lead('slope');
      A.village.wallLead.push(ws); A.village.roofLead.push(ms); A.village.slopeLead.push(ss);
      A.village.allThree.push(recs.filter(r => r.wall === w && r.roofMat === m && r.slope === s).length / recs.length);
    }
    if (bi % 200 === 0) process.stderr.write(`${bi} builds, ${A.buildings} buildings, ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
  }
  const dist = a => { const c = {}; for (const v of a) inc(c, v >= 4 ? '4+' : String(v)); return c; };
  const symQ = Object.fromEntries(Object.entries(A.sym.byKind).map(([k, v]) => [k, { ...qs(v.map(r3)), formal: sh(v.filter(x => x >= 0.8).length, v.length) }]));
  const res = {
    meta: { made: new Date().toISOString().slice(0, 10), source: 'lab/arch_grammar.js', set: LABEL, builds: A.builds, buildings: A.buildings },
    fields: {
      materials: 'buildings: wall material families holding 10 % or more of the walls (count per building, and the mixes); with heavy (stone, black marble, grausten) and light walls both, the heavy below (mean height 0.3 m lower), above, and where the heavy walls give way to light ones on top of them; with a plinth, whether heavy walls stand at the foot of all four sides',
      roofs: 'twoFamilies: buildings with two slope families of 10 % or more, the minor family 0.5 m or more lower on average, the main family the steeper; buildings with 6 or more roof pieces: one slope family on 90 % of them, one roof material on 90 %, the lead slope and material, slope families with 10 % or more',
      bays: 'lines of 3 or more posts (same wall line, same foot, gaps 6 m or less): gaps all equal within 0.15 m, the gap of even lines; buildings with 75 % of their lines even',
      symmetry: 'share of walls, roofs, posts, doors and windows with a same piece at the mirrored place across the building middle (better axis), per building; formal: 0.8 or more; door on the axis (within 1.1 m) where the score is 0.6 or more',
      ornament: 'carved heads (wood_dragon1, darkwood_raven, darkwood_wolf): builds, pieces, share near a roof (8 m), of those within 2.5 m of the highest roof piece near it, share with a twin (same piece, same height, on one line across)',
      doors: 'buildings with 2 or more outer doors: dressing score per door (posts, beams over, roof over, lights, banners, stairs, a gate); one door clearly richest (2 or more points over the next), all equal; the richest door on a long side',
      village: 'builds with 3 or more buildings: share of buildings holding the lead wall material, the lead roof material, the lead roof slope, and all three',
    },
    materials: { buildings: A.mats.buildings, mainFamilies: dist(A.mats.nMain), mixes: Object.fromEntries(Object.entries(A.mats.mainCombos).sort((a, b) => b[1] - a[1]).slice(0, 15)),
      heavyAndLight: A.mats.two, heavyUnder: sh(A.mats.heavyUnder, A.mats.two), heavyOver: sh(A.mats.heavyOver, A.mats.two), changeAt: A.mats.change,
      plinthAllSides: sh(A.mats.baseAllSides, A.mats.baseSidesRead), plinthSidesRead: A.mats.baseSidesRead },
    roofs: { twoFamilies: A.roofs.two || 0, minorLower: sh(A.roofs.minorLower || 0, A.roofs.two), mainSteeper: sh(A.roofs.mainSteeper || 0, A.roofs.two), buildings: A.roofs.buildings, oneSlope: sh(A.roofs.oneSlope, A.roofs.buildings), oneMaterial: sh(A.roofs.oneMat, A.roofs.buildings), leadSlope: A.roofs.slopes, leadMaterial: A.roofs.mats, slopeFamilies: dist(A.roofs.nSlopes) },
    bays: { lines: A.bays.lines, even: sh(A.bays.even, A.bays.lines), evenGap: Object.fromEntries(Object.entries(A.bays.gaps).sort((a, b) => b[1] - a[1]).slice(0, 8)), buildings: A.bays.buildings, buildingsMostlyEven: sh(A.bays.buildingsEven, A.bays.buildings) },
    symmetry: { buildings: A.sym.buildings, score: qs(A.sym.score.map(r3)), formal: sh(A.sym.score.filter(x => x >= 0.8).length, A.sym.score.length), doorOnAxis: sh(A.sym.doorOnAxis, A.sym.doorRead), doorRead: A.sym.doorRead, byKind: symQ },
    ornament: { builds: A.orn.builds, pieces: A.orn.pieces, perBuild: A.orn.counts, high: sh(A.orn.high, A.orn.onRoof || 0), nearRoof: sh(A.orn.onRoof || 0, A.orn.pieces), twinned: sh(A.orn.paired, A.orn.pieces) },
    doors: { buildings: A.doors.buildings, oneMain: sh(A.doors.oneMain, A.doors.buildings), allEqual: sh(A.doors.allSame, A.doors.buildings), mainOnLongSide: sh(A.doors.mainOnLong, A.doors.mainRead), gap: qs(A.doors.scoreGap) },
    village: { builds: A.village.builds, buildings: A.village.buildings, wallLead: qs(A.village.wallLead.map(r3)), roofLead: qs(A.village.roofLead.map(r3)), slopeLead: qs(A.village.slopeLead.map(r3)), allThree: qs(A.village.allThree.map(r3)) },
  };
  fs.writeFileSync(outFile, JSON.stringify(res, null, 1));
  console.log(outFile, A.builds, 'builds', A.buildings, 'buildings', ((Date.now() - t0) / 1000).toFixed(0), 's');
}
main();
