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
  // Dark wood pieces take tar, so they start in the Plains (Tyler, 2026-11-09); the Swamp adds iron.
  'Swamp': { ironBeam: 'woodiron_beam', ironPole: 'woodiron_pole' },
  'Mountain': { window: 'crystal_wall_1x1', glass: 'crystal_wall_1x1' },
  'Plains': {
    pole: 'darkwood_pole', poleLong: 'darkwood_pole4', beam: 'darkwood_beam', beamLong: 'darkwood_beam4x4',
    roof26: 'darkwood_roof', roof45: 'darkwood_roof_45', roofTop26: 'darkwood_roof_top', roofTop45: 'darkwood_roof_top_45',
    decowall: 'darkwood_decowall',
  },
  'Mistlands': {
    wall: 'blackmarble_2x1x1', stoneWall: 'blackmarble_2x1x1', stoneBlock: 'blackmarble_1x1', stoneFloor: 'blackmarble_floor',
    stonePillar: 'blackmarble_column_1', stoneArch: 'blackmarble_arch', plinth: 'blackmarble_2x1x1',
  },
  'Ashlands': {
    wall: 'ashwood_wall_2x2', pole: 'ashwood_pole_2m', poleLong: 'ashwood_pole_2m', beam: 'ashwood_beam_2m', beam1: 'ashwood_beam_1m',
    floor: 'ashwood_floor_2x2', stoneWall: 'Piece_grausten_wall_2x2', stoneWall4: 'Piece_grausten_wall_4x2', stoneFloor: 'Piece_grausten_floor_2x2',
    stoneBlock: 'Piece_grausten_wall_1x2', plinth: 'Piece_grausten_wall_2x2', window: 'Piece_grausten_window_2x2',
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

// Roof sets a culture can ask for whatever its biome's kit has: thatch (reed, straw, and the stand-in for turf and
// felt) and dark wood (shingle, slate, lead and tile stand-in; Plains on, as dark wood takes tar).
const ROOF_SETS = {
  thatch: { roof26: 'wood_roof', roof45: 'wood_roof_45', roofTop26: 'wood_roof_top', roofTop45: 'wood_roof_top_45' },
  dark: { roof26: 'darkwood_roof', roof45: 'darkwood_roof_45', roofTop26: 'darkwood_roof_top', roofTop45: 'darkwood_roof_top_45' },
};

// Culture ids that have changed or may change: the id lives here once; a renamed id goes in RENAMED so old requests
// still work. The Mistlands tower culture was 'caucasian-highland' until Tyler named it Lamari (D-046, after Lamaria,
// the Svan hearth goddess).
const ID = { lamari: 'lamari' };
const RENAMED = { 'caucasian-highland': ID.lamari }; // old id: new id

// Culture: how a building is put together. The first block are the village cultures Tyler approved (2026-11-08),
// with the shapes and sizes in docs/CULTURE_STYLES.md. The older lab styles after them stay for the request page
// and the review set; villages do not use them.
//
// Fields the generator reads:
//   roof, pitch, eaves     main roof form, 26 or 45 degrees, eaves rows (2 = one row past the wall, roof to the ground)
//   roofs, walls, plans    weights: roof kinds; wall styles; plan per type and stage ({ home: { s1: { rect: 1 } } })
//   roofSet                'thatch' or 'dark' whatever the biome kit has (dark falls back to thatch before the Plains)
//   forms                  building type to a special form: round, tent, yurt, gables, court, keep, svan, tower-svan,
//                          dome, drum, stave, sunken, open, raised (see generate.js)
//   frame, logWalls, plinth, stilts, stiltH, deck, raised, podklet, porch, dragons, carved, glass, arches, parapet,
//   stoneWalls, courtyard, awnings, opposedDoors, clothDoor, boardwalk, frontWood, buttress
//   size                   per type: octagon side in metres for round forms ({ home: { s1: 2, s2: 4 } })
//   sample                 the types drawn for the culture's overview sheet
const CULTURES = {
  'norse': {
    label: 'Norse', village: true, biomes: ['Meadows'], roof: 'gable', pitch: 45, eaves: 1, frame: true, plinth: 'byBiome', porch: 0.5, dragons: true,
    sample: ['home', 'longhouse', 'smithy'],
    note: 'Steep thatch or darkwood gable, timber frame with posts at every bay, dragon heads on the ridge of halls.',
  },
  'anglo-saxon': {
    label: 'Anglo-Saxon', village: true, biomes: ['Meadows'], roof: 'gable', pitch: 45, eaves: 1, frame: true, porch: 0, opposedDoors: true,
    roofs: { gable: 3, hip: 2 }, walls: { plank: 3, 'half-timber': 1 },
    plans: { home: { s1: { rect: 1 }, s2: { rect: 3, long: 1 }, s3: { long: 2, rect: 1 } }, longhouse: { s1: { long: 1 }, s2: { long: 1 }, s3: { long: 1 } }, temple: { s1: { nave: 1 }, s2: { nave: 1 }, s3: { nave: 1 } } },
    forms: { workshop: 'sunken', sawmill: 'sunken', smithy: 'sunken', storage: 'sunken' },
    sample: ['home', 'longhouse', 'workshop'],
    note: 'Straight-walled timber halls with doors in the middle of both long sides, thatched gable or hip roofs, sunken huts for work.',
  },
  'frankish-norman': {
    label: 'Frankish-Norman', village: true, biomes: ['Meadows'], roof: 'gable', pitch: 45, eaves: 1, frame: true, porch: 0.3,
    roofs: { gable: 5, hip: 1 }, walls: { 'half-timber': 3, plank: 1, 'stone-base': 2, stone: 1 }, buttress: true,
    plans: { home: { s1: { rect: 1 }, s2: { rect: 2, L: 1 }, s3: { L: 2, T: 1 } }, temple: { s1: { nave: 1 }, s2: { nave: 1 }, s3: { nave: 1 } } },
    forms: { tower: 'keep' },
    sample: ['home', 'tower', 'tower@Black Forest', 'workshop'],
    note: 'Timber-framed houses along a street, a keep of timber (Meadows) or stone (later biomes) with flat buttresses and a parapet.',
  },
  'norse-forest': {
    label: 'Norse forest (stave and log)', village: true, biomes: ['Black Forest'], roof: 'gable', pitch: 45, eaves: 1, frame: false, logWalls: true,
    plinth: 'stone', porch: 0.6, dragons: true, carved: true, roofs: { gable: 6, hip: 1 }, walls: { log: 4, plank: 1 },
    forms: { temple: 'stave', storage: 'raised' },
    sample: ['home', 'temple', 'storage'],
    note: 'Log houses on a stone course, raised log storehouses, stave churches with a low gallery roof all round and dragon heads.',
  },
  'celtic': {
    label: 'Celtic (Irish, Scots, Welsh)', village: true, biomes: ['Black Forest'], roof: 'conical', pitch: 45, eaves: 1, frame: true, porch: 0,
    walls: { 'stone-base': 2, stone: 1, plank: 2 },
    forms: { home: 'round', longhouse: 'round', tavern: 'round', smithy: 'round', workshop: 'round', barn: 'round', tower: 'round' },
    plans: { temple: { s1: { rect: 1 }, s2: { nave: 1 }, s3: { nave: 1 } } },
    size: { home: { s1: 2, s2: 4, s3: 4 }, longhouse: { s1: 4, s2: 4, s3: 6 }, tavern: { s1: 4, s2: 4, s3: 6 }, smithy: { s1: 2, s2: 2, s3: 4 },
      workshop: { s1: 2, s2: 2, s3: 4 }, barn: { s1: 4, s2: 4, s3: 4 }, tower: { s1: 2, s2: 2, s3: 2 } },
    sample: ['home', 'longhouse', 'smithy'],
    note: 'Round houses of eight walls under a steep cone of thatch, one door, fire in the middle; tall round stone towers.',
  },
  'slavic': {
    label: 'Slavic (early Rus)', village: true, biomes: ['Black Forest'], roof: 'gable', pitch: 45, eaves: 1, frame: false, logWalls: true, plinth: 'stone',
    porch: 0.8, carved: true, podklet: true, roofs: { gable: 5, hip: 1 }, walls: { log: 1 }, forms: { storage: 'raised' },
    sample: ['home', 'longhouse', 'storage'],
    note: 'Log izba with a steep gable and carved ridge; larger houses stand on a log ground storey (podklet) reached by an outside stair.',
  },
  'celtic-crannog': {
    label: 'Crannog (lake dwellers)', village: true, biomes: ['Swamp'], roof: 'conical', pitch: 45, eaves: 1, frame: true, porch: 0,
    roofSet: 'thatch', stilts: 1, stiltH: 2, deck: 3, boardwalk: true, walls: { plank: 3, 'half-timber': 1 },
    forms: { home: 'round', longhouse: 'round', tavern: 'round', workshop: 'round', smithy: 'round', storage: 'round', temple: 'round' },
    size: { home: { s1: 2, s2: 4, s3: 4 }, longhouse: { s1: 4, s2: 4, s3: 6 }, tavern: { s1: 4, s2: 4, s3: 6 }, workshop: { s1: 2, s2: 2, s3: 4 },
      smithy: { s1: 2, s2: 2, s3: 4 }, storage: { s1: 2, s2: 2, s3: 2 }, temple: { s1: 2, s2: 4, s3: 4 } },
    sample: ['home', 'longhouse', 'workshop'],
    note: 'Round thatched houses on a timber platform over water, a deck round the house and a walkway to the shore.',
  },
  'baltic': {
    label: 'Baltic (lake fort)', village: true, biomes: ['Swamp'], roof: 'gable', pitch: 45, eaves: 1, frame: false, logWalls: true, porch: 0.5,
    roofSet: 'thatch', stilts: 1, stiltH: 1, deck: 2, roofs: { gable: 3, hip: 2 }, walls: { log: 1 },
    forms: { storage: 'raised' }, plans: { longhouse: { s1: { long: 1 }, s2: { long: 1 }, s3: { long: 1 } } },
    sample: ['home', 'longhouse', 'storage'],
    note: 'Log houses packed on a timber platform in a lake, steep thatch, granaries raised on posts.',
  },
  'fen-folk': {
    label: 'Fen folk (Frisian and fenland)', village: true, biomes: ['Swamp'], roof: 'hip', pitch: 45, eaves: 2, frame: true, porch: 0,
    roofSet: 'thatch', raised: 1, stiltChance: 0.4, boardwalk: true, kick: true, roofs: { hip: 4, gable: 1 }, walls: { plank: 2, 'half-timber': 2 },
    plans: { home: { s1: { rect: 1 }, s2: { long: 2, rect: 1 }, s3: { long: 1 } }, longhouse: { s1: { long: 1 }, s2: { long: 1 }, s3: { long: 1 } } },
    forms: { storage: 'open' },
    sample: ['home', 'longhouse', 'workshop'],
    note: 'Long low byre-houses on raised ground with hipped reed roofs coming down near the ground, timber trackways between them.',
  },
  'norse-highland': {
    label: 'Norse highland (Icelandic turf)', village: true, biomes: ['Mountain'], roof: 'gable', pitch: 45, eaves: 1, frame: false, porch: 0,
    roofSet: 'thatch', frontWood: true, walls: { stone: 1 },
    forms: { home: 'gables', longhouse: 'gables', tavern: 'gables', temple: 'gables', storage: 'gables', workshop: 'gables', smithy: 'gables', barn: 'gables' },
    sample: ['home', 'longhouse', 'storage'],
    note: 'Low thick stone walls under a steep roof (thatch stands in for turf), wooden gable fronts in a row facing the yard.',
  },
  'saami': {
    label: 'Saami', village: true, biomes: ['Mountain'], roof: 'conical', pitch: 45, eaves: 1, frame: false, porch: 0, roofSet: 'thatch',
    walls: { stone: 1 }, storeH: 2, typeWalls: { storage: 'log' }, roofs: { gable: 1 }, storeys: { storage: { s1: 1, s2: 1, s3: 1 } },
    bays: { storage: { s1: [2, 3], s2: [2, 3], s3: [3, 3] } },
    forms: { home: 'round', longhouse: 'round', tavern: 'round', workshop: 'tent', smithy: 'tent', storage: 'raised', temple: 'tent', barn: 'tent', camp: 'tent' },
    size: { home: { s1: 2, s2: 2, s3: 2 }, longhouse: { s1: 2, s2: 4, s3: 4 }, tavern: { s1: 2, s2: 4, s3: 4 }, workshop: { s1: 2, s2: 2, s3: 2 },
      smithy: { s1: 2, s2: 2, s3: 2 }, temple: { s1: 2, s2: 2, s3: 2 }, barn: { s1: 2, s2: 2, s3: 2 }, camp: { s1: 2, s2: 2, s3: 2 } },
    sample: ['home', 'longhouse', 'storage', 'workshop'],
    note: 'Goahti: low round huts with a stone and turf wall and a cone with a smoke hole; lavvu tents; small storehouses high on posts.',
  },
  'byzantine': {
    label: 'Byzantine', village: true, biomes: ['Plains', 'Mistlands'], roof: 'gable', pitch: 26, eaves: 1, frame: false, porch: 0.2,
    roofSet: 'dark', stoneWalls: true, arches: true, storeyH: 3, roofs: { gable: 3, hip: 2 }, walls: { stone: 4, 'stone-base': 1 },
    plans: { home: { s1: { rect: 1 }, s2: { rect: 2, L: 2 }, s3: { L: 2, U: 1 } } },
    forms: { temple: 'dome' }, storeys: { home: { s1: 1, s2: 2, s3: 2 } },
    sample: ['home', 'temple', 'temple@Mistlands', 'workshop'],
    note: 'Stone houses of one or two storeys under low tile roofs; cross-in-square churches with a dome on a drum over four columns.',
  },
  'steppe': {
    label: 'Steppe (Khazar and Turkic camps)', village: true, biomes: ['Plains'], roof: 'conical', pitch: 26, eaves: 1, frame: false, porch: 0,
    roofSet: 'thatch', clothDoor: true, walls: { 'half-timber': 1 },
    forms: { home: 'yurt', longhouse: 'yurt', tavern: 'yurt', temple: 'yurt', storage: 'yurt', workshop: 'open', smithy: 'open', sawmill: 'open' },
    size: { home: { s1: 4, s2: 4, s3: 4 }, longhouse: { s1: 4, s2: 6, s3: 6 }, tavern: { s1: 4, s2: 4, s3: 6 }, temple: { s1: 4, s2: 4, s3: 4 }, storage: { s1: 2, s2: 2, s3: 2 } },
    sample: ['home', 'longhouse', 'workshop'],
    note: 'Round felt tents on a lattice wall under a low cone with an open crown; open sunshades for work.',
  },
  [ID.lamari]: {
    label: 'Lamari', village: true, biomes: ['Mistlands'], roof: 'gable', pitch: 26, eaves: 1, frame: false, porch: 0,
    roofSet: 'dark', stoneWalls: true, storeyH: 3, roofs: { gable: 4, hip: 1 }, walls: { stone: 1 },
    forms: { home: 'svan', tower: 'tower-svan', temple: 'drum' }, storeys: { home: { s1: 1, s2: 2, s3: 2 } },
    sample: ['home', 'tower', 'temple', 'workshop'],
    note: 'Two-storey stone houses with a tall square tower beside them, low slate roofs, hall churches with a drum and a cone.',
  },
  'middle-eastern': {
    label: 'Middle Eastern (Persian and Arab)', village: true, biomes: ['Plains'], roof: 'flat', parapet: true, frame: false, stoneWalls: true, arches: true,
    courtyard: true, awnings: true, rugs: 2, clothDoor: true, forms: { tavern: { s2: 'court', s3: 'court' }, home: { s3: 'court' } },
    plans: { home: { s1: { rect: 1 }, s2: { U: 2, rect: 1 } } },
    sample: ['home', 'tavern', 'workshop'],
    note: 'Flat roofs with parapets, thick stone walls, arched doors, cloth awnings; houses and caravanserais round a courtyard with an arcade.',
  },
  // ---- older lab styles (not village cultures)
  'black-forest': {
    label: 'Black Forest log (lab)', roof: 'gable', pitch: 45, eaves: 1, frame: true, logWalls: true, plinth: 'stone', porch: 0.6,
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
  'east-asian': {
    label: 'East Asian (lab)', roof: 'gable', pitch: 26, eaves: 2, frame: true, raised: 0.5, darkFrame: true, lanterns: true, porch: 1,
    note: 'Raised floor, dark timber grid on light walls, wide low eaves, lanterns.',
  },
  'castle-medieval': {
    label: 'Medieval (lab)', roof: 'gable', pitch: 45, eaves: 1, frame: true, stoneGround: true, jetty: true, porch: 0.2,
    note: 'Stone ground floor, timber upper floor set out over the street, steep roof.',
  },
  'dwarven': {
    label: 'Dwarven (lab)', roof: 'flat', parapet: true, frame: false, stoneWalls: true, arches: true, lanterns: true,
    note: 'Heavy stone or black marble blocks, flat roofs, arches, many lanterns.',
  },
};

// Cultures a biome's villages come from when none is asked for, with weights (provisional, Tyler 2026-11-08; Mountain even, D-039). Up to
// three per biome. Ashlands has no approved culture yet and keeps the lab's medieval style.
const BIOME_CULTURE = {
  'Meadows': { 'norse': 5, 'anglo-saxon': 3, 'frankish-norman': 2 },
  'Black Forest': { 'norse-forest': 5, 'celtic': 3, 'slavic': 3 },
  'Swamp': { 'celtic-crannog': 3, 'baltic': 3, 'fen-folk': 3 },
  'Mountain': { 'norse-highland': 1, 'saami': 1 },
  'Plains': { 'middle-eastern': 3, 'byzantine': 3, 'steppe': 3 },
  'Mistlands': { 'byzantine': 3, [ID.lamari]: 4 },
  'Ashlands': { 'castle-medieval': 1 },
};

// A culture key as asked, an old key renamed since, or null.
function cultureKey(k) {
  if (!k) return null;
  const key = RENAMED[k] || k;
  return CULTURES[key] ? key : null;
}

// A culture for a biome: weighted by BIOME_CULTURE, R a random source (0..1). Without R, the heaviest.
function cultureFor(biome, R) {
  const w = BIOME_CULTURE[biome] || BIOME_CULTURE.Meadows;
  const e = Object.entries(w);
  if (!R) return e.sort((a, b) => b[1] - a[1])[0][0];
  let x = R() * e.reduce((s, [, v]) => s + v, 0);
  for (const [k, v] of e) if ((x -= v) <= 0) return k;
  return e[0][0];
}

// Roof pieces for a culture in a biome: the kit's own, or the culture's roof set where the biome has it.
function roofKit(K, C, biome) {
  const order = BIOMES.indexOf(biome);
  if (C.roofSet === 'thatch') return { ...K, ...ROOF_SETS.thatch };
  if (C.roofSet === 'dark') return { ...K, ...(order >= BIOMES.indexOf('Plains') ? ROOF_SETS.dark : ROOF_SETS.thatch) };
  return K;
}

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

// ---------------------------------------------------------------- massing: shapes, sizes and growth (D-069, D-068)
//
// A building belongs to a household and grows from its own earlier stage: its s2 keeps the s1 shell and adds to it,
// its s3 keeps the s2. generate.js draws the whole path (s1, s2, s3) from the household's own random stream
// (req.lineage, the seed by default), then builds the stage asked for. req.fresh asks for a plan drawn anew at each
// stage, as before. See docs/BLUEPRINT_LAB.md, "Massing".

// Household sizes for homes: the main wing in 2 m bays, [along the ridge, across], with odds, and the most wings the
// house ever gets (a one-person house stays small). The depth across stays odd under a pitched roof.
const HOUSEHOLDS = {
  cozy: { label: 'one person', weight: 3, bays: { '3x3': 1, '4x3': 2 }, wings: 1 },
  couple: { label: 'two people', weight: 4, bays: { '4x3': 2, '5x3': 2 }, wings: 2 },
  family: { label: 'a family', weight: 3, bays: { '5x3': 2, '6x3': 2, '4x5': 1, '5x5': 1 }, wings: 3 },
};

// The complexity ladder: what a building may have at each stage, at most. wings counts side rooms, annexes,
// extensions and wings together; at s1 only a narrow side room or an annex. extras: porch, lean-to, balcony, dormers,
// a tower. roof: plain is one main ridge (a side room or byre has its own lower roof); crossed allows ridges meeting at
// valleys; any allows towers and more.
const LADDER = {
  s1: { wings: 1, storeys: 1, extras: 1, roof: 'plain', note: 'One room or two, one storey, one main ridge; a side room or a byre at one end at most.' },
  s2: { wings: 2, storeys: 2, extras: 2, roof: 'crossed', note: 'A wing or a longer hall; a second storey is uncommon; a porch or a lean-to.' },
  s3: { wings: 3, storeys: 3, extras: 3, roof: 'any', note: 'Branching wings, two storeys common, three rare (deep houses only); balconies, dormers, towers on halls.' },
};

// Growth steps. Start shapes (s1): rect (one room under one ridge), long (one bay longer each end), side (a narrow side
// room at one end, toward the front), back (the same toward the back), annex (a lower byre or store in line at one
// end), round (a round house; it stays round). Steps (s2, s3): keep, L (a wing at one end, toward the front), back (a
// wing at one end, toward the back), T (a wing from the middle of the back), cross (the T wing run through to the
// front, or a new wing through the middle), U (wings at both ends, toward the front), annex, long, extend (two bays
// more at one end under the same roof).
// storey: the odds of one more storey at s2 and at s3 (third: of a third at s3, deep houses with two at s2 only);
// one-person houses take half the odds, families half again as much.
// extras: the odds a stage adds each, s1 to s3 (kept once built). Per type, with a culture's own set for its homes.
const GROWTH = {
  home: {
    s1: { rect: 7, side: 1.5, annex: 1, back: 0.5 },
    s2: { keep: 1.5, L: 3, T: 2, annex: 1, back: 1, extend: 1.5 },
    s3: { keep: 0.5, L: 2, T: 2, cross: 1.5, U: 1, annex: 1, back: 1, extend: 1 },
    storey: { s2: 0.1, s3: 0.5, third: 0.5 }, extras: { porch: [0.1, 0.2, 0.3], outshut: [0, 0.35, 0.25], balcony: [0, 0.5, 0.5], tower: [0, 0, 0.2] },
  },
  longhouse: { s1: { rect: 1 }, s2: { keep: 0.5, long: 2, extend: 2, annex: 1, T: 1 }, s3: { keep: 0.5, long: 1.5, extend: 1.5, T: 2, cross: 1, annex: 1 },
    storey: { s2: 0, s3: 0 }, extras: { porch: [0, 0.3, 0.3], outshut: [0, 0.4, 0.2], tower: [0, 0, 0.35] } },
  tavern: { s1: { rect: 3, side: 1 }, s2: { keep: 1, L: 2, T: 2, extend: 1 }, s3: { keep: 0.5, T: 2, cross: 1, U: 1, L: 1, extend: 1 },
    storey: { s2: 0.5, s3: 0.6 }, extras: { porch: [0, 0.3, 0.3], outshut: [0, 0.3, 0.2], balcony: [0, 0.5, 0.5], tower: [0, 0, 0.35] } },
  smithy: { s1: { rect: 3, side: 1 }, s2: { keep: 0.5, L: 1, T: 1, back: 1, extend: 1.5, long: 1 }, s3: { keep: 0.5, L: 2, T: 2, U: 1, extend: 1, long: 1 },
    storey: { s2: 0, s3: 0 }, extras: { outshut: [0, 0.4, 0.3] } },
  sawmill: { s1: { rect: 1 }, s2: { keep: 0.5, L: 1, long: 1.5, extend: 1 }, s3: { keep: 0.5, L: 1, long: 1, extend: 1 }, storey: { s2: 0, s3: 0 }, extras: {} },
  workshop: { s1: { rect: 3, side: 1 }, s2: { keep: 0.5, L: 1, back: 1, extend: 1.5, long: 1 }, s3: { keep: 0.5, L: 2, T: 1, extend: 1, long: 1 },
    storey: { s2: 0, s3: 0.5 }, extras: { outshut: [0, 0.4, 0.3], balcony: [0, 0.4, 0.4] } },
  storage: { s1: { rect: 1 }, s2: { keep: 1, L: 1, long: 1.5, extend: 1 }, s3: { keep: 0.5, L: 1, T: 1, extend: 1, long: 1 }, storey: { s2: 0, s3: 0.5 }, extras: { outshut: [0, 0.4, 0.3] } },
  // a crop farm's field lies in front of its door: it grows back and to the side
  farm: { s1: { rect: 1 }, s2: { keep: 1, long: 1, extend: 1 }, s3: { keep: 1, extend: 1, back: 1, T: 1 }, storey: { s2: 0, s3: 0 }, extras: { outshut: [0, 0.3, 0.3] } },
  barn: { s1: { rect: 1 }, s2: { keep: 0.5, long: 2, extend: 1.5 }, s3: { keep: 0.5, long: 1.5, extend: 1.5, L: 1, T: 0.5 }, storey: { s2: 0, s3: 0 }, extras: { outshut: [0, 0.4, 0.3] } },
};
// A culture's plan set for its homes: start and step odds that replace the type's, and its storey odds. Norse build
// in lines, L, T and cross (Meadows Norse never round, Tyler 2026-11-09; forest Norse seldom); Anglo-Saxons in long straight halls; Frankish town houses rise to two
// storeys early and turn L and T; Slavs and fen folk add rooms in line; Byzantine houses wrap a yard (L, then U).
const PLAN_SETS = {
  'norse': { s1: { rect: 6, side: 2, annex: 1, back: 0.5 }, s2: { keep: 1.5, L: 3, T: 2.5, annex: 1, back: 1, extend: 1 },
    s3: { keep: 1, L: 1.5, T: 2.5, cross: 2, U: 0.5, annex: 0.5, back: 1, extend: 0.5 } },
  'anglo-saxon': { s1: { rect: 5, long: 2, annex: 1.5 }, s2: { keep: 2, long: 2, extend: 2, annex: 2, T: 0.5, L: 0.5 },
    s3: { keep: 1.5, long: 1.5, extend: 1.5, annex: 1, T: 1, L: 1, cross: 0.5 } },
  'frankish-norman': { s1: { rect: 6, side: 1, back: 1 }, s2: { keep: 2, L: 3, back: 1.5, annex: 1, T: 1, extend: 1 }, s3: { keep: 1, L: 2, T: 2, U: 1, cross: 1 },
    storey: { s2: 0.25, s3: 0.6, third: 0.5 } },
  'norse-forest': { s1: { rect: 6, side: 2, annex: 1, back: 0.5, round: 0.3 }, s2: { keep: 1.5, L: 3, T: 2, annex: 1, back: 1, extend: 1 },
    s3: { keep: 1, L: 1.5, T: 2, cross: 1.5, U: 0.5, annex: 0.5, back: 1, extend: 0.5 } },
  'slavic': { s1: { rect: 6, annex: 2, side: 0.5 }, s2: { keep: 2, annex: 2, extend: 1.5, long: 1, L: 2, T: 1 }, s3: { keep: 1, L: 2, T: 2, cross: 1.5, annex: 1, extend: 1 } },
  'baltic': { s1: { rect: 7, long: 1 }, s2: { keep: 2, long: 1, extend: 1, L: 2, T: 1 }, s3: { keep: 1, L: 2, T: 2, cross: 1.5, long: 1, extend: 1 } },
  'fen-folk': { s1: { rect: 5, long: 3 }, s2: { keep: 2, long: 3, extend: 2, annex: 1, L: 1 }, s3: { keep: 1, long: 2, extend: 2, L: 2, T: 1, annex: 1 } },
  'byzantine': { s1: { rect: 6, side: 1 }, s2: { keep: 2, L: 3, back: 1 }, s3: { keep: 1, L: 1, U: 2, T: 1.5 } },
  'middle-eastern': { s1: { rect: 7, side: 1 }, s2: { keep: 1, U: 2, L: 2 }, s3: { keep: 1, U: 1, L: 1, T: 1 } },
};
// The plan set for a culture and type: the culture's own for homes, else the type's.
function growthFor(cultureKey, type) {
  const g = GROWTH[type];
  if (!g) return null;
  const own = type === 'home' && PLAN_SETS[cultureKey];
  return own ? { ...g, ...own, storey: own.storey || g.storey, extras: own.extras || g.extras } : g;
}

const api = { BIOMES, kitFor, CULTURES, BIOME_CULTURE, TYPES, ROOF_SETS, cultureFor, roofKit, ID, RENAMED, cultureKey,
  HOUSEHOLDS, LADDER, GROWTH, PLAN_SETS, growthFor };
if (typeof module !== 'undefined') module.exports = api;
else window.VHStyles = api;
