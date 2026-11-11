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
const SHs = () => (NODE_S ? require('./shapes.js') : window.VHShapes);

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
  set('KS-t-row', 'table', [H(-0.52, -0.3, 90, { want: 'drink', at: 'table' }), H(-0.17, -0.3, 90, { want: 'drink', at: 'table' }), H(0.18, -0.3, 90, { want: 'drink', at: 'table' }),
    H(0.53, -0.29, 90, { at: 'table' })], { of: 'table', lean: { food: 0.5, tidy: 0.4 }, min: 3 }),
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
  set('KS-ch-three', 'chest', [H(-0.35, 0.05, 45, { at: 'chest' }), H(0, -0.06, 90, { want: 'food', at: 'chest' }), H(0.33, 0.04, 0, { want: 'drink', at: 'chest' })], { lean: { messy: 0.7, food: 0.4 }, min: 2 }),
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
  // on a low wall's top (a counter, a divider, the half wall behind a bench): the corpus's counter stands are mostly
  // one alone (151 of 200 groups), now and then a pair, three or a row of four drinks; they hold drink, food, a hat, a
  // trophy or a weapon (data/stands-corpus.json counter, anchorKinds itemstandh|counter)
  set('KS-co-one', 'counter', [H(0, 0, 30, { at: 'counter' })], { lean: {} }),
  set('KS-co-two', 'counter', [H(-0.22, 0, 0, { want: 'drink', at: 'counter' }), H(0.2, 0, 45, { at: 'counter' })], { lean: { messy: 0.4, food: 0.3 }, min: 2 }),
  set('KS-co-three', 'counter', [H(-0.35, 0, 90, { want: 'food', at: 'counter' }), H(0, 0, 0, { want: 'drink', at: 'counter' }), H(0.33, 0, 45, { at: 'counter' })], { lean: { food: 0.6, messy: 0.3 }, min: 3, len: 1.0 }),
  set('KS-co-row', 'counter', [H(-0.45, 0, 90, { want: 'drink', at: 'counter' }), H(-0.15, 0, 90, { want: 'drink', at: 'counter' }), H(0.15, 0, 90, { want: 'drink', at: 'counter' }),
    H(0.45, 0, 90, { want: 'drink', at: 'counter' })], { lean: { games: 0.6, food: 0.4 }, min: 3, len: 1.2 }),
  // a heap on the floor against a wall (a pantry corner): stands set into one another, food or drink (the corpus's heaps
  // of stands stand on the floor more than anywhere, 168 of 376; data/stands-corpus.json stacks pileOn), made by the
  // households that heap things (pileStands)
  set('KS-f-heap', 'wall', [sp('itemstandh', 0, 0, 0.28, 30, 'floor', { want: 'food@stand' })], { ctx: ['plain', 'chest', 'table', 'hearth', 'door'], lean: { food: 0.8, messy: 0.5 }, heap: true, min: 1 }),
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
// D-127 (Tyler, 2026-11-11): "if the corpus builders do it, its allowed and you should mirror their work". Corpus
// builders hang wall stands into what shows of the wall (the 2x2 wood wall's planks, a stone wall's bevels): of 4,318
// wall stands measured, the depth into what is behind them is 0 up to the 75th percentile and 4 cm at the 90th
// (data/stands-corpus.json clips, lab/mine_stands.js: the stand's shape into the collider of what is behind it). A stand
// hung that way against the collider goes into what shows of the wall by the depth of its relief: 4 to 11 cm on the
// generator's walls (measured over the d3 houses of lab/test_stands.js). So a wall stand of these sets may go up to
// WALL_SHOW into what shows (the fitter keeps the depth used on the stand as p.wclip, which lib/blueprint.js writes in
// '#VillheimClips', D-098), and dressTops refuses one that goes more than WALL_COLL into a collider.
const WALL_SHOW = 0.12, WALL_COLL = 0.04;
for (const s0 of SETS) if (s0.anchor === 'wall') s0.clips = s0.pieces.map((q, i) => (q.n === 'itemstand' ? [i, 'w', WALL_SHOW] : null)).filter(Boolean);
// how deep a wall stand goes into the colliders of the building round it (as the corpus miner measures it)
function intoCollider(p, idx) {
  const SH = SHs(), Ck = Cks(), A = SH.world(p);
  if (!A || !A.length) return 0;
  let m = 0;
  for (const r of idx.near(Ck.aabb(p), 0.05)) {
    if (r.p === p || (r.p.decor && !r.p.trim)) continue;
    const B = Ck.aabb(r.p).sol;
    if (B && B.length) m = Math.max(m, SH.clipDepth(A, B));
  }
  return m;
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
// the tables and what is not table dressing, as lab/essentials.js reads them for tablesDressed
const TD_TABLES = /^(piece_table|piece_table_round|piece_table_oak|dvergrprops_table|piece_blackmarble_table|cauldron_ext3_butchertable|piece_magetable)$/;
const TD_NOT = /^(rug_|jute_carpet|piece_chair\d*$|piece_bench01$|piece_logbench01$|piece_blackwood_bench01$|piece_blackmarble_bench$|dvergrprops_stool$|dvergrprops_chair$|piece_throne0\d$|piece_blackmarble_throne$|piece_bone_throne$|bed$|piece_bed0\d$|ashwood_bed$)/;
// workbenches and other stations as the corpus miner reads them for a wall stand over one (lab/mine_stands.js WORK)
const WORK_M = /^(piece_workbench|forge|piece_artisanstation|blackforge|piece_magetable|piece_stonecutter|piece_cartographytable|piece_preptable|piece_MeadCauldron|piece_cauldron|piece_butcher|piece_spinningwheel|windmill|piece_cookingstation|piece_oven|fermenter|piece_workbench_ext|forge_ext|piece_alchemy)/i;
const WORK_S = /^(piece_workbench|forge|piece_artisanstation|blackforge|piece_stonecutter|piece_cauldron|piece_spinningwheel)/;
const FEAST_S = { Meadows: 'FeastMeadows', 'Black Forest': 'FeastBlackforest', Swamp: 'FeastSwamps', Mountain: 'FeastMountains', Plains: 'FeastPlains',
  Mistlands: 'FeastMistlands', Ashlands: 'FeastAshlands', 'Deep North': 'FeastMountains' };
const ROOMS_S = ['home', 'sleeping', 'guest', 'hall', 'tavern', 'kitchen', 'temple', 'smithy', 'workshop', 'storage', 'guard', 'market'];

// ---------------------------------------------------------------- how much a household shows
// The corpus's house-like builds with stands hold a median of 19 stands (quartiles 5 and 49) and 7 distinct items (2
// and 20): a few builds show a great deal, many show a handful (lab/mine_stands.js, data/stands-corpus.json perBuild).
// Here that spread comes from the household and the village: a cluttered household, a collector, a well-off or cosy
// one shows more, a tidy or plain one little; the village's culture leans it a little (a setting: the corpus is not
// split by culture yet); and every household has its own share of chance on top. Never a fixed count per room.
const CULTURE_SHOW = { dwarven: 1.3, 'castle-medieval': 1.25, byzantine: 1.2, lamari: 1.15, norse: 1.1, slavic: 1.1, 'middle-eastern': 1.1,
  'norse-forest': 1.05, 'norse-highland': 0.95, mountain: 0.95, 'celtic-crannog': 0.85, 'fen-folk': 0.85, swamp: 0.9, steppe: 0.8,
  'east-asian': 0.8, saami: 0.75 };
const gaussS = R => { let s = 0; for (let i = 0; i < 4; i++) s += R(); return (s - 2) / 0.577; };
function showOf(P, ctx, R) {
  const H = (P && P.hobby) || {};
  const clutter = P ? P.clutter : 0.45, tidy = P ? P.tidy : 0.5, wealth = P ? P.wealth : 0.4, comfort = P ? P.comfort : 0.5;
  let s = 0.8 * (0.3 + 1.5 * clutter + 0.7 * (H.collect || 0) + 0.35 * (H.food || 0) + 0.25 * (H.plants || 0) + 0.3 * wealth + 0.2 * comfort - 0.4 * tidy);
  s *= CULTURE_SHOW[ctx.cultureKey || ctx.culture] || 1;
  if (P && P.plain) s *= 0.35;
  if (ctx.type === 'tavern') s *= 1.15;
  s *= Math.exp(0.7 * gaussS(R));
  return Math.min(4, Math.max(0.08, s));
}
// A flat stand on a table may be sunk into its top so only the item shows (a third of the corpus's flat stands sit
// over 6 cm into what they stand on). The depths are the corpus's (data/stands-corpus.json sinks: the 75th percentile
// 9.7 cm, the 90th 21.6 cm); deeper than its 90th percentile is never used. Some households (some builders) do it,
// most of the time; others never.
const SINK_Q = [[0, 0.06], [0.23, 0.097], [0.69, 0.216], [1, 0.216]]; // depth over 6 cm by its share among sunk stands
function sinkDepth(R) {
  const u = R();
  for (let i = 1; i < SINK_Q.length; i++) if (u <= SINK_Q[i][0]) { const [u0, d0] = SINK_Q[i - 1], [u1, d1] = SINK_Q[i]; return +(d0 + (d1 - d0) * (u - u0) / Math.max(1e-6, u1 - u0)).toFixed(3); }
  return 0.216;
}
// What kind of place a set dresses: each kind gets its own share of the picks, so having more sets or more anchors of
// one kind does not make it come up more often. The shares lean on where the corpus's stands are (data/stands-corpus.json
// anchors, stands holding something: of flat stands table 14.9 %, shelf 17.0, ledge 10.3, mantel 9.3, counter 3.3,
// bench 2.0, sill 1.7, rafter 1.7, chest 0.5; of wall stands wall and beam 29 %, over a workbench or bench 15, by the
// hearth 12, over a chest 7, a table 7, a bed 4, by a door 4). The interior library and the decorator already put up
// most of the shelf, mantel and wall stands, so this pass gives tables the largest share. Tyler, 2026-11-10: "I rarely
// see stands on rafters. I sometimes see stands on sills. I constantly see stands on tables."
// Read at the lid (the corpus rerun of 2026-11-11), chests carry 1.5 % of the corpus's flat stands at these places and
// counters 6.6 %.
const CLASS_W = { table: 1.6, wall: 1.4, shelf: 0.8, bench: 0.45, hearth: 0.3, rafter: 0.22, chest: 0.06, sill: 1.1, floor: 0.15, counter: 1.0,
  wtable: 0.08, wbed: 0.05, wdoor: 0.2 };
function classOf(s, an) {
  if (s.anchor === 'table') return 'table';
  if (s.anchor === 'bench' || s.anchor === 'seat') return 'bench';
  if (s.anchor === 'chest') return 'chest';
  if (s.anchor === 'counter') return 'counter';
  if (s.anchor === 'bed' || s.heap) return 'floor';
  if (s.anchor === 'window') return 'sill';
  if (s.anchor === 'beam' || s.high) return 'rafter';
  if (s.id === 'KS-mantel' || (an && an.ctxW === 'hearth')) return 'hearth';
  // a wall set counts where the corpus miner counts it: by what stands under it
  if (an && (an.ctxW === 'bench' || an.ctxW === 'workbench')) return 'bench';
  if (an && an.ctxW === 'chest') return 'chest';
  if (/^KS-s-/.test(s.id)) return 'shelf';
  // the wall over a table, over a bed and by a door each its own share: in small rooms most wall spots are within the
  // miner's reach of a table or a bed, and a share split only among the room's wall spots would put most there
  if (an && an.ctxW === 'table') return 'wtable';
  if (an && an.ctxW === 'bed') return 'wbed';
  if (an && an.ctxW === 'door') return 'wdoor';
  return 'wall';
}
const isStand = p => /^itemstandh?$/.test(p.name);
// the chance a household puts things at each kind of place, before its traits (favLean)
const FAV_P = { table: 0.7, wall: 0.65, shelf: 0.5, bench: 0.4, hearth: 0.25, rafter: 0.2, chest: 0.12, sill: 0.45, floor: 0.25, counter: 0.55 };
// how a household's traits lean those chances (lib/persona.js: likes are about 0.3 to 1.8, hobbies 0 to 1): pots and
// things on the sill, things hung up, shelves, food and drink on the table, tools by the bench
function favLean(P, cl) {
  if (!P) return 1;
  const L = P.likes || {}, Hb = P.hobby || {};
  const k = { sill: 0.4 + 0.6 * (L.sill || 0.8), rafter: 0.4 + 0.6 * (L.hung || 0.8), wall: 0.6 + 0.4 * (L.hung || 0.8) + 0.3 * (Hb.collect || 0),
    shelf: 0.5 + 0.6 * (L.shelves || 0.8), counter: 0.6 + 0.4 * (L.shelves || 0.8) + 0.3 * (Hb.food || 0), table: 0.8 + 0.5 * (Hb.food || 0) + 0.3 * (Hb.games || 0), bench: 0.6 + 0.8 * (Hb.crafts || 0),
    hearth: 0.6 + 0.6 * (P.comfort || 0.5), chest: 0.6 + 0.6 * (P.clutter || 0.45) }[cl];
  return k == null ? 1 : k;
}
// a stand's place (lib/persona.js standAt) as one of those kinds
const AT_CLASS = at => /^(table|sidetable)$/.test(at) ? 'table' : /^(bench|workbench|wall:bench|wall:workbench)$/.test(at) ? 'bench' : /^(chest|wall:chest)$/.test(at) ? 'chest'
  : at === 'wall:hearth' || at === 'mantel' ? 'hearth' : at === 'rafter' ? 'rafter' : at === 'sill' ? 'sill' : at === 'shelf' ? 'shelf' : at === 'counter' ? 'counter' : 'wall';

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
  // how many stands the whole house shows: the household's share (showOf) of a number that grows with the floor
  const show = showOf(P, ctx, R);
  const roomList = (rooms || KB.roomsB(b, ctx)).filter(room => ROOMS_S.includes(room.role) && room.m.area >= 4);
  const area = roomList.reduce((s, room) => s + room.m.area, 0);
  const budget = Math.round(show * (8 + area / 2.8));
  // the kinds of place the household puts things (a builder who sets every table and one who keeps to a shelf and
  // the wall over the hearth): each kind by the corpus's share of houses with it, more of them in a house that shows
  // more; this pass leaves the others alone. So a few places get clusters, as in the corpus, where a spread of single stands
  // over every place would not.
  const fav = {};
  for (const [cl, p0] of Object.entries(FAV_P)) fav[cl] = R() < 1 - Math.pow(1 - Math.min(0.95, p0 * favLean(P, cl)), Math.sqrt(show)) ? 1 : 0;
  // the stands already up (the decorator's and the interior library's) count toward it. Where they are more than
  // about half of it, the household takes some away, so the rest goes to this pass's sets: those in places it does
  // not favor first, the decorator's single stands before the stands of a library set that keeps something else (a
  // ledge left bare, a table with its candle). A set made of stands alone stays whole.
  const others = b.pieces.filter(p => p.decor && isStand(p));
  const keep = Math.round(budget * 0.4);
  {
    const kits = new Map();
    for (const p of b.pieces) if (p.kb) { const k = kits.get(p.kb) || { stands: 0, other: 0 }; if (isStand(p)) k.stands++; else k.other++; kits.set(p.kb, k); }
    // (wall stands on plain wall stay: most wall spots in the generator's rooms read as over a table or a bed, and the
    // corpus has a third of its wall stands on plain wall and beams)
    const plainWall = p => p.name === 'itemstand' && wallAtS(b, p) === 'wall';
    const loose = others.filter(p => !p.kb && !p.trim && !plainWall(p)), inSets = others.filter(p => p.kb && !/^KS-/.test(p.kb) && kits.get(p.kb).other > 0 && !plainWall(p));
    const near = p => b.pieces.filter(q => Math.abs(q.x - p.x) < 2.5 && Math.abs(q.z - p.z) < 2.5 && Math.abs(q.y - p.y) < 2.5);
    const key = (p, k) => { const favd = fav[AT_CLASS(PS.standAt(b, p, near(p)))] === 1; return { p, favd, r: R() + k + (favd ? 2 : 0) }; };
    let have = others.length;
    const drop = new Set();
    const order = loose.map(p => key(p, 0)).concat(inSets.map(p => key(p, 1))).sort((a, c) => a.r - c.r);
    // what stands where the household does not put things mostly goes, whatever the count; then more, down to the
    // share kept
    // (a household that shows little takes most of them away, one that shows a lot keeps most)
    const dropP = Math.min(0.85, Math.max(0, 0.9 - 0.45 * show));
    for (const o of order) if (!o.favd && R() < dropP) { drop.add(o.p); have--; }
    for (const o of order) { if (have <= keep) break; if (drop.has(o.p)) continue; drop.add(o.p); have--; }
    // and past that, for a household that shows little, whole sets of stands alone from the library (a pair of
    // trophies, a row of shields), last
    if (have > keep) {
      const alone = [...new Set(others.filter(p => p.kb && !/^KS-/.test(p.kb) && kits.get(p.kb).other === 0).map(p => p.kb))].map(kb => ({ kb, r: R() })).sort((x, y) => x.r - y.r);
      for (const g of alone) { if (have <= keep) break; for (const q of others) if (q.kb === g.kb && !drop.has(q)) { drop.add(q); have--; } }
    }
    // wall stands over a bed, a table, a chest, by the hearth or a door, past the corpus's share of a house's wall
    // stands at that place (WALL_SHARE) times the household's draw (1.2 to 1.8): the extra go, a whole set at a time
    // (the decorator's single stands one by one). The interior library and the decorator hang most of theirs over beds
    // and tables; the corpus's builders hang most on plain wall and beams.
    const walls = b.pieces.filter(p => p.decor && p.name === 'itemstand' && !drop.has(p) && !/^KS-/.test(p.kb || '') && !p.trim);
    const byCtx = {};
    for (const p of walls) { const at = wallAtS(b, p); if (WALL_SHARE[at] != null) (byCtx[at] = byCtx[at] || []).push(p); }
    for (const [at, ps] of Object.entries(byCtx)) {
      const allowed = Math.floor(walls.length * WALL_SHARE[at] * (1.2 + 0.6 * R()) + R());
      const groups = [];
      for (const p of ps) { const g = p.kb ? groups.find(x => x.kb === p.kb) : null; if (g) g.ps.push(p); else groups.push({ kb: p.kb, ps: [p], r: R() }); }
      groups.sort((x, y) => x.r - y.r);
      let n0 = ps.length;
      for (const g of groups) { if (n0 <= allowed) break; for (const q of b.pieces) if (g.kb ? q.kb === g.kb : q === g.ps[0]) { if (!g.kb || isStand(q) || kits.get(g.kb).other === 0) drop.add(q); } n0 -= g.ps.length; }
    }
    if (drop.size) b.pieces = b.pieces.filter(p => !drop.has(p));
  }
  // some households sink the stands on their tables into the top, most of the time; the depth is their habit
  const sinker = R() < 0.5, sinkShare = 0.55 + 0.4 * R(), sinkAt = sinkDepth(R);
  const idx = KB.boxIndex(b.pieces);
  // the same household sinks the stands already on its tables (the interior library's and the decorator's) the same way
  if (sinker) for (const p of b.pieces) {
    if (p.name !== 'itemstandh' || !p.decor || p.sunk || p.fclip || /^KS-/.test(p.kb || '')) continue;
    // on a table: its top (the collider's, as the corpus miner reads it) at the stand's foot or a little over it
    const t = idx.near(Ck.aabb(p), 0.02).find(r => { if (r.p === p || !TABLES.test(r.p.name)) return false; const o = Ck.aabb(r.p), top = o.sol ? SHs().topAt(o.sol, p.x, p.z) : null; return top != null && top - p.y > -0.03 && top - p.y < 0.03; });
    if (!t || R() > sinkShare) continue;
    const d = Math.min(0.216, Math.max(0.061, sinkAt + (R() - 0.5) * 0.03));
    p.y = +(p.y - d).toFixed(3);
    p.fclip = +(d + 0.005).toFixed(3);
    p.sunk = true;
  }
  // some households heap things: two or more stands set into one another (a pile of turnips, mugs crowded together).
  // In the corpus 21 % of house-like builds with stands have one, and 6.8 % of flat stands stand on another
  // (data/stands-corpus.json houses.stand, anchors itemstandh.stand).
  const heaper = R() < HEAP.houses * (P ? 0.6 + 0.8 * P.clutter : 1), heapShare = HEAP.share[0] + (HEAP.share[1] - HEAP.share[0]) * R();
  const fires = b.pieces.filter(p => p.decor && FIRES_S.test(p.name)).map(p => ({ p, b: Ck.aabb(p) }));
  const clutter = P ? P.clutter : 0.45, size = P ? P.size : 3;
  const P2 = Object.assign({}, P || {}, { hobby: (P && P.hobby) || { crafts: 0.3, collect: 0.3, plants: 0.3, food: 0.3, games: 0.3, maps: 0.3 } });
  let placed = 0, placedStands = 0;
  // the house's wall stands by what is under them (as the miner reads it), kept up as this pass hangs more: a wall set
  // over a table or a bed waits while those already hold more than the corpus's share of the
  // house's wall stands (WALL_SHARE times CAPPED, and 0.4 more for some households). In small rooms nearly every wall
  // spot is within the miner's reach of a table or a bed, so without it a room that wants many stands fills those once
  // its plain wall is taken.
  // what lies on tables follows one roll per table that the decorator and the library's sets share (lib/decorate.js
  // tableDressed: the culture's corpus rate, rel.tablesDressed, 41 % of norse tables, times the household's clutter).
  // This pass sets a bare table only where that roll says the household dresses it (a table no one has come to yet is
  // rolled now); a table that holds something already may take more. Whether a table holds something is read as the
  // corpus relation reads it (lab/essentials.js tablesDressed: a loose piece within 0.9 m of the table's pivot and 0.5
  // to 1.6 m over it). (A budget per house would top up the houses under it and leave those over it, and the mean
  // would run over the rate.)
  const tdLoose = b.pieces.filter(q => q.decor && !q.outside && !q.yard && !TD_NOT.test(q.name) && !TD_TABLES.test(q.name));
  const bareTable = p => !tdLoose.some(q => Math.hypot(q.x - p.x, q.z - p.z) < 0.9 && q.y - p.y >= 0.5 && q.y - p.y <= 1.6);
  const wallN = { all: 0 }, capK = 0.4 * R();
  for (const p of b.pieces) if (p.decor && p.name === 'itemstand') { wallN.all++; const at = wallAtS(b, p); wallN[at] = (wallN[at] || 0) + 1; }
  // flat stands, and those this pass sets on benches and seats, for the bench cap (FLAT_BENCH)
  const flatN = { all: b.pieces.filter(p => p.decor && p.name === 'itemstandh').length, bench: 0 };
  for (const room of roomList) {
    const m = room.m;
    const inR = p => m.inside(p.x, p.z) && Math.abs(p.y - m.stand) < 0.9;
    // the room's furniture and anchors
    const furn = b.pieces.filter(p => p.decor && inR(p));
    const hasOn = p => { const o = Ck.aabb(p); return furn.filter(q => q !== p && q.x > o.x0 && q.x < o.x1 && q.z > o.z0 && q.z < o.z1 && q.y > o.y1 - 0.15 && q.y < o.y1 + 0.5).length; };
    const cands = [];
    const add = (s, anc, w) => { if (w > 0) cands.push({ s, anc, w }); };
    const kitAnchors = KB.anchorsOf(room, b);
    const wallAnchors = kitAnchors.filter(an => an.anchor === 'wall');
    // a feast at most once in a room, never where one is laid out already
    const feasted = b.pieces.some(p => /^Feast[A-Z]/.test(p.name) && inR(p));
    const sets = SETS.filter(s => (!s.n || size >= s.n) && (!s.feast || (ctx.decor === 'd3' && !feasted)) && (!s.heap || heaper));
    for (const p of furn) {
      const yaw = normS(p.yaw || 0);
      if (TABLES.test(p.name)) {
        // a table already set (the library's own table sets) takes nothing more, but for a feast in its middle; one
        // with a candle or one dish may
        const on = hasOn(p);
        const of = /round/.test(p.name) ? 'round' : /oak|blackmarble/.test(p.name) ? 'long' : 'table';
        const bare = bareTable(p);
        for (const s of sets) if (s.anchor === 'table' && (s.of === of || (s.of === 'table' && of === 'long')) && (on < 2 || (s.feast && on < 5))) add(s, { anchor: 'table', x: p.x, z: p.z, yaw, of: p, akind: of, bare }, 1);
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
    // low walls: their top as a counter
    for (const c of countersIn(b, m, idx)) for (const s of sets) if (s.anchor === 'counter' && (!s.len || c.len >= s.len)) add(s, { anchor: 'counter', x: c.p.x, z: c.p.z, yaw: normS(c.p.yaw || 0), of: c.p }, 1);
    // wall spots by what stands in front of them (the corpus's wall stands over a workbench, a bed, the hearth...)
    for (const an of wallAnchors) {
      // what is under the spot as the corpus miner reads it (wallAtS), so this pass's shares compare with the corpus's
      const at = wallAtS(b, { name: 'itemstand', x: an.x, y: m.stand + 1.75, z: an.z, yaw: an.yaw });
      const ctxW = at === 'wall' ? 'plain' : at.slice(5);
      for (const s of sets) {
        if (s.anchor !== 'wall' || !s.ctx || !s.ctx.includes(ctxW)) continue;
      if (s.heap && !/^(home|kitchen|storage|tavern)$/.test(room.role)) continue;
        // plain wall the whole width of the set and a little more (no window, door or opening, not past the wall's end)
        const half = Math.max(...s.pieces.map(q => Math.abs(q.x))) + 0.35;
        const st = D._int.stretch(an.face, an.t - half, an.t + half);
        if ([...st.ks].some(k => k !== 'wall')) continue;
        // and clear of the wall's ends (the next wall round the corner, a partition's end)
        if (an.t - half - 0.6 < an.face.a0 || an.t + half + 0.6 > an.face.a1) continue;
        if (s.high && m.ceilAt(an.x + Math.sin(an.yaw * Math.PI / 180) * 0.15, an.z + Math.cos(an.yaw * Math.PI / 180) * 0.15) - m.stand < s.high) continue;
        add(s, Object.assign({ ctxW }, an), (CTX_W[ctxW] || 0.4) * (s.high ? 0.6 * (P ? 0.4 + P.likes.hung * 0.6 : 1) : 1));
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
    // each kind of place its own share of the picks, shared among its candidates
    const inClass = {};
    for (const c of cands) { c.cl = classOf(c.s, c.anc); inClass[c.cl] = (inClass[c.cl] || 0) + c.w; }
    for (const c of cands) c.w *= (CLASS_W[c.cl] || 0.5) * (fav[c.cl] == null ? 1 : fav[c.cl]) / inClass[c.cl] * leanWeight(P2, c.s) * (c.s.feast ? 0.12 : 1);
    // a bare table the household's roll says it dresses (a dining set whose top did not fit) is set first, one set
    // each, whatever the room's count and the places the household favors, and shows from the table's own stage
    const owed = cands.filter(c => c.anc.anchor === 'table' && c.anc.bare && c.anc.of.td === true && !c.s.feast);
    for (let k = cands.length - 1; k >= 0; k--) if (!(cands[k].w > 0) && !owed.includes(cands[k])) cands.splice(k, 1);
    if (!cands.length) continue;
    // how many stands this room shows: its share of the house's, less what stands here already; a share at d2, the
    // rest at d3
    const inRoom = b.pieces.filter(p => p.decor && isStand(p) && m.inside(p.x, p.z) && p.y > m.stand - 0.3 && p.y < m.stand + 3.5).length;
    const want3 = Math.round(budget * m.area / Math.max(1, area) - inRoom + (R() - 0.5) * 1.5);
    if (want3 < 1 && !owed.length) continue;
    const want2 = Math.round(want3 * (0.4 + 0.25 * R()));
    // (tries grow with what the room wants: with the essentials' wall seats and stacked chests in, more of a room's
    // spots are taken, and a tavern room ran out of its 80 tries with most of its sets unplaced)
    const maxTries = Math.max(80, Math.min(240, want3 * 6));
    let n = 0, tries = 0, got3 = 0;
    const usedAnc = [], usedSet = {};
    while ((got3 < want3 || owed.length) && tries < maxTries && cands.length) {
      tries++;
      let pick = null;
      if (owed.length) {
        pick = owed.splice(Math.floor(R() * owed.length), 1)[0];
        if (!cands.includes(pick) || usedAnc.some(u => u.of === pick.anc.of)) continue;
      } else {
        const wt = c => c.w / (1 + 1.5 * (usedSet[c.s.id] || 0));
        let tot = 0;
        for (const c of cands) tot += wt(c);
        let r = R() * tot;
        pick = cands[cands.length - 1];
        for (const c of cands) { r -= wt(c); if (r <= 0) { pick = c; break; } }
      }
      const owes = pick.anc.anchor === 'table' && pick.anc.bare && pick.anc.of.td === true;
      cands.splice(cands.indexOf(pick), 1);
      const an = pick.anc;
      if (usedAnc.some(u => (an.of && u.of === an.of) || (an.anchor === u.anchor && Math.hypot(u.x - an.x, u.z - an.z) < (an.anchor === 'wall' ? 1.6 : 0.6)))) continue;
      if (an.anchor === 'wall' && wallBusy(an, idx, m, pick.s)) continue;
      if (an.anchor === 'table' && an.bare && !D.tableDressed(an.of, R, ctx.culture || ctx.cultureKey, P)) continue;
      if (an.ctxW) {
        const at = an.ctxW === 'plain' ? 'wall' : `wall:${an.ctxW}`, k = pick.s.pieces.filter(q => q.n === 'itemstand').length;
        if (CAPPED[at] && (wallN[at] || 0) + k > (wallN.all + k) * WALL_SHARE[at] * (CAPPED[at] + capK) + 0.5) continue;
      }
      if (pick.cl === 'bench') { const k = pick.s.pieces.filter(q => q.n === 'itemstandh').length; if (flatN.bench + k > (flatN.all + k) * FLAT_BENCH * (1 + capK) + 0.5) continue; }
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
      // a wall stand into the wall's relief stays against its collider, as the corpus's builders hang them (D-127)
      if (got.some(p => p.name === 'itemstand' && p.wclip && intoCollider(p, idx) > WALL_COLL + 0.005)) continue;
      // never before what it stands on (a bench of a set that comes at the third stage)
      const ds = owes ? Math.max(2, an.of.ds || 0) : Math.max(s.stage === 3 || got3 >= want2 ? 3 : 2, (an.of && an.of.decor && an.of.ds) || 0);
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
      // stands on a table sunk into its top, so only the item shows; each is a clip made on purpose, as deep as the
      // corpus's builders sink them, marked in the file's '#VillheimClips' (furniture depth, lib/blueprint.js; D-098)
      if (sinker && an.anchor === 'table') for (const p of got) {
        if (p.name !== 'itemstandh' || R() > sinkShare) continue;
        const d = Math.min(0.216, Math.max(0.061, sinkAt + (R() - 0.5) * 0.03));
        p.y = +(p.y - d).toFixed(3);
        p.fclip = +(d + 0.005).toFixed(3);
        p.sunk = true;
      }
      // a household that heaps things sets more stands into some of these (a heap on the floor always)
      if (heaper) for (const p of got.slice()) {
        if (p.name !== 'itemstandh' || (!s.heap && R() > heapShare)) continue;
        for (const q of pileStands(b, idx, m, p, R, s.heap)) { got.push(q); }
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
      got3 += got.filter(isStand).length; placedStands += got.filter(isStand).length;
      if (an.ctxW) { const at = an.ctxW === 'plain' ? 'wall' : `wall:${an.ctxW}`, k = got.filter(p => p.name === 'itemstand').length; wallN.all += k; wallN[at] = (wallN[at] || 0) + k; }
      { const k = got.filter(p => p.name === 'itemstandh').length; flatN.all += k; if (pick.cl === 'bench') flatN.bench += k; }
      n++; placed++;
    }
  }
  if (placed) b.notes.push(`${placed} sets of things on stands: on tables, benches, chests, shelves, sills, beams and walls.`);
  return placed;
}

// The corpus's wall stands by what is under them, as a share of those at a known place (anchors: plain wall and
// beams 1,405 of 4,259, over a workbench or bench 719, by the hearth 558, a rafter 533, over a chest 333, a table 328,
// a bed 208, by a door 175)
const CAPPED = { 'wall:table': 1.3, 'wall:bed': 1.0 };
// The corpus's flat stands on a bench or a workbench, of those at the places test_stands lists (data/stands-corpus.json
// anchors: bench 216 and workbench 32 of 6,773 on tables, shelves and ledges, mantels, counters and wall tops, benches,
// sills, rafters and chests): a bench set goes up while the building's flat stands on benches stay near that share.
// Bench sets fit where table and shelf sets often do not, so the picks alone left a quarter of the flat stands on
// benches once the sets were kept whole (integration round 6).
const FLAT_BENCH = 248 / 6773;
const WALL_SHARE = { 'wall:bed': 208 / 4259, 'wall:table': 328 / 4259, 'wall:chest': 333 / 4259, 'wall:hearth': 558 / 4259, 'wall:door': 175 / 4259,
  'wall:workbench': 578 / 4259, 'wall:bench': 141 / 4259 };
// What is under a wall stand, as the corpus miner reads it (lab/mine_stands.js), so the shares compare: furniture
// standing on the floor round the point half a metre out from the stand (0.9 m, in the miner's 2 m grid cells); then a
// fire within 2.2 m; then a door within 1.3 m.
function wallAtS(b, p) {
  const Ck = Cks(), y = p.yaw * Math.PI / 180, fx = Math.sin(y), fz = Math.cos(y);
  // which side the wall is on: the first of 5 to 30 cm behind the stand, then in front of it, with structure there
  const solid = (x, z) => b.pieces.some(q => !q.decor && q !== p && (() => { const o = Ck.aabb(q); return o.x0 <= x && o.x1 >= x && o.z0 <= z && o.z1 >= z && o.y0 <= p.y && o.y1 >= p.y; })());
  let side = 1;
  for (const d of [0.05, 0.1, 0.18, 0.3, -0.05, -0.1, -0.18, -0.3]) if (solid(p.x - fx * d, p.z - fz * d)) { side = Math.sign(d); break; }
  const ox = p.x + fx * 0.5 * side, oz = p.z + fz * 0.5 * side;
  // the floor it is over: the highest room floor under it
  const rooms = (b.rooms || []).filter(q => p.x > q.x0 - 0.3 && p.x < q.x1 + 0.3 && p.z > q.z0 - 0.3 && p.z < q.z1 + 0.3 && q.y <= p.y - 0.3);
  const ft = rooms.length ? Math.max(...rooms.map(q => q.y)) : p.y - 1.8;
  // the miner's own reach (lib/checks.js index): any piece in the 2 m grid cells the square touches, at those heights
  const C = v => Math.floor(v / 2);
  const box = (q, x, z, r, y0, y1) => { const o = Ck.aabb(q); return C(o.x0) <= C(x + r) && C(o.x1) >= C(x - r) && C(o.z0) <= C(z + r) && C(o.z1) >= C(z - r) && o.y1 > y0 && o.y0 < y1 ? o : null; };
  const under = b.pieces.filter(q => q !== p && !/^itemstand/.test(q.name)).filter(q => { const o = box(q, ox, oz, 0.9, ft - 0.1, p.y - 0.1); return o && o.y0 < ft + 0.4; });
  const has = t => under.some(q => t(q.name, PBs.piece(q.name).role));
  if (has(n => WORK_M.test(n))) return 'wall:workbench';
  if (has((n, r) => r === 'table')) return 'wall:table';
  if (has((n, r) => r === 'seat' && /bench|sofa/i.test(n))) return 'wall:bench';
  if (has((n, r) => r === 'bed')) return 'wall:bed';
  if (b.pieces.some(q => (/^(hearth|fire_pit|bonfire|piece_brazier|piece_groundtorch)/.test(q.name) || PBs.piece(q.name).role === 'fire') && box(q, p.x, p.z, 2.2, ft - 0.2, ft + 0.6))) return 'wall:hearth';
  if (has((n, r) => r === 'storage')) return 'wall:chest';
  if (b.pieces.some(q => PBs.piece(q.name).role === 'door' && box(q, p.x, p.z, 1.3, ft, ft + 2))) return 'wall:door';
  return 'wall';
}
// How often this pass dresses a wall spot by what stands in front of it. The corpus's wall stands (anchors): plain
// wall and beams 1,405, over a workbench or bench 719, by the hearth 558, over a chest 333, a table 328, a bed 208, by
// a door 175. The library's and the decorator's wall stands already sit mostly over tables and beds, so this pass leans
// to plain wall.
const CTX_W = { plain: 0.9, workbench: 0.18, bench: 0.12, hearth: 0.4, chest: 0.35, table: 0.05, bed: 0.03, door: 0.45 };
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
// Low walls in a room, their top a counter: a wall piece standing on the room's floor whose top is 0.4 to 1.5 m over
// it (the corpus's counter stands sit at a median 0.51 m, the 90th percentile 1.0 m; data/stands-corpus.json heights
// itemstandh|counter), at least 0.5 m long, nothing standing on it yet.
function countersIn(b, m, idx) {
  const out = [];
  for (const p of b.pieces) {
    const r = PBs.piece(p.name).role;
    if (r !== 'wall' && r !== 'halfwall') continue;
    const q = p.q || [0, 0, 0, 1];
    if (Math.abs(q[0]) > 0.01 || Math.abs(q[2]) > 0.01) continue;
    const o = Cks().aabb(p);
    if (o.y0 > m.stand + 0.15 || o.y0 < m.stand - 0.3 || o.y1 < m.stand + 0.4 || o.y1 > m.stand + 1.5) continue;
    const a = (p.yaw || 0) * Math.PI / 180, nx = Math.sin(a), nz = Math.cos(a);
    if (!m.inside(p.x, p.z) && !m.inside(p.x + nx * 0.4, p.z + nz * 0.4) && !m.inside(p.x - nx * 0.4, p.z - nz * 0.4)) continue;
    const len = Math.abs(Math.cos(a)) > 0.7 ? o.x1 - o.x0 : o.z1 - o.z0;
    if (len < 0.5) continue;
    if (idx.near({ x0: o.x0, x1: o.x1, z0: o.z0, z1: o.z1 }, 0).some(r2 => r2.p !== p && r2.p.decor && r2.b.y0 > o.y1 - 0.08 && r2.b.y0 < o.y1 + 0.4 && r2.p.x > o.x0 && r2.p.x < o.x1 && r2.p.z > o.z0 && r2.p.z < o.z1)) continue;
    out.push({ p, o, len });
  }
  return out;
}
// Heaps (data/stands-corpus.json stacks): a stand set on or into another, a few centimeters off it (the level offset's
// 25th, 50th and 75th percentile 4, 11 and 16 cm; both read as on a stand once one covers the other), at about its
// height (rise median 0). Heaps of two are most (274 of 376), then five (28), three (41), four (18), six or more (15).
// They mostly hold one kind: food under food 209 of the pairs read, drink 94, herbs 65.
const HEAP = { houses: 0.3, share: [0.15, 0.5], more: [[1, 274], [2, 41], [3, 18], [4, 28], [5, 15]],
  kinds: { food: 306, drink: 138, herbs: 123, shield: 44, trophy: 30, weapon: 27, rare: 14 } };
function pileStands(b, idx, m, base, R, always) {
  const Ck = Cks(), SH = SHs(), out = [];
  // what the base stands on: the highest top under its foot that is not a stand
  const supportAt = (x, z, y) => {
    let t = null;
    for (const r of idx.near({ x0: x - 0.02, x1: x + 0.02, z0: z - 0.02, z1: z + 0.02 }, 0)) {
      if (isStand(r.p) || r.b.pass || r.b.x0 > x || r.b.x1 < x || r.b.z0 > z || r.b.z1 < z) continue;
      const top = SH.lidAt(r.p, x, z) ?? (r.b.sol ? SH.topAt(r.b.sol, x, z) : null) ?? r.b.y1;
      if (top == null || top > y + 0.25 || top < y - 0.05) continue;
      if (t == null || top > t) t = top;
    }
    if (t == null && Math.abs(y - m.stand) < 0.05 && m.inside(x, z)) t = m.stand;
    return t;
  };
  const t0 = supportAt(base.x, base.z, base.y);
  if (t0 == null) return out;
  // the heap's kind: what the base was asked for, else a kind heaped in the corpus
  const [k0, at0] = (base.want || '').split('@');
  let kind = k0;
  if (!kind) { let tot = 0; for (const v of Object.values(HEAP.kinds)) tot += v; let r = R() * tot; for (const [k, v] of Object.entries(HEAP.kinds)) { r -= v; if (r <= 0) { kind = k; break; } } }
  base.want = `${kind}@${at0 || ''}`;
  let tot = 0;
  for (const [, v] of HEAP.more) tot += v;
  let r = R() * tot, n = 1;
  for (const [k, v] of HEAP.more) { r -= v; if (r <= 0) { n = k; break; } }
  const pile = [base];
  for (let i = 0; i < n * 3 && out.length < n; i++) {
    const from = pile[Math.floor(R() * pile.length)], a = R() * Math.PI * 2, d = 0.04 + 0.09 * R();
    const x = +(from.x + Math.cos(a) * d).toFixed(3), z = +(from.z + Math.sin(a) * d).toFixed(3);
    const t = supportAt(x, z, base.y);
    if (t == null || Math.abs(t - t0) > 0.02) continue;
    const yaw = Math.floor(R() * 8) * 45 + Math.round((R() - 0.5) * 30);
    const y = +(base.y + (R() - 0.3) * 0.03).toFixed(3);
    const q = { name: 'itemstandh', x, y, z, yaw: normS(yaw), decor: true, kb: base.kb, rest: 'on', want: `${kind}@${at0 || ''}`, heap: true };
    { const h = q.yaw * Math.PI / 360; q.q = [0, +Math.sin(h).toFixed(6), 0, +Math.cos(h).toFixed(6)]; }
    const o = Ck.aabb(q);
    // clear of everything but the heap and what it stands on
    if (idx.near(o, 0).some(r2 => !pile.includes(r2.p) && !isStand(r2.p) ? (r2.b.y1 > y + 0.01 && r2.b.y0 < o.y1 && r2.b.x0 < o.x1 && r2.b.x1 > o.x0 && r2.b.z0 < o.z1 && r2.b.z1 > o.z0 && !r2.b.pass) : (!pile.includes(r2.p) && r2.b.x0 < o.x1 - 0.01 && r2.b.x1 > o.x0 + 0.01 && r2.b.z0 < o.z1 - 0.01 && r2.b.z1 > o.z0 + 0.01 && r2.b.y0 < o.y1 && r2.b.y1 > o.y0))) continue;
    // a clip made on purpose (D-098): the stands go into one another by up to their own height
    q.fclip = Math.max(base.sunk ? base.fclip || 0 : 0, 0.045);
    if (base.sunk) { q.sunk = true; }
    base.fclip = Math.max(base.fclip || 0, 0.045);
    base.heap = true;
    pile.push(q); out.push(q); idx.add(q);
  }
  return out;
}
let DEBUG_S = null;
const apiS = { debug: d => { DEBUG_S = d; }, dressTops, SETS, SILL, RAFTER, leanWeight, wallAtS };
if (NODE_S) module.exports = apiS; else window.VHStands = apiS;

