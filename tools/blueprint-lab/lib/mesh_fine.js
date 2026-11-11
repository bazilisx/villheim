// The fine parts for a bundle (lib/build_web.js, lib/build_engine.js): one JSON text per piece kind, for the pieces
// the lite set marks f (lib/mesh.js lite), so a bundle parses a kind's parts only when one of its pieces needs them.
function byKind(lite, fine) {
  const kinds = {};
  for (const [n, e] of Object.entries(lite)) {
    if (!e.f || !fine[n]) continue;
    (kinds[e.kd || 'misc'] = kinds[e.kd || 'misc'] || {})[n] = fine[n];
  }
  const out = {};
  for (const k of Object.keys(kinds).sort()) out[k] = JSON.stringify(kinds[k]);
  return JSON.stringify(out);
}
module.exports = { byKind };
