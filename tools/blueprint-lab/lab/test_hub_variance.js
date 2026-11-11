// How much village hubs differ (D-155, Tyler 2026-11-11: "even same cultural villages have different interior layouts,
// design, decor"): node lab/test_hub_variance.js [seeds]
// For each village culture, seeds 1 to 8 (each its own village lineage) at s5, d3: the layout signature lib/hub.js
// drawLayout records (seat place and raise, hearth form, table plan and count, gallery and walkway, stair side, side
// rooms' side, count and kind). Reports how many distinct signatures and how many distinct values of each choice appear;
// fails when two seeds of one culture come out the same in every choice.
const G = require('../lib/generate.js'), S = require('../lib/styles.js');
const seeds = +(process.argv[2] || 8);
let failed = 0;
const parts = ['seat', 'raise', 'hearth', 'tables', 'gallery', 'stair', 'rooms'];
console.log('culture            line(s)            distinct  ' + parts.join(' / '));
for (const [key, C] of Object.entries(S.CULTURES)) {
  if (!C.village) continue;
  const sigs = [], lines = new Set();
  for (let seed = 1; seed <= seeds; seed++) {
    const d = G.generate({ type: 'hub', biome: C.biomes[0], culture: key, stage: 's5', decor: 'd3', seed, lineage: seed, skipDecor: true });
    sigs.push(d.request.layout.split(', ')); lines.add(d.request.line);
  }
  const whole = new Set(sigs.map(s => s.join('|')));
  const per = parts.map((_, i) => new Set(sigs.map(s => s[i])).size);
  if (whole.size < sigs.length) { failed++; console.log(`FAIL ${key}: ${sigs.length - whole.size} seeds repeat another seed in every choice`); }
  console.log(`${key.padEnd(18)} ${[...lines].join(',').padEnd(18)} ${String(whole.size).padStart(4)} of ${seeds}  ${per.join(' / ')}`);
}
console.log(failed ? `\n${failed} cultures with repeated hubs` : '\nevery seed of every culture differs in at least one choice');
process.exit(failed ? 1 : 0);
