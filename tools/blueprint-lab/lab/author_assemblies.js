// Writes data/assemblies/authored.json: furniture assembly recipes written from Tyler's "Game Inspo" album, his
// collage of custom furniture (a Versaugh video, research/2026-11-12-tyler in the private repo) and builders' tips
// and videos (docs/FURNITURE_ASSEMBLIES.md "Sources"). Each piece is set by the bottom of its measured box
// (lib/shapes.js), so it rests where the picture shows it. Frame as lib/assemblies.js: x along the wall, z into the
// room from the wall face, y over the floor.
//   node lab/author_assemblies.js
const fs = require('fs'), path = require('path');
const SH = require('../lib/shapes.js'), CAT = require('../lib/catalog.js');

const boxes = new Map();
function box(n) {
  if (!boxes.has(n)) {
    const w = SH.world({ name: n, x: 0, y: 0, z: 0, yaw: 0, q: [0, 0, 0, 1] }) || [];
    boxes.set(n, w.length ? { y0: Math.min(...w.map(b => b.y0)), y1: Math.max(...w.map(b => b.y1)) } : { y0: 0, y1: 0 });
  }
  return boxes.get(n);
}
const r3 = v => Math.round(v * 1000) / 1000;
// a piece whose box bottom sits at 'bottom'
const on = (n, x, bottom, z, yaw = 0, o = {}) => Object.assign({ n, x: r3(x), y: r3(bottom - box(n).y0), z: r3(z), yaw }, o);
const top = (n, bottom) => bottom - box(n).y0 + box(n).y1; // the top of a piece set with its bottom at 'bottom'
// a flat item stand on a top, and a wall stand on a face at z
const H = (x, y, z, want, o = {}) => Object.assign({ n: 'itemstandh', x: r3(x), y: r3(y), z: r3(z), yaw: o.yaw || 0, want, place: o.place || 'shelf' }, o.row ? { row: true } : {});
const W = (x, y, z, want, o = {}) => ({ n: 'itemstand', x: r3(x), y: r3(y), z: r3(z + 0.045), yaw: 0, want, place: 'wall', ...(o.near ? { near: o.near } : {}) });
const HIDDEN = new Set(['wood_ledge']);
const hid = n => HIDDEN.has(n) || (CAT.get(n) ? CAT.get(n).buildable === false : false);

const R = [];
function recipe(id, kind, o, pieces) {
  for (const p of pieces) if (hid(p.n)) p.hidden = true;
  const names = pieces.map(p => p.n);
  const fam = {};
  for (const n of names) { const f = CAT.family(n); if (f) fam[f] = (fam[f] || 0) + 1; }
  R.push(Object.assign({ id: 'AA-' + id, kind, from: o.from || 'album', wall: o.wall || 'back', foot: o.foot, rooms: o.rooms, families: Object.entries(fam).sort((a, b) => b[1] - a[1]).map(x => x[0]).slice(0, 4),
    built: o.built || null, cultures: o.cultures || ['any'], hidden: [...new Set(names.filter(hid))], builds: o.builds || 1, src: o.src, note: o.note }, { pieces }));
}

// ---------------------------------------------------------------- potion and mead cabinets
{
  // album 157, 175, 176 (a tall dark bookcase of potions and curios), Versaugh "Mead cabinet"; three shelves of
  // dark beams between two dark posts, a dark panel back, potions and herbs on the shelves, a pot and a candle on top
  const s = [0.35, 0.9, 1.45], P = [];
  P.push(on('darkwood_decowall', -0.5, 0, 0.06), on('darkwood_decowall', 0.5, 0, 0.06));
  P.push(on('darkwood_pole', -1.05, 0, 0.25), on('darkwood_pole', 1.05, 0, 0.25));
  for (const b of s) P.push(on('darkwood_beam', 0, b, 0.25));
  P.push(on('darkwood_beam', 0, 2.0, 0.25));
  const t = s.map(b => top('darkwood_beam', b));
  [[-0.65, 'mead'], [-0.3, 'mead'], [0.35, 'mead'], [0.7, 'mead']].forEach(([x, w]) => P.push(H(x, t[0], 0.25, w, { yaw: 90 })));
  [[-0.55, 'mead'], [-0.15, 'herbs'], [0.5, 'mead']].forEach(([x, w]) => P.push(H(x, t[1], 0.25, w, { yaw: 90 })));
  [[-0.4, 'herbs'], [0.1, 'curio'], [0.6, 'herbs']].forEach(([x, w]) => P.push(H(x, t[2], 0.25, w)));
  P.push(on('piece_pot3', -0.55, top('darkwood_beam', 2.0), 0.25), on('Candle_resin', 0.6, top('darkwood_beam', 2.0), 0.25));
  recipe('potion-cabinet-01', 'potion-shelf', { foot: { x: [-1.25, 1.25], z: [0, 0.45], h: 3.2 }, rooms: ['study', 'bedroom', 'kitchen', 'temple'], built: 'darkwood',
    src: { title: "Tyler's album 157, 175, 176; Versaugh 'Over 20 interior ideas' (Mead cabinet)" }, note: 'potions in pairs with a gap, one curio, herbs on the top shelf (album 176)' }, P);
}
{
  // a narrow plank cabinet: the same in 1 m, for small homes (Versaugh "small cabinet with shelf")
  const s = [0.3, 0.8, 1.3], P = [];
  P.push(on('wood_pole2', -0.6, 0, 0.25), on('wood_pole2', 0.6, 0, 0.25));
  for (const b of s) P.push(on('wood_beam_1', 0, b, 0.25));
  P.push(on('wood_beam_1', 0, 1.8, 0.25));
  const t = s.map(b => top('wood_beam_1', b));
  P.push(H(-0.22, t[0], 0.25, 'mead', { yaw: 90 }), H(0.2, t[0], 0.25, 'mead', { yaw: 90 }));
  P.push(H(-0.2, t[1], 0.25, 'herbs'), H(0.22, t[1], 0.25, 'mead', { yaw: 90 }));
  P.push(H(0, t[2], 0.25, 'curio'));
  recipe('potion-cabinet-02', 'potion-shelf', { foot: { x: [-0.8, 0.8], z: [0, 0.45], h: 2.25 }, rooms: ['study', 'bedroom', 'kitchen', 'home'], built: 'plank',
    src: { title: "Versaugh 'Over 20 interior ideas' (small cabinet with shelf); album 157" } }, P);
}
// ---------------------------------------------------------------- kitchen hutch and pantry
{
  // collage bottom middle (the kitchen hutch with pans), album 124 and 180: a plank counter of half walls with a 1 x 1
  // top, the pots and pans rack on the wall over it, short shelves either side with a pot and drink, food on the counter
  const P = [];
  P.push(on('wood_wall_half', -1, 0, 0.85), on('wood_wall_half', 1, 0, 0.85));
  for (const x of [-1.5, -0.5, 0.5, 1.5]) P.push(on('wood_floor_1x1', x, 1.0, 0.5));
  const ct = top('wood_floor_1x1', 1.0);
  P.push(on('cauldron_ext4_pots', 0, 1.25, 0.02));
  P.push(on('wood_beam_1', -1.55, 1.75, 0.2), on('wood_beam_1', 1.55, 1.75, 0.2));
  const st = top('wood_beam_1', 1.75);
  P.push(on('piece_pot3', -1.55, st, 0.2));
  P.push(H(1.35, st, 0.2, 'mead', { yaw: 90 }), H(1.75, st, 0.2, 'mead', { yaw: 90 }));
  P.push(H(-1.6, ct, 0.55, 'food', { place: 'counter' }), H(-1.15, ct, 0.5, 'food', { place: 'counter', yaw: 45 }), H(1.2, ct, 0.5, 'produce', { place: 'counter', row: true }), H(1.6, ct, 0.5, 'produce', { place: 'counter', row: true }));
  recipe('kitchen-hutch-01', 'kitchen-hutch', { from: 'collage', foot: { x: [-2, 2], z: [0, 1.0], h: 3.2 }, rooms: ['kitchen', 'home', 'tavern'], built: 'plank',
    src: { title: "Tyler's collage (Versaugh '100 Valheim Decoration Ideas'), kitchen hutch; album 124, 180" }, note: 'food where it is made: raw at one end, cooked at the other' }, P);
}
{
  // saphonette "Ashwood Pantries", album 124 (a ledge with a row of jars): a pantry of four plank shelves over a
  // chest, one kind of thing per shelf in a row
  const s = [0.85, 1.35, 1.85], P = [];
  P.push(on('piece_chest_wood', 0, 0, 0.4));
  P.push(on('wood_pole2', -1.05, 0, 0.2), on('wood_pole2', 1.05, 0, 0.2), on('wood_pole', -1.05, 2.0, 0.2), on('wood_pole', 1.05, 2.0, 0.2));
  for (const b of s) P.push(on('wood_beam', 0, b, 0.2));
  P.push(on('wood_beam', 0, 2.6, 0.2));
  const t = s.map(b => top('wood_beam', b));
  const wants = ['produce', 'food', 'mead'];
  t.forEach((y, i) => [-0.7, -0.35, 0, 0.35, 0.7].forEach(x => P.push(H(x, y, 0.2, wants[i], { row: true, yaw: 90 }))));
  recipe('pantry-cabinet-01', 'pantry-shelf', { foot: { x: [-1.25, 1.25], z: [0, 0.8], h: 3.0 }, rooms: ['kitchen', 'storage', 'tavern'], built: 'plank',
    src: { title: "saphonette 'Valheim Ashwood Pantries / Kitchen Storages' (thumbnail); album 124" }, note: 'one kind per shelf, in a row (corpus runs: drink and food come in rows)' }, P);
}
// ---------------------------------------------------------------- bars and kegs
{
  // album 128 and 169: a back shelf of one drink in a row, a counter of half walls with a 1 x 1 top 0.85 m out, stools
  // in a row in front, a candle at the counter's end
  const P = [];
  P.push(on('wood_beam', -1, 1.3, 0.2), on('wood_beam', 1, 1.3, 0.2), on('wood_beam', -1, 1.9, 0.2), on('wood_beam', 1, 1.9, 0.2));
  const b1 = top('wood_beam', 1.3), b2 = top('wood_beam', 1.9);
  for (const x of [-1.6, -1.2, -0.8, -0.4]) P.push(H(x, b1, 0.2, 'drink', { row: true, yaw: 90 }));
  for (const x of [0.5, 0.9, 1.3]) P.push(H(x, b2, 0.2, 'drink', { row: true, yaw: 90 }));
  P.push(on('wood_wall_half', -1, 0, 1.65), on('wood_wall_half', 1, 0, 1.65));
  for (const x of [-1.5, -0.5, 0.5, 1.5]) P.push(on('wood_floor_1x1', x, 1.0, 1.35));
  const ct = top('wood_floor_1x1', 1.0);
  P.push(H(-0.6, ct, 1.45, 'tankard', { place: 'counter', yaw: 30 }), H(0.45, ct, 1.4, 'tankard', { place: 'counter', yaw: 200 }), on('Candle_resin', 1.7, ct, 1.4));
  for (const x of [-1.2, -0.1, 1.0]) P.push(on('piece_chair', x, 0, 2.35));
  recipe('bar-01', 'bar-counter', { foot: { x: [-2, 2], z: [0, 2.6], h: 2.3 }, rooms: ['tavern', 'hall'], built: 'plank',
    src: { title: "Tyler's album 128, 169" }, note: 'clear strip behind the counter 0.85 m (corpus p50 0.83 m); one seat kind' }, P);
}
{
  // album 168: big kegs lying on beam cradles along the wall, a shelf of mugs over them
  const P = [];
  P.push(on('wood_beam', -1, 0, 0.3, 0), on('wood_beam', 1, 0, 0.3, 0), on('wood_beam', -1, 0, 0.9, 0), on('wood_beam', 1, 0, 0.9, 0));
  const cr = top('wood_beam', 0);
  for (const x of [-1.3, 0, 1.3]) P.push(on('barrell', x, cr - 0.05, 0.6, 0));
  P.push(on('wood_beam', -1, 1.75, 0.2), on('wood_beam', 1, 1.75, 0.2));
  const st = top('wood_beam', 1.75);
  for (const x of [-1.5, -1.1, -0.7, 0.6, 1.0]) P.push(H(x, st, 0.2, 'tankard', { row: true, yaw: 90 }));
  recipe('keg-rack-01', 'keg-rack', { foot: { x: [-2, 2], z: [0, 1.1], h: 2.2 }, rooms: ['tavern', 'storage', 'brewery', 'hall'], built: 'plank',
    src: { title: "Tyler's album 168" }, note: 'barrell is hidden from the build menu (D-166): kegs have a purpose here' }, P);
}
// ---------------------------------------------------------------- beds
function canopy(id, fam, bedName, src) {
  const pole = fam === 'darkwood' ? 'darkwood_pole' : 'wood_pole2', beam = fam === 'darkwood' ? 'darkwood_beam' : 'wood_beam';
  const P = [];
  const bed = bedName === 'piece_bed02' ? { half: 1.15, z0: -1.6, z1: 1.83 } : { half: 0.6, z0: -1.4, z1: 1.4 };
  const bz = 0.05 - bed.z0, foot = bz + bed.z1, px = bed.half + 0.15;
  P.push(on(bedName, 0, 0, bz));
  for (const x of [-px, px]) for (const z of [0.2, foot]) P.push(on(pole, x, 0, z));
  P.push(on(beam, 0, 2.0, 0.2), on(beam, 0, 2.0, foot));
  const len = foot - 0.2;
  P.push(on(beam, -px, 2.0, 0.2 + len * 0.27, 90), on(beam, -px, 2.0, foot - len * 0.27, 90), on(beam, px, 2.0, 0.2 + len * 0.27, 90), on(beam, px, 2.0, foot - len * 0.27, 90));
  // nightstands: a barrel each side with a candle (corpus: a light beside 21 % of bed heads, a chest 13 %)
  const ns = px + 0.6;
  P.push(on('piece_chest_barrel', -ns, 0, 0.45), on('piece_chest_barrel', ns, 0, 0.45));
  P.push(on('Candle_resin', -ns, top('piece_chest_barrel', 0), 0.45), H(ns, top('piece_chest_barrel', 0), 0.45, 'mead', { place: 'sidetable' }));
  // the sleeper's piece over the head (corpus: 208 wall stands over beds, trophies and shields)
  P.push(W(0, 1.7, 0, 'trophies', { near: 'sleep' }));
  recipe(id, 'canopy-bed', { foot: { x: [-(ns + 0.4), ns + 0.4], z: [0, foot + 0.25], h: 2.5 }, rooms: ['bedroom'], built: fam, src: { title: src }, note: 'head to a solid wall; a different piece each side' }, P);
}
canopy('canopy-bed-01', 'darkwood', 'piece_bed02', "Tyler's album 174");
canopy('canopy-bed-02', 'plank', 'bed', "Tyler's album 174 (plank and straw bed for early stages)");
// ---------------------------------------------------------------- cabinets, dressers, wardrobes
{
  // a chest set in a frame of quarter walls with a 1 x 1 top (corpus 'cabinet': chests in half walls, 16 recipes;
  // Versaugh 'small cabinet'), things on top, a wall stand over it; signs on the frame as drawer fronts (SozAI
  // tip: signs on half walls with a single minus sign)
  const P = [];
  P.push(on('piece_chest_wood', 0, 0, 0.5));
  P.push(on('wood_wall_quarter', -0.97, 0, 0.5, 90), on('wood_wall_quarter', 0.97, 0, 0.5, 90));
  P.push(on('wood_floor_1x1', -0.5, 1.0, 0.5), on('wood_floor_1x1', 0.5, 1.0, 0.5));
  const t = top('wood_floor_1x1', 1.0);
  P.push(H(-0.55, t, 0.5, 'curios', { place: 'sidetable' }), H(-0.2, t, 0.45, 'curios', { place: 'sidetable', yaw: 30 }), on('Candle_resin', 0.55, t, 0.4));
  P.push({ n: 'sign', x: -0.97, y: 0.5, z: 1.05, yaw: 0, info: '-' }, { n: 'sign', x: 0.97, y: 0.5, z: 1.05, yaw: 0, info: '-' });
  P.push(W(0, 1.75, 0, 'arms', { near: 'sleep' }));
  recipe('dresser-01', 'dresser', { from: 'web', foot: { x: [-1.15, 1.15], z: [0, 1.1], h: 2.1 }, rooms: ['bedroom', 'home'], built: 'plank',
    src: { title: "SozAI transcript '50+ building tips in Valheim 2026' (signs as drawer fronts); Versaugh small cabinet; Tyler's collage (dresser)" } }, P);
}
{
  // a wardrobe between two posts with a beam over, a chest beside it for the household's things (Versaugh 'Wardrobe
  // Closet'; corpus wardrobe nooks)
  const P = [];
  P.push(on('piece_chest_warderobe', -0.2, 0, 0.45, 180));
  P.push(on('wood_pole2', -1.05, 0, 0.25), on('wood_pole2', 0.65, 0, 0.25), on('wood_beam', -0.2, 2.0, 0.25));
  P.push(on('piece_chest_wood', 1.65, 0, 0.45));
  P.push(H(1.4, top('piece_chest_wood', 0), 0.45, 'hat', { place: 'chest' }));
  recipe('wardrobe-01', 'wardrobe-nook', { from: 'web', foot: { x: [-1.3, 2.5], z: [0, 0.9], h: 2.45 }, rooms: ['bedroom'], built: 'plank', src: { title: "Versaugh 'Over 20 interior ideas' (Wardrobe Closet)" } }, P);
}
// ---------------------------------------------------------------- armor alcoves and weapon racks
{
  // album 61: armor stands in alcoves between dark pillars, a light over each, a banner behind
  const P = [];
  P.push(on('darkwood_pole', -0.9, 0, 0.25), on('darkwood_pole', 0.9, 0, 0.25), on('darkwood_beam', 0, 2.0, 0.25));
  P.push(on('ArmorStand', 0, 0, 0.55, 0, { want: 'full' }));
  P.push(on('piece_walltorch', 0, 1.95, 0.2, 270));
  recipe('armor-alcove-01', 'armor-alcove', { foot: { x: [-1.1, 1.1], z: [0, 0.9], h: 2.45 }, rooms: ['hall', 'armory', 'bedroom', 'entry'], built: 'darkwood', src: { title: "Tyler's album 61" } }, P);
}
{
  const P = [];
  P.push(on('stone_wall_1x1', -1.0, 0, 0.5), on('stone_wall_1x1', -1.0, 1.0, 0.5), on('stone_wall_1x1', 1.0, 0, 0.5), on('stone_wall_1x1', 1.0, 1.0, 0.5), on('stone_wall_2x1', 0, 2.0, 0.5));
  P.push(on('ArmorStand', 0, 0, 0.55, 0, { want: 'full' }));
  P.push(W(-1.0, 1.6, 1.0, 'shield'));
  recipe('armor-alcove-02', 'armor-alcove', { foot: { x: [-1.5, 1.5], z: [0, 1.1], h: 3.0 }, rooms: ['hall', 'armory', 'entry'], built: 'stone', cultures: ['stone'], src: { title: "Tyler's album 61 (stone)" } }, P);
}
{
  // Versaugh 'Weapons cabinet', album 126 (a shield over the hearth with crossed weapons), corpus wall stands on beams:
  // a beam on two posts with wall stands on its face, the shield in the middle, weapons either side
  const P = [];
  P.push(on('wood_pole2', -1.05, 0, 0.2), on('wood_pole2', 1.05, 0, 0.2), on('wood_beam', 0, 1.5, 0.2), on('wood_beam', 0, 0.3, 0.2));
  P.push(W(0, 1.75, 0.4, 'shield'), W(-0.6, 1.65, 0.4, 'arms'), W(0.6, 1.65, 0.4, 'arms'));
  P.push(on('piece_chest_wood', 0, 0, 0.75));
  recipe('weapon-rack-01', 'weapon-rack', { from: 'web', foot: { x: [-1.25, 1.25], z: [0, 1.15], h: 2.0 }, rooms: ['hall', 'armory', 'entry', 'bedroom'], built: 'plank',
    src: { title: "Versaugh 'Over 20 interior ideas' (Weapons cabinet); Tyler's album 126" }, note: 'one weapon of each kind, never the same weapon twice side by side' }, P);
}
{
  // corpus wall stands over workbenches (578), tool shelf beside (40 %): a tool wall of a beam with stands and a chest
  const P = [];
  P.push(on('wood_beam', 0, 1.45, 0.2), on('wood_beam', 0, 2.1, 0.2));
  [-0.7, -0.25, 0.25, 0.7].forEach(x => P.push(W(x, 1.7, 0.4, 'work', { near: 'craft' })));
  P.push(on('piece_chest_wood', 0, 0, 0.45));
  P.push({ n: 'sign', x: 0, y: top('piece_chest_wood', 0) + 0.25, z: 0.06, yaw: 0, info: '' });
  recipe('tool-wall-01', 'tool-shelf', { from: 'corpus-rule', foot: { x: [-1.0, 1.0], z: [0, 0.85], h: 2.5 }, rooms: ['workshop', 'smithy', 'storage'], built: 'plank',
    src: { title: 'corpus wall stands over workbenches (data/stands-corpus.json); docs/ROOM_STUDY.md work corners' } }, P);
}
// ---------------------------------------------------------------- seating, tables, displays
{
  // album 183: a U-shaped built-in bench of half walls sunk to seat height (corpus: half walls at seat height along
  // walls in 292 builds) round a low table of 1 x 1 floors on short legs, mugs and a dish on it, a hide under it
  const P = [];
  for (const x of [-1, 1]) for (const z of [0.15, 0.45]) P.push(on('wood_wall_half', x, -0.5, z));
  for (const x of [-1.85, 1.85]) for (const dz of [0, 0.3]) P.push(on('wood_wall_half', x + (x < 0 ? dz : -dz), -0.5, 1.6, 90));
  P.push(on('wood_pole', -0.6, -0.5, 1.5), on('wood_pole', 0.6, -0.5, 1.5));
  P.push(on('wood_floor_1x1', -0.5, 0.5, 1.5), on('wood_floor_1x1', 0.5, 0.5, 1.5));
  const t = top('wood_floor_1x1', 0.5);
  P.push(H(-0.5, t, 1.4, 'tankard', { place: 'table', yaw: 20 }), H(0.1, t, 1.6, 'food', { place: 'table' }), H(0.55, t, 1.35, 'tankard', { place: 'table', yaw: 250 }));
  P.push(on('rug_deer', 0, 0, 1.5));
  recipe('sitting-nook-01', 'sitting-nook', { foot: { x: [-2.05, 2.05], z: [0, 2.65], h: 0.65 }, rooms: ['hall', 'tavern', 'hearth', 'home'], built: 'plank', src: { title: "Tyler's album 183" },
    note: 'needs a room 4 m wide; the open side faces the walking line' }, P);
}
{
  // album 173, 179, 189: a display counter with one kind of food per row, herbs hung on the wall behind, a sign over
  const P = [];
  P.push(on('wood_wall_half', -1, 0, 0.85), on('wood_wall_half', 1, 0, 0.85));
  for (const x of [-1.5, -0.5, 0.5, 1.5]) P.push(on('wood_floor_1x1', x, 1.0, 0.5));
  const t = top('wood_floor_1x1', 1.0);
  [-1.6, -1.25, -0.9].forEach(x => P.push(H(x, t, 0.55, 'produce', { place: 'counter', row: true })));
  [-0.3, 0.05, 0.4].forEach(x => P.push(H(x, t, 0.55, 'food', { place: 'counter', row: true })));
  [1.0, 1.4].forEach(x => P.push(H(x, t, 0.55, 'pantry', { place: 'counter', row: true })));
  P.push(W(-1.2, 1.9, 0, 'herbs'), W(1.2, 1.9, 0, 'fish'));
  P.push({ n: 'sign', x: 0, y: 2.2, z: 0.06, yaw: 0, info: '' });
  recipe('display-counter-01', 'display-counter', { foot: { x: [-2, 2], z: [0, 1.0], h: 2.5 }, rooms: ['tavern', 'storage', 'hall', 'kitchen'], built: 'plank',
    src: { title: "Tyler's album 173, 179, 189" }, note: 'one kind per row; the sign takes a label the building sets (FRESH DAILY in album 189)' }, P);
}
{
  // SozAI tip: a round bedside table from a stool with a stand and a wooden shield on it as the top
  const P = [on('piece_chair', 0, 0, 0.4), Object.assign(H(0, 0.6, 0.4, 'shield', { place: 'sidetable' }), { info: 'ShieldWood:0:1' })];
  recipe('round-side-table-01', 'side-table', { from: 'web', foot: { x: [-0.35, 0.35], z: [0, 0.75], h: 0.75 }, rooms: ['bedroom', 'home', 'hall'], built: 'plank',
    src: { title: "SozAI transcript '50+ building tips in Valheim 2026' (round bedside table)" }, note: 'the stand holds a wooden shield lying flat as the table top' }, P);
}
{
  // corpus display plinths (wood_floor_1x1 under item stands, 99 builds at table height), album 172 and 178: a trophy on
  // a stone plinth
  const P = [on('stone_wall_1x1', 0, 0, 0.6), H(0, top('stone_wall_1x1', 0), 0.6, 'trophy', { place: 'counter' })];
  recipe('trophy-plinth-01', 'display-plinth', { from: 'corpus-rule', foot: { x: [-0.6, 0.6], z: [0, 1.2], h: 2.2 }, rooms: ['hall', 'temple', 'study', 'home'], built: 'stone',
    src: { title: 'docs/ROOM_STUDY.md custom furniture (display plinths); album 172, 178' } }, P);
}
{
  // album 180 (herbs hung from the beam over the counter) and Alessio '10+ furniture ideas': a drying rack of a beam
  // on two posts with herbs and fish hung on wall stands on its face
  const P = [];
  P.push(on('wood_pole2', -1.05, 0, 0.2), on('wood_pole2', 1.05, 0, 0.2), on('wood_beam', 0, 1.85, 0.2));
  [-0.7, -0.25, 0.25, 0.7].forEach((x, i) => P.push(W(x, 1.7, 0.4, i % 3 === 2 ? 'fish' : 'herbs', { near: 'kitchen' })));
  P.push(on('piece_chest_barrel', 0.6, 0, 0.6));
  recipe('drying-rack-01', 'drying-rack', { foot: { x: [-1.25, 1.25], z: [0, 1.0], h: 2.3 }, rooms: ['kitchen', 'storage', 'home'], built: 'plank', src: { title: "Tyler's album 180" } }, P);
}

const out = path.join(__dirname, '../data/assemblies/authored.json');
fs.writeFileSync(out, JSON.stringify({ about: 'Furniture assembly recipes written from Tyler\'s album, his collage and builders\' pictures and tips (lab/author_assemblies.js). Same form as corpus.json; from: album, collage, web or corpus-rule. want on an item stand: the kind, group or theme lib/standitems.js pick() should fill it with; row: the stands of one shelf hold one thing in a row; want on an armor stand: full (a whole outfit).', recipes: R }, null, 1));
console.log(R.length, 'authored recipes ->', out);
