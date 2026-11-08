// Building kits per biome and culture. The piece choices and proportions come from the corpus palettes
// (lab/learn.py, rules.json "palettes" and "shell"); the combinations per culture follow how the corpus builds
// in each style. A kit names the pieces; the generator decides where they go.

const BIOMES = ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains', 'Mistlands', 'Ashlands'];

// Pieces every biome kit has. Later biomes may use earlier biomes' pieces.
const BIOME_KIT = {
  'Meadows': {
    floor: 'wood_floor', floor1: 'wood_floor_1x1', wall: 'woodwall', wallHalf: 'wood_wall_half', wallQuarter: 'wood_wall_quarter',
    pole: 'wood_pole2', pole1: 'wood_pole', poleLong: 'wood_pole2', beam: 'wood_beam', beam1: 'wood_beam_1',
    roof26: 'wood_roof', roof45: 'wood_roof_45', roofTop26: 'wood_roof_top', roofTop45: 'wood_roof_top_45',
    gable26: 'wood_wall_roof', gable45: 'wood_wall_roof_45', door: 'wood_door', gate: 'wood_gate', window: 'wood_window',
    stair: 'wood_stair', ladder: 'wood_stepladder', fence: 'wood_fence', plinth: null, stoneFloor: null,
  },
  'Black Forest': {
    wall: 'wood_wall_log', wallLog: true, poleLong: 'wood_pole_log_4', pole: 'wood_pole_log', plinth: 'stone_wall_2x1',
    stoneWall: 'stone_wall_2x1', stoneWall4: 'stone_wall_4x2', stoneBlock: 'stone_wall_1x1', stoneFloor: 'stone_floor_2x2',
    stoneArch: 'stone_arch', stonePillar: 'stone_pillar', stoneStair: 'stone_stair', beamLog: 'wood_log_26',
  },
  'Swamp': {
    wall: 'woodwall', pole: 'darkwood_pole', poleLong: 'darkwood_pole4', beam: 'darkwood_beam', beamLong: 'darkwood_beam4x4',
    roof26: 'darkwood_roof', roof45: 'darkwood_roof_45', roofTop26: 'darkwood_roof_top', roofTop45: 'darkwood_roof_top_45',
    door: 'darkwood_gate', ironBeam: 'woodiron_beam', ironPole: 'woodiron_pole', decowall: 'darkwood_decowall',
  },
  'Mountain': { window: 'crystal_wall_1x1', glass: 'crystal_wall_1x1' },
  'Plains': {},
  'Mistlands': {
    wall: 'blackmarble_2x1x1', stoneWall: 'blackmarble_2x1x1', stoneBlock: 'blackmarble_1x1', stoneFloor: 'blackmarble_floor',
    stonePillar: 'blackmarble_column_1', stoneArch: 'blackmarble_arch', plinth: 'blackmarble_2x1x1',
  },
  'Ashlands': {
    wall: 'ashwood_wall_2x2', pole: 'ashwood_pole_2m', poleLong: 'ashwood_pole_2m', beam: 'ashwood_beam_2m', beam1: 'ashwood_beam_1m',
    floor: 'ashwood_floor_2x2', stoneWall: 'Piece_grausten_wall_2x2', stoneWall4: 'Piece_grausten_wall_4x2', stoneFloor: 'Piece_grausten_floor_2x2',
    stoneBlock: 'Piece_grausten_wall_1x2', plinth: 'Piece_grausten_wall_2x2', door: 'ashwood_door', window: 'Piece_grausten_window_2x2',
    gable26: 'ashwood_wall_roof_26', gable45: 'ashwood_wall_roof_45',
  },
};

// Merge kits up to the biome so later biomes keep earlier pieces they do not replace.
function kitFor(biome) {
  const out = {};
  for (const b of BIOMES) {
    Object.assign(out, BIOME_KIT[b]);
    if (b === biome) break;
  }
  return out;
}

// Culture: how a building is put together. Numbers from the corpus shell stats per culture (rules.json "cultures").
const CULTURES = {
  'norse': {
    label: 'Norse', roof: 'gable', pitch: 45, eaves: 1, frame: true, plinth: 'byBiome', porch: 0.5, dragons: true,
    note: 'Steep thatch or darkwood gable, timber frame with posts at every bay, dragon heads on the ridge of halls.',
  },
  'black-forest': {
    label: 'Black Forest log', roof: 'gable', pitch: 45, eaves: 1, frame: true, logWalls: true, plinth: 'stone', porch: 0.6,
    note: 'Log walls on a stone footing, steep roof, short porch.',
  },
  'swamp': {
    label: 'Swamp stilt', roof: 'gable', pitch: 26, eaves: 2, frame: true, stilts: 1.6, porch: 0.9, ironTrim: true,
    note: 'Raised on darkwood stilts with a deck all round, low wide darkwood roof, iron trim.',
  },
  'mountain': {
    label: 'Mountain lodge', roof: 'gable', pitch: 45, eaves: 1, frame: true, plinth: 'stone', plinthHigh: true, porch: 0.3, glass: true,
    note: 'Tall stone base against the snow, steep roof, glass windows.',
  },
  'middle-eastern': {
    label: 'Desert / Middle Eastern', roof: 'flat', parapet: true, frame: false, stoneWalls: true, arches: true, courtyard: true,
    awnings: true, rugs: 2, note: 'Flat roofs with parapets, thick stone walls, arched doors, cloth awnings and a courtyard.',
  },
  'east-asian': {
    label: 'East Asian', roof: 'gable', pitch: 26, eaves: 2, frame: true, raised: 0.5, darkFrame: true, lanterns: true, porch: 1,
    note: 'Raised floor, dark timber grid on light walls, wide low eaves, lanterns.',
  },
  'castle-medieval': {
    label: 'Medieval', roof: 'gable', pitch: 45, eaves: 1, frame: true, stoneGround: true, jetty: true, porch: 0.2,
    note: 'Stone ground floor, timber upper floor set out over the street, steep roof.',
  },
  'dwarven': {
    label: 'Dwarven', roof: 'flat', parapet: true, frame: false, stoneWalls: true, arches: true, lanterns: true,
    note: 'Heavy stone or black marble blocks, flat roofs, arches, many lanterns.',
  },
  'celtic': {
    label: 'Celtic round', roof: 'conical', pitch: 45, eaves: 1, frame: true, round: true, porch: 0,
    note: 'Round house of eight walls under a ring of thatch, one door, fire in the middle.',
  },
  'slavic': {
    label: 'Slavic log', roof: 'gable', pitch: 45, eaves: 1, frame: false, logWalls: true, plinth: 'stone', porch: 0.8, carved: true,
    note: 'Log house on a stone footing, covered porch, carved ridge.',
  },
};

// Which culture a biome leans to when none is asked for.
const BIOME_CULTURE = {
  'Meadows': 'norse', 'Black Forest': 'black-forest', 'Swamp': 'swamp', 'Mountain': 'mountain', 'Plains': 'norse',
  'Mistlands': 'dwarven', 'Ashlands': 'castle-medieval',
};

// Building types: footprint in 2 m bays per stage (from the corpus shell numbers, scaled to one building without its
// yard), storeys, and how it opens.
const TYPES = {
  home:      { label: 'House', bays: { s1: [3, 2], s2: [4, 3], s3: [5, 4] }, storeys: { s1: 1, s2: 1, s3: 2 }, use: 'home' },
  longhouse: { label: 'Longhouse', bays: { s1: [6, 3], s2: [8, 4], s3: [11, 5] }, storeys: { s1: 1, s2: 1, s3: 1 }, tall: 1, use: 'hall', aisles: true },
  tavern:    { label: 'Tavern', bays: { s1: [5, 4], s2: [7, 4], s3: [8, 5] }, storeys: { s1: 1, s2: 2, s3: 2 }, use: 'hall' },
  smithy:    { label: 'Smithy', bays: { s1: [3, 2], s2: [4, 3], s3: [5, 4] }, storeys: { s1: 1, s2: 1, s3: 1 }, open: 'front', use: 'smithy' },
  sawmill:   { label: 'Woodworker', bays: { s1: [3, 2], s2: [4, 3], s3: [6, 3] }, storeys: { s1: 1, s2: 1, s3: 1 }, open: 'sides', use: 'workshop' },
  workshop:  { label: 'Workshop', bays: { s1: [3, 3], s2: [4, 3], s3: [5, 4] }, storeys: { s1: 1, s2: 1, s3: 2 }, use: 'workshop' },
  barn:      { label: 'Barn and pen', bays: { s1: [3, 3], s2: [5, 4], s3: [6, 5] }, storeys: { s1: 1, s2: 1, s3: 1 }, tall: 1, use: 'farm', pen: true, bigDoor: true },
  farm:      { label: 'Crop farm', bays: { s1: [2, 2], s2: [3, 2], s3: [4, 3] }, storeys: { s1: 1, s2: 1, s3: 1 }, use: 'farm', field: true },
  storage:   { label: 'Storehouse', bays: { s1: [2, 2], s2: [3, 3], s3: [5, 3] }, storeys: { s1: 1, s2: 1, s3: 2 }, use: 'storage', raised: 0.5 },
  tower:     { label: 'Watchtower', bays: { s1: [2, 3], s2: [3, 3], s3: [3, 3] }, storeys: { s1: 3, s2: 4, s3: 5 }, use: 'guard', tower: true },
  dock:      { label: 'Dock and boathouse', bays: { s1: [3, 2], s2: [4, 3], s3: [6, 4] }, storeys: { s1: 1, s2: 1, s3: 1 }, use: 'workshop', dock: true, open: 'front' },
  stall:     { label: 'Market stall', bays: { s1: [2, 1], s2: [3, 2], s3: [4, 2] }, storeys: { s1: 1, s2: 1, s3: 1 }, use: 'market', open: 'all', low: true },
  temple:    { label: 'Temple', bays: { s1: [3, 2], s2: [5, 3], s3: [7, 4] }, storeys: { s1: 1, s2: 1, s3: 1 }, tall: 2, use: 'temple' },
  well:      { label: 'Well', bays: { s1: [1, 1], s2: [1, 1], s3: [2, 2] }, storeys: { s1: 1, s2: 1, s3: 1 }, use: 'yard', well: true, open: 'all', low: true },
  camp:      { label: 'Camp', bays: { s1: [2, 2], s2: [3, 2], s3: [3, 3] }, storeys: { s1: 1, s2: 1, s3: 1 }, use: 'yard', camp: true },
};

if (typeof module !== 'undefined') module.exports = { BIOMES, kitFor, CULTURES, BIOME_CULTURE, TYPES };
else window.VHStyles = { BIOMES, kitFor, CULTURES, BIOME_CULTURE, TYPES };
