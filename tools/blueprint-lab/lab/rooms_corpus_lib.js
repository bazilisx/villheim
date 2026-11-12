// Shared names and helpers for the room study (lab/rooms_corpus_stats.js, lab/rooms_corpus_gardens.js,
// docs/ROOM_STUDY.md): what each vanilla piece is for, its material family (a first cut by prefab until the piece
// catalog of track A is there), room kinds, and small statistics helpers.
const fs = require('fs'), path = require('path');
const lab = path.join(__dirname, '..');
const P = require(lab + '/lib/pieces.js');

// ---------------------------------------------------------------- what a piece is for
// t: the type used in the counts. Seats carry a seat kind (sk), lights a light kind (lk).
const TYPE = [
  [/^(piece_table|piece_table_round|piece_table_oak|piece_blackmarble_table|dvergrprops_table|piece_table_runed|piece_table_runed_small|mountainkit_table)$/, 'table'],
  [/^(piece_throne01|piece_throne02|piece_blackmarble_throne|piece_bone_throne|piece_moose_throne)$/, 'throne'],
  [/^(piece_chair|piece_chair02|piece_chair03|piece_bench01|piece_logbench01|piece_blackmarble_bench|piece_blackwood_bench01|piece_bench_runed|piece_chair_runed|dvergrprops_chair|dvergrprops_stool)$/, 'seat'],
  [/^(bed|piece_bed02|ashwood_bed|dvergrprops_bed|goblin_bed)$/, 'bed'],
  [/^(piece_chest_wood|piece_chest|piece_chest_private|piece_chest_blackmetal|piece_chest_treasure|piece_chest_warderobe|piece_chest_grausten|stonechest|TreasureChest_.*|loot_chest_.*)$/, 'chest'],
  [/^(piece_chest_barrel|barrell|dvergrprops_barrel)$/, 'barrel'],
  [/^(dvergrprops_crate|dvergrprops_crate_long|dvergrprops_crate_ashlands)$/, 'crate'],
  [/^(hearth|fire_pit|fire_pit_iron|fire_pit_hildir|bonfire)$/, 'fire'],
  [/^(forge|blackforge|smelter|blastfurnace|charcoal_kiln|eitrrefinery)$/, 'forge'],
  [/^(forge_ext\d|blackforge_ext.*)$/, 'forge_ext'],
  [/^(piece_workbench|piece_stonecutter|piece_artisanstation|piece_magetable|piece_spinningwheel|piece_cartographytable|windmill)$/, 'station'],
  [/^(piece_workbench_ext\d|artisan_ext\d|piece_magetable_ext\d?)$/, 'station_ext'],
  [/^(piece_cauldron|piece_oven|piece_cookingstation|piece_cookingstation_iron|fermenter|piece_preptable|piece_MeadCauldron|cauldron_ext\d.*)$/, 'kitchen'],
  [/^(piece_walltorch|piece_groundtorch.*|piece_brazierceiling01|piece_brazierfloor0\d|piece_dvergr_lantern|piece_dvergr_lantern_pole|dvergrprops_lantern_standing|dvergrprops_lantern|piece_Lavalantern|Candle_resin|Candle_resin_bogwitch|MountainKit_brazier.*|surtling_lantern_1|piece_hoodedlantern|deepnorth_lantern_standing|piece_jackoturnip|piece_wisplure|CastleKit_groundtorch.*|CastleKit_brazier)$/, 'light'],
  [/^(piece_cloth_hanging_door.*|cloth_hanging_.*|fenrirhide_hanging.*)$/, 'drape'],
  [/^(piece_banner\d+|goblin_banner|CharredBanner\d)$/, 'banner'],
  [/^(rug_.*|jute_carpet.*)$/, 'rug'],
  [/^(wood_ledge|dvergrprops_shelf)$/, 'shelf'],
  [/^(piece_pot\d.*|piece_Pot1|ashland_pot.*)$/, 'pot'],
  [/^(itemstand|itemstandh)$/, 'itemstand'],
  [/^(ArmorStand.*)$/, 'armorstand'],
  [/^(sign|sign_notext)$/, 'sign'],
  [/^(piece_bathtub)$/, 'bath'],
  [/^(portal_wood|portal_stone|portal)$/, 'portal'],
  [/^(guard_stone|goblinking_totemholder|blackmarble_head0\d|StatueDeer|StatueCorgi|StatueSeed|StatueEvil|StatueHare)$/, 'statue'],
  [/^(Feast.*)$/, 'feast'],
  [/^(wood_stack|wood_fine_stack|wood_core_stack|wood_yggdrasil_stack|blackwood_stack|stone_pile|coal_pile|treasure_stack|treasure_pile|bone_stack|skull_pile|grausten_pile|blackmarble_pile|piece_world_blueprint_rune_stack)$/, 'pile'],
  [/^(darkwood_raven|darkwood_wolf|wood_dragon1|dragon_head.*)$/, 'roofdecor'],
  [/^(piece_xmastree|piece_xmascrown|piece_xmasgarland|piece_gift\d|piece_mistletoe|piece_FairylightGarland|piece_CelebrationGarland)$/, 'festive'],
  [/^(piece_beehive|piece_sapcollector)$/, 'farm'],
];
const SEATK = { piece_chair: 'stool', piece_chair02: 'chair', piece_chair03: 'chair', dvergrprops_chair: 'chair', piece_chair_runed: 'chair', dvergrprops_stool: 'stool',
  piece_bench01: 'bench', piece_blackmarble_bench: 'bench', piece_blackwood_bench01: 'bench', piece_bench_runed: 'bench', piece_logbench01: 'logbench' };
const LIGHTK = name => /^piece_walltorch$/.test(name) ? 'walltorch' : /^piece_groundtorch_wood$/.test(name) ? 'standing torch, wood'
  : /^(piece_groundtorch|CastleKit_groundtorch)$/.test(name) ? 'standing torch, iron' : /^(piece_groundtorch_(green|blue|mist)|CastleKit_groundtorch_.*)$/.test(name) ? 'standing torch, colored'
    : /brazierceiling/.test(name) ? 'hanging brazier' : /brazierfloor|MountainKit_brazier|CastleKit_brazier/.test(name) ? 'floor brazier' : /^piece_dvergr_lantern$/.test(name) ? 'dvergr lantern'
      : /dvergr_lantern_pole|dvergrprops_lantern|deepnorth_lantern|hoodedlantern|surtling_lantern/.test(name) ? 'standing lantern' : /Lavalantern/.test(name) ? 'lava lantern'
        : /Candle/.test(name) ? 'candle' : /jackoturnip/.test(name) ? 'jack-o-turnip' : /wisplure/.test(name) ? 'wisp torch' : 'other';
const cacheT = new Map();
function typeOf(name) {
  if (cacheT.has(name)) return cacheT.get(name);
  let t = null;
  for (const [re, k] of TYPE) if (re.test(name)) { t = k; break; }
  if (!t) {
    const r = P.piece(name).role;
    t = r === 'nature' || /^(Pickable_|sapling_|vines|Vine|vineash)/.test(name) ? 'plant' : P.piece(name).structural ? 'build' : /^Mead|Bread|Stew|Pie|Soup|Cooked|Jam|Salad/.test(name) ? 'food' : 'other';
  }
  cacheT.set(name, t);
  return t;
}
const FLOOR_T = new Set(['table', 'throne', 'seat', 'bed', 'chest', 'barrel', 'crate', 'fire', 'forge', 'forge_ext', 'station', 'station_ext', 'kitchen', 'bath', 'portal', 'statue', 'armorstand', 'pile', 'pot']);

// ---------------------------------------------------------------- material families (first cut by prefab)
// Labeled 'prefab first cut' in the outputs. Colors and woods as the pieces look in the game: plain light planks of the
// Meadows set, carved fine wood (medium brown), dark wood (near black brown), raw logs with bark, black marble, stone,
// Dvergr (pale wood with iron and blue light), ashwood (red brown, curved), iron, bone.
const FAMILY_PREFAB = {
  piece_table: 'plain wood', piece_bench01: 'plain wood', piece_chair: 'plain wood', bed: 'plain wood', piece_chest_wood: 'plain wood', piece_chest_barrel: 'plain wood', barrell: 'plain wood',
  wood_ledge: 'plain wood', piece_workbench: 'plain wood',
  piece_table_round: 'fine wood', piece_chair02: 'fine wood', piece_bed02: 'fine wood', piece_chest: 'fine wood', piece_chest_private: 'fine wood', piece_chest_warderobe: 'fine wood',
  piece_table_oak: 'dark wood', piece_chair03: 'dark wood', piece_throne01: 'dark wood',
  piece_logbench01: 'log',
  piece_blackmarble_table: 'black marble', piece_blackmarble_bench: 'black marble', piece_blackmarble_throne: 'black marble',
  piece_throne02: 'stone', stonechest: 'stone', piece_chest_grausten: 'grausten',
  dvergrprops_table: 'dvergr', dvergrprops_chair: 'dvergr', dvergrprops_stool: 'dvergr', dvergrprops_bed: 'dvergr', dvergrprops_barrel: 'dvergr', dvergrprops_crate: 'dvergr', dvergrprops_crate_long: 'dvergr', dvergrprops_shelf: 'dvergr',
  ashwood_bed: 'ashwood', piece_blackwood_bench01: 'ashwood', dvergrprops_crate_ashlands: 'ashwood',
  piece_table_runed: 'runed', piece_table_runed_small: 'runed', piece_bench_runed: 'runed', piece_chair_runed: 'runed',
  piece_chest_blackmetal: 'black metal', piece_chest_treasure: 'fine wood',
  piece_bone_throne: 'bone', piece_moose_throne: 'bone', goblin_bed: 'bone',
};
let CATALOG = null, CATALOG_SRC = null, CATALOG_VERSION = null;
const COLOR = new Map();
function loadCatalog(p) {
  if (!p || !fs.existsSync(p)) return null;
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    const raw = Array.isArray(j) ? j : j.pieces || j;
    const list = Array.isArray(raw) ? raw : Object.entries(raw).map(([k, r]) => ({ id: k, ...r }));
    const m = new Map();
    for (const r of list) {
      const id = r.id || r.prefab || r.name;
      const fam = r.family || r.materialFamily || (r.material && (r.material.family || r.material)) || null;
      if (id && fam && typeof fam === 'string') m.set(id, fam);
      if (id && r.look && r.look.mean) COLOR.set(id, r.look.mean);
    }
    if (m.size) { CATALOG = m; CATALOG_SRC = p; CATALOG_VERSION = j.version || null; }
  } catch (e) { /* keep the first cut */ }
  return CATALOG;
}
const familyOf = name => (CATALOG && CATALOG.get(name)) || (CATALOG ? null : FAMILY_PREFAB[name]) || null;
const familySource = () => (CATALOG ? `track A catalog (data/catalog/pieces.json family, version ${CATALOG_VERSION}); prefabs it does not list have no family` : 'prefab first cut (lab/rooms_corpus_lib.js FAMILY_PREFAB)');
// color difference (CIE76 delta E in Lab) between two prefabs' mean colors from the catalog (look.mean), or null
function toLab(hex) {
  const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92));
  const X = (v[0] * 0.4124 + v[1] * 0.3576 + v[2] * 0.1805) / 0.95047, Y = v[0] * 0.2126 + v[1] * 0.7152 + v[2] * 0.0722, Z = (v[0] * 0.0193 + v[1] * 0.1192 + v[2] * 0.9505) / 1.08883;
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
function colorDiff(a, b) {
  const ca = COLOR.get(a), cb = COLOR.get(b);
  if (!ca || !cb) return null;
  const la = toLab(ca), lb = toLab(cb);
  return { dE: Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]), dL: Math.abs(la[0] - lb[0]) };
}

// ---------------------------------------------------------------- vanilla
const CACHE = '/work/models/vhmodels/work/cache', INDEX = '/work/models/vhmodels/work/index.json';
let VANILLA = null;
function vanilla() {
  if (VANILLA) return VANILLA;
  VANILLA = new Set();
  // every prefab in the game's bundles (vhmodels index.json, read from the game files) and every measured piece
  if (fs.existsSync(CACHE)) for (const f of fs.readdirSync(CACHE)) if (f.endsWith('.json')) VANILLA.add(f.slice(0, -5));
  try { for (const n of Object.keys(JSON.parse(fs.readFileSync(INDEX, 'utf8')).prefabs)) VANILLA.add(n); } catch (e) { /* cache only */ }
  return VANILLA;
}
const MOD = /^(kg_|GB_|MB_|mm_|BBH|rk_|Piece_vf|OdinsKingdom|h_|\$|Hayze|rae_|teq_|tkd_|rkc_|VC_|IG_|OH_|.*DO$|HunterTable|MagicWeaver|ForgeOfAges|EssenceCauldron|MunitionsBench|HolderSpirit)/;
const isVanilla = name => !MOD.test(name) && (vanilla().size ? vanilla().has(name) : true);

// ---------------------------------------------------------------- statistics
const q = (a, f) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const i = (s.length - 1) * f, lo = Math.floor(i), hi = Math.ceil(i); return +(s[lo] + (s[hi] - s[lo]) * (i - lo)).toFixed(2); };
const qs = a => ({ n: a.length, p10: q(a, 0.1), p25: q(a, 0.25), p50: q(a, 0.5), p75: q(a, 0.75), p90: q(a, 0.9) });
const share = (a, f) => (a.length ? +(a.filter(f).length / a.length).toFixed(3) : null);
const top = (counter, n = 12) => Object.entries(counter).sort((a, b) => b[1] - a[1]).slice(0, n);
const inc = (o, k, v = 1) => { o[k] = (o[k] || 0) + v; return o; };
const norm = a => ((a % 360) + 360) % 360;
const angDiff = (a, b) => { const d = norm(a - b); return d > 180 ? 360 - d : d; };

module.exports = { colorDiff, COLOR, P, typeOf, SEATK, LIGHTK, FLOOR_T, FAMILY_PREFAB, familyOf, familySource, loadCatalog, isVanilla, MOD, q, qs, share, top, inc, norm, angDiff };
