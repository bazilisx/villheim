import json, os, sys, numpy as np
C = '/work/models/vhmodels/work/cache'
names = [l.strip() for l in open('/tmp/catalog/vanilla-names.txt') if l.strip()]
def srgb2lab(c):
    c = np.asarray(c, float)
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = lin @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)
def hexc(c): c = np.clip(c, 0, 1); return '#%02x%02x%02x' % tuple(int(round(v * 255)) for v in c)
def kmeans(X, w, k, it=25):
    rng = np.random.default_rng(0)
    if len(X) <= k: return X, w
    cent = X[rng.choice(len(X), k, replace=False, p=w / w.sum())]
    for _ in range(it):
        d = ((X[:, None, :] - cent[None]) ** 2).sum(-1); a = d.argmin(1)
        for j in range(k):
            m = a == j
            if m.any(): cent[j] = (X[m] * w[m, None]).sum(0) / w[m].sum()
    d = ((X[:, None, :] - cent[None]) ** 2).sum(-1); a = d.argmin(1)
    ww = np.array([w[a == j].sum() for j in range(k)])
    return cent, ww
out = {}
for n in names:
    jf, nf = os.path.join(C, n + '.json'), os.path.join(C, n + '.npz')
    if not os.path.exists(nf): continue
    info = json.load(open(jf)); z = np.load(nf)
    allc, allw, parts = [], [], {}
    lo, hi = np.full(3, 1e9), np.full(3, -1e9)
    for i, pi in enumerate(info):
        if 'V%d' % i not in z.files: continue
        V, T, Cc = z['V%d' % i].astype(float), z['T%d' % i], z['C%d' % i].astype(float)
        if len(T) == 0: continue
        lo = np.minimum(lo, V.min(0)); hi = np.maximum(hi, V.max(0))
        a = 0.5 * np.linalg.norm(np.cross(V[T[:, 1]] - V[T[:, 0]], V[T[:, 2]] - V[T[:, 0]]), axis=1)
        allc.append(Cc); allw.append(a)
        key = pi.get('mat') or '?'
        p = parts.setdefault(key, {'mat': key, 'tex': pi.get('tex', ''), 'area': 0.0, 'sum': np.zeros(3)})
        p['area'] += a.sum(); p['sum'] += (Cc * a[:, None]).sum(0)
    if not allc: continue
    Cc = np.concatenate(allc); w = np.concatenate(allw) + 1e-9
    lab = srgb2lab(Cc)
    k = 4 if len(Cc) > 40 else 2
    cent, ww = kmeans(lab, w, k)
    # back to rgb via nearest tri color of each centroid (good enough for a swatch)
    d = ((lab[:, None, :] - cent[None]) ** 2).sum(-1); a = d.argmin(1)
    sw = []
    for j in np.argsort(-ww):
        m = a == j
        if not m.any() or ww[j] / ww.sum() < 0.04: continue
        rgb = (Cc[m] * w[m, None]).sum(0) / w[m].sum()
        L = float(srgb2lab(rgb)[0])
        sw.append({'hex': hexc(rgb), 'share': round(float(ww[j] / ww.sum()), 2), 'L': round(L)})
    mean = (Cc * w[:, None]).sum(0) / w.sum(); Lm = srgb2lab(mean)
    Lw = (lab[:, 0] * w).sum() / w.sum()
    chroma = float((np.hypot(lab[:, 1], lab[:, 2]) * w).sum() / w.sum())
    tot = sum(p['area'] for p in parts.values())
    pl = sorted(({'mat': p['mat'], 'tex': p['tex'], 'share': round(p['area'] / tot, 2), 'hex': hexc(p['sum'] / max(p['area'], 1e-9)), 'L': round(float(srgb2lab(p['sum'] / max(p['area'], 1e-9))[0]))} for p in parts.values()), key=lambda p: -p['share'])
    out[n] = {'mean': hexc(mean), 'L': round(float(Lw)), 'chroma': round(chroma), 'swatches': sw, 'parts': pl, 'size': np.round(hi - lo, 2).tolist(), 'min': np.round(lo, 2).tolist(), 'max': np.round(hi, 2).tolist()}
json.dump(out, open('/tmp/catalog/colors.json', 'w'))
print(len(out), 'of', len(names))
