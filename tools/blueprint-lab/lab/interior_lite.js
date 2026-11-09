// The part of data/interior.json the decorator reads: node lab/interior_lite.js [in] [out]
// Defaults: data/interior.json to data/interior-lite.json. Kept small, since the request page and the game's bundle
// carry it.
const fs = require('fs'), path = require('path');
const inp = process.argv[2] || path.join(__dirname, '../data/interior.json');
const out = process.argv[3] || path.join(__dirname, '../data/interior-lite.json');
const d = JSON.parse(fs.readFileSync(inp, 'utf8'));
const lite = { meta: { designs: d.meta.designs, rooms: d.meta.rooms }, stand: {}, doors: d.doors, rooms: {}, items: {} };
for (const [k, v] of Object.entries(d.stand)) lite.stand[k] = v.mode;
for (const [k, r] of Object.entries(d.rooms)) lite.rooms[k] = { n: r.n, area: r.area, perTenM2: r.perTenM2, items: r.items.slice(0, 40).map(([n, s, c]) => [n, s, c]) };
for (const [k, it] of Object.entries(d.items)) {
  if (it.n < 30) continue;
  lite.items[k] = { n: it.n, rel: it.rel && it.rel[0] ? it.rel[0][0] : null, wall: it.wallDist ? it.wallDist[1] : null, lift: it.lift ? it.lift[1] : null,
    under: it.underCeiling ? it.underCeiling[1] : null, door: it.door ? it.door[0] : null, corner: it.corner, back: it.back ? it.back[0] : null };
}
// Tyler's floorplan feedback (lab/floorplan_feedback.js): how full to fill each room, on top of the corpus rate
const tuning = path.join(path.dirname(inp), 'interior-tuning.json');
if (fs.existsSync(tuning)) lite.tuning = { density: JSON.parse(fs.readFileSync(tuning, 'utf8')).density || {} };
fs.writeFileSync(out, JSON.stringify(lite));
console.log(out, JSON.stringify(lite).length, 'bytes');
