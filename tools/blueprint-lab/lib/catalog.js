// Piece catalog lookups (data/catalog/pieces.json, docs/PIECE_CATALOG.md). Read only: what a piece looks like, what we
// call it, where corpus builders put it, how often they repeat it and which side is its front. Nothing here changes a
// design; the generator and the audits ask it questions.
//
// In node the data loads from data/catalog/pieces.json the first time it is needed. In the browser or the game bundle
// set window.VHCatalogData (the same JSON) before this script runs.

let DATA;
function data() {
  if (DATA !== undefined) return DATA;
  DATA = null;
  try {
    if (typeof window !== 'undefined' && window.VHCatalogData) DATA = window.VHCatalogData;
    else if (typeof require === 'function' && typeof __dirname !== 'undefined') {
      const fs = require('fs'), path = require('path');
      const f = process.env.VH_CATALOG || path.join(__dirname, '../data/catalog/pieces.json');
      if (fs.existsSync(f)) DATA = JSON.parse(fs.readFileSync(f, 'utf8'));
    }
  } catch (e) {
    DATA = null;
  }
  return DATA;
}

/** The whole record for a prefab id, or null. */
function get(id) { const d = data(); return (d && d.pieces[id]) || null; }
/** Our plain working name ("stool" for piece_chair); the id when the catalog has no record. */
function name(id) { const r = get(id); return r ? r.name : id; }
/** Look family key ('rustic_furniture', 'marble_furniture', 'darkwood', ...); null when unknown. */
function family(id) { const r = get(id); return r ? r.family : null; }
function familyInfo(key) { const d = data(); return (d && d.families[key]) || null; }
/** Colors and value: { mean, swatches, L, value, hue, warmth, saturation }. */
function look(id) { const r = get(id); return r ? r.look : null; }
function material(id) { const r = get(id); return r ? r.material : null; }
function hasTag(id, tag) { const r = get(id); return !!(r && r.tags.includes(tag)); }
/** Every prefab id with a tag, for example 'family:darkwood' or 'zone:roof'. */
function withTag(tag) { const d = data(); return d ? Object.keys(d.pieces).filter(k => d.pieces[k].tags.includes(tag)) : []; }

/** Where corpus builders put it: { zone, mount, covered, onRoof, yard, wallHung, onFurniture, height } (shares 0..1). */
function belongs(id) {
  const r = get(id);
  if (!r || !r.placement) return null;
  const p = r.placement;
  return {
    zone: r.zone, mount: r.mount, covered: p.covered, onRoof: p.on_roof, gableOutside: p.by_gable_outside,
    yard: p.yard_ground, openDeck: p.open_deck, wallHung: p.wall_hung, onFurniture: p.on_furniture,
    underCeiling: p.under_ceiling, height: p.height_m, builds: p.builds,
  };
}
/** True when corpus builders put it under a roof in at least 'share' of their uses (default 0.5). */
function indoorOk(id, share) { const b = belongs(id); return !b || b.covered == null || b.covered >= (share == null ? 0.5 : share); }

/** How often builders repeat it. cap(id, floorM2): the count a build of that floor area can hold before it repeats the
 * piece more than 90 % of corpus builds that use it do (per 100 m2 of floor), never below the corpus median count. */
function reuse(id) { const r = get(id); return r ? r.reuse : null; }
function cap(id, floorM2) {
  const u = reuse(id);
  if (!u) return Infinity;
  const pb = u.per_build || {}, pa = u.per_100m2_floor || {};
  const byArea = pa.p90 != null && floorM2 ? Math.round(pa.p90 * floorM2 / 100) : Infinity;
  const byBuild = pb.p90 != null ? pb.p90 : Infinity;
  return Math.max(pb.p50 || 1, Math.min(byArea, byBuild));
}

/** Front side in the piece's own frame: { front: '+z' | '-z' | '+x' | '-x', back, sure: high | medium | low | unknown }. */
function facing(id) { const r = get(id); return r ? r.facing : null; }
/** The yaw (degrees) that turns the piece's front toward the world direction (dx, dz); null when its front is unknown.
 * Yaw convention as in lib/pieces.js doorOpening: local x maps to (cos a, -sin a), local z to (sin a, cos a). */
function yawFacing(id, dx, dz) {
  const f = facing(id);
  if (!f || !f.front) return null;
  const want = Math.atan2(dx, dz) * 180 / Math.PI; // yaw that points local +z along (dx, dz)
  const off = { '+z': 0, '+x': 90, '-z': 180, '-x': 270 }[f.front];
  return ((want - off) % 360 + 360) % 360;
}

/** Co-occurrence of two look families in corpus builds and in the same covered area (data/catalog/pairs.json). */
let PAIRS;
function pairs() {
  if (PAIRS !== undefined) return PAIRS;
  PAIRS = null;
  try {
    if (typeof window !== 'undefined' && window.VHCatalogPairs) PAIRS = window.VHCatalogPairs;
    else if (typeof require === 'function' && typeof __dirname !== 'undefined') {
      const fs = require('fs'), path = require('path');
      const f = path.join(__dirname, '../data/catalog/pairs.json');
      if (fs.existsSync(f)) PAIRS = JSON.parse(fs.readFileSync(f, 'utf8'));
    }
  } catch (e) { PAIRS = null; }
  return PAIRS;
}
function familyLift(a, b) {
  const p = pairs();
  if (!p || !p.families) return null;
  const k = a < b ? a + '|' + b : b + '|' + a;
  return p.families[k] || null;
}

/** What it is found with: { area: same covered area within 4 m (this catalog), room: track B's room-level lifts }. */
function pairsWith(id) {
  const r = get(id);
  if (!r) return null;
  return { area: r.pairs_with || [], areaRarely: r.rarely_with || [], room: r.room_pairs ? r.room_pairs.pairs_well_with : [], roomRarely: r.room_pairs ? r.room_pairs.rarely_with : [] };
}

const apiC = { pairsWith, get, name, family, familyInfo, look, material, hasTag, withTag, belongs, indoorOk, reuse, cap, facing, yawFacing, familyLift, data };
if (typeof module !== 'undefined') module.exports = apiC;
else window.VHCatalog = apiC;
