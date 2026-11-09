// Villheim building details: the trim, framing and small additions that make a generated shell look built by hand.
// Called by generate.js after the walls and roof are up (exterior, partition) and after the furnishing (interior).
//
// Every rule here comes from the corpus (557 well-liked community builds, docs/BLUEPRINT_LAB.md "Details") or from
// Norse building practice (docs/BUILDING_DETAILS.md):
//   - windows: the commonest window is 1 m tall from 1 m up; builders frame it with posts at the sides (27 % of
//     openings have a 2 m pole beside them), a beam under it (sill) and over it, a post in the middle of a 2 m opening
//     (two 1 m lights), and shutters (Wood Shutter, 1 x 1 m) beside it
//   - doors: posts at both sides (34 % of doors), a beam over the door at its top edge and one at its foot, a floor or
//     step in front (43 %), a lamp or torch beside it
//   - corners: 64 % of outside wall corners carry a post (wood pole, log pole, dark wood pole)
//   - walls: beams laid in the wall plane at its foot and at 1 m and 2 m (the timber frame bands)
//   - gables: a 45 or 26 degree beam along each roof edge at the gable end (the bargeboard: the corpus puts it at the
//     roof piece's side edge, turned 90 degrees); crossed boards over the ridge on Norse and Slavic houses
//   - halls: leaning outer posts against the long walls (Ribe, Trelleborg), raised benches along the long walls inside
//   - homes: a bench and a lamp by the door, a kerb round the fire pit, a back room behind a partition in big houses
// Pieces are put with b.put, so the same piece in the same place goes in once only. Trim pieces carry trim: true.

const NODE_D = typeof module !== 'undefined';
const PD = NODE_D ? require('./pieces.js') : window.VHPieces;
const checksD = () => (NODE_D ? require('./checks.js') : window.VHChecks);

const normD = a => ((a % 360) + 360) % 360;
const quatD = yaw => { const a = yaw * Math.PI / 360; return [0, +Math.sin(a).toFixed(6), 0, +Math.cos(a).toFixed(6)]; };
const BIOMES_D = ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains', 'Mistlands', 'Ashlands'];
const reachesD = (biome, b) => BIOMES_D.indexOf(biome) >= BIOMES_D.indexOf(b);

// Cultures by the trim they use. Northern timber cultures get the full set; stone and flat-roofed cultures keep their
// own forms and get only the door and window frames.
const NORTH = ['norse', 'norse-forest', 'norse-highland', 'anglo-saxon', 'slavic', 'baltic', 'fen-folk', 'celtic',
  'celtic-crannog', 'frankish-norman', 'black-forest', 'mountain', 'swamp', 'castle-medieval', 'saami'];
const CROSSED = ['norse', 'norse-forest', 'norse-highland', 'slavic', 'baltic', 'black-forest', 'mountain'];
const BRACED = ['norse', 'norse-forest', 'norse-highland', 'anglo-saxon', 'black-forest'];
const SHUTTERS = ['norse', 'norse-forest', 'norse-highland', 'slavic', 'baltic', 'anglo-saxon', 'frankish-norman',
  'celtic', 'fen-folk', 'black-forest', 'mountain', 'swamp', 'castle-medieval'];

// What a building gets, from its culture, type, size stage (s1 to s3) and decor stage (d1 to d3).
function profile(ctx) {
  const { C, cultureKey, T, stage, decor, biome, R } = ctx;
  const sN = +stage[1], dN = +decor[1];
  const north = NORTH.includes(cultureKey);
  const wood = /plank|half-timber|log/.test(C.wallStyle || 'plank');
  const roll = p => R() < p;
  return {
    sN, dN, north, wood,
    windowFrame: (sN >= 2 || C.frame) && !C.arches,
    mullion: !C.glass && C.windowStyle !== 'single' && !C.arches,
    shutters: sN >= 2 && dN >= 2 && SHUTTERS.includes(cultureKey) && reachesD(biome, 'Black Forest') && !C.glass && roll(0.6),
    doorFrame: !C.arches,
    doorHood: north && sN >= 2 && !C.awnings && roll(0.7),
    doorstep: sN >= 2,
    doorLamp: dN >= 2,
    cornerPosts: wood && !C.frame && !T.tower,
    bands: wood && sN >= 2 && !C.frame,
    midRail: C.wallStyle === 'half-timber' && sN >= 2,
    bargeboards: north && (sN >= 2 || C.carved),
    crossed: CROSSED.includes(cultureKey) && sN >= 2,
    svalgang: ['norse', 'norse-forest', 'norse-highland', 'slavic', 'baltic'].includes(cultureKey) && ctx.storeys >= 2 &&
      ['home', 'storage', 'tavern'].includes(ctx.type) && (sN >= 3 || (sN === 2 && dN >= 3)) && ['rect', 'long', 'L', 'T'].includes(ctx.plan) &&
      !C.awnings && !ctx.flat && roll(0.75),
    gableWindow: north && sN >= 2,
    roofCross: false, // Wood Roof Cross at the gable apex: off until its shape is checked against the game model

    braces: BRACED.includes(cultureKey) && sN >= 2 && (T.use === 'hall' || ctx.type === 'longhouse'),
    benchOut: dN >= 2 && ['home', 'hall'].includes(T.use),
    fireKerb: dN >= 2,
    wallBenches: (ctx.type === 'longhouse' || (T.use === 'hall' && ['long', 'rect'].includes(ctx.plan))) && sN >= 2,
    partition: ['home', 'tavern'].includes(ctx.type) && (sN >= 3 || (sN === 2 && dN >= 3)) && ['rect', 'long', 'L', 'T'].includes(ctx.plan),
  };
}

// The kit's beam for a slope: 45 or 26 degrees, in the wood the frame uses.
function slopeBeam(K, deg) {
  const b = K.beam || 'wood_beam';
  if (/darkwood/.test(b)) return `darkwood_beam_${deg}`;
  if (/ashwood/.test(b)) return `ashwood_wall_beam_${deg}`;
  return `wood_beam_${deg}`;
}
function framePoleD(K, C) { return C.darkFrame && reachesD(C.biome || 'Meadows', 'Plains') ? 'darkwood_pole' : (K.pole || 'wood_pole2'); }

// along-the-wall and outward unit vectors of an outer edge
function axes(e) {
  const ux = e.yaw === 0 ? 1 : 0, uz = e.yaw === 0 ? 0 : 1;
  return { ux, uz, ox: e.out[0], oz: e.out[1] };
}
function outYaw(ox, oz) { return normD(Math.atan2(ox, oz) * 180 / Math.PI); } // a piece facing local +z faces out

// A box test against what is already there (furniture, doors, stairs, other trim), for pieces that stand free.
function clear(b, cand, roles, pad = 0.05) {
  const Ck = checksD(), cb = Ck.aabb(cand);
  return !b.pieces.some(p => {
    if (roles && !roles.includes(PD.piece(p.name).role)) return false;
    const o = Ck.aabb(p);
    return o.x0 < cb.x1 - pad && o.x1 > cb.x0 + pad && o.y0 < cb.y1 - pad && o.y1 > cb.y0 + pad && o.z0 < cb.z1 - pad && o.z1 > cb.z0 + pad;
  });
}

// ---------------------------------------------------------------- exterior

function exterior(b, ctx) {
  const { K, C, F, SH, storeys, edges, verts, door } = ctx;
  const X = ctx.profile || profile(ctx);
  ctx.profile = X;
  const put = (name, x, y, z, yaw) => { if (name) b.put(name, x, y, z, yaw, { trim: true }); };
  const beam = K.beam || 'wood_beam', pole1 = K.pole1 || 'wood_pole', pole = framePoleD(K, C);
  const edgeAt = new Map(edges.map(e => [`${e.x},${e.z}`, e]));
  const openings = b.openings || [];
  const isOpen = new Set(openings.map(o => `${o.e.x},${o.e.z},${o.y0}`));
  const added = { windows: 0, doors: 0, corners: 0, gables: 0, braces: 0, gallery: 0 };
  if (X.svalgang && ctx.wallSegment) added.gallery = svalgang(b, ctx) ? 1 : 0;

  // ---- windows
  for (const o of openings) {
    if (o.kind !== 'window') continue;
    const { e, y0 } = o, { ux, uz, ox, oz } = axes(e);
    const stone = /stone|marble|grausten/.test(C.wallStyle || '') && !(b.woodBays && b.woodBays.has(`${Math.round(e.x * 10)},${Math.round(e.z * 10)}`));
    const f = 0.2; // trim stands proud of the wall face (the corpus puts it 0.25 to 0.5 m out)
    if (X.mullion && C.windowStyle !== 'single') put(pole1, e.x, y0 + 1.5, e.z, 0); // two 1 m lights
    if (X.windowFrame) {
      put(beam, e.x + ox * f, y0 + 0.9, e.z + oz * f, e.yaw); // sill under the opening
      put(beam, e.x + ox * f, y0 + 2.1, e.z + oz * f, e.yaw); // head over it
      if (!C.frame || stone) for (const s of [-1, 1]) put(pole1, e.x + ux * s * 1 + ox * f, y0 + 1.5, e.z + uz * s * 1 + oz * f, 0); // side posts
    }
    if (X.shutters && !stone && o.storey === 0 + o.storey) {
      // open shutters flat against the wall either side, only where wall continues beside the window
      for (const s of [-1, 1]) {
        const n = edgeAt.get(`${e.x + ux * s * 2},${e.z + uz * s * 2}`);
        if (!n || n.yaw !== e.yaw || isOpen.has(`${n.x},${n.z},${y0}`)) continue;
        put('wood_window', e.x + ux * s * 1.5 + ox * 0.12, y0 + 1.5, e.z + uz * s * 1.5 + oz * 0.12, e.yaw);
      }
    }
    added.windows++;
  }

  // ---- doors
  for (const o of openings) {
    if (o.kind === 'window') continue;
    const { e, y0 } = o, { ux, uz, ox, oz } = axes(e);
    const h = o.kind === 'gate' ? 3 : 2;
    if (X.doorFrame && o.kind === 'door') {
      if (!C.frame) for (const s of [-1, 1]) put(pole, e.x + ux * s * 1.05 + ox * 0.1, y0 + 1, e.z + uz * s * 1.05 + oz * 0.1, 0);
      put(beam, e.x + ox * 0.12, y0 + h + 0.1, e.z + oz * 0.12, e.yaw); // the lintel, its underside at the door's top
    }
    if (o.storey > 0) continue;
    const outside = { x: e.x + ox, z: e.z + oz };
    // a step or landing in front of a ground-level door, unless a porch, stair or deck is already there
    const busy = b.pieces.some(p => Math.hypot(p.x - outside.x, p.z - outside.z) < 1.1 && ['floor', 'stair'].includes(PD.piece(p.name).role) && Math.abs(p.y - F) < 1.2);
    if (X.doorstep && F < 0.01 && !busy) put(K.floor, outside.x, F, outside.z, 0);
    // a small roof over the door (pent hood) with a rafter under each side, where no porch or awning covers it
    const covered = b.pieces.some(p => /roof/.test(p.name) && Math.hypot(p.x - outside.x, p.z - outside.z) < 1.2 && p.y > y0 + 2 && p.y < y0 + SH + 0.6);
    if (X.doorHood && !covered && !(b.gallery && o.storey === 0) && SH >= 3 && !(ctx.flat && storeys === 1 && false)) {
      const yaw = normD(Math.atan2(ox, oz) * 180 / Math.PI + 180);
      put(K.roof26, outside.x, y0 + SH - 0.5, outside.z, yaw);
      const r26 = slopeBeam(K, 26);
      for (const s of [-1, 1]) put(r26, outside.x + ux * s * 1, y0 + SH - 0.5, outside.z + uz * s * 1, yaw + 90);
      b.notes.push('A small roof over the door.');
    }
    // a lamp post beside the door on the ground
    if (X.doorLamp && F < 0.01 && !o.back) {
      for (const s of [1, -1]) {
        const cand = { name: 'piece_groundtorch_wood', x: +(e.x + ux * s * 1.8 + ox * 0.8).toFixed(3), y: F + 0.75, z: +(e.z + uz * s * 1.8 + oz * 0.8).toFixed(3), q: quatD(0), yaw: 0 };
        if (!clear(b, cand)) continue;
        b.pieces.push({ ...cand, decor: true, trim: true });
        break;
      }
    }
    // a bench against the wall beside the front door, facing out (a place to sit in the evening)
    if (X.benchOut && F < 0.01 && !o.back && o.kind === 'door') {
      const name = reachesD(ctx.biome, 'Black Forest') && ctx.R() < 0.4 ? 'piece_logbench01' : 'piece_bench01';
      const faceOut = name === 'piece_logbench01' ? outYaw(-ox, -oz) : outYaw(ox, oz); // the log bench faces its local -z
      for (const s of ctx.R() < 0.5 ? [1, -1] : [-1, 1]) {
        const cand = { name, x: +(e.x + ux * s * 3 + ox * 0.45).toFixed(3), y: F + 0.1, z: +(e.z + uz * s * 3 + oz * 0.45).toFixed(3), yaw: faceOut, q: quatD(faceOut) };
        if (!edgeAt.has(`${e.x + ux * s * 2},${e.z + uz * s * 2}`) || !edgeAt.has(`${e.x + ux * s * 4},${e.z + uz * s * 4}`)) continue; // wall behind it
        if (!clear(b, cand)) continue;
        b.pieces.push({ ...cand, decor: true, trim: true });
        break;
      }
    }
    added.doors++;
  }

  // ---- corner posts, from the foot of the walls to their top, on every outside corner
  if (X.cornerPosts) {
    const dirs = new Map();
    for (const e of edges) {
      const { ux, uz } = axes(e);
      for (const s of [-1, 1]) { const k = `${e.x + ux * s},${e.z + uz * s}`; if (!dirs.has(k)) dirs.set(k, new Set()); dirs.get(k).add(e.yaw); }
    }
    const top = F + storeys * SH, p = C.wallStyle === 'log' ? (K.pole || pole) : pole;
    for (const [k, ys] of dirs) {
      if (ys.size < 2) continue;
      const [x, z] = k.split(',').map(Number);
      for (let y = F; y < top - 0.01;) { const h = top - y >= 2 ? 2 : 1; put(h === 2 ? p : pole1, x, y + h / 2, z, 0); y += h; }
      added.corners++;
    }
  }

  // ---- bands: a beam at the foot of the walls and along the floor line of each upper storey; a rail at 1 m on
  // half-timbered walls. Laid a little proud of the outside face, never across a door.
  if (X.bands || X.midRail) for (const e of edges) {
    const { ox, oz } = axes(e);
    for (let s = 0; s < storeys; s++) {
      const y0 = F + s * SH;
      const opening = openings.find(o => o.e === e && o.y0 === y0);
      if (X.bands && !(opening && opening.kind !== 'window')) put(beam, e.x + ox * 0.08, y0 + 0.1, e.z + oz * 0.08, e.yaw);
      if (X.midRail && !opening) put(beam, e.x + ox * 0.08, y0 + 1, e.z + oz * 0.08, e.yaw);
    }
  }

  // ---- leaning outer posts against the long walls of halls (a 45 degree beam from the ground to 2 m up the wall)
  if (X.braces && F < 1.6 && !ctx.flat) {
    const w0 = ctx.wings[0];
    const doors = openings.filter(o => o.kind !== 'window').map(o => o.e);
    const brace = slopeBeam(K, 45);
    for (const [x, z] of verts) {
      // on the long sides of the main wing only, not at its corners, every other post
      const onLong = Math.abs(Math.abs(z - w0.cz) - w0.D) < 0.01 && Math.abs(x - w0.cx) < w0.W - 0.5;
      if (!onLong || Math.round(x) % 4 !== 0) continue;
      if (doors.some(d => Math.hypot(d.x - x, d.z - z) < 2.2)) continue;
      const nz = z > w0.cz ? 1 : -1, cand = { name: brace, x, y: 1, z: z + nz * 1.05, yaw: normD(Math.atan2(nz, -0) * 180 / Math.PI) };
      // the beam rises toward its local +x: turned so +x points back at the wall
      cand.yaw = normD(Math.atan2(nz, 0) * 180 / Math.PI); // yaw with local +x = (0, -nz)
      if (!clear(b, { ...cand, q: quatD(cand.yaw) }, ['door', 'stair', 'floor', 'storage', 'craft', 'seat', 'table', 'light', 'fence'])) continue;
      put(brace, cand.x, cand.y, cand.z, cand.yaw);
      added.braces++;
    }
    if (added.braces) b.notes.push('Leaning posts against the long walls, after the Viking halls at Trelleborg.');
  }

  b.detailReport = added;
  return added;
}

// The upper gallery of a Norwegian loft (svalgang): a balcony three bays wide over the front door, on posts from the
// ground with a beam under its edge and a rail round it, reached by a door from the upper room. Below, it roofs the
// entrance like a porch.
function svalgang(b, ctx) {
  const { K, C, F, SH, edges, door, ladders, cells } = ctx, w0 = ctx.wings[0];
  if (!door || door.out[1] >= 0) return false;
  const yU = F + SH, zf = door.z;
  const front = new Map(edges.filter(e => e.out[1] < 0 && Math.abs(e.z - zf) < 0.01).map(e => [e.x, e]));
  // three bays of the front wall with the door among them, the door in the middle where it can be
  const xs = [[-2, 0, 2], [-4, -2, 0], [0, 2, 4]].map(o => o.map(d => door.x + d)).find(c => c.every(x => front.has(x)));
  if (!xs) return false;
  const x0 = xs[0] - 1, x1 = xs[2] + 1;
  // nothing in front of the door already (a porch, a stair, a walkway)
  if (b.pieces.some(p => p.z < zf - 0.5 && p.z > zf - 2.6 && p.x > x0 + 0.3 && p.x < x1 - 0.3 && p.y < yU + 1)) return false;
  // the upper door: a bay beside the middle whose inside cell is no ladder hole or landing
  const L = ladders || [];
  const freeCell = x => cells.has(`${x},${zf + 1}`) && !L.some(l => [l.hole, l.land, l.stand].some(c => c[0] === x && c[1] === zf + 1));
  const ux = xs.filter(x => x !== door.x).sort((a, c) => Math.abs(a - door.x) - Math.abs(c - door.x)).find(freeCell);
  if (ux == null) return false;
  // take out the upper bay's wall and window pieces, and build it again as a door
  const inBay = p => Math.abs(p.x - ux) < 1.01 && Math.abs(p.z - zf) < 0.3 && p.y > yU + 0.05 && p.y < yU + SH - 0.05 &&
    ['wall', 'window', 'door'].includes(PD.piece(p.name).role) && !p.decor;
  b.pieces = b.pieces.filter(p => !inBay(p));
  b.openings = (b.openings || []).filter(o => !(o.e.x === ux && Math.abs(o.y0 - yU) < 0.01));
  const e = front.get(ux);
  ctx.wallSegment(b, K, C, ux, yU, zf, e.yaw, SH, 'door');
  b.openings.push({ e, y0: yU, SH, storey: 1, kind: 'door', gallery: true });
  const pole = framePoleD(K, C), pole1 = K.pole1 || 'wood_pole', beam = K.beam || 'wood_beam', T = { trim: true };
  // floor, posts at the outer corners of each bay, beams under the edge and back to the wall, a rail round it
  for (const x of xs) b.put(K.floor, x, yU, zf - 1, 0, T);
  for (const x of [x0, xs[0] + 1, xs[1] + 1, x1]) {
    for (let y = 0; y < yU - 0.01;) { const h = yU - y >= 2 ? 2 : 1; b.put(h === 2 ? pole : pole1, x, y + h / 2, zf - 2, 0, T); y += h; }
    b.put(pole1, x, yU + 0.5, zf - 2, 0, T); // the rail's post
  }
  for (const x of xs) b.put(beam, x, yU - 0.15, zf - 2, 0, T);
  for (const x of [x0, x1]) b.put(beam, x, yU - 0.15, zf - 1, 90, T);
  const rail = K.fence || 'wood_fence';
  for (const x of xs) b.put(rail, x, yU + 0.5, zf - 2, 0, T);
  for (const x of [x0, x1]) b.put(rail, x, yU + 0.5, zf - 1, 90, T);
  b.gallery = true;
  b.notes.push('An upper gallery over the front door with a door from the upper room, after the Norwegian lofts.');
  return true;
}

// Bargeboards for one wing's gable ends, as roof parts (generate.js lays them with the rest of the roof so crossing
// wings hide them where another roof runs over). Arguments as gablePieces: K, C, the wing, the roof top, rise per row,
// which ends get a gable, and helpers to place a part in wing-local coordinates.
function bargeboards(K, C, w, ctx, rows, ends, add, low, pivot, r) {
  const X = ctx.profile;
  if (!X || !X.bargeboards) return;
  const name = slopeBeam(K, r === 2 ? 45 : 26);
  [-1, 1].forEach((sg, k) => {
    if (!ends[k]) return;
    const u = sg * (w.W + 0.06);
    for (let i = 0; i <= rows; i++) for (const sv of [-1, 1]) {
      const v = sv * (2 + 2 * i), roofYaw = sv < 0 ? 180 : 0;
      add(name, u, pivot(i), v, roofYaw + 90, 'trim', low(i) + r);
    }
    // the roof cross on the apex of a thatched gable, as a quarter of the corpus builds do (the ridge cap turned 90
    // degrees at the gable end)
    if (X.roofCross && /^wood_roof/.test(K.roof45 || '')) add(r === 2 ? 'wood_wall_roof_top_45' : 'wood_wall_roof_top', sg * w.W, low(-1) + (r === 2 ? 0 : 0) + 0, 0, 90, 'trim', low(-1) + 0.4);
    // crossed boards over the ridge: each slope's board carried one row past the ridge, so the two cross
    if (X.crossed && r === 2 && !ctx.dragonsHere) for (const sv of [-1, 1]) add(name, u, pivot(-1), 0, (sv < 0 ? 180 : 0) + 90, 'trim', low(-1) + r);
  });
}

// ---------------------------------------------------------------- partition (before the furnishing)

// A big house gets a back room: a wall across the main wing two cells from one end, with a door in the middle bay.
function partition(b, ctx, wallSegment) {
  const X = ctx.profile;
  if (!X || !X.partition) return false;
  const { K, C, F, SH, cells, door, ladders, flue } = ctx, w0 = ctx.wings[0];
  if (w0.alpha !== 0 || w0.W < 5 || w0.D < 3) return false;
  const sides = ctx.R() < 0.5 ? [1, -1] : [-1, 1];
  for (const sg of sides) {
    const xp = w0.cx + sg * (w0.W - 4); // two 2 m cells deep
    if (Math.abs(xp - door.x) < 2.5) continue;
    if (flue && xp > flue.x0 - 1 && xp < flue.x1 + 1) continue;
    const zs = [...cells.values()].filter(([x, z]) => Math.abs(x - (xp - sg)) < 0.01 && Math.abs(z - w0.cz) < w0.D).map(([, z]) => z).sort((a, c) => a - c);
    if (zs.length < 3) continue;
    // ladders keep their foot, hole and landing
    const blocked = (ladders || []).some(L => [L.stand, L.hole, L.land].some(c => Math.abs(c[0] - xp) < 1.01));
    if (blocked) continue;
    const mid = zs.slice().sort((a, c) => Math.abs(a - w0.cz) - Math.abs(c - w0.cz))[0];
    for (const z of zs) wallSegment(b, K, C, xp, F, z, 90, SH, z === mid ? 'door' : 'wall');
    b.pieces.push(...[]);
    b.notes.push('A back room behind a wall with a door.');
    b.partitionX = xp;
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- interior (after the furnishing)

function interior(b, ctx) {
  const X = ctx.profile;
  if (!X) return;
  const { K } = ctx, Ck = checksD();
  const furniture = () => b.pieces.filter(p => p.decor);
  // a kerb of beams round a fire pit on the floor, so it reads as a hearth set into the floor
  if (X.fireKerb) {
    const fire = b.pieces.find(p => p.decor && p.name === 'fire_pit');
    if (fire) {
      const beam = K.beam || 'wood_beam', y = fire.y + 0.0;
      const ring = [[0, -1.15, 0], [0, 1.15, 0], [-1.15, 0, 90], [1.15, 0, 90]].map(([dx, dz, yaw]) => ({ name: beam, x: fire.x + dx, y, z: fire.z + dz, yaw, q: quatD(yaw) }));
      const ok = ring.every(c => { const cb = Ck.aabb(c); return !furniture().some(p => p !== fire && !/cookingstation|cauldron/.test(p.name) && PD.piece(p.name).role !== 'rug' && (o => o.x0 < cb.x1 && o.x1 > cb.x0 && o.z0 < cb.z1 && o.z1 > cb.z0 && o.y0 < cb.y1 + 0.3 && o.y1 > cb.y0)(Ck.aabb(p))); });
      if (ok) { for (const c of ring) b.put(c.name, c.x, c.y, c.z, c.yaw, { trim: true }); b.notes.push('A kerb of beams round the fire pit.'); }
    }
  }
  // raised benches along the long walls of a hall (the Viking pallr): a platform 0.3 m up and 1 m deep wherever the
  // wall is free, widened under beds, chests and benches that stand against the wall, which are lifted onto it
  if (X.wallBenches && ctx.F < 0.01) {
    const w0 = ctx.wings[0], lift = 0.3, f1 = K.floor1 || 'wood_floor_1x1', beam = K.beam || 'wood_beam';
    const zones = ctx.zones || [];
    const liftable = p => p.decor && ['bed', 'storage', 'seat'].includes(PD.piece(p.name).role) && !/throne/.test(p.name);
    let laid = 0;
    for (const sz of [-1, 1]) {
      const zWall = w0.cz + sz * w0.D, y = ctx.F + lift;
      const rowZ = k => zWall - sz * (0.5 + k); // 1 m rows out from the wall
      const cellBox = (x, k) => ({ x0: x - 0.5, x1: x + 0.5, z0: rowZ(k) - 0.5, z1: rowZ(k) + 0.5 });
      const ov = (a, o) => o.x0 < a.x1 - 0.02 && o.x1 > a.x0 + 0.02 && o.z0 < a.z1 - 0.02 && o.z1 > a.z0 + 0.02;
      const cells = new Map(); // "x|k" -> true
      const lifted = [];
      // furniture against this wall: its footprint becomes platform, the piece goes up onto it
      for (const p of b.pieces) {
        if (!liftable(p)) continue;
        const o = Ck.aabb(p);
        const near = sz > 0 ? zWall - o.z1 : o.z0 - zWall;
        if (near > 0.6 || near < -0.3 || Math.abs(o.y0 - (ctx.F + 0.1)) > 0.3) continue;
        const depth = sz > 0 ? zWall - o.z0 : o.z1 - zWall;
        if (depth > 3.1 || o.x0 < w0.cx - w0.W || o.x1 > w0.cx + w0.W) continue;
        lifted.push({ p, o, k: Math.ceil(depth - 0.05) });
      }
      const blocked = box => b.pieces.some(p => {
        if (lifted.some(l => l.p === p)) return false;
        const role = PD.piece(p.name).role;
        if (!p.decor && ['floor', 'roof', 'roofTop', 'roofCorner', 'gable', 'wall', 'beam'].includes(role)) return false;
        if (role === 'rug') return false;
        const o = Ck.aabb(p);
        return o.y0 < y + 2 && o.y1 > y - lift && ov(box, o);
      }) || zones.some(zn => zn.y0 < y + 2 && zn.y1 > y - lift && ov(box, zn));
      for (let x = w0.cx - w0.W + 0.5; x < w0.cx + w0.W; x += 1) if (!blocked(cellBox(x, 0))) cells.set(`${x}|0`, true);
      for (const l of lifted) {
        const want = [];
        for (let x = w0.cx - w0.W + 0.5; x < w0.cx + w0.W; x += 1) for (let k = 0; k < l.k; k++) if (ov(cellBox(x, k), l.o)) want.push([x, k]);
        if (!want.length || want.some(([x, k]) => blocked(cellBox(x, k)))) { l.skip = true; continue; }
        for (const [x, k] of want) cells.set(`${x}|${k}`, true);
      }
      // only runs of three metres or more along the wall make a bench; lifted pieces keep their own platform
      const row0 = [...cells.keys()].filter(c => c.endsWith('|0')).map(c => +c.split('|')[0]).sort((a, c) => a - c);
      const runs = [];
      for (const x of row0) { const r = runs[runs.length - 1]; if (r && x - r[r.length - 1] < 1.01) r.push(x); else runs.push([x]); }
      const keep = new Set();
      for (const r of runs) {
        const hasLift = lifted.some(l => !l.skip && r.some(x => x > l.o.x0 - 0.5 && x < l.o.x1 + 0.5));
        if (r.length >= 3 || hasLift) for (const x of r) keep.add(`${x}|0`);
      }
      for (const l of lifted) if (!l.skip) for (const c of cells.keys()) { const [x, k] = c.split('|').map(Number); if (k > 0 && x > l.o.x0 - 0.5 && x < l.o.x1 + 0.5) keep.add(c); }
      if (!keep.size) continue;
      for (const c of keep) {
        const [x, k] = c.split('|').map(Number);
        b.put(f1, x, y, rowZ(k), 0, { trim: true });
        // it rests on short beams laid across under each cell
        b.put(K.beam1 || 'wood_beam_1', x, y - 0.1, rowZ(k), 90, { trim: true });
        laid++;
      }
      for (const l of lifted) if (!l.skip) {
        const ok = [...keep].some(c => { const [x] = c.split('|').map(Number); return x > l.o.x0 - 0.5 && x < l.o.x1 + 0.5; });
        if (!ok) continue;
        // whatever stands on the piece goes up with it
        for (const q of b.pieces) if (q === l.p || (q.decor && q.x > l.o.x0 && q.x < l.o.x1 && q.z > l.o.z0 && q.z < l.o.z1 && q.y > l.p.y + 0.2 && q.y < l.p.y + 1.5)) q.y = +(q.y + lift).toFixed(3);
      }
    }
    if (laid) b.notes.push('Raised benches along the long walls, with the beds and chests up on them.');
  }
}

const apiD = { profile, exterior, bargeboards, partition, interior, slopeBeam };
if (NODE_D) module.exports = apiD; else window.VHDetails = apiD;
