// Rooms of the whole corpus, read with the decorator's own room reader (lib/decorate.js readLevel), one line per room,
// for the room study (docs/ROOM_STUDY.md, lab/rooms_corpus_stats.js).
//   node lab/rooms_corpus_extract.js <compact.jsonl> <out dir> [limit]
// compact.jsonl: one build per line in the shape of compact.json ({ file, title, cat, dls, votes, p: [[name, x, y, z,
// yaw], ...] }); /tmp is a good place for it, since it holds blueprint content.
// Writes <out>/rooms.jsonl (one room per line) and <out>/builds.jsonl (one build per line: piece counts by name for
// the whole build). Both hold builders' work: keep
// them out of the repo.
//
// A room line: b (build index), file, lvl (the floor's stand height), area (m2), cov (share of floor under a roof),
// ceil (ceiling over the floor, m), cells ([i, j] on the reader's 0.5 m grid), doors ([x, z, nx, nz, width, open]),
// faces ([x0, z0, ux, uz, nx, nz, a0, a1, half thickness, edge, runs]; a point on the wall line is x0 + t * ux, the
// room is on the nx side; runs are [kind, a0, a1, top] with kind wall, window, door, open, none or edge), stairs
// ([name, x, z, y0, y1]), and p: every decor piece within 0.75 m of the room's floor and every building piece standing
// inside it, as [name, x, y over the floor, z, yaw]. Building pieces inside a room are what builders make custom
// furniture from (a beam on two half walls is a bar, a 1x1 floor on a post is a side table).
// Coordinates are those of the build turned by rot degrees about its origin (builds.jsonl rot), so its walls run along x and z.
const fs = require('fs'), path = require('path'), readline = require('readline');
const lab = path.join(__dirname, '..');
const P = require(lab + '/lib/pieces.js'), D = require(lab + '/lib/decorate.js');
const { floorLevels } = D._int;

const [src, outDir, lim] = process.argv.slice(2);
if (!src || !outDir) { console.error('usage: node lab/rooms_corpus_extract.js <compact.jsonl> <out dir> [limit]'); process.exit(1); }
const LIMIT = +(lim || 1e9);
fs.mkdirSync(outDir, { recursive: true });
const roomsOut = fs.createWriteStream(path.join(outDir, 'rooms.jsonl'));
const buildsOut = fs.createWriteStream(path.join(outDir, 'builds.jsonl'));

// pieces the piece table calls misc or decor that are building blocks in the game
const BLOCK = /^(blackmarble_(base|out|tip|slope|2x2|basecorner|outcorner|post|column|floor|stair|arch|creep)|iron_grate|metalbar_|raise$|blackmarble_head_?big)/;
const quat = yaw => { const a = yaw * Math.PI / 360; return [0, Math.sin(a), 0, Math.cos(a)]; };
const r2 = v => Math.round(v * 100) / 100;
const isDecor = name => {
  if (BLOCK.test(name)) return false;
  const i = P.piece(name);
  return !i.structural && i.role !== 'nature';
};
const NATURE = name => P.piece(name).role === 'nature' || /^(sapling_|Pickable_|vines|VineAsh|VineGreen|vineash)/.test(name);

async function main() {
  const rl = readline.createInterface({ input: fs.createReadStream(src) });
  let bi = -1, nRooms = 0;
  const t0 = Date.now();
  for await (const line of rl) {
    if (!line.trim()) continue;
    bi++;
    if (bi >= LIMIT) break;
    const b = JSON.parse(line);
    const ps = b.p.map(([name, x, y, z, yaw]) => ({ name, x, y, z, yaw, q: quat(yaw), decor: isDecor(name) }));
    // turn the build so its walls run along the axes (as lab/mine_room_templates.js loadBuild): the reader's 0.5 m grid
    // then lies square to the walls, and widths read on it are exact
    const hist = new Map();
    for (const p of ps) if (!p.decor && /^(wall|door|window)$/.test(P.piece(p.name).role)) { const a = Math.round(((p.yaw % 90) + 90) % 90); hist.set(a, (hist.get(a) || 0) + 1); }
    let rot = [...hist.entries()].sort((a2, b2) => b2[1] - a2[1])[0];
    rot = rot ? rot[0] : 0;
    if (rot > 45) rot -= 90;
    if (Math.abs(rot) > 0.5) {
      const a = rot * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
      for (const p of ps) { const x = p.x, z = p.z; p.x = x * ca - z * sa; p.z = x * sa + z * ca; p.yaw = p.yaw - rot; p.q = quat(p.yaw); }
    }
    // the build line: piece counts
    const counts = {};
    for (const p of ps) counts[p.name] = (counts[p.name] || 0) + 1;
    const bl = { b: bi, file: b.file, title: b.title, cat: b.cat, dls: b.dls, votes: b.votes, n: ps.length, rot, counts };
    buildsOut.write(JSON.stringify(bl) + '\n');
    let levels = [];
    try { levels = floorLevels(ps.filter(p => !p.decor)); } catch (e) { levels = []; }
    const inRoom = new Set();
    for (const y of levels) {
      let models;
      try { models = D.readLevel(ps, y, null) || []; } catch (e) { continue; }
      for (const m of models) {
        if (m.area < 3) continue;
        const near = (x, z) => {
          if (m.inside(x, z)) return 2;
          for (const [dx, dz] of [[0.75, 0], [-0.75, 0], [0, 0.75], [0, -0.75], [0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]]) if (m.inside(x + dx, z + dz)) return 1;
          return 0;
        };
        const top = Math.max(m.ceiling, m.stand + 2.2) + 0.3;
        const pcs = [];
        for (const p of ps) {
          if (p.y < m.stand - 0.7 || p.y > top) continue;
          if (p.x < m.x0 - 1 || p.x > m.x1 + 1 || p.z < m.z0 - 1 || p.z > m.z1 + 1) continue;
          const k = near(p.x, p.z);
          if (!k) continue;
          const dec = p.decor || NATURE(p.name) || /^(piece_cloth_hanging|cloth_hanging|fenrirhide_hanging)/.test(p.name);
          if (!dec && k < 2) continue;
          if (!dec) {
            const role = P.piece(p.name).role;
            // walls, floors and roofs of the room itself are in faces; posts, beams, half walls, 1x1 floors and the
            // like standing inside are kept
            if (role === 'floor' && Math.abs(p.y + 0.0 - m.stand) < 0.35 && !/1x1|_1x1/.test(p.name)) continue;
            if (/^(roof|roofTop|roofCorner|gable)$/.test(role) && p.y > m.stand + 1.8) continue;
          }
          pcs.push([p.name, r2(p.x), r2(p.y - m.stand), r2(p.z), Math.round(p.yaw)]);
          if (k === 2 || dec) inRoom.add(p);
        }
        const faces = m.faces.map(f => [r2(f.px(0)), r2(f.pz(0)), r2(f.ux), r2(f.uz), r2(f.nx), r2(f.nz), r2(f.a0), r2(f.a1), r2(f.ht), f.edge ? 1 : 0,
          f.runs.map(r => [r.kind, r2(r.a0), r2(r.a1), r2(r.top)])]);
        const rec = {
          b: bi, file: b.file, lvl: r2(m.stand), area: m.area, cov: r2(m.covered), ceil: r2(m.ceiling - m.stand), cx: r2(m.cx), cz: r2(m.cz),
          cells: m.cells.map(c => [c.i, c.j]),
          doors: m.doors.map(d => [r2(d.x), r2(d.z), r2(d.nx), r2(d.nz), r2(d.w), d.open ? 1 : 0, d.p ? d.p.name : '']),
          faces, stairs: m.stairs.map(s => [s.p.name, r2(s.p.x), r2(s.p.z), r2(s.y0 - m.stand), r2(s.y1 - m.stand)]),
          p: pcs,
        };
        roomsOut.write(JSON.stringify(rec) + '\n');
        nRooms++;
      }
    }
    if (bi % 50 === 0) process.stderr.write(`${bi} builds, ${nRooms} rooms, ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
  }
  roomsOut.end(); buildsOut.end();
  console.log(`${bi + 1} builds, ${nRooms} rooms`);
}
main();
