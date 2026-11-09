#!/usr/bin/env python3
"""Measure Valheim piece prefabs and fit a low-poly proxy to each, on Tyler's PC only.

Reads the game's asset bundles (UnityPy), walks each prefab's GameObject tree with its transforms, takes the visible
LOD0 meshes and the colliders, and writes one small JSON per piece: render bounds, collider boxes, the pivot, and a
proxy of up to about 40 boxes and prisms with a color per part. The meshes themselves never leave the PC; only the
measurements and the proxy (our own coarse geometry) are written.

    python3 extract_models.py index   <Valheim_Data> <work dir>              # prefab name -> bundle
    python3 extract_models.py run     <Valheim_Data> <work dir> <names.txt> [seconds]
    python3 extract_models.py collect <work dir> <out.json>
    python3 extract_models.py meshpack <work dir> <out.js>

With VH_MESHES=1 in the environment, 'run' also writes a decimated copy of each piece's meshes (vertices merged on a
3 cm grid, a color per triangle) to <work dir>/meshes/, and 'meshpack' joins them into one script for the offline
copy of the lab page. That pack holds game geometry: it stays on Tyler's PC (BepInEx/config/Villheim-tools/) and is
never committed or published.

'run' does as many pieces as fit in the time given (default 150 s) and skips pieces already done, so it can be called
again until it reports nothing left. Results go to <work dir>/out/<name>.json.
"""
import json, math, os, re, sys, time

import numpy as np

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


def sample_tris(V, T, step):
    """Points on the triangles, at most 'step' apart."""
    out = [V]
    a, b, c = V[T[:, 0]], V[T[:, 1]], V[T[:, 2]]
    L = np.maximum(np.linalg.norm(b - a, axis=1), np.linalg.norm(c - a, axis=1))
    n = np.clip(np.ceil(L / step).astype(int), 1, 60)
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


def fit_component(V, T, maxdim_piece):
    """Primitives for one connected part: a box, a prism (triangle, wedge, n-gon) or a few boxes."""
    P = V
    R = best_frame(P)
    L = P @ R
    lo, hi = L.min(0), L.max(0)
    ext = np.maximum(hi - lo, 0.01)
    box_vol = float(np.prod(ext))
    # prism along each frame axis: hull of the other two coordinates
    best = None
    for k in range(3):
        o = [i for i in range(3) if i != k]
        h = hull2d(L[:, o])
        if len(h) < 3:
            continue
        hs = simplify(h, 8)
        ratio = poly_area(hs) / max(ext[o[0]] * ext[o[1]], 1e-6)
        if best is None or ratio < best[0]:
            best = (ratio, k, hs)
    vox = float(np.clip(ext.max() / 22, 0.025, 0.10))
    dims = [max(1, int(math.ceil(e / vox))) for e in ext]
    surf = sample_tris(L, T, vox * 0.5)
    S, _ = solid_grid(surf, lo, vox, dims)
    solid = S.sum() * vox ** 3
    prim_vol = box_vol if best is None or best[0] >= 0.86 else box_vol * best[0]
    thin = sum(1 for d in dims if d <= 2)
    fill = min(1.0, solid / max(prim_vol, 1e-9))
    parts = []
    if fill < 0.5 and thin < 1 and max(ext) > 0.25 and S.sum() > 30:
        for (a, b) in greedy_boxes(S, 10):
            c = lo + (a + b) / 2 * vox
            s = (b - a) * vox
            parts.append(('box', R @ c, s, R))
        if parts:
            return parts
    if best is not None and best[0] < 0.86:
        ratio, k, hs = best
        o = [i for i in range(3) if i != k]
        # frame with the extrusion axis last, kept right handed
        Rp = np.stack([R[:, o[0]], R[:, o[1]], R[:, k]], 1)
        if np.linalg.det(Rp) < 0:
            Rp[:, 2] *= -1
        Lp = P @ Rp
        clo, chi = Lp.min(0), Lp.max(0)
        c2 = (clo + chi) / 2
        pts = hs - c2[:2]
        parts.append(('prism', Rp @ c2, pts, float(chi[2] - clo[2]), Rp))
        return parts
    c = (lo + hi) / 2
    parts.append(('box', R @ c, ext, R))
    return parts


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


def comp_of(go, tname):
    for c in go.m_Component:
        o = c.component.deref()
        if o.type.name == tname:
            return o
    return None


def measure(reader, root):
    """Walk the prefab; returns meshes (piece-frame verts, tris, per-tri colors/material names) and colliders."""
    meshes, colliders, lod_skip = [], [], set()
    stack = [(root, np.eye(4), True)]
    nodes = []
    while stack:
        go, M, is_root = stack.pop()
        tr = (comp_of(go, 'Transform') or comp_of(go, 'RectTransform')).read()
        if not is_root:
            lp, lr, ls = tr.m_LocalPosition, tr.m_LocalRotation, tr.m_LocalScale
            M = M @ trs((lp.x, lp.y, lp.z), (lr.x, lr.y, lr.z, lr.w), (ls.x, ls.y, ls.z))
        nodes.append((go, M))
        for ch in tr.m_Children:
            cgo = ch.read().m_GameObject.read()
            if cgo.m_IsActive:
                stack.append((cgo, M, False))
    for go, M in nodes:
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
                cr = o.read()
                if not getattr(cr, 'm_Enabled', True):
                    continue
                trig = bool(getattr(cr, 'm_IsTrigger', False))
                if t == 'BoxCollider':
                    ce, sz = cr.m_Center, cr.m_Size
                    lo = np.array([ce.x - sz.x / 2, ce.y - sz.y / 2, ce.z - sz.z / 2]); hi = lo + [sz.x, sz.y, sz.z]
                elif t == 'SphereCollider':
                    ce, rr = cr.m_Center, cr.m_Radius
                    lo = np.array([ce.x - rr, ce.y - rr, ce.z - rr]); hi = lo + 2 * rr
                elif t == 'CapsuleCollider':
                    ce, rr, hh, d = cr.m_Center, cr.m_Radius, cr.m_Height, cr.m_Direction
                    half = [rr, rr, rr]; half[d] = max(hh / 2, rr)
                    lo = np.array([ce.x, ce.y, ce.z]) - half; hi = np.array([ce.x, ce.y, ce.z]) + half
                else:
                    try:
                        mm = cr.m_Mesh.read()
                        b = mm.m_LocalAABB
                        ce, ex = b.m_Center, b.m_Extent
                        lo = np.array([ce.x - ex.x, ce.y - ex.y, ce.z - ex.z]); hi = np.array([ce.x + ex.x, ce.y + ex.y, ce.z + ex.z])
                    except Exception:
                        continue
                corners = np.array([[x, y, z] for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])])
                W = (M[:3, :3] @ corners.T).T + M[:3, 3]
                colliders.append({'type': t.replace('Collider', '').lower(), 'go': name, 'trigger': trig,
                                  'min': W.min(0).round(3).tolist(), 'max': W.max(0).round(3).tolist()})
    return meshes, colliders


def hexcol(c):
    c = np.clip(np.asarray(c), 0, 1)
    return '#%02x%02x%02x' % tuple(int(round(v * 255)) for v in c)


def proxy(meshes, max_parts=40):
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
    # leave out nails and other small details
    keep = [c for c in comps if not (c['ext'].max() < 0.06 or (c['area'] < 0.002 * total_area and c['ext'].max() < 0.15))]
    if not keep:
        keep = comps
    parts = []
    if len(keep) <= max_parts:
        for c in keep:
            for pr in fit_component(c['V'], c['T'], maxdim):
                parts.append((pr, c))
    if len(parts) > max_parts or len(keep) > max_parts:
        # too many parts: one voxel cover of the whole piece in its best frame, colored by the nearest part
        parts = []
        V = np.concatenate([c['V'] for c in keep])
        R = best_frame(V)
        L = V @ R
        llo, lhi = L.min(0), L.max(0)
        ext = np.maximum(lhi - llo, 0.01)
        vox = float(np.clip(ext.max() / 30, 0.04, 0.12))
        dims = [max(1, int(math.ceil(e / vox))) for e in ext]
        pts, owner = [], []
        for i, c in enumerate(keep):
            s = sample_tris(c['V'] @ R, c['T'], vox * 0.5)
            pts.append(s); owner.append(np.full(len(s), i))
        pts = np.concatenate(pts); owner = np.concatenate(owner)
        S, _ = solid_grid(pts, llo, vox, dims)
        ij = np.clip(np.floor((pts - llo) / vox).astype(int), 0, np.array(dims) - 1)
        for (a, b) in greedy_boxes(S, max_parts, cover=0.95, min_frac=0.002):
            inside = np.all((ij >= a) & (ij < b), axis=1)
            near = np.bincount(owner[inside], minlength=len(keep)).argmax() if inside.any() else 0
            cc = llo + (a + b) / 2 * vox
            parts.append((('box', R @ cc, (b - a) * vox, R), keep[near]))
    out = []
    for pr, c in parts:
        d = {'col': hexcol(c['col']), 'm': c['cls'] or mat_class(c['go'])}
        if pr[0] == 'box':
            _, cen, s, R = pr
            d.update({'t': 'box', 'c': np.round(cen, 3).tolist(), 's': np.round(s, 3).tolist()})
        else:
            _, cen, pts, depth, R = pr
            d.update({'t': 'prism', 'c': np.round(cen, 3).tolist(), 'p': np.round(pts, 3).tolist(), 'd': round(depth, 3)})
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


def do_piece(reader, root, name, path, work=None):
    meshes, colliders = measure(reader, root)
    if work and os.environ.get('VH_MESHES') and meshes:
        os.makedirs(os.path.join(work, 'meshes'), exist_ok=True)
        json.dump(decimate(meshes), open(os.path.join(work, 'meshes', name + '.json'), 'w'), separators=(',', ':'))
    res = {'name': name, 'path': path, 'colliders': colliders}
    solid = [c for c in colliders if not c['trigger']]
    if solid:
        res['collider'] = {'min': np.min([c['min'] for c in solid], 0).round(3).tolist(), 'max': np.max([c['max'] for c in solid], 0).round(3).tolist()}
    if meshes:
        V = np.concatenate([m['V'] for m in meshes])
        res['bounds'] = {'min': V.min(0).round(3).tolist(), 'max': V.max(0).round(3).tolist()}
        res['tris'] = int(sum(len(m['T']) for m in meshes))
        res['materials'] = sorted(set(m['mat'] for m in meshes))
        if res['tris'] <= 30000:
            parts, nc = proxy(meshes)
            res['parts'] = parts
            res['components'] = nc
    return res


def run(data_dir, work, names_file, seconds=150):
    import UnityPy
    t0 = time.time()
    idx = json.load(open(os.path.join(work, 'index.json')))
    names = [n.strip() for n in open(names_file) if n.strip()]
    outdir = os.path.join(work, 'out'); os.makedirs(outdir, exist_ok=True)
    todo = {}
    missing = []
    for n in names:
        if os.path.exists(os.path.join(outdir, n + '.json')):
            continue
        c = idx['prefabs'].get(n)
        if not c:
            missing.append(n); continue
        todo.setdefault(c[0][0], []).append((n, c[0][1]))
    json.dump(missing, open(os.path.join(work, 'missing.json'), 'w'))
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
            res = do_piece(reader, ptr.read(), n, p, work)
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
            res[d['name']] = d
    missing = json.load(open(os.path.join(work, 'missing.json'))) if os.path.exists(os.path.join(work, 'missing.json')) else []
    json.dump({'pieces': res, 'missing': missing}, open(out, 'w'), separators=(',', ':'))
    print(out, len(res), 'pieces', os.path.getsize(out), 'bytes')


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


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'index':
        build_index(sys.argv[2], sys.argv[3])
    elif cmd == 'run':
        run(sys.argv[2], sys.argv[3], sys.argv[4], float(sys.argv[5]) if len(sys.argv) > 5 else 150)
    elif cmd == 'collect':
        collect(sys.argv[2], sys.argv[3])
    elif cmd == 'meshpack':
        meshpack(sys.argv[2], sys.argv[3])
