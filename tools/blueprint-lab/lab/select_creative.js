// Picks the combined objects worth trying as creative sets from lab/mine_creative.js output (run on Tyler's PC over
// the full corpus, 2026-11-10): in at least 2 builds or 1 well-liked build, 2 to 10 pieces, no seasonal pieces,
// treasure, piles, fires, beds or tables (the library has those), within 4.6 m and 2.75 m high, one per set of prefabs
// and anchor, then the best two for every prefab not yet in two. Prints the picks gzipped and in base64; the 125
// tried as sets were chosen by hand from these 295 and are in data/creative-mined.json.
//   node lab/select_creative.js mined-full.json [limit] > sel.b64
const fs = require('fs'), zlib = require('zlib');
const r = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const lim = +(process.argv[3] || 450);
const SKIP = /^(piece_xmas|piece_gift|piece_mistletoe|piece_jackoturnip|piece_(Celebration|Fairylight)Garland|goblin|Morkhalla|piece_asksvinskeleton|lox_ribs|piece_barber|piece_icecube|Skull|ancient_skull|wood_(fine_|core_)?stack|treasure_pile|treasure_stack|Pickable|TreasureChest|loot_chest|piece_chest_private|piece_chest_treasure|skull_pile|stone_pile|coal_pile|.*_pile$|bonfire|fire_pit|hearth|portal|Cart|piece_bed|bed$|piece_table|blackmarble_(base|out|tip|slope|2x2|basecorner|outcorner|post))/;
const rugish = n => /^(rug_|jute_carpet)/.test(n);
const keep = [];
for (const o of r.objects) {
  if (!(o.builds >= 2 || o.liked >= 1)) continue;
  const ms = o.members;
  if (ms.length < 2 || ms.length > 10) continue;
  if (ms.some(m => SKIP.test(m.n))) continue;
  if (ms.every(m => rugish(m.n))) continue;
  if (o.foot[0] > 4.6 || o.foot[1] > 4.6 || o.h > 2.75) continue;
  if (new Set(ms.map(m => m.n)).size < 2 && !/chest|barrel|crate/.test(ms[0].n)) continue;
  const score = o.liked + 0.25 * (o.builds - o.liked);
  keep.push({ ...o, score });
}
keep.sort((a, b) => b.score - a.score || b.members.length - a.members.length);
// one per same set of prefabs and anchor, the best scored
const seen = new Set(), uniq = [];
for (const o of keep) {
  const k = o.anchor + '|' + o.members.map(m => m.n).sort().join(',');
  if (seen.has(k)) continue;
  seen.add(k);
  uniq.push(o);
}
const out = uniq.slice(0, lim), cover = {};
for (const o of out) for (const m of o.members) cover[m.n] = (cover[m.n] || 0) + 1;
// the long tail: the best two objects for every prefab not yet in two
for (const o of uniq.slice(lim)) if (o.members.some(m => (cover[m.n] || 0) < 2)) { out.push(o); for (const m of o.members) cover[m.n] = (cover[m.n] || 0) + 1; }
const pre = new Set(); out.forEach(o => o.members.forEach(m => pre.add(m.n)));
console.error(`${keep.length} pass, ${out.length} picked, ${pre.size} prefabs`);
const slim = out.map(o => ({ a: o.anchor, ang: o.angle, of: o.of, ap: o.anchorPiece, m: o.members.map(m => [m.n, m.x, m.y, m.z, m.yaw, m.rest, m.on, m.sink]), c: o.clips, f: o.foot, h: o.h, b: o.builds, l: o.liked, s: o.src }));
process.stdout.write(zlib.gzipSync(JSON.stringify(slim), { level: 9 }).toString('base64'));
