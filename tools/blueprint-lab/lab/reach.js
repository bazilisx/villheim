// Can a person walk in and round a design? (D-152.) The logic lives in lib/reach.js, shared with lib/hub.js; libDir picks
// another lib folder (a worktree's) as before.
const path = require('path');
module.exports = function reach(design, libDir) {
  return require(path.join(libDir || path.join(__dirname, '../lib'), 'reach.js'))(design);
};
