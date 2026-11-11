// What builders put on item stands, and where (Tyler, 2026-11-10): the item on every itemstand (the wall one) and
// itemstandh (the flat one) of the vanilla builds, what it stands on or hangs from, how stands group, and the feasts.
//   node --max-old-space-size=6000 lab/mine_stands.js <folder of .blueprint, read recursively> [out.json] [index.json]
// index.json: the corpus's list of builds ({ slug, title, cat, dls }); builds are matched by the start of the file name.
//
// For each stand inside a building (a floor under it and a roof or floor over it):
//   item     the prefab in the piece's info field ("Tankard:0:1"); empty stands are counted apart
//   anchor   for a flat stand what is under it: a table (a side table when its top is under 1 m2), a bench or seat, a
//            workbench or other station, a chest or barrel, a shelf (a ledge, or a beam against a wall at 0.9 to
//            2.3 m), a beam higher up (rafter), a window sill, a mantel (over a fire), a half wall (counter), the floor,
//            another stand; for a wall stand what is behind it (a wall, a beam or post, a rafter over 2.3 m) and what is
//            under it within reach: a workbench or station, a table, a bench, a bed, a chest, a fire, a door beside it
//   frame    its place in the anchor's frame: across and along a table's top (as a share of the half length and half
//            width), its height over the floor, its turn against the anchor
//   group    stands within 0.9 m of each other are one group; its size and the kinds it holds
// Every table, bench, workbench, chest, window, fire and bed inside is counted, so the share of each that has
// something on a stand on or over it is the corpus rate the generator is held to (lab/test_stands.js).
const fs = require('fs'), path = require('path');
const P = require('../lib/pieces.js'), SH = require('../lib/shapes.js'), Ck = require('../lib/checks.js'), BP = require('../lib/blueprint.js');

const dir = process.argv[2], out = process.argv[3] || '/tmp/stands-corpus.json';
const idx = require.main === module && process.argv[4] ? JSON.parse(fs.readFileSync(process.argv[4], 'utf8')) : [];
const MOD = /^(kg_|GB_|CastleKit|MB|mm_|BBH|rk_|Piece_vf|OdinsKingdom|h_|\$|Hayze|rae_|teq_|tkd_|rkc_)/;
const files = [];
if (require.main === module) (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) { if (!/^_/.test(e.name)) walk(path.join(d, e.name)); } else if (/\.blueprint$/.test(e.name)) files.push(path.join(d, e.name)); } })(dir);
const bySlug = new Map(idx.map(d => [d.slug, d]));
const metaOf = f => { const b = path.basename(f, '.blueprint'), s = b.split('__')[0]; return bySlug.get(s) || { slug: s, title: s, cat: path.basename(path.dirname(f)), dls: 0 }; };

// ---------------------------------------------------------------- what an item is
const BOSS = /^Trophy(Eikthyr|TheElder|Bonemass|DragonQueen|GoblinKing|SeekerQueen|Fader)$/;
function kindOf(n) {
  if (!n) return 'empty';
  if (BOSS.test(n)) return 'boss';
  if (/^Trophy/.test(n)) return 'trophy';
  if (/^Shield/.test(n)) return 'shield';
  if (/^(Hammer|Hoe|Cultivator|Pickaxe|FishingRod|Feaster|Scythe|Tankard|Tankard_dvergr|TankardAnniversary|TankardOdin|HornOfCelebration)/.test(n)) return /^(Tankard|Horn)/.test(n) ? 'drink' : /^(Hoe|Cultivator|Scythe)/.test(n) ? 'farm' : 'tool';
  if (/^Axe(Stone|Flint|Bronze|Iron|BlackMetal|Jotun)/.test(n)) return 'tool';
  if (/^(Sword|Mace|Spear|Atgeir|Bow|Crossbow|Knife|Battleaxe|Sledge|Club|Torch|Staff|Axe|Thrown|Fist|Lance|Greatsword)/.test(n)) return 'weapon';
  if (/^(Mead|BarleyWine)/.test(n)) return 'drink';
  if (/^Fish(?!ingRod|Wraps|Cooked|AndBread)/.test(n)) return 'fish';
  if (/^(Helmet(Yule|Midsummer|Dverger|Hat|Fishing|Pointy|Straw|Sweatband)|HelmetHat\d|Hat)/.test(n)) return 'hat';
  if (/^(DragonEgg|AsksvinEgg|VoltureEgg|Egg|SurtlingCore|BlackCore|MoltenCore|AncientSeed|DragonTear|CelestialFeather|Thunderstone|Wishbone|TrophyHatchling|SwampKey|CryptKey|DvergrKey|Ruby|Amber|AmberPearl|SilverNecklace|Coins|GoldRubyRing|Bell|BellFragment|Fragment|MechanicalSpring|DvergrNeedle|BarberKit|BarrelRings|SaddleLox|SaddleAsksvin|SealBreaker|FulingTotem|TornSpirit|ProustitePowder|Thistle|Dandelion|Mushroom|Carrot|Turnip|Onion|Barley|Flax|Blueberries|Raspberry|Cloudberry|Pukeberries|Fiddleheadfern|Vineberry|SmokePuff|MushroomJotunPuffs|MushroomMagecap|MushroomBlue|MushroomYellow|Royal|Honey|Bomb|Ooze|Basalt)/.test(n)) {
    if (/^(Dandelion|Thistle|Mushroom|Fiddlehead|SmokePuff)/.test(n)) return 'herbs';
    if (/^(Carrot|Turnip|Onion|Barley|Flax|Blueberries|Raspberry|Cloudberry|Pukeberries|Vineberry|Honey|Royal)/.test(n)) return 'food';
    if (/^(Bomb|Ooze|Basalt)/.test(n)) return 'rare';
    if (/^(Ruby|Amber|AmberPearl|SilverNecklace|Coins|GoldRubyRing)/.test(n)) return 'valuable';
    return 'rare';
  }
  if (/^(Cooked|Bread|Sausages|LoxPie|FishWraps|BloodPudding|QueensJam|CarrotSoup|TurnipStew|SerpentStew|MeatPlatter|HoneyGlazed|MisthareSupreme|Salad|MushroomOmelette|Eyescream|ShocklateSmoothie|MagicallyStuffed|BlackSoup|DeerStew|MincedMeatSauce|WolfMeatSkewer|WolfJerky|BoarJerky|OnionSoup|YggdrasilPorridge|SeekerAspic|ScorchingMedley|SizzlingBerryBroth|SparklingShroomshake|SpicyMarmalade|RoastedCrustPie|PiquantPie|MarinatedGreens|MashedMeat|FierySvinstew|StuffedMushroom|Feast|Pie|Porridge|Stew|Soup|Jam)/.test(n)) return 'food';
  if (/^(RawMeat|DeerMeat|NeckTail|SerpentMeat|LoxMeat|WolfMeat|HareMeat|ChickenMeat|BugMeat|AsksvinMeat|VoltureMeat|BoneMawSerpentMeat)/.test(n)) return 'rawmeat';
  if (/^(Wood|Stone|Flint|Resin|Coal|Iron|Copper|Tin|Bronze|Silver|BlackMetal|Obsidian|Crystal|LeatherScraps|DeerHide|TrollHide|WolfPelt|LoxPelt|Chitin|Guck|Tar|Needle|Feathers|BoneFragments|Entrails|Bloodbag|Ectoplasm|Sap|Eitr|Grausten|Flametal|FineWood|ElderBark|RoundLog|YggdrasilWood|BlackMarble|Carapace|Sulfur|CharredBone|Linen|Bronzenails|IronNails|JuteRed|JuteBlue|Charcoal)/.test(n)) return 'material';
  if (/^(Armor|Cape|Helmet|Belt|Beard|Hair)/.test(n)) return 'armor';
  return 'other';
}

// ---------------------------------------------------------------- anchors
const TABLE = /table/i, WORK = /^(piece_workbench|forge|piece_artisanstation|blackforge|piece_magetable|piece_stonecutter|piece_cartographytable|piece_preptable|piece_MeadCauldron|piece_cauldron|piece_butcher|piece_spinningwheel|windmill|piece_cookingstation|piece_oven|fermenter|piece_workbench_ext|forge_ext|piece_alchemy)/i;
const SEAT = /bench|chair|stool|throne|sofa|piece_blackmarble_bench/i;
const STORE = /chest|barrel|crate|dvergrprops_barrel|treasure/i;
const FIRE = /^(hearth|fire_pit|fire_pit_iron|fire_pit_hildir|bonfire|piece_brazier|piece_groundtorch)/;
const BED = /^(bed|piece_bed02|ashwood_bed|dvergrprops_bed)$/;
const WINDOWISH = p => P.piece(p.name).role === 'window' || /window|glass|crystal_wall/i.test(p.name);
const OVER = new Set(['roof', 'roofTop', 'roofCorner', 'floor']);
const area = b => (b.x1 - b.x0) * (b.z1 - b.z0);
const yawOf = q => Math.atan2(2 * (q[3] * q[1] + q[0] * q[2]), 1 - 2 * (q[1] ** 2 + q[2] ** 2));

const newStats = () => ({ builds: 0, vanilla: 0, interiors: 0, withStands: 0, standsAll: 0, stands: { itemstand: 0, itemstandh: 0 }, empty: { itemstand: 0, itemstandh: 0 },
  items: { itemstand: {}, itemstandh: {} }, itemBuilds: {}, kinds: { itemstand: {}, itemstandh: {} }, anchors: { itemstand: {}, itemstandh: {} },
  anchorKinds: {}, heights: {}, clips: {}, turn: {}, tableAt: [], groups: { sizes: {}, combos: {}, anchors: {} }, inst: {}, perBuild: [],
  feasts: { n: 0, builds: new Set(), on: {}, near: {}, at: [], names: {} }, loose: { n: 0, names: {}, on: {} }, tilt: { itemstand: {}, itemstandh: {} },
  wallGap: [], ex: [], dbg: {}, sinks: {}, rooms: [] });
const inc = (o, k, v = 1) => { o[k] = (o[k] || 0) + v; };
const add = (o, k, v) => { (o[k] = o[k] || []).push(v); };

const ITEMDROP = n => !!n && !/^(itemstand|piece_|wood_|stone_|Feast|Pickable|Placeable)/.test(n) && P.piece(n).role === 'misc' && kindOf(n) !== 'other';

// One build: its stands, anchors, groups, feasts and loose food into the totals S; returns the stands it read.
function scan(ps, build, meta, S) {
  const bx = ps.map(p => Ck.aabb(p));
  const near = Ck.index(bx);
  const role = i => bx[i].info.role;
  const around = (x, z, r, y0, y1) => [...near({ x0: x - r, x1: x + r, z0: z - r, z1: z + r }, 0)].filter(j => bx[j].y1 > y0 && bx[j].y0 < y1);
  const covers = (j, x, z, e = 0) => bx[j].x0 - e <= x && bx[j].x1 + e >= x && bx[j].z0 - e <= z && bx[j].z1 + e >= z;
  const floorTop = (x, z, y) => { let t = null; for (const j of around(x, z, 0.05, y - 4, y + 0.3)) if (role(j) === 'floor' && covers(j, x, z) && bx[j].y1 <= y + 0.25 && (t == null || bx[j].y1 > t)) t = bx[j].y1; return t; };
  const roofed = (x, z, y) => around(x, z, 0.05, y + 0.3, y + 15).some(j => OVER.has(role(j)) && covers(j, x, z) && bx[j].y0 > y + 0.3);
  // the room's floor: the lowest of the floor tops under the point and 0.8 m round it, within 2 m under it (a 1 x 1
  // floor set up as a shelf is not the floor)
  const inside = (x, z, y) => {
    const ft = floorTop(x, z, y);
    if (ft == null || !roofed(x, z, Math.max(y, ft + 1.2))) return null;
    let lo = ft;
    for (const [dx, dz] of [[0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8]]) { const t = floorTop(x + dx, z + dz, y); if (t != null && t < lo && t > y - 2) lo = t; }
    return lo;
  };
  const top = (j, x, z) => { const t = bx[j].sol ? SH.topAt(bx[j].sol, x, z) : null; return t != null ? t : covers(j, x, z) ? bx[j].y1 : null; };
  const isStand = n => n === 'itemstand' || n === 'itemstandh';
  // the anchors inside, to count how many carry a stand
  const inst = {};
  const mark = (k, j) => { (inst[k] = inst[k] || new Map()).set(j, 0); };
  ps.forEach((p, j) => {
    const n = p.name, r = role(j);
    if (!(r === 'table' || r === 'seat' || r === 'storage' || r === 'window' || r === 'bed' || r === 'fire' || r === 'craft' || WINDOWISH(p))) return;
    const cx = (bx[j].x0 + bx[j].x1) / 2, cz = (bx[j].z0 + bx[j].z1) / 2;
    if (inside(cx, cz, bx[j].y0 + 0.1) == null) return;
    const k = WORK.test(n) ? 'workbench' : r === 'table' ? (area(bx[j]) < 1.0 ? 'sidetable' : 'table') : r === 'seat' ? (/bench|sofa/i.test(n) ? 'bench' : 'seat')
      : r === 'storage' ? 'chest' : r === 'bed' || BED.test(n) ? 'bed' : r === 'fire' || FIRE.test(n) ? 'fire' : WINDOWISH(p) ? 'window' : null;
    if (k) mark(k, j);
  });
  const standIdx = [];
  ps.forEach((p, i) => { if (isStand(p.name)) standIdx.push(i); });
  const recs = [];
  for (const i of standIdx) {
    const p = ps[i], kind = p.name;
    const item = (p.info || '').replace(/^"|"$/g, '').split(':')[0].trim();
    const ft = inside(p.x, p.z, p.y + 0.05);
    S.standsAll++;
    if (ft == null) continue;
    S.stands[kind]++;
    if (!item) { S.empty[kind]++; continue; }
    const q = p.q;
    // the stand's own axes in the world
    const rot = v => { const [x, y, z, w] = q, ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
      return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x]; };
    const up = rot([0, 1, 0]), fwd = rot([0, 0, 1]);
    const tilt = up[1] > 0.9 ? 'upright' : up[1] < -0.9 ? 'upside' : Math.abs(up[1]) < 0.3 ? 'side' : 'leaning';
    inc(S.tilt[kind], tilt);
    const h = +(p.y - ft).toFixed(2);
    let anchor = 'none', at = null, sub = null;
    if (kind === 'itemstandh') {
      // what is under it: the highest top within 12 cm under the stand's foot
      let best = null, bt = -Infinity;
      for (const j of around(p.x, p.z, 0.02, p.y - 0.3, p.y + 0.1)) {
        if (j === i || bx[j].pass) continue;
        const t = top(j, p.x, p.z);
        if (t == null || t > p.y + 0.3 || t < p.y - 0.14) continue;
        if (t > bt) { bt = t; best = j; }
      }
      // a stand sunk into what it stands on shows only its item (the stand hidden in a table top)
      if (best != null) add(S.sinks, 'h', +(bt - p.y).toFixed(3));
      // a window just over it
      const win = around(p.x, p.z, 0.7, p.y, p.y + 0.6).find(j => WINDOWISH(ps[j]) && bx[j].y0 >= p.y - 0.15 && bx[j].y0 <= p.y + 0.5 && covers(j, p.x, p.z, 0.45));
      const fire = around(p.x, p.z, 1.6, ft - 0.2, ft + 0.6).find(j => FIRE.test(ps[j].name) || role(j) === 'fire');
      if (best != null) {
        const n = ps[best].name, r = role(best);
        at = best;
        if (isStand(n)) anchor = 'stand';
        else if (WORK.test(n)) anchor = 'workbench';
        else if (r === 'table' || TABLE.test(n)) anchor = area(bx[best]) < 1.0 ? 'sidetable' : 'table';
        else if (r === 'seat' || SEAT.test(n)) anchor = 'bench';
        else if (r === 'storage' || STORE.test(n)) anchor = 'chest';
        else if (r === 'bed') anchor = 'bed';
        else if (win != null && h > 0.5 && h < 1.7) anchor = 'sill';
        else if (fire != null && h > 0.8 && h < 2.4 && r !== 'floor') anchor = 'mantel';
        else if (r === 'floor' && h < 0.12) anchor = 'floor';
        else if (/ledge|shelf/.test(n)) anchor = 'shelf';
        else if (r === 'beam' || r === 'pole' || r === 'floor' || /beam|pole|log|ledge/.test(n)) anchor = h >= 2.3 ? 'rafter' : h >= 0.9 ? 'shelf' : 'ledge';
        else if (r === 'wall' || r === 'window') anchor = h < 1.6 ? 'counter' : 'walltop';
        else if (r === 'stair') anchor = 'stair';
        else if (r === 'fire') anchor = 'mantel';
        else anchor = 'other';
        sub = n;
      } else if (tilt === 'upside') anchor = 'hung';
      else if (tilt === 'side') anchor = 'wallside';
      if (anchor === 'none') { let nb = null, g = Infinity; for (const j of around(p.x, p.z, 0.3, p.y - 0.8, p.y + 0.3)) { if (j === i) continue; const d = Math.abs(bx[j].y1 - p.y); if (d < g) { g = d; nb = j; } } inc(S.dbg, nb == null ? 'none:nothing' : `none:${ps[nb].name}:${g < 0.2 ? 'near' : 'far'}`); }
    } else {
      // a wall stand: what is behind it (the side its back faces, or the nearer of the two)
      const back = s => { const x = p.x - fwd[0] * s, y = p.y - fwd[1] * s, z = p.z - fwd[2] * s; return around(x, z, 0.02, y - 0.02, y + 0.02).filter(j => j !== i && !bx[j].pass && !isStand(ps[j].name) && (bx[j].sol ? bx[j].sol.some(o => SH.inside(o, x, y, z, 0.01)) : covers(j, x, z))); };
      let behind = null, side = 0;
      for (const s of [0.05, 0.1, 0.18, 0.3, -0.05, -0.1, -0.18, -0.3]) { const b = back(s); if (b.length) { behind = b[0]; side = s; break; } }
      if (Math.abs(fwd[1]) > 0.7) { anchor = fwd[1] < 0 ? 'ceiling' : 'laid'; sub = behind != null ? ps[behind].name : null; }
      else if (behind == null) { anchor = 'free'; const nb = around(p.x, p.z, 0.5, p.y - 0.4, p.y + 0.4).filter(j => j !== i && !bx[j].pass)[0]; inc(S.dbg, nb == null ? 'free:nothing' : `free:${ps[nb].name}`); }
      else {
        const r = role(behind), n = ps[behind].name;
        sub = n;
        S.clips[kind] = S.clips[kind] || [];
        const dep = SH.clipDepth(SH.world(p), bx[behind].sol);
        S.clips[kind].push(+dep.toFixed(3));
        if (r === 'beam' || r === 'pole' || /beam|pole|log/.test(n)) anchor = h >= 2.3 ? 'rafter' : 'beam';
        else if (r === 'storage') anchor = 'chestside';
        else if (r === 'table' || r === 'seat' || r === 'craft' || WORK.test(n)) anchor = 'furnside';
        else {
          // what stands under it on the floor, in front, within reach
          const ox = p.x + fwd[0] * 0.5 * Math.sign(side || 1), oz = p.z + fwd[2] * 0.5 * Math.sign(side || 1);
          const under = around(ox, oz, 0.9, ft - 0.1, p.y - 0.1).filter(j => j !== i && bx[j].y0 < ft + 0.4);
          const has = test => under.find(j => test(ps[j].name, role(j)));
          const door = around(p.x, p.z, 1.3, ft, ft + 2).find(j => role(j) === 'door');
          let k;
          if ((k = has((n2, r2) => WORK.test(n2))) != null) anchor = 'wall:workbench';
          else if ((k = has((n2, r2) => r2 === 'table')) != null) anchor = 'wall:table';
          else if ((k = has((n2, r2) => r2 === 'seat' && /bench|sofa/i.test(n2))) != null) anchor = 'wall:bench';
          else if ((k = has((n2, r2) => r2 === 'bed' || BED.test(n2))) != null) anchor = 'wall:bed';
          else if ((k = around(p.x, p.z, 2.2, ft - 0.2, ft + 0.6).find(j => FIRE.test(ps[j].name) || role(j) === 'fire')) != null) anchor = 'wall:hearth';
          else if ((k = has((n2, r2) => r2 === 'storage')) != null) anchor = 'wall:chest';
          else if (door != null) anchor = 'wall:door';
          else anchor = 'wall';
          if (k != null) at = k;
        }
      }
    }
    inc(S.anchors[kind], anchor);
    const kd = kindOf(item);
    inc(S.items[kind], item);
    (S.itemBuilds[item] = S.itemBuilds[item] || new Set()).add(build);
    inc(S.kinds[kind], kd);
    S.anchorKinds[`${kind}|${anchor}`] = S.anchorKinds[`${kind}|${anchor}`] || {};
    inc(S.anchorKinds[`${kind}|${anchor}`], kd);
    add(S.heights, `${kind}|${anchor}`, h);
    if (kind === 'itemstandh' && at != null) {
      // the turn against the anchor, in 15 degree steps
      const ay = yawOf(ps[at].q) * 180 / Math.PI;
      const sy = Math.atan2(fwd[0], fwd[2]) * 180 / Math.PI, d = (((sy - ay) % 90) + 90) % 90;
      inc(S.turn, `${anchor}|${Math.round(d / 15) * 15}`);
    }
    // a mark on the anchor
    if (at != null) for (const k of Object.keys(inst)) if (inst[k].has(at)) inst[k].set(at, inst[k].get(at) + 1);
    if (anchor === 'sill') { const w = around(p.x, p.z, 0.7, p.y, p.y + 0.6).find(j => WINDOWISH(ps[j]) && inst.window && inst.window.has(j)); if (w != null) inst.window.set(w, inst.window.get(w) + 1); }
    if (anchor === 'mantel' || anchor === 'wall:hearth') { const fj = around(p.x, p.z, 2.2, ft - 0.2, ft + 0.6).find(j => inst.fire && inst.fire.has(j)); if (fj != null) inst.fire.set(fj, inst.fire.get(fj) + 1); }
    recs.push({ i, kind, item, kd, anchor, at, h, ft, sub });
  }
  // feasts and loose food
  ps.forEach((p, i) => {
    const isFeast = /^Feast[A-Z]/.test(p.name), loose = ITEMDROP(p.name);
    if (!isFeast && !loose) return;
    const ft = inside(p.x, p.z, p.y + 0.05);
    if (ft == null) return;
    let best = null, bt = -Infinity;
    for (const j of around(p.x, p.z, 0.02, p.y - 0.3, p.y + 0.1)) { if (j === i || bx[j].pass) continue; const t = top(j, p.x, p.z); if (t == null || t > p.y + 0.08 || t < p.y - 0.16) continue; if (t > bt) { bt = t; best = j; } }
    const on = best == null ? 'none' : WORK.test(ps[best].name) ? 'workbench' : role(best) === 'table' ? (area(bx[best]) < 1 ? 'sidetable' : 'table') : role(best) === 'floor' && p.y - ft < 0.12 ? 'floor' : role(best) === 'storage' ? 'chest' : role(best);
    if (isFeast) {
      S.feasts.n++; S.feasts.builds.add(build); inc(S.feasts.names, p.name); inc(S.feasts.on, on);
      for (const j of around(p.x, p.z, 1.6, p.y - 0.3, p.y + 0.8)) if (j !== i && !OVER.has(role(j)) && !['wall', 'beam', 'pole'].includes(role(j))) inc(S.feasts.near, ps[j].name);
      if (best != null && role(best) === 'table') {
        const t = ps[best], a = Math.atan2(2 * (t.q[3] * t.q[1] + t.q[0] * t.q[2]), 1 - 2 * (t.q[1] ** 2 + t.q[2] ** 2)), c = Math.cos(a), s = Math.sin(a);
        const dx = p.x - t.x, dz = p.z - t.z;
        S.feasts.at.push({ t: t.name, x: +(dx * c - dz * s).toFixed(2), z: +(dx * s + dz * c).toFixed(2), b: build });
      }
    } else { S.loose.n++; inc(S.loose.names, p.name); inc(S.loose.on, on); }
  });
  // groups: stands within 0.9 m of each other
  const par = recs.map((_, k) => k), find = k => (par[k] === k ? k : (par[k] = find(par[k])));
  for (let a = 0; a < recs.length; a++) for (let b = a + 1; b < recs.length; b++) {
    const A = ps[recs[a].i], B = ps[recs[b].i];
    if (Math.hypot(A.x - B.x, A.y - B.y, A.z - B.z) < 0.9) par[find(a)] = find(b);
  }
  const G = new Map();
  recs.forEach((r, k) => { const g = find(k); if (!G.has(g)) G.set(g, []); G.get(g).push(r); });
  for (const g of G.values()) {
    const n = g.length, sz = n >= 6 ? '6+' : String(n);
    inc(S.groups.sizes, sz);
    const an = g[0].kind === 'itemstand' ? g[0].anchor : g[0].anchor;
    (S.groups.anchors[an] = S.groups.anchors[an] || {})[sz] = ((S.groups.anchors[an] || {})[sz] || 0) + 1;
    if (n >= 2) inc(S.groups.combos, `${an}: ${g.map(r => r.kd).sort().join('+')}`);
    // exemplars: groups of two to six on one anchor, in its frame
    if (n >= 2 && n <= 6 && g.every(r => r.at === g[0].at && r.at != null) && meta.dls >= 0) {
      const t = ps[g[0].at], a = Math.atan2(2 * (t.q[3] * t.q[1] + t.q[0] * t.q[2]), 1 - 2 * (t.q[1] ** 2 + t.q[2] ** 2)), c = Math.cos(a), s = Math.sin(a);
      S.ex.push({ b: build, dls: +meta.dls || 0, an, of: t.name, m: g.map(r => { const p = ps[r.i], dx = p.x - t.x, dz = p.z - t.z, sy = Math.atan2(2 * (p.q[3] * p.q[1] + p.q[0] * p.q[2]), 1 - 2 * (p.q[1] ** 2 + p.q[2] ** 2));
        return [r.kind === 'itemstand' ? 'v' : 'h', r.kd, r.item, +(dx * c - dz * s).toFixed(2), +(p.y - t.y).toFixed(2), +(dx * s + dz * c).toFixed(2), Math.round(((sy - a) * 180 / Math.PI % 360 + 360) % 360)]; }) });
    }
  }
  // the spacing of wall stands along one wall: the gap to the nearest other wall stand at about the same height
  const wall = recs.filter(r => r.kind === 'itemstand' && /^wall/.test(r.anchor));
  for (const r of wall) {
    let d = Infinity;
    for (const o of wall) if (o !== r && Math.abs(ps[o.i].y - ps[r.i].y) < 0.3) d = Math.min(d, Math.hypot(ps[o.i].x - ps[r.i].x, ps[o.i].z - ps[r.i].z));
    if (d < 6) S.wallGap.push(+d.toFixed(2));
  }
  for (const [k, m] of Object.entries(inst)) { const o = S.inst[k] = S.inst[k] || { n: 0, with: 0 }; o.n += m.size; for (const v of m.values()) if (v > 0) o.with++; }
  if (Object.keys(inst).length) {
    S.interiors++;
    const an = new Set(recs.map(r => r.anchor)), cnt = k => (inst[k] ? inst[k].size : 0), wi = k => (inst[k] ? [...inst[k].values()].filter(v => v > 0).length : 0);
    S.rooms.push({ b: build, cat: meta.cat, n: recs.length, distinct: new Set(recs.map(r => r.item)).size, an: [...an], tables: cnt('table') + cnt('sidetable'), tablesW: wi('table') + wi('sidetable'),
      windows: cnt('window'), benches: cnt('bench') + cnt('seat'), work: cnt('workbench'), feasts: ps.filter(p => /^Feast[A-Z]/.test(p.name)).length });
  }
  if (recs.length) {
    S.withStands++;
    const floor = ps.reduce((s, p, j) => s + (role(j) === 'floor' ? area(bx[j]) : 0), 0);
    S.perBuild.push({ b: build, cat: meta.cat, dls: +meta.dls || 0, n: recs.length, distinct: new Set(recs.map(r => r.item)).size, floor: Math.round(floor),
      h: recs.filter(r => r.kind === 'itemstandh').length, kinds: [...new Set(recs.map(r => r.kd))].length });
  }
  return recs;
}

function main() {
const S = newStats();
for (const f of files) {
  S.builds++;
  let bp;
  try { bp = BP.parse(fs.readFileSync(f, 'utf8')); } catch (e) { continue; }
  if (bp.pieces.length < 20 || bp.pieces.some(p => MOD.test(p.name))) continue;
  S.vanilla++;
  scan(bp.pieces, path.basename(f, '.blueprint'), metaOf(f), S);
}
// ---------------------------------------------------------------- summary
const q = (a, f) => { if (!a || !a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
const quart = a => a && a.length ? [q(a, 0.1), q(a, 0.25), q(a, 0.5), q(a, 0.75), q(a, 0.9), a.length] : null;
const top = (o, n) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n));
const res = {
  about: 'Item stands in the vanilla corpus builds (lab/mine_stands.js): items per stand kind, anchors, heights, groups, the share of each anchor that carries a stand, feasts.',
  builds: S.builds, vanilla: S.vanilla, interiors: S.interiors, withStands: S.withStands, standsAll: S.standsAll, stands: S.stands, empty: S.empty,
  kinds: S.kinds, anchors: S.anchors, tilt: S.tilt,
  items: { itemstand: top(S.items.itemstand, 160), itemstandh: top(S.items.itemstandh, 200) },
  itemBuilds: Object.fromEntries(Object.entries(S.itemBuilds).map(([k, v]) => [k, v.size]).sort((a, b) => b[1] - a[1]).slice(0, 260)),
  anchorKinds: S.anchorKinds,
  heights: Object.fromEntries(Object.entries(S.heights).map(([k, v]) => [k, quart(v)])),
  clips: Object.fromEntries(Object.entries(S.clips).map(([k, v]) => [k, quart(v)])),
  turn: S.turn, wallGap: quart(S.wallGap),
  inst: Object.fromEntries(Object.entries(S.inst).map(([k, v]) => [k, { ...v, share: +(v.with / Math.max(1, v.n)).toFixed(3) }])),
  groups: { sizes: S.groups.sizes, anchors: S.groups.anchors, combos: top(S.groups.combos, 80) },
  perBuild: { n: S.perBuild.length, stands: quart(S.perBuild.map(b => b.n)), distinct: quart(S.perBuild.map(b => b.distinct)), kinds: quart(S.perBuild.map(b => b.kinds)),
    per100m2: quart(S.perBuild.filter(b => b.floor > 20).map(b => +(100 * b.n / b.floor).toFixed(1))),
    byCat: Object.fromEntries([...new Set(S.perBuild.map(b => b.cat))].map(c => { const L = S.perBuild.filter(b => b.cat === c); return [c, { n: L.length, distinct: q(L.map(b => b.distinct), 0.5), stands: q(L.map(b => b.n), 0.5) }]; })),
    top: S.perBuild.sort((a, b) => b.dls - a.dls).slice(0, 40).map(b => [b.b, b.dls, b.n, b.distinct]) },
  feasts: { n: S.feasts.n, builds: S.feasts.builds.size, names: S.feasts.names, on: S.feasts.on, near: top(S.feasts.near, 30), at: S.feasts.at.slice(0, 60) },
  loose: { n: S.loose.n, names: top(S.loose.names, 40), on: S.loose.on },
  ex: S.ex.sort((a, b) => b.dls - a.dls),
  dbg: top(S.dbg, 40),
  rooms: S.rooms,
  sinks: Object.fromEntries(Object.entries(S.sinks).map(([k, v]) => [k, [quart(v), v.filter(x => x > 0.06).length]])),
};
fs.writeFileSync(out, JSON.stringify(res));
console.log(`${S.vanilla} vanilla of ${S.builds}; ${S.withStands} with stands inside; stands ${JSON.stringify(S.stands)}; ${S.ex.length} exemplar groups; ${S.feasts.n} feasts`);
}
if (require.main === module) main();
module.exports = { scan, newStats, kindOf };
