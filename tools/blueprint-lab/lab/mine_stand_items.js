// What corpus builders put on item stands and armor stands, read for meaning (showcase review, track G, 2026-11-12):
// which item, how the stand is turned (an axe lying on a flat stand or standing on its head), what use piece it is
// near (cauldron, forge, workbench, bed, table, fermenter, mage table), how often one item comes again in one build and
// how many of the same item stand side by side. Armor stands: the gear on each (PlanBuild saves it in the info field
// as "0:7:<item>:<variant>:..." for seven slots: chest, legs, helmet, left hand, right hand, cape, utility).
//   node --max-old-space-size=3000 lab/mine_stand_items.js <folder of .blueprint> [out.json]
// The folder is read one build at a time (index.json beside the builds gives title, maker, downloads, votes).
// Output: data/stand-items/corpus.json (counts only; no blueprint content).
const fs = require('fs'), path = require('path');
const BP = require('../lib/blueprint.js'), Ck = require('../lib/checks.js');

const dir = process.argv[2] || '/work/bp', out = process.argv[3] || '/tmp/assemblies-work/stand-items.json';
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) { if (!/^_/.test(e.name)) walk(path.join(d, e.name)); } else if (/\.blueprint$/.test(e.name) && !/^hs_|biomeblueprint|overdrive/i.test(e.name)) files.push(path.join(d, e.name)); } })(dir);
const idxF = path.join(dir, 'index.json');
const index = fs.existsSync(idxF) ? new Map(JSON.parse(fs.readFileSync(idxF, 'utf8')).map(r => [r.slug, r])) : new Map();
const MOD = /^(kg_|GB_|CastleKit|MB|mm_|BBH|rk_|Piece_vf|OdinsKingdom|h_|\$|Hayze|rae_|teq_|tkd_|rkc_)/;

// ---------------------------------------------------------------- item kinds (finer than lab/mine_stands.js)
// item kinds: lib/standitems.js kindOf (the same rules the picker and the audit use)
const { kindOf } = require('../lib/standitems.js');

// ---------------------------------------------------------------- use pieces round a stand (what the room is for)
const USE = [
  ['kitchen', /^(piece_cauldron|piece_cookingstation|piece_cookingstation_iron|piece_oven|cauldron_ext|piece_preptable|piece_butcher|cauldron_ext3_butchertable)/],
  ['brew', /^(fermenter|piece_MeadCauldron|barrell$)/],
  ['smith', /^(forge|blackforge|smelter|blastfurnace)/],
  ['craft', /^(piece_workbench|piece_artisanstation|artisan_ext|piece_stonecutter|piece_spinningwheel|piece_cartographytable)/],
  ['magic', /^(piece_magetable|piece_eitr|eitrrefinery|piece_alchemy|piece_magetable_ext)/],
  ['sleep', /^(bed$|piece_bed02|ashwood_bed|dvergrprops_bed)/],
  ['throne', /^(piece_throne|piece_blackmarble_throne|piece_bone_throne)/],
  ['dine', /^(piece_table|piece_table_round|piece_table_oak|piece_blackmarble_table|dvergrprops_table|piece_table_runed|mountainkit_table)/],
  ['hearth', /^(hearth|fire_pit|fire_pit_iron|fire_pit_hildir)/],
  ['armor', /^ArmorStand/],
];
const useOf = n => { for (const [k, re] of USE) if (re.test(n)) return k; return null; };

const rotq = (q, v) => { const [x, y, z, w] = q, ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x]; };
const inc = (o, k, v = 1) => { o[k] = (o[k] || 0) + v; };
const q = (a, f) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };

const S = { placeKind: {}, builds: 0, withStands: 0, items: {}, kindUse: {}, kindTilt: {}, kindAnchor: {}, wallRoll: {}, perBuild: [], runs: {}, armor: { stands: 0, empty: 0, outfits: {}, pattern: {}, perBuild: [], setShare: {}, slotItems: {}, ctx: {}, mixed: 0, full: 0, repeatsInBuild: [] } };
const OVER = new Set(['roof', 'roofTop', 'roofCorner', 'floor']);
const FLATANCH = r => r;
let done = 0;
for (const f of files) {
  let d;
  try { d = BP.parse(fs.readFileSync(f, 'utf8')); } catch (e) { continue; }
  if (!d.pieces.length || d.pieces.some(p => MOD.test(p.name))) continue; // vanilla builds only
  S.builds++;
  const base = path.basename(f, '.blueprint'), slug = base.split('__')[0], meta = index.get(slug) || {};
  const ps = d.pieces;
  const isStand = n => n === 'itemstand' || n === 'itemstandh';
  const st = [], arm = [];
  ps.forEach((p, i) => { if (isStand(p.name)) st.push(i); else if (p.name === 'ArmorStand') arm.push(i); });
  if (!st.length && !arm.length) continue;
  const bx = ps.map(p => Ck.aabb(p));
  const near = Ck.index(bx);
  const role = i => bx[i].info.role;
  const around = (x, z, r, y0, y1) => [...near({ x0: x - r, x1: x + r, z0: z - r, z1: z + r }, 0)].filter(j => bx[j].y1 > y0 && bx[j].y0 < y1);
  const covers = (j, x, z) => bx[j].x0 <= x && bx[j].x1 >= x && bx[j].z0 <= z && bx[j].z1 >= z;
  const roofed = (x, z, y) => around(x, z, 0.05, y + 0.3, y + 15).some(j => OVER.has(role(j)) && covers(j, x, z) && bx[j].y0 > y + 0.3);
  const useNear = (x, y, z, self) => { let best = null, bd = 3.0; for (const j of around(x, z, 3.0, y - 2.5, y + 2.5)) { if (j === self) continue; const u = useOf(ps[j].name); if (!u) continue; const cx = (bx[j].x0 + bx[j].x1) / 2, cz = (bx[j].z0 + bx[j].z1) / 2; const dd = Math.hypot(cx - x, cz - z); if (dd < bd) { bd = dd; best = u; } } return best || 'none'; };
  const recs = [];
  for (const i of st) {
    const p = ps[i];
    const item = (p.info || '').replace(/^"|"$/g, '').split(':')[0].trim();
    if (!item) continue;
    if (!roofed(p.x, p.z, p.y)) continue; // inside a building
    const k = kindOf(item), up = rotq(p.q, [0, 1, 0]), xa = rotq(p.q, [1, 0, 0]);
    const tilt = up[1] > 0.9 ? 'upright' : up[1] < -0.9 ? 'upside' : Math.abs(up[1]) < 0.3 ? 'side' : 'leaning';
    let anchor = 'wall';
    if (p.name === 'itemstandh') {
      let best = null, bt = -Infinity;
      for (const j of around(p.x, p.z, 0.02, p.y - 0.3, p.y + 0.1)) { if (j === i || bx[j].pass || !covers(j, p.x, p.z)) continue; const t = role(j) === 'storage' ? bx[j].y1 : bx[j].y1; if (t > p.y + 0.3 || t < p.y - 0.14) continue; if (t > bt) { bt = t; best = j; } }
      if (best == null) anchor = 'none';
      else { const n = ps[best].name, r = role(best); anchor = isStand(n) ? 'stand' : r === 'table' ? 'table' : r === 'storage' ? 'chest' : r === 'seat' ? 'seat' : r === 'floor' ? 'floor-or-shelf' : /beam|pole|ledge|log/.test(n) ? 'shelf' : r === 'wall' ? 'counter' : useOf(n) ? 'station' : 'other'; }
    } else {
      // roll of a wall stand round its face normal: 0 = level, 90 = turned on end
      const roll = Math.round(Math.abs(Math.asin(Math.max(-1, Math.min(1, xa[1])))) * 180 / Math.PI / 15) * 15;
      inc(S.wallRoll[k] || (S.wallRoll[k] = {}), roll);
    }
    const use = useNear(p.x, p.y, p.z);
    const it = S.items[item] || (S.items[item] = { kind: k, stands: 0, flat: 0, wall: 0, builds: 0, tilt: {}, use: {}, anchor: {} });
    it.stands++; it[p.name === 'itemstandh' ? 'flat' : 'wall']++;
    if (p.name === 'itemstandh') { inc(it.tilt, tilt); inc(S.kindTilt[k] || (S.kindTilt[k] = {}), tilt); inc(it.anchor, anchor); inc(S.kindAnchor[k] || (S.kindAnchor[k] = {}), anchor); }
    inc(it.use, use);
    { const pl = p.name === 'itemstandh' ? anchor : 'wall:' + use; inc(S.placeKind[pl] || (S.placeKind[pl] = {}), k); }
    inc(S.kindUse[k] || (S.kindUse[k] = {}), use);
    recs.push({ i, item, k, x: p.x, y: p.y, z: p.z, flat: p.name === 'itemstandh' });
  }
  if (recs.length) {
    S.withStands++;
    const cnt = {};
    for (const r of recs) inc(cnt, r.item);
    for (const n of Object.keys(cnt)) S.items[n].builds++;
    // runs: the same item on stands within 0.6 m of each other, joined
    const par = recs.map((_, k) => k), find = k => (par[k] === k ? k : (par[k] = find(par[k])));
    for (let a = 0; a < recs.length; a++) for (let b = a + 1; b < recs.length; b++) {
      const A = recs[a], B = recs[b];
      if (A.item === B.item && Math.hypot(A.x - B.x, A.z - B.z) < 0.6 && Math.abs(A.y - B.y) < 0.6) par[find(a)] = find(b);
    }
    const groups = {};
    recs.forEach((r, k) => { (groups[find(k)] = groups[find(k)] || []).push(r); });
    for (const g of Object.values(groups)) { const rk = S.runs[g[0].k] || (S.runs[g[0].k] = {}); inc(rk, g.length >= 6 ? '6+' : g.length); }
    const vals = Object.values(cnt);
    // the most repeated item that is not drink or food, and the most repeated overall
    const kindMax = {};
    for (const [n, c] of Object.entries(cnt)) { const k = kindOf(n); kindMax[k] = Math.max(kindMax[k] || 0, c); }
    S.perBuild.push({ t: meta.title || slug, cat: path.basename(path.dirname(f)), dls: +meta.dls || 0, votes: +meta.votes || 0, stands: recs.length, distinct: vals.length, maxSame: Math.max(...vals), kindMax });
  }
  // armor stands
  const outfitsHere = {};
  let armHere = 0;
  for (const i of arm) {
    const p = ps[i];
    S.armor.stands++;
    const t = (p.info || '').replace(/^"|"$/g, '');
    const a = t.split(':');
    const n = +a[1] || 0;
    const slotsN = n === 14 ? 7 : n; // the 14 form: same seven slots, three fields each in some saves; read the names only
    const items = [];
    if (n === 7) for (let s = 0; s < 7; s++) { const it = a[2 + 2 * s]; if (it) items.push([s, it]); }
    else if (n === 14) { const names = a.slice(2).filter(x => x && isNaN(+x)); names.forEach((it, s) => items.push([-1, it])); }
    if (!items.length) { S.armor.empty++; continue; }
    armHere++;
    const key = items.map(x => x[1]).sort().join(',');
    inc(S.armor.outfits, key);
    inc(outfitsHere, key);
    if (n === 7) {
      const pat = [0, 1, 2, 3, 4, 5, 6].map(s => (items.find(x => x[0] === s) ? 'CLHSWcu'[s] : '.')).join('');
      inc(S.armor.pattern, pat);
      for (const [s, it] of items) inc(S.armor.slotItems[s] || (S.armor.slotItems[s] = {}), it);
      // a set: chest, legs and helmet of one family (Armor<Fam>Chest, Armor<Fam>Legs, Helmet<Fam>)
      const fam = s => { const it = (items.find(x => x[0] === s) || [])[1] || ''; const m = it.match(/^(?:Armor|Helmet)(.*?)(Chest|Legs|Cuirass|Greaves|Hood)?(_Ashlands)?$/); return m ? m[1].replace(/Medium|Mage(?=$)/, x => x) : null; };
      const c = fam(0), l = fam(1), h = fam(2);
      const fams = [c, l, h].filter(Boolean);
      if (fams.length === 3 && new Set(fams).size === 1) S.armor.full++;
      else if (fams.length >= 2 && new Set(fams).size > 1) S.armor.mixed++;
    }
    inc(S.armor.ctx, useNear(p.x, p.y + 1, p.z, i));
  }
  if (armHere) {
    const reps = Object.values(outfitsHere);
    S.armor.perBuild.push({ t: meta.title || slug, stands: armHere, distinct: reps.length, maxSame: Math.max(...reps) });
  }
  if (++done % 200 === 0) process.stderr.write(`${done} builds\n`);
}

// ---------------------------------------------------------------- summary
const pb = S.perBuild;
const sum = {
  about: 'Items on item stands and gear on armor stands in Tyler\'s vanilla corpus builds (lab/mine_stand_items.js over the unpacked blueprint corpus; counts only). Stands inside a building (a roof or floor over them). kind: lab/mine_stand_items.js kindOf. use: the nearest use piece within 3 m (kitchen, brew, smith, craft, magic, sleep, throne, dine, hearth, armor, none). tilt: the flat stand\'s up axis (upright, side, leaning, upside). runs: the same item on stands within 0.6 m of each other, by group size. perBuild: stands, distinct items and the largest count of one item per build. armor: outfits as sorted item lists, slot patterns (C chest, L legs, H helmet, S left hand, W right hand, c cape, u utility).',
  builds: S.builds, withStands: S.withStands,
  perBuild: { n: pb.length, stands: [0.1, 0.25, 0.5, 0.75, 0.9].map(f => q(pb.map(x => x.stands), f)), distinct: [0.1, 0.25, 0.5, 0.75, 0.9].map(f => q(pb.map(x => x.distinct), f)),
    maxSame: [0.1, 0.25, 0.5, 0.75, 0.9].map(f => q(pb.map(x => x.maxSame), f)),
    distinctPerStand: [0.1, 0.25, 0.5, 0.75, 0.9].map(f => +q(pb.map(x => x.distinct / x.stands), f).toFixed(2)) },
  kindMax: {}, placeKind: S.placeKind, kindUse: S.kindUse, kindTilt: S.kindTilt, kindAnchor: S.kindAnchor, wallRoll: S.wallRoll, runs: S.runs,
  items: Object.fromEntries(Object.entries(S.items).sort((a, b) => b[1].builds - a[1].builds)),
  liked: pb.filter(x => x.votes >= 10).map(x => ({ t: x.t, stands: x.stands, distinct: x.distinct, maxSame: x.maxSame })).slice(0, 60),
  armor: { stands: S.armor.stands, empty: S.armor.empty, full: S.armor.full, mixed: S.armor.mixed, ctx: S.armor.ctx,
    pattern: Object.fromEntries(Object.entries(S.armor.pattern).sort((a, b) => b[1] - a[1])),
    slotItems: S.armor.slotItems, outfits: Object.fromEntries(Object.entries(S.armor.outfits).sort((a, b) => b[1] - a[1]).slice(0, 150)),
    perBuild: { n: S.armor.perBuild.length, stands: [0.5, 0.75, 0.9].map(f => q(S.armor.perBuild.map(x => x.stands), f)), distinct: [0.5, 0.75, 0.9].map(f => q(S.armor.perBuild.map(x => x.distinct), f)),
      maxSame: [0.5, 0.75, 0.9].map(f => q(S.armor.perBuild.map(x => x.maxSame), f)), allSame: S.armor.perBuild.filter(x => x.stands >= 2 && x.distinct === 1).length, multi: S.armor.perBuild.filter(x => x.stands >= 2).length } },
};
// per kind: among builds that show the kind, the largest count of one item of that kind (p50, p75, p90, max)
const kinds = new Set(pb.flatMap(x => Object.keys(x.kindMax)));
for (const k of kinds) { const v = pb.filter(x => x.kindMax[k]).map(x => x.kindMax[k]); sum.kindMax[k] = { builds: v.length, p50: q(v, 0.5), p75: q(v, 0.75), p90: q(v, 0.9), max: Math.max(...v) }; }
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(sum, null, 1));
console.log(`builds ${S.builds}, with stands ${S.withStands}, armor stands ${S.armor.stands} -> ${out}`);
