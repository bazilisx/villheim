// node lib/cli.js gen <type> <biome> <culture|-> <stage> <decor> <seed> <out-prefix>
// node lib/cli.js decorate <in.blueprint> <use> <d1|d2|d3> <biome> <out-prefix>
// node lib/cli.js plan <in.blueprint> <out.png> [ppm] [cut height above ground] [x0 x1 z0 z1]
const fs = require('fs');
const G = require('./generate.js'), BP = require('./blueprint.js'), D = require('./decorate.js'), Sh = require('./sheet.js');
const [cmd, ...a] = process.argv.slice(2);
if (cmd === 'gen') {
  const [type, biome, culture, stage, decor, seed, out] = a;
  const d = G.generate({ type, biome, culture: culture === '-' ? undefined : culture, stage, decor, seed: +seed });
  fs.writeFileSync(out + '.blueprint', BP.write(d));
  Sh.sheet(d.pieces, out + '.png', `${d.meta.Description} (${d.pieces.length} pieces)`);
  console.log(out, d.pieces.length, d.notes.join(' '));
} else if (cmd === 'decorate') {
  const [inp, use, decor, biome, out] = a;
  const bp = BP.parse(fs.readFileSync(inp, 'utf8'));
  const pieces = decor === 'd1' ? D.strip(bp.pieces) : D.decorateExisting(D.strip(bp.pieces), { use, decor, biome });
  fs.writeFileSync(out + '.blueprint', BP.write({ meta: { ...bp.meta, Name: bp.meta.Name + ' ' + decor }, pieces, snaps: bp.snaps }));
  Sh.sheet(pieces, out + '.png', `${bp.meta.Name} at ${decor} (${pieces.length} pieces, was ${bp.pieces.length})`);
  console.log(out, bp.pieces.length, '->', pieces.length);
}
else if (cmd === 'plan') {
  const [inp, out, ppm, cut, x0, x1, z0, z1] = a;
  const bp = BP.parse(fs.readFileSync(inp, 'utf8'));
  const crop = z1 != null ? { x0: +x0, x1: +x1, z0: +z0, z1: +z1 } : undefined;
  const g = Sh.groundOf(bp.pieces);
  const r = Sh.plan(bp.pieces, out, { ppm: +ppm || 50, cut: g + (cut != null ? +cut : 1.8), crop, title: `${bp.meta.Name || 'blueprint'}, from above` });
  console.log(out, Math.round(r.ppm), 'px/m', r.ms, 'ms');
}
