// Builds data/stand-items/items.json and corpus.json (track G, 2026-11-12) from:
//   - the corpus pass of lab/mine_stand_items.js (which items builders show, on which stand, turned how, near what),
//   - data/item-models.json (how big each item shows on each stand, and whether the stand takes it),
//   - the biome each item first comes from (lib/persona.js ITEMS, read only, plus the list below).
//   node lab/build_stand_items.js [/tmp/assemblies-work/stand-items.json]
const fs = require('fs'), path = require('path');
const src = process.argv[2] || '/tmp/assemblies-work/stand-items.json';
const C = JSON.parse(fs.readFileSync(src, 'utf8'));
const IM = require('../data/item-models.json').items;
const PER = require('../lib/persona.js');
const OUT = path.join(__dirname, '../data/stand-items');

const BIOMES = ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains', 'Mistlands', 'Ashlands', 'Deep North'];
const tier = {};
for (const list of Object.values(PER.ITEMS)) for (const [b, n] of list) if (tier[n] == null) tier[n] = BIOMES.indexOf(b);
// items the persona lists leave out (the Valheim wiki's crafting station and biome for each)
const EXTRA = {
  Meadows: 'Torch Club AxeStone Bow ShieldWood ShieldWoodTower TrophyNeck NeckTail RawMeat DeerMeat Honey Mushroom FishingRod Flint Wood Stone Resin LeatherScraps DeerHide BeechSeeds Raspberry KnifeButcher',
  'Black Forest': 'BowFineWood AxeBronze PickaxeBronze SwordBronze MaceBronze AtgeirBronze SpearBronze KnifeCopper Copper Tin Bronze TrollHide Coal FineWood CarrotSeeds Thistle Blueberries AncientSeed ShieldBronzeBuckler ShieldBoneTower',
  Swamp: 'SwordIron MaceIron AtgeirIron Battleaxe SledgeIron SpearElderbark BowHuntsman AxeIron PickaxeIron Iron ElderBark Guck Bloodbag Entrails Ooze TurnipSeeds Turnip CryptKey ShieldBanded ShieldIronBuckler ShieldIronTower',
  Mountain: 'SwordSilver MaceSilver SpearWolfFang KnifeSilver BowDraugrFang BattleaxeCrystal FistFenrirClaw Silver WolfPelt Obsidian Crystal Onion DragonEgg DragonTear ShieldSilver ShieldSerpentscale',
  Plains: 'SwordBlackmetal AtgeirBlackmetal KnifeBlackMetal MaceNeedle SpearChitin KnifeChitin AxeBlackMetal Scythe BlackMetal LoxPelt Barley Flax Cloudberry Needle ChickenEgg GoblinTotem SaddleLox YagluthDrop ShieldBlackmetal ShieldBlackmetalTower',
  Mistlands: 'SwordMistwalker CrossbowArbalest THSwordKrom SledgeDemolisher AtgeirHimminAfl KnifeSkollAndHati StaffFireball StaffIceShards StaffShield StaffSkeleton AxeJotunBane SpearCarapace BowSpineSnap Carapace Eitr Sap BlackCore DvergrKey HelmetDverger MushroomMagecap MushroomJotunPuffs ShieldCarapace ShieldCarapaceBuckler',
  Ashlands: 'SwordNiedhogg SwordDyrnwyn THSwordSlayer AxeBerzerkr BowAshlands CrossbowRipper StaffGreenRoots StaffClusterbomb Flametal MoltenCore CelestialFeather Bell ShieldFlametal ShieldFlametalTower',
};
for (const [b, s] of Object.entries(EXTRA)) for (const n of s.split(' ')) if (tier[n] == null) tier[n] = BIOMES.indexOf(b);

// the corpus kinds (lab/mine_stand_items.js kindOf) by item, from the pass
const kind = {};
for (const [n, r] of Object.entries(C.items)) kind[n] = r.kind;

const items = {};
const names = new Set([...Object.keys(IM), ...Object.keys(tier)]);
for (const n of names) {
  const m = IM[n], c = C.items[n];
  const k = kind[n] || null;
  // what the item shows like on a flat stand standing upright (data/item-models.json: the attach branch's box in the
  // stand's frame): its top over the stand, its reach along the stand's x and z
  let flat = null;
  if (m && m.at && m.at.itemstandh && m.b) {
    const a = m.at.itemstandh;
    const rot = (q, v) => { const [x, y, z, w] = q, ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
      return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x]; };
    const pts = [];
    for (const X of [m.b.min[0], m.b.max[0]]) for (const Y of [m.b.min[1], m.b.max[1]]) for (const Z of [m.b.min[2], m.b.max[2]]) { const p = rot(a.q, [X * a.s[0], Y * a.s[1], Z * a.s[2]]); pts.push([p[0] + a.c[0], p[1] + a.c[1], p[2] + a.c[2]]); }
    const lo = i => +Math.min(...pts.map(p => p[i])).toFixed(2), hi = i => +Math.max(...pts.map(p => p[i])).toFixed(2);
    flat = { top: hi(1), low: lo(1), x: [lo(0), hi(0)], z: [lo(2), hi(2)] };
  }
  const rec = {
    kind: k, tier: tier[n] != null ? tier[n] : null,
    fits: m && m.fits ? { flat: !!m.fits.itemstandh, wall: !!m.fits.itemstand } : null,
    flat,
    // an item that stands 0.55 m or more tall on an upright flat stand shows on its head or end (an axe on its head,
    // a mace on its handle end); on a flat stand it goes only on its side (lib/standitems.js pose)
    tall: !!(flat && flat.top >= 0.55 && !/^(trophy|boss|curio)$/.test(k || '')),
    corpus: c ? { builds: c.builds, stands: c.stands, flat: c.flat, wall: c.wall, tilt: c.tilt, use: c.use } : null,
  };
  if (!rec.kind) {
    // name rules for items the corpus does not show
    if (/^Trophy/.test(n)) rec.kind = /Eikthyr|TheElder|Bonemass|DragonQueen|GoblinKing|SeekerQueen|Fader|Elaking|Hildir|BrosShaman/.test(n) ? 'boss' : 'trophy';
    else if (/^Shield/.test(n)) rec.kind = 'shield';
    else if (/^Mead|BarleyWine|Lingondricka|OatMilk/.test(n)) rec.kind = 'mead';
    else if (/^Tankard/.test(n)) rec.kind = 'tankard';
    else if (/^Fish\d/.test(n)) rec.kind = 'fish';
    else if (/^(Sword|THSword)/.test(n)) rec.kind = 'sword';
    else if (/^(Mace|Club|Sledge|Fist)/.test(n)) rec.kind = 'blunt';
    else if (/^(Spear|Atgeir)/.test(n)) rec.kind = 'polearm';
    else if (/^(Bow|Crossbow)/.test(n)) rec.kind = 'bow';
    else if (/^Knife/.test(n)) rec.kind = 'knife';
    else if (/^Staff/.test(n)) rec.kind = 'staff';
    else if (/^Axe(Stone|Flint|Bronze|Iron|BlackMetal|Jotun)/.test(n)) rec.kind = 'axe-tool';
    else if (/^(Axe|Battleaxe)/.test(n)) rec.kind = 'axe';
    else if (/^(Hammer|Pickaxe|FishingRod|Shovel)/.test(n)) rec.kind = 'tool';
    else if (/^(Hoe|Cultivator|Scythe)/.test(n)) rec.kind = 'farm';
    else if (/^Helmet/.test(n)) rec.kind = 'hat';
    else rec.kind = 'other';
    rec.tall = !!(flat && flat.top >= 0.55 && !/^(trophy|boss|curio)$/.test(rec.kind));
  }
  items[n] = rec;
}

// lift of each item kind next to each use piece, against all stands (corpus): over 1 means builders put that kind
// there more than at random
const all = {};
let tot = 0;
for (const v of Object.values(C.kindUse)) for (const [u, c] of Object.entries(v)) { all[u] = (all[u] || 0) + c; tot += c; }
const lift = {};
for (const [k, v] of Object.entries(C.kindUse)) {
  const s = Object.values(v).reduce((a, b) => a + b, 0);
  if (s < 30) continue;
  lift[k] = {};
  for (const [u, c] of Object.entries(v)) lift[k][u] = +((c / s) / (all[u] / tot)).toFixed(2);
}
const corpus = Object.assign({}, C, { liked: undefined, items: undefined, lift, source: 'lab/mine_stand_items.js over the unpacked corpus (2,657 files; vanilla builds only), 2026-11-12' });
delete corpus.liked; delete corpus.items;
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'items.json'), JSON.stringify({ about: 'Vanilla items for item stands: kind (lab/mine_stand_items.js kindOf), tier (index in ' + BIOMES.join(', ') + '), fits (the game\'s ItemStand.CanAttach on the flat and the wall stand, data/item-models.json), flat (the item\'s box on an upright flat stand, metres in the stand frame), tall (shows on its head or end on an upright flat stand), corpus (builds and stands showing it inside a building, flat and wall stands, tilt of flat stands, nearest use piece).', biomes: BIOMES, items }, null, 0));
fs.writeFileSync(path.join(OUT, 'corpus.json'), JSON.stringify(corpus, null, 1));
console.log(Object.keys(items).length, 'items;', Object.values(items).filter(r => r.tall).length, 'tall');
