// Measure the Millenaire translation: share of blocks translated, unmapped blocks, lib/checks.js results, and
// footprint and height against the original, per design and per culture.
// Usage: node lab/mc_eval.js <converted dir (culture folders)> <out json>
// Study use only; reads the converted designs under /home/claude/corpus/mc, writes nothing into the repo.
const fs = require('fs');
const path = require('path');
const BP = require('../lib/blueprint.js');
const C = require('../lib/checks.js');
const PC = require('../lib/pieces.js');
require('./mc_pieces_fix.js').apply();

const [dir, out] = process.argv.slice(2);

// Support as lib/checks.js walks it, with one change: a piece also stands when its bottom is on the Minecraft terrain
// under it (the converter drops terrain blocks and records their top per column). In Valheim the ground holds those.
function terrainSupport(bp, terrain) {
  const boxes = bp.pieces.map(p => C.aabb(p));
  const tmap = new Map(terrain.map(([x, z, t]) => [`${Math.floor(x)}|${Math.floor(z)}`, t]));
  const groundAt = b => {
    let t = -Infinity;
    for (let x = Math.floor(b.x0); x <= Math.floor(b.x1 - 1e-6); x++) for (let z = Math.floor(b.z0); z <= Math.floor(b.z1 - 1e-6); z++) {
      const v = tmap.get(`${x}|${z}`); if (v != null) t = Math.max(t, v);
    }
    return t;
  };
  const ys = boxes.filter(b => b.info.structural).map(b => b.y0).sort((a, b) => a - b);
  const ground = ys.length ? ys[Math.floor(ys.length * 0.02)] : 0;
  const held = boxes.map(b => b.y0 <= ground + 0.35 || b.y0 <= groundAt(b) + 0.35);
  const queue = []; held.forEach((h, i) => h && queue.push(i));
  const touch = (a, b, e) => a.x0 <= b.x1 + e && b.x0 <= a.x1 + e && a.y0 <= b.y1 + e && b.y0 <= a.y1 + e && a.z0 <= b.z1 + e && b.z0 <= a.z1 + e;
  // grid for neighbours
  const g = new Map(); const key = (i, j) => i * 100003 + j;
  boxes.forEach((b, n) => { for (let i = Math.floor(b.x0 / 2); i <= Math.floor(b.x1 / 2); i++) for (let j = Math.floor(b.z0 / 2); j <= Math.floor(b.z1 / 2); j++) { const k = key(i, j); if (!g.has(k)) g.set(k, []); g.get(k).push(n); } });
  while (queue.length) {
    const i = queue.pop(), b = boxes[i];
    for (let a = Math.floor(b.x0 / 2) - 1; a <= Math.floor(b.x1 / 2) + 1; a++) for (let c = Math.floor(b.z0 / 2) - 1; c <= Math.floor(b.z1 / 2) + 1; c++) for (const j of g.get(key(a, c)) || []) {
      if (held[j]) continue;
      const o = boxes[j];
      if (touch(b, o, 0.16) && (b.info.structural || ['craft', 'deco', 'light'].includes(o.info.role))) { held[j] = true; queue.push(j); }
    }
  }
  const bad = bp.pieces.filter((p, i) => !held[i] && (boxes[i].info.structural || ['craft', 'storage', 'bed', 'table', 'seat', 'fire'].includes(boxes[i].info.role)));
  return { ok: bad.length === 0, n: bad.length, names: bad.map(p => p.name) };
}
const rows = [];
for (const culture of fs.readdirSync(dir).sort()) {
  const cdir = path.join(dir, culture);
  if (!fs.statSync(cdir).isDirectory()) continue;
  for (const f of fs.readdirSync(cdir).filter(f => f.endsWith('.blueprint')).sort()) {
    const base = path.join(cdir, f.slice(0, -10));
    const bp = BP.parse(fs.readFileSync(base + '.blueprint', 'utf8'));
    const st = JSON.parse(fs.readFileSync(base + '.stats.json', 'utf8'));
    const s = st.stats;
    const res = C.check(bp, null);
    const by = Object.fromEntries(res.map(r => [r.check, r]));
    const boxes = bp.pieces.map(p => C.aabb(p)).filter(b => b.info.structural);
    const ext = k => boxes.length ? Math.max(...boxes.map(b => b[k + '1'])) - Math.min(...boxes.map(b => b[k + '0'])) : 0;
    const top = boxes.length ? Math.max(...boxes.map(b => b.y1)) : 0;
    const order = PC.BIOME_ORDER;
    let biome = 0;
    for (const p of bp.pieces) if (PC.piece(p.name).structural) biome = Math.max(biome, order.indexOf(PC.needs(p.name)));
    const build = st.blocks_build || 1;
    const translated = (s.translated || 0) + (s.hidden || 0);
    const unsupported = /^(\d+) pieces not/.exec(by.support.detail);
    const ts = terrainSupport(bp, st.terrain || []);
    const m = /(\d+) doubled, (\d+) pieces inside/.exec(by.overlap.detail);
    const dm = /(\d+) doors, (\d+) sides blocked/.exec(by.doors.detail);
    rows.push({
      culture, id: st.meta.id, variant: st.meta.variant, level: st.meta.level, category: st.meta.category,
      sub: st.meta.sub_building, pieces: bp.pieces.length, build, translated,
      share: +(translated / build).toFixed(4), lost: s.left || 0, unmapped: s.unmapped || 0,
      unmapped_names: st.unmapped, roof_pieces: (s.roof_pieces || 0) + (s.roof26_pieces || 0),
      roof_overhang_m2: s.roof_overhang_m2 || 0, open_edges: s.open_edges || 0, window_cells: s.window_cells || 0,
      support: by.support.ok, unsupported: unsupported ? +unsupported[1] : 0, tsupport: ts.ok, tunsupported: ts.n,
      tunsupported_names: ts.names.reduce((a, n) => (a[n] = (a[n] || 0) + 1, a), {}), overlap: by.overlap.ok,
      doubled: m ? +m[1] : 0, crushed: m ? +m[2] : 0, doors_ok: by.doors.ok, doors: dm ? +dm[1] : 0,
      doors_blocked: dm ? +dm[2] : 0, space: by.space.ok, space_detail: by.space.detail,
      orig: st.size, vh: { w: +ext('x').toFixed(1), d: +ext('z').toFixed(1), h: +top.toFixed(1) },
      biome: order[biome], rooms: (st.rooms || []).map(r => r.use),
    });
  }
}

function med(a) { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; }
function mean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }
const summary = {};
// Sub-buildings (an inn room, a tower top) are changes laid over a parent building and do not stand alone, so the
// summary is over whole buildings; their rows stay in the file.
for (const culture of [...new Set(rows.map(r => r.culture))]) {
  const rs = rows.filter(r => r.culture === culture && !r.sub);
  const un = {};
  for (const r of rs) for (const [k, v] of Object.entries(r.unmapped_names || {})) un[k] = (un[k] || 0) + v;
  const dw = rs.map(r => Math.abs(r.vh.w - r.orig.w));
  summary[culture] = {
    n: rs.length, n_sub: rows.filter(r => r.culture === culture && r.sub).length, share_median: +med(rs.map(r => r.share)).toFixed(3), share_mean: +mean(rs.map(r => r.share)).toFixed(3),
    share_p10: +rs.map(r => r.share).sort((a, b) => a - b)[Math.floor(rs.length * 0.1)].toFixed(3),
    lost_share: +(rs.reduce((a, r) => a + r.lost, 0) / rs.reduce((a, r) => a + r.build, 0)).toFixed(4),
    unmapped: un,
    support_ok: +mean(rs.map(r => r.support ? 1 : 0)).toFixed(3),
    unsupported_share: +(rs.reduce((a, r) => a + r.unsupported, 0) / rs.reduce((a, r) => a + r.pieces, 0)).toFixed(4),
    tsupport_ok: +mean(rs.map(r => r.tsupport ? 1 : 0)).toFixed(3),
    tunsupported_share: +(rs.reduce((a, r) => a + r.tunsupported, 0) / rs.reduce((a, r) => a + r.pieces, 0)).toFixed(4),
    tunsupported_top: Object.entries(rs.reduce((a, r) => { for (const [k, v] of Object.entries(r.tunsupported_names)) a[k] = (a[k] || 0) + v; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8),
    overlap_ok: +mean(rs.map(r => r.overlap ? 1 : 0)).toFixed(3),
    doors_ok: +mean(rs.filter(r => r.doors).map(r => r.doors_ok ? 1 : 0)).toFixed(3),
    space_ok: +mean(rs.map(r => r.space ? 1 : 0)).toFixed(3),
    all_ok: +mean(rs.map(r => r.support && r.overlap && r.doors_ok && r.space ? 1 : 0)).toFixed(3),
    all_ok_terrain: +mean(rs.map(r => r.tsupport && r.overlap && r.doors_ok && r.space ? 1 : 0)).toFixed(3),
    dw_median: med(rs.map(r => +(r.vh.w - r.orig.w).toFixed(1))), dd_median: med(rs.map(r => +(r.vh.d - r.orig.d).toFixed(1))),
    dh_median: med(rs.map(r => +(r.vh.h - r.orig.h_above_ground).toFixed(1))),
    dw_abs_mean: +mean(dw).toFixed(2),
    size_within_1m: +mean(rs.map(r => Math.abs(r.vh.w - r.orig.w) <= 1.01 && Math.abs(r.vh.d - r.orig.d) <= 1.01 ? 1 : 0)).toFixed(3),
    height_within_1m: +mean(rs.map(r => Math.abs(r.vh.h - r.orig.h_above_ground) <= 1.01 ? 1 : 0)).toFixed(3),
    pieces_median: med(rs.map(r => r.pieces)), pieces_per_100_blocks: +(100 * rs.reduce((a, r) => a + r.pieces, 0) / rs.reduce((a, r) => a + r.build, 0)).toFixed(1),
    categories: rs.reduce((a, r) => (a[r.category] = (a[r.category] || 0) + 1, a), {}),
    biomes: rs.reduce((a, r) => (a[r.biome] = (a[r.biome] || 0) + 1, a), {}),
  };
}
fs.writeFileSync(out, JSON.stringify({ summary, rows }, null, 1));
for (const [c, s] of Object.entries(summary)) {
  console.log(c, JSON.stringify({ ...s, unmapped: Object.keys(s.unmapped).length, categories: undefined }));
}
