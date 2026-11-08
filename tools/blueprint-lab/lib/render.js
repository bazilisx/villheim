// Draws a blueprint as flat-shaded polygons from any angle, with no game needed.
// Works in Node (with @napi-rs/canvas, or as SVG text) and in the browser (canvas 2D).
// A piece is {name, x, y, z, q: [qx, qy, qz, qw]} in Valheim world units (y up, left handed).

const Pieces = (typeof module !== 'undefined') ? require('./pieces.js') : window.VHPieces;

function rotate(q, v) {
  const [x, y, z, w] = q, [vx, vy, vz] = v;
  const ix = w * vx + y * vz - z * vy, iy = w * vy + z * vx - x * vz;
  const iz = w * vz + x * vy - y * vx, iw = -x * vx - y * vy - z * vz;
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z,
    iz * w + iw * -z + ix * -y - iy * -x];
}

// Faces of one piece in its own frame: arrays of [x,y,z] corners.
function localFaces(info) {
  let [w, h, d] = info.size;
  const hx = w / 2, hz = d / 2;
  const box = (x0, x1, y0, y1, z0, z1) => {
    const c = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    return [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]].map(f => f.map(i => c[i]));
  };
  switch (info.shape) {
    case 'slope26': case 'slope45': case 'slope67': {
      // a slab 2 m deep along z, rising toward -z by h, centred on the pivot
      // measured: a 26 degree roof piece has its pivot on its low edge, a 45 degree piece in its middle
      const t = 0.12, r = h / 2, lowPivot = info.shape === 'slope26';
      const yAt = z => -z / hz * r + (lowPivot ? r : 0);
      const top = [[-hx, yAt(-hz), -hz], [hx, yAt(-hz), -hz], [hx, yAt(hz), hz], [-hx, yAt(hz), hz]];
      const bot = top.map(([x, y, z]) => [x, y - t, z]);
      return [top, bot.slice().reverse(), [top[0], top[3], bot[3], bot[0]], [top[1], bot[1], bot[2], top[2]],
        [top[0], bot[0], bot[1], top[1]], [top[3], top[2], bot[2], bot[3]]];
    }
    case 'tri': case 'triInv': {
      // right triangle rising toward +x (measured: stacked gable pieces step +2 m along local x)
      const inv = info.shape === 'triInv';
      // pivot on the bottom edge (measured: the wall below a gable piece ends at its pivot)
      const f = inv ? [[-hx, h, -hz], [hx, h, -hz], [hx, 0, -hz]]
                    : [[-hx, 0, -hz], [hx, 0, -hz], [hx, h, -hz]];
      const b = f.map(([x, y]) => [x, y, hz]);
      return [f, b.slice().reverse(), [f[0], b[0], b[1], f[1]], [f[1], b[1], b[2], f[2]], [f[2], b[2], b[0], f[0]]];
    }
    case 'beam26': case 'beam45': case 'beam67': {
      const t = 0.12, r = h / 2;
      const p = [[-hx, -r - t, -t], [hx, r - t, -t], [hx, r + t, -t], [-hx, -r + t, -t], [-hx, -r - t, t], [hx, r - t, t], [hx, r + t, t], [-hx, -r + t, t]];
      return [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]].map(f => f.map(i => p[i]));
    }
    case 'stair': {
      // steps rising toward -z (same as roofs); drawn as three blocks
      const out = [];
      for (let i = 0; i < 3; i++) {
        const z0 = hz - (i + 1) * d / 3, z1 = hz - i * d / 3;
        out.push(...box(-hx, hx, -h / 2, -h / 2 + (i + 1) * h / 3, z0, z1));
      }
      return out;
    }
    case 'prop':
      return box(-hx, hx, 0, h, -hz, hz);
    case 'hipcorner26': case 'hipcorner45': {
      // outer hip corner: low along its +x and +z edges, rising to the inner corner (-x, -z); pivot on the low edge
      const r = info.shape === 'hipcorner45' ? 2 : 1, t = 0.12;
      const A = [hx, 0, hz], B = [hx, 0, -hz], Cc = [-hx, r, -hz], Dd = [-hx, 0, hz];
      const tri1 = [A, B, Cc], tri2 = [A, Cc, Dd];
      const dn = f => f.map(([x, y, z]) => [x, y - t, z]).reverse();
      return [tri1, tri2, dn(tri1), dn(tri2)];
    }
    case 'cap': {
      // ridge cap: a low inverted V 2 m across, its pivot at the height where the two slopes end
      const a = [[-hx, 0, -1], [hx, 0, -1], [hx, 0.45, 0], [-hx, 0.45, 0]], c = [[-hx, 0.45, 0], [hx, 0.45, 0], [hx, 0, 1], [-hx, 0, 1]];
      return [a, c];
    }
    default:
      return box(-hx, hx, -h / 2, h / 2, -hz, hz);
  }
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.max(0, Math.min(255, Math.round(c * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// opts: {az: degrees around y, el: degrees above horizon, cut: hide roof and pieces above this height,
//        hide: roles to leave out}
function polygons(pieces, opts = {}) {
  const az = (opts.az ?? 35) * Math.PI / 180, el = (opts.el ?? 30) * Math.PI / 180;
  const ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
  const light = norm([-0.45, 0.85, -0.3]);
  const polys = [];
  for (const p of pieces) {
    const info = Pieces.piece(p.name);
    if (opts.hide && opts.hide.includes(info.role)) continue;
    if (opts.cut != null && (info.role === 'roof' || info.role === 'roofTop' || info.role === 'roofCorner' || info.role === 'gable' || /^beam\d/.test(info.shape))) continue;
    if (opts.cut != null && p.y > opts.cut) continue;
    const q = p.q || [0, 0, 0, 1];
    const scale = p.s || [1, 1, 1];
    for (const face of localFaces(info)) {
      const wpts = face.map(([x, y, z]) => {
        const r = rotate(q, [x * scale[0], y * scale[1], z * scale[2]]);
        return [r[0] + p.x, r[1] + p.y, -(r[2] + p.z)]; // flip z to draw Unity's left-handed world unmirrored
      });
      const nrm = norm(cross(sub(wpts[1], wpts[0]), sub(wpts[2], wpts[0])));
      // camera space: rotate around y by az, then tilt by el
      const cam = wpts.map(([x, y, z]) => {
        const x1 = x * ca - z * sa, z1 = x * sa + z * ca;
        return [x1, y * ce - z1 * se, y * se + z1 * ce];
      });
      const cn = [nrm[0] * ca - nrm[2] * sa, 0, 0];
      const nz1 = nrm[0] * sa + nrm[2] * ca;
      const viewZ = nrm[1] * se + nz1 * ce;
      if (opts.cull && viewZ < -0.02) continue; // back face
      const lit = Math.abs(dot(nrm, light));
      const k = 0.55 + 0.6 * lit;
      const depth = cam.reduce((s, c) => s + c[2], 0) / cam.length;
      polys.push({ pts: cam.map(c => [c[0], c[1]]), depth, fill: shade(p.repaired ? (opts.repairColor || '#1fa595') : info.color, k),
        alpha: info.mat === 'glass' ? 0.45 : 1 });
      void cn;
    }
  }
  polys.sort((a, b) => a.depth - b.depth); // far first; larger depth is nearer the camera
  return polys;
}

function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function norm(a) { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

function bounds(polys) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of polys) for (const [x, y] of p.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { x0, x1, y0, y1 };
}

// Draw to any canvas 2D context.
function draw(ctx, pieces, opts = {}) {
  const W = opts.width || ctx.canvas.width, H = opts.height || ctx.canvas.height;
  const polys = polygons(pieces, opts);
  ctx.fillStyle = opts.background || '#e9e4d8';
  ctx.fillRect(0, 0, W, H);
  if (!polys.length) return;
  const b = bounds(polys), pad = 0.06;
  const s = Math.min(W * (1 - 2 * pad) / (b.x1 - b.x0 || 1), H * (1 - 2 * pad) / (b.y1 - b.y0 || 1));
  const ox = W / 2 - s * (b.x0 + b.x1) / 2, oy = H / 2 + s * (b.y0 + b.y1) / 2;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(0.4, Math.min(1.2, s / 40));
  for (const p of polys) {
    ctx.beginPath();
    p.pts.forEach(([x, y], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, ox + s * x, oy - s * y));
    ctx.closePath();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.fill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,22,15,0.35)';
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (opts.label) {
    ctx.fillStyle = '#2b241c';
    ctx.font = `${Math.round(H / 28)}px sans-serif`;
    ctx.fillText(opts.label, 10, H - 10);
  }
}

const VIEWS = [
  { key: 'front', az: 35, el: 28, label: 'front left' },
  { key: 'back', az: 215, el: 28, label: 'back right' },
  { key: 'top', az: 0, el: 89, label: 'top' },
  { key: 'inside', az: 35, el: 55, cut: 2.6, label: 'inside, roof off' },
];

if (typeof module !== 'undefined') module.exports = { polygons, draw, VIEWS };
else window.VHRender = { polygons, draw, VIEWS };
