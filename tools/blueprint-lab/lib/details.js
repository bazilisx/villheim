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
const MotifsD = NODE_D ? require('./motifs.js') : window.VHMotifs;

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

function makeHash(ctx) {
  const sig = [ctx.cultureKey, ctx.type, ctx.stage, ctx.decor, ctx.biome, ctx.plan, ctx.F, ctx.storeys, ctx.door && ctx.door.x, ctx.door && ctx.door.z, (ctx.edges || []).length].join('|');
  let h = 2166136261;
  for (let i = 0; i < sig.length; i++) { h ^= sig.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// What a building gets, from its culture, type, size stage (s1 to s3) and decor stage (d1 to d3).
function profile(ctx) {
  const { C, cultureKey, T, stage, decor, biome, R } = ctx;
  const sN = +stage[1], dN = +decor[1];
  const north = NORTH.includes(cultureKey);
  const wood = /plank|half-timber|log/.test(C.wallStyle || 'plank');
  const boards = /plank|half-timber/.test(C.wallStyle || 'plank') && !/log/.test(C.wallStyle || ''); // posts and bands read on boards, not on logs
  const roll = p => R() < p;
  return {
    sN, dN, north, wood,
    windowFrame: (sN >= 2 || C.frame) && !C.arches,
    mullion: !C.glass && C.windowStyle !== 'single' && !C.arches, // one centered post, twin lights only
    shutters: sN >= 2 && dN >= 2 && SHUTTERS.includes(cultureKey) && reachesD(biome, 'Black Forest') && !C.glass && roll(0.6),
    doorFrame: !C.arches,
    doorHood: north && sN >= 2 && !C.awnings && roll(0.7) && !C.arches, // never without the frame
    doorstep: true,
    doorLamp: dN >= 2 && !C.arches,
    // log walls keep theirs (log poles) for now: without them the decorator sets chests into the 0.55 m log corners
    cornerPosts: wood && !C.frame && !T.tower,
    bands: boards && sN >= 2 && !C.frame,
    midRail: false, // with the braces and window frames a rail at 1 m made half-timbered walls too busy (2026-11-09 render)
    bargeboards: north && (sN >= 2 || C.carved),
    // the game's Roof Cross is 4 m across: one building in five (from the building's make, so the random stream the
    // rest of the details draw from stays as it was)
    // the crossed boards are a Norse signature (round 3 review missed them): three buildings in five
    crossed: CROSSED.includes(cultureKey) && sN >= 2 && makeHash(ctx) % 5 < 3,
    svalgang: ['norse', 'norse-forest', 'norse-highland', 'slavic', 'baltic'].includes(cultureKey) && ctx.storeys >= 2 &&
      ['home', 'storage', 'tavern'].includes(ctx.type) && (sN >= 3 || (sN === 2 && dN >= 3)) && ['rect', 'long', 'L', 'T'].includes(ctx.plan) &&
      !C.awnings && !ctx.flat && roll(0.75),
    gableWindow: north && sN >= 2,
    rafterTails: north && sN >= 2 && !C.eaves2 && (C.eaves || 1) < 2,
    eaveTrim: north && sN >= 2 && !C.eaves2 && (C.eaves || 1) < 2,
    purlinEnds: false, // a 1 m beam end out past the gable read as a stray stick (2026-11-09 review)
    gableTruss: north && sN >= 2 && roll(0.6),
    gablePorch: north && (sN >= 3 || (sN === 2 && dN >= 3)) && ['home', 'longhouse', 'tavern', 'temple'].includes(ctx.type) && roll(0.5),
    braces: false, // the leaning posts ran from the eaves past the wall foot and across windows (bench review): off until redone
    benchOut: dN >= 2 && ['home', 'hall'].includes(T.use),
    fireKerb: dN >= 2,
    wallBenches: (ctx.type === 'longhouse' || (T.use === 'hall' && ['long', 'rect'].includes(ctx.plan))) && sN >= 2,
    partition: ['home', 'tavern'].includes(ctx.type) && (sN >= 3 || (sN === 2 && dN >= 3)) && ['rect', 'long', 'L', 'T'].includes(ctx.plan),
    // assemblies from the best-liked builds (lib/motifs.js) on windows and doors everywhere, on corners of timber walls,
    // on gables and eaves of the northern cultures; the rules above do whatever no motif fits
    motifs: true,
    motifCorners: wood && !T.tower,
    motifRoof: north && sN >= 2,
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
  const added = { windows: 0, doors: 0, corners: 0, gables: 0, braces: 0, gallery: 0, motifs: 0 };
  const MT = X.motifs ? (ctx.motifs || (ctx.motifs = MotifsD.plan(ctx))) : null;
  const used = new Set();
  if (X.svalgang && ctx.wallSegment) added.gallery = svalgang(b, ctx) ? 1 : 0;
  if (X.gablePorch && !added.gallery) added.porch = gablePorch(b, ctx) ? 1 : 0;

  // ---- windows
  for (const o of openings) {
    if (o.kind !== 'window') continue;
    const { e, y0 } = o, { ux, uz, ox, oz } = axes(e);
    if (MT && motifWindow(b, ctx, MT, o, used)) { added.windows++; added.motifs++; continue; }
    const stone = /stone|marble|grausten/.test(C.wallStyle || '') && !(b.woodBays && b.woodBays.has(`${Math.round(e.x * 10)},${Math.round(e.z * 10)}`));
    const f = 0.25; // trim stands proud of the wall face (a beam is 0.4 m deep in the game: at 0.25 out it clears the inside)
    // the light: the whole 2 m bay, or 1 m beside a 1 x 1 wall piece
    const quarter = K.wallQuarter && b.pieces.find(p => p.name === K.wallQuarter && Math.abs(p.y - (y0 + 1.5)) < 0.3 && Math.abs((p.x - e.x) * ox + (p.z - e.z) * oz) < 0.2 && Math.abs((p.x - e.x) * ux + (p.z - e.z) * uz) < 0.8);
    const sd = quarter ? ((quarter.x - e.x) * ux + (quarter.z - e.z) * uz > 0 ? 1 : -1) : 0;
    const lw = quarter ? 1 : 2, cx = e.x - ux * sd * 0.5, cz = e.z - uz * sd * 0.5;
    if (X.mullion && lw === 2) put(pole1, e.x, y0 + 1.5, e.z, 0);
    // a deck or gallery floor outside the window: no frame (the sill and head would hang over people walking there)
    const deckOut = b.pieces.some(p => PD.piece(p.name).role === 'floor' && Math.hypot(p.x - (e.x + ox), p.z - (e.z + oz)) < 1.1 && Math.abs(p.y - y0) < 0.6);
    if (X.windowFrame && !deckOut) {
      // sill and head no wider than the light and a little over; posts at its sides on board walls only
      // a 1 m light takes 1 m boards where posts carry them; without posts the 2 m beam rests on the wall beside
      const posts = (!C.frame || stone) && C.wallStyle !== 'log';
      const bm = lw === 2 || !posts ? beam : (K.beam1 || 'wood_beam_1'), bx = lw === 2 || !posts ? e.x : cx, bz = lw === 2 || !posts ? e.z : cz;
      put(bm, bx + ox * f, y0 + 0.9, bz + oz * f, e.yaw);
      // no head board: sill and head pairs stacked floor over floor read as a ladder (round 4 review); the head only
      // where the wall is stone (the timber lintel shows there anyway)
      if (stone) put(bm, bx + ox * f, y0 + 2.1, bz + oz * f, e.yaw);
      if (posts) for (const s of [-1, 1]) put(pole1, cx + ux * s * (lw / 2) + ox * f, y0 + 1.5, cz + uz * s * (lw / 2) + oz * f, 0);
    }
    if (X.shutters && !stone) {
      // open shutters flat on the wall either side, only where a plain bay is beside the window and the bay past it
      // is no window wanting the same wall; both sides or none
      const room = s => {
        const n1 = edgeAt.get(`${e.x + ux * s * 2},${e.z + uz * s * 2}`), n2 = edgeAt.get(`${e.x + ux * s * 4},${e.z + uz * s * 4}`);
        if (!n1 || n1.yaw !== e.yaw || isOpen.has(`${n1.x},${n1.z},${y0}`)) return false;
        return !(n2 && n2.yaw === e.yaw && isOpen.has(`${n2.x},${n2.z},${y0}`));
      };
      if (room(-1) && room(1)) for (const s of [-1, 1]) put('wood_window', cx + ux * s * (lw / 2 + 0.6) + ox * 0.12, y0 + 1.5, cz + uz * s * (lw / 2 + 0.6) + oz * 0.12, e.yaw);
    }
    added.windows++;
  }

  // ---- doors
  for (const o of openings) {
    if (o.kind === 'window') continue;
    const { e, y0 } = o, { ux, uz, ox, oz } = axes(e);
    const h = o.kind === 'gate' ? 3 : 2;
    const mo = MT && o.kind === 'door' && !o.gallery && !o.balcony ? motifDoor(b, ctx, MT, o, used) : null;
    if (mo) { added.motifs++; o.motif = mo; }
    // the opening as the door piece fills it (a cloth door hangs beside the wall's middle)
    const dp = b.pieces.find(p => PD.piece(p.name).role === 'door' && Math.hypot(p.x - e.x, p.z - e.z) < 1.2 && p.y > y0 - 0.5 && p.y < y0 + 3);
    const op = dp ? PD.doorOpening(dp) : null;
    const dx = op ? op.x : e.x, dz = op ? op.z : e.z, dw = op ? Math.min(2, op.w) : 2, dh = op ? Math.min(3, op.h) : h;
    const framed = X.doorFrame && o.kind === 'door' && !mo;
    if (framed) {
      if (!C.frame) for (const s of [-1, 1]) put(pole, dx + ux * s * (dw / 2 + 0.05) + ox * 0.1, y0 + 1, dz + uz * s * (dw / 2 + 0.05) + oz * 0.1, 0);
      put(dw < 1.5 ? (K.beam1 || 'wood_beam_1') : beam, dx + ox * 0.25, y0 + dh + 0.2, dz + oz * 0.25, e.yaw); // the lintel, just over the door's frame
    }
    if (o.storey > 0) continue;
    const outside = { x: dx + ox, z: dz + oz };
    // a step in front of a ground-level door: two beams laid along the threshold (a 2 x 2 floor there read as a mat),
    // unless a porch, stair or deck is already there
    const busy = b.pieces.some(p => Math.hypot(p.x - outside.x, p.z - outside.z) < 1.1 && ['floor', 'stair'].includes(PD.piece(p.name).role) && Math.abs(p.y - F) < 1.2);
    if (X.doorstep && F < 0.01 && !busy && !(mo && mo.step)) for (const d of [0.35, 0.75]) put(beam, dx + ox * d, F + 0.1, dz + oz * d, e.yaw);
    // a small roof over the door (pent hood) on a rafter each side, falling away from the wall, its low edge level with
    // the door's head 2 m out (so the doorway keeps its headroom); never without the frame, never under an eave or a
    // porch less than 1.5 m over the door
    const covered = b.pieces.some(p => {
      const r = PD.piece(p.name).role;
      if (!['roof', 'roofTop', 'roofCorner', 'floor'].includes(r)) return false;
      const bx = checksD().aabb(p), out = (p.x - dx) * ox + (p.z - dz) * oz, side = Math.abs((p.x - dx) * ux + (p.z - dz) * uz);
      return out > -1.2 && out < 3.2 && side < 2.5 && bx.y0 > y0 + dh - 0.3 && bx.y0 < y0 + dh + 1.5;
    });
    if (X.doorHood && framed && !covered && !(b.gallery && o.storey === 0) && SH >= 3) {
      const yaw = normD(Math.atan2(ox, oz) * 180 / Math.PI);
      put(K.roof26, outside.x, y0 + dh, outside.z, yaw);
      const r26 = slopeBeam(K, 26);
      for (const s of [-1, 1]) put(r26, outside.x + ux * s * 0.85, y0 + dh - 0.15, outside.z + uz * s * 0.85, yaw + 90);
      b.notes.push('A small roof over the door.');
    }
    // lamps: a pair in line with the door posts, a little outside them, with a frame only; on a raised house at the top
    // of the entry stair where a landing is
    if (X.doorLamp && framed && !o.back && !(mo && mo.lit)) {
      const cands = [-1, 1].map(s => ({ name: 'piece_groundtorch_wood', x: +(dx + ux * s * (dw / 2 + 0.7) + ox * 0.35).toFixed(3), y: F + 0.65, z: +(dz + uz * s * (dw / 2 + 0.7) + oz * 0.35).toFixed(3), q: quatD(0), yaw: 0 }));
      const footing = c => F < 0.01 || b.pieces.some(p => PD.piece(p.name).role === 'floor' && Math.abs(p.y - F) < 0.2 && Math.abs(p.x - c.x) < 1.05 && Math.abs(p.z - c.z) < 1.05);
      if (cands.every(c => footing(c) && clear(b, c))) for (const c of cands) b.pieces.push({ ...c, decor: true, trim: true });
    }
    added.doors++;
  }

  // ---- corner motifs on the outside corners of the ground storey, before the posts so one post stands there
  if (MT && X.motifCorners) added.corners += motifCorners(b, ctx, MT, used);

  // ---- corner posts, from the foot of the walls to their top, on every outside corner
  if (X.cornerPosts) {
    const dirs = new Map();
    for (const e of edges) {
      const { ux, uz } = axes(e);
      for (const s of [-1, 1]) { const k = `${e.x + ux * s},${e.z + uz * s}`; if (!dirs.has(k)) dirs.set(k, new Set()); dirs.get(k).add(e.yaw); }
    }
    const top = F + storeys * SH, p = C.wallStyle === 'log' ? (K.pole || pole) : pole, foot = F > 0.01 && F < 2.01 ? F - Math.ceil(F) : F; // from the ground under a raised floor
    for (const [k, ys] of dirs) {
      if (ys.size < 2) continue;
      const [x, z] = k.split(',').map(Number);
      for (let y = foot; y < top - 0.01;) { const h = top - y >= 2 ? 2 : 1; put(h === 2 ? p : pole1, x, y + h / 2, z, 0); y += h; }
      added.corners++;
    }
  }

  // ---- bay posts: on plank walls, a post the full height of the wall every 4 m along the long sides of the main
  // wing, a little proud of the face, so the wall reads in bays (2026-11-09 review); not beside a door
  if (X.cornerPosts && (C.wallStyle || 'plank') === 'plank' && ctx.wings && ctx.wings[0].alpha === 0 && X.sN >= 2) {
    const w0 = ctx.wings[0], top = F + storeys * SH, foot = F > 0.01 && F < 2.01 ? F - Math.ceil(F) : F;
    const doorAt = openings.filter(o => o.kind !== 'window').map(o => o.e);
    for (const sz of [-1, 1]) {
      const z = w0.cz + sz * w0.D;
      for (let x = w0.cx - w0.W + 4; x <= w0.cx + w0.W - 4 + 0.01; x += 4) {
        if (!edges.some(e => e.yaw === 0 && Math.abs(e.z - z) < 0.01 && Math.abs(e.x - x) < 1.01)) continue;
        if (doorAt.some(e => Math.abs(e.z - z) < 0.01 && Math.abs(e.x - x) < 1.2)) continue;
        const zz = z + sz * 0.15;
        for (let y = foot; y < top - 0.01;) { const h = top - y >= 2 ? 2 : 1; put(h === 2 ? pole : pole1, x, y + h / 2, zz, 0); y += h; }
      }
    }
  }

  // ---- bands: a beam at the foot of the walls and along the floor line of each upper storey; a rail at 1 m on
  // half-timbered walls. Laid a little proud of the outside face, never across a door.
  if (X.bands || X.midRail) for (const e of edges) {
    const { ox, oz } = axes(e);
    for (let s = 0; s < storeys; s++) {
      const y0 = F + s * SH;
      const opening = openings.find(o => o.e === e && o.y0 === y0);
      if (X.bands && !(opening && opening.kind !== 'window')) put(beam, e.x + ox * 0.25, y0 + 0.1, e.z + oz * 0.25, e.yaw);
      if (X.midRail && !opening) put(beam, e.x + ox * 0.25, y0 + 1, e.z + oz * 0.25, e.yaw);
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

  for (const id of ctx.motifUsed || []) used.add(id);
  if (used.size) pruneMotifs(b, ctx);
  if (used.size) b.notes.push(`Trim after community builds: ${[...used].sort().join(', ')}.`);
  b.motifs = [...used];
  b.detailReport = added;
  return added;
}

// ---------------------------------------------------------------- motifs (lib/motifs.js)

// Motif pieces on the walls wait until the rooms are furnished (details interior), so the decorator lays out the rooms
// as it would without them; meanwhile they count for the motifs that follow.
function hold(b, placed) {
  b.motifPending = b.motifPending || [];
  for (const p of placed) b.motifPending.push(p);
}
function commitMotifs(b, ctx) {
  const pend = b.motifPending || [];
  delete b.motifPending;
  if (!pend.length) return;
  // with the game's solids where they are known (checks.js gameBox), as the overlap check reads furniture
  const Ck = checksD(), gb = p => (Ck.gameBox ? Ck.gameBox(p) : Ck.aabb(p)), furn = b.pieces.filter(p => p.decor).map(gb);
  const SH = NODE_D ? (() => { try { return require('./shapes.js'); } catch (e) { return null; } })() : window.VHShapes;
  const hit = (a, o) => {
    if (!(o.x0 < a.x1 - 0.02 && o.x1 > a.x0 + 0.02 && o.y0 < a.y1 - 0.02 && o.y1 > a.y0 + 0.02 && o.z0 < a.z1 - 0.02 && o.z1 > a.z0 + 0.02)) return false;
    if (a.pass || o.pass) return false;
    return !(a.sol && o.sol && SH) || SH.overlapVolume(a.sol, o.sol) > 0.01;
  };
  for (const p of pend) {
    const pb = gb({ ...p, q: p.q || quatD(p.yaw) });
    if (furn.some(o => hit(pb, o))) continue; // what the furnishing put there first stays
    b.put(p.name, p.x, p.y, p.z, p.yaw, { trim: true, motif: p.motif, footed: true });
  }
  pruneMotifs(b, ctx);
}

// The last pass over the motifs' pieces: one that doubles another piece, is not connected to the ground or would
// fall by its material (the game's support, checks.js) comes out, and what hung on it with it.
function pruneMotifs(b, ctx) {
  const Ck = checksD(), keys = ctx.motifKeys || new Set();
  const isMotif = p => p.motif || keys.has(`${p.name}|${Math.round(p.x * 10)}|${Math.round(p.y * 10)}|${Math.round(p.z * 10)}`);
  for (let round = 0; round < 4; round++) {
    const ps = b.pieces, boxes = ps.map(p => Ck.aabb(p)), near = Ck.index(boxes);
    const ys = boxes.filter(x => x.info.structural).map(x => x.y0).sort((a, c) => a - c), ground = ys.length ? ys[Math.floor(ys.length * 0.02)] : 0;
    const out = new Set();
    // doubles
    const seen = new Map();
    ps.forEach((p, i) => {
      const k = `${p.name}|${p.x.toFixed(1)}|${p.y.toFixed(1)}|${p.z.toFixed(1)}|${Math.round(Ck.localOf ? (p.yaw != null ? p.yaw : 0) : 0) % 360}`;
      if (!seen.has(k)) { seen.set(k, i); return; }
      const j = seen.get(k);
      if (isMotif(p)) out.add(i); else if (isMotif(ps[j])) { out.add(j); seen.set(k, i); }
    });
    // connected to the ground through touching pieces (as checks.js reads it)
    const held = boxes.map(x => x.y0 <= ground + 0.35), queue = held.map((h, i) => (h ? i : -1)).filter(i => i >= 0);
    const tch = (a, o, e) => a.x0 <= o.x1 + e && o.x0 <= a.x1 + e && a.y0 <= o.y1 + e && o.y0 <= a.y1 + e && a.z0 <= o.z1 + e && o.z0 <= a.z1 + e;
    while (queue.length) {
      const i = queue.pop(), a = boxes[i];
      for (const j of near(a)) if (!held[j] && tch(a, boxes[j], 0.16) && (a.info.structural || ['craft', 'deco', 'light'].includes(boxes[j].info.role))) { held[j] = true; queue.push(j); }
    }
    ps.forEach((p, i) => { if (!held[i] && boxes[i].info.structural && isMotif(p)) out.add(i); });
    for (const i of Ck.stability(ps, boxes, near, ground)) if (isMotif(ps[i])) out.add(i);
    if (!out.size) break;
    b.pieces = ps.filter((p, i) => !out.has(i));
  }
}

// a window bay: a 2 m opening, or a 1 m light beside a 1 x 1 wall piece; the motif for its size and facade
function motifWindow(b, ctx, MT, o, used) {
  const { e, y0 } = o, { ux, uz, ox, oz } = axes(e), K = ctx.K;
  const quarter = K.wallQuarter && b.pieces.find(p => p.name === K.wallQuarter && Math.abs(p.y - (y0 + 1.5)) < 0.3 && Math.abs((p.x - e.x) * ox + (p.z - e.z) * oz) < 0.2 && Math.abs((p.x - e.x) * ux + (p.z - e.z) * uz) < 0.8);
  let f = { w: 2, h: 1 }, x = e.x, z = e.z;
  if (quarter) { const sd = (quarter.x - e.x) * ux + (quarter.z - e.z) * uz > 0 ? 1 : -1; f = { w: 1, h: 1 }; x -= ux * sd * 0.5; z -= uz * sd * 0.5; }
  const glass = b.pieces.some(p => /crystal|glass/.test(p.name) && Math.hypot(p.x - e.x, p.z - e.z) < 1.1 && Math.abs(p.y - (y0 + 1.5)) < 0.6);
  // a window under a lean-to or behind a stack stays plain
  const shed = b.pieces.some(p => { const d = (p.x - x) * ox + (p.z - z) * oz, s = Math.abs((p.x - x) * ux + (p.z - z) * uz); return d > 0.3 && d < 2.6 && s < 2 && p.y < y0 + 3 && (p.decor || /roof/.test(PD.piece(p.name).role)); });
  if (shed) return false;
  const front = ctx.door && e.out[0] === ctx.door.out[0] && e.out[1] === ctx.door.out[1];
  const c = MT.get('window', f, front);
  if (!c) return false;
  const placed = MotifsD.place(b, c, { x, y: y0 + 1, z, nx: ox, nz: oz }, f, { mirror: MT.mirror, ground: 0, noInfill: glass, dry: true });
  hold(b, placed);
  if (!placed.length) return false;
  used.add(c.m.id);
  return true;
}
// the door: its motif, without what would stand below the floor when the house is raised more or less than the
// motif's own (its steps were for that height)
function motifDoor(b, ctx, MT, o, used) {
  const { e, y0 } = o, { ox, oz } = axes(e);
  const dp = b.pieces.find(p => PD.piece(p.name).role === 'door' && Math.hypot(p.x - e.x, p.z - e.z) < 1.2 && p.y > y0 - 0.5 && p.y < y0 + 2.5);
  if (!dp) return null;
  const f = { w: 2, h: Math.min(3, PD.doorSpec(dp.name).h) };
  const c = MT.get('door', f, !o.back);
  if (!c) return null;
  const rise = c.m.fit.rise || 0, F = ctx.F;
  const placed = MotifsD.place(b, c, { x: e.x, y: y0, z: e.z, nx: ox, nz: oz }, f,
    { mirror: MT.mirror, ground: 0, minH: Math.abs(rise - (o.storey ? 99 : F)) < 0.3 ? null : -0.2, dry: true });
  if (!placed.length) return null;
  hold(b, placed);
  used.add(c.m.id);
  return { id: c.m.id, lit: placed.some(p => PD.piece(p.name).role === 'light'), step: placed.some(p => PD.piece(p.name).role === 'floor' && p.y < y0 + 0.3) };
}
// outside corners of the ground storey: where two walls meet with the building behind both
function motifCorners(b, ctx, MT, used) {
  const { edges, F } = ctx, c = MT.get('corner', {}, true);
  if (!c) return 0;
  const at = new Map();
  for (const e of edges) {
    const { ux, uz } = axes(e);
    for (const s of [-1, 1]) { const k = `${e.x + ux * s},${e.z + uz * s}`; if (!at.has(k)) at.set(k, []); at.get(k).push(e); }
  }
  let n = 0;
  for (const [k, es] of at) {
    const a = es.find(e => e.yaw === 0), bb = es.find(e => e.yaw !== 0);
    if (!a || !bb || es.length !== 2) continue;
    const [x, z] = k.split(',').map(Number);
    // outside: each wall lies on the far side of the other's outward direction
    if ((a.x - x) * bb.out[0] + (a.z - z) * bb.out[1] > -0.5 || (bb.x - x) * a.out[0] + (bb.z - z) * a.out[1] > -0.5) continue;
    const dx = a.out[0] + bb.out[0], dz = a.out[1] + bb.out[1], l = Math.hypot(dx, dz);
    const placed = MotifsD.place(b, c, { x, y: F, z, nx: dx / l, nz: dz / l }, null, { mirror: MT.mirror, ground: 0, inward: false, dry: true });
    if (placed.length) { n++; hold(b, placed); }
  }
  if (n) used.add(c.m.id);
  return n;
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
  const freeCell = x => cells.has(`${x},${zf + 1}`) && !L.some(l => [l.hole, l.land, l.stand, ...(l.run || [])].some(c => c[0] === x && c[1] === zf + 1));
  const ux = xs.filter(x => x !== door.x).sort((a, c) => Math.abs(a - door.x) - Math.abs(c - door.x)).find(freeCell);
  if (ux == null) return false;
  // take out the upper bay's wall and window pieces, and build it again as a door
  const inBay = p => Math.abs(p.x - ux) < 1.01 && Math.abs(p.z - zf) < 0.3 && p.y > yU + 0.05 && p.y < yU + SH - 0.05 &&
    ['wall', 'window', 'door', 'beam'].includes(PD.piece(p.name).role) && !p.decor; // a half-timber brace too
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
  // the rail: two beams on the posts (the round pole fence stands 2 m tall in the game, too high for a rail)
  for (const yr of [yU + 0.55, yU + 1.05]) {
    for (const x of xs) b.put(beam, x, yr, zf - 2, 0, T);
    for (const x of [x0, x1]) b.put(beam, x, yr, zf - 1, 90, T);
  }
  b.gallery = true;
  b.notes.push('An upper gallery over the front door with a door from the upper room, after the Norwegian lofts.');
  return true;
}

// A gabled porch over the front door (the entrance dormer of the community longhouses in the corpus): posts 4 m apart
// two metres out, a small 45 degree gable roof whose ridge runs from the door out, closed against the wall by a gable,
// and a gable triangle over the open front. Its eaves are 2.4 m up, clear of anyone walking in.
function gablePorch(b, ctx) {
  const { K, C, F, SH, edges, door, roofKind, flat } = ctx;
  if (!door || door.out[1] >= 0 || F > 0.01 || flat || ctx.dragonsHere === undefined) return false;
  if (!K.roof45 || !K.gable45) return false;
  const zf = door.z, x = door.x;
  const front = new Set(edges.filter(e => e.out[1] < 0 && Math.abs(e.z - zf) < 0.01).map(e => e.x));
  if (!front.has(x - 2) || !front.has(x + 2)) return false;
  if (b.pieces.some(p => p.z < zf - 0.3 && p.z > zf - 3.2 && Math.abs(p.x - x) < 2.6 && p.y > F - 0.5 && !['floor'].includes(PD.piece(p.name).role))) return false;
  const yR = F + 4.4, T = { trim: true }, pole = framePoleD(K, C), pole1 = K.pole1 || 'wood_pole', beam = K.beam || 'wood_beam';
  for (const s of [-1, 1]) {
    b.put(pole, x + 2 * s, F + 1, zf - 2, 0, T);
    b.put(pole1, x + 2 * s, F + 1.9, zf - 2, 0, T);
    b.put(beam, x + 2 * s, F + 2.35, zf - 1, 90, T); // plate from the wall to the post
    b.put(beam, x + s, F + 2.35, zf - 2, 0, T); // tie beam across the front
    b.put(K.roof45, x + s, yR - 1, zf - 1, s > 0 ? 90 : 270, T);
    for (const z of [zf - 2, zf]) b.put(K.gable45, x + s, yR - 2, z, s > 0 ? 180 : 0, T); // the open front, and the back closing it against the wall
    b.put(slopeBeam(K, 45), x + s, yR - 1, zf - 2.08, s > 0 ? 180 : 0, T); // bargeboard on the open front
  }
  b.put(K.roofTop45, x, yR, zf - 1, 90, T);
  if (ctx.profile.crossed) b.put('wood_wall_roof_top_45', x, yR - 1, zf - 2, 0, T); // crossed boards over the porch gable, crossing on its apex
  if (!b.pieces.some(p => p.name === K.floor && Math.abs(p.x - x) < 0.1 && Math.abs(p.z - (zf - 1)) < 0.1)) b.put(K.floor, x, F, zf - 1, 0, T);
  b.notes.push('A gabled porch over the front door.');
  return true;
}

// Bargeboards for one wing's gable ends, as roof parts (generate.js lays them with the rest of the roof so crossing
// wings hide them where another roof runs over). Arguments as gablePieces: K, C, the wing, the roof top, rise per row,
// which ends get a gable, and helpers to place a part in wing-local coordinates.
function bargeboards(K, C, w, ctx, rows, ends, add, low, pivot, r) {
  const X = ctx.profile;
  if (!X) return;
  const name = slopeBeam(K, r === 2 ? 45 : 26), beam = K.beam || 'wood_beam', capY = low(-1);
  // motifs from the best-liked builds for the gable faces and the eaves (lib/motifs.js), in wing-local terms
  const MT = X.motifs && X.motifRoof ? (ctx.motifs || (ctx.motifs = MotifsD.plan(ctx))) : null;
  const gm = MT && MT.get('gable', { slope: r === 2 ? 45 : 26 }, true);
  // eave motifs are off for now: few fit a roof that ends at the wall, and they hardly show from the ground
  const em = X.eaveMotifs && MT && rows === (w.D - 3) / 2 && MT.get('eave', { slope: r === 2 ? 45 : 26, overhang: 0 }, true);
  const top = low((w.D - 3) / 2), gw = X.gableWindow && !C.stoneWalls && capY - top >= 3.9;
  let gableDone = false, apex = false, eaveDone = false;
  // the roof's parts go in by generate.js; their world places are kept so the last pass can find them
  const al = (w.alpha || 0) * Math.PI / 180, keys = ctx.motifKeys || (ctx.motifKeys = new Set());
  const addM = (n, u, y, v, yaw, role, surf) => {
    add(n, u, y, v, yaw, role, surf);
    keys.add(`${n}|${Math.round((w.cx + u * Math.cos(al) + v * Math.sin(al)) * 10)}|${Math.round(y * 10)}|${Math.round((w.cz - u * Math.sin(al) + v * Math.cos(al)) * 10)}`);
  };
  if (gm) [-1, 1].forEach((sg, k) => {
    if (!ends[k]) return;
    const n = MotifsD.roofParts(gm, { x: sg * w.W, y: capY, z: 0, nx: sg, nz: 0 }, addM, { mirror: MT.mirror, skip: p => {
      const v = Math.abs(p.z), h = PD.piece(p.name).size[1] / 2;
      if (v > w.D - 0.3 || p.y - h < top - 0.05 || p.o < -0.35 || p.o > 1.3) return true; // inside the gable, in front of it
      // a long beam standing straight out of the gable face reads as a stray plank
      if (/^beam(2|4)$/.test(p.cls) && Math.abs(Math.cos((p.yaw - (sg > 0 ? 90 : 270)) * Math.PI / 180)) < 0.5) return true;
      // under the roof line: the motif's piece may not stand out through the roof
      if (p.y > capY - (r / 2) * Math.max(0, v - 1) + 0.6) return true;
      if (ctx.dragonsHere && v < 1.5 && p.y > capY - 1.5) return true;
      if (gw && v < 1.4 && p.y > top - 0.2 && p.y < top + 2.4) return true; // the loft window
      // the rules' bargeboards run the whole edge: the motif's own on that line would double them
      if (X.bargeboards && /^beam(26|45|67)$/.test(p.cls) && Math.abs((capY - p.y) - (r / 2) * v) < 0.9) return true;
      if (p.y > capY - 1.2 && v < 1) apex = true;
      return false;
    } });
    if (n) gableDone = true;
  });
  if (gableDone) ctx.motifUsed = [...(ctx.motifUsed || []), gm.m.id];
  const a = (w.alpha || 0) * Math.PI / 180;
  const overDoor = (u, v) => { const x = w.cx + u * Math.cos(a) + v * Math.sin(a), z = w.cz - u * Math.sin(a) + v * Math.cos(a);
    return (ctx.openings || []).some(o => o.kind !== 'window' && o.storey === 0 && Math.hypot(o.e.x - x, o.e.z - z) < 2.2); };
  // the eaves: one bay of the motif on every 2 m of the lowest row, both sides, never over a door
  if (em && X.eaveTrim) {
    const edge = 3 + 2 * rows;
    let n = 0;
    for (let u = -w.W + 1; u <= w.W - 1 + 0.01; u += 2) for (const sv of [-1, 1])
      if (!overDoor(u, sv * w.D)) n += MotifsD.roofParts(em, { x: u, y: low(rows), z: sv * edge, nx: 0, nz: sv }, addM, { mirror: MT.mirror, skip: p => {
        if (p.o < -0.05 || p.h < -0.9 || Math.abs(p.a) > 1.05) return true;
        // under the roof: nothing through it (the roof rises inward from the edge)
        const half = PD.piece(p.name).size[1] / 2, under = (r / 2) * Math.max(0, -p.o) - 0.15;
        return p.h + half > under;
      } });
    if (n) { eaveDone = true; ctx.motifUsed = [...(ctx.motifUsed || []), em.m.id]; }
  }
  // rafter tails: a sloped beam at every seam of the lowest roof row, half a metre out past its edge and just under it
  // (the exposed rafters of Norse halls; the corpus lays sloped beams along roof piece edges)
  // (never over a door or gate: a 45 degree beam is 0.4 m thick in the game and hangs into the doorway)
  if (X.rafterTails && !eaveDone && !(ctx.eaveOut || 0)) for (let u = -w.W + 2; u <= w.W - 2 + 0.01; u += 2) for (const sv of [-1, 1]) {
    const v = sv * (2 + 2 * rows + 0.7);
    if (overDoor(u, sv * w.D)) continue;
    add(name, u, pivot(rows) - 0.7 - (r === 2 ? 0 : 0), v, (sv < 0 ? 180 : 0) + 90, 'trim', low(rows));
  }
  // the ridge beam's end out past each gable
  if (X.purlinEnds && !ctx.dragonsHere && ctx.wings.length === 1) [-1, 1].forEach((sg, k) => { if (ends[k]) add(K.beam1 || 'wood_beam_1', sg * (w.W + 0.55), capY - 0.35, 0, 0, 'trim', capY); });
  // a timber truss on the face of each gable: a king post up the middle and a collar beam across at half height
  if (X.gableTruss && !gableDone) [-1, 1].forEach((sg, k) => {
    if (!ends[k] || capY - low(rows) < 2.9) return;
    const u = sg * (w.W + 0.1), top = low(rows) + (r === 2 ? 0 : 0), h = capY - top;
    const from = X.gableWindow && h >= 3.9 ? top + 2.2 : top;
    for (let y = from; y < capY - 0.6;) { const step = capY - 0.6 - y >= 2 ? 2 : 1; add(step === 2 ? (K.pole || 'wood_pole2') : (K.pole1 || 'wood_pole'), u, y + step / 2, 0, 0, 'trim', y + step); y += step; }
    const yc = top + Math.round(h / 2);
    // collar beams wherever 2 m of beam fits under the roof at that height
    for (let v = -w.D + 2; v <= w.D - 2 + 0.01; v += 2) {
      const edge = Math.abs(v) + 1, surf = capY - (r / 2) * Math.max(0, edge - 1);
      if (surf > yc + 0.3) add(beam, u, yc, v, 90, 'trim', yc + 0.1);
    }
  });
  // beam ends under the overhanging eaves, one at every roof seam, a metre long, just under the roof (D-059)
  const rk = ctx.rake || 0, eo = ctx.eaveOut || 0;
  if (eo && !eaveDone) for (let u = -w.W + 2; u <= w.W - 2 + 0.01; u += 2) for (const sv of [-1, 1]) {
    if (overDoor(u, sv * w.D)) continue;
    add(K.beam1 || 'wood_beam_1', u, top - r / 4 - 0.3, sv * (w.D + 0.5), 90, 'trim', top - r / 4 - 0.2);
  }
  if (!X.bargeboards) return;
  [-1, 1].forEach((sg, k) => {
    if (!ends[k]) return;
    const u = sg * (w.W + rk + 0.06);
    for (let i = 0; i <= rows; i++) for (const sv of [-1, 1]) {
      const v = sv * (2 + 2 * i), roofYaw = sv < 0 ? 180 : 0;
      add(name, u, pivot(i), v, roofYaw + 90, 'trim', low(i) + r);
    }
    // and along the overhanging eave row
    if (eo) for (const sv of [-1, 1]) if (!overDoor(sg * w.W, sv * w.D) && !overDoor(sg * w.W, sv * (w.D - 2))) add(name, u, pivot(rows) - r / 2, sv * (2 + 2 * rows + 1), (sv < 0 ? 180 : 0) + 90, 'trim', low(rows));
    // crossed boards over the apex: the game's Wood Roof Cross (the piece is the pair of crossed boards that Norwegian
    // vindskier end in), on the ridge where it meets the gable, as a quarter of the corpus builds have it
    // the piece's boards cross 1 m (26 degrees: 0.5 m) over its pivot, so the crossing sits on the apex (it stood a
    // metre too high, its arms 2 m over the ridge)
    if (X.crossed && !ctx.dragonsHere && !apex) add(r === 2 ? 'wood_wall_roof_top_45' : 'wood_wall_roof_top', sg * (w.W + rk), capY - (r === 2 ? 1 : 0.5), 0, 90, 'trim', capY + 1);
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
    const blocked = (ladders || []).some(L => [L.stand, L.hole, L.land, ...(L.run || [])].some(c => Math.abs(c[0] - xp) < 1.01));
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

// A bench against the wall beside the front door, facing out (a place to sit in the evening). After the furnishing,
// so the woodpiles and stacks the decorator sets outside keep their places.
function benchByDoor(b, ctx) {
  const X = ctx.profile, F = ctx.F;
  if (!X.benchOut || F > 0.01) return;
  const edgeAt = new Map(ctx.edges.map(e => [`${e.x},${e.z}`, e]));
  for (const o of b.openings || []) {
    if (o.kind !== 'door' || o.back || o.storey > 0 || o.gallery) continue;
    const { e } = o, { ux, uz, ox, oz } = axes(e);
    const name = reachesD(ctx.biome, 'Black Forest') && ctx.R() < 0.4 ? 'piece_logbench01' : 'piece_bench01';
    const faceOut = name === 'piece_logbench01' ? outYaw(-ox, -oz) : outYaw(ox, oz); // the log bench faces its local -z
    for (const s of ctx.R() < 0.5 ? [1, -1] : [-1, 1]) {
      const cand = { name, x: +(e.x + ux * s * 3 + ox * 0.45).toFixed(3), y: F + 0.1, z: +(e.z + uz * s * 3 + oz * 0.45).toFixed(3), yaw: faceOut, q: quatD(faceOut) };
      if (!edgeAt.has(`${e.x + ux * s * 2},${e.z + uz * s * 2}`) || !edgeAt.has(`${e.x + ux * s * 4},${e.z + uz * s * 4}`)) continue; // wall behind it
      if (!clear(b, cand)) continue;
      b.pieces.push({ ...cand, decor: true, trim: true });
      break;
    }
    return;
  }
}

// ---------------------------------------------------------------- interior (after the furnishing)

function interior(b, ctx) {
  const X = ctx.profile;
  if (!X) return;
  commitMotifs(b, ctx);
  const { K } = ctx, Ck = checksD();
  benchByDoor(b, ctx);
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
        // a piece that would rise into a stair's or doorway's keep-clear box stays where it is
        const up = { x0: o.x0, x1: o.x1, z0: o.z0, z1: o.z1, y0: o.y0 + lift, y1: o.y1 + lift };
        if (zones.some(zn => ov(up, zn) && zn.y0 < up.y1 && zn.y1 > up.y0)) continue;
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
      // only runs of three meters or more along the wall make a bench; lifted pieces keep their own platform
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

const apiD = { profile, exterior, bargeboards, partition, interior, slopeBeam, commitMotifs };
if (NODE_D) module.exports = apiD; else window.VHDetails = apiD;
