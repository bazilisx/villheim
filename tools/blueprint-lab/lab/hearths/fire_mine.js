// Fires, smoke outlets and lights in the corpus: where the fire stands in its room, how the smoke gets out, what
// surrounds it, and how lights are used per room kind. Usage: node fire_mine.js <lib dir> <out.json> <dir>...
// Reads every .blueprint under each dir (skips hs_ files and anything under a BiomeBlueprints or OverDrive path).
const fs = require('fs'), path = require('path');
const LIB = path.resolve(process.argv[2]);
const P = require(path.join(LIB, 'pieces.js')), Ck = require(path.join(LIB, 'checks.js')), BP = require(path.join(LIB, 'blueprint.js'));
const OUT = process.argv[3];
const dirs = process.argv.slice(4);
const MODELS = require(path.join(LIB, '../data/piece-models.json'));
const KNOWN = new Set(Object.keys(MODELS.pieces || MODELS));
const MOD = /^(kg_|GB_|CastleKit_|MB|mm_|BBH|rk_|Piece_vf|OdinsKingdom|h_|\$|Hayze|rae_|teq_|tkd_|rkc_)/;
const FIRE = /^(hearth|fire_pit|fire_pit_iron|fire_pit_hildir|bonfire|piece_oven)$/;
const LIGHT = {
  wall: /^(piece_walltorch|piece_dvergr_lantern|CastleKit_metal_walltorch|piece_hoodedlantern_wall)$/,
  hang: /^(piece_brazierceiling01|dvergrprops_lantern|piece_FairylightGarland|piece_chandelier.*)$/,
  floor: /^(piece_groundtorch.*|piece_brazierfloor0[12]|deepnorth_lantern_standing|piece_dvergr_lantern_pole|MountainKit_brazier.*|CastleKit_groundtorch.*|CastleKit_brazier|piece_jackoturnip)$/,
  small: /^(Candle_resin.*|piece_Lavalantern|piece_hoodedlantern|dvergrprops_lantern_standing)$/,
};
const lightKind = n => Object.keys(LIGHT).find(k => LIGHT[k].test(n)) || null;
const SEAT = /bench|chair|stool|throne/i, TABLE = /^(piece_table.*|piece_blackmarble_table|dvergrprops_table|mountainkit_table)$/, BED = /^(bed|piece_bed02|ashwood_bed|dvergrprops_bed)$/;
const COOK = /cookingstation|cauldron|piece_oven/;
const STONE = /stone|marble|grausten|Ashlands/i;

function yawOf(q) { if (!q) return 0; const [x, y, z, w] = q; return ((Math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + x * x)) * 180 / Math.PI) % 360 + 360) % 360; }
const norm = a => ((a % 360) + 360) % 360;

function kindOf(rel, title) {
  const t = `${rel} ${title}`.toLowerCase();
  if (/tavern|\binn\b|pub|mead ?hall|alehouse|brewery/.test(t)) return 'tavern';
  if (/longhouse|long house|great ?hall|\bhall\b|jarl|chieftain|throne/.test(t)) return 'hall';
  if (/temple|church|shrine|chapel/.test(t)) return 'temple';
  if (/smith|forge|workshop|crafting/.test(t)) return 'work';
  if (/castle|fort|keep|tower/.test(t)) return 'castle';
  if (/village|town|city|settlement/.test(t)) return 'village';
  if (/starter|house|home|cabin|cottage|hut|hovel|lodge|farmhouse|dwelling|homestead|croft|shack|bungalow|interior/.test(t)) return 'home';
  return 'other';
}

function files(d) {
  const out = [];
  const walk = p => { for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    const f = path.join(p, e.name);
    if (/biomeblueprint|overdrive/i.test(f)) continue;
    if (e.isDirectory()) { if (!/^_/.test(e.name)) walk(f); } else if (/\.blueprint$/i.test(e.name) && !/^hs_/i.test(e.name)) out.push(f);
  } };
  walk(d); return out;
}

const fires = [], lights = [], builds = [];
const seen = new Set();
let nRead = 0;
for (const d of dirs) for (const f of files(d)) {
  let text; try { text = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  const bp = BP.parse(text);
  if (bp.pieces.length < 20) continue;
  const sig = bp.pieces.length + '|' + bp.pieces.slice(0, 30).map(p => p.name + p.x.toFixed(1)).join(',');
  if (seen.has(sig)) continue; seen.add(sig);
  const unknown = bp.pieces.filter(p => MOD.test(p.name) || !KNOWN.has(p.name)).length;
  if (unknown / bp.pieces.length > 0.05) continue;
  nRead++;
  const rel = path.relative(d, f), title = bp.meta.Name || path.basename(f);
  const kind = kindOf(rel, title);
  try { mine(bp, { file: rel, title, kind, src: path.basename(d) }); } catch (e) { console.error('fail', rel, e.message); }
  if (nRead % 100 === 0) console.error(nRead, 'builds', fires.length, 'fires', lights.length, 'lights');
}

function mine(bp, meta) {
  // turn the build so its walls run along x and z
  const raw = bp.pieces.filter(p => !MOD.test(p.name) && KNOWN.has(p.name));
  const ys = raw.map(p => yawOf(p.q));
  const hist = new Map();
  raw.forEach((p, i) => { if (P.piece(p.name).role === 'wall') { const k = Math.round(norm(ys[i]) % 90 / 5) * 5 % 90; hist.set(k, (hist.get(k) || 0) + 1); } });
  const turn = [...hist.entries()].sort((a, b) => b[1] - a[1])[0];
  const T = turn ? turn[0] : 0, a = -T * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const ps = raw.map((p, i) => ({ name: p.name, x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c, yaw: norm(ys[i] - T), q: p.q }));
  const bx = ps.map(p => Ck.catBox(p));
  const near = Ck.index(bx);
  const role = j => bx[j].info.role;
  const around = (x, z, r, y0, y1) => [...near({ x0: x - r, x1: x + r, z0: z - r, z1: z + r }, 0)].filter(j => bx[j].y1 > y0 && bx[j].y0 < y1);
  const covers = (j, x, z, e = 0) => bx[j].x0 - e <= x && bx[j].x1 + e >= x && bx[j].z0 - e <= z && bx[j].z1 + e >= z;
  const isWall = j => ['wall', 'window', 'door'].includes(role(j)) && bx[j].y1 - bx[j].y0 > 0.45 && !/fence|rail/.test(ps[j].name);
  const floorTop = (x, z, y) => { let t = null; for (const j of around(x, z, 0.05, y - 4, y + 0.6)) if (role(j) === 'floor' && covers(j, x, z) && bx[j].y1 <= y + 0.5 && (t == null || bx[j].y1 > t)) t = bx[j].y1; return t; };
  const OVER = new Set(['roof', 'roofTop', 'roofCorner', 'floor', 'gable']);
  // the lowest piece over a point above height y (null: open to the sky)
  const over = (x, z, y) => { let lo = null; for (const j of around(x, z, 0.05, y, y + 30)) if (OVER.has(role(j)) && covers(j, x, z, -0.05) && bx[j].y0 > y && (lo == null || bx[j].y0 < bx[lo].y0)) lo = j; return lo; };
  const wallAt = (x, z, y) => around(x, z, 0.01, y - 0.01, y + 0.01).some(j => isWall(j) && covers(j, x, z));
  const ray = (x, z, y, dx, dz, max = 16, hs = [-0.7, 0, 0.7]) => { for (let t = 0; t <= max; t += 0.1) if (hs.some(h => wallAt(x + dx * t, z + dz * t, y + h))) return t; return null; };
  const roofed = (x, z, y) => over(x, z, y + 1.5) != null;
  const doors = [], beds = [], tables = [], windows = [];
  ps.forEach((p, j) => { const r = role(j); if (r === 'door') doors.push(j); else if (r === 'window' || /window/.test(p.name)) windows.push(j); if (BED.test(p.name)) beds.push(j); if (TABLE.test(p.name)) tables.push(j); });
  const cx = j => (bx[j].x0 + bx[j].x1) / 2, cz = j => (bx[j].z0 + bx[j].z1) / 2;
  const nearest = (list, x, z, y) => Math.min(99, ...list.filter(j => Math.abs(bx[j].y0 - y) < 2.5).map(j => Math.hypot(Math.max(bx[j].x0 - x, 0, x - bx[j].x1), Math.max(bx[j].z0 - z, 0, z - bx[j].z1))));
  // covered floor (m2) per build: roofed floor tops
  let area = 0;
  ps.forEach((p, j) => { if (role(j) !== 'floor' || bx[j].y1 - bx[j].y0 > 1.2) return; const A = (bx[j].x1 - bx[j].x0) * (bx[j].z1 - bx[j].z0); if (A > 20) return; if (roofed(cx(j), cz(j), bx[j].y1)) area += A; });
  const b = { file: meta.file, kind: meta.kind, n: ps.length, area: +area.toFixed(1), fires: 0, lights: { wall: 0, hang: 0, floor: 0, small: 0 }, src: meta.src };
  builds.push(b);
  const roomOf = (x, z, y, hs) => {
    const dirs = [];
    for (let k = 0; k < 16; k++) { const t = k * Math.PI / 8; dirs.push(ray(x, z, y, Math.cos(t), Math.sin(t), 16, hs)); }
    const hit = dirs.filter(v => v != null).length;
    let A = 0;
    for (let k = 0; k < 16; k++) { const r1 = dirs[k] == null ? 16 : dirs[k], r2 = dirs[(k + 1) % 16] == null ? 16 : dirs[(k + 1) % 16]; A += 0.5 * r1 * r2 * Math.sin(Math.PI / 8); }
    return { hit, A, card: [dirs[0], dirs[4], dirs[8], dirs[12]] }; // +x, +z, -x, -z
  };
  ps.forEach((p, i) => {
    if (FIRE.test(p.name)) {
      b.fires++;
      const x = cx(i), z = cz(i), ft0 = floorTop(x, z, bx[i].y0 + 0.05), ft = ft0 == null ? bx[i].y0 : ft0;
      const y = ft + 1.0, R = roomOf(x, z, y, [-0.6, -0.1]);
      const hw = (bx[i].x1 - bx[i].x0) / 2, hd = (bx[i].z1 - bx[i].z0) / 2;
      const gaps = R.card.map((d, k) => (d == null ? null : +(d - (k % 2 ? hd : hw)).toFixed(2)));
      const lo = over(x, z, bx[i].y1 + 0.3);
      const indoor = R.hit >= 12 && lo != null || (R.hit >= 13);
      const close = gaps.map(g => g != null && g < 0.8);
      const nClose = close.filter(Boolean).length;
      const inWall = gaps.some(g => g != null && g < -0.25) || around(x, z, 0.3, ft + 0.3, ft + 0.95).some(j => isWall(j) && j !== i && covers(j, x, z, -0.2));
      const overhead = around(x, z, 0.3, ft + 1.3, ft + 3.2).filter(j => j !== i && ['wall', 'pole', 'beam', 'roof', 'roofCorner', 'gable', 'floor'].includes(role(j)) && covers(j, x, z, -0.1) && bx[j].y0 > ft + 1.2).map(j => STONE.test(ps[j].name) ? 'stone' : 'wood')[0] || null;
      // the room the fire serves: rays from 2.5 m in front of it, toward its open side
      const kOpen = [0, 1, 2, 3].sort((a, c) => (R.card[c] ?? 99) - (R.card[a] ?? 99))[0], dO = [[1, 0], [0, 1], [-1, 0], [0, -1]][kOpen];
      const reach = Math.min(2.5, (R.card[kOpen] ?? 16) - 0.3);
      const RF = roomOf(x + dO[0] * reach, z + dO[1] * reach, y, [-0.6, -0.1]);
      let place = inWall ? 'in-wall' : nClose >= 3 ? 'alcove' : nClose === 2 ? (close[0] && close[2] || close[1] && close[3] ? 'alcove' : 'corner') : nClose === 1 ? 'wall' : 'middle';
      // relative offset from the room's middle on each axis
      const rel = [0, 1].map(k => { const A = R.card[k], B = R.card[k + 2]; return A == null || B == null ? null : +(Math.abs(A - B) / (A + B)).toFixed(2); });
      if (place === 'middle' && gaps.some(g => g != null && g < 1.5)) place = 'near-wall';
      // the smoke: what is over the fire
      let vent;
      if (lo == null) {
        const roofAround = around(x, z, 5, ft + 2, ft + 20).some(j => ['roof', 'roofTop', 'roofCorner'].includes(role(j)));
        // a shaft: walls round the open column above head height
        const shaft = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => { const t = ray(x, z, ft + 4, dx, dz, 2.2, [0]); return t != null; }).length;
        vent = shaft >= 3 ? 'open shaft' : roofAround ? 'roof hole' : 'open sky';
      } else {
        const h = +(bx[lo].y0 - ft).toFixed(1);
        // a chimney beside: a column of stone or walls rising past the roof within 3 m of the fire
        const roofTopY = Math.max(...around(x, z, 4, ft, ft + 30).filter(j => ['roof', 'roofTop'].includes(role(j))).map(j => bx[j].y1), ft + 3);
        const stack = around(x, z, 3, roofTopY - 0.5, roofTopY + 6).some(j => (isWall(j) || role(j) === 'pole') && STONE.test(ps[j].name) && bx[j].y1 > roofTopY + 0.3);
        // the nearest open column within 4 m (a gap in the roof)
        let gap = null;
        for (let r = 0.5; r <= 4 && gap == null; r += 0.5) for (let k = 0; k < 8; k++) { const t = k * Math.PI / 4, gx = x + Math.cos(t) * r, gz = z + Math.sin(t) * r; if (over(gx, gz, ft + 2) == null) { gap = r; break; } }
        const hood = h <= 3.2 && around(x, z, 1.2, ft + 1.4, ft + 3.2).some(j => ['roof', 'roofCorner', 'gable', 'wall'].includes(role(j)) && bx[j].y0 > ft + 1.3);
        vent = stack ? 'chimney stack' : gap != null ? `gap ${gap} m` : 'closed';
        if (hood) vent += ' +hood';
        vent = { kind: vent, h };
      }
      const ring = around(x, z, Math.max(hw, hd) + 1.5, ft - 1.2, ft + 3.5).filter(j => j !== i);
      const stone = ring.filter(j => STONE.test(ps[j].name) && ['wall', 'pole', 'floor'].includes(role(j))).length;
      const under = around(x, z, 0.2, ft - 1.2, ft + 0.05).filter(j => role(j) === 'floor' && covers(j, x, z)).map(j => ps[j].name)[0] || null;
      const mantel = ring.some(j => role(j) === 'beam' && bx[j].y0 > ft + 1.2 && bx[j].y1 < ft + 3.2);
      const cook = ring.filter(j => COOK.test(ps[j].name)).map(j => ps[j].name);
      const wood = around(x, z, 3.5, ft - 0.3, ft + 2).filter(j => /wood_stack|_stack$|woodpile|log_stack/i.test(ps[j].name)).length;
      const seats = around(x, z, 4, ft - 0.3, ft + 1).filter(j => SEAT.test(ps[j].name)).length;
      const fireLights = around(x, z, 4, ft - 0.5, ft + 5).filter(j => lightKind(ps[j].name)).length;
      // what hangs over the fire (a hood or a mantel): pieces within 1.2 m of it, 1.3 to 3.4 m over its floor, each
      // as [name, role, back (toward the wall behind, m), side (m), bottom and top over the floor (m), the deepest overlap
      // with a wall piece of another material or turn (m, a clip into the wall)]
      const hoodAt = around(x, z, 1.2, ft + 1.3, ft + 3.4).filter(j => j !== i && ['wall', 'roof', 'roofCorner', 'gable', 'beam', 'floor', 'pole'].includes(role(j)) && bx[j].y0 > ft + 1.25);
      const clipOf = j => { let d = 0; for (const k of around(cx(j), cz(j), 2.5, bx[j].y0, bx[j].y1)) { if (k === j || !isWall(k)) continue; const a = bx[j], c = bx[k];
        const o = Math.min(a.x1, c.x1) - Math.max(a.x0, c.x0), oz = Math.min(a.z1, c.z1) - Math.max(a.z0, c.z0), oy = Math.min(a.y1, c.y1) - Math.max(a.y0, c.y0);
        if (o > 0 && oz > 0 && oy > 0) d = Math.max(d, Math.min(o, oz)); } return +d.toFixed(2); };
      const hood = hoodAt.slice(0, 14).map(j => { const ex = cx(j) - x, ez = cz(j) - z; return [ps[j].name, role(j), +(-(ex * dO[0] + ez * dO[1])).toFixed(2), +(ex * dO[1] - ez * dO[0]).toFixed(2), +(bx[j].y0 - ft).toFixed(2), +(bx[j].y1 - ft).toFixed(2), STONE.test(ps[j].name) ? clipOf(j) : 0]; });
      fires.push({ file: meta.file, kind: meta.kind, name: p.name, indoor, place, gaps, rel, room: +R.A.toFixed(1), roomF: +RF.A.toFixed(1), overhead, hit: R.hit, vent, raised: +(bx[i].y0 - ft).toFixed(2),
        under, stone, mantel, cook, wood, seats, fireLights, door: +nearest(doors, x, z, ft).toFixed(1), hood, backD: R.card[(kOpen + 2) % 4] == null ? null : +R.card[(kOpen + 2) % 4].toFixed(2) });
    }
    const lk = lightKind(p.name);
    if (lk) {
      const x = cx(i), z = cz(i), ft0 = floorTop(x, z, bx[i].y0 + 0.05);
      if (ft0 == null && lk !== 'hang' && lk !== 'wall') return;
      const ft = ft0 == null ? (floorTop(x, z, bx[i].y0 - 1.5) ?? bx[i].y0 - 2.5) : ft0;
      if (!roofed(x, z, Math.max(ft, bx[i].y1 - 1.4))) return;
      b.lights[lk]++;
      const onTable = tables.some(t => covers(t, x, z, 0.05) && bx[i].y0 >= bx[t].y1 - 0.25 && bx[i].y0 < bx[t].y1 + 0.4);
      const sill = windows.some(w => Math.hypot(cx(w) - x, cz(w) - z) < 1.2 && Math.abs(bx[w].y0 - bx[i].y0) < 0.4);
      lights.push({ file: meta.file, kind: meta.kind, name: p.name, lk, h: +(bx[i].y0 - ft).toFixed(2), x: +x.toFixed(2), z: +z.toFixed(2), ft: +ft.toFixed(2),
        door: +nearest(doors, x, z, ft).toFixed(1), bed: +nearest(beds, x, z, ft).toFixed(1), table: +nearest(tables, x, z, ft).toFixed(1), onTable, sill,
        fire: +Math.min(99, ...ps.map((q, j) => (FIRE.test(q.name) && Math.abs(bx[j].y0 - ft) < 1 ? Math.hypot(cx(j) - x, cz(j) - z) : 99))).toFixed(1) });
    }
  });
}

fs.writeFileSync(OUT, JSON.stringify({ builds, fires, lights }));
console.error('done', nRead, 'builds', fires.length, 'fires', lights.length, 'lights');
