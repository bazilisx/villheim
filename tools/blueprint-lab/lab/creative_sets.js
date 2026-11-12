// Creative sets for the interior library (D-065, D-098): combined and clipped objects that serve a purpose in a room,
// furniture built up from building pieces, stations and props used as decor, things stacked, nested and set into each
// other the way the corpus builders do it. Each set is written here in its anchor's frame, then settled and measured
// with the game's colliders (lib/shapes.js) the way lib/kitbash.js fit() places it: what stands on the floor stands on
// it (or sinks as deep as asked), what rests on another piece sits on that piece's top, what hangs on a wall has its
// back on the wall's face. The clips that result (piece into piece, into the wall, into the anchor) are written with
// the set, so the fitter allows those and no others.
//   node lab/creative_sets.js [mined.json] [library.json]
// mined.json: the combined objects lab/mine_creative.js found (kept when they read as one object; their sets below
// name the build). Writes the sets into data/kitbash-interior.json as assemblies with ids KC-001 on and creative: true,
// replacing the KC sets of an earlier run and leaving the mined KB sets alone.
//
// Frames (as lib/kitbash.js BUILT_KITS): wall and window, x along the wall, z out of its face, y over the floor's top;
// corner, written here along the two walls (u along the first, v along the second, both out from the corner) and turned
// to the fitter's frame (+z along the bisector); table, bed and hearth, the anchor's pivot and turn; post, the post's
// middle; floor, the spot's middle.
//
// Each set carries: family and role (furniture, decor, clutter, lived-in, wall, floor, window), traits (the household
// traits it suits: tidy, messy, comfort, austere, wealth, modest, busy and the hobbies crafts, collect, plants, games,
// maps, food; never a trade), rooms, decor stages (d1 only for beds and storage the room needs), the earliest biome its
// pieces allow (lib/pieces.js needs; minor decor anywhere), footprint and height, and what it is based on in the corpus
// (the decor table's counts for its pieces in data/kitbash-interior.json, and the source builds where it was seen).
const fs = require('fs'), path = require('path');
const P = require('../lib/pieces.js'), SH = require('../lib/shapes.js'), Ck = require('../lib/checks.js'), KB = require('../lib/kitbash.js');

const LIB = path.join(__dirname, '../data/kitbash-interior.json');
// picks left out after the probe and the pictures (lab/creative_fit.js --probe, lab/render_creative.js)
const DROP = process.env.NODROP ? new Set() : new Set([
  // these went into no room tried (lab/creative_fit.js --probe, 2026-11-10)
  42, 116, 197, 4, 11, 30, 73, 125, 211, 223, 50, 54, 152, 156, 278, 52, 92, 123, 149, 151, 48, 257, 269, 247, 192, 201,
  202, 222, 246, 170, 232, 241, 252, 275, 285, 249, 256, 286, 178, 279, 280, 271, 290, 230, 242, 195, 213, 220, 224,
  // and these read badly in the pictures (lab/render_creative.js, 2026-11-10): a chair alone where the cups on it did
  // not fit (3, 27, 294, 265), beams lying on the floor by a torch or chair with nothing to make them a bench (62,
  // 240, 87, 168), an armor stand or marble head leaning on a floor beam (72, 255), pots strewn over floor beams (226),
  // Dvergr shelves turned off the wall (277, 284), three bone thrones in a row (253), and two that never showed up in
  // a picture (243, 264)
  3, 27, 294, 265, 62, 240, 87, 168, 72, 255, 226, 277, 284, 253, 243, 264,
  // and these failed the test pool audit (2026-11-10): the galdr table and its upgrades clip into each other and the
  // ledger stands on a chair (175, 153, 251); item stands hung on a half wall 0.5 m up (163)
  175, 153, 251, 163,
]);
const DECOR_CLIP = new Map(JSON.parse(fs.readFileSync(LIB, 'utf8')).decor.map(d => [d.n, d.clip]));
const outPath = process.argv[3] || LIB;

// ---------------------------------------------------------------- writing sets
const SETS = [];
// pc(name, x, z, yaw, rest, opts): rest is 'floor', 'wall', 'anchor', or the index of the piece it stands on.
// opts: y (for wall pieces: the pivot's height), sink (metres into the floor), back (stand with its back to the wall,
// 2 cm off), key (the set is out without it), want (what an item stand holds), k (the slot, for building pieces that
// take the village's own wood)
const BACK_TURN = { piece_chest_warderobe: 180 };
const pc = (n, x, z, yaw, rest, o) => Object.assign({ n, x, z, yaw, rest }, o || {});
function set(id, name, o, pieces) { SETS.push(Object.assign({ key: id, name, pieces }, o)); }
const C45 = Math.SQRT1_2;

// building pieces fill the village's own slot (beams, half walls, posts, ledges in its wood), so a shelf matches the
// house; everything else keeps its own prefab
// (posts keep their own prefab: the village's post may be a 4 m log, and a lamp post or a rail is made for its height)
const BUILT_K = { wood_beam_1: 'beam1', ashwood_beam_1m: 'beam1', wood_beam: 'beam2', darkwood_beam: 'beam2', woodiron_beam: 'beam2', wood_wall_half: 'half', wood_wall_quarter: 'quarter',
  wood_ledge: 'ledge' };
// a beam hung on a wall as a shelf keeps its own prefab: the village's beam may pivot elsewhere (the dark wood beam
// pivots on its underside) and then reads as loose structure to the support and headroom checks
const kOf = (n, rest) => (rest !== 'wall' && BUILT_K[n]) || (KB.slotOf(n) === 'feast' ? 'feast' : n);

// ---------------------------------------------------------------- the sets
// Families, with the corpus behind each (counts: builds using the prefab / of them well-liked, and how its pieces rest:
// the decor table in data/kitbash-interior.json; and the 21 builds on Tyler's board, lab/mine_creative.js).

// 1. Storage stacks: chests and barrels set on each other, labelled, crates pushed in askew. Sign on a chest: pairs
// in data/interior.json (sign 0.25 m over a wood chest, 33 rooms; over iron chests 18). Chests on chests: wood chests
// rest on another piece 190 times, iron 156, black metal 63, grausten 18 of 64, crates 17 of 52.
set('stack-label', 'labelled chest', { family: 'storage', role: 'furniture', anchor: 'wall', traits: { tidy: 1 }, rooms: ['storage', 'workshop', 'home', 'smithy', 'kitchen'], decor: ['d1', 'd2', 'd3'], src: ['No. 647 workshop-round-workshop'], basis: 'sign over a chest: 33 rooms (data/interior.json pairs); No. 647' }, [
  pc('piece_chest_wood', 0, 0, 0, 'floor', { back: true, key: true }), pc('sign', 0, 0, 0, 'wall', { y: 1.15 }), pc('piece_chest_barrel', 1.25, 0, 0, 'floor', { back: true })]);
set('stack-label-iron', 'labelled iron chests', { family: 'storage', role: 'furniture', anchor: 'wall', traits: { tidy: 1, wealth: 0.5 }, rooms: ['storage', 'smithy', 'workshop', 'hall'], decor: ['d1', 'd2', 'd3'], basis: 'sign over an iron chest: 18 rooms, over a black metal chest: 21 (data/interior.json pairs)' }, [
  pc('piece_chest', -1.0, 0, 0, 'floor', { back: true, key: true }), pc('piece_chest', 1.0, 0, 0, 'floor', { back: true }), pc('sign', -1.0, 0, 0, 'wall', { y: 1.4 }), pc('sign_notext', 1.0, 0, 0, 'wall', { y: 1.4 })]);
set('stack-strongbox', 'strongbox under a chest', { family: 'storage', role: 'furniture', anchor: 'wall', traits: { wealth: 1, tidy: 0.5 }, rooms: ['home', 'hall', 'storage', 'sleeping'], decor: ['d2', 'd3'], basis: 'black metal chests: 115 builds, 63 resting on or under another piece' }, [
  pc('piece_chest_blackmetal', 0, 0, 0, 'floor', { back: true, key: true }), pc('piece_chest_wood', 0, 0, 0, 0, { back: true }), pc('Candle_resin', 0.55, 0.4, 0, 1), pc('sign', 0, 0, 0, 'wall', { y: 1.95 })]);
set('stack-barrels', 'barrels two high', { family: 'storage', role: 'furniture', anchor: 'wall', traits: { busy: 0.6 }, rooms: ['storage', 'kitchen', 'tavern', 'workshop', 'barn'], decor: ['d2', 'd3'], src: ['No. 549 house-ute-cozy-house'], basis: 'barrels stacked against a wall in No. 549; barrels rest on another piece 127 times in 131 builds' }, [
  pc('piece_chest_barrel', 0, 0, 0, 'floor', { back: true, key: true }), pc('piece_chest_barrel', 0, 0, 20, 0, { back: true }), pc('piece_chest_barrel', 0.85, 0, 0, 'floor', { back: true }), pc('piece_pot1', 1.7, 0.4, 30, 'floor'), pc('sign_notext', 0.45, 0, 0, 'wall', { y: 2.1 })]);
set('stack-crates', 'crates pushed in askew', { family: 'storage', role: 'clutter', anchor: 'corner', angle: 90, traits: { messy: 1, busy: 0.6 }, rooms: ['storage', 'workshop', 'barn', 'tavern'], decor: ['d2', 'd3'], basis: 'Dvergr crates: 52 pieces in 8 builds, 17 resting on another crate' }, [
  pc('dvergrprops_crate', 0.6, 0.6, 0, 'floor', { key: true }), pc('dvergrprops_crate', 0.62, 0.58, 14, 0), pc('dvergrprops_crate_long', 2.2, 0.5, 0, 'floor'), pc('piece_chest_barrel', 0.55, 1.65, 0, 'floor')]);
set('stack-crates-lamp', 'lantern on a crate', { family: 'storage', role: 'lived-in', anchor: 'wall', traits: { busy: 0.5 }, rooms: ['storage', 'workshop', 'home', 'tavern'], decor: ['d2', 'd3'], basis: 'standing Dvergr lantern on another piece 11 of 99 times; crates on crates 17' }, [
  pc('dvergrprops_crate', 0, 0, 6, 'floor', { back: true, key: true }), pc('dvergrprops_lantern_standing', 0.2, 0.45, 0, 0), pc('dvergrprops_crate_long', 1.65, 0, 0, 'floor', { back: true }), pc('MeadTasty', 1.4, 0.35, 30, 2)]);
set('stack-grausten', 'grausten chests stacked', { family: 'storage', role: 'furniture', anchor: 'wall', traits: { tidy: 0.8, wealth: 0.4 }, rooms: ['storage', 'hall', 'home', 'smithy'], decor: ['d2', 'd3'], basis: 'grausten chests: 64 pieces in 6 builds, 18 resting on another' }, [
  pc('piece_chest_grausten', 0, 0, 0, 'floor', { back: true, key: true }), pc('piece_chest_grausten', 0, 0, 0, 0, { back: true }), pc('piece_chest_barrel', 1.2, 0, 0, 'floor', { back: true }), pc('Candle_resin', 1.2, 0.4, 0, 2)]);
set('stack-wardrobe', 'wardrobe with clothes on a chair', { family: 'storage', role: 'lived-in', anchor: 'wall', traits: { comfort: 0.6, messy: 0.6 }, rooms: ['sleeping', 'home'], decor: ['d2', 'd3'], basis: 'wardrobes: 35 pieces in 6 builds; a horizontal stand on a chair seat in 28 rooms (data/interior.json pairs)' }, [
  pc('piece_chest_warderobe', 0, 0, 0, 'floor', { back: true, key: true }), pc('piece_chair03', 1.2, 0.55, 340, 'floor'), pc('itemstandh', 1.2, 0.6, 0, 1, { want: 'small' }), pc('rug_hare', 0.3, 1.35, 90, 'floor')]);
set('stack-wardrobe-tidy', 'wardrobe and chest', { family: 'storage', role: 'furniture', anchor: 'wall', traits: { tidy: 1 }, rooms: ['sleeping', 'home'], decor: ['d1', 'd2', 'd3'], basis: 'wardrobes: 35 pieces in 6 builds, always on the floor against a wall' }, [
  pc('piece_chest_warderobe', 0, 0, 0, 'floor', { back: true, key: true }), pc('piece_chest_wood', 1.55, 0, 0, 'floor', { back: true }), pc('sign_notext', 1.55, 0, 0, 'wall', { y: 1.2 })]);
set('stack-cellar', 'cellar corner of jars', { family: 'storage', role: 'clutter', anchor: 'corner', angle: 90, traits: { food: 1, busy: 0.4 }, rooms: ['storage', 'kitchen'], decor: ['d2', 'd3'], basis: 'red and cracked pots: 113 and 4 pieces, most on the floor or against a wall' }, [
  pc('piece_chest_barrel', 0.5, 0.5, 0, 'floor', { key: true }), pc('piece_pot2_red', 1.3, 0.4, 20, 'floor'), pc('piece_pot2_cracked', 0.42, 1.3, 70, 'floor'), pc('piece_pot3', 1.15, 1.15, 0, 'floor'), pc('Honey', 0.5, 0.5, 0, 0)]);

// 2. Built-up furniture (D-065): beams as shelves, half and quarter walls as cabinet backs and plinths, posts as
// frames. Beams carry decor in 93 builds (on 66, against a wall 322 times); quarter walls carry it 32 times; ledges 43.
set('built-beamshelf', 'beam shelf of jars', { family: 'built', role: 'wall', anchor: 'wall', traits: { food: 0.8, tidy: 0.6 }, rooms: ['kitchen', 'home', 'storage', 'tavern'], decor: ['d2', 'd3'], basis: 'wood beams hung on a wall with things on them: 322 times in 93 builds' }, [
  pc('wood_beam', 0, 0, 0, 'wall', { y: 1.25, key: true }), pc('QueensJam', -0.6, 0.2, 10, 0), pc('Honey', -0.1, 0.2, 80, 0), pc('Candle_resin', 0.35, 0.2, 0, 0), pc('Blueberries', 0.7, 0.2, 0, 0), pc('piece_chest_barrel', -0.45, 0, 0, 'floor', { back: true })]);
set('built-beamshelf2', 'two beam shelves with herbs', { family: 'built', role: 'wall', anchor: 'wall', traits: { plants: 0.7, tidy: 0.7 }, rooms: ['home', 'kitchen', 'sleeping'], decor: ['d3'], basis: 'beams as shelves (322 against a wall); pots rest on another piece 7 times' }, [
  pc('wood_beam', 0, 0, 0, 'wall', { y: 1.1, key: true }), pc('wood_beam', 0, 0, 0, 'wall', { y: 1.9 }), pc('Pukeberries', -0.55, 0.2, 30, 0), pc('Fiddleheadfern', 0.5, 0.2, 0, 0), pc('MeadTasty', -0.5, 0.2, 0, 1), pc('Candle_resin', 0.45, 0.2, 0, 1), pc('piece_pot1', -0.5, 0, 0, 'floor', { back: true })]);
set('built-plinth', 'quarter wall plinth with a stand', { family: 'built', role: 'decor', anchor: 'wall', traits: { collect: 1 }, rooms: ['home', 'hall', 'tavern'], decor: ['d2', 'd3'], src: ['No. 207 house-octagon-starter-base'], basis: 'a quarter wall with an item stand hung on it, No. 207; quarter walls carry decor 32 times' }, [
  pc('wood_wall_quarter', 0, 0, 0, 'floor', { back: true, key: true }), pc('itemstandh', 0, 0.17, 0, 0, { want: 'small' }), pc('itemstand', 0, 0, 0, 'wall', { y: 1.55, want: 'trophy' })]);
set('built-plinth-pair', 'two plinths by a bench', { family: 'built', role: 'decor', anchor: 'wall', traits: { collect: 0.8, wealth: 0.6 }, rooms: ['hall', 'temple', 'home'], decor: ['d3'], basis: 'quarter walls carry decor 32 times; benches against walls 265' }, [
  pc('wood_wall_quarter', -1.75, 0.2, 0, 'floor', { key: true }), pc('wood_wall_quarter', 1.75, 0.2, 0, 'floor'), pc('piece_bench01', 0, 0, 0, 'floor', { back: true }), pc('Candle_resin', -1.75, 0.2, 0, 0), pc('itemstandh', 1.75, 0.2, 0, 1, { want: 'small' })]);
set('built-postchest', 'chest between two posts', { family: 'built', role: 'furniture', anchor: 'wall', traits: { tidy: 0.5, comfort: 0.4 }, rooms: ['home', 'sleeping', 'hall'], decor: ['d2', 'd3'], src: ['No. 549 house-ute-cozy-house'], basis: 'a wood chest framed by two short posts, No. 549 (four times in the build)' }, [
  pc('piece_chest_wood', 0, 0, 0, 'floor', { back: true, key: true }), pc('wood_pole', -1.0, 0.3, 0, 'floor'), pc('wood_pole', 1.0, 0.3, 0, 'floor'), pc('Candle_resin', -1.0, 0.3, 0, 1), pc('rug_hare', 0, 0.35, 0, 0)]);
set('built-pedestal', 'pedestal of a quarter wall and a ledge', { family: 'built', role: 'decor', anchor: 'corner', angle: 90, traits: { plants: 0.8 }, rooms: ['home', 'sleeping', 'hall', 'tavern'], decor: ['d2', 'd3'], basis: 'quarter walls (32 carrying decor) and ledges (43 on another piece) as plinths' }, [
  pc('wood_wall_quarter', 0.5, 0.35, 0, 'floor', { key: true }), pc('wood_ledge', 0.5, 0.45, 0, 0), pc('piece_pot3', 0.5, 0.45, 40, 1)]);
set('built-bench-back', 'bench with a half wall for a back', { family: 'built', role: 'furniture', anchor: 'wall', traits: { comfort: 0.6 }, rooms: ['tavern', 'hall', 'home'], decor: ['d2', 'd3'], basis: 'half walls carry decor 19 times and stand inside rooms 79 times; benches 265' }, [
  pc('wood_wall_half', 0, 0.6, 0, 'floor', { key: true }), pc('piece_bench01', 0, 1.05, 0, 'floor', { key: true }), pc('wood_ledge', -0.5, 0.6, 0, 0), pc('wood_ledge', 0.5, 0.6, 0, 0), pc('MeadTasty', -0.4, 0.6, 0, 2), pc('Candle_resin', 0.55, 0.6, 0, 3)]);
set('built-ledges-candles', 'ledge of candles over a chest', { family: 'built', role: 'wall', anchor: 'wall', traits: { comfort: 0.8 }, rooms: ['home', 'sleeping', 'temple', 'hall'], decor: ['d2', 'd3'], basis: 'ledges: 60 against a wall, 43 on another piece; candles on another piece 106 times' }, [
  pc('wood_ledge', -0.5, 0, 0, 'wall', { y: 1.45, key: true }), pc('wood_ledge', 0.5, 0, 0, 'wall', { y: 1.45 }), pc('Candle_resin', -0.7, 0.3, 0, 0), pc('Candle_resin', -0.2, 0.3, 0, 0), pc('Candle_resin', 0.45, 0.3, 0, 1), pc('piece_chest_wood', 0, 0, 0, 'floor', { back: true })]);

// 3. Stations as decor: crafting stations and their upgrades set out as a household's hobby corner, the bench dressed.
// Gem cutter on a table: 6 times on the anchor, 7 on another piece (27 builds); vise and metal cutter beside a bench.
set('craft-gems', 'gem cutter on a half-wall bench', { family: 'stations', role: 'decor', anchor: 'wall', traits: { crafts: 1, wealth: 0.5 }, rooms: ['workshop', 'home', 'smithy'], decor: ['d2', 'd3'], basis: 'gem cutter: 27 builds, on a table or another piece 13 times; half walls as counters (19 carrying decor)' }, [
  pc('wood_wall_half', 0, 0, 0, 'floor', { back: true, key: true }), pc('blackforge_ext4_gemcutter', -0.4, 0.2, 0, 0, { key: true }), pc('Candle_resin', 0.6, 0.18, 0, 0), pc('itemstandh', 0.3, 0.18, 0, 0, { want: 'small' }), pc('dvergrprops_stool', -0.35, 0.85, 0, 'floor')]);
set('craft-vise', 'vise and cutter by the bench', { family: 'stations', role: 'decor', anchor: 'wall', traits: { crafts: 1, busy: 0.7 }, rooms: ['workshop', 'smithy'], decor: ['d2', 'd3'], basis: 'vise 25 builds, metal cutter 21, apron 5 (on a wall)' }, [
  pc('blackforge_ext2_vise', -0.7, 0, 0, 'floor', { back: true, key: true }), pc('blackforge_ext3_metalcutter', 0.15, 0, 0, 'floor', { back: true }), pc('blackforge_ext5_apron', 1.05, 0, 0, 'wall', { y: 1.15 }), pc('piece_chest_barrel', 2.15, 0, 0, 'floor', { back: true })]);
set('craft-apron', 'apron on the wall over a stool', { family: 'stations', role: 'lived-in', anchor: 'wall', traits: { crafts: 0.8, messy: 0.5 }, rooms: ['workshop', 'smithy', 'home'], decor: ['d2', 'd3'], basis: 'apron: 5 builds, always hung on a wall' }, [
  pc('blackforge_ext5_apron', 0, 0, 0, 'wall', { y: 1.15, key: true }), pc('dvergrprops_stool', 0.1, 0.6, 15, 'floor'), pc('itemstand', 1.05, 0, 0, 'wall', { y: 1.55, want: 'tool' })]);
set('craft-alchemy', 'mortar, pestle and herbs', { family: 'stations', role: 'decor', anchor: 'wall', traits: { plants: 0.8, crafts: 0.6 }, rooms: ['kitchen', 'home', 'workshop'], decor: ['d2', 'd3'], basis: 'mortar and pestle: 80 builds; small rune table 25 builds, on a piece or the floor' }, [
  pc('cauldron_ext5_mortarandpestle', -0.4, 0, 0, 'floor', { back: true, key: true }), pc('piece_magetable_ext2', 0.75, 0, 0, 'floor', { back: true }), pc('Fiddleheadfern', 0.75, 0, 0, 1), pc('piece_pot1', 1.4, 0.35, 0, 'floor')]);
set('craft-scholar', 'reading table and scrolls', { family: 'stations', role: 'decor', anchor: 'wall', traits: { maps: 1, tidy: 0.5 }, rooms: ['home', 'hall', 'temple'], decor: ['d3'], basis: 'galdr table add-ons: ext 18 builds, ext2 25, ext3 17 (on a wall)' }, [
  pc('piece_magetable_ext', 0, 0, 0, 'floor', { back: true, key: true }), pc('piece_magetable_ext3', 0, 0, 0, 'wall', { y: 1.75 }), pc('Candle_resin', 0.3, 0.3, 0, 0), pc('dvergrprops_stool', 0, 1.4, 0, 'floor'), pc('piece_magetable_ext2', 0.9, 0, 0, 'floor', { back: true })]);
set('craft-galdr', 'galdr table corner', { family: 'stations', role: 'decor', anchor: 'corner', angle: 90, traits: { maps: 1, collect: 0.6, wealth: 0.5 }, rooms: ['home', 'hall', 'temple', 'workshop'], decor: ['d3'], basis: 'galdr table: 19 builds; its add-ons beside it' }, [
  pc('piece_magetable', 1.6, 1.6, 225, 'floor', { key: true }), pc('piece_magetable_ext', 3.75, 0.6, 0, 'floor'), pc('Candle_resin', 3.75, 0.6, 0, 1)]);
set('craft-spinning', 'spinning corner', { family: 'stations', role: 'decor', anchor: 'corner', angle: 90, traits: { crafts: 1, comfort: 0.5 }, rooms: ['home', 'sleeping', 'workshop'], decor: ['d2', 'd3'], src: ['No. 647 workshop-round-workshop'], basis: 'a spinning wheel with a standing torch by it, No. 647; spinning wheels 13 builds' }, [
  pc('piece_spinningwheel', 1.2, 1.15, 225, 'floor', { key: true }), pc('piece_groundtorch_wood', 0.4, 0.4, 0, 'floor'), pc('rug_straw', 1.6, 1.6, 45, 'floor'), pc('piece_chair', 2.15, 1.95, 225, 'floor')]);
set('craft-stonecutter', 'stonecutter with offcuts', { family: 'stations', role: 'clutter', anchor: 'wall', traits: { crafts: 0.9, busy: 0.8, messy: 0.5 }, rooms: ['workshop'], decor: ['d2', 'd3'], basis: 'stonecutter: 5 builds, on the floor' }, [
  pc('piece_stonecutter', 0, 0, 0, 'floor', { back: true, key: true }), pc('piece_pot2_cracked', 2.1, 0.4, 40, 'floor'), pc('piece_chest_barrel', 2.1, 1.2, 0, 'floor')]);
set('craft-toolwall', 'tool rack over the chopping block', { family: 'stations', role: 'wall', anchor: 'wall', traits: { crafts: 0.9, tidy: 0.6 }, rooms: ['workshop', 'home', 'barn'], decor: ['d2', 'd3'], basis: 'tool rack (workbench ext4): 124 builds, 115 on a wall; chopping block 77' }, [
  pc('piece_workbench_ext4', 0, 0, 0, 'wall', { y: 1.15, key: true }), pc('piece_workbench_ext1', -1.2, 0, 0, 'floor', { back: true }), pc('itemstand', 1.15, 0, 0, 'wall', { y: 1.6, want: 'tool' })]);
set('craft-smithrack', 'smith tool rack with a cooling barrel', { family: 'stations', role: 'wall', anchor: 'wall', traits: { crafts: 0.7, busy: 0.6 }, rooms: ['smithy', 'workshop'], decor: ['d2', 'd3'], basis: 'forge tool rack: 127 builds, 122 on a wall' }, [
  pc('forge_ext6', 0, 0, 0, 'wall', { y: 1.65, key: true }), pc('forge_ext5', -0.8, 0, 0, 'floor', { back: true }), pc('piece_chest_barrel', 0.6, 0, 0, 'floor', { back: true }), pc('itemstandh', 0.6, 0.4, 0, 2, { want: 'small' })]);
set('craft-artisan', 'artisan press and ledger', { family: 'stations', role: 'decor', anchor: 'wall', traits: { crafts: 1, wealth: 0.4 }, rooms: ['workshop'], decor: ['d3'], basis: 'artisan press: 19 builds, on the floor and against walls' }, [
  pc('artisan_ext1', 0, 0, 0, 'floor', { back: true, key: true }), pc('piece_chest_wood', 1.45, 0, 0, 'floor', { back: true }), pc('sign', 1.45, 0, 0, 'wall', { y: 1.25 })]);
set('craft-tanning', 'pelts by the bench', { family: 'stations', role: 'lived-in', anchor: 'workbench', traits: { crafts: 0.8, comfort: 0.4 }, rooms: ['workshop'], decor: ['d2', 'd3'], basis: 'hare rugs rest on another piece 39 times and on a table 126; workbench add-ons beside the bench' }, [
  pc('piece_chest_wood', 3.4, 0, 0, 'floor', { key: true }), pc('rug_hare', 3.4, 0, 90, 0), pc('piece_workbench_ext2', -2.65, 0.05, 0, 'floor')]);

// 4. Display and collecting: busts on plinths, carvings over each other, thrones with pelts, armor dressed.
// Marble heads: head01 113 pieces (wall 63), stacked 1 m apart in 12 rooms; the dragon over the wolf 19 rooms.
set('show-bust', 'marble head on a plinth', { family: 'display', role: 'decor', anchor: 'wall', traits: { collect: 1, wealth: 0.7 }, rooms: ['hall', 'temple', 'home'], decor: ['d3'], basis: 'black marble heads: 113 pieces in 3 builds, 7 on another piece, 63 against a wall' }, [
  pc('wood_wall_quarter', 0, 0, 0, 'floor', { back: true, key: true }), pc('blackmarble_head01', 0, 0.5, 0, 0, { back: true })]);
set('show-busts', 'two heads by a bench', { family: 'display', role: 'decor', anchor: 'wall', traits: { collect: 1, wealth: 0.8 }, rooms: ['hall', 'temple'], decor: ['d3'], basis: 'black marble heads in pairs (data/interior.json pairs: a second head 1 to 2 m off, 20 rooms)' }, [
  pc('blackmarble_head02', -1.85, 0, 0, 'floor', { back: true, key: true }), pc('blackmarble_head01', 1.85, 0, 0, 'floor', { back: true }), pc('piece_blackmarble_bench', 0, 0, 0, 'floor', { back: true })]);
set('show-wolf', 'wolf carving over a chest', { family: 'display', role: 'wall', anchor: 'wall', traits: { collect: 1, wealth: 0.5 }, rooms: ['hall', 'home', 'tavern'], decor: ['d3'], basis: 'wolf carving: 8 builds, 6 on a wall; the dragon carving 1 m over it in 19 rooms (data/interior.json pairs), here one carving to a wall for 3 m rooms' }, [
  pc('darkwood_wolf', -1.09, 0, 90, 'wall', { y: 1.45, key: true }), pc('piece_chest_wood', 0, 0, 0, 'floor', { back: true })]);
set('show-dragon', 'dragon carving over a bench', { family: 'display', role: 'wall', anchor: 'wall', traits: { collect: 0.9, wealth: 0.4 }, rooms: ['hall', 'tavern', 'home'], decor: ['d3'], basis: 'dragon carving: 13 builds, 41 on a wall' }, [
  pc('wood_dragon1', -1.68, 0, 90, 'wall', { y: 1.55, key: true }), pc('piece_bench01', 0, 0, 0, 'floor', { back: true })]);
set('show-raven', 'raven over a high chair', { family: 'display', role: 'decor', anchor: 'wall', traits: { collect: 0.8, wealth: 0.6 }, rooms: ['hall', 'home'], decor: ['d3'], basis: 'raven carving: 28 on a wall, 15 on another piece (5 builds)' }, [
  pc('piece_chair03', 0, 0, 0, 'floor', { back: true, key: true }), pc('darkwood_raven', -1.55, 0, 90, 'wall', { y: 1.5 }), pc('rug_wolf', 0, 1.6, 90, 'floor')]);
set('show-bonethrone', 'bone throne and bear pelt', { family: 'display', role: 'furniture', anchor: 'wall', traits: { collect: 0.8, wealth: 0.8 }, rooms: ['hall'], decor: ['d3'], basis: 'bone throne 16 builds; the bear rug 12; wall torches in pairs' }, [
  pc('piece_bone_throne', 0, 0, 0, 'floor', { back: true, key: true }), pc('rug_Bjorn', 0, 1.0, 0, 'floor'), pc('piece_walltorch', -1.1, 0, 270, 'wall', { y: 1.6 }), pc('piece_walltorch', 1.1, 0, 270, 'wall', { y: 1.6 })]);
set('show-moose', 'moose hide and chairs at the fire', { family: 'display', role: 'furniture', anchor: 'hearth', of: 'hearth', traits: { comfort: 0.8, wealth: 0.7 }, rooms: ['hall', 'home'], decor: ['d3'], basis: 'moose rug 4 builds (8 on the floor); rugs 2.5 m out from the fire; high-backed chairs 252 builds' }, [
  pc('rug_moose', 0, 3.2, 90, 'floor', { key: true }), pc('piece_chair03', -1.2, 3.4, 160, 'floor'), pc('piece_chair03', 1.2, 3.4, 200, 'floor'), pc('itemstandh', 0, 3.6, 0, 'floor', { want: 'drink' })]);
set('show-armor', 'armor stand by a rack', { family: 'display', role: 'decor', anchor: 'corner', angle: 90, traits: { collect: 0.9, tidy: 0.5 }, rooms: ['home', 'hall', 'sleeping'], decor: ['d2', 'd3'], basis: 'armor stands 168 builds, 565 on the floor; a wall stand 0.25 m from a chair 15 rooms' }, [
  pc('ArmorStand', 0.75, 0.75, 45, 'floor', { key: true }), pc('itemstand', 1.7, 0, 0, 'wall', { y: 1.55, want: 'shield' }), pc('piece_chest_wood', 0, 2.4, 90, 'floor', { back: true }), pc('itemstand', 0, 1.75, 90, 'wall', { y: 1.6, want: 'weapon' })]);
set('show-banners-shield', 'shield between two banners', { family: 'display', role: 'wall', anchor: 'wall', traits: { collect: 0.6, wealth: 0.8 }, rooms: ['hall', 'temple', 'tavern'], decor: ['d3'], basis: 'banners 08 and 11: 28 builds each, mostly on walls' }, [
  pc('piece_banner08', -0.95, 0, 90, 'wall', { y: 2.35, key: true }), pc('piece_banner08', 0.95, 0, 90, 'wall', { y: 2.35 }), pc('itemstand', 0, 0, 0, 'wall', { y: 1.7, want: 'shield' })]);
set('show-banners-chest', 'banner over a chest', { family: 'display', role: 'wall', anchor: 'wall', traits: { wealth: 0.7, tidy: 0.5 }, rooms: ['hall', 'home', 'temple'], decor: ['d2', 'd3'], basis: 'banners 06 and 07: 13 and 17 builds, on walls; wood chests against walls 222' }, [
  pc('piece_banner07', 0, 0, 90, 'wall', { y: 2.35, key: true }), pc('piece_chest_wood', 0, 0, 0, 'floor', { back: true })]);
set('show-banners-pair', 'two banners by a doorway bench', { family: 'display', role: 'wall', anchor: 'wall', traits: { wealth: 0.6 }, rooms: ['hall', 'tavern', 'temple'], decor: ['d3'], basis: 'banners 09 and 11 on walls: 26 and 69 times' }, [
  pc('piece_banner09', -1.3, 0, 90, 'wall', { y: 2.35, key: true }), pc('piece_banner11', 1.3, 0, 90, 'wall', { y: 2.35 }), pc('piece_bench_runed', 0, 0, 0, 'floor', { back: true })]);
set('show-runed', 'runed bench and chairs', { family: 'display', role: 'furniture', anchor: 'corner', angle: 90, traits: { wealth: 0.7, comfort: 0.5 }, rooms: ['hall', 'temple', 'home'], decor: ['d3'], basis: 'runed bench 5 builds, runed chair 4' }, [
  pc('piece_bench_runed', 1.6, 0.4, 0, 'floor', { key: true }), pc('piece_chair_runed', 0, 1.5, 90, 'floor', { back: true }), pc('piece_banner06', 0, 2.5, 180, 'wall', { y: 2.35 })]);

// 5. Food and drink on show: brewing corners, pantry shelves, a laid table. Food and drink become flat stands with
// the household's pick (lib/kitbash.js fit, T-626), so the prefab here says drink or food.
set('food-brew', 'brewing corner', { family: 'food', role: 'decor', anchor: 'corner', angle: 90, traits: { food: 1, busy: 0.5 }, rooms: ['kitchen', 'tavern', 'storage', 'home'], decor: ['d2', 'd3'], src: ['No. 207 house-octagon-starter-base'], basis: 'mead cauldron by a cauldron and a post, No. 207; fermenters on another piece 39 times' }, [
  pc('piece_MeadCauldron', 0.7, 0.7, 45, 'floor', { key: true }), pc('piece_chest_barrel', 1.75, 0.45, 0, 'floor'), pc('BarleyWine', 1.75, 0.45, 0, 1), pc('piece_chest_barrel', 0.45, 1.75, 0, 'floor'), pc('MeadTasty', 0.45, 1.75, 0, 3)]);
set('food-brew-fermenter', 'fermenter with its barrels', { family: 'food', role: 'furniture', anchor: 'wall', traits: { food: 0.9 }, rooms: ['tavern', 'kitchen', 'storage'], decor: ['d2', 'd3'], basis: 'fermenters 82 builds; barrels beside them' }, [
  pc('fermenter', 0, 0, 0, 'floor', { back: true, key: true }), pc('piece_chest_barrel', 1.3, 0, 0, 'floor', { back: true }), pc('piece_chest_barrel', 1.3, 0, 0, 1, { back: true }), pc('MeadStaminaMedium', -1.15, 0.35, 0, 'floor')]);
set('food-pantry', 'pantry shelf', { family: 'food', role: 'furniture', anchor: 'wall', traits: { food: 1, tidy: 0.6 }, rooms: ['kitchen', 'storage', 'tavern'], decor: ['d2', 'd3'], basis: 'Dvergr shelves: 6 builds; jams, honey and berries on other pieces' }, [
  pc('dvergrprops_shelf', 0, 0, 180, 'floor', { back: true, key: true }), pc('QueensJam', -0.5, 0.25, 0, 0), pc('RoyalJelly', 0.4, 0.25, 0, 0), pc('piece_pot2_red', 1.3, 0.35, 0, 'floor')]);
set('food-board', 'a laid table', { family: 'food', role: 'lived-in', anchor: 'table', of: 'table', traits: { food: 1, comfort: 0.5 }, rooms: ['home', 'kitchen', 'tavern', 'hall'], decor: ['d2', 'd3'], basis: 'feasts on a table: every feast prefab rests on its anchor in the corpus (10 to 22 times each); bread and pies 7' }, [
  pc('FeastMeadows', 0, 0, 0, 'anchor', { key: true }), pc('Bread', -0.85, 0.15, 30, 'anchor'), pc('RoastedCrustPie', 0.85, -0.2, 0, 'anchor'), pc('MeadHealthMajor', 0.6, 0.35, 0, 'anchor'), pc('Candle_resin', -0.95, -0.35, 0, 'anchor')]);
set('food-supper', 'supper left out', { family: 'food', role: 'lived-in', anchor: 'table', of: 'table', traits: { food: 0.7, messy: 1 }, rooms: ['home', 'kitchen'], decor: ['d2', 'd3'], basis: 'dishes on tables: stews, skewers, pies rest on the anchor in 4 to 7 rooms each' }, [
  pc('SerpentStew', -0.5, 0.25, 0, 'anchor', { key: true }), pc('WolfMeatSkewer', 0.2, 0.3, 70, 'anchor'), pc('MeadTasty', 0.7, 0.15, 0, 'anchor'), pc('itemstandh', -0.1, -0.3, 0, 'anchor', { want: 'food' }), pc('piece_chair', 0.3, 0.95, 195, 'floor')]);
set('food-teatable', 'small sweets on the round table', { family: 'food', role: 'lived-in', anchor: 'table', of: 'round', traits: { comfort: 0.8, food: 0.6 }, rooms: ['home', 'tavern', 'sleeping'], decor: ['d2', 'd3'], basis: 'horizontal stands and sweets on round tables: 9 and more rooms each (data/interior.json pairs)' }, [
  pc('Eyescream', -0.35, 0.2, 0, 'anchor', { key: true }), pc('SpicyMarmalade', 0.3, 0.3, 0, 'anchor'), pc('Candle_resin', 0, -0.35, 0, 'anchor'), pc('ShocklateSmoothie', 0.45, -0.2, 0, 'anchor')]);
set('food-butcher', 'meat hung over the block', { family: 'food', role: 'wall', anchor: 'wall', traits: { food: 0.9, busy: 0.6 }, rooms: ['kitchen', 'tavern'], decor: ['d2', 'd3'], basis: 'butcher table 141 builds; rolling pins 61 (57 on a wall)' }, [
  pc('cauldron_ext3_butchertable', 0, 0, 0, 'floor', { back: true, key: true }), pc('cauldron_ext6_rollingpins', 1.0, 0, 0, 'wall', { y: 1.0 }), pc('CookedMeat', -0.2, 0.05, 80, 0), pc('Sausages', 0.25, 0.05, 0, 0)]);
set('food-bakery', 'oven and prep table', { family: 'food', role: 'furniture', anchor: 'corner', angle: 90, traits: { food: 1 }, rooms: ['kitchen', 'tavern'], decor: ['d3'], basis: 'stone oven 57 builds; prep table 41' }, [
  pc('piece_oven', 1.6, 1.15, 0, 'floor', { key: true }), pc('piece_preptable', 4.5, 0, 0, 'floor', { back: true }), pc('Bread', 4.3, 0.3, 90, 1), pc('cauldron_ext1_spice', 4.5, 0, 0, 'wall', { y: 0.85 })]);
set('food-honey', 'honey and berries by the window', { family: 'food', role: 'window', anchor: 'window', traits: { food: 0.8, plants: 0.6 }, rooms: ['home', 'kitchen'], decor: ['d2', 'd3'], basis: 'honey, berries and jars on barrels and the floor: 3 to 13 times each' }, [
  pc('piece_chest_barrel', -0.45, 0, 0, 'floor', { back: true, key: true }), pc('Honey', -0.45, 0, 20, 0), pc('Raspberry', 0.15, 0.35, 0, 'floor'), pc('piece_pot3', 0.5, 0, 0, 'floor', { back: true })]);

// 6. Light set on things: a lantern on a crate or a stool, a lamp on a table, a hooded lantern on a ledge.
set('light-stoollamp', 'lamp on a stool', { family: 'light', role: 'lived-in', anchor: 'bed', of: 'bed', traits: { comfort: 0.7 }, rooms: ['sleeping', 'home'], decor: ['d2', 'd3'], basis: 'standing Dvergr lanterns on another piece 11 times; Dvergr stools 51 on the floor' }, [
  pc('dvergrprops_stool', 1.15, -1.0, 0, 'floor', { key: true }), pc('dvergrprops_lantern_standing', 1.15, -1.0, 0, 0)]);
set('light-lavatable', 'lava lantern on the table', { family: 'light', role: 'decor', anchor: 'table', of: 'table', traits: { comfort: 0.6, wealth: 0.4 }, rooms: ['home', 'tavern', 'hall'], decor: ['d2', 'd3'], basis: 'lava lanterns: 97 builds, 61 on a table' }, [
  pc('piece_Lavalantern', 0.6, 0, 0, 'anchor', { key: true }), pc('itemstandh', -0.4, 0.2, 0, 'anchor', { want: 'drink' }), pc('itemstandh', -0.1, -0.25, 0, 'anchor', { want: 'drink' })]);
set('light-hooded', 'hooded lantern on a ledge', { family: 'light', role: 'wall', anchor: 'wall', traits: { comfort: 0.5, tidy: 0.5 }, rooms: ['home', 'sleeping', 'hall', 'tavern'], decor: ['d2', 'd3'], basis: 'hooded lantern on a piece and on a wall (2 builds); ledges 60 on walls' }, [
  pc('wood_ledge', 0, 0, 0, 'wall', { y: 1.5, key: true }), pc('piece_hoodedlantern', 0.2, 0.3, 0, 0), pc('MeadTasty', -0.25, 0.3, 0, 0)]);
set('light-greentorches', 'green torches by a seat', { family: 'light', role: 'decor', anchor: 'wall', traits: { wealth: 0.6, collect: 0.4 }, rooms: ['hall', 'temple'], decor: ['d3'], basis: 'green standing torches: 17 builds, 42 on the floor' }, [
  pc('piece_groundtorch_green', -1.45, 0.3, 0, 'floor', { key: true }), pc('piece_groundtorch_green', 1.45, 0.3, 0, 'floor'), pc('piece_blackwood_bench01', 0, 0, 0, 'floor', { back: true })]);
set('light-mist', 'mist torches on crates', { family: 'light', role: 'decor', anchor: 'corner', angle: 90, traits: { busy: 0.4 }, rooms: ['storage', 'workshop', 'hall'], decor: ['d3'], basis: 'mist torches: 68 times on another piece (41 builds)' }, [
  pc('dvergrprops_crate', 0.6, 0.6, 0, 'floor', { key: true }), pc('piece_groundtorch_mist', 0.6, 0.6, 0, 0), pc('dvergrprops_crate_long', 2.2, 0.45, 0, 'floor')]);
set('light-candles-chest', 'candles on a bedfoot chest', { family: 'light', role: 'lived-in', anchor: 'bed', of: 'bed', traits: { comfort: 1 }, rooms: ['sleeping', 'home'], decor: ['d2', 'd3'], basis: 'candles rest on another piece 106 times, on a table 112' }, [
  pc('piece_chest_wood', 0, 2.0, 180, 'floor', { key: true }), pc('Candle_resin', -0.5, 2.0, 0, 0), pc('Candle_resin', -0.2, 2.1, 0, 0), pc('rug_hare', 0.35, 2.0, 0, 0)]);

// 7. Beds: what ends up by them in a lived-in room. A folded pelt on the chest at the foot (hare rugs on another piece
// 39 times), clothes on a chair, armor by the bed.
set('bed-pelt', 'folded pelt on the bedfoot chest', { family: 'bed', role: 'furniture', anchor: 'bed', of: 'bed', traits: { comfort: 0.8, tidy: 0.5 }, rooms: ['sleeping', 'home'], decor: ['d1', 'd2', 'd3'], basis: 'chest at the foot of the bed (data/interior.json); hare rugs on another piece 39 times' }, [
  pc('piece_chest_wood', 0, 2.05, 180, 'floor', { key: true }), pc('rug_hare', 0, 2.05, 90, 0)]);
set('bed-chair', 'clothes on a chair by the bed', { family: 'bed', role: 'lived-in', anchor: 'bed', of: 'bed', traits: { messy: 1 }, rooms: ['sleeping', 'home'], decor: ['d2', 'd3'], basis: 'a horizontal stand on a chair seat: 28 and 21 rooms (data/interior.json pairs)' }, [
  pc('piece_chair03', 1.2, -0.75, 250, 'floor', { key: true }), pc('itemstandh', 1.2, -0.75, 0, 0, { want: 'small' }), pc('rug_hare', 1.3, 0.6, 0, 'floor')]);
set('bed-armor', 'armor by the bed', { family: 'bed', role: 'lived-in', anchor: 'bed', of: 'bed', traits: { collect: 0.6, tidy: 0.6 }, rooms: ['sleeping', 'home'], decor: ['d2', 'd3'], basis: 'armor stands 168 builds; chests at the foot' }, [
  pc('ArmorStand', 1.15, -0.85, 270, 'floor', { key: true }), pc('piece_chest', 0, 2.1, 180, 'floor')]);
set('bed-crates', 'crate as nightstand', { family: 'bed', role: 'furniture', anchor: 'bed', of: 'bed', traits: { modest: 0.8, messy: 0.4 }, rooms: ['sleeping', 'home'], decor: ['d1', 'd2', 'd3'], basis: 'crates rest by and under other pieces 43 times' }, [
  pc('dvergrprops_crate', 1.3, -0.95, 8, 'floor', { key: true }), pc('Candle_resin', 1.15, -1.05, 0, 0), pc('itemstandh', 1.45, -0.85, 0, 0, { want: 'drink' })]);
set('bed-wardrobe', 'wardrobe at the bed head', { family: 'bed', role: 'furniture', anchor: 'bed', of: 'bed', traits: { tidy: 0.8, wealth: 0.4 }, rooms: ['sleeping', 'home'], decor: ['d2', 'd3'], basis: 'wardrobes (6 builds) stand by beds' }, [
  pc('piece_chest_warderobe', 1.5, -1.0, 0, 'floor', { key: true }), pc('rug_hare', -1.25, 0.4, 0, 'floor')]);
set('bed2-pelt', 'pelts by the dragon bed', { family: 'bed', role: 'furniture', anchor: 'bed', of: 'bed2', traits: { comfort: 1, wealth: 0.5 }, rooms: ['sleeping', 'home'], decor: ['d2', 'd3'], basis: 'rugs beside a dragon bed 2 m out (docs/INTERIOR_DESIGN.md)' }, [
  pc('piece_chest_blackmetal', 0, 2.55, 180, 'floor', { key: true }), pc('rug_wolf', -2.3, 0.3, 0, 'floor'), pc('Candle_resin', 0.6, 2.55, 0, 0)]);

// 8. Rugs layered and pelts laid on things.
set('rug-layer-hearth', 'rugs layered by the fire', { family: 'rugs', role: 'floor', anchor: 'hearth', traits: { comfort: 1 }, rooms: ['home', 'hall', 'tavern'], decor: ['d2', 'd3'], basis: 'rugs 2.5 m out from the fire (docs/INTERIOR_DESIGN.md); hare rugs on other rugs and pieces 39 times' }, [
  pc('rug_fur', 0, 2.7, 0, 'floor', { key: true }), pc('rug_hare', 0.5, 2.6, 70, 'floor'), pc('piece_chair02', -0.9, 3.0, 180, 'floor'), pc('itemstandh', -0.25, 3.2, 0, 'floor', { want: 'drink' })]);
set('rug-layer-pit', 'pelts round the fire pit', { family: 'rugs', role: 'floor', anchor: 'hearth', of: 'pit', traits: { comfort: 0.8, modest: 0.5 }, rooms: ['home', 'sleeping'], decor: ['d2', 'd3'], basis: 'rugs round fires; straw and deer rugs on the floor 84 and 542 times' }, [
  pc('rug_straw', 0, 1.9, 0, 'floor', { key: true }), pc('rug_deer', 1.1, 2.3, 35, 'floor'), pc('dvergrprops_stool', -0.6, 2.0, 180, 'floor')]);
set('rug-asksvin', 'asksvin hide and a low seat', { family: 'rugs', role: 'floor', anchor: 'wall', traits: { comfort: 0.8, collect: 0.5 }, rooms: ['home', 'hall', 'sleeping'], decor: ['d3'], basis: 'asksvin rugs: 19 builds, 57 on the floor' }, [
  pc('rug_asksvin', 0, 1.7, 0, 'floor', { key: true }), pc('piece_logbench01', 0, 0, 0, 'floor', { back: true }), pc('Candle_resin', 1.45, 0.3, 0, 'floor')]);
set('rug-bench-cushion', 'pelt on a bench', { family: 'rugs', role: 'lived-in', anchor: 'wall', traits: { comfort: 1 }, rooms: ['home', 'tavern', 'hall', 'sleeping'], decor: ['d2', 'd3'], basis: 'rugs rest on other pieces: hare 39, deer 37, fur 21' }, [
  pc('piece_logbench01', 0, 0, 0, 'floor', { back: true, key: true }), pc('rug_hare', 0.3, 0, 90, 0), pc('piece_chest_barrel', 1.6, 0, 0, 'floor', { back: true })]);

// 9. Window dressing: pots and herbs under the sill, a seat in the light.
set('win-pots', 'pots and ferns under the window', { family: 'window', role: 'window', anchor: 'window', traits: { plants: 1 }, rooms: ['home', 'sleeping', 'kitchen'], decor: ['d2', 'd3'], basis: 'pots on the floor by walls; ferns 5 builds' }, [
  pc('piece_pot1', -0.55, 0, 15, 'floor', { back: true, key: true }), pc('piece_pot3', 0.35, 0, 60, 'floor', { back: true }), pc('Fiddleheadfern', 0.35, 0, 0, 1), pc('piece_pot1', 1.15, 0.55, 0, 'floor')]);
set('win-seat', 'window seat with a pelt', { family: 'window', role: 'window', anchor: 'window', traits: { comfort: 0.9 }, rooms: ['home', 'sleeping', 'hall'], decor: ['d2', 'd3'], basis: 'benches under windows (BK-drapes); hare rugs on benches' }, [
  pc('piece_bench_runed', 0, 0, 0, 'floor', { back: true, key: true }), pc('rug_hare', -0.4, 0, 90, 0), pc('Candle_resin', 0.6, 0.0, 0, 0)]);
set('win-desk', 'writing place at the window', { family: 'window', role: 'window', anchor: 'window', traits: { maps: 0.9, tidy: 0.6 }, rooms: ['home', 'sleeping', 'hall'], decor: ['d2', 'd3'], basis: 'small rune table (25 builds) and stools by windows' }, [
  pc('piece_magetable_ext2', 0, 0, 0, 'floor', { back: true, key: true }), pc('dvergrprops_stool', 0, 0.95, 0, 'floor'), pc('Candle_resin', 0, 0.3, 0, 0)]);
set('win-crates', 'crates under the window', { family: 'window', role: 'window', anchor: 'window', traits: { messy: 0.7, busy: 0.6 }, rooms: ['storage', 'workshop', 'home'], decor: ['d2', 'd3'], basis: 'Dvergr crates by walls (9) and on each other (17)' }, [
  pc('dvergrprops_crate_long', 0, 0, 0, 'floor', { back: true, key: true }), pc('piece_pot1', 0.6, 0, 0, 0, { back: true }), pc('dvergrprops_crate', -1.7, 0, 350, 'floor', { back: true })]);

// 10. Wall objects: a notice board, the kitchen wall, a lantern and sign by the door side.
set('wall-notice', 'notice board', { family: 'wall', role: 'wall', anchor: 'wall', traits: { tidy: 0.8, maps: 0.4 }, rooms: ['hall', 'tavern', 'storage'], decor: ['d2', 'd3'], basis: 'signs stacked on walls (595 rooms, data/interior.json pairs) and beside stands' }, [
  pc('sign', -0.55, 0, 0, 'wall', { y: 1.65, key: true }), pc('sign_notext', 0.55, 0, 0, 'wall', { y: 1.65 }), pc('sign', 0, 0, 0, 'wall', { y: 1.05 }), pc('piece_bench01', 0, 0, 0, 'floor', { back: true })]);
set('wall-spice', 'spice rack and pots over the counter', { family: 'wall', role: 'wall', anchor: 'wall', traits: { food: 1, tidy: 0.5 }, rooms: ['kitchen', 'tavern'], decor: ['d2', 'd3'], basis: 'spice rack 116 builds (101 on a wall), hanging pots 142 (140 on a wall), prep table 41' }, [
  pc('piece_preptable', 0, 0, 0, 'floor', { back: true, key: true }), pc('cauldron_ext1_spice', -0.45, 0, 0, 'wall', { y: 1.05 }), pc('cauldron_ext6_rollingpins', 1.75, 0, 0, 'wall', { y: 1.05 })]);
set('wall-lantern', 'Dvergr lantern over a chest', { family: 'wall', role: 'wall', anchor: 'wall', traits: { wealth: 0.5 }, rooms: ['hall', 'home', 'storage'], decor: ['d3'], basis: 'Dvergr wall lanterns: 107 builds, 395 on walls' }, [
  pc('piece_dvergr_lantern', 0, 0, 90, 'wall', { y: 2.2, key: true }), pc('piece_chest', 0, 0, 0, 'floor', { back: true })]);
set('wall-gift', 'jarl seat between torches', { family: 'wall', role: 'decor', anchor: 'wall', traits: { wealth: 0.6, comfort: 0.4 }, rooms: ['hall'], decor: ['d3'], basis: 'thrones 103 builds; ceiling braziers 9' }, [
  pc('piece_throne01', 0, 0, 0, 'floor', { back: true, key: true }), pc('rug_wolf', 0, 1.5, 90, 'floor'), pc('piece_groundtorch', -1.2, 0.3, 0, 'floor'), pc('piece_groundtorch', 1.2, 0.3, 0, 'floor')]);

// 11. Floor objects and clutter: things left in use.
set('floor-dice', 'dice on a crate', { family: 'floor', role: 'floor', anchor: 'floor', traits: { games: 1, messy: 0.5 }, rooms: ['tavern', 'hall', 'home'], decor: ['d2', 'd3'], basis: 'Dvergr stools (51 on the floor) round crates; horizontal stands on crates' }, [
  pc('dvergrprops_crate', 0, 0, 10, 'floor', { key: true }), pc('itemstandh', -0.15, 0.1, 0, 0, { want: 'small' }), pc('itemstandh', 0.2, -0.15, 0, 0, { want: 'drink' }), pc('dvergrprops_stool', -0.95, 0.1, 90, 'floor'), pc('dvergrprops_stool', 0.95, -0.15, 270, 'floor')]);
set('floor-mending', 'mending by a stool', { family: 'floor', role: 'lived-in', anchor: 'floor', traits: { crafts: 0.8, messy: 0.7 }, rooms: ['home', 'workshop', 'sleeping'], decor: ['d3'], basis: 'stools, barrels and pelts left on the floor' }, [
  pc('dvergrprops_stool', 0, 0, 0, 'floor', { key: true }), pc('piece_chest_barrel', 0.7, 0.3, 15, 'floor'), pc('rug_hare', 0.75, 0.3, 80, 1), pc('piece_pot3', -0.7, 0.2, 0, 'floor')]);
set('floor-bath', 'tub with stools and a lamp', { family: 'floor', role: 'furniture', anchor: 'corner', angle: 90, traits: { comfort: 1, wealth: 0.6 }, rooms: ['home', 'sleeping'], decor: ['d3'], basis: 'bathtubs 8 builds' }, [
  pc('piece_bathtub', 1.8, 2.3, 0, 'floor', { key: true }), pc('dvergrprops_stool', 3.75, 0.5, 0, 'floor'), pc('dvergrprops_lantern_standing', 3.75, 0.5, 0, 0)]);

// 12. Light on posts and candle stands: a short post with a candle on its top, a lantern on a tall post (posts carry
// decor in 31 and 14 builds; ashwood and dark wood posts 6 each).
set('post-candle', 'candle on a post', { family: 'light', role: 'floor', anchor: 'corner', angle: 90, traits: { comfort: 0.7, modest: 0.4 }, rooms: ['home', 'sleeping', 'temple', 'hall'], decor: ['d2', 'd3'], basis: 'short posts with something on top: 8 of 108 rest on another piece; candles on pieces 106' }, [
  pc('wood_pole', 0.45, 0.45, 0, 'floor', { key: true }), pc('Candle_resin', 0.45, 0.45, 0, 0), pc('piece_pot3', 1.35, 0.45, 20, 'floor')]);
set('post-lantern', 'lantern on a tall post', { family: 'light', role: 'floor', anchor: 'corner', angle: 90, traits: { comfort: 0.5, wealth: 0.4 }, rooms: ['hall', 'tavern', 'home', 'workshop'], decor: ['d3'], basis: 'standing Dvergr lanterns on other pieces 11 times; dark wood and ashwood posts in 6 builds each' }, [
  pc('darkwood_pole', 0.45, 0.45, 0, 'floor', { key: true }), pc('dvergrprops_lantern_standing', 0.45, 0.45, 0, 0), pc('piece_chest_barrel', 1.35, 0.45, 0, 'floor')]);
set('post-lantern-ash', 'lantern post by a bench', { family: 'light', role: 'floor', anchor: 'wall', traits: { comfort: 0.6 }, rooms: ['hall', 'tavern', 'temple'], decor: ['d3'], basis: 'ashwood posts: 11 on the floor in 6 builds; lanterns on pieces 11' }, [
  pc('ashwood_pole_2m', -1.5, 0.3, 0, 'floor', { key: true }), pc('dvergrprops_lantern_standing', -1.5, 0.3, 0, 0), pc('piece_bench01', 0.15, 0, 0, 'floor', { back: true })]);
set('post-rail', 'iron-bound rail over barrels', { family: 'built', role: 'furniture', anchor: 'wall', traits: { tidy: 0.6, busy: 0.4 }, rooms: ['storage', 'tavern', 'smithy'], decor: ['d3'], basis: 'iron-bound beams: 14 on walls in 8 builds; posts as frames' }, [
  pc('wood_pole2', -1.0, 0.3, 0, 'floor', { key: true }), pc('wood_pole2', 1.0, 0.3, 0, 'floor'), pc('woodiron_beam', 0, 0.3, 0, 0), pc('piece_chest_barrel', -0.4, 0, 0, 'floor', { back: true }), pc('piece_chest_barrel', 0.45, 0, 0, 'floor', { back: true }), pc('itemstand', 0, 0, 0, 'wall', { y: 1.5, want: 'tool' })]);

// 13. More food and drink: a potion shelf, the harvest brought in, feasts on round and long tables. (Every feast
// prefab rests on its table in the corpus; the village's own feast is set out, so these differ by what goes round it.)
set('food-potions', 'potion shelf', { family: 'food', role: 'wall', anchor: 'wall', traits: { food: 0.6, collect: 0.6, tidy: 0.5 }, rooms: ['home', 'kitchen', 'storage', 'hall'], decor: ['d3'], basis: 'meads on floors, tables and shelves: frost, poison, eitr, strength, health and stamina meads in 7 to 17 builds each' }, [
  pc('wood_ledge', -0.5, 0, 0, 'wall', { y: 1.45, key: true }), pc('wood_ledge', 0.5, 0, 0, 'wall', { y: 1.45 }),
  pc('MeadFrostResist', -0.8, 0.3, 0, 0), pc('MeadPoisonResist', -0.5, 0.3, 0, 0), pc('MeadEitrMinor', -0.2, 0.3, 0, 0), pc('MeadStrength', 0.25, 0.3, 0, 1), pc('MeadHealthMedium', 0.55, 0.3, 0, 1), pc('MeadStaminaMinor', 0.85, 0.3, 0, 1),
  pc('piece_chest_barrel', 0, 0, 0, 'floor', { back: true })]);
set('food-harvest', 'the harvest brought in', { family: 'food', role: 'clutter', anchor: 'wall', traits: { food: 0.8, plants: 0.6, busy: 0.5 }, rooms: ['kitchen', 'storage', 'home', 'barn'], decor: ['d2', 'd3'], basis: 'onions, carrots and berries on the floor and on other pieces (4 builds each)' }, [
  pc('dvergrprops_crate_long', 0, 0, 0, 'floor', { back: true, key: true }), pc('Onion', -0.55, 0.3, 30, 0), pc('Carrot', -0.05, 0.3, 80, 0), pc('Cloudberry', 0.5, 0.3, 0, 0), pc('piece_pot3', 1.45, 0.4, 0, 'floor')]);
set('food-feast-round', 'feast for two at the round table', { family: 'food', role: 'lived-in', anchor: 'table', of: 'round', traits: { food: 0.9, comfort: 0.6 }, rooms: ['home', 'tavern', 'hall'], decor: ['d3'], basis: 'Black Forest and Mistlands feasts on tables: 15 and 14 times on the anchor' }, [
  pc('FeastBlackforest', 0, 0, 0, 'anchor', { key: true }), pc('MeadSwimmer', -0.55, 0.45, 0, 'anchor'), pc('MeadTamer', 0.6, -0.4, 0, 'anchor'), pc('Candle_resin', 0.6, 0.45, 0, 'anchor')]);
set('food-feast-long', 'hall table laid for many', { family: 'food', role: 'lived-in', anchor: 'table', of: 'long', traits: { food: 1, wealth: 0.6 }, rooms: ['hall', 'tavern'], decor: ['d3'], basis: 'Plains, Ocean and Mountain feasts and big dishes on long tables (4 to 15 rooms each)' }, [
  pc('FeastPlains', -1.4, 0, 0, 'anchor', { key: true }), pc('FeastOceans', 1.4, 0, 0, 'anchor'), pc('HoneyGlazedChicken', 0, 0.1, 0, 'anchor'), pc('PiquantPie', -2.6, -0.2, 0, 'anchor'), pc('MashedMeat', 2.6, 0.2, 0, 'anchor'), pc('Candle_resin', 0, -0.45, 0, 'anchor'), pc('MisthareSupreme', 0.0, 0.5, 0, 'anchor')]);
set('food-feast-table', 'a feast and its sides', { family: 'food', role: 'lived-in', anchor: 'table', of: 'table', traits: { food: 0.9 }, rooms: ['home', 'kitchen', 'tavern', 'hall'], decor: ['d3'], basis: 'Swamp, Mountain and Ashlands feasts on tables (9 to 13 times on the anchor); side dishes 4 to 6' }, [
  pc('FeastSwamps', 0, 0, 0, 'anchor', { key: true }), pc('MarinatedGreens', -0.9, 0.25, 0, 'anchor'), pc('ScorchingMedley', 0.9, -0.25, 0, 'anchor'), pc('SparklingShroomshake', 0.95, 0.35, 0, 'anchor'), pc('SizzlingBerryBroth', -0.9, -0.3, 0, 'anchor')]);
set('food-feast-mountain', 'the end of a feast', { family: 'food', role: 'lived-in', anchor: 'table', of: 'table', traits: { food: 0.7, messy: 0.8 }, rooms: ['home', 'tavern', 'hall'], decor: ['d3'], basis: 'Mountain and Ashlands feasts on tables; meads left on them (troll pheromones, health)' }, [
  pc('FeastMountains', -0.4, 0.05, 20, 'anchor', { key: true }), pc('FeastAshlands', 0.75, -0.1, 0, 'anchor'), pc('MeadTrollPheromones', -1.0, 0.35, 0, 'anchor'), pc('MeadHealthMinor', 0.2, 0.42, 0, 'anchor'), pc('piece_chair', 0.9, 0.95, 160, 'floor')]);
set('food-feast-mist', 'a feast at the round table', { family: 'food', role: 'lived-in', anchor: 'table', of: 'round', traits: { food: 0.8, wealth: 0.5 }, rooms: ['hall', 'tavern', 'home'], decor: ['d3'], basis: 'Mistlands feast on tables 14 times' }, [
  pc('FeastMistlands', 0, 0, 0, 'anchor', { key: true }), pc('Candle_resin', -0.55, -0.45, 0, 'anchor'), pc('Candle_resin', 0.55, 0.45, 0, 'anchor'), pc('MeadHealthMedium', 0.6, -0.4, 0, 'anchor')]);

// 14. Old and big storage: the old barrels, a Dvergr barrel in the corner.
set('store-oldbarrels', 'old barrels and a cracked jar', { family: 'storage', role: 'clutter', anchor: 'corner', angle: 90, traits: { messy: 0.8, modest: 0.6 }, rooms: ['storage', 'barn', 'workshop'], decor: ['d2', 'd3'], basis: 'the old barrel prop: 3 builds; cracked pots 2' }, [
  pc('barrell', 0.5, 0.5, 30, 'floor', { key: true }), pc('barrell', 1.6, 0.45, 75, 'floor'), pc('piece_pot2_cracked', 0.45, 1.35, 0, 'floor')]);
set('store-dvergrbarrel', 'Dvergr barrel in the corner', { family: 'storage', role: 'furniture', anchor: 'corner', angle: 90, traits: { food: 0.5, busy: 0.4 }, rooms: ['storage', 'tavern', 'kitchen'], decor: ['d3'], basis: 'Dvergr barrels: 3 builds, on the floor and against a wall' }, [
  pc('dvergrprops_barrel', 0.8, 1.05, 0, 'floor', { key: true }), pc('dvergrprops_crate', 2.2, 0.55, 12, 'floor'), pc('itemstandh', 2.2, 0.55, 0, 1, { want: 'drink' })]);

set('built-shortshelf', 'short shelves of a candle and a cup', { family: 'built', role: 'wall', anchor: 'wall', traits: { tidy: 0.5, comfort: 0.5 }, rooms: ['home', 'sleeping', 'kitchen'], decor: ['d2', 'd3'], basis: 'short ashwood and wood beams on walls: 37 and 146 times' }, [
  pc('ashwood_beam_1m', -0.6, 0, 0, 'wall', { y: 1.35 }), pc('wood_beam_1', 0.6, 0, 0, 'wall', { y: 1.7, key: true }), pc('Candle_resin', -0.6, 0.2, 0, 0), pc('itemstandh', 0.6, 0.2, 0, 1, { want: 'drink' }), pc('piece_chair', 0, 0.45, 0, 'floor')]);

// ---------------------------------------------------------------- settling and measuring
const ANCHOR_PIECE = { table: 'piece_table', round: 'piece_table_round', long: 'piece_table_oak', bed: 'bed', bed2: 'piece_bed02', hearth: 'hearth', pit: 'fire_pit', workbench: 'piece_workbench', forge: 'forge' };
const slab = (c, h) => [{ c, a: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], h, x0: c[0] - h[0], x1: c[0] + h[0], y0: c[1] - h[1], y1: c[1] + h[1], z0: c[2] - h[2], z1: c[2] + h[2] }];
const boxOf = p => Ck.aabbShapes(p);
const r3 = v => +v.toFixed(3);

function build(s) {
  const corner = s.anchor === 'corner';
  // the walls behind the set, 0.3 m thick, in the frame the set is written in
  const walls = ['wall', 'window'].includes(s.anchor) ? [slab([0, 1.5, -0.15], [20, 1.5, 0.15])]
    : corner ? [slab([10, 1.5, -0.15], [10.3, 1.5, 0.15]), slab([-0.15, 1.5, 10], [0.15, 1.5, 10.3])] : [];
  const akey = s.of || ({ table: 'table', bed: 'bed', hearth: 'hearth', workbench: 'workbench', forge: 'forge' })[s.anchor];
  let anc = null;
  if (akey && ANCHOR_PIECE[akey]) {
    anc = { name: ANCHOR_PIECE[akey], x: 0, y: 0, z: 0, yaw: 0 };
    anc.y = -boxOf(anc).y0;
    if (s.anchor === 'hearth') { const b = boxOf(anc); anc.x = -(b.x0 + b.x1) / 2; anc.z = -(b.z0 + b.z1) / 2; }
  }
  const made = [];
  for (const [i, m] of s.pieces.entries()) {
    // (sets are written with each piece's back on -z; the wardrobe's back is +z: catalog, and 59 % of 109 corpus wardrobes
    // with a wall within 1.2 m have it on their +z side; its depth is centered on its pivot, so the turn keeps its place)
    const p = { name: m.n, x: m.x, y: 0, z: m.z, yaw: (m.yaw + (BACK_TURN[m.n] || 0)) % 360 };
    // against a wall: back on the wall's face (2 cm off for what stands on the floor)
    if (m.rest === 'wall' || m.back) {
      const b = boxOf(p), gap = m.rest === 'wall' ? 0 : 0.02;
      const toB = corner && Math.abs(m.x) < Math.abs(m.z); // the second wall of a corner runs along z at x = 0
      if (toB) p.x = r3(p.x - b.x0 + gap); else p.z = r3(p.z - b.z0 + gap);
    }
    const b0 = boxOf(p), y0 = b0.y0 - p.y, cx = (b0.x0 + b0.x1) / 2, cz = (b0.z0 + b0.z1) / 2;
    if (m.rest === 'floor') p.y = b0.pass ? 0.02 : -y0 - (m.sink || 0);
    else if (m.rest === 'wall') p.y = m.y;
    else {
      const under = m.rest === 'anchor' ? anc : made[m.rest];
      if (!under) throw new Error(`${s.key}: piece ${i} rests on nothing`);
      const W = SH.world(under);
      const top = SH.lidAt(under, cx, cz) ?? (W && W.length && SH.topAt(W, cx, cz)) ?? boxOf(under).y1;
      p.y = top - y0;
    }
    p.y = r3(p.y);
    made.push(p);
  }
  // clips: piece into piece, into the wall, into the anchor (2 cm over what is measured, as the fitter rounds). What
  // stands or hangs against a wall may also go into it as deep as builders set that prefab into walls (the decor table's
  // median, at least 3 and at most 8 cm, so the pool audit's 15 cm into what shows of a wall is never reached): a real
  // wall's posts and bars stand proud of its face line. What hangs on a wall gets none (the audit allows it 1.5 cm)
  const clips = [];
  const sol = made.map(p => boxOf(p).sol);
  for (let u = 0; u < made.length; u++) {
    for (let v = u + 1; v < made.length; v++) { const d = SH.clipDepth(sol[u], sol[v]); if (d > 0.005) clips.push([u, v, r3(d + 0.02)]); }
    let dw = 0;
    for (const w of walls) dw = Math.max(dw, SH.clipDepth(sol[u], w));
    const m = s.pieces[u];
    if (m.back) dw = Math.max(dw, Math.min(0.08, Math.max(0.03, DECOR_CLIP.get(m.n) || 0)) - 0.02);
    if (dw > 0.005) clips.push([u, 'w', r3(dw + 0.02)]);
    if (anc) { const d = SH.clipDepth(sol[u], boxOf(anc).sol); if (d > 0.005) clips.push([u, 'a', r3(d + 0.02)]); }
  }
  // into the fitter's frame: a corner turns 45 degrees so +z runs along the bisector (lab/mine_kitbash.js)
  const a = corner ? Math.PI / 4 : 0, c = Math.cos(a), sn = Math.sin(a);
  const pieces = made.map((p, i) => {
    const m = s.pieces[i], o = { n: p.name, k: kOf(p.name, m.rest), x: r3(p.x * c - p.z * sn), y: p.y, z: r3(p.x * sn + p.z * c), yaw: Math.round(((p.yaw - (corner ? 45 : 0)) % 360 + 360) % 360), rest: m.rest === 'floor' || m.rest === 'wall' || m.rest === 'anchor' ? m.rest : 'on' };
    if (o.rest === 'on') o.on = m.rest;
    if (m.sink) o.sink = m.sink;
    if (m.key) o.key = true;
    if (m.want) o.want = m.want;
    return o;
  });
  // footprint and height in the fitter's frame
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, top = 0;
  for (const q of pieces) {
    const b = boxOf({ name: q.n, x: q.x, y: q.y, z: q.z, yaw: q.yaw });
    x0 = Math.min(x0, b.x0); x1 = Math.max(x1, b.x1); z0 = Math.min(z0, b.z0); z1 = Math.max(z1, b.z1); top = Math.max(top, b.y1);
  }
  const fb = n => ((BUILT_K[n] && P.needs(n) === 'Meadows') || n === 'wood_pole' || P.minor(n) ? 0 : Math.max(0, P.BIOME_ORDER.indexOf(P.needs(n))));
  const biome = P.BIOME_ORDER[Math.max(...pieces.map(q => fb(q.n)))];
  // the earliest biome whose village makes the building pieces that keep their own prefab (decor goes in any biome,
  // Tyler 2026-11-10; the fitter leaves out a building piece the village does not make)
  const from = P.BIOME_ORDER[Math.max(0, ...pieces.filter(q => P.piece(q.n).structural && q.k === q.n).map(q => fb(q.n)))];
  const deepest = clips.reduce((m, cl) => Math.max(m, cl[2]), 0);
  return { pieces, clips, foot: [r3(x1 - x0), r3(z1 - z0)], h: r3(top), biome, from, maxClip: r3(deepest) };
}

// ---------------------------------------------------------------- mined objects (data/creative-mined.json)
// The objects lab/mine_creative.js found in the corpus and picked by hand, each kept as built: exact prefabs, offsets,
// turns, rests and the clips the source build has. A group the miner put on the free floor whose biggest piece is
// storage, a table or a station stood against something in its build: it goes against a wall, its back 2 cm off it.
const WORD = [[/chest_blackmetal/, 'black metal chest'], [/chest_wood$/, 'chest'], [/piece_chest$/, 'iron chest'], [/chest_barrel|barrell/, 'barrel'], [/warderobe/, 'wardrobe'],
  [/crate/, 'crate'], [/workbench_ext4/, 'tool rack'], [/workbench/, 'workbench'], [/chair|stool/, 'chair'], [/bench/, 'bench'], [/throne/, 'throne'], [/groundtorch|walltorch/, 'torch'], [/lantern|Lavalantern/, 'lantern'], [/Candle/, 'candles'],
  [/blackforge|forge/, 'smithing tools'], [/magetable/, 'galdr table'], [/artisan/, 'artisan press'], [/spinning/, 'spinning wheel'],
  [/cartography/, 'map table'], [/stonecutter/, 'stonecutter'], [/mortar/, 'mortar and pestle'], [/cauldron_ext3/, 'butcher table'], [/cauldron_ext4/, 'hanging pots'],
  [/cauldron_ext1/, 'spice rack'], [/rollingpins/, 'rolling pins'], [/MeadCauldron|fermenter/, 'brewing'], [/cauldron|cookingstation/, 'cooking'], [/oven/, 'oven'], [/preptable/, 'prep table'],
  [/^Feast/, 'feast'], [/^(Mead|BarleyWine)/, 'drinks'], [/itemstandh/, 'cups'], [/itemstand/, 'item stands'], [/sign/, 'signs'], [/ArmorStand/, 'armor'], [/blackmarble_head/, 'marble head'],
  [/pot\d/, 'pots'], [/bathtub/, 'bathtub'], [/dvergrprops_shelf/, 'Dvergr shelf'], [/dvergrprops_barrel/, 'Dvergr barrel'], [/bed/, 'bed'], [/table/, 'table'],
  [/wall_half/, 'half walls'], [/wall_quarter/, 'quarter walls'], [/stone_wall|crystal_wall|stone_arch|stone_fence/, 'stone'], [/roof/, 'roof pieces'],
  [/beam/, 'beams'], [/pole|log/, 'posts']];
const wordOf = n => (WORD.find(([re]) => re.test(n)) || [null, null])[1];
const STORE = /chest|barrel|crate|warderobe/, STATION = /workbench|forge|magetable|artisan|spinning|stonecutter|cartography|mortar|blackforge|cauldron|oven|preptable|fermenter/;
function minedSet(o) {
  const ms = o.m.map(([n, x, y, z, yaw, rest, on, sink], i) => ({ i, n, x, y, z, yaw, rest, on, sink }));
  // what a piece rests on comes before it
  const order = [], done = new Set();
  const visit = m => { if (done.has(m.i)) return; if (m.rest === 'on' && m.on != null) visit(ms[m.on]); done.add(m.i); order.push(m); };
  ms.forEach(visit);
  const at = new Map(order.map((m, j) => [m.i, j]));
  let anchor = o.a;
  const big = order.slice().sort((p, q) => { const bp = boxOf({ name: p.n, x: 0, y: 0, z: 0, yaw: 0 }), bq = boxOf({ name: q.n, x: 0, y: 0, z: 0, yaw: 0 }); return (bq.x1 - bq.x0) * (bq.z1 - bq.z0) - (bp.x1 - bp.x0) * (bp.z1 - bp.z0); })[0];
  let dz = 0;
  if (anchor === 'floor' && (STORE.test(big.n) || STATION.test(big.n) || /bench|table/.test(big.n))) {
    let z0 = Infinity;
    for (const m of order) { const b = boxOf({ name: m.n, x: m.x, y: m.y, z: m.z, yaw: m.yaw }); if (!b.pass) z0 = Math.min(z0, b.z0); }
    if (isFinite(z0)) { anchor = 'wall'; dz = 0.02 - z0; }
  }
  const pieces = order.map(m => {
    const p = { n: m.n, k: m.n, x: m.x, y: m.y, z: +(m.z + dz).toFixed(3), yaw: m.yaw, rest: m.rest };
    if (m.rest === 'on') p.on = at.get(m.on);
    if (m.sink) p.sink = m.sink;
    return p;
  });
  // the core: the biggest storage, station, table or seat piece, else the biggest piece
  const core = order.find(m => STORE.test(m.n) || STATION.test(m.n)) || big;
  pieces[at.get(core.i)].key = true;
  const clips = (o.c || []).map(([u, v, d]) => [at.get(u), typeof v === 'number' ? at.get(v) : v, +(d + 0.02).toFixed(3)]);
  // the same clips in what shows (cs, lab/show_clips.js), for the fitter's tests of what shows (lib/kitbash.js showOf)
  const show = o.cs ? o.cs.map(([u, v, d]) => [at.get(u), typeof v === 'number' ? at.get(v) : v, +(d + 0.02).toFixed(3)]) : null;
  const words = [...new Set(order.map(m => wordOf(m.n)).filter(Boolean))];
  const name = words.slice(0, 4).join(', ').replace(/, ([^,]+)$/, ' and $1');
  const has = re => order.some(m => re.test(m.n));
  let family = 'storage', role = 'furniture', traits = { tidy: 0.6 }, rooms = ['storage', 'home', 'workshop'];
  if (has(/^Feast|^(Mead|BarleyWine|Bread|Honey|Sausages|Marinated|Mashed|Piquant|Sparkling)|cauldron|cookingstation|oven|preptable|fermenter|MeadCauldron/)) { family = 'food'; role = anchor === 'table' ? 'lived-in' : 'furniture'; traits = { food: 1 }; rooms = ['kitchen', 'tavern', 'home', 'hall']; }
  else if (has(/workbench|forge|magetable|artisan|spinning|stonecutter|cartography|mortar|blackforge/)) { family = 'stations'; role = 'decor'; traits = has(/magetable|cartography/) ? { maps: 1 } : { crafts: 1, busy: 0.4 }; rooms = has(/forge/) ? ['smithy', 'workshop'] : ['workshop', 'home']; }
  else if (has(/ArmorStand|throne|blackmarble_head|blackmarble_bench|bone/)) { family = 'display'; role = 'decor'; traits = { collect: 0.8, wealth: 0.6 }; rooms = ['hall', 'home']; }
  else if (has(/bathtub/)) { family = 'floor'; traits = { comfort: 1, wealth: 0.5 }; rooms = ['home', 'sleeping']; }
  else if (has(/bed/)) { family = 'bed'; traits = { comfort: 0.8, wealth: 0.6 }; rooms = ['home', 'sleeping']; }
  else if (has(/groundtorch|walltorch|lantern|Lavalantern|Candle/) && !has(STORE)) { family = 'light'; role = anchor === 'floor' ? 'floor' : 'decor'; traits = { comfort: 0.6 }; rooms = ['home', 'hall', 'tavern', 'storage', 'workshop']; }
  else if (has(/pot\d/)) { family = 'window'; role = 'decor'; traits = { plants: 1 }; rooms = ['home', 'kitchen', 'sleeping']; }
  else if (has(/chair|bench|stool/) && !has(STORE)) { family = 'built'; role = has(/itemstandh|Lavalantern|Mead|Sparkling|magetable/) ? 'lived-in' : 'furniture'; traits = has(/itemstandh|Sparkling/) ? { messy: 0.6, comfort: 0.4 } : { comfort: 0.7 }; rooms = ['home', 'tavern', 'hall']; }
  else if (has(/sign/)) { family = 'storage'; traits = { tidy: 1 }; rooms = ['storage', 'workshop', 'home', 'hall']; }
  else if (has(/itemstand/) && !has(STORE)) { family = 'display'; role = 'wall'; traits = { collect: 1 }; rooms = ['home', 'hall', 'tavern']; }
  else if (has(/crate/) && !has(/chest/)) traits = { messy: 0.7, busy: 0.5 };
  else if (has(/beam|pole|wall_half|wall_quarter|log/)) { family = 'built'; traits = { tidy: 0.7 }; }
  if (o.a === 'window') role = 'window';
  const fb = n => (P.minor(n) ? 0 : Math.max(0, P.BIOME_ORDER.indexOf(P.needs(n))));
  const biome = P.BIOME_ORDER[Math.max(...pieces.map(q => fb(q.n)))];
  // the building pieces that keep their own prefab decide where it goes (decor goes in any biome, Tyler 2026-11-10)
  const from = P.BIOME_ORDER[Math.max(0, ...pieces.filter(q => P.piece(q.n).structural && q.k === q.n).map(q => fb(q.n)))];
  const essential = family === 'storage' && pieces.length <= 3 && !has(/sign/);
  const decor = essential ? ['d1', 'd2', 'd3'] : pieces.length >= 5 || family === 'display' ? ['d3'] : ['d2', 'd3'];
  const score = +Math.min(6, 1.4 + 0.4 * o.l + 0.1 * o.b).toFixed(2);
  return { anchor, ...(o.ang ? { angle: o.ang } : {}), ...(o.of ? { of: o.of } : {}), creative: true, mined: true, name, family, role, traits, rooms, decor,
    slots: pieces.map(q => q.k), pieces, clips, ...(show ? { show } : {}), maxClip: clips.reduce((m, c) => Math.max(m, c[2]), 0), biome, from, foot: o.f, h: o.h, score,
    min: Math.max(2, Math.ceil(pieces.length * 0.6)), basis: `combined in ${o.b} corpus builds, ${o.l} of them well-liked (lab/mine_creative.js)`, src: o.s };
}

// ---------------------------------------------------------------- into the library
if (require.main === module) {
  const lib = JSON.parse(fs.readFileSync(LIB, 'utf8'));
  const kept = lib.assemblies.filter(a => !a.creative);
  const before = new Set(); for (const a of kept) for (const p of a.pieces) before.add(p.n);
  const out = [], why = [];
  SETS.forEach((s, i) => {
    let r;
    try { r = build(s); } catch (e) { why.push(`${s.key}: ${e.message}`); return; }
    const id = `KC-${String(i + 1).padStart(3, '0')}`;
    const ks = new Set(r.pieces.map(q => KB.slotOf(q.n)));
    const a = { id, anchor: s.anchor, ...(s.angle ? { angle: s.angle } : {}), ...(s.of ? { of: s.of } : {}), creative: true, name: s.name, family: s.family, role: s.role,
      traits: s.traits, rooms: s.rooms, decor: s.decor, slots: r.pieces.map(q => q.k), pieces: r.pieces, clips: r.clips, maxClip: r.maxClip,
      biome: r.biome, from: r.from, foot: r.foot, h: r.h, score: +(s.score || (1.6 + 0.15 * ks.size + (s.src ? 0.5 : 0))).toFixed(2), min: Math.max(2, Math.ceil(r.pieces.length * 0.6)),
      basis: s.basis, src: s.src || [] };
    out.push(a);
  });
  const minedFile = path.join(__dirname, '../data/creative-mined.json');
  const minedPicks = fs.existsSync(minedFile) ? JSON.parse(fs.readFileSync(minedFile, 'utf8')).objects : [];
  for (const o of minedPicks) {
    const a = minedSet(o);
    if (DROP.has(o.pick)) continue;
    // with NODROP every pick goes in and carries its number, so a probe can name the picks left out (lab/creative_fit.js --drop)
    out.push({ id: `KC-${String(out.length + 1).padStart(3, '0')}`, ...a, ...(process.env.NODROP ? { pick: o.pick } : {}) });
  }
  lib.assemblies = kept.concat(out);
  const after = new Set(); for (const a of lib.assemblies) for (const p of a.pieces) after.add(p.n);
  lib.creative = { about: 'Creative sets (KC-): combined, stacked and clipped objects written by lab/creative_sets.js and measured with the game\'s colliders; each names its family, role, household traits, rooms, decor stages, biome, footprint and height, and the corpus counts or builds it rests on. lab/mine_creative.js finds such objects by contact in any corpus.',
    sets: out.length, prefabsBefore: before.size, prefabsAfter: after.size, mined: JSON.parse(fs.readFileSync(path.join(__dirname, '../data/creative-mined.json'), 'utf8')).mined };
  fs.writeFileSync(outPath, JSON.stringify(lib, null, 0).replace(/\{"id"/g, '\n{"id"').replace(/\{"n":"([^"]+)","role"/g, '\n{"n":"$1","role"'));
  for (const w of why) console.log('left out', w);
  for (const a of out) console.log(a.id, a.name.padEnd(38), a.anchor.padEnd(8), a.biome.padEnd(12), `foot ${a.foot.join('x')} h ${a.h}`, `clip ${a.maxClip}`, a.clips.map(c => c.join(':')).join(' '));
  console.log(`${out.length} creative sets; prefabs in the library ${before.size} -> ${after.size}`);
}
module.exports = { SETS, build, DROP };
