// Tyler's floorplan feedback back into the decorator's rules.
// node lab/floorplan_feedback.js <floorplans.csv> [out.json]
// The CSV is the review sheet's Floorplans tab (File > Download > CSV) or BepInEx/config/Villheim/floorplans/floorplans.csv
// with his columns filled in. Density marks become a factor per room on how full the decorator fills that room
// (too sparse 1.25, right 1, too dense 0.8, the geometric mean over the room's rows). Rows marked Change, with their
// layout notes, are listed for the next round of rule changes. Writes data/interior-tuning.json; then
// node lab/interior_lite.js carries it into data/interior-lite.json, which the decorator, the request page and the
// game read.
const fs = require('fs'), path = require('path');
const inp = process.argv[2];
const out = process.argv[3] || path.join(__dirname, '../data/interior-tuning.json');
if (!inp) { console.log('Usage: node lab/floorplan_feedback.js <floorplans.csv> [out.json]'); process.exit(1); }

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}

const rows = parseCsv(fs.readFileSync(inp, 'utf8'));
const head = rows[0].map(h => h.trim().toLowerCase());
const col = name => head.findIndex(h => h.startsWith(name));
const iId = col('id'), iRoom = col('room'), iDensity = col('density'), iNotes = col('layout'), iKeep = col('keep'), iCmd = col('command');
const FACTOR = { 'too sparse': 1.25, sparse: 1.25, right: 1, 'just right': 1, 'too dense': 0.8, dense: 0.8 };
const old = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : { density: {} };
const marks = {};
const change = [];
for (const r of rows.slice(1)) {
  const room = (r[iRoom] || '').trim().toLowerCase();
  const mark = (r[iDensity] || '').trim().toLowerCase();
  if (room && FACTOR[mark] != null) (marks[room] = marks[room] || []).push(FACTOR[mark]);
  const keep = (r[iKeep] || '').trim().toLowerCase();
  const notes = (r[iNotes] || '').trim();
  if (keep.startsWith('change') || notes) change.push({ id: r[iId], room, command: iCmd >= 0 ? r[iCmd] : '', keep: r[iKeep] || '', notes });
}
const density = { ...(old.density || {}) };
for (const [room, fs2] of Object.entries(marks)) {
  const g = Math.exp(fs2.reduce((a, f) => a + Math.log(f), 0) / fs2.length);
  // a new round multiplies on the last one, kept between half and double the corpus rate
  density[room] = +Math.min(2, Math.max(0.5, (density[room] || 1) * g)).toFixed(3);
}
const result = { updated: new Date().toISOString().slice(0, 10), density, notes: change };
fs.writeFileSync(out, JSON.stringify(result, null, 1));
console.log(out);
for (const [room, f] of Object.entries(density)) console.log(`  ${room}: fill to ${f} x the corpus rate (${(marks[room] || []).length} marks this round)`);
console.log(`  ${change.length} rows with notes or marked Change`);
for (const c of change) console.log(`   ${c.id} ${c.room} ${c.keep}: ${c.notes}`);
