// The critic's targets from the corpus: node lab/learn_critic.js <compact.json> [out]
// compact.json: [{ dls, file, title, p: [[name, x, y, z, yaw], ...] }] (made from corpus.json, one row per design).
// Takes house-like vanilla builds of 150 to 3,000 pieces with download counts; the top quarter by downloads sets the
// targets (median of each measure) and the busy-trim limit (90th percentile).
const fs = require('fs'), path = require('path');
const K = require('../lib/critic.js');
const D = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const MOD = /^(kg_|GB_|CastleKit|MB|mm_|BBH|rk_|Piece_vf|OdinsKingdom|h_|\$|Hayze|rae_|teq_|tkd_|rkc_)/;
const house = /house|home|cabin|cottage|hut|longhouse|lodge|tavern|hall|smith|farm|barn|inn/i;
const c = D.filter(d => d.dls > 0 && d.p.length >= 150 && d.p.length <= 3000 && !d.p.some(p => MOD.test(p[0])) && house.test(d.file + ' ' + (d.title || '')));
c.sort((a, b) => b.dls - a.dls);
const top = c.slice(0, Math.ceil(c.length / 4)).map(d => K.measure(d.p.map(p => ({ name: p[0], x: p[1], y: p[2], z: p[3], yaw: p[4] })))).filter(Boolean);
const q = (f, t) => { const v = top.map(m => m[f]).sort((a, b) => a - b); return +v[Math.min(v.length - 1, Math.floor(v.length * t))].toFixed(4); };
const fsN = Object.keys(top[0]);
const model = { builds: top.length, top: Object.fromEntries(fsN.map(f => [f, q(f, 0.5)])), p90: Object.fromEntries(fsN.map(f => [f, q(f, 0.9)])) };
fs.writeFileSync(process.argv[3] || path.join(__dirname, '../data/critic.json'), JSON.stringify(model, null, 1));
console.log(JSON.stringify(model));
