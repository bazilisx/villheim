// Read and write PlanBuild .blueprint files.
function parse(text) {
  const meta = {}, pieces = [], snaps = [];
  let mode = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line[0] === '#') {
      const i = line.indexOf(':');
      const key = i < 0 ? line.slice(1) : line.slice(1, i);
      if (['Pieces', 'SnapPoints', 'Terrain'].includes(key)) mode = key;
      else meta[key] = line.slice(i + 1).replace(/^"|"$/g, '');
      continue;
    }
    const p = line.split(';');
    if (mode === 'Pieces' && p.length >= 9) {
      const n = p.slice(2, 9).map(Number);
      if (n.some(isNaN)) continue;
      const s = p.length >= 13 ? p.slice(10, 13).map(Number) : [1, 1, 1];
      pieces.push({ name: p[0], cat: p[1], x: n[0], y: n[1], z: n[2], q: n.slice(3, 7),
        s: s.some(isNaN) ? [1, 1, 1] : s, info: p[9] || '', data: p[13] || '' });
    } else if (mode === 'SnapPoints' && p.length === 3) snaps.push(p.map(Number));
  }
  return { meta, pieces, snaps };
}

const f = v => (Math.abs(v) < 1e-6 ? 0 : +v.toFixed(4)).toString();

// An item stand's item goes in the info field as PlanBuild saves it ("Tankard:0:1": item prefab, variant, quality);
// the mod puts it on the stand and locks it (src/Villheim.Logic/Designs/StandItems.cs).
function standText(p) {
  if (!p.item || !/^itemstand/.test(p.name)) return '';
  const it = typeof p.item === 'string' ? { name: p.item } : p.item;
  return `${it.name}:${it.variant || 0}:${it.quality || 1}`;
}

function write(bp) {
  const m = bp.meta || {};
  const out = [`#Name:${m.Name || 'Villheim design'}`, `#Creator:${m.Creator || 'Villheim generator'}`,
    `#Description:"${(m.Description || '').replace(/"/g, "'")}"`, `#Category:${m.Category || 'Villheim'}`];
  if (bp.snaps && bp.snaps.length) { out.push('#SnapPoints'); for (const s of bp.snaps) out.push(s.map(f).join(';')); }
  out.push('#Pieces');
  for (const p of bp.pieces) {
    const q = p.q || [0, 0, 0, 1], s = p.s || [1, 1, 1];
    out.push([p.name, p.cat || 'Building', f(p.x), f(p.y), f(p.z), f(q[0]), f(q[1]), f(q[2]), f(q[3]),
      JSON.stringify(p.info || standText(p)), f(s[0]), f(s[1]), f(s[2])].join(';') + (p.data ? ';' + p.data : ''));
  }
  return out.join('\n') + '\n';
}

if (typeof module !== 'undefined') module.exports = { parse, write };
else window.VHBlueprint = { parse, write };
