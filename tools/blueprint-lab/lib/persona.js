// Households (D-068): the broad preferences of whoever lives in a building, drawn once per design from a random stream
// of its own, so the rest of the design comes out of its own streams as before. The decorator, the interior library,
// the yards and the item stands read their weights from it, so two houses of the same request and size differ the
// way two families do: one tidy and plain, one busy with half-done projects, one with drapes, one with pots on the
// sill. Traits lean by culture and building type; nothing is fixed by them.
//
// A request may name a household (req.persona): a preset name ('neat', 'messy', 'cosy', 'plants', ...), a list of
// them ('neat,plants'), or an object of traits that override the drawn ones.
const NODE_P = typeof module !== 'undefined';

function rngP(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function hashP(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const BIOMES_P = ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains', 'Mistlands', 'Ashlands'];
const tierP = b => Math.max(0, BIOMES_P.indexOf(b));
function pickWP(R, w) {
  const e = Object.entries(w).filter(([, v]) => v > 0), t = e.reduce((s, [, v]) => s + v, 0);
  let x = R() * t;
  for (const [k, v] of e) if ((x -= v) <= 0) return k;
  return e.length ? e[e.length - 1][0] : null;
}

// Households are broad preferences, never a trade (Tyler, 2026-11-09): the villager who lives in a house is chosen in
// the game and can change, so nothing here says "hunter" or "cook". The traits:
//   tidy      how organized the space is: 1 is bed made and chairs pushed in, 0 things left where they were used
//   busy      how actively the space is used: half-done projects, things in use lying about
//   comfort   comfort against austerity: rugs, pelts, a couch, cushioned seats
//   wealth    showing wealth and status against keeping modest
//   size      people in the household: 1 alone, 2 a couple, 3 to 6 a family with children
//   hobby     broad interests shown by what lies about: crafts (making things), collect (collecting and display),
//             plants (growing things), games (games and music), maps (maps and charts), food (food and drink)
//   likes     decor taste: drapes, sill (pots and plants on the sill), rugs (rugs and pelts), banners (banners and
//             color), shelves, lights, hung (things hung up on show); a plain household has them all low
//   yard      'garden' (a tended garden and paths), 'work' (materials and work leftovers), 'plain'
// Role props (a resident's own tools or shield) are left to the game: lib/kitbash.js marks the slots where they could
// go (design.slots) and fills none of them.
const HOBBIES = ['crafts', 'collect', 'plants', 'games', 'maps', 'food'];
// Culture odds (docs/CULTURE_STYLES.md): shifts of tidiness, comfort and wealth, a factor on each hobby's odds, a
// factor on each like, and the odds of each kind of yard.
const CULTURE_P = {
  'norse': { hobby: { collect: 1.3, food: 1.3 }, likes: { banners: 1.2, hung: 1.3, rugs: 1.1 }, yard: { garden: 1, work: 1.4, plain: 1 } },
  'norse-forest': { tidy: -0.05, hobby: { crafts: 1.5 }, likes: { rugs: 1.3, hung: 1.2 }, yard: { garden: 0.7, work: 2, plain: 0.8 } },
  'norse-highland': { comfort: 0.05, hobby: { crafts: 1.2 }, likes: { rugs: 1.4 }, yard: { garden: 1, work: 1.3, plain: 1 } },
  'anglo-saxon': { tidy: 0.05, hobby: { plants: 1.6, food: 1.3 }, likes: { sill: 1.5, drapes: 0.8 }, yard: { garden: 2.2, work: 0.8, plain: 0.6 } },
  'frankish-norman': { tidy: 0.1, wealth: 0.1, hobby: { plants: 1.3, maps: 1.3 }, likes: { drapes: 1.6, banners: 1.3 }, yard: { garden: 2, work: 0.8, plain: 0.8 } },
  'celtic': { tidy: -0.05, hobby: { plants: 1.4, games: 1.3 }, likes: { sill: 1.4, rugs: 1.2 }, yard: { garden: 1.6, work: 1.2, plain: 0.6 } },
  'celtic-crannog': { tidy: -0.1, hobby: { crafts: 1.3 }, likes: { sill: 1.2 }, yard: { garden: 0.6, work: 1.4, plain: 1.4 } },
  'slavic': { hobby: { plants: 1.4, crafts: 1.3, food: 1.2 }, likes: { drapes: 1.2, shelves: 1.3, sill: 1.3 }, yard: { garden: 1.6, work: 1.4, plain: 0.6 } },
  'baltic': { hobby: { crafts: 1.4 }, likes: { shelves: 1.3 }, yard: { garden: 1.2, work: 1.5, plain: 0.8 } },
  'fen-folk': { tidy: -0.15, wealth: -0.1, hobby: { crafts: 1.3 }, likes: { hung: 1.3, rugs: 1.2 }, yard: { garden: 0.7, work: 1.6, plain: 1 } },
  'saami': { tidy: -0.05, wealth: -0.1, comfort: 0.1, hobby: { crafts: 1.5 }, likes: { rugs: 1.9, drapes: 0.4 }, yard: { garden: 0.3, work: 1.6, plain: 1.4 } },
  'byzantine': { tidy: 0.15, wealth: 0.2, comfort: 0.1, hobby: { collect: 1.3, maps: 1.5 }, likes: { drapes: 1.5, banners: 1.4, lights: 1.3 }, yard: { garden: 1.8, work: 0.6, plain: 1 } },
  'steppe': { tidy: -0.05, comfort: 0.1, hobby: { collect: 1.3, games: 1.3 }, likes: { rugs: 2, drapes: 0.4 }, yard: { garden: 0.4, work: 1.4, plain: 1.6 } },
  'lamari': { hobby: { collect: 1.4 }, likes: { hung: 1.4, rugs: 1.3 }, yard: { garden: 1, work: 1.4, plain: 1 } },
  'middle-eastern': { tidy: 0.1, wealth: 0.1, comfort: 0.15, hobby: { food: 1.4, games: 1.3 }, likes: { rugs: 2, drapes: 1.3, lights: 1.2 }, yard: { garden: 1.6, work: 0.8, plain: 1 } },
  'east-asian': { tidy: 0.2, hobby: { plants: 1.6, games: 1.4 }, likes: { sill: 1.4, rugs: 1.3, banners: 0.7 }, yard: { garden: 2, work: 0.6, plain: 1 } },
  'castle-medieval': { tidy: 0.1, wealth: 0.15, hobby: { collect: 1.6, maps: 1.3 }, likes: { banners: 1.8, hung: 1.3, drapes: 1.3 }, yard: { garden: 1.4, work: 1, plain: 1 } },
  'dwarven': { tidy: 0.05, wealth: 0.15, hobby: { crafts: 1.8, collect: 1.3 }, likes: { lights: 1.6, shelves: 1.5 }, yard: { garden: 0.4, work: 1.8, plain: 1 } },
  'swamp': { tidy: -0.1, yard: { garden: 0.6, work: 1.4, plain: 1.2 } },
};
// Building types shift a few traits (a temple is kept, a tavern busy); work buildings keep their own stations and
// props from the decorator, whatever the household is like.
const TYPE_P = { longhouse: { wealth: 0.2 }, temple: { wealth: 0.15, tidy: 0.2 }, tavern: { wealth: 0.1, busy: 0.2 }, storage: { busy: 0.1 },
  barn: { wealth: -0.1, tidy: -0.1 }, farm: { busy: 0.15 }, smithy: { busy: 0.2, tidy: -0.1 }, workshop: { busy: 0.2, tidy: -0.1 }, sawmill: { busy: 0.2 }, dock: { busy: 0.1 } };

// Presets for requests and the bench: each sets some traits.
const PRESETS = {
  neat: { tidy: 0.92, busy: 0.25 }, tidy: { tidy: 0.92 }, orderly: { tidy: 0.92, busy: 0.2 }, messy: { tidy: 0.08, busy: 0.8 }, cluttered: { tidy: 0.12, busy: 0.6 },
  busy: { busy: 0.92 }, projects: { busy: 0.92, tidy: 0.2, hobby: { crafts: 0.9 } },
  wealthy: { wealth: 0.9, comfort: 0.75 }, rich: { wealth: 0.9 }, poor: { wealth: 0.1, comfort: 0.25 }, modest: { wealth: 0.3 },
  cosy: { comfort: 0.9 }, comfort: { comfort: 0.9 }, austere: { comfort: 0.1, likes: { rugs: 0.35, banners: 0.4, drapes: 0.4 } },
  plain: { likes: { banners: 0.35, shelves: 0.45, hung: 0.35, drapes: 0.4, sill: 0.4, rugs: 0.5 } }, bare: { tidy: 0.95, busy: 0.1, likes: { banners: 0.35, shelves: 0.45, hung: 0.35 } },
  alone: { size: 1 }, single: { size: 1 }, couple: { size: 2 }, family: { size: 5 },
  crafts: { hobby: { crafts: 0.95 } }, collector: { hobby: { collect: 0.95 } }, collect: { hobby: { collect: 0.95 } }, plants: { hobby: { plants: 0.95 }, likes: { sill: 1.8, drapes: 0.4 } },
  games: { hobby: { games: 0.95 } }, music: { hobby: { games: 0.95 } }, maps: { hobby: { maps: 0.95 } }, books: { hobby: { maps: 0.95 } }, food: { hobby: { food: 0.95 } },
  drapes: { likes: { drapes: 1.8, sill: 0.3 } }, sill: { likes: { sill: 1.8, drapes: 0.3 } },
  banners: { likes: { banners: 1.8 } }, color: { likes: { banners: 1.8 } }, rugs: { likes: { rugs: 1.8 } }, pelts: { likes: { rugs: 1.8 } },
  garden: { yard: 'garden', hobby: { plants: 0.85 } }, workyard: { yard: 'work' }, plainyard: { yard: 'plain' },
};

/**
 * The household of a design. o: { type, biome, culture (key), seed, persona (request override) }.
 * Traits are 0 to 1; likes are factors round 1 (0.25 to 2.2).
 */
function persona(o) {
  const type = o.type || 'home', biome = o.biome || 'Meadows', culture = o.culture || 'norse';
  const R = rngP(hashP(`${type}|${biome}|${culture}`) ^ Math.imul((o.seed || 1) >>> 0, 2654435761));
  const C = CULTURE_P[culture] || {}, T = TYPE_P[type] || {};
  let over = {};
  if (typeof o.persona === 'string') for (const w of o.persona.split(/[ ,+]+/)) over = merge(over, PRESETS[w.toLowerCase()] || {});
  else if (o.persona && typeof o.persona === 'object') over = o.persona;
  const avg2 = () => (R() + R()) / 2;
  // the draws come in a fixed order whatever is overridden, so one trait asked for leaves the others as drawn
  const P = {
    tidy: clamp(avg2() + (C.tidy || 0) + (T.tidy || 0)),
    busy: clamp(avg2() + (T.busy || 0)),
    comfort: clamp(avg2() + (C.comfort || 0)),
    wealth: clamp(avg2() + (C.wealth || 0) + (T.wealth || 0) + tierP(biome) * 0.02),
    size: type === 'home' ? 1 + Math.floor(R() * 6) : 2 + Math.floor(R() * 5),
  };
  // one or two hobbies stand out; the others stay low
  const hw = Object.fromEntries(HOBBIES.map(h => [h, (C.hobby || {})[h] || 1]));
  const main = pickWP(R, hw), second = R() < 0.55 ? pickWP(R, hw) : null;
  P.hobby = Object.fromEntries(HOBBIES.map(h => [h, +clamp(h === main ? 0.65 + R() * 0.35 : h === second ? 0.4 + R() * 0.35 : R() * 0.3).toFixed(2)]));
  const like = () => 0.5 + R();
  const sillFirst = R() < 0.5 + (P.hobby.plants - 0.3) * 0.5;
  const plainHouse = R() < 0.18;
  const L = C.likes || {};
  P.likes = {
    drapes: (sillFirst ? 0.4 : 1.3) * like() * (L.drapes || 1),
    sill: (sillFirst ? 1.3 : 0.4) * like() * (L.sill || 1),
    rugs: like() * (L.rugs || 1) * (0.7 + P.comfort * 0.6),
    banners: like() * (L.banners || 1),
    shelves: like() * (L.shelves || 1),
    lights: like() * (L.lights || 1),
    hung: like() * (L.hung || 1) * (0.7 + P.hobby.collect * 0.6),
  };
  for (const k of Object.keys(P.likes)) P.likes[k] = +clamp(P.likes[k] * (plainHouse ? 0.45 : 1), 0.25, 2.2).toFixed(2);
  P.yard = pickWP(R, { garden: (C.yard || {}).garden || 1, work: ((C.yard || {}).work || 1) * (0.6 + P.busy * 0.8), plain: ((C.yard || {}).plain || 1) * (0.5 + P.tidy * 0.5) });
  // the override wins
  for (const [k, v] of Object.entries(over)) if (!['likes', 'hobby'].includes(k)) P[k] = v;
  if (over.hobby) Object.assign(P.hobby, over.hobby);
  if (over.likes) Object.assign(P.likes, over.likes);
  if (over.hobby && over.hobby.plants > 0.8 && !over.yard) P.yard = 'garden';
  for (const k of ['tidy', 'busy', 'comfort', 'wealth']) P[k] = +clamp(P[k]).toFixed(2);
  P.clutter = +clamp(0.65 * (1 - P.tidy) + 0.35 * P.busy).toFixed(2);
  P.household = P.size <= 1 ? 'alone' : P.size === 2 ? 'couple' : 'family';
  P.plain = plainHouse;
  P.label = label(P);
  // a stream for the parts that read the household after the design is built (item stands, jitter): by place, so the
  // same stand gets the same item at every decor stage
  P.salt = hashP(`${o.seed || 1}|${type}|${culture}|${biome}`);
  return P;
}
function merge(a, b) {
  const o = { ...a, ...b };
  if (a.likes || b.likes) o.likes = { ...(a.likes || {}), ...(b.likes || {}) };
  if (a.hobby || b.hobby) o.hobby = { ...(a.hobby || {}), ...(b.hobby || {}) };
  return o;
}
function label(P) {
  const t = P.tidy > 0.66 ? 'tidy' : P.tidy < 0.36 ? 'messy' : 'lived-in';
  const w = P.wealth > 0.68 ? 'well-off' : P.wealth < 0.3 ? 'modest' : '';
  const c = P.comfort > 0.7 ? 'cosy' : P.comfort < 0.28 ? 'austere' : '';
  const h = HOBBIES.filter(k => P.hobby[k] >= 0.6).sort((a, b) => P.hobby[b] - P.hobby[a]).slice(0, 2);
  const words = { crafts: 'crafts', collect: 'collects', plants: 'plants', games: 'games', maps: 'maps', food: 'food and drink' };
  return [t, c, w, P.household].filter(Boolean).join(' ') + (h.length ? `, ${h.map(k => words[k]).join(' and ')}` : '') + `, ${P.yard} yard`;
}

// ---------------------------------------------------------------- weights the furnishing reads
// A household's weight on each of the decorator's extras (decorate.js EXTRAS).
function extraWeights(P) {
  if (!P) return null;
  const L = P.likes, H = P.hobby, c = 0.6 + P.clutter * 0.8;
  return {
    trophies: 0.3 + 1.6 * H.collect * L.hung, shelf: L.shelves * c, barrels: c, crates: c * (0.7 + P.busy * 0.6), chest: 0.7 + 0.5 * P.wealth,
    armor: 0.3 + 0.9 * H.collect + 0.6 * P.wealth, fermenter: 0.6 + H.food, seating: 0.5 + P.size * 0.15 + H.games * 0.4, rug: L.rugs, banners: L.banners * (0.6 + P.wealth),
    carving: 0.5 + P.wealth + H.collect * 0.4, torches: L.lights * (0.6 + 0.6 * P.wealth), tabletop: c * (0.6 + H.food * 0.6 + H.games * 0.3),
    tools: 0.3 + 1.4 * H.crafts * L.hung, chart: 0.3 + 1.6 * H.maps, bench: 0.6 + P.size * 0.1, footBench: 0.8 + P.tidy * 0.4,
    doorBench: 1, nook: 0.4 + P.comfort * 0.6 + H.maps * 0.4, groupRug: L.rugs, evenLights: L.lights, storeWall: 0.5 + P.busy + P.clutter * 0.3, ring: 1,
  };
}
// How full the decorator fills a room: a cluttered, busy house a little past the corpus rate, a tidy one short of it.
function fillShare(P) { return P ? 0.82 + 0.36 * P.clutter : 1; }

// What a household hangs between the furniture on a plain wall: a weight per kind of wall dressing.
function wallWeights(P, role) {
  if (!P) return { ledge: 1, banner: 1 };
  const L = P.likes, H = P.hobby, work = ['smithy', 'workshop'].includes(role);
  return {
    ledge: L.shelves * (0.7 + P.clutter * 0.6) * (role === 'temple' ? 0.3 : 1),
    banner: L.banners * (0.5 + P.wealth) * (work ? 0.3 : 1) * (role === 'temple' || role === 'hall' ? 1.6 : 1),
    trophy: (0.15 + 1.5 * H.collect) * L.hung * (work ? 0.4 : 1),
    weapons: (0.1 + 0.7 * H.collect + 0.5 * P.wealth) * L.hung * (role === 'smithy' ? 2 : 1),
    tools: (0.1 + 1.5 * H.crafts + 0.5 * H.plants) * L.hung * (work ? 2 : 0.7),
    candles: (0.25 + P.comfort * 0.6 + L.lights * 0.3) * (role === 'temple' ? 2.5 : 1),
  };
}
// How far apart the household hangs things on a wall (a base gap times this), and how often it leaves a spot bare.
function wallGap(P) { return P ? (0.75 + 0.6 * P.tidy) * (P.plain ? 1.4 : 1) : 1; }
function wallSkip(P) { return P ? 0.05 + 0.3 * P.tidy : 0; }
// Torches: a well-off household lights its walls closer; a modest one makes do.
function torchGap(P) { return P ? 4 * (1.35 - 0.5 * P.wealth) / Math.sqrt(P.likes.lights) : 4; }
// Under the stairs: what a household keeps there.
function underStair(P) {
  if (!P) return { chest: 1 };
  return { chest: 0.6 + P.wealth * 0.6 + P.tidy * 0.3, barrels: 0.5 + P.hobby.food + P.clutter * 0.4, crates: 0.3 + P.busy * 0.8 + P.clutter * 0.4,
    stacked: 0.2 + P.clutter * 0.9, none: 0.15 + P.tidy * 0.7 };
}
// A factor on an interior library assembly by what it holds (lib/kitbash.js slots) and which built kit it is.
function kitWeight(P, a) {
  if (!P) return 1;
  const L = P.likes, H = P.hobby;
  let w = 1;
  const ks = new Set(a.pieces.map(p => p.k));
  if (ks.has('rug')) w *= 0.6 + 0.4 * L.rugs;
  if (ks.has('banner')) w *= 0.5 + 0.5 * L.banners;
  if (ks.has('food')) w *= 0.6 + 0.5 * P.clutter + 0.5 * H.food;
  if (ks.has('candle')) w *= 0.7 + 0.4 * P.comfort;
  if (ks.has('chest') || ks.has('barrel') || ks.has('crate')) w *= 0.6 + 0.5 * P.clutter + 0.3 * P.busy;
  if (ks.has('pot')) w *= 0.6 + 0.6 * H.plants + 0.4 * H.food;
  if (ks.has('itemstand') || ks.has('itemstandh')) w *= (0.6 + 0.8 * H.collect) * Math.min(1.2, L.hung);
  if (ks.has('walllight') || ks.has('floorlight')) w *= 0.6 + 0.4 * L.lights;
  const id = a.id || '';
  if (id === 'BK-drapes') w *= L.drapes;
  if (id === 'BK-sill') w *= L.sill;
  if (/BK-(shelf|wledge)/.test(id)) w *= L.shelves;
  if (id === 'BK-living' || id === 'BK-couch') w *= 0.4 + P.comfort + P.size * 0.05;
  if (id === 'BK-cabinet' || id === 'BK-drawers') w *= 0.6 + P.wealth * 0.5 + P.tidy * 0.4;
  if (id === 'BK-bath') w *= 0.3 + P.wealth * 0.8 + P.comfort * 0.6;
  if (/BK-(kitchen|island|feast)/.test(id)) w *= 0.6 + H.food;
  if (/^BK-dining/.test(id)) w *= 0.7 + P.size * 0.08 + H.games * 0.3;
  if (id === 'BK-sill') w *= 0.4 + H.plants * 1.2;
  if (id === 'BK-pots') w *= 0.2 + H.plants * 1.4 + H.food * 0.3;
  if (id === 'BK-project') w *= (0.1 + H.crafts * 1.4) * (0.4 + P.busy);
  if (id === 'BK-tanning') w *= (0.1 + H.crafts) * (0.5 + 0.5 * L.rugs);
  if (id === 'BK-bedpelt') w *= (0.3 + P.comfort) * L.rugs;
  if (id === 'BK-tablemess') w *= (0.1 + P.clutter * 1.5) * (0.6 + H.food * 0.6);
  if (id === 'BK-tableneat') w *= 0.15 + P.tidy * 1.3;
  if (id === 'BK-clutter') w *= 0.1 + P.busy * P.clutter * 2.2;
  // creative sets name the traits they suit (lab/creative_sets.js): each weighs from 0.3 (the household has none of it)
  // to 1.7 (all of it), by how much the set leans on it
  if (a.traits) for (const [t, k] of Object.entries(a.traits)) {
    const v = t === 'messy' ? P.clutter : t === 'austere' ? 1 - P.comfort : t === 'modest' ? 1 - P.wealth : t in H ? H[t] : P[t];
    if (typeof v === 'number') w *= 1 + k * (1.4 * v - 0.7);
  }
  return w;
}
// How many assemblies a room takes, as a factor on the library's budget.
function kitBudget(P) { return P ? (0.75 + 0.5 * P.clutter + 0.15 * P.wealth) * (P.plain ? 0.75 : 1) : 1; }

// ---------------------------------------------------------------- items on stands
// What builders put on item stands (lab/mine_stands.js over Tyler's corpus, 2026-11-10: 1,559 vanilla builds, 14,787
// stands holding something inside a building). Vanilla item prefabs by the biome a village first has them in, with a
// weight from the number of corpus builds that show each one on a stand. Both stands take trophies, weapons, shields,
// tools, fish and rare things; only the flat stand (itemstandh) takes meads and food in the corpus (Item Stand page of
// the Valheim wiki: meads on the horizontal stand only; honey, gems and valuables such as rubies and amber on neither).
// src/Villheim.Logic/Designs/StandItems.cs leaves a stand empty when ItemStand.CanAttach refuses the item. Deep North
// names are the wiki's (Trophies page).
const BIOMES_I = ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains', 'Mistlands', 'Ashlands', 'Deep North'];
const tierI = b => Math.max(0, BIOMES_I.indexOf(b));
const ITEMS = {
  trophy: [['Meadows', 'TrophyDeer', 5], ['Meadows', 'TrophyBoar', 4], ['Meadows', 'TrophyNeck', 2],
    ['Black Forest', 'TrophyGreydwarf', 2], ['Black Forest', 'TrophyGreydwarfBrute', 4], ['Black Forest', 'TrophyGreydwarfShaman', 3], ['Black Forest', 'TrophySkeleton', 3],
    ['Black Forest', 'TrophySkeletonPoison', 2], ['Black Forest', 'TrophyFrostTroll', 2], ['Black Forest', 'TrophyGhost', 1], ['Black Forest', 'TrophyBjorn', 1],
    ['Swamp', 'TrophyDraugr', 1], ['Swamp', 'TrophyDraugrElite', 2], ['Swamp', 'TrophyLeech', 1], ['Swamp', 'TrophyBlob', 2], ['Swamp', 'TrophyWraith', 2],
    ['Swamp', 'TrophyAbomination', 3], ['Swamp', 'TrophySurtling', 6], ['Swamp', 'TrophyKvastur', 1], ['Swamp', 'TrophyWrithan', 1], ['Swamp', 'TrophySerpent', 1],
    ['Mountain', 'TrophyWolf', 3], ['Mountain', 'TrophyFenring', 1], ['Mountain', 'TrophyHatchling', 2], ['Mountain', 'TrophySGolem', 2], ['Mountain', 'TrophyCultist', 2],
    ['Mountain', 'TrophyUlv', 1], ['Mountain', 'TrophyBlob_Frost', 1],
    ['Plains', 'TrophyLox', 1], ['Plains', 'TrophyDeathsquito', 2], ['Plains', 'TrophyGoblin', 2], ['Plains', 'TrophyGoblinBrute', 1], ['Plains', 'TrophyGoblinShaman', 2],
    ['Plains', 'TrophyGrowth', 1], ['Plains', 'TrophyBjornUndead', 1],
    ['Mistlands', 'TrophySeeker', 1], ['Mistlands', 'TrophySeekerBrute', 1], ['Mistlands', 'TrophyTick', 1], ['Mistlands', 'TrophyGjall', 1], ['Mistlands', 'TrophyHare', 1],
    ['Mistlands', 'TrophyDvergr', 1],
    ['Ashlands', 'TrophyAsksvin', 1], ['Ashlands', 'TrophyVolture', 1], ['Ashlands', 'TrophyCharredMelee', 1], ['Ashlands', 'TrophyCharredArcher', 1], ['Ashlands', 'TrophyCharredMage', 1],
    ['Ashlands', 'TrophyMorgen', 1], ['Ashlands', 'TrophyFallenValkyrie', 1], ['Ashlands', 'TrophyBonemawSerpent', 1], ['Ashlands', 'TrophyBlob_Lava', 1],
    ['Deep North', 'TrophyMoose', 1], ['Deep North', 'TrophySeal', 1], ['Deep North', 'TrophyBarka', 1], ['Deep North', 'TrophyMole', 1], ['Deep North', 'TrophyJotunWarrior', 1],
    ['Deep North', 'TrophyJotunWitch', 1], ['Deep North', 'TrophyBlob_Morkhalla', 1]],
  // the great trophies: the bosses, and the Hildir quest's champions and the Elaking
  boss: [['Meadows', 'TrophyEikthyr', 4], ['Black Forest', 'TrophyTheElder', 2], ['Black Forest', 'TrophySkeletonHildir', 1], ['Swamp', 'TrophyBonemass', 1],
    ['Mountain', 'TrophyDragonQueen', 1], ['Mountain', 'TrophyCultist_Hildir', 1], ['Plains', 'TrophyGoblinKing', 1], ['Plains', 'TrophyGoblinBruteBrosShaman', 1],
    ['Mistlands', 'TrophySeekerQueen', 1], ['Ashlands', 'TrophyFader', 1], ['Deep North', 'TrophyElaking', 1]],
  shield: [['Meadows', 'ShieldWood', 5], ['Meadows', 'ShieldWoodTower', 3], ['Black Forest', 'ShieldBronzeBuckler', 4], ['Black Forest', 'ShieldBoneTower', 3],
    ['Swamp', 'ShieldBanded', 5], ['Swamp', 'ShieldIronBuckler', 3], ['Swamp', 'ShieldIronTower', 3], ['Mountain', 'ShieldSilver', 4], ['Mountain', 'ShieldSerpentscale', 4],
    ['Plains', 'ShieldBlackmetal', 2], ['Plains', 'ShieldBlackmetalTower', 2], ['Mistlands', 'ShieldCarapace', 1], ['Mistlands', 'ShieldCarapaceBuckler', 1],
    ['Ashlands', 'ShieldFlametal', 1], ['Ashlands', 'ShieldFlametalTower', 1], ['Deep North', 'ShieldGoldBuckler', 1], ['Deep North', 'ShieldGold', 1], ['Deep North', 'ShieldGoldTower', 1]],
  weapon: [['Meadows', 'AxeFlint', 1], ['Meadows', 'SpearFlint', 1], ['Meadows', 'Bow', 1], ['Meadows', 'Club', 1], ['Meadows', 'KnifeFlint', 1], ['Meadows', 'KnifeButcher', 3],
    ['Black Forest', 'BowFineWood', 2], ['Black Forest', 'SwordBronze', 2], ['Black Forest', 'MaceBronze', 1], ['Black Forest', 'SpearBronze', 1], ['Black Forest', 'AtgeirBronze', 1],
    ['Black Forest', 'KnifeCopper', 2], ['Black Forest', 'SledgeStagbreaker', 1],
    ['Swamp', 'SwordIron', 2], ['Swamp', 'MaceIron', 2], ['Swamp', 'AtgeirIron', 1], ['Swamp', 'Battleaxe', 1], ['Swamp', 'SledgeIron', 2], ['Swamp', 'SpearElderbark', 1], ['Swamp', 'BowHuntsman', 1],
    ['Mountain', 'SwordSilver', 2], ['Mountain', 'MaceSilver', 3], ['Mountain', 'SpearWolfFang', 1], ['Mountain', 'KnifeSilver', 1], ['Mountain', 'BowDraugrFang', 2],
    ['Mountain', 'BattleaxeCrystal', 2], ['Mountain', 'FistFenrirClaw', 1],
    ['Plains', 'SwordBlackmetal', 2], ['Plains', 'AtgeirBlackmetal', 1], ['Plains', 'KnifeBlackMetal', 2], ['Plains', 'MaceNeedle', 2], ['Plains', 'SpearChitin', 1], ['Plains', 'KnifeChitin', 2],
    ['Mistlands', 'SwordMistwalker', 2], ['Mistlands', 'CrossbowArbalest', 2], ['Mistlands', 'THSwordKrom', 2], ['Mistlands', 'SledgeDemolisher', 2], ['Mistlands', 'AtgeirHimminAfl', 2],
    ['Mistlands', 'KnifeSkollAndHati', 1], ['Mistlands', 'StaffFireball', 1], ['Mistlands', 'StaffIceShards', 2], ['Mistlands', 'StaffShield', 1], ['Mistlands', 'StaffSkeleton', 2],
    ['Ashlands', 'SwordNiedhogg', 1], ['Ashlands', 'SwordDyrnwyn', 1], ['Ashlands', 'THSwordSlayer', 1], ['Ashlands', 'AxeBerzerkr', 1], ['Ashlands', 'BowAshlands', 1], ['Ashlands', 'CrossbowRipper', 1],
    ['Deep North', 'SwordGold', 1], ['Deep North', 'AxeGold', 1], ['Deep North', 'MaceGold', 1], ['Deep North', 'SpearGold', 1], ['Deep North', 'KnifeGold', 1]],
  tool: [['Meadows', 'Hammer', 3], ['Meadows', 'AxeStone', 1], ['Meadows', 'PickaxeAntler', 1], ['Meadows', 'Hoe', 1], ['Meadows', 'FishingRod', 1],
    ['Black Forest', 'AxeBronze', 2], ['Black Forest', 'PickaxeBronze', 2], ['Black Forest', 'Cultivator', 1], ['Swamp', 'AxeIron', 1], ['Swamp', 'PickaxeIron', 1],
    ['Plains', 'AxeBlackMetal', 2], ['Plains', 'PickaxeBlackMetal', 1], ['Plains', 'Scythe', 1], ['Mistlands', 'AxeJotunBane', 2], ['Deep North', 'Shovel', 1]],
  farm: [['Meadows', 'Hoe', 3], ['Black Forest', 'Cultivator', 3], ['Meadows', 'AxeStone', 1], ['Plains', 'Scythe', 1]],
  fishing: [['Meadows', 'FishingRod', 1]],
  fish: [['Meadows', 'Fish1', 2], ['Black Forest', 'Fish2', 2], ['Swamp', 'Fish5', 1], ['Swamp', 'Fish3', 1], ['Mountain', 'Fish4_cave', 1], ['Plains', 'Fish6', 1], ['Plains', 'Fish7', 1],
    ['Plains', 'Fish8', 1], ['Mistlands', 'Fish9', 1], ['Mistlands', 'Fish12', 1], ['Ashlands', 'Fish11', 1], ['Deep North', 'Fish10', 1]],
  drink: [['Meadows', 'Tankard', 8], ['Meadows', 'TankardAnniversary', 3], ['Black Forest', 'MeadTasty', 3], ['Black Forest', 'MeadHealthMinor', 2], ['Black Forest', 'MeadStaminaMinor', 2],
    ['Black Forest', 'MeadPoisonResist', 4], ['Black Forest', 'MeadLightfoot', 1], ['Swamp', 'MeadFrostResist', 4], ['Swamp', 'MeadHealthMedium', 2], ['Swamp', 'MeadHasty', 1],
    ['Plains', 'MeadStaminaMedium', 3], ['Plains', 'BarleyWine', 2], ['Plains', 'MeadStrength', 1], ['Mistlands', 'MeadHealthMajor', 3], ['Mistlands', 'MeadStaminaLingering', 3],
    ['Mistlands', 'MeadEitrMinor', 2], ['Mistlands', 'Tankard_dvergr', 3], ['Deep North', 'Lingondricka', 1], ['Deep North', 'OatMilk', 1]],
  food: [['Meadows', 'Raspberry', 3], ['Meadows', 'CookedMeat', 2], ['Meadows', 'CookedDeerMeat', 1],
    ['Black Forest', 'Blueberries', 3], ['Black Forest', 'QueensJam', 4], ['Black Forest', 'Carrot', 2], ['Black Forest', 'CarrotSoup', 3], ['Black Forest', 'DeerStew', 3], ['Black Forest', 'BoarJerky', 1],
    ['Swamp', 'Turnip', 1], ['Swamp', 'TurnipStew', 2], ['Swamp', 'Sausages', 2], ['Swamp', 'MinceMeatSauce', 2], ['Swamp', 'ShocklateSmoothie', 2], ['Swamp', 'BlackSoup', 1],
    ['Swamp', 'SerpentStew', 3], ['Swamp', 'SerpentMeatCooked', 1], ['Swamp', 'Pukeberries', 1],
    ['Mountain', 'Onion', 1], ['Mountain', 'OnionSoup', 3], ['Mountain', 'Eyescream', 2], ['Mountain', 'CookedWolfMeat', 1], ['Mountain', 'WolfMeatSkewer', 1],
    ['Plains', 'Cloudberry', 1], ['Plains', 'Bread', 3], ['Plains', 'LoxPie', 3], ['Plains', 'CookedLoxMeat', 2], ['Plains', 'BloodPudding', 2], ['Plains', 'FishWraps', 1], ['Plains', 'FishAndBread', 1], ['Plains', 'ChickenEgg', 1],
    ['Mistlands', 'Salad', 2], ['Mistlands', 'HoneyGlazedChicken', 2], ['Mistlands', 'MushroomOmelette', 2], ['Mistlands', 'YggdrasilPorridge', 2], ['Mistlands', 'MisthareSupreme', 2],
    ['Mistlands', 'SeekerAspic', 1], ['Mistlands', 'MeatPlatter', 2],
    ['Ashlands', 'SparklingShroomshake', 1], ['Ashlands', 'ScorchingMedley', 1], ['Ashlands', 'SpicyMarmalade', 1], ['Ashlands', 'FierySvinstew', 1], ['Ashlands', 'MarinatedGreens', 1],
    ['Ashlands', 'MashedMeat', 1], ['Ashlands', 'RoastedCrustPie', 1], ['Ashlands', 'PiquantPie', 1],
    ['Deep North', 'Pancakes', 1], ['Deep North', 'SmokedFish', 1], ['Deep North', 'FishSoup', 1], ['Deep North', 'SealSoup', 1], ['Deep North', 'KaleChips', 1], ['Deep North', 'MooseKebab', 1],
    ['Deep North', 'BakedPoteitr', 1], ['Deep North', 'Lingonberry', 1]],
  herbs: [['Meadows', 'Dandelion', 4], ['Meadows', 'Mushroom', 3], ['Black Forest', 'MushroomYellow', 4], ['Black Forest', 'Thistle', 2], ['Mountain', 'MushroomBlue', 1],
    ['Mistlands', 'MushroomMagecap', 1], ['Mistlands', 'MushroomJotunPuffs', 1], ['Deep North', 'Kale', 1]],
  // curios a household keeps on show: the Dvergr circlet, crowns and caps, cores, keys, eggs, totems
  hat: [['Meadows', 'HelmetMidsummerCrown', 1], ['Meadows', 'HelmetYule', 1], ['Mistlands', 'HelmetDverger', 3]],
  rare: [['Black Forest', 'SurtlingCore', 2], ['Black Forest', 'AncientSeed', 1], ['Swamp', 'CryptKey', 3], ['Mountain', 'DragonEgg', 3], ['Mountain', 'DragonTear', 1],
    ['Plains', 'GoblinTotem', 2], ['Plains', 'SaddleLox', 1], ['Plains', 'YagluthDrop', 1], ['Mistlands', 'BlackCore', 1], ['Mistlands', 'DvergrKey', 1],
    ['Ashlands', 'MoltenCore', 1], ['Ashlands', 'CelestialFeather', 1], ['Ashlands', 'Bell', 1]],
};
// valuables (rubies, amber) cannot go on a stand: the rare things stand in for them
ITEMS.valuable = ITEMS.rare;
// the serving tray, left on a stand beside a feast it laid out (lib/stands.js)
ITEMS.tray = [['Meadows', 'Feaster', 1]];
// What each place holds in the corpus (flat stands by what they stand on, wall stands by what stands under them), as
// shares; the household's hobbies then lean on these (standItem).
const AT_KINDS = {
  table: { drink: 732, food: 531, weapon: 88, shield: 45, trophy: 45, herbs: 33, tool: 25, fish: 25, rare: 17 },
  sidetable: { drink: 60, food: 40, herbs: 15, rare: 10, trophy: 8, hat: 5 },
  shelf: { drink: 544, food: 341, herbs: 284, weapon: 241, hat: 121, rare: 94, trophy: 54, tool: 50, shield: 41 },
  ledge: { drink: 266, food: 242, herbs: 168, weapon: 103, trophy: 96, hat: 47, rare: 43, fish: 42 },
  mantel: { drink: 686, food: 91, trophy: 90, herbs: 53, weapon: 39, rare: 19 },
  sill: { drink: 55, food: 41, trophy: 41, weapon: 12, herbs: 8 },
  bench: { drink: 108, trophy: 34, food: 26, weapon: 13, shield: 11, herbs: 7 },
  chest: { food: 30, trophy: 10, fish: 7, drink: 4, shield: 3 },
  workbench: { tool: 10, drink: 10, food: 6, rare: 4, weapon: 3 },
  rafter: { hat: 52, trophy: 38, weapon: 38, drink: 25, herbs: 15, fish: 11, rare: 8 },
  floor: { drink: 665, food: 432, herbs: 277, rare: 225, weapon: 116, trophy: 90, hat: 72, fish: 46 },
  wall: { weapon: 215, trophy: 199, shield: 179, fish: 30, tool: 29, rare: 22, farm: 10 },
  'wall:workbench': { trophy: 219, shield: 117, weapon: 116, tool: 26, fish: 8, farm: 9 },
  'wall:hearth': { trophy: 182, shield: 172, weapon: 113, rare: 25, tool: 11 },
  'wall:table': { shield: 112, trophy: 83, weapon: 82, fish: 10, rare: 8 },
  'wall:bed': { trophy: 136, shield: 38, weapon: 16 },
  'wall:chest': { trophy: 103, weapon: 88, shield: 71, tool: 14 },
  'wall:door': { trophy: 61, shield: 59, weapon: 38, tool: 7, farm: 3 },
  'wall:bench': { weapon: 55, trophy: 46, shield: 28, tool: 6 },
  beam: { trophy: 214, weapon: 155, shield: 145, tool: 57, fish: 18, farm: 11 },
  'wall:rafter': { trophy: 215, shield: 154, weapon: 61, fish: 26 },
};
function itemFrom(kind, biome, R, own = 2, seen) {
  // any item from any biome may be on show in any village (Tyler, 2026-11-10: decor has no biome limit; D-080 is only
  // about how it is paid for); the village's own biome weighs a little more, for flavor
  const t = tierI(biome);
  const list = ITEMS[kind] || [];
  if (!list.length) return null;
  own = 1 + (own - 1) * 0.6;
  // what the house already shows weighs less, so a wall of stands is not five of one thing
  const got = pickWP(R, Object.fromEntries(list.map(([b, n, w]) => [n, (w == null ? 1 : w) * (tierI(b) === t ? own : 1) / (1 + 2 * ((seen && seen[n]) || 0))])));
  if (seen && got) seen[got] = (seen[got] || 0) + 1;
  return got;
}
// How much a household leans to each kind of thing on show (never a trade: the village cook may live in any house).
function kindLean(P) {
  const H = P ? P.hobby : { crafts: 0.3, collect: 0.3, plants: 0.3, food: 0.3, games: 0.3, maps: 0.3 };
  const wealth = P ? P.wealth : 0.4, clutter = P ? P.clutter : 0.4, comfort = P ? P.comfort : 0.5;
  return { trophy: 0.4 + 1.6 * H.collect, shield: 0.5 + 1.0 * H.collect + 0.5 * wealth, weapon: 0.5 + 0.9 * H.collect + 0.3 * wealth,
    tool: 0.3 + 1.7 * H.crafts, farm: 0.2 + 1.5 * H.plants, drink: 0.6 + 0.6 * H.food + 0.4 * clutter + 0.3 * H.games, food: 0.5 + 1.2 * H.food + 0.2 * clutter,
    herbs: 0.3 + 1.5 * H.plants, fish: 0.4 + 0.6 * H.food, hat: 0.2 + 0.5 * comfort + 0.6 * H.collect, rare: 0.15 + 0.9 * H.collect + 0.8 * wealth + 0.3 * H.maps };
}
// What a stand holds, from the household's hobbies, the room and the place: kind 'wall' or 'top'; o.want is what its
// kit asked for (a kind such as 'drink' or 'trophy'), o.at where it stands ('table', 'shelf', 'sill', 'wall:hearth', ...).
// Nothing here follows a trade: a work building's stands hold its own work (the smithy's tools and weapons), a home's
// what its household collects, makes, grows and eats.
// A household keeps a few things of each kind and puts them out again: the same mead in a row of mugs, the same
// bread on two tables (the corpus's houses show a median of 7 distinct items on 19 stands). How often a stand takes
// something already on show follows the household: a tidy one keeps to a few things, a collector shows more of its
// own. Drink, food and herbs come again most, trophies and tools seldom; rare things, boss trophies and the serving
// tray never.
const NO_REPEAT = new Set(['rare', 'boss', 'tray', 'valuable']);
const REPEAT_K = { drink: 1, food: 0.9, herbs: 1, fish: 0.8, hat: 0.8, shield: 0.7, weapon: 0.5, farm: 0.45, tool: 0.45, trophy: 0.4 };
function repeatOf(P) {
  if (!P) return 0.7;
  return Math.min(0.95, Math.max(0.25, 0.7 + 0.6 * P.tidy - 0.5 * (P.hobby.collect || 0) - 0.2 * P.wealth + 0.2 * (P.plain ? 1 : 0)));
}
function fromStock(kind, biome, R, seen, P) {
  const st = seen && !NO_REPEAT.has(kind) ? (seen._stock || (seen._stock = {})) : null;
  const list = st && st[kind];
  if (list && list.length && R() < repeatOf(P) * (REPEAT_K[kind] == null ? 0.5 : REPEAT_K[kind])) {
    const w = {};
    for (const n of list) w[n] = (w[n] || 0) + 1;
    const got = pickWP(R, w);
    list.push(got);
    return got;
  }
  const got = itemFrom(kind, biome, R, 2, seen);
  if (st && got) (st[kind] || (st[kind] = [])).push(got);
  return got;
}
function standItem(P, kind, o, R) {
  const biome = o.biome || 'Meadows', role = o.role || 'home', want = o.want, seen = o.seen;
  const H = P ? P.hobby : { crafts: 0.3, collect: 0.3, plants: 0.3, food: 0.3 };
  if (want === 'tool' && R() < H.plants / (H.plants + H.crafts + 0.2)) return fromStock('farm', biome, R, seen, P);
  if (want && ITEMS[want]) return fromStock(want, biome, R, seen, P);
  const lean = kindLean(P);
  const at = o.at || (kind === 'wall' ? 'wall' : 'table');
  const base = AT_KINDS[at] || AT_KINDS[kind === 'wall' ? 'wall' : 'table'];
  const tot = Object.values(base).reduce((s, v) => s + v, 0);
  const w = {};
  for (const [k, v] of Object.entries(base)) {
    // meads and food only on the flat stand
    if (kind === 'wall' && ['drink', 'food', 'herbs', 'hat'].includes(k)) continue;
    w[k] = (v / tot) * (lean[k] || 1);
  }
  // the work of a work building, the drink of a tavern
  if (role === 'smithy') { w.tool = (w.tool || 0) + 0.5; w.weapon = (w.weapon || 0) + 0.6; w.shield = (w.shield || 0) + 0.3; }
  if (role === 'workshop' || role === 'storage') { w.tool = (w.tool || 0) + 0.8; w.farm = (w.farm || 0) + 0.2 + 0.4 * H.plants; }
  if (role === 'temple') { w.trophy = (w.trophy || 0) + 0.4; w.rare = (w.rare || 0) + 0.2; }
  if ((role === 'tavern' || role === 'guest') && kind !== 'wall') { w.drink = (w.drink || 0) * 2.5 + 0.3; w.food = (w.food || 0) * 1.3; }
  if (kind === 'wall') {
    // a well-off collector may keep one great trophy
    if (P && H.collect > 0.6 && P.wealth > 0.6 && seen && !seen.boss && R() < 0.3) { seen.boss = 1; return itemFrom('boss', biome, R, 3, seen); }
  }
  return fromStock(pickWP(R, w), biome, R, seen, P);
}
// The room a point lies in (a design's room rectangles) and its role, roughly: the main floor by the building's use,
// upper floors sleeping or storage, as the decorator reads them.
function roleAt(b, p, type, use) {
  const rooms = b.rooms || [];
  const r = rooms.find(q => p.x > q.x0 - 0.3 && p.x < q.x1 + 0.3 && p.z > q.z0 - 0.3 && p.z < q.z1 + 0.3 && p.y > q.y - 0.5 && p.y < q.y + 3.2);
  const upper = r ? r.upper || r.y > 1.6 : p.y > 2.5;
  if (upper) return use === 'home' || use === 'hall' ? (type === 'tavern' ? 'guest' : 'sleeping') : 'storage';
  return { home: 'home', hall: type === 'tavern' ? 'tavern' : type === 'temple' ? 'temple' : 'hall', smithy: 'smithy', workshop: 'workshop', storage: 'storage', farm: 'storage', guard: 'home', temple: 'temple' }[use] || 'home';
}
// Where a stand is, as the corpus miner reads it (lab/mine_stands.js): a flat stand by what it stands on, a wall
// stand by what stands under it. Sets that know say so themselves (p.at).
const STAND_FIRE = /^(hearth|fire_pit|fire_pit_iron)$/;
function standAt(b, p, near) {
  const P_ = NODE_P ? require('./pieces.js') : window.VHPieces, Ck = NODE_P ? require('./checks.js') : window.VHChecks;
  const role = q => P_.piece(q.name).role;
  if (p.name === 'itemstandh') {
    let best = null, bt = -Infinity;
    for (const q of near) {
      if (q === p || /^itemstand/.test(q.name)) continue;
      const o = Ck.aabb(q);
      if (o.pass || o.x0 > p.x || o.x1 < p.x || o.z0 > p.z || o.z1 < p.z || o.y1 > p.y + 0.3 || o.y1 < p.y - 0.15) continue;
      if (o.y1 > bt) { bt = o.y1; best = { q, o }; }
    }
    if (!best) return 'table';
    const n = best.q.name, r = role(best.q), o = best.o;
    if (/^(piece_workbench|forge|piece_artisanstation|blackforge|piece_magetable|piece_stonecutter|piece_cauldron)/.test(n)) return 'workbench';
    if (r === 'table') return (o.x1 - o.x0) * (o.z1 - o.z0) < 1 ? 'sidetable' : 'table';
    if (r === 'seat') return 'bench';
    if (r === 'storage') return 'chest';
    if (r === 'beam' || r === 'pole' || /ledge|beam/.test(n)) {
      const room = (b.rooms || []).find(q => p.x > q.x0 - 0.3 && p.x < q.x1 + 0.3 && p.z > q.z0 - 0.3 && p.z < q.z1 + 0.3 && p.y > q.y - 0.5 && p.y < q.y + 4);
      return room && p.y - room.y > 2.2 ? 'rafter' : 'shelf';
    }
    return 'shelf';
  }
  // a wall stand: what stands under it, within reach
  let at = 'wall', d = Infinity;
  for (const q of near) {
    if (!q.decor || q === p) continue;
    const r = role(q), dist = Math.hypot(q.x - p.x, q.z - p.z);
    if (dist > (STAND_FIRE.test(q.name) ? 2.4 : 1.4) || q.y > p.y || dist >= d) continue;
    const k = /^(piece_workbench|forge|piece_artisanstation|blackforge|piece_stonecutter)/.test(q.name) ? 'wall:workbench' : STAND_FIRE.test(q.name) ? 'wall:hearth'
      : r === 'bed' ? 'wall:bed' : r === 'table' ? 'wall:table' : r === 'seat' ? 'wall:bench' : r === 'storage' ? 'wall:chest' : null;
    if (k) { at = k; d = dist; }
  }
  return at;
}
/**
 * Puts an item on every item stand of a design (p.item, written to the blueprint's info field) by the household and
 * the room, or takes the stand out when nothing fits. Each stand draws from a stream seeded by its place, so the same
 * stand holds the same item at every decor stage. Returns how many stands got an item.
 */
function dressStands(b, ctx) {
  const P = ctx.persona;
  let n = 0;
  const out = new Set(), seen = {};
  // in a fixed order (by place), so the same stands draw the same items whatever else the design holds
  const stands = b.pieces.filter(p => /^itemstandh?$/.test(p.name) && !p.item).sort((a, c) => a.x - c.x || a.z - c.z || a.y - c.y);
  for (const p of stands) {
    const R = rngP(((P ? P.salt : 7) ^ Math.imul(Math.round(p.x * 20) + 4096, 73856093) ^ Math.imul(Math.round(p.y * 20) + 4096, 19349663) ^ Math.imul(Math.round(p.z * 20) + 4096, 83492791)) >>> 0);
    R(); R();
    // a set may say what a stand holds and where it is in one word ('drink@table', lib/stands.js)
    const [want, at0] = String(p.want || '').split('@');
    const at = at0 || p.at || (want ? null : standAt(b, p, b.pieces.filter(q => Math.abs(q.x - p.x) < 2.5 && Math.abs(q.z - p.z) < 2.5 && Math.abs(q.y - p.y) < 2.5)));
    const name = standItem(P, p.name === 'itemstand' ? 'wall' : 'top', { biome: ctx.biome, role: roleAt(b, p, ctx.type, ctx.use), want: want || null, at, seen }, R);
    if (!name) { out.add(p); continue; }
    p.item = { name, variant: 0, quality: 1 };
    delete p.want; delete p.at;
    n++;
  }
  if (out.size) b.pieces = b.pieces.filter(p => !out.has(p));
  return n;
}


// ---------------------------------------------------------------- decor stages (D-071)
// A household decorates over time: d1 is what it moves in with, d2 and d3 add to it. The generator furnishes every
// design at d3, and the passes that know when a piece goes up tag it (p.ds: 2 or 3; lib/kitbash.js, decorate.js
// fill, yards.js, the door lights). The rest is tagged here: the essentials of d1 (beds, two chests, the fire and
// what cooks on it, the main stations; decorate.js strip keeps the same) at 1, anything else at 2. A piece never goes
// up before what it stands on, and the pieces of one assembly go up together. growth(b, 'd1' | 'd2') then keeps the
// pieces of that stage and those before it, so each stage holds the one before it, piece for piece and in place.
const ESSENTIAL_P = /^(bed|piece_bed02|ashwood_bed|piece_chest_wood|piece_chest|hearth|fire_pit|fire_pit_iron|forge|piece_workbench|piece_cookingstation|piece_cookingstation_iron|piece_cauldron|smelter|portal_wood)$/;
function stageOf(b, hall) {
  let chests = 0;
  // a hall or tavern opens with two of its tables and their seats (a dining set of the library goes whole)
  // a temple opens with its altar (its first table) and what stands on it
  if (hall === 'temple') {
    const P_ = NODE_P ? require('./pieces.js') : window.VHPieces;
    const t = b.pieces.find(p => p.decor && P_.piece(p.name).role === 'table');
    if (t && t.kb) { for (const q of b.pieces) if (q.kb === t.kb) q.ds = 1; } else if (t) t.ds = 1;
  } else if (hall) {
    const P_ = NODE_P ? require('./pieces.js') : window.VHPieces;
    const tables = b.pieces.filter(p => p.decor && P_.piece(p.name).role === 'table' && !/cartography|workbench|butcher|preptable|magetable/.test(p.name)).slice(0, 2);
    for (const t of tables) {
      if (t.kb) { for (const q of b.pieces) if (q.kb === t.kb) q.ds = 1; continue; }
      t.ds = 1;
      for (const q of b.pieces) if (q.decor && q.ds == null && !q.kb && P_.piece(q.name).role === 'seat' && Math.hypot(q.x - t.x, q.z - t.z) < 2.6 && Math.abs(q.y - t.y) < 0.4) q.ds = 1;
    }
  }
  for (const p of b.pieces) {
    if (p.ds != null) continue;
    if (!p.decor) continue;
    if (ESSENTIAL_P.test(p.name) && !p.kb && (!/chest/.test(p.name) || chests++ < 2)) p.ds = 1;
    else p.ds = 2;
  }
  // one assembly goes up at once: at the latest of its pieces' stages
  const unify = () => {
    const kb = new Map();
    for (const p of b.pieces) if (p.kb && p.ds != null) kb.set(p.kb, Math.max(kb.get(p.kb) || 0, p.ds));
    for (const p of b.pieces) if (p.kb && kb.has(p.kb)) p.ds = kb.get(p.kb);
  };
  unify();
  // never before what it stands on: a small thing whose middle is over the top of a table, a chest, a seat, a station
  // or built furniture (never a banner, a torch or anything hung)
  const P_ = NODE_P ? require('./pieces.js') : window.VHPieces, F = (NODE_P ? require('./decorate.js') : window.VHDecorate).FURNITURE;
  const Ck = NODE_P ? require('./checks.js') : window.VHChecks;
  const small = b.pieces.filter(p => p.ds != null && p.y > 0.3 && !(ESSENTIAL_P.test(p.name) && !/chest/.test(p.name)));
  const base = q => q.decor && q.ds != null && (['table', 'storage', 'seat', 'craft'].includes(P_.piece(q.name).role) || q.trim) &&
    !['mount', 'hang', 'rug'].includes((F[q.name] || {}).at) && !/^(bed|piece_bed02|ashwood_bed)$/.test(q.name);
  const boxes = new Map(b.pieces.filter(base).map(q => [q, Ck.aabb(q)]));
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (const p of small) for (const [q, o] of boxes) {
      if (q === p || q.ds <= p.ds || p.x <= o.x0 || p.x >= o.x1 || p.z <= o.z0 || p.z >= o.z1) continue;
      if (p.y < o.y1 - 0.25 || p.y > o.y1 + 0.35 || q.y >= p.y) continue;
      p.ds = q.ds; changed = true;
    }
    unify();
    if (!changed) break;
  }
  // a building with nothing at d1 opens with its first two pieces of furniture
  // (never a built kit: a cabinet's chest set into its half wall at d1 has no d1 shell to belong to, and the pool audit
  // reads its half wall as the building's, 2026-11-10)
  if (!b.pieces.some(p => p.ds === 1)) {
    let n = 0;
    const built = new Set(b.pieces.filter(q => q.trim && q.kb).map(q => q.kb));
    for (const p of b.pieces) {
      if (!p.decor || p.ds !== 2 || p.y > 3 || (p.kb && built.has(p.kb)) || !['table', 'storage', 'seat', 'bed', 'craft', 'fire'].includes(P_.piece(p.name).role) || n++ >= 2) continue;
      if (p.kb) { for (const q of b.pieces) if (q.kb === p.kb && q.ds === 2) q.ds = 1; } else p.ds = 1;
    }
  }
}
function growth(b, decor, hall) {
  stageOf(b, hall);
  const k = decor === 'd1' ? 1 : decor === 'd2' ? 2 : 3;
  if (k < 3) b.pieces = b.pieces.filter(p => p.ds == null || p.ds <= k);
  return k;
}

// The household's own corner for the story spot (lib/kitbash.js): its two strongest leanings, each with the sets that
// show it. A theme, never a trade (D-072): the crafter may be the village's cook.
function storyKits(P) {
  if (!P) return [];
  const H = P.hobby || {};
  const themes = [
    ['crafts', H.crafts, ['BK-project', 'BK-tanning']], ['collect', H.collect, ['BK-trophies']],
    ['plants', H.plants, ['BK-pots', 'BK-sill']], ['food', H.food, ['BK-kitchen', 'BK-island', 'BK-tablemess']],
    ['games', Math.max(H.games || 0, H.maps || 0), ['BK-living', 'BK-couch']],
    ['messy', (P.clutter || 0) * 0.9, ['BK-clutter', 'BK-tablemess']], ['neat', (P.tidy || 0) * 0.8, ['BK-drawers', 'BK-tableneat']],
    ['cosy', (P.comfort || 0) * 0.85, ['BK-couch', 'BK-bedpelt']],
  ].sort((a, b) => b[1] - a[1]);
  return themes.slice(0, 2).flatMap(t => t[2]);
}

const apiPer = { growth, storyKits, stageOf, persona, PRESETS, CULTURE_P, HOBBIES, ITEMS, extraWeights, fillShare, wallWeights, wallGap, wallSkip, torchGap, underStair, kitWeight, kitBudget,
  standItem, standAt, kindLean, AT_KINDS, itemFrom, dressStands, roleAt, rng: rngP, hash: hashP, pickW: pickWP };
if (NODE_P) module.exports = apiPer; else window.VHPersona = apiPer;
