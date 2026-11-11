// Villheim exterior motifs: whole assemblies of trim round windows, doors, corners, gables and eaves, taken from the
// best-liked community builds (lab/mine_motifs.js, data/motifs.json) and built on a generated building by
// lib/details.js. A motif is a list of pieces in its feature's frame: a along the wall, o out from it, h up from the
// feature's foot, r the piece's yaw from the frame. docs/BUILDING_DETAILS.md, "Motifs".
//
// Per building one family of trim: the door's motif first, then windows, gables and corners from the same source
// build where it has them, else the best-weighted motif that fits. The front gets the richer window; small and early
// buildings get plain ones. Every piece becomes the same shape in a material the biome and culture can make. A piece
// that would stand in a doorway, in another piece or in the air is left out; a motif that loses too much is not used
// and the rules in details.js do that feature instead.

const NODE_M = typeof module !== 'undefined';
const PM = NODE_M ? require('./pieces.js') : window.VHPieces;
const checksM = () => (NODE_M ? require('./checks.js') : window.VHChecks);
const meshMo = () => (NODE_M ? require('./mesh.js') : window.VHMesh);

const normM = a => ((a % 360) + 360) % 360;
const quatM = yaw => { const a = yaw * Math.PI / 360; return [0, +Math.sin(a).toFixed(6), 0, +Math.cos(a).toFixed(6)]; };
const BIOMES_M = ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains', 'Mistlands', 'Ashlands', 'Deep North'];
const reachesM = (biome, b) => BIOMES_M.indexOf(biome) >= BIOMES_M.indexOf(b);

// ---------------------------------------------------------------- piece classes (shared with lab/mine_motifs.js)

// the shape of a piece whatever it is made of (kept per name: the motif fitter asks for the same names many times)
const CLASS_M = new Map();
function classOf(n) {
  let c = CLASS_M.get(n);
  if (c === undefined) { c = classOf0(n); CLASS_M.set(n, c); }
  return c;
}
function classOf0(n) {
  const R = [
    [/wall_roof_top_45|roof_top_45/, n.includes('wall_roof_top') ? 'cross45' : 'cap45'], [/wall_roof_top|roof_top/, n.includes('wall_roof_top') ? 'cross26' : 'cap26'],
    [/wall_roof.*upsidedown/, /45/.test(n) ? 'gable45inv' : /67/.test(n) ? 'gable67inv' : 'gable26inv'],
    [/wall_roof|scale_wall_roof/, /45/.test(n) ? 'gable45' : /67/.test(n) ? 'gable67' : 'gable26'],
    [/roof.*ocorner/, /45/.test(n) ? 'ocorner45' : 'ocorner26'], [/roof.*icorner/, /45/.test(n) ? 'icorner45' : 'icorner26'],
    [/roof_67/, 'roof67'], [/roof_45|roof.*_45/, 'roof45'], [/roof/, 'roof26'],
    [/wall_cross_26|cross_26/, 'xbrace26'], [/wall_cross_45|cross_45/, 'xbrace45'], [/wall_cross_67/, 'xbrace67'],
    [/beam_26|log_26/, 'beam26'], [/beam_45|log_45/, 'beam45'], [/beam_67|log_67/, 'beam67'],
    [/beam4x4|beam_4m|log_4x0\.5/, 'beam4'], [/beam_1|beam_1m|pillarbeam_small/, 'beam1'], [/beam|pillarbeam/, 'beam2'],
    [/pole4|pole_log_4|pole_4m/, 'pole4'], [/pole2|pole_log$|pole_2m|darkwood_pole$|woodiron_pole|dvergr_pole/, 'pole2'], [/pole$|pole_1m/, 'pole1'],
    [/^stone_pillar$|pillar$|column_2/, 'pillar'], [/column_1|pillarbase/, 'pillarBase'],
    [/floor_1x1|tile_floor_1x1/, 'floor1'], [/floor_triangle/, 'floorTri'], [/floor/, 'floor2'],
    [/stepladder|ladder/, 'ladder'], [/spiralstair/, 'spiral'], [/stair/, 'stair'],
    [/crystal_wall|window_glass/, 'glass'], [/^wood_window$/, 'shutter'], [/grausten_window/, 'stoneWindow'],
    [/hooknchain|WallChain/, 'chain'], [/cloth_hanging_long|fenrirhide_hanging/, 'cloth'],
    [/iron_grate/, 'grate'], [/door|gate/, 'door'],
    [/stone_arch|blackmarble_arch|darkwood_arch|wall_arch|arch_top|arch_bottom|arch_big|pillar_arch/, 'arch'],
    [/decowall|divider|stave_deco_wall/, 'panel'], [/wall_quarter|quarterwall/, 'wall1x1'], [/wall_half|halfwall/, 'wallHalf'],
    [/wall_log_4/, 'logWall4'], [/wall_log/, 'logWall'], [/stone_wall_1x1|blackmarble_1x1|iron_wall_1x1|tile_wall_1x1/, 'block1'],
    [/stone_wall_2x1|blackmarble_2x1x1/, 'block2'], [/wall_4x2/, 'wall4'], [/woodwall$|wall_2x2|stave_wall|tile_wall_2x2/, 'wall2'],
    [/wood_ledge/, 'ledge'], [/fence_gate/, 'fenceGate'], [/fence/, 'fence'], [/stake_wall|stakewall|sharpstakes/, 'stakes'],
    [/walltorch/, 'wallTorch'], [/groundtorch|lantern_standing/, 'groundTorch'], [/brazierceiling|hoodedlantern|dvergr_lantern$/, 'hangLight'],
    [/brazierfloor|brazier/, 'brazier'], [/lantern/, 'lantern'], [/Candle/, 'candle'],
    [/wood_dragon/, 'dragon'], [/raven/, 'raven'], [/darkwood_wolf/, 'wolf'], [/itemstandh/, 'standH'], [/itemstand/, 'stand'],
    [/banner/, 'banner'], [/^sign/, 'sign'], [/garland/, 'garland'],
  ];
  for (const [re, c] of R) if (re.test(n)) return c;
  return n;
}
function matOf(n) {
  if (/^stave_|^scale_/.test(n)) return 'stave';
  if (/crystal|glass/.test(n)) return 'glass';
  if (/darkwood|blackwood/.test(n)) return 'darkwood';
  if (/ashwood/.test(n)) return 'ashwood';
  if (/grausten/.test(n)) return 'grausten';
  if (/blackmarble/.test(n)) return 'marble';
  if (/flametal/.test(n)) return 'flametal';
  if (/dvergr/.test(n)) return 'dvergr';
  if (/iron/.test(n)) return 'iron';
  if (/^stone_/.test(n)) return 'stone';
  if (/_log|wood_pole_log/.test(n)) return 'log';
  if (/^wood_roof|turf/.test(n)) return 'thatch';
  if (/torch|brazier|lantern|banner|sign|itemstand|dragon|raven|wolf|Candle|garland/.test(n)) return 'prop';
  return 'wood';
}
// pieces whose shape is not the same turned end for end along their local x (sloped beams and half gables)
const xAsym = c => /^(beam26|beam45|beam67|gable\d\dinv|gable\d\d)$/.test(c);
// how far round a piece can turn and look the same
const symOf = c => /^(pole\d|pillar|pillarBase)$/.test(c) ? 90 : /^(beam1|beam2|beam4|floor1|floor2|wall1x1|wallHalf|wall2|wall4|block1|block2|logWall|logWall4|panel|glass|shutter|fence|ledge|stakes|xbrace\d\d|cap26|cap45|cross26|cross45)$/.test(c) ? 180 : 360;
const TIMBER = ['wood', 'darkwood', 'iron', 'log', 'ashwood', 'stave'];
const STONY = ['stone', 'marble', 'grausten'];

// the same shape in each material (null: the material has none)
const NAMES = {
  wood: { beam2: 'wood_beam', beam1: 'wood_beam_1', beam26: 'wood_beam_26', beam45: 'wood_beam_45', beam67: 'wood_beam_67', pole1: 'wood_pole', pole2: 'wood_pole2',
    floor1: 'wood_floor_1x1', floor2: 'wood_floor', stair: 'wood_stair', wall1x1: 'wood_wall_quarter', wallHalf: 'wood_wall_half', wall2: 'woodwall',
    logWall: 'wood_wall_log', logWall4: 'wood_wall_log_4x0.5', shutter: 'wood_window', fence: 'wood_fence', ledge: 'wood_ledge',
    roof26: 'wood_roof', roof45: 'wood_roof_45', cap26: 'wood_roof_top', cap45: 'wood_roof_top_45', cross26: 'wood_wall_roof_top', cross45: 'wood_wall_roof_top_45',
    gable26: 'wood_wall_roof', gable45: 'wood_wall_roof_45', gable26inv: 'wood_wall_roof_upsidedown', gable45inv: 'wood_wall_roof_45_upsidedown' },
  darkwood: { beam2: 'darkwood_beam', beam26: 'darkwood_beam_26', beam45: 'darkwood_beam_45', beam4: 'darkwood_beam4x4', pole2: 'darkwood_pole', pole4: 'darkwood_pole4',
    roof26: 'darkwood_roof', roof45: 'darkwood_roof_45', cap26: 'darkwood_roof_top', cap45: 'darkwood_roof_top_45', arch: 'darkwood_arch', panel: 'darkwood_decowall' },
  iron: { beam2: 'woodiron_beam', beam26: 'woodiron_beam_26', beam45: 'woodiron_beam_45', beam67: 'woodiron_beam_67', pole2: 'woodiron_pole' },
  log: { pole2: 'wood_pole_log', pole4: 'wood_pole_log_4', beam26: 'wood_log_26', beam45: 'wood_log_45', beam67: 'wood_log_67', logWall: 'wood_wall_log', logWall4: 'wood_wall_log_4x0.5' },
  ashwood: { beam1: 'ashwood_beam_1m', beam2: 'ashwood_beam_2m', pole1: 'ashwood_pole_1m', pole2: 'ashwood_pole_2m', beam26: 'ashwood_wall_beam_26', beam45: 'ashwood_wall_beam_45',
    beam67: 'ashwood_wall_beam_67', floor1: 'ashwood_floor_1x1', floor2: 'ashwood_floor_2x2', wall1x1: 'ashwood_quarterwall_1x1', wallHalf: 'ashwood_halfwall_1x2',
    wall2: 'ashwood_wall_2x2', stair: 'ashwood_stair', xbrace26: 'ashwood_wall_cross_26', xbrace45: 'ashwood_wall_cross_45', arch: 'ashwood_wall_arch', panel: 'ashwood_decowall_divider' },
  stone: { block1: 'stone_wall_1x1', block2: 'stone_wall_2x1', wall4: 'stone_wall_4x2', arch: 'stone_arch', pillar: 'stone_pillar', floor2: 'stone_floor_2x2', stair: 'stone_stair', fence: 'stone_fence' },
};
// a shape the material lacks, in the nearest one it has
const NEAREST = { beam4: ['beam2'], pole4: ['pole2'], beam1: ['beam1'], xbrace26: [], xbrace45: [] };

// ---------------------------------------------------------------- data

// the motifs the generator can use, small enough to carry in the game's bundle and the request page: sizes it builds,
// trim that keeps to the wall, weight above 0; source and popularity left out (lib/build_engine.js, lib/build_web.js)
function liteSet(full, weightsIn) {
  const r2 = v => Math.round(v * 100) / 100;
  const ok = m => m.kind === 'window' ? Math.abs(m.fit.w - 2) <= 1 && Math.abs(Math.min(m.fit.h, 3) - 1) <= 1 && m.fit.w >= 1
    : m.kind === 'door' ? m.fit.w === 2 && Math.abs(Math.min(m.fit.h, 3) - 2) <= 1 : m.kind === 'gable' ? Math.abs(m.fit.overhang || 0) <= 0.3
      : m.kind === 'eave' ? (m.fit.overhang || 0) >= 0.4 && (m.fit.overhang || 0) <= 1.5 : m.kind === 'corner' ? [90, 135].includes(m.fit.angle)
        : m.kind === 'icorner' ? m.fit.angle === 270
          // a foot trim seen in one or two builds, or of one piece, says little; accents hang 1 to 3 m up the wall
          // and it lies flat at the foot: a paving strip, a sill board, a stone course (blocks standing along the foot read
          // as clutter)
          : m.kind === 'base' ? m.builds >= 2 && m.p.length >= 2 && m.p.every(t => t[3] <= 0.35 && /^(floor1|floor2|beam1|beam2|block1|block2|logWall|logWall4)$/.test(classOf(t[0])))
            // an item stand is kept only beside a lamp, a banner, a sign or a carving: the blueprint cannot hold the shield
            // or trophy on it, and an empty stand reads as a stray bracket
            : m.kind === 'wallface' ? m.p.every(t => !PROPS.test(classOf(t[0])) || (t[3] >= 0.9 && t[3] <= 3)) && m.p.every(t => t[3] < 3.6) &&
              m.p.some(t => /^(wallTorch|hangLight|lantern|candle|banner|sign|garland|dragon|raven|wolf|chain|cloth)$/.test(classOf(t[0]))) : !!LITE_CAP[m.kind];
  const motifs = [], weights = {}, nKind = {};
  for (const m of full.motifs) {
    const L = lite(m);
    if (!ok(m) || !flatOnWall(L) || (weightsIn && weightsIn[m.id] === 0)) continue;
    // the kinds the generator places, the best-ranked first (the full file is in rank order), so the bundle stays small
    if (LITE_CAP[m.kind] && (nKind[m.kind] = (nKind[m.kind] || 0) + 1) > LITE_CAP[m.kind]) continue;
    const fit = { ...m.fit };
    delete fit.sill; delete fit.door;
    delete fit.storey;
    motifs.push({ id: m.id, kind: m.kind, fit, src: m.srcBuild, p: L.p.map(t => (t[5] ? [t[0], r2(t[1]), r2(t[2]), r2(t[3]), Math.round(t[4]), t[5]] : [t[0], r2(t[1]), r2(t[2]), r2(t[3]), Math.round(t[4])])) });
    if (weightsIn && weightsIn[m.id] != null) weights[m.id] = weightsIn[m.id];
  }
  return { motifs, weights };
}

// how many of each kind go in the bundle (windows, doors, gables and eaves by the cuts above)
const LITE_CAP = { corner: 90, icorner: 50, base: 70, wallface: 120, eave: 120 };
// the wall types a motif's own wall can stand for: boards for boards, logs for logs, stone for stone
const WT_FAMILY = { plank: 'boards', 'half-timber': 'boards', log: 'log', stone: 'stone', marble: 'stone', grausten: 'stone', 'stone-base': 'stone-base' };
const wtFamily = w => WT_FAMILY[w] || 'boards';

let DATA = null, WEIGHTS = null;
function lite(m) {
  return { id: m.id, kind: m.kind, fit: m.fit, p: m.p || m.pieces.map(t => [t.n, t.a, t.o, t.h, t.r]), src: m.srcBuild || m.src, biome: m.biome, w: m.w };
}
function data() {
  if (DATA) return DATA;
  let raw = null;
  if (NODE_M) { try { raw = require('../data/motifs.json'); } catch (e) { raw = null; } }
  if (!raw && typeof window !== 'undefined' && window.VH_MOTIFS) raw = window.VH_MOTIFS;
  // the lab's full file goes through the same cut as the bundle, so Node and the game pick alike
  if (raw && raw.motifs.length && raw.motifs[0].srcBuild !== undefined) raw = liteSet(raw, weights());
  DATA = raw ? raw.motifs.map(lite) : [];
  return DATA;
}
function weights() {
  if (WEIGHTS) return WEIGHTS;
  let w = null;
  if (NODE_M) { try { w = require('../data/motif-scores.json').weights; } catch (e) { w = null; } }
  if (!w && typeof window !== 'undefined' && window.VH_MOTIF_WEIGHTS) w = window.VH_MOTIF_WEIGHTS;
  WEIGHTS = w || {};
  return WEIGHTS;
}
function setData(d, w) { DATA = d ? d.motifs.map(lite) : null; WEIGHTS = w || null; }
// a motif's weight: Tyler's score where there is one, else the seed from how many builds use it
const weightOf = m => { const w = weights()[m.id]; return w != null ? w : (m.w != null ? m.w : 1); };

// ---------------------------------------------------------------- materials for one building

function materials(ctx) {
  const { K, C, biome } = ctx;
  const trim = TIMBER.includes(matOf(K.beam || 'wood_beam')) ? matOf(K.beam || 'wood_beam') : 'wood';
  const stoneWalls = /stone|marble|grausten/.test(C.wallStyle || '') || !!C.stoneWalls;
  const sN = +String(ctx.stage || 's2')[1];
  return {
    trim, biome,
    timber: TIMBER.filter(m => ({ wood: 'Meadows', log: 'Black Forest', iron: 'Swamp', darkwood: 'Plains', ashwood: 'Ashlands', stave: 'Deep North' })[m] && reachesM(biome, { wood: 'Meadows', log: 'Black Forest', iron: 'Swamp', darkwood: 'Plains', ashwood: 'Ashlands', stave: 'Deep North' }[m])),
    // stone trim only on stone walls, and in Meadows and Black Forest villages only on later, larger buildings (D-012)
    stone: stoneWalls && reachesM(biome, 'Black Forest') && (sN >= 2 || reachesM(biome, 'Swamp')),
    glass: !!C.glass && reachesM(biome, 'Mountain'),
    // no diagonal braces laid on log or stone walls (they belong to framed walls; 2026-11-09 review)
    noBraces: /log|stone|marble|grausten/.test(C.wallStyle || '') || !!C.stoneWalls,
    // the crossed gable boards are a Norse and Slavic mark, not every culture's (round 4 review)
    crossOK: ['norse', 'norse-forest', 'norse-highland', 'slavic', 'baltic'].includes(ctx.cultureKey),
    roof26: K.roof26 || 'wood_roof', roof45: K.roof45 || 'wood_roof_45',
    // the motif's 2 m posts iron-bound where the building's corner posts are (details.js ironPosts)
    ironPoles: !!(ctx.profile && ctx.profile.ironPosts) && reachesM(biome, 'Swamp'),
  };
}
const nameIn = (cls, mat) => (NAMES[mat] && NAMES[mat][cls]) || null;
// the motif's pieces in this building's materials: [name, a, o, h, r, cls] or null where a piece cannot be made
function swap(m, mt) {
  const counts = {};
  for (const t of m.p) { const mm = matOf(t[0]); if (TIMBER.includes(mm)) counts[mm] = (counts[mm] || 0) + 1; }
  const primary = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  const out = [];
  for (const t of m.p) {
    const [n, a, o, h, r, clip] = t, cls = classOf(n), mat = matOf(n);
    let name = null;
    if (TIMBER.includes(mat)) {
      // the motif's main wood becomes the building's trim wood; a second wood stays where the biome has it
      const want = mat === primary || mat === 'stave' || !mt.timber.includes(mat) ? mt.trim : mat;
      name = (mt.ironPoles && cls === 'pole2' && want === 'wood' ? 'woodiron_pole' : null) || nameIn(cls, want) || nameIn(cls, 'wood');
      if (!name) for (const alt of NEAREST[cls] || []) { name = nameIn(alt, want) || nameIn(alt, 'wood'); if (name) break; }
      if (!name && mt.timber.includes(mat) && mat !== 'stave') name = n;
    } else if (STONY.includes(mat)) {
      name = mt.stone ? nameIn(cls, 'stone') : null;
      if (!name) return null; // stone work is the motif: no stone, no motif
    } else if (mat === 'thatch') {
      name = /45/.test(cls) ? mt.roof45 : mt.roof26;
      if (!/^roof/.test(cls)) name = null;
    } else if (mat === 'glass') {
      name = mt.glass ? n : null;
    } else if (mat === 'prop') {
      name = n;
      if (cls === 'groundTorch') name = reachesM(mt.biome, 'Swamp') ? 'piece_groundtorch' : 'piece_groundtorch_wood';
    } else name = null; // dvergr, flametal and odd pieces
    if (name && !reachesM(mt.biome, PM.needs(name))) name = cls === 'wallTorch' || cls === 'shutter' ? null : name === n ? null : name;
    if (name && !reachesM(mt.biome, PM.needs(name))) name = null;
    out.push(name ? [name, a, o, h, r, cls, clip || 0] : null);
  }
  return out;
}

// ---------------------------------------------------------------- choosing

// how much a building may carry: plain at s1, more at s3 and on the front; d1 has no lamps or carvings
function budget(ctx, front) {
  const sN = +String(ctx.stage)[1], dN = +String(ctx.decor)[1];
  return { max: sN === 1 ? 3 : sN === 2 ? (front ? 7 : 5) : (front ? 10 : 7), props: dN >= 2, carvings: dN >= 3 || (dN >= 2 && sN >= 3) };
}
// does a motif fit this feature: kind, size (an opening a meter larger or smaller is fitted by its edges), slope
function fits(m, kind, f) {
  if (m.kind !== kind) return false;
  const g = m.fit || {};
  if (kind === 'window' || kind === 'door') {
    if (Math.abs(g.w - f.w) > 1.01 || Math.abs(Math.min(g.h, 3) - f.h) > 1.01 || g.w < 1 || g.h < 0.5) return false;
    if (kind === 'door' && g.w !== f.w) return false;
  }
  if ((kind === 'gable' || kind === 'eave') && g.slope !== f.slope) return false;
  if ((kind === 'corner' || kind === 'icorner') && f.angle != null && (g.angle || 90) !== f.angle) return false;
  // the foot of a wall and what hangs on it come from the same kind of wall (a log sill on stone reads wrong)
  if ((kind === 'base' || kind === 'wallface' || kind === 'corner' || kind === 'icorner') && f.wt && g.wt && wtFamily(g.wt) !== wtFamily(f.wt)) return false;
  if (kind === 'gable' && Math.abs(g.overhang || 0) > 0.3) return false;
  if (kind === 'eave' && Math.abs((g.overhang || 0) - (f.overhang || 0)) > 0.5) return false;
  return true;
}
const PROPS = /^(wallTorch|groundTorch|hangLight|brazier|lantern|candle|banner|sign|stand|standH|garland|chain|cloth)$/, CARVED = /^(dragon|raven|wolf)$/;
// the motif's pieces this building may have (lamps and carvings by decor stage), or null when the motif is too much
// a window's trim lies on the wall: a sloped beam standing out from it, or a long beam reaching out, is a strut or a
// bracket of something else in its source build and reads as debris on a plain wall
function flatOnWall(m) {
  if (m.kind === 'icorner' || (m.kind === 'corner' && (m.fit.angle || 90) !== 90)) {
    // close to the corner, nothing reaching out more than a meter
    return !m.p.some(t => Math.hypot(t[1], t[2]) > 1.1 || t[2] > 0.9);
  }
  if (m.kind === 'base') return !m.p.some(t => t[2] > 0.7 || t[3] > 1.2 || Math.abs(t[1]) > 1.3);
  if (m.kind === 'wallface') return !m.p.some(t => t[2] > 0.8 || Math.abs(t[1]) > 1.3);
  if (m.kind !== 'window' && m.kind !== 'corner') return true;
  // the motif built on a frame at the origin facing +z (windows) or the corner of two walls facing +x and +z
  const fr = m.kind === 'window' ? { x: 0, y: 0, z: 0, nx: 0, nz: 1 } : { x: 0, y: 0, z: 0, nx: Math.SQRT1_2, nz: Math.SQRT1_2 };
  const Ck = checksM();
  return !m.p.some(t => {
    const c = classOf(t[0]), p = toWorld(fr, [t[0], t[1], t[2], t[3], t[4], c]);
    const bx = Ck.aabb({ ...p, q: quatM(p.yaw) });
    if (m.kind === 'corner') return bx.x1 > 0.8 || bx.z1 > 0.8; // log ends and posts close to the corner, nothing reaching out
    const across = Math.abs(Math.sin(t[4] * Math.PI / 180)) > 0.5;
    return /^cross/.test(c) || (/^beam(26|45|67)$/.test(c) && across) || bx.z1 > (/^floor/.test(c) ? 1.0 : 0.75);
  });
}
function usable(m, mt, bud, wallStone) {
  if (!flatOnWall(m)) return null;
  if ((m.fit.wall && /stone|marble|grausten|iron_wall/.test(m.fit.wall)) !== !!wallStone && (m.kind === 'window' || m.kind === 'door')) return null;
  const sw = swap(m, mt);
  if (!sw) return null;
  // the generator lays its own entry stairs and steps to the door's height
  const sw2 = sw.map((t, i) => (t && /^(stair|ladder|spiral)$/.test(t[5]) ? 'skip' : t));
  const kept = sw2.filter((t, i) => {
    if (t === 'skip' || !t) return false;
    if (PROPS.test(t[5]) && !bud.props) return false;
    if (CARVED.test(t[5]) && !bud.carvings) return false;
    if (mt.noBraces && m.kind !== 'gable' && /^beam(26|45|67)$/.test(t[5])) return false;
    if (!mt.crossOK && /^cross(26|45)$/.test(t[5])) return false;
    // no level beam ends standing out from a gable on their own (they read as stray sticks, 2026-11-09 review)
    if (m.kind === 'gable' && /^beam[12]$/.test(t[5]) && t[2] > 0.35) return false;
    return true;
  });
  const lost = sw2.filter(t => t === null).length + (sw2.length - kept.length - sw2.filter(t => t === null || t === 'skip').length);
  if (!kept.length || kept.length > bud.max || lost > Math.max(1, m.p.length * 0.34)) return null;
  // nothing but lamps and carvings is not trim
  if (kept.every(t => PROPS.test(t[5]) || CARVED.test(t[5]))) return null;
  return kept;
}
// a seeded weighted pick; motifs from the family's source builds count three times
function pick(R, cands, family) {
  let tot = 0;
  const ws = cands.map(c => { const w = c.w * (family && family.has(c.m.src) ? 3 : 1) * (c.exact ? 2 : 1); tot += w; return w; });
  if (!tot) return null;
  let x = R() * tot;
  for (let i = 0; i < cands.length; i++) { x -= ws[i]; if (x <= 0) return cands[i]; }
  return cands[cands.length - 1];
}
// the motifs for one building: get(kind, size, front) picks once per kind, size and front/back and keeps it, so all
// windows of a size on a facade match; family holds the source builds already used (their other motifs count more)
let ENABLED = !(NODE_M && typeof process !== 'undefined' && process.env && process.env.VH_NO_MOTIFS);
function setEnabled(v) { ENABLED = !!v; }
function rngM(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function plan(ctx) {
  if (!ENABLED || !data().length) return null;
  // its own random stream, from the building's own make, so the rest of the design draws as it did without motifs
  const sig = [ctx.cultureKey, ctx.type, ctx.stage, ctx.decor, ctx.biome, ctx.plan, ctx.F, ctx.SH, ctx.storeys, ctx.door && ctx.door.x, ctx.door && ctx.door.z,
    (ctx.edges || []).length, ...(ctx.wings || []).map(w => `${w.cx},${w.cz},${w.W},${w.D}`), ctx.seed].join('|');
  let hsh = 2166136261;
  for (let i = 0; i < sig.length; i++) { hsh ^= sig.charCodeAt(i); hsh = Math.imul(hsh, 16777619); }
  const mt = materials(ctx), R = rngM(hsh), family = new Set(), cache = new Map();
  const wallStone = /stone|marble|grausten/.test(ctx.C.wallStyle || '') && !/base/.test(ctx.C.wallStyle || '');
  // accept: an optional test of a candidate on this building (eaves: most of its pieces fit under this roof)
  const get = (kind, f, front, accept) => {
    const key = `${kind}|${f.w || ''}x${f.h || ''}|${f.slope || ''}|${front ? 1 : 0}`;
    if (cache.has(key)) return cache.get(key);
    const bud = budget(ctx, front), cands = [];
    for (const m of data()) {
      if (!fits(m, kind, f)) continue;
      const w = weightOf(m);
      if (w <= 0) continue;
      const kept = usable(m, mt, kind === 'gable' ? { ...bud, max: bud.max + 4 } : bud, kind === 'window' || kind === 'door' ? wallStone : false);
      if (!kept) continue;
      const g = m.fit;
      const cand = { m, w, kept, exact: kind === 'window' ? g.w === f.w && g.h === f.h : (kind === 'base' || kind === 'wallface' || kind === 'corner') ? g.wt === f.wt : true };
      if (accept && !accept(cand)) continue;
      cands.push(cand);
    }
    let c = pick(R, cands, family);
    // the back and side walls: a plainer motif of the same family where one fits, else the front's own
    if (!front && kind === 'window' && cache.has(key.slice(0, -1) + '1')) {
      const fr = cache.get(key.slice(0, -1) + '1');
      if (fr && c && c.kept.length > fr.kept.length) c = fr;
    }
    if (c) family.add(c.m.src);
    cache.set(key, c);
    return c;
  };
  return { mt, family, get, mirror: R() < 0.5, R };
}

// ---------------------------------------------------------------- placing

// a frame: origin, outward (nx, nz); the motif's pieces to world pieces, mirrored when asked
function toWorld(fr, t, mirror) {
  let [name, a, o, h, r, cls, clip] = t;
  if (mirror) { a = -a; r = xAsym(cls) ? 180 - r : -r; }
  const Y = normM(Math.atan2(fr.nx, fr.nz) * 180 / Math.PI), c = Math.cos(Y * Math.PI / 180), s = Math.sin(Y * Math.PI / 180);
  const p = { name, x: fr.x + a * c + o * s, y: fr.y + h, z: fr.z - a * s + o * c, yaw: normM(Y + r), cls, a, o, h };
  if (clip) p.clip = clip;
  return p;
}
// windows and doors: pieces at the sides keep their distance from the opening's edge, pieces over it from its head
function refit(t, g, f) {
  if (!f || (g.w === f.w && g.h === f.h)) return t;
  let [name, a, o, h, r, cls, clip] = t;
  const dw = (f.w - g.w) / 2, dh = f.h - g.h;
  const inside = Math.abs(a) < g.w / 2 - 0.15 && h > 0.15 && h < g.h - 0.15 && Math.abs(o) < 0.3;
  if (inside) return null; // a mullion or a lattice belongs to its own opening size
  if (a > g.w / 2 - 0.3) a += dw; else if (a < -g.w / 2 + 0.3) a -= dw;
  if (h > g.h - 0.3) h += dh; else if (h > 0.3) h = h * f.h / g.h;
  // a post as tall as the old opening, beside a lower one, is a short post
  if (dh <= -0.99 && cls === 'pole2' && h > 0 && h < f.h + 0.5) { name = name.replace(/pole2$/, 'pole').replace(/pole_2m$/, 'pole_1m'); if (name === 'darkwood_pole' || name === 'woodiron_pole' || name === 'wood_pole_log') name = 'wood_pole'; cls = 'pole1'; }
  return [name, a, o, h, r, cls, clip];
}

const depthM = (a, o) => Math.max(0, Math.min(Math.min(a.x1, o.x1) - Math.max(a.x0, o.x0), Math.min(a.y1, o.y1) - Math.max(a.y0, o.y0), Math.min(a.z1, o.z1) - Math.max(a.z0, o.z0)));
const volM = a => Math.max(0, a.x1 - a.x0) * Math.max(0, a.y1 - a.y0) * Math.max(0, a.z1 - a.z0);
const interM = (a, o) => Math.max(0, Math.min(a.x1, o.x1) - Math.max(a.x0, o.x0)) * Math.max(0, Math.min(a.y1, o.y1) - Math.max(a.y0, o.y0)) * Math.max(0, Math.min(a.z1, o.z1) - Math.max(a.z0, o.z0));
// boxes of the pieces already placed, kept while they stay where they are
const BOXES = new WeakMap();
function boxOf(Ck, p) {
  const c = BOXES.get(p);
  if (c && c.x === p.x && c.y === p.y && c.z === p.z && c.n === p.name) return c.b;
  const bx = Ck.aabb(p);
  BOXES.set(p, { x: p.x, y: p.y, z: p.z, n: p.name, b: bx });
  return bx;
}
const BLOCKING = ['door', 'stair', 'storage', 'craft', 'seat', 'table', 'bed', 'light', 'fence', 'deco', 'window', 'roof', 'roofTop', 'roofCorner', 'gable', 'fire', 'floor'];
// put a motif on a feature; returns the number of pieces placed, or 0 when it would lose too much (nothing placed)
//   fr: { x, y, z, nx, nz } the feature frame; g: the motif's own fit; f: the feature's size (windows, doors);
//   opts: { mirror, ground, minH (lowest h kept), noInfill (glass in the opening), keepOut: [boxes], minShare }
function place(b, c, fr, f, opts = {}) {
  const Ck = checksM();
  const cand = [];
  for (const t0 of c.kept) {
    const t = refit(t0, c.m.fit, f);
    if (!t) continue;
    if (opts.minH != null && t[3] < opts.minH) continue;
    if (opts.noInfill && f && Math.abs(t[1]) < f.w / 2 - 0.1 && t[3] > 0.1 && t[3] < f.h - 0.1 && Math.abs(t[2]) < 0.35) continue;
    const p = toWorld(fr, t, opts.mirror);
    p.q = quatM(p.yaw);
    cand.push(p);
  }
  if (!cand.length) return [];
  // opts.lift: a foot trim half sunk in the ground in its source build comes up to stand on it (at most 0.3 m)
  if (opts.lift && opts.ground != null) {
    const low = Math.min(...cand.map(p => Ck.aabb(p).y0));
    if (low < opts.ground - 0.05 && low > opts.ground - 0.31) for (const p of cand) p.y += opts.ground - low;
  }
  const own = (p, wall) => {
    // a wall piece in the feature's own wall plane (trim laid on or in the wall is fine there)
    const info = PM.piece(wall.name);
    if (info.role !== 'wall' && info.role !== 'window') return false;
    const yw = normM(wall.yaw != null ? wall.yaw : 0), Y = normM(Math.atan2(fr.nx, fr.nz) * 180 / Math.PI);
    // a corner of a many-sided plan: laid on either wall, whatever its angle to the frame (the piece close to its plane)
    if (opts.anyWall) { const wn = [Math.sin(yw * Math.PI / 180), Math.cos(yw * Math.PI / 180)]; return Math.abs((p.x - wall.x) * wn[0] + (p.z - wall.z) * wn[1]) < 0.45; }
    const d = (wall.x - fr.x) * fr.nx + (wall.z - fr.z) * fr.nz;
    return Math.abs(d) < 0.45 && Math.abs(Math.sin((yw - Y) * Math.PI / 180)) < 0.1;
  };
  // the way through each door: its width less a little, its height (up to 2.3 m), a metre each side
  const doors = b.pieces.filter(p => PM.piece(p.name).role === 'door').map(p => {
    const o = PM.doorOpening(p), hw = o.w / 2 - 0.12, ex = Math.abs(o.ux) * hw + Math.abs(o.nx) * 1.0, ez = Math.abs(o.uz) * hw + Math.abs(o.nz) * 1.0;
    return { x0: o.x - ex, x1: o.x + ex, z0: o.z - ez, z1: o.z + ez, y0: o.y + 0.05, y1: o.y + Math.min(o.h, 2.3) - 0.02 };
  });
  // stairs and ladders keep the room over them to climb, and a metre at their foot
  const climbs = b.pieces.filter(p => PM.piece(p.name).role === 'stair').map(p => { const o = boxOf(Ck, p); return { x0: o.x0 - 1, x1: o.x1 + 1, y0: o.y0 + 0.05, y1: o.y1 + 2.4, z0: o.z0 - 1, z1: o.z1 + 1 }; });
  const keepOut = [...doors, ...climbs, ...(opts.keepOut || [])];
  const hit = (a, o, pad) => o.x0 < a.x1 - pad && o.x1 > a.x0 + pad && o.y0 < a.y1 - pad && o.y1 > a.y0 + pad && o.z0 < a.z1 - pad && o.z1 > a.z0 + pad;
  const ok = [];
  // pieces already there, and motif pieces waiting to go in after the furnishing (details.js)
  const there = b.motifPending && b.motifPending.length ? b.pieces.concat(b.motifPending.map(p => ({ ...p, trim: true, q: p.q || quatM(p.yaw) }))) : b.pieces;
  const trimNear = there.filter(q => q.trim && Math.hypot(q.x - fr.x, q.z - fr.z) < 8);
  // floors people walk on outside the wall (decks, galleries, the inner corner of a cross plan): nothing of the motif
  // hangs lower than 2.35 m over them (the rooms are behind the wall, where no motif piece goes)
  const floors = b.pieces.filter(q => !q.trim && !q.decor && PM.piece(q.name).role === 'floor' && Math.hypot(q.x - fr.x, q.z - fr.z) < 6 &&
    (q.x - fr.x) * fr.nx + (q.z - fr.z) * fr.nz > 0.6).map(q => boxOf(Ck, q));
  const overFloor = bx => floors.some(o => (bx.x0 + bx.x1) / 2 > o.x0 && (bx.x0 + bx.x1) / 2 < o.x1 && (bx.z0 + bx.z1) / 2 > o.z0 && (bx.z0 + bx.z1) / 2 < o.z1 && bx.y0 >= o.y1 - 0.05 && bx.y0 - o.y1 < 2.35 && bx.y0 - o.y1 > 0.3);
  for (const p of cand) {
    const bx = Ck.aabb(p), info = PM.piece(p.name);
    // the same shape already there from the rules (a corner post, a sill): one is enough
    if (trimNear.some(q => classOf(q.name) === p.cls && Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z) < 0.3)) continue;
    if (bx.y0 < (opts.ground != null ? opts.ground : -Infinity) - 0.05) continue;
    if (overFloor(bx)) continue;
    // nothing reaches into the building past the wall (a hood board half indoors, a sill through the wall)
    if (opts.inward !== false) {
      const gb = Ck.gameBox ? Ck.gameBox(p) : bx; // the game's own solids, a beam is 0.4 m deep
      const ins = Math.min(...[[gb.x0, gb.z0], [gb.x0, gb.z1], [gb.x1, gb.z0], [gb.x1, gb.z1]].map(([x, z]) => (x - fr.x) * fr.nx + (z - fr.z) * fr.nz));
      // a lamp or a banner hangs from a bracket that reaches into the wall
      if (ins < (PROPS.test(p.cls) || CARVED.test(p.cls) ? -0.45 : -0.2)) continue;
    }
    if (keepOut.some(z => hit(bx, z, 0.02))) continue;
    // a lamp, banner, sign or carving keeps what shows of it out of what shows of the walls, posts, braces and roof
    // round it (a banner on the barn's wall where an eave brace and the roof come down; the wall's cross bars)
    const Me = (PROPS.test(p.cls) || CARVED.test(p.cls)) && meshMo();
    if (Me) {
      const A = Me.world(p);
      if (A && A.length && there.some(q => (!q.decor || q.trim) && Math.abs(q.x - p.x) < 3.5 && Math.abs(q.z - p.z) < 3.5 && Math.abs(q.y - p.y) < 4 &&
        ['wall', 'window', 'pole', 'beam', 'roof', 'roofCorner', 'roofTop', 'gable'].includes(PM.piece(q.name).role) && Me.deepest(A, Me.world(q)) > (/^piece_banner\d+$/.test(p.name) ? 0.03 : 0.015))) continue;
    }
    let clash = false;
    for (const q of there) {
      const qb = boxOf(Ck, q);
      if (!hit(bx, qb, 0.06)) continue;
      const qi = PM.piece(q.name);
      // set into a wall or a post no deeper than its source build had it (D-065)
      if (p.clip && ['wall', 'pole', 'beam'].includes(qi.role) && depthM(bx, qb) <= p.clip + 0.03) continue;
      // laid on its own wall; a wall piece of the motif inside the wall is the wall twice
      if (qi.role === 'wall' && own(p, q) && !(info.role === 'wall' && interM(bx, qb) > 0.3 * volM(bx))) continue;
      if (!q.decor && !q.trim && ['beam', 'pole'].includes(qi.role) && ['beam', 'pole'].includes(info.role)) continue; // timber meeting timber
      // a post or beam end meeting the edge of a floor or a roof (builders let them run in a little, D-065)
      if (!q.decor && !q.trim && ['floor', 'roof', 'roofCorner', 'gable'].includes(qi.role) && ['beam', 'pole'].includes(info.role) && interM(bx, qb) < 0.02) continue;
      if (q.trim && ['beam', 'pole'].includes(qi.role) && ['beam', 'pole'].includes(info.role) && !(q.name === p.name && Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z) < 0.3)) continue;
      if (BLOCKING.includes(qi.role) || qi.role === 'wall' || q.decor || (q.trim && qi.role === info.role)) { clash = true; break; }
    }
    if (!clash) ok.push(p);
  }
  // nothing in the air: each piece touches the building or a placed piece that does
  const boxes = ok.map(p => Ck.aabb(p)), held = ok.map(() => false);
  const touch = (a, o, g) => a.x0 <= o.x1 + g && a.x1 >= o.x0 - g && a.y0 <= o.y1 + g && a.y1 >= o.y0 - g && a.z0 <= o.z1 + g && a.z1 >= o.z0 - g;
  const struct = there.filter(q => PM.piece(q.name).structural && !q.decor);
  boxes.forEach((bx, i) => { if (bx.y0 <= (opts.ground != null ? opts.ground : 0) + 0.3 || struct.some(q => touch(bx, boxOf(Ck, q), 0.12))) held[i] = true; });
  for (let k = 0, more = true; more && k < 12; k++) {
    more = false;
    boxes.forEach((bx, i) => { if (!held[i] && boxes.some((o, j) => held[j] && touch(bx, o, 0.12))) { held[i] = true; more = true; } });
  }
  const placed = ok.filter((p, i) => held[i]);
  if (placed.length < Math.max(1, Math.ceil(c.kept.length * (opts.minShare != null ? opts.minShare : 0.6)))) return [];
  if (opts.dry) { for (const p of placed) p.motif = c.m.id; return placed; }
  for (const p of placed) b.put(p.name, p.x, p.y, p.z, p.yaw, p.clip ? { trim: true, motif: c.m.id, footed: true, clip: p.clip } : { trim: true, motif: c.m.id, footed: true });
  return placed;
}

// gables and eaves go in with the roof (generate.js's roof parts, wing-local): the frame there is wing-local too
// opts.minShare: put nothing unless that share of the motif's pieces fits (opts.skip says which do not)
function roofParts(c, fr, add, opts = {}) {
  const go = [];
  for (const t of c.kept) {
    const p = toWorld(fr, t, opts.mirror);
    if (opts.skip && opts.skip(p)) continue;
    go.push(p);
  }
  if (opts.minShare && go.length < Math.ceil(c.kept.length * opts.minShare)) return 0;
  if (opts.dry) return go.length;
  for (const p of go) add(p.name, p.x, p.y, p.z, p.yaw, 'trim', p.y + 0.5);
  return go.length;
}

const apiM = { wtFamily, depthM, flatOnWall, lite: liteSet, classOf, matOf, xAsym, symOf, NAMES, data, setData, weights, weightOf, materials, swap, fits, usable, plan, place, roofParts, toWorld, refit, setEnabled, PROPS, CARVED };
if (NODE_M) module.exports = apiM; else window.VHMotifs = apiM;
