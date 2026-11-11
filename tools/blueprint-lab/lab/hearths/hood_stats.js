// What hangs over home wall fires in the corpus (round 4): stone or wood pieces over the fire, by stone family, and the
// stone patterns. Reads the output of fire_mine.js (with its hood field). node hood_stats.js out.json
const j = require(require('path').resolve(process.argv[2] || 'out.json'));
const fam = n => /^stone_|^stone$/.test(n) ? 'stone' : /grausten|Ashlands/i.test(n) ? 'grausten' : /marble/i.test(n) ? 'marble' : null;
const wallPlace = f => ['wall', 'corner', 'alcove', 'in-wall'].includes(f.place);
const t = { n: 0 }, sig = {}, files = new Set(), clips = [];
for (const f of j.fires) {
  if (!f.indoor || !wallPlace(f) || f.kind !== 'home') continue;
  t.n++;
  // over the fire: centre within 1.1 m sideways, 1.0 m out to 0.9 m back, bottom 1.3 to 2.9 m over its floor
  const over = (f.hood || []).filter(([, , back, side, y0]) => Math.abs(side) <= 1.1 && back >= -1.0 && back <= 0.9 && y0 >= 1.25 && y0 <= 2.9);
  const fams = new Set(over.map(h => fam(h[0])).filter(Boolean));
  for (const k of fams) t[k] = (t[k] || 0) + 1;
  if (fams.size) t.anyStone = (t.anyStone || 0) + 1;
  else if (over.length) t.woodOnly = (t.woodOnly || 0) + 1;
  const st = over.filter(h => fam(h[0]) === 'stone');
  if (st.length) {
    files.add(f.file);
    const s = [...new Set(st.map(h => h[0]))].sort().join('+') + ' | ' + f.place;
    sig[s] = (sig[s] || 0) + 1;
    for (const h of st) if (h[6] > 0.05) clips.push(h[6]);
  }
}
clips.sort((a, b) => a - b);
console.log(JSON.stringify(t), 'builds with basic stone over a fire', files.size, 'stone pieces clipped into a wall', clips.length, 'median', clips[clips.length >> 1]);
console.log(Object.entries(sig).sort((a, b) => b[1] - a[1]).map(([k, v]) => v + ' ' + k).join('\n'));
