# Roof proportions of big halls and round buildings in the corpus (Villheim-blueprints, on Tyler's PC; read only), the
# 300 m2 set of lab/hub_posts.py: python3 lab/hub_roofs.py <corpus dir> (writes roofs.json, prints the quantiles that
# lib/hub.js ROOF_Q holds). rise: the highest roof piece less the eave (5th percentile of the roof pieces' heights);
# width: the ground floor's short side; crown: the highest roof piece less the 90th percentile (a lantern, cupola or
# spire over the main roof), against the main roof (90th percentile less the eave).
import os, sys, math, json, re, collections, statistics as st
ROOT = sys.argv[1]
FLOOR = re.compile(r'floor', re.I); WALL = re.compile(r'(wall|window)', re.I); ROOF = re.compile(r'roof', re.I)
HALLW = re.compile(r'(hall|longhouse|long house|longhus|mead|throne|jarl|chief|feast|langhus)', re.I)
EXC = re.compile(r'^(arena|artistic|advanced-base|castle|portal-hub|tree-house|storage|statue|bridge|farming|interior-design|_tests|_errors|village|starter-home)/')
def yaw(q):
    x, y, z, w = q
    return math.degrees(math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + x * x)))
def parse(path):
    ps = []; mode = None
    with open(path, encoding='utf-8', errors='ignore') as f:
        for raw in f:
            line = raw.strip()
            if not line: continue
            if line[0] == '#': mode = line[1:].split(':')[0]; continue
            if mode != 'Pieces': continue
            p = line.split(';')
            if len(p) < 9: continue
            try: n = [float(v) for v in p[2:9]]
            except ValueError: continue
            ps.append((p[0], n[0], n[1], n[2], yaw(n[3:7])))
    return ps
out = []
for d, _, files in os.walk(ROOT):
    for fn in files:
        if not fn.endswith('.blueprint'): continue
        path = os.path.join(d, fn); rel = os.path.relpath(path, ROOT)
        if EXC.search(rel): continue
        try: ps = parse(path)
        except Exception: continue
        if len(ps) < 150: continue
        wa = [p for p in ps if WALL.search(p[0]) and 'roof' not in p[0].lower()]
        if not wa: continue
        dd = collections.Counter(round(p[4] % 90) % 90 for p in wa).most_common(1)[0][0]
        a = math.radians(dd); ca, sa = math.cos(a), math.sin(a)
        ps = [(p[0], p[1] * ca - p[3] * sa, p[2], p[1] * sa + p[3] * ca, p[4] - dd) for p in ps]
        fl = [p for p in ps if FLOOR.search(p[0]) and not ROOF.search(p[0])]
        if not fl: continue
        ys = sorted(p[2] for p in fl); g0 = ys[int(len(ys) * 0.05)]
        gf = [p for p in fl if abs(p[2] - g0) < 0.6]
        area = sum(1 if '1x1' in p[0] else 4 for p in gf)
        if area < 300: continue
        xs = [p[1] for p in gf]; zs = [p[3] for p in gf]
        w, l = sorted([max(xs) - min(xs) + 2, max(zs) - min(zs) + 2])
        if l > 73: continue
        walls = [p for p in ps if WALL.search(p[0]) and 'roof' not in p[0].lower() and g0 + 0.2 < p[2] < g0 + 2.6]
        if len(walls) < 20: continue
        off = sum(1 for p in walls if 8 < (p[4] % 90 + 90) % 90 < 82) / len(walls)
        if not (off >= 0.3 or HALLW.search(rel)): continue
        rf = sorted(p[2] for p in ps if ROOF.search(p[0]) and 'wall' not in p[0].lower())
        if len(rf) < 20: continue
        eave = rf[int(len(rf) * 0.05)]; p90 = rf[int(len(rf) * 0.9)]; top = rf[-1]
        if top - g0 > 60: continue
        out.append(dict(f=rel, round=off >= 0.3, w=round(w, 1), area=area, eave=round(eave - g0, 1), rise=round(top - eave, 1), main=round(p90 - eave, 1), crown=round(top - p90, 1)))
json.dump(out, open('roofs.json', 'w'))
def q(v, f): v = sorted(v); return v[int(f * (len(v) - 1))]
for lab, rows in [('round', [r for r in out if r['round']]), ('halls', [r for r in out if not r['round']]), ('all', out)]:
    rw = [r['rise'] / r['w'] for r in rows]; cr = [r['crown'] / max(0.5, r['main']) for r in rows]; ev = [r['eave'] for r in rows]
    print(f"{lab}: {len(rows)} builds; roof rise / width median {st.median(rw):.2f} (q1 {q(rw,.25):.2f}, q3 {q(rw,.75):.2f}, q10 {q(rw,.1):.2f}, q90 {q(rw,.9):.2f}); rise median {st.median([r['rise'] for r in rows])} m; crown / main roof median {st.median(cr):.2f} (q1 {q(cr,.25):.2f}, q3 {q(cr,.75):.2f}, q90 {q(cr,.9):.2f}); eave median {st.median(ev)} m")
