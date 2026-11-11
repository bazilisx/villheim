// Which shapes the corpus miners read for what shows (docs/BLUEPRINT_LAB.md, "Corpus recount with fine models", second part).
// VH_SHAPES unset: the colliders (lib/shapes.js), as the committed data files were made. 'coarse': the coarse visible parts of
// lib/mesh.js. 'collider': the colliders through the same code path as the other two (for a like-for-like third column). 'fine': the fine parts (to 2 cm of the game's mesh), the coarse ones where a piece has none.
// Rest and snap judgments (what a piece stands on, hangs from, sits against) keep the colliders in every mode; only the
// judgments of how deep one piece visibly goes into another, or whether two visibly touch, call this.
const SH = require('../lib/shapes.js');
const MODE = process.env.VH_SHAPES || '';
const ME = MODE ? require('../lib/mesh.js') : null;
/** The piece's shapes for the mode (world space, lists of oriented boxes), or null where it has none. */
function parts(p) {
  if (MODE === 'fine') return ME.worldFine(p) || ME.world(p) || SH.world(p);
  if (MODE === 'coarse') return ME.world(p) || SH.world(p);
  return SH.world(p);
}
module.exports = { MODE, parts };
