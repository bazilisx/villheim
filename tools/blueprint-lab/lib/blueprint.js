// Read and write PlanBuild .blueprint files.
function parse(text) {
  const meta = {}, pieces = [], snaps = [], clips = [], sets = {};
  let mode = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line[0] === '#') {
      const i = line.indexOf(':');
      const key = i < 0 ? line.slice(1) : line.slice(1, i);
      if (['Pieces', 'SnapPoints', 'Terrain', 'VillheimClips', 'VillheimPaths', 'VillheimSets'].includes(key)) mode = key;
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
    else if (mode === 'VillheimSets' && p.length >= 2) sets[p[0]] = (sets[p[0]] || 0) + (+p[1] || 0);
    else if (mode === 'VillheimClips' && p.length >= 5) clips.push({ name: p[0], x: +p[1], y: +p[2], z: +p[3], d: +p[4], f: +(p[5] || 0) });
  }
  // clips made on purpose (D-098): the depth a piece may go into what shows of the walls, matched by prefab and place
  for (const c of clips) {
    const q = pieces.find(o => o.name === c.name && Math.abs(o.x - c.x) < 0.002 && Math.abs(o.y - c.y) < 0.002 && Math.abs(o.z - c.z) < 0.002);
    if (q && c.d > 0) q.wclip = c.d;
    if (q && c.f > 0) q.fclip = c.f;
  }
  // the interior library's sets in the design and how many decor pieces each brought (the pool audit's richness)
  if (Object.keys(sets).length) Object.defineProperty(pieces, 'sets', { value: sets, enumerable: false });
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
  // Clips made on purpose (D-098): a kit set's piece that goes into what shows of a wall as deep as its source builds
  // put it carries the depth, so lib/audit.js lets it pass up to that mark. A section of its own, before the pieces:
  // PlanBuild skips sections it does not know (as '#VillheimPaths'), and the mod's reader (Designs/Blueprints.cs)
  // reads only '#Pieces' and '#VillheimPaths'; the info field is no place for it, since the mod reads a sign's info
  // as its heading and a stand's as its item.
  // Each line: prefab;x;y;z;depth into walls;depth into the set's own furniture (as the audit's furniture boxes).
  const marked = bp.pieces.filter(p => p.wclip > 0 || p.fclip > 0);
  if (marked.length) { out.push('#VillheimClips'); for (const p of marked) out.push([p.name, f(p.x), f(p.y), f(p.z), f(p.wclip || 0), f(p.fclip || 0)].join(';')); }
  // The interior library's sets in the design (lib/kitbash.js: mined 'KB-', creative 'KC-', hand-made 'BK-') and how
  // many decor pieces each brought, for the pool audit's richness measures (lib/audit.js). Skipped by PlanBuild and
  // the mod as the section above.
  const sets = {};
  for (const p of bp.pieces) if (p.kb && !p.trim) { const id = String(p.kb).split('@')[0]; sets[id] = (sets[id] || 0) + 1; }
  if (Object.keys(sets).length) { out.push('#VillheimSets'); for (const id of Object.keys(sets).sort()) out.push(`${id};${sets[id]}`); }
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
