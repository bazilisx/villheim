#!/usr/bin/env python3
"""Measure Valheim piece prefabs and fit a low-poly proxy to each, on Tyler's PC only.

Reads the game's asset bundles (UnityPy), walks each prefab's GameObject tree with its transforms, takes the visible
LOD0 meshes and the colliders, and writes one small JSON per piece: render bounds, collider boxes, the pivot, and a
proxy of 90 to 220 boxes and prisms with a color per part. The meshes themselves never leave the PC; only the
measurements and the proxy (our own coarse geometry) are written.

    python3 extract_models.py index   <Valheim_Data> <work dir>              # prefab name -> bundle
    python3 extract_models.py run     <Valheim_Data> <work dir> <names.txt> [seconds]
    python3 extract_models.py collect <work dir> <out.json>
    python3 extract_models.py stands  <Valheim_Data> <work dir> <names.txt>   # item stands: attach point, what fits
    python3 extract_models.py items   <Valheim_Data> <work dir> <names.txt> [seconds]  # items as a stand shows them
    python3 extract_models.py fit     <work dir> <names.txt> [seconds] [pieces|items] [i/k]   # proxies from the cache
    python3 extract_models.py collect_items <work dir> <out.json>
    python3 extract_models.py meshpack <work dir> <out.js>
    python3 extract_models.py tops    <work dir> <names.txt>   # level tops of the pieces flat stands rest on, exact

With VH_MESHES=1 in the environment, 'run' also writes a decimated copy of each piece's meshes (vertices merged on a
3 cm grid, a color per triangle) to <work dir>/meshes/, and 'meshpack' joins them into one script for the offline
copy of the lab page. That pack holds game geometry: it stays on Tyler's PC (BepInEx/config/Villheim-tools/) and is
never committed or published.

'run' (and 'items') reads the game files: it measures as many pieces as fit in the time given (default 150 s), skips
pieces already done, writes <work dir>/out/<name>.json and keeps the measured meshes in <work dir>/cache (on this PC
only). 'fit' then fits each proxy to the tolerance (TOL: 2 cm for pieces, 1.5 cm for stand items, 4 mm for the two
item stands) from that cache, so a refit never reads the game again; a piece whose last proxy (VH_OLD names the last
data/piece-models.json) is already within the tolerance keeps it. Both can be called again until nothing is left.
"""
import json, math, os, re, sys, time

import numpy as np

# How fine the proxy is (2026-11-11 round: more parts for small and thin pieces). The first round used a budget of
# 30 + 30 m per metre of the piece's largest size (40 to 150 parts), 28 voxels along a part, one primitive kept when it
# covered 72 % of a part (80 % for a flat part), at most 14 primitives a part and 6 rectangles a flat part, and dropped
# bits under 4 cm.
FINE = {'budget': (60, 45, 90, 220), 'item_budget': (30, 60, 30, 70), 'cells': 40, 'layer_cells': 64, 'solid_ok': 0.84,
        'layer_ok': 0.88, 'layer_rects': 12, 'cover': 0.95, 'gain': 0.05, 'share_max': 24, 'small': 0.04, 'small_rel': 0.05}

# ---------------------------------------------------------------- index


def build_index(data_dir, work):
    man = os.path.join(data_dir, 'StreamingAssets/SoftRef/manifest_extended')
    deps, idx, cur, sect = {}, {}, None, None
    asset = None
    with open(man, encoding='utf-8-sig') as f:
        for line in f:
            line = line.rstrip('\r\n')
            if line.startswith('bundle dependencies'):
                sect = 'deps'; continue
            if line.startswith('asset locations'):
                sect = 'assets'; continue
            if sect == 'deps':
                if line.startswith('- bundle: '):
                    cur = line[10:].strip(); deps[cur] = []
                elif line.startswith('  - ') and cur:
                    deps[cur].append(line[4:].strip())
            elif sect == 'assets':
                if line.startswith('  bundle: '):
                    asset = line[10:].strip()
                elif line.startswith('  path in bundle: '):
                    p = line[18:].strip()
                    if p.endswith('.prefab'):
                        name = p.rsplit('/', 1)[-1][:-7]
                        idx.setdefault(name, []).append([asset, p])
    for name, cands in idx.items():
        cands.sort(key=lambda c: (0 if '/GameElements/Pieces/' in c[1] else 1 if '/GameElements/' in c[1] else 2, len(c[1])))
    os.makedirs(work, exist_ok=True)
    with open(os.path.join(work, 'index.json'), 'w') as f:
        json.dump({'deps': deps, 'prefabs': idx}, f)
    print('prefabs', len(idx), 'bundles', len(deps))


# ---------------------------------------------------------------- math


def quat_mat(q):
    x, y, z, w = q
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def mat_quat(m):
    t = m[0, 0] + m[1, 1] + m[2, 2]
    if t > 0:
        s = math.sqrt(t + 1) * 2
        q = [(m[2, 1] - m[1, 2]) / s, (m[0, 2] - m[2, 0]) / s, (m[1, 0] - m[0, 1]) / s, s / 4]
    elif m[0, 0] > m[1, 1] and m[0, 0] > m[2, 2]:
        s = math.sqrt(1 + m[0, 0] - m[1, 1] - m[2, 2]) * 2
        q = [s / 4, (m[0, 1] + m[1, 0]) / s, (m[0, 2] + m[2, 0]) / s, (m[2, 1] - m[1, 2]) / s]
    elif m[1, 1] > m[2, 2]:
        s = math.sqrt(1 + m[1, 1] - m[0, 0] - m[2, 2]) * 2
        q = [(m[0, 1] + m[1, 0]) / s, s / 4, (m[1, 2] + m[2, 1]) / s, (m[0, 2] - m[2, 0]) / s]
    else:
        s = math.sqrt(1 + m[2, 2] - m[0, 0] - m[1, 1]) * 2
        q = [(m[0, 2] + m[2, 0]) / s, (m[1, 2] + m[2, 1]) / s, s / 4, (m[1, 0] - m[0, 1]) / s]
    if q[3] < 0:
        q = [-v for v in q]
    return q


def trs(t, q, s):
    m = np.eye(4)
    m[:3, :3] = quat_mat(q) * np.array(s)[None, :]
    m[:3, 3] = t
    return m


def hull2d(pts):
    pts = sorted(set(map(tuple, np.round(pts, 4))))
    if len(pts) <= 2:
        return np.array(pts)
    cr = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cr(up[-2], up[-1], p) <= 0: up.pop()
        up.append(p)
    return np.array(lo[:-1] + up[:-1])


def poly_area(h):
    if len(h) < 3:
        return 0.0
    x, y = h[:, 0], h[:, 1]
    return 0.5 * abs(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))


def simplify(h, n):
    h = list(map(tuple, h))
    while len(h) > n:
        best, bi = None, 0
        for i in range(len(h)):
            a, b, c = h[i - 1], h[i], h[(i + 1) % len(h)]
            loss = abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2
            if best is None or loss < best:
                best, bi = loss, i
        h.pop(bi)
    return np.array(h)


def min_rect_angle(p2):
    """Angle of the minimum-area rectangle around 2D points (rotating calipers on the hull)."""
    h = hull2d(p2)
    if len(h) < 3:
        return 0.0
    best, ang = None, 0.0
    for i in range(len(h)):
        e = h[(i + 1) % len(h)] - h[i]
        a = math.atan2(e[1], e[0])
        c, s = math.cos(a), math.sin(a)
        r = h @ np.array([[c, -s], [s, c]])
        area = np.ptp(r[:, 0]) * np.ptp(r[:, 1])
        if best is None or area < best - 1e-9:
            best, ang = area, a
    return ang


def axis_rot(axis, a):
    c, s = math.cos(a), math.sin(a)
    if axis == 0:
        return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
    if axis == 1:
        return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def best_frame(P):
    """Rotation (columns are the box axes) giving the smallest box around P. Prefers the piece's own axes."""
    def vol(R):
        L = P @ R
        return np.prod(np.maximum(np.ptp(L, axis=0), 0.01))
    cands = [np.eye(3)]
    if len(P) >= 4:
        try:
            w, v = np.linalg.eigh(np.cov((P - P.mean(0)).T))
            if np.linalg.det(v) < 0: v[:, 0] *= -1
            cands.append(v)
        except Exception:
            pass
        for ax in range(3):
            o = [i for i in range(3) if i != ax]
            a = min_rect_angle(P[:, o])
            # rotation about 'ax' that lines the rectangle up with the other two axes
            R = axis_rot(ax, a if ax != 1 else -a)
            cands.append(R)
    base = vol(cands[0])
    best = min(cands, key=vol)
    return cands[0] if vol(best) > 0.97 * base else best


# ---------------------------------------------------------------- voxels


def sample_tris(V, T, step, cap=400):
    """Points on the triangles, at most 'step' apart (up to 'cap' steps along an edge; the collider boxes keep the
    first round's 60)."""
    out = [V]
    a, b, c = V[T[:, 0]], V[T[:, 1]], V[T[:, 2]]
    L = np.maximum(np.linalg.norm(b - a, axis=1), np.linalg.norm(c - a, axis=1))
    n = np.clip(np.ceil(L / step).astype(int), 1, cap)
    for k in np.unique(n):
        sel = n == k
        if k <= 1:
            out.append((a[sel] + b[sel] + c[sel]) / 3)
            continue
        uu, vv = np.meshgrid(np.arange(k + 1), np.arange(k + 1))
        m = (uu + vv) <= k
        u, v = uu[m] / k, vv[m] / k
        A, B, C = a[sel], b[sel], c[sel]
        pts = A[:, None, :] + (B - A)[:, None, :] * u[None, :, None] + (C - A)[:, None, :] * v[None, :, None]
        out.append(pts.reshape(-1, 3))
    return np.concatenate(out)


def _dilate(g):
    n = g.copy()
    n[1:, :, :] |= g[:-1, :, :]; n[:-1, :, :] |= g[1:, :, :]
    n[:, 1:, :] |= g[:, :-1, :]; n[:, :-1, :] |= g[:, 1:, :]
    n[:, :, 1:] |= g[:, :, :-1]; n[:, :, :-1] |= g[:, :, 1:]
    return n


def _erode(g):
    return ~_dilate(~g)


def solid_grid(L, lo, vox, dims, close=True):
    """Occupancy from surface points L (frame coords), interior filled by flood from outside. With 'close', small
    gaps in the surface are sealed first (dilate, fill, erode), since many game meshes are open shells."""
    g = np.zeros(tuple(d + 4 for d in dims), bool)
    ij = np.floor((L - lo) / vox).astype(int) + 2
    for k in range(3):
        ij[:, k] = np.clip(ij[:, k], 2, dims[k] + 1)
    g[ij[:, 0], ij[:, 1], ij[:, 2]] = True
    wall = _dilate(g) if close else g
    out = np.zeros_like(g)
    out[0, :, :] = out[-1, :, :] = out[:, 0, :] = out[:, -1, :] = out[:, :, 0] = out[:, :, -1] = True
    out &= ~wall
    while True:
        n = _dilate(out) & ~wall
        if n.sum() == out.sum():
            break
        out = n
    inside = ~out
    if close:
        inside = _erode(inside) | g
    return inside[2:-2, 2:-2, 2:-2], g[2:-2, 2:-2, 2:-2]


def greedy_boxes(S, max_boxes, cover=0.93, min_frac=0.008, seed=1):
    """Boxes of solid cells covering S: grow from seeds, keep the box that covers the most new cells."""
    rng = np.random.default_rng(seed)
    total = S.sum()
    if total == 0:
        return []
    covered = np.zeros_like(S)
    boxes = []
    while len(boxes) < max_boxes and covered.sum() < cover * total:
        rem = np.argwhere(S & ~covered)
        if len(rem) == 0:
            break
        seeds = rem[rng.choice(len(rem), min(40, len(rem)), replace=False)]
        best, bb = 0, None
        for s in seeds:
            lo, hi = s.copy(), s + 1
            grow = True
            while grow:
                grow = False
                for ax in range(3):
                    for d in (-1, 1):
                        nl, nh = lo.copy(), hi.copy()
                        if d < 0:
                            if nl[ax] == 0: continue
                            nl[ax] -= 1; sl = [slice(nl[i], nh[i]) for i in range(3)]; sl[ax] = slice(nl[ax], nl[ax] + 1)
                        else:
                            if nh[ax] >= S.shape[ax]: continue
                            nh[ax] += 1; sl = [slice(nl[i], nh[i]) for i in range(3)]; sl[ax] = slice(nh[ax] - 1, nh[ax])
                        if S[tuple(sl)].all():
                            lo, hi, grow = nl, nh, True
            sl = tuple(slice(lo[i], hi[i]) for i in range(3))
            gain = (~covered[sl]).sum()
            if gain > best:
                best, bb = gain, (lo, hi)
        if bb is None or best < min_frac * total:
            break
        lo, hi = bb
        covered[tuple(slice(lo[i], hi[i]) for i in range(3))] = True
        boxes.append(bb)
    return boxes


# ---------------------------------------------------------------- fitting


def convex_mask(poly, X, Y, pad):
    """Cells (centers X, Y) inside a convex outline grown by 'pad'."""
    poly = np.asarray(poly, float)
    if poly_signed(poly) < 0:
        poly = poly[::-1]
    m = np.ones(X.shape, bool)
    for i in range(len(poly)):
        a, b = poly[i], poly[(i + 1) % len(poly)]
        e = b - a
        L = math.hypot(e[0], e[1])
        if L < 1e-9:
            continue
        m &= (e[0] * (Y - a[1]) - e[1] * (X - a[0])) / L >= -pad
    return m


def poly_signed(h):
    x, y = h[:, 0], h[:, 1]
    return 0.5 * (np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))


def prism_record(R, k, hs, lo, hi):
    o = [i for i in range(3) if i != k]
    Rp = np.stack([R[:, o[0]], R[:, o[1]], R[:, k]], 1)
    sgn = 1.0
    if np.linalg.det(Rp) < 0:
        Rp[:, 2] *= -1; sgn = -1.0
    c2 = (hs.min(0) + hs.max(0)) / 2
    cz = (lo[k] + hi[k]) / 2 * sgn
    cen = Rp @ np.array([c2[0], c2[1], cz])
    return ('prism', cen, hs - c2, float(hi[k] - lo[k]), Rp)


def _dil2(g):
    n = g.copy()
    n[1:, :] |= g[:-1, :]; n[:-1, :] |= g[1:, :]; n[:, 1:] |= g[:, :-1]; n[:, :-1] |= g[:, 1:]
    return n


def fill2d(F, r=2):
    """Close gaps of up to about 2 r cells in a 2D occupancy (seams between boards, the spaces between shingles and
    thatch tufts); real openings such as the pit of a hearth stay open."""
    g = np.pad(F, r + 1)
    for _ in range(r):
        g = _dil2(g)
    for _ in range(r):
        g = ~_dil2(~g)
    return g[r + 1:-r - 1, r + 1:-r - 1] | F


def layer_fit(V, T, R, L, nmax):
    """A flat part (a board, a slab, a sheet, a roof face) fitted by its outline seen square on: a rectangle, a convex
    outline (triangle, trapezoid, n-gon) or a few rectangles, with the thickness of the middle 90 % of its surface."""
    lo, hi = L.min(0), L.max(0)
    ext = np.maximum(hi - lo, 0.005)
    k = int(np.argmin(ext)); o = [i for i in range(3) if i != k]
    v2 = float(np.clip(max(ext[o]) / FINE['layer_cells'], 0.006, 0.05))
    pts = sample_tris(L, T, v2 * 0.5)
    t0, t1 = np.percentile(pts[:, k], 5), np.percentile(pts[:, k], 95)
    if t1 - t0 < 0.02:
        mid = (t0 + t1) / 2; t0, t1 = mid - 0.01, mid + 0.01
    t0, t1 = max(t0, lo[k]), min(t1, hi[k])
    if t1 - t0 < 0.02:
        mid = (t0 + t1) / 2; t0, t1 = mid - 0.01, mid + 0.01
    d2 = [max(1, int(math.ceil(ext[i] / v2))) for i in o]
    ij = np.clip(np.floor((pts[:, o] - lo[o]) / v2).astype(int), 0, np.array(d2) - 1)
    F = np.zeros(d2, bool); F[ij[:, 0], ij[:, 1]] = True
    F = fill2d(F)
    llo, lhi = lo.copy(), hi.copy(); llo[k], lhi[k] = t0, t1
    sz = lhi - llo
    box = ('box', R @ ((llo + lhi) / 2), sz, R)
    cands = [(float(F.mean()), 0.0, [box])]
    X, Y = np.meshgrid(lo[o[0]] + (np.arange(d2[0]) + 0.5) * v2, lo[o[1]] + (np.arange(d2[1]) + 0.5) * v2, indexing='ij')
    h = hull2d(L[:, o])
    if len(h) >= 3 and min(d2) >= 2:
        seen = set()
        for nv in (3, 4, 5, 6, 8, 10):
            hs = simplify(h, nv) if len(h) > nv else h
            if len(hs) in seen or len(hs) < 3:
                continue
            seen.add(len(hs))
            m2 = convex_mask(hs, X, Y, v2 * 0.6)
            iou = float((F & m2).sum() / max((F | m2).sum(), 1))
            cands.append((iou, 0.012 + 0.003 * len(hs), [prism_record(R, k, np.asarray(hs, float), llo, lhi)]))
    best = max(cands, key=lambda c: c[0] - c[1])
    if best[0] >= FINE['layer_ok'] or nmax <= 1:
        return best[2], best[0]
    rects = greedy_boxes(F[:, :, None], min(nmax, FINE['layer_rects']), cover=FINE['cover'], min_frac=0.012)
    if rects:
        U = np.zeros_like(F)
        for (a, b) in rects:
            U[a[0]:b[0], a[1]:b[1]] = True
        giou = float((F & U).sum() / max((F | U).sum(), 1))
        if giou > best[0] + FINE['gain']:
            out = []
            for (a, b) in rects:
                c = (llo + lhi) / 2; s3 = sz.copy()
                for j, ax in enumerate(o):
                    c[ax] = lo[ax] + (a[j] + b[j]) / 2 * v2; s3[ax] = (b[j] - a[j]) * v2
                out.append(('box', R @ c, s3, R))
            return out, giou
    return best[2], best[0]


def fit_component(V, T, nmax=10):
    """Primitives for one part, chosen by how well they cover its solid voxels: one box, one prism (a triangle,
    wedge, trapezoid or n-gon outline pushed out along one axis), or a few boxes for a concave part."""
    R = best_frame(V)
    L = V @ R
    lo, hi = L.min(0), L.max(0)
    ext = np.maximum(hi - lo, 0.01)
    se = np.sort(ext)
    if len(T) and se[0] < 0.5 * se[1] and se[1] > 0.08:
        return layer_fit(V, T, R, L, nmax)
    hi = lo + ext
    vox = float(np.clip(ext.max() / FINE['cells'], 0.006, 0.06))
    while np.prod([math.ceil(e / vox) for e in ext]) > 150000:
        vox *= 1.25
    dims = [max(1, int(math.ceil(e / vox))) for e in ext]
    box = ('box', R @ ((lo + hi) / 2), ext, R)
    if len(T) == 0:
        return [box], 1.0
    S, _ = solid_grid(sample_tris(L, T, vox * 0.5), lo, vox, dims)
    tot = S.sum()
    if tot == 0:
        return [box], 1.0
    cands = [(float(S.mean()), 0.0, [box])]
    ctr = [lo[i] + (np.arange(dims[i]) + 0.5) * vox for i in range(3)]
    for k in range(3):
        o = [i for i in range(3) if i != k]
        if dims[o[0]] < 2 or dims[o[1]] < 2:
            continue
        h = hull2d(L[:, o])
        if len(h) < 3:
            continue
        X, Y = np.meshgrid(ctr[o[0]], ctr[o[1]], indexing='ij')
        seen = set()
        for nv in (3, 4, 5, 6, 8, 10):
            hs = simplify(h, nv) if len(h) > nv else h
            if len(hs) in seen or len(hs) < 3:
                continue
            seen.add(len(hs))
            m2 = convex_mask(hs, X, Y, vox * 0.6)
            mask = np.expand_dims(m2, k)
            mask = np.broadcast_to(mask, S.shape)
            iou = float((S & mask).sum() / max((S | mask).sum(), 1))
            cands.append((iou, 0.012 + 0.003 * len(hs), [prism_record(R, k, np.asarray(hs, float), lo, hi)]))
    best = max(cands, key=lambda c: c[0] - c[1])
    if best[0] >= FINE['solid_ok'] or nmax <= 1 or min(dims) < 1:
        return best[2], best[0]
    boxes = greedy_boxes(S, nmax, cover=FINE['cover'], min_frac=0.006)
    if boxes:
        U = np.zeros_like(S)
        for (a, b) in boxes:
            U[tuple(slice(a[i], b[i]) for i in range(3))] = True
        giou = float((S & U).sum() / max((S | U).sum(), 1))
        if giou > best[0] + FINE['gain']:
            return [('box', R @ (lo + (a + b) / 2 * vox), (b - a) * vox, R) for (a, b) in boxes], giou
    return best[2], best[0]


# ---------------------------------------------------------------- fitting to a tolerance (2026-11-11)
#
# Each part is fitted until its proxy lies within TOL of the real surface both ways: no point of the part's solid
# farther than TOL from the proxy, and no point of the proxy farther than TOL from the solid (99th percentile, on a
# voxel grid of TOL / 2 or finer where the grid allows). Detail under TOL (bevels, cracks, seams) is left out. One box
# or one prism is kept when it meets the tolerance; otherwise boxes inside the solid are added until it does.

ITEM_PARTS = 250
TOL = {'pieces': 0.02, 'items': float(os.environ.get('VH_ITEM_TOL', 0.015)), 'stands': 0.004}
# VH_CELL_CAP and VH_MAX_BOXES raise the limits for pieces that hit them (roofs, hearths, the fermenter)
CELL_CAP = int(os.environ.get('VH_CELL_CAP', 1200000))
MAX_BOXES = int(os.environ.get('VH_MAX_BOXES', 400))


def _nd():
    import scipy.ndimage as nd
    return nd


def solid_fast(pts, lo, vox, dims):
    """As solid_grid, with scipy: surface cells, closed by one cell, holes filled."""
    nd = _nd()
    g = np.zeros(tuple(dims), bool)
    ij = np.floor((pts - lo) / vox).astype(int)
    for k in range(3):
        ij[:, k] = np.clip(ij[:, k], 0, dims[k] - 1)
    g[ij[:, 0], ij[:, 1], ij[:, 2]] = True
    pad = np.pad(g, 2)
    closed = nd.binary_closing(pad, iterations=1)
    filled = nd.binary_fill_holes(closed)
    return filled[2:-2, 2:-2, 2:-2] | g


def tol_fit(V, T, tol):
    """Primitives for one part within 'tol' (see above). Returns (records, error in metres)."""
    nd = _nd()
    R = best_frame(V)
    L = V @ R
    lo, hi = L.min(0), L.max(0)
    ext = np.maximum(hi - lo, 0.002)
    one = ('box', R @ ((lo + hi) / 2), ext, R)
    if len(T) == 0 or ext.max() <= tol:
        return [one], 0.0
    vox = tol / 2
    while np.prod([math.ceil(e / vox) + 2 for e in ext]) > CELL_CAP:
        vox *= 1.1
    g0 = lo - vox
    dims = [int(math.ceil(e / vox)) + 2 for e in ext]
    S = solid_fast(sample_tris(L, T, vox * 0.5), g0, vox, dims)
    if not S.any():
        return [one], 0.0
    DS = nd.distance_transform_edt(~S) * vox  # how far each cell is from the solid
    ctr = [g0[i] + (np.arange(dims[i]) + 0.5) * vox for i in range(3)]

    def err(P):
        if not P.any():
            return 9.0
        over = float(np.percentile(DS[P], 99))
        if over > tol + vox * 0.5:
            return over
        DP = nd.distance_transform_edt(~P) * vox
        return max(over, float(np.percentile(DP[S], 99)))

    def boxmask(blo, bhi):
        m = [(ctr[i] >= blo[i] - vox * 0.5) & (ctr[i] <= bhi[i] + vox * 0.5) for i in range(3)]
        return m[0][:, None, None] & m[1][None, :, None] & m[2][None, None, :]

    cands = [(err(boxmask(lo, hi)), 1, [one])]
    if cands[0][0] <= tol:
        return cands[0][2], cands[0][0]
    for k in range(3):
        o = [i for i in range(3) if i != k]
        if dims[o[0]] < 3 or dims[o[1]] < 3:
            continue
        h = hull2d(L[:, o])
        if len(h) < 3:
            continue
        X, Y = np.meshgrid(ctr[o[0]], ctr[o[1]], indexing='ij')
        seen = set()
        for nv in (3, 4, 5, 6, 8, 10, 12, 16):
            hs = simplify(h, nv) if len(h) > nv else h
            if len(hs) in seen or len(hs) < 3:
                continue
            seen.add(len(hs))
            m2 = convex_mask(hs, X, Y, vox * 0.5)
            zm = (ctr[k] >= lo[k] - vox * 0.5) & (ctr[k] <= hi[k] + vox * 0.5)
            P = np.expand_dims(m2, k) & zm.reshape([-1 if i == k else 1 for i in range(3)])
            e = err(P)
            cands.append((e, 1, [prism_record(R, k, np.asarray(hs, float), lo, hi)]))
            if e <= tol:
                break
    ok = [c for c in cands if c[0] <= tol]
    if ok:
        best = min(ok, key=lambda c: c[0])
        return best[2], best[0]
    # boxes inside the solid, each grown from a cell still too far from the boxes so far
    rng = np.random.default_rng(1)
    covered = np.zeros_like(S)
    boxes = []
    far = S.copy()
    e = 9.0
    while len(boxes) < MAX_BOXES:
        rem = np.argwhere(far & ~covered)
        if len(rem) == 0:
            break
        seeds = rem[rng.choice(len(rem), min(10, len(rem)), replace=False)]
        best, bb = 0, None
        for sd in seeds:
            blo, bhi = sd.copy(), sd + 1
            grow = True
            while grow:
                grow = False
                for ax in range(3):
                    for d in (-1, 1):
                        nl, nh = blo.copy(), bhi.copy()
                        if d < 0:
                            if nl[ax] == 0: continue
                            nl[ax] -= 1; sl = [slice(nl[i], nh[i]) for i in range(3)]; sl[ax] = slice(nl[ax], nl[ax] + 1)
                        else:
                            if nh[ax] >= S.shape[ax]: continue
                            nh[ax] += 1; sl = [slice(nl[i], nh[i]) for i in range(3)]; sl[ax] = slice(nh[ax] - 1, nh[ax])
                        if S[tuple(sl)].all():
                            blo, bhi, grow = nl, nh, True
            sl = tuple(slice(blo[i], bhi[i]) for i in range(3))
            gain = (far[sl] & ~covered[sl]).sum()
            if gain > best:
                best, bb = gain, (blo, bhi)
        if bb is None:
            break
        covered[tuple(slice(bb[0][i], bb[1][i]) for i in range(3))] = True
        boxes.append(bb)
        if len(boxes) % 4 == 0 or len(rem) < 50:
            DP = nd.distance_transform_edt(~covered) * vox
            far = S & (DP > tol)
            e = float(np.percentile(DP[S], 99))
            if not far.any() or e <= tol:
                break
    if boxes:
        DP = nd.distance_transform_edt(~covered) * vox
        e = float(np.percentile(DP[S], 99))
    best1 = min(cands, key=lambda c: c[0])
    if not boxes or best1[0] <= e:
        return best1[2], best1[0]
    return [('box', R @ (g0 + (a + b) / 2 * vox), (b - a) * vox, R) for (a, b) in boxes], e


def components(V, T):
    """Connected parts of a mesh (vertices welded at 1 mm)."""
    key = np.round(V * 1000).astype(np.int64)
    _, inv = np.unique(key, axis=0, return_inverse=True)
    inv = inv.reshape(-1)
    parent = np.arange(inv.max() + 1)

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a
    W = inv[T]
    for a, b, c in W:
        ra, rb, rc = find(a), find(b), find(c)
        if rb != ra: parent[rb] = ra
        if rc != ra: parent[rc] = ra
    roots = np.array([find(i) for i in range(len(parent))])
    lab = roots[W[:, 0]]
    out = []
    for r in np.unique(lab):
        out.append(np.nonzero(lab == r)[0])
    return out


# ---------------------------------------------------------------- unity reading

MAT_WORDS = [
    ('glass', r'glass|crystal'), ('thatch', r'straw|thatch|hay'), ('stone', r'stone|rock|cobble|marble|grausten|brick'),
    ('iron', r'iron|metal|nail|chain|blackmetal|bronze|copper'), ('fur', r'(?<![a-z])fur(?!n)|pelt|hide|leather|deer|wolf|lox|rug'),
    ('cloth', r'cloth|banner|linen|fabric|jute|tapestry|curtain|carpet'), ('fire', r'fire|flame|ember|candle|wax'),
    ('darkwood', r'darkwood|dark_wood|tar|blackwood'), ('corewood', r'corewood|log|roundlog|bark'),
    ('green', r'leaf|leaves|grass|moss|plant|bush|vine'), ('bone', r'bone|skull'), ('gold', r'gold|coin'),
    ('wood', r'wood|plank|beam|timber'),
]


def mat_class(name):
    n = (name or '').lower()
    for k, rx in MAT_WORDS:
        if re.search(rx, n):
            return k
    return ''


class Reader:
    def __init__(self, env):
        self.env = env
        self.tex_cache = {}

    def tex_rgb(self, tex_ptr):
        try:
            key = (tex_ptr.m_FileID, tex_ptr.m_PathID)
        except AttributeError:
            key = id(tex_ptr)
        if key in self.tex_cache:
            return self.tex_cache[key]
        arr = None
        try:
            tex = tex_ptr.read()
            img = tex.image.convert('RGB').resize((64, 64))
            arr = np.asarray(img, dtype=np.float32) / 255.0
        except Exception:
            arr = None
        self.tex_cache[key] = arr
        return arr

    def material(self, mptr):
        info = {'name': '', 'tex': None, 'color': (1, 1, 1), 'texname': ''}
        try:
            m = mptr.read()
        except Exception:
            return info
        info['name'] = m.m_Name
        sp = m.m_SavedProperties
        for k, v in sp.m_TexEnvs:
            if k in ('_MainTex', '_BaseMap', '_Albedo', '_MainTexture') and v.m_Texture.m_PathID != 0:
                info['tex'] = self.tex_rgb(v.m_Texture)
                try:
                    info['texname'] = v.m_Texture.read().m_Name
                except Exception:
                    pass
                break
        for k, v in sp.m_Colors:
            if k in ('_Color', '_BaseColor'):
                info['color'] = (v.r, v.g, v.b)
                break
        return info


# Layers and the collision matrix come from globalgamemanagers ('layers' writes them to <work>/layers.json). A
# collider blocks the player when it is not a trigger and its GameObject's layer collides with 'character'.
LAYERS = {}
CHAR_HITS = None
SNAP_TAG = 20000  # first custom tag; 'snappoint' is the first entry of Valheim's tag list


def load_layers(work):
    global LAYERS, CHAR_HITS, SNAP_TAG
    f = os.path.join(work, 'layers.json')
    if not os.path.exists(f):
        return
    d = json.load(open(f))
    LAYERS = {int(k): v for k, v in d['layers'].items()}
    CHAR_HITS = set(d['character_hits'])
    if 'snappoint' in d.get('tags', []):
        SNAP_TAG = 20000 + d['tags'].index('snappoint')


def write_layers(data_dir, work):
    import UnityPy
    env = UnityPy.load(os.path.join(data_dir, 'globalgamemanagers'))
    layers, tags, matrix = {}, [], None
    for o in env.objects:
        if o.type.name == 'TagManager':
            d = o.read_typetree()
            tags = d.get('tags', [])
            layers = {i: n for i, n in enumerate(d.get('layers', [])) if n}
        elif o.type.name == 'PhysicsManager':
            matrix = o.read_typetree().get('m_LayerCollisionMatrix')
    ch = [k for k, v in layers.items() if v == 'character'][0]
    hits = [i for i in range(32) if matrix[ch] >> i & 1]
    os.makedirs(work, exist_ok=True)
    json.dump({'layers': layers, 'tags': tags, 'character_hits': hits, 'character_hits_names': [layers.get(i, str(i)) for i in hits]},
              open(os.path.join(work, 'layers.json'), 'w'), indent=1)
    print('character collides with', [layers.get(i, str(i)) for i in hits])


def frame_of(M):
    """Rotation (orthonormal, right handed) and per-axis scale of a 4x4 transform."""
    A = M[:3, :3]
    sc = np.linalg.norm(A, axis=0)
    R = A / np.maximum(sc, 1e-9)[None, :]
    u, _, vt = np.linalg.svd(R)
    R = u @ vt
    if np.linalg.det(R) < 0:
        R[:, 2] *= -1
    return R, sc


def obb_record(R, c, size):
    d = {'c': np.round(c, 3).tolist(), 's': np.round(np.abs(size), 3).tolist()}
    q = mat_quat(R)
    if abs(q[3]) < 0.99999:
        d['q'] = [round(v, 4) for v in q]
    return d


def collider_of(cr, t, M, go):
    """One collider in the piece's frame: oriented box, sphere, capsule, or a mesh as one or a few oriented boxes."""
    if not getattr(cr, 'm_Enabled', True):
        return None
    trig = bool(getattr(cr, 'm_IsTrigger', False))
    layer = int(getattr(go, 'm_Layer', 0))
    R, sc = frame_of(M)
    rec = {'type': t.replace('Collider', '').lower(), 'go': go.m_Name, 'trigger': trig, 'layer': LAYERS.get(layer, str(layer)),
           'solid': (not trig) and (CHAR_HITS is None or layer in CHAR_HITS)}
    corners = None
    if t == 'BoxCollider':
        ce, sz = cr.m_Center, cr.m_Size
        c = M[:3, :3] @ np.array([ce.x, ce.y, ce.z]) + M[:3, 3]
        rec.update(obb_record(R, c, np.array([sz.x, sz.y, sz.z]) * sc))
        lo = np.array([ce.x - sz.x / 2, ce.y - sz.y / 2, ce.z - sz.z / 2]); hi = lo + [sz.x, sz.y, sz.z]
        corners = np.array([[x, y, z] for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])])
    elif t == 'SphereCollider':
        ce, rr = cr.m_Center, cr.m_Radius
        c = M[:3, :3] @ np.array([ce.x, ce.y, ce.z]) + M[:3, 3]
        r = float(rr * sc.max())
        rec.update({'c': np.round(c, 3).tolist(), 'r': round(r, 3)})
        corners = None
        rec['min'] = np.round(c - r, 3).tolist(); rec['max'] = np.round(c + r, 3).tolist()
    elif t == 'CapsuleCollider':
        ce, rr, hh, d = cr.m_Center, cr.m_Radius, cr.m_Height, cr.m_Direction
        c = M[:3, :3] @ np.array([ce.x, ce.y, ce.z]) + M[:3, 3]
        o = [i for i in range(3) if i != d]
        r = float(rr * max(sc[o[0]], sc[o[1]]))
        h = float(max(hh * sc[d], 2 * r))
        ax = R[:, d]
        rec.update({'c': np.round(c, 3).tolist(), 'r': round(r, 3), 'h': round(h, 3), 'ax': np.round(ax, 4).tolist()})
        half = np.abs(ax) * (h / 2 - r) + r
        rec['min'] = np.round(c - half, 3).tolist(); rec['max'] = np.round(c + half, 3).tolist()
    else:
        rec['convex'] = bool(getattr(cr, 'm_Convex', False))
        mm = cr.m_Mesh.read()
        from UnityPy.helpers.MeshHelper import MeshHandler
        h = MeshHandler(mm); h.process()
        if not h.m_Vertices:
            return None
        Vl = np.array(h.m_Vertices, dtype=np.float64)[:, :3]
        V = (M[:3, :3] @ Vl.T).T + M[:3, 3]
        T = np.concatenate([np.array(x, dtype=np.int64).reshape(-1, 3) for x in h.get_triangles() if len(x)]) if h.get_triangles() else None
        rec['boxes'] = collider_boxes(V, T)
        rec['min'] = np.round(V.min(0), 3).tolist(); rec['max'] = np.round(V.max(0), 3).tolist()
    if corners is not None:
        W = (M[:3, :3] @ corners.T).T + M[:3, 3]
        rec['min'] = W.min(0).round(3).tolist(); rec['max'] = W.max(0).round(3).tolist()
    return rec


def collider_boxes(V, T, nmax=6):
    """A mesh collider as one oriented box, or a few when one box would be far too large (a concave or L shape)."""
    R = best_frame(V)
    L = V @ R
    lo, hi = L.min(0), L.max(0)
    ext = np.maximum(hi - lo, 0.01)
    one = [obb_record(R, R @ ((lo + hi) / 2), ext)]
    if T is None or len(T) == 0 or len(V) < 8:
        return one
    vox = float(np.clip(ext.max() / 24, 0.025, 0.25))
    dims = [max(1, int(math.ceil(e / vox))) for e in ext]
    S, _ = solid_grid(sample_tris(L, T, vox * 0.5, 60), lo, vox, dims)
    if S.mean() >= 0.75 or min(dims) <= 2 and S.mean() >= 0.6:
        return one
    out = []
    for (a, b) in greedy_boxes(S, nmax, cover=0.92, min_frac=0.03):
        out.append(obb_record(R, R @ (lo + (a + b) / 2 * vox), (b - a) * vox))
    return out or one


def comp_of(go, tname):
    for c in go.m_Component:
        o = c.component.deref()
        if o.type.name == tname:
            return o
    return None


def all_nodes(root):
    out, stack = [], [root]
    while stack:
        go = stack.pop()
        out.append(go)
        tr = (comp_of(go, 'Transform') or comp_of(go, 'RectTransform')).read()
        for ch in tr.m_Children:
            stack.append(ch.read().m_GameObject.read())
    return out


def measure(reader, root, lod_root=None):
    """Walk the prefab; returns meshes (piece-frame verts, tris, per-tri colors/material names) and colliders. With
    lod_root (an item's whole prefab when only its 'attach' branch is measured), the LOD groups come from all of it."""
    meshes, colliders, lod_skip, snaps = [], [], set(), []
    stack = [(root, np.eye(4), True, True)]
    nodes = []
    while stack:
        go, M, is_root, active = stack.pop()
        tr = (comp_of(go, 'Transform') or comp_of(go, 'RectTransform')).read()
        if not is_root:
            lp, lr, ls = tr.m_LocalPosition, tr.m_LocalRotation, tr.m_LocalScale
            M = M @ trs((lp.x, lp.y, lp.z), (lr.x, lr.y, lr.z, lr.w), (ls.x, ls.y, ls.z))
        # snap points are inactive children tagged 'snappoint'; nothing else of an inactive branch is read
        if getattr(go, 'm_Tag', 0) == SNAP_TAG:
            snaps.append(np.round(M[:3, 3], 3).tolist())
        if active:
            nodes.append((go, M))
        for ch in tr.m_Children:
            cgo = ch.read().m_GameObject.read()
            stack.append((cgo, M, False, active and bool(cgo.m_IsActive)))
    for go in ([g for g, _ in nodes] if lod_root is None else all_nodes(lod_root)):
        for c in go.m_Component:
            o = c.component.deref()
            if o.type.name == 'LODGroup':
                lg = o.read()
                keep = set()
                for i, l in enumerate(lg.m_LODs):
                    for r in l.renderers:
                        if i == 0: keep.add(r.renderer.m_PathID)
                for i, l in enumerate(lg.m_LODs[1:]):
                    for r in l.renderers:
                        if r.renderer.m_PathID not in keep:
                            lod_skip.add(r.renderer.m_PathID)
    for go, M in nodes:
        name = go.m_Name
        for c in go.m_Component:
            o = c.component.deref()
            t = o.type.name
            if t in ('MeshRenderer', 'SkinnedMeshRenderer'):
                if o.path_id in lod_skip:
                    continue
                r = o.read()
                if not getattr(r, 'm_Enabled', True):
                    continue
                if t == 'MeshRenderer':
                    mf = comp_of(go, 'MeshFilter')
                    if mf is None: continue
                    mp = mf.read().m_Mesh
                else:
                    mp = r.m_Mesh
                try:
                    mesh = mp.read()
                except Exception as e:
                    print('  mesh?', name, str(e)[:60]); continue
                from UnityPy.helpers.MeshHelper import MeshHandler
                h = MeshHandler(mesh)
                h.process()
                if not h.m_Vertices:
                    continue
                Vl = np.array(h.m_Vertices, dtype=np.float64)[:, :3]
                V = (M[:3, :3] @ Vl.T).T + M[:3, 3]
                UV = np.array(h.m_UV0, dtype=np.float64)[:, :2] if h.m_UV0 else None
                subs = h.get_triangles()
                mats = [reader.material(mp_) for mp_ in r.m_Materials]
                for si, tris in enumerate(subs):
                    if not len(tris): continue
                    T = np.array(tris, dtype=np.int64).reshape(-1, 3)
                    mi = mats[min(si, len(mats) - 1)] if mats else {'name': '', 'tex': None, 'color': (1, 1, 1), 'texname': ''}
                    if re.search(r'shadow|invisible|_fx|particle|glow|smoke', mi['name'], re.I):
                        continue
                    if mi['tex'] is not None and UV is not None:
                        uv = (UV[T[:, 0]] + UV[T[:, 1]] + UV[T[:, 2]]) / 3
                        tx = mi['tex']
                        u = np.mod(uv[:, 0], 1.0); v = np.mod(uv[:, 1], 1.0)
                        px = np.clip((u * 64).astype(int), 0, 63); py = np.clip(((1 - v) * 64).astype(int), 0, 63)
                        col = tx[py, px] * np.array(mi['color'])[None, :]
                    else:
                        col = np.tile(np.array(mi['color']), (len(T), 1))
                    meshes.append({'go': name, 'V': V, 'T': T, 'col': np.clip(col, 0, 1), 'mat': mi['name'], 'tex': mi['texname'],
                                   'cls': mat_class(mi['name'] + ' ' + mi['texname'] + ' ' + name)})
            elif t in ('BoxCollider', 'MeshCollider', 'CapsuleCollider', 'SphereCollider'):
                try:
                    col = collider_of(o.read(), t, M, go)
                except Exception as e:
                    print('  collider?', name, t, str(e)[:60]); col = None
                if col:
                    colliders.append(col)
    return meshes, colliders, snaps


def hexcol(c):
    c = np.clip(np.asarray(c), 0, 1)
    return '#%02x%02x%02x' % tuple(int(round(v * 255)) for v in c)


def comp_shape(V):
    """Thickness and width of a part in its best frame (sorted extents)."""
    if len(V) > 600:
        V = V[np.random.default_rng(0).choice(len(V), 600, replace=False)]
    R = best_frame(V)
    return np.sort(np.ptp(V @ R, axis=0))


def merge_sheets(comps, g=0.04):
    """Flat parts of one material that touch or overlap and still form one flat layer become one part: shingle rows,
    thatch, blanket folds, rug pieces, the planks of a gable, wall or floor. Each joined part is fitted once, so it draws as a clean slab or
    outline instead of a heap of tilted scraps."""
    n = len(comps)
    if n < 2:
        return comps
    ext = [comp_shape(c['V']) for c in comps]
    sheet = [e[0] < 0.4 and e[0] < 0.5 * e[1] for e in ext]
    idx = [i for i in range(n) if sheet[i]]
    if len(idx) < 2:
        return comps
    lo = np.array([comps[i]['V'].min(0) for i in range(n)]) - g
    hi = np.array([comps[i]['V'].max(0) for i in range(n)]) + g
    cells = {}
    for i in idx:
        pts = sample_tris(comps[i]['V'], comps[i]['T'], g) if len(comps[i]['T']) < 4000 else comps[i]['V']
        k = np.unique(np.floor(pts / g).astype(np.int64), axis=0)
        sh = np.array([[a, b, c] for a in (-1, 0, 1) for b in (-1, 0, 1) for c in (-1, 0, 1)])
        cells[i] = set(map(tuple, np.unique((k[:, None, :] + sh[None]).reshape(-1, 3), axis=0)))
    pairs = []
    for ii, i in enumerate(idx):
        for j in idx[ii + 1:]:
            if (comps[i]['cls'] or comps[i]['mat']) != (comps[j]['cls'] or comps[j]['mat']):
                continue
            if np.abs(np.asarray(comps[i]['col']) - np.asarray(comps[j]['col'])).max() > 0.2:
                continue
            if np.any(lo[i] > hi[j]) or np.any(lo[j] > hi[i]):
                continue
            sh = len(cells[i] & cells[j])
            if sh >= 3:
                pairs.append((-sh / min(len(cells[i]), len(cells[j])), i, j))
    pairs.sort()
    parent = list(range(n))
    members = {i: [i] for i in range(n)}
    thick = {i: ext[i][0] for i in range(n)}

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]; a = parent[a]
        return a
    for _, i, j in pairs:
        ri, rj = find(i), find(j)
        if ri == rj:
            continue
        V = np.concatenate([comps[m]['V'] for m in members[ri] + members[rj]])
        e = comp_shape(V)
        if e[0] > max(0.25, 1.4 * max(thick[ri], thick[rj])) or e[0] > 0.45 * e[1]:
            continue
        parent[rj] = ri
        members[ri] += members.pop(rj)
        thick[ri] = e[0]
    out = []
    for r, ms in members.items():
        if len(ms) == 1:
            out.append(comps[ms[0]]); continue
        out.append(join_comps([comps[m] for m in ms]))
    return out


def join_comps(cs):
    off, Vs, Ts = 0, [], []
    for c in cs:
        Vs.append(c['V']); Ts.append(c['T'] + off); off += len(c['V'])
    area = sum(c['area'] for c in cs)
    col = sum(c['col'] * c['area'] for c in cs) / max(area, 1e-9)
    big = max(cs, key=lambda c: c['area'])
    V = np.concatenate(Vs)
    return {'V': V, 'T': np.concatenate(Ts), 'area': area, 'ext': np.ptp(V, axis=0), 'col': col, 'mat': big['mat'],
            'cls': big['cls'], 'go': big['go'], 'n': sum(c.get('n', 1) for c in cs)}


def cluster(comps, target):
    """Too many parts: join parts of one material class whose centers fall in the same cell of a grid that grows
    until few enough are left."""
    g = 0.1
    while True:
        groups = {}
        for c in comps:
            ctr = (c['V'].min(0) + c['V'].max(0)) / 2
            groups.setdefault((c['cls'], c['mat']) + tuple(np.floor(ctr / g).astype(int)), []).append(c)
        if len(groups) <= target or g > 8:
            break
        g *= 1.4
    return [cs[0] if len(cs) == 1 else join_comps(cs) for cs in groups.values()]


def part_volume(pr):
    if pr[0] == 'box':
        return float(np.prod(np.maximum(pr[2], 0.01)))
    return poly_area(np.asarray(pr[2])) * max(pr[3], 0.01)


def proxy(meshes, budget=None, kind='budget', tol=None):
    allV = np.concatenate([m['V'] for m in meshes])
    lo, hi = allV.min(0), allV.max(0)
    maxdim = float((hi - lo).max())
    comps = []
    for m in meshes:
        V, T = m['V'], m['T']
        for idx in components(V, T):
            Tc = T[idx]
            used = np.unique(Tc)
            remap = -np.ones(len(V), np.int64); remap[used] = np.arange(len(used))
            Vc = V[used]; Tl = remap[Tc]
            a, b, c = Vc[Tl[:, 0]], Vc[Tl[:, 1]], Vc[Tl[:, 2]]
            area = np.linalg.norm(np.cross(b - a, c - a), axis=1) / 2
            ext = np.ptp(Vc, axis=0)
            col = (m['col'][idx] * area[:, None]).sum(0) / max(area.sum(), 1e-9) if area.sum() > 0 else m['col'][idx].mean(0)
            comps.append({'V': Vc, 'T': Tl, 'area': float(area.sum()), 'ext': ext, 'col': col, 'mat': m['mat'], 'cls': m['cls'], 'go': m['go']})
    total_area = sum(c['area'] for c in comps) or 1
    if budget is None:
        b0, bm, blo, bhi = FINE[kind]
        budget = int(np.clip(b0 + bm * maxdim, blo, bhi))
    # leave out nails and other small details (smaller ones kept on small pieces: a mug's handle, a lantern's frame)
    small = min(FINE['small'], max(0.008, FINE['small_rel'] * maxdim))
    if tol is not None:
        small = tol
    keep = [c for c in comps if not (c['ext'].max() < small or (c['area'] < 0.001 * total_area and c['ext'].max() < 3 * small))]
    if not keep:
        keep = comps
    if tol is not None:
        # parts of one material in one cell of a grid are fitted together (thatch tufts, shingles, rock chips); the
        # fit is to the tolerance either way, so this only saves time
        if len(keep) > 300:
            keep = cluster(keep, 300)
        keep = merge_sheets(keep)
        budget = 10 ** 6
    else:
        if len(keep) > 3 * budget:
            keep = cluster(keep, 2 * budget)
        keep = merge_sheets(keep)
        if len(keep) > 0.75 * budget:
            keep = cluster(keep, int(0.75 * budget))
    parts = []
    for c in keep:
        if tol is not None:
            prs, _ = tol_fit(c['V'], c['T'], tol)
        else:
            share = int(np.clip(budget * c['area'] / total_area * 1.5 + 2, 2, FINE['share_max']))
            prs, _ = fit_component(c['V'], c['T'], share)
        for pr in prs:
            parts.append((pr, c))
    if len(parts) > budget:
        parts.sort(key=lambda pc: -part_volume(pc[0]))
        parts = parts[:budget]
    out = []
    nd_ = 4 if tol is not None and tol < 0.01 else 3
    for pr, c in parts:
        d = {'col': hexcol(c['col']), 'm': c['cls'] or mat_class(c['go'])}
        if pr[0] == 'box':
            _, cen, s, R = pr
            d.update({'t': 'box', 'c': np.round(cen, nd_).tolist(), 's': np.round(s, nd_).tolist()})
        else:
            _, cen, pts, depth, R = pr
            d.update({'t': 'prism', 'c': np.round(cen, nd_).tolist(), 'p': np.round(pts, nd_).tolist(), 'd': round(depth, nd_)})
        q = mat_quat(R)
        if abs(q[3]) < 0.99999:
            d['q'] = [round(v, 4) for v in q]
        out.append(d)
    return out, len(comps)


def decimate(meshes, grid=0.03):
    """Real mesh, merged on a grid: vertices in mm, triangles, one 24-bit color per triangle."""
    V = np.concatenate([m['V'] for m in meshes])
    off, Ts, Cs = 0, [], []
    for m in meshes:
        Ts.append(m['T'] + off); Cs.append(m['col']); off += len(m['V'])
    T = np.concatenate(Ts); C = np.concatenate(Cs)
    key = np.round(V / grid).astype(np.int64)
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    inv = inv.reshape(-1)
    cnt = np.bincount(inv)
    P = np.zeros((len(cnt), 3))
    np.add.at(P, inv, V)
    P /= cnt[:, None]
    W = inv[T]
    ok = (W[:, 0] != W[:, 1]) & (W[:, 1] != W[:, 2]) & (W[:, 0] != W[:, 2])
    W, C = W[ok], C[ok]
    srt = np.sort(W, axis=1)
    _, keep = np.unique(srt, axis=0, return_index=True)
    keep.sort()
    W, C = W[keep], C[keep]
    used = np.unique(W)
    remap = -np.ones(len(P), np.int64); remap[used] = np.arange(len(used))
    W = remap[W]; P = P[used]
    ci = np.clip(np.round(C * 255), 0, 255).astype(np.int64)
    return {'v': np.round(P * 1000).astype(int).reshape(-1).tolist(), 't': W.reshape(-1).tolist(),
            'c': (ci[:, 0] * 65536 + ci[:, 1] * 256 + ci[:, 2]).tolist()}


# ---------------------------------------------------------------- fit measure


def part_mask(pt, X, pad):
    """Which points X (n x 3) fall inside one proxy part (the parts' JSON form) grown by 'pad'."""
    R = quat_mat(pt.get('q', [0, 0, 0, 1]))
    L = (X - np.asarray(pt['c'])) @ R
    if pt['t'] == 'box':
        h = np.maximum(np.asarray(pt['s'], float), 0.012) / 2 + pad
        return np.all(np.abs(L) <= h, axis=1)
    m = np.abs(L[:, 2]) <= max(pt['d'], 0.012) / 2 + pad
    if m.any():
        m[m] = convex_mask(np.asarray(pt['p'], float), L[m, 0], L[m, 1], pad)
    return m


def fit_score(meshes, parts, tol=0.02):
    """How close the proxy is to the real mesh, on one voxel grid (tol / 4, coarser only where the piece is too large
    for that): 'miss' how far the mesh's solid reaches past the proxy and 'over' how far the proxy reaches past the
    solid, in mm, as the 99th percentile and the worst cell; 'iou' of the two; 'box' the largest difference between
    the proxy's bounds and the mesh's, in mm."""
    if not meshes or not parts:
        return None
    nd = _nd()
    V = np.concatenate([m['V'] for m in meshes])
    lo, hi = V.min(0), V.max(0)
    ext = np.maximum(hi - lo, 0.005)
    vox = tol / 4
    while np.prod([math.ceil(e / vox) + 4 for e in ext]) > 1500000:
        vox *= 1.1
    g0 = lo - 2 * vox
    dims = [int(math.ceil(e / vox)) + 4 for e in ext]
    # each connected part's own solid, as the fit sees it (an open cup is its wall and the drink's surface, never a
    # solid block)
    S = np.zeros(dims, bool)
    for m in meshes:
        for idx in components(m['V'], m['T']):
            used = np.unique(m['T'][idx])
            remap = -np.ones(len(m['V']), np.int64); remap[used] = np.arange(len(used))
            Vc, Tc = m['V'][used], remap[m['T'][idx]]
            a = np.clip(np.floor((Vc.min(0) - g0) / vox).astype(int) - 2, 0, None)
            b = np.minimum(np.ceil((Vc.max(0) - g0) / vox).astype(int) + 3, dims)
            sub = solid_fast(sample_tris(Vc, Tc, vox * 0.5), g0 + a * vox, vox, list(b - a))
            S[a[0]:b[0], a[1]:b[1], a[2]:b[2]] |= sub
    ctr = [g0[i] + (np.arange(dims[i]) + 0.5) * vox for i in range(3)]
    P = np.zeros(dims, bool)
    plo, phi = np.full(3, np.inf), np.full(3, -np.inf)
    for pt in parts:
        R = quat_mat(pt.get('q', [0, 0, 0, 1]))
        if pt['t'] == 'box':
            h = np.maximum(np.asarray(pt['s'], float), 0.002) / 2
            cs = np.array([[x, y, z] for x in (-h[0], h[0]) for y in (-h[1], h[1]) for z in (-h[2], h[2])])
        else:
            dd = max(pt['d'], 0.002) / 2
            cs = np.array([[u, w, z] for u, w in pt['p'] for z in (-dd, dd)])
        W = cs @ R.T + np.asarray(pt['c'])
        plo, phi = np.minimum(plo, W.min(0)), np.maximum(phi, W.max(0))
        i0 = np.clip(np.floor((W.min(0) - vox - g0) / vox).astype(int), 0, np.array(dims))
        i1 = np.clip(np.ceil((W.max(0) + vox - g0) / vox).astype(int), 0, np.array(dims))
        if np.any(i1 <= i0):
            continue
        sub = np.stack(np.meshgrid(*[ctr[i][i0[i]:i1[i]] for i in range(3)], indexing='ij'), -1)
        sh = sub.shape[:3]
        sl = tuple(slice(i0[i], i1[i]) for i in range(3))
        P[sl] |= part_mask(pt, sub.reshape(-1, 3), vox * 0.5).reshape(sh)
    if not P.any() or not S.any():
        return None
    DS = nd.distance_transform_edt(~S) * vox
    DP = nd.distance_transform_edt(~P) * vox
    over, miss = DS[P], DP[S]
    mm = lambda v: round(float(v) * 1000, 1)
    return {'miss': mm(np.percentile(miss, 99)), 'miss_max': mm(miss.max()), 'over': mm(np.percentile(over, 99)),
            'over_max': mm(over.max()), 'iou': round(float((S & P).sum() / max((S | P).sum(), 1)), 3), 'vox': mm(vox),
            'box': mm(max(np.abs(plo - lo).max(), np.abs(phi - hi).max())), 'n': len(parts)}


OLD = None


def old_parts(name):
    """The parts of the last committed data/piece-models.json (VH_OLD names it), to measure both rounds alike."""
    global OLD
    if OLD is None:
        f = os.environ.get('VH_OLD')
        OLD = json.load(open(f))['pieces'] if f and os.path.exists(f) else {}
    return (OLD.get(name) or {}).get('parts')


# ---------------------------------------------------------------- item stands and their items


def transform_of(go):
    return (comp_of(go, 'Transform') or comp_of(go, 'RectTransform'))


def child(go, name):
    for ch in transform_of(go).read().m_Children:
        c = ch.read().m_GameObject.read()
        if c.m_Name == name:
            return c
    return None


def local_trs(go):
    t = transform_of(go).read()
    lp, lr, ls = t.m_LocalPosition, t.m_LocalRotation, t.m_LocalScale
    return [lp.x, lp.y, lp.z], [lr.x, lr.y, lr.z, lr.w], [ls.x, ls.y, ls.z]


def typetree_of(go, key):
    for c in go.m_Component:
        o = c.component.deref()
        if o.type.name == 'MonoBehaviour':
            try:
                d = o.read_typetree()
            except Exception:
                continue
            if key in d:
                return d
    return None


def do_stand(reader, root, name, path):
    """An item stand: its attach point (m_attachOther) in the piece's frame, its orientation type and what it takes."""
    d = typetree_of(root, 'm_attachOther')
    res = {'name': name, 'path': path}
    if not d:
        res['error'] = 'no ItemStand'
        return res
    want = d['m_attachOther']['m_PathID']
    stack = [(root, np.eye(4), True)]
    while stack:
        go, M, is_root = stack.pop()
        tobj = transform_of(go)
        if not is_root:
            t, q, s = local_trs(go)
            M = M @ trs(t, q, s)
        if tobj.path_id == want:
            R, sc = frame_of(M)
            res['attach'] = {'go': go.m_Name, 't': np.round(M[:3, 3], 4).tolist(), 'q': [round(v, 5) for v in mat_quat(R)],
                             's': np.round(sc, 4).tolist()}
        for ch in tobj.read().m_Children:
            stack.append((ch.read().m_GameObject.read(), M, False))

    def names(lst):
        out = []
        for ptr in lst or []:
            try:
                out.append(ptr_name(reader, ptr))
            except Exception as e:
                out.append('? ' + str(e)[:40])
        return out
    res['orientation'] = d.get('m_orientationType')
    res['types'] = d.get('m_supportedTypes')
    res['supported'] = names(d.get('m_supportedItems'))
    res['unsupported'] = names(d.get('m_unsupportedItems'))
    return res


def ptr_name(reader, ptr):
    """The GameObject name an ItemDrop pointer (a typetree dict) points at, within the loaded files."""
    pid = ptr['m_PathID']
    if not pid:
        return None
    if not hasattr(reader, 'by_pid'):
        reader.by_pid = {o.path_id: o for o in reader.env.objects}
    o = reader.by_pid.get(pid)
    if o is None:
        return str(pid)
    return o.read().m_GameObject.read().m_Name


def do_item(reader, root, name, path, work=None):
    """An item as an item stand shows it (ItemStand.SetVisualItem): the prefab's 'attach' child, or its 'attachobj'
    child when there is one, drawn in its own frame and set under the stand's attach point with attach's local
    position, rotation and scale, then moved by the item's first stand offset for that kind of stand."""
    res = {'name': name, 'path': path}
    d = typetree_of(root, 'm_itemData')
    if d:
        sh = d['m_itemData']['m_shared']
        res['type'] = sh.get('m_itemType')
        res['scaleQ'] = sh.get('m_scaleByQuality', 0)
        res['offsets'] = [{'p': [o['m_position'][k] for k in 'xyz'], 'r': [o['m_rotation'][k] for k in 'xyz'],
                           's': [o['m_scale'][k] for k in 'xyz'], 'o': o['m_orientations']} for o in sh.get('m_itemStandOffsets') or []]
    att = child(root, 'attach')
    if att is None:
        res['error'] = 'no attach child (an item stand cannot hold it)'
        return res
    obj = child(att, 'attachobj')
    node = obj or att
    t, q, s = local_trs(att)
    res['attach'] = {'t': [round(v, 4) for v in t], 'q': [round(v, 5) for v in q], 's': [round(v, 4) for v in s]}
    res['obj'] = 'attachobj' if obj else 'attach'
    meshes, _, _ = measure(reader, node, lod_root=root)
    if work and os.environ.get('VH_MESHES') and meshes:
        # the item's own triangles, merged only on a 0.5 mm grid, for the offline page on this PC (never committed)
        os.makedirs(os.path.join(work, 'item_meshes'), exist_ok=True)
        json.dump(decimate(meshes, 0.0005), open(os.path.join(work, 'item_meshes', name + '.json'), 'w'), separators=(',', ':'))
    if meshes:
        V = np.concatenate([m['V'] for m in meshes])
        res['bounds'] = {'min': V.min(0).round(3).tolist(), 'max': V.max(0).round(3).tolist()}
        res['tris'] = int(sum(len(m['T']) for m in meshes))
        res['materials'] = sorted(set(m['mat'] for m in meshes))
        if res['tris'] <= 60000:
            res['components'] = len(meshes)
            if work:
                save_meshes(work, name, meshes)
    else:
        res['error'] = 'no mesh under ' + res['obj']
    return res


def fit_item(res, meshes):
    """An item's proxy to TOL['items'], or to 1/50 of its largest size for a large one (a boss trophy, a tower
    shield), fitted once more at 1.8 times that when it still needs more than ITEM_PARTS parts."""
    V = np.concatenate([m['V'] for m in meshes])
    tol = max(TOL['items'], float(np.ptp(V, axis=0).max()) / 50)
    parts, nc = proxy(meshes, kind='item_budget', tol=tol)
    if len(parts) > ITEM_PARTS:
        tol *= 1.8
        parts, nc = proxy(meshes, kind='item_budget', tol=tol)
    res['tol'] = round(tol, 4)
    res['parts'] = parts
    res['components'] = nc
    res['fit'] = fit_score(meshes, parts, tol)


def fit_piece(res, meshes):
    """The proxy of one piece to the tolerance. A piece whose last proxy is within it already keeps that one."""
    name = res['name']
    tl = TOL['stands'] if name.startswith('itemstand') else TOL['pieces']
    op = old_parts(name)
    if op:
        res['fit_old'] = fit_score(meshes, op, tl)
        f = res['fit_old']
        if f and f['miss'] <= tl * 1000 and f['over'] <= tl * 1000 and f['box'] <= tl * 1000:
            res['parts'], res['fit'], res['kept'] = op, f, 1
            return
    parts, nc = proxy(meshes, tol=tl)
    res['parts'] = parts
    res['components'] = nc
    res['fit'] = fit_score(meshes, parts, tl)


def save_meshes(work, name, meshes):
    """The measured meshes of one prefab, kept on this PC between calls (never committed), so a refit does not read
    the game files again."""
    d = os.path.join(work, 'cache'); os.makedirs(d, exist_ok=True)
    arr = {}
    for i, m in enumerate(meshes):
        arr['V%d' % i], arr['T%d' % i], arr['C%d' % i] = m['V'].astype(np.float32), m['T'].astype(np.int32), m['col'].astype(np.float32)
    np.savez_compressed(os.path.join(d, name + '.npz'), **arr)
    json.dump([{k: m[k] for k in ('go', 'mat', 'tex', 'cls')} for m in meshes], open(os.path.join(d, name + '.json'), 'w'))


def load_meshes(work, name):
    d = os.path.join(work, 'cache')
    f = os.path.join(d, name + '.npz')
    if not os.path.exists(f):
        return None
    z = np.load(f)
    info = json.load(open(os.path.join(d, name + '.json')))
    return [dict(info[i], V=z['V%d' % i].astype(np.float64), T=z['T%d' % i].astype(np.int64), col=z['C%d' % i].astype(np.float64))
            for i in range(len(info))]


def rescore(work, names_file, mode='pieces', part='0/1', seconds=150):
    """The fit measures again (after a change to fit_score), without fitting."""
    t0 = time.time()
    i0, k = map(int, part.split('/'))
    outdir = os.path.join(work, 'out' if mode == 'pieces' else 'items')
    n_ = 0
    for n in [n.strip() for n in open(names_file) if n.strip()][i0::k]:
        f = os.path.join(outdir, n + '.json')
        if time.time() - t0 > seconds or not os.path.exists(f):
            continue
        res = json.load(open(f))
        if not res.get('parts') or res.get('rescored'):
            continue
        ms = load_meshes(work, n)
        tl = res.get('tol') or (TOL['stands'] if n.startswith('itemstand') else TOL['pieces'] if mode == 'pieces' else TOL['items'])
        res['fit'] = fit_score(ms, res['parts'], tl)
        if mode == 'pieces' and old_parts(n):
            res['fit_old'] = fit_score(ms, old_parts(n), tl)
        res['rescored'] = 1
        json.dump(res, open(f, 'w'))
        n_ += 1
    print('rescored', n_, round(time.time() - t0, 1), 's')


def fit(work, names_file, seconds=150, mode='pieces', part='0/1'):
    """Fit the proxies from the cached meshes ('run' or 'items' first), as many as fit in the time given; part 'i/k'
    takes every k-th name from the i-th, so k processes can share a list."""
    t0 = time.time()
    i0, k = map(int, part.split('/'))
    names = [n.strip() for n in open(names_file) if n.strip()][i0::k]
    outdir = os.path.join(work, 'out' if mode == 'pieces' else 'items')
    done = left = 0
    for n in names:
        f = os.path.join(outdir, n + '.json')
        if not os.path.exists(f):
            continue
        res = json.load(open(f))
        if 'fit' in res or res.get('error') or res.get('fit_error') or (res.get('fit_started') and not os.environ.get('VH_RETRY')):
            continue
        if time.time() - t0 > seconds:
            left += 1
            continue
        meshes = load_meshes(work, n)
        if not meshes:
            continue
        t1 = time.time()
        # marked first, so a fit cut off by the call's time limit is not tried again (VH_RETRY=1 tries those)
        json.dump(dict(res, fit_started=1), open(f, 'w'))
        try:
            (fit_piece if mode == 'pieces' else fit_item)(res, meshes)
        except Exception as e:
            res['fit_error'] = repr(e)[:200]
        res['fit_s'] = round(time.time() - t1, 1)
        res.pop('fit_started', None)
        json.dump(res, open(f, 'w'))
        done += 1
        print(n, len(res.get('parts', [])), 'parts', 'kept' if res.get('kept') else '', res.get('fit'), res['fit_s'], 's', flush=True)
    print('fitted', done, 'left', left, round(time.time() - t0, 1), 's')


def run(data_dir, work, names_file, seconds=150, mode='pieces'):
    import UnityPy
    t0 = time.time()
    idx = json.load(open(os.path.join(work, 'index.json')))
    load_layers(work)
    names = [n.strip() for n in open(names_file) if n.strip()]
    outdir = os.path.join(work, {'pieces': 'out', 'items': 'items', 'stands': 'stands'}[mode]); os.makedirs(outdir, exist_ok=True)
    do = {'pieces': lambda r, g, n, p: do_piece(r, g, n, p, work), 'items': lambda r, g, n, p: do_item(r, g, n, p, work), 'stands': do_stand}[mode]
    todo = {}
    missing = []
    for n in names:
        if os.path.exists(os.path.join(outdir, n + '.json')):
            continue
        c = idx['prefabs'].get(n)
        if not c:
            missing.append(n); continue
        todo.setdefault(c[0][0], []).append((n, c[0][1]))
    json.dump(missing, open(os.path.join(work, 'missing.json' if mode == 'pieces' else 'missing-' + mode + '.json'), 'w'))
    if not todo:
        print('nothing left; not in the game files:', len(missing)); return
    # biggest group first
    bundle, items = max(todo.items(), key=lambda kv: len(kv[1]))
    bdir = os.path.join(data_dir, 'StreamingAssets/SoftRef/Bundles')
    files = [os.path.join(bdir, bundle)] + [os.path.join(bdir, d) for d in idx['deps'].get(bundle, [])]
    dr = os.path.join(data_dir, 'Resources/unity default resources')
    if os.path.exists(dr): files.append(dr)
    env = UnityPy.load(*files)
    reader = Reader(env)
    cont = env.container
    print('loaded', bundle, len(files), 'files', round(time.time() - t0, 1), 's;', len(items), 'to do here,', sum(len(v) for v in todo.values()), 'in all')
    done = 0
    for n, p in items:
        if time.time() - t0 > seconds:
            break
        # a placeholder first, so a piece that kills the process is not tried again
        json.dump({'name': n, 'path': p, 'error': 'crashed'}, open(os.path.join(outdir, n + '.json'), 'w'))
        try:
            ptr = cont[p]
            res = do(reader, ptr.read(), n, p)
        except Exception as e:
            res = {'name': n, 'path': p, 'error': repr(e)[:300]}
        json.dump(res, open(os.path.join(outdir, n + '.json'), 'w'))
        done += 1
        print(n, len(res.get('parts', [])), 'parts', res.get('error', '')[:80], round(time.time() - t0, 1), flush=True)
    print('done', done, 'left', sum(len(v) for v in todo.values()) - done)


def collect(work, out):
    outdir = os.path.join(work, 'out')
    res = {}
    for f in sorted(os.listdir(outdir)):
        if f.endswith('.json'):
            d = json.load(open(os.path.join(outdir, f)))
            # not fitted yet: the last proxy stays (VH_OLD), marked so
            if not d.get('parts') and old_parts(d['name']):
                d['parts'], d['old'] = old_parts(d['name']), 1
            d.pop('fit_started', None)
            res[d['name']] = d
    missing = json.load(open(os.path.join(work, 'missing.json'))) if os.path.exists(os.path.join(work, 'missing.json')) else []
    json.dump({'pieces': res, 'missing': missing}, open(out, 'w'), separators=(',', ':'))
    print(out, len(res), 'pieces', os.path.getsize(out), 'bytes')


def qmul(a, b):
    ax, ay, az, aw = a; bx, by, bz, bw = b
    return [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz]


def euler_q(e):
    """Unity's Quaternion.Euler(x, y, z) in degrees: z first, then x, then y."""
    def ax(i, a):
        h = math.radians(a) / 2
        q = [0.0, 0.0, 0.0, math.cos(h)]; q[i] = math.sin(h)
        return q
    return qmul(ax(1, e[1]), qmul(ax(0, e[0]), ax(2, e[2])))


def collect_items(work, out):
    """The items with their proxies, and for each item stand where the item sits in the stand's own frame (c, q, s:
    the shown branch's position, rotation and scale), as ItemStand.SetVisualItem places it at quality 1 and the first
    orientation."""
    stands = {}
    sd = os.path.join(work, 'stands')
    for f in sorted(os.listdir(sd)):
        d = json.load(open(os.path.join(sd, f)))
        if d.get('attach'):
            stands[d['name']] = d
    items, none = {}, {}
    idir = os.path.join(work, 'items')
    for f in sorted(os.listdir(idir)):
        d = json.load(open(os.path.join(idir, f)))
        n = d['name']
        if d.get('error') or not d.get('parts'):
            none[n] = d.get('error', 'no parts')
            if not d.get('attach'):
                continue
        e = {k: d[k] for k in ('type', 'bounds', 'tris', 'parts', 'fit', 'obj', 'path', 'tol') if k in d}
        at = {}
        for sn, st in stands.items():
            A = trs(st['attach']['t'], st['attach']['q'], [1, 1, 1])
            offs = [o for o in d.get('offsets', []) if int(st['orientation']) & int(o['o'])]
            off = offs[0] if offs else {'p': [0, 0, 0], 'r': [0, 0, 0], 's': [1, 1, 1]}
            a = d['attach']
            k = 1.0  # GetScale(quality 1) = 1 + (1 - 1) * m_scaleByQuality
            t = np.array(a['t']) + np.array(off['p'])
            q = qmul(a['q'], euler_q(off['r']))
            sc = np.array(a['s']) * k * np.array(off['s'])
            c = A[:3, :3] @ t + A[:3, 3]
            qq = qmul(st['attach']['q'], q)
            if qq[3] < 0:
                qq = [-v for v in qq]
            at[sn] = {'c': np.round(c, 4).tolist(), 'q': [round(v, 5) for v in qq], 's': np.round(sc, 4).tolist()}
            if offs:
                at[sn]['off'] = 1
        e['at'] = at
        items[n] = e
    res = {'stands': {n: {k: st[k] for k in ('attach', 'orientation', 'types', 'supported', 'unsupported')} for n, st in stands.items()},
           'items': items, 'none': none,
           'missing': json.load(open(os.path.join(work, 'missing-items.json'))) if os.path.exists(os.path.join(work, 'missing-items.json')) else []}
    json.dump(res, open(out, 'w'), separators=(',', ':'))
    print(out, len(items), 'items', len(none), 'without a model', len(res['missing']), 'not found', os.path.getsize(out), 'bytes')


def meshpack(work, out):
    d = os.path.join(work, 'meshes')
    parts = []
    for f in sorted(os.listdir(d)):
        if f.endswith('.json'):
            parts.append(json.dumps(f[:-5]) + ':' + open(os.path.join(d, f)).read())
    with open(out, 'w') as fo:
        fo.write('// Decimated meshes of Valheim pieces for the offline lab page on this PC only. Do not share or commit.\n')
        fo.write('window.VHMeshPack={' + ','.join(parts) + '};\n')
    print(out, len(parts), 'pieces', os.path.getsize(out), 'bytes')


# ---------------------------------------------------------------- exact tops of the pieces flat stands rest on


def ray_tops(parts, X, Z):
    """For each point (X[i], Z[i]), the highest y where a vertical line there leaves the proxy, or -inf."""
    top = np.full(len(X), -np.inf)
    for pt in parts:
        R = quat_mat(pt.get('q', [0, 0, 0, 1]))
        c = np.asarray(pt['c'], float)
        # the line (x, t, z) in the part's frame: a + t b
        a = (np.stack([X, np.zeros_like(X), Z], 1) - c) @ R
        b = R[1]
        if pt['t'] == 'box':
            h = np.maximum(np.asarray(pt['s'], float), 0.002) / 2
            rows = [(np.eye(3)[i], h[i]) for i in range(3)] + [(-np.eye(3)[i], h[i]) for i in range(3)]
        else:
            P = np.asarray(pt['p'], float)
            dd = max(pt['d'], 0.002) / 2
            rows = [(np.array([0, 0, 1.0]), dd), (np.array([0, 0, -1.0]), dd)]
            sg = 1 if poly_signed(P) > 0 else -1
            for i in range(len(P)):
                e = P[(i + 1) % len(P)] - P[i]
                nrm = np.array([e[1], -e[0], 0.0]) * sg
                nrm /= max(np.linalg.norm(nrm), 1e-12)
                rows.append((nrm, float(nrm[:2] @ P[i])))
        t0 = np.full(len(X), -np.inf); t1 = np.full(len(X), np.inf); ok = np.ones(len(X), bool)
        for nrm, off in rows:
            na, nb = a @ nrm, float(nrm @ b)
            if abs(nb) < 1e-9:
                ok &= na <= off + 1e-9
            elif nb > 0:
                t1 = np.minimum(t1, (off - na) / nb)
            else:
                t0 = np.maximum(t0, (off - na) / nb)
        ok &= t1 >= t0
        top = np.where(ok & (t1 > top), t1, top)
    return top


def mesh_tops(meshes, g=0.01):
    """The mesh's height map on a g grid over x and z: the highest sampled point in each cell."""
    V = np.concatenate([m['V'] for m in meshes])
    pts = np.concatenate([sample_tris(m['V'], m['T'], 0.003, cap=800) for m in meshes])
    lo = V.min(0)
    nx, nz = int(np.ptp(V[:, 0]) / g) + 1, int(np.ptp(V[:, 2]) / g) + 1
    H = np.full((nx, nz), -np.inf)
    ij = np.clip(((pts[:, [0, 2]] - lo[[0, 2]]) / g).astype(int), 0, [nx - 1, nz - 1])
    np.maximum.at(H, (ij[:, 0], ij[:, 1]), pts[:, 1])
    X, Z = np.meshgrid(lo[0] + (np.arange(nx) + 0.5) * g, lo[2] + (np.arange(nz) + 0.5) * g, indexing='ij')
    return H, X, Z, float(V[:, 1].max())


def top_error(meshes, parts, M=None):
    """How far the proxy's top lies from the mesh's top where a stand could rest (cells within 15 cm of the highest
    point, one 1 cm cell in from the edge of that area), mm: median, 95th percentile, worst."""
    nd = _nd()
    H, X, Z, top = M or mesh_tops(meshes)
    m = nd.binary_erosion(H > top - 0.15)
    if not m.any():
        m = H > top - 0.15
    Hp = ray_tops(parts, X[m], Z[m])
    d = np.abs(np.where(np.isfinite(Hp), Hp, top - 0.3) - H[m]) * 1000
    return {'median': round(float(np.median(d)), 1), 'p95': round(float(np.percentile(d, 95)), 1), 'max': round(float(d.max()), 1), 'cells': int(m.sum())}


def snap_tops(work, names_file, reach=0.04):
    """Each box whose top face is level is set, where it is the proxy's top, to the mesh's height there (the median of
    the mesh's top over those cells, when it lies within 'reach'). Writes the parts back with 'tops' (before, after)."""
    for n in [l.strip() for l in open(names_file) if l.strip()]:
        f = os.path.join(work, 'out', n + '.json')
        ms = load_meshes(work, n)
        if not ms or not os.path.exists(f):
            continue
        res = json.load(open(f))
        parts = res.get('parts') or old_parts(n)
        if not parts:
            continue
        M = mesh_tops(ms)
        H, X, Z, top = M
        before = top_error(ms, parts, M)
        m = H > top - 0.15
        Xs, Zs, Hs = X[m], Z[m], H[m]
        for _ in range(2):
            tops = np.stack([ray_tops([pt], Xs, Zs) for pt in parts])  # parts x cells
            best = tops.argmax(0)
            hi = tops.max(0)
            for i, pt in enumerate(parts):
                if pt['t'] != 'box':
                    continue
                R = quat_mat(pt.get('q', [0, 0, 0, 1]))
                k = int(np.argmax(np.abs(R[1])))
                if abs(R[1, k]) < 0.9995:
                    continue
                sel = (best == i) & np.isfinite(hi) & (np.abs(Hs - hi) <= reach)
                if sel.sum() < 3:
                    continue
                want = float(np.median(Hs[sel]))
                cur = float(pt['c'][1] + pt['s'][k] / 2)
                bottom = float(pt['c'][1] - pt['s'][k] / 2)
                if abs(want - cur) < 0.0002 or want - bottom < 0.003:
                    continue
                s = list(pt['s']); s[k] = round(want - bottom, 4)
                c = list(pt['c']); c[1] = round((want + bottom) / 2, 4)
                pt['s'], pt['c'] = s, c
        after = top_error(ms, parts, M)
        res['parts'], res['tops'] = parts, {'before': before, 'after': after}
        json.dump(res, open(f, 'w'))
        print(n, before, after, flush=True)


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'index':
        build_index(sys.argv[2], sys.argv[3])
        write_layers(sys.argv[2], sys.argv[3])
    elif cmd == 'layers':
        write_layers(sys.argv[2], sys.argv[3])
    elif cmd == 'run':
        run(sys.argv[2], sys.argv[3], sys.argv[4], float(sys.argv[5]) if len(sys.argv) > 5 else 150)
    elif cmd in ('items', 'stands'):
        run(sys.argv[2], sys.argv[3], sys.argv[4], float(sys.argv[5]) if len(sys.argv) > 5 else 150, mode=cmd)
    elif cmd == 'fit':
        fit(sys.argv[2], sys.argv[3], float(sys.argv[4]) if len(sys.argv) > 4 else 150, sys.argv[5] if len(sys.argv) > 5 else 'pieces',
            sys.argv[6] if len(sys.argv) > 6 else '0/1')
    elif cmd == 'rescore':
        rescore(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5] if len(sys.argv) > 5 else '0/1')
    elif cmd == 'collect_items':
        collect_items(sys.argv[2], sys.argv[3])
    elif cmd == 'collect':
        collect(sys.argv[2], sys.argv[3])
    elif cmd == 'tops':
        snap_tops(sys.argv[2], sys.argv[3])
    elif cmd == 'meshpack':
        meshpack(sys.argv[2], sys.argv[3])
