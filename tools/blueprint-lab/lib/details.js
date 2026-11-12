// Villheim building details: the trim, framing and small additions that make a generated shell look built by hand.
// Called by generate.js after the walls and roof are up (exterior, partition) and after the furnishing (interior).
//
// Every rule here comes from the corpus (557 well-liked community builds, docs/BLUEPRINT_LAB.md "Details") or from
// Norse building practice (docs/BUILDING_DETAILS.md):
//   - windows: the commonest window is 1 m tall from 1 m up; builders frame it with posts at the sides (27 % of
//     openings have a 2 m pole beside them), a beam under it (sill) and over it, a post in the middle of a 2 m opening
//     (two 1 m lights), and shutters (Wood Shutter, 1 x 1 m) beside it
//   - doors: posts at both sides (34 % of doors), a beam over the door at its top edge and one at its foot, a floor or
//     step in front (43 %), a lamp or torch beside it
//   - corners: 64 % of outside wall corners carry a post (wood pole, log pole, dark wood pole)
//   - walls: beams laid in the wall plane at its foot and at 1 m and 2 m (the timber frame bands)
//   - gables: a 45 or 26 degree beam along each roof edge at the gable end (the bargeboard: the corpus puts it at the
//     roof piece's side edge, turned 90 degrees); crossed boards over the ridge on Norse and Slavic houses
//   - halls: leaning outer posts against the long walls (Ribe, Trelleborg), raised benches along the long walls inside
//   - homes: a bench and a lamp by the door, a kerb round the fire pit, a back room behind a partition in big houses
// Pieces are put with b.put, so the same piece in the same place goes in once only. Trim pieces carry trim: true.

const NODE_D = typeof module !== 'undefined';
const PD = NODE_D ? require('./pieces.js') : window.VHPieces;
const checksD = () => (NODE_D ? require('./checks.js') : window.VHChecks);
const decorDt = () => (NODE_D ? require('./decorate.js') : window.VHDecorate);
// a hung prop or banner with plain wall behind it as the decorator's audit reads it (lib/decorate.js mountClear)
const mountClearD = (b, p) => { const D = decorDt(); return !D || !D.mountClear || D.mountClear(p, b.pieces); };
const MotifsD = NODE_D ? require('./motifs.js') : window.VHMotifs;
const meshDt = () => (NODE_D ? require('./mesh.js') : window.VHMesh);
// How far a wall piece shows past its middle on its fuller side (lib/mesh.js): 0.15 for a flat wall, 0.28 for the
// 2x2 wood wall with its cross bars. What hangs on its face goes at least that far out.
const RELIEF = new Map();
function relief(name) {
  if (RELIEF.has(name)) return RELIEF.get(name);
  const Me = meshDt(), W = Me && Me.world({ name, x: 0, y: 0, z: 0, q: [0, 0, 0, 1] });
  const v = W && W.length ? Math.max(...W.map(o => Math.max(-o.z0, o.z1))) : 0.15;
  RELIEF.set(name, v);
  return v;
}

const normD = a => ((a % 360) + 360) % 360;
const quatD = yaw => { const a = yaw * Math.PI / 360; return [0, +Math.sin(a).toFixed(6), 0, +Math.cos(a).toFixed(6)]; };
const BIOMES_D = ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains', 'Mistlands', 'Ashlands'];
const reachesD = (biome, b) => BIOMES_D.indexOf(biome) >= BIOMES_D.indexOf(b);

// Cultures by the trim they use. Northern timber cultures get the full set; stone and flat-roofed cultures keep their
// own forms and get only the door and window frames.
const NORTH = ['norse', 'norse-forest', 'norse-highland', 'anglo-saxon', 'slavic', 'baltic', 'fen-folk', 'celtic',
  'celtic-crannog', 'frankish-norman', 'black-forest', 'mountain', 'swamp', 'castle-medieval', 'saami'];
const CROSSED = ['norse', 'norse-forest', 'norse-highland', 'slavic', 'baltic', 'black-forest', 'mountain'];
const BRACED = ['norse', 'norse-forest', 'norse-highland', 'anglo-saxon', 'black-forest'];
const SHUTTERS = ['norse', 'norse-forest', 'norse-highland', 'slavic', 'baltic', 'anglo-saxon', 'frankish-norman',
  'celtic', 'fen-folk', 'black-forest', 'mountain', 'swamp', 'castle-medieval'];

function makeHash(ctx) {
  const sig = [ctx.cultureKey, ctx.type, ctx.stage, ctx.decor, ctx.biome, ctx.plan, ctx.F, ctx.storeys, ctx.door && ctx.door.x, ctx.door && ctx.door.z, (ctx.edges || []).length].join('|');
  let h = 2166136261;
  for (let i = 0; i < sig.length; i++) { h ^= sig.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// a number 0 to 1 from the building's make and a key (a feature's place, a choice's name), so these choices draw
// nothing from the random stream the rest of the details use
function unitD(h, key) {
  let x = (h ^ 0x9e3779b9) >>> 0;
  const s = String(key);
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
  x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12; x = Math.imul(x, 0x297a2d39); x ^= x >>> 15;
  return (x >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- trim budget (ideas gap 4)

// The share of each feature the corpus builders dress (data/motifs.json `skipped`: sites with trim over the sites the
// miner could read, 543 well-liked builds; docs/handoffs/2026-11-10-design/ideas.md gap 4): windows 70 %, outside
// corners 77 %, inside corners 78 %. The rest are left bare. The corpus has no split by culture for these.
const DRESS = { window: 0.70, corner: 0.77, icorner: 0.78 };
// One building dresses more or less than the share by its household's tidiness (lib/persona.js tidy, 0 to 1, round
// 0.5) and its village's (ctx.village.tidy when the request carries one; the lab has none). The front facade is dressed
// more than the back and sides, the mean staying at the share.
function trimBudget(ctx) {
  const P = ctx.persona || {}, V = ctx.village || {};
  const t = (P.tidy != null ? P.tidy : 0.5) - 0.5, v = (V.tidy != null ? V.tidy : 0.5) - 0.5;
  const shift = Math.max(-0.2, Math.min(0.2, t * 0.3 + v * 0.2));
  const out = {};
  for (const [k, s] of Object.entries(DRESS)) out[k] = Math.max(0.35, Math.min(1, s + shift));
  return out;
}
// is this feature dressed: kind, a key for its place, front facade or not
function dressed(ctx, kind, key, front) {
  const X = ctx.profile;
  if (!X || !X.trimBudget || X.trimBudget[kind] == null) return true;
  const p = X.trimBudget[kind], q = front == null ? p : front ? Math.min(1, p + 0.15) : Math.max(0, p - 0.06);
  return unitD(X.hash, `${kind}|${key}`) < q;
}

// ---------------------------------------------------------------- banners (ideas gap 5)

// The share of buildings with a banner piece, by corpus culture group (data/culture-corpus/summary.json
// `signs.bannerPiece`, buildings): norse 53 % (455), norse-forest 68 (44), norse-highland 63 (27), medieval-timber 53
// (30), castle 53 (240), mistlands 31 (62). A generator culture whose group has fewer than 20 buildings in the corpus
// takes the share over all 1,619 corpus buildings, 49 %. The corpus counts banners inside and out; the generator's rooms
// carry almost none (generated-measures.json rooms), so these go outside.
const BANNER_SHARE = { norse: 0.53, 'norse-forest': 0.68, 'norse-highland': 0.63, 'anglo-saxon': 0.53, 'frankish-norman': 0.53,
  'castle-medieval': 0.53, lamari: 0.31 };
const BANNER_ALL = 0.49;
// Where corpus builders hang them outside: banner uses in the kept exterior motifs (data/motifs.json): on a plain wall
// bay 64, beside a window 9 (both a wall bay here), by the door 25 (door 9, porch 8, stair entry 8), on a gable 19.
// Corners (23), roof valleys (10), eaves (8), balconies (3) and dormers (2) are not built yet.
const BANNER_SITES = [['face', 73], ['door', 25], ['gable', 19]];
// The banner kinds by their uses in the same motifs. Decor, so every kind in every biome (D-065, D-126).
const BANNER_KINDS = [['piece_banner01', 94], ['piece_banner04', 34], ['piece_banner02', 24], ['piece_banner11', 20], ['piece_banner07', 17],
  ['piece_banner03', 12], ['piece_banner05', 10], ['piece_banner06', 8], ['piece_banner08', 5], ['piece_banner09', 1], ['piece_banner10', 1]];
const pickW = (u, list) => { const tot = list.reduce((t, x) => t + x[1], 0); let x = u * tot; for (const [k, w] of list) { x -= w; if (x <= 0) return k; } return list[list.length - 1][0]; };
// One building's banners: none at d1 (no lamps or carvings there either); from d2 at the culture's share, times the
// household's liking for banners (lib/persona.js likes.banners, round 1) and the village's when there is one. The draw
// leaves out the decor stage, so a building with a banner at d2 keeps one at d3.
function bannerPlan(ctx) {
  const dN = +String(ctx.decor || 'd1')[1];
  if (dN < 2) return null;
  const P = ctx.persona || {}, V = ctx.village || {};
  const h = (makeHash({ ...ctx, decor: '' }) ^ Math.imul((P.salt || 0) + 1, 2654435761)) >>> 0;
  const like = (P.likes && P.likes.banners) || 1, vl = V.banners || 1;
  const share = BANNER_SHARE[ctx.cultureKey] != null ? BANNER_SHARE[ctx.cultureKey] : BANNER_ALL;
  if (unitD(h, 'banner') >= Math.min(0.95, share * like * vl)) return null;
  const site = pickW(unitD(h, 'banner site'), BANNER_SITES);
  // pairs: 5 of the 7 door motifs with banners hang one each side; 4 of 45 wall bays carry two side by side
  const pair = site === 'door' ? unitD(h, 'banner pair') < 5 / 7 : site === 'face' ? unitD(h, 'banner pair') < 4 / 45 : false;
  // the rod 2.95 to 3.55 m over the floor (the corpus banner motifs: 2.9 to 3.6), the cloth's foot 0 to 0.6 m up
  return { site, pair, name: pickW(unitD(h, 'banner kind'), BANNER_KINDS), lift: unitD(h, 'banner lift') * 0.6 };
}

// What a building gets, from its culture, type, size stage (s1 to s3) and decor stage (d1 to d3).
// The top of the walls: the generator's own figure when it gives one (a knee-wall loft's walls stop under a full
// storey), else the storeys times the storey height (storeys track, 2026-11-11).
function wallTopOf(ctx) { return ctx.wallTop != null ? ctx.wallTop : ctx.F + ctx.storeys * ctx.SH; }

function profile(ctx) {
  const { C, cultureKey, T, stage, decor, biome, R } = ctx;
  const sN = +stage[1], dN = +decor[1];
  const north = NORTH.includes(cultureKey);
  const wood = /plank|half-timber|log/.test(C.wallStyle || 'plank');
  const boards = /plank|half-timber/.test(C.wallStyle || 'plank') && !/log/.test(C.wallStyle || ''); // posts and bands read on boards, not on logs
  const roll = p => R() < p;
  const banner = bannerPlan(ctx);
  return {
    sN, dN, north, wood,
    windowFrame: (sN >= 2 || C.frame) && !C.arches,
    mullion: C.winKit ? !C.arches : !C.glass && C.windowStyle !== 'single' && !C.arches, // one centered post, twin lights only
    shutters: !C.winKit && sN >= 2 && dN >= 2 && SHUTTERS.includes(cultureKey) && reachesD(biome, 'Black Forest') && !C.glass && roll(0.6),
    // the window kit's shutters (generate.js windowKit, by culture from the corpus) take the place of the rule above
    shutterKit: !!(C.winKit && C.winKit.fill === 'shutter'),
    doorFrame: !C.arches,
    doorHood: north && sN >= 2 && !C.awnings && roll(0.7) && !C.arches, // never without the frame
    doorstep: true,
    doorLamp: dN >= 2 && !C.arches,
    // log walls keep theirs (log poles) for now: without them the decorator sets chests into the 0.55 m log corners
    cornerPosts: wood && !C.frame && !T.tower,
    bands: boards && sN >= 2 && !C.frame,
    midRail: false, // with the braces and window frames a rail at 1 m made half-timbered walls too busy (2026-11-09 render)
    bargeboards: north && (sN >= 2 || C.carved),
    // the game's Roof Cross is 4 m across: one building in five (from the building's make, so the random stream the
    // rest of the details draw from stays as it was)
    // the crossed boards are a Norse signature (round 3 review missed them): three buildings in five
    crossed: CROSSED.includes(cultureKey) && sN >= 2 && makeHash(ctx) % 5 < 3,
    svalgang: ['norse', 'norse-forest', 'norse-highland', 'slavic', 'baltic'].includes(cultureKey) && ctx.storeys >= 2 &&
      ['home', 'storage', 'tavern'].includes(ctx.type) && (sN >= 3 || (sN === 2 && dN >= 3)) && ['rect', 'long', 'L', 'T'].includes(ctx.plan) &&
      !C.awnings && !ctx.flat && roll(0.75),
    gableWindow: north && sN >= 2,
    rafterTails: north && sN >= 2 && !C.eaves2 && (C.eaves || 1) < 2,
    eaveTrim: north && sN >= 2 && !C.eaves2 && (C.eaves || 1) < 2,
    purlinEnds: false, // a 1 m beam end out past the gable read as a stray stick (2026-11-09 review)
    gableTruss: north && sN >= 2 && roll(0.6),
    gablePorch: north && (sN >= 3 || (sN === 2 && dN >= 3)) && ['home', 'longhouse', 'tavern', 'temple'].includes(ctx.type) && roll(0.5),
    braces: false, // the leaning posts ran from the eaves past the wall foot and across windows (bench review): off until redone
    benchOut: dN >= 2 && ['home', 'hall'].includes(T.use),
    fireKerb: dN >= 2,
    wallBenches: (ctx.type === 'longhouse' || (T.use === 'hall' && ['long', 'rect'].includes(ctx.plan))) && sN >= 2,
    partition: ['home', 'tavern'].includes(ctx.type) && (sN >= 3 || (sN === 2 && dN >= 3)) && ['rect', 'long', 'L', 'T'].includes(ctx.plan),
    // assemblies from the best-liked builds (lib/motifs.js) on windows and doors everywhere, on corners of timber walls,
    // on gables and eaves of the northern cultures; the rules above do whatever no motif fits
    motifs: true,
    motifCorners: wood && !T.tower,
    motifIcorners: true,
    // the foot of the walls from s2, things hung on the plain bays from d2 (D-065), eave trim under the overhang
    motifBase: sN >= 2 && !T.tower,
    motifFaces: dN >= 2,
    eaveMotifs: true,
    // stone walls read blank from the street (review 5): a timber band at each upper floor line, corners in a
    // contrasting material (timber posts on stone, stone pillars on black marble), from s2
    stoneBands: /stone|marble|grausten/.test(C.wallStyle || '') && !/base/.test(C.wallStyle || '') && sN >= 2 && !T.tower,
    stoneCorners: /stone|marble|grausten/.test(C.wallStyle || '') && !/base/.test(C.wallStyle || '') && sN >= 2 && !T.tower,
    // the decor stage shows outside: window boxes with flowers under the front windows from d2, a banner on the gables
    // at d3
    windowBoxes: dN >= 2 && ['home', 'tavern', 'longhouse'].includes(ctx.type) && biome !== 'Ashlands',
    // the trim budget (windows, corners left bare at the corpus shares) and the banners (bannerPlan)
    hash: (makeHash(ctx) ^ Math.imul(((ctx.persona || {}).salt || 0) + 1, 2654435761)) >>> 0,
    trimBudget: trimBudget(ctx),
    banner,
    gableBanner: !!(banner && banner.site === 'gable'),
    motifRoof: north && sN >= 2,
    ironPosts: north && sN >= 2 && reachesD(biome, 'Swamp') && makeHash(ctx) % 5 >= 3,
  };
}

// The kit's beam for a slope: 45 or 26 degrees, in the wood the frame uses.
function slopeBeam(K, deg) {
  const b = K.beam || 'wood_beam';
  if (/darkwood/.test(b)) return `darkwood_beam_${deg}`;
  if (/ashwood/.test(b)) return `ashwood_wall_beam_${deg}`;
  return `wood_beam_${deg}`;
}
function framePoleD(K, C) { return C.darkFrame && reachesD(C.biome || 'Meadows', 'Plains') ? 'darkwood_pole' : (K.pole || 'wood_pole2'); }

// along-the-wall and outward unit vectors of an outer edge
function axes(e) {
  const ux = e.yaw === 0 ? 1 : 0, uz = e.yaw === 0 ? 0 : 1;
  return { ux, uz, ox: e.out[0], oz: e.out[1] };
}
// the trim budget at a corner of the ground storey's walls: an outside or an inside corner by the two walls meeting
// there (as motifCorners reads it); anything else is dressed
function cornerDressed(ctx, edges, x, z) {
  const es = edges.filter(e => { const { ux, uz } = axes(e); return [-1, 1].some(s => Math.abs(e.x + ux * s - x) < 0.01 && Math.abs(e.z + uz * s - z) < 0.01); });
  const a = es.find(e => e.yaw === 0), bb = es.find(e => e.yaw !== 0);
  if (!a || !bb || es.length !== 2) return true;
  const d1 = (a.x - x) * bb.out[0] + (a.z - z) * bb.out[1], d2 = (bb.x - x) * a.out[0] + (bb.z - z) * a.out[1];
  if (d1 > 0.5 && d2 > 0.5) return dressed(ctx, 'icorner', `${x},${z}`);
  if (d1 < -0.5 && d2 < -0.5) return dressed(ctx, 'corner', `${x},${z}`);
  return true;
}
function outYaw(ox, oz) { return normD(Math.atan2(ox, oz) * 180 / Math.PI); } // a piece facing local +z faces out

// A box test against what is already there (furniture, doors, stairs, other trim), for pieces that stand free.
function clear(b, cand, roles, pad = 0.05) {
  const Ck = checksD(), cb = Ck.aabb(cand);
  return !b.pieces.some(p => {
    if (roles && !roles.includes(PD.piece(p.name).role)) return false;
    const o = Ck.aabb(p);
    return o.x0 < cb.x1 - pad && o.x1 > cb.x0 + pad && o.y0 < cb.y1 - pad && o.y1 > cb.y0 + pad && o.z0 < cb.z1 - pad && o.z1 > cb.z0 + pad;
  });
}

// ---------------------------------------------------------------- window planters

// Plants that stay up on a planter in the game (read from the prefabs on Tyler's PC, 2026-11-12). A pickable or bush
// with the game's StaticPhysics and m_checkSolids off drops to the terrain under it 20 s after it loads, whatever it
// stands on: Pickable_Dandelion, Pickable_Onion, Pickable_Thistle, Pickable_Carrot, Pickable_Turnip, Pickable_Mushroom,
// Vineberry and the berry and heath bushes (Bush01, Bush02_en, RaspberryBush, BlueberryBush, CloudberryBush,
// shrub_2_heath). That is why the onion and dandelion on the showcase 05 sills fell to the ground. Pickable_Fiddlehead
// checks solids and settles on the planter's floor; vines, shrub_2, Pickable_Mushroom_yellow, Pickable_Mushroom_blue,
// FirTree_small and Beech_small1 have no StaticPhysics and stay where they are put. Which of them go in a planter, and
// how many, is the furnishing's (track E); this list is what the game holds.
const PLANTS_HOLD = ['Pickable_Fiddlehead', 'Pickable_Mushroom_yellow', 'Pickable_Mushroom_blue', 'vines', 'shrub_2', 'FirTree_small', 'Beech_small1'];
const PLANTS_FALL = ['Pickable_Dandelion', 'Pickable_Onion', 'Pickable_Thistle', 'Pickable_Carrot', 'Pickable_Turnip', 'Pickable_Mushroom', 'Vineberry',
  'Bush01', 'Bush02_en', 'RaspberryBush', 'BlueberryBush', 'CloudberryBush', 'shrub_2_heath'];

// One planter under a window, as Tyler's mockup: a box a metre deep under the light, its floor of 1 m floor pieces (the
// surface plants stand on), a 1 m beam along its front and down each side at the box's top edge, a sill beam under
// the light against the wall, and a 1 m post up each side of the light. Lined up on the light itself, never on the
// 2 m bay (the boxes stood under the bay's middle while the light sat in one half of it). Returns the pieces, marked
// planter with the window's key; planterSurfaces(b) gives where plants go.
function planter(b, ctx, o) {
  const { K } = ctx, e = o.e, { ux, uz, ox, oz } = axes(e);
  const Ck = checksD();
  // the light: its middle and width along the wall (generate.js wallSegment's lastLight), else the bay
  const L = o.light || { x: e.x, z: e.z, w: 2, h: 1 };
  const lu = (L.x - e.x) * ux + (L.z - e.z) * uz, lw = Math.max(1, Math.round(L.w || 2)), lh = L.h || 1, y0 = o.y0;
  // the wall's outer face at this bay
  const wall = b.pieces.filter(p => !p.decor && ['wall', 'window'].includes(PD.piece(p.name).role) && Math.abs((p.x - e.x) * ux + (p.z - e.z) * uz) < 1.01 && Math.abs((p.x - e.x) * ox + (p.z - e.z) * oz) < 0.6 && p.y > y0 - 0.5 && p.y < y0 + 1.5);
  let face = 0.15;
  for (const p of wall) { const a = Ck.aabb(p); face = Math.max(face, ...[[a.x0, a.z0], [a.x1, a.z1], [a.x0, a.z1], [a.x1, a.z0]].map(([x, z]) => (x - e.x) * ox + (z - e.z) * oz).filter(v => v < 0.8)); }
  // nothing out there: a deck, a stair, a porch post, a floor at sill height
  const zone = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const [u, v] of [[lu - lw / 2 - 0.2, face], [lu + lw / 2 + 0.2, face + 1.1]]) { const x = e.x + ux * u + ox * v, z = e.z + uz * u + oz * v; zone.x0 = Math.min(zone.x0, x); zone.x1 = Math.max(zone.x1, x); zone.z0 = Math.min(zone.z0, z); zone.z1 = Math.max(zone.z1, z); }
  if (b.pieces.some(p => { if (wall.includes(p)) return false; const a = Ck.aabb(p); return a.x0 < zone.x1 && a.x1 > zone.x0 && a.z0 < zone.z1 && a.z1 > zone.z0 && a.y1 > y0 + 0.1 && a.y0 < y0 + 1 + lh; })) return null;
  const key = `${e.x},${e.z},${y0}`, T = { trim: true, planter: key };
  const at = (u, v) => [e.x + ux * u + ox * v, e.z + uz * u + oz * v];
  const yawAlong = e.yaw, yawAcross = (e.yaw + 90) % 360;
  const floor1 = K.floor1 || 'wood_floor_1x1', beam1 = K.beam1 || 'wood_beam_1', pole1 = K.pole1 || 'wood_pole';
  const n0 = b.pieces.length;
  // the box's floor: its top 0.35 m under the light, a metre out from the face
  const yFloor = y0 + 1 - 0.45;
  for (let k = 0; k < lw; k++) { const [x, z] = at(lu - lw / 2 + 0.5 + k, face + 0.5); b.put(floor1, x, yFloor, z, yawAlong, { ...T, soil: true }); }
  // the box's front and sides at its top edge, a 1 m beam each metre
  const yEdge = yFloor + 0.25;
  for (let k = 0; k < lw; k++) { const [x, z] = at(lu - lw / 2 + 0.5 + k, face + 0.95); b.put(beam1, x, yEdge, z, yawAlong, T); }
  for (const sg of [-1, 1]) { const [x, z] = at(lu + sg * (lw / 2 + 0.05), face + 0.5); b.put(beam1, x, yEdge, z, yawAcross, T); }
  // the sill under the light, against the wall
  for (let k = 0; k < lw; k++) { const [x, z] = at(lu - lw / 2 + 0.5 + k, face + 0.15); b.put(beam1, x, y0 + 1 - 0.15, z, yawAlong, T); }
  // a post up each side of the light
  for (const sg of [-1, 1]) { const [x, z] = at(lu + sg * (lw / 2 + 0.1), face + 0.1); for (let y = y0 + 1; y < y0 + 1 + lh - 0.01; y += 1) b.put(pole1, x, y + 0.5, z, 0, T); }
  return b.pieces.slice(n0);
}

/** Where plants go on a building's window planters: one entry per planter, its soil top (x, y, z at the middle),
 * width along the wall, depth out (1 m), the wall's yaw and outward normal, and the window's key. For the furnishing
 * (track E) to plant in clusters; PLANTS_HOLD lists what the game keeps up there. */
function planterSurfaces(b) {
  const by = new Map();
  for (const p of b.pieces) {
    if (!p.soil || !p.planter) continue;
    if (!by.has(p.planter)) by.set(p.planter, []);
    by.get(p.planter).push(p);
  }
  const Ck = checksD();
  return [...by.entries()].map(([key, list]) => {
    const tops = list.map(p => Ck.catBox(p).y1), y = Math.max(...tops);
    const cx = list.reduce((a, p) => a + p.x, 0) / list.length, cz = list.reduce((a, p) => a + p.z, 0) / list.length;
    const yaw = list[0].yaw || 0, a = yaw * Math.PI / 180;
    return { window: key, x: +cx.toFixed(3), y: +y.toFixed(3), z: +cz.toFixed(3), w: list.length, d: 1, yaw, along: [+Math.cos(a).toFixed(3), +(-Math.sin(a)).toFixed(3)], pieces: list };
  });
}

// ---------------------------------------------------------------- exterior

function exterior(b, ctx) {
  const { K, C, F, SH, storeys, edges, verts, door } = ctx;
  const X = ctx.profile || profile(ctx);
  ctx.profile = X;
  const put = (name, x, y, z, yaw) => { if (name) b.put(name, x, y, z, yaw, { trim: true }); };
  const beam = K.beam || 'wood_beam', pole1 = K.pole1 || 'wood_pole', pole = framePoleD(K, C);
  const edgeAt = new Map(edges.map(e => [`${e.x},${e.z}`, e]));
  const openings = b.openings || [];
  const isOpen = new Set(openings.map(o => `${o.e.x},${o.e.z},${o.y0}`));
  const added = { windows: 0, doors: 0, corners: 0, gables: 0, braces: 0, gallery: 0, motifs: 0 };
  // the gable banners the roof put up are decor (any biome, from d2: D-065, D-126, lib/persona.js stageOf)
  for (const g of ctx.gableBannerAt || []) {
    const p = b.pieces.find(q => q.name === g.name && Math.abs(q.x - g.x) < 0.05 && Math.abs(q.y - g.y) < 0.05 && Math.abs(q.z - g.z) < 0.05);
    if (p) { p.decor = true; p.trim = true; ctx.gableBannerDone = true; added.gableBanner = (added.gableBanner || 0) + 1; }
  }
  const MT = X.motifs ? (ctx.motifs || (ctx.motifs = MotifsD.plan(ctx))) : null;
  const used = new Set();
  if (X.svalgang && ctx.wallSegment) added.gallery = svalgang(b, ctx) ? 1 : 0;
  if (X.gablePorch && !added.gallery) added.porch = gablePorch(b, ctx) ? 1 : 0;

  // ---- windows
  for (const o of openings) {
    if (o.kind !== 'window') continue;
    const { e, y0 } = o, { ux, uz, ox, oz } = axes(e);
    // the trim budget: a window left bare as corpus builders leave three in ten, no frame, mullion or shutters
    const frontW = !!ctx.door && e.out[0] === ctx.door.out[0] && e.out[1] === ctx.door.out[1];
    if (!dressed(ctx, 'window', `${e.x},${e.z},${y0}`, frontW)) { o.bare = true; added.bare = (added.bare || 0) + 1; continue; }
    if (MT && motifWindow(b, ctx, MT, o, used)) { added.windows++; added.motifs++; if (X.shutterKit) shutterKit(b, ctx, o, edgeAt, isOpen, added); continue; }
    const stone = /stone|marble|grausten/.test(C.wallStyle || '') && !(b.woodBays && b.woodBays.has(`${Math.round(e.x * 10)},${Math.round(e.z * 10)}`));
    const f = 0.25; // trim stands proud of the wall face (a beam is 0.4 m deep in the game: at 0.25 out it clears the inside)
    // the light: the whole 2 m bay, or 1 m beside a 1 x 1 wall piece
    const quarter = K.wallQuarter && b.pieces.find(p => p.name === K.wallQuarter && Math.abs(p.y - (y0 + 1.5)) < 0.3 && Math.abs((p.x - e.x) * ox + (p.z - e.z) * oz) < 0.2 && Math.abs((p.x - e.x) * ux + (p.z - e.z) * uz) < 0.8);
    const sd = quarter ? ((quarter.x - e.x) * ux + (quarter.z - e.z) * uz > 0 ? 1 : -1) : 0;
    let lw = quarter ? 1 : 2, cx = e.x - ux * sd * 0.5, cz = e.z - uz * sd * 0.5;
    const L = o.light, lh = L ? L.h : 1;
    if (L) { lw = L.w; cx = L.x; cz = L.z; }
    if (X.mullion && lw === 2 && (!L || ['open', 'shutter', 'arch'].includes(L.fill))) for (let j = 0; j < lh; j++) put(pole1, cx, y0 + 1.5 + j, cz, 0);
    // a deck or gallery floor outside the window: no frame (the sill and head would hang over people walking there)
    const deckOut = b.pieces.some(p => PD.piece(p.name).role === 'floor' && Math.hypot(p.x - (e.x + ox), p.z - (e.z + oz)) < 1.1 && Math.abs(p.y - y0) < 0.6);
    if (X.windowFrame && !deckOut) {
      // sill and head no wider than the light and a little over; posts at its sides on board walls only
      // a 1 m light takes 1 m boards where posts carry them; without posts the 2 m beam rests on the wall beside
      const posts = (!C.frame || stone) && C.wallStyle !== 'log';
      const bm = lw === 2 || !posts ? beam : (K.beam1 || 'wood_beam_1'), bx = lw === 2 || !posts ? e.x : cx, bz = lw === 2 || !posts ? e.z : cz;
      put(bm, bx + ox * f, y0 + 0.9, bz + oz * f, e.yaw);
      // no head board: sill and head pairs stacked floor over floor read as a ladder (round 4 review); the head only
      // where the wall is stone (the timber lintel shows there anyway)
      if (stone && lh === 1) put(bm, bx + ox * f, y0 + 2.1, bz + oz * f, e.yaw);
      if (posts) for (const s of [-1, 1]) for (let j = 0; j < lh; j++) put(pole1, cx + ux * s * (lw / 2) + ox * f, y0 + 1.5 + j, cz + uz * s * (lw / 2) + oz * f, 0);
    }
    if (X.shutterKit) { shutterKit(b, ctx, o, edgeAt, isOpen, added); added.windows++; continue; }
    if (X.shutters && !stone) {
      // open shutters flat on the wall either side, only where a plain bay is beside the window and the bay past it
      // is no window wanting the same wall; both sides or none
      const room = s => {
        const n1 = edgeAt.get(`${e.x + ux * s * 2},${e.z + uz * s * 2}`), n2 = edgeAt.get(`${e.x + ux * s * 4},${e.z + uz * s * 4}`);
        if (!n1 || n1.yaw !== e.yaw || isOpen.has(`${n1.x},${n1.z},${y0}`)) return false;
        return !(n2 && n2.yaw === e.yaw && isOpen.has(`${n2.x},${n2.z},${y0}`));
      };
      if (room(-1) && room(1)) for (const s of [-1, 1]) put('wood_window', cx + ux * s * (lw / 2 + 0.6) + ox * 0.12, y0 + 1.5, cz + uz * s * (lw / 2 + 0.6) + oz * 0.12, e.yaw);
    }
    added.windows++;
  }

  // ---- doors
  for (const o of openings) {
    if (o.kind === 'window') continue;
    const { e, y0 } = o, { ux, uz, ox, oz } = axes(e);
    const h = o.kind === 'gate' ? 3 : 2;
    const mo = MT && o.kind === 'door' && !o.gallery && !o.balcony ? motifDoor(b, ctx, MT, o, used) : null;
    if (mo) { added.motifs++; o.motif = mo; }
    // the opening as the door piece fills it (a cloth door hangs beside the wall's middle)
    const dp = b.pieces.find(p => PD.piece(p.name).role === 'door' && Math.hypot(p.x - e.x, p.z - e.z) < 1.2 && p.y > y0 - 0.5 && p.y < y0 + 3);
    const op = dp ? PD.doorOpening(dp) : null;
    const dx = op ? op.x : e.x, dz = op ? op.z : e.z, dw = op ? Math.min(2, op.w) : 2, dh = op ? Math.min(3, op.h) : h;
    const framed = X.doorFrame && o.kind === 'door' && !mo;
    if (framed) {
      if (!C.frame) for (const s of [-1, 1]) put(pole, dx + ux * s * (dw / 2 + 0.05) + ox * 0.1, y0 + 1, dz + uz * s * (dw / 2 + 0.05) + oz * 0.1, 0);
      put(dw < 1.5 ? (K.beam1 || 'wood_beam_1') : beam, dx + ox * 0.25, y0 + dh + 0.2, dz + oz * 0.25, e.yaw); // the lintel, just over the door's frame
    }
    if (o.storey > 0) continue;
    const outside = { x: dx + ox, z: dz + oz };
    // a step in front of a ground-level door: two beams laid along the threshold (a 2 x 2 floor there read as a mat), (sunk to 5 cm above the floor so villagers walk over it, Tyler 2026-11-09)
    // unless a porch, stair or deck is already there
    const busy = b.pieces.some(p => Math.hypot(p.x - outside.x, p.z - outside.z) < 1.1 && ['floor', 'stair'].includes(PD.piece(p.name).role) && Math.abs(p.y - F) < 1.2);
    if (X.doorstep && F < 0.01 && !busy && !(mo && mo.step)) for (const d of [0.35, 0.75]) put(beam, dx + ox * d, F - 0.05, dz + oz * d, e.yaw);
    // a small roof over the door (pent hood) on a rafter each side, falling away from the wall, its low edge level with
    // the door's head 2 m out (so the doorway keeps its headroom); never without the frame, never under an eave or a
    // porch less than 1.5 m over the door
    const covered = b.pieces.some(p => {
      const r = PD.piece(p.name).role;
      if (!['roof', 'roofTop', 'roofCorner', 'floor'].includes(r)) return false;
      const bx = checksD().aabb(p), out = (p.x - dx) * ox + (p.z - dz) * oz, side = Math.abs((p.x - dx) * ux + (p.z - dz) * uz);
      return out > -1.2 && out < 3.2 && side < 2.5 && bx.y0 > y0 + dh - 0.3 && bx.y0 < y0 + dh + 1.5;
    });
    if (X.doorHood && framed && !covered && !(b.gallery && o.storey === 0) && SH >= 3) {
      const yaw = normD(Math.atan2(ox, oz) * 180 / Math.PI);
      put(K.roof26, outside.x, y0 + dh, outside.z, yaw);
      const r26 = slopeBeam(K, 26);
      for (const s of [-1, 1]) put(r26, outside.x + ux * s * 0.85, y0 + dh - 0.15, outside.z + uz * s * 0.85, yaw + 90);
      b.notes.push('A small roof over the door.');
    }
    // banners by the main door (bannerPlan): the lamps give way to them
    const bannered = X.banner && X.banner.site === 'door' && !o.back && o.kind === 'door' && !added.doorBanner && bannerDoor(b, ctx, { x: dx, y: y0 > 0.01 && y0 < 2.01 ? 0 : y0, z: dz, nx: ox, nz: oz }, dw);
    if (bannered) added.doorBanner = 1;
    // lamps: a pair in line with the door posts, a little outside them, with a frame only; on a raised house at the top
    // of the entry stair where a landing is
    if (X.doorLamp && framed && !o.back && !(mo && mo.lit) && !bannered) {
      const cands = [-1, 1].map(s => ({ name: 'piece_groundtorch_wood', x: +(dx + ux * s * (dw / 2 + 0.7) + ox * 0.35).toFixed(3), y: F + 0.65, z: +(dz + uz * s * (dw / 2 + 0.7) + oz * 0.35).toFixed(3), q: quatD(0), yaw: 0 }));
      const footing = c => F < 0.01 || b.pieces.some(p => PD.piece(p.name).role === 'floor' && Math.abs(p.y - F) < 0.2 && Math.abs(p.x - c.x) < 1.05 && Math.abs(p.z - c.z) < 1.05);
      if (cands.every(c => footing(c) && clear(b, c))) for (const c of cands) b.pieces.push({ ...c, decor: true, trim: true });
    }
    added.doors++;
  }

  // ---- corner motifs on the outside and inside corners of the ground storey, before the posts so one post stands there
  if (MT && X.motifCorners) added.corners += motifCorners(b, ctx, MT, used);
  // banners on a plain bay (bannerPlan), and where the door or the gable had no room for theirs; before the foot of the
  // walls, whose boards give way to the cloth
  if (X.banner && (X.banner.site === 'face' || (X.banner.site === 'door' && !added.doorBanner) || (X.banner.site === 'gable' && !ctx.gableBannerDone)))
    added.faceBanner = bannerFace(b, ctx) ? 1 : 0;
  // ---- the foot of the walls, and things hung on the plain bays
  const based = MT && X.motifBase ? motifBases(b, ctx, MT, used) : new Set();
  added.bases = based.size;
  if (MT && X.motifFaces) added.faces = motifFaces(b, ctx, MT, used);

  // ---- corner posts, from the foot of the walls to their top, on every outside corner
  if (X.cornerPosts) {
    const dirs = new Map();
    for (const e of edges) {
      const { ux, uz } = axes(e);
      for (const s of [-1, 1]) { const k = `${e.x + ux * s},${e.z + uz * s}`; if (!dirs.has(k)) dirs.set(k, new Set()); dirs.get(k).add(e.yaw); }
    }
    // iron-bound corner posts on two buildings in five from the Swamp on (44 % of the well-liked builds use iron-bound
    // timber, docs/COVERAGE.md); log walls keep their log poles
    const iron = X.ironPosts && C.wallStyle !== 'log' && K.pole !== 'darkwood_pole' ? 'woodiron_pole' : null;
    const top = wallTopOf(ctx), p = C.wallStyle === 'log' ? (K.pole || pole) : (iron || pole), foot = F > 0.01 && F < 2.01 ? F - Math.ceil(F) : F; // from the ground under a raised floor
    for (const [k, ys] of dirs) {
      if (ys.size < 2) continue;
      const [x, z] = k.split(',').map(Number);
      // the trim budget: a bare corner (log walls keep their posts, see above)
      if (C.wallStyle !== 'log' && !cornerDressed(ctx, edges, x, z)) continue;
      for (let y = foot; y < top - 0.01;) { const h = top - y >= 2 ? 2 : 1; put(h === 2 ? p : pole1, x, y + h / 2, z, 0); y += h; }
      added.corners++;
    }
  }

  // ---- bay posts: on plank walls, a post the full height of the wall every 4 m along the long sides of the main
  // wing, a little proud of the face, so the wall reads in bays (2026-11-09 review); not beside a door
  if (X.cornerPosts && (C.wallStyle || 'plank') === 'plank' && ctx.wings && ctx.wings[0].alpha === 0 && X.sN >= 2) {
    const w0 = ctx.wings[0], top = wallTopOf(ctx), foot = F > 0.01 && F < 2.01 ? F - Math.ceil(F) : F;
    const doorAt = openings.filter(o => o.kind !== 'window').map(o => o.e);
    for (const sz of [-1, 1]) {
      const z = w0.cz + sz * w0.D;
      for (let x = w0.cx - w0.W + 4; x <= w0.cx + w0.W - 4 + 0.01; x += 4) {
        if (!edges.some(e => e.yaw === 0 && Math.abs(e.z - z) < 0.01 && Math.abs(e.x - x) < 1.01)) continue;
        if (doorAt.some(e => Math.abs(e.z - z) < 0.01 && Math.abs(e.x - x) < 1.2)) continue;
        const zz = z + sz * 0.15;
        for (let y = foot; y < top - 0.01;) { const h = top - y >= 2 ? 2 : 1; put(h === 2 ? pole : pole1, x, y + h / 2, zz, 0); y += h; }
      }
    }
  }

  // ---- stone walls: a timber band along each upper floor line, the joists' ends showing; contrasting corners
  if (X.stoneBands) for (const e of edges) {
    const { ox, oz } = axes(e);
    for (let s = 1; s < storeys; s++) {
      const y0 = F + s * SH;
      if (openings.some(o => o.e === e && Math.abs(o.y0 - y0) < 0.01 && o.kind !== 'window')) continue;
      put(beam, e.x + ox * 0.25, y0 - 0.1, e.z + oz * 0.25, e.yaw);
    }
  }
  if (X.stoneCorners) {
    const marble = /marble/.test(C.wallStyle || '') || /blackmarble/.test(K.wall || '');
    const doorEdge = openings.filter(o => o.kind !== 'window' && o.storey === 0).map(o => o.e);
    const dirs = new Map();
    for (const e of edges) {
      const { ux, uz } = axes(e);
      for (const s of [-1, 1]) { const k = `${e.x + ux * s},${e.z + uz * s}`; if (!dirs.has(k)) dirs.set(k, { ys: new Set(), es: [] }); dirs.get(k).ys.add(e.yaw); dirs.get(k).es.push(e); }
    }
    const top = wallTopOf(ctx);
    for (const [k, v] of dirs) {
      if (v.ys.size < 2 || v.es.some(e => doorEdge.includes(e))) continue;
      const [x, z] = k.split(',').map(Number);
      // outside corners only: each wall lies on the far side of the other's outward direction
      const [a, c] = v.es;
      if ((a.x - x) * c.out[0] + (a.z - z) * c.out[1] > -0.5 || (c.x - x) * a.out[0] + (c.z - z) * a.out[1] > -0.5) continue;
      if (!dressed(ctx, 'corner', `${x},${z}`)) continue;
      if (marble && reachesD(ctx.biome, 'Black Forest')) for (let y = F; y + 2 <= top + 0.01; y += 2) put('stone_pillar', x, y + 1, z, 0);
      else for (let y = F; y < top - 0.01;) { const h = top - y >= 2 ? 2 : 1; put(h === 2 ? pole : pole1, x, y + h / 2, z, 0); y += h; }
      added.corners++;
    }
  }

  // ---- window planters (D-165, Tyler 2026-11-12: "Families that like plants can have planters. But not, not every
  // single window should have planters"; at most about 10 % of a village's windows). Which windows get one is the
  // household's: ctx.planterWindows(openings, ctx) when the furnishing gives it (track E), else the whole front run of
  // the ground storey of a household fond of plants (lib/persona.js hobby plants 0.5 or more; D-167: one feature on a
  // whole run of windows). The planter is Tyler's mockup
  // (frames/shot-c-sill-mockup.jpg): "the sill is under the window. Theres additional 1x1 beams outlining the window,
  // and outling the other two sides of the planter" (planter()).
  if (X.windowBoxes && ctx.door) {
    const fronts = openings.filter(o => o.kind === 'window' && !o.storey && !o.bare && o.e.out[0] === ctx.door.out[0] && o.e.out[1] === ctx.door.out[1]);
    const P = ctx.persona || {};
    // (D-167, Tyler: "windows in a row would all have the same feature": the whole front run of the ground storey)
    const chosen = ctx.planterWindows ? ctx.planterWindows(fronts, ctx) : ((P.hobby || {}).plants || 0) >= 0.5 ? fronts : [];
    for (const o of chosen) {
      const got = planter(b, ctx, o);
      if (!got) continue;
      added.boxes = (added.boxes || 0) + 1;
      // what grows in it: the furnishing's (ctx.plantPlanter, track E); until then one plant the game holds up per
      // metre, by the box's place so it is the same at every decor stage
      const surf = planterSurfaces({ pieces: got })[0];
      if (ctx.plantPlanter) ctx.plantPlanter(b, surf, ctx);
      else for (let k = 0; k < surf.w; k++) {
        const t = k - (surf.w - 1) / 2, x = surf.x + surf.along[0] * t, z = surf.z + surf.along[1] * t;
        const name = PLANTS_HOLD[(Math.abs(Math.round(x * 7 + z * 13 + surf.y * 3)) + (makeHash({ ...ctx, decor: '' }) >>> 0)) % 3];
        b.put(name, x, surf.y, z, Math.round((x * 31 + z * 17) % 4) * 90, { trim: true, decor: true, planter: surf.window });
      }
    }
  }

  // ---- bands: a beam at the foot of the walls and along the floor line of each upper storey; a rail at 1 m on
  // half-timbered walls. Laid a little proud of the outside face, never across a door.
  const stackBay = e => e.yaw === 90 && (b.vents || []).some(v => v.kind === 'stack' && Math.abs(v.z - e.z) < 0.5 && Math.abs(v.x - e.x) < 1.2);
  if (X.bands || X.midRail) for (const e of edges) {
    const { ox, oz } = axes(e);
    for (let s = 0; s < storeys; s++) {
      const y0 = F + s * SH;
      // (the gable bay a stack hearth stands half in is open on the ground storey like a doorway)
      const opening = openings.find(o => o.e === e && o.y0 === y0) || (s === 0 && stackBay(e) ? { kind: 'hearth' } : null);
      if (X.bands && !(opening && opening.kind !== 'window') && !(s === 0 && based.has(e))) put(beam, e.x + ox * 0.25, y0 + 0.1, e.z + oz * 0.25, e.yaw);
      if (X.midRail && !opening) put(beam, e.x + ox * 0.25, y0 + 1, e.z + oz * 0.25, e.yaw);
    }
  }

  // ---- leaning outer posts against the long walls of halls (a 45 degree beam from the ground to 2 m up the wall)
  if (X.braces && F < 1.6 && !ctx.flat) {
    const w0 = ctx.wings[0];
    const doors = openings.filter(o => o.kind !== 'window').map(o => o.e);
    const brace = slopeBeam(K, 45);
    for (const [x, z] of verts) {
      // on the long sides of the main wing only, not at its corners, every other post
      const onLong = Math.abs(Math.abs(z - w0.cz) - w0.D) < 0.01 && Math.abs(x - w0.cx) < w0.W - 0.5;
      if (!onLong || Math.round(x) % 4 !== 0) continue;
      if (doors.some(d => Math.hypot(d.x - x, d.z - z) < 2.2)) continue;
      const nz = z > w0.cz ? 1 : -1, cand = { name: brace, x, y: 1, z: z + nz * 1.05, yaw: normD(Math.atan2(nz, -0) * 180 / Math.PI) };
      // the beam rises toward its local +x: turned so +x points back at the wall
      cand.yaw = normD(Math.atan2(nz, 0) * 180 / Math.PI); // yaw with local +x = (0, -nz)
      if (!clear(b, { ...cand, q: quatD(cand.yaw) }, ['door', 'stair', 'floor', 'storage', 'craft', 'seat', 'table', 'light', 'fence'])) continue;
      put(brace, cand.x, cand.y, cand.z, cand.yaw);
      added.braces++;
    }
    if (added.braces) b.notes.push('Leaning posts against the long walls, after the Viking halls at Trelleborg.');
  }

  for (const id of ctx.motifUsed || []) used.add(id);
  if (used.size) pruneMotifs(b, ctx);
  if (used.size) b.notes.push(`Trim after community builds: ${[...used].sort().join(', ')}.`);
  b.motifs = [...used];
  b.detailReport = added;
  return added;
}

// ---------------------------------------------------------------- motifs (lib/motifs.js)

// Motif pieces on the walls wait until the rooms are furnished (details interior), so the decorator lays out the rooms
// as it would without them; meanwhile they count for the motifs that follow.
function hold(b, placed) {
  b.motifPending = b.motifPending || [];
  for (const p of placed) b.motifPending.push(p);
}
function commitMotifs(b, ctx) {
  const pend = b.motifPending || [];
  delete b.motifPending;
  if (!pend.length) return;
  // with the game's solids where they are known (checks.js gameBox), as the overlap check reads furniture
  const Ck = checksD(), gb = p => (Ck.gameBox ? Ck.gameBox(p) : Ck.aabb(p)), furn = b.pieces.filter(p => p.decor).map(gb);
  const SH = NODE_D ? (() => { try { return require('./shapes.js'); } catch (e) { return null; } })() : window.VHShapes;
  const hit = (a, o) => {
    if (!(o.x0 < a.x1 - 0.02 && o.x1 > a.x0 + 0.02 && o.y0 < a.y1 - 0.02 && o.y1 > a.y0 + 0.02 && o.z0 < a.z1 - 0.02 && o.z1 > a.z0 + 0.02)) return false;
    if (a.pass || o.pass) return false;
    return !(a.sol && o.sol && SH) || SH.overlapVolume(a.sol, o.sol) > 0.01;
  };
  // a lamp, banner, sign or carving tested again against the structure as it stands now: the bands and rails laid
  // after the motifs were chosen ran through a banner on a Black Forest farm and storehouse (2026-11-10); a banner's
  // cloth also ends over the floor or ground under it and no more than a metre above it, out of the roof (the pool
  // audit's hang test). Such a piece comes out with the rest of its motif round it.
  const Me = meshDt(), PROP = /^(piece_banner\d+|sign|sign_notext|itemstand|piece_walltorch|piece_dvergr_lantern|piece_brazierceiling01|wood_dragon1|darkwood_raven|darkwood_wolf|Trophy|piece_shieldgeneric|cloth_hanging_)/;
  const struct = b.pieces.filter(q => (!q.decor || q.trim) && ['wall', 'window', 'pole', 'beam', 'roof', 'roofCorner', 'roofTop', 'gable', 'halfwall'].includes(PD.piece(q.name).role));
  const floors = b.pieces.filter(q => !q.decor && PD.piece(q.name).role === 'floor');
  const bad = [];
  if (Me) for (const p of pend) {
    if (!PROP.test(p.name)) continue;
    const pq = { ...p, q: p.q || quatD(p.yaw) }, A = Me.world(pq);
    if (!A || !A.length) continue;
    const lim = /^piece_banner\d+$/.test(p.name) ? 0.03 : 0.015;
    let out = struct.some(q => Math.abs(q.x - p.x) < 3.5 && Math.abs(q.z - p.z) < 3.5 && Math.abs(q.y - p.y) < 4.5 && Me.deepest(A, Me.world(q)) > lim);
    if (!out && /^piece_banner\d+$/.test(p.name) && SH) {
      const V = Me.aabbOf(A);
      let fl = 0;
      for (const q of floors) { if (Math.abs(q.x - p.x) > 2.5 || Math.abs(q.z - p.z) > 2.5) continue; const t = SH.topAt(SH.world(q) || [], p.x, p.z); if (t != null && t <= V.y0 + 0.05 && t > fl) fl = t; }
      out = V.y0 < fl - 0.03 || V.y0 > fl + 1.0;
    }
    // and plain wall behind a hung one, as the decorator's audit reads it (mountOnOpening: motif signs and a wall torch
    // over openings on a Plains sawmill and storehouse, integration round 4)
    if (!out && !mountClearD(b, { ...p, q: p.q || quatD(p.yaw) })) out = true;
    if (out) bad.push(p);
  }
  const dropped = p => bad.some(q => q.motif === p.motif && Math.abs(q.x - p.x) < 3 && Math.abs(q.y - p.y) < 4 && Math.abs(q.z - p.z) < 3);
  // a motif's bench, chest or post that stands on the floor stays out of the keep-clear zones (doorways, climbs and
  // their feet, chimneys: lib/generate.js keepClear, passed as ctx.zones); the zones were cleared before the trim went
  // in, and a motif bench stood at a hall's stair foot (integration round 4)
  // (and, as the decorator's audit reads a climb, 0.6 m round every stair and ladder piece, sides included)
  const Fd = (decorDt() || {}).FURNITURE || {};
  const climbs = b.pieces.filter(q => !q.decor && PD.piece(q.name).role === 'stair').map(q => Ck.aabb(q));
  const inZone = p => {
    const f = Fd[p.name];
    if (!f || ['mount', 'hang', 'top', 'rug'].includes(f.at)) return false;
    const o = Ck.aabb({ ...p, q: p.q || quatD(p.yaw) });
    if (climbs.some(c => o.x0 < c.x1 + 0.6 && o.x1 > c.x0 - 0.6 && o.z0 < c.z1 + 0.6 && o.z1 > c.z0 - 0.6 && o.y0 < c.y1 + 0.3 && o.y1 > c.y0)) return true;
    return !!(ctx && ctx.zones) && ctx.zones.some(z => o.x0 < z.x1 && o.x1 > z.x0 && o.y0 < z.y1 && o.y1 > z.y0 && o.z0 < z.z1 && o.z1 > z.z0);
  };
  for (const p of pend) {
    if (dropped(p) || inZone(p)) continue;
    const pb = gb({ ...p, q: p.q || quatD(p.yaw) });
    if (furn.some(o => hit(pb, o))) continue; // what the furnishing put there first stays
    // lamps, banners, signs, stands and carvings are decor (D-065, D-126): any biome, and they go up with the
    // household's decor stage from d2 (lib/persona.js stageOf), as profile's budget says
    const dec = MotifsD.PROPS.test(MotifsD.classOf(p.name)) || MotifsD.CARVED.test(MotifsD.classOf(p.name));
    b.put(p.name, p.x, p.y, p.z, p.yaw, dec ? { trim: true, motif: p.motif, footed: true, decor: true } : { trim: true, motif: p.motif, footed: true });
  }
  pruneMotifs(b, ctx);
}

// The last pass over the motifs' pieces: one that doubles another piece, is not connected to the ground or would
// fall by its material (the game's support, checks.js) comes out, and what hung on it with it.
function pruneMotifs(b, ctx) {
  const Ck = checksD(), keys = ctx.motifKeys || new Set();
  const isMotif = p => p.motif || keys.has(`${p.name}|${Math.round(p.x * 10)}|${Math.round(p.y * 10)}|${Math.round(p.z * 10)}`);
  for (let round = 0; round < 4; round++) {
    const ps = b.pieces, boxes = ps.map(p => Ck.aabb(p)), near = Ck.index(boxes);
    const ys = boxes.filter(x => x.info.structural).map(x => x.y0).sort((a, c) => a - c), ground = ys.length ? ys[Math.floor(ys.length * 0.02)] : 0;
    const out = new Set();
    // doubles
    const seen = new Map();
    ps.forEach((p, i) => {
      const k = `${p.name}|${p.x.toFixed(1)}|${p.y.toFixed(1)}|${p.z.toFixed(1)}|${Math.round(Ck.localOf ? (p.yaw != null ? p.yaw : 0) : 0) % 360}`;
      if (!seen.has(k)) { seen.set(k, i); return; }
      const j = seen.get(k);
      if (isMotif(p)) out.add(i); else if (isMotif(ps[j])) { out.add(j); seen.set(k, i); }
    });
    // connected to the ground through touching pieces (as checks.js reads it)
    const held = boxes.map(x => x.y0 <= ground + 0.35), queue = held.map((h, i) => (h ? i : -1)).filter(i => i >= 0);
    const tch = (a, o, e) => a.x0 <= o.x1 + e && o.x0 <= a.x1 + e && a.y0 <= o.y1 + e && o.y0 <= a.y1 + e && a.z0 <= o.z1 + e && o.z0 <= a.z1 + e;
    while (queue.length) {
      const i = queue.pop(), a = boxes[i];
      for (const j of near(a)) if (!held[j] && tch(a, boxes[j], 0.16) && (a.info.structural || ['craft', 'deco', 'light'].includes(boxes[j].info.role))) { held[j] = true; queue.push(j); }
    }
    ps.forEach((p, i) => { if (!held[i] && boxes[i].info.structural && isMotif(p)) out.add(i); });
    for (const i of Ck.stability(ps, boxes, near, ground)) if (isMotif(ps[i])) out.add(i);
    if (!out.size) break;
    b.pieces = ps.filter((p, i) => !out.has(i));
  }
}

// Shutters as the window kit's fill (generate.js windowKit, 'shutter'): Wood Shutters open flat on the wall either
// side of a 1 m tall light where the wall beside it is plain (both or none), else closed in the light. On every
// window of the building, the motif's trim or the rules' frame round it.
function shutterKit(b, ctx, o, edgeAt, isOpen, added) {
  const { e, y0 } = o, { ux, uz, ox, oz } = axes(e), L = o.light;
  if (!L || L.h !== 1) return;
  const cx = L.x, cz = L.z, lw = L.w, Ck = checksD();
  const at = s => ({ name: 'wood_window', x: cx + ux * s * (lw / 2 + 0.6) + ox * 0.12, y: y0 + 1.5, z: cz + uz * s * (lw / 2 + 0.6) + oz * 0.12, yaw: e.yaw });
  // beside the light: the 1 m wall piece of its own bay, or a plain bay next to it
  const plainAt = s => {
    const p = at(s), along = (p.x - e.x) * ux + (p.z - e.z) * uz;
    if (Math.abs(along) < 1) return true; // over the bay's own 1 m wall piece
    const n1 = edgeAt.get(`${e.x + ux * s * 2},${e.z + uz * s * 2}`);
    if (!n1 || n1.yaw !== e.yaw) return false;
    if (!isOpen.has(`${n1.x},${n1.z},${y0}`)) return true;
    const l2 = (b.openings || []).find(q => q.e === n1 && q.y0 === y0);
    return !!(l2 && l2.light && l2.light.w === 1 && Math.abs((l2.light.x - p.x) * ux + (l2.light.z - p.z) * uz) > 1.05);
  };
  const free = s => { const p = at(s); const bx = Ck.aabb({ ...p, q: quatD(p.yaw) }); return !b.pieces.some(q => { if (q.decor) return false; const r = PD.piece(q.name).role; if (!['pole', 'beam', 'window', 'light', 'misc'].includes(r) && !q.trim) return false; const a = Ck.aabb(q); return a.x0 < bx.x1 - 0.05 && a.x1 > bx.x0 + 0.05 && a.y0 < bx.y1 - 0.05 && a.y1 > bx.y0 + 0.05 && a.z0 < bx.z1 - 0.05 && a.z1 > bx.z0 + 0.05; }); };
  if (plainAt(-1) && plainAt(1) && free(-1) && free(1)) {
    for (const s of [-1, 1]) { const p = at(s); b.put(p.name, p.x, p.y, p.z, p.yaw, { trim: true }); }
    added.shutters = (added.shutters || 0) + 1;
  } else if (lw === 1) {
    // closed: the leaf over the light (it runs 1 m to the -x side of its hinge)
    const lx = Math.cos(e.yaw * Math.PI / 180), lz = -Math.sin(e.yaw * Math.PI / 180); // the piece's local +x
    b.put('wood_window', cx + lx * 0.5, y0 + 1.5, cz + lz * 0.5, e.yaw, { trim: true });
    added.shuttersClosed = (added.shuttersClosed || 0) + 1;
  }
}

// a window bay: a 2 m opening, or a 1 m light beside a 1 x 1 wall piece; the motif for its size and facade
function motifWindow(b, ctx, MT, o, used) {
  const { e, y0 } = o, { ux, uz, ox, oz } = axes(e), K = ctx.K;
  const quarter = K.wallQuarter && b.pieces.find(p => p.name === K.wallQuarter && Math.abs(p.y - (y0 + 1.5)) < 0.3 && Math.abs((p.x - e.x) * ox + (p.z - e.z) * oz) < 0.2 && Math.abs((p.x - e.x) * ux + (p.z - e.z) * uz) < 0.8);
  let f = { w: 2, h: 1 }, x = e.x, z = e.z;
  if (quarter) { const sd = (quarter.x - e.x) * ux + (quarter.z - e.z) * uz > 0 ? 1 : -1; f = { w: 1, h: 1 }; x -= ux * sd * 0.5; z -= uz * sd * 0.5; }
  // the window kit's light (generate.js windowKit): its own size and place
  const L = o.light;
  if (L) { f = { w: L.w, h: L.h }; x = L.x; z = L.z; }
  const glass = (L && !['open', 'arch'].includes(L.fill)) || b.pieces.some(p => /crystal|glass/.test(p.name) && Math.hypot(p.x - e.x, p.z - e.z) < 1.1 && Math.abs(p.y - (y0 + 1.5)) < 0.6);
  // a window under a lean-to or behind a stack stays plain
  const shed = b.pieces.some(p => { const d = (p.x - x) * ox + (p.z - z) * oz, s = Math.abs((p.x - x) * ux + (p.z - z) * uz); return d > 0.3 && d < 2.6 && s < 2 && p.y < y0 + 3 && (p.decor || /roof/.test(PD.piece(p.name).role)); });
  if (shed) return false;
  const front = ctx.door && e.out[0] === ctx.door.out[0] && e.out[1] === ctx.door.out[1];
  // an arched light: the window motifs corpus builders made with an arch piece (stone_arch, darkwood_arch), where the
  // building's materials allow one; else a plain motif and an open light
  const archy = c => c.m.p.some(t => /arch/.test(t[0]));
  const c = (L && L.fill === 'arch' && MT.get('window', { ...f, arch: 1 }, front, archy)) || MT.get('window', f, front);
  if (!c) return false;
  const placed = MotifsD.place(b, c, { x, y: y0 + 1, z, nx: ox, nz: oz }, f, { mirror: MT.mirror, ground: 0, noInfill: glass, dry: true });
  hold(b, placed);
  if (!placed.length) return false;
  used.add(c.m.id);
  return true;
}
// the door: its motif, without what would stand below the floor when the house is raised more or less than the
// motif's own (its steps were for that height)
function motifDoor(b, ctx, MT, o, used) {
  const { e, y0 } = o, { ox, oz } = axes(e);
  const dp = b.pieces.find(p => PD.piece(p.name).role === 'door' && Math.hypot(p.x - e.x, p.z - e.z) < 1.2 && p.y > y0 - 0.5 && p.y < y0 + 2.5);
  if (!dp) return null;
  const f = { w: 2, h: Math.min(3, PD.doorSpec(dp.name).h) };
  const c = MT.get('door', f, !o.back);
  if (!c) return null;
  const rise = c.m.fit.rise || 0, F = ctx.F;
  const placed = MotifsD.place(b, c, { x: e.x, y: y0, z: e.z, nx: ox, nz: oz }, f,
    { mirror: MT.mirror, ground: 0, minH: Math.abs(rise - (o.storey ? 99 : F)) < 0.3 ? null : -0.2, dry: true });
  if (!placed.length) return null;
  hold(b, placed);
  used.add(c.m.id);
  return { id: c.m.id, lit: placed.some(p => PD.piece(p.name).role === 'light'), step: placed.some(p => PD.piece(p.name).role === 'floor' && p.y < y0 + 0.3) };
}
// corners of the ground storey: outside corners (two walls meeting with the building behind both) and, where wings
// meet, inside corners (the building round three sides), each with its own motif from walls of the same kind
function motifCorners(b, ctx, MT, used) {
  const { edges, F } = ctx, X = ctx.profile || {}, wt = ctx.C.wallStyle || 'plank';
  const c = MT.get('corner', { angle: 90, wt }, true), ci = X.motifIcorners !== false ? MT.get('icorner', { angle: 270, wt }, true) : null;
  if (!c && !ci) return 0;
  const at = new Map();
  for (const e of edges) {
    const { ux, uz } = axes(e);
    for (const s of [-1, 1]) { const k = `${e.x + ux * s},${e.z + uz * s}`; if (!at.has(k)) at.set(k, []); at.get(k).push(e); }
  }
  let n = 0;
  for (const [k, es] of at) {
    const a = es.find(e => e.yaw === 0), bb = es.find(e => e.yaw !== 0);
    if (!a || !bb || es.length !== 2) continue;
    const [x, z] = k.split(',').map(Number);
    // outside: each wall lies on the far side of the other's outward direction; inside: on the near side of it
    const d1 = (a.x - x) * bb.out[0] + (a.z - z) * bb.out[1], d2 = (bb.x - x) * a.out[0] + (bb.z - z) * a.out[1];
    const inner = d1 > 0.5 && d2 > 0.5;
    if (!inner && (d1 > -0.5 || d2 > -0.5)) continue;
    const m = inner ? ci : c;
    if (!m) continue;
    if (!dressed(ctx, inner ? 'icorner' : 'corner', `${x},${z}`)) continue;
    // the frame faces out of the corner: the outward diagonal, or into the open angle between the wings
    const dx = a.out[0] + bb.out[0], dz = a.out[1] + bb.out[1], l = Math.hypot(dx, dz);
    const placed = MotifsD.place(b, m, { x, y: F, z, nx: dx / l, nz: dz / l }, null, { mirror: MT.mirror, ground: 0, inward: inner, dry: true });
    if (placed.length) { n++; hold(b, placed); used.add(m.m.id); }
  }
  return n;
}

// The foot of the walls: a sill log, a stone course, a board laid out from the wall, from a motif of walls of the
// same kind, on every ground-storey bay without a door. Returns the bays done (the rules' foot band leaves them).
function motifBases(b, ctx, MT, used) {
  const { edges, F } = ctx, wt = ctx.C.wallStyle || 'plank', done = new Set();
  if (F > 0.01) return done; // a raised floor has posts under it, no wall foot on the ground
  const c = MT.get('base', { wt }, true);
  if (!c) return done;
  const doorAt = (b.openings || []).filter(o => o.kind !== 'window' && o.storey === 0).map(o => o.e);
  for (const e of edges) {
    // the bay of a door and the bays beside it stay clear (the doorstep, the door's lamps)
    if (doorAt.some(d => Math.hypot(d.x - e.x, d.z - e.z) < 2.1)) continue;
    const { ox, oz } = axes(e);
    const placed = MotifsD.place(b, c, { x: e.x, y: F, z: e.z, nx: ox, nz: oz }, null, { mirror: MT.mirror, ground: 0, dry: true, minShare: 0.5, lift: true });
    if (placed.length) { hold(b, placed); done.add(e); }
  }
  if (done.size) used.add(c.m.id);
  return done;
}

// Things hung on a plain stretch of outside wall (D-065): a sconce or a lantern on a hook, a banner, an item stand
// with a shield or a trophy, a sign, a carving, with the bracket or board that carries it. One motif per building,
// on one bay in three at most, never on a corner bay or within 3 m of a door, from the front round; two at d2, four
// at d3.
function motifFaces(b, ctx, MT, used) {
  const { edges, F, door } = ctx, X = ctx.profile, wt = ctx.C.wallStyle || 'plank';
  if (X.dN < 2) return 0;
  const openings = b.openings || [];
  const openAt = new Set(openings.filter(o => o.storey === 0).map(o => `${o.e.x},${o.e.z}`));
  const doors = openings.filter(o => o.kind !== 'window').map(o => o.e);
  const edgeAt = new Map(edges.map(e => [`${e.x},${e.z}`, e]));
  const plain = e => {
    if (openAt.has(`${e.x},${e.z}`)) return false;
    const { ux, uz } = axes(e);
    for (const s of [-1, 1]) {
      const n = edgeAt.get(`${e.x + ux * s * 2},${e.z + uz * s * 2}`);
      if (!n || n.yaw !== e.yaw || n.out[0] !== e.out[0] || n.out[1] !== e.out[1]) return false; // a corner beside it (a window may be: a lamp between windows)
    }
    return !doors.some(d => Math.hypot(d.x - e.x, d.z - e.z) < 3.1);
  };
  const front = e => door && e.out[0] === door.out[0] && e.out[1] === door.out[1];
  const cands = edges.filter(plain).sort((p, q) => (front(q) ? 1 : 0) - (front(p) ? 1 : 0) || Math.hypot(p.x - (door ? door.x : 0), p.z - (door ? door.z : 0)) - Math.hypot(q.x - (door ? door.x : 0), q.z - (door ? door.z : 0)));
  const max = X.dN >= 3 ? 4 : 2, taken = [...(ctx.bannerBays || [])];
  const hasAccent = placed => placed.some(p => MotifsD.PROPS.test(p.cls) || MotifsD.CARVED.test(p.cls));
  const frameOf = e => { const { ox, oz } = axes(e); return { x: e.x, y: F, z: e.z, nx: ox, nz: oz }; };
  const opts = { mirror: MT.mirror, ground: 0, dry: true, lift: true };
  // the motif is chosen among those whose lamp or banner fits on the first plain bay
  const test = cands[0] ? c => hasAccent(MotifsD.place(b, c, frameOf(cands[0]), null, opts)) : null;
  for (const e of cands) {
    if (taken.length >= max) break;
    if (taken.some(t => Math.hypot(t.x - e.x, t.z - e.z) < 5.9)) continue;
    const { ux, uz, ox, oz } = axes(e);
    // nothing in front of the bay (a lean-to, a woodpile, a stack)
    if (b.pieces.some(p => { const d = (p.x - e.x) * ox + (p.z - e.z) * oz, sd = Math.abs((p.x - e.x) * ux + (p.z - e.z) * uz); return d > 0.3 && d < 2.6 && sd < 1.6 && p.y < F + 3 && (p.decor || /roof|stair|floor/.test(PD.piece(p.name).role)); })) continue;
    const c = MT.get('wallface', { wt }, front(e), test);
    if (!c) break;
    const placed = MotifsD.place(b, c, frameOf(e), null, opts);
    if (!placed.length || !hasAccent(placed)) continue;
    hold(b, placed); taken.push(e); used.add(c.m.id);
  }
  return taken.length;
}

// Banners (bannerPlan), as one-piece motifs so they go through the same tests as the motifs' banners (motifs.js
// place: nothing in a doorway, the cloth clear of walls, posts and roof; commitMotifs: the cloth's foot over the floor
// or ground under it and no more than a metre above it). The rod 0.3 m out from the wall's middle and turned along the
// wall, as in the corpus motifs (o 0.3, r 90 or 270; the cloth looks the same either way).
// (turned 90 degrees: the face the decorator reads as the banner's front, lib/decorate.js FURNITURE rel, looks out)
// a plain wall behind the cloth across its width at its middle height, as the decorator's own test reads a hung piece
// (lib/decorate.js mountOk): the first wall-like piece met going back toward the wall is a wall, not a window, door,
// fence or glass
function wallBehind(b, p, fr) {
  const Ck = checksD(), ux = fr.nz, uz = -fr.nx, y = p.y - 1.5;
  const near = b.pieces.filter(q => Math.abs(q.x - p.x) < 2.5 && Math.abs(q.z - p.z) < 2.5 && ['wall', 'door', 'window', 'fence'].includes(PD.piece(q.name).role));
  const boxes = near.map(q => [q, Ck.aabb(q)]);
  for (const t of [-0.65, 0, 0.65]) {
    let hit = null;
    for (let back = 0; back <= 1.0 && !hit; back += 0.05) {
      const x = p.x + ux * t - fr.nx * back, z = p.z + uz * t - fr.nz * back;
      const f = boxes.find(([q, o]) => x >= o.x0 - 0.01 && x <= o.x1 + 0.01 && z >= o.z0 - 0.01 && z <= o.z1 + 0.01 && y >= o.y0 - 0.01 && y <= o.y1 + 0.01);
      if (f) hit = f[0];
    }
    if (!hit || PD.piece(hit.name).role !== 'wall' || /crystal|glass/.test(hit.name)) return false;
  }
  return true;
}
function bannerPieces(X, as, h, o) { return as.map(a => [X.banner.name, a, o, h, 90, 'banner', 0]); }
// hang them on a frame at the plan's height, else a little lower or higher (the corpus rods 2.9 to 3.6 m over the
// floor: the cloth's foot 0 to 0.7 m up), 0.3 m out from the wall's middle (0.1 m off a stone wall's face) or, past a
// timber at the wall's head, 0.15 m further
function hangBanners(b, X, fr, as, id, wall) {
  const o0 = Math.max(0.3, (wall ? relief(wall) : 0.15) + 0.1);
  const pref = 2.98 + X.banner.lift, hs = [pref];
  // nothing hung over a window (the pool audit's overWin): the light of each window, a little round it
  const keepOut = (b.openings || []).filter(o => o.kind === 'window').map(o => {
    const { ux, uz, ox, oz } = axes(o.e), ex = Math.abs(ux) * 1.05 + Math.abs(ox) * 0.8, ez = Math.abs(uz) * 1.05 + Math.abs(oz) * 0.8;
    return { x0: o.e.x - ex, x1: o.e.x + ex, z0: o.e.z - ez, z1: o.e.z + ez, y0: o.y0 + 0.9, y1: o.y0 + 2.1 };
  });
  for (let d = 0.1; d <= 0.65; d += 0.1) for (const h of [pref - d, pref + d]) if (h >= 2.98 && h <= 3.62) hs.push(+h.toFixed(2));
  for (const o of [o0, o0 + 0.15]) for (const h of hs) {
    const c = { m: { id, kind: 'wallface', fit: {} }, kept: bannerPieces(X, as, h, o) };
    const placed = MotifsD.place(b, c, fr, null, { ground: 0, dry: true, minShare: 1, keepOut });
    if (!placed.length) continue;
    if (!placed.every(p => wallBehind(b, p, fr) && mountClearD(b, p))) return false; // an open bay, a window: no other height helps
    hold(b, placed); return true;
  }
  return false;
}
// one each side of the main door, or one on the side away from the door's lamps' corner, 0.9 m past the door's edge
// (the corpus door motifs: 1.8 to 2 m from a 2 m door's middle)
function bannerDoor(b, ctx, fr, dw) {
  const X = ctx.profile, d = dw / 2 + 0.9;
  const sides = X.banner.pair ? [[-d, d]] : unitD(X.hash, 'banner side') < 0.5 ? [[-d], [d]] : [[d], [-d]];
  for (const as of sides) if (hangBanners(b, X, fr, as, 'banner-door', ctx.K.wall)) { b.notes.push('Banners by the door.'); return true; }
  return false;
}
// a plain bay of the ground storey's outside wall: no opening in it, the bays either side on the same wall (a window
// may be there), no door within 3 m, nothing in front; the front first, nearest the door
function bannerFace(b, ctx) {
  const { edges, F, door } = ctx, X = ctx.profile;
  const openings = b.openings || [];
  const openAt = new Set(openings.filter(o => o.storey === 0).map(o => `${o.e.x},${o.e.z}`));
  const doors = openings.filter(o => o.kind !== 'window').map(o => o.e);
  const edgeAt = new Map(edges.map(e => [`${e.x},${e.z}`, e]));
  const plain = e => {
    if (openAt.has(`${e.x},${e.z}`)) return false;
    const { ux, uz } = axes(e);
    for (const s of [-1, 1]) { const n = edgeAt.get(`${e.x + ux * s * 2},${e.z + uz * s * 2}`); if (!n || n.yaw !== e.yaw || n.out[0] !== e.out[0] || n.out[1] !== e.out[1]) return false; }
    return !doors.some(d => Math.hypot(d.x - e.x, d.z - e.z) < 3.1);
  };
  const front = e => door && e.out[0] === door.out[0] && e.out[1] === door.out[1];
  const dist = e => Math.hypot(e.x - (door ? door.x : 0), e.z - (door ? door.z : 0));
  const cands = edges.filter(plain).sort((p, q) => (front(q) ? 1 : 0) - (front(p) ? 1 : 0) || dist(p) - dist(q));
  const as = X.banner.pair ? [-0.6, 0.6] : [0];
  for (const e of cands) {
    const { ux, uz, ox, oz } = axes(e);
    if (b.pieces.some(p => { const d = (p.x - e.x) * ox + (p.z - e.z) * oz, sd = Math.abs((p.x - e.x) * ux + (p.z - e.z) * uz); return d > 0.3 && d < 2.6 && sd < 1.6 && p.y < F + 3 && (p.decor || /roof|stair|floor/.test(PD.piece(p.name).role)); })) continue;
    // on a raised floor the cloth hangs down the footing to the ground, as it hangs to the floor inside
    if (!hangBanners(b, X, { x: e.x, y: F > 0.01 ? 0 : F, z: e.z, nx: ox, nz: oz }, as, 'banner-face', ctx.K.wall)) continue;
    ctx.bannerBays = [...(ctx.bannerBays || []), e];
    b.notes.push('A banner on the wall.');
    return true;
  }
  return false;
}

// Round and many-sided plans (generate.js octagonDesign keeps b.octo): corner motifs from walls meeting at 135
// degrees on the vertices of the ground storey, and things hung on the plain bays. Placed after the furnishing.
function roundTrim(b, ctx) {
  const o = b.octo;
  if (!o || !MotifsD.plan) return 0;
  const X = ctx.profile || (ctx.profile = { sN: +ctx.stage[1], dN: +ctx.decor[1] });
  const MT = ctx.motifs || (ctx.motifs = MotifsD.plan(ctx));
  if (!MT) return 0;
  const used = new Set(), wt = ctx.C.wallStyle || 'plank';
  let n = 0;
  const c = X.sN >= 2 && /plank|half-timber|log/.test(wt) ? MT.get('corner', { angle: 135, wt }, true) : null;
  if (c) for (const v of o.verts) {
    const l = Math.hypot(v.x, v.z) || 1;
    if (MotifsD.place(b, c, { x: v.x, y: ctx.F, z: v.z, nx: v.x / l, nz: v.z / l }, null, { mirror: MT.mirror, ground: 0, inward: false, anyWall: true, lift: true }).length) { n++; used.add(c.m.id); }
  }
  if (X.dN >= 2) {
    let k = 0;
    for (const bay of o.bays) {
      if (bay.kind !== 'wall' || k >= (X.dN >= 3 ? 3 : 2) || (k && bay.i % 3)) continue;
      const m = MT.get('wallface', { wt }, bay.i === 4);
      if (!m) break;
      const placed = MotifsD.place(b, m, { x: bay.x, y: ctx.F, z: bay.z, nx: bay.nx, nz: bay.nz }, null, { mirror: MT.mirror, ground: 0, dry: true });
      // the lamp, banner or sign has to be there: its bracket alone is no accent
      if (!placed.some(p => MotifsD.PROPS.test(p.cls) || MotifsD.CARVED.test(p.cls))) continue;
      for (const p of placed) b.put(p.name, p.x, p.y, p.z, p.yaw, p.clip ? { trim: true, motif: m.m.id, footed: true, clip: p.clip } : { trim: true, motif: m.m.id, footed: true });
      k++; n++; used.add(m.m.id);
    }
  }
  if (used.size) { pruneMotifs(b, ctx); b.notes.push(`Trim after community builds: ${[...used].sort().join(', ')}.`); }
  return n;
}

// The upper gallery of a Norwegian loft (svalgang): a balcony three bays wide over the front door, on posts from the
// ground with a beam under its edge and a rail round it, reached by a door from the upper room. Below, it roofs the
// entrance like a porch.
function svalgang(b, ctx) {
  const { K, C, F, SH, edges, door, ladders, cells } = ctx, w0 = ctx.wings[0];
  if (!door || door.out[1] >= 0) return false;
  const yU = F + SH, zf = door.z;
  const front = new Map(edges.filter(e => e.out[1] < 0 && Math.abs(e.z - zf) < 0.01).map(e => [e.x, e]));
  // three bays of the front wall with the door among them, the door in the middle where it can be
  const xs = [[-2, 0, 2], [-4, -2, 0], [0, 2, 4]].map(o => o.map(d => door.x + d)).find(c => c.every(x => front.has(x)));
  if (!xs) return false;
  const x0 = xs[0] - 1, x1 = xs[2] + 1;
  // nothing in front of the door already (a porch, a stair, a walkway)
  if (b.pieces.some(p => p.z < zf - 0.5 && p.z > zf - 2.6 && p.x > x0 + 0.3 && p.x < x1 - 0.3 && p.y < yU + 1)) return false;
  // the upper door: a bay beside the middle whose inside cell is no ladder hole or landing
  const L = ladders || [];
  const freeCell = x => cells.has(`${x},${zf + 1}`) && !L.some(l => [l.hole, l.land, l.stand, ...(l.run || [])].some(c => c[0] === x && c[1] === zf + 1));
  const ux = xs.filter(x => x !== door.x).sort((a, c) => Math.abs(a - door.x) - Math.abs(c - door.x)).find(freeCell);
  if (ux == null) return false;
  // take out the upper bay's wall and window pieces, and build it again as a door
  const inBay = p => Math.abs(p.x - ux) < 1.01 && Math.abs(p.z - zf) < 0.3 && p.y > yU + 0.05 && p.y < yU + SH - 0.05 &&
    ['wall', 'window', 'door', 'beam'].includes(PD.piece(p.name).role) && !p.decor; // a half-timber brace too
  b.pieces = b.pieces.filter(p => !inBay(p));
  b.openings = (b.openings || []).filter(o => !(o.e.x === ux && Math.abs(o.y0 - yU) < 0.01));
  const e = front.get(ux);
  ctx.wallSegment(b, K, C, ux, yU, zf, e.yaw, SH, 'door');
  b.openings.push({ e, y0: yU, SH, storey: 1, kind: 'door', gallery: true });
  const pole = framePoleD(K, C), pole1 = K.pole1 || 'wood_pole', beam = K.beam || 'wood_beam', T = { trim: true };
  // floor, posts at the outer corners of each bay, beams under the edge and back to the wall, a rail round it
  for (const x of xs) b.put(K.floor, x, yU, zf - 1, 0, T);
  for (const x of [x0, xs[0] + 1, xs[1] + 1, x1]) {
    for (let y = 0; y < yU - 0.01;) { const h = yU - y >= 2 ? 2 : 1; b.put(h === 2 ? pole : pole1, x, y + h / 2, zf - 2, 0, T); y += h; }
    b.put(pole1, x, yU + 0.5, zf - 2, 0, T); // the rail's post
  }
  for (const x of xs) b.put(beam, x, yU - 0.15, zf - 2, 0, T);
  for (const x of [x0, x1]) b.put(beam, x, yU - 0.15, zf - 1, 90, T);
  // the rail: two beams on the posts (the round pole fence stands 2 m tall in the game, too high for a rail)
  for (const yr of [yU + 0.55, yU + 1.05]) {
    for (const x of xs) b.put(beam, x, yr, zf - 2, 0, T);
    for (const x of [x0, x1]) b.put(beam, x, yr, zf - 1, 90, T);
  }
  b.gallery = true;
  b.notes.push('An upper gallery over the front door with a door from the upper room, after the Norwegian lofts.');
  return true;
}

// A gabled porch over the front door (the entrance dormer of the community longhouses in the corpus): posts 4 m apart
// two metres out, a small 45 degree gable roof whose ridge runs from the door out, closed against the wall by a gable,
// and a gable triangle over the open front. Its eaves are 2.4 m up, clear of anyone walking in.
function gablePorch(b, ctx) {
  const { K, C, F, SH, edges, door, roofKind, flat } = ctx;
  if (!door || door.out[1] >= 0 || F > 0.01 || flat || ctx.dragonsHere === undefined) return false;
  if (!K.roof45 || !K.gable45) return false;
  const zf = door.z, x = door.x;
  const front = new Set(edges.filter(e => e.out[1] < 0 && Math.abs(e.z - zf) < 0.01).map(e => e.x));
  if (!front.has(x - 2) || !front.has(x + 2)) return false;
  if (b.pieces.some(p => p.z < zf - 0.3 && p.z > zf - 3.2 && Math.abs(p.x - x) < 2.6 && p.y > F - 0.5 && !['floor'].includes(PD.piece(p.name).role))) return false;
  const yR = F + 4.4, T = { trim: true }, pole = framePoleD(K, C), pole1 = K.pole1 || 'wood_pole', beam = K.beam || 'wood_beam';
  for (const s of [-1, 1]) {
    b.put(pole, x + 2 * s, F + 1, zf - 2, 0, T);
    b.put(pole1, x + 2 * s, F + 1.9, zf - 2, 0, T);
    b.put(beam, x + 2 * s, F + 2.35, zf - 1, 90, T); // plate from the wall to the post
    b.put(beam, x + s, F + 2.35, zf - 2, 0, T); // tie beam across the front
    b.put(K.roof45, x + s, yR - 1, zf - 1, s > 0 ? 90 : 270, T);
    for (const z of [zf - 2, zf]) b.put(K.gable45, x + s, yR - 2, z, s > 0 ? 180 : 0, T); // the open front, and the back closing it against the wall
    b.put(slopeBeam(K, 45), x + s, yR - 1, zf - 2.08, s > 0 ? 180 : 0, T); // bargeboard on the open front
  }
  b.put(K.roofTop45, x, yR, zf - 1, 90, T);
  if (ctx.profile.crossed) b.put('wood_wall_roof_top_45', x, yR - 1, zf - 2, 0, T); // crossed boards over the porch gable, crossing where the bargeboards' lines meet (this roof's rows sit a metre closer to the ridge than a house's)
  if (!b.pieces.some(p => p.name === K.floor && Math.abs(p.x - x) < 0.1 && Math.abs(p.z - (zf - 1)) < 0.1)) b.put(K.floor, x, F, zf - 1, 0, T);
  b.notes.push('A gabled porch over the front door.');
  return true;
}

// Bargeboards for one wing's gable ends, as roof parts (generate.js lays them with the rest of the roof so crossing
// wings hide them where another roof runs over). Arguments as gablePieces: K, C, the wing, the roof top, rise per row,
// which ends get a gable, and helpers to place a part in wing-local coordinates.
function bargeboards(K, C, w, ctx, rows, ends, add, low, pivot, r) {
  const X = ctx.profile;
  if (!X) return;
  const name = slopeBeam(K, r === 2 ? 45 : 26), beam = K.beam || 'wood_beam', capY = low(-1);
  // motifs from the best-liked builds for the gable faces and the eaves (lib/motifs.js), in wing-local terms
  const MT = X.motifs && X.motifRoof ? (ctx.motifs || (ctx.motifs = MotifsD.plan(ctx))) : null;
  const gm = MT && MT.get('gable', { slope: r === 2 ? 45 : 26 }, true);
  // eave motifs where the roof runs a meter past the wall (D-059 B): the trim builders put under an overhang, fitted
  // to eaves 0.5 to 1.5 m past the wall's face (the generator's stand 0.9 m past it); a roof ending at the wall has
  // no room under it for them
  const eo0 = ctx.eaveOut || 0, top = low((w.D - 3) / 2), yE = low(rows) - (r / 2) * eo0;
  // a side of a deep eave (D-150) kept at 1 m where it faced another wing (generate.js gablePieces)
  const eoSide = sv => (eo0 === 2 && ctx.eaveShort && ctx.eaveShort.has(`${w.cx},${w.cz},${sv}`) ? 1 : eo0);
  const eaveSkip = p => {
    // between the wall's face and a little past the roof's edge, within the bay
    if (p.o < -eo0 + 0.15 || p.o > 0.35 || Math.abs(p.a) > 1.05) return true;
    // close to the wall no lower than 0.9 m under its top (the upper windows), further out no lower than 0.6 m under
    // the eave's edge
    const half = PD.piece(p.name).size[1] / 2;
    if ((p.o < -eo0 + 0.6 && p.y - half < top - 0.9) || p.y - half < yE - 0.6) return true;
    // under the roof: nothing through it (the roof rises inward from the edge; a board just under the edge is fine)
    const under = (r / 2) * Math.max(0, -p.o) + 0.12;
    return p.h + half > under;
  };
  const em = X.eaveMotifs !== false && eo0 && MT && rows === (w.D - 3) / 2 && MT.get('eave', { slope: r === 2 ? 45 : 26, overhang: eo0 - 0.1 }, true,
    c => MotifsD.roofParts(c, { x: 0, y: yE, z: 3 + 2 * rows + eo0, nx: 0, nz: 1 }, null, { skip: eaveSkip, minShare: 0.75, dry: true }) > 0);
  const gw = X.gableWindow && !C.stoneWalls && capY - top >= 3.9;
  let gableDone = false, apex = false, eaveDone = false;
  // the roof's parts go in by generate.js; their world places are kept so the last pass can find them
  const al = (w.alpha || 0) * Math.PI / 180, keys = ctx.motifKeys || (ctx.motifKeys = new Set());
  const addM = (n, u, y, v, yaw, role, surf) => {
    add(n, u, y, v, yaw, role, surf);
    keys.add(`${n}|${Math.round((w.cx + u * Math.cos(al) + v * Math.sin(al)) * 10)}|${Math.round(y * 10)}|${Math.round((w.cz - u * Math.sin(al) + v * Math.cos(al)) * 10)}`);
  };
  if (gm) [-1, 1].forEach((sg, k) => {
    if (!ends[k]) return;
    const n = MotifsD.roofParts(gm, { x: sg * w.W, y: capY, z: 0, nx: sg, nz: 0 }, addM, { mirror: MT.mirror, skip: p => {
      const v = Math.abs(p.z), h = PD.piece(p.name).size[1] / 2;
      if (v > w.D - 0.3 || p.y - h < top - 0.05 || p.o < -0.35 || p.o > 1.3) return true; // inside the gable, in front of it
      // a long beam standing straight out of the gable face reads as a stray plank
      if (/^beam(2|4)$/.test(p.cls) && Math.abs(Math.cos((p.yaw - (sg > 0 ? 90 : 270)) * Math.PI / 180)) < 0.5) return true;
      // under the roof line: the motif's piece may not stand out through the roof
      if (p.y > capY - (r / 2) * Math.max(0, v - 1) + 0.6) return true;
      if (ctx.dragonsHere && v < 1.5 && p.y > capY - 1.5) return true;
      if (gw && v < 1.4 && p.y > top - 0.2 && p.y < top + 2.4) return true; // the loft window
      // the rules' bargeboards run the whole edge: the motif's own on that line would double them
      if (X.bargeboards && /^beam(26|45|67)$/.test(p.cls) && Math.abs((capY - p.y) - (r / 2) * v) < 0.9) return true;
      if (p.y > capY - 1.2 && v < 1) apex = true;
      return false;
    } });
    if (n) gableDone = true;
  });
  if (gableDone) ctx.motifUsed = [...(ctx.motifUsed || []), gm.m.id];
  const a = (w.alpha || 0) * Math.PI / 180;
  const overDoor = (u, v) => { const x = w.cx + u * Math.cos(a) + v * Math.sin(a), z = w.cz - u * Math.sin(a) + v * Math.cos(a);
    return (ctx.openings || []).some(o => o.kind !== 'window' && o.storey === 0 && Math.hypot(o.e.x - x, o.e.z - z) < 2.2); };
  // the eaves: one bay of the motif on every 2 m of the overhanging row, both sides, never over a door; the frame is
  // the row's low edge, a meter past the wall line
  if (em && X.eaveTrim) {
    const edge = 3 + 2 * rows;
    let n = 0;
    for (let u = -w.W + 1; u <= w.W - 1 + 0.01; u += 2) for (const sv of [-1, 1])
      if (!overDoor(u, sv * w.D) && eoSide(sv) === eo0) n += MotifsD.roofParts(em, { x: u, y: yE, z: sv * (edge + eo0), nx: 0, nz: sv }, addM, { mirror: MT.mirror, skip: eaveSkip });
    if (n) { eaveDone = true; ctx.motifUsed = [...(ctx.motifUsed || []), em.m.id]; }
  }
  // rafter tails: a sloped beam at every seam of the lowest roof row, half a metre out past its edge and just under it
  // (the exposed rafters of Norse halls; the corpus lays sloped beams along roof piece edges)
  // (never over a door or gate: a 45 degree beam is 0.4 m thick in the game and hangs into the doorway)
  if (X.rafterTails && !eaveDone && !(ctx.eaveOut || 0)) for (let u = -w.W + 2; u <= w.W - 2 + 0.01; u += 2) for (const sv of [-1, 1]) {
    const v = sv * (2 + 2 * rows + 0.7);
    if (overDoor(u, sv * w.D)) continue;
    add(name, u, pivot(rows) - 0.7 - (r === 2 ? 0 : 0), v, (sv < 0 ? 180 : 0) + 90, 'trim', low(rows));
  }
  // the ridge beam's end out past each gable
  if (X.purlinEnds && !ctx.dragonsHere && ctx.wings.length === 1) [-1, 1].forEach((sg, k) => { if (ends[k]) add(K.beam1 || 'wood_beam_1', sg * (w.W + 0.55), capY - 0.35, 0, 0, 'trim', capY); });
  // a timber truss on the face of each gable: a king post up the middle and a collar beam across at half height
  if (X.gableTruss && !gableDone) [-1, 1].forEach((sg, k) => {
    if (!ends[k] || capY - low(rows) < 2.9) return;
    const u = sg * (w.W + 0.1), top = low(rows) + (r === 2 ? 0 : 0), h = capY - top;
    const from = X.gableWindow && h >= 3.9 ? top + 2.2 : top;
    for (let y = from; y < capY - 0.6;) { const step = capY - 0.6 - y >= 2 ? 2 : 1; add(step === 2 ? (K.pole || 'wood_pole2') : (K.pole1 || 'wood_pole'), u, y + step / 2, 0, 0, 'trim', y + step); y += step; }
    const yc = top + Math.round(h / 2);
    // collar beams wherever 2 m of beam fits under the roof at that height
    for (let v = -w.D + 2; v <= w.D - 2 + 0.01; v += 2) {
      const edge = Math.abs(v) + 1, surf = capY - (r / 2) * Math.max(0, edge - 1);
      if (surf > yc + 0.3) add(beam, u, yc, v, 90, 'trim', yc + 0.1);
    }
  });
  // beam ends under the overhanging eaves, one at every roof seam, a metre long, just under the roof (D-059)
  const rk = ctx.rake || 0, eo = ctx.eaveOut || 0;
  if (eo && !eaveDone) for (let u = -w.W + 2; u <= w.W - 2 + 0.01; u += 2) for (const sv of [-1, 1]) {
    if (overDoor(u, sv * w.D)) continue;
    add(K.beam1 || 'wood_beam_1', u, top - r / 4 - 0.3, sv * (w.D + 0.5), 90, 'trim', top - r / 4 - 0.2);
  }
  // a banner on the face of each gable of the main wing at d3, hung from just under the apex, where no loft window,
  // gable motif apex piece or carving is in the way and the gable is tall enough that it clears the wall under it
  // (on a low gable it hangs on down the wall under it, where that wall has no opening in its middle bays)
  if (X.gableBanner && w === ctx.wings[0] && !gw && !apex && !ctx.dragonsHere && capY - top >= 1.9) {
    // any banner in any biome (D-065); the gable's colors by the culture's lean are a style's, the list is whole
    const B = ['piece_banner01', 'piece_banner02', 'piece_banner03', 'piece_banner04', 'piece_banner05', 'piece_banner06', 'piece_banner07', 'piece_banner08', 'piece_banner09'];
    // the cloth hangs 2.95 m under its rod: its foot no more than 0.6 m over the ground floor, so it reads as hung on
    // the house and not in the air (T-606: the purple banner, piece_banner09, hung with its foot 1.3 m up). The rod
    // touches the wall (that holds it up in the game), so the cloth hangs 0.25 m out: it may lie against bars up to 3 cm
    // further out (the 2x2 wood wall's stand 0.28 m), and over a wall with deeper relief no banner goes up
    const name = (X.banner && X.banner.name) || B[makeHash(ctx) % B.length], yTop = Math.min(capY - 0.8, ctx.F + 2.95 + 0.6), low2 = yTop - 2.95;
    const out = 0.25, barred = low2 < top - 0.05 && relief(K.wall || 'woodwall') + 0.01 - out > 0.03; // the cloth is 2 cm thick
    if (low2 >= ctx.F + 0.1 && !barred) [-1, 1].forEach((sg, k) => {
      if (!ends[k]) return;
      const x = w.cx + sg * w.W * Math.cos(al), z = w.cz - sg * w.W * Math.sin(al);
      if (low2 < top - 0.05 && (ctx.openings || []).some(o => Math.hypot(o.e.x - x, o.e.z - z) < 1.6 && o.y0 + (o.SH || 3) > low2)) return;
      add(name, sg * (w.W + out), yTop, 0, sg > 0 ? 180 : 0, 'trim', yTop); // its front out from the gable
      // where it went, so exterior() can mark it decor once the roof is in (a crossing roof may have hidden it)
      (ctx.gableBannerAt = ctx.gableBannerAt || []).push({ name, x: w.cx + sg * (w.W + out) * Math.cos(al), y: yTop, z: w.cz - sg * (w.W + out) * Math.sin(al) });
    });
  }
  if (!X.bargeboards) return;
  [-1, 1].forEach((sg, k) => {
    if (!ends[k]) return;
    const u = sg * (w.W + rk + 0.06);
    for (let i = 0; i <= rows; i++) for (const sv of [-1, 1]) {
      const v = sv * (2 + 2 * i), roofYaw = sv < 0 ? 180 : 0;
      add(name, u, pivot(i), v, roofYaw + 90, 'trim', low(i) + r);
    }
    // and along the overhanging eave row
    // (a deep eave, D-150: a whole row out)
    if (eo) for (const sv of [-1, 1]) {
      if (overDoor(sg * w.W, sv * w.D) || overDoor(sg * w.W, sv * (w.D - 2))) continue;
      if (eoSide(sv) === 2) add(name, u, pivot(rows + 1), sv * (2 + 2 * (rows + 1)), (sv < 0 ? 180 : 0) + 90, 'trim', low(rows + 1) + r);
      else add(name, u, pivot(rows) - r / 2, sv * (2 + 2 * rows + 1), (sv < 0 ? 180 : 0) + 90, 'trim', low(rows));
    }
    // crossed boards over the apex: the game's Wood Roof Cross (the piece is the pair of crossed boards that Norwegian
    // vindskier end in), on the ridge where it meets the gable, as a quarter of the corpus builds have it. Corpus
    // builds set its pivot at the ridge cap's height (958 of the crosses beside a 45 degree cap, the next most common
    // 142 at 2 m) and its boards run on in line with the 45 degree bargeboards (1,881 of 5,042 in-plane beams on a
    // board's line, the rest 2 m or more off it: lab/shell_mine.js), so the boards carry the bargeboards on past the
    // apex and cross over the ridge (showcase 13: set a metre lower, they ran a metre under the bargeboards' line)
    if (X.crossed && !ctx.dragonsHere && !apex) add(r === 2 ? 'wood_wall_roof_top_45' : 'wood_wall_roof_top', sg * (w.W + rk), capY, 0, 90, 'trim', capY + (r === 2 ? 2 : 1));
  });
}

// ---------------------------------------------------------------- partition (before the furnishing)

// A big house gets a back room: a wall across the main wing two cells from one end, with a door in the middle bay.
function partition(b, ctx, wallSegment) {
  const X = ctx.profile;
  if (!X || !X.partition) return false;
  const { K, C, F, SH, cells, door, ladders, flue } = ctx, w0 = ctx.wings[0];
  if (w0.alpha !== 0 || w0.W < 5 || w0.D < 3) return false;
  const sides = ctx.R() < 0.5 ? [1, -1] : [-1, 1];
  for (const sg of sides) {
    const xp = w0.cx + sg * (w0.W - 4); // two 2 m cells deep
    if (Math.abs(xp - door.x) < 2.5) continue;
    if (flue && xp > flue.x0 - 1 && xp < flue.x1 + 1) continue;
    // the back room never takes the hearth: a fire against the end wall keeps the main room's end
    const keep = ctx.fireKeep || flue;
    if (keep && sg * ((keep.x0 + keep.x1) / 2 - xp) > 0) continue;
    const zs = [...cells.values()].filter(([x, z]) => Math.abs(x - (xp - sg)) < 0.01 && Math.abs(z - w0.cz) < w0.D).map(([, z]) => z).sort((a, c) => a - c);
    if (zs.length < 3) continue;
    // ladders keep their foot, hole and landing
    const blocked = (ladders || []).some(L => [L.stand, L.hole, L.land, ...(L.run || [])].some(c => Math.abs(c[0] - xp) < 1.01));
    if (blocked) continue;
    const mid = zs.slice().sort((a, c) => Math.abs(a - w0.cz) - Math.abs(c - w0.cz))[0];
    // (an inside wall is timber: masonry on a timber floor takes no support from it and falls, an Ashlands stone-base
    // tavern's grausten partition on its ash floor)
    for (const z of zs) wallSegment(b, K, C, xp, F, z, 90, SH, z === mid ? 'door' : 'wall', F > 0.01 || !/stone|marble|grausten/.test(C.wallStyle || '') || C.wallStyle === 'stone-base' ? 'plank' : null);
    b.pieces.push(...[]);
    b.notes.push('A back room behind a wall with a door.');
    b.partitionX = xp;
    return true;
  }
  return false;
}

// A bench against the wall beside the front door, facing out (a place to sit in the evening). After the furnishing,
// so the woodpiles and stacks the decorator sets outside keep their places.
function benchByDoor(b, ctx) {
  const X = ctx.profile, F = ctx.F;
  if (!X.benchOut || F > 0.01) return;
  const edgeAt = new Map(ctx.edges.map(e => [`${e.x},${e.z}`, e]));
  for (const o of b.openings || []) {
    if (o.kind !== 'door' || o.back || o.storey > 0 || o.gallery) continue;
    const { e } = o, { ux, uz, ox, oz } = axes(e);
    const name = ctx.R() < 0.4 ? 'piece_logbench01' : 'piece_bench01';
    const faceOut = name === 'piece_logbench01' ? outYaw(-ox, -oz) : outYaw(ox, oz); // the log bench faces its local -z
    for (const s of ctx.R() < 0.5 ? [1, -1] : [-1, 1]) {
      const cand = { name, x: +(e.x + ux * s * 3 + ox * 0.45).toFixed(3), y: F + 0.1, z: +(e.z + uz * s * 3 + oz * 0.45).toFixed(3), yaw: faceOut, q: quatD(faceOut) };
      if (!edgeAt.has(`${e.x + ux * s * 2},${e.z + uz * s * 2}`) || !edgeAt.has(`${e.x + ux * s * 4},${e.z + uz * s * 4}`)) continue; // wall behind it
      if (!clear(b, cand)) continue;
      // not before another door (the second leaf of a wide entrance is the bay beside), nor against a door's torch or
      // any other piece put up outside (the decorator's audit reads their catalog boxes, a little wider than the solids)
      if ((b.openings || []).some(o2 => o2 !== o && ['door', 'gate'].includes(o2.kind) && !o2.storey && Math.abs((o2.e.x - cand.x) * ux + (o2.e.z - cand.z) * uz) < 2 && Math.abs((o2.e.x - cand.x) * ox + (o2.e.z - cand.z) * oz) < 1.5)) continue;
      { const cb0 = checksD().aabb(cand); if (b.pieces.some(q => q.decor && (c => c.x0 < cb0.x1 + 0.15 && c.x1 > cb0.x0 - 0.15 && c.z0 < cb0.z1 + 0.15 && c.z1 > cb0.z0 - 0.15 && c.y0 < cb0.y1 && c.y1 > cb0.y0)(checksD().aabb(q)))) continue; }
      // nor within 0.6 m of a stair or ladder, as the decorator's audit reads a climb through the wall (a straight
      // stair up the inside of the front wall to an s3 upper floor, integration round 4)
      const cb = checksD().aabb(cand);
      if (b.pieces.some(q => !q.decor && PD.piece(q.name).role === 'stair' && (c => cb.x0 < c.x1 + 0.6 && cb.x1 > c.x0 - 0.6 && cb.z0 < c.z1 + 0.6 && cb.z1 > c.z0 - 0.6 && cb.y0 < c.y1 + 0.3 && cb.y1 > c.y0)(checksD().aabb(q)))) continue;
      b.pieces.push({ ...cand, decor: true, trim: true });
      break;
    }
    return;
  }
}

// ---------------------------------------------------------------- interior (after the furnishing)

// Whether a box on the floor reaches into a door's way in: 0.45 m either side of the opening's middle and 0.15 m
// more, the corridor's depth either side of the door's plane (as lib/checks.js doorBlockers walks it)
function kerbInDoorway(b, cb, corridor) {
  for (const d of b.pieces) {
    if (d.decor || PD.piece(d.name).role !== 'door') continue;
    const o = PD.doorOpening(d);
    if (cb.y0 > o.y + 2.3 || cb.y1 < o.y) continue;
    const cx = (cb.x0 + cb.x1) / 2 - o.x, cz = (cb.z0 + cb.z1) / 2 - o.z, hx = (cb.x1 - cb.x0) / 2, hz = (cb.z1 - cb.z0) / 2;
    const along = Math.abs(cx * o.ux + cz * o.uz) - (hx * Math.abs(o.ux) + hz * Math.abs(o.uz));
    const across = Math.abs(cx * o.nx + cz * o.nz) - (hx * Math.abs(o.nx) + hz * Math.abs(o.nz));
    if (along < 0.6 && across < corridor + 0.1) return true;
  }
  return false;
}
function interior(b, ctx) {
  const X = ctx.profile;
  if (!X) return;
  commitMotifs(b, ctx);
  const { K } = ctx, Ck = checksD();
  benchByDoor(b, ctx);
  const furniture = () => b.pieces.filter(p => p.decor);
  // a kerb of beams round a fire pit on the floor, so it reads as a hearth set into the floor
  // (a fire against a wall gets the kerb on its open sides; a fire in a stone alcove has the alcove's floor)
  if (X.fireKerb && !(ctx.hearth && ctx.hearth.spot === 'stack')) {
    const fire = b.pieces.find(p => p.decor && p.name === 'fire_pit');
    if (fire) {
      const beam = K.beam || 'wood_beam', y = fire.y + 0.0;
      const walls = b.pieces.filter(p => !p.decor && ['wall', 'pole', 'window', 'door'].includes(PD.piece(p.name).role)).map(p => Ck.aabb(p));
      const ring = [[0, -1.15, 0], [0, 1.15, 0], [-1.15, 0, 90], [1.15, 0, 90]].map(([dx, dz, yaw]) => ({ name: beam, x: fire.x + dx, y, z: fire.z + dz, yaw, q: quatD(yaw) }))
        .filter(c => { const cb = Ck.aabb(c); return !walls.some(o => o.x0 < cb.x1 - 0.05 && o.x1 > cb.x0 + 0.05 && o.z0 < cb.z1 - 0.05 && o.z1 > cb.z0 + 0.05 && o.y0 < cb.y1 + 0.3 && o.y1 > cb.y0); })
        // and a side that lies in a doorway's way in (checks.js doors: 1 m in and out from the opening) is
        // left open (tavern Meadows s3d3 seed 321 had its fire 2 m inside a door)
        .filter(c => !kerbInDoorway(b, Ck.aabb(c), Ck.CORRIDOR || 1));
      const ok = ring.every(c => { const cb = Ck.aabb(c); return !furniture().some(p => p !== fire && !/cookingstation|cauldron/.test(p.name) && PD.piece(p.name).role !== 'rug' && (o => o.x0 < cb.x1 && o.x1 > cb.x0 && o.z0 < cb.z1 && o.z1 > cb.z0 && o.y0 < cb.y1 + 0.3 && o.y1 > cb.y0)(Ck.aabb(p))); });
      if (ok) { for (const c of ring) b.put(c.name, c.x, c.y, c.z, c.yaw, { trim: true }); b.notes.push('A kerb of beams round the fire pit.'); }
    }
  }
  // raised benches along the long walls of a hall (the Viking pallr): a platform 0.3 m up and 1 m deep wherever the
  // wall is free, widened under beds, chests and benches that stand against the wall, which are lifted onto it
  if (X.wallBenches && ctx.F < 0.01) {
    const w0 = ctx.wings[0], lift = 0.3, f1 = K.floor1 || 'wood_floor_1x1', beam = K.beam || 'wood_beam';
    const zones = ctx.zones || [];
    const liftable = p => p.decor && ['bed', 'storage', 'seat'].includes(PD.piece(p.name).role) && !/throne/.test(p.name);
    let laid = 0;
    for (const sz of [-1, 1]) {
      const zWall = w0.cz + sz * w0.D, y = ctx.F + lift;
      const rowZ = k => zWall - sz * (0.5 + k); // 1 m rows out from the wall
      const cellBox = (x, k) => ({ x0: x - 0.5, x1: x + 0.5, z0: rowZ(k) - 0.5, z1: rowZ(k) + 0.5 });
      const ov = (a, o) => o.x0 < a.x1 - 0.02 && o.x1 > a.x0 + 0.02 && o.z0 < a.z1 - 0.02 && o.z1 > a.z0 + 0.02;
      const cells = new Map(); // "x|k" -> true
      const lifted = [];
      // furniture against this wall: its footprint becomes platform, the piece goes up onto it
      for (const p of b.pieces) {
        if (!liftable(p)) continue;
        const o = Ck.aabb(p);
        const near = sz > 0 ? zWall - o.z1 : o.z0 - zWall;
        if (near > 0.6 || near < -0.3 || Math.abs(o.y0 - (ctx.F + 0.1)) > 0.3) continue;
        const depth = sz > 0 ? zWall - o.z0 : o.z1 - zWall;
        if (depth > 3.1 || o.x0 < w0.cx - w0.W || o.x1 > w0.cx + w0.W) continue;
        // a piece that would rise into a stair's or doorway's keep-clear box stays where it is
        const up = { x0: o.x0, x1: o.x1, z0: o.z0, z1: o.z1, y0: o.y0 + lift, y1: o.y1 + lift };
        if (zones.some(zn => ov(up, zn) && zn.y0 < up.y1 && zn.y1 > up.y0)) continue;
        lifted.push({ p, o, k: Math.ceil(depth - 0.05) });
      }
      const blocked = box => b.pieces.some(p => {
        if (lifted.some(l => l.p === p)) return false;
        const role = PD.piece(p.name).role;
        if (!p.decor && ['floor', 'roof', 'roofTop', 'roofCorner', 'gable', 'wall', 'beam'].includes(role)) return false;
        if (role === 'rug') return false;
        const o = Ck.aabb(p);
        return o.y0 < y + 2 && o.y1 > y - lift && ov(box, o);
      }) || zones.some(zn => zn.y0 < y + 2 && zn.y1 > y - lift && ov(box, zn));
      for (let x = w0.cx - w0.W + 0.5; x < w0.cx + w0.W; x += 1) if (!blocked(cellBox(x, 0))) cells.set(`${x}|0`, true);
      for (const l of lifted) {
        const want = [];
        for (let x = w0.cx - w0.W + 0.5; x < w0.cx + w0.W; x += 1) for (let k = 0; k < l.k; k++) if (ov(cellBox(x, k), l.o)) want.push([x, k]);
        if (!want.length || want.some(([x, k]) => blocked(cellBox(x, k)))) { l.skip = true; continue; }
        for (const [x, k] of want) cells.set(`${x}|${k}`, true);
      }
      // only runs of three meters or more along the wall make a bench; lifted pieces keep their own platform
      const row0 = [...cells.keys()].filter(c => c.endsWith('|0')).map(c => +c.split('|')[0]).sort((a, c) => a - c);
      const runs = [];
      for (const x of row0) { const r = runs[runs.length - 1]; if (r && x - r[r.length - 1] < 1.01) r.push(x); else runs.push([x]); }
      const keep = new Set();
      for (const r of runs) {
        const hasLift = lifted.some(l => !l.skip && r.some(x => x > l.o.x0 - 0.5 && x < l.o.x1 + 0.5));
        if (r.length >= 3 || hasLift) for (const x of r) keep.add(`${x}|0`);
      }
      for (const l of lifted) if (!l.skip) for (const c of cells.keys()) { const [x, k] = c.split('|').map(Number); if (k > 0 && x > l.o.x0 - 0.5 && x < l.o.x1 + 0.5) keep.add(c); }
      if (!keep.size) continue;
      for (const c of keep) {
        const [x, k] = c.split('|').map(Number);
        b.put(f1, x, y, rowZ(k), 0, { trim: true });
        // it rests on short beams laid across under each cell
        b.put(K.beam1 || 'wood_beam_1', x, y - 0.1, rowZ(k), 90, { trim: true });
        laid++;
      }
      for (const l of lifted) if (!l.skip) {
        const ok = [...keep].some(c => { const [x] = c.split('|').map(Number); return x > l.o.x0 - 0.5 && x < l.o.x1 + 0.5; });
        if (!ok) continue;
        // whatever stands on the piece goes up with it
        for (const q of b.pieces) if (q === l.p || (q.decor && q.x > l.o.x0 && q.x < l.o.x1 && q.z > l.o.z0 && q.z < l.o.z1 && q.y > l.p.y + 0.2 && q.y < l.p.y + 1.5)) q.y = +(q.y + lift).toFixed(3);
      }
    }
    if (laid) b.notes.push('Raised benches along the long walls, with the beds and chests up on them.');
  }
}

const apiD = { profile, exterior, bargeboards, partition, interior, slopeBeam, commitMotifs, roundTrim, planter, planterSurfaces, PLANTS_HOLD, PLANTS_FALL };
if (NODE_D) module.exports = apiD; else window.VHDetails = apiD;
