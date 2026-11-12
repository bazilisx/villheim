// Villheim building program: one plan of intent per building (and per village) that the shell, the details and the
// interior follow, so a feature is chosen once and applied to every place it belongs (D-167). Track H of the showcase
// review; the study and every number are in docs/ARCHITECTURE_STUDY.md, the data in data/architecture/rules.json.
//
//   const Program = require('./program.js');
//   const V = Program.village({ cultureKey, biome, seed });                       // shared vernacular (optional)
//   const prog = Program.plan({ cultureKey, type, stage, decor, biome, seed, storeys, persona, village: V, kit });
//   Program.run(prog, { side, storey })        -> the window family of one run: { features, fill, pieces, why }
//   Program.window(prog, { side, storey, room, byDoor }) -> the run's family, or the run's family plus one reasoned
//                                                         exception for the room behind: { ...family, exception }
//   Program.door(prog, { main })               -> { rank, dressing }
//   Program.room(prog, room)                   -> one feature program per room for the interior (light, woods, fabrics)
//   Program.check(prog, windows)               -> faults: lone features without a reason, runs with mixed treatments
//
// side: 'front' (the main door's wall), 'back', 'side', 'gable' (a loft or gable window), 'court' (a courtyard face).
// storey: 0 for the ground floor. room: { kind } with kinds as lib/decorate.js names them (kitchen, sleeping, hall,
// storage, workshop, ...). Everything is drawn from the building's own make (culture, type, seed, household), never
// from the random stream the generator uses, so the program is the same at every decor stage and can be asked again.
//
// Rules, in short (each with its corpus number in rules.json):
//   - a run (the windows of one wall, one storey) carries one treatment: every window or none (corpus 67 % of runs
//     uniform in their built treatment against 29 % if the same windows were dealt at random), with one piece per
//     feature along the run (95 to 99 % of full runs)
//   - the front is chosen first; the other sides take the front family whole at 47 %, else its built frame only
//   - an upper storey keeps the family below at 52 %, else its built frame only; a gable or tower top is its own run
//   - an exception is one window per run at most and needs the room behind it (kitchen, hall, storage, bedroom) or
//     the door beside it
//   - planters are a household trait capped at 10 % of a village's windows (D-165)
//   - one main door, one roof material, heavy walls under light ones with the change at a plinth or floor line, corner
//     posts all, none or the entry side's, carved heads in pairs, one light kind and one wood family per household
const NODE_PR = typeof module !== 'undefined';
let RULES = null;
function rules() {
  if (RULES) return RULES;
  if (NODE_PR) { try { RULES = require('../data/architecture/rules.json'); } catch (e) { RULES = null; } }
  if (!RULES && typeof window !== 'undefined' && window.VH_ARCH) RULES = window.VH_ARCH;
  return RULES || { windows: { adopt: { byGroup: {} }, sides: {}, upper: {} }, exceptions: { rules: [] } };
}

// the generator's cultures to the corpus groups the window counts come from (lib/decorate.js CULT_GROUP, kept in step)
const GROUP = { norse: 'norse', 'anglo-saxon': 'medieval-timber', 'frankish-norman': 'medieval-timber', 'norse-forest': 'norse-forest',
  celtic: 'medieval-timber', slavic: 'norse-forest', 'celtic-crannog': 'norse-forest', baltic: 'norse-forest', 'fen-folk': 'norse-forest',
  'norse-highland': 'norse-highland', saami: 'norse-highland', byzantine: 'castle', steppe: 'all', lamari: 'fantasy', 'middle-eastern': 'all',
  'black-forest': 'norse-forest', swamp: 'norse-forest', mountain: 'norse-highland', 'east-asian': 'east-asian', 'castle-medieval': 'castle',
  dwarven: 'fantasy', ashlands: 'ashlands' };
// what each culture builds round a window when it builds anything (CULTURE_STYLES.md and the vernacular sources in
// ARCHITECTURE_STUDY.md); the corpus shares above say how often. A culture never takes a feature off its list.
const PALETTE = {
  norse: ['posts', 'brace', 'sill', 'hood', 'head', 'shutter'], 'norse-forest': ['posts', 'brace', 'hood', 'sill', 'head', 'shutter'],
  'norse-highland': ['posts', 'sill', 'brace', 'head', 'shutter'], 'anglo-saxon': ['posts', 'sill', 'brace', 'shutter'],
  'frankish-norman': ['posts', 'sill', 'head', 'brace', 'shutter', 'arch'], celtic: ['posts', 'sill', 'shutter'],
  'celtic-crannog': ['posts', 'sill'], slavic: ['posts', 'sill', 'head', 'shutter', 'brace'], baltic: ['posts', 'sill', 'head', 'shutter'],
  'fen-folk': ['posts', 'sill', 'hood'], saami: ['posts'], byzantine: ['arch', 'sill', 'head'], 'middle-eastern': ['arch', 'sill'],
  steppe: ['posts'], lamari: ['posts', 'arch', 'sill', 'head'], 'castle-medieval': ['arch', 'sill', 'head', 'posts'],
  'east-asian': ['posts', 'sill', 'head', 'hood'], dwarven: ['posts', 'sill', 'head', 'arch'],
};
// cultures whose street walls stay plain and whose rich faces look onto a court (Syrian courtyard houses, Muslim
// Heritage; CULTURE_STYLES.md middle-eastern): the program gives their outer sides the built frame only
const INWARD = new Set(['middle-eastern']);
// the share of buildings laid out formally (symmetric about the main door, 0.8 or more of the shell mirrored), by kind
// (corpus-grammar.json symmetry.byKind); formal cultures lean further that way
const FORMAL_CULT = { byzantine: 1.5, 'castle-medieval': 1.3, 'middle-eastern': 1.3, lamari: 1.2, steppe: 0.6, saami: 0.5, 'fen-folk': 0.7, 'celtic-crannog': 0.7 };

const STRUCT = new Set(['posts', 'brace', 'arch', 'shutter']);

function hashPR(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
// a number 0 to 1 from the program's make and a key
function u(prog, key) {
  let x = (prog.hash ^ 0x9e3779b9) >>> 0;
  const s = String(key);
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
  x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12; x = Math.imul(x, 0x297a2d39); x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
}
const pickWPR = (v, list) => { const t = list.reduce((s, x) => s + x[1], 0); let x = v * t; for (const [k, w] of list) { x -= w; if (x <= 0) return k; } return list[list.length - 1][0]; };
const sN = st => +String(st || 's1')[1] || 1, dN = d => +String(d || 'd1')[1] || 1;

// ---------------------------------------------------------------- village

// The shared vernacular: one window family, one roof material and one corner treatment that most buildings of the
// village keep, with room for variation. Corpus builds of three or more buildings: the lead wall material on 80 % of
// the buildings (p50), the lead roof material on 100 %, the lead roof slope on 88 %, all three together on 67 %
// (corpus-grammar.json village). So about one building in three changes one thing, and the program lets a building
// break from the village's window family at that share.
function village(ctx) {
  const v = { cultureKey: ctx.cultureKey, biome: ctx.biome, seed: ctx.seed, hash: hashPR(`${ctx.cultureKey}|${ctx.biome}|${ctx.seed}|village`) };
  v.base = baseFamily(v, ctx.cultureKey, 'village');
  v.corners = pickWPR(u(v, 'corners'), cornerModes());
  v.vary = 0.33;
  v.planterCap = (rules().windows || {}).planterCap || 0.10;
  v.planterWindows = 0; v.windows = 0; // counters a village planner may keep as it places buildings
  return v;
}

function cornerModes() {
  const c = (rules().trim || {}).corners || { all: 0.28, none: 0.23, mixed: 0.48 };
  return [['all', c.all], ['none', c.none], ['entry', c.mixed]];
}

// a front family from the culture's palette at the corpus shares of its group
function baseFamily(prog, cultureKey, salt) {
  const R = rules(), by = (R.windows.adopt || {}).byGroup || {};
  const g = by[GROUP[cultureKey] || 'all'] || by.all || { windowShare: {} }, all = by.all || g;
  // a small group counts for less: blended with the whole corpus by builds / (builds + 40), as lib/decorate.js does
  const l = g.builds ? g.builds / (g.builds + 40) : 0;
  const share = k => l * ((g.windowShare || {})[k] || 0) + (1 - l) * ((all.windowShare || {})[k] || 0);
  const pal = PALETTE[cultureKey] || ['posts', 'sill'];
  // the share is of windows; a front run carries a feature whole, and the front is the richer side in 37 % of
  // buildings against 28 % poorer (corpus-facades.json sides), so the front takes it at about 1.3 times that share
  const feats = pal.filter(k => u(prog, `${salt}|${k}`) < Math.min(0.9, share(k) * 1.3));
  // every built window has at least its frame: the culture's first frame feature when the draw left it bare
  if (!feats.some(k => STRUCT.has(k)) && u(prog, `${salt}|frame`) < 0.7) feats.unshift(pal[0]);
  const fills = [['open', share('fill:open') || 0.85], ['bars', share('fill:bars')], ['glass', share('fill:glass')], ['closed', share('fill:closed')]];
  return { features: feats, fill: pickWPR(u(prog, `${salt}|fill`), fills.filter(x => x[1] > 0)) };
}

// ---------------------------------------------------------------- building

function plan(ctx) {
  const R = rules();
  const P = ctx.persona || {}, V = ctx.village || null;
  const prog = { cultureKey: ctx.cultureKey, type: ctx.type, stage: sN(ctx.stage), decor: dN(ctx.decor), biome: ctx.biome, storeys: ctx.storeys || 1,
    persona: P, village: V, kit: ctx.kit || {}, why: [] };
  prog.hash = hashPR(`${ctx.cultureKey}|${ctx.type}|${ctx.biome}|${ctx.seed}|${P.salt || 0}|program`);
  // the front family: the village's, or the building's own at the village's variation share (or with no village)
  const own = baseFamily(prog, ctx.cultureKey, 'front');
  const fromVillage = V && V.base && u(prog, 'vary') >= (V.vary || 0.33);
  prog.front = fromVillage ? { features: [...V.base.features], fill: V.base.fill } : own;
  prog.why.push(fromVillage ? 'Windows: the village family.' : 'Windows: this building\'s own family.');
  // early stages build plainer: s1 keeps the frame features only
  if (prog.stage < 2) prog.front.features = prog.front.features.filter(k => STRUCT.has(k));
  // a tidy, well-off household dresses a little more (hood, head) on the front; an austere one drops the decor
  if ((P.likes && P.likes.banners < 0.5) || P.plain) prog.front.features = prog.front.features.filter(k => STRUCT.has(k));
  // planters: a household trait (D-165), the whole front ground run, inside the village cap
  const plants = ((P.hobby && P.hobby.plants) || 1) * ((P.likes && P.likes.sill) || 1);
  prog.planters = prog.decor >= 2 && plants >= 1.5 && u(prog, 'planters') < Math.min(0.6, (plants - 1) * 0.5) && !(V && V.windows > 20 && V.planterWindows / V.windows >= V.planterCap);
  if (prog.planters) prog.why.push('Planters under the front ground-floor windows: a household that grows plants.');
  // the other sides: the front family whole, or its built frame only (corpus 47 % the same)
  const same = (R.windows.sides || {}).sameAsFront != null ? R.windows.sides.sameAsFront : 0.47;
  prog.sidesSame = !INWARD.has(ctx.cultureKey) && u(prog, 'sides') < same;
  const up = (R.windows.upper || {}).sameAsBelow != null ? R.windows.upper.sameAsBelow : 0.52;
  prog.upperSame = u(prog, 'upper') < up;
  // formal or free: symmetric about the main door
  const fk = ((R.symmetry || {}).byKind || {})[ctx.type === 'home' ? 'home' : ctx.type] || (R.symmetry || {}).formal || 0.37;
  prog.formal = u(prog, 'formal') < Math.min(0.9, fk * (FORMAL_CULT[ctx.cultureKey] || 1));
  if (prog.formal) prog.why.push('Formal front: windows mirrored about the main door, the door on the middle bay.');
  // the pieces each feature uses, one per building (one piece on every window of a full run in 95 to 99 % of runs)
  const K = prog.kit;
  prog.pieces = { sill: K.beam || 'wood_beam', head: K.beam || 'wood_beam', posts: K.pole1 || 'wood_pole', brace: (K.beam || 'wood_beam').replace(/^wood_beam$/, 'wood_beam_45'),
    hood: K.roof26 || 'wood_roof', shutter: 'wood_window', arch: /stone|marble|grausten/.test(K.wall || '') ? 'stone_arch' : 'darkwood_arch',
    planter: ['Pickable_Dandelion', 'Pickable_Thistle', 'Pickable_Mushroom_yellow', 'Pickable_Fiddlehead'][Math.floor(u(prog, 'plant') * 4)] };
  // trim: corners all, none or the entry side's; the village's mode when there is one; bands on no side or the entry
  prog.corners = V ? V.corners : pickWPR(u(prog, 'corners'), cornerModes());
  const bands = (R.trim || {}).bands || { none: 0.71, some: 0.29 };
  prog.bands = u(prog, 'bands') < bands.none ? 'none' : 'entry';
  prog.cornerPiece = K.pole || 'wood_pole2';
  // carved heads: in pairs on the main ridge's ends or none (86 % twinned), one kind
  prog.ornament = { pairs: true, kind: null };
  // materials: heavy under light, the change at a plinth or a floor line and level all round
  prog.materials = { heavyUnder: true, changeAt: (R.materials && R.materials.changeAt && R.materials.changeAt['floor line'] >= (R.materials.changeAt['plinth (1.5 m or less)'] || 0)) ? ['floor line', 'plinth'] : ['plinth', 'floor line'], allSides: true };
  prog.roof = { oneMaterial: true, secondSlope: u(prog, 'slopes') < ((R.roofs || {}).twoSlopes || 0.45) };
  // the household's interior program (room)
  prog.household = household(prog);
  prog.exceptions = { used: {} };
  return prog;
}

// the window family of one run
function run(prog, { side = 'front', storey = 0 } = {}) {
  if (side === 'gable') return { features: ['posts', 'sill'].filter(k => (PALETTE[prog.cultureKey] || ['posts']).includes(k)), fill: prog.front.fill, pieces: prog.pieces, why: 'a gable or loft window is its own run with its own frame' };
  let f = [...prog.front.features];
  let why = 'the front family';
  const frameOnly = l => l.filter(k => STRUCT.has(k));
  if (side !== 'front' && side !== 'court' && !prog.sidesSame) { f = frameOnly(f); why = 'the front family\'s built frame (the back and sides plainer)'; }
  if (INWARD.has(prog.cultureKey) && side !== 'court') { f = frameOnly(f); why = 'a plain outer wall; the rich face looks onto the court'; }
  if (storey > 0 && !prog.upperSame) { f = frameOnly(f); why += ', the upper storey with the frame only'; }
  if (prog.planters && side === 'front' && storey === 0) f.push('planter');
  return { features: f, fill: prog.front.fill, pieces: prog.pieces, why };
}

// one window: its run's family, and at most one exception with the reason the room behind gives
function windowOf(prog, w = {}) {
  const fam = run(prog, w);
  const kind = w.room && w.room.kind ? normalKind(w.room.kind) : null;
  const P = prog.persona || {};
  for (const r of (rules().exceptions || {}).rules || []) {
    if (r.room && r.room !== kind) continue;
    if (r.at === 'door' && !w.byDoor) continue;
    if (r.at && r.at !== 'door') continue;
    if (fam.features.includes(r.feature) || (r.feature.startsWith('fill:') && fam.fill === r.feature.slice(5))) continue;
    const key = `${r.room || r.at}|${r.feature}`, runKey = `${w.side || 'front'}|${w.line != null ? w.line : ''}|${w.storey || 0}`;
    const used = prog.exceptions.used[key] || 0;
    // one exception per run, and each rule at most its max per building (a whole-run rule counts as one)
    if (prog.exceptions.runs && prog.exceptions.runs.has(runKey)) break;
    if (used >= (r.max === 'run' ? 1 : (r.max || 1))) continue;
    if (!needsMet(prog, r, P)) continue;
    // the exception is a household choice, at about half the corpus share of windows that differ from their run (11 %;
    // the rest of the corpus's odd windows have no room reason the program can read), weighted by how much more often
    // the room kind holds a lone feature (kitchens 1.6, halls 2.2)
    const LB = (rules().exceptions || {}).loneBehind || {};
    const lift = kind && LB[kind] && LB[kind].base ? LB[kind].share / LB[kind].base : 1;
    if (u(prog, `exc|${key}|${w.key || runKey}`) >= Math.min(0.5, ((rules().exceptions || {}).oddShare || 0.11) * 0.5 * lift)) continue;
    prog.exceptions.used[key] = used + 1;
    (prog.exceptions.runs = prog.exceptions.runs || new Set()).add(runKey);
    return { ...fam, exception: { feature: r.feature, reason: r.reason, room: kind } };
  }
  return { ...fam, exception: null };
}
function needsMet(prog, r, P) {
  const n = r.needs || '';
  if (/hobby\.food|hobby\.plants/.test(n)) return ((P.hobby && (P.hobby.food || 0)) >= 1.2) || ((P.hobby && (P.hobby.plants || 0)) >= 1.2);
  if (/decor d2/.test(n)) return prog.decor >= 2;
  if (/decor d3/.test(n)) return prog.decor >= 3;
  if (/shutters/.test(n)) return (PALETTE[prog.cultureKey] || []).includes('shutter');
  if (/roof26/.test(n)) return true; // every kit has a 26 degree roof piece
  if (/iron/.test(n)) return ['Swamp', 'Mountain', 'Plains', 'Mistlands', 'Ashlands', 'Deep North'].includes(prog.biome);
  return true;
}
const normalKind = k => (/kitchen|cook/.test(k) ? 'kitchen' : /sleep|bed|guest/.test(k) ? 'bedroom' : /hall|tavern|dining/.test(k) ? 'hall' : /stor|pantry|larder/.test(k) ? 'storage' : /work|smith|forge|craft/.test(k) ? 'workshop' : k);

// doors: one main door, the richest; the others carry the frame only
function door(prog, { main = false } = {}) {
  if (!main) return { rank: 'secondary', dressing: ['frame'] };
  const P = prog.persona || {};
  const opts = [['hood', 1], ['lamps', prog.decor >= 2 ? 1 : 0], ['banners', prog.decor >= 3 && (!P.likes || (P.likes.banners || 1) >= 1) ? 0.8 : 0]].filter(x => x[1] > 0);
  const extra = opts.length ? pickWPR(u(prog, 'door'), opts) : null;
  return { rank: 'main', dressing: ['frame', 'step', ...(extra ? [extra] : [])] };
}

// ---------------------------------------------------------------- interiors

// One program per household and per room (track E). Corpus (corpus-room-programs.json): a room takes its build's lead
// light kind in 69 % of rooms against 34 % for rooms drawn at random, banners 74 % against 32 %, drapes 75 % against
// 55 %, rugs 61 % against 36 %, the furniture family 66 % against 45 %. Within a room: one light kind in 62 % of rooms
// with two or more lights, one drape kind in 79 %, one rug kind in 46 %, one furniture family in 44 % (two in most of
// the rest; ROOM_STUDY.md section 4 for the pairs that go together).
function household(prog) {
  const R = rules(), ch = ((R.rooms || {}).channels) || {};
  const take = c => (ch[c] && ch[c].roomTakesBuildLead) || 0.65;
  return { light: { lead: null, keep: take('light'), oneInRoom: (ch.light || {}).oneKindInRoom || 0.62 },
    banner: { lead: null, keep: take('banner'), oneInRoom: (ch.banner || {}).oneKindInRoom || 0.69 },
    rug: { lead: null, keep: take('rug'), oneInRoom: (ch.rug || {}).oneKindInRoom || 0.46 },
    drape: { lead: null, keep: take('drape'), oneInRoom: (ch.drape || {}).oneKindInRoom || 0.79 },
    wood: { lead: null, keep: take('wood'), oneInRoom: (ch.wood || {}).oneKindInRoom || 0.44 } };
}
// room: { kind, key } -> per channel: 'lead' (use the household's lead kind), or 'own' (this room picks its own kind
// with a reason from its purpose), and whether a second kind may join the lead in this room. The interior owner fills
// the lead kinds (Program.setLead) from the catalog and the culture, once per household.
function room(prog, rm = {}) {
  const H = prog.household, out = {};
  for (const [c, h] of Object.entries(H)) {
    const own = u(prog, `room|${rm.key || rm.kind}|${c}`) >= h.keep;
    out[c] = { use: own ? 'own' : 'lead', lead: h.lead, second: u(prog, `room2|${rm.key || rm.kind}|${c}`) >= h.oneInRoom,
      why: own ? `this room's own ${c} (its purpose: ${rm.kind || 'room'})` : `the household's ${c}` };
  }
  return out;
}
function setLead(prog, channel, kind) { if (prog.household[channel]) prog.household[channel].lead = kind; return prog; }

// ---------------------------------------------------------------- check

// windows: [{ side, storey, line, features: [...], fill, room: { kind }, byDoor }] read from a blueprint (lab/arch_facades.js
// reads them from the corpus the same way). Faults: a run whose windows differ beyond one reasoned exception, a feature
// on one window of a run of three or more with no room reason, planters over the cap.
function check(prog, windows) {
  const runs = new Map(), faults = [];
  for (const w of windows) { const k = `${w.side}|${w.line != null ? w.line : ''}|${w.storey}`; if (!runs.has(k)) runs.set(k, []); runs.get(k).push(w); }
  const sigOf = w => [...(w.features || [])].sort().join('+') + '|' + (w.fill || 'open');
  const reasons = new Set(((rules().exceptions || {}).rules || []).map(r => `${r.room || r.at}|${r.feature}`));
  for (const [k, l] of runs) {
    if (l.length < 2) continue;
    const cnt = {};
    for (const w of l) cnt[sigOf(w)] = (cnt[sigOf(w)] || 0) + 1;
    const [maj] = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    const odd = l.filter(w => sigOf(w) !== maj);
    const majF = new Set(maj.split('|')[0].split('+').filter(Boolean));
    const unreasoned = odd.filter(w => {
      const extra = (w.features || []).filter(f => !majF.has(f)), missing = [...majF].filter(f => !(w.features || []).includes(f));
      const kind = w.room && w.room.kind ? normalKind(w.room.kind) : null;
      const ok = f => (kind && reasons.has(`${kind}|${f}`)) || (w.byDoor && reasons.has(`door|${f}`));
      return missing.length > 0 || extra.some(f => !ok(f)) || extra.length > 1;
    });
    if (odd.length > 1 || unreasoned.length) faults.push({ run: k, kind: unreasoned.length ? (l.length >= 3 && odd.length === 1 ? 'lone feature without a reason' : 'mixed treatments in one run') : 'more than one exception in a run', windows: l.length, odd: odd.length });
  }
  const pl = windows.filter(w => (w.features || []).includes('planter')).length;
  if (windows.length >= 10 && pl / windows.length > ((rules().windows || {}).planterCap || 0.1)) faults.push({ kind: 'planters over the cap', share: +(pl / windows.length).toFixed(3) });
  return faults;
}

const apiPR = { plan, village, run, window: windowOf, door, room, setLead, check, rules, PALETTE, GROUP };
if (NODE_PR) module.exports = apiPR; else window.VHProgram = apiPR;
