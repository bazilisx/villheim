// Things on item stands round the house (Tyler, 2026-11-10): the item stands, flat (itemstandh) and on the wall
// (itemstand), that the best builders use more than any other piece to make a room look lived in. Food and drink on
// the table, a mug left on a bench or a chair, tools hung over the workbench, trophies over the bed and the hearth,
// shields over a bench, a pantry or a shelf of curios on the wall, herbs and a jar on the sill, a helmet or a fish on a
// beam overhead, something on a chest lid, and at the third stage now and then a feast laid out on the dining table
// with the serving tray (the feast pieces). Every set here is one or a few stands in the corpus's own arrangements
// (lab/mine_stands.js: where builders put them, how high, how far apart, in what groups) and is placed by the interior
// library's fitter (lib/kitbash.js fit), so it is tested for clips, rests, doorways and windows like any set. What each
// stand holds is the household's pick for that place (lib/persona.js standItem: p.at says where it is, p.want what the
// set asks for).
//
// Runs after the library and the walking lanes and before the lived-in pass (lib/kitbash.js apply), from a stream of
// its own seeded by the household, so the rest of a design comes out as before. How much goes up follows the
// household (cluttered or tidy, hobbies, wealth, size), the room and the decor stage: a share at d2, the rest at d3
// (p.ds), so each stage holds the one before it.
const NODE_S = typeof module !== 'undefined';
const PBs = NODE_S ? require('./pieces.js') : window.VHPieces;
const KBs = () => (NODE_S ? require('./kitbash.js') : window.VHKitbash);
const PSs = () => (NODE_S ? require('./persona.js') : window.VHPersona);
const Cks = () => (NODE_S ? require('./checks.js') : window.VHChecks);
const Ds = () => (NODE_S ? require('./decorate.js') : window.VHDecorate);
const Mes = () => (NODE_S ? require('./mesh.js') : window.VHMesh);

function rngS(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const normS = a => ((a % 360) + 360) % 360;
// a piece of a set: as lib/kitbash.js kp, with where the stand is (at) and what it should hold (want)
// (the two go to the stand as one word, 'drink@table', since the fitter carries only want; lib/persona.js dressStands
// splits it)
const sp = (n, x, y, z, yaw, rest, o) => {
  const e = Object.assign({}, o || {});
  if (e.want || e.at) e.want = `${e.want || ''}@${e.at || ''}`;
  delete e.at;
  return Object.assign({ n, k: KBs().slotOf(n), x, y, z, yaw, rest }, e);
};
const H = (x, z, yaw, o) => sp('itemstandh', x, 0.8, z, yaw, 'anchor', o); // a flat stand on what the set is anchored to
const W = (x, y, o) => sp('itemstand', x, y, 0.045, 0, 'wall', o); // a wall stand
const set = (id, anchor, pieces, o) => Object.assign({ id, anchor, rooms: [], pieces, clips: [], score: 6, built: true, min: 1 }, o || {});

// ---------------------------------------------------------------- the sets
// Frames as the library's (lib/kitbash.js BUILT_KITS): a table's, bench's, chest's or beam's pivot with its own turn
// (x along it); a wall's surface with +z into the room; y over the floor's top (a flat stand on what it rests on is
// set onto its top by the fitter). Turns of flat stands follow the corpus (every way, most often square or at 45).
// lean: the household traits a set suits (lib/persona.js kitWeight reads the same form); n: the least number of
// people at home it suits; stage: 3 for sets that only come at the third stage.
const SETS = [
  // on a table (the corpus's piece_table: settings along the length, 0.4 to 0.5 m apart, a seat's width from the edge)
  set('KS-t-meal2', 'table', [H(-0.55, 0.3, 45, { want: 'drink', at: 'table' }), H(-0.15, 0.32, 0, { want: 'food', at: 'table' }),
    H(0.5, -0.3, 225, { want: 'food', at: 'table' }), H(0.85, -0.28, 180, { want: 'drink', at: 'table' })], { of: 'table', lean: { food: 0.6 }, min: 3 }),
  set('KS-t-meal4', 'table', [H(-0.8, 0.3, 30, { want: 'drink', at: 'table' }), H(-0.4, 0.33, 0, { want: 'food', at: 'table' }), H(0.4, 0.3, 90, { want: 'food', at: 'table' }),
    H(0.82, 0.27, 45, { want: 'drink', at: 'table' }), H(-0.6, -0.3, 180, { want: 'food', at: 'table' }), H(-0.15, -0.28, 225, { want: 'drink', at: 'table' }),
    H(0.55, -0.32, 135, { want: 'food', at: 'table' })], { of: 'table', lean: { food: 0.8, messy: 0.4 }, n: 3, min: 4 }),
  set('KS-t-mugs', 'table', [H(-0.6, 0.18, 112, { want: 'drink', at: 'table' }), H(-0.2, -0.26, 180, { want: 'drink', at: 'table' }), H(0.7, 0.2, 247, { want: 'drink', at: 'table' })],
    { of: 'table', lean: { games: 0.6, messy: 0.5 }, min: 2 }),
  set('KS-t-left', 'table', [H(0.45, 0.22, 62, { at: 'table' }), H(-0.35, -0.2, 300, { at: 'table' })], { of: 'table', lean: { messy: 0.7 }, min: 1 }),
  set('KS-t-tools', 'table', [H(-0.7, -0.02, 180, { want: 'tool', at: 'table' }), H(-0.25, 0.02, 180, { want: 'tool', at: 'table' }), H(0.3, -0.04, 180, { want: 'tool', at: 'table' })],
    { of: 'table', lean: { crafts: 1, busy: 0.4 }, min: 2 }),
  set('KS-t-arms', 'table', [H(0.05, 0.2, 180, { want: 'shield', at: 'table' }), H(-0.45, -0.15, 45, { want: 'weapon', at: 'table' }), H(0.55, -0.12, 315, { want: 'weapon', at: 'table' })],
    { of: 'table', lean: { collect: 0.9, wealth: 0.3 }, min: 2 }),
  set('KS-t-herbs', 'table', [H(-0.3, 0.18, 68, { want: 'herbs', at: 'table' }), H(-0.05, 0.3, 68, { want: 'herbs', at: 'table' }), H(-0.12, 0.05, 68, { want: 'herbs', at: 'table' }),
    H(0.6, -0.25, 135, { want: 'drink', at: 'table' })], { of: 'table', lean: { plants: 1 }, min: 3 }),
  set('KS-t-curio', 'table', [H(0, 0, 0, { want: 'rare', at: 'table' }), sp('Candle_resin', 0.45, 0.8, 0.1, 0, 'anchor')], { of: 'table', lean: { collect: 0.6, wealth: 0.8, tidy: 0.3 }, min: 1 }),
  // a round table: a ring at 0.5 to 0.8 m
  set('KS-r-meal', 'table', [H(-0.6, -0.34, 225, { want: 'drink', at: 'table' }), H(0.12, -0.68, 157, { want: 'food', at: 'table' }), H(-0.59, 0.42, 180, { want: 'drink', at: 'table' }),
    H(0.62, 0.3, 45, { want: 'food', at: 'table' })], { of: 'round', lean: { food: 0.6 }, min: 2 }),
  set('KS-r-mugs', 'table', [H(-0.55, 0.17, 0, { want: 'drink', at: 'table' }), H(0.73, 0.14, 0, { want: 'drink', at: 'table' }), H(0.04, -0.6, 90, { want: 'drink', at: 'table' })],
    { of: 'round', lean: { games: 0.8 }, min: 2 }),
  // a long table: a setting for each seat along it, a drink and a dish 0.55 m apart
  set('KS-l-meal', 'table', [H(-2.0, 0.62, 0, { want: 'drink', at: 'table' }), H(-1.45, 0.57, 45, { want: 'food', at: 'table' }), H(-0.95, -0.66, 180, { want: 'drink', at: 'table' }),
    H(-1.5, -0.68, 0, { want: 'food', at: 'table' }), H(1.1, 0.64, 0, { want: 'drink', at: 'table' }), H(1.66, 0.6, 203, { want: 'food', at: 'table' }),
    H(1.9, -0.67, 180, { want: 'drink', at: 'table' }), H(1.25, -0.69, 0, { want: 'food', at: 'table' })], { of: 'long', lean: { food: 0.5 }, min: 4 }),
  // a feast laid out on the dining table with the serving tray, drinks round it, the tray left on a stand beside it
  // (third stage; the feast pieces, 266 in 65 corpus builds, 150 on tables)
  // (the feast where the table's top is free: in the middle or to one end, the drinks and the tray round it)
  ...[[0, 0], [-0.45, 0.1], [0.45, -0.1], [-0.5, -0.12], [0.5, 0.12]].map(([fx, fz]) => set('KS-feast', 'table', [sp('FeastMeadows', fx, 0.8, fz, 0, 'anchor', { key: true, feast: true }),
    H(fx > 0 ? -0.35 : 0.35, fz > 0 ? -0.3 : 0.3, 45, { want: 'drink', at: 'table' }), H(fx > 0 ? -0.8 : 0.85, fz > 0 ? 0.25 : -0.28, 225, { want: 'drink', at: 'table' }),
    H(fx > 0 ? -0.75 : 0.9, fz > 0 ? -0.3 : 0.3, 0, { want: 'tray', at: 'table' })], { of: 'table', lean: { food: 1.4, wealth: 0.3 }, stage: 3, feast: true, min: 1 })),
  set('KS-feast-long', 'table', [sp('FeastMeadows', -1.4, 0.8, 0, 0, 'anchor', { key: true, feast: true }), sp('FeastMeadows', 1.4, 0.8, 0.05, 0, 'anchor', { feast: true }),
    H(-0.2, 0.55, 0, { want: 'drink', at: 'table' }), H(0.3, -0.6, 180, { want: 'drink', at: 'table' }), H(0.05, 0.1, 90, { want: 'tray', at: 'table' })],
  { of: 'long', lean: { food: 1, wealth: 0.4 }, stage: 3, feast: true, min: 2 }),
  // on a bench or a chair: a mug set down, now and then a dish or a helmet beside it
  set('KS-b-mug', 'bench', [H(0.6, 0.03, 45, { want: 'drink', at: 'bench' })], { lean: { messy: 0.6, food: 0.3 } }),
  set('KS-b-two', 'bench', [H(-0.6, 0.06, 0, { want: 'drink', at: 'bench' }), H(0.2, 0.08, 90, { at: 'bench' })], { lean: { messy: 0.6, collect: 0.3 } }),
  set('KS-c-mug', 'seat', [H(0.08, -0.05, 45, { want: 'drink', at: 'bench' })], { lean: { messy: 0.8 } }),
  // on a chest or a barrel's lid
  set('KS-ch-food', 'chest', [H(-0.3, 0.02, 90, { want: 'food', at: 'chest' }), H(0.3, -0.04, 0, { at: 'chest' })], { lean: { food: 0.6, messy: 0.4 } }),
  set('KS-ch-one', 'chest', [H(0.1, 0, 22, { at: 'chest' })], { lean: { messy: 0.3, collect: 0.3 } }),
  set('KS-ch-shield', 'chest', [H(-0.2, 0, 11, { want: 'shield', at: 'chest' }), H(0.35, 0.05, 90, { want: 'food', at: 'chest' })], { lean: { collect: 0.6 } }),
  // the wall over a workbench, a bench, a bed, a table, a chest, by the hearth or the door (the corpus's wall stands sit
  // at 1.3 to 2.3 m here, about a metre apart; kept between the 2x2 wall's bars by the fitter)
  set('KS-w-tools', 'wall', [W(-0.55, 1.55, { want: 'tool' }), W(0, 1.62, { want: 'tool' }), W(0.55, 1.55, { want: 'tool' })], { ctx: ['workbench', 'chest', 'door', 'plain'], lean: { crafts: 1.2 }, min: 2 }),
  set('KS-w-farm', 'wall', [W(-0.35, 1.55, { want: 'farm' }), W(0.35, 1.6, { want: 'farm' })], { ctx: ['door', 'chest', 'plain'], lean: { plants: 1.2 }, min: 1 }),
  set('KS-w-arms', 'wall', [W(0, 1.75, { want: 'shield', at: 'wall' }), W(-0.6, 1.65, { want: 'weapon' }), W(0.6, 1.65, { want: 'weapon' })], { ctx: ['table', 'chest', 'bench', 'hearth', 'plain'], lean: { collect: 1, wealth: 0.5 }, min: 2 }),
  set('KS-w-shields', 'wall', [W(-0.9, 1.95, { want: 'shield' }), W(0, 2.0, { want: 'shield' }), W(0.9, 1.95, { want: 'shield' })], { ctx: ['bench', 'table', 'hearth'], lean: { collect: 0.8, wealth: 0.6 }, min: 2 }),
  set('KS-w-trophy2', 'wall', [W(-0.5, 1.9, { want: 'trophy' }), W(0.5, 1.95, { want: 'trophy' })], { ctx: ['bed', 'hearth', 'bench', 'table', 'plain'], lean: { collect: 1.2 }, min: 1 }),
  set('KS-w-trophy3', 'wall', [W(-0.95, 1.8, { want: 'trophy' }), W(0, 2.05, { want: 'trophy' }), W(0.95, 1.8, { want: 'trophy' })], { ctx: ['hearth', 'bench', 'plain'], lean: { collect: 1.4, wealth: 0.3 }, min: 2 }),
  set('KS-w-one', 'wall', [W(0, 1.75, {})], { ctx: ['bed', 'door', 'chest', 'table', 'bench', 'hearth', 'workbench', 'plain'], lean: {} }),
  set('KS-w-fish', 'wall', [W(-0.3, 1.75, { want: 'fishing' }), W(0.35, 1.6, { want: 'fish' })], { ctx: ['door', 'hearth', 'chest', 'plain'], lean: { food: 0.6 }, min: 2 }),
  // shelves: a ledge on the wall with stands on it (pantry, meads, herbs, curios), two ledges for a cluttered house
  set('KS-s-pantry', 'wall', [sp('wood_ledge', 0, 1.45, 0.3, 0, 'wall', { key: true }), sp('itemstandh', -0.32, 1.5, 0.3, 90, 'on', { on: 0, want: 'food', at: 'shelf' }),
    sp('itemstandh', 0.02, 1.5, 0.33, 0, 'on', { on: 0, want: 'food', at: 'shelf' }), sp('itemstandh', 0.33, 1.5, 0.28, 45, 'on', { on: 0, want: 'drink', at: 'shelf' })],
  { ctx: ['table', 'chest', 'hearth', 'plain'], lean: { food: 1, messy: 0.3 }, min: 3 }),
  set('KS-s-meads', 'wall', [sp('wood_ledge', 0, 1.6, 0.3, 0, 'wall', { key: true }), sp('itemstandh', -0.35, 1.65, 0.3, 90, 'on', { on: 0, want: 'drink', at: 'shelf' }),
    sp('itemstandh', 0, 1.65, 0.3, 90, 'on', { on: 0, want: 'drink', at: 'shelf' }), sp('itemstandh', 0.35, 1.65, 0.3, 90, 'on', { on: 0, want: 'drink', at: 'shelf' })],
  { ctx: ['table', 'bench', 'hearth', 'plain'], lean: { food: 0.6, games: 0.4 }, min: 3 }),
  set('KS-s-herbs', 'wall', [sp('wood_ledge', 0, 1.5, 0.3, 0, 'wall', { key: true }), sp('itemstandh', -0.3, 1.55, 0.25, 68, 'on', { on: 0, want: 'herbs', at: 'shelf' }),
    sp('itemstandh', 0.0, 1.55, 0.35, 68, 'on', { on: 0, want: 'herbs', at: 'shelf' }), sp('Candle_resin', 0.32, 1.55, 0.3, 0, 'on', { on: 0 })], { ctx: ['table', 'chest', 'plain'], lean: { plants: 1.2 }, min: 2 }),
  set('KS-s-curios', 'wall', [sp('wood_ledge', 0, 1.65, 0.3, 0, 'wall', { key: true }), sp('itemstandh', -0.3, 1.7, 0.3, 0, 'on', { on: 0, want: 'rare', at: 'shelf' }),
    sp('itemstandh', 0.05, 1.7, 0.3, 315, 'on', { on: 0, want: 'hat', at: 'shelf' }), sp('itemstandh', 0.35, 1.7, 0.3, 180, 'on', { on: 0, at: 'shelf' })],
  { ctx: ['bed', 'bench', 'table', 'plain'], lean: { collect: 1, wealth: 0.6 }, min: 2 }),
  set('KS-s-two', 'wall', [sp('wood_ledge', 0, 1.15, 0.3, 0, 'wall', { key: true }), sp('wood_ledge', 0, 1.8, 0.3, 0, 'wall'),
    sp('itemstandh', -0.3, 1.2, 0.3, 45, 'on', { on: 0, at: 'shelf' }), sp('itemstandh', 0.25, 1.2, 0.3, 0, 'on', { on: 0, at: 'shelf' }),
    sp('itemstandh', -0.2, 1.85, 0.3, 90, 'on', { on: 1, at: 'shelf' }), sp('itemstandh', 0.3, 1.85, 0.3, 180, 'on', { on: 1, at: 'shelf' })],
  { ctx: ['chest', 'table', 'plain'], lean: { messy: 0.8, busy: 0.4 }, stage: 3, min: 4 }),
  set('KS-s-arms', 'wall', [sp('wood_ledge', 0, 1.4, 0.3, 0, 'wall', { key: true }), sp('itemstandh', -0.25, 1.45, 0.3, 90, 'on', { on: 0, want: 'weapon', at: 'shelf' }),
    sp('itemstandh', 0.25, 1.45, 0.3, 270, 'on', { on: 0, want: 'weapon', at: 'shelf' })], { ctx: ['workbench', 'chest', 'plain'], lean: { collect: 0.7, crafts: 0.4 }, min: 2 }),
  // a mantel by the hearth: a ledge with drinks, a trophy and a candle (the corpus's stands by the fire hold mead)
  set('KS-mantel', 'wall', [sp('wood_ledge', 0, 1.4, 0.3, 0, 'wall', { key: true }), sp('itemstandh', -0.35, 1.45, 0.3, 90, 'on', { on: 0, want: 'drink', at: 'mantel' }),
    sp('itemstandh', 0.0, 1.45, 0.3, 0, 'on', { on: 0, at: 'mantel' }), sp('Candle_resin', 0.35, 1.45, 0.3, 0, 'on', { on: 0 })], { ctx: ['hearth'], lean: { comfort: 0.5 }, min: 2 }),
  // up in the rafters: a beam set high on the wall, at the roof's foot, with helmets, trophies, fish or herbs on it
  // (the corpus's stands on beams over 2.3 m; most houses here have no tie beam across a room to put them on)
  // (a beam where the wall's face is plain that high, else a plank shelf, which may slide up or down past the 2x2
  // wall's bars)
  set('KS-hi-beam', 'wall', [sp('wood_beam_1', 0, 2.6, 0.1, 0, 'wall', { key: true }), sp('itemstandh', -0.25, 2.7, 0.1, 90, 'on', { on: 0, at: 'rafter' }),
    sp('itemstandh', 0.25, 2.7, 0.1, 0, 'on', { on: 0, at: 'rafter' })], { ctx: ['bed', 'bench', 'table', 'hearth', 'chest', 'plain', 'door'], lean: { collect: 0.5, plants: 0.3 }, high: 3.15, min: 2 }),
  set('KS-hi-shelf', 'wall', [sp('wood_ledge', 0, 2.3, 0.3, 0, 'wall', { key: true }), sp('itemstandh', -0.3, 2.35, 0.3, 90, 'on', { on: 0, at: 'rafter' }),
    sp('itemstandh', 0.05, 2.35, 0.32, 0, 'on', { on: 0, at: 'rafter' }), sp('itemstandh', 0.35, 2.35, 0.28, 45, 'on', { on: 0, at: 'rafter' })],
  { ctx: ['bed', 'bench', 'table', 'hearth', 'chest', 'plain', 'door'], lean: { collect: 0.5, plants: 0.3 }, high: 2.85, min: 2 }),
  set('KS-hi-herbs', 'wall', [sp('wood_ledge', 0, 2.3, 0.3, 0, 'wall', { key: true }), sp('itemstandh', -0.32, 2.35, 0.3, 68, 'on', { on: 0, want: 'herbs', at: 'rafter' }),
    sp('itemstandh', 0, 2.35, 0.3, 68, 'on', { on: 0, want: 'herbs', at: 'rafter' }), sp('itemstandh', 0.32, 2.35, 0.3, 68, 'on', { on: 0, want: 'herbs', at: 'rafter' })],
  { ctx: ['table', 'hearth', 'chest', 'plain'], lean: { plants: 0.9, food: 0.4 }, high: 2.85, min: 2 }),
  // a mug or a dish left on the floor by a bed or a seat (a cluttered house)
  set('KS-f-mug', 'bed', [sp('itemstandh', 1.15, 0, 0.55, 30, 'floor', { want: 'drink', at: 'floor' })], { lean: { messy: 1.4 }, stage: 3 }),
];
// Sets of wall stands also come a little higher and lower, so one of them finds the plain wall between a wall's bars
// (the fitter slides each up to 0.4 m from where it is put; a set's stands keep together)
for (const s0 of SETS.slice()) {
  if (s0.anchor !== 'wall' || s0.high || !s0.pieces.every(q => q.n === 'itemstand')) continue;
  for (const dy of [-0.4, 0.4]) {
    const ys = s0.pieces.map(q => q.y + dy);
    if (Math.min(...ys) < 1.0 || Math.max(...ys) > 2.3) continue;
    SETS.push(Object.assign({}, s0, { pieces: s0.pieces.map(q => Object.assign({}, q, { y: +(q.y + dy).toFixed(2) })) }));
  }
}
// on the sill of a window: stands set on the wall below the opening (made for each window, see sillSet)
const SILL = [[{ x: -0.25, want: 'herbs', yaw: 20 }, { x: 0.22, yaw: 300 }], [{ x: 0, yaw: 0 }], [{ x: -0.3, want: 'food', yaw: 90 }, { x: 0.05, want: 'drink', yaw: 0 }, { x: 0.33, want: 'herbs', yaw: 45 }]];
// on a beam overhead: one to three stands along it, half a metre apart (helmets, trophies, fish, herbs hung to dry)
const RAFTER = [[{ x: 0 }], [{ x: -0.3 }, { x: 0.3 }], [{ x: -0.55, want: 'herbs' }, { x: 0, want: 'herbs' }, { x: 0.55, want: 'herbs' }]];

// how well a set suits a household: from 0.3 (none of what it leans on) to 1.7 and more (all of it), as kitWeight
function leanWeight(P, s) {
  if (!P) return 1;
  let w = 1;
  for (const [t, k] of Object.entries(s.lean || {})) {
    const v = t === 'messy' ? P.clutter : t === 'austere' ? 1 - P.comfort : t in P.hobby ? P.hobby[t] : P[t];
    if (typeof v === 'number') w *= 1 + k * (1.4 * v - 0.7);
  }
  return Math.max(0.05, w);
}

const TABLES = /^(piece_table|piece_table_round|piece_table_oak|piece_blackmarble_table|dvergrprops_table|piece_table_runed)$/;
const BENCHES = /^(piece_bench01|piece_logbench01|piece_blackwood_bench01|piece_blackmarble_bench|piece_bench_runed)$/;
const SEATS = /^(piece_chair|piece_chair02|piece_chair03|dvergrprops_stool|dvergrprops_chair|piece_chair_runed)$/;
const CHESTS = /^(piece_chest_wood|piece_chest|piece_chest_barrel|piece_chest_blackmetal|dvergrprops_barrel|dvergrprops_crate)$/;
const FIRES_S = /^(hearth|fire_pit|fire_pit_iron)$/;
const WORK_S = /^(piece_workbench|forge|piece_artisanstation|blackforge|piece_stonecutter|piece_cauldron|piece_spinningwheel)/;
const FEAST_S = { Meadows: 'FeastMeadows', 'Black Forest': 'FeastBlackforest', Swamp: 'FeastSwamps', Mountain: 'FeastMountains', Plains: 'FeastPlains',
  Mistlands: 'FeastMistlands', Ashlands: 'FeastAshlands', 'Deep North': 'FeastMountains' };
const ROOMS_S = ['home', 'sleeping', 'guest', 'hall', 'tavern', 'kitchen', 'temple', 'smithy', 'workshop', 'storage', 'guard', 'market'];

/**
 * Dresses the house with item stands. ctx: the furnishing's context (biome, decor, persona, type). Returns the number
 * of sets placed.
 */
function dressTops(b, ctx, zones, rooms) {
  if (ctx.decor === 'd1') return 0;
  const KB = KBs(), PS = PSs(), Ck = Cks(), D = Ds();
  if (!PBs.decorOk('itemstandh', ctx.biome)) return 0;
  const P = ctx.persona;
  const R = rngS(((P ? P.salt : 7) ^ 0x57a4d5) >>> 0);
  const idx = KB.boxIndex(b.pieces);
  const fires = b.pieces.filter(p => p.decor && FIRES_S.test(p.name)).map(p => ({ p, b: Ck.aabb(p) }));
  const clutter = P ? P.clutter : 0.45, size = P ? P.size : 3;
  const P2 = Object.assign({}, P || {}, { hobby: (P && P.hobby) || { crafts: 0.3, collect: 0.3, plants: 0.3, food: 0.3, games: 0.3, maps: 0.3 } });
  let placed = 0;
  for (const room of rooms || KB.roomsB(b, ctx)) {
    if (!ROOMS_S.includes(room.role)) continue;
    const m = room.m;
    if (m.area < 4) continue;
    const inR = p => m.inside(p.x, p.z) && Math.abs(p.y - m.stand) < 0.9;
    // the room's furniture and anchors
    const furn = b.pieces.filter(p => p.decor && inR(p));
    const hasOn = p => { const o = Ck.aabb(p); return furn.filter(q => q !== p && q.x > o.x0 && q.x < o.x1 && q.z > o.z0 && q.z < o.z1 && q.y > o.y1 - 0.15 && q.y < o.y1 + 0.5).length; };
    const cands = [];
    const add = (s, anc, w) => { if (w > 0) cands.push({ s, anc, w }); };
    const kitAnchors = KB.anchorsOf(room, b);
    const wallAnchors = kitAnchors.filter(an => an.anchor === 'wall');
    const doors = b.pieces.filter(p => !p.decor && PBs.piece(p.name).role === 'door' && Math.abs(p.y - m.stand - 1) < 1.2);
    // a feast at most once in a room, never where one is laid out already
    const feasted = b.pieces.some(p => /^Feast[A-Z]/.test(p.name) && inR(p));
    const sets = SETS.filter(s => (!s.n || size >= s.n) && (!s.feast || (ctx.decor === 'd3' && !feasted)));
    for (const p of furn) {
      const yaw = normS(p.yaw || 0);
      if (TABLES.test(p.name)) {
        // a table already set (the library's own table sets) takes nothing more, but for a feast in its middle; one
        // with a candle or one dish may
        const on = hasOn(p);
        const of = /round/.test(p.name) ? 'round' : /oak|blackmarble/.test(p.name) ? 'long' : 'table';
        for (const s of sets) if (s.anchor === 'table' && (s.of === of || (s.of === 'table' && of === 'long')) && (on < 2 || (s.feast && on < 5))) add(s, { anchor: 'table', x: p.x, z: p.z, yaw, of: p, akind: of }, 1);
      } else if (BENCHES.test(p.name)) {
        if (hasOn(p)) continue;
        for (const s of sets) if (s.anchor === 'bench') add(s, { anchor: 'bench', x: p.x, z: p.z, yaw, of: p }, 0.5);
      } else if (SEATS.test(p.name)) {
        if (hasOn(p)) continue;
        for (const s of sets) if (s.anchor === 'seat') add(s, { anchor: 'seat', x: p.x, z: p.z, yaw, of: p }, 0.35);
      } else if (CHESTS.test(p.name)) {
        if (hasOn(p) || p.y > m.stand + 0.3) continue;
        for (const s of sets) if (s.anchor === 'chest') add(s, { anchor: 'chest', x: p.x, z: p.z, yaw, of: p }, 0.45);
      } else if (/^(bed|piece_bed02|ashwood_bed)$/.test(p.name)) {
        for (const s of sets) if (s.anchor === 'bed') add(s, { anchor: 'bed', x: p.x, z: p.z, yaw, of: p }, 0.6);
      }
    }
    // wall spots by what stands in front of them (the corpus's wall stands over a workbench, a bed, the hearth...)
    for (const an of wallAnchors) {
      const ctxW = wallContext(an, furn, fires, doors);
      for (const s of sets) {
        if (s.anchor !== 'wall' || !s.ctx || !s.ctx.includes(ctxW)) continue;
        // plain wall the whole width of the set and a little more (no window, door or opening, not past the wall's end)
        const half = Math.max(...s.pieces.map(q => Math.abs(q.x))) + 0.35;
        const st = D._int.stretch(an.face, an.t - half, an.t + half);
        if ([...st.ks].some(k => k !== 'wall')) continue;
        // and clear of the wall's ends (the next wall round the corner, a partition's end)
        if (an.t - half - 0.6 < an.face.a0 || an.t + half + 0.6 > an.face.a1) continue;
        if (s.high && m.ceilAt(an.x + Math.sin(an.yaw * Math.PI / 180) * 0.15, an.z + Math.cos(an.yaw * Math.PI / 180) * 0.15) - m.stand < s.high) continue;
        add(s, Object.assign({ ctxW }, an), (ctxW === 'plain' ? 0.25 : 0.6) * (s.high ? 0.6 * (P ? 0.4 + P.likes.hung * 0.6 : 1) : 1));
      }
    }
    // windows: their sill
    for (const an of kitAnchors.filter(a => a.anchor === 'window')) {
      const s = sillSet(an, m, idx, R);
      if (s) add(s, Object.assign({}, an, { of: s._of }), 1.2 * (P ? 0.4 + P.likes.sill * 0.8 : 1));
    }
    // beams overhead
    for (const bm of beamsOver(b, m, idx)) {
      const s = rafterSet(bm, R);
      add(s, { anchor: 'beam', x: bm.p.x, z: bm.p.z, yaw: normS(bm.p.yaw || 0), of: bm.p }, 0.7 * (P ? 0.4 + P.likes.hung * 0.6 : 1));
    }
    if (!cands.length) continue;
    for (const c of cands) c.w *= leanWeight(P2, c.s) * (c.s.feast ? 0.12 : 1);
    // how many sets: by floor area, the household's clutter, and the stage (a share at d2, the rest at d3)
    const per = ['tavern', 'hall'].includes(room.role) ? 9 : ['smithy', 'workshop', 'storage'].includes(room.role) ? 14 : 8;
    const want3 = Math.max(1, Math.round(m.area / per * (0.55 + 0.9 * clutter) * (P && P.plain ? 0.7 : 1) + R() * 1.2));
    const want2 = Math.max(1, Math.round(want3 * (0.45 + 0.2 * R())));
    let n = 0, tries = 0;
    const usedAnc = [], usedSet = {};
    while (n < want3 && tries < 80 && cands.length) {
      tries++;
      const wt = c => c.w / (1 + 1.5 * (usedSet[c.s.id] || 0));
      let tot = 0;
      for (const c of cands) tot += wt(c);
      let r = R() * tot, pick = cands[cands.length - 1];
      for (const c of cands) { r -= wt(c); if (r <= 0) { pick = c; break; } }
      cands.splice(cands.indexOf(pick), 1);
      const an = pick.anc;
      if (usedAnc.some(u => (an.of && u.of === an.of) || (an.anchor === u.anchor && Math.hypot(u.x - an.x, u.z - an.z) < (an.anchor === 'wall' ? 1.6 : 0.6)))) continue;
      if (an.anchor === 'wall' && wallBusy(an, idx, m, pick.s)) continue;
      const s = pick.s;
      if (s.feast && !PBs.decorOk(FEAST_S[ctx.biome] || 'FeastMeadows', ctx.biome)) continue;
      let got = null;
      for (const mir of R() < 0.5 ? [false, true] : [true, false]) { got = KB.fit(b, ctx, room, idx, zones, an, s, mir, fires); if (got) break; }
      if (DEBUG_S) {
        let k = `${s.id} ${got ? 'ok' : 'why' + KB.why()}`;
        if (!got && [13, 17].includes(KB.why())) { const r = KB._fitDebug(b, Object.assign({}, ctx, { zones }), room, an, s); k += ` ${r.piece} ${r.why === 17 ? r.q.replace(/[0-9. ]+$/, '') : D.oneWhy ? D.oneWhy() : ''}`; }
        DEBUG_S[k] = (DEBUG_S[k] || 0) + 1;
      }
      if (!got) continue;
      // never before what it stands on (a bench of a set that comes at the third stage)
      const ds = Math.max(s.stage === 3 || n >= want2 ? 3 : 2, (an.of && an.of.decor && an.of.ds) || 0);
      // a flat stand on a wall's or a beam's top sits on what shows of it (the half wall's planks stand a few
      // centimeters over its collider), as the pool audit's mountClip measures it
      const Me = Mes();
      if (Me) for (const p of got) {
        if (p.name !== 'itemstandh') continue;
        const A = Me.world(p);
        if (!A || !A.length) continue;
        let deep = 0;
        for (const r of idx.near(Cks().aabb(p), 0.1)) {
          if (r.p.decor && !r.p.trim) continue;
          if (!['wall', 'halfwall', 'window', 'beam', 'pole', 'gable', 'door'].includes(PBs.piece(r.p.name).role)) continue;
          const B = Me.world(r.p);
          if (B) deep = Math.max(deep, Me.deepest(A, B));
        }
        if (deep > 0.01) p.y = +(p.y + deep + 0.005).toFixed(3);
      }
      for (const p of got) {
        p.ds = ds;
        // a wall stand's place, from the wall's context, where its set did not say
        if (/^itemstandh?$/.test(p.name) && !(p.want && /@./.test(p.want))) {
          const at = an.ctxW ? (an.ctxW === 'plain' ? 'wall' : `wall:${an.ctxW}`) : an.anchor === 'beam' ? 'rafter' : an.anchor === 'window' ? 'sill' : '';
          if (at) p.want = `${(p.want || '').split('@')[0]}@${at}`;
        }
        b.pieces.push(p); idx.add(p);
      }
      usedAnc.push(an);
      usedSet[s.id] = (usedSet[s.id] || 0) + 1;
      if (s.feast) for (let k = cands.length - 1; k >= 0; k--) if (cands[k].s.feast) cands.splice(k, 1);
      n++; placed++;
    }
  }
  if (placed) b.notes.push(`${placed} sets of things on stands: on tables, benches, chests, shelves, sills, beams and walls.`);
  return placed;
}

// What stands in front of a wall spot: the corpus's wall stands by what is under them.
function wallContext(an, furn, fires, doors) {
  const nx = Math.sin(an.yaw * Math.PI / 180), nz = Math.cos(an.yaw * Math.PI / 180), ux = Math.cos(an.yaw * Math.PI / 180), uz = -Math.sin(an.yaw * Math.PI / 180);
  let best = null, bd = Infinity;
  for (const p of furn) {
    const dx = p.x - an.x, dz = p.z - an.z, out = dx * nx + dz * nz, along = dx * ux + dz * uz;
    if (out < -0.1 || out > 1.6 || Math.abs(along) > 1.0) continue;
    const r = PBs.piece(p.name).role;
    const k = WORK_S.test(p.name) ? 'workbench' : r === 'bed' ? 'bed' : r === 'table' ? 'table' : r === 'seat' ? 'bench' : r === 'storage' ? 'chest' : null;
    if (k && out + Math.abs(along) < bd) { bd = out + Math.abs(along); best = k; }
  }
  if (best) return best;
  if (fires.some(f => Math.hypot((f.b.x0 + f.b.x1) / 2 - an.x, (f.b.z0 + f.b.z1) / 2 - an.z) < 2.6)) return 'hearth';
  if ((doors || []).some(d => Math.hypot(d.x - an.x, d.z - an.z) < 1.6)) return 'door';
  return 'plain';
}
// Is a wall spot taken: something hung within 0.9 m either side of the set at 1.0 to 2.5 m, or tall furniture in front
function wallBusy(an, idx, m, s) {
  const half = Math.max(...s.pieces.map(q => Math.abs(q.x))) + 0.6;
  const ux = Math.cos(an.yaw * Math.PI / 180), uz = -Math.sin(an.yaw * Math.PI / 180), nx = Math.sin(an.yaw * Math.PI / 180), nz = Math.cos(an.yaw * Math.PI / 180);
  const xs = [an.x - ux * half, an.x + ux * half, an.x + nx * 0.6], zs = [an.z - uz * half, an.z + uz * half, an.z + nz * 0.6];
  const box = { x0: Math.min(...xs) - 0.05, x1: Math.max(...xs) + 0.05, z0: Math.min(...zs) - 0.05, z1: Math.max(...zs) + 0.05 };
  return idx.near(box, 0).some(r => r.p.decor && PBs.piece(r.p.name).role !== 'rug' && r.b.y1 > m.stand + 1.1 && r.b.y0 < m.stand + 2.5 &&
    r.b.x0 < box.x1 && r.b.x1 > box.x0 && r.b.z0 < box.z1 && r.b.z1 > box.z0);
}
// A window's sill: the wall piece under the opening, its top within reach (0.6 to 1.5 m), and stands on it.
function sillSet(an, m, idx, R) {
  const f = an.face;
  if (!f || !an.w) return null;
  const st = Ds()._int.stretch(f, an.t - 0.3, an.t + 0.3);
  if (!isFinite(st.top) || st.top < 0.55 || st.top > 1.5) return null;
  // the piece the sill is: structure under the opening at the wall's middle line
  const x = an.x - f.nx * f.ht, z = an.z - f.nz * f.ht, top = m.stand + st.top;
  // the highest top there under the opening
  const under = idx.near({ x0: x - 0.05, x1: x + 0.05, z0: z - 0.05, z1: z + 0.05 }, 0)
    .filter(r => !r.p.decor && ['wall', 'halfwall', 'beam', 'window'].includes(r.b.info.role) && Math.abs(r.b.y1 - top) < 0.15 && r.b.x0 < x && r.b.x1 > x && r.b.z0 < z && r.b.z1 > z)
    .sort((p, q) => q.b.y1 - p.b.y1)[0];
  if (!under) return null;
  // spots across the opening, 0.3 m in from its sides; one to three of them, the household's pick
  const spots = [];
  for (let x = -an.w / 2 + 0.3; x <= an.w / 2 - 0.3 + 0.01; x += 0.25) spots.push(+x.toFixed(2));
  if (!spots.length) return null;
  const k = Math.min(spots.length, 1 + Math.floor(R() * 2.4)), first = Math.floor(R() * Math.max(1, spots.length - (k - 1) * 2));
  const look = SILL[Math.floor(R() * SILL.length)];
  const pick = [];
  for (let i = 0; i < k; i++) { const x = spots[Math.min(spots.length - 1, first + i * 2)]; if (!pick.some(q => q.x === x)) pick.push(Object.assign({}, look[i % look.length], { x })); }
  const s = set('KS-sill', 'window', pick.map(q => sp('itemstandh', q.x, st.top, -f.ht, q.yaw || 0, 'anchor', { want: q.want, at: 'sill' })), { lean: { plants: 0.4 } });
  s._of = under.p;
  return s;
}
// Beams overhead in a room: level, at least 0.9 m long, their top 2.1 to 3.3 m over the floor, room over them for a
// helmet or a trophy (0.55 m).
function beamsOver(b, m, idx) {
  const out = [];
  for (const p of b.pieces) {
    if (p.decor || PBs.piece(p.name).role !== 'beam' || !m.inside(p.x, p.z)) continue;
    const q = p.q || [0, 0, 0, 1];
    if (Math.abs(q[0]) > 0.01 || Math.abs(q[2]) > 0.01) continue;
    const o = Cks().aabb(p);
    if (o.y1 < m.stand + 2.1 || o.y1 > m.stand + 3.3 || Math.max(o.x1 - o.x0, o.z1 - o.z0) < 0.9) continue;
    if (m.ceilAt(p.x, p.z) - o.y1 < 0.55) continue;
    // across the room: the room's floor on both sides of it (a wall plate along a wall carries the wall over it)
    const a = (p.yaw || 0) * Math.PI / 180, nx = Math.sin(a), nz = Math.cos(a);
    if (!m.inside(p.x + nx * 0.6, p.z + nz * 0.6) || !m.inside(p.x - nx * 0.6, p.z - nz * 0.6)) continue;
    out.push({ p, o });
  }
  return out;
}
function rafterSet(bm, R) {
  const len = Math.max(bm.o.x1 - bm.o.x0, bm.o.z1 - bm.o.z0);
  const opts = RAFTER.filter(l => Math.max(...l.map(q => Math.abs(q.x))) < len / 2 - 0.15);
  const pick = opts[Math.floor(R() * opts.length)] || RAFTER[0];
  return set('KS-rafter', 'beam', pick.map(q => sp('itemstandh', q.x, 2.5, 0, Math.floor(R() * 8) * 45, 'anchor', { want: q.want, at: 'rafter' })), { lean: { collect: 0.4, plants: 0.3 } });
}
let DEBUG_S = null;
const apiS = { debug: d => { DEBUG_S = d; }, dressTops, SETS, SILL, RAFTER, leanWeight, wallContext };
if (NODE_S) module.exports = apiS; else window.VHStands = apiS;
