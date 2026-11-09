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
    braces: BRACED.includes(cultureKey) && sN >= 2 && (T.use === 'hall' || ctx.type === 'longhouse'),
    benchOut: dN >= 2 && ['home', 'hall'].includes(T.use),
    fireKerb: dN >= 2,
    wallBenches: (ctx.type === 'longhouse' || (T.use === 'hall' && ctx.plan === 'long')) && sN >= 2,
    partition: ctx.type === 'home' && sN >= 3 && ['rect', 'long'].includes(ctx.plan),
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
  const added = { windows: 0, doors: 0, corners: 0, gables: 0, braces: 0 };

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
    if (X.doorHood && !covered && SH >= 3 && !(ctx.flat && storeys === 1 && false)) {
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
  if (X.braces && F < 0.01 && !ctx.flat) {
    const w0 = ctx.wings[0];
    const doors = openings.filter(o => o.kind !== 'window').map(o => o.e);
    const brace = slopeBeam(K, 45);
    for (const [x, z] of verts) {
      // on the long sides of the main wing only, not at its corners, every other post
      const onLong = Math.abs(Math.abs(z - w0.cz) - w0.D) < 0.01 && Math.abs(x - w0.cx) < w0.W - 0.5;
      if (!onLong || Math.round(x) % 4 !== 0) continue;
      if (doors.some(d => Math.hypot(d.x - x, d.z - z) < 2.2)) continue;
      const nz = z > w0.cz ? 1 : -1, cand = { name: brace, x, y: F + 1, z: z + nz * 1.05, yaw: normD(Math.atan2(nz, -0) * 180 / Math.PI) };
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
    if (/^wood_roof/.test(K.roof45 || '')) add(r === 2 ? 'wood_wall_roof_top_45' : 'wood_wall_roof_top', sg * w.W, low(-1) + (r === 2 ? 0 : 0) + 0, 0, 90, 'trim', low(-1) + 0.4);
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
  // raised benches along the long walls of a hall: 1 m deep, 0.3 m up, edged with a beam, wherever the wall is free
  if (X.wallBenches && ctx.F < 0.01) {
    const w0 = ctx.wings[0], y = ctx.F + 0.3, f1 = K.floor1 || 'wood_floor_1x1', beam = K.beam || 'wood_beam';
    const zones = ctx.zones || [];
    let laid = 0;
    for (const sz of [-1, 1]) {
      const zWall = w0.cz + sz * w0.D, zc = zWall - sz * 0.5;
      let run = [];
      const flush = () => {
        if (run.length >= 3) {
          for (const x of run) { b.put(f1, x, y, zc, 0, { trim: true }); laid++; }
          // the bench rests on beams laid on the floor along its front and back edges
          for (let i = 0; i < run.length; i += 2) {
            const two = i + 1 < run.length, x = two ? run[i] + 0.5 : run[i];
            for (const e of [-0.45, 0.45]) b.put(two ? beam : (K.beam1 || 'wood_beam_1'), x, y - 0.1, zc + e, 0, { trim: true });
          }
        }
        run = [];
      };
      for (let x = w0.cx - w0.W + 0.5; x < w0.cx + w0.W; x += 1) {
        const cand = { name: f1, x, y, z: zc, yaw: 0, q: quatD(0) }, cb = Ck.aabb(cand);
        const box = { x0: cb.x0, x1: cb.x1, y0: y - 0.3, y1: y + 2.0, z0: zc - 0.6, z1: zc + 0.6 };
        const hit = b.pieces.some(p => {
          const role = PD.piece(p.name).role;
          if (['floor', 'roof', 'roofTop', 'roofCorner', 'gable', 'wall', 'beam', 'rug'].includes(role) && !p.decor) return false;
          if (role === 'rug') return false;
          const o = Ck.aabb(p);
          return o.x0 < box.x1 && o.x1 > box.x0 && o.y0 < box.y1 && o.y1 > box.y0 && o.z0 < box.z1 && o.z1 > box.z0;
        }) || zones.some(zn => zn.x0 < box.x1 && zn.x1 > box.x0 && zn.z0 < box.z1 && zn.z1 > box.z0 && zn.y0 < box.y1 && zn.y1 > box.y0);
        if (hit) flush(); else run.push(x);
      }
      flush();
    }
    if (laid) b.notes.push('Raised benches along the long walls.');
  }
}

const apiD = { profile, exterior, bargeboards, partition, interior, slopeBeam };
if (NODE_D) module.exports = apiD; else window.VHDetails = apiD;
