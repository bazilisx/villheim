// Picks furniture assembly recipes from the clusters lab/mine_assemblies.js found (track G, 2026-11-12) and writes
// data/assemblies/corpus.json in the recipe form of lib/assemblies.js.
//   node lab/select_assemblies.js [/tmp/assemblies-work/clusters.json] [out.json]
// Steps: drop structure that came along (pieces over 2.7 m, members far behind the wall face), keep clusters that are
// furniture (a built part with furniture or decor on or in it, or a station with its extensions), name each by what it
// holds (kitchen stove, potion shelf, cabinet, canopy bed ...), drop near copies (same type and the same prefabs), and
// keep the best liked examples of each type from different builds.
const fs = require('fs'), path = require('path');
const CAT = require('../lib/catalog.js');
const src = process.argv[2] || '/tmp/assemblies-work/clusters.json', out = process.argv[3] || path.join(__dirname, '../data/assemblies/corpus.json');
const { builds, clusters } = JSON.parse(fs.readFileSync(src, 'utf8'));
const SIK = require('../data/stand-items/items.json').items;
const SIK2 = require('../lib/standitems.js');

const BUILT = /(_beam|_pole|_wall_half|_wall_quarter|halfwall|quarterwall|_ledge|_floor_1x1|_log|_arch|_wall_1x1|_wall_2x1|2x1x1|blackmarble_1x1|_decowall|wood_window|wood_wall_roof_top|dvergrprops_wood|dvergrprops_shelf|_stair|_fence|roof_top|roof_icorner|Piece_grausten_wall|wood_dragon1)/;
const isBuilt = n => BUILT.test(n);
const HIDDEN_EXTRA = new Set(['wood_ledge']); // Tyler D-166: hidden from the build menu; the catalog's 'buildable' marks the rest
// a loose item set down as decor (food, a mead) is no building piece: it is marked loose, not hidden
const isItem = n => !!SIK[n] || /^(Mead|Cooked|Bread|Honey|Carrot|Turnip|Onion|Blueberries|Raspberry|Cloudberry|Fish|Trophy)/.test(n) || (CAT.get(n) && /^(food|item)$/.test(CAT.get(n).kind));
const hidden = n => !isItem(n) && (HIDDEN_EXTRA.has(n) || (CAT.get(n) ? CAT.get(n).buildable === false : false));
const itemOf = m => { const o = m.find(v => v && typeof v === 'object' && !Array.isArray(v)); return o && o.info ? o.info.split(':')[0] : null; };
const sikind = n => (SIK[n] ? SIK[n].kind : null);

const recipes = [];
// recipes looked at in lab/render_assemblies.js sheets and left out (title|kind): structure or rubble, not furniture
const DROP = new Set(require('fs').existsSync(path.join(__dirname, '../data/assemblies/drop.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, '../data/assemblies/drop.json'), 'utf8')).drop : []);
const sig = new Map();
for (const c of clusters) {
  // members: keep pieces from just behind the wall face to 2.9 m into the room, under 2.7 m
  let mem = c.members.filter(m => m[2] < 2.7 && (c.wall === 'none' || (m[3] > -0.45 && m[3] < 2.9)));
  if (mem.length < 3) continue;
  const names = mem.map(m => m[0]);
  const built = names.filter(isBuilt), furn = names.filter(n => !isBuilt(n));
  const has = re => names.some(n => re.test(n));
  const stands = mem.filter(m => /^itemstand/.test(m[0]));
  const items = stands.map(itemOf).filter(Boolean);
  const kinds = items.map(sikind).filter(Boolean);
  const share = k => (kinds.length ? kinds.filter(x => k.includes(x)).length / kinds.length : 0);
  let kind = null;
  switch (c.type) {
    case 'stove': kind = has(/^(piece_cauldron|piece_cookingstation|piece_oven)/) ? 'kitchen-stove' : has(/preptable|butcher/) ? 'prep-counter' : has(/MeadCauldron/) ? 'brew-corner' : null; break;
    case 'brew': kind = has(/^fermenter/) ? 'brew-corner' : has(/^barrell$/) ? 'keg-rack' : null; break;
    case 'forge': kind = 'forge-corner'; break;
    case 'work': kind = has(/spinningwheel/) ? 'spinning-corner' : has(/stonecutter/) ? 'mason-corner' : has(/artisan/) ? 'artisan-corner' : 'work-corner'; break;
    case 'mage': kind = 'galdr-corner'; break;
    case 'bed': {
      const bed = mem.find(m => /^(bed|piece_bed02|ashwood_bed|dvergrprops_bed)$/.test(m[0]));
      const posts = mem.filter(m => /pole|beam|decowall/.test(m[0]) && m[2] > 1.3).length;
      const beds = mem.filter(m => /^(bed|piece_bed02|ashwood_bed|dvergrprops_bed)$/.test(m[0]));
      kind = beds.length >= 2 && beds.some(b => b[2] > 1) ? 'bunk' : posts >= 2 ? 'canopy-bed' : built.length ? 'bed-nook' : furn.length >= 3 ? 'bedside' : null;
      if (!bed) kind = null;
      break;
    }
    case 'armor': kind = built.length || has(/banner|decowall/) ? 'armor-alcove' : mem.filter(m => m[0] === 'ArmorStand').length >= 2 ? 'armor-row' : null; break;
    case 'wardrobe': kind = 'wardrobe-nook'; break;
    case 'stands': {
      if (stands.length < 3 || !built.length) { kind = null; break; }
      kind = share(['mead']) >= 0.5 ? 'potion-shelf' : share(['food', 'produce', 'rawmeat', 'fish']) >= 0.5 ? 'pantry-shelf' : share(['herbs']) >= 0.5 ? 'herb-shelf'
        : share(['tankard']) >= 0.5 ? 'drink-shelf' : share(['trophy', 'boss', 'curio', 'hat', 'shield', 'valuable']) >= 0.5 ? 'display-shelf' : share(['tool', 'axe-tool', 'farm', 'material']) >= 0.5 ? 'tool-shelf' : 'shelving';
      // a counter: built tops at 0.8 to 1.3 m along the wall, 1.8 m or longer
      const tops = mem.filter(m => isBuilt(m[0]) && m[2] > 0.5 && m[2] < 1.3);
      if (tops.length >= 2 && c.foot[1] - c.foot[0] >= 1.8 && kind !== 'potion-shelf' && mem.filter(m => /^itemstandh/.test(m[0]) && m[2] < 1.5).length >= stands.length * 0.6) kind = kinds.some(k => k === 'mead' || k === 'tankard') ? 'bar-counter' : 'counter';
      break;
    }
    case 'chest': {
      const chests = mem.filter(m => /chest|barrel|crate/.test(m[0]));
      const stacked = chests.filter(m => m[2] > 0.5).length;
      if (!built.length && !has(/^sign$/) && !stands.length) { kind = null; break; }
      kind = has(/^sign$/) && chests.length >= 2 ? 'labeled-storage' : stacked && stands.length ? 'dresser' : built.some(n => /wall_half|halfwall|wall_quarter|quarterwall|decowall|_1x1|2x1/.test(n)) ? 'cabinet' : built.some(n => /beam|floor_1x1|ledge/.test(n)) ? 'chest-shelf' : null;
      break;
    }
  }
  if (!kind) continue;
  const w = c.foot[1] - c.foot[0], d = c.foot[3] - c.foot[2];
  if (w > 4.6 || d > 3.2 || w < 0.4) continue;
  // the same type with the same set of prefabs is one recipe; it keeps the best liked example and counts the builds
  const key = kind + '|' + [...new Set(names)].sort().join(',');
  const score = Math.log(1 + c.src.votes) * 2 + Math.log(1 + c.src.dls) + Math.min(6, new Set(names).size) * 0.6 - Math.max(0, mem.length - 24) * 0.1;
  const prev = sig.get(key);
  if (prev) { prev.builds.add(c.src.file); if (score > prev.score) Object.assign(prev, { c, mem, score }); continue; }
  sig.set(key, { kind, c, mem, score, builds: new Set([c.src.file]) });
}

// every piece rests on something: the floor, another piece of the recipe (its top within 0.2 m under the piece's
// foot), or the wall behind (wall-hung pieces within 0.5 m of the wall face). Recipes with a piece in the air are
// left out (the cluster lost what held it: a full wall, a table outside the cluster).
const Ck = require('../lib/checks.js');
const HUNG = /^(itemstand$|piece_walltorch|piece_banner|sign|piece_cloth_hanging|darkwood_decowall|piece_brazierceiling|piece_chandelier|piece_dvergr_lantern_pole|cloth_hanging|jute_carpet|rug_|piece_xmasgarland|piece_mistletoe|piece_Celebration|piece_Fairylight|trophy|piece_trophy|vines)/i;
function floats(r) {
  const ps = r.pieces.map(p => ({ name: p.n, x: p.x, y: p.y, z: p.z, yaw: p.yaw, q: p.q || [0, Math.sin(p.yaw * Math.PI / 360), 0, Math.cos(p.yaw * Math.PI / 360)] }));
  const bx = ps.map(p => Ck.aabb(p));
  let n = 0;
  ps.forEach((p, i) => {
    const b = bx[i];
    if (b.y0 < 0.2) return;
    if (HUNG.test(p.name) && (r.wall !== 'none' && b.z0 < 0.6)) return;
    const held = bx.some((o, j) => j !== i && o.y1 <= b.y0 + 0.25 && o.y1 >= b.y0 - 0.35 && o.x0 < b.x1 - 0.02 && o.x1 > b.x0 + 0.02 && o.z0 < b.z1 - 0.02 && o.z1 > b.z0 + 0.02)
      || bx.some((o, j) => j !== i && o.y0 < b.y1 && o.y1 > b.y0 && o.x0 < b.x1 + 0.05 && o.x1 > b.x0 - 0.05 && o.z0 < b.z1 + 0.05 && o.z1 > b.z0 - 0.05 && !/^itemstand/.test(ps[j].name) && /beam|pole|wall|floor|log|arch|ledge|1x1|2x1/.test(ps[j].name));
    if (!held) n++;
  });
  // the whole set lifted off the floor (its floor was read from a lower storey) when nothing stands on the floor
  if (Math.min(...bx.map(b => b.y0)) > 0.25 && !ps.some(p => HUNG.test(p.name))) n += 100;
  // rubble and log piles: three or more log pieces with no furniture among them
  if (ps.filter(p => /log/.test(p.name)).length >= 3 && !ps.some(p => /bed|chest|table|bench|chair|cauldron|fermenter|forge|workbench|itemstand|ArmorStand/.test(p.name))) n += 100;
  return n;
}
let dropped = 0;
// per type: the best scored, at most one recipe per source build, up to a share of the type's count
const byKind = {};
for (const r of sig.values()) (byKind[r.kind] = byKind[r.kind] || []).push(r);
const LIMIT = { 'kitchen-stove': 28, 'prep-counter': 10, 'brew-corner': 14, 'keg-rack': 8, 'forge-corner': 16, 'work-corner': 16, 'spinning-corner': 5, 'mason-corner': 5, 'artisan-corner': 5,
  'galdr-corner': 10, 'canopy-bed': 14, 'bed-nook': 18, 'bunk': 6, 'bedside': 10, 'armor-alcove': 16, 'armor-row': 6, 'wardrobe-nook': 6, 'potion-shelf': 14, 'pantry-shelf': 14, 'herb-shelf': 8,
  'drink-shelf': 10, 'display-shelf': 14, 'tool-shelf': 8, 'shelving': 8, 'bar-counter': 14, counter: 12, 'labeled-storage': 12, dresser: 10, cabinet: 16, 'chest-shelf': 12 };
const ROOMS = { 'kitchen-stove': ['kitchen', 'home', 'tavern'], 'prep-counter': ['kitchen', 'tavern'], 'brew-corner': ['tavern', 'kitchen', 'storage', 'brewery'], 'keg-rack': ['tavern', 'storage', 'brewery'],
  'forge-corner': ['smithy'], 'work-corner': ['workshop', 'home', 'smithy'], 'spinning-corner': ['workshop', 'home'], 'mason-corner': ['workshop'], 'artisan-corner': ['workshop'], 'galdr-corner': ['study', 'temple'],
  'canopy-bed': ['bedroom'], 'bed-nook': ['bedroom', 'home'], bunk: ['bedroom', 'dormitory'], bedside: ['bedroom', 'home'], 'armor-alcove': ['hall', 'armory', 'bedroom', 'entry'], 'armor-row': ['hall', 'armory'],
  'wardrobe-nook': ['bedroom'], 'potion-shelf': ['study', 'bedroom', 'kitchen', 'temple'], 'pantry-shelf': ['kitchen', 'storage', 'tavern'], 'herb-shelf': ['kitchen', 'study', 'bedroom'], 'drink-shelf': ['tavern', 'hall', 'home'],
  'display-shelf': ['hall', 'home', 'study'], 'tool-shelf': ['workshop', 'smithy', 'storage'], shelving: ['home', 'storage', 'kitchen'], 'bar-counter': ['tavern', 'hall'], counter: ['kitchen', 'tavern', 'storage'],
  'labeled-storage': ['storage', 'workshop', 'smithy'], dresser: ['bedroom', 'home'], cabinet: ['bedroom', 'home', 'kitchen', 'storage'], 'chest-shelf': ['storage', 'workshop', 'home'] };
const famOf = names => { const f = {}; for (const n of names) { const k = CAT.family(n); if (k) f[k] = (f[k] || 0) + 1; } return Object.entries(f).sort((a, b) => b[1] - a[1]).map(x => x[0]); };
const STONE = new Set(['cut_stone', 'grausten', 'black_marble', 'iron']);
for (const [kind, list] of Object.entries(byKind)) {
  list.sort((a, b) => b.builds.size * 1.5 + b.score - (a.builds.size * 1.5 + a.score));
  const seenB = new Set();
  let k = 0;
  for (const r of list) {
    if (k >= (LIMIT[kind] || 8)) break;
    if (seenB.has(r.c.src.file)) continue;
    const names = r.mem.map(m => m[0]);
    const builtFam = famOf(names.filter(isBuilt)), allFam = famOf(names);
    const pieces = r.mem.map(m => {
      const p = { n: m[0], x: m[1], y: m[2], z: m[3], yaw: m[4] };
      for (const v of m.slice(5)) { if (Array.isArray(v)) p.q = v; else if (v && v.info) p.info = v.info; }
      // the builder's own items are not copied: a stand keeps the kind of thing it held (want) and lib/standitems.js
      // picks the item for the household; the source item stays as 'was' for reference
      if (p.info && /^itemstand/.test(p.n)) { const it = p.info.split(':')[0]; p.want = SIK2.kindOf(it); p.was = it; delete p.info; }
      if (p.info && p.n === 'ArmorStand') { const its = p.info.split(':').filter(x => /^[A-Z]/.test(x)); p.want = its.length >= 3 ? 'full' : 'part'; p.was = its.join(','); delete p.info; }
      if (hidden(m[0])) p.hidden = true;
      if (isItem(m[0])) p.loose = true;
      return p;
    });
    const rec = {
      id: `AC-${kind}-${String(k + 1).padStart(2, '0')}`, kind, from: 'corpus', wall: r.c.wall,
      foot: { x: [r.c.foot[0], r.c.foot[1]], z: [r.c.foot[2], r.c.foot[3]], h: r.c.h },
      rooms: ROOMS[kind] || ['home'], families: allFam.slice(0, 4), built: builtFam[0] || null,
      cultures: builtFam.some(f => STONE.has(f)) ? ['stone'] : ['any'],
      hidden: [...new Set(names.filter(hidden))],
      builds: r.builds.size, src: { title: r.c.src.title, by: r.c.src.by, cat: r.c.src.cat, votes: r.c.src.votes, dls: r.c.src.dls },
      pieces,
    };
    if (floats(rec) || DROP.has(rec.src.title + '|' + kind)) { dropped++; continue; }
    seenB.add(r.c.src.file);
    k++;
    recipes.push(rec);
  }
}
console.log('left out with a piece in the air or dropped by hand:', dropped);
recipes.sort((a, b) => a.id.localeCompare(b.id));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ about: `Furniture assemblies mined from the corpus (lab/mine_assemblies.js, lab/select_assemblies.js; ${builds} vanilla builds, ${clusters.length} clusters). Frame: x along the wall, z into the room from the wall face, y over the floor; yaw against the frame (lab convention). wall: back (stands against one wall), corner (two), none (free-standing; frame of its seed piece). builds: corpus builds holding the same type with the same prefabs. hidden: pieces hidden from the build menu (D-166). q: a piece turned off the vertical keeps its quaternion in the frame (lib/assemblies.js turns it with the facing). info: an item or sign text the source had.`, recipes }, null, 0));
const cnt = {};
for (const r of recipes) cnt[r.kind] = (cnt[r.kind] || 0) + 1;
console.log(recipes.length, 'recipes', cnt);
