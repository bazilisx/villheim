// Which hub line suits a culture (D-137): node lab/hub_lines.js [seeds]
// Builds every other building type of each village culture at s3 (the lab's last stage for them; skipDecor, no yard)
// in the culture's first biome and reads each plan from its pieces: round (walls turned off the square: octagons, rings, yurts), long (an
// orthogonal plan 1.5 or more times as long as it is wide), branched (an orthogonal plan filling under 85 % of its
// bounding box: L, T, U, cross) or compact (the rest). Prints the shares per culture, the lines the rule below gives
// (as lib/styles.js HUB.lines holds them) and the tallest other building at s3 leaving out the watchtower (HUB.capH).
// The rule (D-137, Tyler 2026-11-11: round, part round or octagonal "for most, and cross-shape for those that are more
// strongly rectangular or l-shaped structures throughout the rest of the settlement"): long and branched plans together
// HUB.crossFrom (0.7) or more of the culture's buildings: cross. Else the round family: a culture with round buildings of
// its own (measured, or round or yurt in its styles.js forms) takes the round hall (part round now and then), a courtyard culture the part round (octagon now and then),
// the rest the octagon (part round now and then).
const G = require('../lib/generate.js'), P = require('../lib/pieces.js'), S = require('../lib/styles.js');
const seeds = +(process.argv[2] || 3);
function planOf(d) {
  const walls = d.pieces.filter(p => ['wall', 'door', 'window'].includes(P.piece(p.name).role) && !p.decor && p.y < 2.5);
  // a wall turned off the square (an octagon's or a ring's) makes the plan round
  if (walls.some(p => { const a = (((p.yaw || 0) % 90) + 90) % 90; return a > 5 && a < 85; })) return 'round';
  const fl = d.pieces.filter(p => P.piece(p.name).role === 'floor' && !p.decor && !p.yard && p.y < 1.2 && p.y > -0.6);
  if (!fl.length) return 'compact';
  let area = 0, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const p of fl) {
    const s = P.piece(p.name).size, hx = s[0] / 2, hz = s[2] / 2;
    area += s[0] * s[2];
    x0 = Math.min(x0, p.x - hx); x1 = Math.max(x1, p.x + hx); z0 = Math.min(z0, p.z - hz); z1 = Math.max(z1, p.z + hz);
  }
  const w = x1 - x0, l = z1 - z0, box = w * l;
  if (area / box < 0.85) return 'branched';
  return Math.max(w, l) / Math.max(1, Math.min(w, l)) >= 1.5 ? 'long' : 'compact';
}
const rows = [], tall = {}, lines = {};
for (const [key, C] of Object.entries(S.CULTURES)) {
  if (!C.village) continue;
  const biome = C.biomes[0];
  const n = { round: 0, long: 0, branched: 0, compact: 0 };
  for (const type of Object.keys(S.TYPES)) {
    if (type === 'hub') continue;
    for (let seed = 1; seed <= seeds; seed++) {
      const d = G.generate({ type, biome, culture: key, stage: 's3', decor: 'd1', seed, skipDecor: true, yard: false });
      n[planOf(d)]++;
      if (type === 'tower') continue;
      let top = 0;
      for (const p of d.pieces) { const pi = P.piece(p.name); if (pi.structural) top = Math.max(top, p.y + pi.size[1] / 2); }
      if (top > (tall[key] || { top: 0 }).top) tall[key] = { top: +top.toFixed(1), type };
    }
  }
  const t = Object.values(n).reduce((a, c) => a + c, 0);
  const sh = k => Math.round(100 * n[k] / t);
  const lb = (n.long + n.branched) / t;
  // round buildings of its own: measured, or named in the culture's forms (the crannog's round houses on stilts read
  // as square decks here)
  const ownRound = n.round > 0 || Object.values(C.forms || {}).some(f => ['round', 'yurt'].includes(f));
  lines[key] = lb >= (S.HUB.crossFrom || 0.7) ? { cross: 1 } : ownRound ? { round: 3, part: 1 } : C.courtyard ? { part: 3, octagon: 1 } : { octagon: 3, part: 1 };
  rows.push({ key, biome, ...Object.fromEntries(Object.keys(n).map(k => [k, sh(k)])), lb: Math.round(100 * lb), line: JSON.stringify(lines[key]), tall: tall[key] });
}
console.log('culture            biome         round  long  branched  compact  long+br  line                       tallest other (not tower)');
for (const r of rows) console.log(`${r.key.padEnd(18)} ${r.biome.padEnd(13)} ${String(r.round).padStart(5)} ${String(r.long).padStart(5)} ${String(r.branched).padStart(9)} ${String(r.compact).padStart(8)} ${String(r.lb).padStart(8)}  ${r.line.padEnd(26)} ${r.tall.type} ${r.tall.top} m`);
const same = rows.every(r => JSON.stringify(S.HUB.lines[r.key]) === r.line && (S.HUB.capH || {})[r.key] === r.tall.top);
console.log(same ? '\nstyles.js HUB.lines and HUB.capH match' : `\nstyles.js HUB differs; measured:\nlines: ${JSON.stringify(lines)}\ncapH: ${JSON.stringify(Object.fromEntries(rows.map(r => [r.key, r.tall.top])))}`);
