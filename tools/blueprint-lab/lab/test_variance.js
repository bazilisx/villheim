// Household variance as a number (no cookie cutter, D-068, D-072): the same house (line and stage) furnished for
// households with other traits should be less than 0.6 alike (lib/audit.js likeness: furniture list and arrangement).
// Usage, from tools/blueprint-lab: node lab/test_variance.js [--list]. Exit 1 when a house's mean is 0.6 or more.
const G = require('../lib/generate.js'), A = require('../lib/audit.js');
const HOUSEHOLDS = ['neat', 'messy', 'cosy', 'plants', 'crafts', 'collector'];
const lines = [['home-a', 'home', 101], ['home-b', 'home', 202], ['home-c', 'home', 303], ['hall', 'longhouse', 11]];
let bad = 0;
for (const [name, type, seed] of lines) for (const [stage, decor] of [['s2', 'd2'], ['s3', 'd3']]) {
  const sig = HOUSEHOLDS.map(h => A.signature(G.generate({ type, biome: 'Meadows', culture: 'norse', stage, decor, seed, persona: h, yard: false }).pieces));
  const vals = [];
  for (let i = 0; i < sig.length; i++) for (let j = i + 1; j < sig.length; j++) vals.push(A.likeness(sig[i], sig[j]));
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length, max = Math.max(...vals);
  if (mean >= 0.6) bad++;
  console.log(`${name} ${stage}${decor}: households ${mean.toFixed(2)} alike on average, ${max.toFixed(2)} the closest pair${mean >= 0.6 ? '  TOO ALIKE' : ''}`);
}
if (bad) process.exitCode = 1;
