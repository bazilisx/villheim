// One program per room, one program per house: how corpus builders hold lights, fabrics and furniture woods together
// inside a room and across the rooms of one build (docs/ARCHITECTURE_STUDY.md, interiors; track H).
//   node lab/arch_rooms.js <rooms extract dir> <out json> [--catalog data/catalog/pieces.json]
// Reads lab/rooms_corpus_extract.js rooms.jsonl (covered rooms of 6 m2 or more). Per room, the kinds of light, banner,
// rug and drape and the furniture families (track A catalog) it holds: how often one kind leads, and whether the room
// takes the build's own lead kind (a household program) more often than when the same rooms are dealt between builds
// at random (a fixed shuffle). Counts and shares only.
const fs = require('fs'), path = require('path'), readline = require('readline');
const L = require('./rooms_corpus_lib.js');
const { typeOf, LIGHTK, qs, inc } = L;
const args = process.argv.slice(2);
const [exDir, outFile] = args;
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
L.loadCatalog(opt('--catalog') || path.join(__dirname, '../data/catalog/pieces.json'));
const r3 = v => Math.round(v * 1000) / 1000, sh = (a, b) => (b ? r3(a / b) : null);
const FURN = new Set(['table', 'seat', 'bed', 'chest', 'throne']);
const channels = {
  light: p => (typeOf(p) === 'light' ? LIGHTK(p) : null),
  banner: p => (typeOf(p) === 'banner' ? p : null),
  rug: p => (typeOf(p) === 'rug' ? p : null),
  drape: p => (typeOf(p) === 'drape' ? p : null),
  wood: p => (FURN.has(typeOf(p)) ? L.familyOf(p) : null),
};

async function main() {
  const builds = new Map();
  for await (const line of readline.createInterface({ input: fs.createReadStream(path.join(exDir, 'rooms.jsonl')) })) {
    if (!line) continue;
    const r = JSON.parse(line);
    if (r.cov < 0.5 || r.area < 6) continue;
    if (r.p.some(p => !L.isVanilla(p[0]))) continue;
    const rec = {};
    for (const [c, f] of Object.entries(channels)) { const m = {}; for (const p of r.p) { const k = f(p[0]); if (k) inc(m, k); } rec[c] = m; }
    if (!builds.has(r.b)) builds.set(r.b, []);
    builds.get(r.b).push(rec);
  }
  const out = {};
  const B = [...builds.values()];
  for (const c of Object.keys(channels)) {
    const rooms = [], lead = [], kindsPer = [];
    let roomsN = 0, oneKind = 0, multi = 0;
    for (const rs of B) for (const r of rs) {
      const n = Object.values(r[c]).reduce((t, x) => t + x, 0);
      if (n < 2) continue;
      roomsN++;
      const ks = Object.entries(r[c]).sort((a, b) => b[1] - a[1]);
      kindsPer.push(ks.length); lead.push(ks[0][1] / n);
      if (ks.length === 1) oneKind++;
    }
    // the household: builds with 3 or more rooms holding this channel; share of rooms whose lead is the build's lead
    let hRooms = 0, hSame = 0, sRooms = 0, sSame = 0, hb = 0;
    const pool = [];
    for (const rs of B) for (const r of rs) if (Object.keys(r[c]).length) pool.push(r[c]);
    let s = 12345;
    const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    const leadOf = m => Object.entries(m).sort((a, b) => b[1] - a[1])[0][0];
    for (const rs of B) {
      const with_ = rs.filter(r => Object.keys(r[c]).length);
      if (with_.length < 3) continue;
      hb++;
      const tot = {};
      for (const r of with_) for (const [k, v] of Object.entries(r[c])) inc(tot, k, v);
      const bl = leadOf(tot);
      for (const r of with_) { hRooms++; if (leadOf(r[c]) === bl) hSame++; }
      // the same count of rooms drawn from all builds
      const fake = with_.map(() => pool[Math.floor(rnd() * pool.length)]);
      const ft = {};
      for (const m of fake) for (const [k, v] of Object.entries(m)) inc(ft, k, v);
      const fl = leadOf(ft);
      for (const m of fake) { sRooms++; if (leadOf(m) === fl) sSame++; }
    }
    out[c] = { rooms: roomsN, oneKind: sh(oneKind, roomsN), kindsPerRoom: qs(kindsPer), leadShare: qs(lead.map(r3)),
      household: { builds: hb, rooms: hRooms, roomTakesBuildLead: sh(hSame, hRooms), ifShuffled: sh(sSame, sRooms) } };
  }
  fs.writeFileSync(outFile, JSON.stringify({ meta: { made: new Date().toISOString().slice(0, 10), source: 'lab/arch_rooms.js', builds: builds.size, catalog: L.familySource() },
    fields: { channel: 'per channel (light kind, banner prefab, rug prefab, drape prefab, furniture family): rooms holding 2 or more, share with one kind, kinds per room, share of the lead kind; household: builds with 3 or more rooms holding the channel, share of rooms whose lead kind is the build\'s lead, and the same with rooms drawn from all builds at random' },
    ...out }, null, 1));
  console.log(outFile, builds.size, 'builds');
}
main();
