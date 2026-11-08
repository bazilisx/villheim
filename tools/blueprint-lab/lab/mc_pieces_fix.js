// Size fixes used only by the Millenaire study scripts (mc_render.js, mc_eval.js). lib/pieces.js guesses some sizes
// from names; these come from how the pieces sit next to each other in the corpus (offsets measured 2026-11-08 over
// corpus.json, see docs/MC_TRANSLATION.md). They are patched into the piece cache of this process only, so the lab's
// own generator, checks and pages are unchanged. Proposed for lib/pieces.js once the game export confirms them.
const PC = require('../lib/pieces.js');

const FIX = {
  wood_wall_quarter: [1, 1, 0.2],      // quarters stack 1 m up and 1 m along; 1.5 m from a 2x2 wall's centre
  stone_wall_1x1: [1, 1, 1],           // 1 m cube: neighbours at 1 m on all three axes
  stone_wall_4x2: [4, 2, 1],           // stacks 2 m up, rows 1 m apart in depth
  'wood_wall_log_4x0.5': [4, 0.5, 0.4], // a 4 m log: stacks 0.5 m like wood_wall_log
};

let done = false;
function apply() {
  if (done) return;
  done = true;
  for (const [name, size] of Object.entries(FIX)) PC.piece(name).size = size;
  // 'piece_walltorch' hits the wall name rule in lib/pieces.js and is drawn and checked as a 2x2 wall.
  Object.assign(PC.piece('piece_walltorch'), { role: 'light', size: [0.3, 0.8, 0.3], shape: 'prop', structural: false,
    mat: 'fire', color: PC.MAT.fire });
}

// Box pieces for the original voxels: one cached piece per colour and size.
function voxelPiece(hex, h = 1, w = 1, d = 1) {
  const name = `mcvox|${hex}|${h}|${w}|${d}`;
  const p = PC.piece(name);
  if (!p._mc) {
    Object.assign(p, { size: [w, h, d], shape: 'box', role: 'wall', color: hex, mat: hex === '#b9dde8' ? 'glass' : 'stone',
      structural: true, _mc: true });
  }
  return name;
}

module.exports = { apply, voxelPiece, FIX };
