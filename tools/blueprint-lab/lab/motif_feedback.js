// Tyler's motif scores into weights for lib/motifs.js, and the batches to score.
//   node lab/motif_feedback.js [motifs.csv]      the Motifs tab downloaded as CSV (File > Download > CSV, that tab)
//   node lab/motif_feedback.js --first 70        no scores yet: seed weights and pick the first batch
// Writes data/motif-scores.json: a weight per motif (what lib/motifs.js reads), each motif's score and where it came
// from (tyler or seed), the batch in the tab and the next one to add.
// Weights: a score of 1 or 2 drops the motif (0), 3 keeps it (1), 4 weights it up (1.5), 5 more (2); the tag
// "copy this" adds a quarter, "busy" takes a fifth off. Motifs not scored keep their seed: 0.5, plus a third for
// each doubling of the builds that use it, plus a little for how well liked those builds are, less for a motif seen
// once only or one with many pieces (0.3 to 2).
const fs = require('fs'), path = require('path');
const lab = path.join(__dirname, '..');
const Mo = require(lab + '/lib/motifs.js');

const args = process.argv.slice(2);
const firstN = args.includes('--first') ? +args[args.indexOf('--first') + 1] : 0;
const csvPath = args.find(a => /\.csv$/i.test(a)) || null;
const outPath = path.join(lab, 'data/motif-scores.json');
const M = JSON.parse(fs.readFileSync(path.join(lab, 'data/motifs.json'), 'utf8')).motifs;
const old = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {};

const stone = m => /stone|marble|grausten|iron_wall/.test(m.fit.wall || '');
// a motif of one post or one beam says little; two kinds of piece or more, or a shutter, a sill board, an arch
const telling = m => new Set(m.p.map(t => Mo.classOf(t[0]))).size >= 2 || m.p.some(t => /^(shutter|glass|arch|floor1|floor2|cross26|cross45|dragon|raven|wolf)$/.test(Mo.classOf(t[0])));
function seed(m) {
  let w = 0.5 + Math.log2(1 + m.builds) / 3 + Math.min(0.5, m.pop / 10);
  if (m.builds === 1 && m.uses === 1) w *= 0.6;
  if (m.p.length > 10) w *= 0.7;
  if (!telling(m)) w *= 0.8;
  return Math.max(0.3, Math.min(2, +w.toFixed(2)));
}

// ---- Tyler's scores from the tab
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const scores = { ...(old.scores || {}) };
if (csvPath) {
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const head = rows.findIndex(r => r.some(c => /^ID$/i.test(c.trim())));
  const h = rows[head].map(c => c.trim().toLowerCase());
  const ci = k => h.findIndex(c => c.startsWith(k));
  const [iId, iScore, iTags, iNotes] = [ci('id'), ci('score'), ci('tags'), ci('notes')];
  for (const r of rows.slice(head + 1)) {
    const id = (r[iId] || '').trim();
    if (!/^M[WDCGE]-\d+$/.test(id)) continue;
    const s = parseFloat(r[iScore]), tags = (r[iTags] || '').toLowerCase().split(',').map(t => t.trim()).filter(Boolean), notes = (r[iNotes] || '').trim();
    if (isNaN(s) && !tags.length && !notes) continue;
    scores[id] = { score: isNaN(s) ? null : s, tags, notes };
  }
}

// ---- weights
const weights = {}, from = {};
for (const m of M) {
  const s = scores[m.id];
  let w = seed(m), src = 'seed';
  if (s && s.score != null) {
    w = s.score <= 2 ? 0 : s.score === 3 ? 1 : s.score === 4 ? 1.5 : 2;
    src = 'tyler';
  }
  if (s && w > 0) {
    if (s.tags.includes('copy this')) w += 0.25;
    if (s.tags.includes('busy')) w *= 0.8;
  }
  weights[m.id] = +w.toFixed(2); from[m.id] = src;
}

// ---- batches: best-liked first, every kind, sizes the generator builds, no two alike
// what the generator makes: twin and single 1 m windows, 2 x 2 doors, gables flush with the wall, eaves on the wall
const usable = m => m.kind === 'window' ? Math.abs(m.fit.w - 2) <= 1 && Math.abs(m.fit.h - 1) <= 1 && m.fit.w >= 1
  : m.kind === 'door' ? m.fit.w === 2 && m.fit.h >= 2
    : m.kind === 'gable' ? Math.abs(m.fit.overhang || 0) <= 0.3
      : m.kind === 'eave' ? Math.abs(m.fit.overhang || 0) <= 0.5 : true;
function batch(n, skip) {
  // most generated buildings are timber: two in three windows and doors from timber walls
  const quota = { 'window wood': 0.24, 'window stone': 0.1, 'door wood': 0.1, 'door stone': 0.04, gable: 0.2, corner: 0.14, eave: 0.12 };
  const out = [], shapes = new Set();
  for (const [key, share] of Object.entries(quota)) {
    let k = Math.round(n * share);
    const [kind, wall] = key.split(' ');
    for (const pass of [true, false]) for (const m of M) {
      if (!k) break;
      if (m.kind !== kind || skip.has(m.id) || scores[m.id] || !usable(m) || m.p.length > 14 || out.includes(m.id)) continue;
      if (wall && (wall === 'stone') !== stone(m)) continue;
      if (pass && !telling(m)) continue;
      // two motifs with the same pieces in about the same places are one look
      const shape = kind + '|' + m.p.map(t => Mo.classOf(t[0]) + Math.round(t[1]) + Math.round(t[3])).sort().join(',');
      if (shapes.has(shape)) continue;
      shapes.add(shape); out.push(m.id); k--;
    }
  }
  return out;
}
const prevBatch = old.batch || [];
const out = { about: 'Weights for lib/motifs.js from the Motifs tab (lab/motif_feedback.js).', weights, from, scores,
  batch: firstN ? batch(firstN, new Set()) : prevBatch };
out.next = batch(40, new Set(out.batch));
fs.writeFileSync(outPath, JSON.stringify(out, null, 0).replace(/,"(from|scores|batch|next)"/g, ',\n"$1"'));
const n = Object.values(from).filter(v => v === 'tyler').length;
const byKind = {};
for (const id of out.batch) { const m = M.find(x => x.id === id); byKind[m.kind] = (byKind[m.kind] || 0) + 1; }
console.log(`${M.length} motifs, ${n} scored by Tyler, ${Object.values(weights).filter(w => w === 0).length} dropped; batch ${out.batch.length}`, byKind, `; next ${out.next.length}`);
