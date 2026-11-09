// Rows for the review sheet's Rooms tab, one per room to score.
// node lab/rooms_sheet.js <corpus dir> <out.json> [batch name] [ID ...]
// With no IDs: the rooms data/room-scores.json lists as the next batch. Each row: ID, the plan picture (an IMAGE
// formula on the picture folder in the tab's header), the source build's name and maker, its valheimians picture, kind,
// size, the pieces, popularity, the batch, the seed or model guess, and empty Score, Tags and Notes for Tyler.
const fs = require('fs'), path = require('path');
const lab = path.join(__dirname, '..');
const root = process.argv[2] || '/home/claude/corpus';
const out = process.argv[3] || '/tmp/int/rooms-rows.json';
const batch = process.argv[4] || '1';
const T = JSON.parse(fs.readFileSync(path.join(lab, 'data/room-templates.json'), 'utf8')).templates;
const S = JSON.parse(fs.readFileSync(path.join(lab, 'data/room-scores.json'), 'utf8'));
const ids = process.argv.slice(5).length ? process.argv.slice(5) : S.next;
const index = JSON.parse(fs.readFileSync(path.join(root, 'vh/index-all.json'), 'utf8'));
const bySlug = new Map(index.map(x => [x.slug, x]));
const corpus = new Map(JSON.parse(fs.readFileSync(path.join(root, 'corpus.json'), 'utf8')).map(x => [x.id, x]));

// the valheimians entry for a source: its slug (before any __file part), else the PlanBuild id without its folder
// prefix, else the same title by the same maker
function entry(src) {
  const slug = src.split('__')[0];
  if (bySlug.has(slug)) return bySlug.get(slug);
  const bare = slug.replace(/^(house|hub|farm|storage|workshop|smithy|tavern|castle|other)-/, '');
  if (bySlug.has(bare)) return bySlug.get(bare);
  const c = corpus.get(src);
  if (c && c.name) {
    const hit = index.find(x => x.title && x.title.toLowerCase() === c.name.toLowerCase() && (!c.creator || (x.by || '').toLowerCase() === c.creator.toLowerCase()));
    if (hit) return hit;
  }
  return null;
}
const SHORT = n => n.replace(/^piece_/, '').replace(/_/g, ' ');
const rows = [];
for (const id of ids) {
  const t = T.find(x => x.id === id);
  if (!t) continue;
  const e = entry(t.src), c = corpus.get(t.src) || corpus.get(t.src.split('__')[0]);
  const name = e ? e.title : c && c.name && c.name !== t.src ? c.name : t.src;
  const maker = e ? e.by : c && c.creator && c.creator !== 'valheimians' ? c.creator : '';
  const cnt = {};
  for (const q of t.p) cnt[SHORT(q[1])] = (cnt[SHORT(q[1])] || 0) + 1;
  const pieces = Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([n, k]) => (k > 1 ? `${n} x${k}` : n)).join(', ');
  const pop = e ? `${e.dls} downloads, ${e.votes} votes` + (c && c.verdict ? `; you: ${c.verdict}` : '') : c && c.verdict ? `PlanBuild; you: ${c.verdict}` : 'PlanBuild';
  const r = S.rooms[id] || {};
  rows.push({
    id, name: maker ? `${name} (${maker})` : name, img: e && e.img ? e.img : '', kind: t.kind,
    size: `${t.W} x ${t.D} m, ${Math.round(t.area)} m2`, pieces, pop, batch, guess: r.pred != null ? r.pred : r.seed,
  });
}
fs.writeFileSync(out, JSON.stringify(rows, null, 1));
console.log(rows.length, 'rows to', out, ';', rows.filter(r => r.img).length, 'with a valheimians picture');
