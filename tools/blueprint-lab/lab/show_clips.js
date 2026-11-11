// Clip depths in what shows for the interior library (round 7b). The lead's rule: collision boxes for what rests on or
// snaps to what, fine shapes for what shows. lib/kitbash.js fit() tests a set's pieces against each other, the anchor and
// the walls with the colliders (a.clips, as mined), and asks lib/decorate.js auditOne how deep a piece goes into what
// shows of the walls round it (lib/mesh.js fine parts). This script gives each library set the depths its source builds
// show in the fine parts (a.show, same form as a.clips), which auditOne then allows.
//   node lab/show_clips.js kitbash [fine.json] [library.json]
//     KB sets: matched with the fine run of lab/mine_kitbash.js (data/kitbash-interior-fine.json, VH_SHAPES=fine) by
//     anchor, prefabs and spots within 0.35 m (mirrored too), as the miners match; a set with no match keeps a.clips.
//   node lab/show_clips.js creative <mined-fine.json> [creative-mined.json]
//     curated picks (data/creative-mined.json): matched with a full lab/mine_creative.js run (VH_SHAPES=fine, which
//     groups by the colliders and writes both clips and show); a pick with no match is left out (it no longer reads as
//     one object). Writes the picks with c (collider clips) and cs (what shows) from the run, and prints which survive.
const fs = require('fs'), path = require('path');
const DATA = path.join(__dirname, '../data');

// the members' match: for each piece of A the nearest unused piece of B of the same prefab (within 0.7 m); mean distance
function match(A, B, mirror) {
  const used = new Set(), map = [];
  let sum = 0;
  for (const a of A) {
    let best = null, bd = Infinity;
    B.forEach((b, j) => { if (used.has(j) || b.n !== a.n) return; const d = Math.hypot(a.x - (mirror ? -b.x : b.x), a.y - b.y, a.z - b.z); if (d < bd) { bd = d; best = j; } });
    if (best == null || bd > 0.7) return null;
    used.add(best); map.push(best); sum += bd;
  }
  return { d: sum / A.length, map };
}
const best = (A, cands, get) => {
  let r = null;
  for (const c of cands) for (const mir of [false, true]) { const m = match(A, get(c), mir); if (m && m.d <= 0.35 && (!r || m.d < r.d)) r = { ...m, c, mir }; }
  return r;
};
// clips of B in A's piece order: [u, v | 'a' | 'w', depth]
function remap(clips, map) {
  const inv = new Map(map.map((j, i) => [j, i]));
  const out = [];
  for (const [u, v, d] of clips || []) {
    if (!inv.has(u) || (typeof v === 'number' && !inv.has(v))) continue;
    out.push([inv.get(u), typeof v === 'number' ? inv.get(v) : v, d]);
  }
  return out;
}

const mode = process.argv[2];
if (mode === 'kitbash') {
  const fineF = process.argv[3] || path.join(DATA, 'kitbash-interior-fine.json'), libF = process.argv[4] || path.join(DATA, 'kitbash-interior.json');
  const fine = JSON.parse(fs.readFileSync(fineF, 'utf8')), lib = JSON.parse(fs.readFileSync(libF, 'utf8'));
  const sig = a => `${a.anchor}|${a.angle || ''}|${a.of || ''}|${a.pieces.map(m => m.n).sort().join(',')}`;
  const by = new Map();
  for (const a of fine.assemblies) { const k = sig(a); if (!by.has(k)) by.set(k, []); by.get(k).push(a); }
  let n = 0, hit = 0, wC = [], wS = [];
  for (const a of lib.assemblies) {
    if (a.creative) continue;
    n++;
    delete a.show;
    const m = best(a.pieces, by.get(sig(a)) || [], c => c.pieces);
    if (!m) continue;
    hit++;
    a.show = remap(m.c.clips, m.map);
    for (const c of a.clips) if (c[1] === 'w') wC.push(c[2]);
    for (const c of a.show) if (c[1] === 'w') wS.push(c[2]);
  }
  const q = (v, p) => { const s = v.slice().sort((x, y) => x - y); return s.length ? +(s[Math.min(s.length - 1, Math.floor(p * s.length))] * 100).toFixed(1) : null; };
  lib.showClips = { about: 'a.show: clip depths in what shows (lib/mesh.js fine parts) from the fine run of lab/mine_kitbash.js (data/kitbash-interior-fine.json), matched by lab/show_clips.js; sets with no match keep a.clips for what shows too.', sets: n, matched: hit };
  fs.writeFileSync(libF, JSON.stringify(lib, null, 0).replace(/\{"id"/g, '\n{"id"').replace(/\{"n":"([^"]+)","role"/g, '\n{"n":"$1","role"'));
  console.log(`KB sets ${n}, matched ${hit}; wall clips of the matched sets, colliders 50th/90th ${q(wC, 0.5)}/${q(wC, 0.9)} cm (${wC.length}), what shows ${q(wS, 0.5)}/${q(wS, 0.9)} cm (${wS.length})`);
} else if (mode === 'creative') {
  const runF = process.argv[3], curF = process.argv[4] || path.join(DATA, 'creative-mined.json');
  const run = JSON.parse(fs.readFileSync(runF, 'utf8')), cur = JSON.parse(fs.readFileSync(curF, 'utf8'));
  const sig = (a, of, ang, ns) => `${a}|${a === 'corner' ? [90, 120, 135].find(t => Math.abs(ang - t) <= 8) || 'x' : ''}|${of || ''}|${ns.slice().sort().join(',')}`;
  const by = new Map();
  for (const o of run.objects) { const k = sig(o.anchor, o.of, o.angle, o.members.map(m => m.n)); if (!by.has(k)) by.set(k, []); by.get(k).push(o); }
  const kept = [], gone = [];
  for (const o of cur.objects) {
    const ms = o.m.map(([n, x, y, z]) => ({ n, x, y, z }));
    const m = best(ms, by.get(sig(o.a, o.of, o.ang, ms.map(q => q.n))) || [], c => c.members);
    if (!m) { gone.push(o); continue; }
    // the pick as the run's object has it (members, clips and what shows all from the same instance, mirrored back where
    // it matched mirrored), in the pick's own member order
    const inv = new Map(m.map.map((j, i) => [j, i]));
    const mm = m.map.map(j => { const q = m.c.members[j]; return [q.n, m.mir ? -q.x : q.x, q.y, q.z, m.mir ? (360 - q.yaw) % 360 : q.yaw, q.rest, q.on != null ? inv.get(q.on) : null, q.sink || null]; });
    // WHOLE=1 takes the pick as the run's object has it; by default the pick keeps its own members and colliders' clips
    // (the pair it was judged on) and takes only cs from the run
    kept.push(process.env.WHOLE ? { ...o, m: mm, c: remap(m.c.clips, m.map), cs: remap(m.c.show || m.c.clips, m.map), f: m.c.foot, h: m.c.h, b: m.c.builds, l: m.c.liked }
      : { ...o, cs: remap(m.c.show || m.c.clips, m.map) });
  }
  const out = { ...cur, about: cur.about + ' cs: the same clips in what shows (lib/mesh.js fine parts; VH_SHAPES=fine run, contact by the colliders, lab/show_clips.js).',
    minedFine: { builds: run.builds, liked: run.liked, found: run.found, distinct: run.objects.length }, objects: kept };
  fs.writeFileSync(curF, JSON.stringify(out));
  console.log(`curated picks ${cur.objects.length}: ${kept.length} found again, ${gone.length} not (picks ${gone.map(o => o.pick).join(', ')})`);
} else console.log('usage: node lab/show_clips.js kitbash|creative ...');
